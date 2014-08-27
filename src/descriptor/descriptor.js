angular.module('restkit.descriptor', ['restkit', 'restkit.serialiser'])

    .factory('DescriptorRegistry', function (assert, jlog) {

        var $log = jlog.loggerWithName('DescriptorRegistry');

        function DescriptorRegistry() {
            if (!this) {
                return new DescriptorRegistry(opts);
            }
            this.requestDescriptors = {};
            this.responseDescriptors = {};
        }

        function _registerDescriptor(descriptors, descriptor) {
            var mapping = descriptor.mapping;
            var collection = mapping.collection;
            assert(mapping);
            assert(collection);
            assert(typeof(collection) == 'string');
            if (!descriptors[collection]) {
                descriptors[collection] = [];
            }
            descriptors[collection].push(descriptor);
        }

        DescriptorRegistry.prototype.registerRequestDescriptor = function (requestDescriptor) {
            _registerDescriptor(this.requestDescriptors, requestDescriptor);
        };

        DescriptorRegistry.prototype.registerResponseDescriptor = function (responseDescriptor) {
            $log.trace('registerResponseDescriptor');
            _registerDescriptor(this.responseDescriptors, responseDescriptor);
        };

        function _descriptorsForCollection(descriptors, collection) {
            var descriptorsForCollection;
            if (typeof(collection) == 'string') {
                descriptorsForCollection = descriptors[collection] || [];
            }
            else {
                descriptorsForCollection = (descriptors[collection._name] || []);
            }
            return descriptorsForCollection;
        }

        DescriptorRegistry.prototype.requestDescriptorsForCollection = function (collection) {
            return _descriptorsForCollection(this.requestDescriptors, collection);
        };

        DescriptorRegistry.prototype.responseDescriptorsForCollection = function (collection) {
            var descriptorsForCollection = _descriptorsForCollection(this.responseDescriptors, collection);
            if (!descriptorsForCollection.length) {
                $log.debug('No response descriptors for collection ' , this.responseDescriptors);
            }
            return  descriptorsForCollection;
        };

        return new DescriptorRegistry();
    })

    .factory('Descriptor', function (defineSubProperty, CollectionRegistry, RestError, DescriptorRegistry, assert, jlog) {

        var $log = jlog.loggerWithName('Descriptor');

        // The XRegExp object has these properties that we want to ignore when matching.
        var ignore = ['index', 'input'];


        function Descriptor(opts) {
            if (!this) {
                return new Descriptor(opts);
            }

            this._opts = opts;

            // Convert path string into XRegExp if not already.
            if (this._opts.path) {
                if (!(this._opts.path instanceof XRegExp)) {
                    this._opts.path = XRegExp(this._opts.path);
                }
            }
            else {
                this._opts.path = '';
            }

            // Convert wildcards into methods and ensure is an array of uppercase methods.
            if (this._opts.method) {
                if (this._opts.method == '*' || this._opts.method.indexOf('*') > -1) {
                    this._opts.method = this.httpMethods;
                }
                else if (typeof(this._opts.method) == 'string') {
                    this._opts.method = [this._opts.method];
                }
            }
            else {
                this._opts.method = this.httpMethods;
            }
            this._opts.method = _.map(this._opts.method, function (x) {return x.toUpperCase()});

            // Mappings can be passed as the actual mapping object or as a string (with API specified too)
            if (this._opts.mapping) {
                if (typeof(this._opts.mapping) == 'string') {
                    if (this._opts.collection) {
                        var collection;
                        if (typeof(this._opts.collection) == 'string') {
                            collection = CollectionRegistry[this._opts.collection];
                        }
                        else {
                            collection = this._opts.collection;
                        }
                        if (collection) {
                            var actualMapping = collection[this._opts.mapping];
                            if (actualMapping) {
                                this._opts.mapping = actualMapping;
                            }
                            else {
                                throw new RestError('Mapping ' + this._opts.mapping + ' does not exist', {opts: opts, descriptor: this});
                            }
                        }
                        else {
                            throw new RestError('Collection ' + this._opts.collection + ' does not exist', {opts: opts, descriptor: this});
                        }
                    }
                    else {
                        throw new RestError('Passed mapping as string, but did not specify the collection it belongs to', {opts: opts, descriptor: this});
                    }
                }
            }
            else {
                throw new RestError('Descriptors must be initialised with a mapping', {opts: opts, descriptor: this});
            }

            // If key path, convert data key path into an object that we can then use to traverse the HTTP bodies.
            // otherwise leave as string or undefined.
            var data = this._opts.data;
            if (data) {
                if (data.length) {
                    var root;
                    var arr = data.split('.');
                    if (arr.length == 1) {
                        root = arr[0];
                    }
                    else {
                        var obj = {};
                        root = obj;
                        var previousKey = arr[0];
                        for (var i = 1; i < arr.length; i++) {
                            var key = arr[i];
                            if (i == (arr.length - 1)) {
                                obj[previousKey] = key;
                            }
                            else {
                                var newVar = {};
                                obj[previousKey] = newVar;
                                obj = newVar;
                                previousKey = key;
                            }
                        }
                    }
                    this._opts.data = root;
                }
            }

            defineSubProperty.call(this, 'path', this._opts);
            defineSubProperty.call(this, 'method', this._opts);
            defineSubProperty.call(this, 'mapping', this._opts);
            defineSubProperty.call(this, 'data', this._opts);
        }

        Descriptor.prototype.httpMethods = ['POST', 'PATCH', 'PUT', 'HEAD', 'GET', 'DELETE', 'OPTIONS', 'TRACE', 'CONNECT'];

        Descriptor.prototype._matchPath = function (path) {
            var match = XRegExp.exec(path, this.path);
            var matched = null;
            if (match) {
                matched = {};
                for (var prop in match) {
                    if (match.hasOwnProperty(prop)) {
                        if (isNaN(parseInt(prop)) && ignore.indexOf(prop) < 0) {
                            matched[prop] = match[prop];
                        }
                    }
                }
            }
            return matched;
        };

        Descriptor.prototype._matchMethod = function (method) {
            for (var i = 0; i < this.method.length; i++) {
                if (method.toUpperCase() == this.method[i]) {
                    return true;
                }
            }
            return false;
        };

        /**
         * Bury obj as far down in data as poss.
         * @param obj
         * @param data keypath object
         * @returns {*}
         */
        function bury(obj, data) {
            var root = data;
            var keys = Object.keys(data);
            assert(keys.length == 1);
            var key = keys[0];
            var curr = data;
            while (!(typeof(curr[key]) == 'string')) {
                curr = curr[key];
                keys = Object.keys(curr);
                assert(keys.length == 1);
                key = keys[0];
            }
            var newParent = curr[key];
            var newObj = {};
            curr[key] = newObj;
            newObj[newParent] = obj;
            return root;
        }

        Descriptor.prototype._embedData = function (data) {
            if (this.data) {
                var nested;
                if (typeof(this.data) == 'string') {
                    nested = {};
                    nested[this.data] = data;
                }
                else {
                    nested = bury(data, $.extend(true, {}, this.data));
                }
                return nested;
            }
            else {
                return data;
            }
        };

        Descriptor.prototype._extractData = function (data) {
            $log.debug('_extractData', data);
            if (this.data) {
                if (typeof(this.data) == 'string') {
                    return data[this.data];
                }
                else {
                    var keys = Object.keys(this.data);
                    assert(keys.length == 1);
                    var currTheirs = data;
                    var currOurs = this.data;
                    while (typeof(currOurs) != 'string') {
                        console.log(currOurs, currTheirs);
                        keys = Object.keys(currOurs);
                        assert(keys.length == 1);
                        var key = keys[0];
                        currOurs = currOurs[key];
                        currTheirs = currTheirs[key];
                        if (!currTheirs) {
                            break;
                        }
                    }
                    console.log(currOurs, currTheirs);
                    return currTheirs ? currTheirs[currOurs] : null;
                }
            }
            else {
                return data;
            }
        };

        /**
         * Returns this descriptors mapping if the request config matches.
         * @param config
         * @returns {*}
         * @private
         */
        Descriptor.prototype._matchConfig = function (config) {
            var matches = config.type ? this._matchMethod(config.type) : {};
            if (matches) {
                matches = config.url ? this._matchPath(config.url) : {};
            }
            if (matches) {
                $log.trace('matched config');
            }
            return matches;
        };

        Descriptor.prototype._matchData = function (data) {
            var extractedData = null;
            if (this.data) {
                $log.trace('path specified');
                if (data) {
                    extractedData = this._extractData(data);
                }
            }
            else {
                extractedData = data;
            }
            if (extractedData) {
                $log.trace('matched data');
            }
            return extractedData;
        };

        Descriptor.prototype.match = function (config, data) {
            $log.trace('match', {config: config, data:data, descriptor: this});
            var regexMatches = this._matchConfig(config);
            var matches = !!regexMatches;
            var extractedData = false;
            if (matches) {
                $log.trace('config matches');
                extractedData = this._matchData(data);
                matches = !!extractedData;
                if (matches) {
                    for (var key in regexMatches) {
                        if (regexMatches.hasOwnProperty(key)) {
                            extractedData[key] = regexMatches[key];
                        }
                    }
                    $log.trace('data matches');
                }
                else {
                    $log.trace('data doesnt match');
                }
            }
            else {
                $log.trace('config doesnt match');
            }
            return extractedData;
        };

        return Descriptor;
    })

    .factory('RequestDescriptor', function (DescriptorRegistry, Descriptor, jlog, defineSubProperty, Serialiser) {

        var $log = jlog.loggerWithName('RequestDescriptor');

        function RequestDescriptor(opts) {
            if (!this) {
                return new RequestDescriptor(opts);
            }

            Descriptor.call(this, opts);


            if (this._opts.serializer) {
                this._opts.serialiser = this._opts.serializer;
            }

            if (!this._opts.serialiser) {
                this._opts.serialiser = Serialiser.depthSerializer(0);
            }


            defineSubProperty.call(this, 'serialiser', this._opts);
            defineSubProperty.call(this, 'serializer', this._opts, 'serialiser');

        }

        RequestDescriptor.prototype = Object.create(Descriptor.prototype);

        RequestDescriptor.prototype._serialise = function (obj, callback) {
            var self = this;
            $log.trace('_serialise');
            var finished;
            var data = this.serialiser(obj, function (err, data) {
                if (!finished) {
                    if (callback) callback(err, self._embedData(data));
                }
            });
            if (data !== undefined) {
                $log.trace('serialiser doesnt use a callback');
                finished = true;
                if (callback) callback(null, self._embedData(data));
            }
            else {
                $log.trace('serialiser uses a callback', this.serialiser);
            }
        };

        return RequestDescriptor;
    })

    .factory('ResponseDescriptor', function (DescriptorRegistry, Descriptor, jlog) {
        function ResponseDescriptor(opts) {
            if (!this) {
                return new ResponseDescriptor(opts);
            }
            Descriptor.call(this, opts);
        }

        ResponseDescriptor.prototype = Object.create(Descriptor.prototype);
        return ResponseDescriptor;
    })



;