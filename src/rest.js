angular.module('restkit', ['logging', 'restkit.mapping','restkit.collection'])

    .factory('guid', function () {
        return (function () {
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
    })

    .factory('wrappedCallback', function () {
        return function (callback) {
            return function (err, res) {
                if (callback) callback(err, res);
            }
        }
    })

    .factory('Pouch', function (guid, jlog) {

        var $log = jlog.loggerWithName('Pouch');

        var pouch = PouchDB('Rest');
        return {
            /**
             * Create a randomly named PouchDB instance.
             * Used for testing purposes.
             * @private
             */
            reset: function () {
                var dbName = guid();
                $log.debug('_reset:', dbName);
                pouch = new PouchDB(dbName);
            },

            /**
             * Return the global PouchDB instance.
             * Used for testing purposes.
             * @returns {PouchDB}
             */
            getPouch: function () {
                return pouch;
            }
        }
    })

    .factory('CollectionRegistry', function (jlog) {
        var $log = jlog.loggerWithName('CollectionRegistry');
        function CollectionRegistry () {}
        CollectionRegistry.prototype.register = function (collection) {
            var name = collection._name;
            $log.debug('register ' + name);
            this[ name] = collection;
        };
        return new CollectionRegistry();
    })



    .factory('RestError', function () {
        /**
         * Extension of javascript Error class for internal errors.
         * @param message
         * @param context
         * @param ssf
         * @returns {RestError}
         * @constructor
         */
        function RestError(message, context, ssf) {
            if (!this) {
                return new RestError(message, context);
            }

            this.message = message;

            this.context = context;
            // capture stack trace
            ssf = ssf || arguments.callee;
            if (ssf && Error.captureStackTrace) {
                Error.captureStackTrace(this, ssf);
            }
        }

        RestError.prototype = Object.create(Error.prototype);
        RestError.prototype.name = 'RestError';
        RestError.prototype.constructor = RestError;

        return RestError;
    })

    /**
     * Delegate property of an object to another object.
     */
    .factory('defineSubProperty', function () {
        return function (property, subObj) {
            return Object.defineProperty(this, property, {
                get: function () {
                    return subObj[property];
                },
                set: function (value) {
                    subObj[property] = value;
                },
                enumerable: true,
                configurable: true
            });
        }
    })

    .factory('assert', function (RestError) {
        function assert(condition, message, context) {
            if (!condition) {
                message = message || "Assertion failed";
                context = context || {};
                throw new RestError(message, context);
            }
        }
        return assert;
    })

;