'use strict';

const debug = require('debug')('alarm:webserver');
const Wifi = require('rpi-wifi-connection');
import Axios from 'axios'

export default class {
    mainConfig;
    clock;
    app;
    server;

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

        this.app.use(require('cors')({
            origin: true
        }));
        this.app.set('view engine', 'html');
        this.app.engine('html', require('hbs').__express);

        var bodyParser = require('body-parser');
        this.app.use(bodyParser.json()); // support json encoded bodies
        this.app.use(bodyParser.urlencoded({extended: true})); // support encoded bodies
        this.app.use(function(request, response, next) {
            if (request.headers.origin) {
                response.header('Access-Control-Allow-Origin', request.headers.origin);
            }
            else {
                response.header('Access-Control-Allow-Origin', '*');
            }
            response.setHeader("Access-Control-Allow-Credentials", "true");
            response.setHeader('Access-Control-Allow-Methods', `GET, POST, DELETE, PUT`);
            response.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
            let cache_expire = 60 * 60 * 24 * 365;
            response.setHeader('Pragma', 'public');
            response.setHeader('Cache-Control', 'maxage=' + cache_expire);
            response.setHeader('Expires', require('moment')().add(1, 'y').format("ddd, DD MMM YYYY HH:mm:ss G\\MT"));
            next();
        });

        this.app.set('views', path.join(process.cwd(), '../Deezer-Server/views'));
        this.app.use('/remote', serveStatic(path.join(process.cwd(), '../Deezer-Server/public')));
        this.app.get('/remote', function(req, res) {
            res.render('index', {title: "Home"});
        });

        this.app.use(serveStatic(path.join(process.cwd(), '../clockOS-ui/dist')));
        debug('started');

        this.app.post('/alarm', function(req, res) {
            let alarm = req.body;
            console.log(req.body);

            this.mainConfig.set('alarm.activate', alarm.activate);
            this.mainConfig.set('alarm.hour', alarm.hour);
            this.mainConfig.set('alarm.minute', alarm.minute);
            this.mainConfig.set('alarm.volumeIncreaseDuration', alarm.volumeIncreaseDuration);
            this.mainConfig.set('volume', alarm.volume);
            this.mainConfig.set('alarm.snoozeAfter', alarm.snoozeAfter);
            this.mainConfig.save();
            this.clock.setActivate(alarm.activate);
            this.clock.setAlarmTime(alarm.hour, alarm.minute);
            this.clock.setVolumeIncreaseDuration(alarm.volumeIncreaseDuration);
            this.clock.setTargetVolume(alarm.volume);
            this.clock.setSnoozeAfter(alarm.snoozeAfter);
            this.clock.start();
            res.sendStatus(200);
        }.bind(this));
        this.app.get('/alarm', function(req, res) {
            let data = {
                'activate':               this.mainConfig.get('alarm.activate'),
                'hour':                   this.mainConfig.get('alarm.hour'),
                'minute':                 this.mainConfig.get('alarm.minute'),
                'volumeIncreaseDuration': this.mainConfig.get('alarm.volumeIncreaseDuration'),
                'volume':                 this.mainConfig.get('volume'),
                'snoozeAfter':            this.mainConfig.get('alarm.snoozeAfter'),
            };

            res.json(data);
        }.bind(this));

        this.app.post('/city', function(req, res) {
            let city = req.body.city;
            console.log(req.body.city);

            this.mainConfig.set('city', city);
            this.mainConfig.save();
            res.sendStatus(200);
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
                    'https://connect.deezer.com/oauth/auth.php?app_id=' + this.mainConfig.get('deezerAppId') + '&perms=basic_access,email&redirect_uri=http://'
                    + os.hostname().toLowerCase() + ':4000/channel.html', 302);
            }
            else {
                Axios.get('https://connect.deezer.com/oauth/access_token.php?app_id=' + this.mainConfig.get('deezerAppId') + '&secret=' + this.mainConfig.get(
                    'deezerSecret') + '&code=' + req.query.code).then((response => {
                    let url1 = 'https://api.deezer.com/user/me?' + response.data;
                    Axios.get(url1).then((() => {
                        res.render(path.join(__dirname, "../../clockOS-ui/dist/channel.html"));
                    }).bind(this));
                }).bind(this));
            }
        }.bind(this));
        this.app.get('/wifiScan', function(req, res) {
            if (os.platform() === 'linux') {
                var wifi = new Wifi();
                wifi.scan().then((ssids) => {
                    res.json(ssids);
                }).catch((error) => {
                    console.log(error);
                });
            }
            else {
                new Promise((resolve, reject) => {
                    res.json([
                        {
                            bssid:       "18:62:2c:8f:75:8d",
                            signalLevel: 5220,
                            ssid:        "presse-agrume"
                        }, {
                            bssid:       "ff:ff:ff:ff:ff:ff",
                            signalLevel: 20,
                            ssid:        "orange"
                        }
                    ]);
                });
            }
        }.bind(this));
        this.app.get('/wifiState', function(req, res) {
            if (os.platform() === 'linux') {
                var wifi = new Wifi();
                wifi.getState().then((ssids) => {
                    res.json(ssids);
                }).catch((error) => {
                    console.log(error);
                });
            }
            else {
                new Promise((resolve, reject) => {
                    res.json(true);
                });
            }
        }.bind(this));
        this.app.get('/wifiStatus', function(req, res) {
            if (os.platform() === 'linux') {
                var wifi = new Wifi();
                wifi.getStatus().then((ssids) => {
                    res.json(ssids);
                }).catch((error) => {
                    console.log(error);
                });
            }
            else {
                new Promise((resolve, reject) => {
                    res.json({
                        ssid:       "presse-agrume",
                        ip_address: "192.168.1.45"
                    });
                });
            }
        }.bind(this));
        this.app.get('/wifiNetworks', function(req, res) {
            if (os.platform() === 'linux') {
                var wifi = new Wifi();
                wifi.getNetworks().then((ssids) => {
                    res.json(ssids);
                }).catch((error) => {
                    console.log(error);
                });
            }
            else {
                new Promise((resolve, reject) => {
                    res.json([
                        {
                            id:   0,
                            ssid: "presse-agrume"
                        }
                    ]);
                });
            }
        }.bind(this));
        this.app.post('/wifiConnect', function(req, res) {
            if (os.platform() === 'linux') {
                var wifi = new Wifi();
                let connection = req.body;
                console.log(req.body);
                wifi.connect({
                    ssid: connection.ssid,
                    psk:  connection.psk
                }).then(() => {
                    res.json('OK');
                }).catch((error) => {
                    res.json('KO');
                });
            }
            else {
                new Promise((resolve, reject) => {
                    res.json('OK');
                });
            }
        });
        this.app.get('/config', function(req, res) {
            let data = {
                'openWeatherAppId': this.mainConfig.get('openWeatherAppId'),
                'deezerAppId':      this.mainConfig.get('deezerAppId'),
                'server':           'http://' + os.hostname().toLowerCase() + ':4000',
                'api':              'ws://' + os.hostname().toLowerCase() + ':6123/websocket',
            };

            res.json(data);
        }.bind(this));
        this.app.get('/stopAlarm', function(req, res) {
            this.clock.stopAlarm();
            res.sendStatus(200);
        }.bind(this));
        this.app.get('/snoozeAlarm', function(req, res) {
            this.clock.snoozeAlarm();
            res.sendStatus(200);
        }.bind(this));
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
