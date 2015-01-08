(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/**
 * Descriptors deal with the description of HTTP requests and are used by Siesta to determine what to do
 * with HTTP request/response bodies.
 * @module http
 */

var _internal = siesta._internal,
    log = _internal.log,
    InternalSiestaError = _internal.error.InternalSiestaError,
    util = _internal.util,
    assert = util.assert,
    defineSubProperty = util.defineSubProperty,
    CollectionRegistry = _internal.CollectionRegistry,
    extend = _internal.extend,
    _ = util._;

var Logger = log.loggerWithName('Descriptor');

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
    if (this._opts.model) {
        if (typeof(this._opts.model) == 'string') {
            if (this._opts.collection) {
                var collection;
                if (typeof(this._opts.collection) == 'string') {
                    collection = CollectionRegistry[this._opts.collection];
                } else {
                    collection = this._opts.collection;
                }
                if (collection) {
                    var actualModel = collection[this._opts.model];
                    if (actualModel) {
                        this._opts.model = actualModel;
                    } else {
                        throw new Error('Model ' + this._opts.model + ' does not exist', {
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
                throw new Error('Passed model as string, but did not specify the collection it belongs to', {
                    opts: opts,
                    descriptor: this
                });
            }
        }
    } else {
        throw new Error('Descriptors must be initialised with a model', {
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
    defineSubProperty.call(this, 'model', this._opts);
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
var _internal = siesta._internal,
    util = _internal.util,
    _ = util._,
    log = _internal.log;

var Logger = log.loggerWithName('Descriptor');

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
    var model = descriptor.model;
    var collectionName = model.collectionName;
    if (!descriptors[collectionName]) {
        descriptors[collectionName] = [];
    }
    descriptors[collectionName].push(descriptor);
}

function _descriptorsForCollection(descriptors, collection) {
    var descriptorsForCollection;
    if (typeof(collection) == 'string') {
        descriptorsForCollection = descriptors[collection] || [];
    }
    else {
        descriptorsForCollection = (descriptors[collection.name] || []);
    }
    return descriptorsForCollection;
}


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

var _internal = siesta._internal,
    Collection = _internal.Collection,
    log = _internal.log,
    util = _internal.util,
    error = _internal.error,
    _ = util._,
    descriptor = require('./descriptor'),
    InternalSiestaError = _internal.error.InternalSiestaError;

var DescriptorRegistry = require('./descriptorRegistry').DescriptorRegistry;


var Logger = log.loggerWithName('HTTP');

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
            logMessage += ': ' + util.prettyPrint(data);
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
    var name = this.name;
    if (typeof(args[0]) == 'function') {
        callback = args[0];
    } else if (typeof(args[0]) == 'object') {
        opts = args[0];
        callback = args[1];
    }
    var deferred = util.defer();
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
                    Logger.trace('Model _constructSubOperation data: ' + util.prettyPrint(extractedData));
                }
                if (typeof(extractedData) == 'object') {
                    var mapping = matchedDescriptor.model;
                    mapping.map(extractedData, {override: opts.obj}, function (err, obj) {
                        if (callback) {

                            callback(err, obj, resp);
                        }
                    });
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
    return deferred.promise;
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
    var deferred = util.defer(callback);
    callback = deferred.finish.bind(deferred);
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
    return deferred.promise;
}

/**
 * Send a DELETE request. Also removes the object.
 * @param {String} path The path to the resource to which we want to DELETE
 * @param {ModelInstance} object The model that we would like to PATCH
 * @returns {Promise}
 */
function DELETE(path, object) {
    var args = Array.prototype.slice.call(arguments, 2);
    var opts = {};
    var callback;
    if (typeof(args[0]) == 'function') {
        callback = args[0];
    } else if (typeof(args[0]) == 'object') {
        opts = args[0];
        callback = args[1];
    }
    var deferred = util.defer(callback);
    var deletionMode = opts.deletionMode || 'restore';
    // By default we do not map the response from a DELETE request.
    if (opts.parseResponse === undefined) opts.parseResponse = false;
    _httpResponse.call(this, 'DELETE', path, opts, function (err, x, y, z) {
        if (err) {
            if (deletionMode == 'restore') {
                object.restore();
            }
        } else if (deletionMode == 'success') {
            object.remove();
        }
        callback(err, x, y, z);
        deferred.finish(err, {x: x, y: y, z:z});
    });
    if (deletionMode == 'now' || deletionMode == 'restore') {
        object.remove();
    }
    return deferred.promise;
}

/**
 * Send a HTTP request using the given method
 * @param request Does the request contain data? e.g. POST/PATCH/PUT will be true, GET will false
 * @param method
 * @internal
 * @returns {Promise}
 */
function HTTP_METHOD(request, method) {
    var args = Array.prototype.slice.call(arguments, 2);
    return _.partial(request ? _httpRequest : _httpResponse, method).apply(this, args);
}

/**
 * Send a GET request
 * @param {String} path The path to the resource we want to GET
 * @param {Object|Function} optsOrCallback Either an options object or a callback if can use defaults
 * @param {Function} callback Callback if opts specified.
 * @package HTTP
 * @returns {Promise}
 */
function GET() {
    return _.partial(HTTP_METHOD, false, 'GET').apply(this, arguments);
}

/**
 * Send an OPTIONS request
 * @param {String} path The path to the resource we want to GET
 * @param {Object|Function} optsOrCallback Either an options object or a callback if can use defaults
 * @param {Function} callback Callback if opts specified.
 * @package HTTP
 * @returns {Promise}
 */
function OPTIONS() {
    return _.partial(HTTP_METHOD, false, 'OPTIONS').apply(this, arguments);
}

/**
 * Send an TRACE request
 * @param {String} path The path to the resource we want to GET
 * @param {Object|Function} optsOrCallback Either an options object or a callback if can use defaults
 * @param {Function} callback Callback if opts specified.
 * @package HTTP
 * @returns {Promise}
 */
function TRACE() {
    return _.partial(HTTP_METHOD, false, 'TRACE').apply(this, arguments);
}

/**
 * Send an HEAD request
 * @param {String} path The path to the resource we want to GET
 * @param {Object|Function} optsOrCallback Either an options object or a callback if can use defaults
 * @param {Function} callback Callback if opts specified.
 * @package HTTP
 * @returns {Promise}
 */
function HEAD() {
    return _.partial(HTTP_METHOD, false, 'HEAD').apply(this, arguments);
}

/**
 * Send an POST request
 * @param {String} path The path to the resource we want to GET
 * @param {ModelInstance} model The model that we would like to POST
 * @param {Object|Function} optsOrCallback Either an options object or a callback if can use defaults
 * @param {Function} callback Callback if opts specified.
 * @package HTTP
 * @returns {Promise}
 */
function POST() {
    return _.partial(HTTP_METHOD, true, 'POST').apply(this, arguments);
}

/**
 * Send an PUT request
 * @param {String} path The path to the resource we want to GET
 * @param {ModelInstance} model The model that we would like to POST
 * @param {Object|Function} optsOrCallback Either an options object or a callback if can use defaults
 * @param {Function} callback Callback if opts specified.
 * @package HTTP
 * @returns {Promise}
 */
function PUT() {
    return _.partial(HTTP_METHOD, true, 'PUT').apply(this, arguments);
}

/**
 * Send an PATCH request
 * @param {String} path The path to the resource we want to GET
 * @param {ModelInstance} model The model that we would like to POST
 * @param {Object|Function} optsOrCallback Either an options object or a callback if can use defaults
 * @param {Function} callback Callback if opts specified.
 * @package HTTP
 * @returns {Promise}
 */
function PATCH() {
    return _.partial(HTTP_METHOD, true, 'PATCH').apply(this, arguments);
}


var http = {
    RequestDescriptor: require('./requestDescriptor').RequestDescriptor,
    ResponseDescriptor: require('./responseDescriptor').ResponseDescriptor,
    Descriptor: descriptor.Descriptor,
    _resolveMethod: descriptor.resolveMethod,
    Serialiser: require('./serialiser'),
    DescriptorRegistry: require('./descriptorRegistry').DescriptorRegistry,
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
    _serialiseObject: _serialiseObject,
    Paginator: require('./paginator')
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

_.extend(Collection.prototype, {
    DELETE: DELETE,
    GET: GET,
    TRACE: TRACE,
    OPTIONS: OPTIONS,
    HEAD: HEAD,
    POST: POST,
    PUT: PUT,
    PATCH: PATCH
});

if (!siesta.ext) siesta.ext = {};
siesta.ext.http = http;

Object.defineProperties(siesta.ext, {
    httpEnabled: {
        get: function () {
            if (siesta.ext._httpEnabled !== undefined) {
                return siesta.ext._httpEnabled;
            }
            return !!siesta.ext.http;
        },
        set: function (v) {
            siesta.ext._httpEnabled = v;
        },
        enumerable: true
    }
});

var ajax, serialisers = {};

_.extend(siesta, {
    setAjax: function (_ajax) {
        ajax = _ajax;
    },
    getAjax: function () {
        return siesta.ext.http.ajax;
    },
    serialisers: serialisers,
    serializers: serialisers
});

Object.defineProperties(serialisers, {
    id: {
        get: function () {
            console.log(siesta.ext.httpEnabled);
            if (siesta.ext.httpEnabled) {
                return siesta.ext.http.Serialiser.idSerialiser;
            }
            return null;
        }
    },
    depth: {
        get: function () {
            if (siesta.ext.httpEnabled) {
                return siesta.ext.http.Serialiser.depthSerializer;
            }
            return null;
        }
    }
});

if (typeof module != 'undefined') module.exports = http;

},{"./descriptor":1,"./descriptorRegistry":2,"./paginator":4,"./requestDescriptor":5,"./responseDescriptor":6,"./serialiser":7}],4:[function(require,module,exports){
var _internal = siesta._internal,
    log = _internal.log,
    InternalSiestaError = _internal.error.InternalSiestaError,
    util = _internal.util,
    _ = util._;

var querystring = require('querystring');

function Paginator(opts) {
    this.opts = {};
    util.extendFromOpts(this.opts, opts, {
        path: '/',
        model: null,
        page: 'page',
        queryParams: true,
        pageSize: 'pageSize',
        numPages: 'numPages',
        dataPath: 'data',
        count: 'count',
        type: 'GET',
        dataType: 'json'
    }, false);
    _.extend(this, {
        numPages: null,
        count: null
    });

    this.validate();
}

_.extend(Paginator.prototype, {
    _extract: function (path, data, jqXHR) {
        if (path) {
            if (typeof path == 'function') {
                data = path(data, jqXHR);
            }
            else {
                var splt = path.split('.');
                for (var i = 0; i < splt.length; i++) {
                    var key = splt[i];
                    data = data[key];
                }
            }
        }
        return data;
    },
    _extractData: function (data, jqXHR) {
        return this._extract(this.opts.dataPath, data, jqXHR);
    },
    _extractNumPages: function (data, jqXHR) {
        return this._extract(this.opts.numPages, data, jqXHR);
    },
    _extractCount: function (data, jqXHR) {
        return this._extract(this.opts.count, data, jqXHR);
    },
    /**
     * var parser = document.createElement('a');
     * parser.href = "http://example.com:3000/pathname/?search=test#hash";
     * parser.href = URL;
     * parser.protocol; // => "http:"
     * parser.hostname; // => "example.com"
     * parser.port;     // => "3000"
     * parser.pathname; // => "/pathname/"
     * parser.search;   // => "?search=test"
     * parser.hash;     // => "#hash"
     * parser.host;     // => "example.com:3000"
     * @param {String} URL
     * @private
     */
    _parseURL: function (URL) {
        var parser = document.createElement('a');
        parser.href = URL;
        return parser;
    },
    page: function (optsOrCallback, callback) {
        var self = this;
        var opts = {};
        if (typeof optsOrCallback == 'function') {
            callback = optsOrCallback;
        }
        else if (optsOrCallback) {
            opts = optsOrCallback;
        }
        var deferred = util.defer(callback);
        var page = opts.page,
            pageSize = opts.pageSize;
        callback = deferred.finish.bind(deferred);
        var ajax = siesta.ext.http.ajax,
            ajaxOpts = _.extend({}, this.opts);
        var collection = this.opts.model.collection,
            url = collection.baseURL + this.opts.path;
        if (this.opts.queryParams) {
            var parser = this._parseURL(url);
            var rawQuery = parser.search,
                rawQuerySplt = rawQuery.split('?');
            if (rawQuerySplt.length > 1) rawQuery = rawQuerySplt[1];
            var query = querystring.parse(rawQuery);
            if (page) {
                query[this.opts.page] = page;
            }
            if (pageSize) {
                query[this.opts.pageSize] = pageSize;
            }
            if (Object.keys(query).length) {
                parser.search = '?' + querystring.stringify(query);
            }
            url = parser.href;
        }
        else {
            var data = {};
            if (page) {
                data[this.opts.page] = page;
            }
            if (pageSize) {
                data[this.opts.pageSize] = pageSize;
            }
            ajaxOpts.data = data
        }
        _.extend(ajaxOpts, {
            url: url,
            success: function (data, textStatus, jqXHR) {
                var modelData = self._extractData(data, jqXHR),
                    count = self._extractCount(data, jqXHR),
                    numPages = self._extractNumPages(data, jqXHR);

                self.opts.model.map(modelData, function (err, modelInstances) {
                    if (!err) {
                        self.count = count;
                        self.numPages = numPages;
                        callback(null, modelInstances, {data: data, textStatus: textStatus, jqXHR: jqXHR});
                    }
                    else {
                        callback(err);
                    }
                });
            },
            fail: callback
        });
        ajax(ajaxOpts);
        return deferred.promise;
    },
    validate: function () {
        if (!this.opts.model) throw new InternalSiestaError('Paginator must have a model');
    }
});

module.exports = Paginator;
},{"querystring":10}],5:[function(require,module,exports){
/**
 * @module http
 */

var Descriptor = require('./descriptor').Descriptor,
    Serialiser = require('./serialiser');

var _internal = siesta._internal,
    util = _internal.util,
    _ = util._,
    log = _internal.log,
    defineSubProperty = util.defineSubProperty
    ;

var Logger = log.loggerWithName('Descriptor');

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
        var deferred = util.defer(callback);
        callback = deferred.finish.bind(deferred);
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
        return deferred.promise;
    },
    _dump: function (asJson) {
        var obj = {};
        obj.methods = this.method;
        obj.model = this.model.name;
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
        return asJson ? util.prettyPrint(obj) : obj;
    }
});

exports.RequestDescriptor = RequestDescriptor;

},{"./descriptor":1,"./serialiser":7}],6:[function(require,module,exports){
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
        obj.model = this.model.name;
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
        return asJson ? util.prettyPrint(obj) : obj;
    }
});

exports.ResponseDescriptor = ResponseDescriptor;
},{"./descriptor":1}],7:[function(require,module,exports){
/**
 * @module http
 */

var _internal = siesta._internal;

var log = _internal.log,
    utils = _internal.util;
var Logger = log.loggerWithName('Serialisation');
var _ = utils._;


/**
 * Serialises an object into it's remote identifier (as defined by the mapping)
 * @param  {ModelInstance} obj
 * @return {String}
 *
 */
function idSerialiser(obj) {
    var idField = obj.model.id;
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
 * @param  {Function} callback
 */
function depthSerialiser(depth, obj, callback) {
    callback = callback || function () {};
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
    var waiting = [],
        errors = [],
        result = {},
        finished = [];
    _.each(obj._relationshipNames, function (f) {
        if (Logger.trace.isEnabled)
            Logger.trace('relationshipField', f);
        var proxy = obj.__proxies[f];
        if (proxy.isForward) { // By default only forward relationships
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
                        data[f] = v[obj.__proxies[f].forwardModel.id];
                        result[f] = {err: err, v: v};
                        if ((waiting.length == finished.length) && callback) {
                            callback(errors.length ? errors : null, data, result);
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
                            if ((waiting.length == finished.length) && callback) {
                                callback(errors.length ? errors : null, data, result);
                            }
                        });
                    }
                }
                else {
                    if (Logger.debug.isEnabled)
                        Logger.debug('no value for ' + f);
                    finished.push(f);
                    result[f] = {err: err, v: v};
                    if ((waiting.length == finished.length) && callback) {
                        callback(errors.length ? errors : null, data, result);
                    }
                }
            });
        }
    });
    if (!waiting.length) {
        callback(null, data, {});
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


},{}],8:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';

// If obj.hasOwnProperty has been overridden, then calling
// obj.hasOwnProperty(prop) will break.
// See: https://github.com/joyent/node/issues/1707
function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

