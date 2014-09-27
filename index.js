var CollectionRegistry = require('./src/collectionRegistry').CollectionRegistry
    , DescriptorRegistry = require('./src/descriptorRegistry').DescriptorRegistry
    , Collection = require('./src/collection').Collection
    , cache = require('./src/cache')
    , mapping = require('./src/mapping')
    , Mapping = mapping.Mapping
    , notificationCentre = require('./src/notificationCentre').notificationCentre
    , Operation = require('./vendor/operations.js/src/operation').Operation
    , OperationQueue = require('./vendor/operations.js/src/queue').OperationQueue
    , RelationshipType = require('./src/relationship').RelationshipType
    , log = require('./vendor/operations.js/src/log')
    , changes = require('./src/changes')
    , ext = require('./src/ext')
    , error = require('./src/error')
    , _ = require('./src/util')._;

Operation.logLevel = log.Level.warn;
OperationQueue.logLevel = log.Level.warn;


var siesta;
if (typeof module != 'undefined') {
    siesta = module.exports;
}
else {
    siesta = {};
}

siesta.reset = function (inMemory, callback) {
    cache.reset();
    CollectionRegistry.reset();
    DescriptorRegistry.reset();
    //noinspection JSAccessibilityCheck
    index.clearIndexes();
    if (ext.storageEnabled) {
        ext.storage.resetChanges();
        ext.pouch.reset(inMemory, callback);
    }
};

siesta.on = _.bind(notificationCentre.on, notificationCentre);
siesta.addListener = _.bind(notificationCentre.addListener, notificationCentre);
siesta.removeListener = _.bind(notificationCentre.removeListener, notificationCentre);
siesta.once = _.bind(notificationCentre.once, notificationCentre);

siesta.Collection = Collection;
siesta.RelationshipType = RelationshipType;

if (ext.storageEnabled) {
    siesta.setPouch = pouch.setPouch;
}

// Used by modules.
siesta._internal = {
    DescriptorRegistry: DescriptorRegistry,
    log: log,
    Mapping: Mapping,
    util: require('./src/util'),
    Operation: Operation,
    OperationQueue: OperationQueue,
    SiestaModel: require('./src/object').SiestaModel,
    extend: require('extend'),
    cache: cache,
    error: error,
    mapping: mapping
};

siesta.ext = ext;

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

