var util = require('./util'),
  CollectionRegistry = require('./collectionRegistry').CollectionRegistry,
  Collection = require('./collection'),
  cache = require('./cache'),
  Model = require('./model'),
  error = require('./error'),
  events = require('./events'),
  RelationshipType = require('./RelationshipType'),
  ReactiveQuery = require('./ReactiveQuery'),
  ManyToManyProxy = require('./ManyToManyProxy'),
  OneToOneProxy = require('./OneToOneProxy'),
  OneToManyProxy = require('./OneToManyProxy'),
  RelationshipProxy = require('./RelationshipProxy'),
  modelEvents = require('./modelEvents'),
  Query = require('./Query'),
  querySet = require('./QuerySet'),
  Condition = require('./Condition'),
  log = require('./log');

util._patchBind();

// Initialise siesta object. Strange format facilities using submodules with requireJS (eventually)
var siesta = function(ext) {
  if (!siesta.ext) siesta.ext = {};
  util.extend(siesta.ext, ext || {});
  return siesta;
};

// Notifications
util.extend(siesta, {
  on: events.on.bind(events),
  off: events.removeListener.bind(events),
  once: events.once.bind(events),
  removeAllListeners: events.removeAllListeners.bind(events)
});

util.extend(siesta, {
  removeListener: siesta.off,
  addListener: siesta.on
});

// Expose some stuff for usage by extensions and/or users
util.extend(siesta, {
  RelationshipType: RelationshipType,
  ModelEventType: modelEvents.ModelEventType,
  log: log.Level,
  InsertionPolicy: ReactiveQuery.InsertionPolicy,
  _internal: {
    log: log,
    Condition: Condition,
    Model: Model,
    error: error,
    ModelEventType: modelEvents.ModelEventType,
    ModelInstance: require('./ModelInstance'),
    extend: require('extend'),
    MappingOperation: require('./mappingOperation'),
    events: events,
    ProxyEventEmitter: events.ProxyEventEmitter,
    cache: require('./cache'),
    modelEvents: modelEvents,
    CollectionRegistry: require('./collectionRegistry').CollectionRegistry,
    Collection: Collection,
    utils: util,
    util: util,
    querySet: querySet,
    observe: require('../vendor/observe-js/src/observe'),
    Query: Query,
    ManyToManyProxy: ManyToManyProxy,
    OneToManyProxy: OneToManyProxy,
    OneToOneProxy: OneToOneProxy,
    RelationshipProxy: RelationshipProxy
  },
  isArray: util.isArray,
  isString: util.isString
});

siesta.ext = {};



util.extend(siesta, {
  /**
   * Wipe everything. Used during test generally.
   */
  reset: function(cb, resetStorage) {
    delete this.queuedTasks;
    cache.reset();
    CollectionRegistry.reset();
    var collectionNames = CollectionRegistry.collectionNames;
    collectionNames.reduce(function(memo, collName) {
      var coll = siesta[collName];
      Object.keys(coll._models).forEach(function(modelName) {
        var model = coll[modelName];
        memo.push(model._storageEnabled);
      });
      return memo;
    }, []);
    events.removeAllListeners();
    if (siesta.ext.storageEnabled) {
      resetStorage = resetStorage === undefined ? true : resetStorage;
      if (resetStorage) siesta.ext.storage._reset(cb);
      else cb();
    }
    else {
      cb();
    }
  },
  /**
   * Creates and registers a new Collection.
   * @param  {String} name
   * @param  {Object} [opts]
   * @return {Collection}
   */
  collection: function(name, opts) {
    return new Collection(name, opts);
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
  setLogLevel: function(loggerName, level) {
    var Logger = log.loggerWithName(loggerName);
    Logger.setLevel(level);
  },
  graph: function(data, opts, cb) {
    if (typeof opts == 'function') cb = opts;
    opts = opts || {};
    return util.promise(cb, function(cb) {
      var tasks = [], err;
      for (var collectionName in data) {
        if (data.hasOwnProperty(collectionName)) {
          var collection = CollectionRegistry[collectionName];
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
  notify: util.next,
  registerComparator: Query.registerComparator.bind(Query),
  count: function() {
    return cache.count();
  },
  get: function(id, cb) {
    return util.promise(cb, function(cb) {
      cb(null, cache._localCache()[id]);
    }.bind(this));
  },
  removeAll: function(cb) {
    return util.promise(cb, function(cb) {
      util.Promise.all(
        CollectionRegistry.collectionNames.map(function(collectionName) {
          return CollectionRegistry[collectionName].removeAll();
        }.bind(this))
      ).then(function() {
          cb(null);
        }).catch(cb)
    }.bind(this));
  }
});


if (typeof window != 'undefined') {
  window['siesta'] = siesta;
}

siesta.log = require('debug');

module.exports = siesta;

(function loadExtensions() {
  require('../storage');
})();
