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
                console.log('_reset:', dbName);
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
        return function (property, subObj, innerProperty) {
            return Object.defineProperty(this, property, {
                get: function () {
                    if (innerProperty) {
                        return subObj[innerProperty];
                    }
                    else {
                        return subObj[property];
                    }
                },
                set: function (value) {
                    if (innerProperty) {
                        subObj[innerProperty] = value;
                    }
                    else {
                        subObj[property] = value;
                    }
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

    .factory('constructMapFunction', function () {

        function arrayAsString (arr) {
            var arrContents = _.reduce(arr, function (memo, f) {return memo + '"' + f + '",'}, '');
            arrContents = arrContents.substring(0, arrContents.length - 1);
            return '[' + arrContents + ']';
        }

        return function (collection, type, fields) {
            var mapFunc;
            var onlyEmptyFieldSetSpecified = (fields.length == 1 && !fields[0].length);
            var noFieldSetsSpecified = !fields.length || onlyEmptyFieldSetSpecified;

            var arr = arrayAsString(fields);
            if (noFieldSetsSpecified) {
                mapFunc = function (doc) {
                    var type = "$2";
                    var collection = "$3";
                    if (doc.type == type && doc.collection == collection) {
                        emit(doc.type, doc);
                    }
                }.toString();
            }
            else {
                mapFunc = function (doc) {
                    var type = "$2";
                    var collection = "$3";
                    if (doc.type == type && doc.collection == collection) {
                        var fields = $1;
                        var aggField = '';
                        for (var idx in fields) {
                            //noinspection JSUnfilteredForInLoop
                            var field = fields[idx];
                            var value = doc[field];
                            if (value !== null && value !== undefined) {
                                aggField += value.toString() + '_';
                            }
                            else if (value === null) {
                                aggField += 'null_';
                            }
                            else {
                                aggField += 'undefined_';
                            }
                        }
                        aggField = aggField.substring(0, aggField.length - 1);
                        emit(aggField, doc);
                    }
                }.toString();
                mapFunc = mapFunc.replace('$1', arr);
            }
            mapFunc = mapFunc.replace('$2', type);
            mapFunc = mapFunc.replace('$3', collection);
            return mapFunc;
        }
    })

    .factory('constructMapFunction2', function () {

        return function (collection, type, fields) {
            var mapFunc;
            var onlyEmptyFieldSetSpecified = (fields.length == 1 && !fields[0].length);
            var noFieldSetsSpecified = !fields.length || onlyEmptyFieldSetSpecified;

            if (noFieldSetsSpecified) {
                mapFunc = function (doc) {
                    if (doc.type == type && doc.collection == collection) {
                        emit(doc.type, doc);
                    }
                };
            }
            else {
                mapFunc = function (doc) {
                    if (doc.type == type && doc.collection == collection) {
                        var aggField = '';
                        for (var idx in fields) {
                            //noinspection JSUnfilteredForInLoop
                            var field = fields[idx];
                            var value = doc[field];
                            if (value !== null && value !== undefined) {
                                aggField += value.toString() + '_';
                            }
                            else if (value === null) {
                                aggField += 'null_';
                            }
                            else {
                                aggField += 'undefined_';
                            }
                        }
                        aggField = aggField.substring(0, aggField.length - 1);
                        emit(aggField, doc);
                    }
                };
            }
            return mapFunc;
        }
    })


;