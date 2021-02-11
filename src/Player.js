'use strict';

const debug = require('debug')('alarm:webserver');
const Gpio = require('onoff').Gpio;
const fs = require('fs');
const exec = require("child_process").exec;

export default class {
    mainConfig;
    server;
    clientId; //client_id, will be incremented
    remotes; //list of remotes connected
    players; //list of players connected
    keypads; //List of keypads connected
    volume; //default to 50%
    musicStatus;
    type;
    musicPosition;
    queue; //Tracks to play
    history; //Tracks already played
    stationuuid;
    io;

    constructor(mainConfig, server) {
        this.mainConfig = mainConfig;
        this.server = server;
    }

    pollRight(err, value) {
        if (err) {
            throw err;
        }
        this.io.sockets.in('keypad').emit("RIGHT");
        debug('Button RIGHT pressed', value);
    }

    pollDown(err, value) {
        if (err) {
            throw err;
        }
        this.io.sockets.in('keypad').emit("DOWN");
        debug('Button DOWN pressed', value);
    }

    pollUp(err, value) {
        if (err) {
            throw err;
        }
        this.io.sockets.in('keypad').emit("UP");
        debug('Button UP pressed', value);
    }

    pollLight(err, value) {
        if (err) {
            throw err;
        }
        this.io.sockets.in('keypad').emit("LIGHT");
        debug('Button LIGHT pressed', value);
        fs.readFile('/sys/class/backlight/soc:backlight/brightness', 'utf8', function(err, contents) {
            if (parseInt(contents) === 1) {
                exec("sudo sh -c 'echo \"0\" > /sys/class/backlight/soc\:backlight/brightness'");
            }
            else {
                exec("sudo sh -c 'echo \"1\" > /sys/class/backlight/soc\:backlight/brightness'");
            }
        });
    }

    pollSnooze(err, value) {
        if (err) {
            throw err;
        }
        this.io.sockets.in('keypad').emit("SNOOZE");
        debug('Button SNOOZE pressed', value);
    }

    pollStop(err, value) {
        if (err) {
            throw err;
        }
        this.io.sockets.in('keypad').emit("STOP");
        debug('Button STOP pressed', value);
    }

    pollLeft(err, value) {
        if (err) {
            throw err;
        }
        this.io.sockets.in('keypad').emit("LEFT");
        debug('Button LEFT pressed', value);
    }

    pollOK(err, value) {
        if (err) {
            throw err;
        }
        this.io.sockets.in('keypad').emit("OK");
        debug('Button OK pressed', value);
    }

