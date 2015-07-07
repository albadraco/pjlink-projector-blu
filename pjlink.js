'use strict';
var util = require('util');
var meshblu = require('meshblu');
var net = require('net');
var EventEmitter = require('events').EventEmitter;
var crypto = require("crypto");
var debug = require('debug');
var log = console.log;
var deviceName = "PJLINKProjector";
var CR = '\r'; 

var Commands = {
    Power: {
        On:   '%1POWR 1' + CR,
        Off:  '%1POWR 0' + CR,
        Get:  '%1POWR ?' + CR,
        Result: [
            '%1POWR=OK' + CR, 'Success',
            '%1POWR=ERR2' + CR, 'Out-of-Parameter',
            '%1POWR=ERR3' + CR, 'Unavailable',
            '%1POWR=ERR4' + CR, 'Projector Failure',
            '%1POWR=0' + CR, 'Standby',
            '%1POWR=1' + CR, 'On' ,
            '%1POWR=2' + CR, 'Cooling',
            '%1POWR=3' + CR, 'Warmup'
        ]
    },
    Input: {
        RGB:     '%1INPT 1#' + CR,
        VIDEO:   '%1INPT 2#' + CR,
        DIGITAL: '%1INPT 3#' + CR,
        STORAGE: '%1INPT 4#' + CR,
        NETWORK: '%1INPT 5#' + CR,
        Get: '%1INPT ?' + CR,
        Result: [
             '%1INPT=OK' + CR, 'Success',
             '%1INPT 3' + CR, 'Success',
             '%1INPT=ERR2' + CR, 'Invalid Input Source',
             '%1INPT=ERR3' + CR, 'Unavailable',
             '%1INPT=ERR4' + CR, 'Display Failure',
        ]
    },
    Lamp: {
        Get:  '%1LAMP ?' + CR,
        Result: [  // In the first position containing a '.' a value of 0-99999 second '.' = 1 lamp on 2 lamp off The pattern  ' . .' repeats for each LAMP.. 
            '%1LAMP=ERR3' + CR, 'Unavailable',
            '%1LAMP=ERR4' + CR, 'Projector Failure'
        ]
    },
    Mute: {
        VideoON:          '%1AVMT 11' + CR,
        VideoOFF:         '%1AVMT 10' + CR,
        AudioON:          '%1AVMT 21' + CR,
        AudoOFF:          '%1AVMT 20' + CR,
        VideoAndAudioON:  '%1AVMT 31' + CR,
        VideoAndAudioOFF: '%1AVMT 30' + CR,
        Get:              '%1AVMT ?' + CR,
        Result: [ 
            '%1AVMT=OK' + CR, 'Success',
            '%1AVMT=ERR2' + CR, 'Out-of-Parameter',
            '%1AVMT=ERR3' + CR, 'Unavailable',
            '%1AVMT=ERR4' + CR, 'Projector Failure',
            '%1AVMT=11' + CR, 'Video Mute ON',
            '%1AVMT=21' + CR, 'Audio Mute ON',
            '%1AVMT=31' + CR, 'Video and Audio Mute ON',
            '%1AVMT=30' + CR, 'Viedo and Audio Mute OFF',
        ]
    },
    ErrorStatus: {
        Get:     '%1ERST ?' + CR,
        Result: [  // In the position containing a '.' a value of 1 = warning 2 = error
            '%1ERST=000000' + CR, "Normal"
        ]
    }
}
var MESSAGE_SCHEMA = {
    type: 'object',
    properties: {
        Command: {
            type: 'string',
            required: true,
            default: 'Power',
            enum: [ 'Power', 'Input', 'ErrorStatus', 'Lamp', 'Mute', 'Custom' ]
        },
        Operation: {
            type: 'string',
            required: true,
            default: 'On',
            enum: [
                'On',
                'Off',
                'Get',
                'RGB',
                'VIDEO',
                'DIGITAL',
                'NETWORK',
                'VideoON',
                'VideoOFF',
                'AudioON',
                'AudioOFF',
                'VideoAndAudioON',
                'VideoAndAudioOFF'
            ]
        },
        Custom: {
            type: 'string',
            required: false,
            default: '',
        }
  }
};
var OPTIONS_SCHEMA = {
  type: 'object',
  properties: {
      IsAuthenticationOn: {
          type: 'boolean',
          required: true,
          default: true,
          enum: [ true, false ]
      },
      NetworkAddress: {
          type: 'string',
          required: true,
      },
      NetworkPort: {
          type: 'integer',
          required: true,
          default: 4352,
      },
      DevicePassword: {
          type: 'string',
          required: false,
          'x-schema-form': {
            type: 'password'
          }
     }
  }
};

