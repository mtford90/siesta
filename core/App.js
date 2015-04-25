var CollectionRegistry = require('./collectionRegistry'),
  events = require('./events'),
  Cache = require('./cache'),
  util = require('./util'),
  Collection = require('./collection');

function App(name) {
  this.collectionRegistry = new CollectionRegistry();
  this.cache = new Cache();
  this.name = name;
  this.events = events;

  util.extend(this, {
    on: events.on.bind(events),
    off: events.removeListener.bind(events),
    once: events.once.bind(events),
    removeAllListeners: events.removeAllListeners.bind(events)
  });
}

App.prototype = {
  collection: function(name, opts) {
    opts = opts || {};
    opts.app = this;
    return new Collection(name, opts);
  }
};

module.exports = App;
