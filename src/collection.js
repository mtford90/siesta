var log = require('../vendor/operations.js/src/log');
var Logger = log.loggerWithName('Collection');
Logger.setLevel(log.Level.debug);

var CollectionRegistry = require('./collectionRegistry').CollectionRegistry;
var Operation = require('../vendor/operations.js/src/operation').Operation;
var RestError = require('./error').RestError;
var Mapping = require('./mapping').Mapping;
var extend = require('extend');
var observe = require('../vendor/observe-js/src/observe').Platform;

//var $ = require('../vendor/zepto').$;
var util = require('./util');
var _ = util._;

var q = require('q');

var cache = require('./cache');
/**
 * A collection describes a set of models and optionally a REST API which we would
 * like to model.
 *
 * @param name
 * @constructor
 *
 * @example
 * ```js
 * var GitHub = new Collection('GitHub')
 * // ... configure mappings, descriptors etc ...
 * GitHub.install(function () {
 *     // ... carry on.
 * });
 * ```
 */
function Collection(name) {
    var self = this;
    if (!this) return new Collection(name);
    if (!name) throw RestError('Collection must have a name');
    this._name = name;
    this._docId = 'Collection_' + this._name;
    this._rawMappings = {};
    this._mappings = {};
    /**
     * The URL of the API e.g. http://api.github.com
     * @type {string}
     */
    this.baseURL = '';

    /**
     * Set to true if installation has succeeded. You cannot use the collectio
     * @type {boolean}
     */
    this.installed = false;
    CollectionRegistry.register(this);

    /**
     *
     * @type {string}
     */
    Object.defineProperty(this, 'name', {
        get: function () {
            return self._name;
        }
    });
}

/**
 * Ensure mappings are installed.
 * @param callback
 */
