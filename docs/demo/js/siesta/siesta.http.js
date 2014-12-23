(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
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
Logger.setLevel(log.Level.trace);

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
                        throw new Error('Model ' + this._opts.mapping + ' does not exist', {
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
},{}],2:[function(require,module,exports){
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
},{}],3:[function(require,module,exports){
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
Logger.setLevel(log.Level.trace);

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
                    Logger.trace('Model extracted data: ' + JSON.stringify(extractedData, null, 4));
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
 * @param {ModelInstance} object The model we're pushing to the server
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
 * @param {ModelInstance} object The model that we would like to PATCH
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
 * @param {ModelInstance} model The model that we would like to POST
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
 * @param {ModelInstance} model The model that we would like to POST
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
 * @param {ModelInstance} model The model that we would like to POST
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
},{"./descriptor":1,"./descriptorRegistry":2,"./requestDescriptor":4,"./responseDescriptor":5,"./serialiser":6}],4:[function(require,module,exports){
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

},{"./descriptor":1,"./serialiser":6}],5:[function(require,module,exports){
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
},{"./descriptor":1}],6:[function(require,module,exports){
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
 * @param  {ModelInstance} obj
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
 * @param  {ModelInstance}   obj
 * @param  {Function} done 
 */
function depthSerialiser(depth, obj, done) {
    if (Logger.trace.isEnabled)
        Logger.trace('depthSerialiser');
    var data = {};
    _.each(obj._attributeNames, function (f) {
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
    _.each(obj._relationshipNames, function (f) {
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
    return  _.partial(depthSerialiser, depth);
};
exports.depthSerializer = function (depth) {
    return  _.partial(depthSerialiser, depth);
};
exports.idSerializer = idSerialiser;
exports.idSerialiser = idSerialiser;


},{}]},{},[3])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9odHRwL2Rlc2NyaXB0b3IuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9odHRwL2Rlc2NyaXB0b3JSZWdpc3RyeS5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2h0dHAvaW5kZXguanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9odHRwL3JlcXVlc3REZXNjcmlwdG9yLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3QvaHR0cC9yZXNwb25zZURlc2NyaXB0b3IuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9odHRwL3NlcmlhbGlzZXIuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL1hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxYUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLyoqXG4gKiBEZXNjcmlwdG9ycyBkZWFsIHdpdGggdGhlIGRlc2NyaXB0aW9uIG9mIEhUVFAgcmVxdWVzdHMgYW5kIGFyZSB1c2VkIGJ5IFNpZXN0YSB0byBkZXRlcm1pbmUgd2hhdCB0byBkb1xuICogd2l0aCBIVFRQIHJlcXVlc3QvcmVzcG9uc2UgYm9kaWVzLlxuICogQG1vZHVsZSBodHRwXG4gKi9cblxudmFyIF9pID0gc2llc3RhLl9pbnRlcm5hbCxcbiAgICBsb2cgPSBfaS5sb2csXG4gICAgSW50ZXJuYWxTaWVzdGFFcnJvciA9IF9pLmVycm9yLkludGVybmFsU2llc3RhRXJyb3IsXG4gICAgdXRpbCA9IF9pLnV0aWwsXG4gICAgYXNzZXJ0ID0gdXRpbC5hc3NlcnQsXG4gICAgZGVmaW5lU3ViUHJvcGVydHkgPSB1dGlsLmRlZmluZVN1YlByb3BlcnR5LFxuICAgIENvbGxlY3Rpb25SZWdpc3RyeSA9IF9pLkNvbGxlY3Rpb25SZWdpc3RyeSxcbiAgICBleHRlbmQgPSBfaS5leHRlbmQsXG4gICAgXyA9IHV0aWwuXztcblxudmFyIExvZ2dlciA9IGxvZy5sb2dnZXJXaXRoTmFtZSgnRGVzY3JpcHRvcicpO1xuTG9nZ2VyLnNldExldmVsKGxvZy5MZXZlbC50cmFjZSk7XG5cbnZhciBodHRwTWV0aG9kcyA9IFsnUE9TVCcsICdQQVRDSCcsICdQVVQnLCAnSEVBRCcsICdHRVQnLCAnREVMRVRFJywgJ09QVElPTlMnLCAnVFJBQ0UnLCAnQ09OTkVDVCddO1xuXG5mdW5jdGlvbiByZXNvbHZlTWV0aG9kKG1ldGhvZHMpIHtcbiAgICAvLyBDb252ZXJ0IHdpbGRjYXJkcyBpbnRvIG1ldGhvZHMgYW5kIGVuc3VyZSBpcyBhbiBhcnJheSBvZiB1cHBlcmNhc2UgbWV0aG9kcy5cbiAgICBpZiAobWV0aG9kcykge1xuICAgICAgICBpZiAobWV0aG9kcyA9PSAnKicgfHwgbWV0aG9kcy5pbmRleE9mKCcqJykgPiAtMSkge1xuICAgICAgICAgICAgbWV0aG9kcyA9IGh0dHBNZXRob2RzO1xuICAgICAgICB9IGVsc2UgaWYgKCF1dGlsLmlzQXJyYXkobWV0aG9kcykpIHtcbiAgICAgICAgICAgIG1ldGhvZHMgPSBbbWV0aG9kc107XG4gICAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgICBtZXRob2RzID0gWydHRVQnXTtcbiAgICB9XG4gICAgcmV0dXJuIF8ubWFwKG1ldGhvZHMsIGZ1bmN0aW9uICh4KSB7XG4gICAgICAgIHJldHVybiB4LnRvVXBwZXJDYXNlKClcbiAgICB9KTtcbn1cblxuLyoqXG4gKiBBIGRlc2NyaXB0b3IgJ2Rlc2NyaWJlcycgcG9zc2libGUgSFRUUCByZXF1ZXN0cyBhZ2FpbnN0IGFuIEFQSSwgYW5kIGlzIHVzZWQgdG8gZGVjaWRlIHdoZXRoZXIgb3Igbm90IHRvXG4gKiBpbnRlcmNlcHQgYSBIVFRQIHJlcXVlc3QvcmVzcG9uc2UgYW5kIHBlcmZvcm0gYSBtYXBwaW5nLlxuICpcbiAqIEBjb25zdHJ1Y3RvclxuICogQHBhcmFtIHtPYmplY3R9IG9wdHNcbiAqL1xuZnVuY3Rpb24gRGVzY3JpcHRvcihvcHRzKSB7XG4gICAgaWYgKCF0aGlzKSB7XG4gICAgICAgIHJldHVybiBuZXcgRGVzY3JpcHRvcihvcHRzKTtcbiAgICB9XG5cbiAgICB0aGlzLl9yYXdPcHRzID0gZXh0ZW5kKHRydWUsIHt9LCBvcHRzKTtcbiAgICB0aGlzLl9vcHRzID0gb3B0cztcblxuICAgIHZhciBwcm9jZXNzUGF0aCA9IGZ1bmN0aW9uIChyYXcpIHtcbiAgICAgICAgaWYgKCEocmF3IGluc3RhbmNlb2YgUmVnRXhwKSkge1xuICAgICAgICAgICAgcmF3ID0gbmV3IFJlZ0V4cChyYXcsICdnJyk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJhdztcbiAgICB9LmJpbmQodGhpcyk7XG5cbiAgICBpZiAodGhpcy5fb3B0cy5wYXRoKSB7XG4gICAgICAgIHZhciBwYXRocyA9IHRoaXMuX29wdHMucGF0aDtcbiAgICAgICAgaWYgKCF1dGlsLmlzQXJyYXkocGF0aHMpKSB7XG4gICAgICAgICAgICBwYXRocyA9IFtwYXRoc107XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9vcHRzLnBhdGggPSBbXTtcblxuICAgICAgICBfLmVhY2gocGF0aHMsIGZ1bmN0aW9uIChwKSB7XG4gICAgICAgICAgICB0aGlzLl9vcHRzLnBhdGgucHVzaChwcm9jZXNzUGF0aC5jYWxsKHRoaXMsIHApKTtcbiAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLl9vcHRzLnBhdGggPSBbJyddO1xuICAgIH1cblxuICAgIHRoaXMuX29wdHMubWV0aG9kID0gcmVzb2x2ZU1ldGhvZCh0aGlzLl9vcHRzLm1ldGhvZCk7XG5cbiAgICAvLyBNYXBwaW5ncyBjYW4gYmUgcGFzc2VkIGFzIHRoZSBhY3R1YWwgbWFwcGluZyBvYmplY3Qgb3IgYXMgYSBzdHJpbmcgKHdpdGggQVBJIHNwZWNpZmllZCB0b28pXG4gICAgaWYgKHRoaXMuX29wdHMubWFwcGluZykge1xuICAgICAgICBpZiAodHlwZW9mKHRoaXMuX29wdHMubWFwcGluZykgPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9vcHRzLmNvbGxlY3Rpb24pIHtcbiAgICAgICAgICAgICAgICB2YXIgY29sbGVjdGlvbjtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mKHRoaXMuX29wdHMuY29sbGVjdGlvbikgPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICAgICAgY29sbGVjdGlvbiA9IENvbGxlY3Rpb25SZWdpc3RyeVt0aGlzLl9vcHRzLmNvbGxlY3Rpb25dO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbGxlY3Rpb24gPSB0aGlzLl9vcHRzLmNvbGxlY3Rpb247XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChjb2xsZWN0aW9uKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBhY3R1YWxNYXBwaW5nID0gY29sbGVjdGlvblt0aGlzLl9vcHRzLm1hcHBpbmddO1xuICAgICAgICAgICAgICAgICAgICBpZiAoYWN0dWFsTWFwcGluZykge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fb3B0cy5tYXBwaW5nID0gYWN0dWFsTWFwcGluZztcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignTWFwcGluZyAnICsgdGhpcy5fb3B0cy5tYXBwaW5nICsgJyBkb2VzIG5vdCBleGlzdCcsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBvcHRzOiBvcHRzLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0b3I6IHRoaXNcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdDb2xsZWN0aW9uICcgKyB0aGlzLl9vcHRzLmNvbGxlY3Rpb24gKyAnIGRvZXMgbm90IGV4aXN0Jywge1xuICAgICAgICAgICAgICAgICAgICAgICAgb3B0czogb3B0cyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0b3I6IHRoaXNcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1Bhc3NlZCBtYXBwaW5nIGFzIHN0cmluZywgYnV0IGRpZCBub3Qgc3BlY2lmeSB0aGUgY29sbGVjdGlvbiBpdCBiZWxvbmdzIHRvJywge1xuICAgICAgICAgICAgICAgICAgICBvcHRzOiBvcHRzLFxuICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdG9yOiB0aGlzXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0Rlc2NyaXB0b3JzIG11c3QgYmUgaW5pdGlhbGlzZWQgd2l0aCBhIG1hcHBpbmcnLCB7XG4gICAgICAgICAgICBvcHRzOiBvcHRzLFxuICAgICAgICAgICAgZGVzY3JpcHRvcjogdGhpc1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBJZiBrZXkgcGF0aCwgY29udmVydCBkYXRhIGtleSBwYXRoIGludG8gYW4gb2JqZWN0IHRoYXQgd2UgY2FuIHRoZW4gdXNlIHRvIHRyYXZlcnNlIHRoZSBIVFRQIGJvZGllcy5cbiAgICAvLyBvdGhlcndpc2UgbGVhdmUgYXMgc3RyaW5nIG9yIHVuZGVmaW5lZC5cbiAgICB2YXIgZGF0YSA9IHRoaXMuX29wdHMuZGF0YTtcbiAgICBpZiAoZGF0YSkge1xuICAgICAgICBpZiAoZGF0YS5sZW5ndGgpIHtcbiAgICAgICAgICAgIHZhciByb290O1xuICAgICAgICAgICAgdmFyIGFyciA9IGRhdGEuc3BsaXQoJy4nKTtcbiAgICAgICAgICAgIGlmIChhcnIubGVuZ3RoID09IDEpIHtcbiAgICAgICAgICAgICAgICByb290ID0gYXJyWzBdO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB2YXIgb2JqID0ge307XG4gICAgICAgICAgICAgICAgcm9vdCA9IG9iajtcbiAgICAgICAgICAgICAgICB2YXIgcHJldmlvdXNLZXkgPSBhcnJbMF07XG4gICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDE7IGkgPCBhcnIubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGtleSA9IGFycltpXTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGkgPT0gKGFyci5sZW5ndGggLSAxKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgb2JqW3ByZXZpb3VzS2V5XSA9IGtleTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBuZXdWYXIgPSB7fTtcbiAgICAgICAgICAgICAgICAgICAgICAgIG9ialtwcmV2aW91c0tleV0gPSBuZXdWYXI7XG4gICAgICAgICAgICAgICAgICAgICAgICBvYmogPSBuZXdWYXI7XG4gICAgICAgICAgICAgICAgICAgICAgICBwcmV2aW91c0tleSA9IGtleTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuX29wdHMuZGF0YSA9IHJvb3Q7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAbmFtZSBwYXRoXG4gICAgICogQHR5cGUge1N0cmluZ31cbiAgICAgKi9cbiAgICBkZWZpbmVTdWJQcm9wZXJ0eS5jYWxsKHRoaXMsICdwYXRoJywgdGhpcy5fb3B0cyk7XG4gICAgZGVmaW5lU3ViUHJvcGVydHkuY2FsbCh0aGlzLCAnbWV0aG9kJywgdGhpcy5fb3B0cyk7XG4gICAgZGVmaW5lU3ViUHJvcGVydHkuY2FsbCh0aGlzLCAnbWFwcGluZycsIHRoaXMuX29wdHMpO1xuICAgIGRlZmluZVN1YlByb3BlcnR5LmNhbGwodGhpcywgJ2RhdGEnLCB0aGlzLl9vcHRzKTtcbiAgICBkZWZpbmVTdWJQcm9wZXJ0eS5jYWxsKHRoaXMsICd0cmFuc2Zvcm1zJywgdGhpcy5fb3B0cyk7XG59XG5cbl8uZXh0ZW5kKERlc2NyaXB0b3IucHJvdG90eXBlLCB7XG4gICAgaHR0cE1ldGhvZHM6IGh0dHBNZXRob2RzLFxuICAgIC8qKlxuICAgICAqIFRha2VzIGEgcmVnZXggcGF0aCBhbmQgcmV0dXJucyB0cnVlIGlmIG1hdGNoZWRcbiAgICAgKlxuICAgICAqIEBwYXJhbSAge1N0cmluZ30gcGF0aFxuICAgICAqIEByZXR1cm4ge2Jvb2xlYW59XG4gICAgICogQGludGVybmFsXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBgYGBqc1xuICAgICAqIHZhciBkID0gbmV3IERlc2NyaXB0b3Ioe1xuICAgICAqICAgICBwYXRoOiAnL3Jlc291cmNlLyg/UDxpZD4pLydcbiAgICAgKiB9KVxuICAgICAqIHZhciBtYXRjaGVkID0gZC5fbWF0Y2hQYXRoKCcvcmVzb3VyY2UvMicpO1xuICAgICAqIGNvbnNvbGUubG9nKG1hdGNoZWQpOyAvLyB7aWQ6ICcyJ31cbiAgICAgKiBgYGBcbiAgICAgKi9cbiAgICBfbWF0Y2hQYXRoOiBmdW5jdGlvbiAocGF0aCkge1xuICAgICAgICB2YXIgaTtcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IHRoaXMuX29wdHMucGF0aC5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdmFyIHJlZ0V4cCA9IHRoaXMuX29wdHMucGF0aFtpXTtcbiAgICAgICAgICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKVxuICAgICAgICAgICAgICAgIExvZ2dlci50cmFjZSgnTWF0Y2hpbmcgcGF0aCcsIHBhdGgsIHJlZ0V4cC50b1N0cmluZygpKTtcbiAgICAgICAgICAgIHZhciBtYXRjaGVkID0gcmVnRXhwLmV4ZWMocGF0aCk7XG4gICAgICAgICAgICBpZiAoTG9nZ2VyLnRyYWNlLmlzRW5hYmxlZCkge1xuICAgICAgICAgICAgICAgIGlmIChtYXRjaGVkKSB7XG4gICAgICAgICAgICAgICAgICAgIExvZ2dlci50cmFjZSgnTWF0Y2hlZCBwYXRoIHN1Y2Nlc3NmdWxseScsIHBhdGgsIHJlZ0V4cC50b1N0cmluZygpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIExvZ2dlci50cmFjZSgnRmFpbGVkIHRvIG1hdGNoIHBhdGgnLCBwYXRoLCByZWdFeHAudG9TdHJpbmcoKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKG1hdGNoZWQpIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0cnVlIGlmIHRoZSBkZXNjcmlwdG9yIGFjY2VwdHMgdGhlIEhUVFAgbWV0aG9kLlxuICAgICAqXG4gICAgICogQHBhcmFtICB7U3RyaW5nfSBtZXRob2RcbiAgICAgKiBAcmV0dXJuIHtib29sZWFufVxuICAgICAqIEBpbnRlcm5hbFxuICAgICAqIEBleGFtcGxlXG4gICAgICogYGBganNcbiAgICAgKiB2YXIgZCA9IG5ldyBEZXNjcmlwdG9yKHtcbiAgICAgKiAgICAgbWV0aG9kOiBbJ1BPU1QnLCAnUFVUJ11cbiAgICAgKiB9KTtcbiAgICAgKiBjb25zb2xlLmxvZyhkLl9tYXRjaE1ldGhvZCgnR0VUJykpOyAvLyBmYWxzZVxuICAgICAqIGBgYFxuICAgICAqL1xuICAgIF9tYXRjaE1ldGhvZDogZnVuY3Rpb24gKG1ldGhvZCkge1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMubWV0aG9kLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAobWV0aG9kLnRvVXBwZXJDYXNlKCkgPT0gdGhpcy5tZXRob2RbaV0pIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBQZXJmb3JtcyBhIGJyZWFkdGgtZmlyc3Qgc2VhcmNoIHRocm91Z2ggZGF0YSwgZW1iZWRkaW5nIG9iaiBpbiB0aGUgZmlyc3QgbGVhZi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSAge09iamVjdH0gb2JqXG4gICAgICogQHBhcmFtICB7T2JqZWN0fSBkYXRhXG4gICAgICogQHJldHVybiB7T2JqZWN0fVxuICAgICAqL1xuICAgIGJ1cnk6IGZ1bmN0aW9uIChvYmosIGRhdGEpIHtcbiAgICAgICAgdmFyIHJvb3QgPSBkYXRhO1xuICAgICAgICB2YXIga2V5cyA9IE9iamVjdC5rZXlzKGRhdGEpO1xuICAgICAgICBhc3NlcnQoa2V5cy5sZW5ndGggPT0gMSk7XG4gICAgICAgIHZhciBrZXkgPSBrZXlzWzBdO1xuICAgICAgICB2YXIgY3VyciA9IGRhdGE7XG4gICAgICAgIHdoaWxlICghKHR5cGVvZihjdXJyW2tleV0pID09ICdzdHJpbmcnKSkge1xuICAgICAgICAgICAgY3VyciA9IGN1cnJba2V5XTtcbiAgICAgICAgICAgIGtleXMgPSBPYmplY3Qua2V5cyhjdXJyKTtcbiAgICAgICAgICAgIGFzc2VydChrZXlzLmxlbmd0aCA9PSAxKTtcbiAgICAgICAgICAgIGtleSA9IGtleXNbMF07XG4gICAgICAgIH1cbiAgICAgICAgdmFyIG5ld1BhcmVudCA9IGN1cnJba2V5XTtcbiAgICAgICAgdmFyIG5ld09iaiA9IHt9O1xuICAgICAgICBjdXJyW2tleV0gPSBuZXdPYmo7XG4gICAgICAgIG5ld09ialtuZXdQYXJlbnRdID0gb2JqO1xuICAgICAgICByZXR1cm4gcm9vdDtcbiAgICB9LFxuICAgIF9lbWJlZERhdGE6IGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgICAgIGlmICh0aGlzLmRhdGEpIHtcbiAgICAgICAgICAgIHZhciBuZXN0ZWQ7XG4gICAgICAgICAgICBpZiAodHlwZW9mKHRoaXMuZGF0YSkgPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICBuZXN0ZWQgPSB7fTtcbiAgICAgICAgICAgICAgICBuZXN0ZWRbdGhpcy5kYXRhXSA9IGRhdGE7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIG5lc3RlZCA9IHRoaXMuYnVyeShkYXRhLCBleHRlbmQodHJ1ZSwge30sIHRoaXMuZGF0YSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIG5lc3RlZDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBkYXRhO1xuICAgICAgICB9XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBJZiBuZXN0ZWQgZGF0YSBoYXMgYmVlbiBzcGVjaWZpZWQgaW4gdGhlIGRlc2NyaXB0b3IsIGV4dHJhY3QgdGhlIGRhdGEuXG4gICAgICogQHBhcmFtICB7T2JqZWN0fSBkYXRhXG4gICAgICogQHJldHVybiB7T2JqZWN0fVxuICAgICAqL1xuICAgIF9leHRyYWN0RGF0YTogZnVuY3Rpb24gKGRhdGEpIHtcbiAgICAgICAgaWYgKExvZ2dlci5kZWJ1Zy5pc0VuYWJsZWQpXG4gICAgICAgICAgICBMb2dnZXIuZGVidWcoJ19leHRyYWN0RGF0YScsIGRhdGEpO1xuICAgICAgICBpZiAodGhpcy5kYXRhKSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mKHRoaXMuZGF0YSkgPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZGF0YVt0aGlzLmRhdGFdO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB2YXIga2V5cyA9IE9iamVjdC5rZXlzKHRoaXMuZGF0YSk7XG4gICAgICAgICAgICAgICAgYXNzZXJ0KGtleXMubGVuZ3RoID09IDEpO1xuICAgICAgICAgICAgICAgIHZhciBjdXJyVGhlaXJzID0gZGF0YTtcbiAgICAgICAgICAgICAgICB2YXIgY3Vyck91cnMgPSB0aGlzLmRhdGE7XG4gICAgICAgICAgICAgICAgd2hpbGUgKHR5cGVvZihjdXJyT3VycykgIT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICAgICAga2V5cyA9IE9iamVjdC5rZXlzKGN1cnJPdXJzKTtcbiAgICAgICAgICAgICAgICAgICAgYXNzZXJ0KGtleXMubGVuZ3RoID09IDEpO1xuICAgICAgICAgICAgICAgICAgICB2YXIga2V5ID0ga2V5c1swXTtcbiAgICAgICAgICAgICAgICAgICAgY3Vyck91cnMgPSBjdXJyT3Vyc1trZXldO1xuICAgICAgICAgICAgICAgICAgICBjdXJyVGhlaXJzID0gY3VyclRoZWlyc1trZXldO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWN1cnJUaGVpcnMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiBjdXJyVGhlaXJzID8gY3VyclRoZWlyc1tjdXJyT3Vyc10gOiBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIGRhdGE7XG4gICAgICAgIH1cbiAgICB9LFxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdGhpcyBkZXNjcmlwdG9ycyBtYXBwaW5nIGlmIHRoZSByZXF1ZXN0IGNvbmZpZyBtYXRjaGVzLlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBjb25maWdcbiAgICAgKiBAcmV0dXJucyB7T2JqZWN0fVxuICAgICAqL1xuICAgIF9tYXRjaENvbmZpZzogZnVuY3Rpb24gKGNvbmZpZykge1xuICAgICAgICB2YXIgbWF0Y2hlcyA9IGNvbmZpZy50eXBlID8gdGhpcy5fbWF0Y2hNZXRob2QoY29uZmlnLnR5cGUpIDoge307XG4gICAgICAgIGlmIChtYXRjaGVzKSB7XG4gICAgICAgICAgICBtYXRjaGVzID0gY29uZmlnLnVybCA/IHRoaXMuX21hdGNoUGF0aChjb25maWcudXJsKSA6IHt9O1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBtYXRjaGVzO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGRhdGEgaWYgdGhlIGRhdGEgbWF0Y2hlcywgcGVyZm9ybWluZyBhbnkgZXh0cmFjdGlvbiBhcyBzcGVjaWZpZWQgaW4gb3B0cy5kYXRhXG4gICAgICpcbiAgICAgKiBAcGFyYW0gIHtPYmplY3R9IGRhdGFcbiAgICAgKiBAcmV0dXJuIHtPYmplY3R9XG4gICAgICovXG4gICAgX21hdGNoRGF0YTogZnVuY3Rpb24gKGRhdGEpIHtcbiAgICAgICAgdmFyIGV4dHJhY3RlZERhdGEgPSBudWxsO1xuICAgICAgICBpZiAodGhpcy5kYXRhKSB7XG4gICAgICAgICAgICBpZiAoZGF0YSkge1xuICAgICAgICAgICAgICAgIGV4dHJhY3RlZERhdGEgPSB0aGlzLl9leHRyYWN0RGF0YShkYXRhKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGV4dHJhY3RlZERhdGEgPSBkYXRhO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBleHRyYWN0ZWREYXRhO1xuICAgIH0sXG4gICAgLyoqXG4gICAgICogQ2hlY2sgaWYgdGhlIEhUVFAgY29uZmlnIGFuZCByZXR1cm5lZCBkYXRhIG1hdGNoIHRoaXMgZGVzY3JpcHRvciBkZWZpbml0aW9uLlxuICAgICAqXG4gICAgICogQHBhcmFtICB7T2JqZWN0fSBjb25maWcgQ29uZmlnIG9iamVjdCBmb3IgJC5hamF4IGFuZCBzaW1pbGFyXG4gICAgICogQHBhcmFtICB7T2JqZWN0fSBkYXRhXG4gICAgICogQHJldHVybiB7T2JqZWN0fSBFeHRyYWN0ZWQgZGF0YVxuICAgICAqL1xuICAgIG1hdGNoOiBmdW5jdGlvbiAoY29uZmlnLCBkYXRhKSB7XG4gICAgICAgIHZhciByZWdleE1hdGNoZXMgPSB0aGlzLl9tYXRjaENvbmZpZyhjb25maWcpO1xuICAgICAgICB2YXIgbWF0Y2hlcyA9ICEhcmVnZXhNYXRjaGVzO1xuICAgICAgICB2YXIgZXh0cmFjdGVkRGF0YSA9IGZhbHNlO1xuICAgICAgICBpZiAobWF0Y2hlcykge1xuICAgICAgICAgICAgZXh0cmFjdGVkRGF0YSA9IHRoaXMuX21hdGNoRGF0YShkYXRhKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZXh0cmFjdGVkRGF0YTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQXBwbHkgYW55IHRyYW5zZm9ybXMuXG4gICAgICogQHBhcmFtICB7T2JqZWN0fSBkYXRhIFNlcmlhbGlzZWQgZGF0YS5cbiAgICAgKiBAcmV0dXJuIHtPYmplY3R9IFNlcmlhbGlzZWQgZGF0YSB3aXRoIGFwcGxpZWQgdHJhbnNmb3JtYXRpb25zLlxuICAgICAqL1xuICAgIF90cmFuc2Zvcm1EYXRhOiBmdW5jdGlvbiAoZGF0YSkge1xuICAgICAgICB2YXIgdHJhbnNmb3JtcyA9IHRoaXMudHJhbnNmb3JtcztcbiAgICAgICAgaWYgKHR5cGVvZih0cmFuc2Zvcm1zKSA9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICBkYXRhID0gdHJhbnNmb3JtcyhkYXRhKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGZvciAodmFyIGF0dHIgaW4gdHJhbnNmb3Jtcykge1xuICAgICAgICAgICAgICAgIGlmICh0cmFuc2Zvcm1zLmhhc093blByb3BlcnR5KGF0dHIpKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChkYXRhW2F0dHJdKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgdHJhbnNmb3JtID0gdHJhbnNmb3Jtc1thdHRyXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciB2YWwgPSBkYXRhW2F0dHJdO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZih0cmFuc2Zvcm0pID09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHNwbGl0ID0gdHJhbnNmb3JtLnNwbGl0KCcuJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVsZXRlIGRhdGFbYXR0cl07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHNwbGl0Lmxlbmd0aCA9PSAxKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdGFbc3BsaXRbMF1dID0gdmFsO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdGFbc3BsaXRbMF1dID0ge307XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBuZXdWYWwgPSBkYXRhW3NwbGl0WzBdXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDE7IGkgPCBzcGxpdC5sZW5ndGggLSAxOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBuZXdBdHRyID0gc3BsaXRbaV07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBuZXdWYWxbbmV3QXR0cl0gPSB7fTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5ld1ZhbCA9IG5ld1ZhbFtuZXdBdHRyXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBuZXdWYWxbc3BsaXRbc3BsaXQubGVuZ3RoIC0gMV1dID0gdmFsO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAodHlwZW9mKHRyYW5zZm9ybSkgPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciB0cmFuc2Zvcm1lZCA9IHRyYW5zZm9ybSh2YWwpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICh1dGlsLmlzQXJyYXkodHJhbnNmb3JtZWQpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlbGV0ZSBkYXRhW2F0dHJdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkYXRhW3RyYW5zZm9ybWVkWzBdXSA9IHRyYW5zZm9ybWVkWzFdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdGFbYXR0cl0gPSB0cmFuc2Zvcm1lZDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdJbnZhbGlkIHRyYW5zZm9ybWVyJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGRhdGE7XG4gICAgfVxufSk7XG5cbmV4cG9ydHMuRGVzY3JpcHRvciA9IERlc2NyaXB0b3I7XG5leHBvcnRzLnJlc29sdmVNZXRob2QgPSByZXNvbHZlTWV0aG9kOyIsInZhciBfaSA9IHNpZXN0YS5faW50ZXJuYWwsXG4gICAgdXRpbCA9IF9pLnV0aWwsXG4gICAgYXNzZXJ0ID0gdXRpbC5hc3NlcnQsXG4gICAgXyA9IHV0aWwuXyxcbiAgICBsb2cgPSBfaS5sb2c7XG5cbnZhciBMb2dnZXIgPSBsb2cubG9nZ2VyV2l0aE5hbWUoJ0Rlc2NyaXB0b3JSZWdpc3RyeScpO1xuTG9nZ2VyLnNldExldmVsKGxvZy5MZXZlbC53YXJuKTtcblxuLyoqXG4gKiBAY2xhc3MgRW50cnkgcG9pbnQgZm9yIGRlc2NyaXB0b3IgcmVnaXN0cmF0aW9uLlxuICogQGNvbnN0cnVjdG9yXG4gKi9cbmZ1bmN0aW9uIERlc2NyaXB0b3JSZWdpc3RyeSgpIHtcbiAgICBpZiAoIXRoaXMpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBEZXNjcmlwdG9yUmVnaXN0cnkob3B0cyk7XG4gICAgfVxuICAgIHRoaXMucmVxdWVzdERlc2NyaXB0b3JzID0ge307XG4gICAgdGhpcy5yZXNwb25zZURlc2NyaXB0b3JzID0ge307XG59XG5cbmZ1bmN0aW9uIF9yZWdpc3RlckRlc2NyaXB0b3IoZGVzY3JpcHRvcnMsIGRlc2NyaXB0b3IpIHtcbiAgICB2YXIgbWFwcGluZyA9IGRlc2NyaXB0b3IubWFwcGluZztcbiAgICB2YXIgY29sbGVjdGlvbiA9IG1hcHBpbmcuY29sbGVjdGlvbjtcbiAgICBhc3NlcnQobWFwcGluZyk7XG4gICAgYXNzZXJ0KGNvbGxlY3Rpb24pO1xuICAgIGFzc2VydCh0eXBlb2YoY29sbGVjdGlvbikgPT0gJ3N0cmluZycpO1xuICAgIGlmICghZGVzY3JpcHRvcnNbY29sbGVjdGlvbl0pIHtcbiAgICAgICAgZGVzY3JpcHRvcnNbY29sbGVjdGlvbl0gPSBbXTtcbiAgICB9XG4gICAgZGVzY3JpcHRvcnNbY29sbGVjdGlvbl0ucHVzaChkZXNjcmlwdG9yKTtcbn1cblxuZnVuY3Rpb24gX2Rlc2NyaXB0b3JzRm9yQ29sbGVjdGlvbihkZXNjcmlwdG9ycywgY29sbGVjdGlvbikge1xuICAgIHZhciBkZXNjcmlwdG9yc0ZvckNvbGxlY3Rpb247XG4gICAgaWYgKHR5cGVvZihjb2xsZWN0aW9uKSA9PSAnc3RyaW5nJykge1xuICAgICAgICBkZXNjcmlwdG9yc0ZvckNvbGxlY3Rpb24gPSBkZXNjcmlwdG9yc1tjb2xsZWN0aW9uXSB8fCBbXTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIGRlc2NyaXB0b3JzRm9yQ29sbGVjdGlvbiA9IChkZXNjcmlwdG9yc1tjb2xsZWN0aW9uLl9uYW1lXSB8fCBbXSk7XG4gICAgfVxuICAgIHJldHVybiBkZXNjcmlwdG9yc0ZvckNvbGxlY3Rpb247XG59XG5cbmNvbnNvbGUubG9nKCdfJywgXyk7XG5cbl8uZXh0ZW5kKERlc2NyaXB0b3JSZWdpc3RyeS5wcm90b3R5cGUsIHtcbiAgICByZWdpc3RlclJlcXVlc3REZXNjcmlwdG9yOiBmdW5jdGlvbiAocmVxdWVzdERlc2NyaXB0b3IpIHtcbiAgICAgICAgX3JlZ2lzdGVyRGVzY3JpcHRvcih0aGlzLnJlcXVlc3REZXNjcmlwdG9ycywgcmVxdWVzdERlc2NyaXB0b3IpO1xuICAgIH0sXG4gICAgcmVnaXN0ZXJSZXNwb25zZURlc2NyaXB0b3I6IGZ1bmN0aW9uIChyZXNwb25zZURlc2NyaXB0b3IpIHtcbiAgICAgICAgaWYgKExvZ2dlci50cmFjZS5pc0VuYWJsZWQpXG4gICAgICAgICAgICBMb2dnZXIudHJhY2UoJ3JlZ2lzdGVyUmVzcG9uc2VEZXNjcmlwdG9yJyk7XG4gICAgICAgIF9yZWdpc3RlckRlc2NyaXB0b3IodGhpcy5yZXNwb25zZURlc2NyaXB0b3JzLCByZXNwb25zZURlc2NyaXB0b3IpO1xuICAgIH0sXG4gICAgcmVxdWVzdERlc2NyaXB0b3JzRm9yQ29sbGVjdGlvbjogZnVuY3Rpb24gKGNvbGxlY3Rpb24pIHtcbiAgICAgICAgcmV0dXJuIF9kZXNjcmlwdG9yc0ZvckNvbGxlY3Rpb24odGhpcy5yZXF1ZXN0RGVzY3JpcHRvcnMsIGNvbGxlY3Rpb24pO1xuICAgIH0sXG4gICAgcmVzcG9uc2VEZXNjcmlwdG9yc0ZvckNvbGxlY3Rpb246IGZ1bmN0aW9uIChjb2xsZWN0aW9uKSB7XG4gICAgICAgIHZhciBkZXNjcmlwdG9yc0ZvckNvbGxlY3Rpb24gPSBfZGVzY3JpcHRvcnNGb3JDb2xsZWN0aW9uKHRoaXMucmVzcG9uc2VEZXNjcmlwdG9ycywgY29sbGVjdGlvbik7XG4gICAgICAgIGlmICghZGVzY3JpcHRvcnNGb3JDb2xsZWN0aW9uLmxlbmd0aCkge1xuICAgICAgICAgICAgaWYgKExvZ2dlci5kZWJ1Zy5pc0VuYWJsZWQpXG4gICAgICAgICAgICAgICAgTG9nZ2VyLmRlYnVnKCdObyByZXNwb25zZSBkZXNjcmlwdG9ycyBmb3IgY29sbGVjdGlvbiAnLCB0aGlzLnJlc3BvbnNlRGVzY3JpcHRvcnMpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBkZXNjcmlwdG9yc0ZvckNvbGxlY3Rpb247XG4gICAgfSxcbiAgICByZXNldDogZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLnJlcXVlc3REZXNjcmlwdG9ycyA9IHt9O1xuICAgICAgICB0aGlzLnJlc3BvbnNlRGVzY3JpcHRvcnMgPSB7fTtcbiAgICB9XG59KTtcblxuZXhwb3J0cy5EZXNjcmlwdG9yUmVnaXN0cnkgPSBuZXcgRGVzY3JpcHRvclJlZ2lzdHJ5KCk7IiwiLyoqXG4gKiBQcm92aXNpb25zIHVzYWdlIG9mICQuYWpheCBhbmQgc2ltaWxhciBmdW5jdGlvbnMgdG8gc2VuZCBIVFRQIHJlcXVlc3RzIG1hcHBpbmdcbiAqIHRoZSByZXN1bHRzIGJhY2sgb250byB0aGUgb2JqZWN0IGdyYXBoIGF1dG9tYXRpY2FsbHkuXG4gKiBAbW9kdWxlIGh0dHBcbiAqL1xuXG5pZiAodHlwZW9mIHNpZXN0YSA9PSAndW5kZWZpbmVkJyAmJiB0eXBlb2YgbW9kdWxlID09ICd1bmRlZmluZWQnKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdDb3VsZCBub3QgZmluZCB3aW5kb3cuc2llc3RhLiBNYWtlIHN1cmUgeW91IGluY2x1ZGUgc2llc3RhLmNvcmUuanMgZmlyc3QuJyk7XG59XG5cbnZhciBfaSA9IHNpZXN0YS5faW50ZXJuYWwsXG4gICAgQ29sbGVjdGlvbiA9IHNpZXN0YS5Db2xsZWN0aW9uLFxuICAgIGxvZyA9IF9pLmxvZyxcbiAgICB1dGlsID0gX2kudXRpbCxcbiAgICBlcnJvciA9IF9pLmVycm9yLFxuICAgIF8gPSB1dGlsLl8sXG4gICAgZGVzY3JpcHRvciA9IHJlcXVpcmUoJy4vZGVzY3JpcHRvcicpLFxuICAgIEludGVybmFsU2llc3RhRXJyb3IgPSBfaS5lcnJvci5JbnRlcm5hbFNpZXN0YUVycm9yO1xuXG52YXIgRGVzY3JpcHRvclJlZ2lzdHJ5ID0gcmVxdWlyZSgnLi9kZXNjcmlwdG9yUmVnaXN0cnknKS5EZXNjcmlwdG9yUmVnaXN0cnk7XG5cblxudmFyIExvZ2dlciA9IGxvZy5sb2dnZXJXaXRoTmFtZSgnSFRUUCcpO1xuTG9nZ2VyLnNldExldmVsKGxvZy5MZXZlbC50cmFjZSk7XG5cbi8qKlxuICogTG9nIGEgSFRUUCByZXNwb25zZVxuICogQHBhcmFtIG9wdHNcbiAqIEBwYXJhbSB4aHJcbiAqIEBwYXJhbSBbZGF0YV0gLSBSYXcgZGF0YSByZWNlaXZlZCBpbiBIVFRQIHJlc3BvbnNlLlxuICovXG5mdW5jdGlvbiBsb2dIdHRwUmVzcG9uc2Uob3B0cywgeGhyLCBkYXRhKSB7XG4gICAgaWYgKExvZ2dlci5kZWJ1Zy5pc0VuYWJsZWQpIHtcbiAgICAgICAgdmFyIGxvZ2dlciA9IExvZ2dlci5kZWJ1ZztcbiAgICAgICAgdmFyIGxvZ01lc3NhZ2UgPSBvcHRzLnR5cGUgKyAnICcgKyB4aHIuc3RhdHVzICsgJyAnICsgb3B0cy51cmw7XG4gICAgICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkICYmIGRhdGEpIHtcbiAgICAgICAgICAgIGxvZ2dlciA9IExvZ2dlci50cmFjZTtcbiAgICAgICAgICAgIGxvZ01lc3NhZ2UgKz0gJzogJyArIEpTT04uc3RyaW5naWZ5KGRhdGEsIG51bGwsIDQpO1xuICAgICAgICB9XG4gICAgICAgIGxvZ2dlcihsb2dNZXNzYWdlKTtcbiAgICB9XG59XG5cbi8qKlxuICogTG9nIGEgSFRUUCByZXF1ZXN0XG4gKiBAcGFyYW0gb3B0c1xuICovXG5mdW5jdGlvbiBsb2dIdHRwUmVxdWVzdChvcHRzKSB7XG4gICAgaWYgKExvZ2dlci5kZWJ1Zy5pc0VuYWJsZWQpIHtcbiAgICAgICAgdmFyIGxvZ2dlciA9IExvZ2dlci5kZWJ1ZztcbiAgICAgICAgLy8gVE9ETzogQXBwZW5kIHF1ZXJ5IHBhcmFtZXRlcnMgdG8gdGhlIFVSTC5cbiAgICAgICAgdmFyIGxvZ01lc3NhZ2UgPSBvcHRzLnR5cGUgKyAnICcgKyBvcHRzLnVybDtcbiAgICAgICAgaWYgKExvZ2dlci50cmFjZS5pc0VuYWJsZWQpIHtcbiAgICAgICAgICAgIC8vIFRPRE86IElmIGFueSBkYXRhIGlzIGJlaW5nIHNlbnQsIGxvZyB0aGF0LlxuICAgICAgICAgICAgbG9nZ2VyID0gTG9nZ2VyLnRyYWNlO1xuICAgICAgICB9XG4gICAgICAgIGxvZ2dlcihsb2dNZXNzYWdlKTtcbiAgICB9XG59XG5cblxuXG4vKipcbiAqIFNlbmQgYSBIVFRQIHJlcXVlc3QgdG8gdGhlIGdpdmVuIG1ldGhvZCBhbmQgcGF0aCBwYXJzaW5nIHRoZSByZXNwb25zZS5cbiAqIEBwYXJhbSB7U3RyaW5nfSBtZXRob2RcbiAqIEBwYXJhbSB7U3RyaW5nfSBwYXRoIFRoZSBwYXRoIHRvIHRoZSByZXNvdXJjZSB3ZSB3YW50IHRvIEdFVFxuICogQHBhcmFtIHtPYmplY3R8RnVuY3Rpb259IG9wdHNPckNhbGxiYWNrIEVpdGhlciBhbiBvcHRpb25zIG9iamVjdCBvciBhIGNhbGxiYWNrIGlmIGNhbiB1c2UgZGVmYXVsdHNcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIENhbGxiYWNrIGlmIG9wdHMgc3BlY2lmaWVkLlxuICovXG5mdW5jdGlvbiBfaHR0cFJlc3BvbnNlKG1ldGhvZCwgcGF0aCwgb3B0c09yQ2FsbGJhY2ssIGNhbGxiYWNrKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAyKTtcbiAgICB2YXIgb3B0cyA9IHt9O1xuICAgIHZhciBuYW1lID0gdGhpcy5fbmFtZTtcbiAgICBpZiAodHlwZW9mKGFyZ3NbMF0pID09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgY2FsbGJhY2sgPSBhcmdzWzBdO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mKGFyZ3NbMF0pID09ICdvYmplY3QnKSB7XG4gICAgICAgIG9wdHMgPSBhcmdzWzBdO1xuICAgICAgICBjYWxsYmFjayA9IGFyZ3NbMV07XG4gICAgfVxuICAgIHZhciBkZWZlcnJlZCA9IHdpbmRvdy5xID8gd2luZG93LnEuZGVmZXIoKSA6IG51bGw7XG4gICAgY2FsbGJhY2sgPSB1dGlsLmNvbnN0cnVjdENhbGxiYWNrQW5kUHJvbWlzZUhhbmRsZXIoY2FsbGJhY2ssIGRlZmVycmVkKTtcbiAgICBvcHRzLnR5cGUgPSBtZXRob2Q7XG4gICAgaWYgKCFvcHRzLnVybCkgeyAvLyBBbGxvdyBvdmVycmlkZXMuXG4gICAgICAgIHZhciBiYXNlVVJMID0gdGhpcy5iYXNlVVJMO1xuICAgICAgICBvcHRzLnVybCA9IGJhc2VVUkwgKyBwYXRoO1xuICAgIH1cbiAgICBpZiAob3B0cy5wYXJzZVJlc3BvbnNlID09PSB1bmRlZmluZWQpIG9wdHMucGFyc2VSZXNwb25zZSA9IHRydWU7XG4gICAgb3B0cy5zdWNjZXNzID0gZnVuY3Rpb24gKGRhdGEsIHN0YXR1cywgeGhyKSB7XG4gICAgICAgIGxvZ0h0dHBSZXNwb25zZShvcHRzLCB4aHIsIGRhdGEpO1xuICAgICAgICB2YXIgcmVzcCA9IHtcbiAgICAgICAgICAgIGRhdGE6IGRhdGEsXG4gICAgICAgICAgICBzdGF0dXM6IHN0YXR1cyxcbiAgICAgICAgICAgIHhocjogeGhyXG4gICAgICAgIH07XG4gICAgICAgIGlmIChvcHRzLnBhcnNlUmVzcG9uc2UpIHtcbiAgICAgICAgICAgIHZhciBkZXNjcmlwdG9ycyA9IERlc2NyaXB0b3JSZWdpc3RyeS5yZXNwb25zZURlc2NyaXB0b3JzRm9yQ29sbGVjdGlvbihzZWxmKTtcbiAgICAgICAgICAgIHZhciBtYXRjaGVkRGVzY3JpcHRvcjtcbiAgICAgICAgICAgIHZhciBleHRyYWN0ZWREYXRhO1xuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBkZXNjcmlwdG9ycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIHZhciBkZXNjcmlwdG9yID0gZGVzY3JpcHRvcnNbaV07XG4gICAgICAgICAgICAgICAgZXh0cmFjdGVkRGF0YSA9IGRlc2NyaXB0b3IubWF0Y2gob3B0cywgZGF0YSk7XG4gICAgICAgICAgICAgICAgaWYgKGV4dHJhY3RlZERhdGEpIHtcbiAgICAgICAgICAgICAgICAgICAgbWF0Y2hlZERlc2NyaXB0b3IgPSBkZXNjcmlwdG9yO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAobWF0Y2hlZERlc2NyaXB0b3IpIHtcbiAgICAgICAgICAgICAgICBpZiAoTG9nZ2VyLnRyYWNlLmlzRW5hYmxlZCkge1xuICAgICAgICAgICAgICAgICAgICBMb2dnZXIudHJhY2UoJ01hcHBpbmcgZXh0cmFjdGVkIGRhdGE6ICcgKyBKU09OLnN0cmluZ2lmeShleHRyYWN0ZWREYXRhLCBudWxsLCA0KSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YoZXh0cmFjdGVkRGF0YSkgPT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIG1hcHBpbmcgPSBtYXRjaGVkRGVzY3JpcHRvci5tYXBwaW5nO1xuICAgICAgICAgICAgICAgICAgICBtYXBwaW5nLm1hcChleHRyYWN0ZWREYXRhLCBmdW5jdGlvbiAoZXJyLCBvYmopIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjYWxsYmFjaykge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyLCBvYmosIHJlc3ApO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9LCBvcHRzLm9iaik7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHsgLy8gTWF0Y2hlZCwgYnV0IG5vIGRhdGEuXG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIHRydWUsIHJlc3ApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAoY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICBpZiAobmFtZSkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgZXJyID0ge307XG4gICAgICAgICAgICAgICAgICAgIHZhciBjb2RlID0gZXJyb3IuRXJyb3JDb2RlLk5vRGVzY3JpcHRvck1hdGNoZWQ7XG4gICAgICAgICAgICAgICAgICAgIGVycltlcnJvci5FcnJvckZpZWxkLkNvZGVdID0gY29kZTtcbiAgICAgICAgICAgICAgICAgICAgZXJyW2Vycm9yLkVycm9yRmllbGQuTWVzc2FnZV0gPSBlcnJvci5NZXNzYWdlW2NvZGVdO1xuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIsIG51bGwsIHJlc3ApO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFRoZXJlIHdhcyBhIGJ1ZyB3aGVyZSBjb2xsZWN0aW9uIG5hbWUgZG9lc24ndCBleGlzdC4gSWYgdGhpcyBvY2N1cnMsIHRoZW4gd2lsbCBuZXZlciBnZXQgaG9sZCBvZiBhbnkgZGVzY3JpcHRvcnMuXG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdVbm5hbWVkIGNvbGxlY3Rpb24nKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjYWxsYmFjayhudWxsLCBudWxsLCByZXNwKTtcbiAgICAgICAgfVxuXG4gICAgfTtcbiAgICBvcHRzLmVycm9yID0gZnVuY3Rpb24gKHhociwgc3RhdHVzLCBlcnJvcikge1xuICAgICAgICB2YXIgcmVzcCA9IHtcbiAgICAgICAgICAgIHhocjogeGhyLFxuICAgICAgICAgICAgc3RhdHVzOiBzdGF0dXMsXG4gICAgICAgICAgICBlcnJvcjogZXJyb3JcbiAgICAgICAgfTtcbiAgICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhyZXNwLCBudWxsLCByZXNwKTtcbiAgICB9O1xuICAgIGxvZ0h0dHBSZXF1ZXN0KG9wdHMpO1xuICAgIHNpZXN0YS5leHQuaHR0cC5hamF4KG9wdHMpO1xufVxuXG5mdW5jdGlvbiBfc2VyaWFsaXNlT2JqZWN0KG9wdHMsIG9iaiwgY2IpIHtcbiAgICB0aGlzLl9zZXJpYWxpc2Uob2JqLCBmdW5jdGlvbiAoZXJyLCBkYXRhKSB7XG4gICAgICAgIHZhciByZXREYXRhID0gZGF0YTtcbiAgICAgICAgaWYgKG9wdHMuZmllbGRzKSB7XG4gICAgICAgICAgICByZXREYXRhID0ge307XG4gICAgICAgICAgICBfLmVhY2gob3B0cy5maWVsZHMsIGZ1bmN0aW9uIChmKSB7XG4gICAgICAgICAgICAgICAgcmV0RGF0YVtmXSA9IGRhdGFbZl07XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBjYihlcnIsIHJldERhdGEpO1xuICAgIH0pO1xufVxuXG4vKipcbiAqIFNlbmQgYSBIVFRQIHJlcXVlc3QgdG8gdGhlIGdpdmVuIG1ldGhvZCBhbmQgcGF0aFxuICogQHBhcmFtIHtTdHJpbmd9IG1ldGhvZFxuICogQHBhcmFtIHtTdHJpbmd9IHBhdGggVGhlIHBhdGggdG8gdGhlIHJlc291cmNlIHdlIHdhbnQgdG8gR0VUXG4gKiBAcGFyYW0ge1NpZXN0YU1vZGVsfSBvYmplY3QgVGhlIG1vZGVsIHdlJ3JlIHB1c2hpbmcgdG8gdGhlIHNlcnZlclxuICogQHBhcmFtIHtPYmplY3R8RnVuY3Rpb259IG9wdHNPckNhbGxiYWNrIEVpdGhlciBhbiBvcHRpb25zIG9iamVjdCBvciBhIGNhbGxiYWNrIGlmIGNhbiB1c2UgZGVmYXVsdHNcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIENhbGxiYWNrIGlmIG9wdHMgc3BlY2lmaWVkLlxuICovXG5mdW5jdGlvbiBfaHR0cFJlcXVlc3QobWV0aG9kLCBwYXRoLCBvYmplY3QpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDMpO1xuICAgIHZhciBjYWxsYmFjaztcbiAgICB2YXIgb3B0cyA9IHt9O1xuICAgIGlmICh0eXBlb2YoYXJnc1swXSkgPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICBjYWxsYmFjayA9IGFyZ3NbMF07XG4gICAgfSBlbHNlIGlmICh0eXBlb2YoYXJnc1swXSkgPT0gJ29iamVjdCcpIHtcbiAgICAgICAgb3B0cyA9IGFyZ3NbMF07XG4gICAgICAgIGNhbGxiYWNrID0gYXJnc1sxXTtcbiAgICB9XG4gICAgdmFyIGRlZmVycmVkID0gd2luZG93LnEgPyB3aW5kb3cucS5kZWZlcigpIDogbnVsbDtcbiAgICBjYWxsYmFjayA9IHV0aWwuY29uc3RydWN0Q2FsbGJhY2tBbmRQcm9taXNlSGFuZGxlcihjYWxsYmFjaywgZGVmZXJyZWQpO1xuICAgIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmdzLCAyKTtcbiAgICB2YXIgcmVxdWVzdERlc2NyaXB0b3JzID0gRGVzY3JpcHRvclJlZ2lzdHJ5LnJlcXVlc3REZXNjcmlwdG9yc0ZvckNvbGxlY3Rpb24odGhpcyk7XG4gICAgdmFyIG1hdGNoZWREZXNjcmlwdG9yO1xuICAgIG9wdHMudHlwZSA9IG1ldGhvZDtcbiAgICB2YXIgYmFzZVVSTCA9IHRoaXMuYmFzZVVSTDtcbiAgICBvcHRzLnVybCA9IGJhc2VVUkwgKyBwYXRoO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcmVxdWVzdERlc2NyaXB0b3JzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciByZXF1ZXN0RGVzY3JpcHRvciA9IHJlcXVlc3REZXNjcmlwdG9yc1tpXTtcbiAgICAgICAgaWYgKHJlcXVlc3REZXNjcmlwdG9yLl9tYXRjaENvbmZpZyhvcHRzKSkge1xuICAgICAgICAgICAgbWF0Y2hlZERlc2NyaXB0b3IgPSByZXF1ZXN0RGVzY3JpcHRvcjtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgfVxuICAgIGlmIChtYXRjaGVkRGVzY3JpcHRvcikge1xuICAgICAgICBpZiAoTG9nZ2VyLnRyYWNlLmlzRW5hYmxlZClcbiAgICAgICAgICAgIExvZ2dlci50cmFjZSgnTWF0Y2hlZCBkZXNjcmlwdG9yOiAnICsgbWF0Y2hlZERlc2NyaXB0b3IuX2R1bXAodHJ1ZSkpO1xuICAgICAgICBfc2VyaWFsaXNlT2JqZWN0LmNhbGwobWF0Y2hlZERlc2NyaXB0b3IsIG9iamVjdCwgb3B0cywgZnVuY3Rpb24gKGVyciwgZGF0YSkge1xuICAgICAgICAgICAgaWYgKExvZ2dlci50cmFjZS5pc0VuYWJsZWQpXG4gICAgICAgICAgICAgICAgTG9nZ2VyLnRyYWNlKCdfc2VyaWFsaXNlJywge1xuICAgICAgICAgICAgICAgICAgICBlcnI6IGVycixcbiAgICAgICAgICAgICAgICAgICAgZGF0YTogZGF0YVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2soZXJyLCBudWxsLCBudWxsKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgb3B0cy5kYXRhID0gZGF0YTtcbiAgICAgICAgICAgICAgICBvcHRzLm9iaiA9IG9iamVjdDtcbiAgICAgICAgICAgICAgICBfLnBhcnRpYWwoX2h0dHBSZXNwb25zZSwgbWV0aG9kLCBwYXRoLCBvcHRzLCBjYWxsYmFjaykuYXBwbHkoc2VsZiwgYXJncyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgfSBlbHNlIGlmIChjYWxsYmFjaykge1xuICAgICAgICBpZiAoTG9nZ2VyLnRyYWNlLmlzRW5hYmxlZClcbiAgICAgICAgICAgIExvZ2dlci50cmFjZSgnRGlkIG5vdCBtYXRjaCBkZXNjcmlwdG9yJyk7XG4gICAgICAgIGNhbGxiYWNrKCdObyBkZXNjcmlwdG9yIG1hdGNoZWQnLCBudWxsLCBudWxsKTtcbiAgICB9XG4gICAgcmV0dXJuIGRlZmVycmVkID8gZGVmZXJyZWQucHJvbWlzZSA6IG51bGw7XG59XG5cbi8qKlxuICogU2VuZCBhIERFTEVURSByZXF1ZXN0LiBBbHNvIHJlbW92ZXMgdGhlIG9iamVjdC5cbiAqIEBwYXJhbSB7Q29sbGVjdGlvbn0gY29sbGVjdGlvblxuICogQHBhcmFtIHtTdHJpbmd9IHBhdGggVGhlIHBhdGggdG8gdGhlIHJlc291cmNlIHRvIHdoaWNoIHdlIHdhbnQgdG8gREVMRVRFXG4gKiBAcGFyYW0ge1NpZXN0YU1vZGVsfSBvYmplY3QgVGhlIG1vZGVsIHRoYXQgd2Ugd291bGQgbGlrZSB0byBQQVRDSFxuICogQHJldHVybnMge1Byb21pc2V9XG4gKi9cbmZ1bmN0aW9uIERFTEVURShjb2xsZWN0aW9uLCBwYXRoLCBvYmplY3QpIHtcbiAgICB2YXIgZGVmZXJyZWQgPSB3aW5kb3cucSA/IHdpbmRvdy5xLmRlZmVyKCkgOiBudWxsO1xuICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAzKTtcbiAgICB2YXIgb3B0cyA9IHt9O1xuICAgIHZhciBjYWxsYmFjaztcbiAgICBpZiAodHlwZW9mKGFyZ3NbMF0pID09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgY2FsbGJhY2sgPSBhcmdzWzBdO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mKGFyZ3NbMF0pID09ICdvYmplY3QnKSB7XG4gICAgICAgIG9wdHMgPSBhcmdzWzBdO1xuICAgICAgICBjYWxsYmFjayA9IGFyZ3NbMV07XG4gICAgfVxuICAgIGNhbGxiYWNrID0gdXRpbC5jb25zdHJ1Y3RDYWxsYmFja0FuZFByb21pc2VIYW5kbGVyKGNhbGxiYWNrLCBkZWZlcnJlZCk7XG4gICAgdmFyIGRlbGV0aW9uTW9kZSA9IG9wdHMuZGVsZXRpb25Nb2RlIHx8ICdyZXN0b3JlJztcbiAgICAvLyBCeSBkZWZhdWx0IHdlIGRvIG5vdCBtYXAgdGhlIHJlc3BvbnNlIGZyb20gYSBERUxFVEUgcmVxdWVzdC5cbiAgICBpZiAob3B0cy5wYXJzZVJlc3BvbnNlID09PSB1bmRlZmluZWQpIG9wdHMucGFyc2VSZXNwb25zZSA9IGZhbHNlO1xuICAgIF9odHRwUmVzcG9uc2UuY2FsbChjb2xsZWN0aW9uLCAnREVMRVRFJywgcGF0aCwgb3B0cywgZnVuY3Rpb24gKGVyciwgeCwgeSwgeikge1xuICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICBpZiAoZGVsZXRpb25Nb2RlID09ICdyZXN0b3JlJykge1xuICAgICAgICAgICAgICAgIG9iamVjdC5yZXN0b3JlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAoZGVsZXRpb25Nb2RlID09ICdzdWNjZXNzJykge1xuICAgICAgICAgICAgb2JqZWN0LnJlbW92ZSgpO1xuICAgICAgICB9XG4gICAgICAgIGNhbGxiYWNrKGVyciwgeCwgeSwgeik7XG4gICAgfSk7XG4gICAgaWYgKGRlbGV0aW9uTW9kZSA9PSAnbm93JyB8fCBkZWxldGlvbk1vZGUgPT0gJ3Jlc3RvcmUnKSB7XG4gICAgICAgIG9iamVjdC5yZW1vdmUoKTtcbiAgICB9XG4gICAgcmV0dXJuIGRlZmVycmVkID8gZGVmZXJyZWQucHJvbWlzZSA6IG51bGw7XG59XG5cbi8qKlxuICogU2VuZCBhIEhUVFAgcmVxdWVzdCB1c2luZyB0aGUgZ2l2ZW4gbWV0aG9kXG4gKiBAcGFyYW0ge0NvbGxlY3Rpb259IGNvbGxlY3Rpb25cbiAqIEBwYXJhbSByZXF1ZXN0IERvZXMgdGhlIHJlcXVlc3QgY29udGFpbiBkYXRhPyBlLmcuIFBPU1QvUEFUQ0gvUFVUIHdpbGwgYmUgdHJ1ZSwgR0VUIHdpbGwgZmFsc2VcbiAqIEBwYXJhbSBtZXRob2RcbiAqIEBpbnRlcm5hbFxuICogQHJldHVybnMge1Byb21pc2V9XG4gKi9cbmZ1bmN0aW9uIEhUVFBfTUVUSE9EKGNvbGxlY3Rpb24sIHJlcXVlc3QsIG1ldGhvZCkge1xuICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAzKTtcbiAgICByZXR1cm4gXy5wYXJ0aWFsKHJlcXVlc3QgPyBfaHR0cFJlcXVlc3QgOiBfaHR0cFJlc3BvbnNlLCBtZXRob2QpLmFwcGx5KGNvbGxlY3Rpb24sIGFyZ3MpO1xufVxuXG4vKipcbiAqIFNlbmQgYSBHRVQgcmVxdWVzdFxuICogQHBhcmFtIHtDb2xsZWN0aW9ufSBjb2xsZWN0aW9uXG4gKiBAcGFyYW0ge1N0cmluZ30gcGF0aCBUaGUgcGF0aCB0byB0aGUgcmVzb3VyY2Ugd2Ugd2FudCB0byBHRVRcbiAqIEBwYXJhbSB7T2JqZWN0fEZ1bmN0aW9ufSBvcHRzT3JDYWxsYmFjayBFaXRoZXIgYW4gb3B0aW9ucyBvYmplY3Qgb3IgYSBjYWxsYmFjayBpZiBjYW4gdXNlIGRlZmF1bHRzXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBDYWxsYmFjayBpZiBvcHRzIHNwZWNpZmllZC5cbiAqIEBwYWNrYWdlIEhUVFBcbiAqIEByZXR1cm5zIHtQcm9taXNlfVxuICovXG5mdW5jdGlvbiBHRVQoY29sbGVjdGlvbikge1xuICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICByZXR1cm4gXy5wYXJ0aWFsKEhUVFBfTUVUSE9ELCBjb2xsZWN0aW9uLCBmYWxzZSwgJ0dFVCcpLmFwcGx5KHRoaXMsIGFyZ3MpO1xufVxuXG4vKipcbiAqIFNlbmQgYW4gT1BUSU9OUyByZXF1ZXN0XG4gKiBAcGFyYW0ge0NvbGxlY3Rpb259IGNvbGxlY3Rpb25cbiAqIEBwYXJhbSB7U3RyaW5nfSBwYXRoIFRoZSBwYXRoIHRvIHRoZSByZXNvdXJjZSB3ZSB3YW50IHRvIEdFVFxuICogQHBhcmFtIHtPYmplY3R8RnVuY3Rpb259IG9wdHNPckNhbGxiYWNrIEVpdGhlciBhbiBvcHRpb25zIG9iamVjdCBvciBhIGNhbGxiYWNrIGlmIGNhbiB1c2UgZGVmYXVsdHNcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIENhbGxiYWNrIGlmIG9wdHMgc3BlY2lmaWVkLlxuICogQHBhY2thZ2UgSFRUUFxuICogQHJldHVybnMge1Byb21pc2V9XG4gKi9cbmZ1bmN0aW9uIE9QVElPTlMoY29sbGVjdGlvbikge1xuICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICByZXR1cm4gXy5wYXJ0aWFsKEhUVFBfTUVUSE9ELCBjb2xsZWN0aW9uLCBmYWxzZSwgJ09QVElPTlMnKS5hcHBseSh0aGlzLCBhcmdzKTtcbn1cblxuLyoqXG4gKiBTZW5kIGFuIFRSQUNFIHJlcXVlc3RcbiAqIEBwYXJhbSB7Q29sbGVjdGlvbn0gY29sbGVjdGlvblxuICogQHBhcmFtIHtTdHJpbmd9IHBhdGggVGhlIHBhdGggdG8gdGhlIHJlc291cmNlIHdlIHdhbnQgdG8gR0VUXG4gKiBAcGFyYW0ge09iamVjdHxGdW5jdGlvbn0gb3B0c09yQ2FsbGJhY2sgRWl0aGVyIGFuIG9wdGlvbnMgb2JqZWN0IG9yIGEgY2FsbGJhY2sgaWYgY2FuIHVzZSBkZWZhdWx0c1xuICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgQ2FsbGJhY2sgaWYgb3B0cyBzcGVjaWZpZWQuXG4gKiBAcGFja2FnZSBIVFRQXG4gKiBAcmV0dXJucyB7UHJvbWlzZX1cbiAqL1xuZnVuY3Rpb24gVFJBQ0UoY29sbGVjdGlvbikge1xuICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICByZXR1cm4gXy5wYXJ0aWFsKEhUVFBfTUVUSE9ELCBjb2xsZWN0aW9uLCBmYWxzZSwgJ1RSQUNFJykuYXBwbHkodGhpcywgYXJncyk7XG59XG5cbi8qKlxuICogU2VuZCBhbiBIRUFEIHJlcXVlc3RcbiAqIEBwYXJhbSB7Q29sbGVjdGlvbn0gY29sbGVjdGlvblxuICogQHBhcmFtIHtTdHJpbmd9IHBhdGggVGhlIHBhdGggdG8gdGhlIHJlc291cmNlIHdlIHdhbnQgdG8gR0VUXG4gKiBAcGFyYW0ge09iamVjdHxGdW5jdGlvbn0gb3B0c09yQ2FsbGJhY2sgRWl0aGVyIGFuIG9wdGlvbnMgb2JqZWN0IG9yIGEgY2FsbGJhY2sgaWYgY2FuIHVzZSBkZWZhdWx0c1xuICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgQ2FsbGJhY2sgaWYgb3B0cyBzcGVjaWZpZWQuXG4gKiBAcGFja2FnZSBIVFRQXG4gKiBAcmV0dXJucyB7UHJvbWlzZX1cbiAqL1xuZnVuY3Rpb24gSEVBRChjb2xsZWN0aW9uKSB7XG4gICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgIHJldHVybiBfLnBhcnRpYWwoSFRUUF9NRVRIT0QsIGNvbGxlY3Rpb24sIGZhbHNlLCAnSEVBRCcpLmFwcGx5KHRoaXMsIGFyZ3MpO1xufVxuXG4vKipcbiAqIFNlbmQgYW4gUE9TVCByZXF1ZXN0XG4gKiBAcGFyYW0ge0NvbGxlY3Rpb259IGNvbGxlY3Rpb25cbiAqIEBwYXJhbSB7U3RyaW5nfSBwYXRoIFRoZSBwYXRoIHRvIHRoZSByZXNvdXJjZSB3ZSB3YW50IHRvIEdFVFxuICogQHBhcmFtIHtTaWVzdGFNb2RlbH0gbW9kZWwgVGhlIG1vZGVsIHRoYXQgd2Ugd291bGQgbGlrZSB0byBQT1NUXG4gKiBAcGFyYW0ge09iamVjdHxGdW5jdGlvbn0gb3B0c09yQ2FsbGJhY2sgRWl0aGVyIGFuIG9wdGlvbnMgb2JqZWN0IG9yIGEgY2FsbGJhY2sgaWYgY2FuIHVzZSBkZWZhdWx0c1xuICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgQ2FsbGJhY2sgaWYgb3B0cyBzcGVjaWZpZWQuXG4gKiBAcGFja2FnZSBIVFRQXG4gKiBAcmV0dXJucyB7UHJvbWlzZX1cbiAqL1xuZnVuY3Rpb24gUE9TVChjb2xsZWN0aW9uKSB7XG4gICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgIHJldHVybiBfLnBhcnRpYWwoSFRUUF9NRVRIT0QsIGNvbGxlY3Rpb24sIHRydWUsICdQT1NUJykuYXBwbHkodGhpcywgYXJncyk7XG59XG5cbi8qKlxuICogU2VuZCBhbiBQVVQgcmVxdWVzdFxuICogQHBhcmFtIHtDb2xsZWN0aW9ufSBjb2xsZWN0aW9uXG4gKiBAcGFyYW0ge1N0cmluZ30gcGF0aCBUaGUgcGF0aCB0byB0aGUgcmVzb3VyY2Ugd2Ugd2FudCB0byBHRVRcbiAqIEBwYXJhbSB7U2llc3RhTW9kZWx9IG1vZGVsIFRoZSBtb2RlbCB0aGF0IHdlIHdvdWxkIGxpa2UgdG8gUE9TVFxuICogQHBhcmFtIHtPYmplY3R8RnVuY3Rpb259IG9wdHNPckNhbGxiYWNrIEVpdGhlciBhbiBvcHRpb25zIG9iamVjdCBvciBhIGNhbGxiYWNrIGlmIGNhbiB1c2UgZGVmYXVsdHNcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIENhbGxiYWNrIGlmIG9wdHMgc3BlY2lmaWVkLlxuICogQHBhY2thZ2UgSFRUUFxuICogQHJldHVybnMge1Byb21pc2V9XG4gKi9cbmZ1bmN0aW9uIFBVVChjb2xsZWN0aW9uKSB7XG4gICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgIHJldHVybiBfLnBhcnRpYWwoSFRUUF9NRVRIT0QsIGNvbGxlY3Rpb24sIHRydWUsICdQVVQnKS5hcHBseSh0aGlzLCBhcmdzKTtcbn1cblxuLyoqXG4gKiBTZW5kIGFuIFBBVENIIHJlcXVlc3RcbiAqIEBwYXJhbSB7Q29sbGVjdGlvbn0gY29sbGVjdGlvblxuICogQHBhcmFtIHtTdHJpbmd9IHBhdGggVGhlIHBhdGggdG8gdGhlIHJlc291cmNlIHdlIHdhbnQgdG8gR0VUXG4gKiBAcGFyYW0ge1NpZXN0YU1vZGVsfSBtb2RlbCBUaGUgbW9kZWwgdGhhdCB3ZSB3b3VsZCBsaWtlIHRvIFBPU1RcbiAqIEBwYXJhbSB7T2JqZWN0fEZ1bmN0aW9ufSBvcHRzT3JDYWxsYmFjayBFaXRoZXIgYW4gb3B0aW9ucyBvYmplY3Qgb3IgYSBjYWxsYmFjayBpZiBjYW4gdXNlIGRlZmF1bHRzXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBDYWxsYmFjayBpZiBvcHRzIHNwZWNpZmllZC5cbiAqIEBwYWNrYWdlIEhUVFBcbiAqIEByZXR1cm5zIHtQcm9taXNlfVxuICovXG5mdW5jdGlvbiBQQVRDSChjb2xsZWN0aW9uKSB7XG4gICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgIHJldHVybiBfLnBhcnRpYWwoSFRUUF9NRVRIT0QsIGNvbGxlY3Rpb24sIHRydWUsICdQQVRDSCcpLmFwcGx5KHRoaXMsIGFyZ3MpO1xufVxuXG5cbnZhciBhamF4O1xuXG5cbnZhciBodHRwID0ge1xuICAgIFJlcXVlc3REZXNjcmlwdG9yOiByZXF1aXJlKCcuL3JlcXVlc3REZXNjcmlwdG9yJykuUmVxdWVzdERlc2NyaXB0b3IsXG4gICAgUmVzcG9uc2VEZXNjcmlwdG9yOiByZXF1aXJlKCcuL3Jlc3BvbnNlRGVzY3JpcHRvcicpLlJlc3BvbnNlRGVzY3JpcHRvcixcbiAgICBEZXNjcmlwdG9yOiBkZXNjcmlwdG9yLkRlc2NyaXB0b3IsXG4gICAgX3Jlc29sdmVNZXRob2Q6IGRlc2NyaXB0b3IucmVzb2x2ZU1ldGhvZCxcbiAgICBTZXJpYWxpc2VyOiByZXF1aXJlKCcuL3NlcmlhbGlzZXInKSxcbiAgICBEZXNjcmlwdG9yUmVnaXN0cnk6IHJlcXVpcmUoJy4vZGVzY3JpcHRvclJlZ2lzdHJ5JykuRGVzY3JpcHRvclJlZ2lzdHJ5LFxuICAgIHNldEFqYXg6IGZ1bmN0aW9uIChfYWpheCkge1xuICAgICAgICBhamF4ID0gX2FqYXg7XG4gICAgfSxcbiAgICBfaHR0cFJlc3BvbnNlOiBfaHR0cFJlc3BvbnNlLFxuICAgIF9odHRwUmVxdWVzdDogX2h0dHBSZXF1ZXN0LFxuICAgIERFTEVURTogREVMRVRFLFxuICAgIEhUVFBfTUVUSE9EOiBIVFRQX01FVEhPRCxcbiAgICBHRVQ6IEdFVCxcbiAgICBUUkFDRTogVFJBQ0UsXG4gICAgT1BUSU9OUzogT1BUSU9OUyxcbiAgICBIRUFEOiBIRUFELFxuICAgIFBPU1Q6IFBPU1QsXG4gICAgUFVUOiBQVVQsXG4gICAgUEFUQ0g6IFBBVENILFxuICAgIF9zZXJpYWxpc2VPYmplY3Q6IF9zZXJpYWxpc2VPYmplY3Rcbn07XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShodHRwLCAnYWpheCcsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIGEgPSBhamF4IHx8ICgkID8gJC5hamF4IDogbnVsbCkgfHwgKGpRdWVyeSA/IGpRdWVyeS5hamF4IDogbnVsbCk7XG4gICAgICAgIGlmICghYSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ2FqYXggaGFzIG5vdCBiZWVuIGRlZmluZWQgYW5kIGNvdWxkIG5vdCBmaW5kICQuYWpheCBvciBqUXVlcnkuYWpheCcpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBhO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbiAodikge1xuICAgICAgICBhamF4ID0gdjtcbiAgICB9XG59KTtcblxuaWYgKHR5cGVvZiBzaWVzdGEgIT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBpZiAoIXNpZXN0YS5leHQpIHtcbiAgICAgICAgc2llc3RhLmV4dCA9IHt9O1xuICAgIH1cbiAgICBzaWVzdGEuZXh0Lmh0dHAgPSBodHRwO1xufVxuXG5pZiAodHlwZW9mIG1vZHVsZSAhPSAndW5kZWZpbmVkJykge1xuICAgIG1vZHVsZS5leHBvcnRzID0gaHR0cDtcbn0iLCIvKipcbiAqIEBtb2R1bGUgaHR0cFxuICovXG5cbnZhciBEZXNjcmlwdG9yID0gcmVxdWlyZSgnLi9kZXNjcmlwdG9yJykuRGVzY3JpcHRvclxuICAgICwgU2VyaWFsaXNlciA9IHJlcXVpcmUoJy4vc2VyaWFsaXNlcicpO1xuXG52YXIgX2kgPSBzaWVzdGEuX2ludGVybmFsXG4gICAgLCB1dGlsID0gX2kudXRpbFxuICAgICwgXyA9IHV0aWwuX1xuICAgICwgbG9nID0gX2kubG9nXG4gICAgLCBkZWZpbmVTdWJQcm9wZXJ0eSA9IHV0aWwuZGVmaW5lU3ViUHJvcGVydHlcbjtcblxudmFyIExvZ2dlciA9IGxvZy5sb2dnZXJXaXRoTmFtZSgnUmVxdWVzdERlc2NyaXB0b3InKTtcbkxvZ2dlci5zZXRMZXZlbChsb2cuTGV2ZWwud2Fybik7XG5cbi8qKlxuICogQGNsYXNzIERlc2NyaWJlcyBhIEhUVFAgcmVxdWVzdFxuICogQHBhcmFtIHtPYmplY3R9IG9wdHNcbiAqL1xuZnVuY3Rpb24gUmVxdWVzdERlc2NyaXB0b3Iob3B0cykge1xuICAgIGlmICghdGhpcykge1xuICAgICAgICByZXR1cm4gbmV3IFJlcXVlc3REZXNjcmlwdG9yKG9wdHMpO1xuICAgIH1cblxuICAgIERlc2NyaXB0b3IuY2FsbCh0aGlzLCBvcHRzKTtcbiAgICBpZiAodGhpcy5fb3B0c1snc2VyaWFsaXplciddKSB7XG4gICAgICAgIHRoaXMuX29wdHMuc2VyaWFsaXNlciA9IHRoaXMuX29wdHNbJ3NlcmlhbGl6ZXInXTtcbiAgICB9XG5cbiAgICBpZiAoIXRoaXMuX29wdHMuc2VyaWFsaXNlcikge1xuICAgICAgICB0aGlzLl9vcHRzLnNlcmlhbGlzZXIgPSBTZXJpYWxpc2VyLmRlcHRoU2VyaWFsaXplcigwKTtcbiAgICB9XG5cblxuICAgIGRlZmluZVN1YlByb3BlcnR5LmNhbGwodGhpcywgJ3NlcmlhbGlzZXInLCB0aGlzLl9vcHRzKTtcbiAgICBkZWZpbmVTdWJQcm9wZXJ0eS5jYWxsKHRoaXMsICdzZXJpYWxpemVyJywgdGhpcy5fb3B0cywgJ3NlcmlhbGlzZXInKTtcblxufVxuXG5SZXF1ZXN0RGVzY3JpcHRvci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKERlc2NyaXB0b3IucHJvdG90eXBlKTtcblxuXy5leHRlbmQoUmVxdWVzdERlc2NyaXB0b3IucHJvdG90eXBlLCB7XG4gICAgX3NlcmlhbGlzZTogZnVuY3Rpb24gKG9iaiwgY2FsbGJhY2spIHtcbiAgICAgICAgdmFyIGRlZmVycmVkID0gd2luZG93LnEgPyB3aW5kb3cucS5kZWZlcigpIDogbnVsbDtcbiAgICAgICAgY2FsbGJhY2sgPSB1dGlsLmNvbnN0cnVjdENhbGxiYWNrQW5kUHJvbWlzZUhhbmRsZXIoY2FsbGJhY2ssIGRlZmVycmVkKTtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICBpZiAoTG9nZ2VyLnRyYWNlLmlzRW5hYmxlZClcbiAgICAgICAgICAgIExvZ2dlci50cmFjZSgnX3NlcmlhbGlzZScpO1xuICAgICAgICB2YXIgZmluaXNoZWQ7XG4gICAgICAgIHZhciBkYXRhID0gdGhpcy5zZXJpYWxpc2VyKG9iaiwgZnVuY3Rpb24gKGVyciwgZGF0YSkge1xuICAgICAgICAgICAgaWYgKCFmaW5pc2hlZCkge1xuICAgICAgICAgICAgICAgIGRhdGEgPSBzZWxmLl90cmFuc2Zvcm1EYXRhKGRhdGEpO1xuICAgICAgICAgICAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2soZXJyLCBzZWxmLl9lbWJlZERhdGEoZGF0YSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgaWYgKGRhdGEgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgaWYgKExvZ2dlci50cmFjZS5pc0VuYWJsZWQpXG4gICAgICAgICAgICAgICAgTG9nZ2VyLnRyYWNlKCdzZXJpYWxpc2VyIGRvZXNudCB1c2UgYSBjYWxsYmFjaycpO1xuICAgICAgICAgICAgZmluaXNoZWQgPSB0cnVlO1xuICAgICAgICAgICAgZGF0YSA9IHNlbGYuX3RyYW5zZm9ybURhdGEoZGF0YSk7XG4gICAgICAgICAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKG51bGwsIHNlbGYuX2VtYmVkRGF0YShkYXRhKSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBpZiAoTG9nZ2VyLnRyYWNlLmlzRW5hYmxlZClcbiAgICAgICAgICAgICAgICBMb2dnZXIudHJhY2UoJ3NlcmlhbGlzZXIgdXNlcyBhIGNhbGxiYWNrJywgdGhpcy5zZXJpYWxpc2VyKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZGVmZXJyZWQgPyBkZWZlcnJlZC5wcm9taXNlIDogbnVsbDtcbiAgICB9LFxuICAgIF9kdW1wOiBmdW5jdGlvbiAoYXNKc29uKSB7XG4gICAgICAgIHZhciBvYmogPSB7fTtcbiAgICAgICAgb2JqLm1ldGhvZHMgPSB0aGlzLm1ldGhvZDtcbiAgICAgICAgb2JqLm1hcHBpbmcgPSB0aGlzLm1hcHBpbmcudHlwZTtcbiAgICAgICAgb2JqLnBhdGggPSB0aGlzLl9yYXdPcHRzLnBhdGg7XG4gICAgICAgIHZhciBzZXJpYWxpc2VyO1xuICAgICAgICBpZiAodHlwZW9mKHRoaXMuX3Jhd09wdHMuc2VyaWFsaXNlcikgPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgc2VyaWFsaXNlciA9ICdmdW5jdGlvbiAoKSB7IC4uLiB9J1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgc2VyaWFsaXNlciA9IHRoaXMuX3Jhd09wdHMuc2VyaWFsaXNlcjtcbiAgICAgICAgfVxuICAgICAgICBvYmouc2VyaWFsaXNlciA9IHNlcmlhbGlzZXI7XG4gICAgICAgIHZhciB0cmFuc2Zvcm1zID0ge307XG4gICAgICAgIGZvciAodmFyIGYgaW4gdGhpcy50cmFuc2Zvcm1zKSB7XG4gICAgICAgICAgICBpZiAodGhpcy50cmFuc2Zvcm1zLmhhc093blByb3BlcnR5KGYpKSB7XG4gICAgICAgICAgICAgICAgdmFyIHRyYW5zZm9ybSA9IHRoaXMudHJhbnNmb3Jtc1tmXTtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mKHRyYW5zZm9ybSkgPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgICAgICAgICB0cmFuc2Zvcm1zW2ZdID0gJ2Z1bmN0aW9uICgpIHsgLi4uIH0nXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0cmFuc2Zvcm1zW2ZdID0gdGhpcy50cmFuc2Zvcm1zW2ZdO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBvYmoudHJhbnNmb3JtcyA9IHRyYW5zZm9ybXM7XG4gICAgICAgIHJldHVybiBhc0pzb24gPyBKU09OLnN0cmluZ2lmeShvYmosIG51bGwsIDQpIDogb2JqO1xuICAgIH1cbn0pO1xuXG5leHBvcnRzLlJlcXVlc3REZXNjcmlwdG9yID0gUmVxdWVzdERlc2NyaXB0b3I7XG4iLCIvKipcbiAqIEBtb2R1bGUgaHR0cFxuICovXG5cblxudmFyIERlc2NyaXB0b3IgPSByZXF1aXJlKCcuL2Rlc2NyaXB0b3InKS5EZXNjcmlwdG9yO1xuXG4vKipcbiAqIERlc2NyaWJlcyB3aGF0IHRvIGRvIHdpdGggYSBIVFRQIHJlc3BvbnNlLlxuICogQGNvbnN0cnVjdG9yXG4gKiBAaW1wbGVtZW50cyB7RGVzY3JpcHRvcn1cbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRzXG4gKi9cbmZ1bmN0aW9uIFJlc3BvbnNlRGVzY3JpcHRvcihvcHRzKSB7XG4gICAgaWYgKCF0aGlzKSB7XG4gICAgICAgIHJldHVybiBuZXcgUmVzcG9uc2VEZXNjcmlwdG9yKG9wdHMpO1xuICAgIH1cbiAgICBEZXNjcmlwdG9yLmNhbGwodGhpcywgb3B0cyk7XG59XG5cblJlc3BvbnNlRGVzY3JpcHRvci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKERlc2NyaXB0b3IucHJvdG90eXBlKTtcblxuXy5leHRlbmQoUmVzcG9uc2VEZXNjcmlwdG9yLnByb3RvdHlwZSwge1xuICAgIF9leHRyYWN0RGF0YTogZnVuY3Rpb24gKGRhdGEpIHtcbiAgICAgICAgdmFyIGV4dHJhY3RlZERhdGEgPSBEZXNjcmlwdG9yLnByb3RvdHlwZS5fZXh0cmFjdERhdGEuY2FsbCh0aGlzLCBkYXRhKTtcbiAgICAgICAgaWYgKGV4dHJhY3RlZERhdGEpIHtcbiAgICAgICAgICAgIGV4dHJhY3RlZERhdGEgPSB0aGlzLl90cmFuc2Zvcm1EYXRhKGV4dHJhY3RlZERhdGEpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBleHRyYWN0ZWREYXRhO1xuICAgIH0sXG4gICAgX21hdGNoRGF0YTogZnVuY3Rpb24gKGRhdGEpIHtcbiAgICAgICAgdmFyIGV4dHJhY3RlZERhdGEgPSBEZXNjcmlwdG9yLnByb3RvdHlwZS5fbWF0Y2hEYXRhLmNhbGwodGhpcywgZGF0YSk7XG4gICAgICAgIGlmIChleHRyYWN0ZWREYXRhKSB7XG4gICAgICAgICAgICBleHRyYWN0ZWREYXRhID0gdGhpcy5fdHJhbnNmb3JtRGF0YShleHRyYWN0ZWREYXRhKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZXh0cmFjdGVkRGF0YTtcbiAgICB9LFxuICAgIF9kdW1wOiBmdW5jdGlvbiAoYXNKc29uKSB7XG4gICAgICAgIHZhciBvYmogPSB7fTtcbiAgICAgICAgb2JqLm1ldGhvZHMgPSB0aGlzLm1ldGhvZDtcbiAgICAgICAgb2JqLm1hcHBpbmcgPSB0aGlzLm1hcHBpbmcudHlwZTtcbiAgICAgICAgb2JqLnBhdGggPSB0aGlzLl9yYXdPcHRzLnBhdGg7XG4gICAgICAgIHZhciB0cmFuc2Zvcm1zID0ge307XG4gICAgICAgIGZvciAodmFyIGYgaW4gdGhpcy50cmFuc2Zvcm1zKSB7XG4gICAgICAgICAgICBpZiAodGhpcy50cmFuc2Zvcm1zLmhhc093blByb3BlcnR5KGYpKSB7XG4gICAgICAgICAgICAgICAgdmFyIHRyYW5zZm9ybSA9IHRoaXMudHJhbnNmb3Jtc1tmXTtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mKHRyYW5zZm9ybSkgPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgICAgICAgICB0cmFuc2Zvcm1zW2ZdID0gJ2Z1bmN0aW9uICgpIHsgLi4uIH0nXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0cmFuc2Zvcm1zW2ZdID0gdGhpcy50cmFuc2Zvcm1zW2ZdO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBvYmoudHJhbnNmb3JtcyA9IHRyYW5zZm9ybXM7XG4gICAgICAgIHJldHVybiBhc0pzb24gPyBKU09OLnN0cmluZ2lmeShvYmosIG51bGwsIDQpIDogb2JqO1xuICAgIH1cbn0pO1xuXG5leHBvcnRzLlJlc3BvbnNlRGVzY3JpcHRvciA9IFJlc3BvbnNlRGVzY3JpcHRvcjsiLCIvKipcbiAqIEBtb2R1bGUgaHR0cFxuICovXG5cbnZhciBfaSA9IHNpZXN0YS5faW50ZXJuYWw7XG5cbnZhciBsb2cgPSBfaS5sb2dcbiAgICAsIHV0aWxzID0gX2kudXRpbDtcbnZhciBMb2dnZXIgPSBsb2cubG9nZ2VyV2l0aE5hbWUoJ1NlcmlhbGlzZXInKTtcbkxvZ2dlci5zZXRMZXZlbChsb2cuTGV2ZWwud2Fybik7XG52YXIgXyA9IHV0aWxzLl87XG5cbi8qKlxuICogU2VyaWFsaXNlcyBhbiBvYmplY3QgaW50byBpdCdzIHJlbW90ZSBpZGVudGlmaWVyIChhcyBkZWZpbmVkIGJ5IHRoZSBtYXBwaW5nKVxuICogQHBhcmFtICB7U2llc3RhTW9kZWx9IG9ialxuICogQHJldHVybiB7U3RyaW5nfVxuICogXG4gKi9cbmZ1bmN0aW9uIGlkU2VyaWFsaXNlcihvYmopIHtcbiAgICB2YXIgaWRGaWVsZCA9IG9iai5tYXBwaW5nLmlkO1xuICAgIGlmIChpZEZpZWxkKSB7XG4gICAgICAgIHJldHVybiBvYmpbaWRGaWVsZF0gPyBvYmpbaWRGaWVsZF0gOiBudWxsO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgaWYgKExvZ2dlci5kZWJ1Zy5pc0VuYWJsZWQpXG4gICAgICAgICAgICBMb2dnZXIuZGVidWcoJ05vIGlkZmllbGQnKTtcbiAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG59XG5cbi8qKlxuICogU2VyaWFsaXNlcyBvYmogZm9sbG93aW5nIHJlbGF0aW9uc2hpcHMgdG8gc3BlY2lmaWVkIGRlcHRoLlxuICogQHBhcmFtICB7SW50ZWdlcn0gICBkZXB0aFxuICogQHBhcmFtICB7U2llc3RhTW9kZWx9ICAgb2JqXG4gKiBAcGFyYW0gIHtGdW5jdGlvbn0gZG9uZSBcbiAqL1xuZnVuY3Rpb24gZGVwdGhTZXJpYWxpc2VyKGRlcHRoLCBvYmosIGRvbmUpIHtcbiAgICBpZiAoTG9nZ2VyLnRyYWNlLmlzRW5hYmxlZClcbiAgICAgICAgTG9nZ2VyLnRyYWNlKCdkZXB0aFNlcmlhbGlzZXInKTtcbiAgICB2YXIgZGF0YSA9IHt9O1xuICAgIF8uZWFjaChvYmouX2ZpZWxkcywgZnVuY3Rpb24gKGYpIHtcbiAgICAgICAgaWYgKExvZ2dlci50cmFjZS5pc0VuYWJsZWQpXG4gICAgICAgICAgICBMb2dnZXIudHJhY2UoJ2ZpZWxkJywgZik7XG4gICAgICAgIGlmIChvYmpbZl0pIHtcbiAgICAgICAgICAgIGRhdGFbZl0gPSBvYmpbZl07XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICB2YXIgd2FpdGluZyA9IFtdO1xuICAgIHZhciBlcnJvcnMgPSBbXTtcbiAgICB2YXIgcmVzdWx0ID0ge307XG4gICAgdmFyIGZpbmlzaGVkID0gW107XG4gICAgXy5lYWNoKG9iai5fcmVsYXRpb25zaGlwRmllbGRzLCBmdW5jdGlvbiAoZikge1xuICAgICAgICBpZiAoTG9nZ2VyLnRyYWNlLmlzRW5hYmxlZClcbiAgICAgICAgICAgIExvZ2dlci50cmFjZSgncmVsYXRpb25zaGlwRmllbGQnLCBmKTtcbiAgICAgICAgdmFyIHByb3h5ID0gb2JqLl9fcHJveGllc1tmXTtcbiAgICAgICAgaWYgKHByb3h5LmlzRm9yd2FyZCkgeyAvLyBCeSBkZWZhdWx0IG9ubHkgZm9yd2FyZCByZWxhdGlvbnNoaXAuXG4gICAgICAgICAgICBpZiAoTG9nZ2VyLmRlYnVnLmlzRW5hYmxlZClcbiAgICAgICAgICAgICAgICBMb2dnZXIuZGVidWcoZik7XG4gICAgICAgICAgICB3YWl0aW5nLnB1c2goZik7XG4gICAgICAgICAgICBwcm94eS5nZXQoZnVuY3Rpb24gKGVyciwgdikge1xuICAgICAgICAgICAgICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKVxuICAgICAgICAgICAgICAgICAgICBMb2dnZXIudHJhY2UoJ3Byb3h5LmdldCcsIGYpO1xuICAgICAgICAgICAgICAgIGlmIChMb2dnZXIuZGVidWcuaXNFbmFibGVkKVxuICAgICAgICAgICAgICAgICAgICBMb2dnZXIuZGVidWcoZiwgdik7XG4gICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICBlcnJvcnMucHVzaChlcnIpO1xuICAgICAgICAgICAgICAgICAgICBmaW5pc2hlZC5wdXNoKGYpO1xuICAgICAgICAgICAgICAgICAgICByZXN1bHRbZl0gPSB7ZXJyOiBlcnIsIHY6IHZ9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIGlmICh2KSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghZGVwdGgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZpbmlzaGVkLnB1c2goZik7XG4gICAgICAgICAgICAgICAgICAgICAgICBkYXRhW2ZdID0gdltvYmouX19wcm94aWVzW2ZdLmZvcndhcmRNYXBwaW5nLmlkXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc3VsdFtmXSA9IHtlcnI6IGVyciwgdjogdn07XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoKHdhaXRpbmcubGVuZ3RoID09IGZpbmlzaGVkLmxlbmd0aCkgJiYgZG9uZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRvbmUoZXJyb3JzLmxlbmd0aCA/IGVycm9ycyA6IG51bGwsIGRhdGEsIHJlc3VsdCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkZXB0aFNlcmlhbGlzZXIoZGVwdGggLSAxLCB2LCBmdW5jdGlvbiAoZXJyLCBzdWJEYXRhLCByZXNwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlcnJvcnMucHVzaChlcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0YVtmXSA9IHN1YkRhdGE7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZpbmlzaGVkLnB1c2goZik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzdWx0W2ZdID0ge2VycjogZXJyLCB2OiB2LCByZXNwOiByZXNwfTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoKHdhaXRpbmcubGVuZ3RoID09IGZpbmlzaGVkLmxlbmd0aCkgJiYgZG9uZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkb25lKGVycm9ycy5sZW5ndGggPyBlcnJvcnMgOiBudWxsLCBkYXRhLCByZXN1bHQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBpZiAoTG9nZ2VyLmRlYnVnLmlzRW5hYmxlZClcbiAgICAgICAgICAgICAgICAgICAgICAgIExvZ2dlci5kZWJ1Zygnbm8gdmFsdWUgZm9yICcgKyBmKTtcbiAgICAgICAgICAgICAgICAgICAgZmluaXNoZWQucHVzaChmKTtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0W2ZdID0ge2VycjogZXJyLCB2OiB2fTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCh3YWl0aW5nLmxlbmd0aCA9PSBmaW5pc2hlZC5sZW5ndGgpICYmIGRvbmUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRvbmUoZXJyb3JzLmxlbmd0aCA/IGVycm9ycyA6IG51bGwsIGRhdGEsIHJlc3VsdCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH0pO1xuICAgIGlmICghd2FpdGluZy5sZW5ndGgpIHtcbiAgICAgICAgaWYgKGRvbmUpIGRvbmUobnVsbCwgZGF0YSwge30pO1xuICAgIH1cbn1cblxuXG5leHBvcnRzLmRlcHRoU2VyaWFsaXNlciA9IGZ1bmN0aW9uIChkZXB0aCkge1xuICAgIHJldHVybiAgXy5wYXJ0aWFsKGRlcHRoU2VyaWFsaXNlciwgZGVwdGgpO1xufTtcbmV4cG9ydHMuZGVwdGhTZXJpYWxpemVyID0gZnVuY3Rpb24gKGRlcHRoKSB7XG4gICAgcmV0dXJuICBfLnBhcnRpYWwoZGVwdGhTZXJpYWxpc2VyLCBkZXB0aCk7XG59O1xuZXhwb3J0cy5pZFNlcmlhbGl6ZXIgPSBpZFNlcmlhbGlzZXI7XG5leHBvcnRzLmlkU2VyaWFsaXNlciA9IGlkU2VyaWFsaXNlcjtcblxuIl19
