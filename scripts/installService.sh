#!/bin/bash

DIR="$(dirname "$0")"

sudo cp $DIR/alarmClock.service /etc/systemd/system/alarmClock.service
sudo systemctl enable alarmClock.service
sudo systemctl start alarmClock.service

sudo systemctl daemon-reload
