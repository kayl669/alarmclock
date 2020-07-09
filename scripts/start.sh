#!/bin/bash

SCRIPT="$(realpath $0)"
DIR="$(dirname $SCRIPT)"

xset s noblank
xset s off
xset -dpms
setxkbmap -option terminate:ctrl_alt_bksp

sed -i 's/"exited_cleanly":false/"exited_cleanly":true/' /home/pi/.config/chromium/Default/Preferences
sed -i 's/"exit_type":"Crashed"/"exit_type":"Normal"/' /home/pi/.config/chromium/Default/Preferences

unclutter -root &
startx /usr/bin/chromium-browser --disable-popup-blocking  \
                                   --autoplay-policy  \
                                   --disable-features=AutoplayIgnoreWebAudio  \
                                   --no-user-gesture-required  \
                                   --autoplay-policy=no-user-gesture-required  \
                                   --check-for-update-interval=31536000  \
                                   --window-position=-10,-20  \
                                   --window-size=740,520  \
                                   --no-borders  \
                                   --noerrdialogs  \
                                   --kiosk  \
                                   --disable-session-crashed-bubble  \
                                   --disable-infobars  \
                                   --disable-gpu  \
                                   --enable-logging http://`hostname`:4000
