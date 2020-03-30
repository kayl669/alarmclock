'use strict';

const debug = require('debug')('alarm:app');

debug('Spinning up alarm clock');

import Config from './Config'
import Volume from './Volume'
import Player from './Player'
import Clock from './Clock'
import WebServer from './WebServer';
import Deezer from './Deezer';

(async () => {
    console.log('Starting');

    try {
        const config = await Config.create('default.json');
        const mixer = new Volume(config.get('volume'));
        const player = await Player.create(config.get('tracks'));
        const webServer = await WebServer.create(config);
        const deezer = await Deezer.create(config, webServer.getServer());

        player.setRepeat(true);

        const clock = await new Clock(player, deezer, mixer);
        webServer.setClock(clock);

        clock.setActivate(config.get('alarm.activate'));
        clock.setAlarmTime(config.get('alarm.hour'), config.get('alarm.minute'));
        clock.setVolumeIncreaseDuration(config.get('alarm.volumeIncreaseDuration'));
        clock.setTargetVolume(config.get('volume'));
        clock.setSnoozeAfter(config.get('alarm.snoozeAfter'));
        clock.setPlaylist(config.get('alarm.playlist'));

        clock.start();
    }
    catch (error) {
        console.error(error);

        process.exit()
    }
})();
