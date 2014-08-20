angular.module('restkit.store', ['restkit', 'restkit.cache', 'restkit.query', 'restkit.pouchDocAdapter'])

    .factory('Store', function (cache, $q, wrappedCallback, RawQuery, Pouch, PouchDocAdapter) {
        return {
            get: function (opts, callback) {
                var restObject = cache.get(opts);
                if (restObject) {
                    wrappedCallback(callback)(null, restObject);
                }
                else {
                    if (opts._id) {
                        Pouch.getPouch().get(opts._id).then(function (doc) {
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

                        }, wrappedCallback(callback));
                    }
                    else {
                        wrappedCallback(callback)(new RestError('Invalid options given to store', {opts: opts}));
                    }
                }
            }
        }
    })

;