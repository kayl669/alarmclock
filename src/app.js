'use strict';

const debug = require('debug')('alarm:app');

debug('Spinning up alarm clock');

import Config from './Config'
import Volume from './Volume'
import Clock from './Clock'
import WebServer from './WebServer';
import Deezer from './Deezer';

(async () => {
    console.log('Starting');

    try {
        const config = await Config.create('default.json');
        const mixer = new Volume(config.get('volume'));
        const webServer = await WebServer.create(config);
        const deezer = await Deezer.create(config, webServer.getServer());

        const clock = await new Clock(deezer, mixer);
        webServer.setClock(clock);

        clock.setActivate(config.get('alarm.activate'));
        clock.setAlarmDayOfWeek(config.get('alarm.dayOfWeek'));
        clock.setAlarmTime(config.get('alarm.hour'), config.get('alarm.minute'));
        clock.setVolumeIncreaseDuration(config.get('alarm.volumeIncreaseDuration'));
        clock.setTargetVolume(config.get('volume'));
        clock.setSnoozeAfter(config.get('alarm.snoozeAfter'));
        clock.setType(config.get('alarm.type'));
        clock.setPlaylist(config.get('alarm.playlist'));
        clock.setStationuuid(config.get('alarm.stationuuid'));

        clock.start();
    }
    catch (error) {
        console.error(error);

        process.exit()
    }
})();
