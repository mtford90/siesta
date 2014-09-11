var log = require('../vendor/operations.js/src/log');
var Logger = log.loggerWithName('cache');
Logger.setLevel(log.Level.warn);
var RestError = require('./error').RestError;

/**
 * Cache by pouch _id.
 * @type {{}}
 */
var localCache = {};

/**
 * Cache by type and whatever id was specified in the mapping.
 * @type {{}}
 */
var remoteCache = {};

function reset() {
    remoteCache = {};
    localCache = {};
}

reset();

function getViaLocalId(localId) {
    var obj = localCache[localId];
    if (obj) {
        if (Logger.debug.isEnabled)
            Logger.debug('Local cache hit: ' + obj._dump(true));
    }
    else {
        if (Logger.debug.isEnabled)
            Logger.debug('Local cache miss: ' + localId);
    }
    return  obj;
}

function getSingleton(mapping) {
    var type = mapping.type;
    var collection = mapping.collection;
    var collectionCache = remoteCache[collection];
    if (collectionCache) {
        var typeCache = collectionCache[type];
        if (typeCache) {
            var objs = [];
            for (var prop in typeCache) {
                if (typeCache.hasOwnProperty(prop)) {
                    objs.push(typeCache[prop]);
                }
            }
            if (objs.length > 1) {
                throw RestError('A singleton mapping has more than 1 object in the cache! This is a serious error. ' +
                    'Either a mapping has been modified after objects have already been created, or something has gone' +
                    'very wrong. Please file a bug report if the latter.');
            }
            else if (objs.length) {
                return objs[0];
            }
        }
    }
    return null;
}

function getViaRemoteId(remoteId, opts) {
    var type = opts.mapping.type;
    var collection = opts.mapping.collection;
    var collectionCache = remoteCache[collection];
    if (collectionCache) {
        var typeCache = remoteCache[collection][type];
        if (typeCache) {
            var obj = typeCache[remoteId];
            if (obj) {
                if (Logger.debug.isEnabled)
                    Logger.debug('Remote cache hit: ' + obj._dump(true));
            }
            else {
                if (Logger.debug.isEnabled)
                    Logger.debug('Remote cache miss: ' + remoteId);
            }
            return  obj;
        }
    }
    if (Logger.debug.isEnabled)
        Logger.debug('Remote cache miss: ' + remoteId);
    return null;
}

function remoteInsert(obj, remoteId, previousRemoteId) {
    if (obj) {
        var collection = obj.mapping.collection;
        if (collection) {
            if (!remoteCache[collection]) {
                remoteCache[collection] = {};
            }
            var type = obj.mapping.type;
            if (type) {
                if (!remoteCache[collection][type]) {
                    remoteCache[collection][type] = {};
                }
                if (previousRemoteId) {
                    remoteCache[collection][type][previousRemoteId] = null;
                }
                var cachedObject = remoteCache[collection][type][remoteId];
                if (!cachedObject) {
                    remoteCache[collection][type][remoteId] = obj;
                    if (Logger.debug.isEnabled)
                        Logger.debug('Remote cache insert: ' + obj._dump(true));
                    if (Logger.trace.isEnabled)
                        Logger.trace('Remote cache now looks like: ' + remoteDump(true))
                }
                else {
                    // Something has gone really wrong. Only one object for a particular collection/type/remoteid combo
                    // should ever exist.
                    if (obj != cachedObject) {
                        var message = 'Object ' + collection.toString() + ':' + type.toString() + '[' + obj.mapping.id + '="' + remoteId + '"] already exists in the cache.' +
                            ' This is a serious error, please file a bug report if you are experiencing this out in the wild';
                        Logger.error(message);
                        throw new RestError(message);
                    }
                    else {
                        if (Logger.debug.isEnabled)
                            Logger.debug('Object has already been inserted: ' + obj._dump(true));
                    }

                }
            }
            else {
                throw new RestError('Mapping has no type', {mapping: obj.mapping, obj: obj});
            }
        }
        else {
            throw new RestError('Mapping has no collection', {mapping: obj.mapping, obj: obj});
        }
    }
    else {
        var msg = 'Must pass an object when inserting to cache';
        Logger.error(msg);
        throw new RestError(msg);
    }

}

