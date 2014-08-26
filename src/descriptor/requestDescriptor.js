angular.module('restkit.descriptor', ['restkit'])

    .factory('DescriptorRegistry', function () {
        function DescriptorRegistry() {
            if (!this) {
                return new DescriptorRegistry(opts);
            }
            this.requestDescriptors = [];
            this.responseDescriptors = [];
        }

        DescriptorRegistry.prototype.registerRequestDescriptor = function (requestDescriptor) {
            this.requestDescriptors.push(requestDescriptor);
        };
        DescriptorRegistry.prototype.registerResponseDescriptor = function (responseDescriptor) {
            this.requestDescriptors.push(responseDescriptor);
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

            // Convert wildcards into methods and ensure is an array of uppercase methods.
            if (this._opts.method) {
                if (this._opts.method == '*' || this._opts.method.indexOf('*') > -1) {
                    this._opts.method = this.httpMethods;
                }
                else if (typeof(this._opts.method) == 'string') {
                    this._opts.method = [this._opts.method];
                }
                this._opts.method = _.map(this._opts.method, function (x) {return x.toUpperCase()});
            }

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
                                throw new RestError('Mapping ' + this._opts.mapping + ' does not exist', {opts: opts});
                            }
                        }
                        else {
                            throw new RestError('Collection ' + this._opts.collection + ' does not exist', {opts: opts});
                        }
                    }
                    else {
                        throw new RestError('Passed mapping as string, but did not specify the collection it belongs to', {opts: opts});
                    }
                }
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

            DescriptorRegistry.registerRequestDescriptor(this);

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
         * @param config http config for $http
         */
        Descriptor.prototype.match = function (config) {
            var matches = config.method ? this._matchMethod(config.method) : true;
            if (matches) {
                matches = config.url ? this._matchPath(config.url) : true;
                if (this.data) {
                    matches = config.data ? !!this._extractData(config.data) : false;
                }
            }
            return matches ? this.mapping : null;
        };

        return Descriptor;
    })

;