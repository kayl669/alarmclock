#!/bin/bash

DIR="$(dirname "$0")"

sudo cp $DIR/websocketserver.service /etc/systemd/system/websocketserver.service
sudo systemctl enable websocketserver.service
sudo systemctl start websocketserver.service

sudo cp $DIR/alarmClock.service /etc/systemd/system/alarmClock.service
sudo systemctl enable alarmClock.service
sudo systemctl start alarmClock.service