function remoteDump(asJson) {
    var dumpedRestCache = {};
    for (var coll in remoteCache) {
        if (remoteCache.hasOwnProperty(coll)) {
            var dumpedCollCache = {};
            dumpedRestCache[coll] = dumpedCollCache;
            var collCache = remoteCache[coll];
            for (var mapping in collCache) {
                if (collCache.hasOwnProperty(mapping)) {
                    var dumpedMappingCache = {};
                    dumpedCollCache[mapping] = dumpedMappingCache;
                    var mappingCache = collCache[mapping];
                    for (var remoteId in mappingCache) {
                        if (mappingCache.hasOwnProperty(remoteId)) {
                            if (mappingCache[remoteId]) {
                                dumpedMappingCache[remoteId] = mappingCache[remoteId]._dump();
                            }
                        }
                    }
                }
            }
        }
    }
    return asJson ? JSON.stringify(dumpedRestCache, null, 4) : dumpedRestCache;

}

function localDump(asJson) {
    var dumpedIdCache = {};
    for (var id in localCache) {
        if (localCache.hasOwnProperty(id)) {
            dumpedIdCache[id] = localCache[id]._dump()
        }
    }
    return asJson ? JSON.stringify(dumpedIdCache, null, 4) : dumpedIdCache;
}

function dump(asJson) {
    var dumped = {
        idCache: localDump(),
        restCache: remoteDump()
    };
    return asJson ? JSON.stringify(dumped, null, 4) : dumped;
}

function _remoteCache() {
    return remoteCache
}

function _localCache() {
    return localCache;
}

function get(opts) {
    var obj, idField, remoteId;
    var localId = opts._id;
    if (localId) {
        obj = getViaLocalId(localId);
        if (obj) {
            return obj;
        }
        else {
            if (opts.mapping) {
                idField = opts.mapping.id;
                remoteId = opts[idField];
                return getViaRemoteId(remoteId, opts);
            }
            else {
                return null;
            }
        }
    }
    else if (opts.mapping) {
        idField = opts.mapping.id;
        remoteId = opts[idField];
        if (remoteId) {
            return getViaRemoteId(remoteId, opts);
        }
        else if (opts.mapping.singleton) {
            return getSingleton(opts.mapping);
        }
    }
    Logger.warn('Invalid opts to cache', {opts: opts});
    return null;
}


function insert(obj) {
    if (obj._id) {
        if (!localCache[obj._id]) {
            if (Logger.debug.isEnabled)
                Logger.debug('Local cache insert: ' + obj._dump(true));
            localCache[obj._id] = obj;
            if (Logger.trace.isEnabled)
                Logger.trace('Local cache now looks like: ' + localDump(true));
        }
        else {
            // Something has gone badly wrong here. Two objects should never exist with the same _id
            if (localCache[obj._id] != obj) {
                var message = 'Object with _id="' + obj._id.toString() + '" is already in the cache. ' +
                    'This is a serious error. Please file a bug report if you are experiencing this out in the wild';
                Logger.error(message);
                throw new RestError(message);
            }
        }
    }
    var idField = obj.idField;
    var remoteId = obj[idField];
    if (remoteId) {
        remoteInsert(obj, remoteId);
    }
    else {
        if (Logger.debug.isEnabled)
            Logger.debug('No remote id ("' + idField + '") so wont be placing in the remote cache', obj);
    }
}


function dump(asJson) {
    var dumped = {
        idCache: localDump(),
        restCache: remoteDump()
    };
    return asJson ? JSON.stringify(dumped, null, 4) : dumped;
}


exports._remoteCache = _remoteCache;
exports._localCache = _localCache;
exports.get = get;
exports.insert = insert;
exports.remoteInsert = remoteInsert;
exports.reset = reset;
exports._dump = dump;









