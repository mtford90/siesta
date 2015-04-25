var CollectionRegistry = require('./collectionRegistry'),
  events = require('./events'),
  Cache = require('./cache'),
  util = require('./util'),
  Collection = require('./collection');

function App(name) {
  this.collectionRegistry = new CollectionRegistry();
  this.cache = new Cache();
  this.name = name;
  this.events = events();

  util.extend(this, {
    on: this.events.on.bind(this.events),
    off: this.events.removeListener.bind(this.events),
    once: this.events.once.bind(this.events),
    removeAllListeners: this.events.removeAllListeners.bind(this.events)
  });
}

App.prototype = {
  collection: function(name, opts) {
    opts = opts || {};
    opts.app = this;
    return new Collection(name, opts);
  },
  reset: function () {
    this.removeAllListeners();
  }
};

module.exports = App;
