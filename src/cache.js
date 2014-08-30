angular.module('restkit.cache', ['restkit', 'restkit.object'])


    .factory('cache', function (RestError, jlog) {

        var $log = jlog.loggerWithName('Cache');

        /**
         * Cache by pouch _id.
         * @type {{}}
         */
        var idCache = {};

        /**
         * Cache by type and whatever id was specified in the mapping.
         * @type {{}}
         */
        var restCache = {};

        function reset() {
            restCache = {};
            idCache = {};
        }

        reset();

        function getViaLocalId(localId) {
            var obj = idCache[localId];
            if (obj) {
                $log.debug('Local cache hit: ' + obj._dump(true));
            }
            else {
                $log.debug('Local cache miss: ' + localId);
            }
            return  obj;
        }

        function getViaRemoteId(remoteId, opts) {
            var type = opts.mapping.type;
            var collection = opts.mapping.collection;
            var collectionCache = restCache[collection];
            if (collectionCache) {
                var typeCache = restCache[collection][type];
                if (typeCache) {
                    var obj = typeCache[remoteId];
                    if (obj) {
                        $log.debug('Remote cache hit: ' + obj._dump(true));
                    }
                    else {
                        $log.debug('Remote cache miss: ' + remoteId);
                    }
                    return  obj;
                }
            }
            $log.debug('Remote cache miss: ' + remoteId);
            return null;
        }

        function remoteInsert(obj, remoteId, previousRemoteId) {
            if (obj) {
                var collection = obj.mapping.collection;
                if (collection) {
                    if (!restCache[collection]) {
                        restCache[collection] = {};
                    }
                    var type = obj.mapping.type;
                    if (type) {
                        if (!restCache[collection][type]) {
                            restCache[collection][type] = {};
                        }
                        if (previousRemoteId) {
                            restCache[collection][type][previousRemoteId] = null;
                        }
                        var cachedObject = restCache[collection][type][remoteId];
                        if (!cachedObject) {
                            restCache[collection][type][remoteId] = obj;
                            $log.debug('Remote cache insert: ' + obj._dump(true));
                            $log.trace('Remote cache now looks like: ' + remoteDump(true))
                        }
                        else {
                            // Something has gone really wrong. Only one object for a particular collection/type/remoteid combo
                            // should ever exist.
                            if (obj != cachedObject) {
                                var message = 'Object ' + collection.toString() + ':' + type.toString() + '[' + obj.mapping.id + '="' + remoteId + '"] already exists in the cache.' +
                                    ' This is a serious error, please file a bug report if you are experiencing this out in the wild';
                                $log.error(message);
                                throw new RestError(message);
                            }
                            else {
                                $log.debug('Object has already been inserted: ' + obj._dump(true));
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
                $log.error(msg);
                throw new RestError(msg);
            }

        }

        function remoteDump(asJson) {
            var dumpedRestCache = {};
            for (var coll in restCache) {
                if (restCache.hasOwnProperty(coll)) {
                    var dumpedCollCache = {};
                    dumpedRestCache[coll] = dumpedCollCache;
                    var collCache = restCache[coll];
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
            for (var id in idCache) {
                if (idCache.hasOwnProperty(id)) {
                    dumpedIdCache[id] = idCache[id]._dump()
                }
            }
            return asJson ? JSON.stringify(dumpedIdCache, null, 4) : dumpedIdCache;
        }

        function dump (asJson) {
            var dumped = {
                idCache: localDump(),
                restCache: remoteDump()
            };
            return asJson ? JSON.stringify(dumped, null, 4) : dumped;
        }

        return {
            '_restCache': function () {return restCache},
            '_idCache': function () {return idCache},
            get: function (opts) {
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
                    return getViaRemoteId(remoteId, opts);
                }
                $log.warn('Invalid opts to cache', {opts: opts});
                return null;
            },
            insert: function (obj) {
                if (obj._id) {
                    if (!idCache[obj._id]) {
                        $log.debug('Local cache insert: ' + obj._dump(true));
                        idCache[obj._id] = obj;
                        $log.trace('Local cache now looks like: ' + localDump(true));
                    }
                    else {
                        // Something has gone badly wrong here. Two objects should never exist with the same _id
                        if (idCache[obj._id] != obj) {
                            var message = 'Object with _id="' + obj._id.toString() + '" is already in the cache. ' +
                                'This is a serious error. Please file a bug report if you are experiencing this out in the wild';
                            $log.error(message);
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
                    $log.debug('No remote id ("' + idField + '") so wont be placing in the remote cache', obj);
                }
            },
            remoteInsert: remoteInsert,
            reset: reset,
            _dump: dump
        }
    })

;
