/**
 * @module collection
 */

var log = require('./operation/log');
var Logger = log.loggerWithName('Collection');
Logger.setLevel(log.Level.warn);

var CollectionRegistry = require('./collectionRegistry').CollectionRegistry;
var Operation = require('./operation/operation').Operation;
var InternalSiestaError = require('./error').InternalSiestaError;
var Mapping = require('./mapping').Mapping;
var extend = require('extend');
var observe = require('../vendor/observe-js/src/observe').Platform;

var util = require('./util');
var _ = util._;

var cache = require('./cache');

var SAFE_METHODS = ['GET', 'HEAD', 'TRACE', 'OPTIONS', 'CONNECT'];
var UNSAFE_METHODS = ['PUT', 'PATCH', 'POST', 'DELETE'];

/**
 * A collection describes a set of models and optionally a REST API which we would
 * like to model.
 *
 * @param name
 * @constructor
 *
 *
 * @example
 * ```js
 * var GitHub = new siesta.Collection('GitHub')
 * // ... configure mappings, descriptors etc ...
 * GitHub.install(function () {
 *     // ... carry on.
 * });
 * ```
 */
function Collection(name) {
    var self = this;
    if (!this) return new Collection(name);
    if (!name) throw new InternalSiestaError('Collection must have a name');
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
        get: function() {
            return self._name;
        }
    });
}

/**
 * Ensure mappings are installed.
 * @param callback
 */
Collection.prototype.install = function(callback) {
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
            var operations = _.map(mappingsToInstall, function(m) {
                return new Operation('Install Mapping', _.bind(m.install, m));
            });
            var op = new Operation('Install Mappings', operations);
            op.completion = function() {
                if (op.failed) {
                    Logger.error('Failed to install collection', op.error);
                    self._finaliseInstallation(op.error, callback);
                } else {
                    self.installed = true;
                    var errors = [];
                    _.each(mappingsToInstall, function(m) {
                        if (Logger.info.isEnabled)
                            Logger.info('Installing relationships for mapping with name "' + m.type + '"');
                        var err = m.installRelationships();
                        if (err) errors.push(err);
                    });
                    if (!errors.length) {
                        _.each(mappingsToInstall, function(m) {
                            if (Logger.info.isEnabled)
                                Logger.info('Installing reverse relationships for mapping with name "' + m.type + '"');
                            var err = m.installReverseRelationships();
                            if (err) errors.push(err);
                        });
                    }
                    var err;
                    if (errors.length == 1) {
                        err = errors[0];
                    } else if (errors.length) {
                        err = errors;
                    }
                    self._finaliseInstallation(err, callback);
                }
            };
            op.start();
        } else {
            self._finaliseInstallation(null, callback);
        }
    } else {
        var err = new InternalSiestaError('Collection "' + this._name + '" has already been installed');
        self._finaliseInstallation(err, callback);
    }
    return deferred.promise;
};

/**
 * Mark this collection as installed, and place the collection on the global Siesta object.
 * @param  {Object}   err
 * @param  {Function} callback
 */
Collection.prototype._finaliseInstallation = function(err, callback) {
    if (!err) {
        this.installed = true;
        var index = require('../index');
        index[this._name] = this;
    }
    if (callback) callback(err);
};

/**
 * Given the name of a mapping and an options object describing the mapping, creating a Mapping
 * object, install it and return it.
 * @param  {String} name
 * @param  {Object} mapping
 * @return {Mapping}
 */
Collection.prototype._mapping = function(name, opts) {
    if (name) {
        this._rawMappings[name] = opts;
        var opts = extend(true, {}, opts);
        opts.type = name;
        opts.collection = this._name;
        var mappingObject = new Mapping(opts);
        this._mappings[name] = mappingObject;
        this[name] = mappingObject;
        return mappingObject;
    } else {
        throw new InternalSiestaError('No name specified when creating mapping');
    }
};

/**
 * Registers a mapping with this collection.
 * @param {String|Object} optsOrName An options object or the name of the mapping. Must pass options as second param if specify name.
 * @param {Object} opts Options if name already specified.
 * @return {Mapping}
 */
Collection.prototype.mapping = function() {
    var self = this;
    if (arguments.length) {
        if (arguments.length == 1) {
            if (util.isArray(arguments[0])) {
                return _.map(arguments[0], function(m) {
                    return self._mapping(m.name, m);
                });
            } else {
                return this._mapping(arguments[0].name, arguments[0]);
            }
        } else {
            if (typeof arguments[0] == 'string') {
                return this._mapping(arguments[0], arguments[1]);
            } else {
                return _.map(arguments, function(m) {
                    return self._mapping(m.name, m);
                });
            }
        }
    }
    return null;
};

Collection.prototype.descriptor = function(opts) {
    var descriptors = [];
    if (siesta.ext.httpEnabled) {
        opts.collection = this;
        var methods = siesta.ext.http._resolveMethod(opts.method);
        var unsafe = [];
        var safe = [];
        for (var i = 0; i < methods.length; i++) {
            var m = methods[i];
            if (UNSAFE_METHODS.indexOf(m) > -1) {
                unsafe.push(m);
            } else {
                safe.push(m);
            }
        }
        if (unsafe.length) {
            var requestDescriptor = extend({}, opts);
            requestDescriptor.method = unsafe;
            requestDescriptor = new siesta.ext.http.RequestDescriptor(requestDescriptor);
            siesta.ext.http.DescriptorRegistry.registerRequestDescriptor(requestDescriptor);
            descriptors.push(requestDescriptor);
        }
        if (safe.length) {
            var responseDescriptor = extend({}, opts);
            responseDescriptor.method = safe;
            responseDescriptor = new siesta.ext.http.ResponseDescriptor(responseDescriptor);
            siesta.ext.http.DescriptorRegistry.registerResponseDescriptor(responseDescriptor);
            descriptors.push(responseDescriptor);
        }
    } else {
        throw new InternalSiestaError('HTTP module not installed');
    }
    return descriptors;
};

