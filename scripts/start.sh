#!/bin/bash

# using local electron module instead of the global electron lets you
# easily control specific version dependency between your app and electron itself.
# the syntax below starts an X istance with ONLY our electronJS fired up,
# it saves you a LOT of resources avoiding full-desktops envs

#rm /tmp/.X0-lock &>/dev/null || true

SCRIPT="$(realpath $0)"
DIR="$(dirname $SCRIPT)"
ELECTRON_DIR="$(realpath $DIR/../node_modules/electron/dist)"

xset s noblank
xset s off
xset -dpms
setxkbmap -option terminate:ctrl_alt_bksp

sed -i 's/"exited_cleanly":false/"exited_cleanly":true/' /home/pi/.config/chromium/Default/Preferences
sed -i 's/"exit_type":"Crashed"/"exit_type":"Normal"/' /home/pi/.config/chromium/Default/Preferences

unclutter -root &

if [ ! -c /dev/fb1 ]; then
  modprobe spi-bcm2708 || true
  modprobe fbtft_device name=pitft verbose=0 rotate=$TFT_ROTATE || true

  sleep 1

  mknod /dev/fb1 c $(cat /sys/class/graphics/fb1/dev | tr ':' ' ') || true
  FRAMEBUFFER=/dev/fb1 startx /usr/bin/chromium-browser  --check-for-update-interval=31536000 --window-position=-10,-20 --window-size=740,520 --no-borders --noerrdialogs --kiosk --disable-session-crashed-bubble --disable-infobars --disable-gpu --enable-logging http://`hostname`:4000
else
  startx /usr/bin/chromium-browser  --check-for-update-interval=31536000 --window-position=-10,-20 --window-size=740,520 --no-borders --noerrdialogs --kiosk --disable-session-crashed-bubble --disable-infobars --disable-gpu --enable-logging http://`hostname`:4000
fi
