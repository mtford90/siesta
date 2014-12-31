/**
 * @module collection
 */

var log = require('./operation/log');

var CollectionRegistry = require('./collectionRegistry').CollectionRegistry;
var Operation = require('./operation/operation').Operation;
var InternalSiestaError = require('./error').InternalSiestaError;
var Model = require('./model').Model;
var extend = require('extend');
var observe = require('../vendor/observe-js/src/observe').Platform;
var notifications = require('./notifications');

var util = require('./util');
var _ = util._;

var cache = require('./cache');

var SAFE_METHODS = ['GET', 'HEAD', 'TRACE', 'OPTIONS', 'CONNECT']
    , UNSAFE_METHODS = ['PUT', 'PATCH', 'POST', 'DELETE'];

var Logger = log.loggerWithName('Collection');


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
    if (!name) throw new Error('Collection must have a name');
    this.name = name;
    this._rawModels = {};
    this._models = {};
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


    Object.defineProperty(this, 'dirty', {
        get: function () {
            if (siesta.ext.storageEnabled) {
                var unsavedObjectsByCollection = siesta.ext.storage._unsavedObjectsByCollection,
                    hash = unsavedObjectsByCollection[self.name] || {};
                return !!Object.keys(hash).length;
            }
            else return undefined;
        },
        enumerable: true
    });
}


