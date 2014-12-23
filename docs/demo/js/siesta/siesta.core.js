(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/**
 * This is an in-memory cache for models. Models are cached by local id (_id) and remote id (defined by the mapping).
 * Lookups are performed against the cache when mapping.
 * @module cache
 */
var log = require('./operation/log')
    , InternalSiestaError = require('./error').InternalSiestaError
    , util = require('./util');


var LocalCacheLogger = log.loggerWithName('LocalCache')
    , RemoteCacheLogger = log.loggerWithName('RemoteCache');
RemoteCacheLogger.setLevel(log.Level.warn);
LocalCacheLogger.setLevel(log.Level.warn);


var localCacheById,
    localCache,
    remoteCache;

/**
 * Clear out the cache.
 */
function reset() {
    remoteCache = {};
    localCacheById = {};
    localCache = {};
}

reset();

/**
 * Return the object in the cache given a local id (_id)
 * @param  {String} localId
 * @return {ModelInstance}
 */
function getViaLocalId(localId) {
    var obj = localCacheById[localId];
    if (obj) {
        if (LocalCacheLogger.debug.isEnabled)
            LocalCacheLogger.debug('Local cache hit: ' + obj._dump(true));
    } else {
        if (LocalCacheLogger.debug.isEnabled)
            LocalCacheLogger.debug('Local cache miss: ' + localId);
    }
    return obj;
}

/**
 * Return the singleton object given a singleton mapping.
 * @param  {Mapping} mapping
 * @return {ModelInstance}
 */
function getSingleton(mapping) {
    var mappingName = mapping.type;
    var collectionName = mapping.collection;
    var collectionCache = localCache[collectionName];
    if (collectionCache) {
        var typeCache = collectionCache[mappingName];
        if (typeCache) {
            var objs = [];
            for (var prop in typeCache) {
                if (typeCache.hasOwnProperty(prop)) {
                    objs.push(typeCache[prop]);
                }
            }
            if (objs.length > 1) {
                throw new InternalSiestaError('A singleton mapping has more than 1 object in the cache! This is a serious error. ' +
                'Either a mapping has been modified after objects have already been created, or something has gone' +
                'very wrong. Please file a bug report if the latter.');
            } else if (objs.length) {
                return objs[0];
            }
        }
    }
    return null;
}

/**
 * Given a remote identifier and an options object that describes mapping/collection,
 * return the model if cached.
 * @param  {String} remoteId
 * @param  {Object} opts
 * @return {ModelInstance}
 */
function getViaRemoteId(remoteId, opts) {
    var type = opts.mapping.type;
    var collection = opts.mapping.collection;
    var collectionCache = remoteCache[collection];
    if (collectionCache) {
        var typeCache = remoteCache[collection][type];
        if (typeCache) {
            var obj = typeCache[remoteId];
            if (obj) {
                if (RemoteCacheLogger.debug.isEnabled)
                    RemoteCacheLogger.debug('Remote cache hit: ' + obj._dump(true));
            } else {
                if (RemoteCacheLogger.debug.isEnabled)
                    RemoteCacheLogger.debug('Remote cache miss: ' + remoteId);
            }
            return obj;
        }
    }
    if (RemoteCacheLogger.debug.isEnabled)
        RemoteCacheLogger.debug('Remote cache miss: ' + remoteId);
    return null;
}

/**
 * Insert an objet into the cache using a remote identifier defined by the mapping.
 * @param  {ModelInstance} obj
 * @param  {String} remoteId
 * @param  {String} previousRemoteId If remote id has been changed, this is the old remote identifier
 */
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
                    if (RemoteCacheLogger.debug.isEnabled)
                        RemoteCacheLogger.debug('Remote cache insert: ' + obj._dump(true));
                    if (RemoteCacheLogger.trace.isEnabled)
                        RemoteCacheLogger.trace('Remote cache now looks like: ' + remoteDump(true))
                } else {
                    // Something has gone really wrong. Only one object for a particular collection/type/remoteid combo
                    // should ever exist.
                    if (obj != cachedObject) {
                        var message = 'Object ' + collection.toString() + ':' + type.toString() + '[' + obj.mapping.id + '="' + remoteId + '"] already exists in the cache.' +
                            ' This is a serious error, please file a bug report if you are experiencing this out in the wild';
                        RemoteCacheLogger.error(message, {
                            obj: obj,
                            cachedObject: cachedObject
                        });
                        util.printStackTrace();
                        throw new InternalSiestaError(message);
                    } else {
                        if (RemoteCacheLogger.debug.isEnabled)
                            RemoteCacheLogger.debug('Object has already been inserted: ' + obj._dump(true));
                    }

                }
            } else {
                throw new InternalSiestaError('Mapping has no type', {
                    mapping: obj.mapping,
                    obj: obj
                });
            }
        } else {
            throw new InternalSiestaError('Mapping has no collection', {
                mapping: obj.mapping,
                obj: obj
            });
        }
    } else {
        var msg = 'Must pass an object when inserting to cache';
        RemoteCacheLogger.error(msg);
        throw new InternalSiestaError(msg);
    }
}

/**
 * Dump the remote id cache
 * @param  {boolean} asJson Whether or not to apply JSON.stringify
 * @return {String|Object}
 */
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

/**
 * Dump the local id (_id) cache
 * @param  {boolean} asJson Whether or not to apply JSON.stringify
 * @return {String|Object}
 */
function localDump(asJson) {
    var dumpedIdCache = {};
    for (var id in localCacheById) {
        if (localCacheById.hasOwnProperty(id)) {
            dumpedIdCache[id] = localCacheById[id]._dump()
        }
    }
    return asJson ? JSON.stringify(dumpedIdCache, null, 4) : dumpedIdCache;
}

/**
 * Dump to the cache.
 * @param  {boolean} asJson Whether or not to apply JSON.stringify
 * @return {String|Object}
 */
function dump(asJson) {
    var dumped = {
        localCache: localDump(),
        remoteCache: remoteDump()
    };
    return asJson ? JSON.stringify(dumped, null, 4) : dumped;
}

function _remoteCache() {
    return remoteCache
}

function _localCache() {
    return localCacheById;
}

/**
 * Query the cache
 * @param  {Object} opts Object describing the query
 * @return {ModelInstance}
 * @example
 * ```js
 * cache.get({_id: '5'}); // Query by local id
 * cache.get({remoteId: '5', mapping: myMapping}); // Query by remote id
 * ```
 */
function get(opts) {
    if (LocalCacheLogger.debug.isEnabled) LocalCacheLogger.debug('get', opts);
    var obj, idField, remoteId;
    var localId = opts._id;
    if (localId) {
        obj = getViaLocalId(localId);
        if (obj) {
            return obj;
        } else {
            if (opts.mapping) {
                idField = opts.mapping.id;
                remoteId = opts[idField];
                if (LocalCacheLogger.debug.isEnabled) LocalCacheLogger.debug(idField + '=' + remoteId);
                return getViaRemoteId(remoteId, opts);
            } else {
                return null;
            }
        }
    } else if (opts.mapping) {
        idField = opts.mapping.id;
        remoteId = opts[idField];
        if (remoteId) {
            return getViaRemoteId(remoteId, opts);
        } else if (opts.mapping.singleton) {
            return getSingleton(opts.mapping);
        }
    } else {
        LocalCacheLogger.warn('Invalid opts to cache', {
            opts: opts
        });
    }
    return null;
}

/**
 * Insert an object into the cache.
 * @param  {ModelInstance} obj
 * @throws {InternalSiestaError} An object with _id/remoteId already exists. Not thrown if same obhect.
 */
function insert(obj) {
    var localId = obj._id;
    if (localId) {
        var collectionName = obj.mapping.collection;
        var mappingName = obj.mapping.type;
        if (!localCacheById[localId]) {
            if (LocalCacheLogger.debug.isEnabled)
                LocalCacheLogger.debug('Local cache insert: ' + obj._dump(true));
            localCacheById[localId] = obj;
            if (LocalCacheLogger.trace.isEnabled)
                LocalCacheLogger.trace('Local cache now looks like: ' + localDump(true));
            if (!localCache[collectionName]) localCache[collectionName] = {};
            if (!localCache[collectionName][mappingName]) localCache[collectionName][mappingName] = {};
            localCache[collectionName][mappingName][localId] = obj;
        } else {
            // Something has gone badly wrong here. Two objects should never exist with the same _id
            if (localCacheById[localId] != obj) {
                var message = 'Object with _id="' + localId.toString() + '" is already in the cache. ' +
                    'This is a serious error. Please file a bug report if you are experiencing this out in the wild';
                LocalCacheLogger.error(message);
                throw new InternalSiestaError(message);
            }
        }
    }
    var idField = obj.idField;
    var remoteId = obj[idField];
    if (remoteId) {
        remoteInsert(obj, remoteId);
    } else {
        if (RemoteCacheLogger.debug.isEnabled)
            RemoteCacheLogger.debug('No remote id ("' + idField + '") so wont be placing in the remote cache', obj);
    }
}

/**
 * Returns true if object is in the cache
 * @param  {ModelInstance} obj
 * @return {boolean}
 */
function contains(obj) {
    var q = {
        _id: obj._id
    };
    var mapping = obj.mapping;
    if (mapping.id) {
        if (obj[mapping.id]) {
            q.mapping = mapping;
            q[mapping.id] = obj[mapping.id];
        }
    }
    return !!get(q);
}

/**
 * Removes the object from the cache (if it's actually in the cache) otherwises throws an error.
 * @param  {ModelInstance} obj
 * @throws {InternalSiestaError} If object already in the cache.
 */
function remove(obj) {
    if (contains(obj)) {
        var collectionName = obj.mapping.collection;
        var mappingName = obj.mapping.type;
        var _id = obj._id;
        if (!mappingName) throw InternalSiestaError('No mapping name');
        if (!collectionName) throw InternalSiestaError('No collection name');
        if (!_id) throw InternalSiestaError('No _id');
        delete localCache[collectionName][mappingName][_id];
        delete localCacheById[_id];
        if (obj.mapping.id) {
            var remoteId = obj[obj.mapping.id];
            delete remoteCache[collectionName][mappingName][remoteId];
        }
    } else {
        throw new InternalSiestaError('Object was not in cache.');
    }
}


exports._remoteCache = _remoteCache;
exports._localCache = _localCache;
Object.defineProperty(exports, '_localCacheByType', {
    get: function () {
        return localCache;
    }
});
exports.get = get;
exports.insert = insert;
exports.remoteInsert = remoteInsert;
exports.reset = reset;
exports._dump = dump;
exports.contains = contains;
exports.remove = remove;
},{"./error":5,"./operation/log":13,"./util":21}],2:[function(require,module,exports){
/**
 * The changes module deals with changes to ModelInstance instances. In the in-memory case this
 * just means that notifications are sent on any change. If the storage module is being used,
 * the changes module is extended to deal with merging changes into whatever persistant storage
 * method is being used.
 * @module changes
 */

var defineSubProperty = require('./util').defineSubProperty
    , notificationCentre = require('./notificationCentre').notificationCentre
    , InternalSiestaError = require('./error').InternalSiestaError
    , log = require('./operation/log')
    , collectionRegistry = require('./collectionRegistry').CollectionRegistry;

var Logger = log.loggerWithName('changes');
Logger.setLevel(log.Level.warn);

/**
 * Constants that describe change events.
 * Set => A new value is assigned to an attribute/relationship
 * Splice => All javascript array operations are described as splices.
 * Delete => Used in the case where objects are removed from an array, but array order is not known in advance.
 * Remove => Object deletion events
 * New => Object creation events
 * @type {Object}
 */
var ChangeType = {
    Set: 'Set',
    Splice: 'Splice',
    Delete: 'Delete',
    New: 'New',
    Remove: 'Remove'
};

/**
 * Represents an individual change.
 * @param opts
 * @constructor
 */
function Change(opts) {
    this._opts = opts;
    if (!this._opts) {
        this._opts = {};
    }
    defineSubProperty.call(this, 'collection', this._opts);
    defineSubProperty.call(this, 'mapping', this._opts);
    defineSubProperty.call(this, '_id', this._opts);
    defineSubProperty.call(this, 'field', this._opts);
    defineSubProperty.call(this, 'type', this._opts);
    defineSubProperty.call(this, 'index', this._opts);
    defineSubProperty.call(this, 'added', this._opts);
    defineSubProperty.call(this, 'addedId', this._opts);
    defineSubProperty.call(this, 'removed', this._opts);
    defineSubProperty.call(this, 'removedId', this._opts);
    defineSubProperty.call(this, 'new', this._opts);
    defineSubProperty.call(this, 'newId', this._opts);
    defineSubProperty.call(this, 'old', this._opts);
    defineSubProperty.call(this, 'oldId', this._opts);
    defineSubProperty.call(this, 'obj', this._opts);
}

Change.prototype._dump = function (json) {
    var dumped = {};
    dumped.collection = (typeof this.collection) == 'string' ? this.collection : this.collection._dump();
    dumped.mapping = (typeof this.mapping) == 'string' ? this.mapping : this.mapping.type;
    dumped._id = this._id;
    dumped.field = this.field;
    dumped.type = this.type;
    if (this.index) dumped.index = this.index;
    if (this.added) dumped.added = _.map(this.added, function (x) {return x._dump()});
    if (this.removed) dumped.removed = _.map(this.removed, function (x) {return x._dump()});
    if (this.old) dumped.old = this.old;
    if (this.new) dumped.new = this.new;
    return json ? JSON.stringify(dumped, null, 4) : dumped;
};

/**
 * Broadcas
 * @param  {String} collectionName
 * @param  {String} mappingName
 * @param  {Object} c an options dictionary representing the change
 * @return {[type]}
 */
function broadcast(collectionName, mappingName, c) {
    if (Logger.trace.isEnabled) Logger.trace('Sending notification "' + collectionName + '" of type ' + c.type);
    notificationCentre.emit(collectionName, c);
    var mappingNotif = collectionName + ':' + mappingName;
    if (Logger.trace.isEnabled) Logger.trace('Sending notification "' + mappingNotif + '" of type ' + c.type);
    notificationCentre.emit(mappingNotif, c);
    var genericNotif = 'Siesta';
    if (Logger.trace.isEnabled) Logger.trace('Sending notification "' + genericNotif + '" of type ' + c.type);
    notificationCentre.emit(genericNotif, c);
    var localIdNotif = c._id;
    if (Logger.trace.isEnabled) Logger.trace('Sending notification "' + localIdNotif + '" of type ' + c.type);
    notificationCentre.emit(localIdNotif, c);
    var collection = collectionRegistry[collectionName];
    var err;
    if (!collection) {
        err = 'No such collection "' + collectionName + '"';
        Logger.error(err, collectionRegistry);
        throw new InternalSiestaError(err);
    }
    var mapping = collection[mappingName];
    if (!mapping) {
        err = 'No such mapping "' + mappingName + '"';
        Logger.error(err, collectionRegistry);
        throw new InternalSiestaError(err);
    }
    if (mapping.id && c.obj[mapping.id]) {
        var remoteIdNotif = collectionName + ':' + mappingName + ':' + c.obj[mapping.id];
        if (Logger.trace.isEnabled) Logger.trace('Sending notification "' + remoteIdNotif + '" of type ' + c.type);
        notificationCentre.emit(remoteIdNotif, c);
    }
}

/**
 * Throw an error if the change is incorrect.
 * @param changeOpts
 * @throws {InternalSiestaError} If change options are invalid
 */
function validateChange(changeOpts) {
    if (!changeOpts.mapping) throw new InternalSiestaError('Must pass a mapping');
    if (!changeOpts.collection) throw new InternalSiestaError('Must pass a collection');
    if (!changeOpts._id) throw new InternalSiestaError('Must pass a local identifier');
    if (!changeOpts.obj) throw new InternalSiestaError('Must pass the object');
}

/**
 * Register that a change has been made.
 * @param opts
 * @return {Change} The constructed change
 */
function registerChange(opts) {
    validateChange(opts);
    var collection = opts.collection;
    var mapping = opts.mapping;
    var c = new Change(opts);
    broadcast(collection, mapping, c);
    return c;
}

exports.Change = Change;
exports.registerChange = registerChange;
exports.validateChange = validateChange;
exports.ChangeType = ChangeType;
},{"./collectionRegistry":4,"./error":5,"./notificationCentre":10,"./operation/log":13,"./util":21}],3:[function(require,module,exports){
/**
 * @module collection
 */

var log = require('./operation/log');
var Logger = log.loggerWithName('Collection');
Logger.setLevel(log.Level.warn);

var CollectionRegistry = require('./collectionRegistry').CollectionRegistry;
var Operation = require('./operation/operation').Operation;
var InternalSiestaError = require('./error').InternalSiestaError;
var Mapping = require('./mapping').Mapping;
var extend = require('extend');
var observe = require('../vendor/observe-js/src/observe').Platform;

var util = require('./util');
var _ = util._;

var cache = require('./cache');

var SAFE_METHODS = ['GET', 'HEAD', 'TRACE', 'OPTIONS', 'CONNECT'];
var UNSAFE_METHODS = ['PUT', 'PATCH', 'POST', 'DELETE'];

/**
 * A collection describes a set of models and optionally a REST API which we would
 * like to model.
 *
 * @param name
 * @constructor
 *
 *
 * @example
 * ```js
 * var GitHub = new siesta.Collection('GitHub')
 * // ... configure mappings, descriptors etc ...
 * GitHub.install(function () {
 *     // ... carry on.
 * });
 * ```
 */
function Collection(name) {
    var self = this;
    if (!name) throw new Error('Collection must have a name');
    this._name = name;
    this._docId = 'Collection_' + this._name;
    this._rawMappings = {};
    this._mappings = {};
    /**
     * The URL of the API e.g. http://api.github.com
     * @type {string}
     */
    this.baseURL = '';

    /**
     * Set to true if installation has succeeded. You cannot use the collectio
     * @type {boolean}
     */
    this.installed = false;
    CollectionRegistry.register(this);

    /**
     *
     * @type {string}
     */
    Object.defineProperty(this, 'name', {
        get: function () {
            return self._name;
        }
    });
}


_.extend(Collection.prototype, {
    /**
     * Ensure mappings are installed.
     * @param callback
     * @class Collection
     */
    install: function (callback) {
        var deferred = window.q ? window.q.defer() : null;
        var self = this;
        if (!this.installed) {
            var mappingsToInstall = [];
            for (var name in this._mappings) {
                if (this._mappings.hasOwnProperty(name)) {
                    var mapping = this._mappings[name];
                    mappingsToInstall.push(mapping);
                }
            }
            if (Logger.info.isEnabled)
                Logger.info('There are ' + mappingsToInstall.length.toString() + ' mappings to install');
            if (mappingsToInstall.length) {
                var operations = _.map(mappingsToInstall, function (m) {
                    return new Operation('Install Mapping', _.bind(m.install, m));
                });
                var op = new Operation('Install Mappings', operations);
                op.completion = function () {
                    if (op.failed) {
                        Logger.error('Failed to install collection', op.error);
                        self._finaliseInstallation(op.error, callback);
                    } else {
                        self.installed = true;
                        var errors = [];
                        _.each(mappingsToInstall, function (m) {
                            if (Logger.info.isEnabled)
                                Logger.info('Installing relationships for mapping with name "' + m.type + '"');
                            var err = m.installRelationships();
                            if (err) errors.push(err);
                        });
                        if (!errors.length) {
                            _.each(mappingsToInstall, function (m) {
                                if (Logger.info.isEnabled)
                                    Logger.info('Installing reverse relationships for mapping with name "' + m.type + '"');
                                var err = m.installReverseRelationships();
                                if (err) errors.push(err);
                            });
                        }
                        var err;
                        if (errors.length == 1) {
                            err = errors[0];
                        } else if (errors.length) {
                            err = errors;
                        }
                        self._finaliseInstallation(err, callback);
                    }
                };
                op.start();
            } else {
                self._finaliseInstallation(null, callback);
            }
        } else {
            var err = new InternalSiestaError('Collection "' + this._name + '" has already been installed');
            self._finaliseInstallation(err, callback);
        }
        return deferred ? deferred.promise : null;
    },

    /**
     * Mark this collection as installed, and place the collection on the global Siesta object.
     * @param  {Object}   err
     * @param  {Function} callback
     * @class Collection
     */
    _finaliseInstallation: function (err, callback) {
        if (!err) {
            this.installed = true;
            var index = require('./index');
            index[this._name] = this;
        }
        if (callback) callback(err);
    },
    /**
     * Given the name of a mapping and an options object describing the mapping, creating a Mapping
     * object, install it and return it.
     * @param  {String} name
     * @param  {Object} opts
     * @return {Mapping}
     * @class Collection
     */
    _model: function (name, opts) {
        if (name) {
            this._rawMappings[name] = opts;
            opts = extend(true, {}, opts);
            opts.type = name;
            opts.collection = this._name;
            var mappingObject = new Mapping(opts);
            this._mappings[name] = mappingObject;
            this[name] = mappingObject;
            return mappingObject;
        } else {
            throw new Error('No name specified when creating mapping');
        }
    },


    /**
     * Registers a mapping with this collection.
     * @param {String|Object} optsOrName An options object or the name of the mapping. Must pass options as second param if specify name.
     * @param {Object} opts Options if name already specified.
     * @return {Mapping}
     * @class Collection
     */
    mapping: function () {
        var self = this;
        if (arguments.length) {
            if (arguments.length == 1) {
                if (util.isArray(arguments[0])) {
                    return _.map(arguments[0], function (m) {
                        return self._model(m.name, m);
                    });
                } else {
                    return this._model(arguments[0].name, arguments[0]);
                }
            } else {
                if (typeof arguments[0] == 'string') {
                    return this._model(arguments[0], arguments[1]);
                } else {
                    return _.map(arguments, function (m) {
                        return self._model(m.name, m);
                    });
                }
            }
        }
        return null;
    },

    descriptor: function (opts) {
        var descriptors = [];
        if (siesta.ext.httpEnabled) {
            opts.collection = this;
            var methods = siesta.ext.http._resolveMethod(opts.method);
            var unsafe = [];
            var safe = [];
            for (var i = 0; i < methods.length; i++) {
                var m = methods[i];
                if (UNSAFE_METHODS.indexOf(m) > -1) {
                    unsafe.push(m);
                } else {
                    safe.push(m);
                }
            }
            if (unsafe.length) {
                var requestDescriptor = extend({}, opts);
                requestDescriptor.method = unsafe;
                requestDescriptor = new siesta.ext.http.RequestDescriptor(requestDescriptor);
                siesta.ext.http.DescriptorRegistry.registerRequestDescriptor(requestDescriptor);
                descriptors.push(requestDescriptor);
            }
            if (safe.length) {
                var responseDescriptor = extend({}, opts);
                responseDescriptor.method = safe;
                responseDescriptor = new siesta.ext.http.ResponseDescriptor(responseDescriptor);
                siesta.ext.http.DescriptorRegistry.registerResponseDescriptor(responseDescriptor);
                descriptors.push(responseDescriptor);
            }
        } else {
            throw new Error('HTTP module not installed.');
        }
        return descriptors;
    },

    /**
     * Dump this collection as JSON
     * @param  {Boolean} asJson Whether or not to apply JSON.stringify
     * @return {String|Object}
     * @class Collection
     */
    _dump: function (asJson) {
        var obj = {};
        obj.installed = this.installed;
        obj.docId = this._docId;
        obj.name = this._name;
        obj.baseURL = this.baseURL;
        return asJson ? JSON.stringify(obj, null, 4) : obj;
    },

    _http: function (method) {
        if (siesta.ext.httpEnabled) {
            var args = Array.prototype.slice.call(arguments, 1);
            args.unshift(this);
            var f = siesta.ext.http[method];
            f.apply(f, args);
        } else {
            throw new Error('HTTP module not installed.');
        }
    },

    /**
     * Send a GET request
     * @param {String} path The path to the resource we want to GET
     * @param {Object|Function} optsOrCallback Either an options object or a callback if can use defaults
     * @param {Function} callback Callback if opts specified.
     * @package HTTP
     * @returns {Promise}
     */
    GET: function () {
        return _.partial(this._http, 'GET').apply(this, arguments);
    },

    /**
     * Send a OPTIONS request
     * @param {String} path The path to the resource to which we want to send an OPTIONS request
     * @param {Object|Function} optsOrCallback Either an options object or a callback if can use defaults
     * @param {Function} callback Callback if opts specified.
     * @returns {Promise}
     */
    OPTIONS: function () {
        return _.partial(this._http, 'OPTIONS').apply(this, arguments);
    },

    /**
     * Send a TRACE request
     * @param {path} path The path to the resource to which we want to send a TRACE request
     * @param {Object|Function} optsOrCallback Either an options object or a callback if can use defaults
     * @param {Function} callback Callback if opts specified.
     * @returns {Promise}
     */
    TRACE: function () {
        return _.partial(this._http, 'TRACE').apply(this, arguments);
    },

    /**
     * Send a HEAD request
     * @param {String} path The path to the resource to which we want to send a HEAD request
     * @param {Object|Function} optsOrCallback Either an options object or a callback if can use defaults
     * @param {Function} callback Callback if opts specified.
     * @returns {Promise}
     */
    HEAD: function () {
        return _.partial(this._http, 'HEAD').apply(this, arguments);
    },

    /**
     * Send a POST request
     * @param {String} path The path to the resource to which we want to send a POST request
     * @param {ModelInstance} model The model that we would like to POST
     * @param {Object|Function} optsOrCallback Either an options object or a callback if can use defaults
     * @param {Function} callback Callback if opts specified.
     * @returns {Promise}
     */
    POST: function () {
        return _.partial(this._http, 'POST').apply(this, arguments);
    },

    /**
     * Send a PUT request
     * @param {String} path The path to the resource to which we want to send a PUT request
     * @param {ModelInstance} model The model that we would like to PUT
     * @param {Object|Function} optsOrCallback Either an options object or a callback if can use defaults
     * @param {Function} callback Callback if opts specified.
     * @returns {Promise}
     */
    PUT: function () {
        _.partial(this._http, 'PUT').apply(this, arguments);
    },

    /**
     * Send a PATCH request
     * @param {String} path The path to the resource to which we want to send a PATCH request
     * @param {ModelInstance} model The model that we would like to PATCH
     * @param {Object|Function} optsOrCallback Either an options object or a callback if can use defaults
     * @param {Function} callback Callback if opts specified.
     * @returns {Promise}
     */
    PATCH: function () {
        return _.partial(this._http, 'PATCH').apply(this, arguments);
    },

    /**
     * Send a DELETE request. Also removes the object.
     * @param {String} path The path to the resource to which we want to DELETE
     * @param {ModelInstance} model The model that we would like to PATCH
     * @param {Object|Function} optsOrCallback Either an options object or a callback if can use defaults
     * @param {Function} callback Callback if opts specified.
     * @returns {Promise}
     */
    DELETE: function (path, object) {
        return _.partial(this._http, 'DELETE').apply(this, arguments);
    },

    /**
     * Returns the number of objects in this collection.
     *
     * @param callback
     * @returns {Promise}
     */
    count: function (callback) {
        var deferred = window.q ? window.q.defer() : null;
        callback = util.constructCallbackAndPromiseHandler(callback, deferred);
        var tasks = _.map(this._mappings, function (m) {
            return _.bind(m.count, m);
        });
        util.parallel(tasks, function (err, ns) {
            var n;
            if (!err) {
                n = _.reduce(ns, function (m, r) {
                    return m + r
                }, 0);
            }
            callback(err, n);
        });
        return deferred ? deferred.promise : null;
    }
});


exports.Collection = Collection;
},{"../vendor/observe-js/src/observe":24,"./cache":1,"./collectionRegistry":4,"./error":5,"./index":6,"./mapping":8,"./operation/log":13,"./operation/operation":14,"./util":21,"extend":23}],4:[function(require,module,exports){
/**
 * @module collection
 */
var _ = require('./util')._;

function CollectionRegistry() {
    if (!this) return new CollectionRegistry();
    this.collectionNames = [];
}

_.extend(CollectionRegistry.prototype, {
    register: function (collection) {
        var name = collection._name;
        this[name] = collection;
        this.collectionNames.push(name);
    },
    reset: function () {
        var self = this;
        _.each(this.collectionNames, function (name) {
            delete self[name];
        });
        this.collectionNames = [];
    }
});

exports.CollectionRegistry = new CollectionRegistry();
},{"./util":21}],5:[function(require,module,exports){
/**
 * @module error
 */

/**
 * Represents internal errors. These are thrown when something has gone very wrong internally. If you see one of these
 * out in the wild you probably need to file a bug report as it means some assertion has failed.
 * @param message
 * @param context
 * @param ssf
 * @constructor
 */
function InternalSiestaError(message, context, ssf) {
    this.message = message;
    this.context = context;
    // capture stack trace
    ssf = ssf || arguments.callee;
    if (ssf && Error.captureStackTrace) {
        Error.captureStackTrace(this, ssf);
    }
}

InternalSiestaError.prototype = Object.create(Error.prototype);
InternalSiestaError.prototype.name = 'InternalSiestaError';
InternalSiestaError.prototype.constructor = InternalSiestaError;

/**
 * Fields on error objects dished out by Siesta.
 * @type {Object}
 */
var ErrorField = {
    Message: 'message',
    Code: 'code'
};

/**
 * Enumerated errors.
 * @type {Object}
 */
var ErrorCode = {
    Unknown: 0,
    // If no descriptor matches a HTTP response/request then this error is
    NoDescriptorMatched: 1
};


/**
 * Map error codes onto descriptive messages.
 * @type {Object}
 */
var Message = {};
Message[ErrorCode.NoDescriptorMatched] = 'No descriptor matched the HTTP response/request.';

module.exports = {
    InternalSiestaError: InternalSiestaError,
    ErrorCode: ErrorCode,
    ErrorField: ErrorField,
    Message: Message
};
},{}],6:[function(require,module,exports){
/**
 * @module siesta
 */

var collection = require('./collection'),
    util = require('./util'),
    CollectionRegistry = require('./collectionRegistry').CollectionRegistry,
    Collection = collection.Collection,
    cache = require('./cache'),
    Mapping = require('./mapping').Mapping,
    notificationCentre = require('./notificationCentre').notificationCentre,
    Operation = require('./operation/operation').Operation,
    OperationQueue = require('./operation/queue').OperationQueue,
    RelationshipType = require('./relationship').RelationshipType,
    log = require('./operation/log'),
    _ = util._;

if (window.Q) window.q = window.Q;

Operation.logLevel = log.Level.warn;
OperationQueue.logLevel = log.Level.warn;

/**
 * @param ext - Extensions to include
 * @example
 * var siesta = require('siesta');
 * @example
 * var siesta = require('siesta')({http: require('http')});
 * @return {siesta}
 */
var siesta = function (ext) {
    if (!siesta.ext) siesta.ext = {};
    _.extend(siesta.ext, ext || {});
    return siesta;
};

/**
 * Wipe everything!
 */
siesta.reset = function () {
    cache.reset();
    CollectionRegistry.reset();
    siesta.ext.http.DescriptorRegistry.reset();
    //noinspection JSAccessibilityCheck
};

/**
 * Listen to notificatons.
 * @param {String} notificationName
 * @param {Function} handler
 */
siesta.on = _.bind(notificationCentre.on, notificationCentre);

/**
 * Listen to notificatons.
 * @param {String} notificationName
 * @param {Function} handler
 */
siesta.addListener = siesta.on;

/**
 * Stop listening to a particular notification
 *
 * @param {String} notificationName
 * @param {Function} handler
 */
siesta.off = _.bind(notificationCentre.removeListener, notificationCentre);

/**
 * Stop listening to a particular notification
 *
 * @param {String} notificationName
 * @param {Function} handler
 */
siesta.removeListener = siesta.off;

/**
 * Listen to one and only one notification.
 *
 * @param {String} notificationName
 * @param {Function} handler
 */
siesta.once = _.bind(notificationCentre.once, notificationCentre);

/**
 * Removes all listeners.
 */
siesta.removeAllListeners = _.bind(notificationCentre.removeAllListeners, notificationCentre);

siesta.Collection = Collection;
siesta.RelationshipType = RelationshipType;

// Used by modules.
var coreChanges = require('./changes');

// Make available modules to extensions.
siesta._internal = {
    log: log,
    Mapping: Mapping,
    mapping: require('./mapping'),
    error: require('./error'),
    ChangeType: coreChanges.ChangeType,
    siestaModel: require('./siestaModel'),
    extend: require('extend'),
    notificationCentre: require('./notificationCentre'),
    cache: require('./cache'),
    Operation: Operation,
    OperationQueue: OperationQueue,
    coreChanges: coreChanges,
    CollectionRegistry: require('./collectionRegistry').CollectionRegistry,
    Collection: collection.Collection,
    collection: collection,
    utils: util,
    util: util,
    _: util._,
    query: require('./query'),
    store: require('./store')
};

siesta.Collection = collection.Collection;

siesta.performanceMonitoringEnabled = false;
siesta.httpEnabled = false;
siesta.storageEnabled = false;

siesta.ext = {};

/**
 * True if siesta.http.js is installed correctly (or siesta.bundle.js is being used instead).
 */
Object.defineProperty(siesta.ext, 'httpEnabled', {
    get: function () {
        if (siesta.ext._httpEnabled !== undefined) {
            return siesta.ext._httpEnabled;
        }
        return !!siesta.ext.http;
    },
    set: function (v) {
        siesta.ext._httpEnabled = v;
    }
});

/**
 * Creates and registers a new Collection.
 * @param  {[type]} name
 * @param  {[type]} opts
 * @return {Collection}
 */
siesta.collection = function (name, opts) {
    return new Collection(name, opts);
};

/**
 * Sets the ajax function to use e.g. $.ajax
 * @param {Function} ajax - a jquery-like ajax function
 * @example
 * // Use zepto instead of jQuery for http ajax requests.
 * siesta.setAjax(zepto.ajax);
 */
siesta.setAjax = function (ajax) {
    if (siesta.ext.httpEnabled) {
        siesta.ext.http.ajax = ajax;
    } else {
        throw new Error('http module not installed correctly (have you included siesta.http.js?)');
    }
};

/**
 * Returns the ajax function being used.
 * @return {Function}
 */
siesta.getAjax = function () {
    return siesta.ext.http.ajax;
};

siesta.notify = util.next;

/**
 * Returns an object whos keys map onto string constants used for log levels.
 * @type {Object}
 */
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
 * // The logger used by the ModelInstance class, which makes up the individual nodes of the object graph.
 * siesta.setLogLevel('ModelInstance', siesta.LogLevel.trace);
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
siesta.setLogLevel = function (loggerName, level) {
    var Logger = log.loggerWithName(loggerName);
    Logger.setLevel(level);
};


siesta.serialisers = {};
siesta.serializers = siesta.serialisers;

Object.defineProperty(siesta.serialisers, 'id', {
    get: function () {
        if (siesta.ext.httpEnabled) {
            return siesta.ext.http.Serialiser.idSerialiser;
        }
        return null;
    }
});

Object.defineProperty(siesta.serialisers, 'depth', {
    get: function () {
        if (siesta.ext.httpEnabled) {
            return siesta.ext.http.Serialiser.depthSerializer;
        }
        return null;
    }
});

// * `siesta.map` is equivalent to [_.map](http://underscorejs.org/#map)
// * `siesta.each` is equivalent to [_.each](http://underscorejs.org/#each)
// * `siesta.partial` is equivalent to [_.partial](http://underscorejs.org/#partial)
// * `siesta.bind` is equivalent to [_.bind](http://underscorejs.org/#bind)
// * `siesta.pluck` is equivalent to [_.pluck](http://underscorejs.org/#pluck)
// * `siesta.property` is equivalent to [_.property](http://underscorejs.org/#property)
// * `siesta.sortBy` is equivalent to [_.sortBy](http://underscorejs.org/#sortBy)
// * `siesta.series` is equivalent to [async.series](https://github.com/caolan/async#series)
// * `siesta.parallel` is equivalent to [async.parallel](https://github.com/caolan/async#parallel)

siesta.map = util._.map;
siesta.each = util._.each;
siesta.partial = util._.partial;
siesta.bind = util._.bind;
siesta.pluck = util._.pluck;
siesta.property = util._.pluck;
siesta.sortBy = util._.sortBy;
siesta.series = util.series;
siesta.parallel = util.parallel;


if (typeof window != 'undefined') {
    window.siesta = siesta;
}

module.exports = siesta;
},{"./cache":1,"./changes":2,"./collection":3,"./collectionRegistry":4,"./error":5,"./mapping":8,"./notificationCentre":10,"./operation/log":13,"./operation/operation":14,"./operation/queue":15,"./query":17,"./relationship":18,"./siestaModel":19,"./store":20,"./util":21,"extend":23}],7:[function(require,module,exports){
/**
 * @module relationships
 */

var proxy = require('./proxy')
    , RelationshipProxy = proxy.RelationshipProxy
    , Store = require('./store')
    , util = require('./util')
    , _ = util._
    , InternalSiestaError = require('./error').InternalSiestaError
    , coreChanges = require('./changes')
    , notificationCentre = require('./notificationCentre')
    , wrapArrayForAttributes = notificationCentre.wrapArray
    , SiestaModel = require('./siestaModel').ModelInstance
    , ArrayObserver = require('../vendor/observe-js/src/observe').ArrayObserver
    , ChangeType = require('./changes').ChangeType
    ;

/**
 * [ManyToManyProxy description]
 * @param {Object} opts
 */
function ManyToManyProxy(opts) {
    RelationshipProxy.call(this, opts);
    var self = this;
    Object.defineProperty(this, 'isFault', {
        get: function () {
            if (self._id) {
                return !self.related;
            }
            return true;
        },
        set: function (v) {
            if (v) {
                self._id = undefined;
                self.related = null;
            }
            else {
                if (!self._id) {
                    self._id = [];
                    self.related = [];
                    self.wrapArray(self.related);
                }
            }
        }
    });
    this._reverseIsArray = true;
}

ManyToManyProxy.prototype = Object.create(RelationshipProxy.prototype);

_.extend(ManyToManyProxy.prototype, {
    clearReverse: function (removed) {
        var self = this;
        _.each(removed, function (removedObject) {
            var reverseProxy = proxy.getReverseProxyForObject.call(self, removedObject);
            var idx = reverseProxy._id.indexOf(self.object._id);
            proxy.makeChangesToRelatedWithoutObservations.call(reverseProxy, function () {
                proxy.splice.call(reverseProxy, idx, 1);
            });
        });
    },
    setReverse: function (added) {
        var self = this;
        _.each(added, function (addedObject) {
            var reverseProxy = proxy.getReverseProxyForObject.call(self, addedObject);
            proxy.makeChangesToRelatedWithoutObservations.call(reverseProxy, function () {
                proxy.splice.call(reverseProxy, 0, 0, self.object);
            });
        });
    },
    wrapArray: function (arr) {
        var self = this;
        wrapArrayForAttributes(arr, this.reverseName, this.object);
        if (!arr.oneToManyObserver) {
            arr.oneToManyObserver = new ArrayObserver(arr);
            var observerFunction = function (splices) {
                splices.forEach(function (splice) {
                    var added = splice.addedCount ? arr.slice(splice.index, splice.index + splice.addedCount) : [];
                    var removed = splice.removed;
                    self.clearReverse(removed);
                    self.setReverse(added);
                    var mapping = proxy.getForwardMapping.call(self);
                    coreChanges.registerChange({
                        collection: mapping.collection,
                        mapping: mapping.type,
                        _id: self.object._id,
                        field: proxy.getForwardName.call(self),
                        removed: removed,
                        added: added,
                        removedId: _.pluck(removed, '_id'),
                        addedId: _.pluck(added, '_id'),
                        type: ChangeType.Splice,
                        index: splice.index,
                        obj: self.object
                    });
                });
            };
            arr.oneToManyObserver.open(observerFunction);
        }
    },
    get: function (callback) {
        var deferred = window.q ? window.q.defer() : null;
        callback = util.constructCallbackAndPromiseHandler(callback, deferred);
        var self = this;
        if (this.isFault) {
            Store.get({_id: this._id}, function (err, stored) {
                if (err) {
                    if (callback) callback(err);
                }
                else {
                    self.related = stored;
                    if (callback) callback(null, stored);
                }
            })
        }
        else {
            if (callback) callback(null, this.related);
        }
        return deferred ? deferred.promise : null;
    },
    validate: function (obj) {
        if (Object.prototype.toString.call(obj) != '[object Array]') {
            return 'Cannot assign scalar to many to many';
        }
        return null;
    },
    set: function (obj) {
        proxy.checkInstalled.call(this);
        var self = this;
        if (obj) {
            var errorMessage;
            if (errorMessage = this.validate(obj)) {
                return errorMessage;
            }
            else {
                proxy.clearReverseRelated.call(this);
                proxy.set.call(self, obj);
                this.wrapArray(obj);
                proxy.setReverse.call(self, obj);
            }
        }
        else {
            proxy.clearReverseRelated.call(this);
            proxy.set.call(self, obj);
        }
    },
    install: function (obj) {
        RelationshipProxy.prototype.install.call(this, obj);
        obj[('splice' + util.capitaliseFirstLetter(this.reverseName))] = _.bind(proxy.splice, this);
    }


});


module.exports = ManyToManyProxy;
},{"../vendor/observe-js/src/observe":24,"./changes":2,"./error":5,"./notificationCentre":10,"./proxy":16,"./siestaModel":19,"./store":20,"./util":21}],8:[function(require,module,exports){
/**
 * @module mapping
 */

var log = require('./operation/log')
    , CollectionRegistry = require('./collectionRegistry').CollectionRegistry
    , InternalSiestaError = require('./error').InternalSiestaError
    , relationship = require('./relationship')
    , Query = require('./query').Query
    , Operation = require('./operation/operation').Operation
    , BulkMappingOperation = require('./mappingOperation').BulkMappingOperation
    , SiestaModel = require('./siestaModel').ModelInstance
    , util = require('./util')
    , defineSubProperty = util.defineSubProperty
    , cache = require('./cache')
    , store = require('./store')
    , extend = require('extend')
    , coreChanges = require('./changes')
    , wrapArray = require('./notificationCentre').wrapArray
    , OneToManyProxy = require('./oneToManyProxy')
    , OneToOneProxy = require('./oneToOneProxy')
    , ManyToManyProxy = require('./manyToManyProxy')
    , _ = util._
    , RelationshipType = relationship.RelationshipType
    , guid = util.guid
    , ChangeType = coreChanges.ChangeType
    ;

var Logger = log.loggerWithName('Mapping');
Logger.setLevel(log.Level.warn);

/**
 *
 * @param {Object} opts
 */
function Mapping(opts) {
    var self = this;
    this._opts = opts;

    Object.defineProperty(this, '_attributeNames', {
        get: function () {
            var fields = [];
            if (self.id) {
                fields.push(self.id);
            }
            if (self._opts.attributes) {
                _.each(self._opts.attributes, function (x) {
                    fields.push(x)
                });
            }
            return fields;
        },
        enumerable: true,
        configurable: true
    });

    /**
     * @name type
     * @type {String}
     */
    defineSubProperty.call(this, 'type', self._opts);

    /**
     * @name id
     * @type {String}
     */
    Object.defineProperty(this, 'id', {
        get: function () {
            return self._opts['id'] || 'id';
        },
        set: function (v) {
            self._opts['id'] = v;
        },
        enumerable: true
    });

    defineSubProperty.call(this, 'collection', self._opts);
    defineSubProperty.call(this, 'attributes', self._opts);
    defineSubProperty.call(this, 'relationships', self._opts);
    defineSubProperty.call(this, 'indexes', self._opts);
    defineSubProperty.call(this, 'subclass', self._opts);
    defineSubProperty.call(this, 'singleton', self._opts);

    if (!this.relationships) {
        this.relationships = [];
    }

    if (!this.indexes) {
        this.indexes = [];
    }

    this._validateSubclass();

    this._installed = false;
    this._relationshipsInstalled = false;
    this._reverseRelationshipsInstalled = false;

    Object.defineProperty(this, 'installed', {
        get: function () {
            return self._installed && self._relationshipsInstalled && self._reverseRelationshipsInstalled;
        },
        enumerable: true,
        configurable: true
    });

}

_.extend(Mapping.prototype, {
    /**
     * Ensure that any subclasses passed to the mapping are valid and working correctly.
     * @private
     */
    _validateSubclass: function () {
        if (this.subclass && this.subclass !== SiestaModel) {
            var obj = new this.subclass(this);
            if (!obj.mapping) {
                throw new InternalSiestaError('Subclass for mapping "' + this.type + '" has not been configured correctly. ' +
                'Did you call super?');
            }
            if (this.subclass.prototype == SiestaModel.prototype) {
                throw new InternalSiestaError('Subclass for mapping "' + this.type + '" has not been configured correctly. ' +
                'You should use Object.create on ModelInstance prototype.');
            }
        }
    },
    /**
     * Install relationships. Returns error in form of string if fails.
     * @return {String|null}
     */
    installRelationships: function () {
        if (!this._relationshipsInstalled) {
            var self = this;
            self._relationships = [];
            if (self._opts.relationships) {
                for (var name in self._opts.relationships) {
                    if (Logger.debug.isEnabled)
                        Logger.debug(self.type + ': configuring relationship ' + name);
                    if (self._opts.relationships.hasOwnProperty(name)) {
                        var relationship = self._opts.relationships[name];
                        if (relationship.type == RelationshipType.OneToMany ||
                            relationship.type == RelationshipType.OneToOne ||
                            relationship.type == RelationshipType.ManyToMany) {
                            var mappingName = relationship.mapping;
                            if (Logger.debug.isEnabled)
                                Logger.debug('reverseMappingName', mappingName);
                            if (!self.collection) throw new InternalSiestaError('Mapping must have collection');
                            var collection = CollectionRegistry[self.collection];
                            if (!collection) {
                                throw new InternalSiestaError('Collection ' + self.collection + ' not registered');
                            }
                            var reverseMapping = collection[mappingName];
                            if (!reverseMapping) {
                                var arr = mappingName.split('.');
                                if (arr.length == 2) {
                                    var collectionName = arr[0];
                                    mappingName = arr[1];
                                    var otherCollection = CollectionRegistry[collectionName];
                                    if (!otherCollection) {
                                        return 'Collection with name "' + collectionName + '" does not exist.';
                                    }
                                    reverseMapping = otherCollection[mappingName];
                                }
                            }
                            if (Logger.debug.isEnabled)
                                Logger.debug('reverseMapping', reverseMapping);
                            if (reverseMapping) {
                                relationship.reverseMapping = reverseMapping;
                                relationship.forwardMapping = this;
                                relationship.forwardName = name;
                                relationship.reverseName = relationship.reverse;
                                relationship.isReverse = false;
                            } else {
                                return 'Mapping with name "' + mappingName.toString() + '" does not exist';
                            }
                        } else {
                            return 'Relationship type ' + relationship.type + ' does not exist';
                        }
                    }
                }
            }
            this._relationshipsInstalled = true;
        } else {
            throw new InternalSiestaError('Relationships for "' + this.type + '" have already been installed');
        }
        return null;
    },
    installReverseRelationships: function () {
        if (!this._reverseRelationshipsInstalled) {
            for (var forwardName in this.relationships) {
                if (this.relationships.hasOwnProperty(forwardName)) {
                    var relationship = this.relationships[forwardName];
                    relationship = extend(true, {}, relationship);
                    relationship.isReverse = true;
                    var reverseMapping = relationship.reverseMapping;
                    var reverseName = relationship.reverseName;
                    if (Logger.debug.isEnabled)
                        Logger.debug(self.type + ': configuring  reverse relationship ' + name);
                    reverseMapping.relationships[reverseName] = relationship;
                }
            }
            this._reverseRelationshipsInstalled = true;
        } else {
            throw new InternalSiestaError('Reverse relationships for "' + this.type + '" have already been installed.');
        }
    },
    query: function (query, callback) {
        var deferred = window.q ? window.q.defer() : null;
        callback = util.constructCallbackAndPromiseHandler(callback, deferred);
        var _query = new Query(this, query);
        _query.execute(callback);
        return deferred ? deferred.promise : null;
    },
    get: function (idOrCallback, callback) {
        var deferred = window.q ? window.q.defer() : null;
        callback = util.constructCallbackAndPromiseHandler(callback, deferred);

        function finish(err, res) {
            if (callback) callback(err, res);
        }

        if (this.singleton) {
            if (typeof idOrCallback == 'function') {
                callback = idOrCallback;
            }
            this.all(function (err, objs) {
                if (err) finish(err);
                if (objs.length > 1) {
                    throw new InternalSiestaError('Somehow more than one object has been created for a singleton mapping! ' +
                    'This is a serious error, please file a bug report.');
                } else if (objs.length) {
                    finish(null, objs[0]);
                } else {
                    finish(null, objs[0]);
                }
            });
        } else {
            var opts = {};
            opts[this.id] = idOrCallback;
            opts.mapping = this;
            var obj = cache.get(opts);
            if (obj) {
                finish(null, obj);
            } else {
                delete opts.mapping;
                var query = new Query(this, opts);
                query.execute(function (err, rows) {
                    var obj = null;
                    if (!err && rows.length) {
                        if (rows.length > 1) {
                            throw new InternalSiestaError('More than one object with id=' + idOrCallback.toString());
                        } else {
                            obj = rows[0];
                        }
                    }
                    finish(err, obj);
                });
            }

        }
        return deferred ? deferred.promise : null;
    },
    all: function (callback) {
        var deferred = window.q ? window.q.defer() : null;
        callback = util.constructCallbackAndPromiseHandler(callback, deferred);
        var query = new Query(this, {});
        query.execute(callback);
        return deferred ? deferred.promise : null;
    },
    install: function (callback) {
        if (Logger.info.isEnabled) Logger.info('Installing mapping ' + this.type);
        var deferred = window.q ? window.q.defer() : null;
        callback = util.constructCallbackAndPromiseHandler(callback, deferred);
        if (!this._installed) {
            var errors = this._validate();
            this._installed = true;
            if (Logger.info.isEnabled) {
                if (errors.length) Logger.error('Errors installing mapping ' + this.type + ': ' + errors);
                else Logger.info('Installed mapping ' + this.type);
            }
            if (callback) callback(errors.length ? errors : null);
        } else {
            throw new InternalSiestaError('Mapping "' + this.type + '" has already been installed');
        }
        return deferred ? deferred.promise : null;
    },
    _validate: function () {
        var errors = [];
        if (!this.type) {
            errors.push('Must specify a type');
        }
        if (!this.collection) {
            errors.push('A mapping must belong to an collection');
        }
        return errors;
    },
    /**
     * Map data into Siesta.
     *
     * @param data Raw data received remotely or otherwise
     * @param callback Called once pouch persistence returns.
     * @param override Force mapping to this object
     */
    map: function (data, callback, override) {
        var deferred = window.q ? window.q.defer() : null;
        callback = util.constructCallbackAndPromiseHandler(callback, deferred);
        if (this.installed) {
            if (util.isArray(data)) {
                this._mapBulk(data, callback, override);
            } else {
                this._mapBulk([data], function (err, objects) {
                    if (callback) {
                        var obj;
                        if (objects) {
                            if (objects.length) {
                                obj = objects[0];
                            }
                        }
                        callback(err ? err[0] : null, obj);
                    }
                }, override ? [override] : undefined);
            }
        } else {
            throw new InternalSiestaError('Mapping must be fully installed before creating any models');
        }
        return deferred ? deferred.promise : null;
    },
    _mapBulk: function (data, callback, override) {
        var deferred = window.q ? window.q.defer() : null;
        callback = util.constructCallbackAndPromiseHandler(callback, deferred);
        var opts = {
            mapping: this,
            data: data
        };
        if (override) opts.objects = override;
        var op = new BulkMappingOperation(opts);
        op.onCompletion(function () {
            var err = op.error;
            if (err) {
                if (callback) callback(err);
            } else {
                var objects = op.result;
                callback(null, objects);
            }
        });
        op.start();
        return deferred ? deferred.promise : null;
    },
    _countCache: function () {
        var collCache = cache._localCacheByType[this.collection] || {};
        var mappingCache = collCache[this.type] || {};
        return _.reduce(Object.keys(mappingCache), function (m, _id) {
            m[_id] = {};
            return m;
        }, {});
    },
    count: function (callback) {
        var deferred = window.q ? window.q.defer() : null;
        callback = util.constructCallbackAndPromiseHandler(callback, deferred);
        var hash = this._countCache();
        if (siesta.ext.storageEnabled) {
            var pouch = siesta.ext.storage.Pouch.getPouch();
            var indexName = (new siesta.ext.storage.Index(this.collection, this.type))._getName() + '_';
            pouch.query(indexName, {
                include_docs: false
            }, function (err, resp) {
                var n;
                if (!err) {
                    _.each(_.pluck(resp.rows, 'id'), function (id) {
                        hash[id] = {};
                    });
                    n = Object.keys(hash).length;
                }
                callback(err, n);
            });
        } else {
            callback(null, Object.keys(hash).length)
        }
        return deferred ? deferred.promise : null;
    },
    /**
     * Convert raw data into a ModelInstance
     * @returns {SiestaModel}
     * @private
     */
    _new: function (data) {
        if (this.installed) {
            var self = this;
            var _id;
            if (data) {
                _id = data._id ? data._id : guid();
            } else {
                _id = guid();
            }
            var newModel;
            if (this.subclass) {
                newModel = new this.subclass(this);
            } else {
                newModel = new SiestaModel(this);
            }
            if (Logger.info.isEnabled)
                Logger.info('New object created _id="' + _id.toString() + '", type=' + this.type, data);
            newModel._id = _id;
            // Place attributes on the object.
            newModel.__values = data || {};
            var fields = this._attributeNames;
            var idx = fields.indexOf(this.id);
            if (idx > -1) {
                fields.splice(idx, 1);
            }
            _.each(fields, function (field) {
                Object.defineProperty(newModel, field, {
                    get: function () {
                        return newModel.__values[field] || null;
                    },
                    set: function (v) {
                        var old = newModel.__values[field];
                        newModel.__values[field] = v;
                        coreChanges.registerChange({
                            collection: self.collection,
                            mapping: self.type,
                            _id: newModel._id,
                            new: v,
                            old: old,
                            type: ChangeType.Set,
                            field: field,
                            obj: newModel
                        });
                        if (util.isArray(v)) {
                            wrapArray(v, field, newModel);
                        }
                    },
                    enumerable: true,
                    configurable: true
                });
            });

            Object.defineProperty(newModel, this.id, {
                get: function () {
                    return newModel.__values[self.id] || null;
                },
                set: function (v) {
                    var old = newModel[self.id];
                    newModel.__values[self.id] = v;
                    coreChanges.registerChange({
                        collection: self.collection,
                        mapping: self.type,
                        _id: newModel._id,
                        new: v,
                        old: old,
                        type: ChangeType.Set,
                        field: self.id,
                        obj: newModel
                    });
                    cache.remoteInsert(newModel, v, old);
                },
                enumerable: true,
                configurable: true
            });
            for (var name in this.relationships) {
                var proxy;
                if (this.relationships.hasOwnProperty(name)) {
                    var relationship = this.relationships[name];
                    if (relationship.type == RelationshipType.OneToMany) {
                        proxy = new OneToManyProxy(relationship);
                    } else if (relationship.type == RelationshipType.OneToOne) {
                        proxy = new OneToOneProxy(relationship);
                    } else if (relationship.type == RelationshipType.ManyToMany) {
                        proxy = new ManyToManyProxy(relationship);
                    } else {
                        throw new InternalSiestaError('No such relationship type: ' + relationship.type);
                    }
                }
                proxy.install(newModel);
                proxy.isFault = false;
            }
            cache.insert(newModel);
            coreChanges.registerChange({
                collection: this.collection,
                mapping: this.type,
                _id: newModel._id,
                newId: newModel._id,
                new: newModel,
                type: ChangeType.New,
                obj: newModel
            });
            return newModel;
        } else {
            util.printStackTrace();
            throw new InternalSiestaError('Mapping must be fully installed before creating any models');
        }

    },
    _dump: function (asJSON) {
        var dumped = {};
        dumped.name = this.type;
        dumped.attributes = this.attributes;
        dumped.id = this.id;
        dumped.collection = this.collection;
        dumped.relationships = _.map(this.relationships, function (r) {
            return r.isForward ? r.forwardName : r.reverseName;
        });
        return asJSON ? JSON.stringify(dumped, null, 4) : dumped;
    },
    toString: function () {
        return 'Mapping[' + this.type + ']';
    }
});

exports.Mapping = Mapping;

},{"./cache":1,"./changes":2,"./collectionRegistry":4,"./error":5,"./manyToManyProxy":7,"./mappingOperation":9,"./notificationCentre":10,"./oneToManyProxy":11,"./oneToOneProxy":12,"./operation/log":13,"./operation/operation":14,"./query":17,"./relationship":18,"./siestaModel":19,"./store":20,"./util":21,"extend":23}],9:[function(require,module,exports){
/**
 * @module mapping
 */

var Store = require('./store')
    , SiestaModel = require('./siestaModel').ModelInstance
    , log = require('./operation/log')
    , Operation = require('./operation/operation').Operation
    , InternalSiestaError = require('./error').InternalSiestaError
    , Query = require('./query').Query
    , cache = require('./cache')
    , util = require('./util')
    , _ = util._
    , defineSubProperty = util.defineSubProperty
    , ChangeType = require('./changes').ChangeType;

var Logger = log.loggerWithName('MappingOperation');
Logger.setLevel(log.Level.warn);

function flattenArray(arr) {
    return _.reduce(arr, function (memo, e) {
        if (util.isArray(e)) {
            memo = memo.concat(e);
        } else {
            memo.push(e);
        }
        return memo;
    }, []);
}

function unflattenArray(arr, modelArr) {
    var n = 0;
    var unflattened = [];
    for (var i = 0; i < modelArr.length; i++) {
        if (util.isArray(modelArr[i])) {
            var newArr = [];
            unflattened[i] = newArr;
            for (var j = 0; j < modelArr[i].length; j++) {
                newArr.push(arr[n]);
                n++;
            }
        } else {
            unflattened[i] = arr[n];
            n++;
        }
    }
    return unflattened;
}

/**
 * Defines an encapsulated mapping operation where opts takes a mappin
 * @param {Object} opts
 */
function BulkMappingOperation(opts) {
    Operation.call(this);

    this._opts = opts;

    /**
     * @name mapping
     * @type {Mapping}
     */
    defineSubProperty.call(this, 'mapping', this._opts);

    /**
     * @name data
     * @type {Array}
     */
    defineSubProperty.call(this, 'data', this._opts);

    /**
     * @name objects
     * @type {Array}
     */
    defineSubProperty.call(this, 'objects', this._opts);

    if (!this.objects) this.objects = [];

    /**
     * Array of errors where indexes map onto same index as the datum that caused an error.
     * @type {Array}
     */
    this.errors = [];

    this.name = 'Mapping Operation';
    this.work = _.bind(this._start, this);
    this.subOps = {};
}

BulkMappingOperation.prototype = Object.create(Operation.prototype);

_.extend(BulkMappingOperation.prototype, {
    mapAttributes: function () {
        for (var i = 0; i < this.data.length; i++) {
            var datum = this.data[i];
            var object = this.objects[i];
            // No point mapping object onto itself. This happens if a ModelInstance is passed as a relationship.
            if (datum != object) {
                if (object) { // If object is falsy, then there was an error looking up that object/creating it.
                    var fields = this.mapping._attributeNames;
                    _.each(fields, function (f) {
                        if (datum[f] !== undefined) { // null is fine
                            object[f] = datum[f];
                        }
                    });
                }
            }
        }
    },
    _map: function () {
        var self = this;
        var err;
        var numHits = this.mapAttributes(this);
        var relationshipFields = _.keys(self.subOps);
        _.each(relationshipFields, function (f) {
            var op = self.subOps[f].op;
            var indexes = self.subOps[f].indexes;
            var relatedData = self.getRelatedData(f).relatedData;
            var unflattenedObjects = unflattenArray(op.objects, relatedData);
            for (var i = 0; i < unflattenedObjects.length; i++) {
                var idx = indexes[i];
                // Errors are plucked from the suboperations.
                var error = self.errors[idx];
                err = error ? error[f] : null;
                if (!err) {
                    var related = unflattenedObjects[i]; // Can be array or scalar.
                    var object = self.objects[idx];
                    if (object) {
                        err = object.__proxies[f].set(related);
                        if (err) {
                            if (!self.errors[idx]) self.errors[idx] = {};
                            self.errors[idx][f] = err;
                        }
                    }
                }
            }
        });
    },
    /**
     * For indices where no object is present, perform lookups, creating a new object if necessary.
     * @private
     */
    _lookup: function (callback) {
        var deferred = window.q ? window.q.defer() : null;
        callback = util.constructCallbackAndPromiseHandler(callback, deferred);
        var self = this;
        var remoteLookups = [];
        var localLookups = [];
        for (var i = 0; i < this.data.length; i++) {
            if (!this.objects[i]) {
                var lookup;
                var datum = this.data[i];
                var isScalar = typeof datum == 'string' || typeof datum == 'number' || datum instanceof String;
                if (datum) {
                    if (isScalar) {
                        lookup = {
                            index: i,
                            datum: {}
                        };
                        lookup.datum[self.mapping.id] = datum;
                        remoteLookups.push(lookup);
                    } else if (datum instanceof SiestaModel) { // We won't need to perform any mapping.
                        this.objects[i] = datum;
                    } else if (datum._id) {
                        localLookups.push({
                            index: i,
                            datum: datum
                        });
                    } else if (datum[self.mapping.id]) {
                        remoteLookups.push({
                            index: i,
                            datum: datum
                        });
                    } else {
                        // Create a new object if and only if the data has any fields that will actually
                        var datumFields = Object.keys(datum);
                        var objectFields = _.reduce(Object.keys(self.mapping.relationships).concat(self.mapping._attributeNames), function (m, x) {
                            m[x] = {};
                            return m;
                        }, {});
                        var shouldCreateNewObject = false;
                        for (var j = 0; j < datumFields.length; j++) {
                            if (objectFields[datumFields[j]]) {
                                shouldCreateNewObject = true;
                                break;
                            }
                        }
                        if (shouldCreateNewObject) {
                            this.objects[i] = self.mapping._new();
                        }
                    }
                } else {
                    this.objects[i] = null;
                }
            }
        }
        util.parallel([
                function (callback) {
                    var localIdentifiers = _.pluck(_.pluck(localLookups, 'datum'), '_id');
                    if (localIdentifiers.length) {
                        Store.getMultipleLocal(localIdentifiers, function (err, objects) {
                            if (!err) {
                                for (var i = 0; i < localIdentifiers.length; i++) {
                                    var obj = objects[i];
                                    var _id = localIdentifiers[i];
                                    var lookup = localLookups[i];
                                    if (!obj) {
                                        self.errors[lookup.index] = {
                                            _id: 'No object with _id="' + _id.toString() + '"'
                                        };
                                    } else {
                                        self.objects[lookup.index] = obj;
                                    }
                                }
                            }
                            callback(err);
                        });
                    } else {
                        callback();
                    }
                },
                function (callback) {
                    var remoteIdentifiers = _.pluck(_.pluck(remoteLookups, 'datum'), self.mapping.id);
                    if (remoteIdentifiers.length) {
                        if (Logger.trace.isEnabled)
                            Logger.trace('Looking up remoteIdentifiers: ' + JSON.stringify(remoteIdentifiers, null, 4));
                        Store.getMultipleRemote(remoteIdentifiers, self.mapping, function (err, objects) {
                            if (!err) {
                                if (Logger.trace.isEnabled) {
                                    var results = {};
                                    for (i = 0; i < objects.length; i++) {
                                        results[remoteIdentifiers[i]] = objects[i] ? objects[i]._id : null;
                                    }
                                    Logger.trace('Results for remoteIdentifiers: ' + JSON.stringify(results, null, 4));
                                }
                                for (i = 0; i < objects.length; i++) {
                                    var obj = objects[i];
                                    var lookup = remoteLookups[i];
                                    if (obj) {
                                        self.objects[lookup.index] = obj;
                                    } else {
                                        var data = {};
                                        var remoteId = remoteIdentifiers[i];
                                        data[self.mapping.id] = remoteId;
                                        var cacheQuery = {
                                            mapping: self.mapping
                                        };
                                        cacheQuery[self.mapping.id] = remoteId;
                                        var cached = cache.get(cacheQuery);
                                        if (cached) {
                                            self.objects[lookup.index] = cached;
                                        } else {
                                            self.objects[lookup.index] = self.mapping._new();
                                            // It's important that we map the remote identifier here to ensure that it ends
                                            // up in the cache.
                                            self.objects[lookup.index][self.mapping.id] = remoteId;
                                        }
                                    }
                                }
                            }
                            callback(err);
                        });
                    } else {
                        callback();
                    }
                }
            ],
            callback);
        return deferred ? deferred.promise : null;
    },
    _lookupSingleton: function (callback) {
        var deferred = window.q ? window.q.defer() : null;
        callback = util.constructCallbackAndPromiseHandler(callback, deferred);
        var self = this;
        var cachedSingleton = cache.get({
            mapping: this.mapping
        });
        if (!cachedSingleton) {
            var query = new Query(this.mapping);
            query.execute(function (err, objs) {
                if (!err) {
                    var obj;
                    if (objs.length) {
                        if (objs.length == 1) {
                            obj = objs[0];
                        } else {
                            throw new InternalSiestaError();
                        }
                    } else {
                        obj = self.mapping._new();
                    }
                    for (var i = 0; i < self.data.length; i++) {
                        self.objects[i] = obj;
                    }
                }
                callback(err);
            });
        } else {
            for (var i = 0; i < self.data.length; i++) {
                self.objects[i] = cachedSingleton;
            }
            callback();
        }
        return deferred ? deferred.promise : null;
    },
    _start: function (done) {
        if (this.data.length) {
            var self = this;
            var tasks = [];
            var lookupFunc = this.mapping.singleton ? this._lookupSingleton : this._lookup;
            tasks.push(_.bind(lookupFunc, this));
            tasks.push(_.bind(this._executeSubOperations, this));
            util.parallel(tasks, function () {
                self._map();
                done(self.errors.length ? self.errors : null, self.objects);
            });
        } else {
            done(null, []);
        }
    },
    getRelatedData: function (name) {
        var indexes = [];
        var relatedData = [];
        for (var i = 0; i < this.data.length; i++) {
            var datum = this.data[i];
            if (datum) {
                if (datum[name]) {
                    indexes.push(i);
                    relatedData.push(datum[name]);
                }
            }
        }
        return {
            indexes: indexes,
            relatedData: relatedData
        };
    },
    _constructSubOperations: function () {
        var subOps = this.subOps;
        var relationships = this.mapping.relationships;
        for (var name in relationships) {
            if (relationships.hasOwnProperty(name)) {
                var relationship = relationships[name];
                var reverseMapping = relationship.forwardName == name ? relationship.reverseMapping : relationship.forwardMapping;
                var __ret = this.getRelatedData(name);
                var indexes = __ret.indexes;
                var relatedData = __ret.relatedData;
                if (relatedData.length) {
                    var flatRelatedData = flattenArray(relatedData);
                    var op = new BulkMappingOperation({
                        mapping: reverseMapping,
                        data: flatRelatedData
                    });
                    op.__relationshipName = name;
                    subOps[name] = {
                        op: op,
                        indexes: indexes
                    };
                }
            }
        }
    },
    gatherErrorsFromSubOperations: function () {
        var self = this;
        var relationshipNames = _.keys(this.subOps);
        _.each(relationshipNames, function (name) {
            var op = self.subOps[name].op;
            var indexes = self.subOps[name].indexes;
            var errors = op.errors;
            if (errors.length) {
                var relatedData = self.getRelatedData(name).relatedData;
                var unflattenedErrors = unflattenArray(errors, relatedData);
                for (var i = 0; i < unflattenedErrors.length; i++) {
                    var idx = indexes[i];
                    var err = unflattenedErrors[i];
                    var isError = err;
                    if (util.isArray(err)) isError = _.reduce(err, function (memo, x) {
                        return memo || x
                    }, false);
                    if (isError) {
                        if (!self.errors[idx]) self.errors[idx] = {};
                        self.errors[idx][name] = err;
                    }
                }
            }
        });
    },
    _executeSubOperations: function (callback) {
        var self = this;
        this._constructSubOperations();
        var relationshipNames = _.keys(this.subOps);
        if (relationshipNames.length) {
            var subOperations = _.map(relationshipNames, function (k) {
                return self.subOps[k].op
            });
            var compositeOperation = new Operation(subOperations);
            compositeOperation.onCompletion(function () {
                self.gatherErrorsFromSubOperations(relationshipNames);
                callback();
            });
            compositeOperation.start();
        } else {
            callback();
        }
    }
});


exports.BulkMappingOperation = BulkMappingOperation;
exports.flattenArray = flattenArray;
exports.unflattenArray = unflattenArray;
},{"./cache":1,"./changes":2,"./error":5,"./operation/log":13,"./operation/operation":14,"./query":17,"./siestaModel":19,"./store":20,"./util":21}],10:[function(require,module,exports){
var EventEmitter = require('events').EventEmitter;
var notificationCentre = new EventEmitter();
notificationCentre.setMaxListeners(100);
var ArrayObserver = require('../vendor/observe-js/src/observe').ArrayObserver;
var coreChanges = require('./changes');
var ChangeType = coreChanges.ChangeType;
var log = require('./operation/log');

/**
* Wraps the methods of a javascript array object so that notifications are sent
* on calls.
*
* @param array the array we have wrapping
* @param field name of the field
* @param restObject the object to which this array is a property
*/
function wrapArray(array, field, siestaModel) {
    if (!array.observer) {
        array.observer = new ArrayObserver(array);
        array.observer.open(function (splices) {
            var fieldIsAttribute = siestaModel._attributeNames.indexOf(field) > -1;
            if (fieldIsAttribute) {
                splices.forEach(function (splice) {
                    coreChanges.registerChange({
                        collection: siestaModel.collection,
                        mapping: siestaModel.mapping.type,
                        _id: siestaModel._id,
                        index: splice.index,
                        removed: splice.removed,
                        added: splice.addedCount ? array.slice(splice.index, splice.index+splice.addedCount) : [],
                        type: coreChanges.ChangeType.Splice,
                        field: field,
                        obj: siestaModel
                    });
                });
            }
        });
        array.isFault = false;
    }
}

exports.notificationCentre = notificationCentre;
exports.wrapArray = wrapArray;
},{"../vendor/observe-js/src/observe":24,"./changes":2,"./operation/log":13,"events":22}],11:[function(require,module,exports){
/**
 * @module relationships
 */

var proxy = require('./proxy')
    , RelationshipProxy = proxy.RelationshipProxy
    , Store = require('./store')
    , util = require('./util')
    , _ = util._
    , InternalSiestaError = require('./error').InternalSiestaError
    , coreChanges = require('./changes')
    , SiestaModel = require('./siestaModel').ModelInstance
    , notificationCentre = require('./notificationCentre')
    , wrapArrayForAttributes = notificationCentre.wrapArray
    , ArrayObserver = require('../vendor/observe-js/src/observe').ArrayObserver
    , ChangeType = require('./changes').ChangeType
    ;

/**
 * @class  [OneToManyProxy description]
 * @constructor
 * @param {[type]} opts
 */
function OneToManyProxy(opts) {
    RelationshipProxy.call(this, opts);

    var self = this;
    Object.defineProperty(this, 'isFault', {
        get: function () {
            if (self.isForward) {
                if (self._id) {
                    return !self.related;
                }
                else if (self._id === null) {
                    return false;
                }
                return true;
            }
            else {
                if (self._id) {
                    if (self.related) {
                        if (self._id.length != self.related.length) {
                            self.validateRelated();
                            return true;
                        }
                        else {
                            return false;
                        }
                    }
                    return true;
                }
                return true;
            }
        },
        set: function (v) {
            if (v) {
                self._id = undefined;
                self.related = null;
            }
            else {
                if (!self._id) {
                    if (self.isForward) {
                        self._id = null;
                    }
                    else {
                        self._id = [];
                        self.related = [];
                        this.wrapArray(self.related);
                    }
                }
            }
        }
    });
    this._reverseIsArray = true;
    this._forwardIsArray = false;
}

OneToManyProxy.prototype = Object.create(RelationshipProxy.prototype);

_.extend(OneToManyProxy.prototype, {
    clearReverse: function (removed) {
        var self = this;
        _.each(removed, function (removedObject) {
            var reverseProxy = proxy.getReverseProxyForObject.call(self, removedObject);
            proxy.set.call(reverseProxy, null);
        });
    },
    setReverse: function (added) {
        var self = this;
        _.each(added, function (added) {
            var forwardProxy = proxy.getReverseProxyForObject.call(self, added);
            proxy.set.call(forwardProxy, self.object);
        });
    },
    wrapArray: function (arr) {
        var self = this;
        wrapArrayForAttributes(arr, this.reverseName, this.object);
        if (!arr.oneToManyObserver) {
            arr.oneToManyObserver = new ArrayObserver(arr);
            var observerFunction = function (splices) {
                splices.forEach(function (splice) {
                    var added = splice.addedCount ? arr.slice(splice.index, splice.index + splice.addedCount) : [];
                    var removed = splice.removed;
                    self.clearReverse(removed);
                    self.setReverse(added);
                    var mapping = proxy.getForwardMapping.call(self);
                    coreChanges.registerChange({
                        collection: mapping.collection,
                        mapping: mapping.type,
                        _id: self.object._id,
                        field: proxy.getForwardName.call(self),
                        removed: removed,
                        added: added,
                        removedId: _.pluck(removed, '_id'),
                        addedId: _.pluck(added, '_id'),
                        type: ChangeType.Splice,
                        index: splice.index,
                        obj: self.object
                    });
                });
            };
            arr.oneToManyObserver.open(observerFunction);
        }
    },
    get: function (callback) {
        var deferred = window.q ? window.q.defer() : null;
        callback = util.constructCallbackAndPromiseHandler(callback, deferred);
        var self = this;
        if (this.isFault) {
            if (this._id.length) {
                var storeOpts = {_id: this._id};
                Store.get(storeOpts, function (err, stored) {
                    if (err) {
                        if (callback) callback(err);
                    }
                    else {
                        self.related = stored;
                        if (callback) callback(null, stored);
                    }
                });
            }
            else if (callback) {
                callback(null, this.related);
            }
        }
        else {
            if (callback) callback(null, this.related);
        }
        return deferred ? deferred.promise : null;
    },
    /**
     * Validate the object that we're setting
     * @param obj
     * @returns {string|null} An error message or null
     * @class OneToManyProxy
     */
    validate: function (obj) {
        var str = Object.prototype.toString.call(obj);
        if (this.isForward) {
            if (str == '[object Array]') {
                return 'Cannot assign array forward oneToMany (' + str + '): ' + this.forwardName;
            }
        }
        else {
            if (str != '[object Array]') {
                return 'Cannot scalar to reverse oneToMany (' + str + '): ' + this.reverseName;
            }
        }
        return null;
    },
    validateRelated: function () {
        var self = this;
        if (self._id) {
            if (self.related) {
                if (self._id.length != self.related.length) {
                    if (self.related.length > 0) {
                        throw new InternalSiestaError('_id and related are somehow out of sync');
                    }
                }
            }
        }
    },
    set: function (obj) {
        proxy.checkInstalled.call(this);
        var self = this;
        if (obj) {
            var errorMessage;
            if (errorMessage = this.validate(obj)) {
                return errorMessage;
            }
            else {
                proxy.clearReverseRelated.call(this);
                proxy.set.call(self, obj);
                if (self.isReverse) {
                    this.wrapArray(self.related);
                }
                proxy.setReverse.call(self, obj);
            }
        }
        else {
            proxy.clearReverseRelated.call(this);
            proxy.set.call(self, obj);
        }
    },
    install: function (obj) {
        RelationshipProxy.prototype.install.call(this, obj);
        if (this.isReverse) {
            obj[('splice' + util.capitaliseFirstLetter(this.reverseName))] = _.bind(proxy.splice, this);
        }
    }
});


module.exports = OneToManyProxy;
},{"../vendor/observe-js/src/observe":24,"./changes":2,"./error":5,"./notificationCentre":10,"./proxy":16,"./siestaModel":19,"./store":20,"./util":21}],12:[function(require,module,exports){
/**
 * @module relationships
 */

var proxy = require('./proxy')
    , RelationshipProxy = proxy.RelationshipProxy
    , Store = require('./store')
    , util = require('./util')
    , InternalSiestaError = require('./error').InternalSiestaError
    , SiestaModel = require('./siestaModel').ModelInstance;

/**
 * [OneToOneProxy description]
 * @param {Object} opts
 */
function OneToOneProxy(opts) {
    RelationshipProxy.call(this, opts);
    this._reverseIsArray = false;
    this._forwardIsArray = false;
}


OneToOneProxy.prototype = Object.create(RelationshipProxy.prototype);

_.extend(OneToOneProxy.prototype, {
    /**
     * Validate the object that we're setting
     * @param obj
     * @returns {string|null} An error message or null
     */
    validate: function (obj) {
        if (Object.prototype.toString.call(obj) == '[object Array]') {
            return 'Cannot assign array to one to one relationship';
        }
        else if ((!obj instanceof SiestaModel)) {

        }
        return null;
    },
    set: function (obj) {
        proxy.checkInstalled.call(this);
        var self = this;
        if (obj) {
            var errorMessage;
            if (errorMessage = self.validate(obj)) {
                return errorMessage;
            }
            else {
                proxy.clearReverseRelated.call(this);
                proxy.set.call(self, obj);
                proxy.setReverse.call(self, obj);
            }
        }
        else {
            proxy.clearReverseRelated.call(this);
            proxy.set.call(self, obj);
        }
    },
    get: function (callback) {
        var deferred = window.q ? window.q.defer() : null;
        callback = util.constructCallbackAndPromiseHandler(callback, deferred);
        var self = this;
        if (this._id) {
            Store.get({_id: this._id}, function (err, stored) {
                if (err) {
                    if (callback) callback(err);
                }
                else {
                    self.related = stored;
                    if (callback) callback(null, stored);
                }
            })
        }
        return deferred ? deferred.promise : null;
    }
});


module.exports = OneToOneProxy;
},{"./error":5,"./proxy":16,"./siestaModel":19,"./store":20,"./util":21}],13:[function(require,module,exports){
var _ = require('../util')._;

function Logger (name) {
    if (!this) return new Logger(name);
    this.name = name;

    this.trace = constructPerformer(this, _.bind(console.debug ? console.debug : console.log, console), Logger.Level.trace);
    this.debug = constructPerformer(this, _.bind(console.debug ? console.debug  : console.log, console), Logger.Level.debug);
    this.info = constructPerformer(this, _.bind(console.info ? console.info : console.log, console), Logger.Level.info);
    this.log = constructPerformer(this, _.bind(console.log ? console.log : console.log, console), Logger.Level.info);
    this.warn = constructPerformer(this, _.bind(console.warn ? console.warn : console.log, console), Logger.Level.warning);
    this.error = constructPerformer(this, _.bind(console.error ? console.error : console.log, console), Logger.Level.error);
    this.fatal = constructPerformer(this, _.bind(console.error ? console.error : console.log, console), Logger.Level.fatal);

}

var logLevels = {};

function constructPerformer (logger, f, level) {
    var performer = function (message) {
        logger.performLog(f, level, message, arguments);
    };
    Object.defineProperty(performer, 'isEnabled', {
        get: function () {
            var currentLevel = logger.currentLevel();
            return level >= currentLevel;
        },
        enumerable: true,
        configurable: true
    });
    performer.f = f;
    performer.logger = logger;
    performer.level = level;
    return performer;
}

Logger.Level = {
    trace: 0,
    debug: 1,
    info: 2,
    warning: 3,
    warn: 3,
    error: 4,
    fatal: 5
};

Logger.LevelText = {};
Logger.LevelText [Logger.Level.trace] = 'TRACE';
Logger.LevelText [Logger.Level.debug] = 'DEBUG';
Logger.LevelText [Logger.Level.info] = 'INFO ';
Logger.LevelText [Logger.Level.warning] = 'WARN ';
Logger.LevelText [Logger.Level.error] = 'ERROR';

Logger.levelAsText = function (level) {
    return this.LevelText[level];
};

Logger.loggerWithName = function (name) {
    return new Logger(name);
};

Logger.prototype.currentLevel = function () {
    var logLevel = logLevels[this.name];
    return  logLevel ? logLevel : Logger.Level.trace;
};

Logger.prototype.setLevel = function (level) {
    logLevels[this.name] = level;
};

Logger.prototype.override = function (level, override, message) {
    var levelAsText = Logger.levelAsText(level);
    var performer = this[levelAsText.trim().toLowerCase()];
    var f = performer.f;
    var otherArguments = Array.prototype.slice.call(arguments, 3, arguments.length);
    this.performLog(f, level, message, otherArguments, override);
};

Logger.prototype.performLog = function (logFunc, level, message, otherArguments, override) {
    var self = this;
    var currentLevel = override !== undefined ? override : this.currentLevel();
    if (currentLevel <= level) {
        logFunc = _.partial(logFunc, Logger.levelAsText(level) + ' [' + self.name + ']: ' + message);
        var args = [];
        for (var i=0; i<otherArguments.length; i++) {
            args[i] = otherArguments[i];
        }
        args.splice(0, 1);
        logFunc.apply(logFunc, args);
    }
};

module.exports = Logger;

},{"../util":21}],14:[function(require,module,exports){
var log = require('./log');
var Logger = log.loggerWithName('Operation');
var _ = require('../util')._;

function Operation() {
    if (!this) {
        return new (Function.prototype.bind.apply(Operation, arguments));
    }
    var self = this;
    if (arguments.length) {
        if (typeof(arguments[0]) == 'string') {
            this.name = arguments[0];
            this.work = arguments[1];
            this.completion = arguments[2];
        }
        else if (typeof(arguments[0]) == 'function' ||
            Object.prototype.toString.call(arguments[0]) === '[object Array]' ||
            arguments[0] instanceof Operation) {
            this.work = arguments[0];
            this.completion = arguments[1];
        }
    }
    this.error = null;
    this.completed = false;
    this.result = null;
    this.running = false;
    this.cancelled = false;
    this.dependencies = [];
    this._mustSucceed = [];
    this._onCompletion = [];
    this.logLevel = null; // Override.

    Object.defineProperty(this, 'failed', {
        get: function () {
            return  !!self.error || self.failedDueToDependency;
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(this, 'composite', {
        get: function () {
            return self.work instanceof Operation ||
                Object.prototype.toString.call(self.work) === '[object Array]'
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(this, 'numOperationsRemaining', {
        get: function () {
            if (self.work instanceof Operation) {
                return self.work.completed ? 0 : 1
            }
            else if (Object.prototype.toString.call(self.work) === '[object Array]') {
                return _.reduce(self.work, function (memo, op) {
                    if (!op.completed) {
                        return memo + 1;
                    }
                    return memo;
                }, 0);
            }
            else {
                return null;
            }
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(this, 'canRun', {
        get: function () {
            if (self.dependencies.length) {
                return _.reduce(self.dependencies, function (memo, dep) {
                    var mustSucceed = self._mustSucceed.indexOf(dep) > -1;
                    var canRun = memo && dep.completed;
                    if (mustSucceed && canRun) {
                        canRun = canRun && !(dep.failed || dep.cancelled);
                    }
                    return canRun;
                }, true);
            }
            return true;
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(this, 'failedDueToDependency', {
        get: function () {
            if (self.dependencies.length) {
                var failedDeps = _.reduce(self.dependencies, function (memo, dep) {
                    var mustSucceed = self._mustSucceed.indexOf(dep) > -1;
                    var failed = ((dep.failed || dep.cancelled) && mustSucceed);
                    if (failed) {
                        memo.push(dep);
                    }
                    return memo;
                }, []);
                return failedDeps.length ? failedDeps : false;
            }
            return false;
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(this, 'failedDueToCancellationOfDependency', {
        get: function () {
            if (self.dependencies.length) {
                var cancelled = _.reduce(self.dependencies, function (memo, dep) {
                    var mustSucceed = self._mustSucceed.indexOf(dep) > -1;
                    if (mustSucceed) {
                        if (dep.cancelled) memo.push(dep);
                    }
                    return memo;
                }, []);
                return cancelled.length ? cancelled : false;
            }
            return false;
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(this, 'loggingOveridden', {
        get: function () {
            if (self.logLevel) {
                return self.logLevel <= log.Level.info;
            }
            return false;
        },
        enumerable: true,
        configurable: true
    })


}

Operation.running = [];

Operation.prototype._startSingle = function () {
    var self = this;
    this.work(function (err, payload) {
        self.result = payload;
        self.error = err;
        self.completed = true;
        self.running = false;
        self._complete();
    });
};

Operation.prototype._startComposite = function () {
    var self = this;
    var operations = self.work instanceof Operation ? [self.work] : self.work;
    _.each(operations, function (op) {
        op.onCompletion(function () {
            var numOperationsRemaining = self.numOperationsRemaining;
            var name = self.name || 'Unnamed';
            Logger.debug(name + ' has ' + numOperationsRemaining.toString() + ' operations remaining');
            if (!numOperationsRemaining) {
                var errors = _.pluck(operations, 'error');
                var results = _.pluck(operations, 'result');
                self.result = _.some(results) ? results : null;
                self.error = _.some(errors) ? errors : null;
                self.completed = true;
                self.running = false;
                self._complete();
            }
        });
        op.start();
    });
};

Operation.prototype._logCompletion = function () {
    var logFunc = this._getLogFunc();
    if (Logger.info.isEnabled || this.loggingOveridden) {
        var name = this.name || 'Unnamed';
        var failedDependencies = this.failedDueToDependency;
        if (failedDependencies) {
            logFunc('"' + name + '" failed due to failure/cancellation of dependencies: ' + _.pluck(failedDependencies, 'name').join(', '));
        }
        else if (this.failed) {
            var err = this.error;
            // Remove null errors.
            if (Object.prototype.toString.call(err) === '[object Array]') {
                err = _.filter(err, function (e) {return e });
            }
            else {
                err = [this.error];
            }
            logFunc('"' + name + '" failed due to errors:', err);
        }
        else if (this.cancelled) {
            logFunc('"' + name + '" has been cancelled.');
        }
        else {
            logFunc('"' + name + '" has succeeded.');
        }
    }
};

Operation.prototype._getLogFunc = function () {
    if (this.logLevel) {
        return _.bind(Logger.override, Logger, log.Level.info, this.logLevel);
    }
    return Logger.info;
};

Operation.prototype._logStart = function () {
    if (Logger.info.isEnabled || this.loggingOveridden) {
        var name = this.name || 'Unnamed';
        var logFunc = this._getLogFunc();
        logFunc('"' + name + '" has started.');
    }
};


Operation.prototype._complete = function () {
    var self = this;
    this.completed = true;
    var idx = Operation.running.indexOf(this);
    Operation.running.splice(idx, 1);
    if (this.completion) {
        _.bind(this.completion, this)();
    }
    this._logCompletion();
    _.each(this._onCompletion, function (o) {
        _.bind(o, self)();
    });
};

Operation.prototype.__start = function () {
    this._logStart();
    if (this.work) {
        if (this.composite) {
            this._startComposite();
        }
        else {
            this._startSingle();
        }
        Operation.running.push(this);
    }
    else {
        this.result = null;
        this.error = null;
        this.running = false;
        this._complete();
    }
};

Operation.prototype.start = function () {
    var self = this;
    var neverStarted = !this.running && !this.completed;
    var neverStartedAndFailed = neverStarted && this.failed;
    // A dependency failed or was cancelled before this operation started.
    if (neverStartedAndFailed) {
        this._complete();
    }
    else if (neverStarted) {
        this.running = true;
        if (this.canRun) {
            this.__start();
        }
        else {
            _.each(this.dependencies, function (dep) {
                dep.onCompletion(function () {
                    if (self.canRun) {
                        self.__start();
                    }
                })
            });
        }
    }
};


Operation.prototype.addDependency = function () {
    var self = this;
    if (arguments.length == 1) {
        this.dependencies.push(arguments[0]);
    }
    else if (arguments.length) {
        var args = arguments;
        var lastArg = args[args.length - 1];
        var mustSucceed = false;
        if (typeof(lastArg) == 'boolean') {
            args = Array.prototype.slice.call(args, 0, args.length - 1);
            mustSucceed = lastArg;
        }
        _.each(args, function (arg) {
            self.dependencies.push(arg);
        });
        if (mustSucceed) {
            _.each(args, function (arg) {
                self._mustSucceed.push(arg);
            })
        }
    }
};

Operation.prototype.onCompletion = function (o) {
    if (!this.completed) {
        this._onCompletion.push(o);
    }
    else {
        _.bind(o, this)();
    }
};

Operation.prototype.cancel = function (callback) {
    if (!this.cancelled) {
        this.cancelled = true;
        Logger.debug('Cancelling ' + this.name, this);
        if (this.composite) {
            _.each(this.work, function (subop) {
                subop.cancel();
            });
        }
        this.onCompletion(function () {
            this.running = false;
            if (callback) callback();
        });
    }
};

Object.defineProperty(Operation, 'logLevel', {
    get: function () {
        return Logger.currentLevel();
    },
    set: function (v) {
        Logger.setLevel(v);
    },
    configurable: true,
    enumerable: true
});

module.exports.Operation = Operation;

},{"../util":21,"./log":13}],15:[function(require,module,exports){

var log = require('./log');
var Logger = log.loggerWithName('OperationQueue');
var _ = require('../util')._;


function OperationQueue() {

    if (!this) {
        return new (Function.prototype.bind.apply(OperationQueue, arguments));
    }
    var self = this;

    if (arguments.length) {
        if (typeof(arguments[0]) == 'number') {
            this.maxConcurrentOperations = arguments[0];
        }
        else {
            this.name = arguments[0];
            this.maxConcurrentOperations = arguments[1];
        }
    }

    this._queuedOperations = [];
    this._runningOperations = [];
    this._running = false;
    this._onStart = [];
    this._onStop = [];
    this.logLevel = null;

    Object.defineProperty(this, 'numRunningOperations', {
        get: function () {
            return self._runningOperations.length;
        },
        configurable: true,
        enumerable: true
    });

    Object.defineProperty(this, 'loggingOveridden', {
        get: function () {
            if (self.logLevel) {
                return self.logLevel <= log.Level.info;
            }
            return false;
        },
        enumerable: true,
        configurable: true
    })
}

OperationQueue.prototype._nextOperations = function () {
    var self = this;
    while ((self._runningOperations.length < self.maxConcurrentOperations) && self._queuedOperations.length) {
        var op = self._queuedOperations[0];
        self._queuedOperations.splice(0, 1);
        self._runOperation(op);
    }
};


OperationQueue.prototype._runOperation = function (op) {
    var self = this;
    for (var i = 0; i < this._queuedOperations.length; i++) {
        if (this._queuedOperations[i] == op) {
            this._queuedOperations.splice(i, 1);
            break;
        }
    }
    this._runningOperations.push(op);
    op.completion = function () {
        var idx = self._runningOperations.indexOf(op);
        self._runningOperations.splice(idx, 1);
        if (self._running) {
            self._nextOperations();
        }
        self._logStatus();
    };
    op.start();
    this._logStatus();
};

OperationQueue.prototype._logStatus = function () {
    var logFunc = this._getLogFunc();
    if (Logger.info.isEnabled || this.loggingOveridden) {
        var numRunning = this.numRunningOperations;
        var numQueued = this._queuedOperations.length;
        var name = this.name || "Unnamed Queue";
        if (numRunning && numQueued) {
            logFunc('"' + name + '" now has ' + numRunning.toString() + ' operations running and ' + numQueued.toString() + ' operations queued');
        }
        else if (numRunning) {
            logFunc('"' + name + '" now has ' + numRunning.toString() + ' operations running');
        }
        else if (numQueued) {
            logFunc('"' + name + '" now has ' + numQueued.toString() + ' operations queued');
        }
        else {
            logFunc('"' + name + '" has no operations running or queued');
        }
    }
};

OperationQueue.prototype._logStart = function () {
    var logFunc = this._getLogFunc();
    if (Logger.info.isEnabled || this.loggingOveridden) {
        var name = this.name || "Unnamed Queue";
        logFunc('"' + name + '" is now running');
    }
};

OperationQueue.prototype._getLogFunc = function () {
    if (this.logLevel) {
        return _.bind(Logger.override, Logger, log.Level.info, this.logLevel);
    }
    return Logger.info;
};


OperationQueue.prototype._logStop = function () {
    var logFunc = this._getLogFunc();
    if (Logger.info.isEnabled || this.loggingOveridden) {
        var name = this.name || "Unnamed Queue";
        logFunc('"' + name + '" is no longer running');
    }
};

OperationQueue.prototype._addOperation = function (op) {
    if (this.numRunningOperations < this.maxConcurrentOperations && this._running) {
        this._runOperation(op);
    }
    else {
        this._queuedOperations.push(op);
    }
    this._logStatus();
};

OperationQueue.prototype.addOperation = function (operationOrOperations) {
    var self = this;
    if (Object.prototype.toString.call(operationOrOperations) === '[object Array]') {
        _.each(operationOrOperations, function (op) {self._addOperation(op)});
    }
    else {
        this._addOperation(operationOrOperations);
    }
};

OperationQueue.prototype.start = function () {
    var self = this;
    var wasRunning = this._running;
    this._running = true;
    if (!wasRunning) {
        _.each(self._onStart, function (c) {
            _.bind(c, self)();
        });
        self._nextOperations();
        self._logStart();
    }
};

OperationQueue.prototype.stop = function (cancel) {
    var self = this;
    var wasRunning = this._running;
    this._running = false;
    if (wasRunning) {
        if (cancel) {
            var operations = this._runningOperations.slice(0); // Clone so not fighting callbacks.
            _.each(operations, function (o) {
                o.cancel();
            });
        }
        self._logStop();
        _.each(self._onStop, function (c) {
            _.bind(c, self)();
        });
    }
};

OperationQueue.prototype.onStart = function (o) {
    this._onStart.push(o);
};
OperationQueue.prototype.onStop = function (o) {
    this._onStop.push(o);
};

Object.defineProperty(OperationQueue, 'logLevel', {
    get: function () {
        return Logger.currentLevel();
    },
    set: function (v) {
        Logger.setLevel(v);
    },
    configurable: true,
    enumerable: true
});


module.exports.OperationQueue = OperationQueue;

},{"../util":21,"./log":13}],16:[function(require,module,exports){
/**
 * Base functionality for relationships
 * @module relationships
 */

var InternalSiestaError = require('./error').InternalSiestaError,
    Store = require('./store'),
    Operation = require('./operation/operation').Operation,
    util = require('./util'),
    defineSubProperty = util.defineSubProperty,
    _ = util._,
    Query = require('./query').Query,
    log = require('./operation/log'),
    notificationCentre = require('./notificationCentre'),
    wrapArrayForAttributes = notificationCentre.wrapArray,
    ArrayObserver = require('../vendor/observe-js/src/observe').ArrayObserver,
    coreChanges = require('./changes'),
    ChangeType = coreChanges.ChangeType;

/**
 * @class  [Fault description]
 * @param {RelationshipProxy} proxy
 * @constructor
 */
function Fault(proxy) {
    var self = this;
    this.proxy = proxy;
    Object.defineProperty(this, 'isFault', {
        get: function () {
            return self.proxy.isFault;
        },
        enumerable: true,
        configurable: true
    });
}

_.extend(Fault.prototype, {
    get: function () {
        this.proxy.get.apply(this.proxy, arguments);
    },
    set: function () {
        this.proxy.set.apply(this.proxy, arguments);
    }
});


/**
 * @class  [RelationshipProxy description]
 * @param {Object} opts
 * @constructor
 */
function RelationshipProxy(opts) {
    this._opts = opts;
    if (!this) return new RelationshipProxy(opts);
    var self = this;
    this.fault = new Fault(this);
    this.object = null;
    this._id = undefined;
    this.related = null;
    Object.defineProperty(this, 'isFault', {
        get: function () {
            if (self._id) {
                return !self.related;
            } else if (self._id === null) {
                return false;
            }
            return true;
        },
        set: function (v) {
            if (v) {
                self._id = undefined;
                self.related = null;
            } else {
                if (!self._id) {
                    self._id = null;
                }
            }
        },
        enumerable: true,
        configurable: true
    });
    defineSubProperty.call(this, 'reverseMapping', this._opts);
    defineSubProperty.call(this, 'forwardMapping', this._opts);
    defineSubProperty.call(this, 'forwardName', this._opts);
    defineSubProperty.call(this, 'reverseName', this._opts);
    defineSubProperty.call(this, 'isReverse', this._opts);
    Object.defineProperty(this, 'isForward', {
        get: function () {
            return !self.isReverse;
        },
        set: function (v) {
            self.isReverse = !v;
        },
        enumerable: true,
        configurable: true
    });
    if (this._opts.isReverse === undefined && this._opts.isForward !== undefined) {
        this.isReverse = !this._opts.isForward;
    }
    else if (this._opts.isReverse === undefined && this._opts.isForward === undefined) {
        throw InternalSiestaError('Must specify either isReverse or isForward when configuring relationship proxy.');
    }
}

_.extend(RelationshipProxy.prototype, {
    _dump: function (asJson) {
        var dumped = {};
    },
    install: function (obj) {
        if (obj) {
            if (!this.object) {
                this.object = obj;
                var self = this;
                var name = getForwardName.call(this);
                Object.defineProperty(obj, name, {
                    get: function () {
                        if (self.isFault) {
                            return self.fault;
                        } else {
                            return self.related;
                        }
                    },
                    set: function (v) {
                        self.set(v);
                    },
                    configurable: true,
                    enumerable: true
                });
                if (!obj.__proxies) obj.__proxies = {};
                obj.__proxies[name] = this;
                if (!obj._proxies) {
                    obj._proxies = [];
                }
                obj._proxies.push(this);
            } else {
                throw new InternalSiestaError('Already installed.');
            }
        } else {
            throw new InternalSiestaError('No object passed to relationship install');
        }
    },
    set: function () {
        throw new InternalSiestaError('Must subclass RelationshipProxy');
    },
    get: function () {
        throw new InternalSiestaError('Must subclass RelationshipProxy');
    }
});


function verifyMapping(obj, mapping) {
    if (obj.mapping != mapping) {
        var err = 'Mapping does not match. Expected ' + mapping.type + ' but got ' + obj.mapping.type;
        throw new InternalSiestaError(err);
    }
}

// TODO: Share code between getReverseProxyForObject and getForwardProxyForObject

function getReverseProxyForObject(obj) {
    var reverseName = getReverseName.call(this);
    var reverseMapping = this.reverseMapping;
    // This should never happen. Should g   et caught in the mapping operation?
    if (util.isArray(obj)) {
        return _.map(obj, function (o) {
            return o.__proxies[reverseName];
        })
    } else {
        var proxy = obj.__proxies[reverseName];
        if (!proxy) {
            var err = 'No proxy with name "' + reverseName + '" on mapping ' + reverseMapping.type;
            throw new InternalSiestaError(err);
        }
        return proxy;
    }
}

function getForwardProxyForObject(obj) {
    var forwardName = getForwardName.call(this);
    var forwardMapping = this.forwardMapping;
    if (util.isArray(obj)) {
        return _.map(obj, function (o) {
            return o.__proxies[forwardName];
        })
    } else {
        var proxy = obj.__proxies[forwardName];
        if (!proxy) {
            var err = 'No proxy with name "' + forwardName + '" on mapping ' + forwardMapping.type;
            throw new InternalSiestaError(err);
        }
        return proxy;
    }
}

function getReverseName() {
    return this.isForward ? this.reverseName : this.forwardName;
}

function getForwardName() {
    return this.isForward ? this.forwardName : this.reverseName;
}

function getReverseMapping() {
    return this.isForward ? this.reverseMapping : this.forwardMapping;
}

function getForwardMapping() {
    return this.isForward ? this.forwardMapping : this.reverseMapping;
}

function checkInstalled() {
    if (!this.object) {
        throw new InternalSiestaError('Proxy must be installed on an object before can use it.');
    }
}

/**
 * Configure _id and related with the new related object.
 * @param obj
 * @returns {String|undefined} - Error message or undefined
 */
function set(obj) {
    registerSetChange.call(this, obj);
    if (obj) {
        if (util.isArray(obj)) {
            this._id = _.pluck(obj, '_id');
            this.related = obj;
        } else {
            this._id = obj._id;
            this.related = obj;
        }
    } else {
        this._id = null;
        this.related = null;
    }
}

function splice(idx, numRemove) {
    registerSpliceChange.apply(this, arguments);
    var add = Array.prototype.slice.call(arguments, 2);
    var returnValue = _.partial(this._id.splice, idx, numRemove).apply(this._id, _.pluck(add, '_id'));
    if (this.related) {
        _.partial(this.related.splice, idx, numRemove).apply(this.related, add);
    }
    return returnValue;
}

function objAsString(obj) {
    function _objAsString(obj) {
        if (obj) {
            var mapping = obj.mapping;
            var mappingName = mapping.type;
            var ident = obj._id;
            if (typeof ident == 'string') {
                ident = '"' + ident + '"';
            }
            return mappingName + '[_id=' + ident + ']';
        } else if (obj === undefined) {
            return 'undefined';
        } else if (obj === null) {
            return 'null';
        }
    }

    if (util.isArray(obj)) return _.map(_objAsString, obj).join(', ');
    return _objAsString(obj);
}

function clearReverseRelated() {
    var self = this;
    if (!self.isFault) {
        if (this.related) {
            var reverseProxy = getReverseProxyForObject.call(this, this.related);
            var reverseProxies = util.isArray(reverseProxy) ? reverseProxy : [reverseProxy];
            _.each(reverseProxies, function (p) {
                if (util.isArray(p._id)) {
                    var idx = p._id.indexOf(self.object._id);
                    makeChangesToRelatedWithoutObservations.call(p, function () {
                        splice.call(p, idx, 1);
                    });
                } else {
                    set.call(p, null);
                }
            });
        }
    } else {
        if (self._id) {
            var reverseName = getReverseName.call(this);
            var reverseMapping = getReverseMapping.call(this);
            var identifiers = util.isArray(self._id) ? self._id : [self._id];
            if (this._reverseIsArray) {
                _.each(identifiers, function (_id) {
                    coreChanges.registerChange({
                        collection: reverseMapping.collection,
                        mapping: reverseMapping.type,
                        _id: _id,
                        field: reverseName,
                        removedId: [self.object._id],
                        removed: [self.object],
                        type: ChangeType.Delete,
                        obj: self.object
                    });
                });
            } else {
                _.each(identifiers, function (_id) {
                    coreChanges.registerChange({
                        collection: reverseMapping.collection,
                        mapping: reverseMapping.type,
                        _id: _id,
                        field: reverseName,
                        new: null,
                        newId: null,
                        oldId: self.object._id,
                        old: self.object,
                        type: ChangeType.Set,
                        obj: self.object
                    });
                });
            }

        } else {
            throw new Error(getForwardName.call(this) + ' has no _id');
        }
    }
}

function makeChangesToRelatedWithoutObservations(f) {
    if (this.related) {
        this.related.oneToManyObserver.close();
        this.related.oneToManyObserver = null;
        f();
        wrapArray.call(this, this.related);
    } else {
        // If there's a fault we can make changes anyway.
        f();
    }
}

function setReverse(obj) {
    var self = this;
    var reverseProxy = getReverseProxyForObject.call(this, obj);
    var reverseProxies = util.isArray(reverseProxy) ? reverseProxy : [reverseProxy];
    _.each(reverseProxies, function (p) {
        if (util.isArray(p._id)) {
            makeChangesToRelatedWithoutObservations.call(p, function () {
                splice.call(p, p._id.length, 0, self.object);
            });
        } else {
            clearReverseRelated.call(p);
            set.call(p, self.object);
        }
    });
}

function registerSetChange(obj) {
    var proxyObject = this.object;
    if (!proxyObject) throw new InternalSiestaError('Proxy must have an object associated');
    var mapping = proxyObject.mapping.type;
    var coll = proxyObject.collection;
    var newId;
    if (util.isArray(obj)) {
        newId = _.pluck(obj, '_id');
    } else {
        newId = obj ? obj._id : obj;
    }
    // We take [] == null == undefined in the case of relationships.
    var oldId = this._id;
    if (util.isArray(oldId) && !oldId.length) {
        oldId = null;
    }
    var old = this.related;
    if (util.isArray(old) && !old.length) {
        old = null;
    }
    coreChanges.registerChange({
        collection: coll,
        mapping: mapping,
        _id: proxyObject._id,
        field: getForwardName.call(this),
        newId: newId,
        oldId: oldId,
        old: old,
        new: obj,
        type: ChangeType.Set,
        obj: proxyObject
    });
}

function registerSpliceChange(idx, numRemove) {
    var add = Array.prototype.slice.call(arguments, 2);
    var mapping = this.object.mapping.type;
    var coll = this.object.collection;
    coreChanges.registerChange({
        collection: coll,
        mapping: mapping,
        _id: this.object._id,
        field: getForwardName.call(this),
        index: idx,
        removedId: this._id.slice(idx, idx + numRemove),
        removed: this.related ? this.related.slice(idx, idx + numRemove) : null,
        addedId: add.length ? _.pluck(add, '_id') : [],
        added: add.length ? add : [],
        type: ChangeType.Splice,
        obj: this.object
    });
}


function wrapArray(arr) {
    var self = this;
    wrapArrayForAttributes(arr, this.reverseName, this.object);
    if (!arr.oneToManyObserver) {
        arr.oneToManyObserver = new ArrayObserver(arr);
        var observerFunction = function (splices) {
            splices.forEach(function (splice) {
                var added = splice.addedCount ? arr.slice(splice.index, splice.index + splice.addedCount) : [];
                var mapping = getForwardMapping.call(self);
                coreChanges.registerChange({
                    collection: mapping.collection,
                    mapping: mapping.type,
                    _id: self.object._id,
                    field: getForwardName.call(self),
                    removed: splice.removed,
                    added: added,
                    removedId: _.pluck(splice.removed, '_id'),
                    addedId: _.pluck(splice.added, '_id'),
                    type: ChangeType.Splice,
                    obj: self.object
                });
            });
        };
        arr.oneToManyObserver.open(observerFunction);
    }
}

exports.RelationshipProxy = RelationshipProxy;
exports.Fault = Fault;
exports.getReverseProxyForObject = getReverseProxyForObject;
exports.getForwardProxyForObject = getForwardProxyForObject;
exports.getReverseName = getReverseName;
exports.getForwardName = getForwardName;
exports.getReverseMapping = getReverseMapping;
exports.getForwardMapping = getForwardMapping;
exports.checkInstalled = checkInstalled;
exports.set = set;
exports.registerSetChange = registerSetChange;
exports.splice = splice;
exports.clearReverseRelated = clearReverseRelated;
exports.setReverse = setReverse;
exports.objAsString = objAsString;
exports.wrapArray = wrapArray;
exports.registerSpliceChange = registerSpliceChange;
exports.makeChangesToRelatedWithoutObservations = makeChangesToRelatedWithoutObservations;
},{"../vendor/observe-js/src/observe":24,"./changes":2,"./error":5,"./notificationCentre":10,"./operation/log":13,"./operation/operation":14,"./query":17,"./store":20,"./util":21}],17:[function(require,module,exports){
/**
 * @module query
 */

var log = require('./operation/log')
    , cache = require('./cache')
    , util = require('./util');

var Logger = log.loggerWithName('Query');
Logger.setLevel(log.Level.warn);

/**
 * @class  [Query description]
 * @param {Mapping} mapping
 * @param {Object} opts
 */
function Query(mapping, opts) {
    this.mapping = mapping;
    this.query = opts;
}

_.extend(Query.prototype, {
    execute: function (callback) {
        var deferred = window.q ? window.q.defer() : null;
        callback = util.constructCallbackAndPromiseHandler(callback, deferred);
        this._executeInMemory(callback);
        return deferred ? deferred.promise : null;
    },
    _dump: function (asJson) {
        return asJson ? '{}' : {};
    },
    _executeInMemory: function (callback) {
        var deferred = window.q ? window.q.defer() : null;
        callback = util.constructCallbackAndPromiseHandler(callback, deferred);
        var cacheByType = cache._localCacheByType;
        var mappingName = this.mapping.type;
        var collectionName = this.mapping.collection;
        var cacheByMapping = cacheByType[collectionName];
        var cacheByLocalId;
        if (cacheByMapping) {
            cacheByLocalId = cacheByMapping[mappingName];
        }
        if (cacheByLocalId) {
            var keys = Object.keys(cacheByLocalId);
            var self = this;
            var res = [];
            var err;
            for (var i = 0; i < keys.length; i++) {
                var k = keys[i];
                var obj = cacheByLocalId[k];
                var matches = self.objectMatchesBaseQuery(obj);
                if (typeof(matches) == 'string') {
                    err = matches;
                    break;
                } else {
                    if (matches) res.push(obj);
                }
            }
            callback(err, err ? null : res);
        } else if (callback) {
            callback(null, []);
        }
        return deferred ? deferred.promise : null;
    },
    objectMatchesBaseQuery: function (obj) {
        var fields = Object.keys(this.query);
        for (var i = 0; i < fields.length; i++) {
            var origField = fields[i];
            var splt = origField.split('__');
            var op = 'e';
            var field;
            if (splt.length == 2) {
                field = splt[0];
                op = splt[1];
            } else {
                field = origField;
            }
            var queryObj = this.query[origField];
            var val = obj[field];
            if (op == 'e') {
                if (val != queryObj) {
                    return false;
                }
            } else if (op == 'lt') {
                if (val >= queryObj) {
                    return false;
                }
            } else if (op == 'lte') {
                if (val > queryObj) {
                    return false;
                }
            } else if (op == 'gt') {
                if (val <= queryObj) {
                    return false;
                }
            } else if (op == 'gte') {
                if (val < queryObj) {
                    return false;
                }
            } else {
                return 'Query operator "' + op + '"' + ' does not exist';
            }
        }
        return true;
    }
});

exports.Query = Query;
},{"./cache":1,"./operation/log":13,"./util":21}],18:[function(require,module,exports){
/**
 * @module relationship
 */

/**
 * Constants that describe relationships for mappings.
 * @type {Object}
 */
RelationshipType = {
    OneToMany: 'OneToMany',
    OneToOne: 'OneToOne',
    ManyToMany: 'ManyToMany'
};

exports.RelationshipType = RelationshipType;
},{}],19:[function(require,module,exports){
var log = require('./operation/log')
    , util = require('./util')
    , defineSubProperty = util.defineSubProperty
    , _ = util._
    , error = require('./error')
    , InternalSiestaError = error.InternalSiestaError
    , coreChanges = require('./changes')
    , cache = require('./cache');

var Logger = log.loggerWithName('SiestaModel');
Logger.setLevel(log.Level.warn);

function SiestaModel(mapping) {
    if (!this) {
        return new SiestaModel(mapping);
    }
    var self = this;
    this.mapping = mapping;
    Object.defineProperty(this, 'idField', {
        get: function () {
            return self.mapping.id || 'id';
        },
        enumerable: true,
        configurable: true
    });
    defineSubProperty.call(this, 'type', this.mapping);
    defineSubProperty.call(this, 'collection', this.mapping);
    defineSubProperty.call(this, '_attributeNames', this.mapping);
    Object.defineProperty(this, '_relationshipNames', {
        get: function () {
            var proxies = _.map(Object.keys(self.__proxies), function (x) {return self.__proxies[x]});
            return _.map(proxies, function (p) {
                if (p.isForward) {
                    return p.forwardName;
                } else {
                    return p.reverseName;
                }
            });
        },
        enumerable: true,
        configurable: true
    });


    this.isFault = false;

    Object.defineProperty(this, 'isSaved', {
        get: function () {
            return !!self._rev;
        },
        enumerable: true,
        configurable: true
    });

    this._rev = null;

    this.removed = false;
}

/**
 * Human readable dump of this object
 * @returns {*}
 * @private
 */

_.extend(SiestaModel.prototype, {
    _dump: function (asJson) {
        var self = this;
        var cleanObj = {};
        cleanObj.mapping = this.mapping.type;
        cleanObj.collection = this.collection;
        cleanObj._id = this._id;
        cleanObj = _.reduce(this._attributeNames, function (memo, f) {
            if (self[f]) {
                memo[f] = self[f];
            }
            return memo;
        }, cleanObj);
        cleanObj = _.reduce(this._relationshipNames, function (memo, f) {
            var proxy = self.__proxies[f];
            if (proxy) {
                if (proxy.hasOwnProperty('_id')) {
                    if (util.isArray(proxy._id)) {
                        if (self[f].length) {
                            memo[f] = proxy._id;
                        }
                    } else if (proxy._id) {
                        memo[f] = proxy._id;
                    }
                } else {
                    memo[f] = self[f];
                }
            }
            return memo;
        }, cleanObj);

        return asJson ? JSON.stringify(cleanObj, null, 4) : cleanObj;
    },
    get: function (callback) {
        var deferred = window.q ? window.q.defer() : null;
        callback = util.constructCallbackAndPromiseHandler(callback, deferred);
        callback(null, this);
        return deferred ? deferred.promise : null;
    },
    remove: function (callback) {
        var deferred = window.q ? window.q.defer() : null;
        callback = util.constructCallbackAndPromiseHandler(callback, deferred);
        cache.remove(this);
        this.removed = true;
        coreChanges.registerChange({
            collection: this.collection,
            mapping: this.mapping.type,
            _id: this._id,
            oldId: this._id,
            old: this,
            type: coreChanges.ChangeType.Remove,
            obj: this
        });
        callback(null, this);
        return deferred ? deferred.promise : null;
    },
    restore: function (callback) {
        var deferred = window.q ? window.q.defer() : null;
        callback = util.constructCallbackAndPromiseHandler(callback, deferred);
        if (this.removed) {
            cache.insert(this);
            this.removed = false;
        }
        coreChanges.registerChange({
            collection: this.collection,
            mapping: this.mapping.type,
            _id: this._id,
            newId: this._id,
            new: this,
            type: coreChanges.ChangeType.New,
            obj: this
        });
        callback(null, this);
        return deferred ? deferred.promise : null;
    }
});

exports.ModelInstance = SiestaModel;
exports.dumpSaveQueues = function () {
    var dumped = {};
    for (var id in queues) {
        if (queues.hasOwnProperty(id)) {
            var queue = queues[id];
            dumped[id] = {
                numRunning: queue.numRunningOperations,
                queued: queue._queuedOperations.length
            };
        }
    }
    return dumped;
};
},{"./cache":1,"./changes":2,"./error":5,"./operation/log":13,"./util":21}],20:[function(require,module,exports){
/**
 * The "store" is responsible for mediating between the in-memory cache and any persistent storage.
 * Note that persistent storage has not been properly implemented yet and so this is pretty useless.
 * All queries will go straight to the cache instead.
 * @module store
 */

var InternalSiestaError = require('./error').InternalSiestaError
    , log = require('./operation/log')
    , util = require('./util')
    , _ = util._
    , cache = require('./cache');


var Logger = log.loggerWithName('Store');
Logger.setLevel(log.Level.warn);

/**
 * [get description]
 * @param  {Object}   opts
 * @param  {Function} callback
 * @return {Promise}
 * @example
 * ```js
 * var xyz = 'afsdf';
 * ```
 * @example
 * ```js
 * var abc = 'asdsd';
 * ```
 */
function get(opts, callback) {
    var deferred = window.q ? window.q.defer() : null;
    callback = util.constructCallbackAndPromiseHandler(callback, deferred);
    if (Logger.debug.isEnabled)
        Logger.debug('get', opts);
    var siestaModel;
    if (opts._id) {
        if (util.isArray(opts._id)) {
            // Proxy onto getMultiple instead.
            getMultiple(_.map(opts._id, function (id) {
                return {
                    _id: id
                }
            }), callback);
        } else {
            siestaModel = cache.get(opts);
            if (siestaModel) {
                if (Logger.debug.isEnabled)
                    Logger.debug('Had cached object', {
                        opts: opts,
                        obj: siestaModel
                    });
                if (callback) callback(null, siestaModel);
            } else {
                if (util.isArray(opts._id)) {
                    // Proxy onto getMultiple instead.
                    getMultiple(_.map(opts._id, function (id) {
                        return {
                            _id: id
                        }
                    }), callback);
                } else if (callback) {
                    var storage = siesta.ext.storage;
                    if (storage) {
                        storage.store.getFromPouch(opts, callback);
                    } else {
                        throw new Error('Storage module not installed');
                    }
                }
            }
        }
    } else if (opts.mapping) {
        if (util.isArray(opts[opts.mapping.id])) {
            // Proxy onto getMultiple instead.
            getMultiple(_.map(opts[opts.mapping.id], function (id) {
                var o = {};
                o[opts.mapping.id] = id;
                o.mapping = opts.mapping;
                return o
            }), callback);
        } else {
            siestaModel = cache.get(opts);
            if (siestaModel) {
                if (Logger.debug.isEnabled)
                    Logger.debug('Had cached object', {
                        opts: opts,
                        obj: siestaModel
                    });
                if (callback) callback(null, siestaModel);
            } else {
                var mapping = opts.mapping;
                if (mapping.singleton) {
                    mapping.get(callback);
                } else {
                    var idField = mapping.id;
                    var id = opts[idField];
                    if (id) {
                        mapping.get(id, function (err, obj) {
                            if (!err) {
                                if (obj) {
                                    callback(null, obj);
                                } else {
                                    callback(null, null);
                                }
                            } else {
                                callback(err);
                            }
                        });
                    } else {
                        throw new InternalSiestaError('Invalid options given to store. Missing "' + idField.toString() + '."');
                    }
                }

            }
        }
    } else {
        // No way in which to find an object locally.
        var context = {
            opts: opts
        };
        var msg = 'Invalid options given to store';
        throw new InternalSiestaError(msg, context);
    }
    return deferred ? deferred.promise : null;
}

function getMultiple(optsArray, callback) {
    var deferred = window.q ? window.q.defer() : null;
    callback = util.constructCallbackAndPromiseHandler(callback, deferred);
    var docs = [];
    var errors = [];
    _.each(optsArray, function (opts) {
        get(opts, function (err, doc) {
            if (err) {
                errors.push(err);
            } else {
                docs.push(doc);
            }
            if (docs.length + errors.length == optsArray.length) {
                if (callback) {
                    if (errors.length) {
                        callback(errors);
                    } else {
                        callback(null, docs);
                    }
                }
            }
        });
    });
    return deferred ? deferred.promise : null;
}
/**
 * Uses pouch bulk fetch API. Much faster than getMultiple.
 * @param localIdentifiers
 * @param callback
 */
function getMultipleLocal(localIdentifiers, callback) {
    var deferred = window.q ? window.q.defer() : null;
    callback = util.constructCallbackAndPromiseHandler(callback, deferred);
    var results = _.reduce(localIdentifiers, function (memo, _id) {
        var obj = cache.get({
            _id: _id
        });
        if (obj) {
            memo.cached[_id] = obj;
        } else {
            memo.notCached.push(_id);
        }
        return memo;
    }, {
        cached: {},
        notCached: []
    });

    function finish(err) {
        if (callback) {
            if (err) {
                callback(err);
            } else {
                callback(null, _.map(localIdentifiers, function (_id) {
                    return results.cached[_id];
                }));
            }
        }
    }

    if (siesta.ext.storageEnabled && results.notCached.length) {
        siesta.ext.storage.store.getMultipleLocalFromCouch(results, finish);
    } else {
        finish();
    }
    return deferred ? deferred.promise : null;
}

function getMultipleRemote(remoteIdentifiers, mapping, callback) {
    var deferred = window.q ? window.q.defer() : null;
    callback = util.constructCallbackAndPromiseHandler(callback, deferred);
    var results = _.reduce(remoteIdentifiers, function (memo, id) {
        var cacheQuery = {
            mapping: mapping
        };
        cacheQuery[mapping.id] = id;
        var obj = cache.get(cacheQuery);
        if (obj) {
            memo.cached[id] = obj;
        } else {
            memo.notCached.push(id);
        }
        return memo;
    }, {
        cached: {},
        notCached: []
    });

    function finish(err) {
        if (callback) {
            if (err) {
                callback(err);
            } else {
                callback(null, _.map(remoteIdentifiers, function (id) {
                    return results.cached[id];
                }));
            }
        }
    }

    if (siesta.ext.storageEnabled && results.notCached.length) {
        siesta.ext.storage.store.getMultipleRemoteFrompouch(mapping, remoteIdentifiers, results, finish);
    } else {
        finish();
    }
    return deferred ? deferred.promise : null;
}

exports.get = get;
exports.getMultiple = getMultiple;
exports.getMultipleLocal = getMultipleLocal;
exports.getMultipleRemote = getMultipleRemote;
},{"./cache":1,"./error":5,"./operation/log":13,"./util":21}],21:[function(require,module,exports){
/*
 * This is a collection of utilities taken from libraries such as async.js, underscore.js etc.
 * @module util
 */

function printStackTrace() {
    var e = new Error('printStackTrace');
    var stack = e.stack;
    console.log(stack);
}

function capitaliseFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}


exports.printStackTrace = printStackTrace;
exports.capitaliseFirstLetter = capitaliseFirstLetter;

var root = {};
// START async.js //

var isArray = Array.isArray || function (obj) {
        return _toString.call(obj) === '[object Array]';
    };

function doParallel(fn) {
    return function () {
        var args = Array.prototype.slice.call(arguments);
        return fn.apply(null, [each].concat(args));
    };
}

var map = doParallel(_asyncMap);

function _map(arr, iterator) {
    if (arr.map) {
        return arr.map(iterator);
    }
    var results = [];
    each(arr, function (x, i, a) {
        results.push(iterator(x, i, a));
    });
    return results;
}

function _asyncMap(eachfn, arr, iterator, callback) {
    arr = _map(arr, function (x, i) {
        return {
            index: i,
            value: x
        };
    });
    if (!callback) {
        eachfn(arr, function (x, callback) {
            iterator(x.value, function (err) {
                callback(err);
            });
        });
    } else {
        var results = [];
        eachfn(arr, function (x, callback) {
            iterator(x.value, function (err, v) {
                results[x.index] = v;
                callback(err);
            });
        }, function (err) {
            callback(err, results);
        });
    }
}

var mapSeries = doSeries(_asyncMap);

function doSeries(fn) {
    return function () {
        var args = Array.prototype.slice.call(arguments);
        return fn.apply(null, [eachSeries].concat(args));
    };
}


function eachSeries(arr, iterator, callback) {
    callback = callback || function () {};
    if (!arr.length) {
        return callback();
    }
    var completed = 0;
    var iterate = function () {
        iterator(arr[completed], function (err) {
            if (err) {
                callback(err);
                callback = function () {};
            } else {
                completed += 1;
                if (completed >= arr.length) {
                    callback();
                } else {
                    iterate();
                }
            }
        });
    };
    iterate();
}


function _each(arr, iterator) {
    if (arr.forEach) {
        return arr.forEach(iterator);
    }
    for (var i = 0; i < arr.length; i += 1) {
        iterator(arr[i], i, arr);
    }
}

function each(arr, iterator, callback) {
    callback = callback || function () {};
    if (!arr.length) {
        return callback();
    }
    var completed = 0;
    _each(arr, function (x) {
        iterator(x, only_once(done));
    });

    function done(err) {
        if (err) {
            callback(err);
            callback = function () {};
        } else {
            completed += 1;
            if (completed >= arr.length) {
                callback();
            }
        }
    }
}

function keys(obj) {
    if (Object.keys) {
        return Object.keys(obj);
    }
    var keys = [];
    for (var k in obj) {
        if (obj.hasOwnProperty(k)) {
            keys.push(k);
        }
    }
    return keys;
}


var _parallel = function (eachfn, tasks, callback) {
    callback = callback || function () {};
    if (isArray(tasks)) {
        eachfn.map(tasks, function (fn, callback) {
            if (fn) {
                fn(function (err) {
                    var args = Array.prototype.slice.call(arguments, 1);
                    if (args.length <= 1) {
                        args = args[0];
                    }
                    callback.call(null, err, args);
                });
            }
        }, callback);
    } else {
        var results = {};
        eachfn.each(keys(tasks), function (k, callback) {
            tasks[k](function (err) {
                var args = Array.prototype.slice.call(arguments, 1);
                if (args.length <= 1) {
                    args = args[0];
                }
                results[k] = args;
                callback(err);
            });
        }, function (err) {
            callback(err, results);
        });
    }
};

function series(tasks, callback) {
    callback = callback || function () {};
    if (_isArray(tasks)) {
        mapSeries(tasks, function (fn, callback) {
            if (fn) {
                fn(function (err) {
                    var args = Array.prototype.slice.call(arguments, 1);
                    if (args.length <= 1) {
                        args = args[0];
                    }
                    callback.call(null, err, args);
                });
            }
        }, callback);
    } else {
        var results = {};
        eachSeries(_keys(tasks), function (k, callback) {
            tasks[k](function (err) {
                var args = Array.prototype.slice.call(arguments, 1);
                if (args.length <= 1) {
                    args = args[0];
                }
                results[k] = args;
                callback(err);
            });
        }, function (err) {
            callback(err, results);
        });
    }
}

function only_once(fn) {
    var called = false;
    return function () {
        if (called) throw new Error("Callback was already called.");
        called = true;
        fn.apply(root, arguments);
    }
}

function parallel(tasks, callback) {
    _parallel({
        map: map,
        each: each
    }, tasks, callback);
}

exports.series = series;
exports.parallel = parallel;
exports.isArray = isArray;

// END async.js //

// START underscore.js //

var _ = {};
var ArrayProto = Array.prototype;
var FuncProto = Function.prototype;

var nativeForEach = ArrayProto.forEach;
var nativeMap = ArrayProto.map;
var nativeReduce = ArrayProto.reduce;
var nativeBind = FuncProto.bind;
var slice = ArrayProto.slice;
var breaker = {};

_.keys = keys;

_.each = _.forEach = function (obj, iterator, context) {
    if (obj == null) return obj;
    if (nativeForEach && obj.forEach === nativeForEach) {
        obj.forEach(iterator, context);
    } else if (obj.length === +obj.length) {
        for (var i = 0, length = obj.length; i < length; i++) {
            if (iterator.call(context, obj[i], i, obj) === breaker) return;
        }
    } else {
        var keys = _.keys(obj);
        for (var i = 0, length = keys.length; i < length; i++) {
            if (iterator.call(context, obj[keys[i]], keys[i], obj) === breaker) return;
        }
    }
    return obj;
};

// Return the results of applying the iterator to each element.
// Delegates to **ECMAScript 5**'s native `map` if available.
_.map = _.collect = function (obj, iterator, context) {
    var results = [];
    if (obj == null) return results;
    if (nativeMap && obj.map === nativeMap) return obj.map(iterator, context);
    _.each(obj, function (value, index, list) {
        results.push(iterator.call(context, value, index, list));
    });
    return results;
};

// Partially apply a function by creating a version that has had some of its
// arguments pre-filled, without changing its dynamic `this` context. _ acts
// as a placeholder, allowing any combination of arguments to be pre-filled.
_.partial = function (func) {
    var boundArgs = slice.call(arguments, 1);
    return function () {
        var position = 0;
        var args = boundArgs.slice();
        for (var i = 0, length = args.length; i < length; i++) {
            if (args[i] === _) args[i] = arguments[position++];
        }
        while (position < arguments.length) args.push(arguments[position++]);
        return func.apply(this, args);
    };
};

// Convenience version of a common use case of `map`: fetching a property.
_.pluck = function (obj, key) {
    return _.map(obj, _.property(key));
};

var reduceError = 'Reduce of empty array with no initial value';

// **Reduce** builds up a single result from a list of values, aka `inject`,
// or `foldl`. Delegates to **ECMAScript 5**'s native `reduce` if available.
_.reduce = _.foldl = _.inject = function (obj, iterator, memo, context) {
    var initial = arguments.length > 2;
    if (obj == null) obj = [];
    if (nativeReduce && obj.reduce === nativeReduce) {
        if (context) iterator = _.bind(iterator, context);
        return initial ? obj.reduce(iterator, memo) : obj.reduce(iterator);
    }
    _.each(obj, function (value, index, list) {
        if (!initial) {
            memo = value;
            initial = true;
        } else {
            memo = iterator.call(context, memo, value, index, list);
        }
    });
    if (!initial) throw new TypeError(reduceError);
    return memo;
};

_.property = function (key) {
    return function (obj) {
        return obj[key];
    };
};

// Optimize `isFunction` if appropriate.
if (typeof(/./) !== 'function') {
    _.isFunction = function (obj) {
        return typeof obj === 'function';
    };
}

_.isObject = function (obj) {
    var type = typeof obj;
    return type === 'function' || type === 'object' && !!obj;
};

// An internal function to generate lookup iterators.
var lookupIterator = function (value) {
    if (value == null) return _.identity;
    if (_.isFunction(value)) return value;
    return _.property(value);
};

// Sort the object's values by a criterion produced by an iterator.
_.sortBy = function (obj, iterator, context) {
    iterator = lookupIterator(iterator);
    return _.pluck(_.map(obj, function (value, index, list) {
        return {
            value: value,
            index: index,
            criteria: iterator.call(context, value, index, list)
        };
    }).sort(function (left, right) {
        var a = left.criteria;
        var b = right.criteria;
        if (a !== b) {
            if (a > b || a === void 0) return 1;
            if (a < b || b === void 0) return -1;
        }
        return left.index - right.index;
    }), 'value');
};

var ctor = function () {};

// Create a function bound to a given object (assigning `this`, and arguments,
// optionally). Delegates to **ECMAScript 5**'s native `Function.bind` if
// available.
_.bind = function (func, context) {
    var args, bound;
    if (nativeBind && func.bind === nativeBind) return nativeBind.apply(func, slice.call(arguments, 1));
    if (!_.isFunction(func)) throw new TypeError;
    args = slice.call(arguments, 2);
    return bound = function () {
        if (!(this instanceof bound)) return func.apply(context, args.concat(slice.call(arguments)));
        ctor.prototype = func.prototype;
        var self = new ctor;
        ctor.prototype = null;
        u
        var result = func.apply(self, args.concat(slice.call(arguments)));
        if (Object(result) === result) return result;
        return self;
    };
};

_.identity = function (value) {
    return value;
};

_.zip = function (array) {
    if (array == null) return [];
    var length = _.max(arguments, 'length').length;
    var results = Array(length);
    for (var i = 0; i < length; i++) {
        results[i] = _.pluck(arguments, i);
    }
    return results;
};

// Return the maximum element (or element-based computation).
_.max = function (obj, iteratee, context) {
    var result = -Infinity,
        lastComputed = -Infinity,
        value, computed;
    if (iteratee == null && obj != null) {
        obj = obj.length === +obj.length ? obj : _.values(obj);
        for (var i = 0, length = obj.length; i < length; i++) {
            value = obj[i];
            if (value > result) {
                result = value;
            }
        }
    } else {
        iteratee = _.iteratee(iteratee, context);
        _.each(obj, function (value, index, list) {
            computed = iteratee(value, index, list);
            if (computed > lastComputed || computed === -Infinity && result === -Infinity) {
                result = value;
                lastComputed = computed;
            }
        });
    }
    return result;
};


_.iteratee = function (value, context, argCount) {
    if (value == null) return _.identity;
    if (_.isFunction(value)) return createCallback(value, context, argCount);
    if (_.isObject(value)) return _.matches(value);
    return _.property(value);
};

_.pairs = function (obj) {
    var keys = _.keys(obj);
    var length = keys.length;
    var pairs = Array(length);
    for (var i = 0; i < length; i++) {
        pairs[i] = [keys[i], obj[keys[i]]];
    }
    return pairs;
};

_.matches = function (attrs) {
    var pairs = _.pairs(attrs),
        length = pairs.length;
    return function (obj) {
        if (obj == null) return !length;
        obj = new Object(obj);
        for (var i = 0; i < length; i++) {
            var pair = pairs[i],
                key = pair[0];
            if (pair[1] !== obj[key] || !(key in obj)) return false;
        }
        return true;
    };
};

_.some = function (obj, predicate, context) {
    if (obj == null) return false;
    predicate = _.iteratee(predicate, context);
    var keys = obj.length !== +obj.length && _.keys(obj),
        length = (keys || obj).length,
        index, currentKey;
    for (index = 0; index < length; index++) {
        currentKey = keys ? keys[index] : index;
        if (predicate(obj[currentKey], currentKey, obj)) return true;
    }
    return false;
};


// Extend a given object with all the properties in passed-in object(s).
_.extend = function (obj) {
    if (!_.isObject(obj)) return obj;
    var source, prop;
    for (var i = 1, length = arguments.length; i < length; i++) {
        source = arguments[i];
        for (prop in source) {
            //noinspection JSUnfilteredForInLoop
            if (hasOwnProperty.call(source, prop)) {
                //noinspection JSUnfilteredForInLoop
                obj[prop] = source[prop];
            }
        }
    }
    return obj;
};

// END underscore.js //

exports._ = _;
var observe = require('../vendor/observe-js/src/observe').Platform;

function next(callback) {
    observe.performMicrotaskCheckpoint();
    setTimeout(callback);
}

/**
 * Performs dirty check/Object.observe callbacks depending on the browser.
 *
 * If Object.observe is present,
 * @param callback
 */
exports.next = next;

/**
 * Returns a handler that acts upon a callback or a promise depending on the result of a different callback.
 * @param callback
 * @param [promise]
 * @returns {Function}
 */
exports.constructCallbackAndPromiseHandler = function (callback, promise) {
    return function (err) {
        if (callback) callback.apply(callback, arguments);
        if (promise) {
            if (err) promise.reject(err);
            else promise.resolve.apply(promise, Array.prototype.slice.call(arguments, 1));
        }
    };
};

var InternalSiestaError = require('./error').InternalSiestaError;

function assert(condition, message, context) {
    if (!condition) {
        message = message || "Assertion failed";
        context = context || {};
        throw new InternalSiestaError(message, context);
    }
}

function defineSubProperty(property, subObj, innerProperty) {
    return Object.defineProperty(this, property, {
        get: function () {
            if (innerProperty) {
                return subObj[innerProperty];
            }
            else {
                return subObj[property];
            }
        },
        set: function (value) {
            if (innerProperty) {
                subObj[innerProperty] = value;
            }
            else {
                subObj[property] = value;
            }
        },
        enumerable: true,
        configurable: true
    });
}

var guid = (function () {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000)
            .toString(16)
            .substring(1);
    }

    return function () {
        return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
            s4() + '-' + s4() + s4() + s4();
    };
})();

_.extend(module.exports, {
    assert: assert,
    defineSubProperty: defineSubProperty,
    guid: guid
});



},{"../vendor/observe-js/src/observe":24,"./error":5}],22:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      }
      throw TypeError('Uncaught, unspecified "error" event.');
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        len = arguments.length;
        args = new Array(len - 1);
        for (i = 1; i < len; i++)
          args[i - 1] = arguments[i];
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    len = arguments.length;
    args = new Array(len - 1);
    for (i = 1; i < len; i++)
      args[i - 1] = arguments[i];

    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    var m;
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  var ret;
  if (!emitter._events || !emitter._events[type])
    ret = 0;
  else if (isFunction(emitter._events[type]))
    ret = 1;
  else
    ret = emitter._events[type].length;
  return ret;
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],23:[function(require,module,exports){
var hasOwn = Object.prototype.hasOwnProperty;
var toString = Object.prototype.toString;
var undefined;

var isPlainObject = function isPlainObject(obj) {
	"use strict";
	if (!obj || toString.call(obj) !== '[object Object]' || obj.nodeType || obj.setInterval) {
		return false;
	}

	var has_own_constructor = hasOwn.call(obj, 'constructor');
	var has_is_property_of_method = obj.constructor && obj.constructor.prototype && hasOwn.call(obj.constructor.prototype, 'isPrototypeOf');
	// Not own constructor property must be Object
	if (obj.constructor && !has_own_constructor && !has_is_property_of_method) {
		return false;
	}

	// Own properties are enumerated firstly, so to speed up,
	// if last one is own, then all properties are own.
	var key;
	for (key in obj) {}

	return key === undefined || hasOwn.call(obj, key);
};

module.exports = function extend() {
	"use strict";
	var options, name, src, copy, copyIsArray, clone,
		target = arguments[0],
		i = 1,
		length = arguments.length,
		deep = false;

	// Handle a deep copy situation
	if (typeof target === "boolean") {
		deep = target;
		target = arguments[1] || {};
		// skip the boolean and the target
		i = 2;
	} else if (typeof target !== "object" && typeof target !== "function" || target == undefined) {
			target = {};
	}

	for (; i < length; ++i) {
		// Only deal with non-null/undefined values
		if ((options = arguments[i]) != null) {
			// Extend the base object
			for (name in options) {
				src = target[name];
				copy = options[name];

				// Prevent never-ending loop
				if (target === copy) {
					continue;
				}

				// Recurse if we're merging plain objects or arrays
				if (deep && copy && (isPlainObject(copy) || (copyIsArray = Array.isArray(copy)))) {
					if (copyIsArray) {
						copyIsArray = false;
						clone = src && Array.isArray(src) ? src : [];
					} else {
						clone = src && isPlainObject(src) ? src : {};
					}

					// Never move original objects, clone them
					target[name] = extend(deep, clone, copy);

				// Don't bring in undefined values
				} else if (copy !== undefined) {
					target[name] = copy;
				}
			}
		}
	}

	// Return the modified object
	return target;
};


},{}],24:[function(require,module,exports){
(function (global){
/*
 * Copyright (c) 2014 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */

(function(global) {
  'use strict';

  var testingExposeCycleCount = global.testingExposeCycleCount;

  // Detect and do basic sanity checking on Object/Array.observe.
  function detectObjectObserve() {
    if (typeof Object.observe !== 'function' ||
        typeof Array.observe !== 'function') {
      return false;
    }

    var records = [];

    function callback(recs) {
      records = recs;
    }

    var test = {};
    var arr = [];
    Object.observe(test, callback);
    Array.observe(arr, callback);
    test.id = 1;
    test.id = 2;
    delete test.id;
    arr.push(1, 2);
    arr.length = 0;

    Object.deliverChangeRecords(callback);
    if (records.length !== 5)
      return false;

    if (records[0].type != 'add' ||
        records[1].type != 'update' ||
        records[2].type != 'delete' ||
        records[3].type != 'splice' ||
        records[4].type != 'splice') {
      return false;
    }

    Object.unobserve(test, callback);
    Array.unobserve(arr, callback);

    return true;
  }

  var hasObserve = detectObjectObserve();

  function detectEval() {
    // Don't test for eval if we're running in a Chrome App environment.
    // We check for APIs set that only exist in a Chrome App context.
    if (typeof chrome !== 'undefined' && chrome.app && chrome.app.runtime) {
      return false;
    }

    // Firefox OS Apps do not allow eval. This feature detection is very hacky
    // but even if some other platform adds support for this function this code
    // will continue to work.
    if (navigator.getDeviceStorage) {
      return false;
    }

    try {
      var f = new Function('', 'return true;');
      return f();
    } catch (ex) {
      return false;
    }
  }

  var hasEval = detectEval();

  function isIndex(s) {
    return +s === s >>> 0 && s !== '';
  }

  function toNumber(s) {
    return +s;
  }

  function isObject(obj) {
    return obj === Object(obj);
  }

  var numberIsNaN = global.Number.isNaN || function(value) {
    return typeof value === 'number' && global.isNaN(value);
  }

  function areSameValue(left, right) {
    if (left === right)
      return left !== 0 || 1 / left === 1 / right;
    if (numberIsNaN(left) && numberIsNaN(right))
      return true;

    return left !== left && right !== right;
  }

  var createObject = ('__proto__' in {}) ?
    function(obj) { return obj; } :
    function(obj) {
      var proto = obj.__proto__;
      if (!proto)
        return obj;
      var newObject = Object.create(proto);
      Object.getOwnPropertyNames(obj).forEach(function(name) {
        Object.defineProperty(newObject, name,
                             Object.getOwnPropertyDescriptor(obj, name));
      });
      return newObject;
    };

  var identStart = '[\$_a-zA-Z]';
  var identPart = '[\$_a-zA-Z0-9]';
  var identRegExp = new RegExp('^' + identStart + '+' + identPart + '*' + '$');

  function getPathCharType(char) {
    if (char === undefined)
      return 'eof';

    var code = char.charCodeAt(0);

    switch(code) {
      case 0x5B: // [
      case 0x5D: // ]
      case 0x2E: // .
      case 0x22: // "
      case 0x27: // '
      case 0x30: // 0
        return char;

      case 0x5F: // _
      case 0x24: // $
        return 'ident';

      case 0x20: // Space
      case 0x09: // Tab
      case 0x0A: // Newline
      case 0x0D: // Return
      case 0xA0:  // No-break space
      case 0xFEFF:  // Byte Order Mark
      case 0x2028:  // Line Separator
      case 0x2029:  // Paragraph Separator
        return 'ws';
    }

    // a-z, A-Z
    if ((0x61 <= code && code <= 0x7A) || (0x41 <= code && code <= 0x5A))
      return 'ident';

    // 1-9
    if (0x31 <= code && code <= 0x39)
      return 'number';

    return 'else';
  }

  var pathStateMachine = {
    'beforePath': {
      'ws': ['beforePath'],
      'ident': ['inIdent', 'append'],
      '[': ['beforeElement'],
      'eof': ['afterPath']
    },

    'inPath': {
      'ws': ['inPath'],
      '.': ['beforeIdent'],
      '[': ['beforeElement'],
      'eof': ['afterPath']
    },

    'beforeIdent': {
      'ws': ['beforeIdent'],
      'ident': ['inIdent', 'append']
    },

    'inIdent': {
      'ident': ['inIdent', 'append'],
      '0': ['inIdent', 'append'],
      'number': ['inIdent', 'append'],
      'ws': ['inPath', 'push'],
      '.': ['beforeIdent', 'push'],
      '[': ['beforeElement', 'push'],
      'eof': ['afterPath', 'push']
    },

    'beforeElement': {
      'ws': ['beforeElement'],
      '0': ['afterZero', 'append'],
      'number': ['inIndex', 'append'],
      "'": ['inSingleQuote', 'append', ''],
      '"': ['inDoubleQuote', 'append', '']
    },

    'afterZero': {
      'ws': ['afterElement', 'push'],
      ']': ['inPath', 'push']
    },

    'inIndex': {
      '0': ['inIndex', 'append'],
      'number': ['inIndex', 'append'],
      'ws': ['afterElement'],
      ']': ['inPath', 'push']
    },

    'inSingleQuote': {
      "'": ['afterElement'],
      'eof': ['error'],
      'else': ['inSingleQuote', 'append']
    },

    'inDoubleQuote': {
      '"': ['afterElement'],
      'eof': ['error'],
      'else': ['inDoubleQuote', 'append']
    },

    'afterElement': {
      'ws': ['afterElement'],
      ']': ['inPath', 'push']
    }
  }

  function noop() {}

  function parsePath(path) {
    var keys = [];
    var index = -1;
    var c, newChar, key, type, transition, action, typeMap, mode = 'beforePath';

    var actions = {
      push: function() {
        if (key === undefined)
          return;

        keys.push(key);
        key = undefined;
      },

      append: function() {
        if (key === undefined)
          key = newChar
        else
          key += newChar;
      }
    };

    function maybeUnescapeQuote() {
      if (index >= path.length)
        return;

      var nextChar = path[index + 1];
      if ((mode == 'inSingleQuote' && nextChar == "'") ||
          (mode == 'inDoubleQuote' && nextChar == '"')) {
        index++;
        newChar = nextChar;
        actions.append();
        return true;
      }
    }

    while (mode) {
      index++;
      c = path[index];

      if (c == '\\' && maybeUnescapeQuote(mode))
        continue;

      type = getPathCharType(c);
      typeMap = pathStateMachine[mode];
      transition = typeMap[type] || typeMap['else'] || 'error';

      if (transition == 'error')
        return; // parse error;

      mode = transition[0];
      action = actions[transition[1]] || noop;
      newChar = transition[2] === undefined ? c : transition[2];
      action();

      if (mode === 'afterPath') {
        return keys;
      }
    }

    return; // parse error
  }

  function isIdent(s) {
    return identRegExp.test(s);
  }

  var constructorIsPrivate = {};

  function Path(parts, privateToken) {
    if (privateToken !== constructorIsPrivate)
      throw Error('Use Path.get to retrieve path objects');

    for (var i = 0; i < parts.length; i++) {
      this.push(String(parts[i]));
    }

    if (hasEval && this.length) {
      this.getValueFrom = this.compiledGetValueFromFn();
    }
  }

  // TODO(rafaelw): Make simple LRU cache
  var pathCache = {};

  function getPath(pathString) {
    if (pathString instanceof Path)
      return pathString;

    if (pathString == null || pathString.length == 0)
      pathString = '';

    if (typeof pathString != 'string') {
      if (isIndex(pathString.length)) {
        // Constructed with array-like (pre-parsed) keys
        return new Path(pathString, constructorIsPrivate);
      }

      pathString = String(pathString);
    }

    var path = pathCache[pathString];
    if (path)
      return path;

    var parts = parsePath(pathString);
    if (!parts)
      return invalidPath;

    var path = new Path(parts, constructorIsPrivate);
    pathCache[pathString] = path;
    return path;
  }

  Path.get = getPath;

  function formatAccessor(key) {
    if (isIndex(key)) {
      return '[' + key + ']';
    } else {
      return '["' + key.replace(/"/g, '\\"') + '"]';
    }
  }

  Path.prototype = createObject({
    __proto__: [],
    valid: true,

    toString: function() {
      var pathString = '';
      for (var i = 0; i < this.length; i++) {
        var key = this[i];
        if (isIdent(key)) {
          pathString += i ? '.' + key : key;
        } else {
          pathString += formatAccessor(key);
        }
      }

      return pathString;
    },

    getValueFrom: function(obj, directObserver) {
      for (var i = 0; i < this.length; i++) {
        if (obj == null)
          return;
        obj = obj[this[i]];
      }
      return obj;
    },

    iterateObjects: function(obj, observe) {
      for (var i = 0; i < this.length; i++) {
        if (i)
          obj = obj[this[i - 1]];
        if (!isObject(obj))
          return;
        observe(obj, this[0]);
      }
    },

    compiledGetValueFromFn: function() {
      var str = '';
      var pathString = 'obj';
      str += 'if (obj != null';
      var i = 0;
      var key;
      for (; i < (this.length - 1); i++) {
        key = this[i];
        pathString += isIdent(key) ? '.' + key : formatAccessor(key);
        str += ' &&\n     ' + pathString + ' != null';
      }
      str += ')\n';

      var key = this[i];
      pathString += isIdent(key) ? '.' + key : formatAccessor(key);

      str += '  return ' + pathString + ';\nelse\n  return undefined;';
      return new Function('obj', str);
    },

    setValueFrom: function(obj, value) {
      if (!this.length)
        return false;

      for (var i = 0; i < this.length - 1; i++) {
        if (!isObject(obj))
          return false;
        obj = obj[this[i]];
      }

      if (!isObject(obj))
        return false;

      obj[this[i]] = value;
      return true;
    }
  });

  var invalidPath = new Path('', constructorIsPrivate);
  invalidPath.valid = false;
  invalidPath.getValueFrom = invalidPath.setValueFrom = function() {};

  var MAX_DIRTY_CHECK_CYCLES = 1000;

  function dirtyCheck(observer) {
    var cycles = 0;
    while (cycles < MAX_DIRTY_CHECK_CYCLES && observer.check_()) {
      cycles++;
    }
    if (testingExposeCycleCount)
      global.dirtyCheckCycleCount = cycles;

    return cycles > 0;
  }

  function objectIsEmpty(object) {
    for (var prop in object)
      return false;
    return true;
  }

  function diffIsEmpty(diff) {
    return objectIsEmpty(diff.added) &&
           objectIsEmpty(diff.removed) &&
           objectIsEmpty(diff.changed);
  }

  function diffObjectFromOldObject(object, oldObject) {
    var added = {};
    var removed = {};
    var changed = {};

    for (var prop in oldObject) {
      var newValue = object[prop];

      if (newValue !== undefined && newValue === oldObject[prop])
        continue;

      if (!(prop in object)) {
        removed[prop] = undefined;
        continue;
      }

      if (newValue !== oldObject[prop])
        changed[prop] = newValue;
    }

    for (var prop in object) {
      if (prop in oldObject)
        continue;

      added[prop] = object[prop];
    }

    if (Array.isArray(object) && object.length !== oldObject.length)
      changed.length = object.length;

    return {
      added: added,
      removed: removed,
      changed: changed
    };
  }

  var eomTasks = [];
  function runEOMTasks() {
    if (!eomTasks.length)
      return false;

    for (var i = 0; i < eomTasks.length; i++) {
      eomTasks[i]();
    }
    eomTasks.length = 0;
    return true;
  }

  var runEOM = hasObserve ? (function(){
    var eomObj = { pingPong: true };
    var eomRunScheduled = false;

    Object.observe(eomObj, function() {
      runEOMTasks();
      eomRunScheduled = false;
    });

    return function(fn) {
      eomTasks.push(fn);
      if (!eomRunScheduled) {
        eomRunScheduled = true;
        eomObj.pingPong = !eomObj.pingPong;
      }
    };
  })() :
  (function() {
    return function(fn) {
      eomTasks.push(fn);
    };
  })();

  var observedObjectCache = [];

  function newObservedObject() {
    var observer;
    var object;
    var discardRecords = false;
    var first = true;

    function callback(records) {
      if (observer && observer.state_ === OPENED && !discardRecords)
        observer.check_(records);
    }

    return {
      open: function(obs) {
        if (observer)
          throw Error('ObservedObject in use');

        if (!first)
          Object.deliverChangeRecords(callback);

        observer = obs;
        first = false;
      },
      observe: function(obj, arrayObserve) {
        object = obj;
        if (arrayObserve)
          Array.observe(object, callback);
        else
          Object.observe(object, callback);
      },
      deliver: function(discard) {
        discardRecords = discard;
        Object.deliverChangeRecords(callback);
        discardRecords = false;
      },
      close: function() {
        observer = undefined;
        Object.unobserve(object, callback);
        observedObjectCache.push(this);
      }
    };
  }

  /*
   * The observedSet abstraction is a perf optimization which reduces the total
   * number of Object.observe observations of a set of objects. The idea is that
   * groups of Observers will have some object dependencies in common and this
   * observed set ensures that each object in the transitive closure of
   * dependencies is only observed once. The observedSet acts as a write barrier
   * such that whenever any change comes through, all Observers are checked for
   * changed values.
   *
   * Note that this optimization is explicitly moving work from setup-time to
   * change-time.
   *
   * TODO(rafaelw): Implement "garbage collection". In order to move work off
   * the critical path, when Observers are closed, their observed objects are
   * not Object.unobserve(d). As a result, it'siesta possible that if the observedSet
   * is kept open, but some Observers have been closed, it could cause "leaks"
   * (prevent otherwise collectable objects from being collected). At some
   * point, we should implement incremental "gc" which keeps a list of
   * observedSets which may need clean-up and does small amounts of cleanup on a
   * timeout until all is clean.
   */

  function getObservedObject(observer, object, arrayObserve) {
    var dir = observedObjectCache.pop() || newObservedObject();
    dir.open(observer);
    dir.observe(object, arrayObserve);
    return dir;
  }

  var observedSetCache = [];

  function newObservedSet() {
    var observerCount = 0;
    var observers = [];
    var objects = [];
    var rootObj;
    var rootObjProps;

    function observe(obj, prop) {
      if (!obj)
        return;

      if (obj === rootObj)
        rootObjProps[prop] = true;

      if (objects.indexOf(obj) < 0) {
        objects.push(obj);
        Object.observe(obj, callback);
      }

      observe(Object.getPrototypeOf(obj), prop);
    }

    function allRootObjNonObservedProps(recs) {
      for (var i = 0; i < recs.length; i++) {
        var rec = recs[i];
        if (rec.object !== rootObj ||
            rootObjProps[rec.name] ||
            rec.type === 'setPrototype') {
          return false;
        }
      }
      return true;
    }

    function callback(recs) {
      if (allRootObjNonObservedProps(recs))
        return;

      var observer;
      for (var i = 0; i < observers.length; i++) {
        observer = observers[i];
        if (observer.state_ == OPENED) {
          observer.iterateObjects_(observe);
        }
      }

      for (var i = 0; i < observers.length; i++) {
        observer = observers[i];
        if (observer.state_ == OPENED) {
          observer.check_();
        }
      }
    }

    var record = {
      object: undefined,
      objects: objects,
      open: function(obs, object) {
        if (!rootObj) {
          rootObj = object;
          rootObjProps = {};
        }

        observers.push(obs);
        observerCount++;
        obs.iterateObjects_(observe);
      },
      close: function(obs) {
        observerCount--;
        if (observerCount > 0) {
          return;
        }

        for (var i = 0; i < objects.length; i++) {
          Object.unobserve(objects[i], callback);
          Observer.unobservedCount++;
        }

        observers.length = 0;
        objects.length = 0;
        rootObj = undefined;
        rootObjProps = undefined;
        observedSetCache.push(this);
      }
    };

    return record;
  }

  var lastObservedSet;

  function getObservedSet(observer, obj) {
    if (!lastObservedSet || lastObservedSet.object !== obj) {
      lastObservedSet = observedSetCache.pop() || newObservedSet();
      lastObservedSet.object = obj;
    }
    lastObservedSet.open(observer, obj);
    return lastObservedSet;
  }

  var UNOPENED = 0;
  var OPENED = 1;
  var CLOSED = 2;
  var RESETTING = 3;

  var nextObserverId = 1;

  function Observer() {
    this.state_ = UNOPENED;
    this.callback_ = undefined;
    this.target_ = undefined; // TODO(rafaelw): Should be WeakRef
    this.directObserver_ = undefined;
    this.value_ = undefined;
    this.id_ = nextObserverId++;
  }

  Observer.prototype = {
    open: function(callback, target) {
      if (this.state_ != UNOPENED)
        throw Error('Observer has already been opened.');

      addToAll(this);
      this.callback_ = callback;
      this.target_ = target;
      this.connect_();
      this.state_ = OPENED;
      return this.value_;
    },

    close: function() {
      if (this.state_ != OPENED)
        return;

      removeFromAll(this);
      this.disconnect_();
      this.value_ = undefined;
      this.callback_ = undefined;
      this.target_ = undefined;
      this.state_ = CLOSED;
    },

    deliver: function() {
      if (this.state_ != OPENED)
        return;

      dirtyCheck(this);
    },

    report_: function(changes) {
      try {
        this.callback_.apply(this.target_, changes);
      } catch (ex) {
        Observer._errorThrownDuringCallback = true;
        console.error('Exception caught during observer callback: ' +
                       (ex.stack || ex));
      }
    },

    discardChanges: function() {
      this.check_(undefined, true);
      return this.value_;
    }
  }

  var collectObservers = !hasObserve;
  var allObservers;
  Observer._allObserversCount = 0;

  if (collectObservers) {
    allObservers = [];
  }

  function addToAll(observer) {
    Observer._allObserversCount++;
    if (!collectObservers)
      return;

    allObservers.push(observer);
  }

  function removeFromAll(observer) {
    Observer._allObserversCount--;
  }

  var runningMicrotaskCheckpoint = false;

  var hasDebugForceFullDelivery = hasObserve && hasEval && (function() {
    try {
      eval('%RunMicrotasks()');
      return true;
    } catch (ex) {
      return false;
    }
  })();

  global.Platform = global.Platform || {};

  global.Platform.performMicrotaskCheckpoint = function() {
    if (runningMicrotaskCheckpoint)
      return;

    if (hasDebugForceFullDelivery) {
      eval('%RunMicrotasks()');
      return;
    }

    if (!collectObservers)
      return;

    runningMicrotaskCheckpoint = true;

    var cycles = 0;
    var anyChanged, toCheck;

    do {
      cycles++;
      toCheck = allObservers;
      allObservers = [];
      anyChanged = false;

      for (var i = 0; i < toCheck.length; i++) {
        var observer = toCheck[i];
        if (observer.state_ != OPENED)
          continue;

        if (observer.check_())
          anyChanged = true;

        allObservers.push(observer);
      }
      if (runEOMTasks())
        anyChanged = true;
    } while (cycles < MAX_DIRTY_CHECK_CYCLES && anyChanged);

    if (testingExposeCycleCount)
      global.dirtyCheckCycleCount = cycles;

    runningMicrotaskCheckpoint = false;
  };

  if (collectObservers) {
    global.Platform.clearObservers = function() {
      allObservers = [];
    };
  }

  function ObjectObserver(object) {
    Observer.call(this);
    this.value_ = object;
    this.oldObject_ = undefined;
  }

  ObjectObserver.prototype = createObject({
    __proto__: Observer.prototype,

    arrayObserve: false,

    connect_: function(callback, target) {
      if (hasObserve) {
        this.directObserver_ = getObservedObject(this, this.value_,
                                                 this.arrayObserve);
      } else {
        this.oldObject_ = this.copyObject(this.value_);
      }

    },

    copyObject: function(object) {
      var copy = Array.isArray(object) ? [] : {};
      for (var prop in object) {
        copy[prop] = object[prop];
      };
      if (Array.isArray(object))
        copy.length = object.length;
      return copy;
    },

    check_: function(changeRecords, skipChanges) {
      var diff;
      var oldValues;
      if (hasObserve) {
        if (!changeRecords)
          return false;

        oldValues = {};
        diff = diffObjectFromChangeRecords(this.value_, changeRecords,
                                           oldValues);
      } else {
        oldValues = this.oldObject_;
        diff = diffObjectFromOldObject(this.value_, this.oldObject_);
      }

      if (diffIsEmpty(diff))
        return false;

      if (!hasObserve)
        this.oldObject_ = this.copyObject(this.value_);

      this.report_([
        diff.added || {},
        diff.removed || {},
        diff.changed || {},
        function(property) {
          return oldValues[property];
        }
      ]);

      return true;
    },

    disconnect_: function() {
      if (hasObserve) {
        this.directObserver_.close();
        this.directObserver_ = undefined;
      } else {
        this.oldObject_ = undefined;
      }
    },

    deliver: function() {
      if (this.state_ != OPENED)
        return;

      if (hasObserve)
        this.directObserver_.deliver(false);
      else
        dirtyCheck(this);
    },

    discardChanges: function() {
      if (this.directObserver_)
        this.directObserver_.deliver(true);
      else
        this.oldObject_ = this.copyObject(this.value_);

      return this.value_;
    }
  });

  function ArrayObserver(array) {
    if (!Array.isArray(array))
      throw Error('Provided object is not an Array');
    ObjectObserver.call(this, array);
  }

  ArrayObserver.prototype = createObject({

    __proto__: ObjectObserver.prototype,

    arrayObserve: true,

    copyObject: function(arr) {
      return arr.slice();
    },

    check_: function(changeRecords) {
      var splices;
      if (hasObserve) {
        if (!changeRecords)
          return false;
        splices = projectArraySplices(this.value_, changeRecords);
      } else {
        splices = calcSplices(this.value_, 0, this.value_.length,
                              this.oldObject_, 0, this.oldObject_.length);
      }

      if (!splices || !splices.length)
        return false;

      if (!hasObserve)
        this.oldObject_ = this.copyObject(this.value_);

      this.report_([splices]);
      return true;
    }
  });

  ArrayObserver.applySplices = function(previous, current, splices) {
    splices.forEach(function(splice) {
      var spliceArgs = [splice.index, splice.removed.length];
      var addIndex = splice.index;
      while (addIndex < splice.index + splice.addedCount) {
        spliceArgs.push(current[addIndex]);
        addIndex++;
      }

      Array.prototype.splice.apply(previous, spliceArgs);
    });
  };

  function PathObserver(object, path) {
    Observer.call(this);

    this.object_ = object;
    this.path_ = getPath(path);
    this.directObserver_ = undefined;
  }

  PathObserver.prototype = createObject({
    __proto__: Observer.prototype,

    get path() {
      return this.path_;
    },

    connect_: function() {
      if (hasObserve)
        this.directObserver_ = getObservedSet(this, this.object_);

      this.check_(undefined, true);
    },

    disconnect_: function() {
      this.value_ = undefined;

      if (this.directObserver_) {
        this.directObserver_.close(this);
        this.directObserver_ = undefined;
      }
    },

    iterateObjects_: function(observe) {
      this.path_.iterateObjects(this.object_, observe);
    },

    check_: function(changeRecords, skipChanges) {
      var oldValue = this.value_;
      this.value_ = this.path_.getValueFrom(this.object_);
      if (skipChanges || areSameValue(this.value_, oldValue))
        return false;

      this.report_([this.value_, oldValue, this]);
      return true;
    },

    setValue: function(newValue) {
      if (this.path_)
        this.path_.setValueFrom(this.object_, newValue);
    }
  });

  function CompoundObserver(reportChangesOnOpen) {
    Observer.call(this);

    this.reportChangesOnOpen_ = reportChangesOnOpen;
    this.value_ = [];
    this.directObserver_ = undefined;
    this.observed_ = [];
  }

  var observerSentinel = {};

  CompoundObserver.prototype = createObject({
    __proto__: Observer.prototype,

    connect_: function() {
      if (hasObserve) {
        var object;
        var needsDirectObserver = false;
        for (var i = 0; i < this.observed_.length; i += 2) {
          object = this.observed_[i]
          if (object !== observerSentinel) {
            needsDirectObserver = true;
            break;
          }
        }

        if (needsDirectObserver)
          this.directObserver_ = getObservedSet(this, object);
      }

      this.check_(undefined, !this.reportChangesOnOpen_);
    },

    disconnect_: function() {
      for (var i = 0; i < this.observed_.length; i += 2) {
        if (this.observed_[i] === observerSentinel)
          this.observed_[i + 1].close();
      }
      this.observed_.length = 0;
      this.value_.length = 0;

      if (this.directObserver_) {
        this.directObserver_.close(this);
        this.directObserver_ = undefined;
      }
    },

    addPath: function(object, path) {
      if (this.state_ != UNOPENED && this.state_ != RESETTING)
        throw Error('Cannot add paths once started.');

      var path = getPath(path);
      this.observed_.push(object, path);
      if (!this.reportChangesOnOpen_)
        return;
      var index = this.observed_.length / 2 - 1;
      this.value_[index] = path.getValueFrom(object);
    },

    addObserver: function(observer) {
      if (this.state_ != UNOPENED && this.state_ != RESETTING)
        throw Error('Cannot add observers once started.');

      this.observed_.push(observerSentinel, observer);
      if (!this.reportChangesOnOpen_)
        return;
      var index = this.observed_.length / 2 - 1;
      this.value_[index] = observer.open(this.deliver, this);
    },

    startReset: function() {
      if (this.state_ != OPENED)
        throw Error('Can only reset while open');

      this.state_ = RESETTING;
      this.disconnect_();
    },

    finishReset: function() {
      if (this.state_ != RESETTING)
        throw Error('Can only finishReset after startReset');
      this.state_ = OPENED;
      this.connect_();

      return this.value_;
    },

    iterateObjects_: function(observe) {
      var object;
      for (var i = 0; i < this.observed_.length; i += 2) {
        object = this.observed_[i]
        if (object !== observerSentinel)
          this.observed_[i + 1].iterateObjects(object, observe)
      }
    },

    check_: function(changeRecords, skipChanges) {
      var oldValues;
      for (var i = 0; i < this.observed_.length; i += 2) {
        var object = this.observed_[i];
        var path = this.observed_[i+1];
        var value;
        if (object === observerSentinel) {
          var observable = path;
          value = this.state_ === UNOPENED ?
              observable.open(this.deliver, this) :
              observable.discardChanges();
        } else {
          value = path.getValueFrom(object);
        }

        if (skipChanges) {
          this.value_[i / 2] = value;
          continue;
        }

        if (areSameValue(value, this.value_[i / 2]))
          continue;

        oldValues = oldValues || [];
        oldValues[i / 2] = this.value_[i / 2];
        this.value_[i / 2] = value;
      }

      if (!oldValues)
        return false;

      // TODO(rafaelw): Having observed_ as the third callback arg here is
      // pretty lame API. Fix.
      this.report_([this.value_, oldValues, this.observed_]);
      return true;
    }
  });

  function identFn(value) { return value; }

  function ObserverTransform(observable, getValueFn, setValueFn,
                             dontPassThroughSet) {
    this.callback_ = undefined;
    this.target_ = undefined;
    this.value_ = undefined;
    this.observable_ = observable;
    this.getValueFn_ = getValueFn || identFn;
    this.setValueFn_ = setValueFn || identFn;
    // TODO(rafaelw): This is a temporary hack. PolymerExpressions needs this
    // at the moment because of a bug in it'siesta dependency tracking.
    this.dontPassThroughSet_ = dontPassThroughSet;
  }

  ObserverTransform.prototype = {
    open: function(callback, target) {
      this.callback_ = callback;
      this.target_ = target;
      this.value_ =
          this.getValueFn_(this.observable_.open(this.observedCallback_, this));
      return this.value_;
    },

    observedCallback_: function(value) {
      value = this.getValueFn_(value);
      if (areSameValue(value, this.value_))
        return;
      var oldValue = this.value_;
      this.value_ = value;
      this.callback_.call(this.target_, this.value_, oldValue);
    },

    discardChanges: function() {
      this.value_ = this.getValueFn_(this.observable_.discardChanges());
      return this.value_;
    },

    deliver: function() {
      return this.observable_.deliver();
    },

    setValue: function(value) {
      value = this.setValueFn_(value);
      if (!this.dontPassThroughSet_ && this.observable_.setValue)
        return this.observable_.setValue(value);
    },

    close: function() {
      if (this.observable_)
        this.observable_.close();
      this.callback_ = undefined;
      this.target_ = undefined;
      this.observable_ = undefined;
      this.value_ = undefined;
      this.getValueFn_ = undefined;
      this.setValueFn_ = undefined;
    }
  }

  var expectedRecordTypes = {
    add: true,
    update: true,
    delete: true
  };

  function diffObjectFromChangeRecords(object, changeRecords, oldValues) {
    var added = {};
    var removed = {};

    for (var i = 0; i < changeRecords.length; i++) {
      var record = changeRecords[i];
      if (!expectedRecordTypes[record.type]) {
        console.error('Unknown changeRecord type: ' + record.type);
        console.error(record);
        continue;
      }

      if (!(record.name in oldValues))
        oldValues[record.name] = record.oldValue;

      if (record.type == 'update')
        continue;

      if (record.type == 'add') {
        if (record.name in removed)
          delete removed[record.name];
        else
          added[record.name] = true;

        continue;
      }

      // type = 'delete'
      if (record.name in added) {
        delete added[record.name];
        delete oldValues[record.name];
      } else {
        removed[record.name] = true;
      }
    }

    for (var prop in added)
      added[prop] = object[prop];

    for (var prop in removed)
      removed[prop] = undefined;

    var changed = {};
    for (var prop in oldValues) {
      if (prop in added || prop in removed)
        continue;

      var newValue = object[prop];
      if (oldValues[prop] !== newValue)
        changed[prop] = newValue;
    }

    return {
      added: added,
      removed: removed,
      changed: changed
    };
  }

  function newSplice(index, removed, addedCount) {
    return {
      index: index,
      removed: removed,
      addedCount: addedCount
    };
  }

  var EDIT_LEAVE = 0;
  var EDIT_UPDATE = 1;
  var EDIT_ADD = 2;
  var EDIT_DELETE = 3;

  function ArraySplice() {}

  ArraySplice.prototype = {

    // Note: This function is *based* on the computation of the Levenshtein
    // "edit" distance. The one change is that "updates" are treated as two
    // edits - not one. With Array splices, an update is really a delete
    // followed by an add. By retaining this, we optimize for "keeping" the
    // maximum array items in the original array. For example:
    //
    //   'xxxx123' -> '123yyyy'
    //
    // With 1-edit updates, the shortest path would be just to update all seven
    // characters. With 2-edit updates, we delete 4, leave 3, and add 4. This
    // leaves the substring '123' intact.
    calcEditDistances: function(current, currentStart, currentEnd,
                                old, oldStart, oldEnd) {
      // "Deletion" columns
      var rowCount = oldEnd - oldStart + 1;
      var columnCount = currentEnd - currentStart + 1;
      var distances = new Array(rowCount);

      // "Addition" rows. Initialize null column.
      for (var i = 0; i < rowCount; i++) {
        distances[i] = new Array(columnCount);
        distances[i][0] = i;
      }

      // Initialize null row
      for (var j = 0; j < columnCount; j++)
        distances[0][j] = j;

      for (var i = 1; i < rowCount; i++) {
        for (var j = 1; j < columnCount; j++) {
          if (this.equals(current[currentStart + j - 1], old[oldStart + i - 1]))
            distances[i][j] = distances[i - 1][j - 1];
          else {
            var north = distances[i - 1][j] + 1;
            var west = distances[i][j - 1] + 1;
            distances[i][j] = north < west ? north : west;
          }
        }
      }

      return distances;
    },

    // This starts at the final weight, and walks "backward" by finding
    // the minimum previous weight recursively until the origin of the weight
    // matrix.
    spliceOperationsFromEditDistances: function(distances) {
      var i = distances.length - 1;
      var j = distances[0].length - 1;
      var current = distances[i][j];
      var edits = [];
      while (i > 0 || j > 0) {
        if (i == 0) {
          edits.push(EDIT_ADD);
          j--;
          continue;
        }
        if (j == 0) {
          edits.push(EDIT_DELETE);
          i--;
          continue;
        }
        var northWest = distances[i - 1][j - 1];
        var west = distances[i - 1][j];
        var north = distances[i][j - 1];

        var min;
        if (west < north)
          min = west < northWest ? west : northWest;
        else
          min = north < northWest ? north : northWest;

        if (min == northWest) {
          if (northWest == current) {
            edits.push(EDIT_LEAVE);
          } else {
            edits.push(EDIT_UPDATE);
            current = northWest;
          }
          i--;
          j--;
        } else if (min == west) {
          edits.push(EDIT_DELETE);
          i--;
          current = west;
        } else {
          edits.push(EDIT_ADD);
          j--;
          current = north;
        }
      }

      edits.reverse();
      return edits;
    },

    /**
     * Splice Projection functions:
     *
     * A splice map is a representation of how a previous array of items
     * was transformed into a new array of items. Conceptually it is a list of
     * tuples of
     *
     *   <index, removed, addedCount>
     *
     * which are kept in ascending index order of. The tuple represents that at
     * the |index|, |removed| sequence of items were removed, and counting forward
     * from |index|, |addedCount| items were added.
     */

    /**
     * Lacking individual splice mutation information, the minimal set of
     * splices can be synthesized given the previous state and final state of an
     * array. The basic approach is to calculate the edit distance matrix and
     * choose the shortest path through it.
     *
     * Complexity: O(l * p)
     *   l: The length of the current array
     *   p: The length of the old array
     */
    calcSplices: function(current, currentStart, currentEnd,
                          old, oldStart, oldEnd) {
      var prefixCount = 0;
      var suffixCount = 0;

      var minLength = Math.min(currentEnd - currentStart, oldEnd - oldStart);
      if (currentStart == 0 && oldStart == 0)
        prefixCount = this.sharedPrefix(current, old, minLength);

      if (currentEnd == current.length && oldEnd == old.length)
        suffixCount = this.sharedSuffix(current, old, minLength - prefixCount);

      currentStart += prefixCount;
      oldStart += prefixCount;
      currentEnd -= suffixCount;
      oldEnd -= suffixCount;

      if (currentEnd - currentStart == 0 && oldEnd - oldStart == 0)
        return [];

      if (currentStart == currentEnd) {
        var splice = newSplice(currentStart, [], 0);
        while (oldStart < oldEnd)
          splice.removed.push(old[oldStart++]);

        return [ splice ];
      } else if (oldStart == oldEnd)
        return [ newSplice(currentStart, [], currentEnd - currentStart) ];

      var ops = this.spliceOperationsFromEditDistances(
          this.calcEditDistances(current, currentStart, currentEnd,
                                 old, oldStart, oldEnd));

      var splice = undefined;
      var splices = [];
      var index = currentStart;
      var oldIndex = oldStart;
      for (var i = 0; i < ops.length; i++) {
        switch(ops[i]) {
          case EDIT_LEAVE:
            if (splice) {
              splices.push(splice);
              splice = undefined;
            }

            index++;
            oldIndex++;
            break;
          case EDIT_UPDATE:
            if (!splice)
              splice = newSplice(index, [], 0);

            splice.addedCount++;
            index++;

            splice.removed.push(old[oldIndex]);
            oldIndex++;
            break;
          case EDIT_ADD:
            if (!splice)
              splice = newSplice(index, [], 0);

            splice.addedCount++;
            index++;
            break;
          case EDIT_DELETE:
            if (!splice)
              splice = newSplice(index, [], 0);

            splice.removed.push(old[oldIndex]);
            oldIndex++;
            break;
        }
      }

      if (splice) {
        splices.push(splice);
      }
      return splices;
    },

    sharedPrefix: function(current, old, searchLength) {
      for (var i = 0; i < searchLength; i++)
        if (!this.equals(current[i], old[i]))
          return i;
      return searchLength;
    },

    sharedSuffix: function(current, old, searchLength) {
      var index1 = current.length;
      var index2 = old.length;
      var count = 0;
      while (count < searchLength && this.equals(current[--index1], old[--index2]))
        count++;

      return count;
    },

    calculateSplices: function(current, previous) {
      return this.calcSplices(current, 0, current.length, previous, 0,
                              previous.length);
    },

    equals: function(currentValue, previousValue) {
      return currentValue === previousValue;
    }
  };

  var arraySplice = new ArraySplice();

  function calcSplices(current, currentStart, currentEnd,
                       old, oldStart, oldEnd) {
    return arraySplice.calcSplices(current, currentStart, currentEnd,
                                   old, oldStart, oldEnd);
  }

  function intersect(start1, end1, start2, end2) {
    // Disjoint
    if (end1 < start2 || end2 < start1)
      return -1;

    // Adjacent
    if (end1 == start2 || end2 == start1)
      return 0;

    // Non-zero intersect, span1 first
    if (start1 < start2) {
      if (end1 < end2)
        return end1 - start2; // Overlap
      else
        return end2 - start2; // Contained
    } else {
      // Non-zero intersect, span2 first
      if (end2 < end1)
        return end2 - start1; // Overlap
      else
        return end1 - start1; // Contained
    }
  }

  function mergeSplice(splices, index, removed, addedCount) {

    var splice = newSplice(index, removed, addedCount);

    var inserted = false;
    var insertionOffset = 0;

    for (var i = 0; i < splices.length; i++) {
      var current = splices[i];
      current.index += insertionOffset;

      if (inserted)
        continue;

      var intersectCount = intersect(splice.index,
                                     splice.index + splice.removed.length,
                                     current.index,
                                     current.index + current.addedCount);

      if (intersectCount >= 0) {
        // Merge the two splices

        splices.splice(i, 1);
        i--;

        insertionOffset -= current.addedCount - current.removed.length;

        splice.addedCount += current.addedCount - intersectCount;
        var deleteCount = splice.removed.length +
                          current.removed.length - intersectCount;

        if (!splice.addedCount && !deleteCount) {
          // merged splice is a noop. discard.
          inserted = true;
        } else {
          var removed = current.removed;

          if (splice.index < current.index) {
            // some prefix of splice.removed is prepended to current.removed.
            var prepend = splice.removed.slice(0, current.index - splice.index);
            Array.prototype.push.apply(prepend, removed);
            removed = prepend;
          }

          if (splice.index + splice.removed.length > current.index + current.addedCount) {
            // some suffix of splice.removed is appended to current.removed.
            var append = splice.removed.slice(current.index + current.addedCount - splice.index);
            Array.prototype.push.apply(removed, append);
          }

          splice.removed = removed;
          if (current.index < splice.index) {
            splice.index = current.index;
          }
        }
      } else if (splice.index < current.index) {
        // Insert splice here.

        inserted = true;

        splices.splice(i, 0, splice);
        i++;

        var offset = splice.addedCount - splice.removed.length
        current.index += offset;
        insertionOffset += offset;
      }
    }

    if (!inserted)
      splices.push(splice);
  }

  function createInitialSplices(array, changeRecords) {
    var splices = [];

    for (var i = 0; i < changeRecords.length; i++) {
      var record = changeRecords[i];
      switch(record.type) {
        case 'splice':
          mergeSplice(splices, record.index, record.removed.slice(), record.addedCount);
          break;
        case 'add':
        case 'update':
        case 'delete':
          if (!isIndex(record.name))
            continue;
          var index = toNumber(record.name);
          if (index < 0)
            continue;
          mergeSplice(splices, index, [record.oldValue], 1);
          break;
        default:
          console.error('Unexpected record type: ' + JSON.stringify(record));
          break;
      }
    }

    return splices;
  }

  function projectArraySplices(array, changeRecords) {
    var splices = [];

    createInitialSplices(array, changeRecords).forEach(function(splice) {
      if (splice.addedCount == 1 && splice.removed.length == 1) {
        if (splice.removed[0] !== array[splice.index])
          splices.push(splice);

        return
      };

      splices = splices.concat(calcSplices(array, splice.index, splice.index + splice.addedCount,
                                           splice.removed, 0, splice.removed.length));
    });

    return splices;
  }

 // Export the observe-js object for **Node.js**, with
// backwards-compatibility for the old `require()` API. If we're in
// the browser, export as a global object.
var expose = global;
if (typeof exports !== 'undefined') {
if (typeof module !== 'undefined' && module.exports) {
expose = exports = module.exports;
}
expose = exports;
}
expose.Observer = Observer;
expose.Observer.runEOM_ = runEOM;
expose.Observer.observerSentinel_ = observerSentinel; // for testing.
expose.Observer.hasObjectObserve = hasObserve;
expose.ArrayObserver = ArrayObserver;
expose.ArrayObserver.calculateSplices = function(current, previous) {
return arraySplice.calculateSplices(current, previous);
};
expose.Platform = global.Platform;
expose.ArraySplice = ArraySplice;
expose.ObjectObserver = ObjectObserver;
expose.PathObserver = PathObserver;
expose.CompoundObserver = CompoundObserver;
expose.Path = Path;
expose.ObserverTransform = ObserverTransform;
})(typeof global !== 'undefined' && global && typeof module !== 'undefined' && module ? global : this || window);

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}]},{},[6])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9jb3JlL2NhY2hlLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3QvY29yZS9jaGFuZ2VzLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3QvY29yZS9jb2xsZWN0aW9uLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3QvY29yZS9jb2xsZWN0aW9uUmVnaXN0cnkuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9jb3JlL2Vycm9yLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3QvY29yZS9pbmRleC5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2NvcmUvbWFueVRvTWFueVByb3h5LmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3QvY29yZS9tYXBwaW5nLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3QvY29yZS9tYXBwaW5nT3BlcmF0aW9uLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3QvY29yZS9ub3RpZmljYXRpb25DZW50cmUuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9jb3JlL29uZVRvTWFueVByb3h5LmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3QvY29yZS9vbmVUb09uZVByb3h5LmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3QvY29yZS9vcGVyYXRpb24vbG9nLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3QvY29yZS9vcGVyYXRpb24vb3BlcmF0aW9uLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3QvY29yZS9vcGVyYXRpb24vcXVldWUuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9jb3JlL3Byb3h5LmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3QvY29yZS9xdWVyeS5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2NvcmUvcmVsYXRpb25zaGlwLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3QvY29yZS9zaWVzdGFNb2RlbC5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2NvcmUvc3RvcmUuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9jb3JlL3V0aWwuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvZXZlbnRzL2V2ZW50cy5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L25vZGVfbW9kdWxlcy9leHRlbmQvaW5kZXguanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC92ZW5kb3Ivb2JzZXJ2ZS1qcy9zcmMvb2JzZXJ2ZS5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdYQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoSkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xZQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDblJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN2ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxWkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsVkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JNQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcGNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzSkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5T0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2a0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN1NBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLyoqXG4gKiBUaGlzIGlzIGFuIGluLW1lbW9yeSBjYWNoZSBmb3IgbW9kZWxzLiBNb2RlbHMgYXJlIGNhY2hlZCBieSBsb2NhbCBpZCAoX2lkKSBhbmQgcmVtb3RlIGlkIChkZWZpbmVkIGJ5IHRoZSBtYXBwaW5nKS5cbiAqIExvb2t1cHMgYXJlIHBlcmZvcm1lZCBhZ2FpbnN0IHRoZSBjYWNoZSB3aGVuIG1hcHBpbmcuXG4gKiBAbW9kdWxlIGNhY2hlXG4gKi9cbnZhciBsb2cgPSByZXF1aXJlKCcuL29wZXJhdGlvbi9sb2cnKVxuICAgICwgSW50ZXJuYWxTaWVzdGFFcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKS5JbnRlcm5hbFNpZXN0YUVycm9yXG4gICAgLCB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyk7XG5cblxudmFyIExvY2FsQ2FjaGVMb2dnZXIgPSBsb2cubG9nZ2VyV2l0aE5hbWUoJ0xvY2FsQ2FjaGUnKVxuICAgICwgUmVtb3RlQ2FjaGVMb2dnZXIgPSBsb2cubG9nZ2VyV2l0aE5hbWUoJ1JlbW90ZUNhY2hlJyk7XG5SZW1vdGVDYWNoZUxvZ2dlci5zZXRMZXZlbChsb2cuTGV2ZWwud2Fybik7XG5Mb2NhbENhY2hlTG9nZ2VyLnNldExldmVsKGxvZy5MZXZlbC53YXJuKTtcblxuXG52YXIgbG9jYWxDYWNoZUJ5SWQsXG4gICAgbG9jYWxDYWNoZSxcbiAgICByZW1vdGVDYWNoZTtcblxuLyoqXG4gKiBDbGVhciBvdXQgdGhlIGNhY2hlLlxuICovXG5mdW5jdGlvbiByZXNldCgpIHtcbiAgICByZW1vdGVDYWNoZSA9IHt9O1xuICAgIGxvY2FsQ2FjaGVCeUlkID0ge307XG4gICAgbG9jYWxDYWNoZSA9IHt9O1xufVxuXG5yZXNldCgpO1xuXG4vKipcbiAqIFJldHVybiB0aGUgb2JqZWN0IGluIHRoZSBjYWNoZSBnaXZlbiBhIGxvY2FsIGlkIChfaWQpXG4gKiBAcGFyYW0gIHtTdHJpbmd9IGxvY2FsSWRcbiAqIEByZXR1cm4ge1NpZXN0YU1vZGVsfVxuICovXG5mdW5jdGlvbiBnZXRWaWFMb2NhbElkKGxvY2FsSWQpIHtcbiAgICB2YXIgb2JqID0gbG9jYWxDYWNoZUJ5SWRbbG9jYWxJZF07XG4gICAgaWYgKG9iaikge1xuICAgICAgICBpZiAoTG9jYWxDYWNoZUxvZ2dlci5kZWJ1Zy5pc0VuYWJsZWQpXG4gICAgICAgICAgICBMb2NhbENhY2hlTG9nZ2VyLmRlYnVnKCdMb2NhbCBjYWNoZSBoaXQ6ICcgKyBvYmouX2R1bXAodHJ1ZSkpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGlmIChMb2NhbENhY2hlTG9nZ2VyLmRlYnVnLmlzRW5hYmxlZClcbiAgICAgICAgICAgIExvY2FsQ2FjaGVMb2dnZXIuZGVidWcoJ0xvY2FsIGNhY2hlIG1pc3M6ICcgKyBsb2NhbElkKTtcbiAgICB9XG4gICAgcmV0dXJuIG9iajtcbn1cblxuLyoqXG4gKiBSZXR1cm4gdGhlIHNpbmdsZXRvbiBvYmplY3QgZ2l2ZW4gYSBzaW5nbGV0b24gbWFwcGluZy5cbiAqIEBwYXJhbSAge01hcHBpbmd9IG1hcHBpbmdcbiAqIEByZXR1cm4ge1NpZXN0YU1vZGVsfVxuICovXG5mdW5jdGlvbiBnZXRTaW5nbGV0b24obWFwcGluZykge1xuICAgIHZhciBtYXBwaW5nTmFtZSA9IG1hcHBpbmcudHlwZTtcbiAgICB2YXIgY29sbGVjdGlvbk5hbWUgPSBtYXBwaW5nLmNvbGxlY3Rpb247XG4gICAgdmFyIGNvbGxlY3Rpb25DYWNoZSA9IGxvY2FsQ2FjaGVbY29sbGVjdGlvbk5hbWVdO1xuICAgIGlmIChjb2xsZWN0aW9uQ2FjaGUpIHtcbiAgICAgICAgdmFyIHR5cGVDYWNoZSA9IGNvbGxlY3Rpb25DYWNoZVttYXBwaW5nTmFtZV07XG4gICAgICAgIGlmICh0eXBlQ2FjaGUpIHtcbiAgICAgICAgICAgIHZhciBvYmpzID0gW107XG4gICAgICAgICAgICBmb3IgKHZhciBwcm9wIGluIHR5cGVDYWNoZSkge1xuICAgICAgICAgICAgICAgIGlmICh0eXBlQ2FjaGUuaGFzT3duUHJvcGVydHkocHJvcCkpIHtcbiAgICAgICAgICAgICAgICAgICAgb2Jqcy5wdXNoKHR5cGVDYWNoZVtwcm9wXSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKG9ianMubGVuZ3RoID4gMSkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdBIHNpbmdsZXRvbiBtYXBwaW5nIGhhcyBtb3JlIHRoYW4gMSBvYmplY3QgaW4gdGhlIGNhY2hlISBUaGlzIGlzIGEgc2VyaW91cyBlcnJvci4gJyArXG4gICAgICAgICAgICAgICAgJ0VpdGhlciBhIG1hcHBpbmcgaGFzIGJlZW4gbW9kaWZpZWQgYWZ0ZXIgb2JqZWN0cyBoYXZlIGFscmVhZHkgYmVlbiBjcmVhdGVkLCBvciBzb21ldGhpbmcgaGFzIGdvbmUnICtcbiAgICAgICAgICAgICAgICAndmVyeSB3cm9uZy4gUGxlYXNlIGZpbGUgYSBidWcgcmVwb3J0IGlmIHRoZSBsYXR0ZXIuJyk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKG9ianMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG9ianNbMF07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG59XG5cbi8qKlxuICogR2l2ZW4gYSByZW1vdGUgaWRlbnRpZmllciBhbmQgYW4gb3B0aW9ucyBvYmplY3QgdGhhdCBkZXNjcmliZXMgbWFwcGluZy9jb2xsZWN0aW9uLFxuICogcmV0dXJuIHRoZSBtb2RlbCBpZiBjYWNoZWQuXG4gKiBAcGFyYW0gIHtTdHJpbmd9IHJlbW90ZUlkXG4gKiBAcGFyYW0gIHtPYmplY3R9IG9wdHNcbiAqIEByZXR1cm4ge1NpZXN0YU1vZGVsfVxuICovXG5mdW5jdGlvbiBnZXRWaWFSZW1vdGVJZChyZW1vdGVJZCwgb3B0cykge1xuICAgIHZhciB0eXBlID0gb3B0cy5tYXBwaW5nLnR5cGU7XG4gICAgdmFyIGNvbGxlY3Rpb24gPSBvcHRzLm1hcHBpbmcuY29sbGVjdGlvbjtcbiAgICB2YXIgY29sbGVjdGlvbkNhY2hlID0gcmVtb3RlQ2FjaGVbY29sbGVjdGlvbl07XG4gICAgaWYgKGNvbGxlY3Rpb25DYWNoZSkge1xuICAgICAgICB2YXIgdHlwZUNhY2hlID0gcmVtb3RlQ2FjaGVbY29sbGVjdGlvbl1bdHlwZV07XG4gICAgICAgIGlmICh0eXBlQ2FjaGUpIHtcbiAgICAgICAgICAgIHZhciBvYmogPSB0eXBlQ2FjaGVbcmVtb3RlSWRdO1xuICAgICAgICAgICAgaWYgKG9iaikge1xuICAgICAgICAgICAgICAgIGlmIChSZW1vdGVDYWNoZUxvZ2dlci5kZWJ1Zy5pc0VuYWJsZWQpXG4gICAgICAgICAgICAgICAgICAgIFJlbW90ZUNhY2hlTG9nZ2VyLmRlYnVnKCdSZW1vdGUgY2FjaGUgaGl0OiAnICsgb2JqLl9kdW1wKHRydWUpKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgaWYgKFJlbW90ZUNhY2hlTG9nZ2VyLmRlYnVnLmlzRW5hYmxlZClcbiAgICAgICAgICAgICAgICAgICAgUmVtb3RlQ2FjaGVMb2dnZXIuZGVidWcoJ1JlbW90ZSBjYWNoZSBtaXNzOiAnICsgcmVtb3RlSWQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIG9iajtcbiAgICAgICAgfVxuICAgIH1cbiAgICBpZiAoUmVtb3RlQ2FjaGVMb2dnZXIuZGVidWcuaXNFbmFibGVkKVxuICAgICAgICBSZW1vdGVDYWNoZUxvZ2dlci5kZWJ1ZygnUmVtb3RlIGNhY2hlIG1pc3M6ICcgKyByZW1vdGVJZCk7XG4gICAgcmV0dXJuIG51bGw7XG59XG5cbi8qKlxuICogSW5zZXJ0IGFuIG9iamV0IGludG8gdGhlIGNhY2hlIHVzaW5nIGEgcmVtb3RlIGlkZW50aWZpZXIgZGVmaW5lZCBieSB0aGUgbWFwcGluZy5cbiAqIEBwYXJhbSAge1NpZXN0YU1vZGVsfSBvYmpcbiAqIEBwYXJhbSAge1N0cmluZ30gcmVtb3RlSWRcbiAqIEBwYXJhbSAge1N0cmluZ30gcHJldmlvdXNSZW1vdGVJZCBJZiByZW1vdGUgaWQgaGFzIGJlZW4gY2hhbmdlZCwgdGhpcyBpcyB0aGUgb2xkIHJlbW90ZSBpZGVudGlmaWVyXG4gKi9cbmZ1bmN0aW9uIHJlbW90ZUluc2VydChvYmosIHJlbW90ZUlkLCBwcmV2aW91c1JlbW90ZUlkKSB7XG4gICAgaWYgKG9iaikge1xuICAgICAgICB2YXIgY29sbGVjdGlvbiA9IG9iai5tYXBwaW5nLmNvbGxlY3Rpb247XG4gICAgICAgIGlmIChjb2xsZWN0aW9uKSB7XG4gICAgICAgICAgICBpZiAoIXJlbW90ZUNhY2hlW2NvbGxlY3Rpb25dKSB7XG4gICAgICAgICAgICAgICAgcmVtb3RlQ2FjaGVbY29sbGVjdGlvbl0gPSB7fTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHZhciB0eXBlID0gb2JqLm1hcHBpbmcudHlwZTtcbiAgICAgICAgICAgIGlmICh0eXBlKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFyZW1vdGVDYWNoZVtjb2xsZWN0aW9uXVt0eXBlXSkge1xuICAgICAgICAgICAgICAgICAgICByZW1vdGVDYWNoZVtjb2xsZWN0aW9uXVt0eXBlXSA9IHt9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAocHJldmlvdXNSZW1vdGVJZCkge1xuICAgICAgICAgICAgICAgICAgICByZW1vdGVDYWNoZVtjb2xsZWN0aW9uXVt0eXBlXVtwcmV2aW91c1JlbW90ZUlkXSA9IG51bGw7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHZhciBjYWNoZWRPYmplY3QgPSByZW1vdGVDYWNoZVtjb2xsZWN0aW9uXVt0eXBlXVtyZW1vdGVJZF07XG4gICAgICAgICAgICAgICAgaWYgKCFjYWNoZWRPYmplY3QpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVtb3RlQ2FjaGVbY29sbGVjdGlvbl1bdHlwZV1bcmVtb3RlSWRdID0gb2JqO1xuICAgICAgICAgICAgICAgICAgICBpZiAoUmVtb3RlQ2FjaGVMb2dnZXIuZGVidWcuaXNFbmFibGVkKVxuICAgICAgICAgICAgICAgICAgICAgICAgUmVtb3RlQ2FjaGVMb2dnZXIuZGVidWcoJ1JlbW90ZSBjYWNoZSBpbnNlcnQ6ICcgKyBvYmouX2R1bXAodHJ1ZSkpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoUmVtb3RlQ2FjaGVMb2dnZXIudHJhY2UuaXNFbmFibGVkKVxuICAgICAgICAgICAgICAgICAgICAgICAgUmVtb3RlQ2FjaGVMb2dnZXIudHJhY2UoJ1JlbW90ZSBjYWNoZSBub3cgbG9va3MgbGlrZTogJyArIHJlbW90ZUR1bXAodHJ1ZSkpXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gU29tZXRoaW5nIGhhcyBnb25lIHJlYWxseSB3cm9uZy4gT25seSBvbmUgb2JqZWN0IGZvciBhIHBhcnRpY3VsYXIgY29sbGVjdGlvbi90eXBlL3JlbW90ZWlkIGNvbWJvXG4gICAgICAgICAgICAgICAgICAgIC8vIHNob3VsZCBldmVyIGV4aXN0LlxuICAgICAgICAgICAgICAgICAgICBpZiAob2JqICE9IGNhY2hlZE9iamVjdCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG1lc3NhZ2UgPSAnT2JqZWN0ICcgKyBjb2xsZWN0aW9uLnRvU3RyaW5nKCkgKyAnOicgKyB0eXBlLnRvU3RyaW5nKCkgKyAnWycgKyBvYmoubWFwcGluZy5pZCArICc9XCInICsgcmVtb3RlSWQgKyAnXCJdIGFscmVhZHkgZXhpc3RzIGluIHRoZSBjYWNoZS4nICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAnIFRoaXMgaXMgYSBzZXJpb3VzIGVycm9yLCBwbGVhc2UgZmlsZSBhIGJ1ZyByZXBvcnQgaWYgeW91IGFyZSBleHBlcmllbmNpbmcgdGhpcyBvdXQgaW4gdGhlIHdpbGQnO1xuICAgICAgICAgICAgICAgICAgICAgICAgUmVtb3RlQ2FjaGVMb2dnZXIuZXJyb3IobWVzc2FnZSwge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9iajogb2JqLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhY2hlZE9iamVjdDogY2FjaGVkT2JqZWN0XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHV0aWwucHJpbnRTdGFja1RyYWNlKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcihtZXNzYWdlKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChSZW1vdGVDYWNoZUxvZ2dlci5kZWJ1Zy5pc0VuYWJsZWQpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgUmVtb3RlQ2FjaGVMb2dnZXIuZGVidWcoJ09iamVjdCBoYXMgYWxyZWFkeSBiZWVuIGluc2VydGVkOiAnICsgb2JqLl9kdW1wKHRydWUpKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignTWFwcGluZyBoYXMgbm8gdHlwZScsIHtcbiAgICAgICAgICAgICAgICAgICAgbWFwcGluZzogb2JqLm1hcHBpbmcsXG4gICAgICAgICAgICAgICAgICAgIG9iajogb2JqXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignTWFwcGluZyBoYXMgbm8gY29sbGVjdGlvbicsIHtcbiAgICAgICAgICAgICAgICBtYXBwaW5nOiBvYmoubWFwcGluZyxcbiAgICAgICAgICAgICAgICBvYmo6IG9ialxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgICB2YXIgbXNnID0gJ011c3QgcGFzcyBhbiBvYmplY3Qgd2hlbiBpbnNlcnRpbmcgdG8gY2FjaGUnO1xuICAgICAgICBSZW1vdGVDYWNoZUxvZ2dlci5lcnJvcihtc2cpO1xuICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcihtc2cpO1xuICAgIH1cbn1cblxuLyoqXG4gKiBEdW1wIHRoZSByZW1vdGUgaWQgY2FjaGVcbiAqIEBwYXJhbSAge2Jvb2xlYW59IGFzSnNvbiBXaGV0aGVyIG9yIG5vdCB0byBhcHBseSBKU09OLnN0cmluZ2lmeVxuICogQHJldHVybiB7U3RyaW5nfE9iamVjdH1cbiAqL1xuZnVuY3Rpb24gcmVtb3RlRHVtcChhc0pzb24pIHtcbiAgICB2YXIgZHVtcGVkUmVzdENhY2hlID0ge307XG4gICAgZm9yICh2YXIgY29sbCBpbiByZW1vdGVDYWNoZSkge1xuICAgICAgICBpZiAocmVtb3RlQ2FjaGUuaGFzT3duUHJvcGVydHkoY29sbCkpIHtcbiAgICAgICAgICAgIHZhciBkdW1wZWRDb2xsQ2FjaGUgPSB7fTtcbiAgICAgICAgICAgIGR1bXBlZFJlc3RDYWNoZVtjb2xsXSA9IGR1bXBlZENvbGxDYWNoZTtcbiAgICAgICAgICAgIHZhciBjb2xsQ2FjaGUgPSByZW1vdGVDYWNoZVtjb2xsXTtcbiAgICAgICAgICAgIGZvciAodmFyIG1hcHBpbmcgaW4gY29sbENhY2hlKSB7XG4gICAgICAgICAgICAgICAgaWYgKGNvbGxDYWNoZS5oYXNPd25Qcm9wZXJ0eShtYXBwaW5nKSkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgZHVtcGVkTWFwcGluZ0NhY2hlID0ge307XG4gICAgICAgICAgICAgICAgICAgIGR1bXBlZENvbGxDYWNoZVttYXBwaW5nXSA9IGR1bXBlZE1hcHBpbmdDYWNoZTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIG1hcHBpbmdDYWNoZSA9IGNvbGxDYWNoZVttYXBwaW5nXTtcbiAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgcmVtb3RlSWQgaW4gbWFwcGluZ0NhY2hlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobWFwcGluZ0NhY2hlLmhhc093blByb3BlcnR5KHJlbW90ZUlkKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChtYXBwaW5nQ2FjaGVbcmVtb3RlSWRdKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGR1bXBlZE1hcHBpbmdDYWNoZVtyZW1vdGVJZF0gPSBtYXBwaW5nQ2FjaGVbcmVtb3RlSWRdLl9kdW1wKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBhc0pzb24gPyBKU09OLnN0cmluZ2lmeShkdW1wZWRSZXN0Q2FjaGUsIG51bGwsIDQpIDogZHVtcGVkUmVzdENhY2hlO1xuXG59XG5cbi8qKlxuICogRHVtcCB0aGUgbG9jYWwgaWQgKF9pZCkgY2FjaGVcbiAqIEBwYXJhbSAge2Jvb2xlYW59IGFzSnNvbiBXaGV0aGVyIG9yIG5vdCB0byBhcHBseSBKU09OLnN0cmluZ2lmeVxuICogQHJldHVybiB7U3RyaW5nfE9iamVjdH1cbiAqL1xuZnVuY3Rpb24gbG9jYWxEdW1wKGFzSnNvbikge1xuICAgIHZhciBkdW1wZWRJZENhY2hlID0ge307XG4gICAgZm9yICh2YXIgaWQgaW4gbG9jYWxDYWNoZUJ5SWQpIHtcbiAgICAgICAgaWYgKGxvY2FsQ2FjaGVCeUlkLmhhc093blByb3BlcnR5KGlkKSkge1xuICAgICAgICAgICAgZHVtcGVkSWRDYWNoZVtpZF0gPSBsb2NhbENhY2hlQnlJZFtpZF0uX2R1bXAoKVxuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBhc0pzb24gPyBKU09OLnN0cmluZ2lmeShkdW1wZWRJZENhY2hlLCBudWxsLCA0KSA6IGR1bXBlZElkQ2FjaGU7XG59XG5cbi8qKlxuICogRHVtcCB0byB0aGUgY2FjaGUuXG4gKiBAcGFyYW0gIHtib29sZWFufSBhc0pzb24gV2hldGhlciBvciBub3QgdG8gYXBwbHkgSlNPTi5zdHJpbmdpZnlcbiAqIEByZXR1cm4ge1N0cmluZ3xPYmplY3R9XG4gKi9cbmZ1bmN0aW9uIGR1bXAoYXNKc29uKSB7XG4gICAgdmFyIGR1bXBlZCA9IHtcbiAgICAgICAgbG9jYWxDYWNoZTogbG9jYWxEdW1wKCksXG4gICAgICAgIHJlbW90ZUNhY2hlOiByZW1vdGVEdW1wKClcbiAgICB9O1xuICAgIHJldHVybiBhc0pzb24gPyBKU09OLnN0cmluZ2lmeShkdW1wZWQsIG51bGwsIDQpIDogZHVtcGVkO1xufVxuXG5mdW5jdGlvbiBfcmVtb3RlQ2FjaGUoKSB7XG4gICAgcmV0dXJuIHJlbW90ZUNhY2hlXG59XG5cbmZ1bmN0aW9uIF9sb2NhbENhY2hlKCkge1xuICAgIHJldHVybiBsb2NhbENhY2hlQnlJZDtcbn1cblxuLyoqXG4gKiBRdWVyeSB0aGUgY2FjaGVcbiAqIEBwYXJhbSAge09iamVjdH0gb3B0cyBPYmplY3QgZGVzY3JpYmluZyB0aGUgcXVlcnlcbiAqIEByZXR1cm4ge1NpZXN0YU1vZGVsfVxuICogQGV4YW1wbGVcbiAqIGBgYGpzXG4gKiBjYWNoZS5nZXQoe19pZDogJzUnfSk7IC8vIFF1ZXJ5IGJ5IGxvY2FsIGlkXG4gKiBjYWNoZS5nZXQoe3JlbW90ZUlkOiAnNScsIG1hcHBpbmc6IG15TWFwcGluZ30pOyAvLyBRdWVyeSBieSByZW1vdGUgaWRcbiAqIGBgYFxuICovXG5mdW5jdGlvbiBnZXQob3B0cykge1xuICAgIGlmIChMb2NhbENhY2hlTG9nZ2VyLmRlYnVnLmlzRW5hYmxlZCkgTG9jYWxDYWNoZUxvZ2dlci5kZWJ1ZygnZ2V0Jywgb3B0cyk7XG4gICAgdmFyIG9iaiwgaWRGaWVsZCwgcmVtb3RlSWQ7XG4gICAgdmFyIGxvY2FsSWQgPSBvcHRzLl9pZDtcbiAgICBpZiAobG9jYWxJZCkge1xuICAgICAgICBvYmogPSBnZXRWaWFMb2NhbElkKGxvY2FsSWQpO1xuICAgICAgICBpZiAob2JqKSB7XG4gICAgICAgICAgICByZXR1cm4gb2JqO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaWYgKG9wdHMubWFwcGluZykge1xuICAgICAgICAgICAgICAgIGlkRmllbGQgPSBvcHRzLm1hcHBpbmcuaWQ7XG4gICAgICAgICAgICAgICAgcmVtb3RlSWQgPSBvcHRzW2lkRmllbGRdO1xuICAgICAgICAgICAgICAgIGlmIChMb2NhbENhY2hlTG9nZ2VyLmRlYnVnLmlzRW5hYmxlZCkgTG9jYWxDYWNoZUxvZ2dlci5kZWJ1ZyhpZEZpZWxkICsgJz0nICsgcmVtb3RlSWQpO1xuICAgICAgICAgICAgICAgIHJldHVybiBnZXRWaWFSZW1vdGVJZChyZW1vdGVJZCwgb3B0cyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSBlbHNlIGlmIChvcHRzLm1hcHBpbmcpIHtcbiAgICAgICAgaWRGaWVsZCA9IG9wdHMubWFwcGluZy5pZDtcbiAgICAgICAgcmVtb3RlSWQgPSBvcHRzW2lkRmllbGRdO1xuICAgICAgICBpZiAocmVtb3RlSWQpIHtcbiAgICAgICAgICAgIHJldHVybiBnZXRWaWFSZW1vdGVJZChyZW1vdGVJZCwgb3B0cyk7XG4gICAgICAgIH0gZWxzZSBpZiAob3B0cy5tYXBwaW5nLnNpbmdsZXRvbikge1xuICAgICAgICAgICAgcmV0dXJuIGdldFNpbmdsZXRvbihvcHRzLm1hcHBpbmcpO1xuICAgICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgICAgTG9jYWxDYWNoZUxvZ2dlci53YXJuKCdJbnZhbGlkIG9wdHMgdG8gY2FjaGUnLCB7XG4gICAgICAgICAgICBvcHRzOiBvcHRzXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbn1cblxuLyoqXG4gKiBJbnNlcnQgYW4gb2JqZWN0IGludG8gdGhlIGNhY2hlLlxuICogQHBhcmFtICB7U2llc3RhTW9kZWx9IG9ialxuICogQHRocm93cyB7SW50ZXJuYWxTaWVzdGFFcnJvcn0gQW4gb2JqZWN0IHdpdGggX2lkL3JlbW90ZUlkIGFscmVhZHkgZXhpc3RzLiBOb3QgdGhyb3duIGlmIHNhbWUgb2JoZWN0LlxuICovXG5mdW5jdGlvbiBpbnNlcnQob2JqKSB7XG4gICAgdmFyIGxvY2FsSWQgPSBvYmouX2lkO1xuICAgIGlmIChsb2NhbElkKSB7XG4gICAgICAgIHZhciBjb2xsZWN0aW9uTmFtZSA9IG9iai5tYXBwaW5nLmNvbGxlY3Rpb247XG4gICAgICAgIHZhciBtYXBwaW5nTmFtZSA9IG9iai5tYXBwaW5nLnR5cGU7XG4gICAgICAgIGlmICghbG9jYWxDYWNoZUJ5SWRbbG9jYWxJZF0pIHtcbiAgICAgICAgICAgIGlmIChMb2NhbENhY2hlTG9nZ2VyLmRlYnVnLmlzRW5hYmxlZClcbiAgICAgICAgICAgICAgICBMb2NhbENhY2hlTG9nZ2VyLmRlYnVnKCdMb2NhbCBjYWNoZSBpbnNlcnQ6ICcgKyBvYmouX2R1bXAodHJ1ZSkpO1xuICAgICAgICAgICAgbG9jYWxDYWNoZUJ5SWRbbG9jYWxJZF0gPSBvYmo7XG4gICAgICAgICAgICBpZiAoTG9jYWxDYWNoZUxvZ2dlci50cmFjZS5pc0VuYWJsZWQpXG4gICAgICAgICAgICAgICAgTG9jYWxDYWNoZUxvZ2dlci50cmFjZSgnTG9jYWwgY2FjaGUgbm93IGxvb2tzIGxpa2U6ICcgKyBsb2NhbER1bXAodHJ1ZSkpO1xuICAgICAgICAgICAgaWYgKCFsb2NhbENhY2hlW2NvbGxlY3Rpb25OYW1lXSkgbG9jYWxDYWNoZVtjb2xsZWN0aW9uTmFtZV0gPSB7fTtcbiAgICAgICAgICAgIGlmICghbG9jYWxDYWNoZVtjb2xsZWN0aW9uTmFtZV1bbWFwcGluZ05hbWVdKSBsb2NhbENhY2hlW2NvbGxlY3Rpb25OYW1lXVttYXBwaW5nTmFtZV0gPSB7fTtcbiAgICAgICAgICAgIGxvY2FsQ2FjaGVbY29sbGVjdGlvbk5hbWVdW21hcHBpbmdOYW1lXVtsb2NhbElkXSA9IG9iajtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIFNvbWV0aGluZyBoYXMgZ29uZSBiYWRseSB3cm9uZyBoZXJlLiBUd28gb2JqZWN0cyBzaG91bGQgbmV2ZXIgZXhpc3Qgd2l0aCB0aGUgc2FtZSBfaWRcbiAgICAgICAgICAgIGlmIChsb2NhbENhY2hlQnlJZFtsb2NhbElkXSAhPSBvYmopIHtcbiAgICAgICAgICAgICAgICB2YXIgbWVzc2FnZSA9ICdPYmplY3Qgd2l0aCBfaWQ9XCInICsgbG9jYWxJZC50b1N0cmluZygpICsgJ1wiIGlzIGFscmVhZHkgaW4gdGhlIGNhY2hlLiAnICtcbiAgICAgICAgICAgICAgICAgICAgJ1RoaXMgaXMgYSBzZXJpb3VzIGVycm9yLiBQbGVhc2UgZmlsZSBhIGJ1ZyByZXBvcnQgaWYgeW91IGFyZSBleHBlcmllbmNpbmcgdGhpcyBvdXQgaW4gdGhlIHdpbGQnO1xuICAgICAgICAgICAgICAgIExvY2FsQ2FjaGVMb2dnZXIuZXJyb3IobWVzc2FnZSk7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IobWVzc2FnZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgdmFyIGlkRmllbGQgPSBvYmouaWRGaWVsZDtcbiAgICB2YXIgcmVtb3RlSWQgPSBvYmpbaWRGaWVsZF07XG4gICAgaWYgKHJlbW90ZUlkKSB7XG4gICAgICAgIHJlbW90ZUluc2VydChvYmosIHJlbW90ZUlkKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBpZiAoUmVtb3RlQ2FjaGVMb2dnZXIuZGVidWcuaXNFbmFibGVkKVxuICAgICAgICAgICAgUmVtb3RlQ2FjaGVMb2dnZXIuZGVidWcoJ05vIHJlbW90ZSBpZCAoXCInICsgaWRGaWVsZCArICdcIikgc28gd29udCBiZSBwbGFjaW5nIGluIHRoZSByZW1vdGUgY2FjaGUnLCBvYmopO1xuICAgIH1cbn1cblxuLyoqXG4gKiBSZXR1cm5zIHRydWUgaWYgb2JqZWN0IGlzIGluIHRoZSBjYWNoZVxuICogQHBhcmFtICB7U2llc3RhTW9kZWx9IG9ialxuICogQHJldHVybiB7Ym9vbGVhbn1cbiAqL1xuZnVuY3Rpb24gY29udGFpbnMob2JqKSB7XG4gICAgdmFyIHEgPSB7XG4gICAgICAgIF9pZDogb2JqLl9pZFxuICAgIH07XG4gICAgdmFyIG1hcHBpbmcgPSBvYmoubWFwcGluZztcbiAgICBpZiAobWFwcGluZy5pZCkge1xuICAgICAgICBpZiAob2JqW21hcHBpbmcuaWRdKSB7XG4gICAgICAgICAgICBxLm1hcHBpbmcgPSBtYXBwaW5nO1xuICAgICAgICAgICAgcVttYXBwaW5nLmlkXSA9IG9ialttYXBwaW5nLmlkXTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gISFnZXQocSk7XG59XG5cbi8qKlxuICogUmVtb3ZlcyB0aGUgb2JqZWN0IGZyb20gdGhlIGNhY2hlIChpZiBpdCdzIGFjdHVhbGx5IGluIHRoZSBjYWNoZSkgb3RoZXJ3aXNlcyB0aHJvd3MgYW4gZXJyb3IuXG4gKiBAcGFyYW0gIHtTaWVzdGFNb2RlbH0gb2JqXG4gKiBAdGhyb3dzIHtJbnRlcm5hbFNpZXN0YUVycm9yfSBJZiBvYmplY3QgYWxyZWFkeSBpbiB0aGUgY2FjaGUuXG4gKi9cbmZ1bmN0aW9uIHJlbW92ZShvYmopIHtcbiAgICBpZiAoY29udGFpbnMob2JqKSkge1xuICAgICAgICB2YXIgY29sbGVjdGlvbk5hbWUgPSBvYmoubWFwcGluZy5jb2xsZWN0aW9uO1xuICAgICAgICB2YXIgbWFwcGluZ05hbWUgPSBvYmoubWFwcGluZy50eXBlO1xuICAgICAgICB2YXIgX2lkID0gb2JqLl9pZDtcbiAgICAgICAgaWYgKCFtYXBwaW5nTmFtZSkgdGhyb3cgSW50ZXJuYWxTaWVzdGFFcnJvcignTm8gbWFwcGluZyBuYW1lJyk7XG4gICAgICAgIGlmICghY29sbGVjdGlvbk5hbWUpIHRocm93IEludGVybmFsU2llc3RhRXJyb3IoJ05vIGNvbGxlY3Rpb24gbmFtZScpO1xuICAgICAgICBpZiAoIV9pZCkgdGhyb3cgSW50ZXJuYWxTaWVzdGFFcnJvcignTm8gX2lkJyk7XG4gICAgICAgIGRlbGV0ZSBsb2NhbENhY2hlW2NvbGxlY3Rpb25OYW1lXVttYXBwaW5nTmFtZV1bX2lkXTtcbiAgICAgICAgZGVsZXRlIGxvY2FsQ2FjaGVCeUlkW19pZF07XG4gICAgICAgIGlmIChvYmoubWFwcGluZy5pZCkge1xuICAgICAgICAgICAgdmFyIHJlbW90ZUlkID0gb2JqW29iai5tYXBwaW5nLmlkXTtcbiAgICAgICAgICAgIGRlbGV0ZSByZW1vdGVDYWNoZVtjb2xsZWN0aW9uTmFtZV1bbWFwcGluZ05hbWVdW3JlbW90ZUlkXTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdPYmplY3Qgd2FzIG5vdCBpbiBjYWNoZS4nKTtcbiAgICB9XG59XG5cblxuZXhwb3J0cy5fcmVtb3RlQ2FjaGUgPSBfcmVtb3RlQ2FjaGU7XG5leHBvcnRzLl9sb2NhbENhY2hlID0gX2xvY2FsQ2FjaGU7XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgJ19sb2NhbENhY2hlQnlUeXBlJywge1xuICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gbG9jYWxDYWNoZTtcbiAgICB9XG59KTtcbmV4cG9ydHMuZ2V0ID0gZ2V0O1xuZXhwb3J0cy5pbnNlcnQgPSBpbnNlcnQ7XG5leHBvcnRzLnJlbW90ZUluc2VydCA9IHJlbW90ZUluc2VydDtcbmV4cG9ydHMucmVzZXQgPSByZXNldDtcbmV4cG9ydHMuX2R1bXAgPSBkdW1wO1xuZXhwb3J0cy5jb250YWlucyA9IGNvbnRhaW5zO1xuZXhwb3J0cy5yZW1vdmUgPSByZW1vdmU7IiwiLyoqXG4gKiBUaGUgY2hhbmdlcyBtb2R1bGUgZGVhbHMgd2l0aCBjaGFuZ2VzIHRvIFNpZXN0YU1vZGVsIGluc3RhbmNlcy4gSW4gdGhlIGluLW1lbW9yeSBjYXNlIHRoaXNcbiAqIGp1c3QgbWVhbnMgdGhhdCBub3RpZmljYXRpb25zIGFyZSBzZW50IG9uIGFueSBjaGFuZ2UuIElmIHRoZSBzdG9yYWdlIG1vZHVsZSBpcyBiZWluZyB1c2VkLFxuICogdGhlIGNoYW5nZXMgbW9kdWxlIGlzIGV4dGVuZGVkIHRvIGRlYWwgd2l0aCBtZXJnaW5nIGNoYW5nZXMgaW50byB3aGF0ZXZlciBwZXJzaXN0YW50IHN0b3JhZ2VcbiAqIG1ldGhvZCBpcyBiZWluZyB1c2VkLlxuICogQG1vZHVsZSBjaGFuZ2VzXG4gKi9cblxudmFyIGRlZmluZVN1YlByb3BlcnR5ID0gcmVxdWlyZSgnLi91dGlsJykuZGVmaW5lU3ViUHJvcGVydHlcbiAgICAsIG5vdGlmaWNhdGlvbkNlbnRyZSA9IHJlcXVpcmUoJy4vbm90aWZpY2F0aW9uQ2VudHJlJykubm90aWZpY2F0aW9uQ2VudHJlXG4gICAgLCBJbnRlcm5hbFNpZXN0YUVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpLkludGVybmFsU2llc3RhRXJyb3JcbiAgICAsIGxvZyA9IHJlcXVpcmUoJy4vb3BlcmF0aW9uL2xvZycpXG4gICAgLCBjb2xsZWN0aW9uUmVnaXN0cnkgPSByZXF1aXJlKCcuL2NvbGxlY3Rpb25SZWdpc3RyeScpLkNvbGxlY3Rpb25SZWdpc3RyeTtcblxudmFyIExvZ2dlciA9IGxvZy5sb2dnZXJXaXRoTmFtZSgnY2hhbmdlcycpO1xuTG9nZ2VyLnNldExldmVsKGxvZy5MZXZlbC53YXJuKTtcblxuLyoqXG4gKiBDb25zdGFudHMgdGhhdCBkZXNjcmliZSBjaGFuZ2UgZXZlbnRzLlxuICogU2V0ID0+IEEgbmV3IHZhbHVlIGlzIGFzc2lnbmVkIHRvIGFuIGF0dHJpYnV0ZS9yZWxhdGlvbnNoaXBcbiAqIFNwbGljZSA9PiBBbGwgamF2YXNjcmlwdCBhcnJheSBvcGVyYXRpb25zIGFyZSBkZXNjcmliZWQgYXMgc3BsaWNlcy5cbiAqIERlbGV0ZSA9PiBVc2VkIGluIHRoZSBjYXNlIHdoZXJlIG9iamVjdHMgYXJlIHJlbW92ZWQgZnJvbSBhbiBhcnJheSwgYnV0IGFycmF5IG9yZGVyIGlzIG5vdCBrbm93biBpbiBhZHZhbmNlLlxuICogUmVtb3ZlID0+IE9iamVjdCBkZWxldGlvbiBldmVudHNcbiAqIE5ldyA9PiBPYmplY3QgY3JlYXRpb24gZXZlbnRzXG4gKiBAdHlwZSB7T2JqZWN0fVxuICovXG52YXIgQ2hhbmdlVHlwZSA9IHtcbiAgICBTZXQ6ICdTZXQnLFxuICAgIFNwbGljZTogJ1NwbGljZScsXG4gICAgRGVsZXRlOiAnRGVsZXRlJyxcbiAgICBOZXc6ICdOZXcnLFxuICAgIFJlbW92ZTogJ1JlbW92ZSdcbn07XG5cbi8qKlxuICogUmVwcmVzZW50cyBhbiBpbmRpdmlkdWFsIGNoYW5nZS5cbiAqIEBwYXJhbSBvcHRzXG4gKiBAY29uc3RydWN0b3JcbiAqL1xuZnVuY3Rpb24gQ2hhbmdlKG9wdHMpIHtcbiAgICB0aGlzLl9vcHRzID0gb3B0cztcbiAgICBpZiAoIXRoaXMuX29wdHMpIHtcbiAgICAgICAgdGhpcy5fb3B0cyA9IHt9O1xuICAgIH1cbiAgICBkZWZpbmVTdWJQcm9wZXJ0eS5jYWxsKHRoaXMsICdjb2xsZWN0aW9uJywgdGhpcy5fb3B0cyk7XG4gICAgZGVmaW5lU3ViUHJvcGVydHkuY2FsbCh0aGlzLCAnbWFwcGluZycsIHRoaXMuX29wdHMpO1xuICAgIGRlZmluZVN1YlByb3BlcnR5LmNhbGwodGhpcywgJ19pZCcsIHRoaXMuX29wdHMpO1xuICAgIGRlZmluZVN1YlByb3BlcnR5LmNhbGwodGhpcywgJ2ZpZWxkJywgdGhpcy5fb3B0cyk7XG4gICAgZGVmaW5lU3ViUHJvcGVydHkuY2FsbCh0aGlzLCAndHlwZScsIHRoaXMuX29wdHMpO1xuICAgIGRlZmluZVN1YlByb3BlcnR5LmNhbGwodGhpcywgJ2luZGV4JywgdGhpcy5fb3B0cyk7XG4gICAgZGVmaW5lU3ViUHJvcGVydHkuY2FsbCh0aGlzLCAnYWRkZWQnLCB0aGlzLl9vcHRzKTtcbiAgICBkZWZpbmVTdWJQcm9wZXJ0eS5jYWxsKHRoaXMsICdhZGRlZElkJywgdGhpcy5fb3B0cyk7XG4gICAgZGVmaW5lU3ViUHJvcGVydHkuY2FsbCh0aGlzLCAncmVtb3ZlZCcsIHRoaXMuX29wdHMpO1xuICAgIGRlZmluZVN1YlByb3BlcnR5LmNhbGwodGhpcywgJ3JlbW92ZWRJZCcsIHRoaXMuX29wdHMpO1xuICAgIGRlZmluZVN1YlByb3BlcnR5LmNhbGwodGhpcywgJ25ldycsIHRoaXMuX29wdHMpO1xuICAgIGRlZmluZVN1YlByb3BlcnR5LmNhbGwodGhpcywgJ25ld0lkJywgdGhpcy5fb3B0cyk7XG4gICAgZGVmaW5lU3ViUHJvcGVydHkuY2FsbCh0aGlzLCAnb2xkJywgdGhpcy5fb3B0cyk7XG4gICAgZGVmaW5lU3ViUHJvcGVydHkuY2FsbCh0aGlzLCAnb2xkSWQnLCB0aGlzLl9vcHRzKTtcbiAgICBkZWZpbmVTdWJQcm9wZXJ0eS5jYWxsKHRoaXMsICdvYmonLCB0aGlzLl9vcHRzKTtcbn1cblxuQ2hhbmdlLnByb3RvdHlwZS5fZHVtcCA9IGZ1bmN0aW9uIChqc29uKSB7XG4gICAgdmFyIGR1bXBlZCA9IHt9O1xuICAgIGR1bXBlZC5jb2xsZWN0aW9uID0gKHR5cGVvZiB0aGlzLmNvbGxlY3Rpb24pID09ICdzdHJpbmcnID8gdGhpcy5jb2xsZWN0aW9uIDogdGhpcy5jb2xsZWN0aW9uLl9kdW1wKCk7XG4gICAgZHVtcGVkLm1hcHBpbmcgPSAodHlwZW9mIHRoaXMubWFwcGluZykgPT0gJ3N0cmluZycgPyB0aGlzLm1hcHBpbmcgOiB0aGlzLm1hcHBpbmcudHlwZTtcbiAgICBkdW1wZWQuX2lkID0gdGhpcy5faWQ7XG4gICAgZHVtcGVkLmZpZWxkID0gdGhpcy5maWVsZDtcbiAgICBkdW1wZWQudHlwZSA9IHRoaXMudHlwZTtcbiAgICBpZiAodGhpcy5pbmRleCkgZHVtcGVkLmluZGV4ID0gdGhpcy5pbmRleDtcbiAgICBpZiAodGhpcy5hZGRlZCkgZHVtcGVkLmFkZGVkID0gXy5tYXAodGhpcy5hZGRlZCwgZnVuY3Rpb24gKHgpIHtyZXR1cm4geC5fZHVtcCgpfSk7XG4gICAgaWYgKHRoaXMucmVtb3ZlZCkgZHVtcGVkLnJlbW92ZWQgPSBfLm1hcCh0aGlzLnJlbW92ZWQsIGZ1bmN0aW9uICh4KSB7cmV0dXJuIHguX2R1bXAoKX0pO1xuICAgIGlmICh0aGlzLm9sZCkgZHVtcGVkLm9sZCA9IHRoaXMub2xkO1xuICAgIGlmICh0aGlzLm5ldykgZHVtcGVkLm5ldyA9IHRoaXMubmV3O1xuICAgIHJldHVybiBqc29uID8gSlNPTi5zdHJpbmdpZnkoZHVtcGVkLCBudWxsLCA0KSA6IGR1bXBlZDtcbn07XG5cbi8qKlxuICogQnJvYWRjYXNcbiAqIEBwYXJhbSAge1N0cmluZ30gY29sbGVjdGlvbk5hbWVcbiAqIEBwYXJhbSAge1N0cmluZ30gbWFwcGluZ05hbWVcbiAqIEBwYXJhbSAge09iamVjdH0gYyBhbiBvcHRpb25zIGRpY3Rpb25hcnkgcmVwcmVzZW50aW5nIHRoZSBjaGFuZ2VcbiAqIEByZXR1cm4ge1t0eXBlXX1cbiAqL1xuZnVuY3Rpb24gYnJvYWRjYXN0KGNvbGxlY3Rpb25OYW1lLCBtYXBwaW5nTmFtZSwgYykge1xuICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKSBMb2dnZXIudHJhY2UoJ1NlbmRpbmcgbm90aWZpY2F0aW9uIFwiJyArIGNvbGxlY3Rpb25OYW1lICsgJ1wiIG9mIHR5cGUgJyArIGMudHlwZSk7XG4gICAgbm90aWZpY2F0aW9uQ2VudHJlLmVtaXQoY29sbGVjdGlvbk5hbWUsIGMpO1xuICAgIHZhciBtYXBwaW5nTm90aWYgPSBjb2xsZWN0aW9uTmFtZSArICc6JyArIG1hcHBpbmdOYW1lO1xuICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKSBMb2dnZXIudHJhY2UoJ1NlbmRpbmcgbm90aWZpY2F0aW9uIFwiJyArIG1hcHBpbmdOb3RpZiArICdcIiBvZiB0eXBlICcgKyBjLnR5cGUpO1xuICAgIG5vdGlmaWNhdGlvbkNlbnRyZS5lbWl0KG1hcHBpbmdOb3RpZiwgYyk7XG4gICAgdmFyIGdlbmVyaWNOb3RpZiA9ICdTaWVzdGEnO1xuICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKSBMb2dnZXIudHJhY2UoJ1NlbmRpbmcgbm90aWZpY2F0aW9uIFwiJyArIGdlbmVyaWNOb3RpZiArICdcIiBvZiB0eXBlICcgKyBjLnR5cGUpO1xuICAgIG5vdGlmaWNhdGlvbkNlbnRyZS5lbWl0KGdlbmVyaWNOb3RpZiwgYyk7XG4gICAgdmFyIGxvY2FsSWROb3RpZiA9IGMuX2lkO1xuICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKSBMb2dnZXIudHJhY2UoJ1NlbmRpbmcgbm90aWZpY2F0aW9uIFwiJyArIGxvY2FsSWROb3RpZiArICdcIiBvZiB0eXBlICcgKyBjLnR5cGUpO1xuICAgIG5vdGlmaWNhdGlvbkNlbnRyZS5lbWl0KGxvY2FsSWROb3RpZiwgYyk7XG4gICAgdmFyIGNvbGxlY3Rpb24gPSBjb2xsZWN0aW9uUmVnaXN0cnlbY29sbGVjdGlvbk5hbWVdO1xuICAgIHZhciBlcnI7XG4gICAgaWYgKCFjb2xsZWN0aW9uKSB7XG4gICAgICAgIGVyciA9ICdObyBzdWNoIGNvbGxlY3Rpb24gXCInICsgY29sbGVjdGlvbk5hbWUgKyAnXCInO1xuICAgICAgICBMb2dnZXIuZXJyb3IoZXJyLCBjb2xsZWN0aW9uUmVnaXN0cnkpO1xuICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcihlcnIpO1xuICAgIH1cbiAgICB2YXIgbWFwcGluZyA9IGNvbGxlY3Rpb25bbWFwcGluZ05hbWVdO1xuICAgIGlmICghbWFwcGluZykge1xuICAgICAgICBlcnIgPSAnTm8gc3VjaCBtYXBwaW5nIFwiJyArIG1hcHBpbmdOYW1lICsgJ1wiJztcbiAgICAgICAgTG9nZ2VyLmVycm9yKGVyciwgY29sbGVjdGlvblJlZ2lzdHJ5KTtcbiAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoZXJyKTtcbiAgICB9XG4gICAgaWYgKG1hcHBpbmcuaWQgJiYgYy5vYmpbbWFwcGluZy5pZF0pIHtcbiAgICAgICAgdmFyIHJlbW90ZUlkTm90aWYgPSBjb2xsZWN0aW9uTmFtZSArICc6JyArIG1hcHBpbmdOYW1lICsgJzonICsgYy5vYmpbbWFwcGluZy5pZF07XG4gICAgICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKSBMb2dnZXIudHJhY2UoJ1NlbmRpbmcgbm90aWZpY2F0aW9uIFwiJyArIHJlbW90ZUlkTm90aWYgKyAnXCIgb2YgdHlwZSAnICsgYy50eXBlKTtcbiAgICAgICAgbm90aWZpY2F0aW9uQ2VudHJlLmVtaXQocmVtb3RlSWROb3RpZiwgYyk7XG4gICAgfVxufVxuXG4vKipcbiAqIFRocm93IGFuIGVycm9yIGlmIHRoZSBjaGFuZ2UgaXMgaW5jb3JyZWN0LlxuICogQHBhcmFtIGNoYW5nZU9wdHNcbiAqIEB0aHJvd3Mge0ludGVybmFsU2llc3RhRXJyb3J9IElmIGNoYW5nZSBvcHRpb25zIGFyZSBpbnZhbGlkXG4gKi9cbmZ1bmN0aW9uIHZhbGlkYXRlQ2hhbmdlKGNoYW5nZU9wdHMpIHtcbiAgICBpZiAoIWNoYW5nZU9wdHMubWFwcGluZykgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ011c3QgcGFzcyBhIG1hcHBpbmcnKTtcbiAgICBpZiAoIWNoYW5nZU9wdHMuY29sbGVjdGlvbikgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ011c3QgcGFzcyBhIGNvbGxlY3Rpb24nKTtcbiAgICBpZiAoIWNoYW5nZU9wdHMuX2lkKSB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignTXVzdCBwYXNzIGEgbG9jYWwgaWRlbnRpZmllcicpO1xuICAgIGlmICghY2hhbmdlT3B0cy5vYmopIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdNdXN0IHBhc3MgdGhlIG9iamVjdCcpO1xufVxuXG4vKipcbiAqIFJlZ2lzdGVyIHRoYXQgYSBjaGFuZ2UgaGFzIGJlZW4gbWFkZS5cbiAqIEBwYXJhbSBvcHRzXG4gKiBAcmV0dXJuIHtDaGFuZ2V9IFRoZSBjb25zdHJ1Y3RlZCBjaGFuZ2VcbiAqL1xuZnVuY3Rpb24gcmVnaXN0ZXJDaGFuZ2Uob3B0cykge1xuICAgIHZhbGlkYXRlQ2hhbmdlKG9wdHMpO1xuICAgIHZhciBjb2xsZWN0aW9uID0gb3B0cy5jb2xsZWN0aW9uO1xuICAgIHZhciBtYXBwaW5nID0gb3B0cy5tYXBwaW5nO1xuICAgIHZhciBjID0gbmV3IENoYW5nZShvcHRzKTtcbiAgICBicm9hZGNhc3QoY29sbGVjdGlvbiwgbWFwcGluZywgYyk7XG4gICAgcmV0dXJuIGM7XG59XG5cbmV4cG9ydHMuQ2hhbmdlID0gQ2hhbmdlO1xuZXhwb3J0cy5yZWdpc3RlckNoYW5nZSA9IHJlZ2lzdGVyQ2hhbmdlO1xuZXhwb3J0cy52YWxpZGF0ZUNoYW5nZSA9IHZhbGlkYXRlQ2hhbmdlO1xuZXhwb3J0cy5DaGFuZ2VUeXBlID0gQ2hhbmdlVHlwZTsiLCIvKipcbiAqIEBtb2R1bGUgY29sbGVjdGlvblxuICovXG5cbnZhciBsb2cgPSByZXF1aXJlKCcuL29wZXJhdGlvbi9sb2cnKTtcbnZhciBMb2dnZXIgPSBsb2cubG9nZ2VyV2l0aE5hbWUoJ0NvbGxlY3Rpb24nKTtcbkxvZ2dlci5zZXRMZXZlbChsb2cuTGV2ZWwud2Fybik7XG5cbnZhciBDb2xsZWN0aW9uUmVnaXN0cnkgPSByZXF1aXJlKCcuL2NvbGxlY3Rpb25SZWdpc3RyeScpLkNvbGxlY3Rpb25SZWdpc3RyeTtcbnZhciBPcGVyYXRpb24gPSByZXF1aXJlKCcuL29wZXJhdGlvbi9vcGVyYXRpb24nKS5PcGVyYXRpb247XG52YXIgSW50ZXJuYWxTaWVzdGFFcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKS5JbnRlcm5hbFNpZXN0YUVycm9yO1xudmFyIE1hcHBpbmcgPSByZXF1aXJlKCcuL21hcHBpbmcnKS5NYXBwaW5nO1xudmFyIGV4dGVuZCA9IHJlcXVpcmUoJ2V4dGVuZCcpO1xudmFyIG9ic2VydmUgPSByZXF1aXJlKCcuLi92ZW5kb3Ivb2JzZXJ2ZS1qcy9zcmMvb2JzZXJ2ZScpLlBsYXRmb3JtO1xuXG52YXIgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpO1xudmFyIF8gPSB1dGlsLl87XG5cbnZhciBjYWNoZSA9IHJlcXVpcmUoJy4vY2FjaGUnKTtcblxudmFyIFNBRkVfTUVUSE9EUyA9IFsnR0VUJywgJ0hFQUQnLCAnVFJBQ0UnLCAnT1BUSU9OUycsICdDT05ORUNUJ107XG52YXIgVU5TQUZFX01FVEhPRFMgPSBbJ1BVVCcsICdQQVRDSCcsICdQT1NUJywgJ0RFTEVURSddO1xuXG4vKipcbiAqIEEgY29sbGVjdGlvbiBkZXNjcmliZXMgYSBzZXQgb2YgbW9kZWxzIGFuZCBvcHRpb25hbGx5IGEgUkVTVCBBUEkgd2hpY2ggd2Ugd291bGRcbiAqIGxpa2UgdG8gbW9kZWwuXG4gKlxuICogQHBhcmFtIG5hbWVcbiAqIEBjb25zdHJ1Y3RvclxuICpcbiAqXG4gKiBAZXhhbXBsZVxuICogYGBganNcbiAqIHZhciBHaXRIdWIgPSBuZXcgc2llc3RhLkNvbGxlY3Rpb24oJ0dpdEh1YicpXG4gKiAvLyAuLi4gY29uZmlndXJlIG1hcHBpbmdzLCBkZXNjcmlwdG9ycyBldGMgLi4uXG4gKiBHaXRIdWIuaW5zdGFsbChmdW5jdGlvbiAoKSB7XG4gKiAgICAgLy8gLi4uIGNhcnJ5IG9uLlxuICogfSk7XG4gKiBgYGBcbiAqL1xuZnVuY3Rpb24gQ29sbGVjdGlvbihuYW1lKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGlmICghbmFtZSkgdGhyb3cgbmV3IEVycm9yKCdDb2xsZWN0aW9uIG11c3QgaGF2ZSBhIG5hbWUnKTtcbiAgICB0aGlzLl9uYW1lID0gbmFtZTtcbiAgICB0aGlzLl9kb2NJZCA9ICdDb2xsZWN0aW9uXycgKyB0aGlzLl9uYW1lO1xuICAgIHRoaXMuX3Jhd01hcHBpbmdzID0ge307XG4gICAgdGhpcy5fbWFwcGluZ3MgPSB7fTtcbiAgICAvKipcbiAgICAgKiBUaGUgVVJMIG9mIHRoZSBBUEkgZS5nLiBodHRwOi8vYXBpLmdpdGh1Yi5jb21cbiAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAqL1xuICAgIHRoaXMuYmFzZVVSTCA9ICcnO1xuXG4gICAgLyoqXG4gICAgICogU2V0IHRvIHRydWUgaWYgaW5zdGFsbGF0aW9uIGhhcyBzdWNjZWVkZWQuIFlvdSBjYW5ub3QgdXNlIHRoZSBjb2xsZWN0aW9cbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICB0aGlzLmluc3RhbGxlZCA9IGZhbHNlO1xuICAgIENvbGxlY3Rpb25SZWdpc3RyeS5yZWdpc3Rlcih0aGlzKTtcblxuICAgIC8qKlxuICAgICAqXG4gICAgICogQHR5cGUge3N0cmluZ31cbiAgICAgKi9cbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgJ25hbWUnLCB7XG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIHNlbGYuX25hbWU7XG4gICAgICAgIH1cbiAgICB9KTtcbn1cblxuXG5fLmV4dGVuZChDb2xsZWN0aW9uLnByb3RvdHlwZSwge1xuICAgIC8qKlxuICAgICAqIEVuc3VyZSBtYXBwaW5ncyBhcmUgaW5zdGFsbGVkLlxuICAgICAqIEBwYXJhbSBjYWxsYmFja1xuICAgICAqIEBjbGFzcyBDb2xsZWN0aW9uXG4gICAgICovXG4gICAgaW5zdGFsbDogZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgICAgIHZhciBkZWZlcnJlZCA9IHdpbmRvdy5xID8gd2luZG93LnEuZGVmZXIoKSA6IG51bGw7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgaWYgKCF0aGlzLmluc3RhbGxlZCkge1xuICAgICAgICAgICAgdmFyIG1hcHBpbmdzVG9JbnN0YWxsID0gW107XG4gICAgICAgICAgICBmb3IgKHZhciBuYW1lIGluIHRoaXMuX21hcHBpbmdzKSB7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuX21hcHBpbmdzLmhhc093blByb3BlcnR5KG5hbWUpKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBtYXBwaW5nID0gdGhpcy5fbWFwcGluZ3NbbmFtZV07XG4gICAgICAgICAgICAgICAgICAgIG1hcHBpbmdzVG9JbnN0YWxsLnB1c2gobWFwcGluZyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKExvZ2dlci5pbmZvLmlzRW5hYmxlZClcbiAgICAgICAgICAgICAgICBMb2dnZXIuaW5mbygnVGhlcmUgYXJlICcgKyBtYXBwaW5nc1RvSW5zdGFsbC5sZW5ndGgudG9TdHJpbmcoKSArICcgbWFwcGluZ3MgdG8gaW5zdGFsbCcpO1xuICAgICAgICAgICAgaWYgKG1hcHBpbmdzVG9JbnN0YWxsLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIHZhciBvcGVyYXRpb25zID0gXy5tYXAobWFwcGluZ3NUb0luc3RhbGwsIGZ1bmN0aW9uIChtKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBuZXcgT3BlcmF0aW9uKCdJbnN0YWxsIE1hcHBpbmcnLCBfLmJpbmQobS5pbnN0YWxsLCBtKSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgdmFyIG9wID0gbmV3IE9wZXJhdGlvbignSW5zdGFsbCBNYXBwaW5ncycsIG9wZXJhdGlvbnMpO1xuICAgICAgICAgICAgICAgIG9wLmNvbXBsZXRpb24gPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChvcC5mYWlsZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIExvZ2dlci5lcnJvcignRmFpbGVkIHRvIGluc3RhbGwgY29sbGVjdGlvbicsIG9wLmVycm9yKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYuX2ZpbmFsaXNlSW5zdGFsbGF0aW9uKG9wLmVycm9yLCBjYWxsYmFjayk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzZWxmLmluc3RhbGxlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgZXJyb3JzID0gW107XG4gICAgICAgICAgICAgICAgICAgICAgICBfLmVhY2gobWFwcGluZ3NUb0luc3RhbGwsIGZ1bmN0aW9uIChtKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKExvZ2dlci5pbmZvLmlzRW5hYmxlZClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgTG9nZ2VyLmluZm8oJ0luc3RhbGxpbmcgcmVsYXRpb25zaGlwcyBmb3IgbWFwcGluZyB3aXRoIG5hbWUgXCInICsgbS50eXBlICsgJ1wiJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGVyciA9IG0uaW5zdGFsbFJlbGF0aW9uc2hpcHMoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKSBlcnJvcnMucHVzaChlcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWVycm9ycy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBfLmVhY2gobWFwcGluZ3NUb0luc3RhbGwsIGZ1bmN0aW9uIChtKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChMb2dnZXIuaW5mby5pc0VuYWJsZWQpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBMb2dnZXIuaW5mbygnSW5zdGFsbGluZyByZXZlcnNlIHJlbGF0aW9uc2hpcHMgZm9yIG1hcHBpbmcgd2l0aCBuYW1lIFwiJyArIG0udHlwZSArICdcIicpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgZXJyID0gbS5pbnN0YWxsUmV2ZXJzZVJlbGF0aW9uc2hpcHMoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVycikgZXJyb3JzLnB1c2goZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBlcnI7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXJyb3JzLmxlbmd0aCA9PSAxKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZXJyID0gZXJyb3JzWzBdO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChlcnJvcnMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZXJyID0gZXJyb3JzO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgc2VsZi5fZmluYWxpc2VJbnN0YWxsYXRpb24oZXJyLCBjYWxsYmFjayk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIG9wLnN0YXJ0KCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHNlbGYuX2ZpbmFsaXNlSW5zdGFsbGF0aW9uKG51bGwsIGNhbGxiYWNrKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHZhciBlcnIgPSBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignQ29sbGVjdGlvbiBcIicgKyB0aGlzLl9uYW1lICsgJ1wiIGhhcyBhbHJlYWR5IGJlZW4gaW5zdGFsbGVkJyk7XG4gICAgICAgICAgICBzZWxmLl9maW5hbGlzZUluc3RhbGxhdGlvbihlcnIsIGNhbGxiYWNrKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZGVmZXJyZWQgPyBkZWZlcnJlZC5wcm9taXNlIDogbnVsbDtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogTWFyayB0aGlzIGNvbGxlY3Rpb24gYXMgaW5zdGFsbGVkLCBhbmQgcGxhY2UgdGhlIGNvbGxlY3Rpb24gb24gdGhlIGdsb2JhbCBTaWVzdGEgb2JqZWN0LlxuICAgICAqIEBwYXJhbSAge09iamVjdH0gICBlcnJcbiAgICAgKiBAcGFyYW0gIHtGdW5jdGlvbn0gY2FsbGJhY2tcbiAgICAgKiBAY2xhc3MgQ29sbGVjdGlvblxuICAgICAqL1xuICAgIF9maW5hbGlzZUluc3RhbGxhdGlvbjogZnVuY3Rpb24gKGVyciwgY2FsbGJhY2spIHtcbiAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgIHRoaXMuaW5zdGFsbGVkID0gdHJ1ZTtcbiAgICAgICAgICAgIHZhciBpbmRleCA9IHJlcXVpcmUoJy4vaW5kZXgnKTtcbiAgICAgICAgICAgIGluZGV4W3RoaXMuX25hbWVdID0gdGhpcztcbiAgICAgICAgfVxuICAgICAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKGVycik7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBHaXZlbiB0aGUgbmFtZSBvZiBhIG1hcHBpbmcgYW5kIGFuIG9wdGlvbnMgb2JqZWN0IGRlc2NyaWJpbmcgdGhlIG1hcHBpbmcsIGNyZWF0aW5nIGEgTWFwcGluZ1xuICAgICAqIG9iamVjdCwgaW5zdGFsbCBpdCBhbmQgcmV0dXJuIGl0LlxuICAgICAqIEBwYXJhbSAge1N0cmluZ30gbmFtZVxuICAgICAqIEBwYXJhbSAge09iamVjdH0gb3B0c1xuICAgICAqIEByZXR1cm4ge01hcHBpbmd9XG4gICAgICogQGNsYXNzIENvbGxlY3Rpb25cbiAgICAgKi9cbiAgICBfbWFwcGluZzogZnVuY3Rpb24gKG5hbWUsIG9wdHMpIHtcbiAgICAgICAgaWYgKG5hbWUpIHtcbiAgICAgICAgICAgIHRoaXMuX3Jhd01hcHBpbmdzW25hbWVdID0gb3B0cztcbiAgICAgICAgICAgIG9wdHMgPSBleHRlbmQodHJ1ZSwge30sIG9wdHMpO1xuICAgICAgICAgICAgb3B0cy50eXBlID0gbmFtZTtcbiAgICAgICAgICAgIG9wdHMuY29sbGVjdGlvbiA9IHRoaXMuX25hbWU7XG4gICAgICAgICAgICB2YXIgbWFwcGluZ09iamVjdCA9IG5ldyBNYXBwaW5nKG9wdHMpO1xuICAgICAgICAgICAgdGhpcy5fbWFwcGluZ3NbbmFtZV0gPSBtYXBwaW5nT2JqZWN0O1xuICAgICAgICAgICAgdGhpc1tuYW1lXSA9IG1hcHBpbmdPYmplY3Q7XG4gICAgICAgICAgICByZXR1cm4gbWFwcGluZ09iamVjdDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignTm8gbmFtZSBzcGVjaWZpZWQgd2hlbiBjcmVhdGluZyBtYXBwaW5nJyk7XG4gICAgICAgIH1cbiAgICB9LFxuXG5cbiAgICAvKipcbiAgICAgKiBSZWdpc3RlcnMgYSBtYXBwaW5nIHdpdGggdGhpcyBjb2xsZWN0aW9uLlxuICAgICAqIEBwYXJhbSB7U3RyaW5nfE9iamVjdH0gb3B0c09yTmFtZSBBbiBvcHRpb25zIG9iamVjdCBvciB0aGUgbmFtZSBvZiB0aGUgbWFwcGluZy4gTXVzdCBwYXNzIG9wdGlvbnMgYXMgc2Vjb25kIHBhcmFtIGlmIHNwZWNpZnkgbmFtZS5cbiAgICAgKiBAcGFyYW0ge09iamVjdH0gb3B0cyBPcHRpb25zIGlmIG5hbWUgYWxyZWFkeSBzcGVjaWZpZWQuXG4gICAgICogQHJldHVybiB7TWFwcGluZ31cbiAgICAgKiBAY2xhc3MgQ29sbGVjdGlvblxuICAgICAqL1xuICAgIG1hcHBpbmc6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCkge1xuICAgICAgICAgICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT0gMSkge1xuICAgICAgICAgICAgICAgIGlmICh1dGlsLmlzQXJyYXkoYXJndW1lbnRzWzBdKSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gXy5tYXAoYXJndW1lbnRzWzBdLCBmdW5jdGlvbiAobSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHNlbGYuX21hcHBpbmcobS5uYW1lLCBtKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuX21hcHBpbmcoYXJndW1lbnRzWzBdLm5hbWUsIGFyZ3VtZW50c1swXSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGFyZ3VtZW50c1swXSA9PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5fbWFwcGluZyhhcmd1bWVudHNbMF0sIGFyZ3VtZW50c1sxXSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIF8ubWFwKGFyZ3VtZW50cywgZnVuY3Rpb24gKG0pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBzZWxmLl9tYXBwaW5nKG0ubmFtZSwgbSk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9LFxuXG4gICAgZGVzY3JpcHRvcjogZnVuY3Rpb24gKG9wdHMpIHtcbiAgICAgICAgdmFyIGRlc2NyaXB0b3JzID0gW107XG4gICAgICAgIGlmIChzaWVzdGEuZXh0Lmh0dHBFbmFibGVkKSB7XG4gICAgICAgICAgICBvcHRzLmNvbGxlY3Rpb24gPSB0aGlzO1xuICAgICAgICAgICAgdmFyIG1ldGhvZHMgPSBzaWVzdGEuZXh0Lmh0dHAuX3Jlc29sdmVNZXRob2Qob3B0cy5tZXRob2QpO1xuICAgICAgICAgICAgdmFyIHVuc2FmZSA9IFtdO1xuICAgICAgICAgICAgdmFyIHNhZmUgPSBbXTtcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbWV0aG9kcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIHZhciBtID0gbWV0aG9kc1tpXTtcbiAgICAgICAgICAgICAgICBpZiAoVU5TQUZFX01FVEhPRFMuaW5kZXhPZihtKSA+IC0xKSB7XG4gICAgICAgICAgICAgICAgICAgIHVuc2FmZS5wdXNoKG0pO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHNhZmUucHVzaChtKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodW5zYWZlLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIHZhciByZXF1ZXN0RGVzY3JpcHRvciA9IGV4dGVuZCh7fSwgb3B0cyk7XG4gICAgICAgICAgICAgICAgcmVxdWVzdERlc2NyaXB0b3IubWV0aG9kID0gdW5zYWZlO1xuICAgICAgICAgICAgICAgIHJlcXVlc3REZXNjcmlwdG9yID0gbmV3IHNpZXN0YS5leHQuaHR0cC5SZXF1ZXN0RGVzY3JpcHRvcihyZXF1ZXN0RGVzY3JpcHRvcik7XG4gICAgICAgICAgICAgICAgc2llc3RhLmV4dC5odHRwLkRlc2NyaXB0b3JSZWdpc3RyeS5yZWdpc3RlclJlcXVlc3REZXNjcmlwdG9yKHJlcXVlc3REZXNjcmlwdG9yKTtcbiAgICAgICAgICAgICAgICBkZXNjcmlwdG9ycy5wdXNoKHJlcXVlc3REZXNjcmlwdG9yKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzYWZlLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIHZhciByZXNwb25zZURlc2NyaXB0b3IgPSBleHRlbmQoe30sIG9wdHMpO1xuICAgICAgICAgICAgICAgIHJlc3BvbnNlRGVzY3JpcHRvci5tZXRob2QgPSBzYWZlO1xuICAgICAgICAgICAgICAgIHJlc3BvbnNlRGVzY3JpcHRvciA9IG5ldyBzaWVzdGEuZXh0Lmh0dHAuUmVzcG9uc2VEZXNjcmlwdG9yKHJlc3BvbnNlRGVzY3JpcHRvcik7XG4gICAgICAgICAgICAgICAgc2llc3RhLmV4dC5odHRwLkRlc2NyaXB0b3JSZWdpc3RyeS5yZWdpc3RlclJlc3BvbnNlRGVzY3JpcHRvcihyZXNwb25zZURlc2NyaXB0b3IpO1xuICAgICAgICAgICAgICAgIGRlc2NyaXB0b3JzLnB1c2gocmVzcG9uc2VEZXNjcmlwdG9yKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignSFRUUCBtb2R1bGUgbm90IGluc3RhbGxlZC4nKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZGVzY3JpcHRvcnM7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIER1bXAgdGhpcyBjb2xsZWN0aW9uIGFzIEpTT05cbiAgICAgKiBAcGFyYW0gIHtCb29sZWFufSBhc0pzb24gV2hldGhlciBvciBub3QgdG8gYXBwbHkgSlNPTi5zdHJpbmdpZnlcbiAgICAgKiBAcmV0dXJuIHtTdHJpbmd8T2JqZWN0fVxuICAgICAqIEBjbGFzcyBDb2xsZWN0aW9uXG4gICAgICovXG4gICAgX2R1bXA6IGZ1bmN0aW9uIChhc0pzb24pIHtcbiAgICAgICAgdmFyIG9iaiA9IHt9O1xuICAgICAgICBvYmouaW5zdGFsbGVkID0gdGhpcy5pbnN0YWxsZWQ7XG4gICAgICAgIG9iai5kb2NJZCA9IHRoaXMuX2RvY0lkO1xuICAgICAgICBvYmoubmFtZSA9IHRoaXMuX25hbWU7XG4gICAgICAgIG9iai5iYXNlVVJMID0gdGhpcy5iYXNlVVJMO1xuICAgICAgICByZXR1cm4gYXNKc29uID8gSlNPTi5zdHJpbmdpZnkob2JqLCBudWxsLCA0KSA6IG9iajtcbiAgICB9LFxuXG4gICAgX2h0dHA6IGZ1bmN0aW9uIChtZXRob2QpIHtcbiAgICAgICAgaWYgKHNpZXN0YS5leHQuaHR0cEVuYWJsZWQpIHtcbiAgICAgICAgICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICAgICAgICAgIGFyZ3MudW5zaGlmdCh0aGlzKTtcbiAgICAgICAgICAgIHZhciBmID0gc2llc3RhLmV4dC5odHRwW21ldGhvZF07XG4gICAgICAgICAgICBmLmFwcGx5KGYsIGFyZ3MpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdIVFRQIG1vZHVsZSBub3QgaW5zdGFsbGVkLicpO1xuICAgICAgICB9XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFNlbmQgYSBHRVQgcmVxdWVzdFxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBwYXRoIFRoZSBwYXRoIHRvIHRoZSByZXNvdXJjZSB3ZSB3YW50IHRvIEdFVFxuICAgICAqIEBwYXJhbSB7T2JqZWN0fEZ1bmN0aW9ufSBvcHRzT3JDYWxsYmFjayBFaXRoZXIgYW4gb3B0aW9ucyBvYmplY3Qgb3IgYSBjYWxsYmFjayBpZiBjYW4gdXNlIGRlZmF1bHRzXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgQ2FsbGJhY2sgaWYgb3B0cyBzcGVjaWZpZWQuXG4gICAgICogQHBhY2thZ2UgSFRUUFxuICAgICAqIEByZXR1cm5zIHtQcm9taXNlfVxuICAgICAqL1xuICAgIEdFVDogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gXy5wYXJ0aWFsKHRoaXMuX2h0dHAsICdHRVQnKS5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBTZW5kIGEgT1BUSU9OUyByZXF1ZXN0XG4gICAgICogQHBhcmFtIHtTdHJpbmd9IHBhdGggVGhlIHBhdGggdG8gdGhlIHJlc291cmNlIHRvIHdoaWNoIHdlIHdhbnQgdG8gc2VuZCBhbiBPUFRJT05TIHJlcXVlc3RcbiAgICAgKiBAcGFyYW0ge09iamVjdHxGdW5jdGlvbn0gb3B0c09yQ2FsbGJhY2sgRWl0aGVyIGFuIG9wdGlvbnMgb2JqZWN0IG9yIGEgY2FsbGJhY2sgaWYgY2FuIHVzZSBkZWZhdWx0c1xuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIENhbGxiYWNrIGlmIG9wdHMgc3BlY2lmaWVkLlxuICAgICAqIEByZXR1cm5zIHtQcm9taXNlfVxuICAgICAqL1xuICAgIE9QVElPTlM6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIF8ucGFydGlhbCh0aGlzLl9odHRwLCAnT1BUSU9OUycpLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFNlbmQgYSBUUkFDRSByZXF1ZXN0XG4gICAgICogQHBhcmFtIHtwYXRofSBwYXRoIFRoZSBwYXRoIHRvIHRoZSByZXNvdXJjZSB0byB3aGljaCB3ZSB3YW50IHRvIHNlbmQgYSBUUkFDRSByZXF1ZXN0XG4gICAgICogQHBhcmFtIHtPYmplY3R8RnVuY3Rpb259IG9wdHNPckNhbGxiYWNrIEVpdGhlciBhbiBvcHRpb25zIG9iamVjdCBvciBhIGNhbGxiYWNrIGlmIGNhbiB1c2UgZGVmYXVsdHNcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBDYWxsYmFjayBpZiBvcHRzIHNwZWNpZmllZC5cbiAgICAgKiBAcmV0dXJucyB7UHJvbWlzZX1cbiAgICAgKi9cbiAgICBUUkFDRTogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gXy5wYXJ0aWFsKHRoaXMuX2h0dHAsICdUUkFDRScpLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFNlbmQgYSBIRUFEIHJlcXVlc3RcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gcGF0aCBUaGUgcGF0aCB0byB0aGUgcmVzb3VyY2UgdG8gd2hpY2ggd2Ugd2FudCB0byBzZW5kIGEgSEVBRCByZXF1ZXN0XG4gICAgICogQHBhcmFtIHtPYmplY3R8RnVuY3Rpb259IG9wdHNPckNhbGxiYWNrIEVpdGhlciBhbiBvcHRpb25zIG9iamVjdCBvciBhIGNhbGxiYWNrIGlmIGNhbiB1c2UgZGVmYXVsdHNcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBDYWxsYmFjayBpZiBvcHRzIHNwZWNpZmllZC5cbiAgICAgKiBAcmV0dXJucyB7UHJvbWlzZX1cbiAgICAgKi9cbiAgICBIRUFEOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiBfLnBhcnRpYWwodGhpcy5faHR0cCwgJ0hFQUQnKS5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBTZW5kIGEgUE9TVCByZXF1ZXN0XG4gICAgICogQHBhcmFtIHtTdHJpbmd9IHBhdGggVGhlIHBhdGggdG8gdGhlIHJlc291cmNlIHRvIHdoaWNoIHdlIHdhbnQgdG8gc2VuZCBhIFBPU1QgcmVxdWVzdFxuICAgICAqIEBwYXJhbSB7U2llc3RhTW9kZWx9IG1vZGVsIFRoZSBtb2RlbCB0aGF0IHdlIHdvdWxkIGxpa2UgdG8gUE9TVFxuICAgICAqIEBwYXJhbSB7T2JqZWN0fEZ1bmN0aW9ufSBvcHRzT3JDYWxsYmFjayBFaXRoZXIgYW4gb3B0aW9ucyBvYmplY3Qgb3IgYSBjYWxsYmFjayBpZiBjYW4gdXNlIGRlZmF1bHRzXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgQ2FsbGJhY2sgaWYgb3B0cyBzcGVjaWZpZWQuXG4gICAgICogQHJldHVybnMge1Byb21pc2V9XG4gICAgICovXG4gICAgUE9TVDogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gXy5wYXJ0aWFsKHRoaXMuX2h0dHAsICdQT1NUJykuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogU2VuZCBhIFBVVCByZXF1ZXN0XG4gICAgICogQHBhcmFtIHtTdHJpbmd9IHBhdGggVGhlIHBhdGggdG8gdGhlIHJlc291cmNlIHRvIHdoaWNoIHdlIHdhbnQgdG8gc2VuZCBhIFBVVCByZXF1ZXN0XG4gICAgICogQHBhcmFtIHtTaWVzdGFNb2RlbH0gbW9kZWwgVGhlIG1vZGVsIHRoYXQgd2Ugd291bGQgbGlrZSB0byBQVVRcbiAgICAgKiBAcGFyYW0ge09iamVjdHxGdW5jdGlvbn0gb3B0c09yQ2FsbGJhY2sgRWl0aGVyIGFuIG9wdGlvbnMgb2JqZWN0IG9yIGEgY2FsbGJhY2sgaWYgY2FuIHVzZSBkZWZhdWx0c1xuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIENhbGxiYWNrIGlmIG9wdHMgc3BlY2lmaWVkLlxuICAgICAqIEByZXR1cm5zIHtQcm9taXNlfVxuICAgICAqL1xuICAgIFBVVDogZnVuY3Rpb24gKCkge1xuICAgICAgICBfLnBhcnRpYWwodGhpcy5faHR0cCwgJ1BVVCcpLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFNlbmQgYSBQQVRDSCByZXF1ZXN0XG4gICAgICogQHBhcmFtIHtTdHJpbmd9IHBhdGggVGhlIHBhdGggdG8gdGhlIHJlc291cmNlIHRvIHdoaWNoIHdlIHdhbnQgdG8gc2VuZCBhIFBBVENIIHJlcXVlc3RcbiAgICAgKiBAcGFyYW0ge1NpZXN0YU1vZGVsfSBtb2RlbCBUaGUgbW9kZWwgdGhhdCB3ZSB3b3VsZCBsaWtlIHRvIFBBVENIXG4gICAgICogQHBhcmFtIHtPYmplY3R8RnVuY3Rpb259IG9wdHNPckNhbGxiYWNrIEVpdGhlciBhbiBvcHRpb25zIG9iamVjdCBvciBhIGNhbGxiYWNrIGlmIGNhbiB1c2UgZGVmYXVsdHNcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBDYWxsYmFjayBpZiBvcHRzIHNwZWNpZmllZC5cbiAgICAgKiBAcmV0dXJucyB7UHJvbWlzZX1cbiAgICAgKi9cbiAgICBQQVRDSDogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gXy5wYXJ0aWFsKHRoaXMuX2h0dHAsICdQQVRDSCcpLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFNlbmQgYSBERUxFVEUgcmVxdWVzdC4gQWxzbyByZW1vdmVzIHRoZSBvYmplY3QuXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IHBhdGggVGhlIHBhdGggdG8gdGhlIHJlc291cmNlIHRvIHdoaWNoIHdlIHdhbnQgdG8gREVMRVRFXG4gICAgICogQHBhcmFtIHtTaWVzdGFNb2RlbH0gbW9kZWwgVGhlIG1vZGVsIHRoYXQgd2Ugd291bGQgbGlrZSB0byBQQVRDSFxuICAgICAqIEBwYXJhbSB7T2JqZWN0fEZ1bmN0aW9ufSBvcHRzT3JDYWxsYmFjayBFaXRoZXIgYW4gb3B0aW9ucyBvYmplY3Qgb3IgYSBjYWxsYmFjayBpZiBjYW4gdXNlIGRlZmF1bHRzXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgQ2FsbGJhY2sgaWYgb3B0cyBzcGVjaWZpZWQuXG4gICAgICogQHJldHVybnMge1Byb21pc2V9XG4gICAgICovXG4gICAgREVMRVRFOiBmdW5jdGlvbiAocGF0aCwgb2JqZWN0KSB7XG4gICAgICAgIHJldHVybiBfLnBhcnRpYWwodGhpcy5faHR0cCwgJ0RFTEVURScpLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdGhlIG51bWJlciBvZiBvYmplY3RzIGluIHRoaXMgY29sbGVjdGlvbi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSBjYWxsYmFja1xuICAgICAqIEByZXR1cm5zIHtQcm9taXNlfVxuICAgICAqL1xuICAgIGNvdW50OiBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICAgICAgdmFyIGRlZmVycmVkID0gd2luZG93LnEgPyB3aW5kb3cucS5kZWZlcigpIDogbnVsbDtcbiAgICAgICAgY2FsbGJhY2sgPSB1dGlsLmNvbnN0cnVjdENhbGxiYWNrQW5kUHJvbWlzZUhhbmRsZXIoY2FsbGJhY2ssIGRlZmVycmVkKTtcbiAgICAgICAgdmFyIHRhc2tzID0gXy5tYXAodGhpcy5fbWFwcGluZ3MsIGZ1bmN0aW9uIChtKSB7XG4gICAgICAgICAgICByZXR1cm4gXy5iaW5kKG0uY291bnQsIG0pO1xuICAgICAgICB9KTtcbiAgICAgICAgdXRpbC5wYXJhbGxlbCh0YXNrcywgZnVuY3Rpb24gKGVyciwgbnMpIHtcbiAgICAgICAgICAgIHZhciBuO1xuICAgICAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgICAgICBuID0gXy5yZWR1Y2UobnMsIGZ1bmN0aW9uIChtLCByKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBtICsgclxuICAgICAgICAgICAgICAgIH0sIDApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2FsbGJhY2soZXJyLCBuKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBkZWZlcnJlZCA/IGRlZmVycmVkLnByb21pc2UgOiBudWxsO1xuICAgIH1cbn0pO1xuXG5cbmV4cG9ydHMuQ29sbGVjdGlvbiA9IENvbGxlY3Rpb247IiwiLyoqXG4gKiBAbW9kdWxlIGNvbGxlY3Rpb25cbiAqL1xudmFyIF8gPSByZXF1aXJlKCcuL3V0aWwnKS5fO1xuXG5mdW5jdGlvbiBDb2xsZWN0aW9uUmVnaXN0cnkoKSB7XG4gICAgaWYgKCF0aGlzKSByZXR1cm4gbmV3IENvbGxlY3Rpb25SZWdpc3RyeSgpO1xuICAgIHRoaXMuY29sbGVjdGlvbk5hbWVzID0gW107XG59XG5cbl8uZXh0ZW5kKENvbGxlY3Rpb25SZWdpc3RyeS5wcm90b3R5cGUsIHtcbiAgICByZWdpc3RlcjogZnVuY3Rpb24gKGNvbGxlY3Rpb24pIHtcbiAgICAgICAgdmFyIG5hbWUgPSBjb2xsZWN0aW9uLl9uYW1lO1xuICAgICAgICB0aGlzW25hbWVdID0gY29sbGVjdGlvbjtcbiAgICAgICAgdGhpcy5jb2xsZWN0aW9uTmFtZXMucHVzaChuYW1lKTtcbiAgICB9LFxuICAgIHJlc2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgXy5lYWNoKHRoaXMuY29sbGVjdGlvbk5hbWVzLCBmdW5jdGlvbiAobmFtZSkge1xuICAgICAgICAgICAgZGVsZXRlIHNlbGZbbmFtZV07XG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLmNvbGxlY3Rpb25OYW1lcyA9IFtdO1xuICAgIH1cbn0pO1xuXG5leHBvcnRzLkNvbGxlY3Rpb25SZWdpc3RyeSA9IG5ldyBDb2xsZWN0aW9uUmVnaXN0cnkoKTsiLCIvKipcbiAqIEBtb2R1bGUgZXJyb3JcbiAqL1xuXG4vKipcbiAqIFJlcHJlc2VudHMgaW50ZXJuYWwgZXJyb3JzLiBUaGVzZSBhcmUgdGhyb3duIHdoZW4gc29tZXRoaW5nIGhhcyBnb25lIHZlcnkgd3JvbmcgaW50ZXJuYWxseS4gSWYgeW91IHNlZSBvbmUgb2YgdGhlc2VcbiAqIG91dCBpbiB0aGUgd2lsZCB5b3UgcHJvYmFibHkgbmVlZCB0byBmaWxlIGEgYnVnIHJlcG9ydCBhcyBpdCBtZWFucyBzb21lIGFzc2VydGlvbiBoYXMgZmFpbGVkLlxuICogQHBhcmFtIG1lc3NhZ2VcbiAqIEBwYXJhbSBjb250ZXh0XG4gKiBAcGFyYW0gc3NmXG4gKiBAY29uc3RydWN0b3JcbiAqL1xuZnVuY3Rpb24gSW50ZXJuYWxTaWVzdGFFcnJvcihtZXNzYWdlLCBjb250ZXh0LCBzc2YpIHtcbiAgICB0aGlzLm1lc3NhZ2UgPSBtZXNzYWdlO1xuICAgIHRoaXMuY29udGV4dCA9IGNvbnRleHQ7XG4gICAgLy8gY2FwdHVyZSBzdGFjayB0cmFjZVxuICAgIHNzZiA9IHNzZiB8fCBhcmd1bWVudHMuY2FsbGVlO1xuICAgIGlmIChzc2YgJiYgRXJyb3IuY2FwdHVyZVN0YWNrVHJhY2UpIHtcbiAgICAgICAgRXJyb3IuY2FwdHVyZVN0YWNrVHJhY2UodGhpcywgc3NmKTtcbiAgICB9XG59XG5cbkludGVybmFsU2llc3RhRXJyb3IucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShFcnJvci5wcm90b3R5cGUpO1xuSW50ZXJuYWxTaWVzdGFFcnJvci5wcm90b3R5cGUubmFtZSA9ICdJbnRlcm5hbFNpZXN0YUVycm9yJztcbkludGVybmFsU2llc3RhRXJyb3IucHJvdG90eXBlLmNvbnN0cnVjdG9yID0gSW50ZXJuYWxTaWVzdGFFcnJvcjtcblxuLyoqXG4gKiBGaWVsZHMgb24gZXJyb3Igb2JqZWN0cyBkaXNoZWQgb3V0IGJ5IFNpZXN0YS5cbiAqIEB0eXBlIHtPYmplY3R9XG4gKi9cbnZhciBFcnJvckZpZWxkID0ge1xuICAgIE1lc3NhZ2U6ICdtZXNzYWdlJyxcbiAgICBDb2RlOiAnY29kZSdcbn07XG5cbi8qKlxuICogRW51bWVyYXRlZCBlcnJvcnMuXG4gKiBAdHlwZSB7T2JqZWN0fVxuICovXG52YXIgRXJyb3JDb2RlID0ge1xuICAgIFVua25vd246IDAsXG4gICAgLy8gSWYgbm8gZGVzY3JpcHRvciBtYXRjaGVzIGEgSFRUUCByZXNwb25zZS9yZXF1ZXN0IHRoZW4gdGhpcyBlcnJvciBpc1xuICAgIE5vRGVzY3JpcHRvck1hdGNoZWQ6IDFcbn07XG5cblxuLyoqXG4gKiBNYXAgZXJyb3IgY29kZXMgb250byBkZXNjcmlwdGl2ZSBtZXNzYWdlcy5cbiAqIEB0eXBlIHtPYmplY3R9XG4gKi9cbnZhciBNZXNzYWdlID0ge307XG5NZXNzYWdlW0Vycm9yQ29kZS5Ob0Rlc2NyaXB0b3JNYXRjaGVkXSA9ICdObyBkZXNjcmlwdG9yIG1hdGNoZWQgdGhlIEhUVFAgcmVzcG9uc2UvcmVxdWVzdC4nO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgICBJbnRlcm5hbFNpZXN0YUVycm9yOiBJbnRlcm5hbFNpZXN0YUVycm9yLFxuICAgIEVycm9yQ29kZTogRXJyb3JDb2RlLFxuICAgIEVycm9yRmllbGQ6IEVycm9yRmllbGQsXG4gICAgTWVzc2FnZTogTWVzc2FnZVxufTsiLCIvKipcbiAqIEBtb2R1bGUgc2llc3RhXG4gKi9cblxudmFyIGNvbGxlY3Rpb24gPSByZXF1aXJlKCcuL2NvbGxlY3Rpb24nKSxcbiAgICB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyksXG4gICAgQ29sbGVjdGlvblJlZ2lzdHJ5ID0gcmVxdWlyZSgnLi9jb2xsZWN0aW9uUmVnaXN0cnknKS5Db2xsZWN0aW9uUmVnaXN0cnksXG4gICAgQ29sbGVjdGlvbiA9IGNvbGxlY3Rpb24uQ29sbGVjdGlvbixcbiAgICBjYWNoZSA9IHJlcXVpcmUoJy4vY2FjaGUnKSxcbiAgICBNYXBwaW5nID0gcmVxdWlyZSgnLi9tYXBwaW5nJykuTWFwcGluZyxcbiAgICBub3RpZmljYXRpb25DZW50cmUgPSByZXF1aXJlKCcuL25vdGlmaWNhdGlvbkNlbnRyZScpLm5vdGlmaWNhdGlvbkNlbnRyZSxcbiAgICBPcGVyYXRpb24gPSByZXF1aXJlKCcuL29wZXJhdGlvbi9vcGVyYXRpb24nKS5PcGVyYXRpb24sXG4gICAgT3BlcmF0aW9uUXVldWUgPSByZXF1aXJlKCcuL29wZXJhdGlvbi9xdWV1ZScpLk9wZXJhdGlvblF1ZXVlLFxuICAgIFJlbGF0aW9uc2hpcFR5cGUgPSByZXF1aXJlKCcuL3JlbGF0aW9uc2hpcCcpLlJlbGF0aW9uc2hpcFR5cGUsXG4gICAgbG9nID0gcmVxdWlyZSgnLi9vcGVyYXRpb24vbG9nJyksXG4gICAgXyA9IHV0aWwuXztcblxuaWYgKHdpbmRvdy5RKSB3aW5kb3cucSA9IHdpbmRvdy5RO1xuXG5PcGVyYXRpb24ubG9nTGV2ZWwgPSBsb2cuTGV2ZWwud2Fybjtcbk9wZXJhdGlvblF1ZXVlLmxvZ0xldmVsID0gbG9nLkxldmVsLndhcm47XG5cbi8qKlxuICogQHBhcmFtIGV4dCAtIEV4dGVuc2lvbnMgdG8gaW5jbHVkZVxuICogQGV4YW1wbGVcbiAqIHZhciBzaWVzdGEgPSByZXF1aXJlKCdzaWVzdGEnKTtcbiAqIEBleGFtcGxlXG4gKiB2YXIgc2llc3RhID0gcmVxdWlyZSgnc2llc3RhJykoe2h0dHA6IHJlcXVpcmUoJ2h0dHAnKX0pO1xuICogQHJldHVybiB7c2llc3RhfVxuICovXG52YXIgc2llc3RhID0gZnVuY3Rpb24gKGV4dCkge1xuICAgIGlmICghc2llc3RhLmV4dCkgc2llc3RhLmV4dCA9IHt9O1xuICAgIF8uZXh0ZW5kKHNpZXN0YS5leHQsIGV4dCB8fCB7fSk7XG4gICAgcmV0dXJuIHNpZXN0YTtcbn07XG5cbi8qKlxuICogV2lwZSBldmVyeXRoaW5nIVxuICovXG5zaWVzdGEucmVzZXQgPSBmdW5jdGlvbiAoKSB7XG4gICAgY2FjaGUucmVzZXQoKTtcbiAgICBDb2xsZWN0aW9uUmVnaXN0cnkucmVzZXQoKTtcbiAgICBzaWVzdGEuZXh0Lmh0dHAuRGVzY3JpcHRvclJlZ2lzdHJ5LnJlc2V0KCk7XG4gICAgLy9ub2luc3BlY3Rpb24gSlNBY2Nlc3NpYmlsaXR5Q2hlY2tcbn07XG5cbi8qKlxuICogTGlzdGVuIHRvIG5vdGlmaWNhdG9ucy5cbiAqIEBwYXJhbSB7U3RyaW5nfSBub3RpZmljYXRpb25OYW1lXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBoYW5kbGVyXG4gKi9cbnNpZXN0YS5vbiA9IF8uYmluZChub3RpZmljYXRpb25DZW50cmUub24sIG5vdGlmaWNhdGlvbkNlbnRyZSk7XG5cbi8qKlxuICogTGlzdGVuIHRvIG5vdGlmaWNhdG9ucy5cbiAqIEBwYXJhbSB7U3RyaW5nfSBub3RpZmljYXRpb25OYW1lXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBoYW5kbGVyXG4gKi9cbnNpZXN0YS5hZGRMaXN0ZW5lciA9IHNpZXN0YS5vbjtcblxuLyoqXG4gKiBTdG9wIGxpc3RlbmluZyB0byBhIHBhcnRpY3VsYXIgbm90aWZpY2F0aW9uXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IG5vdGlmaWNhdGlvbk5hbWVcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGhhbmRsZXJcbiAqL1xuc2llc3RhLm9mZiA9IF8uYmluZChub3RpZmljYXRpb25DZW50cmUucmVtb3ZlTGlzdGVuZXIsIG5vdGlmaWNhdGlvbkNlbnRyZSk7XG5cbi8qKlxuICogU3RvcCBsaXN0ZW5pbmcgdG8gYSBwYXJ0aWN1bGFyIG5vdGlmaWNhdGlvblxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBub3RpZmljYXRpb25OYW1lXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBoYW5kbGVyXG4gKi9cbnNpZXN0YS5yZW1vdmVMaXN0ZW5lciA9IHNpZXN0YS5vZmY7XG5cbi8qKlxuICogTGlzdGVuIHRvIG9uZSBhbmQgb25seSBvbmUgbm90aWZpY2F0aW9uLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBub3RpZmljYXRpb25OYW1lXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBoYW5kbGVyXG4gKi9cbnNpZXN0YS5vbmNlID0gXy5iaW5kKG5vdGlmaWNhdGlvbkNlbnRyZS5vbmNlLCBub3RpZmljYXRpb25DZW50cmUpO1xuXG4vKipcbiAqIFJlbW92ZXMgYWxsIGxpc3RlbmVycy5cbiAqL1xuc2llc3RhLnJlbW92ZUFsbExpc3RlbmVycyA9IF8uYmluZChub3RpZmljYXRpb25DZW50cmUucmVtb3ZlQWxsTGlzdGVuZXJzLCBub3RpZmljYXRpb25DZW50cmUpO1xuXG5zaWVzdGEuQ29sbGVjdGlvbiA9IENvbGxlY3Rpb247XG5zaWVzdGEuUmVsYXRpb25zaGlwVHlwZSA9IFJlbGF0aW9uc2hpcFR5cGU7XG5cbi8vIFVzZWQgYnkgbW9kdWxlcy5cbnZhciBjb3JlQ2hhbmdlcyA9IHJlcXVpcmUoJy4vY2hhbmdlcycpO1xuXG4vLyBNYWtlIGF2YWlsYWJsZSBtb2R1bGVzIHRvIGV4dGVuc2lvbnMuXG5zaWVzdGEuX2ludGVybmFsID0ge1xuICAgIGxvZzogbG9nLFxuICAgIE1hcHBpbmc6IE1hcHBpbmcsXG4gICAgbWFwcGluZzogcmVxdWlyZSgnLi9tYXBwaW5nJyksXG4gICAgZXJyb3I6IHJlcXVpcmUoJy4vZXJyb3InKSxcbiAgICBDaGFuZ2VUeXBlOiBjb3JlQ2hhbmdlcy5DaGFuZ2VUeXBlLFxuICAgIHNpZXN0YU1vZGVsOiByZXF1aXJlKCcuL3NpZXN0YU1vZGVsJyksXG4gICAgZXh0ZW5kOiByZXF1aXJlKCdleHRlbmQnKSxcbiAgICBub3RpZmljYXRpb25DZW50cmU6IHJlcXVpcmUoJy4vbm90aWZpY2F0aW9uQ2VudHJlJyksXG4gICAgY2FjaGU6IHJlcXVpcmUoJy4vY2FjaGUnKSxcbiAgICBPcGVyYXRpb246IE9wZXJhdGlvbixcbiAgICBPcGVyYXRpb25RdWV1ZTogT3BlcmF0aW9uUXVldWUsXG4gICAgY29yZUNoYW5nZXM6IGNvcmVDaGFuZ2VzLFxuICAgIENvbGxlY3Rpb25SZWdpc3RyeTogcmVxdWlyZSgnLi9jb2xsZWN0aW9uUmVnaXN0cnknKS5Db2xsZWN0aW9uUmVnaXN0cnksXG4gICAgQ29sbGVjdGlvbjogY29sbGVjdGlvbi5Db2xsZWN0aW9uLFxuICAgIGNvbGxlY3Rpb246IGNvbGxlY3Rpb24sXG4gICAgdXRpbHM6IHV0aWwsXG4gICAgdXRpbDogdXRpbCxcbiAgICBfOiB1dGlsLl8sXG4gICAgcXVlcnk6IHJlcXVpcmUoJy4vcXVlcnknKSxcbiAgICBzdG9yZTogcmVxdWlyZSgnLi9zdG9yZScpXG59O1xuXG5zaWVzdGEuQ29sbGVjdGlvbiA9IGNvbGxlY3Rpb24uQ29sbGVjdGlvbjtcblxuc2llc3RhLnBlcmZvcm1hbmNlTW9uaXRvcmluZ0VuYWJsZWQgPSBmYWxzZTtcbnNpZXN0YS5odHRwRW5hYmxlZCA9IGZhbHNlO1xuc2llc3RhLnN0b3JhZ2VFbmFibGVkID0gZmFsc2U7XG5cbnNpZXN0YS5leHQgPSB7fTtcblxuLyoqXG4gKiBUcnVlIGlmIHNpZXN0YS5odHRwLmpzIGlzIGluc3RhbGxlZCBjb3JyZWN0bHkgKG9yIHNpZXN0YS5idW5kbGUuanMgaXMgYmVpbmcgdXNlZCBpbnN0ZWFkKS5cbiAqL1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KHNpZXN0YS5leHQsICdodHRwRW5hYmxlZCcsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgaWYgKHNpZXN0YS5leHQuX2h0dHBFbmFibGVkICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHJldHVybiBzaWVzdGEuZXh0Ll9odHRwRW5hYmxlZDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gISFzaWVzdGEuZXh0Lmh0dHA7XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uICh2KSB7XG4gICAgICAgIHNpZXN0YS5leHQuX2h0dHBFbmFibGVkID0gdjtcbiAgICB9XG59KTtcblxuLyoqXG4gKiBDcmVhdGVzIGFuZCByZWdpc3RlcnMgYSBuZXcgQ29sbGVjdGlvbi5cbiAqIEBwYXJhbSAge1t0eXBlXX0gbmFtZVxuICogQHBhcmFtICB7W3R5cGVdfSBvcHRzXG4gKiBAcmV0dXJuIHtDb2xsZWN0aW9ufVxuICovXG5zaWVzdGEuY29sbGVjdGlvbiA9IGZ1bmN0aW9uIChuYW1lLCBvcHRzKSB7XG4gICAgcmV0dXJuIG5ldyBDb2xsZWN0aW9uKG5hbWUsIG9wdHMpO1xufTtcblxuLyoqXG4gKiBTZXRzIHRoZSBhamF4IGZ1bmN0aW9uIHRvIHVzZSBlLmcuICQuYWpheFxuICogQHBhcmFtIHtGdW5jdGlvbn0gYWpheCAtIGEganF1ZXJ5LWxpa2UgYWpheCBmdW5jdGlvblxuICogQGV4YW1wbGVcbiAqIC8vIFVzZSB6ZXB0byBpbnN0ZWFkIG9mIGpRdWVyeSBmb3IgaHR0cCBhamF4IHJlcXVlc3RzLlxuICogc2llc3RhLnNldEFqYXgoemVwdG8uYWpheCk7XG4gKi9cbnNpZXN0YS5zZXRBamF4ID0gZnVuY3Rpb24gKGFqYXgpIHtcbiAgICBpZiAoc2llc3RhLmV4dC5odHRwRW5hYmxlZCkge1xuICAgICAgICBzaWVzdGEuZXh0Lmh0dHAuYWpheCA9IGFqYXg7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdodHRwIG1vZHVsZSBub3QgaW5zdGFsbGVkIGNvcnJlY3RseSAoaGF2ZSB5b3UgaW5jbHVkZWQgc2llc3RhLmh0dHAuanM/KScpO1xuICAgIH1cbn07XG5cbi8qKlxuICogUmV0dXJucyB0aGUgYWpheCBmdW5jdGlvbiBiZWluZyB1c2VkLlxuICogQHJldHVybiB7RnVuY3Rpb259XG4gKi9cbnNpZXN0YS5nZXRBamF4ID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBzaWVzdGEuZXh0Lmh0dHAuYWpheDtcbn07XG5cbnNpZXN0YS5ub3RpZnkgPSB1dGlsLm5leHQ7XG5cbi8qKlxuICogUmV0dXJucyBhbiBvYmplY3Qgd2hvcyBrZXlzIG1hcCBvbnRvIHN0cmluZyBjb25zdGFudHMgdXNlZCBmb3IgbG9nIGxldmVscy5cbiAqIEB0eXBlIHtPYmplY3R9XG4gKi9cbnNpZXN0YS5Mb2dMZXZlbCA9IGxvZy5MZXZlbDtcblxuLyoqXG4gKiBTZXRzIHRoZSBsb2cgbGV2ZWwgZm9yIHRoZSBuYW1lZCBsb2dnZXJcbiAqIEBwYXJhbSB7U3RyaW5nfSBsb2dnZXJOYW1lXG4gKiBAcGFyYW0ge1N0cmluZ30gbGV2ZWxcbiAqXG4gKiBAZXhhbXBsZVxuICogLy8gTG9nZ2VyIHVzZWQgYnkgSFRUUCByZXF1ZXN0L3Jlc3BvbnNlIGRlc2NyaXB0b3JzLlxuICogc2llc3RhLnNldExvZ0xldmVsKCdEZXNjcmlwdG9yJywgc2llc3RhLkxvZ0xldmVsLnRyYWNlKTtcbiAqIC8vIExvZ2dlciB1c2VkIGJ5IHJlcXVlc3QgZGVzY3JpcHRvcnMgc3BlY2lmaWNhbGx5LlxuICogc2llc3RhLnNldExvZ0xldmVsKCdSZXF1ZXN0RGVzY3JpcHRvcicsIHNpZXN0YS5Mb2dMZXZlbC50cmFjZSk7XG4gKiAvLyBMb2dnZXIgdXNlZCBieSByZXNwb25zZSBkZXNjcmlwdG9ycyBzcGVjaWZpY2FsbHkuXG4gKiBzaWVzdGEuc2V0TG9nTGV2ZWwoJ1Jlc3BvbnNlRGVzY3JpcHRvcicsIHNpZXN0YS5Mb2dMZXZlbC50cmFjZSk7XG4gKiAvLyBBbGwgZGVzY3JpcHRvcnMgYXJlIHJlZ2lzdGVyZWQgaW4gdGhlIERlc2NyaXB0b3JSZWdpc3RyeS5cbiAqIHNpZXN0YS5zZXRMb2dMZXZlbCgnRGVzY3JpcHRvclJlZ2lzdHJ5Jywgc2llc3RhLkxvZ0xldmVsLnRyYWNlKTtcbiAqIC8vIExvZ2dlciB1c2VkIGJ5IEhUVFAgcmVxdWVzdHMvcmVzcG9uc2VzLlxuICogc2llc3RhLnNldExvZ0xldmVsKCdIVFRQJywgc2llc3RhLkxvZ0xldmVsLnRyYWNlKTtcbiAqIC8vIE9iamVjdHMgYXJlIGNhY2hlZCBieSBsb2NhbCBpZCAoX2lkKSBvciB0aGVpciByZW1vdGUgaWQuIFRoaXMgbG9nZ2VyIGlzIHVzZWQgYnkgdGhlIGxvY2FsIG9iamVjdCBjYWNoZS5cbiAqIHNpZXN0YS5zZXRMb2dMZXZlbCgnTG9jYWxDYWNoZScsIHNpZXN0YS5Mb2dMZXZlbC50cmFjZSk7XG4gKiAvLyBPYmplY3RzIGFyZSBjYWNoZWQgYnkgbG9jYWwgaWQgKF9pZCkgb3IgdGhlaXIgcmVtb3RlIGlkLiBUaGlzIGxvZ2dlciBpcyB1c2VkIGJ5IHRoZSByZW1vdGUgb2JqZWN0IGNhY2hlLlxuICogc2llc3RhLnNldExvZ0xldmVsKCdSZW1vdGVDYWNoZScsIHNpZXN0YS5Mb2dMZXZlbC50cmFjZSk7XG4gKiAvLyBUaGUgbG9nZ2VyIHVzZWQgYnkgY2hhbmdlIG5vdGlmaWNhdGlvbnMuXG4gKiBzaWVzdGEuc2V0TG9nTGV2ZWwoJ2NoYW5nZXMnLCBzaWVzdGEuTG9nTGV2ZWwudHJhY2UpO1xuICogLy8gVGhlIGxvZ2dlciB1c2VkIGJ5IHRoZSBDb2xsZWN0aW9uIGNsYXNzLCB3aGljaCBpcyB1c2VkIHRvIGRlc2NyaWJlIGEgc2V0IG9mIG1hcHBpbmdzLlxuICogc2llc3RhLnNldExvZ0xldmVsKCdDb2xsZWN0aW9uJywgc2llc3RhLkxvZ0xldmVsLnRyYWNlKTtcbiAqIC8vIFRoZSBsb2dnZXIgdXNlZCBieSB0aGUgTWFwcGluZyBjbGFzcy5cbiAqIHNpZXN0YS5zZXRMb2dMZXZlbCgnTWFwcGluZycsIHNpZXN0YS5Mb2dMZXZlbC50cmFjZSk7XG4gKiAvLyBUaGUgbG9nZ2VyIHVzZWQgZHVyaW5nIG1hcHBpbmcgb3BlcmF0aW9ucywgaS5lLiBtYXBwaW5nIGRhdGEgb250byB0aGUgb2JqZWN0IGdyYXBoLlxuICogc2llc3RhLnNldExvZ0xldmVsKCdNYXBwaW5nT3BlcmF0aW9uJywgc2llc3RhLkxvZ0xldmVsLnRyYWNlKTtcbiAqIC8vIFRoZSBsb2dnZXIgdXNlZCBieSB0aGUgU2llc3RhTW9kZWwgY2xhc3MsIHdoaWNoIG1ha2VzIHVwIHRoZSBpbmRpdmlkdWFsIG5vZGVzIG9mIHRoZSBvYmplY3QgZ3JhcGguXG4gKiBzaWVzdGEuc2V0TG9nTGV2ZWwoJ1NpZXN0YU1vZGVsJywgc2llc3RhLkxvZ0xldmVsLnRyYWNlKTtcbiAqIC8vIFRoZSBsb2dnZXIgdXNlZCBieSB0aGUgcGVyZm9ybWFuY2UgbW9uaXRvcmluZyBleHRlbnNpb24gKHNpZXN0YS5wZXJmLmpzKVxuICogc2llc3RhLnNldExvZ0xldmVsKCdQZXJmb3JtYW5jZScsIHNpZXN0YS5Mb2dMZXZlbC50cmFjZSk7XG4gKiAvLyBUaGUgbG9nZ2VyIHVzZWQgZHVyaW5nIGxvY2FsIHF1ZXJpZXMgYWdhaW5zdCB0aGUgb2JqZWN0IGdyYXBoLlxuICogc2llc3RhLnNldExvZ0xldmVsKCdRdWVyeScsIHNpZXN0YS5Mb2dMZXZlbC50cmFjZSk7XG4gKiBzaWVzdGEuc2V0TG9nTGV2ZWwoJ1N0b3JlJywgc2llc3RhLkxvZ0xldmVsLnRyYWNlKTtcbiAqIC8vIE11Y2ggbG9naWMgaW4gU2llc3RhIGlzIHRpZWQgdXAgaW4gJ09wZXJhdGlvbnMnLlxuICogc2llc3RhLnNldExvZ0xldmVsKCdPcGVyYXRpb24nLCBzaWVzdGEuTG9nTGV2ZWwudHJhY2UpO1xuICogLy8gU2llc3RhIG1ha2VzIHVzZSBvZiBxdWV1ZXMgb2Ygb3BlcmF0aW9ucyBmb3IgbWFuYWdpbmcgY29uY3VycmVuY3kgYW5kIGNvbmN1cnJlbnQgb3BlcmF0aW9uIGxpbWl0cy5cbiAqIHNpZXN0YS5zZXRMb2dMZXZlbCgnT3BlcmF0aW9uUXVldWUnLCBzaWVzdGEuTG9nTGV2ZWwudHJhY2UpO1xuICovXG5zaWVzdGEuc2V0TG9nTGV2ZWwgPSBmdW5jdGlvbiAobG9nZ2VyTmFtZSwgbGV2ZWwpIHtcbiAgICB2YXIgTG9nZ2VyID0gbG9nLmxvZ2dlcldpdGhOYW1lKGxvZ2dlck5hbWUpO1xuICAgIExvZ2dlci5zZXRMZXZlbChsZXZlbCk7XG59O1xuXG5cbnNpZXN0YS5zZXJpYWxpc2VycyA9IHt9O1xuc2llc3RhLnNlcmlhbGl6ZXJzID0gc2llc3RhLnNlcmlhbGlzZXJzO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoc2llc3RhLnNlcmlhbGlzZXJzLCAnaWQnLCB7XG4gICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmIChzaWVzdGEuZXh0Lmh0dHBFbmFibGVkKSB7XG4gICAgICAgICAgICByZXR1cm4gc2llc3RhLmV4dC5odHRwLlNlcmlhbGlzZXIuaWRTZXJpYWxpc2VyO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbn0pO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoc2llc3RhLnNlcmlhbGlzZXJzLCAnZGVwdGgnLCB7XG4gICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmIChzaWVzdGEuZXh0Lmh0dHBFbmFibGVkKSB7XG4gICAgICAgICAgICByZXR1cm4gc2llc3RhLmV4dC5odHRwLlNlcmlhbGlzZXIuZGVwdGhTZXJpYWxpemVyO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbn0pO1xuXG4vLyAqIGBzaWVzdGEubWFwYCBpcyBlcXVpdmFsZW50IHRvIFtfLm1hcF0oaHR0cDovL3VuZGVyc2NvcmVqcy5vcmcvI21hcClcbi8vICogYHNpZXN0YS5lYWNoYCBpcyBlcXVpdmFsZW50IHRvIFtfLmVhY2hdKGh0dHA6Ly91bmRlcnNjb3JlanMub3JnLyNlYWNoKVxuLy8gKiBgc2llc3RhLnBhcnRpYWxgIGlzIGVxdWl2YWxlbnQgdG8gW18ucGFydGlhbF0oaHR0cDovL3VuZGVyc2NvcmVqcy5vcmcvI3BhcnRpYWwpXG4vLyAqIGBzaWVzdGEuYmluZGAgaXMgZXF1aXZhbGVudCB0byBbXy5iaW5kXShodHRwOi8vdW5kZXJzY29yZWpzLm9yZy8jYmluZClcbi8vICogYHNpZXN0YS5wbHVja2AgaXMgZXF1aXZhbGVudCB0byBbXy5wbHVja10oaHR0cDovL3VuZGVyc2NvcmVqcy5vcmcvI3BsdWNrKVxuLy8gKiBgc2llc3RhLnByb3BlcnR5YCBpcyBlcXVpdmFsZW50IHRvIFtfLnByb3BlcnR5XShodHRwOi8vdW5kZXJzY29yZWpzLm9yZy8jcHJvcGVydHkpXG4vLyAqIGBzaWVzdGEuc29ydEJ5YCBpcyBlcXVpdmFsZW50IHRvIFtfLnNvcnRCeV0oaHR0cDovL3VuZGVyc2NvcmVqcy5vcmcvI3NvcnRCeSlcbi8vICogYHNpZXN0YS5zZXJpZXNgIGlzIGVxdWl2YWxlbnQgdG8gW2FzeW5jLnNlcmllc10oaHR0cHM6Ly9naXRodWIuY29tL2Nhb2xhbi9hc3luYyNzZXJpZXMpXG4vLyAqIGBzaWVzdGEucGFyYWxsZWxgIGlzIGVxdWl2YWxlbnQgdG8gW2FzeW5jLnBhcmFsbGVsXShodHRwczovL2dpdGh1Yi5jb20vY2FvbGFuL2FzeW5jI3BhcmFsbGVsKVxuXG5zaWVzdGEubWFwID0gdXRpbC5fLm1hcDtcbnNpZXN0YS5lYWNoID0gdXRpbC5fLmVhY2g7XG5zaWVzdGEucGFydGlhbCA9IHV0aWwuXy5wYXJ0aWFsO1xuc2llc3RhLmJpbmQgPSB1dGlsLl8uYmluZDtcbnNpZXN0YS5wbHVjayA9IHV0aWwuXy5wbHVjaztcbnNpZXN0YS5wcm9wZXJ0eSA9IHV0aWwuXy5wbHVjaztcbnNpZXN0YS5zb3J0QnkgPSB1dGlsLl8uc29ydEJ5O1xuc2llc3RhLnNlcmllcyA9IHV0aWwuc2VyaWVzO1xuc2llc3RhLnBhcmFsbGVsID0gdXRpbC5wYXJhbGxlbDtcblxuXG5pZiAodHlwZW9mIHdpbmRvdyAhPSAndW5kZWZpbmVkJykge1xuICAgIHdpbmRvdy5zaWVzdGEgPSBzaWVzdGE7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gc2llc3RhOyIsIi8qKlxuICogQG1vZHVsZSByZWxhdGlvbnNoaXBzXG4gKi9cblxudmFyIHByb3h5ID0gcmVxdWlyZSgnLi9wcm94eScpXG4gICAgLCBSZWxhdGlvbnNoaXBQcm94eSA9IHByb3h5LlJlbGF0aW9uc2hpcFByb3h5XG4gICAgLCBTdG9yZSA9IHJlcXVpcmUoJy4vc3RvcmUnKVxuICAgICwgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpXG4gICAgLCBfID0gdXRpbC5fXG4gICAgLCBJbnRlcm5hbFNpZXN0YUVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpLkludGVybmFsU2llc3RhRXJyb3JcbiAgICAsIGNvcmVDaGFuZ2VzID0gcmVxdWlyZSgnLi9jaGFuZ2VzJylcbiAgICAsIG5vdGlmaWNhdGlvbkNlbnRyZSA9IHJlcXVpcmUoJy4vbm90aWZpY2F0aW9uQ2VudHJlJylcbiAgICAsIHdyYXBBcnJheUZvckF0dHJpYnV0ZXMgPSBub3RpZmljYXRpb25DZW50cmUud3JhcEFycmF5XG4gICAgLCBTaWVzdGFNb2RlbCA9IHJlcXVpcmUoJy4vc2llc3RhTW9kZWwnKS5TaWVzdGFNb2RlbFxuICAgICwgQXJyYXlPYnNlcnZlciA9IHJlcXVpcmUoJy4uL3ZlbmRvci9vYnNlcnZlLWpzL3NyYy9vYnNlcnZlJykuQXJyYXlPYnNlcnZlclxuICAgICwgQ2hhbmdlVHlwZSA9IHJlcXVpcmUoJy4vY2hhbmdlcycpLkNoYW5nZVR5cGVcbiAgICA7XG5cbi8qKlxuICogW01hbnlUb01hbnlQcm94eSBkZXNjcmlwdGlvbl1cbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRzXG4gKi9cbmZ1bmN0aW9uIE1hbnlUb01hbnlQcm94eShvcHRzKSB7XG4gICAgUmVsYXRpb25zaGlwUHJveHkuY2FsbCh0aGlzLCBvcHRzKTtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsICdpc0ZhdWx0Jywge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGlmIChzZWxmLl9pZCkge1xuICAgICAgICAgICAgICAgIHJldHVybiAhc2VsZi5yZWxhdGVkO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH0sXG4gICAgICAgIHNldDogZnVuY3Rpb24gKHYpIHtcbiAgICAgICAgICAgIGlmICh2KSB7XG4gICAgICAgICAgICAgICAgc2VsZi5faWQgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgICAgICAgc2VsZi5yZWxhdGVkID0gbnVsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmICghc2VsZi5faWQpIHtcbiAgICAgICAgICAgICAgICAgICAgc2VsZi5faWQgPSBbXTtcbiAgICAgICAgICAgICAgICAgICAgc2VsZi5yZWxhdGVkID0gW107XG4gICAgICAgICAgICAgICAgICAgIHNlbGYud3JhcEFycmF5KHNlbGYucmVsYXRlZCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG4gICAgdGhpcy5fcmV2ZXJzZUlzQXJyYXkgPSB0cnVlO1xufVxuXG5NYW55VG9NYW55UHJveHkucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShSZWxhdGlvbnNoaXBQcm94eS5wcm90b3R5cGUpO1xuXG5fLmV4dGVuZChNYW55VG9NYW55UHJveHkucHJvdG90eXBlLCB7XG4gICAgY2xlYXJSZXZlcnNlOiBmdW5jdGlvbiAocmVtb3ZlZCkge1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgIF8uZWFjaChyZW1vdmVkLCBmdW5jdGlvbiAocmVtb3ZlZE9iamVjdCkge1xuICAgICAgICAgICAgdmFyIHJldmVyc2VQcm94eSA9IHByb3h5LmdldFJldmVyc2VQcm94eUZvck9iamVjdC5jYWxsKHNlbGYsIHJlbW92ZWRPYmplY3QpO1xuICAgICAgICAgICAgdmFyIGlkeCA9IHJldmVyc2VQcm94eS5faWQuaW5kZXhPZihzZWxmLm9iamVjdC5faWQpO1xuICAgICAgICAgICAgcHJveHkubWFrZUNoYW5nZXNUb1JlbGF0ZWRXaXRob3V0T2JzZXJ2YXRpb25zLmNhbGwocmV2ZXJzZVByb3h5LCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcHJveHkuc3BsaWNlLmNhbGwocmV2ZXJzZVByb3h5LCBpZHgsIDEpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH0sXG4gICAgc2V0UmV2ZXJzZTogZnVuY3Rpb24gKGFkZGVkKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgXy5lYWNoKGFkZGVkLCBmdW5jdGlvbiAoYWRkZWRPYmplY3QpIHtcbiAgICAgICAgICAgIHZhciByZXZlcnNlUHJveHkgPSBwcm94eS5nZXRSZXZlcnNlUHJveHlGb3JPYmplY3QuY2FsbChzZWxmLCBhZGRlZE9iamVjdCk7XG4gICAgICAgICAgICBwcm94eS5tYWtlQ2hhbmdlc1RvUmVsYXRlZFdpdGhvdXRPYnNlcnZhdGlvbnMuY2FsbChyZXZlcnNlUHJveHksIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBwcm94eS5zcGxpY2UuY2FsbChyZXZlcnNlUHJveHksIDAsIDAsIHNlbGYub2JqZWN0KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICB9LFxuICAgIHdyYXBBcnJheTogZnVuY3Rpb24gKGFycikge1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgIHdyYXBBcnJheUZvckF0dHJpYnV0ZXMoYXJyLCB0aGlzLnJldmVyc2VOYW1lLCB0aGlzLm9iamVjdCk7XG4gICAgICAgIGlmICghYXJyLm9uZVRvTWFueU9ic2VydmVyKSB7XG4gICAgICAgICAgICBhcnIub25lVG9NYW55T2JzZXJ2ZXIgPSBuZXcgQXJyYXlPYnNlcnZlcihhcnIpO1xuICAgICAgICAgICAgdmFyIG9ic2VydmVyRnVuY3Rpb24gPSBmdW5jdGlvbiAoc3BsaWNlcykge1xuICAgICAgICAgICAgICAgIHNwbGljZXMuZm9yRWFjaChmdW5jdGlvbiAoc3BsaWNlKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBhZGRlZCA9IHNwbGljZS5hZGRlZENvdW50ID8gYXJyLnNsaWNlKHNwbGljZS5pbmRleCwgc3BsaWNlLmluZGV4ICsgc3BsaWNlLmFkZGVkQ291bnQpIDogW107XG4gICAgICAgICAgICAgICAgICAgIHZhciByZW1vdmVkID0gc3BsaWNlLnJlbW92ZWQ7XG4gICAgICAgICAgICAgICAgICAgIHNlbGYuY2xlYXJSZXZlcnNlKHJlbW92ZWQpO1xuICAgICAgICAgICAgICAgICAgICBzZWxmLnNldFJldmVyc2UoYWRkZWQpO1xuICAgICAgICAgICAgICAgICAgICB2YXIgbWFwcGluZyA9IHByb3h5LmdldEZvcndhcmRNYXBwaW5nLmNhbGwoc2VsZik7XG4gICAgICAgICAgICAgICAgICAgIGNvcmVDaGFuZ2VzLnJlZ2lzdGVyQ2hhbmdlKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbGxlY3Rpb246IG1hcHBpbmcuY29sbGVjdGlvbixcbiAgICAgICAgICAgICAgICAgICAgICAgIG1hcHBpbmc6IG1hcHBpbmcudHlwZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIF9pZDogc2VsZi5vYmplY3QuX2lkLFxuICAgICAgICAgICAgICAgICAgICAgICAgZmllbGQ6IHByb3h5LmdldEZvcndhcmROYW1lLmNhbGwoc2VsZiksXG4gICAgICAgICAgICAgICAgICAgICAgICByZW1vdmVkOiByZW1vdmVkLFxuICAgICAgICAgICAgICAgICAgICAgICAgYWRkZWQ6IGFkZGVkLFxuICAgICAgICAgICAgICAgICAgICAgICAgcmVtb3ZlZElkOiBfLnBsdWNrKHJlbW92ZWQsICdfaWQnKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGFkZGVkSWQ6IF8ucGx1Y2soYWRkZWQsICdfaWQnKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6IENoYW5nZVR5cGUuU3BsaWNlLFxuICAgICAgICAgICAgICAgICAgICAgICAgaW5kZXg6IHNwbGljZS5pbmRleCxcbiAgICAgICAgICAgICAgICAgICAgICAgIG9iajogc2VsZi5vYmplY3RcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgYXJyLm9uZVRvTWFueU9ic2VydmVyLm9wZW4ob2JzZXJ2ZXJGdW5jdGlvbik7XG4gICAgICAgIH1cbiAgICB9LFxuICAgIGdldDogZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgICAgIHZhciBkZWZlcnJlZCA9IHdpbmRvdy5xID8gd2luZG93LnEuZGVmZXIoKSA6IG51bGw7XG4gICAgICAgIGNhbGxiYWNrID0gdXRpbC5jb25zdHJ1Y3RDYWxsYmFja0FuZFByb21pc2VIYW5kbGVyKGNhbGxiYWNrLCBkZWZlcnJlZCk7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgaWYgKHRoaXMuaXNGYXVsdCkge1xuICAgICAgICAgICAgU3RvcmUuZ2V0KHtfaWQ6IHRoaXMuX2lkfSwgZnVuY3Rpb24gKGVyciwgc3RvcmVkKSB7XG4gICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBzZWxmLnJlbGF0ZWQgPSBzdG9yZWQ7XG4gICAgICAgICAgICAgICAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2sobnVsbCwgc3RvcmVkKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KVxuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhudWxsLCB0aGlzLnJlbGF0ZWQpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBkZWZlcnJlZCA/IGRlZmVycmVkLnByb21pc2UgOiBudWxsO1xuICAgIH0sXG4gICAgdmFsaWRhdGU6IGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgaWYgKE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChvYmopICE9ICdbb2JqZWN0IEFycmF5XScpIHtcbiAgICAgICAgICAgIHJldHVybiAnQ2Fubm90IGFzc2lnbiBzY2FsYXIgdG8gbWFueSB0byBtYW55JztcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24gKG9iaikge1xuICAgICAgICBwcm94eS5jaGVja0luc3RhbGxlZC5jYWxsKHRoaXMpO1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgIGlmIChvYmopIHtcbiAgICAgICAgICAgIHZhciBlcnJvck1lc3NhZ2U7XG4gICAgICAgICAgICBpZiAoZXJyb3JNZXNzYWdlID0gdGhpcy52YWxpZGF0ZShvYmopKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGVycm9yTWVzc2FnZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHByb3h5LmNsZWFyUmV2ZXJzZVJlbGF0ZWQuY2FsbCh0aGlzKTtcbiAgICAgICAgICAgICAgICBwcm94eS5zZXQuY2FsbChzZWxmLCBvYmopO1xuICAgICAgICAgICAgICAgIHRoaXMud3JhcEFycmF5KG9iaik7XG4gICAgICAgICAgICAgICAgcHJveHkuc2V0UmV2ZXJzZS5jYWxsKHNlbGYsIG9iaik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBwcm94eS5jbGVhclJldmVyc2VSZWxhdGVkLmNhbGwodGhpcyk7XG4gICAgICAgICAgICBwcm94eS5zZXQuY2FsbChzZWxmLCBvYmopO1xuICAgICAgICB9XG4gICAgfSxcbiAgICBpbnN0YWxsOiBmdW5jdGlvbiAob2JqKSB7XG4gICAgICAgIFJlbGF0aW9uc2hpcFByb3h5LnByb3RvdHlwZS5pbnN0YWxsLmNhbGwodGhpcywgb2JqKTtcbiAgICAgICAgb2JqWygnc3BsaWNlJyArIHV0aWwuY2FwaXRhbGlzZUZpcnN0TGV0dGVyKHRoaXMucmV2ZXJzZU5hbWUpKV0gPSBfLmJpbmQocHJveHkuc3BsaWNlLCB0aGlzKTtcbiAgICB9XG5cblxufSk7XG5cblxubW9kdWxlLmV4cG9ydHMgPSBNYW55VG9NYW55UHJveHk7IiwiLyoqXG4gKiBAbW9kdWxlIG1hcHBpbmdcbiAqL1xuXG52YXIgbG9nID0gcmVxdWlyZSgnLi9vcGVyYXRpb24vbG9nJylcbiAgICAsIENvbGxlY3Rpb25SZWdpc3RyeSA9IHJlcXVpcmUoJy4vY29sbGVjdGlvblJlZ2lzdHJ5JykuQ29sbGVjdGlvblJlZ2lzdHJ5XG4gICAgLCBJbnRlcm5hbFNpZXN0YUVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpLkludGVybmFsU2llc3RhRXJyb3JcbiAgICAsIHJlbGF0aW9uc2hpcCA9IHJlcXVpcmUoJy4vcmVsYXRpb25zaGlwJylcbiAgICAsIFF1ZXJ5ID0gcmVxdWlyZSgnLi9xdWVyeScpLlF1ZXJ5XG4gICAgLCBPcGVyYXRpb24gPSByZXF1aXJlKCcuL29wZXJhdGlvbi9vcGVyYXRpb24nKS5PcGVyYXRpb25cbiAgICAsIEJ1bGtNYXBwaW5nT3BlcmF0aW9uID0gcmVxdWlyZSgnLi9tYXBwaW5nT3BlcmF0aW9uJykuQnVsa01hcHBpbmdPcGVyYXRpb25cbiAgICAsIFNpZXN0YU1vZGVsID0gcmVxdWlyZSgnLi9zaWVzdGFNb2RlbCcpLlNpZXN0YU1vZGVsXG4gICAgLCB1dGlsID0gcmVxdWlyZSgnLi91dGlsJylcbiAgICAsIGRlZmluZVN1YlByb3BlcnR5ID0gdXRpbC5kZWZpbmVTdWJQcm9wZXJ0eVxuICAgICwgY2FjaGUgPSByZXF1aXJlKCcuL2NhY2hlJylcbiAgICAsIHN0b3JlID0gcmVxdWlyZSgnLi9zdG9yZScpXG4gICAgLCBleHRlbmQgPSByZXF1aXJlKCdleHRlbmQnKVxuICAgICwgY29yZUNoYW5nZXMgPSByZXF1aXJlKCcuL2NoYW5nZXMnKVxuICAgICwgd3JhcEFycmF5ID0gcmVxdWlyZSgnLi9ub3RpZmljYXRpb25DZW50cmUnKS53cmFwQXJyYXlcbiAgICAsIE9uZVRvTWFueVByb3h5ID0gcmVxdWlyZSgnLi9vbmVUb01hbnlQcm94eScpXG4gICAgLCBPbmVUb09uZVByb3h5ID0gcmVxdWlyZSgnLi9vbmVUb09uZVByb3h5JylcbiAgICAsIE1hbnlUb01hbnlQcm94eSA9IHJlcXVpcmUoJy4vbWFueVRvTWFueVByb3h5JylcbiAgICAsIF8gPSB1dGlsLl9cbiAgICAsIFJlbGF0aW9uc2hpcFR5cGUgPSByZWxhdGlvbnNoaXAuUmVsYXRpb25zaGlwVHlwZVxuICAgICwgZ3VpZCA9IHV0aWwuZ3VpZFxuICAgICwgQ2hhbmdlVHlwZSA9IGNvcmVDaGFuZ2VzLkNoYW5nZVR5cGVcbiAgICA7XG5cbnZhciBMb2dnZXIgPSBsb2cubG9nZ2VyV2l0aE5hbWUoJ01hcHBpbmcnKTtcbkxvZ2dlci5zZXRMZXZlbChsb2cuTGV2ZWwud2Fybik7XG5cbi8qKlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRzXG4gKi9cbmZ1bmN0aW9uIE1hcHBpbmcob3B0cykge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB0aGlzLl9vcHRzID0gb3B0cztcblxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCAnX2ZpZWxkcycsIHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB2YXIgZmllbGRzID0gW107XG4gICAgICAgICAgICBpZiAoc2VsZi5pZCkge1xuICAgICAgICAgICAgICAgIGZpZWxkcy5wdXNoKHNlbGYuaWQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHNlbGYuX29wdHMuYXR0cmlidXRlcykge1xuICAgICAgICAgICAgICAgIF8uZWFjaChzZWxmLl9vcHRzLmF0dHJpYnV0ZXMsIGZ1bmN0aW9uICh4KSB7XG4gICAgICAgICAgICAgICAgICAgIGZpZWxkcy5wdXNoKHgpXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gZmllbGRzO1xuICAgICAgICB9LFxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICB9KTtcblxuICAgIC8qKlxuICAgICAqIEBuYW1lIHR5cGVcbiAgICAgKiBAdHlwZSB7U3RyaW5nfVxuICAgICAqL1xuICAgIGRlZmluZVN1YlByb3BlcnR5LmNhbGwodGhpcywgJ3R5cGUnLCBzZWxmLl9vcHRzKTtcblxuICAgIC8qKlxuICAgICAqIEBuYW1lIGlkXG4gICAgICogQHR5cGUge1N0cmluZ31cbiAgICAgKi9cbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgJ2lkJywge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiBzZWxmLl9vcHRzWydpZCddIHx8ICdpZCc7XG4gICAgICAgIH0sXG4gICAgICAgIHNldDogZnVuY3Rpb24gKHYpIHtcbiAgICAgICAgICAgIHNlbGYuX29wdHNbJ2lkJ10gPSB2O1xuICAgICAgICB9LFxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlXG4gICAgfSk7XG5cbiAgICBkZWZpbmVTdWJQcm9wZXJ0eS5jYWxsKHRoaXMsICdjb2xsZWN0aW9uJywgc2VsZi5fb3B0cyk7XG4gICAgZGVmaW5lU3ViUHJvcGVydHkuY2FsbCh0aGlzLCAnYXR0cmlidXRlcycsIHNlbGYuX29wdHMpO1xuICAgIGRlZmluZVN1YlByb3BlcnR5LmNhbGwodGhpcywgJ3JlbGF0aW9uc2hpcHMnLCBzZWxmLl9vcHRzKTtcbiAgICBkZWZpbmVTdWJQcm9wZXJ0eS5jYWxsKHRoaXMsICdpbmRleGVzJywgc2VsZi5fb3B0cyk7XG4gICAgZGVmaW5lU3ViUHJvcGVydHkuY2FsbCh0aGlzLCAnc3ViY2xhc3MnLCBzZWxmLl9vcHRzKTtcbiAgICBkZWZpbmVTdWJQcm9wZXJ0eS5jYWxsKHRoaXMsICdzaW5nbGV0b24nLCBzZWxmLl9vcHRzKTtcblxuICAgIGlmICghdGhpcy5yZWxhdGlvbnNoaXBzKSB7XG4gICAgICAgIHRoaXMucmVsYXRpb25zaGlwcyA9IFtdO1xuICAgIH1cblxuICAgIGlmICghdGhpcy5pbmRleGVzKSB7XG4gICAgICAgIHRoaXMuaW5kZXhlcyA9IFtdO1xuICAgIH1cblxuICAgIHRoaXMuX3ZhbGlkYXRlU3ViY2xhc3MoKTtcblxuICAgIHRoaXMuX2luc3RhbGxlZCA9IGZhbHNlO1xuICAgIHRoaXMuX3JlbGF0aW9uc2hpcHNJbnN0YWxsZWQgPSBmYWxzZTtcbiAgICB0aGlzLl9yZXZlcnNlUmVsYXRpb25zaGlwc0luc3RhbGxlZCA9IGZhbHNlO1xuXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsICdpbnN0YWxsZWQnLCB7XG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIHNlbGYuX2luc3RhbGxlZCAmJiBzZWxmLl9yZWxhdGlvbnNoaXBzSW5zdGFsbGVkICYmIHNlbGYuX3JldmVyc2VSZWxhdGlvbnNoaXBzSW5zdGFsbGVkO1xuICAgICAgICB9LFxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICB9KTtcblxufVxuXG5fLmV4dGVuZChNYXBwaW5nLnByb3RvdHlwZSwge1xuICAgIC8qKlxuICAgICAqIEVuc3VyZSB0aGF0IGFueSBzdWJjbGFzc2VzIHBhc3NlZCB0byB0aGUgbWFwcGluZyBhcmUgdmFsaWQgYW5kIHdvcmtpbmcgY29ycmVjdGx5LlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3ZhbGlkYXRlU3ViY2xhc3M6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgaWYgKHRoaXMuc3ViY2xhc3MgJiYgdGhpcy5zdWJjbGFzcyAhPT0gU2llc3RhTW9kZWwpIHtcbiAgICAgICAgICAgIHZhciBvYmogPSBuZXcgdGhpcy5zdWJjbGFzcyh0aGlzKTtcbiAgICAgICAgICAgIGlmICghb2JqLm1hcHBpbmcpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignU3ViY2xhc3MgZm9yIG1hcHBpbmcgXCInICsgdGhpcy50eXBlICsgJ1wiIGhhcyBub3QgYmVlbiBjb25maWd1cmVkIGNvcnJlY3RseS4gJyArXG4gICAgICAgICAgICAgICAgJ0RpZCB5b3UgY2FsbCBzdXBlcj8nKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICh0aGlzLnN1YmNsYXNzLnByb3RvdHlwZSA9PSBTaWVzdGFNb2RlbC5wcm90b3R5cGUpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignU3ViY2xhc3MgZm9yIG1hcHBpbmcgXCInICsgdGhpcy50eXBlICsgJ1wiIGhhcyBub3QgYmVlbiBjb25maWd1cmVkIGNvcnJlY3RseS4gJyArXG4gICAgICAgICAgICAgICAgJ1lvdSBzaG91bGQgdXNlIE9iamVjdC5jcmVhdGUgb24gU2llc3RhTW9kZWwgcHJvdG90eXBlLicpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBJbnN0YWxsIHJlbGF0aW9uc2hpcHMuIFJldHVybnMgZXJyb3IgaW4gZm9ybSBvZiBzdHJpbmcgaWYgZmFpbHMuXG4gICAgICogQHJldHVybiB7U3RyaW5nfG51bGx9XG4gICAgICovXG4gICAgaW5zdGFsbFJlbGF0aW9uc2hpcHM6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9yZWxhdGlvbnNoaXBzSW5zdGFsbGVkKSB7XG4gICAgICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgICAgICBzZWxmLl9yZWxhdGlvbnNoaXBzID0gW107XG4gICAgICAgICAgICBpZiAoc2VsZi5fb3B0cy5yZWxhdGlvbnNoaXBzKSB7XG4gICAgICAgICAgICAgICAgZm9yICh2YXIgbmFtZSBpbiBzZWxmLl9vcHRzLnJlbGF0aW9uc2hpcHMpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKExvZ2dlci5kZWJ1Zy5pc0VuYWJsZWQpXG4gICAgICAgICAgICAgICAgICAgICAgICBMb2dnZXIuZGVidWcoc2VsZi50eXBlICsgJzogY29uZmlndXJpbmcgcmVsYXRpb25zaGlwICcgKyBuYW1lKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHNlbGYuX29wdHMucmVsYXRpb25zaGlwcy5oYXNPd25Qcm9wZXJ0eShuYW1lKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHJlbGF0aW9uc2hpcCA9IHNlbGYuX29wdHMucmVsYXRpb25zaGlwc1tuYW1lXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChyZWxhdGlvbnNoaXAudHlwZSA9PSBSZWxhdGlvbnNoaXBUeXBlLk9uZVRvTWFueSB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlbGF0aW9uc2hpcC50eXBlID09IFJlbGF0aW9uc2hpcFR5cGUuT25lVG9PbmUgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZWxhdGlvbnNoaXAudHlwZSA9PSBSZWxhdGlvbnNoaXBUeXBlLk1hbnlUb01hbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgbWFwcGluZ05hbWUgPSByZWxhdGlvbnNoaXAubWFwcGluZztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoTG9nZ2VyLmRlYnVnLmlzRW5hYmxlZClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgTG9nZ2VyLmRlYnVnKCdyZXZlcnNlTWFwcGluZ05hbWUnLCBtYXBwaW5nTmFtZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFzZWxmLmNvbGxlY3Rpb24pIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdNYXBwaW5nIG11c3QgaGF2ZSBjb2xsZWN0aW9uJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGNvbGxlY3Rpb24gPSBDb2xsZWN0aW9uUmVnaXN0cnlbc2VsZi5jb2xsZWN0aW9uXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWNvbGxlY3Rpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ0NvbGxlY3Rpb24gJyArIHNlbGYuY29sbGVjdGlvbiArICcgbm90IHJlZ2lzdGVyZWQnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHJldmVyc2VNYXBwaW5nID0gY29sbGVjdGlvblttYXBwaW5nTmFtZV07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFyZXZlcnNlTWFwcGluZykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgYXJyID0gbWFwcGluZ05hbWUuc3BsaXQoJy4nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGFyci5sZW5ndGggPT0gMikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGNvbGxlY3Rpb25OYW1lID0gYXJyWzBdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWFwcGluZ05hbWUgPSBhcnJbMV07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgb3RoZXJDb2xsZWN0aW9uID0gQ29sbGVjdGlvblJlZ2lzdHJ5W2NvbGxlY3Rpb25OYW1lXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghb3RoZXJDb2xsZWN0aW9uKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuICdDb2xsZWN0aW9uIHdpdGggbmFtZSBcIicgKyBjb2xsZWN0aW9uTmFtZSArICdcIiBkb2VzIG5vdCBleGlzdC4nO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV2ZXJzZU1hcHBpbmcgPSBvdGhlckNvbGxlY3Rpb25bbWFwcGluZ05hbWVdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChMb2dnZXIuZGVidWcuaXNFbmFibGVkKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBMb2dnZXIuZGVidWcoJ3JldmVyc2VNYXBwaW5nJywgcmV2ZXJzZU1hcHBpbmcpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChyZXZlcnNlTWFwcGluZykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZWxhdGlvbnNoaXAucmV2ZXJzZU1hcHBpbmcgPSByZXZlcnNlTWFwcGluZztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVsYXRpb25zaGlwLmZvcndhcmRNYXBwaW5nID0gdGhpcztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVsYXRpb25zaGlwLmZvcndhcmROYW1lID0gbmFtZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVsYXRpb25zaGlwLnJldmVyc2VOYW1lID0gcmVsYXRpb25zaGlwLnJldmVyc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlbGF0aW9uc2hpcC5pc1JldmVyc2UgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gJ01hcHBpbmcgd2l0aCBuYW1lIFwiJyArIG1hcHBpbmdOYW1lLnRvU3RyaW5nKCkgKyAnXCIgZG9lcyBub3QgZXhpc3QnO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuICdSZWxhdGlvbnNoaXAgdHlwZSAnICsgcmVsYXRpb25zaGlwLnR5cGUgKyAnIGRvZXMgbm90IGV4aXN0JztcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuX3JlbGF0aW9uc2hpcHNJbnN0YWxsZWQgPSB0cnVlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ1JlbGF0aW9uc2hpcHMgZm9yIFwiJyArIHRoaXMudHlwZSArICdcIiBoYXZlIGFscmVhZHkgYmVlbiBpbnN0YWxsZWQnKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9LFxuICAgIGluc3RhbGxSZXZlcnNlUmVsYXRpb25zaGlwczogZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAoIXRoaXMuX3JldmVyc2VSZWxhdGlvbnNoaXBzSW5zdGFsbGVkKSB7XG4gICAgICAgICAgICBmb3IgKHZhciBmb3J3YXJkTmFtZSBpbiB0aGlzLnJlbGF0aW9uc2hpcHMpIHtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5yZWxhdGlvbnNoaXBzLmhhc093blByb3BlcnR5KGZvcndhcmROYW1lKSkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgcmVsYXRpb25zaGlwID0gdGhpcy5yZWxhdGlvbnNoaXBzW2ZvcndhcmROYW1lXTtcbiAgICAgICAgICAgICAgICAgICAgcmVsYXRpb25zaGlwID0gZXh0ZW5kKHRydWUsIHt9LCByZWxhdGlvbnNoaXApO1xuICAgICAgICAgICAgICAgICAgICByZWxhdGlvbnNoaXAuaXNSZXZlcnNlID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHJldmVyc2VNYXBwaW5nID0gcmVsYXRpb25zaGlwLnJldmVyc2VNYXBwaW5nO1xuICAgICAgICAgICAgICAgICAgICB2YXIgcmV2ZXJzZU5hbWUgPSByZWxhdGlvbnNoaXAucmV2ZXJzZU5hbWU7XG4gICAgICAgICAgICAgICAgICAgIGlmIChMb2dnZXIuZGVidWcuaXNFbmFibGVkKVxuICAgICAgICAgICAgICAgICAgICAgICAgTG9nZ2VyLmRlYnVnKHNlbGYudHlwZSArICc6IGNvbmZpZ3VyaW5nICByZXZlcnNlIHJlbGF0aW9uc2hpcCAnICsgbmFtZSk7XG4gICAgICAgICAgICAgICAgICAgIHJldmVyc2VNYXBwaW5nLnJlbGF0aW9uc2hpcHNbcmV2ZXJzZU5hbWVdID0gcmVsYXRpb25zaGlwO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuX3JldmVyc2VSZWxhdGlvbnNoaXBzSW5zdGFsbGVkID0gdHJ1ZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdSZXZlcnNlIHJlbGF0aW9uc2hpcHMgZm9yIFwiJyArIHRoaXMudHlwZSArICdcIiBoYXZlIGFscmVhZHkgYmVlbiBpbnN0YWxsZWQuJyk7XG4gICAgICAgIH1cbiAgICB9LFxuICAgIHF1ZXJ5OiBmdW5jdGlvbiAocXVlcnksIGNhbGxiYWNrKSB7XG4gICAgICAgIHZhciBkZWZlcnJlZCA9IHdpbmRvdy5xID8gd2luZG93LnEuZGVmZXIoKSA6IG51bGw7XG4gICAgICAgIGNhbGxiYWNrID0gdXRpbC5jb25zdHJ1Y3RDYWxsYmFja0FuZFByb21pc2VIYW5kbGVyKGNhbGxiYWNrLCBkZWZlcnJlZCk7XG4gICAgICAgIHZhciBfcXVlcnkgPSBuZXcgUXVlcnkodGhpcywgcXVlcnkpO1xuICAgICAgICBfcXVlcnkuZXhlY3V0ZShjYWxsYmFjayk7XG4gICAgICAgIHJldHVybiBkZWZlcnJlZCA/IGRlZmVycmVkLnByb21pc2UgOiBudWxsO1xuICAgIH0sXG4gICAgZ2V0OiBmdW5jdGlvbiAoaWRPckNhbGxiYWNrLCBjYWxsYmFjaykge1xuICAgICAgICB2YXIgZGVmZXJyZWQgPSB3aW5kb3cucSA/IHdpbmRvdy5xLmRlZmVyKCkgOiBudWxsO1xuICAgICAgICBjYWxsYmFjayA9IHV0aWwuY29uc3RydWN0Q2FsbGJhY2tBbmRQcm9taXNlSGFuZGxlcihjYWxsYmFjaywgZGVmZXJyZWQpO1xuXG4gICAgICAgIGZ1bmN0aW9uIGZpbmlzaChlcnIsIHJlcykge1xuICAgICAgICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhlcnIsIHJlcyk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5zaW5nbGV0b24pIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgaWRPckNhbGxiYWNrID09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjayA9IGlkT3JDYWxsYmFjaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuYWxsKGZ1bmN0aW9uIChlcnIsIG9ianMpIHtcbiAgICAgICAgICAgICAgICBpZiAoZXJyKSBmaW5pc2goZXJyKTtcbiAgICAgICAgICAgICAgICBpZiAob2Jqcy5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdTb21laG93IG1vcmUgdGhhbiBvbmUgb2JqZWN0IGhhcyBiZWVuIGNyZWF0ZWQgZm9yIGEgc2luZ2xldG9uIG1hcHBpbmchICcgK1xuICAgICAgICAgICAgICAgICAgICAnVGhpcyBpcyBhIHNlcmlvdXMgZXJyb3IsIHBsZWFzZSBmaWxlIGEgYnVnIHJlcG9ydC4nKTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKG9ianMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgIGZpbmlzaChudWxsLCBvYmpzWzBdKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBmaW5pc2gobnVsbCwgb2Jqc1swXSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB2YXIgb3B0cyA9IHt9O1xuICAgICAgICAgICAgb3B0c1t0aGlzLmlkXSA9IGlkT3JDYWxsYmFjaztcbiAgICAgICAgICAgIG9wdHMubWFwcGluZyA9IHRoaXM7XG4gICAgICAgICAgICB2YXIgb2JqID0gY2FjaGUuZ2V0KG9wdHMpO1xuICAgICAgICAgICAgaWYgKG9iaikge1xuICAgICAgICAgICAgICAgIGZpbmlzaChudWxsLCBvYmopO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBkZWxldGUgb3B0cy5tYXBwaW5nO1xuICAgICAgICAgICAgICAgIHZhciBxdWVyeSA9IG5ldyBRdWVyeSh0aGlzLCBvcHRzKTtcbiAgICAgICAgICAgICAgICBxdWVyeS5leGVjdXRlKGZ1bmN0aW9uIChlcnIsIHJvd3MpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIG9iaiA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgIGlmICghZXJyICYmIHJvd3MubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAocm93cy5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ01vcmUgdGhhbiBvbmUgb2JqZWN0IHdpdGggaWQ9JyArIGlkT3JDYWxsYmFjay50b1N0cmluZygpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb2JqID0gcm93c1swXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBmaW5pc2goZXJyLCBvYmopO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGRlZmVycmVkID8gZGVmZXJyZWQucHJvbWlzZSA6IG51bGw7XG4gICAgfSxcbiAgICBhbGw6IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgICAgICB2YXIgZGVmZXJyZWQgPSB3aW5kb3cucSA/IHdpbmRvdy5xLmRlZmVyKCkgOiBudWxsO1xuICAgICAgICBjYWxsYmFjayA9IHV0aWwuY29uc3RydWN0Q2FsbGJhY2tBbmRQcm9taXNlSGFuZGxlcihjYWxsYmFjaywgZGVmZXJyZWQpO1xuICAgICAgICB2YXIgcXVlcnkgPSBuZXcgUXVlcnkodGhpcywge30pO1xuICAgICAgICBxdWVyeS5leGVjdXRlKGNhbGxiYWNrKTtcbiAgICAgICAgcmV0dXJuIGRlZmVycmVkID8gZGVmZXJyZWQucHJvbWlzZSA6IG51bGw7XG4gICAgfSxcbiAgICBpbnN0YWxsOiBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICAgICAgaWYgKExvZ2dlci5pbmZvLmlzRW5hYmxlZCkgTG9nZ2VyLmluZm8oJ0luc3RhbGxpbmcgbWFwcGluZyAnICsgdGhpcy50eXBlKTtcbiAgICAgICAgdmFyIGRlZmVycmVkID0gd2luZG93LnEgPyB3aW5kb3cucS5kZWZlcigpIDogbnVsbDtcbiAgICAgICAgY2FsbGJhY2sgPSB1dGlsLmNvbnN0cnVjdENhbGxiYWNrQW5kUHJvbWlzZUhhbmRsZXIoY2FsbGJhY2ssIGRlZmVycmVkKTtcbiAgICAgICAgaWYgKCF0aGlzLl9pbnN0YWxsZWQpIHtcbiAgICAgICAgICAgIHZhciBlcnJvcnMgPSB0aGlzLl92YWxpZGF0ZSgpO1xuICAgICAgICAgICAgdGhpcy5faW5zdGFsbGVkID0gdHJ1ZTtcbiAgICAgICAgICAgIGlmIChMb2dnZXIuaW5mby5pc0VuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICBpZiAoZXJyb3JzLmxlbmd0aCkgTG9nZ2VyLmVycm9yKCdFcnJvcnMgaW5zdGFsbGluZyBtYXBwaW5nICcgKyB0aGlzLnR5cGUgKyAnOiAnICsgZXJyb3JzKTtcbiAgICAgICAgICAgICAgICBlbHNlIExvZ2dlci5pbmZvKCdJbnN0YWxsZWQgbWFwcGluZyAnICsgdGhpcy50eXBlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2soZXJyb3JzLmxlbmd0aCA/IGVycm9ycyA6IG51bGwpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ01hcHBpbmcgXCInICsgdGhpcy50eXBlICsgJ1wiIGhhcyBhbHJlYWR5IGJlZW4gaW5zdGFsbGVkJyk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGRlZmVycmVkID8gZGVmZXJyZWQucHJvbWlzZSA6IG51bGw7XG4gICAgfSxcbiAgICBfdmFsaWRhdGU6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIGVycm9ycyA9IFtdO1xuICAgICAgICBpZiAoIXRoaXMudHlwZSkge1xuICAgICAgICAgICAgZXJyb3JzLnB1c2goJ011c3Qgc3BlY2lmeSBhIHR5cGUnKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIXRoaXMuY29sbGVjdGlvbikge1xuICAgICAgICAgICAgZXJyb3JzLnB1c2goJ0EgbWFwcGluZyBtdXN0IGJlbG9uZyB0byBhbiBjb2xsZWN0aW9uJyk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGVycm9ycztcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIE1hcCBkYXRhIGludG8gU2llc3RhLlxuICAgICAqXG4gICAgICogQHBhcmFtIGRhdGEgUmF3IGRhdGEgcmVjZWl2ZWQgcmVtb3RlbHkgb3Igb3RoZXJ3aXNlXG4gICAgICogQHBhcmFtIGNhbGxiYWNrIENhbGxlZCBvbmNlIHBvdWNoIHBlcnNpc3RlbmNlIHJldHVybnMuXG4gICAgICogQHBhcmFtIG92ZXJyaWRlIEZvcmNlIG1hcHBpbmcgdG8gdGhpcyBvYmplY3RcbiAgICAgKi9cbiAgICBtYXA6IGZ1bmN0aW9uIChkYXRhLCBjYWxsYmFjaywgb3ZlcnJpZGUpIHtcbiAgICAgICAgdmFyIGRlZmVycmVkID0gd2luZG93LnEgPyB3aW5kb3cucS5kZWZlcigpIDogbnVsbDtcbiAgICAgICAgY2FsbGJhY2sgPSB1dGlsLmNvbnN0cnVjdENhbGxiYWNrQW5kUHJvbWlzZUhhbmRsZXIoY2FsbGJhY2ssIGRlZmVycmVkKTtcbiAgICAgICAgaWYgKHRoaXMuaW5zdGFsbGVkKSB7XG4gICAgICAgICAgICBpZiAodXRpbC5pc0FycmF5KGRhdGEpKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fbWFwQnVsayhkYXRhLCBjYWxsYmFjaywgb3ZlcnJpZGUpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9tYXBCdWxrKFtkYXRhXSwgZnVuY3Rpb24gKGVyciwgb2JqZWN0cykge1xuICAgICAgICAgICAgICAgICAgICBpZiAoY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBvYmo7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAob2JqZWN0cykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChvYmplY3RzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvYmogPSBvYmplY3RzWzBdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVyciA/IGVyclswXSA6IG51bGwsIG9iaik7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9LCBvdmVycmlkZSA/IFtvdmVycmlkZV0gOiB1bmRlZmluZWQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ01hcHBpbmcgbXVzdCBiZSBmdWxseSBpbnN0YWxsZWQgYmVmb3JlIGNyZWF0aW5nIGFueSBtb2RlbHMnKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZGVmZXJyZWQgPyBkZWZlcnJlZC5wcm9taXNlIDogbnVsbDtcbiAgICB9LFxuICAgIF9tYXBCdWxrOiBmdW5jdGlvbiAoZGF0YSwgY2FsbGJhY2ssIG92ZXJyaWRlKSB7XG4gICAgICAgIHZhciBkZWZlcnJlZCA9IHdpbmRvdy5xID8gd2luZG93LnEuZGVmZXIoKSA6IG51bGw7XG4gICAgICAgIGNhbGxiYWNrID0gdXRpbC5jb25zdHJ1Y3RDYWxsYmFja0FuZFByb21pc2VIYW5kbGVyKGNhbGxiYWNrLCBkZWZlcnJlZCk7XG4gICAgICAgIHZhciBvcHRzID0ge1xuICAgICAgICAgICAgbWFwcGluZzogdGhpcyxcbiAgICAgICAgICAgIGRhdGE6IGRhdGFcbiAgICAgICAgfTtcbiAgICAgICAgaWYgKG92ZXJyaWRlKSBvcHRzLm9iamVjdHMgPSBvdmVycmlkZTtcbiAgICAgICAgdmFyIG9wID0gbmV3IEJ1bGtNYXBwaW5nT3BlcmF0aW9uKG9wdHMpO1xuICAgICAgICBvcC5vbkNvbXBsZXRpb24oZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdmFyIGVyciA9IG9wLmVycm9yO1xuICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdmFyIG9iamVjdHMgPSBvcC5yZXN1bHQ7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2sobnVsbCwgb2JqZWN0cyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICBvcC5zdGFydCgpO1xuICAgICAgICByZXR1cm4gZGVmZXJyZWQgPyBkZWZlcnJlZC5wcm9taXNlIDogbnVsbDtcbiAgICB9LFxuICAgIF9jb3VudENhY2hlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBjb2xsQ2FjaGUgPSBjYWNoZS5fbG9jYWxDYWNoZUJ5VHlwZVt0aGlzLmNvbGxlY3Rpb25dIHx8IHt9O1xuICAgICAgICB2YXIgbWFwcGluZ0NhY2hlID0gY29sbENhY2hlW3RoaXMudHlwZV0gfHwge307XG4gICAgICAgIHJldHVybiBfLnJlZHVjZShPYmplY3Qua2V5cyhtYXBwaW5nQ2FjaGUpLCBmdW5jdGlvbiAobSwgX2lkKSB7XG4gICAgICAgICAgICBtW19pZF0gPSB7fTtcbiAgICAgICAgICAgIHJldHVybiBtO1xuICAgICAgICB9LCB7fSk7XG4gICAgfSxcbiAgICBjb3VudDogZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgICAgIHZhciBkZWZlcnJlZCA9IHdpbmRvdy5xID8gd2luZG93LnEuZGVmZXIoKSA6IG51bGw7XG4gICAgICAgIGNhbGxiYWNrID0gdXRpbC5jb25zdHJ1Y3RDYWxsYmFja0FuZFByb21pc2VIYW5kbGVyKGNhbGxiYWNrLCBkZWZlcnJlZCk7XG4gICAgICAgIHZhciBoYXNoID0gdGhpcy5fY291bnRDYWNoZSgpO1xuICAgICAgICBpZiAoc2llc3RhLmV4dC5zdG9yYWdlRW5hYmxlZCkge1xuICAgICAgICAgICAgdmFyIHBvdWNoID0gc2llc3RhLmV4dC5zdG9yYWdlLlBvdWNoLmdldFBvdWNoKCk7XG4gICAgICAgICAgICB2YXIgaW5kZXhOYW1lID0gKG5ldyBzaWVzdGEuZXh0LnN0b3JhZ2UuSW5kZXgodGhpcy5jb2xsZWN0aW9uLCB0aGlzLnR5cGUpKS5fZ2V0TmFtZSgpICsgJ18nO1xuICAgICAgICAgICAgcG91Y2gucXVlcnkoaW5kZXhOYW1lLCB7XG4gICAgICAgICAgICAgICAgaW5jbHVkZV9kb2NzOiBmYWxzZVxuICAgICAgICAgICAgfSwgZnVuY3Rpb24gKGVyciwgcmVzcCkge1xuICAgICAgICAgICAgICAgIHZhciBuO1xuICAgICAgICAgICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIF8uZWFjaChfLnBsdWNrKHJlc3Aucm93cywgJ2lkJyksIGZ1bmN0aW9uIChpZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaGFzaFtpZF0gPSB7fTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIG4gPSBPYmplY3Qua2V5cyhoYXNoKS5sZW5ndGg7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVyciwgbik7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIE9iamVjdC5rZXlzKGhhc2gpLmxlbmd0aClcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZGVmZXJyZWQgPyBkZWZlcnJlZC5wcm9taXNlIDogbnVsbDtcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIENvbnZlcnQgcmF3IGRhdGEgaW50byBhIFNpZXN0YU1vZGVsXG4gICAgICogQHJldHVybnMge1NpZXN0YU1vZGVsfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX25ldzogZnVuY3Rpb24gKGRhdGEpIHtcbiAgICAgICAgaWYgKHRoaXMuaW5zdGFsbGVkKSB7XG4gICAgICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgICAgICB2YXIgX2lkO1xuICAgICAgICAgICAgaWYgKGRhdGEpIHtcbiAgICAgICAgICAgICAgICBfaWQgPSBkYXRhLl9pZCA/IGRhdGEuX2lkIDogZ3VpZCgpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBfaWQgPSBndWlkKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB2YXIgbmV3TW9kZWw7XG4gICAgICAgICAgICBpZiAodGhpcy5zdWJjbGFzcykge1xuICAgICAgICAgICAgICAgIG5ld01vZGVsID0gbmV3IHRoaXMuc3ViY2xhc3ModGhpcyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIG5ld01vZGVsID0gbmV3IFNpZXN0YU1vZGVsKHRoaXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKExvZ2dlci5pbmZvLmlzRW5hYmxlZClcbiAgICAgICAgICAgICAgICBMb2dnZXIuaW5mbygnTmV3IG9iamVjdCBjcmVhdGVkIF9pZD1cIicgKyBfaWQudG9TdHJpbmcoKSArICdcIiwgdHlwZT0nICsgdGhpcy50eXBlLCBkYXRhKTtcbiAgICAgICAgICAgIG5ld01vZGVsLl9pZCA9IF9pZDtcbiAgICAgICAgICAgIC8vIFBsYWNlIGF0dHJpYnV0ZXMgb24gdGhlIG9iamVjdC5cbiAgICAgICAgICAgIG5ld01vZGVsLl9fdmFsdWVzID0gZGF0YSB8fCB7fTtcbiAgICAgICAgICAgIHZhciBmaWVsZHMgPSB0aGlzLl9maWVsZHM7XG4gICAgICAgICAgICB2YXIgaWR4ID0gZmllbGRzLmluZGV4T2YodGhpcy5pZCk7XG4gICAgICAgICAgICBpZiAoaWR4ID4gLTEpIHtcbiAgICAgICAgICAgICAgICBmaWVsZHMuc3BsaWNlKGlkeCwgMSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBfLmVhY2goZmllbGRzLCBmdW5jdGlvbiAoZmllbGQpIHtcbiAgICAgICAgICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkobmV3TW9kZWwsIGZpZWxkLCB7XG4gICAgICAgICAgICAgICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG5ld01vZGVsLl9fdmFsdWVzW2ZpZWxkXSB8fCBudWxsO1xuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICBzZXQ6IGZ1bmN0aW9uICh2KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgb2xkID0gbmV3TW9kZWwuX192YWx1ZXNbZmllbGRdO1xuICAgICAgICAgICAgICAgICAgICAgICAgbmV3TW9kZWwuX192YWx1ZXNbZmllbGRdID0gdjtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvcmVDaGFuZ2VzLnJlZ2lzdGVyQ2hhbmdlKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb2xsZWN0aW9uOiBzZWxmLmNvbGxlY3Rpb24sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWFwcGluZzogc2VsZi50eXBlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIF9pZDogbmV3TW9kZWwuX2lkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5ldzogdixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbGQ6IG9sZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiBDaGFuZ2VUeXBlLlNldCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmaWVsZDogZmllbGQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb2JqOiBuZXdNb2RlbFxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodXRpbC5pc0FycmF5KHYpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgd3JhcEFycmF5KHYsIGZpZWxkLCBuZXdNb2RlbCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShuZXdNb2RlbCwgdGhpcy5pZCwge1xuICAgICAgICAgICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbmV3TW9kZWwuX192YWx1ZXNbc2VsZi5pZF0gfHwgbnVsbDtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHNldDogZnVuY3Rpb24gKHYpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIG9sZCA9IG5ld01vZGVsW3NlbGYuaWRdO1xuICAgICAgICAgICAgICAgICAgICBuZXdNb2RlbC5fX3ZhbHVlc1tzZWxmLmlkXSA9IHY7XG4gICAgICAgICAgICAgICAgICAgIGNvcmVDaGFuZ2VzLnJlZ2lzdGVyQ2hhbmdlKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbGxlY3Rpb246IHNlbGYuY29sbGVjdGlvbixcbiAgICAgICAgICAgICAgICAgICAgICAgIG1hcHBpbmc6IHNlbGYudHlwZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIF9pZDogbmV3TW9kZWwuX2lkLFxuICAgICAgICAgICAgICAgICAgICAgICAgbmV3OiB2LFxuICAgICAgICAgICAgICAgICAgICAgICAgb2xkOiBvbGQsXG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiBDaGFuZ2VUeXBlLlNldCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGZpZWxkOiBzZWxmLmlkLFxuICAgICAgICAgICAgICAgICAgICAgICAgb2JqOiBuZXdNb2RlbFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgY2FjaGUucmVtb3RlSW5zZXJ0KG5ld01vZGVsLCB2LCBvbGQpO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgZm9yICh2YXIgbmFtZSBpbiB0aGlzLnJlbGF0aW9uc2hpcHMpIHtcbiAgICAgICAgICAgICAgICB2YXIgcHJveHk7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMucmVsYXRpb25zaGlwcy5oYXNPd25Qcm9wZXJ0eShuYW1lKSkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgcmVsYXRpb25zaGlwID0gdGhpcy5yZWxhdGlvbnNoaXBzW25hbWVdO1xuICAgICAgICAgICAgICAgICAgICBpZiAocmVsYXRpb25zaGlwLnR5cGUgPT0gUmVsYXRpb25zaGlwVHlwZS5PbmVUb01hbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHByb3h5ID0gbmV3IE9uZVRvTWFueVByb3h5KHJlbGF0aW9uc2hpcCk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAocmVsYXRpb25zaGlwLnR5cGUgPT0gUmVsYXRpb25zaGlwVHlwZS5PbmVUb09uZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcHJveHkgPSBuZXcgT25lVG9PbmVQcm94eShyZWxhdGlvbnNoaXApO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHJlbGF0aW9uc2hpcC50eXBlID09IFJlbGF0aW9uc2hpcFR5cGUuTWFueVRvTWFueSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcHJveHkgPSBuZXcgTWFueVRvTWFueVByb3h5KHJlbGF0aW9uc2hpcCk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignTm8gc3VjaCByZWxhdGlvbnNoaXAgdHlwZTogJyArIHJlbGF0aW9uc2hpcC50eXBlKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBwcm94eS5pbnN0YWxsKG5ld01vZGVsKTtcbiAgICAgICAgICAgICAgICBwcm94eS5pc0ZhdWx0ID0gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYWNoZS5pbnNlcnQobmV3TW9kZWwpO1xuICAgICAgICAgICAgY29yZUNoYW5nZXMucmVnaXN0ZXJDaGFuZ2Uoe1xuICAgICAgICAgICAgICAgIGNvbGxlY3Rpb246IHRoaXMuY29sbGVjdGlvbixcbiAgICAgICAgICAgICAgICBtYXBwaW5nOiB0aGlzLnR5cGUsXG4gICAgICAgICAgICAgICAgX2lkOiBuZXdNb2RlbC5faWQsXG4gICAgICAgICAgICAgICAgbmV3SWQ6IG5ld01vZGVsLl9pZCxcbiAgICAgICAgICAgICAgICBuZXc6IG5ld01vZGVsLFxuICAgICAgICAgICAgICAgIHR5cGU6IENoYW5nZVR5cGUuTmV3LFxuICAgICAgICAgICAgICAgIG9iajogbmV3TW9kZWxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIG5ld01vZGVsO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdXRpbC5wcmludFN0YWNrVHJhY2UoKTtcbiAgICAgICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdNYXBwaW5nIG11c3QgYmUgZnVsbHkgaW5zdGFsbGVkIGJlZm9yZSBjcmVhdGluZyBhbnkgbW9kZWxzJyk7XG4gICAgICAgIH1cblxuICAgIH0sXG4gICAgX2R1bXA6IGZ1bmN0aW9uIChhc0pTT04pIHtcbiAgICAgICAgdmFyIGR1bXBlZCA9IHt9O1xuICAgICAgICBkdW1wZWQubmFtZSA9IHRoaXMudHlwZTtcbiAgICAgICAgZHVtcGVkLmF0dHJpYnV0ZXMgPSB0aGlzLmF0dHJpYnV0ZXM7XG4gICAgICAgIGR1bXBlZC5pZCA9IHRoaXMuaWQ7XG4gICAgICAgIGR1bXBlZC5jb2xsZWN0aW9uID0gdGhpcy5jb2xsZWN0aW9uO1xuICAgICAgICBkdW1wZWQucmVsYXRpb25zaGlwcyA9IF8ubWFwKHRoaXMucmVsYXRpb25zaGlwcywgZnVuY3Rpb24gKHIpIHtcbiAgICAgICAgICAgIHJldHVybiByLmlzRm9yd2FyZCA/IHIuZm9yd2FyZE5hbWUgOiByLnJldmVyc2VOYW1lO1xuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIGFzSlNPTiA/IEpTT04uc3RyaW5naWZ5KGR1bXBlZCwgbnVsbCwgNCkgOiBkdW1wZWQ7XG4gICAgfSxcbiAgICB0b1N0cmluZzogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gJ01hcHBpbmdbJyArIHRoaXMudHlwZSArICddJztcbiAgICB9XG59KTtcblxuZXhwb3J0cy5NYXBwaW5nID0gTWFwcGluZztcbiIsIi8qKlxuICogQG1vZHVsZSBtYXBwaW5nXG4gKi9cblxudmFyIFN0b3JlID0gcmVxdWlyZSgnLi9zdG9yZScpXG4gICAgLCBTaWVzdGFNb2RlbCA9IHJlcXVpcmUoJy4vc2llc3RhTW9kZWwnKS5TaWVzdGFNb2RlbFxuICAgICwgbG9nID0gcmVxdWlyZSgnLi9vcGVyYXRpb24vbG9nJylcbiAgICAsIE9wZXJhdGlvbiA9IHJlcXVpcmUoJy4vb3BlcmF0aW9uL29wZXJhdGlvbicpLk9wZXJhdGlvblxuICAgICwgSW50ZXJuYWxTaWVzdGFFcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKS5JbnRlcm5hbFNpZXN0YUVycm9yXG4gICAgLCBRdWVyeSA9IHJlcXVpcmUoJy4vcXVlcnknKS5RdWVyeVxuICAgICwgY2FjaGUgPSByZXF1aXJlKCcuL2NhY2hlJylcbiAgICAsIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKVxuICAgICwgXyA9IHV0aWwuX1xuICAgICwgZGVmaW5lU3ViUHJvcGVydHkgPSB1dGlsLmRlZmluZVN1YlByb3BlcnR5XG4gICAgLCBDaGFuZ2VUeXBlID0gcmVxdWlyZSgnLi9jaGFuZ2VzJykuQ2hhbmdlVHlwZTtcblxudmFyIExvZ2dlciA9IGxvZy5sb2dnZXJXaXRoTmFtZSgnTWFwcGluZ09wZXJhdGlvbicpO1xuTG9nZ2VyLnNldExldmVsKGxvZy5MZXZlbC53YXJuKTtcblxuZnVuY3Rpb24gZmxhdHRlbkFycmF5KGFycikge1xuICAgIHJldHVybiBfLnJlZHVjZShhcnIsIGZ1bmN0aW9uIChtZW1vLCBlKSB7XG4gICAgICAgIGlmICh1dGlsLmlzQXJyYXkoZSkpIHtcbiAgICAgICAgICAgIG1lbW8gPSBtZW1vLmNvbmNhdChlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG1lbW8ucHVzaChlKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbWVtbztcbiAgICB9LCBbXSk7XG59XG5cbmZ1bmN0aW9uIHVuZmxhdHRlbkFycmF5KGFyciwgbW9kZWxBcnIpIHtcbiAgICB2YXIgbiA9IDA7XG4gICAgdmFyIHVuZmxhdHRlbmVkID0gW107XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBtb2RlbEFyci5sZW5ndGg7IGkrKykge1xuICAgICAgICBpZiAodXRpbC5pc0FycmF5KG1vZGVsQXJyW2ldKSkge1xuICAgICAgICAgICAgdmFyIG5ld0FyciA9IFtdO1xuICAgICAgICAgICAgdW5mbGF0dGVuZWRbaV0gPSBuZXdBcnI7XG4gICAgICAgICAgICBmb3IgKHZhciBqID0gMDsgaiA8IG1vZGVsQXJyW2ldLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICAgICAgbmV3QXJyLnB1c2goYXJyW25dKTtcbiAgICAgICAgICAgICAgICBuKys7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB1bmZsYXR0ZW5lZFtpXSA9IGFycltuXTtcbiAgICAgICAgICAgIG4rKztcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdW5mbGF0dGVuZWQ7XG59XG5cbi8qKlxuICogRGVmaW5lcyBhbiBlbmNhcHN1bGF0ZWQgbWFwcGluZyBvcGVyYXRpb24gd2hlcmUgb3B0cyB0YWtlcyBhIG1hcHBpblxuICogQHBhcmFtIHtPYmplY3R9IG9wdHNcbiAqL1xuZnVuY3Rpb24gQnVsa01hcHBpbmdPcGVyYXRpb24ob3B0cykge1xuICAgIE9wZXJhdGlvbi5jYWxsKHRoaXMpO1xuXG4gICAgdGhpcy5fb3B0cyA9IG9wdHM7XG5cbiAgICAvKipcbiAgICAgKiBAbmFtZSBtYXBwaW5nXG4gICAgICogQHR5cGUge01hcHBpbmd9XG4gICAgICovXG4gICAgZGVmaW5lU3ViUHJvcGVydHkuY2FsbCh0aGlzLCAnbWFwcGluZycsIHRoaXMuX29wdHMpO1xuXG4gICAgLyoqXG4gICAgICogQG5hbWUgZGF0YVxuICAgICAqIEB0eXBlIHtBcnJheX1cbiAgICAgKi9cbiAgICBkZWZpbmVTdWJQcm9wZXJ0eS5jYWxsKHRoaXMsICdkYXRhJywgdGhpcy5fb3B0cyk7XG5cbiAgICAvKipcbiAgICAgKiBAbmFtZSBvYmplY3RzXG4gICAgICogQHR5cGUge0FycmF5fVxuICAgICAqL1xuICAgIGRlZmluZVN1YlByb3BlcnR5LmNhbGwodGhpcywgJ29iamVjdHMnLCB0aGlzLl9vcHRzKTtcblxuICAgIGlmICghdGhpcy5vYmplY3RzKSB0aGlzLm9iamVjdHMgPSBbXTtcblxuICAgIC8qKlxuICAgICAqIEFycmF5IG9mIGVycm9ycyB3aGVyZSBpbmRleGVzIG1hcCBvbnRvIHNhbWUgaW5kZXggYXMgdGhlIGRhdHVtIHRoYXQgY2F1c2VkIGFuIGVycm9yLlxuICAgICAqIEB0eXBlIHtBcnJheX1cbiAgICAgKi9cbiAgICB0aGlzLmVycm9ycyA9IFtdO1xuXG4gICAgdGhpcy5uYW1lID0gJ01hcHBpbmcgT3BlcmF0aW9uJztcbiAgICB0aGlzLndvcmsgPSBfLmJpbmQodGhpcy5fc3RhcnQsIHRoaXMpO1xuICAgIHRoaXMuc3ViT3BzID0ge307XG59XG5cbkJ1bGtNYXBwaW5nT3BlcmF0aW9uLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoT3BlcmF0aW9uLnByb3RvdHlwZSk7XG5cbl8uZXh0ZW5kKEJ1bGtNYXBwaW5nT3BlcmF0aW9uLnByb3RvdHlwZSwge1xuICAgIG1hcEF0dHJpYnV0ZXM6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLmRhdGEubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHZhciBkYXR1bSA9IHRoaXMuZGF0YVtpXTtcbiAgICAgICAgICAgIHZhciBvYmplY3QgPSB0aGlzLm9iamVjdHNbaV07XG4gICAgICAgICAgICAvLyBObyBwb2ludCBtYXBwaW5nIG9iamVjdCBvbnRvIGl0c2VsZi4gVGhpcyBoYXBwZW5zIGlmIGEgU2llc3RhTW9kZWwgaXMgcGFzc2VkIGFzIGEgcmVsYXRpb25zaGlwLlxuICAgICAgICAgICAgaWYgKGRhdHVtICE9IG9iamVjdCkge1xuICAgICAgICAgICAgICAgIGlmIChvYmplY3QpIHsgLy8gSWYgb2JqZWN0IGlzIGZhbHN5LCB0aGVuIHRoZXJlIHdhcyBhbiBlcnJvciBsb29raW5nIHVwIHRoYXQgb2JqZWN0L2NyZWF0aW5nIGl0LlxuICAgICAgICAgICAgICAgICAgICB2YXIgZmllbGRzID0gdGhpcy5tYXBwaW5nLl9maWVsZHM7XG4gICAgICAgICAgICAgICAgICAgIF8uZWFjaChmaWVsZHMsIGZ1bmN0aW9uIChmKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZGF0dW1bZl0gIT09IHVuZGVmaW5lZCkgeyAvLyBudWxsIGlzIGZpbmVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBvYmplY3RbZl0gPSBkYXR1bVtmXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSxcbiAgICBfbWFwOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgdmFyIGVycjtcbiAgICAgICAgdmFyIG51bUhpdHMgPSB0aGlzLm1hcEF0dHJpYnV0ZXModGhpcyk7XG4gICAgICAgIHZhciByZWxhdGlvbnNoaXBGaWVsZHMgPSBfLmtleXMoc2VsZi5zdWJPcHMpO1xuICAgICAgICBfLmVhY2gocmVsYXRpb25zaGlwRmllbGRzLCBmdW5jdGlvbiAoZikge1xuICAgICAgICAgICAgdmFyIG9wID0gc2VsZi5zdWJPcHNbZl0ub3A7XG4gICAgICAgICAgICB2YXIgaW5kZXhlcyA9IHNlbGYuc3ViT3BzW2ZdLmluZGV4ZXM7XG4gICAgICAgICAgICB2YXIgcmVsYXRlZERhdGEgPSBzZWxmLmdldFJlbGF0ZWREYXRhKGYpLnJlbGF0ZWREYXRhO1xuICAgICAgICAgICAgdmFyIHVuZmxhdHRlbmVkT2JqZWN0cyA9IHVuZmxhdHRlbkFycmF5KG9wLm9iamVjdHMsIHJlbGF0ZWREYXRhKTtcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdW5mbGF0dGVuZWRPYmplY3RzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgdmFyIGlkeCA9IGluZGV4ZXNbaV07XG4gICAgICAgICAgICAgICAgLy8gRXJyb3JzIGFyZSBwbHVja2VkIGZyb20gdGhlIHN1Ym9wZXJhdGlvbnMuXG4gICAgICAgICAgICAgICAgdmFyIGVycm9yID0gc2VsZi5lcnJvcnNbaWR4XTtcbiAgICAgICAgICAgICAgICBlcnIgPSBlcnJvciA/IGVycm9yW2ZdIDogbnVsbDtcbiAgICAgICAgICAgICAgICBpZiAoIWVycikge1xuICAgICAgICAgICAgICAgICAgICB2YXIgcmVsYXRlZCA9IHVuZmxhdHRlbmVkT2JqZWN0c1tpXTsgLy8gQ2FuIGJlIGFycmF5IG9yIHNjYWxhci5cbiAgICAgICAgICAgICAgICAgICAgdmFyIG9iamVjdCA9IHNlbGYub2JqZWN0c1tpZHhdO1xuICAgICAgICAgICAgICAgICAgICBpZiAob2JqZWN0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBlcnIgPSBvYmplY3QuX19wcm94aWVzW2ZdLnNldChyZWxhdGVkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIXNlbGYuZXJyb3JzW2lkeF0pIHNlbGYuZXJyb3JzW2lkeF0gPSB7fTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZWxmLmVycm9yc1tpZHhdW2ZdID0gZXJyO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIEZvciBpbmRpY2VzIHdoZXJlIG5vIG9iamVjdCBpcyBwcmVzZW50LCBwZXJmb3JtIGxvb2t1cHMsIGNyZWF0aW5nIGEgbmV3IG9iamVjdCBpZiBuZWNlc3NhcnkuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfbG9va3VwOiBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICAgICAgdmFyIGRlZmVycmVkID0gd2luZG93LnEgPyB3aW5kb3cucS5kZWZlcigpIDogbnVsbDtcbiAgICAgICAgY2FsbGJhY2sgPSB1dGlsLmNvbnN0cnVjdENhbGxiYWNrQW5kUHJvbWlzZUhhbmRsZXIoY2FsbGJhY2ssIGRlZmVycmVkKTtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICB2YXIgcmVtb3RlTG9va3VwcyA9IFtdO1xuICAgICAgICB2YXIgbG9jYWxMb29rdXBzID0gW107XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5kYXRhLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAoIXRoaXMub2JqZWN0c1tpXSkge1xuICAgICAgICAgICAgICAgIHZhciBsb29rdXA7XG4gICAgICAgICAgICAgICAgdmFyIGRhdHVtID0gdGhpcy5kYXRhW2ldO1xuICAgICAgICAgICAgICAgIHZhciBpc1NjYWxhciA9IHR5cGVvZiBkYXR1bSA9PSAnc3RyaW5nJyB8fCB0eXBlb2YgZGF0dW0gPT0gJ251bWJlcicgfHwgZGF0dW0gaW5zdGFuY2VvZiBTdHJpbmc7XG4gICAgICAgICAgICAgICAgaWYgKGRhdHVtKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChpc1NjYWxhcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9va3VwID0ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGluZGV4OiBpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdHVtOiB7fVxuICAgICAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvb2t1cC5kYXR1bVtzZWxmLm1hcHBpbmcuaWRdID0gZGF0dW07XG4gICAgICAgICAgICAgICAgICAgICAgICByZW1vdGVMb29rdXBzLnB1c2gobG9va3VwKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChkYXR1bSBpbnN0YW5jZW9mIFNpZXN0YU1vZGVsKSB7IC8vIFdlIHdvbid0IG5lZWQgdG8gcGVyZm9ybSBhbnkgbWFwcGluZy5cbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMub2JqZWN0c1tpXSA9IGRhdHVtO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGRhdHVtLl9pZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9jYWxMb29rdXBzLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGluZGV4OiBpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdHVtOiBkYXR1bVxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoZGF0dW1bc2VsZi5tYXBwaW5nLmlkXSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVtb3RlTG9va3Vwcy5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbmRleDogaSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkYXR1bTogZGF0dW1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gQ3JlYXRlIGEgbmV3IG9iamVjdCBpZiBhbmQgb25seSBpZiB0aGUgZGF0YSBoYXMgYW55IGZpZWxkcyB0aGF0IHdpbGwgYWN0dWFsbHlcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBkYXR1bUZpZWxkcyA9IE9iamVjdC5rZXlzKGRhdHVtKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBvYmplY3RGaWVsZHMgPSBfLnJlZHVjZShPYmplY3Qua2V5cyhzZWxmLm1hcHBpbmcucmVsYXRpb25zaGlwcykuY29uY2F0KHNlbGYubWFwcGluZy5fZmllbGRzKSwgZnVuY3Rpb24gKG0sIHgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtW3hdID0ge307XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG07XG4gICAgICAgICAgICAgICAgICAgICAgICB9LCB7fSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgc2hvdWxkQ3JlYXRlTmV3T2JqZWN0ID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICBmb3IgKHZhciBqID0gMDsgaiA8IGRhdHVtRmllbGRzLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG9iamVjdEZpZWxkc1tkYXR1bUZpZWxkc1tqXV0pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2hvdWxkQ3JlYXRlTmV3T2JqZWN0ID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHNob3VsZENyZWF0ZU5ld09iamVjdCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMub2JqZWN0c1tpXSA9IHNlbGYubWFwcGluZy5fbmV3KCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm9iamVjdHNbaV0gPSBudWxsO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICB1dGlsLnBhcmFsbGVsKFtcbiAgICAgICAgICAgICAgICBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGxvY2FsSWRlbnRpZmllcnMgPSBfLnBsdWNrKF8ucGx1Y2sobG9jYWxMb29rdXBzLCAnZGF0dW0nKSwgJ19pZCcpO1xuICAgICAgICAgICAgICAgICAgICBpZiAobG9jYWxJZGVudGlmaWVycy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIFN0b3JlLmdldE11bHRpcGxlTG9jYWwobG9jYWxJZGVudGlmaWVycywgZnVuY3Rpb24gKGVyciwgb2JqZWN0cykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbG9jYWxJZGVudGlmaWVycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG9iaiA9IG9iamVjdHNbaV07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgX2lkID0gbG9jYWxJZGVudGlmaWVyc1tpXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBsb29rdXAgPSBsb2NhbExvb2t1cHNbaV07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIW9iaikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYuZXJyb3JzW2xvb2t1cC5pbmRleF0gPSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIF9pZDogJ05vIG9iamVjdCB3aXRoIF9pZD1cIicgKyBfaWQudG9TdHJpbmcoKSArICdcIidcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZWxmLm9iamVjdHNbbG9va3VwLmluZGV4XSA9IG9iajtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHJlbW90ZUlkZW50aWZpZXJzID0gXy5wbHVjayhfLnBsdWNrKHJlbW90ZUxvb2t1cHMsICdkYXR1bScpLCBzZWxmLm1hcHBpbmcuaWQpO1xuICAgICAgICAgICAgICAgICAgICBpZiAocmVtb3RlSWRlbnRpZmllcnMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoTG9nZ2VyLnRyYWNlLmlzRW5hYmxlZClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBMb2dnZXIudHJhY2UoJ0xvb2tpbmcgdXAgcmVtb3RlSWRlbnRpZmllcnM6ICcgKyBKU09OLnN0cmluZ2lmeShyZW1vdGVJZGVudGlmaWVycywgbnVsbCwgNCkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgU3RvcmUuZ2V0TXVsdGlwbGVSZW1vdGUocmVtb3RlSWRlbnRpZmllcnMsIHNlbGYubWFwcGluZywgZnVuY3Rpb24gKGVyciwgb2JqZWN0cykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgcmVzdWx0cyA9IHt9O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZm9yIChpID0gMDsgaSA8IG9iamVjdHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXN1bHRzW3JlbW90ZUlkZW50aWZpZXJzW2ldXSA9IG9iamVjdHNbaV0gPyBvYmplY3RzW2ldLl9pZCA6IG51bGw7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBMb2dnZXIudHJhY2UoJ1Jlc3VsdHMgZm9yIHJlbW90ZUlkZW50aWZpZXJzOiAnICsgSlNPTi5zdHJpbmdpZnkocmVzdWx0cywgbnVsbCwgNCkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCBvYmplY3RzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgb2JqID0gb2JqZWN0c1tpXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBsb29rdXAgPSByZW1vdGVMb29rdXBzW2ldO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG9iaikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYub2JqZWN0c1tsb29rdXAuaW5kZXhdID0gb2JqO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgZGF0YSA9IHt9O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciByZW1vdGVJZCA9IHJlbW90ZUlkZW50aWZpZXJzW2ldO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdGFbc2VsZi5tYXBwaW5nLmlkXSA9IHJlbW90ZUlkO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBjYWNoZVF1ZXJ5ID0ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtYXBwaW5nOiBzZWxmLm1hcHBpbmdcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhY2hlUXVlcnlbc2VsZi5tYXBwaW5nLmlkXSA9IHJlbW90ZUlkO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBjYWNoZWQgPSBjYWNoZS5nZXQoY2FjaGVRdWVyeSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGNhY2hlZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZWxmLm9iamVjdHNbbG9va3VwLmluZGV4XSA9IGNhY2hlZDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZWxmLm9iamVjdHNbbG9va3VwLmluZGV4XSA9IHNlbGYubWFwcGluZy5fbmV3KCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIEl0J3MgaW1wb3J0YW50IHRoYXQgd2UgbWFwIHRoZSByZW1vdGUgaWRlbnRpZmllciBoZXJlIHRvIGVuc3VyZSB0aGF0IGl0IGVuZHNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gdXAgaW4gdGhlIGNhY2hlLlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZWxmLm9iamVjdHNbbG9va3VwLmluZGV4XVtzZWxmLm1hcHBpbmcuaWRdID0gcmVtb3RlSWQ7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICBdLFxuICAgICAgICAgICAgY2FsbGJhY2spO1xuICAgICAgICByZXR1cm4gZGVmZXJyZWQgPyBkZWZlcnJlZC5wcm9taXNlIDogbnVsbDtcbiAgICB9LFxuICAgIF9sb29rdXBTaW5nbGV0b246IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgICAgICB2YXIgZGVmZXJyZWQgPSB3aW5kb3cucSA/IHdpbmRvdy5xLmRlZmVyKCkgOiBudWxsO1xuICAgICAgICBjYWxsYmFjayA9IHV0aWwuY29uc3RydWN0Q2FsbGJhY2tBbmRQcm9taXNlSGFuZGxlcihjYWxsYmFjaywgZGVmZXJyZWQpO1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgIHZhciBjYWNoZWRTaW5nbGV0b24gPSBjYWNoZS5nZXQoe1xuICAgICAgICAgICAgbWFwcGluZzogdGhpcy5tYXBwaW5nXG4gICAgICAgIH0pO1xuICAgICAgICBpZiAoIWNhY2hlZFNpbmdsZXRvbikge1xuICAgICAgICAgICAgdmFyIHF1ZXJ5ID0gbmV3IFF1ZXJ5KHRoaXMubWFwcGluZyk7XG4gICAgICAgICAgICBxdWVyeS5leGVjdXRlKGZ1bmN0aW9uIChlcnIsIG9ianMpIHtcbiAgICAgICAgICAgICAgICBpZiAoIWVycikge1xuICAgICAgICAgICAgICAgICAgICB2YXIgb2JqO1xuICAgICAgICAgICAgICAgICAgICBpZiAob2Jqcy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChvYmpzLmxlbmd0aCA9PSAxKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb2JqID0gb2Jqc1swXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG9iaiA9IHNlbGYubWFwcGluZy5fbmV3KCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzZWxmLmRhdGEubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYub2JqZWN0c1tpXSA9IG9iajtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHNlbGYuZGF0YS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIHNlbGYub2JqZWN0c1tpXSA9IGNhY2hlZFNpbmdsZXRvbjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhbGxiYWNrKCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGRlZmVycmVkID8gZGVmZXJyZWQucHJvbWlzZSA6IG51bGw7XG4gICAgfSxcbiAgICBfc3RhcnQ6IGZ1bmN0aW9uIChkb25lKSB7XG4gICAgICAgIGlmICh0aGlzLmRhdGEubGVuZ3RoKSB7XG4gICAgICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgICAgICB2YXIgdGFza3MgPSBbXTtcbiAgICAgICAgICAgIHZhciBsb29rdXBGdW5jID0gdGhpcy5tYXBwaW5nLnNpbmdsZXRvbiA/IHRoaXMuX2xvb2t1cFNpbmdsZXRvbiA6IHRoaXMuX2xvb2t1cDtcbiAgICAgICAgICAgIHRhc2tzLnB1c2goXy5iaW5kKGxvb2t1cEZ1bmMsIHRoaXMpKTtcbiAgICAgICAgICAgIHRhc2tzLnB1c2goXy5iaW5kKHRoaXMuX2V4ZWN1dGVTdWJPcGVyYXRpb25zLCB0aGlzKSk7XG4gICAgICAgICAgICB1dGlsLnBhcmFsbGVsKHRhc2tzLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgc2VsZi5fbWFwKCk7XG4gICAgICAgICAgICAgICAgZG9uZShzZWxmLmVycm9ycy5sZW5ndGggPyBzZWxmLmVycm9ycyA6IG51bGwsIHNlbGYub2JqZWN0cyk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGRvbmUobnVsbCwgW10pO1xuICAgICAgICB9XG4gICAgfSxcbiAgICBnZXRSZWxhdGVkRGF0YTogZnVuY3Rpb24gKG5hbWUpIHtcbiAgICAgICAgdmFyIGluZGV4ZXMgPSBbXTtcbiAgICAgICAgdmFyIHJlbGF0ZWREYXRhID0gW107XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5kYXRhLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB2YXIgZGF0dW0gPSB0aGlzLmRhdGFbaV07XG4gICAgICAgICAgICBpZiAoZGF0dW0pIHtcbiAgICAgICAgICAgICAgICBpZiAoZGF0dW1bbmFtZV0pIHtcbiAgICAgICAgICAgICAgICAgICAgaW5kZXhlcy5wdXNoKGkpO1xuICAgICAgICAgICAgICAgICAgICByZWxhdGVkRGF0YS5wdXNoKGRhdHVtW25hbWVdKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGluZGV4ZXM6IGluZGV4ZXMsXG4gICAgICAgICAgICByZWxhdGVkRGF0YTogcmVsYXRlZERhdGFcbiAgICAgICAgfTtcbiAgICB9LFxuICAgIF9jb25zdHJ1Y3RTdWJPcGVyYXRpb25zOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBzdWJPcHMgPSB0aGlzLnN1Yk9wcztcbiAgICAgICAgdmFyIHJlbGF0aW9uc2hpcHMgPSB0aGlzLm1hcHBpbmcucmVsYXRpb25zaGlwcztcbiAgICAgICAgZm9yICh2YXIgbmFtZSBpbiByZWxhdGlvbnNoaXBzKSB7XG4gICAgICAgICAgICBpZiAocmVsYXRpb25zaGlwcy5oYXNPd25Qcm9wZXJ0eShuYW1lKSkge1xuICAgICAgICAgICAgICAgIHZhciByZWxhdGlvbnNoaXAgPSByZWxhdGlvbnNoaXBzW25hbWVdO1xuICAgICAgICAgICAgICAgIHZhciByZXZlcnNlTWFwcGluZyA9IHJlbGF0aW9uc2hpcC5mb3J3YXJkTmFtZSA9PSBuYW1lID8gcmVsYXRpb25zaGlwLnJldmVyc2VNYXBwaW5nIDogcmVsYXRpb25zaGlwLmZvcndhcmRNYXBwaW5nO1xuICAgICAgICAgICAgICAgIHZhciBfX3JldCA9IHRoaXMuZ2V0UmVsYXRlZERhdGEobmFtZSk7XG4gICAgICAgICAgICAgICAgdmFyIGluZGV4ZXMgPSBfX3JldC5pbmRleGVzO1xuICAgICAgICAgICAgICAgIHZhciByZWxhdGVkRGF0YSA9IF9fcmV0LnJlbGF0ZWREYXRhO1xuICAgICAgICAgICAgICAgIGlmIChyZWxhdGVkRGF0YS5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGZsYXRSZWxhdGVkRGF0YSA9IGZsYXR0ZW5BcnJheShyZWxhdGVkRGF0YSk7XG4gICAgICAgICAgICAgICAgICAgIHZhciBvcCA9IG5ldyBCdWxrTWFwcGluZ09wZXJhdGlvbih7XG4gICAgICAgICAgICAgICAgICAgICAgICBtYXBwaW5nOiByZXZlcnNlTWFwcGluZyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRhdGE6IGZsYXRSZWxhdGVkRGF0YVxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgb3AuX19yZWxhdGlvbnNoaXBOYW1lID0gbmFtZTtcbiAgICAgICAgICAgICAgICAgICAgc3ViT3BzW25hbWVdID0ge1xuICAgICAgICAgICAgICAgICAgICAgICAgb3A6IG9wLFxuICAgICAgICAgICAgICAgICAgICAgICAgaW5kZXhlczogaW5kZXhlc1xuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0sXG4gICAgZ2F0aGVyRXJyb3JzRnJvbVN1Yk9wZXJhdGlvbnM6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICB2YXIgcmVsYXRpb25zaGlwTmFtZXMgPSBfLmtleXModGhpcy5zdWJPcHMpO1xuICAgICAgICBfLmVhY2gocmVsYXRpb25zaGlwTmFtZXMsIGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgICAgICAgICB2YXIgb3AgPSBzZWxmLnN1Yk9wc1tuYW1lXS5vcDtcbiAgICAgICAgICAgIHZhciBpbmRleGVzID0gc2VsZi5zdWJPcHNbbmFtZV0uaW5kZXhlcztcbiAgICAgICAgICAgIHZhciBlcnJvcnMgPSBvcC5lcnJvcnM7XG4gICAgICAgICAgICBpZiAoZXJyb3JzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIHZhciByZWxhdGVkRGF0YSA9IHNlbGYuZ2V0UmVsYXRlZERhdGEobmFtZSkucmVsYXRlZERhdGE7XG4gICAgICAgICAgICAgICAgdmFyIHVuZmxhdHRlbmVkRXJyb3JzID0gdW5mbGF0dGVuQXJyYXkoZXJyb3JzLCByZWxhdGVkRGF0YSk7XG4gICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB1bmZsYXR0ZW5lZEVycm9ycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICB2YXIgaWR4ID0gaW5kZXhlc1tpXTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGVyciA9IHVuZmxhdHRlbmVkRXJyb3JzW2ldO1xuICAgICAgICAgICAgICAgICAgICB2YXIgaXNFcnJvciA9IGVycjtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHV0aWwuaXNBcnJheShlcnIpKSBpc0Vycm9yID0gXy5yZWR1Y2UoZXJyLCBmdW5jdGlvbiAobWVtbywgeCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG1lbW8gfHwgeFxuICAgICAgICAgICAgICAgICAgICB9LCBmYWxzZSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChpc0Vycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIXNlbGYuZXJyb3JzW2lkeF0pIHNlbGYuZXJyb3JzW2lkeF0gPSB7fTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYuZXJyb3JzW2lkeF1bbmFtZV0gPSBlcnI7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH0sXG4gICAgX2V4ZWN1dGVTdWJPcGVyYXRpb25zOiBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICB0aGlzLl9jb25zdHJ1Y3RTdWJPcGVyYXRpb25zKCk7XG4gICAgICAgIHZhciByZWxhdGlvbnNoaXBOYW1lcyA9IF8ua2V5cyh0aGlzLnN1Yk9wcyk7XG4gICAgICAgIGlmIChyZWxhdGlvbnNoaXBOYW1lcy5sZW5ndGgpIHtcbiAgICAgICAgICAgIHZhciBzdWJPcGVyYXRpb25zID0gXy5tYXAocmVsYXRpb25zaGlwTmFtZXMsIGZ1bmN0aW9uIChrKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHNlbGYuc3ViT3BzW2tdLm9wXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHZhciBjb21wb3NpdGVPcGVyYXRpb24gPSBuZXcgT3BlcmF0aW9uKHN1Yk9wZXJhdGlvbnMpO1xuICAgICAgICAgICAgY29tcG9zaXRlT3BlcmF0aW9uLm9uQ29tcGxldGlvbihmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgc2VsZi5nYXRoZXJFcnJvcnNGcm9tU3ViT3BlcmF0aW9ucyhyZWxhdGlvbnNoaXBOYW1lcyk7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgY29tcG9zaXRlT3BlcmF0aW9uLnN0YXJ0KCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgICB9XG4gICAgfVxufSk7XG5cblxuZXhwb3J0cy5CdWxrTWFwcGluZ09wZXJhdGlvbiA9IEJ1bGtNYXBwaW5nT3BlcmF0aW9uO1xuZXhwb3J0cy5mbGF0dGVuQXJyYXkgPSBmbGF0dGVuQXJyYXk7XG5leHBvcnRzLnVuZmxhdHRlbkFycmF5ID0gdW5mbGF0dGVuQXJyYXk7IiwidmFyIEV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJ2V2ZW50cycpLkV2ZW50RW1pdHRlcjtcbnZhciBub3RpZmljYXRpb25DZW50cmUgPSBuZXcgRXZlbnRFbWl0dGVyKCk7XG5ub3RpZmljYXRpb25DZW50cmUuc2V0TWF4TGlzdGVuZXJzKDEwMCk7XG52YXIgQXJyYXlPYnNlcnZlciA9IHJlcXVpcmUoJy4uL3ZlbmRvci9vYnNlcnZlLWpzL3NyYy9vYnNlcnZlJykuQXJyYXlPYnNlcnZlcjtcbnZhciBjb3JlQ2hhbmdlcyA9IHJlcXVpcmUoJy4vY2hhbmdlcycpO1xudmFyIENoYW5nZVR5cGUgPSBjb3JlQ2hhbmdlcy5DaGFuZ2VUeXBlO1xudmFyIGxvZyA9IHJlcXVpcmUoJy4vb3BlcmF0aW9uL2xvZycpO1xuXG4vKipcbiogV3JhcHMgdGhlIG1ldGhvZHMgb2YgYSBqYXZhc2NyaXB0IGFycmF5IG9iamVjdCBzbyB0aGF0IG5vdGlmaWNhdGlvbnMgYXJlIHNlbnRcbiogb24gY2FsbHMuXG4qXG4qIEBwYXJhbSBhcnJheSB0aGUgYXJyYXkgd2UgaGF2ZSB3cmFwcGluZ1xuKiBAcGFyYW0gZmllbGQgbmFtZSBvZiB0aGUgZmllbGRcbiogQHBhcmFtIHJlc3RPYmplY3QgdGhlIG9iamVjdCB0byB3aGljaCB0aGlzIGFycmF5IGlzIGEgcHJvcGVydHlcbiovXG5mdW5jdGlvbiB3cmFwQXJyYXkoYXJyYXksIGZpZWxkLCBzaWVzdGFNb2RlbCkge1xuICAgIGlmICghYXJyYXkub2JzZXJ2ZXIpIHtcbiAgICAgICAgYXJyYXkub2JzZXJ2ZXIgPSBuZXcgQXJyYXlPYnNlcnZlcihhcnJheSk7XG4gICAgICAgIGFycmF5Lm9ic2VydmVyLm9wZW4oZnVuY3Rpb24gKHNwbGljZXMpIHtcbiAgICAgICAgICAgIHZhciBmaWVsZElzQXR0cmlidXRlID0gc2llc3RhTW9kZWwuX2ZpZWxkcy5pbmRleE9mKGZpZWxkKSA+IC0xO1xuICAgICAgICAgICAgaWYgKGZpZWxkSXNBdHRyaWJ1dGUpIHtcbiAgICAgICAgICAgICAgICBzcGxpY2VzLmZvckVhY2goZnVuY3Rpb24gKHNwbGljZSkge1xuICAgICAgICAgICAgICAgICAgICBjb3JlQ2hhbmdlcy5yZWdpc3RlckNoYW5nZSh7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb2xsZWN0aW9uOiBzaWVzdGFNb2RlbC5jb2xsZWN0aW9uLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWFwcGluZzogc2llc3RhTW9kZWwubWFwcGluZy50eXBlLFxuICAgICAgICAgICAgICAgICAgICAgICAgX2lkOiBzaWVzdGFNb2RlbC5faWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBpbmRleDogc3BsaWNlLmluZGV4LFxuICAgICAgICAgICAgICAgICAgICAgICAgcmVtb3ZlZDogc3BsaWNlLnJlbW92ZWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBhZGRlZDogc3BsaWNlLmFkZGVkQ291bnQgPyBhcnJheS5zbGljZShzcGxpY2UuaW5kZXgsIHNwbGljZS5pbmRleCtzcGxpY2UuYWRkZWRDb3VudCkgOiBbXSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6IGNvcmVDaGFuZ2VzLkNoYW5nZVR5cGUuU3BsaWNlLFxuICAgICAgICAgICAgICAgICAgICAgICAgZmllbGQ6IGZpZWxkLFxuICAgICAgICAgICAgICAgICAgICAgICAgb2JqOiBzaWVzdGFNb2RlbFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIGFycmF5LmlzRmF1bHQgPSBmYWxzZTtcbiAgICB9XG59XG5cbmV4cG9ydHMubm90aWZpY2F0aW9uQ2VudHJlID0gbm90aWZpY2F0aW9uQ2VudHJlO1xuZXhwb3J0cy53cmFwQXJyYXkgPSB3cmFwQXJyYXk7IiwiLyoqXG4gKiBAbW9kdWxlIHJlbGF0aW9uc2hpcHNcbiAqL1xuXG52YXIgcHJveHkgPSByZXF1aXJlKCcuL3Byb3h5JylcbiAgICAsIFJlbGF0aW9uc2hpcFByb3h5ID0gcHJveHkuUmVsYXRpb25zaGlwUHJveHlcbiAgICAsIFN0b3JlID0gcmVxdWlyZSgnLi9zdG9yZScpXG4gICAgLCB1dGlsID0gcmVxdWlyZSgnLi91dGlsJylcbiAgICAsIF8gPSB1dGlsLl9cbiAgICAsIEludGVybmFsU2llc3RhRXJyb3IgPSByZXF1aXJlKCcuL2Vycm9yJykuSW50ZXJuYWxTaWVzdGFFcnJvclxuICAgICwgY29yZUNoYW5nZXMgPSByZXF1aXJlKCcuL2NoYW5nZXMnKVxuICAgICwgU2llc3RhTW9kZWwgPSByZXF1aXJlKCcuL3NpZXN0YU1vZGVsJykuU2llc3RhTW9kZWxcbiAgICAsIG5vdGlmaWNhdGlvbkNlbnRyZSA9IHJlcXVpcmUoJy4vbm90aWZpY2F0aW9uQ2VudHJlJylcbiAgICAsIHdyYXBBcnJheUZvckF0dHJpYnV0ZXMgPSBub3RpZmljYXRpb25DZW50cmUud3JhcEFycmF5XG4gICAgLCBBcnJheU9ic2VydmVyID0gcmVxdWlyZSgnLi4vdmVuZG9yL29ic2VydmUtanMvc3JjL29ic2VydmUnKS5BcnJheU9ic2VydmVyXG4gICAgLCBDaGFuZ2VUeXBlID0gcmVxdWlyZSgnLi9jaGFuZ2VzJykuQ2hhbmdlVHlwZVxuICAgIDtcblxuLyoqXG4gKiBAY2xhc3MgIFtPbmVUb01hbnlQcm94eSBkZXNjcmlwdGlvbl1cbiAqIEBjb25zdHJ1Y3RvclxuICogQHBhcmFtIHtbdHlwZV19IG9wdHNcbiAqL1xuZnVuY3Rpb24gT25lVG9NYW55UHJveHkob3B0cykge1xuICAgIFJlbGF0aW9uc2hpcFByb3h5LmNhbGwodGhpcywgb3B0cyk7XG5cbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsICdpc0ZhdWx0Jywge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGlmIChzZWxmLmlzRm9yd2FyZCkge1xuICAgICAgICAgICAgICAgIGlmIChzZWxmLl9pZCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gIXNlbGYucmVsYXRlZDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSBpZiAoc2VsZi5faWQgPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmIChzZWxmLl9pZCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoc2VsZi5yZWxhdGVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoc2VsZi5faWQubGVuZ3RoICE9IHNlbGYucmVsYXRlZC5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZWxmLnZhbGlkYXRlUmVsYXRlZCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgc2V0OiBmdW5jdGlvbiAodikge1xuICAgICAgICAgICAgaWYgKHYpIHtcbiAgICAgICAgICAgICAgICBzZWxmLl9pZCA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgICAgICBzZWxmLnJlbGF0ZWQgPSBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgaWYgKCFzZWxmLl9pZCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoc2VsZi5pc0ZvcndhcmQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYuX2lkID0gbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYuX2lkID0gW107XG4gICAgICAgICAgICAgICAgICAgICAgICBzZWxmLnJlbGF0ZWQgPSBbXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMud3JhcEFycmF5KHNlbGYucmVsYXRlZCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICB0aGlzLl9yZXZlcnNlSXNBcnJheSA9IHRydWU7XG4gICAgdGhpcy5fZm9yd2FyZElzQXJyYXkgPSBmYWxzZTtcbn1cblxuT25lVG9NYW55UHJveHkucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShSZWxhdGlvbnNoaXBQcm94eS5wcm90b3R5cGUpO1xuXG5fLmV4dGVuZChPbmVUb01hbnlQcm94eS5wcm90b3R5cGUsIHtcbiAgICBjbGVhclJldmVyc2U6IGZ1bmN0aW9uIChyZW1vdmVkKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgXy5lYWNoKHJlbW92ZWQsIGZ1bmN0aW9uIChyZW1vdmVkT2JqZWN0KSB7XG4gICAgICAgICAgICB2YXIgcmV2ZXJzZVByb3h5ID0gcHJveHkuZ2V0UmV2ZXJzZVByb3h5Rm9yT2JqZWN0LmNhbGwoc2VsZiwgcmVtb3ZlZE9iamVjdCk7XG4gICAgICAgICAgICBwcm94eS5zZXQuY2FsbChyZXZlcnNlUHJveHksIG51bGwpO1xuICAgICAgICB9KTtcbiAgICB9LFxuICAgIHNldFJldmVyc2U6IGZ1bmN0aW9uIChhZGRlZCkge1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgIF8uZWFjaChhZGRlZCwgZnVuY3Rpb24gKGFkZGVkKSB7XG4gICAgICAgICAgICB2YXIgZm9yd2FyZFByb3h5ID0gcHJveHkuZ2V0UmV2ZXJzZVByb3h5Rm9yT2JqZWN0LmNhbGwoc2VsZiwgYWRkZWQpO1xuICAgICAgICAgICAgcHJveHkuc2V0LmNhbGwoZm9yd2FyZFByb3h5LCBzZWxmLm9iamVjdCk7XG4gICAgICAgIH0pO1xuICAgIH0sXG4gICAgd3JhcEFycmF5OiBmdW5jdGlvbiAoYXJyKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgd3JhcEFycmF5Rm9yQXR0cmlidXRlcyhhcnIsIHRoaXMucmV2ZXJzZU5hbWUsIHRoaXMub2JqZWN0KTtcbiAgICAgICAgaWYgKCFhcnIub25lVG9NYW55T2JzZXJ2ZXIpIHtcbiAgICAgICAgICAgIGFyci5vbmVUb01hbnlPYnNlcnZlciA9IG5ldyBBcnJheU9ic2VydmVyKGFycik7XG4gICAgICAgICAgICB2YXIgb2JzZXJ2ZXJGdW5jdGlvbiA9IGZ1bmN0aW9uIChzcGxpY2VzKSB7XG4gICAgICAgICAgICAgICAgc3BsaWNlcy5mb3JFYWNoKGZ1bmN0aW9uIChzcGxpY2UpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGFkZGVkID0gc3BsaWNlLmFkZGVkQ291bnQgPyBhcnIuc2xpY2Uoc3BsaWNlLmluZGV4LCBzcGxpY2UuaW5kZXggKyBzcGxpY2UuYWRkZWRDb3VudCkgOiBbXTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHJlbW92ZWQgPSBzcGxpY2UucmVtb3ZlZDtcbiAgICAgICAgICAgICAgICAgICAgc2VsZi5jbGVhclJldmVyc2UocmVtb3ZlZCk7XG4gICAgICAgICAgICAgICAgICAgIHNlbGYuc2V0UmV2ZXJzZShhZGRlZCk7XG4gICAgICAgICAgICAgICAgICAgIHZhciBtYXBwaW5nID0gcHJveHkuZ2V0Rm9yd2FyZE1hcHBpbmcuY2FsbChzZWxmKTtcbiAgICAgICAgICAgICAgICAgICAgY29yZUNoYW5nZXMucmVnaXN0ZXJDaGFuZ2Uoe1xuICAgICAgICAgICAgICAgICAgICAgICAgY29sbGVjdGlvbjogbWFwcGluZy5jb2xsZWN0aW9uLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWFwcGluZzogbWFwcGluZy50eXBlLFxuICAgICAgICAgICAgICAgICAgICAgICAgX2lkOiBzZWxmLm9iamVjdC5faWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBmaWVsZDogcHJveHkuZ2V0Rm9yd2FyZE5hbWUuY2FsbChzZWxmKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlbW92ZWQ6IHJlbW92ZWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBhZGRlZDogYWRkZWQsXG4gICAgICAgICAgICAgICAgICAgICAgICByZW1vdmVkSWQ6IF8ucGx1Y2socmVtb3ZlZCwgJ19pZCcpLFxuICAgICAgICAgICAgICAgICAgICAgICAgYWRkZWRJZDogXy5wbHVjayhhZGRlZCwgJ19pZCcpLFxuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogQ2hhbmdlVHlwZS5TcGxpY2UsXG4gICAgICAgICAgICAgICAgICAgICAgICBpbmRleDogc3BsaWNlLmluZGV4LFxuICAgICAgICAgICAgICAgICAgICAgICAgb2JqOiBzZWxmLm9iamVjdFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBhcnIub25lVG9NYW55T2JzZXJ2ZXIub3BlbihvYnNlcnZlckZ1bmN0aW9uKTtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgZ2V0OiBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICAgICAgdmFyIGRlZmVycmVkID0gd2luZG93LnEgPyB3aW5kb3cucS5kZWZlcigpIDogbnVsbDtcbiAgICAgICAgY2FsbGJhY2sgPSB1dGlsLmNvbnN0cnVjdENhbGxiYWNrQW5kUHJvbWlzZUhhbmRsZXIoY2FsbGJhY2ssIGRlZmVycmVkKTtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICBpZiAodGhpcy5pc0ZhdWx0KSB7XG4gICAgICAgICAgICBpZiAodGhpcy5faWQubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgdmFyIHN0b3JlT3B0cyA9IHtfaWQ6IHRoaXMuX2lkfTtcbiAgICAgICAgICAgICAgICBTdG9yZS5nZXQoc3RvcmVPcHRzLCBmdW5jdGlvbiAoZXJyLCBzdG9yZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2VsZi5yZWxhdGVkID0gc3RvcmVkO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhudWxsLCBzdG9yZWQpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChjYWxsYmFjaykge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIHRoaXMucmVsYXRlZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKG51bGwsIHRoaXMucmVsYXRlZCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGRlZmVycmVkID8gZGVmZXJyZWQucHJvbWlzZSA6IG51bGw7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBWYWxpZGF0ZSB0aGUgb2JqZWN0IHRoYXQgd2UncmUgc2V0dGluZ1xuICAgICAqIEBwYXJhbSBvYmpcbiAgICAgKiBAcmV0dXJucyB7c3RyaW5nfG51bGx9IEFuIGVycm9yIG1lc3NhZ2Ugb3IgbnVsbFxuICAgICAqIEBjbGFzcyBPbmVUb01hbnlQcm94eVxuICAgICAqL1xuICAgIHZhbGlkYXRlOiBmdW5jdGlvbiAob2JqKSB7XG4gICAgICAgIHZhciBzdHIgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwob2JqKTtcbiAgICAgICAgaWYgKHRoaXMuaXNGb3J3YXJkKSB7XG4gICAgICAgICAgICBpZiAoc3RyID09ICdbb2JqZWN0IEFycmF5XScpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gJ0Nhbm5vdCBhc3NpZ24gYXJyYXkgZm9yd2FyZCBvbmVUb01hbnkgKCcgKyBzdHIgKyAnKTogJyArIHRoaXMuZm9yd2FyZE5hbWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBpZiAoc3RyICE9ICdbb2JqZWN0IEFycmF5XScpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gJ0Nhbm5vdCBzY2FsYXIgdG8gcmV2ZXJzZSBvbmVUb01hbnkgKCcgKyBzdHIgKyAnKTogJyArIHRoaXMucmV2ZXJzZU5hbWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSxcbiAgICB2YWxpZGF0ZVJlbGF0ZWQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICBpZiAoc2VsZi5faWQpIHtcbiAgICAgICAgICAgIGlmIChzZWxmLnJlbGF0ZWQpIHtcbiAgICAgICAgICAgICAgICBpZiAoc2VsZi5faWQubGVuZ3RoICE9IHNlbGYucmVsYXRlZC5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHNlbGYucmVsYXRlZC5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignX2lkIGFuZCByZWxhdGVkIGFyZSBzb21laG93IG91dCBvZiBzeW5jJyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24gKG9iaikge1xuICAgICAgICBwcm94eS5jaGVja0luc3RhbGxlZC5jYWxsKHRoaXMpO1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgIGlmIChvYmopIHtcbiAgICAgICAgICAgIHZhciBlcnJvck1lc3NhZ2U7XG4gICAgICAgICAgICBpZiAoZXJyb3JNZXNzYWdlID0gdGhpcy52YWxpZGF0ZShvYmopKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGVycm9yTWVzc2FnZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHByb3h5LmNsZWFyUmV2ZXJzZVJlbGF0ZWQuY2FsbCh0aGlzKTtcbiAgICAgICAgICAgICAgICBwcm94eS5zZXQuY2FsbChzZWxmLCBvYmopO1xuICAgICAgICAgICAgICAgIGlmIChzZWxmLmlzUmV2ZXJzZSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLndyYXBBcnJheShzZWxmLnJlbGF0ZWQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBwcm94eS5zZXRSZXZlcnNlLmNhbGwoc2VsZiwgb2JqKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHByb3h5LmNsZWFyUmV2ZXJzZVJlbGF0ZWQuY2FsbCh0aGlzKTtcbiAgICAgICAgICAgIHByb3h5LnNldC5jYWxsKHNlbGYsIG9iaik7XG4gICAgICAgIH1cbiAgICB9LFxuICAgIGluc3RhbGw6IGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgUmVsYXRpb25zaGlwUHJveHkucHJvdG90eXBlLmluc3RhbGwuY2FsbCh0aGlzLCBvYmopO1xuICAgICAgICBpZiAodGhpcy5pc1JldmVyc2UpIHtcbiAgICAgICAgICAgIG9ialsoJ3NwbGljZScgKyB1dGlsLmNhcGl0YWxpc2VGaXJzdExldHRlcih0aGlzLnJldmVyc2VOYW1lKSldID0gXy5iaW5kKHByb3h5LnNwbGljZSwgdGhpcyk7XG4gICAgICAgIH1cbiAgICB9XG59KTtcblxuXG5tb2R1bGUuZXhwb3J0cyA9IE9uZVRvTWFueVByb3h5OyIsIi8qKlxuICogQG1vZHVsZSByZWxhdGlvbnNoaXBzXG4gKi9cblxudmFyIHByb3h5ID0gcmVxdWlyZSgnLi9wcm94eScpXG4gICAgLCBSZWxhdGlvbnNoaXBQcm94eSA9IHByb3h5LlJlbGF0aW9uc2hpcFByb3h5XG4gICAgLCBTdG9yZSA9IHJlcXVpcmUoJy4vc3RvcmUnKVxuICAgICwgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpXG4gICAgLCBJbnRlcm5hbFNpZXN0YUVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpLkludGVybmFsU2llc3RhRXJyb3JcbiAgICAsIFNpZXN0YU1vZGVsID0gcmVxdWlyZSgnLi9zaWVzdGFNb2RlbCcpLlNpZXN0YU1vZGVsO1xuXG4vKipcbiAqIFtPbmVUb09uZVByb3h5IGRlc2NyaXB0aW9uXVxuICogQHBhcmFtIHtPYmplY3R9IG9wdHNcbiAqL1xuZnVuY3Rpb24gT25lVG9PbmVQcm94eShvcHRzKSB7XG4gICAgUmVsYXRpb25zaGlwUHJveHkuY2FsbCh0aGlzLCBvcHRzKTtcbiAgICB0aGlzLl9yZXZlcnNlSXNBcnJheSA9IGZhbHNlO1xuICAgIHRoaXMuX2ZvcndhcmRJc0FycmF5ID0gZmFsc2U7XG59XG5cblxuT25lVG9PbmVQcm94eS5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKFJlbGF0aW9uc2hpcFByb3h5LnByb3RvdHlwZSk7XG5cbl8uZXh0ZW5kKE9uZVRvT25lUHJveHkucHJvdG90eXBlLCB7XG4gICAgLyoqXG4gICAgICogVmFsaWRhdGUgdGhlIG9iamVjdCB0aGF0IHdlJ3JlIHNldHRpbmdcbiAgICAgKiBAcGFyYW0gb2JqXG4gICAgICogQHJldHVybnMge3N0cmluZ3xudWxsfSBBbiBlcnJvciBtZXNzYWdlIG9yIG51bGxcbiAgICAgKi9cbiAgICB2YWxpZGF0ZTogZnVuY3Rpb24gKG9iaikge1xuICAgICAgICBpZiAoT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKG9iaikgPT0gJ1tvYmplY3QgQXJyYXldJykge1xuICAgICAgICAgICAgcmV0dXJuICdDYW5ub3QgYXNzaWduIGFycmF5IHRvIG9uZSB0byBvbmUgcmVsYXRpb25zaGlwJztcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmICgoIW9iaiBpbnN0YW5jZW9mIFNpZXN0YU1vZGVsKSkge1xuXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgcHJveHkuY2hlY2tJbnN0YWxsZWQuY2FsbCh0aGlzKTtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICBpZiAob2JqKSB7XG4gICAgICAgICAgICB2YXIgZXJyb3JNZXNzYWdlO1xuICAgICAgICAgICAgaWYgKGVycm9yTWVzc2FnZSA9IHNlbGYudmFsaWRhdGUob2JqKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBlcnJvck1lc3NhZ2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBwcm94eS5jbGVhclJldmVyc2VSZWxhdGVkLmNhbGwodGhpcyk7XG4gICAgICAgICAgICAgICAgcHJveHkuc2V0LmNhbGwoc2VsZiwgb2JqKTtcbiAgICAgICAgICAgICAgICBwcm94eS5zZXRSZXZlcnNlLmNhbGwoc2VsZiwgb2JqKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHByb3h5LmNsZWFyUmV2ZXJzZVJlbGF0ZWQuY2FsbCh0aGlzKTtcbiAgICAgICAgICAgIHByb3h5LnNldC5jYWxsKHNlbGYsIG9iaik7XG4gICAgICAgIH1cbiAgICB9LFxuICAgIGdldDogZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgICAgIHZhciBkZWZlcnJlZCA9IHdpbmRvdy5xID8gd2luZG93LnEuZGVmZXIoKSA6IG51bGw7XG4gICAgICAgIGNhbGxiYWNrID0gdXRpbC5jb25zdHJ1Y3RDYWxsYmFja0FuZFByb21pc2VIYW5kbGVyKGNhbGxiYWNrLCBkZWZlcnJlZCk7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgaWYgKHRoaXMuX2lkKSB7XG4gICAgICAgICAgICBTdG9yZS5nZXQoe19pZDogdGhpcy5faWR9LCBmdW5jdGlvbiAoZXJyLCBzdG9yZWQpIHtcbiAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHNlbGYucmVsYXRlZCA9IHN0b3JlZDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhudWxsLCBzdG9yZWQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGRlZmVycmVkID8gZGVmZXJyZWQucHJvbWlzZSA6IG51bGw7XG4gICAgfVxufSk7XG5cblxubW9kdWxlLmV4cG9ydHMgPSBPbmVUb09uZVByb3h5OyIsInZhciBfID0gcmVxdWlyZSgnLi4vdXRpbCcpLl87XG5cbmZ1bmN0aW9uIExvZ2dlciAobmFtZSkge1xuICAgIGlmICghdGhpcykgcmV0dXJuIG5ldyBMb2dnZXIobmFtZSk7XG4gICAgdGhpcy5uYW1lID0gbmFtZTtcblxuICAgIHRoaXMudHJhY2UgPSBjb25zdHJ1Y3RQZXJmb3JtZXIodGhpcywgXy5iaW5kKGNvbnNvbGUuZGVidWcgPyBjb25zb2xlLmRlYnVnIDogY29uc29sZS5sb2csIGNvbnNvbGUpLCBMb2dnZXIuTGV2ZWwudHJhY2UpO1xuICAgIHRoaXMuZGVidWcgPSBjb25zdHJ1Y3RQZXJmb3JtZXIodGhpcywgXy5iaW5kKGNvbnNvbGUuZGVidWcgPyBjb25zb2xlLmRlYnVnICA6IGNvbnNvbGUubG9nLCBjb25zb2xlKSwgTG9nZ2VyLkxldmVsLmRlYnVnKTtcbiAgICB0aGlzLmluZm8gPSBjb25zdHJ1Y3RQZXJmb3JtZXIodGhpcywgXy5iaW5kKGNvbnNvbGUuaW5mbyA/IGNvbnNvbGUuaW5mbyA6IGNvbnNvbGUubG9nLCBjb25zb2xlKSwgTG9nZ2VyLkxldmVsLmluZm8pO1xuICAgIHRoaXMubG9nID0gY29uc3RydWN0UGVyZm9ybWVyKHRoaXMsIF8uYmluZChjb25zb2xlLmxvZyA/IGNvbnNvbGUubG9nIDogY29uc29sZS5sb2csIGNvbnNvbGUpLCBMb2dnZXIuTGV2ZWwuaW5mbyk7XG4gICAgdGhpcy53YXJuID0gY29uc3RydWN0UGVyZm9ybWVyKHRoaXMsIF8uYmluZChjb25zb2xlLndhcm4gPyBjb25zb2xlLndhcm4gOiBjb25zb2xlLmxvZywgY29uc29sZSksIExvZ2dlci5MZXZlbC53YXJuaW5nKTtcbiAgICB0aGlzLmVycm9yID0gY29uc3RydWN0UGVyZm9ybWVyKHRoaXMsIF8uYmluZChjb25zb2xlLmVycm9yID8gY29uc29sZS5lcnJvciA6IGNvbnNvbGUubG9nLCBjb25zb2xlKSwgTG9nZ2VyLkxldmVsLmVycm9yKTtcbiAgICB0aGlzLmZhdGFsID0gY29uc3RydWN0UGVyZm9ybWVyKHRoaXMsIF8uYmluZChjb25zb2xlLmVycm9yID8gY29uc29sZS5lcnJvciA6IGNvbnNvbGUubG9nLCBjb25zb2xlKSwgTG9nZ2VyLkxldmVsLmZhdGFsKTtcblxufVxuXG52YXIgbG9nTGV2ZWxzID0ge307XG5cbmZ1bmN0aW9uIGNvbnN0cnVjdFBlcmZvcm1lciAobG9nZ2VyLCBmLCBsZXZlbCkge1xuICAgIHZhciBwZXJmb3JtZXIgPSBmdW5jdGlvbiAobWVzc2FnZSkge1xuICAgICAgICBsb2dnZXIucGVyZm9ybUxvZyhmLCBsZXZlbCwgbWVzc2FnZSwgYXJndW1lbnRzKTtcbiAgICB9O1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShwZXJmb3JtZXIsICdpc0VuYWJsZWQnLCB7XG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdmFyIGN1cnJlbnRMZXZlbCA9IGxvZ2dlci5jdXJyZW50TGV2ZWwoKTtcbiAgICAgICAgICAgIHJldHVybiBsZXZlbCA+PSBjdXJyZW50TGV2ZWw7XG4gICAgICAgIH0sXG4gICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgIH0pO1xuICAgIHBlcmZvcm1lci5mID0gZjtcbiAgICBwZXJmb3JtZXIubG9nZ2VyID0gbG9nZ2VyO1xuICAgIHBlcmZvcm1lci5sZXZlbCA9IGxldmVsO1xuICAgIHJldHVybiBwZXJmb3JtZXI7XG59XG5cbkxvZ2dlci5MZXZlbCA9IHtcbiAgICB0cmFjZTogMCxcbiAgICBkZWJ1ZzogMSxcbiAgICBpbmZvOiAyLFxuICAgIHdhcm5pbmc6IDMsXG4gICAgd2FybjogMyxcbiAgICBlcnJvcjogNCxcbiAgICBmYXRhbDogNVxufTtcblxuTG9nZ2VyLkxldmVsVGV4dCA9IHt9O1xuTG9nZ2VyLkxldmVsVGV4dCBbTG9nZ2VyLkxldmVsLnRyYWNlXSA9ICdUUkFDRSc7XG5Mb2dnZXIuTGV2ZWxUZXh0IFtMb2dnZXIuTGV2ZWwuZGVidWddID0gJ0RFQlVHJztcbkxvZ2dlci5MZXZlbFRleHQgW0xvZ2dlci5MZXZlbC5pbmZvXSA9ICdJTkZPICc7XG5Mb2dnZXIuTGV2ZWxUZXh0IFtMb2dnZXIuTGV2ZWwud2FybmluZ10gPSAnV0FSTiAnO1xuTG9nZ2VyLkxldmVsVGV4dCBbTG9nZ2VyLkxldmVsLmVycm9yXSA9ICdFUlJPUic7XG5cbkxvZ2dlci5sZXZlbEFzVGV4dCA9IGZ1bmN0aW9uIChsZXZlbCkge1xuICAgIHJldHVybiB0aGlzLkxldmVsVGV4dFtsZXZlbF07XG59O1xuXG5Mb2dnZXIubG9nZ2VyV2l0aE5hbWUgPSBmdW5jdGlvbiAobmFtZSkge1xuICAgIHJldHVybiBuZXcgTG9nZ2VyKG5hbWUpO1xufTtcblxuTG9nZ2VyLnByb3RvdHlwZS5jdXJyZW50TGV2ZWwgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIGxvZ0xldmVsID0gbG9nTGV2ZWxzW3RoaXMubmFtZV07XG4gICAgcmV0dXJuICBsb2dMZXZlbCA/IGxvZ0xldmVsIDogTG9nZ2VyLkxldmVsLnRyYWNlO1xufTtcblxuTG9nZ2VyLnByb3RvdHlwZS5zZXRMZXZlbCA9IGZ1bmN0aW9uIChsZXZlbCkge1xuICAgIGxvZ0xldmVsc1t0aGlzLm5hbWVdID0gbGV2ZWw7XG59O1xuXG5Mb2dnZXIucHJvdG90eXBlLm92ZXJyaWRlID0gZnVuY3Rpb24gKGxldmVsLCBvdmVycmlkZSwgbWVzc2FnZSkge1xuICAgIHZhciBsZXZlbEFzVGV4dCA9IExvZ2dlci5sZXZlbEFzVGV4dChsZXZlbCk7XG4gICAgdmFyIHBlcmZvcm1lciA9IHRoaXNbbGV2ZWxBc1RleHQudHJpbSgpLnRvTG93ZXJDYXNlKCldO1xuICAgIHZhciBmID0gcGVyZm9ybWVyLmY7XG4gICAgdmFyIG90aGVyQXJndW1lbnRzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAzLCBhcmd1bWVudHMubGVuZ3RoKTtcbiAgICB0aGlzLnBlcmZvcm1Mb2coZiwgbGV2ZWwsIG1lc3NhZ2UsIG90aGVyQXJndW1lbnRzLCBvdmVycmlkZSk7XG59O1xuXG5Mb2dnZXIucHJvdG90eXBlLnBlcmZvcm1Mb2cgPSBmdW5jdGlvbiAobG9nRnVuYywgbGV2ZWwsIG1lc3NhZ2UsIG90aGVyQXJndW1lbnRzLCBvdmVycmlkZSkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB2YXIgY3VycmVudExldmVsID0gb3ZlcnJpZGUgIT09IHVuZGVmaW5lZCA/IG92ZXJyaWRlIDogdGhpcy5jdXJyZW50TGV2ZWwoKTtcbiAgICBpZiAoY3VycmVudExldmVsIDw9IGxldmVsKSB7XG4gICAgICAgIGxvZ0Z1bmMgPSBfLnBhcnRpYWwobG9nRnVuYywgTG9nZ2VyLmxldmVsQXNUZXh0KGxldmVsKSArICcgWycgKyBzZWxmLm5hbWUgKyAnXTogJyArIG1lc3NhZ2UpO1xuICAgICAgICB2YXIgYXJncyA9IFtdO1xuICAgICAgICBmb3IgKHZhciBpPTA7IGk8b3RoZXJBcmd1bWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGFyZ3NbaV0gPSBvdGhlckFyZ3VtZW50c1tpXTtcbiAgICAgICAgfVxuICAgICAgICBhcmdzLnNwbGljZSgwLCAxKTtcbiAgICAgICAgbG9nRnVuYy5hcHBseShsb2dGdW5jLCBhcmdzKTtcbiAgICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IExvZ2dlcjtcbiIsInZhciBsb2cgPSByZXF1aXJlKCcuL2xvZycpO1xudmFyIExvZ2dlciA9IGxvZy5sb2dnZXJXaXRoTmFtZSgnT3BlcmF0aW9uJyk7XG52YXIgXyA9IHJlcXVpcmUoJy4uL3V0aWwnKS5fO1xuXG5mdW5jdGlvbiBPcGVyYXRpb24oKSB7XG4gICAgaWYgKCF0aGlzKSB7XG4gICAgICAgIHJldHVybiBuZXcgKEZ1bmN0aW9uLnByb3RvdHlwZS5iaW5kLmFwcGx5KE9wZXJhdGlvbiwgYXJndW1lbnRzKSk7XG4gICAgfVxuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCkge1xuICAgICAgICBpZiAodHlwZW9mKGFyZ3VtZW50c1swXSkgPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIHRoaXMubmFtZSA9IGFyZ3VtZW50c1swXTtcbiAgICAgICAgICAgIHRoaXMud29yayA9IGFyZ3VtZW50c1sxXTtcbiAgICAgICAgICAgIHRoaXMuY29tcGxldGlvbiA9IGFyZ3VtZW50c1syXTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmICh0eXBlb2YoYXJndW1lbnRzWzBdKSA9PSAnZnVuY3Rpb24nIHx8XG4gICAgICAgICAgICBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoYXJndW1lbnRzWzBdKSA9PT0gJ1tvYmplY3QgQXJyYXldJyB8fFxuICAgICAgICAgICAgYXJndW1lbnRzWzBdIGluc3RhbmNlb2YgT3BlcmF0aW9uKSB7XG4gICAgICAgICAgICB0aGlzLndvcmsgPSBhcmd1bWVudHNbMF07XG4gICAgICAgICAgICB0aGlzLmNvbXBsZXRpb24gPSBhcmd1bWVudHNbMV07XG4gICAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5lcnJvciA9IG51bGw7XG4gICAgdGhpcy5jb21wbGV0ZWQgPSBmYWxzZTtcbiAgICB0aGlzLnJlc3VsdCA9IG51bGw7XG4gICAgdGhpcy5ydW5uaW5nID0gZmFsc2U7XG4gICAgdGhpcy5jYW5jZWxsZWQgPSBmYWxzZTtcbiAgICB0aGlzLmRlcGVuZGVuY2llcyA9IFtdO1xuICAgIHRoaXMuX211c3RTdWNjZWVkID0gW107XG4gICAgdGhpcy5fb25Db21wbGV0aW9uID0gW107XG4gICAgdGhpcy5sb2dMZXZlbCA9IG51bGw7IC8vIE92ZXJyaWRlLlxuXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsICdmYWlsZWQnLCB7XG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuICAhIXNlbGYuZXJyb3IgfHwgc2VsZi5mYWlsZWREdWVUb0RlcGVuZGVuY3k7XG4gICAgICAgIH0sXG4gICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgIH0pO1xuXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsICdjb21wb3NpdGUnLCB7XG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIHNlbGYud29yayBpbnN0YW5jZW9mIE9wZXJhdGlvbiB8fFxuICAgICAgICAgICAgICAgIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChzZWxmLndvcmspID09PSAnW29iamVjdCBBcnJheV0nXG4gICAgICAgIH0sXG4gICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgIH0pO1xuXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsICdudW1PcGVyYXRpb25zUmVtYWluaW5nJywge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGlmIChzZWxmLndvcmsgaW5zdGFuY2VvZiBPcGVyYXRpb24pIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gc2VsZi53b3JrLmNvbXBsZXRlZCA/IDAgOiAxXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoc2VsZi53b3JrKSA9PT0gJ1tvYmplY3QgQXJyYXldJykge1xuICAgICAgICAgICAgICAgIHJldHVybiBfLnJlZHVjZShzZWxmLndvcmssIGZ1bmN0aW9uIChtZW1vLCBvcCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIW9wLmNvbXBsZXRlZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG1lbW8gKyAxO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBtZW1vO1xuICAgICAgICAgICAgICAgIH0sIDApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgIH0pO1xuXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsICdjYW5SdW4nLCB7XG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgaWYgKHNlbGYuZGVwZW5kZW5jaWVzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBfLnJlZHVjZShzZWxmLmRlcGVuZGVuY2llcywgZnVuY3Rpb24gKG1lbW8sIGRlcCkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgbXVzdFN1Y2NlZWQgPSBzZWxmLl9tdXN0U3VjY2VlZC5pbmRleE9mKGRlcCkgPiAtMTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGNhblJ1biA9IG1lbW8gJiYgZGVwLmNvbXBsZXRlZDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG11c3RTdWNjZWVkICYmIGNhblJ1bikge1xuICAgICAgICAgICAgICAgICAgICAgICAgY2FuUnVuID0gY2FuUnVuICYmICEoZGVwLmZhaWxlZCB8fCBkZXAuY2FuY2VsbGVkKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gY2FuUnVuO1xuICAgICAgICAgICAgICAgIH0sIHRydWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH0sXG4gICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgIH0pO1xuXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsICdmYWlsZWREdWVUb0RlcGVuZGVuY3knLCB7XG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgaWYgKHNlbGYuZGVwZW5kZW5jaWVzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIHZhciBmYWlsZWREZXBzID0gXy5yZWR1Y2Uoc2VsZi5kZXBlbmRlbmNpZXMsIGZ1bmN0aW9uIChtZW1vLCBkZXApIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIG11c3RTdWNjZWVkID0gc2VsZi5fbXVzdFN1Y2NlZWQuaW5kZXhPZihkZXApID4gLTE7XG4gICAgICAgICAgICAgICAgICAgIHZhciBmYWlsZWQgPSAoKGRlcC5mYWlsZWQgfHwgZGVwLmNhbmNlbGxlZCkgJiYgbXVzdFN1Y2NlZWQpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoZmFpbGVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBtZW1vLnB1c2goZGVwKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbWVtbztcbiAgICAgICAgICAgICAgICB9LCBbXSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhaWxlZERlcHMubGVuZ3RoID8gZmFpbGVkRGVwcyA6IGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9LFxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICB9KTtcblxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCAnZmFpbGVkRHVlVG9DYW5jZWxsYXRpb25PZkRlcGVuZGVuY3knLCB7XG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgaWYgKHNlbGYuZGVwZW5kZW5jaWVzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIHZhciBjYW5jZWxsZWQgPSBfLnJlZHVjZShzZWxmLmRlcGVuZGVuY2llcywgZnVuY3Rpb24gKG1lbW8sIGRlcCkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgbXVzdFN1Y2NlZWQgPSBzZWxmLl9tdXN0U3VjY2VlZC5pbmRleE9mKGRlcCkgPiAtMTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG11c3RTdWNjZWVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZGVwLmNhbmNlbGxlZCkgbWVtby5wdXNoKGRlcCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG1lbW87XG4gICAgICAgICAgICAgICAgfSwgW10pO1xuICAgICAgICAgICAgICAgIHJldHVybiBjYW5jZWxsZWQubGVuZ3RoID8gY2FuY2VsbGVkIDogZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH0sXG4gICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgIH0pO1xuXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsICdsb2dnaW5nT3ZlcmlkZGVuJywge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGlmIChzZWxmLmxvZ0xldmVsKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHNlbGYubG9nTGV2ZWwgPD0gbG9nLkxldmVsLmluZm87XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH0sXG4gICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgIH0pXG5cblxufVxuXG5PcGVyYXRpb24ucnVubmluZyA9IFtdO1xuXG5PcGVyYXRpb24ucHJvdG90eXBlLl9zdGFydFNpbmdsZSA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdGhpcy53b3JrKGZ1bmN0aW9uIChlcnIsIHBheWxvYWQpIHtcbiAgICAgICAgc2VsZi5yZXN1bHQgPSBwYXlsb2FkO1xuICAgICAgICBzZWxmLmVycm9yID0gZXJyO1xuICAgICAgICBzZWxmLmNvbXBsZXRlZCA9IHRydWU7XG4gICAgICAgIHNlbGYucnVubmluZyA9IGZhbHNlO1xuICAgICAgICBzZWxmLl9jb21wbGV0ZSgpO1xuICAgIH0pO1xufTtcblxuT3BlcmF0aW9uLnByb3RvdHlwZS5fc3RhcnRDb21wb3NpdGUgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciBvcGVyYXRpb25zID0gc2VsZi53b3JrIGluc3RhbmNlb2YgT3BlcmF0aW9uID8gW3NlbGYud29ya10gOiBzZWxmLndvcms7XG4gICAgXy5lYWNoKG9wZXJhdGlvbnMsIGZ1bmN0aW9uIChvcCkge1xuICAgICAgICBvcC5vbkNvbXBsZXRpb24oZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdmFyIG51bU9wZXJhdGlvbnNSZW1haW5pbmcgPSBzZWxmLm51bU9wZXJhdGlvbnNSZW1haW5pbmc7XG4gICAgICAgICAgICB2YXIgbmFtZSA9IHNlbGYubmFtZSB8fCAnVW5uYW1lZCc7XG4gICAgICAgICAgICBMb2dnZXIuZGVidWcobmFtZSArICcgaGFzICcgKyBudW1PcGVyYXRpb25zUmVtYWluaW5nLnRvU3RyaW5nKCkgKyAnIG9wZXJhdGlvbnMgcmVtYWluaW5nJyk7XG4gICAgICAgICAgICBpZiAoIW51bU9wZXJhdGlvbnNSZW1haW5pbmcpIHtcbiAgICAgICAgICAgICAgICB2YXIgZXJyb3JzID0gXy5wbHVjayhvcGVyYXRpb25zLCAnZXJyb3InKTtcbiAgICAgICAgICAgICAgICB2YXIgcmVzdWx0cyA9IF8ucGx1Y2sob3BlcmF0aW9ucywgJ3Jlc3VsdCcpO1xuICAgICAgICAgICAgICAgIHNlbGYucmVzdWx0ID0gXy5zb21lKHJlc3VsdHMpID8gcmVzdWx0cyA6IG51bGw7XG4gICAgICAgICAgICAgICAgc2VsZi5lcnJvciA9IF8uc29tZShlcnJvcnMpID8gZXJyb3JzIDogbnVsbDtcbiAgICAgICAgICAgICAgICBzZWxmLmNvbXBsZXRlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgc2VsZi5ydW5uaW5nID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgc2VsZi5fY29tcGxldGUoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIG9wLnN0YXJ0KCk7XG4gICAgfSk7XG59O1xuXG5PcGVyYXRpb24ucHJvdG90eXBlLl9sb2dDb21wbGV0aW9uID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBsb2dGdW5jID0gdGhpcy5fZ2V0TG9nRnVuYygpO1xuICAgIGlmIChMb2dnZXIuaW5mby5pc0VuYWJsZWQgfHwgdGhpcy5sb2dnaW5nT3ZlcmlkZGVuKSB7XG4gICAgICAgIHZhciBuYW1lID0gdGhpcy5uYW1lIHx8ICdVbm5hbWVkJztcbiAgICAgICAgdmFyIGZhaWxlZERlcGVuZGVuY2llcyA9IHRoaXMuZmFpbGVkRHVlVG9EZXBlbmRlbmN5O1xuICAgICAgICBpZiAoZmFpbGVkRGVwZW5kZW5jaWVzKSB7XG4gICAgICAgICAgICBsb2dGdW5jKCdcIicgKyBuYW1lICsgJ1wiIGZhaWxlZCBkdWUgdG8gZmFpbHVyZS9jYW5jZWxsYXRpb24gb2YgZGVwZW5kZW5jaWVzOiAnICsgXy5wbHVjayhmYWlsZWREZXBlbmRlbmNpZXMsICduYW1lJykuam9pbignLCAnKSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAodGhpcy5mYWlsZWQpIHtcbiAgICAgICAgICAgIHZhciBlcnIgPSB0aGlzLmVycm9yO1xuICAgICAgICAgICAgLy8gUmVtb3ZlIG51bGwgZXJyb3JzLlxuICAgICAgICAgICAgaWYgKE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChlcnIpID09PSAnW29iamVjdCBBcnJheV0nKSB7XG4gICAgICAgICAgICAgICAgZXJyID0gXy5maWx0ZXIoZXJyLCBmdW5jdGlvbiAoZSkge3JldHVybiBlIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgZXJyID0gW3RoaXMuZXJyb3JdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbG9nRnVuYygnXCInICsgbmFtZSArICdcIiBmYWlsZWQgZHVlIHRvIGVycm9yczonLCBlcnIpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKHRoaXMuY2FuY2VsbGVkKSB7XG4gICAgICAgICAgICBsb2dGdW5jKCdcIicgKyBuYW1lICsgJ1wiIGhhcyBiZWVuIGNhbmNlbGxlZC4nKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGxvZ0Z1bmMoJ1wiJyArIG5hbWUgKyAnXCIgaGFzIHN1Y2NlZWRlZC4nKTtcbiAgICAgICAgfVxuICAgIH1cbn07XG5cbk9wZXJhdGlvbi5wcm90b3R5cGUuX2dldExvZ0Z1bmMgPSBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKHRoaXMubG9nTGV2ZWwpIHtcbiAgICAgICAgcmV0dXJuIF8uYmluZChMb2dnZXIub3ZlcnJpZGUsIExvZ2dlciwgbG9nLkxldmVsLmluZm8sIHRoaXMubG9nTGV2ZWwpO1xuICAgIH1cbiAgICByZXR1cm4gTG9nZ2VyLmluZm87XG59O1xuXG5PcGVyYXRpb24ucHJvdG90eXBlLl9sb2dTdGFydCA9IGZ1bmN0aW9uICgpIHtcbiAgICBpZiAoTG9nZ2VyLmluZm8uaXNFbmFibGVkIHx8IHRoaXMubG9nZ2luZ092ZXJpZGRlbikge1xuICAgICAgICB2YXIgbmFtZSA9IHRoaXMubmFtZSB8fCAnVW5uYW1lZCc7XG4gICAgICAgIHZhciBsb2dGdW5jID0gdGhpcy5fZ2V0TG9nRnVuYygpO1xuICAgICAgICBsb2dGdW5jKCdcIicgKyBuYW1lICsgJ1wiIGhhcyBzdGFydGVkLicpO1xuICAgIH1cbn07XG5cblxuT3BlcmF0aW9uLnByb3RvdHlwZS5fY29tcGxldGUgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHRoaXMuY29tcGxldGVkID0gdHJ1ZTtcbiAgICB2YXIgaWR4ID0gT3BlcmF0aW9uLnJ1bm5pbmcuaW5kZXhPZih0aGlzKTtcbiAgICBPcGVyYXRpb24ucnVubmluZy5zcGxpY2UoaWR4LCAxKTtcbiAgICBpZiAodGhpcy5jb21wbGV0aW9uKSB7XG4gICAgICAgIF8uYmluZCh0aGlzLmNvbXBsZXRpb24sIHRoaXMpKCk7XG4gICAgfVxuICAgIHRoaXMuX2xvZ0NvbXBsZXRpb24oKTtcbiAgICBfLmVhY2godGhpcy5fb25Db21wbGV0aW9uLCBmdW5jdGlvbiAobykge1xuICAgICAgICBfLmJpbmQobywgc2VsZikoKTtcbiAgICB9KTtcbn07XG5cbk9wZXJhdGlvbi5wcm90b3R5cGUuX19zdGFydCA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLl9sb2dTdGFydCgpO1xuICAgIGlmICh0aGlzLndvcmspIHtcbiAgICAgICAgaWYgKHRoaXMuY29tcG9zaXRlKSB7XG4gICAgICAgICAgICB0aGlzLl9zdGFydENvbXBvc2l0ZSgpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fc3RhcnRTaW5nbGUoKTtcbiAgICAgICAgfVxuICAgICAgICBPcGVyYXRpb24ucnVubmluZy5wdXNoKHRoaXMpO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgdGhpcy5yZXN1bHQgPSBudWxsO1xuICAgICAgICB0aGlzLmVycm9yID0gbnVsbDtcbiAgICAgICAgdGhpcy5ydW5uaW5nID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX2NvbXBsZXRlKCk7XG4gICAgfVxufTtcblxuT3BlcmF0aW9uLnByb3RvdHlwZS5zdGFydCA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIG5ldmVyU3RhcnRlZCA9ICF0aGlzLnJ1bm5pbmcgJiYgIXRoaXMuY29tcGxldGVkO1xuICAgIHZhciBuZXZlclN0YXJ0ZWRBbmRGYWlsZWQgPSBuZXZlclN0YXJ0ZWQgJiYgdGhpcy5mYWlsZWQ7XG4gICAgLy8gQSBkZXBlbmRlbmN5IGZhaWxlZCBvciB3YXMgY2FuY2VsbGVkIGJlZm9yZSB0aGlzIG9wZXJhdGlvbiBzdGFydGVkLlxuICAgIGlmIChuZXZlclN0YXJ0ZWRBbmRGYWlsZWQpIHtcbiAgICAgICAgdGhpcy5fY29tcGxldGUoKTtcbiAgICB9XG4gICAgZWxzZSBpZiAobmV2ZXJTdGFydGVkKSB7XG4gICAgICAgIHRoaXMucnVubmluZyA9IHRydWU7XG4gICAgICAgIGlmICh0aGlzLmNhblJ1bikge1xuICAgICAgICAgICAgdGhpcy5fX3N0YXJ0KCk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBfLmVhY2godGhpcy5kZXBlbmRlbmNpZXMsIGZ1bmN0aW9uIChkZXApIHtcbiAgICAgICAgICAgICAgICBkZXAub25Db21wbGV0aW9uKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHNlbGYuY2FuUnVuKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzZWxmLl9fc3RhcnQoKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH1cbn07XG5cblxuT3BlcmF0aW9uLnByb3RvdHlwZS5hZGREZXBlbmRlbmN5ID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PSAxKSB7XG4gICAgICAgIHRoaXMuZGVwZW5kZW5jaWVzLnB1c2goYXJndW1lbnRzWzBdKTtcbiAgICB9XG4gICAgZWxzZSBpZiAoYXJndW1lbnRzLmxlbmd0aCkge1xuICAgICAgICB2YXIgYXJncyA9IGFyZ3VtZW50cztcbiAgICAgICAgdmFyIGxhc3RBcmcgPSBhcmdzW2FyZ3MubGVuZ3RoIC0gMV07XG4gICAgICAgIHZhciBtdXN0U3VjY2VlZCA9IGZhbHNlO1xuICAgICAgICBpZiAodHlwZW9mKGxhc3RBcmcpID09ICdib29sZWFuJykge1xuICAgICAgICAgICAgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3MsIDAsIGFyZ3MubGVuZ3RoIC0gMSk7XG4gICAgICAgICAgICBtdXN0U3VjY2VlZCA9IGxhc3RBcmc7XG4gICAgICAgIH1cbiAgICAgICAgXy5lYWNoKGFyZ3MsIGZ1bmN0aW9uIChhcmcpIHtcbiAgICAgICAgICAgIHNlbGYuZGVwZW5kZW5jaWVzLnB1c2goYXJnKTtcbiAgICAgICAgfSk7XG4gICAgICAgIGlmIChtdXN0U3VjY2VlZCkge1xuICAgICAgICAgICAgXy5lYWNoKGFyZ3MsIGZ1bmN0aW9uIChhcmcpIHtcbiAgICAgICAgICAgICAgICBzZWxmLl9tdXN0U3VjY2VlZC5wdXNoKGFyZyk7XG4gICAgICAgICAgICB9KVxuICAgICAgICB9XG4gICAgfVxufTtcblxuT3BlcmF0aW9uLnByb3RvdHlwZS5vbkNvbXBsZXRpb24gPSBmdW5jdGlvbiAobykge1xuICAgIGlmICghdGhpcy5jb21wbGV0ZWQpIHtcbiAgICAgICAgdGhpcy5fb25Db21wbGV0aW9uLnB1c2gobyk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICBfLmJpbmQobywgdGhpcykoKTtcbiAgICB9XG59O1xuXG5PcGVyYXRpb24ucHJvdG90eXBlLmNhbmNlbCA9IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgIGlmICghdGhpcy5jYW5jZWxsZWQpIHtcbiAgICAgICAgdGhpcy5jYW5jZWxsZWQgPSB0cnVlO1xuICAgICAgICBMb2dnZXIuZGVidWcoJ0NhbmNlbGxpbmcgJyArIHRoaXMubmFtZSwgdGhpcyk7XG4gICAgICAgIGlmICh0aGlzLmNvbXBvc2l0ZSkge1xuICAgICAgICAgICAgXy5lYWNoKHRoaXMud29yaywgZnVuY3Rpb24gKHN1Ym9wKSB7XG4gICAgICAgICAgICAgICAgc3Vib3AuY2FuY2VsKCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLm9uQ29tcGxldGlvbihmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB0aGlzLnJ1bm5pbmcgPSBmYWxzZTtcbiAgICAgICAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2soKTtcbiAgICAgICAgfSk7XG4gICAgfVxufTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KE9wZXJhdGlvbiwgJ2xvZ0xldmVsJywge1xuICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gTG9nZ2VyLmN1cnJlbnRMZXZlbCgpO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbiAodikge1xuICAgICAgICBMb2dnZXIuc2V0TGV2ZWwodik7XG4gICAgfSxcbiAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgZW51bWVyYWJsZTogdHJ1ZVxufSk7XG5cbm1vZHVsZS5leHBvcnRzLk9wZXJhdGlvbiA9IE9wZXJhdGlvbjtcbiIsIlxudmFyIGxvZyA9IHJlcXVpcmUoJy4vbG9nJyk7XG52YXIgTG9nZ2VyID0gbG9nLmxvZ2dlcldpdGhOYW1lKCdPcGVyYXRpb25RdWV1ZScpO1xudmFyIF8gPSByZXF1aXJlKCcuLi91dGlsJykuXztcblxuXG5mdW5jdGlvbiBPcGVyYXRpb25RdWV1ZSgpIHtcblxuICAgIGlmICghdGhpcykge1xuICAgICAgICByZXR1cm4gbmV3IChGdW5jdGlvbi5wcm90b3R5cGUuYmluZC5hcHBseShPcGVyYXRpb25RdWV1ZSwgYXJndW1lbnRzKSk7XG4gICAgfVxuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoKSB7XG4gICAgICAgIGlmICh0eXBlb2YoYXJndW1lbnRzWzBdKSA9PSAnbnVtYmVyJykge1xuICAgICAgICAgICAgdGhpcy5tYXhDb25jdXJyZW50T3BlcmF0aW9ucyA9IGFyZ3VtZW50c1swXTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMubmFtZSA9IGFyZ3VtZW50c1swXTtcbiAgICAgICAgICAgIHRoaXMubWF4Q29uY3VycmVudE9wZXJhdGlvbnMgPSBhcmd1bWVudHNbMV07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLl9xdWV1ZWRPcGVyYXRpb25zID0gW107XG4gICAgdGhpcy5fcnVubmluZ09wZXJhdGlvbnMgPSBbXTtcbiAgICB0aGlzLl9ydW5uaW5nID0gZmFsc2U7XG4gICAgdGhpcy5fb25TdGFydCA9IFtdO1xuICAgIHRoaXMuX29uU3RvcCA9IFtdO1xuICAgIHRoaXMubG9nTGV2ZWwgPSBudWxsO1xuXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsICdudW1SdW5uaW5nT3BlcmF0aW9ucycsIHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gc2VsZi5fcnVubmluZ09wZXJhdGlvbnMubGVuZ3RoO1xuICAgICAgICB9LFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICB9KTtcblxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCAnbG9nZ2luZ092ZXJpZGRlbicsIHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBpZiAoc2VsZi5sb2dMZXZlbCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBzZWxmLmxvZ0xldmVsIDw9IGxvZy5MZXZlbC5pbmZvO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9LFxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICB9KVxufVxuXG5PcGVyYXRpb25RdWV1ZS5wcm90b3R5cGUuX25leHRPcGVyYXRpb25zID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB3aGlsZSAoKHNlbGYuX3J1bm5pbmdPcGVyYXRpb25zLmxlbmd0aCA8IHNlbGYubWF4Q29uY3VycmVudE9wZXJhdGlvbnMpICYmIHNlbGYuX3F1ZXVlZE9wZXJhdGlvbnMubGVuZ3RoKSB7XG4gICAgICAgIHZhciBvcCA9IHNlbGYuX3F1ZXVlZE9wZXJhdGlvbnNbMF07XG4gICAgICAgIHNlbGYuX3F1ZXVlZE9wZXJhdGlvbnMuc3BsaWNlKDAsIDEpO1xuICAgICAgICBzZWxmLl9ydW5PcGVyYXRpb24ob3ApO1xuICAgIH1cbn07XG5cblxuT3BlcmF0aW9uUXVldWUucHJvdG90eXBlLl9ydW5PcGVyYXRpb24gPSBmdW5jdGlvbiAob3ApIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLl9xdWV1ZWRPcGVyYXRpb25zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGlmICh0aGlzLl9xdWV1ZWRPcGVyYXRpb25zW2ldID09IG9wKSB7XG4gICAgICAgICAgICB0aGlzLl9xdWV1ZWRPcGVyYXRpb25zLnNwbGljZShpLCAxKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgfVxuICAgIHRoaXMuX3J1bm5pbmdPcGVyYXRpb25zLnB1c2gob3ApO1xuICAgIG9wLmNvbXBsZXRpb24gPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBpZHggPSBzZWxmLl9ydW5uaW5nT3BlcmF0aW9ucy5pbmRleE9mKG9wKTtcbiAgICAgICAgc2VsZi5fcnVubmluZ09wZXJhdGlvbnMuc3BsaWNlKGlkeCwgMSk7XG4gICAgICAgIGlmIChzZWxmLl9ydW5uaW5nKSB7XG4gICAgICAgICAgICBzZWxmLl9uZXh0T3BlcmF0aW9ucygpO1xuICAgICAgICB9XG4gICAgICAgIHNlbGYuX2xvZ1N0YXR1cygpO1xuICAgIH07XG4gICAgb3Auc3RhcnQoKTtcbiAgICB0aGlzLl9sb2dTdGF0dXMoKTtcbn07XG5cbk9wZXJhdGlvblF1ZXVlLnByb3RvdHlwZS5fbG9nU3RhdHVzID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBsb2dGdW5jID0gdGhpcy5fZ2V0TG9nRnVuYygpO1xuICAgIGlmIChMb2dnZXIuaW5mby5pc0VuYWJsZWQgfHwgdGhpcy5sb2dnaW5nT3ZlcmlkZGVuKSB7XG4gICAgICAgIHZhciBudW1SdW5uaW5nID0gdGhpcy5udW1SdW5uaW5nT3BlcmF0aW9ucztcbiAgICAgICAgdmFyIG51bVF1ZXVlZCA9IHRoaXMuX3F1ZXVlZE9wZXJhdGlvbnMubGVuZ3RoO1xuICAgICAgICB2YXIgbmFtZSA9IHRoaXMubmFtZSB8fCBcIlVubmFtZWQgUXVldWVcIjtcbiAgICAgICAgaWYgKG51bVJ1bm5pbmcgJiYgbnVtUXVldWVkKSB7XG4gICAgICAgICAgICBsb2dGdW5jKCdcIicgKyBuYW1lICsgJ1wiIG5vdyBoYXMgJyArIG51bVJ1bm5pbmcudG9TdHJpbmcoKSArICcgb3BlcmF0aW9ucyBydW5uaW5nIGFuZCAnICsgbnVtUXVldWVkLnRvU3RyaW5nKCkgKyAnIG9wZXJhdGlvbnMgcXVldWVkJyk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAobnVtUnVubmluZykge1xuICAgICAgICAgICAgbG9nRnVuYygnXCInICsgbmFtZSArICdcIiBub3cgaGFzICcgKyBudW1SdW5uaW5nLnRvU3RyaW5nKCkgKyAnIG9wZXJhdGlvbnMgcnVubmluZycpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKG51bVF1ZXVlZCkge1xuICAgICAgICAgICAgbG9nRnVuYygnXCInICsgbmFtZSArICdcIiBub3cgaGFzICcgKyBudW1RdWV1ZWQudG9TdHJpbmcoKSArICcgb3BlcmF0aW9ucyBxdWV1ZWQnKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGxvZ0Z1bmMoJ1wiJyArIG5hbWUgKyAnXCIgaGFzIG5vIG9wZXJhdGlvbnMgcnVubmluZyBvciBxdWV1ZWQnKTtcbiAgICAgICAgfVxuICAgIH1cbn07XG5cbk9wZXJhdGlvblF1ZXVlLnByb3RvdHlwZS5fbG9nU3RhcnQgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIGxvZ0Z1bmMgPSB0aGlzLl9nZXRMb2dGdW5jKCk7XG4gICAgaWYgKExvZ2dlci5pbmZvLmlzRW5hYmxlZCB8fCB0aGlzLmxvZ2dpbmdPdmVyaWRkZW4pIHtcbiAgICAgICAgdmFyIG5hbWUgPSB0aGlzLm5hbWUgfHwgXCJVbm5hbWVkIFF1ZXVlXCI7XG4gICAgICAgIGxvZ0Z1bmMoJ1wiJyArIG5hbWUgKyAnXCIgaXMgbm93IHJ1bm5pbmcnKTtcbiAgICB9XG59O1xuXG5PcGVyYXRpb25RdWV1ZS5wcm90b3R5cGUuX2dldExvZ0Z1bmMgPSBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKHRoaXMubG9nTGV2ZWwpIHtcbiAgICAgICAgcmV0dXJuIF8uYmluZChMb2dnZXIub3ZlcnJpZGUsIExvZ2dlciwgbG9nLkxldmVsLmluZm8sIHRoaXMubG9nTGV2ZWwpO1xuICAgIH1cbiAgICByZXR1cm4gTG9nZ2VyLmluZm87XG59O1xuXG5cbk9wZXJhdGlvblF1ZXVlLnByb3RvdHlwZS5fbG9nU3RvcCA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgbG9nRnVuYyA9IHRoaXMuX2dldExvZ0Z1bmMoKTtcbiAgICBpZiAoTG9nZ2VyLmluZm8uaXNFbmFibGVkIHx8IHRoaXMubG9nZ2luZ092ZXJpZGRlbikge1xuICAgICAgICB2YXIgbmFtZSA9IHRoaXMubmFtZSB8fCBcIlVubmFtZWQgUXVldWVcIjtcbiAgICAgICAgbG9nRnVuYygnXCInICsgbmFtZSArICdcIiBpcyBubyBsb25nZXIgcnVubmluZycpO1xuICAgIH1cbn07XG5cbk9wZXJhdGlvblF1ZXVlLnByb3RvdHlwZS5fYWRkT3BlcmF0aW9uID0gZnVuY3Rpb24gKG9wKSB7XG4gICAgaWYgKHRoaXMubnVtUnVubmluZ09wZXJhdGlvbnMgPCB0aGlzLm1heENvbmN1cnJlbnRPcGVyYXRpb25zICYmIHRoaXMuX3J1bm5pbmcpIHtcbiAgICAgICAgdGhpcy5fcnVuT3BlcmF0aW9uKG9wKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIHRoaXMuX3F1ZXVlZE9wZXJhdGlvbnMucHVzaChvcCk7XG4gICAgfVxuICAgIHRoaXMuX2xvZ1N0YXR1cygpO1xufTtcblxuT3BlcmF0aW9uUXVldWUucHJvdG90eXBlLmFkZE9wZXJhdGlvbiA9IGZ1bmN0aW9uIChvcGVyYXRpb25Pck9wZXJhdGlvbnMpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgaWYgKE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChvcGVyYXRpb25Pck9wZXJhdGlvbnMpID09PSAnW29iamVjdCBBcnJheV0nKSB7XG4gICAgICAgIF8uZWFjaChvcGVyYXRpb25Pck9wZXJhdGlvbnMsIGZ1bmN0aW9uIChvcCkge3NlbGYuX2FkZE9wZXJhdGlvbihvcCl9KTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIHRoaXMuX2FkZE9wZXJhdGlvbihvcGVyYXRpb25Pck9wZXJhdGlvbnMpO1xuICAgIH1cbn07XG5cbk9wZXJhdGlvblF1ZXVlLnByb3RvdHlwZS5zdGFydCA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIHdhc1J1bm5pbmcgPSB0aGlzLl9ydW5uaW5nO1xuICAgIHRoaXMuX3J1bm5pbmcgPSB0cnVlO1xuICAgIGlmICghd2FzUnVubmluZykge1xuICAgICAgICBfLmVhY2goc2VsZi5fb25TdGFydCwgZnVuY3Rpb24gKGMpIHtcbiAgICAgICAgICAgIF8uYmluZChjLCBzZWxmKSgpO1xuICAgICAgICB9KTtcbiAgICAgICAgc2VsZi5fbmV4dE9wZXJhdGlvbnMoKTtcbiAgICAgICAgc2VsZi5fbG9nU3RhcnQoKTtcbiAgICB9XG59O1xuXG5PcGVyYXRpb25RdWV1ZS5wcm90b3R5cGUuc3RvcCA9IGZ1bmN0aW9uIChjYW5jZWwpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIHdhc1J1bm5pbmcgPSB0aGlzLl9ydW5uaW5nO1xuICAgIHRoaXMuX3J1bm5pbmcgPSBmYWxzZTtcbiAgICBpZiAod2FzUnVubmluZykge1xuICAgICAgICBpZiAoY2FuY2VsKSB7XG4gICAgICAgICAgICB2YXIgb3BlcmF0aW9ucyA9IHRoaXMuX3J1bm5pbmdPcGVyYXRpb25zLnNsaWNlKDApOyAvLyBDbG9uZSBzbyBub3QgZmlnaHRpbmcgY2FsbGJhY2tzLlxuICAgICAgICAgICAgXy5lYWNoKG9wZXJhdGlvbnMsIGZ1bmN0aW9uIChvKSB7XG4gICAgICAgICAgICAgICAgby5jYW5jZWwoKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIHNlbGYuX2xvZ1N0b3AoKTtcbiAgICAgICAgXy5lYWNoKHNlbGYuX29uU3RvcCwgZnVuY3Rpb24gKGMpIHtcbiAgICAgICAgICAgIF8uYmluZChjLCBzZWxmKSgpO1xuICAgICAgICB9KTtcbiAgICB9XG59O1xuXG5PcGVyYXRpb25RdWV1ZS5wcm90b3R5cGUub25TdGFydCA9IGZ1bmN0aW9uIChvKSB7XG4gICAgdGhpcy5fb25TdGFydC5wdXNoKG8pO1xufTtcbk9wZXJhdGlvblF1ZXVlLnByb3RvdHlwZS5vblN0b3AgPSBmdW5jdGlvbiAobykge1xuICAgIHRoaXMuX29uU3RvcC5wdXNoKG8pO1xufTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KE9wZXJhdGlvblF1ZXVlLCAnbG9nTGV2ZWwnLCB7XG4gICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiBMb2dnZXIuY3VycmVudExldmVsKCk7XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uICh2KSB7XG4gICAgICAgIExvZ2dlci5zZXRMZXZlbCh2KTtcbiAgICB9LFxuICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICBlbnVtZXJhYmxlOiB0cnVlXG59KTtcblxuXG5tb2R1bGUuZXhwb3J0cy5PcGVyYXRpb25RdWV1ZSA9IE9wZXJhdGlvblF1ZXVlO1xuIiwiLyoqXG4gKiBCYXNlIGZ1bmN0aW9uYWxpdHkgZm9yIHJlbGF0aW9uc2hpcHNcbiAqIEBtb2R1bGUgcmVsYXRpb25zaGlwc1xuICovXG5cbnZhciBJbnRlcm5hbFNpZXN0YUVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpLkludGVybmFsU2llc3RhRXJyb3IsXG4gICAgU3RvcmUgPSByZXF1aXJlKCcuL3N0b3JlJyksXG4gICAgT3BlcmF0aW9uID0gcmVxdWlyZSgnLi9vcGVyYXRpb24vb3BlcmF0aW9uJykuT3BlcmF0aW9uLFxuICAgIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKSxcbiAgICBkZWZpbmVTdWJQcm9wZXJ0eSA9IHV0aWwuZGVmaW5lU3ViUHJvcGVydHksXG4gICAgXyA9IHV0aWwuXyxcbiAgICBRdWVyeSA9IHJlcXVpcmUoJy4vcXVlcnknKS5RdWVyeSxcbiAgICBsb2cgPSByZXF1aXJlKCcuL29wZXJhdGlvbi9sb2cnKSxcbiAgICBub3RpZmljYXRpb25DZW50cmUgPSByZXF1aXJlKCcuL25vdGlmaWNhdGlvbkNlbnRyZScpLFxuICAgIHdyYXBBcnJheUZvckF0dHJpYnV0ZXMgPSBub3RpZmljYXRpb25DZW50cmUud3JhcEFycmF5LFxuICAgIEFycmF5T2JzZXJ2ZXIgPSByZXF1aXJlKCcuLi92ZW5kb3Ivb2JzZXJ2ZS1qcy9zcmMvb2JzZXJ2ZScpLkFycmF5T2JzZXJ2ZXIsXG4gICAgY29yZUNoYW5nZXMgPSByZXF1aXJlKCcuL2NoYW5nZXMnKSxcbiAgICBDaGFuZ2VUeXBlID0gY29yZUNoYW5nZXMuQ2hhbmdlVHlwZTtcblxuLyoqXG4gKiBAY2xhc3MgIFtGYXVsdCBkZXNjcmlwdGlvbl1cbiAqIEBwYXJhbSB7UmVsYXRpb25zaGlwUHJveHl9IHByb3h5XG4gKiBAY29uc3RydWN0b3JcbiAqL1xuZnVuY3Rpb24gRmF1bHQocHJveHkpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdGhpcy5wcm94eSA9IHByb3h5O1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCAnaXNGYXVsdCcsIHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gc2VsZi5wcm94eS5pc0ZhdWx0O1xuICAgICAgICB9LFxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICB9KTtcbn1cblxuXy5leHRlbmQoRmF1bHQucHJvdG90eXBlLCB7XG4gICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRoaXMucHJveHkuZ2V0LmFwcGx5KHRoaXMucHJveHksIGFyZ3VtZW50cyk7XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGhpcy5wcm94eS5zZXQuYXBwbHkodGhpcy5wcm94eSwgYXJndW1lbnRzKTtcbiAgICB9XG59KTtcblxuXG4vKipcbiAqIEBjbGFzcyAgW1JlbGF0aW9uc2hpcFByb3h5IGRlc2NyaXB0aW9uXVxuICogQHBhcmFtIHtPYmplY3R9IG9wdHNcbiAqIEBjb25zdHJ1Y3RvclxuICovXG5mdW5jdGlvbiBSZWxhdGlvbnNoaXBQcm94eShvcHRzKSB7XG4gICAgdGhpcy5fb3B0cyA9IG9wdHM7XG4gICAgaWYgKCF0aGlzKSByZXR1cm4gbmV3IFJlbGF0aW9uc2hpcFByb3h5KG9wdHMpO1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB0aGlzLmZhdWx0ID0gbmV3IEZhdWx0KHRoaXMpO1xuICAgIHRoaXMub2JqZWN0ID0gbnVsbDtcbiAgICB0aGlzLl9pZCA9IHVuZGVmaW5lZDtcbiAgICB0aGlzLnJlbGF0ZWQgPSBudWxsO1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCAnaXNGYXVsdCcsIHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBpZiAoc2VsZi5faWQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gIXNlbGYucmVsYXRlZDtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoc2VsZi5faWQgPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSxcbiAgICAgICAgc2V0OiBmdW5jdGlvbiAodikge1xuICAgICAgICAgICAgaWYgKHYpIHtcbiAgICAgICAgICAgICAgICBzZWxmLl9pZCA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgICAgICBzZWxmLnJlbGF0ZWQgPSBudWxsO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZiAoIXNlbGYuX2lkKSB7XG4gICAgICAgICAgICAgICAgICAgIHNlbGYuX2lkID0gbnVsbDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgIH0pO1xuICAgIGRlZmluZVN1YlByb3BlcnR5LmNhbGwodGhpcywgJ3JldmVyc2VNYXBwaW5nJywgdGhpcy5fb3B0cyk7XG4gICAgZGVmaW5lU3ViUHJvcGVydHkuY2FsbCh0aGlzLCAnZm9yd2FyZE1hcHBpbmcnLCB0aGlzLl9vcHRzKTtcbiAgICBkZWZpbmVTdWJQcm9wZXJ0eS5jYWxsKHRoaXMsICdmb3J3YXJkTmFtZScsIHRoaXMuX29wdHMpO1xuICAgIGRlZmluZVN1YlByb3BlcnR5LmNhbGwodGhpcywgJ3JldmVyc2VOYW1lJywgdGhpcy5fb3B0cyk7XG4gICAgZGVmaW5lU3ViUHJvcGVydHkuY2FsbCh0aGlzLCAnaXNSZXZlcnNlJywgdGhpcy5fb3B0cyk7XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsICdpc0ZvcndhcmQnLCB7XG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuICFzZWxmLmlzUmV2ZXJzZTtcbiAgICAgICAgfSxcbiAgICAgICAgc2V0OiBmdW5jdGlvbiAodikge1xuICAgICAgICAgICAgc2VsZi5pc1JldmVyc2UgPSAhdjtcbiAgICAgICAgfSxcbiAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgfSk7XG4gICAgaWYgKHRoaXMuX29wdHMuaXNSZXZlcnNlID09PSB1bmRlZmluZWQgJiYgdGhpcy5fb3B0cy5pc0ZvcndhcmQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICB0aGlzLmlzUmV2ZXJzZSA9ICF0aGlzLl9vcHRzLmlzRm9yd2FyZDtcbiAgICB9XG4gICAgZWxzZSBpZiAodGhpcy5fb3B0cy5pc1JldmVyc2UgPT09IHVuZGVmaW5lZCAmJiB0aGlzLl9vcHRzLmlzRm9yd2FyZCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHRocm93IEludGVybmFsU2llc3RhRXJyb3IoJ011c3Qgc3BlY2lmeSBlaXRoZXIgaXNSZXZlcnNlIG9yIGlzRm9yd2FyZCB3aGVuIGNvbmZpZ3VyaW5nIHJlbGF0aW9uc2hpcCBwcm94eS4nKTtcbiAgICB9XG59XG5cbl8uZXh0ZW5kKFJlbGF0aW9uc2hpcFByb3h5LnByb3RvdHlwZSwge1xuICAgIF9kdW1wOiBmdW5jdGlvbiAoYXNKc29uKSB7XG4gICAgICAgIHZhciBkdW1wZWQgPSB7fTtcbiAgICB9LFxuICAgIGluc3RhbGw6IGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgaWYgKG9iaikge1xuICAgICAgICAgICAgaWYgKCF0aGlzLm9iamVjdCkge1xuICAgICAgICAgICAgICAgIHRoaXMub2JqZWN0ID0gb2JqO1xuICAgICAgICAgICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgICAgICAgICB2YXIgbmFtZSA9IGdldEZvcndhcmROYW1lLmNhbGwodGhpcyk7XG4gICAgICAgICAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG9iaiwgbmFtZSwge1xuICAgICAgICAgICAgICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzZWxmLmlzRmF1bHQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gc2VsZi5mYXVsdDtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHNlbGYucmVsYXRlZDtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgc2V0OiBmdW5jdGlvbiAodikge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2VsZi5zZXQodik7XG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGlmICghb2JqLl9fcHJveGllcykgb2JqLl9fcHJveGllcyA9IHt9O1xuICAgICAgICAgICAgICAgIG9iai5fX3Byb3hpZXNbbmFtZV0gPSB0aGlzO1xuICAgICAgICAgICAgICAgIGlmICghb2JqLl9wcm94aWVzKSB7XG4gICAgICAgICAgICAgICAgICAgIG9iai5fcHJveGllcyA9IFtdO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBvYmouX3Byb3hpZXMucHVzaCh0aGlzKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ0FscmVhZHkgaW5zdGFsbGVkLicpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ05vIG9iamVjdCBwYXNzZWQgdG8gcmVsYXRpb25zaGlwIGluc3RhbGwnKTtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdNdXN0IHN1YmNsYXNzIFJlbGF0aW9uc2hpcFByb3h5Jyk7XG4gICAgfSxcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ011c3Qgc3ViY2xhc3MgUmVsYXRpb25zaGlwUHJveHknKTtcbiAgICB9XG59KTtcblxuXG5mdW5jdGlvbiB2ZXJpZnlNYXBwaW5nKG9iaiwgbWFwcGluZykge1xuICAgIGlmIChvYmoubWFwcGluZyAhPSBtYXBwaW5nKSB7XG4gICAgICAgIHZhciBlcnIgPSAnTWFwcGluZyBkb2VzIG5vdCBtYXRjaC4gRXhwZWN0ZWQgJyArIG1hcHBpbmcudHlwZSArICcgYnV0IGdvdCAnICsgb2JqLm1hcHBpbmcudHlwZTtcbiAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoZXJyKTtcbiAgICB9XG59XG5cbi8vIFRPRE86IFNoYXJlIGNvZGUgYmV0d2VlbiBnZXRSZXZlcnNlUHJveHlGb3JPYmplY3QgYW5kIGdldEZvcndhcmRQcm94eUZvck9iamVjdFxuXG5mdW5jdGlvbiBnZXRSZXZlcnNlUHJveHlGb3JPYmplY3Qob2JqKSB7XG4gICAgdmFyIHJldmVyc2VOYW1lID0gZ2V0UmV2ZXJzZU5hbWUuY2FsbCh0aGlzKTtcbiAgICB2YXIgcmV2ZXJzZU1hcHBpbmcgPSB0aGlzLnJldmVyc2VNYXBwaW5nO1xuICAgIC8vIFRoaXMgc2hvdWxkIG5ldmVyIGhhcHBlbi4gU2hvdWxkIGcgICBldCBjYXVnaHQgaW4gdGhlIG1hcHBpbmcgb3BlcmF0aW9uP1xuICAgIGlmICh1dGlsLmlzQXJyYXkob2JqKSkge1xuICAgICAgICByZXR1cm4gXy5tYXAob2JqLCBmdW5jdGlvbiAobykge1xuICAgICAgICAgICAgcmV0dXJuIG8uX19wcm94aWVzW3JldmVyc2VOYW1lXTtcbiAgICAgICAgfSlcbiAgICB9IGVsc2Uge1xuICAgICAgICB2YXIgcHJveHkgPSBvYmouX19wcm94aWVzW3JldmVyc2VOYW1lXTtcbiAgICAgICAgaWYgKCFwcm94eSkge1xuICAgICAgICAgICAgdmFyIGVyciA9ICdObyBwcm94eSB3aXRoIG5hbWUgXCInICsgcmV2ZXJzZU5hbWUgKyAnXCIgb24gbWFwcGluZyAnICsgcmV2ZXJzZU1hcHBpbmcudHlwZTtcbiAgICAgICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKGVycik7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHByb3h5O1xuICAgIH1cbn1cblxuZnVuY3Rpb24gZ2V0Rm9yd2FyZFByb3h5Rm9yT2JqZWN0KG9iaikge1xuICAgIHZhciBmb3J3YXJkTmFtZSA9IGdldEZvcndhcmROYW1lLmNhbGwodGhpcyk7XG4gICAgdmFyIGZvcndhcmRNYXBwaW5nID0gdGhpcy5mb3J3YXJkTWFwcGluZztcbiAgICBpZiAodXRpbC5pc0FycmF5KG9iaikpIHtcbiAgICAgICAgcmV0dXJuIF8ubWFwKG9iaiwgZnVuY3Rpb24gKG8pIHtcbiAgICAgICAgICAgIHJldHVybiBvLl9fcHJveGllc1tmb3J3YXJkTmFtZV07XG4gICAgICAgIH0pXG4gICAgfSBlbHNlIHtcbiAgICAgICAgdmFyIHByb3h5ID0gb2JqLl9fcHJveGllc1tmb3J3YXJkTmFtZV07XG4gICAgICAgIGlmICghcHJveHkpIHtcbiAgICAgICAgICAgIHZhciBlcnIgPSAnTm8gcHJveHkgd2l0aCBuYW1lIFwiJyArIGZvcndhcmROYW1lICsgJ1wiIG9uIG1hcHBpbmcgJyArIGZvcndhcmRNYXBwaW5nLnR5cGU7XG4gICAgICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcihlcnIpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBwcm94eTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGdldFJldmVyc2VOYW1lKCkge1xuICAgIHJldHVybiB0aGlzLmlzRm9yd2FyZCA/IHRoaXMucmV2ZXJzZU5hbWUgOiB0aGlzLmZvcndhcmROYW1lO1xufVxuXG5mdW5jdGlvbiBnZXRGb3J3YXJkTmFtZSgpIHtcbiAgICByZXR1cm4gdGhpcy5pc0ZvcndhcmQgPyB0aGlzLmZvcndhcmROYW1lIDogdGhpcy5yZXZlcnNlTmFtZTtcbn1cblxuZnVuY3Rpb24gZ2V0UmV2ZXJzZU1hcHBpbmcoKSB7XG4gICAgcmV0dXJuIHRoaXMuaXNGb3J3YXJkID8gdGhpcy5yZXZlcnNlTWFwcGluZyA6IHRoaXMuZm9yd2FyZE1hcHBpbmc7XG59XG5cbmZ1bmN0aW9uIGdldEZvcndhcmRNYXBwaW5nKCkge1xuICAgIHJldHVybiB0aGlzLmlzRm9yd2FyZCA/IHRoaXMuZm9yd2FyZE1hcHBpbmcgOiB0aGlzLnJldmVyc2VNYXBwaW5nO1xufVxuXG5mdW5jdGlvbiBjaGVja0luc3RhbGxlZCgpIHtcbiAgICBpZiAoIXRoaXMub2JqZWN0KSB7XG4gICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdQcm94eSBtdXN0IGJlIGluc3RhbGxlZCBvbiBhbiBvYmplY3QgYmVmb3JlIGNhbiB1c2UgaXQuJyk7XG4gICAgfVxufVxuXG4vKipcbiAqIENvbmZpZ3VyZSBfaWQgYW5kIHJlbGF0ZWQgd2l0aCB0aGUgbmV3IHJlbGF0ZWQgb2JqZWN0LlxuICogQHBhcmFtIG9ialxuICogQHJldHVybnMge1N0cmluZ3x1bmRlZmluZWR9IC0gRXJyb3IgbWVzc2FnZSBvciB1bmRlZmluZWRcbiAqL1xuZnVuY3Rpb24gc2V0KG9iaikge1xuICAgIHJlZ2lzdGVyU2V0Q2hhbmdlLmNhbGwodGhpcywgb2JqKTtcbiAgICBpZiAob2JqKSB7XG4gICAgICAgIGlmICh1dGlsLmlzQXJyYXkob2JqKSkge1xuICAgICAgICAgICAgdGhpcy5faWQgPSBfLnBsdWNrKG9iaiwgJ19pZCcpO1xuICAgICAgICAgICAgdGhpcy5yZWxhdGVkID0gb2JqO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5faWQgPSBvYmouX2lkO1xuICAgICAgICAgICAgdGhpcy5yZWxhdGVkID0gb2JqO1xuICAgICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5faWQgPSBudWxsO1xuICAgICAgICB0aGlzLnJlbGF0ZWQgPSBudWxsO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gc3BsaWNlKGlkeCwgbnVtUmVtb3ZlKSB7XG4gICAgcmVnaXN0ZXJTcGxpY2VDaGFuZ2UuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB2YXIgYWRkID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAyKTtcbiAgICB2YXIgcmV0dXJuVmFsdWUgPSBfLnBhcnRpYWwodGhpcy5faWQuc3BsaWNlLCBpZHgsIG51bVJlbW92ZSkuYXBwbHkodGhpcy5faWQsIF8ucGx1Y2soYWRkLCAnX2lkJykpO1xuICAgIGlmICh0aGlzLnJlbGF0ZWQpIHtcbiAgICAgICAgXy5wYXJ0aWFsKHRoaXMucmVsYXRlZC5zcGxpY2UsIGlkeCwgbnVtUmVtb3ZlKS5hcHBseSh0aGlzLnJlbGF0ZWQsIGFkZCk7XG4gICAgfVxuICAgIHJldHVybiByZXR1cm5WYWx1ZTtcbn1cblxuZnVuY3Rpb24gb2JqQXNTdHJpbmcob2JqKSB7XG4gICAgZnVuY3Rpb24gX29iakFzU3RyaW5nKG9iaikge1xuICAgICAgICBpZiAob2JqKSB7XG4gICAgICAgICAgICB2YXIgbWFwcGluZyA9IG9iai5tYXBwaW5nO1xuICAgICAgICAgICAgdmFyIG1hcHBpbmdOYW1lID0gbWFwcGluZy50eXBlO1xuICAgICAgICAgICAgdmFyIGlkZW50ID0gb2JqLl9pZDtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgaWRlbnQgPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICBpZGVudCA9ICdcIicgKyBpZGVudCArICdcIic7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gbWFwcGluZ05hbWUgKyAnW19pZD0nICsgaWRlbnQgKyAnXSc7XG4gICAgICAgIH0gZWxzZSBpZiAob2JqID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHJldHVybiAndW5kZWZpbmVkJztcbiAgICAgICAgfSBlbHNlIGlmIChvYmogPT09IG51bGwpIHtcbiAgICAgICAgICAgIHJldHVybiAnbnVsbCc7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAodXRpbC5pc0FycmF5KG9iaikpIHJldHVybiBfLm1hcChfb2JqQXNTdHJpbmcsIG9iaikuam9pbignLCAnKTtcbiAgICByZXR1cm4gX29iakFzU3RyaW5nKG9iaik7XG59XG5cbmZ1bmN0aW9uIGNsZWFyUmV2ZXJzZVJlbGF0ZWQoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGlmICghc2VsZi5pc0ZhdWx0KSB7XG4gICAgICAgIGlmICh0aGlzLnJlbGF0ZWQpIHtcbiAgICAgICAgICAgIHZhciByZXZlcnNlUHJveHkgPSBnZXRSZXZlcnNlUHJveHlGb3JPYmplY3QuY2FsbCh0aGlzLCB0aGlzLnJlbGF0ZWQpO1xuICAgICAgICAgICAgdmFyIHJldmVyc2VQcm94aWVzID0gdXRpbC5pc0FycmF5KHJldmVyc2VQcm94eSkgPyByZXZlcnNlUHJveHkgOiBbcmV2ZXJzZVByb3h5XTtcbiAgICAgICAgICAgIF8uZWFjaChyZXZlcnNlUHJveGllcywgZnVuY3Rpb24gKHApIHtcbiAgICAgICAgICAgICAgICBpZiAodXRpbC5pc0FycmF5KHAuX2lkKSkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgaWR4ID0gcC5faWQuaW5kZXhPZihzZWxmLm9iamVjdC5faWQpO1xuICAgICAgICAgICAgICAgICAgICBtYWtlQ2hhbmdlc1RvUmVsYXRlZFdpdGhvdXRPYnNlcnZhdGlvbnMuY2FsbChwLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzcGxpY2UuY2FsbChwLCBpZHgsIDEpO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBzZXQuY2FsbChwLCBudWxsKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIGlmIChzZWxmLl9pZCkge1xuICAgICAgICAgICAgdmFyIHJldmVyc2VOYW1lID0gZ2V0UmV2ZXJzZU5hbWUuY2FsbCh0aGlzKTtcbiAgICAgICAgICAgIHZhciByZXZlcnNlTWFwcGluZyA9IGdldFJldmVyc2VNYXBwaW5nLmNhbGwodGhpcyk7XG4gICAgICAgICAgICB2YXIgaWRlbnRpZmllcnMgPSB1dGlsLmlzQXJyYXkoc2VsZi5faWQpID8gc2VsZi5faWQgOiBbc2VsZi5faWRdO1xuICAgICAgICAgICAgaWYgKHRoaXMuX3JldmVyc2VJc0FycmF5KSB7XG4gICAgICAgICAgICAgICAgXy5lYWNoKGlkZW50aWZpZXJzLCBmdW5jdGlvbiAoX2lkKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvcmVDaGFuZ2VzLnJlZ2lzdGVyQ2hhbmdlKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbGxlY3Rpb246IHJldmVyc2VNYXBwaW5nLmNvbGxlY3Rpb24sXG4gICAgICAgICAgICAgICAgICAgICAgICBtYXBwaW5nOiByZXZlcnNlTWFwcGluZy50eXBlLFxuICAgICAgICAgICAgICAgICAgICAgICAgX2lkOiBfaWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBmaWVsZDogcmV2ZXJzZU5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICByZW1vdmVkSWQ6IFtzZWxmLm9iamVjdC5faWRdLFxuICAgICAgICAgICAgICAgICAgICAgICAgcmVtb3ZlZDogW3NlbGYub2JqZWN0XSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6IENoYW5nZVR5cGUuRGVsZXRlLFxuICAgICAgICAgICAgICAgICAgICAgICAgb2JqOiBzZWxmLm9iamVjdFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgXy5lYWNoKGlkZW50aWZpZXJzLCBmdW5jdGlvbiAoX2lkKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvcmVDaGFuZ2VzLnJlZ2lzdGVyQ2hhbmdlKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbGxlY3Rpb246IHJldmVyc2VNYXBwaW5nLmNvbGxlY3Rpb24sXG4gICAgICAgICAgICAgICAgICAgICAgICBtYXBwaW5nOiByZXZlcnNlTWFwcGluZy50eXBlLFxuICAgICAgICAgICAgICAgICAgICAgICAgX2lkOiBfaWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBmaWVsZDogcmV2ZXJzZU5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBuZXc6IG51bGwsXG4gICAgICAgICAgICAgICAgICAgICAgICBuZXdJZDogbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgICAgIG9sZElkOiBzZWxmLm9iamVjdC5faWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBvbGQ6IHNlbGYub2JqZWN0LFxuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogQ2hhbmdlVHlwZS5TZXQsXG4gICAgICAgICAgICAgICAgICAgICAgICBvYmo6IHNlbGYub2JqZWN0XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoZ2V0Rm9yd2FyZE5hbWUuY2FsbCh0aGlzKSArICcgaGFzIG5vIF9pZCcpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5mdW5jdGlvbiBtYWtlQ2hhbmdlc1RvUmVsYXRlZFdpdGhvdXRPYnNlcnZhdGlvbnMoZikge1xuICAgIGlmICh0aGlzLnJlbGF0ZWQpIHtcbiAgICAgICAgdGhpcy5yZWxhdGVkLm9uZVRvTWFueU9ic2VydmVyLmNsb3NlKCk7XG4gICAgICAgIHRoaXMucmVsYXRlZC5vbmVUb01hbnlPYnNlcnZlciA9IG51bGw7XG4gICAgICAgIGYoKTtcbiAgICAgICAgd3JhcEFycmF5LmNhbGwodGhpcywgdGhpcy5yZWxhdGVkKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICAvLyBJZiB0aGVyZSdzIGEgZmF1bHQgd2UgY2FuIG1ha2UgY2hhbmdlcyBhbnl3YXkuXG4gICAgICAgIGYoKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIHNldFJldmVyc2Uob2JqKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciByZXZlcnNlUHJveHkgPSBnZXRSZXZlcnNlUHJveHlGb3JPYmplY3QuY2FsbCh0aGlzLCBvYmopO1xuICAgIHZhciByZXZlcnNlUHJveGllcyA9IHV0aWwuaXNBcnJheShyZXZlcnNlUHJveHkpID8gcmV2ZXJzZVByb3h5IDogW3JldmVyc2VQcm94eV07XG4gICAgXy5lYWNoKHJldmVyc2VQcm94aWVzLCBmdW5jdGlvbiAocCkge1xuICAgICAgICBpZiAodXRpbC5pc0FycmF5KHAuX2lkKSkge1xuICAgICAgICAgICAgbWFrZUNoYW5nZXNUb1JlbGF0ZWRXaXRob3V0T2JzZXJ2YXRpb25zLmNhbGwocCwgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHNwbGljZS5jYWxsKHAsIHAuX2lkLmxlbmd0aCwgMCwgc2VsZi5vYmplY3QpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjbGVhclJldmVyc2VSZWxhdGVkLmNhbGwocCk7XG4gICAgICAgICAgICBzZXQuY2FsbChwLCBzZWxmLm9iamVjdCk7XG4gICAgICAgIH1cbiAgICB9KTtcbn1cblxuZnVuY3Rpb24gcmVnaXN0ZXJTZXRDaGFuZ2Uob2JqKSB7XG4gICAgdmFyIHByb3h5T2JqZWN0ID0gdGhpcy5vYmplY3Q7XG4gICAgaWYgKCFwcm94eU9iamVjdCkgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ1Byb3h5IG11c3QgaGF2ZSBhbiBvYmplY3QgYXNzb2NpYXRlZCcpO1xuICAgIHZhciBtYXBwaW5nID0gcHJveHlPYmplY3QubWFwcGluZy50eXBlO1xuICAgIHZhciBjb2xsID0gcHJveHlPYmplY3QuY29sbGVjdGlvbjtcbiAgICB2YXIgbmV3SWQ7XG4gICAgaWYgKHV0aWwuaXNBcnJheShvYmopKSB7XG4gICAgICAgIG5ld0lkID0gXy5wbHVjayhvYmosICdfaWQnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBuZXdJZCA9IG9iaiA/IG9iai5faWQgOiBvYmo7XG4gICAgfVxuICAgIC8vIFdlIHRha2UgW10gPT0gbnVsbCA9PSB1bmRlZmluZWQgaW4gdGhlIGNhc2Ugb2YgcmVsYXRpb25zaGlwcy5cbiAgICB2YXIgb2xkSWQgPSB0aGlzLl9pZDtcbiAgICBpZiAodXRpbC5pc0FycmF5KG9sZElkKSAmJiAhb2xkSWQubGVuZ3RoKSB7XG4gICAgICAgIG9sZElkID0gbnVsbDtcbiAgICB9XG4gICAgdmFyIG9sZCA9IHRoaXMucmVsYXRlZDtcbiAgICBpZiAodXRpbC5pc0FycmF5KG9sZCkgJiYgIW9sZC5sZW5ndGgpIHtcbiAgICAgICAgb2xkID0gbnVsbDtcbiAgICB9XG4gICAgY29yZUNoYW5nZXMucmVnaXN0ZXJDaGFuZ2Uoe1xuICAgICAgICBjb2xsZWN0aW9uOiBjb2xsLFxuICAgICAgICBtYXBwaW5nOiBtYXBwaW5nLFxuICAgICAgICBfaWQ6IHByb3h5T2JqZWN0Ll9pZCxcbiAgICAgICAgZmllbGQ6IGdldEZvcndhcmROYW1lLmNhbGwodGhpcyksXG4gICAgICAgIG5ld0lkOiBuZXdJZCxcbiAgICAgICAgb2xkSWQ6IG9sZElkLFxuICAgICAgICBvbGQ6IG9sZCxcbiAgICAgICAgbmV3OiBvYmosXG4gICAgICAgIHR5cGU6IENoYW5nZVR5cGUuU2V0LFxuICAgICAgICBvYmo6IHByb3h5T2JqZWN0XG4gICAgfSk7XG59XG5cbmZ1bmN0aW9uIHJlZ2lzdGVyU3BsaWNlQ2hhbmdlKGlkeCwgbnVtUmVtb3ZlKSB7XG4gICAgdmFyIGFkZCA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMik7XG4gICAgdmFyIG1hcHBpbmcgPSB0aGlzLm9iamVjdC5tYXBwaW5nLnR5cGU7XG4gICAgdmFyIGNvbGwgPSB0aGlzLm9iamVjdC5jb2xsZWN0aW9uO1xuICAgIGNvcmVDaGFuZ2VzLnJlZ2lzdGVyQ2hhbmdlKHtcbiAgICAgICAgY29sbGVjdGlvbjogY29sbCxcbiAgICAgICAgbWFwcGluZzogbWFwcGluZyxcbiAgICAgICAgX2lkOiB0aGlzLm9iamVjdC5faWQsXG4gICAgICAgIGZpZWxkOiBnZXRGb3J3YXJkTmFtZS5jYWxsKHRoaXMpLFxuICAgICAgICBpbmRleDogaWR4LFxuICAgICAgICByZW1vdmVkSWQ6IHRoaXMuX2lkLnNsaWNlKGlkeCwgaWR4ICsgbnVtUmVtb3ZlKSxcbiAgICAgICAgcmVtb3ZlZDogdGhpcy5yZWxhdGVkID8gdGhpcy5yZWxhdGVkLnNsaWNlKGlkeCwgaWR4ICsgbnVtUmVtb3ZlKSA6IG51bGwsXG4gICAgICAgIGFkZGVkSWQ6IGFkZC5sZW5ndGggPyBfLnBsdWNrKGFkZCwgJ19pZCcpIDogW10sXG4gICAgICAgIGFkZGVkOiBhZGQubGVuZ3RoID8gYWRkIDogW10sXG4gICAgICAgIHR5cGU6IENoYW5nZVR5cGUuU3BsaWNlLFxuICAgICAgICBvYmo6IHRoaXMub2JqZWN0XG4gICAgfSk7XG59XG5cblxuZnVuY3Rpb24gd3JhcEFycmF5KGFycikge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB3cmFwQXJyYXlGb3JBdHRyaWJ1dGVzKGFyciwgdGhpcy5yZXZlcnNlTmFtZSwgdGhpcy5vYmplY3QpO1xuICAgIGlmICghYXJyLm9uZVRvTWFueU9ic2VydmVyKSB7XG4gICAgICAgIGFyci5vbmVUb01hbnlPYnNlcnZlciA9IG5ldyBBcnJheU9ic2VydmVyKGFycik7XG4gICAgICAgIHZhciBvYnNlcnZlckZ1bmN0aW9uID0gZnVuY3Rpb24gKHNwbGljZXMpIHtcbiAgICAgICAgICAgIHNwbGljZXMuZm9yRWFjaChmdW5jdGlvbiAoc3BsaWNlKSB7XG4gICAgICAgICAgICAgICAgdmFyIGFkZGVkID0gc3BsaWNlLmFkZGVkQ291bnQgPyBhcnIuc2xpY2Uoc3BsaWNlLmluZGV4LCBzcGxpY2UuaW5kZXggKyBzcGxpY2UuYWRkZWRDb3VudCkgOiBbXTtcbiAgICAgICAgICAgICAgICB2YXIgbWFwcGluZyA9IGdldEZvcndhcmRNYXBwaW5nLmNhbGwoc2VsZik7XG4gICAgICAgICAgICAgICAgY29yZUNoYW5nZXMucmVnaXN0ZXJDaGFuZ2Uoe1xuICAgICAgICAgICAgICAgICAgICBjb2xsZWN0aW9uOiBtYXBwaW5nLmNvbGxlY3Rpb24sXG4gICAgICAgICAgICAgICAgICAgIG1hcHBpbmc6IG1hcHBpbmcudHlwZSxcbiAgICAgICAgICAgICAgICAgICAgX2lkOiBzZWxmLm9iamVjdC5faWQsXG4gICAgICAgICAgICAgICAgICAgIGZpZWxkOiBnZXRGb3J3YXJkTmFtZS5jYWxsKHNlbGYpLFxuICAgICAgICAgICAgICAgICAgICByZW1vdmVkOiBzcGxpY2UucmVtb3ZlZCxcbiAgICAgICAgICAgICAgICAgICAgYWRkZWQ6IGFkZGVkLFxuICAgICAgICAgICAgICAgICAgICByZW1vdmVkSWQ6IF8ucGx1Y2soc3BsaWNlLnJlbW92ZWQsICdfaWQnKSxcbiAgICAgICAgICAgICAgICAgICAgYWRkZWRJZDogXy5wbHVjayhzcGxpY2UuYWRkZWQsICdfaWQnKSxcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogQ2hhbmdlVHlwZS5TcGxpY2UsXG4gICAgICAgICAgICAgICAgICAgIG9iajogc2VsZi5vYmplY3RcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9O1xuICAgICAgICBhcnIub25lVG9NYW55T2JzZXJ2ZXIub3BlbihvYnNlcnZlckZ1bmN0aW9uKTtcbiAgICB9XG59XG5cbmV4cG9ydHMuUmVsYXRpb25zaGlwUHJveHkgPSBSZWxhdGlvbnNoaXBQcm94eTtcbmV4cG9ydHMuRmF1bHQgPSBGYXVsdDtcbmV4cG9ydHMuZ2V0UmV2ZXJzZVByb3h5Rm9yT2JqZWN0ID0gZ2V0UmV2ZXJzZVByb3h5Rm9yT2JqZWN0O1xuZXhwb3J0cy5nZXRGb3J3YXJkUHJveHlGb3JPYmplY3QgPSBnZXRGb3J3YXJkUHJveHlGb3JPYmplY3Q7XG5leHBvcnRzLmdldFJldmVyc2VOYW1lID0gZ2V0UmV2ZXJzZU5hbWU7XG5leHBvcnRzLmdldEZvcndhcmROYW1lID0gZ2V0Rm9yd2FyZE5hbWU7XG5leHBvcnRzLmdldFJldmVyc2VNYXBwaW5nID0gZ2V0UmV2ZXJzZU1hcHBpbmc7XG5leHBvcnRzLmdldEZvcndhcmRNYXBwaW5nID0gZ2V0Rm9yd2FyZE1hcHBpbmc7XG5leHBvcnRzLmNoZWNrSW5zdGFsbGVkID0gY2hlY2tJbnN0YWxsZWQ7XG5leHBvcnRzLnNldCA9IHNldDtcbmV4cG9ydHMucmVnaXN0ZXJTZXRDaGFuZ2UgPSByZWdpc3RlclNldENoYW5nZTtcbmV4cG9ydHMuc3BsaWNlID0gc3BsaWNlO1xuZXhwb3J0cy5jbGVhclJldmVyc2VSZWxhdGVkID0gY2xlYXJSZXZlcnNlUmVsYXRlZDtcbmV4cG9ydHMuc2V0UmV2ZXJzZSA9IHNldFJldmVyc2U7XG5leHBvcnRzLm9iakFzU3RyaW5nID0gb2JqQXNTdHJpbmc7XG5leHBvcnRzLndyYXBBcnJheSA9IHdyYXBBcnJheTtcbmV4cG9ydHMucmVnaXN0ZXJTcGxpY2VDaGFuZ2UgPSByZWdpc3RlclNwbGljZUNoYW5nZTtcbmV4cG9ydHMubWFrZUNoYW5nZXNUb1JlbGF0ZWRXaXRob3V0T2JzZXJ2YXRpb25zID0gbWFrZUNoYW5nZXNUb1JlbGF0ZWRXaXRob3V0T2JzZXJ2YXRpb25zOyIsIi8qKlxuICogQG1vZHVsZSBxdWVyeVxuICovXG5cbnZhciBsb2cgPSByZXF1aXJlKCcuL29wZXJhdGlvbi9sb2cnKVxuICAgICwgY2FjaGUgPSByZXF1aXJlKCcuL2NhY2hlJylcbiAgICAsIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKTtcblxudmFyIExvZ2dlciA9IGxvZy5sb2dnZXJXaXRoTmFtZSgnUXVlcnknKTtcbkxvZ2dlci5zZXRMZXZlbChsb2cuTGV2ZWwud2Fybik7XG5cbi8qKlxuICogQGNsYXNzICBbUXVlcnkgZGVzY3JpcHRpb25dXG4gKiBAcGFyYW0ge01hcHBpbmd9IG1hcHBpbmdcbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRzXG4gKi9cbmZ1bmN0aW9uIFF1ZXJ5KG1hcHBpbmcsIG9wdHMpIHtcbiAgICB0aGlzLm1hcHBpbmcgPSBtYXBwaW5nO1xuICAgIHRoaXMucXVlcnkgPSBvcHRzO1xufVxuXG5fLmV4dGVuZChRdWVyeS5wcm90b3R5cGUsIHtcbiAgICBleGVjdXRlOiBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICAgICAgdmFyIGRlZmVycmVkID0gd2luZG93LnEgPyB3aW5kb3cucS5kZWZlcigpIDogbnVsbDtcbiAgICAgICAgY2FsbGJhY2sgPSB1dGlsLmNvbnN0cnVjdENhbGxiYWNrQW5kUHJvbWlzZUhhbmRsZXIoY2FsbGJhY2ssIGRlZmVycmVkKTtcbiAgICAgICAgdGhpcy5fZXhlY3V0ZUluTWVtb3J5KGNhbGxiYWNrKTtcbiAgICAgICAgcmV0dXJuIGRlZmVycmVkID8gZGVmZXJyZWQucHJvbWlzZSA6IG51bGw7XG4gICAgfSxcbiAgICBfZHVtcDogZnVuY3Rpb24gKGFzSnNvbikge1xuICAgICAgICByZXR1cm4gYXNKc29uID8gJ3t9JyA6IHt9O1xuICAgIH0sXG4gICAgX2V4ZWN1dGVJbk1lbW9yeTogZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgICAgIHZhciBkZWZlcnJlZCA9IHdpbmRvdy5xID8gd2luZG93LnEuZGVmZXIoKSA6IG51bGw7XG4gICAgICAgIGNhbGxiYWNrID0gdXRpbC5jb25zdHJ1Y3RDYWxsYmFja0FuZFByb21pc2VIYW5kbGVyKGNhbGxiYWNrLCBkZWZlcnJlZCk7XG4gICAgICAgIHZhciBjYWNoZUJ5VHlwZSA9IGNhY2hlLl9sb2NhbENhY2hlQnlUeXBlO1xuICAgICAgICB2YXIgbWFwcGluZ05hbWUgPSB0aGlzLm1hcHBpbmcudHlwZTtcbiAgICAgICAgdmFyIGNvbGxlY3Rpb25OYW1lID0gdGhpcy5tYXBwaW5nLmNvbGxlY3Rpb247XG4gICAgICAgIHZhciBjYWNoZUJ5TWFwcGluZyA9IGNhY2hlQnlUeXBlW2NvbGxlY3Rpb25OYW1lXTtcbiAgICAgICAgdmFyIGNhY2hlQnlMb2NhbElkO1xuICAgICAgICBpZiAoY2FjaGVCeU1hcHBpbmcpIHtcbiAgICAgICAgICAgIGNhY2hlQnlMb2NhbElkID0gY2FjaGVCeU1hcHBpbmdbbWFwcGluZ05hbWVdO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjYWNoZUJ5TG9jYWxJZCkge1xuICAgICAgICAgICAgdmFyIGtleXMgPSBPYmplY3Qua2V5cyhjYWNoZUJ5TG9jYWxJZCk7XG4gICAgICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgICAgICB2YXIgcmVzID0gW107XG4gICAgICAgICAgICB2YXIgZXJyO1xuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBrZXlzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgdmFyIGsgPSBrZXlzW2ldO1xuICAgICAgICAgICAgICAgIHZhciBvYmogPSBjYWNoZUJ5TG9jYWxJZFtrXTtcbiAgICAgICAgICAgICAgICB2YXIgbWF0Y2hlcyA9IHNlbGYub2JqZWN0TWF0Y2hlc1F1ZXJ5KG9iaik7XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZihtYXRjaGVzKSA9PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgICAgICBlcnIgPSBtYXRjaGVzO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBpZiAobWF0Y2hlcykgcmVzLnB1c2gob2JqKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYWxsYmFjayhlcnIsIGVyciA/IG51bGwgOiByZXMpO1xuICAgICAgICB9IGVsc2UgaWYgKGNhbGxiYWNrKSB7XG4gICAgICAgICAgICBjYWxsYmFjayhudWxsLCBbXSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGRlZmVycmVkID8gZGVmZXJyZWQucHJvbWlzZSA6IG51bGw7XG4gICAgfSxcbiAgICBvYmplY3RNYXRjaGVzUXVlcnk6IGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgdmFyIGZpZWxkcyA9IE9iamVjdC5rZXlzKHRoaXMucXVlcnkpO1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGZpZWxkcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdmFyIG9yaWdGaWVsZCA9IGZpZWxkc1tpXTtcbiAgICAgICAgICAgIHZhciBzcGx0ID0gb3JpZ0ZpZWxkLnNwbGl0KCdfXycpO1xuICAgICAgICAgICAgdmFyIG9wID0gJ2UnO1xuICAgICAgICAgICAgdmFyIGZpZWxkO1xuICAgICAgICAgICAgaWYgKHNwbHQubGVuZ3RoID09IDIpIHtcbiAgICAgICAgICAgICAgICBmaWVsZCA9IHNwbHRbMF07XG4gICAgICAgICAgICAgICAgb3AgPSBzcGx0WzFdO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBmaWVsZCA9IG9yaWdGaWVsZDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHZhciBxdWVyeU9iaiA9IHRoaXMucXVlcnlbb3JpZ0ZpZWxkXTtcbiAgICAgICAgICAgIHZhciB2YWwgPSBvYmpbZmllbGRdO1xuICAgICAgICAgICAgaWYgKG9wID09ICdlJykge1xuICAgICAgICAgICAgICAgIGlmICh2YWwgIT0gcXVlcnlPYmopIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAob3AgPT0gJ2x0Jykge1xuICAgICAgICAgICAgICAgIGlmICh2YWwgPj0gcXVlcnlPYmopIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAob3AgPT0gJ2x0ZScpIHtcbiAgICAgICAgICAgICAgICBpZiAodmFsID4gcXVlcnlPYmopIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAob3AgPT0gJ2d0Jykge1xuICAgICAgICAgICAgICAgIGlmICh2YWwgPD0gcXVlcnlPYmopIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAob3AgPT0gJ2d0ZScpIHtcbiAgICAgICAgICAgICAgICBpZiAodmFsIDwgcXVlcnlPYmopIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuICdRdWVyeSBvcGVyYXRvciBcIicgKyBvcCArICdcIicgKyAnIGRvZXMgbm90IGV4aXN0JztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG59KTtcblxuZXhwb3J0cy5RdWVyeSA9IFF1ZXJ5OyIsIi8qKlxuICogQG1vZHVsZSByZWxhdGlvbnNoaXBcbiAqL1xuXG4vKipcbiAqIENvbnN0YW50cyB0aGF0IGRlc2NyaWJlIHJlbGF0aW9uc2hpcHMgZm9yIG1hcHBpbmdzLlxuICogQHR5cGUge09iamVjdH1cbiAqL1xuUmVsYXRpb25zaGlwVHlwZSA9IHtcbiAgICBPbmVUb01hbnk6ICdPbmVUb01hbnknLFxuICAgIE9uZVRvT25lOiAnT25lVG9PbmUnLFxuICAgIE1hbnlUb01hbnk6ICdNYW55VG9NYW55J1xufTtcblxuZXhwb3J0cy5SZWxhdGlvbnNoaXBUeXBlID0gUmVsYXRpb25zaGlwVHlwZTsiLCJ2YXIgbG9nID0gcmVxdWlyZSgnLi9vcGVyYXRpb24vbG9nJylcbiAgICAsIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKVxuICAgICwgZGVmaW5lU3ViUHJvcGVydHkgPSB1dGlsLmRlZmluZVN1YlByb3BlcnR5XG4gICAgLCBfID0gdXRpbC5fXG4gICAgLCBlcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKVxuICAgICwgSW50ZXJuYWxTaWVzdGFFcnJvciA9IGVycm9yLkludGVybmFsU2llc3RhRXJyb3JcbiAgICAsIGNvcmVDaGFuZ2VzID0gcmVxdWlyZSgnLi9jaGFuZ2VzJylcbiAgICAsIGNhY2hlID0gcmVxdWlyZSgnLi9jYWNoZScpO1xuXG52YXIgTG9nZ2VyID0gbG9nLmxvZ2dlcldpdGhOYW1lKCdTaWVzdGFNb2RlbCcpO1xuTG9nZ2VyLnNldExldmVsKGxvZy5MZXZlbC53YXJuKTtcblxuZnVuY3Rpb24gU2llc3RhTW9kZWwobWFwcGluZykge1xuICAgIGlmICghdGhpcykge1xuICAgICAgICByZXR1cm4gbmV3IFNpZXN0YU1vZGVsKG1hcHBpbmcpO1xuICAgIH1cbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdGhpcy5tYXBwaW5nID0gbWFwcGluZztcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgJ2lkRmllbGQnLCB7XG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIHNlbGYubWFwcGluZy5pZCB8fCAnaWQnO1xuICAgICAgICB9LFxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICB9KTtcbiAgICBkZWZpbmVTdWJQcm9wZXJ0eS5jYWxsKHRoaXMsICd0eXBlJywgdGhpcy5tYXBwaW5nKTtcbiAgICBkZWZpbmVTdWJQcm9wZXJ0eS5jYWxsKHRoaXMsICdjb2xsZWN0aW9uJywgdGhpcy5tYXBwaW5nKTtcbiAgICBkZWZpbmVTdWJQcm9wZXJ0eS5jYWxsKHRoaXMsICdfZmllbGRzJywgdGhpcy5tYXBwaW5nKTtcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgJ19yZWxhdGlvbnNoaXBGaWVsZHMnLCB7XG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdmFyIHByb3hpZXMgPSBfLm1hcChPYmplY3Qua2V5cyhzZWxmLl9fcHJveGllcyksIGZ1bmN0aW9uICh4KSB7cmV0dXJuIHNlbGYuX19wcm94aWVzW3hdfSk7XG4gICAgICAgICAgICByZXR1cm4gXy5tYXAocHJveGllcywgZnVuY3Rpb24gKHApIHtcbiAgICAgICAgICAgICAgICBpZiAocC5pc0ZvcndhcmQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHAuZm9yd2FyZE5hbWU7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHAucmV2ZXJzZU5hbWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0sXG4gICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgIH0pO1xuXG5cbiAgICB0aGlzLmlzRmF1bHQgPSBmYWxzZTtcblxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCAnaXNTYXZlZCcsIHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gISFzZWxmLl9yZXY7XG4gICAgICAgIH0sXG4gICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgIH0pO1xuXG4gICAgdGhpcy5fcmV2ID0gbnVsbDtcblxuICAgIHRoaXMucmVtb3ZlZCA9IGZhbHNlO1xufVxuXG4vKipcbiAqIEh1bWFuIHJlYWRhYmxlIGR1bXAgb2YgdGhpcyBvYmplY3RcbiAqIEByZXR1cm5zIHsqfVxuICogQHByaXZhdGVcbiAqL1xuXG5fLmV4dGVuZChTaWVzdGFNb2RlbC5wcm90b3R5cGUsIHtcbiAgICBfZHVtcDogZnVuY3Rpb24gKGFzSnNvbikge1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgIHZhciBjbGVhbk9iaiA9IHt9O1xuICAgICAgICBjbGVhbk9iai5tYXBwaW5nID0gdGhpcy5tYXBwaW5nLnR5cGU7XG4gICAgICAgIGNsZWFuT2JqLmNvbGxlY3Rpb24gPSB0aGlzLmNvbGxlY3Rpb247XG4gICAgICAgIGNsZWFuT2JqLl9pZCA9IHRoaXMuX2lkO1xuICAgICAgICBjbGVhbk9iaiA9IF8ucmVkdWNlKHRoaXMuX2ZpZWxkcywgZnVuY3Rpb24gKG1lbW8sIGYpIHtcbiAgICAgICAgICAgIGlmIChzZWxmW2ZdKSB7XG4gICAgICAgICAgICAgICAgbWVtb1tmXSA9IHNlbGZbZl07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gbWVtbztcbiAgICAgICAgfSwgY2xlYW5PYmopO1xuICAgICAgICBjbGVhbk9iaiA9IF8ucmVkdWNlKHRoaXMuX3JlbGF0aW9uc2hpcEZpZWxkcywgZnVuY3Rpb24gKG1lbW8sIGYpIHtcbiAgICAgICAgICAgIHZhciBwcm94eSA9IHNlbGYuX19wcm94aWVzW2ZdO1xuICAgICAgICAgICAgaWYgKHByb3h5KSB7XG4gICAgICAgICAgICAgICAgaWYgKHByb3h5Lmhhc093blByb3BlcnR5KCdfaWQnKSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAodXRpbC5pc0FycmF5KHByb3h5Ll9pZCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzZWxmW2ZdLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1lbW9bZl0gPSBwcm94eS5faWQ7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAocHJveHkuX2lkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBtZW1vW2ZdID0gcHJveHkuX2lkO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgbWVtb1tmXSA9IHNlbGZbZl07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIG1lbW87XG4gICAgICAgIH0sIGNsZWFuT2JqKTtcblxuICAgICAgICByZXR1cm4gYXNKc29uID8gSlNPTi5zdHJpbmdpZnkoY2xlYW5PYmosIG51bGwsIDQpIDogY2xlYW5PYmo7XG4gICAgfSxcbiAgICBnZXQ6IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgICAgICB2YXIgZGVmZXJyZWQgPSB3aW5kb3cucSA/IHdpbmRvdy5xLmRlZmVyKCkgOiBudWxsO1xuICAgICAgICBjYWxsYmFjayA9IHV0aWwuY29uc3RydWN0Q2FsbGJhY2tBbmRQcm9taXNlSGFuZGxlcihjYWxsYmFjaywgZGVmZXJyZWQpO1xuICAgICAgICBjYWxsYmFjayhudWxsLCB0aGlzKTtcbiAgICAgICAgcmV0dXJuIGRlZmVycmVkID8gZGVmZXJyZWQucHJvbWlzZSA6IG51bGw7XG4gICAgfSxcbiAgICByZW1vdmU6IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgICAgICB2YXIgZGVmZXJyZWQgPSB3aW5kb3cucSA/IHdpbmRvdy5xLmRlZmVyKCkgOiBudWxsO1xuICAgICAgICBjYWxsYmFjayA9IHV0aWwuY29uc3RydWN0Q2FsbGJhY2tBbmRQcm9taXNlSGFuZGxlcihjYWxsYmFjaywgZGVmZXJyZWQpO1xuICAgICAgICBjYWNoZS5yZW1vdmUodGhpcyk7XG4gICAgICAgIHRoaXMucmVtb3ZlZCA9IHRydWU7XG4gICAgICAgIGNvcmVDaGFuZ2VzLnJlZ2lzdGVyQ2hhbmdlKHtcbiAgICAgICAgICAgIGNvbGxlY3Rpb246IHRoaXMuY29sbGVjdGlvbixcbiAgICAgICAgICAgIG1hcHBpbmc6IHRoaXMubWFwcGluZy50eXBlLFxuICAgICAgICAgICAgX2lkOiB0aGlzLl9pZCxcbiAgICAgICAgICAgIG9sZElkOiB0aGlzLl9pZCxcbiAgICAgICAgICAgIG9sZDogdGhpcyxcbiAgICAgICAgICAgIHR5cGU6IGNvcmVDaGFuZ2VzLkNoYW5nZVR5cGUuUmVtb3ZlLFxuICAgICAgICAgICAgb2JqOiB0aGlzXG4gICAgICAgIH0pO1xuICAgICAgICBjYWxsYmFjayhudWxsLCB0aGlzKTtcbiAgICAgICAgcmV0dXJuIGRlZmVycmVkID8gZGVmZXJyZWQucHJvbWlzZSA6IG51bGw7XG4gICAgfSxcbiAgICByZXN0b3JlOiBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICAgICAgdmFyIGRlZmVycmVkID0gd2luZG93LnEgPyB3aW5kb3cucS5kZWZlcigpIDogbnVsbDtcbiAgICAgICAgY2FsbGJhY2sgPSB1dGlsLmNvbnN0cnVjdENhbGxiYWNrQW5kUHJvbWlzZUhhbmRsZXIoY2FsbGJhY2ssIGRlZmVycmVkKTtcbiAgICAgICAgaWYgKHRoaXMucmVtb3ZlZCkge1xuICAgICAgICAgICAgY2FjaGUuaW5zZXJ0KHRoaXMpO1xuICAgICAgICAgICAgdGhpcy5yZW1vdmVkID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgY29yZUNoYW5nZXMucmVnaXN0ZXJDaGFuZ2Uoe1xuICAgICAgICAgICAgY29sbGVjdGlvbjogdGhpcy5jb2xsZWN0aW9uLFxuICAgICAgICAgICAgbWFwcGluZzogdGhpcy5tYXBwaW5nLnR5cGUsXG4gICAgICAgICAgICBfaWQ6IHRoaXMuX2lkLFxuICAgICAgICAgICAgbmV3SWQ6IHRoaXMuX2lkLFxuICAgICAgICAgICAgbmV3OiB0aGlzLFxuICAgICAgICAgICAgdHlwZTogY29yZUNoYW5nZXMuQ2hhbmdlVHlwZS5OZXcsXG4gICAgICAgICAgICBvYmo6IHRoaXNcbiAgICAgICAgfSk7XG4gICAgICAgIGNhbGxiYWNrKG51bGwsIHRoaXMpO1xuICAgICAgICByZXR1cm4gZGVmZXJyZWQgPyBkZWZlcnJlZC5wcm9taXNlIDogbnVsbDtcbiAgICB9XG59KTtcblxuZXhwb3J0cy5TaWVzdGFNb2RlbCA9IFNpZXN0YU1vZGVsO1xuZXhwb3J0cy5kdW1wU2F2ZVF1ZXVlcyA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgZHVtcGVkID0ge307XG4gICAgZm9yICh2YXIgaWQgaW4gcXVldWVzKSB7XG4gICAgICAgIGlmIChxdWV1ZXMuaGFzT3duUHJvcGVydHkoaWQpKSB7XG4gICAgICAgICAgICB2YXIgcXVldWUgPSBxdWV1ZXNbaWRdO1xuICAgICAgICAgICAgZHVtcGVkW2lkXSA9IHtcbiAgICAgICAgICAgICAgICBudW1SdW5uaW5nOiBxdWV1ZS5udW1SdW5uaW5nT3BlcmF0aW9ucyxcbiAgICAgICAgICAgICAgICBxdWV1ZWQ6IHF1ZXVlLl9xdWV1ZWRPcGVyYXRpb25zLmxlbmd0aFxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZHVtcGVkO1xufTsiLCIvKipcbiAqIFRoZSBcInN0b3JlXCIgaXMgcmVzcG9uc2libGUgZm9yIG1lZGlhdGluZyBiZXR3ZWVuIHRoZSBpbi1tZW1vcnkgY2FjaGUgYW5kIGFueSBwZXJzaXN0ZW50IHN0b3JhZ2UuXG4gKiBOb3RlIHRoYXQgcGVyc2lzdGVudCBzdG9yYWdlIGhhcyBub3QgYmVlbiBwcm9wZXJseSBpbXBsZW1lbnRlZCB5ZXQgYW5kIHNvIHRoaXMgaXMgcHJldHR5IHVzZWxlc3MuXG4gKiBBbGwgcXVlcmllcyB3aWxsIGdvIHN0cmFpZ2h0IHRvIHRoZSBjYWNoZSBpbnN0ZWFkLlxuICogQG1vZHVsZSBzdG9yZVxuICovXG5cbnZhciBJbnRlcm5hbFNpZXN0YUVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpLkludGVybmFsU2llc3RhRXJyb3JcbiAgICAsIGxvZyA9IHJlcXVpcmUoJy4vb3BlcmF0aW9uL2xvZycpXG4gICAgLCB1dGlsID0gcmVxdWlyZSgnLi91dGlsJylcbiAgICAsIF8gPSB1dGlsLl9cbiAgICAsIGNhY2hlID0gcmVxdWlyZSgnLi9jYWNoZScpO1xuXG5cbnZhciBMb2dnZXIgPSBsb2cubG9nZ2VyV2l0aE5hbWUoJ1N0b3JlJyk7XG5Mb2dnZXIuc2V0TGV2ZWwobG9nLkxldmVsLndhcm4pO1xuXG4vKipcbiAqIFtnZXQgZGVzY3JpcHRpb25dXG4gKiBAcGFyYW0gIHtPYmplY3R9ICAgb3B0c1xuICogQHBhcmFtICB7RnVuY3Rpb259IGNhbGxiYWNrXG4gKiBAcmV0dXJuIHtQcm9taXNlfVxuICogQGV4YW1wbGVcbiAqIGBgYGpzXG4gKiB2YXIgeHl6ID0gJ2Fmc2RmJztcbiAqIGBgYFxuICogQGV4YW1wbGVcbiAqIGBgYGpzXG4gKiB2YXIgYWJjID0gJ2FzZHNkJztcbiAqIGBgYFxuICovXG5mdW5jdGlvbiBnZXQob3B0cywgY2FsbGJhY2spIHtcbiAgICB2YXIgZGVmZXJyZWQgPSB3aW5kb3cucSA/IHdpbmRvdy5xLmRlZmVyKCkgOiBudWxsO1xuICAgIGNhbGxiYWNrID0gdXRpbC5jb25zdHJ1Y3RDYWxsYmFja0FuZFByb21pc2VIYW5kbGVyKGNhbGxiYWNrLCBkZWZlcnJlZCk7XG4gICAgaWYgKExvZ2dlci5kZWJ1Zy5pc0VuYWJsZWQpXG4gICAgICAgIExvZ2dlci5kZWJ1ZygnZ2V0Jywgb3B0cyk7XG4gICAgdmFyIHNpZXN0YU1vZGVsO1xuICAgIGlmIChvcHRzLl9pZCkge1xuICAgICAgICBpZiAodXRpbC5pc0FycmF5KG9wdHMuX2lkKSkge1xuICAgICAgICAgICAgLy8gUHJveHkgb250byBnZXRNdWx0aXBsZSBpbnN0ZWFkLlxuICAgICAgICAgICAgZ2V0TXVsdGlwbGUoXy5tYXAob3B0cy5faWQsIGZ1bmN0aW9uIChpZCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgIF9pZDogaWRcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KSwgY2FsbGJhY2spO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc2llc3RhTW9kZWwgPSBjYWNoZS5nZXQob3B0cyk7XG4gICAgICAgICAgICBpZiAoc2llc3RhTW9kZWwpIHtcbiAgICAgICAgICAgICAgICBpZiAoTG9nZ2VyLmRlYnVnLmlzRW5hYmxlZClcbiAgICAgICAgICAgICAgICAgICAgTG9nZ2VyLmRlYnVnKCdIYWQgY2FjaGVkIG9iamVjdCcsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG9wdHM6IG9wdHMsXG4gICAgICAgICAgICAgICAgICAgICAgICBvYmo6IHNpZXN0YU1vZGVsXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2sobnVsbCwgc2llc3RhTW9kZWwpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZiAodXRpbC5pc0FycmF5KG9wdHMuX2lkKSkge1xuICAgICAgICAgICAgICAgICAgICAvLyBQcm94eSBvbnRvIGdldE11bHRpcGxlIGluc3RlYWQuXG4gICAgICAgICAgICAgICAgICAgIGdldE11bHRpcGxlKF8ubWFwKG9wdHMuX2lkLCBmdW5jdGlvbiAoaWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgX2lkOiBpZFxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9KSwgY2FsbGJhY2spO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHN0b3JhZ2UgPSBzaWVzdGEuZXh0LnN0b3JhZ2U7XG4gICAgICAgICAgICAgICAgICAgIGlmIChzdG9yYWdlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzdG9yYWdlLnN0b3JlLmdldEZyb21Qb3VjaChvcHRzLCBjYWxsYmFjayk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1N0b3JhZ2UgbW9kdWxlIG5vdCBpbnN0YWxsZWQnKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0gZWxzZSBpZiAob3B0cy5tYXBwaW5nKSB7XG4gICAgICAgIGlmICh1dGlsLmlzQXJyYXkob3B0c1tvcHRzLm1hcHBpbmcuaWRdKSkge1xuICAgICAgICAgICAgLy8gUHJveHkgb250byBnZXRNdWx0aXBsZSBpbnN0ZWFkLlxuICAgICAgICAgICAgZ2V0TXVsdGlwbGUoXy5tYXAob3B0c1tvcHRzLm1hcHBpbmcuaWRdLCBmdW5jdGlvbiAoaWQpIHtcbiAgICAgICAgICAgICAgICB2YXIgbyA9IHt9O1xuICAgICAgICAgICAgICAgIG9bb3B0cy5tYXBwaW5nLmlkXSA9IGlkO1xuICAgICAgICAgICAgICAgIG8ubWFwcGluZyA9IG9wdHMubWFwcGluZztcbiAgICAgICAgICAgICAgICByZXR1cm4gb1xuICAgICAgICAgICAgfSksIGNhbGxiYWNrKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHNpZXN0YU1vZGVsID0gY2FjaGUuZ2V0KG9wdHMpO1xuICAgICAgICAgICAgaWYgKHNpZXN0YU1vZGVsKSB7XG4gICAgICAgICAgICAgICAgaWYgKExvZ2dlci5kZWJ1Zy5pc0VuYWJsZWQpXG4gICAgICAgICAgICAgICAgICAgIExvZ2dlci5kZWJ1ZygnSGFkIGNhY2hlZCBvYmplY3QnLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICBvcHRzOiBvcHRzLFxuICAgICAgICAgICAgICAgICAgICAgICAgb2JqOiBzaWVzdGFNb2RlbFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKG51bGwsIHNpZXN0YU1vZGVsKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdmFyIG1hcHBpbmcgPSBvcHRzLm1hcHBpbmc7XG4gICAgICAgICAgICAgICAgaWYgKG1hcHBpbmcuc2luZ2xldG9uKSB7XG4gICAgICAgICAgICAgICAgICAgIG1hcHBpbmcuZ2V0KGNhbGxiYWNrKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB2YXIgaWRGaWVsZCA9IG1hcHBpbmcuaWQ7XG4gICAgICAgICAgICAgICAgICAgIHZhciBpZCA9IG9wdHNbaWRGaWVsZF07XG4gICAgICAgICAgICAgICAgICAgIGlmIChpZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbWFwcGluZy5nZXQoaWQsIGZ1bmN0aW9uIChlcnIsIG9iaikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChvYmopIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIG9iaik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhudWxsLCBudWxsKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignSW52YWxpZCBvcHRpb25zIGdpdmVuIHRvIHN0b3JlLiBNaXNzaW5nIFwiJyArIGlkRmllbGQudG9TdHJpbmcoKSArICcuXCInKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgICAgLy8gTm8gd2F5IGluIHdoaWNoIHRvIGZpbmQgYW4gb2JqZWN0IGxvY2FsbHkuXG4gICAgICAgIHZhciBjb250ZXh0ID0ge1xuICAgICAgICAgICAgb3B0czogb3B0c1xuICAgICAgICB9O1xuICAgICAgICB2YXIgbXNnID0gJ0ludmFsaWQgb3B0aW9ucyBnaXZlbiB0byBzdG9yZSc7XG4gICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKG1zZywgY29udGV4dCk7XG4gICAgfVxuICAgIHJldHVybiBkZWZlcnJlZCA/IGRlZmVycmVkLnByb21pc2UgOiBudWxsO1xufVxuXG5mdW5jdGlvbiBnZXRNdWx0aXBsZShvcHRzQXJyYXksIGNhbGxiYWNrKSB7XG4gICAgdmFyIGRlZmVycmVkID0gd2luZG93LnEgPyB3aW5kb3cucS5kZWZlcigpIDogbnVsbDtcbiAgICBjYWxsYmFjayA9IHV0aWwuY29uc3RydWN0Q2FsbGJhY2tBbmRQcm9taXNlSGFuZGxlcihjYWxsYmFjaywgZGVmZXJyZWQpO1xuICAgIHZhciBkb2NzID0gW107XG4gICAgdmFyIGVycm9ycyA9IFtdO1xuICAgIF8uZWFjaChvcHRzQXJyYXksIGZ1bmN0aW9uIChvcHRzKSB7XG4gICAgICAgIGdldChvcHRzLCBmdW5jdGlvbiAoZXJyLCBkb2MpIHtcbiAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICBlcnJvcnMucHVzaChlcnIpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBkb2NzLnB1c2goZG9jKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChkb2NzLmxlbmd0aCArIGVycm9ycy5sZW5ndGggPT0gb3B0c0FycmF5Lmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIGlmIChjYWxsYmFjaykge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZXJyb3JzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyb3JzKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIGRvY3MpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9KTtcbiAgICByZXR1cm4gZGVmZXJyZWQgPyBkZWZlcnJlZC5wcm9taXNlIDogbnVsbDtcbn1cbi8qKlxuICogVXNlcyBwb3VjaCBidWxrIGZldGNoIEFQSS4gTXVjaCBmYXN0ZXIgdGhhbiBnZXRNdWx0aXBsZS5cbiAqIEBwYXJhbSBsb2NhbElkZW50aWZpZXJzXG4gKiBAcGFyYW0gY2FsbGJhY2tcbiAqL1xuZnVuY3Rpb24gZ2V0TXVsdGlwbGVMb2NhbChsb2NhbElkZW50aWZpZXJzLCBjYWxsYmFjaykge1xuICAgIHZhciBkZWZlcnJlZCA9IHdpbmRvdy5xID8gd2luZG93LnEuZGVmZXIoKSA6IG51bGw7XG4gICAgY2FsbGJhY2sgPSB1dGlsLmNvbnN0cnVjdENhbGxiYWNrQW5kUHJvbWlzZUhhbmRsZXIoY2FsbGJhY2ssIGRlZmVycmVkKTtcbiAgICB2YXIgcmVzdWx0cyA9IF8ucmVkdWNlKGxvY2FsSWRlbnRpZmllcnMsIGZ1bmN0aW9uIChtZW1vLCBfaWQpIHtcbiAgICAgICAgdmFyIG9iaiA9IGNhY2hlLmdldCh7XG4gICAgICAgICAgICBfaWQ6IF9pZFxuICAgICAgICB9KTtcbiAgICAgICAgaWYgKG9iaikge1xuICAgICAgICAgICAgbWVtby5jYWNoZWRbX2lkXSA9IG9iajtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG1lbW8ubm90Q2FjaGVkLnB1c2goX2lkKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbWVtbztcbiAgICB9LCB7XG4gICAgICAgIGNhY2hlZDoge30sXG4gICAgICAgIG5vdENhY2hlZDogW11cbiAgICB9KTtcblxuICAgIGZ1bmN0aW9uIGZpbmlzaChlcnIpIHtcbiAgICAgICAgaWYgKGNhbGxiYWNrKSB7XG4gICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2sobnVsbCwgXy5tYXAobG9jYWxJZGVudGlmaWVycywgZnVuY3Rpb24gKF9pZCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gcmVzdWx0cy5jYWNoZWRbX2lkXTtcbiAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoc2llc3RhLmV4dC5zdG9yYWdlRW5hYmxlZCAmJiByZXN1bHRzLm5vdENhY2hlZC5sZW5ndGgpIHtcbiAgICAgICAgc2llc3RhLmV4dC5zdG9yYWdlLnN0b3JlLmdldE11bHRpcGxlTG9jYWxGcm9tQ291Y2gocmVzdWx0cywgZmluaXNoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBmaW5pc2goKTtcbiAgICB9XG4gICAgcmV0dXJuIGRlZmVycmVkID8gZGVmZXJyZWQucHJvbWlzZSA6IG51bGw7XG59XG5cbmZ1bmN0aW9uIGdldE11bHRpcGxlUmVtb3RlKHJlbW90ZUlkZW50aWZpZXJzLCBtYXBwaW5nLCBjYWxsYmFjaykge1xuICAgIHZhciBkZWZlcnJlZCA9IHdpbmRvdy5xID8gd2luZG93LnEuZGVmZXIoKSA6IG51bGw7XG4gICAgY2FsbGJhY2sgPSB1dGlsLmNvbnN0cnVjdENhbGxiYWNrQW5kUHJvbWlzZUhhbmRsZXIoY2FsbGJhY2ssIGRlZmVycmVkKTtcbiAgICB2YXIgcmVzdWx0cyA9IF8ucmVkdWNlKHJlbW90ZUlkZW50aWZpZXJzLCBmdW5jdGlvbiAobWVtbywgaWQpIHtcbiAgICAgICAgdmFyIGNhY2hlUXVlcnkgPSB7XG4gICAgICAgICAgICBtYXBwaW5nOiBtYXBwaW5nXG4gICAgICAgIH07XG4gICAgICAgIGNhY2hlUXVlcnlbbWFwcGluZy5pZF0gPSBpZDtcbiAgICAgICAgdmFyIG9iaiA9IGNhY2hlLmdldChjYWNoZVF1ZXJ5KTtcbiAgICAgICAgaWYgKG9iaikge1xuICAgICAgICAgICAgbWVtby5jYWNoZWRbaWRdID0gb2JqO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbWVtby5ub3RDYWNoZWQucHVzaChpZCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG1lbW87XG4gICAgfSwge1xuICAgICAgICBjYWNoZWQ6IHt9LFxuICAgICAgICBub3RDYWNoZWQ6IFtdXG4gICAgfSk7XG5cbiAgICBmdW5jdGlvbiBmaW5pc2goZXJyKSB7XG4gICAgICAgIGlmIChjYWxsYmFjaykge1xuICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIF8ubWFwKHJlbW90ZUlkZW50aWZpZXJzLCBmdW5jdGlvbiAoaWQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHJlc3VsdHMuY2FjaGVkW2lkXTtcbiAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoc2llc3RhLmV4dC5zdG9yYWdlRW5hYmxlZCAmJiByZXN1bHRzLm5vdENhY2hlZC5sZW5ndGgpIHtcbiAgICAgICAgc2llc3RhLmV4dC5zdG9yYWdlLnN0b3JlLmdldE11bHRpcGxlUmVtb3RlRnJvbXBvdWNoKG1hcHBpbmcsIHJlbW90ZUlkZW50aWZpZXJzLCByZXN1bHRzLCBmaW5pc2gpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGZpbmlzaCgpO1xuICAgIH1cbiAgICByZXR1cm4gZGVmZXJyZWQgPyBkZWZlcnJlZC5wcm9taXNlIDogbnVsbDtcbn1cblxuZXhwb3J0cy5nZXQgPSBnZXQ7XG5leHBvcnRzLmdldE11bHRpcGxlID0gZ2V0TXVsdGlwbGU7XG5leHBvcnRzLmdldE11bHRpcGxlTG9jYWwgPSBnZXRNdWx0aXBsZUxvY2FsO1xuZXhwb3J0cy5nZXRNdWx0aXBsZVJlbW90ZSA9IGdldE11bHRpcGxlUmVtb3RlOyIsIi8qXG4gKiBUaGlzIGlzIGEgY29sbGVjdGlvbiBvZiB1dGlsaXRpZXMgdGFrZW4gZnJvbSBsaWJyYXJpZXMgc3VjaCBhcyBhc3luYy5qcywgdW5kZXJzY29yZS5qcyBldGMuXG4gKiBAbW9kdWxlIHV0aWxcbiAqL1xuXG5mdW5jdGlvbiBwcmludFN0YWNrVHJhY2UoKSB7XG4gICAgdmFyIGUgPSBuZXcgRXJyb3IoJ3ByaW50U3RhY2tUcmFjZScpO1xuICAgIHZhciBzdGFjayA9IGUuc3RhY2s7XG4gICAgY29uc29sZS5sb2coc3RhY2spO1xufVxuXG5mdW5jdGlvbiBjYXBpdGFsaXNlRmlyc3RMZXR0ZXIoc3RyaW5nKSB7XG4gICAgcmV0dXJuIHN0cmluZy5jaGFyQXQoMCkudG9VcHBlckNhc2UoKSArIHN0cmluZy5zbGljZSgxKTtcbn1cblxuXG5leHBvcnRzLnByaW50U3RhY2tUcmFjZSA9IHByaW50U3RhY2tUcmFjZTtcbmV4cG9ydHMuY2FwaXRhbGlzZUZpcnN0TGV0dGVyID0gY2FwaXRhbGlzZUZpcnN0TGV0dGVyO1xuXG52YXIgcm9vdCA9IHt9O1xuLy8gU1RBUlQgYXN5bmMuanMgLy9cblxudmFyIGlzQXJyYXkgPSBBcnJheS5pc0FycmF5IHx8IGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgcmV0dXJuIF90b1N0cmluZy5jYWxsKG9iaikgPT09ICdbb2JqZWN0IEFycmF5XSc7XG4gICAgfTtcblxuZnVuY3Rpb24gZG9QYXJhbGxlbChmbikge1xuICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKTtcbiAgICAgICAgcmV0dXJuIGZuLmFwcGx5KG51bGwsIFtlYWNoXS5jb25jYXQoYXJncykpO1xuICAgIH07XG59XG5cbnZhciBtYXAgPSBkb1BhcmFsbGVsKF9hc3luY01hcCk7XG5cbmZ1bmN0aW9uIF9tYXAoYXJyLCBpdGVyYXRvcikge1xuICAgIGlmIChhcnIubWFwKSB7XG4gICAgICAgIHJldHVybiBhcnIubWFwKGl0ZXJhdG9yKTtcbiAgICB9XG4gICAgdmFyIHJlc3VsdHMgPSBbXTtcbiAgICBlYWNoKGFyciwgZnVuY3Rpb24gKHgsIGksIGEpIHtcbiAgICAgICAgcmVzdWx0cy5wdXNoKGl0ZXJhdG9yKHgsIGksIGEpKTtcbiAgICB9KTtcbiAgICByZXR1cm4gcmVzdWx0cztcbn1cblxuZnVuY3Rpb24gX2FzeW5jTWFwKGVhY2hmbiwgYXJyLCBpdGVyYXRvciwgY2FsbGJhY2spIHtcbiAgICBhcnIgPSBfbWFwKGFyciwgZnVuY3Rpb24gKHgsIGkpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGluZGV4OiBpLFxuICAgICAgICAgICAgdmFsdWU6IHhcbiAgICAgICAgfTtcbiAgICB9KTtcbiAgICBpZiAoIWNhbGxiYWNrKSB7XG4gICAgICAgIGVhY2hmbihhcnIsIGZ1bmN0aW9uICh4LCBjYWxsYmFjaykge1xuICAgICAgICAgICAgaXRlcmF0b3IoeC52YWx1ZSwgZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdmFyIHJlc3VsdHMgPSBbXTtcbiAgICAgICAgZWFjaGZuKGFyciwgZnVuY3Rpb24gKHgsIGNhbGxiYWNrKSB7XG4gICAgICAgICAgICBpdGVyYXRvcih4LnZhbHVlLCBmdW5jdGlvbiAoZXJyLCB2KSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0c1t4LmluZGV4XSA9IHY7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9LCBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICBjYWxsYmFjayhlcnIsIHJlc3VsdHMpO1xuICAgICAgICB9KTtcbiAgICB9XG59XG5cbnZhciBtYXBTZXJpZXMgPSBkb1NlcmllcyhfYXN5bmNNYXApO1xuXG5mdW5jdGlvbiBkb1Nlcmllcyhmbikge1xuICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKTtcbiAgICAgICAgcmV0dXJuIGZuLmFwcGx5KG51bGwsIFtlYWNoU2VyaWVzXS5jb25jYXQoYXJncykpO1xuICAgIH07XG59XG5cblxuZnVuY3Rpb24gZWFjaFNlcmllcyhhcnIsIGl0ZXJhdG9yLCBjYWxsYmFjaykge1xuICAgIGNhbGxiYWNrID0gY2FsbGJhY2sgfHwgZnVuY3Rpb24gKCkge307XG4gICAgaWYgKCFhcnIubGVuZ3RoKSB7XG4gICAgICAgIHJldHVybiBjYWxsYmFjaygpO1xuICAgIH1cbiAgICB2YXIgY29tcGxldGVkID0gMDtcbiAgICB2YXIgaXRlcmF0ZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgaXRlcmF0b3IoYXJyW2NvbXBsZXRlZF0sIGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrID0gZnVuY3Rpb24gKCkge307XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbXBsZXRlZCArPSAxO1xuICAgICAgICAgICAgICAgIGlmIChjb21wbGV0ZWQgPj0gYXJyLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGl0ZXJhdGUoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH07XG4gICAgaXRlcmF0ZSgpO1xufVxuXG5cbmZ1bmN0aW9uIF9lYWNoKGFyciwgaXRlcmF0b3IpIHtcbiAgICBpZiAoYXJyLmZvckVhY2gpIHtcbiAgICAgICAgcmV0dXJuIGFyci5mb3JFYWNoKGl0ZXJhdG9yKTtcbiAgICB9XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBhcnIubGVuZ3RoOyBpICs9IDEpIHtcbiAgICAgICAgaXRlcmF0b3IoYXJyW2ldLCBpLCBhcnIpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gZWFjaChhcnIsIGl0ZXJhdG9yLCBjYWxsYmFjaykge1xuICAgIGNhbGxiYWNrID0gY2FsbGJhY2sgfHwgZnVuY3Rpb24gKCkge307XG4gICAgaWYgKCFhcnIubGVuZ3RoKSB7XG4gICAgICAgIHJldHVybiBjYWxsYmFjaygpO1xuICAgIH1cbiAgICB2YXIgY29tcGxldGVkID0gMDtcbiAgICBfZWFjaChhcnIsIGZ1bmN0aW9uICh4KSB7XG4gICAgICAgIGl0ZXJhdG9yKHgsIG9ubHlfb25jZShkb25lKSk7XG4gICAgfSk7XG5cbiAgICBmdW5jdGlvbiBkb25lKGVycikge1xuICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgY2FsbGJhY2sgPSBmdW5jdGlvbiAoKSB7fTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbXBsZXRlZCArPSAxO1xuICAgICAgICAgICAgaWYgKGNvbXBsZXRlZCA+PSBhcnIubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn1cblxuZnVuY3Rpb24ga2V5cyhvYmopIHtcbiAgICBpZiAoT2JqZWN0LmtleXMpIHtcbiAgICAgICAgcmV0dXJuIE9iamVjdC5rZXlzKG9iaik7XG4gICAgfVxuICAgIHZhciBrZXlzID0gW107XG4gICAgZm9yICh2YXIgayBpbiBvYmopIHtcbiAgICAgICAgaWYgKG9iai5oYXNPd25Qcm9wZXJ0eShrKSkge1xuICAgICAgICAgICAga2V5cy5wdXNoKGspO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBrZXlzO1xufVxuXG5cbnZhciBfcGFyYWxsZWwgPSBmdW5jdGlvbiAoZWFjaGZuLCB0YXNrcywgY2FsbGJhY2spIHtcbiAgICBjYWxsYmFjayA9IGNhbGxiYWNrIHx8IGZ1bmN0aW9uICgpIHt9O1xuICAgIGlmIChpc0FycmF5KHRhc2tzKSkge1xuICAgICAgICBlYWNoZm4ubWFwKHRhc2tzLCBmdW5jdGlvbiAoZm4sIGNhbGxiYWNrKSB7XG4gICAgICAgICAgICBpZiAoZm4pIHtcbiAgICAgICAgICAgICAgICBmbihmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGFyZ3MubGVuZ3RoIDw9IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFyZ3MgPSBhcmdzWzBdO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrLmNhbGwobnVsbCwgZXJyLCBhcmdzKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSwgY2FsbGJhY2spO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHZhciByZXN1bHRzID0ge307XG4gICAgICAgIGVhY2hmbi5lYWNoKGtleXModGFza3MpLCBmdW5jdGlvbiAoaywgY2FsbGJhY2spIHtcbiAgICAgICAgICAgIHRhc2tzW2tdKGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgICAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgICAgICAgICAgICAgaWYgKGFyZ3MubGVuZ3RoIDw9IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgYXJncyA9IGFyZ3NbMF07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJlc3VsdHNba10gPSBhcmdzO1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSwgZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgY2FsbGJhY2soZXJyLCByZXN1bHRzKTtcbiAgICAgICAgfSk7XG4gICAgfVxufTtcblxuZnVuY3Rpb24gc2VyaWVzKHRhc2tzLCBjYWxsYmFjaykge1xuICAgIGNhbGxiYWNrID0gY2FsbGJhY2sgfHwgZnVuY3Rpb24gKCkge307XG4gICAgaWYgKF9pc0FycmF5KHRhc2tzKSkge1xuICAgICAgICBtYXBTZXJpZXModGFza3MsIGZ1bmN0aW9uIChmbiwgY2FsbGJhY2spIHtcbiAgICAgICAgICAgIGlmIChmbikge1xuICAgICAgICAgICAgICAgIGZuKGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoYXJncy5sZW5ndGggPD0gMSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgYXJncyA9IGFyZ3NbMF07XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2suY2FsbChudWxsLCBlcnIsIGFyZ3MpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LCBjYWxsYmFjayk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdmFyIHJlc3VsdHMgPSB7fTtcbiAgICAgICAgZWFjaFNlcmllcyhfa2V5cyh0YXNrcyksIGZ1bmN0aW9uIChrLCBjYWxsYmFjaykge1xuICAgICAgICAgICAgdGFza3Nba10oZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICAgICAgICAgICAgICBpZiAoYXJncy5sZW5ndGggPD0gMSkge1xuICAgICAgICAgICAgICAgICAgICBhcmdzID0gYXJnc1swXTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmVzdWx0c1trXSA9IGFyZ3M7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9LCBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICBjYWxsYmFjayhlcnIsIHJlc3VsdHMpO1xuICAgICAgICB9KTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIG9ubHlfb25jZShmbikge1xuICAgIHZhciBjYWxsZWQgPSBmYWxzZTtcbiAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAoY2FsbGVkKSB0aHJvdyBuZXcgRXJyb3IoXCJDYWxsYmFjayB3YXMgYWxyZWFkeSBjYWxsZWQuXCIpO1xuICAgICAgICBjYWxsZWQgPSB0cnVlO1xuICAgICAgICBmbi5hcHBseShyb290LCBhcmd1bWVudHMpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gcGFyYWxsZWwodGFza3MsIGNhbGxiYWNrKSB7XG4gICAgX3BhcmFsbGVsKHtcbiAgICAgICAgbWFwOiBtYXAsXG4gICAgICAgIGVhY2g6IGVhY2hcbiAgICB9LCB0YXNrcywgY2FsbGJhY2spO1xufVxuXG5leHBvcnRzLnNlcmllcyA9IHNlcmllcztcbmV4cG9ydHMucGFyYWxsZWwgPSBwYXJhbGxlbDtcbmV4cG9ydHMuaXNBcnJheSA9IGlzQXJyYXk7XG5cbi8vIEVORCBhc3luYy5qcyAvL1xuXG4vLyBTVEFSVCB1bmRlcnNjb3JlLmpzIC8vXG5cbnZhciBfID0ge307XG52YXIgQXJyYXlQcm90byA9IEFycmF5LnByb3RvdHlwZTtcbnZhciBGdW5jUHJvdG8gPSBGdW5jdGlvbi5wcm90b3R5cGU7XG5cbnZhciBuYXRpdmVGb3JFYWNoID0gQXJyYXlQcm90by5mb3JFYWNoO1xudmFyIG5hdGl2ZU1hcCA9IEFycmF5UHJvdG8ubWFwO1xudmFyIG5hdGl2ZVJlZHVjZSA9IEFycmF5UHJvdG8ucmVkdWNlO1xudmFyIG5hdGl2ZUJpbmQgPSBGdW5jUHJvdG8uYmluZDtcbnZhciBzbGljZSA9IEFycmF5UHJvdG8uc2xpY2U7XG52YXIgYnJlYWtlciA9IHt9O1xuXG5fLmtleXMgPSBrZXlzO1xuXG5fLmVhY2ggPSBfLmZvckVhY2ggPSBmdW5jdGlvbiAob2JqLCBpdGVyYXRvciwgY29udGV4dCkge1xuICAgIGlmIChvYmogPT0gbnVsbCkgcmV0dXJuIG9iajtcbiAgICBpZiAobmF0aXZlRm9yRWFjaCAmJiBvYmouZm9yRWFjaCA9PT0gbmF0aXZlRm9yRWFjaCkge1xuICAgICAgICBvYmouZm9yRWFjaChpdGVyYXRvciwgY29udGV4dCk7XG4gICAgfSBlbHNlIGlmIChvYmoubGVuZ3RoID09PSArb2JqLmxlbmd0aCkge1xuICAgICAgICBmb3IgKHZhciBpID0gMCwgbGVuZ3RoID0gb2JqLmxlbmd0aDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAoaXRlcmF0b3IuY2FsbChjb250ZXh0LCBvYmpbaV0sIGksIG9iaikgPT09IGJyZWFrZXIpIHJldHVybjtcbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIHZhciBrZXlzID0gXy5rZXlzKG9iaik7XG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBsZW5ndGggPSBrZXlzLmxlbmd0aDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAoaXRlcmF0b3IuY2FsbChjb250ZXh0LCBvYmpba2V5c1tpXV0sIGtleXNbaV0sIG9iaikgPT09IGJyZWFrZXIpIHJldHVybjtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gb2JqO1xufTtcblxuLy8gUmV0dXJuIHRoZSByZXN1bHRzIG9mIGFwcGx5aW5nIHRoZSBpdGVyYXRvciB0byBlYWNoIGVsZW1lbnQuXG4vLyBEZWxlZ2F0ZXMgdG8gKipFQ01BU2NyaXB0IDUqKidzIG5hdGl2ZSBgbWFwYCBpZiBhdmFpbGFibGUuXG5fLm1hcCA9IF8uY29sbGVjdCA9IGZ1bmN0aW9uIChvYmosIGl0ZXJhdG9yLCBjb250ZXh0KSB7XG4gICAgdmFyIHJlc3VsdHMgPSBbXTtcbiAgICBpZiAob2JqID09IG51bGwpIHJldHVybiByZXN1bHRzO1xuICAgIGlmIChuYXRpdmVNYXAgJiYgb2JqLm1hcCA9PT0gbmF0aXZlTWFwKSByZXR1cm4gb2JqLm1hcChpdGVyYXRvciwgY29udGV4dCk7XG4gICAgXy5lYWNoKG9iaiwgZnVuY3Rpb24gKHZhbHVlLCBpbmRleCwgbGlzdCkge1xuICAgICAgICByZXN1bHRzLnB1c2goaXRlcmF0b3IuY2FsbChjb250ZXh0LCB2YWx1ZSwgaW5kZXgsIGxpc3QpKTtcbiAgICB9KTtcbiAgICByZXR1cm4gcmVzdWx0cztcbn07XG5cbi8vIFBhcnRpYWxseSBhcHBseSBhIGZ1bmN0aW9uIGJ5IGNyZWF0aW5nIGEgdmVyc2lvbiB0aGF0IGhhcyBoYWQgc29tZSBvZiBpdHNcbi8vIGFyZ3VtZW50cyBwcmUtZmlsbGVkLCB3aXRob3V0IGNoYW5naW5nIGl0cyBkeW5hbWljIGB0aGlzYCBjb250ZXh0LiBfIGFjdHNcbi8vIGFzIGEgcGxhY2Vob2xkZXIsIGFsbG93aW5nIGFueSBjb21iaW5hdGlvbiBvZiBhcmd1bWVudHMgdG8gYmUgcHJlLWZpbGxlZC5cbl8ucGFydGlhbCA9IGZ1bmN0aW9uIChmdW5jKSB7XG4gICAgdmFyIGJvdW5kQXJncyA9IHNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgcG9zaXRpb24gPSAwO1xuICAgICAgICB2YXIgYXJncyA9IGJvdW5kQXJncy5zbGljZSgpO1xuICAgICAgICBmb3IgKHZhciBpID0gMCwgbGVuZ3RoID0gYXJncy5sZW5ndGg7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaWYgKGFyZ3NbaV0gPT09IF8pIGFyZ3NbaV0gPSBhcmd1bWVudHNbcG9zaXRpb24rK107XG4gICAgICAgIH1cbiAgICAgICAgd2hpbGUgKHBvc2l0aW9uIDwgYXJndW1lbnRzLmxlbmd0aCkgYXJncy5wdXNoKGFyZ3VtZW50c1twb3NpdGlvbisrXSk7XG4gICAgICAgIHJldHVybiBmdW5jLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgIH07XG59O1xuXG4vLyBDb252ZW5pZW5jZSB2ZXJzaW9uIG9mIGEgY29tbW9uIHVzZSBjYXNlIG9mIGBtYXBgOiBmZXRjaGluZyBhIHByb3BlcnR5LlxuXy5wbHVjayA9IGZ1bmN0aW9uIChvYmosIGtleSkge1xuICAgIHJldHVybiBfLm1hcChvYmosIF8ucHJvcGVydHkoa2V5KSk7XG59O1xuXG52YXIgcmVkdWNlRXJyb3IgPSAnUmVkdWNlIG9mIGVtcHR5IGFycmF5IHdpdGggbm8gaW5pdGlhbCB2YWx1ZSc7XG5cbi8vICoqUmVkdWNlKiogYnVpbGRzIHVwIGEgc2luZ2xlIHJlc3VsdCBmcm9tIGEgbGlzdCBvZiB2YWx1ZXMsIGFrYSBgaW5qZWN0YCxcbi8vIG9yIGBmb2xkbGAuIERlbGVnYXRlcyB0byAqKkVDTUFTY3JpcHQgNSoqJ3MgbmF0aXZlIGByZWR1Y2VgIGlmIGF2YWlsYWJsZS5cbl8ucmVkdWNlID0gXy5mb2xkbCA9IF8uaW5qZWN0ID0gZnVuY3Rpb24gKG9iaiwgaXRlcmF0b3IsIG1lbW8sIGNvbnRleHQpIHtcbiAgICB2YXIgaW5pdGlhbCA9IGFyZ3VtZW50cy5sZW5ndGggPiAyO1xuICAgIGlmIChvYmogPT0gbnVsbCkgb2JqID0gW107XG4gICAgaWYgKG5hdGl2ZVJlZHVjZSAmJiBvYmoucmVkdWNlID09PSBuYXRpdmVSZWR1Y2UpIHtcbiAgICAgICAgaWYgKGNvbnRleHQpIGl0ZXJhdG9yID0gXy5iaW5kKGl0ZXJhdG9yLCBjb250ZXh0KTtcbiAgICAgICAgcmV0dXJuIGluaXRpYWwgPyBvYmoucmVkdWNlKGl0ZXJhdG9yLCBtZW1vKSA6IG9iai5yZWR1Y2UoaXRlcmF0b3IpO1xuICAgIH1cbiAgICBfLmVhY2gob2JqLCBmdW5jdGlvbiAodmFsdWUsIGluZGV4LCBsaXN0KSB7XG4gICAgICAgIGlmICghaW5pdGlhbCkge1xuICAgICAgICAgICAgbWVtbyA9IHZhbHVlO1xuICAgICAgICAgICAgaW5pdGlhbCA9IHRydWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBtZW1vID0gaXRlcmF0b3IuY2FsbChjb250ZXh0LCBtZW1vLCB2YWx1ZSwgaW5kZXgsIGxpc3QpO1xuICAgICAgICB9XG4gICAgfSk7XG4gICAgaWYgKCFpbml0aWFsKSB0aHJvdyBuZXcgVHlwZUVycm9yKHJlZHVjZUVycm9yKTtcbiAgICByZXR1cm4gbWVtbztcbn07XG5cbl8ucHJvcGVydHkgPSBmdW5jdGlvbiAoa2V5KSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgcmV0dXJuIG9ialtrZXldO1xuICAgIH07XG59O1xuXG4vLyBPcHRpbWl6ZSBgaXNGdW5jdGlvbmAgaWYgYXBwcm9wcmlhdGUuXG5pZiAodHlwZW9mKC8uLykgIT09ICdmdW5jdGlvbicpIHtcbiAgICBfLmlzRnVuY3Rpb24gPSBmdW5jdGlvbiAob2JqKSB7XG4gICAgICAgIHJldHVybiB0eXBlb2Ygb2JqID09PSAnZnVuY3Rpb24nO1xuICAgIH07XG59XG5cbl8uaXNPYmplY3QgPSBmdW5jdGlvbiAob2JqKSB7XG4gICAgdmFyIHR5cGUgPSB0eXBlb2Ygb2JqO1xuICAgIHJldHVybiB0eXBlID09PSAnZnVuY3Rpb24nIHx8IHR5cGUgPT09ICdvYmplY3QnICYmICEhb2JqO1xufTtcblxuLy8gQW4gaW50ZXJuYWwgZnVuY3Rpb24gdG8gZ2VuZXJhdGUgbG9va3VwIGl0ZXJhdG9ycy5cbnZhciBsb29rdXBJdGVyYXRvciA9IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgIGlmICh2YWx1ZSA9PSBudWxsKSByZXR1cm4gXy5pZGVudGl0eTtcbiAgICBpZiAoXy5pc0Z1bmN0aW9uKHZhbHVlKSkgcmV0dXJuIHZhbHVlO1xuICAgIHJldHVybiBfLnByb3BlcnR5KHZhbHVlKTtcbn07XG5cbi8vIFNvcnQgdGhlIG9iamVjdCdzIHZhbHVlcyBieSBhIGNyaXRlcmlvbiBwcm9kdWNlZCBieSBhbiBpdGVyYXRvci5cbl8uc29ydEJ5ID0gZnVuY3Rpb24gKG9iaiwgaXRlcmF0b3IsIGNvbnRleHQpIHtcbiAgICBpdGVyYXRvciA9IGxvb2t1cEl0ZXJhdG9yKGl0ZXJhdG9yKTtcbiAgICByZXR1cm4gXy5wbHVjayhfLm1hcChvYmosIGZ1bmN0aW9uICh2YWx1ZSwgaW5kZXgsIGxpc3QpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHZhbHVlOiB2YWx1ZSxcbiAgICAgICAgICAgIGluZGV4OiBpbmRleCxcbiAgICAgICAgICAgIGNyaXRlcmlhOiBpdGVyYXRvci5jYWxsKGNvbnRleHQsIHZhbHVlLCBpbmRleCwgbGlzdClcbiAgICAgICAgfTtcbiAgICB9KS5zb3J0KGZ1bmN0aW9uIChsZWZ0LCByaWdodCkge1xuICAgICAgICB2YXIgYSA9IGxlZnQuY3JpdGVyaWE7XG4gICAgICAgIHZhciBiID0gcmlnaHQuY3JpdGVyaWE7XG4gICAgICAgIGlmIChhICE9PSBiKSB7XG4gICAgICAgICAgICBpZiAoYSA+IGIgfHwgYSA9PT0gdm9pZCAwKSByZXR1cm4gMTtcbiAgICAgICAgICAgIGlmIChhIDwgYiB8fCBiID09PSB2b2lkIDApIHJldHVybiAtMTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbGVmdC5pbmRleCAtIHJpZ2h0LmluZGV4O1xuICAgIH0pLCAndmFsdWUnKTtcbn07XG5cbnZhciBjdG9yID0gZnVuY3Rpb24gKCkge307XG5cbi8vIENyZWF0ZSBhIGZ1bmN0aW9uIGJvdW5kIHRvIGEgZ2l2ZW4gb2JqZWN0IChhc3NpZ25pbmcgYHRoaXNgLCBhbmQgYXJndW1lbnRzLFxuLy8gb3B0aW9uYWxseSkuIERlbGVnYXRlcyB0byAqKkVDTUFTY3JpcHQgNSoqJ3MgbmF0aXZlIGBGdW5jdGlvbi5iaW5kYCBpZlxuLy8gYXZhaWxhYmxlLlxuXy5iaW5kID0gZnVuY3Rpb24gKGZ1bmMsIGNvbnRleHQpIHtcbiAgICB2YXIgYXJncywgYm91bmQ7XG4gICAgaWYgKG5hdGl2ZUJpbmQgJiYgZnVuYy5iaW5kID09PSBuYXRpdmVCaW5kKSByZXR1cm4gbmF0aXZlQmluZC5hcHBseShmdW5jLCBzbGljZS5jYWxsKGFyZ3VtZW50cywgMSkpO1xuICAgIGlmICghXy5pc0Z1bmN0aW9uKGZ1bmMpKSB0aHJvdyBuZXcgVHlwZUVycm9yO1xuICAgIGFyZ3MgPSBzbGljZS5jYWxsKGFyZ3VtZW50cywgMik7XG4gICAgcmV0dXJuIGJvdW5kID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAoISh0aGlzIGluc3RhbmNlb2YgYm91bmQpKSByZXR1cm4gZnVuYy5hcHBseShjb250ZXh0LCBhcmdzLmNvbmNhdChzbGljZS5jYWxsKGFyZ3VtZW50cykpKTtcbiAgICAgICAgY3Rvci5wcm90b3R5cGUgPSBmdW5jLnByb3RvdHlwZTtcbiAgICAgICAgdmFyIHNlbGYgPSBuZXcgY3RvcjtcbiAgICAgICAgY3Rvci5wcm90b3R5cGUgPSBudWxsO1xuICAgICAgICB1XG4gICAgICAgIHZhciByZXN1bHQgPSBmdW5jLmFwcGx5KHNlbGYsIGFyZ3MuY29uY2F0KHNsaWNlLmNhbGwoYXJndW1lbnRzKSkpO1xuICAgICAgICBpZiAoT2JqZWN0KHJlc3VsdCkgPT09IHJlc3VsdCkgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgcmV0dXJuIHNlbGY7XG4gICAgfTtcbn07XG5cbl8uaWRlbnRpdHkgPSBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICByZXR1cm4gdmFsdWU7XG59O1xuXG5fLnppcCA9IGZ1bmN0aW9uIChhcnJheSkge1xuICAgIGlmIChhcnJheSA9PSBudWxsKSByZXR1cm4gW107XG4gICAgdmFyIGxlbmd0aCA9IF8ubWF4KGFyZ3VtZW50cywgJ2xlbmd0aCcpLmxlbmd0aDtcbiAgICB2YXIgcmVzdWx0cyA9IEFycmF5KGxlbmd0aCk7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgICByZXN1bHRzW2ldID0gXy5wbHVjayhhcmd1bWVudHMsIGkpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0cztcbn07XG5cbi8vIFJldHVybiB0aGUgbWF4aW11bSBlbGVtZW50IChvciBlbGVtZW50LWJhc2VkIGNvbXB1dGF0aW9uKS5cbl8ubWF4ID0gZnVuY3Rpb24gKG9iaiwgaXRlcmF0ZWUsIGNvbnRleHQpIHtcbiAgICB2YXIgcmVzdWx0ID0gLUluZmluaXR5LFxuICAgICAgICBsYXN0Q29tcHV0ZWQgPSAtSW5maW5pdHksXG4gICAgICAgIHZhbHVlLCBjb21wdXRlZDtcbiAgICBpZiAoaXRlcmF0ZWUgPT0gbnVsbCAmJiBvYmogIT0gbnVsbCkge1xuICAgICAgICBvYmogPSBvYmoubGVuZ3RoID09PSArb2JqLmxlbmd0aCA/IG9iaiA6IF8udmFsdWVzKG9iaik7XG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBsZW5ndGggPSBvYmoubGVuZ3RoOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHZhbHVlID0gb2JqW2ldO1xuICAgICAgICAgICAgaWYgKHZhbHVlID4gcmVzdWx0KSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0ID0gdmFsdWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgICBpdGVyYXRlZSA9IF8uaXRlcmF0ZWUoaXRlcmF0ZWUsIGNvbnRleHQpO1xuICAgICAgICBfLmVhY2gob2JqLCBmdW5jdGlvbiAodmFsdWUsIGluZGV4LCBsaXN0KSB7XG4gICAgICAgICAgICBjb21wdXRlZCA9IGl0ZXJhdGVlKHZhbHVlLCBpbmRleCwgbGlzdCk7XG4gICAgICAgICAgICBpZiAoY29tcHV0ZWQgPiBsYXN0Q29tcHV0ZWQgfHwgY29tcHV0ZWQgPT09IC1JbmZpbml0eSAmJiByZXN1bHQgPT09IC1JbmZpbml0eSkge1xuICAgICAgICAgICAgICAgIHJlc3VsdCA9IHZhbHVlO1xuICAgICAgICAgICAgICAgIGxhc3RDb21wdXRlZCA9IGNvbXB1dGVkO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbn07XG5cblxuXy5pdGVyYXRlZSA9IGZ1bmN0aW9uICh2YWx1ZSwgY29udGV4dCwgYXJnQ291bnQpIHtcbiAgICBpZiAodmFsdWUgPT0gbnVsbCkgcmV0dXJuIF8uaWRlbnRpdHk7XG4gICAgaWYgKF8uaXNGdW5jdGlvbih2YWx1ZSkpIHJldHVybiBjcmVhdGVDYWxsYmFjayh2YWx1ZSwgY29udGV4dCwgYXJnQ291bnQpO1xuICAgIGlmIChfLmlzT2JqZWN0KHZhbHVlKSkgcmV0dXJuIF8ubWF0Y2hlcyh2YWx1ZSk7XG4gICAgcmV0dXJuIF8ucHJvcGVydHkodmFsdWUpO1xufTtcblxuXy5wYWlycyA9IGZ1bmN0aW9uIChvYmopIHtcbiAgICB2YXIga2V5cyA9IF8ua2V5cyhvYmopO1xuICAgIHZhciBsZW5ndGggPSBrZXlzLmxlbmd0aDtcbiAgICB2YXIgcGFpcnMgPSBBcnJheShsZW5ndGgpO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgcGFpcnNbaV0gPSBba2V5c1tpXSwgb2JqW2tleXNbaV1dXTtcbiAgICB9XG4gICAgcmV0dXJuIHBhaXJzO1xufTtcblxuXy5tYXRjaGVzID0gZnVuY3Rpb24gKGF0dHJzKSB7XG4gICAgdmFyIHBhaXJzID0gXy5wYWlycyhhdHRycyksXG4gICAgICAgIGxlbmd0aCA9IHBhaXJzLmxlbmd0aDtcbiAgICByZXR1cm4gZnVuY3Rpb24gKG9iaikge1xuICAgICAgICBpZiAob2JqID09IG51bGwpIHJldHVybiAhbGVuZ3RoO1xuICAgICAgICBvYmogPSBuZXcgT2JqZWN0KG9iaik7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHZhciBwYWlyID0gcGFpcnNbaV0sXG4gICAgICAgICAgICAgICAga2V5ID0gcGFpclswXTtcbiAgICAgICAgICAgIGlmIChwYWlyWzFdICE9PSBvYmpba2V5XSB8fCAhKGtleSBpbiBvYmopKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfTtcbn07XG5cbl8uc29tZSA9IGZ1bmN0aW9uIChvYmosIHByZWRpY2F0ZSwgY29udGV4dCkge1xuICAgIGlmIChvYmogPT0gbnVsbCkgcmV0dXJuIGZhbHNlO1xuICAgIHByZWRpY2F0ZSA9IF8uaXRlcmF0ZWUocHJlZGljYXRlLCBjb250ZXh0KTtcbiAgICB2YXIga2V5cyA9IG9iai5sZW5ndGggIT09ICtvYmoubGVuZ3RoICYmIF8ua2V5cyhvYmopLFxuICAgICAgICBsZW5ndGggPSAoa2V5cyB8fCBvYmopLmxlbmd0aCxcbiAgICAgICAgaW5kZXgsIGN1cnJlbnRLZXk7XG4gICAgZm9yIChpbmRleCA9IDA7IGluZGV4IDwgbGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICAgIGN1cnJlbnRLZXkgPSBrZXlzID8ga2V5c1tpbmRleF0gOiBpbmRleDtcbiAgICAgICAgaWYgKHByZWRpY2F0ZShvYmpbY3VycmVudEtleV0sIGN1cnJlbnRLZXksIG9iaikpIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG59O1xuXG5cbi8vIEV4dGVuZCBhIGdpdmVuIG9iamVjdCB3aXRoIGFsbCB0aGUgcHJvcGVydGllcyBpbiBwYXNzZWQtaW4gb2JqZWN0KHMpLlxuXy5leHRlbmQgPSBmdW5jdGlvbiAob2JqKSB7XG4gICAgaWYgKCFfLmlzT2JqZWN0KG9iaikpIHJldHVybiBvYmo7XG4gICAgdmFyIHNvdXJjZSwgcHJvcDtcbiAgICBmb3IgKHZhciBpID0gMSwgbGVuZ3RoID0gYXJndW1lbnRzLmxlbmd0aDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHNvdXJjZSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgZm9yIChwcm9wIGluIHNvdXJjZSkge1xuICAgICAgICAgICAgLy9ub2luc3BlY3Rpb24gSlNVbmZpbHRlcmVkRm9ySW5Mb29wXG4gICAgICAgICAgICBpZiAoaGFzT3duUHJvcGVydHkuY2FsbChzb3VyY2UsIHByb3ApKSB7XG4gICAgICAgICAgICAgICAgLy9ub2luc3BlY3Rpb24gSlNVbmZpbHRlcmVkRm9ySW5Mb29wXG4gICAgICAgICAgICAgICAgb2JqW3Byb3BdID0gc291cmNlW3Byb3BdO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBvYmo7XG59O1xuXG4vLyBFTkQgdW5kZXJzY29yZS5qcyAvL1xuXG5leHBvcnRzLl8gPSBfO1xudmFyIG9ic2VydmUgPSByZXF1aXJlKCcuLi92ZW5kb3Ivb2JzZXJ2ZS1qcy9zcmMvb2JzZXJ2ZScpLlBsYXRmb3JtO1xuXG5mdW5jdGlvbiBuZXh0KGNhbGxiYWNrKSB7XG4gICAgb2JzZXJ2ZS5wZXJmb3JtTWljcm90YXNrQ2hlY2twb2ludCgpO1xuICAgIHNldFRpbWVvdXQoY2FsbGJhY2spO1xufVxuXG4vKipcbiAqIFBlcmZvcm1zIGRpcnR5IGNoZWNrL09iamVjdC5vYnNlcnZlIGNhbGxiYWNrcyBkZXBlbmRpbmcgb24gdGhlIGJyb3dzZXIuXG4gKlxuICogSWYgT2JqZWN0Lm9ic2VydmUgaXMgcHJlc2VudCxcbiAqIEBwYXJhbSBjYWxsYmFja1xuICovXG5leHBvcnRzLm5leHQgPSBuZXh0O1xuXG4vKipcbiAqIFJldHVybnMgYSBoYW5kbGVyIHRoYXQgYWN0cyB1cG9uIGEgY2FsbGJhY2sgb3IgYSBwcm9taXNlIGRlcGVuZGluZyBvbiB0aGUgcmVzdWx0IG9mIGEgZGlmZmVyZW50IGNhbGxiYWNrLlxuICogQHBhcmFtIGNhbGxiYWNrXG4gKiBAcGFyYW0gW3Byb21pc2VdXG4gKiBAcmV0dXJucyB7RnVuY3Rpb259XG4gKi9cbmV4cG9ydHMuY29uc3RydWN0Q2FsbGJhY2tBbmRQcm9taXNlSGFuZGxlciA9IGZ1bmN0aW9uIChjYWxsYmFjaywgcHJvbWlzZSkge1xuICAgIHJldHVybiBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2suYXBwbHkoY2FsbGJhY2ssIGFyZ3VtZW50cyk7XG4gICAgICAgIGlmIChwcm9taXNlKSB7XG4gICAgICAgICAgICBpZiAoZXJyKSBwcm9taXNlLnJlamVjdChlcnIpO1xuICAgICAgICAgICAgZWxzZSBwcm9taXNlLnJlc29sdmUuYXBwbHkocHJvbWlzZSwgQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKSk7XG4gICAgICAgIH1cbiAgICB9O1xufTtcblxudmFyIEludGVybmFsU2llc3RhRXJyb3IgPSByZXF1aXJlKCcuL2Vycm9yJykuSW50ZXJuYWxTaWVzdGFFcnJvcjtcblxuZnVuY3Rpb24gYXNzZXJ0KGNvbmRpdGlvbiwgbWVzc2FnZSwgY29udGV4dCkge1xuICAgIGlmICghY29uZGl0aW9uKSB7XG4gICAgICAgIG1lc3NhZ2UgPSBtZXNzYWdlIHx8IFwiQXNzZXJ0aW9uIGZhaWxlZFwiO1xuICAgICAgICBjb250ZXh0ID0gY29udGV4dCB8fCB7fTtcbiAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IobWVzc2FnZSwgY29udGV4dCk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBkZWZpbmVTdWJQcm9wZXJ0eShwcm9wZXJ0eSwgc3ViT2JqLCBpbm5lclByb3BlcnR5KSB7XG4gICAgcmV0dXJuIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCBwcm9wZXJ0eSwge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGlmIChpbm5lclByb3BlcnR5KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHN1Yk9ialtpbm5lclByb3BlcnR5XTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiBzdWJPYmpbcHJvcGVydHldO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICBzZXQ6IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICAgICAgaWYgKGlubmVyUHJvcGVydHkpIHtcbiAgICAgICAgICAgICAgICBzdWJPYmpbaW5uZXJQcm9wZXJ0eV0gPSB2YWx1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHN1Yk9ialtwcm9wZXJ0eV0gPSB2YWx1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgfSk7XG59XG5cbnZhciBndWlkID0gKGZ1bmN0aW9uICgpIHtcbiAgICBmdW5jdGlvbiBzNCgpIHtcbiAgICAgICAgcmV0dXJuIE1hdGguZmxvb3IoKDEgKyBNYXRoLnJhbmRvbSgpKSAqIDB4MTAwMDApXG4gICAgICAgICAgICAudG9TdHJpbmcoMTYpXG4gICAgICAgICAgICAuc3Vic3RyaW5nKDEpO1xuICAgIH1cblxuICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiBzNCgpICsgczQoKSArICctJyArIHM0KCkgKyAnLScgKyBzNCgpICsgJy0nICtcbiAgICAgICAgICAgIHM0KCkgKyAnLScgKyBzNCgpICsgczQoKSArIHM0KCk7XG4gICAgfTtcbn0pKCk7XG5cbl8uZXh0ZW5kKG1vZHVsZS5leHBvcnRzLCB7XG4gICAgYXNzZXJ0OiBhc3NlcnQsXG4gICAgZGVmaW5lU3ViUHJvcGVydHk6IGRlZmluZVN1YlByb3BlcnR5LFxuICAgIGd1aWQ6IGd1aWRcbn0pO1xuXG5cbiIsIi8vIENvcHlyaWdodCBKb3llbnQsIEluYy4gYW5kIG90aGVyIE5vZGUgY29udHJpYnV0b3JzLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhXG4vLyBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlXG4vLyBcIlNvZnR3YXJlXCIpLCB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmdcbi8vIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCxcbi8vIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXRcbi8vIHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZVxuLy8gZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4vL1xuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWRcbi8vIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuLy9cbi8vIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1Ncbi8vIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0Zcbi8vIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU5cbi8vIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLFxuLy8gREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SXG4vLyBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFXG4vLyBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxuXG5mdW5jdGlvbiBFdmVudEVtaXR0ZXIoKSB7XG4gIHRoaXMuX2V2ZW50cyA9IHRoaXMuX2V2ZW50cyB8fCB7fTtcbiAgdGhpcy5fbWF4TGlzdGVuZXJzID0gdGhpcy5fbWF4TGlzdGVuZXJzIHx8IHVuZGVmaW5lZDtcbn1cbm1vZHVsZS5leHBvcnRzID0gRXZlbnRFbWl0dGVyO1xuXG4vLyBCYWNrd2FyZHMtY29tcGF0IHdpdGggbm9kZSAwLjEwLnhcbkV2ZW50RW1pdHRlci5FdmVudEVtaXR0ZXIgPSBFdmVudEVtaXR0ZXI7XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX2V2ZW50cyA9IHVuZGVmaW5lZDtcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX21heExpc3RlbmVycyA9IHVuZGVmaW5lZDtcblxuLy8gQnkgZGVmYXVsdCBFdmVudEVtaXR0ZXJzIHdpbGwgcHJpbnQgYSB3YXJuaW5nIGlmIG1vcmUgdGhhbiAxMCBsaXN0ZW5lcnMgYXJlXG4vLyBhZGRlZCB0byBpdC4gVGhpcyBpcyBhIHVzZWZ1bCBkZWZhdWx0IHdoaWNoIGhlbHBzIGZpbmRpbmcgbWVtb3J5IGxlYWtzLlxuRXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnMgPSAxMDtcblxuLy8gT2J2aW91c2x5IG5vdCBhbGwgRW1pdHRlcnMgc2hvdWxkIGJlIGxpbWl0ZWQgdG8gMTAuIFRoaXMgZnVuY3Rpb24gYWxsb3dzXG4vLyB0aGF0IHRvIGJlIGluY3JlYXNlZC4gU2V0IHRvIHplcm8gZm9yIHVubGltaXRlZC5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuc2V0TWF4TGlzdGVuZXJzID0gZnVuY3Rpb24obikge1xuICBpZiAoIWlzTnVtYmVyKG4pIHx8IG4gPCAwIHx8IGlzTmFOKG4pKVxuICAgIHRocm93IFR5cGVFcnJvcignbiBtdXN0IGJlIGEgcG9zaXRpdmUgbnVtYmVyJyk7XG4gIHRoaXMuX21heExpc3RlbmVycyA9IG47XG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5lbWl0ID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgZXIsIGhhbmRsZXIsIGxlbiwgYXJncywgaSwgbGlzdGVuZXJzO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuXG4gIC8vIElmIHRoZXJlIGlzIG5vICdlcnJvcicgZXZlbnQgbGlzdGVuZXIgdGhlbiB0aHJvdy5cbiAgaWYgKHR5cGUgPT09ICdlcnJvcicpIHtcbiAgICBpZiAoIXRoaXMuX2V2ZW50cy5lcnJvciB8fFxuICAgICAgICAoaXNPYmplY3QodGhpcy5fZXZlbnRzLmVycm9yKSAmJiAhdGhpcy5fZXZlbnRzLmVycm9yLmxlbmd0aCkpIHtcbiAgICAgIGVyID0gYXJndW1lbnRzWzFdO1xuICAgICAgaWYgKGVyIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgICAgdGhyb3cgZXI7IC8vIFVuaGFuZGxlZCAnZXJyb3InIGV2ZW50XG4gICAgICB9XG4gICAgICB0aHJvdyBUeXBlRXJyb3IoJ1VuY2F1Z2h0LCB1bnNwZWNpZmllZCBcImVycm9yXCIgZXZlbnQuJyk7XG4gICAgfVxuICB9XG5cbiAgaGFuZGxlciA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNVbmRlZmluZWQoaGFuZGxlcikpXG4gICAgcmV0dXJuIGZhbHNlO1xuXG4gIGlmIChpc0Z1bmN0aW9uKGhhbmRsZXIpKSB7XG4gICAgc3dpdGNoIChhcmd1bWVudHMubGVuZ3RoKSB7XG4gICAgICAvLyBmYXN0IGNhc2VzXG4gICAgICBjYXNlIDE6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDI6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0pO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMzpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSwgYXJndW1lbnRzWzJdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICAvLyBzbG93ZXJcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGxlbiA9IGFyZ3VtZW50cy5sZW5ndGg7XG4gICAgICAgIGFyZ3MgPSBuZXcgQXJyYXkobGVuIC0gMSk7XG4gICAgICAgIGZvciAoaSA9IDE7IGkgPCBsZW47IGkrKylcbiAgICAgICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgaGFuZGxlci5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAoaXNPYmplY3QoaGFuZGxlcikpIHtcbiAgICBsZW4gPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgIGFyZ3MgPSBuZXcgQXJyYXkobGVuIC0gMSk7XG4gICAgZm9yIChpID0gMTsgaSA8IGxlbjsgaSsrKVxuICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG5cbiAgICBsaXN0ZW5lcnMgPSBoYW5kbGVyLnNsaWNlKCk7XG4gICAgbGVuID0gbGlzdGVuZXJzLmxlbmd0aDtcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGVuOyBpKyspXG4gICAgICBsaXN0ZW5lcnNbaV0uYXBwbHkodGhpcywgYXJncyk7XG4gIH1cblxuICByZXR1cm4gdHJ1ZTtcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgLy8gVG8gYXZvaWQgcmVjdXJzaW9uIGluIHRoZSBjYXNlIHRoYXQgdHlwZSA9PT0gXCJuZXdMaXN0ZW5lclwiISBCZWZvcmVcbiAgLy8gYWRkaW5nIGl0IHRvIHRoZSBsaXN0ZW5lcnMsIGZpcnN0IGVtaXQgXCJuZXdMaXN0ZW5lclwiLlxuICBpZiAodGhpcy5fZXZlbnRzLm5ld0xpc3RlbmVyKVxuICAgIHRoaXMuZW1pdCgnbmV3TGlzdGVuZXInLCB0eXBlLFxuICAgICAgICAgICAgICBpc0Z1bmN0aW9uKGxpc3RlbmVyLmxpc3RlbmVyKSA/XG4gICAgICAgICAgICAgIGxpc3RlbmVyLmxpc3RlbmVyIDogbGlzdGVuZXIpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIC8vIE9wdGltaXplIHRoZSBjYXNlIG9mIG9uZSBsaXN0ZW5lci4gRG9uJ3QgbmVlZCB0aGUgZXh0cmEgYXJyYXkgb2JqZWN0LlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IGxpc3RlbmVyO1xuICBlbHNlIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIC8vIElmIHdlJ3ZlIGFscmVhZHkgZ290IGFuIGFycmF5LCBqdXN0IGFwcGVuZC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0ucHVzaChsaXN0ZW5lcik7XG4gIGVsc2VcbiAgICAvLyBBZGRpbmcgdGhlIHNlY29uZCBlbGVtZW50LCBuZWVkIHRvIGNoYW5nZSB0byBhcnJheS5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBbdGhpcy5fZXZlbnRzW3R5cGVdLCBsaXN0ZW5lcl07XG5cbiAgLy8gQ2hlY2sgZm9yIGxpc3RlbmVyIGxlYWtcbiAgaWYgKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkgJiYgIXRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQpIHtcbiAgICB2YXIgbTtcbiAgICBpZiAoIWlzVW5kZWZpbmVkKHRoaXMuX21heExpc3RlbmVycykpIHtcbiAgICAgIG0gPSB0aGlzLl9tYXhMaXN0ZW5lcnM7XG4gICAgfSBlbHNlIHtcbiAgICAgIG0gPSBFdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycztcbiAgICB9XG5cbiAgICBpZiAobSAmJiBtID4gMCAmJiB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoID4gbSkge1xuICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCA9IHRydWU7XG4gICAgICBjb25zb2xlLmVycm9yKCcobm9kZSkgd2FybmluZzogcG9zc2libGUgRXZlbnRFbWl0dGVyIG1lbW9yeSAnICtcbiAgICAgICAgICAgICAgICAgICAgJ2xlYWsgZGV0ZWN0ZWQuICVkIGxpc3RlbmVycyBhZGRlZC4gJyArXG4gICAgICAgICAgICAgICAgICAgICdVc2UgZW1pdHRlci5zZXRNYXhMaXN0ZW5lcnMoKSB0byBpbmNyZWFzZSBsaW1pdC4nLFxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoKTtcbiAgICAgIGlmICh0eXBlb2YgY29uc29sZS50cmFjZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAvLyBub3Qgc3VwcG9ydGVkIGluIElFIDEwXG4gICAgICAgIGNvbnNvbGUudHJhY2UoKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub24gPSBFdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uY2UgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgdmFyIGZpcmVkID0gZmFsc2U7XG5cbiAgZnVuY3Rpb24gZygpIHtcbiAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGcpO1xuXG4gICAgaWYgKCFmaXJlZCkge1xuICAgICAgZmlyZWQgPSB0cnVlO1xuICAgICAgbGlzdGVuZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9XG4gIH1cblxuICBnLmxpc3RlbmVyID0gbGlzdGVuZXI7XG4gIHRoaXMub24odHlwZSwgZyk7XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vLyBlbWl0cyBhICdyZW1vdmVMaXN0ZW5lcicgZXZlbnQgaWZmIHRoZSBsaXN0ZW5lciB3YXMgcmVtb3ZlZFxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIHZhciBsaXN0LCBwb3NpdGlvbiwgbGVuZ3RoLCBpO1xuXG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIGxpc3QgPSB0aGlzLl9ldmVudHNbdHlwZV07XG4gIGxlbmd0aCA9IGxpc3QubGVuZ3RoO1xuICBwb3NpdGlvbiA9IC0xO1xuXG4gIGlmIChsaXN0ID09PSBsaXN0ZW5lciB8fFxuICAgICAgKGlzRnVuY3Rpb24obGlzdC5saXN0ZW5lcikgJiYgbGlzdC5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICBpZiAodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKVxuICAgICAgdGhpcy5lbWl0KCdyZW1vdmVMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcblxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGxpc3QpKSB7XG4gICAgZm9yIChpID0gbGVuZ3RoOyBpLS0gPiAwOykge1xuICAgICAgaWYgKGxpc3RbaV0gPT09IGxpc3RlbmVyIHx8XG4gICAgICAgICAgKGxpc3RbaV0ubGlzdGVuZXIgJiYgbGlzdFtpXS5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgICAgIHBvc2l0aW9uID0gaTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHBvc2l0aW9uIDwgMClcbiAgICAgIHJldHVybiB0aGlzO1xuXG4gICAgaWYgKGxpc3QubGVuZ3RoID09PSAxKSB7XG4gICAgICBsaXN0Lmxlbmd0aCA9IDA7XG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIH0gZWxzZSB7XG4gICAgICBsaXN0LnNwbGljZShwb3NpdGlvbiwgMSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlQWxsTGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIga2V5LCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgLy8gbm90IGxpc3RlbmluZyBmb3IgcmVtb3ZlTGlzdGVuZXIsIG5vIG5lZWQgdG8gZW1pdFxuICBpZiAoIXRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcikge1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKVxuICAgICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgZWxzZSBpZiAodGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8vIGVtaXQgcmVtb3ZlTGlzdGVuZXIgZm9yIGFsbCBsaXN0ZW5lcnMgb24gYWxsIGV2ZW50c1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgIGZvciAoa2V5IGluIHRoaXMuX2V2ZW50cykge1xuICAgICAgaWYgKGtleSA9PT0gJ3JlbW92ZUxpc3RlbmVyJykgY29udGludWU7XG4gICAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycyhrZXkpO1xuICAgIH1cbiAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycygncmVtb3ZlTGlzdGVuZXInKTtcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIGxpc3RlbmVycyA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNGdW5jdGlvbihsaXN0ZW5lcnMpKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnMpO1xuICB9IGVsc2Uge1xuICAgIC8vIExJRk8gb3JkZXJcbiAgICB3aGlsZSAobGlzdGVuZXJzLmxlbmd0aClcbiAgICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzW2xpc3RlbmVycy5sZW5ndGggLSAxXSk7XG4gIH1cbiAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgcmV0O1xuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldCA9IFtdO1xuICBlbHNlIGlmIChpc0Z1bmN0aW9uKHRoaXMuX2V2ZW50c1t0eXBlXSkpXG4gICAgcmV0ID0gW3RoaXMuX2V2ZW50c1t0eXBlXV07XG4gIGVsc2VcbiAgICByZXQgPSB0aGlzLl9ldmVudHNbdHlwZV0uc2xpY2UoKTtcbiAgcmV0dXJuIHJldDtcbn07XG5cbkV2ZW50RW1pdHRlci5saXN0ZW5lckNvdW50ID0gZnVuY3Rpb24oZW1pdHRlciwgdHlwZSkge1xuICB2YXIgcmV0O1xuICBpZiAoIWVtaXR0ZXIuX2V2ZW50cyB8fCAhZW1pdHRlci5fZXZlbnRzW3R5cGVdKVxuICAgIHJldCA9IDA7XG4gIGVsc2UgaWYgKGlzRnVuY3Rpb24oZW1pdHRlci5fZXZlbnRzW3R5cGVdKSlcbiAgICByZXQgPSAxO1xuICBlbHNlXG4gICAgcmV0ID0gZW1pdHRlci5fZXZlbnRzW3R5cGVdLmxlbmd0aDtcbiAgcmV0dXJuIHJldDtcbn07XG5cbmZ1bmN0aW9uIGlzRnVuY3Rpb24oYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnZnVuY3Rpb24nO1xufVxuXG5mdW5jdGlvbiBpc051bWJlcihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdudW1iZXInO1xufVxuXG5mdW5jdGlvbiBpc09iamVjdChhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdvYmplY3QnICYmIGFyZyAhPT0gbnVsbDtcbn1cblxuZnVuY3Rpb24gaXNVbmRlZmluZWQoYXJnKSB7XG4gIHJldHVybiBhcmcgPT09IHZvaWQgMDtcbn1cbiIsInZhciBoYXNPd24gPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5O1xudmFyIHRvU3RyaW5nID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZztcbnZhciB1bmRlZmluZWQ7XG5cbnZhciBpc1BsYWluT2JqZWN0ID0gZnVuY3Rpb24gaXNQbGFpbk9iamVjdChvYmopIHtcblx0XCJ1c2Ugc3RyaWN0XCI7XG5cdGlmICghb2JqIHx8IHRvU3RyaW5nLmNhbGwob2JqKSAhPT0gJ1tvYmplY3QgT2JqZWN0XScgfHwgb2JqLm5vZGVUeXBlIHx8IG9iai5zZXRJbnRlcnZhbCkge1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdHZhciBoYXNfb3duX2NvbnN0cnVjdG9yID0gaGFzT3duLmNhbGwob2JqLCAnY29uc3RydWN0b3InKTtcblx0dmFyIGhhc19pc19wcm9wZXJ0eV9vZl9tZXRob2QgPSBvYmouY29uc3RydWN0b3IgJiYgb2JqLmNvbnN0cnVjdG9yLnByb3RvdHlwZSAmJiBoYXNPd24uY2FsbChvYmouY29uc3RydWN0b3IucHJvdG90eXBlLCAnaXNQcm90b3R5cGVPZicpO1xuXHQvLyBOb3Qgb3duIGNvbnN0cnVjdG9yIHByb3BlcnR5IG11c3QgYmUgT2JqZWN0XG5cdGlmIChvYmouY29uc3RydWN0b3IgJiYgIWhhc19vd25fY29uc3RydWN0b3IgJiYgIWhhc19pc19wcm9wZXJ0eV9vZl9tZXRob2QpIHtcblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHQvLyBPd24gcHJvcGVydGllcyBhcmUgZW51bWVyYXRlZCBmaXJzdGx5LCBzbyB0byBzcGVlZCB1cCxcblx0Ly8gaWYgbGFzdCBvbmUgaXMgb3duLCB0aGVuIGFsbCBwcm9wZXJ0aWVzIGFyZSBvd24uXG5cdHZhciBrZXk7XG5cdGZvciAoa2V5IGluIG9iaikge31cblxuXHRyZXR1cm4ga2V5ID09PSB1bmRlZmluZWQgfHwgaGFzT3duLmNhbGwob2JqLCBrZXkpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBleHRlbmQoKSB7XG5cdFwidXNlIHN0cmljdFwiO1xuXHR2YXIgb3B0aW9ucywgbmFtZSwgc3JjLCBjb3B5LCBjb3B5SXNBcnJheSwgY2xvbmUsXG5cdFx0dGFyZ2V0ID0gYXJndW1lbnRzWzBdLFxuXHRcdGkgPSAxLFxuXHRcdGxlbmd0aCA9IGFyZ3VtZW50cy5sZW5ndGgsXG5cdFx0ZGVlcCA9IGZhbHNlO1xuXG5cdC8vIEhhbmRsZSBhIGRlZXAgY29weSBzaXR1YXRpb25cblx0aWYgKHR5cGVvZiB0YXJnZXQgPT09IFwiYm9vbGVhblwiKSB7XG5cdFx0ZGVlcCA9IHRhcmdldDtcblx0XHR0YXJnZXQgPSBhcmd1bWVudHNbMV0gfHwge307XG5cdFx0Ly8gc2tpcCB0aGUgYm9vbGVhbiBhbmQgdGhlIHRhcmdldFxuXHRcdGkgPSAyO1xuXHR9IGVsc2UgaWYgKHR5cGVvZiB0YXJnZXQgIT09IFwib2JqZWN0XCIgJiYgdHlwZW9mIHRhcmdldCAhPT0gXCJmdW5jdGlvblwiIHx8IHRhcmdldCA9PSB1bmRlZmluZWQpIHtcblx0XHRcdHRhcmdldCA9IHt9O1xuXHR9XG5cblx0Zm9yICg7IGkgPCBsZW5ndGg7ICsraSkge1xuXHRcdC8vIE9ubHkgZGVhbCB3aXRoIG5vbi1udWxsL3VuZGVmaW5lZCB2YWx1ZXNcblx0XHRpZiAoKG9wdGlvbnMgPSBhcmd1bWVudHNbaV0pICE9IG51bGwpIHtcblx0XHRcdC8vIEV4dGVuZCB0aGUgYmFzZSBvYmplY3Rcblx0XHRcdGZvciAobmFtZSBpbiBvcHRpb25zKSB7XG5cdFx0XHRcdHNyYyA9IHRhcmdldFtuYW1lXTtcblx0XHRcdFx0Y29weSA9IG9wdGlvbnNbbmFtZV07XG5cblx0XHRcdFx0Ly8gUHJldmVudCBuZXZlci1lbmRpbmcgbG9vcFxuXHRcdFx0XHRpZiAodGFyZ2V0ID09PSBjb3B5KSB7XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBSZWN1cnNlIGlmIHdlJ3JlIG1lcmdpbmcgcGxhaW4gb2JqZWN0cyBvciBhcnJheXNcblx0XHRcdFx0aWYgKGRlZXAgJiYgY29weSAmJiAoaXNQbGFpbk9iamVjdChjb3B5KSB8fCAoY29weUlzQXJyYXkgPSBBcnJheS5pc0FycmF5KGNvcHkpKSkpIHtcblx0XHRcdFx0XHRpZiAoY29weUlzQXJyYXkpIHtcblx0XHRcdFx0XHRcdGNvcHlJc0FycmF5ID0gZmFsc2U7XG5cdFx0XHRcdFx0XHRjbG9uZSA9IHNyYyAmJiBBcnJheS5pc0FycmF5KHNyYykgPyBzcmMgOiBbXTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0Y2xvbmUgPSBzcmMgJiYgaXNQbGFpbk9iamVjdChzcmMpID8gc3JjIDoge307XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Ly8gTmV2ZXIgbW92ZSBvcmlnaW5hbCBvYmplY3RzLCBjbG9uZSB0aGVtXG5cdFx0XHRcdFx0dGFyZ2V0W25hbWVdID0gZXh0ZW5kKGRlZXAsIGNsb25lLCBjb3B5KTtcblxuXHRcdFx0XHQvLyBEb24ndCBicmluZyBpbiB1bmRlZmluZWQgdmFsdWVzXG5cdFx0XHRcdH0gZWxzZSBpZiAoY29weSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdFx0dGFyZ2V0W25hbWVdID0gY29weTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdC8vIFJldHVybiB0aGUgbW9kaWZpZWQgb2JqZWN0XG5cdHJldHVybiB0YXJnZXQ7XG59O1xuXG4iLCIoZnVuY3Rpb24gKGdsb2JhbCl7XG4vKlxuICogQ29weXJpZ2h0IChjKSAyMDE0IFRoZSBQb2x5bWVyIFByb2plY3QgQXV0aG9ycy4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqIFRoaXMgY29kZSBtYXkgb25seSBiZSB1c2VkIHVuZGVyIHRoZSBCU0Qgc3R5bGUgbGljZW5zZSBmb3VuZCBhdCBodHRwOi8vcG9seW1lci5naXRodWIuaW8vTElDRU5TRS50eHRcbiAqIFRoZSBjb21wbGV0ZSBzZXQgb2YgYXV0aG9ycyBtYXkgYmUgZm91bmQgYXQgaHR0cDovL3BvbHltZXIuZ2l0aHViLmlvL0FVVEhPUlMudHh0XG4gKiBUaGUgY29tcGxldGUgc2V0IG9mIGNvbnRyaWJ1dG9ycyBtYXkgYmUgZm91bmQgYXQgaHR0cDovL3BvbHltZXIuZ2l0aHViLmlvL0NPTlRSSUJVVE9SUy50eHRcbiAqIENvZGUgZGlzdHJpYnV0ZWQgYnkgR29vZ2xlIGFzIHBhcnQgb2YgdGhlIHBvbHltZXIgcHJvamVjdCBpcyBhbHNvXG4gKiBzdWJqZWN0IHRvIGFuIGFkZGl0aW9uYWwgSVAgcmlnaHRzIGdyYW50IGZvdW5kIGF0IGh0dHA6Ly9wb2x5bWVyLmdpdGh1Yi5pby9QQVRFTlRTLnR4dFxuICovXG5cbihmdW5jdGlvbihnbG9iYWwpIHtcbiAgJ3VzZSBzdHJpY3QnO1xuXG4gIHZhciB0ZXN0aW5nRXhwb3NlQ3ljbGVDb3VudCA9IGdsb2JhbC50ZXN0aW5nRXhwb3NlQ3ljbGVDb3VudDtcblxuICAvLyBEZXRlY3QgYW5kIGRvIGJhc2ljIHNhbml0eSBjaGVja2luZyBvbiBPYmplY3QvQXJyYXkub2JzZXJ2ZS5cbiAgZnVuY3Rpb24gZGV0ZWN0T2JqZWN0T2JzZXJ2ZSgpIHtcbiAgICBpZiAodHlwZW9mIE9iamVjdC5vYnNlcnZlICE9PSAnZnVuY3Rpb24nIHx8XG4gICAgICAgIHR5cGVvZiBBcnJheS5vYnNlcnZlICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgdmFyIHJlY29yZHMgPSBbXTtcblxuICAgIGZ1bmN0aW9uIGNhbGxiYWNrKHJlY3MpIHtcbiAgICAgIHJlY29yZHMgPSByZWNzO1xuICAgIH1cblxuICAgIHZhciB0ZXN0ID0ge307XG4gICAgdmFyIGFyciA9IFtdO1xuICAgIE9iamVjdC5vYnNlcnZlKHRlc3QsIGNhbGxiYWNrKTtcbiAgICBBcnJheS5vYnNlcnZlKGFyciwgY2FsbGJhY2spO1xuICAgIHRlc3QuaWQgPSAxO1xuICAgIHRlc3QuaWQgPSAyO1xuICAgIGRlbGV0ZSB0ZXN0LmlkO1xuICAgIGFyci5wdXNoKDEsIDIpO1xuICAgIGFyci5sZW5ndGggPSAwO1xuXG4gICAgT2JqZWN0LmRlbGl2ZXJDaGFuZ2VSZWNvcmRzKGNhbGxiYWNrKTtcbiAgICBpZiAocmVjb3Jkcy5sZW5ndGggIT09IDUpXG4gICAgICByZXR1cm4gZmFsc2U7XG5cbiAgICBpZiAocmVjb3Jkc1swXS50eXBlICE9ICdhZGQnIHx8XG4gICAgICAgIHJlY29yZHNbMV0udHlwZSAhPSAndXBkYXRlJyB8fFxuICAgICAgICByZWNvcmRzWzJdLnR5cGUgIT0gJ2RlbGV0ZScgfHxcbiAgICAgICAgcmVjb3Jkc1szXS50eXBlICE9ICdzcGxpY2UnIHx8XG4gICAgICAgIHJlY29yZHNbNF0udHlwZSAhPSAnc3BsaWNlJykge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIE9iamVjdC51bm9ic2VydmUodGVzdCwgY2FsbGJhY2spO1xuICAgIEFycmF5LnVub2JzZXJ2ZShhcnIsIGNhbGxiYWNrKTtcblxuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgdmFyIGhhc09ic2VydmUgPSBkZXRlY3RPYmplY3RPYnNlcnZlKCk7XG5cbiAgZnVuY3Rpb24gZGV0ZWN0RXZhbCgpIHtcbiAgICAvLyBEb24ndCB0ZXN0IGZvciBldmFsIGlmIHdlJ3JlIHJ1bm5pbmcgaW4gYSBDaHJvbWUgQXBwIGVudmlyb25tZW50LlxuICAgIC8vIFdlIGNoZWNrIGZvciBBUElzIHNldCB0aGF0IG9ubHkgZXhpc3QgaW4gYSBDaHJvbWUgQXBwIGNvbnRleHQuXG4gICAgaWYgKHR5cGVvZiBjaHJvbWUgIT09ICd1bmRlZmluZWQnICYmIGNocm9tZS5hcHAgJiYgY2hyb21lLmFwcC5ydW50aW1lKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgLy8gRmlyZWZveCBPUyBBcHBzIGRvIG5vdCBhbGxvdyBldmFsLiBUaGlzIGZlYXR1cmUgZGV0ZWN0aW9uIGlzIHZlcnkgaGFja3lcbiAgICAvLyBidXQgZXZlbiBpZiBzb21lIG90aGVyIHBsYXRmb3JtIGFkZHMgc3VwcG9ydCBmb3IgdGhpcyBmdW5jdGlvbiB0aGlzIGNvZGVcbiAgICAvLyB3aWxsIGNvbnRpbnVlIHRvIHdvcmsuXG4gICAgaWYgKG5hdmlnYXRvci5nZXREZXZpY2VTdG9yYWdlKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgdHJ5IHtcbiAgICAgIHZhciBmID0gbmV3IEZ1bmN0aW9uKCcnLCAncmV0dXJuIHRydWU7Jyk7XG4gICAgICByZXR1cm4gZigpO1xuICAgIH0gY2F0Y2ggKGV4KSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgdmFyIGhhc0V2YWwgPSBkZXRlY3RFdmFsKCk7XG5cbiAgZnVuY3Rpb24gaXNJbmRleChzKSB7XG4gICAgcmV0dXJuICtzID09PSBzID4+PiAwICYmIHMgIT09ICcnO1xuICB9XG5cbiAgZnVuY3Rpb24gdG9OdW1iZXIocykge1xuICAgIHJldHVybiArcztcbiAgfVxuXG4gIGZ1bmN0aW9uIGlzT2JqZWN0KG9iaikge1xuICAgIHJldHVybiBvYmogPT09IE9iamVjdChvYmopO1xuICB9XG5cbiAgdmFyIG51bWJlcklzTmFOID0gZ2xvYmFsLk51bWJlci5pc05hTiB8fCBmdW5jdGlvbih2YWx1ZSkge1xuICAgIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInICYmIGdsb2JhbC5pc05hTih2YWx1ZSk7XG4gIH1cblxuICBmdW5jdGlvbiBhcmVTYW1lVmFsdWUobGVmdCwgcmlnaHQpIHtcbiAgICBpZiAobGVmdCA9PT0gcmlnaHQpXG4gICAgICByZXR1cm4gbGVmdCAhPT0gMCB8fCAxIC8gbGVmdCA9PT0gMSAvIHJpZ2h0O1xuICAgIGlmIChudW1iZXJJc05hTihsZWZ0KSAmJiBudW1iZXJJc05hTihyaWdodCkpXG4gICAgICByZXR1cm4gdHJ1ZTtcblxuICAgIHJldHVybiBsZWZ0ICE9PSBsZWZ0ICYmIHJpZ2h0ICE9PSByaWdodDtcbiAgfVxuXG4gIHZhciBjcmVhdGVPYmplY3QgPSAoJ19fcHJvdG9fXycgaW4ge30pID9cbiAgICBmdW5jdGlvbihvYmopIHsgcmV0dXJuIG9iajsgfSA6XG4gICAgZnVuY3Rpb24ob2JqKSB7XG4gICAgICB2YXIgcHJvdG8gPSBvYmouX19wcm90b19fO1xuICAgICAgaWYgKCFwcm90bylcbiAgICAgICAgcmV0dXJuIG9iajtcbiAgICAgIHZhciBuZXdPYmplY3QgPSBPYmplY3QuY3JlYXRlKHByb3RvKTtcbiAgICAgIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKG9iaikuZm9yRWFjaChmdW5jdGlvbihuYW1lKSB7XG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShuZXdPYmplY3QsIG5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3Iob2JqLCBuYW1lKSk7XG4gICAgICB9KTtcbiAgICAgIHJldHVybiBuZXdPYmplY3Q7XG4gICAgfTtcblxuICB2YXIgaWRlbnRTdGFydCA9ICdbXFwkX2EtekEtWl0nO1xuICB2YXIgaWRlbnRQYXJ0ID0gJ1tcXCRfYS16QS1aMC05XSc7XG4gIHZhciBpZGVudFJlZ0V4cCA9IG5ldyBSZWdFeHAoJ14nICsgaWRlbnRTdGFydCArICcrJyArIGlkZW50UGFydCArICcqJyArICckJyk7XG5cbiAgZnVuY3Rpb24gZ2V0UGF0aENoYXJUeXBlKGNoYXIpIHtcbiAgICBpZiAoY2hhciA9PT0gdW5kZWZpbmVkKVxuICAgICAgcmV0dXJuICdlb2YnO1xuXG4gICAgdmFyIGNvZGUgPSBjaGFyLmNoYXJDb2RlQXQoMCk7XG5cbiAgICBzd2l0Y2goY29kZSkge1xuICAgICAgY2FzZSAweDVCOiAvLyBbXG4gICAgICBjYXNlIDB4NUQ6IC8vIF1cbiAgICAgIGNhc2UgMHgyRTogLy8gLlxuICAgICAgY2FzZSAweDIyOiAvLyBcIlxuICAgICAgY2FzZSAweDI3OiAvLyAnXG4gICAgICBjYXNlIDB4MzA6IC8vIDBcbiAgICAgICAgcmV0dXJuIGNoYXI7XG5cbiAgICAgIGNhc2UgMHg1RjogLy8gX1xuICAgICAgY2FzZSAweDI0OiAvLyAkXG4gICAgICAgIHJldHVybiAnaWRlbnQnO1xuXG4gICAgICBjYXNlIDB4MjA6IC8vIFNwYWNlXG4gICAgICBjYXNlIDB4MDk6IC8vIFRhYlxuICAgICAgY2FzZSAweDBBOiAvLyBOZXdsaW5lXG4gICAgICBjYXNlIDB4MEQ6IC8vIFJldHVyblxuICAgICAgY2FzZSAweEEwOiAgLy8gTm8tYnJlYWsgc3BhY2VcbiAgICAgIGNhc2UgMHhGRUZGOiAgLy8gQnl0ZSBPcmRlciBNYXJrXG4gICAgICBjYXNlIDB4MjAyODogIC8vIExpbmUgU2VwYXJhdG9yXG4gICAgICBjYXNlIDB4MjAyOTogIC8vIFBhcmFncmFwaCBTZXBhcmF0b3JcbiAgICAgICAgcmV0dXJuICd3cyc7XG4gICAgfVxuXG4gICAgLy8gYS16LCBBLVpcbiAgICBpZiAoKDB4NjEgPD0gY29kZSAmJiBjb2RlIDw9IDB4N0EpIHx8ICgweDQxIDw9IGNvZGUgJiYgY29kZSA8PSAweDVBKSlcbiAgICAgIHJldHVybiAnaWRlbnQnO1xuXG4gICAgLy8gMS05XG4gICAgaWYgKDB4MzEgPD0gY29kZSAmJiBjb2RlIDw9IDB4MzkpXG4gICAgICByZXR1cm4gJ251bWJlcic7XG5cbiAgICByZXR1cm4gJ2Vsc2UnO1xuICB9XG5cbiAgdmFyIHBhdGhTdGF0ZU1hY2hpbmUgPSB7XG4gICAgJ2JlZm9yZVBhdGgnOiB7XG4gICAgICAnd3MnOiBbJ2JlZm9yZVBhdGgnXSxcbiAgICAgICdpZGVudCc6IFsnaW5JZGVudCcsICdhcHBlbmQnXSxcbiAgICAgICdbJzogWydiZWZvcmVFbGVtZW50J10sXG4gICAgICAnZW9mJzogWydhZnRlclBhdGgnXVxuICAgIH0sXG5cbiAgICAnaW5QYXRoJzoge1xuICAgICAgJ3dzJzogWydpblBhdGgnXSxcbiAgICAgICcuJzogWydiZWZvcmVJZGVudCddLFxuICAgICAgJ1snOiBbJ2JlZm9yZUVsZW1lbnQnXSxcbiAgICAgICdlb2YnOiBbJ2FmdGVyUGF0aCddXG4gICAgfSxcblxuICAgICdiZWZvcmVJZGVudCc6IHtcbiAgICAgICd3cyc6IFsnYmVmb3JlSWRlbnQnXSxcbiAgICAgICdpZGVudCc6IFsnaW5JZGVudCcsICdhcHBlbmQnXVxuICAgIH0sXG5cbiAgICAnaW5JZGVudCc6IHtcbiAgICAgICdpZGVudCc6IFsnaW5JZGVudCcsICdhcHBlbmQnXSxcbiAgICAgICcwJzogWydpbklkZW50JywgJ2FwcGVuZCddLFxuICAgICAgJ251bWJlcic6IFsnaW5JZGVudCcsICdhcHBlbmQnXSxcbiAgICAgICd3cyc6IFsnaW5QYXRoJywgJ3B1c2gnXSxcbiAgICAgICcuJzogWydiZWZvcmVJZGVudCcsICdwdXNoJ10sXG4gICAgICAnWyc6IFsnYmVmb3JlRWxlbWVudCcsICdwdXNoJ10sXG4gICAgICAnZW9mJzogWydhZnRlclBhdGgnLCAncHVzaCddXG4gICAgfSxcblxuICAgICdiZWZvcmVFbGVtZW50Jzoge1xuICAgICAgJ3dzJzogWydiZWZvcmVFbGVtZW50J10sXG4gICAgICAnMCc6IFsnYWZ0ZXJaZXJvJywgJ2FwcGVuZCddLFxuICAgICAgJ251bWJlcic6IFsnaW5JbmRleCcsICdhcHBlbmQnXSxcbiAgICAgIFwiJ1wiOiBbJ2luU2luZ2xlUXVvdGUnLCAnYXBwZW5kJywgJyddLFxuICAgICAgJ1wiJzogWydpbkRvdWJsZVF1b3RlJywgJ2FwcGVuZCcsICcnXVxuICAgIH0sXG5cbiAgICAnYWZ0ZXJaZXJvJzoge1xuICAgICAgJ3dzJzogWydhZnRlckVsZW1lbnQnLCAncHVzaCddLFxuICAgICAgJ10nOiBbJ2luUGF0aCcsICdwdXNoJ11cbiAgICB9LFxuXG4gICAgJ2luSW5kZXgnOiB7XG4gICAgICAnMCc6IFsnaW5JbmRleCcsICdhcHBlbmQnXSxcbiAgICAgICdudW1iZXInOiBbJ2luSW5kZXgnLCAnYXBwZW5kJ10sXG4gICAgICAnd3MnOiBbJ2FmdGVyRWxlbWVudCddLFxuICAgICAgJ10nOiBbJ2luUGF0aCcsICdwdXNoJ11cbiAgICB9LFxuXG4gICAgJ2luU2luZ2xlUXVvdGUnOiB7XG4gICAgICBcIidcIjogWydhZnRlckVsZW1lbnQnXSxcbiAgICAgICdlb2YnOiBbJ2Vycm9yJ10sXG4gICAgICAnZWxzZSc6IFsnaW5TaW5nbGVRdW90ZScsICdhcHBlbmQnXVxuICAgIH0sXG5cbiAgICAnaW5Eb3VibGVRdW90ZSc6IHtcbiAgICAgICdcIic6IFsnYWZ0ZXJFbGVtZW50J10sXG4gICAgICAnZW9mJzogWydlcnJvciddLFxuICAgICAgJ2Vsc2UnOiBbJ2luRG91YmxlUXVvdGUnLCAnYXBwZW5kJ11cbiAgICB9LFxuXG4gICAgJ2FmdGVyRWxlbWVudCc6IHtcbiAgICAgICd3cyc6IFsnYWZ0ZXJFbGVtZW50J10sXG4gICAgICAnXSc6IFsnaW5QYXRoJywgJ3B1c2gnXVxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIG5vb3AoKSB7fVxuXG4gIGZ1bmN0aW9uIHBhcnNlUGF0aChwYXRoKSB7XG4gICAgdmFyIGtleXMgPSBbXTtcbiAgICB2YXIgaW5kZXggPSAtMTtcbiAgICB2YXIgYywgbmV3Q2hhciwga2V5LCB0eXBlLCB0cmFuc2l0aW9uLCBhY3Rpb24sIHR5cGVNYXAsIG1vZGUgPSAnYmVmb3JlUGF0aCc7XG5cbiAgICB2YXIgYWN0aW9ucyA9IHtcbiAgICAgIHB1c2g6IGZ1bmN0aW9uKCkge1xuICAgICAgICBpZiAoa2V5ID09PSB1bmRlZmluZWQpXG4gICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIGtleXMucHVzaChrZXkpO1xuICAgICAgICBrZXkgPSB1bmRlZmluZWQ7XG4gICAgICB9LFxuXG4gICAgICBhcHBlbmQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICBpZiAoa2V5ID09PSB1bmRlZmluZWQpXG4gICAgICAgICAga2V5ID0gbmV3Q2hhclxuICAgICAgICBlbHNlXG4gICAgICAgICAga2V5ICs9IG5ld0NoYXI7XG4gICAgICB9XG4gICAgfTtcblxuICAgIGZ1bmN0aW9uIG1heWJlVW5lc2NhcGVRdW90ZSgpIHtcbiAgICAgIGlmIChpbmRleCA+PSBwYXRoLmxlbmd0aClcbiAgICAgICAgcmV0dXJuO1xuXG4gICAgICB2YXIgbmV4dENoYXIgPSBwYXRoW2luZGV4ICsgMV07XG4gICAgICBpZiAoKG1vZGUgPT0gJ2luU2luZ2xlUXVvdGUnICYmIG5leHRDaGFyID09IFwiJ1wiKSB8fFxuICAgICAgICAgIChtb2RlID09ICdpbkRvdWJsZVF1b3RlJyAmJiBuZXh0Q2hhciA9PSAnXCInKSkge1xuICAgICAgICBpbmRleCsrO1xuICAgICAgICBuZXdDaGFyID0gbmV4dENoYXI7XG4gICAgICAgIGFjdGlvbnMuYXBwZW5kKCk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgIH1cblxuICAgIHdoaWxlIChtb2RlKSB7XG4gICAgICBpbmRleCsrO1xuICAgICAgYyA9IHBhdGhbaW5kZXhdO1xuXG4gICAgICBpZiAoYyA9PSAnXFxcXCcgJiYgbWF5YmVVbmVzY2FwZVF1b3RlKG1vZGUpKVxuICAgICAgICBjb250aW51ZTtcblxuICAgICAgdHlwZSA9IGdldFBhdGhDaGFyVHlwZShjKTtcbiAgICAgIHR5cGVNYXAgPSBwYXRoU3RhdGVNYWNoaW5lW21vZGVdO1xuICAgICAgdHJhbnNpdGlvbiA9IHR5cGVNYXBbdHlwZV0gfHwgdHlwZU1hcFsnZWxzZSddIHx8ICdlcnJvcic7XG5cbiAgICAgIGlmICh0cmFuc2l0aW9uID09ICdlcnJvcicpXG4gICAgICAgIHJldHVybjsgLy8gcGFyc2UgZXJyb3I7XG5cbiAgICAgIG1vZGUgPSB0cmFuc2l0aW9uWzBdO1xuICAgICAgYWN0aW9uID0gYWN0aW9uc1t0cmFuc2l0aW9uWzFdXSB8fCBub29wO1xuICAgICAgbmV3Q2hhciA9IHRyYW5zaXRpb25bMl0gPT09IHVuZGVmaW5lZCA/IGMgOiB0cmFuc2l0aW9uWzJdO1xuICAgICAgYWN0aW9uKCk7XG5cbiAgICAgIGlmIChtb2RlID09PSAnYWZ0ZXJQYXRoJykge1xuICAgICAgICByZXR1cm4ga2V5cztcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm47IC8vIHBhcnNlIGVycm9yXG4gIH1cblxuICBmdW5jdGlvbiBpc0lkZW50KHMpIHtcbiAgICByZXR1cm4gaWRlbnRSZWdFeHAudGVzdChzKTtcbiAgfVxuXG4gIHZhciBjb25zdHJ1Y3RvcklzUHJpdmF0ZSA9IHt9O1xuXG4gIGZ1bmN0aW9uIFBhdGgocGFydHMsIHByaXZhdGVUb2tlbikge1xuICAgIGlmIChwcml2YXRlVG9rZW4gIT09IGNvbnN0cnVjdG9ySXNQcml2YXRlKVxuICAgICAgdGhyb3cgRXJyb3IoJ1VzZSBQYXRoLmdldCB0byByZXRyaWV2ZSBwYXRoIG9iamVjdHMnKTtcblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcGFydHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHRoaXMucHVzaChTdHJpbmcocGFydHNbaV0pKTtcbiAgICB9XG5cbiAgICBpZiAoaGFzRXZhbCAmJiB0aGlzLmxlbmd0aCkge1xuICAgICAgdGhpcy5nZXRWYWx1ZUZyb20gPSB0aGlzLmNvbXBpbGVkR2V0VmFsdWVGcm9tRm4oKTtcbiAgICB9XG4gIH1cblxuICAvLyBUT0RPKHJhZmFlbHcpOiBNYWtlIHNpbXBsZSBMUlUgY2FjaGVcbiAgdmFyIHBhdGhDYWNoZSA9IHt9O1xuXG4gIGZ1bmN0aW9uIGdldFBhdGgocGF0aFN0cmluZykge1xuICAgIGlmIChwYXRoU3RyaW5nIGluc3RhbmNlb2YgUGF0aClcbiAgICAgIHJldHVybiBwYXRoU3RyaW5nO1xuXG4gICAgaWYgKHBhdGhTdHJpbmcgPT0gbnVsbCB8fCBwYXRoU3RyaW5nLmxlbmd0aCA9PSAwKVxuICAgICAgcGF0aFN0cmluZyA9ICcnO1xuXG4gICAgaWYgKHR5cGVvZiBwYXRoU3RyaW5nICE9ICdzdHJpbmcnKSB7XG4gICAgICBpZiAoaXNJbmRleChwYXRoU3RyaW5nLmxlbmd0aCkpIHtcbiAgICAgICAgLy8gQ29uc3RydWN0ZWQgd2l0aCBhcnJheS1saWtlIChwcmUtcGFyc2VkKSBrZXlzXG4gICAgICAgIHJldHVybiBuZXcgUGF0aChwYXRoU3RyaW5nLCBjb25zdHJ1Y3RvcklzUHJpdmF0ZSk7XG4gICAgICB9XG5cbiAgICAgIHBhdGhTdHJpbmcgPSBTdHJpbmcocGF0aFN0cmluZyk7XG4gICAgfVxuXG4gICAgdmFyIHBhdGggPSBwYXRoQ2FjaGVbcGF0aFN0cmluZ107XG4gICAgaWYgKHBhdGgpXG4gICAgICByZXR1cm4gcGF0aDtcblxuICAgIHZhciBwYXJ0cyA9IHBhcnNlUGF0aChwYXRoU3RyaW5nKTtcbiAgICBpZiAoIXBhcnRzKVxuICAgICAgcmV0dXJuIGludmFsaWRQYXRoO1xuXG4gICAgdmFyIHBhdGggPSBuZXcgUGF0aChwYXJ0cywgY29uc3RydWN0b3JJc1ByaXZhdGUpO1xuICAgIHBhdGhDYWNoZVtwYXRoU3RyaW5nXSA9IHBhdGg7XG4gICAgcmV0dXJuIHBhdGg7XG4gIH1cblxuICBQYXRoLmdldCA9IGdldFBhdGg7XG5cbiAgZnVuY3Rpb24gZm9ybWF0QWNjZXNzb3Ioa2V5KSB7XG4gICAgaWYgKGlzSW5kZXgoa2V5KSkge1xuICAgICAgcmV0dXJuICdbJyArIGtleSArICddJztcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuICdbXCInICsga2V5LnJlcGxhY2UoL1wiL2csICdcXFxcXCInKSArICdcIl0nO1xuICAgIH1cbiAgfVxuXG4gIFBhdGgucHJvdG90eXBlID0gY3JlYXRlT2JqZWN0KHtcbiAgICBfX3Byb3RvX186IFtdLFxuICAgIHZhbGlkOiB0cnVlLFxuXG4gICAgdG9TdHJpbmc6IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIHBhdGhTdHJpbmcgPSAnJztcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIga2V5ID0gdGhpc1tpXTtcbiAgICAgICAgaWYgKGlzSWRlbnQoa2V5KSkge1xuICAgICAgICAgIHBhdGhTdHJpbmcgKz0gaSA/ICcuJyArIGtleSA6IGtleTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwYXRoU3RyaW5nICs9IGZvcm1hdEFjY2Vzc29yKGtleSk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHBhdGhTdHJpbmc7XG4gICAgfSxcblxuICAgIGdldFZhbHVlRnJvbTogZnVuY3Rpb24ob2JqLCBkaXJlY3RPYnNlcnZlcikge1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGlmIChvYmogPT0gbnVsbClcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIG9iaiA9IG9ialt0aGlzW2ldXTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBvYmo7XG4gICAgfSxcblxuICAgIGl0ZXJhdGVPYmplY3RzOiBmdW5jdGlvbihvYmosIG9ic2VydmUpIHtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBpZiAoaSlcbiAgICAgICAgICBvYmogPSBvYmpbdGhpc1tpIC0gMV1dO1xuICAgICAgICBpZiAoIWlzT2JqZWN0KG9iaikpXG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICBvYnNlcnZlKG9iaiwgdGhpc1swXSk7XG4gICAgICB9XG4gICAgfSxcblxuICAgIGNvbXBpbGVkR2V0VmFsdWVGcm9tRm46IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIHN0ciA9ICcnO1xuICAgICAgdmFyIHBhdGhTdHJpbmcgPSAnb2JqJztcbiAgICAgIHN0ciArPSAnaWYgKG9iaiAhPSBudWxsJztcbiAgICAgIHZhciBpID0gMDtcbiAgICAgIHZhciBrZXk7XG4gICAgICBmb3IgKDsgaSA8ICh0aGlzLmxlbmd0aCAtIDEpOyBpKyspIHtcbiAgICAgICAga2V5ID0gdGhpc1tpXTtcbiAgICAgICAgcGF0aFN0cmluZyArPSBpc0lkZW50KGtleSkgPyAnLicgKyBrZXkgOiBmb3JtYXRBY2Nlc3NvcihrZXkpO1xuICAgICAgICBzdHIgKz0gJyAmJlxcbiAgICAgJyArIHBhdGhTdHJpbmcgKyAnICE9IG51bGwnO1xuICAgICAgfVxuICAgICAgc3RyICs9ICcpXFxuJztcblxuICAgICAgdmFyIGtleSA9IHRoaXNbaV07XG4gICAgICBwYXRoU3RyaW5nICs9IGlzSWRlbnQoa2V5KSA/ICcuJyArIGtleSA6IGZvcm1hdEFjY2Vzc29yKGtleSk7XG5cbiAgICAgIHN0ciArPSAnICByZXR1cm4gJyArIHBhdGhTdHJpbmcgKyAnO1xcbmVsc2VcXG4gIHJldHVybiB1bmRlZmluZWQ7JztcbiAgICAgIHJldHVybiBuZXcgRnVuY3Rpb24oJ29iaicsIHN0cik7XG4gICAgfSxcblxuICAgIHNldFZhbHVlRnJvbTogZnVuY3Rpb24ob2JqLCB2YWx1ZSkge1xuICAgICAgaWYgKCF0aGlzLmxlbmd0aClcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuXG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMubGVuZ3RoIC0gMTsgaSsrKSB7XG4gICAgICAgIGlmICghaXNPYmplY3Qob2JqKSlcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIG9iaiA9IG9ialt0aGlzW2ldXTtcbiAgICAgIH1cblxuICAgICAgaWYgKCFpc09iamVjdChvYmopKVxuICAgICAgICByZXR1cm4gZmFsc2U7XG5cbiAgICAgIG9ialt0aGlzW2ldXSA9IHZhbHVlO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICB9KTtcblxuICB2YXIgaW52YWxpZFBhdGggPSBuZXcgUGF0aCgnJywgY29uc3RydWN0b3JJc1ByaXZhdGUpO1xuICBpbnZhbGlkUGF0aC52YWxpZCA9IGZhbHNlO1xuICBpbnZhbGlkUGF0aC5nZXRWYWx1ZUZyb20gPSBpbnZhbGlkUGF0aC5zZXRWYWx1ZUZyb20gPSBmdW5jdGlvbigpIHt9O1xuXG4gIHZhciBNQVhfRElSVFlfQ0hFQ0tfQ1lDTEVTID0gMTAwMDtcblxuICBmdW5jdGlvbiBkaXJ0eUNoZWNrKG9ic2VydmVyKSB7XG4gICAgdmFyIGN5Y2xlcyA9IDA7XG4gICAgd2hpbGUgKGN5Y2xlcyA8IE1BWF9ESVJUWV9DSEVDS19DWUNMRVMgJiYgb2JzZXJ2ZXIuY2hlY2tfKCkpIHtcbiAgICAgIGN5Y2xlcysrO1xuICAgIH1cbiAgICBpZiAodGVzdGluZ0V4cG9zZUN5Y2xlQ291bnQpXG4gICAgICBnbG9iYWwuZGlydHlDaGVja0N5Y2xlQ291bnQgPSBjeWNsZXM7XG5cbiAgICByZXR1cm4gY3ljbGVzID4gMDtcbiAgfVxuXG4gIGZ1bmN0aW9uIG9iamVjdElzRW1wdHkob2JqZWN0KSB7XG4gICAgZm9yICh2YXIgcHJvcCBpbiBvYmplY3QpXG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICBmdW5jdGlvbiBkaWZmSXNFbXB0eShkaWZmKSB7XG4gICAgcmV0dXJuIG9iamVjdElzRW1wdHkoZGlmZi5hZGRlZCkgJiZcbiAgICAgICAgICAgb2JqZWN0SXNFbXB0eShkaWZmLnJlbW92ZWQpICYmXG4gICAgICAgICAgIG9iamVjdElzRW1wdHkoZGlmZi5jaGFuZ2VkKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGRpZmZPYmplY3RGcm9tT2xkT2JqZWN0KG9iamVjdCwgb2xkT2JqZWN0KSB7XG4gICAgdmFyIGFkZGVkID0ge307XG4gICAgdmFyIHJlbW92ZWQgPSB7fTtcbiAgICB2YXIgY2hhbmdlZCA9IHt9O1xuXG4gICAgZm9yICh2YXIgcHJvcCBpbiBvbGRPYmplY3QpIHtcbiAgICAgIHZhciBuZXdWYWx1ZSA9IG9iamVjdFtwcm9wXTtcblxuICAgICAgaWYgKG5ld1ZhbHVlICE9PSB1bmRlZmluZWQgJiYgbmV3VmFsdWUgPT09IG9sZE9iamVjdFtwcm9wXSlcbiAgICAgICAgY29udGludWU7XG5cbiAgICAgIGlmICghKHByb3AgaW4gb2JqZWN0KSkge1xuICAgICAgICByZW1vdmVkW3Byb3BdID0gdW5kZWZpbmVkO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKG5ld1ZhbHVlICE9PSBvbGRPYmplY3RbcHJvcF0pXG4gICAgICAgIGNoYW5nZWRbcHJvcF0gPSBuZXdWYWx1ZTtcbiAgICB9XG5cbiAgICBmb3IgKHZhciBwcm9wIGluIG9iamVjdCkge1xuICAgICAgaWYgKHByb3AgaW4gb2xkT2JqZWN0KVxuICAgICAgICBjb250aW51ZTtcblxuICAgICAgYWRkZWRbcHJvcF0gPSBvYmplY3RbcHJvcF07XG4gICAgfVxuXG4gICAgaWYgKEFycmF5LmlzQXJyYXkob2JqZWN0KSAmJiBvYmplY3QubGVuZ3RoICE9PSBvbGRPYmplY3QubGVuZ3RoKVxuICAgICAgY2hhbmdlZC5sZW5ndGggPSBvYmplY3QubGVuZ3RoO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIGFkZGVkOiBhZGRlZCxcbiAgICAgIHJlbW92ZWQ6IHJlbW92ZWQsXG4gICAgICBjaGFuZ2VkOiBjaGFuZ2VkXG4gICAgfTtcbiAgfVxuXG4gIHZhciBlb21UYXNrcyA9IFtdO1xuICBmdW5jdGlvbiBydW5FT01UYXNrcygpIHtcbiAgICBpZiAoIWVvbVRhc2tzLmxlbmd0aClcbiAgICAgIHJldHVybiBmYWxzZTtcblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgZW9tVGFza3MubGVuZ3RoOyBpKyspIHtcbiAgICAgIGVvbVRhc2tzW2ldKCk7XG4gICAgfVxuICAgIGVvbVRhc2tzLmxlbmd0aCA9IDA7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICB2YXIgcnVuRU9NID0gaGFzT2JzZXJ2ZSA/IChmdW5jdGlvbigpe1xuICAgIHZhciBlb21PYmogPSB7IHBpbmdQb25nOiB0cnVlIH07XG4gICAgdmFyIGVvbVJ1blNjaGVkdWxlZCA9IGZhbHNlO1xuXG4gICAgT2JqZWN0Lm9ic2VydmUoZW9tT2JqLCBmdW5jdGlvbigpIHtcbiAgICAgIHJ1bkVPTVRhc2tzKCk7XG4gICAgICBlb21SdW5TY2hlZHVsZWQgPSBmYWxzZTtcbiAgICB9KTtcblxuICAgIHJldHVybiBmdW5jdGlvbihmbikge1xuICAgICAgZW9tVGFza3MucHVzaChmbik7XG4gICAgICBpZiAoIWVvbVJ1blNjaGVkdWxlZCkge1xuICAgICAgICBlb21SdW5TY2hlZHVsZWQgPSB0cnVlO1xuICAgICAgICBlb21PYmoucGluZ1BvbmcgPSAhZW9tT2JqLnBpbmdQb25nO1xuICAgICAgfVxuICAgIH07XG4gIH0pKCkgOlxuICAoZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKGZuKSB7XG4gICAgICBlb21UYXNrcy5wdXNoKGZuKTtcbiAgICB9O1xuICB9KSgpO1xuXG4gIHZhciBvYnNlcnZlZE9iamVjdENhY2hlID0gW107XG5cbiAgZnVuY3Rpb24gbmV3T2JzZXJ2ZWRPYmplY3QoKSB7XG4gICAgdmFyIG9ic2VydmVyO1xuICAgIHZhciBvYmplY3Q7XG4gICAgdmFyIGRpc2NhcmRSZWNvcmRzID0gZmFsc2U7XG4gICAgdmFyIGZpcnN0ID0gdHJ1ZTtcblxuICAgIGZ1bmN0aW9uIGNhbGxiYWNrKHJlY29yZHMpIHtcbiAgICAgIGlmIChvYnNlcnZlciAmJiBvYnNlcnZlci5zdGF0ZV8gPT09IE9QRU5FRCAmJiAhZGlzY2FyZFJlY29yZHMpXG4gICAgICAgIG9ic2VydmVyLmNoZWNrXyhyZWNvcmRzKTtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgb3BlbjogZnVuY3Rpb24ob2JzKSB7XG4gICAgICAgIGlmIChvYnNlcnZlcilcbiAgICAgICAgICB0aHJvdyBFcnJvcignT2JzZXJ2ZWRPYmplY3QgaW4gdXNlJyk7XG5cbiAgICAgICAgaWYgKCFmaXJzdClcbiAgICAgICAgICBPYmplY3QuZGVsaXZlckNoYW5nZVJlY29yZHMoY2FsbGJhY2spO1xuXG4gICAgICAgIG9ic2VydmVyID0gb2JzO1xuICAgICAgICBmaXJzdCA9IGZhbHNlO1xuICAgICAgfSxcbiAgICAgIG9ic2VydmU6IGZ1bmN0aW9uKG9iaiwgYXJyYXlPYnNlcnZlKSB7XG4gICAgICAgIG9iamVjdCA9IG9iajtcbiAgICAgICAgaWYgKGFycmF5T2JzZXJ2ZSlcbiAgICAgICAgICBBcnJheS5vYnNlcnZlKG9iamVjdCwgY2FsbGJhY2spO1xuICAgICAgICBlbHNlXG4gICAgICAgICAgT2JqZWN0Lm9ic2VydmUob2JqZWN0LCBjYWxsYmFjayk7XG4gICAgICB9LFxuICAgICAgZGVsaXZlcjogZnVuY3Rpb24oZGlzY2FyZCkge1xuICAgICAgICBkaXNjYXJkUmVjb3JkcyA9IGRpc2NhcmQ7XG4gICAgICAgIE9iamVjdC5kZWxpdmVyQ2hhbmdlUmVjb3JkcyhjYWxsYmFjayk7XG4gICAgICAgIGRpc2NhcmRSZWNvcmRzID0gZmFsc2U7XG4gICAgICB9LFxuICAgICAgY2xvc2U6IGZ1bmN0aW9uKCkge1xuICAgICAgICBvYnNlcnZlciA9IHVuZGVmaW5lZDtcbiAgICAgICAgT2JqZWN0LnVub2JzZXJ2ZShvYmplY3QsIGNhbGxiYWNrKTtcbiAgICAgICAgb2JzZXJ2ZWRPYmplY3RDYWNoZS5wdXNoKHRoaXMpO1xuICAgICAgfVxuICAgIH07XG4gIH1cblxuICAvKlxuICAgKiBUaGUgb2JzZXJ2ZWRTZXQgYWJzdHJhY3Rpb24gaXMgYSBwZXJmIG9wdGltaXphdGlvbiB3aGljaCByZWR1Y2VzIHRoZSB0b3RhbFxuICAgKiBudW1iZXIgb2YgT2JqZWN0Lm9ic2VydmUgb2JzZXJ2YXRpb25zIG9mIGEgc2V0IG9mIG9iamVjdHMuIFRoZSBpZGVhIGlzIHRoYXRcbiAgICogZ3JvdXBzIG9mIE9ic2VydmVycyB3aWxsIGhhdmUgc29tZSBvYmplY3QgZGVwZW5kZW5jaWVzIGluIGNvbW1vbiBhbmQgdGhpc1xuICAgKiBvYnNlcnZlZCBzZXQgZW5zdXJlcyB0aGF0IGVhY2ggb2JqZWN0IGluIHRoZSB0cmFuc2l0aXZlIGNsb3N1cmUgb2ZcbiAgICogZGVwZW5kZW5jaWVzIGlzIG9ubHkgb2JzZXJ2ZWQgb25jZS4gVGhlIG9ic2VydmVkU2V0IGFjdHMgYXMgYSB3cml0ZSBiYXJyaWVyXG4gICAqIHN1Y2ggdGhhdCB3aGVuZXZlciBhbnkgY2hhbmdlIGNvbWVzIHRocm91Z2gsIGFsbCBPYnNlcnZlcnMgYXJlIGNoZWNrZWQgZm9yXG4gICAqIGNoYW5nZWQgdmFsdWVzLlxuICAgKlxuICAgKiBOb3RlIHRoYXQgdGhpcyBvcHRpbWl6YXRpb24gaXMgZXhwbGljaXRseSBtb3Zpbmcgd29yayBmcm9tIHNldHVwLXRpbWUgdG9cbiAgICogY2hhbmdlLXRpbWUuXG4gICAqXG4gICAqIFRPRE8ocmFmYWVsdyk6IEltcGxlbWVudCBcImdhcmJhZ2UgY29sbGVjdGlvblwiLiBJbiBvcmRlciB0byBtb3ZlIHdvcmsgb2ZmXG4gICAqIHRoZSBjcml0aWNhbCBwYXRoLCB3aGVuIE9ic2VydmVycyBhcmUgY2xvc2VkLCB0aGVpciBvYnNlcnZlZCBvYmplY3RzIGFyZVxuICAgKiBub3QgT2JqZWN0LnVub2JzZXJ2ZShkKS4gQXMgYSByZXN1bHQsIGl0J3NpZXN0YSBwb3NzaWJsZSB0aGF0IGlmIHRoZSBvYnNlcnZlZFNldFxuICAgKiBpcyBrZXB0IG9wZW4sIGJ1dCBzb21lIE9ic2VydmVycyBoYXZlIGJlZW4gY2xvc2VkLCBpdCBjb3VsZCBjYXVzZSBcImxlYWtzXCJcbiAgICogKHByZXZlbnQgb3RoZXJ3aXNlIGNvbGxlY3RhYmxlIG9iamVjdHMgZnJvbSBiZWluZyBjb2xsZWN0ZWQpLiBBdCBzb21lXG4gICAqIHBvaW50LCB3ZSBzaG91bGQgaW1wbGVtZW50IGluY3JlbWVudGFsIFwiZ2NcIiB3aGljaCBrZWVwcyBhIGxpc3Qgb2ZcbiAgICogb2JzZXJ2ZWRTZXRzIHdoaWNoIG1heSBuZWVkIGNsZWFuLXVwIGFuZCBkb2VzIHNtYWxsIGFtb3VudHMgb2YgY2xlYW51cCBvbiBhXG4gICAqIHRpbWVvdXQgdW50aWwgYWxsIGlzIGNsZWFuLlxuICAgKi9cblxuICBmdW5jdGlvbiBnZXRPYnNlcnZlZE9iamVjdChvYnNlcnZlciwgb2JqZWN0LCBhcnJheU9ic2VydmUpIHtcbiAgICB2YXIgZGlyID0gb2JzZXJ2ZWRPYmplY3RDYWNoZS5wb3AoKSB8fCBuZXdPYnNlcnZlZE9iamVjdCgpO1xuICAgIGRpci5vcGVuKG9ic2VydmVyKTtcbiAgICBkaXIub2JzZXJ2ZShvYmplY3QsIGFycmF5T2JzZXJ2ZSk7XG4gICAgcmV0dXJuIGRpcjtcbiAgfVxuXG4gIHZhciBvYnNlcnZlZFNldENhY2hlID0gW107XG5cbiAgZnVuY3Rpb24gbmV3T2JzZXJ2ZWRTZXQoKSB7XG4gICAgdmFyIG9ic2VydmVyQ291bnQgPSAwO1xuICAgIHZhciBvYnNlcnZlcnMgPSBbXTtcbiAgICB2YXIgb2JqZWN0cyA9IFtdO1xuICAgIHZhciByb290T2JqO1xuICAgIHZhciByb290T2JqUHJvcHM7XG5cbiAgICBmdW5jdGlvbiBvYnNlcnZlKG9iaiwgcHJvcCkge1xuICAgICAgaWYgKCFvYmopXG4gICAgICAgIHJldHVybjtcblxuICAgICAgaWYgKG9iaiA9PT0gcm9vdE9iailcbiAgICAgICAgcm9vdE9ialByb3BzW3Byb3BdID0gdHJ1ZTtcblxuICAgICAgaWYgKG9iamVjdHMuaW5kZXhPZihvYmopIDwgMCkge1xuICAgICAgICBvYmplY3RzLnB1c2gob2JqKTtcbiAgICAgICAgT2JqZWN0Lm9ic2VydmUob2JqLCBjYWxsYmFjayk7XG4gICAgICB9XG5cbiAgICAgIG9ic2VydmUoT2JqZWN0LmdldFByb3RvdHlwZU9mKG9iaiksIHByb3ApO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGFsbFJvb3RPYmpOb25PYnNlcnZlZFByb3BzKHJlY3MpIHtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcmVjcy5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgcmVjID0gcmVjc1tpXTtcbiAgICAgICAgaWYgKHJlYy5vYmplY3QgIT09IHJvb3RPYmogfHxcbiAgICAgICAgICAgIHJvb3RPYmpQcm9wc1tyZWMubmFtZV0gfHxcbiAgICAgICAgICAgIHJlYy50eXBlID09PSAnc2V0UHJvdG90eXBlJykge1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gY2FsbGJhY2socmVjcykge1xuICAgICAgaWYgKGFsbFJvb3RPYmpOb25PYnNlcnZlZFByb3BzKHJlY3MpKVxuICAgICAgICByZXR1cm47XG5cbiAgICAgIHZhciBvYnNlcnZlcjtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgb2JzZXJ2ZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIG9ic2VydmVyID0gb2JzZXJ2ZXJzW2ldO1xuICAgICAgICBpZiAob2JzZXJ2ZXIuc3RhdGVfID09IE9QRU5FRCkge1xuICAgICAgICAgIG9ic2VydmVyLml0ZXJhdGVPYmplY3RzXyhvYnNlcnZlKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IG9ic2VydmVycy5sZW5ndGg7IGkrKykge1xuICAgICAgICBvYnNlcnZlciA9IG9ic2VydmVyc1tpXTtcbiAgICAgICAgaWYgKG9ic2VydmVyLnN0YXRlXyA9PSBPUEVORUQpIHtcbiAgICAgICAgICBvYnNlcnZlci5jaGVja18oKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIHZhciByZWNvcmQgPSB7XG4gICAgICBvYmplY3Q6IHVuZGVmaW5lZCxcbiAgICAgIG9iamVjdHM6IG9iamVjdHMsXG4gICAgICBvcGVuOiBmdW5jdGlvbihvYnMsIG9iamVjdCkge1xuICAgICAgICBpZiAoIXJvb3RPYmopIHtcbiAgICAgICAgICByb290T2JqID0gb2JqZWN0O1xuICAgICAgICAgIHJvb3RPYmpQcm9wcyA9IHt9O1xuICAgICAgICB9XG5cbiAgICAgICAgb2JzZXJ2ZXJzLnB1c2gob2JzKTtcbiAgICAgICAgb2JzZXJ2ZXJDb3VudCsrO1xuICAgICAgICBvYnMuaXRlcmF0ZU9iamVjdHNfKG9ic2VydmUpO1xuICAgICAgfSxcbiAgICAgIGNsb3NlOiBmdW5jdGlvbihvYnMpIHtcbiAgICAgICAgb2JzZXJ2ZXJDb3VudC0tO1xuICAgICAgICBpZiAob2JzZXJ2ZXJDb3VudCA+IDApIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IG9iamVjdHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICBPYmplY3QudW5vYnNlcnZlKG9iamVjdHNbaV0sIGNhbGxiYWNrKTtcbiAgICAgICAgICBPYnNlcnZlci51bm9ic2VydmVkQ291bnQrKztcbiAgICAgICAgfVxuXG4gICAgICAgIG9ic2VydmVycy5sZW5ndGggPSAwO1xuICAgICAgICBvYmplY3RzLmxlbmd0aCA9IDA7XG4gICAgICAgIHJvb3RPYmogPSB1bmRlZmluZWQ7XG4gICAgICAgIHJvb3RPYmpQcm9wcyA9IHVuZGVmaW5lZDtcbiAgICAgICAgb2JzZXJ2ZWRTZXRDYWNoZS5wdXNoKHRoaXMpO1xuICAgICAgfVxuICAgIH07XG5cbiAgICByZXR1cm4gcmVjb3JkO1xuICB9XG5cbiAgdmFyIGxhc3RPYnNlcnZlZFNldDtcblxuICBmdW5jdGlvbiBnZXRPYnNlcnZlZFNldChvYnNlcnZlciwgb2JqKSB7XG4gICAgaWYgKCFsYXN0T2JzZXJ2ZWRTZXQgfHwgbGFzdE9ic2VydmVkU2V0Lm9iamVjdCAhPT0gb2JqKSB7XG4gICAgICBsYXN0T2JzZXJ2ZWRTZXQgPSBvYnNlcnZlZFNldENhY2hlLnBvcCgpIHx8IG5ld09ic2VydmVkU2V0KCk7XG4gICAgICBsYXN0T2JzZXJ2ZWRTZXQub2JqZWN0ID0gb2JqO1xuICAgIH1cbiAgICBsYXN0T2JzZXJ2ZWRTZXQub3BlbihvYnNlcnZlciwgb2JqKTtcbiAgICByZXR1cm4gbGFzdE9ic2VydmVkU2V0O1xuICB9XG5cbiAgdmFyIFVOT1BFTkVEID0gMDtcbiAgdmFyIE9QRU5FRCA9IDE7XG4gIHZhciBDTE9TRUQgPSAyO1xuICB2YXIgUkVTRVRUSU5HID0gMztcblxuICB2YXIgbmV4dE9ic2VydmVySWQgPSAxO1xuXG4gIGZ1bmN0aW9uIE9ic2VydmVyKCkge1xuICAgIHRoaXMuc3RhdGVfID0gVU5PUEVORUQ7XG4gICAgdGhpcy5jYWxsYmFja18gPSB1bmRlZmluZWQ7XG4gICAgdGhpcy50YXJnZXRfID0gdW5kZWZpbmVkOyAvLyBUT0RPKHJhZmFlbHcpOiBTaG91bGQgYmUgV2Vha1JlZlxuICAgIHRoaXMuZGlyZWN0T2JzZXJ2ZXJfID0gdW5kZWZpbmVkO1xuICAgIHRoaXMudmFsdWVfID0gdW5kZWZpbmVkO1xuICAgIHRoaXMuaWRfID0gbmV4dE9ic2VydmVySWQrKztcbiAgfVxuXG4gIE9ic2VydmVyLnByb3RvdHlwZSA9IHtcbiAgICBvcGVuOiBmdW5jdGlvbihjYWxsYmFjaywgdGFyZ2V0KSB7XG4gICAgICBpZiAodGhpcy5zdGF0ZV8gIT0gVU5PUEVORUQpXG4gICAgICAgIHRocm93IEVycm9yKCdPYnNlcnZlciBoYXMgYWxyZWFkeSBiZWVuIG9wZW5lZC4nKTtcblxuICAgICAgYWRkVG9BbGwodGhpcyk7XG4gICAgICB0aGlzLmNhbGxiYWNrXyA9IGNhbGxiYWNrO1xuICAgICAgdGhpcy50YXJnZXRfID0gdGFyZ2V0O1xuICAgICAgdGhpcy5jb25uZWN0XygpO1xuICAgICAgdGhpcy5zdGF0ZV8gPSBPUEVORUQ7XG4gICAgICByZXR1cm4gdGhpcy52YWx1ZV87XG4gICAgfSxcblxuICAgIGNsb3NlOiBmdW5jdGlvbigpIHtcbiAgICAgIGlmICh0aGlzLnN0YXRlXyAhPSBPUEVORUQpXG4gICAgICAgIHJldHVybjtcblxuICAgICAgcmVtb3ZlRnJvbUFsbCh0aGlzKTtcbiAgICAgIHRoaXMuZGlzY29ubmVjdF8oKTtcbiAgICAgIHRoaXMudmFsdWVfID0gdW5kZWZpbmVkO1xuICAgICAgdGhpcy5jYWxsYmFja18gPSB1bmRlZmluZWQ7XG4gICAgICB0aGlzLnRhcmdldF8gPSB1bmRlZmluZWQ7XG4gICAgICB0aGlzLnN0YXRlXyA9IENMT1NFRDtcbiAgICB9LFxuXG4gICAgZGVsaXZlcjogZnVuY3Rpb24oKSB7XG4gICAgICBpZiAodGhpcy5zdGF0ZV8gIT0gT1BFTkVEKVxuICAgICAgICByZXR1cm47XG5cbiAgICAgIGRpcnR5Q2hlY2sodGhpcyk7XG4gICAgfSxcblxuICAgIHJlcG9ydF86IGZ1bmN0aW9uKGNoYW5nZXMpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHRoaXMuY2FsbGJhY2tfLmFwcGx5KHRoaXMudGFyZ2V0XywgY2hhbmdlcyk7XG4gICAgICB9IGNhdGNoIChleCkge1xuICAgICAgICBPYnNlcnZlci5fZXJyb3JUaHJvd25EdXJpbmdDYWxsYmFjayA9IHRydWU7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ0V4Y2VwdGlvbiBjYXVnaHQgZHVyaW5nIG9ic2VydmVyIGNhbGxiYWNrOiAnICtcbiAgICAgICAgICAgICAgICAgICAgICAgKGV4LnN0YWNrIHx8IGV4KSk7XG4gICAgICB9XG4gICAgfSxcblxuICAgIGRpc2NhcmRDaGFuZ2VzOiBmdW5jdGlvbigpIHtcbiAgICAgIHRoaXMuY2hlY2tfKHVuZGVmaW5lZCwgdHJ1ZSk7XG4gICAgICByZXR1cm4gdGhpcy52YWx1ZV87XG4gICAgfVxuICB9XG5cbiAgdmFyIGNvbGxlY3RPYnNlcnZlcnMgPSAhaGFzT2JzZXJ2ZTtcbiAgdmFyIGFsbE9ic2VydmVycztcbiAgT2JzZXJ2ZXIuX2FsbE9ic2VydmVyc0NvdW50ID0gMDtcblxuICBpZiAoY29sbGVjdE9ic2VydmVycykge1xuICAgIGFsbE9ic2VydmVycyA9IFtdO1xuICB9XG5cbiAgZnVuY3Rpb24gYWRkVG9BbGwob2JzZXJ2ZXIpIHtcbiAgICBPYnNlcnZlci5fYWxsT2JzZXJ2ZXJzQ291bnQrKztcbiAgICBpZiAoIWNvbGxlY3RPYnNlcnZlcnMpXG4gICAgICByZXR1cm47XG5cbiAgICBhbGxPYnNlcnZlcnMucHVzaChvYnNlcnZlcik7XG4gIH1cblxuICBmdW5jdGlvbiByZW1vdmVGcm9tQWxsKG9ic2VydmVyKSB7XG4gICAgT2JzZXJ2ZXIuX2FsbE9ic2VydmVyc0NvdW50LS07XG4gIH1cblxuICB2YXIgcnVubmluZ01pY3JvdGFza0NoZWNrcG9pbnQgPSBmYWxzZTtcblxuICB2YXIgaGFzRGVidWdGb3JjZUZ1bGxEZWxpdmVyeSA9IGhhc09ic2VydmUgJiYgaGFzRXZhbCAmJiAoZnVuY3Rpb24oKSB7XG4gICAgdHJ5IHtcbiAgICAgIGV2YWwoJyVSdW5NaWNyb3Rhc2tzKCknKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0gY2F0Y2ggKGV4KSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9KSgpO1xuXG4gIGdsb2JhbC5QbGF0Zm9ybSA9IGdsb2JhbC5QbGF0Zm9ybSB8fCB7fTtcblxuICBnbG9iYWwuUGxhdGZvcm0ucGVyZm9ybU1pY3JvdGFza0NoZWNrcG9pbnQgPSBmdW5jdGlvbigpIHtcbiAgICBpZiAocnVubmluZ01pY3JvdGFza0NoZWNrcG9pbnQpXG4gICAgICByZXR1cm47XG5cbiAgICBpZiAoaGFzRGVidWdGb3JjZUZ1bGxEZWxpdmVyeSkge1xuICAgICAgZXZhbCgnJVJ1bk1pY3JvdGFza3MoKScpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmICghY29sbGVjdE9ic2VydmVycylcbiAgICAgIHJldHVybjtcblxuICAgIHJ1bm5pbmdNaWNyb3Rhc2tDaGVja3BvaW50ID0gdHJ1ZTtcblxuICAgIHZhciBjeWNsZXMgPSAwO1xuICAgIHZhciBhbnlDaGFuZ2VkLCB0b0NoZWNrO1xuXG4gICAgZG8ge1xuICAgICAgY3ljbGVzKys7XG4gICAgICB0b0NoZWNrID0gYWxsT2JzZXJ2ZXJzO1xuICAgICAgYWxsT2JzZXJ2ZXJzID0gW107XG4gICAgICBhbnlDaGFuZ2VkID0gZmFsc2U7XG5cbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdG9DaGVjay5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgb2JzZXJ2ZXIgPSB0b0NoZWNrW2ldO1xuICAgICAgICBpZiAob2JzZXJ2ZXIuc3RhdGVfICE9IE9QRU5FRClcbiAgICAgICAgICBjb250aW51ZTtcblxuICAgICAgICBpZiAob2JzZXJ2ZXIuY2hlY2tfKCkpXG4gICAgICAgICAgYW55Q2hhbmdlZCA9IHRydWU7XG5cbiAgICAgICAgYWxsT2JzZXJ2ZXJzLnB1c2gob2JzZXJ2ZXIpO1xuICAgICAgfVxuICAgICAgaWYgKHJ1bkVPTVRhc2tzKCkpXG4gICAgICAgIGFueUNoYW5nZWQgPSB0cnVlO1xuICAgIH0gd2hpbGUgKGN5Y2xlcyA8IE1BWF9ESVJUWV9DSEVDS19DWUNMRVMgJiYgYW55Q2hhbmdlZCk7XG5cbiAgICBpZiAodGVzdGluZ0V4cG9zZUN5Y2xlQ291bnQpXG4gICAgICBnbG9iYWwuZGlydHlDaGVja0N5Y2xlQ291bnQgPSBjeWNsZXM7XG5cbiAgICBydW5uaW5nTWljcm90YXNrQ2hlY2twb2ludCA9IGZhbHNlO1xuICB9O1xuXG4gIGlmIChjb2xsZWN0T2JzZXJ2ZXJzKSB7XG4gICAgZ2xvYmFsLlBsYXRmb3JtLmNsZWFyT2JzZXJ2ZXJzID0gZnVuY3Rpb24oKSB7XG4gICAgICBhbGxPYnNlcnZlcnMgPSBbXTtcbiAgICB9O1xuICB9XG5cbiAgZnVuY3Rpb24gT2JqZWN0T2JzZXJ2ZXIob2JqZWN0KSB7XG4gICAgT2JzZXJ2ZXIuY2FsbCh0aGlzKTtcbiAgICB0aGlzLnZhbHVlXyA9IG9iamVjdDtcbiAgICB0aGlzLm9sZE9iamVjdF8gPSB1bmRlZmluZWQ7XG4gIH1cblxuICBPYmplY3RPYnNlcnZlci5wcm90b3R5cGUgPSBjcmVhdGVPYmplY3Qoe1xuICAgIF9fcHJvdG9fXzogT2JzZXJ2ZXIucHJvdG90eXBlLFxuXG4gICAgYXJyYXlPYnNlcnZlOiBmYWxzZSxcblxuICAgIGNvbm5lY3RfOiBmdW5jdGlvbihjYWxsYmFjaywgdGFyZ2V0KSB7XG4gICAgICBpZiAoaGFzT2JzZXJ2ZSkge1xuICAgICAgICB0aGlzLmRpcmVjdE9ic2VydmVyXyA9IGdldE9ic2VydmVkT2JqZWN0KHRoaXMsIHRoaXMudmFsdWVfLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuYXJyYXlPYnNlcnZlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMub2xkT2JqZWN0XyA9IHRoaXMuY29weU9iamVjdCh0aGlzLnZhbHVlXyk7XG4gICAgICB9XG5cbiAgICB9LFxuXG4gICAgY29weU9iamVjdDogZnVuY3Rpb24ob2JqZWN0KSB7XG4gICAgICB2YXIgY29weSA9IEFycmF5LmlzQXJyYXkob2JqZWN0KSA/IFtdIDoge307XG4gICAgICBmb3IgKHZhciBwcm9wIGluIG9iamVjdCkge1xuICAgICAgICBjb3B5W3Byb3BdID0gb2JqZWN0W3Byb3BdO1xuICAgICAgfTtcbiAgICAgIGlmIChBcnJheS5pc0FycmF5KG9iamVjdCkpXG4gICAgICAgIGNvcHkubGVuZ3RoID0gb2JqZWN0Lmxlbmd0aDtcbiAgICAgIHJldHVybiBjb3B5O1xuICAgIH0sXG5cbiAgICBjaGVja186IGZ1bmN0aW9uKGNoYW5nZVJlY29yZHMsIHNraXBDaGFuZ2VzKSB7XG4gICAgICB2YXIgZGlmZjtcbiAgICAgIHZhciBvbGRWYWx1ZXM7XG4gICAgICBpZiAoaGFzT2JzZXJ2ZSkge1xuICAgICAgICBpZiAoIWNoYW5nZVJlY29yZHMpXG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuXG4gICAgICAgIG9sZFZhbHVlcyA9IHt9O1xuICAgICAgICBkaWZmID0gZGlmZk9iamVjdEZyb21DaGFuZ2VSZWNvcmRzKHRoaXMudmFsdWVfLCBjaGFuZ2VSZWNvcmRzLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9sZFZhbHVlcyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBvbGRWYWx1ZXMgPSB0aGlzLm9sZE9iamVjdF87XG4gICAgICAgIGRpZmYgPSBkaWZmT2JqZWN0RnJvbU9sZE9iamVjdCh0aGlzLnZhbHVlXywgdGhpcy5vbGRPYmplY3RfKTtcbiAgICAgIH1cblxuICAgICAgaWYgKGRpZmZJc0VtcHR5KGRpZmYpKVxuICAgICAgICByZXR1cm4gZmFsc2U7XG5cbiAgICAgIGlmICghaGFzT2JzZXJ2ZSlcbiAgICAgICAgdGhpcy5vbGRPYmplY3RfID0gdGhpcy5jb3B5T2JqZWN0KHRoaXMudmFsdWVfKTtcblxuICAgICAgdGhpcy5yZXBvcnRfKFtcbiAgICAgICAgZGlmZi5hZGRlZCB8fCB7fSxcbiAgICAgICAgZGlmZi5yZW1vdmVkIHx8IHt9LFxuICAgICAgICBkaWZmLmNoYW5nZWQgfHwge30sXG4gICAgICAgIGZ1bmN0aW9uKHByb3BlcnR5KSB7XG4gICAgICAgICAgcmV0dXJuIG9sZFZhbHVlc1twcm9wZXJ0eV07XG4gICAgICAgIH1cbiAgICAgIF0pO1xuXG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9LFxuXG4gICAgZGlzY29ubmVjdF86IGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKGhhc09ic2VydmUpIHtcbiAgICAgICAgdGhpcy5kaXJlY3RPYnNlcnZlcl8uY2xvc2UoKTtcbiAgICAgICAgdGhpcy5kaXJlY3RPYnNlcnZlcl8gPSB1bmRlZmluZWQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLm9sZE9iamVjdF8gPSB1bmRlZmluZWQ7XG4gICAgICB9XG4gICAgfSxcblxuICAgIGRlbGl2ZXI6IGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKHRoaXMuc3RhdGVfICE9IE9QRU5FRClcbiAgICAgICAgcmV0dXJuO1xuXG4gICAgICBpZiAoaGFzT2JzZXJ2ZSlcbiAgICAgICAgdGhpcy5kaXJlY3RPYnNlcnZlcl8uZGVsaXZlcihmYWxzZSk7XG4gICAgICBlbHNlXG4gICAgICAgIGRpcnR5Q2hlY2sodGhpcyk7XG4gICAgfSxcblxuICAgIGRpc2NhcmRDaGFuZ2VzOiBmdW5jdGlvbigpIHtcbiAgICAgIGlmICh0aGlzLmRpcmVjdE9ic2VydmVyXylcbiAgICAgICAgdGhpcy5kaXJlY3RPYnNlcnZlcl8uZGVsaXZlcih0cnVlKTtcbiAgICAgIGVsc2VcbiAgICAgICAgdGhpcy5vbGRPYmplY3RfID0gdGhpcy5jb3B5T2JqZWN0KHRoaXMudmFsdWVfKTtcblxuICAgICAgcmV0dXJuIHRoaXMudmFsdWVfO1xuICAgIH1cbiAgfSk7XG5cbiAgZnVuY3Rpb24gQXJyYXlPYnNlcnZlcihhcnJheSkge1xuICAgIGlmICghQXJyYXkuaXNBcnJheShhcnJheSkpXG4gICAgICB0aHJvdyBFcnJvcignUHJvdmlkZWQgb2JqZWN0IGlzIG5vdCBhbiBBcnJheScpO1xuICAgIE9iamVjdE9ic2VydmVyLmNhbGwodGhpcywgYXJyYXkpO1xuICB9XG5cbiAgQXJyYXlPYnNlcnZlci5wcm90b3R5cGUgPSBjcmVhdGVPYmplY3Qoe1xuXG4gICAgX19wcm90b19fOiBPYmplY3RPYnNlcnZlci5wcm90b3R5cGUsXG5cbiAgICBhcnJheU9ic2VydmU6IHRydWUsXG5cbiAgICBjb3B5T2JqZWN0OiBmdW5jdGlvbihhcnIpIHtcbiAgICAgIHJldHVybiBhcnIuc2xpY2UoKTtcbiAgICB9LFxuXG4gICAgY2hlY2tfOiBmdW5jdGlvbihjaGFuZ2VSZWNvcmRzKSB7XG4gICAgICB2YXIgc3BsaWNlcztcbiAgICAgIGlmIChoYXNPYnNlcnZlKSB7XG4gICAgICAgIGlmICghY2hhbmdlUmVjb3JkcylcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIHNwbGljZXMgPSBwcm9qZWN0QXJyYXlTcGxpY2VzKHRoaXMudmFsdWVfLCBjaGFuZ2VSZWNvcmRzKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHNwbGljZXMgPSBjYWxjU3BsaWNlcyh0aGlzLnZhbHVlXywgMCwgdGhpcy52YWx1ZV8ubGVuZ3RoLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5vbGRPYmplY3RfLCAwLCB0aGlzLm9sZE9iamVjdF8ubGVuZ3RoKTtcbiAgICAgIH1cblxuICAgICAgaWYgKCFzcGxpY2VzIHx8ICFzcGxpY2VzLmxlbmd0aClcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuXG4gICAgICBpZiAoIWhhc09ic2VydmUpXG4gICAgICAgIHRoaXMub2xkT2JqZWN0XyA9IHRoaXMuY29weU9iamVjdCh0aGlzLnZhbHVlXyk7XG5cbiAgICAgIHRoaXMucmVwb3J0Xyhbc3BsaWNlc10pO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICB9KTtcblxuICBBcnJheU9ic2VydmVyLmFwcGx5U3BsaWNlcyA9IGZ1bmN0aW9uKHByZXZpb3VzLCBjdXJyZW50LCBzcGxpY2VzKSB7XG4gICAgc3BsaWNlcy5mb3JFYWNoKGZ1bmN0aW9uKHNwbGljZSkge1xuICAgICAgdmFyIHNwbGljZUFyZ3MgPSBbc3BsaWNlLmluZGV4LCBzcGxpY2UucmVtb3ZlZC5sZW5ndGhdO1xuICAgICAgdmFyIGFkZEluZGV4ID0gc3BsaWNlLmluZGV4O1xuICAgICAgd2hpbGUgKGFkZEluZGV4IDwgc3BsaWNlLmluZGV4ICsgc3BsaWNlLmFkZGVkQ291bnQpIHtcbiAgICAgICAgc3BsaWNlQXJncy5wdXNoKGN1cnJlbnRbYWRkSW5kZXhdKTtcbiAgICAgICAgYWRkSW5kZXgrKztcbiAgICAgIH1cblxuICAgICAgQXJyYXkucHJvdG90eXBlLnNwbGljZS5hcHBseShwcmV2aW91cywgc3BsaWNlQXJncyk7XG4gICAgfSk7XG4gIH07XG5cbiAgZnVuY3Rpb24gUGF0aE9ic2VydmVyKG9iamVjdCwgcGF0aCkge1xuICAgIE9ic2VydmVyLmNhbGwodGhpcyk7XG5cbiAgICB0aGlzLm9iamVjdF8gPSBvYmplY3Q7XG4gICAgdGhpcy5wYXRoXyA9IGdldFBhdGgocGF0aCk7XG4gICAgdGhpcy5kaXJlY3RPYnNlcnZlcl8gPSB1bmRlZmluZWQ7XG4gIH1cblxuICBQYXRoT2JzZXJ2ZXIucHJvdG90eXBlID0gY3JlYXRlT2JqZWN0KHtcbiAgICBfX3Byb3RvX186IE9ic2VydmVyLnByb3RvdHlwZSxcblxuICAgIGdldCBwYXRoKCkge1xuICAgICAgcmV0dXJuIHRoaXMucGF0aF87XG4gICAgfSxcblxuICAgIGNvbm5lY3RfOiBmdW5jdGlvbigpIHtcbiAgICAgIGlmIChoYXNPYnNlcnZlKVxuICAgICAgICB0aGlzLmRpcmVjdE9ic2VydmVyXyA9IGdldE9ic2VydmVkU2V0KHRoaXMsIHRoaXMub2JqZWN0Xyk7XG5cbiAgICAgIHRoaXMuY2hlY2tfKHVuZGVmaW5lZCwgdHJ1ZSk7XG4gICAgfSxcblxuICAgIGRpc2Nvbm5lY3RfOiBmdW5jdGlvbigpIHtcbiAgICAgIHRoaXMudmFsdWVfID0gdW5kZWZpbmVkO1xuXG4gICAgICBpZiAodGhpcy5kaXJlY3RPYnNlcnZlcl8pIHtcbiAgICAgICAgdGhpcy5kaXJlY3RPYnNlcnZlcl8uY2xvc2UodGhpcyk7XG4gICAgICAgIHRoaXMuZGlyZWN0T2JzZXJ2ZXJfID0gdW5kZWZpbmVkO1xuICAgICAgfVxuICAgIH0sXG5cbiAgICBpdGVyYXRlT2JqZWN0c186IGZ1bmN0aW9uKG9ic2VydmUpIHtcbiAgICAgIHRoaXMucGF0aF8uaXRlcmF0ZU9iamVjdHModGhpcy5vYmplY3RfLCBvYnNlcnZlKTtcbiAgICB9LFxuXG4gICAgY2hlY2tfOiBmdW5jdGlvbihjaGFuZ2VSZWNvcmRzLCBza2lwQ2hhbmdlcykge1xuICAgICAgdmFyIG9sZFZhbHVlID0gdGhpcy52YWx1ZV87XG4gICAgICB0aGlzLnZhbHVlXyA9IHRoaXMucGF0aF8uZ2V0VmFsdWVGcm9tKHRoaXMub2JqZWN0Xyk7XG4gICAgICBpZiAoc2tpcENoYW5nZXMgfHwgYXJlU2FtZVZhbHVlKHRoaXMudmFsdWVfLCBvbGRWYWx1ZSkpXG4gICAgICAgIHJldHVybiBmYWxzZTtcblxuICAgICAgdGhpcy5yZXBvcnRfKFt0aGlzLnZhbHVlXywgb2xkVmFsdWUsIHRoaXNdKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0sXG5cbiAgICBzZXRWYWx1ZTogZnVuY3Rpb24obmV3VmFsdWUpIHtcbiAgICAgIGlmICh0aGlzLnBhdGhfKVxuICAgICAgICB0aGlzLnBhdGhfLnNldFZhbHVlRnJvbSh0aGlzLm9iamVjdF8sIG5ld1ZhbHVlKTtcbiAgICB9XG4gIH0pO1xuXG4gIGZ1bmN0aW9uIENvbXBvdW5kT2JzZXJ2ZXIocmVwb3J0Q2hhbmdlc09uT3Blbikge1xuICAgIE9ic2VydmVyLmNhbGwodGhpcyk7XG5cbiAgICB0aGlzLnJlcG9ydENoYW5nZXNPbk9wZW5fID0gcmVwb3J0Q2hhbmdlc09uT3BlbjtcbiAgICB0aGlzLnZhbHVlXyA9IFtdO1xuICAgIHRoaXMuZGlyZWN0T2JzZXJ2ZXJfID0gdW5kZWZpbmVkO1xuICAgIHRoaXMub2JzZXJ2ZWRfID0gW107XG4gIH1cblxuICB2YXIgb2JzZXJ2ZXJTZW50aW5lbCA9IHt9O1xuXG4gIENvbXBvdW5kT2JzZXJ2ZXIucHJvdG90eXBlID0gY3JlYXRlT2JqZWN0KHtcbiAgICBfX3Byb3RvX186IE9ic2VydmVyLnByb3RvdHlwZSxcblxuICAgIGNvbm5lY3RfOiBmdW5jdGlvbigpIHtcbiAgICAgIGlmIChoYXNPYnNlcnZlKSB7XG4gICAgICAgIHZhciBvYmplY3Q7XG4gICAgICAgIHZhciBuZWVkc0RpcmVjdE9ic2VydmVyID0gZmFsc2U7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5vYnNlcnZlZF8ubGVuZ3RoOyBpICs9IDIpIHtcbiAgICAgICAgICBvYmplY3QgPSB0aGlzLm9ic2VydmVkX1tpXVxuICAgICAgICAgIGlmIChvYmplY3QgIT09IG9ic2VydmVyU2VudGluZWwpIHtcbiAgICAgICAgICAgIG5lZWRzRGlyZWN0T2JzZXJ2ZXIgPSB0cnVlO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG5lZWRzRGlyZWN0T2JzZXJ2ZXIpXG4gICAgICAgICAgdGhpcy5kaXJlY3RPYnNlcnZlcl8gPSBnZXRPYnNlcnZlZFNldCh0aGlzLCBvYmplY3QpO1xuICAgICAgfVxuXG4gICAgICB0aGlzLmNoZWNrXyh1bmRlZmluZWQsICF0aGlzLnJlcG9ydENoYW5nZXNPbk9wZW5fKTtcbiAgICB9LFxuXG4gICAgZGlzY29ubmVjdF86IGZ1bmN0aW9uKCkge1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLm9ic2VydmVkXy5sZW5ndGg7IGkgKz0gMikge1xuICAgICAgICBpZiAodGhpcy5vYnNlcnZlZF9baV0gPT09IG9ic2VydmVyU2VudGluZWwpXG4gICAgICAgICAgdGhpcy5vYnNlcnZlZF9baSArIDFdLmNsb3NlKCk7XG4gICAgICB9XG4gICAgICB0aGlzLm9ic2VydmVkXy5sZW5ndGggPSAwO1xuICAgICAgdGhpcy52YWx1ZV8ubGVuZ3RoID0gMDtcblxuICAgICAgaWYgKHRoaXMuZGlyZWN0T2JzZXJ2ZXJfKSB7XG4gICAgICAgIHRoaXMuZGlyZWN0T2JzZXJ2ZXJfLmNsb3NlKHRoaXMpO1xuICAgICAgICB0aGlzLmRpcmVjdE9ic2VydmVyXyA9IHVuZGVmaW5lZDtcbiAgICAgIH1cbiAgICB9LFxuXG4gICAgYWRkUGF0aDogZnVuY3Rpb24ob2JqZWN0LCBwYXRoKSB7XG4gICAgICBpZiAodGhpcy5zdGF0ZV8gIT0gVU5PUEVORUQgJiYgdGhpcy5zdGF0ZV8gIT0gUkVTRVRUSU5HKVxuICAgICAgICB0aHJvdyBFcnJvcignQ2Fubm90IGFkZCBwYXRocyBvbmNlIHN0YXJ0ZWQuJyk7XG5cbiAgICAgIHZhciBwYXRoID0gZ2V0UGF0aChwYXRoKTtcbiAgICAgIHRoaXMub2JzZXJ2ZWRfLnB1c2gob2JqZWN0LCBwYXRoKTtcbiAgICAgIGlmICghdGhpcy5yZXBvcnRDaGFuZ2VzT25PcGVuXylcbiAgICAgICAgcmV0dXJuO1xuICAgICAgdmFyIGluZGV4ID0gdGhpcy5vYnNlcnZlZF8ubGVuZ3RoIC8gMiAtIDE7XG4gICAgICB0aGlzLnZhbHVlX1tpbmRleF0gPSBwYXRoLmdldFZhbHVlRnJvbShvYmplY3QpO1xuICAgIH0sXG5cbiAgICBhZGRPYnNlcnZlcjogZnVuY3Rpb24ob2JzZXJ2ZXIpIHtcbiAgICAgIGlmICh0aGlzLnN0YXRlXyAhPSBVTk9QRU5FRCAmJiB0aGlzLnN0YXRlXyAhPSBSRVNFVFRJTkcpXG4gICAgICAgIHRocm93IEVycm9yKCdDYW5ub3QgYWRkIG9ic2VydmVycyBvbmNlIHN0YXJ0ZWQuJyk7XG5cbiAgICAgIHRoaXMub2JzZXJ2ZWRfLnB1c2gob2JzZXJ2ZXJTZW50aW5lbCwgb2JzZXJ2ZXIpO1xuICAgICAgaWYgKCF0aGlzLnJlcG9ydENoYW5nZXNPbk9wZW5fKVxuICAgICAgICByZXR1cm47XG4gICAgICB2YXIgaW5kZXggPSB0aGlzLm9ic2VydmVkXy5sZW5ndGggLyAyIC0gMTtcbiAgICAgIHRoaXMudmFsdWVfW2luZGV4XSA9IG9ic2VydmVyLm9wZW4odGhpcy5kZWxpdmVyLCB0aGlzKTtcbiAgICB9LFxuXG4gICAgc3RhcnRSZXNldDogZnVuY3Rpb24oKSB7XG4gICAgICBpZiAodGhpcy5zdGF0ZV8gIT0gT1BFTkVEKVxuICAgICAgICB0aHJvdyBFcnJvcignQ2FuIG9ubHkgcmVzZXQgd2hpbGUgb3BlbicpO1xuXG4gICAgICB0aGlzLnN0YXRlXyA9IFJFU0VUVElORztcbiAgICAgIHRoaXMuZGlzY29ubmVjdF8oKTtcbiAgICB9LFxuXG4gICAgZmluaXNoUmVzZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKHRoaXMuc3RhdGVfICE9IFJFU0VUVElORylcbiAgICAgICAgdGhyb3cgRXJyb3IoJ0NhbiBvbmx5IGZpbmlzaFJlc2V0IGFmdGVyIHN0YXJ0UmVzZXQnKTtcbiAgICAgIHRoaXMuc3RhdGVfID0gT1BFTkVEO1xuICAgICAgdGhpcy5jb25uZWN0XygpO1xuXG4gICAgICByZXR1cm4gdGhpcy52YWx1ZV87XG4gICAgfSxcblxuICAgIGl0ZXJhdGVPYmplY3RzXzogZnVuY3Rpb24ob2JzZXJ2ZSkge1xuICAgICAgdmFyIG9iamVjdDtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5vYnNlcnZlZF8ubGVuZ3RoOyBpICs9IDIpIHtcbiAgICAgICAgb2JqZWN0ID0gdGhpcy5vYnNlcnZlZF9baV1cbiAgICAgICAgaWYgKG9iamVjdCAhPT0gb2JzZXJ2ZXJTZW50aW5lbClcbiAgICAgICAgICB0aGlzLm9ic2VydmVkX1tpICsgMV0uaXRlcmF0ZU9iamVjdHMob2JqZWN0LCBvYnNlcnZlKVxuICAgICAgfVxuICAgIH0sXG5cbiAgICBjaGVja186IGZ1bmN0aW9uKGNoYW5nZVJlY29yZHMsIHNraXBDaGFuZ2VzKSB7XG4gICAgICB2YXIgb2xkVmFsdWVzO1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLm9ic2VydmVkXy5sZW5ndGg7IGkgKz0gMikge1xuICAgICAgICB2YXIgb2JqZWN0ID0gdGhpcy5vYnNlcnZlZF9baV07XG4gICAgICAgIHZhciBwYXRoID0gdGhpcy5vYnNlcnZlZF9baSsxXTtcbiAgICAgICAgdmFyIHZhbHVlO1xuICAgICAgICBpZiAob2JqZWN0ID09PSBvYnNlcnZlclNlbnRpbmVsKSB7XG4gICAgICAgICAgdmFyIG9ic2VydmFibGUgPSBwYXRoO1xuICAgICAgICAgIHZhbHVlID0gdGhpcy5zdGF0ZV8gPT09IFVOT1BFTkVEID9cbiAgICAgICAgICAgICAgb2JzZXJ2YWJsZS5vcGVuKHRoaXMuZGVsaXZlciwgdGhpcykgOlxuICAgICAgICAgICAgICBvYnNlcnZhYmxlLmRpc2NhcmRDaGFuZ2VzKCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdmFsdWUgPSBwYXRoLmdldFZhbHVlRnJvbShvYmplY3QpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHNraXBDaGFuZ2VzKSB7XG4gICAgICAgICAgdGhpcy52YWx1ZV9baSAvIDJdID0gdmFsdWU7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoYXJlU2FtZVZhbHVlKHZhbHVlLCB0aGlzLnZhbHVlX1tpIC8gMl0pKVxuICAgICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICAgIG9sZFZhbHVlcyA9IG9sZFZhbHVlcyB8fCBbXTtcbiAgICAgICAgb2xkVmFsdWVzW2kgLyAyXSA9IHRoaXMudmFsdWVfW2kgLyAyXTtcbiAgICAgICAgdGhpcy52YWx1ZV9baSAvIDJdID0gdmFsdWU7XG4gICAgICB9XG5cbiAgICAgIGlmICghb2xkVmFsdWVzKVxuICAgICAgICByZXR1cm4gZmFsc2U7XG5cbiAgICAgIC8vIFRPRE8ocmFmYWVsdyk6IEhhdmluZyBvYnNlcnZlZF8gYXMgdGhlIHRoaXJkIGNhbGxiYWNrIGFyZyBoZXJlIGlzXG4gICAgICAvLyBwcmV0dHkgbGFtZSBBUEkuIEZpeC5cbiAgICAgIHRoaXMucmVwb3J0XyhbdGhpcy52YWx1ZV8sIG9sZFZhbHVlcywgdGhpcy5vYnNlcnZlZF9dKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgfSk7XG5cbiAgZnVuY3Rpb24gaWRlbnRGbih2YWx1ZSkgeyByZXR1cm4gdmFsdWU7IH1cblxuICBmdW5jdGlvbiBPYnNlcnZlclRyYW5zZm9ybShvYnNlcnZhYmxlLCBnZXRWYWx1ZUZuLCBzZXRWYWx1ZUZuLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkb250UGFzc1Rocm91Z2hTZXQpIHtcbiAgICB0aGlzLmNhbGxiYWNrXyA9IHVuZGVmaW5lZDtcbiAgICB0aGlzLnRhcmdldF8gPSB1bmRlZmluZWQ7XG4gICAgdGhpcy52YWx1ZV8gPSB1bmRlZmluZWQ7XG4gICAgdGhpcy5vYnNlcnZhYmxlXyA9IG9ic2VydmFibGU7XG4gICAgdGhpcy5nZXRWYWx1ZUZuXyA9IGdldFZhbHVlRm4gfHwgaWRlbnRGbjtcbiAgICB0aGlzLnNldFZhbHVlRm5fID0gc2V0VmFsdWVGbiB8fCBpZGVudEZuO1xuICAgIC8vIFRPRE8ocmFmYWVsdyk6IFRoaXMgaXMgYSB0ZW1wb3JhcnkgaGFjay4gUG9seW1lckV4cHJlc3Npb25zIG5lZWRzIHRoaXNcbiAgICAvLyBhdCB0aGUgbW9tZW50IGJlY2F1c2Ugb2YgYSBidWcgaW4gaXQnc2llc3RhIGRlcGVuZGVuY3kgdHJhY2tpbmcuXG4gICAgdGhpcy5kb250UGFzc1Rocm91Z2hTZXRfID0gZG9udFBhc3NUaHJvdWdoU2V0O1xuICB9XG5cbiAgT2JzZXJ2ZXJUcmFuc2Zvcm0ucHJvdG90eXBlID0ge1xuICAgIG9wZW46IGZ1bmN0aW9uKGNhbGxiYWNrLCB0YXJnZXQpIHtcbiAgICAgIHRoaXMuY2FsbGJhY2tfID0gY2FsbGJhY2s7XG4gICAgICB0aGlzLnRhcmdldF8gPSB0YXJnZXQ7XG4gICAgICB0aGlzLnZhbHVlXyA9XG4gICAgICAgICAgdGhpcy5nZXRWYWx1ZUZuXyh0aGlzLm9ic2VydmFibGVfLm9wZW4odGhpcy5vYnNlcnZlZENhbGxiYWNrXywgdGhpcykpO1xuICAgICAgcmV0dXJuIHRoaXMudmFsdWVfO1xuICAgIH0sXG5cbiAgICBvYnNlcnZlZENhbGxiYWNrXzogZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgIHZhbHVlID0gdGhpcy5nZXRWYWx1ZUZuXyh2YWx1ZSk7XG4gICAgICBpZiAoYXJlU2FtZVZhbHVlKHZhbHVlLCB0aGlzLnZhbHVlXykpXG4gICAgICAgIHJldHVybjtcbiAgICAgIHZhciBvbGRWYWx1ZSA9IHRoaXMudmFsdWVfO1xuICAgICAgdGhpcy52YWx1ZV8gPSB2YWx1ZTtcbiAgICAgIHRoaXMuY2FsbGJhY2tfLmNhbGwodGhpcy50YXJnZXRfLCB0aGlzLnZhbHVlXywgb2xkVmFsdWUpO1xuICAgIH0sXG5cbiAgICBkaXNjYXJkQ2hhbmdlczogZnVuY3Rpb24oKSB7XG4gICAgICB0aGlzLnZhbHVlXyA9IHRoaXMuZ2V0VmFsdWVGbl8odGhpcy5vYnNlcnZhYmxlXy5kaXNjYXJkQ2hhbmdlcygpKTtcbiAgICAgIHJldHVybiB0aGlzLnZhbHVlXztcbiAgICB9LFxuXG4gICAgZGVsaXZlcjogZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gdGhpcy5vYnNlcnZhYmxlXy5kZWxpdmVyKCk7XG4gICAgfSxcblxuICAgIHNldFZhbHVlOiBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgdmFsdWUgPSB0aGlzLnNldFZhbHVlRm5fKHZhbHVlKTtcbiAgICAgIGlmICghdGhpcy5kb250UGFzc1Rocm91Z2hTZXRfICYmIHRoaXMub2JzZXJ2YWJsZV8uc2V0VmFsdWUpXG4gICAgICAgIHJldHVybiB0aGlzLm9ic2VydmFibGVfLnNldFZhbHVlKHZhbHVlKTtcbiAgICB9LFxuXG4gICAgY2xvc2U6IGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKHRoaXMub2JzZXJ2YWJsZV8pXG4gICAgICAgIHRoaXMub2JzZXJ2YWJsZV8uY2xvc2UoKTtcbiAgICAgIHRoaXMuY2FsbGJhY2tfID0gdW5kZWZpbmVkO1xuICAgICAgdGhpcy50YXJnZXRfID0gdW5kZWZpbmVkO1xuICAgICAgdGhpcy5vYnNlcnZhYmxlXyA9IHVuZGVmaW5lZDtcbiAgICAgIHRoaXMudmFsdWVfID0gdW5kZWZpbmVkO1xuICAgICAgdGhpcy5nZXRWYWx1ZUZuXyA9IHVuZGVmaW5lZDtcbiAgICAgIHRoaXMuc2V0VmFsdWVGbl8gPSB1bmRlZmluZWQ7XG4gICAgfVxuICB9XG5cbiAgdmFyIGV4cGVjdGVkUmVjb3JkVHlwZXMgPSB7XG4gICAgYWRkOiB0cnVlLFxuICAgIHVwZGF0ZTogdHJ1ZSxcbiAgICBkZWxldGU6IHRydWVcbiAgfTtcblxuICBmdW5jdGlvbiBkaWZmT2JqZWN0RnJvbUNoYW5nZVJlY29yZHMob2JqZWN0LCBjaGFuZ2VSZWNvcmRzLCBvbGRWYWx1ZXMpIHtcbiAgICB2YXIgYWRkZWQgPSB7fTtcbiAgICB2YXIgcmVtb3ZlZCA9IHt9O1xuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjaGFuZ2VSZWNvcmRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgcmVjb3JkID0gY2hhbmdlUmVjb3Jkc1tpXTtcbiAgICAgIGlmICghZXhwZWN0ZWRSZWNvcmRUeXBlc1tyZWNvcmQudHlwZV0pIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignVW5rbm93biBjaGFuZ2VSZWNvcmQgdHlwZTogJyArIHJlY29yZC50eXBlKTtcbiAgICAgICAgY29uc29sZS5lcnJvcihyZWNvcmQpO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKCEocmVjb3JkLm5hbWUgaW4gb2xkVmFsdWVzKSlcbiAgICAgICAgb2xkVmFsdWVzW3JlY29yZC5uYW1lXSA9IHJlY29yZC5vbGRWYWx1ZTtcblxuICAgICAgaWYgKHJlY29yZC50eXBlID09ICd1cGRhdGUnKVxuICAgICAgICBjb250aW51ZTtcblxuICAgICAgaWYgKHJlY29yZC50eXBlID09ICdhZGQnKSB7XG4gICAgICAgIGlmIChyZWNvcmQubmFtZSBpbiByZW1vdmVkKVxuICAgICAgICAgIGRlbGV0ZSByZW1vdmVkW3JlY29yZC5uYW1lXTtcbiAgICAgICAgZWxzZVxuICAgICAgICAgIGFkZGVkW3JlY29yZC5uYW1lXSA9IHRydWU7XG5cbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIC8vIHR5cGUgPSAnZGVsZXRlJ1xuICAgICAgaWYgKHJlY29yZC5uYW1lIGluIGFkZGVkKSB7XG4gICAgICAgIGRlbGV0ZSBhZGRlZFtyZWNvcmQubmFtZV07XG4gICAgICAgIGRlbGV0ZSBvbGRWYWx1ZXNbcmVjb3JkLm5hbWVdO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmVtb3ZlZFtyZWNvcmQubmFtZV0gPSB0cnVlO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZvciAodmFyIHByb3AgaW4gYWRkZWQpXG4gICAgICBhZGRlZFtwcm9wXSA9IG9iamVjdFtwcm9wXTtcblxuICAgIGZvciAodmFyIHByb3AgaW4gcmVtb3ZlZClcbiAgICAgIHJlbW92ZWRbcHJvcF0gPSB1bmRlZmluZWQ7XG5cbiAgICB2YXIgY2hhbmdlZCA9IHt9O1xuICAgIGZvciAodmFyIHByb3AgaW4gb2xkVmFsdWVzKSB7XG4gICAgICBpZiAocHJvcCBpbiBhZGRlZCB8fCBwcm9wIGluIHJlbW92ZWQpXG4gICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICB2YXIgbmV3VmFsdWUgPSBvYmplY3RbcHJvcF07XG4gICAgICBpZiAob2xkVmFsdWVzW3Byb3BdICE9PSBuZXdWYWx1ZSlcbiAgICAgICAgY2hhbmdlZFtwcm9wXSA9IG5ld1ZhbHVlO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBhZGRlZDogYWRkZWQsXG4gICAgICByZW1vdmVkOiByZW1vdmVkLFxuICAgICAgY2hhbmdlZDogY2hhbmdlZFxuICAgIH07XG4gIH1cblxuICBmdW5jdGlvbiBuZXdTcGxpY2UoaW5kZXgsIHJlbW92ZWQsIGFkZGVkQ291bnQpIHtcbiAgICByZXR1cm4ge1xuICAgICAgaW5kZXg6IGluZGV4LFxuICAgICAgcmVtb3ZlZDogcmVtb3ZlZCxcbiAgICAgIGFkZGVkQ291bnQ6IGFkZGVkQ291bnRcbiAgICB9O1xuICB9XG5cbiAgdmFyIEVESVRfTEVBVkUgPSAwO1xuICB2YXIgRURJVF9VUERBVEUgPSAxO1xuICB2YXIgRURJVF9BREQgPSAyO1xuICB2YXIgRURJVF9ERUxFVEUgPSAzO1xuXG4gIGZ1bmN0aW9uIEFycmF5U3BsaWNlKCkge31cblxuICBBcnJheVNwbGljZS5wcm90b3R5cGUgPSB7XG5cbiAgICAvLyBOb3RlOiBUaGlzIGZ1bmN0aW9uIGlzICpiYXNlZCogb24gdGhlIGNvbXB1dGF0aW9uIG9mIHRoZSBMZXZlbnNodGVpblxuICAgIC8vIFwiZWRpdFwiIGRpc3RhbmNlLiBUaGUgb25lIGNoYW5nZSBpcyB0aGF0IFwidXBkYXRlc1wiIGFyZSB0cmVhdGVkIGFzIHR3b1xuICAgIC8vIGVkaXRzIC0gbm90IG9uZS4gV2l0aCBBcnJheSBzcGxpY2VzLCBhbiB1cGRhdGUgaXMgcmVhbGx5IGEgZGVsZXRlXG4gICAgLy8gZm9sbG93ZWQgYnkgYW4gYWRkLiBCeSByZXRhaW5pbmcgdGhpcywgd2Ugb3B0aW1pemUgZm9yIFwia2VlcGluZ1wiIHRoZVxuICAgIC8vIG1heGltdW0gYXJyYXkgaXRlbXMgaW4gdGhlIG9yaWdpbmFsIGFycmF5LiBGb3IgZXhhbXBsZTpcbiAgICAvL1xuICAgIC8vICAgJ3h4eHgxMjMnIC0+ICcxMjN5eXl5J1xuICAgIC8vXG4gICAgLy8gV2l0aCAxLWVkaXQgdXBkYXRlcywgdGhlIHNob3J0ZXN0IHBhdGggd291bGQgYmUganVzdCB0byB1cGRhdGUgYWxsIHNldmVuXG4gICAgLy8gY2hhcmFjdGVycy4gV2l0aCAyLWVkaXQgdXBkYXRlcywgd2UgZGVsZXRlIDQsIGxlYXZlIDMsIGFuZCBhZGQgNC4gVGhpc1xuICAgIC8vIGxlYXZlcyB0aGUgc3Vic3RyaW5nICcxMjMnIGludGFjdC5cbiAgICBjYWxjRWRpdERpc3RhbmNlczogZnVuY3Rpb24oY3VycmVudCwgY3VycmVudFN0YXJ0LCBjdXJyZW50RW5kLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbGQsIG9sZFN0YXJ0LCBvbGRFbmQpIHtcbiAgICAgIC8vIFwiRGVsZXRpb25cIiBjb2x1bW5zXG4gICAgICB2YXIgcm93Q291bnQgPSBvbGRFbmQgLSBvbGRTdGFydCArIDE7XG4gICAgICB2YXIgY29sdW1uQ291bnQgPSBjdXJyZW50RW5kIC0gY3VycmVudFN0YXJ0ICsgMTtcbiAgICAgIHZhciBkaXN0YW5jZXMgPSBuZXcgQXJyYXkocm93Q291bnQpO1xuXG4gICAgICAvLyBcIkFkZGl0aW9uXCIgcm93cy4gSW5pdGlhbGl6ZSBudWxsIGNvbHVtbi5cbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcm93Q291bnQ7IGkrKykge1xuICAgICAgICBkaXN0YW5jZXNbaV0gPSBuZXcgQXJyYXkoY29sdW1uQ291bnQpO1xuICAgICAgICBkaXN0YW5jZXNbaV1bMF0gPSBpO1xuICAgICAgfVxuXG4gICAgICAvLyBJbml0aWFsaXplIG51bGwgcm93XG4gICAgICBmb3IgKHZhciBqID0gMDsgaiA8IGNvbHVtbkNvdW50OyBqKyspXG4gICAgICAgIGRpc3RhbmNlc1swXVtqXSA9IGo7XG5cbiAgICAgIGZvciAodmFyIGkgPSAxOyBpIDwgcm93Q291bnQ7IGkrKykge1xuICAgICAgICBmb3IgKHZhciBqID0gMTsgaiA8IGNvbHVtbkNvdW50OyBqKyspIHtcbiAgICAgICAgICBpZiAodGhpcy5lcXVhbHMoY3VycmVudFtjdXJyZW50U3RhcnQgKyBqIC0gMV0sIG9sZFtvbGRTdGFydCArIGkgLSAxXSkpXG4gICAgICAgICAgICBkaXN0YW5jZXNbaV1bal0gPSBkaXN0YW5jZXNbaSAtIDFdW2ogLSAxXTtcbiAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHZhciBub3J0aCA9IGRpc3RhbmNlc1tpIC0gMV1bal0gKyAxO1xuICAgICAgICAgICAgdmFyIHdlc3QgPSBkaXN0YW5jZXNbaV1baiAtIDFdICsgMTtcbiAgICAgICAgICAgIGRpc3RhbmNlc1tpXVtqXSA9IG5vcnRoIDwgd2VzdCA/IG5vcnRoIDogd2VzdDtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIGRpc3RhbmNlcztcbiAgICB9LFxuXG4gICAgLy8gVGhpcyBzdGFydHMgYXQgdGhlIGZpbmFsIHdlaWdodCwgYW5kIHdhbGtzIFwiYmFja3dhcmRcIiBieSBmaW5kaW5nXG4gICAgLy8gdGhlIG1pbmltdW0gcHJldmlvdXMgd2VpZ2h0IHJlY3Vyc2l2ZWx5IHVudGlsIHRoZSBvcmlnaW4gb2YgdGhlIHdlaWdodFxuICAgIC8vIG1hdHJpeC5cbiAgICBzcGxpY2VPcGVyYXRpb25zRnJvbUVkaXREaXN0YW5jZXM6IGZ1bmN0aW9uKGRpc3RhbmNlcykge1xuICAgICAgdmFyIGkgPSBkaXN0YW5jZXMubGVuZ3RoIC0gMTtcbiAgICAgIHZhciBqID0gZGlzdGFuY2VzWzBdLmxlbmd0aCAtIDE7XG4gICAgICB2YXIgY3VycmVudCA9IGRpc3RhbmNlc1tpXVtqXTtcbiAgICAgIHZhciBlZGl0cyA9IFtdO1xuICAgICAgd2hpbGUgKGkgPiAwIHx8IGogPiAwKSB7XG4gICAgICAgIGlmIChpID09IDApIHtcbiAgICAgICAgICBlZGl0cy5wdXNoKEVESVRfQUREKTtcbiAgICAgICAgICBqLS07XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGogPT0gMCkge1xuICAgICAgICAgIGVkaXRzLnB1c2goRURJVF9ERUxFVEUpO1xuICAgICAgICAgIGktLTtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgbm9ydGhXZXN0ID0gZGlzdGFuY2VzW2kgLSAxXVtqIC0gMV07XG4gICAgICAgIHZhciB3ZXN0ID0gZGlzdGFuY2VzW2kgLSAxXVtqXTtcbiAgICAgICAgdmFyIG5vcnRoID0gZGlzdGFuY2VzW2ldW2ogLSAxXTtcblxuICAgICAgICB2YXIgbWluO1xuICAgICAgICBpZiAod2VzdCA8IG5vcnRoKVxuICAgICAgICAgIG1pbiA9IHdlc3QgPCBub3J0aFdlc3QgPyB3ZXN0IDogbm9ydGhXZXN0O1xuICAgICAgICBlbHNlXG4gICAgICAgICAgbWluID0gbm9ydGggPCBub3J0aFdlc3QgPyBub3J0aCA6IG5vcnRoV2VzdDtcblxuICAgICAgICBpZiAobWluID09IG5vcnRoV2VzdCkge1xuICAgICAgICAgIGlmIChub3J0aFdlc3QgPT0gY3VycmVudCkge1xuICAgICAgICAgICAgZWRpdHMucHVzaChFRElUX0xFQVZFKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZWRpdHMucHVzaChFRElUX1VQREFURSk7XG4gICAgICAgICAgICBjdXJyZW50ID0gbm9ydGhXZXN0O1xuICAgICAgICAgIH1cbiAgICAgICAgICBpLS07XG4gICAgICAgICAgai0tO1xuICAgICAgICB9IGVsc2UgaWYgKG1pbiA9PSB3ZXN0KSB7XG4gICAgICAgICAgZWRpdHMucHVzaChFRElUX0RFTEVURSk7XG4gICAgICAgICAgaS0tO1xuICAgICAgICAgIGN1cnJlbnQgPSB3ZXN0O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGVkaXRzLnB1c2goRURJVF9BREQpO1xuICAgICAgICAgIGotLTtcbiAgICAgICAgICBjdXJyZW50ID0gbm9ydGg7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgZWRpdHMucmV2ZXJzZSgpO1xuICAgICAgcmV0dXJuIGVkaXRzO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBTcGxpY2UgUHJvamVjdGlvbiBmdW5jdGlvbnM6XG4gICAgICpcbiAgICAgKiBBIHNwbGljZSBtYXAgaXMgYSByZXByZXNlbnRhdGlvbiBvZiBob3cgYSBwcmV2aW91cyBhcnJheSBvZiBpdGVtc1xuICAgICAqIHdhcyB0cmFuc2Zvcm1lZCBpbnRvIGEgbmV3IGFycmF5IG9mIGl0ZW1zLiBDb25jZXB0dWFsbHkgaXQgaXMgYSBsaXN0IG9mXG4gICAgICogdHVwbGVzIG9mXG4gICAgICpcbiAgICAgKiAgIDxpbmRleCwgcmVtb3ZlZCwgYWRkZWRDb3VudD5cbiAgICAgKlxuICAgICAqIHdoaWNoIGFyZSBrZXB0IGluIGFzY2VuZGluZyBpbmRleCBvcmRlciBvZi4gVGhlIHR1cGxlIHJlcHJlc2VudHMgdGhhdCBhdFxuICAgICAqIHRoZSB8aW5kZXh8LCB8cmVtb3ZlZHwgc2VxdWVuY2Ugb2YgaXRlbXMgd2VyZSByZW1vdmVkLCBhbmQgY291bnRpbmcgZm9yd2FyZFxuICAgICAqIGZyb20gfGluZGV4fCwgfGFkZGVkQ291bnR8IGl0ZW1zIHdlcmUgYWRkZWQuXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBMYWNraW5nIGluZGl2aWR1YWwgc3BsaWNlIG11dGF0aW9uIGluZm9ybWF0aW9uLCB0aGUgbWluaW1hbCBzZXQgb2ZcbiAgICAgKiBzcGxpY2VzIGNhbiBiZSBzeW50aGVzaXplZCBnaXZlbiB0aGUgcHJldmlvdXMgc3RhdGUgYW5kIGZpbmFsIHN0YXRlIG9mIGFuXG4gICAgICogYXJyYXkuIFRoZSBiYXNpYyBhcHByb2FjaCBpcyB0byBjYWxjdWxhdGUgdGhlIGVkaXQgZGlzdGFuY2UgbWF0cml4IGFuZFxuICAgICAqIGNob29zZSB0aGUgc2hvcnRlc3QgcGF0aCB0aHJvdWdoIGl0LlxuICAgICAqXG4gICAgICogQ29tcGxleGl0eTogTyhsICogcClcbiAgICAgKiAgIGw6IFRoZSBsZW5ndGggb2YgdGhlIGN1cnJlbnQgYXJyYXlcbiAgICAgKiAgIHA6IFRoZSBsZW5ndGggb2YgdGhlIG9sZCBhcnJheVxuICAgICAqL1xuICAgIGNhbGNTcGxpY2VzOiBmdW5jdGlvbihjdXJyZW50LCBjdXJyZW50U3RhcnQsIGN1cnJlbnRFbmQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIG9sZCwgb2xkU3RhcnQsIG9sZEVuZCkge1xuICAgICAgdmFyIHByZWZpeENvdW50ID0gMDtcbiAgICAgIHZhciBzdWZmaXhDb3VudCA9IDA7XG5cbiAgICAgIHZhciBtaW5MZW5ndGggPSBNYXRoLm1pbihjdXJyZW50RW5kIC0gY3VycmVudFN0YXJ0LCBvbGRFbmQgLSBvbGRTdGFydCk7XG4gICAgICBpZiAoY3VycmVudFN0YXJ0ID09IDAgJiYgb2xkU3RhcnQgPT0gMClcbiAgICAgICAgcHJlZml4Q291bnQgPSB0aGlzLnNoYXJlZFByZWZpeChjdXJyZW50LCBvbGQsIG1pbkxlbmd0aCk7XG5cbiAgICAgIGlmIChjdXJyZW50RW5kID09IGN1cnJlbnQubGVuZ3RoICYmIG9sZEVuZCA9PSBvbGQubGVuZ3RoKVxuICAgICAgICBzdWZmaXhDb3VudCA9IHRoaXMuc2hhcmVkU3VmZml4KGN1cnJlbnQsIG9sZCwgbWluTGVuZ3RoIC0gcHJlZml4Q291bnQpO1xuXG4gICAgICBjdXJyZW50U3RhcnQgKz0gcHJlZml4Q291bnQ7XG4gICAgICBvbGRTdGFydCArPSBwcmVmaXhDb3VudDtcbiAgICAgIGN1cnJlbnRFbmQgLT0gc3VmZml4Q291bnQ7XG4gICAgICBvbGRFbmQgLT0gc3VmZml4Q291bnQ7XG5cbiAgICAgIGlmIChjdXJyZW50RW5kIC0gY3VycmVudFN0YXJ0ID09IDAgJiYgb2xkRW5kIC0gb2xkU3RhcnQgPT0gMClcbiAgICAgICAgcmV0dXJuIFtdO1xuXG4gICAgICBpZiAoY3VycmVudFN0YXJ0ID09IGN1cnJlbnRFbmQpIHtcbiAgICAgICAgdmFyIHNwbGljZSA9IG5ld1NwbGljZShjdXJyZW50U3RhcnQsIFtdLCAwKTtcbiAgICAgICAgd2hpbGUgKG9sZFN0YXJ0IDwgb2xkRW5kKVxuICAgICAgICAgIHNwbGljZS5yZW1vdmVkLnB1c2gob2xkW29sZFN0YXJ0KytdKTtcblxuICAgICAgICByZXR1cm4gWyBzcGxpY2UgXTtcbiAgICAgIH0gZWxzZSBpZiAob2xkU3RhcnQgPT0gb2xkRW5kKVxuICAgICAgICByZXR1cm4gWyBuZXdTcGxpY2UoY3VycmVudFN0YXJ0LCBbXSwgY3VycmVudEVuZCAtIGN1cnJlbnRTdGFydCkgXTtcblxuICAgICAgdmFyIG9wcyA9IHRoaXMuc3BsaWNlT3BlcmF0aW9uc0Zyb21FZGl0RGlzdGFuY2VzKFxuICAgICAgICAgIHRoaXMuY2FsY0VkaXREaXN0YW5jZXMoY3VycmVudCwgY3VycmVudFN0YXJ0LCBjdXJyZW50RW5kLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb2xkLCBvbGRTdGFydCwgb2xkRW5kKSk7XG5cbiAgICAgIHZhciBzcGxpY2UgPSB1bmRlZmluZWQ7XG4gICAgICB2YXIgc3BsaWNlcyA9IFtdO1xuICAgICAgdmFyIGluZGV4ID0gY3VycmVudFN0YXJ0O1xuICAgICAgdmFyIG9sZEluZGV4ID0gb2xkU3RhcnQ7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IG9wcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBzd2l0Y2gob3BzW2ldKSB7XG4gICAgICAgICAgY2FzZSBFRElUX0xFQVZFOlxuICAgICAgICAgICAgaWYgKHNwbGljZSkge1xuICAgICAgICAgICAgICBzcGxpY2VzLnB1c2goc3BsaWNlKTtcbiAgICAgICAgICAgICAgc3BsaWNlID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpbmRleCsrO1xuICAgICAgICAgICAgb2xkSW5kZXgrKztcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgRURJVF9VUERBVEU6XG4gICAgICAgICAgICBpZiAoIXNwbGljZSlcbiAgICAgICAgICAgICAgc3BsaWNlID0gbmV3U3BsaWNlKGluZGV4LCBbXSwgMCk7XG5cbiAgICAgICAgICAgIHNwbGljZS5hZGRlZENvdW50Kys7XG4gICAgICAgICAgICBpbmRleCsrO1xuXG4gICAgICAgICAgICBzcGxpY2UucmVtb3ZlZC5wdXNoKG9sZFtvbGRJbmRleF0pO1xuICAgICAgICAgICAgb2xkSW5kZXgrKztcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgRURJVF9BREQ6XG4gICAgICAgICAgICBpZiAoIXNwbGljZSlcbiAgICAgICAgICAgICAgc3BsaWNlID0gbmV3U3BsaWNlKGluZGV4LCBbXSwgMCk7XG5cbiAgICAgICAgICAgIHNwbGljZS5hZGRlZENvdW50Kys7XG4gICAgICAgICAgICBpbmRleCsrO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSBFRElUX0RFTEVURTpcbiAgICAgICAgICAgIGlmICghc3BsaWNlKVxuICAgICAgICAgICAgICBzcGxpY2UgPSBuZXdTcGxpY2UoaW5kZXgsIFtdLCAwKTtcblxuICAgICAgICAgICAgc3BsaWNlLnJlbW92ZWQucHVzaChvbGRbb2xkSW5kZXhdKTtcbiAgICAgICAgICAgIG9sZEluZGV4Kys7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAoc3BsaWNlKSB7XG4gICAgICAgIHNwbGljZXMucHVzaChzcGxpY2UpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHNwbGljZXM7XG4gICAgfSxcblxuICAgIHNoYXJlZFByZWZpeDogZnVuY3Rpb24oY3VycmVudCwgb2xkLCBzZWFyY2hMZW5ndGgpIHtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc2VhcmNoTGVuZ3RoOyBpKyspXG4gICAgICAgIGlmICghdGhpcy5lcXVhbHMoY3VycmVudFtpXSwgb2xkW2ldKSlcbiAgICAgICAgICByZXR1cm4gaTtcbiAgICAgIHJldHVybiBzZWFyY2hMZW5ndGg7XG4gICAgfSxcblxuICAgIHNoYXJlZFN1ZmZpeDogZnVuY3Rpb24oY3VycmVudCwgb2xkLCBzZWFyY2hMZW5ndGgpIHtcbiAgICAgIHZhciBpbmRleDEgPSBjdXJyZW50Lmxlbmd0aDtcbiAgICAgIHZhciBpbmRleDIgPSBvbGQubGVuZ3RoO1xuICAgICAgdmFyIGNvdW50ID0gMDtcbiAgICAgIHdoaWxlIChjb3VudCA8IHNlYXJjaExlbmd0aCAmJiB0aGlzLmVxdWFscyhjdXJyZW50Wy0taW5kZXgxXSwgb2xkWy0taW5kZXgyXSkpXG4gICAgICAgIGNvdW50Kys7XG5cbiAgICAgIHJldHVybiBjb3VudDtcbiAgICB9LFxuXG4gICAgY2FsY3VsYXRlU3BsaWNlczogZnVuY3Rpb24oY3VycmVudCwgcHJldmlvdXMpIHtcbiAgICAgIHJldHVybiB0aGlzLmNhbGNTcGxpY2VzKGN1cnJlbnQsIDAsIGN1cnJlbnQubGVuZ3RoLCBwcmV2aW91cywgMCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByZXZpb3VzLmxlbmd0aCk7XG4gICAgfSxcblxuICAgIGVxdWFsczogZnVuY3Rpb24oY3VycmVudFZhbHVlLCBwcmV2aW91c1ZhbHVlKSB7XG4gICAgICByZXR1cm4gY3VycmVudFZhbHVlID09PSBwcmV2aW91c1ZhbHVlO1xuICAgIH1cbiAgfTtcblxuICB2YXIgYXJyYXlTcGxpY2UgPSBuZXcgQXJyYXlTcGxpY2UoKTtcblxuICBmdW5jdGlvbiBjYWxjU3BsaWNlcyhjdXJyZW50LCBjdXJyZW50U3RhcnQsIGN1cnJlbnRFbmQsXG4gICAgICAgICAgICAgICAgICAgICAgIG9sZCwgb2xkU3RhcnQsIG9sZEVuZCkge1xuICAgIHJldHVybiBhcnJheVNwbGljZS5jYWxjU3BsaWNlcyhjdXJyZW50LCBjdXJyZW50U3RhcnQsIGN1cnJlbnRFbmQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9sZCwgb2xkU3RhcnQsIG9sZEVuZCk7XG4gIH1cblxuICBmdW5jdGlvbiBpbnRlcnNlY3Qoc3RhcnQxLCBlbmQxLCBzdGFydDIsIGVuZDIpIHtcbiAgICAvLyBEaXNqb2ludFxuICAgIGlmIChlbmQxIDwgc3RhcnQyIHx8IGVuZDIgPCBzdGFydDEpXG4gICAgICByZXR1cm4gLTE7XG5cbiAgICAvLyBBZGphY2VudFxuICAgIGlmIChlbmQxID09IHN0YXJ0MiB8fCBlbmQyID09IHN0YXJ0MSlcbiAgICAgIHJldHVybiAwO1xuXG4gICAgLy8gTm9uLXplcm8gaW50ZXJzZWN0LCBzcGFuMSBmaXJzdFxuICAgIGlmIChzdGFydDEgPCBzdGFydDIpIHtcbiAgICAgIGlmIChlbmQxIDwgZW5kMilcbiAgICAgICAgcmV0dXJuIGVuZDEgLSBzdGFydDI7IC8vIE92ZXJsYXBcbiAgICAgIGVsc2VcbiAgICAgICAgcmV0dXJuIGVuZDIgLSBzdGFydDI7IC8vIENvbnRhaW5lZFxuICAgIH0gZWxzZSB7XG4gICAgICAvLyBOb24temVybyBpbnRlcnNlY3QsIHNwYW4yIGZpcnN0XG4gICAgICBpZiAoZW5kMiA8IGVuZDEpXG4gICAgICAgIHJldHVybiBlbmQyIC0gc3RhcnQxOyAvLyBPdmVybGFwXG4gICAgICBlbHNlXG4gICAgICAgIHJldHVybiBlbmQxIC0gc3RhcnQxOyAvLyBDb250YWluZWRcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBtZXJnZVNwbGljZShzcGxpY2VzLCBpbmRleCwgcmVtb3ZlZCwgYWRkZWRDb3VudCkge1xuXG4gICAgdmFyIHNwbGljZSA9IG5ld1NwbGljZShpbmRleCwgcmVtb3ZlZCwgYWRkZWRDb3VudCk7XG5cbiAgICB2YXIgaW5zZXJ0ZWQgPSBmYWxzZTtcbiAgICB2YXIgaW5zZXJ0aW9uT2Zmc2V0ID0gMDtcblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc3BsaWNlcy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIGN1cnJlbnQgPSBzcGxpY2VzW2ldO1xuICAgICAgY3VycmVudC5pbmRleCArPSBpbnNlcnRpb25PZmZzZXQ7XG5cbiAgICAgIGlmIChpbnNlcnRlZClcbiAgICAgICAgY29udGludWU7XG5cbiAgICAgIHZhciBpbnRlcnNlY3RDb3VudCA9IGludGVyc2VjdChzcGxpY2UuaW5kZXgsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3BsaWNlLmluZGV4ICsgc3BsaWNlLnJlbW92ZWQubGVuZ3RoLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGN1cnJlbnQuaW5kZXgsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY3VycmVudC5pbmRleCArIGN1cnJlbnQuYWRkZWRDb3VudCk7XG5cbiAgICAgIGlmIChpbnRlcnNlY3RDb3VudCA+PSAwKSB7XG4gICAgICAgIC8vIE1lcmdlIHRoZSB0d28gc3BsaWNlc1xuXG4gICAgICAgIHNwbGljZXMuc3BsaWNlKGksIDEpO1xuICAgICAgICBpLS07XG5cbiAgICAgICAgaW5zZXJ0aW9uT2Zmc2V0IC09IGN1cnJlbnQuYWRkZWRDb3VudCAtIGN1cnJlbnQucmVtb3ZlZC5sZW5ndGg7XG5cbiAgICAgICAgc3BsaWNlLmFkZGVkQ291bnQgKz0gY3VycmVudC5hZGRlZENvdW50IC0gaW50ZXJzZWN0Q291bnQ7XG4gICAgICAgIHZhciBkZWxldGVDb3VudCA9IHNwbGljZS5yZW1vdmVkLmxlbmd0aCArXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGN1cnJlbnQucmVtb3ZlZC5sZW5ndGggLSBpbnRlcnNlY3RDb3VudDtcblxuICAgICAgICBpZiAoIXNwbGljZS5hZGRlZENvdW50ICYmICFkZWxldGVDb3VudCkge1xuICAgICAgICAgIC8vIG1lcmdlZCBzcGxpY2UgaXMgYSBub29wLiBkaXNjYXJkLlxuICAgICAgICAgIGluc2VydGVkID0gdHJ1ZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB2YXIgcmVtb3ZlZCA9IGN1cnJlbnQucmVtb3ZlZDtcblxuICAgICAgICAgIGlmIChzcGxpY2UuaW5kZXggPCBjdXJyZW50LmluZGV4KSB7XG4gICAgICAgICAgICAvLyBzb21lIHByZWZpeCBvZiBzcGxpY2UucmVtb3ZlZCBpcyBwcmVwZW5kZWQgdG8gY3VycmVudC5yZW1vdmVkLlxuICAgICAgICAgICAgdmFyIHByZXBlbmQgPSBzcGxpY2UucmVtb3ZlZC5zbGljZSgwLCBjdXJyZW50LmluZGV4IC0gc3BsaWNlLmluZGV4KTtcbiAgICAgICAgICAgIEFycmF5LnByb3RvdHlwZS5wdXNoLmFwcGx5KHByZXBlbmQsIHJlbW92ZWQpO1xuICAgICAgICAgICAgcmVtb3ZlZCA9IHByZXBlbmQ7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKHNwbGljZS5pbmRleCArIHNwbGljZS5yZW1vdmVkLmxlbmd0aCA+IGN1cnJlbnQuaW5kZXggKyBjdXJyZW50LmFkZGVkQ291bnQpIHtcbiAgICAgICAgICAgIC8vIHNvbWUgc3VmZml4IG9mIHNwbGljZS5yZW1vdmVkIGlzIGFwcGVuZGVkIHRvIGN1cnJlbnQucmVtb3ZlZC5cbiAgICAgICAgICAgIHZhciBhcHBlbmQgPSBzcGxpY2UucmVtb3ZlZC5zbGljZShjdXJyZW50LmluZGV4ICsgY3VycmVudC5hZGRlZENvdW50IC0gc3BsaWNlLmluZGV4KTtcbiAgICAgICAgICAgIEFycmF5LnByb3RvdHlwZS5wdXNoLmFwcGx5KHJlbW92ZWQsIGFwcGVuZCk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgc3BsaWNlLnJlbW92ZWQgPSByZW1vdmVkO1xuICAgICAgICAgIGlmIChjdXJyZW50LmluZGV4IDwgc3BsaWNlLmluZGV4KSB7XG4gICAgICAgICAgICBzcGxpY2UuaW5kZXggPSBjdXJyZW50LmluZGV4O1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmIChzcGxpY2UuaW5kZXggPCBjdXJyZW50LmluZGV4KSB7XG4gICAgICAgIC8vIEluc2VydCBzcGxpY2UgaGVyZS5cblxuICAgICAgICBpbnNlcnRlZCA9IHRydWU7XG5cbiAgICAgICAgc3BsaWNlcy5zcGxpY2UoaSwgMCwgc3BsaWNlKTtcbiAgICAgICAgaSsrO1xuXG4gICAgICAgIHZhciBvZmZzZXQgPSBzcGxpY2UuYWRkZWRDb3VudCAtIHNwbGljZS5yZW1vdmVkLmxlbmd0aFxuICAgICAgICBjdXJyZW50LmluZGV4ICs9IG9mZnNldDtcbiAgICAgICAgaW5zZXJ0aW9uT2Zmc2V0ICs9IG9mZnNldDtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoIWluc2VydGVkKVxuICAgICAgc3BsaWNlcy5wdXNoKHNwbGljZSk7XG4gIH1cblxuICBmdW5jdGlvbiBjcmVhdGVJbml0aWFsU3BsaWNlcyhhcnJheSwgY2hhbmdlUmVjb3Jkcykge1xuICAgIHZhciBzcGxpY2VzID0gW107XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNoYW5nZVJlY29yZHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciByZWNvcmQgPSBjaGFuZ2VSZWNvcmRzW2ldO1xuICAgICAgc3dpdGNoKHJlY29yZC50eXBlKSB7XG4gICAgICAgIGNhc2UgJ3NwbGljZSc6XG4gICAgICAgICAgbWVyZ2VTcGxpY2Uoc3BsaWNlcywgcmVjb3JkLmluZGV4LCByZWNvcmQucmVtb3ZlZC5zbGljZSgpLCByZWNvcmQuYWRkZWRDb3VudCk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ2FkZCc6XG4gICAgICAgIGNhc2UgJ3VwZGF0ZSc6XG4gICAgICAgIGNhc2UgJ2RlbGV0ZSc6XG4gICAgICAgICAgaWYgKCFpc0luZGV4KHJlY29yZC5uYW1lKSlcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgIHZhciBpbmRleCA9IHRvTnVtYmVyKHJlY29yZC5uYW1lKTtcbiAgICAgICAgICBpZiAoaW5kZXggPCAwKVxuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgbWVyZ2VTcGxpY2Uoc3BsaWNlcywgaW5kZXgsIFtyZWNvcmQub2xkVmFsdWVdLCAxKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICBjb25zb2xlLmVycm9yKCdVbmV4cGVjdGVkIHJlY29yZCB0eXBlOiAnICsgSlNPTi5zdHJpbmdpZnkocmVjb3JkKSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHNwbGljZXM7XG4gIH1cblxuICBmdW5jdGlvbiBwcm9qZWN0QXJyYXlTcGxpY2VzKGFycmF5LCBjaGFuZ2VSZWNvcmRzKSB7XG4gICAgdmFyIHNwbGljZXMgPSBbXTtcblxuICAgIGNyZWF0ZUluaXRpYWxTcGxpY2VzKGFycmF5LCBjaGFuZ2VSZWNvcmRzKS5mb3JFYWNoKGZ1bmN0aW9uKHNwbGljZSkge1xuICAgICAgaWYgKHNwbGljZS5hZGRlZENvdW50ID09IDEgJiYgc3BsaWNlLnJlbW92ZWQubGVuZ3RoID09IDEpIHtcbiAgICAgICAgaWYgKHNwbGljZS5yZW1vdmVkWzBdICE9PSBhcnJheVtzcGxpY2UuaW5kZXhdKVxuICAgICAgICAgIHNwbGljZXMucHVzaChzcGxpY2UpO1xuXG4gICAgICAgIHJldHVyblxuICAgICAgfTtcblxuICAgICAgc3BsaWNlcyA9IHNwbGljZXMuY29uY2F0KGNhbGNTcGxpY2VzKGFycmF5LCBzcGxpY2UuaW5kZXgsIHNwbGljZS5pbmRleCArIHNwbGljZS5hZGRlZENvdW50LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNwbGljZS5yZW1vdmVkLCAwLCBzcGxpY2UucmVtb3ZlZC5sZW5ndGgpKTtcbiAgICB9KTtcblxuICAgIHJldHVybiBzcGxpY2VzO1xuICB9XG5cbiAvLyBFeHBvcnQgdGhlIG9ic2VydmUtanMgb2JqZWN0IGZvciAqKk5vZGUuanMqKiwgd2l0aFxuLy8gYmFja3dhcmRzLWNvbXBhdGliaWxpdHkgZm9yIHRoZSBvbGQgYHJlcXVpcmUoKWAgQVBJLiBJZiB3ZSdyZSBpblxuLy8gdGhlIGJyb3dzZXIsIGV4cG9ydCBhcyBhIGdsb2JhbCBvYmplY3QuXG52YXIgZXhwb3NlID0gZ2xvYmFsO1xuaWYgKHR5cGVvZiBleHBvcnRzICE9PSAndW5kZWZpbmVkJykge1xuaWYgKHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnICYmIG1vZHVsZS5leHBvcnRzKSB7XG5leHBvc2UgPSBleHBvcnRzID0gbW9kdWxlLmV4cG9ydHM7XG59XG5leHBvc2UgPSBleHBvcnRzO1xufVxuZXhwb3NlLk9ic2VydmVyID0gT2JzZXJ2ZXI7XG5leHBvc2UuT2JzZXJ2ZXIucnVuRU9NXyA9IHJ1bkVPTTtcbmV4cG9zZS5PYnNlcnZlci5vYnNlcnZlclNlbnRpbmVsXyA9IG9ic2VydmVyU2VudGluZWw7IC8vIGZvciB0ZXN0aW5nLlxuZXhwb3NlLk9ic2VydmVyLmhhc09iamVjdE9ic2VydmUgPSBoYXNPYnNlcnZlO1xuZXhwb3NlLkFycmF5T2JzZXJ2ZXIgPSBBcnJheU9ic2VydmVyO1xuZXhwb3NlLkFycmF5T2JzZXJ2ZXIuY2FsY3VsYXRlU3BsaWNlcyA9IGZ1bmN0aW9uKGN1cnJlbnQsIHByZXZpb3VzKSB7XG5yZXR1cm4gYXJyYXlTcGxpY2UuY2FsY3VsYXRlU3BsaWNlcyhjdXJyZW50LCBwcmV2aW91cyk7XG59O1xuZXhwb3NlLlBsYXRmb3JtID0gZ2xvYmFsLlBsYXRmb3JtO1xuZXhwb3NlLkFycmF5U3BsaWNlID0gQXJyYXlTcGxpY2U7XG5leHBvc2UuT2JqZWN0T2JzZXJ2ZXIgPSBPYmplY3RPYnNlcnZlcjtcbmV4cG9zZS5QYXRoT2JzZXJ2ZXIgPSBQYXRoT2JzZXJ2ZXI7XG5leHBvc2UuQ29tcG91bmRPYnNlcnZlciA9IENvbXBvdW5kT2JzZXJ2ZXI7XG5leHBvc2UuUGF0aCA9IFBhdGg7XG5leHBvc2UuT2JzZXJ2ZXJUcmFuc2Zvcm0gPSBPYnNlcnZlclRyYW5zZm9ybTtcbn0pKHR5cGVvZiBnbG9iYWwgIT09ICd1bmRlZmluZWQnICYmIGdsb2JhbCAmJiB0eXBlb2YgbW9kdWxlICE9PSAndW5kZWZpbmVkJyAmJiBtb2R1bGUgPyBnbG9iYWwgOiB0aGlzIHx8IHdpbmRvdyk7XG5cbn0pLmNhbGwodGhpcyx0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiID8gZ2xvYmFsIDogdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9KSJdfQ==
