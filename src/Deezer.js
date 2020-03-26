'use strict';

const debug = require('debug')('alarm:webserver');

export default class {
    mainConfig;
    server;
    clientId; //client_id, will be incremented
    remotes; //list of remotes connected
    players; //list of players connected
    volume; //default to 50%
    musicStatus;
    musicPosition;
    musicMode; // 'Tracks' or 'Radio'
    queue; //Tracks to play
    history; //Tracks already played
    io;

    constructor(mainConfig, server) {
        this.mainConfig = mainConfig;
        this.server = server;
    }

    async load() {
        //Init
        this.clientId = 1;  //client_id, will be incremented
        this.remotes = []; //list of remotes connected
        this.players = []; //list of players connected

        this.volume = parseInt(50); //default to 50%
        this.musicStatus = 'stop';
        this.musicPosition = 0;
        this.musicMode = 'tracks'; // 'Tracks' or 'Radio'
        this.queue = this.mainConfig.get('tracksDeezer'); //Tracks to play
        this.history = []; //Tracks already played

        this.io = require('socket.io').listen(this.server);
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
                    else {
                        my_client.status = 'remote';
                        this.remotes.push(my_client.id); //Update the list
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
                this.mainConfig.set('tracksDeezer', this.queue);
                this.mainConfig.save();

                //We send the first track
                this.updateTrack(track);

                //Broadcast changes to everyone
                this.infos();

                this.musicMode = 'tracks';

                debug('Tracks');
            }.bind(this));

            //New tracks to add to queue
            client.on('queue', function(tracks) {

                //We push the new tracks a the end of the queue
                this.queue = this.queue.concat(tracks);
                this.mainConfig.set('tracksDeezer', this.queue);
                this.mainConfig.save();

                //If players are 'stop', we ask them to play
                if (this.musicStatus === 'stop') {
                    this.updateTrack(this.queue[0]);
                }

                //Broadcast changes to everyone
                this.infos();

                this.musicMode = 'tracks';
            }.bind(this));

            //Track to remove from queue
            client.on('removeQueue', function(track) {

                this.queue.splice(this.queue.indexOf(track), 1);
                this.mainConfig.set('tracksDeezer', this.queue);
                this.mainConfig.save();

                //Broadcast changes to everyone
                this.infos();
            }.bind(this));

            //Current track ended, we update the history and the queue and we return the new track
            client.on('end', function(track) {
                if (this.musicMode === 'tracks') {
                    //Update history with the current track
                    this.history.push(track);

                    //Remove the current track from queue
                    this.queue.splice(this.queue.indexOf(track), 1);
                    this.mainConfig.set('tracksDeezer', this.queue);
                    this.mainConfig.save();

                    //Send the next track
                    this.updateTrack(this.queue[0]);

                    //Broadcast changes to everyone
                    this.infos();
                }
                //else players go ahead by themself

                debug('End');
            }.bind(this));

            //Play a Radio
            client.on('radio', function(data) {
                this.queue = []; //Delete the queue
                this.io.sockets.in('players').emit('radio', data);
                this.musicMode = 'radio';
            }.bind(this));

            //Play a SmartRadio
            client.on('smartRadio', function(data) {
                this.queue = []; //Delete the queue
                this.io.sockets.in('players').emit('smartRadio', data);
                this.musicMode = 'radio';
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
                //If radio, players have next/prev tracks
                if (this.musicMode !== 'radio' && this.history.length > 0) {
                    this.queue.unshift(this.history[this.history.length - 1]);
                    this.updateTrack(this.queue[0]);
                }

                debug('Prev');
            }.bind(this));

            //Next
            client.on('nextTrack', function() {
                //If radio, players have next/prev tracks
                if (this.musicMode !== 'radio' && this.queue.length > 0) {
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
            client.on('disconnect', function() {
                debug('Client ' + my_client.id + ' disconnected.');

                if (my_client.status === 'player') {
                    this.players.splice(this.players.indexOf(my_client.id), 1);
                }
                else {
                    this.remotes.splice(this.remotes.indexOf(my_client.id), 1);
                }
            }.bind(this));

        }.bind(this));
    }

    updateTrack(track) {
        debug("updateTrack");
        this.io.sockets.in('players').emit('track', track);
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

    startPlay() {
        debug("startPlay");
        let track = this.queue[0];
        if (track) {
            this.history.push(track);
            this.queue.splice(0, 1);
        }

        debug(track);
        //We send the first track
        this.updateTrack(track);
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
        debug("Queue");
        debug(this.queue.length);
        this.io.sockets.emit('infos', {
            remotes:       this.remotes,
            players:       this.players,
            musicPosition: this.musicPosition,
            musicStatus:   this.musicStatus,
            musicMode:     this.musicMode,
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
