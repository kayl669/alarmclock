'use strict';

const debug = require('debug')('alarm:clock');

import moment from 'moment'
import Schedule from 'node-schedule'

export default class {
    player;
    targetVolume;
    volumeIncreaseSteps = 10;
    volumeIncreaseDuration;
    increaseVolume;
    currentVolume;
    activate;
    playing = false;

    alarmTime;
    alarmDayOfWeek;
    snoozeAfter;
    type;
    playlist;
    stationuuid;

    alarmJob;
    volumeJob;
    alarmEndJob;
    snoozeEndJob;

    constructor(player) {
        this.player = player;
    }

    start() {
        debug('Starting clock');

        this.cancelAlarmJob();
        this.cancelVolumeJob();
        this.cancelSnoozeEndJob();
        this.cancelAlarmEndJob();

        if (this.activate) {
            debug('Activate clock');
            if (this.alarmDayOfWeek.length > 0) {
                debug(' with days ', this.alarmDayOfWeek)
                this.alarmJob = Schedule.scheduleJob({
                    dayOfWeek: this.alarmDayOfWeek,
                    hour:      this.alarmTime.hour(),
                    minute:    this.alarmTime.minute(),
                }, this.onAlarmStart.bind(this))
            }
            else {
                this.alarmJob = Schedule.scheduleJob({
                    hour:   this.alarmTime.hour(),
                    minute: this.alarmTime.minute(),
                }, this.onAlarmStart.bind(this))
            }
        }
    }

    cancelAlarmJob() {
        if (this.alarmJob !== undefined) {
            this.alarmJob.cancel()
        }
    }

    cancelVolumeJob() {
        if (this.volumeJob !== undefined) {
            this.volumeJob.cancel()
        }
    }

    cancelAlarmEndJob() {
        if (this.alarmEndJob !== undefined) {
            this.alarmEndJob.cancel()
        }
    }

    cancelSnoozeEndJob() {
        if (this.snoozeEndJob !== undefined) {
            this.snoozeEndJob.cancel()
        }
    }

    scheduleVolumeIncreaseJob() {
        this.cancelVolumeJob();

        this.increaseVolume = Math.ceil(this.targetVolume / this.volumeIncreaseDuration / this.volumeIncreaseSteps);

        const seconds = Math.ceil(60 / this.volumeIncreaseSteps);

        debug('Scheduling volume increase job to run every %i seconds', seconds);

        this.volumeJob = Schedule.scheduleJob('*/' + seconds + ' * * * * *', this.onAlarmVolumeIncrease.bind(this))
    }

    scheduleAlarmEndJob() {
        this.cancelAlarmEndJob();

        const endTime = moment(this.alarmTime);

        endTime.add(this.snoozeAfter, 'minutes');

        debug('Scheduling alarm end job at %s:%s', endTime.hour(), endTime.minute());

        this.alarmEndJob = Schedule.scheduleJob({
            hour:   endTime.hour(),
            minute: endTime.minute()
        }, this.onAlarmEnd.bind(this))
    }

    scheduleSnoozeEndJob() {
        this.cancelSnoozeEndJob();

        const endTime = moment();

        endTime.add(1, 'minutes');

        debug('Scheduling alarm end job at %s:%s', endTime.hour(), endTime.minute());

        this.snoozeEndJob = Schedule.scheduleJob({
            hour:   endTime.hour(),
            minute: endTime.minute()
        }, this.onSnoozeEnd.bind(this))
        return endTime;
    }

    onAlarmStart() {
        (async () => {
            try {
                debug('Alarm started! It is now %s.', moment().format('dddd, MMMM Do YYYY, HH:mm'));

                this.playing = true;
                this.currentVolume = 0;
                debug('Players connected ',this.player.hasPlayerConnected());

                if (this.player.hasPlayerConnected()) {
                    this.player.setVolume(this.currentVolume);
                    if (this.type === 'Playlist') {
                        this.player.startPlay(this.playlist);
                    }
                    else {
                        this.player.startRadio(this.stationuuid);
                    }
                }

                this.scheduleVolumeIncreaseJob();
                this.scheduleAlarmEndJob()
            }
            catch (error) {
                console.error(error);

                process.exit()
            }
        })()
    }

    onAlarmVolumeIncrease() {
        this.currentVolume = Math.ceil(this.currentVolume + this.increaseVolume);
        this.player.setVolume(this.currentVolume);

        debug('Increased volume by %i%', this.increaseVolume);

        if (this.currentVolume < this.targetVolume) {
            return
        }

        debug('Reached target volume (%i). Halting volume increase.', this.targetVolume);

        this.cancelVolumeJob();

        this.currentVolume = this.targetVolume;
        this.player.setVolume(this.currentVolume);
    }

    onAlarmEnd() {
        debug('Alarm reached its end time. It is now %s.', moment().format('dddd, MMMM Do YYYY, HH:mm'));

        this.cancelVolumeJob();
        this.cancelSnoozeEndJob();
        this.cancelAlarmEndJob();

        this.playing = false;

        if (this.player.hasPlayerConnected()) {
            this.player.stop();
        }
    }

    onSnoozeEnd() {
        debug('Snooze reached its end time. It is now %s.', moment().format('dddd, MMMM Do YYYY, HH:mm'));
        this.cancelSnoozeEndJob();
        if (this.player.hasPlayerConnected()) {
            this.player.play();
        }
    }

    setActivate(activate) {
        this.activate = activate
    }

    setAlarmDayOfWeek(dayOfWeek) {
        debug('Setting an alarm for %s', dayOfWeek);

        this.alarmDayOfWeek = dayOfWeek
    }

    setAlarmTime(hour, minute) {
        debug('Setting an alarm for %i:%i', hour, minute);

        this.alarmTime = moment({
            hour:   hour,
            minute: minute
        })
    }

    setVolumeIncreaseDuration(minutes) {
        debug('Setting volume increase duration to %i minutes', minutes);

        this.volumeIncreaseDuration = minutes
    }

    setTargetVolume(volume) {
        debug('Setting target volume to %i%', volume);

        this.targetVolume = volume
    }

    setSnoozeAfter(minutes) {
        debug('Setting snooze duration to %i minutes', minutes);

        this.snoozeAfter = minutes
    }

    setType(type) {
        debug('Setting type %s', type);

        this.type = type
    }

    setPlaylist(playlist) {
        debug('Setting playlist %i', playlist);

        this.playlist = playlist
    }

    setStationuuid(stationuuid) {
        debug('Setting stationuuid %s', stationuuid);

        this.stationuuid = stationuuid
    }

    snoozeAlarm() {
        debug('Snoozing');
        if (this.playing) {
            debug('Snooze ');
            if (this.player.hasPlayerConnected()) {
                this.player.stop();
            }
            return this.scheduleSnoozeEndJob();
        }
    }

    testAlarm() {
        debug('testAlarm');
        this.onAlarmStart();
    }

    stopAlarm() {
        debug('stopAlarm', this.playing);
        if (this.playing) {
            this.onAlarmEnd();
        }
    }
}
