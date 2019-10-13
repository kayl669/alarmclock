'use strict';

const debug = require('debug')('alarm:app');

debug('Spinning up alarm clock');

import Config from './Config'
import Volume from './Volume'
import Player from './Player'
import Clock from './Clock'

(async () => {
    console.log('Starting');

    try {
        const config = await Config.create('default.json');
        const mixer = new Volume(config.get('volume'));
        const player = await Player.create(config.get('tracks'));

        player.setRepeat(true);

        const clock = new Clock(player, mixer);

        clock.setActivate(config.get('alarm.activate'));
        clock.setAlarmTime(config.get('alarm.hour'), config.get('alarm.minute'));
        clock.setVolumeIncreaseDuration(config.get('alarm.volumeIncreaseDuration'));
        clock.setTargetVolume(config.get('volume'));
        clock.setSnoozeAfter(config.get('alarm.snoozeAfter'));

        const express = require('express');
        const app = express();
        const port = 3000;
        const fs = require('fs');

        app.use(express.static('public'));
        var bodyParser = require('body-parser');
        app.use(bodyParser.json()); // support json encoded bodies
        app.use(bodyParser.urlencoded({extended: true})); // support encoded bodies
        app.use(function(request, response, next) {
            response.header("Access-Control-Allow-Origin", "*");
            response.header("Access-Control-Allow-Methods", "GET, POST, DELETE, PUT");
            response.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
            next();
        });

        app.listen(port, () => console.log(`Example app listening on port ${port}!`));
        app.post('/alarm', function(req, res) {
            let alarm = req.body;
            console.log(req.body);

            config.set('alarm.activate', alarm.activate);
            config.set('alarm.hour', alarm.hour);
            config.set('alarm.minute', alarm.minute);
            config.set('alarm.volumeIncreaseDuration', alarm.volumeIncreaseDuration);
            config.set('volume', alarm.volume);
            config.set('alarm.snoozeAfter', alarm.snoozeAfter);
            clock.setActivate(alarm.activate);
            clock.setAlarmTime(alarm.hour, alarm.minute);
            clock.setVolumeIncreaseDuration(alarm.volumeIncreaseDuration);
            clock.setTargetVolume(alarm.volume);
            clock.setSnoozeAfter(alarm.snoozeAfter);
            clock.start();
            res.sendStatus(200);
        });
        app.get('/alarm', function(req, res) {
            let data = {
                'activate':               config.get('alarm.activate'),
                'hour':                   config.get('alarm.hour'),
                'minute':                 config.get('alarm.minute'),
                'volumeIncreaseDuration': config.get('alarm.volumeIncreaseDuration'),
                'volume':                 config.get('volume'),
                'snoozeAfter':            config.get('alarm.snoozeAfter'),
            };

            res.json(data);
        });
        app.get('/stopAlarm', function(req, res) {
            clock.stopAlarm();
            res.sendStatus(200);
        });
        app.get('/snoozeAlarm', function(req, res) {
            clock.snoozeAlarm();
            res.sendStatus(200);
        });

        clock.start();
    }
    catch (error) {
        console.error(error);

        process.exit()
    }
})();
