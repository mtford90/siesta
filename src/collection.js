angular.module('restkit.collection', ['logging', 'restkit.mapping', 'restkit.mapping.operation', 'restkit.descriptor'])

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


    .factory('Collection', function (wrappedCallback, jlog, Mapping, Pouch, CollectionRegistry, RestError, $http, $rootScope, DescriptorRegistry, $q, CompositeOperation, BaseOperation) {

        var $log = jlog.loggerWithName('Collection');

        /**
         * @param name
         * @constructor
         */
        function Collection(name) {
            if (!this) return new Collection(name);
            var self = this;

            this._name = name;
            this._docId = 'Collection_' + this._name;
            this._doc = null;
            this._rawMappings = {};
            this._mappings = {};
            this.baseURL = '';
            this.installed = false;
            this.__dirtyMappings = [];
            Object.defineProperty(this, 'isDirty', {
                get: function () {
                    return !!self.__dirtyMappings.length;
                },
                enumerable: true,
                configurable: true
            });
        }

        /**
         * Ensure mappings are installed.
         * @param callback
         */
        Collection.prototype.install = function (callback) {
            var self = this;
            if (!this.installed) {
                CollectionRegistry.register(self);
                var mappingsToInstall = [];
                for (var name in this._mappings) {
                    if (this._mappings.hasOwnProperty(name)) {
                        var mapping = this._mappings[name];
                        mappingsToInstall.push(mapping);
                    }
                }
                $log.info('There are ' + mappingsToInstall.length.toString() + ' mappings to install');
                if (mappingsToInstall.length) {
                    var operations = _.map(mappingsToInstall, function (m) {
                        return new BaseOperation('Install Mapping', _.bind(m.install, m));
                    });
                    var op = new CompositeOperation('Install Mappings');
                    op.operations = operations;
                    op.completionCallback = function () {
                        if (op.failed) {
                            callback(op.error);
                        }
                        else {
                            self.installed = true;
                            var errors = [];
                            _.each(mappingsToInstall, function (m) {
                                $log.info('Installing relationships for mapping with name "' + m.type + '"');
                                try {
                                    m.installRelationships();
                                }
                                catch (err) {
                                    if (err instanceof RestError) {
                                        errors.push(err);
                                    }
                                    else {
                                        throw err;
                                    }
                                }
                            });
                            _.each(mappingsToInstall, function (m) {
                                $log.info('Installing reverse relationships for mapping with name "' + m.type + '"');
                                try {
                                    m.installReverseRelationships();
                                }
                                catch (err) {
                                    if (err instanceof RestError) {
                                        errors.push(err);
                                    }
                                    else {
                                        throw err;
                                    }
                                }
                            });
                            var err;
                            if (errors.length == 1) {
                                 err = errors[0];
                            }
                            else if (errors.length) {
                                err = errors;
                            }
                            callback(err);
                        }
                    };
                    op.start();
                }
                else {
                    self.installed = true;
                    callback();
                }
            }
            else {
                if (callback) callback(new RestError('Collection "' + this._name + '" has already been installed'));
            }
        };

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

        /*
         Registration
         */
        Collection.prototype.mapping = function (name, mapping) {
            this._rawMappings[name] = mapping;
            var opts = $.extend(true, {}, mapping);
            opts.type = name;
            opts.collection = this._name;
            var mappingObject = new Mapping(opts);
            this._mappings[name] = mappingObject;
            this[name] = mappingObject;
            return mappingObject;
        };

        /*
         HTTP Requests
         */
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
//            $log.trace(method + {path: path, object: object});
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
                $log.trace('Matched descriptor: ' + matchedDescriptor._dump(true));
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
                $log.trace('Did not match descriptor');
                callback(null, null, null);
            }
        };

        Collection.prototype._dump = function (asJson) {
            var obj = {};
            obj.installed = this.installed;
            obj.docId = this._docId;
            obj.name = this._name;
            obj.baseURL = this.baseURL;
            obj.dirtyMappings = _.pluck(this.__dirtyMappings, 'type');
            return asJson ? JSON.stringify(obj, null, 4) : obj;
        };

        return Collection;

    })

;