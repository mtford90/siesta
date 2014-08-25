angular.module('restkit', ['logging', 'restkit.mapping'])

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
        CollectionRegistry.prototype.register = function (api) {
            var name = api._name;
            $log.debug('register ' + name);
            this[ name] = api;
        };
        return new CollectionRegistry();
    })

    .factory('Collection', function (wrappedCallback, jlog, Mapping, Pouch, CollectionRegistry, RestError) {

        var $log = jlog.loggerWithName('Collection');

        /**
         * @param name
         * @param {Function} configureCallback(err, version)
         * @param {Function} finishedCallback()
         * @constructor
         */
        function Collection(name, configureCallback, finishedCallback) {
            var self = this;

            // Name of this API. Used to construct _docId
            this._name = name;

            // The PouchDB id.
            this._docId = 'Collection_' + this._name;

            // The PouchDB document that represents this Collection.
            this._doc = null;

            // Current version used for migrations.
            this.version = null;

            this._mappings = {};

            /**
             * Serialise this Collection config into a pouchdb document.
             *
             * @param doc PouchDB document
             */
            function serialiseIntoPouchDoc(doc) {
                $log.debug('serialiseIntoPouchDoc', doc);
                doc.name = self._name;
                doc.version = self.version;
                doc.mappings = self._mappings;
                return doc;
            }

            /**
             * Update attributes using persisted version.
             * @param doc PouchDB doc representing this Collection.
             * @param callback
             */
            function fromDoc(doc, callback) {
                $log.debug('fromDoc', doc);
                self.version = doc.version;
                self._mappings = doc.mappings;
                var numMappingsInstalled = 0;
                var mappingInstallationErrors = {};
                var mappingsInstalled = [];
                var numErrors = 0;
                var numMappings = 0;
                var mappingName;

                for (mappingName in self._mappings) {
                    if (self._mappings.hasOwnProperty(mappingName)) {
                        numMappings++;
                    }
                }

                function installRelationships() {
                    _.each(mappingsInstalled, function (mapping) {
                        mapping.installRelationships();
                    });
                    _.each(mappingsInstalled, function (mapping) {
                        mapping.installReverseRelationships();
                    });
                }

                function checkIfFinishedInstallingMappings() {
                    if (numMappingsInstalled == numMappings) {
                        var aggError;
                        if (numErrors) {
                            aggError = new RestError('Error installing mappings', {errors: mappingInstallationErrors});
                        }
                        else {
                            try {
                                installRelationships();
                            }
                            catch (err) {
                                // Only allow our own internal errors to bubble up.
                                if (err instanceof RestError) {
                                    callback(err);
                                }
                                else {
                                    throw err;
                                }
                            }
                        }
                        callback(aggError);
                    }
                }

                function installMapping(mapping) {
                    var name = mapping.type.toString();
                    $log.debug('Installing mapping "' + name + '"');
                    mapping.install(function (err) {
                        numMappingsInstalled++;
                        if (err) {
                            $log.error('mapping "' +name + '" failed to install', err);
                            mappingInstallationErrors[mappingName] = err;
                            numErrors++;
                        }
                        else {
                            mappingsInstalled.push(mapping);
                            $log.debug(numMappingsInstalled.toString() + '/' + numMappings.toString() + ': mapping "' + name + '" installed');
                        }
                        checkIfFinishedInstallingMappings();
                    });
                }

                if (numMappings) {
                    for (mappingName in self._mappings) {
                        if (!self[mappingName]) {
                            if (self._mappings.hasOwnProperty(mappingName)) {
                                var mapping = self.registerMapping(mappingName, self._mappings[mappingName]);
                                installMapping(mapping);
                            }
                        }
                        else {
                            installMapping(self[mappingName]);
                        }
                    }
                }
                else {
                    callback(null, doc);
                }

            }

            /**
             * @returns {string} A string represention of this API.
             */
            function description() {
                return 'Collection[' + self._name.toString() + ']';
            }

            function finishUp(err) {
                wrappedCallback(finishedCallback)(err);
            }

            /**
             * Pull this Collection from PouchDB or else perform first time
             * setup.
             */
            function init() {
                $log.debug('init');
                CollectionRegistry.register(self);
                Pouch.getPouch().get(self._docId).then(function (doc) {
                    fromDoc(doc, function (err) {
                        if (err) finishUp(err);
                        else {
                            if (configureCallback) {
                                var bound = _.bind(configureCallback, self, null, doc.version);
                                bound();
                            }
                            doc = serialiseIntoPouchDoc(doc);
                            $log.debug('put', doc);
                            Pouch.getPouch().put(doc, function (err, resp) {
                                doc._id = resp.id;
                                doc._rev = resp.rev;
                                if (err) finishUp(err);
                                fromDoc(doc, finishUp);
                            });
                        }
                    });
                }).catch(function (err) {
                    if (err.status == 404) {
                        if (configureCallback) {
                            _.bind(configureCallback, self, null, null)();
                        }
                        var doc = serialiseIntoPouchDoc({});
                        Pouch.getPouch().put(doc, self._docId, function (err, resp) {
                            if (!err) {
                                doc._id = resp.id;
                                doc._rev = resp.rev;
                                self._doc = doc;
                                fromDoc(doc, finishUp);
                            }
                            else {
                                finishUp(err);
                            }
                        });
                    }
                    else {
                        if (configureCallback) {
                            configureCallback(err);
                        }
                    }
                });
            }

            init();

        }


        Collection._reset = Pouch.reset;

        Collection._getPouch = Pouch.getPouch;

        Collection.prototype.registerMapping = function (name, mapping) {
            this._mappings[name] = mapping;
            var opts = $.extend(true, {}, mapping);
            opts.type = name;
            opts.api = this._name;
            var mappingObject = new Mapping(opts);
            this[name] = mappingObject;
            return mappingObject;
        };

        return Collection;

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
                throw new RestError(message, context);
            }
        }
        return assert;
    })

;