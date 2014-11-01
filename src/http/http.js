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
    descriptor = require('./descriptor'),
    InternalSiestaError = _i.error.InternalSiestaError,
    q = _i.q;

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
    var deferred = q.defer();
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
    console.log('opts', opts);
    $.ajax(opts);
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
    var deferred = q.defer();
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
    return deferred.promise;
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
    console.log('object', object);
    var deferred = q.defer();
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
    return deferred.promise;
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

if (!siesta.ext) {
    siesta.ext = {};
}



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