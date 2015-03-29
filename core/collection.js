/**
 * @module collection
 */
(function() {
  var log = require('./log')('collection'),
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
    util.extendFromOpts(this, opts, {});

    _.extend(this, {
      name: name,
      _rawModels: {},
      _models: {},
      _opts: opts,
      installed: false
    });

    Object.defineProperties(this, {
      dirty: {
        get: function() {
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
    this._makeAvailableOnRoot();
    events.ProxyEventEmitter.call(this, this.name);
  }

  Collection.prototype = Object.create(events.ProxyEventEmitter.prototype);

  _.extend(Collection.prototype, {
    _getModelsToInstall: function() {
      var modelsToInstall = [];
      for (var name in this._models) {
        if (this._models.hasOwnProperty(name)) {
          var model = this._models[name];
          modelsToInstall.push(model);
        }
      }
      log('There are ' + modelsToInstall.length.toString() + ' mappings to install');
      return modelsToInstall;
    },
    /**
     * Means that we can access the collection on the siesta object.
     * @private
     */
    _makeAvailableOnRoot: function() {
      var index = require('./index');
      index[this.name] = this;
    },
    /**
     * Ensure mappings are installed.
     * @param [cb]
     * @class Collection
     */
    install: function(cb) {
      var modelsToInstall = this._getModelsToInstall();
      return util.promise(cb, function(cb) {
        if (!this.installed) {
          this.installed = true;
          var errors = [];
          _.each(modelsToInstall, function(m) {
            log('Installing relationships for mapping with name "' + m.name + '"');
            var err = m.installRelationships();
            if (err) errors.push(err);
          });
          if (!errors.length) {
            _.each(modelsToInstall, function(m) {
              log('Installing reverse relationships for mapping with name "' + m.name + '"');
              var err = m.installReverseRelationships();
              if (err) errors.push(err);
            });
            if (!errors.length) {
              this.installed = true;
              this._makeAvailableOnRoot();
            }
          }
          cb(errors.length ? error('Errors were encountered whilst setting up the collection', {errors: errors}) : null);
        } else throw new InternalSiestaError('Collection "' + this.name + '" has already been installed');
      }.bind(this));
    },
    /**
     * Given the name of a mapping and an options object describing the mapping, creating a Model
     * object, install it and return it.
     * @param  {String} name
     * @param  {Object} opts
     * @return {Model}
     * @class Collection
     */
    _model: function(name, opts) {
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
     * @param op
     */
    model: function(op) {
      if (arguments.length) {
        if (arguments.length == 1) {
          if (util.isArray(arguments[0])) {
            return _.map(arguments[0], function(m) {
              return this._model(m.name, m);
            }.bind(this));
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
            return _.map(arguments, function(m) {
              return this._model(m.name, m);
            }.bind(this));
          }
        }
      }
      if (this.installed) {

      }
      return null;
    },

    /**
     * Dump this collection as JSON
     * @param  {Boolean} asJson Whether or not to apply JSON.stringify
     * @return {String|Object}
     * @class Collection
     */
    _dump: function(asJson) {
      var obj = {};
      obj.installed = this.installed;
      obj.docId = this._docId;
      obj.name = this.name;
      return asJson ? util.prettyPrint(obj) : obj;
    },

    /**
     * Returns the number of objects in this collection.
     *
     * @param cb
     * @returns {Promise}
     */
    count: function(cb) {
      return util.promise(cb, function(cb) {
        var tasks = _.map(this._models, function(m) {
          return _.bind(m.count, m);
        });
        util.async.parallel(tasks, function(err, ns) {
          var n;
          if (!err) {
            n = _.reduce(ns, function(m, r) {
              return m + r
            }, 0);
          }
          cb(err, n);
        });
      }.bind(this));
    },

    graph: function(data, opts, cb) {
      if (typeof opts == 'function') cb = opts;
      opts = opts || {};
      return util.promise(cb, function(cb) {
        var tasks = [], err;
        for (var modelName in data) {
          if (data.hasOwnProperty(modelName)) {
            var model = this._models[modelName];
            if (model) {
              (function(model, data) {
                tasks.push(function(done) {
                  model.graph(data, function(err, models) {
                    if (!err) {
                      var results = {};
                      results[model.name] = models;
                    }
                    done(err, results);
                  });
                });
              })(model, data[modelName]);
            }
            else {
              err = 'No such model "' + modelName + '"';
            }
          }
        }
        if (!err) util.async.series(tasks, function(err, results) {
          if (!err) {
            results = results.reduce(function(memo, res) {
              return _.extend(memo, res);
            }, {})
          } else results = null;
          cb(err, results);
        });
        else cb(error(err, {data: data, invalidModelName: modelName}));
      }.bind(this));
    },

    removeAll: function(cb) {
      return util.promise(cb, function(cb) {
        util.Promise.all(
          Object.keys(this._models).map(function(modelName) {
            var model = this._models[modelName];
            return model.removeAll();
          }.bind(this))
        ).then(function() {
            cb(null);
          })
          .catch(cb)
      }.bind(this));
    }
  });


  module.exports = Collection;
})();