/* -*- mode: js2 - indent-tabs-mode: nil - js2-basic-offset: 4 -*- */
/*jshint multistr:true */
/*jshint esnext:true */
/*global imports: true */
/*global global: true */
/*global log: true */
/**
    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 2 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
**/

'use strict';

const Lang = imports.lang;
const St = imports.gi.St;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const PanelMenu = imports.ui.panelMenu;
const Shell = imports.gi.Shell;
const MessageTray = imports.ui.messageTray;
const Atk = imports.gi.Atk;
const Config = imports.misc.config;

const INHIBIT_APPS_KEY = 'inhibit-apps';
const SHOW_INDICATOR_KEY = 'show-indicator';
const SHOW_NOTIFICATIONS_KEY = 'show-notifications';
const USER_ENABLED_KEY = 'user-enabled';
const RESTORE_KEY = 'restore-state';

const Gettext = imports.gettext.domain('gnome-shell-extension-lidsleep');
const _ = Gettext.gettext;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;

const DBusFreedesktopIface = '<node>\
  <interface name="org.freedesktop.login1.Manager">\
    <method name="Inhibit">\
        <arg type="s" direction="in" />\
        <arg type="s" direction="in" />\
        <arg type="s" direction="in" />\
        <arg type="s" direction="in" />\
        <arg type="h" direction="out" />\
    </method>\
  </interface>\
</node>';

const DBusFreedesktopProxy = Gio.DBusProxy.makeProxyWrapper(DBusFreedesktopIface);

const IndicatorName = "Lidsleep";
const DisabledIcon = 'my-lidsleep-off-symbolic';
const EnabledIcon = 'my-lidsleep-on-symbolic';

let LidsleepIndicator;
let ShellVersion = parseInt(Config.PACKAGE_VERSION.split(".")[1]);

