angular.module('restkit.store', ['restkit', 'restkit.cache', 'restkit.pouchDocAdapter'])


    .factory('Store', function (cache, $q, wrappedCallback, Pouch, PouchDocAdapter, RestError, jlog, assert) {

        var $log = jlog.loggerWithName('Store');

        function get(opts, callback) {
            $log.debug('get', opts);
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
                        if (Object.prototype.toString.call(opts._id) === '[object Array]') {
                            // Proxy onto getMultiple instead.
                            getMultiple(_.map(opts._id, function (id) {return {_id: id}}), callback);
                        }
                        else {
                            Pouch.getPouch().get(opts._id).then(function (doc) {
                                dump(0);
                                var docs = PouchDocAdapter.toFount([doc]);
                                if (callback) callback(null, docs.length ? docs[0] : null);
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
                        o.mapping = opts.mapping;
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
                            mapping.get(id, function (err, obj) {
                                if (!err) {
                                    if (obj) {
                                        callback(null, obj);
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
                var context = {opts: opts};
                var msg = 'Invalid options given to store';
                $log.error(msg, context);
                wrappedCallback(callback)(new RestError(msg, context));
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
            getMultiple: getMultiple
        }
    })

;