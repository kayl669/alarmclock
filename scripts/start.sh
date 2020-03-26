#!/bin/bash

# using local electron module instead of the global electron lets you
# easily control specific version dependency between your app and electron itself.
# the syntax below starts an X istance with ONLY our electronJS fired up,
# it saves you a LOT of resources avoiding full-desktops envs

#rm /tmp/.X0-lock &>/dev/null || true

SCRIPT="$(realpath $0)"
DIR="$(dirname $SCRIPT)"
ELECTRON_DIR="$(realpath $DIR/../node_modules/electron/dist)"

if [ ! -c /dev/fb1 ]; then
  modprobe spi-bcm2708 || true
  modprobe fbtft_device name=pitft verbose=0 rotate=$TFT_ROTATE || true

  sleep 1

  mknod /dev/fb1 c $(cat /sys/class/graphics/fb1/dev | tr ':' ' ') || true
  FRAMEBUFFER=/dev/fb1 startx $ELECTRON_DIR/electron $DIR/../main.js --disable-gpu --enable-logging $*
else
  startx $ELECTRON_DIR/electron $DIR/../main.js --disable-gpu --enable-logging $*
fi