function buildAuthBits(options, sessionid) {
    var tmp;
    var md5sum = crypto.createHash('md5');
    tmp = sessionid + options.DevicePassword;
    md5sum.update(tmp);
    return md5sum.digest('hex');
}
function testControlAuth() {
    var tmp;
    var md5sum = crypto.createHash('md5');
    tmp = '498e4a67' + 'JBMIAProjectorLink';
    md5sum.update(tmp);
    var encry = md5sum.digest('hex');
    log('testControlAuth:', encry);
}
function getAuthCommand(sock, options, sessionid) {
    return buildAuthBits(options, sessionid);
}
function sendCommand(sock, options, operation, auth) {
    var cmdline = Commands[operation.Command][operation.Operation];
    if (operation.Command === "Input") 
    {
        cmdline = cmdline.replace("#",  operation.Custom);
    }
    if (auth !== 'undefined') {
        cmdline = auth + cmdline;
    }
    log('sendCommand: ', cmdline);

    sock.write(cmdline);
}
function cleanup(self, sock, operation, buff) {
    var response = { results: 0x0 };
    sock.end();  // need to close after reading response: it seems to only like one command per session.
    var resultcount = Commands[operation.Command].Result.length;
    var i = 0;
    for (i = 0; i < resultcount; i = i + 2) {
       if (Commands[operation.Command].Result[i] === buff)  {
           response.results = Commands[operation.Command].Result[i + 1];
           i = resultcount + 5;
       }
    }
    // didn't find a match so return response in raw format.
    if (response.results === 0x0) {
        response.results = buff;
    }
    if (operation.Command === Commands.ErrorStatus.Get) {
        response.results = parseerr(buff);
    }
    log("cleanup.response: ", response);
    self.emit('message', { devices: ['*'], payload: response });
}
function parseerr(buff) {
    var fields = buff.split('=');
    var errors = '';
    switch (fields[1]) {
        case '000000': { errors = 'Normal:'; break; }
        case 'ERR3': { errors = 'Unavailable:'; break;}
        case 'ERR4': { errors = 'Projector Failure'; break; }
        default: {
            var f = fields[1].split('');
            for (var i in f) {
                switch (i) {
                    case 0: {
                        errors = errors + 'Fan: ' + errstr(Number(i));
                        break;
                    }
                    case 1: {
                        errors = errors + 'Lamp: ' + errstr(Number(i));
                        break;
                    }
                    case 2: {
                        errors = errors + 'Temperature: ' + errstr(Number(i));
                        break;
                    }
                    case 3: {
                        errors = errors + 'Cover: ' + errstr(Number(i));
                        break;
                    }
                    case 4: {
                        errors = errors + 'Airflow: ' + errstr(Number(i));
                        break;
                    }
                    case 5: {
                        errors = errors + 'Temporary: ' + errstr(Number(i));
                        break;
                    }
                }
                errors = errors + ',';
            }
        }
    }
    return errors;
}
function errstr(val) {
        switch(val) {
            case 1: {return 'Warning'; }
            case 2: {return 'Failure'; }
            default: { return 'Unknown'; }
        }
}
function Plugin() {
  this.options = {};
  this.messageSchema = MESSAGE_SCHEMA;
  this.optionsSchema = OPTIONS_SCHEMA;
  return this;
};

util.inherits(Plugin, EventEmitter);

Plugin.prototype.onMessage = function(message){
    log('onMessage: ', message.payload);
    var sock = {};
    var response = { results: 0x00 };
    var self = this;
    var params = {
        host: this.options.NetworkAddress,
        port: this.options.NetworkPort,
    };

    sock = new net.Socket();
    sock.setEncoding('utf8');
    sock.setNoDelay(true);
    sock.connect(params.port, params.host);

    sock.on('data', function (data) {
        var buff = data;
        log("sock.on.data: ", buff);
        if (buff.indexOf('PJLINK') >= 0) {
            var fields = buff.split(' ');
            if (fields[1] == '1') {
                var auth = getAuthCommand(sock, self.options, fields[2].substring(0,8));
                sendCommand(sock, self.options, message.payload, auth);
            } else if (fields[1] == '0') {
                sendCommand(sock, self.options, message.payload, 'undefined');
            } else {
                cleanup(self, sock, message.payload, buff);                
            }
        } else {
            cleanup(self, sock, message.payload, buff);
        }
    });
    sock.on('open', function () {
        log('sock open');
    });
    sock.on('ready', function (prompt) {
        log('sock ready: ', prompt);
        sessionid = prompt;
    });
    sock.on('error', function (e) {
        if (e.code == 'ECONNRESET') {
            log('ECONNRESET');
        }
    });
    sock.on('close', function () {
        log('sock closed');
        sock = {};
    });
};
Plugin.prototype.onConfig = function(device){
    log('onConfig', device.options);

    this.setOptions(device.options||{});
};
Plugin.prototype.setOptions = function(newoptions){
  this.options = newoptions;
};

module.exports = {
  messageSchema: MESSAGE_SCHEMA,
  optionsSchema: OPTIONS_SCHEMA,
  Plugin: Plugin
};
