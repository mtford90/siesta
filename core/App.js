var CollectionRegistry = require('./collectionRegistry'),
  events = require('./events'),
  modelEvents = require('./modelEvents'),
  Cache = require('./cache'),
  util = require('./util'),
  Model = require('./model'),
  error = require('./error'),
  Storage = require('../storage'),
  Query = require('./Query'),
  Collection = require('./collection');

function Context(name, app) {
  this.name = name;
  this.collectionRegistry = new CollectionRegistry();
  this.cache = new Cache();
  this.app = app;
  this.storage = new Storage(this.app);
  this.events = events();
  var off = this.events.removeListener.bind(this.events);

  util.extend(this, {
    on: this.events.on.bind(this.events),
    off: off,
    removeListener: off,
    once: this.events.once.bind(this.events),
    removeAllListeners: this.events.removeAllListeners.bind(this.events),
    notify: util.next,
    registerComparator: Query.registerComparator.bind(Query),
    save: this.storage.save.bind(this.storage),
    setPouch: function(p) {
      this.storage.pouch = p;
    }.bind(this)
  });

  var interval, saving, autosaveInterval = 500;
  var storageEnabled;


  if (typeof PouchDB == 'undefined') {
    this.storageEnabled = false;
    console.warn('PouchDB is not present therefore storage is disabled.');
  }

  Object.defineProperties(this, {
    dirty: {
      get: function() {
        var unsavedObjectsByCollection = this.storage._unsavedObjectsByCollection;
        return !!Object.keys(this.storage.unsavedObjectsByCollection).length;
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
                this.storage.save(function(err) {
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
    storageEnabled: {
      get: function() {
        if (storageEnabled !== undefined) {
          return storageEnabled;
        }
        return !!this.storage;
      },
      set: function(v) {
        storageEnabled = v;
      },
      enumerable: true
    }
  });
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
      throw Error('A collection with name "' + name + '" already exists, or that name is not allowed');
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
          var collection = this.collectionRegistry[collectionName];
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
        this.collectionRegistry.collectionNames.map(function(collectionName) {
          return this.collectionRegistry[collectionName].removeAll();
        }.bind(this))
      ).then(function() {
          cb(null);
        }).catch(cb)
    }.bind(this));
  },
  _ensureInstalled: function(cb) {
    cb = cb || function() {};
    var collectionNames = this.collectionRegistry.collectionNames;
    var allModels = collectionNames
      .reduce(function(memo, collectionName) {
        var collection = this.collectionRegistry[collectionName];
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
    this.collectionRegistry.reset();
    var collectionNames = this.collectionRegistry.collectionNames;
    collectionNames.reduce(function(memo, collName) {
      var coll = this.collectionRegistry[collName];
      Object.keys(coll._models).forEach(function(modelName) {
        var model = coll[modelName];
        memo.push(model._storageEnabled);
      });
      return memo;
    }.bind(this), []);
    this.removeAllListeners();
    if (this.storageEnabled) {
      resetStorage = resetStorage === undefined ? true : resetStorage;
      if (resetStorage) {
        this.storage._reset(cb);
        this.setPouch(new PouchDB('siesta', {auto_compaction: true, adapter: 'memory'}));
      }
      else {
        cb();
      }
    }
    else {
      cb();
    }
  },
};

function App(name) {
  if (!name) throw new Error('App must have a name');
  this.name = name;

  this.defaultContext = new Context(name + '-default', this);
  util.extend(this, this.defaultContext);

  function copyProperty(prop) {
    Object.defineProperty(this, prop, {
      get: function() {
        return this.defaultContext[prop];
      },
      set: function(v) {
        this.defaultContext[prop] = v;
      },
      enumerable: true
    });
  }

  // App should act like it's default context.
  var passThroughproperties = ['dirty', 'autosaveInterval', 'autosave', 'storageEnabled'];
  passThroughproperties.forEach(copyProperty.bind(this));
}

// App should act like it's default context.
App.prototype = Object.create(Context.prototype);

util.extend(App.prototype, {
  /**
   *
   * @param opts
   * @param opts.name - Name of the context.
   */
  context: function(opts) {
    var name = opts.name;
    if (!name) throw new Error('Context must have a name (used in creating the PouchDB database).');

    var context = new Context(name, this),
      collectionNames = this.collectionRegistry.collectionNames,
      collections = {};
    collectionNames.forEach(function(collectionName) {
      var newCollection = context.collection(collectionName),
        existingCollection = this.collectionRegistry[collectionName];
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
  }
});

module.exports = App;
