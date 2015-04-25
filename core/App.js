var CollectionRegistry = require('./collectionRegistry'),
  events = require('./events'),
  modelEvents = require('./modelEvents'),
  Cache = require('./cache'),
  util = require('./util'),
  error = require('./error'),
  Collection = require('./collection');

function App(name) {
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
  reset: function() {
    this.removeAllListeners();
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
};

module.exports = App;