    async load() {
        //Init
        this.clientId = 1;  //client_id, will be incremented
        this.remotes = []; //list of remotes connected
        this.players = []; //list of players connected
        this.keypads = []; //list of keypads connected

        this.volume = parseInt(50); //default to 50%
        this.musicStatus = 'stop';
        this.type = 'youtube';
        this.musicPosition = 0;
        this.queue = []; //Tracks to play
        this.history = []; //Tracks already played

        this.io = require('socket.io').listen(this.server);
        if (Gpio.accessible) {
            const button0 = new Gpio(0, 'in', 'falling', {
                activeLow:       true,
                debounceTimeout: 10
            });
            button0.watch((this.pollRight).bind(this));   // GPIO0  Right
            const button5 = new Gpio(5, 'in', 'falling', {
                activeLow:       true,
                debounceTimeout: 10
            });
            button5.watch((this.pollDown).bind(this));    // GPIO5  Down
            const button6 = new Gpio(6, 'in', 'falling', {
                activeLow:       true,
                debounceTimeout: 10
            });
            button6.watch((this.pollUp).bind(this));      // GPIO6  Up
            const button13 = new Gpio(13, 'in', 'falling', {
                activeLow:       true,
                debounceTimeout: 10
            });
            button13.watch((this.pollLight).bind(this));  // GPIO13 Light
            const button26 = new Gpio(26, 'in', 'falling', {
                activeLow:       true,
                debounceTimeout: 10
            });
            button26.watch((this.pollSnooze).bind(this)); // GPIO26 Snooze
            const button1 = new Gpio(1, 'in', 'falling', {
                activeLow:       true,
                debounceTimeout: 10
            });
            button1.watch((this.pollStop).bind(this));    // GPIO1  Stop
            const button12 = new Gpio(12, 'in', 'falling', {
                activeLow:       true,
                debounceTimeout: 10
            });
            button12.watch((this.pollLeft).bind(this));   // GPIO12 Left
            const button16 = new Gpio(16, 'in', 'falling', {
                activeLow:       true,
                debounceTimeout: 10
            });
            button16.watch((this.pollOK).bind(this));     // GPIO16 OK

            process.on('SIGINT', _ => {
                button0.unexport();
                button5.unexport();
                button6.unexport();
                button13.unexport();
                button26.unexport();
                button1.unexport();
                button12.unexport();
                button16.unexport();
            });
        }

        /**
         * A new connection
         */
        this.io.sockets.on('connection', function(client) {
            //The client
            var my_client = {
                'id':     this.clientId,
                'obj':    client,
                'status': null
            };

            //Upload the stats
            this.clientId += 1;

            //Debug
            debug('New Client ' + my_client.id + ' connected.');

            //Return 'connected' to the client
            client.emit('connected', //the client id and status
                {
                    clientId: my_client.id,
                    msg:      'Connected'
                }, //The client will identificate himself
                //Player or command ?
                function(status) {
                    if (status === 'player') {
                        client.join('players'); //Join the room of the players
                        my_client.status = 'player';
                        this.players.push(my_client.id); //Update the list
                        this.clientInfos(client);
                    }
                    else if (status === 'remote') {
                        my_client.status = 'remote';
                        this.remotes.push(my_client.id); //Update the list
                    }
                    else if (status === 'keypad') {
                        client.join('keypad'); //Join the room of keypad
                        my_client.status = 'keypad';
                        this.keypads.push(my_client.id); //Update the list
                    }

                    my_client.status = status;

                    //debug
                    debug('Client ' + my_client.id + ' identified as ' + status + '.');
                }.bind(this));

            /**
             * Listen for something to play
             */

            //News tracks to play immediately
            client.on('sendTracks', function(tracks) {
                debug(tracks);
                //We update the history
                let track = this.queue[0];
                if (track) {
                    this.history.push(track);
                    this.queue.splice(0, 1);
                }

                //We replace the queue
                this.queue = tracks;
                this.musicStatus = 'playing';
                this.type = 'youtube';
                this.stationuuid = '';

                //Broadcast changes to everyone
                this.infos('tracks');
            }.bind(this));

            client.on('sendMp3tracks', function(tracks) {
                debug(tracks);
                //We update the history
                let track = this.queue[0];
                if (track) {
                    this.history.push(track);
                    this.queue.splice(0, 1);
                }

                //We replace the queue
                this.queue = tracks;
                this.musicStatus = 'playing';
                this.type = 'mp3';
                this.stationuuid = '';

                //Broadcast changes to everyone
                this.infos('mp3tracks');
            }.bind(this));

            //Current track ended, we update the history and the queue and we return the new track
            client.on('end', function(track) {
                //Update history with the current track
                this.history.push(track);

                //Remove the current track from queue
                this.queue.splice(0, 1);

                this.infos('end');

                debug('End');
            }.bind(this));

            client.on('playlist', function(data) {
                debug('playlist ' + data.playlist);
                this.io.sockets.in('players').emit('playlist', data);
            }.bind(this));

            client.on('radio', function(radio) {
                this.startRadio(radio.stationuuid);
            }.bind(this));

            //Players return status (play, pause, stop ?)
            client.on('musicStatus', function(data) {
                debug('musicStatus', data);
                this.musicStatus = data.musicStatus;
                this.type = data.type;
            }.bind(this));

            //Players return music position
            client.on('musicPosition', function(position) {
                this.musicPosition = position;
                //Return to everyone
                this.io.sockets.emit('musicPosition', position);
            }.bind(this));

            /**
             * Basic command
             */

            //Play
            client.on('play', function() {
                this.play();

                //Update Volume
                this.setVolume(this.volume);
            }.bind(this));

            //Pause
            client.on('pause', function() {
                this.pause();
            }.bind(this));

            //Stop
            client.on('stop', function() {
                this.stop();
            }.bind(this));

            //Prev
            client.on('prevTrack', function() {
                if (this.history.length > 0) {
                    this.queue.unshift(this.history[this.history.length - 1]);
                    this.history.splice(this.history.length - 1, 1);
                    this.infos('prevTrack');
                }

                debug('Prev');
            }.bind(this));

            //Next
            client.on('nextTrack', function() {
                if (this.queue.length > 1) {
                    this.history.push(this.queue[0]);

                    //Remove the current track from queue
                    this.queue.splice(0, 1);
                    this.infos('nextTrack');
                }

                debug('Next');
            }.bind(this));

            //Seek
            client.on('seek', function(seek) {
                debug('seek', seek);
                this.io.sockets.in('players').emit('seek', seek);
            }.bind(this));

            //Volume
            client.on('volume', function(vol) {
                //Update vol if we stay between 0 and 100
                this.volume = (this.volume + parseInt(vol) < 0 || this.volume + parseInt(vol) > 100) ? this.volume : this.volume + (parseInt(vol));

                //Update Player
                this.setVolume(this.volume);
            }.bind(this));

            //Disconnect
            client.on('disconnect', ((reason) => {
                debug('Client ' + my_client.id + ' disconnected.');
                debug(reason);
                if (my_client.status === 'player') {
                    this.players.splice(this.players.indexOf(my_client.id), 1);
                }
                else {
                    this.remotes.splice(this.remotes.indexOf(my_client.id), 1);
                }
            }).bind(this));

        }.bind(this));
    }

