'use strict';

const debug = require('debug')('alarm:webserver');
const Wifi = require('rpi-wifi-connection');
import Axios from 'axios'

export default class {
    mainConfig;
    clock;
    app;
    server;

    refresh_token;
    access_token;

    constructor(mainConfig) {
        this.mainConfig = mainConfig;
    }

    async load() {
        debug('starting');
        var os = require("os");

        this.app = require('express')();
        this.server = require('http').createServer(this.app).listen(4000);
        const path = require('path');
        const serveStatic = require('serve-static');
        const nocache = require('nocache');

        this.app.use(nocache());
        this.app.use(require('cors')({
            origin: true
        }));
        this.app.set('view engine', 'html');
        this.app.engine('html', require('hbs').__express);
        this.app.use(require('nocache')());
        var bodyParser = require('body-parser');
        this.app.use(bodyParser.json()); // support json encoded bodies
        this.app.use(bodyParser.urlencoded({extended: true})); // support encoded bodies

        this.refresh_token = this.mainConfig.get('refresh_token');
        if (this.refresh_token !== undefined) {
            this.refreshToken(5);
        }

        this.app.use(serveStatic(path.join(process.cwd(), 'node_modules/clockOS-ui')));
        debug('started');

        this.app.post('/alarm', function(req, res) {
            let alarm = req.body;
            debug(req.body);

            this.mainConfig.set('alarm.activate', alarm.activate);
            this.mainConfig.set('alarm.dayOfWeek', alarm.dayOfWeek);
            this.mainConfig.set('alarm.hour', alarm.hour);
            this.mainConfig.set('alarm.minute', alarm.minute);
            this.mainConfig.set('alarm.volumeIncreaseDuration', alarm.volumeIncreaseDuration);
            this.mainConfig.set('volume', alarm.volume);
            this.mainConfig.set('alarm.snoozeAfter', alarm.snoozeAfter);
            this.mainConfig.set('alarm.type', alarm.type);
            this.mainConfig.set('alarm.playlist', alarm.playlist);
            this.mainConfig.set('alarm.stationuuid', alarm.stationuuid);
            this.mainConfig.save();
            this.clock.setActivate(alarm.activate);
            this.clock.setAlarmDayOfWeek(alarm.dayOfWeek);
            this.clock.setAlarmTime(alarm.hour, alarm.minute);
            this.clock.setVolumeIncreaseDuration(alarm.volumeIncreaseDuration);
            this.clock.setTargetVolume(alarm.volume);
            this.clock.setSnoozeAfter(alarm.snoozeAfter);
            this.clock.setType(alarm.type);
            this.clock.setPlaylist(alarm.playlist);
            this.clock.setStationuuid(alarm.stationuuid);
            this.clock.start();
            res.json('OK');
        }.bind(this));
        this.app.get('/alarm', function(req, res) {
            let data = {
                'activate':               this.mainConfig.get('alarm.activate'),
                'dayOfWeek':              this.mainConfig.get('alarm.dayOfWeek'),
                'hour':                   this.mainConfig.get('alarm.hour'),
                'minute':                 this.mainConfig.get('alarm.minute'),
                'volumeIncreaseDuration': this.mainConfig.get('alarm.volumeIncreaseDuration'),
                'volume':                 this.mainConfig.get('volume'),
                'snoozeAfter':            this.mainConfig.get('alarm.snoozeAfter'),
                'type':                   this.mainConfig.get('alarm.type'),
                'playlist':               this.mainConfig.get('alarm.playlist'),
                'stationuuid':            this.mainConfig.get('alarm.stationuuid')
            };

            res.json(data);
        }.bind(this));

        this.app.post('/city', function(req, res) {
            let city = req.body.city;
            debug(req.body.city);

            this.mainConfig.set('city', city);
            this.mainConfig.save();
            res.json('OK');
        }.bind(this));
        this.app.get('/city', function(req, res) {
            let data = {
                'city': this.mainConfig.get('city'),
            };

            res.json(data);
        }.bind(this));
        this.app.get('/channel.html', function(req, res) {
            if (req.query.code === undefined) {
                return res.redirect(
                    'https://connect.deezer.com/oauth/auth.php?app_id=' + this.mainConfig.get('deezerAppId') + '&perms=basic_access,offline_access,email&redirect_uri=http://'
                    + os.hostname().toLowerCase() + ':4000/channel.html', 302);
            }
            else {
                Axios.get('https://connect.deezer.com/oauth/access_token.php?app_id=' + this.mainConfig.get('deezerAppId') + '&secret=' + this.mainConfig.get(
                    'deezerSecret') + '&code=' + req.query.code).then((response => {
                    let url1 = 'https://api.deezer.com/user/me?' + response.data;
                    Axios.get(url1).then((() => {
                        res.render(path.join(__dirname, "node_modules/clockOS-ui/channel.html"));
                    }).bind(this));
                }).bind(this));
            }
        }.bind(this));
        this.app.get('/wifiScan', function(req, res) {
            var wifi = new Wifi();
            wifi.scan().then((ssids) => {
                res.json(ssids);
            }).catch((error) => {
                debug(error);
            });
        }.bind(this));
        this.app.get('/wifiState', function(req, res) {
            var wifi = new Wifi();
            wifi.getState().then((ssids) => {
                res.json(ssids);
            }).catch((error) => {
                debug(error);
            });
        }.bind(this));
        this.app.get('/wifiStatus', function(req, res) {
            var wifi = new Wifi();
            wifi.getStatus().then((ssids) => {
                res.json(ssids);
            }).catch((error) => {
                debug(error);
            });
        }.bind(this));
        this.app.get('/wifiNetworks', function(req, res) {
            var wifi = new Wifi();
            wifi.getNetworks().then((ssids) => {
                res.json(ssids);
            }).catch((error) => {
                debug(error);
            });
        }.bind(this));
        this.app.post('/wifiConnect', function(req, res) {
            var wifi = new Wifi();
            let connection = req.body;
            debug(req.body);
            wifi.connect({
                ssid: connection.ssid,
                psk:  connection.psk
            }).then(() => {
                res.json('OK');
            }).catch(() => {
                res.json('KO');
            });
        });
        this.app.get('/config', function(req, res) {
            let data = {
                'openWeatherAppId': this.mainConfig.get('openWeatherAppId'),
                'deezerAppId':      this.mainConfig.get('deezerAppId')
            };

            res.json(data);
        }.bind(this));
        this.app.get('/stopAlarm', function(req, res) {
            debug('stopAlarm');
            this.clock.stopAlarm();
            res.json(new Date());
        }.bind(this));
        this.app.get('/snoozeAlarm', function(req, res) {
            debug('snoozeAlarm');
            let snoozeAlarmDate = this.clock.snoozeAlarm();
            res.json(snoozeAlarmDate);
        }.bind(this));
        this.app.get('/testAlarm', function(req, res) {
            this.clock.testAlarm();
            res.json(new Date());
        }.bind(this));
        this.app.get('/alarmPlaying', function(req, res) {
            res.json(this.clock.playing);
        }.bind(this));
        this.app.get('/auth', function(req, res) {
            let params = {
                'client_id':              this.mainConfig.get('clientId'),
                'scope':                  'email openid https://www.googleapis.com/auth/youtube.readonly',
                'access_type':            'offline',
                'include_granted_scopes': 'true',
            };
            Axios.post('https://oauth2.googleapis.com/device/code', params).then((response => {
                let deviceCode = response.data.device_code;
                let interval = response.data.interval;
                res.render("auth.html", {
                    user_code:        response.data.user_code,
                    verification_url: response.data.verification_url
                });
                this.getToken(deviceCode, interval, 60);
            }).bind(this));
        }.bind(this));
        this.app.get('/accessToken', function(req, res) {
            res.json(this.access_token);
        }.bind(this));

    }