Collection.prototype.install = function (callback) {
    var deferred = q.defer();
    var self = this;
    if (!this.installed) {
        var mappingsToInstall = [];
        for (var name in this._mappings) {
            if (this._mappings.hasOwnProperty(name)) {
                var mapping = this._mappings[name];
                mappingsToInstall.push(mapping);
            }
        }
        if (Logger.info.isEnabled)
            Logger.info('There are ' + mappingsToInstall.length.toString() + ' mappings to install');
        if (mappingsToInstall.length) {
            var operations = _.map(mappingsToInstall, function (m) {
                return new Operation('Install Mapping', _.bind(m.install, m));
            });
            var op = new Operation('Install Mappings', operations);
            op.completion = function () {
                if (op.failed) {
                    Logger.error('Failed to install collection', op.error);
                    self._finaliseInstallation(op.error, callback);
                }
                else {
                    self.installed = true;
                    var errors = [];
                    _.each(mappingsToInstall, function (m) {
                        if (Logger.info.isEnabled)
                            Logger.info('Installing relationships for mapping with name "' + m.type + '"');
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
                    if (!errors.length) {
                        _.each(mappingsToInstall, function (m) {
                            if (Logger.info.isEnabled)
                                Logger.info('Installing reverse relationships for mapping with name "' + m.type + '"');
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
                    }
                    var err;
                    if (errors.length == 1) {
                        err = errors[0];
                    }
                    else if (errors.length) {
                        err = errors;
                    }
                    self._finaliseInstallation(err, callback);
                }
            };
            op.start();
        }
        else {
            self._finaliseInstallation(null, callback);
        }
    }
    else {
        var err = new RestError('Collection "' + this._name + '" has already been installed');
        self._finaliseInstallation(err, callback);
    }
    return deferred.promise;
};
Collection.prototype._finaliseInstallation = function (err, callback) {
    if (!err) {
        this.installed = true;
        var index = require('../index');
        index[this._name] = this;
    }
    if (callback) callback(err);
};
Collection.prototype._mapping = function (name, mapping) {
    if (name) {
        this._rawMappings[name] = mapping;
        var opts = extend(true, {}, mapping);
        opts.type = name;
        opts.collection = this._name;
        var mappingObject = new Mapping(opts);
        this._mappings[name] = mappingObject;
        this[name] = mappingObject;
        return mappingObject;
    }
    else {
        throw new RestError('No name specified when creating mapping');
    }
};
Collection.prototype.mapping = function () {
    var self = this;
    if (arguments.length) {
        if (arguments.length == 1) {
            if (util.isArray(arguments[0])) {
                return _.map(arguments[0], function (m) {
                    return self._mapping(m.name, m);
                });
            }
            else {
                return this._mapping(arguments[0].name, arguments[0]);
            }
        }
        else {
            if (typeof arguments[0] == 'string') {
                return this._mapping(arguments[0], arguments[1]);
            }
            else {
                return _.map(arguments, function (m) {
                    return self._mapping(m.name, m);
                });
            }
        }
    }
    return null;
};

function requestDescriptor(opts) {
    var requestDescriptor = new siesta.ext.http.RequestDescriptor(opts);
    siesta.ext.http.DescriptorRegistry.registerRequestDescriptor(requestDescriptor);
    return requestDescriptor;
}

function responseDescriptor(opts) {
    var responseDescriptor = new siesta.ext.http.ResponseDescriptor(opts);
    siesta.ext.http.DescriptorRegistry.registerResponseDescriptor(responseDescriptor);
    return responseDescriptor;
}

Collection.prototype._descriptor = function (registrationFunc) {
    var args = Array.prototype.slice.call(arguments, 1);
    if (args.length) {
        if (args.length == 1) {
            if (util.isArray(args[0])) {
                return _.map(args[0], function (d) {
                    return registrationFunc(d);
                });
            }
            else {
                return registrationFunc(args[0]);
            }
        }
        else {
            return _.map(args, function (d) {
                return registrationFunc(d);
            });
        }
    }
    return null;
};
Collection.prototype.requestDescriptor = function () {
    return _.partial(this._descriptor, requestDescriptor).apply(this, arguments);
};
Collection.prototype.responseDescriptor = function () {
    return _.partial(this._descriptor, responseDescriptor).apply(this, arguments);
};
Collection.prototype._dump = function (asJson) {
    var obj = {};
    obj.installed = this.installed;
    obj.docId = this._docId;
    obj.name = this._name;
    obj.baseURL = this.baseURL;
    return asJson ? JSON.stringify(obj, null, 4) : obj;
};


/**
 * Persist all changes to PouchDB.
 * Note: Storage extension must be installed.
 * @param callback
 * @returns {Promise}
 */
Collection.prototype.save = function (callback) {
    var deferred = q.defer();
    callback = util.constructCallbackAndPromiseHandler(callback, deferred);
    if (siesta.ext.storageEnabled) {
        util.next(function () {
            var mergeChanges = siesta.ext.storage.changes.mergeChanges;
            mergeChanges(callback);
        });
    }
    else {
        callback('Storage module not installed');
    }
    return deferred.promise;
};


/**
 * Send a HTTP request using the given method
 * @param request Does the request contain data? e.g. POST/PATCH/PUT will be true, GET will false
 * @param method
 * @returns {*}
 */
Collection.prototype.HTTP_METHOD = function (request, method) {
    if (siesta.ext.storageEnabled) {
        return _.partial(request ? this._httpRequest : this._httpResponse, method).apply(this, Array.prototype.slice.call(arguments, 2));
    }
    else {
        throw Error('Storage extension not installed.');
    }
};

/**
 * Send a GET request
 * @returns {*}
 */
Collection.prototype.GET = function () {
    return _.partial(this.HTTP_METHOD, false, 'GET').apply(this, arguments);
};

/**
 * Send a OPTIONS request
 * @returns {*}
 */
Collection.prototype.OPTIONS = function () {
    return _.partial(this.HTTP_METHOD, false, 'OPTIONS').apply(this, arguments);
};

/**
 * Send a TRACE request
 * @returns {*}
 */
Collection.prototype.TRACE = function () {
    return _.partial(this.HTTP_METHOD, false, 'TRACE').apply(this, arguments);
};

/**
 * Send a HEAD request
 * @returns {*}
 */
Collection.prototype.HEAD = function () {
    return _.partial(this.HTTP_METHOD, false, 'HEAD').apply(this, arguments);
};

/**
 * Send a POST request
 * @returns {*}
 */
Collection.prototype.POST = function () {
    return _.partial(this.HTTP_METHOD, true, 'POST').apply(this, arguments);
};

/**
 * Send a PUT request
 * @returns {*}
 */
Collection.prototype.PUT = function () {
    return _.partial(this.HTTP_METHOD, true, 'PUT').apply(this, arguments);
};

/**
 * Send a PATCH request
 * @returns {*}
 */
Collection.prototype.PATCH = function () {
    return _.partial(this.HTTP_METHOD, true, 'PATCH').apply(this, arguments);
};

/**
 *
 * @returns {{}}
 * @private
 */
function _countCache() {
    var hash = {};
    var collCache = cache._localCacheByType[this.name] || {};
    var mappings = Object.keys(collCache);
    _.each(mappings, function (m) {
        var mappingCache = collCache[m] || {};
        extend(hash, mappingCache);
    });
    return hash;
}

/**
 * Returns the number of objects in this collection.
 *
 * TODO: This is very inefficient at the moment. If using storage, it will load every single model into memory!
 * @param callback
 * @returns Promise
 */
Collection.prototype.count = function (callback) {
    var deferred = q.defer();
    callback = util.constructCallbackAndPromiseHandler(callback, deferred);
    var hash = _countCache.call(this);
    if (siesta.ext.storageEnabled) {
        var tasks = _.map(this._mappings, function (m) {
            return _.bind(m.all, m);
        });
        util.parallel(tasks, function (err, results) {
            var n;
            if (!err) {
                _.each(results, function (result) {
                    _.each(result, function (model) {
                        hash[model._id] = model;
                    });
                });
                n = Object.keys(hash).length;
            }
            callback(err, n);
        });
    }
    else {
        callback(null, Object.keys(hash).length)
    }
    return deferred.promise;
};

exports.Collection = Collection;
