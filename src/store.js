angular.module('restkit.store', ['restkit', 'restkit.cache', 'restkit.pouchDocAdapter'])

/**
 * Local object store. Mediates between in-memory cache and Pouch.
 */
    .factory('Store', function (cache, $q, wrappedCallback, Pouch, PouchDocAdapter, RestError, jlog) {

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
            $log.debug('Store.get', opts);
            var restObject = cache.get(opts);
            if (restObject) {
                wrappedCallback(callback)(null, restObject);
            }
            else {
                if (opts._id) {
                    Pouch.getPouch().get(opts._id).then(function (doc) {
                        processDoc(doc, callback);
                    }, wrappedCallback(callback));
                }
                else if (opts.mapping) {
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
                                    callback(new RestError('No such object with identifier ' + id.toString()));
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
                else {
                    // No way in which to find an object locally.
                    wrappedCallback(callback)(new RestError('Invalid options given to store', {opts: opts}));
                }
            }
        }

        return {
            get: get,
            getMultiple: function (optsArray, callback) {
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
        }
    })

;