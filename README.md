# This extension is maintained by Pablo J Torrubiano!

## gnome-shell-extension-slidsleep
## CAUTION Still an experimental and unstable version. Can freeze gnome-shell
## Doesn't seem to work in wayland

When the moon is full auto suspend at lid close is disable.

This is a modified version of caffeine@patapon.info

This extension supports gnome-shell 3.4 to 3.36:

    * master: 3.36
    * gnome-shell-3.32-3.34: 3.32 -> 3.34
    * gnome-shell-3.10-3.30: 3.10 -> 3.30
    * gnome-shell-before-3.10: 3.4 -> 3.8

![Screenshot](https://github.com/pablotor/gnome-shell-extension-lidsleep/raw/master/screenshot.png)

![Preferences](https://github.com/pablotor/gnome-shell-extension-lidsleep/raw/master/screenshot-prefs.png)

Regular moon = normal auto suspend when lid is closed. Full moon = auto suspend
off when lid is closed.


## Installation from git

    git clone git://github.com/pablotor/gnome-shell-extension-lidsleep.git
    cd gnome-shell-extension-lidsleep
    ./update-locale.sh
    glib-compile-schemas --strict --targetdir=lidsleep@pablotorrubiano.xyz/schemas/ lidsleep@pablotorrubiano.xyz/schemas
    cp -r lidsleep@pablotorrubiano.xyz ~/.local/share/gnome-shell/extensions

Restart the shell and then enable the extension.

Que naides quede enfadau
si aconsejo como siento.
El hombre vale por dentro
que lo de afuera es prestau.
Por plata que haiga juntao
no te sientas cordillera.
Pues en la vida rutera,
aquel que se cree muy grande,
se pone al lado de los andes
y es un enano cualquiera.

~ Atahualpa Yupanqui