const Lidsleep = new Lang.Class({
    Name: IndicatorName,
    Extends: PanelMenu.Button,

    _init: function(metadata, params) {
        this.parent(null, IndicatorName);
        this.actor.accessible_role = Atk.Role.TOGGLE_BUTTON;

        this._settings = Convenience.getSettings();
        this._settings.connect("changed::" + SHOW_INDICATOR_KEY, Lang.bind(this, function() {
            if (this._settings.get_boolean(SHOW_INDICATOR_KEY))
                this.actor.show();
            else
                this.actor.hide();
        }));
        if (!this._settings.get_boolean(SHOW_INDICATOR_KEY))
            this.actor.hide();


        this._freedesktopProxy = new DBusFreedesktopProxy(Gio.DBus.system,
                                                  "org.freedesktop.login1",
                                                  "/org/freedesktop/login1");

        // From auto-move-windows@gnome-shell-extensions.gcampax.github.com
        this._windowTracker = Shell.WindowTracker.get_default();

        // ("screen" in global) is false on 3.28, although global.screen exists
        if (typeof global.screen !== "undefined") {
            this._screen = global.screen;
            this._display = this._screen.get_display();
        }
        else {
            this._screen = global.display;
            this._display = this._screen;
        }

        // Connect after so the handler from ShellWindowTracker has already run
        this._windowCreatedId = this._display.connect_after('window-created', Lang.bind(this, this._mayInhibit));
        let shellwm = global.window_manager;
        this._windowDestroyedId = shellwm.connect('destroy', Lang.bind(this, this._mayUninhibit));

        this._icon = new St.Icon({
            style_class: 'system-status-icon'
        });
        this._icon.gicon = Gio.icon_new_for_string(Me.path + '/icons/' + DisabledIcon +'.svg');

        this._state = false;
        this._inhibitor;
        // who has requested the inhibition
        this._last_app = "";
        this._apps = [];


        this.actor.add_actor(this._icon);
        this.actor.add_style_class_name('panel-status-button');
        this.actor.connect('button-press-event', Lang.bind(this, this.toggleState));

        // Restore user state
        if (this._settings.get_boolean(USER_ENABLED_KEY) && this._settings.get_boolean(RESTORE_KEY)) {
            this.toggleState();
        }

        // List current windows to check if we need to inhibit
        global.get_window_actors().map(Lang.bind(this, function(window) {
            this._mayInhibit(null, window.meta_window, null);
        }));
    },

    toggleState: function() {
        if (this._state) {
            this._apps.map(Lang.bind(this, function(app_id) {
                this.removeInhibit(app_id);
            }));
        }
        else {
            this.addInhibit('user');
        }
    },

    addInhibit: function(app_id) {
        if (this._inhibitor == undefined){
            this._freedesktopProxy.InhibitRemote('handle-lid-switch',
                app_id, "Inhibit by %s".format(IndicatorName), 'block',
                (fileDescriptor) => {

                    if (fileDescriptor) {
                        let inhibitor = new GLib.MainLoop(null, false);
                        this._inhibitor = inhibitor;
                        inhibitor.run();
                        return;
                    }
                    else {
                        logError("Inhibit returned null");
                        return;
                    }
                }
            );
        }
        if (this._last_app == 'user')
            this._settings.set_boolean(USER_ENABLED_KEY, true);
        this._apps.push(this._last_app);
        this._last_app = "";
        if (this._state === false) {
            this._state = true;
            this._icon.gicon = Gio.icon_new_for_string(Me.path + '/icons/' + EnabledIcon +'.svg');;
            if (this._settings.get_boolean(SHOW_NOTIFICATIONS_KEY) && !this.inFullscreen)
                Main.notify(_("Suspend at lid close disabled"));
        }
    },

    removeInhibit: function(app_id) {
        let index = this._apps.indexOf(app_id);
        if (index != -1) {
            if (this._apps[index] == 'user')
                this._settings.set_boolean(USER_ENABLED_KEY, false);
            // Remove app from list
            this._apps.splice(index, 1);
            if (this._apps.length === 0) {
                this._state = false;
                this._inhibitor.quit();
                this._inhibitor.unref();
                this._inhibitor = undefined;
                this._icon.gicon = Gio.icon_new_for_string(Me.path + '/icons/' + DisabledIcon +'.svg');;
                if(this._settings.get_boolean(SHOW_NOTIFICATIONS_KEY))
                    Main.notify(_("Suspend at lid close enabled"));
            }
        }
    },


    _mayInhibit: function(display, window, noRecurse) {
        let app = this._windowTracker.get_window_app(window);
        if (!app) {
            if (!noRecurse) {
                // window is not tracked yet
                Mainloop.idle_add(Lang.bind(this, function() {
                    this._mayInhibit(display, window, true);
                    return false;
                }));
            }
            return;
        }
        let app_id = app.get_id();
        let apps = this._settings.get_strv(INHIBIT_APPS_KEY);
        if (apps.indexOf(app_id) != -1)
            this.addInhibit(app_id);
    },

    _mayUninhibit: function(shellwm, actor) {
        let window = actor.meta_window;
        let app = this._windowTracker.get_window_app(window);
        if (app) {
            let app_id = app.get_id();
            if (this._apps.indexOf(app_id) != -1)
                this.removeInhibit(app_id);
        }
    },

    destroy: function() {
        // remove all inhibitors
        this._apps.map(Lang.bind(this, function(app_id) {
            this.removeInhibit(app_id);
        }));
        // disconnect from signals

        if (this._windowCreatedId) {
            this._display.disconnect(this._windowCreatedId);
            this._windowCreatedId = 0;
        }
        if (this._windowDestroyedId) {
            global.window_manager.disconnect(this._windowDestroyedId);
            this._windowDestroyedId = 0;
        }
        this.parent();
    }
});

function init(extensionMeta) {
    Convenience.initTranslations();
    let theme = imports.gi.Gtk.IconTheme.get_default();
    theme.append_search_path(extensionMeta.path + "/icons");
}

function enable() {
    LidsleepIndicator = new Lidsleep();
    Main.panel.addToStatusArea(IndicatorName, LidsleepIndicator);
}

function disable() {
    LidsleepIndicator.destroy();
    LidsleepIndicator = null;
}
