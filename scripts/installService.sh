#!/bin/bash

DIR="$(dirname "$0")"

sudo cp $DIR/alarmClock.service /etc/systemd/system/alarmClock.service
sudo cp $DIR/wifi_reconnect.service /etc/systemd/system/wifi_reconnect.service
sudo systemctl enable alarmClock.service
sudo systemctl start alarmClock.service
sudo systemctl enable wifi_reconnect.service
sudo systemctl start wifi_reconnect.service

sudo systemctl daemon-reload
