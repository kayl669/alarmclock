#!/bin/bash

prompt() {
  read -r -p "$1 [y/N] " response </dev/tty
  if [[ $response =~ ^(yes|y|Y)$ ]]; then
    true
  else
    false
  fi
}

sudo apt-get update -y
sudo apt-get upgrade -y

sudo apt-get install -y curl libts0 bc fbi git evtest libts-bin device-tree-compiler

#Install VNC
sudo raspi-config nonint do_vnc 0
# Activate SPI
sudo raspi-config nonint do_spi 0
#Activate I2C
sudo raspi-config nonint do_i2c 0
#Boot console
sudo raspi-config nonint do_boot_behaviour B2

curl -sL https://deb.nodesource.com/setup_12.x | sudo -E bash -
sudo apt-get install --no-install-recommends screen x11-xserver-utils xinit xserver-xorg-legacy xserver-xorg-video-fbdev xserver-xorg-input-evdev matchbox nodm nodejs chromium-browser unclutter -y

curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | sudo apt-key add -
echo "deb https://dl.yarnpkg.com/debian/ stable main" | sudo tee /etc/apt/sources.list.d/yarn.list
sudo apt-get update
sudo apt-get install yarn -y

yarn --version

rm -f /etc/modprobe.d/fbtft.conf
sudo sed -i 's/spi-bcm2835//g' /etc/modules
sudo sed -i 's/flexfb//g' /etc/modules
sudo sed -i 's/fbtft_device//g' /etc/modules

echo "Updating SysFS rules for Touchscreen..."
sudo bash -c 'cat >/etc/udev/rules.d/95-touchmouse.rules <<EOF
SUBSYSTEM=="input", ATTRS{name}=="touchmouse", ENV{DEVNAME}=="*event*", SYMLINK+="input/touchscreen"
EOF'
sudo bash -c 'cat >/etc/udev/rules.d/95-ftcaptouch.rules <<EOF
SUBSYSTEM=="input", ATTRS{name}=="EP0110M09", ENV{DEVNAME}=="*event*", SYMLINK+="input/touchscreen"
SUBSYSTEM=="input", ATTRS{name}=="generic ft5x06*", ENV{DEVNAME}=="*event*", SYMLINK+="input/touchscreen"
EOF'
sudo bash -c 'cat >/etc/udev/rules.d/95-stmpe.rules <<EOF
SUBSYSTEM=="input", ATTRS{name}=="*stmpe*", ENV{DEVNAME}=="*event*", SYMLINK+="input/touchscreen"
EOF'

echo "Updating TSLib default calibration..."
sudo bash -c 'echo "3 -8466 32440206 5703 -1 -1308696 65536" >/etc/pointercal'

echo "Updating console to PiTFT..."
echo "Set up main console turn on"
if ! grep -q 'fbcon=map:10 fbcon=font:VGA8x8' /boot/cmdline.txt; then
  echo "Updating /boot/cmdline.txt"
  sudo sed -i 's/rootwait/rootwait fbcon=map:10 fbcon=font:VGA8x8/g' "/boot/cmdline.txt"
else
  echo "/boot/cmdline.txt already updated"
fi

sudo bash -c 'cat >> /etc/default/console-setup <<EOF
ACTIVE_CONSOLES="/dev/tty[1-6]"

CHARMAP="UTF-8"

CODESET="guess"
FONTFACE="Terminus"
FONTSIZE="6x12"

VIDEOMODE=
EOF'

sudo bash -c 'cat >/usr/share/X11/xorg.conf.d/10-evdev.conf <<EOF
Section "InputClass"
        Identifier "evdev pointer catchall"
        MatchIsPointer "on"
        MatchDevicePath "/dev/input/event*"
        Driver "evdev"
EndSection

Section "InputClass"
        Identifier "evdev keyboard catchall"
        MatchIsKeyboard "on"
        MatchDevicePath "/dev/input/event*"
        Driver "evdev"
EndSection

Section "InputClass"
        Identifier "evdev touchpad catchall"
        MatchIsTouchpad "on"
        MatchDevicePath "/dev/input/event*"
        Driver "evdev"
EndSection

Section "InputClass"
        Identifier "evdev tablet catchall"
        MatchIsTablet "on"
        MatchDevicePath "/dev/input/event*"
        Driver "evdev"
EndSection

