(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/**
 * Descriptors deal with the description of HTTP requests and are used by Siesta to determine what to do
 * with HTTP request/response bodies.
 * @module http
 */

var _i = siesta._internal,
    log = _i.log,
    InternalSiestaError = _i.error.InternalSiestaError,
    assert = _i.misc.assert,
    defineSubProperty = _i.misc.defineSubProperty,
    CollectionRegistry = _i.CollectionRegistry,
    extend = _i.extend,
    util = _i.util,
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

    // TODO: This is a bit hacky.
    // Essentially hacking named groups into javascript regular expressions.
    // Originally was using XRegExp but that library is 300kb, 30k gunzipped. Fuck that.
    // I do suspect that this is a bit sketchy tho...
    var processPath = function (raw) {
        var r = /\?<([0-9a-zA-Z_-]*)>/g;
        var match, names = [];
        while (match = r.exec(raw)) {
            var name = match[1];
            names.push(name);
        }
        raw = raw.replace(r, '');
        var regExp = new RegExp(raw, 'g');
        return {names: names, regExp: regExp};
    }.bind(this);

    if (this._opts.path) {
        var paths = this._opts.path;
        if (!util.isArray(paths)) {
            paths = [paths];
        }

        this._opts.path = [];
        this.names = [];

        _.each(paths, function (p) {
            var __ret = processPath.call(this, p);
            this._opts.path.push(__ret.regExp);
            this.names.push(__ret.names);
        }.bind(this));
    } else {
        this._opts.path = [''];
        this.names = [[]];
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
     * Takes a regex path and returns an object if matched.
     * If any regular expression groups were defined, the returned object will contain the matches.
     *
     * @param  {String|RegExp} path
     * @return {Object}
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
        var matches = [];
        var matched;
        for (i=0; i<this._opts.path.length; i++) {
            var names = this.names[i];
            var regExp = this._opts.path[i];
            var match = regExp.exec(path);
            if (match) {
                for (i = 1; i < match.length; i++) {
                    matches.push(match[i]);
                }
                if (matches.length == names.length) {
                    matched = {};
                    _.each(matches, function (m, i) {
                        matched[names[i]] = m;
                    }.bind(this));
                    break;
                }
            }
        }
        return matched;
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
        if (matches) {
            if (Logger.trace.isEnabled)
                Logger.trace('matched config');
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
        if (extractedData) {
            Logger.trace('matched data');
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
            Logger.trace('config matches');
            extractedData = this._matchData(data);
            matches = !!extractedData;
            if (matches) {
                var key;
                if (util.isArray(extractedData)) {
                    for (key in regexMatches) {
                        if (regexMatches.hasOwnProperty(key)) {
                            _.each(extractedData, function (datum) {
                                datum[key] = regexMatches[key];
                            });
                        }
                    }
                } else {
                    for (key in regexMatches) {
                        if (regexMatches.hasOwnProperty(key)) {
                            extractedData[key] = regexMatches[key];
                        }
                    }
                }
                Logger.trace('data matches');
            } else {
                Logger.trace('data doesnt match');
            }
        } else {
            Logger.trace('config doesnt match');
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
var _i = siesta._internal;
var log = _i.log;
var Logger = log.loggerWithName('DescriptorRegistry');
Logger.setLevel(log.Level.warn);

var assert = _i.misc.assert,
    util = _i.util,
    _ = util._;


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
    _ = util._,
    descriptor = require('./descriptor'),
    InternalSiestaError = _i.error.InternalSiestaError;

var DescriptorRegistry = require('./descriptorRegistry').DescriptorRegistry;


var Logger = log.loggerWithName('HTTP');
Logger.setLevel(log.Level.warn);

/**
 * Send a HTTP request to the given method and path parsing the response.
 * @param {String} method
 * @param {String} path The path to the resource we want to GET
 * @param {Object|Function} optsOrCallback Either an options object or a callback if can use defaults
 * @param {Function} callback Callback if opts specified.
 */
function _httpResponse(method, path) {
    var self = this;
    var args = Array.prototype.slice.call(arguments, 2);
    var callback;
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
    opts.success = function(data, textStatus, jqXHR) {
        if (Logger.trace.isEnabled)
            Logger.trace(opts.type + ' ' + jqXHR.status + ' ' + opts.url + ': ' + JSON.stringify(data, null, 4));
        var resp = {
            data: data,
            textStatus: textStatus,
            jqXHR: jqXHR
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
                if (Logger.trace.isEnabled)
                    Logger.trace('Mapping extracted data: ' + JSON.stringify(extractedData, null, 4));
                if (typeof(extractedData) == 'object') {
                    var mapping = matchedDescriptor.mapping;
                    mapping.map(extractedData, function(err, obj) {
                        if (callback) {

                            callback(err, obj, resp);
                        }
                    }, opts.obj);
                } else { // Matched, but no data.
                    callback(null, true, resp);
                }
            } else if (callback) {
                if (name) {
                    callback('No descriptor matched.', null, resp);
                } else {
                    // There was a bug where collection name doesn't exist. If this occurs, then will never get hold of any descriptors.
                    throw new InternalSiestaError('Unnamed collection');
                }
            }
        } else {
            callback(null, null, resp);
        }

    };
    opts.error = function(jqXHR, textStatus, errorThrown) {
        var resp = {
            jqXHR: jqXHR,
            textStatus: textStatus,
            errorThrown: errorThrown
        };
        if (callback) callback(resp, null, resp);
    };
    if (Logger.trace.isEnabled)
        Logger.trace('Ajax request:', opts);
    siesta.ext.http.ajax(opts);
};

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
    _httpResponse.call(collection, 'DELETE', path, opts, function(err, x, y, z) {
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
    setAjax: function(_ajax) {
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
    get: function() {
        var a = ajax || ($ ? $.ajax : null) || (jQuery ? jQuery.ajax : null);
        if (!a) {
            throw new InternalSiestaError('ajax has not been defined and could not find $.ajax or jQuery.ajax');
        }
        return a;
    },
    set: function(v) {
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
    , defineSubProperty = _i.misc.defineSubProperty
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
    return  _.partial(depthSerialiser, depth);
};
exports.depthSerializer = function (depth) {
    return  _.partial(depthSerialiser, depth);
};
exports.idSerializer = idSerialiser;
exports.idSerialiser = idSerialiser;


},{}]},{},[3])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9zcmMvaHR0cC9kZXNjcmlwdG9yLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3Qvc3JjL2h0dHAvZGVzY3JpcHRvclJlZ2lzdHJ5LmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3Qvc3JjL2h0dHAvaW5kZXguanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9zcmMvaHR0cC9yZXF1ZXN0RGVzY3JpcHRvci5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L3NyYy9odHRwL3Jlc3BvbnNlRGVzY3JpcHRvci5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L3NyYy9odHRwL3NlcmlhbGlzZXIuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoYkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1WUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLyoqXG4gKiBEZXNjcmlwdG9ycyBkZWFsIHdpdGggdGhlIGRlc2NyaXB0aW9uIG9mIEhUVFAgcmVxdWVzdHMgYW5kIGFyZSB1c2VkIGJ5IFNpZXN0YSB0byBkZXRlcm1pbmUgd2hhdCB0byBkb1xuICogd2l0aCBIVFRQIHJlcXVlc3QvcmVzcG9uc2UgYm9kaWVzLlxuICogQG1vZHVsZSBodHRwXG4gKi9cblxudmFyIF9pID0gc2llc3RhLl9pbnRlcm5hbCxcbiAgICBsb2cgPSBfaS5sb2csXG4gICAgSW50ZXJuYWxTaWVzdGFFcnJvciA9IF9pLmVycm9yLkludGVybmFsU2llc3RhRXJyb3IsXG4gICAgYXNzZXJ0ID0gX2kubWlzYy5hc3NlcnQsXG4gICAgZGVmaW5lU3ViUHJvcGVydHkgPSBfaS5taXNjLmRlZmluZVN1YlByb3BlcnR5LFxuICAgIENvbGxlY3Rpb25SZWdpc3RyeSA9IF9pLkNvbGxlY3Rpb25SZWdpc3RyeSxcbiAgICBleHRlbmQgPSBfaS5leHRlbmQsXG4gICAgdXRpbCA9IF9pLnV0aWwsXG4gICAgXyA9IHV0aWwuXztcblxudmFyIExvZ2dlciA9IGxvZy5sb2dnZXJXaXRoTmFtZSgnRGVzY3JpcHRvcicpO1xuTG9nZ2VyLnNldExldmVsKGxvZy5MZXZlbC53YXJuKTtcblxudmFyIGh0dHBNZXRob2RzID0gWydQT1NUJywgJ1BBVENIJywgJ1BVVCcsICdIRUFEJywgJ0dFVCcsICdERUxFVEUnLCAnT1BUSU9OUycsICdUUkFDRScsICdDT05ORUNUJ107XG5cbmZ1bmN0aW9uIHJlc29sdmVNZXRob2QobWV0aG9kcykge1xuICAgIC8vIENvbnZlcnQgd2lsZGNhcmRzIGludG8gbWV0aG9kcyBhbmQgZW5zdXJlIGlzIGFuIGFycmF5IG9mIHVwcGVyY2FzZSBtZXRob2RzLlxuICAgIGlmIChtZXRob2RzKSB7XG4gICAgICAgIGlmIChtZXRob2RzID09ICcqJyB8fCBtZXRob2RzLmluZGV4T2YoJyonKSA+IC0xKSB7XG4gICAgICAgICAgICBtZXRob2RzID0gaHR0cE1ldGhvZHM7XG4gICAgICAgIH0gZWxzZSBpZiAoIXV0aWwuaXNBcnJheShtZXRob2RzKSkge1xuICAgICAgICAgICAgbWV0aG9kcyA9IFttZXRob2RzXTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIG1ldGhvZHMgPSBbJ0dFVCddO1xuICAgIH1cbiAgICByZXR1cm4gXy5tYXAobWV0aG9kcywgZnVuY3Rpb24gKHgpIHtcbiAgICAgICAgcmV0dXJuIHgudG9VcHBlckNhc2UoKVxuICAgIH0pO1xufVxuXG4vKipcbiAqIEEgZGVzY3JpcHRvciAnZGVzY3JpYmVzJyBwb3NzaWJsZSBIVFRQIHJlcXVlc3RzIGFnYWluc3QgYW4gQVBJLCBhbmQgaXMgdXNlZCB0byBkZWNpZGUgd2hldGhlciBvciBub3QgdG9cbiAqIGludGVyY2VwdCBhIEhUVFAgcmVxdWVzdC9yZXNwb25zZSBhbmQgcGVyZm9ybSBhIG1hcHBpbmcuXG4gKlxuICogQGNvbnN0cnVjdG9yXG4gKiBAcGFyYW0ge09iamVjdH0gb3B0c1xuICovXG5mdW5jdGlvbiBEZXNjcmlwdG9yKG9wdHMpIHtcbiAgICBpZiAoIXRoaXMpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBEZXNjcmlwdG9yKG9wdHMpO1xuICAgIH1cblxuICAgIHRoaXMuX3Jhd09wdHMgPSBleHRlbmQodHJ1ZSwge30sIG9wdHMpO1xuICAgIHRoaXMuX29wdHMgPSBvcHRzO1xuXG4gICAgLy8gVE9ETzogVGhpcyBpcyBhIGJpdCBoYWNreS5cbiAgICAvLyBFc3NlbnRpYWxseSBoYWNraW5nIG5hbWVkIGdyb3VwcyBpbnRvIGphdmFzY3JpcHQgcmVndWxhciBleHByZXNzaW9ucy5cbiAgICAvLyBPcmlnaW5hbGx5IHdhcyB1c2luZyBYUmVnRXhwIGJ1dCB0aGF0IGxpYnJhcnkgaXMgMzAwa2IsIDMwayBndW56aXBwZWQuIEZ1Y2sgdGhhdC5cbiAgICAvLyBJIGRvIHN1c3BlY3QgdGhhdCB0aGlzIGlzIGEgYml0IHNrZXRjaHkgdGhvLi4uXG4gICAgdmFyIHByb2Nlc3NQYXRoID0gZnVuY3Rpb24gKHJhdykge1xuICAgICAgICB2YXIgciA9IC9cXD88KFswLTlhLXpBLVpfLV0qKT4vZztcbiAgICAgICAgdmFyIG1hdGNoLCBuYW1lcyA9IFtdO1xuICAgICAgICB3aGlsZSAobWF0Y2ggPSByLmV4ZWMocmF3KSkge1xuICAgICAgICAgICAgdmFyIG5hbWUgPSBtYXRjaFsxXTtcbiAgICAgICAgICAgIG5hbWVzLnB1c2gobmFtZSk7XG4gICAgICAgIH1cbiAgICAgICAgcmF3ID0gcmF3LnJlcGxhY2UociwgJycpO1xuICAgICAgICB2YXIgcmVnRXhwID0gbmV3IFJlZ0V4cChyYXcsICdnJyk7XG4gICAgICAgIHJldHVybiB7bmFtZXM6IG5hbWVzLCByZWdFeHA6IHJlZ0V4cH07XG4gICAgfS5iaW5kKHRoaXMpO1xuXG4gICAgaWYgKHRoaXMuX29wdHMucGF0aCkge1xuICAgICAgICB2YXIgcGF0aHMgPSB0aGlzLl9vcHRzLnBhdGg7XG4gICAgICAgIGlmICghdXRpbC5pc0FycmF5KHBhdGhzKSkge1xuICAgICAgICAgICAgcGF0aHMgPSBbcGF0aHNdO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fb3B0cy5wYXRoID0gW107XG4gICAgICAgIHRoaXMubmFtZXMgPSBbXTtcblxuICAgICAgICBfLmVhY2gocGF0aHMsIGZ1bmN0aW9uIChwKSB7XG4gICAgICAgICAgICB2YXIgX19yZXQgPSBwcm9jZXNzUGF0aC5jYWxsKHRoaXMsIHApO1xuICAgICAgICAgICAgdGhpcy5fb3B0cy5wYXRoLnB1c2goX19yZXQucmVnRXhwKTtcbiAgICAgICAgICAgIHRoaXMubmFtZXMucHVzaChfX3JldC5uYW1lcyk7XG4gICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5fb3B0cy5wYXRoID0gWycnXTtcbiAgICAgICAgdGhpcy5uYW1lcyA9IFtbXV07XG4gICAgfVxuXG4gICAgdGhpcy5fb3B0cy5tZXRob2QgPSByZXNvbHZlTWV0aG9kKHRoaXMuX29wdHMubWV0aG9kKTtcblxuICAgIC8vIE1hcHBpbmdzIGNhbiBiZSBwYXNzZWQgYXMgdGhlIGFjdHVhbCBtYXBwaW5nIG9iamVjdCBvciBhcyBhIHN0cmluZyAod2l0aCBBUEkgc3BlY2lmaWVkIHRvbylcbiAgICBpZiAodGhpcy5fb3B0cy5tYXBwaW5nKSB7XG4gICAgICAgIGlmICh0eXBlb2YodGhpcy5fb3B0cy5tYXBwaW5nKSA9PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgaWYgKHRoaXMuX29wdHMuY29sbGVjdGlvbikge1xuICAgICAgICAgICAgICAgIHZhciBjb2xsZWN0aW9uO1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YodGhpcy5fb3B0cy5jb2xsZWN0aW9uKSA9PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgICAgICBjb2xsZWN0aW9uID0gQ29sbGVjdGlvblJlZ2lzdHJ5W3RoaXMuX29wdHMuY29sbGVjdGlvbl07XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgY29sbGVjdGlvbiA9IHRoaXMuX29wdHMuY29sbGVjdGlvbjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKGNvbGxlY3Rpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGFjdHVhbE1hcHBpbmcgPSBjb2xsZWN0aW9uW3RoaXMuX29wdHMubWFwcGluZ107XG4gICAgICAgICAgICAgICAgICAgIGlmIChhY3R1YWxNYXBwaW5nKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9vcHRzLm1hcHBpbmcgPSBhY3R1YWxNYXBwaW5nO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdNYXBwaW5nICcgKyB0aGlzLl9vcHRzLm1hcHBpbmcgKyAnIGRvZXMgbm90IGV4aXN0Jywge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9wdHM6IG9wdHMsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRvcjogdGhpc1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0NvbGxlY3Rpb24gJyArIHRoaXMuX29wdHMuY29sbGVjdGlvbiArICcgZG9lcyBub3QgZXhpc3QnLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICBvcHRzOiBvcHRzLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRvcjogdGhpc1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignUGFzc2VkIG1hcHBpbmcgYXMgc3RyaW5nLCBidXQgZGlkIG5vdCBzcGVjaWZ5IHRoZSBjb2xsZWN0aW9uIGl0IGJlbG9uZ3MgdG8nLCB7XG4gICAgICAgICAgICAgICAgICAgIG9wdHM6IG9wdHMsXG4gICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0b3I6IHRoaXNcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignRGVzY3JpcHRvcnMgbXVzdCBiZSBpbml0aWFsaXNlZCB3aXRoIGEgbWFwcGluZycsIHtcbiAgICAgICAgICAgIG9wdHM6IG9wdHMsXG4gICAgICAgICAgICBkZXNjcmlwdG9yOiB0aGlzXG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIElmIGtleSBwYXRoLCBjb252ZXJ0IGRhdGEga2V5IHBhdGggaW50byBhbiBvYmplY3QgdGhhdCB3ZSBjYW4gdGhlbiB1c2UgdG8gdHJhdmVyc2UgdGhlIEhUVFAgYm9kaWVzLlxuICAgIC8vIG90aGVyd2lzZSBsZWF2ZSBhcyBzdHJpbmcgb3IgdW5kZWZpbmVkLlxuICAgIHZhciBkYXRhID0gdGhpcy5fb3B0cy5kYXRhO1xuICAgIGlmIChkYXRhKSB7XG4gICAgICAgIGlmIChkYXRhLmxlbmd0aCkge1xuICAgICAgICAgICAgdmFyIHJvb3Q7XG4gICAgICAgICAgICB2YXIgYXJyID0gZGF0YS5zcGxpdCgnLicpO1xuICAgICAgICAgICAgaWYgKGFyci5sZW5ndGggPT0gMSkge1xuICAgICAgICAgICAgICAgIHJvb3QgPSBhcnJbMF07XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHZhciBvYmogPSB7fTtcbiAgICAgICAgICAgICAgICByb290ID0gb2JqO1xuICAgICAgICAgICAgICAgIHZhciBwcmV2aW91c0tleSA9IGFyclswXTtcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMTsgaSA8IGFyci5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICB2YXIga2V5ID0gYXJyW2ldO1xuICAgICAgICAgICAgICAgICAgICBpZiAoaSA9PSAoYXJyLmxlbmd0aCAtIDEpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBvYmpbcHJldmlvdXNLZXldID0ga2V5O1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG5ld1ZhciA9IHt9O1xuICAgICAgICAgICAgICAgICAgICAgICAgb2JqW3ByZXZpb3VzS2V5XSA9IG5ld1ZhcjtcbiAgICAgICAgICAgICAgICAgICAgICAgIG9iaiA9IG5ld1ZhcjtcbiAgICAgICAgICAgICAgICAgICAgICAgIHByZXZpb3VzS2V5ID0ga2V5O1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5fb3B0cy5kYXRhID0gcm9vdDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBuYW1lIHBhdGhcbiAgICAgKiBAdHlwZSB7U3RyaW5nfVxuICAgICAqL1xuICAgIGRlZmluZVN1YlByb3BlcnR5LmNhbGwodGhpcywgJ3BhdGgnLCB0aGlzLl9vcHRzKTtcbiAgICBkZWZpbmVTdWJQcm9wZXJ0eS5jYWxsKHRoaXMsICdtZXRob2QnLCB0aGlzLl9vcHRzKTtcbiAgICBkZWZpbmVTdWJQcm9wZXJ0eS5jYWxsKHRoaXMsICdtYXBwaW5nJywgdGhpcy5fb3B0cyk7XG4gICAgZGVmaW5lU3ViUHJvcGVydHkuY2FsbCh0aGlzLCAnZGF0YScsIHRoaXMuX29wdHMpO1xuICAgIGRlZmluZVN1YlByb3BlcnR5LmNhbGwodGhpcywgJ3RyYW5zZm9ybXMnLCB0aGlzLl9vcHRzKTtcbn1cblxuXy5leHRlbmQoRGVzY3JpcHRvci5wcm90b3R5cGUsIHtcbiAgICBodHRwTWV0aG9kczogaHR0cE1ldGhvZHMsXG4gICAgLyoqXG4gICAgICogVGFrZXMgYSByZWdleCBwYXRoIGFuZCByZXR1cm5zIGFuIG9iamVjdCBpZiBtYXRjaGVkLlxuICAgICAqIElmIGFueSByZWd1bGFyIGV4cHJlc3Npb24gZ3JvdXBzIHdlcmUgZGVmaW5lZCwgdGhlIHJldHVybmVkIG9iamVjdCB3aWxsIGNvbnRhaW4gdGhlIG1hdGNoZXMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0gIHtTdHJpbmd8UmVnRXhwfSBwYXRoXG4gICAgICogQHJldHVybiB7T2JqZWN0fVxuICAgICAqIEBpbnRlcm5hbFxuICAgICAqIEBleGFtcGxlXG4gICAgICogYGBganNcbiAgICAgKiB2YXIgZCA9IG5ldyBEZXNjcmlwdG9yKHtcbiAgICAgKiAgICAgcGF0aDogJy9yZXNvdXJjZS8oP1A8aWQ+KS8nXG4gICAgICogfSlcbiAgICAgKiB2YXIgbWF0Y2hlZCA9IGQuX21hdGNoUGF0aCgnL3Jlc291cmNlLzInKTtcbiAgICAgKiBjb25zb2xlLmxvZyhtYXRjaGVkKTsgLy8ge2lkOiAnMid9XG4gICAgICogYGBgXG4gICAgICovXG4gICAgX21hdGNoUGF0aDogZnVuY3Rpb24gKHBhdGgpIHtcbiAgICAgICAgdmFyIGk7XG4gICAgICAgIHZhciBtYXRjaGVzID0gW107XG4gICAgICAgIHZhciBtYXRjaGVkO1xuICAgICAgICBmb3IgKGk9MDsgaTx0aGlzLl9vcHRzLnBhdGgubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHZhciBuYW1lcyA9IHRoaXMubmFtZXNbaV07XG4gICAgICAgICAgICB2YXIgcmVnRXhwID0gdGhpcy5fb3B0cy5wYXRoW2ldO1xuICAgICAgICAgICAgdmFyIG1hdGNoID0gcmVnRXhwLmV4ZWMocGF0aCk7XG4gICAgICAgICAgICBpZiAobWF0Y2gpIHtcbiAgICAgICAgICAgICAgICBmb3IgKGkgPSAxOyBpIDwgbWF0Y2gubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgbWF0Y2hlcy5wdXNoKG1hdGNoW2ldKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKG1hdGNoZXMubGVuZ3RoID09IG5hbWVzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICBtYXRjaGVkID0ge307XG4gICAgICAgICAgICAgICAgICAgIF8uZWFjaChtYXRjaGVzLCBmdW5jdGlvbiAobSwgaSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbWF0Y2hlZFtuYW1lc1tpXV0gPSBtO1xuICAgICAgICAgICAgICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG1hdGNoZWQ7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRydWUgaWYgdGhlIGRlc2NyaXB0b3IgYWNjZXB0cyB0aGUgSFRUUCBtZXRob2QuXG4gICAgICpcbiAgICAgKiBAcGFyYW0gIHtTdHJpbmd9IG1ldGhvZFxuICAgICAqIEByZXR1cm4ge2Jvb2xlYW59XG4gICAgICogQGludGVybmFsXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBgYGBqc1xuICAgICAqIHZhciBkID0gbmV3IERlc2NyaXB0b3Ioe1xuICAgICAqICAgICBtZXRob2Q6IFsnUE9TVCcsICdQVVQnXVxuICAgICAqIH0pO1xuICAgICAqIGNvbnNvbGUubG9nKGQuX21hdGNoTWV0aG9kKCdHRVQnKSk7IC8vIGZhbHNlXG4gICAgICogYGBgXG4gICAgICovXG4gICAgX21hdGNoTWV0aG9kOiBmdW5jdGlvbiAobWV0aG9kKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5tZXRob2QubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmIChtZXRob2QudG9VcHBlckNhc2UoKSA9PSB0aGlzLm1ldGhvZFtpXSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIFBlcmZvcm1zIGEgYnJlYWR0aC1maXJzdCBzZWFyY2ggdGhyb3VnaCBkYXRhLCBlbWJlZGRpbmcgb2JqIGluIHRoZSBmaXJzdCBsZWFmLlxuICAgICAqXG4gICAgICogQHBhcmFtICB7T2JqZWN0fSBvYmpcbiAgICAgKiBAcGFyYW0gIHtPYmplY3R9IGRhdGFcbiAgICAgKiBAcmV0dXJuIHtPYmplY3R9XG4gICAgICovXG4gICAgYnVyeTogZnVuY3Rpb24gKG9iaiwgZGF0YSkge1xuICAgICAgICB2YXIgcm9vdCA9IGRhdGE7XG4gICAgICAgIHZhciBrZXlzID0gT2JqZWN0LmtleXMoZGF0YSk7XG4gICAgICAgIGFzc2VydChrZXlzLmxlbmd0aCA9PSAxKTtcbiAgICAgICAgdmFyIGtleSA9IGtleXNbMF07XG4gICAgICAgIHZhciBjdXJyID0gZGF0YTtcbiAgICAgICAgd2hpbGUgKCEodHlwZW9mKGN1cnJba2V5XSkgPT0gJ3N0cmluZycpKSB7XG4gICAgICAgICAgICBjdXJyID0gY3VycltrZXldO1xuICAgICAgICAgICAga2V5cyA9IE9iamVjdC5rZXlzKGN1cnIpO1xuICAgICAgICAgICAgYXNzZXJ0KGtleXMubGVuZ3RoID09IDEpO1xuICAgICAgICAgICAga2V5ID0ga2V5c1swXTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgbmV3UGFyZW50ID0gY3VycltrZXldO1xuICAgICAgICB2YXIgbmV3T2JqID0ge307XG4gICAgICAgIGN1cnJba2V5XSA9IG5ld09iajtcbiAgICAgICAgbmV3T2JqW25ld1BhcmVudF0gPSBvYmo7XG4gICAgICAgIHJldHVybiByb290O1xuICAgIH0sXG4gICAgX2VtYmVkRGF0YTogZnVuY3Rpb24gKGRhdGEpIHtcbiAgICAgICAgaWYgKHRoaXMuZGF0YSkge1xuICAgICAgICAgICAgdmFyIG5lc3RlZDtcbiAgICAgICAgICAgIGlmICh0eXBlb2YodGhpcy5kYXRhKSA9PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgIG5lc3RlZCA9IHt9O1xuICAgICAgICAgICAgICAgIG5lc3RlZFt0aGlzLmRhdGFdID0gZGF0YTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbmVzdGVkID0gdGhpcy5idXJ5KGRhdGEsIGV4dGVuZCh0cnVlLCB7fSwgdGhpcy5kYXRhKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gbmVzdGVkO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIGRhdGE7XG4gICAgICAgIH1cbiAgICB9LFxuICAgIC8qKlxuICAgICAqIElmIG5lc3RlZCBkYXRhIGhhcyBiZWVuIHNwZWNpZmllZCBpbiB0aGUgZGVzY3JpcHRvciwgZXh0cmFjdCB0aGUgZGF0YS5cbiAgICAgKiBAcGFyYW0gIHtPYmplY3R9IGRhdGFcbiAgICAgKiBAcmV0dXJuIHtPYmplY3R9XG4gICAgICovXG4gICAgX2V4dHJhY3REYXRhOiBmdW5jdGlvbiAoZGF0YSkge1xuICAgICAgICBpZiAoTG9nZ2VyLmRlYnVnLmlzRW5hYmxlZClcbiAgICAgICAgICAgIExvZ2dlci5kZWJ1ZygnX2V4dHJhY3REYXRhJywgZGF0YSk7XG4gICAgICAgIGlmICh0aGlzLmRhdGEpIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2YodGhpcy5kYXRhKSA9PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgIHJldHVybiBkYXRhW3RoaXMuZGF0YV07XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHZhciBrZXlzID0gT2JqZWN0LmtleXModGhpcy5kYXRhKTtcbiAgICAgICAgICAgICAgICBhc3NlcnQoa2V5cy5sZW5ndGggPT0gMSk7XG4gICAgICAgICAgICAgICAgdmFyIGN1cnJUaGVpcnMgPSBkYXRhO1xuICAgICAgICAgICAgICAgIHZhciBjdXJyT3VycyA9IHRoaXMuZGF0YTtcbiAgICAgICAgICAgICAgICB3aGlsZSAodHlwZW9mKGN1cnJPdXJzKSAhPSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgICAgICBrZXlzID0gT2JqZWN0LmtleXMoY3Vyck91cnMpO1xuICAgICAgICAgICAgICAgICAgICBhc3NlcnQoa2V5cy5sZW5ndGggPT0gMSk7XG4gICAgICAgICAgICAgICAgICAgIHZhciBrZXkgPSBrZXlzWzBdO1xuICAgICAgICAgICAgICAgICAgICBjdXJyT3VycyA9IGN1cnJPdXJzW2tleV07XG4gICAgICAgICAgICAgICAgICAgIGN1cnJUaGVpcnMgPSBjdXJyVGhlaXJzW2tleV07XG4gICAgICAgICAgICAgICAgICAgIGlmICghY3VyclRoZWlycykge1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIGN1cnJUaGVpcnMgPyBjdXJyVGhlaXJzW2N1cnJPdXJzXSA6IG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gZGF0YTtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0aGlzIGRlc2NyaXB0b3JzIG1hcHBpbmcgaWYgdGhlIHJlcXVlc3QgY29uZmlnIG1hdGNoZXMuXG4gICAgICogQHBhcmFtIHtPYmplY3R9IGNvbmZpZ1xuICAgICAqIEByZXR1cm5zIHtPYmplY3R9XG4gICAgICovXG4gICAgX21hdGNoQ29uZmlnOiBmdW5jdGlvbiAoY29uZmlnKSB7XG4gICAgICAgIHZhciBtYXRjaGVzID0gY29uZmlnLnR5cGUgPyB0aGlzLl9tYXRjaE1ldGhvZChjb25maWcudHlwZSkgOiB7fTtcbiAgICAgICAgaWYgKG1hdGNoZXMpIHtcbiAgICAgICAgICAgIG1hdGNoZXMgPSBjb25maWcudXJsID8gdGhpcy5fbWF0Y2hQYXRoKGNvbmZpZy51cmwpIDoge307XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1hdGNoZXMpIHtcbiAgICAgICAgICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKVxuICAgICAgICAgICAgICAgIExvZ2dlci50cmFjZSgnbWF0Y2hlZCBjb25maWcnKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbWF0Y2hlcztcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyBkYXRhIGlmIHRoZSBkYXRhIG1hdGNoZXMsIHBlcmZvcm1pbmcgYW55IGV4dHJhY3Rpb24gYXMgc3BlY2lmaWVkIGluIG9wdHMuZGF0YVxuICAgICAqXG4gICAgICogQHBhcmFtICB7T2JqZWN0fSBkYXRhXG4gICAgICogQHJldHVybiB7T2JqZWN0fVxuICAgICAqL1xuICAgIF9tYXRjaERhdGE6IGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgICAgIHZhciBleHRyYWN0ZWREYXRhID0gbnVsbDtcbiAgICAgICAgaWYgKHRoaXMuZGF0YSkge1xuICAgICAgICAgICAgaWYgKGRhdGEpIHtcbiAgICAgICAgICAgICAgICBleHRyYWN0ZWREYXRhID0gdGhpcy5fZXh0cmFjdERhdGEoZGF0YSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBleHRyYWN0ZWREYXRhID0gZGF0YTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZXh0cmFjdGVkRGF0YSkge1xuICAgICAgICAgICAgTG9nZ2VyLnRyYWNlKCdtYXRjaGVkIGRhdGEnKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZXh0cmFjdGVkRGF0YTtcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIENoZWNrIGlmIHRoZSBIVFRQIGNvbmZpZyBhbmQgcmV0dXJuZWQgZGF0YSBtYXRjaCB0aGlzIGRlc2NyaXB0b3IgZGVmaW5pdGlvbi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSAge09iamVjdH0gY29uZmlnIENvbmZpZyBvYmplY3QgZm9yICQuYWpheCBhbmQgc2ltaWxhclxuICAgICAqIEBwYXJhbSAge09iamVjdH0gZGF0YVxuICAgICAqIEByZXR1cm4ge09iamVjdH0gRXh0cmFjdGVkIGRhdGFcbiAgICAgKi9cbiAgICBtYXRjaDogZnVuY3Rpb24gKGNvbmZpZywgZGF0YSkge1xuICAgICAgICB2YXIgcmVnZXhNYXRjaGVzID0gdGhpcy5fbWF0Y2hDb25maWcoY29uZmlnKTtcbiAgICAgICAgdmFyIG1hdGNoZXMgPSAhIXJlZ2V4TWF0Y2hlcztcbiAgICAgICAgdmFyIGV4dHJhY3RlZERhdGEgPSBmYWxzZTtcbiAgICAgICAgaWYgKG1hdGNoZXMpIHtcbiAgICAgICAgICAgIExvZ2dlci50cmFjZSgnY29uZmlnIG1hdGNoZXMnKTtcbiAgICAgICAgICAgIGV4dHJhY3RlZERhdGEgPSB0aGlzLl9tYXRjaERhdGEoZGF0YSk7XG4gICAgICAgICAgICBtYXRjaGVzID0gISFleHRyYWN0ZWREYXRhO1xuICAgICAgICAgICAgaWYgKG1hdGNoZXMpIHtcbiAgICAgICAgICAgICAgICB2YXIga2V5O1xuICAgICAgICAgICAgICAgIGlmICh1dGlsLmlzQXJyYXkoZXh0cmFjdGVkRGF0YSkpIHtcbiAgICAgICAgICAgICAgICAgICAgZm9yIChrZXkgaW4gcmVnZXhNYXRjaGVzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAocmVnZXhNYXRjaGVzLmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBfLmVhY2goZXh0cmFjdGVkRGF0YSwgZnVuY3Rpb24gKGRhdHVtKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdHVtW2tleV0gPSByZWdleE1hdGNoZXNba2V5XTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGZvciAoa2V5IGluIHJlZ2V4TWF0Y2hlcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHJlZ2V4TWF0Y2hlcy5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZXh0cmFjdGVkRGF0YVtrZXldID0gcmVnZXhNYXRjaGVzW2tleV07XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgTG9nZ2VyLnRyYWNlKCdkYXRhIG1hdGNoZXMnKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgTG9nZ2VyLnRyYWNlKCdkYXRhIGRvZXNudCBtYXRjaCcpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgTG9nZ2VyLnRyYWNlKCdjb25maWcgZG9lc250IG1hdGNoJyk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGV4dHJhY3RlZERhdGE7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEFwcGx5IGFueSB0cmFuc2Zvcm1zLlxuICAgICAqIEBwYXJhbSAge09iamVjdH0gZGF0YSBTZXJpYWxpc2VkIGRhdGEuXG4gICAgICogQHJldHVybiB7T2JqZWN0fSBTZXJpYWxpc2VkIGRhdGEgd2l0aCBhcHBsaWVkIHRyYW5zZm9ybWF0aW9ucy5cbiAgICAgKi9cbiAgICBfdHJhbnNmb3JtRGF0YTogZnVuY3Rpb24gKGRhdGEpIHtcbiAgICAgICAgdmFyIHRyYW5zZm9ybXMgPSB0aGlzLnRyYW5zZm9ybXM7XG4gICAgICAgIGlmICh0eXBlb2YodHJhbnNmb3JtcykgPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgZGF0YSA9IHRyYW5zZm9ybXMoZGF0YSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBmb3IgKHZhciBhdHRyIGluIHRyYW5zZm9ybXMpIHtcbiAgICAgICAgICAgICAgICBpZiAodHJhbnNmb3Jtcy5oYXNPd25Qcm9wZXJ0eShhdHRyKSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZGF0YVthdHRyXSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHRyYW5zZm9ybSA9IHRyYW5zZm9ybXNbYXR0cl07XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgdmFsID0gZGF0YVthdHRyXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YodHJhbnNmb3JtKSA9PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBzcGxpdCA9IHRyYW5zZm9ybS5zcGxpdCgnLicpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlbGV0ZSBkYXRhW2F0dHJdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzcGxpdC5sZW5ndGggPT0gMSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkYXRhW3NwbGl0WzBdXSA9IHZhbDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkYXRhW3NwbGl0WzBdXSA9IHt9O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgbmV3VmFsID0gZGF0YVtzcGxpdFswXV07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAxOyBpIDwgc3BsaXQubGVuZ3RoIC0gMTsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgbmV3QXR0ciA9IHNwbGl0W2ldO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV3VmFsW25ld0F0dHJdID0ge307XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBuZXdWYWwgPSBuZXdWYWxbbmV3QXR0cl07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV3VmFsW3NwbGl0W3NwbGl0Lmxlbmd0aCAtIDFdXSA9IHZhbDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZih0cmFuc2Zvcm0pID09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgdHJhbnNmb3JtZWQgPSB0cmFuc2Zvcm0odmFsKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAodXRpbC5pc0FycmF5KHRyYW5zZm9ybWVkKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZWxldGUgZGF0YVthdHRyXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0YVt0cmFuc2Zvcm1lZFswXV0gPSB0cmFuc2Zvcm1lZFsxXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkYXRhW2F0dHJdID0gdHJhbnNmb3JtZWQ7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignSW52YWxpZCB0cmFuc2Zvcm1lcicpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBkYXRhO1xuICAgIH1cbn0pO1xuXG5leHBvcnRzLkRlc2NyaXB0b3IgPSBEZXNjcmlwdG9yO1xuZXhwb3J0cy5yZXNvbHZlTWV0aG9kID0gcmVzb2x2ZU1ldGhvZDsiLCJ2YXIgX2kgPSBzaWVzdGEuX2ludGVybmFsO1xudmFyIGxvZyA9IF9pLmxvZztcbnZhciBMb2dnZXIgPSBsb2cubG9nZ2VyV2l0aE5hbWUoJ0Rlc2NyaXB0b3JSZWdpc3RyeScpO1xuTG9nZ2VyLnNldExldmVsKGxvZy5MZXZlbC53YXJuKTtcblxudmFyIGFzc2VydCA9IF9pLm1pc2MuYXNzZXJ0LFxuICAgIHV0aWwgPSBfaS51dGlsLFxuICAgIF8gPSB1dGlsLl87XG5cblxuLyoqXG4gKiBAY2xhc3MgRW50cnkgcG9pbnQgZm9yIGRlc2NyaXB0b3IgcmVnaXN0cmF0aW9uLlxuICogQGNvbnN0cnVjdG9yXG4gKi9cbmZ1bmN0aW9uIERlc2NyaXB0b3JSZWdpc3RyeSgpIHtcbiAgICBpZiAoIXRoaXMpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBEZXNjcmlwdG9yUmVnaXN0cnkob3B0cyk7XG4gICAgfVxuICAgIHRoaXMucmVxdWVzdERlc2NyaXB0b3JzID0ge307XG4gICAgdGhpcy5yZXNwb25zZURlc2NyaXB0b3JzID0ge307XG59XG5cbmZ1bmN0aW9uIF9yZWdpc3RlckRlc2NyaXB0b3IoZGVzY3JpcHRvcnMsIGRlc2NyaXB0b3IpIHtcbiAgICB2YXIgbWFwcGluZyA9IGRlc2NyaXB0b3IubWFwcGluZztcbiAgICB2YXIgY29sbGVjdGlvbiA9IG1hcHBpbmcuY29sbGVjdGlvbjtcbiAgICBhc3NlcnQobWFwcGluZyk7XG4gICAgYXNzZXJ0KGNvbGxlY3Rpb24pO1xuICAgIGFzc2VydCh0eXBlb2YoY29sbGVjdGlvbikgPT0gJ3N0cmluZycpO1xuICAgIGlmICghZGVzY3JpcHRvcnNbY29sbGVjdGlvbl0pIHtcbiAgICAgICAgZGVzY3JpcHRvcnNbY29sbGVjdGlvbl0gPSBbXTtcbiAgICB9XG4gICAgZGVzY3JpcHRvcnNbY29sbGVjdGlvbl0ucHVzaChkZXNjcmlwdG9yKTtcbn1cblxuZnVuY3Rpb24gX2Rlc2NyaXB0b3JzRm9yQ29sbGVjdGlvbihkZXNjcmlwdG9ycywgY29sbGVjdGlvbikge1xuICAgIHZhciBkZXNjcmlwdG9yc0ZvckNvbGxlY3Rpb247XG4gICAgaWYgKHR5cGVvZihjb2xsZWN0aW9uKSA9PSAnc3RyaW5nJykge1xuICAgICAgICBkZXNjcmlwdG9yc0ZvckNvbGxlY3Rpb24gPSBkZXNjcmlwdG9yc1tjb2xsZWN0aW9uXSB8fCBbXTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIGRlc2NyaXB0b3JzRm9yQ29sbGVjdGlvbiA9IChkZXNjcmlwdG9yc1tjb2xsZWN0aW9uLl9uYW1lXSB8fCBbXSk7XG4gICAgfVxuICAgIHJldHVybiBkZXNjcmlwdG9yc0ZvckNvbGxlY3Rpb247XG59XG5cbl8uZXh0ZW5kKERlc2NyaXB0b3JSZWdpc3RyeS5wcm90b3R5cGUsIHtcbiAgICByZWdpc3RlclJlcXVlc3REZXNjcmlwdG9yOiBmdW5jdGlvbiAocmVxdWVzdERlc2NyaXB0b3IpIHtcbiAgICAgICAgX3JlZ2lzdGVyRGVzY3JpcHRvcih0aGlzLnJlcXVlc3REZXNjcmlwdG9ycywgcmVxdWVzdERlc2NyaXB0b3IpO1xuICAgIH0sXG4gICAgcmVnaXN0ZXJSZXNwb25zZURlc2NyaXB0b3I6IGZ1bmN0aW9uIChyZXNwb25zZURlc2NyaXB0b3IpIHtcbiAgICAgICAgaWYgKExvZ2dlci50cmFjZS5pc0VuYWJsZWQpXG4gICAgICAgICAgICBMb2dnZXIudHJhY2UoJ3JlZ2lzdGVyUmVzcG9uc2VEZXNjcmlwdG9yJyk7XG4gICAgICAgIF9yZWdpc3RlckRlc2NyaXB0b3IodGhpcy5yZXNwb25zZURlc2NyaXB0b3JzLCByZXNwb25zZURlc2NyaXB0b3IpO1xuICAgIH0sXG4gICAgcmVxdWVzdERlc2NyaXB0b3JzRm9yQ29sbGVjdGlvbjogZnVuY3Rpb24gKGNvbGxlY3Rpb24pIHtcbiAgICAgICAgcmV0dXJuIF9kZXNjcmlwdG9yc0ZvckNvbGxlY3Rpb24odGhpcy5yZXF1ZXN0RGVzY3JpcHRvcnMsIGNvbGxlY3Rpb24pO1xuICAgIH0sXG4gICAgcmVzcG9uc2VEZXNjcmlwdG9yc0ZvckNvbGxlY3Rpb246IGZ1bmN0aW9uIChjb2xsZWN0aW9uKSB7XG4gICAgICAgIHZhciBkZXNjcmlwdG9yc0ZvckNvbGxlY3Rpb24gPSBfZGVzY3JpcHRvcnNGb3JDb2xsZWN0aW9uKHRoaXMucmVzcG9uc2VEZXNjcmlwdG9ycywgY29sbGVjdGlvbik7XG4gICAgICAgIGlmICghZGVzY3JpcHRvcnNGb3JDb2xsZWN0aW9uLmxlbmd0aCkge1xuICAgICAgICAgICAgaWYgKExvZ2dlci5kZWJ1Zy5pc0VuYWJsZWQpXG4gICAgICAgICAgICAgICAgTG9nZ2VyLmRlYnVnKCdObyByZXNwb25zZSBkZXNjcmlwdG9ycyBmb3IgY29sbGVjdGlvbiAnLCB0aGlzLnJlc3BvbnNlRGVzY3JpcHRvcnMpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBkZXNjcmlwdG9yc0ZvckNvbGxlY3Rpb247XG4gICAgfSxcbiAgICByZXNldDogZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLnJlcXVlc3REZXNjcmlwdG9ycyA9IHt9O1xuICAgICAgICB0aGlzLnJlc3BvbnNlRGVzY3JpcHRvcnMgPSB7fTtcbiAgICB9XG59KTtcblxuZXhwb3J0cy5EZXNjcmlwdG9yUmVnaXN0cnkgPSBuZXcgRGVzY3JpcHRvclJlZ2lzdHJ5KCk7IiwiLyoqXG4gKiBQcm92aXNpb25zIHVzYWdlIG9mICQuYWpheCBhbmQgc2ltaWxhciBmdW5jdGlvbnMgdG8gc2VuZCBIVFRQIHJlcXVlc3RzIG1hcHBpbmdcbiAqIHRoZSByZXN1bHRzIGJhY2sgb250byB0aGUgb2JqZWN0IGdyYXBoIGF1dG9tYXRpY2FsbHkuXG4gKiBAbW9kdWxlIGh0dHBcbiAqL1xuXG5pZiAodHlwZW9mIHNpZXN0YSA9PSAndW5kZWZpbmVkJyAmJiB0eXBlb2YgbW9kdWxlID09ICd1bmRlZmluZWQnKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdDb3VsZCBub3QgZmluZCB3aW5kb3cuc2llc3RhLiBNYWtlIHN1cmUgeW91IGluY2x1ZGUgc2llc3RhLmNvcmUuanMgZmlyc3QuJyk7XG59XG5cblxuXG5cbnZhciBfaSA9IHNpZXN0YS5faW50ZXJuYWwsXG4gICAgQ29sbGVjdGlvbiA9IHNpZXN0YS5Db2xsZWN0aW9uLFxuICAgIGxvZyA9IF9pLmxvZyxcbiAgICB1dGlsID0gX2kudXRpbCxcbiAgICBfID0gdXRpbC5fLFxuICAgIGRlc2NyaXB0b3IgPSByZXF1aXJlKCcuL2Rlc2NyaXB0b3InKSxcbiAgICBJbnRlcm5hbFNpZXN0YUVycm9yID0gX2kuZXJyb3IuSW50ZXJuYWxTaWVzdGFFcnJvcjtcblxudmFyIERlc2NyaXB0b3JSZWdpc3RyeSA9IHJlcXVpcmUoJy4vZGVzY3JpcHRvclJlZ2lzdHJ5JykuRGVzY3JpcHRvclJlZ2lzdHJ5O1xuXG5cbnZhciBMb2dnZXIgPSBsb2cubG9nZ2VyV2l0aE5hbWUoJ0hUVFAnKTtcbkxvZ2dlci5zZXRMZXZlbChsb2cuTGV2ZWwud2Fybik7XG5cbi8qKlxuICogU2VuZCBhIEhUVFAgcmVxdWVzdCB0byB0aGUgZ2l2ZW4gbWV0aG9kIGFuZCBwYXRoIHBhcnNpbmcgdGhlIHJlc3BvbnNlLlxuICogQHBhcmFtIHtTdHJpbmd9IG1ldGhvZFxuICogQHBhcmFtIHtTdHJpbmd9IHBhdGggVGhlIHBhdGggdG8gdGhlIHJlc291cmNlIHdlIHdhbnQgdG8gR0VUXG4gKiBAcGFyYW0ge09iamVjdHxGdW5jdGlvbn0gb3B0c09yQ2FsbGJhY2sgRWl0aGVyIGFuIG9wdGlvbnMgb2JqZWN0IG9yIGEgY2FsbGJhY2sgaWYgY2FuIHVzZSBkZWZhdWx0c1xuICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgQ2FsbGJhY2sgaWYgb3B0cyBzcGVjaWZpZWQuXG4gKi9cbmZ1bmN0aW9uIF9odHRwUmVzcG9uc2UobWV0aG9kLCBwYXRoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAyKTtcbiAgICB2YXIgY2FsbGJhY2s7XG4gICAgdmFyIG9wdHMgPSB7fTtcbiAgICB2YXIgbmFtZSA9IHRoaXMuX25hbWU7XG4gICAgaWYgKHR5cGVvZihhcmdzWzBdKSA9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIGNhbGxiYWNrID0gYXJnc1swXTtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZihhcmdzWzBdKSA9PSAnb2JqZWN0Jykge1xuICAgICAgICBvcHRzID0gYXJnc1swXTtcbiAgICAgICAgY2FsbGJhY2sgPSBhcmdzWzFdO1xuICAgIH1cbiAgICB2YXIgZGVmZXJyZWQgPSB3aW5kb3cucSA/IHdpbmRvdy5xLmRlZmVyKCkgOiBudWxsO1xuICAgIGNhbGxiYWNrID0gdXRpbC5jb25zdHJ1Y3RDYWxsYmFja0FuZFByb21pc2VIYW5kbGVyKGNhbGxiYWNrLCBkZWZlcnJlZCk7XG4gICAgb3B0cy50eXBlID0gbWV0aG9kO1xuICAgIGlmICghb3B0cy51cmwpIHsgLy8gQWxsb3cgb3ZlcnJpZGVzLlxuICAgICAgICB2YXIgYmFzZVVSTCA9IHRoaXMuYmFzZVVSTDtcbiAgICAgICAgb3B0cy51cmwgPSBiYXNlVVJMICsgcGF0aDtcbiAgICB9XG4gICAgaWYgKG9wdHMucGFyc2VSZXNwb25zZSA9PT0gdW5kZWZpbmVkKSBvcHRzLnBhcnNlUmVzcG9uc2UgPSB0cnVlO1xuICAgIG9wdHMuc3VjY2VzcyA9IGZ1bmN0aW9uKGRhdGEsIHRleHRTdGF0dXMsIGpxWEhSKSB7XG4gICAgICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKVxuICAgICAgICAgICAgTG9nZ2VyLnRyYWNlKG9wdHMudHlwZSArICcgJyArIGpxWEhSLnN0YXR1cyArICcgJyArIG9wdHMudXJsICsgJzogJyArIEpTT04uc3RyaW5naWZ5KGRhdGEsIG51bGwsIDQpKTtcbiAgICAgICAgdmFyIHJlc3AgPSB7XG4gICAgICAgICAgICBkYXRhOiBkYXRhLFxuICAgICAgICAgICAgdGV4dFN0YXR1czogdGV4dFN0YXR1cyxcbiAgICAgICAgICAgIGpxWEhSOiBqcVhIUlxuICAgICAgICB9O1xuICAgICAgICBpZiAob3B0cy5wYXJzZVJlc3BvbnNlKSB7XG4gICAgICAgICAgICB2YXIgZGVzY3JpcHRvcnMgPSBEZXNjcmlwdG9yUmVnaXN0cnkucmVzcG9uc2VEZXNjcmlwdG9yc0ZvckNvbGxlY3Rpb24oc2VsZik7XG4gICAgICAgICAgICB2YXIgbWF0Y2hlZERlc2NyaXB0b3I7XG4gICAgICAgICAgICB2YXIgZXh0cmFjdGVkRGF0YTtcblxuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBkZXNjcmlwdG9ycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIHZhciBkZXNjcmlwdG9yID0gZGVzY3JpcHRvcnNbaV07XG4gICAgICAgICAgICAgICAgZXh0cmFjdGVkRGF0YSA9IGRlc2NyaXB0b3IubWF0Y2gob3B0cywgZGF0YSk7XG4gICAgICAgICAgICAgICAgaWYgKGV4dHJhY3RlZERhdGEpIHtcbiAgICAgICAgICAgICAgICAgICAgbWF0Y2hlZERlc2NyaXB0b3IgPSBkZXNjcmlwdG9yO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cblxuICAgICAgICAgICAgaWYgKG1hdGNoZWREZXNjcmlwdG9yKSB7XG4gICAgICAgICAgICAgICAgaWYgKExvZ2dlci50cmFjZS5pc0VuYWJsZWQpXG4gICAgICAgICAgICAgICAgICAgIExvZ2dlci50cmFjZSgnTWFwcGluZyBleHRyYWN0ZWQgZGF0YTogJyArIEpTT04uc3RyaW5naWZ5KGV4dHJhY3RlZERhdGEsIG51bGwsIDQpKTtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mKGV4dHJhY3RlZERhdGEpID09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBtYXBwaW5nID0gbWF0Y2hlZERlc2NyaXB0b3IubWFwcGluZztcbiAgICAgICAgICAgICAgICAgICAgbWFwcGluZy5tYXAoZXh0cmFjdGVkRGF0YSwgZnVuY3Rpb24oZXJyLCBvYmopIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjYWxsYmFjaykge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyLCBvYmosIHJlc3ApO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9LCBvcHRzLm9iaik7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHsgLy8gTWF0Y2hlZCwgYnV0IG5vIGRhdGEuXG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIHRydWUsIHJlc3ApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAoY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICBpZiAobmFtZSkge1xuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjaygnTm8gZGVzY3JpcHRvciBtYXRjaGVkLicsIG51bGwsIHJlc3ApO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFRoZXJlIHdhcyBhIGJ1ZyB3aGVyZSBjb2xsZWN0aW9uIG5hbWUgZG9lc24ndCBleGlzdC4gSWYgdGhpcyBvY2N1cnMsIHRoZW4gd2lsbCBuZXZlciBnZXQgaG9sZCBvZiBhbnkgZGVzY3JpcHRvcnMuXG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdVbm5hbWVkIGNvbGxlY3Rpb24nKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjYWxsYmFjayhudWxsLCBudWxsLCByZXNwKTtcbiAgICAgICAgfVxuXG4gICAgfTtcbiAgICBvcHRzLmVycm9yID0gZnVuY3Rpb24oanFYSFIsIHRleHRTdGF0dXMsIGVycm9yVGhyb3duKSB7XG4gICAgICAgIHZhciByZXNwID0ge1xuICAgICAgICAgICAganFYSFI6IGpxWEhSLFxuICAgICAgICAgICAgdGV4dFN0YXR1czogdGV4dFN0YXR1cyxcbiAgICAgICAgICAgIGVycm9yVGhyb3duOiBlcnJvclRocm93blxuICAgICAgICB9O1xuICAgICAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKHJlc3AsIG51bGwsIHJlc3ApO1xuICAgIH07XG4gICAgaWYgKExvZ2dlci50cmFjZS5pc0VuYWJsZWQpXG4gICAgICAgIExvZ2dlci50cmFjZSgnQWpheCByZXF1ZXN0OicsIG9wdHMpO1xuICAgIHNpZXN0YS5leHQuaHR0cC5hamF4KG9wdHMpO1xufTtcblxuZnVuY3Rpb24gX3NlcmlhbGlzZU9iamVjdChvcHRzLCBvYmosIGNiKSB7XG4gICAgdGhpcy5fc2VyaWFsaXNlKG9iaiwgZnVuY3Rpb24gKGVyciwgZGF0YSkge1xuICAgICAgICB2YXIgcmV0RGF0YSA9IGRhdGE7XG4gICAgICAgIGlmIChvcHRzLmZpZWxkcykge1xuICAgICAgICAgICAgcmV0RGF0YSA9IHt9O1xuICAgICAgICAgICAgXy5lYWNoKG9wdHMuZmllbGRzLCBmdW5jdGlvbiAoZikge1xuICAgICAgICAgICAgICAgIHJldERhdGFbZl0gPSBkYXRhW2ZdO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgY2IoZXJyLCByZXREYXRhKTtcbiAgICB9KTtcbn1cblxuLyoqXG4gKiBTZW5kIGEgSFRUUCByZXF1ZXN0IHRvIHRoZSBnaXZlbiBtZXRob2QgYW5kIHBhdGhcbiAqIEBwYXJhbSB7U3RyaW5nfSBtZXRob2RcbiAqIEBwYXJhbSB7U3RyaW5nfSBwYXRoIFRoZSBwYXRoIHRvIHRoZSByZXNvdXJjZSB3ZSB3YW50IHRvIEdFVFxuICogQHBhcmFtIHtTaWVzdGFNb2RlbH0gb2JqZWN0IFRoZSBtb2RlbCB3ZSdyZSBwdXNoaW5nIHRvIHRoZSBzZXJ2ZXJcbiAqIEBwYXJhbSB7T2JqZWN0fEZ1bmN0aW9ufSBvcHRzT3JDYWxsYmFjayBFaXRoZXIgYW4gb3B0aW9ucyBvYmplY3Qgb3IgYSBjYWxsYmFjayBpZiBjYW4gdXNlIGRlZmF1bHRzXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBDYWxsYmFjayBpZiBvcHRzIHNwZWNpZmllZC5cbiAqL1xuZnVuY3Rpb24gX2h0dHBSZXF1ZXN0KG1ldGhvZCwgcGF0aCwgb2JqZWN0KSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAzKTtcbiAgICB2YXIgY2FsbGJhY2s7XG4gICAgdmFyIG9wdHMgPSB7fTtcbiAgICBpZiAodHlwZW9mKGFyZ3NbMF0pID09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgY2FsbGJhY2sgPSBhcmdzWzBdO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mKGFyZ3NbMF0pID09ICdvYmplY3QnKSB7XG4gICAgICAgIG9wdHMgPSBhcmdzWzBdO1xuICAgICAgICBjYWxsYmFjayA9IGFyZ3NbMV07XG4gICAgfVxuICAgIHZhciBkZWZlcnJlZCA9IHdpbmRvdy5xID8gd2luZG93LnEuZGVmZXIoKSA6IG51bGw7XG4gICAgY2FsbGJhY2sgPSB1dGlsLmNvbnN0cnVjdENhbGxiYWNrQW5kUHJvbWlzZUhhbmRsZXIoY2FsbGJhY2ssIGRlZmVycmVkKTtcbiAgICBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJncywgMik7XG4gICAgdmFyIHJlcXVlc3REZXNjcmlwdG9ycyA9IERlc2NyaXB0b3JSZWdpc3RyeS5yZXF1ZXN0RGVzY3JpcHRvcnNGb3JDb2xsZWN0aW9uKHRoaXMpO1xuICAgIHZhciBtYXRjaGVkRGVzY3JpcHRvcjtcbiAgICBvcHRzLnR5cGUgPSBtZXRob2Q7XG4gICAgdmFyIGJhc2VVUkwgPSB0aGlzLmJhc2VVUkw7XG4gICAgb3B0cy51cmwgPSBiYXNlVVJMICsgcGF0aDtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHJlcXVlc3REZXNjcmlwdG9ycy5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgcmVxdWVzdERlc2NyaXB0b3IgPSByZXF1ZXN0RGVzY3JpcHRvcnNbaV07XG4gICAgICAgIGlmIChyZXF1ZXN0RGVzY3JpcHRvci5fbWF0Y2hDb25maWcob3B0cykpIHtcbiAgICAgICAgICAgIG1hdGNoZWREZXNjcmlwdG9yID0gcmVxdWVzdERlc2NyaXB0b3I7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgIH1cbiAgICBpZiAobWF0Y2hlZERlc2NyaXB0b3IpIHtcbiAgICAgICAgaWYgKExvZ2dlci50cmFjZS5pc0VuYWJsZWQpXG4gICAgICAgICAgICBMb2dnZXIudHJhY2UoJ01hdGNoZWQgZGVzY3JpcHRvcjogJyArIG1hdGNoZWREZXNjcmlwdG9yLl9kdW1wKHRydWUpKTtcbiAgICAgICAgX3NlcmlhbGlzZU9iamVjdC5jYWxsKG1hdGNoZWREZXNjcmlwdG9yLCBvYmplY3QsIG9wdHMsIGZ1bmN0aW9uIChlcnIsIGRhdGEpIHtcbiAgICAgICAgICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKVxuICAgICAgICAgICAgICAgIExvZ2dlci50cmFjZSgnX3NlcmlhbGlzZScsIHtcbiAgICAgICAgICAgICAgICAgICAgZXJyOiBlcnIsXG4gICAgICAgICAgICAgICAgICAgIGRhdGE6IGRhdGFcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKGVyciwgbnVsbCwgbnVsbCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIG9wdHMuZGF0YSA9IGRhdGE7XG4gICAgICAgICAgICAgICAgb3B0cy5vYmogPSBvYmplY3Q7XG4gICAgICAgICAgICAgICAgXy5wYXJ0aWFsKF9odHRwUmVzcG9uc2UsIG1ldGhvZCwgcGF0aCwgb3B0cywgY2FsbGJhY2spLmFwcGx5KHNlbGYsIGFyZ3MpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICBcbiAgICB9IGVsc2UgaWYgKGNhbGxiYWNrKSB7XG4gICAgICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKVxuICAgICAgICAgICAgTG9nZ2VyLnRyYWNlKCdEaWQgbm90IG1hdGNoIGRlc2NyaXB0b3InKTtcbiAgICAgICAgY2FsbGJhY2soJ05vIGRlc2NyaXB0b3IgbWF0Y2hlZCcsIG51bGwsIG51bGwpO1xuICAgIH1cbiAgICByZXR1cm4gZGVmZXJyZWQgPyBkZWZlcnJlZC5wcm9taXNlIDogbnVsbDtcbn1cblxuLyoqXG4gKiBTZW5kIGEgREVMRVRFIHJlcXVlc3QuIEFsc28gcmVtb3ZlcyB0aGUgb2JqZWN0LlxuICogQHBhcmFtIHtDb2xsZWN0aW9ufSBjb2xsZWN0aW9uXG4gKiBAcGFyYW0ge1N0cmluZ30gcGF0aCBUaGUgcGF0aCB0byB0aGUgcmVzb3VyY2UgdG8gd2hpY2ggd2Ugd2FudCB0byBERUxFVEVcbiAqIEBwYXJhbSB7U2llc3RhTW9kZWx9IG9iamVjdCBUaGUgbW9kZWwgdGhhdCB3ZSB3b3VsZCBsaWtlIHRvIFBBVENIXG4gKiBAcmV0dXJucyB7UHJvbWlzZX1cbiAqL1xuZnVuY3Rpb24gREVMRVRFKGNvbGxlY3Rpb24sIHBhdGgsIG9iamVjdCkge1xuICAgIHZhciBkZWZlcnJlZCA9IHdpbmRvdy5xID8gd2luZG93LnEuZGVmZXIoKSA6IG51bGw7XG4gICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDMpO1xuICAgIHZhciBvcHRzID0ge307XG4gICAgdmFyIGNhbGxiYWNrO1xuICAgIGlmICh0eXBlb2YoYXJnc1swXSkgPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICBjYWxsYmFjayA9IGFyZ3NbMF07XG4gICAgfSBlbHNlIGlmICh0eXBlb2YoYXJnc1swXSkgPT0gJ29iamVjdCcpIHtcbiAgICAgICAgb3B0cyA9IGFyZ3NbMF07XG4gICAgICAgIGNhbGxiYWNrID0gYXJnc1sxXTtcbiAgICB9XG4gICAgY2FsbGJhY2sgPSB1dGlsLmNvbnN0cnVjdENhbGxiYWNrQW5kUHJvbWlzZUhhbmRsZXIoY2FsbGJhY2ssIGRlZmVycmVkKTtcbiAgICB2YXIgZGVsZXRpb25Nb2RlID0gb3B0cy5kZWxldGlvbk1vZGUgfHwgJ3Jlc3RvcmUnO1xuICAgIC8vIEJ5IGRlZmF1bHQgd2UgZG8gbm90IG1hcCB0aGUgcmVzcG9uc2UgZnJvbSBhIERFTEVURSByZXF1ZXN0LlxuICAgIGlmIChvcHRzLnBhcnNlUmVzcG9uc2UgPT09IHVuZGVmaW5lZCkgb3B0cy5wYXJzZVJlc3BvbnNlID0gZmFsc2U7XG4gICAgX2h0dHBSZXNwb25zZS5jYWxsKGNvbGxlY3Rpb24sICdERUxFVEUnLCBwYXRoLCBvcHRzLCBmdW5jdGlvbihlcnIsIHgsIHksIHopIHtcbiAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgaWYgKGRlbGV0aW9uTW9kZSA9PSAncmVzdG9yZScpIHtcbiAgICAgICAgICAgICAgICBvYmplY3QucmVzdG9yZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKGRlbGV0aW9uTW9kZSA9PSAnc3VjY2VzcycpIHtcbiAgICAgICAgICAgIG9iamVjdC5yZW1vdmUoKTtcbiAgICAgICAgfVxuICAgICAgICBjYWxsYmFjayhlcnIsIHgsIHksIHopO1xuICAgIH0pO1xuICAgIGlmIChkZWxldGlvbk1vZGUgPT0gJ25vdycgfHwgZGVsZXRpb25Nb2RlID09ICdyZXN0b3JlJykge1xuICAgICAgICBvYmplY3QucmVtb3ZlKCk7XG4gICAgfVxuICAgIHJldHVybiBkZWZlcnJlZCA/IGRlZmVycmVkLnByb21pc2UgOiBudWxsO1xufVxuXG4vKipcbiAqIFNlbmQgYSBIVFRQIHJlcXVlc3QgdXNpbmcgdGhlIGdpdmVuIG1ldGhvZFxuICogQHBhcmFtIHtDb2xsZWN0aW9ufSBjb2xsZWN0aW9uXG4gKiBAcGFyYW0gcmVxdWVzdCBEb2VzIHRoZSByZXF1ZXN0IGNvbnRhaW4gZGF0YT8gZS5nLiBQT1NUL1BBVENIL1BVVCB3aWxsIGJlIHRydWUsIEdFVCB3aWxsIGZhbHNlXG4gKiBAcGFyYW0gbWV0aG9kXG4gKiBAaW50ZXJuYWxcbiAqIEByZXR1cm5zIHtQcm9taXNlfVxuICovXG5mdW5jdGlvbiBIVFRQX01FVEhPRChjb2xsZWN0aW9uLCByZXF1ZXN0LCBtZXRob2QpIHtcbiAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMyk7XG4gICAgcmV0dXJuIF8ucGFydGlhbChyZXF1ZXN0ID8gX2h0dHBSZXF1ZXN0IDogX2h0dHBSZXNwb25zZSwgbWV0aG9kKS5hcHBseShjb2xsZWN0aW9uLCBhcmdzKTtcbn1cblxuLyoqXG4gKiBTZW5kIGEgR0VUIHJlcXVlc3RcbiAqIEBwYXJhbSB7Q29sbGVjdGlvbn0gY29sbGVjdGlvblxuICogQHBhcmFtIHtTdHJpbmd9IHBhdGggVGhlIHBhdGggdG8gdGhlIHJlc291cmNlIHdlIHdhbnQgdG8gR0VUXG4gKiBAcGFyYW0ge09iamVjdHxGdW5jdGlvbn0gb3B0c09yQ2FsbGJhY2sgRWl0aGVyIGFuIG9wdGlvbnMgb2JqZWN0IG9yIGEgY2FsbGJhY2sgaWYgY2FuIHVzZSBkZWZhdWx0c1xuICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgQ2FsbGJhY2sgaWYgb3B0cyBzcGVjaWZpZWQuXG4gKiBAcGFja2FnZSBIVFRQXG4gKiBAcmV0dXJucyB7UHJvbWlzZX1cbiAqL1xuZnVuY3Rpb24gR0VUKGNvbGxlY3Rpb24pIHtcbiAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgcmV0dXJuIF8ucGFydGlhbChIVFRQX01FVEhPRCwgY29sbGVjdGlvbiwgZmFsc2UsICdHRVQnKS5hcHBseSh0aGlzLCBhcmdzKTtcbn1cblxuLyoqXG4gKiBTZW5kIGFuIE9QVElPTlMgcmVxdWVzdFxuICogQHBhcmFtIHtDb2xsZWN0aW9ufSBjb2xsZWN0aW9uXG4gKiBAcGFyYW0ge1N0cmluZ30gcGF0aCBUaGUgcGF0aCB0byB0aGUgcmVzb3VyY2Ugd2Ugd2FudCB0byBHRVRcbiAqIEBwYXJhbSB7T2JqZWN0fEZ1bmN0aW9ufSBvcHRzT3JDYWxsYmFjayBFaXRoZXIgYW4gb3B0aW9ucyBvYmplY3Qgb3IgYSBjYWxsYmFjayBpZiBjYW4gdXNlIGRlZmF1bHRzXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBDYWxsYmFjayBpZiBvcHRzIHNwZWNpZmllZC5cbiAqIEBwYWNrYWdlIEhUVFBcbiAqIEByZXR1cm5zIHtQcm9taXNlfVxuICovXG5mdW5jdGlvbiBPUFRJT05TKGNvbGxlY3Rpb24pIHtcbiAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgcmV0dXJuIF8ucGFydGlhbChIVFRQX01FVEhPRCwgY29sbGVjdGlvbiwgZmFsc2UsICdPUFRJT05TJykuYXBwbHkodGhpcywgYXJncyk7XG59XG5cbi8qKlxuICogU2VuZCBhbiBUUkFDRSByZXF1ZXN0XG4gKiBAcGFyYW0ge0NvbGxlY3Rpb259IGNvbGxlY3Rpb25cbiAqIEBwYXJhbSB7U3RyaW5nfSBwYXRoIFRoZSBwYXRoIHRvIHRoZSByZXNvdXJjZSB3ZSB3YW50IHRvIEdFVFxuICogQHBhcmFtIHtPYmplY3R8RnVuY3Rpb259IG9wdHNPckNhbGxiYWNrIEVpdGhlciBhbiBvcHRpb25zIG9iamVjdCBvciBhIGNhbGxiYWNrIGlmIGNhbiB1c2UgZGVmYXVsdHNcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIENhbGxiYWNrIGlmIG9wdHMgc3BlY2lmaWVkLlxuICogQHBhY2thZ2UgSFRUUFxuICogQHJldHVybnMge1Byb21pc2V9XG4gKi9cbmZ1bmN0aW9uIFRSQUNFKGNvbGxlY3Rpb24pIHtcbiAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgcmV0dXJuIF8ucGFydGlhbChIVFRQX01FVEhPRCwgY29sbGVjdGlvbiwgZmFsc2UsICdUUkFDRScpLmFwcGx5KHRoaXMsIGFyZ3MpO1xufVxuXG4vKipcbiAqIFNlbmQgYW4gSEVBRCByZXF1ZXN0XG4gKiBAcGFyYW0ge0NvbGxlY3Rpb259IGNvbGxlY3Rpb25cbiAqIEBwYXJhbSB7U3RyaW5nfSBwYXRoIFRoZSBwYXRoIHRvIHRoZSByZXNvdXJjZSB3ZSB3YW50IHRvIEdFVFxuICogQHBhcmFtIHtPYmplY3R8RnVuY3Rpb259IG9wdHNPckNhbGxiYWNrIEVpdGhlciBhbiBvcHRpb25zIG9iamVjdCBvciBhIGNhbGxiYWNrIGlmIGNhbiB1c2UgZGVmYXVsdHNcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIENhbGxiYWNrIGlmIG9wdHMgc3BlY2lmaWVkLlxuICogQHBhY2thZ2UgSFRUUFxuICogQHJldHVybnMge1Byb21pc2V9XG4gKi9cbmZ1bmN0aW9uIEhFQUQoY29sbGVjdGlvbikge1xuICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICByZXR1cm4gXy5wYXJ0aWFsKEhUVFBfTUVUSE9ELCBjb2xsZWN0aW9uLCBmYWxzZSwgJ0hFQUQnKS5hcHBseSh0aGlzLCBhcmdzKTtcbn1cblxuLyoqXG4gKiBTZW5kIGFuIFBPU1QgcmVxdWVzdFxuICogQHBhcmFtIHtDb2xsZWN0aW9ufSBjb2xsZWN0aW9uXG4gKiBAcGFyYW0ge1N0cmluZ30gcGF0aCBUaGUgcGF0aCB0byB0aGUgcmVzb3VyY2Ugd2Ugd2FudCB0byBHRVRcbiAqIEBwYXJhbSB7U2llc3RhTW9kZWx9IG1vZGVsIFRoZSBtb2RlbCB0aGF0IHdlIHdvdWxkIGxpa2UgdG8gUE9TVFxuICogQHBhcmFtIHtPYmplY3R8RnVuY3Rpb259IG9wdHNPckNhbGxiYWNrIEVpdGhlciBhbiBvcHRpb25zIG9iamVjdCBvciBhIGNhbGxiYWNrIGlmIGNhbiB1c2UgZGVmYXVsdHNcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIENhbGxiYWNrIGlmIG9wdHMgc3BlY2lmaWVkLlxuICogQHBhY2thZ2UgSFRUUFxuICogQHJldHVybnMge1Byb21pc2V9XG4gKi9cbmZ1bmN0aW9uIFBPU1QoY29sbGVjdGlvbikge1xuICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICByZXR1cm4gXy5wYXJ0aWFsKEhUVFBfTUVUSE9ELCBjb2xsZWN0aW9uLCB0cnVlLCAnUE9TVCcpLmFwcGx5KHRoaXMsIGFyZ3MpO1xufVxuXG4vKipcbiAqIFNlbmQgYW4gUFVUIHJlcXVlc3RcbiAqIEBwYXJhbSB7Q29sbGVjdGlvbn0gY29sbGVjdGlvblxuICogQHBhcmFtIHtTdHJpbmd9IHBhdGggVGhlIHBhdGggdG8gdGhlIHJlc291cmNlIHdlIHdhbnQgdG8gR0VUXG4gKiBAcGFyYW0ge1NpZXN0YU1vZGVsfSBtb2RlbCBUaGUgbW9kZWwgdGhhdCB3ZSB3b3VsZCBsaWtlIHRvIFBPU1RcbiAqIEBwYXJhbSB7T2JqZWN0fEZ1bmN0aW9ufSBvcHRzT3JDYWxsYmFjayBFaXRoZXIgYW4gb3B0aW9ucyBvYmplY3Qgb3IgYSBjYWxsYmFjayBpZiBjYW4gdXNlIGRlZmF1bHRzXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBDYWxsYmFjayBpZiBvcHRzIHNwZWNpZmllZC5cbiAqIEBwYWNrYWdlIEhUVFBcbiAqIEByZXR1cm5zIHtQcm9taXNlfVxuICovXG5mdW5jdGlvbiBQVVQoY29sbGVjdGlvbikge1xuICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICByZXR1cm4gXy5wYXJ0aWFsKEhUVFBfTUVUSE9ELCBjb2xsZWN0aW9uLCB0cnVlLCAnUFVUJykuYXBwbHkodGhpcywgYXJncyk7XG59XG5cbi8qKlxuICogU2VuZCBhbiBQQVRDSCByZXF1ZXN0XG4gKiBAcGFyYW0ge0NvbGxlY3Rpb259IGNvbGxlY3Rpb25cbiAqIEBwYXJhbSB7U3RyaW5nfSBwYXRoIFRoZSBwYXRoIHRvIHRoZSByZXNvdXJjZSB3ZSB3YW50IHRvIEdFVFxuICogQHBhcmFtIHtTaWVzdGFNb2RlbH0gbW9kZWwgVGhlIG1vZGVsIHRoYXQgd2Ugd291bGQgbGlrZSB0byBQT1NUXG4gKiBAcGFyYW0ge09iamVjdHxGdW5jdGlvbn0gb3B0c09yQ2FsbGJhY2sgRWl0aGVyIGFuIG9wdGlvbnMgb2JqZWN0IG9yIGEgY2FsbGJhY2sgaWYgY2FuIHVzZSBkZWZhdWx0c1xuICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgQ2FsbGJhY2sgaWYgb3B0cyBzcGVjaWZpZWQuXG4gKiBAcGFja2FnZSBIVFRQXG4gKiBAcmV0dXJucyB7UHJvbWlzZX1cbiAqL1xuZnVuY3Rpb24gUEFUQ0goY29sbGVjdGlvbikge1xuICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICByZXR1cm4gXy5wYXJ0aWFsKEhUVFBfTUVUSE9ELCBjb2xsZWN0aW9uLCB0cnVlLCAnUEFUQ0gnKS5hcHBseSh0aGlzLCBhcmdzKTtcbn1cblxuXG5cblxuXG5cbnZhciBhamF4O1xuXG5cbnZhciBodHRwID0ge1xuICAgIFJlcXVlc3REZXNjcmlwdG9yOiByZXF1aXJlKCcuL3JlcXVlc3REZXNjcmlwdG9yJykuUmVxdWVzdERlc2NyaXB0b3IsXG4gICAgUmVzcG9uc2VEZXNjcmlwdG9yOiByZXF1aXJlKCcuL3Jlc3BvbnNlRGVzY3JpcHRvcicpLlJlc3BvbnNlRGVzY3JpcHRvcixcbiAgICBEZXNjcmlwdG9yOiBkZXNjcmlwdG9yLkRlc2NyaXB0b3IsXG4gICAgX3Jlc29sdmVNZXRob2Q6IGRlc2NyaXB0b3IucmVzb2x2ZU1ldGhvZCxcbiAgICBTZXJpYWxpc2VyOiByZXF1aXJlKCcuL3NlcmlhbGlzZXInKSxcbiAgICBEZXNjcmlwdG9yUmVnaXN0cnk6IHJlcXVpcmUoJy4vZGVzY3JpcHRvclJlZ2lzdHJ5JykuRGVzY3JpcHRvclJlZ2lzdHJ5LFxuICAgIHNldEFqYXg6IGZ1bmN0aW9uKF9hamF4KSB7XG4gICAgICAgIGFqYXggPSBfYWpheDtcbiAgICB9LFxuICAgIF9odHRwUmVzcG9uc2U6IF9odHRwUmVzcG9uc2UsXG4gICAgX2h0dHBSZXF1ZXN0OiBfaHR0cFJlcXVlc3QsXG4gICAgREVMRVRFOiBERUxFVEUsXG4gICAgSFRUUF9NRVRIT0Q6IEhUVFBfTUVUSE9ELFxuICAgIEdFVDogR0VULFxuICAgIFRSQUNFOiBUUkFDRSxcbiAgICBPUFRJT05TOiBPUFRJT05TLFxuICAgIEhFQUQ6IEhFQUQsXG4gICAgUE9TVDogUE9TVCxcbiAgICBQVVQ6IFBVVCxcbiAgICBQQVRDSDogUEFUQ0gsXG4gICAgX3NlcmlhbGlzZU9iamVjdDogX3NlcmlhbGlzZU9iamVjdFxufTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGh0dHAsICdhamF4Jywge1xuICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBhID0gYWpheCB8fCAoJCA/ICQuYWpheCA6IG51bGwpIHx8IChqUXVlcnkgPyBqUXVlcnkuYWpheCA6IG51bGwpO1xuICAgICAgICBpZiAoIWEpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdhamF4IGhhcyBub3QgYmVlbiBkZWZpbmVkIGFuZCBjb3VsZCBub3QgZmluZCAkLmFqYXggb3IgalF1ZXJ5LmFqYXgnKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gYTtcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24odikge1xuICAgICAgICBhamF4ID0gdjtcbiAgICB9XG59KTtcblxuaWYgKHR5cGVvZiBzaWVzdGEgIT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBpZiAoIXNpZXN0YS5leHQpIHtcbiAgICAgICAgc2llc3RhLmV4dCA9IHt9O1xuICAgIH1cbiAgICBzaWVzdGEuZXh0Lmh0dHAgPSBodHRwO1xufVxuXG5pZiAodHlwZW9mIG1vZHVsZSAhPSAndW5kZWZpbmVkJykge1xuICAgIG1vZHVsZS5leHBvcnRzID0gaHR0cDtcbn0iLCIvKipcbiAqIEBtb2R1bGUgaHR0cFxuICovXG5cbnZhciBEZXNjcmlwdG9yID0gcmVxdWlyZSgnLi9kZXNjcmlwdG9yJykuRGVzY3JpcHRvclxuICAgICwgU2VyaWFsaXNlciA9IHJlcXVpcmUoJy4vc2VyaWFsaXNlcicpO1xuXG52YXIgX2kgPSBzaWVzdGEuX2ludGVybmFsXG4gICAgLCB1dGlsID0gX2kudXRpbFxuICAgICwgXyA9IHV0aWwuX1xuICAgICwgbG9nID0gX2kubG9nXG4gICAgLCBkZWZpbmVTdWJQcm9wZXJ0eSA9IF9pLm1pc2MuZGVmaW5lU3ViUHJvcGVydHlcbjtcblxudmFyIExvZ2dlciA9IGxvZy5sb2dnZXJXaXRoTmFtZSgnUmVxdWVzdERlc2NyaXB0b3InKTtcbkxvZ2dlci5zZXRMZXZlbChsb2cuTGV2ZWwud2Fybik7XG5cbi8qKlxuICogQGNsYXNzIERlc2NyaWJlcyBhIEhUVFAgcmVxdWVzdFxuICogQHBhcmFtIHtPYmplY3R9IG9wdHNcbiAqL1xuZnVuY3Rpb24gUmVxdWVzdERlc2NyaXB0b3Iob3B0cykge1xuICAgIGlmICghdGhpcykge1xuICAgICAgICByZXR1cm4gbmV3IFJlcXVlc3REZXNjcmlwdG9yKG9wdHMpO1xuICAgIH1cblxuICAgIERlc2NyaXB0b3IuY2FsbCh0aGlzLCBvcHRzKTtcbiAgICBpZiAodGhpcy5fb3B0c1snc2VyaWFsaXplciddKSB7XG4gICAgICAgIHRoaXMuX29wdHMuc2VyaWFsaXNlciA9IHRoaXMuX29wdHNbJ3NlcmlhbGl6ZXInXTtcbiAgICB9XG5cbiAgICBpZiAoIXRoaXMuX29wdHMuc2VyaWFsaXNlcikge1xuICAgICAgICB0aGlzLl9vcHRzLnNlcmlhbGlzZXIgPSBTZXJpYWxpc2VyLmRlcHRoU2VyaWFsaXplcigwKTtcbiAgICB9XG5cblxuICAgIGRlZmluZVN1YlByb3BlcnR5LmNhbGwodGhpcywgJ3NlcmlhbGlzZXInLCB0aGlzLl9vcHRzKTtcbiAgICBkZWZpbmVTdWJQcm9wZXJ0eS5jYWxsKHRoaXMsICdzZXJpYWxpemVyJywgdGhpcy5fb3B0cywgJ3NlcmlhbGlzZXInKTtcblxufVxuXG5SZXF1ZXN0RGVzY3JpcHRvci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKERlc2NyaXB0b3IucHJvdG90eXBlKTtcblxuXy5leHRlbmQoUmVxdWVzdERlc2NyaXB0b3IucHJvdG90eXBlLCB7XG4gICAgX3NlcmlhbGlzZTogZnVuY3Rpb24gKG9iaiwgY2FsbGJhY2spIHtcbiAgICAgICAgdmFyIGRlZmVycmVkID0gd2luZG93LnEgPyB3aW5kb3cucS5kZWZlcigpIDogbnVsbDtcbiAgICAgICAgY2FsbGJhY2sgPSB1dGlsLmNvbnN0cnVjdENhbGxiYWNrQW5kUHJvbWlzZUhhbmRsZXIoY2FsbGJhY2ssIGRlZmVycmVkKTtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICBpZiAoTG9nZ2VyLnRyYWNlLmlzRW5hYmxlZClcbiAgICAgICAgICAgIExvZ2dlci50cmFjZSgnX3NlcmlhbGlzZScpO1xuICAgICAgICB2YXIgZmluaXNoZWQ7XG4gICAgICAgIHZhciBkYXRhID0gdGhpcy5zZXJpYWxpc2VyKG9iaiwgZnVuY3Rpb24gKGVyciwgZGF0YSkge1xuICAgICAgICAgICAgaWYgKCFmaW5pc2hlZCkge1xuICAgICAgICAgICAgICAgIGRhdGEgPSBzZWxmLl90cmFuc2Zvcm1EYXRhKGRhdGEpO1xuICAgICAgICAgICAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2soZXJyLCBzZWxmLl9lbWJlZERhdGEoZGF0YSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgaWYgKGRhdGEgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgaWYgKExvZ2dlci50cmFjZS5pc0VuYWJsZWQpXG4gICAgICAgICAgICAgICAgTG9nZ2VyLnRyYWNlKCdzZXJpYWxpc2VyIGRvZXNudCB1c2UgYSBjYWxsYmFjaycpO1xuICAgICAgICAgICAgZmluaXNoZWQgPSB0cnVlO1xuICAgICAgICAgICAgZGF0YSA9IHNlbGYuX3RyYW5zZm9ybURhdGEoZGF0YSk7XG4gICAgICAgICAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKG51bGwsIHNlbGYuX2VtYmVkRGF0YShkYXRhKSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBpZiAoTG9nZ2VyLnRyYWNlLmlzRW5hYmxlZClcbiAgICAgICAgICAgICAgICBMb2dnZXIudHJhY2UoJ3NlcmlhbGlzZXIgdXNlcyBhIGNhbGxiYWNrJywgdGhpcy5zZXJpYWxpc2VyKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZGVmZXJyZWQgPyBkZWZlcnJlZC5wcm9taXNlIDogbnVsbDtcbiAgICB9LFxuICAgIF9kdW1wOiBmdW5jdGlvbiAoYXNKc29uKSB7XG4gICAgICAgIHZhciBvYmogPSB7fTtcbiAgICAgICAgb2JqLm1ldGhvZHMgPSB0aGlzLm1ldGhvZDtcbiAgICAgICAgb2JqLm1hcHBpbmcgPSB0aGlzLm1hcHBpbmcudHlwZTtcbiAgICAgICAgb2JqLnBhdGggPSB0aGlzLl9yYXdPcHRzLnBhdGg7XG4gICAgICAgIHZhciBzZXJpYWxpc2VyO1xuICAgICAgICBpZiAodHlwZW9mKHRoaXMuX3Jhd09wdHMuc2VyaWFsaXNlcikgPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgc2VyaWFsaXNlciA9ICdmdW5jdGlvbiAoKSB7IC4uLiB9J1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgc2VyaWFsaXNlciA9IHRoaXMuX3Jhd09wdHMuc2VyaWFsaXNlcjtcbiAgICAgICAgfVxuICAgICAgICBvYmouc2VyaWFsaXNlciA9IHNlcmlhbGlzZXI7XG4gICAgICAgIHZhciB0cmFuc2Zvcm1zID0ge307XG4gICAgICAgIGZvciAodmFyIGYgaW4gdGhpcy50cmFuc2Zvcm1zKSB7XG4gICAgICAgICAgICBpZiAodGhpcy50cmFuc2Zvcm1zLmhhc093blByb3BlcnR5KGYpKSB7XG4gICAgICAgICAgICAgICAgdmFyIHRyYW5zZm9ybSA9IHRoaXMudHJhbnNmb3Jtc1tmXTtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mKHRyYW5zZm9ybSkgPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgICAgICAgICB0cmFuc2Zvcm1zW2ZdID0gJ2Z1bmN0aW9uICgpIHsgLi4uIH0nXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0cmFuc2Zvcm1zW2ZdID0gdGhpcy50cmFuc2Zvcm1zW2ZdO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBvYmoudHJhbnNmb3JtcyA9IHRyYW5zZm9ybXM7XG4gICAgICAgIHJldHVybiBhc0pzb24gPyBKU09OLnN0cmluZ2lmeShvYmosIG51bGwsIDQpIDogb2JqO1xuICAgIH1cbn0pO1xuXG5leHBvcnRzLlJlcXVlc3REZXNjcmlwdG9yID0gUmVxdWVzdERlc2NyaXB0b3I7XG4iLCIvKipcbiAqIEBtb2R1bGUgaHR0cFxuICovXG5cblxudmFyIERlc2NyaXB0b3IgPSByZXF1aXJlKCcuL2Rlc2NyaXB0b3InKS5EZXNjcmlwdG9yO1xuXG4vKipcbiAqIERlc2NyaWJlcyB3aGF0IHRvIGRvIHdpdGggYSBIVFRQIHJlc3BvbnNlLlxuICogQGNvbnN0cnVjdG9yXG4gKiBAaW1wbGVtZW50cyB7RGVzY3JpcHRvcn1cbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRzXG4gKi9cbmZ1bmN0aW9uIFJlc3BvbnNlRGVzY3JpcHRvcihvcHRzKSB7XG4gICAgaWYgKCF0aGlzKSB7XG4gICAgICAgIHJldHVybiBuZXcgUmVzcG9uc2VEZXNjcmlwdG9yKG9wdHMpO1xuICAgIH1cbiAgICBEZXNjcmlwdG9yLmNhbGwodGhpcywgb3B0cyk7XG59XG5cblJlc3BvbnNlRGVzY3JpcHRvci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKERlc2NyaXB0b3IucHJvdG90eXBlKTtcblxuXy5leHRlbmQoUmVzcG9uc2VEZXNjcmlwdG9yLnByb3RvdHlwZSwge1xuICAgIF9leHRyYWN0RGF0YTogZnVuY3Rpb24gKGRhdGEpIHtcbiAgICAgICAgdmFyIGV4dHJhY3RlZERhdGEgPSBEZXNjcmlwdG9yLnByb3RvdHlwZS5fZXh0cmFjdERhdGEuY2FsbCh0aGlzLCBkYXRhKTtcbiAgICAgICAgaWYgKGV4dHJhY3RlZERhdGEpIHtcbiAgICAgICAgICAgIGV4dHJhY3RlZERhdGEgPSB0aGlzLl90cmFuc2Zvcm1EYXRhKGV4dHJhY3RlZERhdGEpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBleHRyYWN0ZWREYXRhO1xuICAgIH0sXG4gICAgX21hdGNoRGF0YTogZnVuY3Rpb24gKGRhdGEpIHtcbiAgICAgICAgdmFyIGV4dHJhY3RlZERhdGEgPSBEZXNjcmlwdG9yLnByb3RvdHlwZS5fbWF0Y2hEYXRhLmNhbGwodGhpcywgZGF0YSk7XG4gICAgICAgIGlmIChleHRyYWN0ZWREYXRhKSB7XG4gICAgICAgICAgICBleHRyYWN0ZWREYXRhID0gdGhpcy5fdHJhbnNmb3JtRGF0YShleHRyYWN0ZWREYXRhKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZXh0cmFjdGVkRGF0YTtcbiAgICB9LFxuICAgIF9kdW1wOiBmdW5jdGlvbiAoYXNKc29uKSB7XG4gICAgICAgIHZhciBvYmogPSB7fTtcbiAgICAgICAgb2JqLm1ldGhvZHMgPSB0aGlzLm1ldGhvZDtcbiAgICAgICAgb2JqLm1hcHBpbmcgPSB0aGlzLm1hcHBpbmcudHlwZTtcbiAgICAgICAgb2JqLnBhdGggPSB0aGlzLl9yYXdPcHRzLnBhdGg7XG4gICAgICAgIHZhciB0cmFuc2Zvcm1zID0ge307XG4gICAgICAgIGZvciAodmFyIGYgaW4gdGhpcy50cmFuc2Zvcm1zKSB7XG4gICAgICAgICAgICBpZiAodGhpcy50cmFuc2Zvcm1zLmhhc093blByb3BlcnR5KGYpKSB7XG4gICAgICAgICAgICAgICAgdmFyIHRyYW5zZm9ybSA9IHRoaXMudHJhbnNmb3Jtc1tmXTtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mKHRyYW5zZm9ybSkgPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgICAgICAgICB0cmFuc2Zvcm1zW2ZdID0gJ2Z1bmN0aW9uICgpIHsgLi4uIH0nXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0cmFuc2Zvcm1zW2ZdID0gdGhpcy50cmFuc2Zvcm1zW2ZdO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBvYmoudHJhbnNmb3JtcyA9IHRyYW5zZm9ybXM7XG4gICAgICAgIHJldHVybiBhc0pzb24gPyBKU09OLnN0cmluZ2lmeShvYmosIG51bGwsIDQpIDogb2JqO1xuICAgIH1cbn0pO1xuXG5leHBvcnRzLlJlc3BvbnNlRGVzY3JpcHRvciA9IFJlc3BvbnNlRGVzY3JpcHRvcjsiLCIvKipcbiAqIEBtb2R1bGUgaHR0cFxuICovXG5cbnZhciBfaSA9IHNpZXN0YS5faW50ZXJuYWw7XG5cbnZhciBsb2cgPSBfaS5sb2dcbiAgICAsIHV0aWxzID0gX2kudXRpbDtcbnZhciBMb2dnZXIgPSBsb2cubG9nZ2VyV2l0aE5hbWUoJ1NlcmlhbGlzZXInKTtcbkxvZ2dlci5zZXRMZXZlbChsb2cuTGV2ZWwud2Fybik7XG52YXIgXyA9IHV0aWxzLl87XG5cbi8qKlxuICogU2VyaWFsaXNlcyBhbiBvYmplY3QgaW50byBpdCdzIHJlbW90ZSBpZGVudGlmaWVyIChhcyBkZWZpbmVkIGJ5IHRoZSBtYXBwaW5nKVxuICogQHBhcmFtICB7U2llc3RhTW9kZWx9IG9ialxuICogQHJldHVybiB7U3RyaW5nfVxuICogXG4gKi9cbmZ1bmN0aW9uIGlkU2VyaWFsaXNlcihvYmopIHtcbiAgICB2YXIgaWRGaWVsZCA9IG9iai5tYXBwaW5nLmlkO1xuICAgIGlmIChpZEZpZWxkKSB7XG4gICAgICAgIHJldHVybiBvYmpbaWRGaWVsZF0gPyBvYmpbaWRGaWVsZF0gOiBudWxsO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgaWYgKExvZ2dlci5kZWJ1Zy5pc0VuYWJsZWQpXG4gICAgICAgICAgICBMb2dnZXIuZGVidWcoJ05vIGlkZmllbGQnKTtcbiAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG59XG5cbi8qKlxuICogU2VyaWFsaXNlcyBvYmogZm9sbG93aW5nIHJlbGF0aW9uc2hpcHMgdG8gc3BlY2lmaWVkIGRlcHRoLlxuICogQHBhcmFtICB7SW50ZWdlcn0gICBkZXB0aFxuICogQHBhcmFtICB7U2llc3RhTW9kZWx9ICAgb2JqXG4gKiBAcGFyYW0gIHtGdW5jdGlvbn0gZG9uZSBcbiAqL1xuZnVuY3Rpb24gZGVwdGhTZXJpYWxpc2VyKGRlcHRoLCBvYmosIGRvbmUpIHtcbiAgICBpZiAoTG9nZ2VyLnRyYWNlLmlzRW5hYmxlZClcbiAgICAgICAgTG9nZ2VyLnRyYWNlKCdkZXB0aFNlcmlhbGlzZXInKTtcbiAgICB2YXIgZGF0YSA9IHt9O1xuICAgIF8uZWFjaChvYmouX2ZpZWxkcywgZnVuY3Rpb24gKGYpIHtcbiAgICAgICAgaWYgKExvZ2dlci50cmFjZS5pc0VuYWJsZWQpXG4gICAgICAgICAgICBMb2dnZXIudHJhY2UoJ2ZpZWxkJywgZik7XG4gICAgICAgIGlmIChvYmpbZl0pIHtcbiAgICAgICAgICAgIGRhdGFbZl0gPSBvYmpbZl07XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICB2YXIgd2FpdGluZyA9IFtdO1xuICAgIHZhciBlcnJvcnMgPSBbXTtcbiAgICB2YXIgcmVzdWx0ID0ge307XG4gICAgdmFyIGZpbmlzaGVkID0gW107XG4gICAgXy5lYWNoKG9iai5fcmVsYXRpb25zaGlwRmllbGRzLCBmdW5jdGlvbiAoZikge1xuICAgICAgICBpZiAoTG9nZ2VyLnRyYWNlLmlzRW5hYmxlZClcbiAgICAgICAgICAgIExvZ2dlci50cmFjZSgncmVsYXRpb25zaGlwRmllbGQnLCBmKTtcbiAgICAgICAgdmFyIHByb3h5ID0gb2JqLl9fcHJveGllc1tmXTtcbiAgICAgICAgaWYgKHByb3h5LmlzRm9yd2FyZCkgeyAvLyBCeSBkZWZhdWx0IG9ubHkgZm9yd2FyZCByZWxhdGlvbnNoaXAuXG4gICAgICAgICAgICBpZiAoTG9nZ2VyLmRlYnVnLmlzRW5hYmxlZClcbiAgICAgICAgICAgICAgICBMb2dnZXIuZGVidWcoZik7XG4gICAgICAgICAgICB3YWl0aW5nLnB1c2goZik7XG4gICAgICAgICAgICBwcm94eS5nZXQoZnVuY3Rpb24gKGVyciwgdikge1xuICAgICAgICAgICAgICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKVxuICAgICAgICAgICAgICAgICAgICBMb2dnZXIudHJhY2UoJ3Byb3h5LmdldCcsIGYpO1xuICAgICAgICAgICAgICAgIGlmIChMb2dnZXIuZGVidWcuaXNFbmFibGVkKVxuICAgICAgICAgICAgICAgICAgICBMb2dnZXIuZGVidWcoZiwgdik7XG4gICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICBlcnJvcnMucHVzaChlcnIpO1xuICAgICAgICAgICAgICAgICAgICBmaW5pc2hlZC5wdXNoKGYpO1xuICAgICAgICAgICAgICAgICAgICByZXN1bHRbZl0gPSB7ZXJyOiBlcnIsIHY6IHZ9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIGlmICh2KSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghZGVwdGgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZpbmlzaGVkLnB1c2goZik7XG4gICAgICAgICAgICAgICAgICAgICAgICBkYXRhW2ZdID0gdltvYmouX19wcm94aWVzW2ZdLmZvcndhcmRNYXBwaW5nLmlkXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc3VsdFtmXSA9IHtlcnI6IGVyciwgdjogdn07XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoKHdhaXRpbmcubGVuZ3RoID09IGZpbmlzaGVkLmxlbmd0aCkgJiYgZG9uZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRvbmUoZXJyb3JzLmxlbmd0aCA/IGVycm9ycyA6IG51bGwsIGRhdGEsIHJlc3VsdCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkZXB0aFNlcmlhbGlzZXIoZGVwdGggLSAxLCB2LCBmdW5jdGlvbiAoZXJyLCBzdWJEYXRhLCByZXNwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlcnJvcnMucHVzaChlcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0YVtmXSA9IHN1YkRhdGE7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZpbmlzaGVkLnB1c2goZik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzdWx0W2ZdID0ge2VycjogZXJyLCB2OiB2LCByZXNwOiByZXNwfTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoKHdhaXRpbmcubGVuZ3RoID09IGZpbmlzaGVkLmxlbmd0aCkgJiYgZG9uZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkb25lKGVycm9ycy5sZW5ndGggPyBlcnJvcnMgOiBudWxsLCBkYXRhLCByZXN1bHQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBpZiAoTG9nZ2VyLmRlYnVnLmlzRW5hYmxlZClcbiAgICAgICAgICAgICAgICAgICAgICAgIExvZ2dlci5kZWJ1Zygnbm8gdmFsdWUgZm9yICcgKyBmKTtcbiAgICAgICAgICAgICAgICAgICAgZmluaXNoZWQucHVzaChmKTtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0W2ZdID0ge2VycjogZXJyLCB2OiB2fTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCh3YWl0aW5nLmxlbmd0aCA9PSBmaW5pc2hlZC5sZW5ndGgpICYmIGRvbmUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRvbmUoZXJyb3JzLmxlbmd0aCA/IGVycm9ycyA6IG51bGwsIGRhdGEsIHJlc3VsdCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH0pO1xuICAgIGlmICghd2FpdGluZy5sZW5ndGgpIHtcbiAgICAgICAgaWYgKGRvbmUpIGRvbmUobnVsbCwgZGF0YSwge30pO1xuICAgIH1cbn1cblxuXG5leHBvcnRzLmRlcHRoU2VyaWFsaXNlciA9IGZ1bmN0aW9uIChkZXB0aCkge1xuICAgIHJldHVybiAgXy5wYXJ0aWFsKGRlcHRoU2VyaWFsaXNlciwgZGVwdGgpO1xufTtcbmV4cG9ydHMuZGVwdGhTZXJpYWxpemVyID0gZnVuY3Rpb24gKGRlcHRoKSB7XG4gICAgcmV0dXJuICBfLnBhcnRpYWwoZGVwdGhTZXJpYWxpc2VyLCBkZXB0aCk7XG59O1xuZXhwb3J0cy5pZFNlcmlhbGl6ZXIgPSBpZFNlcmlhbGlzZXI7XG5leHBvcnRzLmlkU2VyaWFsaXNlciA9IGlkU2VyaWFsaXNlcjtcblxuIl19