    playMusic() {
        debug("playMusic");
        this.stationuuid = '';
        this.musicStatus = 'playing';
        this.type = 'mp3';
        this.io.sockets.in('players').emit('playMusic');
    }

    pause() {
        debug("pause");
        this.musicStatus = 'pause';
        this.io.sockets.in('players').emit('pause');
    }

    stop() {
        debug("stop");
        this.musicStatus = 'stop';
        this.io.sockets.in('players').emit('stop');
    }

    setVolume(volume) {
        debug("setVolume", volume);
        this.io.sockets.in('players').emit('volume', volume);
    }

    startPlay(playlist) {
        debug("startPlay", playlist);
        this.stationuuid = '';
        this.musicStatus = 'playing';
        this.type = 'youtube';
        this.io.sockets.in('players').emit('playlist', {playlist: playlist});
    }

    startMp3() {
        debug("startMp3");
        this.stationuuid = '';
        this.musicStatus = 'playing';
        this.type = 'mp3';
        this.io.sockets.in('players').emit('playlistMp3', {});
    }

    startRadio(stationuuid) {
        debug("startRadio", stationuuid);
        this.stationuuid = stationuuid;
        this.queue = [];
        this.musicStatus = 'playing';
        this.type = 'radio';
        this.io.sockets.in('players').emit('radio', {stationuuid: stationuuid});
    }

    play() {
        debug("play");
        this.musicStatus = 'playing';
        this.io.sockets.in('players').emit('play');
    }

    infos(infoType) {
        debug(infoType);
        this.io.sockets.emit(infoType, {
            musicPosition: this.musicPosition,
            musicStatus:   this.musicStatus,
            type:          this.type,
            queue:         this.queue,
            stationuuid:   this.stationuuid,
        });
    }

    clientInfos(client) {
        debug('clientInfos');
        client.emit('clientInfos', {
            musicPosition: this.musicPosition,
            musicStatus:   this.musicStatus,
            type:          this.type,
            queue:         this.queue,
            stationuuid:   this.stationuuid,
        });
    }

    hasPlayerConnected() {
        return this.players.length > 0;
    }

    static async create(mainConfig, server) {
        const instance = new this(mainConfig, server);

        debug('Creating new player');

        await instance.load();

        return instance
    }
}
