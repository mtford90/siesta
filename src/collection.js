angular.module('restkit.collection', ['logging', 'restkit.mapping', 'restkit.descriptor'])

    .factory('CollectionRegistry', function (jlog) {
        var $log = jlog.loggerWithName('CollectionRegistry');

        function CollectionRegistry() {}

        CollectionRegistry.prototype.register = function (collection) {
            var name = collection._name;
            $log.debug('register ' + name);
            this[ name] = collection;
        };
        return new CollectionRegistry();
    })


    .factory('Collection', function (wrappedCallback, jlog, Mapping, Pouch, CollectionRegistry, RestError, $http, $rootScope, DescriptorRegistry) {

        var $log = jlog.loggerWithName('Collection');

        /**
         * @param name
         * @param {Function} configureCallback(err, version)
         * @param {Function} finishedCallback()
         * @constructor
         */
        function Collection(name, configureCallback, finishedCallback) {
            if (!this) return new Collection(name, configureCallback, finishedCallback);
            var self = this;

            // Name of this API. Used to construct _docId
            this.__name = name;

            Object.defineProperty(this, '_name', {
                get: function () {
                    return self.__name;
                },
                set: function (value) {
                    if (value) {
                        if (value.length) {
                            self.__name = value;
                            return;
                        }
                    }
                    throw new RestError('Collection must have name');
                },
                enumerable: true,
                configurable: true
            });

            // The PouchDB id.
            this._docId = 'Collection_' + this._name;

            // The PouchDB document that represents this Collection.
            this._doc = null;

            // Current version used for migrations.
            this.version = null;

            this._mappings = {};

            this.baseURL = '';

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
                                if (err instanceof RestError) {
                                    aggError = err;
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
                            $log.error('mapping "' + name + '" failed to install', err);
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

            this.__dirtyMappings = [];

            Object.defineProperty(this, 'isDirty', {
                get: function () {
                    return !!self.__dirtyMappings.length;
                },
                enumerable: true,
                configurable: true
            });

        }

        Collection.prototype._markMappingAsDirty = function (mapping) {
            if (this.__dirtyMappings.indexOf(mapping) < 0) {
                this.__dirtyMappings.push(mapping);
            }
            this._markGlobalAsDirtyIfNeccessary();
        };

        Collection.prototype._unmarkMappingAsDirty = function (mapping) {
            var idx = this.__dirtyMappings.indexOf(mapping);
            if (idx > -1) {
                this.__dirtyMappings.splice(idx, 1);
            }
            this._markGlobalAsDirtyIfNeccessary();
        };

        Collection.prototype._markGlobalAsDirtyIfNeccessary = function () {
            if (this.__dirtyMappings.length) {
                Collection._markCollectionAsDirty(this);
            }
            else {
                Collection._unmarkCollectionAsDirty(this);
            }
        };

        var dirtyCollections = [];

        Object.defineProperty(Collection, 'isDirty', {
            get: function () {
                return !!dirtyCollections.length;
            },
            enumerable: true,
            configurable: true
        });

        Collection._markCollectionAsDirty = function (coll) {
            if (dirtyCollections.indexOf(coll) < 0) {
                dirtyCollections.push(coll);
            }
        };

        Collection._unmarkCollectionAsDirty = function (coll) {
            var idx = dirtyCollections.indexOf(coll);
            if (idx > -1) {
                dirtyCollections.splice(idx, 1);
            }
        };

        Collection._reset = Pouch.reset;

        Collection._getPouch = Pouch.getPouch;

        Collection.prototype.registerMapping = function (name, mapping) {
            this._mappings[name] = mapping;
            var opts = $.extend(true, {}, mapping);
            opts.type = name;
            opts.collection = this._name;
            var mappingObject = new Mapping(opts);
            this[name] = mappingObject;
            return mappingObject;
        };

        Collection.prototype._httpResponse = function (method, path) {
            $log.trace('_httpResponse', this);
            var self = this;
            var args = Array.prototype.slice.call(arguments, 2);
            var callback;
            var opts = {};
            var name = this._name;
            if (typeof(args[0]) == 'function') {
                callback = args[0];
            }
            else if (typeof (args[0]) == 'object') {
                opts = args[0];
                callback = args[1];
            }
            opts.type = method;
            if (!opts.url) { // Allow overrides.
                var baseURL = this.baseURL;
                opts.url = baseURL + path;
            }
            opts.success = function (data, textStatus, jqXHR) {
                var resp = {data: data, textStatus: textStatus, jqXHR: jqXHR};
                var descriptors = DescriptorRegistry.responseDescriptorsForCollection(self);
                $log.debug('descriptors', descriptors);
                var matchedDescriptor;
                var extractedData;

                for (var i = 0; i < descriptors.length; i++) {
                    var descriptor = descriptors[i];
                    extractedData = descriptor.match(opts, data);
                    if (extractedData) {
                        matchedDescriptor = descriptor;
                        break;
                    }
                }
                if (matchedDescriptor) {
                    $log.trace('matched descriptor', matchedDescriptor);
                    if (typeof(extractedData) == 'object') {
                        var mapping = matchedDescriptor.mapping;
                        mapping.map(extractedData, function (err, obj) {
                            if (callback) {
                                $rootScope.$apply(function () {
                                    callback(err, obj, resp);
                                });
                            }
                        }, opts.obj);
                    }
                    else { // Matched, but no data.
                        $rootScope.$apply(function () {
                            callback(null, true, resp);
                        });
                    }
                }
                else if (callback) {
                    if (name) {
                        $log.debug('No matched response descriptor', {collection: name, method: method, path: path});
                        $rootScope.$apply(function () {
                            callback(null, null, resp);
                        });
                    }
                    else {
                        // There was a bug where collection name doesn't exist. If this occurs, then will never get hold of any descriptors.
                        throw new RestError('Unnamed collection');
                    }

                }
            };
            opts.error = function (jqXHR, textStatus, errorThrown) {
                $rootScope.$apply(function () {
                    var resp = {jqXHR: jqXHR, textStatus: textStatus, errorThrown: errorThrown};
                    if (callback) callback(resp, null, resp);
                });
            };
            $.ajax(opts);
        };

        Collection.prototype.GET = function () {
            _.partial(this._httpResponse, 'GET').apply(this, arguments);
        };

        Collection.prototype.OPTIONS = function () {
            _.partial(this._httpResponse, 'OPTIONS').apply(this, arguments);
        };

        Collection.prototype.TRACE = function () {
            _.partial(this._httpRequest, 'TRACE').apply(this, arguments);
        };

        Collection.prototype.HEAD = function () {
            _.partial(this._httpResponse, 'HEAD').apply(this, arguments);
        };

        Collection.prototype.POST = function () {
            _.partial(this._httpRequest, 'POST').apply(this, arguments);
        };

        Collection.prototype.PUT = function () {
            _.partial(this._httpRequest, 'PUT').apply(this, arguments);
        };

        Collection.prototype.PATCH = function () {
            _.partial(this._httpRequest, 'PATCH').apply(this, arguments);
        };

        Collection.prototype._httpRequest = function (method, path, object) {
            $log.trace(method, {path: path, object: object});
            var self = this;
            var args = Array.prototype.slice.call(arguments, 2);
            var callback;
            var opts = {};
            if (typeof(args[0]) == 'function') {
                callback = args[0];
            }
            else if (typeof (args[0]) == 'object') {
                opts = args[0];
                callback = args[1];
            }
            args = Array.prototype.slice.call(args, 2);
            var requestDescriptors = DescriptorRegistry.requestDescriptorsForCollection(this);
            var matchedDescriptor;
            opts.type = method;
            var baseURL = this.baseURL;
            opts.url = baseURL + path;
            for (var i = 0; i < requestDescriptors.length; i++) {
                var requestDescriptor = requestDescriptors[i];
                if (requestDescriptor._matchConfig(opts)) {
                    matchedDescriptor = requestDescriptor;
                    break;
                }
            }
            if (matchedDescriptor) {
                $log.trace('matched descriptor');
                matchedDescriptor._serialise(object, function (err, data) {
                    $log.trace('_serialise', {err: err, data: data});
                    if (err) {
                        if (callback) callback(err, null, null);
                    }
                    else {
                        opts.data = data;
                        opts.obj = object;
                        _.partial(self._httpResponse, method, path, opts, callback).apply(self, args);
                    }
                });
            }
            else if (callback) {
                $log.trace('did not match descriptor');
                callback(null, null, null);
            }
        };


        return Collection;

    })

;