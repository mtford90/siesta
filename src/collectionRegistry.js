var _ = require('./util')._;

function CollectionRegistry() {
    if (!this) return new CollectionRegistry();
    this.collectionNames = [];
}

CollectionRegistry.prototype.register = function (collection) {
    var name = collection._name;
    this[name] = collection;
    this.collectionNames.push(name);
    dump(this);
};

CollectionRegistry.prototype.reset = function () {
    dump('reset');
    var self = this;
    _.each(this.collectionNames, function (name) {
        delete self[name];
    });
    this.collectionNames = [];
};

exports.CollectionRegistry = new CollectionRegistry();