_.extend(Collection.prototype, {
    /**
     * Ensure mappings are installed.
     * @param [callback]
     * @class Collection
     */
    install: function (callback) {
        var deferred = window.q ? window.q.defer() : null;
        var self = this;
        if (!this.installed) {
            var modelsToInstall = [];
            for (var name in this._models) {
                if (this._models.hasOwnProperty(name)) {
                    var model = this._models[name];
                    modelsToInstall.push(model);
                }
            }
            if (Logger.info.isEnabled)
                Logger.info('There are ' + modelsToInstall.length.toString() + ' mappings to install');
            if (modelsToInstall.length) {
                var tasks = _.map(modelsToInstall, function (m) {
                    return _.bind(m.install, m);
                });
                util.async.parallel(tasks, function (err) {
                    if (err) {
                        Logger.error('Failed to install collection', err);
                        self._finaliseInstallation(err, callback, deferred);
                    }
                    else {
                        self.installed = true;
                        var errors = [];
                        _.each(modelsToInstall, function (m) {
                            if (Logger.info.isEnabled)
                                Logger.info('Installing relationships for mapping with name "' + m.name + '"');
                            var err = m.installRelationships();
                            if (err) errors.push(err);
                        });
                        if (!errors.length) {
                            _.each(modelsToInstall, function (m) {
                                if (Logger.info.isEnabled)
                                    Logger.info('Installing reverse relationships for mapping with name "' + m.name + '"');
                                var err = m.installReverseRelationships();
                                if (err) errors.push(err);
                            });
                        }
                        if (errors.length == 1) {
                            err = errors[0];
                        } else if (errors.length) {
                            err = errors;
                        }
                        self._finaliseInstallation(err, callback, deferred);
                    }
                });

            } else {
                self._finaliseInstallation(null, callback, deferred);
            }
        } else {
            var err = new InternalSiestaError('Collection "' + this.name + '" has already been installed');
            self._finaliseInstallation(err, callback, deferred);
        }
        return deferred ? deferred.promise : null;
    },

    /**
     * Mark this collection as installed, and place the collection on the global Siesta object.
     * @param  {Object}   err
     * @param  {Function} callback
     * @param {Q.promise} deferred
     * @class Collection
     */
    _finaliseInstallation: function (err, callback, deferred) {
        if (!err) {
            this.installed = true;
            var index = require('./index');
            index[this.name] = this;
        }
        if (err)deferred.reject(err);
        else deferred.resolve();
        if (callback) callback(err);
    },
    /**
     * Given the name of a mapping and an options object describing the mapping, creating a Model
     * object, install it and return it.
     * @param  {String} name
     * @param  {Object} opts
     * @return {Model}
     * @class Collection
     */
    _model: function (name, opts) {
        if (name) {
            this._rawModels[name] = opts;
            opts = extend(true, {}, opts);
            opts.name = name;
            opts.collection = this;
            var model = new Model(opts);
            this._models[name] = model;
            this[name] = model;
            return model;
        } else {
            throw new Error('No name specified when creating mapping');
        }
    },


    /**
     * Registers a model with this collection.
     * @param {String|Object} optsOrName An options object or the name of the mapping. Must pass options as second param if specify name.
     * @param {Object} opts Options if name already specified.
     * @return {Model}
     * @class Collection
     */
    model: function () {
        var self = this;
        if (arguments.length) {
            if (arguments.length == 1) {
                if (util.isArray(arguments[0])) {
                    return _.map(arguments[0], function (m) {
                        return self._model(m.name, m);
                    });
                } else {
                    return this._model(arguments[0].name, arguments[0]);
                }
            } else {
                if (typeof arguments[0] == 'string') {
                    return this._model(arguments[0], arguments[1]);
                } else {
                    return _.map(arguments, function (m) {
                        return self._model(m.name, m);
                    });
                }
            }
        }
        return null;
    },

    descriptor: function (opts) {
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
            throw new Error('HTTP module not installed.');
        }
        return descriptors;
    },

    /**
     * Dump this collection as JSON
     * @param  {Boolean} asJson Whether or not to apply JSON.stringify
     * @return {String|Object}
     * @class Collection
     */
    _dump: function (asJson) {
        var obj = {};
        obj.installed = this.installed;
        obj.docId = this._docId;
        obj.name = this.name;
        obj.baseURL = this.baseURL;
        return asJson ? JSON.stringify(obj, null, 4) : obj;
    },

    _http: function (method) {
        if (siesta.ext.httpEnabled) {
            var args = Array.prototype.slice.call(arguments, 1);
            args.unshift(this);
            var f = siesta.ext.http[method];
            f.apply(f, args);
        } else {
            throw new Error('HTTP module not installed.');
        }
    },

    /**
     * Send a GET request
     * @param {String} path The path to the resource we want to GET
     * @param {Object|Function} optsOrCallback Either an options object or a callback if can use defaults
     * @param {Function} callback Callback if opts specified.
     * @package HTTP
     * @returns {Promise}
     */
    GET: function () {
        return _.partial(this._http, 'GET').apply(this, arguments);
    },

    /**
     * Send a OPTIONS request
     * @param {String} path The path to the resource to which we want to send an OPTIONS request
     * @param {Object|Function} optsOrCallback Either an options object or a callback if can use defaults
     * @param {Function} callback Callback if opts specified.
     * @returns {Promise}
     */
    OPTIONS: function () {
        return _.partial(this._http, 'OPTIONS').apply(this, arguments);
    },

    /**
     * Send a TRACE request
     * @param {path} path The path to the resource to which we want to send a TRACE request
     * @param {Object|Function} optsOrCallback Either an options object or a callback if can use defaults
     * @param {Function} callback Callback if opts specified.
     * @returns {Promise}
     */
    TRACE: function () {
        return _.partial(this._http, 'TRACE').apply(this, arguments);
    },

    /**
     * Send a HEAD request
     * @param {String} path The path to the resource to which we want to send a HEAD request
     * @param {Object|Function} optsOrCallback Either an options object or a callback if can use defaults
     * @param {Function} callback Callback if opts specified.
     * @returns {Promise}
     */
    HEAD: function () {
        return _.partial(this._http, 'HEAD').apply(this, arguments);
    },

    /**
     * Send a POST request
     * @param {String} path The path to the resource to which we want to send a POST request
     * @param {ModelInstance} model The model that we would like to POST
     * @param {Object|Function} optsOrCallback Either an options object or a callback if can use defaults
     * @param {Function} callback Callback if opts specified.
     * @returns {Promise}
     */
    POST: function () {
        return _.partial(this._http, 'POST').apply(this, arguments);
    },

    /**
     * Send a PUT request
     * @param {String} path The path to the resource to which we want to send a PUT request
     * @param {ModelInstance} model The model that we would like to PUT
     * @param {Object|Function} optsOrCallback Either an options object or a callback if can use defaults
     * @param {Function} callback Callback if opts specified.
     * @returns {Promise}
     */
    PUT: function () {
        _.partial(this._http, 'PUT').apply(this, arguments);
    },

    /**
     * Send a PATCH request
     * @param {String} path The path to the resource to which we want to send a PATCH request
     * @param {ModelInstance} model The model that we would like to PATCH
     * @param {Object|Function} optsOrCallback Either an options object or a callback if can use defaults
     * @param {Function} callback Callback if opts specified.
     * @returns {Promise}
     */
    PATCH: function () {
        return _.partial(this._http, 'PATCH').apply(this, arguments);
    },

    /**
     * Send a DELETE request. Also removes the object.
     * @param {String} path The path to the resource to which we want to DELETE
     * @param {ModelInstance} model The model that we would like to PATCH
     * @param {Object|Function} optsOrCallback Either an options object or a callback if can use defaults
     * @param {Function} callback Callback if opts specified.
     * @returns {Promise}
     */
    DELETE: function (path, object) {
        return _.partial(this._http, 'DELETE').apply(this, arguments);
    },

    /**
     * Returns the number of objects in this collection.
     *
     * @param callback
     * @returns {Promise}
     */
    count: function (callback) {
        var deferred = util.defer(callback);
        var tasks = _.map(this._models, function (m) {
            return _.bind(m.count, m);
        });
        util.async.parallel(tasks, function (err, ns) {
            var n;
            if (!err) {
                n = _.reduce(ns, function (m, r) {
                    return m + r
                }, 0);
            }
            deferred.finish(err, n);
        });
        return deferred.promise;
    },
    listen: function (fn) {
        notifications.on(this.name, fn);
        return function () {
            this.removeListener(fn);
        }.bind(this);
    },
    listenOnce: function (fn) {
        return notifications.once(this.name, fn);
    },
    removeListener: function (fn) {
        return notifications.removeListener(this.name, fn);
    }
});


exports.Collection = Collection;