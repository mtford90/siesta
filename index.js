var CollectionRegistry = require('./src/collectionRegistry').CollectionRegistry
    , saveOperation = require('./src/saveOperation')
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

siesta.save = function save(callback) {
    var dirtyCollections = [];
    for (var collName in CollectionRegistry) {
        if (CollectionRegistry.hasOwnProperty(collName)) {
            var coll = CollectionRegistry[collName];
            if (coll.isDirty) dirtyCollections.push(coll);
        }
    }
    var dirtyMappings = _.reduce(dirtyCollections, function (memo, c) {
        _.each(c.__dirtyMappings, function (m) {
            memo.push(m);
        });
        return memo;
    }, []);
    var dirtyObjects = _.reduce(dirtyMappings, function (memo, m) {
        _.each(m.__dirtyObjects, function (o) {memo.push(o)});
        return memo;
    }, []);
    if (dirtyObjects.length) {
        var op = new saveOperation.BulkSaveOperation(dirtyObjects);
        op.onCompletion( function () {
            if (callback) callback(op.error ? op.error : null);
        });
        op.start();
        return op;
    }
    else if (callback) {
        callback();
    }
};

siesta.reset = function (inMemory, callback) {
    cache.reset();
    CollectionRegistry.reset();
    DescriptorRegistry.reset();
    //noinspection JSAccessibilityCheck
    Collection.__clearDirtyCollections();
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

