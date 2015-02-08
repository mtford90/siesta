(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
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
},{"../storage":52,"../vendor/observe-js/src/observe":53,"./ManyToManyProxy":3,"./ModelInstance":4,"./OneToManyProxy":5,"./OneToOneProxy":6,"./Query":7,"./QuerySet":8,"./ReactiveQuery":9,"./RelationshipProxy":10,"./RelationshipType":11,"./cache":12,"./collection":13,"./collectionRegistry":14,"./error":15,"./events":16,"./log":18,"./mappingOperation":19,"./model":20,"./modelEvents":21,"./store":22,"./util":24,"debug":30,"extend":33}],2:[function(require,module,exports){
/**
 * Solves the common problem of maintaining the order of a set of a models and querying on that order.
 *
 * The same as ReactiveQuery but enables manual reordering of models and maintains an index field.
 */

(function () {

    var ReactiveQuery = require('./ReactiveQuery'),
        log = require('./log')('query'),
        util = require('./util'),
        error = require('./error'),
        modelEvents = require('./modelEvents'),
        InternalSiestaError = error.InternalSiestaError,
        constructQuerySet = require('./QuerySet'),
        _ = util._;

    function ArrangedReactiveQuery(query) {
        ReactiveQuery.call(this, query);
        this.indexAttribute = 'index';
    }

    ArrangedReactiveQuery.prototype = Object.create(ReactiveQuery.prototype);

    _.extend(ArrangedReactiveQuery.prototype, {
        _refreshIndexes: function () {
            var results = this.results,
                indexAttribute = this.indexAttribute;
            if (!results) throw new InternalSiestaError('ArrangedReactiveQuery must be initialised');
            for (var i = 0; i < results.length; i++) {
                var modelInstance = results[i];
                modelInstance[indexAttribute] = i;
            }
        },
        _mergeIndexes: function () {
            var results = this.results,
                newResults = [],
                outOfBounds = [],
                unindexed = [];
            for (var i = 0; i < results.length; i++) {
                var res = results[i],
                    storedIndex = res[this.indexAttribute];
                if (storedIndex == undefined) { // null or undefined
                    unindexed.push(res);
                }
                else if (storedIndex > results.length) {
                    outOfBounds.push(res);
                }
                else {
                    // Handle duplicate indexes
                    if (!newResults[storedIndex]) {
                        newResults[storedIndex] = res;
                    }
                    else {
                        unindexed.push(res);
                    }
                }
            }
            outOfBounds = _.sortBy(outOfBounds, function (x) {
                return x[this.indexAttribute];
            }.bind(this));
            // Shift the index of all models with indexes out of bounds into the correct range.
            for (i = 0; i < outOfBounds.length; i++) {
                res = outOfBounds[i];
                var resultsIndex = this.results.length - outOfBounds.length + i;
                res[this.indexAttribute] = resultsIndex;
                newResults[resultsIndex] = res;
            }
            unindexed = this._query._sortResults(unindexed);
            var n = 0;
            while (unindexed.length) {
                res = unindexed.shift();
                while (newResults[n]) {
                    n++;
                }
                newResults[n] = res;
                res[this.indexAttribute] = n;
            }

            this.results = constructQuerySet(newResults, this.model);
        },
        init: function (cb) {
            return util.promise(cb, function (cb) {
                ReactiveQuery.prototype.init.call(this, function (err) {
                    if (!err) {
                        if (!this.model.hasAttributeNamed(this.indexAttribute)) {
                            err = error('Model "' + this.model.name + '" does not have an attribute named "' + this.indexAttribute + '"');
                        }
                        else {
                            this._mergeIndexes();
                            this._query.clearOrdering();
                        }
                    }
                    cb(err, err ? null : this.results);
                }.bind(this));
            }.bind(this));
        },
        _handleNotif: function (n) {
            // We don't want to keep executing the query each time the index event fires as we're changing the index ourselves
            if (n.field != this.indexAttribute) {
                ReactiveQuery.prototype._handleNotif.call(this, n);
                this._refreshIndexes();
            }
        },
        validateIndex: function (idx) {
            var maxIndex = this.results.length - 1,
                minIndex = 0;
            if (!(idx >= minIndex && idx <= maxIndex)) {
                throw new Error('Index ' + idx.toString() + ' is out of bounds');
            }
        },
        swapObjectsAtIndexes: function (from, to) {
            //noinspection UnnecessaryLocalVariableJS
            this.validateIndex(from);
            this.validateIndex(to);
            var fromModel = this.results[from],
                toModel = this.results[to];
            if (!fromModel) {
                throw new Error('No model at index "' + from.toString() + '"');
            }
            if (!toModel) {
                throw new Error('No model at index "' + to.toString() + '"');
            }
            this.results[to] = fromModel;
            this.results[from] = toModel;
            fromModel[this.indexAttribute] = to;
            toModel[this.indexAttribute] = from;
        },
        swapObjects: function (obj1, obj2) {
            var fromIdx = this.results.indexOf(obj1),
                toIdx = this.results.indexOf(obj2);
            this.swapObjectsAtIndexes(fromIdx, toIdx);
        },
        move: function (from, to) {
            this.validateIndex(from);
            this.validateIndex(to);
            var results = this.results.mutableCopy();
            (function (oldIndex, newIndex) {
                if (newIndex >= this.length) {
                    var k = newIndex - this.length;
                    while ((k--) + 1) {
                        this.push(undefined);
                    }
                }
            }).call(results, from, to);
            var removed = results.splice(from, 1)[0];
            this.results = results.asModelQuerySet(this.model);
            this.emit('change', {
                index: from,
                removed: [removed],
                type: modelEvents.ModelEventType.Splice,
                obj: this,
                field: 'results'
            });
            results.splice(to, 0, removed);
            this.results = results.asModelQuerySet(this.model);
            this.emit('change', {
                index: to,
                added: [removed],
                type: modelEvents.ModelEventType.Splice,
                obj: this,
                field: 'results'
            });
            this._refreshIndexes();
        }
    });

    module.exports = ArrangedReactiveQuery;
})();
},{"./QuerySet":8,"./ReactiveQuery":9,"./error":15,"./log":18,"./modelEvents":21,"./util":24}],3:[function(require,module,exports){
(function () {
    /**
     * @module relationships
     */

    var RelationshipProxy = require('./RelationshipProxy'),
        Store = require('./store'),
        util = require('./util'),
        _ = util._,
        InternalSiestaError = require('./error').InternalSiestaError,
        modelEvents = require('./modelEvents'),
        events = require('./events'),
        wrapArrayForAttributes = events.wrapArray,
        SiestaModel = require('./ModelInstance'),
        ArrayObserver = require('../vendor/observe-js/src/observe').ArrayObserver,
        ModelEventType = require('./modelEvents').ModelEventType;

    /**
     * [ManyToManyProxy description]
     * @param {Object} opts
     */
    function ManyToManyProxy(opts) {
        RelationshipProxy.call(this, opts);
        this.related = [];
        this.relatedCancelListeners = {};
    }

    ManyToManyProxy.prototype = Object.create(RelationshipProxy.prototype);

    _.extend(ManyToManyProxy.prototype, {
        clearReverse: function (removed) {
            var self = this;
            _.each(removed, function (removedObject) {
                var reverseProxy = self.reverseProxyForInstance(removedObject);
                var idx = reverseProxy.related.indexOf(self.object);
                reverseProxy.makeChangesToRelatedWithoutObservations(function () {
                    reverseProxy.splice(idx, 1);
                });
            });
        },
        setReverseOfAdded: function (added) {
            var self = this;
            _.each(added, function (addedObject) {
                var reverseProxy = self.reverseProxyForInstance(addedObject);
                reverseProxy.makeChangesToRelatedWithoutObservations(function () {
                    reverseProxy.splice(0, 0, self.object);
                });
            });
        },
        wrapArray: function (arr) {
            var self = this;
            wrapArrayForAttributes(arr, this.reverseName, this.object);
            if (!arr.arrayObserver) {
                arr.arrayObserver = new ArrayObserver(arr);
                var observerFunction = function (splices) {
                    splices.forEach(function (splice) {
                        var added = splice.addedCount ? arr.slice(splice.index, splice.index + splice.addedCount) : [];
                        var removed = splice.removed;
                        self.clearReverse(removed);
                        self.setReverseOfAdded(added);
                        var model = self.getForwardModel();
                        modelEvents.emit({
                            collection: model.collectionName,
                            model: model.name,
                            _id: self.object._id,
                            field: self.getForwardName(),
                            removed: removed,
                            added: added,
                            type: ModelEventType.Splice,
                            index: splice.index,
                            obj: self.object
                        });
                    });
                };
                arr.arrayObserver.open(observerFunction);
            }
        },
        get: function (cb) {
            return util.promise(cb, function (cb) {
                cb(null, this.related);
            }.bind(this));
        },
        validate: function (obj) {
            if (Object.prototype.toString.call(obj) != '[object Array]') {
                return 'Cannot assign scalar to many to many';
            }
            return null;
        },
        set: function (obj, opts) {
            this.checkInstalled();
            var self = this;
            if (obj) {
                var errorMessage;
                if (errorMessage = this.validate(obj)) {
                    return errorMessage;
                }
                else {
                    this.clearReverseRelated(opts);
                    self.setIdAndRelated(obj, opts);
                    this.wrapArray(obj);
                    self.setIdAndRelatedReverse(obj, opts);
                }
            }
            else {
                this.clearReverseRelated(opts);
                self.setIdAndRelated(obj, opts);
            }
        },
        install: function (obj) {
            RelationshipProxy.prototype.install.call(this, obj);
            this.wrapArray(this.related);
            obj[('splice' + util.capitaliseFirstLetter(this.reverseName))] = _.bind(this.splice, this);
        },
        registerRemovalListener: function (obj) {
            this.relatedCancelListeners[obj._id] = obj.listen(function (e) {

            }.bind(this));
        }
    });


    module.exports = ManyToManyProxy;
})();
},{"../vendor/observe-js/src/observe":53,"./ModelInstance":4,"./RelationshipProxy":10,"./error":15,"./events":16,"./modelEvents":21,"./store":22,"./util":24}],4:[function(require,module,exports){
(function () {
    var log = require('./log'),
        util = require('./util'),
        _ = util._,
        error = require('./error'),
        InternalSiestaError = error.InternalSiestaError,
        modelEvents = require('./modelEvents'),
        events = require('./events'),
        cache = require('./cache');

    function ModelInstance(model) {
        var self = this;
        this.model = model;

        util.subProperties(this, this.model, [
            'collection',
            'collectionName',
            '_attributeNames',
            {
                name: 'idField',
                property: 'id'
            },
            {
                name: 'modelName',
                property: 'name'
            }
        ]);

        events.ProxyEventEmitter.call(this);

        Object.defineProperties(this, {
            _relationshipNames: {
                get: function () {
                    var proxies = _.map(Object.keys(self.__proxies || {}), function (x) {
                        return self.__proxies[x]
                    });
                    return _.map(proxies, function (p) {
                        if (p.isForward) {
                            return p.forwardName;
                        } else {
                            return p.reverseName;
                        }
                    });
                },
                enumerable: true,
                configurable: true
            },
            dirty: {
                get: function () {
                    if (siesta.ext.storageEnabled) {
                        return self._id in siesta.ext.storage._unsavedObjectsHash;
                    }
                    else return undefined;
                },
                enumerable: true
            },
            // This is for ProxyEventEmitter.
            event: {
                get: function () {
                    return this._id
                }
            }
        });

        this.removed = false;
    }

    ModelInstance.prototype = Object.create(events.ProxyEventEmitter.prototype);

    _.extend(ModelInstance.prototype, {
        get: function (cb) {
            return util.promise(cb, function (cb) {
                cb(null, this);
            }.bind(this));
        },
        emit: function (type, opts) {
            if (typeof type == 'object') opts = type;
            else opts.type = type;
            opts = opts || {};
            _.extend(opts, {
                collection: this.collectionName,
                model: this.model.name,
                _id: this._id,
                obj: this
            });
            modelEvents.emit(opts);
        },
        remove: function (cb, notification) {
            notification = notification == null ? true : notification;
            return util.promise(cb, function (cb) {
                cache.remove(this);
                this.removed = true;
                if (notification) {
                    this.emit(modelEvents.ModelEventType.Remove, {
                        old: this
                    });
                }
                var remove = this.model.remove;
                if (remove) {
                    var paramNames = util.paramNames(remove);
                    if (paramNames.length) {
                        var self = this;
                        remove.call(this, function (err) {
                            cb(err, self);
                        });
                    }
                    else {
                        remove.call(this);
                        cb(null, this);
                    }
                }
                else {
                    cb(null, this);
                }
            }.bind(this));
        },
        restore: function (cb) {
            return util.promise(cb, function (cb) {
                var _finish = function (err) {
                    if (!err) {
                        this.emit(modelEvents.ModelEventType.New, {
                            new: this
                        });
                    }
                    cb(err, this);
                }.bind(this);
                if (this.removed) {
                    cache.insert(this);
                    this.removed = false;
                    var init = this.model.init;
                    if (init) {
                        var paramNames = util.paramNames(init);
                        var fromStorage = true;
                        if (paramNames.length > 1) {
                            init.call(this, fromStorage, _finish);
                        }
                        else {
                            init.call(this, fromStorage);
                            _finish();
                        }
                    }
                    else {
                        _finish();
                    }
                }
            }.bind(this));
        }
    });

    // Inspection
    _.extend(ModelInstance.prototype, {
        getAttributes: function () {
            return _.extend({}, this.__values);
        },
        isInstanceOf: function (model) {
            return this.model == model;
        },
        isA: function (model) {
            return this.model == model || this.model.isDescendantOf(model);
        }
    });

    // Dump
    _.extend(ModelInstance.prototype, {
        _dumpString: function (reverseRelationships) {
            return JSON.stringify(this._dump(reverseRelationships, null, 4));
        },
        _dump: function (reverseRelationships) {
            var dumped = _.extend({}, this.__values);
            dumped._rev = this._rev;
            dumped._id = this._id;
            return dumped;
        }
    });

    module.exports = ModelInstance;


})();
},{"./cache":12,"./error":15,"./events":16,"./log":18,"./modelEvents":21,"./util":24}],5:[function(require,module,exports){
(function () {
    var RelationshipProxy = require('./RelationshipProxy'),
        Store = require('./store'),
        util = require('./util'),
        _ = util._,
        InternalSiestaError = require('./error').InternalSiestaError,
        modelEvents = require('./modelEvents'),
        events = require('./events'),
        wrapArrayForAttributes = events.wrapArray,
        ArrayObserver = require('../vendor/observe-js/src/observe').ArrayObserver,
        ModelEventType = require('./modelEvents').ModelEventType;

    /**
     * @class  [OneToManyProxy description]
     * @constructor
     * @param {[type]} opts
     */
    function OneToManyProxy(opts) {
        RelationshipProxy.call(this, opts);
        if (this.isReverse) this.related = [];
    }

    OneToManyProxy.prototype = Object.create(RelationshipProxy.prototype);

    _.extend(OneToManyProxy.prototype, {
        clearReverse: function (removed) {
            var self = this;
            _.each(removed, function (removedObject) {
                var reverseProxy = self.reverseProxyForInstance(removedObject);
                reverseProxy.setIdAndRelated(null);
            });
        },
        setReverseOfAdded: function (added) {
            var self = this;
            _.each(added, function (added) {
                var forwardProxy = self.reverseProxyForInstance(added);
                forwardProxy.setIdAndRelated(self.object);
            });
        },
        wrapArray: function (arr) {
            var self = this;
            wrapArrayForAttributes(arr, this.reverseName, this.object);
            if (!arr.arrayObserver) {
                arr.arrayObserver = new ArrayObserver(arr);
                var observerFunction = function (splices) {
                    splices.forEach(function (splice) {
                        var added = splice.addedCount ? arr.slice(splice.index, splice.index + splice.addedCount) : [];
                        var removed = splice.removed;
                        self.clearReverse(removed);
                        self.setReverseOfAdded(added);
                        var model = self.getForwardModel();
                        modelEvents.emit({
                            collection: model.collectionName,
                            model: model.name,
                            _id: self.object._id,
                            field: self.getForwardName(),
                            removed: removed,
                            added: added,
                            type: ModelEventType.Splice,
                            index: splice.index,
                            obj: self.object
                        });
                    });
                };
                arr.arrayObserver.open(observerFunction);
            }
        },
        get: function (cb) {
            return util.promise(cb, function (cb) {
                cb(null, this.related);
            }.bind(this));
        },
        /**
         * Validate the object that we're setting
         * @param obj
         * @returns {string|null} An error message or null
         * @class OneToManyProxy
         */
        validate: function (obj) {
            var str = Object.prototype.toString.call(obj);
            if (this.isForward) {
                if (str == '[object Array]') {
                    return 'Cannot assign array forward oneToMany (' + str + '): ' + this.forwardName;
                }
            }
            else {
                if (str != '[object Array]') {
                    return 'Cannot scalar to reverse oneToMany (' + str + '): ' + this.reverseName;
                }
            }
            return null;
        },
        set: function (obj, opts) {
            this.checkInstalled();
            var self = this;
            if (obj) {
                var errorMessage;
                if (errorMessage = this.validate(obj)) {
                    return errorMessage;
                }
                else {
                    this.clearReverseRelated(opts);
                    self.setIdAndRelated(obj, opts);
                    if (self.isReverse) {
                        this.wrapArray(self.related);
                    }
                    self.setIdAndRelatedReverse(obj, opts);
                }
            }
            else {
                this.clearReverseRelated(opts);
                self.setIdAndRelated(obj, opts);
            }
        },
        install: function (obj) {
            RelationshipProxy.prototype.install.call(this, obj);

            if (this.isReverse) {
                obj[('splice' + util.capitaliseFirstLetter(this.reverseName))] = _.bind(this.splice, this);
                this.wrapArray(this.related);
            }

        }
    });


    module.exports = OneToManyProxy;
})();
},{"../vendor/observe-js/src/observe":53,"./RelationshipProxy":10,"./error":15,"./events":16,"./modelEvents":21,"./store":22,"./util":24}],6:[function(require,module,exports){
(function () {
    var RelationshipProxy = require('./RelationshipProxy'),
        util = require('./util'),
        _ = util._,
        SiestaModel = require('./ModelInstance');

    /**
     * [OneToOneProxy description]
     * @param {Object} opts
     */
    function OneToOneProxy(opts) {
        RelationshipProxy.call(this, opts);
    }


    OneToOneProxy.prototype = Object.create(RelationshipProxy.prototype);

    _.extend(OneToOneProxy.prototype, {
        /**
         * Validate the object that we're setting
         * @param obj
         * @returns {string|null} An error message or null
         */
        validate: function (obj) {
            if (Object.prototype.toString.call(obj) == '[object Array]') {
                return 'Cannot assign array to one to one relationship';
            }
            else if ((!obj instanceof SiestaModel)) {

            }
            return null;
        },
        set: function (obj, opts) {
            this.checkInstalled();
            if (obj) {
                var errorMessage;
                if (errorMessage = this.validate(obj)) {
                    return errorMessage;
                }
                else {
                    this.clearReverseRelated(opts);
                    this.setIdAndRelated(obj, opts);
                    this.setIdAndRelatedReverse(obj, opts);
                }
            }
            else {
                this.clearReverseRelated(opts);
                this.setIdAndRelated(obj, opts);
            }
        },
        get: function (cb) {
            return util.promise(cb, function (cb) {
                cb(null, this.related);
            }.bind(this));
        }
    });


    module.exports = OneToOneProxy;
})();
},{"./ModelInstance":4,"./RelationshipProxy":10,"./util":24}],7:[function(require,module,exports){
(function () {
    var log = require('./log')('query'),
        cache = require('./cache'),
        util = require('./util'),
        error = require('./error'),
        constructQuerySet = require('./QuerySet'),
        _ = util._;

    /**
     * @class [Query description]
     * @param {Model} model
     * @param {Object} query
     */
    function Query(model, query) {
        var opts = {};
        for (var prop in query) {
            if (query.hasOwnProperty(prop)) {
                if (prop.slice(0, 2) == '__') {
                    opts[prop.slice(2)] = query[prop];
                    delete query[prop];
                }
            }
        }
        _.extend(this, {
            model: model,
            query: query,
            opts: opts
        });
        opts.order = opts.order || [];
        if (!util.isArray(opts.order)) opts.order = [opts.order];
    }

    var comparators = {
        e: function (opts) {
            var objectValue = opts.object[opts.field];
            if (log.enabled) {
                var stringValue;
                if (objectValue === null) stringValue = 'null';
                else if (objectValue === undefined) stringValue = 'undefined';
                else stringValue = objectValue.toString();
                log(opts.field + ': ' + stringValue + ' == ' + opts.value.toString());
            }
            return objectValue == opts.value;
        },
        lt: function (opts) {
            if (!opts.invalid) return opts.object[opts.field] < opts.value;
            return false;
        },
        gt: function (opts) {
            if (!opts.invalid) return opts.object[opts.field] > opts.value;
            return false;
        },
        lte: function (opts) {
            if (!opts.invalid) return opts.object[opts.field] <= opts.value;
            return false;
        },
        gte: function (opts) {
            if (!opts.invalid) return opts.object[opts.field] >= opts.value;
            return false;
        },
        contains: function (opts) {
            if (!opts.invalid) {
                var arr = opts.object[opts.field];
                if (util.isArray(arr) || util.isString(arr)) {
                    return arr.indexOf(opts.value) > -1;
                }
            }
            return false;
        }
    };

    _.extend(Query, {
        comparators: comparators,
        registerComparator: function (symbol, fn) {
            if (!comparators[symbol]) {
                comparators[symbol] = fn;
            }
        }
    });

    function cacheForModel(model) {
        var cacheByType = cache._localCacheByType;
        var modelName = model.name;
        var collectionName = model.collectionName;
        var cacheByModel = cacheByType[collectionName];
        var cacheByLocalId;
        if (cacheByModel) {
            cacheByLocalId = cacheByModel[modelName] || {};
        }
        return cacheByLocalId;
    }

    _.extend(Query.prototype, {
        execute: function (cb) {
            return util.promise(cb, function (cb) {
                this._executeInMemory(cb);
            }.bind(this));
        },
        _dump: function (asJson) {
            return asJson ? '{}' : {};
        },
        sortFunc: function (fields) {
            var sortFunc = function (ascending, field) {
                return function (v1, v2) {
                    var d1 = v1[field],
                        d2 = v2[field],
                        res;
                    if (typeof d1 == 'string' || d1 instanceof String &&
                        typeof d2 == 'string' || d2 instanceof String) {
                        res = ascending ? d1.localeCompare(d2) : d2.localeCompare(d1);
                    }
                    else {
                        if (d1 instanceof Date) d1 = d1.getTime();
                        if (d2 instanceof Date) d2 = d2.getTime();
                        if (ascending) res = d1 - d2;
                        else res = d2 - d1;
                    }
                    return res;
                }
            };
            var s = util;
            for (var i = 0; i < fields.length; i++) {
                var field = fields[i];
                s = s.thenBy(sortFunc(field.ascending, field.field));
            }
            return s == util ? null : s;
        },
        _sortResults: function (res) {
            var order = this.opts.order;
            if (res && order) {
                var fields = _.map(order, function (ordering) {
                    var splt = ordering.split('-'),
                        ascending = true,
                        field = null;
                    if (splt.length > 1) {
                        field = splt[1];
                        ascending = false;
                    }
                    else {
                        field = splt[0];
                    }
                    return {field: field, ascending: ascending};
                }.bind(this));
                var sortFunc = this.sortFunc(fields);
                if (res.immutable) res = res.mutableCopy();
                if (sortFunc) res.sort(sortFunc);
            }
            return res;
        },
        /**
         * Return all model instances in the cache.
         * @private
         */
        _getCacheByLocalId: function () {
            return _.reduce(this.model.descendants, function (memo, childModel) {
                return _.extend(memo, cacheForModel(childModel));
            }, _.extend({}, cacheForModel(this.model)));
        },
        _executeInMemory: function (callback) {
            var _executeInMemory = function () {
                var cacheByLocalId = this._getCacheByLocalId();
                var keys = Object.keys(cacheByLocalId);
                var self = this;
                var res = [];
                var err;
                for (var i = 0; i < keys.length; i++) {
                    var k = keys[i];
                    var obj = cacheByLocalId[k];
                    var matches = self.objectMatchesQuery(obj);
                    if (typeof(matches) == 'string') {
                        err = error(matches);
                        break;
                    } else {
                        if (matches) res.push(obj);
                    }
                }
                res = this._sortResults(res);
                if (err) log('Error executing query', err);
                callback(err, err ? null : constructQuerySet(res, this.model));
            }.bind(this);
            if (this.opts.ignoreInstalled) {
                _executeInMemory();
            }
            else {
                siesta._afterInstall(_executeInMemory);
            }

        },
        clearOrdering: function () {
            this.opts.order = null;
        },
        objectMatchesOrQuery: function (obj, orQuery) {
            for (var idx in orQuery) {
                if (orQuery.hasOwnProperty(idx)) {
                    var query = orQuery[idx];
                    if (this.objectMatchesBaseQuery(obj, query)) {
                        return true;
                    }
                }
            }
            return false;
        },
        objectMatchesAndQuery: function (obj, andQuery) {
            for (var idx in andQuery) {
                if (andQuery.hasOwnProperty(idx)) {
                    var query = andQuery[idx];
                    if (!this.objectMatchesBaseQuery(obj, query)) {
                        return false;
                    }
                }
            }
            return true;
        },
        splitMatches: function (obj, unprocessedField, value) {
            var op = 'e';
            var fields = unprocessedField.split('.');
            var splt = fields[fields.length - 1].split('__');
            if (splt.length == 2) {
                var field = splt[0];
                op = splt[1];
            }
            else {
                field = splt[0];
            }
            fields[fields.length - 1] = field;
            _.each(fields.slice(0, fields.length - 1), function (f) {
                obj = obj[f];
            });
            // If we get to the point where we're about to index null or undefined we stop - obviously this object does
            // not match the query.
            var notNullOrUndefined = obj != undefined;
            if (notNullOrUndefined) {
                var val = obj[field]; // Breaks here.
                var invalid = val === null || val === undefined;
                var comparator = Query.comparators[op],
                    opts = {object: obj, field: field, value: value, invalid: invalid};
                if (!comparator) {
                    return 'No comparator registered for query operation "' + op + '"';
                }
                return comparator(opts);
            }
            return false;
        },
        objectMatches: function (obj, unprocessedField, value, query) {
            if (unprocessedField == '$or') {
                if (!this.objectMatchesOrQuery(obj, query['$or'])) return false;
            }
            else if (unprocessedField == '$and') {
                if (!this.objectMatchesAndQuery(obj, query['$and'])) return false;
            }
            else {
                var matches = this.splitMatches(obj, unprocessedField, value);
                if (typeof matches != 'boolean') return matches;
                if (!matches) return false;
            }
            return true;
        },
        objectMatchesBaseQuery: function (obj, query) {
            var fields = Object.keys(query);
            for (var i = 0; i < fields.length; i++) {
                var unprocessedField = fields[i],
                    value = query[unprocessedField];
                var rt = this.objectMatches(obj, unprocessedField, value, query);
                if (typeof rt != 'boolean') return rt;
                if (!rt) return false;
            }
            return true;
        },
        objectMatchesQuery: function (obj) {
            return this.objectMatchesBaseQuery(obj, this.query);
        }
    });

    module.exports = Query;
})();
},{"./QuerySet":8,"./cache":12,"./error":15,"./log":18,"./util":24}],8:[function(require,module,exports){
var util = require('./util'),
    Promise = util.Promise,
    error = require('./error'),
    ModelInstance = require('./ModelInstance'),
    _ = require('./util')._;

/*
 TODO: Use ES6 Proxy instead.
 Eventually query sets should use ES6 Proxies which will be much more natural and robust. E.g. no need for the below
 */
var ARRAY_METHODS = ['push', 'sort', 'reverse', 'splice', 'shift', 'unshift'],
    NUMBER_METHODS = ['toString', 'toExponential', 'toFixed', 'toPrecision', 'valueOf'],
    NUMBER_PROPERTIES = ['MAX_VALUE', 'MIN_VALUE', 'NEGATIVE_INFINITY', 'NaN', 'POSITIVE_INFINITY'],
    STRING_METHODS = ['charAt', 'charCodeAt', 'concat', 'fromCharCode', 'indexOf', 'lastIndexOf', 'localeCompare',
        'match', 'replace', 'search', 'slice', 'split', 'substr', 'substring', 'toLocaleLowerCase', 'toLocaleUpperCase',
        'toLowerCase', 'toString', 'toUpperCase', 'trim', 'valueOf'],
    STRING_PROPERTIES = ['length'];

/**
 * Return the property names for a given object. Handles special cases such as strings and numbers that do not have
 * the getOwnPropertyNames function.
 * The special cases are very much hacks. This hack can be removed once the Proxy object is more widely adopted.
 * @param object
 * @returns {Array}
 */
function getPropertyNames(object) {
    var propertyNames;
    if (typeof object == 'string' || object instanceof String) {
        propertyNames = STRING_METHODS.concat(STRING_PROPERTIES);
    }
    else if (typeof object == 'number' || object instanceof Number) {
        propertyNames = NUMBER_METHODS.concat(NUMBER_PROPERTIES);
    }
    else {
        propertyNames = object.getOwnPropertyNames();
    }
    return propertyNames;
}

/**
 * Define a proxy property to attributes on objects in the array
 * @param arr
 * @param prop
 */
function defineAttribute(arr, prop) {
    if (!(prop in arr)) { // e.g. we cannot redefine .length
        Object.defineProperty(arr, prop, {
            get: function () {
                return querySet(_.pluck(arr, prop));
            },
            set: function (v) {
                if (util.isArray(v)) {
                    if (this.length != v.length) throw error({message: 'Must be same length'});
                    for (var i = 0; i < v.length; i++) {
                        this[i][prop] = v[i];
                    }
                }
                else {
                    for (i = 0; i < this.length; i++) {
                        this[i][prop] = v;
                    }
                }
            }
        });
    }
}

function isPromise(obj) {
    // TODO: Don't think this is very robust.
    return obj.then && obj.catch;
}

/**
 * Define a proxy method on the array if not already in existence.
 * @param arr
 * @param prop
 */
function defineMethod(arr, prop) {
    if (!(prop in arr)) { // e.g. we don't want to redefine toString
        arr[prop] = function () {
            var args = arguments,
                res = this.map(function (p) {
                    return p[prop].apply(p, args);
                });
            var arePromises = false;
            if (res.length) arePromises = isPromise(res[0]);
            return arePromises ? Promise.all(res) : querySet(res);
        };
    }
}

/**
 * Transform the array into a query set.
 * Renders the array immutable.
 * @param arr
 * @param model - The model with which to proxy to
 */
function modelQuerySet(arr, model) {
    arr = _.extend([], arr);
    var attributeNames = model._attributeNames,
        relationshipNames = model._relationshipNames,
        names = attributeNames.concat(relationshipNames).concat(instanceMethods);
    names.forEach(_.partial(defineAttribute, arr));
    var instanceMethods = Object.keys(ModelInstance.prototype);
    instanceMethods.forEach(_.partial(defineMethod, arr));
    return renderImmutable(arr);
}

/**
 * Transform the array into a query set, based on whatever is in it.
 * Note that all objects must be of the same type. This function will take the first object and decide how to proxy
 * based on that.
 * @param arr
 */
function querySet(arr) {
    if (arr.length) {
        var referenceObject = arr[0],
            propertyNames = getPropertyNames(referenceObject);
        propertyNames.forEach(function (prop) {
            if (typeof referenceObject[prop] == 'function') defineMethod(arr, prop, arguments);
            else defineAttribute(arr, prop);
        });
    }
    return renderImmutable(arr);
}

function throwImmutableError() {
    throw new Error('Cannot modify a query set');
}

/**
 * Render an array immutable by replacing any functions that can mutate it.
 * @param arr
 */
function renderImmutable(arr) {
    ARRAY_METHODS.forEach(function (p) {
        arr[p] = throwImmutableError;
    });
    arr.immutable = true;
    arr.mutableCopy = arr.asArray = function () {
        var mutableArr = _.map(this, function (x) {return x});
        mutableArr.asQuerySet = function () {
            return querySet(this);
        };
        mutableArr.asModelQuerySet = function (model) {
            return modelQuerySet(this, model);
        };
        return mutableArr;
    };
    return arr;
}

module.exports = modelQuerySet;
},{"./ModelInstance":4,"./error":15,"./util":24}],9:[function(require,module,exports){
/**
 * For those familiar with Apple's Cocoa library, reactive queries roughly map onto NSFetchedResultsController.
 *
 * They present a query set that 'reacts' to changes in the underlying data.
 * @module reactiveQuery
 */


(function () {

    var log = require('./log')('query'),
        Query = require('./Query'),
        EventEmitter = require('events').EventEmitter,
        events = require('./events'),
        modelEvents = require('./modelEvents'),
        InternalSiestaError = require('./error').InternalSiestaError,
        constructQuerySet = require('./QuerySet'),
        util = require('./util'),
        _ = util._;

    /**
     *
     * @param {Query} query - The underlying query
     * @constructor
     */
    function ReactiveQuery(query) {
        var self = this;
        EventEmitter.call(this);

        _.extend(this, {
            _query: query,
            results: constructQuerySet([], query.model),
            insertionPolicy: ReactiveQuery.InsertionPolicy.Back,
            initialised: false
        });

        Object.defineProperties(this, {
            initialized: {
                get: function () {
                    return this.initialised
                }
            },
            model: {
                get: function () {
                    return self._query.model
                }
            },
            collection: {
                get: function () {
                    return self.model.collectionName
                }
            }
        });
    }

    ReactiveQuery.prototype = Object.create(EventEmitter.prototype);

    _.extend(ReactiveQuery, {
        InsertionPolicy: {
            Front: 'Front',
            Back: 'Back'
        }
    });

    _.extend(ReactiveQuery.prototype, {
        /**
         *
         * @param cb
         * @param {bool} _ignoreInit - execute query again, initialised or not.
         * @returns {*}
         */
        init: function (cb, _ignoreInit) {
            if (log) log('init');
            return util.promise(cb, function (cb) {
                if ((!this.initialised) || _ignoreInit) {
                    this._query.execute(function (err, results) {
                        if (!err) {
                            this.results = results;
                            if (!this.handler) {
                                var name = this._constructNotificationName();
                                var handler = function (n) {
                                    this._handleNotif(n);
                                }.bind(this);
                                this.handler = handler;
                                events.on(name, handler);
                            }
                            if (log) log('Listening to ' + name);
                            this.initialised = true;
                            cb(null, this.results);
                        }
                        else {
                            cb(err);
                        }
                    }.bind(this));
                }
                else {
                    cb(null, this.results);
                }
            }.bind(this));
        },
        insert: function (newObj) {
            var results = this.results.mutableCopy();
            if (this.insertionPolicy == ReactiveQuery.InsertionPolicy.Back) {
                var idx = results.push(newObj);
            }
            else {
                idx = results.unshift(newObj);
            }
            this.results = results.asModelQuerySet(this.model);
            return idx;
        },
        /**
         * Execute the underlying query again.
         * @param cb
         */
        update: function (cb) {
            return this.init(cb, true)
        },
        _handleNotif: function (n) {
            log('_handleNotif', n);
            if (n.type == modelEvents.ModelEventType.New) {
                var newObj = n.new;
                if (this._query.objectMatchesQuery(newObj)) {
                    log('New object matches', newObj._dumpString());
                    var idx = this.insert(newObj);
                    this.emit('change', {
                        index: idx,
                        added: [newObj],
                        type: modelEvents.ModelEventType.Splice,
                        obj: this
                    });
                }
                else {
                    log('New object does not match', newObj._dumpString());
                }
            }
            else if (n.type == modelEvents.ModelEventType.Set) {
                newObj = n.obj;
                var index = this.results.indexOf(newObj),
                    alreadyContains = index > -1,
                    matches = this._query.objectMatchesQuery(newObj);
                if (matches && !alreadyContains) {
                    log('Updated object now matches!', newObj._dumpString());
                    idx = this.insert(newObj);
                    this.emit('change', {
                        index: idx,
                        added: [newObj],
                        type: modelEvents.ModelEventType.Splice,
                        obj: this
                    });
                }
                else if (!matches && alreadyContains) {
                    log('Updated object no longer matches!', newObj._dumpString());
                    results = this.results.mutableCopy();
                    var removed = results.splice(index, 1);
                    this.results = results.asModelQuerySet(this.model);
                    this.emit('change', {
                        index: index,
                        obj: this,
                        new: newObj,
                        type: modelEvents.ModelEventType.Splice,
                        removed: removed
                    });
                }
                else if (!matches && !alreadyContains) {
                    log('Does not contain, but doesnt match so not inserting', newObj._dumpString());
                }
                else if (matches && alreadyContains) {
                    log('Matches but already contains', newObj._dumpString());
                    // Send the notification over.
                    this.emit('change', n);
                }
            }
            else if (n.type == modelEvents.ModelEventType.Remove) {
                newObj = n.obj;
                var results = this.results.mutableCopy();
                index = results.indexOf(newObj);
                if (index > -1) {
                    log('Removing object', newObj._dumpString());
                    removed = results.splice(index, 1);
                    this.results = constructQuerySet(results, this.model);
                    this.emit('change', {
                        index: index,
                        obj: this,
                        type: modelEvents.ModelEventType.Splice,
                        removed: removed
                    });
                }
                else {
                    log('No modelEvents neccessary.', newObj._dumpString());
                }
            }
            else {
                throw new InternalSiestaError('Unknown change type "' + n.type.toString() + '"')
            }
            this.results = constructQuerySet(this._query._sortResults(this.results), this.model);
        },
        _constructNotificationName: function () {
            return this.model.collectionName + ':' + this.model.name;
        },
        terminate: function () {
            if (this.handler) {
                events.removeListener(this._constructNotificationName(), this.handler);
            }
            this.results = null;
            this.handler = null;
        },
        listen: function (fn) {
            this.on('change', fn);
            return function () {
                this.removeListener('change', fn);
            }.bind(this);
        },
        listenOnce: function (fn) {
            this.once('change', fn);
        }
    });

    module.exports = ReactiveQuery;
})();
},{"./Query":7,"./QuerySet":8,"./error":15,"./events":16,"./log":18,"./modelEvents":21,"./util":24,"events":29}],10:[function(require,module,exports){
/**
 * Base functionality for relationships.
 * @module relationships
 */
(function () {
    var InternalSiestaError = require('./error').InternalSiestaError,
        Store = require('./store'),
        util = require('./util'),
        _ = util._,
        Query = require('./Query'),
        log = require('./log'),
        cache = require('./cache'),
        events = require('./events'),
        wrapArrayForAttributes = events.wrapArray,
        ArrayObserver = require('../vendor/observe-js/src/observe').ArrayObserver,
        modelEvents = require('./modelEvents'),
        ModelEventType = modelEvents.ModelEventType;

    /**
     * @class  [RelationshipProxy description]
     * @param {Object} opts
     * @constructor
     */
    function RelationshipProxy(opts) {
        var self = this;
        opts = opts || {};

        _.extend(this, {
            object: null,
            related: null
        });

        Object.defineProperties(this, {
            isForward: {
                get: function () {
                    return !self.isReverse;
                },
                set: function (v) {
                    self.isReverse = !v;
                },
                enumerable: true
            }
        });

        util.extendFromOpts(this, opts, {
            reverseModel: null,
            forwardModel: null,
            forwardName: null,
            reverseName: null,
            isReverse: null
        });

        this.cancelListens = {};
    }

    _.extend(RelationshipProxy, {});

    _.extend(RelationshipProxy.prototype, {
        /**
         * Install this proxy on the given instance
         * @param {ModelInstance} modelInstance
         */
        install: function (modelInstance) {
            if (modelInstance) {
                if (!this.object) {
                    this.object = modelInstance;
                    var self = this;
                    var name = this.getForwardName();
                    Object.defineProperty(modelInstance, name, {
                        get: function () {
                            return self.related;
                        },
                        set: function (v) {
                            self.set(v);
                        },
                        configurable: true,
                        enumerable: true
                    });
                    if (!modelInstance.__proxies) modelInstance.__proxies = {};
                    modelInstance.__proxies[name] = this;
                    if (!modelInstance._proxies) {
                        modelInstance._proxies = [];
                    }
                    modelInstance._proxies.push(this);
                } else {
                    throw new InternalSiestaError('Already installed.');
                }
            } else {
                throw new InternalSiestaError('No object passed to relationship install');
            }
        }

    });

    //noinspection JSUnusedLocalSymbols
    _.extend(RelationshipProxy.prototype, {
        set: function (obj, opts) {
            throw new InternalSiestaError('Must subclass RelationshipProxy');
        },
        get: function (callback) {
            throw new InternalSiestaError('Must subclass RelationshipProxy');
        }
    });

    _.extend(RelationshipProxy.prototype, {
        proxyForInstance: function (modelInstance, reverse) {
            var name = reverse ? this.getReverseName() : this.getForwardName(),
                model = reverse ? this.reverseModel : this.forwardModel;
            var ret;
            // This should never happen. Should g   et caught in the mapping operation?
            if (util.isArray(modelInstance)) {
                ret = _.map(modelInstance, function (o) {
                    return o.__proxies[name];
                });
            } else {
                var proxy = modelInstance.__proxies[name];
                if (!proxy) {
                    var err = 'No proxy with name "' + name + '" on mapping ' + model.name;
                    throw new InternalSiestaError(err);
                }
                ret = proxy;
            }
            return ret;
        },
        reverseProxyForInstance: function (modelInstance) {
            return this.proxyForInstance(modelInstance, true);
        },
        getReverseName: function () {
            return this.isForward ? this.reverseName : this.forwardName;
        },
        getForwardName: function () {
            return this.isForward ? this.forwardName : this.reverseName;
        },
        getForwardModel: function () {
            return this.isForward ? this.forwardModel : this.reverseModel;
        },
        clearRemovalListener: function (obj) {
            var _id = obj._id;
            var cancelListen = this.cancelListens[_id];
            // TODO: Remove this check. cancelListen should always exist
            if (cancelListen) {
                cancelListen();
                this.cancelListens[_id] = null;
            }
        },
        listenForRemoval: function (obj) {
            this.cancelListens[obj._id] = obj.listen(function (e) {
                if (e.type == ModelEventType.Remove) {
                    if (util.isArray(this.related)) {
                        var idx = this.related.indexOf(obj);
                        this.splice(idx, 1);
                    }
                    else {
                        this.setIdAndRelated(null);
                    }
                    this.clearRemovalListener(obj);
                }
            }.bind(this));
        },
        /**
         * Configure _id and related with the new related object.
         * @param obj
         * @param {object} [opts]
         * @param {boolean} [opts.disableNotifications]
         * @returns {String|undefined} - Error message or undefined
         */
        setIdAndRelated: function (obj, opts) {
            opts = opts || {};
            if (!opts.disableevents) {
                this.registerSetChange(obj);
            }
            var previouslyRelated = this.related;
            if (previouslyRelated) this.clearRemovalListener(previouslyRelated);
            if (obj) {
                if (util.isArray(obj)) {
                    this.related = obj;
                    obj.forEach(function (_obj) {
                        this.listenForRemoval(_obj);
                    }.bind(this));
                } else {
                    this.related = obj;
                    this.listenForRemoval(obj);
                }
            }
            else {
                this.related = null;
            }
        },
        checkInstalled: function () {
            if (!this.object) {
                throw new InternalSiestaError('Proxy must be installed on an object before can use it.');
            }
        },
        splicer: function (opts) {
            opts = opts || {};
            return function (idx, numRemove) {
                opts = opts || {};
                if (!opts.disableevents) {
                    this.registerSpliceChange.apply(this, arguments);
                }
                var add = Array.prototype.slice.call(arguments, 2);
                return _.partial(this.related.splice, idx, numRemove).apply(this.related, add);
            }.bind(this);
        },
        clearReverseRelated: function (opts) {
            opts = opts || {};
            var self = this;
            if (this.related) {
                var reverseProxy = this.reverseProxyForInstance(this.related);
                var reverseProxies = util.isArray(reverseProxy) ? reverseProxy : [reverseProxy];
                _.each(reverseProxies, function (p) {
                    if (util.isArray(p.related)) {
                        var idx = p.related.indexOf(self.object);
                        p.makeChangesToRelatedWithoutObservations(function () {
                            p.splicer(opts)(idx, 1);
                        });
                    } else {
                        p.setIdAndRelated(null, opts);
                    }
                });
            }
        },
        setIdAndRelatedReverse: function (obj, opts) {
            var self = this;
            var reverseProxy = this.reverseProxyForInstance(obj);
            var reverseProxies = util.isArray(reverseProxy) ? reverseProxy : [reverseProxy];
            _.each(reverseProxies, function (p) {
                if (util.isArray(p.related)) {
                    p.makeChangesToRelatedWithoutObservations(function () {
                        p.splicer(opts)(p.related.length, 0, self.object);
                    });
                } else {
                    p.clearReverseRelated(opts);
                    p.setIdAndRelated(self.object, opts);
                }
            });
        },
        makeChangesToRelatedWithoutObservations: function (f) {
            if (this.related) {
                this.related.arrayObserver.close();
                this.related.arrayObserver = null;
                f();
                this.wrapArray(this.related);
            } else {
                f();
            }
        },
        registerSetChange: function (obj) {
            var proxyObject = this.object;
            if (!proxyObject) throw new InternalSiestaError('Proxy must have an object associated');
            var model = proxyObject.model.name;
            var collectionName = proxyObject.collectionName;
            // We take [] == null == undefined in the case of relationships.
            var old = this.related;
            if (util.isArray(old) && !old.length) {
                old = null;
            }
            modelEvents.emit({
                collection: collectionName,
                model: model,
                _id: proxyObject._id,
                field: this.getForwardName(),
                old: old,
                new: obj,
                type: ModelEventType.Set,
                obj: proxyObject
            });
        },

        registerSpliceChange: function (idx, numRemove) {
            var add = Array.prototype.slice.call(arguments, 2);
            var model = this.object.model.name;
            var coll = this.object.collectionName;
            modelEvents.emit({
                collection: coll,
                model: model,
                _id: this.object._id,
                field: this.getForwardName(),
                index: idx,
                removed: this.related ? this.related.slice(idx, idx + numRemove) : null,
                added: add.length ? add : [],
                type: ModelEventType.Splice,
                obj: this.object
            });
        },
        wrapArray: function (arr) {
            var self = this;
            wrapArrayForAttributes(arr, this.reverseName, this.object);
            if (!arr.arrayObserver) {
                arr.arrayObserver = new ArrayObserver(arr);
                var observerFunction = function (splices) {
                    splices.forEach(function (splice) {
                        var added = splice.addedCount ? arr.slice(splice.index, splice.index + splice.addedCount) : [];
                        var model = self.getForwardModel();
                        modelEvents.emit({
                            collection: model.collectionName,
                            model: model.name,
                            _id: self.object._id,
                            field: self.getForwardName(),
                            removed: splice.removed,
                            added: added,
                            type: ModelEventType.Splice,
                            obj: self.object
                        });
                    });
                };
                arr.arrayObserver.open(observerFunction);
            }
        },
        splice: function () {
            this.splicer({}).apply(this, arguments);
        }

    });


    module.exports = RelationshipProxy;


})();
},{"../vendor/observe-js/src/observe":53,"./Query":7,"./cache":12,"./error":15,"./events":16,"./log":18,"./modelEvents":21,"./store":22,"./util":24}],11:[function(require,module,exports){
(function () {
    module.exports = {
        OneToMany: 'OneToMany',
        OneToOne: 'OneToOne',
        ManyToMany: 'ManyToMany'
    };
})();
},{}],12:[function(require,module,exports){
/**
 * This is an in-memory cache for models. Models are cached by local id (_id) and remote id (defined by the mapping).
 * Lookups are performed against the cache when mapping.
 * @module cache
 */
(function () {

    var log = require('./log')('cache'),
        InternalSiestaError = require('./error').InternalSiestaError,
        util = require('./util');


    var localCacheById = {},
        localCache = {},
        remoteCache = {};

    /**
     * Clear out the cache.
     */
    function reset() {
        remoteCache = {};
        localCacheById = {};
        localCache = {};
    }

    /**
     * Return the object in the cache given a local id (_id)
     * @param  {String} localId
     * @return {ModelInstance}
     */
    function getViaLocalId(localId) {
        var obj = localCacheById[localId];
        if (obj) {
            log('Local cache hit: ' + obj._dump(true));
        } else {
            log('Local cache miss: ' + localId);
        }
        return obj;
    }

    /**
     * Return the singleton object given a singleton model.
     * @param  {Model} model
     * @return {ModelInstance}
     */
    function getSingleton(model) {
        var modelName = model.name;
        var collectionName = model.collectionName;
        var collectionCache = localCache[collectionName];
        if (collectionCache) {
            var typeCache = collectionCache[modelName];
            if (typeCache) {
                var objs = [];
                for (var prop in typeCache) {
                    if (typeCache.hasOwnProperty(prop)) {
                        objs.push(typeCache[prop]);
                    }
                }
                if (objs.length > 1) {
                    var errStr = 'A singleton model has more than 1 object in the cache! This is a serious error. ' +
                        'Either a model has been modified after objects have already been created, or something has gone' +
                        'very wrong. Please file a bug report if the latter.';
                    throw new InternalSiestaError(errStr);
                } else if (objs.length) {
                    return objs[0];
                }
            }
        }
        return null;
    }

    /**
     * Given a remote identifier and an options object that describes mapping/collection,
     * return the model if cached.
     * @param  {String} remoteId
     * @param  {Object} opts
     * @return {ModelInstance}
     */
    function getViaRemoteId(remoteId, opts) {
        var type = opts.model.name;
        var collectionName = opts.model.collectionName;
        var collectionCache = remoteCache[collectionName];
        if (collectionCache) {
            var typeCache = remoteCache[collectionName][type];
            if (typeCache) {
                var obj = typeCache[remoteId];
                if (obj) {
                    log('Remote cache hit: ' + obj._dump(true));
                } else {
                    log('Remote cache miss: ' + remoteId);
                }
                return obj;
            }
        }
        log('Remote cache miss: ' + remoteId);
        return null;
    }

    /**
     * Insert an objet into the cache using a remote identifier defined by the mapping.
     * @param  {ModelInstance} obj
     * @param  {String} remoteId
     * @param  {String} previousRemoteId If remote id has been changed, this is the old remote identifier
     */
    function remoteInsert(obj, remoteId, previousRemoteId) {
        if (obj) {
            var collectionName = obj.model.collectionName;
            if (collectionName) {
                if (!remoteCache[collectionName]) {
                    remoteCache[collectionName] = {};
                }
                var type = obj.model.name;
                if (type) {
                    if (!remoteCache[collectionName][type]) {
                        remoteCache[collectionName][type] = {};
                    }
                    if (previousRemoteId) {
                        remoteCache[collectionName][type][previousRemoteId] = null;
                    }
                    var cachedObject = remoteCache[collectionName][type][remoteId];
                    if (!cachedObject) {
                        remoteCache[collectionName][type][remoteId] = obj;
                        log('Remote cache insert: ' + obj._dump(true));
                        log('Remote cache now looks like: ' + remoteDump(true))
                    } else {
                        // Something has gone really wrong. Only one object for a particular collection/type/remoteid combo
                        // should ever exist.
                        if (obj != cachedObject) {
                            var message = 'Object ' + collectionName.toString() + ':' + type.toString() + '[' + obj.model.id + '="' + remoteId + '"] already exists in the cache.' +
                                ' This is a serious error, please file a bug report if you are experiencing this out in the wild';
                            log(message, {
                                obj: obj,
                                cachedObject: cachedObject
                            });
                            throw new InternalSiestaError(message);
                        } else {
                            log('Object has already been inserted: ' + obj._dump(true));
                        }

                    }
                } else {
                    throw new InternalSiestaError('Model has no type', {
                        model: obj.model,
                        obj: obj
                    });
                }
            } else {
                throw new InternalSiestaError('Model has no collection', {
                    model: obj.model,
                    obj: obj
                });
            }
        } else {
            var msg = 'Must pass an object when inserting to cache';
            log(msg);
            throw new InternalSiestaError(msg);
        }
    }

    /**
     * Dump the remote id cache
     * @param  {boolean} [asJson] Whether or not to apply JSON.stringify
     * @return {String|Object}
     */
    function remoteDump(asJson) {
        var dumpedRestCache = {};
        for (var coll in remoteCache) {
            if (remoteCache.hasOwnProperty(coll)) {
                var dumpedCollCache = {};
                dumpedRestCache[coll] = dumpedCollCache;
                var collCache = remoteCache[coll];
                for (var model in collCache) {
                    if (collCache.hasOwnProperty(model)) {
                        var dumpedModelCache = {};
                        dumpedCollCache[model] = dumpedModelCache;
                        var modelCache = collCache[model];
                        for (var remoteId in modelCache) {
                            if (modelCache.hasOwnProperty(remoteId)) {
                                if (modelCache[remoteId]) {
                                    dumpedModelCache[remoteId] = modelCache[remoteId]._dump();
                                }
                            }
                        }
                    }
                }
            }
        }
        return asJson ? util.prettyPrint(dumpedRestCache, null, 4) : dumpedRestCache;
    }

    /**
     * Dump the local id (_id) cache
     * @param  {boolean} asJson Whether or not to apply JSON.stringify
     * @return {String|Object}
     */
    function localDump(asJson) {
        var dumpedIdCache = {};
        for (var id in localCacheById) {
            if (localCacheById.hasOwnProperty(id)) {
                dumpedIdCache[id] = localCacheById[id]._dump()
            }
        }
        return asJson ? util.prettyPrint(dumpedIdCache, null, 4) : dumpedIdCache;
    }

    /**
     * Dump to the cache.
     * @param  {boolean} asJson Whether or not to apply JSON.stringify
     * @return {String|Object}
     */
    function dump(asJson) {
        var dumped = {
            localCache: localDump(),
            remoteCache: remoteDump()
        };
        return asJson ? util.prettyPrint(dumped, null, 4) : dumped;
    }

    function _remoteCache() {
        return remoteCache
    }

    function _localCache() {
        return localCacheById;
    }

    /**
     * Query the cache
     * @param  {Object} opts Object describing the query
     * @return {ModelInstance}
     * @example
     * ```js
     * cache.get({_id: '5'}); // Query by local id
     * cache.get({remoteId: '5', mapping: myMapping}); // Query by remote id
     * ```
     */
    function get(opts) {
        log('get', opts);
        var obj, idField, remoteId;
        var localId = opts._id;
        if (localId) {
            obj = getViaLocalId(localId);
            if (obj) {
                return obj;
            } else {
                if (opts.model) {
                    idField = opts.model.id;
                    remoteId = opts[idField];
                    log(idField + '=' + remoteId);
                    return getViaRemoteId(remoteId, opts);
                } else {
                    return null;
                }
            }
        } else if (opts.model) {
            idField = opts.model.id;
            remoteId = opts[idField];
            if (remoteId) {
                return getViaRemoteId(remoteId, opts);
            } else if (opts.model.singleton) {
                return getSingleton(opts.model);
            }
        } else {
            log('Invalid opts to cache', {
                opts: opts
            });
        }
        return null;
    }

    /**
     * Insert an object into the cache.
     * @param  {ModelInstance} obj
     * @throws {InternalSiestaError} An object with _id/remoteId already exists. Not thrown if same obhect.
     */
    function insert(obj) {
        var localId = obj._id;
        if (localId) {
            var collectionName = obj.model.collectionName;
            var modelName = obj.model.name;
            log('Local cache insert: ' + obj._dumpString());
            if (!localCacheById[localId]) {
                localCacheById[localId] = obj;
                log('Local cache now looks like: ' + localDump(true));
                if (!localCache[collectionName]) localCache[collectionName] = {};
                if (!localCache[collectionName][modelName]) localCache[collectionName][modelName] = {};
                localCache[collectionName][modelName][localId] = obj;
            } else {
                // Something has gone badly wrong here. Two objects should never exist with the same _id
                if (localCacheById[localId] != obj) {
                    var message = 'Object with _id="' + localId.toString() + '" is already in the cache. ' +
                        'This is a serious error. Please file a bug report if you are experiencing this out in the wild';
                    log(message);
                    throw new InternalSiestaError(message);
                }
            }
        }
        var idField = obj.idField;
        var remoteId = obj[idField];
        if (remoteId) {
            remoteInsert(obj, remoteId);
        } else {
            log('No remote id ("' + idField + '") so wont be placing in the remote cache', obj);
        }
    }

    /**
     * Returns true if object is in the cache
     * @param  {ModelInstance} obj
     * @return {boolean}
     */
    function contains(obj) {
        var q = {
            _id: obj._id
        };
        var model = obj.model;
        if (model.id) {
            if (obj[model.id]) {
                q.model = model;
                q[model.id] = obj[model.id];
            }
        }
        return !!get(q);
    }

    /**
     * Removes the object from the cache (if it's actually in the cache) otherwises throws an error.
     * @param  {ModelInstance} obj
     * @throws {InternalSiestaError} If object already in the cache.
     */
    function remove(obj) {
        if (contains(obj)) {
            var collectionName = obj.model.collectionName;
            var modelName = obj.model.name;
            var _id = obj._id;
            if (!modelName) throw InternalSiestaError('No mapping name');
            if (!collectionName) throw InternalSiestaError('No collection name');
            if (!_id) throw InternalSiestaError('No _id');
            delete localCache[collectionName][modelName][_id];
            delete localCacheById[_id];
            if (obj.model.id) {
                var remoteId = obj[obj.model.id];
                if (remoteId) {
                    delete remoteCache[collectionName][modelName][remoteId];
                }
            }
        } else {
            throw new InternalSiestaError('Object was not in cache.');
        }
    }


    exports._remoteCache = _remoteCache;
    exports._localCache = _localCache;
    Object.defineProperty(exports, '_localCacheByType', {
        get: function () {
            return localCache;
        }
    });
    exports.get = get;
    exports.insert = insert;
    exports.remoteInsert = remoteInsert;
    exports.reset = reset;
    exports._dump = dump;
    exports.contains = contains;
    exports.remove = remove;
    exports.getSingleton = getSingleton;
})();
},{"./error":15,"./log":18,"./util":24}],13:[function(require,module,exports){
/**
 * @module collection
 */
(function () {
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
        util.extendFromOpts(this, opts, {
            /**
             * The URL of the API e.g. http://api.github.com
             * @type {string}
             */
            baseURL: ''
        });

        _.extend(this, {
            name: name,
            _rawModels: {},
            _models: {},
            _opts: opts,
            /**
             * Set to true if installation has succeeded. You cannot use the collectio
             * @type {boolean}
             */
            installed: false
        });

        Object.defineProperties(this, {
            dirty: {
                get: function () {
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
        events.ProxyEventEmitter.call(this, this.name);
    }

    Collection.prototype = Object.create(events.ProxyEventEmitter.prototype);

    _.extend(Collection.prototype, {
        /**
         * Ensure mappings are installed.
         * @param [cb]
         * @class Collection
         */
        install: function (cb) {
            return util.promise(cb, function (cb) {
                var self = this;
                if (!this.installed) {
                    var modelsToInstall = [];
                    for (var name in this._models) {
                        if (this._models.hasOwnProperty(name)) {
                            var model = this._models[name];
                            modelsToInstall.push(model);
                        }
                    }
                    log('There are ' + modelsToInstall.length.toString() + ' mappings to install');
                    if (modelsToInstall.length) {
                        var tasks = _.map(modelsToInstall, function (m) {
                            return _.bind(m.install, m);
                        });
                        util.async.parallel(tasks, function (err) {
                            if (err) {
                                log('Failed to install collection', err);
                                self._finaliseInstallation(err, cb);
                            }
                            else {
                                self.installed = true;
                                var errors = [];
                                _.each(modelsToInstall, function (m) {
                                    log('Installing relationships for mapping with name "' + m.name + '"');
                                    var err = m.installRelationships();
                                    if (err) errors.push(err);
                                });
                                if (!errors.length) {
                                    _.each(modelsToInstall, function (m) {
                                        log('Installing reverse relationships for mapping with name "' + m.name + '"');
                                        var err = m.installReverseRelationships();
                                        if (err) errors.push(err);
                                    });
                                }
                                if (errors.length == 1) {
                                    err = errors[0];
                                } else if (errors.length) {
                                    err = errors;
                                }
                                self._finaliseInstallation(err, cb);
                            }
                        });

                    } else {
                        self._finaliseInstallation(null, cb);
                    }
                } else {
                    throw new InternalSiestaError('Collection "' + this.name + '" has already been installed');
                }
            }.bind(this));
        },

        /**
         * Mark this collection as installed, and place the collection on the global Siesta object.
         * @param  {Object}   err
         * @param  {Function} callback
         * @class Collection
         */
        _finaliseInstallation: function (err, callback) {
            if (err) err = error('Errors were encountered whilst setting up the collection', {errors: err});
            if (!err) {
                this.installed = true;
                var index = require('./index');
                index[this.name] = this;
            }
            callback(err);
        },
        /**
         * Given the name of a mapping and an options object describing the mapping, creating a Model
         * object, install it and return it.
         * @param  {String} name
         * @param  {Object} opts
         * @return {Model}
         * @class Collection
         */
        _model: function (name, opts) {
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
         * @param {String|Object} optsOrName An options object or the name of the mapping. Must pass options as second param if specify name.
         * @param {Object} opts Options if name already specified.
         * @return {Model}
         * @class Collection
         */
        model: function (op) {
            var acceptModels = !this.installed;
            if (acceptModels) {
                var self = this;
                if (arguments.length) {
                    if (arguments.length == 1) {
                        if (util.isArray(arguments[0])) {
                            return _.map(arguments[0], function (m) {
                                return self._model(m.name, m);
                            });
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
                            return _.map(arguments, function (m) {
                                return self._model(m.name, m);
                            });
                        }
                    }
                }
            }
            else {
                throw Error('Cannot create new models once the object graph is established!');
            }
            return null;
        },

        /**
         * Dump this collection as JSON
         * @param  {Boolean} asJson Whether or not to apply JSON.stringify
         * @return {String|Object}
         * @class Collection
         */
        _dump: function (asJson) {
            var obj = {};
            obj.installed = this.installed;
            obj.docId = this._docId;
            obj.name = this.name;
            obj.baseURL = this.baseURL;
            return asJson ? util.prettyPrint(obj) : obj;
        },

        /**
         * Returns the number of objects in this collection.
         *
         * @param cb
         * @returns {Promise}
         */
        count: function (cb) {
            return util.promise(cb, function (cb) {
                var tasks = _.map(this._models, function (m) {
                    return _.bind(m.count, m);
                });
                util.async.parallel(tasks, function (err, ns) {
                    var n;
                    if (!err) {
                        n = _.reduce(ns, function (m, r) {
                            return m + r
                        }, 0);
                    }
                    cb(err, n);
                });
            }.bind(this));
        }
    });

    module.exports = Collection;
})();
},{"../vendor/observe-js/src/observe":53,"./cache":12,"./collectionRegistry":14,"./error":15,"./events":16,"./index":undefined,"./log":18,"./model":20,"./util":24,"extend":33}],14:[function(require,module,exports){
/**
 * @module collection
 */
(function () {
    var _ = require('./util')._;

    function CollectionRegistry() {
        if (!this) return new CollectionRegistry();
        this.collectionNames = [];
    }

    _.extend(CollectionRegistry.prototype, {
        register: function (collection) {
            var name = collection.name;
            this[name] = collection;
            this.collectionNames.push(name);
        },
        reset: function () {
            var self = this;
            _.each(this.collectionNames, function (name) {
                delete self[name];
            });
            this.collectionNames = [];
        }
    });

    exports.CollectionRegistry = new CollectionRegistry();
})();
},{"./util":24}],15:[function(require,module,exports){
/**
 * @module error
 */
(function () {

    /**
     * Users should never see these thrown. A bug report should be filed if so as it means some assertion has failed.
     * @param message
     * @param context
     * @param ssf
     * @constructor
     */
    function InternalSiestaError(message, context, ssf) {
        this.message = message;
        this.context = context;
        // capture stack trace
        ssf = ssf || arguments.callee;
        if (ssf && Error.captureStackTrace) {
            Error.captureStackTrace(this, ssf);
        }
    }

    InternalSiestaError.prototype = Object.create(Error.prototype);
    InternalSiestaError.prototype.name = 'InternalSiestaError';
    InternalSiestaError.prototype.constructor = InternalSiestaError;

    function isSiestaError(err) {
        if (typeof err == 'object') {
            return 'error' in err && 'ok' in err && 'reason' in err;
        }
        return false;
    }

    module.exports = function (errMessage, extra) {
        if (isSiestaError(errMessage)) {
            return errMessage;
        }
        var err = {
            reason: errMessage,
            error: true,
            ok: false
        };
        for (var prop in extra || {}) {
            if (extra.hasOwnProperty(prop)) err[prop] = extra[prop];
        }
        err.toString = function () {
            return JSON.stringify(this);
        };
        return err;
    };

    module.exports.InternalSiestaError = InternalSiestaError;

})();
},{}],16:[function(require,module,exports){
(function () {
    var EventEmitter = require('events').EventEmitter,
        ArrayObserver = require('../vendor/observe-js/src/observe').ArrayObserver,
        _ = require('./util')._,
        modelEvents = require('./modelEvents');

    var events = new EventEmitter();
    events.setMaxListeners(100);

    /**
     * Listen to a particular event from the Siesta global EventEmitter.
     * Manages its own set of listeners.
     * @constructor
     */
    function ProxyEventEmitter(event) {
        _.extend(this, {
            event: event,
            listeners: {}
        });
    }

    _.extend(ProxyEventEmitter.prototype, {
        listen: function (type, fn) {
            if (typeof type == 'function') {
                fn = type;
                type = null;
            }
            else {
                var _fn = fn;
                fn = function (e) {
                    e = e || {};
                    if (type) {
                        if (e.type == type) {
                            _fn(e);
                        }
                    }
                    else {
                        _fn(e);
                    }
                };
                var listeners = this.listeners;
                if (type) {
                    if (!listeners[type]) listeners[type] = [];
                    listeners[type].push(fn);
                }
            }
            events.on(this.event, fn);
            return function () {
                this._removeListener(fn, type);
            }.bind(this);
        },
        listenOnce: function (type, fn) {
            var event = this.event;
            if (typeof type == 'function') {
                fn = type;
                type = null;
            }
            else {
                var _fn = fn;
                fn = function (e) {
                    e = e || {};
                    if (type) {
                        if (e.type == type) {
                            events.removeListener(event, fn);
                            _fn(e);
                        }
                    }
                    else {
                        _fn(e);
                    }
                }
            }
            if (type) {
                return events.on(event, fn);
            }
            else {
                return events.once(event, fn);
            }
        },
        _removeListener: function (fn, type) {
            if (type) {
                var listeners = this.listeners[type],
                    idx = listeners.indexOf(fn);
                listeners.splice(idx, 1);
            }
            return events.removeListener(this.event, fn);
        },
        emit: function (type, payload) {
            if (typeof type == 'object') {
                payload = type;
                type = null;
            }
            else {
                payload = payload || {};
                payload.type = type;
            }
            events.emit.call(events, this.event, payload);
        },
        _removeAllListeners: function (type) {
            (this.listeners[type] || []).forEach(function (fn) {
                events.removeListener(this.event, fn);
            }.bind(this));
            this.listeners[type] = [];
        },
        removeAllListeners: function (type) {
            if (type) {
                this._removeAllListeners(type);
            }
            else {
                for (type in this.listeners) {
                    if (this.listeners.hasOwnProperty(type)) {
                        this._removeAllListeners(type);
                    }
                }
            }
        }
    });

    // Aliases
    _.extend(ProxyEventEmitter.prototype, {
        on: ProxyEventEmitter.prototype.listen
    });

    _.extend(events, {
        ProxyEventEmitter: ProxyEventEmitter,
        wrapArray: function (array, field, modelInstance) {
            if (!array.observer) {
                array.observer = new ArrayObserver(array);
                array.observer.open(function (splices) {
                    var fieldIsAttribute = modelInstance._attributeNames.indexOf(field) > -1;
                    if (fieldIsAttribute) {
                        splices.forEach(function (splice) {
                            modelEvents.emit({
                                collection: modelInstance.collectionName,
                                model: modelInstance.model.name,
                                _id: modelInstance._id,
                                index: splice.index,
                                removed: splice.removed,
                                added: splice.addedCount ? array.slice(splice.index, splice.index + splice.addedCount) : [],
                                type: modelEvents.ModelEventType.Splice,
                                field: field,
                                obj: modelInstance
                            });
                        });
                    }
                });
            }
        }
    });

    module.exports = events;
})();
},{"../vendor/observe-js/src/observe":53,"./modelEvents":21,"./util":24,"events":29}],17:[function(require,module,exports){
(function () {
    var log = require('./log')('model'),
        InternalSiestaError = require('./error').InternalSiestaError,
        RelationshipType = require('./RelationshipType'),
        Query = require('./Query'),
        ModelInstance = require('./ModelInstance'),
        util = require('./util'),
        _ = util._,
        guid = util.guid,
        cache = require('./cache'),
        store = require('./store'),
        extend = require('extend'),
        modelEvents = require('./modelEvents'),
        wrapArray = require('./events').wrapArray,
        OneToManyProxy = require('./OneToManyProxy'),
        OneToOneProxy = require('./OneToOneProxy'),
        ManyToManyProxy = require('./ManyToManyProxy'),
        ReactiveQuery = require('./ReactiveQuery'),
        ArrangedReactiveQuery = require('./ArrangedReactiveQuery'),
        ModelEventType = modelEvents.ModelEventType;

    function ModelInstanceFactory(model) {
        this.model = model;
    }

    ModelInstanceFactory.prototype = {
        _getLocalId: function (data) {
            var _id;
            if (data) {
                _id = data._id ? data._id : guid();
            } else {
                _id = guid();
            }
            return _id;
        },
        /**
         * Configure attributes
         * @param modelInstance
         * @param data
         * @private
         */

        _installAttributes: function (modelInstance, data) {
            var Model = this.model,
                attributeNames = Model._attributeNames,
                idx = attributeNames.indexOf(Model.id);
            _.extend(modelInstance, {
                __values: _.extend(_.reduce(Model.attributes, function (m, a) {
                    if (a.default !== undefined) m[a.name] = a.default;
                    return m;
                }, {}), data || {})
            });
            if (idx > -1) attributeNames.splice(idx, 1);
            _.each(attributeNames, function (attributeName) {
                Object.defineProperty(modelInstance, attributeName, {
                    get: function () {
                        var value = modelInstance.__values[attributeName];
                        return value === undefined ? null : value;
                    },
                    set: function (v) {
                        var old = modelInstance.__values[attributeName];
                        var propertyDependencies = this._propertyDependencies[attributeName];
                            propertyDependencies = _.map(propertyDependencies, function (dependant) {
                                return {
                                    prop: dependant,
                                    old: this[dependant]
                                }
                            }.bind(this));

                        modelInstance.__values[attributeName] = v;
                        propertyDependencies.forEach(function (dep) {
                            var propertyName = dep.prop;
                            var new_ = this[propertyName];
                            modelEvents.emit({
                                collection: Model.collectionName,
                                model: Model.name,
                                _id: modelInstance._id,
                                new: new_,
                                old: dep.old,
                                type: ModelEventType.Set,
                                field: propertyName,
                                obj: modelInstance
                            });
                        }.bind(this));
                        var e = {
                            collection: Model.collectionName,
                            model: Model.name,
                            _id: modelInstance._id,
                            new: v,
                            old: old,
                            type: ModelEventType.Set,
                            field: attributeName,
                            obj: modelInstance
                        };
                        window.lastEmission = e;
                        modelEvents.emit(e);
                        if (util.isArray(v)) {
                            wrapArray(v, attributeName, modelInstance);
                        }
                    },
                    enumerable: true,
                    configurable: true
                });
            });
        },
        _installMethods: function (modelInstance) {
            var Model = this.model;
            _.each(Object.keys(Model.methods), function (methodName) {
                if (modelInstance[methodName] === undefined) {
                    modelInstance[methodName] = Model.methods[methodName].bind(modelInstance);
                }
                else {
                    log('A method with name "' + methodName + '" already exists. Ignoring it.');
                }
            }.bind(this));
        },
        _installProperties: function (modelInstance) {
            var _propertyNames = Object.keys(this.model.properties),
                _propertyDependencies = {};
            _.each(_propertyNames, function (propName) {
                var propDef = this.model.properties[propName];
                var dependencies = propDef.dependencies || [];
                dependencies.forEach(function (attr) {
                    if (!_propertyDependencies[attr]) _propertyDependencies[attr] = [];
                    _propertyDependencies[attr].push(propName);
                });
                delete propDef.dependencies;
                if (modelInstance[propName] === undefined) {
                    Object.defineProperty(modelInstance, propName, propDef);
                }
                else {
                    log('A property/method with name "' + propName + '" already exists. Ignoring it.');
                }
            }.bind(this));

            modelInstance._propertyDependencies = _propertyDependencies;
        },
        _installRemoteId: function (modelInstance) {
            var Model = this.model;
            Object.defineProperty(modelInstance, this.model.id, {
                get: function () {
                    return modelInstance.__values[Model.id] || null;
                },
                set: function (v) {
                    var old = modelInstance[Model.id];
                    modelInstance.__values[Model.id] = v;
                    modelEvents.emit({
                        collection: Model.collectionName,
                        model: Model.name,
                        _id: modelInstance._id,
                        new: v,
                        old: old,
                        type: ModelEventType.Set,
                        field: Model.id,
                        obj: modelInstance
                    });
                    cache.remoteInsert(modelInstance, v, old);
                },
                enumerable: true,
                configurable: true
            });
        },
        _installRelationships: function (modelInstance) {
            var model = this.model;
            for (var name in model.relationships) {
                var proxy;
                if (model.relationships.hasOwnProperty(name)) {
                    var relationshipOpts = _.extend({}, model.relationships[name]),
                        type = relationshipOpts.type;
                    delete relationshipOpts.type;
                    if (type == RelationshipType.OneToMany) {
                        proxy = new OneToManyProxy(relationshipOpts);
                    } else if (type == RelationshipType.OneToOne) {
                        proxy = new OneToOneProxy(relationshipOpts);
                    } else if (type == RelationshipType.ManyToMany) {
                        proxy = new ManyToManyProxy(relationshipOpts);
                    } else {
                        throw new InternalSiestaError('No such relationship type: ' + type);
                    }
                }
                proxy.install(modelInstance);
            }
        },
        _registerInstance: function (modelInstance, shouldRegisterChange) {
            cache.insert(modelInstance);
            shouldRegisterChange = shouldRegisterChange === undefined ? true : shouldRegisterChange;
            if (shouldRegisterChange) {
                modelEvents.emit({
                    collection: this.model.collectionName,
                    model: this.model.name,
                    _id: modelInstance._id,
                    new: modelInstance,
                    type: ModelEventType.New,
                    obj: modelInstance
                });
            }
        },
        _installLocalId: function (modelInstance, data) {
            modelInstance._id = this._getLocalId(data);
        },
        /**
         * Convert raw data into a ModelInstance
         * @returns {ModelInstance}
         */
        _instance: function (data, shouldRegisterChange) {
            if (this.model.installed) {
                var modelInstance = new ModelInstance(this.model);
                this._installLocalId(modelInstance, data);
                this._installAttributes(modelInstance, data);
                this._installMethods(modelInstance);
                this._installProperties(modelInstance);
                this._installRemoteId(modelInstance);
                this._installRelationships(modelInstance);
                this._registerInstance(modelInstance, shouldRegisterChange);
                return modelInstance;
            } else {
                throw new InternalSiestaError('Model must be fully installed before creating any models');
            }
        }
    };

    module.exports = function (model) {
        var factory = new ModelInstanceFactory(model);
        return factory._instance.bind(factory);
    }
})();
},{"./ArrangedReactiveQuery":2,"./ManyToManyProxy":3,"./ModelInstance":4,"./OneToManyProxy":5,"./OneToOneProxy":6,"./Query":7,"./ReactiveQuery":9,"./RelationshipType":11,"./cache":12,"./error":15,"./events":16,"./log":18,"./modelEvents":21,"./store":22,"./util":24,"extend":33}],18:[function(require,module,exports){
(function () {
    /**
     * Dead simple logging service based on visionmedia/debug
     * @module log
     */

    var debug = require('debug'),
        argsarray = require('argsarray');

    module.exports = function (name) {
        var log = debug('siesta:' + name);
        var fn = argsarray(function (args) {
            log.call(log, args);
        });
        Object.defineProperty(fn, 'enabled', {
            get: function () {
                return debug.enabled(name);
            }
        });
        return fn;
    };
})();
},{"argsarray":27,"debug":30}],19:[function(require,module,exports){
(function () {
    var Store = require('./store'),
        SiestaModel = require('./ModelInstance'),
        log = require('./log')('mapping'),
        cache = require('./cache'),
        util = require('./util'),
        _ = util._,
        async = util.async;

    function SiestaError(opts) {
        this.opts = opts;
    }
    SiestaError.prototype.toString = function () {
        return JSON.stringify(this.opts, null, 4);
    };


    /**
     * Encapsulates the idea of mapping arrays of data onto the object graph or arrays of objects.
     * @param {Object} opts
     * @param opts.model
     * @param opts.data#
     * @param opts.objects
     * @param opts.disableNotifications
     */
    function MappingOperation(opts) {
        this._opts = opts;

        util.extendFromOpts(this, opts, {
            model: null,
            data: null,
            objects: [],
            disableevents: false,
            _ignoreInstalled: false,
            fromStorage: false
        });

        _.extend(this, {
            errors: [],
            subTaskResults: {},
            _newObjects: []
        });
    }


    _.extend(MappingOperation.prototype, {
        mapAttributes: function () {
            for (var i = 0; i < this.data.length; i++) {
                var datum = this.data[i];
                var object = this.objects[i];
                // No point mapping object onto itself. This happens if a ModelInstance is passed as a relationship.
                if (datum != object) {
                    if (object) { // If object is falsy, then there was an error looking up that object/creating it.
                        var fields = this.model._attributeNames;
                        _.each(fields, function (f) {
                            if (datum[f] !== undefined) { // null is fine
                                // If events are disabled we update __values object directly. This avoids triggering
                                // events which are built into the set function of the property.
                                if (this.disableevents) {
                                    object.__values[f] = datum[f];
                                }
                                else {
                                    object[f] = datum[f];
                                }
                            }
                        }.bind(this));
                        // PouchDB revision (if using storage module).
                        // TODO: Can this be pulled out of core?
                        if (datum._rev) object._rev = datum._rev;
                    }
                }
            }
        },
        _map: function () {
            var self = this;
            var err;
            this.mapAttributes();
            var relationshipFields = _.keys(self.subTaskResults);
            _.each(relationshipFields, function (f) {
                var res = self.subTaskResults[f];
                var indexes = res.indexes,
                    objects = res.objects;
                var relatedData = self.getRelatedData(f).relatedData;
                var unflattenedObjects = util.unflattenArray(objects, relatedData);
                for (var i = 0; i < unflattenedObjects.length; i++) {
                    var idx = indexes[i];
                    // Errors are plucked from the suboperations.
                    var error = self.errors[idx];
                    err = error ? error[f] : null;
                    if (!err) {
                        var related = unflattenedObjects[i]; // Can be array or scalar.
                        var object = self.objects[idx];
                        if (object) {
                            err = object.__proxies[f].set(related, {disableevents: self.disableevents});
                            if (err) {
                                if (!self.errors[idx]) self.errors[idx] = {};
                                self.errors[idx][f] = err;
                            }
                        }
                    }
                }
            });
        },
        /**
         * For indices where no object is present, perform lookups, creating a new object if necessary.
         * @private
         */
        _lookup: function (cb) {
            return util.promise(cb, function (cb) {
                var self = this;
                var remoteLookups = [];
                var localLookups = [];
                for (var i = 0; i < this.data.length; i++) {
                    if (!this.objects[i]) {
                        var lookup;
                        var datum = this.data[i];
                        var isScalar = typeof datum == 'string' || typeof datum == 'number' || datum instanceof String;
                        if (datum) {
                            if (isScalar) {
                                lookup = {
                                    index: i,
                                    datum: {}
                                };
                                lookup.datum[self.model.id] = datum;
                                remoteLookups.push(lookup);
                            } else if (datum instanceof SiestaModel) { // We won't need to perform any mapping.
                                this.objects[i] = datum;
                            } else if (datum._id) {
                                localLookups.push({
                                    index: i,
                                    datum: datum
                                });
                            } else if (datum[self.model.id]) {
                                remoteLookups.push({
                                    index: i,
                                    datum: datum
                                });
                            } else {
                                this.objects[i] = self._instance();
                            }
                        } else {
                            this.objects[i] = null;
                        }
                    }
                }
                util.async.parallel([
                        function (done) {
                            var localIdentifiers = _.pluck(_.pluck(localLookups, 'datum'), '_id');
                            if (localIdentifiers.length) {
                                Store.getMultipleLocal(localIdentifiers, function (err, objects) {
                                    if (!err) {
                                        for (var i = 0; i < localIdentifiers.length; i++) {
                                            var obj = objects[i];
                                            var _id = localIdentifiers[i];
                                            var lookup = localLookups[i];
                                            if (!obj) {
                                                // If there are multiple mapping operations going on, there may be
                                                obj = cache.get({_id: _id});
                                                if (!obj)
                                                    obj = self._instance({_id: _id}, !self.disableevents);
                                                self.objects[lookup.index] = obj;
                                            } else {
                                                self.objects[lookup.index] = obj;
                                            }
                                        }
                                    }
                                    done(err);
                                });
                            } else {
                                done();
                            }
                        },
                        function (done) {
                            var remoteIdentifiers = _.pluck(_.pluck(remoteLookups, 'datum'), self.model.id);
                            if (remoteIdentifiers.length) {
                                log('Looking up remoteIdentifiers: ' + util.prettyPrint(remoteIdentifiers));
                                Store.getMultipleRemote(remoteIdentifiers, self.model, function (err, objects) {
                                    if (!err) {
                                        if (log.enabled) {
                                            var results = {};
                                            for (i = 0; i < objects.length; i++) {
                                                results[remoteIdentifiers[i]] = objects[i] ? objects[i]._id : null;
                                            }
                                            log('Results for remoteIdentifiers: ' + util.prettyPrint(results));
                                        }
                                        for (i = 0; i < objects.length; i++) {
                                            var obj = objects[i];
                                            var lookup = remoteLookups[i];
                                            if (obj) {
                                                self.objects[lookup.index] = obj;
                                            } else {
                                                var data = {};
                                                var remoteId = remoteIdentifiers[i];
                                                data[self.model.id] = remoteId;
                                                var cacheQuery = {
                                                    model: self.model
                                                };
                                                cacheQuery[self.model.id] = remoteId;
                                                var cached = cache.get(cacheQuery);
                                                if (cached) {
                                                    self.objects[lookup.index] = cached;
                                                } else {
                                                    self.objects[lookup.index] = self._instance();
                                                    // It's important that we map the remote identifier here to ensure that it ends
                                                    // up in the cache.
                                                    self.objects[lookup.index][self.model.id] = remoteId;
                                                }
                                            }
                                        }
                                    }
                                    done(err);
                                });
                            } else {
                                done();
                            }
                        }
                    ],
                    cb);
            }.bind(this));
        },
        _lookupSingleton: function (cb) {
            return util.promise(cb, function (cb) {
                var self = this;
                // Pick a random _id from the array of data being mapped onto the singleton object. Note that they should
                // always be the same. This is just a precaution.
                var _ids = _.pluck(self.data, '_id'),
                    _id;
                for (i = 0; i < _ids.length; i++) {
                    if (_ids[i]) {
                        _id = {_id: _ids[i]};
                        break;
                    }
                }
                // The mapping operation is responsible for creating singleton instances if they do not already exist.
                var singleton = cache.getSingleton(this.model) || this._instance(_id);
                for (var i = 0; i < self.data.length; i++) {
                    self.objects[i] = singleton;
                }
                cb();
            }.bind(this));
        },
        _instance: function () {
            var model = this.model,
                modelInstance = model._instance.apply(model, arguments);
            this._newObjects.push(modelInstance);
            return modelInstance;
        },
        start: function (done) {
            if (this.data.length) {
                var self = this;
                var tasks = [];
                var lookupFunc = this.model.singleton ? this._lookupSingleton : this._lookup;
                tasks.push(_.bind(lookupFunc, this));
                tasks.push(_.bind(this._executeSubOperations, this));
                util.async.parallel(tasks, function () {
                    try {
                        self._map();

                        // Users are allowed to add a custom init method to the methods object when defining a Model, of the form:
                        //
                        //
                        // init: function ([done]) {
                        //     // ...
                        //  }
                        //
                        //
                        // If done is passed, then __init must be executed asynchronously, and the mapping operation will not
                        // finish until all inits have executed.
                        //
                        // Here we ensure the execution of all of them
                        var fromStorage = this.fromStorage;
                        var initTasks = _.reduce(self._newObjects, function (m, o) {
                            var init = o.model.init;
                            if (init) {
                                var paramNames = util.paramNames(init);
                                if (paramNames.length > 1) {
                                    m.push(_.bind(init, o, fromStorage, done));
                                }
                                else {
                                    init.call(o, fromStorage);
                                }
                            }
                            return m;
                        }, []);
                        async.parallel(initTasks, function () {
                            done(self.errors.length ? self.errors : null, self.objects);
                        });
                    }
                    catch (e) {
                        console.error('Uncaught error when executing init funcitons on models.', e);
                        done(e);
                    }
                }.bind(this));
            } else {
                done(null, []);
            }
        },
        getRelatedData: function (name) {
            var indexes = [];
            var relatedData = [];
            for (var i = 0; i < this.data.length; i++) {
                var datum = this.data[i];
                if (datum) {
                    if (datum[name]) {
                        indexes.push(i);
                        relatedData.push(datum[name]);
                    }
                }
            }
            return {
                indexes: indexes,
                relatedData: relatedData
            };
        },
        processErrorsFromTask: function (relationshipName, errors, indexes) {
            if (errors.length) {
                var relatedData = this.getRelatedData(relationshipName).relatedData;
                var unflattenedErrors = util.unflattenArray(errors, relatedData);
                for (var i = 0; i < unflattenedErrors.length; i++) {
                    var idx = indexes[i];
                    var err = unflattenedErrors[i];
                    var isError = err;
                    if (util.isArray(err)) isError = _.reduce(err, function (memo, x) {
                        return memo || x
                    }, false);
                    if (isError) {
                        if (!this.errors[idx]) this.errors[idx] = {};
                        this.errors[idx][relationshipName] = err;
                    }
                }
            }
        },
        _executeSubOperations: function (callback) {
            var self = this,
                relationshipNames = _.keys(this.model.relationships);
            if (relationshipNames.length) {
                var tasks = _.reduce(relationshipNames, function (m, relationshipName) {
                    var relationship = self.model.relationships[relationshipName],
                        reverseModel = relationship.forwardName == relationshipName ? relationship.reverseModel : relationship.forwardModel;
                    // Mock any missing singleton data to ensure that all singleton instances are created.
                    if (reverseModel.singleton && !relationship.isReverse) {
                        this.data.forEach(function (datum) {
                            if (!datum[relationshipName]) datum[relationshipName] = {};
                        });
                    }
                    var __ret = this.getRelatedData(relationshipName),
                        indexes = __ret.indexes,
                        relatedData = __ret.relatedData;
                    if (relatedData.length) {
                        var flatRelatedData = util.flattenArray(relatedData);
                        var op = new MappingOperation({
                            model: reverseModel,
                            data: flatRelatedData,
                            disableevents: self.disableevents,
                            _ignoreInstalled: self._ignoreInstalled,
                            fromStorage: this.fromStorage
                        });
                    }

                    if (op) {
                        var task;
                        task = function (done) {
                            op.start(function (errors, objects) {
                                self.subTaskResults[relationshipName] = {
                                    errors: errors,
                                    objects: objects,
                                    indexes: indexes
                                };
                                self.processErrorsFromTask(relationshipName, op.errors, indexes);
                                done();
                            });
                        };
                        m.push(task);
                    }
                    return m;
                }.bind(this), []);
                async.parallel(tasks, function (err) {
                    callback(err);
                });
            } else {
                callback();
            }
        }
    });

    module.exports = MappingOperation;



})();
},{"./ModelInstance":4,"./cache":12,"./log":18,"./store":22,"./util":24}],20:[function(require,module,exports){
(function () {

    var log = require('./log')('model'),
        CollectionRegistry = require('./collectionRegistry').CollectionRegistry,
        InternalSiestaError = require('./error').InternalSiestaError,
        RelationshipType = require('./RelationshipType'),
        Query = require('./Query'),
        MappingOperation = require('./mappingOperation'),
        ModelInstance = require('./ModelInstance'),
        util = require('./util'),
        cache = require('./cache'),
        store = require('./store'),
        error = require('./error'),
        extend = require('extend'),
        modelEvents = require('./modelEvents'),
        events = require('./events'),
        OneToOneProxy = require('./OneToOneProxy'),
        ManyToManyProxy = require('./ManyToManyProxy'),
        ReactiveQuery = require('./ReactiveQuery'),
        instanceFactory = require('./instanceFactory'),
        ArrangedReactiveQuery = require('./ArrangedReactiveQuery'),
        _ = util._;

    /**
     *
     * @param {Object} opts
     */
    function Model(opts) {
        var self = this;
        this._opts = opts ? _.extend({}, opts) : {};

        util.extendFromOpts(this, opts, {
            methods: {},
            attributes: [],
            collection: function (c) {
                if (util.isString(c)) {
                    c = CollectionRegistry[c];
                }
                return c;
            },
            id: 'id',
            relationships: [],
            name: null,
            indexes: [],
            singleton: false,
            statics: this.installStatics.bind(this),
            properties: {},
            init: null,
            remove: null
        });

        this.attributes = Model._processAttributes(this.attributes);

        this._instance = new instanceFactory(this);

        _.extend(this, {
            _installed: false,
            _relationshipsInstalled: false,
            _reverseRelationshipsInstalled: false,
            children: []
        });

        Object.defineProperties(this, {
            _relationshipNames: {
                get: function () {
                    return Object.keys(self.relationships);
                },
                enumerable: true
            },
            _attributeNames: {
                get: function () {
                    var names = [];
                    if (self.id) {
                        names.push(self.id);
                    }
                    _.each(self.attributes, function (x) {
                        names.push(x.name)
                    });
                    return names;
                },
                enumerable: true,
                configurable: true
            },
            installed: {
                get: function () {
                    return self._installed && self._relationshipsInstalled && self._reverseRelationshipsInstalled;
                },
                enumerable: true,
                configurable: true
            },
            descendants: {
                get: function () {
                    return _.reduce(self.children, function (memo, descendant) {
                        return Array.prototype.concat.call(memo, descendant.descendants);
                    }.bind(self), _.extend([], self.children));
                },
                enumerable: true
            },
            dirty: {
                get: function () {
                    if (siesta.ext.storageEnabled) {
                        var unsavedObjectsByCollection = siesta.ext.storage._unsavedObjectsByCollection,
                            hash = (unsavedObjectsByCollection[this.collectionName] || {})[this.name] || {};
                        return !!Object.keys(hash).length;
                    }
                    else return undefined;
                },
                enumerable: true
            },
            collectionName: {
                get: function () {
                    return this.collection.name;
                },
                enumerable: true
            }
        });
        events.ProxyEventEmitter.call(this, this.collectionName + ':' + this.name);
    }

    _.extend(Model, {
        /**
         * Normalise attributes passed via the options dictionary.
         * @param attributes
         * @returns {Array}
         * @private
         */
        _processAttributes: function (attributes) {
            return _.reduce(attributes, function (m, a) {
                if (typeof a == 'string') {
                    m.push({
                        name: a
                    });
                }
                else {
                    m.push(a);
                }
                return m;
            }, [])
        }
    });

    Model.prototype = Object.create(events.ProxyEventEmitter.prototype);

    _.extend(Model.prototype, {
        installStatics: function (statics) {
            if (statics) {
                _.each(Object.keys(statics), function (staticName) {
                    if (this[staticName]) {
                        log('Static method with name "' + staticName + '" already exists. Ignoring it.');
                    }
                    else {
                        this[staticName] = statics[staticName].bind(this);
                    }
                }.bind(this));
            }
            return statics;
        },
        _validateRelationshipType: function (relationship) {
            if (!relationship.type) {
                if (this.singleton) relationship.type = RelationshipType.OneToOne;
                else relationship.type = RelationshipType.OneToMany;
            }
            if (this.singleton && relationship.type == RelationshipType.ManyToMany) {
                return 'Singleton model cannot use ManyToMany relationship.';
            }
            if (Object.keys(RelationshipType).indexOf(relationship.type) < 0)
                return 'Relationship type ' + relationship.type + ' does not exist';
            return null;
        },

        /**
         * Install relationships. Returns error in form of string if fails.
         * @return {String|null}
         */
        installRelationships: function () {
            if (!this._relationshipsInstalled) {
                var self = this,
                    err = null;
                self._relationships = [];
                if (self._opts.relationships) {
                    for (var name in self._opts.relationships) {
                        if (self._opts.relationships.hasOwnProperty(name)) {
                            var relationship = self._opts.relationships[name];
                            // If a reverse relationship is installed beforehand, we do not want to process them.
                            if (!relationship.isReverse) {
                                log(this.name + ': configuring relationship ' + name, relationship);
                                if (!(err = this._validateRelationshipType(relationship))) {
                                    var modelName = relationship.model;
                                    delete relationship.model;
                                    var reverseModel;
                                    if (modelName instanceof Model) {
                                        reverseModel = modelName;
                                    }
                                    else {
                                        log('reverseModelName', modelName);
                                        if (!self.collection) throw new InternalSiestaError('Model must have collection');
                                        var collection = self.collection;
                                        if (!collection)    throw new InternalSiestaError('Collection ' + self.collectionName + ' not registered');
                                        reverseModel = collection[modelName];
                                    }
                                    if (!reverseModel) {
                                        var arr = modelName.split('.');
                                        if (arr.length == 2) {
                                            var collectionName = arr[0];
                                            modelName = arr[1];
                                            var otherCollection = CollectionRegistry[collectionName];
                                            if (!otherCollection) return 'Collection with name "' + collectionName + '" does not exist.';
                                            reverseModel = otherCollection[modelName];
                                        }
                                    }
                                    log('reverseModel', reverseModel);
                                    if (reverseModel) {
                                        _.extend(relationship, {
                                            reverseModel: reverseModel,
                                            forwardModel: this,
                                            forwardName: name,
                                            reverseName: relationship.reverse || 'reverse_' + name,
                                            isReverse: false
                                        });
                                        delete relationship.reverse;
                                    } else return 'Model with name "' + modelName.toString() + '" does not exist';
                                }
                            }
                        }
                    }
                }
            } else {
                throw new InternalSiestaError('Relationships for "' + this.name + '" have already been installed');
            }
            if (!err) this._relationshipsInstalled = true;
            return err;
        },
        installReverseRelationships: function () {
            if (!this._reverseRelationshipsInstalled) {
                for (var forwardName in this.relationships) {
                    if (this.relationships.hasOwnProperty(forwardName)) {
                        var relationship = this.relationships[forwardName];
                        relationship = extend(true, {}, relationship);
                        relationship.isReverse = true;
                        var reverseModel = relationship.reverseModel,
                            reverseName = relationship.reverseName;
                        if (reverseModel.singleton) {
                            if (relationship.type == RelationshipType.ManyToMany) return 'Singleton model cannot be related via reverse ManyToMany';
                            if (relationship.type == RelationshipType.OneToMany) return 'Singleton model cannot be related via reverse OneToMany';
                        }
                        log(this.name + ': configuring  reverse relationship ' + reverseName);
                        reverseModel.relationships[reverseName] = relationship;
                    }
                }
                this._reverseRelationshipsInstalled = true;
            } else {
                throw new InternalSiestaError('Reverse relationships for "' + this.name + '" have already been installed.');
            }
        },
        _query: function (query) {
            return new Query(this, query || {});
        },
        query: function (query, cb) {
            return util.promise(cb, function (cb) {
                if (!this.singleton) return (this._query(query)).execute(cb);
                else {
                    (this._query({__ignoreInstalled: true})).execute(function (err, objs) {
                        if (err) cb(err);
                        else {
                            // Cache a new singleton and then reexecute the query
                            query = _.extend({}, query);
                            query.__ignoreInstalled = true;
                            if (!objs.length) {
                                this.graph({}, function (err) {
                                    if (!err) {
                                        (this._query(query)).execute(cb);
                                    }
                                    else {
                                        cb(err);
                                    }
                                }.bind(this));
                            }
                            else {
                                (this._query(query)).execute(cb);
                            }
                        }
                    }.bind(this));
                }
            }.bind(this));

        },
        reactiveQuery: function (query) {
            return new ReactiveQuery(new Query(this, query || {}));
        },
        arrangedReactiveQuery: function (query) {
            return new ArrangedReactiveQuery(new Query(this, query || {}));
        },
        one: function (opts, cb) {
            if (typeof opts == 'function') {
                cb = opts;
                opts = {};
            }
            return util.promise(cb, function (cb) {
                this.query(opts, function (err, res) {
                    if (err) cb(err);
                    else {
                        if (res.length > 1) {
                            cb(error('More than one instance returned when executing get query!'));
                        }
                        else {
                            res = res.length ? res[0] : null;
                            cb(null, res);
                        }
                    }
                });
            }.bind(this));
        },
        all: function (q, cb) {
            if (typeof q == 'function') {
                cb = q;
                q = {};
            }
            q = q || {};
            var query = {};
            if (q.__order) query.__order = q.__order;
            return this.query(q, cb);
        },
        install: function (cb) {
            log('Installing mapping ' + this.name);
            return util.promise(cb, function (cb) {
                if (!this._installed) {
                    this._installed = true;
                    cb();
                } else {
                    throw new InternalSiestaError('Model "' + this.name + '" has already been installed');
                }
            }.bind(this));
        },
        /**
         * Map data into Siesta.
         *
         * @param data Raw data received remotely or otherwise
         * @param {function|object} [opts]
         * @param {boolean} opts.override
         * @param {boolean} opts._ignoreInstalled - A hack that allows mapping onto Models even if install process has not finished.
         * @param {function} [cb] Called once pouch persistence returns.
         */
        graph: function (data, opts, cb) {
            if (typeof opts == 'function') cb = opts;
            opts = opts || {};
            return util.promise(cb, function (cb) {
                var _map = function () {
                    var overrides = opts.override;
                    if (overrides) {
                        if (util.isArray(overrides)) opts.objects = overrides;
                        else opts.objects = [overrides];
                    }
                    delete opts.override;
                    if (util.isArray(data)) {
                        this._mapBulk(data, opts, cb);
                    } else {
                        this._mapBulk([data], opts, function (err, objects) {
                            var obj;
                            if (objects) {
                                if (objects.length) {
                                    obj = objects[0];
                                }
                            }
                            err = err ? (util.isArray(data) ? err : (util.isArray(err) ? err[0] : err)) : null;
                            cb(err, obj);
                        });
                    }
                }.bind(this);
                if (opts._ignoreInstalled) {
                    _map();
                }
                else siesta._afterInstall(_map);
            }.bind(this));
        },
        _mapBulk: function (data, opts, callback) {
            _.extend(opts, {model: this, data: data});
            var op = new MappingOperation(opts);
            op.start(function (err, objects) {
                if (err) {
                    if (callback) callback(err);
                } else {
                    callback(null, objects || []);
                }
            });
        },
        _countCache: function () {
            var collCache = cache._localCacheByType[this.collectionName] || {};
            var modelCache = collCache[this.name] || {};
            return _.reduce(Object.keys(modelCache), function (m, _id) {
                m[_id] = {};
                return m;
            }, {});
        },
        count: function (cb) {
            return util.promise(cb, function (cb) {
                cb(null, Object.keys(this._countCache()).length);
            }.bind(this));
        },
        _dump: function (asJSON) {
            var dumped = {};
            dumped.name = this.name;
            dumped.attributes = this.attributes;
            dumped.id = this.id;
            dumped.collection = this.collectionName;
            dumped.relationships = _.map(this.relationships, function (r) {
                return r.isForward ? r.forwardName : r.reverseName;
            });
            return asJSON ? util.prettyPrint(dumped) : dumped;
        },
        toString: function () {
            return 'Model[' + this.name + ']';
        }

    });

    // Subclassing
    _.extend(Model.prototype, {
        child: function (nameOrOpts, opts) {
            if (typeof nameOrOpts == 'string') {
                opts.name = nameOrOpts;
            } else {
                opts = name;
            }
            _.extend(opts, {
                attributes: Array.prototype.concat.call(opts.attributes || [], this._opts.attributes),
                relationships: _.extend(opts.relationships || {}, this._opts.relationships),
                methods: _.extend(_.extend({}, this._opts.methods) || {}, opts.methods),
                statics: _.extend(_.extend({}, this._opts.statics) || {}, opts.statics),
                properties: _.extend(_.extend({}, this._opts.properties) || {}, opts.properties),
                id: opts.id || this._opts.id,
                init: opts.init || this._opts.init,
                remove: opts.remove || this._opts.remove
            });
            var model = this.collection.model(opts.name, opts);
            model.parent = this;
            this.children.push(model);
            return model;
        },
        isChildOf: function (parent) {
            return this.parent == parent;
        },
        isParentOf: function (child) {
            return this.children.indexOf(child) > -1;
        },
        isDescendantOf: function (ancestor) {
            var parent = this.parent;
            while (parent) {
                if (parent == ancestor) return true;
                parent = parent.parent;
            }
            return false;
        },
        isAncestorOf: function (descendant) {
            return this.descendants.indexOf(descendant) > -1;
        },
        hasAttributeNamed: function (attributeName) {
            return this._attributeNames.indexOf(attributeName) > -1;
        }
    });

    module.exports = Model;

})();

},{"./ArrangedReactiveQuery":2,"./ManyToManyProxy":3,"./ModelInstance":4,"./OneToOneProxy":6,"./Query":7,"./ReactiveQuery":9,"./RelationshipType":11,"./cache":12,"./collectionRegistry":14,"./error":15,"./events":16,"./instanceFactory":17,"./log":18,"./mappingOperation":19,"./modelEvents":21,"./store":22,"./util":24,"extend":33}],21:[function(require,module,exports){
(function () {
    var events = require('./events'),
        InternalSiestaError = require('./error').InternalSiestaError,
        log = require('./log')('events'),
        extend = require('./util')._.extend,
        collectionRegistry = require('./collectionRegistry').CollectionRegistry;


    /**
     * Constants that describe change events.
     * Set => A new value is assigned to an attribute/relationship
     * Splice => All javascript array operations are described as splices.
     * Delete => Used in the case where objects are removed from an array, but array order is not known in advance.
     * Remove => Object deletion events
     * New => Object creation events
     * @type {Object}
     */
    var ModelEventType = {
            Set: 'Set',
            Splice: 'Splice',
            New: 'New',
            Remove: 'Remove'
        };

    /**
     * Represents an individual change.
     * @param opts
     * @constructor
     */
    function ModelEvent(opts) {
        this._opts = opts || {};
        Object.keys(opts).forEach(function (k) {
            this[k] = opts[k];
        }.bind(this));
    }

    ModelEvent.prototype._dump = function (pretty) {
        var dumped = {};
        dumped.collection = (typeof this.collection) == 'string' ? this.collection : this.collection._dump();
        dumped.model = (typeof this.model) == 'string' ? this.model : this.model.name;
        dumped._id = this._id;
        dumped.field = this.field;
        dumped.type = this.type;
        if (this.index) dumped.index = this.index;
        if (this.added) dumped.added = _.map(this.added, function (x) {return x._dump()});
        if (this.removed) dumped.removed = _.map(this.removed, function (x) {return x._dump()});
        if (this.old) dumped.old = this.old;
        if (this.new) dumped.new = this.new;
        return pretty ? util.prettyPrint(dumped) : dumped;
    };

    /**
     * Broadcas
     * @param  {String} collectionName
     * @param  {String} modelName
     * @param  {Object} c an options dictionary representing the change
     * @return {[type]}
     */
    function broadcastEvent(collectionName, modelName, c) {
        log('Sending notification "' + collectionName + '" of type ' + c.type);
        events.emit(collectionName, c);
        var modelNotif = collectionName + ':' + modelName;
        log('Sending notification "' + modelNotif + '" of type ' + c.type);
        events.emit(modelNotif, c);
        var genericNotif = 'Siesta';
        log('Sending notification "' + genericNotif + '" of type ' + c.type);
        events.emit(genericNotif, c);
        var localIdNotif = c._id;
        log('Sending notification "' + localIdNotif + '" of type ' + c.type);
        events.emit(localIdNotif, c);
        var collection = collectionRegistry[collectionName];
        var err;
        if (!collection) {
            err = 'No such collection "' + collectionName + '"';
            log(err, collectionRegistry);
            throw new InternalSiestaError(err);
        }
        var model = collection[modelName];
        if (!model) {
            err = 'No such model "' + modelName + '"';
            log(err, collectionRegistry);
            throw new InternalSiestaError(err);
        }
        if (model.id && c.obj[model.id]) {
            var remoteIdNotif = collectionName + ':' + modelName + ':' + c.obj[model.id];
            log('Sending notification "' + remoteIdNotif + '" of type ' + c.type);
            events.emit(remoteIdNotif, c);
        }
    }

    function validateEventOpts(opts) {
        if (!opts.model) throw new InternalSiestaError('Must pass a model');
        if (!opts.collection) throw new InternalSiestaError('Must pass a collection');
        if (!opts._id) throw new InternalSiestaError('Must pass a local identifier');
        if (!opts.obj) throw new InternalSiestaError('Must pass the object');
    }

    function emit(opts) {
        validateEventOpts(opts);
        var collection = opts.collection;
        var model = opts.model;
        var c = new ModelEvent(opts);
        broadcastEvent(collection, model, c);
        return c;
    }

    extend(exports, {
        ModelEvent: ModelEvent,
        emit: emit,
        validateEventOpts: validateEventOpts,
        ModelEventType: ModelEventType
    });
})();
},{"./collectionRegistry":14,"./error":15,"./events":16,"./log":18,"./util":24}],22:[function(require,module,exports){
/**
 * The "store" is responsible for mediating between the in-memory cache and any persistent storage.
 * Note that persistent storage has not been properly implemented yet and so this is pretty useless.
 * All queries will go straight to the cache instead.
 * @module store
 */


(function () {
    var InternalSiestaError = require('./error').InternalSiestaError,
        log = require('./log')('store'),
        util = require('./util'),
        _ = util._,
        cache = require('./cache');


    function get(opts, cb) {
        log('get', opts);
        var siestaModel;
        return util.promise(cb, function (cb) {
            if (opts._id) {
                if (util.isArray(opts._id)) {
                    // Proxy onto getMultiple instead.
                    getMultiple(_.map(opts._id, function (id) {
                        return {
                            _id: id
                        }
                    }), cb);
                } else {
                    siestaModel = cache.get(opts);
                    if (siestaModel) {
                        if (log.enabled)
                            log('Had cached object', {
                                opts: opts,
                                obj: siestaModel
                            });
                        if (cb) cb(null, siestaModel);
                    } else {
                        if (util.isArray(opts._id)) {
                            // Proxy onto getMultiple instead.
                            getMultiple(_.map(opts._id, function (id) {
                                return {
                                    _id: id
                                }
                            }), cb);
                        } else if (cb) {
                            var storage = siesta.ext.storage;
                            if (storage) {
                                storage.store.getFromPouch(opts, cb);
                            } else {
                                throw new Error('Storage module not installed');
                            }
                        }
                    }
                }
            } else if (opts.model) {
                if (util.isArray(opts[opts.model.id])) {
                    // Proxy onto getMultiple instead.
                    getMultiple(_.map(opts[opts.model.id], function (id) {
                        var o = {};
                        o[opts.model.id] = id;
                        o.model = opts.model;
                        return o
                    }), cb);
                } else {
                    siestaModel = cache.get(opts);
                    if (siestaModel) {
                        if (log.enabled)
                            log('Had cached object', {
                                opts: opts,
                                obj: siestaModel
                            });
                        if (cb) cb(null, siestaModel);
                    } else {
                        var model = opts.model;
                        if (model.singleton) {
                            model.one(cb);
                        } else {
                            var idField = model.id;
                            var id = opts[idField];
                            var oneOpts = {};
                            oneOpts[idField] = id;
                            if (id) {
                                model.one(oneOpts, function (err, obj) {
                                    if (!err) {
                                        if (obj) {
                                            cb(null, obj);
                                        } else {
                                            cb(null, null);
                                        }
                                    } else {
                                        cb(err);
                                    }
                                });
                            } else {
                                throw new InternalSiestaError('Invalid options given to store. Missing "' + idField.toString() + '."');
                            }
                        }

                    }
                }
            } else {
                // No way in which to find an object locally.
                var context = {
                    opts: opts
                };
                var msg = 'Invalid options given to store';
                throw new InternalSiestaError(msg, context);
            }
        }.bind(this));
    }

    function getMultiple(optsArray, cb) {
        return util.promise(cb, function (cb) {
            var docs = [];
            var errors = [];
            _.each(optsArray, function (opts) {
                get(opts, function (err, doc) {
                    if (err) {
                        errors.push(err);
                    } else {
                        docs.push(doc);
                    }
                    if (docs.length + errors.length == optsArray.length) {
                        if (cb) {
                            if (errors.length) {
                                cb(errors);
                            } else {
                                cb(null, docs);
                            }
                        }
                    }
                });
            });
        }.bind(this));
    }

    /**
     * Uses pouch bulk fetch API. Much faster than getMultiple.
     * @param localIdentifiers
     * @param cb
     */
    function getMultipleLocal(localIdentifiers, cb) {
        return util.promise(cb, function (cb) {
            var results = _.reduce(localIdentifiers, function (memo, _id) {
                var obj = cache.get({
                    _id: _id
                });
                if (obj) {
                    memo.cached[_id] = obj;
                } else {
                    memo.notCached.push(_id);
                }
                return memo;
            }, {
                cached: {},
                notCached: []
            });

            function finish(err) {
                if (cb) {
                    if (err) {
                        cb(err);
                    } else {
                        cb(null, _.map(localIdentifiers, function (_id) {
                            return results.cached[_id];
                        }));
                    }
                }
            }

            finish();
        }.bind(this));
    }

    function getMultipleRemote(remoteIdentifiers, model, cb) {
        return util.promise(cb, function (cb) {
            var results = _.reduce(remoteIdentifiers, function (memo, id) {
                var cacheQuery = {
                    model: model
                };
                cacheQuery[model.id] = id;
                var obj = cache.get(cacheQuery);
                if (obj) {
                    memo.cached[id] = obj;
                } else {
                    memo.notCached.push(id);
                }
                return memo;
            }, {
                cached: {},
                notCached: []
            });

            function finish(err) {
                if (cb) {
                    if (err) {
                        cb(err);
                    } else {
                        cb(null, _.map(remoteIdentifiers, function (id) {
                            return results.cached[id];
                        }));
                    }
                }
            }

            finish();
        }.bind(this));
    }

    module.exports = {
        get: get,
        getMultiple: getMultiple,
        getMultipleLocal: getMultipleLocal,
        getMultipleRemote: getMultipleRemote
    };

})();
},{"./cache":12,"./error":15,"./log":18,"./util":24}],23:[function(require,module,exports){
(function () {
    var misc = require('./misc'),
        _ = require('./underscore');

    function doParallel(fn) {
        return function () {
            var args = Array.prototype.slice.call(arguments);
            return fn.apply(null, [each].concat(args));
        };
    }

    var map = doParallel(_asyncMap);

    var root;

    function _map(arr, iterator) {
        if (arr.map) {
            return arr.map(iterator);
        }
        var results = [];
        each(arr, function (x, i, a) {
            results.push(iterator(x, i, a));
        });
        return results;
    }

    function _asyncMap(eachfn, arr, iterator, callback) {
        arr = _map(arr, function (x, i) {
            return {
                index: i,
                value: x
            };
        });
        if (!callback) {
            eachfn(arr, function (x, callback) {
                iterator(x.value, function (err) {
                    callback(err);
                });
            });
        } else {
            var results = [];
            eachfn(arr, function (x, callback) {
                iterator(x.value, function (err, v) {
                    results[x.index] = v;
                    callback(err);
                });
            }, function (err) {
                callback(err, results);
            });
        }
    }

    var mapSeries = doSeries(_asyncMap);

    function doSeries(fn) {
        return function () {
            var args = Array.prototype.slice.call(arguments);
            return fn.apply(null, [eachSeries].concat(args));
        };
    }


    function eachSeries(arr, iterator, callback) {
        callback = callback || function () {};
        if (!arr.length) {
            return callback();
        }
        var completed = 0;
        var iterate = function () {
            iterator(arr[completed], function (err) {
                if (err) {
                    callback(err);
                    callback = function () {};
                } else {
                    completed += 1;
                    if (completed >= arr.length) {
                        callback();
                    } else {
                        iterate();
                    }
                }
            });
        };
        iterate();
    }


    function _each(arr, iterator) {
        if (arr.forEach) {
            return arr.forEach(iterator);
        }
        for (var i = 0; i < arr.length; i += 1) {
            iterator(arr[i], i, arr);
        }
    }

    function each(arr, iterator, callback) {
        callback = callback || function () {};
        if (!arr.length) {
            return callback();
        }
        var completed = 0;
        _each(arr, function (x) {
            iterator(x, only_once(done));
        });

        function done(err) {
            if (err) {
                callback(err);
                callback = function () {};
            } else {
                completed += 1;
                if (completed >= arr.length) {
                    callback();
                }
            }
        }
    }




    var _parallel = function (eachfn, tasks, callback) {
        callback = callback || function () {};
        if (misc.isArray(tasks)) {
            eachfn.map(tasks, function (fn, callback) {
                if (fn) {
                    fn(function (err) {
                        var args = Array.prototype.slice.call(arguments, 1);
                        if (args.length <= 1) {
                            args = args[0];
                        }
                        callback.call(null, err, args);
                    });
                }
            }, callback);
        } else {
            var results = {};
            eachfn.each(Object.keys(tasks), function (k, callback) {
                tasks[k](function (err) {
                    var args = Array.prototype.slice.call(arguments, 1);
                    if (args.length <= 1) {
                        args = args[0];
                    }
                    results[k] = args;
                    callback(err);
                });
            }, function (err) {
                callback(err, results);
            });
        }
    };

    function series(tasks, callback) {
        callback = callback || function () {};
        if (misc.isArray(tasks)) {
            mapSeries(tasks, function (fn, callback) {
                if (fn) {
                    fn(function (err) {
                        var args = Array.prototype.slice.call(arguments, 1);
                        if (args.length <= 1) {
                            args = args[0];
                        }
                        callback.call(null, err, args);
                    });
                }
            }, callback);
        } else {
            var results = {};
            eachSeries(_.keys(tasks), function (k, callback) {
                tasks[k](function (err) {
                    var args = Array.prototype.slice.call(arguments, 1);
                    if (args.length <= 1) {
                        args = args[0];
                    }
                    results[k] = args;
                    callback(err);
                });
            }, function (err) {
                callback(err, results);
            });
        }
    }

    function only_once(fn) {
        var called = false;
        return function () {
            if (called) throw new Error("Callback was already called.");
            called = true;
            fn.apply(root, arguments);
        }
    }

    function parallel(tasks, callback) {
        _parallel({
            map: map,
            each: each
        }, tasks, callback);
    }

    module.exports = {
        series: series,
        parallel: parallel
    };
})();
},{"./misc":25,"./underscore":26}],24:[function(require,module,exports){
/*
 * This is a collection of utilities taken from libraries such as async.js, underscore.js etc.
 * @module util
 */

(function () {
    var _ = require('./underscore'),
        async = require('./async'),
        misc = require('./misc');

    _.extend(module.exports, {
        _: _,
        async: async
    });
    _.extend(module.exports, misc);

})();
},{"./async":23,"./misc":25,"./underscore":26}],25:[function(require,module,exports){
(function () {
    var observe = require('../../vendor/observe-js/src/observe').Platform,
        _ = require('./underscore'),
        Promise = require('lie'),
        argsarray = require('argsarray'),
        InternalSiestaError = require('./../error').InternalSiestaError;

    // Used by paramNames function.
    var FN_ARGS = /^function\s*[^\(]*\(\s*([^\)]*)\)/m,
        FN_ARG_SPLIT = /,/,
        FN_ARG = /^\s*(_?)(.+?)\1\s*$/,
        STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg;

    function cb(callback, deferred) {
        return function (err) {
            if (callback) callback.apply(callback, arguments);
            if (deferred) {
                if (err) {
                    deferred.reject(err);
                }
                else {
                    deferred.resolve.apply(deferred, Array.prototype.slice.call(arguments, 1));
                }
            }
        };
    }

    var isArrayShim = function (obj) {
            return _.toString.call(obj) === '[object Array]';
        },
        isArray = Array.isArray || isArrayShim,
        isString = function (o) {
            return typeof o == 'string' || o instanceof String
        };
    _.extend(module.exports, {
        /**
         * Performs dirty check/Object.observe callbacks depending on the browser.
         *
         * If Object.observe is present,
         * @param callback
         */
        next: function (callback) {
            observe.performMicrotaskCheckpoint();
            setTimeout(callback);
        },
        /**
         * Returns a handler that acts upon a callback or a promise depending on the result of a different callback.
         * @param callback
         * @param [deferred]
         * @returns {Function}
         */
        cb: cb,
        guid: (function () {
            function s4() {
                return Math.floor((1 + Math.random()) * 0x10000)
                    .toString(16)
                    .substring(1);
            }

            return function () {
                return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
                    s4() + '-' + s4() + s4() + s4();
            };
        })(),
        assert: function (condition, message, context) {
            if (!condition) {
                message = message || "Assertion failed";
                context = context || {};
                throw new InternalSiestaError(message, context);
            }
        },
        thenBy: (function () {
            /* mixin for the `thenBy` property */
            function extend(f) {
                f.thenBy = tb;
                return f;
            }

            /* adds a secondary compare function to the target function (`this` context)
             which is applied in case the first one returns 0 (equal)
             returns a new compare function, which has a `thenBy` method as well */
            function tb(y) {
                var x = this;
                return extend(function (a, b) {
                    return x(a, b) || y(a, b);
                });
            }

            return extend;
        })(),
        defineSubProperty: function (property, subObj, innerProperty) {
            return Object.defineProperty(this, property, {
                get: function () {
                    if (innerProperty) {
                        return subObj[innerProperty];
                    }
                    else {
                        return subObj[property];
                    }
                },
                set: function (value) {
                    if (innerProperty) {
                        subObj[innerProperty] = value;
                    }
                    else {
                        subObj[property] = value;
                    }
                },
                enumerable: true,
                configurable: true
            });
        },
        defineSubPropertyNoSet: function (property, subObj, innerProperty) {
            return Object.defineProperty(this, property, {
                get: function () {
                    if (innerProperty) {
                        return subObj[innerProperty];
                    }
                    else {
                        return subObj[property];
                    }
                },
                enumerable: true,
                configurable: true
            });
        },
        /**
         * TODO: This is bloody ugly.
         * Pretty damn useful to be able to access the bound object on a function tho.
         * See: http://stackoverflow.com/questions/14307264/what-object-javascript-function-is-bound-to-what-is-its-this
         */
        _patchBind: function () {
            var _bind = Function.prototype.apply.bind(Function.prototype.bind);
            Object.defineProperty(Function.prototype, 'bind', {
                value: function (obj) {
                    var boundFunction = _bind(this, arguments);
                    Object.defineProperty(boundFunction, '__siesta_bound_object', {
                        value: obj,
                        writable: true,
                        configurable: true,
                        enumerable: false
                    });
                    return boundFunction;
                }
            });
        },
        Promise: Promise,
        promise: function (cb, fn) {
            cb = cb || function () {
            };
            return new Promise(function (resolve, reject) {
                var _cb = argsarray(function (args) {
                    var err = args[0],
                        rest = args.slice(1);
                    if (err) reject(err);
                    else resolve(rest[0]);
                    var bound = cb['__siesta_bound_object'] || cb; // Preserve bound object.
                    cb.apply(bound, args);
                });
                fn(_cb);
            })
        },
        subProperties: function (obj, subObj, properties) {
            if (!isArray(properties)) {
                properties = Array.prototype.slice.call(arguments, 2);
            }
            for (var i = 0; i < properties.length; i++) {
                (function (property) {
                    var opts = {
                        set: false,
                        name: property,
                        property: property
                    };
                    if (!isString(property)) {
                        _.extend(opts, property);
                    }
                    var desc = {
                        get: function () {
                            return subObj[opts.property];
                        },
                        enumerable: true,
                        configurable: true
                    };
                    if (opts.set) {
                        desc.set = function (v) {
                            subObj[opts.property] = v;
                        };
                    }
                    Object.defineProperty(obj, opts.name, desc);
                })(properties[i]);
            }
        },
        capitaliseFirstLetter: function (string) {
            return string.charAt(0).toUpperCase() + string.slice(1);
        },
        extendFromOpts: function (obj, opts, defaults, errorOnUnknown) {
            errorOnUnknown = errorOnUnknown == undefined ? true : errorOnUnknown;
            if (errorOnUnknown) {
                var defaultKeys = Object.keys(defaults),
                    optsKeys = Object.keys(opts);
                var unknownKeys = optsKeys.filter(function (n) {
                    return defaultKeys.indexOf(n) == -1
                });
                if (unknownKeys.length) throw Error('Unknown options: ' + unknownKeys.toString());
            }
            // Apply any functions specified in the defaults.
            _.each(Object.keys(defaults), function (k) {
                var d = defaults[k];
                if (typeof d == 'function') {
                    defaults[k] = d(opts[k]);
                    delete opts[k];
                }
            });
            _.extend(defaults, opts);
            _.extend(obj, defaults);
        },
        isString: isString,
        isArray: isArray,
        prettyPrint: function (o) {
            return JSON.stringify(o, null, 4);
        },
        flattenArray: function (arr) {
            return _.reduce(arr, function (memo, e) {
                if (isArray(e)) {
                    memo = memo.concat(e);
                } else {
                    memo.push(e);
                }
                return memo;
            }, []);
        },
        unflattenArray: function (arr, modelArr) {
            var n = 0;
            var unflattened = [];
            for (var i = 0; i < modelArr.length; i++) {
                if (isArray(modelArr[i])) {
                    var newArr = [];
                    unflattened[i] = newArr;
                    for (var j = 0; j < modelArr[i].length; j++) {
                        newArr.push(arr[n]);
                        n++;
                    }
                } else {
                    unflattened[i] = arr[n];
                    n++;
                }
            }
            return unflattened;
        },
        /**
         * Return the parameter names of a function.
         * Note: adapted from AngularJS dependency injection :)
         * @param fn
         */
        paramNames: function (fn) {
            // TODO: Is there a more robust way of doing this?
            var params = [],
                fnText,
                argDecl;
            fnText = fn.toString().replace(STRIP_COMMENTS, '');
            argDecl = fnText.match(FN_ARGS);

            argDecl[1].split(FN_ARG_SPLIT).forEach(function (arg) {
                arg.replace(FN_ARG, function (all, underscore, name) {
                    params.push(name);
                });
            });
            return params;
        }
    });
})();
},{"../../vendor/observe-js/src/observe":53,"./../error":15,"./underscore":26,"argsarray":27,"lie":37}],26:[function(require,module,exports){
/**
 * Often used functions from underscore, pulled out for brevity.
 * @module underscore
 */

(function () {
    var _ = {},
        ArrayProto = Array.prototype,
        FuncProto = Function.prototype,
        nativeForEach = ArrayProto.forEach,
        nativeMap = ArrayProto.map,
        nativeReduce = ArrayProto.reduce,
        nativeBind = FuncProto.bind,
        slice = ArrayProto.slice,
        breaker = {},
        ctor = function () {
        };

    function keys(obj) {
        if (Object.keys) {
            return Object.keys(obj);
        }
        var keys = [];
        for (var k in obj) {
            if (obj.hasOwnProperty(k)) {
                keys.push(k);
            }
        }
        return keys;
    }

    _.keys = keys;

    _.each = _.forEach = function (obj, iterator, context) {
        if (obj == null) return obj;
        if (nativeForEach && obj.forEach === nativeForEach) {
            obj.forEach(iterator, context);
        } else if (obj.length === +obj.length) {
            for (var i = 0, length = obj.length; i < length; i++) {
                if (iterator.call(context, obj[i], i, obj) === breaker) return;
            }
        } else {
            var keys = _.keys(obj);
            for (var i = 0, length = keys.length; i < length; i++) {
                if (iterator.call(context, obj[keys[i]], keys[i], obj) === breaker) return;
            }
        }
        return obj;
    };

    // Return the results of applying the iterator to each element.
    // Delegates to **ECMAScript 5**'s native `map` if available.
    _.map = _.collect = function (obj, iterator, context) {
        var results = [];
        if (obj == null) return results;
        if (nativeMap && obj.map === nativeMap) return obj.map(iterator, context);
        _.each(obj, function (value, index, list) {
            results.push(iterator.call(context, value, index, list));
        });
        return results;
    };

    // Internal function that returns an efficient (for current engines) version
    // of the passed-in callback, to be repeatedly applied in other Underscore
    // functions.
    var createCallback = function (func, context, argCount) {
        if (context === void 0) return func;
        switch (argCount == null ? 3 : argCount) {
            case 1:
                return function (value) {
                    return func.call(context, value);
                };
            case 2:
                return function (value, other) {
                    return func.call(context, value, other);
                };
            case 3:
                return function (value, index, collection) {
                    return func.call(context, value, index, collection);
                };
            case 4:
                return function (accumulator, value, index, collection) {
                    return func.call(context, accumulator, value, index, collection);
                };
        }
        return function () {
            return func.apply(context, arguments);
        };
    };

    // Run a function **n** times.
    _.times = function (n, iteratee, context) {
        var accum = new Array(Math.max(0, n));
        iteratee = createCallback(iteratee, context, 1);
        for (var i = 0; i < n; i++) accum[i] = iteratee(i);
        return accum;
    };

    // Partially apply a function by creating a version that has had some of its
    // arguments pre-filled, without changing its dynamic `this` context. _ acts
    // as a placeholder, allowing any combination of arguments to be pre-filled.
    _.partial = function (func) {
        var boundArgs = slice.call(arguments, 1);
        return function () {
            var position = 0;
            var args = boundArgs.slice();
            for (var i = 0, length = args.length; i < length; i++) {
                if (args[i] === _) args[i] = arguments[position++];
            }
            while (position < arguments.length) args.push(arguments[position++]);
            return func.apply(this, args);
        };
    };

    // Convenience version of a common use case of `map`: fetching a property.
    _.pluck = function (obj, key) {
        return _.map(obj, _.property(key));
    };

    var reduceError = 'Reduce of empty array with no initial value';

    // **Reduce** builds up a single result from a list of values, aka `inject`,
    // or `foldl`. Delegates to **ECMAScript 5**'s native `reduce` if available.
    _.reduce = _.foldl = _.inject = function (obj, iterator, memo, context) {
        var initial = arguments.length > 2;
        if (obj == null) obj = [];
        if (nativeReduce && obj.reduce === nativeReduce) {
            if (context) iterator = _.bind(iterator, context);
            return initial ? obj.reduce(iterator, memo) : obj.reduce(iterator);
        }
        _.each(obj, function (value, index, list) {
            if (!initial) {
                memo = value;
                initial = true;
            } else {
                memo = iterator.call(context, memo, value, index, list);
            }
        });
        if (!initial) throw new TypeError(reduceError);
        return memo;
    };

    _.property = function (key) {
        return function (obj) {
            return obj[key];
        };
    };

    // Optimize `isFunction` if appropriate.
    if (typeof(/./) !== 'function') {
        _.isFunction = function (obj) {
            return typeof obj === 'function';
        };
    }

    _.isObject = function (obj) {
        var type = typeof obj;
        return type === 'function' || type === 'object' && !!obj;
    };

    // An internal function to generate lookup iterators.
    var lookupIterator = function (value) {
        if (value == null) return _.identity;
        if (_.isFunction(value)) return value;
        return _.property(value);
    };

    // Sort the object's values by a criterion produced by an iterator.
    _.sortBy = function (obj, iterator, context) {
        iterator = lookupIterator(iterator);
        return _.pluck(_.map(obj, function (value, index, list) {
            return {
                value: value,
                index: index,
                criteria: iterator.call(context, value, index, list)
            };
        }).sort(function (left, right) {
            var a = left.criteria;
            var b = right.criteria;
            if (a !== b) {
                if (a > b || a === void 0) return 1;
                if (a < b || b === void 0) return -1;
            }
            return left.index - right.index;
        }), 'value');
    };


    // Create a function bound to a given object (assigning `this`, and arguments,
    // optionally). Delegates to **ECMAScript 5**'s native `Function.bind` if
    // available.
    _.bind = function (func, context) {
        var args, bound;
        if (nativeBind && func.bind === nativeBind) return nativeBind.apply(func, slice.call(arguments, 1));
        if (!_.isFunction(func)) throw new TypeError;
        args = slice.call(arguments, 2);
        return bound = function () {
            if (!(this instanceof bound)) return func.apply(context, args.concat(slice.call(arguments)));
            ctor.prototype = func.prototype;
            var self = new ctor;
            ctor.prototype = null;
            u
            var result = func.apply(self, args.concat(slice.call(arguments)));
            if (Object(result) === result) return result;
            return self;
        };
    };

    _.identity = function (value) {
        return value;
    };

    _.zip = function (array) {
        if (array == null) return [];
        var length = _.max(arguments, 'length').length;
        var results = Array(length);
        for (var i = 0; i < length; i++) {
            results[i] = _.pluck(arguments, i);
        }
        return results;
    };

    // Return the maximum element (or element-based computation).
    _.max = function (obj, iteratee, context) {
        var result = -Infinity,
            lastComputed = -Infinity,
            value, computed;
        if (iteratee == null && obj != null) {
            obj = obj.length === +obj.length ? obj : _.values(obj);
            for (var i = 0, length = obj.length; i < length; i++) {
                value = obj[i];
                if (value > result) {
                    result = value;
                }
            }
        } else {
            iteratee = _.iteratee(iteratee, context);
            _.each(obj, function (value, index, list) {
                computed = iteratee(value, index, list);
                if (computed > lastComputed || computed === -Infinity && result === -Infinity) {
                    result = value;
                    lastComputed = computed;
                }
            });
        }
        return result;
    };


    _.iteratee = function (value, context, argCount) {
        if (value == null) return _.identity;
        if (_.isFunction(value)) return createCallback(value, context, argCount);
        if (_.isObject(value)) return _.matches(value);
        return _.property(value);
    };

    _.pairs = function (obj) {
        var keys = _.keys(obj);
        var length = keys.length;
        var pairs = Array(length);
        for (var i = 0; i < length; i++) {
            pairs[i] = [keys[i], obj[keys[i]]];
        }
        return pairs;
    };

    _.matches = function (attrs) {
        var pairs = _.pairs(attrs),
            length = pairs.length;
        return function (obj) {
            if (obj == null) return !length;
            obj = new Object(obj);
            for (var i = 0; i < length; i++) {
                var pair = pairs[i],
                    key = pair[0];
                if (pair[1] !== obj[key] || !(key in obj)) return false;
            }
            return true;
        };
    };

    _.some = function (obj, predicate, context) {
        if (obj == null) return false;
        predicate = _.iteratee(predicate, context);
        var keys = obj.length !== +obj.length && _.keys(obj),
            length = (keys || obj).length,
            index, currentKey;
        for (index = 0; index < length; index++) {
            currentKey = keys ? keys[index] : index;
            if (predicate(obj[currentKey], currentKey, obj)) return true;
        }
        return false;
    };


    // Extend a given object with all the properties in passed-in object(s).
    _.extend = function (obj) {
        if (!_.isObject(obj)) return obj;
        var source, prop;
        for (var i = 1, length = arguments.length; i < length; i++) {
            source = arguments[i];
            for (prop in source) {
                //noinspection JSUnfilteredForInLoop
                if (hasOwnProperty.call(source, prop)) {
                    //noinspection JSUnfilteredForInLoop
                    obj[prop] = source[prop];
                }
            }
        }
        return obj;
    };

    module.exports = _;
})();
},{}],27:[function(require,module,exports){
'use strict';

module.exports = argsArray;

function argsArray(fun) {
  return function () {
    var len = arguments.length;
    if (len) {
      var args = [];
      var i = -1;
      while (++i < len) {
        args[i] = arguments[i];
      }
      return fun.call(this, args);
    } else {
      return fun.call(this, []);
    }
  };
}
},{}],28:[function(require,module,exports){

},{}],29:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      }
      throw TypeError('Uncaught, unspecified "error" event.');
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        len = arguments.length;
        args = new Array(len - 1);
        for (i = 1; i < len; i++)
          args[i - 1] = arguments[i];
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    len = arguments.length;
    args = new Array(len - 1);
    for (i = 1; i < len; i++)
      args[i - 1] = arguments[i];

    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    var m;
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  var ret;
  if (!emitter._events || !emitter._events[type])
    ret = 0;
  else if (isFunction(emitter._events[type]))
    ret = 1;
  else
    ret = emitter._events[type].length;
  return ret;
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],30:[function(require,module,exports){

/**
 * This is the web browser implementation of `debug()`.
 *
 * Expose `debug()` as the module.
 */

exports = module.exports = require('./debug');
exports.log = log;
exports.formatArgs = formatArgs;
exports.save = save;
exports.load = load;
exports.useColors = useColors;

/**
 * Use chrome.storage.local if we are in an app
 */

var storage;

if (typeof chrome !== 'undefined' && typeof chrome.storage !== 'undefined')
  storage = chrome.storage.local;
else
  storage = window.localStorage;

/**
 * Colors.
 */

exports.colors = [
  'lightseagreen',
  'forestgreen',
  'goldenrod',
  'dodgerblue',
  'darkorchid',
  'crimson'
];

/**
 * Currently only WebKit-based Web Inspectors, Firefox >= v31,
 * and the Firebug extension (any Firefox version) are known
 * to support "%c" CSS customizations.
 *
 * TODO: add a `localStorage` variable to explicitly enable/disable colors
 */

function useColors() {
  // is webkit? http://stackoverflow.com/a/16459606/376773
  return ('WebkitAppearance' in document.documentElement.style) ||
    // is firebug? http://stackoverflow.com/a/398120/376773
    (window.console && (console.firebug || (console.exception && console.table))) ||
    // is firefox >= v31?
    // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
    (navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/) && parseInt(RegExp.$1, 10) >= 31);
}

/**
 * Map %j to `JSON.stringify()`, since no Web Inspectors do that by default.
 */

exports.formatters.j = function(v) {
  return JSON.stringify(v);
};


/**
 * Colorize log arguments if enabled.
 *
 * @api public
 */

function formatArgs() {
  var args = arguments;
  var useColors = this.useColors;

  args[0] = (useColors ? '%c' : '')
    + this.namespace
    + (useColors ? ' %c' : ' ')
    + args[0]
    + (useColors ? '%c ' : ' ')
    + '+' + exports.humanize(this.diff);

  if (!useColors) return args;

  var c = 'color: ' + this.color;
  args = [args[0], c, 'color: inherit'].concat(Array.prototype.slice.call(args, 1));

  // the final "%c" is somewhat tricky, because there could be other
  // arguments passed either before or after the %c, so we need to
  // figure out the correct index to insert the CSS into
  var index = 0;
  var lastC = 0;
  args[0].replace(/%[a-z%]/g, function(match) {
    if ('%%' === match) return;
    index++;
    if ('%c' === match) {
      // we only are interested in the *last* %c
      // (the user may have provided their own)
      lastC = index;
    }
  });

  args.splice(lastC, 0, c);
  return args;
}

/**
 * Invokes `console.log()` when available.
 * No-op when `console.log` is not a "function".
 *
 * @api public
 */

function log() {
  // this hackery is required for IE8/9, where
  // the `console.log` function doesn't have 'apply'
  return 'object' === typeof console
    && console.log
    && Function.prototype.apply.call(console.log, console, arguments);
}

/**
 * Save `namespaces`.
 *
 * @param {String} namespaces
 * @api private
 */

function save(namespaces) {
  try {
    if (null == namespaces) {
      storage.removeItem('debug');
    } else {
      storage.debug = namespaces;
    }
  } catch(e) {}
}

/**
 * Load `namespaces`.
 *
 * @return {String} returns the previously persisted debug modes
 * @api private
 */

function load() {
  var r;
  try {
    r = storage.debug;
  } catch(e) {}
  return r;
}

/**
 * Enable namespaces listed in `localStorage.debug` initially.
 */

exports.enable(load());

},{"./debug":31}],31:[function(require,module,exports){

/**
 * This is the common logic for both the Node.js and web browser
 * implementations of `debug()`.
 *
 * Expose `debug()` as the module.
 */

exports = module.exports = debug;
exports.coerce = coerce;
exports.disable = disable;
exports.enable = enable;
exports.enabled = enabled;
exports.humanize = require('ms');

/**
 * The currently active debug mode names, and names to skip.
 */

exports.names = [];
exports.skips = [];

/**
 * Map of special "%n" handling functions, for the debug "format" argument.
 *
 * Valid key names are a single, lowercased letter, i.e. "n".
 */

exports.formatters = {};

/**
 * Previously assigned color.
 */

var prevColor = 0;

/**
 * Previous log timestamp.
 */

var prevTime;

/**
 * Select a color.
 *
 * @return {Number}
 * @api private
 */

function selectColor() {
  return exports.colors[prevColor++ % exports.colors.length];
}

/**
 * Create a debugger with the given `namespace`.
 *
 * @param {String} namespace
 * @return {Function}
 * @api public
 */

function debug(namespace) {

  // define the `disabled` version
  function disabled() {
  }
  disabled.enabled = false;

  // define the `enabled` version
  function enabled() {

    var self = enabled;

    // set `diff` timestamp
    var curr = +new Date();
    var ms = curr - (prevTime || curr);
    self.diff = ms;
    self.prev = prevTime;
    self.curr = curr;
    prevTime = curr;

    // add the `color` if not set
    if (null == self.useColors) self.useColors = exports.useColors();
    if (null == self.color && self.useColors) self.color = selectColor();

    var args = Array.prototype.slice.call(arguments);

    args[0] = exports.coerce(args[0]);

    if ('string' !== typeof args[0]) {
      // anything else let's inspect with %o
      args = ['%o'].concat(args);
    }

    // apply any `formatters` transformations
    var index = 0;
    args[0] = args[0].replace(/%([a-z%])/g, function(match, format) {
      // if we encounter an escaped % then don't increase the array index
      if (match === '%%') return match;
      index++;
      var formatter = exports.formatters[format];
      if ('function' === typeof formatter) {
        var val = args[index];
        match = formatter.call(self, val);

        // now we need to remove `args[index]` since it's inlined in the `format`
        args.splice(index, 1);
        index--;
      }
      return match;
    });

    if ('function' === typeof exports.formatArgs) {
      args = exports.formatArgs.apply(self, args);
    }
    var logFn = enabled.log || exports.log || console.log.bind(console);
    logFn.apply(self, args);
  }
  enabled.enabled = true;

  var fn = exports.enabled(namespace) ? enabled : disabled;

  fn.namespace = namespace;

  return fn;
}

/**
 * Enables a debug mode by namespaces. This can include modes
 * separated by a colon and wildcards.
 *
 * @param {String} namespaces
 * @api public
 */

function enable(namespaces) {
  exports.save(namespaces);

  var split = (namespaces || '').split(/[\s,]+/);
  var len = split.length;

  for (var i = 0; i < len; i++) {
    if (!split[i]) continue; // ignore empty strings
    namespaces = split[i].replace(/\*/g, '.*?');
    if (namespaces[0] === '-') {
      exports.skips.push(new RegExp('^' + namespaces.substr(1) + '$'));
    } else {
      exports.names.push(new RegExp('^' + namespaces + '$'));
    }
  }
}

/**
 * Disable debug output.
 *
 * @api public
 */

function disable() {
  exports.enable('');
}

/**
 * Returns true if the given mode name is enabled, false otherwise.
 *
 * @param {String} name
 * @return {Boolean}
 * @api public
 */

function enabled(name) {
  var i, len;
  for (i = 0, len = exports.skips.length; i < len; i++) {
    if (exports.skips[i].test(name)) {
      return false;
    }
  }
  for (i = 0, len = exports.names.length; i < len; i++) {
    if (exports.names[i].test(name)) {
      return true;
    }
  }
  return false;
}

/**
 * Coerce `val`.
 *
 * @param {Mixed} val
 * @return {Mixed}
 * @api private
 */

function coerce(val) {
  if (val instanceof Error) return val.stack || val.message;
  return val;
}

},{"ms":32}],32:[function(require,module,exports){
/**
 * Helpers.
 */

var s = 1000;
var m = s * 60;
var h = m * 60;
var d = h * 24;
var y = d * 365.25;

/**
 * Parse or format the given `val`.
 *
 * Options:
 *
 *  - `long` verbose formatting [false]
 *
 * @param {String|Number} val
 * @param {Object} options
 * @return {String|Number}
 * @api public
 */

module.exports = function(val, options){
  options = options || {};
  if ('string' == typeof val) return parse(val);
  return options.long
    ? long(val)
    : short(val);
};

/**
 * Parse the given `str` and return milliseconds.
 *
 * @param {String} str
 * @return {Number}
 * @api private
 */

function parse(str) {
  var match = /^((?:\d+)?\.?\d+) *(ms|seconds?|s|minutes?|m|hours?|h|days?|d|years?|y)?$/i.exec(str);
  if (!match) return;
  var n = parseFloat(match[1]);
  var type = (match[2] || 'ms').toLowerCase();
  switch (type) {
    case 'years':
    case 'year':
    case 'y':
      return n * y;
    case 'days':
    case 'day':
    case 'd':
      return n * d;
    case 'hours':
    case 'hour':
    case 'h':
      return n * h;
    case 'minutes':
    case 'minute':
    case 'm':
      return n * m;
    case 'seconds':
    case 'second':
    case 's':
      return n * s;
    case 'ms':
      return n;
  }
}

/**
 * Short format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

function short(ms) {
  if (ms >= d) return Math.round(ms / d) + 'd';
  if (ms >= h) return Math.round(ms / h) + 'h';
  if (ms >= m) return Math.round(ms / m) + 'm';
  if (ms >= s) return Math.round(ms / s) + 's';
  return ms + 'ms';
}

/**
 * Long format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

function long(ms) {
  return plural(ms, d, 'day')
    || plural(ms, h, 'hour')
    || plural(ms, m, 'minute')
    || plural(ms, s, 'second')
    || ms + ' ms';
}

/**
 * Pluralization helper.
 */

function plural(ms, n, name) {
  if (ms < n) return;
  if (ms < n * 1.5) return Math.floor(ms / n) + ' ' + name;
  return Math.ceil(ms / n) + ' ' + name + 's';
}

},{}],33:[function(require,module,exports){
var hasOwn = Object.prototype.hasOwnProperty;
var toString = Object.prototype.toString;
var undefined;

var isPlainObject = function isPlainObject(obj) {
    "use strict";
    if (!obj || toString.call(obj) !== '[object Object]' || obj.nodeType || obj.setInterval) {
        return false;
    }

    var has_own_constructor = hasOwn.call(obj, 'constructor');
    var has_is_property_of_method = obj.constructor && obj.constructor.prototype && hasOwn.call(obj.constructor.prototype, 'isPrototypeOf');
    // Not own constructor property must be Object
    if (obj.constructor && !has_own_constructor && !has_is_property_of_method) {
        return false;
    }

    // Own properties are enumerated firstly, so to speed up,
    // if last one is own, then all properties are own.
    var key;
    for (key in obj) {}

    return key === undefined || hasOwn.call(obj, key);
};

module.exports = function extend() {
    "use strict";
    var options, name, src, copy, copyIsArray, clone,
        target = arguments[0],
        i = 1,
        length = arguments.length,
        deep = false;

    // Handle a deep copy situation
    if (typeof target === "boolean") {
        deep = target;
        target = arguments[1] || {};
        // skip the boolean and the target
        i = 2;
    } else if (typeof target !== "object" && typeof target !== "function" || target == undefined) {
        target = {};
    }

    for (; i < length; ++i) {
        // Only deal with non-null/undefined values
        if ((options = arguments[i]) != null) {
            // Extend the base object
            for (name in options) {
                src = target[name];
                copy = options[name];

                // Prevent never-ending loop
                if (target === copy) {
                    continue;
                }

                // Recurse if we're merging plain objects or arrays
                if (deep && copy && (isPlainObject(copy) || (copyIsArray = Array.isArray(copy)))) {
                    if (copyIsArray) {
                        copyIsArray = false;
                        clone = src && Array.isArray(src) ? src : [];
                    } else {
                        clone = src && isPlainObject(src) ? src : {};
                    }

                    // Never move original objects, clone them
                    target[name] = extend(deep, clone, copy);

                    // Don't bring in undefined values
                } else if (copy !== undefined) {
                    target[name] = copy;
                }
            }
        }
    }

    // Return the modified object
    return target;
};


},{}],34:[function(require,module,exports){
'use strict';

module.exports = INTERNAL;

function INTERNAL() {}
},{}],35:[function(require,module,exports){
'use strict';
var Promise = require('./promise');
var reject = require('./reject');
var resolve = require('./resolve');
var INTERNAL = require('./INTERNAL');
var handlers = require('./handlers');
module.exports = all;
function all(iterable) {
  if (Object.prototype.toString.call(iterable) !== '[object Array]') {
    return reject(new TypeError('must be an array'));
  }

  var len = iterable.length;
  var called = false;
  if (!len) {
    return resolve([]);
  }

  var values = new Array(len);
  var resolved = 0;
  var i = -1;
  var promise = new Promise(INTERNAL);
  
  while (++i < len) {
    allResolver(iterable[i], i);
  }
  return promise;
  function allResolver(value, i) {
    resolve(value).then(resolveFromAll, function (error) {
      if (!called) {
        called = true;
        handlers.reject(promise, error);
      }
    });
    function resolveFromAll(outValue) {
      values[i] = outValue;
      if (++resolved === len & !called) {
        called = true;
        handlers.resolve(promise, values);
      }
    }
  }
}
},{"./INTERNAL":34,"./handlers":36,"./promise":38,"./reject":41,"./resolve":42}],36:[function(require,module,exports){
'use strict';
var tryCatch = require('./tryCatch');
var resolveThenable = require('./resolveThenable');
var states = require('./states');

exports.resolve = function (self, value) {
  var result = tryCatch(getThen, value);
  if (result.status === 'error') {
    return exports.reject(self, result.value);
  }
  var thenable = result.value;

  if (thenable) {
    resolveThenable.safely(self, thenable);
  } else {
    self.state = states.FULFILLED;
    self.outcome = value;
    var i = -1;
    var len = self.queue.length;
    while (++i < len) {
      self.queue[i].callFulfilled(value);
    }
  }
  return self;
};
exports.reject = function (self, error) {
  self.state = states.REJECTED;
  self.outcome = error;
  var i = -1;
  var len = self.queue.length;
  while (++i < len) {
    self.queue[i].callRejected(error);
  }
  return self;
};

function getThen(obj) {
  // Make sure we only access the accessor once as required by the spec
  var then = obj && obj.then;
  if (obj && typeof obj === 'object' && typeof then === 'function') {
    return function appyThen() {
      then.apply(obj, arguments);
    };
  }
}
},{"./resolveThenable":43,"./states":44,"./tryCatch":45}],37:[function(require,module,exports){
module.exports = exports = require('./promise');

exports.resolve = require('./resolve');
exports.reject = require('./reject');
exports.all = require('./all');
exports.race = require('./race');
},{"./all":35,"./promise":38,"./race":40,"./reject":41,"./resolve":42}],38:[function(require,module,exports){
'use strict';

var unwrap = require('./unwrap');
var INTERNAL = require('./INTERNAL');
var resolveThenable = require('./resolveThenable');
var states = require('./states');
var QueueItem = require('./queueItem');

module.exports = Promise;
function Promise(resolver) {
  if (!(this instanceof Promise)) {
    return new Promise(resolver);
  }
  if (typeof resolver !== 'function') {
    throw new TypeError('resolver must be a function');
  }
  this.state = states.PENDING;
  this.queue = [];
  this.outcome = void 0;
  if (resolver !== INTERNAL) {
    resolveThenable.safely(this, resolver);
  }
}

Promise.prototype['catch'] = function (onRejected) {
  return this.then(null, onRejected);
};
Promise.prototype.then = function (onFulfilled, onRejected) {
  if (typeof onFulfilled !== 'function' && this.state === states.FULFILLED ||
    typeof onRejected !== 'function' && this.state === states.REJECTED) {
    return this;
  }
  var promise = new Promise(INTERNAL);

  
  if (this.state !== states.PENDING) {
    var resolver = this.state === states.FULFILLED ? onFulfilled: onRejected;
    unwrap(promise, resolver, this.outcome);
  } else {
    this.queue.push(new QueueItem(promise, onFulfilled, onRejected));
  }

  return promise;
};

},{"./INTERNAL":34,"./queueItem":39,"./resolveThenable":43,"./states":44,"./unwrap":46}],39:[function(require,module,exports){
'use strict';
var handlers = require('./handlers');
var unwrap = require('./unwrap');

module.exports = QueueItem;
function QueueItem(promise, onFulfilled, onRejected) {
  this.promise = promise;
  if (typeof onFulfilled === 'function') {
    this.onFulfilled = onFulfilled;
    this.callFulfilled = this.otherCallFulfilled;
  }
  if (typeof onRejected === 'function') {
    this.onRejected = onRejected;
    this.callRejected = this.otherCallRejected;
  }
}
QueueItem.prototype.callFulfilled = function (value) {
  handlers.resolve(this.promise, value);
};
QueueItem.prototype.otherCallFulfilled = function (value) {
  unwrap(this.promise, this.onFulfilled, value);
};
QueueItem.prototype.callRejected = function (value) {
  handlers.reject(this.promise, value);
};
QueueItem.prototype.otherCallRejected = function (value) {
  unwrap(this.promise, this.onRejected, value);
};
},{"./handlers":36,"./unwrap":46}],40:[function(require,module,exports){
'use strict';
var Promise = require('./promise');
var reject = require('./reject');
var resolve = require('./resolve');
var INTERNAL = require('./INTERNAL');
var handlers = require('./handlers');
module.exports = race;
function race(iterable) {
  if (Object.prototype.toString.call(iterable) !== '[object Array]') {
    return reject(new TypeError('must be an array'));
  }

  var len = iterable.length;
  var called = false;
  if (!len) {
    return resolve([]);
  }

  var resolved = 0;
  var i = -1;
  var promise = new Promise(INTERNAL);
  
  while (++i < len) {
    resolver(iterable[i]);
  }
  return promise;
  function resolver(value) {
    resolve(value).then(function (response) {
      if (!called) {
        called = true;
        handlers.resolve(promise, response);
      }
    }, function (error) {
      if (!called) {
        called = true;
        handlers.reject(promise, error);
      }
    });
  }
}
},{"./INTERNAL":34,"./handlers":36,"./promise":38,"./reject":41,"./resolve":42}],41:[function(require,module,exports){
'use strict';

var Promise = require('./promise');
var INTERNAL = require('./INTERNAL');
var handlers = require('./handlers');
module.exports = reject;

function reject(reason) {
	var promise = new Promise(INTERNAL);
	return handlers.reject(promise, reason);
}
},{"./INTERNAL":34,"./handlers":36,"./promise":38}],42:[function(require,module,exports){
'use strict';

var Promise = require('./promise');
var INTERNAL = require('./INTERNAL');
var handlers = require('./handlers');
module.exports = resolve;

var FALSE = handlers.resolve(new Promise(INTERNAL), false);
var NULL = handlers.resolve(new Promise(INTERNAL), null);
var UNDEFINED = handlers.resolve(new Promise(INTERNAL), void 0);
var ZERO = handlers.resolve(new Promise(INTERNAL), 0);
var EMPTYSTRING = handlers.resolve(new Promise(INTERNAL), '');

function resolve(value) {
  if (value) {
    if (value instanceof Promise) {
      return value;
    }
    return handlers.resolve(new Promise(INTERNAL), value);
  }
  var valueType = typeof value;
  switch (valueType) {
    case 'boolean':
      return FALSE;
    case 'undefined':
      return UNDEFINED;
    case 'object':
      return NULL;
    case 'number':
      return ZERO;
    case 'string':
      return EMPTYSTRING;
  }
}
},{"./INTERNAL":34,"./handlers":36,"./promise":38}],43:[function(require,module,exports){
'use strict';
var handlers = require('./handlers');
var tryCatch = require('./tryCatch');
function safelyResolveThenable(self, thenable) {
  // Either fulfill, reject or reject with error
  var called = false;
  function onError(value) {
    if (called) {
      return;
    }
    called = true;
    handlers.reject(self, value);
  }

  function onSuccess(value) {
    if (called) {
      return;
    }
    called = true;
    handlers.resolve(self, value);
  }

  function tryToUnwrap() {
    thenable(onSuccess, onError);
  }
  
  var result = tryCatch(tryToUnwrap);
  if (result.status === 'error') {
    onError(result.value);
  }
}
exports.safely = safelyResolveThenable;
},{"./handlers":36,"./tryCatch":45}],44:[function(require,module,exports){
// Lazy man's symbols for states

exports.REJECTED = ['REJECTED'];
exports.FULFILLED = ['FULFILLED'];
exports.PENDING = ['PENDING'];
},{}],45:[function(require,module,exports){
'use strict';

module.exports = tryCatch;

function tryCatch(func, value) {
  var out = {};
  try {
    out.value = func(value);
    out.status = 'success';
  } catch (e) {
    out.status = 'error';
    out.value = e;
  }
  return out;
}
},{}],46:[function(require,module,exports){
'use strict';

var immediate = require('immediate');
var handlers = require('./handlers');
module.exports = unwrap;

function unwrap(promise, func, value) {
  immediate(function () {
    var returnValue;
    try {
      returnValue = func(value);
    } catch (e) {
      return handlers.reject(promise, e);
    }
    if (returnValue === promise) {
      handlers.reject(promise, new TypeError('Cannot resolve promise with itself'));
    } else {
      handlers.resolve(promise, returnValue);
    }
  });
}
},{"./handlers":36,"immediate":47}],47:[function(require,module,exports){
'use strict';
var types = [
  require('./nextTick'),
  require('./mutation.js'),
  require('./messageChannel'),
  require('./stateChange'),
  require('./timeout')
];
var draining;
var queue = [];
//named nextTick for less confusing stack traces
function nextTick() {
  draining = true;
  var i, oldQueue;
  var len = queue.length;
  while (len) {
    oldQueue = queue;
    queue = [];
    i = -1;
    while (++i < len) {
      oldQueue[i]();
    }
    len = queue.length;
  }
  draining = false;
}
var scheduleDrain;
var i = -1;
var len = types.length;
while (++ i < len) {
  if (types[i] && types[i].test && types[i].test()) {
    scheduleDrain = types[i].install(nextTick);
    break;
  }
}
module.exports = immediate;
function immediate(task) {
  if (queue.push(task) === 1 && !draining) {
    scheduleDrain();
  }
}
},{"./messageChannel":48,"./mutation.js":49,"./nextTick":28,"./stateChange":50,"./timeout":51}],48:[function(require,module,exports){
(function (global){
'use strict';

exports.test = function () {
  if (global.setImmediate) {
    // we can only get here in IE10
    // which doesn't handel postMessage well
    return false;
  }
  return typeof global.MessageChannel !== 'undefined';
};

exports.install = function (func) {
  var channel = new global.MessageChannel();
  channel.port1.onmessage = func;
  return function () {
    channel.port2.postMessage(0);
  };
};
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],49:[function(require,module,exports){
(function (global){
'use strict';
//based off rsvp https://github.com/tildeio/rsvp.js
//license https://github.com/tildeio/rsvp.js/blob/master/LICENSE
//https://github.com/tildeio/rsvp.js/blob/master/lib/rsvp/asap.js

var Mutation = global.MutationObserver || global.WebKitMutationObserver;

exports.test = function () {
  return Mutation;
};

exports.install = function (handle) {
  var called = 0;
  var observer = new Mutation(handle);
  var element = global.document.createTextNode('');
  observer.observe(element, {
    characterData: true
  });
  return function () {
    element.data = (called = ++called % 2);
  };
};
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],50:[function(require,module,exports){
(function (global){
'use strict';

exports.test = function () {
  return 'document' in global && 'onreadystatechange' in global.document.createElement('script');
};

exports.install = function (handle) {
  return function () {

    // Create a <script> element; its readystatechange event will be fired asynchronously once it is inserted
    // into the document. Do so, thus queuing up the task. Remember to clean up once it's been called.
    var scriptEl = global.document.createElement('script');
    scriptEl.onreadystatechange = function () {
      handle();

      scriptEl.onreadystatechange = null;
      scriptEl.parentNode.removeChild(scriptEl);
      scriptEl = null;
    };
    global.document.documentElement.appendChild(scriptEl);

    return handle;
  };
};
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],51:[function(require,module,exports){
'use strict';
exports.test = function () {
  return true;
};

exports.install = function (t) {
  return function () {
    setTimeout(t, 0);
  };
};
},{}],52:[function(require,module,exports){
(function () {
    if (typeof siesta == 'undefined' && typeof module == 'undefined') {
        throw new Error('Could not find window.siesta. Make sure you include siesta.core.js first.');
    }

    var _i = siesta._internal,
        cache = _i.cache,
        CollectionRegistry = _i.CollectionRegistry,
        log = _i.log('Storage'),
        error = _i.error,
        util = _i.util,
        _ = util._,
        events = _i.events;

    var unsavedObjects = [],
        unsavedObjectsHash = {},
        unsavedObjectsByCollection = {};

    var storage = {};


    function _initMeta() {
        return {dateFields: []};
    }

    function fullyQualifiedModelName(collectionName, modelName) {
        return collectionName + '.' + modelName;
    }

    if (typeof PouchDB == 'undefined') {
        siesta.ext.storageEnabled = false;
        console.log('PouchDB is not present therefore storage is disabled.');
    }
    else {
        var DB_NAME = 'siesta',
            pouch = new PouchDB(DB_NAME, {auto_compaction: true});

        /**
         * Sometimes siesta needs to store some extra information about the model instance.
         * @param serialised
         * @private
         */
        function _addMeta(serialised) {
            // PouchDB <= 3.2.1 has a bug whereby date fields are not deserialised properly if you use db.query
            // therefore we need to add extra info to the object for deserialising dates manually.
            serialised.siesta_meta = _initMeta();
            for (var prop in serialised) {
                if (serialised.hasOwnProperty(prop)) {
                    if (serialised[prop] instanceof Date) {
                        serialised.siesta_meta.dateFields.push(prop);
                        serialised[prop] = serialised[prop].getTime();
                    }
                }
            }
        }

        function _processMeta(datum) {
            var meta = datum.siesta_meta || _initMeta();
            meta.dateFields.forEach(function (dateField) {
                var value = datum[dateField];
                if (!(value instanceof Date)) {
                    datum[dateField] = new Date(value);
                }
            });
            delete datum.siesta_meta;
        }

        function constructIndexDesignDoc(collectionName, modelName) {
            var fullyQualifiedName = fullyQualifiedModelName(collectionName, modelName);
            var views = {};
            views[fullyQualifiedName] = {
                map: function (doc) {
                    if (doc.collection == '$1' && doc.model == '$2') emit(doc.collection + '.' + doc.model, doc);
                }.toString().replace('$1', collectionName).replace('$2', modelName)
            };
            return {
                _id: '_design/' + fullyQualifiedName,
                views: views
            };
        }

        function constructIndexesForAll() {
            var indexes = [];
            var registry = siesta._internal.CollectionRegistry;
            registry.collectionNames.forEach(function (collectionName) {
                var models = registry[collectionName]._models;
                for (var modelName in models) {
                    if (models.hasOwnProperty(modelName)) {
                        indexes.push(constructIndexDesignDoc(collectionName, modelName));
                    }
                }
            });
            return indexes;
        }

        function __ensureIndexes(indexes, cb) {
            pouch.bulkDocs(indexes)
                .then(function (resp) {
                    var errors = [];
                    for (var i = 0; i < resp.length; i++) {
                        var response = resp[i];
                        if (!response.ok) {
                            // Conflict means already exists, and this is fine!
                            var isConflict = response.status == 409;
                            if (!isConflict) errors.push(response);
                        }
                    }
                    cb(errors.length ? error('multiple errors', {errors: errors}) : null);
                })
                .catch(cb);
        }

        function ensureIndexesForAll(cb) {
            var indexes = constructIndexesForAll();
            __ensureIndexes(indexes, cb);
        }

        /**
         * Serialise a model into a format that PouchDB bulkDocs API can process
         * @param {ModelInstance} modelInstance
         */
        function _serialise(modelInstance) {
            var serialised = siesta._.extend({}, modelInstance.__values);
            _addMeta(serialised);
            serialised['collection'] = modelInstance.collectionName;
            serialised['model'] = modelInstance.modelName;
            serialised['_id'] = modelInstance._id;
            if (modelInstance.removed) serialised['_deleted'] = true;
            var rev = modelInstance._rev;
            if (rev) serialised['_rev'] = rev;
            serialised = _.reduce(modelInstance._relationshipNames, function (memo, n) {
                var val = modelInstance[n];
                if (siesta.isArray(val)) {
                    memo[n] = _.pluck(val, '_id');
                }
                else if (val) {
                    memo[n] = val._id;
                }
                return memo;
            }, serialised);
            return serialised;
        }

        function _prepareDatum(datum, model) {
            _processMeta(datum);
            delete datum.collection;
            delete datum.model;
            var relationshipNames = model._relationshipNames;
            _.each(relationshipNames, function (r) {
                var _id = datum[r];
                if (siesta.isArray(_id)) {
                    datum[r] = _.map(_id, function (x) {
                        return {_id: x}
                    });
                }
                else {
                    datum[r] = {_id: _id};
                }
            });
            return datum;
        }

        /**
         *
         * @param opts
         * @param opts.collectionName
         * @param opts.modelName
         * @param callback
         * @private
         */
        function _loadModel(opts, callback) {
            var collectionName = opts.collectionName,
                modelName = opts.modelName;
            var fullyQualifiedName = fullyQualifiedModelName(collectionName, modelName);
            log('Loading instances for ' + fullyQualifiedName);
            var Model = CollectionRegistry[collectionName][modelName];
            log('Querying pouch');
            pouch.query(fullyQualifiedName)
                //pouch.query({map: mapFunc})
                .then(function (resp) {
                    log('Queried pouch successfully');
                    var data = siesta._.map(siesta._.pluck(resp.rows, 'value'), function (datum) {
                        return _prepareDatum(datum, Model);
                    });
                    log('Mapping data', data);
                    Model.graph(data, {
                        disableevents: true,
                        _ignoreInstalled: true,
                        fromStorage: true
                    }, function (err, instances) {
                        if (!err) {
                            if (log.enabled)
                                log('Loaded ' + instances ? instances.length.toString() : 0 + ' instances for ' + fullyQualifiedName);
                        }
                        else {
                            log('Error loading models', err);
                        }
                        callback(err, instances);
                    });
                })
                .catch(function (err) {
                    callback(err);
                });

        }

        /**
         * Load all data from PouchDB.
         */
        function _load(cb) {
            if (saving) throw new Error('not loaded yet how can i save');
            return util.promise(cb, function (cb) {
                if (siesta.ext.storageEnabled) {
                    var collectionNames = CollectionRegistry.collectionNames;
                    var tasks = [];
                    _.each(collectionNames, function (collectionName) {
                        var collection = CollectionRegistry[collectionName],
                            modelNames = Object.keys(collection._models);
                        _.each(modelNames, function (modelName) {
                            tasks.push(function (cb) {
                                // We call from storage to allow for replacement of _loadModel for performance extension.
                                storage._loadModel({
                                    collectionName: collectionName,
                                    modelName: modelName
                                }, cb);
                            });
                        });
                    });
                    siesta.async.series(tasks, function (err, results) {
                        var n;
                        if (!err) {
                            var instances = [];
                            siesta._.each(results, function (r) {
                                instances = instances.concat(r)
                            });
                            n = instances.length;
                            if (log) {
                                log('Loaded ' + n.toString() + ' instances');
                            }
                        }
                        cb(err, n);
                    });
                }
                else {
                    cb();
                }
            }.bind(this));
        }

        function saveConflicts(objects, cb) {
            pouch.allDocs({keys: _.pluck(objects, '_id')})
                .then(function (resp) {
                    for (var i = 0; i < resp.rows.length; i++) {
                        objects[i]._rev = resp.rows[i].value.rev;
                    }
                    saveToPouch(objects, cb);
                })
                .catch(function (err) {
                    cb(err);
                })
        }

        function saveToPouch(objects, cb) {
            var conflicts = [];
            pouch.bulkDocs(_.map(objects, _serialise)).then(function (resp) {
                for (var i = 0; i < resp.length; i++) {
                    var response = resp[i];
                    var obj = objects[i];
                    if (response.ok) {
                        obj._rev = response.rev;
                    }
                    else if (response.status == 409) {
                        conflicts.push(obj);
                    }
                    else {
                        log('Error saving object with _id="' + obj._id + '"', response);
                    }
                }
                if (conflicts.length) {
                    saveConflicts(conflicts, cb);
                }
                else {
                    cb();
                }
            }, function (err) {
                cb(err);
            });
        }


        /**
         * Save all modelEvents down to PouchDB.
         */
        function save(cb) {
            return util.promise(cb, function (cb) {
                siesta._afterInstall(function () {
                    var objects = unsavedObjects;
                    unsavedObjects = [];
                    unsavedObjectsHash = {};
                    unsavedObjectsByCollection = {};
                    if (log) {
                        log('Saving objects', _.map(objects, function (x) {
                            return x._dump()
                        }))
                    }
                    saveToPouch(objects, cb);
                });
            }.bind(this));

        }

        var listener = function (n) {
            var changedObject = n.obj,
                ident = changedObject._id;
            if (!changedObject) {
                throw new _i.error.InternalSiestaError('No obj field in notification received by storage extension');
            }
            if (!(ident in unsavedObjectsHash)) {
                unsavedObjectsHash[ident] = changedObject;
                unsavedObjects.push(changedObject);
                var collectionName = changedObject.collectionName;
                if (!unsavedObjectsByCollection[collectionName]) {
                    unsavedObjectsByCollection[collectionName] = {};
                }
                var modelName = changedObject.model.name;
                if (!unsavedObjectsByCollection[collectionName][modelName]) {
                    unsavedObjectsByCollection[collectionName][modelName] = {};
                }
                unsavedObjectsByCollection[collectionName][modelName][ident] = changedObject;
            }
        };
        siesta.on('Siesta', listener);

        _.extend(storage, {
            _load: _load,
            _loadModel: _loadModel,
            save: save,
            _serialise: _serialise,
            ensureIndexesForAll: ensureIndexesForAll,
            _reset: function (cb) {
                siesta.removeListener('Siesta', listener);
                unsavedObjects = [];
                unsavedObjectsHash = {};
                pouch.destroy(function (err) {
                    if (!err) {
                        pouch = new PouchDB(DB_NAME);
                    }
                    siesta.on('Siesta', listener);
                    log('Reset complete');
                    cb(err);
                })
            }

        });

        Object.defineProperties(storage, {
            _unsavedObjects: {
                get: function () {
                    return unsavedObjects
                }
            },
            _unsavedObjectsHash: {
                get: function () {
                    return unsavedObjectsHash
                }
            },
            _unsavedObjectsByCollection: {
                get: function () {
                    return unsavedObjectsByCollection
                }
            },
            _pouch: {
                get: function () {
                    return pouch
                }
            }
        });


        if (!siesta.ext) siesta.ext = {};
        siesta.ext.storage = storage;

        Object.defineProperties(siesta.ext, {
            storageEnabled: {
                get: function () {
                    if (siesta.ext._storageEnabled !== undefined) {
                        return siesta.ext._storageEnabled;
                    }
                    return !!siesta.ext.storage;
                },
                set: function (v) {
                    siesta.ext._storageEnabled = v;
                },
                enumerable: true
            }
        });

        var interval, saving, autosaveInterval = 1000;

        Object.defineProperties(siesta, {
            autosave: {
                get: function () {
                    return !!interval;
                },
                set: function (autosave) {
                    if (autosave) {
                        if (!interval) {
                            interval = setInterval(function () {
                                // Cheeky way of avoiding multiple saves happening...
                                if (!saving) {
                                    saving = true;
                                    siesta.save(function (err) {
                                        if (!err) {
                                            events.emit('saved');
                                        }
                                        saving = false;
                                    });
                                }
                            }, siesta.autosaveInterval);
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
            autosaveInterval: {
                get: function () {
                    return autosaveInterval;
                },
                set: function (_autosaveInterval) {
                    autosaveInterval = _autosaveInterval;
                    if (interval) {
                        // Reset interval
                        siesta.autosave = false;
                        siesta.autosave = true;
                    }
                }
            },
            dirty: {
                get: function () {
                    var unsavedObjectsByCollection = siesta.ext.storage._unsavedObjectsByCollection;
                    return !!Object.keys(unsavedObjectsByCollection).length;
                },
                enumerable: true
            }
        });

        _.extend(siesta, {
            save: save,
            setPouch: function (_p) {
                if (siesta._canChange) pouch = _p;
                else throw new Error('Cannot change PouchDB instance when an object graph exists.');
            }
        });

    }

    module.exports = storage;

})();
},{}],53:[function(require,module,exports){
(function (global){
/*
 * Copyright (c) 2014 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */

(function(global) {
  'use strict';

  var testingExposeCycleCount = global.testingExposeCycleCount;

  // Detect and do basic sanity checking on Object/Array.observe.
  function detectObjectObserve() {
    if (typeof Object.observe !== 'function' ||
        typeof Array.observe !== 'function') {
      return false;
    }

    var records = [];

    function callback(recs) {
      records = recs;
    }

    var test = {};
    var arr = [];
    Object.observe(test, callback);
    Array.observe(arr, callback);
    test.id = 1;
    test.id = 2;
    delete test.id;
    arr.push(1, 2);
    arr.length = 0;

    Object.deliverChangeRecords(callback);
    if (records.length !== 5)
      return false;

    if (records[0].type != 'add' ||
        records[1].type != 'update' ||
        records[2].type != 'delete' ||
        records[3].type != 'splice' ||
        records[4].type != 'splice') {
      return false;
    }

    Object.unobserve(test, callback);
    Array.unobserve(arr, callback);

    return true;
  }

  var hasObserve = detectObjectObserve();

  function detectEval() {
    // Don't test for eval if we're running in a Chrome App environment.
    // We check for APIs set that only exist in a Chrome App context.
    if (typeof chrome !== 'undefined' && chrome.app && chrome.app.runtime) {
      return false;
    }

    // Firefox OS Apps do not allow eval. This feature detection is very hacky
    // but even if some other platform adds support for this function this code
    // will continue to work.
    if (navigator.getDeviceStorage) {
      return false;
    }

    try {
      var f = new Function('', 'return true;');
      return f();
    } catch (ex) {
      return false;
    }
  }

  var hasEval = detectEval();

  function isIndex(s) {
    return +s === s >>> 0 && s !== '';
  }

  function toNumber(s) {
    return +s;
  }

  var numberIsNaN = global.Number.isNaN || function(value) {
    return typeof value === 'number' && global.isNaN(value);
  }


  var createObject = ('__proto__' in {}) ?
    function(obj) { return obj; } :
    function(obj) {
      var proto = obj.__proto__;
      if (!proto)
        return obj;
      var newObject = Object.create(proto);
      Object.getOwnPropertyNames(obj).forEach(function(name) {
        Object.defineProperty(newObject, name,
                             Object.getOwnPropertyDescriptor(obj, name));
      });
      return newObject;
    };

  var identStart = '[\$_a-zA-Z]';
  var identPart = '[\$_a-zA-Z0-9]';


  var MAX_DIRTY_CHECK_CYCLES = 1000;

  function dirtyCheck(observer) {
    var cycles = 0;
    while (cycles < MAX_DIRTY_CHECK_CYCLES && observer.check_()) {
      cycles++;
    }
    if (testingExposeCycleCount)
      global.dirtyCheckCycleCount = cycles;

    return cycles > 0;
  }

  function objectIsEmpty(object) {
    for (var prop in object)
      return false;
    return true;
  }

  function diffIsEmpty(diff) {
    return objectIsEmpty(diff.added) &&
           objectIsEmpty(diff.removed) &&
           objectIsEmpty(diff.changed);
  }

  function diffObjectFromOldObject(object, oldObject) {
    var added = {};
    var removed = {};
    var changed = {};

    for (var prop in oldObject) {
      var newValue = object[prop];

      if (newValue !== undefined && newValue === oldObject[prop])
        continue;

      if (!(prop in object)) {
        removed[prop] = undefined;
        continue;
      }

      if (newValue !== oldObject[prop])
        changed[prop] = newValue;
    }

    for (var prop in object) {
      if (prop in oldObject)
        continue;

      added[prop] = object[prop];
    }

    if (Array.isArray(object) && object.length !== oldObject.length)
      changed.length = object.length;

    return {
      added: added,
      removed: removed,
      changed: changed
    };
  }

  var eomTasks = [];
  function runEOMTasks() {
    if (!eomTasks.length)
      return false;

    for (var i = 0; i < eomTasks.length; i++) {
      eomTasks[i]();
    }
    eomTasks.length = 0;
    return true;
  }

  var runEOM = hasObserve ? (function(){
    var eomObj = { pingPong: true };
    var eomRunScheduled = false;

    Object.observe(eomObj, function() {
      runEOMTasks();
      eomRunScheduled = false;
    });

    return function(fn) {
      eomTasks.push(fn);
      if (!eomRunScheduled) {
        eomRunScheduled = true;
        eomObj.pingPong = !eomObj.pingPong;
      }
    };
  })() :
  (function() {
    return function(fn) {
      eomTasks.push(fn);
    };
  })();

  var observedObjectCache = [];

  function newObservedObject() {
    var observer;
    var object;
    var discardRecords = false;
    var first = true;

    function callback(records) {
      if (observer && observer.state_ === OPENED && !discardRecords)
        observer.check_(records);
    }

    return {
      open: function(obs) {
        if (observer)
          throw Error('ObservedObject in use');

        if (!first)
          Object.deliverChangeRecords(callback);

        observer = obs;
        first = false;
      },
      observe: function(obj, arrayObserve) {
        object = obj;
        if (arrayObserve)
          Array.observe(object, callback);
        else
          Object.observe(object, callback);
      },
      deliver: function(discard) {
        discardRecords = discard;
        Object.deliverChangeRecords(callback);
        discardRecords = false;
      },
      close: function() {
        observer = undefined;
        Object.unobserve(object, callback);
        observedObjectCache.push(this);
      }
    };
  }

  /*
   * The observedSet abstraction is a perf optimization which reduces the total
   * number of Object.observe observations of a set of objects. The idea is that
   * groups of Observers will have some object dependencies in common and this
   * observed set ensures that each object in the transitive closure of
   * dependencies is only observed once. The observedSet acts as a write barrier
   * such that whenever any change comes through, all Observers are checked for
   * changed values.
   *
   * Note that this optimization is explicitly moving work from setup-time to
   * change-time.
   *
   * TODO(rafaelw): Implement "garbage collection". In order to move work off
   * the critical path, when Observers are closed, their observed objects are
   * not Object.unobserve(d). As a result, it'siesta possible that if the observedSet
   * is kept open, but some Observers have been closed, it could cause "leaks"
   * (prevent otherwise collectable objects from being collected). At some
   * point, we should implement incremental "gc" which keeps a list of
   * observedSets which may need clean-up and does small amounts of cleanup on a
   * timeout until all is clean.
   */

  function getObservedObject(observer, object, arrayObserve) {
    var dir = observedObjectCache.pop() || newObservedObject();
    dir.open(observer);
    dir.observe(object, arrayObserve);
    return dir;
  }

  var observedSetCache = [];

  function newObservedSet() {
    var observerCount = 0;
    var observers = [];
    var objects = [];
    var rootObj;
    var rootObjProps;

    function observe(obj, prop) {
      if (!obj)
        return;

      if (obj === rootObj)
        rootObjProps[prop] = true;

      if (objects.indexOf(obj) < 0) {
        objects.push(obj);
        Object.observe(obj, callback);
      }

      observe(Object.getPrototypeOf(obj), prop);
    }

    function allRootObjNonObservedProps(recs) {
      for (var i = 0; i < recs.length; i++) {
        var rec = recs[i];
        if (rec.object !== rootObj ||
            rootObjProps[rec.name] ||
            rec.type === 'setPrototype') {
          return false;
        }
      }
      return true;
    }

    function callback(recs) {
      if (allRootObjNonObservedProps(recs))
        return;

      var observer;
      for (var i = 0; i < observers.length; i++) {
        observer = observers[i];
        if (observer.state_ == OPENED) {
          observer.iterateObjects_(observe);
        }
      }

      for (var i = 0; i < observers.length; i++) {
        observer = observers[i];
        if (observer.state_ == OPENED) {
          observer.check_();
        }
      }
    }

    var record = {
      object: undefined,
      objects: objects,
      open: function(obs, object) {
        if (!rootObj) {
          rootObj = object;
          rootObjProps = {};
        }

        observers.push(obs);
        observerCount++;
        obs.iterateObjects_(observe);
      },
      close: function(obs) {
        observerCount--;
        if (observerCount > 0) {
          return;
        }

        for (var i = 0; i < objects.length; i++) {
          Object.unobserve(objects[i], callback);
          Observer.unobservedCount++;
        }

        observers.length = 0;
        objects.length = 0;
        rootObj = undefined;
        rootObjProps = undefined;
        observedSetCache.push(this);
      }
    };

    return record;
  }

  var lastObservedSet;

  var UNOPENED = 0;
  var OPENED = 1;
  var CLOSED = 2;

  var nextObserverId = 1;

  function Observer() {
    this.state_ = UNOPENED;
    this.callback_ = undefined;
    this.target_ = undefined; // TODO(rafaelw): Should be WeakRef
    this.directObserver_ = undefined;
    this.value_ = undefined;
    this.id_ = nextObserverId++;
  }

  Observer.prototype = {
    open: function(callback, target) {
      if (this.state_ != UNOPENED)
        throw Error('Observer has already been opened.');

      addToAll(this);
      this.callback_ = callback;
      this.target_ = target;
      this.connect_();
      this.state_ = OPENED;
      return this.value_;
    },

    close: function() {
      if (this.state_ != OPENED)
        return;

      removeFromAll(this);
      this.disconnect_();
      this.value_ = undefined;
      this.callback_ = undefined;
      this.target_ = undefined;
      this.state_ = CLOSED;
    },

    deliver: function() {
      if (this.state_ != OPENED)
        return;

      dirtyCheck(this);
    },

    report_: function(changes) {
      try {
        this.callback_.apply(this.target_, changes);
      } catch (ex) {
        Observer._errorThrownDuringCallback = true;
        console.error('Exception caught during observer callback: ' +
                       (ex.stack || ex));
      }
    },

    discardChanges: function() {
      this.check_(undefined, true);
      return this.value_;
    }
  }

  var collectObservers = !hasObserve;
  var allObservers;
  Observer._allObserversCount = 0;

  if (collectObservers) {
    allObservers = [];
  }

  function addToAll(observer) {
    Observer._allObserversCount++;
    if (!collectObservers)
      return;

    allObservers.push(observer);
  }

  function removeFromAll(observer) {
    Observer._allObserversCount--;
  }

  var runningMicrotaskCheckpoint = false;

  var hasDebugForceFullDelivery = hasObserve && hasEval && (function() {
    try {
      eval('%RunMicrotasks()');
      return true;
    } catch (ex) {
      return false;
    }
  })();

  global.Platform = global.Platform || {};

  global.Platform.performMicrotaskCheckpoint = function() {
    if (runningMicrotaskCheckpoint)
      return;

    if (hasDebugForceFullDelivery) {
      eval('%RunMicrotasks()');
      return;
    }

    if (!collectObservers)
      return;

    runningMicrotaskCheckpoint = true;

    var cycles = 0;
    var anyChanged, toCheck;

    do {
      cycles++;
      toCheck = allObservers;
      allObservers = [];
      anyChanged = false;

      for (var i = 0; i < toCheck.length; i++) {
        var observer = toCheck[i];
        if (observer.state_ != OPENED)
          continue;

        if (observer.check_())
          anyChanged = true;

        allObservers.push(observer);
      }
      if (runEOMTasks())
        anyChanged = true;
    } while (cycles < MAX_DIRTY_CHECK_CYCLES && anyChanged);

    if (testingExposeCycleCount)
      global.dirtyCheckCycleCount = cycles;

    runningMicrotaskCheckpoint = false;
  };

  if (collectObservers) {
    global.Platform.clearObservers = function() {
      allObservers = [];
    };
  }

  function ObjectObserver(object) {
    Observer.call(this);
    this.value_ = object;
    this.oldObject_ = undefined;
  }

  ObjectObserver.prototype = createObject({
    __proto__: Observer.prototype,

    arrayObserve: false,

    connect_: function(callback, target) {
      if (hasObserve) {
        this.directObserver_ = getObservedObject(this, this.value_,
                                                 this.arrayObserve);
      } else {
        this.oldObject_ = this.copyObject(this.value_);
      }

    },

    copyObject: function(object) {
      var copy = Array.isArray(object) ? [] : {};
      for (var prop in object) {
        copy[prop] = object[prop];
      };
      if (Array.isArray(object))
        copy.length = object.length;
      return copy;
    },

    check_: function(changeRecords, skipChanges) {
      var diff;
      var oldValues;
      if (hasObserve) {
        if (!changeRecords)
          return false;

        oldValues = {};
        diff = diffObjectFromChangeRecords(this.value_, changeRecords,
                                           oldValues);
      } else {
        oldValues = this.oldObject_;
        diff = diffObjectFromOldObject(this.value_, this.oldObject_);
      }

      if (diffIsEmpty(diff))
        return false;

      if (!hasObserve)
        this.oldObject_ = this.copyObject(this.value_);

      this.report_([
        diff.added || {},
        diff.removed || {},
        diff.changed || {},
        function(property) {
          return oldValues[property];
        }
      ]);

      return true;
    },

    disconnect_: function() {
      if (hasObserve) {
        this.directObserver_.close();
        this.directObserver_ = undefined;
      } else {
        this.oldObject_ = undefined;
      }
    },

    deliver: function() {
      if (this.state_ != OPENED)
        return;

      if (hasObserve)
        this.directObserver_.deliver(false);
      else
        dirtyCheck(this);
    },

    discardChanges: function() {
      if (this.directObserver_)
        this.directObserver_.deliver(true);
      else
        this.oldObject_ = this.copyObject(this.value_);

      return this.value_;
    }
  });

  function ArrayObserver(array) {
    if (!Array.isArray(array))
      throw Error('Provided object is not an Array');
    ObjectObserver.call(this, array);
  }

  ArrayObserver.prototype = createObject({

    __proto__: ObjectObserver.prototype,

    arrayObserve: true,

    copyObject: function(arr) {
      return arr.slice();
    },

    check_: function(changeRecords) {
      var splices;
      if (hasObserve) {
        if (!changeRecords)
          return false;
        splices = projectArraySplices(this.value_, changeRecords);
      } else {
        splices = calcSplices(this.value_, 0, this.value_.length,
                              this.oldObject_, 0, this.oldObject_.length);
      }

      if (!splices || !splices.length)
        return false;

      if (!hasObserve)
        this.oldObject_ = this.copyObject(this.value_);

      this.report_([splices]);
      return true;
    }
  });

  ArrayObserver.applySplices = function(previous, current, splices) {
    splices.forEach(function(splice) {
      var spliceArgs = [splice.index, splice.removed.length];
      var addIndex = splice.index;
      while (addIndex < splice.index + splice.addedCount) {
        spliceArgs.push(current[addIndex]);
        addIndex++;
      }

      Array.prototype.splice.apply(previous, spliceArgs);
    });
  };

  var observerSentinel = {};

  var expectedRecordTypes = {
    add: true,
    update: true,
    delete: true
  };

  function diffObjectFromChangeRecords(object, changeRecords, oldValues) {
    var added = {};
    var removed = {};

    for (var i = 0; i < changeRecords.length; i++) {
      var record = changeRecords[i];
      if (!expectedRecordTypes[record.type]) {
        console.error('Unknown changeRecord type: ' + record.type);
        console.error(record);
        continue;
      }

      if (!(record.name in oldValues))
        oldValues[record.name] = record.oldValue;

      if (record.type == 'update')
        continue;

      if (record.type == 'add') {
        if (record.name in removed)
          delete removed[record.name];
        else
          added[record.name] = true;

        continue;
      }

      // type = 'delete'
      if (record.name in added) {
        delete added[record.name];
        delete oldValues[record.name];
      } else {
        removed[record.name] = true;
      }
    }

    for (var prop in added)
      added[prop] = object[prop];

    for (var prop in removed)
      removed[prop] = undefined;

    var changed = {};
    for (var prop in oldValues) {
      if (prop in added || prop in removed)
        continue;

      var newValue = object[prop];
      if (oldValues[prop] !== newValue)
        changed[prop] = newValue;
    }

    return {
      added: added,
      removed: removed,
      changed: changed
    };
  }

  function newSplice(index, removed, addedCount) {
    return {
      index: index,
      removed: removed,
      addedCount: addedCount
    };
  }

  var EDIT_LEAVE = 0;
  var EDIT_UPDATE = 1;
  var EDIT_ADD = 2;
  var EDIT_DELETE = 3;

  function ArraySplice() {}

  ArraySplice.prototype = {

    // Note: This function is *based* on the computation of the Levenshtein
    // "edit" distance. The one change is that "updates" are treated as two
    // edits - not one. With Array splices, an update is really a delete
    // followed by an add. By retaining this, we optimize for "keeping" the
    // maximum array items in the original array. For example:
    //
    //   'xxxx123' -> '123yyyy'
    //
    // With 1-edit updates, the shortest path would be just to update all seven
    // characters. With 2-edit updates, we delete 4, leave 3, and add 4. This
    // leaves the substring '123' intact.
    calcEditDistances: function(current, currentStart, currentEnd,
                                old, oldStart, oldEnd) {
      // "Deletion" columns
      var rowCount = oldEnd - oldStart + 1;
      var columnCount = currentEnd - currentStart + 1;
      var distances = new Array(rowCount);

      // "Addition" rows. Initialize null column.
      for (var i = 0; i < rowCount; i++) {
        distances[i] = new Array(columnCount);
        distances[i][0] = i;
      }

      // Initialize null row
      for (var j = 0; j < columnCount; j++)
        distances[0][j] = j;

      for (var i = 1; i < rowCount; i++) {
        for (var j = 1; j < columnCount; j++) {
          if (this.equals(current[currentStart + j - 1], old[oldStart + i - 1]))
            distances[i][j] = distances[i - 1][j - 1];
          else {
            var north = distances[i - 1][j] + 1;
            var west = distances[i][j - 1] + 1;
            distances[i][j] = north < west ? north : west;
          }
        }
      }

      return distances;
    },

    // This starts at the final weight, and walks "backward" by finding
    // the minimum previous weight recursively until the origin of the weight
    // matrix.
    spliceOperationsFromEditDistances: function(distances) {
      var i = distances.length - 1;
      var j = distances[0].length - 1;
      var current = distances[i][j];
      var edits = [];
      while (i > 0 || j > 0) {
        if (i == 0) {
          edits.push(EDIT_ADD);
          j--;
          continue;
        }
        if (j == 0) {
          edits.push(EDIT_DELETE);
          i--;
          continue;
        }
        var northWest = distances[i - 1][j - 1];
        var west = distances[i - 1][j];
        var north = distances[i][j - 1];

        var min;
        if (west < north)
          min = west < northWest ? west : northWest;
        else
          min = north < northWest ? north : northWest;

        if (min == northWest) {
          if (northWest == current) {
            edits.push(EDIT_LEAVE);
          } else {
            edits.push(EDIT_UPDATE);
            current = northWest;
          }
          i--;
          j--;
        } else if (min == west) {
          edits.push(EDIT_DELETE);
          i--;
          current = west;
        } else {
          edits.push(EDIT_ADD);
          j--;
          current = north;
        }
      }

      edits.reverse();
      return edits;
    },

    /**
     * Splice Projection functions:
     *
     * A splice map is a representation of how a previous array of items
     * was transformed into a new array of items. Conceptually it is a list of
     * tuples of
     *
     *   <index, removed, addedCount>
     *
     * which are kept in ascending index order of. The tuple represents that at
     * the |index|, |removed| sequence of items were removed, and counting forward
     * from |index|, |addedCount| items were added.
     */

    /**
     * Lacking individual splice mutation information, the minimal set of
     * splices can be synthesized given the previous state and final state of an
     * array. The basic approach is to calculate the edit distance matrix and
     * choose the shortest path through it.
     *
     * Complexity: O(l * p)
     *   l: The length of the current array
     *   p: The length of the old array
     */
    calcSplices: function(current, currentStart, currentEnd,
                          old, oldStart, oldEnd) {
      var prefixCount = 0;
      var suffixCount = 0;

      var minLength = Math.min(currentEnd - currentStart, oldEnd - oldStart);
      if (currentStart == 0 && oldStart == 0)
        prefixCount = this.sharedPrefix(current, old, minLength);

      if (currentEnd == current.length && oldEnd == old.length)
        suffixCount = this.sharedSuffix(current, old, minLength - prefixCount);

      currentStart += prefixCount;
      oldStart += prefixCount;
      currentEnd -= suffixCount;
      oldEnd -= suffixCount;

      if (currentEnd - currentStart == 0 && oldEnd - oldStart == 0)
        return [];

      if (currentStart == currentEnd) {
        var splice = newSplice(currentStart, [], 0);
        while (oldStart < oldEnd)
          splice.removed.push(old[oldStart++]);

        return [ splice ];
      } else if (oldStart == oldEnd)
        return [ newSplice(currentStart, [], currentEnd - currentStart) ];

      var ops = this.spliceOperationsFromEditDistances(
          this.calcEditDistances(current, currentStart, currentEnd,
                                 old, oldStart, oldEnd));

      var splice = undefined;
      var splices = [];
      var index = currentStart;
      var oldIndex = oldStart;
      for (var i = 0; i < ops.length; i++) {
        switch(ops[i]) {
          case EDIT_LEAVE:
            if (splice) {
              splices.push(splice);
              splice = undefined;
            }

            index++;
            oldIndex++;
            break;
          case EDIT_UPDATE:
            if (!splice)
              splice = newSplice(index, [], 0);

            splice.addedCount++;
            index++;

            splice.removed.push(old[oldIndex]);
            oldIndex++;
            break;
          case EDIT_ADD:
            if (!splice)
              splice = newSplice(index, [], 0);

            splice.addedCount++;
            index++;
            break;
          case EDIT_DELETE:
            if (!splice)
              splice = newSplice(index, [], 0);

            splice.removed.push(old[oldIndex]);
            oldIndex++;
            break;
        }
      }

      if (splice) {
        splices.push(splice);
      }
      return splices;
    },

    sharedPrefix: function(current, old, searchLength) {
      for (var i = 0; i < searchLength; i++)
        if (!this.equals(current[i], old[i]))
          return i;
      return searchLength;
    },

    sharedSuffix: function(current, old, searchLength) {
      var index1 = current.length;
      var index2 = old.length;
      var count = 0;
      while (count < searchLength && this.equals(current[--index1], old[--index2]))
        count++;

      return count;
    },

    calculateSplices: function(current, previous) {
      return this.calcSplices(current, 0, current.length, previous, 0,
                              previous.length);
    },

    equals: function(currentValue, previousValue) {
      return currentValue === previousValue;
    }
  };

  var arraySplice = new ArraySplice();

  function calcSplices(current, currentStart, currentEnd,
                       old, oldStart, oldEnd) {
    return arraySplice.calcSplices(current, currentStart, currentEnd,
                                   old, oldStart, oldEnd);
  }

  function intersect(start1, end1, start2, end2) {
    // Disjoint
    if (end1 < start2 || end2 < start1)
      return -1;

    // Adjacent
    if (end1 == start2 || end2 == start1)
      return 0;

    // Non-zero intersect, span1 first
    if (start1 < start2) {
      if (end1 < end2)
        return end1 - start2; // Overlap
      else
        return end2 - start2; // Contained
    } else {
      // Non-zero intersect, span2 first
      if (end2 < end1)
        return end2 - start1; // Overlap
      else
        return end1 - start1; // Contained
    }
  }

  function mergeSplice(splices, index, removed, addedCount) {

    var splice = newSplice(index, removed, addedCount);

    var inserted = false;
    var insertionOffset = 0;

    for (var i = 0; i < splices.length; i++) {
      var current = splices[i];
      current.index += insertionOffset;

      if (inserted)
        continue;

      var intersectCount = intersect(splice.index,
                                     splice.index + splice.removed.length,
                                     current.index,
                                     current.index + current.addedCount);

      if (intersectCount >= 0) {
        // Merge the two splices

        splices.splice(i, 1);
        i--;

        insertionOffset -= current.addedCount - current.removed.length;

        splice.addedCount += current.addedCount - intersectCount;
        var deleteCount = splice.removed.length +
                          current.removed.length - intersectCount;

        if (!splice.addedCount && !deleteCount) {
          // merged splice is a noop. discard.
          inserted = true;
        } else {
          var removed = current.removed;

          if (splice.index < current.index) {
            // some prefix of splice.removed is prepended to current.removed.
            var prepend = splice.removed.slice(0, current.index - splice.index);
            Array.prototype.push.apply(prepend, removed);
            removed = prepend;
          }

          if (splice.index + splice.removed.length > current.index + current.addedCount) {
            // some suffix of splice.removed is appended to current.removed.
            var append = splice.removed.slice(current.index + current.addedCount - splice.index);
            Array.prototype.push.apply(removed, append);
          }

          splice.removed = removed;
          if (current.index < splice.index) {
            splice.index = current.index;
          }
        }
      } else if (splice.index < current.index) {
        // Insert splice here.

        inserted = true;

        splices.splice(i, 0, splice);
        i++;

        var offset = splice.addedCount - splice.removed.length
        current.index += offset;
        insertionOffset += offset;
      }
    }

    if (!inserted)
      splices.push(splice);
  }

  function createInitialSplices(array, changeRecords) {
    var splices = [];

    for (var i = 0; i < changeRecords.length; i++) {
      var record = changeRecords[i];
      switch(record.type) {
        case 'splice':
          mergeSplice(splices, record.index, record.removed.slice(), record.addedCount);
          break;
        case 'add':
        case 'update':
        case 'delete':
          if (!isIndex(record.name))
            continue;
          var index = toNumber(record.name);
          if (index < 0)
            continue;
          mergeSplice(splices, index, [record.oldValue], 1);
          break;
        default:
          console.error('Unexpected record type: ' + JSON.stringify(record));
          break;
      }
    }

    return splices;
  }

  function projectArraySplices(array, changeRecords) {
    var splices = [];

    createInitialSplices(array, changeRecords).forEach(function(splice) {
      if (splice.addedCount == 1 && splice.removed.length == 1) {
        if (splice.removed[0] !== array[splice.index])
          splices.push(splice);

        return
      };

      splices = splices.concat(calcSplices(array, splice.index, splice.index + splice.addedCount,
                                           splice.removed, 0, splice.removed.length));
    });

    return splices;
  }

 // Export the observe-js object for **Node.js**, with
// backwards-compatibility for the old `require()` API. If we're in
// the browser, export as a global object.
var expose = global;
if (typeof exports !== 'undefined') {
if (typeof module !== 'undefined' && module.exports) {
expose = exports = module.exports;
}
expose = exports;
}
expose.Observer = Observer;
expose.Observer.runEOM_ = runEOM;
expose.Observer.observerSentinel_ = observerSentinel; // for testing.
expose.Observer.hasObjectObserve = hasObserve;
expose.ArrayObserver = ArrayObserver;
expose.ArrayObserver.calculateSplices = function(current, previous) {
return arraySplice.calculateSplices(current, previous);
};
expose.Platform = global.Platform;
expose.ArraySplice = ArraySplice;
expose.ObjectObserver = ObjectObserver;
})(typeof global !== 'undefined' && global && typeof module !== 'undefined' && module ? global : this || window);

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}]},{},[1])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIuL2NvcmUvaW5kZXguanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9jb3JlL0FycmFuZ2VkUmVhY3RpdmVRdWVyeS5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2NvcmUvTWFueVRvTWFueVByb3h5LmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3QvY29yZS9Nb2RlbEluc3RhbmNlLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3QvY29yZS9PbmVUb01hbnlQcm94eS5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2NvcmUvT25lVG9PbmVQcm94eS5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2NvcmUvUXVlcnkuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9jb3JlL1F1ZXJ5U2V0LmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3QvY29yZS9SZWFjdGl2ZVF1ZXJ5LmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3QvY29yZS9SZWxhdGlvbnNoaXBQcm94eS5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2NvcmUvUmVsYXRpb25zaGlwVHlwZS5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2NvcmUvY2FjaGUuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9jb3JlL2NvbGxlY3Rpb24uanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9jb3JlL2NvbGxlY3Rpb25SZWdpc3RyeS5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2NvcmUvZXJyb3IuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9jb3JlL2V2ZW50cy5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2NvcmUvaW5zdGFuY2VGYWN0b3J5LmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3QvY29yZS9sb2cuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9jb3JlL21hcHBpbmdPcGVyYXRpb24uanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9jb3JlL21vZGVsLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3QvY29yZS9tb2RlbEV2ZW50cy5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2NvcmUvc3RvcmUuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9jb3JlL3V0aWwvYXN5bmMuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9jb3JlL3V0aWwvaW5kZXguanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9jb3JlL3V0aWwvbWlzYy5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2NvcmUvdXRpbC91bmRlcnNjb3JlLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3Qvbm9kZV9tb2R1bGVzL2FyZ3NhcnJheS9pbmRleC5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXJlc29sdmUvZW1wdHkuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvZXZlbnRzL2V2ZW50cy5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L25vZGVfbW9kdWxlcy9kZWJ1Zy9icm93c2VyLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3Qvbm9kZV9tb2R1bGVzL2RlYnVnL2RlYnVnLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3Qvbm9kZV9tb2R1bGVzL2RlYnVnL25vZGVfbW9kdWxlcy9tcy9pbmRleC5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L25vZGVfbW9kdWxlcy9leHRlbmQvaW5kZXguanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9ub2RlX21vZHVsZXMvbGllL2xpYi9JTlRFUk5BTC5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L25vZGVfbW9kdWxlcy9saWUvbGliL2FsbC5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L25vZGVfbW9kdWxlcy9saWUvbGliL2hhbmRsZXJzLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3Qvbm9kZV9tb2R1bGVzL2xpZS9saWIvaW5kZXguanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9ub2RlX21vZHVsZXMvbGllL2xpYi9wcm9taXNlLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3Qvbm9kZV9tb2R1bGVzL2xpZS9saWIvcXVldWVJdGVtLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3Qvbm9kZV9tb2R1bGVzL2xpZS9saWIvcmFjZS5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L25vZGVfbW9kdWxlcy9saWUvbGliL3JlamVjdC5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L25vZGVfbW9kdWxlcy9saWUvbGliL3Jlc29sdmUuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9ub2RlX21vZHVsZXMvbGllL2xpYi9yZXNvbHZlVGhlbmFibGUuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9ub2RlX21vZHVsZXMvbGllL2xpYi9zdGF0ZXMuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9ub2RlX21vZHVsZXMvbGllL2xpYi90cnlDYXRjaC5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L25vZGVfbW9kdWxlcy9saWUvbGliL3Vud3JhcC5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L25vZGVfbW9kdWxlcy9saWUvbm9kZV9tb2R1bGVzL2ltbWVkaWF0ZS9saWIvaW5kZXguanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9ub2RlX21vZHVsZXMvbGllL25vZGVfbW9kdWxlcy9pbW1lZGlhdGUvbGliL21lc3NhZ2VDaGFubmVsLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3Qvbm9kZV9tb2R1bGVzL2xpZS9ub2RlX21vZHVsZXMvaW1tZWRpYXRlL2xpYi9tdXRhdGlvbi5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L25vZGVfbW9kdWxlcy9saWUvbm9kZV9tb2R1bGVzL2ltbWVkaWF0ZS9saWIvc3RhdGVDaGFuZ2UuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9ub2RlX21vZHVsZXMvbGllL25vZGVfbW9kdWxlcy9pbW1lZGlhdGUvbGliL3RpbWVvdXQuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9zdG9yYWdlL2luZGV4LmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3QvdmVuZG9yL29ic2VydmUtanMvc3JjL29ic2VydmUuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDck1BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbExBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsUkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvVEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvV0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6UUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2SkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDak9BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcllBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL2NBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaEhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDek5BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVNQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5UUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6VEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEJBOztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN1NBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5SkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JNQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0pBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNWQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDZEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25CQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL2NBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIoZnVuY3Rpb24gKCkge1xuICAgIHZhciB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyksXG4gICAgICAgIENvbGxlY3Rpb25SZWdpc3RyeSA9IHJlcXVpcmUoJy4vY29sbGVjdGlvblJlZ2lzdHJ5JykuQ29sbGVjdGlvblJlZ2lzdHJ5LFxuICAgICAgICBDb2xsZWN0aW9uID0gcmVxdWlyZSgnLi9jb2xsZWN0aW9uJyksXG4gICAgICAgIGNhY2hlID0gcmVxdWlyZSgnLi9jYWNoZScpLFxuICAgICAgICBNb2RlbCA9IHJlcXVpcmUoJy4vbW9kZWwnKSxcbiAgICAgICAgZXJyb3IgPSByZXF1aXJlKCcuL2Vycm9yJyksXG4gICAgICAgIGV2ZW50cyA9IHJlcXVpcmUoJy4vZXZlbnRzJyksXG4gICAgICAgIFJlbGF0aW9uc2hpcFR5cGUgPSByZXF1aXJlKCcuL1JlbGF0aW9uc2hpcFR5cGUnKSxcbiAgICAgICAgUmVhY3RpdmVRdWVyeSA9IHJlcXVpcmUoJy4vUmVhY3RpdmVRdWVyeScpLFxuICAgICAgICBNYW55VG9NYW55UHJveHkgPSByZXF1aXJlKCcuL01hbnlUb01hbnlQcm94eScpLFxuICAgICAgICBPbmVUb09uZVByb3h5ID0gcmVxdWlyZSgnLi9PbmVUb09uZVByb3h5JyksXG4gICAgICAgIE9uZVRvTWFueVByb3h5ID0gcmVxdWlyZSgnLi9PbmVUb01hbnlQcm94eScpLFxuICAgICAgICBSZWxhdGlvbnNoaXBQcm94eSA9IHJlcXVpcmUoJy4vUmVsYXRpb25zaGlwUHJveHknKSxcbiAgICAgICAgbW9kZWxFdmVudHMgPSByZXF1aXJlKCcuL21vZGVsRXZlbnRzJyksXG4gICAgICAgIFF1ZXJ5ID0gcmVxdWlyZSgnLi9RdWVyeScpLFxuICAgICAgICBxdWVyeVNldCA9IHJlcXVpcmUoJy4vUXVlcnlTZXQnKSxcbiAgICAgICAgbG9nID0gcmVxdWlyZSgnLi9sb2cnKSxcbiAgICAgICAgXyA9IHV0aWwuXztcblxuICAgIHV0aWwuX3BhdGNoQmluZCgpO1xuXG4gICAgLy8gSW5pdGlhbGlzZSBzaWVzdGEgb2JqZWN0LiBTdHJhbmdlIGZvcm1hdCBmYWNpbGl0aWVzIHVzaW5nIHN1Ym1vZHVsZXMgd2l0aCByZXF1aXJlSlMgKGV2ZW50dWFsbHkpXG4gICAgdmFyIHNpZXN0YSA9IGZ1bmN0aW9uIChleHQpIHtcbiAgICAgICAgaWYgKCFzaWVzdGEuZXh0KSBzaWVzdGEuZXh0ID0ge307XG4gICAgICAgIF8uZXh0ZW5kKHNpZXN0YS5leHQsIGV4dCB8fCB7fSk7XG4gICAgICAgIHJldHVybiBzaWVzdGE7XG4gICAgfTtcblxuICAgIC8vIE5vdGlmaWNhdGlvbnNcbiAgICBfLmV4dGVuZChzaWVzdGEsIHtcbiAgICAgICAgb246IGV2ZW50cy5vbi5iaW5kKGV2ZW50cyksXG4gICAgICAgIG9mZjogZXZlbnRzLnJlbW92ZUxpc3RlbmVyLmJpbmQoZXZlbnRzKSxcbiAgICAgICAgb25jZTogZXZlbnRzLm9uY2UuYmluZChldmVudHMpLFxuICAgICAgICByZW1vdmVBbGxMaXN0ZW5lcnM6IGV2ZW50cy5yZW1vdmVBbGxMaXN0ZW5lcnMuYmluZChldmVudHMpXG4gICAgfSk7XG4gICAgXy5leHRlbmQoc2llc3RhLCB7XG4gICAgICAgIHJlbW92ZUxpc3RlbmVyOiBzaWVzdGEub2ZmLFxuICAgICAgICBhZGRMaXN0ZW5lcjogc2llc3RhLm9uXG4gICAgfSk7XG5cbiAgICAvLyBFeHBvc2Ugc29tZSBzdHVmZiBmb3IgdXNhZ2UgYnkgZXh0ZW5zaW9ucyBhbmQvb3IgdXNlcnNcbiAgICBfLmV4dGVuZChzaWVzdGEsIHtcbiAgICAgICAgUmVsYXRpb25zaGlwVHlwZTogUmVsYXRpb25zaGlwVHlwZSxcbiAgICAgICAgTW9kZWxFdmVudFR5cGU6IG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlLFxuICAgICAgICBsb2c6IGxvZy5MZXZlbCxcbiAgICAgICAgSW5zZXJ0aW9uUG9saWN5OiBSZWFjdGl2ZVF1ZXJ5Lkluc2VydGlvblBvbGljeSxcbiAgICAgICAgX2ludGVybmFsOiB7XG4gICAgICAgICAgICBsb2c6IGxvZyxcbiAgICAgICAgICAgIE1vZGVsOiBNb2RlbCxcbiAgICAgICAgICAgIGVycm9yOiBlcnJvcixcbiAgICAgICAgICAgIE1vZGVsRXZlbnRUeXBlOiBtb2RlbEV2ZW50cy5Nb2RlbEV2ZW50VHlwZSxcbiAgICAgICAgICAgIE1vZGVsSW5zdGFuY2U6IHJlcXVpcmUoJy4vTW9kZWxJbnN0YW5jZScpLFxuICAgICAgICAgICAgZXh0ZW5kOiByZXF1aXJlKCdleHRlbmQnKSxcbiAgICAgICAgICAgIE1hcHBpbmdPcGVyYXRpb246IHJlcXVpcmUoJy4vbWFwcGluZ09wZXJhdGlvbicpLFxuICAgICAgICAgICAgZXZlbnRzOiBldmVudHMsXG4gICAgICAgICAgICBQcm94eUV2ZW50RW1pdHRlcjogZXZlbnRzLlByb3h5RXZlbnRFbWl0dGVyLFxuICAgICAgICAgICAgY2FjaGU6IHJlcXVpcmUoJy4vY2FjaGUnKSxcbiAgICAgICAgICAgIG1vZGVsRXZlbnRzOiBtb2RlbEV2ZW50cyxcbiAgICAgICAgICAgIENvbGxlY3Rpb25SZWdpc3RyeTogcmVxdWlyZSgnLi9jb2xsZWN0aW9uUmVnaXN0cnknKS5Db2xsZWN0aW9uUmVnaXN0cnksXG4gICAgICAgICAgICBDb2xsZWN0aW9uOiBDb2xsZWN0aW9uLFxuICAgICAgICAgICAgdXRpbHM6IHV0aWwsXG4gICAgICAgICAgICB1dGlsOiB1dGlsLFxuICAgICAgICAgICAgXzogdXRpbC5fLFxuICAgICAgICAgICAgcXVlcnlTZXQ6IHF1ZXJ5U2V0LFxuICAgICAgICAgICAgb2JzZXJ2ZTogcmVxdWlyZSgnLi4vdmVuZG9yL29ic2VydmUtanMvc3JjL29ic2VydmUnKSxcbiAgICAgICAgICAgIFF1ZXJ5OiBRdWVyeSxcbiAgICAgICAgICAgIFN0b3JlOiByZXF1aXJlKCcuL3N0b3JlJyksXG4gICAgICAgICAgICBNYW55VG9NYW55UHJveHk6IE1hbnlUb01hbnlQcm94eSxcbiAgICAgICAgICAgIE9uZVRvTWFueVByb3h5OiBPbmVUb01hbnlQcm94eSxcbiAgICAgICAgICAgIE9uZVRvT25lUHJveHk6IE9uZVRvT25lUHJveHksXG4gICAgICAgICAgICBSZWxhdGlvbnNoaXBQcm94eTogUmVsYXRpb25zaGlwUHJveHlcbiAgICAgICAgfSxcbiAgICAgICAgXzogdXRpbC5fLFxuICAgICAgICBhc3luYzogdXRpbC5hc3luYyxcbiAgICAgICAgaXNBcnJheTogdXRpbC5pc0FycmF5LFxuICAgICAgICBpc1N0cmluZzogdXRpbC5pc1N0cmluZ1xuICAgIH0pO1xuXG4gICAgc2llc3RhLmV4dCA9IHt9O1xuXG4gICAgdmFyIGluc3RhbGxlZCA9IGZhbHNlLFxuICAgICAgICBpbnN0YWxsaW5nID0gZmFsc2U7XG5cblxuICAgIF8uZXh0ZW5kKHNpZXN0YSwge1xuICAgICAgICAvKipcbiAgICAgICAgICogV2lwZSBldmVyeXRoaW5nLiBVc2VkIGR1cmluZyB0ZXN0IGdlbmVyYWxseS5cbiAgICAgICAgICovXG4gICAgICAgIHJlc2V0OiBmdW5jdGlvbiAoY2IpIHtcbiAgICAgICAgICAgIGluc3RhbGxlZCA9IGZhbHNlO1xuICAgICAgICAgICAgaW5zdGFsbGluZyA9IGZhbHNlO1xuICAgICAgICAgICAgZGVsZXRlIHRoaXMucXVldWVkVGFza3M7XG4gICAgICAgICAgICBjYWNoZS5yZXNldCgpO1xuICAgICAgICAgICAgQ29sbGVjdGlvblJlZ2lzdHJ5LnJlc2V0KCk7XG4gICAgICAgICAgICBldmVudHMucmVtb3ZlQWxsTGlzdGVuZXJzKCk7XG4gICAgICAgICAgICBpZiAoc2llc3RhLmV4dC5zdG9yYWdlRW5hYmxlZCkge1xuICAgICAgICAgICAgICAgIHNpZXN0YS5leHQuc3RvcmFnZS5fcmVzZXQoY2IpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgY2IoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgLyoqXG4gICAgICAgICAqIENyZWF0ZXMgYW5kIHJlZ2lzdGVycyBhIG5ldyBDb2xsZWN0aW9uLlxuICAgICAgICAgKiBAcGFyYW0gIHtTdHJpbmd9IG5hbWVcbiAgICAgICAgICogQHBhcmFtICB7T2JqZWN0fSBbb3B0c11cbiAgICAgICAgICogQHJldHVybiB7Q29sbGVjdGlvbn1cbiAgICAgICAgICovXG4gICAgICAgIGNvbGxlY3Rpb246IGZ1bmN0aW9uIChuYW1lLCBvcHRzKSB7XG4gICAgICAgICAgICByZXR1cm4gbmV3IENvbGxlY3Rpb24obmFtZSwgb3B0cyk7XG4gICAgICAgIH0sXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBJbnN0YWxsIGFsbCBjb2xsZWN0aW9ucy5cbiAgICAgICAgICogQHBhcmFtIHtGdW5jdGlvbn0gW2NiXVxuICAgICAgICAgKiBAcmV0dXJucyB7cS5Qcm9taXNlfVxuICAgICAgICAgKi9cbiAgICAgICAgaW5zdGFsbDogZnVuY3Rpb24gKGNiKSB7XG4gICAgICAgICAgICBpZiAoIWluc3RhbGxpbmcgJiYgIWluc3RhbGxlZCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uIChjYikge1xuICAgICAgICAgICAgICAgICAgICBpbnN0YWxsaW5nID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGNvbGxlY3Rpb25OYW1lcyA9IENvbGxlY3Rpb25SZWdpc3RyeS5jb2xsZWN0aW9uTmFtZXMsXG4gICAgICAgICAgICAgICAgICAgICAgICB0YXNrcyA9IF8ubWFwKGNvbGxlY3Rpb25OYW1lcywgZnVuY3Rpb24gKG4pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gQ29sbGVjdGlvblJlZ2lzdHJ5W25dLmluc3RhbGwuYmluZChDb2xsZWN0aW9uUmVnaXN0cnlbbl0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSksXG4gICAgICAgICAgICAgICAgICAgICAgICBzdG9yYWdlRW5hYmxlZCA9IHNpZXN0YS5leHQuc3RvcmFnZUVuYWJsZWQ7XG4gICAgICAgICAgICAgICAgICAgIGlmIChzdG9yYWdlRW5hYmxlZCkgdGFza3MgPSB0YXNrcy5jb25jYXQoW3NpZXN0YS5leHQuc3RvcmFnZS5lbnN1cmVJbmRleGVzRm9yQWxsLCBzaWVzdGEuZXh0LnN0b3JhZ2UuX2xvYWRdKTtcbiAgICAgICAgICAgICAgICAgICAgdGFza3MucHVzaChmdW5jdGlvbiAoZG9uZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaW5zdGFsbGVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLnF1ZXVlZFRhc2tzKSB0aGlzLnF1ZXVlZFRhc2tzLmV4ZWN1dGUoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRvbmUoKTtcbiAgICAgICAgICAgICAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgICAgICAgICAgICAgICAgc2llc3RhLmFzeW5jLnNlcmllcyh0YXNrcywgY2IpO1xuICAgICAgICAgICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGNiKGVycm9yKCdhbHJlYWR5IGluc3RhbGxpbmcnKSk7XG4gICAgICAgIH0sXG4gICAgICAgIF9wdXNoVGFzazogZnVuY3Rpb24gKHRhc2spIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5xdWV1ZWRUYXNrcykge1xuICAgICAgICAgICAgICAgIHRoaXMucXVldWVkVGFza3MgPSBuZXcgZnVuY3Rpb24gUXVldWUoKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMudGFza3MgPSBbXTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5leGVjdXRlID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy50YXNrcy5mb3JFYWNoKGZ1bmN0aW9uIChmKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZigpXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMudGFza3MgPSBbXTtcbiAgICAgICAgICAgICAgICAgICAgfS5iaW5kKHRoaXMpO1xuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLnF1ZXVlZFRhc2tzLnRhc2tzLnB1c2godGFzayk7XG4gICAgICAgIH0sXG4gICAgICAgIF9hZnRlckluc3RhbGw6IGZ1bmN0aW9uICh0YXNrKSB7XG4gICAgICAgICAgICBpZiAoIWluc3RhbGxlZCkge1xuICAgICAgICAgICAgICAgIGlmICghaW5zdGFsbGluZykge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmluc3RhbGwoZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVycikgY29uc29sZS5lcnJvcignRXJyb3Igc2V0dGluZyB1cCBzaWVzdGEnLCBlcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZGVsZXRlIHRoaXMucXVldWVkVGFza3M7XG4gICAgICAgICAgICAgICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIC8vIEluIGNhc2UgaW5zdGFsbGVkIHN0cmFpZ2h0IGF3YXkgZS5nLiBpZiBzdG9yYWdlIGV4dGVuc2lvbiBub3QgaW5zdGFsbGVkLlxuICAgICAgICAgICAgICAgIGlmICghaW5zdGFsbGVkKSB0aGlzLl9wdXNoVGFzayh0YXNrKTtcbiAgICAgICAgICAgICAgICBlbHNlIHRhc2soKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHRhc2soKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgc2V0TG9nTGV2ZWw6IGZ1bmN0aW9uIChsb2dnZXJOYW1lLCBsZXZlbCkge1xuICAgICAgICAgICAgdmFyIExvZ2dlciA9IGxvZy5sb2dnZXJXaXRoTmFtZShsb2dnZXJOYW1lKTtcbiAgICAgICAgICAgIExvZ2dlci5zZXRMZXZlbChsZXZlbCk7XG4gICAgICAgIH0sXG4gICAgICAgIG5vdGlmeTogdXRpbC5uZXh0LFxuICAgICAgICByZWdpc3RlckNvbXBhcmF0b3I6IFF1ZXJ5LnJlZ2lzdGVyQ29tcGFyYXRvci5iaW5kKFF1ZXJ5KVxuICAgIH0pO1xuXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnRpZXMoc2llc3RhLCB7XG4gICAgICAgIF9jYW5DaGFuZ2U6IHtcbiAgICAgICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiAhKGluc3RhbGxpbmcgfHwgaW5zdGFsbGVkKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgaWYgKHR5cGVvZiB3aW5kb3cgIT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgd2luZG93WydzaWVzdGEnXSA9IHNpZXN0YTtcbiAgICB9XG5cbiAgICBzaWVzdGEubG9nID0gcmVxdWlyZSgnZGVidWcnKTtcblxuICAgIG1vZHVsZS5leHBvcnRzID0gc2llc3RhO1xuXG5cblxuICAgIChmdW5jdGlvbiBsb2FkRXh0ZW5zaW9ucygpIHtcbiAgICAgICAgcmVxdWlyZSgnLi4vc3RvcmFnZScpO1xuICAgIH0pKCk7XG5cbn0pKCk7IiwiLyoqXG4gKiBTb2x2ZXMgdGhlIGNvbW1vbiBwcm9ibGVtIG9mIG1haW50YWluaW5nIHRoZSBvcmRlciBvZiBhIHNldCBvZiBhIG1vZGVscyBhbmQgcXVlcnlpbmcgb24gdGhhdCBvcmRlci5cbiAqXG4gKiBUaGUgc2FtZSBhcyBSZWFjdGl2ZVF1ZXJ5IGJ1dCBlbmFibGVzIG1hbnVhbCByZW9yZGVyaW5nIG9mIG1vZGVscyBhbmQgbWFpbnRhaW5zIGFuIGluZGV4IGZpZWxkLlxuICovXG5cbihmdW5jdGlvbiAoKSB7XG5cbiAgICB2YXIgUmVhY3RpdmVRdWVyeSA9IHJlcXVpcmUoJy4vUmVhY3RpdmVRdWVyeScpLFxuICAgICAgICBsb2cgPSByZXF1aXJlKCcuL2xvZycpKCdxdWVyeScpLFxuICAgICAgICB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyksXG4gICAgICAgIGVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpLFxuICAgICAgICBtb2RlbEV2ZW50cyA9IHJlcXVpcmUoJy4vbW9kZWxFdmVudHMnKSxcbiAgICAgICAgSW50ZXJuYWxTaWVzdGFFcnJvciA9IGVycm9yLkludGVybmFsU2llc3RhRXJyb3IsXG4gICAgICAgIGNvbnN0cnVjdFF1ZXJ5U2V0ID0gcmVxdWlyZSgnLi9RdWVyeVNldCcpLFxuICAgICAgICBfID0gdXRpbC5fO1xuXG4gICAgZnVuY3Rpb24gQXJyYW5nZWRSZWFjdGl2ZVF1ZXJ5KHF1ZXJ5KSB7XG4gICAgICAgIFJlYWN0aXZlUXVlcnkuY2FsbCh0aGlzLCBxdWVyeSk7XG4gICAgICAgIHRoaXMuaW5kZXhBdHRyaWJ1dGUgPSAnaW5kZXgnO1xuICAgIH1cblxuICAgIEFycmFuZ2VkUmVhY3RpdmVRdWVyeS5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKFJlYWN0aXZlUXVlcnkucHJvdG90eXBlKTtcblxuICAgIF8uZXh0ZW5kKEFycmFuZ2VkUmVhY3RpdmVRdWVyeS5wcm90b3R5cGUsIHtcbiAgICAgICAgX3JlZnJlc2hJbmRleGVzOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB2YXIgcmVzdWx0cyA9IHRoaXMucmVzdWx0cyxcbiAgICAgICAgICAgICAgICBpbmRleEF0dHJpYnV0ZSA9IHRoaXMuaW5kZXhBdHRyaWJ1dGU7XG4gICAgICAgICAgICBpZiAoIXJlc3VsdHMpIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdBcnJhbmdlZFJlYWN0aXZlUXVlcnkgbXVzdCBiZSBpbml0aWFsaXNlZCcpO1xuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCByZXN1bHRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgdmFyIG1vZGVsSW5zdGFuY2UgPSByZXN1bHRzW2ldO1xuICAgICAgICAgICAgICAgIG1vZGVsSW5zdGFuY2VbaW5kZXhBdHRyaWJ1dGVdID0gaTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgX21lcmdlSW5kZXhlczogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdmFyIHJlc3VsdHMgPSB0aGlzLnJlc3VsdHMsXG4gICAgICAgICAgICAgICAgbmV3UmVzdWx0cyA9IFtdLFxuICAgICAgICAgICAgICAgIG91dE9mQm91bmRzID0gW10sXG4gICAgICAgICAgICAgICAgdW5pbmRleGVkID0gW107XG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHJlc3VsdHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICB2YXIgcmVzID0gcmVzdWx0c1tpXSxcbiAgICAgICAgICAgICAgICAgICAgc3RvcmVkSW5kZXggPSByZXNbdGhpcy5pbmRleEF0dHJpYnV0ZV07XG4gICAgICAgICAgICAgICAgaWYgKHN0b3JlZEluZGV4ID09IHVuZGVmaW5lZCkgeyAvLyBudWxsIG9yIHVuZGVmaW5lZFxuICAgICAgICAgICAgICAgICAgICB1bmluZGV4ZWQucHVzaChyZXMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIGlmIChzdG9yZWRJbmRleCA+IHJlc3VsdHMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgIG91dE9mQm91bmRzLnB1c2gocmVzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIEhhbmRsZSBkdXBsaWNhdGUgaW5kZXhlc1xuICAgICAgICAgICAgICAgICAgICBpZiAoIW5ld1Jlc3VsdHNbc3RvcmVkSW5kZXhdKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBuZXdSZXN1bHRzW3N0b3JlZEluZGV4XSA9IHJlcztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHVuaW5kZXhlZC5wdXNoKHJlcyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBvdXRPZkJvdW5kcyA9IF8uc29ydEJ5KG91dE9mQm91bmRzLCBmdW5jdGlvbiAoeCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB4W3RoaXMuaW5kZXhBdHRyaWJ1dGVdO1xuICAgICAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgICAgICAgIC8vIFNoaWZ0IHRoZSBpbmRleCBvZiBhbGwgbW9kZWxzIHdpdGggaW5kZXhlcyBvdXQgb2YgYm91bmRzIGludG8gdGhlIGNvcnJlY3QgcmFuZ2UuXG4gICAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgb3V0T2ZCb3VuZHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICByZXMgPSBvdXRPZkJvdW5kc1tpXTtcbiAgICAgICAgICAgICAgICB2YXIgcmVzdWx0c0luZGV4ID0gdGhpcy5yZXN1bHRzLmxlbmd0aCAtIG91dE9mQm91bmRzLmxlbmd0aCArIGk7XG4gICAgICAgICAgICAgICAgcmVzW3RoaXMuaW5kZXhBdHRyaWJ1dGVdID0gcmVzdWx0c0luZGV4O1xuICAgICAgICAgICAgICAgIG5ld1Jlc3VsdHNbcmVzdWx0c0luZGV4XSA9IHJlcztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHVuaW5kZXhlZCA9IHRoaXMuX3F1ZXJ5Ll9zb3J0UmVzdWx0cyh1bmluZGV4ZWQpO1xuICAgICAgICAgICAgdmFyIG4gPSAwO1xuICAgICAgICAgICAgd2hpbGUgKHVuaW5kZXhlZC5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICByZXMgPSB1bmluZGV4ZWQuc2hpZnQoKTtcbiAgICAgICAgICAgICAgICB3aGlsZSAobmV3UmVzdWx0c1tuXSkge1xuICAgICAgICAgICAgICAgICAgICBuKys7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIG5ld1Jlc3VsdHNbbl0gPSByZXM7XG4gICAgICAgICAgICAgICAgcmVzW3RoaXMuaW5kZXhBdHRyaWJ1dGVdID0gbjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5yZXN1bHRzID0gY29uc3RydWN0UXVlcnlTZXQobmV3UmVzdWx0cywgdGhpcy5tb2RlbCk7XG4gICAgICAgIH0sXG4gICAgICAgIGluaXQ6IGZ1bmN0aW9uIChjYikge1xuICAgICAgICAgICAgcmV0dXJuIHV0aWwucHJvbWlzZShjYiwgZnVuY3Rpb24gKGNiKSB7XG4gICAgICAgICAgICAgICAgUmVhY3RpdmVRdWVyeS5wcm90b3R5cGUuaW5pdC5jYWxsKHRoaXMsIGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghdGhpcy5tb2RlbC5oYXNBdHRyaWJ1dGVOYW1lZCh0aGlzLmluZGV4QXR0cmlidXRlKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVyciA9IGVycm9yKCdNb2RlbCBcIicgKyB0aGlzLm1vZGVsLm5hbWUgKyAnXCIgZG9lcyBub3QgaGF2ZSBhbiBhdHRyaWJ1dGUgbmFtZWQgXCInICsgdGhpcy5pbmRleEF0dHJpYnV0ZSArICdcIicpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fbWVyZ2VJbmRleGVzKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fcXVlcnkuY2xlYXJPcmRlcmluZygpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGNiKGVyciwgZXJyID8gbnVsbCA6IHRoaXMucmVzdWx0cyk7XG4gICAgICAgICAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICAgIH0sXG4gICAgICAgIF9oYW5kbGVOb3RpZjogZnVuY3Rpb24gKG4pIHtcbiAgICAgICAgICAgIC8vIFdlIGRvbid0IHdhbnQgdG8ga2VlcCBleGVjdXRpbmcgdGhlIHF1ZXJ5IGVhY2ggdGltZSB0aGUgaW5kZXggZXZlbnQgZmlyZXMgYXMgd2UncmUgY2hhbmdpbmcgdGhlIGluZGV4IG91cnNlbHZlc1xuICAgICAgICAgICAgaWYgKG4uZmllbGQgIT0gdGhpcy5pbmRleEF0dHJpYnV0ZSkge1xuICAgICAgICAgICAgICAgIFJlYWN0aXZlUXVlcnkucHJvdG90eXBlLl9oYW5kbGVOb3RpZi5jYWxsKHRoaXMsIG4pO1xuICAgICAgICAgICAgICAgIHRoaXMuX3JlZnJlc2hJbmRleGVzKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHZhbGlkYXRlSW5kZXg6IGZ1bmN0aW9uIChpZHgpIHtcbiAgICAgICAgICAgIHZhciBtYXhJbmRleCA9IHRoaXMucmVzdWx0cy5sZW5ndGggLSAxLFxuICAgICAgICAgICAgICAgIG1pbkluZGV4ID0gMDtcbiAgICAgICAgICAgIGlmICghKGlkeCA+PSBtaW5JbmRleCAmJiBpZHggPD0gbWF4SW5kZXgpKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbmRleCAnICsgaWR4LnRvU3RyaW5nKCkgKyAnIGlzIG91dCBvZiBib3VuZHMnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgc3dhcE9iamVjdHNBdEluZGV4ZXM6IGZ1bmN0aW9uIChmcm9tLCB0bykge1xuICAgICAgICAgICAgLy9ub2luc3BlY3Rpb24gVW5uZWNlc3NhcnlMb2NhbFZhcmlhYmxlSlNcbiAgICAgICAgICAgIHRoaXMudmFsaWRhdGVJbmRleChmcm9tKTtcbiAgICAgICAgICAgIHRoaXMudmFsaWRhdGVJbmRleCh0byk7XG4gICAgICAgICAgICB2YXIgZnJvbU1vZGVsID0gdGhpcy5yZXN1bHRzW2Zyb21dLFxuICAgICAgICAgICAgICAgIHRvTW9kZWwgPSB0aGlzLnJlc3VsdHNbdG9dO1xuICAgICAgICAgICAgaWYgKCFmcm9tTW9kZWwpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ05vIG1vZGVsIGF0IGluZGV4IFwiJyArIGZyb20udG9TdHJpbmcoKSArICdcIicpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKCF0b01vZGVsKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdObyBtb2RlbCBhdCBpbmRleCBcIicgKyB0by50b1N0cmluZygpICsgJ1wiJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLnJlc3VsdHNbdG9dID0gZnJvbU1vZGVsO1xuICAgICAgICAgICAgdGhpcy5yZXN1bHRzW2Zyb21dID0gdG9Nb2RlbDtcbiAgICAgICAgICAgIGZyb21Nb2RlbFt0aGlzLmluZGV4QXR0cmlidXRlXSA9IHRvO1xuICAgICAgICAgICAgdG9Nb2RlbFt0aGlzLmluZGV4QXR0cmlidXRlXSA9IGZyb207XG4gICAgICAgIH0sXG4gICAgICAgIHN3YXBPYmplY3RzOiBmdW5jdGlvbiAob2JqMSwgb2JqMikge1xuICAgICAgICAgICAgdmFyIGZyb21JZHggPSB0aGlzLnJlc3VsdHMuaW5kZXhPZihvYmoxKSxcbiAgICAgICAgICAgICAgICB0b0lkeCA9IHRoaXMucmVzdWx0cy5pbmRleE9mKG9iajIpO1xuICAgICAgICAgICAgdGhpcy5zd2FwT2JqZWN0c0F0SW5kZXhlcyhmcm9tSWR4LCB0b0lkeCk7XG4gICAgICAgIH0sXG4gICAgICAgIG1vdmU6IGZ1bmN0aW9uIChmcm9tLCB0bykge1xuICAgICAgICAgICAgdGhpcy52YWxpZGF0ZUluZGV4KGZyb20pO1xuICAgICAgICAgICAgdGhpcy52YWxpZGF0ZUluZGV4KHRvKTtcbiAgICAgICAgICAgIHZhciByZXN1bHRzID0gdGhpcy5yZXN1bHRzLm11dGFibGVDb3B5KCk7XG4gICAgICAgICAgICAoZnVuY3Rpb24gKG9sZEluZGV4LCBuZXdJbmRleCkge1xuICAgICAgICAgICAgICAgIGlmIChuZXdJbmRleCA+PSB0aGlzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgayA9IG5ld0luZGV4IC0gdGhpcy5sZW5ndGg7XG4gICAgICAgICAgICAgICAgICAgIHdoaWxlICgoay0tKSArIDEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucHVzaCh1bmRlZmluZWQpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSkuY2FsbChyZXN1bHRzLCBmcm9tLCB0byk7XG4gICAgICAgICAgICB2YXIgcmVtb3ZlZCA9IHJlc3VsdHMuc3BsaWNlKGZyb20sIDEpWzBdO1xuICAgICAgICAgICAgdGhpcy5yZXN1bHRzID0gcmVzdWx0cy5hc01vZGVsUXVlcnlTZXQodGhpcy5tb2RlbCk7XG4gICAgICAgICAgICB0aGlzLmVtaXQoJ2NoYW5nZScsIHtcbiAgICAgICAgICAgICAgICBpbmRleDogZnJvbSxcbiAgICAgICAgICAgICAgICByZW1vdmVkOiBbcmVtb3ZlZF0sXG4gICAgICAgICAgICAgICAgdHlwZTogbW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUuU3BsaWNlLFxuICAgICAgICAgICAgICAgIG9iajogdGhpcyxcbiAgICAgICAgICAgICAgICBmaWVsZDogJ3Jlc3VsdHMnXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJlc3VsdHMuc3BsaWNlKHRvLCAwLCByZW1vdmVkKTtcbiAgICAgICAgICAgIHRoaXMucmVzdWx0cyA9IHJlc3VsdHMuYXNNb2RlbFF1ZXJ5U2V0KHRoaXMubW9kZWwpO1xuICAgICAgICAgICAgdGhpcy5lbWl0KCdjaGFuZ2UnLCB7XG4gICAgICAgICAgICAgICAgaW5kZXg6IHRvLFxuICAgICAgICAgICAgICAgIGFkZGVkOiBbcmVtb3ZlZF0sXG4gICAgICAgICAgICAgICAgdHlwZTogbW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUuU3BsaWNlLFxuICAgICAgICAgICAgICAgIG9iajogdGhpcyxcbiAgICAgICAgICAgICAgICBmaWVsZDogJ3Jlc3VsdHMnXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHRoaXMuX3JlZnJlc2hJbmRleGVzKCk7XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIG1vZHVsZS5leHBvcnRzID0gQXJyYW5nZWRSZWFjdGl2ZVF1ZXJ5O1xufSkoKTsiLCIoZnVuY3Rpb24gKCkge1xuICAgIC8qKlxuICAgICAqIEBtb2R1bGUgcmVsYXRpb25zaGlwc1xuICAgICAqL1xuXG4gICAgdmFyIFJlbGF0aW9uc2hpcFByb3h5ID0gcmVxdWlyZSgnLi9SZWxhdGlvbnNoaXBQcm94eScpLFxuICAgICAgICBTdG9yZSA9IHJlcXVpcmUoJy4vc3RvcmUnKSxcbiAgICAgICAgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpLFxuICAgICAgICBfID0gdXRpbC5fLFxuICAgICAgICBJbnRlcm5hbFNpZXN0YUVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpLkludGVybmFsU2llc3RhRXJyb3IsXG4gICAgICAgIG1vZGVsRXZlbnRzID0gcmVxdWlyZSgnLi9tb2RlbEV2ZW50cycpLFxuICAgICAgICBldmVudHMgPSByZXF1aXJlKCcuL2V2ZW50cycpLFxuICAgICAgICB3cmFwQXJyYXlGb3JBdHRyaWJ1dGVzID0gZXZlbnRzLndyYXBBcnJheSxcbiAgICAgICAgU2llc3RhTW9kZWwgPSByZXF1aXJlKCcuL01vZGVsSW5zdGFuY2UnKSxcbiAgICAgICAgQXJyYXlPYnNlcnZlciA9IHJlcXVpcmUoJy4uL3ZlbmRvci9vYnNlcnZlLWpzL3NyYy9vYnNlcnZlJykuQXJyYXlPYnNlcnZlcixcbiAgICAgICAgTW9kZWxFdmVudFR5cGUgPSByZXF1aXJlKCcuL21vZGVsRXZlbnRzJykuTW9kZWxFdmVudFR5cGU7XG5cbiAgICAvKipcbiAgICAgKiBbTWFueVRvTWFueVByb3h5IGRlc2NyaXB0aW9uXVxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBvcHRzXG4gICAgICovXG4gICAgZnVuY3Rpb24gTWFueVRvTWFueVByb3h5KG9wdHMpIHtcbiAgICAgICAgUmVsYXRpb25zaGlwUHJveHkuY2FsbCh0aGlzLCBvcHRzKTtcbiAgICAgICAgdGhpcy5yZWxhdGVkID0gW107XG4gICAgICAgIHRoaXMucmVsYXRlZENhbmNlbExpc3RlbmVycyA9IHt9O1xuICAgIH1cblxuICAgIE1hbnlUb01hbnlQcm94eS5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKFJlbGF0aW9uc2hpcFByb3h5LnByb3RvdHlwZSk7XG5cbiAgICBfLmV4dGVuZChNYW55VG9NYW55UHJveHkucHJvdG90eXBlLCB7XG4gICAgICAgIGNsZWFyUmV2ZXJzZTogZnVuY3Rpb24gKHJlbW92ZWQpIHtcbiAgICAgICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgICAgIF8uZWFjaChyZW1vdmVkLCBmdW5jdGlvbiAocmVtb3ZlZE9iamVjdCkge1xuICAgICAgICAgICAgICAgIHZhciByZXZlcnNlUHJveHkgPSBzZWxmLnJldmVyc2VQcm94eUZvckluc3RhbmNlKHJlbW92ZWRPYmplY3QpO1xuICAgICAgICAgICAgICAgIHZhciBpZHggPSByZXZlcnNlUHJveHkucmVsYXRlZC5pbmRleE9mKHNlbGYub2JqZWN0KTtcbiAgICAgICAgICAgICAgICByZXZlcnNlUHJveHkubWFrZUNoYW5nZXNUb1JlbGF0ZWRXaXRob3V0T2JzZXJ2YXRpb25zKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV2ZXJzZVByb3h5LnNwbGljZShpZHgsIDEpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0sXG4gICAgICAgIHNldFJldmVyc2VPZkFkZGVkOiBmdW5jdGlvbiAoYWRkZWQpIHtcbiAgICAgICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgICAgIF8uZWFjaChhZGRlZCwgZnVuY3Rpb24gKGFkZGVkT2JqZWN0KSB7XG4gICAgICAgICAgICAgICAgdmFyIHJldmVyc2VQcm94eSA9IHNlbGYucmV2ZXJzZVByb3h5Rm9ySW5zdGFuY2UoYWRkZWRPYmplY3QpO1xuICAgICAgICAgICAgICAgIHJldmVyc2VQcm94eS5tYWtlQ2hhbmdlc1RvUmVsYXRlZFdpdGhvdXRPYnNlcnZhdGlvbnMoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICByZXZlcnNlUHJveHkuc3BsaWNlKDAsIDAsIHNlbGYub2JqZWN0KTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9LFxuICAgICAgICB3cmFwQXJyYXk6IGZ1bmN0aW9uIChhcnIpIHtcbiAgICAgICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgICAgIHdyYXBBcnJheUZvckF0dHJpYnV0ZXMoYXJyLCB0aGlzLnJldmVyc2VOYW1lLCB0aGlzLm9iamVjdCk7XG4gICAgICAgICAgICBpZiAoIWFyci5hcnJheU9ic2VydmVyKSB7XG4gICAgICAgICAgICAgICAgYXJyLmFycmF5T2JzZXJ2ZXIgPSBuZXcgQXJyYXlPYnNlcnZlcihhcnIpO1xuICAgICAgICAgICAgICAgIHZhciBvYnNlcnZlckZ1bmN0aW9uID0gZnVuY3Rpb24gKHNwbGljZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgc3BsaWNlcy5mb3JFYWNoKGZ1bmN0aW9uIChzcGxpY2UpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBhZGRlZCA9IHNwbGljZS5hZGRlZENvdW50ID8gYXJyLnNsaWNlKHNwbGljZS5pbmRleCwgc3BsaWNlLmluZGV4ICsgc3BsaWNlLmFkZGVkQ291bnQpIDogW107XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgcmVtb3ZlZCA9IHNwbGljZS5yZW1vdmVkO1xuICAgICAgICAgICAgICAgICAgICAgICAgc2VsZi5jbGVhclJldmVyc2UocmVtb3ZlZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBzZWxmLnNldFJldmVyc2VPZkFkZGVkKGFkZGVkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBtb2RlbCA9IHNlbGYuZ2V0Rm9yd2FyZE1vZGVsKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBtb2RlbEV2ZW50cy5lbWl0KHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb2xsZWN0aW9uOiBtb2RlbC5jb2xsZWN0aW9uTmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtb2RlbDogbW9kZWwubmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBfaWQ6IHNlbGYub2JqZWN0Ll9pZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmaWVsZDogc2VsZi5nZXRGb3J3YXJkTmFtZSgpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlbW92ZWQ6IHJlbW92ZWQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYWRkZWQ6IGFkZGVkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6IE1vZGVsRXZlbnRUeXBlLlNwbGljZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbmRleDogc3BsaWNlLmluZGV4LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9iajogc2VsZi5vYmplY3RcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIGFyci5hcnJheU9ic2VydmVyLm9wZW4ob2JzZXJ2ZXJGdW5jdGlvbik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIGdldDogZnVuY3Rpb24gKGNiKSB7XG4gICAgICAgICAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbiAoY2IpIHtcbiAgICAgICAgICAgICAgICBjYihudWxsLCB0aGlzLnJlbGF0ZWQpO1xuICAgICAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgICAgfSxcbiAgICAgICAgdmFsaWRhdGU6IGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgICAgIGlmIChPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwob2JqKSAhPSAnW29iamVjdCBBcnJheV0nKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuICdDYW5ub3QgYXNzaWduIHNjYWxhciB0byBtYW55IHRvIG1hbnknO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH0sXG4gICAgICAgIHNldDogZnVuY3Rpb24gKG9iaiwgb3B0cykge1xuICAgICAgICAgICAgdGhpcy5jaGVja0luc3RhbGxlZCgpO1xuICAgICAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICAgICAgaWYgKG9iaikge1xuICAgICAgICAgICAgICAgIHZhciBlcnJvck1lc3NhZ2U7XG4gICAgICAgICAgICAgICAgaWYgKGVycm9yTWVzc2FnZSA9IHRoaXMudmFsaWRhdGUob2JqKSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZXJyb3JNZXNzYWdlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5jbGVhclJldmVyc2VSZWxhdGVkKG9wdHMpO1xuICAgICAgICAgICAgICAgICAgICBzZWxmLnNldElkQW5kUmVsYXRlZChvYmosIG9wdHMpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLndyYXBBcnJheShvYmopO1xuICAgICAgICAgICAgICAgICAgICBzZWxmLnNldElkQW5kUmVsYXRlZFJldmVyc2Uob2JqLCBvcHRzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLmNsZWFyUmV2ZXJzZVJlbGF0ZWQob3B0cyk7XG4gICAgICAgICAgICAgICAgc2VsZi5zZXRJZEFuZFJlbGF0ZWQob2JqLCBvcHRzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgaW5zdGFsbDogZnVuY3Rpb24gKG9iaikge1xuICAgICAgICAgICAgUmVsYXRpb25zaGlwUHJveHkucHJvdG90eXBlLmluc3RhbGwuY2FsbCh0aGlzLCBvYmopO1xuICAgICAgICAgICAgdGhpcy53cmFwQXJyYXkodGhpcy5yZWxhdGVkKTtcbiAgICAgICAgICAgIG9ialsoJ3NwbGljZScgKyB1dGlsLmNhcGl0YWxpc2VGaXJzdExldHRlcih0aGlzLnJldmVyc2VOYW1lKSldID0gXy5iaW5kKHRoaXMuc3BsaWNlLCB0aGlzKTtcbiAgICAgICAgfSxcbiAgICAgICAgcmVnaXN0ZXJSZW1vdmFsTGlzdGVuZXI6IGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgICAgIHRoaXMucmVsYXRlZENhbmNlbExpc3RlbmVyc1tvYmouX2lkXSA9IG9iai5saXN0ZW4oZnVuY3Rpb24gKGUpIHtcblxuICAgICAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgICAgfVxuICAgIH0pO1xuXG5cbiAgICBtb2R1bGUuZXhwb3J0cyA9IE1hbnlUb01hbnlQcm94eTtcbn0pKCk7IiwiKGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgbG9nID0gcmVxdWlyZSgnLi9sb2cnKSxcbiAgICAgICAgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpLFxuICAgICAgICBfID0gdXRpbC5fLFxuICAgICAgICBlcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKSxcbiAgICAgICAgSW50ZXJuYWxTaWVzdGFFcnJvciA9IGVycm9yLkludGVybmFsU2llc3RhRXJyb3IsXG4gICAgICAgIG1vZGVsRXZlbnRzID0gcmVxdWlyZSgnLi9tb2RlbEV2ZW50cycpLFxuICAgICAgICBldmVudHMgPSByZXF1aXJlKCcuL2V2ZW50cycpLFxuICAgICAgICBjYWNoZSA9IHJlcXVpcmUoJy4vY2FjaGUnKTtcblxuICAgIGZ1bmN0aW9uIE1vZGVsSW5zdGFuY2UobW9kZWwpIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICB0aGlzLm1vZGVsID0gbW9kZWw7XG5cbiAgICAgICAgdXRpbC5zdWJQcm9wZXJ0aWVzKHRoaXMsIHRoaXMubW9kZWwsIFtcbiAgICAgICAgICAgICdjb2xsZWN0aW9uJyxcbiAgICAgICAgICAgICdjb2xsZWN0aW9uTmFtZScsXG4gICAgICAgICAgICAnX2F0dHJpYnV0ZU5hbWVzJyxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBuYW1lOiAnaWRGaWVsZCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydHk6ICdpZCdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgbmFtZTogJ21vZGVsTmFtZScsXG4gICAgICAgICAgICAgICAgcHJvcGVydHk6ICduYW1lJ1xuICAgICAgICAgICAgfVxuICAgICAgICBdKTtcblxuICAgICAgICBldmVudHMuUHJveHlFdmVudEVtaXR0ZXIuY2FsbCh0aGlzKTtcblxuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydGllcyh0aGlzLCB7XG4gICAgICAgICAgICBfcmVsYXRpb25zaGlwTmFtZXM6IHtcbiAgICAgICAgICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHByb3hpZXMgPSBfLm1hcChPYmplY3Qua2V5cyhzZWxmLl9fcHJveGllcyB8fCB7fSksIGZ1bmN0aW9uICh4KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gc2VsZi5fX3Byb3hpZXNbeF1cbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBfLm1hcChwcm94aWVzLCBmdW5jdGlvbiAocCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHAuaXNGb3J3YXJkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHAuZm9yd2FyZE5hbWU7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBwLnJldmVyc2VOYW1lO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgICAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgZGlydHk6IHtcbiAgICAgICAgICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHNpZXN0YS5leHQuc3RvcmFnZUVuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBzZWxmLl9pZCBpbiBzaWVzdGEuZXh0LnN0b3JhZ2UuX3Vuc2F2ZWRPYmplY3RzSGFzaDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBlbHNlIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgLy8gVGhpcyBpcyBmb3IgUHJveHlFdmVudEVtaXR0ZXIuXG4gICAgICAgICAgICBldmVudDoge1xuICAgICAgICAgICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5faWRcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRoaXMucmVtb3ZlZCA9IGZhbHNlO1xuICAgIH1cblxuICAgIE1vZGVsSW5zdGFuY2UucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShldmVudHMuUHJveHlFdmVudEVtaXR0ZXIucHJvdG90eXBlKTtcblxuICAgIF8uZXh0ZW5kKE1vZGVsSW5zdGFuY2UucHJvdG90eXBlLCB7XG4gICAgICAgIGdldDogZnVuY3Rpb24gKGNiKSB7XG4gICAgICAgICAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbiAoY2IpIHtcbiAgICAgICAgICAgICAgICBjYihudWxsLCB0aGlzKTtcbiAgICAgICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICAgIH0sXG4gICAgICAgIGVtaXQ6IGZ1bmN0aW9uICh0eXBlLCBvcHRzKSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIHR5cGUgPT0gJ29iamVjdCcpIG9wdHMgPSB0eXBlO1xuICAgICAgICAgICAgZWxzZSBvcHRzLnR5cGUgPSB0eXBlO1xuICAgICAgICAgICAgb3B0cyA9IG9wdHMgfHwge307XG4gICAgICAgICAgICBfLmV4dGVuZChvcHRzLCB7XG4gICAgICAgICAgICAgICAgY29sbGVjdGlvbjogdGhpcy5jb2xsZWN0aW9uTmFtZSxcbiAgICAgICAgICAgICAgICBtb2RlbDogdGhpcy5tb2RlbC5uYW1lLFxuICAgICAgICAgICAgICAgIF9pZDogdGhpcy5faWQsXG4gICAgICAgICAgICAgICAgb2JqOiB0aGlzXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIG1vZGVsRXZlbnRzLmVtaXQob3B0cyk7XG4gICAgICAgIH0sXG4gICAgICAgIHJlbW92ZTogZnVuY3Rpb24gKGNiLCBub3RpZmljYXRpb24pIHtcbiAgICAgICAgICAgIG5vdGlmaWNhdGlvbiA9IG5vdGlmaWNhdGlvbiA9PSBudWxsID8gdHJ1ZSA6IG5vdGlmaWNhdGlvbjtcbiAgICAgICAgICAgIHJldHVybiB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uIChjYikge1xuICAgICAgICAgICAgICAgIGNhY2hlLnJlbW92ZSh0aGlzKTtcbiAgICAgICAgICAgICAgICB0aGlzLnJlbW92ZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgIGlmIChub3RpZmljYXRpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5lbWl0KG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlLlJlbW92ZSwge1xuICAgICAgICAgICAgICAgICAgICAgICAgb2xkOiB0aGlzXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB2YXIgcmVtb3ZlID0gdGhpcy5tb2RlbC5yZW1vdmU7XG4gICAgICAgICAgICAgICAgaWYgKHJlbW92ZSkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgcGFyYW1OYW1lcyA9IHV0aWwucGFyYW1OYW1lcyhyZW1vdmUpO1xuICAgICAgICAgICAgICAgICAgICBpZiAocGFyYW1OYW1lcy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlbW92ZS5jYWxsKHRoaXMsIGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYihlcnIsIHNlbGYpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZW1vdmUuY2FsbCh0aGlzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNiKG51bGwsIHRoaXMpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBjYihudWxsLCB0aGlzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICB9LFxuICAgICAgICByZXN0b3JlOiBmdW5jdGlvbiAoY2IpIHtcbiAgICAgICAgICAgIHJldHVybiB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uIChjYikge1xuICAgICAgICAgICAgICAgIHZhciBfZmluaXNoID0gZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5lbWl0KG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlLk5ldywge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5ldzogdGhpc1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgY2IoZXJyLCB0aGlzKTtcbiAgICAgICAgICAgICAgICB9LmJpbmQodGhpcyk7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMucmVtb3ZlZCkge1xuICAgICAgICAgICAgICAgICAgICBjYWNoZS5pbnNlcnQodGhpcyk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMucmVtb3ZlZCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICB2YXIgaW5pdCA9IHRoaXMubW9kZWwuaW5pdDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGluaXQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBwYXJhbU5hbWVzID0gdXRpbC5wYXJhbU5hbWVzKGluaXQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGZyb21TdG9yYWdlID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChwYXJhbU5hbWVzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbml0LmNhbGwodGhpcywgZnJvbVN0b3JhZ2UsIF9maW5pc2gpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaW5pdC5jYWxsKHRoaXMsIGZyb21TdG9yYWdlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBfZmluaXNoKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBfZmluaXNoKCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBJbnNwZWN0aW9uXG4gICAgXy5leHRlbmQoTW9kZWxJbnN0YW5jZS5wcm90b3R5cGUsIHtcbiAgICAgICAgZ2V0QXR0cmlidXRlczogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIF8uZXh0ZW5kKHt9LCB0aGlzLl9fdmFsdWVzKTtcbiAgICAgICAgfSxcbiAgICAgICAgaXNJbnN0YW5jZU9mOiBmdW5jdGlvbiAobW9kZWwpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLm1vZGVsID09IG1vZGVsO1xuICAgICAgICB9LFxuICAgICAgICBpc0E6IGZ1bmN0aW9uIChtb2RlbCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMubW9kZWwgPT0gbW9kZWwgfHwgdGhpcy5tb2RlbC5pc0Rlc2NlbmRhbnRPZihtb2RlbCk7XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIER1bXBcbiAgICBfLmV4dGVuZChNb2RlbEluc3RhbmNlLnByb3RvdHlwZSwge1xuICAgICAgICBfZHVtcFN0cmluZzogZnVuY3Rpb24gKHJldmVyc2VSZWxhdGlvbnNoaXBzKSB7XG4gICAgICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkodGhpcy5fZHVtcChyZXZlcnNlUmVsYXRpb25zaGlwcywgbnVsbCwgNCkpO1xuICAgICAgICB9LFxuICAgICAgICBfZHVtcDogZnVuY3Rpb24gKHJldmVyc2VSZWxhdGlvbnNoaXBzKSB7XG4gICAgICAgICAgICB2YXIgZHVtcGVkID0gXy5leHRlbmQoe30sIHRoaXMuX192YWx1ZXMpO1xuICAgICAgICAgICAgZHVtcGVkLl9yZXYgPSB0aGlzLl9yZXY7XG4gICAgICAgICAgICBkdW1wZWQuX2lkID0gdGhpcy5faWQ7XG4gICAgICAgICAgICByZXR1cm4gZHVtcGVkO1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICBtb2R1bGUuZXhwb3J0cyA9IE1vZGVsSW5zdGFuY2U7XG5cblxufSkoKTsiLCIoZnVuY3Rpb24gKCkge1xuICAgIHZhciBSZWxhdGlvbnNoaXBQcm94eSA9IHJlcXVpcmUoJy4vUmVsYXRpb25zaGlwUHJveHknKSxcbiAgICAgICAgU3RvcmUgPSByZXF1aXJlKCcuL3N0b3JlJyksXG4gICAgICAgIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKSxcbiAgICAgICAgXyA9IHV0aWwuXyxcbiAgICAgICAgSW50ZXJuYWxTaWVzdGFFcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKS5JbnRlcm5hbFNpZXN0YUVycm9yLFxuICAgICAgICBtb2RlbEV2ZW50cyA9IHJlcXVpcmUoJy4vbW9kZWxFdmVudHMnKSxcbiAgICAgICAgZXZlbnRzID0gcmVxdWlyZSgnLi9ldmVudHMnKSxcbiAgICAgICAgd3JhcEFycmF5Rm9yQXR0cmlidXRlcyA9IGV2ZW50cy53cmFwQXJyYXksXG4gICAgICAgIEFycmF5T2JzZXJ2ZXIgPSByZXF1aXJlKCcuLi92ZW5kb3Ivb2JzZXJ2ZS1qcy9zcmMvb2JzZXJ2ZScpLkFycmF5T2JzZXJ2ZXIsXG4gICAgICAgIE1vZGVsRXZlbnRUeXBlID0gcmVxdWlyZSgnLi9tb2RlbEV2ZW50cycpLk1vZGVsRXZlbnRUeXBlO1xuXG4gICAgLyoqXG4gICAgICogQGNsYXNzICBbT25lVG9NYW55UHJveHkgZGVzY3JpcHRpb25dXG4gICAgICogQGNvbnN0cnVjdG9yXG4gICAgICogQHBhcmFtIHtbdHlwZV19IG9wdHNcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBPbmVUb01hbnlQcm94eShvcHRzKSB7XG4gICAgICAgIFJlbGF0aW9uc2hpcFByb3h5LmNhbGwodGhpcywgb3B0cyk7XG4gICAgICAgIGlmICh0aGlzLmlzUmV2ZXJzZSkgdGhpcy5yZWxhdGVkID0gW107XG4gICAgfVxuXG4gICAgT25lVG9NYW55UHJveHkucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShSZWxhdGlvbnNoaXBQcm94eS5wcm90b3R5cGUpO1xuXG4gICAgXy5leHRlbmQoT25lVG9NYW55UHJveHkucHJvdG90eXBlLCB7XG4gICAgICAgIGNsZWFyUmV2ZXJzZTogZnVuY3Rpb24gKHJlbW92ZWQpIHtcbiAgICAgICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgICAgIF8uZWFjaChyZW1vdmVkLCBmdW5jdGlvbiAocmVtb3ZlZE9iamVjdCkge1xuICAgICAgICAgICAgICAgIHZhciByZXZlcnNlUHJveHkgPSBzZWxmLnJldmVyc2VQcm94eUZvckluc3RhbmNlKHJlbW92ZWRPYmplY3QpO1xuICAgICAgICAgICAgICAgIHJldmVyc2VQcm94eS5zZXRJZEFuZFJlbGF0ZWQobnVsbCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSxcbiAgICAgICAgc2V0UmV2ZXJzZU9mQWRkZWQ6IGZ1bmN0aW9uIChhZGRlZCkge1xuICAgICAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICAgICAgXy5lYWNoKGFkZGVkLCBmdW5jdGlvbiAoYWRkZWQpIHtcbiAgICAgICAgICAgICAgICB2YXIgZm9yd2FyZFByb3h5ID0gc2VsZi5yZXZlcnNlUHJveHlGb3JJbnN0YW5jZShhZGRlZCk7XG4gICAgICAgICAgICAgICAgZm9yd2FyZFByb3h5LnNldElkQW5kUmVsYXRlZChzZWxmLm9iamVjdCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSxcbiAgICAgICAgd3JhcEFycmF5OiBmdW5jdGlvbiAoYXJyKSB7XG4gICAgICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgICAgICB3cmFwQXJyYXlGb3JBdHRyaWJ1dGVzKGFyciwgdGhpcy5yZXZlcnNlTmFtZSwgdGhpcy5vYmplY3QpO1xuICAgICAgICAgICAgaWYgKCFhcnIuYXJyYXlPYnNlcnZlcikge1xuICAgICAgICAgICAgICAgIGFyci5hcnJheU9ic2VydmVyID0gbmV3IEFycmF5T2JzZXJ2ZXIoYXJyKTtcbiAgICAgICAgICAgICAgICB2YXIgb2JzZXJ2ZXJGdW5jdGlvbiA9IGZ1bmN0aW9uIChzcGxpY2VzKSB7XG4gICAgICAgICAgICAgICAgICAgIHNwbGljZXMuZm9yRWFjaChmdW5jdGlvbiAoc3BsaWNlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgYWRkZWQgPSBzcGxpY2UuYWRkZWRDb3VudCA/IGFyci5zbGljZShzcGxpY2UuaW5kZXgsIHNwbGljZS5pbmRleCArIHNwbGljZS5hZGRlZENvdW50KSA6IFtdO1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHJlbW92ZWQgPSBzcGxpY2UucmVtb3ZlZDtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYuY2xlYXJSZXZlcnNlKHJlbW92ZWQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgc2VsZi5zZXRSZXZlcnNlT2ZBZGRlZChhZGRlZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgbW9kZWwgPSBzZWxmLmdldEZvcndhcmRNb2RlbCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgbW9kZWxFdmVudHMuZW1pdCh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29sbGVjdGlvbjogbW9kZWwuY29sbGVjdGlvbk5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbW9kZWw6IG1vZGVsLm5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgX2lkOiBzZWxmLm9iamVjdC5faWQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZmllbGQ6IHNlbGYuZ2V0Rm9yd2FyZE5hbWUoKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZW1vdmVkOiByZW1vdmVkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFkZGVkOiBhZGRlZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiBNb2RlbEV2ZW50VHlwZS5TcGxpY2UsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaW5kZXg6IHNwbGljZS5pbmRleCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBvYmo6IHNlbGYub2JqZWN0XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICBhcnIuYXJyYXlPYnNlcnZlci5vcGVuKG9ic2VydmVyRnVuY3Rpb24pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICBnZXQ6IGZ1bmN0aW9uIChjYikge1xuICAgICAgICAgICAgcmV0dXJuIHV0aWwucHJvbWlzZShjYiwgZnVuY3Rpb24gKGNiKSB7XG4gICAgICAgICAgICAgICAgY2IobnVsbCwgdGhpcy5yZWxhdGVkKTtcbiAgICAgICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICAgIH0sXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBWYWxpZGF0ZSB0aGUgb2JqZWN0IHRoYXQgd2UncmUgc2V0dGluZ1xuICAgICAgICAgKiBAcGFyYW0gb2JqXG4gICAgICAgICAqIEByZXR1cm5zIHtzdHJpbmd8bnVsbH0gQW4gZXJyb3IgbWVzc2FnZSBvciBudWxsXG4gICAgICAgICAqIEBjbGFzcyBPbmVUb01hbnlQcm94eVxuICAgICAgICAgKi9cbiAgICAgICAgdmFsaWRhdGU6IGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgICAgIHZhciBzdHIgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwob2JqKTtcbiAgICAgICAgICAgIGlmICh0aGlzLmlzRm9yd2FyZCkge1xuICAgICAgICAgICAgICAgIGlmIChzdHIgPT0gJ1tvYmplY3QgQXJyYXldJykge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gJ0Nhbm5vdCBhc3NpZ24gYXJyYXkgZm9yd2FyZCBvbmVUb01hbnkgKCcgKyBzdHIgKyAnKTogJyArIHRoaXMuZm9yd2FyZE5hbWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgaWYgKHN0ciAhPSAnW29iamVjdCBBcnJheV0nKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiAnQ2Fubm90IHNjYWxhciB0byByZXZlcnNlIG9uZVRvTWFueSAoJyArIHN0ciArICcpOiAnICsgdGhpcy5yZXZlcnNlTmFtZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfSxcbiAgICAgICAgc2V0OiBmdW5jdGlvbiAob2JqLCBvcHRzKSB7XG4gICAgICAgICAgICB0aGlzLmNoZWNrSW5zdGFsbGVkKCk7XG4gICAgICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgICAgICBpZiAob2JqKSB7XG4gICAgICAgICAgICAgICAgdmFyIGVycm9yTWVzc2FnZTtcbiAgICAgICAgICAgICAgICBpZiAoZXJyb3JNZXNzYWdlID0gdGhpcy52YWxpZGF0ZShvYmopKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBlcnJvck1lc3NhZ2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmNsZWFyUmV2ZXJzZVJlbGF0ZWQob3B0cyk7XG4gICAgICAgICAgICAgICAgICAgIHNlbGYuc2V0SWRBbmRSZWxhdGVkKG9iaiwgb3B0cyk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChzZWxmLmlzUmV2ZXJzZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy53cmFwQXJyYXkoc2VsZi5yZWxhdGVkKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBzZWxmLnNldElkQW5kUmVsYXRlZFJldmVyc2Uob2JqLCBvcHRzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLmNsZWFyUmV2ZXJzZVJlbGF0ZWQob3B0cyk7XG4gICAgICAgICAgICAgICAgc2VsZi5zZXRJZEFuZFJlbGF0ZWQob2JqLCBvcHRzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgaW5zdGFsbDogZnVuY3Rpb24gKG9iaikge1xuICAgICAgICAgICAgUmVsYXRpb25zaGlwUHJveHkucHJvdG90eXBlLmluc3RhbGwuY2FsbCh0aGlzLCBvYmopO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5pc1JldmVyc2UpIHtcbiAgICAgICAgICAgICAgICBvYmpbKCdzcGxpY2UnICsgdXRpbC5jYXBpdGFsaXNlRmlyc3RMZXR0ZXIodGhpcy5yZXZlcnNlTmFtZSkpXSA9IF8uYmluZCh0aGlzLnNwbGljZSwgdGhpcyk7XG4gICAgICAgICAgICAgICAgdGhpcy53cmFwQXJyYXkodGhpcy5yZWxhdGVkKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICB9XG4gICAgfSk7XG5cblxuICAgIG1vZHVsZS5leHBvcnRzID0gT25lVG9NYW55UHJveHk7XG59KSgpOyIsIihmdW5jdGlvbiAoKSB7XG4gICAgdmFyIFJlbGF0aW9uc2hpcFByb3h5ID0gcmVxdWlyZSgnLi9SZWxhdGlvbnNoaXBQcm94eScpLFxuICAgICAgICB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyksXG4gICAgICAgIF8gPSB1dGlsLl8sXG4gICAgICAgIFNpZXN0YU1vZGVsID0gcmVxdWlyZSgnLi9Nb2RlbEluc3RhbmNlJyk7XG5cbiAgICAvKipcbiAgICAgKiBbT25lVG9PbmVQcm94eSBkZXNjcmlwdGlvbl1cbiAgICAgKiBAcGFyYW0ge09iamVjdH0gb3B0c1xuICAgICAqL1xuICAgIGZ1bmN0aW9uIE9uZVRvT25lUHJveHkob3B0cykge1xuICAgICAgICBSZWxhdGlvbnNoaXBQcm94eS5jYWxsKHRoaXMsIG9wdHMpO1xuICAgIH1cblxuXG4gICAgT25lVG9PbmVQcm94eS5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKFJlbGF0aW9uc2hpcFByb3h5LnByb3RvdHlwZSk7XG5cbiAgICBfLmV4dGVuZChPbmVUb09uZVByb3h5LnByb3RvdHlwZSwge1xuICAgICAgICAvKipcbiAgICAgICAgICogVmFsaWRhdGUgdGhlIG9iamVjdCB0aGF0IHdlJ3JlIHNldHRpbmdcbiAgICAgICAgICogQHBhcmFtIG9ialxuICAgICAgICAgKiBAcmV0dXJucyB7c3RyaW5nfG51bGx9IEFuIGVycm9yIG1lc3NhZ2Ugb3IgbnVsbFxuICAgICAgICAgKi9cbiAgICAgICAgdmFsaWRhdGU6IGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgICAgIGlmIChPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwob2JqKSA9PSAnW29iamVjdCBBcnJheV0nKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuICdDYW5ub3QgYXNzaWduIGFycmF5IHRvIG9uZSB0byBvbmUgcmVsYXRpb25zaGlwJztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKCghb2JqIGluc3RhbmNlb2YgU2llc3RhTW9kZWwpKSB7XG5cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9LFxuICAgICAgICBzZXQ6IGZ1bmN0aW9uIChvYmosIG9wdHMpIHtcbiAgICAgICAgICAgIHRoaXMuY2hlY2tJbnN0YWxsZWQoKTtcbiAgICAgICAgICAgIGlmIChvYmopIHtcbiAgICAgICAgICAgICAgICB2YXIgZXJyb3JNZXNzYWdlO1xuICAgICAgICAgICAgICAgIGlmIChlcnJvck1lc3NhZ2UgPSB0aGlzLnZhbGlkYXRlKG9iaikpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGVycm9yTWVzc2FnZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY2xlYXJSZXZlcnNlUmVsYXRlZChvcHRzKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zZXRJZEFuZFJlbGF0ZWQob2JqLCBvcHRzKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zZXRJZEFuZFJlbGF0ZWRSZXZlcnNlKG9iaiwgb3B0cyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5jbGVhclJldmVyc2VSZWxhdGVkKG9wdHMpO1xuICAgICAgICAgICAgICAgIHRoaXMuc2V0SWRBbmRSZWxhdGVkKG9iaiwgb3B0cyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIGdldDogZnVuY3Rpb24gKGNiKSB7XG4gICAgICAgICAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbiAoY2IpIHtcbiAgICAgICAgICAgICAgICBjYihudWxsLCB0aGlzLnJlbGF0ZWQpO1xuICAgICAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgICAgfVxuICAgIH0pO1xuXG5cbiAgICBtb2R1bGUuZXhwb3J0cyA9IE9uZVRvT25lUHJveHk7XG59KSgpOyIsIihmdW5jdGlvbiAoKSB7XG4gICAgdmFyIGxvZyA9IHJlcXVpcmUoJy4vbG9nJykoJ3F1ZXJ5JyksXG4gICAgICAgIGNhY2hlID0gcmVxdWlyZSgnLi9jYWNoZScpLFxuICAgICAgICB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyksXG4gICAgICAgIGVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpLFxuICAgICAgICBjb25zdHJ1Y3RRdWVyeVNldCA9IHJlcXVpcmUoJy4vUXVlcnlTZXQnKSxcbiAgICAgICAgXyA9IHV0aWwuXztcblxuICAgIC8qKlxuICAgICAqIEBjbGFzcyBbUXVlcnkgZGVzY3JpcHRpb25dXG4gICAgICogQHBhcmFtIHtNb2RlbH0gbW9kZWxcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gcXVlcnlcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBRdWVyeShtb2RlbCwgcXVlcnkpIHtcbiAgICAgICAgdmFyIG9wdHMgPSB7fTtcbiAgICAgICAgZm9yICh2YXIgcHJvcCBpbiBxdWVyeSkge1xuICAgICAgICAgICAgaWYgKHF1ZXJ5Lmhhc093blByb3BlcnR5KHByb3ApKSB7XG4gICAgICAgICAgICAgICAgaWYgKHByb3Auc2xpY2UoMCwgMikgPT0gJ19fJykge1xuICAgICAgICAgICAgICAgICAgICBvcHRzW3Byb3Auc2xpY2UoMildID0gcXVlcnlbcHJvcF07XG4gICAgICAgICAgICAgICAgICAgIGRlbGV0ZSBxdWVyeVtwcm9wXTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgXy5leHRlbmQodGhpcywge1xuICAgICAgICAgICAgbW9kZWw6IG1vZGVsLFxuICAgICAgICAgICAgcXVlcnk6IHF1ZXJ5LFxuICAgICAgICAgICAgb3B0czogb3B0c1xuICAgICAgICB9KTtcbiAgICAgICAgb3B0cy5vcmRlciA9IG9wdHMub3JkZXIgfHwgW107XG4gICAgICAgIGlmICghdXRpbC5pc0FycmF5KG9wdHMub3JkZXIpKSBvcHRzLm9yZGVyID0gW29wdHMub3JkZXJdO1xuICAgIH1cblxuICAgIHZhciBjb21wYXJhdG9ycyA9IHtcbiAgICAgICAgZTogZnVuY3Rpb24gKG9wdHMpIHtcbiAgICAgICAgICAgIHZhciBvYmplY3RWYWx1ZSA9IG9wdHMub2JqZWN0W29wdHMuZmllbGRdO1xuICAgICAgICAgICAgaWYgKGxvZy5lbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgdmFyIHN0cmluZ1ZhbHVlO1xuICAgICAgICAgICAgICAgIGlmIChvYmplY3RWYWx1ZSA9PT0gbnVsbCkgc3RyaW5nVmFsdWUgPSAnbnVsbCc7XG4gICAgICAgICAgICAgICAgZWxzZSBpZiAob2JqZWN0VmFsdWUgPT09IHVuZGVmaW5lZCkgc3RyaW5nVmFsdWUgPSAndW5kZWZpbmVkJztcbiAgICAgICAgICAgICAgICBlbHNlIHN0cmluZ1ZhbHVlID0gb2JqZWN0VmFsdWUudG9TdHJpbmcoKTtcbiAgICAgICAgICAgICAgICBsb2cob3B0cy5maWVsZCArICc6ICcgKyBzdHJpbmdWYWx1ZSArICcgPT0gJyArIG9wdHMudmFsdWUudG9TdHJpbmcoKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gb2JqZWN0VmFsdWUgPT0gb3B0cy52YWx1ZTtcbiAgICAgICAgfSxcbiAgICAgICAgbHQ6IGZ1bmN0aW9uIChvcHRzKSB7XG4gICAgICAgICAgICBpZiAoIW9wdHMuaW52YWxpZCkgcmV0dXJuIG9wdHMub2JqZWN0W29wdHMuZmllbGRdIDwgb3B0cy52YWx1ZTtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfSxcbiAgICAgICAgZ3Q6IGZ1bmN0aW9uIChvcHRzKSB7XG4gICAgICAgICAgICBpZiAoIW9wdHMuaW52YWxpZCkgcmV0dXJuIG9wdHMub2JqZWN0W29wdHMuZmllbGRdID4gb3B0cy52YWx1ZTtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfSxcbiAgICAgICAgbHRlOiBmdW5jdGlvbiAob3B0cykge1xuICAgICAgICAgICAgaWYgKCFvcHRzLmludmFsaWQpIHJldHVybiBvcHRzLm9iamVjdFtvcHRzLmZpZWxkXSA8PSBvcHRzLnZhbHVlO1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9LFxuICAgICAgICBndGU6IGZ1bmN0aW9uIChvcHRzKSB7XG4gICAgICAgICAgICBpZiAoIW9wdHMuaW52YWxpZCkgcmV0dXJuIG9wdHMub2JqZWN0W29wdHMuZmllbGRdID49IG9wdHMudmFsdWU7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH0sXG4gICAgICAgIGNvbnRhaW5zOiBmdW5jdGlvbiAob3B0cykge1xuICAgICAgICAgICAgaWYgKCFvcHRzLmludmFsaWQpIHtcbiAgICAgICAgICAgICAgICB2YXIgYXJyID0gb3B0cy5vYmplY3Rbb3B0cy5maWVsZF07XG4gICAgICAgICAgICAgICAgaWYgKHV0aWwuaXNBcnJheShhcnIpIHx8IHV0aWwuaXNTdHJpbmcoYXJyKSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gYXJyLmluZGV4T2Yob3B0cy52YWx1ZSkgPiAtMTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgXy5leHRlbmQoUXVlcnksIHtcbiAgICAgICAgY29tcGFyYXRvcnM6IGNvbXBhcmF0b3JzLFxuICAgICAgICByZWdpc3RlckNvbXBhcmF0b3I6IGZ1bmN0aW9uIChzeW1ib2wsIGZuKSB7XG4gICAgICAgICAgICBpZiAoIWNvbXBhcmF0b3JzW3N5bWJvbF0pIHtcbiAgICAgICAgICAgICAgICBjb21wYXJhdG9yc1tzeW1ib2xdID0gZm47XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIGZ1bmN0aW9uIGNhY2hlRm9yTW9kZWwobW9kZWwpIHtcbiAgICAgICAgdmFyIGNhY2hlQnlUeXBlID0gY2FjaGUuX2xvY2FsQ2FjaGVCeVR5cGU7XG4gICAgICAgIHZhciBtb2RlbE5hbWUgPSBtb2RlbC5uYW1lO1xuICAgICAgICB2YXIgY29sbGVjdGlvbk5hbWUgPSBtb2RlbC5jb2xsZWN0aW9uTmFtZTtcbiAgICAgICAgdmFyIGNhY2hlQnlNb2RlbCA9IGNhY2hlQnlUeXBlW2NvbGxlY3Rpb25OYW1lXTtcbiAgICAgICAgdmFyIGNhY2hlQnlMb2NhbElkO1xuICAgICAgICBpZiAoY2FjaGVCeU1vZGVsKSB7XG4gICAgICAgICAgICBjYWNoZUJ5TG9jYWxJZCA9IGNhY2hlQnlNb2RlbFttb2RlbE5hbWVdIHx8IHt9O1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBjYWNoZUJ5TG9jYWxJZDtcbiAgICB9XG5cbiAgICBfLmV4dGVuZChRdWVyeS5wcm90b3R5cGUsIHtcbiAgICAgICAgZXhlY3V0ZTogZnVuY3Rpb24gKGNiKSB7XG4gICAgICAgICAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbiAoY2IpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9leGVjdXRlSW5NZW1vcnkoY2IpO1xuICAgICAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgICAgfSxcbiAgICAgICAgX2R1bXA6IGZ1bmN0aW9uIChhc0pzb24pIHtcbiAgICAgICAgICAgIHJldHVybiBhc0pzb24gPyAne30nIDoge307XG4gICAgICAgIH0sXG4gICAgICAgIHNvcnRGdW5jOiBmdW5jdGlvbiAoZmllbGRzKSB7XG4gICAgICAgICAgICB2YXIgc29ydEZ1bmMgPSBmdW5jdGlvbiAoYXNjZW5kaW5nLCBmaWVsZCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbiAodjEsIHYyKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBkMSA9IHYxW2ZpZWxkXSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGQyID0gdjJbZmllbGRdLFxuICAgICAgICAgICAgICAgICAgICAgICAgcmVzO1xuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGQxID09ICdzdHJpbmcnIHx8IGQxIGluc3RhbmNlb2YgU3RyaW5nICYmXG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlb2YgZDIgPT0gJ3N0cmluZycgfHwgZDIgaW5zdGFuY2VvZiBTdHJpbmcpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlcyA9IGFzY2VuZGluZyA/IGQxLmxvY2FsZUNvbXBhcmUoZDIpIDogZDIubG9jYWxlQ29tcGFyZShkMSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZDEgaW5zdGFuY2VvZiBEYXRlKSBkMSA9IGQxLmdldFRpbWUoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChkMiBpbnN0YW5jZW9mIERhdGUpIGQyID0gZDIuZ2V0VGltZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGFzY2VuZGluZykgcmVzID0gZDEgLSBkMjtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsc2UgcmVzID0gZDIgLSBkMTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gcmVzO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICB2YXIgcyA9IHV0aWw7XG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGZpZWxkcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIHZhciBmaWVsZCA9IGZpZWxkc1tpXTtcbiAgICAgICAgICAgICAgICBzID0gcy50aGVuQnkoc29ydEZ1bmMoZmllbGQuYXNjZW5kaW5nLCBmaWVsZC5maWVsZCkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHMgPT0gdXRpbCA/IG51bGwgOiBzO1xuICAgICAgICB9LFxuICAgICAgICBfc29ydFJlc3VsdHM6IGZ1bmN0aW9uIChyZXMpIHtcbiAgICAgICAgICAgIHZhciBvcmRlciA9IHRoaXMub3B0cy5vcmRlcjtcbiAgICAgICAgICAgIGlmIChyZXMgJiYgb3JkZXIpIHtcbiAgICAgICAgICAgICAgICB2YXIgZmllbGRzID0gXy5tYXAob3JkZXIsIGZ1bmN0aW9uIChvcmRlcmluZykge1xuICAgICAgICAgICAgICAgICAgICB2YXIgc3BsdCA9IG9yZGVyaW5nLnNwbGl0KCctJyksXG4gICAgICAgICAgICAgICAgICAgICAgICBhc2NlbmRpbmcgPSB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgZmllbGQgPSBudWxsO1xuICAgICAgICAgICAgICAgICAgICBpZiAoc3BsdC5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBmaWVsZCA9IHNwbHRbMV07XG4gICAgICAgICAgICAgICAgICAgICAgICBhc2NlbmRpbmcgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZpZWxkID0gc3BsdFswXTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4ge2ZpZWxkOiBmaWVsZCwgYXNjZW5kaW5nOiBhc2NlbmRpbmd9O1xuICAgICAgICAgICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICAgICAgICAgICAgdmFyIHNvcnRGdW5jID0gdGhpcy5zb3J0RnVuYyhmaWVsZHMpO1xuICAgICAgICAgICAgICAgIGlmIChyZXMuaW1tdXRhYmxlKSByZXMgPSByZXMubXV0YWJsZUNvcHkoKTtcbiAgICAgICAgICAgICAgICBpZiAoc29ydEZ1bmMpIHJlcy5zb3J0KHNvcnRGdW5jKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiByZXM7XG4gICAgICAgIH0sXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBSZXR1cm4gYWxsIG1vZGVsIGluc3RhbmNlcyBpbiB0aGUgY2FjaGUuXG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICBfZ2V0Q2FjaGVCeUxvY2FsSWQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiBfLnJlZHVjZSh0aGlzLm1vZGVsLmRlc2NlbmRhbnRzLCBmdW5jdGlvbiAobWVtbywgY2hpbGRNb2RlbCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBfLmV4dGVuZChtZW1vLCBjYWNoZUZvck1vZGVsKGNoaWxkTW9kZWwpKTtcbiAgICAgICAgICAgIH0sIF8uZXh0ZW5kKHt9LCBjYWNoZUZvck1vZGVsKHRoaXMubW9kZWwpKSk7XG4gICAgICAgIH0sXG4gICAgICAgIF9leGVjdXRlSW5NZW1vcnk6IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgICAgICAgICAgdmFyIF9leGVjdXRlSW5NZW1vcnkgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgdmFyIGNhY2hlQnlMb2NhbElkID0gdGhpcy5fZ2V0Q2FjaGVCeUxvY2FsSWQoKTtcbiAgICAgICAgICAgICAgICB2YXIga2V5cyA9IE9iamVjdC5rZXlzKGNhY2hlQnlMb2NhbElkKTtcbiAgICAgICAgICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgICAgICAgICAgdmFyIHJlcyA9IFtdO1xuICAgICAgICAgICAgICAgIHZhciBlcnI7XG4gICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBrZXlzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBrID0ga2V5c1tpXTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIG9iaiA9IGNhY2hlQnlMb2NhbElkW2tdO1xuICAgICAgICAgICAgICAgICAgICB2YXIgbWF0Y2hlcyA9IHNlbGYub2JqZWN0TWF0Y2hlc1F1ZXJ5KG9iaik7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YobWF0Y2hlcykgPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVyciA9IGVycm9yKG1hdGNoZXMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobWF0Y2hlcykgcmVzLnB1c2gob2JqKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXMgPSB0aGlzLl9zb3J0UmVzdWx0cyhyZXMpO1xuICAgICAgICAgICAgICAgIGlmIChlcnIpIGxvZygnRXJyb3IgZXhlY3V0aW5nIHF1ZXJ5JywgZXJyKTtcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIsIGVyciA/IG51bGwgOiBjb25zdHJ1Y3RRdWVyeVNldChyZXMsIHRoaXMubW9kZWwpKTtcbiAgICAgICAgICAgIH0uYmluZCh0aGlzKTtcbiAgICAgICAgICAgIGlmICh0aGlzLm9wdHMuaWdub3JlSW5zdGFsbGVkKSB7XG4gICAgICAgICAgICAgICAgX2V4ZWN1dGVJbk1lbW9yeSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgc2llc3RhLl9hZnRlckluc3RhbGwoX2V4ZWN1dGVJbk1lbW9yeSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfSxcbiAgICAgICAgY2xlYXJPcmRlcmluZzogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdGhpcy5vcHRzLm9yZGVyID0gbnVsbDtcbiAgICAgICAgfSxcbiAgICAgICAgb2JqZWN0TWF0Y2hlc09yUXVlcnk6IGZ1bmN0aW9uIChvYmosIG9yUXVlcnkpIHtcbiAgICAgICAgICAgIGZvciAodmFyIGlkeCBpbiBvclF1ZXJ5KSB7XG4gICAgICAgICAgICAgICAgaWYgKG9yUXVlcnkuaGFzT3duUHJvcGVydHkoaWR4KSkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgcXVlcnkgPSBvclF1ZXJ5W2lkeF07XG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLm9iamVjdE1hdGNoZXNCYXNlUXVlcnkob2JqLCBxdWVyeSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9LFxuICAgICAgICBvYmplY3RNYXRjaGVzQW5kUXVlcnk6IGZ1bmN0aW9uIChvYmosIGFuZFF1ZXJ5KSB7XG4gICAgICAgICAgICBmb3IgKHZhciBpZHggaW4gYW5kUXVlcnkpIHtcbiAgICAgICAgICAgICAgICBpZiAoYW5kUXVlcnkuaGFzT3duUHJvcGVydHkoaWR4KSkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgcXVlcnkgPSBhbmRRdWVyeVtpZHhdO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIXRoaXMub2JqZWN0TWF0Y2hlc0Jhc2VRdWVyeShvYmosIHF1ZXJ5KSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH0sXG4gICAgICAgIHNwbGl0TWF0Y2hlczogZnVuY3Rpb24gKG9iaiwgdW5wcm9jZXNzZWRGaWVsZCwgdmFsdWUpIHtcbiAgICAgICAgICAgIHZhciBvcCA9ICdlJztcbiAgICAgICAgICAgIHZhciBmaWVsZHMgPSB1bnByb2Nlc3NlZEZpZWxkLnNwbGl0KCcuJyk7XG4gICAgICAgICAgICB2YXIgc3BsdCA9IGZpZWxkc1tmaWVsZHMubGVuZ3RoIC0gMV0uc3BsaXQoJ19fJyk7XG4gICAgICAgICAgICBpZiAoc3BsdC5sZW5ndGggPT0gMikge1xuICAgICAgICAgICAgICAgIHZhciBmaWVsZCA9IHNwbHRbMF07XG4gICAgICAgICAgICAgICAgb3AgPSBzcGx0WzFdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgZmllbGQgPSBzcGx0WzBdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZmllbGRzW2ZpZWxkcy5sZW5ndGggLSAxXSA9IGZpZWxkO1xuICAgICAgICAgICAgXy5lYWNoKGZpZWxkcy5zbGljZSgwLCBmaWVsZHMubGVuZ3RoIC0gMSksIGZ1bmN0aW9uIChmKSB7XG4gICAgICAgICAgICAgICAgb2JqID0gb2JqW2ZdO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAvLyBJZiB3ZSBnZXQgdG8gdGhlIHBvaW50IHdoZXJlIHdlJ3JlIGFib3V0IHRvIGluZGV4IG51bGwgb3IgdW5kZWZpbmVkIHdlIHN0b3AgLSBvYnZpb3VzbHkgdGhpcyBvYmplY3QgZG9lc1xuICAgICAgICAgICAgLy8gbm90IG1hdGNoIHRoZSBxdWVyeS5cbiAgICAgICAgICAgIHZhciBub3ROdWxsT3JVbmRlZmluZWQgPSBvYmogIT0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgaWYgKG5vdE51bGxPclVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIHZhciB2YWwgPSBvYmpbZmllbGRdOyAvLyBCcmVha3MgaGVyZS5cbiAgICAgICAgICAgICAgICB2YXIgaW52YWxpZCA9IHZhbCA9PT0gbnVsbCB8fCB2YWwgPT09IHVuZGVmaW5lZDtcbiAgICAgICAgICAgICAgICB2YXIgY29tcGFyYXRvciA9IFF1ZXJ5LmNvbXBhcmF0b3JzW29wXSxcbiAgICAgICAgICAgICAgICAgICAgb3B0cyA9IHtvYmplY3Q6IG9iaiwgZmllbGQ6IGZpZWxkLCB2YWx1ZTogdmFsdWUsIGludmFsaWQ6IGludmFsaWR9O1xuICAgICAgICAgICAgICAgIGlmICghY29tcGFyYXRvcikge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gJ05vIGNvbXBhcmF0b3IgcmVnaXN0ZXJlZCBmb3IgcXVlcnkgb3BlcmF0aW9uIFwiJyArIG9wICsgJ1wiJztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIGNvbXBhcmF0b3Iob3B0cyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH0sXG4gICAgICAgIG9iamVjdE1hdGNoZXM6IGZ1bmN0aW9uIChvYmosIHVucHJvY2Vzc2VkRmllbGQsIHZhbHVlLCBxdWVyeSkge1xuICAgICAgICAgICAgaWYgKHVucHJvY2Vzc2VkRmllbGQgPT0gJyRvcicpIHtcbiAgICAgICAgICAgICAgICBpZiAoIXRoaXMub2JqZWN0TWF0Y2hlc09yUXVlcnkob2JqLCBxdWVyeVsnJG9yJ10pKSByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmICh1bnByb2Nlc3NlZEZpZWxkID09ICckYW5kJykge1xuICAgICAgICAgICAgICAgIGlmICghdGhpcy5vYmplY3RNYXRjaGVzQW5kUXVlcnkob2JqLCBxdWVyeVsnJGFuZCddKSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgdmFyIG1hdGNoZXMgPSB0aGlzLnNwbGl0TWF0Y2hlcyhvYmosIHVucHJvY2Vzc2VkRmllbGQsIHZhbHVlKTtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIG1hdGNoZXMgIT0gJ2Jvb2xlYW4nKSByZXR1cm4gbWF0Y2hlcztcbiAgICAgICAgICAgICAgICBpZiAoIW1hdGNoZXMpIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9LFxuICAgICAgICBvYmplY3RNYXRjaGVzQmFzZVF1ZXJ5OiBmdW5jdGlvbiAob2JqLCBxdWVyeSkge1xuICAgICAgICAgICAgdmFyIGZpZWxkcyA9IE9iamVjdC5rZXlzKHF1ZXJ5KTtcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgZmllbGRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgdmFyIHVucHJvY2Vzc2VkRmllbGQgPSBmaWVsZHNbaV0sXG4gICAgICAgICAgICAgICAgICAgIHZhbHVlID0gcXVlcnlbdW5wcm9jZXNzZWRGaWVsZF07XG4gICAgICAgICAgICAgICAgdmFyIHJ0ID0gdGhpcy5vYmplY3RNYXRjaGVzKG9iaiwgdW5wcm9jZXNzZWRGaWVsZCwgdmFsdWUsIHF1ZXJ5KTtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIHJ0ICE9ICdib29sZWFuJykgcmV0dXJuIHJ0O1xuICAgICAgICAgICAgICAgIGlmICghcnQpIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9LFxuICAgICAgICBvYmplY3RNYXRjaGVzUXVlcnk6IGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLm9iamVjdE1hdGNoZXNCYXNlUXVlcnkob2JqLCB0aGlzLnF1ZXJ5KTtcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBRdWVyeTtcbn0pKCk7IiwidmFyIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKSxcbiAgICBQcm9taXNlID0gdXRpbC5Qcm9taXNlLFxuICAgIGVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpLFxuICAgIE1vZGVsSW5zdGFuY2UgPSByZXF1aXJlKCcuL01vZGVsSW5zdGFuY2UnKSxcbiAgICBfID0gcmVxdWlyZSgnLi91dGlsJykuXztcblxuLypcbiBUT0RPOiBVc2UgRVM2IFByb3h5IGluc3RlYWQuXG4gRXZlbnR1YWxseSBxdWVyeSBzZXRzIHNob3VsZCB1c2UgRVM2IFByb3hpZXMgd2hpY2ggd2lsbCBiZSBtdWNoIG1vcmUgbmF0dXJhbCBhbmQgcm9idXN0LiBFLmcuIG5vIG5lZWQgZm9yIHRoZSBiZWxvd1xuICovXG52YXIgQVJSQVlfTUVUSE9EUyA9IFsncHVzaCcsICdzb3J0JywgJ3JldmVyc2UnLCAnc3BsaWNlJywgJ3NoaWZ0JywgJ3Vuc2hpZnQnXSxcbiAgICBOVU1CRVJfTUVUSE9EUyA9IFsndG9TdHJpbmcnLCAndG9FeHBvbmVudGlhbCcsICd0b0ZpeGVkJywgJ3RvUHJlY2lzaW9uJywgJ3ZhbHVlT2YnXSxcbiAgICBOVU1CRVJfUFJPUEVSVElFUyA9IFsnTUFYX1ZBTFVFJywgJ01JTl9WQUxVRScsICdORUdBVElWRV9JTkZJTklUWScsICdOYU4nLCAnUE9TSVRJVkVfSU5GSU5JVFknXSxcbiAgICBTVFJJTkdfTUVUSE9EUyA9IFsnY2hhckF0JywgJ2NoYXJDb2RlQXQnLCAnY29uY2F0JywgJ2Zyb21DaGFyQ29kZScsICdpbmRleE9mJywgJ2xhc3RJbmRleE9mJywgJ2xvY2FsZUNvbXBhcmUnLFxuICAgICAgICAnbWF0Y2gnLCAncmVwbGFjZScsICdzZWFyY2gnLCAnc2xpY2UnLCAnc3BsaXQnLCAnc3Vic3RyJywgJ3N1YnN0cmluZycsICd0b0xvY2FsZUxvd2VyQ2FzZScsICd0b0xvY2FsZVVwcGVyQ2FzZScsXG4gICAgICAgICd0b0xvd2VyQ2FzZScsICd0b1N0cmluZycsICd0b1VwcGVyQ2FzZScsICd0cmltJywgJ3ZhbHVlT2YnXSxcbiAgICBTVFJJTkdfUFJPUEVSVElFUyA9IFsnbGVuZ3RoJ107XG5cbi8qKlxuICogUmV0dXJuIHRoZSBwcm9wZXJ0eSBuYW1lcyBmb3IgYSBnaXZlbiBvYmplY3QuIEhhbmRsZXMgc3BlY2lhbCBjYXNlcyBzdWNoIGFzIHN0cmluZ3MgYW5kIG51bWJlcnMgdGhhdCBkbyBub3QgaGF2ZVxuICogdGhlIGdldE93blByb3BlcnR5TmFtZXMgZnVuY3Rpb24uXG4gKiBUaGUgc3BlY2lhbCBjYXNlcyBhcmUgdmVyeSBtdWNoIGhhY2tzLiBUaGlzIGhhY2sgY2FuIGJlIHJlbW92ZWQgb25jZSB0aGUgUHJveHkgb2JqZWN0IGlzIG1vcmUgd2lkZWx5IGFkb3B0ZWQuXG4gKiBAcGFyYW0gb2JqZWN0XG4gKiBAcmV0dXJucyB7QXJyYXl9XG4gKi9cbmZ1bmN0aW9uIGdldFByb3BlcnR5TmFtZXMob2JqZWN0KSB7XG4gICAgdmFyIHByb3BlcnR5TmFtZXM7XG4gICAgaWYgKHR5cGVvZiBvYmplY3QgPT0gJ3N0cmluZycgfHwgb2JqZWN0IGluc3RhbmNlb2YgU3RyaW5nKSB7XG4gICAgICAgIHByb3BlcnR5TmFtZXMgPSBTVFJJTkdfTUVUSE9EUy5jb25jYXQoU1RSSU5HX1BST1BFUlRJRVMpO1xuICAgIH1cbiAgICBlbHNlIGlmICh0eXBlb2Ygb2JqZWN0ID09ICdudW1iZXInIHx8IG9iamVjdCBpbnN0YW5jZW9mIE51bWJlcikge1xuICAgICAgICBwcm9wZXJ0eU5hbWVzID0gTlVNQkVSX01FVEhPRFMuY29uY2F0KE5VTUJFUl9QUk9QRVJUSUVTKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIHByb3BlcnR5TmFtZXMgPSBvYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcygpO1xuICAgIH1cbiAgICByZXR1cm4gcHJvcGVydHlOYW1lcztcbn1cblxuLyoqXG4gKiBEZWZpbmUgYSBwcm94eSBwcm9wZXJ0eSB0byBhdHRyaWJ1dGVzIG9uIG9iamVjdHMgaW4gdGhlIGFycmF5XG4gKiBAcGFyYW0gYXJyXG4gKiBAcGFyYW0gcHJvcFxuICovXG5mdW5jdGlvbiBkZWZpbmVBdHRyaWJ1dGUoYXJyLCBwcm9wKSB7XG4gICAgaWYgKCEocHJvcCBpbiBhcnIpKSB7IC8vIGUuZy4gd2UgY2Fubm90IHJlZGVmaW5lIC5sZW5ndGhcbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KGFyciwgcHJvcCwge1xuICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHF1ZXJ5U2V0KF8ucGx1Y2soYXJyLCBwcm9wKSk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgc2V0OiBmdW5jdGlvbiAodikge1xuICAgICAgICAgICAgICAgIGlmICh1dGlsLmlzQXJyYXkodikpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMubGVuZ3RoICE9IHYubGVuZ3RoKSB0aHJvdyBlcnJvcih7bWVzc2FnZTogJ011c3QgYmUgc2FtZSBsZW5ndGgnfSk7XG4gICAgICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdi5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpc1tpXVtwcm9wXSA9IHZbaV07XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCB0aGlzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzW2ldW3Byb3BdID0gdjtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBpc1Byb21pc2Uob2JqKSB7XG4gICAgLy8gVE9ETzogRG9uJ3QgdGhpbmsgdGhpcyBpcyB2ZXJ5IHJvYnVzdC5cbiAgICByZXR1cm4gb2JqLnRoZW4gJiYgb2JqLmNhdGNoO1xufVxuXG4vKipcbiAqIERlZmluZSBhIHByb3h5IG1ldGhvZCBvbiB0aGUgYXJyYXkgaWYgbm90IGFscmVhZHkgaW4gZXhpc3RlbmNlLlxuICogQHBhcmFtIGFyclxuICogQHBhcmFtIHByb3BcbiAqL1xuZnVuY3Rpb24gZGVmaW5lTWV0aG9kKGFyciwgcHJvcCkge1xuICAgIGlmICghKHByb3AgaW4gYXJyKSkgeyAvLyBlLmcuIHdlIGRvbid0IHdhbnQgdG8gcmVkZWZpbmUgdG9TdHJpbmdcbiAgICAgICAgYXJyW3Byb3BdID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdmFyIGFyZ3MgPSBhcmd1bWVudHMsXG4gICAgICAgICAgICAgICAgcmVzID0gdGhpcy5tYXAoZnVuY3Rpb24gKHApIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHBbcHJvcF0uYXBwbHkocCwgYXJncyk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB2YXIgYXJlUHJvbWlzZXMgPSBmYWxzZTtcbiAgICAgICAgICAgIGlmIChyZXMubGVuZ3RoKSBhcmVQcm9taXNlcyA9IGlzUHJvbWlzZShyZXNbMF0pO1xuICAgICAgICAgICAgcmV0dXJuIGFyZVByb21pc2VzID8gUHJvbWlzZS5hbGwocmVzKSA6IHF1ZXJ5U2V0KHJlcyk7XG4gICAgICAgIH07XG4gICAgfVxufVxuXG4vKipcbiAqIFRyYW5zZm9ybSB0aGUgYXJyYXkgaW50byBhIHF1ZXJ5IHNldC5cbiAqIFJlbmRlcnMgdGhlIGFycmF5IGltbXV0YWJsZS5cbiAqIEBwYXJhbSBhcnJcbiAqIEBwYXJhbSBtb2RlbCAtIFRoZSBtb2RlbCB3aXRoIHdoaWNoIHRvIHByb3h5IHRvXG4gKi9cbmZ1bmN0aW9uIG1vZGVsUXVlcnlTZXQoYXJyLCBtb2RlbCkge1xuICAgIGFyciA9IF8uZXh0ZW5kKFtdLCBhcnIpO1xuICAgIHZhciBhdHRyaWJ1dGVOYW1lcyA9IG1vZGVsLl9hdHRyaWJ1dGVOYW1lcyxcbiAgICAgICAgcmVsYXRpb25zaGlwTmFtZXMgPSBtb2RlbC5fcmVsYXRpb25zaGlwTmFtZXMsXG4gICAgICAgIG5hbWVzID0gYXR0cmlidXRlTmFtZXMuY29uY2F0KHJlbGF0aW9uc2hpcE5hbWVzKS5jb25jYXQoaW5zdGFuY2VNZXRob2RzKTtcbiAgICBuYW1lcy5mb3JFYWNoKF8ucGFydGlhbChkZWZpbmVBdHRyaWJ1dGUsIGFycikpO1xuICAgIHZhciBpbnN0YW5jZU1ldGhvZHMgPSBPYmplY3Qua2V5cyhNb2RlbEluc3RhbmNlLnByb3RvdHlwZSk7XG4gICAgaW5zdGFuY2VNZXRob2RzLmZvckVhY2goXy5wYXJ0aWFsKGRlZmluZU1ldGhvZCwgYXJyKSk7XG4gICAgcmV0dXJuIHJlbmRlckltbXV0YWJsZShhcnIpO1xufVxuXG4vKipcbiAqIFRyYW5zZm9ybSB0aGUgYXJyYXkgaW50byBhIHF1ZXJ5IHNldCwgYmFzZWQgb24gd2hhdGV2ZXIgaXMgaW4gaXQuXG4gKiBOb3RlIHRoYXQgYWxsIG9iamVjdHMgbXVzdCBiZSBvZiB0aGUgc2FtZSB0eXBlLiBUaGlzIGZ1bmN0aW9uIHdpbGwgdGFrZSB0aGUgZmlyc3Qgb2JqZWN0IGFuZCBkZWNpZGUgaG93IHRvIHByb3h5XG4gKiBiYXNlZCBvbiB0aGF0LlxuICogQHBhcmFtIGFyclxuICovXG5mdW5jdGlvbiBxdWVyeVNldChhcnIpIHtcbiAgICBpZiAoYXJyLmxlbmd0aCkge1xuICAgICAgICB2YXIgcmVmZXJlbmNlT2JqZWN0ID0gYXJyWzBdLFxuICAgICAgICAgICAgcHJvcGVydHlOYW1lcyA9IGdldFByb3BlcnR5TmFtZXMocmVmZXJlbmNlT2JqZWN0KTtcbiAgICAgICAgcHJvcGVydHlOYW1lcy5mb3JFYWNoKGZ1bmN0aW9uIChwcm9wKSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIHJlZmVyZW5jZU9iamVjdFtwcm9wXSA9PSAnZnVuY3Rpb24nKSBkZWZpbmVNZXRob2QoYXJyLCBwcm9wLCBhcmd1bWVudHMpO1xuICAgICAgICAgICAgZWxzZSBkZWZpbmVBdHRyaWJ1dGUoYXJyLCBwcm9wKTtcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIHJldHVybiByZW5kZXJJbW11dGFibGUoYXJyKTtcbn1cblxuZnVuY3Rpb24gdGhyb3dJbW11dGFibGVFcnJvcigpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0Nhbm5vdCBtb2RpZnkgYSBxdWVyeSBzZXQnKTtcbn1cblxuLyoqXG4gKiBSZW5kZXIgYW4gYXJyYXkgaW1tdXRhYmxlIGJ5IHJlcGxhY2luZyBhbnkgZnVuY3Rpb25zIHRoYXQgY2FuIG11dGF0ZSBpdC5cbiAqIEBwYXJhbSBhcnJcbiAqL1xuZnVuY3Rpb24gcmVuZGVySW1tdXRhYmxlKGFycikge1xuICAgIEFSUkFZX01FVEhPRFMuZm9yRWFjaChmdW5jdGlvbiAocCkge1xuICAgICAgICBhcnJbcF0gPSB0aHJvd0ltbXV0YWJsZUVycm9yO1xuICAgIH0pO1xuICAgIGFyci5pbW11dGFibGUgPSB0cnVlO1xuICAgIGFyci5tdXRhYmxlQ29weSA9IGFyci5hc0FycmF5ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgbXV0YWJsZUFyciA9IF8ubWFwKHRoaXMsIGZ1bmN0aW9uICh4KSB7cmV0dXJuIHh9KTtcbiAgICAgICAgbXV0YWJsZUFyci5hc1F1ZXJ5U2V0ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIHF1ZXJ5U2V0KHRoaXMpO1xuICAgICAgICB9O1xuICAgICAgICBtdXRhYmxlQXJyLmFzTW9kZWxRdWVyeVNldCA9IGZ1bmN0aW9uIChtb2RlbCkge1xuICAgICAgICAgICAgcmV0dXJuIG1vZGVsUXVlcnlTZXQodGhpcywgbW9kZWwpO1xuICAgICAgICB9O1xuICAgICAgICByZXR1cm4gbXV0YWJsZUFycjtcbiAgICB9O1xuICAgIHJldHVybiBhcnI7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gbW9kZWxRdWVyeVNldDsiLCIvKipcbiAqIEZvciB0aG9zZSBmYW1pbGlhciB3aXRoIEFwcGxlJ3MgQ29jb2EgbGlicmFyeSwgcmVhY3RpdmUgcXVlcmllcyByb3VnaGx5IG1hcCBvbnRvIE5TRmV0Y2hlZFJlc3VsdHNDb250cm9sbGVyLlxuICpcbiAqIFRoZXkgcHJlc2VudCBhIHF1ZXJ5IHNldCB0aGF0ICdyZWFjdHMnIHRvIGNoYW5nZXMgaW4gdGhlIHVuZGVybHlpbmcgZGF0YS5cbiAqIEBtb2R1bGUgcmVhY3RpdmVRdWVyeVxuICovXG5cblxuKGZ1bmN0aW9uICgpIHtcblxuICAgIHZhciBsb2cgPSByZXF1aXJlKCcuL2xvZycpKCdxdWVyeScpLFxuICAgICAgICBRdWVyeSA9IHJlcXVpcmUoJy4vUXVlcnknKSxcbiAgICAgICAgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnZXZlbnRzJykuRXZlbnRFbWl0dGVyLFxuICAgICAgICBldmVudHMgPSByZXF1aXJlKCcuL2V2ZW50cycpLFxuICAgICAgICBtb2RlbEV2ZW50cyA9IHJlcXVpcmUoJy4vbW9kZWxFdmVudHMnKSxcbiAgICAgICAgSW50ZXJuYWxTaWVzdGFFcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKS5JbnRlcm5hbFNpZXN0YUVycm9yLFxuICAgICAgICBjb25zdHJ1Y3RRdWVyeVNldCA9IHJlcXVpcmUoJy4vUXVlcnlTZXQnKSxcbiAgICAgICAgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpLFxuICAgICAgICBfID0gdXRpbC5fO1xuXG4gICAgLyoqXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1F1ZXJ5fSBxdWVyeSAtIFRoZSB1bmRlcmx5aW5nIHF1ZXJ5XG4gICAgICogQGNvbnN0cnVjdG9yXG4gICAgICovXG4gICAgZnVuY3Rpb24gUmVhY3RpdmVRdWVyeShxdWVyeSkge1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgIEV2ZW50RW1pdHRlci5jYWxsKHRoaXMpO1xuXG4gICAgICAgIF8uZXh0ZW5kKHRoaXMsIHtcbiAgICAgICAgICAgIF9xdWVyeTogcXVlcnksXG4gICAgICAgICAgICByZXN1bHRzOiBjb25zdHJ1Y3RRdWVyeVNldChbXSwgcXVlcnkubW9kZWwpLFxuICAgICAgICAgICAgaW5zZXJ0aW9uUG9saWN5OiBSZWFjdGl2ZVF1ZXJ5Lkluc2VydGlvblBvbGljeS5CYWNrLFxuICAgICAgICAgICAgaW5pdGlhbGlzZWQ6IGZhbHNlXG4gICAgICAgIH0pO1xuXG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKHRoaXMsIHtcbiAgICAgICAgICAgIGluaXRpYWxpemVkOiB7XG4gICAgICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmluaXRpYWxpc2VkXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIG1vZGVsOiB7XG4gICAgICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBzZWxmLl9xdWVyeS5tb2RlbFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBjb2xsZWN0aW9uOiB7XG4gICAgICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBzZWxmLm1vZGVsLmNvbGxlY3Rpb25OYW1lXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBSZWFjdGl2ZVF1ZXJ5LnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoRXZlbnRFbWl0dGVyLnByb3RvdHlwZSk7XG5cbiAgICBfLmV4dGVuZChSZWFjdGl2ZVF1ZXJ5LCB7XG4gICAgICAgIEluc2VydGlvblBvbGljeToge1xuICAgICAgICAgICAgRnJvbnQ6ICdGcm9udCcsXG4gICAgICAgICAgICBCYWNrOiAnQmFjaydcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgXy5leHRlbmQoUmVhY3RpdmVRdWVyeS5wcm90b3R5cGUsIHtcbiAgICAgICAgLyoqXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSBjYlxuICAgICAgICAgKiBAcGFyYW0ge2Jvb2x9IF9pZ25vcmVJbml0IC0gZXhlY3V0ZSBxdWVyeSBhZ2FpbiwgaW5pdGlhbGlzZWQgb3Igbm90LlxuICAgICAgICAgKiBAcmV0dXJucyB7Kn1cbiAgICAgICAgICovXG4gICAgICAgIGluaXQ6IGZ1bmN0aW9uIChjYiwgX2lnbm9yZUluaXQpIHtcbiAgICAgICAgICAgIGlmIChsb2cpIGxvZygnaW5pdCcpO1xuICAgICAgICAgICAgcmV0dXJuIHV0aWwucHJvbWlzZShjYiwgZnVuY3Rpb24gKGNiKSB7XG4gICAgICAgICAgICAgICAgaWYgKCghdGhpcy5pbml0aWFsaXNlZCkgfHwgX2lnbm9yZUluaXQpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fcXVlcnkuZXhlY3V0ZShmdW5jdGlvbiAoZXJyLCByZXN1bHRzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucmVzdWx0cyA9IHJlc3VsdHM7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCF0aGlzLmhhbmRsZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG5hbWUgPSB0aGlzLl9jb25zdHJ1Y3ROb3RpZmljYXRpb25OYW1lKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBoYW5kbGVyID0gZnVuY3Rpb24gKG4pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2hhbmRsZU5vdGlmKG4pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LmJpbmQodGhpcyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuaGFuZGxlciA9IGhhbmRsZXI7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50cy5vbihuYW1lLCBoYW5kbGVyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGxvZykgbG9nKCdMaXN0ZW5pbmcgdG8gJyArIG5hbWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuaW5pdGlhbGlzZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNiKG51bGwsIHRoaXMucmVzdWx0cyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYihlcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgY2IobnVsbCwgdGhpcy5yZXN1bHRzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICB9LFxuICAgICAgICBpbnNlcnQ6IGZ1bmN0aW9uIChuZXdPYmopIHtcbiAgICAgICAgICAgIHZhciByZXN1bHRzID0gdGhpcy5yZXN1bHRzLm11dGFibGVDb3B5KCk7XG4gICAgICAgICAgICBpZiAodGhpcy5pbnNlcnRpb25Qb2xpY3kgPT0gUmVhY3RpdmVRdWVyeS5JbnNlcnRpb25Qb2xpY3kuQmFjaykge1xuICAgICAgICAgICAgICAgIHZhciBpZHggPSByZXN1bHRzLnB1c2gobmV3T2JqKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGlkeCA9IHJlc3VsdHMudW5zaGlmdChuZXdPYmopO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5yZXN1bHRzID0gcmVzdWx0cy5hc01vZGVsUXVlcnlTZXQodGhpcy5tb2RlbCk7XG4gICAgICAgICAgICByZXR1cm4gaWR4O1xuICAgICAgICB9LFxuICAgICAgICAvKipcbiAgICAgICAgICogRXhlY3V0ZSB0aGUgdW5kZXJseWluZyBxdWVyeSBhZ2Fpbi5cbiAgICAgICAgICogQHBhcmFtIGNiXG4gICAgICAgICAqL1xuICAgICAgICB1cGRhdGU6IGZ1bmN0aW9uIChjYikge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuaW5pdChjYiwgdHJ1ZSlcbiAgICAgICAgfSxcbiAgICAgICAgX2hhbmRsZU5vdGlmOiBmdW5jdGlvbiAobikge1xuICAgICAgICAgICAgbG9nKCdfaGFuZGxlTm90aWYnLCBuKTtcbiAgICAgICAgICAgIGlmIChuLnR5cGUgPT0gbW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUuTmV3KSB7XG4gICAgICAgICAgICAgICAgdmFyIG5ld09iaiA9IG4ubmV3O1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLl9xdWVyeS5vYmplY3RNYXRjaGVzUXVlcnkobmV3T2JqKSkge1xuICAgICAgICAgICAgICAgICAgICBsb2coJ05ldyBvYmplY3QgbWF0Y2hlcycsIG5ld09iai5fZHVtcFN0cmluZygpKTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGlkeCA9IHRoaXMuaW5zZXJ0KG5ld09iaik7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZW1pdCgnY2hhbmdlJywge1xuICAgICAgICAgICAgICAgICAgICAgICAgaW5kZXg6IGlkeCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGFkZGVkOiBbbmV3T2JqXSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6IG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlLlNwbGljZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIG9iajogdGhpc1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZygnTmV3IG9iamVjdCBkb2VzIG5vdCBtYXRjaCcsIG5ld09iai5fZHVtcFN0cmluZygpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChuLnR5cGUgPT0gbW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUuU2V0KSB7XG4gICAgICAgICAgICAgICAgbmV3T2JqID0gbi5vYmo7XG4gICAgICAgICAgICAgICAgdmFyIGluZGV4ID0gdGhpcy5yZXN1bHRzLmluZGV4T2YobmV3T2JqKSxcbiAgICAgICAgICAgICAgICAgICAgYWxyZWFkeUNvbnRhaW5zID0gaW5kZXggPiAtMSxcbiAgICAgICAgICAgICAgICAgICAgbWF0Y2hlcyA9IHRoaXMuX3F1ZXJ5Lm9iamVjdE1hdGNoZXNRdWVyeShuZXdPYmopO1xuICAgICAgICAgICAgICAgIGlmIChtYXRjaGVzICYmICFhbHJlYWR5Q29udGFpbnMpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nKCdVcGRhdGVkIG9iamVjdCBub3cgbWF0Y2hlcyEnLCBuZXdPYmouX2R1bXBTdHJpbmcoKSk7XG4gICAgICAgICAgICAgICAgICAgIGlkeCA9IHRoaXMuaW5zZXJ0KG5ld09iaik7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZW1pdCgnY2hhbmdlJywge1xuICAgICAgICAgICAgICAgICAgICAgICAgaW5kZXg6IGlkeCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGFkZGVkOiBbbmV3T2JqXSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6IG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlLlNwbGljZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIG9iajogdGhpc1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSBpZiAoIW1hdGNoZXMgJiYgYWxyZWFkeUNvbnRhaW5zKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZygnVXBkYXRlZCBvYmplY3Qgbm8gbG9uZ2VyIG1hdGNoZXMhJywgbmV3T2JqLl9kdW1wU3RyaW5nKCkpO1xuICAgICAgICAgICAgICAgICAgICByZXN1bHRzID0gdGhpcy5yZXN1bHRzLm11dGFibGVDb3B5KCk7XG4gICAgICAgICAgICAgICAgICAgIHZhciByZW1vdmVkID0gcmVzdWx0cy5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnJlc3VsdHMgPSByZXN1bHRzLmFzTW9kZWxRdWVyeVNldCh0aGlzLm1vZGVsKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5lbWl0KCdjaGFuZ2UnLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpbmRleDogaW5kZXgsXG4gICAgICAgICAgICAgICAgICAgICAgICBvYmo6IHRoaXMsXG4gICAgICAgICAgICAgICAgICAgICAgICBuZXc6IG5ld09iaixcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6IG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlLlNwbGljZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlbW92ZWQ6IHJlbW92ZWRcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2UgaWYgKCFtYXRjaGVzICYmICFhbHJlYWR5Q29udGFpbnMpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nKCdEb2VzIG5vdCBjb250YWluLCBidXQgZG9lc250IG1hdGNoIHNvIG5vdCBpbnNlcnRpbmcnLCBuZXdPYmouX2R1bXBTdHJpbmcoKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2UgaWYgKG1hdGNoZXMgJiYgYWxyZWFkeUNvbnRhaW5zKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZygnTWF0Y2hlcyBidXQgYWxyZWFkeSBjb250YWlucycsIG5ld09iai5fZHVtcFN0cmluZygpKTtcbiAgICAgICAgICAgICAgICAgICAgLy8gU2VuZCB0aGUgbm90aWZpY2F0aW9uIG92ZXIuXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZW1pdCgnY2hhbmdlJywgbik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAobi50eXBlID09IG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlLlJlbW92ZSkge1xuICAgICAgICAgICAgICAgIG5ld09iaiA9IG4ub2JqO1xuICAgICAgICAgICAgICAgIHZhciByZXN1bHRzID0gdGhpcy5yZXN1bHRzLm11dGFibGVDb3B5KCk7XG4gICAgICAgICAgICAgICAgaW5kZXggPSByZXN1bHRzLmluZGV4T2YobmV3T2JqKTtcbiAgICAgICAgICAgICAgICBpZiAoaW5kZXggPiAtMSkge1xuICAgICAgICAgICAgICAgICAgICBsb2coJ1JlbW92aW5nIG9iamVjdCcsIG5ld09iai5fZHVtcFN0cmluZygpKTtcbiAgICAgICAgICAgICAgICAgICAgcmVtb3ZlZCA9IHJlc3VsdHMuc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5yZXN1bHRzID0gY29uc3RydWN0UXVlcnlTZXQocmVzdWx0cywgdGhpcy5tb2RlbCk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZW1pdCgnY2hhbmdlJywge1xuICAgICAgICAgICAgICAgICAgICAgICAgaW5kZXg6IGluZGV4LFxuICAgICAgICAgICAgICAgICAgICAgICAgb2JqOiB0aGlzLFxuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogbW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUuU3BsaWNlLFxuICAgICAgICAgICAgICAgICAgICAgICAgcmVtb3ZlZDogcmVtb3ZlZFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZygnTm8gbW9kZWxFdmVudHMgbmVjY2Vzc2FyeS4nLCBuZXdPYmouX2R1bXBTdHJpbmcoKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ1Vua25vd24gY2hhbmdlIHR5cGUgXCInICsgbi50eXBlLnRvU3RyaW5nKCkgKyAnXCInKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5yZXN1bHRzID0gY29uc3RydWN0UXVlcnlTZXQodGhpcy5fcXVlcnkuX3NvcnRSZXN1bHRzKHRoaXMucmVzdWx0cyksIHRoaXMubW9kZWwpO1xuICAgICAgICB9LFxuICAgICAgICBfY29uc3RydWN0Tm90aWZpY2F0aW9uTmFtZTogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMubW9kZWwuY29sbGVjdGlvbk5hbWUgKyAnOicgKyB0aGlzLm1vZGVsLm5hbWU7XG4gICAgICAgIH0sXG4gICAgICAgIHRlcm1pbmF0ZTogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgaWYgKHRoaXMuaGFuZGxlcikge1xuICAgICAgICAgICAgICAgIGV2ZW50cy5yZW1vdmVMaXN0ZW5lcih0aGlzLl9jb25zdHJ1Y3ROb3RpZmljYXRpb25OYW1lKCksIHRoaXMuaGFuZGxlcik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLnJlc3VsdHMgPSBudWxsO1xuICAgICAgICAgICAgdGhpcy5oYW5kbGVyID0gbnVsbDtcbiAgICAgICAgfSxcbiAgICAgICAgbGlzdGVuOiBmdW5jdGlvbiAoZm4pIHtcbiAgICAgICAgICAgIHRoaXMub24oJ2NoYW5nZScsIGZuKTtcbiAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5yZW1vdmVMaXN0ZW5lcignY2hhbmdlJywgZm4pO1xuICAgICAgICAgICAgfS5iaW5kKHRoaXMpO1xuICAgICAgICB9LFxuICAgICAgICBsaXN0ZW5PbmNlOiBmdW5jdGlvbiAoZm4pIHtcbiAgICAgICAgICAgIHRoaXMub25jZSgnY2hhbmdlJywgZm4pO1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICBtb2R1bGUuZXhwb3J0cyA9IFJlYWN0aXZlUXVlcnk7XG59KSgpOyIsIi8qKlxuICogQmFzZSBmdW5jdGlvbmFsaXR5IGZvciByZWxhdGlvbnNoaXBzLlxuICogQG1vZHVsZSByZWxhdGlvbnNoaXBzXG4gKi9cbihmdW5jdGlvbiAoKSB7XG4gICAgdmFyIEludGVybmFsU2llc3RhRXJyb3IgPSByZXF1aXJlKCcuL2Vycm9yJykuSW50ZXJuYWxTaWVzdGFFcnJvcixcbiAgICAgICAgU3RvcmUgPSByZXF1aXJlKCcuL3N0b3JlJyksXG4gICAgICAgIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKSxcbiAgICAgICAgXyA9IHV0aWwuXyxcbiAgICAgICAgUXVlcnkgPSByZXF1aXJlKCcuL1F1ZXJ5JyksXG4gICAgICAgIGxvZyA9IHJlcXVpcmUoJy4vbG9nJyksXG4gICAgICAgIGNhY2hlID0gcmVxdWlyZSgnLi9jYWNoZScpLFxuICAgICAgICBldmVudHMgPSByZXF1aXJlKCcuL2V2ZW50cycpLFxuICAgICAgICB3cmFwQXJyYXlGb3JBdHRyaWJ1dGVzID0gZXZlbnRzLndyYXBBcnJheSxcbiAgICAgICAgQXJyYXlPYnNlcnZlciA9IHJlcXVpcmUoJy4uL3ZlbmRvci9vYnNlcnZlLWpzL3NyYy9vYnNlcnZlJykuQXJyYXlPYnNlcnZlcixcbiAgICAgICAgbW9kZWxFdmVudHMgPSByZXF1aXJlKCcuL21vZGVsRXZlbnRzJyksXG4gICAgICAgIE1vZGVsRXZlbnRUeXBlID0gbW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGU7XG5cbiAgICAvKipcbiAgICAgKiBAY2xhc3MgIFtSZWxhdGlvbnNoaXBQcm94eSBkZXNjcmlwdGlvbl1cbiAgICAgKiBAcGFyYW0ge09iamVjdH0gb3B0c1xuICAgICAqIEBjb25zdHJ1Y3RvclxuICAgICAqL1xuICAgIGZ1bmN0aW9uIFJlbGF0aW9uc2hpcFByb3h5KG9wdHMpIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICBvcHRzID0gb3B0cyB8fCB7fTtcblxuICAgICAgICBfLmV4dGVuZCh0aGlzLCB7XG4gICAgICAgICAgICBvYmplY3Q6IG51bGwsXG4gICAgICAgICAgICByZWxhdGVkOiBudWxsXG4gICAgICAgIH0pO1xuXG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKHRoaXMsIHtcbiAgICAgICAgICAgIGlzRm9yd2FyZDoge1xuICAgICAgICAgICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gIXNlbGYuaXNSZXZlcnNlO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgc2V0OiBmdW5jdGlvbiAodikge1xuICAgICAgICAgICAgICAgICAgICBzZWxmLmlzUmV2ZXJzZSA9ICF2O1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICB1dGlsLmV4dGVuZEZyb21PcHRzKHRoaXMsIG9wdHMsIHtcbiAgICAgICAgICAgIHJldmVyc2VNb2RlbDogbnVsbCxcbiAgICAgICAgICAgIGZvcndhcmRNb2RlbDogbnVsbCxcbiAgICAgICAgICAgIGZvcndhcmROYW1lOiBudWxsLFxuICAgICAgICAgICAgcmV2ZXJzZU5hbWU6IG51bGwsXG4gICAgICAgICAgICBpc1JldmVyc2U6IG51bGxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGhpcy5jYW5jZWxMaXN0ZW5zID0ge307XG4gICAgfVxuXG4gICAgXy5leHRlbmQoUmVsYXRpb25zaGlwUHJveHksIHt9KTtcblxuICAgIF8uZXh0ZW5kKFJlbGF0aW9uc2hpcFByb3h5LnByb3RvdHlwZSwge1xuICAgICAgICAvKipcbiAgICAgICAgICogSW5zdGFsbCB0aGlzIHByb3h5IG9uIHRoZSBnaXZlbiBpbnN0YW5jZVxuICAgICAgICAgKiBAcGFyYW0ge01vZGVsSW5zdGFuY2V9IG1vZGVsSW5zdGFuY2VcbiAgICAgICAgICovXG4gICAgICAgIGluc3RhbGw6IGZ1bmN0aW9uIChtb2RlbEluc3RhbmNlKSB7XG4gICAgICAgICAgICBpZiAobW9kZWxJbnN0YW5jZSkge1xuICAgICAgICAgICAgICAgIGlmICghdGhpcy5vYmplY3QpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5vYmplY3QgPSBtb2RlbEluc3RhbmNlO1xuICAgICAgICAgICAgICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgICAgICAgICAgICAgIHZhciBuYW1lID0gdGhpcy5nZXRGb3J3YXJkTmFtZSgpO1xuICAgICAgICAgICAgICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkobW9kZWxJbnN0YW5jZSwgbmFtZSwge1xuICAgICAgICAgICAgICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHNlbGYucmVsYXRlZDtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICBzZXQ6IGZ1bmN0aW9uICh2KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc2VsZi5zZXQodik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZVxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFtb2RlbEluc3RhbmNlLl9fcHJveGllcykgbW9kZWxJbnN0YW5jZS5fX3Byb3hpZXMgPSB7fTtcbiAgICAgICAgICAgICAgICAgICAgbW9kZWxJbnN0YW5jZS5fX3Byb3hpZXNbbmFtZV0gPSB0aGlzO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIW1vZGVsSW5zdGFuY2UuX3Byb3hpZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG1vZGVsSW5zdGFuY2UuX3Byb3hpZXMgPSBbXTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBtb2RlbEluc3RhbmNlLl9wcm94aWVzLnB1c2godGhpcyk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ0FscmVhZHkgaW5zdGFsbGVkLicpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ05vIG9iamVjdCBwYXNzZWQgdG8gcmVsYXRpb25zaGlwIGluc3RhbGwnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgfSk7XG5cbiAgICAvL25vaW5zcGVjdGlvbiBKU1VudXNlZExvY2FsU3ltYm9sc1xuICAgIF8uZXh0ZW5kKFJlbGF0aW9uc2hpcFByb3h5LnByb3RvdHlwZSwge1xuICAgICAgICBzZXQ6IGZ1bmN0aW9uIChvYmosIG9wdHMpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdNdXN0IHN1YmNsYXNzIFJlbGF0aW9uc2hpcFByb3h5Jyk7XG4gICAgICAgIH0sXG4gICAgICAgIGdldDogZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignTXVzdCBzdWJjbGFzcyBSZWxhdGlvbnNoaXBQcm94eScpO1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICBfLmV4dGVuZChSZWxhdGlvbnNoaXBQcm94eS5wcm90b3R5cGUsIHtcbiAgICAgICAgcHJveHlGb3JJbnN0YW5jZTogZnVuY3Rpb24gKG1vZGVsSW5zdGFuY2UsIHJldmVyc2UpIHtcbiAgICAgICAgICAgIHZhciBuYW1lID0gcmV2ZXJzZSA/IHRoaXMuZ2V0UmV2ZXJzZU5hbWUoKSA6IHRoaXMuZ2V0Rm9yd2FyZE5hbWUoKSxcbiAgICAgICAgICAgICAgICBtb2RlbCA9IHJldmVyc2UgPyB0aGlzLnJldmVyc2VNb2RlbCA6IHRoaXMuZm9yd2FyZE1vZGVsO1xuICAgICAgICAgICAgdmFyIHJldDtcbiAgICAgICAgICAgIC8vIFRoaXMgc2hvdWxkIG5ldmVyIGhhcHBlbi4gU2hvdWxkIGcgICBldCBjYXVnaHQgaW4gdGhlIG1hcHBpbmcgb3BlcmF0aW9uP1xuICAgICAgICAgICAgaWYgKHV0aWwuaXNBcnJheShtb2RlbEluc3RhbmNlKSkge1xuICAgICAgICAgICAgICAgIHJldCA9IF8ubWFwKG1vZGVsSW5zdGFuY2UsIGZ1bmN0aW9uIChvKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBvLl9fcHJveGllc1tuYW1lXTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdmFyIHByb3h5ID0gbW9kZWxJbnN0YW5jZS5fX3Byb3hpZXNbbmFtZV07XG4gICAgICAgICAgICAgICAgaWYgKCFwcm94eSkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgZXJyID0gJ05vIHByb3h5IHdpdGggbmFtZSBcIicgKyBuYW1lICsgJ1wiIG9uIG1hcHBpbmcgJyArIG1vZGVsLm5hbWU7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKGVycik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldCA9IHByb3h5O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHJldDtcbiAgICAgICAgfSxcbiAgICAgICAgcmV2ZXJzZVByb3h5Rm9ySW5zdGFuY2U6IGZ1bmN0aW9uIChtb2RlbEluc3RhbmNlKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5wcm94eUZvckluc3RhbmNlKG1vZGVsSW5zdGFuY2UsIHRydWUpO1xuICAgICAgICB9LFxuICAgICAgICBnZXRSZXZlcnNlTmFtZTogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuaXNGb3J3YXJkID8gdGhpcy5yZXZlcnNlTmFtZSA6IHRoaXMuZm9yd2FyZE5hbWU7XG4gICAgICAgIH0sXG4gICAgICAgIGdldEZvcndhcmROYW1lOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5pc0ZvcndhcmQgPyB0aGlzLmZvcndhcmROYW1lIDogdGhpcy5yZXZlcnNlTmFtZTtcbiAgICAgICAgfSxcbiAgICAgICAgZ2V0Rm9yd2FyZE1vZGVsOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5pc0ZvcndhcmQgPyB0aGlzLmZvcndhcmRNb2RlbCA6IHRoaXMucmV2ZXJzZU1vZGVsO1xuICAgICAgICB9LFxuICAgICAgICBjbGVhclJlbW92YWxMaXN0ZW5lcjogZnVuY3Rpb24gKG9iaikge1xuICAgICAgICAgICAgdmFyIF9pZCA9IG9iai5faWQ7XG4gICAgICAgICAgICB2YXIgY2FuY2VsTGlzdGVuID0gdGhpcy5jYW5jZWxMaXN0ZW5zW19pZF07XG4gICAgICAgICAgICAvLyBUT0RPOiBSZW1vdmUgdGhpcyBjaGVjay4gY2FuY2VsTGlzdGVuIHNob3VsZCBhbHdheXMgZXhpc3RcbiAgICAgICAgICAgIGlmIChjYW5jZWxMaXN0ZW4pIHtcbiAgICAgICAgICAgICAgICBjYW5jZWxMaXN0ZW4oKTtcbiAgICAgICAgICAgICAgICB0aGlzLmNhbmNlbExpc3RlbnNbX2lkXSA9IG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIGxpc3RlbkZvclJlbW92YWw6IGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgICAgIHRoaXMuY2FuY2VsTGlzdGVuc1tvYmouX2lkXSA9IG9iai5saXN0ZW4oZnVuY3Rpb24gKGUpIHtcbiAgICAgICAgICAgICAgICBpZiAoZS50eXBlID09IE1vZGVsRXZlbnRUeXBlLlJlbW92ZSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAodXRpbC5pc0FycmF5KHRoaXMucmVsYXRlZCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBpZHggPSB0aGlzLnJlbGF0ZWQuaW5kZXhPZihvYmopO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zcGxpY2UoaWR4LCAxKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc2V0SWRBbmRSZWxhdGVkKG51bGwpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY2xlYXJSZW1vdmFsTGlzdGVuZXIob2JqKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICB9LFxuICAgICAgICAvKipcbiAgICAgICAgICogQ29uZmlndXJlIF9pZCBhbmQgcmVsYXRlZCB3aXRoIHRoZSBuZXcgcmVsYXRlZCBvYmplY3QuXG4gICAgICAgICAqIEBwYXJhbSBvYmpcbiAgICAgICAgICogQHBhcmFtIHtvYmplY3R9IFtvcHRzXVxuICAgICAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRzLmRpc2FibGVOb3RpZmljYXRpb25zXVxuICAgICAgICAgKiBAcmV0dXJucyB7U3RyaW5nfHVuZGVmaW5lZH0gLSBFcnJvciBtZXNzYWdlIG9yIHVuZGVmaW5lZFxuICAgICAgICAgKi9cbiAgICAgICAgc2V0SWRBbmRSZWxhdGVkOiBmdW5jdGlvbiAob2JqLCBvcHRzKSB7XG4gICAgICAgICAgICBvcHRzID0gb3B0cyB8fCB7fTtcbiAgICAgICAgICAgIGlmICghb3B0cy5kaXNhYmxlZXZlbnRzKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5yZWdpc3RlclNldENoYW5nZShvYmopO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdmFyIHByZXZpb3VzbHlSZWxhdGVkID0gdGhpcy5yZWxhdGVkO1xuICAgICAgICAgICAgaWYgKHByZXZpb3VzbHlSZWxhdGVkKSB0aGlzLmNsZWFyUmVtb3ZhbExpc3RlbmVyKHByZXZpb3VzbHlSZWxhdGVkKTtcbiAgICAgICAgICAgIGlmIChvYmopIHtcbiAgICAgICAgICAgICAgICBpZiAodXRpbC5pc0FycmF5KG9iaikpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5yZWxhdGVkID0gb2JqO1xuICAgICAgICAgICAgICAgICAgICBvYmouZm9yRWFjaChmdW5jdGlvbiAoX29iaikge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5saXN0ZW5Gb3JSZW1vdmFsKF9vYmopO1xuICAgICAgICAgICAgICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMucmVsYXRlZCA9IG9iajtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5saXN0ZW5Gb3JSZW1vdmFsKG9iaik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5yZWxhdGVkID0gbnVsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgY2hlY2tJbnN0YWxsZWQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5vYmplY3QpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignUHJveHkgbXVzdCBiZSBpbnN0YWxsZWQgb24gYW4gb2JqZWN0IGJlZm9yZSBjYW4gdXNlIGl0LicpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICBzcGxpY2VyOiBmdW5jdGlvbiAob3B0cykge1xuICAgICAgICAgICAgb3B0cyA9IG9wdHMgfHwge307XG4gICAgICAgICAgICByZXR1cm4gZnVuY3Rpb24gKGlkeCwgbnVtUmVtb3ZlKSB7XG4gICAgICAgICAgICAgICAgb3B0cyA9IG9wdHMgfHwge307XG4gICAgICAgICAgICAgICAgaWYgKCFvcHRzLmRpc2FibGVldmVudHMpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5yZWdpc3RlclNwbGljZUNoYW5nZS5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB2YXIgYWRkID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAyKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gXy5wYXJ0aWFsKHRoaXMucmVsYXRlZC5zcGxpY2UsIGlkeCwgbnVtUmVtb3ZlKS5hcHBseSh0aGlzLnJlbGF0ZWQsIGFkZCk7XG4gICAgICAgICAgICB9LmJpbmQodGhpcyk7XG4gICAgICAgIH0sXG4gICAgICAgIGNsZWFyUmV2ZXJzZVJlbGF0ZWQ6IGZ1bmN0aW9uIChvcHRzKSB7XG4gICAgICAgICAgICBvcHRzID0gb3B0cyB8fCB7fTtcbiAgICAgICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgICAgIGlmICh0aGlzLnJlbGF0ZWQpIHtcbiAgICAgICAgICAgICAgICB2YXIgcmV2ZXJzZVByb3h5ID0gdGhpcy5yZXZlcnNlUHJveHlGb3JJbnN0YW5jZSh0aGlzLnJlbGF0ZWQpO1xuICAgICAgICAgICAgICAgIHZhciByZXZlcnNlUHJveGllcyA9IHV0aWwuaXNBcnJheShyZXZlcnNlUHJveHkpID8gcmV2ZXJzZVByb3h5IDogW3JldmVyc2VQcm94eV07XG4gICAgICAgICAgICAgICAgXy5lYWNoKHJldmVyc2VQcm94aWVzLCBmdW5jdGlvbiAocCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAodXRpbC5pc0FycmF5KHAucmVsYXRlZCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBpZHggPSBwLnJlbGF0ZWQuaW5kZXhPZihzZWxmLm9iamVjdCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBwLm1ha2VDaGFuZ2VzVG9SZWxhdGVkV2l0aG91dE9ic2VydmF0aW9ucyhmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcC5zcGxpY2VyKG9wdHMpKGlkeCwgMSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHAuc2V0SWRBbmRSZWxhdGVkKG51bGwsIG9wdHMpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHNldElkQW5kUmVsYXRlZFJldmVyc2U6IGZ1bmN0aW9uIChvYmosIG9wdHMpIHtcbiAgICAgICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgICAgIHZhciByZXZlcnNlUHJveHkgPSB0aGlzLnJldmVyc2VQcm94eUZvckluc3RhbmNlKG9iaik7XG4gICAgICAgICAgICB2YXIgcmV2ZXJzZVByb3hpZXMgPSB1dGlsLmlzQXJyYXkocmV2ZXJzZVByb3h5KSA/IHJldmVyc2VQcm94eSA6IFtyZXZlcnNlUHJveHldO1xuICAgICAgICAgICAgXy5lYWNoKHJldmVyc2VQcm94aWVzLCBmdW5jdGlvbiAocCkge1xuICAgICAgICAgICAgICAgIGlmICh1dGlsLmlzQXJyYXkocC5yZWxhdGVkKSkge1xuICAgICAgICAgICAgICAgICAgICBwLm1ha2VDaGFuZ2VzVG9SZWxhdGVkV2l0aG91dE9ic2VydmF0aW9ucyhmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwLnNwbGljZXIob3B0cykocC5yZWxhdGVkLmxlbmd0aCwgMCwgc2VsZi5vYmplY3QpO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBwLmNsZWFyUmV2ZXJzZVJlbGF0ZWQob3B0cyk7XG4gICAgICAgICAgICAgICAgICAgIHAuc2V0SWRBbmRSZWxhdGVkKHNlbGYub2JqZWN0LCBvcHRzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSxcbiAgICAgICAgbWFrZUNoYW5nZXNUb1JlbGF0ZWRXaXRob3V0T2JzZXJ2YXRpb25zOiBmdW5jdGlvbiAoZikge1xuICAgICAgICAgICAgaWYgKHRoaXMucmVsYXRlZCkge1xuICAgICAgICAgICAgICAgIHRoaXMucmVsYXRlZC5hcnJheU9ic2VydmVyLmNsb3NlKCk7XG4gICAgICAgICAgICAgICAgdGhpcy5yZWxhdGVkLmFycmF5T2JzZXJ2ZXIgPSBudWxsO1xuICAgICAgICAgICAgICAgIGYoKTtcbiAgICAgICAgICAgICAgICB0aGlzLndyYXBBcnJheSh0aGlzLnJlbGF0ZWQpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBmKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHJlZ2lzdGVyU2V0Q2hhbmdlOiBmdW5jdGlvbiAob2JqKSB7XG4gICAgICAgICAgICB2YXIgcHJveHlPYmplY3QgPSB0aGlzLm9iamVjdDtcbiAgICAgICAgICAgIGlmICghcHJveHlPYmplY3QpIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdQcm94eSBtdXN0IGhhdmUgYW4gb2JqZWN0IGFzc29jaWF0ZWQnKTtcbiAgICAgICAgICAgIHZhciBtb2RlbCA9IHByb3h5T2JqZWN0Lm1vZGVsLm5hbWU7XG4gICAgICAgICAgICB2YXIgY29sbGVjdGlvbk5hbWUgPSBwcm94eU9iamVjdC5jb2xsZWN0aW9uTmFtZTtcbiAgICAgICAgICAgIC8vIFdlIHRha2UgW10gPT0gbnVsbCA9PSB1bmRlZmluZWQgaW4gdGhlIGNhc2Ugb2YgcmVsYXRpb25zaGlwcy5cbiAgICAgICAgICAgIHZhciBvbGQgPSB0aGlzLnJlbGF0ZWQ7XG4gICAgICAgICAgICBpZiAodXRpbC5pc0FycmF5KG9sZCkgJiYgIW9sZC5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICBvbGQgPSBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbW9kZWxFdmVudHMuZW1pdCh7XG4gICAgICAgICAgICAgICAgY29sbGVjdGlvbjogY29sbGVjdGlvbk5hbWUsXG4gICAgICAgICAgICAgICAgbW9kZWw6IG1vZGVsLFxuICAgICAgICAgICAgICAgIF9pZDogcHJveHlPYmplY3QuX2lkLFxuICAgICAgICAgICAgICAgIGZpZWxkOiB0aGlzLmdldEZvcndhcmROYW1lKCksXG4gICAgICAgICAgICAgICAgb2xkOiBvbGQsXG4gICAgICAgICAgICAgICAgbmV3OiBvYmosXG4gICAgICAgICAgICAgICAgdHlwZTogTW9kZWxFdmVudFR5cGUuU2V0LFxuICAgICAgICAgICAgICAgIG9iajogcHJveHlPYmplY3RcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9LFxuXG4gICAgICAgIHJlZ2lzdGVyU3BsaWNlQ2hhbmdlOiBmdW5jdGlvbiAoaWR4LCBudW1SZW1vdmUpIHtcbiAgICAgICAgICAgIHZhciBhZGQgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDIpO1xuICAgICAgICAgICAgdmFyIG1vZGVsID0gdGhpcy5vYmplY3QubW9kZWwubmFtZTtcbiAgICAgICAgICAgIHZhciBjb2xsID0gdGhpcy5vYmplY3QuY29sbGVjdGlvbk5hbWU7XG4gICAgICAgICAgICBtb2RlbEV2ZW50cy5lbWl0KHtcbiAgICAgICAgICAgICAgICBjb2xsZWN0aW9uOiBjb2xsLFxuICAgICAgICAgICAgICAgIG1vZGVsOiBtb2RlbCxcbiAgICAgICAgICAgICAgICBfaWQ6IHRoaXMub2JqZWN0Ll9pZCxcbiAgICAgICAgICAgICAgICBmaWVsZDogdGhpcy5nZXRGb3J3YXJkTmFtZSgpLFxuICAgICAgICAgICAgICAgIGluZGV4OiBpZHgsXG4gICAgICAgICAgICAgICAgcmVtb3ZlZDogdGhpcy5yZWxhdGVkID8gdGhpcy5yZWxhdGVkLnNsaWNlKGlkeCwgaWR4ICsgbnVtUmVtb3ZlKSA6IG51bGwsXG4gICAgICAgICAgICAgICAgYWRkZWQ6IGFkZC5sZW5ndGggPyBhZGQgOiBbXSxcbiAgICAgICAgICAgICAgICB0eXBlOiBNb2RlbEV2ZW50VHlwZS5TcGxpY2UsXG4gICAgICAgICAgICAgICAgb2JqOiB0aGlzLm9iamVjdFxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0sXG4gICAgICAgIHdyYXBBcnJheTogZnVuY3Rpb24gKGFycikge1xuICAgICAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICAgICAgd3JhcEFycmF5Rm9yQXR0cmlidXRlcyhhcnIsIHRoaXMucmV2ZXJzZU5hbWUsIHRoaXMub2JqZWN0KTtcbiAgICAgICAgICAgIGlmICghYXJyLmFycmF5T2JzZXJ2ZXIpIHtcbiAgICAgICAgICAgICAgICBhcnIuYXJyYXlPYnNlcnZlciA9IG5ldyBBcnJheU9ic2VydmVyKGFycik7XG4gICAgICAgICAgICAgICAgdmFyIG9ic2VydmVyRnVuY3Rpb24gPSBmdW5jdGlvbiAoc3BsaWNlcykge1xuICAgICAgICAgICAgICAgICAgICBzcGxpY2VzLmZvckVhY2goZnVuY3Rpb24gKHNwbGljZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGFkZGVkID0gc3BsaWNlLmFkZGVkQ291bnQgPyBhcnIuc2xpY2Uoc3BsaWNlLmluZGV4LCBzcGxpY2UuaW5kZXggKyBzcGxpY2UuYWRkZWRDb3VudCkgOiBbXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBtb2RlbCA9IHNlbGYuZ2V0Rm9yd2FyZE1vZGVsKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBtb2RlbEV2ZW50cy5lbWl0KHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb2xsZWN0aW9uOiBtb2RlbC5jb2xsZWN0aW9uTmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtb2RlbDogbW9kZWwubmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBfaWQ6IHNlbGYub2JqZWN0Ll9pZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmaWVsZDogc2VsZi5nZXRGb3J3YXJkTmFtZSgpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlbW92ZWQ6IHNwbGljZS5yZW1vdmVkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFkZGVkOiBhZGRlZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiBNb2RlbEV2ZW50VHlwZS5TcGxpY2UsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb2JqOiBzZWxmLm9iamVjdFxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgYXJyLmFycmF5T2JzZXJ2ZXIub3BlbihvYnNlcnZlckZ1bmN0aW9uKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgc3BsaWNlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB0aGlzLnNwbGljZXIoe30pLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgICAgIH1cblxuICAgIH0pO1xuXG5cbiAgICBtb2R1bGUuZXhwb3J0cyA9IFJlbGF0aW9uc2hpcFByb3h5O1xuXG5cbn0pKCk7IiwiKGZ1bmN0aW9uICgpIHtcbiAgICBtb2R1bGUuZXhwb3J0cyA9IHtcbiAgICAgICAgT25lVG9NYW55OiAnT25lVG9NYW55JyxcbiAgICAgICAgT25lVG9PbmU6ICdPbmVUb09uZScsXG4gICAgICAgIE1hbnlUb01hbnk6ICdNYW55VG9NYW55J1xuICAgIH07XG59KSgpOyIsIi8qKlxuICogVGhpcyBpcyBhbiBpbi1tZW1vcnkgY2FjaGUgZm9yIG1vZGVscy4gTW9kZWxzIGFyZSBjYWNoZWQgYnkgbG9jYWwgaWQgKF9pZCkgYW5kIHJlbW90ZSBpZCAoZGVmaW5lZCBieSB0aGUgbWFwcGluZykuXG4gKiBMb29rdXBzIGFyZSBwZXJmb3JtZWQgYWdhaW5zdCB0aGUgY2FjaGUgd2hlbiBtYXBwaW5nLlxuICogQG1vZHVsZSBjYWNoZVxuICovXG4oZnVuY3Rpb24gKCkge1xuXG4gICAgdmFyIGxvZyA9IHJlcXVpcmUoJy4vbG9nJykoJ2NhY2hlJyksXG4gICAgICAgIEludGVybmFsU2llc3RhRXJyb3IgPSByZXF1aXJlKCcuL2Vycm9yJykuSW50ZXJuYWxTaWVzdGFFcnJvcixcbiAgICAgICAgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpO1xuXG5cbiAgICB2YXIgbG9jYWxDYWNoZUJ5SWQgPSB7fSxcbiAgICAgICAgbG9jYWxDYWNoZSA9IHt9LFxuICAgICAgICByZW1vdGVDYWNoZSA9IHt9O1xuXG4gICAgLyoqXG4gICAgICogQ2xlYXIgb3V0IHRoZSBjYWNoZS5cbiAgICAgKi9cbiAgICBmdW5jdGlvbiByZXNldCgpIHtcbiAgICAgICAgcmVtb3RlQ2FjaGUgPSB7fTtcbiAgICAgICAgbG9jYWxDYWNoZUJ5SWQgPSB7fTtcbiAgICAgICAgbG9jYWxDYWNoZSA9IHt9O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybiB0aGUgb2JqZWN0IGluIHRoZSBjYWNoZSBnaXZlbiBhIGxvY2FsIGlkIChfaWQpXG4gICAgICogQHBhcmFtICB7U3RyaW5nfSBsb2NhbElkXG4gICAgICogQHJldHVybiB7TW9kZWxJbnN0YW5jZX1cbiAgICAgKi9cbiAgICBmdW5jdGlvbiBnZXRWaWFMb2NhbElkKGxvY2FsSWQpIHtcbiAgICAgICAgdmFyIG9iaiA9IGxvY2FsQ2FjaGVCeUlkW2xvY2FsSWRdO1xuICAgICAgICBpZiAob2JqKSB7XG4gICAgICAgICAgICBsb2coJ0xvY2FsIGNhY2hlIGhpdDogJyArIG9iai5fZHVtcCh0cnVlKSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBsb2coJ0xvY2FsIGNhY2hlIG1pc3M6ICcgKyBsb2NhbElkKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gb2JqO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybiB0aGUgc2luZ2xldG9uIG9iamVjdCBnaXZlbiBhIHNpbmdsZXRvbiBtb2RlbC5cbiAgICAgKiBAcGFyYW0gIHtNb2RlbH0gbW9kZWxcbiAgICAgKiBAcmV0dXJuIHtNb2RlbEluc3RhbmNlfVxuICAgICAqL1xuICAgIGZ1bmN0aW9uIGdldFNpbmdsZXRvbihtb2RlbCkge1xuICAgICAgICB2YXIgbW9kZWxOYW1lID0gbW9kZWwubmFtZTtcbiAgICAgICAgdmFyIGNvbGxlY3Rpb25OYW1lID0gbW9kZWwuY29sbGVjdGlvbk5hbWU7XG4gICAgICAgIHZhciBjb2xsZWN0aW9uQ2FjaGUgPSBsb2NhbENhY2hlW2NvbGxlY3Rpb25OYW1lXTtcbiAgICAgICAgaWYgKGNvbGxlY3Rpb25DYWNoZSkge1xuICAgICAgICAgICAgdmFyIHR5cGVDYWNoZSA9IGNvbGxlY3Rpb25DYWNoZVttb2RlbE5hbWVdO1xuICAgICAgICAgICAgaWYgKHR5cGVDYWNoZSkge1xuICAgICAgICAgICAgICAgIHZhciBvYmpzID0gW107XG4gICAgICAgICAgICAgICAgZm9yICh2YXIgcHJvcCBpbiB0eXBlQ2FjaGUpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVDYWNoZS5oYXNPd25Qcm9wZXJ0eShwcm9wKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgb2Jqcy5wdXNoKHR5cGVDYWNoZVtwcm9wXSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKG9ianMubGVuZ3RoID4gMSkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgZXJyU3RyID0gJ0Egc2luZ2xldG9uIG1vZGVsIGhhcyBtb3JlIHRoYW4gMSBvYmplY3QgaW4gdGhlIGNhY2hlISBUaGlzIGlzIGEgc2VyaW91cyBlcnJvci4gJyArXG4gICAgICAgICAgICAgICAgICAgICAgICAnRWl0aGVyIGEgbW9kZWwgaGFzIGJlZW4gbW9kaWZpZWQgYWZ0ZXIgb2JqZWN0cyBoYXZlIGFscmVhZHkgYmVlbiBjcmVhdGVkLCBvciBzb21ldGhpbmcgaGFzIGdvbmUnICtcbiAgICAgICAgICAgICAgICAgICAgICAgICd2ZXJ5IHdyb25nLiBQbGVhc2UgZmlsZSBhIGJ1ZyByZXBvcnQgaWYgdGhlIGxhdHRlci4nO1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcihlcnJTdHIpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAob2Jqcy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9ianNbMF07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdpdmVuIGEgcmVtb3RlIGlkZW50aWZpZXIgYW5kIGFuIG9wdGlvbnMgb2JqZWN0IHRoYXQgZGVzY3JpYmVzIG1hcHBpbmcvY29sbGVjdGlvbixcbiAgICAgKiByZXR1cm4gdGhlIG1vZGVsIGlmIGNhY2hlZC5cbiAgICAgKiBAcGFyYW0gIHtTdHJpbmd9IHJlbW90ZUlkXG4gICAgICogQHBhcmFtICB7T2JqZWN0fSBvcHRzXG4gICAgICogQHJldHVybiB7TW9kZWxJbnN0YW5jZX1cbiAgICAgKi9cbiAgICBmdW5jdGlvbiBnZXRWaWFSZW1vdGVJZChyZW1vdGVJZCwgb3B0cykge1xuICAgICAgICB2YXIgdHlwZSA9IG9wdHMubW9kZWwubmFtZTtcbiAgICAgICAgdmFyIGNvbGxlY3Rpb25OYW1lID0gb3B0cy5tb2RlbC5jb2xsZWN0aW9uTmFtZTtcbiAgICAgICAgdmFyIGNvbGxlY3Rpb25DYWNoZSA9IHJlbW90ZUNhY2hlW2NvbGxlY3Rpb25OYW1lXTtcbiAgICAgICAgaWYgKGNvbGxlY3Rpb25DYWNoZSkge1xuICAgICAgICAgICAgdmFyIHR5cGVDYWNoZSA9IHJlbW90ZUNhY2hlW2NvbGxlY3Rpb25OYW1lXVt0eXBlXTtcbiAgICAgICAgICAgIGlmICh0eXBlQ2FjaGUpIHtcbiAgICAgICAgICAgICAgICB2YXIgb2JqID0gdHlwZUNhY2hlW3JlbW90ZUlkXTtcbiAgICAgICAgICAgICAgICBpZiAob2JqKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZygnUmVtb3RlIGNhY2hlIGhpdDogJyArIG9iai5fZHVtcCh0cnVlKSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nKCdSZW1vdGUgY2FjaGUgbWlzczogJyArIHJlbW90ZUlkKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIG9iajtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBsb2coJ1JlbW90ZSBjYWNoZSBtaXNzOiAnICsgcmVtb3RlSWQpO1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJbnNlcnQgYW4gb2JqZXQgaW50byB0aGUgY2FjaGUgdXNpbmcgYSByZW1vdGUgaWRlbnRpZmllciBkZWZpbmVkIGJ5IHRoZSBtYXBwaW5nLlxuICAgICAqIEBwYXJhbSAge01vZGVsSW5zdGFuY2V9IG9ialxuICAgICAqIEBwYXJhbSAge1N0cmluZ30gcmVtb3RlSWRcbiAgICAgKiBAcGFyYW0gIHtTdHJpbmd9IHByZXZpb3VzUmVtb3RlSWQgSWYgcmVtb3RlIGlkIGhhcyBiZWVuIGNoYW5nZWQsIHRoaXMgaXMgdGhlIG9sZCByZW1vdGUgaWRlbnRpZmllclxuICAgICAqL1xuICAgIGZ1bmN0aW9uIHJlbW90ZUluc2VydChvYmosIHJlbW90ZUlkLCBwcmV2aW91c1JlbW90ZUlkKSB7XG4gICAgICAgIGlmIChvYmopIHtcbiAgICAgICAgICAgIHZhciBjb2xsZWN0aW9uTmFtZSA9IG9iai5tb2RlbC5jb2xsZWN0aW9uTmFtZTtcbiAgICAgICAgICAgIGlmIChjb2xsZWN0aW9uTmFtZSkge1xuICAgICAgICAgICAgICAgIGlmICghcmVtb3RlQ2FjaGVbY29sbGVjdGlvbk5hbWVdKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlbW90ZUNhY2hlW2NvbGxlY3Rpb25OYW1lXSA9IHt9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB2YXIgdHlwZSA9IG9iai5tb2RlbC5uYW1lO1xuICAgICAgICAgICAgICAgIGlmICh0eXBlKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghcmVtb3RlQ2FjaGVbY29sbGVjdGlvbk5hbWVdW3R5cGVdKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZW1vdGVDYWNoZVtjb2xsZWN0aW9uTmFtZV1bdHlwZV0gPSB7fTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAocHJldmlvdXNSZW1vdGVJZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVtb3RlQ2FjaGVbY29sbGVjdGlvbk5hbWVdW3R5cGVdW3ByZXZpb3VzUmVtb3RlSWRdID0gbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB2YXIgY2FjaGVkT2JqZWN0ID0gcmVtb3RlQ2FjaGVbY29sbGVjdGlvbk5hbWVdW3R5cGVdW3JlbW90ZUlkXTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFjYWNoZWRPYmplY3QpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlbW90ZUNhY2hlW2NvbGxlY3Rpb25OYW1lXVt0eXBlXVtyZW1vdGVJZF0gPSBvYmo7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2coJ1JlbW90ZSBjYWNoZSBpbnNlcnQ6ICcgKyBvYmouX2R1bXAodHJ1ZSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9nKCdSZW1vdGUgY2FjaGUgbm93IGxvb2tzIGxpa2U6ICcgKyByZW1vdGVEdW1wKHRydWUpKVxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gU29tZXRoaW5nIGhhcyBnb25lIHJlYWxseSB3cm9uZy4gT25seSBvbmUgb2JqZWN0IGZvciBhIHBhcnRpY3VsYXIgY29sbGVjdGlvbi90eXBlL3JlbW90ZWlkIGNvbWJvXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBzaG91bGQgZXZlciBleGlzdC5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChvYmogIT0gY2FjaGVkT2JqZWN0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG1lc3NhZ2UgPSAnT2JqZWN0ICcgKyBjb2xsZWN0aW9uTmFtZS50b1N0cmluZygpICsgJzonICsgdHlwZS50b1N0cmluZygpICsgJ1snICsgb2JqLm1vZGVsLmlkICsgJz1cIicgKyByZW1vdGVJZCArICdcIl0gYWxyZWFkeSBleGlzdHMgaW4gdGhlIGNhY2hlLicgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnIFRoaXMgaXMgYSBzZXJpb3VzIGVycm9yLCBwbGVhc2UgZmlsZSBhIGJ1ZyByZXBvcnQgaWYgeW91IGFyZSBleHBlcmllbmNpbmcgdGhpcyBvdXQgaW4gdGhlIHdpbGQnO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZyhtZXNzYWdlLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9iajogb2JqLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYWNoZWRPYmplY3Q6IGNhY2hlZE9iamVjdFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKG1lc3NhZ2UpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2coJ09iamVjdCBoYXMgYWxyZWFkeSBiZWVuIGluc2VydGVkOiAnICsgb2JqLl9kdW1wKHRydWUpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ01vZGVsIGhhcyBubyB0eXBlJywge1xuICAgICAgICAgICAgICAgICAgICAgICAgbW9kZWw6IG9iai5tb2RlbCxcbiAgICAgICAgICAgICAgICAgICAgICAgIG9iajogb2JqXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ01vZGVsIGhhcyBubyBjb2xsZWN0aW9uJywge1xuICAgICAgICAgICAgICAgICAgICBtb2RlbDogb2JqLm1vZGVsLFxuICAgICAgICAgICAgICAgICAgICBvYmo6IG9ialxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdmFyIG1zZyA9ICdNdXN0IHBhc3MgYW4gb2JqZWN0IHdoZW4gaW5zZXJ0aW5nIHRvIGNhY2hlJztcbiAgICAgICAgICAgIGxvZyhtc2cpO1xuICAgICAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IobXNnKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIER1bXAgdGhlIHJlbW90ZSBpZCBjYWNoZVxuICAgICAqIEBwYXJhbSAge2Jvb2xlYW59IFthc0pzb25dIFdoZXRoZXIgb3Igbm90IHRvIGFwcGx5IEpTT04uc3RyaW5naWZ5XG4gICAgICogQHJldHVybiB7U3RyaW5nfE9iamVjdH1cbiAgICAgKi9cbiAgICBmdW5jdGlvbiByZW1vdGVEdW1wKGFzSnNvbikge1xuICAgICAgICB2YXIgZHVtcGVkUmVzdENhY2hlID0ge307XG4gICAgICAgIGZvciAodmFyIGNvbGwgaW4gcmVtb3RlQ2FjaGUpIHtcbiAgICAgICAgICAgIGlmIChyZW1vdGVDYWNoZS5oYXNPd25Qcm9wZXJ0eShjb2xsKSkge1xuICAgICAgICAgICAgICAgIHZhciBkdW1wZWRDb2xsQ2FjaGUgPSB7fTtcbiAgICAgICAgICAgICAgICBkdW1wZWRSZXN0Q2FjaGVbY29sbF0gPSBkdW1wZWRDb2xsQ2FjaGU7XG4gICAgICAgICAgICAgICAgdmFyIGNvbGxDYWNoZSA9IHJlbW90ZUNhY2hlW2NvbGxdO1xuICAgICAgICAgICAgICAgIGZvciAodmFyIG1vZGVsIGluIGNvbGxDYWNoZSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoY29sbENhY2hlLmhhc093blByb3BlcnR5KG1vZGVsKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGR1bXBlZE1vZGVsQ2FjaGUgPSB7fTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGR1bXBlZENvbGxDYWNoZVttb2RlbF0gPSBkdW1wZWRNb2RlbENhY2hlO1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG1vZGVsQ2FjaGUgPSBjb2xsQ2FjaGVbbW9kZWxdO1xuICAgICAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgcmVtb3RlSWQgaW4gbW9kZWxDYWNoZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChtb2RlbENhY2hlLmhhc093blByb3BlcnR5KHJlbW90ZUlkKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAobW9kZWxDYWNoZVtyZW1vdGVJZF0pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGR1bXBlZE1vZGVsQ2FjaGVbcmVtb3RlSWRdID0gbW9kZWxDYWNoZVtyZW1vdGVJZF0uX2R1bXAoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gYXNKc29uID8gdXRpbC5wcmV0dHlQcmludChkdW1wZWRSZXN0Q2FjaGUsIG51bGwsIDQpIDogZHVtcGVkUmVzdENhY2hlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIER1bXAgdGhlIGxvY2FsIGlkIChfaWQpIGNhY2hlXG4gICAgICogQHBhcmFtICB7Ym9vbGVhbn0gYXNKc29uIFdoZXRoZXIgb3Igbm90IHRvIGFwcGx5IEpTT04uc3RyaW5naWZ5XG4gICAgICogQHJldHVybiB7U3RyaW5nfE9iamVjdH1cbiAgICAgKi9cbiAgICBmdW5jdGlvbiBsb2NhbER1bXAoYXNKc29uKSB7XG4gICAgICAgIHZhciBkdW1wZWRJZENhY2hlID0ge307XG4gICAgICAgIGZvciAodmFyIGlkIGluIGxvY2FsQ2FjaGVCeUlkKSB7XG4gICAgICAgICAgICBpZiAobG9jYWxDYWNoZUJ5SWQuaGFzT3duUHJvcGVydHkoaWQpKSB7XG4gICAgICAgICAgICAgICAgZHVtcGVkSWRDYWNoZVtpZF0gPSBsb2NhbENhY2hlQnlJZFtpZF0uX2R1bXAoKVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBhc0pzb24gPyB1dGlsLnByZXR0eVByaW50KGR1bXBlZElkQ2FjaGUsIG51bGwsIDQpIDogZHVtcGVkSWRDYWNoZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEdW1wIHRvIHRoZSBjYWNoZS5cbiAgICAgKiBAcGFyYW0gIHtib29sZWFufSBhc0pzb24gV2hldGhlciBvciBub3QgdG8gYXBwbHkgSlNPTi5zdHJpbmdpZnlcbiAgICAgKiBAcmV0dXJuIHtTdHJpbmd8T2JqZWN0fVxuICAgICAqL1xuICAgIGZ1bmN0aW9uIGR1bXAoYXNKc29uKSB7XG4gICAgICAgIHZhciBkdW1wZWQgPSB7XG4gICAgICAgICAgICBsb2NhbENhY2hlOiBsb2NhbER1bXAoKSxcbiAgICAgICAgICAgIHJlbW90ZUNhY2hlOiByZW1vdGVEdW1wKClcbiAgICAgICAgfTtcbiAgICAgICAgcmV0dXJuIGFzSnNvbiA/IHV0aWwucHJldHR5UHJpbnQoZHVtcGVkLCBudWxsLCA0KSA6IGR1bXBlZDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBfcmVtb3RlQ2FjaGUoKSB7XG4gICAgICAgIHJldHVybiByZW1vdGVDYWNoZVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIF9sb2NhbENhY2hlKCkge1xuICAgICAgICByZXR1cm4gbG9jYWxDYWNoZUJ5SWQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUXVlcnkgdGhlIGNhY2hlXG4gICAgICogQHBhcmFtICB7T2JqZWN0fSBvcHRzIE9iamVjdCBkZXNjcmliaW5nIHRoZSBxdWVyeVxuICAgICAqIEByZXR1cm4ge01vZGVsSW5zdGFuY2V9XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBgYGBqc1xuICAgICAqIGNhY2hlLmdldCh7X2lkOiAnNSd9KTsgLy8gUXVlcnkgYnkgbG9jYWwgaWRcbiAgICAgKiBjYWNoZS5nZXQoe3JlbW90ZUlkOiAnNScsIG1hcHBpbmc6IG15TWFwcGluZ30pOyAvLyBRdWVyeSBieSByZW1vdGUgaWRcbiAgICAgKiBgYGBcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBnZXQob3B0cykge1xuICAgICAgICBsb2coJ2dldCcsIG9wdHMpO1xuICAgICAgICB2YXIgb2JqLCBpZEZpZWxkLCByZW1vdGVJZDtcbiAgICAgICAgdmFyIGxvY2FsSWQgPSBvcHRzLl9pZDtcbiAgICAgICAgaWYgKGxvY2FsSWQpIHtcbiAgICAgICAgICAgIG9iaiA9IGdldFZpYUxvY2FsSWQobG9jYWxJZCk7XG4gICAgICAgICAgICBpZiAob2JqKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG9iajtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgaWYgKG9wdHMubW9kZWwpIHtcbiAgICAgICAgICAgICAgICAgICAgaWRGaWVsZCA9IG9wdHMubW9kZWwuaWQ7XG4gICAgICAgICAgICAgICAgICAgIHJlbW90ZUlkID0gb3B0c1tpZEZpZWxkXTtcbiAgICAgICAgICAgICAgICAgICAgbG9nKGlkRmllbGQgKyAnPScgKyByZW1vdGVJZCk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBnZXRWaWFSZW1vdGVJZChyZW1vdGVJZCwgb3B0cyk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKG9wdHMubW9kZWwpIHtcbiAgICAgICAgICAgIGlkRmllbGQgPSBvcHRzLm1vZGVsLmlkO1xuICAgICAgICAgICAgcmVtb3RlSWQgPSBvcHRzW2lkRmllbGRdO1xuICAgICAgICAgICAgaWYgKHJlbW90ZUlkKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGdldFZpYVJlbW90ZUlkKHJlbW90ZUlkLCBvcHRzKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAob3B0cy5tb2RlbC5zaW5nbGV0b24pIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZ2V0U2luZ2xldG9uKG9wdHMubW9kZWwpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbG9nKCdJbnZhbGlkIG9wdHMgdG8gY2FjaGUnLCB7XG4gICAgICAgICAgICAgICAgb3B0czogb3B0c1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSW5zZXJ0IGFuIG9iamVjdCBpbnRvIHRoZSBjYWNoZS5cbiAgICAgKiBAcGFyYW0gIHtNb2RlbEluc3RhbmNlfSBvYmpcbiAgICAgKiBAdGhyb3dzIHtJbnRlcm5hbFNpZXN0YUVycm9yfSBBbiBvYmplY3Qgd2l0aCBfaWQvcmVtb3RlSWQgYWxyZWFkeSBleGlzdHMuIE5vdCB0aHJvd24gaWYgc2FtZSBvYmhlY3QuXG4gICAgICovXG4gICAgZnVuY3Rpb24gaW5zZXJ0KG9iaikge1xuICAgICAgICB2YXIgbG9jYWxJZCA9IG9iai5faWQ7XG4gICAgICAgIGlmIChsb2NhbElkKSB7XG4gICAgICAgICAgICB2YXIgY29sbGVjdGlvbk5hbWUgPSBvYmoubW9kZWwuY29sbGVjdGlvbk5hbWU7XG4gICAgICAgICAgICB2YXIgbW9kZWxOYW1lID0gb2JqLm1vZGVsLm5hbWU7XG4gICAgICAgICAgICBsb2coJ0xvY2FsIGNhY2hlIGluc2VydDogJyArIG9iai5fZHVtcFN0cmluZygpKTtcbiAgICAgICAgICAgIGlmICghbG9jYWxDYWNoZUJ5SWRbbG9jYWxJZF0pIHtcbiAgICAgICAgICAgICAgICBsb2NhbENhY2hlQnlJZFtsb2NhbElkXSA9IG9iajtcbiAgICAgICAgICAgICAgICBsb2coJ0xvY2FsIGNhY2hlIG5vdyBsb29rcyBsaWtlOiAnICsgbG9jYWxEdW1wKHRydWUpKTtcbiAgICAgICAgICAgICAgICBpZiAoIWxvY2FsQ2FjaGVbY29sbGVjdGlvbk5hbWVdKSBsb2NhbENhY2hlW2NvbGxlY3Rpb25OYW1lXSA9IHt9O1xuICAgICAgICAgICAgICAgIGlmICghbG9jYWxDYWNoZVtjb2xsZWN0aW9uTmFtZV1bbW9kZWxOYW1lXSkgbG9jYWxDYWNoZVtjb2xsZWN0aW9uTmFtZV1bbW9kZWxOYW1lXSA9IHt9O1xuICAgICAgICAgICAgICAgIGxvY2FsQ2FjaGVbY29sbGVjdGlvbk5hbWVdW21vZGVsTmFtZV1bbG9jYWxJZF0gPSBvYmo7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIFNvbWV0aGluZyBoYXMgZ29uZSBiYWRseSB3cm9uZyBoZXJlLiBUd28gb2JqZWN0cyBzaG91bGQgbmV2ZXIgZXhpc3Qgd2l0aCB0aGUgc2FtZSBfaWRcbiAgICAgICAgICAgICAgICBpZiAobG9jYWxDYWNoZUJ5SWRbbG9jYWxJZF0gIT0gb2JqKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBtZXNzYWdlID0gJ09iamVjdCB3aXRoIF9pZD1cIicgKyBsb2NhbElkLnRvU3RyaW5nKCkgKyAnXCIgaXMgYWxyZWFkeSBpbiB0aGUgY2FjaGUuICcgK1xuICAgICAgICAgICAgICAgICAgICAgICAgJ1RoaXMgaXMgYSBzZXJpb3VzIGVycm9yLiBQbGVhc2UgZmlsZSBhIGJ1ZyByZXBvcnQgaWYgeW91IGFyZSBleHBlcmllbmNpbmcgdGhpcyBvdXQgaW4gdGhlIHdpbGQnO1xuICAgICAgICAgICAgICAgICAgICBsb2cobWVzc2FnZSk7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKG1lc3NhZ2UpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICB2YXIgaWRGaWVsZCA9IG9iai5pZEZpZWxkO1xuICAgICAgICB2YXIgcmVtb3RlSWQgPSBvYmpbaWRGaWVsZF07XG4gICAgICAgIGlmIChyZW1vdGVJZCkge1xuICAgICAgICAgICAgcmVtb3RlSW5zZXJ0KG9iaiwgcmVtb3RlSWQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbG9nKCdObyByZW1vdGUgaWQgKFwiJyArIGlkRmllbGQgKyAnXCIpIHNvIHdvbnQgYmUgcGxhY2luZyBpbiB0aGUgcmVtb3RlIGNhY2hlJywgb2JqKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdHJ1ZSBpZiBvYmplY3QgaXMgaW4gdGhlIGNhY2hlXG4gICAgICogQHBhcmFtICB7TW9kZWxJbnN0YW5jZX0gb2JqXG4gICAgICogQHJldHVybiB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBmdW5jdGlvbiBjb250YWlucyhvYmopIHtcbiAgICAgICAgdmFyIHEgPSB7XG4gICAgICAgICAgICBfaWQ6IG9iai5faWRcbiAgICAgICAgfTtcbiAgICAgICAgdmFyIG1vZGVsID0gb2JqLm1vZGVsO1xuICAgICAgICBpZiAobW9kZWwuaWQpIHtcbiAgICAgICAgICAgIGlmIChvYmpbbW9kZWwuaWRdKSB7XG4gICAgICAgICAgICAgICAgcS5tb2RlbCA9IG1vZGVsO1xuICAgICAgICAgICAgICAgIHFbbW9kZWwuaWRdID0gb2JqW21vZGVsLmlkXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gISFnZXQocSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVtb3ZlcyB0aGUgb2JqZWN0IGZyb20gdGhlIGNhY2hlIChpZiBpdCdzIGFjdHVhbGx5IGluIHRoZSBjYWNoZSkgb3RoZXJ3aXNlcyB0aHJvd3MgYW4gZXJyb3IuXG4gICAgICogQHBhcmFtICB7TW9kZWxJbnN0YW5jZX0gb2JqXG4gICAgICogQHRocm93cyB7SW50ZXJuYWxTaWVzdGFFcnJvcn0gSWYgb2JqZWN0IGFscmVhZHkgaW4gdGhlIGNhY2hlLlxuICAgICAqL1xuICAgIGZ1bmN0aW9uIHJlbW92ZShvYmopIHtcbiAgICAgICAgaWYgKGNvbnRhaW5zKG9iaikpIHtcbiAgICAgICAgICAgIHZhciBjb2xsZWN0aW9uTmFtZSA9IG9iai5tb2RlbC5jb2xsZWN0aW9uTmFtZTtcbiAgICAgICAgICAgIHZhciBtb2RlbE5hbWUgPSBvYmoubW9kZWwubmFtZTtcbiAgICAgICAgICAgIHZhciBfaWQgPSBvYmouX2lkO1xuICAgICAgICAgICAgaWYgKCFtb2RlbE5hbWUpIHRocm93IEludGVybmFsU2llc3RhRXJyb3IoJ05vIG1hcHBpbmcgbmFtZScpO1xuICAgICAgICAgICAgaWYgKCFjb2xsZWN0aW9uTmFtZSkgdGhyb3cgSW50ZXJuYWxTaWVzdGFFcnJvcignTm8gY29sbGVjdGlvbiBuYW1lJyk7XG4gICAgICAgICAgICBpZiAoIV9pZCkgdGhyb3cgSW50ZXJuYWxTaWVzdGFFcnJvcignTm8gX2lkJyk7XG4gICAgICAgICAgICBkZWxldGUgbG9jYWxDYWNoZVtjb2xsZWN0aW9uTmFtZV1bbW9kZWxOYW1lXVtfaWRdO1xuICAgICAgICAgICAgZGVsZXRlIGxvY2FsQ2FjaGVCeUlkW19pZF07XG4gICAgICAgICAgICBpZiAob2JqLm1vZGVsLmlkKSB7XG4gICAgICAgICAgICAgICAgdmFyIHJlbW90ZUlkID0gb2JqW29iai5tb2RlbC5pZF07XG4gICAgICAgICAgICAgICAgaWYgKHJlbW90ZUlkKSB7XG4gICAgICAgICAgICAgICAgICAgIGRlbGV0ZSByZW1vdGVDYWNoZVtjb2xsZWN0aW9uTmFtZV1bbW9kZWxOYW1lXVtyZW1vdGVJZF07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ09iamVjdCB3YXMgbm90IGluIGNhY2hlLicpO1xuICAgICAgICB9XG4gICAgfVxuXG5cbiAgICBleHBvcnRzLl9yZW1vdGVDYWNoZSA9IF9yZW1vdGVDYWNoZTtcbiAgICBleHBvcnRzLl9sb2NhbENhY2hlID0gX2xvY2FsQ2FjaGU7XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsICdfbG9jYWxDYWNoZUJ5VHlwZScsIHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gbG9jYWxDYWNoZTtcbiAgICAgICAgfVxuICAgIH0pO1xuICAgIGV4cG9ydHMuZ2V0ID0gZ2V0O1xuICAgIGV4cG9ydHMuaW5zZXJ0ID0gaW5zZXJ0O1xuICAgIGV4cG9ydHMucmVtb3RlSW5zZXJ0ID0gcmVtb3RlSW5zZXJ0O1xuICAgIGV4cG9ydHMucmVzZXQgPSByZXNldDtcbiAgICBleHBvcnRzLl9kdW1wID0gZHVtcDtcbiAgICBleHBvcnRzLmNvbnRhaW5zID0gY29udGFpbnM7XG4gICAgZXhwb3J0cy5yZW1vdmUgPSByZW1vdmU7XG4gICAgZXhwb3J0cy5nZXRTaW5nbGV0b24gPSBnZXRTaW5nbGV0b247XG59KSgpOyIsIi8qKlxuICogQG1vZHVsZSBjb2xsZWN0aW9uXG4gKi9cbihmdW5jdGlvbiAoKSB7XG4gICAgdmFyIGxvZyA9IHJlcXVpcmUoJy4vbG9nJykoJ2NvbGxlY3Rpb24nKSxcbiAgICAgICAgQ29sbGVjdGlvblJlZ2lzdHJ5ID0gcmVxdWlyZSgnLi9jb2xsZWN0aW9uUmVnaXN0cnknKS5Db2xsZWN0aW9uUmVnaXN0cnksXG4gICAgICAgIEludGVybmFsU2llc3RhRXJyb3IgPSByZXF1aXJlKCcuL2Vycm9yJykuSW50ZXJuYWxTaWVzdGFFcnJvcixcbiAgICAgICAgTW9kZWwgPSByZXF1aXJlKCcuL21vZGVsJyksXG4gICAgICAgIGV4dGVuZCA9IHJlcXVpcmUoJ2V4dGVuZCcpLFxuICAgICAgICBvYnNlcnZlID0gcmVxdWlyZSgnLi4vdmVuZG9yL29ic2VydmUtanMvc3JjL29ic2VydmUnKS5QbGF0Zm9ybSxcbiAgICAgICAgZXZlbnRzID0gcmVxdWlyZSgnLi9ldmVudHMnKSxcbiAgICAgICAgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpLFxuICAgICAgICBfID0gdXRpbC5fLFxuICAgICAgICBlcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKSxcbiAgICAgICAgY2FjaGUgPSByZXF1aXJlKCcuL2NhY2hlJyk7XG5cblxuICAgIC8qKlxuICAgICAqIEEgY29sbGVjdGlvbiBkZXNjcmliZXMgYSBzZXQgb2YgbW9kZWxzIGFuZCBvcHRpb25hbGx5IGEgUkVTVCBBUEkgd2hpY2ggd2Ugd291bGRcbiAgICAgKiBsaWtlIHRvIG1vZGVsLlxuICAgICAqXG4gICAgICogQHBhcmFtIG5hbWVcbiAgICAgKiBAcGFyYW0gb3B0c1xuICAgICAqIEBjb25zdHJ1Y3RvclxuICAgICAqXG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGBgYGpzXG4gICAgICogdmFyIEdpdEh1YiA9IG5ldyBzaWVzdGEoJ0dpdEh1YicpXG4gICAgICogLy8gLi4uIGNvbmZpZ3VyZSBtYXBwaW5ncywgZGVzY3JpcHRvcnMgZXRjIC4uLlxuICAgICAqIEdpdEh1Yi5pbnN0YWxsKGZ1bmN0aW9uICgpIHtcbiAgICAgKiAgICAgLy8gLi4uIGNhcnJ5IG9uLlxuICAgICAqIH0pO1xuICAgICAqIGBgYFxuICAgICAqL1xuICAgIGZ1bmN0aW9uIENvbGxlY3Rpb24obmFtZSwgb3B0cykge1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgIGlmICghbmFtZSkgdGhyb3cgbmV3IEVycm9yKCdDb2xsZWN0aW9uIG11c3QgaGF2ZSBhIG5hbWUnKTtcblxuICAgICAgICBvcHRzID0gb3B0cyB8fCB7fTtcbiAgICAgICAgdXRpbC5leHRlbmRGcm9tT3B0cyh0aGlzLCBvcHRzLCB7XG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIFRoZSBVUkwgb2YgdGhlIEFQSSBlLmcuIGh0dHA6Ly9hcGkuZ2l0aHViLmNvbVxuICAgICAgICAgICAgICogQHR5cGUge3N0cmluZ31cbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgYmFzZVVSTDogJydcbiAgICAgICAgfSk7XG5cbiAgICAgICAgXy5leHRlbmQodGhpcywge1xuICAgICAgICAgICAgbmFtZTogbmFtZSxcbiAgICAgICAgICAgIF9yYXdNb2RlbHM6IHt9LFxuICAgICAgICAgICAgX21vZGVsczoge30sXG4gICAgICAgICAgICBfb3B0czogb3B0cyxcbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogU2V0IHRvIHRydWUgaWYgaW5zdGFsbGF0aW9uIGhhcyBzdWNjZWVkZWQuIFlvdSBjYW5ub3QgdXNlIHRoZSBjb2xsZWN0aW9cbiAgICAgICAgICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICBpbnN0YWxsZWQ6IGZhbHNlXG4gICAgICAgIH0pO1xuXG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKHRoaXMsIHtcbiAgICAgICAgICAgIGRpcnR5OiB7XG4gICAgICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChzaWVzdGEuZXh0LnN0b3JhZ2VFbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgdW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb24gPSBzaWVzdGEuZXh0LnN0b3JhZ2UuX3Vuc2F2ZWRPYmplY3RzQnlDb2xsZWN0aW9uLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGhhc2ggPSB1bnNhdmVkT2JqZWN0c0J5Q29sbGVjdGlvbltzZWxmLm5hbWVdIHx8IHt9O1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuICEhT2JqZWN0LmtleXMoaGFzaCkubGVuZ3RoO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2UgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgQ29sbGVjdGlvblJlZ2lzdHJ5LnJlZ2lzdGVyKHRoaXMpO1xuICAgICAgICBldmVudHMuUHJveHlFdmVudEVtaXR0ZXIuY2FsbCh0aGlzLCB0aGlzLm5hbWUpO1xuICAgIH1cblxuICAgIENvbGxlY3Rpb24ucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShldmVudHMuUHJveHlFdmVudEVtaXR0ZXIucHJvdG90eXBlKTtcblxuICAgIF8uZXh0ZW5kKENvbGxlY3Rpb24ucHJvdG90eXBlLCB7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBFbnN1cmUgbWFwcGluZ3MgYXJlIGluc3RhbGxlZC5cbiAgICAgICAgICogQHBhcmFtIFtjYl1cbiAgICAgICAgICogQGNsYXNzIENvbGxlY3Rpb25cbiAgICAgICAgICovXG4gICAgICAgIGluc3RhbGw6IGZ1bmN0aW9uIChjYikge1xuICAgICAgICAgICAgcmV0dXJuIHV0aWwucHJvbWlzZShjYiwgZnVuY3Rpb24gKGNiKSB7XG4gICAgICAgICAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICAgICAgICAgIGlmICghdGhpcy5pbnN0YWxsZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIG1vZGVsc1RvSW5zdGFsbCA9IFtdO1xuICAgICAgICAgICAgICAgICAgICBmb3IgKHZhciBuYW1lIGluIHRoaXMuX21vZGVscykge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuX21vZGVscy5oYXNPd25Qcm9wZXJ0eShuYW1lKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBtb2RlbCA9IHRoaXMuX21vZGVsc1tuYW1lXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtb2RlbHNUb0luc3RhbGwucHVzaChtb2RlbCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgbG9nKCdUaGVyZSBhcmUgJyArIG1vZGVsc1RvSW5zdGFsbC5sZW5ndGgudG9TdHJpbmcoKSArICcgbWFwcGluZ3MgdG8gaW5zdGFsbCcpO1xuICAgICAgICAgICAgICAgICAgICBpZiAobW9kZWxzVG9JbnN0YWxsLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHRhc2tzID0gXy5tYXAobW9kZWxzVG9JbnN0YWxsLCBmdW5jdGlvbiAobSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBfLmJpbmQobS5pbnN0YWxsLCBtKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgdXRpbC5hc3luYy5wYXJhbGxlbCh0YXNrcywgZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nKCdGYWlsZWQgdG8gaW5zdGFsbCBjb2xsZWN0aW9uJywgZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2VsZi5fZmluYWxpc2VJbnN0YWxsYXRpb24oZXJyLCBjYik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZWxmLmluc3RhbGxlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBlcnJvcnMgPSBbXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXy5lYWNoKG1vZGVsc1RvSW5zdGFsbCwgZnVuY3Rpb24gKG0pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZygnSW5zdGFsbGluZyByZWxhdGlvbnNoaXBzIGZvciBtYXBwaW5nIHdpdGggbmFtZSBcIicgKyBtLm5hbWUgKyAnXCInKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBlcnIgPSBtLmluc3RhbGxSZWxhdGlvbnNoaXBzKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKSBlcnJvcnMucHVzaChlcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFlcnJvcnMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBfLmVhY2gobW9kZWxzVG9JbnN0YWxsLCBmdW5jdGlvbiAobSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZygnSW5zdGFsbGluZyByZXZlcnNlIHJlbGF0aW9uc2hpcHMgZm9yIG1hcHBpbmcgd2l0aCBuYW1lIFwiJyArIG0ubmFtZSArICdcIicpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBlcnIgPSBtLmluc3RhbGxSZXZlcnNlUmVsYXRpb25zaGlwcygpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIGVycm9ycy5wdXNoKGVycik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXJyb3JzLmxlbmd0aCA9PSAxKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlcnIgPSBlcnJvcnNbMF07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoZXJyb3JzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZXJyID0gZXJyb3JzO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYuX2ZpbmFsaXNlSW5zdGFsbGF0aW9uKGVyciwgY2IpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzZWxmLl9maW5hbGlzZUluc3RhbGxhdGlvbihudWxsLCBjYik7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignQ29sbGVjdGlvbiBcIicgKyB0aGlzLm5hbWUgKyAnXCIgaGFzIGFscmVhZHkgYmVlbiBpbnN0YWxsZWQnKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBNYXJrIHRoaXMgY29sbGVjdGlvbiBhcyBpbnN0YWxsZWQsIGFuZCBwbGFjZSB0aGUgY29sbGVjdGlvbiBvbiB0aGUgZ2xvYmFsIFNpZXN0YSBvYmplY3QuXG4gICAgICAgICAqIEBwYXJhbSAge09iamVjdH0gICBlcnJcbiAgICAgICAgICogQHBhcmFtICB7RnVuY3Rpb259IGNhbGxiYWNrXG4gICAgICAgICAqIEBjbGFzcyBDb2xsZWN0aW9uXG4gICAgICAgICAqL1xuICAgICAgICBfZmluYWxpc2VJbnN0YWxsYXRpb246IGZ1bmN0aW9uIChlcnIsIGNhbGxiYWNrKSB7XG4gICAgICAgICAgICBpZiAoZXJyKSBlcnIgPSBlcnJvcignRXJyb3JzIHdlcmUgZW5jb3VudGVyZWQgd2hpbHN0IHNldHRpbmcgdXAgdGhlIGNvbGxlY3Rpb24nLCB7ZXJyb3JzOiBlcnJ9KTtcbiAgICAgICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5pbnN0YWxsZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgIHZhciBpbmRleCA9IHJlcXVpcmUoJy4vaW5kZXgnKTtcbiAgICAgICAgICAgICAgICBpbmRleFt0aGlzLm5hbWVdID0gdGhpcztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgIH0sXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBHaXZlbiB0aGUgbmFtZSBvZiBhIG1hcHBpbmcgYW5kIGFuIG9wdGlvbnMgb2JqZWN0IGRlc2NyaWJpbmcgdGhlIG1hcHBpbmcsIGNyZWF0aW5nIGEgTW9kZWxcbiAgICAgICAgICogb2JqZWN0LCBpbnN0YWxsIGl0IGFuZCByZXR1cm4gaXQuXG4gICAgICAgICAqIEBwYXJhbSAge1N0cmluZ30gbmFtZVxuICAgICAgICAgKiBAcGFyYW0gIHtPYmplY3R9IG9wdHNcbiAgICAgICAgICogQHJldHVybiB7TW9kZWx9XG4gICAgICAgICAqIEBjbGFzcyBDb2xsZWN0aW9uXG4gICAgICAgICAqL1xuICAgICAgICBfbW9kZWw6IGZ1bmN0aW9uIChuYW1lLCBvcHRzKSB7XG4gICAgICAgICAgICBpZiAobmFtZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3Jhd01vZGVsc1tuYW1lXSA9IG9wdHM7XG4gICAgICAgICAgICAgICAgb3B0cyA9IGV4dGVuZCh0cnVlLCB7fSwgb3B0cyk7XG4gICAgICAgICAgICAgICAgb3B0cy5uYW1lID0gbmFtZTtcbiAgICAgICAgICAgICAgICBvcHRzLmNvbGxlY3Rpb24gPSB0aGlzO1xuICAgICAgICAgICAgICAgIHZhciBtb2RlbCA9IG5ldyBNb2RlbChvcHRzKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9tb2RlbHNbbmFtZV0gPSBtb2RlbDtcbiAgICAgICAgICAgICAgICB0aGlzW25hbWVdID0gbW9kZWw7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG1vZGVsO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ05vIG5hbWUgc3BlY2lmaWVkIHdoZW4gY3JlYXRpbmcgbWFwcGluZycpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFJlZ2lzdGVycyBhIG1vZGVsIHdpdGggdGhpcyBjb2xsZWN0aW9uLlxuICAgICAgICAgKiBAcGFyYW0ge1N0cmluZ3xPYmplY3R9IG9wdHNPck5hbWUgQW4gb3B0aW9ucyBvYmplY3Qgb3IgdGhlIG5hbWUgb2YgdGhlIG1hcHBpbmcuIE11c3QgcGFzcyBvcHRpb25zIGFzIHNlY29uZCBwYXJhbSBpZiBzcGVjaWZ5IG5hbWUuXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBvcHRzIE9wdGlvbnMgaWYgbmFtZSBhbHJlYWR5IHNwZWNpZmllZC5cbiAgICAgICAgICogQHJldHVybiB7TW9kZWx9XG4gICAgICAgICAqIEBjbGFzcyBDb2xsZWN0aW9uXG4gICAgICAgICAqL1xuICAgICAgICBtb2RlbDogZnVuY3Rpb24gKG9wKSB7XG4gICAgICAgICAgICB2YXIgYWNjZXB0TW9kZWxzID0gIXRoaXMuaW5zdGFsbGVkO1xuICAgICAgICAgICAgaWYgKGFjY2VwdE1vZGVscykge1xuICAgICAgICAgICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgICAgICAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PSAxKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodXRpbC5pc0FycmF5KGFyZ3VtZW50c1swXSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gXy5tYXAoYXJndW1lbnRzWzBdLCBmdW5jdGlvbiAobSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gc2VsZi5fbW9kZWwobS5uYW1lLCBtKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG5hbWUsIG9wdHM7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHV0aWwuaXNTdHJpbmcoYXJndW1lbnRzWzBdKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBuYW1lID0gYXJndW1lbnRzWzBdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvcHRzID0ge307XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvcHRzID0gYXJndW1lbnRzWzBdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBuYW1lID0gb3B0cy5uYW1lO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5fbW9kZWwobmFtZSwgb3B0cyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGFyZ3VtZW50c1swXSA9PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLl9tb2RlbChhcmd1bWVudHNbMF0sIGFyZ3VtZW50c1sxXSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBfLm1hcChhcmd1bWVudHMsIGZ1bmN0aW9uIChtKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBzZWxmLl9tb2RlbChtLm5hbWUsIG0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgRXJyb3IoJ0Nhbm5vdCBjcmVhdGUgbmV3IG1vZGVscyBvbmNlIHRoZSBvYmplY3QgZ3JhcGggaXMgZXN0YWJsaXNoZWQhJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogRHVtcCB0aGlzIGNvbGxlY3Rpb24gYXMgSlNPTlxuICAgICAgICAgKiBAcGFyYW0gIHtCb29sZWFufSBhc0pzb24gV2hldGhlciBvciBub3QgdG8gYXBwbHkgSlNPTi5zdHJpbmdpZnlcbiAgICAgICAgICogQHJldHVybiB7U3RyaW5nfE9iamVjdH1cbiAgICAgICAgICogQGNsYXNzIENvbGxlY3Rpb25cbiAgICAgICAgICovXG4gICAgICAgIF9kdW1wOiBmdW5jdGlvbiAoYXNKc29uKSB7XG4gICAgICAgICAgICB2YXIgb2JqID0ge307XG4gICAgICAgICAgICBvYmouaW5zdGFsbGVkID0gdGhpcy5pbnN0YWxsZWQ7XG4gICAgICAgICAgICBvYmouZG9jSWQgPSB0aGlzLl9kb2NJZDtcbiAgICAgICAgICAgIG9iai5uYW1lID0gdGhpcy5uYW1lO1xuICAgICAgICAgICAgb2JqLmJhc2VVUkwgPSB0aGlzLmJhc2VVUkw7XG4gICAgICAgICAgICByZXR1cm4gYXNKc29uID8gdXRpbC5wcmV0dHlQcmludChvYmopIDogb2JqO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBSZXR1cm5zIHRoZSBudW1iZXIgb2Ygb2JqZWN0cyBpbiB0aGlzIGNvbGxlY3Rpb24uXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSBjYlxuICAgICAgICAgKiBAcmV0dXJucyB7UHJvbWlzZX1cbiAgICAgICAgICovXG4gICAgICAgIGNvdW50OiBmdW5jdGlvbiAoY2IpIHtcbiAgICAgICAgICAgIHJldHVybiB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uIChjYikge1xuICAgICAgICAgICAgICAgIHZhciB0YXNrcyA9IF8ubWFwKHRoaXMuX21vZGVscywgZnVuY3Rpb24gKG0pIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIF8uYmluZChtLmNvdW50LCBtKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB1dGlsLmFzeW5jLnBhcmFsbGVsKHRhc2tzLCBmdW5jdGlvbiAoZXJyLCBucykge1xuICAgICAgICAgICAgICAgICAgICB2YXIgbjtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG4gPSBfLnJlZHVjZShucywgZnVuY3Rpb24gKG0sIHIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gbSArIHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sIDApO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGNiKGVyciwgbik7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICBtb2R1bGUuZXhwb3J0cyA9IENvbGxlY3Rpb247XG59KSgpOyIsIi8qKlxuICogQG1vZHVsZSBjb2xsZWN0aW9uXG4gKi9cbihmdW5jdGlvbiAoKSB7XG4gICAgdmFyIF8gPSByZXF1aXJlKCcuL3V0aWwnKS5fO1xuXG4gICAgZnVuY3Rpb24gQ29sbGVjdGlvblJlZ2lzdHJ5KCkge1xuICAgICAgICBpZiAoIXRoaXMpIHJldHVybiBuZXcgQ29sbGVjdGlvblJlZ2lzdHJ5KCk7XG4gICAgICAgIHRoaXMuY29sbGVjdGlvbk5hbWVzID0gW107XG4gICAgfVxuXG4gICAgXy5leHRlbmQoQ29sbGVjdGlvblJlZ2lzdHJ5LnByb3RvdHlwZSwge1xuICAgICAgICByZWdpc3RlcjogZnVuY3Rpb24gKGNvbGxlY3Rpb24pIHtcbiAgICAgICAgICAgIHZhciBuYW1lID0gY29sbGVjdGlvbi5uYW1lO1xuICAgICAgICAgICAgdGhpc1tuYW1lXSA9IGNvbGxlY3Rpb247XG4gICAgICAgICAgICB0aGlzLmNvbGxlY3Rpb25OYW1lcy5wdXNoKG5hbWUpO1xuICAgICAgICB9LFxuICAgICAgICByZXNldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICAgICAgXy5lYWNoKHRoaXMuY29sbGVjdGlvbk5hbWVzLCBmdW5jdGlvbiAobmFtZSkge1xuICAgICAgICAgICAgICAgIGRlbGV0ZSBzZWxmW25hbWVdO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB0aGlzLmNvbGxlY3Rpb25OYW1lcyA9IFtdO1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICBleHBvcnRzLkNvbGxlY3Rpb25SZWdpc3RyeSA9IG5ldyBDb2xsZWN0aW9uUmVnaXN0cnkoKTtcbn0pKCk7IiwiLyoqXG4gKiBAbW9kdWxlIGVycm9yXG4gKi9cbihmdW5jdGlvbiAoKSB7XG5cbiAgICAvKipcbiAgICAgKiBVc2VycyBzaG91bGQgbmV2ZXIgc2VlIHRoZXNlIHRocm93bi4gQSBidWcgcmVwb3J0IHNob3VsZCBiZSBmaWxlZCBpZiBzbyBhcyBpdCBtZWFucyBzb21lIGFzc2VydGlvbiBoYXMgZmFpbGVkLlxuICAgICAqIEBwYXJhbSBtZXNzYWdlXG4gICAgICogQHBhcmFtIGNvbnRleHRcbiAgICAgKiBAcGFyYW0gc3NmXG4gICAgICogQGNvbnN0cnVjdG9yXG4gICAgICovXG4gICAgZnVuY3Rpb24gSW50ZXJuYWxTaWVzdGFFcnJvcihtZXNzYWdlLCBjb250ZXh0LCBzc2YpIHtcbiAgICAgICAgdGhpcy5tZXNzYWdlID0gbWVzc2FnZTtcbiAgICAgICAgdGhpcy5jb250ZXh0ID0gY29udGV4dDtcbiAgICAgICAgLy8gY2FwdHVyZSBzdGFjayB0cmFjZVxuICAgICAgICBzc2YgPSBzc2YgfHwgYXJndW1lbnRzLmNhbGxlZTtcbiAgICAgICAgaWYgKHNzZiAmJiBFcnJvci5jYXB0dXJlU3RhY2tUcmFjZSkge1xuICAgICAgICAgICAgRXJyb3IuY2FwdHVyZVN0YWNrVHJhY2UodGhpcywgc3NmKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIEludGVybmFsU2llc3RhRXJyb3IucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShFcnJvci5wcm90b3R5cGUpO1xuICAgIEludGVybmFsU2llc3RhRXJyb3IucHJvdG90eXBlLm5hbWUgPSAnSW50ZXJuYWxTaWVzdGFFcnJvcic7XG4gICAgSW50ZXJuYWxTaWVzdGFFcnJvci5wcm90b3R5cGUuY29uc3RydWN0b3IgPSBJbnRlcm5hbFNpZXN0YUVycm9yO1xuXG4gICAgZnVuY3Rpb24gaXNTaWVzdGFFcnJvcihlcnIpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBlcnIgPT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgIHJldHVybiAnZXJyb3InIGluIGVyciAmJiAnb2snIGluIGVyciAmJiAncmVhc29uJyBpbiBlcnI7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKGVyck1lc3NhZ2UsIGV4dHJhKSB7XG4gICAgICAgIGlmIChpc1NpZXN0YUVycm9yKGVyck1lc3NhZ2UpKSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyTWVzc2FnZTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgZXJyID0ge1xuICAgICAgICAgICAgcmVhc29uOiBlcnJNZXNzYWdlLFxuICAgICAgICAgICAgZXJyb3I6IHRydWUsXG4gICAgICAgICAgICBvazogZmFsc2VcbiAgICAgICAgfTtcbiAgICAgICAgZm9yICh2YXIgcHJvcCBpbiBleHRyYSB8fCB7fSkge1xuICAgICAgICAgICAgaWYgKGV4dHJhLmhhc093blByb3BlcnR5KHByb3ApKSBlcnJbcHJvcF0gPSBleHRyYVtwcm9wXTtcbiAgICAgICAgfVxuICAgICAgICBlcnIudG9TdHJpbmcgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkodGhpcyk7XG4gICAgICAgIH07XG4gICAgICAgIHJldHVybiBlcnI7XG4gICAgfTtcblxuICAgIG1vZHVsZS5leHBvcnRzLkludGVybmFsU2llc3RhRXJyb3IgPSBJbnRlcm5hbFNpZXN0YUVycm9yO1xuXG59KSgpOyIsIihmdW5jdGlvbiAoKSB7XG4gICAgdmFyIEV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJ2V2ZW50cycpLkV2ZW50RW1pdHRlcixcbiAgICAgICAgQXJyYXlPYnNlcnZlciA9IHJlcXVpcmUoJy4uL3ZlbmRvci9vYnNlcnZlLWpzL3NyYy9vYnNlcnZlJykuQXJyYXlPYnNlcnZlcixcbiAgICAgICAgXyA9IHJlcXVpcmUoJy4vdXRpbCcpLl8sXG4gICAgICAgIG1vZGVsRXZlbnRzID0gcmVxdWlyZSgnLi9tb2RlbEV2ZW50cycpO1xuXG4gICAgdmFyIGV2ZW50cyA9IG5ldyBFdmVudEVtaXR0ZXIoKTtcbiAgICBldmVudHMuc2V0TWF4TGlzdGVuZXJzKDEwMCk7XG5cbiAgICAvKipcbiAgICAgKiBMaXN0ZW4gdG8gYSBwYXJ0aWN1bGFyIGV2ZW50IGZyb20gdGhlIFNpZXN0YSBnbG9iYWwgRXZlbnRFbWl0dGVyLlxuICAgICAqIE1hbmFnZXMgaXRzIG93biBzZXQgb2YgbGlzdGVuZXJzLlxuICAgICAqIEBjb25zdHJ1Y3RvclxuICAgICAqL1xuICAgIGZ1bmN0aW9uIFByb3h5RXZlbnRFbWl0dGVyKGV2ZW50KSB7XG4gICAgICAgIF8uZXh0ZW5kKHRoaXMsIHtcbiAgICAgICAgICAgIGV2ZW50OiBldmVudCxcbiAgICAgICAgICAgIGxpc3RlbmVyczoge31cbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgXy5leHRlbmQoUHJveHlFdmVudEVtaXR0ZXIucHJvdG90eXBlLCB7XG4gICAgICAgIGxpc3RlbjogZnVuY3Rpb24gKHR5cGUsIGZuKSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIHR5cGUgPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgICAgIGZuID0gdHlwZTtcbiAgICAgICAgICAgICAgICB0eXBlID0gbnVsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHZhciBfZm4gPSBmbjtcbiAgICAgICAgICAgICAgICBmbiA9IGZ1bmN0aW9uIChlKSB7XG4gICAgICAgICAgICAgICAgICAgIGUgPSBlIHx8IHt9O1xuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGUudHlwZSA9PSB0eXBlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgX2ZuKGUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgX2ZuKGUpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICB2YXIgbGlzdGVuZXJzID0gdGhpcy5saXN0ZW5lcnM7XG4gICAgICAgICAgICAgICAgaWYgKHR5cGUpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFsaXN0ZW5lcnNbdHlwZV0pIGxpc3RlbmVyc1t0eXBlXSA9IFtdO1xuICAgICAgICAgICAgICAgICAgICBsaXN0ZW5lcnNbdHlwZV0ucHVzaChmbik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZXZlbnRzLm9uKHRoaXMuZXZlbnQsIGZuKTtcbiAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fcmVtb3ZlTGlzdGVuZXIoZm4sIHR5cGUpO1xuICAgICAgICAgICAgfS5iaW5kKHRoaXMpO1xuICAgICAgICB9LFxuICAgICAgICBsaXN0ZW5PbmNlOiBmdW5jdGlvbiAodHlwZSwgZm4pIHtcbiAgICAgICAgICAgIHZhciBldmVudCA9IHRoaXMuZXZlbnQ7XG4gICAgICAgICAgICBpZiAodHlwZW9mIHR5cGUgPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgICAgIGZuID0gdHlwZTtcbiAgICAgICAgICAgICAgICB0eXBlID0gbnVsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHZhciBfZm4gPSBmbjtcbiAgICAgICAgICAgICAgICBmbiA9IGZ1bmN0aW9uIChlKSB7XG4gICAgICAgICAgICAgICAgICAgIGUgPSBlIHx8IHt9O1xuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGUudHlwZSA9PSB0eXBlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZXZlbnRzLnJlbW92ZUxpc3RlbmVyKGV2ZW50LCBmbik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgX2ZuKGUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgX2ZuKGUpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHR5cGUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZXZlbnRzLm9uKGV2ZW50LCBmbik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZXZlbnRzLm9uY2UoZXZlbnQsIGZuKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgX3JlbW92ZUxpc3RlbmVyOiBmdW5jdGlvbiAoZm4sIHR5cGUpIHtcbiAgICAgICAgICAgIGlmICh0eXBlKSB7XG4gICAgICAgICAgICAgICAgdmFyIGxpc3RlbmVycyA9IHRoaXMubGlzdGVuZXJzW3R5cGVdLFxuICAgICAgICAgICAgICAgICAgICBpZHggPSBsaXN0ZW5lcnMuaW5kZXhPZihmbik7XG4gICAgICAgICAgICAgICAgbGlzdGVuZXJzLnNwbGljZShpZHgsIDEpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGV2ZW50cy5yZW1vdmVMaXN0ZW5lcih0aGlzLmV2ZW50LCBmbik7XG4gICAgICAgIH0sXG4gICAgICAgIGVtaXQ6IGZ1bmN0aW9uICh0eXBlLCBwYXlsb2FkKSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIHR5cGUgPT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgICAgICBwYXlsb2FkID0gdHlwZTtcbiAgICAgICAgICAgICAgICB0eXBlID0gbnVsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHBheWxvYWQgPSBwYXlsb2FkIHx8IHt9O1xuICAgICAgICAgICAgICAgIHBheWxvYWQudHlwZSA9IHR5cGU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBldmVudHMuZW1pdC5jYWxsKGV2ZW50cywgdGhpcy5ldmVudCwgcGF5bG9hZCk7XG4gICAgICAgIH0sXG4gICAgICAgIF9yZW1vdmVBbGxMaXN0ZW5lcnM6IGZ1bmN0aW9uICh0eXBlKSB7XG4gICAgICAgICAgICAodGhpcy5saXN0ZW5lcnNbdHlwZV0gfHwgW10pLmZvckVhY2goZnVuY3Rpb24gKGZuKSB7XG4gICAgICAgICAgICAgICAgZXZlbnRzLnJlbW92ZUxpc3RlbmVyKHRoaXMuZXZlbnQsIGZuKTtcbiAgICAgICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICAgICAgICB0aGlzLmxpc3RlbmVyc1t0eXBlXSA9IFtdO1xuICAgICAgICB9LFxuICAgICAgICByZW1vdmVBbGxMaXN0ZW5lcnM6IGZ1bmN0aW9uICh0eXBlKSB7XG4gICAgICAgICAgICBpZiAodHlwZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3JlbW92ZUFsbExpc3RlbmVycyh0eXBlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGZvciAodHlwZSBpbiB0aGlzLmxpc3RlbmVycykge1xuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5saXN0ZW5lcnMuaGFzT3duUHJvcGVydHkodHlwZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX3JlbW92ZUFsbExpc3RlbmVycyh0eXBlKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gQWxpYXNlc1xuICAgIF8uZXh0ZW5kKFByb3h5RXZlbnRFbWl0dGVyLnByb3RvdHlwZSwge1xuICAgICAgICBvbjogUHJveHlFdmVudEVtaXR0ZXIucHJvdG90eXBlLmxpc3RlblxuICAgIH0pO1xuXG4gICAgXy5leHRlbmQoZXZlbnRzLCB7XG4gICAgICAgIFByb3h5RXZlbnRFbWl0dGVyOiBQcm94eUV2ZW50RW1pdHRlcixcbiAgICAgICAgd3JhcEFycmF5OiBmdW5jdGlvbiAoYXJyYXksIGZpZWxkLCBtb2RlbEluc3RhbmNlKSB7XG4gICAgICAgICAgICBpZiAoIWFycmF5Lm9ic2VydmVyKSB7XG4gICAgICAgICAgICAgICAgYXJyYXkub2JzZXJ2ZXIgPSBuZXcgQXJyYXlPYnNlcnZlcihhcnJheSk7XG4gICAgICAgICAgICAgICAgYXJyYXkub2JzZXJ2ZXIub3BlbihmdW5jdGlvbiAoc3BsaWNlcykge1xuICAgICAgICAgICAgICAgICAgICB2YXIgZmllbGRJc0F0dHJpYnV0ZSA9IG1vZGVsSW5zdGFuY2UuX2F0dHJpYnV0ZU5hbWVzLmluZGV4T2YoZmllbGQpID4gLTE7XG4gICAgICAgICAgICAgICAgICAgIGlmIChmaWVsZElzQXR0cmlidXRlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzcGxpY2VzLmZvckVhY2goZnVuY3Rpb24gKHNwbGljZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1vZGVsRXZlbnRzLmVtaXQoe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb2xsZWN0aW9uOiBtb2RlbEluc3RhbmNlLmNvbGxlY3Rpb25OYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtb2RlbDogbW9kZWxJbnN0YW5jZS5tb2RlbC5uYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBfaWQ6IG1vZGVsSW5zdGFuY2UuX2lkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbmRleDogc3BsaWNlLmluZGV4LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZW1vdmVkOiBzcGxpY2UucmVtb3ZlZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYWRkZWQ6IHNwbGljZS5hZGRlZENvdW50ID8gYXJyYXkuc2xpY2Uoc3BsaWNlLmluZGV4LCBzcGxpY2UuaW5kZXggKyBzcGxpY2UuYWRkZWRDb3VudCkgOiBbXSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogbW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUuU3BsaWNlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmaWVsZDogZmllbGQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9iajogbW9kZWxJbnN0YW5jZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBldmVudHM7XG59KSgpOyIsIihmdW5jdGlvbiAoKSB7XG4gICAgdmFyIGxvZyA9IHJlcXVpcmUoJy4vbG9nJykoJ21vZGVsJyksXG4gICAgICAgIEludGVybmFsU2llc3RhRXJyb3IgPSByZXF1aXJlKCcuL2Vycm9yJykuSW50ZXJuYWxTaWVzdGFFcnJvcixcbiAgICAgICAgUmVsYXRpb25zaGlwVHlwZSA9IHJlcXVpcmUoJy4vUmVsYXRpb25zaGlwVHlwZScpLFxuICAgICAgICBRdWVyeSA9IHJlcXVpcmUoJy4vUXVlcnknKSxcbiAgICAgICAgTW9kZWxJbnN0YW5jZSA9IHJlcXVpcmUoJy4vTW9kZWxJbnN0YW5jZScpLFxuICAgICAgICB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyksXG4gICAgICAgIF8gPSB1dGlsLl8sXG4gICAgICAgIGd1aWQgPSB1dGlsLmd1aWQsXG4gICAgICAgIGNhY2hlID0gcmVxdWlyZSgnLi9jYWNoZScpLFxuICAgICAgICBzdG9yZSA9IHJlcXVpcmUoJy4vc3RvcmUnKSxcbiAgICAgICAgZXh0ZW5kID0gcmVxdWlyZSgnZXh0ZW5kJyksXG4gICAgICAgIG1vZGVsRXZlbnRzID0gcmVxdWlyZSgnLi9tb2RlbEV2ZW50cycpLFxuICAgICAgICB3cmFwQXJyYXkgPSByZXF1aXJlKCcuL2V2ZW50cycpLndyYXBBcnJheSxcbiAgICAgICAgT25lVG9NYW55UHJveHkgPSByZXF1aXJlKCcuL09uZVRvTWFueVByb3h5JyksXG4gICAgICAgIE9uZVRvT25lUHJveHkgPSByZXF1aXJlKCcuL09uZVRvT25lUHJveHknKSxcbiAgICAgICAgTWFueVRvTWFueVByb3h5ID0gcmVxdWlyZSgnLi9NYW55VG9NYW55UHJveHknKSxcbiAgICAgICAgUmVhY3RpdmVRdWVyeSA9IHJlcXVpcmUoJy4vUmVhY3RpdmVRdWVyeScpLFxuICAgICAgICBBcnJhbmdlZFJlYWN0aXZlUXVlcnkgPSByZXF1aXJlKCcuL0FycmFuZ2VkUmVhY3RpdmVRdWVyeScpLFxuICAgICAgICBNb2RlbEV2ZW50VHlwZSA9IG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlO1xuXG4gICAgZnVuY3Rpb24gTW9kZWxJbnN0YW5jZUZhY3RvcnkobW9kZWwpIHtcbiAgICAgICAgdGhpcy5tb2RlbCA9IG1vZGVsO1xuICAgIH1cblxuICAgIE1vZGVsSW5zdGFuY2VGYWN0b3J5LnByb3RvdHlwZSA9IHtcbiAgICAgICAgX2dldExvY2FsSWQ6IGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgICAgICAgICB2YXIgX2lkO1xuICAgICAgICAgICAgaWYgKGRhdGEpIHtcbiAgICAgICAgICAgICAgICBfaWQgPSBkYXRhLl9pZCA/IGRhdGEuX2lkIDogZ3VpZCgpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBfaWQgPSBndWlkKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gX2lkO1xuICAgICAgICB9LFxuICAgICAgICAvKipcbiAgICAgICAgICogQ29uZmlndXJlIGF0dHJpYnV0ZXNcbiAgICAgICAgICogQHBhcmFtIG1vZGVsSW5zdGFuY2VcbiAgICAgICAgICogQHBhcmFtIGRhdGFcbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG5cbiAgICAgICAgX2luc3RhbGxBdHRyaWJ1dGVzOiBmdW5jdGlvbiAobW9kZWxJbnN0YW5jZSwgZGF0YSkge1xuICAgICAgICAgICAgdmFyIE1vZGVsID0gdGhpcy5tb2RlbCxcbiAgICAgICAgICAgICAgICBhdHRyaWJ1dGVOYW1lcyA9IE1vZGVsLl9hdHRyaWJ1dGVOYW1lcyxcbiAgICAgICAgICAgICAgICBpZHggPSBhdHRyaWJ1dGVOYW1lcy5pbmRleE9mKE1vZGVsLmlkKTtcbiAgICAgICAgICAgIF8uZXh0ZW5kKG1vZGVsSW5zdGFuY2UsIHtcbiAgICAgICAgICAgICAgICBfX3ZhbHVlczogXy5leHRlbmQoXy5yZWR1Y2UoTW9kZWwuYXR0cmlidXRlcywgZnVuY3Rpb24gKG0sIGEpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGEuZGVmYXVsdCAhPT0gdW5kZWZpbmVkKSBtW2EubmFtZV0gPSBhLmRlZmF1bHQ7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBtO1xuICAgICAgICAgICAgICAgIH0sIHt9KSwgZGF0YSB8fCB7fSlcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgaWYgKGlkeCA+IC0xKSBhdHRyaWJ1dGVOYW1lcy5zcGxpY2UoaWR4LCAxKTtcbiAgICAgICAgICAgIF8uZWFjaChhdHRyaWJ1dGVOYW1lcywgZnVuY3Rpb24gKGF0dHJpYnV0ZU5hbWUpIHtcbiAgICAgICAgICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkobW9kZWxJbnN0YW5jZSwgYXR0cmlidXRlTmFtZSwge1xuICAgICAgICAgICAgICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciB2YWx1ZSA9IG1vZGVsSW5zdGFuY2UuX192YWx1ZXNbYXR0cmlidXRlTmFtZV07XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdmFsdWUgPT09IHVuZGVmaW5lZCA/IG51bGwgOiB2YWx1ZTtcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgc2V0OiBmdW5jdGlvbiAodikge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG9sZCA9IG1vZGVsSW5zdGFuY2UuX192YWx1ZXNbYXR0cmlidXRlTmFtZV07XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgcHJvcGVydHlEZXBlbmRlbmNpZXMgPSB0aGlzLl9wcm9wZXJ0eURlcGVuZGVuY2llc1thdHRyaWJ1dGVOYW1lXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0eURlcGVuZGVuY2llcyA9IF8ubWFwKHByb3BlcnR5RGVwZW5kZW5jaWVzLCBmdW5jdGlvbiAoZGVwZW5kYW50KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcm9wOiBkZXBlbmRhbnQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbGQ6IHRoaXNbZGVwZW5kYW50XVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfS5iaW5kKHRoaXMpKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgbW9kZWxJbnN0YW5jZS5fX3ZhbHVlc1thdHRyaWJ1dGVOYW1lXSA9IHY7XG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0eURlcGVuZGVuY2llcy5mb3JFYWNoKGZ1bmN0aW9uIChkZXApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgcHJvcGVydHlOYW1lID0gZGVwLnByb3A7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG5ld18gPSB0aGlzW3Byb3BlcnR5TmFtZV07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbW9kZWxFdmVudHMuZW1pdCh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbGxlY3Rpb246IE1vZGVsLmNvbGxlY3Rpb25OYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtb2RlbDogTW9kZWwubmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgX2lkOiBtb2RlbEluc3RhbmNlLl9pZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV3OiBuZXdfLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbGQ6IGRlcC5vbGQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6IE1vZGVsRXZlbnRUeXBlLlNldCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZmllbGQ6IHByb3BlcnR5TmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb2JqOiBtb2RlbEluc3RhbmNlXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGUgPSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29sbGVjdGlvbjogTW9kZWwuY29sbGVjdGlvbk5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbW9kZWw6IE1vZGVsLm5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgX2lkOiBtb2RlbEluc3RhbmNlLl9pZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBuZXc6IHYsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb2xkOiBvbGQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogTW9kZWxFdmVudFR5cGUuU2V0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZpZWxkOiBhdHRyaWJ1dGVOYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9iajogbW9kZWxJbnN0YW5jZVxuICAgICAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHdpbmRvdy5sYXN0RW1pc3Npb24gPSBlO1xuICAgICAgICAgICAgICAgICAgICAgICAgbW9kZWxFdmVudHMuZW1pdChlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh1dGlsLmlzQXJyYXkodikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB3cmFwQXJyYXkodiwgYXR0cmlidXRlTmFtZSwgbW9kZWxJbnN0YW5jZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0sXG4gICAgICAgIF9pbnN0YWxsTWV0aG9kczogZnVuY3Rpb24gKG1vZGVsSW5zdGFuY2UpIHtcbiAgICAgICAgICAgIHZhciBNb2RlbCA9IHRoaXMubW9kZWw7XG4gICAgICAgICAgICBfLmVhY2goT2JqZWN0LmtleXMoTW9kZWwubWV0aG9kcyksIGZ1bmN0aW9uIChtZXRob2ROYW1lKSB7XG4gICAgICAgICAgICAgICAgaWYgKG1vZGVsSW5zdGFuY2VbbWV0aG9kTmFtZV0gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICBtb2RlbEluc3RhbmNlW21ldGhvZE5hbWVdID0gTW9kZWwubWV0aG9kc1ttZXRob2ROYW1lXS5iaW5kKG1vZGVsSW5zdGFuY2UpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nKCdBIG1ldGhvZCB3aXRoIG5hbWUgXCInICsgbWV0aG9kTmFtZSArICdcIiBhbHJlYWR5IGV4aXN0cy4gSWdub3JpbmcgaXQuJyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgICAgfSxcbiAgICAgICAgX2luc3RhbGxQcm9wZXJ0aWVzOiBmdW5jdGlvbiAobW9kZWxJbnN0YW5jZSkge1xuICAgICAgICAgICAgdmFyIF9wcm9wZXJ0eU5hbWVzID0gT2JqZWN0LmtleXModGhpcy5tb2RlbC5wcm9wZXJ0aWVzKSxcbiAgICAgICAgICAgICAgICBfcHJvcGVydHlEZXBlbmRlbmNpZXMgPSB7fTtcbiAgICAgICAgICAgIF8uZWFjaChfcHJvcGVydHlOYW1lcywgZnVuY3Rpb24gKHByb3BOYW1lKSB7XG4gICAgICAgICAgICAgICAgdmFyIHByb3BEZWYgPSB0aGlzLm1vZGVsLnByb3BlcnRpZXNbcHJvcE5hbWVdO1xuICAgICAgICAgICAgICAgIHZhciBkZXBlbmRlbmNpZXMgPSBwcm9wRGVmLmRlcGVuZGVuY2llcyB8fCBbXTtcbiAgICAgICAgICAgICAgICBkZXBlbmRlbmNpZXMuZm9yRWFjaChmdW5jdGlvbiAoYXR0cikge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIV9wcm9wZXJ0eURlcGVuZGVuY2llc1thdHRyXSkgX3Byb3BlcnR5RGVwZW5kZW5jaWVzW2F0dHJdID0gW107XG4gICAgICAgICAgICAgICAgICAgIF9wcm9wZXJ0eURlcGVuZGVuY2llc1thdHRyXS5wdXNoKHByb3BOYW1lKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBkZWxldGUgcHJvcERlZi5kZXBlbmRlbmNpZXM7XG4gICAgICAgICAgICAgICAgaWYgKG1vZGVsSW5zdGFuY2VbcHJvcE5hbWVdID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG1vZGVsSW5zdGFuY2UsIHByb3BOYW1lLCBwcm9wRGVmKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZygnQSBwcm9wZXJ0eS9tZXRob2Qgd2l0aCBuYW1lIFwiJyArIHByb3BOYW1lICsgJ1wiIGFscmVhZHkgZXhpc3RzLiBJZ25vcmluZyBpdC4nKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LmJpbmQodGhpcykpO1xuXG4gICAgICAgICAgICBtb2RlbEluc3RhbmNlLl9wcm9wZXJ0eURlcGVuZGVuY2llcyA9IF9wcm9wZXJ0eURlcGVuZGVuY2llcztcbiAgICAgICAgfSxcbiAgICAgICAgX2luc3RhbGxSZW1vdGVJZDogZnVuY3Rpb24gKG1vZGVsSW5zdGFuY2UpIHtcbiAgICAgICAgICAgIHZhciBNb2RlbCA9IHRoaXMubW9kZWw7XG4gICAgICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkobW9kZWxJbnN0YW5jZSwgdGhpcy5tb2RlbC5pZCwge1xuICAgICAgICAgICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbW9kZWxJbnN0YW5jZS5fX3ZhbHVlc1tNb2RlbC5pZF0gfHwgbnVsbDtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHNldDogZnVuY3Rpb24gKHYpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIG9sZCA9IG1vZGVsSW5zdGFuY2VbTW9kZWwuaWRdO1xuICAgICAgICAgICAgICAgICAgICBtb2RlbEluc3RhbmNlLl9fdmFsdWVzW01vZGVsLmlkXSA9IHY7XG4gICAgICAgICAgICAgICAgICAgIG1vZGVsRXZlbnRzLmVtaXQoe1xuICAgICAgICAgICAgICAgICAgICAgICAgY29sbGVjdGlvbjogTW9kZWwuY29sbGVjdGlvbk5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBtb2RlbDogTW9kZWwubmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIF9pZDogbW9kZWxJbnN0YW5jZS5faWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBuZXc6IHYsXG4gICAgICAgICAgICAgICAgICAgICAgICBvbGQ6IG9sZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6IE1vZGVsRXZlbnRUeXBlLlNldCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGZpZWxkOiBNb2RlbC5pZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIG9iajogbW9kZWxJbnN0YW5jZVxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgY2FjaGUucmVtb3RlSW5zZXJ0KG1vZGVsSW5zdGFuY2UsIHYsIG9sZCk7XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0sXG4gICAgICAgIF9pbnN0YWxsUmVsYXRpb25zaGlwczogZnVuY3Rpb24gKG1vZGVsSW5zdGFuY2UpIHtcbiAgICAgICAgICAgIHZhciBtb2RlbCA9IHRoaXMubW9kZWw7XG4gICAgICAgICAgICBmb3IgKHZhciBuYW1lIGluIG1vZGVsLnJlbGF0aW9uc2hpcHMpIHtcbiAgICAgICAgICAgICAgICB2YXIgcHJveHk7XG4gICAgICAgICAgICAgICAgaWYgKG1vZGVsLnJlbGF0aW9uc2hpcHMuaGFzT3duUHJvcGVydHkobmFtZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHJlbGF0aW9uc2hpcE9wdHMgPSBfLmV4dGVuZCh7fSwgbW9kZWwucmVsYXRpb25zaGlwc1tuYW1lXSksXG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlID0gcmVsYXRpb25zaGlwT3B0cy50eXBlO1xuICAgICAgICAgICAgICAgICAgICBkZWxldGUgcmVsYXRpb25zaGlwT3B0cy50eXBlO1xuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZSA9PSBSZWxhdGlvbnNoaXBUeXBlLk9uZVRvTWFueSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcHJveHkgPSBuZXcgT25lVG9NYW55UHJveHkocmVsYXRpb25zaGlwT3B0cyk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAodHlwZSA9PSBSZWxhdGlvbnNoaXBUeXBlLk9uZVRvT25lKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwcm94eSA9IG5ldyBPbmVUb09uZVByb3h5KHJlbGF0aW9uc2hpcE9wdHMpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHR5cGUgPT0gUmVsYXRpb25zaGlwVHlwZS5NYW55VG9NYW55KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwcm94eSA9IG5ldyBNYW55VG9NYW55UHJveHkocmVsYXRpb25zaGlwT3B0cyk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignTm8gc3VjaCByZWxhdGlvbnNoaXAgdHlwZTogJyArIHR5cGUpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHByb3h5Lmluc3RhbGwobW9kZWxJbnN0YW5jZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIF9yZWdpc3Rlckluc3RhbmNlOiBmdW5jdGlvbiAobW9kZWxJbnN0YW5jZSwgc2hvdWxkUmVnaXN0ZXJDaGFuZ2UpIHtcbiAgICAgICAgICAgIGNhY2hlLmluc2VydChtb2RlbEluc3RhbmNlKTtcbiAgICAgICAgICAgIHNob3VsZFJlZ2lzdGVyQ2hhbmdlID0gc2hvdWxkUmVnaXN0ZXJDaGFuZ2UgPT09IHVuZGVmaW5lZCA/IHRydWUgOiBzaG91bGRSZWdpc3RlckNoYW5nZTtcbiAgICAgICAgICAgIGlmIChzaG91bGRSZWdpc3RlckNoYW5nZSkge1xuICAgICAgICAgICAgICAgIG1vZGVsRXZlbnRzLmVtaXQoe1xuICAgICAgICAgICAgICAgICAgICBjb2xsZWN0aW9uOiB0aGlzLm1vZGVsLmNvbGxlY3Rpb25OYW1lLFxuICAgICAgICAgICAgICAgICAgICBtb2RlbDogdGhpcy5tb2RlbC5uYW1lLFxuICAgICAgICAgICAgICAgICAgICBfaWQ6IG1vZGVsSW5zdGFuY2UuX2lkLFxuICAgICAgICAgICAgICAgICAgICBuZXc6IG1vZGVsSW5zdGFuY2UsXG4gICAgICAgICAgICAgICAgICAgIHR5cGU6IE1vZGVsRXZlbnRUeXBlLk5ldyxcbiAgICAgICAgICAgICAgICAgICAgb2JqOiBtb2RlbEluc3RhbmNlXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIF9pbnN0YWxsTG9jYWxJZDogZnVuY3Rpb24gKG1vZGVsSW5zdGFuY2UsIGRhdGEpIHtcbiAgICAgICAgICAgIG1vZGVsSW5zdGFuY2UuX2lkID0gdGhpcy5fZ2V0TG9jYWxJZChkYXRhKTtcbiAgICAgICAgfSxcbiAgICAgICAgLyoqXG4gICAgICAgICAqIENvbnZlcnQgcmF3IGRhdGEgaW50byBhIE1vZGVsSW5zdGFuY2VcbiAgICAgICAgICogQHJldHVybnMge01vZGVsSW5zdGFuY2V9XG4gICAgICAgICAqL1xuICAgICAgICBfaW5zdGFuY2U6IGZ1bmN0aW9uIChkYXRhLCBzaG91bGRSZWdpc3RlckNoYW5nZSkge1xuICAgICAgICAgICAgaWYgKHRoaXMubW9kZWwuaW5zdGFsbGVkKSB7XG4gICAgICAgICAgICAgICAgdmFyIG1vZGVsSW5zdGFuY2UgPSBuZXcgTW9kZWxJbnN0YW5jZSh0aGlzLm1vZGVsKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9pbnN0YWxsTG9jYWxJZChtb2RlbEluc3RhbmNlLCBkYXRhKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9pbnN0YWxsQXR0cmlidXRlcyhtb2RlbEluc3RhbmNlLCBkYXRhKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9pbnN0YWxsTWV0aG9kcyhtb2RlbEluc3RhbmNlKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9pbnN0YWxsUHJvcGVydGllcyhtb2RlbEluc3RhbmNlKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9pbnN0YWxsUmVtb3RlSWQobW9kZWxJbnN0YW5jZSk7XG4gICAgICAgICAgICAgICAgdGhpcy5faW5zdGFsbFJlbGF0aW9uc2hpcHMobW9kZWxJbnN0YW5jZSk7XG4gICAgICAgICAgICAgICAgdGhpcy5fcmVnaXN0ZXJJbnN0YW5jZShtb2RlbEluc3RhbmNlLCBzaG91bGRSZWdpc3RlckNoYW5nZSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG1vZGVsSW5zdGFuY2U7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdNb2RlbCBtdXN0IGJlIGZ1bGx5IGluc3RhbGxlZCBiZWZvcmUgY3JlYXRpbmcgYW55IG1vZGVscycpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfTtcblxuICAgIG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKG1vZGVsKSB7XG4gICAgICAgIHZhciBmYWN0b3J5ID0gbmV3IE1vZGVsSW5zdGFuY2VGYWN0b3J5KG1vZGVsKTtcbiAgICAgICAgcmV0dXJuIGZhY3RvcnkuX2luc3RhbmNlLmJpbmQoZmFjdG9yeSk7XG4gICAgfVxufSkoKTsiLCIoZnVuY3Rpb24gKCkge1xuICAgIC8qKlxuICAgICAqIERlYWQgc2ltcGxlIGxvZ2dpbmcgc2VydmljZSBiYXNlZCBvbiB2aXNpb25tZWRpYS9kZWJ1Z1xuICAgICAqIEBtb2R1bGUgbG9nXG4gICAgICovXG5cbiAgICB2YXIgZGVidWcgPSByZXF1aXJlKCdkZWJ1ZycpLFxuICAgICAgICBhcmdzYXJyYXkgPSByZXF1aXJlKCdhcmdzYXJyYXknKTtcblxuICAgIG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKG5hbWUpIHtcbiAgICAgICAgdmFyIGxvZyA9IGRlYnVnKCdzaWVzdGE6JyArIG5hbWUpO1xuICAgICAgICB2YXIgZm4gPSBhcmdzYXJyYXkoZnVuY3Rpb24gKGFyZ3MpIHtcbiAgICAgICAgICAgIGxvZy5jYWxsKGxvZywgYXJncyk7XG4gICAgICAgIH0pO1xuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoZm4sICdlbmFibGVkJywge1xuICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGRlYnVnLmVuYWJsZWQobmFtZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gZm47XG4gICAgfTtcbn0pKCk7IiwiKGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgU3RvcmUgPSByZXF1aXJlKCcuL3N0b3JlJyksXG4gICAgICAgIFNpZXN0YU1vZGVsID0gcmVxdWlyZSgnLi9Nb2RlbEluc3RhbmNlJyksXG4gICAgICAgIGxvZyA9IHJlcXVpcmUoJy4vbG9nJykoJ21hcHBpbmcnKSxcbiAgICAgICAgY2FjaGUgPSByZXF1aXJlKCcuL2NhY2hlJyksXG4gICAgICAgIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKSxcbiAgICAgICAgXyA9IHV0aWwuXyxcbiAgICAgICAgYXN5bmMgPSB1dGlsLmFzeW5jO1xuXG4gICAgZnVuY3Rpb24gU2llc3RhRXJyb3Iob3B0cykge1xuICAgICAgICB0aGlzLm9wdHMgPSBvcHRzO1xuICAgIH1cbiAgICBTaWVzdGFFcnJvci5wcm90b3R5cGUudG9TdHJpbmcgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh0aGlzLm9wdHMsIG51bGwsIDQpO1xuICAgIH07XG5cblxuICAgIC8qKlxuICAgICAqIEVuY2Fwc3VsYXRlcyB0aGUgaWRlYSBvZiBtYXBwaW5nIGFycmF5cyBvZiBkYXRhIG9udG8gdGhlIG9iamVjdCBncmFwaCBvciBhcnJheXMgb2Ygb2JqZWN0cy5cbiAgICAgKiBAcGFyYW0ge09iamVjdH0gb3B0c1xuICAgICAqIEBwYXJhbSBvcHRzLm1vZGVsXG4gICAgICogQHBhcmFtIG9wdHMuZGF0YSNcbiAgICAgKiBAcGFyYW0gb3B0cy5vYmplY3RzXG4gICAgICogQHBhcmFtIG9wdHMuZGlzYWJsZU5vdGlmaWNhdGlvbnNcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBNYXBwaW5nT3BlcmF0aW9uKG9wdHMpIHtcbiAgICAgICAgdGhpcy5fb3B0cyA9IG9wdHM7XG5cbiAgICAgICAgdXRpbC5leHRlbmRGcm9tT3B0cyh0aGlzLCBvcHRzLCB7XG4gICAgICAgICAgICBtb2RlbDogbnVsbCxcbiAgICAgICAgICAgIGRhdGE6IG51bGwsXG4gICAgICAgICAgICBvYmplY3RzOiBbXSxcbiAgICAgICAgICAgIGRpc2FibGVldmVudHM6IGZhbHNlLFxuICAgICAgICAgICAgX2lnbm9yZUluc3RhbGxlZDogZmFsc2UsXG4gICAgICAgICAgICBmcm9tU3RvcmFnZTogZmFsc2VcbiAgICAgICAgfSk7XG5cbiAgICAgICAgXy5leHRlbmQodGhpcywge1xuICAgICAgICAgICAgZXJyb3JzOiBbXSxcbiAgICAgICAgICAgIHN1YlRhc2tSZXN1bHRzOiB7fSxcbiAgICAgICAgICAgIF9uZXdPYmplY3RzOiBbXVxuICAgICAgICB9KTtcbiAgICB9XG5cblxuICAgIF8uZXh0ZW5kKE1hcHBpbmdPcGVyYXRpb24ucHJvdG90eXBlLCB7XG4gICAgICAgIG1hcEF0dHJpYnV0ZXM6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5kYXRhLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgdmFyIGRhdHVtID0gdGhpcy5kYXRhW2ldO1xuICAgICAgICAgICAgICAgIHZhciBvYmplY3QgPSB0aGlzLm9iamVjdHNbaV07XG4gICAgICAgICAgICAgICAgLy8gTm8gcG9pbnQgbWFwcGluZyBvYmplY3Qgb250byBpdHNlbGYuIFRoaXMgaGFwcGVucyBpZiBhIE1vZGVsSW5zdGFuY2UgaXMgcGFzc2VkIGFzIGEgcmVsYXRpb25zaGlwLlxuICAgICAgICAgICAgICAgIGlmIChkYXR1bSAhPSBvYmplY3QpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG9iamVjdCkgeyAvLyBJZiBvYmplY3QgaXMgZmFsc3ksIHRoZW4gdGhlcmUgd2FzIGFuIGVycm9yIGxvb2tpbmcgdXAgdGhhdCBvYmplY3QvY3JlYXRpbmcgaXQuXG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgZmllbGRzID0gdGhpcy5tb2RlbC5fYXR0cmlidXRlTmFtZXM7XG4gICAgICAgICAgICAgICAgICAgICAgICBfLmVhY2goZmllbGRzLCBmdW5jdGlvbiAoZikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChkYXR1bVtmXSAhPT0gdW5kZWZpbmVkKSB7IC8vIG51bGwgaXMgZmluZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBJZiBldmVudHMgYXJlIGRpc2FibGVkIHdlIHVwZGF0ZSBfX3ZhbHVlcyBvYmplY3QgZGlyZWN0bHkuIFRoaXMgYXZvaWRzIHRyaWdnZXJpbmdcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gZXZlbnRzIHdoaWNoIGFyZSBidWlsdCBpbnRvIHRoZSBzZXQgZnVuY3Rpb24gb2YgdGhlIHByb3BlcnR5LlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5kaXNhYmxlZXZlbnRzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvYmplY3QuX192YWx1ZXNbZl0gPSBkYXR1bVtmXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9iamVjdFtmXSA9IGRhdHVtW2ZdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIFBvdWNoREIgcmV2aXNpb24gKGlmIHVzaW5nIHN0b3JhZ2UgbW9kdWxlKS5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIFRPRE86IENhbiB0aGlzIGJlIHB1bGxlZCBvdXQgb2YgY29yZT9cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChkYXR1bS5fcmV2KSBvYmplY3QuX3JldiA9IGRhdHVtLl9yZXY7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIF9tYXA6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgICAgIHZhciBlcnI7XG4gICAgICAgICAgICB0aGlzLm1hcEF0dHJpYnV0ZXMoKTtcbiAgICAgICAgICAgIHZhciByZWxhdGlvbnNoaXBGaWVsZHMgPSBfLmtleXMoc2VsZi5zdWJUYXNrUmVzdWx0cyk7XG4gICAgICAgICAgICBfLmVhY2gocmVsYXRpb25zaGlwRmllbGRzLCBmdW5jdGlvbiAoZikge1xuICAgICAgICAgICAgICAgIHZhciByZXMgPSBzZWxmLnN1YlRhc2tSZXN1bHRzW2ZdO1xuICAgICAgICAgICAgICAgIHZhciBpbmRleGVzID0gcmVzLmluZGV4ZXMsXG4gICAgICAgICAgICAgICAgICAgIG9iamVjdHMgPSByZXMub2JqZWN0cztcbiAgICAgICAgICAgICAgICB2YXIgcmVsYXRlZERhdGEgPSBzZWxmLmdldFJlbGF0ZWREYXRhKGYpLnJlbGF0ZWREYXRhO1xuICAgICAgICAgICAgICAgIHZhciB1bmZsYXR0ZW5lZE9iamVjdHMgPSB1dGlsLnVuZmxhdHRlbkFycmF5KG9iamVjdHMsIHJlbGF0ZWREYXRhKTtcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHVuZmxhdHRlbmVkT2JqZWN0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICB2YXIgaWR4ID0gaW5kZXhlc1tpXTtcbiAgICAgICAgICAgICAgICAgICAgLy8gRXJyb3JzIGFyZSBwbHVja2VkIGZyb20gdGhlIHN1Ym9wZXJhdGlvbnMuXG4gICAgICAgICAgICAgICAgICAgIHZhciBlcnJvciA9IHNlbGYuZXJyb3JzW2lkeF07XG4gICAgICAgICAgICAgICAgICAgIGVyciA9IGVycm9yID8gZXJyb3JbZl0gOiBudWxsO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHJlbGF0ZWQgPSB1bmZsYXR0ZW5lZE9iamVjdHNbaV07IC8vIENhbiBiZSBhcnJheSBvciBzY2FsYXIuXG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgb2JqZWN0ID0gc2VsZi5vYmplY3RzW2lkeF07XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAob2JqZWN0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZXJyID0gb2JqZWN0Ll9fcHJveGllc1tmXS5zZXQocmVsYXRlZCwge2Rpc2FibGVldmVudHM6IHNlbGYuZGlzYWJsZWV2ZW50c30pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFzZWxmLmVycm9yc1tpZHhdKSBzZWxmLmVycm9yc1tpZHhdID0ge307XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYuZXJyb3JzW2lkeF1bZl0gPSBlcnI7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0sXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBGb3IgaW5kaWNlcyB3aGVyZSBubyBvYmplY3QgaXMgcHJlc2VudCwgcGVyZm9ybSBsb29rdXBzLCBjcmVhdGluZyBhIG5ldyBvYmplY3QgaWYgbmVjZXNzYXJ5LlxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgX2xvb2t1cDogZnVuY3Rpb24gKGNiKSB7XG4gICAgICAgICAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbiAoY2IpIHtcbiAgICAgICAgICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgICAgICAgICAgdmFyIHJlbW90ZUxvb2t1cHMgPSBbXTtcbiAgICAgICAgICAgICAgICB2YXIgbG9jYWxMb29rdXBzID0gW107XG4gICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLmRhdGEubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCF0aGlzLm9iamVjdHNbaV0pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBsb29rdXA7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgZGF0dW0gPSB0aGlzLmRhdGFbaV07XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgaXNTY2FsYXIgPSB0eXBlb2YgZGF0dW0gPT0gJ3N0cmluZycgfHwgdHlwZW9mIGRhdHVtID09ICdudW1iZXInIHx8IGRhdHVtIGluc3RhbmNlb2YgU3RyaW5nO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGRhdHVtKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGlzU2NhbGFyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvb2t1cCA9IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGluZGV4OiBpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0dW06IHt9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvb2t1cC5kYXR1bVtzZWxmLm1vZGVsLmlkXSA9IGRhdHVtO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZW1vdGVMb29rdXBzLnB1c2gobG9va3VwKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGRhdHVtIGluc3RhbmNlb2YgU2llc3RhTW9kZWwpIHsgLy8gV2Ugd29uJ3QgbmVlZCB0byBwZXJmb3JtIGFueSBtYXBwaW5nLlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLm9iamVjdHNbaV0gPSBkYXR1bTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGRhdHVtLl9pZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2NhbExvb2t1cHMucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbmRleDogaSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdHVtOiBkYXR1bVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGRhdHVtW3NlbGYubW9kZWwuaWRdKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlbW90ZUxvb2t1cHMucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbmRleDogaSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdHVtOiBkYXR1bVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLm9iamVjdHNbaV0gPSBzZWxmLl9pbnN0YW5jZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5vYmplY3RzW2ldID0gbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB1dGlsLmFzeW5jLnBhcmFsbGVsKFtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZ1bmN0aW9uIChkb25lKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGxvY2FsSWRlbnRpZmllcnMgPSBfLnBsdWNrKF8ucGx1Y2sobG9jYWxMb29rdXBzLCAnZGF0dW0nKSwgJ19pZCcpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChsb2NhbElkZW50aWZpZXJzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBTdG9yZS5nZXRNdWx0aXBsZUxvY2FsKGxvY2FsSWRlbnRpZmllcnMsIGZ1bmN0aW9uIChlcnIsIG9iamVjdHMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsb2NhbElkZW50aWZpZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBvYmogPSBvYmplY3RzW2ldO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgX2lkID0gbG9jYWxJZGVudGlmaWVyc1tpXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGxvb2t1cCA9IGxvY2FsTG9va3Vwc1tpXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFvYmopIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIElmIHRoZXJlIGFyZSBtdWx0aXBsZSBtYXBwaW5nIG9wZXJhdGlvbnMgZ29pbmcgb24sIHRoZXJlIG1heSBiZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb2JqID0gY2FjaGUuZ2V0KHtfaWQ6IF9pZH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFvYmopXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb2JqID0gc2VsZi5faW5zdGFuY2Uoe19pZDogX2lkfSwgIXNlbGYuZGlzYWJsZWV2ZW50cyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZWxmLm9iamVjdHNbbG9va3VwLmluZGV4XSA9IG9iajtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYub2JqZWN0c1tsb29rdXAuaW5kZXhdID0gb2JqO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZG9uZShlcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkb25lKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGZ1bmN0aW9uIChkb25lKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHJlbW90ZUlkZW50aWZpZXJzID0gXy5wbHVjayhfLnBsdWNrKHJlbW90ZUxvb2t1cHMsICdkYXR1bScpLCBzZWxmLm1vZGVsLmlkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAocmVtb3RlSWRlbnRpZmllcnMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZygnTG9va2luZyB1cCByZW1vdGVJZGVudGlmaWVyczogJyArIHV0aWwucHJldHR5UHJpbnQocmVtb3RlSWRlbnRpZmllcnMpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgU3RvcmUuZ2V0TXVsdGlwbGVSZW1vdGUocmVtb3RlSWRlbnRpZmllcnMsIHNlbGYubW9kZWwsIGZ1bmN0aW9uIChlcnIsIG9iamVjdHMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGxvZy5lbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciByZXN1bHRzID0ge307XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCBvYmplY3RzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXN1bHRzW3JlbW90ZUlkZW50aWZpZXJzW2ldXSA9IG9iamVjdHNbaV0gPyBvYmplY3RzW2ldLl9pZCA6IG51bGw7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nKCdSZXN1bHRzIGZvciByZW1vdGVJZGVudGlmaWVyczogJyArIHV0aWwucHJldHR5UHJpbnQocmVzdWx0cykpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgb2JqZWN0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgb2JqID0gb2JqZWN0c1tpXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGxvb2t1cCA9IHJlbW90ZUxvb2t1cHNbaV07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChvYmopIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYub2JqZWN0c1tsb29rdXAuaW5kZXhdID0gb2JqO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGRhdGEgPSB7fTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciByZW1vdGVJZCA9IHJlbW90ZUlkZW50aWZpZXJzW2ldO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0YVtzZWxmLm1vZGVsLmlkXSA9IHJlbW90ZUlkO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGNhY2hlUXVlcnkgPSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbW9kZWw6IHNlbGYubW9kZWxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYWNoZVF1ZXJ5W3NlbGYubW9kZWwuaWRdID0gcmVtb3RlSWQ7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgY2FjaGVkID0gY2FjaGUuZ2V0KGNhY2hlUXVlcnkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGNhY2hlZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYub2JqZWN0c1tsb29rdXAuaW5kZXhdID0gY2FjaGVkO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZWxmLm9iamVjdHNbbG9va3VwLmluZGV4XSA9IHNlbGYuX2luc3RhbmNlKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gSXQncyBpbXBvcnRhbnQgdGhhdCB3ZSBtYXAgdGhlIHJlbW90ZSBpZGVudGlmaWVyIGhlcmUgdG8gZW5zdXJlIHRoYXQgaXQgZW5kc1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHVwIGluIHRoZSBjYWNoZS5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZWxmLm9iamVjdHNbbG9va3VwLmluZGV4XVtzZWxmLm1vZGVsLmlkXSA9IHJlbW90ZUlkO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZG9uZShlcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkb25lKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICAgICAgICBjYik7XG4gICAgICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICB9LFxuICAgICAgICBfbG9va3VwU2luZ2xldG9uOiBmdW5jdGlvbiAoY2IpIHtcbiAgICAgICAgICAgIHJldHVybiB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uIChjYikge1xuICAgICAgICAgICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgICAgICAgICAvLyBQaWNrIGEgcmFuZG9tIF9pZCBmcm9tIHRoZSBhcnJheSBvZiBkYXRhIGJlaW5nIG1hcHBlZCBvbnRvIHRoZSBzaW5nbGV0b24gb2JqZWN0LiBOb3RlIHRoYXQgdGhleSBzaG91bGRcbiAgICAgICAgICAgICAgICAvLyBhbHdheXMgYmUgdGhlIHNhbWUuIFRoaXMgaXMganVzdCBhIHByZWNhdXRpb24uXG4gICAgICAgICAgICAgICAgdmFyIF9pZHMgPSBfLnBsdWNrKHNlbGYuZGF0YSwgJ19pZCcpLFxuICAgICAgICAgICAgICAgICAgICBfaWQ7XG4gICAgICAgICAgICAgICAgZm9yIChpID0gMDsgaSA8IF9pZHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKF9pZHNbaV0pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIF9pZCA9IHtfaWQ6IF9pZHNbaV19O1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy8gVGhlIG1hcHBpbmcgb3BlcmF0aW9uIGlzIHJlc3BvbnNpYmxlIGZvciBjcmVhdGluZyBzaW5nbGV0b24gaW5zdGFuY2VzIGlmIHRoZXkgZG8gbm90IGFscmVhZHkgZXhpc3QuXG4gICAgICAgICAgICAgICAgdmFyIHNpbmdsZXRvbiA9IGNhY2hlLmdldFNpbmdsZXRvbih0aGlzLm1vZGVsKSB8fCB0aGlzLl9pbnN0YW5jZShfaWQpO1xuICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc2VsZi5kYXRhLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIHNlbGYub2JqZWN0c1tpXSA9IHNpbmdsZXRvbjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY2IoKTtcbiAgICAgICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICAgIH0sXG4gICAgICAgIF9pbnN0YW5jZTogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdmFyIG1vZGVsID0gdGhpcy5tb2RlbCxcbiAgICAgICAgICAgICAgICBtb2RlbEluc3RhbmNlID0gbW9kZWwuX2luc3RhbmNlLmFwcGx5KG1vZGVsLCBhcmd1bWVudHMpO1xuICAgICAgICAgICAgdGhpcy5fbmV3T2JqZWN0cy5wdXNoKG1vZGVsSW5zdGFuY2UpO1xuICAgICAgICAgICAgcmV0dXJuIG1vZGVsSW5zdGFuY2U7XG4gICAgICAgIH0sXG4gICAgICAgIHN0YXJ0OiBmdW5jdGlvbiAoZG9uZSkge1xuICAgICAgICAgICAgaWYgKHRoaXMuZGF0YS5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgICAgICAgICAgdmFyIHRhc2tzID0gW107XG4gICAgICAgICAgICAgICAgdmFyIGxvb2t1cEZ1bmMgPSB0aGlzLm1vZGVsLnNpbmdsZXRvbiA/IHRoaXMuX2xvb2t1cFNpbmdsZXRvbiA6IHRoaXMuX2xvb2t1cDtcbiAgICAgICAgICAgICAgICB0YXNrcy5wdXNoKF8uYmluZChsb29rdXBGdW5jLCB0aGlzKSk7XG4gICAgICAgICAgICAgICAgdGFza3MucHVzaChfLmJpbmQodGhpcy5fZXhlY3V0ZVN1Yk9wZXJhdGlvbnMsIHRoaXMpKTtcbiAgICAgICAgICAgICAgICB1dGlsLmFzeW5jLnBhcmFsbGVsKHRhc2tzLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzZWxmLl9tYXAoKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gVXNlcnMgYXJlIGFsbG93ZWQgdG8gYWRkIGEgY3VzdG9tIGluaXQgbWV0aG9kIHRvIHRoZSBtZXRob2RzIG9iamVjdCB3aGVuIGRlZmluaW5nIGEgTW9kZWwsIG9mIHRoZSBmb3JtOlxuICAgICAgICAgICAgICAgICAgICAgICAgLy9cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBpbml0OiBmdW5jdGlvbiAoW2RvbmVdKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyAgICAgLy8gLi4uXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgLy9cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBJZiBkb25lIGlzIHBhc3NlZCwgdGhlbiBfX2luaXQgbXVzdCBiZSBleGVjdXRlZCBhc3luY2hyb25vdXNseSwgYW5kIHRoZSBtYXBwaW5nIG9wZXJhdGlvbiB3aWxsIG5vdFxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gZmluaXNoIHVudGlsIGFsbCBpbml0cyBoYXZlIGV4ZWN1dGVkLlxuICAgICAgICAgICAgICAgICAgICAgICAgLy9cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIEhlcmUgd2UgZW5zdXJlIHRoZSBleGVjdXRpb24gb2YgYWxsIG9mIHRoZW1cbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBmcm9tU3RvcmFnZSA9IHRoaXMuZnJvbVN0b3JhZ2U7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgaW5pdFRhc2tzID0gXy5yZWR1Y2Uoc2VsZi5fbmV3T2JqZWN0cywgZnVuY3Rpb24gKG0sIG8pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgaW5pdCA9IG8ubW9kZWwuaW5pdDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoaW5pdCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgcGFyYW1OYW1lcyA9IHV0aWwucGFyYW1OYW1lcyhpbml0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHBhcmFtTmFtZXMubGVuZ3RoID4gMSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbS5wdXNoKF8uYmluZChpbml0LCBvLCBmcm9tU3RvcmFnZSwgZG9uZSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaW5pdC5jYWxsKG8sIGZyb21TdG9yYWdlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gbTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sIFtdKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFzeW5jLnBhcmFsbGVsKGluaXRUYXNrcywgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRvbmUoc2VsZi5lcnJvcnMubGVuZ3RoID8gc2VsZi5lcnJvcnMgOiBudWxsLCBzZWxmLm9iamVjdHMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1VuY2F1Z2h0IGVycm9yIHdoZW4gZXhlY3V0aW5nIGluaXQgZnVuY2l0b25zIG9uIG1vZGVscy4nLCBlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRvbmUoZSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBkb25lKG51bGwsIFtdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgZ2V0UmVsYXRlZERhdGE6IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgICAgICAgICB2YXIgaW5kZXhlcyA9IFtdO1xuICAgICAgICAgICAgdmFyIHJlbGF0ZWREYXRhID0gW107XG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMuZGF0YS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIHZhciBkYXR1bSA9IHRoaXMuZGF0YVtpXTtcbiAgICAgICAgICAgICAgICBpZiAoZGF0dW0pIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGRhdHVtW25hbWVdKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpbmRleGVzLnB1c2goaSk7XG4gICAgICAgICAgICAgICAgICAgICAgICByZWxhdGVkRGF0YS5wdXNoKGRhdHVtW25hbWVdKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgaW5kZXhlczogaW5kZXhlcyxcbiAgICAgICAgICAgICAgICByZWxhdGVkRGF0YTogcmVsYXRlZERhdGFcbiAgICAgICAgICAgIH07XG4gICAgICAgIH0sXG4gICAgICAgIHByb2Nlc3NFcnJvcnNGcm9tVGFzazogZnVuY3Rpb24gKHJlbGF0aW9uc2hpcE5hbWUsIGVycm9ycywgaW5kZXhlcykge1xuICAgICAgICAgICAgaWYgKGVycm9ycy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICB2YXIgcmVsYXRlZERhdGEgPSB0aGlzLmdldFJlbGF0ZWREYXRhKHJlbGF0aW9uc2hpcE5hbWUpLnJlbGF0ZWREYXRhO1xuICAgICAgICAgICAgICAgIHZhciB1bmZsYXR0ZW5lZEVycm9ycyA9IHV0aWwudW5mbGF0dGVuQXJyYXkoZXJyb3JzLCByZWxhdGVkRGF0YSk7XG4gICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB1bmZsYXR0ZW5lZEVycm9ycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICB2YXIgaWR4ID0gaW5kZXhlc1tpXTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGVyciA9IHVuZmxhdHRlbmVkRXJyb3JzW2ldO1xuICAgICAgICAgICAgICAgICAgICB2YXIgaXNFcnJvciA9IGVycjtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHV0aWwuaXNBcnJheShlcnIpKSBpc0Vycm9yID0gXy5yZWR1Y2UoZXJyLCBmdW5jdGlvbiAobWVtbywgeCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG1lbW8gfHwgeFxuICAgICAgICAgICAgICAgICAgICB9LCBmYWxzZSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChpc0Vycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIXRoaXMuZXJyb3JzW2lkeF0pIHRoaXMuZXJyb3JzW2lkeF0gPSB7fTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZXJyb3JzW2lkeF1bcmVsYXRpb25zaGlwTmFtZV0gPSBlcnI7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIF9leGVjdXRlU3ViT3BlcmF0aW9uczogZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgICAgICAgICB2YXIgc2VsZiA9IHRoaXMsXG4gICAgICAgICAgICAgICAgcmVsYXRpb25zaGlwTmFtZXMgPSBfLmtleXModGhpcy5tb2RlbC5yZWxhdGlvbnNoaXBzKTtcbiAgICAgICAgICAgIGlmIChyZWxhdGlvbnNoaXBOYW1lcy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICB2YXIgdGFza3MgPSBfLnJlZHVjZShyZWxhdGlvbnNoaXBOYW1lcywgZnVuY3Rpb24gKG0sIHJlbGF0aW9uc2hpcE5hbWUpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHJlbGF0aW9uc2hpcCA9IHNlbGYubW9kZWwucmVsYXRpb25zaGlwc1tyZWxhdGlvbnNoaXBOYW1lXSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldmVyc2VNb2RlbCA9IHJlbGF0aW9uc2hpcC5mb3J3YXJkTmFtZSA9PSByZWxhdGlvbnNoaXBOYW1lID8gcmVsYXRpb25zaGlwLnJldmVyc2VNb2RlbCA6IHJlbGF0aW9uc2hpcC5mb3J3YXJkTW9kZWw7XG4gICAgICAgICAgICAgICAgICAgIC8vIE1vY2sgYW55IG1pc3Npbmcgc2luZ2xldG9uIGRhdGEgdG8gZW5zdXJlIHRoYXQgYWxsIHNpbmdsZXRvbiBpbnN0YW5jZXMgYXJlIGNyZWF0ZWQuXG4gICAgICAgICAgICAgICAgICAgIGlmIChyZXZlcnNlTW9kZWwuc2luZ2xldG9uICYmICFyZWxhdGlvbnNoaXAuaXNSZXZlcnNlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRhdGEuZm9yRWFjaChmdW5jdGlvbiAoZGF0dW0pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWRhdHVtW3JlbGF0aW9uc2hpcE5hbWVdKSBkYXR1bVtyZWxhdGlvbnNoaXBOYW1lXSA9IHt9O1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgdmFyIF9fcmV0ID0gdGhpcy5nZXRSZWxhdGVkRGF0YShyZWxhdGlvbnNoaXBOYW1lKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGluZGV4ZXMgPSBfX3JldC5pbmRleGVzLFxuICAgICAgICAgICAgICAgICAgICAgICAgcmVsYXRlZERhdGEgPSBfX3JldC5yZWxhdGVkRGF0YTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHJlbGF0ZWREYXRhLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGZsYXRSZWxhdGVkRGF0YSA9IHV0aWwuZmxhdHRlbkFycmF5KHJlbGF0ZWREYXRhKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBvcCA9IG5ldyBNYXBwaW5nT3BlcmF0aW9uKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtb2RlbDogcmV2ZXJzZU1vZGVsLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdGE6IGZsYXRSZWxhdGVkRGF0YSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkaXNhYmxlZXZlbnRzOiBzZWxmLmRpc2FibGVldmVudHMsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgX2lnbm9yZUluc3RhbGxlZDogc2VsZi5faWdub3JlSW5zdGFsbGVkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZyb21TdG9yYWdlOiB0aGlzLmZyb21TdG9yYWdlXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGlmIChvcCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHRhc2s7XG4gICAgICAgICAgICAgICAgICAgICAgICB0YXNrID0gZnVuY3Rpb24gKGRvbmUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBvcC5zdGFydChmdW5jdGlvbiAoZXJyb3JzLCBvYmplY3RzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYuc3ViVGFza1Jlc3VsdHNbcmVsYXRpb25zaGlwTmFtZV0gPSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlcnJvcnM6IGVycm9ycyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9iamVjdHM6IG9iamVjdHMsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbmRleGVzOiBpbmRleGVzXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYucHJvY2Vzc0Vycm9yc0Zyb21UYXNrKHJlbGF0aW9uc2hpcE5hbWUsIG9wLmVycm9ycywgaW5kZXhlcyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRvbmUoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgICAgICAgICBtLnB1c2godGFzayk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG07XG4gICAgICAgICAgICAgICAgfS5iaW5kKHRoaXMpLCBbXSk7XG4gICAgICAgICAgICAgICAgYXN5bmMucGFyYWxsZWwodGFza3MsIGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBNYXBwaW5nT3BlcmF0aW9uO1xuXG5cblxufSkoKTsiLCIoZnVuY3Rpb24gKCkge1xuXG4gICAgdmFyIGxvZyA9IHJlcXVpcmUoJy4vbG9nJykoJ21vZGVsJyksXG4gICAgICAgIENvbGxlY3Rpb25SZWdpc3RyeSA9IHJlcXVpcmUoJy4vY29sbGVjdGlvblJlZ2lzdHJ5JykuQ29sbGVjdGlvblJlZ2lzdHJ5LFxuICAgICAgICBJbnRlcm5hbFNpZXN0YUVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpLkludGVybmFsU2llc3RhRXJyb3IsXG4gICAgICAgIFJlbGF0aW9uc2hpcFR5cGUgPSByZXF1aXJlKCcuL1JlbGF0aW9uc2hpcFR5cGUnKSxcbiAgICAgICAgUXVlcnkgPSByZXF1aXJlKCcuL1F1ZXJ5JyksXG4gICAgICAgIE1hcHBpbmdPcGVyYXRpb24gPSByZXF1aXJlKCcuL21hcHBpbmdPcGVyYXRpb24nKSxcbiAgICAgICAgTW9kZWxJbnN0YW5jZSA9IHJlcXVpcmUoJy4vTW9kZWxJbnN0YW5jZScpLFxuICAgICAgICB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyksXG4gICAgICAgIGNhY2hlID0gcmVxdWlyZSgnLi9jYWNoZScpLFxuICAgICAgICBzdG9yZSA9IHJlcXVpcmUoJy4vc3RvcmUnKSxcbiAgICAgICAgZXJyb3IgPSByZXF1aXJlKCcuL2Vycm9yJyksXG4gICAgICAgIGV4dGVuZCA9IHJlcXVpcmUoJ2V4dGVuZCcpLFxuICAgICAgICBtb2RlbEV2ZW50cyA9IHJlcXVpcmUoJy4vbW9kZWxFdmVudHMnKSxcbiAgICAgICAgZXZlbnRzID0gcmVxdWlyZSgnLi9ldmVudHMnKSxcbiAgICAgICAgT25lVG9PbmVQcm94eSA9IHJlcXVpcmUoJy4vT25lVG9PbmVQcm94eScpLFxuICAgICAgICBNYW55VG9NYW55UHJveHkgPSByZXF1aXJlKCcuL01hbnlUb01hbnlQcm94eScpLFxuICAgICAgICBSZWFjdGl2ZVF1ZXJ5ID0gcmVxdWlyZSgnLi9SZWFjdGl2ZVF1ZXJ5JyksXG4gICAgICAgIGluc3RhbmNlRmFjdG9yeSA9IHJlcXVpcmUoJy4vaW5zdGFuY2VGYWN0b3J5JyksXG4gICAgICAgIEFycmFuZ2VkUmVhY3RpdmVRdWVyeSA9IHJlcXVpcmUoJy4vQXJyYW5nZWRSZWFjdGl2ZVF1ZXJ5JyksXG4gICAgICAgIF8gPSB1dGlsLl87XG5cbiAgICAvKipcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBvcHRzXG4gICAgICovXG4gICAgZnVuY3Rpb24gTW9kZWwob3B0cykge1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgIHRoaXMuX29wdHMgPSBvcHRzID8gXy5leHRlbmQoe30sIG9wdHMpIDoge307XG5cbiAgICAgICAgdXRpbC5leHRlbmRGcm9tT3B0cyh0aGlzLCBvcHRzLCB7XG4gICAgICAgICAgICBtZXRob2RzOiB7fSxcbiAgICAgICAgICAgIGF0dHJpYnV0ZXM6IFtdLFxuICAgICAgICAgICAgY29sbGVjdGlvbjogZnVuY3Rpb24gKGMpIHtcbiAgICAgICAgICAgICAgICBpZiAodXRpbC5pc1N0cmluZyhjKSkge1xuICAgICAgICAgICAgICAgICAgICBjID0gQ29sbGVjdGlvblJlZ2lzdHJ5W2NdO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gYztcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBpZDogJ2lkJyxcbiAgICAgICAgICAgIHJlbGF0aW9uc2hpcHM6IFtdLFxuICAgICAgICAgICAgbmFtZTogbnVsbCxcbiAgICAgICAgICAgIGluZGV4ZXM6IFtdLFxuICAgICAgICAgICAgc2luZ2xldG9uOiBmYWxzZSxcbiAgICAgICAgICAgIHN0YXRpY3M6IHRoaXMuaW5zdGFsbFN0YXRpY3MuYmluZCh0aGlzKSxcbiAgICAgICAgICAgIHByb3BlcnRpZXM6IHt9LFxuICAgICAgICAgICAgaW5pdDogbnVsbCxcbiAgICAgICAgICAgIHJlbW92ZTogbnVsbFxuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLmF0dHJpYnV0ZXMgPSBNb2RlbC5fcHJvY2Vzc0F0dHJpYnV0ZXModGhpcy5hdHRyaWJ1dGVzKTtcblxuICAgICAgICB0aGlzLl9pbnN0YW5jZSA9IG5ldyBpbnN0YW5jZUZhY3RvcnkodGhpcyk7XG5cbiAgICAgICAgXy5leHRlbmQodGhpcywge1xuICAgICAgICAgICAgX2luc3RhbGxlZDogZmFsc2UsXG4gICAgICAgICAgICBfcmVsYXRpb25zaGlwc0luc3RhbGxlZDogZmFsc2UsXG4gICAgICAgICAgICBfcmV2ZXJzZVJlbGF0aW9uc2hpcHNJbnN0YWxsZWQ6IGZhbHNlLFxuICAgICAgICAgICAgY2hpbGRyZW46IFtdXG4gICAgICAgIH0pO1xuXG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKHRoaXMsIHtcbiAgICAgICAgICAgIF9yZWxhdGlvbnNoaXBOYW1lczoge1xuICAgICAgICAgICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gT2JqZWN0LmtleXMoc2VsZi5yZWxhdGlvbnNoaXBzKTtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBfYXR0cmlidXRlTmFtZXM6IHtcbiAgICAgICAgICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIG5hbWVzID0gW107XG4gICAgICAgICAgICAgICAgICAgIGlmIChzZWxmLmlkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBuYW1lcy5wdXNoKHNlbGYuaWQpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIF8uZWFjaChzZWxmLmF0dHJpYnV0ZXMsIGZ1bmN0aW9uICh4KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBuYW1lcy5wdXNoKHgubmFtZSlcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBuYW1lcztcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgICAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgaW5zdGFsbGVkOiB7XG4gICAgICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBzZWxmLl9pbnN0YWxsZWQgJiYgc2VsZi5fcmVsYXRpb25zaGlwc0luc3RhbGxlZCAmJiBzZWxmLl9yZXZlcnNlUmVsYXRpb25zaGlwc0luc3RhbGxlZDtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgICAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgZGVzY2VuZGFudHM6IHtcbiAgICAgICAgICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIF8ucmVkdWNlKHNlbGYuY2hpbGRyZW4sIGZ1bmN0aW9uIChtZW1vLCBkZXNjZW5kYW50KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gQXJyYXkucHJvdG90eXBlLmNvbmNhdC5jYWxsKG1lbW8sIGRlc2NlbmRhbnQuZGVzY2VuZGFudHMpO1xuICAgICAgICAgICAgICAgICAgICB9LmJpbmQoc2VsZiksIF8uZXh0ZW5kKFtdLCBzZWxmLmNoaWxkcmVuKSk7XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgZGlydHk6IHtcbiAgICAgICAgICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHNpZXN0YS5leHQuc3RvcmFnZUVuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciB1bnNhdmVkT2JqZWN0c0J5Q29sbGVjdGlvbiA9IHNpZXN0YS5leHQuc3RvcmFnZS5fdW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb24sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaGFzaCA9ICh1bnNhdmVkT2JqZWN0c0J5Q29sbGVjdGlvblt0aGlzLmNvbGxlY3Rpb25OYW1lXSB8fCB7fSlbdGhpcy5uYW1lXSB8fCB7fTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiAhIU9iamVjdC5rZXlzKGhhc2gpLmxlbmd0aDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBlbHNlIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgY29sbGVjdGlvbk5hbWU6IHtcbiAgICAgICAgICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuY29sbGVjdGlvbi5uYW1lO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgZXZlbnRzLlByb3h5RXZlbnRFbWl0dGVyLmNhbGwodGhpcywgdGhpcy5jb2xsZWN0aW9uTmFtZSArICc6JyArIHRoaXMubmFtZSk7XG4gICAgfVxuXG4gICAgXy5leHRlbmQoTW9kZWwsIHtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIE5vcm1hbGlzZSBhdHRyaWJ1dGVzIHBhc3NlZCB2aWEgdGhlIG9wdGlvbnMgZGljdGlvbmFyeS5cbiAgICAgICAgICogQHBhcmFtIGF0dHJpYnV0ZXNcbiAgICAgICAgICogQHJldHVybnMge0FycmF5fVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgX3Byb2Nlc3NBdHRyaWJ1dGVzOiBmdW5jdGlvbiAoYXR0cmlidXRlcykge1xuICAgICAgICAgICAgcmV0dXJuIF8ucmVkdWNlKGF0dHJpYnV0ZXMsIGZ1bmN0aW9uIChtLCBhKSB7XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBhID09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgICAgICAgIG0ucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgICAgICBuYW1lOiBhXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgbS5wdXNoKGEpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gbTtcbiAgICAgICAgICAgIH0sIFtdKVxuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICBNb2RlbC5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKGV2ZW50cy5Qcm94eUV2ZW50RW1pdHRlci5wcm90b3R5cGUpO1xuXG4gICAgXy5leHRlbmQoTW9kZWwucHJvdG90eXBlLCB7XG4gICAgICAgIGluc3RhbGxTdGF0aWNzOiBmdW5jdGlvbiAoc3RhdGljcykge1xuICAgICAgICAgICAgaWYgKHN0YXRpY3MpIHtcbiAgICAgICAgICAgICAgICBfLmVhY2goT2JqZWN0LmtleXMoc3RhdGljcyksIGZ1bmN0aW9uIChzdGF0aWNOYW1lKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzW3N0YXRpY05hbWVdKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2coJ1N0YXRpYyBtZXRob2Qgd2l0aCBuYW1lIFwiJyArIHN0YXRpY05hbWUgKyAnXCIgYWxyZWFkeSBleGlzdHMuIElnbm9yaW5nIGl0LicpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpc1tzdGF0aWNOYW1lXSA9IHN0YXRpY3Nbc3RhdGljTmFtZV0uYmluZCh0aGlzKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gc3RhdGljcztcbiAgICAgICAgfSxcbiAgICAgICAgX3ZhbGlkYXRlUmVsYXRpb25zaGlwVHlwZTogZnVuY3Rpb24gKHJlbGF0aW9uc2hpcCkge1xuICAgICAgICAgICAgaWYgKCFyZWxhdGlvbnNoaXAudHlwZSkge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLnNpbmdsZXRvbikgcmVsYXRpb25zaGlwLnR5cGUgPSBSZWxhdGlvbnNoaXBUeXBlLk9uZVRvT25lO1xuICAgICAgICAgICAgICAgIGVsc2UgcmVsYXRpb25zaGlwLnR5cGUgPSBSZWxhdGlvbnNoaXBUeXBlLk9uZVRvTWFueTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICh0aGlzLnNpbmdsZXRvbiAmJiByZWxhdGlvbnNoaXAudHlwZSA9PSBSZWxhdGlvbnNoaXBUeXBlLk1hbnlUb01hbnkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gJ1NpbmdsZXRvbiBtb2RlbCBjYW5ub3QgdXNlIE1hbnlUb01hbnkgcmVsYXRpb25zaGlwLic7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoT2JqZWN0LmtleXMoUmVsYXRpb25zaGlwVHlwZSkuaW5kZXhPZihyZWxhdGlvbnNoaXAudHlwZSkgPCAwKVxuICAgICAgICAgICAgICAgIHJldHVybiAnUmVsYXRpb25zaGlwIHR5cGUgJyArIHJlbGF0aW9uc2hpcC50eXBlICsgJyBkb2VzIG5vdCBleGlzdCc7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogSW5zdGFsbCByZWxhdGlvbnNoaXBzLiBSZXR1cm5zIGVycm9yIGluIGZvcm0gb2Ygc3RyaW5nIGlmIGZhaWxzLlxuICAgICAgICAgKiBAcmV0dXJuIHtTdHJpbmd8bnVsbH1cbiAgICAgICAgICovXG4gICAgICAgIGluc3RhbGxSZWxhdGlvbnNoaXBzOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBpZiAoIXRoaXMuX3JlbGF0aW9uc2hpcHNJbnN0YWxsZWQpIHtcbiAgICAgICAgICAgICAgICB2YXIgc2VsZiA9IHRoaXMsXG4gICAgICAgICAgICAgICAgICAgIGVyciA9IG51bGw7XG4gICAgICAgICAgICAgICAgc2VsZi5fcmVsYXRpb25zaGlwcyA9IFtdO1xuICAgICAgICAgICAgICAgIGlmIChzZWxmLl9vcHRzLnJlbGF0aW9uc2hpcHMpIHtcbiAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgbmFtZSBpbiBzZWxmLl9vcHRzLnJlbGF0aW9uc2hpcHMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzZWxmLl9vcHRzLnJlbGF0aW9uc2hpcHMuaGFzT3duUHJvcGVydHkobmFtZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgcmVsYXRpb25zaGlwID0gc2VsZi5fb3B0cy5yZWxhdGlvbnNoaXBzW25hbWVdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIElmIGEgcmV2ZXJzZSByZWxhdGlvbnNoaXAgaXMgaW5zdGFsbGVkIGJlZm9yZWhhbmQsIHdlIGRvIG5vdCB3YW50IHRvIHByb2Nlc3MgdGhlbS5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIXJlbGF0aW9uc2hpcC5pc1JldmVyc2UpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nKHRoaXMubmFtZSArICc6IGNvbmZpZ3VyaW5nIHJlbGF0aW9uc2hpcCAnICsgbmFtZSwgcmVsYXRpb25zaGlwKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCEoZXJyID0gdGhpcy5fdmFsaWRhdGVSZWxhdGlvbnNoaXBUeXBlKHJlbGF0aW9uc2hpcCkpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgbW9kZWxOYW1lID0gcmVsYXRpb25zaGlwLm1vZGVsO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVsZXRlIHJlbGF0aW9uc2hpcC5tb2RlbDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciByZXZlcnNlTW9kZWw7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAobW9kZWxOYW1lIGluc3RhbmNlb2YgTW9kZWwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXZlcnNlTW9kZWwgPSBtb2RlbE5hbWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2coJ3JldmVyc2VNb2RlbE5hbWUnLCBtb2RlbE5hbWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghc2VsZi5jb2xsZWN0aW9uKSB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignTW9kZWwgbXVzdCBoYXZlIGNvbGxlY3Rpb24nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgY29sbGVjdGlvbiA9IHNlbGYuY29sbGVjdGlvbjtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWNvbGxlY3Rpb24pICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdDb2xsZWN0aW9uICcgKyBzZWxmLmNvbGxlY3Rpb25OYW1lICsgJyBub3QgcmVnaXN0ZXJlZCcpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldmVyc2VNb2RlbCA9IGNvbGxlY3Rpb25bbW9kZWxOYW1lXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghcmV2ZXJzZU1vZGVsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGFyciA9IG1vZGVsTmFtZS5zcGxpdCgnLicpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChhcnIubGVuZ3RoID09IDIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGNvbGxlY3Rpb25OYW1lID0gYXJyWzBdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtb2RlbE5hbWUgPSBhcnJbMV07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBvdGhlckNvbGxlY3Rpb24gPSBDb2xsZWN0aW9uUmVnaXN0cnlbY29sbGVjdGlvbk5hbWVdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIW90aGVyQ29sbGVjdGlvbikgcmV0dXJuICdDb2xsZWN0aW9uIHdpdGggbmFtZSBcIicgKyBjb2xsZWN0aW9uTmFtZSArICdcIiBkb2VzIG5vdCBleGlzdC4nO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXZlcnNlTW9kZWwgPSBvdGhlckNvbGxlY3Rpb25bbW9kZWxOYW1lXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2coJ3JldmVyc2VNb2RlbCcsIHJldmVyc2VNb2RlbCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAocmV2ZXJzZU1vZGVsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXy5leHRlbmQocmVsYXRpb25zaGlwLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldmVyc2VNb2RlbDogcmV2ZXJzZU1vZGVsLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmb3J3YXJkTW9kZWw6IHRoaXMsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZvcndhcmROYW1lOiBuYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXZlcnNlTmFtZTogcmVsYXRpb25zaGlwLnJldmVyc2UgfHwgJ3JldmVyc2VfJyArIG5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlzUmV2ZXJzZTogZmFsc2VcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZWxldGUgcmVsYXRpb25zaGlwLnJldmVyc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2UgcmV0dXJuICdNb2RlbCB3aXRoIG5hbWUgXCInICsgbW9kZWxOYW1lLnRvU3RyaW5nKCkgKyAnXCIgZG9lcyBub3QgZXhpc3QnO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignUmVsYXRpb25zaGlwcyBmb3IgXCInICsgdGhpcy5uYW1lICsgJ1wiIGhhdmUgYWxyZWFkeSBiZWVuIGluc3RhbGxlZCcpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKCFlcnIpIHRoaXMuX3JlbGF0aW9uc2hpcHNJbnN0YWxsZWQgPSB0cnVlO1xuICAgICAgICAgICAgcmV0dXJuIGVycjtcbiAgICAgICAgfSxcbiAgICAgICAgaW5zdGFsbFJldmVyc2VSZWxhdGlvbnNoaXBzOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBpZiAoIXRoaXMuX3JldmVyc2VSZWxhdGlvbnNoaXBzSW5zdGFsbGVkKSB7XG4gICAgICAgICAgICAgICAgZm9yICh2YXIgZm9yd2FyZE5hbWUgaW4gdGhpcy5yZWxhdGlvbnNoaXBzKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLnJlbGF0aW9uc2hpcHMuaGFzT3duUHJvcGVydHkoZm9yd2FyZE5hbWUpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgcmVsYXRpb25zaGlwID0gdGhpcy5yZWxhdGlvbnNoaXBzW2ZvcndhcmROYW1lXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlbGF0aW9uc2hpcCA9IGV4dGVuZCh0cnVlLCB7fSwgcmVsYXRpb25zaGlwKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlbGF0aW9uc2hpcC5pc1JldmVyc2UgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHJldmVyc2VNb2RlbCA9IHJlbGF0aW9uc2hpcC5yZXZlcnNlTW9kZWwsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV2ZXJzZU5hbWUgPSByZWxhdGlvbnNoaXAucmV2ZXJzZU5hbWU7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAocmV2ZXJzZU1vZGVsLnNpbmdsZXRvbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChyZWxhdGlvbnNoaXAudHlwZSA9PSBSZWxhdGlvbnNoaXBUeXBlLk1hbnlUb01hbnkpIHJldHVybiAnU2luZ2xldG9uIG1vZGVsIGNhbm5vdCBiZSByZWxhdGVkIHZpYSByZXZlcnNlIE1hbnlUb01hbnknO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChyZWxhdGlvbnNoaXAudHlwZSA9PSBSZWxhdGlvbnNoaXBUeXBlLk9uZVRvTWFueSkgcmV0dXJuICdTaW5nbGV0b24gbW9kZWwgY2Fubm90IGJlIHJlbGF0ZWQgdmlhIHJldmVyc2UgT25lVG9NYW55JztcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZyh0aGlzLm5hbWUgKyAnOiBjb25maWd1cmluZyAgcmV2ZXJzZSByZWxhdGlvbnNoaXAgJyArIHJldmVyc2VOYW1lKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldmVyc2VNb2RlbC5yZWxhdGlvbnNoaXBzW3JldmVyc2VOYW1lXSA9IHJlbGF0aW9uc2hpcDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB0aGlzLl9yZXZlcnNlUmVsYXRpb25zaGlwc0luc3RhbGxlZCA9IHRydWU7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdSZXZlcnNlIHJlbGF0aW9uc2hpcHMgZm9yIFwiJyArIHRoaXMubmFtZSArICdcIiBoYXZlIGFscmVhZHkgYmVlbiBpbnN0YWxsZWQuJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIF9xdWVyeTogZnVuY3Rpb24gKHF1ZXJ5KSB7XG4gICAgICAgICAgICByZXR1cm4gbmV3IFF1ZXJ5KHRoaXMsIHF1ZXJ5IHx8IHt9KTtcbiAgICAgICAgfSxcbiAgICAgICAgcXVlcnk6IGZ1bmN0aW9uIChxdWVyeSwgY2IpIHtcbiAgICAgICAgICAgIHJldHVybiB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uIChjYikge1xuICAgICAgICAgICAgICAgIGlmICghdGhpcy5zaW5nbGV0b24pIHJldHVybiAodGhpcy5fcXVlcnkocXVlcnkpKS5leGVjdXRlKGNiKTtcbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgKHRoaXMuX3F1ZXJ5KHtfX2lnbm9yZUluc3RhbGxlZDogdHJ1ZX0pKS5leGVjdXRlKGZ1bmN0aW9uIChlcnIsIG9ianMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIGNiKGVycik7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBDYWNoZSBhIG5ldyBzaW5nbGV0b24gYW5kIHRoZW4gcmVleGVjdXRlIHRoZSBxdWVyeVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHF1ZXJ5ID0gXy5leHRlbmQoe30sIHF1ZXJ5KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBxdWVyeS5fX2lnbm9yZUluc3RhbGxlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFvYmpzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmdyYXBoKHt9LCBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICh0aGlzLl9xdWVyeShxdWVyeSkpLmV4ZWN1dGUoY2IpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2IoZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICh0aGlzLl9xdWVyeShxdWVyeSkpLmV4ZWN1dGUoY2IpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LmJpbmQodGhpcykpO1xuXG4gICAgICAgIH0sXG4gICAgICAgIHJlYWN0aXZlUXVlcnk6IGZ1bmN0aW9uIChxdWVyeSkge1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBSZWFjdGl2ZVF1ZXJ5KG5ldyBRdWVyeSh0aGlzLCBxdWVyeSB8fCB7fSkpO1xuICAgICAgICB9LFxuICAgICAgICBhcnJhbmdlZFJlYWN0aXZlUXVlcnk6IGZ1bmN0aW9uIChxdWVyeSkge1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBBcnJhbmdlZFJlYWN0aXZlUXVlcnkobmV3IFF1ZXJ5KHRoaXMsIHF1ZXJ5IHx8IHt9KSk7XG4gICAgICAgIH0sXG4gICAgICAgIG9uZTogZnVuY3Rpb24gKG9wdHMsIGNiKSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIG9wdHMgPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgICAgIGNiID0gb3B0cztcbiAgICAgICAgICAgICAgICBvcHRzID0ge307XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbiAoY2IpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnF1ZXJ5KG9wdHMsIGZ1bmN0aW9uIChlcnIsIHJlcykge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKSBjYihlcnIpO1xuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChyZXMubGVuZ3RoID4gMSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNiKGVycm9yKCdNb3JlIHRoYW4gb25lIGluc3RhbmNlIHJldHVybmVkIHdoZW4gZXhlY3V0aW5nIGdldCBxdWVyeSEnKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXMgPSByZXMubGVuZ3RoID8gcmVzWzBdIDogbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYihudWxsLCByZXMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICB9LFxuICAgICAgICBhbGw6IGZ1bmN0aW9uIChxLCBjYikge1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBxID09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgICAgICBjYiA9IHE7XG4gICAgICAgICAgICAgICAgcSA9IHt9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcSA9IHEgfHwge307XG4gICAgICAgICAgICB2YXIgcXVlcnkgPSB7fTtcbiAgICAgICAgICAgIGlmIChxLl9fb3JkZXIpIHF1ZXJ5Ll9fb3JkZXIgPSBxLl9fb3JkZXI7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5xdWVyeShxLCBjYik7XG4gICAgICAgIH0sXG4gICAgICAgIGluc3RhbGw6IGZ1bmN0aW9uIChjYikge1xuICAgICAgICAgICAgbG9nKCdJbnN0YWxsaW5nIG1hcHBpbmcgJyArIHRoaXMubmFtZSk7XG4gICAgICAgICAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbiAoY2IpIHtcbiAgICAgICAgICAgICAgICBpZiAoIXRoaXMuX2luc3RhbGxlZCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9pbnN0YWxsZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICBjYigpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdNb2RlbCBcIicgKyB0aGlzLm5hbWUgKyAnXCIgaGFzIGFscmVhZHkgYmVlbiBpbnN0YWxsZWQnKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICB9LFxuICAgICAgICAvKipcbiAgICAgICAgICogTWFwIGRhdGEgaW50byBTaWVzdGEuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSBkYXRhIFJhdyBkYXRhIHJlY2VpdmVkIHJlbW90ZWx5IG9yIG90aGVyd2lzZVxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9ufG9iamVjdH0gW29wdHNdXG4gICAgICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gb3B0cy5vdmVycmlkZVxuICAgICAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IG9wdHMuX2lnbm9yZUluc3RhbGxlZCAtIEEgaGFjayB0aGF0IGFsbG93cyBtYXBwaW5nIG9udG8gTW9kZWxzIGV2ZW4gaWYgaW5zdGFsbCBwcm9jZXNzIGhhcyBub3QgZmluaXNoZWQuXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb259IFtjYl0gQ2FsbGVkIG9uY2UgcG91Y2ggcGVyc2lzdGVuY2UgcmV0dXJucy5cbiAgICAgICAgICovXG4gICAgICAgIGdyYXBoOiBmdW5jdGlvbiAoZGF0YSwgb3B0cywgY2IpIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2Ygb3B0cyA9PSAnZnVuY3Rpb24nKSBjYiA9IG9wdHM7XG4gICAgICAgICAgICBvcHRzID0gb3B0cyB8fCB7fTtcbiAgICAgICAgICAgIHJldHVybiB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uIChjYikge1xuICAgICAgICAgICAgICAgIHZhciBfbWFwID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgb3ZlcnJpZGVzID0gb3B0cy5vdmVycmlkZTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG92ZXJyaWRlcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHV0aWwuaXNBcnJheShvdmVycmlkZXMpKSBvcHRzLm9iamVjdHMgPSBvdmVycmlkZXM7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNlIG9wdHMub2JqZWN0cyA9IFtvdmVycmlkZXNdO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGRlbGV0ZSBvcHRzLm92ZXJyaWRlO1xuICAgICAgICAgICAgICAgICAgICBpZiAodXRpbC5pc0FycmF5KGRhdGEpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9tYXBCdWxrKGRhdGEsIG9wdHMsIGNiKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX21hcEJ1bGsoW2RhdGFdLCBvcHRzLCBmdW5jdGlvbiAoZXJyLCBvYmplY3RzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG9iajtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAob2JqZWN0cykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAob2JqZWN0cy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9iaiA9IG9iamVjdHNbMF07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZXJyID0gZXJyID8gKHV0aWwuaXNBcnJheShkYXRhKSA/IGVyciA6ICh1dGlsLmlzQXJyYXkoZXJyKSA/IGVyclswXSA6IGVycikpIDogbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYihlcnIsIG9iaik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0uYmluZCh0aGlzKTtcbiAgICAgICAgICAgICAgICBpZiAob3B0cy5faWdub3JlSW5zdGFsbGVkKSB7XG4gICAgICAgICAgICAgICAgICAgIF9tYXAoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSBzaWVzdGEuX2FmdGVySW5zdGFsbChfbWFwKTtcbiAgICAgICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICAgIH0sXG4gICAgICAgIF9tYXBCdWxrOiBmdW5jdGlvbiAoZGF0YSwgb3B0cywgY2FsbGJhY2spIHtcbiAgICAgICAgICAgIF8uZXh0ZW5kKG9wdHMsIHttb2RlbDogdGhpcywgZGF0YTogZGF0YX0pO1xuICAgICAgICAgICAgdmFyIG9wID0gbmV3IE1hcHBpbmdPcGVyYXRpb24ob3B0cyk7XG4gICAgICAgICAgICBvcC5zdGFydChmdW5jdGlvbiAoZXJyLCBvYmplY3RzKSB7XG4gICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2sobnVsbCwgb2JqZWN0cyB8fCBbXSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0sXG4gICAgICAgIF9jb3VudENhY2hlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB2YXIgY29sbENhY2hlID0gY2FjaGUuX2xvY2FsQ2FjaGVCeVR5cGVbdGhpcy5jb2xsZWN0aW9uTmFtZV0gfHwge307XG4gICAgICAgICAgICB2YXIgbW9kZWxDYWNoZSA9IGNvbGxDYWNoZVt0aGlzLm5hbWVdIHx8IHt9O1xuICAgICAgICAgICAgcmV0dXJuIF8ucmVkdWNlKE9iamVjdC5rZXlzKG1vZGVsQ2FjaGUpLCBmdW5jdGlvbiAobSwgX2lkKSB7XG4gICAgICAgICAgICAgICAgbVtfaWRdID0ge307XG4gICAgICAgICAgICAgICAgcmV0dXJuIG07XG4gICAgICAgICAgICB9LCB7fSk7XG4gICAgICAgIH0sXG4gICAgICAgIGNvdW50OiBmdW5jdGlvbiAoY2IpIHtcbiAgICAgICAgICAgIHJldHVybiB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uIChjYikge1xuICAgICAgICAgICAgICAgIGNiKG51bGwsIE9iamVjdC5rZXlzKHRoaXMuX2NvdW50Q2FjaGUoKSkubGVuZ3RoKTtcbiAgICAgICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICAgIH0sXG4gICAgICAgIF9kdW1wOiBmdW5jdGlvbiAoYXNKU09OKSB7XG4gICAgICAgICAgICB2YXIgZHVtcGVkID0ge307XG4gICAgICAgICAgICBkdW1wZWQubmFtZSA9IHRoaXMubmFtZTtcbiAgICAgICAgICAgIGR1bXBlZC5hdHRyaWJ1dGVzID0gdGhpcy5hdHRyaWJ1dGVzO1xuICAgICAgICAgICAgZHVtcGVkLmlkID0gdGhpcy5pZDtcbiAgICAgICAgICAgIGR1bXBlZC5jb2xsZWN0aW9uID0gdGhpcy5jb2xsZWN0aW9uTmFtZTtcbiAgICAgICAgICAgIGR1bXBlZC5yZWxhdGlvbnNoaXBzID0gXy5tYXAodGhpcy5yZWxhdGlvbnNoaXBzLCBmdW5jdGlvbiAocikge1xuICAgICAgICAgICAgICAgIHJldHVybiByLmlzRm9yd2FyZCA/IHIuZm9yd2FyZE5hbWUgOiByLnJldmVyc2VOYW1lO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gYXNKU09OID8gdXRpbC5wcmV0dHlQcmludChkdW1wZWQpIDogZHVtcGVkO1xuICAgICAgICB9LFxuICAgICAgICB0b1N0cmluZzogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuICdNb2RlbFsnICsgdGhpcy5uYW1lICsgJ10nO1xuICAgICAgICB9XG5cbiAgICB9KTtcblxuICAgIC8vIFN1YmNsYXNzaW5nXG4gICAgXy5leHRlbmQoTW9kZWwucHJvdG90eXBlLCB7XG4gICAgICAgIGNoaWxkOiBmdW5jdGlvbiAobmFtZU9yT3B0cywgb3B0cykge1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBuYW1lT3JPcHRzID09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgICAgb3B0cy5uYW1lID0gbmFtZU9yT3B0cztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgb3B0cyA9IG5hbWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBfLmV4dGVuZChvcHRzLCB7XG4gICAgICAgICAgICAgICAgYXR0cmlidXRlczogQXJyYXkucHJvdG90eXBlLmNvbmNhdC5jYWxsKG9wdHMuYXR0cmlidXRlcyB8fCBbXSwgdGhpcy5fb3B0cy5hdHRyaWJ1dGVzKSxcbiAgICAgICAgICAgICAgICByZWxhdGlvbnNoaXBzOiBfLmV4dGVuZChvcHRzLnJlbGF0aW9uc2hpcHMgfHwge30sIHRoaXMuX29wdHMucmVsYXRpb25zaGlwcyksXG4gICAgICAgICAgICAgICAgbWV0aG9kczogXy5leHRlbmQoXy5leHRlbmQoe30sIHRoaXMuX29wdHMubWV0aG9kcykgfHwge30sIG9wdHMubWV0aG9kcyksXG4gICAgICAgICAgICAgICAgc3RhdGljczogXy5leHRlbmQoXy5leHRlbmQoe30sIHRoaXMuX29wdHMuc3RhdGljcykgfHwge30sIG9wdHMuc3RhdGljcyksXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczogXy5leHRlbmQoXy5leHRlbmQoe30sIHRoaXMuX29wdHMucHJvcGVydGllcykgfHwge30sIG9wdHMucHJvcGVydGllcyksXG4gICAgICAgICAgICAgICAgaWQ6IG9wdHMuaWQgfHwgdGhpcy5fb3B0cy5pZCxcbiAgICAgICAgICAgICAgICBpbml0OiBvcHRzLmluaXQgfHwgdGhpcy5fb3B0cy5pbml0LFxuICAgICAgICAgICAgICAgIHJlbW92ZTogb3B0cy5yZW1vdmUgfHwgdGhpcy5fb3B0cy5yZW1vdmVcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgdmFyIG1vZGVsID0gdGhpcy5jb2xsZWN0aW9uLm1vZGVsKG9wdHMubmFtZSwgb3B0cyk7XG4gICAgICAgICAgICBtb2RlbC5wYXJlbnQgPSB0aGlzO1xuICAgICAgICAgICAgdGhpcy5jaGlsZHJlbi5wdXNoKG1vZGVsKTtcbiAgICAgICAgICAgIHJldHVybiBtb2RlbDtcbiAgICAgICAgfSxcbiAgICAgICAgaXNDaGlsZE9mOiBmdW5jdGlvbiAocGFyZW50KSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5wYXJlbnQgPT0gcGFyZW50O1xuICAgICAgICB9LFxuICAgICAgICBpc1BhcmVudE9mOiBmdW5jdGlvbiAoY2hpbGQpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmNoaWxkcmVuLmluZGV4T2YoY2hpbGQpID4gLTE7XG4gICAgICAgIH0sXG4gICAgICAgIGlzRGVzY2VuZGFudE9mOiBmdW5jdGlvbiAoYW5jZXN0b3IpIHtcbiAgICAgICAgICAgIHZhciBwYXJlbnQgPSB0aGlzLnBhcmVudDtcbiAgICAgICAgICAgIHdoaWxlIChwYXJlbnQpIHtcbiAgICAgICAgICAgICAgICBpZiAocGFyZW50ID09IGFuY2VzdG9yKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICBwYXJlbnQgPSBwYXJlbnQucGFyZW50O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9LFxuICAgICAgICBpc0FuY2VzdG9yT2Y6IGZ1bmN0aW9uIChkZXNjZW5kYW50KSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5kZXNjZW5kYW50cy5pbmRleE9mKGRlc2NlbmRhbnQpID4gLTE7XG4gICAgICAgIH0sXG4gICAgICAgIGhhc0F0dHJpYnV0ZU5hbWVkOiBmdW5jdGlvbiAoYXR0cmlidXRlTmFtZSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2F0dHJpYnV0ZU5hbWVzLmluZGV4T2YoYXR0cmlidXRlTmFtZSkgPiAtMTtcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBNb2RlbDtcblxufSkoKTtcbiIsIihmdW5jdGlvbiAoKSB7XG4gICAgdmFyIGV2ZW50cyA9IHJlcXVpcmUoJy4vZXZlbnRzJyksXG4gICAgICAgIEludGVybmFsU2llc3RhRXJyb3IgPSByZXF1aXJlKCcuL2Vycm9yJykuSW50ZXJuYWxTaWVzdGFFcnJvcixcbiAgICAgICAgbG9nID0gcmVxdWlyZSgnLi9sb2cnKSgnZXZlbnRzJyksXG4gICAgICAgIGV4dGVuZCA9IHJlcXVpcmUoJy4vdXRpbCcpLl8uZXh0ZW5kLFxuICAgICAgICBjb2xsZWN0aW9uUmVnaXN0cnkgPSByZXF1aXJlKCcuL2NvbGxlY3Rpb25SZWdpc3RyeScpLkNvbGxlY3Rpb25SZWdpc3RyeTtcblxuXG4gICAgLyoqXG4gICAgICogQ29uc3RhbnRzIHRoYXQgZGVzY3JpYmUgY2hhbmdlIGV2ZW50cy5cbiAgICAgKiBTZXQgPT4gQSBuZXcgdmFsdWUgaXMgYXNzaWduZWQgdG8gYW4gYXR0cmlidXRlL3JlbGF0aW9uc2hpcFxuICAgICAqIFNwbGljZSA9PiBBbGwgamF2YXNjcmlwdCBhcnJheSBvcGVyYXRpb25zIGFyZSBkZXNjcmliZWQgYXMgc3BsaWNlcy5cbiAgICAgKiBEZWxldGUgPT4gVXNlZCBpbiB0aGUgY2FzZSB3aGVyZSBvYmplY3RzIGFyZSByZW1vdmVkIGZyb20gYW4gYXJyYXksIGJ1dCBhcnJheSBvcmRlciBpcyBub3Qga25vd24gaW4gYWR2YW5jZS5cbiAgICAgKiBSZW1vdmUgPT4gT2JqZWN0IGRlbGV0aW9uIGV2ZW50c1xuICAgICAqIE5ldyA9PiBPYmplY3QgY3JlYXRpb24gZXZlbnRzXG4gICAgICogQHR5cGUge09iamVjdH1cbiAgICAgKi9cbiAgICB2YXIgTW9kZWxFdmVudFR5cGUgPSB7XG4gICAgICAgICAgICBTZXQ6ICdTZXQnLFxuICAgICAgICAgICAgU3BsaWNlOiAnU3BsaWNlJyxcbiAgICAgICAgICAgIE5ldzogJ05ldycsXG4gICAgICAgICAgICBSZW1vdmU6ICdSZW1vdmUnXG4gICAgICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBSZXByZXNlbnRzIGFuIGluZGl2aWR1YWwgY2hhbmdlLlxuICAgICAqIEBwYXJhbSBvcHRzXG4gICAgICogQGNvbnN0cnVjdG9yXG4gICAgICovXG4gICAgZnVuY3Rpb24gTW9kZWxFdmVudChvcHRzKSB7XG4gICAgICAgIHRoaXMuX29wdHMgPSBvcHRzIHx8IHt9O1xuICAgICAgICBPYmplY3Qua2V5cyhvcHRzKS5mb3JFYWNoKGZ1bmN0aW9uIChrKSB7XG4gICAgICAgICAgICB0aGlzW2tdID0gb3B0c1trXTtcbiAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICB9XG5cbiAgICBNb2RlbEV2ZW50LnByb3RvdHlwZS5fZHVtcCA9IGZ1bmN0aW9uIChwcmV0dHkpIHtcbiAgICAgICAgdmFyIGR1bXBlZCA9IHt9O1xuICAgICAgICBkdW1wZWQuY29sbGVjdGlvbiA9ICh0eXBlb2YgdGhpcy5jb2xsZWN0aW9uKSA9PSAnc3RyaW5nJyA/IHRoaXMuY29sbGVjdGlvbiA6IHRoaXMuY29sbGVjdGlvbi5fZHVtcCgpO1xuICAgICAgICBkdW1wZWQubW9kZWwgPSAodHlwZW9mIHRoaXMubW9kZWwpID09ICdzdHJpbmcnID8gdGhpcy5tb2RlbCA6IHRoaXMubW9kZWwubmFtZTtcbiAgICAgICAgZHVtcGVkLl9pZCA9IHRoaXMuX2lkO1xuICAgICAgICBkdW1wZWQuZmllbGQgPSB0aGlzLmZpZWxkO1xuICAgICAgICBkdW1wZWQudHlwZSA9IHRoaXMudHlwZTtcbiAgICAgICAgaWYgKHRoaXMuaW5kZXgpIGR1bXBlZC5pbmRleCA9IHRoaXMuaW5kZXg7XG4gICAgICAgIGlmICh0aGlzLmFkZGVkKSBkdW1wZWQuYWRkZWQgPSBfLm1hcCh0aGlzLmFkZGVkLCBmdW5jdGlvbiAoeCkge3JldHVybiB4Ll9kdW1wKCl9KTtcbiAgICAgICAgaWYgKHRoaXMucmVtb3ZlZCkgZHVtcGVkLnJlbW92ZWQgPSBfLm1hcCh0aGlzLnJlbW92ZWQsIGZ1bmN0aW9uICh4KSB7cmV0dXJuIHguX2R1bXAoKX0pO1xuICAgICAgICBpZiAodGhpcy5vbGQpIGR1bXBlZC5vbGQgPSB0aGlzLm9sZDtcbiAgICAgICAgaWYgKHRoaXMubmV3KSBkdW1wZWQubmV3ID0gdGhpcy5uZXc7XG4gICAgICAgIHJldHVybiBwcmV0dHkgPyB1dGlsLnByZXR0eVByaW50KGR1bXBlZCkgOiBkdW1wZWQ7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIEJyb2FkY2FzXG4gICAgICogQHBhcmFtICB7U3RyaW5nfSBjb2xsZWN0aW9uTmFtZVxuICAgICAqIEBwYXJhbSAge1N0cmluZ30gbW9kZWxOYW1lXG4gICAgICogQHBhcmFtICB7T2JqZWN0fSBjIGFuIG9wdGlvbnMgZGljdGlvbmFyeSByZXByZXNlbnRpbmcgdGhlIGNoYW5nZVxuICAgICAqIEByZXR1cm4ge1t0eXBlXX1cbiAgICAgKi9cbiAgICBmdW5jdGlvbiBicm9hZGNhc3RFdmVudChjb2xsZWN0aW9uTmFtZSwgbW9kZWxOYW1lLCBjKSB7XG4gICAgICAgIGxvZygnU2VuZGluZyBub3RpZmljYXRpb24gXCInICsgY29sbGVjdGlvbk5hbWUgKyAnXCIgb2YgdHlwZSAnICsgYy50eXBlKTtcbiAgICAgICAgZXZlbnRzLmVtaXQoY29sbGVjdGlvbk5hbWUsIGMpO1xuICAgICAgICB2YXIgbW9kZWxOb3RpZiA9IGNvbGxlY3Rpb25OYW1lICsgJzonICsgbW9kZWxOYW1lO1xuICAgICAgICBsb2coJ1NlbmRpbmcgbm90aWZpY2F0aW9uIFwiJyArIG1vZGVsTm90aWYgKyAnXCIgb2YgdHlwZSAnICsgYy50eXBlKTtcbiAgICAgICAgZXZlbnRzLmVtaXQobW9kZWxOb3RpZiwgYyk7XG4gICAgICAgIHZhciBnZW5lcmljTm90aWYgPSAnU2llc3RhJztcbiAgICAgICAgbG9nKCdTZW5kaW5nIG5vdGlmaWNhdGlvbiBcIicgKyBnZW5lcmljTm90aWYgKyAnXCIgb2YgdHlwZSAnICsgYy50eXBlKTtcbiAgICAgICAgZXZlbnRzLmVtaXQoZ2VuZXJpY05vdGlmLCBjKTtcbiAgICAgICAgdmFyIGxvY2FsSWROb3RpZiA9IGMuX2lkO1xuICAgICAgICBsb2coJ1NlbmRpbmcgbm90aWZpY2F0aW9uIFwiJyArIGxvY2FsSWROb3RpZiArICdcIiBvZiB0eXBlICcgKyBjLnR5cGUpO1xuICAgICAgICBldmVudHMuZW1pdChsb2NhbElkTm90aWYsIGMpO1xuICAgICAgICB2YXIgY29sbGVjdGlvbiA9IGNvbGxlY3Rpb25SZWdpc3RyeVtjb2xsZWN0aW9uTmFtZV07XG4gICAgICAgIHZhciBlcnI7XG4gICAgICAgIGlmICghY29sbGVjdGlvbikge1xuICAgICAgICAgICAgZXJyID0gJ05vIHN1Y2ggY29sbGVjdGlvbiBcIicgKyBjb2xsZWN0aW9uTmFtZSArICdcIic7XG4gICAgICAgICAgICBsb2coZXJyLCBjb2xsZWN0aW9uUmVnaXN0cnkpO1xuICAgICAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoZXJyKTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgbW9kZWwgPSBjb2xsZWN0aW9uW21vZGVsTmFtZV07XG4gICAgICAgIGlmICghbW9kZWwpIHtcbiAgICAgICAgICAgIGVyciA9ICdObyBzdWNoIG1vZGVsIFwiJyArIG1vZGVsTmFtZSArICdcIic7XG4gICAgICAgICAgICBsb2coZXJyLCBjb2xsZWN0aW9uUmVnaXN0cnkpO1xuICAgICAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoZXJyKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAobW9kZWwuaWQgJiYgYy5vYmpbbW9kZWwuaWRdKSB7XG4gICAgICAgICAgICB2YXIgcmVtb3RlSWROb3RpZiA9IGNvbGxlY3Rpb25OYW1lICsgJzonICsgbW9kZWxOYW1lICsgJzonICsgYy5vYmpbbW9kZWwuaWRdO1xuICAgICAgICAgICAgbG9nKCdTZW5kaW5nIG5vdGlmaWNhdGlvbiBcIicgKyByZW1vdGVJZE5vdGlmICsgJ1wiIG9mIHR5cGUgJyArIGMudHlwZSk7XG4gICAgICAgICAgICBldmVudHMuZW1pdChyZW1vdGVJZE5vdGlmLCBjKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIHZhbGlkYXRlRXZlbnRPcHRzKG9wdHMpIHtcbiAgICAgICAgaWYgKCFvcHRzLm1vZGVsKSB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignTXVzdCBwYXNzIGEgbW9kZWwnKTtcbiAgICAgICAgaWYgKCFvcHRzLmNvbGxlY3Rpb24pIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdNdXN0IHBhc3MgYSBjb2xsZWN0aW9uJyk7XG4gICAgICAgIGlmICghb3B0cy5faWQpIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdNdXN0IHBhc3MgYSBsb2NhbCBpZGVudGlmaWVyJyk7XG4gICAgICAgIGlmICghb3B0cy5vYmopIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdNdXN0IHBhc3MgdGhlIG9iamVjdCcpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGVtaXQob3B0cykge1xuICAgICAgICB2YWxpZGF0ZUV2ZW50T3B0cyhvcHRzKTtcbiAgICAgICAgdmFyIGNvbGxlY3Rpb24gPSBvcHRzLmNvbGxlY3Rpb247XG4gICAgICAgIHZhciBtb2RlbCA9IG9wdHMubW9kZWw7XG4gICAgICAgIHZhciBjID0gbmV3IE1vZGVsRXZlbnQob3B0cyk7XG4gICAgICAgIGJyb2FkY2FzdEV2ZW50KGNvbGxlY3Rpb24sIG1vZGVsLCBjKTtcbiAgICAgICAgcmV0dXJuIGM7XG4gICAgfVxuXG4gICAgZXh0ZW5kKGV4cG9ydHMsIHtcbiAgICAgICAgTW9kZWxFdmVudDogTW9kZWxFdmVudCxcbiAgICAgICAgZW1pdDogZW1pdCxcbiAgICAgICAgdmFsaWRhdGVFdmVudE9wdHM6IHZhbGlkYXRlRXZlbnRPcHRzLFxuICAgICAgICBNb2RlbEV2ZW50VHlwZTogTW9kZWxFdmVudFR5cGVcbiAgICB9KTtcbn0pKCk7IiwiLyoqXG4gKiBUaGUgXCJzdG9yZVwiIGlzIHJlc3BvbnNpYmxlIGZvciBtZWRpYXRpbmcgYmV0d2VlbiB0aGUgaW4tbWVtb3J5IGNhY2hlIGFuZCBhbnkgcGVyc2lzdGVudCBzdG9yYWdlLlxuICogTm90ZSB0aGF0IHBlcnNpc3RlbnQgc3RvcmFnZSBoYXMgbm90IGJlZW4gcHJvcGVybHkgaW1wbGVtZW50ZWQgeWV0IGFuZCBzbyB0aGlzIGlzIHByZXR0eSB1c2VsZXNzLlxuICogQWxsIHF1ZXJpZXMgd2lsbCBnbyBzdHJhaWdodCB0byB0aGUgY2FjaGUgaW5zdGVhZC5cbiAqIEBtb2R1bGUgc3RvcmVcbiAqL1xuXG5cbihmdW5jdGlvbiAoKSB7XG4gICAgdmFyIEludGVybmFsU2llc3RhRXJyb3IgPSByZXF1aXJlKCcuL2Vycm9yJykuSW50ZXJuYWxTaWVzdGFFcnJvcixcbiAgICAgICAgbG9nID0gcmVxdWlyZSgnLi9sb2cnKSgnc3RvcmUnKSxcbiAgICAgICAgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpLFxuICAgICAgICBfID0gdXRpbC5fLFxuICAgICAgICBjYWNoZSA9IHJlcXVpcmUoJy4vY2FjaGUnKTtcblxuXG4gICAgZnVuY3Rpb24gZ2V0KG9wdHMsIGNiKSB7XG4gICAgICAgIGxvZygnZ2V0Jywgb3B0cyk7XG4gICAgICAgIHZhciBzaWVzdGFNb2RlbDtcbiAgICAgICAgcmV0dXJuIHV0aWwucHJvbWlzZShjYiwgZnVuY3Rpb24gKGNiKSB7XG4gICAgICAgICAgICBpZiAob3B0cy5faWQpIHtcbiAgICAgICAgICAgICAgICBpZiAodXRpbC5pc0FycmF5KG9wdHMuX2lkKSkge1xuICAgICAgICAgICAgICAgICAgICAvLyBQcm94eSBvbnRvIGdldE11bHRpcGxlIGluc3RlYWQuXG4gICAgICAgICAgICAgICAgICAgIGdldE11bHRpcGxlKF8ubWFwKG9wdHMuX2lkLCBmdW5jdGlvbiAoaWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgX2lkOiBpZFxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9KSwgY2IpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHNpZXN0YU1vZGVsID0gY2FjaGUuZ2V0KG9wdHMpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoc2llc3RhTW9kZWwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChsb2cuZW5hYmxlZClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2coJ0hhZCBjYWNoZWQgb2JqZWN0Jywge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvcHRzOiBvcHRzLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvYmo6IHNpZXN0YU1vZGVsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoY2IpIGNiKG51bGwsIHNpZXN0YU1vZGVsKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh1dGlsLmlzQXJyYXkob3B0cy5faWQpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gUHJveHkgb250byBnZXRNdWx0aXBsZSBpbnN0ZWFkLlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGdldE11bHRpcGxlKF8ubWFwKG9wdHMuX2lkLCBmdW5jdGlvbiAoaWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIF9pZDogaWRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pLCBjYik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGNiKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHN0b3JhZ2UgPSBzaWVzdGEuZXh0LnN0b3JhZ2U7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHN0b3JhZ2UpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RvcmFnZS5zdG9yZS5nZXRGcm9tUG91Y2gob3B0cywgY2IpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignU3RvcmFnZSBtb2R1bGUgbm90IGluc3RhbGxlZCcpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAob3B0cy5tb2RlbCkge1xuICAgICAgICAgICAgICAgIGlmICh1dGlsLmlzQXJyYXkob3B0c1tvcHRzLm1vZGVsLmlkXSkpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gUHJveHkgb250byBnZXRNdWx0aXBsZSBpbnN0ZWFkLlxuICAgICAgICAgICAgICAgICAgICBnZXRNdWx0aXBsZShfLm1hcChvcHRzW29wdHMubW9kZWwuaWRdLCBmdW5jdGlvbiAoaWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBvID0ge307XG4gICAgICAgICAgICAgICAgICAgICAgICBvW29wdHMubW9kZWwuaWRdID0gaWQ7XG4gICAgICAgICAgICAgICAgICAgICAgICBvLm1vZGVsID0gb3B0cy5tb2RlbDtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBvXG4gICAgICAgICAgICAgICAgICAgIH0pLCBjYik7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgc2llc3RhTW9kZWwgPSBjYWNoZS5nZXQob3B0cyk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChzaWVzdGFNb2RlbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGxvZy5lbmFibGVkKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZygnSGFkIGNhY2hlZCBvYmplY3QnLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9wdHM6IG9wdHMsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9iajogc2llc3RhTW9kZWxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjYikgY2IobnVsbCwgc2llc3RhTW9kZWwpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG1vZGVsID0gb3B0cy5tb2RlbDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChtb2RlbC5zaW5nbGV0b24pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtb2RlbC5vbmUoY2IpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgaWRGaWVsZCA9IG1vZGVsLmlkO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBpZCA9IG9wdHNbaWRGaWVsZF07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG9uZU9wdHMgPSB7fTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbmVPcHRzW2lkRmllbGRdID0gaWQ7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGlkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1vZGVsLm9uZShvbmVPcHRzLCBmdW5jdGlvbiAoZXJyLCBvYmopIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG9iaikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYihudWxsLCBvYmopO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNiKG51bGwsIG51bGwpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2IoZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ0ludmFsaWQgb3B0aW9ucyBnaXZlbiB0byBzdG9yZS4gTWlzc2luZyBcIicgKyBpZEZpZWxkLnRvU3RyaW5nKCkgKyAnLlwiJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIE5vIHdheSBpbiB3aGljaCB0byBmaW5kIGFuIG9iamVjdCBsb2NhbGx5LlxuICAgICAgICAgICAgICAgIHZhciBjb250ZXh0ID0ge1xuICAgICAgICAgICAgICAgICAgICBvcHRzOiBvcHRzXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICB2YXIgbXNnID0gJ0ludmFsaWQgb3B0aW9ucyBnaXZlbiB0byBzdG9yZSc7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IobXNnLCBjb250ZXh0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBnZXRNdWx0aXBsZShvcHRzQXJyYXksIGNiKSB7XG4gICAgICAgIHJldHVybiB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uIChjYikge1xuICAgICAgICAgICAgdmFyIGRvY3MgPSBbXTtcbiAgICAgICAgICAgIHZhciBlcnJvcnMgPSBbXTtcbiAgICAgICAgICAgIF8uZWFjaChvcHRzQXJyYXksIGZ1bmN0aW9uIChvcHRzKSB7XG4gICAgICAgICAgICAgICAgZ2V0KG9wdHMsIGZ1bmN0aW9uIChlcnIsIGRvYykge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBlcnJvcnMucHVzaChlcnIpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgZG9jcy5wdXNoKGRvYyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKGRvY3MubGVuZ3RoICsgZXJyb3JzLmxlbmd0aCA9PSBvcHRzQXJyYXkubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoY2IpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXJyb3JzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYihlcnJvcnMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNiKG51bGwsIGRvY3MpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVXNlcyBwb3VjaCBidWxrIGZldGNoIEFQSS4gTXVjaCBmYXN0ZXIgdGhhbiBnZXRNdWx0aXBsZS5cbiAgICAgKiBAcGFyYW0gbG9jYWxJZGVudGlmaWVyc1xuICAgICAqIEBwYXJhbSBjYlxuICAgICAqL1xuICAgIGZ1bmN0aW9uIGdldE11bHRpcGxlTG9jYWwobG9jYWxJZGVudGlmaWVycywgY2IpIHtcbiAgICAgICAgcmV0dXJuIHV0aWwucHJvbWlzZShjYiwgZnVuY3Rpb24gKGNiKSB7XG4gICAgICAgICAgICB2YXIgcmVzdWx0cyA9IF8ucmVkdWNlKGxvY2FsSWRlbnRpZmllcnMsIGZ1bmN0aW9uIChtZW1vLCBfaWQpIHtcbiAgICAgICAgICAgICAgICB2YXIgb2JqID0gY2FjaGUuZ2V0KHtcbiAgICAgICAgICAgICAgICAgICAgX2lkOiBfaWRcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBpZiAob2JqKSB7XG4gICAgICAgICAgICAgICAgICAgIG1lbW8uY2FjaGVkW19pZF0gPSBvYmo7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgbWVtby5ub3RDYWNoZWQucHVzaChfaWQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gbWVtbztcbiAgICAgICAgICAgIH0sIHtcbiAgICAgICAgICAgICAgICBjYWNoZWQ6IHt9LFxuICAgICAgICAgICAgICAgIG5vdENhY2hlZDogW11cbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBmdW5jdGlvbiBmaW5pc2goZXJyKSB7XG4gICAgICAgICAgICAgICAgaWYgKGNiKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNiKGVycik7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjYihudWxsLCBfLm1hcChsb2NhbElkZW50aWZpZXJzLCBmdW5jdGlvbiAoX2lkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHJlc3VsdHMuY2FjaGVkW19pZF07XG4gICAgICAgICAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGZpbmlzaCgpO1xuICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGdldE11bHRpcGxlUmVtb3RlKHJlbW90ZUlkZW50aWZpZXJzLCBtb2RlbCwgY2IpIHtcbiAgICAgICAgcmV0dXJuIHV0aWwucHJvbWlzZShjYiwgZnVuY3Rpb24gKGNiKSB7XG4gICAgICAgICAgICB2YXIgcmVzdWx0cyA9IF8ucmVkdWNlKHJlbW90ZUlkZW50aWZpZXJzLCBmdW5jdGlvbiAobWVtbywgaWQpIHtcbiAgICAgICAgICAgICAgICB2YXIgY2FjaGVRdWVyeSA9IHtcbiAgICAgICAgICAgICAgICAgICAgbW9kZWw6IG1vZGVsXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICBjYWNoZVF1ZXJ5W21vZGVsLmlkXSA9IGlkO1xuICAgICAgICAgICAgICAgIHZhciBvYmogPSBjYWNoZS5nZXQoY2FjaGVRdWVyeSk7XG4gICAgICAgICAgICAgICAgaWYgKG9iaikge1xuICAgICAgICAgICAgICAgICAgICBtZW1vLmNhY2hlZFtpZF0gPSBvYmo7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgbWVtby5ub3RDYWNoZWQucHVzaChpZCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiBtZW1vO1xuICAgICAgICAgICAgfSwge1xuICAgICAgICAgICAgICAgIGNhY2hlZDoge30sXG4gICAgICAgICAgICAgICAgbm90Q2FjaGVkOiBbXVxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIGZ1bmN0aW9uIGZpbmlzaChlcnIpIHtcbiAgICAgICAgICAgICAgICBpZiAoY2IpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgY2IoZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNiKG51bGwsIF8ubWFwKHJlbW90ZUlkZW50aWZpZXJzLCBmdW5jdGlvbiAoaWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gcmVzdWx0cy5jYWNoZWRbaWRdO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBmaW5pc2goKTtcbiAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICB9XG5cbiAgICBtb2R1bGUuZXhwb3J0cyA9IHtcbiAgICAgICAgZ2V0OiBnZXQsXG4gICAgICAgIGdldE11bHRpcGxlOiBnZXRNdWx0aXBsZSxcbiAgICAgICAgZ2V0TXVsdGlwbGVMb2NhbDogZ2V0TXVsdGlwbGVMb2NhbCxcbiAgICAgICAgZ2V0TXVsdGlwbGVSZW1vdGU6IGdldE11bHRpcGxlUmVtb3RlXG4gICAgfTtcblxufSkoKTsiLCIoZnVuY3Rpb24gKCkge1xuICAgIHZhciBtaXNjID0gcmVxdWlyZSgnLi9taXNjJyksXG4gICAgICAgIF8gPSByZXF1aXJlKCcuL3VuZGVyc2NvcmUnKTtcblxuICAgIGZ1bmN0aW9uIGRvUGFyYWxsZWwoZm4pIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKTtcbiAgICAgICAgICAgIHJldHVybiBmbi5hcHBseShudWxsLCBbZWFjaF0uY29uY2F0KGFyZ3MpKTtcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICB2YXIgbWFwID0gZG9QYXJhbGxlbChfYXN5bmNNYXApO1xuXG4gICAgdmFyIHJvb3Q7XG5cbiAgICBmdW5jdGlvbiBfbWFwKGFyciwgaXRlcmF0b3IpIHtcbiAgICAgICAgaWYgKGFyci5tYXApIHtcbiAgICAgICAgICAgIHJldHVybiBhcnIubWFwKGl0ZXJhdG9yKTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgcmVzdWx0cyA9IFtdO1xuICAgICAgICBlYWNoKGFyciwgZnVuY3Rpb24gKHgsIGksIGEpIHtcbiAgICAgICAgICAgIHJlc3VsdHMucHVzaChpdGVyYXRvcih4LCBpLCBhKSk7XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gcmVzdWx0cztcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBfYXN5bmNNYXAoZWFjaGZuLCBhcnIsIGl0ZXJhdG9yLCBjYWxsYmFjaykge1xuICAgICAgICBhcnIgPSBfbWFwKGFyciwgZnVuY3Rpb24gKHgsIGkpIHtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgaW5kZXg6IGksXG4gICAgICAgICAgICAgICAgdmFsdWU6IHhcbiAgICAgICAgICAgIH07XG4gICAgICAgIH0pO1xuICAgICAgICBpZiAoIWNhbGxiYWNrKSB7XG4gICAgICAgICAgICBlYWNoZm4oYXJyLCBmdW5jdGlvbiAoeCwgY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICBpdGVyYXRvcih4LnZhbHVlLCBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHZhciByZXN1bHRzID0gW107XG4gICAgICAgICAgICBlYWNoZm4oYXJyLCBmdW5jdGlvbiAoeCwgY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICBpdGVyYXRvcih4LnZhbHVlLCBmdW5jdGlvbiAoZXJyLCB2KSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdHNbeC5pbmRleF0gPSB2O1xuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSwgZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVyciwgcmVzdWx0cyk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHZhciBtYXBTZXJpZXMgPSBkb1NlcmllcyhfYXN5bmNNYXApO1xuXG4gICAgZnVuY3Rpb24gZG9TZXJpZXMoZm4pIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKTtcbiAgICAgICAgICAgIHJldHVybiBmbi5hcHBseShudWxsLCBbZWFjaFNlcmllc10uY29uY2F0KGFyZ3MpKTtcbiAgICAgICAgfTtcbiAgICB9XG5cblxuICAgIGZ1bmN0aW9uIGVhY2hTZXJpZXMoYXJyLCBpdGVyYXRvciwgY2FsbGJhY2spIHtcbiAgICAgICAgY2FsbGJhY2sgPSBjYWxsYmFjayB8fCBmdW5jdGlvbiAoKSB7fTtcbiAgICAgICAgaWYgKCFhcnIubGVuZ3RoKSB7XG4gICAgICAgICAgICByZXR1cm4gY2FsbGJhY2soKTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgY29tcGxldGVkID0gMDtcbiAgICAgICAgdmFyIGl0ZXJhdGUgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBpdGVyYXRvcihhcnJbY29tcGxldGVkXSwgZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2sgPSBmdW5jdGlvbiAoKSB7fTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBjb21wbGV0ZWQgKz0gMTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGNvbXBsZXRlZCA+PSBhcnIubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgaXRlcmF0ZSgpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH07XG4gICAgICAgIGl0ZXJhdGUoKTtcbiAgICB9XG5cblxuICAgIGZ1bmN0aW9uIF9lYWNoKGFyciwgaXRlcmF0b3IpIHtcbiAgICAgICAgaWYgKGFyci5mb3JFYWNoKSB7XG4gICAgICAgICAgICByZXR1cm4gYXJyLmZvckVhY2goaXRlcmF0b3IpO1xuICAgICAgICB9XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYXJyLmxlbmd0aDsgaSArPSAxKSB7XG4gICAgICAgICAgICBpdGVyYXRvcihhcnJbaV0sIGksIGFycik7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBlYWNoKGFyciwgaXRlcmF0b3IsIGNhbGxiYWNrKSB7XG4gICAgICAgIGNhbGxiYWNrID0gY2FsbGJhY2sgfHwgZnVuY3Rpb24gKCkge307XG4gICAgICAgIGlmICghYXJyLmxlbmd0aCkge1xuICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKCk7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIGNvbXBsZXRlZCA9IDA7XG4gICAgICAgIF9lYWNoKGFyciwgZnVuY3Rpb24gKHgpIHtcbiAgICAgICAgICAgIGl0ZXJhdG9yKHgsIG9ubHlfb25jZShkb25lKSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGZ1bmN0aW9uIGRvbmUoZXJyKSB7XG4gICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgICAgICBjYWxsYmFjayA9IGZ1bmN0aW9uICgpIHt9O1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb21wbGV0ZWQgKz0gMTtcbiAgICAgICAgICAgICAgICBpZiAoY29tcGxldGVkID49IGFyci5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cblxuXG5cbiAgICB2YXIgX3BhcmFsbGVsID0gZnVuY3Rpb24gKGVhY2hmbiwgdGFza3MsIGNhbGxiYWNrKSB7XG4gICAgICAgIGNhbGxiYWNrID0gY2FsbGJhY2sgfHwgZnVuY3Rpb24gKCkge307XG4gICAgICAgIGlmIChtaXNjLmlzQXJyYXkodGFza3MpKSB7XG4gICAgICAgICAgICBlYWNoZm4ubWFwKHRhc2tzLCBmdW5jdGlvbiAoZm4sIGNhbGxiYWNrKSB7XG4gICAgICAgICAgICAgICAgaWYgKGZuKSB7XG4gICAgICAgICAgICAgICAgICAgIGZuKGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChhcmdzLmxlbmd0aCA8PSAxKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYXJncyA9IGFyZ3NbMF07XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjay5jYWxsKG51bGwsIGVyciwgYXJncyk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sIGNhbGxiYWNrKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHZhciByZXN1bHRzID0ge307XG4gICAgICAgICAgICBlYWNoZm4uZWFjaChPYmplY3Qua2V5cyh0YXNrcyksIGZ1bmN0aW9uIChrLCBjYWxsYmFjaykge1xuICAgICAgICAgICAgICAgIHRhc2tzW2tdKGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoYXJncy5sZW5ndGggPD0gMSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgYXJncyA9IGFyZ3NbMF07XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0c1trXSA9IGFyZ3M7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9LCBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyLCByZXN1bHRzKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIGZ1bmN0aW9uIHNlcmllcyh0YXNrcywgY2FsbGJhY2spIHtcbiAgICAgICAgY2FsbGJhY2sgPSBjYWxsYmFjayB8fCBmdW5jdGlvbiAoKSB7fTtcbiAgICAgICAgaWYgKG1pc2MuaXNBcnJheSh0YXNrcykpIHtcbiAgICAgICAgICAgIG1hcFNlcmllcyh0YXNrcywgZnVuY3Rpb24gKGZuLCBjYWxsYmFjaykge1xuICAgICAgICAgICAgICAgIGlmIChmbikge1xuICAgICAgICAgICAgICAgICAgICBmbihmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoYXJncy5sZW5ndGggPD0gMSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFyZ3MgPSBhcmdzWzBdO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2suY2FsbChudWxsLCBlcnIsIGFyZ3MpO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LCBjYWxsYmFjayk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB2YXIgcmVzdWx0cyA9IHt9O1xuICAgICAgICAgICAgZWFjaFNlcmllcyhfLmtleXModGFza3MpLCBmdW5jdGlvbiAoaywgY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICB0YXNrc1trXShmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGFyZ3MubGVuZ3RoIDw9IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFyZ3MgPSBhcmdzWzBdO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdHNba10gPSBhcmdzO1xuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSwgZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVyciwgcmVzdWx0cyk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIG9ubHlfb25jZShmbikge1xuICAgICAgICB2YXIgY2FsbGVkID0gZmFsc2U7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBpZiAoY2FsbGVkKSB0aHJvdyBuZXcgRXJyb3IoXCJDYWxsYmFjayB3YXMgYWxyZWFkeSBjYWxsZWQuXCIpO1xuICAgICAgICAgICAgY2FsbGVkID0gdHJ1ZTtcbiAgICAgICAgICAgIGZuLmFwcGx5KHJvb3QsIGFyZ3VtZW50cyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwYXJhbGxlbCh0YXNrcywgY2FsbGJhY2spIHtcbiAgICAgICAgX3BhcmFsbGVsKHtcbiAgICAgICAgICAgIG1hcDogbWFwLFxuICAgICAgICAgICAgZWFjaDogZWFjaFxuICAgICAgICB9LCB0YXNrcywgY2FsbGJhY2spO1xuICAgIH1cblxuICAgIG1vZHVsZS5leHBvcnRzID0ge1xuICAgICAgICBzZXJpZXM6IHNlcmllcyxcbiAgICAgICAgcGFyYWxsZWw6IHBhcmFsbGVsXG4gICAgfTtcbn0pKCk7IiwiLypcbiAqIFRoaXMgaXMgYSBjb2xsZWN0aW9uIG9mIHV0aWxpdGllcyB0YWtlbiBmcm9tIGxpYnJhcmllcyBzdWNoIGFzIGFzeW5jLmpzLCB1bmRlcnNjb3JlLmpzIGV0Yy5cbiAqIEBtb2R1bGUgdXRpbFxuICovXG5cbihmdW5jdGlvbiAoKSB7XG4gICAgdmFyIF8gPSByZXF1aXJlKCcuL3VuZGVyc2NvcmUnKSxcbiAgICAgICAgYXN5bmMgPSByZXF1aXJlKCcuL2FzeW5jJyksXG4gICAgICAgIG1pc2MgPSByZXF1aXJlKCcuL21pc2MnKTtcblxuICAgIF8uZXh0ZW5kKG1vZHVsZS5leHBvcnRzLCB7XG4gICAgICAgIF86IF8sXG4gICAgICAgIGFzeW5jOiBhc3luY1xuICAgIH0pO1xuICAgIF8uZXh0ZW5kKG1vZHVsZS5leHBvcnRzLCBtaXNjKTtcblxufSkoKTsiLCIoZnVuY3Rpb24gKCkge1xuICAgIHZhciBvYnNlcnZlID0gcmVxdWlyZSgnLi4vLi4vdmVuZG9yL29ic2VydmUtanMvc3JjL29ic2VydmUnKS5QbGF0Zm9ybSxcbiAgICAgICAgXyA9IHJlcXVpcmUoJy4vdW5kZXJzY29yZScpLFxuICAgICAgICBQcm9taXNlID0gcmVxdWlyZSgnbGllJyksXG4gICAgICAgIGFyZ3NhcnJheSA9IHJlcXVpcmUoJ2FyZ3NhcnJheScpLFxuICAgICAgICBJbnRlcm5hbFNpZXN0YUVycm9yID0gcmVxdWlyZSgnLi8uLi9lcnJvcicpLkludGVybmFsU2llc3RhRXJyb3I7XG5cbiAgICAvLyBVc2VkIGJ5IHBhcmFtTmFtZXMgZnVuY3Rpb24uXG4gICAgdmFyIEZOX0FSR1MgPSAvXmZ1bmN0aW9uXFxzKlteXFwoXSpcXChcXHMqKFteXFwpXSopXFwpL20sXG4gICAgICAgIEZOX0FSR19TUExJVCA9IC8sLyxcbiAgICAgICAgRk5fQVJHID0gL15cXHMqKF8/KSguKz8pXFwxXFxzKiQvLFxuICAgICAgICBTVFJJUF9DT01NRU5UUyA9IC8oKFxcL1xcLy4qJCl8KFxcL1xcKltcXHNcXFNdKj9cXCpcXC8pKS9tZztcblxuICAgIGZ1bmN0aW9uIGNiKGNhbGxiYWNrLCBkZWZlcnJlZCkge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjay5hcHBseShjYWxsYmFjaywgYXJndW1lbnRzKTtcbiAgICAgICAgICAgIGlmIChkZWZlcnJlZCkge1xuICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgZGVmZXJyZWQucmVqZWN0KGVycik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBkZWZlcnJlZC5yZXNvbHZlLmFwcGx5KGRlZmVycmVkLCBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgdmFyIGlzQXJyYXlTaGltID0gZnVuY3Rpb24gKG9iaikge1xuICAgICAgICAgICAgcmV0dXJuIF8udG9TdHJpbmcuY2FsbChvYmopID09PSAnW29iamVjdCBBcnJheV0nO1xuICAgICAgICB9LFxuICAgICAgICBpc0FycmF5ID0gQXJyYXkuaXNBcnJheSB8fCBpc0FycmF5U2hpbSxcbiAgICAgICAgaXNTdHJpbmcgPSBmdW5jdGlvbiAobykge1xuICAgICAgICAgICAgcmV0dXJuIHR5cGVvZiBvID09ICdzdHJpbmcnIHx8IG8gaW5zdGFuY2VvZiBTdHJpbmdcbiAgICAgICAgfTtcbiAgICBfLmV4dGVuZChtb2R1bGUuZXhwb3J0cywge1xuICAgICAgICAvKipcbiAgICAgICAgICogUGVyZm9ybXMgZGlydHkgY2hlY2svT2JqZWN0Lm9ic2VydmUgY2FsbGJhY2tzIGRlcGVuZGluZyBvbiB0aGUgYnJvd3Nlci5cbiAgICAgICAgICpcbiAgICAgICAgICogSWYgT2JqZWN0Lm9ic2VydmUgaXMgcHJlc2VudCxcbiAgICAgICAgICogQHBhcmFtIGNhbGxiYWNrXG4gICAgICAgICAqL1xuICAgICAgICBuZXh0OiBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICAgICAgICAgIG9ic2VydmUucGVyZm9ybU1pY3JvdGFza0NoZWNrcG9pbnQoKTtcbiAgICAgICAgICAgIHNldFRpbWVvdXQoY2FsbGJhY2spO1xuICAgICAgICB9LFxuICAgICAgICAvKipcbiAgICAgICAgICogUmV0dXJucyBhIGhhbmRsZXIgdGhhdCBhY3RzIHVwb24gYSBjYWxsYmFjayBvciBhIHByb21pc2UgZGVwZW5kaW5nIG9uIHRoZSByZXN1bHQgb2YgYSBkaWZmZXJlbnQgY2FsbGJhY2suXG4gICAgICAgICAqIEBwYXJhbSBjYWxsYmFja1xuICAgICAgICAgKiBAcGFyYW0gW2RlZmVycmVkXVxuICAgICAgICAgKiBAcmV0dXJucyB7RnVuY3Rpb259XG4gICAgICAgICAqL1xuICAgICAgICBjYjogY2IsXG4gICAgICAgIGd1aWQ6IChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBmdW5jdGlvbiBzNCgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gTWF0aC5mbG9vcigoMSArIE1hdGgucmFuZG9tKCkpICogMHgxMDAwMClcbiAgICAgICAgICAgICAgICAgICAgLnRvU3RyaW5nKDE2KVxuICAgICAgICAgICAgICAgICAgICAuc3Vic3RyaW5nKDEpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBzNCgpICsgczQoKSArICctJyArIHM0KCkgKyAnLScgKyBzNCgpICsgJy0nICtcbiAgICAgICAgICAgICAgICAgICAgczQoKSArICctJyArIHM0KCkgKyBzNCgpICsgczQoKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgIH0pKCksXG4gICAgICAgIGFzc2VydDogZnVuY3Rpb24gKGNvbmRpdGlvbiwgbWVzc2FnZSwgY29udGV4dCkge1xuICAgICAgICAgICAgaWYgKCFjb25kaXRpb24pIHtcbiAgICAgICAgICAgICAgICBtZXNzYWdlID0gbWVzc2FnZSB8fCBcIkFzc2VydGlvbiBmYWlsZWRcIjtcbiAgICAgICAgICAgICAgICBjb250ZXh0ID0gY29udGV4dCB8fCB7fTtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcihtZXNzYWdlLCBjb250ZXh0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgdGhlbkJ5OiAoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgLyogbWl4aW4gZm9yIHRoZSBgdGhlbkJ5YCBwcm9wZXJ0eSAqL1xuICAgICAgICAgICAgZnVuY3Rpb24gZXh0ZW5kKGYpIHtcbiAgICAgICAgICAgICAgICBmLnRoZW5CeSA9IHRiO1xuICAgICAgICAgICAgICAgIHJldHVybiBmO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvKiBhZGRzIGEgc2Vjb25kYXJ5IGNvbXBhcmUgZnVuY3Rpb24gdG8gdGhlIHRhcmdldCBmdW5jdGlvbiAoYHRoaXNgIGNvbnRleHQpXG4gICAgICAgICAgICAgd2hpY2ggaXMgYXBwbGllZCBpbiBjYXNlIHRoZSBmaXJzdCBvbmUgcmV0dXJucyAwIChlcXVhbClcbiAgICAgICAgICAgICByZXR1cm5zIGEgbmV3IGNvbXBhcmUgZnVuY3Rpb24sIHdoaWNoIGhhcyBhIGB0aGVuQnlgIG1ldGhvZCBhcyB3ZWxsICovXG4gICAgICAgICAgICBmdW5jdGlvbiB0Yih5KSB7XG4gICAgICAgICAgICAgICAgdmFyIHggPSB0aGlzO1xuICAgICAgICAgICAgICAgIHJldHVybiBleHRlbmQoZnVuY3Rpb24gKGEsIGIpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHgoYSwgYikgfHwgeShhLCBiKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIGV4dGVuZDtcbiAgICAgICAgfSkoKSxcbiAgICAgICAgZGVmaW5lU3ViUHJvcGVydHk6IGZ1bmN0aW9uIChwcm9wZXJ0eSwgc3ViT2JqLCBpbm5lclByb3BlcnR5KSB7XG4gICAgICAgICAgICByZXR1cm4gT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsIHByb3BlcnR5LCB7XG4gICAgICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChpbm5lclByb3BlcnR5KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gc3ViT2JqW2lubmVyUHJvcGVydHldO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHN1Yk9ialtwcm9wZXJ0eV07XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHNldDogZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChpbm5lclByb3BlcnR5KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzdWJPYmpbaW5uZXJQcm9wZXJ0eV0gPSB2YWx1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHN1Yk9ialtwcm9wZXJ0eV0gPSB2YWx1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9LFxuICAgICAgICBkZWZpbmVTdWJQcm9wZXJ0eU5vU2V0OiBmdW5jdGlvbiAocHJvcGVydHksIHN1Yk9iaiwgaW5uZXJQcm9wZXJ0eSkge1xuICAgICAgICAgICAgcmV0dXJuIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCBwcm9wZXJ0eSwge1xuICAgICAgICAgICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoaW5uZXJQcm9wZXJ0eSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHN1Yk9ialtpbm5lclByb3BlcnR5XTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBzdWJPYmpbcHJvcGVydHldO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0sXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUT0RPOiBUaGlzIGlzIGJsb29keSB1Z2x5LlxuICAgICAgICAgKiBQcmV0dHkgZGFtbiB1c2VmdWwgdG8gYmUgYWJsZSB0byBhY2Nlc3MgdGhlIGJvdW5kIG9iamVjdCBvbiBhIGZ1bmN0aW9uIHRoby5cbiAgICAgICAgICogU2VlOiBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vcXVlc3Rpb25zLzE0MzA3MjY0L3doYXQtb2JqZWN0LWphdmFzY3JpcHQtZnVuY3Rpb24taXMtYm91bmQtdG8td2hhdC1pcy1pdHMtdGhpc1xuICAgICAgICAgKi9cbiAgICAgICAgX3BhdGNoQmluZDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdmFyIF9iaW5kID0gRnVuY3Rpb24ucHJvdG90eXBlLmFwcGx5LmJpbmQoRnVuY3Rpb24ucHJvdG90eXBlLmJpbmQpO1xuICAgICAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KEZ1bmN0aW9uLnByb3RvdHlwZSwgJ2JpbmQnLCB7XG4gICAgICAgICAgICAgICAgdmFsdWU6IGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGJvdW5kRnVuY3Rpb24gPSBfYmluZCh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgICAgICAgICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoYm91bmRGdW5jdGlvbiwgJ19fc2llc3RhX2JvdW5kX29iamVjdCcsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlOiBvYmosXG4gICAgICAgICAgICAgICAgICAgICAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGVudW1lcmFibGU6IGZhbHNlXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gYm91bmRGdW5jdGlvbjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSxcbiAgICAgICAgUHJvbWlzZTogUHJvbWlzZSxcbiAgICAgICAgcHJvbWlzZTogZnVuY3Rpb24gKGNiLCBmbikge1xuICAgICAgICAgICAgY2IgPSBjYiB8fCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgICAgICAgICAgICB2YXIgX2NiID0gYXJnc2FycmF5KGZ1bmN0aW9uIChhcmdzKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBlcnIgPSBhcmdzWzBdLFxuICAgICAgICAgICAgICAgICAgICAgICAgcmVzdCA9IGFyZ3Muc2xpY2UoMSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIHJlamVjdChlcnIpO1xuICAgICAgICAgICAgICAgICAgICBlbHNlIHJlc29sdmUocmVzdFswXSk7XG4gICAgICAgICAgICAgICAgICAgIHZhciBib3VuZCA9IGNiWydfX3NpZXN0YV9ib3VuZF9vYmplY3QnXSB8fCBjYjsgLy8gUHJlc2VydmUgYm91bmQgb2JqZWN0LlxuICAgICAgICAgICAgICAgICAgICBjYi5hcHBseShib3VuZCwgYXJncyk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgZm4oX2NiKTtcbiAgICAgICAgICAgIH0pXG4gICAgICAgIH0sXG4gICAgICAgIHN1YlByb3BlcnRpZXM6IGZ1bmN0aW9uIChvYmosIHN1Yk9iaiwgcHJvcGVydGllcykge1xuICAgICAgICAgICAgaWYgKCFpc0FycmF5KHByb3BlcnRpZXMpKSB7XG4gICAgICAgICAgICAgICAgcHJvcGVydGllcyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHByb3BlcnRpZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAoZnVuY3Rpb24gKHByb3BlcnR5KSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBvcHRzID0ge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2V0OiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIG5hbWU6IHByb3BlcnR5LFxuICAgICAgICAgICAgICAgICAgICAgICAgcHJvcGVydHk6IHByb3BlcnR5XG4gICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgICAgIGlmICghaXNTdHJpbmcocHJvcGVydHkpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBfLmV4dGVuZChvcHRzLCBwcm9wZXJ0eSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgdmFyIGRlc2MgPSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gc3ViT2JqW29wdHMucHJvcGVydHldO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG9wdHMuc2V0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjLnNldCA9IGZ1bmN0aW9uICh2KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3ViT2JqW29wdHMucHJvcGVydHldID0gdjtcbiAgICAgICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG9iaiwgb3B0cy5uYW1lLCBkZXNjKTtcbiAgICAgICAgICAgICAgICB9KShwcm9wZXJ0aWVzW2ldKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgY2FwaXRhbGlzZUZpcnN0TGV0dGVyOiBmdW5jdGlvbiAoc3RyaW5nKSB7XG4gICAgICAgICAgICByZXR1cm4gc3RyaW5nLmNoYXJBdCgwKS50b1VwcGVyQ2FzZSgpICsgc3RyaW5nLnNsaWNlKDEpO1xuICAgICAgICB9LFxuICAgICAgICBleHRlbmRGcm9tT3B0czogZnVuY3Rpb24gKG9iaiwgb3B0cywgZGVmYXVsdHMsIGVycm9yT25Vbmtub3duKSB7XG4gICAgICAgICAgICBlcnJvck9uVW5rbm93biA9IGVycm9yT25Vbmtub3duID09IHVuZGVmaW5lZCA/IHRydWUgOiBlcnJvck9uVW5rbm93bjtcbiAgICAgICAgICAgIGlmIChlcnJvck9uVW5rbm93bikge1xuICAgICAgICAgICAgICAgIHZhciBkZWZhdWx0S2V5cyA9IE9iamVjdC5rZXlzKGRlZmF1bHRzKSxcbiAgICAgICAgICAgICAgICAgICAgb3B0c0tleXMgPSBPYmplY3Qua2V5cyhvcHRzKTtcbiAgICAgICAgICAgICAgICB2YXIgdW5rbm93bktleXMgPSBvcHRzS2V5cy5maWx0ZXIoZnVuY3Rpb24gKG4pIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGRlZmF1bHRLZXlzLmluZGV4T2YobikgPT0gLTFcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBpZiAodW5rbm93bktleXMubGVuZ3RoKSB0aHJvdyBFcnJvcignVW5rbm93biBvcHRpb25zOiAnICsgdW5rbm93bktleXMudG9TdHJpbmcoKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBBcHBseSBhbnkgZnVuY3Rpb25zIHNwZWNpZmllZCBpbiB0aGUgZGVmYXVsdHMuXG4gICAgICAgICAgICBfLmVhY2goT2JqZWN0LmtleXMoZGVmYXVsdHMpLCBmdW5jdGlvbiAoaykge1xuICAgICAgICAgICAgICAgIHZhciBkID0gZGVmYXVsdHNba107XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBkID09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgICAgICAgICAgZGVmYXVsdHNba10gPSBkKG9wdHNba10pO1xuICAgICAgICAgICAgICAgICAgICBkZWxldGUgb3B0c1trXTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIF8uZXh0ZW5kKGRlZmF1bHRzLCBvcHRzKTtcbiAgICAgICAgICAgIF8uZXh0ZW5kKG9iaiwgZGVmYXVsdHMpO1xuICAgICAgICB9LFxuICAgICAgICBpc1N0cmluZzogaXNTdHJpbmcsXG4gICAgICAgIGlzQXJyYXk6IGlzQXJyYXksXG4gICAgICAgIHByZXR0eVByaW50OiBmdW5jdGlvbiAobykge1xuICAgICAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KG8sIG51bGwsIDQpO1xuICAgICAgICB9LFxuICAgICAgICBmbGF0dGVuQXJyYXk6IGZ1bmN0aW9uIChhcnIpIHtcbiAgICAgICAgICAgIHJldHVybiBfLnJlZHVjZShhcnIsIGZ1bmN0aW9uIChtZW1vLCBlKSB7XG4gICAgICAgICAgICAgICAgaWYgKGlzQXJyYXkoZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgbWVtbyA9IG1lbW8uY29uY2F0KGUpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIG1lbW8ucHVzaChlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIG1lbW87XG4gICAgICAgICAgICB9LCBbXSk7XG4gICAgICAgIH0sXG4gICAgICAgIHVuZmxhdHRlbkFycmF5OiBmdW5jdGlvbiAoYXJyLCBtb2RlbEFycikge1xuICAgICAgICAgICAgdmFyIG4gPSAwO1xuICAgICAgICAgICAgdmFyIHVuZmxhdHRlbmVkID0gW107XG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IG1vZGVsQXJyLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgaWYgKGlzQXJyYXkobW9kZWxBcnJbaV0pKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBuZXdBcnIgPSBbXTtcbiAgICAgICAgICAgICAgICAgICAgdW5mbGF0dGVuZWRbaV0gPSBuZXdBcnI7XG4gICAgICAgICAgICAgICAgICAgIGZvciAodmFyIGogPSAwOyBqIDwgbW9kZWxBcnJbaV0ubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG5ld0Fyci5wdXNoKGFycltuXSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBuKys7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB1bmZsYXR0ZW5lZFtpXSA9IGFycltuXTtcbiAgICAgICAgICAgICAgICAgICAgbisrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB1bmZsYXR0ZW5lZDtcbiAgICAgICAgfSxcbiAgICAgICAgLyoqXG4gICAgICAgICAqIFJldHVybiB0aGUgcGFyYW1ldGVyIG5hbWVzIG9mIGEgZnVuY3Rpb24uXG4gICAgICAgICAqIE5vdGU6IGFkYXB0ZWQgZnJvbSBBbmd1bGFySlMgZGVwZW5kZW5jeSBpbmplY3Rpb24gOilcbiAgICAgICAgICogQHBhcmFtIGZuXG4gICAgICAgICAqL1xuICAgICAgICBwYXJhbU5hbWVzOiBmdW5jdGlvbiAoZm4pIHtcbiAgICAgICAgICAgIC8vIFRPRE86IElzIHRoZXJlIGEgbW9yZSByb2J1c3Qgd2F5IG9mIGRvaW5nIHRoaXM/XG4gICAgICAgICAgICB2YXIgcGFyYW1zID0gW10sXG4gICAgICAgICAgICAgICAgZm5UZXh0LFxuICAgICAgICAgICAgICAgIGFyZ0RlY2w7XG4gICAgICAgICAgICBmblRleHQgPSBmbi50b1N0cmluZygpLnJlcGxhY2UoU1RSSVBfQ09NTUVOVFMsICcnKTtcbiAgICAgICAgICAgIGFyZ0RlY2wgPSBmblRleHQubWF0Y2goRk5fQVJHUyk7XG5cbiAgICAgICAgICAgIGFyZ0RlY2xbMV0uc3BsaXQoRk5fQVJHX1NQTElUKS5mb3JFYWNoKGZ1bmN0aW9uIChhcmcpIHtcbiAgICAgICAgICAgICAgICBhcmcucmVwbGFjZShGTl9BUkcsIGZ1bmN0aW9uIChhbGwsIHVuZGVyc2NvcmUsIG5hbWUpIHtcbiAgICAgICAgICAgICAgICAgICAgcGFyYW1zLnB1c2gobmFtZSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiBwYXJhbXM7XG4gICAgICAgIH1cbiAgICB9KTtcbn0pKCk7IiwiLyoqXG4gKiBPZnRlbiB1c2VkIGZ1bmN0aW9ucyBmcm9tIHVuZGVyc2NvcmUsIHB1bGxlZCBvdXQgZm9yIGJyZXZpdHkuXG4gKiBAbW9kdWxlIHVuZGVyc2NvcmVcbiAqL1xuXG4oZnVuY3Rpb24gKCkge1xuICAgIHZhciBfID0ge30sXG4gICAgICAgIEFycmF5UHJvdG8gPSBBcnJheS5wcm90b3R5cGUsXG4gICAgICAgIEZ1bmNQcm90byA9IEZ1bmN0aW9uLnByb3RvdHlwZSxcbiAgICAgICAgbmF0aXZlRm9yRWFjaCA9IEFycmF5UHJvdG8uZm9yRWFjaCxcbiAgICAgICAgbmF0aXZlTWFwID0gQXJyYXlQcm90by5tYXAsXG4gICAgICAgIG5hdGl2ZVJlZHVjZSA9IEFycmF5UHJvdG8ucmVkdWNlLFxuICAgICAgICBuYXRpdmVCaW5kID0gRnVuY1Byb3RvLmJpbmQsXG4gICAgICAgIHNsaWNlID0gQXJyYXlQcm90by5zbGljZSxcbiAgICAgICAgYnJlYWtlciA9IHt9LFxuICAgICAgICBjdG9yID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB9O1xuXG4gICAgZnVuY3Rpb24ga2V5cyhvYmopIHtcbiAgICAgICAgaWYgKE9iamVjdC5rZXlzKSB7XG4gICAgICAgICAgICByZXR1cm4gT2JqZWN0LmtleXMob2JqKTtcbiAgICAgICAgfVxuICAgICAgICB2YXIga2V5cyA9IFtdO1xuICAgICAgICBmb3IgKHZhciBrIGluIG9iaikge1xuICAgICAgICAgICAgaWYgKG9iai5oYXNPd25Qcm9wZXJ0eShrKSkge1xuICAgICAgICAgICAgICAgIGtleXMucHVzaChrKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4ga2V5cztcbiAgICB9XG5cbiAgICBfLmtleXMgPSBrZXlzO1xuXG4gICAgXy5lYWNoID0gXy5mb3JFYWNoID0gZnVuY3Rpb24gKG9iaiwgaXRlcmF0b3IsIGNvbnRleHQpIHtcbiAgICAgICAgaWYgKG9iaiA9PSBudWxsKSByZXR1cm4gb2JqO1xuICAgICAgICBpZiAobmF0aXZlRm9yRWFjaCAmJiBvYmouZm9yRWFjaCA9PT0gbmF0aXZlRm9yRWFjaCkge1xuICAgICAgICAgICAgb2JqLmZvckVhY2goaXRlcmF0b3IsIGNvbnRleHQpO1xuICAgICAgICB9IGVsc2UgaWYgKG9iai5sZW5ndGggPT09ICtvYmoubGVuZ3RoKSB7XG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMCwgbGVuZ3RoID0gb2JqLmxlbmd0aDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgaWYgKGl0ZXJhdG9yLmNhbGwoY29udGV4dCwgb2JqW2ldLCBpLCBvYmopID09PSBicmVha2VyKSByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB2YXIga2V5cyA9IF8ua2V5cyhvYmopO1xuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbmd0aCA9IGtleXMubGVuZ3RoOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpZiAoaXRlcmF0b3IuY2FsbChjb250ZXh0LCBvYmpba2V5c1tpXV0sIGtleXNbaV0sIG9iaikgPT09IGJyZWFrZXIpIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gb2JqO1xuICAgIH07XG5cbiAgICAvLyBSZXR1cm4gdGhlIHJlc3VsdHMgb2YgYXBwbHlpbmcgdGhlIGl0ZXJhdG9yIHRvIGVhY2ggZWxlbWVudC5cbiAgICAvLyBEZWxlZ2F0ZXMgdG8gKipFQ01BU2NyaXB0IDUqKidzIG5hdGl2ZSBgbWFwYCBpZiBhdmFpbGFibGUuXG4gICAgXy5tYXAgPSBfLmNvbGxlY3QgPSBmdW5jdGlvbiAob2JqLCBpdGVyYXRvciwgY29udGV4dCkge1xuICAgICAgICB2YXIgcmVzdWx0cyA9IFtdO1xuICAgICAgICBpZiAob2JqID09IG51bGwpIHJldHVybiByZXN1bHRzO1xuICAgICAgICBpZiAobmF0aXZlTWFwICYmIG9iai5tYXAgPT09IG5hdGl2ZU1hcCkgcmV0dXJuIG9iai5tYXAoaXRlcmF0b3IsIGNvbnRleHQpO1xuICAgICAgICBfLmVhY2gob2JqLCBmdW5jdGlvbiAodmFsdWUsIGluZGV4LCBsaXN0KSB7XG4gICAgICAgICAgICByZXN1bHRzLnB1c2goaXRlcmF0b3IuY2FsbChjb250ZXh0LCB2YWx1ZSwgaW5kZXgsIGxpc3QpKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiByZXN1bHRzO1xuICAgIH07XG5cbiAgICAvLyBJbnRlcm5hbCBmdW5jdGlvbiB0aGF0IHJldHVybnMgYW4gZWZmaWNpZW50IChmb3IgY3VycmVudCBlbmdpbmVzKSB2ZXJzaW9uXG4gICAgLy8gb2YgdGhlIHBhc3NlZC1pbiBjYWxsYmFjaywgdG8gYmUgcmVwZWF0ZWRseSBhcHBsaWVkIGluIG90aGVyIFVuZGVyc2NvcmVcbiAgICAvLyBmdW5jdGlvbnMuXG4gICAgdmFyIGNyZWF0ZUNhbGxiYWNrID0gZnVuY3Rpb24gKGZ1bmMsIGNvbnRleHQsIGFyZ0NvdW50KSB7XG4gICAgICAgIGlmIChjb250ZXh0ID09PSB2b2lkIDApIHJldHVybiBmdW5jO1xuICAgICAgICBzd2l0Y2ggKGFyZ0NvdW50ID09IG51bGwgPyAzIDogYXJnQ291bnQpIHtcbiAgICAgICAgICAgIGNhc2UgMTpcbiAgICAgICAgICAgICAgICByZXR1cm4gZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmdW5jLmNhbGwoY29udGV4dCwgdmFsdWUpO1xuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICBjYXNlIDI6XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uICh2YWx1ZSwgb3RoZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZ1bmMuY2FsbChjb250ZXh0LCB2YWx1ZSwgb3RoZXIpO1xuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICBjYXNlIDM6XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uICh2YWx1ZSwgaW5kZXgsIGNvbGxlY3Rpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZ1bmMuY2FsbChjb250ZXh0LCB2YWx1ZSwgaW5kZXgsIGNvbGxlY3Rpb24pO1xuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICBjYXNlIDQ6XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIChhY2N1bXVsYXRvciwgdmFsdWUsIGluZGV4LCBjb2xsZWN0aW9uKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmdW5jLmNhbGwoY29udGV4dCwgYWNjdW11bGF0b3IsIHZhbHVlLCBpbmRleCwgY29sbGVjdGlvbik7XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIGZ1bmMuYXBwbHkoY29udGV4dCwgYXJndW1lbnRzKTtcbiAgICAgICAgfTtcbiAgICB9O1xuXG4gICAgLy8gUnVuIGEgZnVuY3Rpb24gKipuKiogdGltZXMuXG4gICAgXy50aW1lcyA9IGZ1bmN0aW9uIChuLCBpdGVyYXRlZSwgY29udGV4dCkge1xuICAgICAgICB2YXIgYWNjdW0gPSBuZXcgQXJyYXkoTWF0aC5tYXgoMCwgbikpO1xuICAgICAgICBpdGVyYXRlZSA9IGNyZWF0ZUNhbGxiYWNrKGl0ZXJhdGVlLCBjb250ZXh0LCAxKTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBuOyBpKyspIGFjY3VtW2ldID0gaXRlcmF0ZWUoaSk7XG4gICAgICAgIHJldHVybiBhY2N1bTtcbiAgICB9O1xuXG4gICAgLy8gUGFydGlhbGx5IGFwcGx5IGEgZnVuY3Rpb24gYnkgY3JlYXRpbmcgYSB2ZXJzaW9uIHRoYXQgaGFzIGhhZCBzb21lIG9mIGl0c1xuICAgIC8vIGFyZ3VtZW50cyBwcmUtZmlsbGVkLCB3aXRob3V0IGNoYW5naW5nIGl0cyBkeW5hbWljIGB0aGlzYCBjb250ZXh0LiBfIGFjdHNcbiAgICAvLyBhcyBhIHBsYWNlaG9sZGVyLCBhbGxvd2luZyBhbnkgY29tYmluYXRpb24gb2YgYXJndW1lbnRzIHRvIGJlIHByZS1maWxsZWQuXG4gICAgXy5wYXJ0aWFsID0gZnVuY3Rpb24gKGZ1bmMpIHtcbiAgICAgICAgdmFyIGJvdW5kQXJncyA9IHNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHZhciBwb3NpdGlvbiA9IDA7XG4gICAgICAgICAgICB2YXIgYXJncyA9IGJvdW5kQXJncy5zbGljZSgpO1xuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbmd0aCA9IGFyZ3MubGVuZ3RoOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpZiAoYXJnc1tpXSA9PT0gXykgYXJnc1tpXSA9IGFyZ3VtZW50c1twb3NpdGlvbisrXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHdoaWxlIChwb3NpdGlvbiA8IGFyZ3VtZW50cy5sZW5ndGgpIGFyZ3MucHVzaChhcmd1bWVudHNbcG9zaXRpb24rK10pO1xuICAgICAgICAgICAgcmV0dXJuIGZ1bmMuYXBwbHkodGhpcywgYXJncyk7XG4gICAgICAgIH07XG4gICAgfTtcblxuICAgIC8vIENvbnZlbmllbmNlIHZlcnNpb24gb2YgYSBjb21tb24gdXNlIGNhc2Ugb2YgYG1hcGA6IGZldGNoaW5nIGEgcHJvcGVydHkuXG4gICAgXy5wbHVjayA9IGZ1bmN0aW9uIChvYmosIGtleSkge1xuICAgICAgICByZXR1cm4gXy5tYXAob2JqLCBfLnByb3BlcnR5KGtleSkpO1xuICAgIH07XG5cbiAgICB2YXIgcmVkdWNlRXJyb3IgPSAnUmVkdWNlIG9mIGVtcHR5IGFycmF5IHdpdGggbm8gaW5pdGlhbCB2YWx1ZSc7XG5cbiAgICAvLyAqKlJlZHVjZSoqIGJ1aWxkcyB1cCBhIHNpbmdsZSByZXN1bHQgZnJvbSBhIGxpc3Qgb2YgdmFsdWVzLCBha2EgYGluamVjdGAsXG4gICAgLy8gb3IgYGZvbGRsYC4gRGVsZWdhdGVzIHRvICoqRUNNQVNjcmlwdCA1KioncyBuYXRpdmUgYHJlZHVjZWAgaWYgYXZhaWxhYmxlLlxuICAgIF8ucmVkdWNlID0gXy5mb2xkbCA9IF8uaW5qZWN0ID0gZnVuY3Rpb24gKG9iaiwgaXRlcmF0b3IsIG1lbW8sIGNvbnRleHQpIHtcbiAgICAgICAgdmFyIGluaXRpYWwgPSBhcmd1bWVudHMubGVuZ3RoID4gMjtcbiAgICAgICAgaWYgKG9iaiA9PSBudWxsKSBvYmogPSBbXTtcbiAgICAgICAgaWYgKG5hdGl2ZVJlZHVjZSAmJiBvYmoucmVkdWNlID09PSBuYXRpdmVSZWR1Y2UpIHtcbiAgICAgICAgICAgIGlmIChjb250ZXh0KSBpdGVyYXRvciA9IF8uYmluZChpdGVyYXRvciwgY29udGV4dCk7XG4gICAgICAgICAgICByZXR1cm4gaW5pdGlhbCA/IG9iai5yZWR1Y2UoaXRlcmF0b3IsIG1lbW8pIDogb2JqLnJlZHVjZShpdGVyYXRvcik7XG4gICAgICAgIH1cbiAgICAgICAgXy5lYWNoKG9iaiwgZnVuY3Rpb24gKHZhbHVlLCBpbmRleCwgbGlzdCkge1xuICAgICAgICAgICAgaWYgKCFpbml0aWFsKSB7XG4gICAgICAgICAgICAgICAgbWVtbyA9IHZhbHVlO1xuICAgICAgICAgICAgICAgIGluaXRpYWwgPSB0cnVlO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBtZW1vID0gaXRlcmF0b3IuY2FsbChjb250ZXh0LCBtZW1vLCB2YWx1ZSwgaW5kZXgsIGxpc3QpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgaWYgKCFpbml0aWFsKSB0aHJvdyBuZXcgVHlwZUVycm9yKHJlZHVjZUVycm9yKTtcbiAgICAgICAgcmV0dXJuIG1lbW87XG4gICAgfTtcblxuICAgIF8ucHJvcGVydHkgPSBmdW5jdGlvbiAoa2V5KSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbiAob2JqKSB7XG4gICAgICAgICAgICByZXR1cm4gb2JqW2tleV07XG4gICAgICAgIH07XG4gICAgfTtcblxuICAgIC8vIE9wdGltaXplIGBpc0Z1bmN0aW9uYCBpZiBhcHByb3ByaWF0ZS5cbiAgICBpZiAodHlwZW9mKC8uLykgIT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgXy5pc0Z1bmN0aW9uID0gZnVuY3Rpb24gKG9iaikge1xuICAgICAgICAgICAgcmV0dXJuIHR5cGVvZiBvYmogPT09ICdmdW5jdGlvbic7XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgXy5pc09iamVjdCA9IGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgdmFyIHR5cGUgPSB0eXBlb2Ygb2JqO1xuICAgICAgICByZXR1cm4gdHlwZSA9PT0gJ2Z1bmN0aW9uJyB8fCB0eXBlID09PSAnb2JqZWN0JyAmJiAhIW9iajtcbiAgICB9O1xuXG4gICAgLy8gQW4gaW50ZXJuYWwgZnVuY3Rpb24gdG8gZ2VuZXJhdGUgbG9va3VwIGl0ZXJhdG9ycy5cbiAgICB2YXIgbG9va3VwSXRlcmF0b3IgPSBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgaWYgKHZhbHVlID09IG51bGwpIHJldHVybiBfLmlkZW50aXR5O1xuICAgICAgICBpZiAoXy5pc0Z1bmN0aW9uKHZhbHVlKSkgcmV0dXJuIHZhbHVlO1xuICAgICAgICByZXR1cm4gXy5wcm9wZXJ0eSh2YWx1ZSk7XG4gICAgfTtcblxuICAgIC8vIFNvcnQgdGhlIG9iamVjdCdzIHZhbHVlcyBieSBhIGNyaXRlcmlvbiBwcm9kdWNlZCBieSBhbiBpdGVyYXRvci5cbiAgICBfLnNvcnRCeSA9IGZ1bmN0aW9uIChvYmosIGl0ZXJhdG9yLCBjb250ZXh0KSB7XG4gICAgICAgIGl0ZXJhdG9yID0gbG9va3VwSXRlcmF0b3IoaXRlcmF0b3IpO1xuICAgICAgICByZXR1cm4gXy5wbHVjayhfLm1hcChvYmosIGZ1bmN0aW9uICh2YWx1ZSwgaW5kZXgsIGxpc3QpIHtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgdmFsdWU6IHZhbHVlLFxuICAgICAgICAgICAgICAgIGluZGV4OiBpbmRleCxcbiAgICAgICAgICAgICAgICBjcml0ZXJpYTogaXRlcmF0b3IuY2FsbChjb250ZXh0LCB2YWx1ZSwgaW5kZXgsIGxpc3QpXG4gICAgICAgICAgICB9O1xuICAgICAgICB9KS5zb3J0KGZ1bmN0aW9uIChsZWZ0LCByaWdodCkge1xuICAgICAgICAgICAgdmFyIGEgPSBsZWZ0LmNyaXRlcmlhO1xuICAgICAgICAgICAgdmFyIGIgPSByaWdodC5jcml0ZXJpYTtcbiAgICAgICAgICAgIGlmIChhICE9PSBiKSB7XG4gICAgICAgICAgICAgICAgaWYgKGEgPiBiIHx8IGEgPT09IHZvaWQgMCkgcmV0dXJuIDE7XG4gICAgICAgICAgICAgICAgaWYgKGEgPCBiIHx8IGIgPT09IHZvaWQgMCkgcmV0dXJuIC0xO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGxlZnQuaW5kZXggLSByaWdodC5pbmRleDtcbiAgICAgICAgfSksICd2YWx1ZScpO1xuICAgIH07XG5cblxuICAgIC8vIENyZWF0ZSBhIGZ1bmN0aW9uIGJvdW5kIHRvIGEgZ2l2ZW4gb2JqZWN0IChhc3NpZ25pbmcgYHRoaXNgLCBhbmQgYXJndW1lbnRzLFxuICAgIC8vIG9wdGlvbmFsbHkpLiBEZWxlZ2F0ZXMgdG8gKipFQ01BU2NyaXB0IDUqKidzIG5hdGl2ZSBgRnVuY3Rpb24uYmluZGAgaWZcbiAgICAvLyBhdmFpbGFibGUuXG4gICAgXy5iaW5kID0gZnVuY3Rpb24gKGZ1bmMsIGNvbnRleHQpIHtcbiAgICAgICAgdmFyIGFyZ3MsIGJvdW5kO1xuICAgICAgICBpZiAobmF0aXZlQmluZCAmJiBmdW5jLmJpbmQgPT09IG5hdGl2ZUJpbmQpIHJldHVybiBuYXRpdmVCaW5kLmFwcGx5KGZ1bmMsIHNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKSk7XG4gICAgICAgIGlmICghXy5pc0Z1bmN0aW9uKGZ1bmMpKSB0aHJvdyBuZXcgVHlwZUVycm9yO1xuICAgICAgICBhcmdzID0gc2xpY2UuY2FsbChhcmd1bWVudHMsIDIpO1xuICAgICAgICByZXR1cm4gYm91bmQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBpZiAoISh0aGlzIGluc3RhbmNlb2YgYm91bmQpKSByZXR1cm4gZnVuYy5hcHBseShjb250ZXh0LCBhcmdzLmNvbmNhdChzbGljZS5jYWxsKGFyZ3VtZW50cykpKTtcbiAgICAgICAgICAgIGN0b3IucHJvdG90eXBlID0gZnVuYy5wcm90b3R5cGU7XG4gICAgICAgICAgICB2YXIgc2VsZiA9IG5ldyBjdG9yO1xuICAgICAgICAgICAgY3Rvci5wcm90b3R5cGUgPSBudWxsO1xuICAgICAgICAgICAgdVxuICAgICAgICAgICAgdmFyIHJlc3VsdCA9IGZ1bmMuYXBwbHkoc2VsZiwgYXJncy5jb25jYXQoc2xpY2UuY2FsbChhcmd1bWVudHMpKSk7XG4gICAgICAgICAgICBpZiAoT2JqZWN0KHJlc3VsdCkgPT09IHJlc3VsdCkgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgICAgIHJldHVybiBzZWxmO1xuICAgICAgICB9O1xuICAgIH07XG5cbiAgICBfLmlkZW50aXR5ID0gZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgIHJldHVybiB2YWx1ZTtcbiAgICB9O1xuXG4gICAgXy56aXAgPSBmdW5jdGlvbiAoYXJyYXkpIHtcbiAgICAgICAgaWYgKGFycmF5ID09IG51bGwpIHJldHVybiBbXTtcbiAgICAgICAgdmFyIGxlbmd0aCA9IF8ubWF4KGFyZ3VtZW50cywgJ2xlbmd0aCcpLmxlbmd0aDtcbiAgICAgICAgdmFyIHJlc3VsdHMgPSBBcnJheShsZW5ndGgpO1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICByZXN1bHRzW2ldID0gXy5wbHVjayhhcmd1bWVudHMsIGkpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXN1bHRzO1xuICAgIH07XG5cbiAgICAvLyBSZXR1cm4gdGhlIG1heGltdW0gZWxlbWVudCAob3IgZWxlbWVudC1iYXNlZCBjb21wdXRhdGlvbikuXG4gICAgXy5tYXggPSBmdW5jdGlvbiAob2JqLCBpdGVyYXRlZSwgY29udGV4dCkge1xuICAgICAgICB2YXIgcmVzdWx0ID0gLUluZmluaXR5LFxuICAgICAgICAgICAgbGFzdENvbXB1dGVkID0gLUluZmluaXR5LFxuICAgICAgICAgICAgdmFsdWUsIGNvbXB1dGVkO1xuICAgICAgICBpZiAoaXRlcmF0ZWUgPT0gbnVsbCAmJiBvYmogIT0gbnVsbCkge1xuICAgICAgICAgICAgb2JqID0gb2JqLmxlbmd0aCA9PT0gK29iai5sZW5ndGggPyBvYmogOiBfLnZhbHVlcyhvYmopO1xuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbmd0aCA9IG9iai5sZW5ndGg7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIHZhbHVlID0gb2JqW2ldO1xuICAgICAgICAgICAgICAgIGlmICh2YWx1ZSA+IHJlc3VsdCkge1xuICAgICAgICAgICAgICAgICAgICByZXN1bHQgPSB2YWx1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpdGVyYXRlZSA9IF8uaXRlcmF0ZWUoaXRlcmF0ZWUsIGNvbnRleHQpO1xuICAgICAgICAgICAgXy5lYWNoKG9iaiwgZnVuY3Rpb24gKHZhbHVlLCBpbmRleCwgbGlzdCkge1xuICAgICAgICAgICAgICAgIGNvbXB1dGVkID0gaXRlcmF0ZWUodmFsdWUsIGluZGV4LCBsaXN0KTtcbiAgICAgICAgICAgICAgICBpZiAoY29tcHV0ZWQgPiBsYXN0Q29tcHV0ZWQgfHwgY29tcHV0ZWQgPT09IC1JbmZpbml0eSAmJiByZXN1bHQgPT09IC1JbmZpbml0eSkge1xuICAgICAgICAgICAgICAgICAgICByZXN1bHQgPSB2YWx1ZTtcbiAgICAgICAgICAgICAgICAgICAgbGFzdENvbXB1dGVkID0gY29tcHV0ZWQ7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9O1xuXG5cbiAgICBfLml0ZXJhdGVlID0gZnVuY3Rpb24gKHZhbHVlLCBjb250ZXh0LCBhcmdDb3VudCkge1xuICAgICAgICBpZiAodmFsdWUgPT0gbnVsbCkgcmV0dXJuIF8uaWRlbnRpdHk7XG4gICAgICAgIGlmIChfLmlzRnVuY3Rpb24odmFsdWUpKSByZXR1cm4gY3JlYXRlQ2FsbGJhY2sodmFsdWUsIGNvbnRleHQsIGFyZ0NvdW50KTtcbiAgICAgICAgaWYgKF8uaXNPYmplY3QodmFsdWUpKSByZXR1cm4gXy5tYXRjaGVzKHZhbHVlKTtcbiAgICAgICAgcmV0dXJuIF8ucHJvcGVydHkodmFsdWUpO1xuICAgIH07XG5cbiAgICBfLnBhaXJzID0gZnVuY3Rpb24gKG9iaikge1xuICAgICAgICB2YXIga2V5cyA9IF8ua2V5cyhvYmopO1xuICAgICAgICB2YXIgbGVuZ3RoID0ga2V5cy5sZW5ndGg7XG4gICAgICAgIHZhciBwYWlycyA9IEFycmF5KGxlbmd0aCk7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHBhaXJzW2ldID0gW2tleXNbaV0sIG9ialtrZXlzW2ldXV07XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHBhaXJzO1xuICAgIH07XG5cbiAgICBfLm1hdGNoZXMgPSBmdW5jdGlvbiAoYXR0cnMpIHtcbiAgICAgICAgdmFyIHBhaXJzID0gXy5wYWlycyhhdHRycyksXG4gICAgICAgICAgICBsZW5ndGggPSBwYWlycy5sZW5ndGg7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbiAob2JqKSB7XG4gICAgICAgICAgICBpZiAob2JqID09IG51bGwpIHJldHVybiAhbGVuZ3RoO1xuICAgICAgICAgICAgb2JqID0gbmV3IE9iamVjdChvYmopO1xuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIHZhciBwYWlyID0gcGFpcnNbaV0sXG4gICAgICAgICAgICAgICAgICAgIGtleSA9IHBhaXJbMF07XG4gICAgICAgICAgICAgICAgaWYgKHBhaXJbMV0gIT09IG9ialtrZXldIHx8ICEoa2V5IGluIG9iaikpIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9O1xuICAgIH07XG5cbiAgICBfLnNvbWUgPSBmdW5jdGlvbiAob2JqLCBwcmVkaWNhdGUsIGNvbnRleHQpIHtcbiAgICAgICAgaWYgKG9iaiA9PSBudWxsKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIHByZWRpY2F0ZSA9IF8uaXRlcmF0ZWUocHJlZGljYXRlLCBjb250ZXh0KTtcbiAgICAgICAgdmFyIGtleXMgPSBvYmoubGVuZ3RoICE9PSArb2JqLmxlbmd0aCAmJiBfLmtleXMob2JqKSxcbiAgICAgICAgICAgIGxlbmd0aCA9IChrZXlzIHx8IG9iaikubGVuZ3RoLFxuICAgICAgICAgICAgaW5kZXgsIGN1cnJlbnRLZXk7XG4gICAgICAgIGZvciAoaW5kZXggPSAwOyBpbmRleCA8IGxlbmd0aDsgaW5kZXgrKykge1xuICAgICAgICAgICAgY3VycmVudEtleSA9IGtleXMgPyBrZXlzW2luZGV4XSA6IGluZGV4O1xuICAgICAgICAgICAgaWYgKHByZWRpY2F0ZShvYmpbY3VycmVudEtleV0sIGN1cnJlbnRLZXksIG9iaikpIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9O1xuXG5cbiAgICAvLyBFeHRlbmQgYSBnaXZlbiBvYmplY3Qgd2l0aCBhbGwgdGhlIHByb3BlcnRpZXMgaW4gcGFzc2VkLWluIG9iamVjdChzKS5cbiAgICBfLmV4dGVuZCA9IGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgaWYgKCFfLmlzT2JqZWN0KG9iaikpIHJldHVybiBvYmo7XG4gICAgICAgIHZhciBzb3VyY2UsIHByb3A7XG4gICAgICAgIGZvciAodmFyIGkgPSAxLCBsZW5ndGggPSBhcmd1bWVudHMubGVuZ3RoOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHNvdXJjZSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgICAgIGZvciAocHJvcCBpbiBzb3VyY2UpIHtcbiAgICAgICAgICAgICAgICAvL25vaW5zcGVjdGlvbiBKU1VuZmlsdGVyZWRGb3JJbkxvb3BcbiAgICAgICAgICAgICAgICBpZiAoaGFzT3duUHJvcGVydHkuY2FsbChzb3VyY2UsIHByb3ApKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vbm9pbnNwZWN0aW9uIEpTVW5maWx0ZXJlZEZvckluTG9vcFxuICAgICAgICAgICAgICAgICAgICBvYmpbcHJvcF0gPSBzb3VyY2VbcHJvcF07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBvYmo7XG4gICAgfTtcblxuICAgIG1vZHVsZS5leHBvcnRzID0gXztcbn0pKCk7IiwiJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGFyZ3NBcnJheTtcblxuZnVuY3Rpb24gYXJnc0FycmF5KGZ1bikge1xuICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgIHZhciBsZW4gPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgIGlmIChsZW4pIHtcbiAgICAgIHZhciBhcmdzID0gW107XG4gICAgICB2YXIgaSA9IC0xO1xuICAgICAgd2hpbGUgKCsraSA8IGxlbikge1xuICAgICAgICBhcmdzW2ldID0gYXJndW1lbnRzW2ldO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGZ1bi5jYWxsKHRoaXMsIGFyZ3MpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gZnVuLmNhbGwodGhpcywgW10pO1xuICAgIH1cbiAgfTtcbn0iLG51bGwsIi8vIENvcHlyaWdodCBKb3llbnQsIEluYy4gYW5kIG90aGVyIE5vZGUgY29udHJpYnV0b3JzLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhXG4vLyBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlXG4vLyBcIlNvZnR3YXJlXCIpLCB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmdcbi8vIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCxcbi8vIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXRcbi8vIHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZVxuLy8gZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4vL1xuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWRcbi8vIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuLy9cbi8vIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1Ncbi8vIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0Zcbi8vIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU5cbi8vIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLFxuLy8gREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SXG4vLyBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFXG4vLyBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxuXG5mdW5jdGlvbiBFdmVudEVtaXR0ZXIoKSB7XG4gIHRoaXMuX2V2ZW50cyA9IHRoaXMuX2V2ZW50cyB8fCB7fTtcbiAgdGhpcy5fbWF4TGlzdGVuZXJzID0gdGhpcy5fbWF4TGlzdGVuZXJzIHx8IHVuZGVmaW5lZDtcbn1cbm1vZHVsZS5leHBvcnRzID0gRXZlbnRFbWl0dGVyO1xuXG4vLyBCYWNrd2FyZHMtY29tcGF0IHdpdGggbm9kZSAwLjEwLnhcbkV2ZW50RW1pdHRlci5FdmVudEVtaXR0ZXIgPSBFdmVudEVtaXR0ZXI7XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX2V2ZW50cyA9IHVuZGVmaW5lZDtcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX21heExpc3RlbmVycyA9IHVuZGVmaW5lZDtcblxuLy8gQnkgZGVmYXVsdCBFdmVudEVtaXR0ZXJzIHdpbGwgcHJpbnQgYSB3YXJuaW5nIGlmIG1vcmUgdGhhbiAxMCBsaXN0ZW5lcnMgYXJlXG4vLyBhZGRlZCB0byBpdC4gVGhpcyBpcyBhIHVzZWZ1bCBkZWZhdWx0IHdoaWNoIGhlbHBzIGZpbmRpbmcgbWVtb3J5IGxlYWtzLlxuRXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnMgPSAxMDtcblxuLy8gT2J2aW91c2x5IG5vdCBhbGwgRW1pdHRlcnMgc2hvdWxkIGJlIGxpbWl0ZWQgdG8gMTAuIFRoaXMgZnVuY3Rpb24gYWxsb3dzXG4vLyB0aGF0IHRvIGJlIGluY3JlYXNlZC4gU2V0IHRvIHplcm8gZm9yIHVubGltaXRlZC5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuc2V0TWF4TGlzdGVuZXJzID0gZnVuY3Rpb24obikge1xuICBpZiAoIWlzTnVtYmVyKG4pIHx8IG4gPCAwIHx8IGlzTmFOKG4pKVxuICAgIHRocm93IFR5cGVFcnJvcignbiBtdXN0IGJlIGEgcG9zaXRpdmUgbnVtYmVyJyk7XG4gIHRoaXMuX21heExpc3RlbmVycyA9IG47XG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5lbWl0ID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgZXIsIGhhbmRsZXIsIGxlbiwgYXJncywgaSwgbGlzdGVuZXJzO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuXG4gIC8vIElmIHRoZXJlIGlzIG5vICdlcnJvcicgZXZlbnQgbGlzdGVuZXIgdGhlbiB0aHJvdy5cbiAgaWYgKHR5cGUgPT09ICdlcnJvcicpIHtcbiAgICBpZiAoIXRoaXMuX2V2ZW50cy5lcnJvciB8fFxuICAgICAgICAoaXNPYmplY3QodGhpcy5fZXZlbnRzLmVycm9yKSAmJiAhdGhpcy5fZXZlbnRzLmVycm9yLmxlbmd0aCkpIHtcbiAgICAgIGVyID0gYXJndW1lbnRzWzFdO1xuICAgICAgaWYgKGVyIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgICAgdGhyb3cgZXI7IC8vIFVuaGFuZGxlZCAnZXJyb3InIGV2ZW50XG4gICAgICB9XG4gICAgICB0aHJvdyBUeXBlRXJyb3IoJ1VuY2F1Z2h0LCB1bnNwZWNpZmllZCBcImVycm9yXCIgZXZlbnQuJyk7XG4gICAgfVxuICB9XG5cbiAgaGFuZGxlciA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNVbmRlZmluZWQoaGFuZGxlcikpXG4gICAgcmV0dXJuIGZhbHNlO1xuXG4gIGlmIChpc0Z1bmN0aW9uKGhhbmRsZXIpKSB7XG4gICAgc3dpdGNoIChhcmd1bWVudHMubGVuZ3RoKSB7XG4gICAgICAvLyBmYXN0IGNhc2VzXG4gICAgICBjYXNlIDE6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDI6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0pO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMzpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSwgYXJndW1lbnRzWzJdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICAvLyBzbG93ZXJcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGxlbiA9IGFyZ3VtZW50cy5sZW5ndGg7XG4gICAgICAgIGFyZ3MgPSBuZXcgQXJyYXkobGVuIC0gMSk7XG4gICAgICAgIGZvciAoaSA9IDE7IGkgPCBsZW47IGkrKylcbiAgICAgICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgaGFuZGxlci5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAoaXNPYmplY3QoaGFuZGxlcikpIHtcbiAgICBsZW4gPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgIGFyZ3MgPSBuZXcgQXJyYXkobGVuIC0gMSk7XG4gICAgZm9yIChpID0gMTsgaSA8IGxlbjsgaSsrKVxuICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG5cbiAgICBsaXN0ZW5lcnMgPSBoYW5kbGVyLnNsaWNlKCk7XG4gICAgbGVuID0gbGlzdGVuZXJzLmxlbmd0aDtcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGVuOyBpKyspXG4gICAgICBsaXN0ZW5lcnNbaV0uYXBwbHkodGhpcywgYXJncyk7XG4gIH1cblxuICByZXR1cm4gdHJ1ZTtcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgLy8gVG8gYXZvaWQgcmVjdXJzaW9uIGluIHRoZSBjYXNlIHRoYXQgdHlwZSA9PT0gXCJuZXdMaXN0ZW5lclwiISBCZWZvcmVcbiAgLy8gYWRkaW5nIGl0IHRvIHRoZSBsaXN0ZW5lcnMsIGZpcnN0IGVtaXQgXCJuZXdMaXN0ZW5lclwiLlxuICBpZiAodGhpcy5fZXZlbnRzLm5ld0xpc3RlbmVyKVxuICAgIHRoaXMuZW1pdCgnbmV3TGlzdGVuZXInLCB0eXBlLFxuICAgICAgICAgICAgICBpc0Z1bmN0aW9uKGxpc3RlbmVyLmxpc3RlbmVyKSA/XG4gICAgICAgICAgICAgIGxpc3RlbmVyLmxpc3RlbmVyIDogbGlzdGVuZXIpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIC8vIE9wdGltaXplIHRoZSBjYXNlIG9mIG9uZSBsaXN0ZW5lci4gRG9uJ3QgbmVlZCB0aGUgZXh0cmEgYXJyYXkgb2JqZWN0LlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IGxpc3RlbmVyO1xuICBlbHNlIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIC8vIElmIHdlJ3ZlIGFscmVhZHkgZ290IGFuIGFycmF5LCBqdXN0IGFwcGVuZC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0ucHVzaChsaXN0ZW5lcik7XG4gIGVsc2VcbiAgICAvLyBBZGRpbmcgdGhlIHNlY29uZCBlbGVtZW50LCBuZWVkIHRvIGNoYW5nZSB0byBhcnJheS5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBbdGhpcy5fZXZlbnRzW3R5cGVdLCBsaXN0ZW5lcl07XG5cbiAgLy8gQ2hlY2sgZm9yIGxpc3RlbmVyIGxlYWtcbiAgaWYgKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkgJiYgIXRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQpIHtcbiAgICB2YXIgbTtcbiAgICBpZiAoIWlzVW5kZWZpbmVkKHRoaXMuX21heExpc3RlbmVycykpIHtcbiAgICAgIG0gPSB0aGlzLl9tYXhMaXN0ZW5lcnM7XG4gICAgfSBlbHNlIHtcbiAgICAgIG0gPSBFdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycztcbiAgICB9XG5cbiAgICBpZiAobSAmJiBtID4gMCAmJiB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoID4gbSkge1xuICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCA9IHRydWU7XG4gICAgICBjb25zb2xlLmVycm9yKCcobm9kZSkgd2FybmluZzogcG9zc2libGUgRXZlbnRFbWl0dGVyIG1lbW9yeSAnICtcbiAgICAgICAgICAgICAgICAgICAgJ2xlYWsgZGV0ZWN0ZWQuICVkIGxpc3RlbmVycyBhZGRlZC4gJyArXG4gICAgICAgICAgICAgICAgICAgICdVc2UgZW1pdHRlci5zZXRNYXhMaXN0ZW5lcnMoKSB0byBpbmNyZWFzZSBsaW1pdC4nLFxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoKTtcbiAgICAgIGlmICh0eXBlb2YgY29uc29sZS50cmFjZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAvLyBub3Qgc3VwcG9ydGVkIGluIElFIDEwXG4gICAgICAgIGNvbnNvbGUudHJhY2UoKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub24gPSBFdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uY2UgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgdmFyIGZpcmVkID0gZmFsc2U7XG5cbiAgZnVuY3Rpb24gZygpIHtcbiAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGcpO1xuXG4gICAgaWYgKCFmaXJlZCkge1xuICAgICAgZmlyZWQgPSB0cnVlO1xuICAgICAgbGlzdGVuZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9XG4gIH1cblxuICBnLmxpc3RlbmVyID0gbGlzdGVuZXI7XG4gIHRoaXMub24odHlwZSwgZyk7XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vLyBlbWl0cyBhICdyZW1vdmVMaXN0ZW5lcicgZXZlbnQgaWZmIHRoZSBsaXN0ZW5lciB3YXMgcmVtb3ZlZFxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIHZhciBsaXN0LCBwb3NpdGlvbiwgbGVuZ3RoLCBpO1xuXG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIGxpc3QgPSB0aGlzLl9ldmVudHNbdHlwZV07XG4gIGxlbmd0aCA9IGxpc3QubGVuZ3RoO1xuICBwb3NpdGlvbiA9IC0xO1xuXG4gIGlmIChsaXN0ID09PSBsaXN0ZW5lciB8fFxuICAgICAgKGlzRnVuY3Rpb24obGlzdC5saXN0ZW5lcikgJiYgbGlzdC5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICBpZiAodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKVxuICAgICAgdGhpcy5lbWl0KCdyZW1vdmVMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcblxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGxpc3QpKSB7XG4gICAgZm9yIChpID0gbGVuZ3RoOyBpLS0gPiAwOykge1xuICAgICAgaWYgKGxpc3RbaV0gPT09IGxpc3RlbmVyIHx8XG4gICAgICAgICAgKGxpc3RbaV0ubGlzdGVuZXIgJiYgbGlzdFtpXS5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgICAgIHBvc2l0aW9uID0gaTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHBvc2l0aW9uIDwgMClcbiAgICAgIHJldHVybiB0aGlzO1xuXG4gICAgaWYgKGxpc3QubGVuZ3RoID09PSAxKSB7XG4gICAgICBsaXN0Lmxlbmd0aCA9IDA7XG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIH0gZWxzZSB7XG4gICAgICBsaXN0LnNwbGljZShwb3NpdGlvbiwgMSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlQWxsTGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIga2V5LCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgLy8gbm90IGxpc3RlbmluZyBmb3IgcmVtb3ZlTGlzdGVuZXIsIG5vIG5lZWQgdG8gZW1pdFxuICBpZiAoIXRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcikge1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKVxuICAgICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgZWxzZSBpZiAodGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8vIGVtaXQgcmVtb3ZlTGlzdGVuZXIgZm9yIGFsbCBsaXN0ZW5lcnMgb24gYWxsIGV2ZW50c1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgIGZvciAoa2V5IGluIHRoaXMuX2V2ZW50cykge1xuICAgICAgaWYgKGtleSA9PT0gJ3JlbW92ZUxpc3RlbmVyJykgY29udGludWU7XG4gICAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycyhrZXkpO1xuICAgIH1cbiAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycygncmVtb3ZlTGlzdGVuZXInKTtcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIGxpc3RlbmVycyA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNGdW5jdGlvbihsaXN0ZW5lcnMpKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnMpO1xuICB9IGVsc2Uge1xuICAgIC8vIExJRk8gb3JkZXJcbiAgICB3aGlsZSAobGlzdGVuZXJzLmxlbmd0aClcbiAgICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzW2xpc3RlbmVycy5sZW5ndGggLSAxXSk7XG4gIH1cbiAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgcmV0O1xuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldCA9IFtdO1xuICBlbHNlIGlmIChpc0Z1bmN0aW9uKHRoaXMuX2V2ZW50c1t0eXBlXSkpXG4gICAgcmV0ID0gW3RoaXMuX2V2ZW50c1t0eXBlXV07XG4gIGVsc2VcbiAgICByZXQgPSB0aGlzLl9ldmVudHNbdHlwZV0uc2xpY2UoKTtcbiAgcmV0dXJuIHJldDtcbn07XG5cbkV2ZW50RW1pdHRlci5saXN0ZW5lckNvdW50ID0gZnVuY3Rpb24oZW1pdHRlciwgdHlwZSkge1xuICB2YXIgcmV0O1xuICBpZiAoIWVtaXR0ZXIuX2V2ZW50cyB8fCAhZW1pdHRlci5fZXZlbnRzW3R5cGVdKVxuICAgIHJldCA9IDA7XG4gIGVsc2UgaWYgKGlzRnVuY3Rpb24oZW1pdHRlci5fZXZlbnRzW3R5cGVdKSlcbiAgICByZXQgPSAxO1xuICBlbHNlXG4gICAgcmV0ID0gZW1pdHRlci5fZXZlbnRzW3R5cGVdLmxlbmd0aDtcbiAgcmV0dXJuIHJldDtcbn07XG5cbmZ1bmN0aW9uIGlzRnVuY3Rpb24oYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnZnVuY3Rpb24nO1xufVxuXG5mdW5jdGlvbiBpc051bWJlcihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdudW1iZXInO1xufVxuXG5mdW5jdGlvbiBpc09iamVjdChhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdvYmplY3QnICYmIGFyZyAhPT0gbnVsbDtcbn1cblxuZnVuY3Rpb24gaXNVbmRlZmluZWQoYXJnKSB7XG4gIHJldHVybiBhcmcgPT09IHZvaWQgMDtcbn1cbiIsIlxuLyoqXG4gKiBUaGlzIGlzIHRoZSB3ZWIgYnJvd3NlciBpbXBsZW1lbnRhdGlvbiBvZiBgZGVidWcoKWAuXG4gKlxuICogRXhwb3NlIGBkZWJ1ZygpYCBhcyB0aGUgbW9kdWxlLlxuICovXG5cbmV4cG9ydHMgPSBtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vZGVidWcnKTtcbmV4cG9ydHMubG9nID0gbG9nO1xuZXhwb3J0cy5mb3JtYXRBcmdzID0gZm9ybWF0QXJncztcbmV4cG9ydHMuc2F2ZSA9IHNhdmU7XG5leHBvcnRzLmxvYWQgPSBsb2FkO1xuZXhwb3J0cy51c2VDb2xvcnMgPSB1c2VDb2xvcnM7XG5cbi8qKlxuICogVXNlIGNocm9tZS5zdG9yYWdlLmxvY2FsIGlmIHdlIGFyZSBpbiBhbiBhcHBcbiAqL1xuXG52YXIgc3RvcmFnZTtcblxuaWYgKHR5cGVvZiBjaHJvbWUgIT09ICd1bmRlZmluZWQnICYmIHR5cGVvZiBjaHJvbWUuc3RvcmFnZSAhPT0gJ3VuZGVmaW5lZCcpXG4gIHN0b3JhZ2UgPSBjaHJvbWUuc3RvcmFnZS5sb2NhbDtcbmVsc2VcbiAgc3RvcmFnZSA9IHdpbmRvdy5sb2NhbFN0b3JhZ2U7XG5cbi8qKlxuICogQ29sb3JzLlxuICovXG5cbmV4cG9ydHMuY29sb3JzID0gW1xuICAnbGlnaHRzZWFncmVlbicsXG4gICdmb3Jlc3RncmVlbicsXG4gICdnb2xkZW5yb2QnLFxuICAnZG9kZ2VyYmx1ZScsXG4gICdkYXJrb3JjaGlkJyxcbiAgJ2NyaW1zb24nXG5dO1xuXG4vKipcbiAqIEN1cnJlbnRseSBvbmx5IFdlYktpdC1iYXNlZCBXZWIgSW5zcGVjdG9ycywgRmlyZWZveCA+PSB2MzEsXG4gKiBhbmQgdGhlIEZpcmVidWcgZXh0ZW5zaW9uIChhbnkgRmlyZWZveCB2ZXJzaW9uKSBhcmUga25vd25cbiAqIHRvIHN1cHBvcnQgXCIlY1wiIENTUyBjdXN0b21pemF0aW9ucy5cbiAqXG4gKiBUT0RPOiBhZGQgYSBgbG9jYWxTdG9yYWdlYCB2YXJpYWJsZSB0byBleHBsaWNpdGx5IGVuYWJsZS9kaXNhYmxlIGNvbG9yc1xuICovXG5cbmZ1bmN0aW9uIHVzZUNvbG9ycygpIHtcbiAgLy8gaXMgd2Via2l0PyBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vYS8xNjQ1OTYwNi8zNzY3NzNcbiAgcmV0dXJuICgnV2Via2l0QXBwZWFyYW5jZScgaW4gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LnN0eWxlKSB8fFxuICAgIC8vIGlzIGZpcmVidWc/IGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9hLzM5ODEyMC8zNzY3NzNcbiAgICAod2luZG93LmNvbnNvbGUgJiYgKGNvbnNvbGUuZmlyZWJ1ZyB8fCAoY29uc29sZS5leGNlcHRpb24gJiYgY29uc29sZS50YWJsZSkpKSB8fFxuICAgIC8vIGlzIGZpcmVmb3ggPj0gdjMxP1xuICAgIC8vIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvVG9vbHMvV2ViX0NvbnNvbGUjU3R5bGluZ19tZXNzYWdlc1xuICAgIChuYXZpZ2F0b3IudXNlckFnZW50LnRvTG93ZXJDYXNlKCkubWF0Y2goL2ZpcmVmb3hcXC8oXFxkKykvKSAmJiBwYXJzZUludChSZWdFeHAuJDEsIDEwKSA+PSAzMSk7XG59XG5cbi8qKlxuICogTWFwICVqIHRvIGBKU09OLnN0cmluZ2lmeSgpYCwgc2luY2Ugbm8gV2ViIEluc3BlY3RvcnMgZG8gdGhhdCBieSBkZWZhdWx0LlxuICovXG5cbmV4cG9ydHMuZm9ybWF0dGVycy5qID0gZnVuY3Rpb24odikge1xuICByZXR1cm4gSlNPTi5zdHJpbmdpZnkodik7XG59O1xuXG5cbi8qKlxuICogQ29sb3JpemUgbG9nIGFyZ3VtZW50cyBpZiBlbmFibGVkLlxuICpcbiAqIEBhcGkgcHVibGljXG4gKi9cblxuZnVuY3Rpb24gZm9ybWF0QXJncygpIHtcbiAgdmFyIGFyZ3MgPSBhcmd1bWVudHM7XG4gIHZhciB1c2VDb2xvcnMgPSB0aGlzLnVzZUNvbG9ycztcblxuICBhcmdzWzBdID0gKHVzZUNvbG9ycyA/ICclYycgOiAnJylcbiAgICArIHRoaXMubmFtZXNwYWNlXG4gICAgKyAodXNlQ29sb3JzID8gJyAlYycgOiAnICcpXG4gICAgKyBhcmdzWzBdXG4gICAgKyAodXNlQ29sb3JzID8gJyVjICcgOiAnICcpXG4gICAgKyAnKycgKyBleHBvcnRzLmh1bWFuaXplKHRoaXMuZGlmZik7XG5cbiAgaWYgKCF1c2VDb2xvcnMpIHJldHVybiBhcmdzO1xuXG4gIHZhciBjID0gJ2NvbG9yOiAnICsgdGhpcy5jb2xvcjtcbiAgYXJncyA9IFthcmdzWzBdLCBjLCAnY29sb3I6IGluaGVyaXQnXS5jb25jYXQoQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJncywgMSkpO1xuXG4gIC8vIHRoZSBmaW5hbCBcIiVjXCIgaXMgc29tZXdoYXQgdHJpY2t5LCBiZWNhdXNlIHRoZXJlIGNvdWxkIGJlIG90aGVyXG4gIC8vIGFyZ3VtZW50cyBwYXNzZWQgZWl0aGVyIGJlZm9yZSBvciBhZnRlciB0aGUgJWMsIHNvIHdlIG5lZWQgdG9cbiAgLy8gZmlndXJlIG91dCB0aGUgY29ycmVjdCBpbmRleCB0byBpbnNlcnQgdGhlIENTUyBpbnRvXG4gIHZhciBpbmRleCA9IDA7XG4gIHZhciBsYXN0QyA9IDA7XG4gIGFyZ3NbMF0ucmVwbGFjZSgvJVthLXolXS9nLCBmdW5jdGlvbihtYXRjaCkge1xuICAgIGlmICgnJSUnID09PSBtYXRjaCkgcmV0dXJuO1xuICAgIGluZGV4Kys7XG4gICAgaWYgKCclYycgPT09IG1hdGNoKSB7XG4gICAgICAvLyB3ZSBvbmx5IGFyZSBpbnRlcmVzdGVkIGluIHRoZSAqbGFzdCogJWNcbiAgICAgIC8vICh0aGUgdXNlciBtYXkgaGF2ZSBwcm92aWRlZCB0aGVpciBvd24pXG4gICAgICBsYXN0QyA9IGluZGV4O1xuICAgIH1cbiAgfSk7XG5cbiAgYXJncy5zcGxpY2UobGFzdEMsIDAsIGMpO1xuICByZXR1cm4gYXJncztcbn1cblxuLyoqXG4gKiBJbnZva2VzIGBjb25zb2xlLmxvZygpYCB3aGVuIGF2YWlsYWJsZS5cbiAqIE5vLW9wIHdoZW4gYGNvbnNvbGUubG9nYCBpcyBub3QgYSBcImZ1bmN0aW9uXCIuXG4gKlxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5mdW5jdGlvbiBsb2coKSB7XG4gIC8vIHRoaXMgaGFja2VyeSBpcyByZXF1aXJlZCBmb3IgSUU4LzksIHdoZXJlXG4gIC8vIHRoZSBgY29uc29sZS5sb2dgIGZ1bmN0aW9uIGRvZXNuJ3QgaGF2ZSAnYXBwbHknXG4gIHJldHVybiAnb2JqZWN0JyA9PT0gdHlwZW9mIGNvbnNvbGVcbiAgICAmJiBjb25zb2xlLmxvZ1xuICAgICYmIEZ1bmN0aW9uLnByb3RvdHlwZS5hcHBseS5jYWxsKGNvbnNvbGUubG9nLCBjb25zb2xlLCBhcmd1bWVudHMpO1xufVxuXG4vKipcbiAqIFNhdmUgYG5hbWVzcGFjZXNgLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lc3BhY2VzXG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBzYXZlKG5hbWVzcGFjZXMpIHtcbiAgdHJ5IHtcbiAgICBpZiAobnVsbCA9PSBuYW1lc3BhY2VzKSB7XG4gICAgICBzdG9yYWdlLnJlbW92ZUl0ZW0oJ2RlYnVnJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHN0b3JhZ2UuZGVidWcgPSBuYW1lc3BhY2VzO1xuICAgIH1cbiAgfSBjYXRjaChlKSB7fVxufVxuXG4vKipcbiAqIExvYWQgYG5hbWVzcGFjZXNgLlxuICpcbiAqIEByZXR1cm4ge1N0cmluZ30gcmV0dXJucyB0aGUgcHJldmlvdXNseSBwZXJzaXN0ZWQgZGVidWcgbW9kZXNcbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIGxvYWQoKSB7XG4gIHZhciByO1xuICB0cnkge1xuICAgIHIgPSBzdG9yYWdlLmRlYnVnO1xuICB9IGNhdGNoKGUpIHt9XG4gIHJldHVybiByO1xufVxuXG4vKipcbiAqIEVuYWJsZSBuYW1lc3BhY2VzIGxpc3RlZCBpbiBgbG9jYWxTdG9yYWdlLmRlYnVnYCBpbml0aWFsbHkuXG4gKi9cblxuZXhwb3J0cy5lbmFibGUobG9hZCgpKTtcbiIsIlxuLyoqXG4gKiBUaGlzIGlzIHRoZSBjb21tb24gbG9naWMgZm9yIGJvdGggdGhlIE5vZGUuanMgYW5kIHdlYiBicm93c2VyXG4gKiBpbXBsZW1lbnRhdGlvbnMgb2YgYGRlYnVnKClgLlxuICpcbiAqIEV4cG9zZSBgZGVidWcoKWAgYXMgdGhlIG1vZHVsZS5cbiAqL1xuXG5leHBvcnRzID0gbW9kdWxlLmV4cG9ydHMgPSBkZWJ1ZztcbmV4cG9ydHMuY29lcmNlID0gY29lcmNlO1xuZXhwb3J0cy5kaXNhYmxlID0gZGlzYWJsZTtcbmV4cG9ydHMuZW5hYmxlID0gZW5hYmxlO1xuZXhwb3J0cy5lbmFibGVkID0gZW5hYmxlZDtcbmV4cG9ydHMuaHVtYW5pemUgPSByZXF1aXJlKCdtcycpO1xuXG4vKipcbiAqIFRoZSBjdXJyZW50bHkgYWN0aXZlIGRlYnVnIG1vZGUgbmFtZXMsIGFuZCBuYW1lcyB0byBza2lwLlxuICovXG5cbmV4cG9ydHMubmFtZXMgPSBbXTtcbmV4cG9ydHMuc2tpcHMgPSBbXTtcblxuLyoqXG4gKiBNYXAgb2Ygc3BlY2lhbCBcIiVuXCIgaGFuZGxpbmcgZnVuY3Rpb25zLCBmb3IgdGhlIGRlYnVnIFwiZm9ybWF0XCIgYXJndW1lbnQuXG4gKlxuICogVmFsaWQga2V5IG5hbWVzIGFyZSBhIHNpbmdsZSwgbG93ZXJjYXNlZCBsZXR0ZXIsIGkuZS4gXCJuXCIuXG4gKi9cblxuZXhwb3J0cy5mb3JtYXR0ZXJzID0ge307XG5cbi8qKlxuICogUHJldmlvdXNseSBhc3NpZ25lZCBjb2xvci5cbiAqL1xuXG52YXIgcHJldkNvbG9yID0gMDtcblxuLyoqXG4gKiBQcmV2aW91cyBsb2cgdGltZXN0YW1wLlxuICovXG5cbnZhciBwcmV2VGltZTtcblxuLyoqXG4gKiBTZWxlY3QgYSBjb2xvci5cbiAqXG4gKiBAcmV0dXJuIHtOdW1iZXJ9XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBzZWxlY3RDb2xvcigpIHtcbiAgcmV0dXJuIGV4cG9ydHMuY29sb3JzW3ByZXZDb2xvcisrICUgZXhwb3J0cy5jb2xvcnMubGVuZ3RoXTtcbn1cblxuLyoqXG4gKiBDcmVhdGUgYSBkZWJ1Z2dlciB3aXRoIHRoZSBnaXZlbiBgbmFtZXNwYWNlYC5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gbmFtZXNwYWNlXG4gKiBAcmV0dXJuIHtGdW5jdGlvbn1cbiAqIEBhcGkgcHVibGljXG4gKi9cblxuZnVuY3Rpb24gZGVidWcobmFtZXNwYWNlKSB7XG5cbiAgLy8gZGVmaW5lIHRoZSBgZGlzYWJsZWRgIHZlcnNpb25cbiAgZnVuY3Rpb24gZGlzYWJsZWQoKSB7XG4gIH1cbiAgZGlzYWJsZWQuZW5hYmxlZCA9IGZhbHNlO1xuXG4gIC8vIGRlZmluZSB0aGUgYGVuYWJsZWRgIHZlcnNpb25cbiAgZnVuY3Rpb24gZW5hYmxlZCgpIHtcblxuICAgIHZhciBzZWxmID0gZW5hYmxlZDtcblxuICAgIC8vIHNldCBgZGlmZmAgdGltZXN0YW1wXG4gICAgdmFyIGN1cnIgPSArbmV3IERhdGUoKTtcbiAgICB2YXIgbXMgPSBjdXJyIC0gKHByZXZUaW1lIHx8IGN1cnIpO1xuICAgIHNlbGYuZGlmZiA9IG1zO1xuICAgIHNlbGYucHJldiA9IHByZXZUaW1lO1xuICAgIHNlbGYuY3VyciA9IGN1cnI7XG4gICAgcHJldlRpbWUgPSBjdXJyO1xuXG4gICAgLy8gYWRkIHRoZSBgY29sb3JgIGlmIG5vdCBzZXRcbiAgICBpZiAobnVsbCA9PSBzZWxmLnVzZUNvbG9ycykgc2VsZi51c2VDb2xvcnMgPSBleHBvcnRzLnVzZUNvbG9ycygpO1xuICAgIGlmIChudWxsID09IHNlbGYuY29sb3IgJiYgc2VsZi51c2VDb2xvcnMpIHNlbGYuY29sb3IgPSBzZWxlY3RDb2xvcigpO1xuXG4gICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuXG4gICAgYXJnc1swXSA9IGV4cG9ydHMuY29lcmNlKGFyZ3NbMF0pO1xuXG4gICAgaWYgKCdzdHJpbmcnICE9PSB0eXBlb2YgYXJnc1swXSkge1xuICAgICAgLy8gYW55dGhpbmcgZWxzZSBsZXQncyBpbnNwZWN0IHdpdGggJW9cbiAgICAgIGFyZ3MgPSBbJyVvJ10uY29uY2F0KGFyZ3MpO1xuICAgIH1cblxuICAgIC8vIGFwcGx5IGFueSBgZm9ybWF0dGVyc2AgdHJhbnNmb3JtYXRpb25zXG4gICAgdmFyIGluZGV4ID0gMDtcbiAgICBhcmdzWzBdID0gYXJnc1swXS5yZXBsYWNlKC8lKFthLXolXSkvZywgZnVuY3Rpb24obWF0Y2gsIGZvcm1hdCkge1xuICAgICAgLy8gaWYgd2UgZW5jb3VudGVyIGFuIGVzY2FwZWQgJSB0aGVuIGRvbid0IGluY3JlYXNlIHRoZSBhcnJheSBpbmRleFxuICAgICAgaWYgKG1hdGNoID09PSAnJSUnKSByZXR1cm4gbWF0Y2g7XG4gICAgICBpbmRleCsrO1xuICAgICAgdmFyIGZvcm1hdHRlciA9IGV4cG9ydHMuZm9ybWF0dGVyc1tmb3JtYXRdO1xuICAgICAgaWYgKCdmdW5jdGlvbicgPT09IHR5cGVvZiBmb3JtYXR0ZXIpIHtcbiAgICAgICAgdmFyIHZhbCA9IGFyZ3NbaW5kZXhdO1xuICAgICAgICBtYXRjaCA9IGZvcm1hdHRlci5jYWxsKHNlbGYsIHZhbCk7XG5cbiAgICAgICAgLy8gbm93IHdlIG5lZWQgdG8gcmVtb3ZlIGBhcmdzW2luZGV4XWAgc2luY2UgaXQncyBpbmxpbmVkIGluIHRoZSBgZm9ybWF0YFxuICAgICAgICBhcmdzLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgIGluZGV4LS07XG4gICAgICB9XG4gICAgICByZXR1cm4gbWF0Y2g7XG4gICAgfSk7XG5cbiAgICBpZiAoJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGV4cG9ydHMuZm9ybWF0QXJncykge1xuICAgICAgYXJncyA9IGV4cG9ydHMuZm9ybWF0QXJncy5hcHBseShzZWxmLCBhcmdzKTtcbiAgICB9XG4gICAgdmFyIGxvZ0ZuID0gZW5hYmxlZC5sb2cgfHwgZXhwb3J0cy5sb2cgfHwgY29uc29sZS5sb2cuYmluZChjb25zb2xlKTtcbiAgICBsb2dGbi5hcHBseShzZWxmLCBhcmdzKTtcbiAgfVxuICBlbmFibGVkLmVuYWJsZWQgPSB0cnVlO1xuXG4gIHZhciBmbiA9IGV4cG9ydHMuZW5hYmxlZChuYW1lc3BhY2UpID8gZW5hYmxlZCA6IGRpc2FibGVkO1xuXG4gIGZuLm5hbWVzcGFjZSA9IG5hbWVzcGFjZTtcblxuICByZXR1cm4gZm47XG59XG5cbi8qKlxuICogRW5hYmxlcyBhIGRlYnVnIG1vZGUgYnkgbmFtZXNwYWNlcy4gVGhpcyBjYW4gaW5jbHVkZSBtb2Rlc1xuICogc2VwYXJhdGVkIGJ5IGEgY29sb24gYW5kIHdpbGRjYXJkcy5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gbmFtZXNwYWNlc1xuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5mdW5jdGlvbiBlbmFibGUobmFtZXNwYWNlcykge1xuICBleHBvcnRzLnNhdmUobmFtZXNwYWNlcyk7XG5cbiAgdmFyIHNwbGl0ID0gKG5hbWVzcGFjZXMgfHwgJycpLnNwbGl0KC9bXFxzLF0rLyk7XG4gIHZhciBsZW4gPSBzcGxpdC5sZW5ndGg7XG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgIGlmICghc3BsaXRbaV0pIGNvbnRpbnVlOyAvLyBpZ25vcmUgZW1wdHkgc3RyaW5nc1xuICAgIG5hbWVzcGFjZXMgPSBzcGxpdFtpXS5yZXBsYWNlKC9cXCovZywgJy4qPycpO1xuICAgIGlmIChuYW1lc3BhY2VzWzBdID09PSAnLScpIHtcbiAgICAgIGV4cG9ydHMuc2tpcHMucHVzaChuZXcgUmVnRXhwKCdeJyArIG5hbWVzcGFjZXMuc3Vic3RyKDEpICsgJyQnKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGV4cG9ydHMubmFtZXMucHVzaChuZXcgUmVnRXhwKCdeJyArIG5hbWVzcGFjZXMgKyAnJCcpKTtcbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBEaXNhYmxlIGRlYnVnIG91dHB1dC5cbiAqXG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbmZ1bmN0aW9uIGRpc2FibGUoKSB7XG4gIGV4cG9ydHMuZW5hYmxlKCcnKTtcbn1cblxuLyoqXG4gKiBSZXR1cm5zIHRydWUgaWYgdGhlIGdpdmVuIG1vZGUgbmFtZSBpcyBlbmFibGVkLCBmYWxzZSBvdGhlcndpc2UuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IG5hbWVcbiAqIEByZXR1cm4ge0Jvb2xlYW59XG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbmZ1bmN0aW9uIGVuYWJsZWQobmFtZSkge1xuICB2YXIgaSwgbGVuO1xuICBmb3IgKGkgPSAwLCBsZW4gPSBleHBvcnRzLnNraXBzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgaWYgKGV4cG9ydHMuc2tpcHNbaV0udGVzdChuYW1lKSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuICBmb3IgKGkgPSAwLCBsZW4gPSBleHBvcnRzLm5hbWVzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgaWYgKGV4cG9ydHMubmFtZXNbaV0udGVzdChuYW1lKSkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICB9XG4gIHJldHVybiBmYWxzZTtcbn1cblxuLyoqXG4gKiBDb2VyY2UgYHZhbGAuXG4gKlxuICogQHBhcmFtIHtNaXhlZH0gdmFsXG4gKiBAcmV0dXJuIHtNaXhlZH1cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIGNvZXJjZSh2YWwpIHtcbiAgaWYgKHZhbCBpbnN0YW5jZW9mIEVycm9yKSByZXR1cm4gdmFsLnN0YWNrIHx8IHZhbC5tZXNzYWdlO1xuICByZXR1cm4gdmFsO1xufVxuIiwiLyoqXG4gKiBIZWxwZXJzLlxuICovXG5cbnZhciBzID0gMTAwMDtcbnZhciBtID0gcyAqIDYwO1xudmFyIGggPSBtICogNjA7XG52YXIgZCA9IGggKiAyNDtcbnZhciB5ID0gZCAqIDM2NS4yNTtcblxuLyoqXG4gKiBQYXJzZSBvciBmb3JtYXQgdGhlIGdpdmVuIGB2YWxgLlxuICpcbiAqIE9wdGlvbnM6XG4gKlxuICogIC0gYGxvbmdgIHZlcmJvc2UgZm9ybWF0dGluZyBbZmFsc2VdXG4gKlxuICogQHBhcmFtIHtTdHJpbmd8TnVtYmVyfSB2YWxcbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zXG4gKiBAcmV0dXJuIHtTdHJpbmd8TnVtYmVyfVxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHZhbCwgb3B0aW9ucyl7XG4gIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuICBpZiAoJ3N0cmluZycgPT0gdHlwZW9mIHZhbCkgcmV0dXJuIHBhcnNlKHZhbCk7XG4gIHJldHVybiBvcHRpb25zLmxvbmdcbiAgICA/IGxvbmcodmFsKVxuICAgIDogc2hvcnQodmFsKTtcbn07XG5cbi8qKlxuICogUGFyc2UgdGhlIGdpdmVuIGBzdHJgIGFuZCByZXR1cm4gbWlsbGlzZWNvbmRzLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBzdHJcbiAqIEByZXR1cm4ge051bWJlcn1cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIHBhcnNlKHN0cikge1xuICB2YXIgbWF0Y2ggPSAvXigoPzpcXGQrKT9cXC4/XFxkKykgKihtc3xzZWNvbmRzP3xzfG1pbnV0ZXM/fG18aG91cnM/fGh8ZGF5cz98ZHx5ZWFycz98eSk/JC9pLmV4ZWMoc3RyKTtcbiAgaWYgKCFtYXRjaCkgcmV0dXJuO1xuICB2YXIgbiA9IHBhcnNlRmxvYXQobWF0Y2hbMV0pO1xuICB2YXIgdHlwZSA9IChtYXRjaFsyXSB8fCAnbXMnKS50b0xvd2VyQ2FzZSgpO1xuICBzd2l0Y2ggKHR5cGUpIHtcbiAgICBjYXNlICd5ZWFycyc6XG4gICAgY2FzZSAneWVhcic6XG4gICAgY2FzZSAneSc6XG4gICAgICByZXR1cm4gbiAqIHk7XG4gICAgY2FzZSAnZGF5cyc6XG4gICAgY2FzZSAnZGF5JzpcbiAgICBjYXNlICdkJzpcbiAgICAgIHJldHVybiBuICogZDtcbiAgICBjYXNlICdob3Vycyc6XG4gICAgY2FzZSAnaG91cic6XG4gICAgY2FzZSAnaCc6XG4gICAgICByZXR1cm4gbiAqIGg7XG4gICAgY2FzZSAnbWludXRlcyc6XG4gICAgY2FzZSAnbWludXRlJzpcbiAgICBjYXNlICdtJzpcbiAgICAgIHJldHVybiBuICogbTtcbiAgICBjYXNlICdzZWNvbmRzJzpcbiAgICBjYXNlICdzZWNvbmQnOlxuICAgIGNhc2UgJ3MnOlxuICAgICAgcmV0dXJuIG4gKiBzO1xuICAgIGNhc2UgJ21zJzpcbiAgICAgIHJldHVybiBuO1xuICB9XG59XG5cbi8qKlxuICogU2hvcnQgZm9ybWF0IGZvciBgbXNgLlxuICpcbiAqIEBwYXJhbSB7TnVtYmVyfSBtc1xuICogQHJldHVybiB7U3RyaW5nfVxuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gc2hvcnQobXMpIHtcbiAgaWYgKG1zID49IGQpIHJldHVybiBNYXRoLnJvdW5kKG1zIC8gZCkgKyAnZCc7XG4gIGlmIChtcyA+PSBoKSByZXR1cm4gTWF0aC5yb3VuZChtcyAvIGgpICsgJ2gnO1xuICBpZiAobXMgPj0gbSkgcmV0dXJuIE1hdGgucm91bmQobXMgLyBtKSArICdtJztcbiAgaWYgKG1zID49IHMpIHJldHVybiBNYXRoLnJvdW5kKG1zIC8gcykgKyAncyc7XG4gIHJldHVybiBtcyArICdtcyc7XG59XG5cbi8qKlxuICogTG9uZyBmb3JtYXQgZm9yIGBtc2AuXG4gKlxuICogQHBhcmFtIHtOdW1iZXJ9IG1zXG4gKiBAcmV0dXJuIHtTdHJpbmd9XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBsb25nKG1zKSB7XG4gIHJldHVybiBwbHVyYWwobXMsIGQsICdkYXknKVxuICAgIHx8IHBsdXJhbChtcywgaCwgJ2hvdXInKVxuICAgIHx8IHBsdXJhbChtcywgbSwgJ21pbnV0ZScpXG4gICAgfHwgcGx1cmFsKG1zLCBzLCAnc2Vjb25kJylcbiAgICB8fCBtcyArICcgbXMnO1xufVxuXG4vKipcbiAqIFBsdXJhbGl6YXRpb24gaGVscGVyLlxuICovXG5cbmZ1bmN0aW9uIHBsdXJhbChtcywgbiwgbmFtZSkge1xuICBpZiAobXMgPCBuKSByZXR1cm47XG4gIGlmIChtcyA8IG4gKiAxLjUpIHJldHVybiBNYXRoLmZsb29yKG1zIC8gbikgKyAnICcgKyBuYW1lO1xuICByZXR1cm4gTWF0aC5jZWlsKG1zIC8gbikgKyAnICcgKyBuYW1lICsgJ3MnO1xufVxuIiwidmFyIGhhc093biA9IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHk7XG52YXIgdG9TdHJpbmcgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nO1xudmFyIHVuZGVmaW5lZDtcblxudmFyIGlzUGxhaW5PYmplY3QgPSBmdW5jdGlvbiBpc1BsYWluT2JqZWN0KG9iaikge1xuICAgIFwidXNlIHN0cmljdFwiO1xuICAgIGlmICghb2JqIHx8IHRvU3RyaW5nLmNhbGwob2JqKSAhPT0gJ1tvYmplY3QgT2JqZWN0XScgfHwgb2JqLm5vZGVUeXBlIHx8IG9iai5zZXRJbnRlcnZhbCkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgdmFyIGhhc19vd25fY29uc3RydWN0b3IgPSBoYXNPd24uY2FsbChvYmosICdjb25zdHJ1Y3RvcicpO1xuICAgIHZhciBoYXNfaXNfcHJvcGVydHlfb2ZfbWV0aG9kID0gb2JqLmNvbnN0cnVjdG9yICYmIG9iai5jb25zdHJ1Y3Rvci5wcm90b3R5cGUgJiYgaGFzT3duLmNhbGwob2JqLmNvbnN0cnVjdG9yLnByb3RvdHlwZSwgJ2lzUHJvdG90eXBlT2YnKTtcbiAgICAvLyBOb3Qgb3duIGNvbnN0cnVjdG9yIHByb3BlcnR5IG11c3QgYmUgT2JqZWN0XG4gICAgaWYgKG9iai5jb25zdHJ1Y3RvciAmJiAhaGFzX293bl9jb25zdHJ1Y3RvciAmJiAhaGFzX2lzX3Byb3BlcnR5X29mX21ldGhvZCkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgLy8gT3duIHByb3BlcnRpZXMgYXJlIGVudW1lcmF0ZWQgZmlyc3RseSwgc28gdG8gc3BlZWQgdXAsXG4gICAgLy8gaWYgbGFzdCBvbmUgaXMgb3duLCB0aGVuIGFsbCBwcm9wZXJ0aWVzIGFyZSBvd24uXG4gICAgdmFyIGtleTtcbiAgICBmb3IgKGtleSBpbiBvYmopIHt9XG5cbiAgICByZXR1cm4ga2V5ID09PSB1bmRlZmluZWQgfHwgaGFzT3duLmNhbGwob2JqLCBrZXkpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBleHRlbmQoKSB7XG4gICAgXCJ1c2Ugc3RyaWN0XCI7XG4gICAgdmFyIG9wdGlvbnMsIG5hbWUsIHNyYywgY29weSwgY29weUlzQXJyYXksIGNsb25lLFxuICAgICAgICB0YXJnZXQgPSBhcmd1bWVudHNbMF0sXG4gICAgICAgIGkgPSAxLFxuICAgICAgICBsZW5ndGggPSBhcmd1bWVudHMubGVuZ3RoLFxuICAgICAgICBkZWVwID0gZmFsc2U7XG5cbiAgICAvLyBIYW5kbGUgYSBkZWVwIGNvcHkgc2l0dWF0aW9uXG4gICAgaWYgKHR5cGVvZiB0YXJnZXQgPT09IFwiYm9vbGVhblwiKSB7XG4gICAgICAgIGRlZXAgPSB0YXJnZXQ7XG4gICAgICAgIHRhcmdldCA9IGFyZ3VtZW50c1sxXSB8fCB7fTtcbiAgICAgICAgLy8gc2tpcCB0aGUgYm9vbGVhbiBhbmQgdGhlIHRhcmdldFxuICAgICAgICBpID0gMjtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiB0YXJnZXQgIT09IFwib2JqZWN0XCIgJiYgdHlwZW9mIHRhcmdldCAhPT0gXCJmdW5jdGlvblwiIHx8IHRhcmdldCA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgdGFyZ2V0ID0ge307XG4gICAgfVxuXG4gICAgZm9yICg7IGkgPCBsZW5ndGg7ICsraSkge1xuICAgICAgICAvLyBPbmx5IGRlYWwgd2l0aCBub24tbnVsbC91bmRlZmluZWQgdmFsdWVzXG4gICAgICAgIGlmICgob3B0aW9ucyA9IGFyZ3VtZW50c1tpXSkgIT0gbnVsbCkge1xuICAgICAgICAgICAgLy8gRXh0ZW5kIHRoZSBiYXNlIG9iamVjdFxuICAgICAgICAgICAgZm9yIChuYW1lIGluIG9wdGlvbnMpIHtcbiAgICAgICAgICAgICAgICBzcmMgPSB0YXJnZXRbbmFtZV07XG4gICAgICAgICAgICAgICAgY29weSA9IG9wdGlvbnNbbmFtZV07XG5cbiAgICAgICAgICAgICAgICAvLyBQcmV2ZW50IG5ldmVyLWVuZGluZyBsb29wXG4gICAgICAgICAgICAgICAgaWYgKHRhcmdldCA9PT0gY29weSkge1xuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBSZWN1cnNlIGlmIHdlJ3JlIG1lcmdpbmcgcGxhaW4gb2JqZWN0cyBvciBhcnJheXNcbiAgICAgICAgICAgICAgICBpZiAoZGVlcCAmJiBjb3B5ICYmIChpc1BsYWluT2JqZWN0KGNvcHkpIHx8IChjb3B5SXNBcnJheSA9IEFycmF5LmlzQXJyYXkoY29weSkpKSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoY29weUlzQXJyYXkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvcHlJc0FycmF5ID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICBjbG9uZSA9IHNyYyAmJiBBcnJheS5pc0FycmF5KHNyYykgPyBzcmMgOiBbXTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsb25lID0gc3JjICYmIGlzUGxhaW5PYmplY3Qoc3JjKSA/IHNyYyA6IHt9O1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gTmV2ZXIgbW92ZSBvcmlnaW5hbCBvYmplY3RzLCBjbG9uZSB0aGVtXG4gICAgICAgICAgICAgICAgICAgIHRhcmdldFtuYW1lXSA9IGV4dGVuZChkZWVwLCBjbG9uZSwgY29weSk7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gRG9uJ3QgYnJpbmcgaW4gdW5kZWZpbmVkIHZhbHVlc1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoY29weSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgIHRhcmdldFtuYW1lXSA9IGNvcHk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gUmV0dXJuIHRoZSBtb2RpZmllZCBvYmplY3RcbiAgICByZXR1cm4gdGFyZ2V0O1xufTtcblxuIiwiJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IElOVEVSTkFMO1xuXG5mdW5jdGlvbiBJTlRFUk5BTCgpIHt9IiwiJ3VzZSBzdHJpY3QnO1xudmFyIFByb21pc2UgPSByZXF1aXJlKCcuL3Byb21pc2UnKTtcbnZhciByZWplY3QgPSByZXF1aXJlKCcuL3JlamVjdCcpO1xudmFyIHJlc29sdmUgPSByZXF1aXJlKCcuL3Jlc29sdmUnKTtcbnZhciBJTlRFUk5BTCA9IHJlcXVpcmUoJy4vSU5URVJOQUwnKTtcbnZhciBoYW5kbGVycyA9IHJlcXVpcmUoJy4vaGFuZGxlcnMnKTtcbm1vZHVsZS5leHBvcnRzID0gYWxsO1xuZnVuY3Rpb24gYWxsKGl0ZXJhYmxlKSB7XG4gIGlmIChPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoaXRlcmFibGUpICE9PSAnW29iamVjdCBBcnJheV0nKSB7XG4gICAgcmV0dXJuIHJlamVjdChuZXcgVHlwZUVycm9yKCdtdXN0IGJlIGFuIGFycmF5JykpO1xuICB9XG5cbiAgdmFyIGxlbiA9IGl0ZXJhYmxlLmxlbmd0aDtcbiAgdmFyIGNhbGxlZCA9IGZhbHNlO1xuICBpZiAoIWxlbikge1xuICAgIHJldHVybiByZXNvbHZlKFtdKTtcbiAgfVxuXG4gIHZhciB2YWx1ZXMgPSBuZXcgQXJyYXkobGVuKTtcbiAgdmFyIHJlc29sdmVkID0gMDtcbiAgdmFyIGkgPSAtMTtcbiAgdmFyIHByb21pc2UgPSBuZXcgUHJvbWlzZShJTlRFUk5BTCk7XG4gIFxuICB3aGlsZSAoKytpIDwgbGVuKSB7XG4gICAgYWxsUmVzb2x2ZXIoaXRlcmFibGVbaV0sIGkpO1xuICB9XG4gIHJldHVybiBwcm9taXNlO1xuICBmdW5jdGlvbiBhbGxSZXNvbHZlcih2YWx1ZSwgaSkge1xuICAgIHJlc29sdmUodmFsdWUpLnRoZW4ocmVzb2x2ZUZyb21BbGwsIGZ1bmN0aW9uIChlcnJvcikge1xuICAgICAgaWYgKCFjYWxsZWQpIHtcbiAgICAgICAgY2FsbGVkID0gdHJ1ZTtcbiAgICAgICAgaGFuZGxlcnMucmVqZWN0KHByb21pc2UsIGVycm9yKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICBmdW5jdGlvbiByZXNvbHZlRnJvbUFsbChvdXRWYWx1ZSkge1xuICAgICAgdmFsdWVzW2ldID0gb3V0VmFsdWU7XG4gICAgICBpZiAoKytyZXNvbHZlZCA9PT0gbGVuICYgIWNhbGxlZCkge1xuICAgICAgICBjYWxsZWQgPSB0cnVlO1xuICAgICAgICBoYW5kbGVycy5yZXNvbHZlKHByb21pc2UsIHZhbHVlcyk7XG4gICAgICB9XG4gICAgfVxuICB9XG59IiwiJ3VzZSBzdHJpY3QnO1xudmFyIHRyeUNhdGNoID0gcmVxdWlyZSgnLi90cnlDYXRjaCcpO1xudmFyIHJlc29sdmVUaGVuYWJsZSA9IHJlcXVpcmUoJy4vcmVzb2x2ZVRoZW5hYmxlJyk7XG52YXIgc3RhdGVzID0gcmVxdWlyZSgnLi9zdGF0ZXMnKTtcblxuZXhwb3J0cy5yZXNvbHZlID0gZnVuY3Rpb24gKHNlbGYsIHZhbHVlKSB7XG4gIHZhciByZXN1bHQgPSB0cnlDYXRjaChnZXRUaGVuLCB2YWx1ZSk7XG4gIGlmIChyZXN1bHQuc3RhdHVzID09PSAnZXJyb3InKSB7XG4gICAgcmV0dXJuIGV4cG9ydHMucmVqZWN0KHNlbGYsIHJlc3VsdC52YWx1ZSk7XG4gIH1cbiAgdmFyIHRoZW5hYmxlID0gcmVzdWx0LnZhbHVlO1xuXG4gIGlmICh0aGVuYWJsZSkge1xuICAgIHJlc29sdmVUaGVuYWJsZS5zYWZlbHkoc2VsZiwgdGhlbmFibGUpO1xuICB9IGVsc2Uge1xuICAgIHNlbGYuc3RhdGUgPSBzdGF0ZXMuRlVMRklMTEVEO1xuICAgIHNlbGYub3V0Y29tZSA9IHZhbHVlO1xuICAgIHZhciBpID0gLTE7XG4gICAgdmFyIGxlbiA9IHNlbGYucXVldWUubGVuZ3RoO1xuICAgIHdoaWxlICgrK2kgPCBsZW4pIHtcbiAgICAgIHNlbGYucXVldWVbaV0uY2FsbEZ1bGZpbGxlZCh2YWx1ZSk7XG4gICAgfVxuICB9XG4gIHJldHVybiBzZWxmO1xufTtcbmV4cG9ydHMucmVqZWN0ID0gZnVuY3Rpb24gKHNlbGYsIGVycm9yKSB7XG4gIHNlbGYuc3RhdGUgPSBzdGF0ZXMuUkVKRUNURUQ7XG4gIHNlbGYub3V0Y29tZSA9IGVycm9yO1xuICB2YXIgaSA9IC0xO1xuICB2YXIgbGVuID0gc2VsZi5xdWV1ZS5sZW5ndGg7XG4gIHdoaWxlICgrK2kgPCBsZW4pIHtcbiAgICBzZWxmLnF1ZXVlW2ldLmNhbGxSZWplY3RlZChlcnJvcik7XG4gIH1cbiAgcmV0dXJuIHNlbGY7XG59O1xuXG5mdW5jdGlvbiBnZXRUaGVuKG9iaikge1xuICAvLyBNYWtlIHN1cmUgd2Ugb25seSBhY2Nlc3MgdGhlIGFjY2Vzc29yIG9uY2UgYXMgcmVxdWlyZWQgYnkgdGhlIHNwZWNcbiAgdmFyIHRoZW4gPSBvYmogJiYgb2JqLnRoZW47XG4gIGlmIChvYmogJiYgdHlwZW9mIG9iaiA9PT0gJ29iamVjdCcgJiYgdHlwZW9mIHRoZW4gPT09ICdmdW5jdGlvbicpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24gYXBweVRoZW4oKSB7XG4gICAgICB0aGVuLmFwcGx5KG9iaiwgYXJndW1lbnRzKTtcbiAgICB9O1xuICB9XG59IiwibW9kdWxlLmV4cG9ydHMgPSBleHBvcnRzID0gcmVxdWlyZSgnLi9wcm9taXNlJyk7XG5cbmV4cG9ydHMucmVzb2x2ZSA9IHJlcXVpcmUoJy4vcmVzb2x2ZScpO1xuZXhwb3J0cy5yZWplY3QgPSByZXF1aXJlKCcuL3JlamVjdCcpO1xuZXhwb3J0cy5hbGwgPSByZXF1aXJlKCcuL2FsbCcpO1xuZXhwb3J0cy5yYWNlID0gcmVxdWlyZSgnLi9yYWNlJyk7IiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgdW53cmFwID0gcmVxdWlyZSgnLi91bndyYXAnKTtcbnZhciBJTlRFUk5BTCA9IHJlcXVpcmUoJy4vSU5URVJOQUwnKTtcbnZhciByZXNvbHZlVGhlbmFibGUgPSByZXF1aXJlKCcuL3Jlc29sdmVUaGVuYWJsZScpO1xudmFyIHN0YXRlcyA9IHJlcXVpcmUoJy4vc3RhdGVzJyk7XG52YXIgUXVldWVJdGVtID0gcmVxdWlyZSgnLi9xdWV1ZUl0ZW0nKTtcblxubW9kdWxlLmV4cG9ydHMgPSBQcm9taXNlO1xuZnVuY3Rpb24gUHJvbWlzZShyZXNvbHZlcikge1xuICBpZiAoISh0aGlzIGluc3RhbmNlb2YgUHJvbWlzZSkpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UocmVzb2x2ZXIpO1xuICB9XG4gIGlmICh0eXBlb2YgcmVzb2x2ZXIgIT09ICdmdW5jdGlvbicpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdyZXNvbHZlciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcbiAgfVxuICB0aGlzLnN0YXRlID0gc3RhdGVzLlBFTkRJTkc7XG4gIHRoaXMucXVldWUgPSBbXTtcbiAgdGhpcy5vdXRjb21lID0gdm9pZCAwO1xuICBpZiAocmVzb2x2ZXIgIT09IElOVEVSTkFMKSB7XG4gICAgcmVzb2x2ZVRoZW5hYmxlLnNhZmVseSh0aGlzLCByZXNvbHZlcik7XG4gIH1cbn1cblxuUHJvbWlzZS5wcm90b3R5cGVbJ2NhdGNoJ10gPSBmdW5jdGlvbiAob25SZWplY3RlZCkge1xuICByZXR1cm4gdGhpcy50aGVuKG51bGwsIG9uUmVqZWN0ZWQpO1xufTtcblByb21pc2UucHJvdG90eXBlLnRoZW4gPSBmdW5jdGlvbiAob25GdWxmaWxsZWQsIG9uUmVqZWN0ZWQpIHtcbiAgaWYgKHR5cGVvZiBvbkZ1bGZpbGxlZCAhPT0gJ2Z1bmN0aW9uJyAmJiB0aGlzLnN0YXRlID09PSBzdGF0ZXMuRlVMRklMTEVEIHx8XG4gICAgdHlwZW9mIG9uUmVqZWN0ZWQgIT09ICdmdW5jdGlvbicgJiYgdGhpcy5zdGF0ZSA9PT0gc3RhdGVzLlJFSkVDVEVEKSB7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cbiAgdmFyIHByb21pc2UgPSBuZXcgUHJvbWlzZShJTlRFUk5BTCk7XG5cbiAgXG4gIGlmICh0aGlzLnN0YXRlICE9PSBzdGF0ZXMuUEVORElORykge1xuICAgIHZhciByZXNvbHZlciA9IHRoaXMuc3RhdGUgPT09IHN0YXRlcy5GVUxGSUxMRUQgPyBvbkZ1bGZpbGxlZDogb25SZWplY3RlZDtcbiAgICB1bndyYXAocHJvbWlzZSwgcmVzb2x2ZXIsIHRoaXMub3V0Y29tZSk7XG4gIH0gZWxzZSB7XG4gICAgdGhpcy5xdWV1ZS5wdXNoKG5ldyBRdWV1ZUl0ZW0ocHJvbWlzZSwgb25GdWxmaWxsZWQsIG9uUmVqZWN0ZWQpKTtcbiAgfVxuXG4gIHJldHVybiBwcm9taXNlO1xufTtcbiIsIid1c2Ugc3RyaWN0JztcbnZhciBoYW5kbGVycyA9IHJlcXVpcmUoJy4vaGFuZGxlcnMnKTtcbnZhciB1bndyYXAgPSByZXF1aXJlKCcuL3Vud3JhcCcpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFF1ZXVlSXRlbTtcbmZ1bmN0aW9uIFF1ZXVlSXRlbShwcm9taXNlLCBvbkZ1bGZpbGxlZCwgb25SZWplY3RlZCkge1xuICB0aGlzLnByb21pc2UgPSBwcm9taXNlO1xuICBpZiAodHlwZW9mIG9uRnVsZmlsbGVkID09PSAnZnVuY3Rpb24nKSB7XG4gICAgdGhpcy5vbkZ1bGZpbGxlZCA9IG9uRnVsZmlsbGVkO1xuICAgIHRoaXMuY2FsbEZ1bGZpbGxlZCA9IHRoaXMub3RoZXJDYWxsRnVsZmlsbGVkO1xuICB9XG4gIGlmICh0eXBlb2Ygb25SZWplY3RlZCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgIHRoaXMub25SZWplY3RlZCA9IG9uUmVqZWN0ZWQ7XG4gICAgdGhpcy5jYWxsUmVqZWN0ZWQgPSB0aGlzLm90aGVyQ2FsbFJlamVjdGVkO1xuICB9XG59XG5RdWV1ZUl0ZW0ucHJvdG90eXBlLmNhbGxGdWxmaWxsZWQgPSBmdW5jdGlvbiAodmFsdWUpIHtcbiAgaGFuZGxlcnMucmVzb2x2ZSh0aGlzLnByb21pc2UsIHZhbHVlKTtcbn07XG5RdWV1ZUl0ZW0ucHJvdG90eXBlLm90aGVyQ2FsbEZ1bGZpbGxlZCA9IGZ1bmN0aW9uICh2YWx1ZSkge1xuICB1bndyYXAodGhpcy5wcm9taXNlLCB0aGlzLm9uRnVsZmlsbGVkLCB2YWx1ZSk7XG59O1xuUXVldWVJdGVtLnByb3RvdHlwZS5jYWxsUmVqZWN0ZWQgPSBmdW5jdGlvbiAodmFsdWUpIHtcbiAgaGFuZGxlcnMucmVqZWN0KHRoaXMucHJvbWlzZSwgdmFsdWUpO1xufTtcblF1ZXVlSXRlbS5wcm90b3R5cGUub3RoZXJDYWxsUmVqZWN0ZWQgPSBmdW5jdGlvbiAodmFsdWUpIHtcbiAgdW53cmFwKHRoaXMucHJvbWlzZSwgdGhpcy5vblJlamVjdGVkLCB2YWx1ZSk7XG59OyIsIid1c2Ugc3RyaWN0JztcbnZhciBQcm9taXNlID0gcmVxdWlyZSgnLi9wcm9taXNlJyk7XG52YXIgcmVqZWN0ID0gcmVxdWlyZSgnLi9yZWplY3QnKTtcbnZhciByZXNvbHZlID0gcmVxdWlyZSgnLi9yZXNvbHZlJyk7XG52YXIgSU5URVJOQUwgPSByZXF1aXJlKCcuL0lOVEVSTkFMJyk7XG52YXIgaGFuZGxlcnMgPSByZXF1aXJlKCcuL2hhbmRsZXJzJyk7XG5tb2R1bGUuZXhwb3J0cyA9IHJhY2U7XG5mdW5jdGlvbiByYWNlKGl0ZXJhYmxlKSB7XG4gIGlmIChPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoaXRlcmFibGUpICE9PSAnW29iamVjdCBBcnJheV0nKSB7XG4gICAgcmV0dXJuIHJlamVjdChuZXcgVHlwZUVycm9yKCdtdXN0IGJlIGFuIGFycmF5JykpO1xuICB9XG5cbiAgdmFyIGxlbiA9IGl0ZXJhYmxlLmxlbmd0aDtcbiAgdmFyIGNhbGxlZCA9IGZhbHNlO1xuICBpZiAoIWxlbikge1xuICAgIHJldHVybiByZXNvbHZlKFtdKTtcbiAgfVxuXG4gIHZhciByZXNvbHZlZCA9IDA7XG4gIHZhciBpID0gLTE7XG4gIHZhciBwcm9taXNlID0gbmV3IFByb21pc2UoSU5URVJOQUwpO1xuICBcbiAgd2hpbGUgKCsraSA8IGxlbikge1xuICAgIHJlc29sdmVyKGl0ZXJhYmxlW2ldKTtcbiAgfVxuICByZXR1cm4gcHJvbWlzZTtcbiAgZnVuY3Rpb24gcmVzb2x2ZXIodmFsdWUpIHtcbiAgICByZXNvbHZlKHZhbHVlKS50aGVuKGZ1bmN0aW9uIChyZXNwb25zZSkge1xuICAgICAgaWYgKCFjYWxsZWQpIHtcbiAgICAgICAgY2FsbGVkID0gdHJ1ZTtcbiAgICAgICAgaGFuZGxlcnMucmVzb2x2ZShwcm9taXNlLCByZXNwb25zZSk7XG4gICAgICB9XG4gICAgfSwgZnVuY3Rpb24gKGVycm9yKSB7XG4gICAgICBpZiAoIWNhbGxlZCkge1xuICAgICAgICBjYWxsZWQgPSB0cnVlO1xuICAgICAgICBoYW5kbGVycy5yZWplY3QocHJvbWlzZSwgZXJyb3IpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG59IiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgUHJvbWlzZSA9IHJlcXVpcmUoJy4vcHJvbWlzZScpO1xudmFyIElOVEVSTkFMID0gcmVxdWlyZSgnLi9JTlRFUk5BTCcpO1xudmFyIGhhbmRsZXJzID0gcmVxdWlyZSgnLi9oYW5kbGVycycpO1xubW9kdWxlLmV4cG9ydHMgPSByZWplY3Q7XG5cbmZ1bmN0aW9uIHJlamVjdChyZWFzb24pIHtcblx0dmFyIHByb21pc2UgPSBuZXcgUHJvbWlzZShJTlRFUk5BTCk7XG5cdHJldHVybiBoYW5kbGVycy5yZWplY3QocHJvbWlzZSwgcmVhc29uKTtcbn0iLCIndXNlIHN0cmljdCc7XG5cbnZhciBQcm9taXNlID0gcmVxdWlyZSgnLi9wcm9taXNlJyk7XG52YXIgSU5URVJOQUwgPSByZXF1aXJlKCcuL0lOVEVSTkFMJyk7XG52YXIgaGFuZGxlcnMgPSByZXF1aXJlKCcuL2hhbmRsZXJzJyk7XG5tb2R1bGUuZXhwb3J0cyA9IHJlc29sdmU7XG5cbnZhciBGQUxTRSA9IGhhbmRsZXJzLnJlc29sdmUobmV3IFByb21pc2UoSU5URVJOQUwpLCBmYWxzZSk7XG52YXIgTlVMTCA9IGhhbmRsZXJzLnJlc29sdmUobmV3IFByb21pc2UoSU5URVJOQUwpLCBudWxsKTtcbnZhciBVTkRFRklORUQgPSBoYW5kbGVycy5yZXNvbHZlKG5ldyBQcm9taXNlKElOVEVSTkFMKSwgdm9pZCAwKTtcbnZhciBaRVJPID0gaGFuZGxlcnMucmVzb2x2ZShuZXcgUHJvbWlzZShJTlRFUk5BTCksIDApO1xudmFyIEVNUFRZU1RSSU5HID0gaGFuZGxlcnMucmVzb2x2ZShuZXcgUHJvbWlzZShJTlRFUk5BTCksICcnKTtcblxuZnVuY3Rpb24gcmVzb2x2ZSh2YWx1ZSkge1xuICBpZiAodmFsdWUpIHtcbiAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBQcm9taXNlKSB7XG4gICAgICByZXR1cm4gdmFsdWU7XG4gICAgfVxuICAgIHJldHVybiBoYW5kbGVycy5yZXNvbHZlKG5ldyBQcm9taXNlKElOVEVSTkFMKSwgdmFsdWUpO1xuICB9XG4gIHZhciB2YWx1ZVR5cGUgPSB0eXBlb2YgdmFsdWU7XG4gIHN3aXRjaCAodmFsdWVUeXBlKSB7XG4gICAgY2FzZSAnYm9vbGVhbic6XG4gICAgICByZXR1cm4gRkFMU0U7XG4gICAgY2FzZSAndW5kZWZpbmVkJzpcbiAgICAgIHJldHVybiBVTkRFRklORUQ7XG4gICAgY2FzZSAnb2JqZWN0JzpcbiAgICAgIHJldHVybiBOVUxMO1xuICAgIGNhc2UgJ251bWJlcic6XG4gICAgICByZXR1cm4gWkVSTztcbiAgICBjYXNlICdzdHJpbmcnOlxuICAgICAgcmV0dXJuIEVNUFRZU1RSSU5HO1xuICB9XG59IiwiJ3VzZSBzdHJpY3QnO1xudmFyIGhhbmRsZXJzID0gcmVxdWlyZSgnLi9oYW5kbGVycycpO1xudmFyIHRyeUNhdGNoID0gcmVxdWlyZSgnLi90cnlDYXRjaCcpO1xuZnVuY3Rpb24gc2FmZWx5UmVzb2x2ZVRoZW5hYmxlKHNlbGYsIHRoZW5hYmxlKSB7XG4gIC8vIEVpdGhlciBmdWxmaWxsLCByZWplY3Qgb3IgcmVqZWN0IHdpdGggZXJyb3JcbiAgdmFyIGNhbGxlZCA9IGZhbHNlO1xuICBmdW5jdGlvbiBvbkVycm9yKHZhbHVlKSB7XG4gICAgaWYgKGNhbGxlZCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjYWxsZWQgPSB0cnVlO1xuICAgIGhhbmRsZXJzLnJlamVjdChzZWxmLCB2YWx1ZSk7XG4gIH1cblxuICBmdW5jdGlvbiBvblN1Y2Nlc3ModmFsdWUpIHtcbiAgICBpZiAoY2FsbGVkKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNhbGxlZCA9IHRydWU7XG4gICAgaGFuZGxlcnMucmVzb2x2ZShzZWxmLCB2YWx1ZSk7XG4gIH1cblxuICBmdW5jdGlvbiB0cnlUb1Vud3JhcCgpIHtcbiAgICB0aGVuYWJsZShvblN1Y2Nlc3MsIG9uRXJyb3IpO1xuICB9XG4gIFxuICB2YXIgcmVzdWx0ID0gdHJ5Q2F0Y2godHJ5VG9VbndyYXApO1xuICBpZiAocmVzdWx0LnN0YXR1cyA9PT0gJ2Vycm9yJykge1xuICAgIG9uRXJyb3IocmVzdWx0LnZhbHVlKTtcbiAgfVxufVxuZXhwb3J0cy5zYWZlbHkgPSBzYWZlbHlSZXNvbHZlVGhlbmFibGU7IiwiLy8gTGF6eSBtYW4ncyBzeW1ib2xzIGZvciBzdGF0ZXNcblxuZXhwb3J0cy5SRUpFQ1RFRCA9IFsnUkVKRUNURUQnXTtcbmV4cG9ydHMuRlVMRklMTEVEID0gWydGVUxGSUxMRUQnXTtcbmV4cG9ydHMuUEVORElORyA9IFsnUEVORElORyddOyIsIid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSB0cnlDYXRjaDtcblxuZnVuY3Rpb24gdHJ5Q2F0Y2goZnVuYywgdmFsdWUpIHtcbiAgdmFyIG91dCA9IHt9O1xuICB0cnkge1xuICAgIG91dC52YWx1ZSA9IGZ1bmModmFsdWUpO1xuICAgIG91dC5zdGF0dXMgPSAnc3VjY2Vzcyc7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBvdXQuc3RhdHVzID0gJ2Vycm9yJztcbiAgICBvdXQudmFsdWUgPSBlO1xuICB9XG4gIHJldHVybiBvdXQ7XG59IiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgaW1tZWRpYXRlID0gcmVxdWlyZSgnaW1tZWRpYXRlJyk7XG52YXIgaGFuZGxlcnMgPSByZXF1aXJlKCcuL2hhbmRsZXJzJyk7XG5tb2R1bGUuZXhwb3J0cyA9IHVud3JhcDtcblxuZnVuY3Rpb24gdW53cmFwKHByb21pc2UsIGZ1bmMsIHZhbHVlKSB7XG4gIGltbWVkaWF0ZShmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHJldHVyblZhbHVlO1xuICAgIHRyeSB7XG4gICAgICByZXR1cm5WYWx1ZSA9IGZ1bmModmFsdWUpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIHJldHVybiBoYW5kbGVycy5yZWplY3QocHJvbWlzZSwgZSk7XG4gICAgfVxuICAgIGlmIChyZXR1cm5WYWx1ZSA9PT0gcHJvbWlzZSkge1xuICAgICAgaGFuZGxlcnMucmVqZWN0KHByb21pc2UsIG5ldyBUeXBlRXJyb3IoJ0Nhbm5vdCByZXNvbHZlIHByb21pc2Ugd2l0aCBpdHNlbGYnKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGhhbmRsZXJzLnJlc29sdmUocHJvbWlzZSwgcmV0dXJuVmFsdWUpO1xuICAgIH1cbiAgfSk7XG59IiwiJ3VzZSBzdHJpY3QnO1xudmFyIHR5cGVzID0gW1xuICByZXF1aXJlKCcuL25leHRUaWNrJyksXG4gIHJlcXVpcmUoJy4vbXV0YXRpb24uanMnKSxcbiAgcmVxdWlyZSgnLi9tZXNzYWdlQ2hhbm5lbCcpLFxuICByZXF1aXJlKCcuL3N0YXRlQ2hhbmdlJyksXG4gIHJlcXVpcmUoJy4vdGltZW91dCcpXG5dO1xudmFyIGRyYWluaW5nO1xudmFyIHF1ZXVlID0gW107XG4vL25hbWVkIG5leHRUaWNrIGZvciBsZXNzIGNvbmZ1c2luZyBzdGFjayB0cmFjZXNcbmZ1bmN0aW9uIG5leHRUaWNrKCkge1xuICBkcmFpbmluZyA9IHRydWU7XG4gIHZhciBpLCBvbGRRdWV1ZTtcbiAgdmFyIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgd2hpbGUgKGxlbikge1xuICAgIG9sZFF1ZXVlID0gcXVldWU7XG4gICAgcXVldWUgPSBbXTtcbiAgICBpID0gLTE7XG4gICAgd2hpbGUgKCsraSA8IGxlbikge1xuICAgICAgb2xkUXVldWVbaV0oKTtcbiAgICB9XG4gICAgbGVuID0gcXVldWUubGVuZ3RoO1xuICB9XG4gIGRyYWluaW5nID0gZmFsc2U7XG59XG52YXIgc2NoZWR1bGVEcmFpbjtcbnZhciBpID0gLTE7XG52YXIgbGVuID0gdHlwZXMubGVuZ3RoO1xud2hpbGUgKCsrIGkgPCBsZW4pIHtcbiAgaWYgKHR5cGVzW2ldICYmIHR5cGVzW2ldLnRlc3QgJiYgdHlwZXNbaV0udGVzdCgpKSB7XG4gICAgc2NoZWR1bGVEcmFpbiA9IHR5cGVzW2ldLmluc3RhbGwobmV4dFRpY2spO1xuICAgIGJyZWFrO1xuICB9XG59XG5tb2R1bGUuZXhwb3J0cyA9IGltbWVkaWF0ZTtcbmZ1bmN0aW9uIGltbWVkaWF0ZSh0YXNrKSB7XG4gIGlmIChxdWV1ZS5wdXNoKHRhc2spID09PSAxICYmICFkcmFpbmluZykge1xuICAgIHNjaGVkdWxlRHJhaW4oKTtcbiAgfVxufSIsIihmdW5jdGlvbiAoZ2xvYmFsKXtcbid1c2Ugc3RyaWN0JztcblxuZXhwb3J0cy50ZXN0ID0gZnVuY3Rpb24gKCkge1xuICBpZiAoZ2xvYmFsLnNldEltbWVkaWF0ZSkge1xuICAgIC8vIHdlIGNhbiBvbmx5IGdldCBoZXJlIGluIElFMTBcbiAgICAvLyB3aGljaCBkb2Vzbid0IGhhbmRlbCBwb3N0TWVzc2FnZSB3ZWxsXG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIHJldHVybiB0eXBlb2YgZ2xvYmFsLk1lc3NhZ2VDaGFubmVsICE9PSAndW5kZWZpbmVkJztcbn07XG5cbmV4cG9ydHMuaW5zdGFsbCA9IGZ1bmN0aW9uIChmdW5jKSB7XG4gIHZhciBjaGFubmVsID0gbmV3IGdsb2JhbC5NZXNzYWdlQ2hhbm5lbCgpO1xuICBjaGFubmVsLnBvcnQxLm9ubWVzc2FnZSA9IGZ1bmM7XG4gIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgY2hhbm5lbC5wb3J0Mi5wb3N0TWVzc2FnZSgwKTtcbiAgfTtcbn07XG59KS5jYWxsKHRoaXMsdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbCA6IHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSkiLCIoZnVuY3Rpb24gKGdsb2JhbCl7XG4ndXNlIHN0cmljdCc7XG4vL2Jhc2VkIG9mZiByc3ZwIGh0dHBzOi8vZ2l0aHViLmNvbS90aWxkZWlvL3JzdnAuanNcbi8vbGljZW5zZSBodHRwczovL2dpdGh1Yi5jb20vdGlsZGVpby9yc3ZwLmpzL2Jsb2IvbWFzdGVyL0xJQ0VOU0Vcbi8vaHR0cHM6Ly9naXRodWIuY29tL3RpbGRlaW8vcnN2cC5qcy9ibG9iL21hc3Rlci9saWIvcnN2cC9hc2FwLmpzXG5cbnZhciBNdXRhdGlvbiA9IGdsb2JhbC5NdXRhdGlvbk9ic2VydmVyIHx8IGdsb2JhbC5XZWJLaXRNdXRhdGlvbk9ic2VydmVyO1xuXG5leHBvcnRzLnRlc3QgPSBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiBNdXRhdGlvbjtcbn07XG5cbmV4cG9ydHMuaW5zdGFsbCA9IGZ1bmN0aW9uIChoYW5kbGUpIHtcbiAgdmFyIGNhbGxlZCA9IDA7XG4gIHZhciBvYnNlcnZlciA9IG5ldyBNdXRhdGlvbihoYW5kbGUpO1xuICB2YXIgZWxlbWVudCA9IGdsb2JhbC5kb2N1bWVudC5jcmVhdGVUZXh0Tm9kZSgnJyk7XG4gIG9ic2VydmVyLm9ic2VydmUoZWxlbWVudCwge1xuICAgIGNoYXJhY3RlckRhdGE6IHRydWVcbiAgfSk7XG4gIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgZWxlbWVudC5kYXRhID0gKGNhbGxlZCA9ICsrY2FsbGVkICUgMik7XG4gIH07XG59O1xufSkuY2FsbCh0aGlzLHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWwgOiB0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30pIiwiKGZ1bmN0aW9uIChnbG9iYWwpe1xuJ3VzZSBzdHJpY3QnO1xuXG5leHBvcnRzLnRlc3QgPSBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiAnZG9jdW1lbnQnIGluIGdsb2JhbCAmJiAnb25yZWFkeXN0YXRlY2hhbmdlJyBpbiBnbG9iYWwuZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc2NyaXB0Jyk7XG59O1xuXG5leHBvcnRzLmluc3RhbGwgPSBmdW5jdGlvbiAoaGFuZGxlKSB7XG4gIHJldHVybiBmdW5jdGlvbiAoKSB7XG5cbiAgICAvLyBDcmVhdGUgYSA8c2NyaXB0PiBlbGVtZW50OyBpdHMgcmVhZHlzdGF0ZWNoYW5nZSBldmVudCB3aWxsIGJlIGZpcmVkIGFzeW5jaHJvbm91c2x5IG9uY2UgaXQgaXMgaW5zZXJ0ZWRcbiAgICAvLyBpbnRvIHRoZSBkb2N1bWVudC4gRG8gc28sIHRodXMgcXVldWluZyB1cCB0aGUgdGFzay4gUmVtZW1iZXIgdG8gY2xlYW4gdXAgb25jZSBpdCdzIGJlZW4gY2FsbGVkLlxuICAgIHZhciBzY3JpcHRFbCA9IGdsb2JhbC5kb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzY3JpcHQnKTtcbiAgICBzY3JpcHRFbC5vbnJlYWR5c3RhdGVjaGFuZ2UgPSBmdW5jdGlvbiAoKSB7XG4gICAgICBoYW5kbGUoKTtcblxuICAgICAgc2NyaXB0RWwub25yZWFkeXN0YXRlY2hhbmdlID0gbnVsbDtcbiAgICAgIHNjcmlwdEVsLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQoc2NyaXB0RWwpO1xuICAgICAgc2NyaXB0RWwgPSBudWxsO1xuICAgIH07XG4gICAgZ2xvYmFsLmRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5hcHBlbmRDaGlsZChzY3JpcHRFbCk7XG5cbiAgICByZXR1cm4gaGFuZGxlO1xuICB9O1xufTtcbn0pLmNhbGwodGhpcyx0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiID8gZ2xvYmFsIDogdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9KSIsIid1c2Ugc3RyaWN0JztcbmV4cG9ydHMudGVzdCA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuIHRydWU7XG59O1xuXG5leHBvcnRzLmluc3RhbGwgPSBmdW5jdGlvbiAodCkge1xuICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgIHNldFRpbWVvdXQodCwgMCk7XG4gIH07XG59OyIsIihmdW5jdGlvbiAoKSB7XG4gICAgaWYgKHR5cGVvZiBzaWVzdGEgPT0gJ3VuZGVmaW5lZCcgJiYgdHlwZW9mIG1vZHVsZSA9PSAndW5kZWZpbmVkJykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0NvdWxkIG5vdCBmaW5kIHdpbmRvdy5zaWVzdGEuIE1ha2Ugc3VyZSB5b3UgaW5jbHVkZSBzaWVzdGEuY29yZS5qcyBmaXJzdC4nKTtcbiAgICB9XG5cbiAgICB2YXIgX2kgPSBzaWVzdGEuX2ludGVybmFsLFxuICAgICAgICBjYWNoZSA9IF9pLmNhY2hlLFxuICAgICAgICBDb2xsZWN0aW9uUmVnaXN0cnkgPSBfaS5Db2xsZWN0aW9uUmVnaXN0cnksXG4gICAgICAgIGxvZyA9IF9pLmxvZygnU3RvcmFnZScpLFxuICAgICAgICBlcnJvciA9IF9pLmVycm9yLFxuICAgICAgICB1dGlsID0gX2kudXRpbCxcbiAgICAgICAgXyA9IHV0aWwuXyxcbiAgICAgICAgZXZlbnRzID0gX2kuZXZlbnRzO1xuXG4gICAgdmFyIHVuc2F2ZWRPYmplY3RzID0gW10sXG4gICAgICAgIHVuc2F2ZWRPYmplY3RzSGFzaCA9IHt9LFxuICAgICAgICB1bnNhdmVkT2JqZWN0c0J5Q29sbGVjdGlvbiA9IHt9O1xuXG4gICAgdmFyIHN0b3JhZ2UgPSB7fTtcblxuXG4gICAgZnVuY3Rpb24gX2luaXRNZXRhKCkge1xuICAgICAgICByZXR1cm4ge2RhdGVGaWVsZHM6IFtdfTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBmdWxseVF1YWxpZmllZE1vZGVsTmFtZShjb2xsZWN0aW9uTmFtZSwgbW9kZWxOYW1lKSB7XG4gICAgICAgIHJldHVybiBjb2xsZWN0aW9uTmFtZSArICcuJyArIG1vZGVsTmFtZTtcbiAgICB9XG5cbiAgICBpZiAodHlwZW9mIFBvdWNoREIgPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgc2llc3RhLmV4dC5zdG9yYWdlRW5hYmxlZCA9IGZhbHNlO1xuICAgICAgICBjb25zb2xlLmxvZygnUG91Y2hEQiBpcyBub3QgcHJlc2VudCB0aGVyZWZvcmUgc3RvcmFnZSBpcyBkaXNhYmxlZC4nKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIHZhciBEQl9OQU1FID0gJ3NpZXN0YScsXG4gICAgICAgICAgICBwb3VjaCA9IG5ldyBQb3VjaERCKERCX05BTUUsIHthdXRvX2NvbXBhY3Rpb246IHRydWV9KTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogU29tZXRpbWVzIHNpZXN0YSBuZWVkcyB0byBzdG9yZSBzb21lIGV4dHJhIGluZm9ybWF0aW9uIGFib3V0IHRoZSBtb2RlbCBpbnN0YW5jZS5cbiAgICAgICAgICogQHBhcmFtIHNlcmlhbGlzZWRcbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIGZ1bmN0aW9uIF9hZGRNZXRhKHNlcmlhbGlzZWQpIHtcbiAgICAgICAgICAgIC8vIFBvdWNoREIgPD0gMy4yLjEgaGFzIGEgYnVnIHdoZXJlYnkgZGF0ZSBmaWVsZHMgYXJlIG5vdCBkZXNlcmlhbGlzZWQgcHJvcGVybHkgaWYgeW91IHVzZSBkYi5xdWVyeVxuICAgICAgICAgICAgLy8gdGhlcmVmb3JlIHdlIG5lZWQgdG8gYWRkIGV4dHJhIGluZm8gdG8gdGhlIG9iamVjdCBmb3IgZGVzZXJpYWxpc2luZyBkYXRlcyBtYW51YWxseS5cbiAgICAgICAgICAgIHNlcmlhbGlzZWQuc2llc3RhX21ldGEgPSBfaW5pdE1ldGEoKTtcbiAgICAgICAgICAgIGZvciAodmFyIHByb3AgaW4gc2VyaWFsaXNlZCkge1xuICAgICAgICAgICAgICAgIGlmIChzZXJpYWxpc2VkLmhhc093blByb3BlcnR5KHByb3ApKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChzZXJpYWxpc2VkW3Byb3BdIGluc3RhbmNlb2YgRGF0ZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2VyaWFsaXNlZC5zaWVzdGFfbWV0YS5kYXRlRmllbGRzLnB1c2gocHJvcCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBzZXJpYWxpc2VkW3Byb3BdID0gc2VyaWFsaXNlZFtwcm9wXS5nZXRUaW1lKCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBfcHJvY2Vzc01ldGEoZGF0dW0pIHtcbiAgICAgICAgICAgIHZhciBtZXRhID0gZGF0dW0uc2llc3RhX21ldGEgfHwgX2luaXRNZXRhKCk7XG4gICAgICAgICAgICBtZXRhLmRhdGVGaWVsZHMuZm9yRWFjaChmdW5jdGlvbiAoZGF0ZUZpZWxkKSB7XG4gICAgICAgICAgICAgICAgdmFyIHZhbHVlID0gZGF0dW1bZGF0ZUZpZWxkXTtcbiAgICAgICAgICAgICAgICBpZiAoISh2YWx1ZSBpbnN0YW5jZW9mIERhdGUpKSB7XG4gICAgICAgICAgICAgICAgICAgIGRhdHVtW2RhdGVGaWVsZF0gPSBuZXcgRGF0ZSh2YWx1ZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBkZWxldGUgZGF0dW0uc2llc3RhX21ldGE7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBjb25zdHJ1Y3RJbmRleERlc2lnbkRvYyhjb2xsZWN0aW9uTmFtZSwgbW9kZWxOYW1lKSB7XG4gICAgICAgICAgICB2YXIgZnVsbHlRdWFsaWZpZWROYW1lID0gZnVsbHlRdWFsaWZpZWRNb2RlbE5hbWUoY29sbGVjdGlvbk5hbWUsIG1vZGVsTmFtZSk7XG4gICAgICAgICAgICB2YXIgdmlld3MgPSB7fTtcbiAgICAgICAgICAgIHZpZXdzW2Z1bGx5UXVhbGlmaWVkTmFtZV0gPSB7XG4gICAgICAgICAgICAgICAgbWFwOiBmdW5jdGlvbiAoZG9jKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChkb2MuY29sbGVjdGlvbiA9PSAnJDEnICYmIGRvYy5tb2RlbCA9PSAnJDInKSBlbWl0KGRvYy5jb2xsZWN0aW9uICsgJy4nICsgZG9jLm1vZGVsLCBkb2MpO1xuICAgICAgICAgICAgICAgIH0udG9TdHJpbmcoKS5yZXBsYWNlKCckMScsIGNvbGxlY3Rpb25OYW1lKS5yZXBsYWNlKCckMicsIG1vZGVsTmFtZSlcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIF9pZDogJ19kZXNpZ24vJyArIGZ1bGx5UXVhbGlmaWVkTmFtZSxcbiAgICAgICAgICAgICAgICB2aWV3czogdmlld3NcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBjb25zdHJ1Y3RJbmRleGVzRm9yQWxsKCkge1xuICAgICAgICAgICAgdmFyIGluZGV4ZXMgPSBbXTtcbiAgICAgICAgICAgIHZhciByZWdpc3RyeSA9IHNpZXN0YS5faW50ZXJuYWwuQ29sbGVjdGlvblJlZ2lzdHJ5O1xuICAgICAgICAgICAgcmVnaXN0cnkuY29sbGVjdGlvbk5hbWVzLmZvckVhY2goZnVuY3Rpb24gKGNvbGxlY3Rpb25OYW1lKSB7XG4gICAgICAgICAgICAgICAgdmFyIG1vZGVscyA9IHJlZ2lzdHJ5W2NvbGxlY3Rpb25OYW1lXS5fbW9kZWxzO1xuICAgICAgICAgICAgICAgIGZvciAodmFyIG1vZGVsTmFtZSBpbiBtb2RlbHMpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG1vZGVscy5oYXNPd25Qcm9wZXJ0eShtb2RlbE5hbWUpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpbmRleGVzLnB1c2goY29uc3RydWN0SW5kZXhEZXNpZ25Eb2MoY29sbGVjdGlvbk5hbWUsIG1vZGVsTmFtZSkpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gaW5kZXhlcztcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIF9fZW5zdXJlSW5kZXhlcyhpbmRleGVzLCBjYikge1xuICAgICAgICAgICAgcG91Y2guYnVsa0RvY3MoaW5kZXhlcylcbiAgICAgICAgICAgICAgICAudGhlbihmdW5jdGlvbiAocmVzcCkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgZXJyb3JzID0gW107XG4gICAgICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcmVzcC5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHJlc3BvbnNlID0gcmVzcFtpXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghcmVzcG9uc2Uub2spIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBDb25mbGljdCBtZWFucyBhbHJlYWR5IGV4aXN0cywgYW5kIHRoaXMgaXMgZmluZSFcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgaXNDb25mbGljdCA9IHJlc3BvbnNlLnN0YXR1cyA9PSA0MDk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFpc0NvbmZsaWN0KSBlcnJvcnMucHVzaChyZXNwb25zZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgY2IoZXJyb3JzLmxlbmd0aCA/IGVycm9yKCdtdWx0aXBsZSBlcnJvcnMnLCB7ZXJyb3JzOiBlcnJvcnN9KSA6IG51bGwpO1xuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgLmNhdGNoKGNiKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIGVuc3VyZUluZGV4ZXNGb3JBbGwoY2IpIHtcbiAgICAgICAgICAgIHZhciBpbmRleGVzID0gY29uc3RydWN0SW5kZXhlc0ZvckFsbCgpO1xuICAgICAgICAgICAgX19lbnN1cmVJbmRleGVzKGluZGV4ZXMsIGNiKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBTZXJpYWxpc2UgYSBtb2RlbCBpbnRvIGEgZm9ybWF0IHRoYXQgUG91Y2hEQiBidWxrRG9jcyBBUEkgY2FuIHByb2Nlc3NcbiAgICAgICAgICogQHBhcmFtIHtNb2RlbEluc3RhbmNlfSBtb2RlbEluc3RhbmNlXG4gICAgICAgICAqL1xuICAgICAgICBmdW5jdGlvbiBfc2VyaWFsaXNlKG1vZGVsSW5zdGFuY2UpIHtcbiAgICAgICAgICAgIHZhciBzZXJpYWxpc2VkID0gc2llc3RhLl8uZXh0ZW5kKHt9LCBtb2RlbEluc3RhbmNlLl9fdmFsdWVzKTtcbiAgICAgICAgICAgIF9hZGRNZXRhKHNlcmlhbGlzZWQpO1xuICAgICAgICAgICAgc2VyaWFsaXNlZFsnY29sbGVjdGlvbiddID0gbW9kZWxJbnN0YW5jZS5jb2xsZWN0aW9uTmFtZTtcbiAgICAgICAgICAgIHNlcmlhbGlzZWRbJ21vZGVsJ10gPSBtb2RlbEluc3RhbmNlLm1vZGVsTmFtZTtcbiAgICAgICAgICAgIHNlcmlhbGlzZWRbJ19pZCddID0gbW9kZWxJbnN0YW5jZS5faWQ7XG4gICAgICAgICAgICBpZiAobW9kZWxJbnN0YW5jZS5yZW1vdmVkKSBzZXJpYWxpc2VkWydfZGVsZXRlZCddID0gdHJ1ZTtcbiAgICAgICAgICAgIHZhciByZXYgPSBtb2RlbEluc3RhbmNlLl9yZXY7XG4gICAgICAgICAgICBpZiAocmV2KSBzZXJpYWxpc2VkWydfcmV2J10gPSByZXY7XG4gICAgICAgICAgICBzZXJpYWxpc2VkID0gXy5yZWR1Y2UobW9kZWxJbnN0YW5jZS5fcmVsYXRpb25zaGlwTmFtZXMsIGZ1bmN0aW9uIChtZW1vLCBuKSB7XG4gICAgICAgICAgICAgICAgdmFyIHZhbCA9IG1vZGVsSW5zdGFuY2Vbbl07XG4gICAgICAgICAgICAgICAgaWYgKHNpZXN0YS5pc0FycmF5KHZhbCkpIHtcbiAgICAgICAgICAgICAgICAgICAgbWVtb1tuXSA9IF8ucGx1Y2sodmFsLCAnX2lkJyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2UgaWYgKHZhbCkge1xuICAgICAgICAgICAgICAgICAgICBtZW1vW25dID0gdmFsLl9pZDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIG1lbW87XG4gICAgICAgICAgICB9LCBzZXJpYWxpc2VkKTtcbiAgICAgICAgICAgIHJldHVybiBzZXJpYWxpc2VkO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gX3ByZXBhcmVEYXR1bShkYXR1bSwgbW9kZWwpIHtcbiAgICAgICAgICAgIF9wcm9jZXNzTWV0YShkYXR1bSk7XG4gICAgICAgICAgICBkZWxldGUgZGF0dW0uY29sbGVjdGlvbjtcbiAgICAgICAgICAgIGRlbGV0ZSBkYXR1bS5tb2RlbDtcbiAgICAgICAgICAgIHZhciByZWxhdGlvbnNoaXBOYW1lcyA9IG1vZGVsLl9yZWxhdGlvbnNoaXBOYW1lcztcbiAgICAgICAgICAgIF8uZWFjaChyZWxhdGlvbnNoaXBOYW1lcywgZnVuY3Rpb24gKHIpIHtcbiAgICAgICAgICAgICAgICB2YXIgX2lkID0gZGF0dW1bcl07XG4gICAgICAgICAgICAgICAgaWYgKHNpZXN0YS5pc0FycmF5KF9pZCkpIHtcbiAgICAgICAgICAgICAgICAgICAgZGF0dW1bcl0gPSBfLm1hcChfaWQsIGZ1bmN0aW9uICh4KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4ge19pZDogeH1cbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBkYXR1bVtyXSA9IHtfaWQ6IF9pZH07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gZGF0dW07XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIG9wdHNcbiAgICAgICAgICogQHBhcmFtIG9wdHMuY29sbGVjdGlvbk5hbWVcbiAgICAgICAgICogQHBhcmFtIG9wdHMubW9kZWxOYW1lXG4gICAgICAgICAqIEBwYXJhbSBjYWxsYmFja1xuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgZnVuY3Rpb24gX2xvYWRNb2RlbChvcHRzLCBjYWxsYmFjaykge1xuICAgICAgICAgICAgdmFyIGNvbGxlY3Rpb25OYW1lID0gb3B0cy5jb2xsZWN0aW9uTmFtZSxcbiAgICAgICAgICAgICAgICBtb2RlbE5hbWUgPSBvcHRzLm1vZGVsTmFtZTtcbiAgICAgICAgICAgIHZhciBmdWxseVF1YWxpZmllZE5hbWUgPSBmdWxseVF1YWxpZmllZE1vZGVsTmFtZShjb2xsZWN0aW9uTmFtZSwgbW9kZWxOYW1lKTtcbiAgICAgICAgICAgIGxvZygnTG9hZGluZyBpbnN0YW5jZXMgZm9yICcgKyBmdWxseVF1YWxpZmllZE5hbWUpO1xuICAgICAgICAgICAgdmFyIE1vZGVsID0gQ29sbGVjdGlvblJlZ2lzdHJ5W2NvbGxlY3Rpb25OYW1lXVttb2RlbE5hbWVdO1xuICAgICAgICAgICAgbG9nKCdRdWVyeWluZyBwb3VjaCcpO1xuICAgICAgICAgICAgcG91Y2gucXVlcnkoZnVsbHlRdWFsaWZpZWROYW1lKVxuICAgICAgICAgICAgICAgIC8vcG91Y2gucXVlcnkoe21hcDogbWFwRnVuY30pXG4gICAgICAgICAgICAgICAgLnRoZW4oZnVuY3Rpb24gKHJlc3ApIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nKCdRdWVyaWVkIHBvdWNoIHN1Y2Nlc3NmdWxseScpO1xuICAgICAgICAgICAgICAgICAgICB2YXIgZGF0YSA9IHNpZXN0YS5fLm1hcChzaWVzdGEuXy5wbHVjayhyZXNwLnJvd3MsICd2YWx1ZScpLCBmdW5jdGlvbiAoZGF0dW0pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBfcHJlcGFyZURhdHVtKGRhdHVtLCBNb2RlbCk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICBsb2coJ01hcHBpbmcgZGF0YScsIGRhdGEpO1xuICAgICAgICAgICAgICAgICAgICBNb2RlbC5ncmFwaChkYXRhLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkaXNhYmxlZXZlbnRzOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgX2lnbm9yZUluc3RhbGxlZDogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGZyb21TdG9yYWdlOiB0cnVlXG4gICAgICAgICAgICAgICAgICAgIH0sIGZ1bmN0aW9uIChlcnIsIGluc3RhbmNlcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAobG9nLmVuYWJsZWQpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZygnTG9hZGVkICcgKyBpbnN0YW5jZXMgPyBpbnN0YW5jZXMubGVuZ3RoLnRvU3RyaW5nKCkgOiAwICsgJyBpbnN0YW5jZXMgZm9yICcgKyBmdWxseVF1YWxpZmllZE5hbWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nKCdFcnJvciBsb2FkaW5nIG1vZGVscycsIGVycik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIsIGluc3RhbmNlcyk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgLmNhdGNoKGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIExvYWQgYWxsIGRhdGEgZnJvbSBQb3VjaERCLlxuICAgICAgICAgKi9cbiAgICAgICAgZnVuY3Rpb24gX2xvYWQoY2IpIHtcbiAgICAgICAgICAgIGlmIChzYXZpbmcpIHRocm93IG5ldyBFcnJvcignbm90IGxvYWRlZCB5ZXQgaG93IGNhbiBpIHNhdmUnKTtcbiAgICAgICAgICAgIHJldHVybiB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uIChjYikge1xuICAgICAgICAgICAgICAgIGlmIChzaWVzdGEuZXh0LnN0b3JhZ2VFbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBjb2xsZWN0aW9uTmFtZXMgPSBDb2xsZWN0aW9uUmVnaXN0cnkuY29sbGVjdGlvbk5hbWVzO1xuICAgICAgICAgICAgICAgICAgICB2YXIgdGFza3MgPSBbXTtcbiAgICAgICAgICAgICAgICAgICAgXy5lYWNoKGNvbGxlY3Rpb25OYW1lcywgZnVuY3Rpb24gKGNvbGxlY3Rpb25OYW1lKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgY29sbGVjdGlvbiA9IENvbGxlY3Rpb25SZWdpc3RyeVtjb2xsZWN0aW9uTmFtZV0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbW9kZWxOYW1lcyA9IE9iamVjdC5rZXlzKGNvbGxlY3Rpb24uX21vZGVscyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBfLmVhY2gobW9kZWxOYW1lcywgZnVuY3Rpb24gKG1vZGVsTmFtZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRhc2tzLnB1c2goZnVuY3Rpb24gKGNiKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIFdlIGNhbGwgZnJvbSBzdG9yYWdlIHRvIGFsbG93IGZvciByZXBsYWNlbWVudCBvZiBfbG9hZE1vZGVsIGZvciBwZXJmb3JtYW5jZSBleHRlbnNpb24uXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0b3JhZ2UuX2xvYWRNb2RlbCh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb2xsZWN0aW9uTmFtZTogY29sbGVjdGlvbk5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtb2RlbE5hbWU6IG1vZGVsTmFtZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LCBjYik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIHNpZXN0YS5hc3luYy5zZXJpZXModGFza3MsIGZ1bmN0aW9uIChlcnIsIHJlc3VsdHMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBuO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgaW5zdGFuY2VzID0gW107XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc2llc3RhLl8uZWFjaChyZXN1bHRzLCBmdW5jdGlvbiAocikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbnN0YW5jZXMgPSBpbnN0YW5jZXMuY29uY2F0KHIpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbiA9IGluc3RhbmNlcy5sZW5ndGg7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGxvZykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2coJ0xvYWRlZCAnICsgbi50b1N0cmluZygpICsgJyBpbnN0YW5jZXMnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBjYihlcnIsIG4pO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNiKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIHNhdmVDb25mbGljdHMob2JqZWN0cywgY2IpIHtcbiAgICAgICAgICAgIHBvdWNoLmFsbERvY3Moe2tleXM6IF8ucGx1Y2sob2JqZWN0cywgJ19pZCcpfSlcbiAgICAgICAgICAgICAgICAudGhlbihmdW5jdGlvbiAocmVzcCkge1xuICAgICAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHJlc3Aucm93cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgb2JqZWN0c1tpXS5fcmV2ID0gcmVzcC5yb3dzW2ldLnZhbHVlLnJldjtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBzYXZlVG9Qb3VjaChvYmplY3RzLCBjYik7XG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAuY2F0Y2goZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgICAgICAgICBjYihlcnIpO1xuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBzYXZlVG9Qb3VjaChvYmplY3RzLCBjYikge1xuICAgICAgICAgICAgdmFyIGNvbmZsaWN0cyA9IFtdO1xuICAgICAgICAgICAgcG91Y2guYnVsa0RvY3MoXy5tYXAob2JqZWN0cywgX3NlcmlhbGlzZSkpLnRoZW4oZnVuY3Rpb24gKHJlc3ApIHtcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHJlc3AubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHJlc3BvbnNlID0gcmVzcFtpXTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIG9iaiA9IG9iamVjdHNbaV07XG4gICAgICAgICAgICAgICAgICAgIGlmIChyZXNwb25zZS5vaykge1xuICAgICAgICAgICAgICAgICAgICAgICAgb2JqLl9yZXYgPSByZXNwb25zZS5yZXY7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSBpZiAocmVzcG9uc2Uuc3RhdHVzID09IDQwOSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uZmxpY3RzLnB1c2gob2JqKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZygnRXJyb3Igc2F2aW5nIG9iamVjdCB3aXRoIF9pZD1cIicgKyBvYmouX2lkICsgJ1wiJywgcmVzcG9uc2UpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChjb25mbGljdHMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgIHNhdmVDb25mbGljdHMoY29uZmxpY3RzLCBjYik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBjYigpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sIGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgICAgICBjYihlcnIpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBTYXZlIGFsbCBtb2RlbEV2ZW50cyBkb3duIHRvIFBvdWNoREIuXG4gICAgICAgICAqL1xuICAgICAgICBmdW5jdGlvbiBzYXZlKGNiKSB7XG4gICAgICAgICAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbiAoY2IpIHtcbiAgICAgICAgICAgICAgICBzaWVzdGEuX2FmdGVySW5zdGFsbChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBvYmplY3RzID0gdW5zYXZlZE9iamVjdHM7XG4gICAgICAgICAgICAgICAgICAgIHVuc2F2ZWRPYmplY3RzID0gW107XG4gICAgICAgICAgICAgICAgICAgIHVuc2F2ZWRPYmplY3RzSGFzaCA9IHt9O1xuICAgICAgICAgICAgICAgICAgICB1bnNhdmVkT2JqZWN0c0J5Q29sbGVjdGlvbiA9IHt9O1xuICAgICAgICAgICAgICAgICAgICBpZiAobG9nKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2coJ1NhdmluZyBvYmplY3RzJywgXy5tYXAob2JqZWN0cywgZnVuY3Rpb24gKHgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4geC5fZHVtcCgpXG4gICAgICAgICAgICAgICAgICAgICAgICB9KSlcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBzYXZlVG9Qb3VjaChvYmplY3RzLCBjYik7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9LmJpbmQodGhpcykpO1xuXG4gICAgICAgIH1cblxuICAgICAgICB2YXIgbGlzdGVuZXIgPSBmdW5jdGlvbiAobikge1xuICAgICAgICAgICAgdmFyIGNoYW5nZWRPYmplY3QgPSBuLm9iaixcbiAgICAgICAgICAgICAgICBpZGVudCA9IGNoYW5nZWRPYmplY3QuX2lkO1xuICAgICAgICAgICAgaWYgKCFjaGFuZ2VkT2JqZWN0KSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IF9pLmVycm9yLkludGVybmFsU2llc3RhRXJyb3IoJ05vIG9iaiBmaWVsZCBpbiBub3RpZmljYXRpb24gcmVjZWl2ZWQgYnkgc3RvcmFnZSBleHRlbnNpb24nKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICghKGlkZW50IGluIHVuc2F2ZWRPYmplY3RzSGFzaCkpIHtcbiAgICAgICAgICAgICAgICB1bnNhdmVkT2JqZWN0c0hhc2hbaWRlbnRdID0gY2hhbmdlZE9iamVjdDtcbiAgICAgICAgICAgICAgICB1bnNhdmVkT2JqZWN0cy5wdXNoKGNoYW5nZWRPYmplY3QpO1xuICAgICAgICAgICAgICAgIHZhciBjb2xsZWN0aW9uTmFtZSA9IGNoYW5nZWRPYmplY3QuY29sbGVjdGlvbk5hbWU7XG4gICAgICAgICAgICAgICAgaWYgKCF1bnNhdmVkT2JqZWN0c0J5Q29sbGVjdGlvbltjb2xsZWN0aW9uTmFtZV0pIHtcbiAgICAgICAgICAgICAgICAgICAgdW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb25bY29sbGVjdGlvbk5hbWVdID0ge307XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHZhciBtb2RlbE5hbWUgPSBjaGFuZ2VkT2JqZWN0Lm1vZGVsLm5hbWU7XG4gICAgICAgICAgICAgICAgaWYgKCF1bnNhdmVkT2JqZWN0c0J5Q29sbGVjdGlvbltjb2xsZWN0aW9uTmFtZV1bbW9kZWxOYW1lXSkge1xuICAgICAgICAgICAgICAgICAgICB1bnNhdmVkT2JqZWN0c0J5Q29sbGVjdGlvbltjb2xsZWN0aW9uTmFtZV1bbW9kZWxOYW1lXSA9IHt9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB1bnNhdmVkT2JqZWN0c0J5Q29sbGVjdGlvbltjb2xsZWN0aW9uTmFtZV1bbW9kZWxOYW1lXVtpZGVudF0gPSBjaGFuZ2VkT2JqZWN0O1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICBzaWVzdGEub24oJ1NpZXN0YScsIGxpc3RlbmVyKTtcblxuICAgICAgICBfLmV4dGVuZChzdG9yYWdlLCB7XG4gICAgICAgICAgICBfbG9hZDogX2xvYWQsXG4gICAgICAgICAgICBfbG9hZE1vZGVsOiBfbG9hZE1vZGVsLFxuICAgICAgICAgICAgc2F2ZTogc2F2ZSxcbiAgICAgICAgICAgIF9zZXJpYWxpc2U6IF9zZXJpYWxpc2UsXG4gICAgICAgICAgICBlbnN1cmVJbmRleGVzRm9yQWxsOiBlbnN1cmVJbmRleGVzRm9yQWxsLFxuICAgICAgICAgICAgX3Jlc2V0OiBmdW5jdGlvbiAoY2IpIHtcbiAgICAgICAgICAgICAgICBzaWVzdGEucmVtb3ZlTGlzdGVuZXIoJ1NpZXN0YScsIGxpc3RlbmVyKTtcbiAgICAgICAgICAgICAgICB1bnNhdmVkT2JqZWN0cyA9IFtdO1xuICAgICAgICAgICAgICAgIHVuc2F2ZWRPYmplY3RzSGFzaCA9IHt9O1xuICAgICAgICAgICAgICAgIHBvdWNoLmRlc3Ryb3koZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgcG91Y2ggPSBuZXcgUG91Y2hEQihEQl9OQU1FKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBzaWVzdGEub24oJ1NpZXN0YScsIGxpc3RlbmVyKTtcbiAgICAgICAgICAgICAgICAgICAgbG9nKCdSZXNldCBjb21wbGV0ZScpO1xuICAgICAgICAgICAgICAgICAgICBjYihlcnIpO1xuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfSk7XG5cbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnRpZXMoc3RvcmFnZSwge1xuICAgICAgICAgICAgX3Vuc2F2ZWRPYmplY3RzOiB7XG4gICAgICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB1bnNhdmVkT2JqZWN0c1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBfdW5zYXZlZE9iamVjdHNIYXNoOiB7XG4gICAgICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB1bnNhdmVkT2JqZWN0c0hhc2hcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgX3Vuc2F2ZWRPYmplY3RzQnlDb2xsZWN0aW9uOiB7XG4gICAgICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB1bnNhdmVkT2JqZWN0c0J5Q29sbGVjdGlvblxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBfcG91Y2g6IHtcbiAgICAgICAgICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHBvdWNoXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuXG4gICAgICAgIGlmICghc2llc3RhLmV4dCkgc2llc3RhLmV4dCA9IHt9O1xuICAgICAgICBzaWVzdGEuZXh0LnN0b3JhZ2UgPSBzdG9yYWdlO1xuXG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKHNpZXN0YS5leHQsIHtcbiAgICAgICAgICAgIHN0b3JhZ2VFbmFibGVkOiB7XG4gICAgICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChzaWVzdGEuZXh0Ll9zdG9yYWdlRW5hYmxlZCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gc2llc3RhLmV4dC5fc3RvcmFnZUVuYWJsZWQ7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuICEhc2llc3RhLmV4dC5zdG9yYWdlO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgc2V0OiBmdW5jdGlvbiAodikge1xuICAgICAgICAgICAgICAgICAgICBzaWVzdGEuZXh0Ll9zdG9yYWdlRW5hYmxlZCA9IHY7XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlXG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHZhciBpbnRlcnZhbCwgc2F2aW5nLCBhdXRvc2F2ZUludGVydmFsID0gMTAwMDtcblxuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydGllcyhzaWVzdGEsIHtcbiAgICAgICAgICAgIGF1dG9zYXZlOiB7XG4gICAgICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiAhIWludGVydmFsO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgc2V0OiBmdW5jdGlvbiAoYXV0b3NhdmUpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGF1dG9zYXZlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWludGVydmFsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaW50ZXJ2YWwgPSBzZXRJbnRlcnZhbChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIENoZWVreSB3YXkgb2YgYXZvaWRpbmcgbXVsdGlwbGUgc2F2ZXMgaGFwcGVuaW5nLi4uXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghc2F2aW5nKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzYXZpbmcgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2llc3RhLnNhdmUoZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50cy5lbWl0KCdzYXZlZCcpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzYXZpbmcgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSwgc2llc3RhLmF1dG9zYXZlSW50ZXJ2YWwpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGludGVydmFsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2xlYXJJbnRlcnZhbChpbnRlcnZhbCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaW50ZXJ2YWwgPSBudWxsO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGF1dG9zYXZlSW50ZXJ2YWw6IHtcbiAgICAgICAgICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGF1dG9zYXZlSW50ZXJ2YWw7XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBzZXQ6IGZ1bmN0aW9uIChfYXV0b3NhdmVJbnRlcnZhbCkge1xuICAgICAgICAgICAgICAgICAgICBhdXRvc2F2ZUludGVydmFsID0gX2F1dG9zYXZlSW50ZXJ2YWw7XG4gICAgICAgICAgICAgICAgICAgIGlmIChpbnRlcnZhbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gUmVzZXQgaW50ZXJ2YWxcbiAgICAgICAgICAgICAgICAgICAgICAgIHNpZXN0YS5hdXRvc2F2ZSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgc2llc3RhLmF1dG9zYXZlID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBkaXJ0eToge1xuICAgICAgICAgICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgdW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb24gPSBzaWVzdGEuZXh0LnN0b3JhZ2UuX3Vuc2F2ZWRPYmplY3RzQnlDb2xsZWN0aW9uO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gISFPYmplY3Qua2V5cyh1bnNhdmVkT2JqZWN0c0J5Q29sbGVjdGlvbikubGVuZ3RoO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICBfLmV4dGVuZChzaWVzdGEsIHtcbiAgICAgICAgICAgIHNhdmU6IHNhdmUsXG4gICAgICAgICAgICBzZXRQb3VjaDogZnVuY3Rpb24gKF9wKSB7XG4gICAgICAgICAgICAgICAgaWYgKHNpZXN0YS5fY2FuQ2hhbmdlKSBwb3VjaCA9IF9wO1xuICAgICAgICAgICAgICAgIGVsc2UgdGhyb3cgbmV3IEVycm9yKCdDYW5ub3QgY2hhbmdlIFBvdWNoREIgaW5zdGFuY2Ugd2hlbiBhbiBvYmplY3QgZ3JhcGggZXhpc3RzLicpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgIH1cblxuICAgIG1vZHVsZS5leHBvcnRzID0gc3RvcmFnZTtcblxufSkoKTsiLCIoZnVuY3Rpb24gKGdsb2JhbCl7XG4vKlxuICogQ29weXJpZ2h0IChjKSAyMDE0IFRoZSBQb2x5bWVyIFByb2plY3QgQXV0aG9ycy4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqIFRoaXMgY29kZSBtYXkgb25seSBiZSB1c2VkIHVuZGVyIHRoZSBCU0Qgc3R5bGUgbGljZW5zZSBmb3VuZCBhdCBodHRwOi8vcG9seW1lci5naXRodWIuaW8vTElDRU5TRS50eHRcbiAqIFRoZSBjb21wbGV0ZSBzZXQgb2YgYXV0aG9ycyBtYXkgYmUgZm91bmQgYXQgaHR0cDovL3BvbHltZXIuZ2l0aHViLmlvL0FVVEhPUlMudHh0XG4gKiBUaGUgY29tcGxldGUgc2V0IG9mIGNvbnRyaWJ1dG9ycyBtYXkgYmUgZm91bmQgYXQgaHR0cDovL3BvbHltZXIuZ2l0aHViLmlvL0NPTlRSSUJVVE9SUy50eHRcbiAqIENvZGUgZGlzdHJpYnV0ZWQgYnkgR29vZ2xlIGFzIHBhcnQgb2YgdGhlIHBvbHltZXIgcHJvamVjdCBpcyBhbHNvXG4gKiBzdWJqZWN0IHRvIGFuIGFkZGl0aW9uYWwgSVAgcmlnaHRzIGdyYW50IGZvdW5kIGF0IGh0dHA6Ly9wb2x5bWVyLmdpdGh1Yi5pby9QQVRFTlRTLnR4dFxuICovXG5cbihmdW5jdGlvbihnbG9iYWwpIHtcbiAgJ3VzZSBzdHJpY3QnO1xuXG4gIHZhciB0ZXN0aW5nRXhwb3NlQ3ljbGVDb3VudCA9IGdsb2JhbC50ZXN0aW5nRXhwb3NlQ3ljbGVDb3VudDtcblxuICAvLyBEZXRlY3QgYW5kIGRvIGJhc2ljIHNhbml0eSBjaGVja2luZyBvbiBPYmplY3QvQXJyYXkub2JzZXJ2ZS5cbiAgZnVuY3Rpb24gZGV0ZWN0T2JqZWN0T2JzZXJ2ZSgpIHtcbiAgICBpZiAodHlwZW9mIE9iamVjdC5vYnNlcnZlICE9PSAnZnVuY3Rpb24nIHx8XG4gICAgICAgIHR5cGVvZiBBcnJheS5vYnNlcnZlICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgdmFyIHJlY29yZHMgPSBbXTtcblxuICAgIGZ1bmN0aW9uIGNhbGxiYWNrKHJlY3MpIHtcbiAgICAgIHJlY29yZHMgPSByZWNzO1xuICAgIH1cblxuICAgIHZhciB0ZXN0ID0ge307XG4gICAgdmFyIGFyciA9IFtdO1xuICAgIE9iamVjdC5vYnNlcnZlKHRlc3QsIGNhbGxiYWNrKTtcbiAgICBBcnJheS5vYnNlcnZlKGFyciwgY2FsbGJhY2spO1xuICAgIHRlc3QuaWQgPSAxO1xuICAgIHRlc3QuaWQgPSAyO1xuICAgIGRlbGV0ZSB0ZXN0LmlkO1xuICAgIGFyci5wdXNoKDEsIDIpO1xuICAgIGFyci5sZW5ndGggPSAwO1xuXG4gICAgT2JqZWN0LmRlbGl2ZXJDaGFuZ2VSZWNvcmRzKGNhbGxiYWNrKTtcbiAgICBpZiAocmVjb3Jkcy5sZW5ndGggIT09IDUpXG4gICAgICByZXR1cm4gZmFsc2U7XG5cbiAgICBpZiAocmVjb3Jkc1swXS50eXBlICE9ICdhZGQnIHx8XG4gICAgICAgIHJlY29yZHNbMV0udHlwZSAhPSAndXBkYXRlJyB8fFxuICAgICAgICByZWNvcmRzWzJdLnR5cGUgIT0gJ2RlbGV0ZScgfHxcbiAgICAgICAgcmVjb3Jkc1szXS50eXBlICE9ICdzcGxpY2UnIHx8XG4gICAgICAgIHJlY29yZHNbNF0udHlwZSAhPSAnc3BsaWNlJykge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIE9iamVjdC51bm9ic2VydmUodGVzdCwgY2FsbGJhY2spO1xuICAgIEFycmF5LnVub2JzZXJ2ZShhcnIsIGNhbGxiYWNrKTtcblxuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgdmFyIGhhc09ic2VydmUgPSBkZXRlY3RPYmplY3RPYnNlcnZlKCk7XG5cbiAgZnVuY3Rpb24gZGV0ZWN0RXZhbCgpIHtcbiAgICAvLyBEb24ndCB0ZXN0IGZvciBldmFsIGlmIHdlJ3JlIHJ1bm5pbmcgaW4gYSBDaHJvbWUgQXBwIGVudmlyb25tZW50LlxuICAgIC8vIFdlIGNoZWNrIGZvciBBUElzIHNldCB0aGF0IG9ubHkgZXhpc3QgaW4gYSBDaHJvbWUgQXBwIGNvbnRleHQuXG4gICAgaWYgKHR5cGVvZiBjaHJvbWUgIT09ICd1bmRlZmluZWQnICYmIGNocm9tZS5hcHAgJiYgY2hyb21lLmFwcC5ydW50aW1lKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgLy8gRmlyZWZveCBPUyBBcHBzIGRvIG5vdCBhbGxvdyBldmFsLiBUaGlzIGZlYXR1cmUgZGV0ZWN0aW9uIGlzIHZlcnkgaGFja3lcbiAgICAvLyBidXQgZXZlbiBpZiBzb21lIG90aGVyIHBsYXRmb3JtIGFkZHMgc3VwcG9ydCBmb3IgdGhpcyBmdW5jdGlvbiB0aGlzIGNvZGVcbiAgICAvLyB3aWxsIGNvbnRpbnVlIHRvIHdvcmsuXG4gICAgaWYgKG5hdmlnYXRvci5nZXREZXZpY2VTdG9yYWdlKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgdHJ5IHtcbiAgICAgIHZhciBmID0gbmV3IEZ1bmN0aW9uKCcnLCAncmV0dXJuIHRydWU7Jyk7XG4gICAgICByZXR1cm4gZigpO1xuICAgIH0gY2F0Y2ggKGV4KSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgdmFyIGhhc0V2YWwgPSBkZXRlY3RFdmFsKCk7XG5cbiAgZnVuY3Rpb24gaXNJbmRleChzKSB7XG4gICAgcmV0dXJuICtzID09PSBzID4+PiAwICYmIHMgIT09ICcnO1xuICB9XG5cbiAgZnVuY3Rpb24gdG9OdW1iZXIocykge1xuICAgIHJldHVybiArcztcbiAgfVxuXG4gIHZhciBudW1iZXJJc05hTiA9IGdsb2JhbC5OdW1iZXIuaXNOYU4gfHwgZnVuY3Rpb24odmFsdWUpIHtcbiAgICByZXR1cm4gdHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJyAmJiBnbG9iYWwuaXNOYU4odmFsdWUpO1xuICB9XG5cblxuICB2YXIgY3JlYXRlT2JqZWN0ID0gKCdfX3Byb3RvX18nIGluIHt9KSA/XG4gICAgZnVuY3Rpb24ob2JqKSB7IHJldHVybiBvYmo7IH0gOlxuICAgIGZ1bmN0aW9uKG9iaikge1xuICAgICAgdmFyIHByb3RvID0gb2JqLl9fcHJvdG9fXztcbiAgICAgIGlmICghcHJvdG8pXG4gICAgICAgIHJldHVybiBvYmo7XG4gICAgICB2YXIgbmV3T2JqZWN0ID0gT2JqZWN0LmNyZWF0ZShwcm90byk7XG4gICAgICBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhvYmopLmZvckVhY2goZnVuY3Rpb24obmFtZSkge1xuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkobmV3T2JqZWN0LCBuYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKG9iaiwgbmFtZSkpO1xuICAgICAgfSk7XG4gICAgICByZXR1cm4gbmV3T2JqZWN0O1xuICAgIH07XG5cbiAgdmFyIGlkZW50U3RhcnQgPSAnW1xcJF9hLXpBLVpdJztcbiAgdmFyIGlkZW50UGFydCA9ICdbXFwkX2EtekEtWjAtOV0nO1xuXG5cbiAgdmFyIE1BWF9ESVJUWV9DSEVDS19DWUNMRVMgPSAxMDAwO1xuXG4gIGZ1bmN0aW9uIGRpcnR5Q2hlY2sob2JzZXJ2ZXIpIHtcbiAgICB2YXIgY3ljbGVzID0gMDtcbiAgICB3aGlsZSAoY3ljbGVzIDwgTUFYX0RJUlRZX0NIRUNLX0NZQ0xFUyAmJiBvYnNlcnZlci5jaGVja18oKSkge1xuICAgICAgY3ljbGVzKys7XG4gICAgfVxuICAgIGlmICh0ZXN0aW5nRXhwb3NlQ3ljbGVDb3VudClcbiAgICAgIGdsb2JhbC5kaXJ0eUNoZWNrQ3ljbGVDb3VudCA9IGN5Y2xlcztcblxuICAgIHJldHVybiBjeWNsZXMgPiAwO1xuICB9XG5cbiAgZnVuY3Rpb24gb2JqZWN0SXNFbXB0eShvYmplY3QpIHtcbiAgICBmb3IgKHZhciBwcm9wIGluIG9iamVjdClcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGRpZmZJc0VtcHR5KGRpZmYpIHtcbiAgICByZXR1cm4gb2JqZWN0SXNFbXB0eShkaWZmLmFkZGVkKSAmJlxuICAgICAgICAgICBvYmplY3RJc0VtcHR5KGRpZmYucmVtb3ZlZCkgJiZcbiAgICAgICAgICAgb2JqZWN0SXNFbXB0eShkaWZmLmNoYW5nZWQpO1xuICB9XG5cbiAgZnVuY3Rpb24gZGlmZk9iamVjdEZyb21PbGRPYmplY3Qob2JqZWN0LCBvbGRPYmplY3QpIHtcbiAgICB2YXIgYWRkZWQgPSB7fTtcbiAgICB2YXIgcmVtb3ZlZCA9IHt9O1xuICAgIHZhciBjaGFuZ2VkID0ge307XG5cbiAgICBmb3IgKHZhciBwcm9wIGluIG9sZE9iamVjdCkge1xuICAgICAgdmFyIG5ld1ZhbHVlID0gb2JqZWN0W3Byb3BdO1xuXG4gICAgICBpZiAobmV3VmFsdWUgIT09IHVuZGVmaW5lZCAmJiBuZXdWYWx1ZSA9PT0gb2xkT2JqZWN0W3Byb3BdKVxuICAgICAgICBjb250aW51ZTtcblxuICAgICAgaWYgKCEocHJvcCBpbiBvYmplY3QpKSB7XG4gICAgICAgIHJlbW92ZWRbcHJvcF0gPSB1bmRlZmluZWQ7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAobmV3VmFsdWUgIT09IG9sZE9iamVjdFtwcm9wXSlcbiAgICAgICAgY2hhbmdlZFtwcm9wXSA9IG5ld1ZhbHVlO1xuICAgIH1cblxuICAgIGZvciAodmFyIHByb3AgaW4gb2JqZWN0KSB7XG4gICAgICBpZiAocHJvcCBpbiBvbGRPYmplY3QpXG4gICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICBhZGRlZFtwcm9wXSA9IG9iamVjdFtwcm9wXTtcbiAgICB9XG5cbiAgICBpZiAoQXJyYXkuaXNBcnJheShvYmplY3QpICYmIG9iamVjdC5sZW5ndGggIT09IG9sZE9iamVjdC5sZW5ndGgpXG4gICAgICBjaGFuZ2VkLmxlbmd0aCA9IG9iamVjdC5sZW5ndGg7XG5cbiAgICByZXR1cm4ge1xuICAgICAgYWRkZWQ6IGFkZGVkLFxuICAgICAgcmVtb3ZlZDogcmVtb3ZlZCxcbiAgICAgIGNoYW5nZWQ6IGNoYW5nZWRcbiAgICB9O1xuICB9XG5cbiAgdmFyIGVvbVRhc2tzID0gW107XG4gIGZ1bmN0aW9uIHJ1bkVPTVRhc2tzKCkge1xuICAgIGlmICghZW9tVGFza3MubGVuZ3RoKVxuICAgICAgcmV0dXJuIGZhbHNlO1xuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBlb21UYXNrcy5sZW5ndGg7IGkrKykge1xuICAgICAgZW9tVGFza3NbaV0oKTtcbiAgICB9XG4gICAgZW9tVGFza3MubGVuZ3RoID0gMDtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIHZhciBydW5FT00gPSBoYXNPYnNlcnZlID8gKGZ1bmN0aW9uKCl7XG4gICAgdmFyIGVvbU9iaiA9IHsgcGluZ1Bvbmc6IHRydWUgfTtcbiAgICB2YXIgZW9tUnVuU2NoZWR1bGVkID0gZmFsc2U7XG5cbiAgICBPYmplY3Qub2JzZXJ2ZShlb21PYmosIGZ1bmN0aW9uKCkge1xuICAgICAgcnVuRU9NVGFza3MoKTtcbiAgICAgIGVvbVJ1blNjaGVkdWxlZCA9IGZhbHNlO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIGZ1bmN0aW9uKGZuKSB7XG4gICAgICBlb21UYXNrcy5wdXNoKGZuKTtcbiAgICAgIGlmICghZW9tUnVuU2NoZWR1bGVkKSB7XG4gICAgICAgIGVvbVJ1blNjaGVkdWxlZCA9IHRydWU7XG4gICAgICAgIGVvbU9iai5waW5nUG9uZyA9ICFlb21PYmoucGluZ1Bvbmc7XG4gICAgICB9XG4gICAgfTtcbiAgfSkoKSA6XG4gIChmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24oZm4pIHtcbiAgICAgIGVvbVRhc2tzLnB1c2goZm4pO1xuICAgIH07XG4gIH0pKCk7XG5cbiAgdmFyIG9ic2VydmVkT2JqZWN0Q2FjaGUgPSBbXTtcblxuICBmdW5jdGlvbiBuZXdPYnNlcnZlZE9iamVjdCgpIHtcbiAgICB2YXIgb2JzZXJ2ZXI7XG4gICAgdmFyIG9iamVjdDtcbiAgICB2YXIgZGlzY2FyZFJlY29yZHMgPSBmYWxzZTtcbiAgICB2YXIgZmlyc3QgPSB0cnVlO1xuXG4gICAgZnVuY3Rpb24gY2FsbGJhY2socmVjb3Jkcykge1xuICAgICAgaWYgKG9ic2VydmVyICYmIG9ic2VydmVyLnN0YXRlXyA9PT0gT1BFTkVEICYmICFkaXNjYXJkUmVjb3JkcylcbiAgICAgICAgb2JzZXJ2ZXIuY2hlY2tfKHJlY29yZHMpO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBvcGVuOiBmdW5jdGlvbihvYnMpIHtcbiAgICAgICAgaWYgKG9ic2VydmVyKVxuICAgICAgICAgIHRocm93IEVycm9yKCdPYnNlcnZlZE9iamVjdCBpbiB1c2UnKTtcblxuICAgICAgICBpZiAoIWZpcnN0KVxuICAgICAgICAgIE9iamVjdC5kZWxpdmVyQ2hhbmdlUmVjb3JkcyhjYWxsYmFjayk7XG5cbiAgICAgICAgb2JzZXJ2ZXIgPSBvYnM7XG4gICAgICAgIGZpcnN0ID0gZmFsc2U7XG4gICAgICB9LFxuICAgICAgb2JzZXJ2ZTogZnVuY3Rpb24ob2JqLCBhcnJheU9ic2VydmUpIHtcbiAgICAgICAgb2JqZWN0ID0gb2JqO1xuICAgICAgICBpZiAoYXJyYXlPYnNlcnZlKVxuICAgICAgICAgIEFycmF5Lm9ic2VydmUob2JqZWN0LCBjYWxsYmFjayk7XG4gICAgICAgIGVsc2VcbiAgICAgICAgICBPYmplY3Qub2JzZXJ2ZShvYmplY3QsIGNhbGxiYWNrKTtcbiAgICAgIH0sXG4gICAgICBkZWxpdmVyOiBmdW5jdGlvbihkaXNjYXJkKSB7XG4gICAgICAgIGRpc2NhcmRSZWNvcmRzID0gZGlzY2FyZDtcbiAgICAgICAgT2JqZWN0LmRlbGl2ZXJDaGFuZ2VSZWNvcmRzKGNhbGxiYWNrKTtcbiAgICAgICAgZGlzY2FyZFJlY29yZHMgPSBmYWxzZTtcbiAgICAgIH0sXG4gICAgICBjbG9zZTogZnVuY3Rpb24oKSB7XG4gICAgICAgIG9ic2VydmVyID0gdW5kZWZpbmVkO1xuICAgICAgICBPYmplY3QudW5vYnNlcnZlKG9iamVjdCwgY2FsbGJhY2spO1xuICAgICAgICBvYnNlcnZlZE9iamVjdENhY2hlLnB1c2godGhpcyk7XG4gICAgICB9XG4gICAgfTtcbiAgfVxuXG4gIC8qXG4gICAqIFRoZSBvYnNlcnZlZFNldCBhYnN0cmFjdGlvbiBpcyBhIHBlcmYgb3B0aW1pemF0aW9uIHdoaWNoIHJlZHVjZXMgdGhlIHRvdGFsXG4gICAqIG51bWJlciBvZiBPYmplY3Qub2JzZXJ2ZSBvYnNlcnZhdGlvbnMgb2YgYSBzZXQgb2Ygb2JqZWN0cy4gVGhlIGlkZWEgaXMgdGhhdFxuICAgKiBncm91cHMgb2YgT2JzZXJ2ZXJzIHdpbGwgaGF2ZSBzb21lIG9iamVjdCBkZXBlbmRlbmNpZXMgaW4gY29tbW9uIGFuZCB0aGlzXG4gICAqIG9ic2VydmVkIHNldCBlbnN1cmVzIHRoYXQgZWFjaCBvYmplY3QgaW4gdGhlIHRyYW5zaXRpdmUgY2xvc3VyZSBvZlxuICAgKiBkZXBlbmRlbmNpZXMgaXMgb25seSBvYnNlcnZlZCBvbmNlLiBUaGUgb2JzZXJ2ZWRTZXQgYWN0cyBhcyBhIHdyaXRlIGJhcnJpZXJcbiAgICogc3VjaCB0aGF0IHdoZW5ldmVyIGFueSBjaGFuZ2UgY29tZXMgdGhyb3VnaCwgYWxsIE9ic2VydmVycyBhcmUgY2hlY2tlZCBmb3JcbiAgICogY2hhbmdlZCB2YWx1ZXMuXG4gICAqXG4gICAqIE5vdGUgdGhhdCB0aGlzIG9wdGltaXphdGlvbiBpcyBleHBsaWNpdGx5IG1vdmluZyB3b3JrIGZyb20gc2V0dXAtdGltZSB0b1xuICAgKiBjaGFuZ2UtdGltZS5cbiAgICpcbiAgICogVE9ETyhyYWZhZWx3KTogSW1wbGVtZW50IFwiZ2FyYmFnZSBjb2xsZWN0aW9uXCIuIEluIG9yZGVyIHRvIG1vdmUgd29yayBvZmZcbiAgICogdGhlIGNyaXRpY2FsIHBhdGgsIHdoZW4gT2JzZXJ2ZXJzIGFyZSBjbG9zZWQsIHRoZWlyIG9ic2VydmVkIG9iamVjdHMgYXJlXG4gICAqIG5vdCBPYmplY3QudW5vYnNlcnZlKGQpLiBBcyBhIHJlc3VsdCwgaXQnc2llc3RhIHBvc3NpYmxlIHRoYXQgaWYgdGhlIG9ic2VydmVkU2V0XG4gICAqIGlzIGtlcHQgb3BlbiwgYnV0IHNvbWUgT2JzZXJ2ZXJzIGhhdmUgYmVlbiBjbG9zZWQsIGl0IGNvdWxkIGNhdXNlIFwibGVha3NcIlxuICAgKiAocHJldmVudCBvdGhlcndpc2UgY29sbGVjdGFibGUgb2JqZWN0cyBmcm9tIGJlaW5nIGNvbGxlY3RlZCkuIEF0IHNvbWVcbiAgICogcG9pbnQsIHdlIHNob3VsZCBpbXBsZW1lbnQgaW5jcmVtZW50YWwgXCJnY1wiIHdoaWNoIGtlZXBzIGEgbGlzdCBvZlxuICAgKiBvYnNlcnZlZFNldHMgd2hpY2ggbWF5IG5lZWQgY2xlYW4tdXAgYW5kIGRvZXMgc21hbGwgYW1vdW50cyBvZiBjbGVhbnVwIG9uIGFcbiAgICogdGltZW91dCB1bnRpbCBhbGwgaXMgY2xlYW4uXG4gICAqL1xuXG4gIGZ1bmN0aW9uIGdldE9ic2VydmVkT2JqZWN0KG9ic2VydmVyLCBvYmplY3QsIGFycmF5T2JzZXJ2ZSkge1xuICAgIHZhciBkaXIgPSBvYnNlcnZlZE9iamVjdENhY2hlLnBvcCgpIHx8IG5ld09ic2VydmVkT2JqZWN0KCk7XG4gICAgZGlyLm9wZW4ob2JzZXJ2ZXIpO1xuICAgIGRpci5vYnNlcnZlKG9iamVjdCwgYXJyYXlPYnNlcnZlKTtcbiAgICByZXR1cm4gZGlyO1xuICB9XG5cbiAgdmFyIG9ic2VydmVkU2V0Q2FjaGUgPSBbXTtcblxuICBmdW5jdGlvbiBuZXdPYnNlcnZlZFNldCgpIHtcbiAgICB2YXIgb2JzZXJ2ZXJDb3VudCA9IDA7XG4gICAgdmFyIG9ic2VydmVycyA9IFtdO1xuICAgIHZhciBvYmplY3RzID0gW107XG4gICAgdmFyIHJvb3RPYmo7XG4gICAgdmFyIHJvb3RPYmpQcm9wcztcblxuICAgIGZ1bmN0aW9uIG9ic2VydmUob2JqLCBwcm9wKSB7XG4gICAgICBpZiAoIW9iailcbiAgICAgICAgcmV0dXJuO1xuXG4gICAgICBpZiAob2JqID09PSByb290T2JqKVxuICAgICAgICByb290T2JqUHJvcHNbcHJvcF0gPSB0cnVlO1xuXG4gICAgICBpZiAob2JqZWN0cy5pbmRleE9mKG9iaikgPCAwKSB7XG4gICAgICAgIG9iamVjdHMucHVzaChvYmopO1xuICAgICAgICBPYmplY3Qub2JzZXJ2ZShvYmosIGNhbGxiYWNrKTtcbiAgICAgIH1cblxuICAgICAgb2JzZXJ2ZShPYmplY3QuZ2V0UHJvdG90eXBlT2Yob2JqKSwgcHJvcCk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gYWxsUm9vdE9iak5vbk9ic2VydmVkUHJvcHMocmVjcykge1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCByZWNzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciByZWMgPSByZWNzW2ldO1xuICAgICAgICBpZiAocmVjLm9iamVjdCAhPT0gcm9vdE9iaiB8fFxuICAgICAgICAgICAgcm9vdE9ialByb3BzW3JlYy5uYW1lXSB8fFxuICAgICAgICAgICAgcmVjLnR5cGUgPT09ICdzZXRQcm90b3R5cGUnKSB7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBjYWxsYmFjayhyZWNzKSB7XG4gICAgICBpZiAoYWxsUm9vdE9iak5vbk9ic2VydmVkUHJvcHMocmVjcykpXG4gICAgICAgIHJldHVybjtcblxuICAgICAgdmFyIG9ic2VydmVyO1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBvYnNlcnZlcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgb2JzZXJ2ZXIgPSBvYnNlcnZlcnNbaV07XG4gICAgICAgIGlmIChvYnNlcnZlci5zdGF0ZV8gPT0gT1BFTkVEKSB7XG4gICAgICAgICAgb2JzZXJ2ZXIuaXRlcmF0ZU9iamVjdHNfKG9ic2VydmUpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgb2JzZXJ2ZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIG9ic2VydmVyID0gb2JzZXJ2ZXJzW2ldO1xuICAgICAgICBpZiAob2JzZXJ2ZXIuc3RhdGVfID09IE9QRU5FRCkge1xuICAgICAgICAgIG9ic2VydmVyLmNoZWNrXygpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgdmFyIHJlY29yZCA9IHtcbiAgICAgIG9iamVjdDogdW5kZWZpbmVkLFxuICAgICAgb2JqZWN0czogb2JqZWN0cyxcbiAgICAgIG9wZW46IGZ1bmN0aW9uKG9icywgb2JqZWN0KSB7XG4gICAgICAgIGlmICghcm9vdE9iaikge1xuICAgICAgICAgIHJvb3RPYmogPSBvYmplY3Q7XG4gICAgICAgICAgcm9vdE9ialByb3BzID0ge307XG4gICAgICAgIH1cblxuICAgICAgICBvYnNlcnZlcnMucHVzaChvYnMpO1xuICAgICAgICBvYnNlcnZlckNvdW50Kys7XG4gICAgICAgIG9icy5pdGVyYXRlT2JqZWN0c18ob2JzZXJ2ZSk7XG4gICAgICB9LFxuICAgICAgY2xvc2U6IGZ1bmN0aW9uKG9icykge1xuICAgICAgICBvYnNlcnZlckNvdW50LS07XG4gICAgICAgIGlmIChvYnNlcnZlckNvdW50ID4gMCkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgb2JqZWN0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIE9iamVjdC51bm9ic2VydmUob2JqZWN0c1tpXSwgY2FsbGJhY2spO1xuICAgICAgICAgIE9ic2VydmVyLnVub2JzZXJ2ZWRDb3VudCsrO1xuICAgICAgICB9XG5cbiAgICAgICAgb2JzZXJ2ZXJzLmxlbmd0aCA9IDA7XG4gICAgICAgIG9iamVjdHMubGVuZ3RoID0gMDtcbiAgICAgICAgcm9vdE9iaiA9IHVuZGVmaW5lZDtcbiAgICAgICAgcm9vdE9ialByb3BzID0gdW5kZWZpbmVkO1xuICAgICAgICBvYnNlcnZlZFNldENhY2hlLnB1c2godGhpcyk7XG4gICAgICB9XG4gICAgfTtcblxuICAgIHJldHVybiByZWNvcmQ7XG4gIH1cblxuICB2YXIgbGFzdE9ic2VydmVkU2V0O1xuXG4gIHZhciBVTk9QRU5FRCA9IDA7XG4gIHZhciBPUEVORUQgPSAxO1xuICB2YXIgQ0xPU0VEID0gMjtcblxuICB2YXIgbmV4dE9ic2VydmVySWQgPSAxO1xuXG4gIGZ1bmN0aW9uIE9ic2VydmVyKCkge1xuICAgIHRoaXMuc3RhdGVfID0gVU5PUEVORUQ7XG4gICAgdGhpcy5jYWxsYmFja18gPSB1bmRlZmluZWQ7XG4gICAgdGhpcy50YXJnZXRfID0gdW5kZWZpbmVkOyAvLyBUT0RPKHJhZmFlbHcpOiBTaG91bGQgYmUgV2Vha1JlZlxuICAgIHRoaXMuZGlyZWN0T2JzZXJ2ZXJfID0gdW5kZWZpbmVkO1xuICAgIHRoaXMudmFsdWVfID0gdW5kZWZpbmVkO1xuICAgIHRoaXMuaWRfID0gbmV4dE9ic2VydmVySWQrKztcbiAgfVxuXG4gIE9ic2VydmVyLnByb3RvdHlwZSA9IHtcbiAgICBvcGVuOiBmdW5jdGlvbihjYWxsYmFjaywgdGFyZ2V0KSB7XG4gICAgICBpZiAodGhpcy5zdGF0ZV8gIT0gVU5PUEVORUQpXG4gICAgICAgIHRocm93IEVycm9yKCdPYnNlcnZlciBoYXMgYWxyZWFkeSBiZWVuIG9wZW5lZC4nKTtcblxuICAgICAgYWRkVG9BbGwodGhpcyk7XG4gICAgICB0aGlzLmNhbGxiYWNrXyA9IGNhbGxiYWNrO1xuICAgICAgdGhpcy50YXJnZXRfID0gdGFyZ2V0O1xuICAgICAgdGhpcy5jb25uZWN0XygpO1xuICAgICAgdGhpcy5zdGF0ZV8gPSBPUEVORUQ7XG4gICAgICByZXR1cm4gdGhpcy52YWx1ZV87XG4gICAgfSxcblxuICAgIGNsb3NlOiBmdW5jdGlvbigpIHtcbiAgICAgIGlmICh0aGlzLnN0YXRlXyAhPSBPUEVORUQpXG4gICAgICAgIHJldHVybjtcblxuICAgICAgcmVtb3ZlRnJvbUFsbCh0aGlzKTtcbiAgICAgIHRoaXMuZGlzY29ubmVjdF8oKTtcbiAgICAgIHRoaXMudmFsdWVfID0gdW5kZWZpbmVkO1xuICAgICAgdGhpcy5jYWxsYmFja18gPSB1bmRlZmluZWQ7XG4gICAgICB0aGlzLnRhcmdldF8gPSB1bmRlZmluZWQ7XG4gICAgICB0aGlzLnN0YXRlXyA9IENMT1NFRDtcbiAgICB9LFxuXG4gICAgZGVsaXZlcjogZnVuY3Rpb24oKSB7XG4gICAgICBpZiAodGhpcy5zdGF0ZV8gIT0gT1BFTkVEKVxuICAgICAgICByZXR1cm47XG5cbiAgICAgIGRpcnR5Q2hlY2sodGhpcyk7XG4gICAgfSxcblxuICAgIHJlcG9ydF86IGZ1bmN0aW9uKGNoYW5nZXMpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHRoaXMuY2FsbGJhY2tfLmFwcGx5KHRoaXMudGFyZ2V0XywgY2hhbmdlcyk7XG4gICAgICB9IGNhdGNoIChleCkge1xuICAgICAgICBPYnNlcnZlci5fZXJyb3JUaHJvd25EdXJpbmdDYWxsYmFjayA9IHRydWU7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ0V4Y2VwdGlvbiBjYXVnaHQgZHVyaW5nIG9ic2VydmVyIGNhbGxiYWNrOiAnICtcbiAgICAgICAgICAgICAgICAgICAgICAgKGV4LnN0YWNrIHx8IGV4KSk7XG4gICAgICB9XG4gICAgfSxcblxuICAgIGRpc2NhcmRDaGFuZ2VzOiBmdW5jdGlvbigpIHtcbiAgICAgIHRoaXMuY2hlY2tfKHVuZGVmaW5lZCwgdHJ1ZSk7XG4gICAgICByZXR1cm4gdGhpcy52YWx1ZV87XG4gICAgfVxuICB9XG5cbiAgdmFyIGNvbGxlY3RPYnNlcnZlcnMgPSAhaGFzT2JzZXJ2ZTtcbiAgdmFyIGFsbE9ic2VydmVycztcbiAgT2JzZXJ2ZXIuX2FsbE9ic2VydmVyc0NvdW50ID0gMDtcblxuICBpZiAoY29sbGVjdE9ic2VydmVycykge1xuICAgIGFsbE9ic2VydmVycyA9IFtdO1xuICB9XG5cbiAgZnVuY3Rpb24gYWRkVG9BbGwob2JzZXJ2ZXIpIHtcbiAgICBPYnNlcnZlci5fYWxsT2JzZXJ2ZXJzQ291bnQrKztcbiAgICBpZiAoIWNvbGxlY3RPYnNlcnZlcnMpXG4gICAgICByZXR1cm47XG5cbiAgICBhbGxPYnNlcnZlcnMucHVzaChvYnNlcnZlcik7XG4gIH1cblxuICBmdW5jdGlvbiByZW1vdmVGcm9tQWxsKG9ic2VydmVyKSB7XG4gICAgT2JzZXJ2ZXIuX2FsbE9ic2VydmVyc0NvdW50LS07XG4gIH1cblxuICB2YXIgcnVubmluZ01pY3JvdGFza0NoZWNrcG9pbnQgPSBmYWxzZTtcblxuICB2YXIgaGFzRGVidWdGb3JjZUZ1bGxEZWxpdmVyeSA9IGhhc09ic2VydmUgJiYgaGFzRXZhbCAmJiAoZnVuY3Rpb24oKSB7XG4gICAgdHJ5IHtcbiAgICAgIGV2YWwoJyVSdW5NaWNyb3Rhc2tzKCknKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0gY2F0Y2ggKGV4KSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9KSgpO1xuXG4gIGdsb2JhbC5QbGF0Zm9ybSA9IGdsb2JhbC5QbGF0Zm9ybSB8fCB7fTtcblxuICBnbG9iYWwuUGxhdGZvcm0ucGVyZm9ybU1pY3JvdGFza0NoZWNrcG9pbnQgPSBmdW5jdGlvbigpIHtcbiAgICBpZiAocnVubmluZ01pY3JvdGFza0NoZWNrcG9pbnQpXG4gICAgICByZXR1cm47XG5cbiAgICBpZiAoaGFzRGVidWdGb3JjZUZ1bGxEZWxpdmVyeSkge1xuICAgICAgZXZhbCgnJVJ1bk1pY3JvdGFza3MoKScpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmICghY29sbGVjdE9ic2VydmVycylcbiAgICAgIHJldHVybjtcblxuICAgIHJ1bm5pbmdNaWNyb3Rhc2tDaGVja3BvaW50ID0gdHJ1ZTtcblxuICAgIHZhciBjeWNsZXMgPSAwO1xuICAgIHZhciBhbnlDaGFuZ2VkLCB0b0NoZWNrO1xuXG4gICAgZG8ge1xuICAgICAgY3ljbGVzKys7XG4gICAgICB0b0NoZWNrID0gYWxsT2JzZXJ2ZXJzO1xuICAgICAgYWxsT2JzZXJ2ZXJzID0gW107XG4gICAgICBhbnlDaGFuZ2VkID0gZmFsc2U7XG5cbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdG9DaGVjay5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgb2JzZXJ2ZXIgPSB0b0NoZWNrW2ldO1xuICAgICAgICBpZiAob2JzZXJ2ZXIuc3RhdGVfICE9IE9QRU5FRClcbiAgICAgICAgICBjb250aW51ZTtcblxuICAgICAgICBpZiAob2JzZXJ2ZXIuY2hlY2tfKCkpXG4gICAgICAgICAgYW55Q2hhbmdlZCA9IHRydWU7XG5cbiAgICAgICAgYWxsT2JzZXJ2ZXJzLnB1c2gob2JzZXJ2ZXIpO1xuICAgICAgfVxuICAgICAgaWYgKHJ1bkVPTVRhc2tzKCkpXG4gICAgICAgIGFueUNoYW5nZWQgPSB0cnVlO1xuICAgIH0gd2hpbGUgKGN5Y2xlcyA8IE1BWF9ESVJUWV9DSEVDS19DWUNMRVMgJiYgYW55Q2hhbmdlZCk7XG5cbiAgICBpZiAodGVzdGluZ0V4cG9zZUN5Y2xlQ291bnQpXG4gICAgICBnbG9iYWwuZGlydHlDaGVja0N5Y2xlQ291bnQgPSBjeWNsZXM7XG5cbiAgICBydW5uaW5nTWljcm90YXNrQ2hlY2twb2ludCA9IGZhbHNlO1xuICB9O1xuXG4gIGlmIChjb2xsZWN0T2JzZXJ2ZXJzKSB7XG4gICAgZ2xvYmFsLlBsYXRmb3JtLmNsZWFyT2JzZXJ2ZXJzID0gZnVuY3Rpb24oKSB7XG4gICAgICBhbGxPYnNlcnZlcnMgPSBbXTtcbiAgICB9O1xuICB9XG5cbiAgZnVuY3Rpb24gT2JqZWN0T2JzZXJ2ZXIob2JqZWN0KSB7XG4gICAgT2JzZXJ2ZXIuY2FsbCh0aGlzKTtcbiAgICB0aGlzLnZhbHVlXyA9IG9iamVjdDtcbiAgICB0aGlzLm9sZE9iamVjdF8gPSB1bmRlZmluZWQ7XG4gIH1cblxuICBPYmplY3RPYnNlcnZlci5wcm90b3R5cGUgPSBjcmVhdGVPYmplY3Qoe1xuICAgIF9fcHJvdG9fXzogT2JzZXJ2ZXIucHJvdG90eXBlLFxuXG4gICAgYXJyYXlPYnNlcnZlOiBmYWxzZSxcblxuICAgIGNvbm5lY3RfOiBmdW5jdGlvbihjYWxsYmFjaywgdGFyZ2V0KSB7XG4gICAgICBpZiAoaGFzT2JzZXJ2ZSkge1xuICAgICAgICB0aGlzLmRpcmVjdE9ic2VydmVyXyA9IGdldE9ic2VydmVkT2JqZWN0KHRoaXMsIHRoaXMudmFsdWVfLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuYXJyYXlPYnNlcnZlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMub2xkT2JqZWN0XyA9IHRoaXMuY29weU9iamVjdCh0aGlzLnZhbHVlXyk7XG4gICAgICB9XG5cbiAgICB9LFxuXG4gICAgY29weU9iamVjdDogZnVuY3Rpb24ob2JqZWN0KSB7XG4gICAgICB2YXIgY29weSA9IEFycmF5LmlzQXJyYXkob2JqZWN0KSA/IFtdIDoge307XG4gICAgICBmb3IgKHZhciBwcm9wIGluIG9iamVjdCkge1xuICAgICAgICBjb3B5W3Byb3BdID0gb2JqZWN0W3Byb3BdO1xuICAgICAgfTtcbiAgICAgIGlmIChBcnJheS5pc0FycmF5KG9iamVjdCkpXG4gICAgICAgIGNvcHkubGVuZ3RoID0gb2JqZWN0Lmxlbmd0aDtcbiAgICAgIHJldHVybiBjb3B5O1xuICAgIH0sXG5cbiAgICBjaGVja186IGZ1bmN0aW9uKGNoYW5nZVJlY29yZHMsIHNraXBDaGFuZ2VzKSB7XG4gICAgICB2YXIgZGlmZjtcbiAgICAgIHZhciBvbGRWYWx1ZXM7XG4gICAgICBpZiAoaGFzT2JzZXJ2ZSkge1xuICAgICAgICBpZiAoIWNoYW5nZVJlY29yZHMpXG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuXG4gICAgICAgIG9sZFZhbHVlcyA9IHt9O1xuICAgICAgICBkaWZmID0gZGlmZk9iamVjdEZyb21DaGFuZ2VSZWNvcmRzKHRoaXMudmFsdWVfLCBjaGFuZ2VSZWNvcmRzLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9sZFZhbHVlcyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBvbGRWYWx1ZXMgPSB0aGlzLm9sZE9iamVjdF87XG4gICAgICAgIGRpZmYgPSBkaWZmT2JqZWN0RnJvbU9sZE9iamVjdCh0aGlzLnZhbHVlXywgdGhpcy5vbGRPYmplY3RfKTtcbiAgICAgIH1cblxuICAgICAgaWYgKGRpZmZJc0VtcHR5KGRpZmYpKVxuICAgICAgICByZXR1cm4gZmFsc2U7XG5cbiAgICAgIGlmICghaGFzT2JzZXJ2ZSlcbiAgICAgICAgdGhpcy5vbGRPYmplY3RfID0gdGhpcy5jb3B5T2JqZWN0KHRoaXMudmFsdWVfKTtcblxuICAgICAgdGhpcy5yZXBvcnRfKFtcbiAgICAgICAgZGlmZi5hZGRlZCB8fCB7fSxcbiAgICAgICAgZGlmZi5yZW1vdmVkIHx8IHt9LFxuICAgICAgICBkaWZmLmNoYW5nZWQgfHwge30sXG4gICAgICAgIGZ1bmN0aW9uKHByb3BlcnR5KSB7XG4gICAgICAgICAgcmV0dXJuIG9sZFZhbHVlc1twcm9wZXJ0eV07XG4gICAgICAgIH1cbiAgICAgIF0pO1xuXG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9LFxuXG4gICAgZGlzY29ubmVjdF86IGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKGhhc09ic2VydmUpIHtcbiAgICAgICAgdGhpcy5kaXJlY3RPYnNlcnZlcl8uY2xvc2UoKTtcbiAgICAgICAgdGhpcy5kaXJlY3RPYnNlcnZlcl8gPSB1bmRlZmluZWQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLm9sZE9iamVjdF8gPSB1bmRlZmluZWQ7XG4gICAgICB9XG4gICAgfSxcblxuICAgIGRlbGl2ZXI6IGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKHRoaXMuc3RhdGVfICE9IE9QRU5FRClcbiAgICAgICAgcmV0dXJuO1xuXG4gICAgICBpZiAoaGFzT2JzZXJ2ZSlcbiAgICAgICAgdGhpcy5kaXJlY3RPYnNlcnZlcl8uZGVsaXZlcihmYWxzZSk7XG4gICAgICBlbHNlXG4gICAgICAgIGRpcnR5Q2hlY2sodGhpcyk7XG4gICAgfSxcblxuICAgIGRpc2NhcmRDaGFuZ2VzOiBmdW5jdGlvbigpIHtcbiAgICAgIGlmICh0aGlzLmRpcmVjdE9ic2VydmVyXylcbiAgICAgICAgdGhpcy5kaXJlY3RPYnNlcnZlcl8uZGVsaXZlcih0cnVlKTtcbiAgICAgIGVsc2VcbiAgICAgICAgdGhpcy5vbGRPYmplY3RfID0gdGhpcy5jb3B5T2JqZWN0KHRoaXMudmFsdWVfKTtcblxuICAgICAgcmV0dXJuIHRoaXMudmFsdWVfO1xuICAgIH1cbiAgfSk7XG5cbiAgZnVuY3Rpb24gQXJyYXlPYnNlcnZlcihhcnJheSkge1xuICAgIGlmICghQXJyYXkuaXNBcnJheShhcnJheSkpXG4gICAgICB0aHJvdyBFcnJvcignUHJvdmlkZWQgb2JqZWN0IGlzIG5vdCBhbiBBcnJheScpO1xuICAgIE9iamVjdE9ic2VydmVyLmNhbGwodGhpcywgYXJyYXkpO1xuICB9XG5cbiAgQXJyYXlPYnNlcnZlci5wcm90b3R5cGUgPSBjcmVhdGVPYmplY3Qoe1xuXG4gICAgX19wcm90b19fOiBPYmplY3RPYnNlcnZlci5wcm90b3R5cGUsXG5cbiAgICBhcnJheU9ic2VydmU6IHRydWUsXG5cbiAgICBjb3B5T2JqZWN0OiBmdW5jdGlvbihhcnIpIHtcbiAgICAgIHJldHVybiBhcnIuc2xpY2UoKTtcbiAgICB9LFxuXG4gICAgY2hlY2tfOiBmdW5jdGlvbihjaGFuZ2VSZWNvcmRzKSB7XG4gICAgICB2YXIgc3BsaWNlcztcbiAgICAgIGlmIChoYXNPYnNlcnZlKSB7XG4gICAgICAgIGlmICghY2hhbmdlUmVjb3JkcylcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIHNwbGljZXMgPSBwcm9qZWN0QXJyYXlTcGxpY2VzKHRoaXMudmFsdWVfLCBjaGFuZ2VSZWNvcmRzKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHNwbGljZXMgPSBjYWxjU3BsaWNlcyh0aGlzLnZhbHVlXywgMCwgdGhpcy52YWx1ZV8ubGVuZ3RoLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5vbGRPYmplY3RfLCAwLCB0aGlzLm9sZE9iamVjdF8ubGVuZ3RoKTtcbiAgICAgIH1cblxuICAgICAgaWYgKCFzcGxpY2VzIHx8ICFzcGxpY2VzLmxlbmd0aClcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuXG4gICAgICBpZiAoIWhhc09ic2VydmUpXG4gICAgICAgIHRoaXMub2xkT2JqZWN0XyA9IHRoaXMuY29weU9iamVjdCh0aGlzLnZhbHVlXyk7XG5cbiAgICAgIHRoaXMucmVwb3J0Xyhbc3BsaWNlc10pO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICB9KTtcblxuICBBcnJheU9ic2VydmVyLmFwcGx5U3BsaWNlcyA9IGZ1bmN0aW9uKHByZXZpb3VzLCBjdXJyZW50LCBzcGxpY2VzKSB7XG4gICAgc3BsaWNlcy5mb3JFYWNoKGZ1bmN0aW9uKHNwbGljZSkge1xuICAgICAgdmFyIHNwbGljZUFyZ3MgPSBbc3BsaWNlLmluZGV4LCBzcGxpY2UucmVtb3ZlZC5sZW5ndGhdO1xuICAgICAgdmFyIGFkZEluZGV4ID0gc3BsaWNlLmluZGV4O1xuICAgICAgd2hpbGUgKGFkZEluZGV4IDwgc3BsaWNlLmluZGV4ICsgc3BsaWNlLmFkZGVkQ291bnQpIHtcbiAgICAgICAgc3BsaWNlQXJncy5wdXNoKGN1cnJlbnRbYWRkSW5kZXhdKTtcbiAgICAgICAgYWRkSW5kZXgrKztcbiAgICAgIH1cblxuICAgICAgQXJyYXkucHJvdG90eXBlLnNwbGljZS5hcHBseShwcmV2aW91cywgc3BsaWNlQXJncyk7XG4gICAgfSk7XG4gIH07XG5cbiAgdmFyIG9ic2VydmVyU2VudGluZWwgPSB7fTtcblxuICB2YXIgZXhwZWN0ZWRSZWNvcmRUeXBlcyA9IHtcbiAgICBhZGQ6IHRydWUsXG4gICAgdXBkYXRlOiB0cnVlLFxuICAgIGRlbGV0ZTogdHJ1ZVxuICB9O1xuXG4gIGZ1bmN0aW9uIGRpZmZPYmplY3RGcm9tQ2hhbmdlUmVjb3JkcyhvYmplY3QsIGNoYW5nZVJlY29yZHMsIG9sZFZhbHVlcykge1xuICAgIHZhciBhZGRlZCA9IHt9O1xuICAgIHZhciByZW1vdmVkID0ge307XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNoYW5nZVJlY29yZHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciByZWNvcmQgPSBjaGFuZ2VSZWNvcmRzW2ldO1xuICAgICAgaWYgKCFleHBlY3RlZFJlY29yZFR5cGVzW3JlY29yZC50eXBlXSkge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdVbmtub3duIGNoYW5nZVJlY29yZCB0eXBlOiAnICsgcmVjb3JkLnR5cGUpO1xuICAgICAgICBjb25zb2xlLmVycm9yKHJlY29yZCk7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAoIShyZWNvcmQubmFtZSBpbiBvbGRWYWx1ZXMpKVxuICAgICAgICBvbGRWYWx1ZXNbcmVjb3JkLm5hbWVdID0gcmVjb3JkLm9sZFZhbHVlO1xuXG4gICAgICBpZiAocmVjb3JkLnR5cGUgPT0gJ3VwZGF0ZScpXG4gICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICBpZiAocmVjb3JkLnR5cGUgPT0gJ2FkZCcpIHtcbiAgICAgICAgaWYgKHJlY29yZC5uYW1lIGluIHJlbW92ZWQpXG4gICAgICAgICAgZGVsZXRlIHJlbW92ZWRbcmVjb3JkLm5hbWVdO1xuICAgICAgICBlbHNlXG4gICAgICAgICAgYWRkZWRbcmVjb3JkLm5hbWVdID0gdHJ1ZTtcblxuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgLy8gdHlwZSA9ICdkZWxldGUnXG4gICAgICBpZiAocmVjb3JkLm5hbWUgaW4gYWRkZWQpIHtcbiAgICAgICAgZGVsZXRlIGFkZGVkW3JlY29yZC5uYW1lXTtcbiAgICAgICAgZGVsZXRlIG9sZFZhbHVlc1tyZWNvcmQubmFtZV07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZW1vdmVkW3JlY29yZC5uYW1lXSA9IHRydWU7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZm9yICh2YXIgcHJvcCBpbiBhZGRlZClcbiAgICAgIGFkZGVkW3Byb3BdID0gb2JqZWN0W3Byb3BdO1xuXG4gICAgZm9yICh2YXIgcHJvcCBpbiByZW1vdmVkKVxuICAgICAgcmVtb3ZlZFtwcm9wXSA9IHVuZGVmaW5lZDtcblxuICAgIHZhciBjaGFuZ2VkID0ge307XG4gICAgZm9yICh2YXIgcHJvcCBpbiBvbGRWYWx1ZXMpIHtcbiAgICAgIGlmIChwcm9wIGluIGFkZGVkIHx8IHByb3AgaW4gcmVtb3ZlZClcbiAgICAgICAgY29udGludWU7XG5cbiAgICAgIHZhciBuZXdWYWx1ZSA9IG9iamVjdFtwcm9wXTtcbiAgICAgIGlmIChvbGRWYWx1ZXNbcHJvcF0gIT09IG5ld1ZhbHVlKVxuICAgICAgICBjaGFuZ2VkW3Byb3BdID0gbmV3VmFsdWU7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIGFkZGVkOiBhZGRlZCxcbiAgICAgIHJlbW92ZWQ6IHJlbW92ZWQsXG4gICAgICBjaGFuZ2VkOiBjaGFuZ2VkXG4gICAgfTtcbiAgfVxuXG4gIGZ1bmN0aW9uIG5ld1NwbGljZShpbmRleCwgcmVtb3ZlZCwgYWRkZWRDb3VudCkge1xuICAgIHJldHVybiB7XG4gICAgICBpbmRleDogaW5kZXgsXG4gICAgICByZW1vdmVkOiByZW1vdmVkLFxuICAgICAgYWRkZWRDb3VudDogYWRkZWRDb3VudFxuICAgIH07XG4gIH1cblxuICB2YXIgRURJVF9MRUFWRSA9IDA7XG4gIHZhciBFRElUX1VQREFURSA9IDE7XG4gIHZhciBFRElUX0FERCA9IDI7XG4gIHZhciBFRElUX0RFTEVURSA9IDM7XG5cbiAgZnVuY3Rpb24gQXJyYXlTcGxpY2UoKSB7fVxuXG4gIEFycmF5U3BsaWNlLnByb3RvdHlwZSA9IHtcblxuICAgIC8vIE5vdGU6IFRoaXMgZnVuY3Rpb24gaXMgKmJhc2VkKiBvbiB0aGUgY29tcHV0YXRpb24gb2YgdGhlIExldmVuc2h0ZWluXG4gICAgLy8gXCJlZGl0XCIgZGlzdGFuY2UuIFRoZSBvbmUgY2hhbmdlIGlzIHRoYXQgXCJ1cGRhdGVzXCIgYXJlIHRyZWF0ZWQgYXMgdHdvXG4gICAgLy8gZWRpdHMgLSBub3Qgb25lLiBXaXRoIEFycmF5IHNwbGljZXMsIGFuIHVwZGF0ZSBpcyByZWFsbHkgYSBkZWxldGVcbiAgICAvLyBmb2xsb3dlZCBieSBhbiBhZGQuIEJ5IHJldGFpbmluZyB0aGlzLCB3ZSBvcHRpbWl6ZSBmb3IgXCJrZWVwaW5nXCIgdGhlXG4gICAgLy8gbWF4aW11bSBhcnJheSBpdGVtcyBpbiB0aGUgb3JpZ2luYWwgYXJyYXkuIEZvciBleGFtcGxlOlxuICAgIC8vXG4gICAgLy8gICAneHh4eDEyMycgLT4gJzEyM3l5eXknXG4gICAgLy9cbiAgICAvLyBXaXRoIDEtZWRpdCB1cGRhdGVzLCB0aGUgc2hvcnRlc3QgcGF0aCB3b3VsZCBiZSBqdXN0IHRvIHVwZGF0ZSBhbGwgc2V2ZW5cbiAgICAvLyBjaGFyYWN0ZXJzLiBXaXRoIDItZWRpdCB1cGRhdGVzLCB3ZSBkZWxldGUgNCwgbGVhdmUgMywgYW5kIGFkZCA0LiBUaGlzXG4gICAgLy8gbGVhdmVzIHRoZSBzdWJzdHJpbmcgJzEyMycgaW50YWN0LlxuICAgIGNhbGNFZGl0RGlzdGFuY2VzOiBmdW5jdGlvbihjdXJyZW50LCBjdXJyZW50U3RhcnQsIGN1cnJlbnRFbmQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9sZCwgb2xkU3RhcnQsIG9sZEVuZCkge1xuICAgICAgLy8gXCJEZWxldGlvblwiIGNvbHVtbnNcbiAgICAgIHZhciByb3dDb3VudCA9IG9sZEVuZCAtIG9sZFN0YXJ0ICsgMTtcbiAgICAgIHZhciBjb2x1bW5Db3VudCA9IGN1cnJlbnRFbmQgLSBjdXJyZW50U3RhcnQgKyAxO1xuICAgICAgdmFyIGRpc3RhbmNlcyA9IG5ldyBBcnJheShyb3dDb3VudCk7XG5cbiAgICAgIC8vIFwiQWRkaXRpb25cIiByb3dzLiBJbml0aWFsaXplIG51bGwgY29sdW1uLlxuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCByb3dDb3VudDsgaSsrKSB7XG4gICAgICAgIGRpc3RhbmNlc1tpXSA9IG5ldyBBcnJheShjb2x1bW5Db3VudCk7XG4gICAgICAgIGRpc3RhbmNlc1tpXVswXSA9IGk7XG4gICAgICB9XG5cbiAgICAgIC8vIEluaXRpYWxpemUgbnVsbCByb3dcbiAgICAgIGZvciAodmFyIGogPSAwOyBqIDwgY29sdW1uQ291bnQ7IGorKylcbiAgICAgICAgZGlzdGFuY2VzWzBdW2pdID0gajtcblxuICAgICAgZm9yICh2YXIgaSA9IDE7IGkgPCByb3dDb3VudDsgaSsrKSB7XG4gICAgICAgIGZvciAodmFyIGogPSAxOyBqIDwgY29sdW1uQ291bnQ7IGorKykge1xuICAgICAgICAgIGlmICh0aGlzLmVxdWFscyhjdXJyZW50W2N1cnJlbnRTdGFydCArIGogLSAxXSwgb2xkW29sZFN0YXJ0ICsgaSAtIDFdKSlcbiAgICAgICAgICAgIGRpc3RhbmNlc1tpXVtqXSA9IGRpc3RhbmNlc1tpIC0gMV1baiAtIDFdO1xuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdmFyIG5vcnRoID0gZGlzdGFuY2VzW2kgLSAxXVtqXSArIDE7XG4gICAgICAgICAgICB2YXIgd2VzdCA9IGRpc3RhbmNlc1tpXVtqIC0gMV0gKyAxO1xuICAgICAgICAgICAgZGlzdGFuY2VzW2ldW2pdID0gbm9ydGggPCB3ZXN0ID8gbm9ydGggOiB3ZXN0O1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gZGlzdGFuY2VzO1xuICAgIH0sXG5cbiAgICAvLyBUaGlzIHN0YXJ0cyBhdCB0aGUgZmluYWwgd2VpZ2h0LCBhbmQgd2Fsa3MgXCJiYWNrd2FyZFwiIGJ5IGZpbmRpbmdcbiAgICAvLyB0aGUgbWluaW11bSBwcmV2aW91cyB3ZWlnaHQgcmVjdXJzaXZlbHkgdW50aWwgdGhlIG9yaWdpbiBvZiB0aGUgd2VpZ2h0XG4gICAgLy8gbWF0cml4LlxuICAgIHNwbGljZU9wZXJhdGlvbnNGcm9tRWRpdERpc3RhbmNlczogZnVuY3Rpb24oZGlzdGFuY2VzKSB7XG4gICAgICB2YXIgaSA9IGRpc3RhbmNlcy5sZW5ndGggLSAxO1xuICAgICAgdmFyIGogPSBkaXN0YW5jZXNbMF0ubGVuZ3RoIC0gMTtcbiAgICAgIHZhciBjdXJyZW50ID0gZGlzdGFuY2VzW2ldW2pdO1xuICAgICAgdmFyIGVkaXRzID0gW107XG4gICAgICB3aGlsZSAoaSA+IDAgfHwgaiA+IDApIHtcbiAgICAgICAgaWYgKGkgPT0gMCkge1xuICAgICAgICAgIGVkaXRzLnB1c2goRURJVF9BREQpO1xuICAgICAgICAgIGotLTtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoaiA9PSAwKSB7XG4gICAgICAgICAgZWRpdHMucHVzaChFRElUX0RFTEVURSk7XG4gICAgICAgICAgaS0tO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIHZhciBub3J0aFdlc3QgPSBkaXN0YW5jZXNbaSAtIDFdW2ogLSAxXTtcbiAgICAgICAgdmFyIHdlc3QgPSBkaXN0YW5jZXNbaSAtIDFdW2pdO1xuICAgICAgICB2YXIgbm9ydGggPSBkaXN0YW5jZXNbaV1baiAtIDFdO1xuXG4gICAgICAgIHZhciBtaW47XG4gICAgICAgIGlmICh3ZXN0IDwgbm9ydGgpXG4gICAgICAgICAgbWluID0gd2VzdCA8IG5vcnRoV2VzdCA/IHdlc3QgOiBub3J0aFdlc3Q7XG4gICAgICAgIGVsc2VcbiAgICAgICAgICBtaW4gPSBub3J0aCA8IG5vcnRoV2VzdCA/IG5vcnRoIDogbm9ydGhXZXN0O1xuXG4gICAgICAgIGlmIChtaW4gPT0gbm9ydGhXZXN0KSB7XG4gICAgICAgICAgaWYgKG5vcnRoV2VzdCA9PSBjdXJyZW50KSB7XG4gICAgICAgICAgICBlZGl0cy5wdXNoKEVESVRfTEVBVkUpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBlZGl0cy5wdXNoKEVESVRfVVBEQVRFKTtcbiAgICAgICAgICAgIGN1cnJlbnQgPSBub3J0aFdlc3Q7XG4gICAgICAgICAgfVxuICAgICAgICAgIGktLTtcbiAgICAgICAgICBqLS07XG4gICAgICAgIH0gZWxzZSBpZiAobWluID09IHdlc3QpIHtcbiAgICAgICAgICBlZGl0cy5wdXNoKEVESVRfREVMRVRFKTtcbiAgICAgICAgICBpLS07XG4gICAgICAgICAgY3VycmVudCA9IHdlc3Q7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZWRpdHMucHVzaChFRElUX0FERCk7XG4gICAgICAgICAgai0tO1xuICAgICAgICAgIGN1cnJlbnQgPSBub3J0aDtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBlZGl0cy5yZXZlcnNlKCk7XG4gICAgICByZXR1cm4gZWRpdHM7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFNwbGljZSBQcm9qZWN0aW9uIGZ1bmN0aW9uczpcbiAgICAgKlxuICAgICAqIEEgc3BsaWNlIG1hcCBpcyBhIHJlcHJlc2VudGF0aW9uIG9mIGhvdyBhIHByZXZpb3VzIGFycmF5IG9mIGl0ZW1zXG4gICAgICogd2FzIHRyYW5zZm9ybWVkIGludG8gYSBuZXcgYXJyYXkgb2YgaXRlbXMuIENvbmNlcHR1YWxseSBpdCBpcyBhIGxpc3Qgb2ZcbiAgICAgKiB0dXBsZXMgb2ZcbiAgICAgKlxuICAgICAqICAgPGluZGV4LCByZW1vdmVkLCBhZGRlZENvdW50PlxuICAgICAqXG4gICAgICogd2hpY2ggYXJlIGtlcHQgaW4gYXNjZW5kaW5nIGluZGV4IG9yZGVyIG9mLiBUaGUgdHVwbGUgcmVwcmVzZW50cyB0aGF0IGF0XG4gICAgICogdGhlIHxpbmRleHwsIHxyZW1vdmVkfCBzZXF1ZW5jZSBvZiBpdGVtcyB3ZXJlIHJlbW92ZWQsIGFuZCBjb3VudGluZyBmb3J3YXJkXG4gICAgICogZnJvbSB8aW5kZXh8LCB8YWRkZWRDb3VudHwgaXRlbXMgd2VyZSBhZGRlZC5cbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIExhY2tpbmcgaW5kaXZpZHVhbCBzcGxpY2UgbXV0YXRpb24gaW5mb3JtYXRpb24sIHRoZSBtaW5pbWFsIHNldCBvZlxuICAgICAqIHNwbGljZXMgY2FuIGJlIHN5bnRoZXNpemVkIGdpdmVuIHRoZSBwcmV2aW91cyBzdGF0ZSBhbmQgZmluYWwgc3RhdGUgb2YgYW5cbiAgICAgKiBhcnJheS4gVGhlIGJhc2ljIGFwcHJvYWNoIGlzIHRvIGNhbGN1bGF0ZSB0aGUgZWRpdCBkaXN0YW5jZSBtYXRyaXggYW5kXG4gICAgICogY2hvb3NlIHRoZSBzaG9ydGVzdCBwYXRoIHRocm91Z2ggaXQuXG4gICAgICpcbiAgICAgKiBDb21wbGV4aXR5OiBPKGwgKiBwKVxuICAgICAqICAgbDogVGhlIGxlbmd0aCBvZiB0aGUgY3VycmVudCBhcnJheVxuICAgICAqICAgcDogVGhlIGxlbmd0aCBvZiB0aGUgb2xkIGFycmF5XG4gICAgICovXG4gICAgY2FsY1NwbGljZXM6IGZ1bmN0aW9uKGN1cnJlbnQsIGN1cnJlbnRTdGFydCwgY3VycmVudEVuZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgb2xkLCBvbGRTdGFydCwgb2xkRW5kKSB7XG4gICAgICB2YXIgcHJlZml4Q291bnQgPSAwO1xuICAgICAgdmFyIHN1ZmZpeENvdW50ID0gMDtcblxuICAgICAgdmFyIG1pbkxlbmd0aCA9IE1hdGgubWluKGN1cnJlbnRFbmQgLSBjdXJyZW50U3RhcnQsIG9sZEVuZCAtIG9sZFN0YXJ0KTtcbiAgICAgIGlmIChjdXJyZW50U3RhcnQgPT0gMCAmJiBvbGRTdGFydCA9PSAwKVxuICAgICAgICBwcmVmaXhDb3VudCA9IHRoaXMuc2hhcmVkUHJlZml4KGN1cnJlbnQsIG9sZCwgbWluTGVuZ3RoKTtcblxuICAgICAgaWYgKGN1cnJlbnRFbmQgPT0gY3VycmVudC5sZW5ndGggJiYgb2xkRW5kID09IG9sZC5sZW5ndGgpXG4gICAgICAgIHN1ZmZpeENvdW50ID0gdGhpcy5zaGFyZWRTdWZmaXgoY3VycmVudCwgb2xkLCBtaW5MZW5ndGggLSBwcmVmaXhDb3VudCk7XG5cbiAgICAgIGN1cnJlbnRTdGFydCArPSBwcmVmaXhDb3VudDtcbiAgICAgIG9sZFN0YXJ0ICs9IHByZWZpeENvdW50O1xuICAgICAgY3VycmVudEVuZCAtPSBzdWZmaXhDb3VudDtcbiAgICAgIG9sZEVuZCAtPSBzdWZmaXhDb3VudDtcblxuICAgICAgaWYgKGN1cnJlbnRFbmQgLSBjdXJyZW50U3RhcnQgPT0gMCAmJiBvbGRFbmQgLSBvbGRTdGFydCA9PSAwKVxuICAgICAgICByZXR1cm4gW107XG5cbiAgICAgIGlmIChjdXJyZW50U3RhcnQgPT0gY3VycmVudEVuZCkge1xuICAgICAgICB2YXIgc3BsaWNlID0gbmV3U3BsaWNlKGN1cnJlbnRTdGFydCwgW10sIDApO1xuICAgICAgICB3aGlsZSAob2xkU3RhcnQgPCBvbGRFbmQpXG4gICAgICAgICAgc3BsaWNlLnJlbW92ZWQucHVzaChvbGRbb2xkU3RhcnQrK10pO1xuXG4gICAgICAgIHJldHVybiBbIHNwbGljZSBdO1xuICAgICAgfSBlbHNlIGlmIChvbGRTdGFydCA9PSBvbGRFbmQpXG4gICAgICAgIHJldHVybiBbIG5ld1NwbGljZShjdXJyZW50U3RhcnQsIFtdLCBjdXJyZW50RW5kIC0gY3VycmVudFN0YXJ0KSBdO1xuXG4gICAgICB2YXIgb3BzID0gdGhpcy5zcGxpY2VPcGVyYXRpb25zRnJvbUVkaXREaXN0YW5jZXMoXG4gICAgICAgICAgdGhpcy5jYWxjRWRpdERpc3RhbmNlcyhjdXJyZW50LCBjdXJyZW50U3RhcnQsIGN1cnJlbnRFbmQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbGQsIG9sZFN0YXJ0LCBvbGRFbmQpKTtcblxuICAgICAgdmFyIHNwbGljZSA9IHVuZGVmaW5lZDtcbiAgICAgIHZhciBzcGxpY2VzID0gW107XG4gICAgICB2YXIgaW5kZXggPSBjdXJyZW50U3RhcnQ7XG4gICAgICB2YXIgb2xkSW5kZXggPSBvbGRTdGFydDtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgb3BzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHN3aXRjaChvcHNbaV0pIHtcbiAgICAgICAgICBjYXNlIEVESVRfTEVBVkU6XG4gICAgICAgICAgICBpZiAoc3BsaWNlKSB7XG4gICAgICAgICAgICAgIHNwbGljZXMucHVzaChzcGxpY2UpO1xuICAgICAgICAgICAgICBzcGxpY2UgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGluZGV4Kys7XG4gICAgICAgICAgICBvbGRJbmRleCsrO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSBFRElUX1VQREFURTpcbiAgICAgICAgICAgIGlmICghc3BsaWNlKVxuICAgICAgICAgICAgICBzcGxpY2UgPSBuZXdTcGxpY2UoaW5kZXgsIFtdLCAwKTtcblxuICAgICAgICAgICAgc3BsaWNlLmFkZGVkQ291bnQrKztcbiAgICAgICAgICAgIGluZGV4Kys7XG5cbiAgICAgICAgICAgIHNwbGljZS5yZW1vdmVkLnB1c2gob2xkW29sZEluZGV4XSk7XG4gICAgICAgICAgICBvbGRJbmRleCsrO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSBFRElUX0FERDpcbiAgICAgICAgICAgIGlmICghc3BsaWNlKVxuICAgICAgICAgICAgICBzcGxpY2UgPSBuZXdTcGxpY2UoaW5kZXgsIFtdLCAwKTtcblxuICAgICAgICAgICAgc3BsaWNlLmFkZGVkQ291bnQrKztcbiAgICAgICAgICAgIGluZGV4Kys7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlIEVESVRfREVMRVRFOlxuICAgICAgICAgICAgaWYgKCFzcGxpY2UpXG4gICAgICAgICAgICAgIHNwbGljZSA9IG5ld1NwbGljZShpbmRleCwgW10sIDApO1xuXG4gICAgICAgICAgICBzcGxpY2UucmVtb3ZlZC5wdXNoKG9sZFtvbGRJbmRleF0pO1xuICAgICAgICAgICAgb2xkSW5kZXgrKztcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChzcGxpY2UpIHtcbiAgICAgICAgc3BsaWNlcy5wdXNoKHNwbGljZSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gc3BsaWNlcztcbiAgICB9LFxuXG4gICAgc2hhcmVkUHJlZml4OiBmdW5jdGlvbihjdXJyZW50LCBvbGQsIHNlYXJjaExlbmd0aCkge1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzZWFyY2hMZW5ndGg7IGkrKylcbiAgICAgICAgaWYgKCF0aGlzLmVxdWFscyhjdXJyZW50W2ldLCBvbGRbaV0pKVxuICAgICAgICAgIHJldHVybiBpO1xuICAgICAgcmV0dXJuIHNlYXJjaExlbmd0aDtcbiAgICB9LFxuXG4gICAgc2hhcmVkU3VmZml4OiBmdW5jdGlvbihjdXJyZW50LCBvbGQsIHNlYXJjaExlbmd0aCkge1xuICAgICAgdmFyIGluZGV4MSA9IGN1cnJlbnQubGVuZ3RoO1xuICAgICAgdmFyIGluZGV4MiA9IG9sZC5sZW5ndGg7XG4gICAgICB2YXIgY291bnQgPSAwO1xuICAgICAgd2hpbGUgKGNvdW50IDwgc2VhcmNoTGVuZ3RoICYmIHRoaXMuZXF1YWxzKGN1cnJlbnRbLS1pbmRleDFdLCBvbGRbLS1pbmRleDJdKSlcbiAgICAgICAgY291bnQrKztcblxuICAgICAgcmV0dXJuIGNvdW50O1xuICAgIH0sXG5cbiAgICBjYWxjdWxhdGVTcGxpY2VzOiBmdW5jdGlvbihjdXJyZW50LCBwcmV2aW91cykge1xuICAgICAgcmV0dXJuIHRoaXMuY2FsY1NwbGljZXMoY3VycmVudCwgMCwgY3VycmVudC5sZW5ndGgsIHByZXZpb3VzLCAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJldmlvdXMubGVuZ3RoKTtcbiAgICB9LFxuXG4gICAgZXF1YWxzOiBmdW5jdGlvbihjdXJyZW50VmFsdWUsIHByZXZpb3VzVmFsdWUpIHtcbiAgICAgIHJldHVybiBjdXJyZW50VmFsdWUgPT09IHByZXZpb3VzVmFsdWU7XG4gICAgfVxuICB9O1xuXG4gIHZhciBhcnJheVNwbGljZSA9IG5ldyBBcnJheVNwbGljZSgpO1xuXG4gIGZ1bmN0aW9uIGNhbGNTcGxpY2VzKGN1cnJlbnQsIGN1cnJlbnRTdGFydCwgY3VycmVudEVuZCxcbiAgICAgICAgICAgICAgICAgICAgICAgb2xkLCBvbGRTdGFydCwgb2xkRW5kKSB7XG4gICAgcmV0dXJuIGFycmF5U3BsaWNlLmNhbGNTcGxpY2VzKGN1cnJlbnQsIGN1cnJlbnRTdGFydCwgY3VycmVudEVuZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb2xkLCBvbGRTdGFydCwgb2xkRW5kKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGludGVyc2VjdChzdGFydDEsIGVuZDEsIHN0YXJ0MiwgZW5kMikge1xuICAgIC8vIERpc2pvaW50XG4gICAgaWYgKGVuZDEgPCBzdGFydDIgfHwgZW5kMiA8IHN0YXJ0MSlcbiAgICAgIHJldHVybiAtMTtcblxuICAgIC8vIEFkamFjZW50XG4gICAgaWYgKGVuZDEgPT0gc3RhcnQyIHx8IGVuZDIgPT0gc3RhcnQxKVxuICAgICAgcmV0dXJuIDA7XG5cbiAgICAvLyBOb24temVybyBpbnRlcnNlY3QsIHNwYW4xIGZpcnN0XG4gICAgaWYgKHN0YXJ0MSA8IHN0YXJ0Mikge1xuICAgICAgaWYgKGVuZDEgPCBlbmQyKVxuICAgICAgICByZXR1cm4gZW5kMSAtIHN0YXJ0MjsgLy8gT3ZlcmxhcFxuICAgICAgZWxzZVxuICAgICAgICByZXR1cm4gZW5kMiAtIHN0YXJ0MjsgLy8gQ29udGFpbmVkXG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIE5vbi16ZXJvIGludGVyc2VjdCwgc3BhbjIgZmlyc3RcbiAgICAgIGlmIChlbmQyIDwgZW5kMSlcbiAgICAgICAgcmV0dXJuIGVuZDIgLSBzdGFydDE7IC8vIE92ZXJsYXBcbiAgICAgIGVsc2VcbiAgICAgICAgcmV0dXJuIGVuZDEgLSBzdGFydDE7IC8vIENvbnRhaW5lZFxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIG1lcmdlU3BsaWNlKHNwbGljZXMsIGluZGV4LCByZW1vdmVkLCBhZGRlZENvdW50KSB7XG5cbiAgICB2YXIgc3BsaWNlID0gbmV3U3BsaWNlKGluZGV4LCByZW1vdmVkLCBhZGRlZENvdW50KTtcblxuICAgIHZhciBpbnNlcnRlZCA9IGZhbHNlO1xuICAgIHZhciBpbnNlcnRpb25PZmZzZXQgPSAwO1xuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzcGxpY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgY3VycmVudCA9IHNwbGljZXNbaV07XG4gICAgICBjdXJyZW50LmluZGV4ICs9IGluc2VydGlvbk9mZnNldDtcblxuICAgICAgaWYgKGluc2VydGVkKVxuICAgICAgICBjb250aW51ZTtcblxuICAgICAgdmFyIGludGVyc2VjdENvdW50ID0gaW50ZXJzZWN0KHNwbGljZS5pbmRleCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzcGxpY2UuaW5kZXggKyBzcGxpY2UucmVtb3ZlZC5sZW5ndGgsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY3VycmVudC5pbmRleCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjdXJyZW50LmluZGV4ICsgY3VycmVudC5hZGRlZENvdW50KTtcblxuICAgICAgaWYgKGludGVyc2VjdENvdW50ID49IDApIHtcbiAgICAgICAgLy8gTWVyZ2UgdGhlIHR3byBzcGxpY2VzXG5cbiAgICAgICAgc3BsaWNlcy5zcGxpY2UoaSwgMSk7XG4gICAgICAgIGktLTtcblxuICAgICAgICBpbnNlcnRpb25PZmZzZXQgLT0gY3VycmVudC5hZGRlZENvdW50IC0gY3VycmVudC5yZW1vdmVkLmxlbmd0aDtcblxuICAgICAgICBzcGxpY2UuYWRkZWRDb3VudCArPSBjdXJyZW50LmFkZGVkQ291bnQgLSBpbnRlcnNlY3RDb3VudDtcbiAgICAgICAgdmFyIGRlbGV0ZUNvdW50ID0gc3BsaWNlLnJlbW92ZWQubGVuZ3RoICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgY3VycmVudC5yZW1vdmVkLmxlbmd0aCAtIGludGVyc2VjdENvdW50O1xuXG4gICAgICAgIGlmICghc3BsaWNlLmFkZGVkQ291bnQgJiYgIWRlbGV0ZUNvdW50KSB7XG4gICAgICAgICAgLy8gbWVyZ2VkIHNwbGljZSBpcyBhIG5vb3AuIGRpc2NhcmQuXG4gICAgICAgICAgaW5zZXJ0ZWQgPSB0cnVlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHZhciByZW1vdmVkID0gY3VycmVudC5yZW1vdmVkO1xuXG4gICAgICAgICAgaWYgKHNwbGljZS5pbmRleCA8IGN1cnJlbnQuaW5kZXgpIHtcbiAgICAgICAgICAgIC8vIHNvbWUgcHJlZml4IG9mIHNwbGljZS5yZW1vdmVkIGlzIHByZXBlbmRlZCB0byBjdXJyZW50LnJlbW92ZWQuXG4gICAgICAgICAgICB2YXIgcHJlcGVuZCA9IHNwbGljZS5yZW1vdmVkLnNsaWNlKDAsIGN1cnJlbnQuaW5kZXggLSBzcGxpY2UuaW5kZXgpO1xuICAgICAgICAgICAgQXJyYXkucHJvdG90eXBlLnB1c2guYXBwbHkocHJlcGVuZCwgcmVtb3ZlZCk7XG4gICAgICAgICAgICByZW1vdmVkID0gcHJlcGVuZDtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoc3BsaWNlLmluZGV4ICsgc3BsaWNlLnJlbW92ZWQubGVuZ3RoID4gY3VycmVudC5pbmRleCArIGN1cnJlbnQuYWRkZWRDb3VudCkge1xuICAgICAgICAgICAgLy8gc29tZSBzdWZmaXggb2Ygc3BsaWNlLnJlbW92ZWQgaXMgYXBwZW5kZWQgdG8gY3VycmVudC5yZW1vdmVkLlxuICAgICAgICAgICAgdmFyIGFwcGVuZCA9IHNwbGljZS5yZW1vdmVkLnNsaWNlKGN1cnJlbnQuaW5kZXggKyBjdXJyZW50LmFkZGVkQ291bnQgLSBzcGxpY2UuaW5kZXgpO1xuICAgICAgICAgICAgQXJyYXkucHJvdG90eXBlLnB1c2guYXBwbHkocmVtb3ZlZCwgYXBwZW5kKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBzcGxpY2UucmVtb3ZlZCA9IHJlbW92ZWQ7XG4gICAgICAgICAgaWYgKGN1cnJlbnQuaW5kZXggPCBzcGxpY2UuaW5kZXgpIHtcbiAgICAgICAgICAgIHNwbGljZS5pbmRleCA9IGN1cnJlbnQuaW5kZXg7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKHNwbGljZS5pbmRleCA8IGN1cnJlbnQuaW5kZXgpIHtcbiAgICAgICAgLy8gSW5zZXJ0IHNwbGljZSBoZXJlLlxuXG4gICAgICAgIGluc2VydGVkID0gdHJ1ZTtcblxuICAgICAgICBzcGxpY2VzLnNwbGljZShpLCAwLCBzcGxpY2UpO1xuICAgICAgICBpKys7XG5cbiAgICAgICAgdmFyIG9mZnNldCA9IHNwbGljZS5hZGRlZENvdW50IC0gc3BsaWNlLnJlbW92ZWQubGVuZ3RoXG4gICAgICAgIGN1cnJlbnQuaW5kZXggKz0gb2Zmc2V0O1xuICAgICAgICBpbnNlcnRpb25PZmZzZXQgKz0gb2Zmc2V0O1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmICghaW5zZXJ0ZWQpXG4gICAgICBzcGxpY2VzLnB1c2goc3BsaWNlKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGNyZWF0ZUluaXRpYWxTcGxpY2VzKGFycmF5LCBjaGFuZ2VSZWNvcmRzKSB7XG4gICAgdmFyIHNwbGljZXMgPSBbXTtcblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY2hhbmdlUmVjb3Jkcy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIHJlY29yZCA9IGNoYW5nZVJlY29yZHNbaV07XG4gICAgICBzd2l0Y2gocmVjb3JkLnR5cGUpIHtcbiAgICAgICAgY2FzZSAnc3BsaWNlJzpcbiAgICAgICAgICBtZXJnZVNwbGljZShzcGxpY2VzLCByZWNvcmQuaW5kZXgsIHJlY29yZC5yZW1vdmVkLnNsaWNlKCksIHJlY29yZC5hZGRlZENvdW50KTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnYWRkJzpcbiAgICAgICAgY2FzZSAndXBkYXRlJzpcbiAgICAgICAgY2FzZSAnZGVsZXRlJzpcbiAgICAgICAgICBpZiAoIWlzSW5kZXgocmVjb3JkLm5hbWUpKVxuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgdmFyIGluZGV4ID0gdG9OdW1iZXIocmVjb3JkLm5hbWUpO1xuICAgICAgICAgIGlmIChpbmRleCA8IDApXG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICBtZXJnZVNwbGljZShzcGxpY2VzLCBpbmRleCwgW3JlY29yZC5vbGRWYWx1ZV0sIDEpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1VuZXhwZWN0ZWQgcmVjb3JkIHR5cGU6ICcgKyBKU09OLnN0cmluZ2lmeShyZWNvcmQpKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gc3BsaWNlcztcbiAgfVxuXG4gIGZ1bmN0aW9uIHByb2plY3RBcnJheVNwbGljZXMoYXJyYXksIGNoYW5nZVJlY29yZHMpIHtcbiAgICB2YXIgc3BsaWNlcyA9IFtdO1xuXG4gICAgY3JlYXRlSW5pdGlhbFNwbGljZXMoYXJyYXksIGNoYW5nZVJlY29yZHMpLmZvckVhY2goZnVuY3Rpb24oc3BsaWNlKSB7XG4gICAgICBpZiAoc3BsaWNlLmFkZGVkQ291bnQgPT0gMSAmJiBzcGxpY2UucmVtb3ZlZC5sZW5ndGggPT0gMSkge1xuICAgICAgICBpZiAoc3BsaWNlLnJlbW92ZWRbMF0gIT09IGFycmF5W3NwbGljZS5pbmRleF0pXG4gICAgICAgICAgc3BsaWNlcy5wdXNoKHNwbGljZSk7XG5cbiAgICAgICAgcmV0dXJuXG4gICAgICB9O1xuXG4gICAgICBzcGxpY2VzID0gc3BsaWNlcy5jb25jYXQoY2FsY1NwbGljZXMoYXJyYXksIHNwbGljZS5pbmRleCwgc3BsaWNlLmluZGV4ICsgc3BsaWNlLmFkZGVkQ291bnQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3BsaWNlLnJlbW92ZWQsIDAsIHNwbGljZS5yZW1vdmVkLmxlbmd0aCkpO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIHNwbGljZXM7XG4gIH1cblxuIC8vIEV4cG9ydCB0aGUgb2JzZXJ2ZS1qcyBvYmplY3QgZm9yICoqTm9kZS5qcyoqLCB3aXRoXG4vLyBiYWNrd2FyZHMtY29tcGF0aWJpbGl0eSBmb3IgdGhlIG9sZCBgcmVxdWlyZSgpYCBBUEkuIElmIHdlJ3JlIGluXG4vLyB0aGUgYnJvd3NlciwgZXhwb3J0IGFzIGEgZ2xvYmFsIG9iamVjdC5cbnZhciBleHBvc2UgPSBnbG9iYWw7XG5pZiAodHlwZW9mIGV4cG9ydHMgIT09ICd1bmRlZmluZWQnKSB7XG5pZiAodHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcgJiYgbW9kdWxlLmV4cG9ydHMpIHtcbmV4cG9zZSA9IGV4cG9ydHMgPSBtb2R1bGUuZXhwb3J0cztcbn1cbmV4cG9zZSA9IGV4cG9ydHM7XG59XG5leHBvc2UuT2JzZXJ2ZXIgPSBPYnNlcnZlcjtcbmV4cG9zZS5PYnNlcnZlci5ydW5FT01fID0gcnVuRU9NO1xuZXhwb3NlLk9ic2VydmVyLm9ic2VydmVyU2VudGluZWxfID0gb2JzZXJ2ZXJTZW50aW5lbDsgLy8gZm9yIHRlc3RpbmcuXG5leHBvc2UuT2JzZXJ2ZXIuaGFzT2JqZWN0T2JzZXJ2ZSA9IGhhc09ic2VydmU7XG5leHBvc2UuQXJyYXlPYnNlcnZlciA9IEFycmF5T2JzZXJ2ZXI7XG5leHBvc2UuQXJyYXlPYnNlcnZlci5jYWxjdWxhdGVTcGxpY2VzID0gZnVuY3Rpb24oY3VycmVudCwgcHJldmlvdXMpIHtcbnJldHVybiBhcnJheVNwbGljZS5jYWxjdWxhdGVTcGxpY2VzKGN1cnJlbnQsIHByZXZpb3VzKTtcbn07XG5leHBvc2UuUGxhdGZvcm0gPSBnbG9iYWwuUGxhdGZvcm07XG5leHBvc2UuQXJyYXlTcGxpY2UgPSBBcnJheVNwbGljZTtcbmV4cG9zZS5PYmplY3RPYnNlcnZlciA9IE9iamVjdE9ic2VydmVyO1xufSkodHlwZW9mIGdsb2JhbCAhPT0gJ3VuZGVmaW5lZCcgJiYgZ2xvYmFsICYmIHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnICYmIG1vZHVsZSA/IGdsb2JhbCA6IHRoaXMgfHwgd2luZG93KTtcblxufSkuY2FsbCh0aGlzLHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWwgOiB0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30pIl19
