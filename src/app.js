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

        clock.setAlarmTime(config.get('alarm.hour'), config.get('alarm.minute'));
        clock.setVolumeIncreaseDuration(config.get('alarm.volumeIncreaseDuration'));
        clock.setTargetVolume(config.get('volume'));
        clock.setSnoozeAfter(config.get('alarm.snoozeAfter'));

        const express = require('express');
        const app = express();
        const port = 3000;
        const fs = require('fs');

        app.use(express.static('public'));
        app.listen(port, () => console.log(`Example app listening on port ${port}!`));
        app.post('/alarm', function(req, res) {
            let data = JSON.stringify(req.body);
            fs.writeFileSync('config/default.json', data);
            res.send('Got a POST request');
        });
        app.get('/alarm', function(req, res) {
            let data = fs.readFileSync('config/default.json');
            res.json(JSON.parse(data));
        });

        clock.start();
    }
    catch (error) {
        console.error(error);

        process.exit()
    }
})();
