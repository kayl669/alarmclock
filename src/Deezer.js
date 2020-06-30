'use strict';

const debug = require('debug')('alarm:webserver');
const rpio = require('rpio');
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
    musicPosition;
    queue; //Tracks to play
    history; //Tracks already played
    stationuuid;
    io;

    constructor(mainConfig, server) {
        this.mainConfig = mainConfig;
        this.server = server;
    }

    pollRight(gpio) {
        rpio.msleep(20);

        if (rpio.read(gpio)) {
            return;
        }
        this.io.sockets.in('keypad').emit("RIGHT");
        debug('Button RIGHT pressed on GPIO%d', gpio);
    }

    pollDown(gpio) {
        rpio.msleep(20);

        if (rpio.read(gpio)) {
            return;
        }
        this.io.sockets.in('keypad').emit("DOWN");
        debug('Button DOWN pressed on GPIO%d', gpio);
    }

    pollUp(gpio) {
        rpio.msleep(20);

        if (rpio.read(gpio)) {
            return;
        }
        this.io.sockets.in('keypad').emit("UP");
        debug('Button UP pressed on GPIO%d', gpio);
    }

    pollLight(gpio) {
        rpio.msleep(20);

        if (rpio.read(gpio)) {
            return;
        }
        this.io.sockets.in('keypad').emit("LIGHT");
        debug('Button LIGHT pressed on GPIO%d', gpio);
        fs.readFile('/sys/class/backlight/soc:backlight/brightness', 'utf8', function(err, contents) {
            if (parseInt(contents) === 1) {
                exec("sudo sh -c 'echo \"0\" > /sys/class/backlight/soc\:backlight/brightness'");
            }
            else {
                exec("sudo sh -c 'echo \"1\" > /sys/class/backlight/soc\:backlight/brightness'");
            }
        });
    }

    pollSnooze(gpio) {
        rpio.msleep(20);

        if (rpio.read(gpio)) {
            return;
        }
        this.io.sockets.in('keypad').emit("SNOOZE");
        debug('Button SNOOZE pressed on GPIO%d', gpio);
    }

    pollStop(gpio) {
        rpio.msleep(20);

        if (rpio.read(gpio)) {
            return;
        }
        this.io.sockets.in('keypad').emit("STOP");
        debug('Button STOP pressed on GPIO%d', gpio);
    }

    pollLeft(gpio) {
        rpio.msleep(20);

        if (rpio.read(gpio)) {
            return;
        }
        this.io.sockets.in('keypad').emit("LEFT");
        debug('Button LEFT pressed on GPIO%d', gpio);
    }

    pollOK(gpio) {
        rpio.msleep(20);

        if (rpio.read(gpio)) {
            return;
        }
        this.io.sockets.in('keypad').emit("OK");
        debug('Button OK pressed on GPIO%d', gpio);
    }

    async load() {
        //Init
        this.clientId = 1;  //client_id, will be incremented
        this.remotes = []; //list of remotes connected
        this.players = []; //list of players connected
        this.keypads = []; //list of keypads connected

        this.volume = parseInt(50); //default to 50%
        this.musicStatus = 'stop';
        this.musicPosition = 0;
        this.queue = []; //Tracks to play
        this.history = []; //Tracks already played

        this.io = require('socket.io').listen(this.server);

        rpio.init({mapping: 'gpio'});   /* Use the GPIOxx numbering */

        rpio.open(0, rpio.INPUT, rpio.PULL_UP);  // GPIO0  Right
        rpio.open(5, rpio.INPUT, rpio.PULL_UP);  // GPIO5  Down
        rpio.open(6, rpio.INPUT, rpio.PULL_UP);  // GPIO6  Up
        rpio.open(13, rpio.INPUT, rpio.PULL_UP);  // GPIO13 Light
        rpio.open(26, rpio.INPUT, rpio.PULL_UP);  // GPIO26 Snooze
        rpio.open(1, rpio.INPUT, rpio.PULL_UP);  // GPIO1  Stop
        rpio.open(12, rpio.INPUT, rpio.PULL_UP);  // GPIO12 Left
        rpio.open(16, rpio.INPUT, rpio.PULL_UP);  // GPIO16 OK

        rpio.poll(0, (this.pollRight).bind(this), rpio.POLL_LOW);    // GPIO0  Right
        rpio.poll(5, (this.pollDown).bind(this), rpio.POLL_LOW);     // GPIO5  Down
        rpio.poll(6, (this.pollUp).bind(this), rpio.POLL_LOW);       // GPIO6  Up
        rpio.poll(13, (this.pollLight).bind(this), rpio.POLL_LOW);   // GPIO13 Light
        rpio.poll(26, (this.pollSnooze).bind(this), rpio.POLL_LOW);  // GPIO26 Snooze
        rpio.poll(1, (this.pollStop).bind(this), rpio.POLL_LOW);     // GPIO1  Stop
        rpio.poll(12, (this.pollLeft).bind(this), rpio.POLL_LOW);    // GPIO12 Left
        rpio.poll(16, (this.pollOK).bind(this), rpio.POLL_LOW);      // GPIO16 OK
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

                    //Ask players if there is a current track
                    if (this.players.length > 0) {
                        this.io.sockets.in('players').emit('isCurrent');
                    }

                    //Broadcast current information to everyone
                    this.infos();
                }.bind(this));

            /**
             * Listen for something to play
             */

            //News tracks to play immediately
            client.on('tracks', function(tracks) {
                debug(tracks);
                //We update the history
                let track = this.queue[0];
                if (track) {
                    this.history.push(track);
                    this.queue.splice(0, 1);
                }

                //We replace the queue
                this.queue = tracks;

                //We send the first track
                this.updateTrack(tracks[0]);

                //Broadcast changes to everyone
                this.infos();
            }.bind(this));

            //New tracks to add to queue
            client.on('queue', function(tracks) {

                //We push the new tracks a the end of the queue
                this.queue = this.queue.concat(tracks);

                //If players are 'stop', we ask them to play
                if (this.musicStatus === 'stop') {
                    this.updateTrack(this.queue[0]);
                }

                //Broadcast changes to everyone
                this.infos();
            }.bind(this));

            //Track to remove from queue
            client.on('removeQueue', function(track) {

                this.queue.splice(this.queue.indexOf(track), 1);

                //Broadcast changes to everyone
                this.infos();
            }.bind(this));

            //Current track ended, we update the history and the queue and we return the new track
            client.on('end', function(track) {
                //Update history with the current track
                this.history.push(track);

                //Remove the current track from queue
                this.queue.splice(this.queue.indexOf(track), 1);

                //Send the next track
                this.updateTrack(this.queue[0]);

                //Broadcast changes to everyone
                this.infos();

                debug('End');
            }.bind(this));

            client.on('playlist', function(data) {
                debug('playlist ' + data.playlist);
                this.io.sockets.in('players').emit('playlist', data);
            }.bind(this));

            client.on('radio', function(data) {
                debug('radio ' + data.stationuuid);
                this.io.sockets.in('players').emit('radio', data);
            }.bind(this));

            //Players return the current track_id
            client.on('current', function(data) {
                if (data.current) {
                    this.queue[0] = data.current; //Current track
                    this.musicStatus = data.musicStatus;
                }
                //Broadcast changes to everyone
                this.infos();

                debug('Current');
            }.bind(this));

            //Players return status (play, pause, stop ?)
            client.on('musicStatus', function(status) {
                debug('musicStatus');
                this.musicStatus = status;
                //Broadcast changes to everyone
                this.infos();
            }.bind(this));

            //Players return music position
            client.on('musicPosition', function(position) {
                this.musicPosition = position;
                //Return to everyone
                this.io.sockets.emit('musicPosition', position);
            }.bind(this));

            //Client wants history & queue
            client.on('updateQueue', function(fn) {
                fn({
                    history: this.history,
                    queue:   this.queue
                });
            }.bind(this))

            /**
             * Basic command
             */

            //Play
            client.on('play', function() {
                this.play();

                //Update Volume
                this.setVolume(this.volume);
                debug(this.queue.length);
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
                    this.updateTrack(this.queue[0]);
                }

                debug('Prev');
            }.bind(this));

            //Next
            client.on('nextTrack', function() {
                if (this.queue.length > 0) {
                    this.updateTrack(this.queue[0]);
                }

                debug('Next');
            }.bind(this));

            //Seek
            client.on('seek', function(seek) {
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

    updateTrack(trackId) {
        debug("updateTrack");
        this.io.sockets.in('players').emit('track', trackId);
    }

    pause() {
        debug("pause");
        this.io.sockets.in('players').emit('pause');
    }

    stop() {
        debug("stop");
        this.io.sockets.in('players').emit('stop');
    }

    setVolume(volume) {
        debug("setVolume", volume);
        this.io.sockets.in('players').emit('volume', volume);
    }

    startPlay(playlist) {
        debug("startPlay");
        this.io.sockets.in('players').emit('playlist', {playlist: playlist});
        this.play();
    }

    startRadio(stationuuid) {
        debug("startRadio");
        this.io.sockets.in('players').emit('radio', {stationuuid: stationuuid});
        this.play();
    }

    play() {
        debug("play");
        this.io.sockets.in('players').emit('play');
    }

    /**
     * Broadcast current informations to everyone
     * @return void
     */
    infos() {
        this.io.sockets.emit('infos', {
            remotes:       this.remotes,
            players:       this.players,
            musicPosition: this.musicPosition,
            musicStatus:   this.musicStatus,
            history:       this.history,
            queue:         this.queue
        });
    }

    hasPlayerConnected() {
        return this.players.length > 0;
    }

    static async create(mainConfig, server) {
        const instance = new this(mainConfig, server);

        debug('Creating new deezer');

        await instance.load();

        return instance
    }
}
