//var operations = require('vendor/operations.js/src/index.js');


var siesta = {
//    Operation: operations.Operation,
//    OperationQueue: operations.OperationQueue,
    Logger: require('./vendor/operations.js/src/log'),
    RestError: require('./src/error').RestError,
    cache: require('./src/cache'),
    DescriptorRegistry: require('./src/descriptorRegistry').DescriptorRegistry,
    CollectionRegistry: require('./src/collectionRegistry').CollectionRegistry,
    Descriptor: require('./src/descriptor').Descriptor,
    Collection: require('./src/collection').Collection,
    RequestDescriptor: require('./src/requestDescriptor').RequestDescriptor,
    ResponseDescriptor: require('./src/responseDescriptor').ResponseDescriptor,
    serialiser: require('./src/serialiser'),
    PouchAdapter: require('./src/pouch'),
    Pouch: require('./src/pouch'),
    BaseOperation: require('./src/baseOperation').BaseOperation,
    CompositeOperation: require('./src/baseOperation').CompositeOperation,
    SaveOperation: require('./src/saveOperation').SaveOperation,
    MappingOperation: require('./src/mappingOperation').MappingOperation,
    defineSubProperty: require('./src/misc').defineSubProperty,
    wrappedCallback: require('./src/misc').wrappedCallback,
    Index: require('./src/index').Index,
    index: require('./src/index'),
    RawQuery: require('./src/rawQuery').RawQuery,
    Query: require('./src/query').Query,
    RelationshipType: require('./src/relationship').RelationshipType,
    RelatedObjectProxy: require('./src/relationship').RelatedObjectProxy,
    Relationship: require('./src/relationship').Relationship,
    foreignKeyRelationship: require('./src/foreignKeyRelationship').ForeignKeyRelationship,
    ForeignKeyRelationship: require('./src/foreignKeyRelationship').ForeignKeyRelationship,
    OneToOneRelationship: require('./src/oneToOneRelationship').OneToOneRelationship,
    RestObject: require('./src/object').RestObject,
    Store: require('./src/store'),
    Mapping: require('./src/mapping').Mapping,
    guid: require('./src/misc').guid,
    NotificationCentre: require('./src/notifications').NotificationCentre
};

siesta.save = function save (callback) {
    var dirtyCollections = [];
    var CollectionRegistry = siesta.CollectionRegistry;
    var SaveOperation = siesta.SaveOperation;
    var CompositeOperation = siesta.CompositeOperation;
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
        var op = new CompositeOperation('Save at mapping level', saveOperations, function () {
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
    siesta.cache.reset();
    siesta.CollectionRegistry.reset();
    siesta.DescriptorRegistry.reset();
    siesta.Collection.__clearDirtyCollections();
    siesta.index.clearIndexes();
    siesta.Pouch.reset(inMemory, callback);
};

try {
    for (var prop in siesta) {
        if (siesta.hasOwnProperty(prop)) {
            exports[prop] = siesta[prop];
            Object.defineProperty(exports, 'isDirty', {
                get: function () {
                    return siesta.Collection.isDirty
                },
                configurable: true,
                enumerable: true
            });
        }
    }
}
catch (err) {
    window.siesta = siesta;
    Object.defineProperty(window.siesta, 'isDirty', {
        get: function () {
            return siesta.Collection.isDirty
        },
        configurable: true,
        enumerable: true
    });
}