Section "InputClass"
        Identifier "evdev touchscreen catchall"
        MatchIsTouchscreen "on"
        MatchDevicePath "/dev/input/event*"
        Driver "evdev"
        Option "TransformationMatrix" "0 -1 1 1 0 0 0 0 1"
EndSection
EOF'

if [ -e /usr/share/X11/xorg.conf.d/99-pitft.conf ]; then
  echo "PiTFT already active"
else
  echo "Configuring PiTFT"
  sudo bash -c 'cat >> /usr/share/X11/xorg.conf.d/99-pitft.conf <<EOF

Section "Device"
  Identifier "Adafruit PiTFT"
  Driver "fbdev"
  Option "fbdev" "/dev/fb1"
EndSection
EOF'
fi

if [ -e /etc/default/nodm ]; then
  echo "Nodm already configure"
else
  echo "Configuring nodm"
  sudo bash -c 'cat >> /etc/default/nodm <<EOF
NODM_ENABLED=true
NODM_USER=pi
EOF'
fi

if [ -e /home/pi/.xsession ]; then
  echo "Xsession already configure"
else
  echo "Configuring Xsession"
  cat >>/home/pi/.xsession <<EOF
#!/bin/bash

# disable the DPMS (Energy Star) features
xset -dpms

# disable the screen saver
xset s off

# hide the mouse cursor when not moving
unclutter -idle 0 -root &

# Run the window manager !
matchbox-window-manager -use_titlebar no &

sed -i 's/"exited_cleanly":false/"exited_cleanly":true/' /home/pi/.config/chromium/Default/Preferences
sed -i 's/"exit_type":"Crashed"/"exit_type":"Normal"/' /home/pi/.config/chromium/Default/Preferences

/usr/bin/chromium-browser --disable-popup-blocking  \\
                           --autoplay-policy  \\
                           --disable-features=AutoplayIgnoreWebAudio  \\
                           --no-user-gesture-required  \\
                           --autoplay-policy=no-user-gesture-required  \\
                           --check-for-update-interval=31536000  \\
                           --window-position=-50,-20  \\
                           --window-size=740,520  \\
                           --force-device-scale-factor=0.70 \\
                           --no-borders  \\
                           --noerrdialogs  \\
                           --kiosk  \\
                           --disable-session-crashed-bubble  \\
                           --disable-infobars  \\
                           --disable-gpu  \\
                           --enable-logging http://$(hostname):4000
EOF
  chmod 700 /home/pi/.xsession
fi

if ! grep -q 'consoleblank=0' /boot/cmdline.txt; then
  echo "Updating /boot/cmdline.txt"
  sudo sed -i 's/rootwait/rootwait consoleblank=0/g' "/boot/cmdline.txt"
else
  echo "/boot/cmdline.txt already updated"
fi

if [ -e /boot/config.txt ] && grep -q "^gpio=12,13,16,26=pu$" /boot/config.txt; then
  echo "GPIO already active"
else
  sudo bash -c 'cat >> /boot/config.txt <<EOF

# --- added alarmClock $date ---
dtparam=spi=on
dtparam=i2c1=on
dtparam=i2c_arm=on
dtoverlay=pitft35-resistive,rotate=270,speed=20000000,fps=20
gpio=12,13,16,26=pu
# --- end alarmClock $date ---
EOF'
fi

if [ -e /home/pi/.bashrc ] && grep -q "^export NCURSES_NO_UTF8_ACS=1$" /home/pi/.bashrc; then
  echo "Bashrc override done"
else
  cat >>/home/pi/.bashrc <<EOF

export NCURSES_NO_UTF8_ACS=1

if [[ -z \$DISPLAY && \$XDG_VTNR -eq 1 ]]; then
  startx
fi
EOF
fi

if prompt "Would you like to install WM8960?"; then
  git clone https://github.com/waveshare/WM8960-Audio-HAT
  cd WM8960-Audio-HAT
  sudo ./install.sh
  cd ..
fi

if prompt "Would you like to install Adafruit speaker bonnet?"; then
  curl -sS https://raw.githubusercontent.com/adafruit/Raspberry-Pi-Installer-Scripts/master/i2samp.sh | bash
fi

if prompt "Would you like to install alarmClock?"; then
  git clone https://github.com/kayl669/alarmclock.git -b develop
  cd alarmclock
  yarn install
  yarn run build
  ./scripts/installService.sh
fi

if prompt "Would you like to reboot now?"; then
  sync && sudo reboot
fi
