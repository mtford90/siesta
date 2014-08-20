angular.module('restkit.store', ['restkit', 'restkit.cache', 'restkit.query'])

    .factory('gsfdgsdfg', function (cache, $q, wrappedCallback, RawQuery, Pouch) {
        return {
            get: function (opts, callback) {
                var deferred = $q.defer();
                var restObject = cache.get(opts);
                if (restObject) {
                    wrappedCallback(callback)(null, restObject);
                    deferred.resolve(restObject);
                }
                else {
                    if (opts._id) {
                        Pouch.get(opts._id).then(function (doc) {

                        }, wrappedCallback(callback));
                    }
                }
                return deferred.promise;
            }
        }
    })

;