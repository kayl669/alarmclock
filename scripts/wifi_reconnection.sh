#!/bin/bash

while [ true ]; do
  SERVER=1.1.1.1
  ping -c2 ${SERVER} >/dev/null
  if [ $? != 0 ]; then
    sudo ip link set wlan0 down
    sudo ip link set wlan0 up
  fi
  sleep 300
done
