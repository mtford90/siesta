/**
 * @module collection
 */
(function () {
    var log = require('./log')('Collection'),
        CollectionRegistry = require('./collectionRegistry').CollectionRegistry,
        InternalSiestaError = require('./error').InternalSiestaError,
        Model = require('./model'),
        extend = require('extend'),
        observe = require('../vendor/observe-js/src/observe').Platform,
        events = require('./events'),
        util = require('./util'),
        _ = util._,
        error = require('./error'),
        cache = require('./cache');


    /**
     * A collection describes a set of models and optionally a REST API which we would
     * like to model.
     *
     * @param name
     * @param opts
     * @constructor
     *
     *
     * @example
     * ```js
     * var GitHub = new siesta('GitHub')
     * // ... configure mappings, descriptors etc ...
     * GitHub.install(function () {
     *     // ... carry on.
     * });
     * ```
     */
    function Collection(name, opts) {
        var self = this;
        if (!name) throw new Error('Collection must have a name');

        opts = opts || {};
        util.extendFromOpts(this, opts, {
            /**
             * The URL of the API e.g. http://api.github.com
             * @type {string}
             */
            baseURL: ''
        });

        _.extend(this, {
            name: name,
            _rawModels: {},
            _models: {},
            _opts: opts,
            /**
             * Set to true if installation has succeeded. You cannot use the collectio
             * @type {boolean}
             */
            installed: false
        });

        Object.defineProperties(this, {
            dirty: {
                get: function () {
                    if (siesta.ext.storageEnabled) {
                        var unsavedObjectsByCollection = siesta.ext.storage._unsavedObjectsByCollection,
                            hash = unsavedObjectsByCollection[self.name] || {};
                        return !!Object.keys(hash).length;
                    }
                    else return undefined;
                },
                enumerable: true
            }
        });

        CollectionRegistry.register(this);
        events.ProxyEventEmitter.call(this, this.name);
    }

    Collection.prototype = Object.create(events.ProxyEventEmitter.prototype);

    _.extend(Collection.prototype, {
        /**
         * Ensure mappings are installed.
         * @param [cb]
         * @class Collection
         */
        install: function (cb) {
            return util.promise(cb, function (cb) {
                var self = this;
                if (!this.installed) {
                    var modelsToInstall = [];
                    for (var name in this._models) {
                        if (this._models.hasOwnProperty(name)) {
                            var model = this._models[name];
                            modelsToInstall.push(model);
                        }
                    }
                    log('There are ' + modelsToInstall.length.toString() + ' mappings to install');
                    if (modelsToInstall.length) {
                        var tasks = _.map(modelsToInstall, function (m) {
                            return _.bind(m.install, m);
                        });
                        util.async.parallel(tasks, function (err) {
                            if (err) {
                                log('Failed to install collection', err);
                                self._finaliseInstallation(err, cb);
                            }
                            else {
                                self.installed = true;
                                var errors = [];
                                _.each(modelsToInstall, function (m) {
                                    log('Installing relationships for mapping with name "' + m.name + '"');
                                    var err = m.installRelationships();
                                    if (err) errors.push(err);
                                });
                                if (!errors.length) {
                                    _.each(modelsToInstall, function (m) {
                                        log('Installing reverse relationships for mapping with name "' + m.name + '"');
                                        var err = m.installReverseRelationships();
                                        if (err) errors.push(err);
                                    });
                                }
                                if (errors.length == 1) {
                                    err = errors[0];
                                } else if (errors.length) {
                                    err = errors;
                                }
                                self._finaliseInstallation(err, cb);
                            }
                        });

                    } else {
                        self._finaliseInstallation(null, cb);
                    }
                } else {
                    throw new InternalSiestaError('Collection "' + this.name + '" has already been installed');
                }
            }.bind(this));
        },

        /**
         * Mark this collection as installed, and place the collection on the global Siesta object.
         * @param  {Object}   err
         * @param  {Function} callback
         * @class Collection
         */
        _finaliseInstallation: function (err, callback) {
            if (err) err = error('Errors were encountered whilst setting up the collection', {errors: err});
            if (!err) {
                this.installed = true;
                var index = require('./index');
                index[this.name] = this;
            }
            callback(err);
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
        model: function (op) {
            var acceptModels = !this.installed;
            if (acceptModels) {
                var self = this;
                if (arguments.length) {
                    if (arguments.length == 1) {
                        if (util.isArray(arguments[0])) {
                            return _.map(arguments[0], function (m) {
                                return self._model(m.name, m);
                            });
                        } else {
                            var name, opts;
                            if (util.isString(arguments[0])) {
                                name = arguments[0];
                                opts = {};
                            }
                            else {
                                opts = arguments[0];
                                name = opts.name;
                            }
                            return this._model(name, opts);
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
            }
            else {
                throw Error('Cannot create new models once the object graph is established!');
            }
            return null;
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
            return asJson ? util.prettyPrint(obj) : obj;
        },

        /**
         * Returns the number of objects in this collection.
         *
         * @param cb
         * @returns {Promise}
         */
        count: function (cb) {
            return util.promise(cb, function (cb) {
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
                    cb(err, n);
                });
            }.bind(this));
        }
    });

    module.exports = Collection;
})();