module.exports = function(qs, sep, eq, options) {
  sep = sep || '&';
  eq = eq || '=';
  var obj = {};

  if (typeof qs !== 'string' || qs.length === 0) {
    return obj;
  }

  var regexp = /\+/g;
  qs = qs.split(sep);

  var maxKeys = 1000;
  if (options && typeof options.maxKeys === 'number') {
    maxKeys = options.maxKeys;
  }

  var len = qs.length;
  // maxKeys <= 0 means that we should not limit keys count
  if (maxKeys > 0 && len > maxKeys) {
    len = maxKeys;
  }

  for (var i = 0; i < len; ++i) {
    var x = qs[i].replace(regexp, '%20'),
        idx = x.indexOf(eq),
        kstr, vstr, k, v;

    if (idx >= 0) {
      kstr = x.substr(0, idx);
      vstr = x.substr(idx + 1);
    } else {
      kstr = x;
      vstr = '';
    }

    k = decodeURIComponent(kstr);
    v = decodeURIComponent(vstr);

    if (!hasOwnProperty(obj, k)) {
      obj[k] = v;
    } else if (isArray(obj[k])) {
      obj[k].push(v);
    } else {
      obj[k] = [obj[k], v];
    }
  }

  return obj;
};

var isArray = Array.isArray || function (xs) {
  return Object.prototype.toString.call(xs) === '[object Array]';
};

},{}],9:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';

var stringifyPrimitive = function(v) {
  switch (typeof v) {
    case 'string':
      return v;

    case 'boolean':
      return v ? 'true' : 'false';

    case 'number':
      return isFinite(v) ? v : '';

    default:
      return '';
  }
};

module.exports = function(obj, sep, eq, name) {
  sep = sep || '&';
  eq = eq || '=';
  if (obj === null) {
    obj = undefined;
  }

  if (typeof obj === 'object') {
    return map(objectKeys(obj), function(k) {
      var ks = encodeURIComponent(stringifyPrimitive(k)) + eq;
      if (isArray(obj[k])) {
        return map(obj[k], function(v) {
          return ks + encodeURIComponent(stringifyPrimitive(v));
        }).join(sep);
      } else {
        return ks + encodeURIComponent(stringifyPrimitive(obj[k]));
      }
    }).join(sep);

  }

  if (!name) return '';
  return encodeURIComponent(stringifyPrimitive(name)) + eq +
         encodeURIComponent(stringifyPrimitive(obj));
};

var isArray = Array.isArray || function (xs) {
  return Object.prototype.toString.call(xs) === '[object Array]';
};

function map (xs, f) {
  if (xs.map) return xs.map(f);
  var res = [];
  for (var i = 0; i < xs.length; i++) {
    res.push(f(xs[i], i));
  }
  return res;
}

