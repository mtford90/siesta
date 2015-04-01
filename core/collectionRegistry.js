var util = require('./util');

function CollectionRegistry() {
  if (!this) return new CollectionRegistry();
  this.collectionNames = [];
}

util.extend(CollectionRegistry.prototype, {
  register: function(collection) {
    var name = collection.name;
    this[name] = collection;
    this.collectionNames.push(name);
  },
  reset: function() {
    var self = this;
    this.collectionNames.forEach(function(name) {
      delete self[name];
    });
    this.collectionNames = [];
  }
});

exports.CollectionRegistry = new CollectionRegistry();