var CollectionRegistry = require('./src/collectionRegistry').CollectionRegistry
    , DescriptorRegistry = require('./src/descriptorRegistry').DescriptorRegistry
    , Collection = require('./src/collection').Collection
    , cache = require('./src/cache')
    , index = require('./src/index')
    , pouch = require('./src/pouch')
    , notificationCentre = require('./src/notificationCentre').notificationCentre
    , Operation = require('./vendor/operations.js/src/operation').Operation
    , OperationQueue = require('./vendor/operations.js/src/queue').OperationQueue
    , RelationshipType = require('./src/relationship').RelationshipType
    , log = require('./vendor/operations.js/src/log')
    , changes = require('./src/changes')
    , _ = require('./src/util')._;

Operation.logLevel = log.Level.trace;
OperationQueue.logLevel = log.Level.trace;


var siesta;
if (typeof module != 'undefined') {
    siesta = module.exports;
}
else {
    siesta = {};
}

siesta.save = function save(callback) {

};

siesta.reset = function (inMemory, callback) {
    cache.reset();
    CollectionRegistry.reset();
    DescriptorRegistry.reset();
    //noinspection JSAccessibilityCheck
    changes.resetChanges();
    index.clearIndexes();
    pouch.reset(inMemory, callback);
};



siesta.on = _.bind(notificationCentre.on, notificationCentre);
siesta.addListener = _.bind(notificationCentre.addListener, notificationCentre);
siesta.removeListener = _.bind(notificationCentre.removeListener, notificationCentre);
siesta.once = _.bind(notificationCentre.once, notificationCentre);

siesta.Collection = Collection;
siesta.RelationshipType = RelationshipType;

siesta.setPouch = pouch.setPouch;


siesta.collection = function (name, opts) {
    return new Collection(name, opts);
};

Object.defineProperty(siesta, 'isDirty', {
    get: function () {
        return Collection.isDirty
    },
    configurable: true,
    enumerable: true
});


if (typeof window != 'undefined') {
    window.siesta = siesta;
}