var objectKeys = Object.keys || function (obj) {
  var res = [];
  for (var key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) res.push(key);
  }
  return res;
};

},{}],10:[function(require,module,exports){
'use strict';

exports.decode = exports.parse = require('./decode');
exports.encode = exports.stringify = require('./encode');

},{"./decode":8,"./encode":9}]},{},[3])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9odHRwL2Rlc2NyaXB0b3IuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9odHRwL2Rlc2NyaXB0b3JSZWdpc3RyeS5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2h0dHAvaW5kZXguanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9odHRwL3BhZ2luYXRvci5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2h0dHAvcmVxdWVzdERlc2NyaXB0b3IuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9odHRwL3Jlc3BvbnNlRGVzY3JpcHRvci5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2h0dHAvc2VyaWFsaXNlci5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9xdWVyeXN0cmluZy1lczMvZGVjb2RlLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3Qvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL3F1ZXJ5c3RyaW5nLWVzMy9lbmNvZGUuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvcXVlcnlzdHJpbmctZXMzL2luZGV4LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5WEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDemNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsSkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8qKlxuICogRGVzY3JpcHRvcnMgZGVhbCB3aXRoIHRoZSBkZXNjcmlwdGlvbiBvZiBIVFRQIHJlcXVlc3RzIGFuZCBhcmUgdXNlZCBieSBTaWVzdGEgdG8gZGV0ZXJtaW5lIHdoYXQgdG8gZG9cbiAqIHdpdGggSFRUUCByZXF1ZXN0L3Jlc3BvbnNlIGJvZGllcy5cbiAqIEBtb2R1bGUgaHR0cFxuICovXG5cbnZhciBfaW50ZXJuYWwgPSBzaWVzdGEuX2ludGVybmFsLFxuICAgIGxvZyA9IF9pbnRlcm5hbC5sb2csXG4gICAgSW50ZXJuYWxTaWVzdGFFcnJvciA9IF9pbnRlcm5hbC5lcnJvci5JbnRlcm5hbFNpZXN0YUVycm9yLFxuICAgIHV0aWwgPSBfaW50ZXJuYWwudXRpbCxcbiAgICBhc3NlcnQgPSB1dGlsLmFzc2VydCxcbiAgICBkZWZpbmVTdWJQcm9wZXJ0eSA9IHV0aWwuZGVmaW5lU3ViUHJvcGVydHksXG4gICAgQ29sbGVjdGlvblJlZ2lzdHJ5ID0gX2ludGVybmFsLkNvbGxlY3Rpb25SZWdpc3RyeSxcbiAgICBleHRlbmQgPSBfaW50ZXJuYWwuZXh0ZW5kLFxuICAgIF8gPSB1dGlsLl87XG5cbnZhciBMb2dnZXIgPSBsb2cubG9nZ2VyV2l0aE5hbWUoJ0Rlc2NyaXB0b3InKTtcblxudmFyIGh0dHBNZXRob2RzID0gWydQT1NUJywgJ1BBVENIJywgJ1BVVCcsICdIRUFEJywgJ0dFVCcsICdERUxFVEUnLCAnT1BUSU9OUycsICdUUkFDRScsICdDT05ORUNUJ107XG5cbmZ1bmN0aW9uIHJlc29sdmVNZXRob2QobWV0aG9kcykge1xuICAgIC8vIENvbnZlcnQgd2lsZGNhcmRzIGludG8gbWV0aG9kcyBhbmQgZW5zdXJlIGlzIGFuIGFycmF5IG9mIHVwcGVyY2FzZSBtZXRob2RzLlxuICAgIGlmIChtZXRob2RzKSB7XG4gICAgICAgIGlmIChtZXRob2RzID09ICcqJyB8fCBtZXRob2RzLmluZGV4T2YoJyonKSA+IC0xKSB7XG4gICAgICAgICAgICBtZXRob2RzID0gaHR0cE1ldGhvZHM7XG4gICAgICAgIH0gZWxzZSBpZiAoIXV0aWwuaXNBcnJheShtZXRob2RzKSkge1xuICAgICAgICAgICAgbWV0aG9kcyA9IFttZXRob2RzXTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIG1ldGhvZHMgPSBbJ0dFVCddO1xuICAgIH1cbiAgICByZXR1cm4gXy5tYXAobWV0aG9kcywgZnVuY3Rpb24gKHgpIHtcbiAgICAgICAgcmV0dXJuIHgudG9VcHBlckNhc2UoKVxuICAgIH0pO1xufVxuXG4vKipcbiAqIEEgZGVzY3JpcHRvciAnZGVzY3JpYmVzJyBwb3NzaWJsZSBIVFRQIHJlcXVlc3RzIGFnYWluc3QgYW4gQVBJLCBhbmQgaXMgdXNlZCB0byBkZWNpZGUgd2hldGhlciBvciBub3QgdG9cbiAqIGludGVyY2VwdCBhIEhUVFAgcmVxdWVzdC9yZXNwb25zZSBhbmQgcGVyZm9ybSBhIG1hcHBpbmcuXG4gKlxuICogQGNvbnN0cnVjdG9yXG4gKiBAcGFyYW0ge09iamVjdH0gb3B0c1xuICovXG5mdW5jdGlvbiBEZXNjcmlwdG9yKG9wdHMpIHtcbiAgICBpZiAoIXRoaXMpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBEZXNjcmlwdG9yKG9wdHMpO1xuICAgIH1cblxuICAgIHRoaXMuX3Jhd09wdHMgPSBleHRlbmQodHJ1ZSwge30sIG9wdHMpO1xuICAgIHRoaXMuX29wdHMgPSBvcHRzO1xuXG4gICAgdmFyIHByb2Nlc3NQYXRoID0gZnVuY3Rpb24gKHJhdykge1xuICAgICAgICBpZiAoIShyYXcgaW5zdGFuY2VvZiBSZWdFeHApKSB7XG4gICAgICAgICAgICByYXcgPSBuZXcgUmVnRXhwKHJhdywgJ2cnKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmF3O1xuICAgIH0uYmluZCh0aGlzKTtcblxuICAgIGlmICh0aGlzLl9vcHRzLnBhdGgpIHtcbiAgICAgICAgdmFyIHBhdGhzID0gdGhpcy5fb3B0cy5wYXRoO1xuICAgICAgICBpZiAoIXV0aWwuaXNBcnJheShwYXRocykpIHtcbiAgICAgICAgICAgIHBhdGhzID0gW3BhdGhzXTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX29wdHMucGF0aCA9IFtdO1xuXG4gICAgICAgIF8uZWFjaChwYXRocywgZnVuY3Rpb24gKHApIHtcbiAgICAgICAgICAgIHRoaXMuX29wdHMucGF0aC5wdXNoKHByb2Nlc3NQYXRoLmNhbGwodGhpcywgcCkpO1xuICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuX29wdHMucGF0aCA9IFsnJ107XG4gICAgfVxuXG4gICAgdGhpcy5fb3B0cy5tZXRob2QgPSByZXNvbHZlTWV0aG9kKHRoaXMuX29wdHMubWV0aG9kKTtcblxuICAgIC8vIE1hcHBpbmdzIGNhbiBiZSBwYXNzZWQgYXMgdGhlIGFjdHVhbCBtYXBwaW5nIG9iamVjdCBvciBhcyBhIHN0cmluZyAod2l0aCBBUEkgc3BlY2lmaWVkIHRvbylcbiAgICBpZiAodGhpcy5fb3B0cy5tb2RlbCkge1xuICAgICAgICBpZiAodHlwZW9mKHRoaXMuX29wdHMubW9kZWwpID09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fb3B0cy5jb2xsZWN0aW9uKSB7XG4gICAgICAgICAgICAgICAgdmFyIGNvbGxlY3Rpb247XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZih0aGlzLl9vcHRzLmNvbGxlY3Rpb24pID09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbGxlY3Rpb24gPSBDb2xsZWN0aW9uUmVnaXN0cnlbdGhpcy5fb3B0cy5jb2xsZWN0aW9uXTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBjb2xsZWN0aW9uID0gdGhpcy5fb3B0cy5jb2xsZWN0aW9uO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoY29sbGVjdGlvbikge1xuICAgICAgICAgICAgICAgICAgICB2YXIgYWN0dWFsTW9kZWwgPSBjb2xsZWN0aW9uW3RoaXMuX29wdHMubW9kZWxdO1xuICAgICAgICAgICAgICAgICAgICBpZiAoYWN0dWFsTW9kZWwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX29wdHMubW9kZWwgPSBhY3R1YWxNb2RlbDtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignTW9kZWwgJyArIHRoaXMuX29wdHMubW9kZWwgKyAnIGRvZXMgbm90IGV4aXN0Jywge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9wdHM6IG9wdHMsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRvcjogdGhpc1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0NvbGxlY3Rpb24gJyArIHRoaXMuX29wdHMuY29sbGVjdGlvbiArICcgZG9lcyBub3QgZXhpc3QnLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICBvcHRzOiBvcHRzLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRvcjogdGhpc1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignUGFzc2VkIG1vZGVsIGFzIHN0cmluZywgYnV0IGRpZCBub3Qgc3BlY2lmeSB0aGUgY29sbGVjdGlvbiBpdCBiZWxvbmdzIHRvJywge1xuICAgICAgICAgICAgICAgICAgICBvcHRzOiBvcHRzLFxuICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdG9yOiB0aGlzXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0Rlc2NyaXB0b3JzIG11c3QgYmUgaW5pdGlhbGlzZWQgd2l0aCBhIG1vZGVsJywge1xuICAgICAgICAgICAgb3B0czogb3B0cyxcbiAgICAgICAgICAgIGRlc2NyaXB0b3I6IHRoaXNcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gSWYga2V5IHBhdGgsIGNvbnZlcnQgZGF0YSBrZXkgcGF0aCBpbnRvIGFuIG9iamVjdCB0aGF0IHdlIGNhbiB0aGVuIHVzZSB0byB0cmF2ZXJzZSB0aGUgSFRUUCBib2RpZXMuXG4gICAgLy8gb3RoZXJ3aXNlIGxlYXZlIGFzIHN0cmluZyBvciB1bmRlZmluZWQuXG4gICAgdmFyIGRhdGEgPSB0aGlzLl9vcHRzLmRhdGE7XG4gICAgaWYgKGRhdGEpIHtcbiAgICAgICAgaWYgKGRhdGEubGVuZ3RoKSB7XG4gICAgICAgICAgICB2YXIgcm9vdDtcbiAgICAgICAgICAgIHZhciBhcnIgPSBkYXRhLnNwbGl0KCcuJyk7XG4gICAgICAgICAgICBpZiAoYXJyLmxlbmd0aCA9PSAxKSB7XG4gICAgICAgICAgICAgICAgcm9vdCA9IGFyclswXTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdmFyIG9iaiA9IHt9O1xuICAgICAgICAgICAgICAgIHJvb3QgPSBvYmo7XG4gICAgICAgICAgICAgICAgdmFyIHByZXZpb3VzS2V5ID0gYXJyWzBdO1xuICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAxOyBpIDwgYXJyLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBrZXkgPSBhcnJbaV07XG4gICAgICAgICAgICAgICAgICAgIGlmIChpID09IChhcnIubGVuZ3RoIC0gMSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG9ialtwcmV2aW91c0tleV0gPSBrZXk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgbmV3VmFyID0ge307XG4gICAgICAgICAgICAgICAgICAgICAgICBvYmpbcHJldmlvdXNLZXldID0gbmV3VmFyO1xuICAgICAgICAgICAgICAgICAgICAgICAgb2JqID0gbmV3VmFyO1xuICAgICAgICAgICAgICAgICAgICAgICAgcHJldmlvdXNLZXkgPSBrZXk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLl9vcHRzLmRhdGEgPSByb290O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQG5hbWUgcGF0aFxuICAgICAqIEB0eXBlIHtTdHJpbmd9XG4gICAgICovXG4gICAgZGVmaW5lU3ViUHJvcGVydHkuY2FsbCh0aGlzLCAncGF0aCcsIHRoaXMuX29wdHMpO1xuICAgIGRlZmluZVN1YlByb3BlcnR5LmNhbGwodGhpcywgJ21ldGhvZCcsIHRoaXMuX29wdHMpO1xuICAgIGRlZmluZVN1YlByb3BlcnR5LmNhbGwodGhpcywgJ21vZGVsJywgdGhpcy5fb3B0cyk7XG4gICAgZGVmaW5lU3ViUHJvcGVydHkuY2FsbCh0aGlzLCAnZGF0YScsIHRoaXMuX29wdHMpO1xuICAgIGRlZmluZVN1YlByb3BlcnR5LmNhbGwodGhpcywgJ3RyYW5zZm9ybXMnLCB0aGlzLl9vcHRzKTtcbn1cblxuXy5leHRlbmQoRGVzY3JpcHRvci5wcm90b3R5cGUsIHtcbiAgICBodHRwTWV0aG9kczogaHR0cE1ldGhvZHMsXG4gICAgLyoqXG4gICAgICogVGFrZXMgYSByZWdleCBwYXRoIGFuZCByZXR1cm5zIHRydWUgaWYgbWF0Y2hlZFxuICAgICAqXG4gICAgICogQHBhcmFtICB7U3RyaW5nfSBwYXRoXG4gICAgICogQHJldHVybiB7Ym9vbGVhbn1cbiAgICAgKiBAaW50ZXJuYWxcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGBgYGpzXG4gICAgICogdmFyIGQgPSBuZXcgRGVzY3JpcHRvcih7XG4gICAgICogICAgIHBhdGg6ICcvcmVzb3VyY2UvKD9QPGlkPikvJ1xuICAgICAqIH0pXG4gICAgICogdmFyIG1hdGNoZWQgPSBkLl9tYXRjaFBhdGgoJy9yZXNvdXJjZS8yJyk7XG4gICAgICogY29uc29sZS5sb2cobWF0Y2hlZCk7IC8vIHtpZDogJzInfVxuICAgICAqIGBgYFxuICAgICAqL1xuICAgIF9tYXRjaFBhdGg6IGZ1bmN0aW9uIChwYXRoKSB7XG4gICAgICAgIHZhciBpO1xuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgdGhpcy5fb3B0cy5wYXRoLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB2YXIgcmVnRXhwID0gdGhpcy5fb3B0cy5wYXRoW2ldO1xuICAgICAgICAgICAgaWYgKExvZ2dlci50cmFjZS5pc0VuYWJsZWQpXG4gICAgICAgICAgICAgICAgTG9nZ2VyLnRyYWNlKCdNYXRjaGluZyBwYXRoJywgcGF0aCwgcmVnRXhwLnRvU3RyaW5nKCkpO1xuICAgICAgICAgICAgdmFyIG1hdGNoZWQgPSByZWdFeHAuZXhlYyhwYXRoKTtcbiAgICAgICAgICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgaWYgKG1hdGNoZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgTG9nZ2VyLnRyYWNlKCdNYXRjaGVkIHBhdGggc3VjY2Vzc2Z1bGx5JywgcGF0aCwgcmVnRXhwLnRvU3RyaW5nKCkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgTG9nZ2VyLnRyYWNlKCdGYWlsZWQgdG8gbWF0Y2ggcGF0aCcsIHBhdGgsIHJlZ0V4cC50b1N0cmluZygpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAobWF0Y2hlZCkgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRydWUgaWYgdGhlIGRlc2NyaXB0b3IgYWNjZXB0cyB0aGUgSFRUUCBtZXRob2QuXG4gICAgICpcbiAgICAgKiBAcGFyYW0gIHtTdHJpbmd9IG1ldGhvZFxuICAgICAqIEByZXR1cm4ge2Jvb2xlYW59XG4gICAgICogQGludGVybmFsXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBgYGBqc1xuICAgICAqIHZhciBkID0gbmV3IERlc2NyaXB0b3Ioe1xuICAgICAqICAgICBtZXRob2Q6IFsnUE9TVCcsICdQVVQnXVxuICAgICAqIH0pO1xuICAgICAqIGNvbnNvbGUubG9nKGQuX21hdGNoTWV0aG9kKCdHRVQnKSk7IC8vIGZhbHNlXG4gICAgICogYGBgXG4gICAgICovXG4gICAgX21hdGNoTWV0aG9kOiBmdW5jdGlvbiAobWV0aG9kKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5tZXRob2QubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmIChtZXRob2QudG9VcHBlckNhc2UoKSA9PSB0aGlzLm1ldGhvZFtpXSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIFBlcmZvcm1zIGEgYnJlYWR0aC1maXJzdCBzZWFyY2ggdGhyb3VnaCBkYXRhLCBlbWJlZGRpbmcgb2JqIGluIHRoZSBmaXJzdCBsZWFmLlxuICAgICAqXG4gICAgICogQHBhcmFtICB7T2JqZWN0fSBvYmpcbiAgICAgKiBAcGFyYW0gIHtPYmplY3R9IGRhdGFcbiAgICAgKiBAcmV0dXJuIHtPYmplY3R9XG4gICAgICovXG4gICAgYnVyeTogZnVuY3Rpb24gKG9iaiwgZGF0YSkge1xuICAgICAgICB2YXIgcm9vdCA9IGRhdGE7XG4gICAgICAgIHZhciBrZXlzID0gT2JqZWN0LmtleXMoZGF0YSk7XG4gICAgICAgIGFzc2VydChrZXlzLmxlbmd0aCA9PSAxKTtcbiAgICAgICAgdmFyIGtleSA9IGtleXNbMF07XG4gICAgICAgIHZhciBjdXJyID0gZGF0YTtcbiAgICAgICAgd2hpbGUgKCEodHlwZW9mKGN1cnJba2V5XSkgPT0gJ3N0cmluZycpKSB7XG4gICAgICAgICAgICBjdXJyID0gY3VycltrZXldO1xuICAgICAgICAgICAga2V5cyA9IE9iamVjdC5rZXlzKGN1cnIpO1xuICAgICAgICAgICAgYXNzZXJ0KGtleXMubGVuZ3RoID09IDEpO1xuICAgICAgICAgICAga2V5ID0ga2V5c1swXTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgbmV3UGFyZW50ID0gY3VycltrZXldO1xuICAgICAgICB2YXIgbmV3T2JqID0ge307XG4gICAgICAgIGN1cnJba2V5XSA9IG5ld09iajtcbiAgICAgICAgbmV3T2JqW25ld1BhcmVudF0gPSBvYmo7XG4gICAgICAgIHJldHVybiByb290O1xuICAgIH0sXG4gICAgX2VtYmVkRGF0YTogZnVuY3Rpb24gKGRhdGEpIHtcbiAgICAgICAgaWYgKHRoaXMuZGF0YSkge1xuICAgICAgICAgICAgdmFyIG5lc3RlZDtcbiAgICAgICAgICAgIGlmICh0eXBlb2YodGhpcy5kYXRhKSA9PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgIG5lc3RlZCA9IHt9O1xuICAgICAgICAgICAgICAgIG5lc3RlZFt0aGlzLmRhdGFdID0gZGF0YTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbmVzdGVkID0gdGhpcy5idXJ5KGRhdGEsIGV4dGVuZCh0cnVlLCB7fSwgdGhpcy5kYXRhKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gbmVzdGVkO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIGRhdGE7XG4gICAgICAgIH1cbiAgICB9LFxuICAgIC8qKlxuICAgICAqIElmIG5lc3RlZCBkYXRhIGhhcyBiZWVuIHNwZWNpZmllZCBpbiB0aGUgZGVzY3JpcHRvciwgZXh0cmFjdCB0aGUgZGF0YS5cbiAgICAgKiBAcGFyYW0gIHtPYmplY3R9IGRhdGFcbiAgICAgKiBAcmV0dXJuIHtPYmplY3R9XG4gICAgICovXG4gICAgX2V4dHJhY3REYXRhOiBmdW5jdGlvbiAoZGF0YSkge1xuICAgICAgICBpZiAoTG9nZ2VyLmRlYnVnLmlzRW5hYmxlZClcbiAgICAgICAgICAgIExvZ2dlci5kZWJ1ZygnX2V4dHJhY3REYXRhJywgZGF0YSk7XG4gICAgICAgIGlmICh0aGlzLmRhdGEpIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2YodGhpcy5kYXRhKSA9PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgIHJldHVybiBkYXRhW3RoaXMuZGF0YV07XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHZhciBrZXlzID0gT2JqZWN0LmtleXModGhpcy5kYXRhKTtcbiAgICAgICAgICAgICAgICBhc3NlcnQoa2V5cy5sZW5ndGggPT0gMSk7XG4gICAgICAgICAgICAgICAgdmFyIGN1cnJUaGVpcnMgPSBkYXRhO1xuICAgICAgICAgICAgICAgIHZhciBjdXJyT3VycyA9IHRoaXMuZGF0YTtcbiAgICAgICAgICAgICAgICB3aGlsZSAodHlwZW9mKGN1cnJPdXJzKSAhPSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgICAgICBrZXlzID0gT2JqZWN0LmtleXMoY3Vyck91cnMpO1xuICAgICAgICAgICAgICAgICAgICBhc3NlcnQoa2V5cy5sZW5ndGggPT0gMSk7XG4gICAgICAgICAgICAgICAgICAgIHZhciBrZXkgPSBrZXlzWzBdO1xuICAgICAgICAgICAgICAgICAgICBjdXJyT3VycyA9IGN1cnJPdXJzW2tleV07XG4gICAgICAgICAgICAgICAgICAgIGN1cnJUaGVpcnMgPSBjdXJyVGhlaXJzW2tleV07XG4gICAgICAgICAgICAgICAgICAgIGlmICghY3VyclRoZWlycykge1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIGN1cnJUaGVpcnMgPyBjdXJyVGhlaXJzW2N1cnJPdXJzXSA6IG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gZGF0YTtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0aGlzIGRlc2NyaXB0b3JzIG1hcHBpbmcgaWYgdGhlIHJlcXVlc3QgY29uZmlnIG1hdGNoZXMuXG4gICAgICogQHBhcmFtIHtPYmplY3R9IGNvbmZpZ1xuICAgICAqIEByZXR1cm5zIHtPYmplY3R9XG4gICAgICovXG4gICAgX21hdGNoQ29uZmlnOiBmdW5jdGlvbiAoY29uZmlnKSB7XG4gICAgICAgIHZhciBtYXRjaGVzID0gY29uZmlnLnR5cGUgPyB0aGlzLl9tYXRjaE1ldGhvZChjb25maWcudHlwZSkgOiB7fTtcbiAgICAgICAgaWYgKG1hdGNoZXMpIHtcbiAgICAgICAgICAgIG1hdGNoZXMgPSBjb25maWcudXJsID8gdGhpcy5fbWF0Y2hQYXRoKGNvbmZpZy51cmwpIDoge307XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG1hdGNoZXM7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgZGF0YSBpZiB0aGUgZGF0YSBtYXRjaGVzLCBwZXJmb3JtaW5nIGFueSBleHRyYWN0aW9uIGFzIHNwZWNpZmllZCBpbiBvcHRzLmRhdGFcbiAgICAgKlxuICAgICAqIEBwYXJhbSAge09iamVjdH0gZGF0YVxuICAgICAqIEByZXR1cm4ge09iamVjdH1cbiAgICAgKi9cbiAgICBfbWF0Y2hEYXRhOiBmdW5jdGlvbiAoZGF0YSkge1xuICAgICAgICB2YXIgZXh0cmFjdGVkRGF0YSA9IG51bGw7XG4gICAgICAgIGlmICh0aGlzLmRhdGEpIHtcbiAgICAgICAgICAgIGlmIChkYXRhKSB7XG4gICAgICAgICAgICAgICAgZXh0cmFjdGVkRGF0YSA9IHRoaXMuX2V4dHJhY3REYXRhKGRhdGEpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZXh0cmFjdGVkRGF0YSA9IGRhdGE7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGV4dHJhY3RlZERhdGE7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBDaGVjayBpZiB0aGUgSFRUUCBjb25maWcgYW5kIHJldHVybmVkIGRhdGEgbWF0Y2ggdGhpcyBkZXNjcmlwdG9yIGRlZmluaXRpb24uXG4gICAgICpcbiAgICAgKiBAcGFyYW0gIHtPYmplY3R9IGNvbmZpZyBDb25maWcgb2JqZWN0IGZvciAkLmFqYXggYW5kIHNpbWlsYXJcbiAgICAgKiBAcGFyYW0gIHtPYmplY3R9IGRhdGFcbiAgICAgKiBAcmV0dXJuIHtPYmplY3R9IEV4dHJhY3RlZCBkYXRhXG4gICAgICovXG4gICAgbWF0Y2g6IGZ1bmN0aW9uIChjb25maWcsIGRhdGEpIHtcbiAgICAgICAgdmFyIHJlZ2V4TWF0Y2hlcyA9IHRoaXMuX21hdGNoQ29uZmlnKGNvbmZpZyk7XG4gICAgICAgIHZhciBtYXRjaGVzID0gISFyZWdleE1hdGNoZXM7XG4gICAgICAgIHZhciBleHRyYWN0ZWREYXRhID0gZmFsc2U7XG4gICAgICAgIGlmIChtYXRjaGVzKSB7XG4gICAgICAgICAgICBleHRyYWN0ZWREYXRhID0gdGhpcy5fbWF0Y2hEYXRhKGRhdGEpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBleHRyYWN0ZWREYXRhO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBBcHBseSBhbnkgdHJhbnNmb3Jtcy5cbiAgICAgKiBAcGFyYW0gIHtPYmplY3R9IGRhdGEgU2VyaWFsaXNlZCBkYXRhLlxuICAgICAqIEByZXR1cm4ge09iamVjdH0gU2VyaWFsaXNlZCBkYXRhIHdpdGggYXBwbGllZCB0cmFuc2Zvcm1hdGlvbnMuXG4gICAgICovXG4gICAgX3RyYW5zZm9ybURhdGE6IGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgICAgIHZhciB0cmFuc2Zvcm1zID0gdGhpcy50cmFuc2Zvcm1zO1xuICAgICAgICBpZiAodHlwZW9mKHRyYW5zZm9ybXMpID09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIGRhdGEgPSB0cmFuc2Zvcm1zKGRhdGEpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZm9yICh2YXIgYXR0ciBpbiB0cmFuc2Zvcm1zKSB7XG4gICAgICAgICAgICAgICAgaWYgKHRyYW5zZm9ybXMuaGFzT3duUHJvcGVydHkoYXR0cikpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGRhdGFbYXR0cl0pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciB0cmFuc2Zvcm0gPSB0cmFuc2Zvcm1zW2F0dHJdO1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHZhbCA9IGRhdGFbYXR0cl07XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mKHRyYW5zZm9ybSkgPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgc3BsaXQgPSB0cmFuc2Zvcm0uc3BsaXQoJy4nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZWxldGUgZGF0YVthdHRyXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoc3BsaXQubGVuZ3RoID09IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0YVtzcGxpdFswXV0gPSB2YWw7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0YVtzcGxpdFswXV0gPSB7fTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG5ld1ZhbCA9IGRhdGFbc3BsaXRbMF1dO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMTsgaSA8IHNwbGl0Lmxlbmd0aCAtIDE7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG5ld0F0dHIgPSBzcGxpdFtpXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5ld1ZhbFtuZXdBdHRyXSA9IHt9O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV3VmFsID0gbmV3VmFsW25ld0F0dHJdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5ld1ZhbFtzcGxpdFtzcGxpdC5sZW5ndGggLSAxXV0gPSB2YWw7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YodHJhbnNmb3JtKSA9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHRyYW5zZm9ybWVkID0gdHJhbnNmb3JtKHZhbCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHV0aWwuaXNBcnJheSh0cmFuc2Zvcm1lZCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVsZXRlIGRhdGFbYXR0cl07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdGFbdHJhbnNmb3JtZWRbMF1dID0gdHJhbnNmb3JtZWRbMV07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0YVthdHRyXSA9IHRyYW5zZm9ybWVkO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ0ludmFsaWQgdHJhbnNmb3JtZXInKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZGF0YTtcbiAgICB9XG59KTtcblxuZXhwb3J0cy5EZXNjcmlwdG9yID0gRGVzY3JpcHRvcjtcbmV4cG9ydHMucmVzb2x2ZU1ldGhvZCA9IHJlc29sdmVNZXRob2Q7IiwidmFyIF9pbnRlcm5hbCA9IHNpZXN0YS5faW50ZXJuYWwsXG4gICAgdXRpbCA9IF9pbnRlcm5hbC51dGlsLFxuICAgIF8gPSB1dGlsLl8sXG4gICAgbG9nID0gX2ludGVybmFsLmxvZztcblxudmFyIExvZ2dlciA9IGxvZy5sb2dnZXJXaXRoTmFtZSgnRGVzY3JpcHRvcicpO1xuXG4vKipcbiAqIEBjbGFzcyBFbnRyeSBwb2ludCBmb3IgZGVzY3JpcHRvciByZWdpc3RyYXRpb24uXG4gKiBAY29uc3RydWN0b3JcbiAqL1xuZnVuY3Rpb24gRGVzY3JpcHRvclJlZ2lzdHJ5KCkge1xuICAgIGlmICghdGhpcykge1xuICAgICAgICByZXR1cm4gbmV3IERlc2NyaXB0b3JSZWdpc3RyeShvcHRzKTtcbiAgICB9XG4gICAgdGhpcy5yZXF1ZXN0RGVzY3JpcHRvcnMgPSB7fTtcbiAgICB0aGlzLnJlc3BvbnNlRGVzY3JpcHRvcnMgPSB7fTtcbn1cblxuZnVuY3Rpb24gX3JlZ2lzdGVyRGVzY3JpcHRvcihkZXNjcmlwdG9ycywgZGVzY3JpcHRvcikge1xuICAgIHZhciBtb2RlbCA9IGRlc2NyaXB0b3IubW9kZWw7XG4gICAgdmFyIGNvbGxlY3Rpb25OYW1lID0gbW9kZWwuY29sbGVjdGlvbk5hbWU7XG4gICAgaWYgKCFkZXNjcmlwdG9yc1tjb2xsZWN0aW9uTmFtZV0pIHtcbiAgICAgICAgZGVzY3JpcHRvcnNbY29sbGVjdGlvbk5hbWVdID0gW107XG4gICAgfVxuICAgIGRlc2NyaXB0b3JzW2NvbGxlY3Rpb25OYW1lXS5wdXNoKGRlc2NyaXB0b3IpO1xufVxuXG5mdW5jdGlvbiBfZGVzY3JpcHRvcnNGb3JDb2xsZWN0aW9uKGRlc2NyaXB0b3JzLCBjb2xsZWN0aW9uKSB7XG4gICAgdmFyIGRlc2NyaXB0b3JzRm9yQ29sbGVjdGlvbjtcbiAgICBpZiAodHlwZW9mKGNvbGxlY3Rpb24pID09ICdzdHJpbmcnKSB7XG4gICAgICAgIGRlc2NyaXB0b3JzRm9yQ29sbGVjdGlvbiA9IGRlc2NyaXB0b3JzW2NvbGxlY3Rpb25dIHx8IFtdO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgZGVzY3JpcHRvcnNGb3JDb2xsZWN0aW9uID0gKGRlc2NyaXB0b3JzW2NvbGxlY3Rpb24ubmFtZV0gfHwgW10pO1xuICAgIH1cbiAgICByZXR1cm4gZGVzY3JpcHRvcnNGb3JDb2xsZWN0aW9uO1xufVxuXG5cbl8uZXh0ZW5kKERlc2NyaXB0b3JSZWdpc3RyeS5wcm90b3R5cGUsIHtcbiAgICByZWdpc3RlclJlcXVlc3REZXNjcmlwdG9yOiBmdW5jdGlvbiAocmVxdWVzdERlc2NyaXB0b3IpIHtcbiAgICAgICAgX3JlZ2lzdGVyRGVzY3JpcHRvcih0aGlzLnJlcXVlc3REZXNjcmlwdG9ycywgcmVxdWVzdERlc2NyaXB0b3IpO1xuICAgIH0sXG4gICAgcmVnaXN0ZXJSZXNwb25zZURlc2NyaXB0b3I6IGZ1bmN0aW9uIChyZXNwb25zZURlc2NyaXB0b3IpIHtcbiAgICAgICAgaWYgKExvZ2dlci50cmFjZS5pc0VuYWJsZWQpXG4gICAgICAgICAgICBMb2dnZXIudHJhY2UoJ3JlZ2lzdGVyUmVzcG9uc2VEZXNjcmlwdG9yJyk7XG4gICAgICAgIF9yZWdpc3RlckRlc2NyaXB0b3IodGhpcy5yZXNwb25zZURlc2NyaXB0b3JzLCByZXNwb25zZURlc2NyaXB0b3IpO1xuICAgIH0sXG4gICAgcmVxdWVzdERlc2NyaXB0b3JzRm9yQ29sbGVjdGlvbjogZnVuY3Rpb24gKGNvbGxlY3Rpb24pIHtcbiAgICAgICAgcmV0dXJuIF9kZXNjcmlwdG9yc0ZvckNvbGxlY3Rpb24odGhpcy5yZXF1ZXN0RGVzY3JpcHRvcnMsIGNvbGxlY3Rpb24pO1xuICAgIH0sXG4gICAgcmVzcG9uc2VEZXNjcmlwdG9yc0ZvckNvbGxlY3Rpb246IGZ1bmN0aW9uIChjb2xsZWN0aW9uKSB7XG4gICAgICAgIHZhciBkZXNjcmlwdG9yc0ZvckNvbGxlY3Rpb24gPSBfZGVzY3JpcHRvcnNGb3JDb2xsZWN0aW9uKHRoaXMucmVzcG9uc2VEZXNjcmlwdG9ycywgY29sbGVjdGlvbik7XG4gICAgICAgIGlmICghZGVzY3JpcHRvcnNGb3JDb2xsZWN0aW9uLmxlbmd0aCkge1xuICAgICAgICAgICAgaWYgKExvZ2dlci5kZWJ1Zy5pc0VuYWJsZWQpXG4gICAgICAgICAgICAgICAgTG9nZ2VyLmRlYnVnKCdObyByZXNwb25zZSBkZXNjcmlwdG9ycyBmb3IgY29sbGVjdGlvbiAnLCB0aGlzLnJlc3BvbnNlRGVzY3JpcHRvcnMpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBkZXNjcmlwdG9yc0ZvckNvbGxlY3Rpb247XG4gICAgfSxcbiAgICByZXNldDogZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLnJlcXVlc3REZXNjcmlwdG9ycyA9IHt9O1xuICAgICAgICB0aGlzLnJlc3BvbnNlRGVzY3JpcHRvcnMgPSB7fTtcbiAgICB9XG59KTtcblxuZXhwb3J0cy5EZXNjcmlwdG9yUmVnaXN0cnkgPSBuZXcgRGVzY3JpcHRvclJlZ2lzdHJ5KCk7IiwiLyoqXG4gKiBQcm92aXNpb25zIHVzYWdlIG9mICQuYWpheCBhbmQgc2ltaWxhciBmdW5jdGlvbnMgdG8gc2VuZCBIVFRQIHJlcXVlc3RzIG1hcHBpbmdcbiAqIHRoZSByZXN1bHRzIGJhY2sgb250byB0aGUgb2JqZWN0IGdyYXBoIGF1dG9tYXRpY2FsbHkuXG4gKiBAbW9kdWxlIGh0dHBcbiAqL1xuXG5pZiAodHlwZW9mIHNpZXN0YSA9PSAndW5kZWZpbmVkJyAmJiB0eXBlb2YgbW9kdWxlID09ICd1bmRlZmluZWQnKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdDb3VsZCBub3QgZmluZCB3aW5kb3cuc2llc3RhLiBNYWtlIHN1cmUgeW91IGluY2x1ZGUgc2llc3RhLmNvcmUuanMgZmlyc3QuJyk7XG59XG5cbnZhciBfaW50ZXJuYWwgPSBzaWVzdGEuX2ludGVybmFsLFxuICAgIENvbGxlY3Rpb24gPSBfaW50ZXJuYWwuQ29sbGVjdGlvbixcbiAgICBsb2cgPSBfaW50ZXJuYWwubG9nLFxuICAgIHV0aWwgPSBfaW50ZXJuYWwudXRpbCxcbiAgICBlcnJvciA9IF9pbnRlcm5hbC5lcnJvcixcbiAgICBfID0gdXRpbC5fLFxuICAgIGRlc2NyaXB0b3IgPSByZXF1aXJlKCcuL2Rlc2NyaXB0b3InKSxcbiAgICBJbnRlcm5hbFNpZXN0YUVycm9yID0gX2ludGVybmFsLmVycm9yLkludGVybmFsU2llc3RhRXJyb3I7XG5cbnZhciBEZXNjcmlwdG9yUmVnaXN0cnkgPSByZXF1aXJlKCcuL2Rlc2NyaXB0b3JSZWdpc3RyeScpLkRlc2NyaXB0b3JSZWdpc3RyeTtcblxuXG52YXIgTG9nZ2VyID0gbG9nLmxvZ2dlcldpdGhOYW1lKCdIVFRQJyk7XG5cbi8qKlxuICogTG9nIGEgSFRUUCByZXNwb25zZVxuICogQHBhcmFtIG9wdHNcbiAqIEBwYXJhbSB4aHJcbiAqIEBwYXJhbSBbZGF0YV0gLSBSYXcgZGF0YSByZWNlaXZlZCBpbiBIVFRQIHJlc3BvbnNlLlxuICovXG5mdW5jdGlvbiBsb2dIdHRwUmVzcG9uc2Uob3B0cywgeGhyLCBkYXRhKSB7XG4gICAgaWYgKExvZ2dlci5kZWJ1Zy5pc0VuYWJsZWQpIHtcbiAgICAgICAgdmFyIGxvZ2dlciA9IExvZ2dlci5kZWJ1ZztcbiAgICAgICAgdmFyIGxvZ01lc3NhZ2UgPSBvcHRzLnR5cGUgKyAnICcgKyB4aHIuc3RhdHVzICsgJyAnICsgb3B0cy51cmw7XG4gICAgICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkICYmIGRhdGEpIHtcbiAgICAgICAgICAgIGxvZ2dlciA9IExvZ2dlci50cmFjZTtcbiAgICAgICAgICAgIGxvZ01lc3NhZ2UgKz0gJzogJyArIHV0aWwucHJldHR5UHJpbnQoZGF0YSk7XG4gICAgICAgIH1cbiAgICAgICAgbG9nZ2VyKGxvZ01lc3NhZ2UpO1xuICAgIH1cbn1cblxuLyoqXG4gKiBMb2cgYSBIVFRQIHJlcXVlc3RcbiAqIEBwYXJhbSBvcHRzXG4gKi9cbmZ1bmN0aW9uIGxvZ0h0dHBSZXF1ZXN0KG9wdHMpIHtcbiAgICBpZiAoTG9nZ2VyLmRlYnVnLmlzRW5hYmxlZCkge1xuICAgICAgICB2YXIgbG9nZ2VyID0gTG9nZ2VyLmRlYnVnO1xuICAgICAgICAvLyBUT0RPOiBBcHBlbmQgcXVlcnkgcGFyYW1ldGVycyB0byB0aGUgVVJMLlxuICAgICAgICB2YXIgbG9nTWVzc2FnZSA9IG9wdHMudHlwZSArICcgJyArIG9wdHMudXJsO1xuICAgICAgICBpZiAoTG9nZ2VyLnRyYWNlLmlzRW5hYmxlZCkge1xuICAgICAgICAgICAgLy8gVE9ETzogSWYgYW55IGRhdGEgaXMgYmVpbmcgc2VudCwgbG9nIHRoYXQuXG4gICAgICAgICAgICBsb2dnZXIgPSBMb2dnZXIudHJhY2U7XG4gICAgICAgIH1cbiAgICAgICAgbG9nZ2VyKGxvZ01lc3NhZ2UpO1xuICAgIH1cbn1cblxuXG4vKipcbiAqIFNlbmQgYSBIVFRQIHJlcXVlc3QgdG8gdGhlIGdpdmVuIG1ldGhvZCBhbmQgcGF0aCBwYXJzaW5nIHRoZSByZXNwb25zZS5cbiAqIEBwYXJhbSB7U3RyaW5nfSBtZXRob2RcbiAqIEBwYXJhbSB7U3RyaW5nfSBwYXRoIFRoZSBwYXRoIHRvIHRoZSByZXNvdXJjZSB3ZSB3YW50IHRvIEdFVFxuICogQHBhcmFtIHtPYmplY3R8RnVuY3Rpb259IG9wdHNPckNhbGxiYWNrIEVpdGhlciBhbiBvcHRpb25zIG9iamVjdCBvciBhIGNhbGxiYWNrIGlmIGNhbiB1c2UgZGVmYXVsdHNcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIENhbGxiYWNrIGlmIG9wdHMgc3BlY2lmaWVkLlxuICovXG5mdW5jdGlvbiBfaHR0cFJlc3BvbnNlKG1ldGhvZCwgcGF0aCwgb3B0c09yQ2FsbGJhY2ssIGNhbGxiYWNrKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAyKTtcbiAgICB2YXIgb3B0cyA9IHt9O1xuICAgIHZhciBuYW1lID0gdGhpcy5uYW1lO1xuICAgIGlmICh0eXBlb2YoYXJnc1swXSkgPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICBjYWxsYmFjayA9IGFyZ3NbMF07XG4gICAgfSBlbHNlIGlmICh0eXBlb2YoYXJnc1swXSkgPT0gJ29iamVjdCcpIHtcbiAgICAgICAgb3B0cyA9IGFyZ3NbMF07XG4gICAgICAgIGNhbGxiYWNrID0gYXJnc1sxXTtcbiAgICB9XG4gICAgdmFyIGRlZmVycmVkID0gdXRpbC5kZWZlcigpO1xuICAgIG9wdHMudHlwZSA9IG1ldGhvZDtcbiAgICBpZiAoIW9wdHMudXJsKSB7IC8vIEFsbG93IG92ZXJyaWRlcy5cbiAgICAgICAgdmFyIGJhc2VVUkwgPSB0aGlzLmJhc2VVUkw7XG4gICAgICAgIG9wdHMudXJsID0gYmFzZVVSTCArIHBhdGg7XG4gICAgfVxuICAgIGlmIChvcHRzLnBhcnNlUmVzcG9uc2UgPT09IHVuZGVmaW5lZCkgb3B0cy5wYXJzZVJlc3BvbnNlID0gdHJ1ZTtcbiAgICBvcHRzLnN1Y2Nlc3MgPSBmdW5jdGlvbiAoZGF0YSwgc3RhdHVzLCB4aHIpIHtcbiAgICAgICAgbG9nSHR0cFJlc3BvbnNlKG9wdHMsIHhociwgZGF0YSk7XG4gICAgICAgIHZhciByZXNwID0ge1xuICAgICAgICAgICAgZGF0YTogZGF0YSxcbiAgICAgICAgICAgIHN0YXR1czogc3RhdHVzLFxuICAgICAgICAgICAgeGhyOiB4aHJcbiAgICAgICAgfTtcbiAgICAgICAgaWYgKG9wdHMucGFyc2VSZXNwb25zZSkge1xuICAgICAgICAgICAgdmFyIGRlc2NyaXB0b3JzID0gRGVzY3JpcHRvclJlZ2lzdHJ5LnJlc3BvbnNlRGVzY3JpcHRvcnNGb3JDb2xsZWN0aW9uKHNlbGYpO1xuICAgICAgICAgICAgdmFyIG1hdGNoZWREZXNjcmlwdG9yO1xuICAgICAgICAgICAgdmFyIGV4dHJhY3RlZERhdGE7XG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGRlc2NyaXB0b3JzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgdmFyIGRlc2NyaXB0b3IgPSBkZXNjcmlwdG9yc1tpXTtcbiAgICAgICAgICAgICAgICBleHRyYWN0ZWREYXRhID0gZGVzY3JpcHRvci5tYXRjaChvcHRzLCBkYXRhKTtcbiAgICAgICAgICAgICAgICBpZiAoZXh0cmFjdGVkRGF0YSkge1xuICAgICAgICAgICAgICAgICAgICBtYXRjaGVkRGVzY3JpcHRvciA9IGRlc2NyaXB0b3I7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChtYXRjaGVkRGVzY3JpcHRvcikge1xuICAgICAgICAgICAgICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgICAgIExvZ2dlci50cmFjZSgnTW9kZWwgX2NvbnN0cnVjdFN1Yk9wZXJhdGlvbiBkYXRhOiAnICsgdXRpbC5wcmV0dHlQcmludChleHRyYWN0ZWREYXRhKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YoZXh0cmFjdGVkRGF0YSkgPT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIG1hcHBpbmcgPSBtYXRjaGVkRGVzY3JpcHRvci5tb2RlbDtcbiAgICAgICAgICAgICAgICAgICAgbWFwcGluZy5tYXAoZXh0cmFjdGVkRGF0YSwge292ZXJyaWRlOiBvcHRzLm9ian0sIGZ1bmN0aW9uIChlcnIsIG9iaikge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGNhbGxiYWNrKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIsIG9iaiwgcmVzcCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7IC8vIE1hdGNoZWQsIGJ1dCBubyBkYXRhLlxuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhudWxsLCB0cnVlLCByZXNwKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGNhbGxiYWNrKSB7XG4gICAgICAgICAgICAgICAgaWYgKG5hbWUpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGVyciA9IHt9O1xuICAgICAgICAgICAgICAgICAgICB2YXIgY29kZSA9IGVycm9yLkVycm9yQ29kZS5Ob0Rlc2NyaXB0b3JNYXRjaGVkO1xuICAgICAgICAgICAgICAgICAgICBlcnJbZXJyb3IuRXJyb3JGaWVsZC5Db2RlXSA9IGNvZGU7XG4gICAgICAgICAgICAgICAgICAgIGVycltlcnJvci5FcnJvckZpZWxkLk1lc3NhZ2VdID0gZXJyb3IuTWVzc2FnZVtjb2RlXTtcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyLCBudWxsLCByZXNwKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyBUaGVyZSB3YXMgYSBidWcgd2hlcmUgY29sbGVjdGlvbiBuYW1lIGRvZXNuJ3QgZXhpc3QuIElmIHRoaXMgb2NjdXJzLCB0aGVuIHdpbGwgbmV2ZXIgZ2V0IGhvbGQgb2YgYW55IGRlc2NyaXB0b3JzLlxuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignVW5uYW1lZCBjb2xsZWN0aW9uJyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY2FsbGJhY2sobnVsbCwgbnVsbCwgcmVzcCk7XG4gICAgICAgIH1cblxuICAgIH07XG4gICAgb3B0cy5lcnJvciA9IGZ1bmN0aW9uICh4aHIsIHN0YXR1cywgZXJyb3IpIHtcbiAgICAgICAgdmFyIHJlc3AgPSB7XG4gICAgICAgICAgICB4aHI6IHhocixcbiAgICAgICAgICAgIHN0YXR1czogc3RhdHVzLFxuICAgICAgICAgICAgZXJyb3I6IGVycm9yXG4gICAgICAgIH07XG4gICAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2socmVzcCwgbnVsbCwgcmVzcCk7XG4gICAgfTtcbiAgICBsb2dIdHRwUmVxdWVzdChvcHRzKTtcbiAgICBzaWVzdGEuZXh0Lmh0dHAuYWpheChvcHRzKTtcbiAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbn1cblxuZnVuY3Rpb24gX3NlcmlhbGlzZU9iamVjdChvcHRzLCBvYmosIGNiKSB7XG4gICAgdGhpcy5fc2VyaWFsaXNlKG9iaiwgZnVuY3Rpb24gKGVyciwgZGF0YSkge1xuICAgICAgICB2YXIgcmV0RGF0YSA9IGRhdGE7XG4gICAgICAgIGlmIChvcHRzLmZpZWxkcykge1xuICAgICAgICAgICAgcmV0RGF0YSA9IHt9O1xuICAgICAgICAgICAgXy5lYWNoKG9wdHMuZmllbGRzLCBmdW5jdGlvbiAoZikge1xuICAgICAgICAgICAgICAgIHJldERhdGFbZl0gPSBkYXRhW2ZdO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgY2IoZXJyLCByZXREYXRhKTtcbiAgICB9KTtcbn1cblxuLyoqXG4gKiBTZW5kIGEgSFRUUCByZXF1ZXN0IHRvIHRoZSBnaXZlbiBtZXRob2QgYW5kIHBhdGhcbiAqIEBwYXJhbSB7U3RyaW5nfSBtZXRob2RcbiAqIEBwYXJhbSB7U3RyaW5nfSBwYXRoIFRoZSBwYXRoIHRvIHRoZSByZXNvdXJjZSB3ZSB3YW50IHRvIEdFVFxuICogQHBhcmFtIHtNb2RlbEluc3RhbmNlfSBvYmplY3QgVGhlIG1vZGVsIHdlJ3JlIHB1c2hpbmcgdG8gdGhlIHNlcnZlclxuICogQHBhcmFtIHtPYmplY3R8RnVuY3Rpb259IG9wdHNPckNhbGxiYWNrIEVpdGhlciBhbiBvcHRpb25zIG9iamVjdCBvciBhIGNhbGxiYWNrIGlmIGNhbiB1c2UgZGVmYXVsdHNcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIENhbGxiYWNrIGlmIG9wdHMgc3BlY2lmaWVkLlxuICovXG5mdW5jdGlvbiBfaHR0cFJlcXVlc3QobWV0aG9kLCBwYXRoLCBvYmplY3QpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDMpO1xuICAgIHZhciBjYWxsYmFjaztcbiAgICB2YXIgb3B0cyA9IHt9O1xuICAgIGlmICh0eXBlb2YoYXJnc1swXSkgPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICBjYWxsYmFjayA9IGFyZ3NbMF07XG4gICAgfSBlbHNlIGlmICh0eXBlb2YoYXJnc1swXSkgPT0gJ29iamVjdCcpIHtcbiAgICAgICAgb3B0cyA9IGFyZ3NbMF07XG4gICAgICAgIGNhbGxiYWNrID0gYXJnc1sxXTtcbiAgICB9XG4gICAgdmFyIGRlZmVycmVkID0gdXRpbC5kZWZlcihjYWxsYmFjayk7XG4gICAgY2FsbGJhY2sgPSBkZWZlcnJlZC5maW5pc2guYmluZChkZWZlcnJlZCk7XG4gICAgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3MsIDIpO1xuICAgIHZhciByZXF1ZXN0RGVzY3JpcHRvcnMgPSBEZXNjcmlwdG9yUmVnaXN0cnkucmVxdWVzdERlc2NyaXB0b3JzRm9yQ29sbGVjdGlvbih0aGlzKTtcbiAgICB2YXIgbWF0Y2hlZERlc2NyaXB0b3I7XG4gICAgb3B0cy50eXBlID0gbWV0aG9kO1xuICAgIHZhciBiYXNlVVJMID0gdGhpcy5iYXNlVVJMO1xuICAgIG9wdHMudXJsID0gYmFzZVVSTCArIHBhdGg7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCByZXF1ZXN0RGVzY3JpcHRvcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIHJlcXVlc3REZXNjcmlwdG9yID0gcmVxdWVzdERlc2NyaXB0b3JzW2ldO1xuICAgICAgICBpZiAocmVxdWVzdERlc2NyaXB0b3IuX21hdGNoQ29uZmlnKG9wdHMpKSB7XG4gICAgICAgICAgICBtYXRjaGVkRGVzY3JpcHRvciA9IHJlcXVlc3REZXNjcmlwdG9yO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICB9XG4gICAgaWYgKG1hdGNoZWREZXNjcmlwdG9yKSB7XG4gICAgICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKVxuICAgICAgICAgICAgTG9nZ2VyLnRyYWNlKCdNYXRjaGVkIGRlc2NyaXB0b3I6ICcgKyBtYXRjaGVkRGVzY3JpcHRvci5fZHVtcCh0cnVlKSk7XG4gICAgICAgIF9zZXJpYWxpc2VPYmplY3QuY2FsbChtYXRjaGVkRGVzY3JpcHRvciwgb2JqZWN0LCBvcHRzLCBmdW5jdGlvbiAoZXJyLCBkYXRhKSB7XG4gICAgICAgICAgICBpZiAoTG9nZ2VyLnRyYWNlLmlzRW5hYmxlZClcbiAgICAgICAgICAgICAgICBMb2dnZXIudHJhY2UoJ19zZXJpYWxpc2UnLCB7XG4gICAgICAgICAgICAgICAgICAgIGVycjogZXJyLFxuICAgICAgICAgICAgICAgICAgICBkYXRhOiBkYXRhXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhlcnIsIG51bGwsIG51bGwpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBvcHRzLmRhdGEgPSBkYXRhO1xuICAgICAgICAgICAgICAgIG9wdHMub2JqID0gb2JqZWN0O1xuICAgICAgICAgICAgICAgIF8ucGFydGlhbChfaHR0cFJlc3BvbnNlLCBtZXRob2QsIHBhdGgsIG9wdHMsIGNhbGxiYWNrKS5hcHBseShzZWxmLCBhcmdzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICB9IGVsc2UgaWYgKGNhbGxiYWNrKSB7XG4gICAgICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKVxuICAgICAgICAgICAgTG9nZ2VyLnRyYWNlKCdEaWQgbm90IG1hdGNoIGRlc2NyaXB0b3InKTtcbiAgICAgICAgY2FsbGJhY2soJ05vIGRlc2NyaXB0b3IgbWF0Y2hlZCcsIG51bGwsIG51bGwpO1xuICAgIH1cbiAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbn1cblxuLyoqXG4gKiBTZW5kIGEgREVMRVRFIHJlcXVlc3QuIEFsc28gcmVtb3ZlcyB0aGUgb2JqZWN0LlxuICogQHBhcmFtIHtTdHJpbmd9IHBhdGggVGhlIHBhdGggdG8gdGhlIHJlc291cmNlIHRvIHdoaWNoIHdlIHdhbnQgdG8gREVMRVRFXG4gKiBAcGFyYW0ge01vZGVsSW5zdGFuY2V9IG9iamVjdCBUaGUgbW9kZWwgdGhhdCB3ZSB3b3VsZCBsaWtlIHRvIFBBVENIXG4gKiBAcmV0dXJucyB7UHJvbWlzZX1cbiAqL1xuZnVuY3Rpb24gREVMRVRFKHBhdGgsIG9iamVjdCkge1xuICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAyKTtcbiAgICB2YXIgb3B0cyA9IHt9O1xuICAgIHZhciBjYWxsYmFjaztcbiAgICBpZiAodHlwZW9mKGFyZ3NbMF0pID09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgY2FsbGJhY2sgPSBhcmdzWzBdO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mKGFyZ3NbMF0pID09ICdvYmplY3QnKSB7XG4gICAgICAgIG9wdHMgPSBhcmdzWzBdO1xuICAgICAgICBjYWxsYmFjayA9IGFyZ3NbMV07XG4gICAgfVxuICAgIHZhciBkZWZlcnJlZCA9IHV0aWwuZGVmZXIoY2FsbGJhY2spO1xuICAgIHZhciBkZWxldGlvbk1vZGUgPSBvcHRzLmRlbGV0aW9uTW9kZSB8fCAncmVzdG9yZSc7XG4gICAgLy8gQnkgZGVmYXVsdCB3ZSBkbyBub3QgbWFwIHRoZSByZXNwb25zZSBmcm9tIGEgREVMRVRFIHJlcXVlc3QuXG4gICAgaWYgKG9wdHMucGFyc2VSZXNwb25zZSA9PT0gdW5kZWZpbmVkKSBvcHRzLnBhcnNlUmVzcG9uc2UgPSBmYWxzZTtcbiAgICBfaHR0cFJlc3BvbnNlLmNhbGwodGhpcywgJ0RFTEVURScsIHBhdGgsIG9wdHMsIGZ1bmN0aW9uIChlcnIsIHgsIHksIHopIHtcbiAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgaWYgKGRlbGV0aW9uTW9kZSA9PSAncmVzdG9yZScpIHtcbiAgICAgICAgICAgICAgICBvYmplY3QucmVzdG9yZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKGRlbGV0aW9uTW9kZSA9PSAnc3VjY2VzcycpIHtcbiAgICAgICAgICAgIG9iamVjdC5yZW1vdmUoKTtcbiAgICAgICAgfVxuICAgICAgICBjYWxsYmFjayhlcnIsIHgsIHksIHopO1xuICAgICAgICBkZWZlcnJlZC5maW5pc2goZXJyLCB7eDogeCwgeTogeSwgejp6fSk7XG4gICAgfSk7XG4gICAgaWYgKGRlbGV0aW9uTW9kZSA9PSAnbm93JyB8fCBkZWxldGlvbk1vZGUgPT0gJ3Jlc3RvcmUnKSB7XG4gICAgICAgIG9iamVjdC5yZW1vdmUoKTtcbiAgICB9XG4gICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG59XG5cbi8qKlxuICogU2VuZCBhIEhUVFAgcmVxdWVzdCB1c2luZyB0aGUgZ2l2ZW4gbWV0aG9kXG4gKiBAcGFyYW0gcmVxdWVzdCBEb2VzIHRoZSByZXF1ZXN0IGNvbnRhaW4gZGF0YT8gZS5nLiBQT1NUL1BBVENIL1BVVCB3aWxsIGJlIHRydWUsIEdFVCB3aWxsIGZhbHNlXG4gKiBAcGFyYW0gbWV0aG9kXG4gKiBAaW50ZXJuYWxcbiAqIEByZXR1cm5zIHtQcm9taXNlfVxuICovXG5mdW5jdGlvbiBIVFRQX01FVEhPRChyZXF1ZXN0LCBtZXRob2QpIHtcbiAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMik7XG4gICAgcmV0dXJuIF8ucGFydGlhbChyZXF1ZXN0ID8gX2h0dHBSZXF1ZXN0IDogX2h0dHBSZXNwb25zZSwgbWV0aG9kKS5hcHBseSh0aGlzLCBhcmdzKTtcbn1cblxuLyoqXG4gKiBTZW5kIGEgR0VUIHJlcXVlc3RcbiAqIEBwYXJhbSB7U3RyaW5nfSBwYXRoIFRoZSBwYXRoIHRvIHRoZSByZXNvdXJjZSB3ZSB3YW50IHRvIEdFVFxuICogQHBhcmFtIHtPYmplY3R8RnVuY3Rpb259IG9wdHNPckNhbGxiYWNrIEVpdGhlciBhbiBvcHRpb25zIG9iamVjdCBvciBhIGNhbGxiYWNrIGlmIGNhbiB1c2UgZGVmYXVsdHNcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIENhbGxiYWNrIGlmIG9wdHMgc3BlY2lmaWVkLlxuICogQHBhY2thZ2UgSFRUUFxuICogQHJldHVybnMge1Byb21pc2V9XG4gKi9cbmZ1bmN0aW9uIEdFVCgpIHtcbiAgICByZXR1cm4gXy5wYXJ0aWFsKEhUVFBfTUVUSE9ELCBmYWxzZSwgJ0dFVCcpLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG59XG5cbi8qKlxuICogU2VuZCBhbiBPUFRJT05TIHJlcXVlc3RcbiAqIEBwYXJhbSB7U3RyaW5nfSBwYXRoIFRoZSBwYXRoIHRvIHRoZSByZXNvdXJjZSB3ZSB3YW50IHRvIEdFVFxuICogQHBhcmFtIHtPYmplY3R8RnVuY3Rpb259IG9wdHNPckNhbGxiYWNrIEVpdGhlciBhbiBvcHRpb25zIG9iamVjdCBvciBhIGNhbGxiYWNrIGlmIGNhbiB1c2UgZGVmYXVsdHNcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIENhbGxiYWNrIGlmIG9wdHMgc3BlY2lmaWVkLlxuICogQHBhY2thZ2UgSFRUUFxuICogQHJldHVybnMge1Byb21pc2V9XG4gKi9cbmZ1bmN0aW9uIE9QVElPTlMoKSB7XG4gICAgcmV0dXJuIF8ucGFydGlhbChIVFRQX01FVEhPRCwgZmFsc2UsICdPUFRJT05TJykuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbn1cblxuLyoqXG4gKiBTZW5kIGFuIFRSQUNFIHJlcXVlc3RcbiAqIEBwYXJhbSB7U3RyaW5nfSBwYXRoIFRoZSBwYXRoIHRvIHRoZSByZXNvdXJjZSB3ZSB3YW50IHRvIEdFVFxuICogQHBhcmFtIHtPYmplY3R8RnVuY3Rpb259IG9wdHNPckNhbGxiYWNrIEVpdGhlciBhbiBvcHRpb25zIG9iamVjdCBvciBhIGNhbGxiYWNrIGlmIGNhbiB1c2UgZGVmYXVsdHNcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIENhbGxiYWNrIGlmIG9wdHMgc3BlY2lmaWVkLlxuICogQHBhY2thZ2UgSFRUUFxuICogQHJldHVybnMge1Byb21pc2V9XG4gKi9cbmZ1bmN0aW9uIFRSQUNFKCkge1xuICAgIHJldHVybiBfLnBhcnRpYWwoSFRUUF9NRVRIT0QsIGZhbHNlLCAnVFJBQ0UnKS5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xufVxuXG4vKipcbiAqIFNlbmQgYW4gSEVBRCByZXF1ZXN0XG4gKiBAcGFyYW0ge1N0cmluZ30gcGF0aCBUaGUgcGF0aCB0byB0aGUgcmVzb3VyY2Ugd2Ugd2FudCB0byBHRVRcbiAqIEBwYXJhbSB7T2JqZWN0fEZ1bmN0aW9ufSBvcHRzT3JDYWxsYmFjayBFaXRoZXIgYW4gb3B0aW9ucyBvYmplY3Qgb3IgYSBjYWxsYmFjayBpZiBjYW4gdXNlIGRlZmF1bHRzXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBDYWxsYmFjayBpZiBvcHRzIHNwZWNpZmllZC5cbiAqIEBwYWNrYWdlIEhUVFBcbiAqIEByZXR1cm5zIHtQcm9taXNlfVxuICovXG5mdW5jdGlvbiBIRUFEKCkge1xuICAgIHJldHVybiBfLnBhcnRpYWwoSFRUUF9NRVRIT0QsIGZhbHNlLCAnSEVBRCcpLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG59XG5cbi8qKlxuICogU2VuZCBhbiBQT1NUIHJlcXVlc3RcbiAqIEBwYXJhbSB7U3RyaW5nfSBwYXRoIFRoZSBwYXRoIHRvIHRoZSByZXNvdXJjZSB3ZSB3YW50IHRvIEdFVFxuICogQHBhcmFtIHtNb2RlbEluc3RhbmNlfSBtb2RlbCBUaGUgbW9kZWwgdGhhdCB3ZSB3b3VsZCBsaWtlIHRvIFBPU1RcbiAqIEBwYXJhbSB7T2JqZWN0fEZ1bmN0aW9ufSBvcHRzT3JDYWxsYmFjayBFaXRoZXIgYW4gb3B0aW9ucyBvYmplY3Qgb3IgYSBjYWxsYmFjayBpZiBjYW4gdXNlIGRlZmF1bHRzXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBDYWxsYmFjayBpZiBvcHRzIHNwZWNpZmllZC5cbiAqIEBwYWNrYWdlIEhUVFBcbiAqIEByZXR1cm5zIHtQcm9taXNlfVxuICovXG5mdW5jdGlvbiBQT1NUKCkge1xuICAgIHJldHVybiBfLnBhcnRpYWwoSFRUUF9NRVRIT0QsIHRydWUsICdQT1NUJykuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbn1cblxuLyoqXG4gKiBTZW5kIGFuIFBVVCByZXF1ZXN0XG4gKiBAcGFyYW0ge1N0cmluZ30gcGF0aCBUaGUgcGF0aCB0byB0aGUgcmVzb3VyY2Ugd2Ugd2FudCB0byBHRVRcbiAqIEBwYXJhbSB7TW9kZWxJbnN0YW5jZX0gbW9kZWwgVGhlIG1vZGVsIHRoYXQgd2Ugd291bGQgbGlrZSB0byBQT1NUXG4gKiBAcGFyYW0ge09iamVjdHxGdW5jdGlvbn0gb3B0c09yQ2FsbGJhY2sgRWl0aGVyIGFuIG9wdGlvbnMgb2JqZWN0IG9yIGEgY2FsbGJhY2sgaWYgY2FuIHVzZSBkZWZhdWx0c1xuICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgQ2FsbGJhY2sgaWYgb3B0cyBzcGVjaWZpZWQuXG4gKiBAcGFja2FnZSBIVFRQXG4gKiBAcmV0dXJucyB7UHJvbWlzZX1cbiAqL1xuZnVuY3Rpb24gUFVUKCkge1xuICAgIHJldHVybiBfLnBhcnRpYWwoSFRUUF9NRVRIT0QsIHRydWUsICdQVVQnKS5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xufVxuXG4vKipcbiAqIFNlbmQgYW4gUEFUQ0ggcmVxdWVzdFxuICogQHBhcmFtIHtTdHJpbmd9IHBhdGggVGhlIHBhdGggdG8gdGhlIHJlc291cmNlIHdlIHdhbnQgdG8gR0VUXG4gKiBAcGFyYW0ge01vZGVsSW5zdGFuY2V9IG1vZGVsIFRoZSBtb2RlbCB0aGF0IHdlIHdvdWxkIGxpa2UgdG8gUE9TVFxuICogQHBhcmFtIHtPYmplY3R8RnVuY3Rpb259IG9wdHNPckNhbGxiYWNrIEVpdGhlciBhbiBvcHRpb25zIG9iamVjdCBvciBhIGNhbGxiYWNrIGlmIGNhbiB1c2UgZGVmYXVsdHNcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIENhbGxiYWNrIGlmIG9wdHMgc3BlY2lmaWVkLlxuICogQHBhY2thZ2UgSFRUUFxuICogQHJldHVybnMge1Byb21pc2V9XG4gKi9cbmZ1bmN0aW9uIFBBVENIKCkge1xuICAgIHJldHVybiBfLnBhcnRpYWwoSFRUUF9NRVRIT0QsIHRydWUsICdQQVRDSCcpLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG59XG5cblxudmFyIGh0dHAgPSB7XG4gICAgUmVxdWVzdERlc2NyaXB0b3I6IHJlcXVpcmUoJy4vcmVxdWVzdERlc2NyaXB0b3InKS5SZXF1ZXN0RGVzY3JpcHRvcixcbiAgICBSZXNwb25zZURlc2NyaXB0b3I6IHJlcXVpcmUoJy4vcmVzcG9uc2VEZXNjcmlwdG9yJykuUmVzcG9uc2VEZXNjcmlwdG9yLFxuICAgIERlc2NyaXB0b3I6IGRlc2NyaXB0b3IuRGVzY3JpcHRvcixcbiAgICBfcmVzb2x2ZU1ldGhvZDogZGVzY3JpcHRvci5yZXNvbHZlTWV0aG9kLFxuICAgIFNlcmlhbGlzZXI6IHJlcXVpcmUoJy4vc2VyaWFsaXNlcicpLFxuICAgIERlc2NyaXB0b3JSZWdpc3RyeTogcmVxdWlyZSgnLi9kZXNjcmlwdG9yUmVnaXN0cnknKS5EZXNjcmlwdG9yUmVnaXN0cnksXG4gICAgX2h0dHBSZXNwb25zZTogX2h0dHBSZXNwb25zZSxcbiAgICBfaHR0cFJlcXVlc3Q6IF9odHRwUmVxdWVzdCxcbiAgICBERUxFVEU6IERFTEVURSxcbiAgICBIVFRQX01FVEhPRDogSFRUUF9NRVRIT0QsXG4gICAgR0VUOiBHRVQsXG4gICAgVFJBQ0U6IFRSQUNFLFxuICAgIE9QVElPTlM6IE9QVElPTlMsXG4gICAgSEVBRDogSEVBRCxcbiAgICBQT1NUOiBQT1NULFxuICAgIFBVVDogUFVULFxuICAgIFBBVENIOiBQQVRDSCxcbiAgICBfc2VyaWFsaXNlT2JqZWN0OiBfc2VyaWFsaXNlT2JqZWN0LFxuICAgIFBhZ2luYXRvcjogcmVxdWlyZSgnLi9wYWdpbmF0b3InKVxufTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGh0dHAsICdhamF4Jywge1xuICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgYSA9IGFqYXggfHwgKCQgPyAkLmFqYXggOiBudWxsKSB8fCAoalF1ZXJ5ID8galF1ZXJ5LmFqYXggOiBudWxsKTtcbiAgICAgICAgaWYgKCFhKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignYWpheCBoYXMgbm90IGJlZW4gZGVmaW5lZCBhbmQgY291bGQgbm90IGZpbmQgJC5hamF4IG9yIGpRdWVyeS5hamF4Jyk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGE7XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uICh2KSB7XG4gICAgICAgIGFqYXggPSB2O1xuICAgIH1cbn0pO1xuXG5fLmV4dGVuZChDb2xsZWN0aW9uLnByb3RvdHlwZSwge1xuICAgIERFTEVURTogREVMRVRFLFxuICAgIEdFVDogR0VULFxuICAgIFRSQUNFOiBUUkFDRSxcbiAgICBPUFRJT05TOiBPUFRJT05TLFxuICAgIEhFQUQ6IEhFQUQsXG4gICAgUE9TVDogUE9TVCxcbiAgICBQVVQ6IFBVVCxcbiAgICBQQVRDSDogUEFUQ0hcbn0pO1xuXG5pZiAoIXNpZXN0YS5leHQpIHNpZXN0YS5leHQgPSB7fTtcbnNpZXN0YS5leHQuaHR0cCA9IGh0dHA7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKHNpZXN0YS5leHQsIHtcbiAgICBodHRwRW5hYmxlZDoge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGlmIChzaWVzdGEuZXh0Ll9odHRwRW5hYmxlZCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHNpZXN0YS5leHQuX2h0dHBFbmFibGVkO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuICEhc2llc3RhLmV4dC5odHRwO1xuICAgICAgICB9LFxuICAgICAgICBzZXQ6IGZ1bmN0aW9uICh2KSB7XG4gICAgICAgICAgICBzaWVzdGEuZXh0Ll9odHRwRW5hYmxlZCA9IHY7XG4gICAgICAgIH0sXG4gICAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICB9XG59KTtcblxudmFyIGFqYXgsIHNlcmlhbGlzZXJzID0ge307XG5cbl8uZXh0ZW5kKHNpZXN0YSwge1xuICAgIHNldEFqYXg6IGZ1bmN0aW9uIChfYWpheCkge1xuICAgICAgICBhamF4ID0gX2FqYXg7XG4gICAgfSxcbiAgICBnZXRBamF4OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiBzaWVzdGEuZXh0Lmh0dHAuYWpheDtcbiAgICB9LFxuICAgIHNlcmlhbGlzZXJzOiBzZXJpYWxpc2VycyxcbiAgICBzZXJpYWxpemVyczogc2VyaWFsaXNlcnNcbn0pO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydGllcyhzZXJpYWxpc2Vycywge1xuICAgIGlkOiB7XG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coc2llc3RhLmV4dC5odHRwRW5hYmxlZCk7XG4gICAgICAgICAgICBpZiAoc2llc3RhLmV4dC5odHRwRW5hYmxlZCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBzaWVzdGEuZXh0Lmh0dHAuU2VyaWFsaXNlci5pZFNlcmlhbGlzZXI7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgZGVwdGg6IHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBpZiAoc2llc3RhLmV4dC5odHRwRW5hYmxlZCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBzaWVzdGEuZXh0Lmh0dHAuU2VyaWFsaXNlci5kZXB0aFNlcmlhbGl6ZXI7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cbn0pO1xuXG5pZiAodHlwZW9mIG1vZHVsZSAhPSAndW5kZWZpbmVkJykgbW9kdWxlLmV4cG9ydHMgPSBodHRwO1xuIiwidmFyIF9pbnRlcm5hbCA9IHNpZXN0YS5faW50ZXJuYWwsXG4gICAgbG9nID0gX2ludGVybmFsLmxvZyxcbiAgICBJbnRlcm5hbFNpZXN0YUVycm9yID0gX2ludGVybmFsLmVycm9yLkludGVybmFsU2llc3RhRXJyb3IsXG4gICAgdXRpbCA9IF9pbnRlcm5hbC51dGlsLFxuICAgIF8gPSB1dGlsLl87XG5cbnZhciBxdWVyeXN0cmluZyA9IHJlcXVpcmUoJ3F1ZXJ5c3RyaW5nJyk7XG5cbmZ1bmN0aW9uIFBhZ2luYXRvcihvcHRzKSB7XG4gICAgdGhpcy5vcHRzID0ge307XG4gICAgdXRpbC5leHRlbmRGcm9tT3B0cyh0aGlzLm9wdHMsIG9wdHMsIHtcbiAgICAgICAgcGF0aDogJy8nLFxuICAgICAgICBtb2RlbDogbnVsbCxcbiAgICAgICAgcGFnZTogJ3BhZ2UnLFxuICAgICAgICBxdWVyeVBhcmFtczogdHJ1ZSxcbiAgICAgICAgcGFnZVNpemU6ICdwYWdlU2l6ZScsXG4gICAgICAgIG51bVBhZ2VzOiAnbnVtUGFnZXMnLFxuICAgICAgICBkYXRhUGF0aDogJ2RhdGEnLFxuICAgICAgICBjb3VudDogJ2NvdW50JyxcbiAgICAgICAgdHlwZTogJ0dFVCcsXG4gICAgICAgIGRhdGFUeXBlOiAnanNvbidcbiAgICB9LCBmYWxzZSk7XG4gICAgXy5leHRlbmQodGhpcywge1xuICAgICAgICBudW1QYWdlczogbnVsbCxcbiAgICAgICAgY291bnQ6IG51bGxcbiAgICB9KTtcblxuICAgIHRoaXMudmFsaWRhdGUoKTtcbn1cblxuXy5leHRlbmQoUGFnaW5hdG9yLnByb3RvdHlwZSwge1xuICAgIF9leHRyYWN0OiBmdW5jdGlvbiAocGF0aCwgZGF0YSwganFYSFIpIHtcbiAgICAgICAgaWYgKHBhdGgpIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgcGF0aCA9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICAgICAgZGF0YSA9IHBhdGgoZGF0YSwganFYSFIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgdmFyIHNwbHQgPSBwYXRoLnNwbGl0KCcuJyk7XG4gICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzcGx0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBrZXkgPSBzcGx0W2ldO1xuICAgICAgICAgICAgICAgICAgICBkYXRhID0gZGF0YVtrZXldO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZGF0YTtcbiAgICB9LFxuICAgIF9leHRyYWN0RGF0YTogZnVuY3Rpb24gKGRhdGEsIGpxWEhSKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9leHRyYWN0KHRoaXMub3B0cy5kYXRhUGF0aCwgZGF0YSwganFYSFIpO1xuICAgIH0sXG4gICAgX2V4dHJhY3ROdW1QYWdlczogZnVuY3Rpb24gKGRhdGEsIGpxWEhSKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9leHRyYWN0KHRoaXMub3B0cy5udW1QYWdlcywgZGF0YSwganFYSFIpO1xuICAgIH0sXG4gICAgX2V4dHJhY3RDb3VudDogZnVuY3Rpb24gKGRhdGEsIGpxWEhSKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9leHRyYWN0KHRoaXMub3B0cy5jb3VudCwgZGF0YSwganFYSFIpO1xuICAgIH0sXG4gICAgLyoqXG4gICAgICogdmFyIHBhcnNlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2EnKTtcbiAgICAgKiBwYXJzZXIuaHJlZiA9IFwiaHR0cDovL2V4YW1wbGUuY29tOjMwMDAvcGF0aG5hbWUvP3NlYXJjaD10ZXN0I2hhc2hcIjtcbiAgICAgKiBwYXJzZXIuaHJlZiA9IFVSTDtcbiAgICAgKiBwYXJzZXIucHJvdG9jb2w7IC8vID0+IFwiaHR0cDpcIlxuICAgICAqIHBhcnNlci5ob3N0bmFtZTsgLy8gPT4gXCJleGFtcGxlLmNvbVwiXG4gICAgICogcGFyc2VyLnBvcnQ7ICAgICAvLyA9PiBcIjMwMDBcIlxuICAgICAqIHBhcnNlci5wYXRobmFtZTsgLy8gPT4gXCIvcGF0aG5hbWUvXCJcbiAgICAgKiBwYXJzZXIuc2VhcmNoOyAgIC8vID0+IFwiP3NlYXJjaD10ZXN0XCJcbiAgICAgKiBwYXJzZXIuaGFzaDsgICAgIC8vID0+IFwiI2hhc2hcIlxuICAgICAqIHBhcnNlci5ob3N0OyAgICAgLy8gPT4gXCJleGFtcGxlLmNvbTozMDAwXCJcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gVVJMXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfcGFyc2VVUkw6IGZ1bmN0aW9uIChVUkwpIHtcbiAgICAgICAgdmFyIHBhcnNlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2EnKTtcbiAgICAgICAgcGFyc2VyLmhyZWYgPSBVUkw7XG4gICAgICAgIHJldHVybiBwYXJzZXI7XG4gICAgfSxcbiAgICBwYWdlOiBmdW5jdGlvbiAob3B0c09yQ2FsbGJhY2ssIGNhbGxiYWNrKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgdmFyIG9wdHMgPSB7fTtcbiAgICAgICAgaWYgKHR5cGVvZiBvcHRzT3JDYWxsYmFjayA9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICBjYWxsYmFjayA9IG9wdHNPckNhbGxiYWNrO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKG9wdHNPckNhbGxiYWNrKSB7XG4gICAgICAgICAgICBvcHRzID0gb3B0c09yQ2FsbGJhY2s7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIGRlZmVycmVkID0gdXRpbC5kZWZlcihjYWxsYmFjayk7XG4gICAgICAgIHZhciBwYWdlID0gb3B0cy5wYWdlLFxuICAgICAgICAgICAgcGFnZVNpemUgPSBvcHRzLnBhZ2VTaXplO1xuICAgICAgICBjYWxsYmFjayA9IGRlZmVycmVkLmZpbmlzaC5iaW5kKGRlZmVycmVkKTtcbiAgICAgICAgdmFyIGFqYXggPSBzaWVzdGEuZXh0Lmh0dHAuYWpheCxcbiAgICAgICAgICAgIGFqYXhPcHRzID0gXy5leHRlbmQoe30sIHRoaXMub3B0cyk7XG4gICAgICAgIHZhciBjb2xsZWN0aW9uID0gdGhpcy5vcHRzLm1vZGVsLmNvbGxlY3Rpb24sXG4gICAgICAgICAgICB1cmwgPSBjb2xsZWN0aW9uLmJhc2VVUkwgKyB0aGlzLm9wdHMucGF0aDtcbiAgICAgICAgaWYgKHRoaXMub3B0cy5xdWVyeVBhcmFtcykge1xuICAgICAgICAgICAgdmFyIHBhcnNlciA9IHRoaXMuX3BhcnNlVVJMKHVybCk7XG4gICAgICAgICAgICB2YXIgcmF3UXVlcnkgPSBwYXJzZXIuc2VhcmNoLFxuICAgICAgICAgICAgICAgIHJhd1F1ZXJ5U3BsdCA9IHJhd1F1ZXJ5LnNwbGl0KCc/Jyk7XG4gICAgICAgICAgICBpZiAocmF3UXVlcnlTcGx0Lmxlbmd0aCA+IDEpIHJhd1F1ZXJ5ID0gcmF3UXVlcnlTcGx0WzFdO1xuICAgICAgICAgICAgdmFyIHF1ZXJ5ID0gcXVlcnlzdHJpbmcucGFyc2UocmF3UXVlcnkpO1xuICAgICAgICAgICAgaWYgKHBhZ2UpIHtcbiAgICAgICAgICAgICAgICBxdWVyeVt0aGlzLm9wdHMucGFnZV0gPSBwYWdlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHBhZ2VTaXplKSB7XG4gICAgICAgICAgICAgICAgcXVlcnlbdGhpcy5vcHRzLnBhZ2VTaXplXSA9IHBhZ2VTaXplO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKE9iamVjdC5rZXlzKHF1ZXJ5KS5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICBwYXJzZXIuc2VhcmNoID0gJz8nICsgcXVlcnlzdHJpbmcuc3RyaW5naWZ5KHF1ZXJ5KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHVybCA9IHBhcnNlci5ocmVmO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdmFyIGRhdGEgPSB7fTtcbiAgICAgICAgICAgIGlmIChwYWdlKSB7XG4gICAgICAgICAgICAgICAgZGF0YVt0aGlzLm9wdHMucGFnZV0gPSBwYWdlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHBhZ2VTaXplKSB7XG4gICAgICAgICAgICAgICAgZGF0YVt0aGlzLm9wdHMucGFnZVNpemVdID0gcGFnZVNpemU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBhamF4T3B0cy5kYXRhID0gZGF0YVxuICAgICAgICB9XG4gICAgICAgIF8uZXh0ZW5kKGFqYXhPcHRzLCB7XG4gICAgICAgICAgICB1cmw6IHVybCxcbiAgICAgICAgICAgIHN1Y2Nlc3M6IGZ1bmN0aW9uIChkYXRhLCB0ZXh0U3RhdHVzLCBqcVhIUikge1xuICAgICAgICAgICAgICAgIHZhciBtb2RlbERhdGEgPSBzZWxmLl9leHRyYWN0RGF0YShkYXRhLCBqcVhIUiksXG4gICAgICAgICAgICAgICAgICAgIGNvdW50ID0gc2VsZi5fZXh0cmFjdENvdW50KGRhdGEsIGpxWEhSKSxcbiAgICAgICAgICAgICAgICAgICAgbnVtUGFnZXMgPSBzZWxmLl9leHRyYWN0TnVtUGFnZXMoZGF0YSwganFYSFIpO1xuXG4gICAgICAgICAgICAgICAgc2VsZi5vcHRzLm1vZGVsLm1hcChtb2RlbERhdGEsIGZ1bmN0aW9uIChlcnIsIG1vZGVsSW5zdGFuY2VzKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzZWxmLmNvdW50ID0gY291bnQ7XG4gICAgICAgICAgICAgICAgICAgICAgICBzZWxmLm51bVBhZ2VzID0gbnVtUGFnZXM7XG4gICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhudWxsLCBtb2RlbEluc3RhbmNlcywge2RhdGE6IGRhdGEsIHRleHRTdGF0dXM6IHRleHRTdGF0dXMsIGpxWEhSOiBqcVhIUn0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGZhaWw6IGNhbGxiYWNrXG4gICAgICAgIH0pO1xuICAgICAgICBhamF4KGFqYXhPcHRzKTtcbiAgICAgICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG4gICAgfSxcbiAgICB2YWxpZGF0ZTogZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAoIXRoaXMub3B0cy5tb2RlbCkgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ1BhZ2luYXRvciBtdXN0IGhhdmUgYSBtb2RlbCcpO1xuICAgIH1cbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFBhZ2luYXRvcjsiLCIvKipcbiAqIEBtb2R1bGUgaHR0cFxuICovXG5cbnZhciBEZXNjcmlwdG9yID0gcmVxdWlyZSgnLi9kZXNjcmlwdG9yJykuRGVzY3JpcHRvcixcbiAgICBTZXJpYWxpc2VyID0gcmVxdWlyZSgnLi9zZXJpYWxpc2VyJyk7XG5cbnZhciBfaW50ZXJuYWwgPSBzaWVzdGEuX2ludGVybmFsLFxuICAgIHV0aWwgPSBfaW50ZXJuYWwudXRpbCxcbiAgICBfID0gdXRpbC5fLFxuICAgIGxvZyA9IF9pbnRlcm5hbC5sb2csXG4gICAgZGVmaW5lU3ViUHJvcGVydHkgPSB1dGlsLmRlZmluZVN1YlByb3BlcnR5XG4gICAgO1xuXG52YXIgTG9nZ2VyID0gbG9nLmxvZ2dlcldpdGhOYW1lKCdEZXNjcmlwdG9yJyk7XG5cbi8qKlxuICogQGNsYXNzIERlc2NyaWJlcyBhIEhUVFAgcmVxdWVzdFxuICogQHBhcmFtIHtPYmplY3R9IG9wdHNcbiAqL1xuZnVuY3Rpb24gUmVxdWVzdERlc2NyaXB0b3Iob3B0cykge1xuICAgIGlmICghdGhpcykge1xuICAgICAgICByZXR1cm4gbmV3IFJlcXVlc3REZXNjcmlwdG9yKG9wdHMpO1xuICAgIH1cblxuICAgIERlc2NyaXB0b3IuY2FsbCh0aGlzLCBvcHRzKTtcbiAgICBpZiAodGhpcy5fb3B0c1snc2VyaWFsaXplciddKSB7XG4gICAgICAgIHRoaXMuX29wdHMuc2VyaWFsaXNlciA9IHRoaXMuX29wdHNbJ3NlcmlhbGl6ZXInXTtcbiAgICB9XG5cbiAgICBpZiAoIXRoaXMuX29wdHMuc2VyaWFsaXNlcikge1xuICAgICAgICB0aGlzLl9vcHRzLnNlcmlhbGlzZXIgPSBTZXJpYWxpc2VyLmRlcHRoU2VyaWFsaXplcigwKTtcbiAgICB9XG5cblxuICAgIGRlZmluZVN1YlByb3BlcnR5LmNhbGwodGhpcywgJ3NlcmlhbGlzZXInLCB0aGlzLl9vcHRzKTtcbiAgICBkZWZpbmVTdWJQcm9wZXJ0eS5jYWxsKHRoaXMsICdzZXJpYWxpemVyJywgdGhpcy5fb3B0cywgJ3NlcmlhbGlzZXInKTtcblxufVxuXG5SZXF1ZXN0RGVzY3JpcHRvci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKERlc2NyaXB0b3IucHJvdG90eXBlKTtcblxuXy5leHRlbmQoUmVxdWVzdERlc2NyaXB0b3IucHJvdG90eXBlLCB7XG4gICAgX3NlcmlhbGlzZTogZnVuY3Rpb24gKG9iaiwgY2FsbGJhY2spIHtcbiAgICAgICAgdmFyIGRlZmVycmVkID0gdXRpbC5kZWZlcihjYWxsYmFjayk7XG4gICAgICAgIGNhbGxiYWNrID0gZGVmZXJyZWQuZmluaXNoLmJpbmQoZGVmZXJyZWQpO1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKVxuICAgICAgICAgICAgTG9nZ2VyLnRyYWNlKCdfc2VyaWFsaXNlJyk7XG4gICAgICAgIHZhciBmaW5pc2hlZDtcbiAgICAgICAgdmFyIGRhdGEgPSB0aGlzLnNlcmlhbGlzZXIob2JqLCBmdW5jdGlvbiAoZXJyLCBkYXRhKSB7XG4gICAgICAgICAgICBpZiAoIWZpbmlzaGVkKSB7XG4gICAgICAgICAgICAgICAgZGF0YSA9IHNlbGYuX3RyYW5zZm9ybURhdGEoZGF0YSk7XG4gICAgICAgICAgICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhlcnIsIHNlbGYuX2VtYmVkRGF0YShkYXRhKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICBpZiAoZGF0YSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBpZiAoTG9nZ2VyLnRyYWNlLmlzRW5hYmxlZClcbiAgICAgICAgICAgICAgICBMb2dnZXIudHJhY2UoJ3NlcmlhbGlzZXIgZG9lc250IHVzZSBhIGNhbGxiYWNrJyk7XG4gICAgICAgICAgICBmaW5pc2hlZCA9IHRydWU7XG4gICAgICAgICAgICBkYXRhID0gc2VsZi5fdHJhbnNmb3JtRGF0YShkYXRhKTtcbiAgICAgICAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2sobnVsbCwgc2VsZi5fZW1iZWREYXRhKGRhdGEpKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKVxuICAgICAgICAgICAgICAgIExvZ2dlci50cmFjZSgnc2VyaWFsaXNlciB1c2VzIGEgY2FsbGJhY2snLCB0aGlzLnNlcmlhbGlzZXIpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xuICAgIH0sXG4gICAgX2R1bXA6IGZ1bmN0aW9uIChhc0pzb24pIHtcbiAgICAgICAgdmFyIG9iaiA9IHt9O1xuICAgICAgICBvYmoubWV0aG9kcyA9IHRoaXMubWV0aG9kO1xuICAgICAgICBvYmoubW9kZWwgPSB0aGlzLm1vZGVsLm5hbWU7XG4gICAgICAgIG9iai5wYXRoID0gdGhpcy5fcmF3T3B0cy5wYXRoO1xuICAgICAgICB2YXIgc2VyaWFsaXNlcjtcbiAgICAgICAgaWYgKHR5cGVvZih0aGlzLl9yYXdPcHRzLnNlcmlhbGlzZXIpID09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIHNlcmlhbGlzZXIgPSAnZnVuY3Rpb24gKCkgeyAuLi4gfSdcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHNlcmlhbGlzZXIgPSB0aGlzLl9yYXdPcHRzLnNlcmlhbGlzZXI7XG4gICAgICAgIH1cbiAgICAgICAgb2JqLnNlcmlhbGlzZXIgPSBzZXJpYWxpc2VyO1xuICAgICAgICB2YXIgdHJhbnNmb3JtcyA9IHt9O1xuICAgICAgICBmb3IgKHZhciBmIGluIHRoaXMudHJhbnNmb3Jtcykge1xuICAgICAgICAgICAgaWYgKHRoaXMudHJhbnNmb3Jtcy5oYXNPd25Qcm9wZXJ0eShmKSkge1xuICAgICAgICAgICAgICAgIHZhciB0cmFuc2Zvcm0gPSB0aGlzLnRyYW5zZm9ybXNbZl07XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZih0cmFuc2Zvcm0pID09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgICAgICAgICAgdHJhbnNmb3Jtc1tmXSA9ICdmdW5jdGlvbiAoKSB7IC4uLiB9J1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdHJhbnNmb3Jtc1tmXSA9IHRoaXMudHJhbnNmb3Jtc1tmXTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgb2JqLnRyYW5zZm9ybXMgPSB0cmFuc2Zvcm1zO1xuICAgICAgICByZXR1cm4gYXNKc29uID8gdXRpbC5wcmV0dHlQcmludChvYmopIDogb2JqO1xuICAgIH1cbn0pO1xuXG5leHBvcnRzLlJlcXVlc3REZXNjcmlwdG9yID0gUmVxdWVzdERlc2NyaXB0b3I7XG4iLCIvKipcbiAqIEBtb2R1bGUgaHR0cFxuICovXG5cblxudmFyIERlc2NyaXB0b3IgPSByZXF1aXJlKCcuL2Rlc2NyaXB0b3InKS5EZXNjcmlwdG9yO1xuXG4vKipcbiAqIERlc2NyaWJlcyB3aGF0IHRvIGRvIHdpdGggYSBIVFRQIHJlc3BvbnNlLlxuICogQGNvbnN0cnVjdG9yXG4gKiBAaW1wbGVtZW50cyB7RGVzY3JpcHRvcn1cbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRzXG4gKi9cbmZ1bmN0aW9uIFJlc3BvbnNlRGVzY3JpcHRvcihvcHRzKSB7XG4gICAgaWYgKCF0aGlzKSB7XG4gICAgICAgIHJldHVybiBuZXcgUmVzcG9uc2VEZXNjcmlwdG9yKG9wdHMpO1xuICAgIH1cbiAgICBEZXNjcmlwdG9yLmNhbGwodGhpcywgb3B0cyk7XG59XG5cblJlc3BvbnNlRGVzY3JpcHRvci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKERlc2NyaXB0b3IucHJvdG90eXBlKTtcblxuXy5leHRlbmQoUmVzcG9uc2VEZXNjcmlwdG9yLnByb3RvdHlwZSwge1xuICAgIF9leHRyYWN0RGF0YTogZnVuY3Rpb24gKGRhdGEpIHtcbiAgICAgICAgdmFyIGV4dHJhY3RlZERhdGEgPSBEZXNjcmlwdG9yLnByb3RvdHlwZS5fZXh0cmFjdERhdGEuY2FsbCh0aGlzLCBkYXRhKTtcbiAgICAgICAgaWYgKGV4dHJhY3RlZERhdGEpIHtcbiAgICAgICAgICAgIGV4dHJhY3RlZERhdGEgPSB0aGlzLl90cmFuc2Zvcm1EYXRhKGV4dHJhY3RlZERhdGEpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBleHRyYWN0ZWREYXRhO1xuICAgIH0sXG4gICAgX21hdGNoRGF0YTogZnVuY3Rpb24gKGRhdGEpIHtcbiAgICAgICAgdmFyIGV4dHJhY3RlZERhdGEgPSBEZXNjcmlwdG9yLnByb3RvdHlwZS5fbWF0Y2hEYXRhLmNhbGwodGhpcywgZGF0YSk7XG4gICAgICAgIGlmIChleHRyYWN0ZWREYXRhKSB7XG4gICAgICAgICAgICBleHRyYWN0ZWREYXRhID0gdGhpcy5fdHJhbnNmb3JtRGF0YShleHRyYWN0ZWREYXRhKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZXh0cmFjdGVkRGF0YTtcbiAgICB9LFxuICAgIF9kdW1wOiBmdW5jdGlvbiAoYXNKc29uKSB7XG4gICAgICAgIHZhciBvYmogPSB7fTtcbiAgICAgICAgb2JqLm1ldGhvZHMgPSB0aGlzLm1ldGhvZDtcbiAgICAgICAgb2JqLm1vZGVsID0gdGhpcy5tb2RlbC5uYW1lO1xuICAgICAgICBvYmoucGF0aCA9IHRoaXMuX3Jhd09wdHMucGF0aDtcbiAgICAgICAgdmFyIHRyYW5zZm9ybXMgPSB7fTtcbiAgICAgICAgZm9yICh2YXIgZiBpbiB0aGlzLnRyYW5zZm9ybXMpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLnRyYW5zZm9ybXMuaGFzT3duUHJvcGVydHkoZikpIHtcbiAgICAgICAgICAgICAgICB2YXIgdHJhbnNmb3JtID0gdGhpcy50cmFuc2Zvcm1zW2ZdO1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YodHJhbnNmb3JtKSA9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICAgICAgICAgIHRyYW5zZm9ybXNbZl0gPSAnZnVuY3Rpb24gKCkgeyAuLi4gfSdcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRyYW5zZm9ybXNbZl0gPSB0aGlzLnRyYW5zZm9ybXNbZl07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIG9iai50cmFuc2Zvcm1zID0gdHJhbnNmb3JtcztcbiAgICAgICAgcmV0dXJuIGFzSnNvbiA/IHV0aWwucHJldHR5UHJpbnQob2JqKSA6IG9iajtcbiAgICB9XG59KTtcblxuZXhwb3J0cy5SZXNwb25zZURlc2NyaXB0b3IgPSBSZXNwb25zZURlc2NyaXB0b3I7IiwiLyoqXG4gKiBAbW9kdWxlIGh0dHBcbiAqL1xuXG52YXIgX2ludGVybmFsID0gc2llc3RhLl9pbnRlcm5hbDtcblxudmFyIGxvZyA9IF9pbnRlcm5hbC5sb2csXG4gICAgdXRpbHMgPSBfaW50ZXJuYWwudXRpbDtcbnZhciBMb2dnZXIgPSBsb2cubG9nZ2VyV2l0aE5hbWUoJ1NlcmlhbGlzYXRpb24nKTtcbnZhciBfID0gdXRpbHMuXztcblxuXG4vKipcbiAqIFNlcmlhbGlzZXMgYW4gb2JqZWN0IGludG8gaXQncyByZW1vdGUgaWRlbnRpZmllciAoYXMgZGVmaW5lZCBieSB0aGUgbWFwcGluZylcbiAqIEBwYXJhbSAge01vZGVsSW5zdGFuY2V9IG9ialxuICogQHJldHVybiB7U3RyaW5nfVxuICpcbiAqL1xuZnVuY3Rpb24gaWRTZXJpYWxpc2VyKG9iaikge1xuICAgIHZhciBpZEZpZWxkID0gb2JqLm1vZGVsLmlkO1xuICAgIGlmIChpZEZpZWxkKSB7XG4gICAgICAgIHJldHVybiBvYmpbaWRGaWVsZF0gPyBvYmpbaWRGaWVsZF0gOiBudWxsO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgaWYgKExvZ2dlci5kZWJ1Zy5pc0VuYWJsZWQpXG4gICAgICAgICAgICBMb2dnZXIuZGVidWcoJ05vIGlkZmllbGQnKTtcbiAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG59XG5cbi8qKlxuICogU2VyaWFsaXNlcyBvYmogZm9sbG93aW5nIHJlbGF0aW9uc2hpcHMgdG8gc3BlY2lmaWVkIGRlcHRoLlxuICogQHBhcmFtICB7SW50ZWdlcn0gICBkZXB0aFxuICogQHBhcmFtICB7TW9kZWxJbnN0YW5jZX0gICBvYmpcbiAqIEBwYXJhbSAge0Z1bmN0aW9ufSBjYWxsYmFja1xuICovXG5mdW5jdGlvbiBkZXB0aFNlcmlhbGlzZXIoZGVwdGgsIG9iaiwgY2FsbGJhY2spIHtcbiAgICBjYWxsYmFjayA9IGNhbGxiYWNrIHx8IGZ1bmN0aW9uICgpIHt9O1xuICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKVxuICAgICAgICBMb2dnZXIudHJhY2UoJ2RlcHRoU2VyaWFsaXNlcicpO1xuICAgIHZhciBkYXRhID0ge307XG4gICAgXy5lYWNoKG9iai5fYXR0cmlidXRlTmFtZXMsIGZ1bmN0aW9uIChmKSB7XG4gICAgICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKVxuICAgICAgICAgICAgTG9nZ2VyLnRyYWNlKCdmaWVsZCcsIGYpO1xuICAgICAgICBpZiAob2JqW2ZdKSB7XG4gICAgICAgICAgICBkYXRhW2ZdID0gb2JqW2ZdO1xuICAgICAgICB9XG4gICAgfSk7XG4gICAgdmFyIHdhaXRpbmcgPSBbXSxcbiAgICAgICAgZXJyb3JzID0gW10sXG4gICAgICAgIHJlc3VsdCA9IHt9LFxuICAgICAgICBmaW5pc2hlZCA9IFtdO1xuICAgIF8uZWFjaChvYmouX3JlbGF0aW9uc2hpcE5hbWVzLCBmdW5jdGlvbiAoZikge1xuICAgICAgICBpZiAoTG9nZ2VyLnRyYWNlLmlzRW5hYmxlZClcbiAgICAgICAgICAgIExvZ2dlci50cmFjZSgncmVsYXRpb25zaGlwRmllbGQnLCBmKTtcbiAgICAgICAgdmFyIHByb3h5ID0gb2JqLl9fcHJveGllc1tmXTtcbiAgICAgICAgaWYgKHByb3h5LmlzRm9yd2FyZCkgeyAvLyBCeSBkZWZhdWx0IG9ubHkgZm9yd2FyZCByZWxhdGlvbnNoaXBzXG4gICAgICAgICAgICBpZiAoTG9nZ2VyLmRlYnVnLmlzRW5hYmxlZClcbiAgICAgICAgICAgICAgICBMb2dnZXIuZGVidWcoZik7XG4gICAgICAgICAgICB3YWl0aW5nLnB1c2goZik7XG4gICAgICAgICAgICBwcm94eS5nZXQoZnVuY3Rpb24gKGVyciwgdikge1xuICAgICAgICAgICAgICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKVxuICAgICAgICAgICAgICAgICAgICBMb2dnZXIudHJhY2UoJ3Byb3h5LmdldCcsIGYpO1xuICAgICAgICAgICAgICAgIGlmIChMb2dnZXIuZGVidWcuaXNFbmFibGVkKVxuICAgICAgICAgICAgICAgICAgICBMb2dnZXIuZGVidWcoZiwgdik7XG4gICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICBlcnJvcnMucHVzaChlcnIpO1xuICAgICAgICAgICAgICAgICAgICBmaW5pc2hlZC5wdXNoKGYpO1xuICAgICAgICAgICAgICAgICAgICByZXN1bHRbZl0gPSB7ZXJyOiBlcnIsIHY6IHZ9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIGlmICh2KSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghZGVwdGgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZpbmlzaGVkLnB1c2goZik7XG4gICAgICAgICAgICAgICAgICAgICAgICBkYXRhW2ZdID0gdltvYmouX19wcm94aWVzW2ZdLmZvcndhcmRNb2RlbC5pZF07XG4gICAgICAgICAgICAgICAgICAgICAgICByZXN1bHRbZl0gPSB7ZXJyOiBlcnIsIHY6IHZ9O1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCh3YWl0aW5nLmxlbmd0aCA9PSBmaW5pc2hlZC5sZW5ndGgpICYmIGNhbGxiYWNrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyb3JzLmxlbmd0aCA/IGVycm9ycyA6IG51bGwsIGRhdGEsIHJlc3VsdCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkZXB0aFNlcmlhbGlzZXIoZGVwdGggLSAxLCB2LCBmdW5jdGlvbiAoZXJyLCBzdWJEYXRhLCByZXNwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlcnJvcnMucHVzaChlcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0YVtmXSA9IHN1YkRhdGE7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZpbmlzaGVkLnB1c2goZik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzdWx0W2ZdID0ge2VycjogZXJyLCB2OiB2LCByZXNwOiByZXNwfTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoKHdhaXRpbmcubGVuZ3RoID09IGZpbmlzaGVkLmxlbmd0aCkgJiYgY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyb3JzLmxlbmd0aCA/IGVycm9ycyA6IG51bGwsIGRhdGEsIHJlc3VsdCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChMb2dnZXIuZGVidWcuaXNFbmFibGVkKVxuICAgICAgICAgICAgICAgICAgICAgICAgTG9nZ2VyLmRlYnVnKCdubyB2YWx1ZSBmb3IgJyArIGYpO1xuICAgICAgICAgICAgICAgICAgICBmaW5pc2hlZC5wdXNoKGYpO1xuICAgICAgICAgICAgICAgICAgICByZXN1bHRbZl0gPSB7ZXJyOiBlcnIsIHY6IHZ9O1xuICAgICAgICAgICAgICAgICAgICBpZiAoKHdhaXRpbmcubGVuZ3RoID09IGZpbmlzaGVkLmxlbmd0aCkgJiYgY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycm9ycy5sZW5ndGggPyBlcnJvcnMgOiBudWxsLCBkYXRhLCByZXN1bHQpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBpZiAoIXdhaXRpbmcubGVuZ3RoKSB7XG4gICAgICAgIGNhbGxiYWNrKG51bGwsIGRhdGEsIHt9KTtcbiAgICB9XG59XG5cblxuZXhwb3J0cy5kZXB0aFNlcmlhbGlzZXIgPSBmdW5jdGlvbiAoZGVwdGgpIHtcbiAgICByZXR1cm4gXy5wYXJ0aWFsKGRlcHRoU2VyaWFsaXNlciwgZGVwdGgpO1xufTtcbmV4cG9ydHMuZGVwdGhTZXJpYWxpemVyID0gZnVuY3Rpb24gKGRlcHRoKSB7XG4gICAgcmV0dXJuIF8ucGFydGlhbChkZXB0aFNlcmlhbGlzZXIsIGRlcHRoKTtcbn07XG5leHBvcnRzLmlkU2VyaWFsaXplciA9IGlkU2VyaWFsaXNlcjtcbmV4cG9ydHMuaWRTZXJpYWxpc2VyID0gaWRTZXJpYWxpc2VyO1xuXG4iLCIvLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxuJ3VzZSBzdHJpY3QnO1xuXG4vLyBJZiBvYmouaGFzT3duUHJvcGVydHkgaGFzIGJlZW4gb3ZlcnJpZGRlbiwgdGhlbiBjYWxsaW5nXG4vLyBvYmouaGFzT3duUHJvcGVydHkocHJvcCkgd2lsbCBicmVhay5cbi8vIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL2pveWVudC9ub2RlL2lzc3Vlcy8xNzA3XG5mdW5jdGlvbiBoYXNPd25Qcm9wZXJ0eShvYmosIHByb3ApIHtcbiAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvYmosIHByb3ApO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHFzLCBzZXAsIGVxLCBvcHRpb25zKSB7XG4gIHNlcCA9IHNlcCB8fCAnJic7XG4gIGVxID0gZXEgfHwgJz0nO1xuICB2YXIgb2JqID0ge307XG5cbiAgaWYgKHR5cGVvZiBxcyAhPT0gJ3N0cmluZycgfHwgcXMubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuXG4gIHZhciByZWdleHAgPSAvXFwrL2c7XG4gIHFzID0gcXMuc3BsaXQoc2VwKTtcblxuICB2YXIgbWF4S2V5cyA9IDEwMDA7XG4gIGlmIChvcHRpb25zICYmIHR5cGVvZiBvcHRpb25zLm1heEtleXMgPT09ICdudW1iZXInKSB7XG4gICAgbWF4S2V5cyA9IG9wdGlvbnMubWF4S2V5cztcbiAgfVxuXG4gIHZhciBsZW4gPSBxcy5sZW5ndGg7XG4gIC8vIG1heEtleXMgPD0gMCBtZWFucyB0aGF0IHdlIHNob3VsZCBub3QgbGltaXQga2V5cyBjb3VudFxuICBpZiAobWF4S2V5cyA+IDAgJiYgbGVuID4gbWF4S2V5cykge1xuICAgIGxlbiA9IG1heEtleXM7XG4gIH1cblxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbjsgKytpKSB7XG4gICAgdmFyIHggPSBxc1tpXS5yZXBsYWNlKHJlZ2V4cCwgJyUyMCcpLFxuICAgICAgICBpZHggPSB4LmluZGV4T2YoZXEpLFxuICAgICAgICBrc3RyLCB2c3RyLCBrLCB2O1xuXG4gICAgaWYgKGlkeCA+PSAwKSB7XG4gICAgICBrc3RyID0geC5zdWJzdHIoMCwgaWR4KTtcbiAgICAgIHZzdHIgPSB4LnN1YnN0cihpZHggKyAxKTtcbiAgICB9IGVsc2Uge1xuICAgICAga3N0ciA9IHg7XG4gICAgICB2c3RyID0gJyc7XG4gICAgfVxuXG4gICAgayA9IGRlY29kZVVSSUNvbXBvbmVudChrc3RyKTtcbiAgICB2ID0gZGVjb2RlVVJJQ29tcG9uZW50KHZzdHIpO1xuXG4gICAgaWYgKCFoYXNPd25Qcm9wZXJ0eShvYmosIGspKSB7XG4gICAgICBvYmpba10gPSB2O1xuICAgIH0gZWxzZSBpZiAoaXNBcnJheShvYmpba10pKSB7XG4gICAgICBvYmpba10ucHVzaCh2KTtcbiAgICB9IGVsc2Uge1xuICAgICAgb2JqW2tdID0gW29ialtrXSwgdl07XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIG9iajtcbn07XG5cbnZhciBpc0FycmF5ID0gQXJyYXkuaXNBcnJheSB8fCBmdW5jdGlvbiAoeHMpIHtcbiAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbCh4cykgPT09ICdbb2JqZWN0IEFycmF5XSc7XG59O1xuIiwiLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGFcbi8vIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGVcbi8vIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZ1xuLy8gd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLFxuLy8gZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdFxuLy8gcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlXG4vLyBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZFxuLy8gaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTU1xuLy8gT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRlxuLy8gTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTlxuLy8gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sXG4vLyBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1Jcbi8vIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEVcbi8vIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG5cbid1c2Ugc3RyaWN0JztcblxudmFyIHN0cmluZ2lmeVByaW1pdGl2ZSA9IGZ1bmN0aW9uKHYpIHtcbiAgc3dpdGNoICh0eXBlb2Ygdikge1xuICAgIGNhc2UgJ3N0cmluZyc6XG4gICAgICByZXR1cm4gdjtcblxuICAgIGNhc2UgJ2Jvb2xlYW4nOlxuICAgICAgcmV0dXJuIHYgPyAndHJ1ZScgOiAnZmFsc2UnO1xuXG4gICAgY2FzZSAnbnVtYmVyJzpcbiAgICAgIHJldHVybiBpc0Zpbml0ZSh2KSA/IHYgOiAnJztcblxuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gJyc7XG4gIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24ob2JqLCBzZXAsIGVxLCBuYW1lKSB7XG4gIHNlcCA9IHNlcCB8fCAnJic7XG4gIGVxID0gZXEgfHwgJz0nO1xuICBpZiAob2JqID09PSBudWxsKSB7XG4gICAgb2JqID0gdW5kZWZpbmVkO1xuICB9XG5cbiAgaWYgKHR5cGVvZiBvYmogPT09ICdvYmplY3QnKSB7XG4gICAgcmV0dXJuIG1hcChvYmplY3RLZXlzKG9iaiksIGZ1bmN0aW9uKGspIHtcbiAgICAgIHZhciBrcyA9IGVuY29kZVVSSUNvbXBvbmVudChzdHJpbmdpZnlQcmltaXRpdmUoaykpICsgZXE7XG4gICAgICBpZiAoaXNBcnJheShvYmpba10pKSB7XG4gICAgICAgIHJldHVybiBtYXAob2JqW2tdLCBmdW5jdGlvbih2KSB7XG4gICAgICAgICAgcmV0dXJuIGtzICsgZW5jb2RlVVJJQ29tcG9uZW50KHN0cmluZ2lmeVByaW1pdGl2ZSh2KSk7XG4gICAgICAgIH0pLmpvaW4oc2VwKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBrcyArIGVuY29kZVVSSUNvbXBvbmVudChzdHJpbmdpZnlQcmltaXRpdmUob2JqW2tdKSk7XG4gICAgICB9XG4gICAgfSkuam9pbihzZXApO1xuXG4gIH1cblxuICBpZiAoIW5hbWUpIHJldHVybiAnJztcbiAgcmV0dXJuIGVuY29kZVVSSUNvbXBvbmVudChzdHJpbmdpZnlQcmltaXRpdmUobmFtZSkpICsgZXEgK1xuICAgICAgICAgZW5jb2RlVVJJQ29tcG9uZW50KHN0cmluZ2lmeVByaW1pdGl2ZShvYmopKTtcbn07XG5cbnZhciBpc0FycmF5ID0gQXJyYXkuaXNBcnJheSB8fCBmdW5jdGlvbiAoeHMpIHtcbiAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbCh4cykgPT09ICdbb2JqZWN0IEFycmF5XSc7XG59O1xuXG5mdW5jdGlvbiBtYXAgKHhzLCBmKSB7XG4gIGlmICh4cy5tYXApIHJldHVybiB4cy5tYXAoZik7XG4gIHZhciByZXMgPSBbXTtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCB4cy5sZW5ndGg7IGkrKykge1xuICAgIHJlcy5wdXNoKGYoeHNbaV0sIGkpKTtcbiAgfVxuICByZXR1cm4gcmVzO1xufVxuXG52YXIgb2JqZWN0S2V5cyA9IE9iamVjdC5rZXlzIHx8IGZ1bmN0aW9uIChvYmopIHtcbiAgdmFyIHJlcyA9IFtdO1xuICBmb3IgKHZhciBrZXkgaW4gb2JqKSB7XG4gICAgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvYmosIGtleSkpIHJlcy5wdXNoKGtleSk7XG4gIH1cbiAgcmV0dXJuIHJlcztcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbmV4cG9ydHMuZGVjb2RlID0gZXhwb3J0cy5wYXJzZSA9IHJlcXVpcmUoJy4vZGVjb2RlJyk7XG5leHBvcnRzLmVuY29kZSA9IGV4cG9ydHMuc3RyaW5naWZ5ID0gcmVxdWlyZSgnLi9lbmNvZGUnKTtcbiJdfQ==
