var CollectionRegistry = require('./collectionRegistry'),
  events = require('./events'),
  modelEvents = require('./modelEvents'),
  Cache = require('./cache'),
  util = require('./util'),
  Model = require('./model'),
  error = require('./error'),
  Collection = require('./collection');

function App(name) {
  if (!name) throw new Error('App must have a name');
  this.collectionRegistry = new CollectionRegistry();
  this.cache = new Cache();
  this.name = name;
  this.events = events();

  util.extend(this, {
    on: this.events.on.bind(this.events),
    off: this.events.removeListener.bind(this.events),
    once: this.events.once.bind(this.events),
    removeAllListeners: this.events.removeAllListeners.bind(this.events)
  });
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
    var allModels = this.collectionRegistry.collectionNames.reduce(function(memo, collectionName) {
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
      var coll = siesta[collName];
      Object.keys(coll._models).forEach(function(modelName) {
        var model = coll[modelName];
        memo.push(model._storageEnabled);
      });
      return memo;
    }, []);
    this.removeAllListeners();
    if (siesta.ext.storageEnabled) {
      resetStorage = resetStorage === undefined ? true : resetStorage;
      if (resetStorage) {
        siesta.ext.storage._reset(cb);
        siesta.setPouch(new PouchDB('siesta', {auto_compaction: true, adapter: 'memory'}));
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
