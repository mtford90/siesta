var CollectionRegistry = require('./src/collectionRegistry').CollectionRegistry
    , SaveOperation = require('./src/saveOperation').SaveOperation
    , DescriptorRegistry = require('./src/descriptorRegistry').DescriptorRegistry
    , Collection = require('./src/collection').Collection
    , cache = require('./src/cache')
    , index = require('./src/index')
    , pouch = require('./src/pouch')
    , notificationCentre = require('./src/notificationCentre').notificationCentre
    , Operation = require('./vendor/operations.js/src/operation').Operation;


var siesta;
if (typeof module != 'undefined') {
    siesta = module.exports;
}
else {
    window.siesta = {};
    siesta = window.siesta;
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
        var saveOperations = _.map(dirtyObjects, function (obj) {
            return new SaveOperation(obj);
        });
        var op = new Operation('Save at mapping level', saveOperations, function () {
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

Object.defineProperty(siesta, 'isDirty', {
    get: function () {
        return Collection.isDirty
    },
    configurable: true,
    enumerable: true
});




