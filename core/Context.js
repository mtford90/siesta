var events = require('./events'),
  modelEvents = require('./modelEvents'),
  Cache = require('./cache'),
  util = require('./util'),
  Model = require('./model'),
  error = require('./error'),
  Storage = require('../storage'),
  Promise = require('./Promise'),
  Serialiser = require('./Serialiser'),
  Filter = require('./Filter'),
  Collection = require('./collection');

function configureStorage(opts) {
  this._storage = new Storage(this, opts);
}

function Context(opts) {
  this.parent = null;
  this.children = [];
  this.collections = {};
  this.cache = new Cache();

  opts = opts || {};
  this.name = opts.name;

  if (opts.storage) {
    configureStorage.call(this, opts.storage);
  }

  if (!this.name) throw new Error('Must provide name to context');

  this.events = events();
  var off = this.events.removeListener.bind(this.events);

  util.extend(this, {
    on: this.events.on.bind(this.events),
    off: off,
    removeListener: off,
    once: this.events.once.bind(this.events),
    removeAllListeners: this.events.removeAllListeners.bind(this.events),
    notify: util.next,
    digest: util.next,
    emit: util.next,
    registerComparator: Filter.registerComparator.bind(Filter),
    save: function(cb) {
      return util.promise(cb, function(cb) {
        if (this._storage) {
          this._storage.save(cb);
        }
        else cb();
      }.bind(this));
    }
  });

  var interval, saving, autosaveInterval = 500;

  Object.defineProperties(this, {
    storage: {
      get: function() {
        return !!this._storage;
      },
      set: function(v) {
        if (!v) {
          delete this._storage;
        }
        else {
          this._storage = new Storage(this);
        }
      }
    },
    dirty: {
      get: function() {
        var storage = this._storage;
        if (storage) {
          var unsavedObjectsByCollection = storage._unsavedObjectsByCollection;
          return !!Object.keys(storage.unsavedObjectsByCollection).length;
        }
        return false;
      },
      enumerable: true
    },
    autosaveInterval: {
      get: function() {
        return autosaveInterval;
      },
      set: function(_autosaveInterval) {
        autosaveInterval = _autosaveInterval;
        if (interval) {
          // Reset interval
          this.autosave = false;
          this.autosave = true;
        }
      }
    },
    autosave: {
      get: function() {
        return !!interval;
      },
      set: function(autosave) {
        if (autosave) {
          if (!interval) {
            interval = setInterval(function() {
              // Cheeky way of avoiding multiple saves happening...
              if (!saving) {
                saving = true;
                this._storage.save(function(err) {
                  if (!err) {
                    this.events.emit('saved');
                  }
                  saving = false;
                }.bind(this));
              }
            }.bind(this), this.autosaveInterval);
          }
        }
        else {
          if (interval) {
            clearInterval(interval);
            interval = null;
          }
        }
      }
    },
    collectionNames: {
      get: function() {
        return Object.keys(this.collections);
      }
    },
    _collectionArr: {
      get: function() {
        return Object.keys(this.collections).map(function(collName) {
          return this.collections[collName];
        }.bind(this));
      }
    }
  });

  this.autosave = opts.autosave;
  if (opts.autosaveInterval) {
    this.autosaveInterval = opts.autosaveInterval;
  }
}

