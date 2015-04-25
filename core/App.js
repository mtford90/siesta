var CollectionRegistry = require('./collectionRegistry'),
  cache = require('./cache'),
  Collection = require('./collection');

function App(name) {
  this.collectionRegistry = new CollectionRegistry();
  this.cache = cache;
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