/**
 * Dump this collection as JSON
 * @param  {Boolean} asJson Whether or not to apply JSON.stringify
 * @return {String|Object}
 */
Collection.prototype._dump = function(asJson) {
    var obj = {};
    obj.installed = this.installed;
    obj.docId = this._docId;
    obj.name = this._name;
    obj.baseURL = this.baseURL;
    return asJson ? JSON.stringify(obj, null, 4) : obj;
};


// /**
//  * Persist all changes to PouchDB.
//  * Note: Storage extension must be installed.
//  * @param callback
//  * @returns {Promise}
//  */
// Collection.prototype.save = function(callback) {
//     var deferred = q.defer();
//     callback = util.constructCallbackAndPromiseHandler(callback, deferred);
//     if (siesta.ext.storageEnabled) {
//         util.next(function() {
//             var mergeChanges = siesta.ext.storage.changes.mergeChanges;
//             mergeChanges(callback);
//         });
//     } else {
//         callback('Storage module not installed');
//     }
//     return deferred.promise;
// };


Collection.prototype._http = function(method) {
    if (siesta.ext.httpEnabled) {
        var args = Array.prototype.slice.call(arguments, 1);
        args.unshift(this);
        var f = siesta.ext.http[method];
        f.apply(f, args);
    } else {
        throw InternalSiestaError('HTTP module not enabled');
    }
}

/**
 * Send a GET request
 * @param {String} path The path to the resource we want to GET
 * @param {Object|Function} optsOrCallback Either an options object or a callback if can use defaults
 * @param {Function} callback Callback if opts specified.
 * @package HTTP
 * @returns {Promise}
 */
Collection.prototype.GET = function() {
    return _.partial(this._http, 'GET').apply(this, arguments);
};

/**
 * Send a OPTIONS request
 * @param {String} path The path to the resource to which we want to send an OPTIONS request
 * @param {Object|Function} optsOrCallback Either an options object or a callback if can use defaults
 * @param {Function} callback Callback if opts specified.
 * @returns {Promise}
 */
Collection.prototype.OPTIONS = function() {
    return _.partial(this._http, 'OPTIONS').apply(this, arguments);
};

/**
 * Send a TRACE request
 * @param {path} path The path to the resource to which we want to send a TRACE request
 * @param {Object|Function} optsOrCallback Either an options object or a callback if can use defaults
 * @param {Function} callback Callback if opts specified.
 * @returns {Promise}
 */
Collection.prototype.TRACE = function() {
    return _.partial(this._http, 'TRACE').apply(this, arguments);
};

/**
 * Send a HEAD request
 * @param {String} path The path to the resource to which we want to send a HEAD request
 * @param {Object|Function} optsOrCallback Either an options object or a callback if can use defaults
 * @param {Function} callback Callback if opts specified.
 * @returns {Promise}
 */
Collection.prototype.HEAD = function() {
    return _.partial(this._http, 'HEAD').apply(this, arguments);
};

/**
 * Send a POST request
 * @param {String} path The path to the resource to which we want to send a POST request
 * @param {SiestaModel} model The model that we would like to POST
 * @param {Object|Function} optsOrCallback Either an options object or a callback if can use defaults
 * @param {Function} callback Callback if opts specified.
 * @returns {Promise}
 */
Collection.prototype.POST = function() {
    return _.partial(this._http, 'POST').apply(this, arguments);
};

/**
 * Send a PUT request
 * @param {String} path The path to the resource to which we want to send a PUT request
 * @param {SiestaModel} model The model that we would like to PUT
 * @param {Object|Function} optsOrCallback Either an options object or a callback if can use defaults
 * @param {Function} callback Callback if opts specified.
 * @returns {Promise}
 */
Collection.prototype.PUT = function() {
    _.partial(this._http, 'PUT').apply(this, arguments);
};

/**
 * Send a PATCH request
 * @param {String} path The path to the resource to which we want to send a PATCH request
 * @param {SiestaModel} model The model that we would like to PATCH
 * @param {Object|Function} optsOrCallback Either an options object or a callback if can use defaults
 * @param {Function} callback Callback if opts specified.
 * @returns {Promise}
 */
Collection.prototype.PATCH = function() {
    return _.partial(this._http, 'PATCH').apply(this, arguments);
};

/**
 * Send a DELETE request. Also removes the object.
 * @param {String} path The path to the resource to which we want to DELETE
 * @param {SiestaModel} model The model that we would like to PATCH
 * @param {Object|Function} optsOrCallback Either an options object or a callback if can use defaults
 * @param {Function} callback Callback if opts specified.
 * @returns {Promise}
 */
Collection.prototype.DELETE = function(path, object) {
    return _.partial(this._http, 'DELETE').apply(this, arguments);
};

/**
 * Returns the number of objects in this collection.
 *
 * @param callback
 * @returns {Promise}
 */
Collection.prototype.count = function(callback) {
    var deferred = q.defer();
    callback = util.constructCallbackAndPromiseHandler(callback, deferred);
    var tasks = _.map(this._mappings, function(m) {
        return _.bind(m.count, m);
    });
    util.parallel(tasks, function(err, ns) {
        var n;
        if (!err) {
            n = _.reduce(ns, function(m, r) {
                return m + r
            }, 0);
        }
        callback(err, n);
    });
    return deferred.promise;
};

exports.Collection = Collection;