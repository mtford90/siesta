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
        for (i=0; i<this._opts.path.length; i++) {
            var names = this.names[i];
            var regExp = this._opts.path[i];
            var match = regExp.exec(path);
            if (match) {
                for (i = 1; i < match.length; i++) {
                    matches.push(match[i]);
                }
                var matched;
                if (matches.length == names.length) {
                    matched = {};
                    _.each(matches, function (m, i) {
                        matched[names[i]] = m;
                    }.bind(this));
                    return matched;
                }
            }
        }
        return null;
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

if (!siesta) {
    throw new Error('Could not find siesta');
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
                    callback(null, null, resp);
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
        callback(null, null, null);
    }
    return deferred ? deferred.promise : null;
};

/**
 * Send a DELETE request. Also removes the object.
 * @param {Collection} collection
 * @param {Stirng} path The path to the resource to which we want to DELETE
 * @param {SiestaModel} model The model that we would like to PATCH
 * @param {Object|Function} optsOrCallback Either an options object or a callback if can use defaults
 * @param {Function} callback Callback if opts specified.
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


if (!siesta.ext) {
    siesta.ext = {};
}


var ajax;


siesta.ext.http = {
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

Object.defineProperty(siesta.ext.http, 'ajax', {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9zcmMvaHR0cC9kZXNjcmlwdG9yLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3Qvc3JjL2h0dHAvZGVzY3JpcHRvclJlZ2lzdHJ5LmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3Qvc3JjL2h0dHAvaHR0cC5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L3NyYy9odHRwL3JlcXVlc3REZXNjcmlwdG9yLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3Qvc3JjL2h0dHAvcmVzcG9uc2VEZXNjcmlwdG9yLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3Qvc3JjL2h0dHAvc2VyaWFsaXNlci5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hiQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hZQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvKipcbiAqIERlc2NyaXB0b3JzIGRlYWwgd2l0aCB0aGUgZGVzY3JpcHRpb24gb2YgSFRUUCByZXF1ZXN0cyBhbmQgYXJlIHVzZWQgYnkgU2llc3RhIHRvIGRldGVybWluZSB3aGF0IHRvIGRvXG4gKiB3aXRoIEhUVFAgcmVxdWVzdC9yZXNwb25zZSBib2RpZXMuXG4gKiBAbW9kdWxlIGh0dHBcbiAqL1xuXG52YXIgX2kgPSBzaWVzdGEuX2ludGVybmFsLFxuICAgIGxvZyA9IF9pLmxvZyxcbiAgICBJbnRlcm5hbFNpZXN0YUVycm9yID0gX2kuZXJyb3IuSW50ZXJuYWxTaWVzdGFFcnJvcixcbiAgICBhc3NlcnQgPSBfaS5taXNjLmFzc2VydCxcbiAgICBkZWZpbmVTdWJQcm9wZXJ0eSA9IF9pLm1pc2MuZGVmaW5lU3ViUHJvcGVydHksXG4gICAgQ29sbGVjdGlvblJlZ2lzdHJ5ID0gX2kuQ29sbGVjdGlvblJlZ2lzdHJ5LFxuICAgIGV4dGVuZCA9IF9pLmV4dGVuZCxcbiAgICB1dGlsID0gX2kudXRpbCxcbiAgICBfID0gdXRpbC5fO1xuXG52YXIgTG9nZ2VyID0gbG9nLmxvZ2dlcldpdGhOYW1lKCdEZXNjcmlwdG9yJyk7XG5Mb2dnZXIuc2V0TGV2ZWwobG9nLkxldmVsLndhcm4pO1xuXG52YXIgaHR0cE1ldGhvZHMgPSBbJ1BPU1QnLCAnUEFUQ0gnLCAnUFVUJywgJ0hFQUQnLCAnR0VUJywgJ0RFTEVURScsICdPUFRJT05TJywgJ1RSQUNFJywgJ0NPTk5FQ1QnXTtcblxuZnVuY3Rpb24gcmVzb2x2ZU1ldGhvZChtZXRob2RzKSB7XG4gICAgLy8gQ29udmVydCB3aWxkY2FyZHMgaW50byBtZXRob2RzIGFuZCBlbnN1cmUgaXMgYW4gYXJyYXkgb2YgdXBwZXJjYXNlIG1ldGhvZHMuXG4gICAgaWYgKG1ldGhvZHMpIHtcbiAgICAgICAgaWYgKG1ldGhvZHMgPT0gJyonIHx8IG1ldGhvZHMuaW5kZXhPZignKicpID4gLTEpIHtcbiAgICAgICAgICAgIG1ldGhvZHMgPSBodHRwTWV0aG9kcztcbiAgICAgICAgfSBlbHNlIGlmICghdXRpbC5pc0FycmF5KG1ldGhvZHMpKSB7XG4gICAgICAgICAgICBtZXRob2RzID0gW21ldGhvZHNdO1xuICAgICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgICAgbWV0aG9kcyA9IFsnR0VUJ107XG4gICAgfVxuICAgIHJldHVybiBfLm1hcChtZXRob2RzLCBmdW5jdGlvbiAoeCkge1xuICAgICAgICByZXR1cm4geC50b1VwcGVyQ2FzZSgpXG4gICAgfSk7XG59XG5cbi8qKlxuICogQSBkZXNjcmlwdG9yICdkZXNjcmliZXMnIHBvc3NpYmxlIEhUVFAgcmVxdWVzdHMgYWdhaW5zdCBhbiBBUEksIGFuZCBpcyB1c2VkIHRvIGRlY2lkZSB3aGV0aGVyIG9yIG5vdCB0b1xuICogaW50ZXJjZXB0IGEgSFRUUCByZXF1ZXN0L3Jlc3BvbnNlIGFuZCBwZXJmb3JtIGEgbWFwcGluZy5cbiAqXG4gKiBAY29uc3RydWN0b3JcbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRzXG4gKi9cbmZ1bmN0aW9uIERlc2NyaXB0b3Iob3B0cykge1xuICAgIGlmICghdGhpcykge1xuICAgICAgICByZXR1cm4gbmV3IERlc2NyaXB0b3Iob3B0cyk7XG4gICAgfVxuXG4gICAgdGhpcy5fcmF3T3B0cyA9IGV4dGVuZCh0cnVlLCB7fSwgb3B0cyk7XG4gICAgdGhpcy5fb3B0cyA9IG9wdHM7XG5cbiAgICAvLyBUT0RPOiBUaGlzIGlzIGEgYml0IGhhY2t5LlxuICAgIC8vIEVzc2VudGlhbGx5IGhhY2tpbmcgbmFtZWQgZ3JvdXBzIGludG8gamF2YXNjcmlwdCByZWd1bGFyIGV4cHJlc3Npb25zLlxuICAgIC8vIE9yaWdpbmFsbHkgd2FzIHVzaW5nIFhSZWdFeHAgYnV0IHRoYXQgbGlicmFyeSBpcyAzMDBrYiwgMzBrIGd1bnppcHBlZC4gRnVjayB0aGF0LlxuICAgIC8vIEkgZG8gc3VzcGVjdCB0aGF0IHRoaXMgaXMgYSBiaXQgc2tldGNoeSB0aG8uLi5cbiAgICB2YXIgcHJvY2Vzc1BhdGggPSBmdW5jdGlvbiAocmF3KSB7XG4gICAgICAgIHZhciByID0gL1xcPzwoWzAtOWEtekEtWl8tXSopPi9nO1xuICAgICAgICB2YXIgbWF0Y2gsIG5hbWVzID0gW107XG4gICAgICAgIHdoaWxlIChtYXRjaCA9IHIuZXhlYyhyYXcpKSB7XG4gICAgICAgICAgICB2YXIgbmFtZSA9IG1hdGNoWzFdO1xuICAgICAgICAgICAgbmFtZXMucHVzaChuYW1lKTtcbiAgICAgICAgfVxuICAgICAgICByYXcgPSByYXcucmVwbGFjZShyLCAnJyk7XG4gICAgICAgIHZhciByZWdFeHAgPSBuZXcgUmVnRXhwKHJhdywgJ2cnKTtcbiAgICAgICAgcmV0dXJuIHtuYW1lczogbmFtZXMsIHJlZ0V4cDogcmVnRXhwfTtcbiAgICB9LmJpbmQodGhpcyk7XG5cbiAgICBpZiAodGhpcy5fb3B0cy5wYXRoKSB7XG4gICAgICAgIHZhciBwYXRocyA9IHRoaXMuX29wdHMucGF0aDtcbiAgICAgICAgaWYgKCF1dGlsLmlzQXJyYXkocGF0aHMpKSB7XG4gICAgICAgICAgICBwYXRocyA9IFtwYXRoc107XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9vcHRzLnBhdGggPSBbXTtcbiAgICAgICAgdGhpcy5uYW1lcyA9IFtdO1xuXG4gICAgICAgIF8uZWFjaChwYXRocywgZnVuY3Rpb24gKHApIHtcbiAgICAgICAgICAgIHZhciBfX3JldCA9IHByb2Nlc3NQYXRoLmNhbGwodGhpcywgcCk7XG4gICAgICAgICAgICB0aGlzLl9vcHRzLnBhdGgucHVzaChfX3JldC5yZWdFeHApO1xuICAgICAgICAgICAgdGhpcy5uYW1lcy5wdXNoKF9fcmV0Lm5hbWVzKTtcbiAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLl9vcHRzLnBhdGggPSBbJyddO1xuICAgICAgICB0aGlzLm5hbWVzID0gW1tdXTtcbiAgICB9XG5cbiAgICB0aGlzLl9vcHRzLm1ldGhvZCA9IHJlc29sdmVNZXRob2QodGhpcy5fb3B0cy5tZXRob2QpO1xuXG4gICAgLy8gTWFwcGluZ3MgY2FuIGJlIHBhc3NlZCBhcyB0aGUgYWN0dWFsIG1hcHBpbmcgb2JqZWN0IG9yIGFzIGEgc3RyaW5nICh3aXRoIEFQSSBzcGVjaWZpZWQgdG9vKVxuICAgIGlmICh0aGlzLl9vcHRzLm1hcHBpbmcpIHtcbiAgICAgICAgaWYgKHR5cGVvZih0aGlzLl9vcHRzLm1hcHBpbmcpID09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fb3B0cy5jb2xsZWN0aW9uKSB7XG4gICAgICAgICAgICAgICAgdmFyIGNvbGxlY3Rpb247XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZih0aGlzLl9vcHRzLmNvbGxlY3Rpb24pID09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbGxlY3Rpb24gPSBDb2xsZWN0aW9uUmVnaXN0cnlbdGhpcy5fb3B0cy5jb2xsZWN0aW9uXTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBjb2xsZWN0aW9uID0gdGhpcy5fb3B0cy5jb2xsZWN0aW9uO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoY29sbGVjdGlvbikge1xuICAgICAgICAgICAgICAgICAgICB2YXIgYWN0dWFsTWFwcGluZyA9IGNvbGxlY3Rpb25bdGhpcy5fb3B0cy5tYXBwaW5nXTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGFjdHVhbE1hcHBpbmcpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX29wdHMubWFwcGluZyA9IGFjdHVhbE1hcHBpbmc7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ01hcHBpbmcgJyArIHRoaXMuX29wdHMubWFwcGluZyArICcgZG9lcyBub3QgZXhpc3QnLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb3B0czogb3B0cyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdG9yOiB0aGlzXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignQ29sbGVjdGlvbiAnICsgdGhpcy5fb3B0cy5jb2xsZWN0aW9uICsgJyBkb2VzIG5vdCBleGlzdCcsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG9wdHM6IG9wdHMsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdG9yOiB0aGlzXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdQYXNzZWQgbWFwcGluZyBhcyBzdHJpbmcsIGJ1dCBkaWQgbm90IHNwZWNpZnkgdGhlIGNvbGxlY3Rpb24gaXQgYmVsb25ncyB0bycsIHtcbiAgICAgICAgICAgICAgICAgICAgb3B0czogb3B0cyxcbiAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRvcjogdGhpc1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdEZXNjcmlwdG9ycyBtdXN0IGJlIGluaXRpYWxpc2VkIHdpdGggYSBtYXBwaW5nJywge1xuICAgICAgICAgICAgb3B0czogb3B0cyxcbiAgICAgICAgICAgIGRlc2NyaXB0b3I6IHRoaXNcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gSWYga2V5IHBhdGgsIGNvbnZlcnQgZGF0YSBrZXkgcGF0aCBpbnRvIGFuIG9iamVjdCB0aGF0IHdlIGNhbiB0aGVuIHVzZSB0byB0cmF2ZXJzZSB0aGUgSFRUUCBib2RpZXMuXG4gICAgLy8gb3RoZXJ3aXNlIGxlYXZlIGFzIHN0cmluZyBvciB1bmRlZmluZWQuXG4gICAgdmFyIGRhdGEgPSB0aGlzLl9vcHRzLmRhdGE7XG4gICAgaWYgKGRhdGEpIHtcbiAgICAgICAgaWYgKGRhdGEubGVuZ3RoKSB7XG4gICAgICAgICAgICB2YXIgcm9vdDtcbiAgICAgICAgICAgIHZhciBhcnIgPSBkYXRhLnNwbGl0KCcuJyk7XG4gICAgICAgICAgICBpZiAoYXJyLmxlbmd0aCA9PSAxKSB7XG4gICAgICAgICAgICAgICAgcm9vdCA9IGFyclswXTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdmFyIG9iaiA9IHt9O1xuICAgICAgICAgICAgICAgIHJvb3QgPSBvYmo7XG4gICAgICAgICAgICAgICAgdmFyIHByZXZpb3VzS2V5ID0gYXJyWzBdO1xuICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAxOyBpIDwgYXJyLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBrZXkgPSBhcnJbaV07XG4gICAgICAgICAgICAgICAgICAgIGlmIChpID09IChhcnIubGVuZ3RoIC0gMSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG9ialtwcmV2aW91c0tleV0gPSBrZXk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgbmV3VmFyID0ge307XG4gICAgICAgICAgICAgICAgICAgICAgICBvYmpbcHJldmlvdXNLZXldID0gbmV3VmFyO1xuICAgICAgICAgICAgICAgICAgICAgICAgb2JqID0gbmV3VmFyO1xuICAgICAgICAgICAgICAgICAgICAgICAgcHJldmlvdXNLZXkgPSBrZXk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLl9vcHRzLmRhdGEgPSByb290O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQG5hbWUgcGF0aFxuICAgICAqIEB0eXBlIHtTdHJpbmd9XG4gICAgICovXG4gICAgZGVmaW5lU3ViUHJvcGVydHkuY2FsbCh0aGlzLCAncGF0aCcsIHRoaXMuX29wdHMpO1xuICAgIGRlZmluZVN1YlByb3BlcnR5LmNhbGwodGhpcywgJ21ldGhvZCcsIHRoaXMuX29wdHMpO1xuICAgIGRlZmluZVN1YlByb3BlcnR5LmNhbGwodGhpcywgJ21hcHBpbmcnLCB0aGlzLl9vcHRzKTtcbiAgICBkZWZpbmVTdWJQcm9wZXJ0eS5jYWxsKHRoaXMsICdkYXRhJywgdGhpcy5fb3B0cyk7XG4gICAgZGVmaW5lU3ViUHJvcGVydHkuY2FsbCh0aGlzLCAndHJhbnNmb3JtcycsIHRoaXMuX29wdHMpO1xufVxuXG5fLmV4dGVuZChEZXNjcmlwdG9yLnByb3RvdHlwZSwge1xuICAgIGh0dHBNZXRob2RzOiBodHRwTWV0aG9kcyxcbiAgICAvKipcbiAgICAgKiBUYWtlcyBhIHJlZ2V4IHBhdGggYW5kIHJldHVybnMgYW4gb2JqZWN0IGlmIG1hdGNoZWQuXG4gICAgICogSWYgYW55IHJlZ3VsYXIgZXhwcmVzc2lvbiBncm91cHMgd2VyZSBkZWZpbmVkLCB0aGUgcmV0dXJuZWQgb2JqZWN0IHdpbGwgY29udGFpbiB0aGUgbWF0Y2hlcy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSAge1N0cmluZ3xSZWdFeHB9IHBhdGhcbiAgICAgKiBAcmV0dXJuIHtPYmplY3R9XG4gICAgICogQGludGVybmFsXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBgYGBqc1xuICAgICAqIHZhciBkID0gbmV3IERlc2NyaXB0b3Ioe1xuICAgICAqICAgICBwYXRoOiAnL3Jlc291cmNlLyg/UDxpZD4pLydcbiAgICAgKiB9KVxuICAgICAqIHZhciBtYXRjaGVkID0gZC5fbWF0Y2hQYXRoKCcvcmVzb3VyY2UvMicpO1xuICAgICAqIGNvbnNvbGUubG9nKG1hdGNoZWQpOyAvLyB7aWQ6ICcyJ31cbiAgICAgKiBgYGBcbiAgICAgKi9cbiAgICBfbWF0Y2hQYXRoOiBmdW5jdGlvbiAocGF0aCkge1xuICAgICAgICB2YXIgaTtcbiAgICAgICAgdmFyIG1hdGNoZXMgPSBbXTtcbiAgICAgICAgZm9yIChpPTA7IGk8dGhpcy5fb3B0cy5wYXRoLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB2YXIgbmFtZXMgPSB0aGlzLm5hbWVzW2ldO1xuICAgICAgICAgICAgdmFyIHJlZ0V4cCA9IHRoaXMuX29wdHMucGF0aFtpXTtcbiAgICAgICAgICAgIHZhciBtYXRjaCA9IHJlZ0V4cC5leGVjKHBhdGgpO1xuICAgICAgICAgICAgaWYgKG1hdGNoKSB7XG4gICAgICAgICAgICAgICAgZm9yIChpID0gMTsgaSA8IG1hdGNoLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIG1hdGNoZXMucHVzaChtYXRjaFtpXSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHZhciBtYXRjaGVkO1xuICAgICAgICAgICAgICAgIGlmIChtYXRjaGVzLmxlbmd0aCA9PSBuYW1lcy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgbWF0Y2hlZCA9IHt9O1xuICAgICAgICAgICAgICAgICAgICBfLmVhY2gobWF0Y2hlcywgZnVuY3Rpb24gKG0sIGkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG1hdGNoZWRbbmFtZXNbaV1dID0gbTtcbiAgICAgICAgICAgICAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG1hdGNoZWQ7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH0sXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0cnVlIGlmIHRoZSBkZXNjcmlwdG9yIGFjY2VwdHMgdGhlIEhUVFAgbWV0aG9kLlxuICAgICAqXG4gICAgICogQHBhcmFtICB7U3RyaW5nfSBtZXRob2RcbiAgICAgKiBAcmV0dXJuIHtib29sZWFufVxuICAgICAqIEBpbnRlcm5hbFxuICAgICAqIEBleGFtcGxlXG4gICAgICogYGBganNcbiAgICAgKiB2YXIgZCA9IG5ldyBEZXNjcmlwdG9yKHtcbiAgICAgKiAgICAgbWV0aG9kOiBbJ1BPU1QnLCAnUFVUJ11cbiAgICAgKiB9KTtcbiAgICAgKiBjb25zb2xlLmxvZyhkLl9tYXRjaE1ldGhvZCgnR0VUJykpOyAvLyBmYWxzZVxuICAgICAqIGBgYFxuICAgICAqL1xuICAgIF9tYXRjaE1ldGhvZDogZnVuY3Rpb24gKG1ldGhvZCkge1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMubWV0aG9kLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAobWV0aG9kLnRvVXBwZXJDYXNlKCkgPT0gdGhpcy5tZXRob2RbaV0pIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBQZXJmb3JtcyBhIGJyZWFkdGgtZmlyc3Qgc2VhcmNoIHRocm91Z2ggZGF0YSwgZW1iZWRkaW5nIG9iaiBpbiB0aGUgZmlyc3QgbGVhZi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSAge09iamVjdH0gb2JqXG4gICAgICogQHBhcmFtICB7T2JqZWN0fSBkYXRhXG4gICAgICogQHJldHVybiB7T2JqZWN0fVxuICAgICAqL1xuICAgIGJ1cnk6IGZ1bmN0aW9uIChvYmosIGRhdGEpIHtcbiAgICAgICAgdmFyIHJvb3QgPSBkYXRhO1xuICAgICAgICB2YXIga2V5cyA9IE9iamVjdC5rZXlzKGRhdGEpO1xuICAgICAgICBhc3NlcnQoa2V5cy5sZW5ndGggPT0gMSk7XG4gICAgICAgIHZhciBrZXkgPSBrZXlzWzBdO1xuICAgICAgICB2YXIgY3VyciA9IGRhdGE7XG4gICAgICAgIHdoaWxlICghKHR5cGVvZihjdXJyW2tleV0pID09ICdzdHJpbmcnKSkge1xuICAgICAgICAgICAgY3VyciA9IGN1cnJba2V5XTtcbiAgICAgICAgICAgIGtleXMgPSBPYmplY3Qua2V5cyhjdXJyKTtcbiAgICAgICAgICAgIGFzc2VydChrZXlzLmxlbmd0aCA9PSAxKTtcbiAgICAgICAgICAgIGtleSA9IGtleXNbMF07XG4gICAgICAgIH1cbiAgICAgICAgdmFyIG5ld1BhcmVudCA9IGN1cnJba2V5XTtcbiAgICAgICAgdmFyIG5ld09iaiA9IHt9O1xuICAgICAgICBjdXJyW2tleV0gPSBuZXdPYmo7XG4gICAgICAgIG5ld09ialtuZXdQYXJlbnRdID0gb2JqO1xuICAgICAgICByZXR1cm4gcm9vdDtcbiAgICB9LFxuICAgIF9lbWJlZERhdGE6IGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgICAgIGlmICh0aGlzLmRhdGEpIHtcbiAgICAgICAgICAgIHZhciBuZXN0ZWQ7XG4gICAgICAgICAgICBpZiAodHlwZW9mKHRoaXMuZGF0YSkgPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICBuZXN0ZWQgPSB7fTtcbiAgICAgICAgICAgICAgICBuZXN0ZWRbdGhpcy5kYXRhXSA9IGRhdGE7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIG5lc3RlZCA9IHRoaXMuYnVyeShkYXRhLCBleHRlbmQodHJ1ZSwge30sIHRoaXMuZGF0YSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIG5lc3RlZDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBkYXRhO1xuICAgICAgICB9XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBJZiBuZXN0ZWQgZGF0YSBoYXMgYmVlbiBzcGVjaWZpZWQgaW4gdGhlIGRlc2NyaXB0b3IsIGV4dHJhY3QgdGhlIGRhdGEuXG4gICAgICogQHBhcmFtICB7T2JqZWN0fSBkYXRhXG4gICAgICogQHJldHVybiB7T2JqZWN0fVxuICAgICAqL1xuICAgIF9leHRyYWN0RGF0YTogZnVuY3Rpb24gKGRhdGEpIHtcbiAgICAgICAgaWYgKExvZ2dlci5kZWJ1Zy5pc0VuYWJsZWQpXG4gICAgICAgICAgICBMb2dnZXIuZGVidWcoJ19leHRyYWN0RGF0YScsIGRhdGEpO1xuICAgICAgICBpZiAodGhpcy5kYXRhKSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mKHRoaXMuZGF0YSkgPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZGF0YVt0aGlzLmRhdGFdO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB2YXIga2V5cyA9IE9iamVjdC5rZXlzKHRoaXMuZGF0YSk7XG4gICAgICAgICAgICAgICAgYXNzZXJ0KGtleXMubGVuZ3RoID09IDEpO1xuICAgICAgICAgICAgICAgIHZhciBjdXJyVGhlaXJzID0gZGF0YTtcbiAgICAgICAgICAgICAgICB2YXIgY3Vyck91cnMgPSB0aGlzLmRhdGE7XG4gICAgICAgICAgICAgICAgd2hpbGUgKHR5cGVvZihjdXJyT3VycykgIT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICAgICAga2V5cyA9IE9iamVjdC5rZXlzKGN1cnJPdXJzKTtcbiAgICAgICAgICAgICAgICAgICAgYXNzZXJ0KGtleXMubGVuZ3RoID09IDEpO1xuICAgICAgICAgICAgICAgICAgICB2YXIga2V5ID0ga2V5c1swXTtcbiAgICAgICAgICAgICAgICAgICAgY3Vyck91cnMgPSBjdXJyT3Vyc1trZXldO1xuICAgICAgICAgICAgICAgICAgICBjdXJyVGhlaXJzID0gY3VyclRoZWlyc1trZXldO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWN1cnJUaGVpcnMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiBjdXJyVGhlaXJzID8gY3VyclRoZWlyc1tjdXJyT3Vyc10gOiBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIGRhdGE7XG4gICAgICAgIH1cbiAgICB9LFxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdGhpcyBkZXNjcmlwdG9ycyBtYXBwaW5nIGlmIHRoZSByZXF1ZXN0IGNvbmZpZyBtYXRjaGVzLlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBjb25maWdcbiAgICAgKiBAcmV0dXJucyB7T2JqZWN0fVxuICAgICAqL1xuICAgIF9tYXRjaENvbmZpZzogZnVuY3Rpb24gKGNvbmZpZykge1xuICAgICAgICB2YXIgbWF0Y2hlcyA9IGNvbmZpZy50eXBlID8gdGhpcy5fbWF0Y2hNZXRob2QoY29uZmlnLnR5cGUpIDoge307XG4gICAgICAgIGlmIChtYXRjaGVzKSB7XG4gICAgICAgICAgICBtYXRjaGVzID0gY29uZmlnLnVybCA/IHRoaXMuX21hdGNoUGF0aChjb25maWcudXJsKSA6IHt9O1xuICAgICAgICB9XG4gICAgICAgIGlmIChtYXRjaGVzKSB7XG4gICAgICAgICAgICBpZiAoTG9nZ2VyLnRyYWNlLmlzRW5hYmxlZClcbiAgICAgICAgICAgICAgICBMb2dnZXIudHJhY2UoJ21hdGNoZWQgY29uZmlnJyk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG1hdGNoZXM7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgZGF0YSBpZiB0aGUgZGF0YSBtYXRjaGVzLCBwZXJmb3JtaW5nIGFueSBleHRyYWN0aW9uIGFzIHNwZWNpZmllZCBpbiBvcHRzLmRhdGFcbiAgICAgKlxuICAgICAqIEBwYXJhbSAge09iamVjdH0gZGF0YVxuICAgICAqIEByZXR1cm4ge09iamVjdH1cbiAgICAgKi9cbiAgICBfbWF0Y2hEYXRhOiBmdW5jdGlvbiAoZGF0YSkge1xuICAgICAgICB2YXIgZXh0cmFjdGVkRGF0YSA9IG51bGw7XG4gICAgICAgIGlmICh0aGlzLmRhdGEpIHtcbiAgICAgICAgICAgIGlmIChkYXRhKSB7XG4gICAgICAgICAgICAgICAgZXh0cmFjdGVkRGF0YSA9IHRoaXMuX2V4dHJhY3REYXRhKGRhdGEpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZXh0cmFjdGVkRGF0YSA9IGRhdGE7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGV4dHJhY3RlZERhdGEpIHtcbiAgICAgICAgICAgIExvZ2dlci50cmFjZSgnbWF0Y2hlZCBkYXRhJyk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGV4dHJhY3RlZERhdGE7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBDaGVjayBpZiB0aGUgSFRUUCBjb25maWcgYW5kIHJldHVybmVkIGRhdGEgbWF0Y2ggdGhpcyBkZXNjcmlwdG9yIGRlZmluaXRpb24uXG4gICAgICpcbiAgICAgKiBAcGFyYW0gIHtPYmplY3R9IGNvbmZpZyBDb25maWcgb2JqZWN0IGZvciAkLmFqYXggYW5kIHNpbWlsYXJcbiAgICAgKiBAcGFyYW0gIHtPYmplY3R9IGRhdGFcbiAgICAgKiBAcmV0dXJuIHtPYmplY3R9IEV4dHJhY3RlZCBkYXRhXG4gICAgICovXG4gICAgbWF0Y2g6IGZ1bmN0aW9uIChjb25maWcsIGRhdGEpIHtcbiAgICAgICAgdmFyIHJlZ2V4TWF0Y2hlcyA9IHRoaXMuX21hdGNoQ29uZmlnKGNvbmZpZyk7XG4gICAgICAgIHZhciBtYXRjaGVzID0gISFyZWdleE1hdGNoZXM7XG4gICAgICAgIHZhciBleHRyYWN0ZWREYXRhID0gZmFsc2U7XG4gICAgICAgIGlmIChtYXRjaGVzKSB7XG4gICAgICAgICAgICBMb2dnZXIudHJhY2UoJ2NvbmZpZyBtYXRjaGVzJyk7XG4gICAgICAgICAgICBleHRyYWN0ZWREYXRhID0gdGhpcy5fbWF0Y2hEYXRhKGRhdGEpO1xuICAgICAgICAgICAgbWF0Y2hlcyA9ICEhZXh0cmFjdGVkRGF0YTtcbiAgICAgICAgICAgIGlmIChtYXRjaGVzKSB7XG4gICAgICAgICAgICAgICAgdmFyIGtleTtcbiAgICAgICAgICAgICAgICBpZiAodXRpbC5pc0FycmF5KGV4dHJhY3RlZERhdGEpKSB7XG4gICAgICAgICAgICAgICAgICAgIGZvciAoa2V5IGluIHJlZ2V4TWF0Y2hlcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHJlZ2V4TWF0Y2hlcy5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXy5lYWNoKGV4dHJhY3RlZERhdGEsIGZ1bmN0aW9uIChkYXR1bSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkYXR1bVtrZXldID0gcmVnZXhNYXRjaGVzW2tleV07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGtleSBpbiByZWdleE1hdGNoZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChyZWdleE1hdGNoZXMuaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGV4dHJhY3RlZERhdGFba2V5XSA9IHJlZ2V4TWF0Y2hlc1trZXldO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIExvZ2dlci50cmFjZSgnZGF0YSBtYXRjaGVzJyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIExvZ2dlci50cmFjZSgnZGF0YSBkb2VzbnQgbWF0Y2gnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIExvZ2dlci50cmFjZSgnY29uZmlnIGRvZXNudCBtYXRjaCcpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBleHRyYWN0ZWREYXRhO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBBcHBseSBhbnkgdHJhbnNmb3Jtcy5cbiAgICAgKiBAcGFyYW0gIHtPYmplY3R9IGRhdGEgU2VyaWFsaXNlZCBkYXRhLlxuICAgICAqIEByZXR1cm4ge09iamVjdH0gU2VyaWFsaXNlZCBkYXRhIHdpdGggYXBwbGllZCB0cmFuc2Zvcm1hdGlvbnMuXG4gICAgICovXG4gICAgX3RyYW5zZm9ybURhdGE6IGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgICAgIHZhciB0cmFuc2Zvcm1zID0gdGhpcy50cmFuc2Zvcm1zO1xuICAgICAgICBpZiAodHlwZW9mKHRyYW5zZm9ybXMpID09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIGRhdGEgPSB0cmFuc2Zvcm1zKGRhdGEpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZm9yICh2YXIgYXR0ciBpbiB0cmFuc2Zvcm1zKSB7XG4gICAgICAgICAgICAgICAgaWYgKHRyYW5zZm9ybXMuaGFzT3duUHJvcGVydHkoYXR0cikpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGRhdGFbYXR0cl0pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciB0cmFuc2Zvcm0gPSB0cmFuc2Zvcm1zW2F0dHJdO1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHZhbCA9IGRhdGFbYXR0cl07XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mKHRyYW5zZm9ybSkgPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgc3BsaXQgPSB0cmFuc2Zvcm0uc3BsaXQoJy4nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZWxldGUgZGF0YVthdHRyXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoc3BsaXQubGVuZ3RoID09IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0YVtzcGxpdFswXV0gPSB2YWw7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0YVtzcGxpdFswXV0gPSB7fTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG5ld1ZhbCA9IGRhdGFbc3BsaXRbMF1dO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMTsgaSA8IHNwbGl0Lmxlbmd0aCAtIDE7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG5ld0F0dHIgPSBzcGxpdFtpXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5ld1ZhbFtuZXdBdHRyXSA9IHt9O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV3VmFsID0gbmV3VmFsW25ld0F0dHJdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5ld1ZhbFtzcGxpdFtzcGxpdC5sZW5ndGggLSAxXV0gPSB2YWw7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YodHJhbnNmb3JtKSA9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHRyYW5zZm9ybWVkID0gdHJhbnNmb3JtKHZhbCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHV0aWwuaXNBcnJheSh0cmFuc2Zvcm1lZCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVsZXRlIGRhdGFbYXR0cl07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdGFbdHJhbnNmb3JtZWRbMF1dID0gdHJhbnNmb3JtZWRbMV07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0YVthdHRyXSA9IHRyYW5zZm9ybWVkO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ0ludmFsaWQgdHJhbnNmb3JtZXInKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZGF0YTtcbiAgICB9XG59KTtcblxuZXhwb3J0cy5EZXNjcmlwdG9yID0gRGVzY3JpcHRvcjtcbmV4cG9ydHMucmVzb2x2ZU1ldGhvZCA9IHJlc29sdmVNZXRob2Q7IiwidmFyIF9pID0gc2llc3RhLl9pbnRlcm5hbDtcbnZhciBsb2cgPSBfaS5sb2c7XG52YXIgTG9nZ2VyID0gbG9nLmxvZ2dlcldpdGhOYW1lKCdEZXNjcmlwdG9yUmVnaXN0cnknKTtcbkxvZ2dlci5zZXRMZXZlbChsb2cuTGV2ZWwud2Fybik7XG5cbnZhciBhc3NlcnQgPSBfaS5taXNjLmFzc2VydCxcbiAgICB1dGlsID0gX2kudXRpbCxcbiAgICBfID0gdXRpbC5fO1xuXG5cbi8qKlxuICogQGNsYXNzIEVudHJ5IHBvaW50IGZvciBkZXNjcmlwdG9yIHJlZ2lzdHJhdGlvbi5cbiAqIEBjb25zdHJ1Y3RvclxuICovXG5mdW5jdGlvbiBEZXNjcmlwdG9yUmVnaXN0cnkoKSB7XG4gICAgaWYgKCF0aGlzKSB7XG4gICAgICAgIHJldHVybiBuZXcgRGVzY3JpcHRvclJlZ2lzdHJ5KG9wdHMpO1xuICAgIH1cbiAgICB0aGlzLnJlcXVlc3REZXNjcmlwdG9ycyA9IHt9O1xuICAgIHRoaXMucmVzcG9uc2VEZXNjcmlwdG9ycyA9IHt9O1xufVxuXG5mdW5jdGlvbiBfcmVnaXN0ZXJEZXNjcmlwdG9yKGRlc2NyaXB0b3JzLCBkZXNjcmlwdG9yKSB7XG4gICAgdmFyIG1hcHBpbmcgPSBkZXNjcmlwdG9yLm1hcHBpbmc7XG4gICAgdmFyIGNvbGxlY3Rpb24gPSBtYXBwaW5nLmNvbGxlY3Rpb247XG4gICAgYXNzZXJ0KG1hcHBpbmcpO1xuICAgIGFzc2VydChjb2xsZWN0aW9uKTtcbiAgICBhc3NlcnQodHlwZW9mKGNvbGxlY3Rpb24pID09ICdzdHJpbmcnKTtcbiAgICBpZiAoIWRlc2NyaXB0b3JzW2NvbGxlY3Rpb25dKSB7XG4gICAgICAgIGRlc2NyaXB0b3JzW2NvbGxlY3Rpb25dID0gW107XG4gICAgfVxuICAgIGRlc2NyaXB0b3JzW2NvbGxlY3Rpb25dLnB1c2goZGVzY3JpcHRvcik7XG59XG5cbmZ1bmN0aW9uIF9kZXNjcmlwdG9yc0ZvckNvbGxlY3Rpb24oZGVzY3JpcHRvcnMsIGNvbGxlY3Rpb24pIHtcbiAgICB2YXIgZGVzY3JpcHRvcnNGb3JDb2xsZWN0aW9uO1xuICAgIGlmICh0eXBlb2YoY29sbGVjdGlvbikgPT0gJ3N0cmluZycpIHtcbiAgICAgICAgZGVzY3JpcHRvcnNGb3JDb2xsZWN0aW9uID0gZGVzY3JpcHRvcnNbY29sbGVjdGlvbl0gfHwgW107XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICBkZXNjcmlwdG9yc0ZvckNvbGxlY3Rpb24gPSAoZGVzY3JpcHRvcnNbY29sbGVjdGlvbi5fbmFtZV0gfHwgW10pO1xuICAgIH1cbiAgICByZXR1cm4gZGVzY3JpcHRvcnNGb3JDb2xsZWN0aW9uO1xufVxuXG5fLmV4dGVuZChEZXNjcmlwdG9yUmVnaXN0cnkucHJvdG90eXBlLCB7XG4gICAgcmVnaXN0ZXJSZXF1ZXN0RGVzY3JpcHRvcjogZnVuY3Rpb24gKHJlcXVlc3REZXNjcmlwdG9yKSB7XG4gICAgICAgIF9yZWdpc3RlckRlc2NyaXB0b3IodGhpcy5yZXF1ZXN0RGVzY3JpcHRvcnMsIHJlcXVlc3REZXNjcmlwdG9yKTtcbiAgICB9LFxuICAgIHJlZ2lzdGVyUmVzcG9uc2VEZXNjcmlwdG9yOiBmdW5jdGlvbiAocmVzcG9uc2VEZXNjcmlwdG9yKSB7XG4gICAgICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKVxuICAgICAgICAgICAgTG9nZ2VyLnRyYWNlKCdyZWdpc3RlclJlc3BvbnNlRGVzY3JpcHRvcicpO1xuICAgICAgICBfcmVnaXN0ZXJEZXNjcmlwdG9yKHRoaXMucmVzcG9uc2VEZXNjcmlwdG9ycywgcmVzcG9uc2VEZXNjcmlwdG9yKTtcbiAgICB9LFxuICAgIHJlcXVlc3REZXNjcmlwdG9yc0ZvckNvbGxlY3Rpb246IGZ1bmN0aW9uIChjb2xsZWN0aW9uKSB7XG4gICAgICAgIHJldHVybiBfZGVzY3JpcHRvcnNGb3JDb2xsZWN0aW9uKHRoaXMucmVxdWVzdERlc2NyaXB0b3JzLCBjb2xsZWN0aW9uKTtcbiAgICB9LFxuICAgIHJlc3BvbnNlRGVzY3JpcHRvcnNGb3JDb2xsZWN0aW9uOiBmdW5jdGlvbiAoY29sbGVjdGlvbikge1xuICAgICAgICB2YXIgZGVzY3JpcHRvcnNGb3JDb2xsZWN0aW9uID0gX2Rlc2NyaXB0b3JzRm9yQ29sbGVjdGlvbih0aGlzLnJlc3BvbnNlRGVzY3JpcHRvcnMsIGNvbGxlY3Rpb24pO1xuICAgICAgICBpZiAoIWRlc2NyaXB0b3JzRm9yQ29sbGVjdGlvbi5sZW5ndGgpIHtcbiAgICAgICAgICAgIGlmIChMb2dnZXIuZGVidWcuaXNFbmFibGVkKVxuICAgICAgICAgICAgICAgIExvZ2dlci5kZWJ1ZygnTm8gcmVzcG9uc2UgZGVzY3JpcHRvcnMgZm9yIGNvbGxlY3Rpb24gJywgdGhpcy5yZXNwb25zZURlc2NyaXB0b3JzKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZGVzY3JpcHRvcnNGb3JDb2xsZWN0aW9uO1xuICAgIH0sXG4gICAgcmVzZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGhpcy5yZXF1ZXN0RGVzY3JpcHRvcnMgPSB7fTtcbiAgICAgICAgdGhpcy5yZXNwb25zZURlc2NyaXB0b3JzID0ge307XG4gICAgfVxufSk7XG5cbmV4cG9ydHMuRGVzY3JpcHRvclJlZ2lzdHJ5ID0gbmV3IERlc2NyaXB0b3JSZWdpc3RyeSgpOyIsIi8qKlxuICogUHJvdmlzaW9ucyB1c2FnZSBvZiAkLmFqYXggYW5kIHNpbWlsYXIgZnVuY3Rpb25zIHRvIHNlbmQgSFRUUCByZXF1ZXN0cyBtYXBwaW5nXG4gKiB0aGUgcmVzdWx0cyBiYWNrIG9udG8gdGhlIG9iamVjdCBncmFwaCBhdXRvbWF0aWNhbGx5LlxuICogQG1vZHVsZSBodHRwXG4gKi9cblxuaWYgKCFzaWVzdGEpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0NvdWxkIG5vdCBmaW5kIHNpZXN0YScpO1xufVxuXG52YXIgX2kgPSBzaWVzdGEuX2ludGVybmFsLFxuICAgIENvbGxlY3Rpb24gPSBzaWVzdGEuQ29sbGVjdGlvbixcbiAgICBsb2cgPSBfaS5sb2csXG4gICAgdXRpbCA9IF9pLnV0aWwsXG4gICAgXyA9IHV0aWwuXyxcbiAgICBkZXNjcmlwdG9yID0gcmVxdWlyZSgnLi9kZXNjcmlwdG9yJyksXG4gICAgSW50ZXJuYWxTaWVzdGFFcnJvciA9IF9pLmVycm9yLkludGVybmFsU2llc3RhRXJyb3I7XG5cbnZhciBEZXNjcmlwdG9yUmVnaXN0cnkgPSByZXF1aXJlKCcuL2Rlc2NyaXB0b3JSZWdpc3RyeScpLkRlc2NyaXB0b3JSZWdpc3RyeTtcblxuXG52YXIgTG9nZ2VyID0gbG9nLmxvZ2dlcldpdGhOYW1lKCdIVFRQJyk7XG5Mb2dnZXIuc2V0TGV2ZWwobG9nLkxldmVsLndhcm4pO1xuXG4vKipcbiAqIFNlbmQgYSBIVFRQIHJlcXVlc3QgdG8gdGhlIGdpdmVuIG1ldGhvZCBhbmQgcGF0aCBwYXJzaW5nIHRoZSByZXNwb25zZS5cbiAqIEBwYXJhbSB7U3RyaW5nfSBtZXRob2RcbiAqIEBwYXJhbSB7U3RyaW5nfSBwYXRoIFRoZSBwYXRoIHRvIHRoZSByZXNvdXJjZSB3ZSB3YW50IHRvIEdFVFxuICogQHBhcmFtIHtPYmplY3R8RnVuY3Rpb259IG9wdHNPckNhbGxiYWNrIEVpdGhlciBhbiBvcHRpb25zIG9iamVjdCBvciBhIGNhbGxiYWNrIGlmIGNhbiB1c2UgZGVmYXVsdHNcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIENhbGxiYWNrIGlmIG9wdHMgc3BlY2lmaWVkLlxuICovXG5mdW5jdGlvbiBfaHR0cFJlc3BvbnNlKG1ldGhvZCwgcGF0aCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMik7XG4gICAgdmFyIGNhbGxiYWNrO1xuICAgIHZhciBvcHRzID0ge307XG4gICAgdmFyIG5hbWUgPSB0aGlzLl9uYW1lO1xuICAgIGlmICh0eXBlb2YoYXJnc1swXSkgPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICBjYWxsYmFjayA9IGFyZ3NbMF07XG4gICAgfSBlbHNlIGlmICh0eXBlb2YoYXJnc1swXSkgPT0gJ29iamVjdCcpIHtcbiAgICAgICAgb3B0cyA9IGFyZ3NbMF07XG4gICAgICAgIGNhbGxiYWNrID0gYXJnc1sxXTtcbiAgICB9XG4gICAgdmFyIGRlZmVycmVkID0gd2luZG93LnEgPyB3aW5kb3cucS5kZWZlcigpIDogbnVsbDtcbiAgICBjYWxsYmFjayA9IHV0aWwuY29uc3RydWN0Q2FsbGJhY2tBbmRQcm9taXNlSGFuZGxlcihjYWxsYmFjaywgZGVmZXJyZWQpO1xuICAgIG9wdHMudHlwZSA9IG1ldGhvZDtcbiAgICBpZiAoIW9wdHMudXJsKSB7IC8vIEFsbG93IG92ZXJyaWRlcy5cbiAgICAgICAgdmFyIGJhc2VVUkwgPSB0aGlzLmJhc2VVUkw7XG4gICAgICAgIG9wdHMudXJsID0gYmFzZVVSTCArIHBhdGg7XG4gICAgfVxuICAgIGlmIChvcHRzLnBhcnNlUmVzcG9uc2UgPT09IHVuZGVmaW5lZCkgb3B0cy5wYXJzZVJlc3BvbnNlID0gdHJ1ZTtcbiAgICBvcHRzLnN1Y2Nlc3MgPSBmdW5jdGlvbihkYXRhLCB0ZXh0U3RhdHVzLCBqcVhIUikge1xuICAgICAgICBpZiAoTG9nZ2VyLnRyYWNlLmlzRW5hYmxlZClcbiAgICAgICAgICAgIExvZ2dlci50cmFjZShvcHRzLnR5cGUgKyAnICcgKyBqcVhIUi5zdGF0dXMgKyAnICcgKyBvcHRzLnVybCArICc6ICcgKyBKU09OLnN0cmluZ2lmeShkYXRhLCBudWxsLCA0KSk7XG4gICAgICAgIHZhciByZXNwID0ge1xuICAgICAgICAgICAgZGF0YTogZGF0YSxcbiAgICAgICAgICAgIHRleHRTdGF0dXM6IHRleHRTdGF0dXMsXG4gICAgICAgICAgICBqcVhIUjoganFYSFJcbiAgICAgICAgfTtcbiAgICAgICAgaWYgKG9wdHMucGFyc2VSZXNwb25zZSkge1xuICAgICAgICAgICAgdmFyIGRlc2NyaXB0b3JzID0gRGVzY3JpcHRvclJlZ2lzdHJ5LnJlc3BvbnNlRGVzY3JpcHRvcnNGb3JDb2xsZWN0aW9uKHNlbGYpO1xuICAgICAgICAgICAgdmFyIG1hdGNoZWREZXNjcmlwdG9yO1xuICAgICAgICAgICAgdmFyIGV4dHJhY3RlZERhdGE7XG5cbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgZGVzY3JpcHRvcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICB2YXIgZGVzY3JpcHRvciA9IGRlc2NyaXB0b3JzW2ldO1xuICAgICAgICAgICAgICAgIGV4dHJhY3RlZERhdGEgPSBkZXNjcmlwdG9yLm1hdGNoKG9wdHMsIGRhdGEpO1xuICAgICAgICAgICAgICAgIGlmIChleHRyYWN0ZWREYXRhKSB7XG4gICAgICAgICAgICAgICAgICAgIG1hdGNoZWREZXNjcmlwdG9yID0gZGVzY3JpcHRvcjtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAobWF0Y2hlZERlc2NyaXB0b3IpIHtcbiAgICAgICAgICAgICAgICBpZiAoTG9nZ2VyLnRyYWNlLmlzRW5hYmxlZClcbiAgICAgICAgICAgICAgICAgICAgTG9nZ2VyLnRyYWNlKCdNYXBwaW5nIGV4dHJhY3RlZCBkYXRhOiAnICsgSlNPTi5zdHJpbmdpZnkoZXh0cmFjdGVkRGF0YSwgbnVsbCwgNCkpO1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YoZXh0cmFjdGVkRGF0YSkgPT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIG1hcHBpbmcgPSBtYXRjaGVkRGVzY3JpcHRvci5tYXBwaW5nO1xuICAgICAgICAgICAgICAgICAgICBtYXBwaW5nLm1hcChleHRyYWN0ZWREYXRhLCBmdW5jdGlvbihlcnIsIG9iaikge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGNhbGxiYWNrKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIsIG9iaiwgcmVzcCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0sIG9wdHMub2JqKTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgeyAvLyBNYXRjaGVkLCBidXQgbm8gZGF0YS5cbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2sobnVsbCwgdHJ1ZSwgcmVzcCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmIChjYWxsYmFjaykge1xuICAgICAgICAgICAgICAgIGlmIChuYW1lKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIG51bGwsIHJlc3ApO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFRoZXJlIHdhcyBhIGJ1ZyB3aGVyZSBjb2xsZWN0aW9uIG5hbWUgZG9lc24ndCBleGlzdC4gSWYgdGhpcyBvY2N1cnMsIHRoZW4gd2lsbCBuZXZlciBnZXQgaG9sZCBvZiBhbnkgZGVzY3JpcHRvcnMuXG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdVbm5hbWVkIGNvbGxlY3Rpb24nKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjYWxsYmFjayhudWxsLCBudWxsLCByZXNwKTtcbiAgICAgICAgfVxuXG4gICAgfTtcbiAgICBvcHRzLmVycm9yID0gZnVuY3Rpb24oanFYSFIsIHRleHRTdGF0dXMsIGVycm9yVGhyb3duKSB7XG4gICAgICAgIHZhciByZXNwID0ge1xuICAgICAgICAgICAganFYSFI6IGpxWEhSLFxuICAgICAgICAgICAgdGV4dFN0YXR1czogdGV4dFN0YXR1cyxcbiAgICAgICAgICAgIGVycm9yVGhyb3duOiBlcnJvclRocm93blxuICAgICAgICB9O1xuICAgICAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKHJlc3AsIG51bGwsIHJlc3ApO1xuICAgIH07XG4gICAgaWYgKExvZ2dlci50cmFjZS5pc0VuYWJsZWQpXG4gICAgICAgIExvZ2dlci50cmFjZSgnQWpheCByZXF1ZXN0OicsIG9wdHMpO1xuICAgIHNpZXN0YS5leHQuaHR0cC5hamF4KG9wdHMpO1xufTtcblxuZnVuY3Rpb24gX3NlcmlhbGlzZU9iamVjdChvcHRzLCBvYmosIGNiKSB7XG4gICAgdGhpcy5fc2VyaWFsaXNlKG9iaiwgZnVuY3Rpb24gKGVyciwgZGF0YSkge1xuICAgICAgICB2YXIgcmV0RGF0YSA9IGRhdGE7XG4gICAgICAgIGlmIChvcHRzLmZpZWxkcykge1xuICAgICAgICAgICAgcmV0RGF0YSA9IHt9O1xuICAgICAgICAgICAgXy5lYWNoKG9wdHMuZmllbGRzLCBmdW5jdGlvbiAoZikge1xuICAgICAgICAgICAgICAgIHJldERhdGFbZl0gPSBkYXRhW2ZdO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgY2IoZXJyLCByZXREYXRhKTtcbiAgICB9KTtcbn1cblxuLyoqXG4gKiBTZW5kIGEgSFRUUCByZXF1ZXN0IHRvIHRoZSBnaXZlbiBtZXRob2QgYW5kIHBhdGhcbiAqIEBwYXJhbSB7U3RyaW5nfSBtZXRob2RcbiAqIEBwYXJhbSB7U3RyaW5nfSBwYXRoIFRoZSBwYXRoIHRvIHRoZSByZXNvdXJjZSB3ZSB3YW50IHRvIEdFVFxuICogQHBhcmFtIHtTaWVzdGFNb2RlbH0gb2JqZWN0IFRoZSBtb2RlbCB3ZSdyZSBwdXNoaW5nIHRvIHRoZSBzZXJ2ZXJcbiAqIEBwYXJhbSB7T2JqZWN0fEZ1bmN0aW9ufSBvcHRzT3JDYWxsYmFjayBFaXRoZXIgYW4gb3B0aW9ucyBvYmplY3Qgb3IgYSBjYWxsYmFjayBpZiBjYW4gdXNlIGRlZmF1bHRzXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBDYWxsYmFjayBpZiBvcHRzIHNwZWNpZmllZC5cbiAqL1xuZnVuY3Rpb24gX2h0dHBSZXF1ZXN0KG1ldGhvZCwgcGF0aCwgb2JqZWN0KSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAzKTtcbiAgICB2YXIgY2FsbGJhY2s7XG4gICAgdmFyIG9wdHMgPSB7fTtcbiAgICBpZiAodHlwZW9mKGFyZ3NbMF0pID09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgY2FsbGJhY2sgPSBhcmdzWzBdO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mKGFyZ3NbMF0pID09ICdvYmplY3QnKSB7XG4gICAgICAgIG9wdHMgPSBhcmdzWzBdO1xuICAgICAgICBjYWxsYmFjayA9IGFyZ3NbMV07XG4gICAgfVxuICAgIHZhciBkZWZlcnJlZCA9IHdpbmRvdy5xID8gd2luZG93LnEuZGVmZXIoKSA6IG51bGw7XG4gICAgY2FsbGJhY2sgPSB1dGlsLmNvbnN0cnVjdENhbGxiYWNrQW5kUHJvbWlzZUhhbmRsZXIoY2FsbGJhY2ssIGRlZmVycmVkKTtcbiAgICBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJncywgMik7XG4gICAgdmFyIHJlcXVlc3REZXNjcmlwdG9ycyA9IERlc2NyaXB0b3JSZWdpc3RyeS5yZXF1ZXN0RGVzY3JpcHRvcnNGb3JDb2xsZWN0aW9uKHRoaXMpO1xuICAgIHZhciBtYXRjaGVkRGVzY3JpcHRvcjtcbiAgICBvcHRzLnR5cGUgPSBtZXRob2Q7XG4gICAgdmFyIGJhc2VVUkwgPSB0aGlzLmJhc2VVUkw7XG4gICAgb3B0cy51cmwgPSBiYXNlVVJMICsgcGF0aDtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHJlcXVlc3REZXNjcmlwdG9ycy5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgcmVxdWVzdERlc2NyaXB0b3IgPSByZXF1ZXN0RGVzY3JpcHRvcnNbaV07XG4gICAgICAgIGlmIChyZXF1ZXN0RGVzY3JpcHRvci5fbWF0Y2hDb25maWcob3B0cykpIHtcbiAgICAgICAgICAgIG1hdGNoZWREZXNjcmlwdG9yID0gcmVxdWVzdERlc2NyaXB0b3I7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgIH1cbiAgICBpZiAobWF0Y2hlZERlc2NyaXB0b3IpIHtcbiAgICAgICAgaWYgKExvZ2dlci50cmFjZS5pc0VuYWJsZWQpXG4gICAgICAgICAgICBMb2dnZXIudHJhY2UoJ01hdGNoZWQgZGVzY3JpcHRvcjogJyArIG1hdGNoZWREZXNjcmlwdG9yLl9kdW1wKHRydWUpKTtcbiAgICAgICAgX3NlcmlhbGlzZU9iamVjdC5jYWxsKG1hdGNoZWREZXNjcmlwdG9yLCBvYmplY3QsIG9wdHMsIGZ1bmN0aW9uIChlcnIsIGRhdGEpIHtcbiAgICAgICAgICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKVxuICAgICAgICAgICAgICAgIExvZ2dlci50cmFjZSgnX3NlcmlhbGlzZScsIHtcbiAgICAgICAgICAgICAgICAgICAgZXJyOiBlcnIsXG4gICAgICAgICAgICAgICAgICAgIGRhdGE6IGRhdGFcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKGVyciwgbnVsbCwgbnVsbCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIG9wdHMuZGF0YSA9IGRhdGE7XG4gICAgICAgICAgICAgICAgb3B0cy5vYmogPSBvYmplY3Q7XG4gICAgICAgICAgICAgICAgXy5wYXJ0aWFsKF9odHRwUmVzcG9uc2UsIG1ldGhvZCwgcGF0aCwgb3B0cywgY2FsbGJhY2spLmFwcGx5KHNlbGYsIGFyZ3MpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICBcbiAgICB9IGVsc2UgaWYgKGNhbGxiYWNrKSB7XG4gICAgICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKVxuICAgICAgICAgICAgTG9nZ2VyLnRyYWNlKCdEaWQgbm90IG1hdGNoIGRlc2NyaXB0b3InKTtcbiAgICAgICAgY2FsbGJhY2sobnVsbCwgbnVsbCwgbnVsbCk7XG4gICAgfVxuICAgIHJldHVybiBkZWZlcnJlZCA/IGRlZmVycmVkLnByb21pc2UgOiBudWxsO1xufTtcblxuLyoqXG4gKiBTZW5kIGEgREVMRVRFIHJlcXVlc3QuIEFsc28gcmVtb3ZlcyB0aGUgb2JqZWN0LlxuICogQHBhcmFtIHtDb2xsZWN0aW9ufSBjb2xsZWN0aW9uXG4gKiBAcGFyYW0ge1N0aXJuZ30gcGF0aCBUaGUgcGF0aCB0byB0aGUgcmVzb3VyY2UgdG8gd2hpY2ggd2Ugd2FudCB0byBERUxFVEVcbiAqIEBwYXJhbSB7U2llc3RhTW9kZWx9IG1vZGVsIFRoZSBtb2RlbCB0aGF0IHdlIHdvdWxkIGxpa2UgdG8gUEFUQ0hcbiAqIEBwYXJhbSB7T2JqZWN0fEZ1bmN0aW9ufSBvcHRzT3JDYWxsYmFjayBFaXRoZXIgYW4gb3B0aW9ucyBvYmplY3Qgb3IgYSBjYWxsYmFjayBpZiBjYW4gdXNlIGRlZmF1bHRzXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBDYWxsYmFjayBpZiBvcHRzIHNwZWNpZmllZC5cbiAqIEByZXR1cm5zIHtQcm9taXNlfVxuICovXG5mdW5jdGlvbiBERUxFVEUoY29sbGVjdGlvbiwgcGF0aCwgb2JqZWN0KSB7XG4gICAgdmFyIGRlZmVycmVkID0gd2luZG93LnEgPyB3aW5kb3cucS5kZWZlcigpIDogbnVsbDtcbiAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMyk7XG4gICAgdmFyIG9wdHMgPSB7fTtcbiAgICB2YXIgY2FsbGJhY2s7XG4gICAgaWYgKHR5cGVvZihhcmdzWzBdKSA9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIGNhbGxiYWNrID0gYXJnc1swXTtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZihhcmdzWzBdKSA9PSAnb2JqZWN0Jykge1xuICAgICAgICBvcHRzID0gYXJnc1swXTtcbiAgICAgICAgY2FsbGJhY2sgPSBhcmdzWzFdO1xuICAgIH1cbiAgICBjYWxsYmFjayA9IHV0aWwuY29uc3RydWN0Q2FsbGJhY2tBbmRQcm9taXNlSGFuZGxlcihjYWxsYmFjaywgZGVmZXJyZWQpO1xuICAgIHZhciBkZWxldGlvbk1vZGUgPSBvcHRzLmRlbGV0aW9uTW9kZSB8fCAncmVzdG9yZSc7XG4gICAgLy8gQnkgZGVmYXVsdCB3ZSBkbyBub3QgbWFwIHRoZSByZXNwb25zZSBmcm9tIGEgREVMRVRFIHJlcXVlc3QuXG4gICAgaWYgKG9wdHMucGFyc2VSZXNwb25zZSA9PT0gdW5kZWZpbmVkKSBvcHRzLnBhcnNlUmVzcG9uc2UgPSBmYWxzZTtcbiAgICBfaHR0cFJlc3BvbnNlLmNhbGwoY29sbGVjdGlvbiwgJ0RFTEVURScsIHBhdGgsIG9wdHMsIGZ1bmN0aW9uKGVyciwgeCwgeSwgeikge1xuICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICBpZiAoZGVsZXRpb25Nb2RlID09ICdyZXN0b3JlJykge1xuICAgICAgICAgICAgICAgIG9iamVjdC5yZXN0b3JlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAoZGVsZXRpb25Nb2RlID09ICdzdWNjZXNzJykge1xuICAgICAgICAgICAgb2JqZWN0LnJlbW92ZSgpO1xuICAgICAgICB9XG4gICAgICAgIGNhbGxiYWNrKGVyciwgeCwgeSwgeik7XG4gICAgfSk7XG4gICAgaWYgKGRlbGV0aW9uTW9kZSA9PSAnbm93JyB8fCBkZWxldGlvbk1vZGUgPT0gJ3Jlc3RvcmUnKSB7XG4gICAgICAgIG9iamVjdC5yZW1vdmUoKTtcbiAgICB9XG4gICAgcmV0dXJuIGRlZmVycmVkID8gZGVmZXJyZWQucHJvbWlzZSA6IG51bGw7XG59XG5cbi8qKlxuICogU2VuZCBhIEhUVFAgcmVxdWVzdCB1c2luZyB0aGUgZ2l2ZW4gbWV0aG9kXG4gKiBAcGFyYW0ge0NvbGxlY3Rpb259IGNvbGxlY3Rpb25cbiAqIEBwYXJhbSByZXF1ZXN0IERvZXMgdGhlIHJlcXVlc3QgY29udGFpbiBkYXRhPyBlLmcuIFBPU1QvUEFUQ0gvUFVUIHdpbGwgYmUgdHJ1ZSwgR0VUIHdpbGwgZmFsc2VcbiAqIEBwYXJhbSBtZXRob2RcbiAqIEBpbnRlcm5hbFxuICogQHJldHVybnMge1Byb21pc2V9XG4gKi9cbmZ1bmN0aW9uIEhUVFBfTUVUSE9EKGNvbGxlY3Rpb24sIHJlcXVlc3QsIG1ldGhvZCkge1xuICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAzKTtcbiAgICByZXR1cm4gXy5wYXJ0aWFsKHJlcXVlc3QgPyBfaHR0cFJlcXVlc3QgOiBfaHR0cFJlc3BvbnNlLCBtZXRob2QpLmFwcGx5KGNvbGxlY3Rpb24sIGFyZ3MpO1xufVxuXG4vKipcbiAqIFNlbmQgYSBHRVQgcmVxdWVzdFxuICogQHBhcmFtIHtDb2xsZWN0aW9ufSBjb2xsZWN0aW9uXG4gKiBAcGFyYW0ge1N0cmluZ30gcGF0aCBUaGUgcGF0aCB0byB0aGUgcmVzb3VyY2Ugd2Ugd2FudCB0byBHRVRcbiAqIEBwYXJhbSB7T2JqZWN0fEZ1bmN0aW9ufSBvcHRzT3JDYWxsYmFjayBFaXRoZXIgYW4gb3B0aW9ucyBvYmplY3Qgb3IgYSBjYWxsYmFjayBpZiBjYW4gdXNlIGRlZmF1bHRzXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBDYWxsYmFjayBpZiBvcHRzIHNwZWNpZmllZC5cbiAqIEBwYWNrYWdlIEhUVFBcbiAqIEByZXR1cm5zIHtQcm9taXNlfVxuICovXG5mdW5jdGlvbiBHRVQoY29sbGVjdGlvbikge1xuICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICByZXR1cm4gXy5wYXJ0aWFsKEhUVFBfTUVUSE9ELCBjb2xsZWN0aW9uLCBmYWxzZSwgJ0dFVCcpLmFwcGx5KHRoaXMsIGFyZ3MpO1xufVxuXG4vKipcbiAqIFNlbmQgYW4gT1BUSU9OUyByZXF1ZXN0XG4gKiBAcGFyYW0ge0NvbGxlY3Rpb259IGNvbGxlY3Rpb25cbiAqIEBwYXJhbSB7U3RyaW5nfSBwYXRoIFRoZSBwYXRoIHRvIHRoZSByZXNvdXJjZSB3ZSB3YW50IHRvIEdFVFxuICogQHBhcmFtIHtPYmplY3R8RnVuY3Rpb259IG9wdHNPckNhbGxiYWNrIEVpdGhlciBhbiBvcHRpb25zIG9iamVjdCBvciBhIGNhbGxiYWNrIGlmIGNhbiB1c2UgZGVmYXVsdHNcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIENhbGxiYWNrIGlmIG9wdHMgc3BlY2lmaWVkLlxuICogQHBhY2thZ2UgSFRUUFxuICogQHJldHVybnMge1Byb21pc2V9XG4gKi9cbmZ1bmN0aW9uIE9QVElPTlMoY29sbGVjdGlvbikge1xuICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICByZXR1cm4gXy5wYXJ0aWFsKEhUVFBfTUVUSE9ELCBjb2xsZWN0aW9uLCBmYWxzZSwgJ09QVElPTlMnKS5hcHBseSh0aGlzLCBhcmdzKTtcbn1cblxuLyoqXG4gKiBTZW5kIGFuIFRSQUNFIHJlcXVlc3RcbiAqIEBwYXJhbSB7Q29sbGVjdGlvbn0gY29sbGVjdGlvblxuICogQHBhcmFtIHtTdHJpbmd9IHBhdGggVGhlIHBhdGggdG8gdGhlIHJlc291cmNlIHdlIHdhbnQgdG8gR0VUXG4gKiBAcGFyYW0ge09iamVjdHxGdW5jdGlvbn0gb3B0c09yQ2FsbGJhY2sgRWl0aGVyIGFuIG9wdGlvbnMgb2JqZWN0IG9yIGEgY2FsbGJhY2sgaWYgY2FuIHVzZSBkZWZhdWx0c1xuICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgQ2FsbGJhY2sgaWYgb3B0cyBzcGVjaWZpZWQuXG4gKiBAcGFja2FnZSBIVFRQXG4gKiBAcmV0dXJucyB7UHJvbWlzZX1cbiAqL1xuZnVuY3Rpb24gVFJBQ0UoY29sbGVjdGlvbikge1xuICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICByZXR1cm4gXy5wYXJ0aWFsKEhUVFBfTUVUSE9ELCBjb2xsZWN0aW9uLCBmYWxzZSwgJ1RSQUNFJykuYXBwbHkodGhpcywgYXJncyk7XG59XG5cbi8qKlxuICogU2VuZCBhbiBIRUFEIHJlcXVlc3RcbiAqIEBwYXJhbSB7Q29sbGVjdGlvbn0gY29sbGVjdGlvblxuICogQHBhcmFtIHtTdHJpbmd9IHBhdGggVGhlIHBhdGggdG8gdGhlIHJlc291cmNlIHdlIHdhbnQgdG8gR0VUXG4gKiBAcGFyYW0ge09iamVjdHxGdW5jdGlvbn0gb3B0c09yQ2FsbGJhY2sgRWl0aGVyIGFuIG9wdGlvbnMgb2JqZWN0IG9yIGEgY2FsbGJhY2sgaWYgY2FuIHVzZSBkZWZhdWx0c1xuICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgQ2FsbGJhY2sgaWYgb3B0cyBzcGVjaWZpZWQuXG4gKiBAcGFja2FnZSBIVFRQXG4gKiBAcmV0dXJucyB7UHJvbWlzZX1cbiAqL1xuZnVuY3Rpb24gSEVBRChjb2xsZWN0aW9uKSB7XG4gICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgIHJldHVybiBfLnBhcnRpYWwoSFRUUF9NRVRIT0QsIGNvbGxlY3Rpb24sIGZhbHNlLCAnSEVBRCcpLmFwcGx5KHRoaXMsIGFyZ3MpO1xufVxuXG4vKipcbiAqIFNlbmQgYW4gUE9TVCByZXF1ZXN0XG4gKiBAcGFyYW0ge0NvbGxlY3Rpb259IGNvbGxlY3Rpb25cbiAqIEBwYXJhbSB7U3RyaW5nfSBwYXRoIFRoZSBwYXRoIHRvIHRoZSByZXNvdXJjZSB3ZSB3YW50IHRvIEdFVFxuICogQHBhcmFtIHtTaWVzdGFNb2RlbH0gbW9kZWwgVGhlIG1vZGVsIHRoYXQgd2Ugd291bGQgbGlrZSB0byBQT1NUXG4gKiBAcGFyYW0ge09iamVjdHxGdW5jdGlvbn0gb3B0c09yQ2FsbGJhY2sgRWl0aGVyIGFuIG9wdGlvbnMgb2JqZWN0IG9yIGEgY2FsbGJhY2sgaWYgY2FuIHVzZSBkZWZhdWx0c1xuICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgQ2FsbGJhY2sgaWYgb3B0cyBzcGVjaWZpZWQuXG4gKiBAcGFja2FnZSBIVFRQXG4gKiBAcmV0dXJucyB7UHJvbWlzZX1cbiAqL1xuZnVuY3Rpb24gUE9TVChjb2xsZWN0aW9uKSB7XG4gICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgIHJldHVybiBfLnBhcnRpYWwoSFRUUF9NRVRIT0QsIGNvbGxlY3Rpb24sIHRydWUsICdQT1NUJykuYXBwbHkodGhpcywgYXJncyk7XG59XG5cbi8qKlxuICogU2VuZCBhbiBQVVQgcmVxdWVzdFxuICogQHBhcmFtIHtDb2xsZWN0aW9ufSBjb2xsZWN0aW9uXG4gKiBAcGFyYW0ge1N0cmluZ30gcGF0aCBUaGUgcGF0aCB0byB0aGUgcmVzb3VyY2Ugd2Ugd2FudCB0byBHRVRcbiAqIEBwYXJhbSB7U2llc3RhTW9kZWx9IG1vZGVsIFRoZSBtb2RlbCB0aGF0IHdlIHdvdWxkIGxpa2UgdG8gUE9TVFxuICogQHBhcmFtIHtPYmplY3R8RnVuY3Rpb259IG9wdHNPckNhbGxiYWNrIEVpdGhlciBhbiBvcHRpb25zIG9iamVjdCBvciBhIGNhbGxiYWNrIGlmIGNhbiB1c2UgZGVmYXVsdHNcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIENhbGxiYWNrIGlmIG9wdHMgc3BlY2lmaWVkLlxuICogQHBhY2thZ2UgSFRUUFxuICogQHJldHVybnMge1Byb21pc2V9XG4gKi9cbmZ1bmN0aW9uIFBVVChjb2xsZWN0aW9uKSB7XG4gICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgIHJldHVybiBfLnBhcnRpYWwoSFRUUF9NRVRIT0QsIGNvbGxlY3Rpb24sIHRydWUsICdQVVQnKS5hcHBseSh0aGlzLCBhcmdzKTtcbn1cblxuLyoqXG4gKiBTZW5kIGFuIFBBVENIIHJlcXVlc3RcbiAqIEBwYXJhbSB7Q29sbGVjdGlvbn0gY29sbGVjdGlvblxuICogQHBhcmFtIHtTdHJpbmd9IHBhdGggVGhlIHBhdGggdG8gdGhlIHJlc291cmNlIHdlIHdhbnQgdG8gR0VUXG4gKiBAcGFyYW0ge1NpZXN0YU1vZGVsfSBtb2RlbCBUaGUgbW9kZWwgdGhhdCB3ZSB3b3VsZCBsaWtlIHRvIFBPU1RcbiAqIEBwYXJhbSB7T2JqZWN0fEZ1bmN0aW9ufSBvcHRzT3JDYWxsYmFjayBFaXRoZXIgYW4gb3B0aW9ucyBvYmplY3Qgb3IgYSBjYWxsYmFjayBpZiBjYW4gdXNlIGRlZmF1bHRzXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBDYWxsYmFjayBpZiBvcHRzIHNwZWNpZmllZC5cbiAqIEBwYWNrYWdlIEhUVFBcbiAqIEByZXR1cm5zIHtQcm9taXNlfVxuICovXG5mdW5jdGlvbiBQQVRDSChjb2xsZWN0aW9uKSB7XG4gICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgIHJldHVybiBfLnBhcnRpYWwoSFRUUF9NRVRIT0QsIGNvbGxlY3Rpb24sIHRydWUsICdQQVRDSCcpLmFwcGx5KHRoaXMsIGFyZ3MpO1xufVxuXG5cbmlmICghc2llc3RhLmV4dCkge1xuICAgIHNpZXN0YS5leHQgPSB7fTtcbn1cblxuXG52YXIgYWpheDtcblxuXG5zaWVzdGEuZXh0Lmh0dHAgPSB7XG4gICAgUmVxdWVzdERlc2NyaXB0b3I6IHJlcXVpcmUoJy4vcmVxdWVzdERlc2NyaXB0b3InKS5SZXF1ZXN0RGVzY3JpcHRvcixcbiAgICBSZXNwb25zZURlc2NyaXB0b3I6IHJlcXVpcmUoJy4vcmVzcG9uc2VEZXNjcmlwdG9yJykuUmVzcG9uc2VEZXNjcmlwdG9yLFxuICAgIERlc2NyaXB0b3I6IGRlc2NyaXB0b3IuRGVzY3JpcHRvcixcbiAgICBfcmVzb2x2ZU1ldGhvZDogZGVzY3JpcHRvci5yZXNvbHZlTWV0aG9kLFxuICAgIFNlcmlhbGlzZXI6IHJlcXVpcmUoJy4vc2VyaWFsaXNlcicpLFxuICAgIERlc2NyaXB0b3JSZWdpc3RyeTogcmVxdWlyZSgnLi9kZXNjcmlwdG9yUmVnaXN0cnknKS5EZXNjcmlwdG9yUmVnaXN0cnksXG4gICAgc2V0QWpheDogZnVuY3Rpb24oX2FqYXgpIHtcbiAgICAgICAgYWpheCA9IF9hamF4O1xuICAgIH0sXG4gICAgX2h0dHBSZXNwb25zZTogX2h0dHBSZXNwb25zZSxcbiAgICBfaHR0cFJlcXVlc3Q6IF9odHRwUmVxdWVzdCxcbiAgICBERUxFVEU6IERFTEVURSxcbiAgICBIVFRQX01FVEhPRDogSFRUUF9NRVRIT0QsXG4gICAgR0VUOiBHRVQsXG4gICAgVFJBQ0U6IFRSQUNFLFxuICAgIE9QVElPTlM6IE9QVElPTlMsXG4gICAgSEVBRDogSEVBRCxcbiAgICBQT1NUOiBQT1NULFxuICAgIFBVVDogUFVULFxuICAgIFBBVENIOiBQQVRDSCxcbiAgICBfc2VyaWFsaXNlT2JqZWN0OiBfc2VyaWFsaXNlT2JqZWN0XG59O1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoc2llc3RhLmV4dC5odHRwLCAnYWpheCcsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgYSA9IGFqYXggfHwgKCQgPyAkLmFqYXggOiBudWxsKSB8fCAoalF1ZXJ5ID8galF1ZXJ5LmFqYXggOiBudWxsKTtcbiAgICAgICAgaWYgKCFhKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignYWpheCBoYXMgbm90IGJlZW4gZGVmaW5lZCBhbmQgY291bGQgbm90IGZpbmQgJC5hamF4IG9yIGpRdWVyeS5hamF4Jyk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGE7XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uKHYpIHtcbiAgICAgICAgYWpheCA9IHY7XG4gICAgfVxufSk7IiwiLyoqXG4gKiBAbW9kdWxlIGh0dHBcbiAqL1xuXG52YXIgRGVzY3JpcHRvciA9IHJlcXVpcmUoJy4vZGVzY3JpcHRvcicpLkRlc2NyaXB0b3JcbiAgICAsIFNlcmlhbGlzZXIgPSByZXF1aXJlKCcuL3NlcmlhbGlzZXInKTtcblxudmFyIF9pID0gc2llc3RhLl9pbnRlcm5hbFxuICAgICwgdXRpbCA9IF9pLnV0aWxcbiAgICAsIF8gPSB1dGlsLl9cbiAgICAsIGxvZyA9IF9pLmxvZ1xuICAgICwgZGVmaW5lU3ViUHJvcGVydHkgPSBfaS5taXNjLmRlZmluZVN1YlByb3BlcnR5XG47XG5cbnZhciBMb2dnZXIgPSBsb2cubG9nZ2VyV2l0aE5hbWUoJ1JlcXVlc3REZXNjcmlwdG9yJyk7XG5Mb2dnZXIuc2V0TGV2ZWwobG9nLkxldmVsLndhcm4pO1xuXG4vKipcbiAqIEBjbGFzcyBEZXNjcmliZXMgYSBIVFRQIHJlcXVlc3RcbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRzXG4gKi9cbmZ1bmN0aW9uIFJlcXVlc3REZXNjcmlwdG9yKG9wdHMpIHtcbiAgICBpZiAoIXRoaXMpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBSZXF1ZXN0RGVzY3JpcHRvcihvcHRzKTtcbiAgICB9XG5cbiAgICBEZXNjcmlwdG9yLmNhbGwodGhpcywgb3B0cyk7XG4gICAgaWYgKHRoaXMuX29wdHNbJ3NlcmlhbGl6ZXInXSkge1xuICAgICAgICB0aGlzLl9vcHRzLnNlcmlhbGlzZXIgPSB0aGlzLl9vcHRzWydzZXJpYWxpemVyJ107XG4gICAgfVxuXG4gICAgaWYgKCF0aGlzLl9vcHRzLnNlcmlhbGlzZXIpIHtcbiAgICAgICAgdGhpcy5fb3B0cy5zZXJpYWxpc2VyID0gU2VyaWFsaXNlci5kZXB0aFNlcmlhbGl6ZXIoMCk7XG4gICAgfVxuXG5cbiAgICBkZWZpbmVTdWJQcm9wZXJ0eS5jYWxsKHRoaXMsICdzZXJpYWxpc2VyJywgdGhpcy5fb3B0cyk7XG4gICAgZGVmaW5lU3ViUHJvcGVydHkuY2FsbCh0aGlzLCAnc2VyaWFsaXplcicsIHRoaXMuX29wdHMsICdzZXJpYWxpc2VyJyk7XG5cbn1cblxuUmVxdWVzdERlc2NyaXB0b3IucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShEZXNjcmlwdG9yLnByb3RvdHlwZSk7XG5cbl8uZXh0ZW5kKFJlcXVlc3REZXNjcmlwdG9yLnByb3RvdHlwZSwge1xuICAgIF9zZXJpYWxpc2U6IGZ1bmN0aW9uIChvYmosIGNhbGxiYWNrKSB7XG4gICAgICAgIHZhciBkZWZlcnJlZCA9IHdpbmRvdy5xID8gd2luZG93LnEuZGVmZXIoKSA6IG51bGw7XG4gICAgICAgIGNhbGxiYWNrID0gdXRpbC5jb25zdHJ1Y3RDYWxsYmFja0FuZFByb21pc2VIYW5kbGVyKGNhbGxiYWNrLCBkZWZlcnJlZCk7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgaWYgKExvZ2dlci50cmFjZS5pc0VuYWJsZWQpXG4gICAgICAgICAgICBMb2dnZXIudHJhY2UoJ19zZXJpYWxpc2UnKTtcbiAgICAgICAgdmFyIGZpbmlzaGVkO1xuICAgICAgICB2YXIgZGF0YSA9IHRoaXMuc2VyaWFsaXNlcihvYmosIGZ1bmN0aW9uIChlcnIsIGRhdGEpIHtcbiAgICAgICAgICAgIGlmICghZmluaXNoZWQpIHtcbiAgICAgICAgICAgICAgICBkYXRhID0gc2VsZi5fdHJhbnNmb3JtRGF0YShkYXRhKTtcbiAgICAgICAgICAgICAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKGVyciwgc2VsZi5fZW1iZWREYXRhKGRhdGEpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIGlmIChkYXRhICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKVxuICAgICAgICAgICAgICAgIExvZ2dlci50cmFjZSgnc2VyaWFsaXNlciBkb2VzbnQgdXNlIGEgY2FsbGJhY2snKTtcbiAgICAgICAgICAgIGZpbmlzaGVkID0gdHJ1ZTtcbiAgICAgICAgICAgIGRhdGEgPSBzZWxmLl90cmFuc2Zvcm1EYXRhKGRhdGEpO1xuICAgICAgICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhudWxsLCBzZWxmLl9lbWJlZERhdGEoZGF0YSkpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgaWYgKExvZ2dlci50cmFjZS5pc0VuYWJsZWQpXG4gICAgICAgICAgICAgICAgTG9nZ2VyLnRyYWNlKCdzZXJpYWxpc2VyIHVzZXMgYSBjYWxsYmFjaycsIHRoaXMuc2VyaWFsaXNlcik7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGRlZmVycmVkID8gZGVmZXJyZWQucHJvbWlzZSA6IG51bGw7XG4gICAgfSxcbiAgICBfZHVtcDogZnVuY3Rpb24gKGFzSnNvbikge1xuICAgICAgICB2YXIgb2JqID0ge307XG4gICAgICAgIG9iai5tZXRob2RzID0gdGhpcy5tZXRob2Q7XG4gICAgICAgIG9iai5tYXBwaW5nID0gdGhpcy5tYXBwaW5nLnR5cGU7XG4gICAgICAgIG9iai5wYXRoID0gdGhpcy5fcmF3T3B0cy5wYXRoO1xuICAgICAgICB2YXIgc2VyaWFsaXNlcjtcbiAgICAgICAgaWYgKHR5cGVvZih0aGlzLl9yYXdPcHRzLnNlcmlhbGlzZXIpID09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIHNlcmlhbGlzZXIgPSAnZnVuY3Rpb24gKCkgeyAuLi4gfSdcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHNlcmlhbGlzZXIgPSB0aGlzLl9yYXdPcHRzLnNlcmlhbGlzZXI7XG4gICAgICAgIH1cbiAgICAgICAgb2JqLnNlcmlhbGlzZXIgPSBzZXJpYWxpc2VyO1xuICAgICAgICB2YXIgdHJhbnNmb3JtcyA9IHt9O1xuICAgICAgICBmb3IgKHZhciBmIGluIHRoaXMudHJhbnNmb3Jtcykge1xuICAgICAgICAgICAgaWYgKHRoaXMudHJhbnNmb3Jtcy5oYXNPd25Qcm9wZXJ0eShmKSkge1xuICAgICAgICAgICAgICAgIHZhciB0cmFuc2Zvcm0gPSB0aGlzLnRyYW5zZm9ybXNbZl07XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZih0cmFuc2Zvcm0pID09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgICAgICAgICAgdHJhbnNmb3Jtc1tmXSA9ICdmdW5jdGlvbiAoKSB7IC4uLiB9J1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdHJhbnNmb3Jtc1tmXSA9IHRoaXMudHJhbnNmb3Jtc1tmXTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgb2JqLnRyYW5zZm9ybXMgPSB0cmFuc2Zvcm1zO1xuICAgICAgICByZXR1cm4gYXNKc29uID8gSlNPTi5zdHJpbmdpZnkob2JqLCBudWxsLCA0KSA6IG9iajtcbiAgICB9XG59KTtcblxuZXhwb3J0cy5SZXF1ZXN0RGVzY3JpcHRvciA9IFJlcXVlc3REZXNjcmlwdG9yO1xuIiwiLyoqXG4gKiBAbW9kdWxlIGh0dHBcbiAqL1xuXG5cbnZhciBEZXNjcmlwdG9yID0gcmVxdWlyZSgnLi9kZXNjcmlwdG9yJykuRGVzY3JpcHRvcjtcblxuLyoqXG4gKiBEZXNjcmliZXMgd2hhdCB0byBkbyB3aXRoIGEgSFRUUCByZXNwb25zZS5cbiAqIEBjb25zdHJ1Y3RvclxuICogQGltcGxlbWVudHMge0Rlc2NyaXB0b3J9XG4gKiBAcGFyYW0ge09iamVjdH0gb3B0c1xuICovXG5mdW5jdGlvbiBSZXNwb25zZURlc2NyaXB0b3Iob3B0cykge1xuICAgIGlmICghdGhpcykge1xuICAgICAgICByZXR1cm4gbmV3IFJlc3BvbnNlRGVzY3JpcHRvcihvcHRzKTtcbiAgICB9XG4gICAgRGVzY3JpcHRvci5jYWxsKHRoaXMsIG9wdHMpO1xufVxuXG5SZXNwb25zZURlc2NyaXB0b3IucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShEZXNjcmlwdG9yLnByb3RvdHlwZSk7XG5cbl8uZXh0ZW5kKFJlc3BvbnNlRGVzY3JpcHRvci5wcm90b3R5cGUsIHtcbiAgICBfZXh0cmFjdERhdGE6IGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgICAgIHZhciBleHRyYWN0ZWREYXRhID0gRGVzY3JpcHRvci5wcm90b3R5cGUuX2V4dHJhY3REYXRhLmNhbGwodGhpcywgZGF0YSk7XG4gICAgICAgIGlmIChleHRyYWN0ZWREYXRhKSB7XG4gICAgICAgICAgICBleHRyYWN0ZWREYXRhID0gdGhpcy5fdHJhbnNmb3JtRGF0YShleHRyYWN0ZWREYXRhKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZXh0cmFjdGVkRGF0YTtcbiAgICB9LFxuICAgIF9tYXRjaERhdGE6IGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgICAgIHZhciBleHRyYWN0ZWREYXRhID0gRGVzY3JpcHRvci5wcm90b3R5cGUuX21hdGNoRGF0YS5jYWxsKHRoaXMsIGRhdGEpO1xuICAgICAgICBpZiAoZXh0cmFjdGVkRGF0YSkge1xuICAgICAgICAgICAgZXh0cmFjdGVkRGF0YSA9IHRoaXMuX3RyYW5zZm9ybURhdGEoZXh0cmFjdGVkRGF0YSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGV4dHJhY3RlZERhdGE7XG4gICAgfSxcbiAgICBfZHVtcDogZnVuY3Rpb24gKGFzSnNvbikge1xuICAgICAgICB2YXIgb2JqID0ge307XG4gICAgICAgIG9iai5tZXRob2RzID0gdGhpcy5tZXRob2Q7XG4gICAgICAgIG9iai5tYXBwaW5nID0gdGhpcy5tYXBwaW5nLnR5cGU7XG4gICAgICAgIG9iai5wYXRoID0gdGhpcy5fcmF3T3B0cy5wYXRoO1xuICAgICAgICB2YXIgdHJhbnNmb3JtcyA9IHt9O1xuICAgICAgICBmb3IgKHZhciBmIGluIHRoaXMudHJhbnNmb3Jtcykge1xuICAgICAgICAgICAgaWYgKHRoaXMudHJhbnNmb3Jtcy5oYXNPd25Qcm9wZXJ0eShmKSkge1xuICAgICAgICAgICAgICAgIHZhciB0cmFuc2Zvcm0gPSB0aGlzLnRyYW5zZm9ybXNbZl07XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZih0cmFuc2Zvcm0pID09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgICAgICAgICAgdHJhbnNmb3Jtc1tmXSA9ICdmdW5jdGlvbiAoKSB7IC4uLiB9J1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdHJhbnNmb3Jtc1tmXSA9IHRoaXMudHJhbnNmb3Jtc1tmXTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgb2JqLnRyYW5zZm9ybXMgPSB0cmFuc2Zvcm1zO1xuICAgICAgICByZXR1cm4gYXNKc29uID8gSlNPTi5zdHJpbmdpZnkob2JqLCBudWxsLCA0KSA6IG9iajtcbiAgICB9XG59KTtcblxuZXhwb3J0cy5SZXNwb25zZURlc2NyaXB0b3IgPSBSZXNwb25zZURlc2NyaXB0b3I7IiwiLyoqXG4gKiBAbW9kdWxlIGh0dHBcbiAqL1xuXG52YXIgX2kgPSBzaWVzdGEuX2ludGVybmFsO1xuXG52YXIgbG9nID0gX2kubG9nXG4gICAgLCB1dGlscyA9IF9pLnV0aWw7XG52YXIgTG9nZ2VyID0gbG9nLmxvZ2dlcldpdGhOYW1lKCdTZXJpYWxpc2VyJyk7XG5Mb2dnZXIuc2V0TGV2ZWwobG9nLkxldmVsLndhcm4pO1xudmFyIF8gPSB1dGlscy5fO1xuXG4vKipcbiAqIFNlcmlhbGlzZXMgYW4gb2JqZWN0IGludG8gaXQncyByZW1vdGUgaWRlbnRpZmllciAoYXMgZGVmaW5lZCBieSB0aGUgbWFwcGluZylcbiAqIEBwYXJhbSAge1NpZXN0YU1vZGVsfSBvYmpcbiAqIEByZXR1cm4ge1N0cmluZ31cbiAqIFxuICovXG5mdW5jdGlvbiBpZFNlcmlhbGlzZXIob2JqKSB7XG4gICAgdmFyIGlkRmllbGQgPSBvYmoubWFwcGluZy5pZDtcbiAgICBpZiAoaWRGaWVsZCkge1xuICAgICAgICByZXR1cm4gb2JqW2lkRmllbGRdID8gb2JqW2lkRmllbGRdIDogbnVsbDtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIGlmIChMb2dnZXIuZGVidWcuaXNFbmFibGVkKVxuICAgICAgICAgICAgTG9nZ2VyLmRlYnVnKCdObyBpZGZpZWxkJyk7XG4gICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfVxufVxuXG4vKipcbiAqIFNlcmlhbGlzZXMgb2JqIGZvbGxvd2luZyByZWxhdGlvbnNoaXBzIHRvIHNwZWNpZmllZCBkZXB0aC5cbiAqIEBwYXJhbSAge0ludGVnZXJ9ICAgZGVwdGhcbiAqIEBwYXJhbSAge1NpZXN0YU1vZGVsfSAgIG9ialxuICogQHBhcmFtICB7RnVuY3Rpb259IGRvbmUgXG4gKi9cbmZ1bmN0aW9uIGRlcHRoU2VyaWFsaXNlcihkZXB0aCwgb2JqLCBkb25lKSB7XG4gICAgaWYgKExvZ2dlci50cmFjZS5pc0VuYWJsZWQpXG4gICAgICAgIExvZ2dlci50cmFjZSgnZGVwdGhTZXJpYWxpc2VyJyk7XG4gICAgdmFyIGRhdGEgPSB7fTtcbiAgICBfLmVhY2gob2JqLl9maWVsZHMsIGZ1bmN0aW9uIChmKSB7XG4gICAgICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKVxuICAgICAgICAgICAgTG9nZ2VyLnRyYWNlKCdmaWVsZCcsIGYpO1xuICAgICAgICBpZiAob2JqW2ZdKSB7XG4gICAgICAgICAgICBkYXRhW2ZdID0gb2JqW2ZdO1xuICAgICAgICB9XG4gICAgfSk7XG4gICAgdmFyIHdhaXRpbmcgPSBbXTtcbiAgICB2YXIgZXJyb3JzID0gW107XG4gICAgdmFyIHJlc3VsdCA9IHt9O1xuICAgIHZhciBmaW5pc2hlZCA9IFtdO1xuICAgIF8uZWFjaChvYmouX3JlbGF0aW9uc2hpcEZpZWxkcywgZnVuY3Rpb24gKGYpIHtcbiAgICAgICAgaWYgKExvZ2dlci50cmFjZS5pc0VuYWJsZWQpXG4gICAgICAgICAgICBMb2dnZXIudHJhY2UoJ3JlbGF0aW9uc2hpcEZpZWxkJywgZik7XG4gICAgICAgIHZhciBwcm94eSA9IG9iai5fX3Byb3hpZXNbZl07XG4gICAgICAgIGlmIChwcm94eS5pc0ZvcndhcmQpIHsgLy8gQnkgZGVmYXVsdCBvbmx5IGZvcndhcmQgcmVsYXRpb25zaGlwLlxuICAgICAgICAgICAgaWYgKExvZ2dlci5kZWJ1Zy5pc0VuYWJsZWQpXG4gICAgICAgICAgICAgICAgTG9nZ2VyLmRlYnVnKGYpO1xuICAgICAgICAgICAgd2FpdGluZy5wdXNoKGYpO1xuICAgICAgICAgICAgcHJveHkuZ2V0KGZ1bmN0aW9uIChlcnIsIHYpIHtcbiAgICAgICAgICAgICAgICBpZiAoTG9nZ2VyLnRyYWNlLmlzRW5hYmxlZClcbiAgICAgICAgICAgICAgICAgICAgTG9nZ2VyLnRyYWNlKCdwcm94eS5nZXQnLCBmKTtcbiAgICAgICAgICAgICAgICBpZiAoTG9nZ2VyLmRlYnVnLmlzRW5hYmxlZClcbiAgICAgICAgICAgICAgICAgICAgTG9nZ2VyLmRlYnVnKGYsIHYpO1xuICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgZXJyb3JzLnB1c2goZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgZmluaXNoZWQucHVzaChmKTtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0W2ZdID0ge2VycjogZXJyLCB2OiB2fTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSBpZiAodikge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWRlcHRoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBmaW5pc2hlZC5wdXNoKGYpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZGF0YVtmXSA9IHZbb2JqLl9fcHJveGllc1tmXS5mb3J3YXJkTWFwcGluZy5pZF07XG4gICAgICAgICAgICAgICAgICAgICAgICByZXN1bHRbZl0gPSB7ZXJyOiBlcnIsIHY6IHZ9O1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCh3YWl0aW5nLmxlbmd0aCA9PSBmaW5pc2hlZC5sZW5ndGgpICYmIGRvbmUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkb25lKGVycm9ycy5sZW5ndGggPyBlcnJvcnMgOiBudWxsLCBkYXRhLCByZXN1bHQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgZGVwdGhTZXJpYWxpc2VyKGRlcHRoIC0gMSwgdiwgZnVuY3Rpb24gKGVyciwgc3ViRGF0YSwgcmVzcCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZXJyb3JzLnB1c2goZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdGFbZl0gPSBzdWJEYXRhO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmaW5pc2hlZC5wdXNoKGYpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc3VsdFtmXSA9IHtlcnI6IGVyciwgdjogdiwgcmVzcDogcmVzcH07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCh3YWl0aW5nLmxlbmd0aCA9PSBmaW5pc2hlZC5sZW5ndGgpICYmIGRvbmUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZG9uZShlcnJvcnMubGVuZ3RoID8gZXJyb3JzIDogbnVsbCwgZGF0YSwgcmVzdWx0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKExvZ2dlci5kZWJ1Zy5pc0VuYWJsZWQpXG4gICAgICAgICAgICAgICAgICAgICAgICBMb2dnZXIuZGVidWcoJ25vIHZhbHVlIGZvciAnICsgZik7XG4gICAgICAgICAgICAgICAgICAgIGZpbmlzaGVkLnB1c2goZik7XG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdFtmXSA9IHtlcnI6IGVyciwgdjogdn07XG4gICAgICAgICAgICAgICAgICAgIGlmICgod2FpdGluZy5sZW5ndGggPT0gZmluaXNoZWQubGVuZ3RoKSAmJiBkb25lKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkb25lKGVycm9ycy5sZW5ndGggPyBlcnJvcnMgOiBudWxsLCBkYXRhLCByZXN1bHQpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBpZiAoIXdhaXRpbmcubGVuZ3RoKSB7XG4gICAgICAgIGlmIChkb25lKSBkb25lKG51bGwsIGRhdGEsIHt9KTtcbiAgICB9XG59XG5cblxuZXhwb3J0cy5kZXB0aFNlcmlhbGlzZXIgPSBmdW5jdGlvbiAoZGVwdGgpIHtcbiAgICByZXR1cm4gIF8ucGFydGlhbChkZXB0aFNlcmlhbGlzZXIsIGRlcHRoKTtcbn07XG5leHBvcnRzLmRlcHRoU2VyaWFsaXplciA9IGZ1bmN0aW9uIChkZXB0aCkge1xuICAgIHJldHVybiAgXy5wYXJ0aWFsKGRlcHRoU2VyaWFsaXNlciwgZGVwdGgpO1xufTtcbmV4cG9ydHMuaWRTZXJpYWxpemVyID0gaWRTZXJpYWxpc2VyO1xuZXhwb3J0cy5pZFNlcmlhbGlzZXIgPSBpZFNlcmlhbGlzZXI7XG5cbiJdfQ==
