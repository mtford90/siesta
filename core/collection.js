var log = require('./log')('collection'),
  InternalSiestaError = require('./error').InternalSiestaError,
  Model = require('./model'),
  extend = require('extend'),
  ProxyEventEmitter = require('./ProxyEventEmitter'),
  util = require('./util'),
  error = require('./error'),
  argsarray = require('argsarray'),
  Condition = require('./condition');


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
    context: null
  });

  util.extend(this, {
    name: name,
    _rawModels: {},
    _models: {},
    _opts: opts,
    installed: false
  });

  Object.defineProperties(this, {
    dirty: {
      get: function() {
        if (this.context.storage) {
          var unsavedObjectsByCollection = this.context._storage._unsavedObjectsByCollection,
            hash = unsavedObjectsByCollection[self.name] || {};
          return !!Object.keys(hash).length;
        }
        else return undefined;
      },
      enumerable: true
    },
    models: {
      get: function() {
        return Object.keys(this._models).map(function(modelName) {
          return this._models[modelName];
        }.bind(this));
      }
    }
  });

  this.context.collections[this.name] = this;
  ProxyEventEmitter.call(this, this.context, this.name);

}

Collection.prototype = Object.create(ProxyEventEmitter.prototype);

util.extend(Collection.prototype, {
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
    }
    else {
      throw new Error('No name specified when creating mapping');
    }
  },

  /**
   * Registers a model with this collection.
   */
  model: argsarray(function(args) {
    if (args.length) {
      if (args.length == 1) {
        if (util.isArray(args[0])) {
          return args[0].map(function(m) {
            return this._model(m.name, m);
          }.bind(this));
        } else {
          var name, opts;
          if (util.isString(args[0])) {
            name = args[0];
            opts = {};
          }
          else {
            opts = args[0];
            name = opts.name;
          }
          return this._model(name, opts);
        }
      } else {
        if (typeof args[0] == 'string') {
          return this._model(args[0], args[1]);
        } else {
          return args.map(function(m) {
            return this._model(m.name, m);
          }.bind(this));
        }
      }
    }

    return null;
  }),

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
      var tasks = Object.keys(this._models).map(function(modelName) {
        var m = this._models[modelName];
        return m.count.bind(m);
      }.bind(this));
      util.parallel(tasks, function(err, ns) {
        var n;
        if (!err) {
          n = ns.reduce(function(m, r) {
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
      if (!err) {
        util.series(tasks, function(err, results) {
          if (!err) {
            results = results.reduce(function(memo, res) {
              return util.extend(memo, res || {});
            }, {})
          } else results = null;
          cb(err, results);
        });
      }
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
