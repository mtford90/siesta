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

function App(name) {
  if (!name) throw new Error('App must have a name');
  this.collectionRegistry = new CollectionRegistry();
  this.cache = new Cache();
  this.name = name;
  var storage = new Storage(this);

  this.events = events();
  var off = this.events.removeListener.bind(this.events);
  util.extend(this, {
    on: this.events.on.bind(this.events),
    off: off,
    removeListener: off,
    once: this.events.once.bind(this.events),
    removeAllListeners: this.events.removeAllListeners.bind(this.events),
    notify: util.next,
    registerComparator: Query.registerComparator.bind(Query)
  });

  this.storage = storage;

  util.extend(this, {
    save: this.storage.save.bind(this.storage),
    setPouch: function(p) {
      storage.pouch = p;
    }
  });

  var interval, saving, autosaveInterval = 500;
  var storageEnabled;

  Object.defineProperties(this, {
    dirty: {
      get: function() {
        var unsavedObjectsByCollection = storage._unsavedObjectsByCollection;
        return !!Object.keys(storage.unsavedObjectsByCollection).length;
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

  if (typeof PouchDB == 'undefined') {
    this.storageEnabled = false;
    console.warn('PouchDB is not present therefore storage is disabled.');
  }

}

App.prototype = {
  collection: function(name, opts) {
    opts = opts || {};
    opts.app = this;
    return new Collection(name, opts);
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

module.exports = App;
