'use strict';

const debug = require('debug')('alarm:webserver');

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
        this.app.get('/config', function(req, res) {
            var os = require("os");
            let data = {
                'openWeatherAppId': this.mainConfig.get('openWeatherAppId'),
                'deezerAppId':      this.mainConfig.get('deezerAppId'),
                'server':           'http://' + os.hostname() + ':4000',
                'api':              'ws://' + os.hostname() + ':6123/websocket',
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
