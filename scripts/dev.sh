#!/bin/bash

sudo apt-get install curl -y
sudo apt-get install python3 -y
sudo apt-get install python3-pip -y
pip3 install tornado
pip3 install RPi.GPIO

curl -sL https://deb.nodesource.com/setup_12.x | sudo -E bash -
sudo apt-get update
sudo apt-get install nodejs -y

curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | sudo apt-key add -
echo "deb https://dl.yarnpkg.com/debian/ stable main" | sudo tee /etc/apt/sources.list.d/yarn.list
sudo apt-get update
sudo apt-get install yarn -y

yarn --version
