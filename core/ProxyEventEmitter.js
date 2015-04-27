var ArrayObserver = require('../vendor/observe-js/src/observe').ArrayObserver,
  util = require('./util'),
  argsarray = require('argsarray'),
  modelEvents = require('./modelEvents'),
  Chain = require('./Chain');


/**
 * Listen to a particular event from the Siesta global EventEmitter.
 * Manages its own set of listeners.
 * @constructor
 */
function ProxyEventEmitter(context, event, chainOpts) {
  if (!context) throw new Error('wtf');
  util.extend(this, {
    event: event,
    context: context,
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
    this.context.events.on(this.event, fn);
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
            this.context.events.removeListener(event, fn);
            _fn(e);
          }
        }
        else {
          _fn(e);
        }
      }.bind(this)
    }
    if (type) return this.context.events.on(event, fn);
    else return this.context.events.once(event, fn);
  },
  _removeListener: function(fn, type) {
    if (type) {
      var listeners = this.listeners[type],
        idx = listeners.indexOf(fn);
      listeners.splice(idx, 1);
    }
    return this.context.events.removeListener(this.event, fn);
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
    this.context.events.emit.call(this.context.events, this.event, payload);
  },
  _removeAllListeners: function(type) {
    (this.listeners[type] || []).forEach(function(fn) {
      this.context.events.removeListener(this.event, fn);
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

module.exports = ProxyEventEmitter;
