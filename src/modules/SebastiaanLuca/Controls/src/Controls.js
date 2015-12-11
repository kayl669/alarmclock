var debug = require('debug')('SebastiaanLuca:Controls:Controls');

var util = require('util');
var EventEmitter = require('events').EventEmitter;

var Gpio = require('onoff').Gpio;
var PwmGpio = require('pigpio').Gpio;

var Button = require('modules/SebastiaanLuca/Controls/src/Peripherals/Button.js');

//

var Controls = function Controls() {
    
    var self = this;
    
    // Input
    var btnPlayPause = new Button(17);
    var btnPlayPreviousTrack = new Button(27);
    var btnPlayNextTrack = new Button(22);
    
    // Output
    var appRunningIndicatorLed = new Gpio(25, 'out');
    
    var volumeRotaryControl = new PwmGpio(10, {
        mode: PwmGpio.INPUT,
        edge: PwmGpio.EITHER_EDGE
    });
    
    
    
    var init = function () {
        // Turn on LED indicating application is running
        appRunningIndicatorLed.writeSync(1);
    };
    
    var quitHandler = function () {
        debug('Cleaning up our mess.');
        
        // Clear perhipherals
        appRunningIndicatorLed.unexport();
    };
    
    
    
    btnPlayPause.on('pressed', function () {
        self.emit('playPauseButtonPressed');
    });
    
    btnPlayPreviousTrack.on('pressed', function () {
        self.emit('playPreviousTrackButtonPressed');
    });
    
    btnPlayNextTrack.on('pressed', function () {
        self.emit('playNextTrackButtonPressed');
    });
    
    
    
    volumeRotaryControl.on('interrupt', function (level) {
        debug('[VOLUME ROTARY CONTROL] Interrupt!', level);
    });
    
    
    
    // Gracefully exit on CTRL+C and errors
    process.on('forceQuitApplication', quitHandler);
    
    
    
    init();
    
};

//

// Class inherits EventEmitter so we can dispatch and listen to events on the object itself
util.inherits(Controls, EventEmitter);

module.exports = new Controls();