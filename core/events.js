var EventEmitter = require('events').EventEmitter,
  ArrayObserver = require('../vendor/observe-js/src/observe').ArrayObserver,
  util = require('./util'),
  argsarray = require('argsarray'),
  modelEvents = require('./modelEvents'),
  Chain = require('./Chain');

var eventEmitter = new EventEmitter();
eventEmitter.setMaxListeners(100);

/**
 * Listen to a particular event from the Siesta global EventEmitter.
 * Manages its own set of listeners.
 * @constructor
 */
function ProxyEventEmitter(event, chainOpts) {
  util.extend(this, {
    event: event,
    listeners: {}
  });
  var defaultChainOpts = {};

  defaultChainOpts.on = this.on.bind(this);
  defaultChainOpts.once = this.once.bind(this);

  Chain.call(this, util.extend(defaultChainOpts, chainOpts || {}));
}

ProxyEventEmitter.prototype = Object.create(Chain.prototype);

util.extend(ProxyEventEmitter.prototype, {
  on: function(type, fn) {
    if (typeof type == 'function') {
      fn = type;
      type = null;
    }
    else {
      if (type.trim() == '*') type = null;
      var _fn = fn;
      fn = function(e) {
        e = e || {};
        if (type) {
          if (e.type == type) {
            _fn(e);
          }
        }
        else {
          _fn(e);
        }
      };
      var listeners = this.listeners;
      if (type) {
        if (!listeners[type]) listeners[type] = [];
        listeners[type].push(fn);
      }
    }
    eventEmitter.on(this.event, fn);
    return this._handlerLink({
      fn: fn,
      type: type,
      extend: this.proxyChainOpts
    });
  },
  once: function(type, fn) {
    var event = this.event;
    if (typeof type == 'function') {
      fn = type;
      type = null;
    }
    else {
      if (type.trim() == '*') type = null;
      var _fn = fn;
      fn = function(e) {
        e = e || {};
        if (type) {
          if (e.type == type) {
            eventEmitter.removeListener(event, fn);
            _fn(e);
          }
        }
        else {
          _fn(e);
        }
      }
    }
    if (type) return eventEmitter.on(event, fn);
    else return eventEmitter.once(event, fn);
  },
  _removeListener: function(fn, type) {
    if (type) {
      var listeners = this.listeners[type],
        idx = listeners.indexOf(fn);
      listeners.splice(idx, 1);
    }
    return eventEmitter.removeListener(this.event, fn);
  },
  emit: function(type, payload) {
    if (typeof type == 'object') {
      payload = type;
      type = null;
    }
    else {
      payload = payload || {};
      payload.type = type;
    }
    eventEmitter.emit.call(eventEmitter, this.event, payload);
  },
  _removeAllListeners: function(type) {
    (this.listeners[type] || []).forEach(function(fn) {
      eventEmitter.removeListener(this.event, fn);
    }.bind(this));
    this.listeners[type] = [];
  },
  removeAllListeners: function(type) {
    if (type) {
      this._removeAllListeners(type);
    }
    else {
      for (type in this.listeners) {
        if (this.listeners.hasOwnProperty(type)) {
          this._removeAllListeners(type);
        }
      }
    }
  }
});

util.extend(eventEmitter, {
  ProxyEventEmitter: ProxyEventEmitter,
  wrapArray: function(array, field, modelInstance) {
    if (!array.observer) {
      array.observer = new ArrayObserver(array);
      array.observer.open(function(splices) {
        var fieldIsAttribute = modelInstance._attributeNames.indexOf(field) > -1;
        if (fieldIsAttribute) {
          splices.forEach(function(splice) {
            modelEvents.emit({
              collection: modelInstance.collectionName,
              model: modelInstance.model.name,
              localId: modelInstance.localId,
              index: splice.index,
              removed: splice.removed,
              added: splice.addedCount ? array.slice(splice.index, splice.index + splice.addedCount) : [],
              type: modelEvents.ModelEventType.Splice,
              field: field,
              obj: modelInstance
            });
          });
        }
      });
    }
  }
});

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

module.exports = eventEmitter;