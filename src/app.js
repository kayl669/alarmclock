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
        const server = require('http').createServer(app).listen(4000);
        const io = require('socket.io').listen(server);
        const hbs = require('hbs');
        const cors = require('cors');
        const moment = require('moment');
        const path = require('path');
        const serveStatic = require('serve-static');

        console.log(moment().add(1, 'y').format("ddd, DD MMM YYYY HH:mm:ss G\\MT"));

        app.use(cors({
            origin: true
        }));
        app.set('view engine', 'html');
        app.engine('html', hbs.__express);

        var bodyParser = require('body-parser');
        app.use(bodyParser.json()); // support json encoded bodies
        app.use(bodyParser.urlencoded({extended: true})); // support encoded bodies
        app.use(function(request, response, next) {
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
            response.setHeader('Expires', moment().add(1, 'y').format("ddd, DD MMM YYYY HH:mm:ss G\\MT"));
            next();
        });

        app.set('views', path.join(process.cwd(), '../Deezer-Server/views'));
        app.use('/remote', serveStatic(path.join(process.cwd(), '../Deezer-Server/public')));
        app.get('/remote', function(req, res) {
            res.render('index', {title: "Home"});
        });

        app.use(serveStatic(path.join(process.cwd(), '../clockOS-ui/dist')));

        app.post('/alarm', function(req, res) {
            let alarm = req.body;
            console.log(req.body);

            config.set('alarm.activate', alarm.activate);
            config.set('alarm.hour', alarm.hour);
            config.set('alarm.minute', alarm.minute);
            config.set('alarm.volumeIncreaseDuration', alarm.volumeIncreaseDuration);
            config.set('volume', alarm.volume);
            config.set('alarm.snoozeAfter', alarm.snoozeAfter);
            config.save();
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
        app.post('/city', function(req, res) {
            let city = req.body.city;
            console.log(req.body.city);

            config.set('city', city);
            config.save();
            res.sendStatus(200);
        });
        app.get('/city', function(req, res) {
            let data = {
                'city': config.get('city'),
            };

            res.json(data);
        });
        app.get('/config', function(req, res) {
            var os = require("os");
            let data = {
                'openWeatherAppId': config.get('openWeatherAppId'),
                'deezerAppId':      config.get('deezerAppId'),
                'server':           'http://' + os.hostname() + ':4000',
                'api':              'ws://' + os.hostname() + ':6123/websocket',
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

        //Init
        var allClients = 0,  //number of client
            clientId = 1,  //client_id, will be incremented
            remotes = [], //list of remotes connected
            players = []; //list of players connected

        var volume = parseInt(50), //default to 50%
            musicStatus = "stop", musicPosition = 0, musicMode = "tracks" // "Tracks" or "Radio"
        var queue = [], //Tracks to play
            history = []; //Tracks already played

        /**
         * A new connection
         */
        io.sockets.on('connection', function(client) {
            console.log("New client");
            //The client
            var my_client = {
                "id":     clientId,
                "obj":    client,
                "status": null
            };

            //Upload the stats
            clientId += 1;
            allClients += 1;

            //Debug
            console.log("Client " + my_client.id + " connected.");

            //Return "connected" to the client
            client.emit('connected', //the client id and status
                {
                    clientId: my_client.id,
                    msg:      'Connected'
                }, //The client will identificate himself
                //Player or command ?
                function(status) {
                    if (status == 'player') {
                        client.join("players"); //Join the room of the players
                        my_client.status = "player";
                        players.push(my_client.id); //Update the list
                    }
                    else {
                        my_client.status = "remote";
                        remotes.push(my_client.id); //Update the list
                    }

                    my_client.status = status;

                    //debug
                    console.log("Client " + my_client.id + " identified as " + status + ".");

                    //Ask players if there is a current track
                    if (players.length > 0) {
                        io.sockets.in('players').emit('isCurrent');
                    }

                    //Broadcast current informations to everyone
                    infos();
                });

            /**
             * Broadcast current informations to everyone
             * @return void
             */
            function infos() {
                io.sockets.emit('infos', {
                    remotes:       remotes,
                    players:       players,
                    musicPosition: musicPosition,
                    musicStatus:   musicStatus,
                    musicMode:     musicMode,
                    history:       history,
                    queue:         queue
                });
            }

            /**
             * Listen for something to play
             */

            //News tracks to play immediately
            client.on('tracks', function(tracks) {

                //We udpate the history
                if (queue[0]) {
                    history.push(queue[0]);
                    queue.splice(0, 1);
                }

                //We push the new tracks a the begining of the queue
                queue = tracks.concat(queue);

                //We send the first track
                io.sockets.in('players').emit('track', queue[0]);

                //Broadcast changes to everyone
                infos();

                musicMode = "tracks";

                console.log("Tracks");
                console.log("History", history);
                console.log("Queue", queue);
            });

            //New tracks to add to queue
            client.on('queue', function(tracks) {

                //We push the new tracks a the end of the queue
                queue = queue.concat(tracks);

                //If players are "stop", we ask them to play
                if (musicStatus == "stop") {
                    io.sockets.in('players').emit('track', queue[0]);
                }

                //Broadcast changes to everyone
                infos();

                musicMode = "tracks";

                console.log("Queue");
                console.log("History", history);
                console.log("Queue", queue);
            });

            //Track to remove from queue
            client.on('removeQueue', function(track) {

                queue.splice(queue.indexOf(track), 1);

                //Broadcast changes to everyone
                infos();
            });

            //Current track ended, we update the history and the queue and we return the new track
            client.on('end', function(track) {
                if (musicMode == "tracks") {
                    //Update history with the current track
                    history.push(track);

                    //Remove the current track from queue
                    queue.splice(queue.indexOf(track), 1);

                    //Send the next track
                    io.sockets.in('players').emit('track', queue[0]);

                    //Broadcast changes to everyone
                    infos();
                }
                //else players go ahead by themself

                console.log("End");
                console.log("History", history);
                console.log("Queue", queue);
            });

            //Play a Radio
            client.on('radio', function(data) {
                queue = []; //Delete the queue
                io.sockets.in("players").emit('radio', data);
                musicMode = "radio";
            });

            //Play a SmartRadio
            client.on('smartRadio', function(data) {
                queue = []; //Delete the queue
                io.sockets.in("players").emit('smartRadio', data);
                musicMode = "radio";
            });

            //Players return the current track_id
            client.on('current', function(data) {
                if (data.current) {
                    queue[0] = data.current; //Current track
                    musicStatus = data.musicStatus;
                }
                else {
                    queue = [];
                }
                //Broadcast changes to everyone
                infos();

                console.log("Current");
                console.log("History", history);
                console.log("Queue", queue);
            });

            //Players return status (play, pause, stop ?)
            client.on('musicStatus', function(status) {
                musicStatus = status;
                //Broadcast changes to everyone
                infos();
            });

            //Players return music position
            client.on('musicPosition', function(position) {
                musicPosition = position;
                //Return to everyone
                io.sockets.emit('musicPosition', position);
            });

            //Client wants history & queue
            client.on('updateQueue', function(fn) {
                fn({
                    history: history,
                    queue:   queue
                });
            })

            /**
             * Basic command
             */

            //Play
            client.on('play', function() {
                io.sockets.in("players").emit('play');

                //Update Volume
                io.sockets.in("players").emit('volume', volume);
                console.log(queue);
            });

            //Pause
            client.on('pause', function() {
                io.sockets.in("players").emit('pause');
            });

            //Prev
            client.on('prevTrack', function() {
                //If radio, players have next/prev tracks
                if (musicMode != "radio" && history.length > 0) {
                    queue.unshift(history[history.length - 1]);
                    io.sockets.in('players').emit('track', queue[0]);
                }

                console.log("Prev");
                console.log("History", history);
                console.log("Queue", queue);
            });

            //Next
            client.on('nextTrack', function() {
                //If radio, players have next/prev tracks
                if (musicMode != "radio" && queue.length > 0) {
                    io.sockets.in('players').emit('track', queue[0]);
                }

                console.log("Next");
                console.log("History", history);
                console.log("Queue", queue);
            });

            //Seek
            client.on('seek', function(seek) {
                io.sockets.in("players").emit('seek', seek);
            });

            //Volume
            client.on('volume', function(vol) {

                //Update vol if we stay between 0 and 100
                volume = (volume + parseInt(vol) < 0 || volume + parseInt(vol) > 100) ? volume : volume + (parseInt(vol));

                //Update Player
                io.sockets.in("players").emit('volume', volume);

            });

            //Disconnect
            client.on('disconnect', function() {
                console.log("Client " + my_client.id + " disconnected.");
                allClients -= 1;

                if (my_client.status == 'player') {
                    players.splice(players.indexOf(my_client.id), 1);
                }
                else {
                    remotes.splice(remotes.indexOf(my_client.id), 1);
                }
            });

        });
    }
    catch (error) {
        console.error(error);

        process.exit()
    }
})();
