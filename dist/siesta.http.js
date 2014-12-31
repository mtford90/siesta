(function e(t, n, r) {
    function s(o, u) {
        if (!n[o]) {
            if (!t[o]) {
                var a = typeof require == "function" && require;
                if (!u && a)return a(o, !0);
                if (i)return i(o, !0);
                var f = new Error("Cannot find module '" + o + "'");
                throw f.code = "MODULE_NOT_FOUND", f
            }
            var l = n[o] = {exports: {}};
            t[o][0].call(l.exports, function (e) {
                var n = t[o][1][e];
                return s(n ? n : e)
            }, l, l.exports, e, t, n, r)
        }
        return n[o].exports
    }

    var i = typeof require == "function" && require;
    for (var o = 0; o < r.length; o++)s(r[o]);
    return s
})({
    1: [function (require, module, exports) {
        /**
         * Descriptors deal with the description of HTTP requests and are used by Siesta to determine what to do
         * with HTTP request/response bodies.
         * @module http
         */

        var _i = siesta._internal,
            log = _i.log,
            InternalSiestaError = _i.error.InternalSiestaError,
            util = _i.util,
            assert = util.assert,
            defineSubProperty = util.defineSubProperty,
            CollectionRegistry = _i.CollectionRegistry,
            extend = _i.extend,
            _ = util._;

        var Logger = log.loggerWithName('Descriptor');
        Logger.setLevel(log.Level.warn);

        var httpMethods = ['POST', 'PATCH', 'PUT', 'HEAD', 'GET', 'DELETE', 'OPTIONS', 'TRACE', 'CONNECT'];

        function resolveMethod(methods) {
            // Convert wildcards into methods and ensure is an array of uppercase methods.
            if (methods) {
                if (methods == '*' || methods.indexOf('*') > -1) {
                    methods = httpMethods;
                } else if (!util.isArray(methods)) {
                    methods = [methods];
                }
            } else {
                methods = ['GET'];
            }
            return _.map(methods, function (x) {
                return x.toUpperCase()
            });
        }

        /**
         * A descriptor 'describes' possible HTTP requests against an API, and is used to decide whether or not to
         * intercept a HTTP request/response and perform a mapping.
         *
         * @constructor
         * @param {Object} opts
         */
        function Descriptor(opts) {
            if (!this) {
                return new Descriptor(opts);
            }

            this._rawOpts = extend(true, {}, opts);
            this._opts = opts;

            var processPath = function (raw) {
                if (!(raw instanceof RegExp)) {
                    raw = new RegExp(raw, 'g');
                }
                return raw;
            }.bind(this);

            if (this._opts.path) {
                var paths = this._opts.path;
                if (!util.isArray(paths)) {
                    paths = [paths];
                }

                this._opts.path = [];

                _.each(paths, function (p) {
                    this._opts.path.push(processPath.call(this, p));
                }.bind(this));
            } else {
                this._opts.path = [''];
            }

            this._opts.method = resolveMethod(this._opts.method);

            // Mappings can be passed as the actual mapping object or as a string (with API specified too)
            if (this._opts.mapping) {
                if (typeof(this._opts.mapping) == 'string') {
                    if (this._opts.collection) {
                        var collection;
                        if (typeof(this._opts.collection) == 'string') {
                            collection = CollectionRegistry[this._opts.collection];
                        } else {
                            collection = this._opts.collection;
                        }
                        if (collection) {
                            var actualMapping = collection[this._opts.mapping];
                            if (actualMapping) {
                                this._opts.mapping = actualMapping;
                            } else {
                                throw new Error('Mapping ' + this._opts.mapping + ' does not exist', {
                                    opts: opts,
                                    descriptor: this
                                });
                            }
                        } else {
                            throw new Error('Collection ' + this._opts.collection + ' does not exist', {
                                opts: opts,
                                descriptor: this
                            });
                        }
                    } else {
                        throw new Error('Passed mapping as string, but did not specify the collection it belongs to', {
                            opts: opts,
                            descriptor: this
                        });
                    }
                }
            } else {
                throw new Error('Descriptors must be initialised with a mapping', {
                    opts: opts,
                    descriptor: this
                });
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
                    } else {
                        var obj = {};
                        root = obj;
                        var previousKey = arr[0];
                        for (var i = 1; i < arr.length; i++) {
                            var key = arr[i];
                            if (i == (arr.length - 1)) {
                                obj[previousKey] = key;
                            } else {
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

            /**
             * @name path
             * @type {String}
             */
            defineSubProperty.call(this, 'path', this._opts);
            defineSubProperty.call(this, 'method', this._opts);
            defineSubProperty.call(this, 'mapping', this._opts);
            defineSubProperty.call(this, 'data', this._opts);
            defineSubProperty.call(this, 'transforms', this._opts);
        }

        _.extend(Descriptor.prototype, {
            httpMethods: httpMethods,
            /**
             * Takes a regex path and returns true if matched
             *
             * @param  {String} path
             * @return {boolean}
             * @internal
             * @example
             * ```js
             * var d = new Descriptor({
     *     path: '/resource/(?P<id>)/'
     * })
             * var matched = d._matchPath('/resource/2');
             * console.log(matched); // {id: '2'}
             * ```
             */
            _matchPath: function (path) {
                var i;
                for (i = 0; i < this._opts.path.length; i++) {
                    var regExp = this._opts.path[i];
                    if (Logger.trace.isEnabled)
                        Logger.trace('Matching path', path, regExp.toString());
                    var matched = regExp.exec(path);
                    if (Logger.trace.isEnabled) {
                        if (matched) {
                            Logger.trace('Matched path successfully', path, regExp.toString());
                        }
                        else {
                            Logger.trace('Failed to match path', path, regExp.toString());
                        }
                    }
                    if (matched) return true;
                }
                return false;
            },

            /**
             * Returns true if the descriptor accepts the HTTP method.
             *
             * @param  {String} method
             * @return {boolean}
             * @internal
             * @example
             * ```js
             * var d = new Descriptor({
     *     method: ['POST', 'PUT']
     * });
             * console.log(d._matchMethod('GET')); // false
             * ```
             */
            _matchMethod: function (method) {
                for (var i = 0; i < this.method.length; i++) {
                    if (method.toUpperCase() == this.method[i]) {
                        return true;
                    }
                }
                return false;
            },
            /**
             * Performs a breadth-first search through data, embedding obj in the first leaf.
             *
             * @param  {Object} obj
             * @param  {Object} data
             * @return {Object}
             */
            bury: function (obj, data) {
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
            },
            _embedData: function (data) {
                if (this.data) {
                    var nested;
                    if (typeof(this.data) == 'string') {
                        nested = {};
                        nested[this.data] = data;
                    } else {
                        nested = this.bury(data, extend(true, {}, this.data));
                    }
                    return nested;
                } else {
                    return data;
                }
            },
            /**
             * If nested data has been specified in the descriptor, extract the data.
             * @param  {Object} data
             * @return {Object}
             */
            _extractData: function (data) {
                if (Logger.debug.isEnabled)
                    Logger.debug('_extractData', data);
                if (this.data) {
                    if (typeof(this.data) == 'string') {
                        return data[this.data];
                    } else {
                        var keys = Object.keys(this.data);
                        assert(keys.length == 1);
                        var currTheirs = data;
                        var currOurs = this.data;
                        while (typeof(currOurs) != 'string') {
                            keys = Object.keys(currOurs);
                            assert(keys.length == 1);
                            var key = keys[0];
                            currOurs = currOurs[key];
                            currTheirs = currTheirs[key];
                            if (!currTheirs) {
                                break;
                            }
                        }
                        return currTheirs ? currTheirs[currOurs] : null;
                    }
                } else {
                    return data;
                }
            },
            /**
             * Returns this descriptors mapping if the request config matches.
             * @param {Object} config
             * @returns {Object}
             */
            _matchConfig: function (config) {
                var matches = config.type ? this._matchMethod(config.type) : {};
                if (matches) {
                    matches = config.url ? this._matchPath(config.url) : {};
                }
                return matches;
            },

            /**
             * Returns data if the data matches, performing any extraction as specified in opts.data
             *
             * @param  {Object} data
             * @return {Object}
             */
            _matchData: function (data) {
                var extractedData = null;
                if (this.data) {
                    if (data) {
                        extractedData = this._extractData(data);
                    }
                } else {
                    extractedData = data;
                }
                return extractedData;
            },
            /**
             * Check if the HTTP config and returned data match this descriptor definition.
             *
             * @param  {Object} config Config object for $.ajax and similar
             * @param  {Object} data
             * @return {Object} Extracted data
             */
            match: function (config, data) {
                var regexMatches = this._matchConfig(config);
                var matches = !!regexMatches;
                var extractedData = false;
                if (matches) {
                    extractedData = this._matchData(data);
                }
                return extractedData;
            },

            /**
             * Apply any transforms.
             * @param  {Object} data Serialised data.
             * @return {Object} Serialised data with applied transformations.
             */
            _transformData: function (data) {
                var transforms = this.transforms;
                if (typeof(transforms) == 'function') {
                    data = transforms(data);
                } else {
                    for (var attr in transforms) {
                        if (transforms.hasOwnProperty(attr)) {
                            if (data[attr]) {
                                var transform = transforms[attr];
                                var val = data[attr];
                                if (typeof(transform) == 'string') {
                                    var split = transform.split('.');
                                    delete data[attr];
                                    if (split.length == 1) {
                                        data[split[0]] = val;
                                    } else {
                                        data[split[0]] = {};
                                        var newVal = data[split[0]];
                                        for (var i = 1; i < split.length - 1; i++) {
                                            var newAttr = split[i];
                                            newVal[newAttr] = {};
                                            newVal = newVal[newAttr];
                                        }
                                        newVal[split[split.length - 1]] = val;
                                    }
                                } else if (typeof(transform) == 'function') {
                                    var transformed = transform(val);
                                    if (util.isArray(transformed)) {
                                        delete data[attr];
                                        data[transformed[0]] = transformed[1];
                                    } else {
                                        data[attr] = transformed;
                                    }
                                } else {
                                    throw new InternalSiestaError('Invalid transformer');
                                }
                            }
                        }
                    }
                }
                return data;
            }
        });

        exports.Descriptor = Descriptor;
        exports.resolveMethod = resolveMethod;
    }, {}], 2: [function (require, module, exports) {
        var _i = siesta._internal,
            util = _i.util,
            assert = util.assert,
            _ = util._,
            log = _i.log;

        var Logger = log.loggerWithName('DescriptorRegistry');
        Logger.setLevel(log.Level.warn);

        /**
         * @class Entry point for descriptor registration.
         * @constructor
         */
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

        console.log('_', _);

        _.extend(DescriptorRegistry.prototype, {
            registerRequestDescriptor: function (requestDescriptor) {
                _registerDescriptor(this.requestDescriptors, requestDescriptor);
            },
            registerResponseDescriptor: function (responseDescriptor) {
                if (Logger.trace.isEnabled)
                    Logger.trace('registerResponseDescriptor');
                _registerDescriptor(this.responseDescriptors, responseDescriptor);
            },
            requestDescriptorsForCollection: function (collection) {
                return _descriptorsForCollection(this.requestDescriptors, collection);
            },
            responseDescriptorsForCollection: function (collection) {
                var descriptorsForCollection = _descriptorsForCollection(this.responseDescriptors, collection);
                if (!descriptorsForCollection.length) {
                    if (Logger.debug.isEnabled)
                        Logger.debug('No response descriptors for collection ', this.responseDescriptors);
                }
                return descriptorsForCollection;
            },
            reset: function () {
                this.requestDescriptors = {};
                this.responseDescriptors = {};
            }
        });

        exports.DescriptorRegistry = new DescriptorRegistry();
    }, {}], 3: [function (require, module, exports) {
        /**
         * Provisions usage of $.ajax and similar functions to send HTTP requests mapping
         * the results back onto the object graph automatically.
         * @module http
         */

        if (typeof siesta == 'undefined' && typeof module == 'undefined') {
            throw new Error('Could not find window.siesta. Make sure you include siesta.core.js first.');
        }

        var _i = siesta._internal,
            Collection = siesta.Collection,
            log = _i.log,
            util = _i.util,
            error = _i.error,
            _ = util._,
            descriptor = require('./descriptor'),
            InternalSiestaError = _i.error.InternalSiestaError;

        var DescriptorRegistry = require('./descriptorRegistry').DescriptorRegistry;


        var Logger = log.loggerWithName('HTTP');
        Logger.setLevel(log.Level.warn);

        /**
         * Log a HTTP response
         * @param opts
         * @param xhr
         * @param [data] - Raw data received in HTTP response.
         */
        function logHttpResponse(opts, xhr, data) {
            if (Logger.debug.isEnabled) {
                var logger = Logger.debug;
                var logMessage = opts.type + ' ' + xhr.status + ' ' + opts.url;
                if (Logger.trace.isEnabled && data) {
                    logger = Logger.trace;
                    logMessage += ': ' + JSON.stringify(data, null, 4);
                }
                logger(logMessage);
            }
        }

        /**
         * Log a HTTP request
         * @param opts
         */
        function logHttpRequest(opts) {
            if (Logger.debug.isEnabled) {
                var logger = Logger.debug;
                // TODO: Append query parameters to the URL.
                var logMessage = opts.type + ' ' + opts.url;
                if (Logger.trace.isEnabled) {
                    // TODO: If any data is being sent, log that.
                    logger = Logger.trace;
                }
                logger(logMessage);
            }
        }


        /**
         * Send a HTTP request to the given method and path parsing the response.
         * @param {String} method
         * @param {String} path The path to the resource we want to GET
         * @param {Object|Function} optsOrCallback Either an options object or a callback if can use defaults
         * @param {Function} callback Callback if opts specified.
         */
        function _httpResponse(method, path, optsOrCallback, callback) {
            var self = this;
            var args = Array.prototype.slice.call(arguments, 2);
            var opts = {};
            var name = this._name;
            if (typeof(args[0]) == 'function') {
                callback = args[0];
            } else if (typeof(args[0]) == 'object') {
                opts = args[0];
                callback = args[1];
            }
            var deferred = window.q ? window.q.defer() : null;
            callback = util.constructCallbackAndPromiseHandler(callback, deferred);
            opts.type = method;
            if (!opts.url) { // Allow overrides.
                var baseURL = this.baseURL;
                opts.url = baseURL + path;
            }
            if (opts.parseResponse === undefined) opts.parseResponse = true;
            opts.success = function (data, status, xhr) {
                logHttpResponse(opts, xhr, data);
                var resp = {
                    data: data,
                    status: status,
                    xhr: xhr
                };
                if (opts.parseResponse) {
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
                        if (Logger.trace.isEnabled) {
                            Logger.trace('Mapping extracted data: ' + JSON.stringify(extractedData, null, 4));
                        }
                        if (typeof(extractedData) == 'object') {
                            var mapping = matchedDescriptor.mapping;
                            mapping.map(extractedData, function (err, obj) {
                                if (callback) {

                                    callback(err, obj, resp);
                                }
                            }, opts.obj);
                        } else { // Matched, but no data.
                            callback(null, true, resp);
                        }
                    } else if (callback) {
                        if (name) {
                            var err = {};
                            var code = error.ErrorCode.NoDescriptorMatched;
                            err[error.ErrorField.Code] = code;
                            err[error.ErrorField.Message] = error.Message[code];
                            callback(err, null, resp);
                        } else {
                            // There was a bug where collection name doesn't exist. If this occurs, then will never get hold of any descriptors.
                            throw new InternalSiestaError('Unnamed collection');
                        }
                    }
                } else {
                    callback(null, null, resp);
                }

            };
            opts.error = function (xhr, status, error) {
                var resp = {
                    xhr: xhr,
                    status: status,
                    error: error
                };
                if (callback) callback(resp, null, resp);
            };
            logHttpRequest(opts);
            siesta.ext.http.ajax(opts);
        }

        function _serialiseObject(opts, obj, cb) {
            this._serialise(obj, function (err, data) {
                var retData = data;
                if (opts.fields) {
                    retData = {};
                    _.each(opts.fields, function (f) {
                        retData[f] = data[f];
                    });
                }
                cb(err, retData);
            });
        }

        /**
         * Send a HTTP request to the given method and path
         * @param {String} method
         * @param {String} path The path to the resource we want to GET
         * @param {SiestaModel} object The model we're pushing to the server
         * @param {Object|Function} optsOrCallback Either an options object or a callback if can use defaults
         * @param {Function} callback Callback if opts specified.
         */
        function _httpRequest(method, path, object) {
            var self = this;
            var args = Array.prototype.slice.call(arguments, 3);
            var callback;
            var opts = {};
            if (typeof(args[0]) == 'function') {
                callback = args[0];
            } else if (typeof(args[0]) == 'object') {
                opts = args[0];
                callback = args[1];
            }
            var deferred = window.q ? window.q.defer() : null;
            callback = util.constructCallbackAndPromiseHandler(callback, deferred);
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
                if (Logger.trace.isEnabled)
                    Logger.trace('Matched descriptor: ' + matchedDescriptor._dump(true));
                _serialiseObject.call(matchedDescriptor, object, opts, function (err, data) {
                    if (Logger.trace.isEnabled)
                        Logger.trace('_serialise', {
                            err: err,
                            data: data
                        });
                    if (err) {
                        if (callback) callback(err, null, null);
                    } else {
                        opts.data = data;
                        opts.obj = object;
                        _.partial(_httpResponse, method, path, opts, callback).apply(self, args);
                    }
                });

            } else if (callback) {
                if (Logger.trace.isEnabled)
                    Logger.trace('Did not match descriptor');
                callback('No descriptor matched', null, null);
            }
            return deferred ? deferred.promise : null;
        }

        /**
         * Send a DELETE request. Also removes the object.
         * @param {Collection} collection
         * @param {String} path The path to the resource to which we want to DELETE
         * @param {SiestaModel} object The model that we would like to PATCH
         * @returns {Promise}
         */
        function DELETE(collection, path, object) {
            var deferred = window.q ? window.q.defer() : null;
            var args = Array.prototype.slice.call(arguments, 3);
            var opts = {};
            var callback;
            if (typeof(args[0]) == 'function') {
                callback = args[0];
            } else if (typeof(args[0]) == 'object') {
                opts = args[0];
                callback = args[1];
            }
            callback = util.constructCallbackAndPromiseHandler(callback, deferred);
            var deletionMode = opts.deletionMode || 'restore';
            // By default we do not map the response from a DELETE request.
            if (opts.parseResponse === undefined) opts.parseResponse = false;
            _httpResponse.call(collection, 'DELETE', path, opts, function (err, x, y, z) {
                if (err) {
                    if (deletionMode == 'restore') {
                        object.restore();
                    }
                } else if (deletionMode == 'success') {
                    object.remove();
                }
                callback(err, x, y, z);
            });
            if (deletionMode == 'now' || deletionMode == 'restore') {
                object.remove();
            }
            return deferred ? deferred.promise : null;
        }

        /**
         * Send a HTTP request using the given method
         * @param {Collection} collection
         * @param request Does the request contain data? e.g. POST/PATCH/PUT will be true, GET will false
         * @param method
         * @internal
         * @returns {Promise}
         */
        function HTTP_METHOD(collection, request, method) {
            var args = Array.prototype.slice.call(arguments, 3);
            return _.partial(request ? _httpRequest : _httpResponse, method).apply(collection, args);
        }

        /**
         * Send a GET request
         * @param {Collection} collection
         * @param {String} path The path to the resource we want to GET
         * @param {Object|Function} optsOrCallback Either an options object or a callback if can use defaults
         * @param {Function} callback Callback if opts specified.
         * @package HTTP
         * @returns {Promise}
         */
        function GET(collection) {
            var args = Array.prototype.slice.call(arguments, 1);
            return _.partial(HTTP_METHOD, collection, false, 'GET').apply(this, args);
        }

        /**
         * Send an OPTIONS request
         * @param {Collection} collection
         * @param {String} path The path to the resource we want to GET
         * @param {Object|Function} optsOrCallback Either an options object or a callback if can use defaults
         * @param {Function} callback Callback if opts specified.
         * @package HTTP
         * @returns {Promise}
         */
        function OPTIONS(collection) {
            var args = Array.prototype.slice.call(arguments, 1);
            return _.partial(HTTP_METHOD, collection, false, 'OPTIONS').apply(this, args);
        }

        /**
         * Send an TRACE request
         * @param {Collection} collection
         * @param {String} path The path to the resource we want to GET
         * @param {Object|Function} optsOrCallback Either an options object or a callback if can use defaults
         * @param {Function} callback Callback if opts specified.
         * @package HTTP
         * @returns {Promise}
         */
        function TRACE(collection) {
            var args = Array.prototype.slice.call(arguments, 1);
            return _.partial(HTTP_METHOD, collection, false, 'TRACE').apply(this, args);
        }

        /**
         * Send an HEAD request
         * @param {Collection} collection
         * @param {String} path The path to the resource we want to GET
         * @param {Object|Function} optsOrCallback Either an options object or a callback if can use defaults
         * @param {Function} callback Callback if opts specified.
         * @package HTTP
         * @returns {Promise}
         */
        function HEAD(collection) {
            var args = Array.prototype.slice.call(arguments, 1);
            return _.partial(HTTP_METHOD, collection, false, 'HEAD').apply(this, args);
        }

        /**
         * Send an POST request
         * @param {Collection} collection
         * @param {String} path The path to the resource we want to GET
         * @param {SiestaModel} model The model that we would like to POST
         * @param {Object|Function} optsOrCallback Either an options object or a callback if can use defaults
         * @param {Function} callback Callback if opts specified.
         * @package HTTP
         * @returns {Promise}
         */
        function POST(collection) {
            var args = Array.prototype.slice.call(arguments, 1);
            return _.partial(HTTP_METHOD, collection, true, 'POST').apply(this, args);
        }

        /**
         * Send an PUT request
         * @param {Collection} collection
         * @param {String} path The path to the resource we want to GET
         * @param {SiestaModel} model The model that we would like to POST
         * @param {Object|Function} optsOrCallback Either an options object or a callback if can use defaults
         * @param {Function} callback Callback if opts specified.
         * @package HTTP
         * @returns {Promise}
         */
        function PUT(collection) {
            var args = Array.prototype.slice.call(arguments, 1);
            return _.partial(HTTP_METHOD, collection, true, 'PUT').apply(this, args);
        }

        /**
         * Send an PATCH request
         * @param {Collection} collection
         * @param {String} path The path to the resource we want to GET
         * @param {SiestaModel} model The model that we would like to POST
         * @param {Object|Function} optsOrCallback Either an options object or a callback if can use defaults
         * @param {Function} callback Callback if opts specified.
         * @package HTTP
         * @returns {Promise}
         */
        function PATCH(collection) {
            var args = Array.prototype.slice.call(arguments, 1);
            return _.partial(HTTP_METHOD, collection, true, 'PATCH').apply(this, args);
        }


        var ajax;


        var http = {
            RequestDescriptor: require('./requestDescriptor').RequestDescriptor,
            ResponseDescriptor: require('./responseDescriptor').ResponseDescriptor,
            Descriptor: descriptor.Descriptor,
            _resolveMethod: descriptor.resolveMethod,
            Serialiser: require('./serialiser'),
            DescriptorRegistry: require('./descriptorRegistry').DescriptorRegistry,
            setAjax: function (_ajax) {
                ajax = _ajax;
            },
            _httpResponse: _httpResponse,
            _httpRequest: _httpRequest,
            DELETE: DELETE,
            HTTP_METHOD: HTTP_METHOD,
            GET: GET,
            TRACE: TRACE,
            OPTIONS: OPTIONS,
            HEAD: HEAD,
            POST: POST,
            PUT: PUT,
            PATCH: PATCH,
            _serialiseObject: _serialiseObject
        };

        Object.defineProperty(http, 'ajax', {
            get: function () {
                var a = ajax || ($ ? $.ajax : null) || (jQuery ? jQuery.ajax : null);
                if (!a) {
                    throw new InternalSiestaError('ajax has not been defined and could not find $.ajax or jQuery.ajax');
                }
                return a;
            },
            set: function (v) {
                ajax = v;
            }
        });

        if (typeof siesta != 'undefined') {
            if (!siesta.ext) {
                siesta.ext = {};
            }
            siesta.ext.http = http;
        }

        if (typeof module != 'undefined') {
            module.exports = http;
        }
    }, {
        "./descriptor": 1,
        "./descriptorRegistry": 2,
        "./requestDescriptor": 4,
        "./responseDescriptor": 5,
        "./serialiser": 6
    }], 4: [function (require, module, exports) {
        /**
         * @module http
         */

        var Descriptor = require('./descriptor').Descriptor
            , Serialiser = require('./serialiser');

        var _i = siesta._internal
            , util = _i.util
            , _ = util._
            , log = _i.log
            , defineSubProperty = util.defineSubProperty
            ;

        var Logger = log.loggerWithName('RequestDescriptor');
        Logger.setLevel(log.Level.warn);

        /**
         * @class Describes a HTTP request
         * @param {Object} opts
         */
        function RequestDescriptor(opts) {
            if (!this) {
                return new RequestDescriptor(opts);
            }

            Descriptor.call(this, opts);
            if (this._opts['serializer']) {
                this._opts.serialiser = this._opts['serializer'];
            }

            if (!this._opts.serialiser) {
                this._opts.serialiser = Serialiser.depthSerializer(0);
            }


            defineSubProperty.call(this, 'serialiser', this._opts);
            defineSubProperty.call(this, 'serializer', this._opts, 'serialiser');

        }

        RequestDescriptor.prototype = Object.create(Descriptor.prototype);

        _.extend(RequestDescriptor.prototype, {
            _serialise: function (obj, callback) {
                var deferred = window.q ? window.q.defer() : null;
                callback = util.constructCallbackAndPromiseHandler(callback, deferred);
                var self = this;
                if (Logger.trace.isEnabled)
                    Logger.trace('_serialise');
                var finished;
                var data = this.serialiser(obj, function (err, data) {
                    if (!finished) {
                        data = self._transformData(data);
                        if (callback) callback(err, self._embedData(data));
                    }
                });
                if (data !== undefined) {
                    if (Logger.trace.isEnabled)
                        Logger.trace('serialiser doesnt use a callback');
                    finished = true;
                    data = self._transformData(data);
                    if (callback) callback(null, self._embedData(data));
                }
                else {
                    if (Logger.trace.isEnabled)
                        Logger.trace('serialiser uses a callback', this.serialiser);
                }
                return deferred ? deferred.promise : null;
            },
            _dump: function (asJson) {
                var obj = {};
                obj.methods = this.method;
                obj.mapping = this.mapping.type;
                obj.path = this._rawOpts.path;
                var serialiser;
                if (typeof(this._rawOpts.serialiser) == 'function') {
                    serialiser = 'function () { ... }'
                }
                else {
                    serialiser = this._rawOpts.serialiser;
                }
                obj.serialiser = serialiser;
                var transforms = {};
                for (var f in this.transforms) {
                    if (this.transforms.hasOwnProperty(f)) {
                        var transform = this.transforms[f];
                        if (typeof(transform) == 'function') {
                            transforms[f] = 'function () { ... }'
                        }
                        else {
                            transforms[f] = this.transforms[f];
                        }
                    }
                }
                obj.transforms = transforms;
                return asJson ? JSON.stringify(obj, null, 4) : obj;
            }
        });

        exports.RequestDescriptor = RequestDescriptor;

    }, {"./descriptor": 1, "./serialiser": 6}], 5: [function (require, module, exports) {
        /**
         * @module http
         */


        var Descriptor = require('./descriptor').Descriptor;

        /**
         * Describes what to do with a HTTP response.
         * @constructor
         * @implements {Descriptor}
         * @param {Object} opts
         */
        function ResponseDescriptor(opts) {
            if (!this) {
                return new ResponseDescriptor(opts);
            }
            Descriptor.call(this, opts);
        }

        ResponseDescriptor.prototype = Object.create(Descriptor.prototype);

        _.extend(ResponseDescriptor.prototype, {
            _extractData: function (data) {
                var extractedData = Descriptor.prototype._extractData.call(this, data);
                if (extractedData) {
                    extractedData = this._transformData(extractedData);
                }
                return extractedData;
            },
            _matchData: function (data) {
                var extractedData = Descriptor.prototype._matchData.call(this, data);
                if (extractedData) {
                    extractedData = this._transformData(extractedData);
                }
                return extractedData;
            },
            _dump: function (asJson) {
                var obj = {};
                obj.methods = this.method;
                obj.mapping = this.mapping.type;
                obj.path = this._rawOpts.path;
                var transforms = {};
                for (var f in this.transforms) {
                    if (this.transforms.hasOwnProperty(f)) {
                        var transform = this.transforms[f];
                        if (typeof(transform) == 'function') {
                            transforms[f] = 'function () { ... }'
                        }
                        else {
                            transforms[f] = this.transforms[f];
                        }
                    }
                }
                obj.transforms = transforms;
                return asJson ? JSON.stringify(obj, null, 4) : obj;
            }
        });

        exports.ResponseDescriptor = ResponseDescriptor;
    }, {"./descriptor": 1}], 6: [function (require, module, exports) {
        /**
         * @module http
         */

        var _i = siesta._internal;

        var log = _i.log
            , utils = _i.util;
        var Logger = log.loggerWithName('Serialiser');
        Logger.setLevel(log.Level.warn);
        var _ = utils._;

        /**
         * Serialises an object into it's remote identifier (as defined by the mapping)
         * @param  {SiestaModel} obj
         * @return {String}
         *
         */
        function idSerialiser(obj) {
            var idField = obj.mapping.id;
            if (idField) {
                return obj[idField] ? obj[idField] : null;
            }
            else {
                if (Logger.debug.isEnabled)
                    Logger.debug('No idfield');
                return undefined;
            }
        }

        /**
         * Serialises obj following relationships to specified depth.
         * @param  {Integer}   depth
         * @param  {SiestaModel}   obj
         * @param  {Function} done
         */
        function depthSerialiser(depth, obj, done) {
            if (Logger.trace.isEnabled)
                Logger.trace('depthSerialiser');
            var data = {};
            _.each(obj._fields, function (f) {
                if (Logger.trace.isEnabled)
                    Logger.trace('field', f);
                if (obj[f]) {
                    data[f] = obj[f];
                }
            });
            var waiting = [];
            var errors = [];
            var result = {};
            var finished = [];
            _.each(obj._relationshipFields, function (f) {
                if (Logger.trace.isEnabled)
                    Logger.trace('relationshipField', f);
                var proxy = obj.__proxies[f];
                if (proxy.isForward) { // By default only forward relationship.
                    if (Logger.debug.isEnabled)
                        Logger.debug(f);
                    waiting.push(f);
                    proxy.get(function (err, v) {
                        if (Logger.trace.isEnabled)
                            Logger.trace('proxy.get', f);
                        if (Logger.debug.isEnabled)
                            Logger.debug(f, v);
                        if (err) {
                            errors.push(err);
                            finished.push(f);
                            result[f] = {err: err, v: v};
                        }
                        else if (v) {
                            if (!depth) {
                                finished.push(f);
                                data[f] = v[obj.__proxies[f].forwardMapping.id];
                                result[f] = {err: err, v: v};
                                if ((waiting.length == finished.length) && done) {
                                    done(errors.length ? errors : null, data, result);
                                }
                            }
                            else {
                                depthSerialiser(depth - 1, v, function (err, subData, resp) {
                                    if (err) {
                                        errors.push(err);
                                    }
                                    else {
                                        data[f] = subData;
                                    }
                                    finished.push(f);
                                    result[f] = {err: err, v: v, resp: resp};
                                    if ((waiting.length == finished.length) && done) {
                                        done(errors.length ? errors : null, data, result);
                                    }
                                });
                            }
                        }
                        else {
                            if (Logger.debug.isEnabled)
                                Logger.debug('no value for ' + f);
                            finished.push(f);
                            result[f] = {err: err, v: v};
                            if ((waiting.length == finished.length) && done) {
                                done(errors.length ? errors : null, data, result);
                            }
                        }
                    });
                }
            });
            if (!waiting.length) {
                if (done) done(null, data, {});
            }
        }


        exports.depthSerialiser = function (depth) {
            return _.partial(depthSerialiser, depth);
        };
        exports.depthSerializer = function (depth) {
            return _.partial(depthSerialiser, depth);
        };
        exports.idSerializer = idSerialiser;
        exports.idSerialiser = idSerialiser;


    }, {}]
}, {}, [3])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9odHRwL2Rlc2NyaXB0b3IuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9odHRwL2Rlc2NyaXB0b3JSZWdpc3RyeS5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2h0dHAvaW5kZXguanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9odHRwL3JlcXVlc3REZXNjcmlwdG9yLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3QvaHR0cC9yZXNwb25zZURlc2NyaXB0b3IuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9odHRwL3NlcmlhbGlzZXIuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL1hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxYUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLyoqXG4gKiBEZXNjcmlwdG9ycyBkZWFsIHdpdGggdGhlIGRlc2NyaXB0aW9uIG9mIEhUVFAgcmVxdWVzdHMgYW5kIGFyZSB1c2VkIGJ5IFNpZXN0YSB0byBkZXRlcm1pbmUgd2hhdCB0byBkb1xuICogd2l0aCBIVFRQIHJlcXVlc3QvcmVzcG9uc2UgYm9kaWVzLlxuICogQG1vZHVsZSBodHRwXG4gKi9cblxudmFyIF9pID0gc2llc3RhLl9pbnRlcm5hbCxcbiAgICBsb2cgPSBfaS5sb2csXG4gICAgSW50ZXJuYWxTaWVzdGFFcnJvciA9IF9pLmVycm9yLkludGVybmFsU2llc3RhRXJyb3IsXG4gICAgdXRpbCA9IF9pLnV0aWwsXG4gICAgYXNzZXJ0ID0gdXRpbC5hc3NlcnQsXG4gICAgZGVmaW5lU3ViUHJvcGVydHkgPSB1dGlsLmRlZmluZVN1YlByb3BlcnR5LFxuICAgIENvbGxlY3Rpb25SZWdpc3RyeSA9IF9pLkNvbGxlY3Rpb25SZWdpc3RyeSxcbiAgICBleHRlbmQgPSBfaS5leHRlbmQsXG4gICAgXyA9IHV0aWwuXztcblxudmFyIExvZ2dlciA9IGxvZy5sb2dnZXJXaXRoTmFtZSgnRGVzY3JpcHRvcicpO1xuTG9nZ2VyLnNldExldmVsKGxvZy5MZXZlbC53YXJuKTtcblxudmFyIGh0dHBNZXRob2RzID0gWydQT1NUJywgJ1BBVENIJywgJ1BVVCcsICdIRUFEJywgJ0dFVCcsICdERUxFVEUnLCAnT1BUSU9OUycsICdUUkFDRScsICdDT05ORUNUJ107XG5cbmZ1bmN0aW9uIHJlc29sdmVNZXRob2QobWV0aG9kcykge1xuICAgIC8vIENvbnZlcnQgd2lsZGNhcmRzIGludG8gbWV0aG9kcyBhbmQgZW5zdXJlIGlzIGFuIGFycmF5IG9mIHVwcGVyY2FzZSBtZXRob2RzLlxuICAgIGlmIChtZXRob2RzKSB7XG4gICAgICAgIGlmIChtZXRob2RzID09ICcqJyB8fCBtZXRob2RzLmluZGV4T2YoJyonKSA+IC0xKSB7XG4gICAgICAgICAgICBtZXRob2RzID0gaHR0cE1ldGhvZHM7XG4gICAgICAgIH0gZWxzZSBpZiAoIXV0aWwuaXNBcnJheShtZXRob2RzKSkge1xuICAgICAgICAgICAgbWV0aG9kcyA9IFttZXRob2RzXTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIG1ldGhvZHMgPSBbJ0dFVCddO1xuICAgIH1cbiAgICByZXR1cm4gXy5tYXAobWV0aG9kcywgZnVuY3Rpb24gKHgpIHtcbiAgICAgICAgcmV0dXJuIHgudG9VcHBlckNhc2UoKVxuICAgIH0pO1xufVxuXG4vKipcbiAqIEEgZGVzY3JpcHRvciAnZGVzY3JpYmVzJyBwb3NzaWJsZSBIVFRQIHJlcXVlc3RzIGFnYWluc3QgYW4gQVBJLCBhbmQgaXMgdXNlZCB0byBkZWNpZGUgd2hldGhlciBvciBub3QgdG9cbiAqIGludGVyY2VwdCBhIEhUVFAgcmVxdWVzdC9yZXNwb25zZSBhbmQgcGVyZm9ybSBhIG1hcHBpbmcuXG4gKlxuICogQGNvbnN0cnVjdG9yXG4gKiBAcGFyYW0ge09iamVjdH0gb3B0c1xuICovXG5mdW5jdGlvbiBEZXNjcmlwdG9yKG9wdHMpIHtcbiAgICBpZiAoIXRoaXMpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBEZXNjcmlwdG9yKG9wdHMpO1xuICAgIH1cblxuICAgIHRoaXMuX3Jhd09wdHMgPSBleHRlbmQodHJ1ZSwge30sIG9wdHMpO1xuICAgIHRoaXMuX29wdHMgPSBvcHRzO1xuXG4gICAgdmFyIHByb2Nlc3NQYXRoID0gZnVuY3Rpb24gKHJhdykge1xuICAgICAgICBpZiAoIShyYXcgaW5zdGFuY2VvZiBSZWdFeHApKSB7XG4gICAgICAgICAgICByYXcgPSBuZXcgUmVnRXhwKHJhdywgJ2cnKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmF3O1xuICAgIH0uYmluZCh0aGlzKTtcblxuICAgIGlmICh0aGlzLl9vcHRzLnBhdGgpIHtcbiAgICAgICAgdmFyIHBhdGhzID0gdGhpcy5fb3B0cy5wYXRoO1xuICAgICAgICBpZiAoIXV0aWwuaXNBcnJheShwYXRocykpIHtcbiAgICAgICAgICAgIHBhdGhzID0gW3BhdGhzXTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX29wdHMucGF0aCA9IFtdO1xuXG4gICAgICAgIF8uZWFjaChwYXRocywgZnVuY3Rpb24gKHApIHtcbiAgICAgICAgICAgIHRoaXMuX29wdHMucGF0aC5wdXNoKHByb2Nlc3NQYXRoLmNhbGwodGhpcywgcCkpO1xuICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuX29wdHMucGF0aCA9IFsnJ107XG4gICAgfVxuXG4gICAgdGhpcy5fb3B0cy5tZXRob2QgPSByZXNvbHZlTWV0aG9kKHRoaXMuX29wdHMubWV0aG9kKTtcblxuICAgIC8vIE1hcHBpbmdzIGNhbiBiZSBwYXNzZWQgYXMgdGhlIGFjdHVhbCBtYXBwaW5nIG9iamVjdCBvciBhcyBhIHN0cmluZyAod2l0aCBBUEkgc3BlY2lmaWVkIHRvbylcbiAgICBpZiAodGhpcy5fb3B0cy5tYXBwaW5nKSB7XG4gICAgICAgIGlmICh0eXBlb2YodGhpcy5fb3B0cy5tYXBwaW5nKSA9PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgaWYgKHRoaXMuX29wdHMuY29sbGVjdGlvbikge1xuICAgICAgICAgICAgICAgIHZhciBjb2xsZWN0aW9uO1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YodGhpcy5fb3B0cy5jb2xsZWN0aW9uKSA9PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgICAgICBjb2xsZWN0aW9uID0gQ29sbGVjdGlvblJlZ2lzdHJ5W3RoaXMuX29wdHMuY29sbGVjdGlvbl07XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgY29sbGVjdGlvbiA9IHRoaXMuX29wdHMuY29sbGVjdGlvbjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKGNvbGxlY3Rpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGFjdHVhbE1hcHBpbmcgPSBjb2xsZWN0aW9uW3RoaXMuX29wdHMubWFwcGluZ107XG4gICAgICAgICAgICAgICAgICAgIGlmIChhY3R1YWxNYXBwaW5nKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9vcHRzLm1hcHBpbmcgPSBhY3R1YWxNYXBwaW5nO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdNYXBwaW5nICcgKyB0aGlzLl9vcHRzLm1hcHBpbmcgKyAnIGRvZXMgbm90IGV4aXN0Jywge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9wdHM6IG9wdHMsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRvcjogdGhpc1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0NvbGxlY3Rpb24gJyArIHRoaXMuX29wdHMuY29sbGVjdGlvbiArICcgZG9lcyBub3QgZXhpc3QnLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICBvcHRzOiBvcHRzLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRvcjogdGhpc1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignUGFzc2VkIG1hcHBpbmcgYXMgc3RyaW5nLCBidXQgZGlkIG5vdCBzcGVjaWZ5IHRoZSBjb2xsZWN0aW9uIGl0IGJlbG9uZ3MgdG8nLCB7XG4gICAgICAgICAgICAgICAgICAgIG9wdHM6IG9wdHMsXG4gICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0b3I6IHRoaXNcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignRGVzY3JpcHRvcnMgbXVzdCBiZSBpbml0aWFsaXNlZCB3aXRoIGEgbWFwcGluZycsIHtcbiAgICAgICAgICAgIG9wdHM6IG9wdHMsXG4gICAgICAgICAgICBkZXNjcmlwdG9yOiB0aGlzXG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIElmIGtleSBwYXRoLCBjb252ZXJ0IGRhdGEga2V5IHBhdGggaW50byBhbiBvYmplY3QgdGhhdCB3ZSBjYW4gdGhlbiB1c2UgdG8gdHJhdmVyc2UgdGhlIEhUVFAgYm9kaWVzLlxuICAgIC8vIG90aGVyd2lzZSBsZWF2ZSBhcyBzdHJpbmcgb3IgdW5kZWZpbmVkLlxuICAgIHZhciBkYXRhID0gdGhpcy5fb3B0cy5kYXRhO1xuICAgIGlmIChkYXRhKSB7XG4gICAgICAgIGlmIChkYXRhLmxlbmd0aCkge1xuICAgICAgICAgICAgdmFyIHJvb3Q7XG4gICAgICAgICAgICB2YXIgYXJyID0gZGF0YS5zcGxpdCgnLicpO1xuICAgICAgICAgICAgaWYgKGFyci5sZW5ndGggPT0gMSkge1xuICAgICAgICAgICAgICAgIHJvb3QgPSBhcnJbMF07XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHZhciBvYmogPSB7fTtcbiAgICAgICAgICAgICAgICByb290ID0gb2JqO1xuICAgICAgICAgICAgICAgIHZhciBwcmV2aW91c0tleSA9IGFyclswXTtcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMTsgaSA8IGFyci5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICB2YXIga2V5ID0gYXJyW2ldO1xuICAgICAgICAgICAgICAgICAgICBpZiAoaSA9PSAoYXJyLmxlbmd0aCAtIDEpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBvYmpbcHJldmlvdXNLZXldID0ga2V5O1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG5ld1ZhciA9IHt9O1xuICAgICAgICAgICAgICAgICAgICAgICAgb2JqW3ByZXZpb3VzS2V5XSA9IG5ld1ZhcjtcbiAgICAgICAgICAgICAgICAgICAgICAgIG9iaiA9IG5ld1ZhcjtcbiAgICAgICAgICAgICAgICAgICAgICAgIHByZXZpb3VzS2V5ID0ga2V5O1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5fb3B0cy5kYXRhID0gcm9vdDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBuYW1lIHBhdGhcbiAgICAgKiBAdHlwZSB7U3RyaW5nfVxuICAgICAqL1xuICAgIGRlZmluZVN1YlByb3BlcnR5LmNhbGwodGhpcywgJ3BhdGgnLCB0aGlzLl9vcHRzKTtcbiAgICBkZWZpbmVTdWJQcm9wZXJ0eS5jYWxsKHRoaXMsICdtZXRob2QnLCB0aGlzLl9vcHRzKTtcbiAgICBkZWZpbmVTdWJQcm9wZXJ0eS5jYWxsKHRoaXMsICdtYXBwaW5nJywgdGhpcy5fb3B0cyk7XG4gICAgZGVmaW5lU3ViUHJvcGVydHkuY2FsbCh0aGlzLCAnZGF0YScsIHRoaXMuX29wdHMpO1xuICAgIGRlZmluZVN1YlByb3BlcnR5LmNhbGwodGhpcywgJ3RyYW5zZm9ybXMnLCB0aGlzLl9vcHRzKTtcbn1cblxuXy5leHRlbmQoRGVzY3JpcHRvci5wcm90b3R5cGUsIHtcbiAgICBodHRwTWV0aG9kczogaHR0cE1ldGhvZHMsXG4gICAgLyoqXG4gICAgICogVGFrZXMgYSByZWdleCBwYXRoIGFuZCByZXR1cm5zIHRydWUgaWYgbWF0Y2hlZFxuICAgICAqXG4gICAgICogQHBhcmFtICB7U3RyaW5nfSBwYXRoXG4gICAgICogQHJldHVybiB7Ym9vbGVhbn1cbiAgICAgKiBAaW50ZXJuYWxcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGBgYGpzXG4gICAgICogdmFyIGQgPSBuZXcgRGVzY3JpcHRvcih7XG4gICAgICogICAgIHBhdGg6ICcvcmVzb3VyY2UvKD9QPGlkPikvJ1xuICAgICAqIH0pXG4gICAgICogdmFyIG1hdGNoZWQgPSBkLl9tYXRjaFBhdGgoJy9yZXNvdXJjZS8yJyk7XG4gICAgICogY29uc29sZS5sb2cobWF0Y2hlZCk7IC8vIHtpZDogJzInfVxuICAgICAqIGBgYFxuICAgICAqL1xuICAgIF9tYXRjaFBhdGg6IGZ1bmN0aW9uIChwYXRoKSB7XG4gICAgICAgIHZhciBpO1xuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgdGhpcy5fb3B0cy5wYXRoLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB2YXIgcmVnRXhwID0gdGhpcy5fb3B0cy5wYXRoW2ldO1xuICAgICAgICAgICAgaWYgKExvZ2dlci50cmFjZS5pc0VuYWJsZWQpXG4gICAgICAgICAgICAgICAgTG9nZ2VyLnRyYWNlKCdNYXRjaGluZyBwYXRoJywgcGF0aCwgcmVnRXhwLnRvU3RyaW5nKCkpO1xuICAgICAgICAgICAgdmFyIG1hdGNoZWQgPSByZWdFeHAuZXhlYyhwYXRoKTtcbiAgICAgICAgICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgaWYgKG1hdGNoZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgTG9nZ2VyLnRyYWNlKCdNYXRjaGVkIHBhdGggc3VjY2Vzc2Z1bGx5JywgcGF0aCwgcmVnRXhwLnRvU3RyaW5nKCkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgTG9nZ2VyLnRyYWNlKCdGYWlsZWQgdG8gbWF0Y2ggcGF0aCcsIHBhdGgsIHJlZ0V4cC50b1N0cmluZygpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAobWF0Y2hlZCkgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRydWUgaWYgdGhlIGRlc2NyaXB0b3IgYWNjZXB0cyB0aGUgSFRUUCBtZXRob2QuXG4gICAgICpcbiAgICAgKiBAcGFyYW0gIHtTdHJpbmd9IG1ldGhvZFxuICAgICAqIEByZXR1cm4ge2Jvb2xlYW59XG4gICAgICogQGludGVybmFsXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBgYGBqc1xuICAgICAqIHZhciBkID0gbmV3IERlc2NyaXB0b3Ioe1xuICAgICAqICAgICBtZXRob2Q6IFsnUE9TVCcsICdQVVQnXVxuICAgICAqIH0pO1xuICAgICAqIGNvbnNvbGUubG9nKGQuX21hdGNoTWV0aG9kKCdHRVQnKSk7IC8vIGZhbHNlXG4gICAgICogYGBgXG4gICAgICovXG4gICAgX21hdGNoTWV0aG9kOiBmdW5jdGlvbiAobWV0aG9kKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5tZXRob2QubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmIChtZXRob2QudG9VcHBlckNhc2UoKSA9PSB0aGlzLm1ldGhvZFtpXSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIFBlcmZvcm1zIGEgYnJlYWR0aC1maXJzdCBzZWFyY2ggdGhyb3VnaCBkYXRhLCBlbWJlZGRpbmcgb2JqIGluIHRoZSBmaXJzdCBsZWFmLlxuICAgICAqXG4gICAgICogQHBhcmFtICB7T2JqZWN0fSBvYmpcbiAgICAgKiBAcGFyYW0gIHtPYmplY3R9IGRhdGFcbiAgICAgKiBAcmV0dXJuIHtPYmplY3R9XG4gICAgICovXG4gICAgYnVyeTogZnVuY3Rpb24gKG9iaiwgZGF0YSkge1xuICAgICAgICB2YXIgcm9vdCA9IGRhdGE7XG4gICAgICAgIHZhciBrZXlzID0gT2JqZWN0LmtleXMoZGF0YSk7XG4gICAgICAgIGFzc2VydChrZXlzLmxlbmd0aCA9PSAxKTtcbiAgICAgICAgdmFyIGtleSA9IGtleXNbMF07XG4gICAgICAgIHZhciBjdXJyID0gZGF0YTtcbiAgICAgICAgd2hpbGUgKCEodHlwZW9mKGN1cnJba2V5XSkgPT0gJ3N0cmluZycpKSB7XG4gICAgICAgICAgICBjdXJyID0gY3VycltrZXldO1xuICAgICAgICAgICAga2V5cyA9IE9iamVjdC5rZXlzKGN1cnIpO1xuICAgICAgICAgICAgYXNzZXJ0KGtleXMubGVuZ3RoID09IDEpO1xuICAgICAgICAgICAga2V5ID0ga2V5c1swXTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgbmV3UGFyZW50ID0gY3VycltrZXldO1xuICAgICAgICB2YXIgbmV3T2JqID0ge307XG4gICAgICAgIGN1cnJba2V5XSA9IG5ld09iajtcbiAgICAgICAgbmV3T2JqW25ld1BhcmVudF0gPSBvYmo7XG4gICAgICAgIHJldHVybiByb290O1xuICAgIH0sXG4gICAgX2VtYmVkRGF0YTogZnVuY3Rpb24gKGRhdGEpIHtcbiAgICAgICAgaWYgKHRoaXMuZGF0YSkge1xuICAgICAgICAgICAgdmFyIG5lc3RlZDtcbiAgICAgICAgICAgIGlmICh0eXBlb2YodGhpcy5kYXRhKSA9PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgIG5lc3RlZCA9IHt9O1xuICAgICAgICAgICAgICAgIG5lc3RlZFt0aGlzLmRhdGFdID0gZGF0YTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbmVzdGVkID0gdGhpcy5idXJ5KGRhdGEsIGV4dGVuZCh0cnVlLCB7fSwgdGhpcy5kYXRhKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gbmVzdGVkO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIGRhdGE7XG4gICAgICAgIH1cbiAgICB9LFxuICAgIC8qKlxuICAgICAqIElmIG5lc3RlZCBkYXRhIGhhcyBiZWVuIHNwZWNpZmllZCBpbiB0aGUgZGVzY3JpcHRvciwgZXh0cmFjdCB0aGUgZGF0YS5cbiAgICAgKiBAcGFyYW0gIHtPYmplY3R9IGRhdGFcbiAgICAgKiBAcmV0dXJuIHtPYmplY3R9XG4gICAgICovXG4gICAgX2V4dHJhY3REYXRhOiBmdW5jdGlvbiAoZGF0YSkge1xuICAgICAgICBpZiAoTG9nZ2VyLmRlYnVnLmlzRW5hYmxlZClcbiAgICAgICAgICAgIExvZ2dlci5kZWJ1ZygnX2V4dHJhY3REYXRhJywgZGF0YSk7XG4gICAgICAgIGlmICh0aGlzLmRhdGEpIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2YodGhpcy5kYXRhKSA9PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgIHJldHVybiBkYXRhW3RoaXMuZGF0YV07XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHZhciBrZXlzID0gT2JqZWN0LmtleXModGhpcy5kYXRhKTtcbiAgICAgICAgICAgICAgICBhc3NlcnQoa2V5cy5sZW5ndGggPT0gMSk7XG4gICAgICAgICAgICAgICAgdmFyIGN1cnJUaGVpcnMgPSBkYXRhO1xuICAgICAgICAgICAgICAgIHZhciBjdXJyT3VycyA9IHRoaXMuZGF0YTtcbiAgICAgICAgICAgICAgICB3aGlsZSAodHlwZW9mKGN1cnJPdXJzKSAhPSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgICAgICBrZXlzID0gT2JqZWN0LmtleXMoY3Vyck91cnMpO1xuICAgICAgICAgICAgICAgICAgICBhc3NlcnQoa2V5cy5sZW5ndGggPT0gMSk7XG4gICAgICAgICAgICAgICAgICAgIHZhciBrZXkgPSBrZXlzWzBdO1xuICAgICAgICAgICAgICAgICAgICBjdXJyT3VycyA9IGN1cnJPdXJzW2tleV07XG4gICAgICAgICAgICAgICAgICAgIGN1cnJUaGVpcnMgPSBjdXJyVGhlaXJzW2tleV07XG4gICAgICAgICAgICAgICAgICAgIGlmICghY3VyclRoZWlycykge1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIGN1cnJUaGVpcnMgPyBjdXJyVGhlaXJzW2N1cnJPdXJzXSA6IG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gZGF0YTtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0aGlzIGRlc2NyaXB0b3JzIG1hcHBpbmcgaWYgdGhlIHJlcXVlc3QgY29uZmlnIG1hdGNoZXMuXG4gICAgICogQHBhcmFtIHtPYmplY3R9IGNvbmZpZ1xuICAgICAqIEByZXR1cm5zIHtPYmplY3R9XG4gICAgICovXG4gICAgX21hdGNoQ29uZmlnOiBmdW5jdGlvbiAoY29uZmlnKSB7XG4gICAgICAgIHZhciBtYXRjaGVzID0gY29uZmlnLnR5cGUgPyB0aGlzLl9tYXRjaE1ldGhvZChjb25maWcudHlwZSkgOiB7fTtcbiAgICAgICAgaWYgKG1hdGNoZXMpIHtcbiAgICAgICAgICAgIG1hdGNoZXMgPSBjb25maWcudXJsID8gdGhpcy5fbWF0Y2hQYXRoKGNvbmZpZy51cmwpIDoge307XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG1hdGNoZXM7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgZGF0YSBpZiB0aGUgZGF0YSBtYXRjaGVzLCBwZXJmb3JtaW5nIGFueSBleHRyYWN0aW9uIGFzIHNwZWNpZmllZCBpbiBvcHRzLmRhdGFcbiAgICAgKlxuICAgICAqIEBwYXJhbSAge09iamVjdH0gZGF0YVxuICAgICAqIEByZXR1cm4ge09iamVjdH1cbiAgICAgKi9cbiAgICBfbWF0Y2hEYXRhOiBmdW5jdGlvbiAoZGF0YSkge1xuICAgICAgICB2YXIgZXh0cmFjdGVkRGF0YSA9IG51bGw7XG4gICAgICAgIGlmICh0aGlzLmRhdGEpIHtcbiAgICAgICAgICAgIGlmIChkYXRhKSB7XG4gICAgICAgICAgICAgICAgZXh0cmFjdGVkRGF0YSA9IHRoaXMuX2V4dHJhY3REYXRhKGRhdGEpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZXh0cmFjdGVkRGF0YSA9IGRhdGE7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGV4dHJhY3RlZERhdGE7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBDaGVjayBpZiB0aGUgSFRUUCBjb25maWcgYW5kIHJldHVybmVkIGRhdGEgbWF0Y2ggdGhpcyBkZXNjcmlwdG9yIGRlZmluaXRpb24uXG4gICAgICpcbiAgICAgKiBAcGFyYW0gIHtPYmplY3R9IGNvbmZpZyBDb25maWcgb2JqZWN0IGZvciAkLmFqYXggYW5kIHNpbWlsYXJcbiAgICAgKiBAcGFyYW0gIHtPYmplY3R9IGRhdGFcbiAgICAgKiBAcmV0dXJuIHtPYmplY3R9IEV4dHJhY3RlZCBkYXRhXG4gICAgICovXG4gICAgbWF0Y2g6IGZ1bmN0aW9uIChjb25maWcsIGRhdGEpIHtcbiAgICAgICAgdmFyIHJlZ2V4TWF0Y2hlcyA9IHRoaXMuX21hdGNoQ29uZmlnKGNvbmZpZyk7XG4gICAgICAgIHZhciBtYXRjaGVzID0gISFyZWdleE1hdGNoZXM7XG4gICAgICAgIHZhciBleHRyYWN0ZWREYXRhID0gZmFsc2U7XG4gICAgICAgIGlmIChtYXRjaGVzKSB7XG4gICAgICAgICAgICBleHRyYWN0ZWREYXRhID0gdGhpcy5fbWF0Y2hEYXRhKGRhdGEpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBleHRyYWN0ZWREYXRhO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBBcHBseSBhbnkgdHJhbnNmb3Jtcy5cbiAgICAgKiBAcGFyYW0gIHtPYmplY3R9IGRhdGEgU2VyaWFsaXNlZCBkYXRhLlxuICAgICAqIEByZXR1cm4ge09iamVjdH0gU2VyaWFsaXNlZCBkYXRhIHdpdGggYXBwbGllZCB0cmFuc2Zvcm1hdGlvbnMuXG4gICAgICovXG4gICAgX3RyYW5zZm9ybURhdGE6IGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgICAgIHZhciB0cmFuc2Zvcm1zID0gdGhpcy50cmFuc2Zvcm1zO1xuICAgICAgICBpZiAodHlwZW9mKHRyYW5zZm9ybXMpID09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIGRhdGEgPSB0cmFuc2Zvcm1zKGRhdGEpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZm9yICh2YXIgYXR0ciBpbiB0cmFuc2Zvcm1zKSB7XG4gICAgICAgICAgICAgICAgaWYgKHRyYW5zZm9ybXMuaGFzT3duUHJvcGVydHkoYXR0cikpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGRhdGFbYXR0cl0pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciB0cmFuc2Zvcm0gPSB0cmFuc2Zvcm1zW2F0dHJdO1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHZhbCA9IGRhdGFbYXR0cl07XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mKHRyYW5zZm9ybSkgPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgc3BsaXQgPSB0cmFuc2Zvcm0uc3BsaXQoJy4nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZWxldGUgZGF0YVthdHRyXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoc3BsaXQubGVuZ3RoID09IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0YVtzcGxpdFswXV0gPSB2YWw7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0YVtzcGxpdFswXV0gPSB7fTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG5ld1ZhbCA9IGRhdGFbc3BsaXRbMF1dO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMTsgaSA8IHNwbGl0Lmxlbmd0aCAtIDE7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG5ld0F0dHIgPSBzcGxpdFtpXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5ld1ZhbFtuZXdBdHRyXSA9IHt9O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV3VmFsID0gbmV3VmFsW25ld0F0dHJdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5ld1ZhbFtzcGxpdFtzcGxpdC5sZW5ndGggLSAxXV0gPSB2YWw7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YodHJhbnNmb3JtKSA9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHRyYW5zZm9ybWVkID0gdHJhbnNmb3JtKHZhbCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHV0aWwuaXNBcnJheSh0cmFuc2Zvcm1lZCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVsZXRlIGRhdGFbYXR0cl07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdGFbdHJhbnNmb3JtZWRbMF1dID0gdHJhbnNmb3JtZWRbMV07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0YVthdHRyXSA9IHRyYW5zZm9ybWVkO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ0ludmFsaWQgdHJhbnNmb3JtZXInKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZGF0YTtcbiAgICB9XG59KTtcblxuZXhwb3J0cy5EZXNjcmlwdG9yID0gRGVzY3JpcHRvcjtcbmV4cG9ydHMucmVzb2x2ZU1ldGhvZCA9IHJlc29sdmVNZXRob2Q7IiwidmFyIF9pID0gc2llc3RhLl9pbnRlcm5hbCxcbiAgICB1dGlsID0gX2kudXRpbCxcbiAgICBhc3NlcnQgPSB1dGlsLmFzc2VydCxcbiAgICBfID0gdXRpbC5fLFxuICAgIGxvZyA9IF9pLmxvZztcblxudmFyIExvZ2dlciA9IGxvZy5sb2dnZXJXaXRoTmFtZSgnRGVzY3JpcHRvclJlZ2lzdHJ5Jyk7XG5Mb2dnZXIuc2V0TGV2ZWwobG9nLkxldmVsLndhcm4pO1xuXG4vKipcbiAqIEBjbGFzcyBFbnRyeSBwb2ludCBmb3IgZGVzY3JpcHRvciByZWdpc3RyYXRpb24uXG4gKiBAY29uc3RydWN0b3JcbiAqL1xuZnVuY3Rpb24gRGVzY3JpcHRvclJlZ2lzdHJ5KCkge1xuICAgIGlmICghdGhpcykge1xuICAgICAgICByZXR1cm4gbmV3IERlc2NyaXB0b3JSZWdpc3RyeShvcHRzKTtcbiAgICB9XG4gICAgdGhpcy5yZXF1ZXN0RGVzY3JpcHRvcnMgPSB7fTtcbiAgICB0aGlzLnJlc3BvbnNlRGVzY3JpcHRvcnMgPSB7fTtcbn1cblxuZnVuY3Rpb24gX3JlZ2lzdGVyRGVzY3JpcHRvcihkZXNjcmlwdG9ycywgZGVzY3JpcHRvcikge1xuICAgIHZhciBtYXBwaW5nID0gZGVzY3JpcHRvci5tYXBwaW5nO1xuICAgIHZhciBjb2xsZWN0aW9uID0gbWFwcGluZy5jb2xsZWN0aW9uO1xuICAgIGFzc2VydChtYXBwaW5nKTtcbiAgICBhc3NlcnQoY29sbGVjdGlvbik7XG4gICAgYXNzZXJ0KHR5cGVvZihjb2xsZWN0aW9uKSA9PSAnc3RyaW5nJyk7XG4gICAgaWYgKCFkZXNjcmlwdG9yc1tjb2xsZWN0aW9uXSkge1xuICAgICAgICBkZXNjcmlwdG9yc1tjb2xsZWN0aW9uXSA9IFtdO1xuICAgIH1cbiAgICBkZXNjcmlwdG9yc1tjb2xsZWN0aW9uXS5wdXNoKGRlc2NyaXB0b3IpO1xufVxuXG5mdW5jdGlvbiBfZGVzY3JpcHRvcnNGb3JDb2xsZWN0aW9uKGRlc2NyaXB0b3JzLCBjb2xsZWN0aW9uKSB7XG4gICAgdmFyIGRlc2NyaXB0b3JzRm9yQ29sbGVjdGlvbjtcbiAgICBpZiAodHlwZW9mKGNvbGxlY3Rpb24pID09ICdzdHJpbmcnKSB7XG4gICAgICAgIGRlc2NyaXB0b3JzRm9yQ29sbGVjdGlvbiA9IGRlc2NyaXB0b3JzW2NvbGxlY3Rpb25dIHx8IFtdO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgZGVzY3JpcHRvcnNGb3JDb2xsZWN0aW9uID0gKGRlc2NyaXB0b3JzW2NvbGxlY3Rpb24uX25hbWVdIHx8IFtdKTtcbiAgICB9XG4gICAgcmV0dXJuIGRlc2NyaXB0b3JzRm9yQ29sbGVjdGlvbjtcbn1cblxuY29uc29sZS5sb2coJ18nLCBfKTtcblxuXy5leHRlbmQoRGVzY3JpcHRvclJlZ2lzdHJ5LnByb3RvdHlwZSwge1xuICAgIHJlZ2lzdGVyUmVxdWVzdERlc2NyaXB0b3I6IGZ1bmN0aW9uIChyZXF1ZXN0RGVzY3JpcHRvcikge1xuICAgICAgICBfcmVnaXN0ZXJEZXNjcmlwdG9yKHRoaXMucmVxdWVzdERlc2NyaXB0b3JzLCByZXF1ZXN0RGVzY3JpcHRvcik7XG4gICAgfSxcbiAgICByZWdpc3RlclJlc3BvbnNlRGVzY3JpcHRvcjogZnVuY3Rpb24gKHJlc3BvbnNlRGVzY3JpcHRvcikge1xuICAgICAgICBpZiAoTG9nZ2VyLnRyYWNlLmlzRW5hYmxlZClcbiAgICAgICAgICAgIExvZ2dlci50cmFjZSgncmVnaXN0ZXJSZXNwb25zZURlc2NyaXB0b3InKTtcbiAgICAgICAgX3JlZ2lzdGVyRGVzY3JpcHRvcih0aGlzLnJlc3BvbnNlRGVzY3JpcHRvcnMsIHJlc3BvbnNlRGVzY3JpcHRvcik7XG4gICAgfSxcbiAgICByZXF1ZXN0RGVzY3JpcHRvcnNGb3JDb2xsZWN0aW9uOiBmdW5jdGlvbiAoY29sbGVjdGlvbikge1xuICAgICAgICByZXR1cm4gX2Rlc2NyaXB0b3JzRm9yQ29sbGVjdGlvbih0aGlzLnJlcXVlc3REZXNjcmlwdG9ycywgY29sbGVjdGlvbik7XG4gICAgfSxcbiAgICByZXNwb25zZURlc2NyaXB0b3JzRm9yQ29sbGVjdGlvbjogZnVuY3Rpb24gKGNvbGxlY3Rpb24pIHtcbiAgICAgICAgdmFyIGRlc2NyaXB0b3JzRm9yQ29sbGVjdGlvbiA9IF9kZXNjcmlwdG9yc0ZvckNvbGxlY3Rpb24odGhpcy5yZXNwb25zZURlc2NyaXB0b3JzLCBjb2xsZWN0aW9uKTtcbiAgICAgICAgaWYgKCFkZXNjcmlwdG9yc0ZvckNvbGxlY3Rpb24ubGVuZ3RoKSB7XG4gICAgICAgICAgICBpZiAoTG9nZ2VyLmRlYnVnLmlzRW5hYmxlZClcbiAgICAgICAgICAgICAgICBMb2dnZXIuZGVidWcoJ05vIHJlc3BvbnNlIGRlc2NyaXB0b3JzIGZvciBjb2xsZWN0aW9uICcsIHRoaXMucmVzcG9uc2VEZXNjcmlwdG9ycyk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGRlc2NyaXB0b3JzRm9yQ29sbGVjdGlvbjtcbiAgICB9LFxuICAgIHJlc2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRoaXMucmVxdWVzdERlc2NyaXB0b3JzID0ge307XG4gICAgICAgIHRoaXMucmVzcG9uc2VEZXNjcmlwdG9ycyA9IHt9O1xuICAgIH1cbn0pO1xuXG5leHBvcnRzLkRlc2NyaXB0b3JSZWdpc3RyeSA9IG5ldyBEZXNjcmlwdG9yUmVnaXN0cnkoKTsiLCIvKipcbiAqIFByb3Zpc2lvbnMgdXNhZ2Ugb2YgJC5hamF4IGFuZCBzaW1pbGFyIGZ1bmN0aW9ucyB0byBzZW5kIEhUVFAgcmVxdWVzdHMgbWFwcGluZ1xuICogdGhlIHJlc3VsdHMgYmFjayBvbnRvIHRoZSBvYmplY3QgZ3JhcGggYXV0b21hdGljYWxseS5cbiAqIEBtb2R1bGUgaHR0cFxuICovXG5cbmlmICh0eXBlb2Ygc2llc3RhID09ICd1bmRlZmluZWQnICYmIHR5cGVvZiBtb2R1bGUgPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0NvdWxkIG5vdCBmaW5kIHdpbmRvdy5zaWVzdGEuIE1ha2Ugc3VyZSB5b3UgaW5jbHVkZSBzaWVzdGEuY29yZS5qcyBmaXJzdC4nKTtcbn1cblxudmFyIF9pID0gc2llc3RhLl9pbnRlcm5hbCxcbiAgICBDb2xsZWN0aW9uID0gc2llc3RhLkNvbGxlY3Rpb24sXG4gICAgbG9nID0gX2kubG9nLFxuICAgIHV0aWwgPSBfaS51dGlsLFxuICAgIGVycm9yID0gX2kuZXJyb3IsXG4gICAgXyA9IHV0aWwuXyxcbiAgICBkZXNjcmlwdG9yID0gcmVxdWlyZSgnLi9kZXNjcmlwdG9yJyksXG4gICAgSW50ZXJuYWxTaWVzdGFFcnJvciA9IF9pLmVycm9yLkludGVybmFsU2llc3RhRXJyb3I7XG5cbnZhciBEZXNjcmlwdG9yUmVnaXN0cnkgPSByZXF1aXJlKCcuL2Rlc2NyaXB0b3JSZWdpc3RyeScpLkRlc2NyaXB0b3JSZWdpc3RyeTtcblxuXG52YXIgTG9nZ2VyID0gbG9nLmxvZ2dlcldpdGhOYW1lKCdIVFRQJyk7XG5Mb2dnZXIuc2V0TGV2ZWwobG9nLkxldmVsLndhcm4pO1xuXG4vKipcbiAqIExvZyBhIEhUVFAgcmVzcG9uc2VcbiAqIEBwYXJhbSBvcHRzXG4gKiBAcGFyYW0geGhyXG4gKiBAcGFyYW0gW2RhdGFdIC0gUmF3IGRhdGEgcmVjZWl2ZWQgaW4gSFRUUCByZXNwb25zZS5cbiAqL1xuZnVuY3Rpb24gbG9nSHR0cFJlc3BvbnNlKG9wdHMsIHhociwgZGF0YSkge1xuICAgIGlmIChMb2dnZXIuZGVidWcuaXNFbmFibGVkKSB7XG4gICAgICAgIHZhciBsb2dnZXIgPSBMb2dnZXIuZGVidWc7XG4gICAgICAgIHZhciBsb2dNZXNzYWdlID0gb3B0cy50eXBlICsgJyAnICsgeGhyLnN0YXR1cyArICcgJyArIG9wdHMudXJsO1xuICAgICAgICBpZiAoTG9nZ2VyLnRyYWNlLmlzRW5hYmxlZCAmJiBkYXRhKSB7XG4gICAgICAgICAgICBsb2dnZXIgPSBMb2dnZXIudHJhY2U7XG4gICAgICAgICAgICBsb2dNZXNzYWdlICs9ICc6ICcgKyBKU09OLnN0cmluZ2lmeShkYXRhLCBudWxsLCA0KTtcbiAgICAgICAgfVxuICAgICAgICBsb2dnZXIobG9nTWVzc2FnZSk7XG4gICAgfVxufVxuXG4vKipcbiAqIExvZyBhIEhUVFAgcmVxdWVzdFxuICogQHBhcmFtIG9wdHNcbiAqL1xuZnVuY3Rpb24gbG9nSHR0cFJlcXVlc3Qob3B0cykge1xuICAgIGlmIChMb2dnZXIuZGVidWcuaXNFbmFibGVkKSB7XG4gICAgICAgIHZhciBsb2dnZXIgPSBMb2dnZXIuZGVidWc7XG4gICAgICAgIC8vIFRPRE86IEFwcGVuZCBxdWVyeSBwYXJhbWV0ZXJzIHRvIHRoZSBVUkwuXG4gICAgICAgIHZhciBsb2dNZXNzYWdlID0gb3B0cy50eXBlICsgJyAnICsgb3B0cy51cmw7XG4gICAgICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKSB7XG4gICAgICAgICAgICAvLyBUT0RPOiBJZiBhbnkgZGF0YSBpcyBiZWluZyBzZW50LCBsb2cgdGhhdC5cbiAgICAgICAgICAgIGxvZ2dlciA9IExvZ2dlci50cmFjZTtcbiAgICAgICAgfVxuICAgICAgICBsb2dnZXIobG9nTWVzc2FnZSk7XG4gICAgfVxufVxuXG5cblxuLyoqXG4gKiBTZW5kIGEgSFRUUCByZXF1ZXN0IHRvIHRoZSBnaXZlbiBtZXRob2QgYW5kIHBhdGggcGFyc2luZyB0aGUgcmVzcG9uc2UuXG4gKiBAcGFyYW0ge1N0cmluZ30gbWV0aG9kXG4gKiBAcGFyYW0ge1N0cmluZ30gcGF0aCBUaGUgcGF0aCB0byB0aGUgcmVzb3VyY2Ugd2Ugd2FudCB0byBHRVRcbiAqIEBwYXJhbSB7T2JqZWN0fEZ1bmN0aW9ufSBvcHRzT3JDYWxsYmFjayBFaXRoZXIgYW4gb3B0aW9ucyBvYmplY3Qgb3IgYSBjYWxsYmFjayBpZiBjYW4gdXNlIGRlZmF1bHRzXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBDYWxsYmFjayBpZiBvcHRzIHNwZWNpZmllZC5cbiAqL1xuZnVuY3Rpb24gX2h0dHBSZXNwb25zZShtZXRob2QsIHBhdGgsIG9wdHNPckNhbGxiYWNrLCBjYWxsYmFjaykge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMik7XG4gICAgdmFyIG9wdHMgPSB7fTtcbiAgICB2YXIgbmFtZSA9IHRoaXMuX25hbWU7XG4gICAgaWYgKHR5cGVvZihhcmdzWzBdKSA9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIGNhbGxiYWNrID0gYXJnc1swXTtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZihhcmdzWzBdKSA9PSAnb2JqZWN0Jykge1xuICAgICAgICBvcHRzID0gYXJnc1swXTtcbiAgICAgICAgY2FsbGJhY2sgPSBhcmdzWzFdO1xuICAgIH1cbiAgICB2YXIgZGVmZXJyZWQgPSB3aW5kb3cucSA/IHdpbmRvdy5xLmRlZmVyKCkgOiBudWxsO1xuICAgIGNhbGxiYWNrID0gdXRpbC5jb25zdHJ1Y3RDYWxsYmFja0FuZFByb21pc2VIYW5kbGVyKGNhbGxiYWNrLCBkZWZlcnJlZCk7XG4gICAgb3B0cy50eXBlID0gbWV0aG9kO1xuICAgIGlmICghb3B0cy51cmwpIHsgLy8gQWxsb3cgb3ZlcnJpZGVzLlxuICAgICAgICB2YXIgYmFzZVVSTCA9IHRoaXMuYmFzZVVSTDtcbiAgICAgICAgb3B0cy51cmwgPSBiYXNlVVJMICsgcGF0aDtcbiAgICB9XG4gICAgaWYgKG9wdHMucGFyc2VSZXNwb25zZSA9PT0gdW5kZWZpbmVkKSBvcHRzLnBhcnNlUmVzcG9uc2UgPSB0cnVlO1xuICAgIG9wdHMuc3VjY2VzcyA9IGZ1bmN0aW9uIChkYXRhLCBzdGF0dXMsIHhocikge1xuICAgICAgICBsb2dIdHRwUmVzcG9uc2Uob3B0cywgeGhyLCBkYXRhKTtcbiAgICAgICAgdmFyIHJlc3AgPSB7XG4gICAgICAgICAgICBkYXRhOiBkYXRhLFxuICAgICAgICAgICAgc3RhdHVzOiBzdGF0dXMsXG4gICAgICAgICAgICB4aHI6IHhoclxuICAgICAgICB9O1xuICAgICAgICBpZiAob3B0cy5wYXJzZVJlc3BvbnNlKSB7XG4gICAgICAgICAgICB2YXIgZGVzY3JpcHRvcnMgPSBEZXNjcmlwdG9yUmVnaXN0cnkucmVzcG9uc2VEZXNjcmlwdG9yc0ZvckNvbGxlY3Rpb24oc2VsZik7XG4gICAgICAgICAgICB2YXIgbWF0Y2hlZERlc2NyaXB0b3I7XG4gICAgICAgICAgICB2YXIgZXh0cmFjdGVkRGF0YTtcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgZGVzY3JpcHRvcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICB2YXIgZGVzY3JpcHRvciA9IGRlc2NyaXB0b3JzW2ldO1xuICAgICAgICAgICAgICAgIGV4dHJhY3RlZERhdGEgPSBkZXNjcmlwdG9yLm1hdGNoKG9wdHMsIGRhdGEpO1xuICAgICAgICAgICAgICAgIGlmIChleHRyYWN0ZWREYXRhKSB7XG4gICAgICAgICAgICAgICAgICAgIG1hdGNoZWREZXNjcmlwdG9yID0gZGVzY3JpcHRvcjtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKG1hdGNoZWREZXNjcmlwdG9yKSB7XG4gICAgICAgICAgICAgICAgaWYgKExvZ2dlci50cmFjZS5pc0VuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgTG9nZ2VyLnRyYWNlKCdNYXBwaW5nIGV4dHJhY3RlZCBkYXRhOiAnICsgSlNPTi5zdHJpbmdpZnkoZXh0cmFjdGVkRGF0YSwgbnVsbCwgNCkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mKGV4dHJhY3RlZERhdGEpID09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBtYXBwaW5nID0gbWF0Y2hlZERlc2NyaXB0b3IubWFwcGluZztcbiAgICAgICAgICAgICAgICAgICAgbWFwcGluZy5tYXAoZXh0cmFjdGVkRGF0YSwgZnVuY3Rpb24gKGVyciwgb2JqKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoY2FsbGJhY2spIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVyciwgb2JqLCByZXNwKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSwgb3B0cy5vYmopO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7IC8vIE1hdGNoZWQsIGJ1dCBubyBkYXRhLlxuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhudWxsLCB0cnVlLCByZXNwKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGNhbGxiYWNrKSB7XG4gICAgICAgICAgICAgICAgaWYgKG5hbWUpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGVyciA9IHt9O1xuICAgICAgICAgICAgICAgICAgICB2YXIgY29kZSA9IGVycm9yLkVycm9yQ29kZS5Ob0Rlc2NyaXB0b3JNYXRjaGVkO1xuICAgICAgICAgICAgICAgICAgICBlcnJbZXJyb3IuRXJyb3JGaWVsZC5Db2RlXSA9IGNvZGU7XG4gICAgICAgICAgICAgICAgICAgIGVycltlcnJvci5FcnJvckZpZWxkLk1lc3NhZ2VdID0gZXJyb3IuTWVzc2FnZVtjb2RlXTtcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyLCBudWxsLCByZXNwKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyBUaGVyZSB3YXMgYSBidWcgd2hlcmUgY29sbGVjdGlvbiBuYW1lIGRvZXNuJ3QgZXhpc3QuIElmIHRoaXMgb2NjdXJzLCB0aGVuIHdpbGwgbmV2ZXIgZ2V0IGhvbGQgb2YgYW55IGRlc2NyaXB0b3JzLlxuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignVW5uYW1lZCBjb2xsZWN0aW9uJyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY2FsbGJhY2sobnVsbCwgbnVsbCwgcmVzcCk7XG4gICAgICAgIH1cblxuICAgIH07XG4gICAgb3B0cy5lcnJvciA9IGZ1bmN0aW9uICh4aHIsIHN0YXR1cywgZXJyb3IpIHtcbiAgICAgICAgdmFyIHJlc3AgPSB7XG4gICAgICAgICAgICB4aHI6IHhocixcbiAgICAgICAgICAgIHN0YXR1czogc3RhdHVzLFxuICAgICAgICAgICAgZXJyb3I6IGVycm9yXG4gICAgICAgIH07XG4gICAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2socmVzcCwgbnVsbCwgcmVzcCk7XG4gICAgfTtcbiAgICBsb2dIdHRwUmVxdWVzdChvcHRzKTtcbiAgICBzaWVzdGEuZXh0Lmh0dHAuYWpheChvcHRzKTtcbn1cblxuZnVuY3Rpb24gX3NlcmlhbGlzZU9iamVjdChvcHRzLCBvYmosIGNiKSB7XG4gICAgdGhpcy5fc2VyaWFsaXNlKG9iaiwgZnVuY3Rpb24gKGVyciwgZGF0YSkge1xuICAgICAgICB2YXIgcmV0RGF0YSA9IGRhdGE7XG4gICAgICAgIGlmIChvcHRzLmZpZWxkcykge1xuICAgICAgICAgICAgcmV0RGF0YSA9IHt9O1xuICAgICAgICAgICAgXy5lYWNoKG9wdHMuZmllbGRzLCBmdW5jdGlvbiAoZikge1xuICAgICAgICAgICAgICAgIHJldERhdGFbZl0gPSBkYXRhW2ZdO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgY2IoZXJyLCByZXREYXRhKTtcbiAgICB9KTtcbn1cblxuLyoqXG4gKiBTZW5kIGEgSFRUUCByZXF1ZXN0IHRvIHRoZSBnaXZlbiBtZXRob2QgYW5kIHBhdGhcbiAqIEBwYXJhbSB7U3RyaW5nfSBtZXRob2RcbiAqIEBwYXJhbSB7U3RyaW5nfSBwYXRoIFRoZSBwYXRoIHRvIHRoZSByZXNvdXJjZSB3ZSB3YW50IHRvIEdFVFxuICogQHBhcmFtIHtTaWVzdGFNb2RlbH0gb2JqZWN0IFRoZSBtb2RlbCB3ZSdyZSBwdXNoaW5nIHRvIHRoZSBzZXJ2ZXJcbiAqIEBwYXJhbSB7T2JqZWN0fEZ1bmN0aW9ufSBvcHRzT3JDYWxsYmFjayBFaXRoZXIgYW4gb3B0aW9ucyBvYmplY3Qgb3IgYSBjYWxsYmFjayBpZiBjYW4gdXNlIGRlZmF1bHRzXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBDYWxsYmFjayBpZiBvcHRzIHNwZWNpZmllZC5cbiAqL1xuZnVuY3Rpb24gX2h0dHBSZXF1ZXN0KG1ldGhvZCwgcGF0aCwgb2JqZWN0KSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAzKTtcbiAgICB2YXIgY2FsbGJhY2s7XG4gICAgdmFyIG9wdHMgPSB7fTtcbiAgICBpZiAodHlwZW9mKGFyZ3NbMF0pID09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgY2FsbGJhY2sgPSBhcmdzWzBdO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mKGFyZ3NbMF0pID09ICdvYmplY3QnKSB7XG4gICAgICAgIG9wdHMgPSBhcmdzWzBdO1xuICAgICAgICBjYWxsYmFjayA9IGFyZ3NbMV07XG4gICAgfVxuICAgIHZhciBkZWZlcnJlZCA9IHdpbmRvdy5xID8gd2luZG93LnEuZGVmZXIoKSA6IG51bGw7XG4gICAgY2FsbGJhY2sgPSB1dGlsLmNvbnN0cnVjdENhbGxiYWNrQW5kUHJvbWlzZUhhbmRsZXIoY2FsbGJhY2ssIGRlZmVycmVkKTtcbiAgICBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJncywgMik7XG4gICAgdmFyIHJlcXVlc3REZXNjcmlwdG9ycyA9IERlc2NyaXB0b3JSZWdpc3RyeS5yZXF1ZXN0RGVzY3JpcHRvcnNGb3JDb2xsZWN0aW9uKHRoaXMpO1xuICAgIHZhciBtYXRjaGVkRGVzY3JpcHRvcjtcbiAgICBvcHRzLnR5cGUgPSBtZXRob2Q7XG4gICAgdmFyIGJhc2VVUkwgPSB0aGlzLmJhc2VVUkw7XG4gICAgb3B0cy51cmwgPSBiYXNlVVJMICsgcGF0aDtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHJlcXVlc3REZXNjcmlwdG9ycy5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgcmVxdWVzdERlc2NyaXB0b3IgPSByZXF1ZXN0RGVzY3JpcHRvcnNbaV07XG4gICAgICAgIGlmIChyZXF1ZXN0RGVzY3JpcHRvci5fbWF0Y2hDb25maWcob3B0cykpIHtcbiAgICAgICAgICAgIG1hdGNoZWREZXNjcmlwdG9yID0gcmVxdWVzdERlc2NyaXB0b3I7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgIH1cbiAgICBpZiAobWF0Y2hlZERlc2NyaXB0b3IpIHtcbiAgICAgICAgaWYgKExvZ2dlci50cmFjZS5pc0VuYWJsZWQpXG4gICAgICAgICAgICBMb2dnZXIudHJhY2UoJ01hdGNoZWQgZGVzY3JpcHRvcjogJyArIG1hdGNoZWREZXNjcmlwdG9yLl9kdW1wKHRydWUpKTtcbiAgICAgICAgX3NlcmlhbGlzZU9iamVjdC5jYWxsKG1hdGNoZWREZXNjcmlwdG9yLCBvYmplY3QsIG9wdHMsIGZ1bmN0aW9uIChlcnIsIGRhdGEpIHtcbiAgICAgICAgICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKVxuICAgICAgICAgICAgICAgIExvZ2dlci50cmFjZSgnX3NlcmlhbGlzZScsIHtcbiAgICAgICAgICAgICAgICAgICAgZXJyOiBlcnIsXG4gICAgICAgICAgICAgICAgICAgIGRhdGE6IGRhdGFcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKGVyciwgbnVsbCwgbnVsbCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIG9wdHMuZGF0YSA9IGRhdGE7XG4gICAgICAgICAgICAgICAgb3B0cy5vYmogPSBvYmplY3Q7XG4gICAgICAgICAgICAgICAgXy5wYXJ0aWFsKF9odHRwUmVzcG9uc2UsIG1ldGhvZCwgcGF0aCwgb3B0cywgY2FsbGJhY2spLmFwcGx5KHNlbGYsIGFyZ3MpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgIH0gZWxzZSBpZiAoY2FsbGJhY2spIHtcbiAgICAgICAgaWYgKExvZ2dlci50cmFjZS5pc0VuYWJsZWQpXG4gICAgICAgICAgICBMb2dnZXIudHJhY2UoJ0RpZCBub3QgbWF0Y2ggZGVzY3JpcHRvcicpO1xuICAgICAgICBjYWxsYmFjaygnTm8gZGVzY3JpcHRvciBtYXRjaGVkJywgbnVsbCwgbnVsbCk7XG4gICAgfVxuICAgIHJldHVybiBkZWZlcnJlZCA/IGRlZmVycmVkLnByb21pc2UgOiBudWxsO1xufVxuXG4vKipcbiAqIFNlbmQgYSBERUxFVEUgcmVxdWVzdC4gQWxzbyByZW1vdmVzIHRoZSBvYmplY3QuXG4gKiBAcGFyYW0ge0NvbGxlY3Rpb259IGNvbGxlY3Rpb25cbiAqIEBwYXJhbSB7U3RyaW5nfSBwYXRoIFRoZSBwYXRoIHRvIHRoZSByZXNvdXJjZSB0byB3aGljaCB3ZSB3YW50IHRvIERFTEVURVxuICogQHBhcmFtIHtTaWVzdGFNb2RlbH0gb2JqZWN0IFRoZSBtb2RlbCB0aGF0IHdlIHdvdWxkIGxpa2UgdG8gUEFUQ0hcbiAqIEByZXR1cm5zIHtQcm9taXNlfVxuICovXG5mdW5jdGlvbiBERUxFVEUoY29sbGVjdGlvbiwgcGF0aCwgb2JqZWN0KSB7XG4gICAgdmFyIGRlZmVycmVkID0gd2luZG93LnEgPyB3aW5kb3cucS5kZWZlcigpIDogbnVsbDtcbiAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMyk7XG4gICAgdmFyIG9wdHMgPSB7fTtcbiAgICB2YXIgY2FsbGJhY2s7XG4gICAgaWYgKHR5cGVvZihhcmdzWzBdKSA9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIGNhbGxiYWNrID0gYXJnc1swXTtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZihhcmdzWzBdKSA9PSAnb2JqZWN0Jykge1xuICAgICAgICBvcHRzID0gYXJnc1swXTtcbiAgICAgICAgY2FsbGJhY2sgPSBhcmdzWzFdO1xuICAgIH1cbiAgICBjYWxsYmFjayA9IHV0aWwuY29uc3RydWN0Q2FsbGJhY2tBbmRQcm9taXNlSGFuZGxlcihjYWxsYmFjaywgZGVmZXJyZWQpO1xuICAgIHZhciBkZWxldGlvbk1vZGUgPSBvcHRzLmRlbGV0aW9uTW9kZSB8fCAncmVzdG9yZSc7XG4gICAgLy8gQnkgZGVmYXVsdCB3ZSBkbyBub3QgbWFwIHRoZSByZXNwb25zZSBmcm9tIGEgREVMRVRFIHJlcXVlc3QuXG4gICAgaWYgKG9wdHMucGFyc2VSZXNwb25zZSA9PT0gdW5kZWZpbmVkKSBvcHRzLnBhcnNlUmVzcG9uc2UgPSBmYWxzZTtcbiAgICBfaHR0cFJlc3BvbnNlLmNhbGwoY29sbGVjdGlvbiwgJ0RFTEVURScsIHBhdGgsIG9wdHMsIGZ1bmN0aW9uIChlcnIsIHgsIHksIHopIHtcbiAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgaWYgKGRlbGV0aW9uTW9kZSA9PSAncmVzdG9yZScpIHtcbiAgICAgICAgICAgICAgICBvYmplY3QucmVzdG9yZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKGRlbGV0aW9uTW9kZSA9PSAnc3VjY2VzcycpIHtcbiAgICAgICAgICAgIG9iamVjdC5yZW1vdmUoKTtcbiAgICAgICAgfVxuICAgICAgICBjYWxsYmFjayhlcnIsIHgsIHksIHopO1xuICAgIH0pO1xuICAgIGlmIChkZWxldGlvbk1vZGUgPT0gJ25vdycgfHwgZGVsZXRpb25Nb2RlID09ICdyZXN0b3JlJykge1xuICAgICAgICBvYmplY3QucmVtb3ZlKCk7XG4gICAgfVxuICAgIHJldHVybiBkZWZlcnJlZCA/IGRlZmVycmVkLnByb21pc2UgOiBudWxsO1xufVxuXG4vKipcbiAqIFNlbmQgYSBIVFRQIHJlcXVlc3QgdXNpbmcgdGhlIGdpdmVuIG1ldGhvZFxuICogQHBhcmFtIHtDb2xsZWN0aW9ufSBjb2xsZWN0aW9uXG4gKiBAcGFyYW0gcmVxdWVzdCBEb2VzIHRoZSByZXF1ZXN0IGNvbnRhaW4gZGF0YT8gZS5nLiBQT1NUL1BBVENIL1BVVCB3aWxsIGJlIHRydWUsIEdFVCB3aWxsIGZhbHNlXG4gKiBAcGFyYW0gbWV0aG9kXG4gKiBAaW50ZXJuYWxcbiAqIEByZXR1cm5zIHtQcm9taXNlfVxuICovXG5mdW5jdGlvbiBIVFRQX01FVEhPRChjb2xsZWN0aW9uLCByZXF1ZXN0LCBtZXRob2QpIHtcbiAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMyk7XG4gICAgcmV0dXJuIF8ucGFydGlhbChyZXF1ZXN0ID8gX2h0dHBSZXF1ZXN0IDogX2h0dHBSZXNwb25zZSwgbWV0aG9kKS5hcHBseShjb2xsZWN0aW9uLCBhcmdzKTtcbn1cblxuLyoqXG4gKiBTZW5kIGEgR0VUIHJlcXVlc3RcbiAqIEBwYXJhbSB7Q29sbGVjdGlvbn0gY29sbGVjdGlvblxuICogQHBhcmFtIHtTdHJpbmd9IHBhdGggVGhlIHBhdGggdG8gdGhlIHJlc291cmNlIHdlIHdhbnQgdG8gR0VUXG4gKiBAcGFyYW0ge09iamVjdHxGdW5jdGlvbn0gb3B0c09yQ2FsbGJhY2sgRWl0aGVyIGFuIG9wdGlvbnMgb2JqZWN0IG9yIGEgY2FsbGJhY2sgaWYgY2FuIHVzZSBkZWZhdWx0c1xuICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgQ2FsbGJhY2sgaWYgb3B0cyBzcGVjaWZpZWQuXG4gKiBAcGFja2FnZSBIVFRQXG4gKiBAcmV0dXJucyB7UHJvbWlzZX1cbiAqL1xuZnVuY3Rpb24gR0VUKGNvbGxlY3Rpb24pIHtcbiAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgcmV0dXJuIF8ucGFydGlhbChIVFRQX01FVEhPRCwgY29sbGVjdGlvbiwgZmFsc2UsICdHRVQnKS5hcHBseSh0aGlzLCBhcmdzKTtcbn1cblxuLyoqXG4gKiBTZW5kIGFuIE9QVElPTlMgcmVxdWVzdFxuICogQHBhcmFtIHtDb2xsZWN0aW9ufSBjb2xsZWN0aW9uXG4gKiBAcGFyYW0ge1N0cmluZ30gcGF0aCBUaGUgcGF0aCB0byB0aGUgcmVzb3VyY2Ugd2Ugd2FudCB0byBHRVRcbiAqIEBwYXJhbSB7T2JqZWN0fEZ1bmN0aW9ufSBvcHRzT3JDYWxsYmFjayBFaXRoZXIgYW4gb3B0aW9ucyBvYmplY3Qgb3IgYSBjYWxsYmFjayBpZiBjYW4gdXNlIGRlZmF1bHRzXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBDYWxsYmFjayBpZiBvcHRzIHNwZWNpZmllZC5cbiAqIEBwYWNrYWdlIEhUVFBcbiAqIEByZXR1cm5zIHtQcm9taXNlfVxuICovXG5mdW5jdGlvbiBPUFRJT05TKGNvbGxlY3Rpb24pIHtcbiAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgcmV0dXJuIF8ucGFydGlhbChIVFRQX01FVEhPRCwgY29sbGVjdGlvbiwgZmFsc2UsICdPUFRJT05TJykuYXBwbHkodGhpcywgYXJncyk7XG59XG5cbi8qKlxuICogU2VuZCBhbiBUUkFDRSByZXF1ZXN0XG4gKiBAcGFyYW0ge0NvbGxlY3Rpb259IGNvbGxlY3Rpb25cbiAqIEBwYXJhbSB7U3RyaW5nfSBwYXRoIFRoZSBwYXRoIHRvIHRoZSByZXNvdXJjZSB3ZSB3YW50IHRvIEdFVFxuICogQHBhcmFtIHtPYmplY3R8RnVuY3Rpb259IG9wdHNPckNhbGxiYWNrIEVpdGhlciBhbiBvcHRpb25zIG9iamVjdCBvciBhIGNhbGxiYWNrIGlmIGNhbiB1c2UgZGVmYXVsdHNcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIENhbGxiYWNrIGlmIG9wdHMgc3BlY2lmaWVkLlxuICogQHBhY2thZ2UgSFRUUFxuICogQHJldHVybnMge1Byb21pc2V9XG4gKi9cbmZ1bmN0aW9uIFRSQUNFKGNvbGxlY3Rpb24pIHtcbiAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgcmV0dXJuIF8ucGFydGlhbChIVFRQX01FVEhPRCwgY29sbGVjdGlvbiwgZmFsc2UsICdUUkFDRScpLmFwcGx5KHRoaXMsIGFyZ3MpO1xufVxuXG4vKipcbiAqIFNlbmQgYW4gSEVBRCByZXF1ZXN0XG4gKiBAcGFyYW0ge0NvbGxlY3Rpb259IGNvbGxlY3Rpb25cbiAqIEBwYXJhbSB7U3RyaW5nfSBwYXRoIFRoZSBwYXRoIHRvIHRoZSByZXNvdXJjZSB3ZSB3YW50IHRvIEdFVFxuICogQHBhcmFtIHtPYmplY3R8RnVuY3Rpb259IG9wdHNPckNhbGxiYWNrIEVpdGhlciBhbiBvcHRpb25zIG9iamVjdCBvciBhIGNhbGxiYWNrIGlmIGNhbiB1c2UgZGVmYXVsdHNcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIENhbGxiYWNrIGlmIG9wdHMgc3BlY2lmaWVkLlxuICogQHBhY2thZ2UgSFRUUFxuICogQHJldHVybnMge1Byb21pc2V9XG4gKi9cbmZ1bmN0aW9uIEhFQUQoY29sbGVjdGlvbikge1xuICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICByZXR1cm4gXy5wYXJ0aWFsKEhUVFBfTUVUSE9ELCBjb2xsZWN0aW9uLCBmYWxzZSwgJ0hFQUQnKS5hcHBseSh0aGlzLCBhcmdzKTtcbn1cblxuLyoqXG4gKiBTZW5kIGFuIFBPU1QgcmVxdWVzdFxuICogQHBhcmFtIHtDb2xsZWN0aW9ufSBjb2xsZWN0aW9uXG4gKiBAcGFyYW0ge1N0cmluZ30gcGF0aCBUaGUgcGF0aCB0byB0aGUgcmVzb3VyY2Ugd2Ugd2FudCB0byBHRVRcbiAqIEBwYXJhbSB7U2llc3RhTW9kZWx9IG1vZGVsIFRoZSBtb2RlbCB0aGF0IHdlIHdvdWxkIGxpa2UgdG8gUE9TVFxuICogQHBhcmFtIHtPYmplY3R8RnVuY3Rpb259IG9wdHNPckNhbGxiYWNrIEVpdGhlciBhbiBvcHRpb25zIG9iamVjdCBvciBhIGNhbGxiYWNrIGlmIGNhbiB1c2UgZGVmYXVsdHNcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIENhbGxiYWNrIGlmIG9wdHMgc3BlY2lmaWVkLlxuICogQHBhY2thZ2UgSFRUUFxuICogQHJldHVybnMge1Byb21pc2V9XG4gKi9cbmZ1bmN0aW9uIFBPU1QoY29sbGVjdGlvbikge1xuICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICByZXR1cm4gXy5wYXJ0aWFsKEhUVFBfTUVUSE9ELCBjb2xsZWN0aW9uLCB0cnVlLCAnUE9TVCcpLmFwcGx5KHRoaXMsIGFyZ3MpO1xufVxuXG4vKipcbiAqIFNlbmQgYW4gUFVUIHJlcXVlc3RcbiAqIEBwYXJhbSB7Q29sbGVjdGlvbn0gY29sbGVjdGlvblxuICogQHBhcmFtIHtTdHJpbmd9IHBhdGggVGhlIHBhdGggdG8gdGhlIHJlc291cmNlIHdlIHdhbnQgdG8gR0VUXG4gKiBAcGFyYW0ge1NpZXN0YU1vZGVsfSBtb2RlbCBUaGUgbW9kZWwgdGhhdCB3ZSB3b3VsZCBsaWtlIHRvIFBPU1RcbiAqIEBwYXJhbSB7T2JqZWN0fEZ1bmN0aW9ufSBvcHRzT3JDYWxsYmFjayBFaXRoZXIgYW4gb3B0aW9ucyBvYmplY3Qgb3IgYSBjYWxsYmFjayBpZiBjYW4gdXNlIGRlZmF1bHRzXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBDYWxsYmFjayBpZiBvcHRzIHNwZWNpZmllZC5cbiAqIEBwYWNrYWdlIEhUVFBcbiAqIEByZXR1cm5zIHtQcm9taXNlfVxuICovXG5mdW5jdGlvbiBQVVQoY29sbGVjdGlvbikge1xuICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICByZXR1cm4gXy5wYXJ0aWFsKEhUVFBfTUVUSE9ELCBjb2xsZWN0aW9uLCB0cnVlLCAnUFVUJykuYXBwbHkodGhpcywgYXJncyk7XG59XG5cbi8qKlxuICogU2VuZCBhbiBQQVRDSCByZXF1ZXN0XG4gKiBAcGFyYW0ge0NvbGxlY3Rpb259IGNvbGxlY3Rpb25cbiAqIEBwYXJhbSB7U3RyaW5nfSBwYXRoIFRoZSBwYXRoIHRvIHRoZSByZXNvdXJjZSB3ZSB3YW50IHRvIEdFVFxuICogQHBhcmFtIHtTaWVzdGFNb2RlbH0gbW9kZWwgVGhlIG1vZGVsIHRoYXQgd2Ugd291bGQgbGlrZSB0byBQT1NUXG4gKiBAcGFyYW0ge09iamVjdHxGdW5jdGlvbn0gb3B0c09yQ2FsbGJhY2sgRWl0aGVyIGFuIG9wdGlvbnMgb2JqZWN0IG9yIGEgY2FsbGJhY2sgaWYgY2FuIHVzZSBkZWZhdWx0c1xuICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgQ2FsbGJhY2sgaWYgb3B0cyBzcGVjaWZpZWQuXG4gKiBAcGFja2FnZSBIVFRQXG4gKiBAcmV0dXJucyB7UHJvbWlzZX1cbiAqL1xuZnVuY3Rpb24gUEFUQ0goY29sbGVjdGlvbikge1xuICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICByZXR1cm4gXy5wYXJ0aWFsKEhUVFBfTUVUSE9ELCBjb2xsZWN0aW9uLCB0cnVlLCAnUEFUQ0gnKS5hcHBseSh0aGlzLCBhcmdzKTtcbn1cblxuXG52YXIgYWpheDtcblxuXG52YXIgaHR0cCA9IHtcbiAgICBSZXF1ZXN0RGVzY3JpcHRvcjogcmVxdWlyZSgnLi9yZXF1ZXN0RGVzY3JpcHRvcicpLlJlcXVlc3REZXNjcmlwdG9yLFxuICAgIFJlc3BvbnNlRGVzY3JpcHRvcjogcmVxdWlyZSgnLi9yZXNwb25zZURlc2NyaXB0b3InKS5SZXNwb25zZURlc2NyaXB0b3IsXG4gICAgRGVzY3JpcHRvcjogZGVzY3JpcHRvci5EZXNjcmlwdG9yLFxuICAgIF9yZXNvbHZlTWV0aG9kOiBkZXNjcmlwdG9yLnJlc29sdmVNZXRob2QsXG4gICAgU2VyaWFsaXNlcjogcmVxdWlyZSgnLi9zZXJpYWxpc2VyJyksXG4gICAgRGVzY3JpcHRvclJlZ2lzdHJ5OiByZXF1aXJlKCcuL2Rlc2NyaXB0b3JSZWdpc3RyeScpLkRlc2NyaXB0b3JSZWdpc3RyeSxcbiAgICBzZXRBamF4OiBmdW5jdGlvbiAoX2FqYXgpIHtcbiAgICAgICAgYWpheCA9IF9hamF4O1xuICAgIH0sXG4gICAgX2h0dHBSZXNwb25zZTogX2h0dHBSZXNwb25zZSxcbiAgICBfaHR0cFJlcXVlc3Q6IF9odHRwUmVxdWVzdCxcbiAgICBERUxFVEU6IERFTEVURSxcbiAgICBIVFRQX01FVEhPRDogSFRUUF9NRVRIT0QsXG4gICAgR0VUOiBHRVQsXG4gICAgVFJBQ0U6IFRSQUNFLFxuICAgIE9QVElPTlM6IE9QVElPTlMsXG4gICAgSEVBRDogSEVBRCxcbiAgICBQT1NUOiBQT1NULFxuICAgIFBVVDogUFVULFxuICAgIFBBVENIOiBQQVRDSCxcbiAgICBfc2VyaWFsaXNlT2JqZWN0OiBfc2VyaWFsaXNlT2JqZWN0XG59O1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoaHR0cCwgJ2FqYXgnLCB7XG4gICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBhID0gYWpheCB8fCAoJCA/ICQuYWpheCA6IG51bGwpIHx8IChqUXVlcnkgPyBqUXVlcnkuYWpheCA6IG51bGwpO1xuICAgICAgICBpZiAoIWEpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdhamF4IGhhcyBub3QgYmVlbiBkZWZpbmVkIGFuZCBjb3VsZCBub3QgZmluZCAkLmFqYXggb3IgalF1ZXJ5LmFqYXgnKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gYTtcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24gKHYpIHtcbiAgICAgICAgYWpheCA9IHY7XG4gICAgfVxufSk7XG5cbmlmICh0eXBlb2Ygc2llc3RhICE9ICd1bmRlZmluZWQnKSB7XG4gICAgaWYgKCFzaWVzdGEuZXh0KSB7XG4gICAgICAgIHNpZXN0YS5leHQgPSB7fTtcbiAgICB9XG4gICAgc2llc3RhLmV4dC5odHRwID0gaHR0cDtcbn1cblxuaWYgKHR5cGVvZiBtb2R1bGUgIT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBtb2R1bGUuZXhwb3J0cyA9IGh0dHA7XG59IiwiLyoqXG4gKiBAbW9kdWxlIGh0dHBcbiAqL1xuXG52YXIgRGVzY3JpcHRvciA9IHJlcXVpcmUoJy4vZGVzY3JpcHRvcicpLkRlc2NyaXB0b3JcbiAgICAsIFNlcmlhbGlzZXIgPSByZXF1aXJlKCcuL3NlcmlhbGlzZXInKTtcblxudmFyIF9pID0gc2llc3RhLl9pbnRlcm5hbFxuICAgICwgdXRpbCA9IF9pLnV0aWxcbiAgICAsIF8gPSB1dGlsLl9cbiAgICAsIGxvZyA9IF9pLmxvZ1xuICAgICwgZGVmaW5lU3ViUHJvcGVydHkgPSB1dGlsLmRlZmluZVN1YlByb3BlcnR5XG47XG5cbnZhciBMb2dnZXIgPSBsb2cubG9nZ2VyV2l0aE5hbWUoJ1JlcXVlc3REZXNjcmlwdG9yJyk7XG5Mb2dnZXIuc2V0TGV2ZWwobG9nLkxldmVsLndhcm4pO1xuXG4vKipcbiAqIEBjbGFzcyBEZXNjcmliZXMgYSBIVFRQIHJlcXVlc3RcbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRzXG4gKi9cbmZ1bmN0aW9uIFJlcXVlc3REZXNjcmlwdG9yKG9wdHMpIHtcbiAgICBpZiAoIXRoaXMpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBSZXF1ZXN0RGVzY3JpcHRvcihvcHRzKTtcbiAgICB9XG5cbiAgICBEZXNjcmlwdG9yLmNhbGwodGhpcywgb3B0cyk7XG4gICAgaWYgKHRoaXMuX29wdHNbJ3NlcmlhbGl6ZXInXSkge1xuICAgICAgICB0aGlzLl9vcHRzLnNlcmlhbGlzZXIgPSB0aGlzLl9vcHRzWydzZXJpYWxpemVyJ107XG4gICAgfVxuXG4gICAgaWYgKCF0aGlzLl9vcHRzLnNlcmlhbGlzZXIpIHtcbiAgICAgICAgdGhpcy5fb3B0cy5zZXJpYWxpc2VyID0gU2VyaWFsaXNlci5kZXB0aFNlcmlhbGl6ZXIoMCk7XG4gICAgfVxuXG5cbiAgICBkZWZpbmVTdWJQcm9wZXJ0eS5jYWxsKHRoaXMsICdzZXJpYWxpc2VyJywgdGhpcy5fb3B0cyk7XG4gICAgZGVmaW5lU3ViUHJvcGVydHkuY2FsbCh0aGlzLCAnc2VyaWFsaXplcicsIHRoaXMuX29wdHMsICdzZXJpYWxpc2VyJyk7XG5cbn1cblxuUmVxdWVzdERlc2NyaXB0b3IucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShEZXNjcmlwdG9yLnByb3RvdHlwZSk7XG5cbl8uZXh0ZW5kKFJlcXVlc3REZXNjcmlwdG9yLnByb3RvdHlwZSwge1xuICAgIF9zZXJpYWxpc2U6IGZ1bmN0aW9uIChvYmosIGNhbGxiYWNrKSB7XG4gICAgICAgIHZhciBkZWZlcnJlZCA9IHdpbmRvdy5xID8gd2luZG93LnEuZGVmZXIoKSA6IG51bGw7XG4gICAgICAgIGNhbGxiYWNrID0gdXRpbC5jb25zdHJ1Y3RDYWxsYmFja0FuZFByb21pc2VIYW5kbGVyKGNhbGxiYWNrLCBkZWZlcnJlZCk7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgaWYgKExvZ2dlci50cmFjZS5pc0VuYWJsZWQpXG4gICAgICAgICAgICBMb2dnZXIudHJhY2UoJ19zZXJpYWxpc2UnKTtcbiAgICAgICAgdmFyIGZpbmlzaGVkO1xuICAgICAgICB2YXIgZGF0YSA9IHRoaXMuc2VyaWFsaXNlcihvYmosIGZ1bmN0aW9uIChlcnIsIGRhdGEpIHtcbiAgICAgICAgICAgIGlmICghZmluaXNoZWQpIHtcbiAgICAgICAgICAgICAgICBkYXRhID0gc2VsZi5fdHJhbnNmb3JtRGF0YShkYXRhKTtcbiAgICAgICAgICAgICAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKGVyciwgc2VsZi5fZW1iZWREYXRhKGRhdGEpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIGlmIChkYXRhICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKVxuICAgICAgICAgICAgICAgIExvZ2dlci50cmFjZSgnc2VyaWFsaXNlciBkb2VzbnQgdXNlIGEgY2FsbGJhY2snKTtcbiAgICAgICAgICAgIGZpbmlzaGVkID0gdHJ1ZTtcbiAgICAgICAgICAgIGRhdGEgPSBzZWxmLl90cmFuc2Zvcm1EYXRhKGRhdGEpO1xuICAgICAgICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhudWxsLCBzZWxmLl9lbWJlZERhdGEoZGF0YSkpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgaWYgKExvZ2dlci50cmFjZS5pc0VuYWJsZWQpXG4gICAgICAgICAgICAgICAgTG9nZ2VyLnRyYWNlKCdzZXJpYWxpc2VyIHVzZXMgYSBjYWxsYmFjaycsIHRoaXMuc2VyaWFsaXNlcik7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGRlZmVycmVkID8gZGVmZXJyZWQucHJvbWlzZSA6IG51bGw7XG4gICAgfSxcbiAgICBfZHVtcDogZnVuY3Rpb24gKGFzSnNvbikge1xuICAgICAgICB2YXIgb2JqID0ge307XG4gICAgICAgIG9iai5tZXRob2RzID0gdGhpcy5tZXRob2Q7XG4gICAgICAgIG9iai5tYXBwaW5nID0gdGhpcy5tYXBwaW5nLnR5cGU7XG4gICAgICAgIG9iai5wYXRoID0gdGhpcy5fcmF3T3B0cy5wYXRoO1xuICAgICAgICB2YXIgc2VyaWFsaXNlcjtcbiAgICAgICAgaWYgKHR5cGVvZih0aGlzLl9yYXdPcHRzLnNlcmlhbGlzZXIpID09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIHNlcmlhbGlzZXIgPSAnZnVuY3Rpb24gKCkgeyAuLi4gfSdcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHNlcmlhbGlzZXIgPSB0aGlzLl9yYXdPcHRzLnNlcmlhbGlzZXI7XG4gICAgICAgIH1cbiAgICAgICAgb2JqLnNlcmlhbGlzZXIgPSBzZXJpYWxpc2VyO1xuICAgICAgICB2YXIgdHJhbnNmb3JtcyA9IHt9O1xuICAgICAgICBmb3IgKHZhciBmIGluIHRoaXMudHJhbnNmb3Jtcykge1xuICAgICAgICAgICAgaWYgKHRoaXMudHJhbnNmb3Jtcy5oYXNPd25Qcm9wZXJ0eShmKSkge1xuICAgICAgICAgICAgICAgIHZhciB0cmFuc2Zvcm0gPSB0aGlzLnRyYW5zZm9ybXNbZl07XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZih0cmFuc2Zvcm0pID09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgICAgICAgICAgdHJhbnNmb3Jtc1tmXSA9ICdmdW5jdGlvbiAoKSB7IC4uLiB9J1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdHJhbnNmb3Jtc1tmXSA9IHRoaXMudHJhbnNmb3Jtc1tmXTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgb2JqLnRyYW5zZm9ybXMgPSB0cmFuc2Zvcm1zO1xuICAgICAgICByZXR1cm4gYXNKc29uID8gSlNPTi5zdHJpbmdpZnkob2JqLCBudWxsLCA0KSA6IG9iajtcbiAgICB9XG59KTtcblxuZXhwb3J0cy5SZXF1ZXN0RGVzY3JpcHRvciA9IFJlcXVlc3REZXNjcmlwdG9yO1xuIiwiLyoqXG4gKiBAbW9kdWxlIGh0dHBcbiAqL1xuXG5cbnZhciBEZXNjcmlwdG9yID0gcmVxdWlyZSgnLi9kZXNjcmlwdG9yJykuRGVzY3JpcHRvcjtcblxuLyoqXG4gKiBEZXNjcmliZXMgd2hhdCB0byBkbyB3aXRoIGEgSFRUUCByZXNwb25zZS5cbiAqIEBjb25zdHJ1Y3RvclxuICogQGltcGxlbWVudHMge0Rlc2NyaXB0b3J9XG4gKiBAcGFyYW0ge09iamVjdH0gb3B0c1xuICovXG5mdW5jdGlvbiBSZXNwb25zZURlc2NyaXB0b3Iob3B0cykge1xuICAgIGlmICghdGhpcykge1xuICAgICAgICByZXR1cm4gbmV3IFJlc3BvbnNlRGVzY3JpcHRvcihvcHRzKTtcbiAgICB9XG4gICAgRGVzY3JpcHRvci5jYWxsKHRoaXMsIG9wdHMpO1xufVxuXG5SZXNwb25zZURlc2NyaXB0b3IucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShEZXNjcmlwdG9yLnByb3RvdHlwZSk7XG5cbl8uZXh0ZW5kKFJlc3BvbnNlRGVzY3JpcHRvci5wcm90b3R5cGUsIHtcbiAgICBfZXh0cmFjdERhdGE6IGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgICAgIHZhciBleHRyYWN0ZWREYXRhID0gRGVzY3JpcHRvci5wcm90b3R5cGUuX2V4dHJhY3REYXRhLmNhbGwodGhpcywgZGF0YSk7XG4gICAgICAgIGlmIChleHRyYWN0ZWREYXRhKSB7XG4gICAgICAgICAgICBleHRyYWN0ZWREYXRhID0gdGhpcy5fdHJhbnNmb3JtRGF0YShleHRyYWN0ZWREYXRhKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZXh0cmFjdGVkRGF0YTtcbiAgICB9LFxuICAgIF9tYXRjaERhdGE6IGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgICAgIHZhciBleHRyYWN0ZWREYXRhID0gRGVzY3JpcHRvci5wcm90b3R5cGUuX21hdGNoRGF0YS5jYWxsKHRoaXMsIGRhdGEpO1xuICAgICAgICBpZiAoZXh0cmFjdGVkRGF0YSkge1xuICAgICAgICAgICAgZXh0cmFjdGVkRGF0YSA9IHRoaXMuX3RyYW5zZm9ybURhdGEoZXh0cmFjdGVkRGF0YSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGV4dHJhY3RlZERhdGE7XG4gICAgfSxcbiAgICBfZHVtcDogZnVuY3Rpb24gKGFzSnNvbikge1xuICAgICAgICB2YXIgb2JqID0ge307XG4gICAgICAgIG9iai5tZXRob2RzID0gdGhpcy5tZXRob2Q7XG4gICAgICAgIG9iai5tYXBwaW5nID0gdGhpcy5tYXBwaW5nLnR5cGU7XG4gICAgICAgIG9iai5wYXRoID0gdGhpcy5fcmF3T3B0cy5wYXRoO1xuICAgICAgICB2YXIgdHJhbnNmb3JtcyA9IHt9O1xuICAgICAgICBmb3IgKHZhciBmIGluIHRoaXMudHJhbnNmb3Jtcykge1xuICAgICAgICAgICAgaWYgKHRoaXMudHJhbnNmb3Jtcy5oYXNPd25Qcm9wZXJ0eShmKSkge1xuICAgICAgICAgICAgICAgIHZhciB0cmFuc2Zvcm0gPSB0aGlzLnRyYW5zZm9ybXNbZl07XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZih0cmFuc2Zvcm0pID09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgICAgICAgICAgdHJhbnNmb3Jtc1tmXSA9ICdmdW5jdGlvbiAoKSB7IC4uLiB9J1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdHJhbnNmb3Jtc1tmXSA9IHRoaXMudHJhbnNmb3Jtc1tmXTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgb2JqLnRyYW5zZm9ybXMgPSB0cmFuc2Zvcm1zO1xuICAgICAgICByZXR1cm4gYXNKc29uID8gSlNPTi5zdHJpbmdpZnkob2JqLCBudWxsLCA0KSA6IG9iajtcbiAgICB9XG59KTtcblxuZXhwb3J0cy5SZXNwb25zZURlc2NyaXB0b3IgPSBSZXNwb25zZURlc2NyaXB0b3I7IiwiLyoqXG4gKiBAbW9kdWxlIGh0dHBcbiAqL1xuXG52YXIgX2kgPSBzaWVzdGEuX2ludGVybmFsO1xuXG52YXIgbG9nID0gX2kubG9nXG4gICAgLCB1dGlscyA9IF9pLnV0aWw7XG52YXIgTG9nZ2VyID0gbG9nLmxvZ2dlcldpdGhOYW1lKCdTZXJpYWxpc2VyJyk7XG5Mb2dnZXIuc2V0TGV2ZWwobG9nLkxldmVsLndhcm4pO1xudmFyIF8gPSB1dGlscy5fO1xuXG4vKipcbiAqIFNlcmlhbGlzZXMgYW4gb2JqZWN0IGludG8gaXQncyByZW1vdGUgaWRlbnRpZmllciAoYXMgZGVmaW5lZCBieSB0aGUgbWFwcGluZylcbiAqIEBwYXJhbSAge1NpZXN0YU1vZGVsfSBvYmpcbiAqIEByZXR1cm4ge1N0cmluZ31cbiAqIFxuICovXG5mdW5jdGlvbiBpZFNlcmlhbGlzZXIob2JqKSB7XG4gICAgdmFyIGlkRmllbGQgPSBvYmoubWFwcGluZy5pZDtcbiAgICBpZiAoaWRGaWVsZCkge1xuICAgICAgICByZXR1cm4gb2JqW2lkRmllbGRdID8gb2JqW2lkRmllbGRdIDogbnVsbDtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIGlmIChMb2dnZXIuZGVidWcuaXNFbmFibGVkKVxuICAgICAgICAgICAgTG9nZ2VyLmRlYnVnKCdObyBpZGZpZWxkJyk7XG4gICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfVxufVxuXG4vKipcbiAqIFNlcmlhbGlzZXMgb2JqIGZvbGxvd2luZyByZWxhdGlvbnNoaXBzIHRvIHNwZWNpZmllZCBkZXB0aC5cbiAqIEBwYXJhbSAge0ludGVnZXJ9ICAgZGVwdGhcbiAqIEBwYXJhbSAge1NpZXN0YU1vZGVsfSAgIG9ialxuICogQHBhcmFtICB7RnVuY3Rpb259IGRvbmUgXG4gKi9cbmZ1bmN0aW9uIGRlcHRoU2VyaWFsaXNlcihkZXB0aCwgb2JqLCBkb25lKSB7XG4gICAgaWYgKExvZ2dlci50cmFjZS5pc0VuYWJsZWQpXG4gICAgICAgIExvZ2dlci50cmFjZSgnZGVwdGhTZXJpYWxpc2VyJyk7XG4gICAgdmFyIGRhdGEgPSB7fTtcbiAgICBfLmVhY2gob2JqLl9maWVsZHMsIGZ1bmN0aW9uIChmKSB7XG4gICAgICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKVxuICAgICAgICAgICAgTG9nZ2VyLnRyYWNlKCdmaWVsZCcsIGYpO1xuICAgICAgICBpZiAob2JqW2ZdKSB7XG4gICAgICAgICAgICBkYXRhW2ZdID0gb2JqW2ZdO1xuICAgICAgICB9XG4gICAgfSk7XG4gICAgdmFyIHdhaXRpbmcgPSBbXTtcbiAgICB2YXIgZXJyb3JzID0gW107XG4gICAgdmFyIHJlc3VsdCA9IHt9O1xuICAgIHZhciBmaW5pc2hlZCA9IFtdO1xuICAgIF8uZWFjaChvYmouX3JlbGF0aW9uc2hpcEZpZWxkcywgZnVuY3Rpb24gKGYpIHtcbiAgICAgICAgaWYgKExvZ2dlci50cmFjZS5pc0VuYWJsZWQpXG4gICAgICAgICAgICBMb2dnZXIudHJhY2UoJ3JlbGF0aW9uc2hpcEZpZWxkJywgZik7XG4gICAgICAgIHZhciBwcm94eSA9IG9iai5fX3Byb3hpZXNbZl07XG4gICAgICAgIGlmIChwcm94eS5pc0ZvcndhcmQpIHsgLy8gQnkgZGVmYXVsdCBvbmx5IGZvcndhcmQgcmVsYXRpb25zaGlwLlxuICAgICAgICAgICAgaWYgKExvZ2dlci5kZWJ1Zy5pc0VuYWJsZWQpXG4gICAgICAgICAgICAgICAgTG9nZ2VyLmRlYnVnKGYpO1xuICAgICAgICAgICAgd2FpdGluZy5wdXNoKGYpO1xuICAgICAgICAgICAgcHJveHkuZ2V0KGZ1bmN0aW9uIChlcnIsIHYpIHtcbiAgICAgICAgICAgICAgICBpZiAoTG9nZ2VyLnRyYWNlLmlzRW5hYmxlZClcbiAgICAgICAgICAgICAgICAgICAgTG9nZ2VyLnRyYWNlKCdwcm94eS5nZXQnLCBmKTtcbiAgICAgICAgICAgICAgICBpZiAoTG9nZ2VyLmRlYnVnLmlzRW5hYmxlZClcbiAgICAgICAgICAgICAgICAgICAgTG9nZ2VyLmRlYnVnKGYsIHYpO1xuICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgZXJyb3JzLnB1c2goZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgZmluaXNoZWQucHVzaChmKTtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0W2ZdID0ge2VycjogZXJyLCB2OiB2fTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSBpZiAodikge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWRlcHRoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBmaW5pc2hlZC5wdXNoKGYpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZGF0YVtmXSA9IHZbb2JqLl9fcHJveGllc1tmXS5mb3J3YXJkTWFwcGluZy5pZF07XG4gICAgICAgICAgICAgICAgICAgICAgICByZXN1bHRbZl0gPSB7ZXJyOiBlcnIsIHY6IHZ9O1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCh3YWl0aW5nLmxlbmd0aCA9PSBmaW5pc2hlZC5sZW5ndGgpICYmIGRvbmUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkb25lKGVycm9ycy5sZW5ndGggPyBlcnJvcnMgOiBudWxsLCBkYXRhLCByZXN1bHQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgZGVwdGhTZXJpYWxpc2VyKGRlcHRoIC0gMSwgdiwgZnVuY3Rpb24gKGVyciwgc3ViRGF0YSwgcmVzcCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZXJyb3JzLnB1c2goZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdGFbZl0gPSBzdWJEYXRhO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmaW5pc2hlZC5wdXNoKGYpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc3VsdFtmXSA9IHtlcnI6IGVyciwgdjogdiwgcmVzcDogcmVzcH07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCh3YWl0aW5nLmxlbmd0aCA9PSBmaW5pc2hlZC5sZW5ndGgpICYmIGRvbmUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZG9uZShlcnJvcnMubGVuZ3RoID8gZXJyb3JzIDogbnVsbCwgZGF0YSwgcmVzdWx0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKExvZ2dlci5kZWJ1Zy5pc0VuYWJsZWQpXG4gICAgICAgICAgICAgICAgICAgICAgICBMb2dnZXIuZGVidWcoJ25vIHZhbHVlIGZvciAnICsgZik7XG4gICAgICAgICAgICAgICAgICAgIGZpbmlzaGVkLnB1c2goZik7XG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdFtmXSA9IHtlcnI6IGVyciwgdjogdn07XG4gICAgICAgICAgICAgICAgICAgIGlmICgod2FpdGluZy5sZW5ndGggPT0gZmluaXNoZWQubGVuZ3RoKSAmJiBkb25lKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkb25lKGVycm9ycy5sZW5ndGggPyBlcnJvcnMgOiBudWxsLCBkYXRhLCByZXN1bHQpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBpZiAoIXdhaXRpbmcubGVuZ3RoKSB7XG4gICAgICAgIGlmIChkb25lKSBkb25lKG51bGwsIGRhdGEsIHt9KTtcbiAgICB9XG59XG5cblxuZXhwb3J0cy5kZXB0aFNlcmlhbGlzZXIgPSBmdW5jdGlvbiAoZGVwdGgpIHtcbiAgICByZXR1cm4gIF8ucGFydGlhbChkZXB0aFNlcmlhbGlzZXIsIGRlcHRoKTtcbn07XG5leHBvcnRzLmRlcHRoU2VyaWFsaXplciA9IGZ1bmN0aW9uIChkZXB0aCkge1xuICAgIHJldHVybiAgXy5wYXJ0aWFsKGRlcHRoU2VyaWFsaXNlciwgZGVwdGgpO1xufTtcbmV4cG9ydHMuaWRTZXJpYWxpemVyID0gaWRTZXJpYWxpc2VyO1xuZXhwb3J0cy5pZFNlcmlhbGlzZXIgPSBpZFNlcmlhbGlzZXI7XG5cbiJdfQ==
