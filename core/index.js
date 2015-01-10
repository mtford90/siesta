var util = require('./util'),
    CollectionRegistry = require('./collectionRegistry').CollectionRegistry,
    Collection = require('./collection'),
    cache = require('./cache'),
    Model = require('./model'),
    events = require('./events'),
    RelationshipType = require('./RelationshipType'),
    ReactiveQuery = require('./reactiveQuery'),
    modelEvents = require('./modelEvents'),
    Query = require('./Query'),
    log = require('./log'),
    _ = util._;


if (window.Q) window.q = window.Q;


// Initialise siesta object. Strange format facilities using submodules with requireJS.
var siesta = function (ext) {
    if (!siesta.ext) siesta.ext = {};
    _.extend(siesta.ext, ext || {});
    return siesta;
};

// Notifications
_.extend(siesta, {
    on: events.on.bind(events),
    off: events.removeListener.bind(events),
    once: events.once.bind(events),
    removeAllListeners: events.removeAllListeners.bind(events)
});
_.extend(siesta, {
    removeListener: siesta.off,
    addListener: siesta.on
});

// Expose some stuff for usage by extensions and/or users
_.extend(siesta, {
    RelationshipType: RelationshipType,
    ModelEventType: modelEvents.ModelEventType,
    log: log.Level,
    InsertionPolicy: ReactiveQuery.InsertionPolicy,
    _internal: {
        log: log,
        Model: Model,
        model: require('./model'),
        error: require('./error'),
        ModelEventType: modelEvents.ModelEventType,
        siestaModel: require('./modelInstance'),
        extend: require('extend'),
        events: require('./events'),
        cache: require('./cache'),
        modelEvents: modelEvents,
        CollectionRegistry: require('./collectionRegistry').CollectionRegistry,
        Collection: Collection,
        utils: util,
        util: util,
        _: util._,
        query: require('./query'),
        store: require('./store')
    },
    _: util._,
    async: util.async,
    isArray: util.isArray,
    isString: util.isString
});

siesta.ext = {};

var installed = false,
    installing = false;

_.extend(siesta, {
    /**
     * Wipe everything. Used during test generally.
     */
    reset: function (cb) {
        installed = false;
        installing = false;
        delete this.queuedTasks;
        cache.reset();
        CollectionRegistry.reset();
        events.removeAllListeners();
        siesta.ext.http.DescriptorRegistry.reset();
        if (siesta.ext.storageEnabled) {
            siesta.ext.storage._reset(cb);
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
    collection: function (name, opts) {
        return new Collection(name, opts);
    },
    /**
     * Install all collections.
     * @param {Function} [cb]
     * @returns {q.Promise}
     */
    install: function (cb) {
        installing = true;
        var deferred = util.defer(cb);
        cb = deferred.finish.bind(deferred);
        var collectionNames = CollectionRegistry.collectionNames,
            collectionInstallTasks = _.map(collectionNames, function (n) {
                return function (done) {
                    CollectionRegistry[n].install(done);
                }
            });
        var self = this;
        siesta.async.series(collectionInstallTasks, function (err) {
            if (err) {
                installing = false;
                cb(err);
            }
            else {
                var ensureSingletons = function (err) {
                    if (!err) {
                        var ensureSingletonTasks = [];
                        for (var i = 0; i < collectionNames.length; i++) {
                            var collection = CollectionRegistry[collectionNames[i]],
                                modelNames = Object.keys(collection._models);
                            for (var j = 0; j < modelNames.length; j++) {
                                var modelName = modelNames[j],
                                    model = collection[modelName];
                                var fn = function (done) {
                                    this.ensureSingletons(done);
                                }.bind(model);
                                ensureSingletonTasks.push(fn);
                            }
                        }
                        siesta.async.parallel(ensureSingletonTasks, function (err, res) {
                            if (!err) {
                                installed = true;
                                if (self.queuedTasks) self.queuedTasks.execute();
                            }
                            installing = false;
                            cb(err, res);
                        });
                    }
                    else {
                        installing = false;
                        cb(err);
                    }
                };
                if (siesta.ext.storageEnabled) {
                    // Load models from PouchDB.
                    siesta.ext.storage._load(ensureSingletons);
                }
                else {
                    ensureSingletons();
                }
            }
        });

        return deferred.promise;
    },
    _pushTask: function (task) {
        if (!this.queuedTasks) {
            this.queuedTasks = new function Queue() {
                this.tasks = [];
                this.execute = function () {
                    this.tasks.forEach(function (f) {f()});
                    this.tasks = [];
                }.bind(this);
            };
        }
        this.queuedTasks.tasks.push(task);
    },
    _afterInstall: function (task) {
        if (!installed) {
            if (!installing) {
                this.install(function (err) {
                    if (err) console.error('Error setting up siesta', err);
                    delete this.queuedTasks;
                }.bind(this));
            }
            // In case installed straight away e.g. if storage extension not installed.
            if (!installed) this._pushTask(task);
            else task();
        }
        else {
            task();
        }
    },
    setLogLevel: function (loggerName, level) {
        var Logger = log.loggerWithName(loggerName);
        Logger.setLevel(level);
    },
    notify: util.next,
    registerComparator: Query.bind(Query)
});

Object.defineProperties(siesta, {
    _canChange: {
        get: function () {
            return !(installing || installed);
        }
    }
});

if (typeof window != 'undefined') {
    window.siesta = siesta;
}

module.exports = siesta;