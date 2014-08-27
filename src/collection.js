angular.module('restkit.collection', ['logging', 'restkit.mapping', 'restkit.descriptor'])


    .factory('Collection', function (wrappedCallback, jlog, Mapping, Pouch, CollectionRegistry, RestError, $http, $rootScope, DescriptorRegistry) {

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
            opts.collection = this._name;
            var mappingObject = new Mapping(opts);
            this[name] = mappingObject;
            return mappingObject;
        };

        Collection.prototype.HTTP = function (method, path) {
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
            var baseURL = this.baseURL;
            var url = baseURL + path;
            $log.debug(url);
            opts.type = method;
            opts.url = url;
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
                        });
                    }
                    else { // Matched, but no data.
                        $rootScope.$apply(function () {
                            callback(null, true, resp);
                        });
                    }
                }
                else if (callback) {
                    $log.debug('No matched descriptor', {collection: this._name, method: method, path: path});
                    $rootScope.$apply(function () {
                        callback(null, null, resp);
                    });
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
            _.partial(this.HTTP, 'GET').apply(this, arguments);
        };

        Collection.prototype.POST = function (path, object) {
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
            opts.type = 'POST';
            opts.url = url;
            for (var i = 0; i < requestDescriptors.length; i++) {
                var requestDescriptor = requestDescriptors[i];
                if (requestDescriptor._matchConfig(opts)) {
                    matchedDescriptor = requestDescriptor;
                    break;
                }
            }
            if (matchedDescriptor) {
                _.partial(this.HTTP, 'POST', path, opts, callback).apply(this, args);
            }
            else if (callback) {
                callback(null, null, null);
            }
        };

        return Collection;

    })

;