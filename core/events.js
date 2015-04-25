var EventEmitter = require('events').EventEmitter,
  util = require('./util'),
  argsarray = require('argsarray'),
  modelEvents = require('./modelEvents'),
  Chain = require('./Chain');


var eventEmitterfactory = function() {
  var eventEmitter = new EventEmitter();
  eventEmitter.setMaxListeners(100);


  var oldEmit = eventEmitter.emit;

  // Ensure that errors in event handlers do not stall Siesta.
  eventEmitter.emit = function(event, payload) {
    try {
      oldEmit.call(eventEmitter, event, payload);
    }
    catch (e) {
      console.error(e);
    }
  };
  return eventEmitter;
};

module.exports = eventEmitterfactory;
