angular.module('restkit.cache', ['restkit', 'restkit.object'])



    .factory('cache', function (RestObject, RestError, jlog) {

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

        return {
            '_restCache': function () {return restCache},
            '_idCache': function () {return idCache},
            get: function (opts) {
                $log.debug('get', opts);
                if (opts._id) {
                    $log.debug('looking up via _id "' + opts._id.toString() + '"');
                    return idCache[opts._id];
                }
                else if (opts.mapping) {
                    var idField = opts.mapping.id;
                    var id = opts[idField];
                    var type = opts.mapping.type;
                    var api = opts.mapping.api;
                    $log.debug('looking up via mapping ' + api.toString() + ':' + type.toString() + '[' + id + ']', {restCache: restCache, idCache: idCache});
                    var apiCache = restCache[api];
                    if (apiCache) {
                        var typeCache = restCache[api][type];
                        if (typeCache) {
                            return typeCache[id];
                        }
                    }
                    return null;
                }
                return null;
            },
            insert: function (obj) {
                if (obj instanceof RestObject) {
                    if (obj._id) {
                        if (!idCache[obj._id]) {
                            $log.debug('Cached object '  + obj.api + ':' + obj.type + '[_id="' + obj._id + '"]');
                            idCache[obj._id] = obj;
                        }
                    }
                    var idField = obj.idField;
                    var id = obj[idField];
                    if (id) {
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
                                if (!restCache[api][type][id]) {
                                    restCache[api][type][id] = obj;
                                    $log.debug('Cached object '  + obj.api + ':' + obj.type + '[' + obj.mapping.id + '="' + id + '"]');
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
                }
                else {
                    throw new RestError('Only an instance of RestObject can be placed into the object cache.');
                }
            },
            reset: reset
        }
    })

;
