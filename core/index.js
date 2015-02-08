(function () {
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
        log = require('./log'),
        _ = util._;

    util._patchBind();

    // Initialise siesta object. Strange format facilities using submodules with requireJS (eventually)
    var siesta = function (ext) {
        if (!siesta.ext) siesta.ext = {};
        _.extend(siesta.ext, ext || {});
        return siesta;
    };

    Object.defineProperty(siesta, 'q', {
        get: function () {
            return this._q || window.q || window.Q
        },
        set: function (q) {
            this._q = q;
        }
    });

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
            _: util._,
            querySet: querySet,
            observe: require('../vendor/observe-js/src/observe'),
            Query: Query,
            Store: require('./store'),
            ManyToManyProxy: ManyToManyProxy,
            OneToManyProxy: OneToManyProxy,
            OneToOneProxy: OneToOneProxy,
            RelationshipProxy: RelationshipProxy
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
            if (!installing && !installed) {
                return util.promise(cb, function (cb) {
                    installing = true;
                    var collectionNames = CollectionRegistry.collectionNames,
                        tasks = _.map(collectionNames, function (n) {
                            return CollectionRegistry[n].install.bind(CollectionRegistry[n]);
                        }),
                        storageEnabled = siesta.ext.storageEnabled;
                    if (storageEnabled) tasks = tasks.concat([siesta.ext.storage.ensureIndexesForAll, siesta.ext.storage._load]);
                    tasks.push(function (done) {
                        installed = true;
                        if (this.queuedTasks) this.queuedTasks.execute();
                        done();
                    }.bind(this));
                    siesta.async.series(tasks, cb);
                }.bind(this));
            }
            else cb(error('already installing'));
        },
        _pushTask: function (task) {
            if (!this.queuedTasks) {
                this.queuedTasks = new function Queue() {
                    this.tasks = [];
                    this.execute = function () {
                        this.tasks.forEach(function (f) {
                            f()
                        });
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
        registerComparator: Query.registerComparator.bind(Query)
    });

    Object.defineProperties(siesta, {
        _canChange: {
            get: function () {
                return !(installing || installed);
            }
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

})();