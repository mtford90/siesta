/**
 * This is an in-memory cache for models. Models are cached by local id (_id) and remote id (defined by the mapping).
 * Lookups are performed against the cache when mapping.
 * @module cache
 */
var log = require('./log')('cache'),
  InternalSiestaError = require('./error').InternalSiestaError,
  util = require('./util');


function Cache() {
  this.reset();
}

Cache.prototype = {
  reset: function() {
    this.remote = {};
    this.localById = {};
    this.local = {};
  },
  /**
   * Return the object in the cache given a local id (_id)
   * @param  {String|Array} localId
   * @return {ModelInstance}
   */
  getViaLocalId: function getViaLocalId(localId) {
    if (util.isArray(localId)) return localId.map(function(x) {return this.localById[x]}.bind(this));
    else return this.localById[localId];
  },
  /**
   * Given a remote identifier and an options object that describes mapping/collection,
   * return the model if cached.
   * @param  {String|Array} remoteId
   * @param  {Object} opts
   * @param  {Object} opts.model
   * @return {ModelInstance}
   */
  getViaRemoteId: function(remoteId, opts) {
    var c = (this.remote[opts.model.collectionName] || {})[opts.model.name] || {};
    return util.isArray(remoteId) ? remoteId.map(function(x) {return c[x]}) : c[remoteId];
  },
  /**
   * Return the singleton object given a singleton model.
   * @param  {Model} model
   * @return {ModelInstance}
   */
  getSingleton: function(model) {
    var modelName = model.name;
    var collectionName = model.collectionName;
    var collectionCache = this.local[collectionName];
    if (collectionCache) {
      var typeCache = collectionCache[modelName];
      if (typeCache) {
        var objs = [];
        for (var prop in typeCache) {
          if (typeCache.hasOwnProperty(prop)) {
            objs.push(typeCache[prop]);
          }
        }
        if (objs.length > 1) {
          var errStr = 'A singleton model has more than 1 object in the cache! This is a serious error. ' +
            'Either a model has been modified after objects have already been created, or something has gone' +
            'very wrong. Please file a bug report if the latter.';
          throw new InternalSiestaError(errStr);
        } else if (objs.length) {
          return objs[0];
        }
      }
    }
    return null;
  }
};


var cache = new Cache();


/**
 * Insert an object into the cache using a remote identifier defined by the mapping.
 * @param  {ModelInstance} obj
 * @param  {String} remoteId
 * @param  {String} previousRemoteId If remote id has been changed, this is the old remote identifier
 */
function remoteInsert(obj, remoteId, previousRemoteId) {
  if (obj) {
    var collectionName = obj.model.collectionName;
    if (collectionName) {
      if (!cache.remote[collectionName]) {
        cache.remote[collectionName] = {};
      }
      var type = obj.model.name;
      if (type) {
        if (!cache.remote[collectionName][type]) {
          cache.remote[collectionName][type] = {};
        }
        if (previousRemoteId) {
          cache.remote[collectionName][type][previousRemoteId] = null;
        }
        var cachedObject = cache.remote[collectionName][type][remoteId];
        if (!cachedObject) {
          cache.remote[collectionName][type][remoteId] = obj;
          log('Remote cache insert: ' + obj._dump(true));
        } else {
          // Something has gone really wrong. Only one object for a particular collection/type/remoteid combo
          // should ever exist.
          if (obj != cachedObject) {
            var message = 'Object ' + collectionName.toString() + ':' + type.toString() + '[' + obj.model.id + '="' + remoteId + '"] already exists in the cache.' +
              ' This is a serious error, please file a bug report if you are experiencing this out in the wild';
            log(message, {
              obj: obj,
              cachedObject: cachedObject
            });
            throw new InternalSiestaError(message);
          } else {
            log('Object has already been inserted: ' + obj._dump(true));
          }

        }
      } else {
        throw new InternalSiestaError('Model has no type', {
          model: obj.model,
          obj: obj
        });
      }
    } else {
      throw new InternalSiestaError('Model has no collection', {
        model: obj.model,
        obj: obj
      });
    }
  } else {
    var msg = 'Must pass an object when inserting to cache';
    log(msg);
    throw new InternalSiestaError(msg);
  }
}


function _remoteCache() {
  return cache.remote
}

function _localCache() {
  return cache.localById;
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
  log('get', opts);
  var obj, idField, remoteId;
  var localId = opts.localId;
  if (localId) {
    obj = cache.getViaLocalId(localId);
    if (obj) {
      return obj;
    } else {
      if (opts.model) {
        idField = opts.model.id;
        remoteId = opts[idField];
        log(idField + '=' + remoteId);
        return cache.getViaRemoteId(remoteId, opts);
      } else {
        return null;
      }
    }
  } else if (opts.model) {
    idField = opts.model.id;
    remoteId = opts[idField];
    if (remoteId) {
      return cache.getViaRemoteId(remoteId, opts);
    } else if (opts.model.singleton) {
      return cache.getSingleton(opts.model);
    }
  } else {
    log('Invalid opts to cache', {
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
  var localId = obj.localId;
  if (localId) {
    var collectionName = obj.model.collectionName;
    var modelName = obj.model.name;
    if (!cache.localById[localId]) {
      cache.localById[localId] = obj;
      if (!cache.local[collectionName]) cache.local[collectionName] = {};
      if (!cache.local[collectionName][modelName]) cache.local[collectionName][modelName] = {};
      cache.local[collectionName][modelName][localId] = obj;
    } else {
      // Something has gone badly wrong here. Two objects should never exist with the same _id
      if (cache.localById[localId] != obj) {
        var message = 'Object with localId="' + localId.toString() + '" is already in the cache. ' +
          'This is a serious error. Please file a bug report if you are experiencing this out in the wild';
        log(message);
        throw new InternalSiestaError(message);
      }
    }
  }
  var idField = obj.idField;
  var remoteId = obj[idField];
  if (remoteId) {
    remoteInsert(obj, remoteId);
  } else {
    log('No remote id ("' + idField + '") so wont be placing in the remote cache', obj);
  }
}

/**
 * Returns true if object is in the cache
 * @param  {ModelInstance} obj
 * @return {boolean}
 */
function contains(obj) {
  var q = {
    localId: obj.localId
  };
  var model = obj.model;
  if (model.id) {
    if (obj[model.id]) {
      q.model = model;
      q[model.id] = obj[model.id];
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
    var collectionName = obj.model.collectionName;
    var modelName = obj.model.name;
    var localId = obj.localId;
    if (!modelName) throw InternalSiestaError('No mapping name');
    if (!collectionName) throw InternalSiestaError('No collection name');
    if (!localId) throw InternalSiestaError('No localId');
    delete cache.local[collectionName][modelName][localId];
    delete cache.localById[localId];
    if (obj.model.id) {
      var remoteId = obj[obj.model.id];
      if (remoteId) {
        delete cache.remote[collectionName][modelName][remoteId];
      }
    }
  }
}


exports._remoteCache = _remoteCache;
exports._localCache = _localCache;
Object.defineProperty(exports, '_localCacheByType', {
  get: function() {
    return cache.local;
  }
});
exports.get = get;
exports.insert = insert;
exports.remoteInsert = remoteInsert;
exports.reset = cache.reset.bind(cache);
exports.contains = contains;
exports.remove = remove;
exports.getSingleton = cache.getSingleton.bind(cache);
exports.getViaLocalId = cache.getViaLocalId.bind(cache);
exports.getViaRemoteId = cache.getViaRemoteId.bind(cache);
exports.count = function() {
  return Object.keys(cache.localById).length;
};