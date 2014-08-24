angular.module('restkit.cache', ['restkit', 'restkit.object'])


    .factory('cache', function (RestObject, RestError, jlog, $rootScope) {

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
            $log.debug('looking up via _id "' + localId.toString() + '"');
            var obj = idCache[localId];
            if (obj) {
                $log.debug('Cache hit on _id "' + localId.toString() + '"');
            }
            else {
                $log.debug('Cache miss on _id "' + localId.toString() + '"');
            }
            return  obj;
        }

        function getViaRemoteId(remoteId, opts) {
            var type = opts.mapping.type;
            var api = opts.mapping.api;
            var desc = api.toString() + ':' + type.toString() + '[' + remoteId + ']';
            $log.debug('looking up via mapping ' + desc, {restCache: restCache, idCache: idCache});
            var apiCache = restCache[api];
            if (apiCache) {
                var typeCache = restCache[api][type];
                if (typeCache) {
                    var obj = typeCache[remoteId];
                    if (obj) {
                        $log.debug('Cache hit on ' + desc);
                    }
                    else {
                        $log.debug('Cache miss on ' + desc);
                    }
                    return  obj;
                }
            }
            $log.debug('Cache miss on ' + desc);
            return null;
        }

        return {
            '_restCache': function () {return restCache},
            '_idCache': function () {return idCache},
            get: function (opts) {
                var obj, idField, remoteId;
                $log.debug('get', opts);
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
                if (obj instanceof RestObject) {
                    if (obj._id) {
                        if (!idCache[obj._id]) {
                            $log.debug('Cache insert ' + obj.api + ':' + obj.type + '[_id="' + obj._id + '"]');
                            idCache[obj._id] = obj;
                        }
                    }
                    var idField = obj.idField;
                    var remoteId = obj[idField];
                    if (remoteId) {
                        var api = obj.mapping.api;
                        if (api) {
                            if (!restCache[api]) {
                                restCache[api] = {};
                            }
                            var type = obj.mapping.type;
                            if (type) {
                                if (!restCache[api][type]) {
                                    restCache[api][type] = {};
                                }
                                if (!restCache[api][type][remoteId]) {
                                    restCache[api][type][remoteId] = obj;
                                    $log.debug('Cache insert ' + obj.api + ':' + obj.type + '[' + obj.mapping.id + '="' + remoteId + '"]');
                                }
                            }
                            else {
                                throw new RestError('Mapping has no type', {mapping: obj.mapping, obj: obj});
                            }
                        }
                        else {
                            throw new RestError('Mapping has no api', {mapping: obj.mapping, obj: obj});
                        }
                    }
                    else {
                        $log.debug('No remote id ("' + idField + '") so wont be placing in the remote cache', obj);
                    }
                }
                else {
                    throw new RestError('Only an instance of RestObject can be placed into the object cache.');
                }
            },
            reset: reset
        }
    })

;
