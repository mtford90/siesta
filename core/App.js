var CollectionRegistry = require('./collectionRegistry'),
  Cache = require('./cache'),
  Collection = require('./collection');

function App(name) {
  this.collectionRegistry = new CollectionRegistry();
  this.cache = new Cache();
  this.name = name;
}

App.prototype = {
  collection: function(name, opts) {
    opts = opts || {};
    opts.app = this;
    return new Collection(name, opts);
  }
};

module.exports = App;
