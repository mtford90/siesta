var collection = require('./src/collection');
var util = require('./src/util');

var CollectionRegistry = require('./src/collectionRegistry').CollectionRegistry,
    Collection = collection.Collection,
    cache = require('./src/cache'),
    Mapping = require('./src/mapping').Mapping,
    notificationCentre = require('./src/notificationCentre').notificationCentre,
    Operation = require('./vendor/operations.js/src/operation').Operation,
    OperationQueue = require('./vendor/operations.js/src/queue').OperationQueue,
    RelationshipType = require('./src/relationship').RelationshipType,
    log = require('./vendor/operations.js/src/log'),
    q = require('q'),
    _ = util._;


Operation.logLevel = log.Level.warn;
OperationQueue.logLevel = log.Level.warn;


var siesta;
if (typeof module != 'undefined') {
    siesta = module.exports;
} else {
    siesta = {};
}

siesta.save = function save(callback) {
    var deferred = q.defer();
    callback = util.constructCallbackAndPromiseHandler(callback, deferred);
    if (siesta.ext.storageEnabled) {
        util.next(function() {
            var mergeChanges = siesta.ext.storage.changes.mergeChanges;
            mergeChanges(callback);
        });
    } else {
        callback('Storage module not installed');
    }
    return deferred.promise;
};

siesta.reset = function() {
    cache.reset();
    CollectionRegistry.reset();
    siesta.ext.http.DescriptorRegistry.reset();
    //noinspection JSAccessibilityCheck
};


siesta.on = _.bind(notificationCentre.on, notificationCentre);
siesta.addListener = _.bind(notificationCentre.addListener, notificationCentre);
siesta.removeListener = _.bind(notificationCentre.removeListener, notificationCentre);
siesta.once = _.bind(notificationCentre.once, notificationCentre);

siesta.Collection = Collection;
siesta.RelationshipType = RelationshipType;

// Used by modules.
var coreChanges = require('./src/changes');

// Make available modules to extensions.
siesta._internal = {
    log: log,
    Mapping: Mapping,
    mapping: require('./src/mapping'),
    error: require('./src/error'),
    ChangeType: coreChanges.ChangeType,
    object: require('./src/object'),
    extend: require('extend'),
    notificationCentre: require('./src/notificationCentre'),
    cache: require('./src/cache'),
    misc: require('./src/misc'),
    Operation: Operation,
    OperationQueue: OperationQueue,
    coreChanges: coreChanges,
    CollectionRegistry: require('./src/collectionRegistry').CollectionRegistry,
    Collection: collection.Collection,
    collection: collection,
    utils: util,
    util: util,
    _: util._,
    query: require('./src/query'),
    store: require('./src/store'),
    q: require('q')
};

siesta.performanceMonitoringEnabled = false;
siesta.httpEnabled = false;
siesta.storageEnabled = false;

siesta.ext = {};

Object.defineProperty(siesta, 'setPouch', {
    get: function() {
        if (siesta.ext.storageEnabled) {
            return siesta.ext.storage.pouch.setPouch;
        }
        return null;
    }
});

Object.defineProperty(siesta.ext, 'storageEnabled', {
    get: function() {
        if (siesta.ext._storageEnabled !== undefined) {
            return siesta.ext._storageEnabled;
        }
        return !!siesta.ext.storage;
    },
    set: function(v) {
        siesta.ext._storageEnabled = v;
    }
});

Object.defineProperty(siesta.ext, 'httpEnabled', {
    get: function() {
        if (siesta.ext._httpEnabled !== undefined) {
            return siesta.ext._httpEnabled;
        }
        return !!siesta.ext.http;
    },
    set: function(v) {
        siesta.ext._httpEnabled = v;
    }
});

siesta.collection = function(name, opts) {
    return new Collection(name, opts);
};

siesta.setAjax = function(ajax) {
    if (siesta.ext.httpEnabled) {
        siesta.ext.http.ajax = ajax;
    } else {
        throw new Error('http module not installed correctly (have you included siesta.http.js?)');
    }
};

siesta.getAjax = function() {
    return siesta.ext.http.ajax;
};

siesta.LogLevel = log.Level;

/**
 * Sets the log level for the named logger
 * @param {String} loggerName
 * @param {String} level
 *
 * @example
 * // Logger used by HTTP request/response descriptors.
 * siesta.setLogLevel('Descriptor', siesta.LogLevel.trace);
 * // Logger used by request descriptors specifically.
 * siesta.setLogLevel('RequestDescriptor', siesta.LogLevel.trace);
 * // Logger used by response descriptors specifically.
 * siesta.setLogLevel('ResponseDescriptor', siesta.LogLevel.trace);
 * // All descriptors are registered in the DescriptorRegistry.
 * siesta.setLogLevel('DescriptorRegistry', siesta.LogLevel.trace);
 * // Logger used by HTTP requests/responses.
 * siesta.setLogLevel('HTTP', siesta.LogLevel.trace);
 * // Objects are cached by local id (_id) or their remote id. This logger is used by the local object cache.
 * siesta.setLogLevel('LocalCache', siesta.LogLevel.trace);
 * // Objects are cached by local id (_id) or their remote id. This logger is used by the remote object cache.
 * siesta.setLogLevel('RemoteCache', siesta.LogLevel.trace);
 * // The logger used by change notifications.
 * siesta.setLogLevel('changes', siesta.LogLevel.trace);
 * // The logger used by the Collection class, which is used to describe a set of mappings.
 * siesta.setLogLevel('Collection', siesta.LogLevel.trace);
 * // The logger used by the Mapping class.
 * siesta.setLogLevel('Mapping', siesta.LogLevel.trace);
 * // The logger used during mapping operations, i.e. mapping data onto the object graph.
 * siesta.setLogLevel('MappingOperation', siesta.LogLevel.trace);
 * // The logger used by the SiestaModel class, which makes up the individual nodes of the object graph.
 * siesta.setLogLevel('SiestaModel', siesta.LogLevel.trace);
 * // The logger used by the performance monitoring extension (siesta.perf.js)
 * siesta.setLogLevel('Performance', siesta.LogLevel.trace);
 * // The logger used during local queries against the object graph.
 * siesta.setLogLevel('Query', siesta.LogLevel.trace);
 * siesta.setLogLevel('Store', siesta.LogLevel.trace);
 * // Much logic in Siesta is tied up in 'Operations'.
 * siesta.setLogLevel('Operation', siesta.LogLevel.trace);
 * // Siesta makes use of queues of operations for managing concurrency and concurrent operation limits.
 * siesta.setLogLevel('OperationQueue', siesta.LogLevel.trace);
 */
siesta.setLogLevel = function(loggerName, level) {
    var Logger = log.loggerWithName(loggerName);
    Logger.setLevel(level);
};

Object.defineProperty(siesta, 'isDirty', {
    get: function() {
        return Collection.isDirty
    },
    configurable: true,
    enumerable: true
});

if (typeof window != 'undefined') {
    window.siesta = siesta;
}

exports.siesta = siesta;