Context.prototype = {
  collection: function(name, opts) {
    opts = opts || {};
    opts.context = this;
    var collection = new Collection(name, opts);
    if (!this[name]) {
      this[name] = collection;
    }
    else {
      var errMsg = 'A collection with name "' + name + '" already exists, or that name is not allowed';
      console.error(errMsg, this[name]);
      throw Error(errMsg);
    }
    return collection;
  },
  broadcast: function(opts) {
    modelEvents.emit(this, opts);
  },
  graph: function(data, opts, cb) {
    if (typeof opts == 'function') cb = opts;
    opts = opts || {};
    return util.promise(cb, function(cb) {
      var tasks = [], err;
      for (var collectionName in data) {
        if (data.hasOwnProperty(collectionName)) {
          var collection = this.collections[collectionName];
          if (collection) {
            (function(collection, data) {
              tasks.push(function(done) {
                collection.graph(data, function(err, res) {
                  if (!err) {
                    var results = {};
                    results[collection.name] = res;
                  }
                  done(err, results);
                });
              });
            })(collection, data[collectionName]);
          }
          else {
            err = 'No such collection "' + collectionName + '"';
          }
        }
      }
      if (!err) {
        util.series(tasks, function(err, results) {
          if (!err) {
            results = results.reduce(function(memo, res) {
              return util.extend(memo, res);
            }, {})
          } else results = null;
          cb(err, results);
        });
      }
      else cb(error(err, {data: data, invalidCollectionName: collectionName}));
    }.bind(this));
  },
  count: function() {
    return this.cache.count();
  },
  get: function(id, cb) {
    return util.promise(cb, function(cb) {
      cb(null, this.cache._localCache()[id]);
    }.bind(this));
  },
  removeAll: function(cb) {
    return util.promise(cb, function(cb) {
      util.Promise.all(
        this.collectionNames.map(function(collectionName) {
          var collection = this.collections[collectionName];
          return collection.removeAll();
        }.bind(this))
      ).then(function() {
          cb(null);
        }).catch(cb)
    }.bind(this));
  },
  _setup: function(cb) {
    cb = cb || function() {};
    var allModels = this.collectionNames.reduce(function(memo, collectionName) {
      var collection = this.collections[collectionName];
      memo = memo.concat(collection.models);
      return memo;
    }.bind(this), []);
    Model.install(allModels, cb);
  },
  _pushTask: function(task) {
    if (!this.queuedTasks) {
      this.queuedTasks = new function Queue() {
        this.tasks = [];
        this.execute = function() {
          this.tasks.forEach(function(f) {
            f()
          });
          this.tasks = [];
        }.bind(this);
      };
    }
    this.queuedTasks.tasks.push(task);
  },
  reset: function(cb, resetStorage) {
    delete this.queuedTasks;
    this.cache.reset();
    var collectionNames = this.collectionNames;
    collectionNames.forEach(function(collectionName) {
      this[collectionName] = undefined;
    }.bind(this));
    this.removeAllListeners();
    if (this._storage) {
      resetStorage = resetStorage === undefined ? true : resetStorage;
      if (resetStorage) {
        this._storage._reset(cb, new PouchDB('siesta', {auto_compaction: true, adapter: 'memory'}));
      }
      else {
        cb();
      }
    }
    else {
      cb();
    }
  },
  /**
   *
   * @param opts
   * @param opts.name - Name of the context.
   */
  context: function(opts) {
    var context = new Context(opts),
      collectionNames = this.collectionNames,
      collections = {};
    context.parent = this;
    this.children.push(context);
    collectionNames.forEach(function(collectionName) {
      var newCollection = context.collection(collectionName),
        existingCollection = this.collections[collectionName];
      collections[collectionName] = newCollection;

      var rawModels = existingCollection._rawModels;
      Object.keys(rawModels).forEach(function(modelName) {
        var rawModel = util.extend({}, rawModels[modelName]);
        rawModel.name = modelName;
        var relationships = rawModel.relationships;
        if (relationships) {
          Object.keys(relationships).forEach(function(relName) {
            var rel = util.extend({}, relationships[relName]);
            if (rel.model) {
              if (rel.model instanceof Model) {
                // The raw models cannot refer to Models that exist in different contexts.
                rel.model = rel.model.name;
              }
            }
            relationships[relName] = rel;
          });
        }
        newCollection.model(rawModel);
      });
    }.bind(this));

    return context;
  },
  _prepare: function(instance) {
    var s = new Serialiser(instance.model);
    return s.data(instance);
  },
  _mergeIterable: function(iterable, cb) {
    var data = iterable.reduce(function(memo, instance) {
      var modelName = instance.model.name,
        collName = instance.collection.name;
      if (!memo[collName]) memo[collName] = {};
      if (!memo[collName][modelName]) memo[collName][modelName] = [];
      memo[collName][modelName].push(this._prepare(instance));
      return memo;
    }.bind(this), {});

    return this.graph(data, cb);
  },
  _mergeModel: function(model, cb) {
    return util.promise(cb, function(cb) {
      model
        .all()
        .then(function(instances) {
          this._mergeIterable(instances, cb);
        }.bind(this)).catch(cb);
    }.bind(this));
  },
  _mergeCollection: function(collection, cb) {
    return util.promise(cb, function(cb) {
      var models = collection.models;
      var promises = models.map(function(model) {
        return model.all();
      });
      Promise
        .all(promises)
        .then(function(res) {
          var instances = res.reduce(function(memo, arr) {
            return memo.concat(arr);
          }, []);
          this._mergeIterable(instances, cb);
        }.bind(this));
    }.bind(this));
  },
  isAncestor: function(childContext) {
    var parent = childContext.parent;
    while (parent) {
      if (parent == this) return true;
      parent = parent.parent;
    }
    return false;
  },
  _mergeContext: function(context, cb) {
    if (this.isAncestor(context)) {
      return util.promise(cb, function(cb) {
        var models = context._collectionArr.reduce(function(models, coll) {
          return models.concat(coll.models);
        }, []);
        var promises = models.map(function(model) {
          return model.all();
        });
        Promise
          .all(promises)
          .then(function(res) {
            var instances = res.reduce(function(memo, arr) {
              return memo.concat(arr);
            }, []);
            this._mergeIterable(instances, cb);
          }.bind(this));
      }.bind(this));
    }
    else {
      throw new Error('Cannot merge contexts from two different apps.');
    }

  },
  merge: function(payload, cb) {
    if (util.isArray(payload)) {
      return this._mergeIterable(payload, cb);
    }
    else if (payload instanceof Model) {
      return this._mergeModel(payload, cb);
    }
    else if (payload instanceof Collection) {
      return this._mergeCollection(payload, cb);
    }
    else if (payload instanceof Context) {
      return this._mergeContext(payload, cb);
    }
    else {
      return this._mergeIterable([payload], cb);
    }
  }
};

module.exports = Context;
