angular.module('restkit.store', ['restkit', 'restkit.cache', 'restkit.pouchDocAdapter'])

/**
 * Local object store. Mediates between in-memory cache and Pouch.
 */
    .factory('Store', function (cache, $q, wrappedCallback, Pouch, PouchDocAdapter, RestError, jlog, assert) {

        var $log = jlog.loggerWithName('Store');

        function processDoc(doc, callback) {
            try {
                var restObject = PouchDocAdapter.toNew(doc);
                cache.insert(restObject);
                if (callback) callback(null, restObject);
            }
            catch (err) {
                if (callback) {
                    callback(err);
                }
            }
        }

        function get(opts, callback) {
            var restObject;
            if (opts._id) {
                if (Object.prototype.toString.call(opts._id) === '[object Array]') {
                    // Proxy onto getMultiple instead.
                    getMultiple(_.map(opts._id, function (id) {return {_id: id}}), callback);
                }
                else {
                    restObject = cache.get(opts);
                    if (restObject) {
                        $log.debug('Had cached object', {opts: opts, obj: restObject});
                        wrappedCallback(callback)(null, restObject);
                    }
                    else {
                        // TODO: Is there a nicer way to check if obj is an array?
                        if (Object.prototype.toString.call(opts._id) === '[object Array]') {
                            // Proxy onto getMultiple instead.
                            getMultiple(_.map(opts._id, function (id) {return {_id: id}}), callback);
                        }
                        else {
                            Pouch.getPouch().get(opts._id).then(function (doc) {
                                processDoc(doc, callback);
                            }, wrappedCallback(callback));
                        }
                    }
                }
            }
            else if (opts.mapping) {
                if (Object.prototype.toString.call(opts[opts.mapping.id]) === '[object Array]') {
                    // Proxy onto getMultiple instead.
                    getMultiple(_.map(opts[opts.mapping.id], function (id) {
                        var o = {};
                        o[opts.mapping.id] = id;
                        return o
                    }), callback);
                }
                else {
                    restObject = cache.get(opts);
                    if (restObject) {
                        $log.debug('Had cached object', {opts: opts, obj: restObject});
                        wrappedCallback(callback)(null, restObject);
                    }
                    else {
                        var mapping = opts.mapping;
                        var idField = mapping.id;
                        var id = opts[idField];
                        if (id) {
                            mapping.get(id, function (err, doc) {
                                if (!err) {
                                    if (doc) {
                                        processDoc(doc, callback);
                                    }
                                    else {
                                        callback(null, null);
                                    }
                                }
                                else {
                                    callback(err);
                                }
                            });
                        }
                        else {
                            wrappedCallback(callback)(new RestError('Invalid options given to store. Missing "' + idField.toString() + '."', {opts: opts}));
                        }
                    }
                }
            }
            else {
                // No way in which to find an object locally.
                wrappedCallback(callback)(new RestError('Invalid options given to store', {opts: opts}));
            }


        }

        function getMultiple(optsArray, callback) {
            var docs = [];
            var errors = [];
            _.each(optsArray, function (opts) {
                get(opts, function (err, doc) {
                    if (err) {
                        errors.push(err);
                    }
                    else {
                        docs.push(doc);
                    }
                    if (docs.length + errors.length == optsArray.length) {
                        if (callback) {
                            if (errors.length) {
                                callback(errors);
                            }
                            else {
                                callback(null, docs);
                            }
                        }
                    }
                });
            });
        }

        return {
            get: get,
            getMultiple: getMultiple,
            put: function (object, callback) {
                $log.debug('put', object);
                assert(object._id);
                cache.insert(object);
                var adapted = PouchDocAdapter.from(object);
                Pouch.getPouch().put(adapted, function (err, resp) {
                    if (!err) {
                        object._rev = resp.rev;
                        $log.debug('put success', object);

                    }
                    if (callback) callback(err);
                });
            }
        }
    })

;