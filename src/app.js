'use strict';

const debug = require('debug')('alarm:app');

debug('Spinning up alarm clock');

import Config from './Config'
import Clock from './Clock'
import WebServer from './WebServer';
import Player from './Player';

(async () => {
    console.log('Starting');

    try {
        const config = await Config.create('default.json');
        const webServer = await WebServer.create(config);
        const player = await Player.create(config, webServer.getServer());

        const clock = await new Clock(player);
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