    getToken(deviceCode, interval, retryCount) {
        let params = {
            'client_id':     this.mainConfig.get('clientId'),
            'client_secret': this.mainConfig.get('client_secret'),
            'device_code':   deviceCode,
            'grant_type':    'urn:ietf:params:oauth:grant-type:device_code'
        };
        Axios.post('https://oauth2.googleapis.com/token', params).then((response => {
            debug('refresh_token', response.data.refresh_token);
            this.mainConfig.set('refresh_token', response.data.refresh_token);
            this.mainConfig.save();
            this.refreshToken(5);
        }), ((reason) => {
            let status = reason.response.status;
            if (status === 428 && retryCount > 0) {
                debug(reason.response.statusText, retryCount);
                setTimeout((() => {
                    this.getToken(deviceCode, interval, retryCount - 1);
                }).bind(this), 1000 * interval);
            }
        }));
    }

    refreshToken(retryCount) {
        let params = {
            'client_id':     this.mainConfig.get('clientId'),
            'client_secret': this.mainConfig.get('client_secret'),
            'refresh_token': this.mainConfig.get('refresh_token'),
            'grant_type':    'refresh_token'
        };
        Axios.post('https://oauth2.googleapis.com/token', params).then((response => {
            debug("access_token", response.data.access_token);
            this.access_token = response.data.access_token;
            setTimeout((() => {
                this.refreshToken(5);
            }).bind(this), 600000);
        }), ((reason) => {
            if (retryCount > 0) {
                debug(reason.response.statusText, retryCount);
                setTimeout((() => {
                    this.refreshToken(retryCount - 1);
                }).bind(this), 10000);
            }
            else {
                this.refresh_token = "";
                this.access_token = "";
            }
        }));
    }

    getServer() {
        return this.server;
    }

    setClock(value) {
        this.clock = value;
    }

    static async create(mainConfig) {
        const instance = new this(mainConfig);

        debug('Creating new web server');

        await instance.load();

        return instance
    }
}
