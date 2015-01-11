(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/**
 * Solves the common problem of maintaining the order of a set of a models and querying on that order.
 *
 * The same as ReactiveQuery but enables manual reordering of models and maintains an index field.
 */

var ReactiveQuery = require('./reactiveQuery'),
    log = require('./log'),
    util = require('./util'),
    error = require('./error'),
    InternalSiestaError = error.InternalSiestaError,
    constructQuerySet = require('./querySet'),
    constructError = error.errorFactory(error.Components.ArrangedReactiveQuery),
    _ = util._;


var Logger = log.loggerWithName('Query');

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
        var deferred = util.defer(cb);
        ReactiveQuery.prototype.init.call(this, function (err) {
            if (!err) {
                if (!this.model.hasAttributeNamed(this.indexAttribute)) {
                    err = constructError('Model "' + this.model.name + '" does not have an attribute named "' + this.indexAttribute + '"')
                }
                else {
                    this._mergeIndexes();
                    this._query.clearOrdering();
                } 
            }
            deferred.finish(err, err ? null : this.results);
        }.bind(this));
        return deferred.promise;
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
            this.splice(newIndex, 0, this.splice(oldIndex, 1)[0]);
        }).call(results, from, to);
        this.results = results.asModelQuerySet(this.model);
        this._refreshIndexes();
    }
});

module.exports = ArrangedReactiveQuery;
},{"./error":11,"./log":14,"./querySet":21,"./reactiveQuery":22,"./util":25}],2:[function(require,module,exports){
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

    Object.defineProperties(this, {
        _relationshipNames: {
            get: function () {
                var proxies = _.map(Object.keys(self.__proxies || {}), function (x) {return self.__proxies[x]});
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
        }
    });

    this.removed = false;
}


_.extend(ModelInstance.prototype, {
    get: function (callback) {
        var deferred = util.defer(callback);
        callback = deferred.finish.bind(deferred);
        callback(null, this);
        return deferred.promise;
    },
    remove: function (callback, notification) {
        notification = notification == null ? true : notification;
        var deferred = util.defer(callback);
        callback = deferred.finish.bind(deferred);
        cache.remove(this);
        this.removed = true;
        if (notification) {
            modelEvents.emit({
                collection: this.collectionName,
                model: this.model.name,
                _id: this._id,
                old: this,
                type: modelEvents.ModelEventType.Remove,
                obj: this
            });
        }
        var remove = this.model.remove;
        if (remove) {
            var paramNames = util.paramNames(remove);
            if (paramNames.length) {
                var self = this;
                remove.call(this, function (err) {
                    callback(err, self);
                });
            }
            else {
                remove.call(this);
                callback(null, this);
            }
        }
        else {
            callback(null, this);
        }
        return deferred.promise;
    },
    restore: function (callback) {
        var deferred = util.defer(callback);
        callback = deferred.finish.bind(deferred);
        var _finish = function (err) {
            if (!err) {
                modelEvents.emit({
                    collection: this.collectionName,
                    model: this.model.name,
                    _id: this._id,
                    new: this,
                    type: modelEvents.ModelEventType.New,
                    obj: this
                });
            }
            callback(err, this);
        }.bind(this);
        if (this.removed) {
            cache.insert(this);
            this.removed = false;
            var init = this.model.init;
            if (init) {
                var paramNames = util.paramNames(init);
                if (paramNames.length) {
                    init.call(this, _finish);
                }
                else {
                    init.call(this);
                    _finish();
                }
            }
            else {
                _finish();
            }
        }
        return deferred.promise;
    }
});

_.extend(ModelInstance.prototype, {
    listen: function (fn) {
        events.on(this._id, fn);
        return function () {
            this.removeListener(fn);
        }.bind(this);
    },
    listenOnce: function (fn) {
        return events.once(this._id, fn);
    },
    removeListener: function (fn) {
        return events.removeListener(this._id, fn);
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


},{"./cache":8,"./error":11,"./events":12,"./log":14,"./modelEvents":18,"./util":25}],3:[function(require,module,exports){
/**
 * @module relationships
 */

var RelationshipProxy = require('./RelationshipProxy'),
    Store = require('./store'),
    util = require('./util'),
    _ = util._,
    InternalSiestaError = require('./error').InternalSiestaError,
    modelEvents = require('./modelEvents'),
    SiestaModel = require('./modelInstance'),
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
    get: function (callback) {
        var deferred = util.defer(callback);
        callback = deferred.finish.bind(deferred);
        callback(null, this.related);
        return deferred.promise;
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
},{"../vendor/observe-js/src/observe":31,"./RelationshipProxy":6,"./error":11,"./events":12,"./modelEvents":18,"./modelInstance":19,"./store":23,"./util":25}],4:[function(require,module,exports){
/**
 * @module relationships
 */

var RelationshipProxy = require('./RelationshipProxy'),
    Store = require('./store'),
    util = require('./util'),
    InternalSiestaError = require('./error').InternalSiestaError,
    ModelEventType = require('./modelEvents').ModelEventType,
    SiestaModel = require('./modelInstance');

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
        console.log('related', this.object, this.related);
        console.log('set', this.object, obj);
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
    get: function (callback) {
        var deferred = util.defer(callback);
        callback = deferred.finish.bind(deferred);
        callback(null, this.related);
        return deferred.promise;
    }
});


module.exports = OneToOneProxy;
},{"./RelationshipProxy":6,"./error":11,"./modelEvents":18,"./modelInstance":19,"./store":23,"./util":25}],5:[function(require,module,exports){
/**
 * @module query
 */

var log = require('./log'),
    cache = require('./cache'),
    util = require('./util'),
    error = require('./error'),
    constructQuerySet = require('./querySet'),
    constructError = error.errorFactory(error.Components.Query),
    _ = util._;

var Logger = log.loggerWithName('Query');

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

_.extend(Query, {
    comparators: {
        e: function (opts) {
            var objectValue = opts.object[opts.field];
            if (Logger.trace) {
                var stringValue;
                if (objectValue === null) stringValue = 'null';
                else if (objectValue === undefined) stringValue = 'undefined';
                else stringValue = objectValue.toString();
                Logger.trace(opts.field + ': ' + stringValue + ' == ' + opts.value.toString());
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
        }
    },
    registerComparator: function (symbol, fn) {
        if (!this.comparators[symbol])
            this.comparators[symbol] = fn;
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
    execute: function (callback) {
        var deferred = util.defer(callback);
        callback = deferred.finish.bind(deferred);
        this._executeInMemory(callback);
        return deferred.promise;
    },
    _dump: function (asJson) {
        return asJson ? '{}' : {};
    },
    sortFunc: function (fields) {
        var sortFunc = function (ascending, field) {
            return function (v1, v2) {
                if (ascending) {
                    return v1[field] - v2[field];
                }
                else {
                    return v2[field] - v1[field];
                }
            }
        };
        var s = util;
        for (var i = 0; i < fields.length; i++) {
            var field = fields[i];
            s = s.thenBy(sortFunc(field.ascending, field.field));
        }
        return s;
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
            var s = this.sortFunc(fields);
            if (res.immutable) res = res.mutableCopy();
            res.sort(s);
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
                    err = constructError(matches);
                    break;
                } else {
                    if (matches) res.push(obj);
                }
            }
            res = this._sortResults(res);
            callback(err, err ? null : constructQuerySet(res, this.model));
        }.bind(this);
        if (this.opts.ignoreInstalled) _executeInMemory();
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
        var val = obj[field];
        var invalid = val === null || val === undefined;
        var comparator = Query.comparators[op],
            opts = {object: obj, field: field, value: value, invalid: invalid};
        if (!comparator) {
            return 'No comparator registered for query operation "' + op + '"';
        }
        return comparator(opts);
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
},{"./cache":8,"./error":11,"./log":14,"./querySet":21,"./util":25}],6:[function(require,module,exports){
/**
 * Base functionality for relationships.
 * @module relationships
 */

var InternalSiestaError = require('./error').InternalSiestaError,
    Store = require('./store'),
    util = require('./util'),
    _ = util._,
    Query = require('./query'),
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
        console.log('clearRemovalListener', obj);
        var _id = obj._id;
        var cancelListen = this.cancelListens[_id];
        // TODO: Remove this check. cancelListen should always exist
        if (cancelListen) {
            cancelListen();
            this.cancelListens[_id] = null;
        }
    },
    listenForRemoval: function (obj) {
        console.log('listenForRemoval', obj);
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


},{"../vendor/observe-js/src/observe":31,"./cache":8,"./error":11,"./events":12,"./log":14,"./modelEvents":18,"./query":20,"./store":23,"./util":25}],7:[function(require,module,exports){
/**
 * @module relationship
 */

module.exports = {
    OneToMany: 'OneToMany',
    OneToOne: 'OneToOne',
    ManyToMany: 'ManyToMany'
};
},{}],8:[function(require,module,exports){
/**
 * This is an in-memory cache for models. Models are cached by local id (_id) and remote id (defined by the mapping).
 * Lookups are performed against the cache when mapping.
 * @module cache
 */
var log = require('./log'),
    InternalSiestaError = require('./error').InternalSiestaError,
    util = require('./util');


var Logger = log.loggerWithName('Cache');

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
        if (Logger.debug.isEnabled)
            Logger.debug('Local cache hit: ' + obj._dump(true));
    } else {
        if (Logger.debug.isEnabled)
            Logger.debug('Local cache miss: ' + localId);
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
                if (Logger.debug)
                    Logger.debug('Remote cache hit: ' + obj._dump(true));
            } else {
                if (Logger.debug)
                    Logger.debug('Remote cache miss: ' + remoteId);
            }
            return obj;
        }
    }
    if (Logger.debug)
        Logger.debug('Remote cache miss: ' + remoteId);
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
                    if (Logger.debug.isEnabled)
                        Logger.debug('Remote cache insert: ' + obj._dump(true));
                    if (Logger.trace.isEnabled)
                        Logger.trace('Remote cache now looks like: ' + remoteDump(true))
                } else {
                    // Something has gone really wrong. Only one object for a particular collection/type/remoteid combo
                    // should ever exist.
                    if (obj != cachedObject) {
                        var message = 'Object ' + collectionName.toString() + ':' + type.toString() + '[' + obj.model.id + '="' + remoteId + '"] already exists in the cache.' +
                            ' This is a serious error, please file a bug report if you are experiencing this out in the wild';
                        Logger.error(message, {
                            obj: obj,
                            cachedObject: cachedObject
                        });
                        throw new InternalSiestaError(message);
                    } else {
                        if (Logger.debug.isEnabled)
                            Logger.debug('Object has already been inserted: ' + obj._dump(true));
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
        Logger.error(msg);
        throw new InternalSiestaError(msg);
    }
}

/**
 * Dump the remote id cache
 * @param  {boolean} asJson Whether or not to apply JSON.stringify
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
    return asJson ? util.prettyPrint((dumpedRestCache, null, 4)) : dumpedRestCache;
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
    return asJson ? util.prettyPrint((dumpedIdCache, null, 4)) : dumpedIdCache;
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
    return asJson ? util.prettyPrint((dumped, null, 4)) : dumped;
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
    if (Logger.debug.isEnabled) Logger.debug('get', opts);
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
                if (Logger.debug.isEnabled) Logger.debug(idField + '=' + remoteId);
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
        Logger.warn('Invalid opts to cache', {
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
        if (Logger.debug.isEnabled)
            Logger.debug('Local cache insert: ' + obj._dumpString());
        if (!localCacheById[localId]) {
            localCacheById[localId] = obj;
            if (Logger.trace.isEnabled)
                Logger.trace('Local cache now looks like: ' + localDump(true));
            if (!localCache[collectionName]) localCache[collectionName] = {};
            if (!localCache[collectionName][modelName]) localCache[collectionName][modelName] = {};
            localCache[collectionName][modelName][localId] = obj;
        } else {
            // Something has gone badly wrong here. Two objects should never exist with the same _id
            if (localCacheById[localId] != obj) {
                var message = 'Object with _id="' + localId.toString() + '" is already in the cache. ' +
                    'This is a serious error. Please file a bug report if you are experiencing this out in the wild';
                Logger.error(message);
                throw new InternalSiestaError(message);
            }
        }
    }
    var idField = obj.idField;
    var remoteId = obj[idField];
    if (remoteId) {
        remoteInsert(obj, remoteId);
    } else {
        if (Logger.debug.isEnabled)
            Logger.debug('No remote id ("' + idField + '") so wont be placing in the remote cache', obj);
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
},{"./error":11,"./log":14,"./util":25}],9:[function(require,module,exports){
/**
 * @module collection
 */

var log = require('./log'),
    CollectionRegistry = require('./collectionRegistry').CollectionRegistry,
    InternalSiestaError = require('./error').InternalSiestaError,
    Model = require('./model'),
    extend = require('extend'),
    observe = require('../vendor/observe-js/src/observe').Platform,
    events = require('./events'),
    util = require('./util'),
    _ = util._,
    error = require('./error'),
    constructError = error.errorFactory(error.Components.Collection),
    cache = require('./cache');

var UNSAFE_METHODS = ['PUT', 'PATCH', 'POST', 'DELETE'],
    Logger = log.loggerWithName('Collection');

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

    util.extendFromOpts(this, opts || {}, {
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
}

_.extend(Collection.prototype, {
    /**
     * Ensure mappings are installed.
     * @param [callback]
     * @class Collection
     */
    install: function (callback) {
        var deferred = util.defer(callback);
        var self = this;
        if (!this.installed) {
            var modelsToInstall = [];
            for (var name in this._models) {
                if (this._models.hasOwnProperty(name)) {
                    var model = this._models[name];
                    modelsToInstall.push(model);
                }
            }
            if (Logger.info.isEnabled)
                Logger.info('There are ' + modelsToInstall.length.toString() + ' mappings to install');
            if (modelsToInstall.length) {
                var tasks = _.map(modelsToInstall, function (m) {
                    return _.bind(m.install, m);
                });
                util.async.parallel(tasks, function (err) {
                    if (err) {
                        Logger.error('Failed to install collection', err);
                        self._finaliseInstallation(err, deferred.finish.bind(deferred));
                    }
                    else {
                        self.installed = true;
                        var errors = [];
                        _.each(modelsToInstall, function (m) {
                            if (Logger.info.isEnabled)
                                Logger.info('Installing relationships for mapping with name "' + m.name + '"');
                            var err = m.installRelationships();
                            if (err) errors.push(err);
                        });
                        if (!errors.length) {
                            _.each(modelsToInstall, function (m) {
                                if (Logger.info.isEnabled)
                                    Logger.info('Installing reverse relationships for mapping with name "' + m.name + '"');
                                var err = m.installReverseRelationships();
                                if (err) errors.push(err);
                            });
                        }
                        if (errors.length == 1) {
                            err = errors[0];
                        } else if (errors.length) {
                            err = errors;
                        }
                        self._finaliseInstallation(err, deferred.finish.bind(deferred));
                    }
                });

            } else {
                self._finaliseInstallation(null, deferred.finish.bind(deferred));
            }
        } else {
            var err = new InternalSiestaError('Collection "' + this.name + '" has already been installed');
            self._finaliseInstallation(err, deferred.finish.bind(deferred));
        }
        return deferred.promise;
    },

    /**
     * Mark this collection as installed, and place the collection on the global Siesta object.
     * @param  {Object}   err
     * @param  {Function} callback
     * @class Collection
     */
    _finaliseInstallation: function (err, callback) {
        if (err) err = constructError('Errors were encountered whilst setting up the collection', {errors: err});
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
    model: function () {
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
                        return this._model(arguments[0].name, arguments[0]);
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

    descriptor: function (opts) {
        var descriptors = [];
        if (siesta.ext.httpEnabled) {
            opts.collection = this;
            var methods = siesta.ext.http._resolveMethod(opts.method);
            var unsafe = [];
            var safe = [];
            for (var i = 0; i < methods.length; i++) {
                var m = methods[i];
                if (UNSAFE_METHODS.indexOf(m) > -1) {
                    unsafe.push(m);
                } else {
                    safe.push(m);
                }
            }
            if (unsafe.length) {
                var requestDescriptor = extend({}, opts);
                requestDescriptor.method = unsafe;
                requestDescriptor = new siesta.ext.http.RequestDescriptor(requestDescriptor);
                siesta.ext.http.DescriptorRegistry.registerRequestDescriptor(requestDescriptor);
                descriptors.push(requestDescriptor);
            }
            if (safe.length) {
                var responseDescriptor = extend({}, opts);
                responseDescriptor.method = safe;
                responseDescriptor = new siesta.ext.http.ResponseDescriptor(responseDescriptor);
                siesta.ext.http.DescriptorRegistry.registerResponseDescriptor(responseDescriptor);
                descriptors.push(responseDescriptor);
            }
        } else {
            throw new Error('HTTP module not installed.');
        }
        return descriptors;
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
     * @param callback
     * @returns {Promise}
     */
    count: function (callback) {
        var deferred = util.defer(callback);
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
            deferred.finish(err, n);
        });
        return deferred.promise;
    }
});

_.extend(Collection.prototype, {
    listen: function (fn) {
        events.on(this.name, fn);
        return function () {
            this.removeListener(fn);
        }.bind(this);
    },
    listenOnce: function (fn) {
        return events.once(this.name, fn);
    },
    removeListener: function (fn) {
        return events.removeListener(this.name, fn);
    }
});

module.exports = Collection;
},{"../vendor/observe-js/src/observe":31,"./cache":8,"./collectionRegistry":10,"./error":11,"./events":12,"./index":13,"./log":14,"./model":17,"./util":25,"extend":30}],10:[function(require,module,exports){
/**
 * @module collection
 */
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
},{"./util":25}],11:[function(require,module,exports){
/**
 * @module error
 */


/**
 * Represents internal errors. These are thrown when something has gone very wrong internally. If you see one of these
 * out in the wild you probably need to file a bug report as it means some assertion has failed.
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


/**
 * Fields on error objects dished out by Siesta.
 * @type {Object}
 */
var ErrorField = {
        Message: 'message',
        Code: 'code'
    },
    /**
     * Enumerated errors.
     * @type {Object}
     */
    ErrorCode = {
        Unknown: 0,
        // If no descriptor matches a HTTP response/request then this error is
        NoDescriptorMatched: 1
    },

    Components = {
        Mapping: 'Mapping',
        HTTP: 'HTTP',
        ReactiveQuery: 'ReactiveQuery',
        ArrangedReactiveQuery: 'ArrangedReactiveQuery',
        Collection: 'Collection',
        Query: 'Query'
    };


/**
 * @param component
 * @param message
 * @param extra
 * @constructor
 */
function SiestaUserError(component, message, extra) {
    extra = extra || {};
    this.component = component;
    this.message = message;
    for (var prop in extra) {
        if (extra.hasOwnProperty(prop)) {
            this[prop] = extra[prop];
        }
    }
    this.isUserError = true;
}

/**
 * Map error codes onto descriptive messages.
 * @type {Object}
 */
var Message = {};
Message[ErrorCode.NoDescriptorMatched] = 'No descriptor matched the HTTP response/request.';

module.exports = {
    InternalSiestaError: InternalSiestaError,
    SiestaUserError: SiestaUserError,
    ErrorCode: ErrorCode,
    ErrorField: ErrorField,
    Message: Message,
    Components: Components,
    errorFactory: function (component) {
        if (component in Components) {
            return function (message, extra) {
                return new InternalSiestaError(component, message, extra);
            }
        }

        else {
            throw new InternalSiestaError('No such component "' + component + '"');
        }
    }
};
},{}],12:[function(require,module,exports){
var EventEmitter = require('events').EventEmitter,
    ArrayObserver = require('../vendor/observe-js/src/observe').ArrayObserver,
    _ = require('./util')._,
    modelEvents = require('./modelEvents');

var eventEmitter = new EventEmitter();
eventEmitter.wrapArray = function (array, field, modelInstance) {
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
};
module.exports = eventEmitter;
},{"../vendor/observe-js/src/observe":31,"./modelEvents":18,"./util":25,"events":29}],13:[function(require,module,exports){
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
},{"./Query":5,"./RelationshipType":7,"./cache":8,"./collection":9,"./collectionRegistry":10,"./error":11,"./events":12,"./log":14,"./model":17,"./modelEvents":18,"./modelInstance":19,"./query":20,"./reactiveQuery":22,"./store":23,"./util":25,"extend":30}],14:[function(require,module,exports){
/**
 * Dead simple logging service.
 * @module log
 */

var _ = require('./util')._;

var logLevels = {};


function Logger(name) {
    if (!this) return new Logger(name);
    this.name = name;
    logLevels[name] = Logger.Level.warn;
    this.trace = constructPerformer(this, _.bind(console.debug ? console.debug : console.log, console), Logger.Level.trace);
    this.debug = constructPerformer(this, _.bind(console.debug ? console.debug : console.log, console), Logger.Level.debug);
    this.info = constructPerformer(this, _.bind(console.info ? console.info : console.log, console), Logger.Level.info);
    this.log = constructPerformer(this, _.bind(console.log ? console.log : console.log, console), Logger.Level.info);
    this.warn = constructPerformer(this, _.bind(console.warn ? console.warn : console.log, console), Logger.Level.warning);
    this.error = constructPerformer(this, _.bind(console.error ? console.error : console.log, console), Logger.Level.error);
    this.fatal = constructPerformer(this, _.bind(console.error ? console.error : console.log, console), Logger.Level.fatal);

}

Logger.Level = {
    trace: 0,
    debug: 1,
    info: 2,
    warning: 3,
    warn: 3,
    error: 4,
    fatal: 5
};

function constructPerformer(logger, f, level) {
    var performer = function (message) {
        logger.performLog(f, level, message, arguments);
    };
    Object.defineProperty(performer, 'isEnabled', {
        get: function () {
            var currentLevel = logger.currentLevel();
            return level >= currentLevel;
        },
        enumerable: true,
        configurable: true
    });
    performer.f = f;
    performer.logger = logger;
    performer.level = level;
    return performer;
}


Logger.LevelText = {};
Logger.LevelText [Logger.Level.trace] = 'TRACE';
Logger.LevelText [Logger.Level.debug] = 'DEBUG';
Logger.LevelText [Logger.Level.info] = 'INFO ';
Logger.LevelText [Logger.Level.warning] = 'WARN ';
Logger.LevelText [Logger.Level.error] = 'ERROR';

Logger.levelAsText = function (level) {
    return this.LevelText[level];
};

Logger.loggerWithName = function (name) {
    return new Logger(name);
};

Logger.prototype.currentLevel = function () {
    var logLevel = logLevels[this.name];
    return logLevel ? logLevel : Logger.Level.trace;
};

Logger.prototype.setLevel = function (level) {
    logLevels[this.name] = level;
};

Logger.prototype.override = function (level, override, message) {
    var levelAsText = Logger.levelAsText(level);
    var performer = this[levelAsText.trim().toLowerCase()];
    var f = performer.f;
    var otherArguments = Array.prototype.slice.call(arguments, 3, arguments.length);
    this.performLog(f, level, message, otherArguments, override);
};

Logger.prototype.performLog = function (logFunc, level, message, otherArguments, override) {
    var self = this;
    var currentLevel = override !== undefined ? override : this.currentLevel();
    if (currentLevel <= level) {
        logFunc = _.partial(logFunc, Logger.levelAsText(level) + ' [' + self.name + ']: ' + message);
        var args = [];
        for (var i = 0; i < otherArguments.length; i++) {
            args[i] = otherArguments[i];
        }
        args.splice(0, 1);
        logFunc.apply(logFunc, args);
    }
};

module.exports = Logger;

},{"./util":25}],15:[function(require,module,exports){
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
    SiestaModel = require('./modelInstance'),
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
    get: function (callback) {
        var deferred = util.defer(callback);
        callback = deferred.finish.bind(deferred);
        callback(null, this.related);
        return deferred.promise;
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
},{"../vendor/observe-js/src/observe":31,"./RelationshipProxy":6,"./error":11,"./events":12,"./modelEvents":18,"./modelInstance":19,"./store":23,"./util":25}],16:[function(require,module,exports){
/**
 * @module mapping
 */

var Store = require('./store'),
    SiestaModel = require('./modelInstance'),
    log = require('./log'),
    InternalSiestaError = require('./error').InternalSiestaError,
    Query = require('./query'),
    cache = require('./cache'),
    util = require('./util'),
    _ = util._,
    async = util.async,
    ModelEventType = require('./modelEvents').ModelEventType;

var Logger = log.loggerWithName('Mapping');


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
 * @param opts.data
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
        _ignoreInstalled: false
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
    _lookup: function (callback) {
        var deferred = util.defer(callback);
        callback = deferred.finish.bind(deferred);
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
                        // Create a new object if and only if the data has any fields that will actually
                        var datumFields = Object.keys(datum);
                        var objectFields = _.reduce(Object.keys(self.model.relationships).concat(self.model._attributeNames), function (m, x) {
                            m[x] = {};
                            return m;
                        }, {});
                        var shouldCreateNewObject = false;
                        for (var j = 0; j < datumFields.length; j++) {
                            if (objectFields[datumFields[j]]) {
                                shouldCreateNewObject = true;
                                break;
                            }
                        }
                        if (shouldCreateNewObject) {
                            this.objects[i] = self._new();
                        }
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
                                            obj = self._new({_id: _id}, !self.disableevents);
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
                        if (Logger.trace.isEnabled)
                            Logger.trace('Looking up remoteIdentifiers: ' + util.prettyPrint(remoteIdentifiers));
                        Store.getMultipleRemote(remoteIdentifiers, self.model, function (err, objects) {
                            if (!err) {
                                if (Logger.trace.isEnabled) {
                                    var results = {};
                                    for (i = 0; i < objects.length; i++) {
                                        results[remoteIdentifiers[i]] = objects[i] ? objects[i]._id : null;
                                    }
                                    Logger.trace('Results for remoteIdentifiers: ' + util.prettyPrint(results));
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
                                            self.objects[lookup.index] = self._new();
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
            callback);
        return deferred.promise;
    },
    _lookupSingleton: function (callback) {
        var deferred = util.defer(callback);
        callback = deferred.finish.bind(deferred);
        var self = this;
        this.model.one({__ignoreInstalled: this._ignoreInstalled}, function (err, singleton) {
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
            if (!singleton) singleton = self._new(_id);
            if (!err) {
                for (var i = 0; i < self.data.length; i++) {
                    self.objects[i] = singleton;
                }
            }
            callback(err);
        });
        return deferred.promise;
    },
    _new: function () {
        var model = this.model,
            modelInstance = model._new.apply(model, arguments);
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
                self._map();

                // Users are allowed to add a custom init method to the methods object when defining a Model, of the form:
                //
                // methods: {
                //     __init: function ([done]) {
                //        // ...
                //     }
                // }
                //
                // If done is passed, then __init must be executed asynchronously, and the mapping operation will not
                // finish until all inits have executed.
                //
                // Here we ensure the execution of all of them

                var initTasks = _.reduce(self._newObjects, function (m, o) {
                    var init = o.model.init;
                    if (init) {
                        var paramNames = util.paramNames(init);
                        if (paramNames.length) {
                            m.push(_.bind(init, o, done));
                        }
                        else {
                            init.call(o);
                        }
                    }
                    return m;
                }, []);
                async.parallel(initTasks, function () {
                    done(self.errors.length ? self.errors : null, self.objects);
                });
            });
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
                    reverseModel = relationship.forwardName == relationshipName ? relationship.reverseModel : relationship.forwardModel,
                    __ret = this.getRelatedData(relationshipName),
                    indexes = __ret.indexes,
                    relatedData = __ret.relatedData;
                if (relatedData.length) {
                    var flatRelatedData = util.flattenArray(relatedData);
                    var op = new MappingOperation({
                        model: reverseModel,
                        data: flatRelatedData,
                        disableevents: self.disableevents,
                        _ignoreInstalled: self._ignoreInstalled
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
            async.parallel(tasks, function () {
                callback();
            });
        } else {
            callback();
        }
    }
});

module.exports = MappingOperation;



},{"./cache":8,"./error":11,"./log":14,"./modelEvents":18,"./modelInstance":19,"./query":20,"./store":23,"./util":25}],17:[function(require,module,exports){
/**
 * @module mapping
 */

var log = require('./log'),
    CollectionRegistry = require('./collectionRegistry').CollectionRegistry,
    InternalSiestaError = require('./error').InternalSiestaError,
    RelationshipType = require('./RelationshipType'),
    Query = require('./query'),
    MappingOperation = require('./mappingOperation'),
    ModelInstance = require('./modelInstance'),
    util = require('./util'),
    cache = require('./cache'),
    store = require('./store'),
    extend = require('extend'),
    modelEvents = require('./modelEvents'),
    events = require('./events'),
    wrapArray = require('./events').wrapArray,
    proxy = require('./RelationshipProxy'),
    OneToManyProxy = require('./OneToManyProxy'),
    OneToOneProxy = require('./OneToOneProxy'),
    ManyToManyProxy = require('./manyToManyProxy'),
    ReactiveQuery = require('./reactiveQuery'),
    ArrangedReactiveQuery = require('./ArrangedReactiveQuery'),
    _ = util._,
    guid = util.guid,
    ModelEventType = modelEvents.ModelEventType;

var Logger = log.loggerWithName('Model');

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

_.extend(Model.prototype, {
    installStatics: function (statics) {
        if (statics) {
            _.each(Object.keys(statics), function (staticName) {
                if (this[staticName]) {
                    Logger.error('Static method with name "' + staticName + '" already exists. Ignoring it.');
                }
                else {
                    this[staticName] = statics[staticName].bind(this);
                }
            }.bind(this));
        }
        return statics;
    },
    /**
     * Install relationships. Returns error in form of string if fails.
     * @return {String|null}
     */
    installRelationships: function () {
        if (!this._relationshipsInstalled) {
            var self = this;
            self._relationships = [];
            if (self._opts.relationships) {
                for (var name in self._opts.relationships) {
                    if (self._opts.relationships.hasOwnProperty(name)) {
                        var relationship = self._opts.relationships[name];
                        // If a reverse relationship is installed beforehand, we do not want to process them.
                        if (!relationship.isReverse) {
                            if (Logger.debug.isEnabled)
                                Logger.debug(self.name + ': configuring relationship ' + name, relationship);
                            if (!relationship.type) {
                                if (self.singleton) {
                                    relationship.type = RelationshipType.OneToOne;
                                }
                                else {
                                    relationship.type = RelationshipType.OneToMany;
                                }
                            }
                            if (relationship.type == RelationshipType.OneToMany ||
                                relationship.type == RelationshipType.OneToOne ||
                                relationship.type == RelationshipType.ManyToMany) {
                                var modelName = relationship.model;
                                delete relationship.model;
                                var reverseModel;
                                if (modelName instanceof Model) {
                                    reverseModel = modelName;
                                }
                                else {
                                    if (Logger.debug.isEnabled)
                                        Logger.debug('reverseModelName', modelName);
                                    if (!self.collection) throw new InternalSiestaError('Model must have collection');
                                    var collection = self.collection;
                                    if (!collection) {
                                        throw new InternalSiestaError('Collection ' + self.collectionName + ' not registered');
                                    }
                                    reverseModel = collection[modelName];
                                }

                                if (!reverseModel) {
                                    var arr = modelName.split('.');
                                    if (arr.length == 2) {
                                        var collectionName = arr[0];
                                        modelName = arr[1];
                                        var otherCollection = CollectionRegistry[collectionName];
                                        if (!otherCollection) {
                                            return 'Collection with name "' + collectionName + '" does not exist.';
                                        }
                                        reverseModel = otherCollection[modelName];
                                    }
                                }
                                if (Logger.debug.isEnabled)
                                    Logger.debug('reverseModel', reverseModel);
                                if (reverseModel) {
                                    relationship.reverseModel = reverseModel;
                                    relationship.forwardModel = this;
                                    relationship.forwardName = name;
                                    relationship.reverseName = relationship.reverse || 'reverse_' + name;
                                    delete relationship.reverse;
                                    relationship.isReverse = false;
                                } else {
                                    return 'Model with name "' + modelName.toString() + '" does not exist';
                                }
                            } else {
                                return 'Relationship type ' + relationship.type + ' does not exist';
                            }
                        }
                    }
                }
            }
            this._relationshipsInstalled = true;
        } else {
            throw new InternalSiestaError('Relationships for "' + this.name + '" have already been installed');
        }
        return null;
    },
    installReverseRelationships: function () {
        if (!this._reverseRelationshipsInstalled) {
            for (var forwardName in this.relationships) {
                if (this.relationships.hasOwnProperty(forwardName)) {
                    var relationship = this.relationships[forwardName];
                    relationship = extend(true, {}, relationship);
                    relationship.isReverse = true;
                    var reverseModel = relationship.reverseModel;
                    var reverseName = relationship.reverseName;
                    if (Logger.debug.isEnabled)
                        Logger.debug(this.name + ': configuring  reverse relationship ' + reverseName);
                    reverseModel.relationships[reverseName] = relationship;
                }
            }
            this._reverseRelationshipsInstalled = true;
        } else {
            throw new InternalSiestaError('Reverse relationships for "' + this.name + '" have already been installed.');
        }
    },
    ensureSingletons: function (callback) {
        if (this.singleton) {
            this.one({__ignoreInstalled: true}, function (err, obj) {
                if (err) {
                    callback(err);
                }
                else {
                    if (!obj) {
                        var data = {};
                        var relationships = this.relationships;
                        data = _.reduce(Object.keys(relationships), function (m, name) {
                            var r = relationships[name];
                            if (r.isReverse) {
                                data[r.reverseName] = {};
                            }
                            return data;
                        }, data);
                        this.map(data, {_ignoreInstalled: true}, function (err, obj) {
                            if (Logger.trace) Logger.trace('Ensured singleton mapping "' + this.name + '"', obj);
                            callback(err, obj);
                        }.bind(this));
                    }
                    else {
                        if (Logger.trace) Logger.trace('Singleton already exists for mapping "' + this.name + '"', obj);
                        callback(null, obj);
                    }
                }
            }.bind(this));
        }
        else {
            callback();
        }
    }, /**
     * Any post installation steps that need to be performed.
     */
    finaliseInstallation: function (callback) {
        if (this.singleton) {
            // Ensure that the singleton objects exist, and that all singleton relationships
            // are hooked up.
            // TODO: Any parent singletons will be having empty data mapped twice when their own finalise is called... Pointless.
            this.ensureSingletons(callback);
        }
        else callback();
    },
    _query: function (query) {
        var query = new Query(this, query || {});
        return query;
    },
    query: function (query, callback) {
        return (this._query(query)).execute(callback);
    },
    reactiveQuery: function (query) {
        return new ReactiveQuery(new Query(this, query || {}));
    },
    arrangedReactiveQuery: function (query) {
        return new ArrangedReactiveQuery(new Query(this, query || {}));
    },
    one: function (opts, cb) {
        opts = opts || {};
        if (typeof opts == 'function') {
            cb = opts;
            opts = {};
        }
        var query = this._query(opts);
        // Override the usual execute method, inserting a check that no more one instances returned.
        return (function (cb) {
            var deferred = util.defer(cb);
            cb = deferred.finish.bind(deferred);
            this._executeInMemory(function (err, res) {
                if (err) cb(err);
                else {
                    if (res.length > 1) cb('More than one instance returned when executing get query!');
                    else cb(null, res.length ? res[0] : null);
                }
            });
            return deferred.promise;
        }).call(query, cb)
    },
    all: function (q, cb) {
        if (typeof q == 'function') {
            cb = q;
            q = {};
        }
        q = q || {};
        var query = {};
        if (q.__order) query.__order = q.__order;
        return (new Query(this, query)).execute(cb);
    },
    install: function (callback) {
        if (Logger.info.isEnabled) Logger.info('Installing mapping ' + this.name);
        var deferred = util.defer(callback);
        callback = deferred.finish.bind(deferred);
        if (!this._installed) {
            this._installed = true;
            callback();
        } else {
            throw new InternalSiestaError('Model "' + this.name + '" has already been installed');
        }
        return deferred.promise;
    },
    /**
     * Map data into Siesta.
     *
     * @param data Raw data received remotely or otherwise
     * @param {function|object} [opts]
     * @param {boolean} opts.override
     * @param {boolean} opts._ignoreInstalled - An escape clause that allows mapping onto Models even if install process has not finished.
     * @param {function} [callback] Called once pouch persistence returns.
     */
    map: function (data, opts, callback) {
        if (typeof opts == 'function') callback = opts;
        opts = opts || {};
        var deferred = util.defer(callback);
        var _map = function () {
            var overrides = opts.override;
            if (overrides) {
                if (util.isArray(overrides)) opts.objects = overrides;
                else opts.objects = [overrides];
            }
            delete opts.override;
            if (util.isArray(data)) {
                this._mapBulk(data, opts, deferred.finish.bind(deferred));
            } else {
                this._mapBulk([data], opts, function (err, objects) {
                    var obj;
                    if (objects) {
                        if (objects.length) {
                            obj = objects[0];
                        }
                    }
                    deferred.finish(err ? err[0] : null, obj);
                });
            }
        }.bind(this);
        if (opts._ignoreInstalled) {
            _map();
        }
        else siesta._afterInstall(_map);
        return deferred.promise;
    },
    _mapBulk: function (data, opts, callback) {
        _.extend(opts, {model: this, data: data});
        var op = new MappingOperation(opts);
        op.start(function (err, objects) {
            if (err) {
                if (callback) callback(err);
            } else {
                callback(null, objects);
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
    count: function (callback) {
        var deferred = util.defer(callback);
        callback = deferred.finish.bind(deferred);
        var hash = this._countCache();
        callback(null, Object.keys(hash).length)
        return deferred.promise;
    },
    /**
     * Convert raw data into a ModelInstance
     * @returns {ModelInstance}
     * @private
     */
    _new: function (data, shouldRegisterChange) {
        shouldRegisterChange = shouldRegisterChange === undefined ? true : shouldRegisterChange;
        if (this.installed) {
            var self = this;
            var _id;
            if (data) {
                _id = data._id ? data._id : guid();
            } else {
                _id = guid();
            }
            var newModel = new ModelInstance(this);
            if (Logger.info.isEnabled)
                Logger.info('New object created _id="' + _id.toString() + '", type=' + this.name, data);
            newModel._id = _id;
            // Place attributes on the object.
            var values = {};
            newModel.__values = values;
            var defaults = _.reduce(this.attributes, function (m, a) {
                if (a.default !== undefined) {
                    m[a.name] = a.default;
                }
                return m;
            }, {});
            _.extend(values, defaults);
            if (data) _.extend(values, data);
            var fields = this._attributeNames;
            var idx = fields.indexOf(this.id);
            if (idx > -1) {
                fields.splice(idx, 1);
            }
            _.each(fields, function (field) {
                Object.defineProperty(newModel, field, {
                    get: function () {
                        var value = newModel.__values[field];
                        return value === undefined ? null : value;
                    },
                    set: function (v) {
                        var old = newModel.__values[field];
                        newModel.__values[field] = v;
                        modelEvents.emit({
                            collection: self.collectionName,
                            model: self.name,
                            _id: newModel._id,
                            new: v,
                            old: old,
                            type: ModelEventType.Set,
                            field: field,
                            obj: newModel
                        });
                        if (util.isArray(v)) {
                            wrapArray(v, field, newModel);
                        }
                    },
                    enumerable: true,
                    configurable: true
                });
            });

            _.each(Object.keys(this.methods), function (methodName) {
                if (newModel[methodName] === undefined) {
                    newModel[methodName] = this.methods[methodName].bind(newModel);
                }
                else {
                    Logger.error('A method with name "' + methodName + '" already exists. Ignoring it.');
                }
            }.bind(this));

            _.each(Object.keys(this.properties), function (propName) {
                if (newModel[propName] === undefined) {
                    Object.defineProperty(newModel, propName, this.properties[propName]);
                }
                else {
                    Logger.error('A property/method with name "' + propName + '" already exists. Ignoring it.');
                }
            }.bind(this));

            Object.defineProperty(newModel, this.id, {
                get: function () {
                    return newModel.__values[self.id] || null;
                },
                set: function (v) {
                    var old = newModel[self.id];
                    newModel.__values[self.id] = v;
                    modelEvents.emit({
                        collection: self.collectionName,
                        model: self.name,
                        _id: newModel._id,
                        new: v,
                        old: old,
                        type: ModelEventType.Set,
                        field: self.id,
                        obj: newModel
                    });
                    cache.remoteInsert(newModel, v, old);
                },
                enumerable: true,
                configurable: true
            });
            for (var name in this.relationships) {
                var proxy;
                if (this.relationships.hasOwnProperty(name)) {
                    var relationshipOpts = _.extend({}, this.relationships[name]),
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
                proxy.install(newModel);
            }
            cache.insert(newModel);
            if (shouldRegisterChange) {
                modelEvents.emit({
                    collection: this.collectionName,
                    model: this.name,
                    _id: newModel._id,
                    new: newModel,
                    type: ModelEventType.New,
                    obj: newModel
                });
            }
            return newModel;
        } else {
            throw new InternalSiestaError('Model must be fully installed before creating any models');
        }

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

_.extend(Model.prototype, {
    listen: function (fn) {
        events.on(this.collectionName + ':' + this.name, fn);
        return function () {
            this.removeListener(fn);
        }.bind(this);
    },
    listenOnce: function (fn) {
        return events.once(this.collectionName + ':' + this.name, fn);
    },
    removeListener: function (fn) {
        return events.removeListener(this.collectionName + ':' + this.name, fn);
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

_.extend(Model.prototype, {
    paginator: function (opts) {
        if (siesta.ext.httpEnabled) {
            var Paginator = siesta.ext.http.Paginator;
            opts = opts || {};
            opts.model = this;
            return new Paginator(opts);
        }
    }
});

module.exports = Model;

},{"./ArrangedReactiveQuery":1,"./OneToManyProxy":3,"./OneToOneProxy":4,"./RelationshipProxy":6,"./RelationshipType":7,"./cache":8,"./collectionRegistry":10,"./error":11,"./events":12,"./log":14,"./manyToManyProxy":15,"./mappingOperation":16,"./modelEvents":18,"./modelInstance":19,"./query":20,"./reactiveQuery":22,"./store":23,"./util":25,"extend":30}],18:[function(require,module,exports){
var events = require('./events'),
    InternalSiestaError = require('./error').InternalSiestaError,
    log = require('./log'),
    extend = require('./util')._.extend,
    collectionRegistry = require('./collectionRegistry').CollectionRegistry;

var Logger = log.loggerWithName('ModelEvents');

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
    },
    ModelEventFields = ['collection', 'model', '_id', 'field', 'type', 'index', 'added', 'removed', 'new', 'old', 'obj'];

/**
 * Represents an individual change.
 * @param opts
 * @constructor
 */
function ModelEvent(opts) {
    this._opts = opts || {};
    ModelEventFields.forEach(function (f) {
        if (this._opts[f] !== undefined) this[f] = this._opts[f];
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
    if (Logger.trace.isEnabled) Logger.trace('Sending notification "' + collectionName + '" of type ' + c.type);
    events.emit(collectionName, c);
    var modelNotif = collectionName + ':' + modelName;
    if (Logger.trace.isEnabled) Logger.trace('Sending notification "' + modelNotif + '" of type ' + c.type);
    events.emit(modelNotif, c);
    var genericNotif = 'Siesta';
    if (Logger.trace.isEnabled) Logger.trace('Sending notification "' + genericNotif + '" of type ' + c.type);
    events.emit(genericNotif, c);
    var localIdNotif = c._id;
    if (Logger.trace.isEnabled) Logger.trace('Sending notification "' + localIdNotif + '" of type ' + c.type);
    events.emit(localIdNotif, c);
    var collection = collectionRegistry[collectionName];
    var err;
    if (!collection) {
        err = 'No such collection "' + collectionName + '"';
        Logger.error(err, collectionRegistry);
        throw new InternalSiestaError(err);
    }
    var model = collection[modelName];
    if (!model) {
        err = 'No such model "' + modelName + '"';
        Logger.error(err, collectionRegistry);
        throw new InternalSiestaError(err);
    }
    if (model.id && c.obj[model.id]) {
        var remoteIdNotif = collectionName + ':' + modelName + ':' + c.obj[model.id];
        if (Logger.trace.isEnabled) Logger.trace('Sending notification "' + remoteIdNotif + '" of type ' + c.type);
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
},{"./collectionRegistry":10,"./error":11,"./events":12,"./log":14,"./util":25}],19:[function(require,module,exports){
module.exports=require(2)
},{"./cache":8,"./error":11,"./events":12,"./log":14,"./modelEvents":18,"./util":25,"/Users/mtford/Playground/rest/core/ModelInstance.js":2}],20:[function(require,module,exports){
module.exports=require(5)
},{"./cache":8,"./error":11,"./log":14,"./querySet":21,"./util":25,"/Users/mtford/Playground/rest/core/Query.js":5}],21:[function(require,module,exports){
var util = require('./util'),
    SiestaUserError = require('./error').SiestaUserError,
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
                    if (this.length != v.length) throw new SiestaUserError({message: 'Must be same length'});
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
            return arePromises ? window.Q.all(res) : querySet(res);
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
},{"./ModelInstance":2,"./error":11,"./util":25}],22:[function(require,module,exports){
/**
 * For those familiar with Apple's Cocoa library, reactive queries roughly map onto NSFetchedResultsController.
 *
 * They present a query set that 'reacts' to changes in the underlying data.
 * @module reactiveQuery
 */

var log = require('./log'),
    Query = require('./query'),
    EventEmitter = require('events').EventEmitter,
    events = require('./events'),
    modelEvents = require('./modelEvents'),
    InternalSiestaError = require('./error').InternalSiestaError,
    constructQuerySet = require('./querySet'),
    util = require('./util'),
    _ = util._;

var Logger = log.loggerWithName('Query');

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
        initialized: {get: function () {return this.initialised}},
        model: {get: function () { return self._query.model }},
        collection: {get: function () { return self.model.collectionName }}
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
    init: function (cb) {
        if (Logger.trace) Logger.trace('init');
        var deferred = util.defer(cb);
        cb = deferred.finish.bind(deferred);
        if (!this.initialised) {
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
                    if (Logger.trace) Logger.trace('Listening to ' + name);
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
        return deferred.promise;
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
    _handleNotif: function (n) {
        if (Logger.trace) Logger.trace('_handleNotif', n);
        if (n.type == modelEvents.ModelEventType.New) {
            var newObj = n.new;
            if (this._query.objectMatchesQuery(newObj)) {
                if (Logger.trace) Logger.trace('New object matches', newObj._dumpString());
                var idx = this.insert(newObj);
                this.emit('change', this.results, {
                    index: idx,
                    added: [newObj],
                    type: modelEvents.ModelEventType.Splice,
                    obj: this
                });
            }
            else {
                if (Logger.trace) Logger.trace('New object does not match', newObj._dumpString());
            }
        }
        else if (n.type == modelEvents.ModelEventType.Set) {
            newObj = n.obj;
            var index = this.results.indexOf(newObj),
                alreadyContains = index > -1,
                matches = this._query.objectMatchesQuery(newObj);
            if (matches && !alreadyContains) {
                if (Logger.trace) Logger.trace('Updated object now matches!', newObj._dumpString());
                idx = this.insert(newObj);
                this.emit('change', this.results, {
                    index: idx,
                    added: [newObj],
                    type: modelEvents.ModelEventType.Splice,
                    obj: this
                });
            }
            else if (!matches && alreadyContains) {
                if (Logger.trace) Logger.trace('Updated object no longer matches!', newObj._dumpString());
                results = this.results.mutableCopy();
                var removed = results.splice(index, 1);
                this.results = results.asModelQuerySet(this.model);
                this.emit('change', this.results, {
                    index: index,
                    obj: this,
                    new: newObj,
                    type: modelEvents.ModelEventType.Splice,
                    removed: removed
                });
            }
            else if (!matches && !alreadyContains) {
                if (Logger.trace) Logger.trace('Does not contain, but doesnt match so not inserting', newObj._dumpString());
            }
            else if (matches && alreadyContains) {
                if (Logger.trace) Logger.trace('Matches but already contains', newObj._dumpString());
                // Send the notification over. 
                this.emit('change', this.results, n);
            }
        }
        else if (n.type == modelEvents.ModelEventType.Remove) {
            newObj = n.obj;
            var results = this.results.mutableCopy();
            index = results.indexOf(newObj);
            if (index > -1) {
                if (Logger.trace) Logger.trace('Removing object', newObj._dumpString());
                removed = results.splice(index, 1);
                this.results = constructQuerySet(results, this.model);
                this.emit('change', this.results, {
                    index: index,
                    obj: this,
                    type: modelEvents.ModelEventType.Splice,
                    removed: removed
                });
            }
            else {
                if (Logger.trace) Logger.trace('No modelEvents neccessary.', newObj._dumpString());
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
},{"./error":11,"./events":12,"./log":14,"./modelEvents":18,"./query":20,"./querySet":21,"./util":25,"events":29}],23:[function(require,module,exports){
/**
 * The "store" is responsible for mediating between the in-memory cache and any persistent storage.
 * Note that persistent storage has not been properly implemented yet and so this is pretty useless.
 * All queries will go straight to the cache instead.
 * @module store
 */

var InternalSiestaError = require('./error').InternalSiestaError,
    log = require('./log'),
    util = require('./util'),
    _ = util._,
    cache = require('./cache');


var Logger = log.loggerWithName('Store');

/**
 * [get description]
 * @param  {Object}   opts
 * @param  {Function} callback
 * @return {Promise}
 * @example
 * ```js
 * var xyz = 'afsdf';
 * ```
 * @example
 * ```js
 * var abc = 'asdsd';
 * ```
 */
function get(opts, callback) {
    var deferred = util.defer(callback);
    callback = deferred.finish.bind(deferred);
    if (Logger.debug.isEnabled)
        Logger.debug('get', opts);
    var siestaModel;
    if (opts._id) {
        if (util.isArray(opts._id)) {
            // Proxy onto getMultiple instead.
            getMultiple(_.map(opts._id, function (id) {
                return {
                    _id: id
                }
            }), callback);
        } else {
            siestaModel = cache.get(opts);
            if (siestaModel) {
                if (Logger.debug.isEnabled)
                    Logger.debug('Had cached object', {
                        opts: opts,
                        obj: siestaModel
                    });
                if (callback) callback(null, siestaModel);
            } else {
                if (util.isArray(opts._id)) {
                    // Proxy onto getMultiple instead.
                    getMultiple(_.map(opts._id, function (id) {
                        return {
                            _id: id
                        }
                    }), callback);
                } else if (callback) {
                    var storage = siesta.ext.storage;
                    if (storage) {
                        storage.store.getFromPouch(opts, callback);
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
            }), callback);
        } else {
            siestaModel = cache.get(opts);
            if (siestaModel) {
                if (Logger.debug.isEnabled)
                    Logger.debug('Had cached object', {
                        opts: opts,
                        obj: siestaModel
                    });
                if (callback) callback(null, siestaModel);
            } else {
                var model = opts.model;
                if (model.singleton) {
                    model.one(callback);
                } else {
                    var idField = model.id;
                    var id = opts[idField];
                    var oneOpts = {};
                    oneOpts[idField] = id;
                    if (id) {
                        model.one(oneOpts, function (err, obj) {
                            if (!err) {
                                if (obj) {
                                    callback(null, obj);
                                } else {
                                    callback(null, null);
                                }
                            } else {
                                callback(err);
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
    return deferred.promise;
}

function getMultiple(optsArray, callback) {
    var deferred = util.defer(callback);
    callback = deferred.finish.bind(deferred);
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
                if (callback) {
                    if (errors.length) {
                        callback(errors);
                    } else {
                        callback(null, docs);
                    }
                }
            }
        });
    });
    return deferred.promise;
}
/**
 * Uses pouch bulk fetch API. Much faster than getMultiple.
 * @param localIdentifiers
 * @param callback
 */
function getMultipleLocal(localIdentifiers, callback) {
    var deferred = util.defer(callback);
    callback = deferred.finish.bind(deferred);
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
        if (callback) {
            if (err) {
                callback(err);
            } else {
                callback(null, _.map(localIdentifiers, function (_id) {
                    return results.cached[_id];
                }));
            }
        }
    }

//    if (siesta.ext.storageEnabled && results.notCached.length) {
//        siesta.ext.storage.store.getMultipleLocalFromCouch(results, finish);
//    } else {
    finish();
//    }
    return deferred.promise;
}

function getMultipleRemote(remoteIdentifiers, model, callback) {
    var deferred = util.defer(callback);
    callback = deferred.finish.bind(deferred);
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
        if (callback) {
            if (err) {
                callback(err);
            } else {
                callback(null, _.map(remoteIdentifiers, function (id) {
                    return results.cached[id];
                }));
            }
        }
    }

    finish();
    return deferred.promise;
}

module.exports = {
    get: get,
    getMultiple: getMultiple,
    getMultipleLocal: getMultipleLocal,
    getMultipleRemote: getMultipleRemote
};

},{"./cache":8,"./error":11,"./log":14,"./util":25}],24:[function(require,module,exports){
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
        eachfn.each(keys(tasks), function (k, callback) {
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
},{"./misc":26,"./underscore":28}],25:[function(require,module,exports){
/*
 * This is a collection of utilities taken from libraries such as async.js, underscore.js etc.
 * @module util
 */

var _ = require('./underscore'),
    async = require('./async'),
    misc = require('./misc');

_.extend(module.exports, {
    _: _,
    defer: require('./promise'),
    async: async
});
_.extend(module.exports, misc);

},{"./async":24,"./misc":26,"./promise":27,"./underscore":28}],26:[function(require,module,exports){
var observe = require('../../vendor/observe-js/src/observe').Platform,
    _ = require('./underscore'),
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

var isArray = Array.isArray || function (obj) {
        return _.toString.call(obj) === '[object Array]';

    };
var isString = function (o) {
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
    defer: function (cb) {
        var deferred;
        cb = cb || function () {};
        if (window.q) {
            deferred = window.q.defer();
            var reject = deferred.reject,
                resolve = deferred.resolve;
            _.extend(deferred, {
                reject: function (err) {
                    cb(err);
                    reject.call(this, err);
                },
                resolve: function (res) {
                    cb(null, res);
                    resolve.call(this, res);
                },
                finish: function (err, res) {
                    cb(err, res);
                    if (err) reject.call(this, err);
                    else resolve.call(this, res);
                }
            });
        }
        else {
            deferred = {
                promise: undefined,
                reject: function (err) {
                    cb(err);
                },
                resolve: function (res) {
                    cb(null, res)
                },
                finish: function (err, res) {
                    cb(err, res);
                }
            }
        }
        return deferred;
    },
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

        argDecl[1].split(FN_ARG_SPLIT).forEach(function(arg){
            arg.replace(FN_ARG, function(all, underscore, name){
                params.push(name);
            });
        });
        return params;
    }
});
},{"../../vendor/observe-js/src/observe":31,"./../error":11,"./underscore":28}],27:[function(require,module,exports){
/**
 * A crazy simple promise library.
 * @module util.promise
 */

function s(pass) {
    return function (res) {
        this.res = res;
        try {
            this.success.forEach(function (s) {s(pass ? res : undefined)});
        }
        catch (err) {
            e.call(this, err);
        }
    }
}

function f(err) {
    this._fail = err;
    this.error = err;
    this.failure.forEach(function (s) {s(err)});
    this.errors.forEach(function (s) {s(err)});
}

function e(err) {
    this.error = err;
    this.errors.forEach(function (s) {s(err)});
}

function Promise() {
    _.extend(this, {
        success: [],
        failure: [],
        errors: [],
        /**
         * @type Promise
         */
        _nextPromise: null
    });
    Object.defineProperty(this, 'nextPromise', {
        get: function () {
            if (!this._nextPromise) {
                this._nextPromise = new Promise();
                this.success.push(s(false).bind(this._nextPromise));
                this.failure.push(f.bind(this._nextPromise));
                this.errors.push(e.bind(this._nextPromise));
                this._nextPromise._fail = this._fail;
                this._nextPromise.error = this.error;
                this._nextPromise.res = this.res;
            }
            return this._nextPromise;
        }
    });
}
var fail = function (error) {
    if (error) {
        if (this.error) error(this.error);
        else this.errors.push(error);
    }
    return this.nextPromise;
};
_.extend(Promise.prototype, {
    then: function (success, failure) {
        if (success) {
            if (this.res) success(this.res);
            else this.success.push(success);
        }
        if (failure) {
            if (this._fail) failure(this._fail);
            else this.failure.push(failure);
        }
        return this.nextPromise;
    },
    catch: fail,
    fail: fail,
    done: function (success, failure) {
        this.then(success).catch(failure);
    }
});

function Deferred(cb) {
    _.extend(this, {
        cb: cb || function () {},
        promise: new Promise()
    });
}

_.extend(Deferred.prototype, {
    resolve: function (res) {
        s(true).call(this.promise, res);
        this.cb(null, res);
    },
    reject: function (err) {
        f.call(this.promise, err);
        this.cb(err ? err : true);
    },
    finish: function (err, res) {
        if (this == window) throw 'wtf';
        if (err) this.reject(err);
        else this.resolve(res);
    }
});

module.exports = function (cb) {
    return new Deferred(cb);
};
},{}],28:[function(require,module,exports){
/**
 * Often used functions from underscore, pulled out for brevity.
 * @module underscore
 */

var _ = {},
    ArrayProto = Array.prototype,
    FuncProto = Function.prototype,
    nativeForEach = ArrayProto.forEach,
    nativeMap = ArrayProto.map,
    nativeReduce = ArrayProto.reduce,
    nativeBind = FuncProto.bind,
    slice = ArrayProto.slice,
    breaker = {},
    ctor = function () {};

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


},{}],31:[function(require,module,exports){
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

  function isObject(obj) {
    return obj === Object(obj);
  }

  var numberIsNaN = global.Number.isNaN || function(value) {
    return typeof value === 'number' && global.isNaN(value);
  }

  function areSameValue(left, right) {
    if (left === right)
      return left !== 0 || 1 / left === 1 / right;
    if (numberIsNaN(left) && numberIsNaN(right))
      return true;

    return left !== left && right !== right;
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
  var identRegExp = new RegExp('^' + identStart + '+' + identPart + '*' + '$');

  function getPathCharType(char) {
    if (char === undefined)
      return 'eof';

    var code = char.charCodeAt(0);

    switch(code) {
      case 0x5B: // [
      case 0x5D: // ]
      case 0x2E: // .
      case 0x22: // "
      case 0x27: // '
      case 0x30: // 0
        return char;

      case 0x5F: // _
      case 0x24: // $
        return 'ident';

      case 0x20: // Space
      case 0x09: // Tab
      case 0x0A: // Newline
      case 0x0D: // Return
      case 0xA0:  // No-break space
      case 0xFEFF:  // Byte Order Mark
      case 0x2028:  // Line Separator
      case 0x2029:  // Paragraph Separator
        return 'ws';
    }

    // a-z, A-Z
    if ((0x61 <= code && code <= 0x7A) || (0x41 <= code && code <= 0x5A))
      return 'ident';

    // 1-9
    if (0x31 <= code && code <= 0x39)
      return 'number';

    return 'else';
  }

  var pathStateMachine = {
    'beforePath': {
      'ws': ['beforePath'],
      'ident': ['inIdent', 'append'],
      '[': ['beforeElement'],
      'eof': ['afterPath']
    },

    'inPath': {
      'ws': ['inPath'],
      '.': ['beforeIdent'],
      '[': ['beforeElement'],
      'eof': ['afterPath']
    },

    'beforeIdent': {
      'ws': ['beforeIdent'],
      'ident': ['inIdent', 'append']
    },

    'inIdent': {
      'ident': ['inIdent', 'append'],
      '0': ['inIdent', 'append'],
      'number': ['inIdent', 'append'],
      'ws': ['inPath', 'push'],
      '.': ['beforeIdent', 'push'],
      '[': ['beforeElement', 'push'],
      'eof': ['afterPath', 'push']
    },

    'beforeElement': {
      'ws': ['beforeElement'],
      '0': ['afterZero', 'append'],
      'number': ['inIndex', 'append'],
      "'": ['inSingleQuote', 'append', ''],
      '"': ['inDoubleQuote', 'append', '']
    },

    'afterZero': {
      'ws': ['afterElement', 'push'],
      ']': ['inPath', 'push']
    },

    'inIndex': {
      '0': ['inIndex', 'append'],
      'number': ['inIndex', 'append'],
      'ws': ['afterElement'],
      ']': ['inPath', 'push']
    },

    'inSingleQuote': {
      "'": ['afterElement'],
      'eof': ['error'],
      'else': ['inSingleQuote', 'append']
    },

    'inDoubleQuote': {
      '"': ['afterElement'],
      'eof': ['error'],
      'else': ['inDoubleQuote', 'append']
    },

    'afterElement': {
      'ws': ['afterElement'],
      ']': ['inPath', 'push']
    }
  }

  function noop() {}

  function parsePath(path) {
    var keys = [];
    var index = -1;
    var c, newChar, key, type, transition, action, typeMap, mode = 'beforePath';

    var actions = {
      push: function() {
        if (key === undefined)
          return;

        keys.push(key);
        key = undefined;
      },

      append: function() {
        if (key === undefined)
          key = newChar
        else
          key += newChar;
      }
    };

    function maybeUnescapeQuote() {
      if (index >= path.length)
        return;

      var nextChar = path[index + 1];
      if ((mode == 'inSingleQuote' && nextChar == "'") ||
          (mode == 'inDoubleQuote' && nextChar == '"')) {
        index++;
        newChar = nextChar;
        actions.append();
        return true;
      }
    }

    while (mode) {
      index++;
      c = path[index];

      if (c == '\\' && maybeUnescapeQuote(mode))
        continue;

      type = getPathCharType(c);
      typeMap = pathStateMachine[mode];
      transition = typeMap[type] || typeMap['else'] || 'error';

      if (transition == 'error')
        return; // parse error;

      mode = transition[0];
      action = actions[transition[1]] || noop;
      newChar = transition[2] === undefined ? c : transition[2];
      action();

      if (mode === 'afterPath') {
        return keys;
      }
    }

    return; // parse error
  }

  function isIdent(s) {
    return identRegExp.test(s);
  }

  var constructorIsPrivate = {};

  function Path(parts, privateToken) {
    if (privateToken !== constructorIsPrivate)
      throw Error('Use Path.get to retrieve path objects');

    for (var i = 0; i < parts.length; i++) {
      this.push(String(parts[i]));
    }

    if (hasEval && this.length) {
      this.getValueFrom = this.compiledGetValueFromFn();
    }
  }

  // TODO(rafaelw): Make simple LRU cache
  var pathCache = {};

  function getPath(pathString) {
    if (pathString instanceof Path)
      return pathString;

    if (pathString == null || pathString.length == 0)
      pathString = '';

    if (typeof pathString != 'string') {
      if (isIndex(pathString.length)) {
        // Constructed with array-like (pre-parsed) keys
        return new Path(pathString, constructorIsPrivate);
      }

      pathString = String(pathString);
    }

    var path = pathCache[pathString];
    if (path)
      return path;

    var parts = parsePath(pathString);
    if (!parts)
      return invalidPath;

    var path = new Path(parts, constructorIsPrivate);
    pathCache[pathString] = path;
    return path;
  }

  Path.get = getPath;

  function formatAccessor(key) {
    if (isIndex(key)) {
      return '[' + key + ']';
    } else {
      return '["' + key.replace(/"/g, '\\"') + '"]';
    }
  }

  Path.prototype = createObject({
    __proto__: [],
    valid: true,

    toString: function() {
      var pathString = '';
      for (var i = 0; i < this.length; i++) {
        var key = this[i];
        if (isIdent(key)) {
          pathString += i ? '.' + key : key;
        } else {
          pathString += formatAccessor(key);
        }
      }

      return pathString;
    },

    getValueFrom: function(obj, directObserver) {
      for (var i = 0; i < this.length; i++) {
        if (obj == null)
          return;
        obj = obj[this[i]];
      }
      return obj;
    },

    iterateObjects: function(obj, observe) {
      for (var i = 0; i < this.length; i++) {
        if (i)
          obj = obj[this[i - 1]];
        if (!isObject(obj))
          return;
        observe(obj, this[0]);
      }
    },

    compiledGetValueFromFn: function() {
      var str = '';
      var pathString = 'obj';
      str += 'if (obj != null';
      var i = 0;
      var key;
      for (; i < (this.length - 1); i++) {
        key = this[i];
        pathString += isIdent(key) ? '.' + key : formatAccessor(key);
        str += ' &&\n     ' + pathString + ' != null';
      }
      str += ')\n';

      var key = this[i];
      pathString += isIdent(key) ? '.' + key : formatAccessor(key);

      str += '  return ' + pathString + ';\nelse\n  return undefined;';
      return new Function('obj', str);
    },

    setValueFrom: function(obj, value) {
      if (!this.length)
        return false;

      for (var i = 0; i < this.length - 1; i++) {
        if (!isObject(obj))
          return false;
        obj = obj[this[i]];
      }

      if (!isObject(obj))
        return false;

      obj[this[i]] = value;
      return true;
    }
  });

  var invalidPath = new Path('', constructorIsPrivate);
  invalidPath.valid = false;
  invalidPath.getValueFrom = invalidPath.setValueFrom = function() {};

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

  function getObservedSet(observer, obj) {
    if (!lastObservedSet || lastObservedSet.object !== obj) {
      lastObservedSet = observedSetCache.pop() || newObservedSet();
      lastObservedSet.object = obj;
    }
    lastObservedSet.open(observer, obj);
    return lastObservedSet;
  }

  var UNOPENED = 0;
  var OPENED = 1;
  var CLOSED = 2;
  var RESETTING = 3;

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

    report_: function(modelEvents) {
      try {
        this.callback_.apply(this.target_, modelEvents);
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

  function PathObserver(object, path) {
    Observer.call(this);

    this.object_ = object;
    this.path_ = getPath(path);
    this.directObserver_ = undefined;
  }

  PathObserver.prototype = createObject({
    __proto__: Observer.prototype,

    get path() {
      return this.path_;
    },

    connect_: function() {
      if (hasObserve)
        this.directObserver_ = getObservedSet(this, this.object_);

      this.check_(undefined, true);
    },

    disconnect_: function() {
      this.value_ = undefined;

      if (this.directObserver_) {
        this.directObserver_.close(this);
        this.directObserver_ = undefined;
      }
    },

    iterateObjects_: function(observe) {
      this.path_.iterateObjects(this.object_, observe);
    },

    check_: function(changeRecords, skipChanges) {
      var oldValue = this.value_;
      this.value_ = this.path_.getValueFrom(this.object_);
      if (skipChanges || areSameValue(this.value_, oldValue))
        return false;

      this.report_([this.value_, oldValue, this]);
      return true;
    },

    setValue: function(newValue) {
      if (this.path_)
        this.path_.setValueFrom(this.object_, newValue);
    }
  });

  function CompoundObserver(reportChangesOnOpen) {
    Observer.call(this);

    this.reportChangesOnOpen_ = reportChangesOnOpen;
    this.value_ = [];
    this.directObserver_ = undefined;
    this.observed_ = [];
  }

  var observerSentinel = {};

  CompoundObserver.prototype = createObject({
    __proto__: Observer.prototype,

    connect_: function() {
      if (hasObserve) {
        var object;
        var needsDirectObserver = false;
        for (var i = 0; i < this.observed_.length; i += 2) {
          object = this.observed_[i]
          if (object !== observerSentinel) {
            needsDirectObserver = true;
            break;
          }
        }

        if (needsDirectObserver)
          this.directObserver_ = getObservedSet(this, object);
      }

      this.check_(undefined, !this.reportChangesOnOpen_);
    },

    disconnect_: function() {
      for (var i = 0; i < this.observed_.length; i += 2) {
        if (this.observed_[i] === observerSentinel)
          this.observed_[i + 1].close();
      }
      this.observed_.length = 0;
      this.value_.length = 0;

      if (this.directObserver_) {
        this.directObserver_.close(this);
        this.directObserver_ = undefined;
      }
    },

    addPath: function(object, path) {
      if (this.state_ != UNOPENED && this.state_ != RESETTING)
        throw Error('Cannot add paths once started.');

      var path = getPath(path);
      this.observed_.push(object, path);
      if (!this.reportChangesOnOpen_)
        return;
      var index = this.observed_.length / 2 - 1;
      this.value_[index] = path.getValueFrom(object);
    },

    addObserver: function(observer) {
      if (this.state_ != UNOPENED && this.state_ != RESETTING)
        throw Error('Cannot add observers once started.');

      this.observed_.push(observerSentinel, observer);
      if (!this.reportChangesOnOpen_)
        return;
      var index = this.observed_.length / 2 - 1;
      this.value_[index] = observer.open(this.deliver, this);
    },

    startReset: function() {
      if (this.state_ != OPENED)
        throw Error('Can only reset while open');

      this.state_ = RESETTING;
      this.disconnect_();
    },

    finishReset: function() {
      if (this.state_ != RESETTING)
        throw Error('Can only finishReset after startReset');
      this.state_ = OPENED;
      this.connect_();

      return this.value_;
    },

    iterateObjects_: function(observe) {
      var object;
      for (var i = 0; i < this.observed_.length; i += 2) {
        object = this.observed_[i]
        if (object !== observerSentinel)
          this.observed_[i + 1].iterateObjects(object, observe)
      }
    },

    check_: function(changeRecords, skipChanges) {
      var oldValues;
      for (var i = 0; i < this.observed_.length; i += 2) {
        var object = this.observed_[i];
        var path = this.observed_[i+1];
        var value;
        if (object === observerSentinel) {
          var observable = path;
          value = this.state_ === UNOPENED ?
              observable.open(this.deliver, this) :
              observable.discardChanges();
        } else {
          value = path.getValueFrom(object);
        }

        if (skipChanges) {
          this.value_[i / 2] = value;
          continue;
        }

        if (areSameValue(value, this.value_[i / 2]))
          continue;

        oldValues = oldValues || [];
        oldValues[i / 2] = this.value_[i / 2];
        this.value_[i / 2] = value;
      }

      if (!oldValues)
        return false;

      // TODO(rafaelw): Having observed_ as the third callback arg here is
      // pretty lame API. Fix.
      this.report_([this.value_, oldValues, this.observed_]);
      return true;
    }
  });

  function identFn(value) { return value; }

  function ObserverTransform(observable, getValueFn, setValueFn,
                             dontPassThroughSet) {
    this.callback_ = undefined;
    this.target_ = undefined;
    this.value_ = undefined;
    this.observable_ = observable;
    this.getValueFn_ = getValueFn || identFn;
    this.setValueFn_ = setValueFn || identFn;
    // TODO(rafaelw): This is a temporary hack. PolymerExpressions needs this
    // at the moment because of a bug in it'siesta dependency tracking.
    this.dontPassThroughSet_ = dontPassThroughSet;
  }

  ObserverTransform.prototype = {
    open: function(callback, target) {
      this.callback_ = callback;
      this.target_ = target;
      this.value_ =
          this.getValueFn_(this.observable_.open(this.observedCallback_, this));
      return this.value_;
    },

    observedCallback_: function(value) {
      value = this.getValueFn_(value);
      if (areSameValue(value, this.value_))
        return;
      var oldValue = this.value_;
      this.value_ = value;
      this.callback_.call(this.target_, this.value_, oldValue);
    },

    discardChanges: function() {
      this.value_ = this.getValueFn_(this.observable_.discardChanges());
      return this.value_;
    },

    deliver: function() {
      return this.observable_.deliver();
    },

    setValue: function(value) {
      value = this.setValueFn_(value);
      if (!this.dontPassThroughSet_ && this.observable_.setValue)
        return this.observable_.setValue(value);
    },

    close: function() {
      if (this.observable_)
        this.observable_.close();
      this.callback_ = undefined;
      this.target_ = undefined;
      this.observable_ = undefined;
      this.value_ = undefined;
      this.getValueFn_ = undefined;
      this.setValueFn_ = undefined;
    }
  }

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
expose.PathObserver = PathObserver;
expose.CompoundObserver = CompoundObserver;
expose.Path = Path;
expose.ObserverTransform = ObserverTransform;
})(typeof global !== 'undefined' && global && typeof module !== 'undefined' && module ? global : this || window);

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}]},{},[13])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9jb3JlL0FycmFuZ2VkUmVhY3RpdmVRdWVyeS5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2NvcmUvTW9kZWxJbnN0YW5jZS5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2NvcmUvT25lVG9NYW55UHJveHkuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9jb3JlL09uZVRvT25lUHJveHkuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9jb3JlL1F1ZXJ5LmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3QvY29yZS9SZWxhdGlvbnNoaXBQcm94eS5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2NvcmUvUmVsYXRpb25zaGlwVHlwZS5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2NvcmUvY2FjaGUuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9jb3JlL2NvbGxlY3Rpb24uanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9jb3JlL2NvbGxlY3Rpb25SZWdpc3RyeS5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2NvcmUvZXJyb3IuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9jb3JlL2V2ZW50cy5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2NvcmUvaW5kZXguanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9jb3JlL2xvZy5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2NvcmUvbWFueVRvTWFueVByb3h5LmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3QvY29yZS9tYXBwaW5nT3BlcmF0aW9uLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3QvY29yZS9tb2RlbC5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2NvcmUvbW9kZWxFdmVudHMuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9jb3JlL3F1ZXJ5U2V0LmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3QvY29yZS9yZWFjdGl2ZVF1ZXJ5LmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3QvY29yZS9zdG9yZS5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2NvcmUvdXRpbC9hc3luYy5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2NvcmUvdXRpbC9pbmRleC5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2NvcmUvdXRpbC9taXNjLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3QvY29yZS91dGlsL3Byb21pc2UuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9jb3JlL3V0aWwvdW5kZXJzY29yZS5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9ldmVudHMvZXZlbnRzLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3Qvbm9kZV9tb2R1bGVzL2V4dGVuZC9pbmRleC5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L3ZlbmRvci9vYnNlcnZlLWpzL3NyYy9vYnNlcnZlLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25JQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaFVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNSQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hYQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25UQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25OQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25aQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5b0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7OztBQ2hIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pNQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlPQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFNQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNmQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN1FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xSQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdTQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8qKlxuICogU29sdmVzIHRoZSBjb21tb24gcHJvYmxlbSBvZiBtYWludGFpbmluZyB0aGUgb3JkZXIgb2YgYSBzZXQgb2YgYSBtb2RlbHMgYW5kIHF1ZXJ5aW5nIG9uIHRoYXQgb3JkZXIuXG4gKlxuICogVGhlIHNhbWUgYXMgUmVhY3RpdmVRdWVyeSBidXQgZW5hYmxlcyBtYW51YWwgcmVvcmRlcmluZyBvZiBtb2RlbHMgYW5kIG1haW50YWlucyBhbiBpbmRleCBmaWVsZC5cbiAqL1xuXG52YXIgUmVhY3RpdmVRdWVyeSA9IHJlcXVpcmUoJy4vcmVhY3RpdmVRdWVyeScpLFxuICAgIGxvZyA9IHJlcXVpcmUoJy4vbG9nJyksXG4gICAgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpLFxuICAgIGVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpLFxuICAgIEludGVybmFsU2llc3RhRXJyb3IgPSBlcnJvci5JbnRlcm5hbFNpZXN0YUVycm9yLFxuICAgIGNvbnN0cnVjdFF1ZXJ5U2V0ID0gcmVxdWlyZSgnLi9xdWVyeVNldCcpLFxuICAgIGNvbnN0cnVjdEVycm9yID0gZXJyb3IuZXJyb3JGYWN0b3J5KGVycm9yLkNvbXBvbmVudHMuQXJyYW5nZWRSZWFjdGl2ZVF1ZXJ5KSxcbiAgICBfID0gdXRpbC5fO1xuXG5cbnZhciBMb2dnZXIgPSBsb2cubG9nZ2VyV2l0aE5hbWUoJ1F1ZXJ5Jyk7XG5cbmZ1bmN0aW9uIEFycmFuZ2VkUmVhY3RpdmVRdWVyeShxdWVyeSkge1xuICAgIFJlYWN0aXZlUXVlcnkuY2FsbCh0aGlzLCBxdWVyeSk7XG4gICAgdGhpcy5pbmRleEF0dHJpYnV0ZSA9ICdpbmRleCc7XG59XG5cbkFycmFuZ2VkUmVhY3RpdmVRdWVyeS5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKFJlYWN0aXZlUXVlcnkucHJvdG90eXBlKTtcblxuXy5leHRlbmQoQXJyYW5nZWRSZWFjdGl2ZVF1ZXJ5LnByb3RvdHlwZSwge1xuICAgIF9yZWZyZXNoSW5kZXhlczogZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgcmVzdWx0cyA9IHRoaXMucmVzdWx0cyxcbiAgICAgICAgICAgIGluZGV4QXR0cmlidXRlID0gdGhpcy5pbmRleEF0dHJpYnV0ZTtcbiAgICAgICAgaWYgKCFyZXN1bHRzKSB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignQXJyYW5nZWRSZWFjdGl2ZVF1ZXJ5IG11c3QgYmUgaW5pdGlhbGlzZWQnKTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCByZXN1bHRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB2YXIgbW9kZWxJbnN0YW5jZSA9IHJlc3VsdHNbaV07XG4gICAgICAgICAgICBtb2RlbEluc3RhbmNlW2luZGV4QXR0cmlidXRlXSA9IGk7XG4gICAgICAgIH1cbiAgICB9LFxuICAgIF9tZXJnZUluZGV4ZXM6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIHJlc3VsdHMgPSB0aGlzLnJlc3VsdHMsXG4gICAgICAgICAgICBuZXdSZXN1bHRzID0gW10sXG4gICAgICAgICAgICBvdXRPZkJvdW5kcyA9IFtdLFxuICAgICAgICAgICAgdW5pbmRleGVkID0gW107XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcmVzdWx0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdmFyIHJlcyA9IHJlc3VsdHNbaV0sXG4gICAgICAgICAgICAgICAgc3RvcmVkSW5kZXggPSByZXNbdGhpcy5pbmRleEF0dHJpYnV0ZV07XG4gICAgICAgICAgICBpZiAoc3RvcmVkSW5kZXggPT0gdW5kZWZpbmVkKSB7IC8vIG51bGwgb3IgdW5kZWZpbmVkXG4gICAgICAgICAgICAgICAgdW5pbmRleGVkLnB1c2gocmVzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKHN0b3JlZEluZGV4ID4gcmVzdWx0cy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICBvdXRPZkJvdW5kcy5wdXNoKHJlcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBIYW5kbGUgZHVwbGljYXRlIGluZGV4ZXNcbiAgICAgICAgICAgICAgICBpZiAoIW5ld1Jlc3VsdHNbc3RvcmVkSW5kZXhdKSB7XG4gICAgICAgICAgICAgICAgICAgIG5ld1Jlc3VsdHNbc3RvcmVkSW5kZXhdID0gcmVzO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdW5pbmRleGVkLnB1c2gocmVzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgb3V0T2ZCb3VuZHMgPSBfLnNvcnRCeShvdXRPZkJvdW5kcywgZnVuY3Rpb24gKHgpIHtcbiAgICAgICAgICAgIHJldHVybiB4W3RoaXMuaW5kZXhBdHRyaWJ1dGVdO1xuICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICAvLyBTaGlmdCB0aGUgaW5kZXggb2YgYWxsIG1vZGVscyB3aXRoIGluZGV4ZXMgb3V0IG9mIGJvdW5kcyBpbnRvIHRoZSBjb3JyZWN0IHJhbmdlLlxuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgb3V0T2ZCb3VuZHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHJlcyA9IG91dE9mQm91bmRzW2ldO1xuICAgICAgICAgICAgdmFyIHJlc3VsdHNJbmRleCA9IHRoaXMucmVzdWx0cy5sZW5ndGggLSBvdXRPZkJvdW5kcy5sZW5ndGggKyBpO1xuICAgICAgICAgICAgcmVzW3RoaXMuaW5kZXhBdHRyaWJ1dGVdID0gcmVzdWx0c0luZGV4O1xuICAgICAgICAgICAgbmV3UmVzdWx0c1tyZXN1bHRzSW5kZXhdID0gcmVzO1xuICAgICAgICB9XG4gICAgICAgIHVuaW5kZXhlZCA9IHRoaXMuX3F1ZXJ5Ll9zb3J0UmVzdWx0cyh1bmluZGV4ZWQpO1xuICAgICAgICB2YXIgbiA9IDA7XG4gICAgICAgIHdoaWxlICh1bmluZGV4ZWQubGVuZ3RoKSB7XG4gICAgICAgICAgICByZXMgPSB1bmluZGV4ZWQuc2hpZnQoKTtcbiAgICAgICAgICAgIHdoaWxlIChuZXdSZXN1bHRzW25dKSB7XG4gICAgICAgICAgICAgICAgbisrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbmV3UmVzdWx0c1tuXSA9IHJlcztcbiAgICAgICAgICAgIHJlc1t0aGlzLmluZGV4QXR0cmlidXRlXSA9IG47XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnJlc3VsdHMgPSBjb25zdHJ1Y3RRdWVyeVNldChuZXdSZXN1bHRzLCB0aGlzLm1vZGVsKTtcbiAgICB9LFxuICAgIGluaXQ6IGZ1bmN0aW9uIChjYikge1xuICAgICAgICB2YXIgZGVmZXJyZWQgPSB1dGlsLmRlZmVyKGNiKTtcbiAgICAgICAgUmVhY3RpdmVRdWVyeS5wcm90b3R5cGUuaW5pdC5jYWxsKHRoaXMsIGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgICAgICAgaWYgKCF0aGlzLm1vZGVsLmhhc0F0dHJpYnV0ZU5hbWVkKHRoaXMuaW5kZXhBdHRyaWJ1dGUpKSB7XG4gICAgICAgICAgICAgICAgICAgIGVyciA9IGNvbnN0cnVjdEVycm9yKCdNb2RlbCBcIicgKyB0aGlzLm1vZGVsLm5hbWUgKyAnXCIgZG9lcyBub3QgaGF2ZSBhbiBhdHRyaWJ1dGUgbmFtZWQgXCInICsgdGhpcy5pbmRleEF0dHJpYnV0ZSArICdcIicpXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9tZXJnZUluZGV4ZXMoKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fcXVlcnkuY2xlYXJPcmRlcmluZygpO1xuICAgICAgICAgICAgICAgIH0gXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBkZWZlcnJlZC5maW5pc2goZXJyLCBlcnIgPyBudWxsIDogdGhpcy5yZXN1bHRzKTtcbiAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG4gICAgfSxcbiAgICBfaGFuZGxlTm90aWY6IGZ1bmN0aW9uIChuKSB7XG4gICAgICAgIC8vIFdlIGRvbid0IHdhbnQgdG8ga2VlcCBleGVjdXRpbmcgdGhlIHF1ZXJ5IGVhY2ggdGltZSB0aGUgaW5kZXggZXZlbnQgZmlyZXMgYXMgd2UncmUgY2hhbmdpbmcgdGhlIGluZGV4IG91cnNlbHZlc1xuICAgICAgICBpZiAobi5maWVsZCAhPSB0aGlzLmluZGV4QXR0cmlidXRlKSB7XG4gICAgICAgICAgICBSZWFjdGl2ZVF1ZXJ5LnByb3RvdHlwZS5faGFuZGxlTm90aWYuY2FsbCh0aGlzLCBuKTtcbiAgICAgICAgICAgIHRoaXMuX3JlZnJlc2hJbmRleGVzKCk7XG4gICAgICAgIH1cbiAgICB9LFxuICAgIHZhbGlkYXRlSW5kZXg6IGZ1bmN0aW9uIChpZHgpIHtcbiAgICAgICAgdmFyIG1heEluZGV4ID0gdGhpcy5yZXN1bHRzLmxlbmd0aCAtIDEsXG4gICAgICAgICAgICBtaW5JbmRleCA9IDA7XG4gICAgICAgIGlmICghKGlkeCA+PSBtaW5JbmRleCAmJiBpZHggPD0gbWF4SW5kZXgpKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0luZGV4ICcgKyBpZHgudG9TdHJpbmcoKSArICcgaXMgb3V0IG9mIGJvdW5kcycpO1xuICAgICAgICB9XG4gICAgfSxcbiAgICBzd2FwT2JqZWN0c0F0SW5kZXhlczogZnVuY3Rpb24gKGZyb20sIHRvKSB7XG4gICAgICAgIC8vbm9pbnNwZWN0aW9uIFVubmVjZXNzYXJ5TG9jYWxWYXJpYWJsZUpTXG4gICAgICAgIHRoaXMudmFsaWRhdGVJbmRleChmcm9tKTtcbiAgICAgICAgdGhpcy52YWxpZGF0ZUluZGV4KHRvKTtcbiAgICAgICAgdmFyIGZyb21Nb2RlbCA9IHRoaXMucmVzdWx0c1tmcm9tXSxcbiAgICAgICAgICAgIHRvTW9kZWwgPSB0aGlzLnJlc3VsdHNbdG9dO1xuICAgICAgICBpZiAoIWZyb21Nb2RlbCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdObyBtb2RlbCBhdCBpbmRleCBcIicgKyBmcm9tLnRvU3RyaW5nKCkgKyAnXCInKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIXRvTW9kZWwpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignTm8gbW9kZWwgYXQgaW5kZXggXCInICsgdG8udG9TdHJpbmcoKSArICdcIicpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMucmVzdWx0c1t0b10gPSBmcm9tTW9kZWw7XG4gICAgICAgIHRoaXMucmVzdWx0c1tmcm9tXSA9IHRvTW9kZWw7XG4gICAgICAgIGZyb21Nb2RlbFt0aGlzLmluZGV4QXR0cmlidXRlXSA9IHRvO1xuICAgICAgICB0b01vZGVsW3RoaXMuaW5kZXhBdHRyaWJ1dGVdID0gZnJvbTtcbiAgICB9LFxuICAgIHN3YXBPYmplY3RzOiBmdW5jdGlvbiAob2JqMSwgb2JqMikge1xuICAgICAgICB2YXIgZnJvbUlkeCA9IHRoaXMucmVzdWx0cy5pbmRleE9mKG9iajEpLFxuICAgICAgICAgICAgdG9JZHggPSB0aGlzLnJlc3VsdHMuaW5kZXhPZihvYmoyKTtcbiAgICAgICAgdGhpcy5zd2FwT2JqZWN0c0F0SW5kZXhlcyhmcm9tSWR4LCB0b0lkeCk7XG4gICAgfSxcbiAgICBtb3ZlOiBmdW5jdGlvbiAoZnJvbSwgdG8pIHtcbiAgICAgICAgdGhpcy52YWxpZGF0ZUluZGV4KGZyb20pO1xuICAgICAgICB0aGlzLnZhbGlkYXRlSW5kZXgodG8pO1xuICAgICAgICB2YXIgcmVzdWx0cyA9IHRoaXMucmVzdWx0cy5tdXRhYmxlQ29weSgpO1xuICAgICAgICAoZnVuY3Rpb24gKG9sZEluZGV4LCBuZXdJbmRleCkge1xuICAgICAgICAgICAgaWYgKG5ld0luZGV4ID49IHRoaXMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgdmFyIGsgPSBuZXdJbmRleCAtIHRoaXMubGVuZ3RoO1xuICAgICAgICAgICAgICAgIHdoaWxlICgoay0tKSArIDEpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5wdXNoKHVuZGVmaW5lZCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5zcGxpY2UobmV3SW5kZXgsIDAsIHRoaXMuc3BsaWNlKG9sZEluZGV4LCAxKVswXSk7XG4gICAgICAgIH0pLmNhbGwocmVzdWx0cywgZnJvbSwgdG8pO1xuICAgICAgICB0aGlzLnJlc3VsdHMgPSByZXN1bHRzLmFzTW9kZWxRdWVyeVNldCh0aGlzLm1vZGVsKTtcbiAgICAgICAgdGhpcy5fcmVmcmVzaEluZGV4ZXMoKTtcbiAgICB9XG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBBcnJhbmdlZFJlYWN0aXZlUXVlcnk7IiwidmFyIGxvZyA9IHJlcXVpcmUoJy4vbG9nJyksXG4gICAgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpLFxuICAgIF8gPSB1dGlsLl8sXG4gICAgZXJyb3IgPSByZXF1aXJlKCcuL2Vycm9yJyksXG4gICAgSW50ZXJuYWxTaWVzdGFFcnJvciA9IGVycm9yLkludGVybmFsU2llc3RhRXJyb3IsXG4gICAgbW9kZWxFdmVudHMgPSByZXF1aXJlKCcuL21vZGVsRXZlbnRzJyksXG4gICAgZXZlbnRzID0gcmVxdWlyZSgnLi9ldmVudHMnKSxcbiAgICBjYWNoZSA9IHJlcXVpcmUoJy4vY2FjaGUnKTtcblxuZnVuY3Rpb24gTW9kZWxJbnN0YW5jZShtb2RlbCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB0aGlzLm1vZGVsID0gbW9kZWw7XG5cbiAgICB1dGlsLnN1YlByb3BlcnRpZXModGhpcywgdGhpcy5tb2RlbCwgW1xuICAgICAgICAnY29sbGVjdGlvbicsXG4gICAgICAgICdjb2xsZWN0aW9uTmFtZScsXG4gICAgICAgICdfYXR0cmlidXRlTmFtZXMnLFxuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAnaWRGaWVsZCcsXG4gICAgICAgICAgICBwcm9wZXJ0eTogJ2lkJ1xuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAnbW9kZWxOYW1lJyxcbiAgICAgICAgICAgIHByb3BlcnR5OiAnbmFtZSdcbiAgICAgICAgfVxuICAgIF0pO1xuXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnRpZXModGhpcywge1xuICAgICAgICBfcmVsYXRpb25zaGlwTmFtZXM6IHtcbiAgICAgICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHZhciBwcm94aWVzID0gXy5tYXAoT2JqZWN0LmtleXMoc2VsZi5fX3Byb3hpZXMgfHwge30pLCBmdW5jdGlvbiAoeCkge3JldHVybiBzZWxmLl9fcHJveGllc1t4XX0pO1xuICAgICAgICAgICAgICAgIHJldHVybiBfLm1hcChwcm94aWVzLCBmdW5jdGlvbiAocCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAocC5pc0ZvcndhcmQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBwLmZvcndhcmROYW1lO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHAucmV2ZXJzZU5hbWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgICAgIH0sXG4gICAgICAgIGRpcnR5OiB7XG4gICAgICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBpZiAoc2llc3RhLmV4dC5zdG9yYWdlRW5hYmxlZCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gc2VsZi5faWQgaW4gc2llc3RhLmV4dC5zdG9yYWdlLl91bnNhdmVkT2JqZWN0c0hhc2g7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2UgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlXG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIHRoaXMucmVtb3ZlZCA9IGZhbHNlO1xufVxuXG5cbl8uZXh0ZW5kKE1vZGVsSW5zdGFuY2UucHJvdG90eXBlLCB7XG4gICAgZ2V0OiBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICAgICAgdmFyIGRlZmVycmVkID0gdXRpbC5kZWZlcihjYWxsYmFjayk7XG4gICAgICAgIGNhbGxiYWNrID0gZGVmZXJyZWQuZmluaXNoLmJpbmQoZGVmZXJyZWQpO1xuICAgICAgICBjYWxsYmFjayhudWxsLCB0aGlzKTtcbiAgICAgICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG4gICAgfSxcbiAgICByZW1vdmU6IGZ1bmN0aW9uIChjYWxsYmFjaywgbm90aWZpY2F0aW9uKSB7XG4gICAgICAgIG5vdGlmaWNhdGlvbiA9IG5vdGlmaWNhdGlvbiA9PSBudWxsID8gdHJ1ZSA6IG5vdGlmaWNhdGlvbjtcbiAgICAgICAgdmFyIGRlZmVycmVkID0gdXRpbC5kZWZlcihjYWxsYmFjayk7XG4gICAgICAgIGNhbGxiYWNrID0gZGVmZXJyZWQuZmluaXNoLmJpbmQoZGVmZXJyZWQpO1xuICAgICAgICBjYWNoZS5yZW1vdmUodGhpcyk7XG4gICAgICAgIHRoaXMucmVtb3ZlZCA9IHRydWU7XG4gICAgICAgIGlmIChub3RpZmljYXRpb24pIHtcbiAgICAgICAgICAgIG1vZGVsRXZlbnRzLmVtaXQoe1xuICAgICAgICAgICAgICAgIGNvbGxlY3Rpb246IHRoaXMuY29sbGVjdGlvbk5hbWUsXG4gICAgICAgICAgICAgICAgbW9kZWw6IHRoaXMubW9kZWwubmFtZSxcbiAgICAgICAgICAgICAgICBfaWQ6IHRoaXMuX2lkLFxuICAgICAgICAgICAgICAgIG9sZDogdGhpcyxcbiAgICAgICAgICAgICAgICB0eXBlOiBtb2RlbEV2ZW50cy5Nb2RlbEV2ZW50VHlwZS5SZW1vdmUsXG4gICAgICAgICAgICAgICAgb2JqOiB0aGlzXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgcmVtb3ZlID0gdGhpcy5tb2RlbC5yZW1vdmU7XG4gICAgICAgIGlmIChyZW1vdmUpIHtcbiAgICAgICAgICAgIHZhciBwYXJhbU5hbWVzID0gdXRpbC5wYXJhbU5hbWVzKHJlbW92ZSk7XG4gICAgICAgICAgICBpZiAocGFyYW1OYW1lcy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgICAgICAgICAgcmVtb3ZlLmNhbGwodGhpcywgZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIsIHNlbGYpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgcmVtb3ZlLmNhbGwodGhpcyk7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2sobnVsbCwgdGhpcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBjYWxsYmFjayhudWxsLCB0aGlzKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbiAgICB9LFxuICAgIHJlc3RvcmU6IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgICAgICB2YXIgZGVmZXJyZWQgPSB1dGlsLmRlZmVyKGNhbGxiYWNrKTtcbiAgICAgICAgY2FsbGJhY2sgPSBkZWZlcnJlZC5maW5pc2guYmluZChkZWZlcnJlZCk7XG4gICAgICAgIHZhciBfZmluaXNoID0gZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgICAgICBtb2RlbEV2ZW50cy5lbWl0KHtcbiAgICAgICAgICAgICAgICAgICAgY29sbGVjdGlvbjogdGhpcy5jb2xsZWN0aW9uTmFtZSxcbiAgICAgICAgICAgICAgICAgICAgbW9kZWw6IHRoaXMubW9kZWwubmFtZSxcbiAgICAgICAgICAgICAgICAgICAgX2lkOiB0aGlzLl9pZCxcbiAgICAgICAgICAgICAgICAgICAgbmV3OiB0aGlzLFxuICAgICAgICAgICAgICAgICAgICB0eXBlOiBtb2RlbEV2ZW50cy5Nb2RlbEV2ZW50VHlwZS5OZXcsXG4gICAgICAgICAgICAgICAgICAgIG9iajogdGhpc1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2FsbGJhY2soZXJyLCB0aGlzKTtcbiAgICAgICAgfS5iaW5kKHRoaXMpO1xuICAgICAgICBpZiAodGhpcy5yZW1vdmVkKSB7XG4gICAgICAgICAgICBjYWNoZS5pbnNlcnQodGhpcyk7XG4gICAgICAgICAgICB0aGlzLnJlbW92ZWQgPSBmYWxzZTtcbiAgICAgICAgICAgIHZhciBpbml0ID0gdGhpcy5tb2RlbC5pbml0O1xuICAgICAgICAgICAgaWYgKGluaXQpIHtcbiAgICAgICAgICAgICAgICB2YXIgcGFyYW1OYW1lcyA9IHV0aWwucGFyYW1OYW1lcyhpbml0KTtcbiAgICAgICAgICAgICAgICBpZiAocGFyYW1OYW1lcy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgaW5pdC5jYWxsKHRoaXMsIF9maW5pc2gpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgaW5pdC5jYWxsKHRoaXMpO1xuICAgICAgICAgICAgICAgICAgICBfZmluaXNoKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgX2ZpbmlzaCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xuICAgIH1cbn0pO1xuXG5fLmV4dGVuZChNb2RlbEluc3RhbmNlLnByb3RvdHlwZSwge1xuICAgIGxpc3RlbjogZnVuY3Rpb24gKGZuKSB7XG4gICAgICAgIGV2ZW50cy5vbih0aGlzLl9pZCwgZm4pO1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdGhpcy5yZW1vdmVMaXN0ZW5lcihmbik7XG4gICAgICAgIH0uYmluZCh0aGlzKTtcbiAgICB9LFxuICAgIGxpc3Rlbk9uY2U6IGZ1bmN0aW9uIChmbikge1xuICAgICAgICByZXR1cm4gZXZlbnRzLm9uY2UodGhpcy5faWQsIGZuKTtcbiAgICB9LFxuICAgIHJlbW92ZUxpc3RlbmVyOiBmdW5jdGlvbiAoZm4pIHtcbiAgICAgICAgcmV0dXJuIGV2ZW50cy5yZW1vdmVMaXN0ZW5lcih0aGlzLl9pZCwgZm4pO1xuICAgIH1cbn0pO1xuXG4vLyBJbnNwZWN0aW9uXG5fLmV4dGVuZChNb2RlbEluc3RhbmNlLnByb3RvdHlwZSwge1xuICAgIGdldEF0dHJpYnV0ZXM6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIF8uZXh0ZW5kKHt9LCB0aGlzLl9fdmFsdWVzKTtcbiAgICB9LFxuICAgIGlzSW5zdGFuY2VPZjogZnVuY3Rpb24gKG1vZGVsKSB7XG4gICAgICAgIHJldHVybiB0aGlzLm1vZGVsID09IG1vZGVsO1xuICAgIH0sXG4gICAgaXNBOiBmdW5jdGlvbiAobW9kZWwpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMubW9kZWwgPT0gbW9kZWwgfHwgdGhpcy5tb2RlbC5pc0Rlc2NlbmRhbnRPZihtb2RlbCk7XG4gICAgfVxufSk7XG5cbi8vIER1bXBcbl8uZXh0ZW5kKE1vZGVsSW5zdGFuY2UucHJvdG90eXBlLCB7XG4gICAgX2R1bXBTdHJpbmc6IGZ1bmN0aW9uIChyZXZlcnNlUmVsYXRpb25zaGlwcykge1xuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkodGhpcy5fZHVtcChyZXZlcnNlUmVsYXRpb25zaGlwcywgbnVsbCwgNCkpO1xuICAgIH0sXG4gICAgX2R1bXA6IGZ1bmN0aW9uIChyZXZlcnNlUmVsYXRpb25zaGlwcykge1xuICAgICAgICB2YXIgZHVtcGVkID0gXy5leHRlbmQoe30sIHRoaXMuX192YWx1ZXMpO1xuICAgICAgICBkdW1wZWQuX3JldiA9IHRoaXMuX3JldjtcbiAgICAgICAgZHVtcGVkLl9pZCA9IHRoaXMuX2lkO1xuICAgICAgICByZXR1cm4gZHVtcGVkO1xuICAgIH1cbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IE1vZGVsSW5zdGFuY2U7XG5cbiIsIi8qKlxuICogQG1vZHVsZSByZWxhdGlvbnNoaXBzXG4gKi9cblxudmFyIFJlbGF0aW9uc2hpcFByb3h5ID0gcmVxdWlyZSgnLi9SZWxhdGlvbnNoaXBQcm94eScpLFxuICAgIFN0b3JlID0gcmVxdWlyZSgnLi9zdG9yZScpLFxuICAgIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKSxcbiAgICBfID0gdXRpbC5fLFxuICAgIEludGVybmFsU2llc3RhRXJyb3IgPSByZXF1aXJlKCcuL2Vycm9yJykuSW50ZXJuYWxTaWVzdGFFcnJvcixcbiAgICBtb2RlbEV2ZW50cyA9IHJlcXVpcmUoJy4vbW9kZWxFdmVudHMnKSxcbiAgICBTaWVzdGFNb2RlbCA9IHJlcXVpcmUoJy4vbW9kZWxJbnN0YW5jZScpLFxuICAgIGV2ZW50cyA9IHJlcXVpcmUoJy4vZXZlbnRzJyksXG4gICAgd3JhcEFycmF5Rm9yQXR0cmlidXRlcyA9IGV2ZW50cy53cmFwQXJyYXksXG4gICAgQXJyYXlPYnNlcnZlciA9IHJlcXVpcmUoJy4uL3ZlbmRvci9vYnNlcnZlLWpzL3NyYy9vYnNlcnZlJykuQXJyYXlPYnNlcnZlcixcbiAgICBNb2RlbEV2ZW50VHlwZSA9IHJlcXVpcmUoJy4vbW9kZWxFdmVudHMnKS5Nb2RlbEV2ZW50VHlwZTtcblxuLyoqXG4gKiBAY2xhc3MgIFtPbmVUb01hbnlQcm94eSBkZXNjcmlwdGlvbl1cbiAqIEBjb25zdHJ1Y3RvclxuICogQHBhcmFtIHtbdHlwZV19IG9wdHNcbiAqL1xuZnVuY3Rpb24gT25lVG9NYW55UHJveHkob3B0cykge1xuICAgIFJlbGF0aW9uc2hpcFByb3h5LmNhbGwodGhpcywgb3B0cyk7XG4gICAgaWYgKHRoaXMuaXNSZXZlcnNlKSB0aGlzLnJlbGF0ZWQgPSBbXTtcbn1cblxuT25lVG9NYW55UHJveHkucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShSZWxhdGlvbnNoaXBQcm94eS5wcm90b3R5cGUpO1xuXG5fLmV4dGVuZChPbmVUb01hbnlQcm94eS5wcm90b3R5cGUsIHtcbiAgICBjbGVhclJldmVyc2U6IGZ1bmN0aW9uIChyZW1vdmVkKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgXy5lYWNoKHJlbW92ZWQsIGZ1bmN0aW9uIChyZW1vdmVkT2JqZWN0KSB7XG4gICAgICAgICAgICB2YXIgcmV2ZXJzZVByb3h5ID0gc2VsZi5yZXZlcnNlUHJveHlGb3JJbnN0YW5jZShyZW1vdmVkT2JqZWN0KTtcbiAgICAgICAgICAgIHJldmVyc2VQcm94eS5zZXRJZEFuZFJlbGF0ZWQobnVsbCk7XG4gICAgICAgIH0pO1xuICAgIH0sXG4gICAgc2V0UmV2ZXJzZU9mQWRkZWQ6IGZ1bmN0aW9uIChhZGRlZCkge1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgIF8uZWFjaChhZGRlZCwgZnVuY3Rpb24gKGFkZGVkKSB7XG4gICAgICAgICAgICB2YXIgZm9yd2FyZFByb3h5ID0gc2VsZi5yZXZlcnNlUHJveHlGb3JJbnN0YW5jZShhZGRlZCk7XG4gICAgICAgICAgICBmb3J3YXJkUHJveHkuc2V0SWRBbmRSZWxhdGVkKHNlbGYub2JqZWN0KTtcbiAgICAgICAgfSk7XG4gICAgfSxcbiAgICB3cmFwQXJyYXk6IGZ1bmN0aW9uIChhcnIpIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICB3cmFwQXJyYXlGb3JBdHRyaWJ1dGVzKGFyciwgdGhpcy5yZXZlcnNlTmFtZSwgdGhpcy5vYmplY3QpO1xuICAgICAgICBpZiAoIWFyci5hcnJheU9ic2VydmVyKSB7XG4gICAgICAgICAgICBhcnIuYXJyYXlPYnNlcnZlciA9IG5ldyBBcnJheU9ic2VydmVyKGFycik7XG4gICAgICAgICAgICB2YXIgb2JzZXJ2ZXJGdW5jdGlvbiA9IGZ1bmN0aW9uIChzcGxpY2VzKSB7XG4gICAgICAgICAgICAgICAgc3BsaWNlcy5mb3JFYWNoKGZ1bmN0aW9uIChzcGxpY2UpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGFkZGVkID0gc3BsaWNlLmFkZGVkQ291bnQgPyBhcnIuc2xpY2Uoc3BsaWNlLmluZGV4LCBzcGxpY2UuaW5kZXggKyBzcGxpY2UuYWRkZWRDb3VudCkgOiBbXTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHJlbW92ZWQgPSBzcGxpY2UucmVtb3ZlZDtcbiAgICAgICAgICAgICAgICAgICAgc2VsZi5jbGVhclJldmVyc2UocmVtb3ZlZCk7XG4gICAgICAgICAgICAgICAgICAgIHNlbGYuc2V0UmV2ZXJzZU9mQWRkZWQoYWRkZWQpO1xuICAgICAgICAgICAgICAgICAgICB2YXIgbW9kZWwgPSBzZWxmLmdldEZvcndhcmRNb2RlbCgpO1xuICAgICAgICAgICAgICAgICAgICBtb2RlbEV2ZW50cy5lbWl0KHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbGxlY3Rpb246IG1vZGVsLmNvbGxlY3Rpb25OYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgbW9kZWw6IG1vZGVsLm5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBfaWQ6IHNlbGYub2JqZWN0Ll9pZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGZpZWxkOiBzZWxmLmdldEZvcndhcmROYW1lKCksXG4gICAgICAgICAgICAgICAgICAgICAgICByZW1vdmVkOiByZW1vdmVkLFxuICAgICAgICAgICAgICAgICAgICAgICAgYWRkZWQ6IGFkZGVkLFxuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogTW9kZWxFdmVudFR5cGUuU3BsaWNlLFxuICAgICAgICAgICAgICAgICAgICAgICAgaW5kZXg6IHNwbGljZS5pbmRleCxcbiAgICAgICAgICAgICAgICAgICAgICAgIG9iajogc2VsZi5vYmplY3RcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgYXJyLmFycmF5T2JzZXJ2ZXIub3BlbihvYnNlcnZlckZ1bmN0aW9uKTtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgZ2V0OiBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICAgICAgdmFyIGRlZmVycmVkID0gdXRpbC5kZWZlcihjYWxsYmFjayk7XG4gICAgICAgIGNhbGxiYWNrID0gZGVmZXJyZWQuZmluaXNoLmJpbmQoZGVmZXJyZWQpO1xuICAgICAgICBjYWxsYmFjayhudWxsLCB0aGlzLnJlbGF0ZWQpO1xuICAgICAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIFZhbGlkYXRlIHRoZSBvYmplY3QgdGhhdCB3ZSdyZSBzZXR0aW5nXG4gICAgICogQHBhcmFtIG9ialxuICAgICAqIEByZXR1cm5zIHtzdHJpbmd8bnVsbH0gQW4gZXJyb3IgbWVzc2FnZSBvciBudWxsXG4gICAgICogQGNsYXNzIE9uZVRvTWFueVByb3h5XG4gICAgICovXG4gICAgdmFsaWRhdGU6IGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgdmFyIHN0ciA9IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChvYmopO1xuICAgICAgICBpZiAodGhpcy5pc0ZvcndhcmQpIHtcbiAgICAgICAgICAgIGlmIChzdHIgPT0gJ1tvYmplY3QgQXJyYXldJykge1xuICAgICAgICAgICAgICAgIHJldHVybiAnQ2Fubm90IGFzc2lnbiBhcnJheSBmb3J3YXJkIG9uZVRvTWFueSAoJyArIHN0ciArICcpOiAnICsgdGhpcy5mb3J3YXJkTmFtZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGlmIChzdHIgIT0gJ1tvYmplY3QgQXJyYXldJykge1xuICAgICAgICAgICAgICAgIHJldHVybiAnQ2Fubm90IHNjYWxhciB0byByZXZlcnNlIG9uZVRvTWFueSAoJyArIHN0ciArICcpOiAnICsgdGhpcy5yZXZlcnNlTmFtZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24gKG9iaiwgb3B0cykge1xuICAgICAgICB0aGlzLmNoZWNrSW5zdGFsbGVkKCk7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgaWYgKG9iaikge1xuICAgICAgICAgICAgdmFyIGVycm9yTWVzc2FnZTtcbiAgICAgICAgICAgIGlmIChlcnJvck1lc3NhZ2UgPSB0aGlzLnZhbGlkYXRlKG9iaikpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZXJyb3JNZXNzYWdlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5jbGVhclJldmVyc2VSZWxhdGVkKG9wdHMpO1xuICAgICAgICAgICAgICAgIHNlbGYuc2V0SWRBbmRSZWxhdGVkKG9iaiwgb3B0cyk7XG4gICAgICAgICAgICAgICAgaWYgKHNlbGYuaXNSZXZlcnNlKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMud3JhcEFycmF5KHNlbGYucmVsYXRlZCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHNlbGYuc2V0SWRBbmRSZWxhdGVkUmV2ZXJzZShvYmosIG9wdHMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5jbGVhclJldmVyc2VSZWxhdGVkKG9wdHMpO1xuICAgICAgICAgICAgc2VsZi5zZXRJZEFuZFJlbGF0ZWQob2JqLCBvcHRzKTtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgaW5zdGFsbDogZnVuY3Rpb24gKG9iaikge1xuICAgICAgICBSZWxhdGlvbnNoaXBQcm94eS5wcm90b3R5cGUuaW5zdGFsbC5jYWxsKHRoaXMsIG9iaik7XG5cbiAgICAgICAgaWYgKHRoaXMuaXNSZXZlcnNlKSB7XG4gICAgICAgICAgICBvYmpbKCdzcGxpY2UnICsgdXRpbC5jYXBpdGFsaXNlRmlyc3RMZXR0ZXIodGhpcy5yZXZlcnNlTmFtZSkpXSA9IF8uYmluZCh0aGlzLnNwbGljZSwgdGhpcyk7XG4gICAgICAgICAgICB0aGlzLndyYXBBcnJheSh0aGlzLnJlbGF0ZWQpO1xuICAgICAgICB9XG5cbiAgICB9XG59KTtcblxuXG5tb2R1bGUuZXhwb3J0cyA9IE9uZVRvTWFueVByb3h5OyIsIi8qKlxuICogQG1vZHVsZSByZWxhdGlvbnNoaXBzXG4gKi9cblxudmFyIFJlbGF0aW9uc2hpcFByb3h5ID0gcmVxdWlyZSgnLi9SZWxhdGlvbnNoaXBQcm94eScpLFxuICAgIFN0b3JlID0gcmVxdWlyZSgnLi9zdG9yZScpLFxuICAgIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKSxcbiAgICBJbnRlcm5hbFNpZXN0YUVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpLkludGVybmFsU2llc3RhRXJyb3IsXG4gICAgTW9kZWxFdmVudFR5cGUgPSByZXF1aXJlKCcuL21vZGVsRXZlbnRzJykuTW9kZWxFdmVudFR5cGUsXG4gICAgU2llc3RhTW9kZWwgPSByZXF1aXJlKCcuL21vZGVsSW5zdGFuY2UnKTtcblxuLyoqXG4gKiBbT25lVG9PbmVQcm94eSBkZXNjcmlwdGlvbl1cbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRzXG4gKi9cbmZ1bmN0aW9uIE9uZVRvT25lUHJveHkob3B0cykge1xuICAgIFJlbGF0aW9uc2hpcFByb3h5LmNhbGwodGhpcywgb3B0cyk7XG59XG5cblxuT25lVG9PbmVQcm94eS5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKFJlbGF0aW9uc2hpcFByb3h5LnByb3RvdHlwZSk7XG5cbl8uZXh0ZW5kKE9uZVRvT25lUHJveHkucHJvdG90eXBlLCB7XG4gICAgLyoqXG4gICAgICogVmFsaWRhdGUgdGhlIG9iamVjdCB0aGF0IHdlJ3JlIHNldHRpbmdcbiAgICAgKiBAcGFyYW0gb2JqXG4gICAgICogQHJldHVybnMge3N0cmluZ3xudWxsfSBBbiBlcnJvciBtZXNzYWdlIG9yIG51bGxcbiAgICAgKi9cbiAgICB2YWxpZGF0ZTogZnVuY3Rpb24gKG9iaikge1xuICAgICAgICBpZiAoT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKG9iaikgPT0gJ1tvYmplY3QgQXJyYXldJykge1xuICAgICAgICAgICAgcmV0dXJuICdDYW5ub3QgYXNzaWduIGFycmF5IHRvIG9uZSB0byBvbmUgcmVsYXRpb25zaGlwJztcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmICgoIW9iaiBpbnN0YW5jZW9mIFNpZXN0YU1vZGVsKSkge1xuXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uIChvYmosIG9wdHMpIHtcbiAgICAgICAgY29uc29sZS5sb2coJ3JlbGF0ZWQnLCB0aGlzLm9iamVjdCwgdGhpcy5yZWxhdGVkKTtcbiAgICAgICAgY29uc29sZS5sb2coJ3NldCcsIHRoaXMub2JqZWN0LCBvYmopO1xuICAgICAgICB0aGlzLmNoZWNrSW5zdGFsbGVkKCk7XG4gICAgICAgIGlmIChvYmopIHtcbiAgICAgICAgICAgIHZhciBlcnJvck1lc3NhZ2U7XG4gICAgICAgICAgICBpZiAoZXJyb3JNZXNzYWdlID0gdGhpcy52YWxpZGF0ZShvYmopKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGVycm9yTWVzc2FnZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuY2xlYXJSZXZlcnNlUmVsYXRlZChvcHRzKTtcbiAgICAgICAgICAgICAgICB0aGlzLnNldElkQW5kUmVsYXRlZChvYmosIG9wdHMpO1xuICAgICAgICAgICAgICAgIHRoaXMuc2V0SWRBbmRSZWxhdGVkUmV2ZXJzZShvYmosIG9wdHMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5jbGVhclJldmVyc2VSZWxhdGVkKG9wdHMpO1xuICAgICAgICAgICAgdGhpcy5zZXRJZEFuZFJlbGF0ZWQob2JqLCBvcHRzKTtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgZ2V0OiBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICAgICAgdmFyIGRlZmVycmVkID0gdXRpbC5kZWZlcihjYWxsYmFjayk7XG4gICAgICAgIGNhbGxiYWNrID0gZGVmZXJyZWQuZmluaXNoLmJpbmQoZGVmZXJyZWQpO1xuICAgICAgICBjYWxsYmFjayhudWxsLCB0aGlzLnJlbGF0ZWQpO1xuICAgICAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbiAgICB9XG59KTtcblxuXG5tb2R1bGUuZXhwb3J0cyA9IE9uZVRvT25lUHJveHk7IiwiLyoqXG4gKiBAbW9kdWxlIHF1ZXJ5XG4gKi9cblxudmFyIGxvZyA9IHJlcXVpcmUoJy4vbG9nJyksXG4gICAgY2FjaGUgPSByZXF1aXJlKCcuL2NhY2hlJyksXG4gICAgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpLFxuICAgIGVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpLFxuICAgIGNvbnN0cnVjdFF1ZXJ5U2V0ID0gcmVxdWlyZSgnLi9xdWVyeVNldCcpLFxuICAgIGNvbnN0cnVjdEVycm9yID0gZXJyb3IuZXJyb3JGYWN0b3J5KGVycm9yLkNvbXBvbmVudHMuUXVlcnkpLFxuICAgIF8gPSB1dGlsLl87XG5cbnZhciBMb2dnZXIgPSBsb2cubG9nZ2VyV2l0aE5hbWUoJ1F1ZXJ5Jyk7XG5cbi8qKlxuICogQGNsYXNzIFtRdWVyeSBkZXNjcmlwdGlvbl1cbiAqIEBwYXJhbSB7TW9kZWx9IG1vZGVsXG4gKiBAcGFyYW0ge09iamVjdH0gcXVlcnlcbiAqL1xuZnVuY3Rpb24gUXVlcnkobW9kZWwsIHF1ZXJ5KSB7XG4gICAgdmFyIG9wdHMgPSB7fTtcbiAgICBmb3IgKHZhciBwcm9wIGluIHF1ZXJ5KSB7XG4gICAgICAgIGlmIChxdWVyeS5oYXNPd25Qcm9wZXJ0eShwcm9wKSkge1xuICAgICAgICAgICAgaWYgKHByb3Auc2xpY2UoMCwgMikgPT0gJ19fJykge1xuICAgICAgICAgICAgICAgIG9wdHNbcHJvcC5zbGljZSgyKV0gPSBxdWVyeVtwcm9wXTtcbiAgICAgICAgICAgICAgICBkZWxldGUgcXVlcnlbcHJvcF07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgXy5leHRlbmQodGhpcywge1xuICAgICAgICBtb2RlbDogbW9kZWwsXG4gICAgICAgIHF1ZXJ5OiBxdWVyeSxcbiAgICAgICAgb3B0czogb3B0c1xuICAgIH0pO1xuICAgIG9wdHMub3JkZXIgPSBvcHRzLm9yZGVyIHx8IFtdO1xuICAgIGlmICghdXRpbC5pc0FycmF5KG9wdHMub3JkZXIpKSBvcHRzLm9yZGVyID0gW29wdHMub3JkZXJdO1xufVxuXG5fLmV4dGVuZChRdWVyeSwge1xuICAgIGNvbXBhcmF0b3JzOiB7XG4gICAgICAgIGU6IGZ1bmN0aW9uIChvcHRzKSB7XG4gICAgICAgICAgICB2YXIgb2JqZWN0VmFsdWUgPSBvcHRzLm9iamVjdFtvcHRzLmZpZWxkXTtcbiAgICAgICAgICAgIGlmIChMb2dnZXIudHJhY2UpIHtcbiAgICAgICAgICAgICAgICB2YXIgc3RyaW5nVmFsdWU7XG4gICAgICAgICAgICAgICAgaWYgKG9iamVjdFZhbHVlID09PSBudWxsKSBzdHJpbmdWYWx1ZSA9ICdudWxsJztcbiAgICAgICAgICAgICAgICBlbHNlIGlmIChvYmplY3RWYWx1ZSA9PT0gdW5kZWZpbmVkKSBzdHJpbmdWYWx1ZSA9ICd1bmRlZmluZWQnO1xuICAgICAgICAgICAgICAgIGVsc2Ugc3RyaW5nVmFsdWUgPSBvYmplY3RWYWx1ZS50b1N0cmluZygpO1xuICAgICAgICAgICAgICAgIExvZ2dlci50cmFjZShvcHRzLmZpZWxkICsgJzogJyArIHN0cmluZ1ZhbHVlICsgJyA9PSAnICsgb3B0cy52YWx1ZS50b1N0cmluZygpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBvYmplY3RWYWx1ZSA9PSBvcHRzLnZhbHVlO1xuICAgICAgICB9LFxuICAgICAgICBsdDogZnVuY3Rpb24gKG9wdHMpIHtcbiAgICAgICAgICAgIGlmICghb3B0cy5pbnZhbGlkKSByZXR1cm4gb3B0cy5vYmplY3Rbb3B0cy5maWVsZF0gPCBvcHRzLnZhbHVlO1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9LFxuICAgICAgICBndDogZnVuY3Rpb24gKG9wdHMpIHtcbiAgICAgICAgICAgIGlmICghb3B0cy5pbnZhbGlkKSByZXR1cm4gb3B0cy5vYmplY3Rbb3B0cy5maWVsZF0gPiBvcHRzLnZhbHVlO1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9LFxuICAgICAgICBsdGU6IGZ1bmN0aW9uIChvcHRzKSB7XG4gICAgICAgICAgICBpZiAoIW9wdHMuaW52YWxpZCkgcmV0dXJuIG9wdHMub2JqZWN0W29wdHMuZmllbGRdIDw9IG9wdHMudmFsdWU7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH0sXG4gICAgICAgIGd0ZTogZnVuY3Rpb24gKG9wdHMpIHtcbiAgICAgICAgICAgIGlmICghb3B0cy5pbnZhbGlkKSByZXR1cm4gb3B0cy5vYmplY3Rbb3B0cy5maWVsZF0gPj0gb3B0cy52YWx1ZTtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgcmVnaXN0ZXJDb21wYXJhdG9yOiBmdW5jdGlvbiAoc3ltYm9sLCBmbikge1xuICAgICAgICBpZiAoIXRoaXMuY29tcGFyYXRvcnNbc3ltYm9sXSlcbiAgICAgICAgICAgIHRoaXMuY29tcGFyYXRvcnNbc3ltYm9sXSA9IGZuO1xuICAgIH1cbn0pO1xuXG5mdW5jdGlvbiBjYWNoZUZvck1vZGVsKG1vZGVsKSB7XG4gICAgdmFyIGNhY2hlQnlUeXBlID0gY2FjaGUuX2xvY2FsQ2FjaGVCeVR5cGU7XG4gICAgdmFyIG1vZGVsTmFtZSA9IG1vZGVsLm5hbWU7XG4gICAgdmFyIGNvbGxlY3Rpb25OYW1lID0gbW9kZWwuY29sbGVjdGlvbk5hbWU7XG4gICAgdmFyIGNhY2hlQnlNb2RlbCA9IGNhY2hlQnlUeXBlW2NvbGxlY3Rpb25OYW1lXTtcbiAgICB2YXIgY2FjaGVCeUxvY2FsSWQ7XG4gICAgaWYgKGNhY2hlQnlNb2RlbCkge1xuICAgICAgICBjYWNoZUJ5TG9jYWxJZCA9IGNhY2hlQnlNb2RlbFttb2RlbE5hbWVdIHx8IHt9O1xuICAgIH1cbiAgICByZXR1cm4gY2FjaGVCeUxvY2FsSWQ7XG59XG5cbl8uZXh0ZW5kKFF1ZXJ5LnByb3RvdHlwZSwge1xuICAgIGV4ZWN1dGU6IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgICAgICB2YXIgZGVmZXJyZWQgPSB1dGlsLmRlZmVyKGNhbGxiYWNrKTtcbiAgICAgICAgY2FsbGJhY2sgPSBkZWZlcnJlZC5maW5pc2guYmluZChkZWZlcnJlZCk7XG4gICAgICAgIHRoaXMuX2V4ZWN1dGVJbk1lbW9yeShjYWxsYmFjayk7XG4gICAgICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xuICAgIH0sXG4gICAgX2R1bXA6IGZ1bmN0aW9uIChhc0pzb24pIHtcbiAgICAgICAgcmV0dXJuIGFzSnNvbiA/ICd7fScgOiB7fTtcbiAgICB9LFxuICAgIHNvcnRGdW5jOiBmdW5jdGlvbiAoZmllbGRzKSB7XG4gICAgICAgIHZhciBzb3J0RnVuYyA9IGZ1bmN0aW9uIChhc2NlbmRpbmcsIGZpZWxkKSB7XG4gICAgICAgICAgICByZXR1cm4gZnVuY3Rpb24gKHYxLCB2Mikge1xuICAgICAgICAgICAgICAgIGlmIChhc2NlbmRpbmcpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHYxW2ZpZWxkXSAtIHYyW2ZpZWxkXTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB2MltmaWVsZF0gLSB2MVtmaWVsZF07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICB2YXIgcyA9IHV0aWw7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgZmllbGRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB2YXIgZmllbGQgPSBmaWVsZHNbaV07XG4gICAgICAgICAgICBzID0gcy50aGVuQnkoc29ydEZ1bmMoZmllbGQuYXNjZW5kaW5nLCBmaWVsZC5maWVsZCkpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBzO1xuICAgIH0sXG4gICAgX3NvcnRSZXN1bHRzOiBmdW5jdGlvbiAocmVzKSB7XG4gICAgICAgIHZhciBvcmRlciA9IHRoaXMub3B0cy5vcmRlcjtcbiAgICAgICAgaWYgKHJlcyAmJiBvcmRlcikge1xuICAgICAgICAgICAgdmFyIGZpZWxkcyA9IF8ubWFwKG9yZGVyLCBmdW5jdGlvbiAob3JkZXJpbmcpIHtcbiAgICAgICAgICAgICAgICB2YXIgc3BsdCA9IG9yZGVyaW5nLnNwbGl0KCctJyksXG4gICAgICAgICAgICAgICAgICAgIGFzY2VuZGluZyA9IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIGZpZWxkID0gbnVsbDtcbiAgICAgICAgICAgICAgICBpZiAoc3BsdC5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgICAgICAgICAgIGZpZWxkID0gc3BsdFsxXTtcbiAgICAgICAgICAgICAgICAgICAgYXNjZW5kaW5nID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBmaWVsZCA9IHNwbHRbMF07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiB7ZmllbGQ6IGZpZWxkLCBhc2NlbmRpbmc6IGFzY2VuZGluZ307XG4gICAgICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICAgICAgdmFyIHMgPSB0aGlzLnNvcnRGdW5jKGZpZWxkcyk7XG4gICAgICAgICAgICBpZiAocmVzLmltbXV0YWJsZSkgcmVzID0gcmVzLm11dGFibGVDb3B5KCk7XG4gICAgICAgICAgICByZXMuc29ydChzKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzO1xuICAgIH0sXG4gICAgLyoqXG4gICAgICogUmV0dXJuIGFsbCBtb2RlbCBpbnN0YW5jZXMgaW4gdGhlIGNhY2hlLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2dldENhY2hlQnlMb2NhbElkOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiBfLnJlZHVjZSh0aGlzLm1vZGVsLmRlc2NlbmRhbnRzLCBmdW5jdGlvbiAobWVtbywgY2hpbGRNb2RlbCkge1xuICAgICAgICAgICAgcmV0dXJuIF8uZXh0ZW5kKG1lbW8sIGNhY2hlRm9yTW9kZWwoY2hpbGRNb2RlbCkpO1xuICAgICAgICB9LCBfLmV4dGVuZCh7fSwgY2FjaGVGb3JNb2RlbCh0aGlzLm1vZGVsKSkpO1xuICAgIH0sXG4gICAgX2V4ZWN1dGVJbk1lbW9yeTogZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgICAgIHZhciBfZXhlY3V0ZUluTWVtb3J5ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdmFyIGNhY2hlQnlMb2NhbElkID0gdGhpcy5fZ2V0Q2FjaGVCeUxvY2FsSWQoKTtcbiAgICAgICAgICAgIHZhciBrZXlzID0gT2JqZWN0LmtleXMoY2FjaGVCeUxvY2FsSWQpO1xuICAgICAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICAgICAgdmFyIHJlcyA9IFtdO1xuICAgICAgICAgICAgdmFyIGVycjtcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwga2V5cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIHZhciBrID0ga2V5c1tpXTtcbiAgICAgICAgICAgICAgICB2YXIgb2JqID0gY2FjaGVCeUxvY2FsSWRba107XG4gICAgICAgICAgICAgICAgdmFyIG1hdGNoZXMgPSBzZWxmLm9iamVjdE1hdGNoZXNRdWVyeShvYmopO1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YobWF0Y2hlcykgPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICAgICAgZXJyID0gY29uc3RydWN0RXJyb3IobWF0Y2hlcyk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChtYXRjaGVzKSByZXMucHVzaChvYmopO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJlcyA9IHRoaXMuX3NvcnRSZXN1bHRzKHJlcyk7XG4gICAgICAgICAgICBjYWxsYmFjayhlcnIsIGVyciA/IG51bGwgOiBjb25zdHJ1Y3RRdWVyeVNldChyZXMsIHRoaXMubW9kZWwpKTtcbiAgICAgICAgfS5iaW5kKHRoaXMpO1xuICAgICAgICBpZiAodGhpcy5vcHRzLmlnbm9yZUluc3RhbGxlZCkgX2V4ZWN1dGVJbk1lbW9yeSgpO1xuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHNpZXN0YS5fYWZ0ZXJJbnN0YWxsKF9leGVjdXRlSW5NZW1vcnkpO1xuICAgICAgICB9XG5cbiAgICB9LFxuICAgIGNsZWFyT3JkZXJpbmc6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGhpcy5vcHRzLm9yZGVyID0gbnVsbDtcbiAgICB9LFxuICAgIG9iamVjdE1hdGNoZXNPclF1ZXJ5OiBmdW5jdGlvbiAob2JqLCBvclF1ZXJ5KSB7XG4gICAgICAgIGZvciAodmFyIGlkeCBpbiBvclF1ZXJ5KSB7XG4gICAgICAgICAgICBpZiAob3JRdWVyeS5oYXNPd25Qcm9wZXJ0eShpZHgpKSB7XG4gICAgICAgICAgICAgICAgdmFyIHF1ZXJ5ID0gb3JRdWVyeVtpZHhdO1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLm9iamVjdE1hdGNoZXNCYXNlUXVlcnkob2JqLCBxdWVyeSkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9LFxuICAgIG9iamVjdE1hdGNoZXNBbmRRdWVyeTogZnVuY3Rpb24gKG9iaiwgYW5kUXVlcnkpIHtcbiAgICAgICAgZm9yICh2YXIgaWR4IGluIGFuZFF1ZXJ5KSB7XG4gICAgICAgICAgICBpZiAoYW5kUXVlcnkuaGFzT3duUHJvcGVydHkoaWR4KSkge1xuICAgICAgICAgICAgICAgIHZhciBxdWVyeSA9IGFuZFF1ZXJ5W2lkeF07XG4gICAgICAgICAgICAgICAgaWYgKCF0aGlzLm9iamVjdE1hdGNoZXNCYXNlUXVlcnkob2JqLCBxdWVyeSkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9LFxuICAgIHNwbGl0TWF0Y2hlczogZnVuY3Rpb24gKG9iaiwgdW5wcm9jZXNzZWRGaWVsZCwgdmFsdWUpIHtcbiAgICAgICAgdmFyIG9wID0gJ2UnO1xuICAgICAgICB2YXIgZmllbGRzID0gdW5wcm9jZXNzZWRGaWVsZC5zcGxpdCgnLicpO1xuICAgICAgICB2YXIgc3BsdCA9IGZpZWxkc1tmaWVsZHMubGVuZ3RoIC0gMV0uc3BsaXQoJ19fJyk7XG4gICAgICAgIGlmIChzcGx0Lmxlbmd0aCA9PSAyKSB7XG4gICAgICAgICAgICB2YXIgZmllbGQgPSBzcGx0WzBdO1xuICAgICAgICAgICAgb3AgPSBzcGx0WzFdO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgZmllbGQgPSBzcGx0WzBdO1xuICAgICAgICB9XG4gICAgICAgIGZpZWxkc1tmaWVsZHMubGVuZ3RoIC0gMV0gPSBmaWVsZDtcbiAgICAgICAgXy5lYWNoKGZpZWxkcy5zbGljZSgwLCBmaWVsZHMubGVuZ3RoIC0gMSksIGZ1bmN0aW9uIChmKSB7XG4gICAgICAgICAgICBvYmogPSBvYmpbZl07XG4gICAgICAgIH0pO1xuICAgICAgICB2YXIgdmFsID0gb2JqW2ZpZWxkXTtcbiAgICAgICAgdmFyIGludmFsaWQgPSB2YWwgPT09IG51bGwgfHwgdmFsID09PSB1bmRlZmluZWQ7XG4gICAgICAgIHZhciBjb21wYXJhdG9yID0gUXVlcnkuY29tcGFyYXRvcnNbb3BdLFxuICAgICAgICAgICAgb3B0cyA9IHtvYmplY3Q6IG9iaiwgZmllbGQ6IGZpZWxkLCB2YWx1ZTogdmFsdWUsIGludmFsaWQ6IGludmFsaWR9O1xuICAgICAgICBpZiAoIWNvbXBhcmF0b3IpIHtcbiAgICAgICAgICAgIHJldHVybiAnTm8gY29tcGFyYXRvciByZWdpc3RlcmVkIGZvciBxdWVyeSBvcGVyYXRpb24gXCInICsgb3AgKyAnXCInO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBjb21wYXJhdG9yKG9wdHMpO1xuICAgIH0sXG4gICAgb2JqZWN0TWF0Y2hlczogZnVuY3Rpb24gKG9iaiwgdW5wcm9jZXNzZWRGaWVsZCwgdmFsdWUsIHF1ZXJ5KSB7XG4gICAgICAgIGlmICh1bnByb2Nlc3NlZEZpZWxkID09ICckb3InKSB7XG4gICAgICAgICAgICBpZiAoIXRoaXMub2JqZWN0TWF0Y2hlc09yUXVlcnkob2JqLCBxdWVyeVsnJG9yJ10pKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAodW5wcm9jZXNzZWRGaWVsZCA9PSAnJGFuZCcpIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5vYmplY3RNYXRjaGVzQW5kUXVlcnkob2JqLCBxdWVyeVsnJGFuZCddKSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdmFyIG1hdGNoZXMgPSB0aGlzLnNwbGl0TWF0Y2hlcyhvYmosIHVucHJvY2Vzc2VkRmllbGQsIHZhbHVlKTtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgbWF0Y2hlcyAhPSAnYm9vbGVhbicpIHJldHVybiBtYXRjaGVzO1xuICAgICAgICAgICAgaWYgKCFtYXRjaGVzKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSxcbiAgICBvYmplY3RNYXRjaGVzQmFzZVF1ZXJ5OiBmdW5jdGlvbiAob2JqLCBxdWVyeSkge1xuICAgICAgICB2YXIgZmllbGRzID0gT2JqZWN0LmtleXMocXVlcnkpO1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGZpZWxkcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdmFyIHVucHJvY2Vzc2VkRmllbGQgPSBmaWVsZHNbaV0sXG4gICAgICAgICAgICAgICAgdmFsdWUgPSBxdWVyeVt1bnByb2Nlc3NlZEZpZWxkXTtcbiAgICAgICAgICAgIHZhciBydCA9IHRoaXMub2JqZWN0TWF0Y2hlcyhvYmosIHVucHJvY2Vzc2VkRmllbGQsIHZhbHVlLCBxdWVyeSk7XG4gICAgICAgICAgICBpZiAodHlwZW9mIHJ0ICE9ICdib29sZWFuJykgcmV0dXJuIHJ0O1xuICAgICAgICAgICAgaWYgKCFydCkgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH0sXG4gICAgb2JqZWN0TWF0Y2hlc1F1ZXJ5OiBmdW5jdGlvbiAob2JqKSB7XG4gICAgICAgIHJldHVybiB0aGlzLm9iamVjdE1hdGNoZXNCYXNlUXVlcnkob2JqLCB0aGlzLnF1ZXJ5KTtcbiAgICB9XG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBRdWVyeTsiLCIvKipcbiAqIEJhc2UgZnVuY3Rpb25hbGl0eSBmb3IgcmVsYXRpb25zaGlwcy5cbiAqIEBtb2R1bGUgcmVsYXRpb25zaGlwc1xuICovXG5cbnZhciBJbnRlcm5hbFNpZXN0YUVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpLkludGVybmFsU2llc3RhRXJyb3IsXG4gICAgU3RvcmUgPSByZXF1aXJlKCcuL3N0b3JlJyksXG4gICAgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpLFxuICAgIF8gPSB1dGlsLl8sXG4gICAgUXVlcnkgPSByZXF1aXJlKCcuL3F1ZXJ5JyksXG4gICAgbG9nID0gcmVxdWlyZSgnLi9sb2cnKSxcbiAgICBjYWNoZSA9IHJlcXVpcmUoJy4vY2FjaGUnKSxcbiAgICBldmVudHMgPSByZXF1aXJlKCcuL2V2ZW50cycpLFxuICAgIHdyYXBBcnJheUZvckF0dHJpYnV0ZXMgPSBldmVudHMud3JhcEFycmF5LFxuICAgIEFycmF5T2JzZXJ2ZXIgPSByZXF1aXJlKCcuLi92ZW5kb3Ivb2JzZXJ2ZS1qcy9zcmMvb2JzZXJ2ZScpLkFycmF5T2JzZXJ2ZXIsXG4gICAgbW9kZWxFdmVudHMgPSByZXF1aXJlKCcuL21vZGVsRXZlbnRzJyksXG4gICAgTW9kZWxFdmVudFR5cGUgPSBtb2RlbEV2ZW50cy5Nb2RlbEV2ZW50VHlwZTtcblxuLyoqXG4gKiBAY2xhc3MgIFtSZWxhdGlvbnNoaXBQcm94eSBkZXNjcmlwdGlvbl1cbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRzXG4gKiBAY29uc3RydWN0b3JcbiAqL1xuZnVuY3Rpb24gUmVsYXRpb25zaGlwUHJveHkob3B0cykge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBvcHRzID0gb3B0cyB8fCB7fTtcblxuICAgIF8uZXh0ZW5kKHRoaXMsIHtcbiAgICAgICAgb2JqZWN0OiBudWxsLFxuICAgICAgICByZWxhdGVkOiBudWxsXG4gICAgfSk7XG5cbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydGllcyh0aGlzLCB7XG4gICAgICAgIGlzRm9yd2FyZDoge1xuICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuICFzZWxmLmlzUmV2ZXJzZTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBzZXQ6IGZ1bmN0aW9uICh2KSB7XG4gICAgICAgICAgICAgICAgc2VsZi5pc1JldmVyc2UgPSAhdjtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlXG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIHV0aWwuZXh0ZW5kRnJvbU9wdHModGhpcywgb3B0cywge1xuICAgICAgICByZXZlcnNlTW9kZWw6IG51bGwsXG4gICAgICAgIGZvcndhcmRNb2RlbDogbnVsbCxcbiAgICAgICAgZm9yd2FyZE5hbWU6IG51bGwsXG4gICAgICAgIHJldmVyc2VOYW1lOiBudWxsLFxuICAgICAgICBpc1JldmVyc2U6IG51bGxcbiAgICB9KTtcblxuICAgIHRoaXMuY2FuY2VsTGlzdGVucyA9IHt9O1xufVxuXG5fLmV4dGVuZChSZWxhdGlvbnNoaXBQcm94eSwge30pO1xuXG5fLmV4dGVuZChSZWxhdGlvbnNoaXBQcm94eS5wcm90b3R5cGUsIHtcbiAgICAvKipcbiAgICAgKiBJbnN0YWxsIHRoaXMgcHJveHkgb24gdGhlIGdpdmVuIGluc3RhbmNlXG4gICAgICogQHBhcmFtIHtNb2RlbEluc3RhbmNlfSBtb2RlbEluc3RhbmNlXG4gICAgICovXG4gICAgaW5zdGFsbDogZnVuY3Rpb24gKG1vZGVsSW5zdGFuY2UpIHtcbiAgICAgICAgaWYgKG1vZGVsSW5zdGFuY2UpIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5vYmplY3QpIHtcbiAgICAgICAgICAgICAgICB0aGlzLm9iamVjdCA9IG1vZGVsSW5zdGFuY2U7XG4gICAgICAgICAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICAgICAgICAgIHZhciBuYW1lID0gdGhpcy5nZXRGb3J3YXJkTmFtZSgpO1xuICAgICAgICAgICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShtb2RlbEluc3RhbmNlLCBuYW1lLCB7XG4gICAgICAgICAgICAgICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHNlbGYucmVsYXRlZDtcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgc2V0OiBmdW5jdGlvbiAodikge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2VsZi5zZXQodik7XG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGlmICghbW9kZWxJbnN0YW5jZS5fX3Byb3hpZXMpIG1vZGVsSW5zdGFuY2UuX19wcm94aWVzID0ge307XG4gICAgICAgICAgICAgICAgbW9kZWxJbnN0YW5jZS5fX3Byb3hpZXNbbmFtZV0gPSB0aGlzO1xuICAgICAgICAgICAgICAgIGlmICghbW9kZWxJbnN0YW5jZS5fcHJveGllcykge1xuICAgICAgICAgICAgICAgICAgICBtb2RlbEluc3RhbmNlLl9wcm94aWVzID0gW107XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIG1vZGVsSW5zdGFuY2UuX3Byb3hpZXMucHVzaCh0aGlzKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ0FscmVhZHkgaW5zdGFsbGVkLicpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ05vIG9iamVjdCBwYXNzZWQgdG8gcmVsYXRpb25zaGlwIGluc3RhbGwnKTtcbiAgICAgICAgfVxuICAgIH1cblxufSk7XG5cbi8vbm9pbnNwZWN0aW9uIEpTVW51c2VkTG9jYWxTeW1ib2xzXG5fLmV4dGVuZChSZWxhdGlvbnNoaXBQcm94eS5wcm90b3R5cGUsIHtcbiAgICBzZXQ6IGZ1bmN0aW9uIChvYmosIG9wdHMpIHtcbiAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ011c3Qgc3ViY2xhc3MgUmVsYXRpb25zaGlwUHJveHknKTtcbiAgICB9LFxuICAgIGdldDogZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdNdXN0IHN1YmNsYXNzIFJlbGF0aW9uc2hpcFByb3h5Jyk7XG4gICAgfVxufSk7XG5cbl8uZXh0ZW5kKFJlbGF0aW9uc2hpcFByb3h5LnByb3RvdHlwZSwge1xuICAgIHByb3h5Rm9ySW5zdGFuY2U6IGZ1bmN0aW9uIChtb2RlbEluc3RhbmNlLCByZXZlcnNlKSB7XG4gICAgICAgIHZhciBuYW1lID0gcmV2ZXJzZSA/IHRoaXMuZ2V0UmV2ZXJzZU5hbWUoKSA6IHRoaXMuZ2V0Rm9yd2FyZE5hbWUoKSxcbiAgICAgICAgICAgIG1vZGVsID0gcmV2ZXJzZSA/IHRoaXMucmV2ZXJzZU1vZGVsIDogdGhpcy5mb3J3YXJkTW9kZWw7XG4gICAgICAgIHZhciByZXQ7XG4gICAgICAgIC8vIFRoaXMgc2hvdWxkIG5ldmVyIGhhcHBlbi4gU2hvdWxkIGcgICBldCBjYXVnaHQgaW4gdGhlIG1hcHBpbmcgb3BlcmF0aW9uP1xuICAgICAgICBpZiAodXRpbC5pc0FycmF5KG1vZGVsSW5zdGFuY2UpKSB7XG4gICAgICAgICAgICByZXQgPSBfLm1hcChtb2RlbEluc3RhbmNlLCBmdW5jdGlvbiAobykge1xuICAgICAgICAgICAgICAgIHJldHVybiBvLl9fcHJveGllc1tuYW1lXTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdmFyIHByb3h5ID0gbW9kZWxJbnN0YW5jZS5fX3Byb3hpZXNbbmFtZV07XG4gICAgICAgICAgICBpZiAoIXByb3h5KSB7XG4gICAgICAgICAgICAgICAgdmFyIGVyciA9ICdObyBwcm94eSB3aXRoIG5hbWUgXCInICsgbmFtZSArICdcIiBvbiBtYXBwaW5nICcgKyBtb2RlbC5uYW1lO1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKGVycik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXQgPSBwcm94eTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmV0O1xuICAgIH0sXG4gICAgcmV2ZXJzZVByb3h5Rm9ySW5zdGFuY2U6IGZ1bmN0aW9uIChtb2RlbEluc3RhbmNlKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnByb3h5Rm9ySW5zdGFuY2UobW9kZWxJbnN0YW5jZSwgdHJ1ZSk7XG4gICAgfSxcbiAgICBnZXRSZXZlcnNlTmFtZTogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5pc0ZvcndhcmQgPyB0aGlzLnJldmVyc2VOYW1lIDogdGhpcy5mb3J3YXJkTmFtZTtcbiAgICB9LFxuICAgIGdldEZvcndhcmROYW1lOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmlzRm9yd2FyZCA/IHRoaXMuZm9yd2FyZE5hbWUgOiB0aGlzLnJldmVyc2VOYW1lO1xuICAgIH0sXG4gICAgZ2V0Rm9yd2FyZE1vZGVsOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmlzRm9yd2FyZCA/IHRoaXMuZm9yd2FyZE1vZGVsIDogdGhpcy5yZXZlcnNlTW9kZWw7XG4gICAgfSxcbiAgICBjbGVhclJlbW92YWxMaXN0ZW5lcjogZnVuY3Rpb24gKG9iaikge1xuICAgICAgICBjb25zb2xlLmxvZygnY2xlYXJSZW1vdmFsTGlzdGVuZXInLCBvYmopO1xuICAgICAgICB2YXIgX2lkID0gb2JqLl9pZDtcbiAgICAgICAgdmFyIGNhbmNlbExpc3RlbiA9IHRoaXMuY2FuY2VsTGlzdGVuc1tfaWRdO1xuICAgICAgICAvLyBUT0RPOiBSZW1vdmUgdGhpcyBjaGVjay4gY2FuY2VsTGlzdGVuIHNob3VsZCBhbHdheXMgZXhpc3RcbiAgICAgICAgaWYgKGNhbmNlbExpc3Rlbikge1xuICAgICAgICAgICAgY2FuY2VsTGlzdGVuKCk7XG4gICAgICAgICAgICB0aGlzLmNhbmNlbExpc3RlbnNbX2lkXSA9IG51bGw7XG4gICAgICAgIH1cbiAgICB9LFxuICAgIGxpc3RlbkZvclJlbW92YWw6IGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgY29uc29sZS5sb2coJ2xpc3RlbkZvclJlbW92YWwnLCBvYmopO1xuICAgICAgICB0aGlzLmNhbmNlbExpc3RlbnNbb2JqLl9pZF0gPSBvYmoubGlzdGVuKGZ1bmN0aW9uIChlKSB7XG4gICAgICAgICAgICBpZiAoZS50eXBlID09IE1vZGVsRXZlbnRUeXBlLlJlbW92ZSkge1xuICAgICAgICAgICAgICAgIGlmICh1dGlsLmlzQXJyYXkodGhpcy5yZWxhdGVkKSkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgaWR4ID0gdGhpcy5yZWxhdGVkLmluZGV4T2Yob2JqKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zcGxpY2UoaWR4LCAxKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc2V0SWRBbmRSZWxhdGVkKG51bGwpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB0aGlzLmNsZWFyUmVtb3ZhbExpc3RlbmVyKG9iaik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBDb25maWd1cmUgX2lkIGFuZCByZWxhdGVkIHdpdGggdGhlIG5ldyByZWxhdGVkIG9iamVjdC5cbiAgICAgKiBAcGFyYW0gb2JqXG4gICAgICogQHBhcmFtIHtvYmplY3R9IFtvcHRzXVxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdHMuZGlzYWJsZU5vdGlmaWNhdGlvbnNdXG4gICAgICogQHJldHVybnMge1N0cmluZ3x1bmRlZmluZWR9IC0gRXJyb3IgbWVzc2FnZSBvciB1bmRlZmluZWRcbiAgICAgKi9cbiAgICBzZXRJZEFuZFJlbGF0ZWQ6IGZ1bmN0aW9uIChvYmosIG9wdHMpIHtcbiAgICAgICAgb3B0cyA9IG9wdHMgfHwge307XG4gICAgICAgIGlmICghb3B0cy5kaXNhYmxlZXZlbnRzKSB7XG4gICAgICAgICAgICB0aGlzLnJlZ2lzdGVyU2V0Q2hhbmdlKG9iaik7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIHByZXZpb3VzbHlSZWxhdGVkID0gdGhpcy5yZWxhdGVkO1xuICAgICAgICBpZiAocHJldmlvdXNseVJlbGF0ZWQpIHRoaXMuY2xlYXJSZW1vdmFsTGlzdGVuZXIocHJldmlvdXNseVJlbGF0ZWQpO1xuICAgICAgICBpZiAob2JqKSB7XG4gICAgICAgICAgICBpZiAodXRpbC5pc0FycmF5KG9iaikpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnJlbGF0ZWQgPSBvYmo7XG4gICAgICAgICAgICAgICAgb2JqLmZvckVhY2goZnVuY3Rpb24gKF9vYmopIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5saXN0ZW5Gb3JSZW1vdmFsKF9vYmopO1xuICAgICAgICAgICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMucmVsYXRlZCA9IG9iajtcbiAgICAgICAgICAgICAgICB0aGlzLmxpc3RlbkZvclJlbW92YWwob2JqKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMucmVsYXRlZCA9IG51bGw7XG4gICAgICAgIH1cbiAgICB9LFxuICAgIGNoZWNrSW5zdGFsbGVkOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmICghdGhpcy5vYmplY3QpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdQcm94eSBtdXN0IGJlIGluc3RhbGxlZCBvbiBhbiBvYmplY3QgYmVmb3JlIGNhbiB1c2UgaXQuJyk7XG4gICAgICAgIH1cbiAgICB9LFxuICAgIHNwbGljZXI6IGZ1bmN0aW9uIChvcHRzKSB7XG4gICAgICAgIG9wdHMgPSBvcHRzIHx8IHt9O1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKGlkeCwgbnVtUmVtb3ZlKSB7XG4gICAgICAgICAgICBvcHRzID0gb3B0cyB8fCB7fTtcbiAgICAgICAgICAgIGlmICghb3B0cy5kaXNhYmxlZXZlbnRzKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5yZWdpc3RlclNwbGljZUNoYW5nZS5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdmFyIGFkZCA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMik7XG4gICAgICAgICAgICByZXR1cm4gXy5wYXJ0aWFsKHRoaXMucmVsYXRlZC5zcGxpY2UsIGlkeCwgbnVtUmVtb3ZlKS5hcHBseSh0aGlzLnJlbGF0ZWQsIGFkZCk7XG4gICAgICAgIH0uYmluZCh0aGlzKTtcbiAgICB9LFxuICAgIGNsZWFyUmV2ZXJzZVJlbGF0ZWQ6IGZ1bmN0aW9uIChvcHRzKSB7XG4gICAgICAgIG9wdHMgPSBvcHRzIHx8IHt9O1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgIGlmICh0aGlzLnJlbGF0ZWQpIHtcbiAgICAgICAgICAgIHZhciByZXZlcnNlUHJveHkgPSB0aGlzLnJldmVyc2VQcm94eUZvckluc3RhbmNlKHRoaXMucmVsYXRlZCk7XG4gICAgICAgICAgICB2YXIgcmV2ZXJzZVByb3hpZXMgPSB1dGlsLmlzQXJyYXkocmV2ZXJzZVByb3h5KSA/IHJldmVyc2VQcm94eSA6IFtyZXZlcnNlUHJveHldO1xuICAgICAgICAgICAgXy5lYWNoKHJldmVyc2VQcm94aWVzLCBmdW5jdGlvbiAocCkge1xuICAgICAgICAgICAgICAgIGlmICh1dGlsLmlzQXJyYXkocC5yZWxhdGVkKSkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgaWR4ID0gcC5yZWxhdGVkLmluZGV4T2Yoc2VsZi5vYmplY3QpO1xuICAgICAgICAgICAgICAgICAgICBwLm1ha2VDaGFuZ2VzVG9SZWxhdGVkV2l0aG91dE9ic2VydmF0aW9ucyhmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwLnNwbGljZXIob3B0cykoaWR4LCAxKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcC5zZXRJZEFuZFJlbGF0ZWQobnVsbCwgb3B0cyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9LFxuICAgIHNldElkQW5kUmVsYXRlZFJldmVyc2U6IGZ1bmN0aW9uIChvYmosIG9wdHMpIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICB2YXIgcmV2ZXJzZVByb3h5ID0gdGhpcy5yZXZlcnNlUHJveHlGb3JJbnN0YW5jZShvYmopO1xuICAgICAgICB2YXIgcmV2ZXJzZVByb3hpZXMgPSB1dGlsLmlzQXJyYXkocmV2ZXJzZVByb3h5KSA/IHJldmVyc2VQcm94eSA6IFtyZXZlcnNlUHJveHldO1xuICAgICAgICBfLmVhY2gocmV2ZXJzZVByb3hpZXMsIGZ1bmN0aW9uIChwKSB7XG4gICAgICAgICAgICBpZiAodXRpbC5pc0FycmF5KHAucmVsYXRlZCkpIHtcbiAgICAgICAgICAgICAgICBwLm1ha2VDaGFuZ2VzVG9SZWxhdGVkV2l0aG91dE9ic2VydmF0aW9ucyhmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIHAuc3BsaWNlcihvcHRzKShwLnJlbGF0ZWQubGVuZ3RoLCAwLCBzZWxmLm9iamVjdCk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHAuY2xlYXJSZXZlcnNlUmVsYXRlZChvcHRzKTtcbiAgICAgICAgICAgICAgICBwLnNldElkQW5kUmVsYXRlZChzZWxmLm9iamVjdCwgb3B0cyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH0sXG4gICAgbWFrZUNoYW5nZXNUb1JlbGF0ZWRXaXRob3V0T2JzZXJ2YXRpb25zOiBmdW5jdGlvbiAoZikge1xuICAgICAgICBpZiAodGhpcy5yZWxhdGVkKSB7XG4gICAgICAgICAgICB0aGlzLnJlbGF0ZWQuYXJyYXlPYnNlcnZlci5jbG9zZSgpO1xuICAgICAgICAgICAgdGhpcy5yZWxhdGVkLmFycmF5T2JzZXJ2ZXIgPSBudWxsO1xuICAgICAgICAgICAgZigpO1xuICAgICAgICAgICAgdGhpcy53cmFwQXJyYXkodGhpcy5yZWxhdGVkKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGYoKTtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgcmVnaXN0ZXJTZXRDaGFuZ2U6IGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgdmFyIHByb3h5T2JqZWN0ID0gdGhpcy5vYmplY3Q7XG4gICAgICAgIGlmICghcHJveHlPYmplY3QpIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdQcm94eSBtdXN0IGhhdmUgYW4gb2JqZWN0IGFzc29jaWF0ZWQnKTtcbiAgICAgICAgdmFyIG1vZGVsID0gcHJveHlPYmplY3QubW9kZWwubmFtZTtcbiAgICAgICAgdmFyIGNvbGxlY3Rpb25OYW1lID0gcHJveHlPYmplY3QuY29sbGVjdGlvbk5hbWU7XG4gICAgICAgIC8vIFdlIHRha2UgW10gPT0gbnVsbCA9PSB1bmRlZmluZWQgaW4gdGhlIGNhc2Ugb2YgcmVsYXRpb25zaGlwcy5cbiAgICAgICAgdmFyIG9sZCA9IHRoaXMucmVsYXRlZDtcbiAgICAgICAgaWYgKHV0aWwuaXNBcnJheShvbGQpICYmICFvbGQubGVuZ3RoKSB7XG4gICAgICAgICAgICBvbGQgPSBudWxsO1xuICAgICAgICB9XG4gICAgICAgIG1vZGVsRXZlbnRzLmVtaXQoe1xuICAgICAgICAgICAgY29sbGVjdGlvbjogY29sbGVjdGlvbk5hbWUsXG4gICAgICAgICAgICBtb2RlbDogbW9kZWwsXG4gICAgICAgICAgICBfaWQ6IHByb3h5T2JqZWN0Ll9pZCxcbiAgICAgICAgICAgIGZpZWxkOiB0aGlzLmdldEZvcndhcmROYW1lKCksXG4gICAgICAgICAgICBvbGQ6IG9sZCxcbiAgICAgICAgICAgIG5ldzogb2JqLFxuICAgICAgICAgICAgdHlwZTogTW9kZWxFdmVudFR5cGUuU2V0LFxuICAgICAgICAgICAgb2JqOiBwcm94eU9iamVjdFxuICAgICAgICB9KTtcbiAgICB9LFxuXG4gICAgcmVnaXN0ZXJTcGxpY2VDaGFuZ2U6IGZ1bmN0aW9uIChpZHgsIG51bVJlbW92ZSkge1xuICAgICAgICB2YXIgYWRkID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAyKTtcbiAgICAgICAgdmFyIG1vZGVsID0gdGhpcy5vYmplY3QubW9kZWwubmFtZTtcbiAgICAgICAgdmFyIGNvbGwgPSB0aGlzLm9iamVjdC5jb2xsZWN0aW9uTmFtZTtcbiAgICAgICAgbW9kZWxFdmVudHMuZW1pdCh7XG4gICAgICAgICAgICBjb2xsZWN0aW9uOiBjb2xsLFxuICAgICAgICAgICAgbW9kZWw6IG1vZGVsLFxuICAgICAgICAgICAgX2lkOiB0aGlzLm9iamVjdC5faWQsXG4gICAgICAgICAgICBmaWVsZDogdGhpcy5nZXRGb3J3YXJkTmFtZSgpLFxuICAgICAgICAgICAgaW5kZXg6IGlkeCxcbiAgICAgICAgICAgIHJlbW92ZWQ6IHRoaXMucmVsYXRlZCA/IHRoaXMucmVsYXRlZC5zbGljZShpZHgsIGlkeCArIG51bVJlbW92ZSkgOiBudWxsLFxuICAgICAgICAgICAgYWRkZWQ6IGFkZC5sZW5ndGggPyBhZGQgOiBbXSxcbiAgICAgICAgICAgIHR5cGU6IE1vZGVsRXZlbnRUeXBlLlNwbGljZSxcbiAgICAgICAgICAgIG9iajogdGhpcy5vYmplY3RcbiAgICAgICAgfSk7XG4gICAgfSxcbiAgICB3cmFwQXJyYXk6IGZ1bmN0aW9uIChhcnIpIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICB3cmFwQXJyYXlGb3JBdHRyaWJ1dGVzKGFyciwgdGhpcy5yZXZlcnNlTmFtZSwgdGhpcy5vYmplY3QpO1xuICAgICAgICBpZiAoIWFyci5hcnJheU9ic2VydmVyKSB7XG4gICAgICAgICAgICBhcnIuYXJyYXlPYnNlcnZlciA9IG5ldyBBcnJheU9ic2VydmVyKGFycik7XG4gICAgICAgICAgICB2YXIgb2JzZXJ2ZXJGdW5jdGlvbiA9IGZ1bmN0aW9uIChzcGxpY2VzKSB7XG4gICAgICAgICAgICAgICAgc3BsaWNlcy5mb3JFYWNoKGZ1bmN0aW9uIChzcGxpY2UpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGFkZGVkID0gc3BsaWNlLmFkZGVkQ291bnQgPyBhcnIuc2xpY2Uoc3BsaWNlLmluZGV4LCBzcGxpY2UuaW5kZXggKyBzcGxpY2UuYWRkZWRDb3VudCkgOiBbXTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIG1vZGVsID0gc2VsZi5nZXRGb3J3YXJkTW9kZWwoKTtcbiAgICAgICAgICAgICAgICAgICAgbW9kZWxFdmVudHMuZW1pdCh7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb2xsZWN0aW9uOiBtb2RlbC5jb2xsZWN0aW9uTmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1vZGVsOiBtb2RlbC5uYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgX2lkOiBzZWxmLm9iamVjdC5faWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBmaWVsZDogc2VsZi5nZXRGb3J3YXJkTmFtZSgpLFxuICAgICAgICAgICAgICAgICAgICAgICAgcmVtb3ZlZDogc3BsaWNlLnJlbW92ZWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBhZGRlZDogYWRkZWQsXG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiBNb2RlbEV2ZW50VHlwZS5TcGxpY2UsXG4gICAgICAgICAgICAgICAgICAgICAgICBvYmo6IHNlbGYub2JqZWN0XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIGFyci5hcnJheU9ic2VydmVyLm9wZW4ob2JzZXJ2ZXJGdW5jdGlvbik7XG4gICAgICAgIH1cbiAgICB9LFxuICAgIHNwbGljZTogZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLnNwbGljZXIoe30pLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfVxuXG59KTtcblxuXG5tb2R1bGUuZXhwb3J0cyA9IFJlbGF0aW9uc2hpcFByb3h5O1xuXG4iLCIvKipcbiAqIEBtb2R1bGUgcmVsYXRpb25zaGlwXG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gICAgT25lVG9NYW55OiAnT25lVG9NYW55JyxcbiAgICBPbmVUb09uZTogJ09uZVRvT25lJyxcbiAgICBNYW55VG9NYW55OiAnTWFueVRvTWFueSdcbn07IiwiLyoqXG4gKiBUaGlzIGlzIGFuIGluLW1lbW9yeSBjYWNoZSBmb3IgbW9kZWxzLiBNb2RlbHMgYXJlIGNhY2hlZCBieSBsb2NhbCBpZCAoX2lkKSBhbmQgcmVtb3RlIGlkIChkZWZpbmVkIGJ5IHRoZSBtYXBwaW5nKS5cbiAqIExvb2t1cHMgYXJlIHBlcmZvcm1lZCBhZ2FpbnN0IHRoZSBjYWNoZSB3aGVuIG1hcHBpbmcuXG4gKiBAbW9kdWxlIGNhY2hlXG4gKi9cbnZhciBsb2cgPSByZXF1aXJlKCcuL2xvZycpLFxuICAgIEludGVybmFsU2llc3RhRXJyb3IgPSByZXF1aXJlKCcuL2Vycm9yJykuSW50ZXJuYWxTaWVzdGFFcnJvcixcbiAgICB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyk7XG5cblxudmFyIExvZ2dlciA9IGxvZy5sb2dnZXJXaXRoTmFtZSgnQ2FjaGUnKTtcblxudmFyIGxvY2FsQ2FjaGVCeUlkID0ge30sXG4gICAgbG9jYWxDYWNoZSA9IHt9LFxuICAgIHJlbW90ZUNhY2hlID0ge307XG5cbi8qKlxuICogQ2xlYXIgb3V0IHRoZSBjYWNoZS5cbiAqL1xuZnVuY3Rpb24gcmVzZXQoKSB7XG4gICAgcmVtb3RlQ2FjaGUgPSB7fTtcbiAgICBsb2NhbENhY2hlQnlJZCA9IHt9O1xuICAgIGxvY2FsQ2FjaGUgPSB7fTtcbn1cblxuLyoqXG4gKiBSZXR1cm4gdGhlIG9iamVjdCBpbiB0aGUgY2FjaGUgZ2l2ZW4gYSBsb2NhbCBpZCAoX2lkKVxuICogQHBhcmFtICB7U3RyaW5nfSBsb2NhbElkXG4gKiBAcmV0dXJuIHtNb2RlbEluc3RhbmNlfVxuICovXG5mdW5jdGlvbiBnZXRWaWFMb2NhbElkKGxvY2FsSWQpIHtcbiAgICB2YXIgb2JqID0gbG9jYWxDYWNoZUJ5SWRbbG9jYWxJZF07XG4gICAgaWYgKG9iaikge1xuICAgICAgICBpZiAoTG9nZ2VyLmRlYnVnLmlzRW5hYmxlZClcbiAgICAgICAgICAgIExvZ2dlci5kZWJ1ZygnTG9jYWwgY2FjaGUgaGl0OiAnICsgb2JqLl9kdW1wKHRydWUpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBpZiAoTG9nZ2VyLmRlYnVnLmlzRW5hYmxlZClcbiAgICAgICAgICAgIExvZ2dlci5kZWJ1ZygnTG9jYWwgY2FjaGUgbWlzczogJyArIGxvY2FsSWQpO1xuICAgIH1cbiAgICByZXR1cm4gb2JqO1xufVxuXG4vKipcbiAqIFJldHVybiB0aGUgc2luZ2xldG9uIG9iamVjdCBnaXZlbiBhIHNpbmdsZXRvbiBtb2RlbC5cbiAqIEBwYXJhbSAge01vZGVsfSBtb2RlbFxuICogQHJldHVybiB7TW9kZWxJbnN0YW5jZX1cbiAqL1xuZnVuY3Rpb24gZ2V0U2luZ2xldG9uKG1vZGVsKSB7XG4gICAgdmFyIG1vZGVsTmFtZSA9IG1vZGVsLm5hbWU7XG4gICAgdmFyIGNvbGxlY3Rpb25OYW1lID0gbW9kZWwuY29sbGVjdGlvbk5hbWU7XG4gICAgdmFyIGNvbGxlY3Rpb25DYWNoZSA9IGxvY2FsQ2FjaGVbY29sbGVjdGlvbk5hbWVdO1xuICAgIGlmIChjb2xsZWN0aW9uQ2FjaGUpIHtcbiAgICAgICAgdmFyIHR5cGVDYWNoZSA9IGNvbGxlY3Rpb25DYWNoZVttb2RlbE5hbWVdO1xuICAgICAgICBpZiAodHlwZUNhY2hlKSB7XG4gICAgICAgICAgICB2YXIgb2JqcyA9IFtdO1xuICAgICAgICAgICAgZm9yICh2YXIgcHJvcCBpbiB0eXBlQ2FjaGUpIHtcbiAgICAgICAgICAgICAgICBpZiAodHlwZUNhY2hlLmhhc093blByb3BlcnR5KHByb3ApKSB7XG4gICAgICAgICAgICAgICAgICAgIG9ianMucHVzaCh0eXBlQ2FjaGVbcHJvcF0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChvYmpzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICAgICAgICB2YXIgZXJyU3RyID0gJ0Egc2luZ2xldG9uIG1vZGVsIGhhcyBtb3JlIHRoYW4gMSBvYmplY3QgaW4gdGhlIGNhY2hlISBUaGlzIGlzIGEgc2VyaW91cyBlcnJvci4gJyArXG4gICAgICAgICAgICAgICAgICAgICdFaXRoZXIgYSBtb2RlbCBoYXMgYmVlbiBtb2RpZmllZCBhZnRlciBvYmplY3RzIGhhdmUgYWxyZWFkeSBiZWVuIGNyZWF0ZWQsIG9yIHNvbWV0aGluZyBoYXMgZ29uZScgK1xuICAgICAgICAgICAgICAgICAgICAndmVyeSB3cm9uZy4gUGxlYXNlIGZpbGUgYSBidWcgcmVwb3J0IGlmIHRoZSBsYXR0ZXIuJztcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcihlcnJTdHIpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChvYmpzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBvYmpzWzBdO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xufVxuXG4vKipcbiAqIEdpdmVuIGEgcmVtb3RlIGlkZW50aWZpZXIgYW5kIGFuIG9wdGlvbnMgb2JqZWN0IHRoYXQgZGVzY3JpYmVzIG1hcHBpbmcvY29sbGVjdGlvbixcbiAqIHJldHVybiB0aGUgbW9kZWwgaWYgY2FjaGVkLlxuICogQHBhcmFtICB7U3RyaW5nfSByZW1vdGVJZFxuICogQHBhcmFtICB7T2JqZWN0fSBvcHRzXG4gKiBAcmV0dXJuIHtNb2RlbEluc3RhbmNlfVxuICovXG5mdW5jdGlvbiBnZXRWaWFSZW1vdGVJZChyZW1vdGVJZCwgb3B0cykge1xuICAgIHZhciB0eXBlID0gb3B0cy5tb2RlbC5uYW1lO1xuICAgIHZhciBjb2xsZWN0aW9uTmFtZSA9IG9wdHMubW9kZWwuY29sbGVjdGlvbk5hbWU7XG4gICAgdmFyIGNvbGxlY3Rpb25DYWNoZSA9IHJlbW90ZUNhY2hlW2NvbGxlY3Rpb25OYW1lXTtcbiAgICBpZiAoY29sbGVjdGlvbkNhY2hlKSB7XG4gICAgICAgIHZhciB0eXBlQ2FjaGUgPSByZW1vdGVDYWNoZVtjb2xsZWN0aW9uTmFtZV1bdHlwZV07XG4gICAgICAgIGlmICh0eXBlQ2FjaGUpIHtcbiAgICAgICAgICAgIHZhciBvYmogPSB0eXBlQ2FjaGVbcmVtb3RlSWRdO1xuICAgICAgICAgICAgaWYgKG9iaikge1xuICAgICAgICAgICAgICAgIGlmIChMb2dnZXIuZGVidWcpXG4gICAgICAgICAgICAgICAgICAgIExvZ2dlci5kZWJ1ZygnUmVtb3RlIGNhY2hlIGhpdDogJyArIG9iai5fZHVtcCh0cnVlKSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmIChMb2dnZXIuZGVidWcpXG4gICAgICAgICAgICAgICAgICAgIExvZ2dlci5kZWJ1ZygnUmVtb3RlIGNhY2hlIG1pc3M6ICcgKyByZW1vdGVJZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gb2JqO1xuICAgICAgICB9XG4gICAgfVxuICAgIGlmIChMb2dnZXIuZGVidWcpXG4gICAgICAgIExvZ2dlci5kZWJ1ZygnUmVtb3RlIGNhY2hlIG1pc3M6ICcgKyByZW1vdGVJZCk7XG4gICAgcmV0dXJuIG51bGw7XG59XG5cbi8qKlxuICogSW5zZXJ0IGFuIG9iamV0IGludG8gdGhlIGNhY2hlIHVzaW5nIGEgcmVtb3RlIGlkZW50aWZpZXIgZGVmaW5lZCBieSB0aGUgbWFwcGluZy5cbiAqIEBwYXJhbSAge01vZGVsSW5zdGFuY2V9IG9ialxuICogQHBhcmFtICB7U3RyaW5nfSByZW1vdGVJZFxuICogQHBhcmFtICB7U3RyaW5nfSBwcmV2aW91c1JlbW90ZUlkIElmIHJlbW90ZSBpZCBoYXMgYmVlbiBjaGFuZ2VkLCB0aGlzIGlzIHRoZSBvbGQgcmVtb3RlIGlkZW50aWZpZXJcbiAqL1xuZnVuY3Rpb24gcmVtb3RlSW5zZXJ0KG9iaiwgcmVtb3RlSWQsIHByZXZpb3VzUmVtb3RlSWQpIHtcbiAgICBpZiAob2JqKSB7XG4gICAgICAgIHZhciBjb2xsZWN0aW9uTmFtZSA9IG9iai5tb2RlbC5jb2xsZWN0aW9uTmFtZTtcbiAgICAgICAgaWYgKGNvbGxlY3Rpb25OYW1lKSB7XG4gICAgICAgICAgICBpZiAoIXJlbW90ZUNhY2hlW2NvbGxlY3Rpb25OYW1lXSkge1xuICAgICAgICAgICAgICAgIHJlbW90ZUNhY2hlW2NvbGxlY3Rpb25OYW1lXSA9IHt9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdmFyIHR5cGUgPSBvYmoubW9kZWwubmFtZTtcbiAgICAgICAgICAgIGlmICh0eXBlKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFyZW1vdGVDYWNoZVtjb2xsZWN0aW9uTmFtZV1bdHlwZV0pIHtcbiAgICAgICAgICAgICAgICAgICAgcmVtb3RlQ2FjaGVbY29sbGVjdGlvbk5hbWVdW3R5cGVdID0ge307XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChwcmV2aW91c1JlbW90ZUlkKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlbW90ZUNhY2hlW2NvbGxlY3Rpb25OYW1lXVt0eXBlXVtwcmV2aW91c1JlbW90ZUlkXSA9IG51bGw7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHZhciBjYWNoZWRPYmplY3QgPSByZW1vdGVDYWNoZVtjb2xsZWN0aW9uTmFtZV1bdHlwZV1bcmVtb3RlSWRdO1xuICAgICAgICAgICAgICAgIGlmICghY2FjaGVkT2JqZWN0KSB7XG4gICAgICAgICAgICAgICAgICAgIHJlbW90ZUNhY2hlW2NvbGxlY3Rpb25OYW1lXVt0eXBlXVtyZW1vdGVJZF0gPSBvYmo7XG4gICAgICAgICAgICAgICAgICAgIGlmIChMb2dnZXIuZGVidWcuaXNFbmFibGVkKVxuICAgICAgICAgICAgICAgICAgICAgICAgTG9nZ2VyLmRlYnVnKCdSZW1vdGUgY2FjaGUgaW5zZXJ0OiAnICsgb2JqLl9kdW1wKHRydWUpKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKExvZ2dlci50cmFjZS5pc0VuYWJsZWQpXG4gICAgICAgICAgICAgICAgICAgICAgICBMb2dnZXIudHJhY2UoJ1JlbW90ZSBjYWNoZSBub3cgbG9va3MgbGlrZTogJyArIHJlbW90ZUR1bXAodHJ1ZSkpXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gU29tZXRoaW5nIGhhcyBnb25lIHJlYWxseSB3cm9uZy4gT25seSBvbmUgb2JqZWN0IGZvciBhIHBhcnRpY3VsYXIgY29sbGVjdGlvbi90eXBlL3JlbW90ZWlkIGNvbWJvXG4gICAgICAgICAgICAgICAgICAgIC8vIHNob3VsZCBldmVyIGV4aXN0LlxuICAgICAgICAgICAgICAgICAgICBpZiAob2JqICE9IGNhY2hlZE9iamVjdCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG1lc3NhZ2UgPSAnT2JqZWN0ICcgKyBjb2xsZWN0aW9uTmFtZS50b1N0cmluZygpICsgJzonICsgdHlwZS50b1N0cmluZygpICsgJ1snICsgb2JqLm1vZGVsLmlkICsgJz1cIicgKyByZW1vdGVJZCArICdcIl0gYWxyZWFkeSBleGlzdHMgaW4gdGhlIGNhY2hlLicgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICcgVGhpcyBpcyBhIHNlcmlvdXMgZXJyb3IsIHBsZWFzZSBmaWxlIGEgYnVnIHJlcG9ydCBpZiB5b3UgYXJlIGV4cGVyaWVuY2luZyB0aGlzIG91dCBpbiB0aGUgd2lsZCc7XG4gICAgICAgICAgICAgICAgICAgICAgICBMb2dnZXIuZXJyb3IobWVzc2FnZSwge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9iajogb2JqLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhY2hlZE9iamVjdDogY2FjaGVkT2JqZWN0XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKG1lc3NhZ2UpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKExvZ2dlci5kZWJ1Zy5pc0VuYWJsZWQpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgTG9nZ2VyLmRlYnVnKCdPYmplY3QgaGFzIGFscmVhZHkgYmVlbiBpbnNlcnRlZDogJyArIG9iai5fZHVtcCh0cnVlKSk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ01vZGVsIGhhcyBubyB0eXBlJywge1xuICAgICAgICAgICAgICAgICAgICBtb2RlbDogb2JqLm1vZGVsLFxuICAgICAgICAgICAgICAgICAgICBvYmo6IG9ialxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ01vZGVsIGhhcyBubyBjb2xsZWN0aW9uJywge1xuICAgICAgICAgICAgICAgIG1vZGVsOiBvYmoubW9kZWwsXG4gICAgICAgICAgICAgICAgb2JqOiBvYmpcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdmFyIG1zZyA9ICdNdXN0IHBhc3MgYW4gb2JqZWN0IHdoZW4gaW5zZXJ0aW5nIHRvIGNhY2hlJztcbiAgICAgICAgTG9nZ2VyLmVycm9yKG1zZyk7XG4gICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKG1zZyk7XG4gICAgfVxufVxuXG4vKipcbiAqIER1bXAgdGhlIHJlbW90ZSBpZCBjYWNoZVxuICogQHBhcmFtICB7Ym9vbGVhbn0gYXNKc29uIFdoZXRoZXIgb3Igbm90IHRvIGFwcGx5IEpTT04uc3RyaW5naWZ5XG4gKiBAcmV0dXJuIHtTdHJpbmd8T2JqZWN0fVxuICovXG5mdW5jdGlvbiByZW1vdGVEdW1wKGFzSnNvbikge1xuICAgIHZhciBkdW1wZWRSZXN0Q2FjaGUgPSB7fTtcbiAgICBmb3IgKHZhciBjb2xsIGluIHJlbW90ZUNhY2hlKSB7XG4gICAgICAgIGlmIChyZW1vdGVDYWNoZS5oYXNPd25Qcm9wZXJ0eShjb2xsKSkge1xuICAgICAgICAgICAgdmFyIGR1bXBlZENvbGxDYWNoZSA9IHt9O1xuICAgICAgICAgICAgZHVtcGVkUmVzdENhY2hlW2NvbGxdID0gZHVtcGVkQ29sbENhY2hlO1xuICAgICAgICAgICAgdmFyIGNvbGxDYWNoZSA9IHJlbW90ZUNhY2hlW2NvbGxdO1xuICAgICAgICAgICAgZm9yICh2YXIgbW9kZWwgaW4gY29sbENhY2hlKSB7XG4gICAgICAgICAgICAgICAgaWYgKGNvbGxDYWNoZS5oYXNPd25Qcm9wZXJ0eShtb2RlbCkpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGR1bXBlZE1vZGVsQ2FjaGUgPSB7fTtcbiAgICAgICAgICAgICAgICAgICAgZHVtcGVkQ29sbENhY2hlW21vZGVsXSA9IGR1bXBlZE1vZGVsQ2FjaGU7XG4gICAgICAgICAgICAgICAgICAgIHZhciBtb2RlbENhY2hlID0gY29sbENhY2hlW21vZGVsXTtcbiAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgcmVtb3RlSWQgaW4gbW9kZWxDYWNoZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG1vZGVsQ2FjaGUuaGFzT3duUHJvcGVydHkocmVtb3RlSWQpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG1vZGVsQ2FjaGVbcmVtb3RlSWRdKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGR1bXBlZE1vZGVsQ2FjaGVbcmVtb3RlSWRdID0gbW9kZWxDYWNoZVtyZW1vdGVJZF0uX2R1bXAoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGFzSnNvbiA/IHV0aWwucHJldHR5UHJpbnQoKGR1bXBlZFJlc3RDYWNoZSwgbnVsbCwgNCkpIDogZHVtcGVkUmVzdENhY2hlO1xufVxuXG4vKipcbiAqIER1bXAgdGhlIGxvY2FsIGlkIChfaWQpIGNhY2hlXG4gKiBAcGFyYW0gIHtib29sZWFufSBhc0pzb24gV2hldGhlciBvciBub3QgdG8gYXBwbHkgSlNPTi5zdHJpbmdpZnlcbiAqIEByZXR1cm4ge1N0cmluZ3xPYmplY3R9XG4gKi9cbmZ1bmN0aW9uIGxvY2FsRHVtcChhc0pzb24pIHtcbiAgICB2YXIgZHVtcGVkSWRDYWNoZSA9IHt9O1xuICAgIGZvciAodmFyIGlkIGluIGxvY2FsQ2FjaGVCeUlkKSB7XG4gICAgICAgIGlmIChsb2NhbENhY2hlQnlJZC5oYXNPd25Qcm9wZXJ0eShpZCkpIHtcbiAgICAgICAgICAgIGR1bXBlZElkQ2FjaGVbaWRdID0gbG9jYWxDYWNoZUJ5SWRbaWRdLl9kdW1wKClcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gYXNKc29uID8gdXRpbC5wcmV0dHlQcmludCgoZHVtcGVkSWRDYWNoZSwgbnVsbCwgNCkpIDogZHVtcGVkSWRDYWNoZTtcbn1cblxuLyoqXG4gKiBEdW1wIHRvIHRoZSBjYWNoZS5cbiAqIEBwYXJhbSAge2Jvb2xlYW59IGFzSnNvbiBXaGV0aGVyIG9yIG5vdCB0byBhcHBseSBKU09OLnN0cmluZ2lmeVxuICogQHJldHVybiB7U3RyaW5nfE9iamVjdH1cbiAqL1xuZnVuY3Rpb24gZHVtcChhc0pzb24pIHtcbiAgICB2YXIgZHVtcGVkID0ge1xuICAgICAgICBsb2NhbENhY2hlOiBsb2NhbER1bXAoKSxcbiAgICAgICAgcmVtb3RlQ2FjaGU6IHJlbW90ZUR1bXAoKVxuICAgIH07XG4gICAgcmV0dXJuIGFzSnNvbiA/IHV0aWwucHJldHR5UHJpbnQoKGR1bXBlZCwgbnVsbCwgNCkpIDogZHVtcGVkO1xufVxuXG5mdW5jdGlvbiBfcmVtb3RlQ2FjaGUoKSB7XG4gICAgcmV0dXJuIHJlbW90ZUNhY2hlXG59XG5cbmZ1bmN0aW9uIF9sb2NhbENhY2hlKCkge1xuICAgIHJldHVybiBsb2NhbENhY2hlQnlJZDtcbn1cblxuLyoqXG4gKiBRdWVyeSB0aGUgY2FjaGVcbiAqIEBwYXJhbSAge09iamVjdH0gb3B0cyBPYmplY3QgZGVzY3JpYmluZyB0aGUgcXVlcnlcbiAqIEByZXR1cm4ge01vZGVsSW5zdGFuY2V9XG4gKiBAZXhhbXBsZVxuICogYGBganNcbiAqIGNhY2hlLmdldCh7X2lkOiAnNSd9KTsgLy8gUXVlcnkgYnkgbG9jYWwgaWRcbiAqIGNhY2hlLmdldCh7cmVtb3RlSWQ6ICc1JywgbWFwcGluZzogbXlNYXBwaW5nfSk7IC8vIFF1ZXJ5IGJ5IHJlbW90ZSBpZFxuICogYGBgXG4gKi9cbmZ1bmN0aW9uIGdldChvcHRzKSB7XG4gICAgaWYgKExvZ2dlci5kZWJ1Zy5pc0VuYWJsZWQpIExvZ2dlci5kZWJ1ZygnZ2V0Jywgb3B0cyk7XG4gICAgdmFyIG9iaiwgaWRGaWVsZCwgcmVtb3RlSWQ7XG4gICAgdmFyIGxvY2FsSWQgPSBvcHRzLl9pZDtcbiAgICBpZiAobG9jYWxJZCkge1xuICAgICAgICBvYmogPSBnZXRWaWFMb2NhbElkKGxvY2FsSWQpO1xuICAgICAgICBpZiAob2JqKSB7XG4gICAgICAgICAgICByZXR1cm4gb2JqO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaWYgKG9wdHMubW9kZWwpIHtcbiAgICAgICAgICAgICAgICBpZEZpZWxkID0gb3B0cy5tb2RlbC5pZDtcbiAgICAgICAgICAgICAgICByZW1vdGVJZCA9IG9wdHNbaWRGaWVsZF07XG4gICAgICAgICAgICAgICAgaWYgKExvZ2dlci5kZWJ1Zy5pc0VuYWJsZWQpIExvZ2dlci5kZWJ1ZyhpZEZpZWxkICsgJz0nICsgcmVtb3RlSWQpO1xuICAgICAgICAgICAgICAgIHJldHVybiBnZXRWaWFSZW1vdGVJZChyZW1vdGVJZCwgb3B0cyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSBlbHNlIGlmIChvcHRzLm1vZGVsKSB7XG4gICAgICAgIGlkRmllbGQgPSBvcHRzLm1vZGVsLmlkO1xuICAgICAgICByZW1vdGVJZCA9IG9wdHNbaWRGaWVsZF07XG4gICAgICAgIGlmIChyZW1vdGVJZCkge1xuICAgICAgICAgICAgcmV0dXJuIGdldFZpYVJlbW90ZUlkKHJlbW90ZUlkLCBvcHRzKTtcbiAgICAgICAgfSBlbHNlIGlmIChvcHRzLm1vZGVsLnNpbmdsZXRvbikge1xuICAgICAgICAgICAgcmV0dXJuIGdldFNpbmdsZXRvbihvcHRzLm1vZGVsKTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIExvZ2dlci53YXJuKCdJbnZhbGlkIG9wdHMgdG8gY2FjaGUnLCB7XG4gICAgICAgICAgICBvcHRzOiBvcHRzXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbn1cblxuLyoqXG4gKiBJbnNlcnQgYW4gb2JqZWN0IGludG8gdGhlIGNhY2hlLlxuICogQHBhcmFtICB7TW9kZWxJbnN0YW5jZX0gb2JqXG4gKiBAdGhyb3dzIHtJbnRlcm5hbFNpZXN0YUVycm9yfSBBbiBvYmplY3Qgd2l0aCBfaWQvcmVtb3RlSWQgYWxyZWFkeSBleGlzdHMuIE5vdCB0aHJvd24gaWYgc2FtZSBvYmhlY3QuXG4gKi9cbmZ1bmN0aW9uIGluc2VydChvYmopIHtcbiAgICB2YXIgbG9jYWxJZCA9IG9iai5faWQ7XG4gICAgaWYgKGxvY2FsSWQpIHtcbiAgICAgICAgdmFyIGNvbGxlY3Rpb25OYW1lID0gb2JqLm1vZGVsLmNvbGxlY3Rpb25OYW1lO1xuICAgICAgICB2YXIgbW9kZWxOYW1lID0gb2JqLm1vZGVsLm5hbWU7XG4gICAgICAgIGlmIChMb2dnZXIuZGVidWcuaXNFbmFibGVkKVxuICAgICAgICAgICAgTG9nZ2VyLmRlYnVnKCdMb2NhbCBjYWNoZSBpbnNlcnQ6ICcgKyBvYmouX2R1bXBTdHJpbmcoKSk7XG4gICAgICAgIGlmICghbG9jYWxDYWNoZUJ5SWRbbG9jYWxJZF0pIHtcbiAgICAgICAgICAgIGxvY2FsQ2FjaGVCeUlkW2xvY2FsSWRdID0gb2JqO1xuICAgICAgICAgICAgaWYgKExvZ2dlci50cmFjZS5pc0VuYWJsZWQpXG4gICAgICAgICAgICAgICAgTG9nZ2VyLnRyYWNlKCdMb2NhbCBjYWNoZSBub3cgbG9va3MgbGlrZTogJyArIGxvY2FsRHVtcCh0cnVlKSk7XG4gICAgICAgICAgICBpZiAoIWxvY2FsQ2FjaGVbY29sbGVjdGlvbk5hbWVdKSBsb2NhbENhY2hlW2NvbGxlY3Rpb25OYW1lXSA9IHt9O1xuICAgICAgICAgICAgaWYgKCFsb2NhbENhY2hlW2NvbGxlY3Rpb25OYW1lXVttb2RlbE5hbWVdKSBsb2NhbENhY2hlW2NvbGxlY3Rpb25OYW1lXVttb2RlbE5hbWVdID0ge307XG4gICAgICAgICAgICBsb2NhbENhY2hlW2NvbGxlY3Rpb25OYW1lXVttb2RlbE5hbWVdW2xvY2FsSWRdID0gb2JqO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gU29tZXRoaW5nIGhhcyBnb25lIGJhZGx5IHdyb25nIGhlcmUuIFR3byBvYmplY3RzIHNob3VsZCBuZXZlciBleGlzdCB3aXRoIHRoZSBzYW1lIF9pZFxuICAgICAgICAgICAgaWYgKGxvY2FsQ2FjaGVCeUlkW2xvY2FsSWRdICE9IG9iaikge1xuICAgICAgICAgICAgICAgIHZhciBtZXNzYWdlID0gJ09iamVjdCB3aXRoIF9pZD1cIicgKyBsb2NhbElkLnRvU3RyaW5nKCkgKyAnXCIgaXMgYWxyZWFkeSBpbiB0aGUgY2FjaGUuICcgK1xuICAgICAgICAgICAgICAgICAgICAnVGhpcyBpcyBhIHNlcmlvdXMgZXJyb3IuIFBsZWFzZSBmaWxlIGEgYnVnIHJlcG9ydCBpZiB5b3UgYXJlIGV4cGVyaWVuY2luZyB0aGlzIG91dCBpbiB0aGUgd2lsZCc7XG4gICAgICAgICAgICAgICAgTG9nZ2VyLmVycm9yKG1lc3NhZ2UpO1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKG1lc3NhZ2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIHZhciBpZEZpZWxkID0gb2JqLmlkRmllbGQ7XG4gICAgdmFyIHJlbW90ZUlkID0gb2JqW2lkRmllbGRdO1xuICAgIGlmIChyZW1vdGVJZCkge1xuICAgICAgICByZW1vdGVJbnNlcnQob2JqLCByZW1vdGVJZCk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKExvZ2dlci5kZWJ1Zy5pc0VuYWJsZWQpXG4gICAgICAgICAgICBMb2dnZXIuZGVidWcoJ05vIHJlbW90ZSBpZCAoXCInICsgaWRGaWVsZCArICdcIikgc28gd29udCBiZSBwbGFjaW5nIGluIHRoZSByZW1vdGUgY2FjaGUnLCBvYmopO1xuICAgIH1cbn1cblxuLyoqXG4gKiBSZXR1cm5zIHRydWUgaWYgb2JqZWN0IGlzIGluIHRoZSBjYWNoZVxuICogQHBhcmFtICB7TW9kZWxJbnN0YW5jZX0gb2JqXG4gKiBAcmV0dXJuIHtib29sZWFufVxuICovXG5mdW5jdGlvbiBjb250YWlucyhvYmopIHtcbiAgICB2YXIgcSA9IHtcbiAgICAgICAgX2lkOiBvYmouX2lkXG4gICAgfTtcbiAgICB2YXIgbW9kZWwgPSBvYmoubW9kZWw7XG4gICAgaWYgKG1vZGVsLmlkKSB7XG4gICAgICAgIGlmIChvYmpbbW9kZWwuaWRdKSB7XG4gICAgICAgICAgICBxLm1vZGVsID0gbW9kZWw7XG4gICAgICAgICAgICBxW21vZGVsLmlkXSA9IG9ialttb2RlbC5pZF07XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuICEhZ2V0KHEpO1xufVxuXG4vKipcbiAqIFJlbW92ZXMgdGhlIG9iamVjdCBmcm9tIHRoZSBjYWNoZSAoaWYgaXQncyBhY3R1YWxseSBpbiB0aGUgY2FjaGUpIG90aGVyd2lzZXMgdGhyb3dzIGFuIGVycm9yLlxuICogQHBhcmFtICB7TW9kZWxJbnN0YW5jZX0gb2JqXG4gKiBAdGhyb3dzIHtJbnRlcm5hbFNpZXN0YUVycm9yfSBJZiBvYmplY3QgYWxyZWFkeSBpbiB0aGUgY2FjaGUuXG4gKi9cbmZ1bmN0aW9uIHJlbW92ZShvYmopIHtcbiAgICBpZiAoY29udGFpbnMob2JqKSkge1xuICAgICAgICB2YXIgY29sbGVjdGlvbk5hbWUgPSBvYmoubW9kZWwuY29sbGVjdGlvbk5hbWU7XG4gICAgICAgIHZhciBtb2RlbE5hbWUgPSBvYmoubW9kZWwubmFtZTtcbiAgICAgICAgdmFyIF9pZCA9IG9iai5faWQ7XG4gICAgICAgIGlmICghbW9kZWxOYW1lKSB0aHJvdyBJbnRlcm5hbFNpZXN0YUVycm9yKCdObyBtYXBwaW5nIG5hbWUnKTtcbiAgICAgICAgaWYgKCFjb2xsZWN0aW9uTmFtZSkgdGhyb3cgSW50ZXJuYWxTaWVzdGFFcnJvcignTm8gY29sbGVjdGlvbiBuYW1lJyk7XG4gICAgICAgIGlmICghX2lkKSB0aHJvdyBJbnRlcm5hbFNpZXN0YUVycm9yKCdObyBfaWQnKTtcbiAgICAgICAgZGVsZXRlIGxvY2FsQ2FjaGVbY29sbGVjdGlvbk5hbWVdW21vZGVsTmFtZV1bX2lkXTtcbiAgICAgICAgZGVsZXRlIGxvY2FsQ2FjaGVCeUlkW19pZF07XG4gICAgICAgIGlmIChvYmoubW9kZWwuaWQpIHtcbiAgICAgICAgICAgIHZhciByZW1vdGVJZCA9IG9ialtvYmoubW9kZWwuaWRdO1xuICAgICAgICAgICAgaWYgKHJlbW90ZUlkKSB7XG4gICAgICAgICAgICAgICAgZGVsZXRlIHJlbW90ZUNhY2hlW2NvbGxlY3Rpb25OYW1lXVttb2RlbE5hbWVdW3JlbW90ZUlkXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdPYmplY3Qgd2FzIG5vdCBpbiBjYWNoZS4nKTtcbiAgICB9XG59XG5cblxuZXhwb3J0cy5fcmVtb3RlQ2FjaGUgPSBfcmVtb3RlQ2FjaGU7XG5leHBvcnRzLl9sb2NhbENhY2hlID0gX2xvY2FsQ2FjaGU7XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgJ19sb2NhbENhY2hlQnlUeXBlJywge1xuICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gbG9jYWxDYWNoZTtcbiAgICB9XG59KTtcbmV4cG9ydHMuZ2V0ID0gZ2V0O1xuZXhwb3J0cy5pbnNlcnQgPSBpbnNlcnQ7XG5leHBvcnRzLnJlbW90ZUluc2VydCA9IHJlbW90ZUluc2VydDtcbmV4cG9ydHMucmVzZXQgPSByZXNldDtcbmV4cG9ydHMuX2R1bXAgPSBkdW1wO1xuZXhwb3J0cy5jb250YWlucyA9IGNvbnRhaW5zO1xuZXhwb3J0cy5yZW1vdmUgPSByZW1vdmU7IiwiLyoqXG4gKiBAbW9kdWxlIGNvbGxlY3Rpb25cbiAqL1xuXG52YXIgbG9nID0gcmVxdWlyZSgnLi9sb2cnKSxcbiAgICBDb2xsZWN0aW9uUmVnaXN0cnkgPSByZXF1aXJlKCcuL2NvbGxlY3Rpb25SZWdpc3RyeScpLkNvbGxlY3Rpb25SZWdpc3RyeSxcbiAgICBJbnRlcm5hbFNpZXN0YUVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpLkludGVybmFsU2llc3RhRXJyb3IsXG4gICAgTW9kZWwgPSByZXF1aXJlKCcuL21vZGVsJyksXG4gICAgZXh0ZW5kID0gcmVxdWlyZSgnZXh0ZW5kJyksXG4gICAgb2JzZXJ2ZSA9IHJlcXVpcmUoJy4uL3ZlbmRvci9vYnNlcnZlLWpzL3NyYy9vYnNlcnZlJykuUGxhdGZvcm0sXG4gICAgZXZlbnRzID0gcmVxdWlyZSgnLi9ldmVudHMnKSxcbiAgICB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyksXG4gICAgXyA9IHV0aWwuXyxcbiAgICBlcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKSxcbiAgICBjb25zdHJ1Y3RFcnJvciA9IGVycm9yLmVycm9yRmFjdG9yeShlcnJvci5Db21wb25lbnRzLkNvbGxlY3Rpb24pLFxuICAgIGNhY2hlID0gcmVxdWlyZSgnLi9jYWNoZScpO1xuXG52YXIgVU5TQUZFX01FVEhPRFMgPSBbJ1BVVCcsICdQQVRDSCcsICdQT1NUJywgJ0RFTEVURSddLFxuICAgIExvZ2dlciA9IGxvZy5sb2dnZXJXaXRoTmFtZSgnQ29sbGVjdGlvbicpO1xuXG4vKipcbiAqIEEgY29sbGVjdGlvbiBkZXNjcmliZXMgYSBzZXQgb2YgbW9kZWxzIGFuZCBvcHRpb25hbGx5IGEgUkVTVCBBUEkgd2hpY2ggd2Ugd291bGRcbiAqIGxpa2UgdG8gbW9kZWwuXG4gKlxuICogQHBhcmFtIG5hbWVcbiAqIEBwYXJhbSBvcHRzXG4gKiBAY29uc3RydWN0b3JcbiAqXG4gKlxuICogQGV4YW1wbGVcbiAqIGBgYGpzXG4gKiB2YXIgR2l0SHViID0gbmV3IHNpZXN0YSgnR2l0SHViJylcbiAqIC8vIC4uLiBjb25maWd1cmUgbWFwcGluZ3MsIGRlc2NyaXB0b3JzIGV0YyAuLi5cbiAqIEdpdEh1Yi5pbnN0YWxsKGZ1bmN0aW9uICgpIHtcbiAqICAgICAvLyAuLi4gY2Fycnkgb24uXG4gKiB9KTtcbiAqIGBgYFxuICovXG5mdW5jdGlvbiBDb2xsZWN0aW9uKG5hbWUsIG9wdHMpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgaWYgKCFuYW1lKSB0aHJvdyBuZXcgRXJyb3IoJ0NvbGxlY3Rpb24gbXVzdCBoYXZlIGEgbmFtZScpO1xuXG4gICAgdXRpbC5leHRlbmRGcm9tT3B0cyh0aGlzLCBvcHRzIHx8IHt9LCB7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgVVJMIG9mIHRoZSBBUEkgZS5nLiBodHRwOi8vYXBpLmdpdGh1Yi5jb21cbiAgICAgICAgICogQHR5cGUge3N0cmluZ31cbiAgICAgICAgICovXG4gICAgICAgIGJhc2VVUkw6ICcnXG4gICAgfSk7XG5cbiAgICBfLmV4dGVuZCh0aGlzLCB7XG4gICAgICAgIG5hbWU6IG5hbWUsXG4gICAgICAgIF9yYXdNb2RlbHM6IHt9LFxuICAgICAgICBfbW9kZWxzOiB7fSxcbiAgICAgICAgLyoqXG4gICAgICAgICAqIFNldCB0byB0cnVlIGlmIGluc3RhbGxhdGlvbiBoYXMgc3VjY2VlZGVkLiBZb3UgY2Fubm90IHVzZSB0aGUgY29sbGVjdGlvXG4gICAgICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAgICAgKi9cbiAgICAgICAgaW5zdGFsbGVkOiBmYWxzZVxuICAgIH0pO1xuXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnRpZXModGhpcywge1xuICAgICAgICBkaXJ0eToge1xuICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgaWYgKHNpZXN0YS5leHQuc3RvcmFnZUVuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHVuc2F2ZWRPYmplY3RzQnlDb2xsZWN0aW9uID0gc2llc3RhLmV4dC5zdG9yYWdlLl91bnNhdmVkT2JqZWN0c0J5Q29sbGVjdGlvbixcbiAgICAgICAgICAgICAgICAgICAgICAgIGhhc2ggPSB1bnNhdmVkT2JqZWN0c0J5Q29sbGVjdGlvbltzZWxmLm5hbWVdIHx8IHt9O1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gISFPYmplY3Qua2V5cyhoYXNoKS5sZW5ndGg7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2UgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlXG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIENvbGxlY3Rpb25SZWdpc3RyeS5yZWdpc3Rlcih0aGlzKTtcbn1cblxuXy5leHRlbmQoQ29sbGVjdGlvbi5wcm90b3R5cGUsIHtcbiAgICAvKipcbiAgICAgKiBFbnN1cmUgbWFwcGluZ3MgYXJlIGluc3RhbGxlZC5cbiAgICAgKiBAcGFyYW0gW2NhbGxiYWNrXVxuICAgICAqIEBjbGFzcyBDb2xsZWN0aW9uXG4gICAgICovXG4gICAgaW5zdGFsbDogZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgICAgIHZhciBkZWZlcnJlZCA9IHV0aWwuZGVmZXIoY2FsbGJhY2spO1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgIGlmICghdGhpcy5pbnN0YWxsZWQpIHtcbiAgICAgICAgICAgIHZhciBtb2RlbHNUb0luc3RhbGwgPSBbXTtcbiAgICAgICAgICAgIGZvciAodmFyIG5hbWUgaW4gdGhpcy5fbW9kZWxzKSB7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuX21vZGVscy5oYXNPd25Qcm9wZXJ0eShuYW1lKSkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgbW9kZWwgPSB0aGlzLl9tb2RlbHNbbmFtZV07XG4gICAgICAgICAgICAgICAgICAgIG1vZGVsc1RvSW5zdGFsbC5wdXNoKG1vZGVsKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoTG9nZ2VyLmluZm8uaXNFbmFibGVkKVxuICAgICAgICAgICAgICAgIExvZ2dlci5pbmZvKCdUaGVyZSBhcmUgJyArIG1vZGVsc1RvSW5zdGFsbC5sZW5ndGgudG9TdHJpbmcoKSArICcgbWFwcGluZ3MgdG8gaW5zdGFsbCcpO1xuICAgICAgICAgICAgaWYgKG1vZGVsc1RvSW5zdGFsbC5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICB2YXIgdGFza3MgPSBfLm1hcChtb2RlbHNUb0luc3RhbGwsIGZ1bmN0aW9uIChtKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBfLmJpbmQobS5pbnN0YWxsLCBtKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB1dGlsLmFzeW5jLnBhcmFsbGVsKHRhc2tzLCBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIExvZ2dlci5lcnJvcignRmFpbGVkIHRvIGluc3RhbGwgY29sbGVjdGlvbicsIGVycik7XG4gICAgICAgICAgICAgICAgICAgICAgICBzZWxmLl9maW5hbGlzZUluc3RhbGxhdGlvbihlcnIsIGRlZmVycmVkLmZpbmlzaC5iaW5kKGRlZmVycmVkKSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzZWxmLmluc3RhbGxlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgZXJyb3JzID0gW107XG4gICAgICAgICAgICAgICAgICAgICAgICBfLmVhY2gobW9kZWxzVG9JbnN0YWxsLCBmdW5jdGlvbiAobSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChMb2dnZXIuaW5mby5pc0VuYWJsZWQpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIExvZ2dlci5pbmZvKCdJbnN0YWxsaW5nIHJlbGF0aW9uc2hpcHMgZm9yIG1hcHBpbmcgd2l0aCBuYW1lIFwiJyArIG0ubmFtZSArICdcIicpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBlcnIgPSBtLmluc3RhbGxSZWxhdGlvbnNoaXBzKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVycikgZXJyb3JzLnB1c2goZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFlcnJvcnMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXy5lYWNoKG1vZGVsc1RvSW5zdGFsbCwgZnVuY3Rpb24gKG0pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKExvZ2dlci5pbmZvLmlzRW5hYmxlZClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIExvZ2dlci5pbmZvKCdJbnN0YWxsaW5nIHJldmVyc2UgcmVsYXRpb25zaGlwcyBmb3IgbWFwcGluZyB3aXRoIG5hbWUgXCInICsgbS5uYW1lICsgJ1wiJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBlcnIgPSBtLmluc3RhbGxSZXZlcnNlUmVsYXRpb25zaGlwcygpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKSBlcnJvcnMucHVzaChlcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVycm9ycy5sZW5ndGggPT0gMSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVyciA9IGVycm9yc1swXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoZXJyb3JzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVyciA9IGVycm9ycztcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYuX2ZpbmFsaXNlSW5zdGFsbGF0aW9uKGVyciwgZGVmZXJyZWQuZmluaXNoLmJpbmQoZGVmZXJyZWQpKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHNlbGYuX2ZpbmFsaXNlSW5zdGFsbGF0aW9uKG51bGwsIGRlZmVycmVkLmZpbmlzaC5iaW5kKGRlZmVycmVkKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB2YXIgZXJyID0gbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ0NvbGxlY3Rpb24gXCInICsgdGhpcy5uYW1lICsgJ1wiIGhhcyBhbHJlYWR5IGJlZW4gaW5zdGFsbGVkJyk7XG4gICAgICAgICAgICBzZWxmLl9maW5hbGlzZUluc3RhbGxhdGlvbihlcnIsIGRlZmVycmVkLmZpbmlzaC5iaW5kKGRlZmVycmVkKSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIE1hcmsgdGhpcyBjb2xsZWN0aW9uIGFzIGluc3RhbGxlZCwgYW5kIHBsYWNlIHRoZSBjb2xsZWN0aW9uIG9uIHRoZSBnbG9iYWwgU2llc3RhIG9iamVjdC5cbiAgICAgKiBAcGFyYW0gIHtPYmplY3R9ICAgZXJyXG4gICAgICogQHBhcmFtICB7RnVuY3Rpb259IGNhbGxiYWNrXG4gICAgICogQGNsYXNzIENvbGxlY3Rpb25cbiAgICAgKi9cbiAgICBfZmluYWxpc2VJbnN0YWxsYXRpb246IGZ1bmN0aW9uIChlcnIsIGNhbGxiYWNrKSB7XG4gICAgICAgIGlmIChlcnIpIGVyciA9IGNvbnN0cnVjdEVycm9yKCdFcnJvcnMgd2VyZSBlbmNvdW50ZXJlZCB3aGlsc3Qgc2V0dGluZyB1cCB0aGUgY29sbGVjdGlvbicsIHtlcnJvcnM6IGVycn0pO1xuICAgICAgICBpZiAoIWVycikge1xuICAgICAgICAgICAgdGhpcy5pbnN0YWxsZWQgPSB0cnVlO1xuICAgICAgICAgICAgdmFyIGluZGV4ID0gcmVxdWlyZSgnLi9pbmRleCcpO1xuICAgICAgICAgICAgaW5kZXhbdGhpcy5uYW1lXSA9IHRoaXM7XG4gICAgICAgIH1cbiAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIEdpdmVuIHRoZSBuYW1lIG9mIGEgbWFwcGluZyBhbmQgYW4gb3B0aW9ucyBvYmplY3QgZGVzY3JpYmluZyB0aGUgbWFwcGluZywgY3JlYXRpbmcgYSBNb2RlbFxuICAgICAqIG9iamVjdCwgaW5zdGFsbCBpdCBhbmQgcmV0dXJuIGl0LlxuICAgICAqIEBwYXJhbSAge1N0cmluZ30gbmFtZVxuICAgICAqIEBwYXJhbSAge09iamVjdH0gb3B0c1xuICAgICAqIEByZXR1cm4ge01vZGVsfVxuICAgICAqIEBjbGFzcyBDb2xsZWN0aW9uXG4gICAgICovXG4gICAgX21vZGVsOiBmdW5jdGlvbiAobmFtZSwgb3B0cykge1xuICAgICAgICBpZiAobmFtZSkge1xuICAgICAgICAgICAgdGhpcy5fcmF3TW9kZWxzW25hbWVdID0gb3B0cztcbiAgICAgICAgICAgIG9wdHMgPSBleHRlbmQodHJ1ZSwge30sIG9wdHMpO1xuICAgICAgICAgICAgb3B0cy5uYW1lID0gbmFtZTtcbiAgICAgICAgICAgIG9wdHMuY29sbGVjdGlvbiA9IHRoaXM7XG4gICAgICAgICAgICB2YXIgbW9kZWwgPSBuZXcgTW9kZWwob3B0cyk7XG4gICAgICAgICAgICB0aGlzLl9tb2RlbHNbbmFtZV0gPSBtb2RlbDtcbiAgICAgICAgICAgIHRoaXNbbmFtZV0gPSBtb2RlbDtcbiAgICAgICAgICAgIHJldHVybiBtb2RlbDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignTm8gbmFtZSBzcGVjaWZpZWQgd2hlbiBjcmVhdGluZyBtYXBwaW5nJyk7XG4gICAgICAgIH1cbiAgICB9LFxuXG5cbiAgICAvKipcbiAgICAgKiBSZWdpc3RlcnMgYSBtb2RlbCB3aXRoIHRoaXMgY29sbGVjdGlvbi5cbiAgICAgKiBAcGFyYW0ge1N0cmluZ3xPYmplY3R9IG9wdHNPck5hbWUgQW4gb3B0aW9ucyBvYmplY3Qgb3IgdGhlIG5hbWUgb2YgdGhlIG1hcHBpbmcuIE11c3QgcGFzcyBvcHRpb25zIGFzIHNlY29uZCBwYXJhbSBpZiBzcGVjaWZ5IG5hbWUuXG4gICAgICogQHBhcmFtIHtPYmplY3R9IG9wdHMgT3B0aW9ucyBpZiBuYW1lIGFscmVhZHkgc3BlY2lmaWVkLlxuICAgICAqIEByZXR1cm4ge01vZGVsfVxuICAgICAqIEBjbGFzcyBDb2xsZWN0aW9uXG4gICAgICovXG4gICAgbW9kZWw6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIGFjY2VwdE1vZGVscyA9ICF0aGlzLmluc3RhbGxlZDtcbiAgICAgICAgaWYgKGFjY2VwdE1vZGVscykge1xuICAgICAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICAgICAgaWYgKGFyZ3VtZW50cy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PSAxKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICh1dGlsLmlzQXJyYXkoYXJndW1lbnRzWzBdKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIF8ubWFwKGFyZ3VtZW50c1swXSwgZnVuY3Rpb24gKG0pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gc2VsZi5fbW9kZWwobS5uYW1lLCBtKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuX21vZGVsKGFyZ3VtZW50c1swXS5uYW1lLCBhcmd1bWVudHNbMF0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBhcmd1bWVudHNbMF0gPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLl9tb2RlbChhcmd1bWVudHNbMF0sIGFyZ3VtZW50c1sxXSk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gXy5tYXAoYXJndW1lbnRzLCBmdW5jdGlvbiAobSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBzZWxmLl9tb2RlbChtLm5hbWUsIG0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICB0aHJvdyBFcnJvcignQ2Fubm90IGNyZWF0ZSBuZXcgbW9kZWxzIG9uY2UgdGhlIG9iamVjdCBncmFwaCBpcyBlc3RhYmxpc2hlZCEnKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9LFxuXG4gICAgZGVzY3JpcHRvcjogZnVuY3Rpb24gKG9wdHMpIHtcbiAgICAgICAgdmFyIGRlc2NyaXB0b3JzID0gW107XG4gICAgICAgIGlmIChzaWVzdGEuZXh0Lmh0dHBFbmFibGVkKSB7XG4gICAgICAgICAgICBvcHRzLmNvbGxlY3Rpb24gPSB0aGlzO1xuICAgICAgICAgICAgdmFyIG1ldGhvZHMgPSBzaWVzdGEuZXh0Lmh0dHAuX3Jlc29sdmVNZXRob2Qob3B0cy5tZXRob2QpO1xuICAgICAgICAgICAgdmFyIHVuc2FmZSA9IFtdO1xuICAgICAgICAgICAgdmFyIHNhZmUgPSBbXTtcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbWV0aG9kcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIHZhciBtID0gbWV0aG9kc1tpXTtcbiAgICAgICAgICAgICAgICBpZiAoVU5TQUZFX01FVEhPRFMuaW5kZXhPZihtKSA+IC0xKSB7XG4gICAgICAgICAgICAgICAgICAgIHVuc2FmZS5wdXNoKG0pO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHNhZmUucHVzaChtKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodW5zYWZlLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIHZhciByZXF1ZXN0RGVzY3JpcHRvciA9IGV4dGVuZCh7fSwgb3B0cyk7XG4gICAgICAgICAgICAgICAgcmVxdWVzdERlc2NyaXB0b3IubWV0aG9kID0gdW5zYWZlO1xuICAgICAgICAgICAgICAgIHJlcXVlc3REZXNjcmlwdG9yID0gbmV3IHNpZXN0YS5leHQuaHR0cC5SZXF1ZXN0RGVzY3JpcHRvcihyZXF1ZXN0RGVzY3JpcHRvcik7XG4gICAgICAgICAgICAgICAgc2llc3RhLmV4dC5odHRwLkRlc2NyaXB0b3JSZWdpc3RyeS5yZWdpc3RlclJlcXVlc3REZXNjcmlwdG9yKHJlcXVlc3REZXNjcmlwdG9yKTtcbiAgICAgICAgICAgICAgICBkZXNjcmlwdG9ycy5wdXNoKHJlcXVlc3REZXNjcmlwdG9yKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzYWZlLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIHZhciByZXNwb25zZURlc2NyaXB0b3IgPSBleHRlbmQoe30sIG9wdHMpO1xuICAgICAgICAgICAgICAgIHJlc3BvbnNlRGVzY3JpcHRvci5tZXRob2QgPSBzYWZlO1xuICAgICAgICAgICAgICAgIHJlc3BvbnNlRGVzY3JpcHRvciA9IG5ldyBzaWVzdGEuZXh0Lmh0dHAuUmVzcG9uc2VEZXNjcmlwdG9yKHJlc3BvbnNlRGVzY3JpcHRvcik7XG4gICAgICAgICAgICAgICAgc2llc3RhLmV4dC5odHRwLkRlc2NyaXB0b3JSZWdpc3RyeS5yZWdpc3RlclJlc3BvbnNlRGVzY3JpcHRvcihyZXNwb25zZURlc2NyaXB0b3IpO1xuICAgICAgICAgICAgICAgIGRlc2NyaXB0b3JzLnB1c2gocmVzcG9uc2VEZXNjcmlwdG9yKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignSFRUUCBtb2R1bGUgbm90IGluc3RhbGxlZC4nKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZGVzY3JpcHRvcnM7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIER1bXAgdGhpcyBjb2xsZWN0aW9uIGFzIEpTT05cbiAgICAgKiBAcGFyYW0gIHtCb29sZWFufSBhc0pzb24gV2hldGhlciBvciBub3QgdG8gYXBwbHkgSlNPTi5zdHJpbmdpZnlcbiAgICAgKiBAcmV0dXJuIHtTdHJpbmd8T2JqZWN0fVxuICAgICAqIEBjbGFzcyBDb2xsZWN0aW9uXG4gICAgICovXG4gICAgX2R1bXA6IGZ1bmN0aW9uIChhc0pzb24pIHtcbiAgICAgICAgdmFyIG9iaiA9IHt9O1xuICAgICAgICBvYmouaW5zdGFsbGVkID0gdGhpcy5pbnN0YWxsZWQ7XG4gICAgICAgIG9iai5kb2NJZCA9IHRoaXMuX2RvY0lkO1xuICAgICAgICBvYmoubmFtZSA9IHRoaXMubmFtZTtcbiAgICAgICAgb2JqLmJhc2VVUkwgPSB0aGlzLmJhc2VVUkw7XG4gICAgICAgIHJldHVybiBhc0pzb24gPyB1dGlsLnByZXR0eVByaW50KG9iaikgOiBvYmo7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdGhlIG51bWJlciBvZiBvYmplY3RzIGluIHRoaXMgY29sbGVjdGlvbi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSBjYWxsYmFja1xuICAgICAqIEByZXR1cm5zIHtQcm9taXNlfVxuICAgICAqL1xuICAgIGNvdW50OiBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICAgICAgdmFyIGRlZmVycmVkID0gdXRpbC5kZWZlcihjYWxsYmFjayk7XG4gICAgICAgIHZhciB0YXNrcyA9IF8ubWFwKHRoaXMuX21vZGVscywgZnVuY3Rpb24gKG0pIHtcbiAgICAgICAgICAgIHJldHVybiBfLmJpbmQobS5jb3VudCwgbSk7XG4gICAgICAgIH0pO1xuICAgICAgICB1dGlsLmFzeW5jLnBhcmFsbGVsKHRhc2tzLCBmdW5jdGlvbiAoZXJyLCBucykge1xuICAgICAgICAgICAgdmFyIG47XG4gICAgICAgICAgICBpZiAoIWVycikge1xuICAgICAgICAgICAgICAgIG4gPSBfLnJlZHVjZShucywgZnVuY3Rpb24gKG0sIHIpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG0gKyByXG4gICAgICAgICAgICAgICAgfSwgMCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBkZWZlcnJlZC5maW5pc2goZXJyLCBuKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xuICAgIH1cbn0pO1xuXG5fLmV4dGVuZChDb2xsZWN0aW9uLnByb3RvdHlwZSwge1xuICAgIGxpc3RlbjogZnVuY3Rpb24gKGZuKSB7XG4gICAgICAgIGV2ZW50cy5vbih0aGlzLm5hbWUsIGZuKTtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIoZm4pO1xuICAgICAgICB9LmJpbmQodGhpcyk7XG4gICAgfSxcbiAgICBsaXN0ZW5PbmNlOiBmdW5jdGlvbiAoZm4pIHtcbiAgICAgICAgcmV0dXJuIGV2ZW50cy5vbmNlKHRoaXMubmFtZSwgZm4pO1xuICAgIH0sXG4gICAgcmVtb3ZlTGlzdGVuZXI6IGZ1bmN0aW9uIChmbikge1xuICAgICAgICByZXR1cm4gZXZlbnRzLnJlbW92ZUxpc3RlbmVyKHRoaXMubmFtZSwgZm4pO1xuICAgIH1cbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IENvbGxlY3Rpb247IiwiLyoqXG4gKiBAbW9kdWxlIGNvbGxlY3Rpb25cbiAqL1xudmFyIF8gPSByZXF1aXJlKCcuL3V0aWwnKS5fO1xuXG5mdW5jdGlvbiBDb2xsZWN0aW9uUmVnaXN0cnkoKSB7XG4gICAgaWYgKCF0aGlzKSByZXR1cm4gbmV3IENvbGxlY3Rpb25SZWdpc3RyeSgpO1xuICAgIHRoaXMuY29sbGVjdGlvbk5hbWVzID0gW107XG59XG5cbl8uZXh0ZW5kKENvbGxlY3Rpb25SZWdpc3RyeS5wcm90b3R5cGUsIHtcbiAgICByZWdpc3RlcjogZnVuY3Rpb24gKGNvbGxlY3Rpb24pIHtcbiAgICAgICAgdmFyIG5hbWUgPSBjb2xsZWN0aW9uLm5hbWU7XG4gICAgICAgIHRoaXNbbmFtZV0gPSBjb2xsZWN0aW9uO1xuICAgICAgICB0aGlzLmNvbGxlY3Rpb25OYW1lcy5wdXNoKG5hbWUpO1xuICAgIH0sXG4gICAgcmVzZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICBfLmVhY2godGhpcy5jb2xsZWN0aW9uTmFtZXMsIGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgICAgICAgICBkZWxldGUgc2VsZltuYW1lXTtcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuY29sbGVjdGlvbk5hbWVzID0gW107XG4gICAgfVxufSk7XG5cbmV4cG9ydHMuQ29sbGVjdGlvblJlZ2lzdHJ5ID0gbmV3IENvbGxlY3Rpb25SZWdpc3RyeSgpOyIsIi8qKlxuICogQG1vZHVsZSBlcnJvclxuICovXG5cblxuLyoqXG4gKiBSZXByZXNlbnRzIGludGVybmFsIGVycm9ycy4gVGhlc2UgYXJlIHRocm93biB3aGVuIHNvbWV0aGluZyBoYXMgZ29uZSB2ZXJ5IHdyb25nIGludGVybmFsbHkuIElmIHlvdSBzZWUgb25lIG9mIHRoZXNlXG4gKiBvdXQgaW4gdGhlIHdpbGQgeW91IHByb2JhYmx5IG5lZWQgdG8gZmlsZSBhIGJ1ZyByZXBvcnQgYXMgaXQgbWVhbnMgc29tZSBhc3NlcnRpb24gaGFzIGZhaWxlZC5cbiAqIEBwYXJhbSBtZXNzYWdlXG4gKiBAcGFyYW0gY29udGV4dFxuICogQHBhcmFtIHNzZlxuICogQGNvbnN0cnVjdG9yXG4gKi9cbmZ1bmN0aW9uIEludGVybmFsU2llc3RhRXJyb3IobWVzc2FnZSwgY29udGV4dCwgc3NmKSB7XG4gICAgdGhpcy5tZXNzYWdlID0gbWVzc2FnZTtcbiAgICB0aGlzLmNvbnRleHQgPSBjb250ZXh0O1xuICAgIC8vIGNhcHR1cmUgc3RhY2sgdHJhY2VcbiAgICBzc2YgPSBzc2YgfHwgYXJndW1lbnRzLmNhbGxlZTtcbiAgICBpZiAoc3NmICYmIEVycm9yLmNhcHR1cmVTdGFja1RyYWNlKSB7XG4gICAgICAgIEVycm9yLmNhcHR1cmVTdGFja1RyYWNlKHRoaXMsIHNzZik7XG4gICAgfVxufVxuXG5JbnRlcm5hbFNpZXN0YUVycm9yLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoRXJyb3IucHJvdG90eXBlKTtcbkludGVybmFsU2llc3RhRXJyb3IucHJvdG90eXBlLm5hbWUgPSAnSW50ZXJuYWxTaWVzdGFFcnJvcic7XG5JbnRlcm5hbFNpZXN0YUVycm9yLnByb3RvdHlwZS5jb25zdHJ1Y3RvciA9IEludGVybmFsU2llc3RhRXJyb3I7XG5cblxuLyoqXG4gKiBGaWVsZHMgb24gZXJyb3Igb2JqZWN0cyBkaXNoZWQgb3V0IGJ5IFNpZXN0YS5cbiAqIEB0eXBlIHtPYmplY3R9XG4gKi9cbnZhciBFcnJvckZpZWxkID0ge1xuICAgICAgICBNZXNzYWdlOiAnbWVzc2FnZScsXG4gICAgICAgIENvZGU6ICdjb2RlJ1xuICAgIH0sXG4gICAgLyoqXG4gICAgICogRW51bWVyYXRlZCBlcnJvcnMuXG4gICAgICogQHR5cGUge09iamVjdH1cbiAgICAgKi9cbiAgICBFcnJvckNvZGUgPSB7XG4gICAgICAgIFVua25vd246IDAsXG4gICAgICAgIC8vIElmIG5vIGRlc2NyaXB0b3IgbWF0Y2hlcyBhIEhUVFAgcmVzcG9uc2UvcmVxdWVzdCB0aGVuIHRoaXMgZXJyb3IgaXNcbiAgICAgICAgTm9EZXNjcmlwdG9yTWF0Y2hlZDogMVxuICAgIH0sXG5cbiAgICBDb21wb25lbnRzID0ge1xuICAgICAgICBNYXBwaW5nOiAnTWFwcGluZycsXG4gICAgICAgIEhUVFA6ICdIVFRQJyxcbiAgICAgICAgUmVhY3RpdmVRdWVyeTogJ1JlYWN0aXZlUXVlcnknLFxuICAgICAgICBBcnJhbmdlZFJlYWN0aXZlUXVlcnk6ICdBcnJhbmdlZFJlYWN0aXZlUXVlcnknLFxuICAgICAgICBDb2xsZWN0aW9uOiAnQ29sbGVjdGlvbicsXG4gICAgICAgIFF1ZXJ5OiAnUXVlcnknXG4gICAgfTtcblxuXG4vKipcbiAqIEBwYXJhbSBjb21wb25lbnRcbiAqIEBwYXJhbSBtZXNzYWdlXG4gKiBAcGFyYW0gZXh0cmFcbiAqIEBjb25zdHJ1Y3RvclxuICovXG5mdW5jdGlvbiBTaWVzdGFVc2VyRXJyb3IoY29tcG9uZW50LCBtZXNzYWdlLCBleHRyYSkge1xuICAgIGV4dHJhID0gZXh0cmEgfHwge307XG4gICAgdGhpcy5jb21wb25lbnQgPSBjb21wb25lbnQ7XG4gICAgdGhpcy5tZXNzYWdlID0gbWVzc2FnZTtcbiAgICBmb3IgKHZhciBwcm9wIGluIGV4dHJhKSB7XG4gICAgICAgIGlmIChleHRyYS5oYXNPd25Qcm9wZXJ0eShwcm9wKSkge1xuICAgICAgICAgICAgdGhpc1twcm9wXSA9IGV4dHJhW3Byb3BdO1xuICAgICAgICB9XG4gICAgfVxuICAgIHRoaXMuaXNVc2VyRXJyb3IgPSB0cnVlO1xufVxuXG4vKipcbiAqIE1hcCBlcnJvciBjb2RlcyBvbnRvIGRlc2NyaXB0aXZlIG1lc3NhZ2VzLlxuICogQHR5cGUge09iamVjdH1cbiAqL1xudmFyIE1lc3NhZ2UgPSB7fTtcbk1lc3NhZ2VbRXJyb3JDb2RlLk5vRGVzY3JpcHRvck1hdGNoZWRdID0gJ05vIGRlc2NyaXB0b3IgbWF0Y2hlZCB0aGUgSFRUUCByZXNwb25zZS9yZXF1ZXN0Lic7XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICAgIEludGVybmFsU2llc3RhRXJyb3I6IEludGVybmFsU2llc3RhRXJyb3IsXG4gICAgU2llc3RhVXNlckVycm9yOiBTaWVzdGFVc2VyRXJyb3IsXG4gICAgRXJyb3JDb2RlOiBFcnJvckNvZGUsXG4gICAgRXJyb3JGaWVsZDogRXJyb3JGaWVsZCxcbiAgICBNZXNzYWdlOiBNZXNzYWdlLFxuICAgIENvbXBvbmVudHM6IENvbXBvbmVudHMsXG4gICAgZXJyb3JGYWN0b3J5OiBmdW5jdGlvbiAoY29tcG9uZW50KSB7XG4gICAgICAgIGlmIChjb21wb25lbnQgaW4gQ29tcG9uZW50cykge1xuICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIChtZXNzYWdlLCBleHRyYSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcihjb21wb25lbnQsIG1lc3NhZ2UsIGV4dHJhKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ05vIHN1Y2ggY29tcG9uZW50IFwiJyArIGNvbXBvbmVudCArICdcIicpO1xuICAgICAgICB9XG4gICAgfVxufTsiLCJ2YXIgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnZXZlbnRzJykuRXZlbnRFbWl0dGVyLFxuICAgIEFycmF5T2JzZXJ2ZXIgPSByZXF1aXJlKCcuLi92ZW5kb3Ivb2JzZXJ2ZS1qcy9zcmMvb2JzZXJ2ZScpLkFycmF5T2JzZXJ2ZXIsXG4gICAgXyA9IHJlcXVpcmUoJy4vdXRpbCcpLl8sXG4gICAgbW9kZWxFdmVudHMgPSByZXF1aXJlKCcuL21vZGVsRXZlbnRzJyk7XG5cbnZhciBldmVudEVtaXR0ZXIgPSBuZXcgRXZlbnRFbWl0dGVyKCk7XG5ldmVudEVtaXR0ZXIud3JhcEFycmF5ID0gZnVuY3Rpb24gKGFycmF5LCBmaWVsZCwgbW9kZWxJbnN0YW5jZSkge1xuICAgIGlmICghYXJyYXkub2JzZXJ2ZXIpIHtcbiAgICAgICAgYXJyYXkub2JzZXJ2ZXIgPSBuZXcgQXJyYXlPYnNlcnZlcihhcnJheSk7XG4gICAgICAgIGFycmF5Lm9ic2VydmVyLm9wZW4oZnVuY3Rpb24gKHNwbGljZXMpIHtcbiAgICAgICAgICAgIHZhciBmaWVsZElzQXR0cmlidXRlID0gbW9kZWxJbnN0YW5jZS5fYXR0cmlidXRlTmFtZXMuaW5kZXhPZihmaWVsZCkgPiAtMTtcbiAgICAgICAgICAgIGlmIChmaWVsZElzQXR0cmlidXRlKSB7XG4gICAgICAgICAgICAgICAgc3BsaWNlcy5mb3JFYWNoKGZ1bmN0aW9uIChzcGxpY2UpIHtcbiAgICAgICAgICAgICAgICAgICAgbW9kZWxFdmVudHMuZW1pdCh7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb2xsZWN0aW9uOiBtb2RlbEluc3RhbmNlLmNvbGxlY3Rpb25OYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgbW9kZWw6IG1vZGVsSW5zdGFuY2UubW9kZWwubmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIF9pZDogbW9kZWxJbnN0YW5jZS5faWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBpbmRleDogc3BsaWNlLmluZGV4LFxuICAgICAgICAgICAgICAgICAgICAgICAgcmVtb3ZlZDogc3BsaWNlLnJlbW92ZWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBhZGRlZDogc3BsaWNlLmFkZGVkQ291bnQgPyBhcnJheS5zbGljZShzcGxpY2UuaW5kZXgsIHNwbGljZS5pbmRleCArIHNwbGljZS5hZGRlZENvdW50KSA6IFtdLFxuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogbW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUuU3BsaWNlLFxuICAgICAgICAgICAgICAgICAgICAgICAgZmllbGQ6IGZpZWxkLFxuICAgICAgICAgICAgICAgICAgICAgICAgb2JqOiBtb2RlbEluc3RhbmNlXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9XG59O1xubW9kdWxlLmV4cG9ydHMgPSBldmVudEVtaXR0ZXI7IiwidmFyIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKSxcbiAgICBDb2xsZWN0aW9uUmVnaXN0cnkgPSByZXF1aXJlKCcuL2NvbGxlY3Rpb25SZWdpc3RyeScpLkNvbGxlY3Rpb25SZWdpc3RyeSxcbiAgICBDb2xsZWN0aW9uID0gcmVxdWlyZSgnLi9jb2xsZWN0aW9uJyksXG4gICAgY2FjaGUgPSByZXF1aXJlKCcuL2NhY2hlJyksXG4gICAgTW9kZWwgPSByZXF1aXJlKCcuL21vZGVsJyksXG4gICAgZXZlbnRzID0gcmVxdWlyZSgnLi9ldmVudHMnKSxcbiAgICBSZWxhdGlvbnNoaXBUeXBlID0gcmVxdWlyZSgnLi9SZWxhdGlvbnNoaXBUeXBlJyksXG4gICAgUmVhY3RpdmVRdWVyeSA9IHJlcXVpcmUoJy4vcmVhY3RpdmVRdWVyeScpLFxuICAgIG1vZGVsRXZlbnRzID0gcmVxdWlyZSgnLi9tb2RlbEV2ZW50cycpLFxuICAgIFF1ZXJ5ID0gcmVxdWlyZSgnLi9RdWVyeScpLFxuICAgIGxvZyA9IHJlcXVpcmUoJy4vbG9nJyksXG4gICAgXyA9IHV0aWwuXztcblxuXG5pZiAod2luZG93LlEpIHdpbmRvdy5xID0gd2luZG93LlE7XG5cblxuLy8gSW5pdGlhbGlzZSBzaWVzdGEgb2JqZWN0LiBTdHJhbmdlIGZvcm1hdCBmYWNpbGl0aWVzIHVzaW5nIHN1Ym1vZHVsZXMgd2l0aCByZXF1aXJlSlMuXG52YXIgc2llc3RhID0gZnVuY3Rpb24gKGV4dCkge1xuICAgIGlmICghc2llc3RhLmV4dCkgc2llc3RhLmV4dCA9IHt9O1xuICAgIF8uZXh0ZW5kKHNpZXN0YS5leHQsIGV4dCB8fCB7fSk7XG4gICAgcmV0dXJuIHNpZXN0YTtcbn07XG5cbi8vIE5vdGlmaWNhdGlvbnNcbl8uZXh0ZW5kKHNpZXN0YSwge1xuICAgIG9uOiBldmVudHMub24uYmluZChldmVudHMpLFxuICAgIG9mZjogZXZlbnRzLnJlbW92ZUxpc3RlbmVyLmJpbmQoZXZlbnRzKSxcbiAgICBvbmNlOiBldmVudHMub25jZS5iaW5kKGV2ZW50cyksXG4gICAgcmVtb3ZlQWxsTGlzdGVuZXJzOiBldmVudHMucmVtb3ZlQWxsTGlzdGVuZXJzLmJpbmQoZXZlbnRzKVxufSk7XG5fLmV4dGVuZChzaWVzdGEsIHtcbiAgICByZW1vdmVMaXN0ZW5lcjogc2llc3RhLm9mZixcbiAgICBhZGRMaXN0ZW5lcjogc2llc3RhLm9uXG59KTtcblxuLy8gRXhwb3NlIHNvbWUgc3R1ZmYgZm9yIHVzYWdlIGJ5IGV4dGVuc2lvbnMgYW5kL29yIHVzZXJzXG5fLmV4dGVuZChzaWVzdGEsIHtcbiAgICBSZWxhdGlvbnNoaXBUeXBlOiBSZWxhdGlvbnNoaXBUeXBlLFxuICAgIE1vZGVsRXZlbnRUeXBlOiBtb2RlbEV2ZW50cy5Nb2RlbEV2ZW50VHlwZSxcbiAgICBsb2c6IGxvZy5MZXZlbCxcbiAgICBJbnNlcnRpb25Qb2xpY3k6IFJlYWN0aXZlUXVlcnkuSW5zZXJ0aW9uUG9saWN5LFxuICAgIF9pbnRlcm5hbDoge1xuICAgICAgICBsb2c6IGxvZyxcbiAgICAgICAgTW9kZWw6IE1vZGVsLFxuICAgICAgICBtb2RlbDogcmVxdWlyZSgnLi9tb2RlbCcpLFxuICAgICAgICBlcnJvcjogcmVxdWlyZSgnLi9lcnJvcicpLFxuICAgICAgICBNb2RlbEV2ZW50VHlwZTogbW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUsXG4gICAgICAgIHNpZXN0YU1vZGVsOiByZXF1aXJlKCcuL21vZGVsSW5zdGFuY2UnKSxcbiAgICAgICAgZXh0ZW5kOiByZXF1aXJlKCdleHRlbmQnKSxcbiAgICAgICAgZXZlbnRzOiByZXF1aXJlKCcuL2V2ZW50cycpLFxuICAgICAgICBjYWNoZTogcmVxdWlyZSgnLi9jYWNoZScpLFxuICAgICAgICBtb2RlbEV2ZW50czogbW9kZWxFdmVudHMsXG4gICAgICAgIENvbGxlY3Rpb25SZWdpc3RyeTogcmVxdWlyZSgnLi9jb2xsZWN0aW9uUmVnaXN0cnknKS5Db2xsZWN0aW9uUmVnaXN0cnksXG4gICAgICAgIENvbGxlY3Rpb246IENvbGxlY3Rpb24sXG4gICAgICAgIHV0aWxzOiB1dGlsLFxuICAgICAgICB1dGlsOiB1dGlsLFxuICAgICAgICBfOiB1dGlsLl8sXG4gICAgICAgIHF1ZXJ5OiByZXF1aXJlKCcuL3F1ZXJ5JyksXG4gICAgICAgIHN0b3JlOiByZXF1aXJlKCcuL3N0b3JlJylcbiAgICB9LFxuICAgIF86IHV0aWwuXyxcbiAgICBhc3luYzogdXRpbC5hc3luYyxcbiAgICBpc0FycmF5OiB1dGlsLmlzQXJyYXksXG4gICAgaXNTdHJpbmc6IHV0aWwuaXNTdHJpbmdcbn0pO1xuXG5zaWVzdGEuZXh0ID0ge307XG5cbnZhciBpbnN0YWxsZWQgPSBmYWxzZSxcbiAgICBpbnN0YWxsaW5nID0gZmFsc2U7XG5cbl8uZXh0ZW5kKHNpZXN0YSwge1xuICAgIC8qKlxuICAgICAqIFdpcGUgZXZlcnl0aGluZy4gVXNlZCBkdXJpbmcgdGVzdCBnZW5lcmFsbHkuXG4gICAgICovXG4gICAgcmVzZXQ6IGZ1bmN0aW9uIChjYikge1xuICAgICAgICBpbnN0YWxsZWQgPSBmYWxzZTtcbiAgICAgICAgaW5zdGFsbGluZyA9IGZhbHNlO1xuICAgICAgICBkZWxldGUgdGhpcy5xdWV1ZWRUYXNrcztcbiAgICAgICAgY2FjaGUucmVzZXQoKTtcbiAgICAgICAgQ29sbGVjdGlvblJlZ2lzdHJ5LnJlc2V0KCk7XG4gICAgICAgIGV2ZW50cy5yZW1vdmVBbGxMaXN0ZW5lcnMoKTtcbiAgICAgICAgc2llc3RhLmV4dC5odHRwLkRlc2NyaXB0b3JSZWdpc3RyeS5yZXNldCgpO1xuICAgICAgICBpZiAoc2llc3RhLmV4dC5zdG9yYWdlRW5hYmxlZCkge1xuICAgICAgICAgICAgc2llc3RhLmV4dC5zdG9yYWdlLl9yZXNldChjYik7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBjYigpO1xuICAgICAgICB9XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIGFuZCByZWdpc3RlcnMgYSBuZXcgQ29sbGVjdGlvbi5cbiAgICAgKiBAcGFyYW0gIHtTdHJpbmd9IG5hbWVcbiAgICAgKiBAcGFyYW0gIHtPYmplY3R9IFtvcHRzXVxuICAgICAqIEByZXR1cm4ge0NvbGxlY3Rpb259XG4gICAgICovXG4gICAgY29sbGVjdGlvbjogZnVuY3Rpb24gKG5hbWUsIG9wdHMpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBDb2xsZWN0aW9uKG5hbWUsIG9wdHMpO1xuICAgIH0sXG4gICAgLyoqXG4gICAgICogSW5zdGFsbCBhbGwgY29sbGVjdGlvbnMuXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gW2NiXVxuICAgICAqIEByZXR1cm5zIHtxLlByb21pc2V9XG4gICAgICovXG4gICAgaW5zdGFsbDogZnVuY3Rpb24gKGNiKSB7XG4gICAgICAgIGluc3RhbGxpbmcgPSB0cnVlO1xuICAgICAgICB2YXIgZGVmZXJyZWQgPSB1dGlsLmRlZmVyKGNiKTtcbiAgICAgICAgY2IgPSBkZWZlcnJlZC5maW5pc2guYmluZChkZWZlcnJlZCk7XG4gICAgICAgIHZhciBjb2xsZWN0aW9uTmFtZXMgPSBDb2xsZWN0aW9uUmVnaXN0cnkuY29sbGVjdGlvbk5hbWVzLFxuICAgICAgICAgICAgY29sbGVjdGlvbkluc3RhbGxUYXNrcyA9IF8ubWFwKGNvbGxlY3Rpb25OYW1lcywgZnVuY3Rpb24gKG4pIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZnVuY3Rpb24gKGRvbmUpIHtcbiAgICAgICAgICAgICAgICAgICAgQ29sbGVjdGlvblJlZ2lzdHJ5W25dLmluc3RhbGwoZG9uZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgc2llc3RhLmFzeW5jLnNlcmllcyhjb2xsZWN0aW9uSW5zdGFsbFRhc2tzLCBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgaW5zdGFsbGluZyA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIGNiKGVycik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICB2YXIgZW5zdXJlU2luZ2xldG9ucyA9IGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBlbnN1cmVTaW5nbGV0b25UYXNrcyA9IFtdO1xuICAgICAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjb2xsZWN0aW9uTmFtZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgY29sbGVjdGlvbiA9IENvbGxlY3Rpb25SZWdpc3RyeVtjb2xsZWN0aW9uTmFtZXNbaV1dLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtb2RlbE5hbWVzID0gT2JqZWN0LmtleXMoY29sbGVjdGlvbi5fbW9kZWxzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmb3IgKHZhciBqID0gMDsgaiA8IG1vZGVsTmFtZXMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG1vZGVsTmFtZSA9IG1vZGVsTmFtZXNbal0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtb2RlbCA9IGNvbGxlY3Rpb25bbW9kZWxOYW1lXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGZuID0gZnVuY3Rpb24gKGRvbmUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZW5zdXJlU2luZ2xldG9ucyhkb25lKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfS5iaW5kKG1vZGVsKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZW5zdXJlU2luZ2xldG9uVGFza3MucHVzaChmbik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgc2llc3RhLmFzeW5jLnBhcmFsbGVsKGVuc3VyZVNpbmdsZXRvblRhc2tzLCBmdW5jdGlvbiAoZXJyLCByZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbnN0YWxsZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoc2VsZi5xdWV1ZWRUYXNrcykgc2VsZi5xdWV1ZWRUYXNrcy5leGVjdXRlKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGluc3RhbGxpbmcgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYihlcnIsIHJlcyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGluc3RhbGxpbmcgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNiKGVycik7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIGlmIChzaWVzdGEuZXh0LnN0b3JhZ2VFbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIExvYWQgbW9kZWxzIGZyb20gUG91Y2hEQi5cbiAgICAgICAgICAgICAgICAgICAgc2llc3RhLmV4dC5zdG9yYWdlLl9sb2FkKGVuc3VyZVNpbmdsZXRvbnMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgZW5zdXJlU2luZ2xldG9ucygpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG4gICAgfSxcbiAgICBfcHVzaFRhc2s6IGZ1bmN0aW9uICh0YXNrKSB7XG4gICAgICAgIGlmICghdGhpcy5xdWV1ZWRUYXNrcykge1xuICAgICAgICAgICAgdGhpcy5xdWV1ZWRUYXNrcyA9IG5ldyBmdW5jdGlvbiBRdWV1ZSgpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnRhc2tzID0gW107XG4gICAgICAgICAgICAgICAgdGhpcy5leGVjdXRlID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnRhc2tzLmZvckVhY2goZnVuY3Rpb24gKGYpIHtmKCl9KTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy50YXNrcyA9IFtdO1xuICAgICAgICAgICAgICAgIH0uYmluZCh0aGlzKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5xdWV1ZWRUYXNrcy50YXNrcy5wdXNoKHRhc2spO1xuICAgIH0sXG4gICAgX2FmdGVySW5zdGFsbDogZnVuY3Rpb24gKHRhc2spIHtcbiAgICAgICAgaWYgKCFpbnN0YWxsZWQpIHtcbiAgICAgICAgICAgIGlmICghaW5zdGFsbGluZykge1xuICAgICAgICAgICAgICAgIHRoaXMuaW5zdGFsbChmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIHNldHRpbmcgdXAgc2llc3RhJywgZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgZGVsZXRlIHRoaXMucXVldWVkVGFza3M7XG4gICAgICAgICAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIEluIGNhc2UgaW5zdGFsbGVkIHN0cmFpZ2h0IGF3YXkgZS5nLiBpZiBzdG9yYWdlIGV4dGVuc2lvbiBub3QgaW5zdGFsbGVkLlxuICAgICAgICAgICAgaWYgKCFpbnN0YWxsZWQpIHRoaXMuX3B1c2hUYXNrKHRhc2spO1xuICAgICAgICAgICAgZWxzZSB0YXNrKCk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICB0YXNrKCk7XG4gICAgICAgIH1cbiAgICB9LFxuICAgIHNldExvZ0xldmVsOiBmdW5jdGlvbiAobG9nZ2VyTmFtZSwgbGV2ZWwpIHtcbiAgICAgICAgdmFyIExvZ2dlciA9IGxvZy5sb2dnZXJXaXRoTmFtZShsb2dnZXJOYW1lKTtcbiAgICAgICAgTG9nZ2VyLnNldExldmVsKGxldmVsKTtcbiAgICB9LFxuICAgIG5vdGlmeTogdXRpbC5uZXh0LFxuICAgIHJlZ2lzdGVyQ29tcGFyYXRvcjogUXVlcnkuYmluZChRdWVyeSlcbn0pO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydGllcyhzaWVzdGEsIHtcbiAgICBfY2FuQ2hhbmdlOiB7XG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuICEoaW5zdGFsbGluZyB8fCBpbnN0YWxsZWQpO1xuICAgICAgICB9XG4gICAgfVxufSk7XG5cbmlmICh0eXBlb2Ygd2luZG93ICE9ICd1bmRlZmluZWQnKSB7XG4gICAgd2luZG93LnNpZXN0YSA9IHNpZXN0YTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBzaWVzdGE7IiwiLyoqXG4gKiBEZWFkIHNpbXBsZSBsb2dnaW5nIHNlcnZpY2UuXG4gKiBAbW9kdWxlIGxvZ1xuICovXG5cbnZhciBfID0gcmVxdWlyZSgnLi91dGlsJykuXztcblxudmFyIGxvZ0xldmVscyA9IHt9O1xuXG5cbmZ1bmN0aW9uIExvZ2dlcihuYW1lKSB7XG4gICAgaWYgKCF0aGlzKSByZXR1cm4gbmV3IExvZ2dlcihuYW1lKTtcbiAgICB0aGlzLm5hbWUgPSBuYW1lO1xuICAgIGxvZ0xldmVsc1tuYW1lXSA9IExvZ2dlci5MZXZlbC53YXJuO1xuICAgIHRoaXMudHJhY2UgPSBjb25zdHJ1Y3RQZXJmb3JtZXIodGhpcywgXy5iaW5kKGNvbnNvbGUuZGVidWcgPyBjb25zb2xlLmRlYnVnIDogY29uc29sZS5sb2csIGNvbnNvbGUpLCBMb2dnZXIuTGV2ZWwudHJhY2UpO1xuICAgIHRoaXMuZGVidWcgPSBjb25zdHJ1Y3RQZXJmb3JtZXIodGhpcywgXy5iaW5kKGNvbnNvbGUuZGVidWcgPyBjb25zb2xlLmRlYnVnIDogY29uc29sZS5sb2csIGNvbnNvbGUpLCBMb2dnZXIuTGV2ZWwuZGVidWcpO1xuICAgIHRoaXMuaW5mbyA9IGNvbnN0cnVjdFBlcmZvcm1lcih0aGlzLCBfLmJpbmQoY29uc29sZS5pbmZvID8gY29uc29sZS5pbmZvIDogY29uc29sZS5sb2csIGNvbnNvbGUpLCBMb2dnZXIuTGV2ZWwuaW5mbyk7XG4gICAgdGhpcy5sb2cgPSBjb25zdHJ1Y3RQZXJmb3JtZXIodGhpcywgXy5iaW5kKGNvbnNvbGUubG9nID8gY29uc29sZS5sb2cgOiBjb25zb2xlLmxvZywgY29uc29sZSksIExvZ2dlci5MZXZlbC5pbmZvKTtcbiAgICB0aGlzLndhcm4gPSBjb25zdHJ1Y3RQZXJmb3JtZXIodGhpcywgXy5iaW5kKGNvbnNvbGUud2FybiA/IGNvbnNvbGUud2FybiA6IGNvbnNvbGUubG9nLCBjb25zb2xlKSwgTG9nZ2VyLkxldmVsLndhcm5pbmcpO1xuICAgIHRoaXMuZXJyb3IgPSBjb25zdHJ1Y3RQZXJmb3JtZXIodGhpcywgXy5iaW5kKGNvbnNvbGUuZXJyb3IgPyBjb25zb2xlLmVycm9yIDogY29uc29sZS5sb2csIGNvbnNvbGUpLCBMb2dnZXIuTGV2ZWwuZXJyb3IpO1xuICAgIHRoaXMuZmF0YWwgPSBjb25zdHJ1Y3RQZXJmb3JtZXIodGhpcywgXy5iaW5kKGNvbnNvbGUuZXJyb3IgPyBjb25zb2xlLmVycm9yIDogY29uc29sZS5sb2csIGNvbnNvbGUpLCBMb2dnZXIuTGV2ZWwuZmF0YWwpO1xuXG59XG5cbkxvZ2dlci5MZXZlbCA9IHtcbiAgICB0cmFjZTogMCxcbiAgICBkZWJ1ZzogMSxcbiAgICBpbmZvOiAyLFxuICAgIHdhcm5pbmc6IDMsXG4gICAgd2FybjogMyxcbiAgICBlcnJvcjogNCxcbiAgICBmYXRhbDogNVxufTtcblxuZnVuY3Rpb24gY29uc3RydWN0UGVyZm9ybWVyKGxvZ2dlciwgZiwgbGV2ZWwpIHtcbiAgICB2YXIgcGVyZm9ybWVyID0gZnVuY3Rpb24gKG1lc3NhZ2UpIHtcbiAgICAgICAgbG9nZ2VyLnBlcmZvcm1Mb2coZiwgbGV2ZWwsIG1lc3NhZ2UsIGFyZ3VtZW50cyk7XG4gICAgfTtcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkocGVyZm9ybWVyLCAnaXNFbmFibGVkJywge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHZhciBjdXJyZW50TGV2ZWwgPSBsb2dnZXIuY3VycmVudExldmVsKCk7XG4gICAgICAgICAgICByZXR1cm4gbGV2ZWwgPj0gY3VycmVudExldmVsO1xuICAgICAgICB9LFxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICB9KTtcbiAgICBwZXJmb3JtZXIuZiA9IGY7XG4gICAgcGVyZm9ybWVyLmxvZ2dlciA9IGxvZ2dlcjtcbiAgICBwZXJmb3JtZXIubGV2ZWwgPSBsZXZlbDtcbiAgICByZXR1cm4gcGVyZm9ybWVyO1xufVxuXG5cbkxvZ2dlci5MZXZlbFRleHQgPSB7fTtcbkxvZ2dlci5MZXZlbFRleHQgW0xvZ2dlci5MZXZlbC50cmFjZV0gPSAnVFJBQ0UnO1xuTG9nZ2VyLkxldmVsVGV4dCBbTG9nZ2VyLkxldmVsLmRlYnVnXSA9ICdERUJVRyc7XG5Mb2dnZXIuTGV2ZWxUZXh0IFtMb2dnZXIuTGV2ZWwuaW5mb10gPSAnSU5GTyAnO1xuTG9nZ2VyLkxldmVsVGV4dCBbTG9nZ2VyLkxldmVsLndhcm5pbmddID0gJ1dBUk4gJztcbkxvZ2dlci5MZXZlbFRleHQgW0xvZ2dlci5MZXZlbC5lcnJvcl0gPSAnRVJST1InO1xuXG5Mb2dnZXIubGV2ZWxBc1RleHQgPSBmdW5jdGlvbiAobGV2ZWwpIHtcbiAgICByZXR1cm4gdGhpcy5MZXZlbFRleHRbbGV2ZWxdO1xufTtcblxuTG9nZ2VyLmxvZ2dlcldpdGhOYW1lID0gZnVuY3Rpb24gKG5hbWUpIHtcbiAgICByZXR1cm4gbmV3IExvZ2dlcihuYW1lKTtcbn07XG5cbkxvZ2dlci5wcm90b3R5cGUuY3VycmVudExldmVsID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBsb2dMZXZlbCA9IGxvZ0xldmVsc1t0aGlzLm5hbWVdO1xuICAgIHJldHVybiBsb2dMZXZlbCA/IGxvZ0xldmVsIDogTG9nZ2VyLkxldmVsLnRyYWNlO1xufTtcblxuTG9nZ2VyLnByb3RvdHlwZS5zZXRMZXZlbCA9IGZ1bmN0aW9uIChsZXZlbCkge1xuICAgIGxvZ0xldmVsc1t0aGlzLm5hbWVdID0gbGV2ZWw7XG59O1xuXG5Mb2dnZXIucHJvdG90eXBlLm92ZXJyaWRlID0gZnVuY3Rpb24gKGxldmVsLCBvdmVycmlkZSwgbWVzc2FnZSkge1xuICAgIHZhciBsZXZlbEFzVGV4dCA9IExvZ2dlci5sZXZlbEFzVGV4dChsZXZlbCk7XG4gICAgdmFyIHBlcmZvcm1lciA9IHRoaXNbbGV2ZWxBc1RleHQudHJpbSgpLnRvTG93ZXJDYXNlKCldO1xuICAgIHZhciBmID0gcGVyZm9ybWVyLmY7XG4gICAgdmFyIG90aGVyQXJndW1lbnRzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAzLCBhcmd1bWVudHMubGVuZ3RoKTtcbiAgICB0aGlzLnBlcmZvcm1Mb2coZiwgbGV2ZWwsIG1lc3NhZ2UsIG90aGVyQXJndW1lbnRzLCBvdmVycmlkZSk7XG59O1xuXG5Mb2dnZXIucHJvdG90eXBlLnBlcmZvcm1Mb2cgPSBmdW5jdGlvbiAobG9nRnVuYywgbGV2ZWwsIG1lc3NhZ2UsIG90aGVyQXJndW1lbnRzLCBvdmVycmlkZSkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB2YXIgY3VycmVudExldmVsID0gb3ZlcnJpZGUgIT09IHVuZGVmaW5lZCA/IG92ZXJyaWRlIDogdGhpcy5jdXJyZW50TGV2ZWwoKTtcbiAgICBpZiAoY3VycmVudExldmVsIDw9IGxldmVsKSB7XG4gICAgICAgIGxvZ0Z1bmMgPSBfLnBhcnRpYWwobG9nRnVuYywgTG9nZ2VyLmxldmVsQXNUZXh0KGxldmVsKSArICcgWycgKyBzZWxmLm5hbWUgKyAnXTogJyArIG1lc3NhZ2UpO1xuICAgICAgICB2YXIgYXJncyA9IFtdO1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IG90aGVyQXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBhcmdzW2ldID0gb3RoZXJBcmd1bWVudHNbaV07XG4gICAgICAgIH1cbiAgICAgICAgYXJncy5zcGxpY2UoMCwgMSk7XG4gICAgICAgIGxvZ0Z1bmMuYXBwbHkobG9nRnVuYywgYXJncyk7XG4gICAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBMb2dnZXI7XG4iLCIvKipcbiAqIEBtb2R1bGUgcmVsYXRpb25zaGlwc1xuICovXG5cbnZhciBSZWxhdGlvbnNoaXBQcm94eSA9IHJlcXVpcmUoJy4vUmVsYXRpb25zaGlwUHJveHknKSxcbiAgICBTdG9yZSA9IHJlcXVpcmUoJy4vc3RvcmUnKSxcbiAgICB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyksXG4gICAgXyA9IHV0aWwuXyxcbiAgICBJbnRlcm5hbFNpZXN0YUVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpLkludGVybmFsU2llc3RhRXJyb3IsXG4gICAgbW9kZWxFdmVudHMgPSByZXF1aXJlKCcuL21vZGVsRXZlbnRzJyksXG4gICAgZXZlbnRzID0gcmVxdWlyZSgnLi9ldmVudHMnKSxcbiAgICB3cmFwQXJyYXlGb3JBdHRyaWJ1dGVzID0gZXZlbnRzLndyYXBBcnJheSxcbiAgICBTaWVzdGFNb2RlbCA9IHJlcXVpcmUoJy4vbW9kZWxJbnN0YW5jZScpLFxuICAgIEFycmF5T2JzZXJ2ZXIgPSByZXF1aXJlKCcuLi92ZW5kb3Ivb2JzZXJ2ZS1qcy9zcmMvb2JzZXJ2ZScpLkFycmF5T2JzZXJ2ZXIsXG4gICAgTW9kZWxFdmVudFR5cGUgPSByZXF1aXJlKCcuL21vZGVsRXZlbnRzJykuTW9kZWxFdmVudFR5cGU7XG5cbi8qKlxuICogW01hbnlUb01hbnlQcm94eSBkZXNjcmlwdGlvbl1cbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRzXG4gKi9cbmZ1bmN0aW9uIE1hbnlUb01hbnlQcm94eShvcHRzKSB7XG4gICAgUmVsYXRpb25zaGlwUHJveHkuY2FsbCh0aGlzLCBvcHRzKTtcbiAgICB0aGlzLnJlbGF0ZWQgPSBbXTtcbiAgICB0aGlzLnJlbGF0ZWRDYW5jZWxMaXN0ZW5lcnMgPSB7fTtcbn1cblxuTWFueVRvTWFueVByb3h5LnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoUmVsYXRpb25zaGlwUHJveHkucHJvdG90eXBlKTtcblxuXy5leHRlbmQoTWFueVRvTWFueVByb3h5LnByb3RvdHlwZSwge1xuICAgIGNsZWFyUmV2ZXJzZTogZnVuY3Rpb24gKHJlbW92ZWQpIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICBfLmVhY2gocmVtb3ZlZCwgZnVuY3Rpb24gKHJlbW92ZWRPYmplY3QpIHtcbiAgICAgICAgICAgIHZhciByZXZlcnNlUHJveHkgPSBzZWxmLnJldmVyc2VQcm94eUZvckluc3RhbmNlKHJlbW92ZWRPYmplY3QpO1xuICAgICAgICAgICAgdmFyIGlkeCA9IHJldmVyc2VQcm94eS5yZWxhdGVkLmluZGV4T2Yoc2VsZi5vYmplY3QpO1xuICAgICAgICAgICAgcmV2ZXJzZVByb3h5Lm1ha2VDaGFuZ2VzVG9SZWxhdGVkV2l0aG91dE9ic2VydmF0aW9ucyhmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcmV2ZXJzZVByb3h5LnNwbGljZShpZHgsIDEpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH0sXG4gICAgc2V0UmV2ZXJzZU9mQWRkZWQ6IGZ1bmN0aW9uIChhZGRlZCkge1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgIF8uZWFjaChhZGRlZCwgZnVuY3Rpb24gKGFkZGVkT2JqZWN0KSB7XG4gICAgICAgICAgICB2YXIgcmV2ZXJzZVByb3h5ID0gc2VsZi5yZXZlcnNlUHJveHlGb3JJbnN0YW5jZShhZGRlZE9iamVjdCk7XG4gICAgICAgICAgICByZXZlcnNlUHJveHkubWFrZUNoYW5nZXNUb1JlbGF0ZWRXaXRob3V0T2JzZXJ2YXRpb25zKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICByZXZlcnNlUHJveHkuc3BsaWNlKDAsIDAsIHNlbGYub2JqZWN0KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICB9LFxuICAgIHdyYXBBcnJheTogZnVuY3Rpb24gKGFycikge1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgIHdyYXBBcnJheUZvckF0dHJpYnV0ZXMoYXJyLCB0aGlzLnJldmVyc2VOYW1lLCB0aGlzLm9iamVjdCk7XG4gICAgICAgIGlmICghYXJyLmFycmF5T2JzZXJ2ZXIpIHtcbiAgICAgICAgICAgIGFyci5hcnJheU9ic2VydmVyID0gbmV3IEFycmF5T2JzZXJ2ZXIoYXJyKTtcbiAgICAgICAgICAgIHZhciBvYnNlcnZlckZ1bmN0aW9uID0gZnVuY3Rpb24gKHNwbGljZXMpIHtcbiAgICAgICAgICAgICAgICBzcGxpY2VzLmZvckVhY2goZnVuY3Rpb24gKHNwbGljZSkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgYWRkZWQgPSBzcGxpY2UuYWRkZWRDb3VudCA/IGFyci5zbGljZShzcGxpY2UuaW5kZXgsIHNwbGljZS5pbmRleCArIHNwbGljZS5hZGRlZENvdW50KSA6IFtdO1xuICAgICAgICAgICAgICAgICAgICB2YXIgcmVtb3ZlZCA9IHNwbGljZS5yZW1vdmVkO1xuICAgICAgICAgICAgICAgICAgICBzZWxmLmNsZWFyUmV2ZXJzZShyZW1vdmVkKTtcbiAgICAgICAgICAgICAgICAgICAgc2VsZi5zZXRSZXZlcnNlT2ZBZGRlZChhZGRlZCk7XG4gICAgICAgICAgICAgICAgICAgIHZhciBtb2RlbCA9IHNlbGYuZ2V0Rm9yd2FyZE1vZGVsKCk7XG4gICAgICAgICAgICAgICAgICAgIG1vZGVsRXZlbnRzLmVtaXQoe1xuICAgICAgICAgICAgICAgICAgICAgICAgY29sbGVjdGlvbjogbW9kZWwuY29sbGVjdGlvbk5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBtb2RlbDogbW9kZWwubmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIF9pZDogc2VsZi5vYmplY3QuX2lkLFxuICAgICAgICAgICAgICAgICAgICAgICAgZmllbGQ6IHNlbGYuZ2V0Rm9yd2FyZE5hbWUoKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlbW92ZWQ6IHJlbW92ZWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBhZGRlZDogYWRkZWQsXG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiBNb2RlbEV2ZW50VHlwZS5TcGxpY2UsXG4gICAgICAgICAgICAgICAgICAgICAgICBpbmRleDogc3BsaWNlLmluZGV4LFxuICAgICAgICAgICAgICAgICAgICAgICAgb2JqOiBzZWxmLm9iamVjdFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBhcnIuYXJyYXlPYnNlcnZlci5vcGVuKG9ic2VydmVyRnVuY3Rpb24pO1xuICAgICAgICB9XG4gICAgfSxcbiAgICBnZXQ6IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgICAgICB2YXIgZGVmZXJyZWQgPSB1dGlsLmRlZmVyKGNhbGxiYWNrKTtcbiAgICAgICAgY2FsbGJhY2sgPSBkZWZlcnJlZC5maW5pc2guYmluZChkZWZlcnJlZCk7XG4gICAgICAgIGNhbGxiYWNrKG51bGwsIHRoaXMucmVsYXRlZCk7XG4gICAgICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xuICAgIH0sXG4gICAgdmFsaWRhdGU6IGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgaWYgKE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChvYmopICE9ICdbb2JqZWN0IEFycmF5XScpIHtcbiAgICAgICAgICAgIHJldHVybiAnQ2Fubm90IGFzc2lnbiBzY2FsYXIgdG8gbWFueSB0byBtYW55JztcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24gKG9iaiwgb3B0cykge1xuICAgICAgICB0aGlzLmNoZWNrSW5zdGFsbGVkKCk7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgaWYgKG9iaikge1xuICAgICAgICAgICAgdmFyIGVycm9yTWVzc2FnZTtcbiAgICAgICAgICAgIGlmIChlcnJvck1lc3NhZ2UgPSB0aGlzLnZhbGlkYXRlKG9iaikpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZXJyb3JNZXNzYWdlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5jbGVhclJldmVyc2VSZWxhdGVkKG9wdHMpO1xuICAgICAgICAgICAgICAgIHNlbGYuc2V0SWRBbmRSZWxhdGVkKG9iaiwgb3B0cyk7XG4gICAgICAgICAgICAgICAgdGhpcy53cmFwQXJyYXkob2JqKTtcbiAgICAgICAgICAgICAgICBzZWxmLnNldElkQW5kUmVsYXRlZFJldmVyc2Uob2JqLCBvcHRzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuY2xlYXJSZXZlcnNlUmVsYXRlZChvcHRzKTtcbiAgICAgICAgICAgIHNlbGYuc2V0SWRBbmRSZWxhdGVkKG9iaiwgb3B0cyk7XG4gICAgICAgIH1cbiAgICB9LFxuICAgIGluc3RhbGw6IGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgUmVsYXRpb25zaGlwUHJveHkucHJvdG90eXBlLmluc3RhbGwuY2FsbCh0aGlzLCBvYmopO1xuICAgICAgICB0aGlzLndyYXBBcnJheSh0aGlzLnJlbGF0ZWQpO1xuICAgICAgICBvYmpbKCdzcGxpY2UnICsgdXRpbC5jYXBpdGFsaXNlRmlyc3RMZXR0ZXIodGhpcy5yZXZlcnNlTmFtZSkpXSA9IF8uYmluZCh0aGlzLnNwbGljZSwgdGhpcyk7XG4gICAgfSxcbiAgICByZWdpc3RlclJlbW92YWxMaXN0ZW5lcjogZnVuY3Rpb24gKG9iaikge1xuICAgICAgICB0aGlzLnJlbGF0ZWRDYW5jZWxMaXN0ZW5lcnNbb2JqLl9pZF0gPSBvYmoubGlzdGVuKGZ1bmN0aW9uIChlKSB7XG5cbiAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICB9XG59KTtcblxuXG5tb2R1bGUuZXhwb3J0cyA9IE1hbnlUb01hbnlQcm94eTsiLCIvKipcbiAqIEBtb2R1bGUgbWFwcGluZ1xuICovXG5cbnZhciBTdG9yZSA9IHJlcXVpcmUoJy4vc3RvcmUnKSxcbiAgICBTaWVzdGFNb2RlbCA9IHJlcXVpcmUoJy4vbW9kZWxJbnN0YW5jZScpLFxuICAgIGxvZyA9IHJlcXVpcmUoJy4vbG9nJyksXG4gICAgSW50ZXJuYWxTaWVzdGFFcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKS5JbnRlcm5hbFNpZXN0YUVycm9yLFxuICAgIFF1ZXJ5ID0gcmVxdWlyZSgnLi9xdWVyeScpLFxuICAgIGNhY2hlID0gcmVxdWlyZSgnLi9jYWNoZScpLFxuICAgIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKSxcbiAgICBfID0gdXRpbC5fLFxuICAgIGFzeW5jID0gdXRpbC5hc3luYyxcbiAgICBNb2RlbEV2ZW50VHlwZSA9IHJlcXVpcmUoJy4vbW9kZWxFdmVudHMnKS5Nb2RlbEV2ZW50VHlwZTtcblxudmFyIExvZ2dlciA9IGxvZy5sb2dnZXJXaXRoTmFtZSgnTWFwcGluZycpO1xuXG5cbmZ1bmN0aW9uIFNpZXN0YUVycm9yKG9wdHMpIHtcbiAgICB0aGlzLm9wdHMgPSBvcHRzO1xufVxuU2llc3RhRXJyb3IucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh0aGlzLm9wdHMsIG51bGwsIDQpO1xufTtcblxuXG4vKipcbiAqIEVuY2Fwc3VsYXRlcyB0aGUgaWRlYSBvZiBtYXBwaW5nIGFycmF5cyBvZiBkYXRhIG9udG8gdGhlIG9iamVjdCBncmFwaCBvciBhcnJheXMgb2Ygb2JqZWN0cy5cbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRzXG4gKiBAcGFyYW0gb3B0cy5tb2RlbFxuICogQHBhcmFtIG9wdHMuZGF0YVxuICogQHBhcmFtIG9wdHMub2JqZWN0c1xuICogQHBhcmFtIG9wdHMuZGlzYWJsZU5vdGlmaWNhdGlvbnNcbiAqL1xuZnVuY3Rpb24gTWFwcGluZ09wZXJhdGlvbihvcHRzKSB7XG4gICAgdGhpcy5fb3B0cyA9IG9wdHM7XG5cbiAgICB1dGlsLmV4dGVuZEZyb21PcHRzKHRoaXMsIG9wdHMsIHtcbiAgICAgICAgbW9kZWw6IG51bGwsXG4gICAgICAgIGRhdGE6IG51bGwsXG4gICAgICAgIG9iamVjdHM6IFtdLFxuICAgICAgICBkaXNhYmxlZXZlbnRzOiBmYWxzZSxcbiAgICAgICAgX2lnbm9yZUluc3RhbGxlZDogZmFsc2VcbiAgICB9KTtcblxuICAgIF8uZXh0ZW5kKHRoaXMsIHtcbiAgICAgICAgZXJyb3JzOiBbXSxcbiAgICAgICAgc3ViVGFza1Jlc3VsdHM6IHt9LFxuICAgICAgICBfbmV3T2JqZWN0czogW11cbiAgICB9KTtcbn1cblxuXG5fLmV4dGVuZChNYXBwaW5nT3BlcmF0aW9uLnByb3RvdHlwZSwge1xuICAgIG1hcEF0dHJpYnV0ZXM6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLmRhdGEubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHZhciBkYXR1bSA9IHRoaXMuZGF0YVtpXTtcbiAgICAgICAgICAgIHZhciBvYmplY3QgPSB0aGlzLm9iamVjdHNbaV07XG4gICAgICAgICAgICAvLyBObyBwb2ludCBtYXBwaW5nIG9iamVjdCBvbnRvIGl0c2VsZi4gVGhpcyBoYXBwZW5zIGlmIGEgTW9kZWxJbnN0YW5jZSBpcyBwYXNzZWQgYXMgYSByZWxhdGlvbnNoaXAuXG4gICAgICAgICAgICBpZiAoZGF0dW0gIT0gb2JqZWN0KSB7XG4gICAgICAgICAgICAgICAgaWYgKG9iamVjdCkgeyAvLyBJZiBvYmplY3QgaXMgZmFsc3ksIHRoZW4gdGhlcmUgd2FzIGFuIGVycm9yIGxvb2tpbmcgdXAgdGhhdCBvYmplY3QvY3JlYXRpbmcgaXQuXG4gICAgICAgICAgICAgICAgICAgIHZhciBmaWVsZHMgPSB0aGlzLm1vZGVsLl9hdHRyaWJ1dGVOYW1lcztcbiAgICAgICAgICAgICAgICAgICAgXy5lYWNoKGZpZWxkcywgZnVuY3Rpb24gKGYpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChkYXR1bVtmXSAhPT0gdW5kZWZpbmVkKSB7IC8vIG51bGwgaXMgZmluZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIElmIGV2ZW50cyBhcmUgZGlzYWJsZWQgd2UgdXBkYXRlIF9fdmFsdWVzIG9iamVjdCBkaXJlY3RseS4gVGhpcyBhdm9pZHMgdHJpZ2dlcmluZ1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGV2ZW50cyB3aGljaCBhcmUgYnVpbHQgaW50byB0aGUgc2V0IGZ1bmN0aW9uIG9mIHRoZSBwcm9wZXJ0eS5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5kaXNhYmxlZXZlbnRzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9iamVjdC5fX3ZhbHVlc1tmXSA9IGRhdHVtW2ZdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb2JqZWN0W2ZdID0gZGF0dW1bZl07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICAgICAgICAgICAgICAvLyBQb3VjaERCIHJldmlzaW9uIChpZiB1c2luZyBzdG9yYWdlIG1vZHVsZSkuXG4gICAgICAgICAgICAgICAgICAgIC8vIFRPRE86IENhbiB0aGlzIGJlIHB1bGxlZCBvdXQgb2YgY29yZT9cbiAgICAgICAgICAgICAgICAgICAgaWYgKGRhdHVtLl9yZXYpIG9iamVjdC5fcmV2ID0gZGF0dW0uX3JldjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9LFxuICAgIF9tYXA6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICB2YXIgZXJyO1xuICAgICAgICB0aGlzLm1hcEF0dHJpYnV0ZXMoKTtcbiAgICAgICAgdmFyIHJlbGF0aW9uc2hpcEZpZWxkcyA9IF8ua2V5cyhzZWxmLnN1YlRhc2tSZXN1bHRzKTtcbiAgICAgICAgXy5lYWNoKHJlbGF0aW9uc2hpcEZpZWxkcywgZnVuY3Rpb24gKGYpIHtcbiAgICAgICAgICAgIHZhciByZXMgPSBzZWxmLnN1YlRhc2tSZXN1bHRzW2ZdO1xuICAgICAgICAgICAgdmFyIGluZGV4ZXMgPSByZXMuaW5kZXhlcyxcbiAgICAgICAgICAgICAgICBvYmplY3RzID0gcmVzLm9iamVjdHM7XG4gICAgICAgICAgICB2YXIgcmVsYXRlZERhdGEgPSBzZWxmLmdldFJlbGF0ZWREYXRhKGYpLnJlbGF0ZWREYXRhO1xuICAgICAgICAgICAgdmFyIHVuZmxhdHRlbmVkT2JqZWN0cyA9IHV0aWwudW5mbGF0dGVuQXJyYXkob2JqZWN0cywgcmVsYXRlZERhdGEpO1xuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB1bmZsYXR0ZW5lZE9iamVjdHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICB2YXIgaWR4ID0gaW5kZXhlc1tpXTtcbiAgICAgICAgICAgICAgICAvLyBFcnJvcnMgYXJlIHBsdWNrZWQgZnJvbSB0aGUgc3Vib3BlcmF0aW9ucy5cbiAgICAgICAgICAgICAgICB2YXIgZXJyb3IgPSBzZWxmLmVycm9yc1tpZHhdO1xuICAgICAgICAgICAgICAgIGVyciA9IGVycm9yID8gZXJyb3JbZl0gOiBudWxsO1xuICAgICAgICAgICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciByZWxhdGVkID0gdW5mbGF0dGVuZWRPYmplY3RzW2ldOyAvLyBDYW4gYmUgYXJyYXkgb3Igc2NhbGFyLlxuICAgICAgICAgICAgICAgICAgICB2YXIgb2JqZWN0ID0gc2VsZi5vYmplY3RzW2lkeF07XG4gICAgICAgICAgICAgICAgICAgIGlmIChvYmplY3QpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVyciA9IG9iamVjdC5fX3Byb3hpZXNbZl0uc2V0KHJlbGF0ZWQsIHtkaXNhYmxlZXZlbnRzOiBzZWxmLmRpc2FibGVldmVudHN9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIXNlbGYuZXJyb3JzW2lkeF0pIHNlbGYuZXJyb3JzW2lkeF0gPSB7fTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZWxmLmVycm9yc1tpZHhdW2ZdID0gZXJyO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIEZvciBpbmRpY2VzIHdoZXJlIG5vIG9iamVjdCBpcyBwcmVzZW50LCBwZXJmb3JtIGxvb2t1cHMsIGNyZWF0aW5nIGEgbmV3IG9iamVjdCBpZiBuZWNlc3NhcnkuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfbG9va3VwOiBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICAgICAgdmFyIGRlZmVycmVkID0gdXRpbC5kZWZlcihjYWxsYmFjayk7XG4gICAgICAgIGNhbGxiYWNrID0gZGVmZXJyZWQuZmluaXNoLmJpbmQoZGVmZXJyZWQpO1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgIHZhciByZW1vdGVMb29rdXBzID0gW107XG4gICAgICAgIHZhciBsb2NhbExvb2t1cHMgPSBbXTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLmRhdGEubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5vYmplY3RzW2ldKSB7XG4gICAgICAgICAgICAgICAgdmFyIGxvb2t1cDtcbiAgICAgICAgICAgICAgICB2YXIgZGF0dW0gPSB0aGlzLmRhdGFbaV07XG4gICAgICAgICAgICAgICAgdmFyIGlzU2NhbGFyID0gdHlwZW9mIGRhdHVtID09ICdzdHJpbmcnIHx8IHR5cGVvZiBkYXR1bSA9PSAnbnVtYmVyJyB8fCBkYXR1bSBpbnN0YW5jZW9mIFN0cmluZztcbiAgICAgICAgICAgICAgICBpZiAoZGF0dW0pIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGlzU2NhbGFyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb29rdXAgPSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaW5kZXg6IGksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0dW06IHt9XG4gICAgICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9va3VwLmRhdHVtW3NlbGYubW9kZWwuaWRdID0gZGF0dW07XG4gICAgICAgICAgICAgICAgICAgICAgICByZW1vdGVMb29rdXBzLnB1c2gobG9va3VwKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChkYXR1bSBpbnN0YW5jZW9mIFNpZXN0YU1vZGVsKSB7IC8vIFdlIHdvbid0IG5lZWQgdG8gcGVyZm9ybSBhbnkgbWFwcGluZy5cbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMub2JqZWN0c1tpXSA9IGRhdHVtO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGRhdHVtLl9pZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9jYWxMb29rdXBzLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGluZGV4OiBpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdHVtOiBkYXR1bVxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoZGF0dW1bc2VsZi5tb2RlbC5pZF0pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlbW90ZUxvb2t1cHMucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaW5kZXg6IGksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0dW06IGRhdHVtXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIENyZWF0ZSBhIG5ldyBvYmplY3QgaWYgYW5kIG9ubHkgaWYgdGhlIGRhdGEgaGFzIGFueSBmaWVsZHMgdGhhdCB3aWxsIGFjdHVhbGx5XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgZGF0dW1GaWVsZHMgPSBPYmplY3Qua2V5cyhkYXR1bSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgb2JqZWN0RmllbGRzID0gXy5yZWR1Y2UoT2JqZWN0LmtleXMoc2VsZi5tb2RlbC5yZWxhdGlvbnNoaXBzKS5jb25jYXQoc2VsZi5tb2RlbC5fYXR0cmlidXRlTmFtZXMpLCBmdW5jdGlvbiAobSwgeCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1beF0gPSB7fTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gbTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sIHt9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBzaG91bGRDcmVhdGVOZXdPYmplY3QgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZvciAodmFyIGogPSAwOyBqIDwgZGF0dW1GaWVsZHMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAob2JqZWN0RmllbGRzW2RhdHVtRmllbGRzW2pdXSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzaG91bGRDcmVhdGVOZXdPYmplY3QgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoc2hvdWxkQ3JlYXRlTmV3T2JqZWN0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5vYmplY3RzW2ldID0gc2VsZi5fbmV3KCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm9iamVjdHNbaV0gPSBudWxsO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICB1dGlsLmFzeW5jLnBhcmFsbGVsKFtcbiAgICAgICAgICAgICAgICBmdW5jdGlvbiAoZG9uZSkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgbG9jYWxJZGVudGlmaWVycyA9IF8ucGx1Y2soXy5wbHVjayhsb2NhbExvb2t1cHMsICdkYXR1bScpLCAnX2lkJyk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChsb2NhbElkZW50aWZpZXJzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgU3RvcmUuZ2V0TXVsdGlwbGVMb2NhbChsb2NhbElkZW50aWZpZXJzLCBmdW5jdGlvbiAoZXJyLCBvYmplY3RzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsb2NhbElkZW50aWZpZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgb2JqID0gb2JqZWN0c1tpXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBfaWQgPSBsb2NhbElkZW50aWZpZXJzW2ldO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGxvb2t1cCA9IGxvY2FsTG9va3Vwc1tpXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghb2JqKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gSWYgdGhlcmUgYXJlIG11bHRpcGxlIG1hcHBpbmcgb3BlcmF0aW9ucyBnb2luZyBvbiwgdGhlcmUgbWF5IGJlXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb2JqID0gY2FjaGUuZ2V0KHtfaWQ6IF9pZH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghb2JqKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvYmogPSBzZWxmLl9uZXcoe19pZDogX2lkfSwgIXNlbGYuZGlzYWJsZWV2ZW50cyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2VsZi5vYmplY3RzW2xvb2t1cC5pbmRleF0gPSBvYmo7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYub2JqZWN0c1tsb29rdXAuaW5kZXhdID0gb2JqO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRvbmUoZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgZG9uZSgpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBmdW5jdGlvbiAoZG9uZSkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgcmVtb3RlSWRlbnRpZmllcnMgPSBfLnBsdWNrKF8ucGx1Y2socmVtb3RlTG9va3VwcywgJ2RhdHVtJyksIHNlbGYubW9kZWwuaWQpO1xuICAgICAgICAgICAgICAgICAgICBpZiAocmVtb3RlSWRlbnRpZmllcnMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoTG9nZ2VyLnRyYWNlLmlzRW5hYmxlZClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBMb2dnZXIudHJhY2UoJ0xvb2tpbmcgdXAgcmVtb3RlSWRlbnRpZmllcnM6ICcgKyB1dGlsLnByZXR0eVByaW50KHJlbW90ZUlkZW50aWZpZXJzKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBTdG9yZS5nZXRNdWx0aXBsZVJlbW90ZShyZW1vdGVJZGVudGlmaWVycywgc2VsZi5tb2RlbCwgZnVuY3Rpb24gKGVyciwgb2JqZWN0cykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgcmVzdWx0cyA9IHt9O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZm9yIChpID0gMDsgaSA8IG9iamVjdHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXN1bHRzW3JlbW90ZUlkZW50aWZpZXJzW2ldXSA9IG9iamVjdHNbaV0gPyBvYmplY3RzW2ldLl9pZCA6IG51bGw7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBMb2dnZXIudHJhY2UoJ1Jlc3VsdHMgZm9yIHJlbW90ZUlkZW50aWZpZXJzOiAnICsgdXRpbC5wcmV0dHlQcmludChyZXN1bHRzKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZm9yIChpID0gMDsgaSA8IG9iamVjdHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBvYmogPSBvYmplY3RzW2ldO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGxvb2t1cCA9IHJlbW90ZUxvb2t1cHNbaV07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAob2JqKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2VsZi5vYmplY3RzW2xvb2t1cC5pbmRleF0gPSBvYmo7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBkYXRhID0ge307XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHJlbW90ZUlkID0gcmVtb3RlSWRlbnRpZmllcnNbaV07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0YVtzZWxmLm1vZGVsLmlkXSA9IHJlbW90ZUlkO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBjYWNoZVF1ZXJ5ID0ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtb2RlbDogc2VsZi5tb2RlbFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FjaGVRdWVyeVtzZWxmLm1vZGVsLmlkXSA9IHJlbW90ZUlkO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBjYWNoZWQgPSBjYWNoZS5nZXQoY2FjaGVRdWVyeSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGNhY2hlZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZWxmLm9iamVjdHNbbG9va3VwLmluZGV4XSA9IGNhY2hlZDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZWxmLm9iamVjdHNbbG9va3VwLmluZGV4XSA9IHNlbGYuX25ldygpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBJdCdzIGltcG9ydGFudCB0aGF0IHdlIG1hcCB0aGUgcmVtb3RlIGlkZW50aWZpZXIgaGVyZSB0byBlbnN1cmUgdGhhdCBpdCBlbmRzXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHVwIGluIHRoZSBjYWNoZS5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2VsZi5vYmplY3RzW2xvb2t1cC5pbmRleF1bc2VsZi5tb2RlbC5pZF0gPSByZW1vdGVJZDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZG9uZShlcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkb25lKCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICBdLFxuICAgICAgICAgICAgY2FsbGJhY2spO1xuICAgICAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbiAgICB9LFxuICAgIF9sb29rdXBTaW5nbGV0b246IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgICAgICB2YXIgZGVmZXJyZWQgPSB1dGlsLmRlZmVyKGNhbGxiYWNrKTtcbiAgICAgICAgY2FsbGJhY2sgPSBkZWZlcnJlZC5maW5pc2guYmluZChkZWZlcnJlZCk7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgdGhpcy5tb2RlbC5vbmUoe19faWdub3JlSW5zdGFsbGVkOiB0aGlzLl9pZ25vcmVJbnN0YWxsZWR9LCBmdW5jdGlvbiAoZXJyLCBzaW5nbGV0b24pIHtcbiAgICAgICAgICAgIC8vIFBpY2sgYSByYW5kb20gX2lkIGZyb20gdGhlIGFycmF5IG9mIGRhdGEgYmVpbmcgbWFwcGVkIG9udG8gdGhlIHNpbmdsZXRvbiBvYmplY3QuIE5vdGUgdGhhdCB0aGV5IHNob3VsZFxuICAgICAgICAgICAgLy8gYWx3YXlzIGJlIHRoZSBzYW1lLiBUaGlzIGlzIGp1c3QgYSBwcmVjYXV0aW9uLlxuICAgICAgICAgICAgdmFyIF9pZHMgPSBfLnBsdWNrKHNlbGYuZGF0YSwgJ19pZCcpLFxuICAgICAgICAgICAgICAgIF9pZDtcbiAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCBfaWRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgaWYgKF9pZHNbaV0pIHtcbiAgICAgICAgICAgICAgICAgICAgX2lkID0ge19pZDogX2lkc1tpXX07XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICghc2luZ2xldG9uKSBzaW5nbGV0b24gPSBzZWxmLl9uZXcoX2lkKTtcbiAgICAgICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzZWxmLmRhdGEubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgc2VsZi5vYmplY3RzW2ldID0gc2luZ2xldG9uO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbiAgICB9LFxuICAgIF9uZXc6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIG1vZGVsID0gdGhpcy5tb2RlbCxcbiAgICAgICAgICAgIG1vZGVsSW5zdGFuY2UgPSBtb2RlbC5fbmV3LmFwcGx5KG1vZGVsLCBhcmd1bWVudHMpO1xuICAgICAgICB0aGlzLl9uZXdPYmplY3RzLnB1c2gobW9kZWxJbnN0YW5jZSk7XG4gICAgICAgIHJldHVybiBtb2RlbEluc3RhbmNlO1xuICAgIH0sXG4gICAgc3RhcnQ6IGZ1bmN0aW9uIChkb25lKSB7XG4gICAgICAgIGlmICh0aGlzLmRhdGEubGVuZ3RoKSB7XG4gICAgICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgICAgICB2YXIgdGFza3MgPSBbXTtcbiAgICAgICAgICAgIHZhciBsb29rdXBGdW5jID0gdGhpcy5tb2RlbC5zaW5nbGV0b24gPyB0aGlzLl9sb29rdXBTaW5nbGV0b24gOiB0aGlzLl9sb29rdXA7XG4gICAgICAgICAgICB0YXNrcy5wdXNoKF8uYmluZChsb29rdXBGdW5jLCB0aGlzKSk7XG4gICAgICAgICAgICB0YXNrcy5wdXNoKF8uYmluZCh0aGlzLl9leGVjdXRlU3ViT3BlcmF0aW9ucywgdGhpcykpO1xuICAgICAgICAgICAgdXRpbC5hc3luYy5wYXJhbGxlbCh0YXNrcywgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHNlbGYuX21hcCgpO1xuXG4gICAgICAgICAgICAgICAgLy8gVXNlcnMgYXJlIGFsbG93ZWQgdG8gYWRkIGEgY3VzdG9tIGluaXQgbWV0aG9kIHRvIHRoZSBtZXRob2RzIG9iamVjdCB3aGVuIGRlZmluaW5nIGEgTW9kZWwsIG9mIHRoZSBmb3JtOlxuICAgICAgICAgICAgICAgIC8vXG4gICAgICAgICAgICAgICAgLy8gbWV0aG9kczoge1xuICAgICAgICAgICAgICAgIC8vICAgICBfX2luaXQ6IGZ1bmN0aW9uIChbZG9uZV0pIHtcbiAgICAgICAgICAgICAgICAvLyAgICAgICAgLy8gLi4uXG4gICAgICAgICAgICAgICAgLy8gICAgIH1cbiAgICAgICAgICAgICAgICAvLyB9XG4gICAgICAgICAgICAgICAgLy9cbiAgICAgICAgICAgICAgICAvLyBJZiBkb25lIGlzIHBhc3NlZCwgdGhlbiBfX2luaXQgbXVzdCBiZSBleGVjdXRlZCBhc3luY2hyb25vdXNseSwgYW5kIHRoZSBtYXBwaW5nIG9wZXJhdGlvbiB3aWxsIG5vdFxuICAgICAgICAgICAgICAgIC8vIGZpbmlzaCB1bnRpbCBhbGwgaW5pdHMgaGF2ZSBleGVjdXRlZC5cbiAgICAgICAgICAgICAgICAvL1xuICAgICAgICAgICAgICAgIC8vIEhlcmUgd2UgZW5zdXJlIHRoZSBleGVjdXRpb24gb2YgYWxsIG9mIHRoZW1cblxuICAgICAgICAgICAgICAgIHZhciBpbml0VGFza3MgPSBfLnJlZHVjZShzZWxmLl9uZXdPYmplY3RzLCBmdW5jdGlvbiAobSwgbykge1xuICAgICAgICAgICAgICAgICAgICB2YXIgaW5pdCA9IG8ubW9kZWwuaW5pdDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGluaXQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBwYXJhbU5hbWVzID0gdXRpbC5wYXJhbU5hbWVzKGluaXQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHBhcmFtTmFtZXMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbS5wdXNoKF8uYmluZChpbml0LCBvLCBkb25lKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbml0LmNhbGwobyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG07XG4gICAgICAgICAgICAgICAgfSwgW10pO1xuICAgICAgICAgICAgICAgIGFzeW5jLnBhcmFsbGVsKGluaXRUYXNrcywgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICBkb25lKHNlbGYuZXJyb3JzLmxlbmd0aCA/IHNlbGYuZXJyb3JzIDogbnVsbCwgc2VsZi5vYmplY3RzKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZG9uZShudWxsLCBbXSk7XG4gICAgICAgIH1cbiAgICB9LFxuICAgIGdldFJlbGF0ZWREYXRhOiBmdW5jdGlvbiAobmFtZSkge1xuICAgICAgICB2YXIgaW5kZXhlcyA9IFtdO1xuICAgICAgICB2YXIgcmVsYXRlZERhdGEgPSBbXTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLmRhdGEubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHZhciBkYXR1bSA9IHRoaXMuZGF0YVtpXTtcbiAgICAgICAgICAgIGlmIChkYXR1bSkge1xuICAgICAgICAgICAgICAgIGlmIChkYXR1bVtuYW1lXSkge1xuICAgICAgICAgICAgICAgICAgICBpbmRleGVzLnB1c2goaSk7XG4gICAgICAgICAgICAgICAgICAgIHJlbGF0ZWREYXRhLnB1c2goZGF0dW1bbmFtZV0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgaW5kZXhlczogaW5kZXhlcyxcbiAgICAgICAgICAgIHJlbGF0ZWREYXRhOiByZWxhdGVkRGF0YVxuICAgICAgICB9O1xuICAgIH0sXG4gICAgcHJvY2Vzc0Vycm9yc0Zyb21UYXNrOiBmdW5jdGlvbiAocmVsYXRpb25zaGlwTmFtZSwgZXJyb3JzLCBpbmRleGVzKSB7XG4gICAgICAgIGlmIChlcnJvcnMubGVuZ3RoKSB7XG4gICAgICAgICAgICB2YXIgcmVsYXRlZERhdGEgPSB0aGlzLmdldFJlbGF0ZWREYXRhKHJlbGF0aW9uc2hpcE5hbWUpLnJlbGF0ZWREYXRhO1xuICAgICAgICAgICAgdmFyIHVuZmxhdHRlbmVkRXJyb3JzID0gdXRpbC51bmZsYXR0ZW5BcnJheShlcnJvcnMsIHJlbGF0ZWREYXRhKTtcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdW5mbGF0dGVuZWRFcnJvcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICB2YXIgaWR4ID0gaW5kZXhlc1tpXTtcbiAgICAgICAgICAgICAgICB2YXIgZXJyID0gdW5mbGF0dGVuZWRFcnJvcnNbaV07XG4gICAgICAgICAgICAgICAgdmFyIGlzRXJyb3IgPSBlcnI7XG4gICAgICAgICAgICAgICAgaWYgKHV0aWwuaXNBcnJheShlcnIpKSBpc0Vycm9yID0gXy5yZWR1Y2UoZXJyLCBmdW5jdGlvbiAobWVtbywgeCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbWVtbyB8fCB4XG4gICAgICAgICAgICAgICAgfSwgZmFsc2UpO1xuICAgICAgICAgICAgICAgIGlmIChpc0Vycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghdGhpcy5lcnJvcnNbaWR4XSkgdGhpcy5lcnJvcnNbaWR4XSA9IHt9O1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmVycm9yc1tpZHhdW3JlbGF0aW9uc2hpcE5hbWVdID0gZXJyO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0sXG4gICAgX2V4ZWN1dGVTdWJPcGVyYXRpb25zOiBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzLFxuICAgICAgICAgICAgcmVsYXRpb25zaGlwTmFtZXMgPSBfLmtleXModGhpcy5tb2RlbC5yZWxhdGlvbnNoaXBzKTtcbiAgICAgICAgaWYgKHJlbGF0aW9uc2hpcE5hbWVzLmxlbmd0aCkge1xuICAgICAgICAgICAgdmFyIHRhc2tzID0gXy5yZWR1Y2UocmVsYXRpb25zaGlwTmFtZXMsIGZ1bmN0aW9uIChtLCByZWxhdGlvbnNoaXBOYW1lKSB7XG4gICAgICAgICAgICAgICAgdmFyIHJlbGF0aW9uc2hpcCA9IHNlbGYubW9kZWwucmVsYXRpb25zaGlwc1tyZWxhdGlvbnNoaXBOYW1lXSxcbiAgICAgICAgICAgICAgICAgICAgcmV2ZXJzZU1vZGVsID0gcmVsYXRpb25zaGlwLmZvcndhcmROYW1lID09IHJlbGF0aW9uc2hpcE5hbWUgPyByZWxhdGlvbnNoaXAucmV2ZXJzZU1vZGVsIDogcmVsYXRpb25zaGlwLmZvcndhcmRNb2RlbCxcbiAgICAgICAgICAgICAgICAgICAgX19yZXQgPSB0aGlzLmdldFJlbGF0ZWREYXRhKHJlbGF0aW9uc2hpcE5hbWUpLFxuICAgICAgICAgICAgICAgICAgICBpbmRleGVzID0gX19yZXQuaW5kZXhlcyxcbiAgICAgICAgICAgICAgICAgICAgcmVsYXRlZERhdGEgPSBfX3JldC5yZWxhdGVkRGF0YTtcbiAgICAgICAgICAgICAgICBpZiAocmVsYXRlZERhdGEubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBmbGF0UmVsYXRlZERhdGEgPSB1dGlsLmZsYXR0ZW5BcnJheShyZWxhdGVkRGF0YSk7XG4gICAgICAgICAgICAgICAgICAgIHZhciBvcCA9IG5ldyBNYXBwaW5nT3BlcmF0aW9uKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG1vZGVsOiByZXZlcnNlTW9kZWwsXG4gICAgICAgICAgICAgICAgICAgICAgICBkYXRhOiBmbGF0UmVsYXRlZERhdGEsXG4gICAgICAgICAgICAgICAgICAgICAgICBkaXNhYmxlZXZlbnRzOiBzZWxmLmRpc2FibGVldmVudHMsXG4gICAgICAgICAgICAgICAgICAgICAgICBfaWdub3JlSW5zdGFsbGVkOiBzZWxmLl9pZ25vcmVJbnN0YWxsZWRcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChvcCkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgdGFzaztcbiAgICAgICAgICAgICAgICAgICAgdGFzayA9IGZ1bmN0aW9uIChkb25lKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBvcC5zdGFydChmdW5jdGlvbiAoZXJyb3JzLCBvYmplY3RzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc2VsZi5zdWJUYXNrUmVzdWx0c1tyZWxhdGlvbnNoaXBOYW1lXSA9IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZXJyb3JzOiBlcnJvcnMsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9iamVjdHM6IG9iamVjdHMsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGluZGV4ZXM6IGluZGV4ZXNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYucHJvY2Vzc0Vycm9yc0Zyb21UYXNrKHJlbGF0aW9uc2hpcE5hbWUsIG9wLmVycm9ycywgaW5kZXhlcyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZG9uZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgICAgIG0ucHVzaCh0YXNrKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIG07XG4gICAgICAgICAgICB9LmJpbmQodGhpcyksIFtdKTtcbiAgICAgICAgICAgIGFzeW5jLnBhcmFsbGVsKHRhc2tzLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY2FsbGJhY2soKTtcbiAgICAgICAgfVxuICAgIH1cbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IE1hcHBpbmdPcGVyYXRpb247XG5cblxuIiwiLyoqXG4gKiBAbW9kdWxlIG1hcHBpbmdcbiAqL1xuXG52YXIgbG9nID0gcmVxdWlyZSgnLi9sb2cnKSxcbiAgICBDb2xsZWN0aW9uUmVnaXN0cnkgPSByZXF1aXJlKCcuL2NvbGxlY3Rpb25SZWdpc3RyeScpLkNvbGxlY3Rpb25SZWdpc3RyeSxcbiAgICBJbnRlcm5hbFNpZXN0YUVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpLkludGVybmFsU2llc3RhRXJyb3IsXG4gICAgUmVsYXRpb25zaGlwVHlwZSA9IHJlcXVpcmUoJy4vUmVsYXRpb25zaGlwVHlwZScpLFxuICAgIFF1ZXJ5ID0gcmVxdWlyZSgnLi9xdWVyeScpLFxuICAgIE1hcHBpbmdPcGVyYXRpb24gPSByZXF1aXJlKCcuL21hcHBpbmdPcGVyYXRpb24nKSxcbiAgICBNb2RlbEluc3RhbmNlID0gcmVxdWlyZSgnLi9tb2RlbEluc3RhbmNlJyksXG4gICAgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpLFxuICAgIGNhY2hlID0gcmVxdWlyZSgnLi9jYWNoZScpLFxuICAgIHN0b3JlID0gcmVxdWlyZSgnLi9zdG9yZScpLFxuICAgIGV4dGVuZCA9IHJlcXVpcmUoJ2V4dGVuZCcpLFxuICAgIG1vZGVsRXZlbnRzID0gcmVxdWlyZSgnLi9tb2RlbEV2ZW50cycpLFxuICAgIGV2ZW50cyA9IHJlcXVpcmUoJy4vZXZlbnRzJyksXG4gICAgd3JhcEFycmF5ID0gcmVxdWlyZSgnLi9ldmVudHMnKS53cmFwQXJyYXksXG4gICAgcHJveHkgPSByZXF1aXJlKCcuL1JlbGF0aW9uc2hpcFByb3h5JyksXG4gICAgT25lVG9NYW55UHJveHkgPSByZXF1aXJlKCcuL09uZVRvTWFueVByb3h5JyksXG4gICAgT25lVG9PbmVQcm94eSA9IHJlcXVpcmUoJy4vT25lVG9PbmVQcm94eScpLFxuICAgIE1hbnlUb01hbnlQcm94eSA9IHJlcXVpcmUoJy4vbWFueVRvTWFueVByb3h5JyksXG4gICAgUmVhY3RpdmVRdWVyeSA9IHJlcXVpcmUoJy4vcmVhY3RpdmVRdWVyeScpLFxuICAgIEFycmFuZ2VkUmVhY3RpdmVRdWVyeSA9IHJlcXVpcmUoJy4vQXJyYW5nZWRSZWFjdGl2ZVF1ZXJ5JyksXG4gICAgXyA9IHV0aWwuXyxcbiAgICBndWlkID0gdXRpbC5ndWlkLFxuICAgIE1vZGVsRXZlbnRUeXBlID0gbW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGU7XG5cbnZhciBMb2dnZXIgPSBsb2cubG9nZ2VyV2l0aE5hbWUoJ01vZGVsJyk7XG5cbi8qKlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRzXG4gKi9cbmZ1bmN0aW9uIE1vZGVsKG9wdHMpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdGhpcy5fb3B0cyA9IG9wdHMgPyBfLmV4dGVuZCh7fSwgb3B0cykgOiB7fTtcblxuICAgIHV0aWwuZXh0ZW5kRnJvbU9wdHModGhpcywgb3B0cywge1xuICAgICAgICBtZXRob2RzOiB7fSxcbiAgICAgICAgYXR0cmlidXRlczogW10sXG4gICAgICAgIGNvbGxlY3Rpb246IGZ1bmN0aW9uIChjKSB7XG4gICAgICAgICAgICBpZiAodXRpbC5pc1N0cmluZyhjKSkge1xuICAgICAgICAgICAgICAgIGMgPSBDb2xsZWN0aW9uUmVnaXN0cnlbY107XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gYztcbiAgICAgICAgfSxcbiAgICAgICAgaWQ6ICdpZCcsXG4gICAgICAgIHJlbGF0aW9uc2hpcHM6IFtdLFxuICAgICAgICBuYW1lOiBudWxsLFxuICAgICAgICBpbmRleGVzOiBbXSxcbiAgICAgICAgc2luZ2xldG9uOiBmYWxzZSxcbiAgICAgICAgc3RhdGljczogdGhpcy5pbnN0YWxsU3RhdGljcy5iaW5kKHRoaXMpLFxuICAgICAgICBwcm9wZXJ0aWVzOiB7fSxcbiAgICAgICAgaW5pdDogbnVsbCxcbiAgICAgICAgcmVtb3ZlOiBudWxsXG4gICAgfSk7XG5cbiAgICB0aGlzLmF0dHJpYnV0ZXMgPSBNb2RlbC5fcHJvY2Vzc0F0dHJpYnV0ZXModGhpcy5hdHRyaWJ1dGVzKTtcblxuICAgIF8uZXh0ZW5kKHRoaXMsIHtcbiAgICAgICAgX2luc3RhbGxlZDogZmFsc2UsXG4gICAgICAgIF9yZWxhdGlvbnNoaXBzSW5zdGFsbGVkOiBmYWxzZSxcbiAgICAgICAgX3JldmVyc2VSZWxhdGlvbnNoaXBzSW5zdGFsbGVkOiBmYWxzZSxcbiAgICAgICAgY2hpbGRyZW46IFtdXG4gICAgfSk7XG5cbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydGllcyh0aGlzLCB7XG4gICAgICAgIF9yZWxhdGlvbnNoaXBOYW1lczoge1xuICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIE9iamVjdC5rZXlzKHNlbGYucmVsYXRpb25zaGlwcyk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZVxuICAgICAgICB9LFxuICAgICAgICBfYXR0cmlidXRlTmFtZXM6IHtcbiAgICAgICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHZhciBuYW1lcyA9IFtdO1xuICAgICAgICAgICAgICAgIGlmIChzZWxmLmlkKSB7XG4gICAgICAgICAgICAgICAgICAgIG5hbWVzLnB1c2goc2VsZi5pZCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIF8uZWFjaChzZWxmLmF0dHJpYnV0ZXMsIGZ1bmN0aW9uICh4KSB7XG4gICAgICAgICAgICAgICAgICAgIG5hbWVzLnB1c2goeC5uYW1lKVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIHJldHVybiBuYW1lcztcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgICAgIH0sXG4gICAgICAgIGluc3RhbGxlZDoge1xuICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHNlbGYuX2luc3RhbGxlZCAmJiBzZWxmLl9yZWxhdGlvbnNoaXBzSW5zdGFsbGVkICYmIHNlbGYuX3JldmVyc2VSZWxhdGlvbnNoaXBzSW5zdGFsbGVkO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICAgICAgfSxcbiAgICAgICAgZGVzY2VuZGFudHM6IHtcbiAgICAgICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBfLnJlZHVjZShzZWxmLmNoaWxkcmVuLCBmdW5jdGlvbiAobWVtbywgZGVzY2VuZGFudCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gQXJyYXkucHJvdG90eXBlLmNvbmNhdC5jYWxsKG1lbW8sIGRlc2NlbmRhbnQuZGVzY2VuZGFudHMpO1xuICAgICAgICAgICAgICAgIH0uYmluZChzZWxmKSwgXy5leHRlbmQoW10sIHNlbGYuY2hpbGRyZW4pKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlXG4gICAgICAgIH0sXG4gICAgICAgIGRpcnR5OiB7XG4gICAgICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBpZiAoc2llc3RhLmV4dC5zdG9yYWdlRW5hYmxlZCkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgdW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb24gPSBzaWVzdGEuZXh0LnN0b3JhZ2UuX3Vuc2F2ZWRPYmplY3RzQnlDb2xsZWN0aW9uLFxuICAgICAgICAgICAgICAgICAgICAgICAgaGFzaCA9ICh1bnNhdmVkT2JqZWN0c0J5Q29sbGVjdGlvblt0aGlzLmNvbGxlY3Rpb25OYW1lXSB8fCB7fSlbdGhpcy5uYW1lXSB8fCB7fTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuICEhT2JqZWN0LmtleXMoaGFzaCkubGVuZ3RoO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZVxuICAgICAgICB9LFxuICAgICAgICBjb2xsZWN0aW9uTmFtZToge1xuICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuY29sbGVjdGlvbi5uYW1lO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICAgICAgfVxuICAgIH0pO1xuXG5cbn1cblxuXy5leHRlbmQoTW9kZWwsIHtcbiAgICAvKipcbiAgICAgKiBOb3JtYWxpc2UgYXR0cmlidXRlcyBwYXNzZWQgdmlhIHRoZSBvcHRpb25zIGRpY3Rpb25hcnkuXG4gICAgICogQHBhcmFtIGF0dHJpYnV0ZXNcbiAgICAgKiBAcmV0dXJucyB7QXJyYXl9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfcHJvY2Vzc0F0dHJpYnV0ZXM6IGZ1bmN0aW9uIChhdHRyaWJ1dGVzKSB7XG4gICAgICAgIHJldHVybiBfLnJlZHVjZShhdHRyaWJ1dGVzLCBmdW5jdGlvbiAobSwgYSkge1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBhID09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgICAgbS5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgbmFtZTogYVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgbS5wdXNoKGEpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIG07XG4gICAgICAgIH0sIFtdKVxuICAgIH1cbn0pO1xuXG5fLmV4dGVuZChNb2RlbC5wcm90b3R5cGUsIHtcbiAgICBpbnN0YWxsU3RhdGljczogZnVuY3Rpb24gKHN0YXRpY3MpIHtcbiAgICAgICAgaWYgKHN0YXRpY3MpIHtcbiAgICAgICAgICAgIF8uZWFjaChPYmplY3Qua2V5cyhzdGF0aWNzKSwgZnVuY3Rpb24gKHN0YXRpY05hbWUpIHtcbiAgICAgICAgICAgICAgICBpZiAodGhpc1tzdGF0aWNOYW1lXSkge1xuICAgICAgICAgICAgICAgICAgICBMb2dnZXIuZXJyb3IoJ1N0YXRpYyBtZXRob2Qgd2l0aCBuYW1lIFwiJyArIHN0YXRpY05hbWUgKyAnXCIgYWxyZWFkeSBleGlzdHMuIElnbm9yaW5nIGl0LicpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpc1tzdGF0aWNOYW1lXSA9IHN0YXRpY3Nbc3RhdGljTmFtZV0uYmluZCh0aGlzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBzdGF0aWNzO1xuICAgIH0sXG4gICAgLyoqXG4gICAgICogSW5zdGFsbCByZWxhdGlvbnNoaXBzLiBSZXR1cm5zIGVycm9yIGluIGZvcm0gb2Ygc3RyaW5nIGlmIGZhaWxzLlxuICAgICAqIEByZXR1cm4ge1N0cmluZ3xudWxsfVxuICAgICAqL1xuICAgIGluc3RhbGxSZWxhdGlvbnNoaXBzOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmICghdGhpcy5fcmVsYXRpb25zaGlwc0luc3RhbGxlZCkge1xuICAgICAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICAgICAgc2VsZi5fcmVsYXRpb25zaGlwcyA9IFtdO1xuICAgICAgICAgICAgaWYgKHNlbGYuX29wdHMucmVsYXRpb25zaGlwcykge1xuICAgICAgICAgICAgICAgIGZvciAodmFyIG5hbWUgaW4gc2VsZi5fb3B0cy5yZWxhdGlvbnNoaXBzKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChzZWxmLl9vcHRzLnJlbGF0aW9uc2hpcHMuaGFzT3duUHJvcGVydHkobmFtZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciByZWxhdGlvbnNoaXAgPSBzZWxmLl9vcHRzLnJlbGF0aW9uc2hpcHNbbmFtZV07XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBJZiBhIHJldmVyc2UgcmVsYXRpb25zaGlwIGlzIGluc3RhbGxlZCBiZWZvcmVoYW5kLCB3ZSBkbyBub3Qgd2FudCB0byBwcm9jZXNzIHRoZW0uXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIXJlbGF0aW9uc2hpcC5pc1JldmVyc2UpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoTG9nZ2VyLmRlYnVnLmlzRW5hYmxlZClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgTG9nZ2VyLmRlYnVnKHNlbGYubmFtZSArICc6IGNvbmZpZ3VyaW5nIHJlbGF0aW9uc2hpcCAnICsgbmFtZSwgcmVsYXRpb25zaGlwKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIXJlbGF0aW9uc2hpcC50eXBlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzZWxmLnNpbmdsZXRvbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVsYXRpb25zaGlwLnR5cGUgPSBSZWxhdGlvbnNoaXBUeXBlLk9uZVRvT25lO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVsYXRpb25zaGlwLnR5cGUgPSBSZWxhdGlvbnNoaXBUeXBlLk9uZVRvTWFueTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAocmVsYXRpb25zaGlwLnR5cGUgPT0gUmVsYXRpb25zaGlwVHlwZS5PbmVUb01hbnkgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVsYXRpb25zaGlwLnR5cGUgPT0gUmVsYXRpb25zaGlwVHlwZS5PbmVUb09uZSB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZWxhdGlvbnNoaXAudHlwZSA9PSBSZWxhdGlvbnNoaXBUeXBlLk1hbnlUb01hbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG1vZGVsTmFtZSA9IHJlbGF0aW9uc2hpcC5tb2RlbDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVsZXRlIHJlbGF0aW9uc2hpcC5tb2RlbDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHJldmVyc2VNb2RlbDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG1vZGVsTmFtZSBpbnN0YW5jZW9mIE1vZGVsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXZlcnNlTW9kZWwgPSBtb2RlbE5hbWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoTG9nZ2VyLmRlYnVnLmlzRW5hYmxlZClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBMb2dnZXIuZGVidWcoJ3JldmVyc2VNb2RlbE5hbWUnLCBtb2RlbE5hbWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFzZWxmLmNvbGxlY3Rpb24pIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdNb2RlbCBtdXN0IGhhdmUgY29sbGVjdGlvbicpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGNvbGxlY3Rpb24gPSBzZWxmLmNvbGxlY3Rpb247XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWNvbGxlY3Rpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignQ29sbGVjdGlvbiAnICsgc2VsZi5jb2xsZWN0aW9uTmFtZSArICcgbm90IHJlZ2lzdGVyZWQnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldmVyc2VNb2RlbCA9IGNvbGxlY3Rpb25bbW9kZWxOYW1lXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghcmV2ZXJzZU1vZGVsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgYXJyID0gbW9kZWxOYW1lLnNwbGl0KCcuJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoYXJyLmxlbmd0aCA9PSAyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGNvbGxlY3Rpb25OYW1lID0gYXJyWzBdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1vZGVsTmFtZSA9IGFyclsxXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgb3RoZXJDb2xsZWN0aW9uID0gQ29sbGVjdGlvblJlZ2lzdHJ5W2NvbGxlY3Rpb25OYW1lXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIW90aGVyQ29sbGVjdGlvbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gJ0NvbGxlY3Rpb24gd2l0aCBuYW1lIFwiJyArIGNvbGxlY3Rpb25OYW1lICsgJ1wiIGRvZXMgbm90IGV4aXN0Lic7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldmVyc2VNb2RlbCA9IG90aGVyQ29sbGVjdGlvblttb2RlbE5hbWVdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChMb2dnZXIuZGVidWcuaXNFbmFibGVkKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgTG9nZ2VyLmRlYnVnKCdyZXZlcnNlTW9kZWwnLCByZXZlcnNlTW9kZWwpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAocmV2ZXJzZU1vZGVsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZWxhdGlvbnNoaXAucmV2ZXJzZU1vZGVsID0gcmV2ZXJzZU1vZGVsO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVsYXRpb25zaGlwLmZvcndhcmRNb2RlbCA9IHRoaXM7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZWxhdGlvbnNoaXAuZm9yd2FyZE5hbWUgPSBuYW1lO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVsYXRpb25zaGlwLnJldmVyc2VOYW1lID0gcmVsYXRpb25zaGlwLnJldmVyc2UgfHwgJ3JldmVyc2VfJyArIG5hbWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZWxldGUgcmVsYXRpb25zaGlwLnJldmVyc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZWxhdGlvbnNoaXAuaXNSZXZlcnNlID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gJ01vZGVsIHdpdGggbmFtZSBcIicgKyBtb2RlbE5hbWUudG9TdHJpbmcoKSArICdcIiBkb2VzIG5vdCBleGlzdCc7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gJ1JlbGF0aW9uc2hpcCB0eXBlICcgKyByZWxhdGlvbnNoaXAudHlwZSArICcgZG9lcyBub3QgZXhpc3QnO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuX3JlbGF0aW9uc2hpcHNJbnN0YWxsZWQgPSB0cnVlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ1JlbGF0aW9uc2hpcHMgZm9yIFwiJyArIHRoaXMubmFtZSArICdcIiBoYXZlIGFscmVhZHkgYmVlbiBpbnN0YWxsZWQnKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9LFxuICAgIGluc3RhbGxSZXZlcnNlUmVsYXRpb25zaGlwczogZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAoIXRoaXMuX3JldmVyc2VSZWxhdGlvbnNoaXBzSW5zdGFsbGVkKSB7XG4gICAgICAgICAgICBmb3IgKHZhciBmb3J3YXJkTmFtZSBpbiB0aGlzLnJlbGF0aW9uc2hpcHMpIHtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5yZWxhdGlvbnNoaXBzLmhhc093blByb3BlcnR5KGZvcndhcmROYW1lKSkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgcmVsYXRpb25zaGlwID0gdGhpcy5yZWxhdGlvbnNoaXBzW2ZvcndhcmROYW1lXTtcbiAgICAgICAgICAgICAgICAgICAgcmVsYXRpb25zaGlwID0gZXh0ZW5kKHRydWUsIHt9LCByZWxhdGlvbnNoaXApO1xuICAgICAgICAgICAgICAgICAgICByZWxhdGlvbnNoaXAuaXNSZXZlcnNlID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHJldmVyc2VNb2RlbCA9IHJlbGF0aW9uc2hpcC5yZXZlcnNlTW9kZWw7XG4gICAgICAgICAgICAgICAgICAgIHZhciByZXZlcnNlTmFtZSA9IHJlbGF0aW9uc2hpcC5yZXZlcnNlTmFtZTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKExvZ2dlci5kZWJ1Zy5pc0VuYWJsZWQpXG4gICAgICAgICAgICAgICAgICAgICAgICBMb2dnZXIuZGVidWcodGhpcy5uYW1lICsgJzogY29uZmlndXJpbmcgIHJldmVyc2UgcmVsYXRpb25zaGlwICcgKyByZXZlcnNlTmFtZSk7XG4gICAgICAgICAgICAgICAgICAgIHJldmVyc2VNb2RlbC5yZWxhdGlvbnNoaXBzW3JldmVyc2VOYW1lXSA9IHJlbGF0aW9uc2hpcDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLl9yZXZlcnNlUmVsYXRpb25zaGlwc0luc3RhbGxlZCA9IHRydWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignUmV2ZXJzZSByZWxhdGlvbnNoaXBzIGZvciBcIicgKyB0aGlzLm5hbWUgKyAnXCIgaGF2ZSBhbHJlYWR5IGJlZW4gaW5zdGFsbGVkLicpO1xuICAgICAgICB9XG4gICAgfSxcbiAgICBlbnN1cmVTaW5nbGV0b25zOiBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICAgICAgaWYgKHRoaXMuc2luZ2xldG9uKSB7XG4gICAgICAgICAgICB0aGlzLm9uZSh7X19pZ25vcmVJbnN0YWxsZWQ6IHRydWV9LCBmdW5jdGlvbiAoZXJyLCBvYmopIHtcbiAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIW9iaikge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGRhdGEgPSB7fTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciByZWxhdGlvbnNoaXBzID0gdGhpcy5yZWxhdGlvbnNoaXBzO1xuICAgICAgICAgICAgICAgICAgICAgICAgZGF0YSA9IF8ucmVkdWNlKE9iamVjdC5rZXlzKHJlbGF0aW9uc2hpcHMpLCBmdW5jdGlvbiAobSwgbmFtZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciByID0gcmVsYXRpb25zaGlwc1tuYW1lXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoci5pc1JldmVyc2UpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0YVtyLnJldmVyc2VOYW1lXSA9IHt9O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZGF0YTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sIGRhdGEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5tYXAoZGF0YSwge19pZ25vcmVJbnN0YWxsZWQ6IHRydWV9LCBmdW5jdGlvbiAoZXJyLCBvYmopIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoTG9nZ2VyLnRyYWNlKSBMb2dnZXIudHJhY2UoJ0Vuc3VyZWQgc2luZ2xldG9uIG1hcHBpbmcgXCInICsgdGhpcy5uYW1lICsgJ1wiJywgb2JqKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIsIG9iaik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKExvZ2dlci50cmFjZSkgTG9nZ2VyLnRyYWNlKCdTaW5nbGV0b24gYWxyZWFkeSBleGlzdHMgZm9yIG1hcHBpbmcgXCInICsgdGhpcy5uYW1lICsgJ1wiJywgb2JqKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIG9iaik7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgY2FsbGJhY2soKTtcbiAgICAgICAgfVxuICAgIH0sIC8qKlxuICAgICAqIEFueSBwb3N0IGluc3RhbGxhdGlvbiBzdGVwcyB0aGF0IG5lZWQgdG8gYmUgcGVyZm9ybWVkLlxuICAgICAqL1xuICAgIGZpbmFsaXNlSW5zdGFsbGF0aW9uOiBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICAgICAgaWYgKHRoaXMuc2luZ2xldG9uKSB7XG4gICAgICAgICAgICAvLyBFbnN1cmUgdGhhdCB0aGUgc2luZ2xldG9uIG9iamVjdHMgZXhpc3QsIGFuZCB0aGF0IGFsbCBzaW5nbGV0b24gcmVsYXRpb25zaGlwc1xuICAgICAgICAgICAgLy8gYXJlIGhvb2tlZCB1cC5cbiAgICAgICAgICAgIC8vIFRPRE86IEFueSBwYXJlbnQgc2luZ2xldG9ucyB3aWxsIGJlIGhhdmluZyBlbXB0eSBkYXRhIG1hcHBlZCB0d2ljZSB3aGVuIHRoZWlyIG93biBmaW5hbGlzZSBpcyBjYWxsZWQuLi4gUG9pbnRsZXNzLlxuICAgICAgICAgICAgdGhpcy5lbnN1cmVTaW5nbGV0b25zKGNhbGxiYWNrKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGNhbGxiYWNrKCk7XG4gICAgfSxcbiAgICBfcXVlcnk6IGZ1bmN0aW9uIChxdWVyeSkge1xuICAgICAgICB2YXIgcXVlcnkgPSBuZXcgUXVlcnkodGhpcywgcXVlcnkgfHwge30pO1xuICAgICAgICByZXR1cm4gcXVlcnk7XG4gICAgfSxcbiAgICBxdWVyeTogZnVuY3Rpb24gKHF1ZXJ5LCBjYWxsYmFjaykge1xuICAgICAgICByZXR1cm4gKHRoaXMuX3F1ZXJ5KHF1ZXJ5KSkuZXhlY3V0ZShjYWxsYmFjayk7XG4gICAgfSxcbiAgICByZWFjdGl2ZVF1ZXJ5OiBmdW5jdGlvbiAocXVlcnkpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBSZWFjdGl2ZVF1ZXJ5KG5ldyBRdWVyeSh0aGlzLCBxdWVyeSB8fCB7fSkpO1xuICAgIH0sXG4gICAgYXJyYW5nZWRSZWFjdGl2ZVF1ZXJ5OiBmdW5jdGlvbiAocXVlcnkpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBBcnJhbmdlZFJlYWN0aXZlUXVlcnkobmV3IFF1ZXJ5KHRoaXMsIHF1ZXJ5IHx8IHt9KSk7XG4gICAgfSxcbiAgICBvbmU6IGZ1bmN0aW9uIChvcHRzLCBjYikge1xuICAgICAgICBvcHRzID0gb3B0cyB8fCB7fTtcbiAgICAgICAgaWYgKHR5cGVvZiBvcHRzID09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIGNiID0gb3B0cztcbiAgICAgICAgICAgIG9wdHMgPSB7fTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgcXVlcnkgPSB0aGlzLl9xdWVyeShvcHRzKTtcbiAgICAgICAgLy8gT3ZlcnJpZGUgdGhlIHVzdWFsIGV4ZWN1dGUgbWV0aG9kLCBpbnNlcnRpbmcgYSBjaGVjayB0aGF0IG5vIG1vcmUgb25lIGluc3RhbmNlcyByZXR1cm5lZC5cbiAgICAgICAgcmV0dXJuIChmdW5jdGlvbiAoY2IpIHtcbiAgICAgICAgICAgIHZhciBkZWZlcnJlZCA9IHV0aWwuZGVmZXIoY2IpO1xuICAgICAgICAgICAgY2IgPSBkZWZlcnJlZC5maW5pc2guYmluZChkZWZlcnJlZCk7XG4gICAgICAgICAgICB0aGlzLl9leGVjdXRlSW5NZW1vcnkoZnVuY3Rpb24gKGVyciwgcmVzKSB7XG4gICAgICAgICAgICAgICAgaWYgKGVycikgY2IoZXJyKTtcbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHJlcy5sZW5ndGggPiAxKSBjYignTW9yZSB0aGFuIG9uZSBpbnN0YW5jZSByZXR1cm5lZCB3aGVuIGV4ZWN1dGluZyBnZXQgcXVlcnkhJyk7XG4gICAgICAgICAgICAgICAgICAgIGVsc2UgY2IobnVsbCwgcmVzLmxlbmd0aCA/IHJlc1swXSA6IG51bGwpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG4gICAgICAgIH0pLmNhbGwocXVlcnksIGNiKVxuICAgIH0sXG4gICAgYWxsOiBmdW5jdGlvbiAocSwgY2IpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBxID09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIGNiID0gcTtcbiAgICAgICAgICAgIHEgPSB7fTtcbiAgICAgICAgfVxuICAgICAgICBxID0gcSB8fCB7fTtcbiAgICAgICAgdmFyIHF1ZXJ5ID0ge307XG4gICAgICAgIGlmIChxLl9fb3JkZXIpIHF1ZXJ5Ll9fb3JkZXIgPSBxLl9fb3JkZXI7XG4gICAgICAgIHJldHVybiAobmV3IFF1ZXJ5KHRoaXMsIHF1ZXJ5KSkuZXhlY3V0ZShjYik7XG4gICAgfSxcbiAgICBpbnN0YWxsOiBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICAgICAgaWYgKExvZ2dlci5pbmZvLmlzRW5hYmxlZCkgTG9nZ2VyLmluZm8oJ0luc3RhbGxpbmcgbWFwcGluZyAnICsgdGhpcy5uYW1lKTtcbiAgICAgICAgdmFyIGRlZmVycmVkID0gdXRpbC5kZWZlcihjYWxsYmFjayk7XG4gICAgICAgIGNhbGxiYWNrID0gZGVmZXJyZWQuZmluaXNoLmJpbmQoZGVmZXJyZWQpO1xuICAgICAgICBpZiAoIXRoaXMuX2luc3RhbGxlZCkge1xuICAgICAgICAgICAgdGhpcy5faW5zdGFsbGVkID0gdHJ1ZTtcbiAgICAgICAgICAgIGNhbGxiYWNrKCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignTW9kZWwgXCInICsgdGhpcy5uYW1lICsgJ1wiIGhhcyBhbHJlYWR5IGJlZW4gaW5zdGFsbGVkJyk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBNYXAgZGF0YSBpbnRvIFNpZXN0YS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSBkYXRhIFJhdyBkYXRhIHJlY2VpdmVkIHJlbW90ZWx5IG9yIG90aGVyd2lzZVxuICAgICAqIEBwYXJhbSB7ZnVuY3Rpb258b2JqZWN0fSBbb3B0c11cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IG9wdHMub3ZlcnJpZGVcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IG9wdHMuX2lnbm9yZUluc3RhbGxlZCAtIEFuIGVzY2FwZSBjbGF1c2UgdGhhdCBhbGxvd3MgbWFwcGluZyBvbnRvIE1vZGVscyBldmVuIGlmIGluc3RhbGwgcHJvY2VzcyBoYXMgbm90IGZpbmlzaGVkLlxuICAgICAqIEBwYXJhbSB7ZnVuY3Rpb259IFtjYWxsYmFja10gQ2FsbGVkIG9uY2UgcG91Y2ggcGVyc2lzdGVuY2UgcmV0dXJucy5cbiAgICAgKi9cbiAgICBtYXA6IGZ1bmN0aW9uIChkYXRhLCBvcHRzLCBjYWxsYmFjaykge1xuICAgICAgICBpZiAodHlwZW9mIG9wdHMgPT0gJ2Z1bmN0aW9uJykgY2FsbGJhY2sgPSBvcHRzO1xuICAgICAgICBvcHRzID0gb3B0cyB8fCB7fTtcbiAgICAgICAgdmFyIGRlZmVycmVkID0gdXRpbC5kZWZlcihjYWxsYmFjayk7XG4gICAgICAgIHZhciBfbWFwID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdmFyIG92ZXJyaWRlcyA9IG9wdHMub3ZlcnJpZGU7XG4gICAgICAgICAgICBpZiAob3ZlcnJpZGVzKSB7XG4gICAgICAgICAgICAgICAgaWYgKHV0aWwuaXNBcnJheShvdmVycmlkZXMpKSBvcHRzLm9iamVjdHMgPSBvdmVycmlkZXM7XG4gICAgICAgICAgICAgICAgZWxzZSBvcHRzLm9iamVjdHMgPSBbb3ZlcnJpZGVzXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGRlbGV0ZSBvcHRzLm92ZXJyaWRlO1xuICAgICAgICAgICAgaWYgKHV0aWwuaXNBcnJheShkYXRhKSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX21hcEJ1bGsoZGF0YSwgb3B0cywgZGVmZXJyZWQuZmluaXNoLmJpbmQoZGVmZXJyZWQpKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fbWFwQnVsayhbZGF0YV0sIG9wdHMsIGZ1bmN0aW9uIChlcnIsIG9iamVjdHMpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIG9iajtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG9iamVjdHMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChvYmplY3RzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9iaiA9IG9iamVjdHNbMF07XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZGVmZXJyZWQuZmluaXNoKGVyciA/IGVyclswXSA6IG51bGwsIG9iaik7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0uYmluZCh0aGlzKTtcbiAgICAgICAgaWYgKG9wdHMuX2lnbm9yZUluc3RhbGxlZCkge1xuICAgICAgICAgICAgX21hcCgpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Ugc2llc3RhLl9hZnRlckluc3RhbGwoX21hcCk7XG4gICAgICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xuICAgIH0sXG4gICAgX21hcEJ1bGs6IGZ1bmN0aW9uIChkYXRhLCBvcHRzLCBjYWxsYmFjaykge1xuICAgICAgICBfLmV4dGVuZChvcHRzLCB7bW9kZWw6IHRoaXMsIGRhdGE6IGRhdGF9KTtcbiAgICAgICAgdmFyIG9wID0gbmV3IE1hcHBpbmdPcGVyYXRpb24ob3B0cyk7XG4gICAgICAgIG9wLnN0YXJ0KGZ1bmN0aW9uIChlcnIsIG9iamVjdHMpIHtcbiAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIG9iamVjdHMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9LFxuICAgIF9jb3VudENhY2hlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBjb2xsQ2FjaGUgPSBjYWNoZS5fbG9jYWxDYWNoZUJ5VHlwZVt0aGlzLmNvbGxlY3Rpb25OYW1lXSB8fCB7fTtcbiAgICAgICAgdmFyIG1vZGVsQ2FjaGUgPSBjb2xsQ2FjaGVbdGhpcy5uYW1lXSB8fCB7fTtcbiAgICAgICAgcmV0dXJuIF8ucmVkdWNlKE9iamVjdC5rZXlzKG1vZGVsQ2FjaGUpLCBmdW5jdGlvbiAobSwgX2lkKSB7XG4gICAgICAgICAgICBtW19pZF0gPSB7fTtcbiAgICAgICAgICAgIHJldHVybiBtO1xuICAgICAgICB9LCB7fSk7XG4gICAgfSxcbiAgICBjb3VudDogZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgICAgIHZhciBkZWZlcnJlZCA9IHV0aWwuZGVmZXIoY2FsbGJhY2spO1xuICAgICAgICBjYWxsYmFjayA9IGRlZmVycmVkLmZpbmlzaC5iaW5kKGRlZmVycmVkKTtcbiAgICAgICAgdmFyIGhhc2ggPSB0aGlzLl9jb3VudENhY2hlKCk7XG4gICAgICAgIGNhbGxiYWNrKG51bGwsIE9iamVjdC5rZXlzKGhhc2gpLmxlbmd0aClcbiAgICAgICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBDb252ZXJ0IHJhdyBkYXRhIGludG8gYSBNb2RlbEluc3RhbmNlXG4gICAgICogQHJldHVybnMge01vZGVsSW5zdGFuY2V9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfbmV3OiBmdW5jdGlvbiAoZGF0YSwgc2hvdWxkUmVnaXN0ZXJDaGFuZ2UpIHtcbiAgICAgICAgc2hvdWxkUmVnaXN0ZXJDaGFuZ2UgPSBzaG91bGRSZWdpc3RlckNoYW5nZSA9PT0gdW5kZWZpbmVkID8gdHJ1ZSA6IHNob3VsZFJlZ2lzdGVyQ2hhbmdlO1xuICAgICAgICBpZiAodGhpcy5pbnN0YWxsZWQpIHtcbiAgICAgICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgICAgIHZhciBfaWQ7XG4gICAgICAgICAgICBpZiAoZGF0YSkge1xuICAgICAgICAgICAgICAgIF9pZCA9IGRhdGEuX2lkID8gZGF0YS5faWQgOiBndWlkKCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIF9pZCA9IGd1aWQoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHZhciBuZXdNb2RlbCA9IG5ldyBNb2RlbEluc3RhbmNlKHRoaXMpO1xuICAgICAgICAgICAgaWYgKExvZ2dlci5pbmZvLmlzRW5hYmxlZClcbiAgICAgICAgICAgICAgICBMb2dnZXIuaW5mbygnTmV3IG9iamVjdCBjcmVhdGVkIF9pZD1cIicgKyBfaWQudG9TdHJpbmcoKSArICdcIiwgdHlwZT0nICsgdGhpcy5uYW1lLCBkYXRhKTtcbiAgICAgICAgICAgIG5ld01vZGVsLl9pZCA9IF9pZDtcbiAgICAgICAgICAgIC8vIFBsYWNlIGF0dHJpYnV0ZXMgb24gdGhlIG9iamVjdC5cbiAgICAgICAgICAgIHZhciB2YWx1ZXMgPSB7fTtcbiAgICAgICAgICAgIG5ld01vZGVsLl9fdmFsdWVzID0gdmFsdWVzO1xuICAgICAgICAgICAgdmFyIGRlZmF1bHRzID0gXy5yZWR1Y2UodGhpcy5hdHRyaWJ1dGVzLCBmdW5jdGlvbiAobSwgYSkge1xuICAgICAgICAgICAgICAgIGlmIChhLmRlZmF1bHQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICBtW2EubmFtZV0gPSBhLmRlZmF1bHQ7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiBtO1xuICAgICAgICAgICAgfSwge30pO1xuICAgICAgICAgICAgXy5leHRlbmQodmFsdWVzLCBkZWZhdWx0cyk7XG4gICAgICAgICAgICBpZiAoZGF0YSkgXy5leHRlbmQodmFsdWVzLCBkYXRhKTtcbiAgICAgICAgICAgIHZhciBmaWVsZHMgPSB0aGlzLl9hdHRyaWJ1dGVOYW1lcztcbiAgICAgICAgICAgIHZhciBpZHggPSBmaWVsZHMuaW5kZXhPZih0aGlzLmlkKTtcbiAgICAgICAgICAgIGlmIChpZHggPiAtMSkge1xuICAgICAgICAgICAgICAgIGZpZWxkcy5zcGxpY2UoaWR4LCAxKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIF8uZWFjaChmaWVsZHMsIGZ1bmN0aW9uIChmaWVsZCkge1xuICAgICAgICAgICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShuZXdNb2RlbCwgZmllbGQsIHtcbiAgICAgICAgICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgdmFsdWUgPSBuZXdNb2RlbC5fX3ZhbHVlc1tmaWVsZF07XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdmFsdWUgPT09IHVuZGVmaW5lZCA/IG51bGwgOiB2YWx1ZTtcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgc2V0OiBmdW5jdGlvbiAodikge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG9sZCA9IG5ld01vZGVsLl9fdmFsdWVzW2ZpZWxkXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIG5ld01vZGVsLl9fdmFsdWVzW2ZpZWxkXSA9IHY7XG4gICAgICAgICAgICAgICAgICAgICAgICBtb2RlbEV2ZW50cy5lbWl0KHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb2xsZWN0aW9uOiBzZWxmLmNvbGxlY3Rpb25OYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1vZGVsOiBzZWxmLm5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgX2lkOiBuZXdNb2RlbC5faWQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV3OiB2LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9sZDogb2xkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6IE1vZGVsRXZlbnRUeXBlLlNldCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmaWVsZDogZmllbGQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb2JqOiBuZXdNb2RlbFxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodXRpbC5pc0FycmF5KHYpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgd3JhcEFycmF5KHYsIGZpZWxkLCBuZXdNb2RlbCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIF8uZWFjaChPYmplY3Qua2V5cyh0aGlzLm1ldGhvZHMpLCBmdW5jdGlvbiAobWV0aG9kTmFtZSkge1xuICAgICAgICAgICAgICAgIGlmIChuZXdNb2RlbFttZXRob2ROYW1lXSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgIG5ld01vZGVsW21ldGhvZE5hbWVdID0gdGhpcy5tZXRob2RzW21ldGhvZE5hbWVdLmJpbmQobmV3TW9kZWwpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgTG9nZ2VyLmVycm9yKCdBIG1ldGhvZCB3aXRoIG5hbWUgXCInICsgbWV0aG9kTmFtZSArICdcIiBhbHJlYWR5IGV4aXN0cy4gSWdub3JpbmcgaXQuJyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfS5iaW5kKHRoaXMpKTtcblxuICAgICAgICAgICAgXy5lYWNoKE9iamVjdC5rZXlzKHRoaXMucHJvcGVydGllcyksIGZ1bmN0aW9uIChwcm9wTmFtZSkge1xuICAgICAgICAgICAgICAgIGlmIChuZXdNb2RlbFtwcm9wTmFtZV0gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkobmV3TW9kZWwsIHByb3BOYW1lLCB0aGlzLnByb3BlcnRpZXNbcHJvcE5hbWVdKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIExvZ2dlci5lcnJvcignQSBwcm9wZXJ0eS9tZXRob2Qgd2l0aCBuYW1lIFwiJyArIHByb3BOYW1lICsgJ1wiIGFscmVhZHkgZXhpc3RzLiBJZ25vcmluZyBpdC4nKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LmJpbmQodGhpcykpO1xuXG4gICAgICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkobmV3TW9kZWwsIHRoaXMuaWQsIHtcbiAgICAgICAgICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG5ld01vZGVsLl9fdmFsdWVzW3NlbGYuaWRdIHx8IG51bGw7XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBzZXQ6IGZ1bmN0aW9uICh2KSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBvbGQgPSBuZXdNb2RlbFtzZWxmLmlkXTtcbiAgICAgICAgICAgICAgICAgICAgbmV3TW9kZWwuX192YWx1ZXNbc2VsZi5pZF0gPSB2O1xuICAgICAgICAgICAgICAgICAgICBtb2RlbEV2ZW50cy5lbWl0KHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbGxlY3Rpb246IHNlbGYuY29sbGVjdGlvbk5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBtb2RlbDogc2VsZi5uYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgX2lkOiBuZXdNb2RlbC5faWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBuZXc6IHYsXG4gICAgICAgICAgICAgICAgICAgICAgICBvbGQ6IG9sZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6IE1vZGVsRXZlbnRUeXBlLlNldCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGZpZWxkOiBzZWxmLmlkLFxuICAgICAgICAgICAgICAgICAgICAgICAgb2JqOiBuZXdNb2RlbFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgY2FjaGUucmVtb3RlSW5zZXJ0KG5ld01vZGVsLCB2LCBvbGQpO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgZm9yICh2YXIgbmFtZSBpbiB0aGlzLnJlbGF0aW9uc2hpcHMpIHtcbiAgICAgICAgICAgICAgICB2YXIgcHJveHk7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMucmVsYXRpb25zaGlwcy5oYXNPd25Qcm9wZXJ0eShuYW1lKSkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgcmVsYXRpb25zaGlwT3B0cyA9IF8uZXh0ZW5kKHt9LCB0aGlzLnJlbGF0aW9uc2hpcHNbbmFtZV0pLFxuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZSA9IHJlbGF0aW9uc2hpcE9wdHMudHlwZTtcbiAgICAgICAgICAgICAgICAgICAgZGVsZXRlIHJlbGF0aW9uc2hpcE9wdHMudHlwZTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGUgPT0gUmVsYXRpb25zaGlwVHlwZS5PbmVUb01hbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHByb3h5ID0gbmV3IE9uZVRvTWFueVByb3h5KHJlbGF0aW9uc2hpcE9wdHMpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHR5cGUgPT0gUmVsYXRpb25zaGlwVHlwZS5PbmVUb09uZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcHJveHkgPSBuZXcgT25lVG9PbmVQcm94eShyZWxhdGlvbnNoaXBPcHRzKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmICh0eXBlID09IFJlbGF0aW9uc2hpcFR5cGUuTWFueVRvTWFueSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcHJveHkgPSBuZXcgTWFueVRvTWFueVByb3h5KHJlbGF0aW9uc2hpcE9wdHMpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ05vIHN1Y2ggcmVsYXRpb25zaGlwIHR5cGU6ICcgKyB0eXBlKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBwcm94eS5pbnN0YWxsKG5ld01vZGVsKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhY2hlLmluc2VydChuZXdNb2RlbCk7XG4gICAgICAgICAgICBpZiAoc2hvdWxkUmVnaXN0ZXJDaGFuZ2UpIHtcbiAgICAgICAgICAgICAgICBtb2RlbEV2ZW50cy5lbWl0KHtcbiAgICAgICAgICAgICAgICAgICAgY29sbGVjdGlvbjogdGhpcy5jb2xsZWN0aW9uTmFtZSxcbiAgICAgICAgICAgICAgICAgICAgbW9kZWw6IHRoaXMubmFtZSxcbiAgICAgICAgICAgICAgICAgICAgX2lkOiBuZXdNb2RlbC5faWQsXG4gICAgICAgICAgICAgICAgICAgIG5ldzogbmV3TW9kZWwsXG4gICAgICAgICAgICAgICAgICAgIHR5cGU6IE1vZGVsRXZlbnRUeXBlLk5ldyxcbiAgICAgICAgICAgICAgICAgICAgb2JqOiBuZXdNb2RlbFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIG5ld01vZGVsO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ01vZGVsIG11c3QgYmUgZnVsbHkgaW5zdGFsbGVkIGJlZm9yZSBjcmVhdGluZyBhbnkgbW9kZWxzJyk7XG4gICAgICAgIH1cblxuICAgIH0sXG4gICAgX2R1bXA6IGZ1bmN0aW9uIChhc0pTT04pIHtcbiAgICAgICAgdmFyIGR1bXBlZCA9IHt9O1xuICAgICAgICBkdW1wZWQubmFtZSA9IHRoaXMubmFtZTtcbiAgICAgICAgZHVtcGVkLmF0dHJpYnV0ZXMgPSB0aGlzLmF0dHJpYnV0ZXM7XG4gICAgICAgIGR1bXBlZC5pZCA9IHRoaXMuaWQ7XG4gICAgICAgIGR1bXBlZC5jb2xsZWN0aW9uID0gdGhpcy5jb2xsZWN0aW9uTmFtZTtcbiAgICAgICAgZHVtcGVkLnJlbGF0aW9uc2hpcHMgPSBfLm1hcCh0aGlzLnJlbGF0aW9uc2hpcHMsIGZ1bmN0aW9uIChyKSB7XG4gICAgICAgICAgICByZXR1cm4gci5pc0ZvcndhcmQgPyByLmZvcndhcmROYW1lIDogci5yZXZlcnNlTmFtZTtcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBhc0pTT04gPyB1dGlsLnByZXR0eVByaW50KGR1bXBlZCkgOiBkdW1wZWQ7XG4gICAgfSxcbiAgICB0b1N0cmluZzogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gJ01vZGVsWycgKyB0aGlzLm5hbWUgKyAnXSc7XG4gICAgfVxuXG59KTtcblxuXy5leHRlbmQoTW9kZWwucHJvdG90eXBlLCB7XG4gICAgbGlzdGVuOiBmdW5jdGlvbiAoZm4pIHtcbiAgICAgICAgZXZlbnRzLm9uKHRoaXMuY29sbGVjdGlvbk5hbWUgKyAnOicgKyB0aGlzLm5hbWUsIGZuKTtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIoZm4pO1xuICAgICAgICB9LmJpbmQodGhpcyk7XG4gICAgfSxcbiAgICBsaXN0ZW5PbmNlOiBmdW5jdGlvbiAoZm4pIHtcbiAgICAgICAgcmV0dXJuIGV2ZW50cy5vbmNlKHRoaXMuY29sbGVjdGlvbk5hbWUgKyAnOicgKyB0aGlzLm5hbWUsIGZuKTtcbiAgICB9LFxuICAgIHJlbW92ZUxpc3RlbmVyOiBmdW5jdGlvbiAoZm4pIHtcbiAgICAgICAgcmV0dXJuIGV2ZW50cy5yZW1vdmVMaXN0ZW5lcih0aGlzLmNvbGxlY3Rpb25OYW1lICsgJzonICsgdGhpcy5uYW1lLCBmbik7XG4gICAgfVxufSk7XG5cbi8vIFN1YmNsYXNzaW5nXG5fLmV4dGVuZChNb2RlbC5wcm90b3R5cGUsIHtcbiAgICBjaGlsZDogZnVuY3Rpb24gKG5hbWVPck9wdHMsIG9wdHMpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBuYW1lT3JPcHRzID09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICBvcHRzLm5hbWUgPSBuYW1lT3JPcHRzO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgb3B0cyA9IG5hbWU7XG4gICAgICAgIH1cbiAgICAgICAgXy5leHRlbmQob3B0cywge1xuICAgICAgICAgICAgYXR0cmlidXRlczogQXJyYXkucHJvdG90eXBlLmNvbmNhdC5jYWxsKG9wdHMuYXR0cmlidXRlcyB8fCBbXSwgdGhpcy5fb3B0cy5hdHRyaWJ1dGVzKSxcbiAgICAgICAgICAgIHJlbGF0aW9uc2hpcHM6IF8uZXh0ZW5kKG9wdHMucmVsYXRpb25zaGlwcyB8fCB7fSwgdGhpcy5fb3B0cy5yZWxhdGlvbnNoaXBzKSxcbiAgICAgICAgICAgIG1ldGhvZHM6IF8uZXh0ZW5kKF8uZXh0ZW5kKHt9LCB0aGlzLl9vcHRzLm1ldGhvZHMpIHx8IHt9LCBvcHRzLm1ldGhvZHMpLFxuICAgICAgICAgICAgc3RhdGljczogXy5leHRlbmQoXy5leHRlbmQoe30sIHRoaXMuX29wdHMuc3RhdGljcykgfHwge30sIG9wdHMuc3RhdGljcyksXG4gICAgICAgICAgICBwcm9wZXJ0aWVzOiBfLmV4dGVuZChfLmV4dGVuZCh7fSwgdGhpcy5fb3B0cy5wcm9wZXJ0aWVzKSB8fCB7fSwgb3B0cy5wcm9wZXJ0aWVzKSxcbiAgICAgICAgICAgIGlkOiBvcHRzLmlkIHx8IHRoaXMuX29wdHMuaWQsXG4gICAgICAgICAgICBpbml0OiBvcHRzLmluaXQgfHwgdGhpcy5fb3B0cy5pbml0LFxuICAgICAgICAgICAgcmVtb3ZlOiBvcHRzLnJlbW92ZSB8fCB0aGlzLl9vcHRzLnJlbW92ZVxuICAgICAgICB9KTtcbiAgICAgICAgdmFyIG1vZGVsID0gdGhpcy5jb2xsZWN0aW9uLm1vZGVsKG9wdHMubmFtZSwgb3B0cyk7XG4gICAgICAgIG1vZGVsLnBhcmVudCA9IHRoaXM7XG4gICAgICAgIHRoaXMuY2hpbGRyZW4ucHVzaChtb2RlbCk7XG4gICAgICAgIHJldHVybiBtb2RlbDtcbiAgICB9LFxuICAgIGlzQ2hpbGRPZjogZnVuY3Rpb24gKHBhcmVudCkge1xuICAgICAgICByZXR1cm4gdGhpcy5wYXJlbnQgPT0gcGFyZW50O1xuICAgIH0sXG4gICAgaXNQYXJlbnRPZjogZnVuY3Rpb24gKGNoaWxkKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmNoaWxkcmVuLmluZGV4T2YoY2hpbGQpID4gLTE7XG4gICAgfSxcbiAgICBpc0Rlc2NlbmRhbnRPZjogZnVuY3Rpb24gKGFuY2VzdG9yKSB7XG4gICAgICAgIHZhciBwYXJlbnQgPSB0aGlzLnBhcmVudDtcbiAgICAgICAgd2hpbGUgKHBhcmVudCkge1xuICAgICAgICAgICAgaWYgKHBhcmVudCA9PSBhbmNlc3RvcikgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICBwYXJlbnQgPSBwYXJlbnQucGFyZW50O1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9LFxuICAgIGlzQW5jZXN0b3JPZjogZnVuY3Rpb24gKGRlc2NlbmRhbnQpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZGVzY2VuZGFudHMuaW5kZXhPZihkZXNjZW5kYW50KSA+IC0xO1xuICAgIH0sXG4gICAgaGFzQXR0cmlidXRlTmFtZWQ6IGZ1bmN0aW9uIChhdHRyaWJ1dGVOYW1lKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hdHRyaWJ1dGVOYW1lcy5pbmRleE9mKGF0dHJpYnV0ZU5hbWUpID4gLTE7XG4gICAgfVxufSk7XG5cbl8uZXh0ZW5kKE1vZGVsLnByb3RvdHlwZSwge1xuICAgIHBhZ2luYXRvcjogZnVuY3Rpb24gKG9wdHMpIHtcbiAgICAgICAgaWYgKHNpZXN0YS5leHQuaHR0cEVuYWJsZWQpIHtcbiAgICAgICAgICAgIHZhciBQYWdpbmF0b3IgPSBzaWVzdGEuZXh0Lmh0dHAuUGFnaW5hdG9yO1xuICAgICAgICAgICAgb3B0cyA9IG9wdHMgfHwge307XG4gICAgICAgICAgICBvcHRzLm1vZGVsID0gdGhpcztcbiAgICAgICAgICAgIHJldHVybiBuZXcgUGFnaW5hdG9yKG9wdHMpO1xuICAgICAgICB9XG4gICAgfVxufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gTW9kZWw7XG4iLCJ2YXIgZXZlbnRzID0gcmVxdWlyZSgnLi9ldmVudHMnKSxcbiAgICBJbnRlcm5hbFNpZXN0YUVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpLkludGVybmFsU2llc3RhRXJyb3IsXG4gICAgbG9nID0gcmVxdWlyZSgnLi9sb2cnKSxcbiAgICBleHRlbmQgPSByZXF1aXJlKCcuL3V0aWwnKS5fLmV4dGVuZCxcbiAgICBjb2xsZWN0aW9uUmVnaXN0cnkgPSByZXF1aXJlKCcuL2NvbGxlY3Rpb25SZWdpc3RyeScpLkNvbGxlY3Rpb25SZWdpc3RyeTtcblxudmFyIExvZ2dlciA9IGxvZy5sb2dnZXJXaXRoTmFtZSgnTW9kZWxFdmVudHMnKTtcblxuLyoqXG4gKiBDb25zdGFudHMgdGhhdCBkZXNjcmliZSBjaGFuZ2UgZXZlbnRzLlxuICogU2V0ID0+IEEgbmV3IHZhbHVlIGlzIGFzc2lnbmVkIHRvIGFuIGF0dHJpYnV0ZS9yZWxhdGlvbnNoaXBcbiAqIFNwbGljZSA9PiBBbGwgamF2YXNjcmlwdCBhcnJheSBvcGVyYXRpb25zIGFyZSBkZXNjcmliZWQgYXMgc3BsaWNlcy5cbiAqIERlbGV0ZSA9PiBVc2VkIGluIHRoZSBjYXNlIHdoZXJlIG9iamVjdHMgYXJlIHJlbW92ZWQgZnJvbSBhbiBhcnJheSwgYnV0IGFycmF5IG9yZGVyIGlzIG5vdCBrbm93biBpbiBhZHZhbmNlLlxuICogUmVtb3ZlID0+IE9iamVjdCBkZWxldGlvbiBldmVudHNcbiAqIE5ldyA9PiBPYmplY3QgY3JlYXRpb24gZXZlbnRzXG4gKiBAdHlwZSB7T2JqZWN0fVxuICovXG52YXIgTW9kZWxFdmVudFR5cGUgPSB7XG4gICAgICAgIFNldDogJ1NldCcsXG4gICAgICAgIFNwbGljZTogJ1NwbGljZScsXG4gICAgICAgIE5ldzogJ05ldycsXG4gICAgICAgIFJlbW92ZTogJ1JlbW92ZSdcbiAgICB9LFxuICAgIE1vZGVsRXZlbnRGaWVsZHMgPSBbJ2NvbGxlY3Rpb24nLCAnbW9kZWwnLCAnX2lkJywgJ2ZpZWxkJywgJ3R5cGUnLCAnaW5kZXgnLCAnYWRkZWQnLCAncmVtb3ZlZCcsICduZXcnLCAnb2xkJywgJ29iaiddO1xuXG4vKipcbiAqIFJlcHJlc2VudHMgYW4gaW5kaXZpZHVhbCBjaGFuZ2UuXG4gKiBAcGFyYW0gb3B0c1xuICogQGNvbnN0cnVjdG9yXG4gKi9cbmZ1bmN0aW9uIE1vZGVsRXZlbnQob3B0cykge1xuICAgIHRoaXMuX29wdHMgPSBvcHRzIHx8IHt9O1xuICAgIE1vZGVsRXZlbnRGaWVsZHMuZm9yRWFjaChmdW5jdGlvbiAoZikge1xuICAgICAgICBpZiAodGhpcy5fb3B0c1tmXSAhPT0gdW5kZWZpbmVkKSB0aGlzW2ZdID0gdGhpcy5fb3B0c1tmXTtcbiAgICB9LmJpbmQodGhpcykpO1xufVxuXG5Nb2RlbEV2ZW50LnByb3RvdHlwZS5fZHVtcCA9IGZ1bmN0aW9uIChwcmV0dHkpIHtcbiAgICB2YXIgZHVtcGVkID0ge307XG4gICAgZHVtcGVkLmNvbGxlY3Rpb24gPSAodHlwZW9mIHRoaXMuY29sbGVjdGlvbikgPT0gJ3N0cmluZycgPyB0aGlzLmNvbGxlY3Rpb24gOiB0aGlzLmNvbGxlY3Rpb24uX2R1bXAoKTtcbiAgICBkdW1wZWQubW9kZWwgPSAodHlwZW9mIHRoaXMubW9kZWwpID09ICdzdHJpbmcnID8gdGhpcy5tb2RlbCA6IHRoaXMubW9kZWwubmFtZTtcbiAgICBkdW1wZWQuX2lkID0gdGhpcy5faWQ7XG4gICAgZHVtcGVkLmZpZWxkID0gdGhpcy5maWVsZDtcbiAgICBkdW1wZWQudHlwZSA9IHRoaXMudHlwZTtcbiAgICBpZiAodGhpcy5pbmRleCkgZHVtcGVkLmluZGV4ID0gdGhpcy5pbmRleDtcbiAgICBpZiAodGhpcy5hZGRlZCkgZHVtcGVkLmFkZGVkID0gXy5tYXAodGhpcy5hZGRlZCwgZnVuY3Rpb24gKHgpIHtyZXR1cm4geC5fZHVtcCgpfSk7XG4gICAgaWYgKHRoaXMucmVtb3ZlZCkgZHVtcGVkLnJlbW92ZWQgPSBfLm1hcCh0aGlzLnJlbW92ZWQsIGZ1bmN0aW9uICh4KSB7cmV0dXJuIHguX2R1bXAoKX0pO1xuICAgIGlmICh0aGlzLm9sZCkgZHVtcGVkLm9sZCA9IHRoaXMub2xkO1xuICAgIGlmICh0aGlzLm5ldykgZHVtcGVkLm5ldyA9IHRoaXMubmV3O1xuICAgIHJldHVybiBwcmV0dHkgPyB1dGlsLnByZXR0eVByaW50KGR1bXBlZCkgOiBkdW1wZWQ7XG59O1xuXG4vKipcbiAqIEJyb2FkY2FzXG4gKiBAcGFyYW0gIHtTdHJpbmd9IGNvbGxlY3Rpb25OYW1lXG4gKiBAcGFyYW0gIHtTdHJpbmd9IG1vZGVsTmFtZVxuICogQHBhcmFtICB7T2JqZWN0fSBjIGFuIG9wdGlvbnMgZGljdGlvbmFyeSByZXByZXNlbnRpbmcgdGhlIGNoYW5nZVxuICogQHJldHVybiB7W3R5cGVdfVxuICovXG5mdW5jdGlvbiBicm9hZGNhc3RFdmVudChjb2xsZWN0aW9uTmFtZSwgbW9kZWxOYW1lLCBjKSB7XG4gICAgaWYgKExvZ2dlci50cmFjZS5pc0VuYWJsZWQpIExvZ2dlci50cmFjZSgnU2VuZGluZyBub3RpZmljYXRpb24gXCInICsgY29sbGVjdGlvbk5hbWUgKyAnXCIgb2YgdHlwZSAnICsgYy50eXBlKTtcbiAgICBldmVudHMuZW1pdChjb2xsZWN0aW9uTmFtZSwgYyk7XG4gICAgdmFyIG1vZGVsTm90aWYgPSBjb2xsZWN0aW9uTmFtZSArICc6JyArIG1vZGVsTmFtZTtcbiAgICBpZiAoTG9nZ2VyLnRyYWNlLmlzRW5hYmxlZCkgTG9nZ2VyLnRyYWNlKCdTZW5kaW5nIG5vdGlmaWNhdGlvbiBcIicgKyBtb2RlbE5vdGlmICsgJ1wiIG9mIHR5cGUgJyArIGMudHlwZSk7XG4gICAgZXZlbnRzLmVtaXQobW9kZWxOb3RpZiwgYyk7XG4gICAgdmFyIGdlbmVyaWNOb3RpZiA9ICdTaWVzdGEnO1xuICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKSBMb2dnZXIudHJhY2UoJ1NlbmRpbmcgbm90aWZpY2F0aW9uIFwiJyArIGdlbmVyaWNOb3RpZiArICdcIiBvZiB0eXBlICcgKyBjLnR5cGUpO1xuICAgIGV2ZW50cy5lbWl0KGdlbmVyaWNOb3RpZiwgYyk7XG4gICAgdmFyIGxvY2FsSWROb3RpZiA9IGMuX2lkO1xuICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKSBMb2dnZXIudHJhY2UoJ1NlbmRpbmcgbm90aWZpY2F0aW9uIFwiJyArIGxvY2FsSWROb3RpZiArICdcIiBvZiB0eXBlICcgKyBjLnR5cGUpO1xuICAgIGV2ZW50cy5lbWl0KGxvY2FsSWROb3RpZiwgYyk7XG4gICAgdmFyIGNvbGxlY3Rpb24gPSBjb2xsZWN0aW9uUmVnaXN0cnlbY29sbGVjdGlvbk5hbWVdO1xuICAgIHZhciBlcnI7XG4gICAgaWYgKCFjb2xsZWN0aW9uKSB7XG4gICAgICAgIGVyciA9ICdObyBzdWNoIGNvbGxlY3Rpb24gXCInICsgY29sbGVjdGlvbk5hbWUgKyAnXCInO1xuICAgICAgICBMb2dnZXIuZXJyb3IoZXJyLCBjb2xsZWN0aW9uUmVnaXN0cnkpO1xuICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcihlcnIpO1xuICAgIH1cbiAgICB2YXIgbW9kZWwgPSBjb2xsZWN0aW9uW21vZGVsTmFtZV07XG4gICAgaWYgKCFtb2RlbCkge1xuICAgICAgICBlcnIgPSAnTm8gc3VjaCBtb2RlbCBcIicgKyBtb2RlbE5hbWUgKyAnXCInO1xuICAgICAgICBMb2dnZXIuZXJyb3IoZXJyLCBjb2xsZWN0aW9uUmVnaXN0cnkpO1xuICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcihlcnIpO1xuICAgIH1cbiAgICBpZiAobW9kZWwuaWQgJiYgYy5vYmpbbW9kZWwuaWRdKSB7XG4gICAgICAgIHZhciByZW1vdGVJZE5vdGlmID0gY29sbGVjdGlvbk5hbWUgKyAnOicgKyBtb2RlbE5hbWUgKyAnOicgKyBjLm9ialttb2RlbC5pZF07XG4gICAgICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKSBMb2dnZXIudHJhY2UoJ1NlbmRpbmcgbm90aWZpY2F0aW9uIFwiJyArIHJlbW90ZUlkTm90aWYgKyAnXCIgb2YgdHlwZSAnICsgYy50eXBlKTtcbiAgICAgICAgZXZlbnRzLmVtaXQocmVtb3RlSWROb3RpZiwgYyk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiB2YWxpZGF0ZUV2ZW50T3B0cyhvcHRzKSB7XG4gICAgaWYgKCFvcHRzLm1vZGVsKSB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignTXVzdCBwYXNzIGEgbW9kZWwnKTtcbiAgICBpZiAoIW9wdHMuY29sbGVjdGlvbikgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ011c3QgcGFzcyBhIGNvbGxlY3Rpb24nKTtcbiAgICBpZiAoIW9wdHMuX2lkKSB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignTXVzdCBwYXNzIGEgbG9jYWwgaWRlbnRpZmllcicpO1xuICAgIGlmICghb3B0cy5vYmopIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdNdXN0IHBhc3MgdGhlIG9iamVjdCcpO1xufVxuXG5mdW5jdGlvbiBlbWl0KG9wdHMpIHtcbiAgICB2YWxpZGF0ZUV2ZW50T3B0cyhvcHRzKTtcbiAgICB2YXIgY29sbGVjdGlvbiA9IG9wdHMuY29sbGVjdGlvbjtcbiAgICB2YXIgbW9kZWwgPSBvcHRzLm1vZGVsO1xuICAgIHZhciBjID0gbmV3IE1vZGVsRXZlbnQob3B0cyk7XG4gICAgYnJvYWRjYXN0RXZlbnQoY29sbGVjdGlvbiwgbW9kZWwsIGMpO1xuICAgIHJldHVybiBjO1xufVxuXG5leHRlbmQoZXhwb3J0cywge1xuICAgIE1vZGVsRXZlbnQ6IE1vZGVsRXZlbnQsXG4gICAgZW1pdDogZW1pdCxcbiAgICB2YWxpZGF0ZUV2ZW50T3B0czogdmFsaWRhdGVFdmVudE9wdHMsXG4gICAgTW9kZWxFdmVudFR5cGU6IE1vZGVsRXZlbnRUeXBlXG59KTsiLCJ2YXIgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpLFxuICAgIFNpZXN0YVVzZXJFcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKS5TaWVzdGFVc2VyRXJyb3IsXG4gICAgTW9kZWxJbnN0YW5jZSA9IHJlcXVpcmUoJy4vTW9kZWxJbnN0YW5jZScpLFxuICAgIF8gPSByZXF1aXJlKCcuL3V0aWwnKS5fO1xuXG4vKlxuIFRPRE86IFVzZSBFUzYgUHJveHkgaW5zdGVhZC5cbiBFdmVudHVhbGx5IHF1ZXJ5IHNldHMgc2hvdWxkIHVzZSBFUzYgUHJveGllcyB3aGljaCB3aWxsIGJlIG11Y2ggbW9yZSBuYXR1cmFsIGFuZCByb2J1c3QuIEUuZy4gbm8gbmVlZCBmb3IgdGhlIGJlbG93XG4gKi9cbnZhciBBUlJBWV9NRVRIT0RTID0gWydwdXNoJywgJ3NvcnQnLCAncmV2ZXJzZScsICdzcGxpY2UnLCAnc2hpZnQnLCAndW5zaGlmdCddLFxuICAgIE5VTUJFUl9NRVRIT0RTID0gWyd0b1N0cmluZycsICd0b0V4cG9uZW50aWFsJywgJ3RvRml4ZWQnLCAndG9QcmVjaXNpb24nLCAndmFsdWVPZiddLFxuICAgIE5VTUJFUl9QUk9QRVJUSUVTID0gWydNQVhfVkFMVUUnLCAnTUlOX1ZBTFVFJywgJ05FR0FUSVZFX0lORklOSVRZJywgJ05hTicsICdQT1NJVElWRV9JTkZJTklUWSddLFxuICAgIFNUUklOR19NRVRIT0RTID0gWydjaGFyQXQnLCAnY2hhckNvZGVBdCcsICdjb25jYXQnLCAnZnJvbUNoYXJDb2RlJywgJ2luZGV4T2YnLCAnbGFzdEluZGV4T2YnLCAnbG9jYWxlQ29tcGFyZScsXG4gICAgICAgICdtYXRjaCcsICdyZXBsYWNlJywgJ3NlYXJjaCcsICdzbGljZScsICdzcGxpdCcsICdzdWJzdHInLCAnc3Vic3RyaW5nJywgJ3RvTG9jYWxlTG93ZXJDYXNlJywgJ3RvTG9jYWxlVXBwZXJDYXNlJyxcbiAgICAgICAgJ3RvTG93ZXJDYXNlJywgJ3RvU3RyaW5nJywgJ3RvVXBwZXJDYXNlJywgJ3RyaW0nLCAndmFsdWVPZiddLFxuICAgIFNUUklOR19QUk9QRVJUSUVTID0gWydsZW5ndGgnXTtcblxuLyoqXG4gKiBSZXR1cm4gdGhlIHByb3BlcnR5IG5hbWVzIGZvciBhIGdpdmVuIG9iamVjdC4gSGFuZGxlcyBzcGVjaWFsIGNhc2VzIHN1Y2ggYXMgc3RyaW5ncyBhbmQgbnVtYmVycyB0aGF0IGRvIG5vdCBoYXZlXG4gKiB0aGUgZ2V0T3duUHJvcGVydHlOYW1lcyBmdW5jdGlvbi5cbiAqIFRoZSBzcGVjaWFsIGNhc2VzIGFyZSB2ZXJ5IG11Y2ggaGFja3MuIFRoaXMgaGFjayBjYW4gYmUgcmVtb3ZlZCBvbmNlIHRoZSBQcm94eSBvYmplY3QgaXMgbW9yZSB3aWRlbHkgYWRvcHRlZC5cbiAqIEBwYXJhbSBvYmplY3RcbiAqIEByZXR1cm5zIHtBcnJheX1cbiAqL1xuZnVuY3Rpb24gZ2V0UHJvcGVydHlOYW1lcyhvYmplY3QpIHtcbiAgICB2YXIgcHJvcGVydHlOYW1lcztcbiAgICBpZiAodHlwZW9mIG9iamVjdCA9PSAnc3RyaW5nJyB8fCBvYmplY3QgaW5zdGFuY2VvZiBTdHJpbmcpIHtcbiAgICAgICAgcHJvcGVydHlOYW1lcyA9IFNUUklOR19NRVRIT0RTLmNvbmNhdChTVFJJTkdfUFJPUEVSVElFUyk7XG4gICAgfVxuICAgIGVsc2UgaWYgKHR5cGVvZiBvYmplY3QgPT0gJ251bWJlcicgfHwgb2JqZWN0IGluc3RhbmNlb2YgTnVtYmVyKSB7XG4gICAgICAgIHByb3BlcnR5TmFtZXMgPSBOVU1CRVJfTUVUSE9EUy5jb25jYXQoTlVNQkVSX1BST1BFUlRJRVMpO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgcHJvcGVydHlOYW1lcyA9IG9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKCk7XG4gICAgfVxuICAgIHJldHVybiBwcm9wZXJ0eU5hbWVzO1xufVxuXG4vKipcbiAqIERlZmluZSBhIHByb3h5IHByb3BlcnR5IHRvIGF0dHJpYnV0ZXMgb24gb2JqZWN0cyBpbiB0aGUgYXJyYXlcbiAqIEBwYXJhbSBhcnJcbiAqIEBwYXJhbSBwcm9wXG4gKi9cbmZ1bmN0aW9uIGRlZmluZUF0dHJpYnV0ZShhcnIsIHByb3ApIHtcbiAgICBpZiAoIShwcm9wIGluIGFycikpIHsgLy8gZS5nLiB3ZSBjYW5ub3QgcmVkZWZpbmUgLmxlbmd0aFxuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoYXJyLCBwcm9wLCB7XG4gICAgICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gcXVlcnlTZXQoXy5wbHVjayhhcnIsIHByb3ApKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBzZXQ6IGZ1bmN0aW9uICh2KSB7XG4gICAgICAgICAgICAgICAgaWYgKHV0aWwuaXNBcnJheSh2KSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5sZW5ndGggIT0gdi5sZW5ndGgpIHRocm93IG5ldyBTaWVzdGFVc2VyRXJyb3Ioe21lc3NhZ2U6ICdNdXN0IGJlIHNhbWUgbGVuZ3RoJ30pO1xuICAgICAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHYubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXNbaV1bcHJvcF0gPSB2W2ldO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgdGhpcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpc1tpXVtwcm9wXSA9IHY7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gaXNQcm9taXNlKG9iaikge1xuICAgIC8vIFRPRE86IERvbid0IHRoaW5rIHRoaXMgaXMgdmVyeSByb2J1c3QuXG4gICAgcmV0dXJuIG9iai50aGVuICYmIG9iai5jYXRjaDtcbn1cblxuLyoqXG4gKiBEZWZpbmUgYSBwcm94eSBtZXRob2Qgb24gdGhlIGFycmF5IGlmIG5vdCBhbHJlYWR5IGluIGV4aXN0ZW5jZS5cbiAqIEBwYXJhbSBhcnJcbiAqIEBwYXJhbSBwcm9wXG4gKi9cbmZ1bmN0aW9uIGRlZmluZU1ldGhvZChhcnIsIHByb3ApIHtcbiAgICBpZiAoIShwcm9wIGluIGFycikpIHsgLy8gZS5nLiB3ZSBkb24ndCB3YW50IHRvIHJlZGVmaW5lIHRvU3RyaW5nXG4gICAgICAgIGFycltwcm9wXSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHZhciBhcmdzID0gYXJndW1lbnRzLFxuICAgICAgICAgICAgICAgIHJlcyA9IHRoaXMubWFwKGZ1bmN0aW9uIChwKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBwW3Byb3BdLmFwcGx5KHAsIGFyZ3MpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgdmFyIGFyZVByb21pc2VzID0gZmFsc2U7XG4gICAgICAgICAgICBpZiAocmVzLmxlbmd0aCkgYXJlUHJvbWlzZXMgPSBpc1Byb21pc2UocmVzWzBdKTtcbiAgICAgICAgICAgIHJldHVybiBhcmVQcm9taXNlcyA/IHdpbmRvdy5RLmFsbChyZXMpIDogcXVlcnlTZXQocmVzKTtcbiAgICAgICAgfTtcbiAgICB9XG59XG5cbi8qKlxuICogVHJhbnNmb3JtIHRoZSBhcnJheSBpbnRvIGEgcXVlcnkgc2V0LlxuICogUmVuZGVycyB0aGUgYXJyYXkgaW1tdXRhYmxlLlxuICogQHBhcmFtIGFyclxuICogQHBhcmFtIG1vZGVsIC0gVGhlIG1vZGVsIHdpdGggd2hpY2ggdG8gcHJveHkgdG9cbiAqL1xuZnVuY3Rpb24gbW9kZWxRdWVyeVNldChhcnIsIG1vZGVsKSB7XG4gICAgYXJyID0gXy5leHRlbmQoW10sIGFycik7XG4gICAgdmFyIGF0dHJpYnV0ZU5hbWVzID0gbW9kZWwuX2F0dHJpYnV0ZU5hbWVzLFxuICAgICAgICByZWxhdGlvbnNoaXBOYW1lcyA9IG1vZGVsLl9yZWxhdGlvbnNoaXBOYW1lcyxcbiAgICAgICAgbmFtZXMgPSBhdHRyaWJ1dGVOYW1lcy5jb25jYXQocmVsYXRpb25zaGlwTmFtZXMpLmNvbmNhdChpbnN0YW5jZU1ldGhvZHMpO1xuICAgIG5hbWVzLmZvckVhY2goXy5wYXJ0aWFsKGRlZmluZUF0dHJpYnV0ZSwgYXJyKSk7XG4gICAgdmFyIGluc3RhbmNlTWV0aG9kcyA9IE9iamVjdC5rZXlzKE1vZGVsSW5zdGFuY2UucHJvdG90eXBlKTtcbiAgICBpbnN0YW5jZU1ldGhvZHMuZm9yRWFjaChfLnBhcnRpYWwoZGVmaW5lTWV0aG9kLCBhcnIpKTtcbiAgICByZXR1cm4gcmVuZGVySW1tdXRhYmxlKGFycik7XG59XG5cbi8qKlxuICogVHJhbnNmb3JtIHRoZSBhcnJheSBpbnRvIGEgcXVlcnkgc2V0LCBiYXNlZCBvbiB3aGF0ZXZlciBpcyBpbiBpdC5cbiAqIE5vdGUgdGhhdCBhbGwgb2JqZWN0cyBtdXN0IGJlIG9mIHRoZSBzYW1lIHR5cGUuIFRoaXMgZnVuY3Rpb24gd2lsbCB0YWtlIHRoZSBmaXJzdCBvYmplY3QgYW5kIGRlY2lkZSBob3cgdG8gcHJveHlcbiAqIGJhc2VkIG9uIHRoYXQuXG4gKiBAcGFyYW0gYXJyXG4gKi9cbmZ1bmN0aW9uIHF1ZXJ5U2V0KGFycikge1xuICAgIGlmIChhcnIubGVuZ3RoKSB7XG4gICAgICAgIHZhciByZWZlcmVuY2VPYmplY3QgPSBhcnJbMF0sXG4gICAgICAgICAgICBwcm9wZXJ0eU5hbWVzID0gZ2V0UHJvcGVydHlOYW1lcyhyZWZlcmVuY2VPYmplY3QpO1xuICAgICAgICBwcm9wZXJ0eU5hbWVzLmZvckVhY2goZnVuY3Rpb24gKHByb3ApIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgcmVmZXJlbmNlT2JqZWN0W3Byb3BdID09ICdmdW5jdGlvbicpIGRlZmluZU1ldGhvZChhcnIsIHByb3AsIGFyZ3VtZW50cyk7XG4gICAgICAgICAgICBlbHNlIGRlZmluZUF0dHJpYnV0ZShhcnIsIHByb3ApO1xuICAgICAgICB9KTtcbiAgICB9XG4gICAgcmV0dXJuIHJlbmRlckltbXV0YWJsZShhcnIpO1xufVxuXG5mdW5jdGlvbiB0aHJvd0ltbXV0YWJsZUVycm9yKCkge1xuICAgIHRocm93IG5ldyBFcnJvcignQ2Fubm90IG1vZGlmeSBhIHF1ZXJ5IHNldCcpO1xufVxuXG4vKipcbiAqIFJlbmRlciBhbiBhcnJheSBpbW11dGFibGUgYnkgcmVwbGFjaW5nIGFueSBmdW5jdGlvbnMgdGhhdCBjYW4gbXV0YXRlIGl0LlxuICogQHBhcmFtIGFyclxuICovXG5mdW5jdGlvbiByZW5kZXJJbW11dGFibGUoYXJyKSB7XG4gICAgQVJSQVlfTUVUSE9EUy5mb3JFYWNoKGZ1bmN0aW9uIChwKSB7XG4gICAgICAgIGFycltwXSA9IHRocm93SW1tdXRhYmxlRXJyb3I7XG4gICAgfSk7XG4gICAgYXJyLmltbXV0YWJsZSA9IHRydWU7XG4gICAgYXJyLm11dGFibGVDb3B5ID0gYXJyLmFzQXJyYXkgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBtdXRhYmxlQXJyID0gXy5tYXAodGhpcywgZnVuY3Rpb24gKHgpIHtyZXR1cm4geH0pO1xuICAgICAgICBtdXRhYmxlQXJyLmFzUXVlcnlTZXQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gcXVlcnlTZXQodGhpcyk7XG4gICAgICAgIH07XG4gICAgICAgIG11dGFibGVBcnIuYXNNb2RlbFF1ZXJ5U2V0ID0gZnVuY3Rpb24gKG1vZGVsKSB7XG4gICAgICAgICAgICByZXR1cm4gbW9kZWxRdWVyeVNldCh0aGlzLCBtb2RlbCk7XG4gICAgICAgIH07XG4gICAgICAgIHJldHVybiBtdXRhYmxlQXJyO1xuICAgIH07XG4gICAgcmV0dXJuIGFycjtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBtb2RlbFF1ZXJ5U2V0OyIsIi8qKlxuICogRm9yIHRob3NlIGZhbWlsaWFyIHdpdGggQXBwbGUncyBDb2NvYSBsaWJyYXJ5LCByZWFjdGl2ZSBxdWVyaWVzIHJvdWdobHkgbWFwIG9udG8gTlNGZXRjaGVkUmVzdWx0c0NvbnRyb2xsZXIuXG4gKlxuICogVGhleSBwcmVzZW50IGEgcXVlcnkgc2V0IHRoYXQgJ3JlYWN0cycgdG8gY2hhbmdlcyBpbiB0aGUgdW5kZXJseWluZyBkYXRhLlxuICogQG1vZHVsZSByZWFjdGl2ZVF1ZXJ5XG4gKi9cblxudmFyIGxvZyA9IHJlcXVpcmUoJy4vbG9nJyksXG4gICAgUXVlcnkgPSByZXF1aXJlKCcuL3F1ZXJ5JyksXG4gICAgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnZXZlbnRzJykuRXZlbnRFbWl0dGVyLFxuICAgIGV2ZW50cyA9IHJlcXVpcmUoJy4vZXZlbnRzJyksXG4gICAgbW9kZWxFdmVudHMgPSByZXF1aXJlKCcuL21vZGVsRXZlbnRzJyksXG4gICAgSW50ZXJuYWxTaWVzdGFFcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKS5JbnRlcm5hbFNpZXN0YUVycm9yLFxuICAgIGNvbnN0cnVjdFF1ZXJ5U2V0ID0gcmVxdWlyZSgnLi9xdWVyeVNldCcpLFxuICAgIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKSxcbiAgICBfID0gdXRpbC5fO1xuXG52YXIgTG9nZ2VyID0gbG9nLmxvZ2dlcldpdGhOYW1lKCdRdWVyeScpO1xuXG4vKipcbiAqXG4gKiBAcGFyYW0ge1F1ZXJ5fSBxdWVyeSAtIFRoZSB1bmRlcmx5aW5nIHF1ZXJ5XG4gKiBAY29uc3RydWN0b3JcbiAqL1xuZnVuY3Rpb24gUmVhY3RpdmVRdWVyeShxdWVyeSkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBFdmVudEVtaXR0ZXIuY2FsbCh0aGlzKTtcblxuICAgIF8uZXh0ZW5kKHRoaXMsIHtcbiAgICAgICAgX3F1ZXJ5OiBxdWVyeSxcbiAgICAgICAgcmVzdWx0czogY29uc3RydWN0UXVlcnlTZXQoW10sIHF1ZXJ5Lm1vZGVsKSxcbiAgICAgICAgaW5zZXJ0aW9uUG9saWN5OiBSZWFjdGl2ZVF1ZXJ5Lkluc2VydGlvblBvbGljeS5CYWNrLFxuICAgICAgICBpbml0aWFsaXNlZDogZmFsc2VcbiAgICB9KTtcblxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKHRoaXMsIHtcbiAgICAgICAgaW5pdGlhbGl6ZWQ6IHtnZXQ6IGZ1bmN0aW9uICgpIHtyZXR1cm4gdGhpcy5pbml0aWFsaXNlZH19LFxuICAgICAgICBtb2RlbDoge2dldDogZnVuY3Rpb24gKCkgeyByZXR1cm4gc2VsZi5fcXVlcnkubW9kZWwgfX0sXG4gICAgICAgIGNvbGxlY3Rpb246IHtnZXQ6IGZ1bmN0aW9uICgpIHsgcmV0dXJuIHNlbGYubW9kZWwuY29sbGVjdGlvbk5hbWUgfX1cbiAgICB9KTtcbn1cblxuUmVhY3RpdmVRdWVyeS5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKEV2ZW50RW1pdHRlci5wcm90b3R5cGUpO1xuXG5fLmV4dGVuZChSZWFjdGl2ZVF1ZXJ5LCB7XG4gICAgSW5zZXJ0aW9uUG9saWN5OiB7XG4gICAgICAgIEZyb250OiAnRnJvbnQnLFxuICAgICAgICBCYWNrOiAnQmFjaydcbiAgICB9XG59KTtcblxuXy5leHRlbmQoUmVhY3RpdmVRdWVyeS5wcm90b3R5cGUsIHtcbiAgICBpbml0OiBmdW5jdGlvbiAoY2IpIHtcbiAgICAgICAgaWYgKExvZ2dlci50cmFjZSkgTG9nZ2VyLnRyYWNlKCdpbml0Jyk7XG4gICAgICAgIHZhciBkZWZlcnJlZCA9IHV0aWwuZGVmZXIoY2IpO1xuICAgICAgICBjYiA9IGRlZmVycmVkLmZpbmlzaC5iaW5kKGRlZmVycmVkKTtcbiAgICAgICAgaWYgKCF0aGlzLmluaXRpYWxpc2VkKSB7XG4gICAgICAgICAgICB0aGlzLl9xdWVyeS5leGVjdXRlKGZ1bmN0aW9uIChlcnIsIHJlc3VsdHMpIHtcbiAgICAgICAgICAgICAgICBpZiAoIWVycikge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnJlc3VsdHMgPSByZXN1bHRzO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIXRoaXMuaGFuZGxlcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG5hbWUgPSB0aGlzLl9jb25zdHJ1Y3ROb3RpZmljYXRpb25OYW1lKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgaGFuZGxlciA9IGZ1bmN0aW9uIChuKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5faGFuZGxlTm90aWYobik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9LmJpbmQodGhpcyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmhhbmRsZXIgPSBoYW5kbGVyO1xuICAgICAgICAgICAgICAgICAgICAgICAgZXZlbnRzLm9uKG5hbWUsIGhhbmRsZXIpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmIChMb2dnZXIudHJhY2UpIExvZ2dlci50cmFjZSgnTGlzdGVuaW5nIHRvICcgKyBuYW1lKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5pbml0aWFsaXNlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIGNiKG51bGwsIHRoaXMucmVzdWx0cyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBjYihlcnIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBjYihudWxsLCB0aGlzLnJlc3VsdHMpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xuICAgIH0sXG4gICAgaW5zZXJ0OiBmdW5jdGlvbiAobmV3T2JqKSB7XG4gICAgICAgIHZhciByZXN1bHRzID0gdGhpcy5yZXN1bHRzLm11dGFibGVDb3B5KCk7XG4gICAgICAgIGlmICh0aGlzLmluc2VydGlvblBvbGljeSA9PSBSZWFjdGl2ZVF1ZXJ5Lkluc2VydGlvblBvbGljeS5CYWNrKSB7XG4gICAgICAgICAgICB2YXIgaWR4ID0gcmVzdWx0cy5wdXNoKG5ld09iaik7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBpZHggPSByZXN1bHRzLnVuc2hpZnQobmV3T2JqKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnJlc3VsdHMgPSByZXN1bHRzLmFzTW9kZWxRdWVyeVNldCh0aGlzLm1vZGVsKTtcbiAgICAgICAgcmV0dXJuIGlkeDtcbiAgICB9LFxuICAgIF9oYW5kbGVOb3RpZjogZnVuY3Rpb24gKG4pIHtcbiAgICAgICAgaWYgKExvZ2dlci50cmFjZSkgTG9nZ2VyLnRyYWNlKCdfaGFuZGxlTm90aWYnLCBuKTtcbiAgICAgICAgaWYgKG4udHlwZSA9PSBtb2RlbEV2ZW50cy5Nb2RlbEV2ZW50VHlwZS5OZXcpIHtcbiAgICAgICAgICAgIHZhciBuZXdPYmogPSBuLm5ldztcbiAgICAgICAgICAgIGlmICh0aGlzLl9xdWVyeS5vYmplY3RNYXRjaGVzUXVlcnkobmV3T2JqKSkge1xuICAgICAgICAgICAgICAgIGlmIChMb2dnZXIudHJhY2UpIExvZ2dlci50cmFjZSgnTmV3IG9iamVjdCBtYXRjaGVzJywgbmV3T2JqLl9kdW1wU3RyaW5nKCkpO1xuICAgICAgICAgICAgICAgIHZhciBpZHggPSB0aGlzLmluc2VydChuZXdPYmopO1xuICAgICAgICAgICAgICAgIHRoaXMuZW1pdCgnY2hhbmdlJywgdGhpcy5yZXN1bHRzLCB7XG4gICAgICAgICAgICAgICAgICAgIGluZGV4OiBpZHgsXG4gICAgICAgICAgICAgICAgICAgIGFkZGVkOiBbbmV3T2JqXSxcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogbW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUuU3BsaWNlLFxuICAgICAgICAgICAgICAgICAgICBvYmo6IHRoaXNcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmIChMb2dnZXIudHJhY2UpIExvZ2dlci50cmFjZSgnTmV3IG9iamVjdCBkb2VzIG5vdCBtYXRjaCcsIG5ld09iai5fZHVtcFN0cmluZygpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChuLnR5cGUgPT0gbW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUuU2V0KSB7XG4gICAgICAgICAgICBuZXdPYmogPSBuLm9iajtcbiAgICAgICAgICAgIHZhciBpbmRleCA9IHRoaXMucmVzdWx0cy5pbmRleE9mKG5ld09iaiksXG4gICAgICAgICAgICAgICAgYWxyZWFkeUNvbnRhaW5zID0gaW5kZXggPiAtMSxcbiAgICAgICAgICAgICAgICBtYXRjaGVzID0gdGhpcy5fcXVlcnkub2JqZWN0TWF0Y2hlc1F1ZXJ5KG5ld09iaik7XG4gICAgICAgICAgICBpZiAobWF0Y2hlcyAmJiAhYWxyZWFkeUNvbnRhaW5zKSB7XG4gICAgICAgICAgICAgICAgaWYgKExvZ2dlci50cmFjZSkgTG9nZ2VyLnRyYWNlKCdVcGRhdGVkIG9iamVjdCBub3cgbWF0Y2hlcyEnLCBuZXdPYmouX2R1bXBTdHJpbmcoKSk7XG4gICAgICAgICAgICAgICAgaWR4ID0gdGhpcy5pbnNlcnQobmV3T2JqKTtcbiAgICAgICAgICAgICAgICB0aGlzLmVtaXQoJ2NoYW5nZScsIHRoaXMucmVzdWx0cywge1xuICAgICAgICAgICAgICAgICAgICBpbmRleDogaWR4LFxuICAgICAgICAgICAgICAgICAgICBhZGRlZDogW25ld09ial0sXG4gICAgICAgICAgICAgICAgICAgIHR5cGU6IG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlLlNwbGljZSxcbiAgICAgICAgICAgICAgICAgICAgb2JqOiB0aGlzXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmICghbWF0Y2hlcyAmJiBhbHJlYWR5Q29udGFpbnMpIHtcbiAgICAgICAgICAgICAgICBpZiAoTG9nZ2VyLnRyYWNlKSBMb2dnZXIudHJhY2UoJ1VwZGF0ZWQgb2JqZWN0IG5vIGxvbmdlciBtYXRjaGVzIScsIG5ld09iai5fZHVtcFN0cmluZygpKTtcbiAgICAgICAgICAgICAgICByZXN1bHRzID0gdGhpcy5yZXN1bHRzLm11dGFibGVDb3B5KCk7XG4gICAgICAgICAgICAgICAgdmFyIHJlbW92ZWQgPSByZXN1bHRzLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgICAgICAgICAgdGhpcy5yZXN1bHRzID0gcmVzdWx0cy5hc01vZGVsUXVlcnlTZXQodGhpcy5tb2RlbCk7XG4gICAgICAgICAgICAgICAgdGhpcy5lbWl0KCdjaGFuZ2UnLCB0aGlzLnJlc3VsdHMsIHtcbiAgICAgICAgICAgICAgICAgICAgaW5kZXg6IGluZGV4LFxuICAgICAgICAgICAgICAgICAgICBvYmo6IHRoaXMsXG4gICAgICAgICAgICAgICAgICAgIG5ldzogbmV3T2JqLFxuICAgICAgICAgICAgICAgICAgICB0eXBlOiBtb2RlbEV2ZW50cy5Nb2RlbEV2ZW50VHlwZS5TcGxpY2UsXG4gICAgICAgICAgICAgICAgICAgIHJlbW92ZWQ6IHJlbW92ZWRcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKCFtYXRjaGVzICYmICFhbHJlYWR5Q29udGFpbnMpIHtcbiAgICAgICAgICAgICAgICBpZiAoTG9nZ2VyLnRyYWNlKSBMb2dnZXIudHJhY2UoJ0RvZXMgbm90IGNvbnRhaW4sIGJ1dCBkb2VzbnQgbWF0Y2ggc28gbm90IGluc2VydGluZycsIG5ld09iai5fZHVtcFN0cmluZygpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKG1hdGNoZXMgJiYgYWxyZWFkeUNvbnRhaW5zKSB7XG4gICAgICAgICAgICAgICAgaWYgKExvZ2dlci50cmFjZSkgTG9nZ2VyLnRyYWNlKCdNYXRjaGVzIGJ1dCBhbHJlYWR5IGNvbnRhaW5zJywgbmV3T2JqLl9kdW1wU3RyaW5nKCkpO1xuICAgICAgICAgICAgICAgIC8vIFNlbmQgdGhlIG5vdGlmaWNhdGlvbiBvdmVyLiBcbiAgICAgICAgICAgICAgICB0aGlzLmVtaXQoJ2NoYW5nZScsIHRoaXMucmVzdWx0cywgbik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAobi50eXBlID09IG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlLlJlbW92ZSkge1xuICAgICAgICAgICAgbmV3T2JqID0gbi5vYmo7XG4gICAgICAgICAgICB2YXIgcmVzdWx0cyA9IHRoaXMucmVzdWx0cy5tdXRhYmxlQ29weSgpO1xuICAgICAgICAgICAgaW5kZXggPSByZXN1bHRzLmluZGV4T2YobmV3T2JqKTtcbiAgICAgICAgICAgIGlmIChpbmRleCA+IC0xKSB7XG4gICAgICAgICAgICAgICAgaWYgKExvZ2dlci50cmFjZSkgTG9nZ2VyLnRyYWNlKCdSZW1vdmluZyBvYmplY3QnLCBuZXdPYmouX2R1bXBTdHJpbmcoKSk7XG4gICAgICAgICAgICAgICAgcmVtb3ZlZCA9IHJlc3VsdHMuc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgICAgICAgICB0aGlzLnJlc3VsdHMgPSBjb25zdHJ1Y3RRdWVyeVNldChyZXN1bHRzLCB0aGlzLm1vZGVsKTtcbiAgICAgICAgICAgICAgICB0aGlzLmVtaXQoJ2NoYW5nZScsIHRoaXMucmVzdWx0cywge1xuICAgICAgICAgICAgICAgICAgICBpbmRleDogaW5kZXgsXG4gICAgICAgICAgICAgICAgICAgIG9iajogdGhpcyxcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogbW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUuU3BsaWNlLFxuICAgICAgICAgICAgICAgICAgICByZW1vdmVkOiByZW1vdmVkXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZiAoTG9nZ2VyLnRyYWNlKSBMb2dnZXIudHJhY2UoJ05vIG1vZGVsRXZlbnRzIG5lY2Nlc3NhcnkuJywgbmV3T2JqLl9kdW1wU3RyaW5nKCkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ1Vua25vd24gY2hhbmdlIHR5cGUgXCInICsgbi50eXBlLnRvU3RyaW5nKCkgKyAnXCInKVxuICAgICAgICB9XG4gICAgICAgIHRoaXMucmVzdWx0cyA9IGNvbnN0cnVjdFF1ZXJ5U2V0KHRoaXMuX3F1ZXJ5Ll9zb3J0UmVzdWx0cyh0aGlzLnJlc3VsdHMpLCB0aGlzLm1vZGVsKTtcbiAgICB9LFxuICAgIF9jb25zdHJ1Y3ROb3RpZmljYXRpb25OYW1lOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLm1vZGVsLmNvbGxlY3Rpb25OYW1lICsgJzonICsgdGhpcy5tb2RlbC5uYW1lO1xuICAgIH0sXG4gICAgdGVybWluYXRlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmICh0aGlzLmhhbmRsZXIpIHtcbiAgICAgICAgICAgIGV2ZW50cy5yZW1vdmVMaXN0ZW5lcih0aGlzLl9jb25zdHJ1Y3ROb3RpZmljYXRpb25OYW1lKCksIHRoaXMuaGFuZGxlcik7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5yZXN1bHRzID0gbnVsbDtcbiAgICAgICAgdGhpcy5oYW5kbGVyID0gbnVsbDtcbiAgICB9LFxuICAgIGxpc3RlbjogZnVuY3Rpb24gKGZuKSB7XG4gICAgICAgIHRoaXMub24oJ2NoYW5nZScsIGZuKTtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIoJ2NoYW5nZScsIGZuKTtcbiAgICAgICAgfS5iaW5kKHRoaXMpO1xuICAgIH0sXG4gICAgbGlzdGVuT25jZTogZnVuY3Rpb24gKGZuKSB7XG4gICAgICAgIHRoaXMub25jZSgnY2hhbmdlJywgZm4pO1xuICAgIH1cbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFJlYWN0aXZlUXVlcnk7IiwiLyoqXG4gKiBUaGUgXCJzdG9yZVwiIGlzIHJlc3BvbnNpYmxlIGZvciBtZWRpYXRpbmcgYmV0d2VlbiB0aGUgaW4tbWVtb3J5IGNhY2hlIGFuZCBhbnkgcGVyc2lzdGVudCBzdG9yYWdlLlxuICogTm90ZSB0aGF0IHBlcnNpc3RlbnQgc3RvcmFnZSBoYXMgbm90IGJlZW4gcHJvcGVybHkgaW1wbGVtZW50ZWQgeWV0IGFuZCBzbyB0aGlzIGlzIHByZXR0eSB1c2VsZXNzLlxuICogQWxsIHF1ZXJpZXMgd2lsbCBnbyBzdHJhaWdodCB0byB0aGUgY2FjaGUgaW5zdGVhZC5cbiAqIEBtb2R1bGUgc3RvcmVcbiAqL1xuXG52YXIgSW50ZXJuYWxTaWVzdGFFcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKS5JbnRlcm5hbFNpZXN0YUVycm9yLFxuICAgIGxvZyA9IHJlcXVpcmUoJy4vbG9nJyksXG4gICAgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpLFxuICAgIF8gPSB1dGlsLl8sXG4gICAgY2FjaGUgPSByZXF1aXJlKCcuL2NhY2hlJyk7XG5cblxudmFyIExvZ2dlciA9IGxvZy5sb2dnZXJXaXRoTmFtZSgnU3RvcmUnKTtcblxuLyoqXG4gKiBbZ2V0IGRlc2NyaXB0aW9uXVxuICogQHBhcmFtICB7T2JqZWN0fSAgIG9wdHNcbiAqIEBwYXJhbSAge0Z1bmN0aW9ufSBjYWxsYmFja1xuICogQHJldHVybiB7UHJvbWlzZX1cbiAqIEBleGFtcGxlXG4gKiBgYGBqc1xuICogdmFyIHh5eiA9ICdhZnNkZic7XG4gKiBgYGBcbiAqIEBleGFtcGxlXG4gKiBgYGBqc1xuICogdmFyIGFiYyA9ICdhc2RzZCc7XG4gKiBgYGBcbiAqL1xuZnVuY3Rpb24gZ2V0KG9wdHMsIGNhbGxiYWNrKSB7XG4gICAgdmFyIGRlZmVycmVkID0gdXRpbC5kZWZlcihjYWxsYmFjayk7XG4gICAgY2FsbGJhY2sgPSBkZWZlcnJlZC5maW5pc2guYmluZChkZWZlcnJlZCk7XG4gICAgaWYgKExvZ2dlci5kZWJ1Zy5pc0VuYWJsZWQpXG4gICAgICAgIExvZ2dlci5kZWJ1ZygnZ2V0Jywgb3B0cyk7XG4gICAgdmFyIHNpZXN0YU1vZGVsO1xuICAgIGlmIChvcHRzLl9pZCkge1xuICAgICAgICBpZiAodXRpbC5pc0FycmF5KG9wdHMuX2lkKSkge1xuICAgICAgICAgICAgLy8gUHJveHkgb250byBnZXRNdWx0aXBsZSBpbnN0ZWFkLlxuICAgICAgICAgICAgZ2V0TXVsdGlwbGUoXy5tYXAob3B0cy5faWQsIGZ1bmN0aW9uIChpZCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgIF9pZDogaWRcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KSwgY2FsbGJhY2spO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc2llc3RhTW9kZWwgPSBjYWNoZS5nZXQob3B0cyk7XG4gICAgICAgICAgICBpZiAoc2llc3RhTW9kZWwpIHtcbiAgICAgICAgICAgICAgICBpZiAoTG9nZ2VyLmRlYnVnLmlzRW5hYmxlZClcbiAgICAgICAgICAgICAgICAgICAgTG9nZ2VyLmRlYnVnKCdIYWQgY2FjaGVkIG9iamVjdCcsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG9wdHM6IG9wdHMsXG4gICAgICAgICAgICAgICAgICAgICAgICBvYmo6IHNpZXN0YU1vZGVsXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2sobnVsbCwgc2llc3RhTW9kZWwpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZiAodXRpbC5pc0FycmF5KG9wdHMuX2lkKSkge1xuICAgICAgICAgICAgICAgICAgICAvLyBQcm94eSBvbnRvIGdldE11bHRpcGxlIGluc3RlYWQuXG4gICAgICAgICAgICAgICAgICAgIGdldE11bHRpcGxlKF8ubWFwKG9wdHMuX2lkLCBmdW5jdGlvbiAoaWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgX2lkOiBpZFxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9KSwgY2FsbGJhY2spO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHN0b3JhZ2UgPSBzaWVzdGEuZXh0LnN0b3JhZ2U7XG4gICAgICAgICAgICAgICAgICAgIGlmIChzdG9yYWdlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzdG9yYWdlLnN0b3JlLmdldEZyb21Qb3VjaChvcHRzLCBjYWxsYmFjayk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1N0b3JhZ2UgbW9kdWxlIG5vdCBpbnN0YWxsZWQnKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0gZWxzZSBpZiAob3B0cy5tb2RlbCkge1xuICAgICAgICBpZiAodXRpbC5pc0FycmF5KG9wdHNbb3B0cy5tb2RlbC5pZF0pKSB7XG4gICAgICAgICAgICAvLyBQcm94eSBvbnRvIGdldE11bHRpcGxlIGluc3RlYWQuXG4gICAgICAgICAgICBnZXRNdWx0aXBsZShfLm1hcChvcHRzW29wdHMubW9kZWwuaWRdLCBmdW5jdGlvbiAoaWQpIHtcbiAgICAgICAgICAgICAgICB2YXIgbyA9IHt9O1xuICAgICAgICAgICAgICAgIG9bb3B0cy5tb2RlbC5pZF0gPSBpZDtcbiAgICAgICAgICAgICAgICBvLm1vZGVsID0gb3B0cy5tb2RlbDtcbiAgICAgICAgICAgICAgICByZXR1cm4gb1xuICAgICAgICAgICAgfSksIGNhbGxiYWNrKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHNpZXN0YU1vZGVsID0gY2FjaGUuZ2V0KG9wdHMpO1xuICAgICAgICAgICAgaWYgKHNpZXN0YU1vZGVsKSB7XG4gICAgICAgICAgICAgICAgaWYgKExvZ2dlci5kZWJ1Zy5pc0VuYWJsZWQpXG4gICAgICAgICAgICAgICAgICAgIExvZ2dlci5kZWJ1ZygnSGFkIGNhY2hlZCBvYmplY3QnLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICBvcHRzOiBvcHRzLFxuICAgICAgICAgICAgICAgICAgICAgICAgb2JqOiBzaWVzdGFNb2RlbFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKG51bGwsIHNpZXN0YU1vZGVsKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdmFyIG1vZGVsID0gb3B0cy5tb2RlbDtcbiAgICAgICAgICAgICAgICBpZiAobW9kZWwuc2luZ2xldG9uKSB7XG4gICAgICAgICAgICAgICAgICAgIG1vZGVsLm9uZShjYWxsYmFjayk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGlkRmllbGQgPSBtb2RlbC5pZDtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGlkID0gb3B0c1tpZEZpZWxkXTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIG9uZU9wdHMgPSB7fTtcbiAgICAgICAgICAgICAgICAgICAgb25lT3B0c1tpZEZpZWxkXSA9IGlkO1xuICAgICAgICAgICAgICAgICAgICBpZiAoaWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG1vZGVsLm9uZShvbmVPcHRzLCBmdW5jdGlvbiAoZXJyLCBvYmopIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAob2JqKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhudWxsLCBvYmopO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2sobnVsbCwgbnVsbCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ0ludmFsaWQgb3B0aW9ucyBnaXZlbiB0byBzdG9yZS4gTWlzc2luZyBcIicgKyBpZEZpZWxkLnRvU3RyaW5nKCkgKyAnLlwiJyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIE5vIHdheSBpbiB3aGljaCB0byBmaW5kIGFuIG9iamVjdCBsb2NhbGx5LlxuICAgICAgICB2YXIgY29udGV4dCA9IHtcbiAgICAgICAgICAgIG9wdHM6IG9wdHNcbiAgICAgICAgfTtcbiAgICAgICAgdmFyIG1zZyA9ICdJbnZhbGlkIG9wdGlvbnMgZ2l2ZW4gdG8gc3RvcmUnO1xuICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcihtc2csIGNvbnRleHQpO1xuICAgIH1cbiAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbn1cblxuZnVuY3Rpb24gZ2V0TXVsdGlwbGUob3B0c0FycmF5LCBjYWxsYmFjaykge1xuICAgIHZhciBkZWZlcnJlZCA9IHV0aWwuZGVmZXIoY2FsbGJhY2spO1xuICAgIGNhbGxiYWNrID0gZGVmZXJyZWQuZmluaXNoLmJpbmQoZGVmZXJyZWQpO1xuICAgIHZhciBkb2NzID0gW107XG4gICAgdmFyIGVycm9ycyA9IFtdO1xuICAgIF8uZWFjaChvcHRzQXJyYXksIGZ1bmN0aW9uIChvcHRzKSB7XG4gICAgICAgIGdldChvcHRzLCBmdW5jdGlvbiAoZXJyLCBkb2MpIHtcbiAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICBlcnJvcnMucHVzaChlcnIpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBkb2NzLnB1c2goZG9jKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChkb2NzLmxlbmd0aCArIGVycm9ycy5sZW5ndGggPT0gb3B0c0FycmF5Lmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIGlmIChjYWxsYmFjaykge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZXJyb3JzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyb3JzKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIGRvY3MpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9KTtcbiAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbn1cbi8qKlxuICogVXNlcyBwb3VjaCBidWxrIGZldGNoIEFQSS4gTXVjaCBmYXN0ZXIgdGhhbiBnZXRNdWx0aXBsZS5cbiAqIEBwYXJhbSBsb2NhbElkZW50aWZpZXJzXG4gKiBAcGFyYW0gY2FsbGJhY2tcbiAqL1xuZnVuY3Rpb24gZ2V0TXVsdGlwbGVMb2NhbChsb2NhbElkZW50aWZpZXJzLCBjYWxsYmFjaykge1xuICAgIHZhciBkZWZlcnJlZCA9IHV0aWwuZGVmZXIoY2FsbGJhY2spO1xuICAgIGNhbGxiYWNrID0gZGVmZXJyZWQuZmluaXNoLmJpbmQoZGVmZXJyZWQpO1xuICAgIHZhciByZXN1bHRzID0gXy5yZWR1Y2UobG9jYWxJZGVudGlmaWVycywgZnVuY3Rpb24gKG1lbW8sIF9pZCkge1xuICAgICAgICB2YXIgb2JqID0gY2FjaGUuZ2V0KHtcbiAgICAgICAgICAgIF9pZDogX2lkXG4gICAgICAgIH0pO1xuICAgICAgICBpZiAob2JqKSB7XG4gICAgICAgICAgICBtZW1vLmNhY2hlZFtfaWRdID0gb2JqO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbWVtby5ub3RDYWNoZWQucHVzaChfaWQpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBtZW1vO1xuICAgIH0sIHtcbiAgICAgICAgY2FjaGVkOiB7fSxcbiAgICAgICAgbm90Q2FjaGVkOiBbXVxuICAgIH0pO1xuXG4gICAgZnVuY3Rpb24gZmluaXNoKGVycikge1xuICAgICAgICBpZiAoY2FsbGJhY2spIHtcbiAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhudWxsLCBfLm1hcChsb2NhbElkZW50aWZpZXJzLCBmdW5jdGlvbiAoX2lkKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiByZXN1bHRzLmNhY2hlZFtfaWRdO1xuICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuLy8gICAgaWYgKHNpZXN0YS5leHQuc3RvcmFnZUVuYWJsZWQgJiYgcmVzdWx0cy5ub3RDYWNoZWQubGVuZ3RoKSB7XG4vLyAgICAgICAgc2llc3RhLmV4dC5zdG9yYWdlLnN0b3JlLmdldE11bHRpcGxlTG9jYWxGcm9tQ291Y2gocmVzdWx0cywgZmluaXNoKTtcbi8vICAgIH0gZWxzZSB7XG4gICAgZmluaXNoKCk7XG4vLyAgICB9XG4gICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG59XG5cbmZ1bmN0aW9uIGdldE11bHRpcGxlUmVtb3RlKHJlbW90ZUlkZW50aWZpZXJzLCBtb2RlbCwgY2FsbGJhY2spIHtcbiAgICB2YXIgZGVmZXJyZWQgPSB1dGlsLmRlZmVyKGNhbGxiYWNrKTtcbiAgICBjYWxsYmFjayA9IGRlZmVycmVkLmZpbmlzaC5iaW5kKGRlZmVycmVkKTtcbiAgICB2YXIgcmVzdWx0cyA9IF8ucmVkdWNlKHJlbW90ZUlkZW50aWZpZXJzLCBmdW5jdGlvbiAobWVtbywgaWQpIHtcbiAgICAgICAgdmFyIGNhY2hlUXVlcnkgPSB7XG4gICAgICAgICAgICBtb2RlbDogbW9kZWxcbiAgICAgICAgfTtcbiAgICAgICAgY2FjaGVRdWVyeVttb2RlbC5pZF0gPSBpZDtcbiAgICAgICAgdmFyIG9iaiA9IGNhY2hlLmdldChjYWNoZVF1ZXJ5KTtcbiAgICAgICAgaWYgKG9iaikge1xuICAgICAgICAgICAgbWVtby5jYWNoZWRbaWRdID0gb2JqO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbWVtby5ub3RDYWNoZWQucHVzaChpZCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG1lbW87XG4gICAgfSwge1xuICAgICAgICBjYWNoZWQ6IHt9LFxuICAgICAgICBub3RDYWNoZWQ6IFtdXG4gICAgfSk7XG5cbiAgICBmdW5jdGlvbiBmaW5pc2goZXJyKSB7XG4gICAgICAgIGlmIChjYWxsYmFjaykge1xuICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIF8ubWFwKHJlbW90ZUlkZW50aWZpZXJzLCBmdW5jdGlvbiAoaWQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHJlc3VsdHMuY2FjaGVkW2lkXTtcbiAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmaW5pc2goKTtcbiAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gICAgZ2V0OiBnZXQsXG4gICAgZ2V0TXVsdGlwbGU6IGdldE11bHRpcGxlLFxuICAgIGdldE11bHRpcGxlTG9jYWw6IGdldE11bHRpcGxlTG9jYWwsXG4gICAgZ2V0TXVsdGlwbGVSZW1vdGU6IGdldE11bHRpcGxlUmVtb3RlXG59O1xuIiwidmFyIG1pc2MgPSByZXF1aXJlKCcuL21pc2MnKSxcbiAgICBfID0gcmVxdWlyZSgnLi91bmRlcnNjb3JlJyk7XG5cbmZ1bmN0aW9uIGRvUGFyYWxsZWwoZm4pIHtcbiAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cyk7XG4gICAgICAgIHJldHVybiBmbi5hcHBseShudWxsLCBbZWFjaF0uY29uY2F0KGFyZ3MpKTtcbiAgICB9O1xufVxuXG52YXIgbWFwID0gZG9QYXJhbGxlbChfYXN5bmNNYXApO1xuXG52YXIgcm9vdDtcblxuZnVuY3Rpb24gX21hcChhcnIsIGl0ZXJhdG9yKSB7XG4gICAgaWYgKGFyci5tYXApIHtcbiAgICAgICAgcmV0dXJuIGFyci5tYXAoaXRlcmF0b3IpO1xuICAgIH1cbiAgICB2YXIgcmVzdWx0cyA9IFtdO1xuICAgIGVhY2goYXJyLCBmdW5jdGlvbiAoeCwgaSwgYSkge1xuICAgICAgICByZXN1bHRzLnB1c2goaXRlcmF0b3IoeCwgaSwgYSkpO1xuICAgIH0pO1xuICAgIHJldHVybiByZXN1bHRzO1xufVxuXG5mdW5jdGlvbiBfYXN5bmNNYXAoZWFjaGZuLCBhcnIsIGl0ZXJhdG9yLCBjYWxsYmFjaykge1xuICAgIGFyciA9IF9tYXAoYXJyLCBmdW5jdGlvbiAoeCwgaSkge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgaW5kZXg6IGksXG4gICAgICAgICAgICB2YWx1ZTogeFxuICAgICAgICB9O1xuICAgIH0pO1xuICAgIGlmICghY2FsbGJhY2spIHtcbiAgICAgICAgZWFjaGZuKGFyciwgZnVuY3Rpb24gKHgsIGNhbGxiYWNrKSB7XG4gICAgICAgICAgICBpdGVyYXRvcih4LnZhbHVlLCBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgICB2YXIgcmVzdWx0cyA9IFtdO1xuICAgICAgICBlYWNoZm4oYXJyLCBmdW5jdGlvbiAoeCwgY2FsbGJhY2spIHtcbiAgICAgICAgICAgIGl0ZXJhdG9yKHgudmFsdWUsIGZ1bmN0aW9uIChlcnIsIHYpIHtcbiAgICAgICAgICAgICAgICByZXN1bHRzW3guaW5kZXhdID0gdjtcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0sIGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgIGNhbGxiYWNrKGVyciwgcmVzdWx0cyk7XG4gICAgICAgIH0pO1xuICAgIH1cbn1cblxudmFyIG1hcFNlcmllcyA9IGRvU2VyaWVzKF9hc3luY01hcCk7XG5cbmZ1bmN0aW9uIGRvU2VyaWVzKGZuKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuICAgICAgICByZXR1cm4gZm4uYXBwbHkobnVsbCwgW2VhY2hTZXJpZXNdLmNvbmNhdChhcmdzKSk7XG4gICAgfTtcbn1cblxuXG5mdW5jdGlvbiBlYWNoU2VyaWVzKGFyciwgaXRlcmF0b3IsIGNhbGxiYWNrKSB7XG4gICAgY2FsbGJhY2sgPSBjYWxsYmFjayB8fCBmdW5jdGlvbiAoKSB7fTtcbiAgICBpZiAoIWFyci5sZW5ndGgpIHtcbiAgICAgICAgcmV0dXJuIGNhbGxiYWNrKCk7XG4gICAgfVxuICAgIHZhciBjb21wbGV0ZWQgPSAwO1xuICAgIHZhciBpdGVyYXRlID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBpdGVyYXRvcihhcnJbY29tcGxldGVkXSwgZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2sgPSBmdW5jdGlvbiAoKSB7fTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29tcGxldGVkICs9IDE7XG4gICAgICAgICAgICAgICAgaWYgKGNvbXBsZXRlZCA+PSBhcnIubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgaXRlcmF0ZSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfTtcbiAgICBpdGVyYXRlKCk7XG59XG5cblxuZnVuY3Rpb24gX2VhY2goYXJyLCBpdGVyYXRvcikge1xuICAgIGlmIChhcnIuZm9yRWFjaCkge1xuICAgICAgICByZXR1cm4gYXJyLmZvckVhY2goaXRlcmF0b3IpO1xuICAgIH1cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGFyci5sZW5ndGg7IGkgKz0gMSkge1xuICAgICAgICBpdGVyYXRvcihhcnJbaV0sIGksIGFycik7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBlYWNoKGFyciwgaXRlcmF0b3IsIGNhbGxiYWNrKSB7XG4gICAgY2FsbGJhY2sgPSBjYWxsYmFjayB8fCBmdW5jdGlvbiAoKSB7fTtcbiAgICBpZiAoIWFyci5sZW5ndGgpIHtcbiAgICAgICAgcmV0dXJuIGNhbGxiYWNrKCk7XG4gICAgfVxuICAgIHZhciBjb21wbGV0ZWQgPSAwO1xuICAgIF9lYWNoKGFyciwgZnVuY3Rpb24gKHgpIHtcbiAgICAgICAgaXRlcmF0b3IoeCwgb25seV9vbmNlKGRvbmUpKTtcbiAgICB9KTtcblxuICAgIGZ1bmN0aW9uIGRvbmUoZXJyKSB7XG4gICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICBjYWxsYmFjayA9IGZ1bmN0aW9uICgpIHt9O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29tcGxldGVkICs9IDE7XG4gICAgICAgICAgICBpZiAoY29tcGxldGVkID49IGFyci5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufVxuXG5cblxuXG52YXIgX3BhcmFsbGVsID0gZnVuY3Rpb24gKGVhY2hmbiwgdGFza3MsIGNhbGxiYWNrKSB7XG4gICAgY2FsbGJhY2sgPSBjYWxsYmFjayB8fCBmdW5jdGlvbiAoKSB7fTtcbiAgICBpZiAobWlzYy5pc0FycmF5KHRhc2tzKSkge1xuICAgICAgICBlYWNoZm4ubWFwKHRhc2tzLCBmdW5jdGlvbiAoZm4sIGNhbGxiYWNrKSB7XG4gICAgICAgICAgICBpZiAoZm4pIHtcbiAgICAgICAgICAgICAgICBmbihmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGFyZ3MubGVuZ3RoIDw9IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFyZ3MgPSBhcmdzWzBdO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrLmNhbGwobnVsbCwgZXJyLCBhcmdzKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSwgY2FsbGJhY2spO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHZhciByZXN1bHRzID0ge307XG4gICAgICAgIGVhY2hmbi5lYWNoKGtleXModGFza3MpLCBmdW5jdGlvbiAoaywgY2FsbGJhY2spIHtcbiAgICAgICAgICAgIHRhc2tzW2tdKGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgICAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgICAgICAgICAgICAgaWYgKGFyZ3MubGVuZ3RoIDw9IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgYXJncyA9IGFyZ3NbMF07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJlc3VsdHNba10gPSBhcmdzO1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSwgZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgY2FsbGJhY2soZXJyLCByZXN1bHRzKTtcbiAgICAgICAgfSk7XG4gICAgfVxufTtcblxuZnVuY3Rpb24gc2VyaWVzKHRhc2tzLCBjYWxsYmFjaykge1xuICAgIGNhbGxiYWNrID0gY2FsbGJhY2sgfHwgZnVuY3Rpb24gKCkge307XG4gICAgaWYgKG1pc2MuaXNBcnJheSh0YXNrcykpIHtcbiAgICAgICAgbWFwU2VyaWVzKHRhc2tzLCBmdW5jdGlvbiAoZm4sIGNhbGxiYWNrKSB7XG4gICAgICAgICAgICBpZiAoZm4pIHtcbiAgICAgICAgICAgICAgICBmbihmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGFyZ3MubGVuZ3RoIDw9IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFyZ3MgPSBhcmdzWzBdO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrLmNhbGwobnVsbCwgZXJyLCBhcmdzKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSwgY2FsbGJhY2spO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHZhciByZXN1bHRzID0ge307XG4gICAgICAgIGVhY2hTZXJpZXMoXy5rZXlzKHRhc2tzKSwgZnVuY3Rpb24gKGssIGNhbGxiYWNrKSB7XG4gICAgICAgICAgICB0YXNrc1trXShmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgICAgICAgICAgICAgIGlmIChhcmdzLmxlbmd0aCA8PSAxKSB7XG4gICAgICAgICAgICAgICAgICAgIGFyZ3MgPSBhcmdzWzBdO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXN1bHRzW2tdID0gYXJncztcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0sIGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgIGNhbGxiYWNrKGVyciwgcmVzdWx0cyk7XG4gICAgICAgIH0pO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gb25seV9vbmNlKGZuKSB7XG4gICAgdmFyIGNhbGxlZCA9IGZhbHNlO1xuICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmIChjYWxsZWQpIHRocm93IG5ldyBFcnJvcihcIkNhbGxiYWNrIHdhcyBhbHJlYWR5IGNhbGxlZC5cIik7XG4gICAgICAgIGNhbGxlZCA9IHRydWU7XG4gICAgICAgIGZuLmFwcGx5KHJvb3QsIGFyZ3VtZW50cyk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBwYXJhbGxlbCh0YXNrcywgY2FsbGJhY2spIHtcbiAgICBfcGFyYWxsZWwoe1xuICAgICAgICBtYXA6IG1hcCxcbiAgICAgICAgZWFjaDogZWFjaFxuICAgIH0sIHRhc2tzLCBjYWxsYmFjayk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICAgIHNlcmllczogc2VyaWVzLFxuICAgIHBhcmFsbGVsOiBwYXJhbGxlbFxufTsiLCIvKlxuICogVGhpcyBpcyBhIGNvbGxlY3Rpb24gb2YgdXRpbGl0aWVzIHRha2VuIGZyb20gbGlicmFyaWVzIHN1Y2ggYXMgYXN5bmMuanMsIHVuZGVyc2NvcmUuanMgZXRjLlxuICogQG1vZHVsZSB1dGlsXG4gKi9cblxudmFyIF8gPSByZXF1aXJlKCcuL3VuZGVyc2NvcmUnKSxcbiAgICBhc3luYyA9IHJlcXVpcmUoJy4vYXN5bmMnKSxcbiAgICBtaXNjID0gcmVxdWlyZSgnLi9taXNjJyk7XG5cbl8uZXh0ZW5kKG1vZHVsZS5leHBvcnRzLCB7XG4gICAgXzogXyxcbiAgICBkZWZlcjogcmVxdWlyZSgnLi9wcm9taXNlJyksXG4gICAgYXN5bmM6IGFzeW5jXG59KTtcbl8uZXh0ZW5kKG1vZHVsZS5leHBvcnRzLCBtaXNjKTtcbiIsInZhciBvYnNlcnZlID0gcmVxdWlyZSgnLi4vLi4vdmVuZG9yL29ic2VydmUtanMvc3JjL29ic2VydmUnKS5QbGF0Zm9ybSxcbiAgICBfID0gcmVxdWlyZSgnLi91bmRlcnNjb3JlJyksXG4gICAgSW50ZXJuYWxTaWVzdGFFcnJvciA9IHJlcXVpcmUoJy4vLi4vZXJyb3InKS5JbnRlcm5hbFNpZXN0YUVycm9yO1xuXG4vLyBVc2VkIGJ5IHBhcmFtTmFtZXMgZnVuY3Rpb24uXG52YXIgRk5fQVJHUyA9IC9eZnVuY3Rpb25cXHMqW15cXChdKlxcKFxccyooW15cXCldKilcXCkvbSxcbiAgICBGTl9BUkdfU1BMSVQgPSAvLC8sXG4gICAgRk5fQVJHID0gL15cXHMqKF8/KSguKz8pXFwxXFxzKiQvLFxuICAgIFNUUklQX0NPTU1FTlRTID0gLygoXFwvXFwvLiokKXwoXFwvXFwqW1xcc1xcU10qP1xcKlxcLykpL21nO1xuXG5mdW5jdGlvbiBjYihjYWxsYmFjaywgZGVmZXJyZWQpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24gKGVycikge1xuICAgICAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrLmFwcGx5KGNhbGxiYWNrLCBhcmd1bWVudHMpO1xuICAgICAgICBpZiAoZGVmZXJyZWQpIHtcbiAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICBkZWZlcnJlZC5yZWplY3QoZXJyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGRlZmVycmVkLnJlc29sdmUuYXBwbHkoZGVmZXJyZWQsIEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfTtcbn1cblxudmFyIGlzQXJyYXkgPSBBcnJheS5pc0FycmF5IHx8IGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgcmV0dXJuIF8udG9TdHJpbmcuY2FsbChvYmopID09PSAnW29iamVjdCBBcnJheV0nO1xuXG4gICAgfTtcbnZhciBpc1N0cmluZyA9IGZ1bmN0aW9uIChvKSB7XG4gICAgcmV0dXJuIHR5cGVvZiBvID09ICdzdHJpbmcnIHx8IG8gaW5zdGFuY2VvZiBTdHJpbmdcbn07XG5fLmV4dGVuZChtb2R1bGUuZXhwb3J0cywge1xuICAgIC8qKlxuICAgICAqIFBlcmZvcm1zIGRpcnR5IGNoZWNrL09iamVjdC5vYnNlcnZlIGNhbGxiYWNrcyBkZXBlbmRpbmcgb24gdGhlIGJyb3dzZXIuXG4gICAgICpcbiAgICAgKiBJZiBPYmplY3Qub2JzZXJ2ZSBpcyBwcmVzZW50LFxuICAgICAqIEBwYXJhbSBjYWxsYmFja1xuICAgICAqL1xuICAgIG5leHQ6IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgICAgICBvYnNlcnZlLnBlcmZvcm1NaWNyb3Rhc2tDaGVja3BvaW50KCk7XG4gICAgICAgIHNldFRpbWVvdXQoY2FsbGJhY2spO1xuICAgIH0sXG4gICAgLyoqXG4gICAgICogUmV0dXJucyBhIGhhbmRsZXIgdGhhdCBhY3RzIHVwb24gYSBjYWxsYmFjayBvciBhIHByb21pc2UgZGVwZW5kaW5nIG9uIHRoZSByZXN1bHQgb2YgYSBkaWZmZXJlbnQgY2FsbGJhY2suXG4gICAgICogQHBhcmFtIGNhbGxiYWNrXG4gICAgICogQHBhcmFtIFtkZWZlcnJlZF1cbiAgICAgKiBAcmV0dXJucyB7RnVuY3Rpb259XG4gICAgICovXG4gICAgY2I6IGNiLFxuICAgIGd1aWQ6IChmdW5jdGlvbiAoKSB7XG4gICAgICAgIGZ1bmN0aW9uIHM0KCkge1xuICAgICAgICAgICAgcmV0dXJuIE1hdGguZmxvb3IoKDEgKyBNYXRoLnJhbmRvbSgpKSAqIDB4MTAwMDApXG4gICAgICAgICAgICAgICAgLnRvU3RyaW5nKDE2KVxuICAgICAgICAgICAgICAgIC5zdWJzdHJpbmcoMSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIHM0KCkgKyBzNCgpICsgJy0nICsgczQoKSArICctJyArIHM0KCkgKyAnLScgK1xuICAgICAgICAgICAgICAgIHM0KCkgKyAnLScgKyBzNCgpICsgczQoKSArIHM0KCk7XG4gICAgICAgIH07XG4gICAgfSkoKSxcbiAgICBhc3NlcnQ6IGZ1bmN0aW9uIChjb25kaXRpb24sIG1lc3NhZ2UsIGNvbnRleHQpIHtcbiAgICAgICAgaWYgKCFjb25kaXRpb24pIHtcbiAgICAgICAgICAgIG1lc3NhZ2UgPSBtZXNzYWdlIHx8IFwiQXNzZXJ0aW9uIGZhaWxlZFwiO1xuICAgICAgICAgICAgY29udGV4dCA9IGNvbnRleHQgfHwge307XG4gICAgICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcihtZXNzYWdlLCBjb250ZXh0KTtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgdGhlbkJ5OiAoZnVuY3Rpb24gKCkge1xuICAgICAgICAvKiBtaXhpbiBmb3IgdGhlIGB0aGVuQnlgIHByb3BlcnR5ICovXG4gICAgICAgIGZ1bmN0aW9uIGV4dGVuZChmKSB7XG4gICAgICAgICAgICBmLnRoZW5CeSA9IHRiO1xuICAgICAgICAgICAgcmV0dXJuIGY7XG4gICAgICAgIH1cblxuICAgICAgICAvKiBhZGRzIGEgc2Vjb25kYXJ5IGNvbXBhcmUgZnVuY3Rpb24gdG8gdGhlIHRhcmdldCBmdW5jdGlvbiAoYHRoaXNgIGNvbnRleHQpXG4gICAgICAgICB3aGljaCBpcyBhcHBsaWVkIGluIGNhc2UgdGhlIGZpcnN0IG9uZSByZXR1cm5zIDAgKGVxdWFsKVxuICAgICAgICAgcmV0dXJucyBhIG5ldyBjb21wYXJlIGZ1bmN0aW9uLCB3aGljaCBoYXMgYSBgdGhlbkJ5YCBtZXRob2QgYXMgd2VsbCAqL1xuICAgICAgICBmdW5jdGlvbiB0Yih5KSB7XG4gICAgICAgICAgICB2YXIgeCA9IHRoaXM7XG4gICAgICAgICAgICByZXR1cm4gZXh0ZW5kKGZ1bmN0aW9uIChhLCBiKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHgoYSwgYikgfHwgeShhLCBiKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGV4dGVuZDtcbiAgICB9KSgpLFxuICAgIGRlZmVyOiBmdW5jdGlvbiAoY2IpIHtcbiAgICAgICAgdmFyIGRlZmVycmVkO1xuICAgICAgICBjYiA9IGNiIHx8IGZ1bmN0aW9uICgpIHt9O1xuICAgICAgICBpZiAod2luZG93LnEpIHtcbiAgICAgICAgICAgIGRlZmVycmVkID0gd2luZG93LnEuZGVmZXIoKTtcbiAgICAgICAgICAgIHZhciByZWplY3QgPSBkZWZlcnJlZC5yZWplY3QsXG4gICAgICAgICAgICAgICAgcmVzb2x2ZSA9IGRlZmVycmVkLnJlc29sdmU7XG4gICAgICAgICAgICBfLmV4dGVuZChkZWZlcnJlZCwge1xuICAgICAgICAgICAgICAgIHJlamVjdDogZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgICAgICAgICBjYihlcnIpO1xuICAgICAgICAgICAgICAgICAgICByZWplY3QuY2FsbCh0aGlzLCBlcnIpO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgcmVzb2x2ZTogZnVuY3Rpb24gKHJlcykge1xuICAgICAgICAgICAgICAgICAgICBjYihudWxsLCByZXMpO1xuICAgICAgICAgICAgICAgICAgICByZXNvbHZlLmNhbGwodGhpcywgcmVzKTtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGZpbmlzaDogZnVuY3Rpb24gKGVyciwgcmVzKSB7XG4gICAgICAgICAgICAgICAgICAgIGNiKGVyciwgcmVzKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGVycikgcmVqZWN0LmNhbGwodGhpcywgZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgZWxzZSByZXNvbHZlLmNhbGwodGhpcywgcmVzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGRlZmVycmVkID0ge1xuICAgICAgICAgICAgICAgIHByb21pc2U6IHVuZGVmaW5lZCxcbiAgICAgICAgICAgICAgICByZWplY3Q6IGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgY2IoZXJyKTtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHJlc29sdmU6IGZ1bmN0aW9uIChyZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgY2IobnVsbCwgcmVzKVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgZmluaXNoOiBmdW5jdGlvbiAoZXJyLCByZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgY2IoZXJyLCByZXMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZGVmZXJyZWQ7XG4gICAgfSxcbiAgICBkZWZpbmVTdWJQcm9wZXJ0eTogZnVuY3Rpb24gKHByb3BlcnR5LCBzdWJPYmosIGlubmVyUHJvcGVydHkpIHtcbiAgICAgICAgcmV0dXJuIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCBwcm9wZXJ0eSwge1xuICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgaWYgKGlubmVyUHJvcGVydHkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHN1Yk9ialtpbm5lclByb3BlcnR5XTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBzdWJPYmpbcHJvcGVydHldO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBzZXQ6IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICAgICAgICAgIGlmIChpbm5lclByb3BlcnR5KSB7XG4gICAgICAgICAgICAgICAgICAgIHN1Yk9ialtpbm5lclByb3BlcnR5XSA9IHZhbHVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgc3ViT2JqW3Byb3BlcnR5XSA9IHZhbHVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgICAgIH0pO1xuICAgIH0sXG4gICAgZGVmaW5lU3ViUHJvcGVydHlOb1NldDogZnVuY3Rpb24gKHByb3BlcnR5LCBzdWJPYmosIGlubmVyUHJvcGVydHkpIHtcbiAgICAgICAgcmV0dXJuIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCBwcm9wZXJ0eSwge1xuICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgaWYgKGlubmVyUHJvcGVydHkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHN1Yk9ialtpbm5lclByb3BlcnR5XTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBzdWJPYmpbcHJvcGVydHldO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgICAgIH0pO1xuICAgIH0sXG4gICAgc3ViUHJvcGVydGllczogZnVuY3Rpb24gKG9iaiwgc3ViT2JqLCBwcm9wZXJ0aWVzKSB7XG4gICAgICAgIGlmICghaXNBcnJheShwcm9wZXJ0aWVzKSkge1xuICAgICAgICAgICAgcHJvcGVydGllcyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMik7XG4gICAgICAgIH1cbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBwcm9wZXJ0aWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAoZnVuY3Rpb24gKHByb3BlcnR5KSB7XG4gICAgICAgICAgICAgICAgdmFyIG9wdHMgPSB7XG4gICAgICAgICAgICAgICAgICAgIHNldDogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIG5hbWU6IHByb3BlcnR5LFxuICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0eTogcHJvcGVydHlcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIGlmICghaXNTdHJpbmcocHJvcGVydHkpKSB7XG4gICAgICAgICAgICAgICAgICAgIF8uZXh0ZW5kKG9wdHMsIHByb3BlcnR5KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdmFyIGRlc2MgPSB7XG4gICAgICAgICAgICAgICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHN1Yk9ialtvcHRzLnByb3BlcnR5XTtcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICBpZiAob3B0cy5zZXQpIHtcbiAgICAgICAgICAgICAgICAgICAgZGVzYy5zZXQgPSBmdW5jdGlvbiAodikge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3ViT2JqW29wdHMucHJvcGVydHldID0gdjtcbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG9iaiwgb3B0cy5uYW1lLCBkZXNjKTtcbiAgICAgICAgICAgIH0pKHByb3BlcnRpZXNbaV0pO1xuICAgICAgICB9XG4gICAgfSxcbiAgICBjYXBpdGFsaXNlRmlyc3RMZXR0ZXI6IGZ1bmN0aW9uIChzdHJpbmcpIHtcbiAgICAgICAgcmV0dXJuIHN0cmluZy5jaGFyQXQoMCkudG9VcHBlckNhc2UoKSArIHN0cmluZy5zbGljZSgxKTtcbiAgICB9LFxuICAgIGV4dGVuZEZyb21PcHRzOiBmdW5jdGlvbiAob2JqLCBvcHRzLCBkZWZhdWx0cywgZXJyb3JPblVua25vd24pIHtcbiAgICAgICAgZXJyb3JPblVua25vd24gPSBlcnJvck9uVW5rbm93biA9PSB1bmRlZmluZWQgPyB0cnVlIDogZXJyb3JPblVua25vd247XG4gICAgICAgIGlmIChlcnJvck9uVW5rbm93bikge1xuICAgICAgICAgICAgdmFyIGRlZmF1bHRLZXlzID0gT2JqZWN0LmtleXMoZGVmYXVsdHMpLFxuICAgICAgICAgICAgICAgIG9wdHNLZXlzID0gT2JqZWN0LmtleXMob3B0cyk7XG4gICAgICAgICAgICB2YXIgdW5rbm93bktleXMgPSBvcHRzS2V5cy5maWx0ZXIoZnVuY3Rpb24gKG4pIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZGVmYXVsdEtleXMuaW5kZXhPZihuKSA9PSAtMVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBpZiAodW5rbm93bktleXMubGVuZ3RoKSB0aHJvdyBFcnJvcignVW5rbm93biBvcHRpb25zOiAnICsgdW5rbm93bktleXMudG9TdHJpbmcoKSk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gQXBwbHkgYW55IGZ1bmN0aW9ucyBzcGVjaWZpZWQgaW4gdGhlIGRlZmF1bHRzLlxuICAgICAgICBfLmVhY2goT2JqZWN0LmtleXMoZGVmYXVsdHMpLCBmdW5jdGlvbiAoaykge1xuICAgICAgICAgICAgdmFyIGQgPSBkZWZhdWx0c1trXTtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgZCA9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICAgICAgZGVmYXVsdHNba10gPSBkKG9wdHNba10pO1xuICAgICAgICAgICAgICAgIGRlbGV0ZSBvcHRzW2tdO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgXy5leHRlbmQoZGVmYXVsdHMsIG9wdHMpO1xuICAgICAgICBfLmV4dGVuZChvYmosIGRlZmF1bHRzKTtcbiAgICB9LFxuICAgIGlzU3RyaW5nOiBpc1N0cmluZyxcbiAgICBpc0FycmF5OiBpc0FycmF5LFxuICAgIHByZXR0eVByaW50OiBmdW5jdGlvbiAobykge1xuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkobywgbnVsbCwgNCk7XG4gICAgfSxcbiAgICBmbGF0dGVuQXJyYXk6IGZ1bmN0aW9uIChhcnIpIHtcbiAgICAgICAgcmV0dXJuIF8ucmVkdWNlKGFyciwgZnVuY3Rpb24gKG1lbW8sIGUpIHtcbiAgICAgICAgICAgIGlmIChpc0FycmF5KGUpKSB7XG4gICAgICAgICAgICAgICAgbWVtbyA9IG1lbW8uY29uY2F0KGUpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBtZW1vLnB1c2goZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gbWVtbztcbiAgICAgICAgfSwgW10pO1xuICAgIH0sXG4gICAgdW5mbGF0dGVuQXJyYXk6IGZ1bmN0aW9uIChhcnIsIG1vZGVsQXJyKSB7XG4gICAgICAgIHZhciBuID0gMDtcbiAgICAgICAgdmFyIHVuZmxhdHRlbmVkID0gW107XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbW9kZWxBcnIubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmIChpc0FycmF5KG1vZGVsQXJyW2ldKSkge1xuICAgICAgICAgICAgICAgIHZhciBuZXdBcnIgPSBbXTtcbiAgICAgICAgICAgICAgICB1bmZsYXR0ZW5lZFtpXSA9IG5ld0FycjtcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBqID0gMDsgaiA8IG1vZGVsQXJyW2ldLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICAgICAgICAgIG5ld0Fyci5wdXNoKGFycltuXSk7XG4gICAgICAgICAgICAgICAgICAgIG4rKztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHVuZmxhdHRlbmVkW2ldID0gYXJyW25dO1xuICAgICAgICAgICAgICAgIG4rKztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdW5mbGF0dGVuZWQ7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBSZXR1cm4gdGhlIHBhcmFtZXRlciBuYW1lcyBvZiBhIGZ1bmN0aW9uLlxuICAgICAqIE5vdGU6IGFkYXB0ZWQgZnJvbSBBbmd1bGFySlMgZGVwZW5kZW5jeSBpbmplY3Rpb24gOilcbiAgICAgKiBAcGFyYW0gZm5cbiAgICAgKi9cbiAgICBwYXJhbU5hbWVzOiBmdW5jdGlvbiAoZm4pIHtcbiAgICAgICAgLy8gVE9ETzogSXMgdGhlcmUgYSBtb3JlIHJvYnVzdCB3YXkgb2YgZG9pbmcgdGhpcz9cbiAgICAgICAgdmFyIHBhcmFtcyA9IFtdLFxuICAgICAgICAgICAgZm5UZXh0LFxuICAgICAgICAgICAgYXJnRGVjbDtcbiAgICAgICAgZm5UZXh0ID0gZm4udG9TdHJpbmcoKS5yZXBsYWNlKFNUUklQX0NPTU1FTlRTLCAnJyk7XG4gICAgICAgIGFyZ0RlY2wgPSBmblRleHQubWF0Y2goRk5fQVJHUyk7XG5cbiAgICAgICAgYXJnRGVjbFsxXS5zcGxpdChGTl9BUkdfU1BMSVQpLmZvckVhY2goZnVuY3Rpb24oYXJnKXtcbiAgICAgICAgICAgIGFyZy5yZXBsYWNlKEZOX0FSRywgZnVuY3Rpb24oYWxsLCB1bmRlcnNjb3JlLCBuYW1lKXtcbiAgICAgICAgICAgICAgICBwYXJhbXMucHVzaChuYW1lKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIHBhcmFtcztcbiAgICB9XG59KTsiLCIvKipcbiAqIEEgY3Jhenkgc2ltcGxlIHByb21pc2UgbGlicmFyeS5cbiAqIEBtb2R1bGUgdXRpbC5wcm9taXNlXG4gKi9cblxuZnVuY3Rpb24gcyhwYXNzKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uIChyZXMpIHtcbiAgICAgICAgdGhpcy5yZXMgPSByZXM7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICB0aGlzLnN1Y2Nlc3MuZm9yRWFjaChmdW5jdGlvbiAocykge3MocGFzcyA/IHJlcyA6IHVuZGVmaW5lZCl9KTtcbiAgICAgICAgfVxuICAgICAgICBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICBlLmNhbGwodGhpcywgZXJyKTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuZnVuY3Rpb24gZihlcnIpIHtcbiAgICB0aGlzLl9mYWlsID0gZXJyO1xuICAgIHRoaXMuZXJyb3IgPSBlcnI7XG4gICAgdGhpcy5mYWlsdXJlLmZvckVhY2goZnVuY3Rpb24gKHMpIHtzKGVycil9KTtcbiAgICB0aGlzLmVycm9ycy5mb3JFYWNoKGZ1bmN0aW9uIChzKSB7cyhlcnIpfSk7XG59XG5cbmZ1bmN0aW9uIGUoZXJyKSB7XG4gICAgdGhpcy5lcnJvciA9IGVycjtcbiAgICB0aGlzLmVycm9ycy5mb3JFYWNoKGZ1bmN0aW9uIChzKSB7cyhlcnIpfSk7XG59XG5cbmZ1bmN0aW9uIFByb21pc2UoKSB7XG4gICAgXy5leHRlbmQodGhpcywge1xuICAgICAgICBzdWNjZXNzOiBbXSxcbiAgICAgICAgZmFpbHVyZTogW10sXG4gICAgICAgIGVycm9yczogW10sXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSBQcm9taXNlXG4gICAgICAgICAqL1xuICAgICAgICBfbmV4dFByb21pc2U6IG51bGxcbiAgICB9KTtcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgJ25leHRQcm9taXNlJywge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5fbmV4dFByb21pc2UpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9uZXh0UHJvbWlzZSA9IG5ldyBQcm9taXNlKCk7XG4gICAgICAgICAgICAgICAgdGhpcy5zdWNjZXNzLnB1c2gocyhmYWxzZSkuYmluZCh0aGlzLl9uZXh0UHJvbWlzZSkpO1xuICAgICAgICAgICAgICAgIHRoaXMuZmFpbHVyZS5wdXNoKGYuYmluZCh0aGlzLl9uZXh0UHJvbWlzZSkpO1xuICAgICAgICAgICAgICAgIHRoaXMuZXJyb3JzLnB1c2goZS5iaW5kKHRoaXMuX25leHRQcm9taXNlKSk7XG4gICAgICAgICAgICAgICAgdGhpcy5fbmV4dFByb21pc2UuX2ZhaWwgPSB0aGlzLl9mYWlsO1xuICAgICAgICAgICAgICAgIHRoaXMuX25leHRQcm9taXNlLmVycm9yID0gdGhpcy5lcnJvcjtcbiAgICAgICAgICAgICAgICB0aGlzLl9uZXh0UHJvbWlzZS5yZXMgPSB0aGlzLnJlcztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9uZXh0UHJvbWlzZTtcbiAgICAgICAgfVxuICAgIH0pO1xufVxudmFyIGZhaWwgPSBmdW5jdGlvbiAoZXJyb3IpIHtcbiAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgaWYgKHRoaXMuZXJyb3IpIGVycm9yKHRoaXMuZXJyb3IpO1xuICAgICAgICBlbHNlIHRoaXMuZXJyb3JzLnB1c2goZXJyb3IpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5uZXh0UHJvbWlzZTtcbn07XG5fLmV4dGVuZChQcm9taXNlLnByb3RvdHlwZSwge1xuICAgIHRoZW46IGZ1bmN0aW9uIChzdWNjZXNzLCBmYWlsdXJlKSB7XG4gICAgICAgIGlmIChzdWNjZXNzKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5yZXMpIHN1Y2Nlc3ModGhpcy5yZXMpO1xuICAgICAgICAgICAgZWxzZSB0aGlzLnN1Y2Nlc3MucHVzaChzdWNjZXNzKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZmFpbHVyZSkge1xuICAgICAgICAgICAgaWYgKHRoaXMuX2ZhaWwpIGZhaWx1cmUodGhpcy5fZmFpbCk7XG4gICAgICAgICAgICBlbHNlIHRoaXMuZmFpbHVyZS5wdXNoKGZhaWx1cmUpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLm5leHRQcm9taXNlO1xuICAgIH0sXG4gICAgY2F0Y2g6IGZhaWwsXG4gICAgZmFpbDogZmFpbCxcbiAgICBkb25lOiBmdW5jdGlvbiAoc3VjY2VzcywgZmFpbHVyZSkge1xuICAgICAgICB0aGlzLnRoZW4oc3VjY2VzcykuY2F0Y2goZmFpbHVyZSk7XG4gICAgfVxufSk7XG5cbmZ1bmN0aW9uIERlZmVycmVkKGNiKSB7XG4gICAgXy5leHRlbmQodGhpcywge1xuICAgICAgICBjYjogY2IgfHwgZnVuY3Rpb24gKCkge30sXG4gICAgICAgIHByb21pc2U6IG5ldyBQcm9taXNlKClcbiAgICB9KTtcbn1cblxuXy5leHRlbmQoRGVmZXJyZWQucHJvdG90eXBlLCB7XG4gICAgcmVzb2x2ZTogZnVuY3Rpb24gKHJlcykge1xuICAgICAgICBzKHRydWUpLmNhbGwodGhpcy5wcm9taXNlLCByZXMpO1xuICAgICAgICB0aGlzLmNiKG51bGwsIHJlcyk7XG4gICAgfSxcbiAgICByZWplY3Q6IGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgZi5jYWxsKHRoaXMucHJvbWlzZSwgZXJyKTtcbiAgICAgICAgdGhpcy5jYihlcnIgPyBlcnIgOiB0cnVlKTtcbiAgICB9LFxuICAgIGZpbmlzaDogZnVuY3Rpb24gKGVyciwgcmVzKSB7XG4gICAgICAgIGlmICh0aGlzID09IHdpbmRvdykgdGhyb3cgJ3d0Zic7XG4gICAgICAgIGlmIChlcnIpIHRoaXMucmVqZWN0KGVycik7XG4gICAgICAgIGVsc2UgdGhpcy5yZXNvbHZlKHJlcyk7XG4gICAgfVxufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKGNiKSB7XG4gICAgcmV0dXJuIG5ldyBEZWZlcnJlZChjYik7XG59OyIsIi8qKlxuICogT2Z0ZW4gdXNlZCBmdW5jdGlvbnMgZnJvbSB1bmRlcnNjb3JlLCBwdWxsZWQgb3V0IGZvciBicmV2aXR5LlxuICogQG1vZHVsZSB1bmRlcnNjb3JlXG4gKi9cblxudmFyIF8gPSB7fSxcbiAgICBBcnJheVByb3RvID0gQXJyYXkucHJvdG90eXBlLFxuICAgIEZ1bmNQcm90byA9IEZ1bmN0aW9uLnByb3RvdHlwZSxcbiAgICBuYXRpdmVGb3JFYWNoID0gQXJyYXlQcm90by5mb3JFYWNoLFxuICAgIG5hdGl2ZU1hcCA9IEFycmF5UHJvdG8ubWFwLFxuICAgIG5hdGl2ZVJlZHVjZSA9IEFycmF5UHJvdG8ucmVkdWNlLFxuICAgIG5hdGl2ZUJpbmQgPSBGdW5jUHJvdG8uYmluZCxcbiAgICBzbGljZSA9IEFycmF5UHJvdG8uc2xpY2UsXG4gICAgYnJlYWtlciA9IHt9LFxuICAgIGN0b3IgPSBmdW5jdGlvbiAoKSB7fTtcblxuZnVuY3Rpb24ga2V5cyhvYmopIHtcbiAgICBpZiAoT2JqZWN0LmtleXMpIHtcbiAgICAgICAgcmV0dXJuIE9iamVjdC5rZXlzKG9iaik7XG4gICAgfVxuICAgIHZhciBrZXlzID0gW107XG4gICAgZm9yICh2YXIgayBpbiBvYmopIHtcbiAgICAgICAgaWYgKG9iai5oYXNPd25Qcm9wZXJ0eShrKSkge1xuICAgICAgICAgICAga2V5cy5wdXNoKGspO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBrZXlzO1xufVxuXG5fLmtleXMgPSBrZXlzO1xuXG5fLmVhY2ggPSBfLmZvckVhY2ggPSBmdW5jdGlvbiAob2JqLCBpdGVyYXRvciwgY29udGV4dCkge1xuICAgIGlmIChvYmogPT0gbnVsbCkgcmV0dXJuIG9iajtcbiAgICBpZiAobmF0aXZlRm9yRWFjaCAmJiBvYmouZm9yRWFjaCA9PT0gbmF0aXZlRm9yRWFjaCkge1xuICAgICAgICBvYmouZm9yRWFjaChpdGVyYXRvciwgY29udGV4dCk7XG4gICAgfSBlbHNlIGlmIChvYmoubGVuZ3RoID09PSArb2JqLmxlbmd0aCkge1xuICAgICAgICBmb3IgKHZhciBpID0gMCwgbGVuZ3RoID0gb2JqLmxlbmd0aDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAoaXRlcmF0b3IuY2FsbChjb250ZXh0LCBvYmpbaV0sIGksIG9iaikgPT09IGJyZWFrZXIpIHJldHVybjtcbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIHZhciBrZXlzID0gXy5rZXlzKG9iaik7XG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBsZW5ndGggPSBrZXlzLmxlbmd0aDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAoaXRlcmF0b3IuY2FsbChjb250ZXh0LCBvYmpba2V5c1tpXV0sIGtleXNbaV0sIG9iaikgPT09IGJyZWFrZXIpIHJldHVybjtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gb2JqO1xufTtcblxuLy8gUmV0dXJuIHRoZSByZXN1bHRzIG9mIGFwcGx5aW5nIHRoZSBpdGVyYXRvciB0byBlYWNoIGVsZW1lbnQuXG4vLyBEZWxlZ2F0ZXMgdG8gKipFQ01BU2NyaXB0IDUqKidzIG5hdGl2ZSBgbWFwYCBpZiBhdmFpbGFibGUuXG5fLm1hcCA9IF8uY29sbGVjdCA9IGZ1bmN0aW9uIChvYmosIGl0ZXJhdG9yLCBjb250ZXh0KSB7XG4gICAgdmFyIHJlc3VsdHMgPSBbXTtcbiAgICBpZiAob2JqID09IG51bGwpIHJldHVybiByZXN1bHRzO1xuICAgIGlmIChuYXRpdmVNYXAgJiYgb2JqLm1hcCA9PT0gbmF0aXZlTWFwKSByZXR1cm4gb2JqLm1hcChpdGVyYXRvciwgY29udGV4dCk7XG4gICAgXy5lYWNoKG9iaiwgZnVuY3Rpb24gKHZhbHVlLCBpbmRleCwgbGlzdCkge1xuICAgICAgICByZXN1bHRzLnB1c2goaXRlcmF0b3IuY2FsbChjb250ZXh0LCB2YWx1ZSwgaW5kZXgsIGxpc3QpKTtcbiAgICB9KTtcbiAgICByZXR1cm4gcmVzdWx0cztcbn07XG5cbi8vIFBhcnRpYWxseSBhcHBseSBhIGZ1bmN0aW9uIGJ5IGNyZWF0aW5nIGEgdmVyc2lvbiB0aGF0IGhhcyBoYWQgc29tZSBvZiBpdHNcbi8vIGFyZ3VtZW50cyBwcmUtZmlsbGVkLCB3aXRob3V0IGNoYW5naW5nIGl0cyBkeW5hbWljIGB0aGlzYCBjb250ZXh0LiBfIGFjdHNcbi8vIGFzIGEgcGxhY2Vob2xkZXIsIGFsbG93aW5nIGFueSBjb21iaW5hdGlvbiBvZiBhcmd1bWVudHMgdG8gYmUgcHJlLWZpbGxlZC5cbl8ucGFydGlhbCA9IGZ1bmN0aW9uIChmdW5jKSB7XG4gICAgdmFyIGJvdW5kQXJncyA9IHNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgcG9zaXRpb24gPSAwO1xuICAgICAgICB2YXIgYXJncyA9IGJvdW5kQXJncy5zbGljZSgpO1xuICAgICAgICBmb3IgKHZhciBpID0gMCwgbGVuZ3RoID0gYXJncy5sZW5ndGg7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaWYgKGFyZ3NbaV0gPT09IF8pIGFyZ3NbaV0gPSBhcmd1bWVudHNbcG9zaXRpb24rK107XG4gICAgICAgIH1cbiAgICAgICAgd2hpbGUgKHBvc2l0aW9uIDwgYXJndW1lbnRzLmxlbmd0aCkgYXJncy5wdXNoKGFyZ3VtZW50c1twb3NpdGlvbisrXSk7XG4gICAgICAgIHJldHVybiBmdW5jLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgIH07XG59O1xuXG4vLyBDb252ZW5pZW5jZSB2ZXJzaW9uIG9mIGEgY29tbW9uIHVzZSBjYXNlIG9mIGBtYXBgOiBmZXRjaGluZyBhIHByb3BlcnR5LlxuXy5wbHVjayA9IGZ1bmN0aW9uIChvYmosIGtleSkge1xuICAgIHJldHVybiBfLm1hcChvYmosIF8ucHJvcGVydHkoa2V5KSk7XG59O1xuXG52YXIgcmVkdWNlRXJyb3IgPSAnUmVkdWNlIG9mIGVtcHR5IGFycmF5IHdpdGggbm8gaW5pdGlhbCB2YWx1ZSc7XG5cbi8vICoqUmVkdWNlKiogYnVpbGRzIHVwIGEgc2luZ2xlIHJlc3VsdCBmcm9tIGEgbGlzdCBvZiB2YWx1ZXMsIGFrYSBgaW5qZWN0YCxcbi8vIG9yIGBmb2xkbGAuIERlbGVnYXRlcyB0byAqKkVDTUFTY3JpcHQgNSoqJ3MgbmF0aXZlIGByZWR1Y2VgIGlmIGF2YWlsYWJsZS5cbl8ucmVkdWNlID0gXy5mb2xkbCA9IF8uaW5qZWN0ID0gZnVuY3Rpb24gKG9iaiwgaXRlcmF0b3IsIG1lbW8sIGNvbnRleHQpIHtcbiAgICB2YXIgaW5pdGlhbCA9IGFyZ3VtZW50cy5sZW5ndGggPiAyO1xuICAgIGlmIChvYmogPT0gbnVsbCkgb2JqID0gW107XG4gICAgaWYgKG5hdGl2ZVJlZHVjZSAmJiBvYmoucmVkdWNlID09PSBuYXRpdmVSZWR1Y2UpIHtcbiAgICAgICAgaWYgKGNvbnRleHQpIGl0ZXJhdG9yID0gXy5iaW5kKGl0ZXJhdG9yLCBjb250ZXh0KTtcbiAgICAgICAgcmV0dXJuIGluaXRpYWwgPyBvYmoucmVkdWNlKGl0ZXJhdG9yLCBtZW1vKSA6IG9iai5yZWR1Y2UoaXRlcmF0b3IpO1xuICAgIH1cbiAgICBfLmVhY2gob2JqLCBmdW5jdGlvbiAodmFsdWUsIGluZGV4LCBsaXN0KSB7XG4gICAgICAgIGlmICghaW5pdGlhbCkge1xuICAgICAgICAgICAgbWVtbyA9IHZhbHVlO1xuICAgICAgICAgICAgaW5pdGlhbCA9IHRydWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBtZW1vID0gaXRlcmF0b3IuY2FsbChjb250ZXh0LCBtZW1vLCB2YWx1ZSwgaW5kZXgsIGxpc3QpO1xuICAgICAgICB9XG4gICAgfSk7XG4gICAgaWYgKCFpbml0aWFsKSB0aHJvdyBuZXcgVHlwZUVycm9yKHJlZHVjZUVycm9yKTtcbiAgICByZXR1cm4gbWVtbztcbn07XG5cbl8ucHJvcGVydHkgPSBmdW5jdGlvbiAoa2V5KSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgcmV0dXJuIG9ialtrZXldO1xuICAgIH07XG59O1xuXG4vLyBPcHRpbWl6ZSBgaXNGdW5jdGlvbmAgaWYgYXBwcm9wcmlhdGUuXG5pZiAodHlwZW9mKC8uLykgIT09ICdmdW5jdGlvbicpIHtcbiAgICBfLmlzRnVuY3Rpb24gPSBmdW5jdGlvbiAob2JqKSB7XG4gICAgICAgIHJldHVybiB0eXBlb2Ygb2JqID09PSAnZnVuY3Rpb24nO1xuICAgIH07XG59XG5cbl8uaXNPYmplY3QgPSBmdW5jdGlvbiAob2JqKSB7XG4gICAgdmFyIHR5cGUgPSB0eXBlb2Ygb2JqO1xuICAgIHJldHVybiB0eXBlID09PSAnZnVuY3Rpb24nIHx8IHR5cGUgPT09ICdvYmplY3QnICYmICEhb2JqO1xufTtcblxuLy8gQW4gaW50ZXJuYWwgZnVuY3Rpb24gdG8gZ2VuZXJhdGUgbG9va3VwIGl0ZXJhdG9ycy5cbnZhciBsb29rdXBJdGVyYXRvciA9IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgIGlmICh2YWx1ZSA9PSBudWxsKSByZXR1cm4gXy5pZGVudGl0eTtcbiAgICBpZiAoXy5pc0Z1bmN0aW9uKHZhbHVlKSkgcmV0dXJuIHZhbHVlO1xuICAgIHJldHVybiBfLnByb3BlcnR5KHZhbHVlKTtcbn07XG5cbi8vIFNvcnQgdGhlIG9iamVjdCdzIHZhbHVlcyBieSBhIGNyaXRlcmlvbiBwcm9kdWNlZCBieSBhbiBpdGVyYXRvci5cbl8uc29ydEJ5ID0gZnVuY3Rpb24gKG9iaiwgaXRlcmF0b3IsIGNvbnRleHQpIHtcbiAgICBpdGVyYXRvciA9IGxvb2t1cEl0ZXJhdG9yKGl0ZXJhdG9yKTtcbiAgICByZXR1cm4gXy5wbHVjayhfLm1hcChvYmosIGZ1bmN0aW9uICh2YWx1ZSwgaW5kZXgsIGxpc3QpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHZhbHVlOiB2YWx1ZSxcbiAgICAgICAgICAgIGluZGV4OiBpbmRleCxcbiAgICAgICAgICAgIGNyaXRlcmlhOiBpdGVyYXRvci5jYWxsKGNvbnRleHQsIHZhbHVlLCBpbmRleCwgbGlzdClcbiAgICAgICAgfTtcbiAgICB9KS5zb3J0KGZ1bmN0aW9uIChsZWZ0LCByaWdodCkge1xuICAgICAgICB2YXIgYSA9IGxlZnQuY3JpdGVyaWE7XG4gICAgICAgIHZhciBiID0gcmlnaHQuY3JpdGVyaWE7XG4gICAgICAgIGlmIChhICE9PSBiKSB7XG4gICAgICAgICAgICBpZiAoYSA+IGIgfHwgYSA9PT0gdm9pZCAwKSByZXR1cm4gMTtcbiAgICAgICAgICAgIGlmIChhIDwgYiB8fCBiID09PSB2b2lkIDApIHJldHVybiAtMTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbGVmdC5pbmRleCAtIHJpZ2h0LmluZGV4O1xuICAgIH0pLCAndmFsdWUnKTtcbn07XG5cblxuLy8gQ3JlYXRlIGEgZnVuY3Rpb24gYm91bmQgdG8gYSBnaXZlbiBvYmplY3QgKGFzc2lnbmluZyBgdGhpc2AsIGFuZCBhcmd1bWVudHMsXG4vLyBvcHRpb25hbGx5KS4gRGVsZWdhdGVzIHRvICoqRUNNQVNjcmlwdCA1KioncyBuYXRpdmUgYEZ1bmN0aW9uLmJpbmRgIGlmXG4vLyBhdmFpbGFibGUuXG5fLmJpbmQgPSBmdW5jdGlvbiAoZnVuYywgY29udGV4dCkge1xuICAgIHZhciBhcmdzLCBib3VuZDtcbiAgICBpZiAobmF0aXZlQmluZCAmJiBmdW5jLmJpbmQgPT09IG5hdGl2ZUJpbmQpIHJldHVybiBuYXRpdmVCaW5kLmFwcGx5KGZ1bmMsIHNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKSk7XG4gICAgaWYgKCFfLmlzRnVuY3Rpb24oZnVuYykpIHRocm93IG5ldyBUeXBlRXJyb3I7XG4gICAgYXJncyA9IHNsaWNlLmNhbGwoYXJndW1lbnRzLCAyKTtcbiAgICByZXR1cm4gYm91bmQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmICghKHRoaXMgaW5zdGFuY2VvZiBib3VuZCkpIHJldHVybiBmdW5jLmFwcGx5KGNvbnRleHQsIGFyZ3MuY29uY2F0KHNsaWNlLmNhbGwoYXJndW1lbnRzKSkpO1xuICAgICAgICBjdG9yLnByb3RvdHlwZSA9IGZ1bmMucHJvdG90eXBlO1xuICAgICAgICB2YXIgc2VsZiA9IG5ldyBjdG9yO1xuICAgICAgICBjdG9yLnByb3RvdHlwZSA9IG51bGw7XG4gICAgICAgIHVcbiAgICAgICAgdmFyIHJlc3VsdCA9IGZ1bmMuYXBwbHkoc2VsZiwgYXJncy5jb25jYXQoc2xpY2UuY2FsbChhcmd1bWVudHMpKSk7XG4gICAgICAgIGlmIChPYmplY3QocmVzdWx0KSA9PT0gcmVzdWx0KSByZXR1cm4gcmVzdWx0O1xuICAgICAgICByZXR1cm4gc2VsZjtcbiAgICB9O1xufTtcblxuXy5pZGVudGl0eSA9IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgIHJldHVybiB2YWx1ZTtcbn07XG5cbl8uemlwID0gZnVuY3Rpb24gKGFycmF5KSB7XG4gICAgaWYgKGFycmF5ID09IG51bGwpIHJldHVybiBbXTtcbiAgICB2YXIgbGVuZ3RoID0gXy5tYXgoYXJndW1lbnRzLCAnbGVuZ3RoJykubGVuZ3RoO1xuICAgIHZhciByZXN1bHRzID0gQXJyYXkobGVuZ3RoKTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHJlc3VsdHNbaV0gPSBfLnBsdWNrKGFyZ3VtZW50cywgaSk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHRzO1xufTtcblxuLy8gUmV0dXJuIHRoZSBtYXhpbXVtIGVsZW1lbnQgKG9yIGVsZW1lbnQtYmFzZWQgY29tcHV0YXRpb24pLlxuXy5tYXggPSBmdW5jdGlvbiAob2JqLCBpdGVyYXRlZSwgY29udGV4dCkge1xuICAgIHZhciByZXN1bHQgPSAtSW5maW5pdHksXG4gICAgICAgIGxhc3RDb21wdXRlZCA9IC1JbmZpbml0eSxcbiAgICAgICAgdmFsdWUsIGNvbXB1dGVkO1xuICAgIGlmIChpdGVyYXRlZSA9PSBudWxsICYmIG9iaiAhPSBudWxsKSB7XG4gICAgICAgIG9iaiA9IG9iai5sZW5ndGggPT09ICtvYmoubGVuZ3RoID8gb2JqIDogXy52YWx1ZXMob2JqKTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbmd0aCA9IG9iai5sZW5ndGg7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdmFsdWUgPSBvYmpbaV07XG4gICAgICAgICAgICBpZiAodmFsdWUgPiByZXN1bHQpIHtcbiAgICAgICAgICAgICAgICByZXN1bHQgPSB2YWx1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIGl0ZXJhdGVlID0gXy5pdGVyYXRlZShpdGVyYXRlZSwgY29udGV4dCk7XG4gICAgICAgIF8uZWFjaChvYmosIGZ1bmN0aW9uICh2YWx1ZSwgaW5kZXgsIGxpc3QpIHtcbiAgICAgICAgICAgIGNvbXB1dGVkID0gaXRlcmF0ZWUodmFsdWUsIGluZGV4LCBsaXN0KTtcbiAgICAgICAgICAgIGlmIChjb21wdXRlZCA+IGxhc3RDb21wdXRlZCB8fCBjb21wdXRlZCA9PT0gLUluZmluaXR5ICYmIHJlc3VsdCA9PT0gLUluZmluaXR5KSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0ID0gdmFsdWU7XG4gICAgICAgICAgICAgICAgbGFzdENvbXB1dGVkID0gY29tcHV0ZWQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xufTtcblxuXG5fLml0ZXJhdGVlID0gZnVuY3Rpb24gKHZhbHVlLCBjb250ZXh0LCBhcmdDb3VudCkge1xuICAgIGlmICh2YWx1ZSA9PSBudWxsKSByZXR1cm4gXy5pZGVudGl0eTtcbiAgICBpZiAoXy5pc0Z1bmN0aW9uKHZhbHVlKSkgcmV0dXJuIGNyZWF0ZUNhbGxiYWNrKHZhbHVlLCBjb250ZXh0LCBhcmdDb3VudCk7XG4gICAgaWYgKF8uaXNPYmplY3QodmFsdWUpKSByZXR1cm4gXy5tYXRjaGVzKHZhbHVlKTtcbiAgICByZXR1cm4gXy5wcm9wZXJ0eSh2YWx1ZSk7XG59O1xuXG5fLnBhaXJzID0gZnVuY3Rpb24gKG9iaikge1xuICAgIHZhciBrZXlzID0gXy5rZXlzKG9iaik7XG4gICAgdmFyIGxlbmd0aCA9IGtleXMubGVuZ3RoO1xuICAgIHZhciBwYWlycyA9IEFycmF5KGxlbmd0aCk7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgICBwYWlyc1tpXSA9IFtrZXlzW2ldLCBvYmpba2V5c1tpXV1dO1xuICAgIH1cbiAgICByZXR1cm4gcGFpcnM7XG59O1xuXG5fLm1hdGNoZXMgPSBmdW5jdGlvbiAoYXR0cnMpIHtcbiAgICB2YXIgcGFpcnMgPSBfLnBhaXJzKGF0dHJzKSxcbiAgICAgICAgbGVuZ3RoID0gcGFpcnMubGVuZ3RoO1xuICAgIHJldHVybiBmdW5jdGlvbiAob2JqKSB7XG4gICAgICAgIGlmIChvYmogPT0gbnVsbCkgcmV0dXJuICFsZW5ndGg7XG4gICAgICAgIG9iaiA9IG5ldyBPYmplY3Qob2JqKTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdmFyIHBhaXIgPSBwYWlyc1tpXSxcbiAgICAgICAgICAgICAgICBrZXkgPSBwYWlyWzBdO1xuICAgICAgICAgICAgaWYgKHBhaXJbMV0gIT09IG9ialtrZXldIHx8ICEoa2V5IGluIG9iaikpIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9O1xufTtcblxuXy5zb21lID0gZnVuY3Rpb24gKG9iaiwgcHJlZGljYXRlLCBjb250ZXh0KSB7XG4gICAgaWYgKG9iaiA9PSBudWxsKSByZXR1cm4gZmFsc2U7XG4gICAgcHJlZGljYXRlID0gXy5pdGVyYXRlZShwcmVkaWNhdGUsIGNvbnRleHQpO1xuICAgIHZhciBrZXlzID0gb2JqLmxlbmd0aCAhPT0gK29iai5sZW5ndGggJiYgXy5rZXlzKG9iaiksXG4gICAgICAgIGxlbmd0aCA9IChrZXlzIHx8IG9iaikubGVuZ3RoLFxuICAgICAgICBpbmRleCwgY3VycmVudEtleTtcbiAgICBmb3IgKGluZGV4ID0gMDsgaW5kZXggPCBsZW5ndGg7IGluZGV4KyspIHtcbiAgICAgICAgY3VycmVudEtleSA9IGtleXMgPyBrZXlzW2luZGV4XSA6IGluZGV4O1xuICAgICAgICBpZiAocHJlZGljYXRlKG9ialtjdXJyZW50S2V5XSwgY3VycmVudEtleSwgb2JqKSkgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbn07XG5cblxuLy8gRXh0ZW5kIGEgZ2l2ZW4gb2JqZWN0IHdpdGggYWxsIHRoZSBwcm9wZXJ0aWVzIGluIHBhc3NlZC1pbiBvYmplY3QocykuXG5fLmV4dGVuZCA9IGZ1bmN0aW9uIChvYmopIHtcbiAgICBpZiAoIV8uaXNPYmplY3Qob2JqKSkgcmV0dXJuIG9iajtcbiAgICB2YXIgc291cmNlLCBwcm9wO1xuICAgIGZvciAodmFyIGkgPSAxLCBsZW5ndGggPSBhcmd1bWVudHMubGVuZ3RoOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgc291cmNlID0gYXJndW1lbnRzW2ldO1xuICAgICAgICBmb3IgKHByb3AgaW4gc291cmNlKSB7XG4gICAgICAgICAgICAvL25vaW5zcGVjdGlvbiBKU1VuZmlsdGVyZWRGb3JJbkxvb3BcbiAgICAgICAgICAgIGlmIChoYXNPd25Qcm9wZXJ0eS5jYWxsKHNvdXJjZSwgcHJvcCkpIHtcbiAgICAgICAgICAgICAgICAvL25vaW5zcGVjdGlvbiBKU1VuZmlsdGVyZWRGb3JJbkxvb3BcbiAgICAgICAgICAgICAgICBvYmpbcHJvcF0gPSBzb3VyY2VbcHJvcF07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG9iajtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gXzsiLCIvLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxuZnVuY3Rpb24gRXZlbnRFbWl0dGVyKCkge1xuICB0aGlzLl9ldmVudHMgPSB0aGlzLl9ldmVudHMgfHwge307XG4gIHRoaXMuX21heExpc3RlbmVycyA9IHRoaXMuX21heExpc3RlbmVycyB8fCB1bmRlZmluZWQ7XG59XG5tb2R1bGUuZXhwb3J0cyA9IEV2ZW50RW1pdHRlcjtcblxuLy8gQmFja3dhcmRzLWNvbXBhdCB3aXRoIG5vZGUgMC4xMC54XG5FdmVudEVtaXR0ZXIuRXZlbnRFbWl0dGVyID0gRXZlbnRFbWl0dGVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9ldmVudHMgPSB1bmRlZmluZWQ7XG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9tYXhMaXN0ZW5lcnMgPSB1bmRlZmluZWQ7XG5cbi8vIEJ5IGRlZmF1bHQgRXZlbnRFbWl0dGVycyB3aWxsIHByaW50IGEgd2FybmluZyBpZiBtb3JlIHRoYW4gMTAgbGlzdGVuZXJzIGFyZVxuLy8gYWRkZWQgdG8gaXQuIFRoaXMgaXMgYSB1c2VmdWwgZGVmYXVsdCB3aGljaCBoZWxwcyBmaW5kaW5nIG1lbW9yeSBsZWFrcy5cbkV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzID0gMTA7XG5cbi8vIE9idmlvdXNseSBub3QgYWxsIEVtaXR0ZXJzIHNob3VsZCBiZSBsaW1pdGVkIHRvIDEwLiBUaGlzIGZ1bmN0aW9uIGFsbG93c1xuLy8gdGhhdCB0byBiZSBpbmNyZWFzZWQuIFNldCB0byB6ZXJvIGZvciB1bmxpbWl0ZWQuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnNldE1heExpc3RlbmVycyA9IGZ1bmN0aW9uKG4pIHtcbiAgaWYgKCFpc051bWJlcihuKSB8fCBuIDwgMCB8fCBpc05hTihuKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ24gbXVzdCBiZSBhIHBvc2l0aXZlIG51bWJlcicpO1xuICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSBuO1xuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuZW1pdCA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIGVyLCBoYW5kbGVyLCBsZW4sIGFyZ3MsIGksIGxpc3RlbmVycztcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcblxuICAvLyBJZiB0aGVyZSBpcyBubyAnZXJyb3InIGV2ZW50IGxpc3RlbmVyIHRoZW4gdGhyb3cuXG4gIGlmICh0eXBlID09PSAnZXJyb3InKSB7XG4gICAgaWYgKCF0aGlzLl9ldmVudHMuZXJyb3IgfHxcbiAgICAgICAgKGlzT2JqZWN0KHRoaXMuX2V2ZW50cy5lcnJvcikgJiYgIXRoaXMuX2V2ZW50cy5lcnJvci5sZW5ndGgpKSB7XG4gICAgICBlciA9IGFyZ3VtZW50c1sxXTtcbiAgICAgIGlmIChlciBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICAgIHRocm93IGVyOyAvLyBVbmhhbmRsZWQgJ2Vycm9yJyBldmVudFxuICAgICAgfVxuICAgICAgdGhyb3cgVHlwZUVycm9yKCdVbmNhdWdodCwgdW5zcGVjaWZpZWQgXCJlcnJvclwiIGV2ZW50LicpO1xuICAgIH1cbiAgfVxuXG4gIGhhbmRsZXIgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgaWYgKGlzVW5kZWZpbmVkKGhhbmRsZXIpKVxuICAgIHJldHVybiBmYWxzZTtcblxuICBpZiAoaXNGdW5jdGlvbihoYW5kbGVyKSkge1xuICAgIHN3aXRjaCAoYXJndW1lbnRzLmxlbmd0aCkge1xuICAgICAgLy8gZmFzdCBjYXNlc1xuICAgICAgY2FzZSAxOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcyk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAyOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDM6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0sIGFyZ3VtZW50c1syXSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgLy8gc2xvd2VyXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBsZW4gPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgICAgICBhcmdzID0gbmV3IEFycmF5KGxlbiAtIDEpO1xuICAgICAgICBmb3IgKGkgPSAxOyBpIDwgbGVuOyBpKyspXG4gICAgICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG4gICAgICAgIGhhbmRsZXIuYXBwbHkodGhpcywgYXJncyk7XG4gICAgfVxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGhhbmRsZXIpKSB7XG4gICAgbGVuID0gYXJndW1lbnRzLmxlbmd0aDtcbiAgICBhcmdzID0gbmV3IEFycmF5KGxlbiAtIDEpO1xuICAgIGZvciAoaSA9IDE7IGkgPCBsZW47IGkrKylcbiAgICAgIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuXG4gICAgbGlzdGVuZXJzID0gaGFuZGxlci5zbGljZSgpO1xuICAgIGxlbiA9IGxpc3RlbmVycy5sZW5ndGg7XG4gICAgZm9yIChpID0gMDsgaSA8IGxlbjsgaSsrKVxuICAgICAgbGlzdGVuZXJzW2ldLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICB9XG5cbiAgcmV0dXJuIHRydWU7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgdmFyIG07XG5cbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuXG4gIC8vIFRvIGF2b2lkIHJlY3Vyc2lvbiBpbiB0aGUgY2FzZSB0aGF0IHR5cGUgPT09IFwibmV3TGlzdGVuZXJcIiEgQmVmb3JlXG4gIC8vIGFkZGluZyBpdCB0byB0aGUgbGlzdGVuZXJzLCBmaXJzdCBlbWl0IFwibmV3TGlzdGVuZXJcIi5cbiAgaWYgKHRoaXMuX2V2ZW50cy5uZXdMaXN0ZW5lcilcbiAgICB0aGlzLmVtaXQoJ25ld0xpc3RlbmVyJywgdHlwZSxcbiAgICAgICAgICAgICAgaXNGdW5jdGlvbihsaXN0ZW5lci5saXN0ZW5lcikgP1xuICAgICAgICAgICAgICBsaXN0ZW5lci5saXN0ZW5lciA6IGxpc3RlbmVyKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICAvLyBPcHRpbWl6ZSB0aGUgY2FzZSBvZiBvbmUgbGlzdGVuZXIuIERvbid0IG5lZWQgdGhlIGV4dHJhIGFycmF5IG9iamVjdC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBsaXN0ZW5lcjtcbiAgZWxzZSBpZiAoaXNPYmplY3QodGhpcy5fZXZlbnRzW3R5cGVdKSlcbiAgICAvLyBJZiB3ZSd2ZSBhbHJlYWR5IGdvdCBhbiBhcnJheSwganVzdCBhcHBlbmQuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdLnB1c2gobGlzdGVuZXIpO1xuICBlbHNlXG4gICAgLy8gQWRkaW5nIHRoZSBzZWNvbmQgZWxlbWVudCwgbmVlZCB0byBjaGFuZ2UgdG8gYXJyYXkuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gW3RoaXMuX2V2ZW50c1t0eXBlXSwgbGlzdGVuZXJdO1xuXG4gIC8vIENoZWNrIGZvciBsaXN0ZW5lciBsZWFrXG4gIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pICYmICF0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkKSB7XG4gICAgdmFyIG07XG4gICAgaWYgKCFpc1VuZGVmaW5lZCh0aGlzLl9tYXhMaXN0ZW5lcnMpKSB7XG4gICAgICBtID0gdGhpcy5fbWF4TGlzdGVuZXJzO1xuICAgIH0gZWxzZSB7XG4gICAgICBtID0gRXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnM7XG4gICAgfVxuXG4gICAgaWYgKG0gJiYgbSA+IDAgJiYgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCA+IG0pIHtcbiAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQgPSB0cnVlO1xuICAgICAgY29uc29sZS5lcnJvcignKG5vZGUpIHdhcm5pbmc6IHBvc3NpYmxlIEV2ZW50RW1pdHRlciBtZW1vcnkgJyArXG4gICAgICAgICAgICAgICAgICAgICdsZWFrIGRldGVjdGVkLiAlZCBsaXN0ZW5lcnMgYWRkZWQuICcgK1xuICAgICAgICAgICAgICAgICAgICAnVXNlIGVtaXR0ZXIuc2V0TWF4TGlzdGVuZXJzKCkgdG8gaW5jcmVhc2UgbGltaXQuJyxcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCk7XG4gICAgICBpZiAodHlwZW9mIGNvbnNvbGUudHJhY2UgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgLy8gbm90IHN1cHBvcnRlZCBpbiBJRSAxMFxuICAgICAgICBjb25zb2xlLnRyYWNlKCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uID0gRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lcjtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbmNlID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIHZhciBmaXJlZCA9IGZhbHNlO1xuXG4gIGZ1bmN0aW9uIGcoKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBnKTtcblxuICAgIGlmICghZmlyZWQpIHtcbiAgICAgIGZpcmVkID0gdHJ1ZTtcbiAgICAgIGxpc3RlbmVyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfVxuICB9XG5cbiAgZy5saXN0ZW5lciA9IGxpc3RlbmVyO1xuICB0aGlzLm9uKHR5cGUsIGcpO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuLy8gZW1pdHMgYSAncmVtb3ZlTGlzdGVuZXInIGV2ZW50IGlmZiB0aGUgbGlzdGVuZXIgd2FzIHJlbW92ZWRcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbGlzdCwgcG9zaXRpb24sIGxlbmd0aCwgaTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICByZXR1cm4gdGhpcztcblxuICBsaXN0ID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuICBsZW5ndGggPSBsaXN0Lmxlbmd0aDtcbiAgcG9zaXRpb24gPSAtMTtcblxuICBpZiAobGlzdCA9PT0gbGlzdGVuZXIgfHxcbiAgICAgIChpc0Z1bmN0aW9uKGxpc3QubGlzdGVuZXIpICYmIGxpc3QubGlzdGVuZXIgPT09IGxpc3RlbmVyKSkge1xuICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG5cbiAgfSBlbHNlIGlmIChpc09iamVjdChsaXN0KSkge1xuICAgIGZvciAoaSA9IGxlbmd0aDsgaS0tID4gMDspIHtcbiAgICAgIGlmIChsaXN0W2ldID09PSBsaXN0ZW5lciB8fFxuICAgICAgICAgIChsaXN0W2ldLmxpc3RlbmVyICYmIGxpc3RbaV0ubGlzdGVuZXIgPT09IGxpc3RlbmVyKSkge1xuICAgICAgICBwb3NpdGlvbiA9IGk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChwb3NpdGlvbiA8IDApXG4gICAgICByZXR1cm4gdGhpcztcblxuICAgIGlmIChsaXN0Lmxlbmd0aCA9PT0gMSkge1xuICAgICAgbGlzdC5sZW5ndGggPSAwO1xuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGlzdC5zcGxpY2UocG9zaXRpb24sIDEpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpXG4gICAgICB0aGlzLmVtaXQoJ3JlbW92ZUxpc3RlbmVyJywgdHlwZSwgbGlzdGVuZXIpO1xuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUFsbExpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIGtleSwgbGlzdGVuZXJzO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIC8vIG5vdCBsaXN0ZW5pbmcgZm9yIHJlbW92ZUxpc3RlbmVyLCBubyBuZWVkIHRvIGVtaXRcbiAgaWYgKCF0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpIHtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMClcbiAgICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIGVsc2UgaWYgKHRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvLyBlbWl0IHJlbW92ZUxpc3RlbmVyIGZvciBhbGwgbGlzdGVuZXJzIG9uIGFsbCBldmVudHNcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApIHtcbiAgICBmb3IgKGtleSBpbiB0aGlzLl9ldmVudHMpIHtcbiAgICAgIGlmIChrZXkgPT09ICdyZW1vdmVMaXN0ZW5lcicpIGNvbnRpbnVlO1xuICAgICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoa2V5KTtcbiAgICB9XG4gICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoJ3JlbW92ZUxpc3RlbmVyJyk7XG4gICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBsaXN0ZW5lcnMgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgaWYgKGlzRnVuY3Rpb24obGlzdGVuZXJzKSkge1xuICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzKTtcbiAgfSBlbHNlIHtcbiAgICAvLyBMSUZPIG9yZGVyXG4gICAgd2hpbGUgKGxpc3RlbmVycy5sZW5ndGgpXG4gICAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGxpc3RlbmVyc1tsaXN0ZW5lcnMubGVuZ3RoIC0gMV0pO1xuICB9XG4gIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmxpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIHJldDtcbiAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICByZXQgPSBbXTtcbiAgZWxzZSBpZiAoaXNGdW5jdGlvbih0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIHJldCA9IFt0aGlzLl9ldmVudHNbdHlwZV1dO1xuICBlbHNlXG4gICAgcmV0ID0gdGhpcy5fZXZlbnRzW3R5cGVdLnNsaWNlKCk7XG4gIHJldHVybiByZXQ7XG59O1xuXG5FdmVudEVtaXR0ZXIubGlzdGVuZXJDb3VudCA9IGZ1bmN0aW9uKGVtaXR0ZXIsIHR5cGUpIHtcbiAgdmFyIHJldDtcbiAgaWYgKCFlbWl0dGVyLl9ldmVudHMgfHwgIWVtaXR0ZXIuX2V2ZW50c1t0eXBlXSlcbiAgICByZXQgPSAwO1xuICBlbHNlIGlmIChpc0Z1bmN0aW9uKGVtaXR0ZXIuX2V2ZW50c1t0eXBlXSkpXG4gICAgcmV0ID0gMTtcbiAgZWxzZVxuICAgIHJldCA9IGVtaXR0ZXIuX2V2ZW50c1t0eXBlXS5sZW5ndGg7XG4gIHJldHVybiByZXQ7XG59O1xuXG5mdW5jdGlvbiBpc0Z1bmN0aW9uKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ2Z1bmN0aW9uJztcbn1cblxuZnVuY3Rpb24gaXNOdW1iZXIoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnbnVtYmVyJztcbn1cblxuZnVuY3Rpb24gaXNPYmplY3QoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnb2JqZWN0JyAmJiBhcmcgIT09IG51bGw7XG59XG5cbmZ1bmN0aW9uIGlzVW5kZWZpbmVkKGFyZykge1xuICByZXR1cm4gYXJnID09PSB2b2lkIDA7XG59XG4iLCJ2YXIgaGFzT3duID0gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eTtcbnZhciB0b1N0cmluZyA9IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmc7XG52YXIgdW5kZWZpbmVkO1xuXG52YXIgaXNQbGFpbk9iamVjdCA9IGZ1bmN0aW9uIGlzUGxhaW5PYmplY3Qob2JqKSB7XG4gICAgXCJ1c2Ugc3RyaWN0XCI7XG4gICAgaWYgKCFvYmogfHwgdG9TdHJpbmcuY2FsbChvYmopICE9PSAnW29iamVjdCBPYmplY3RdJyB8fCBvYmoubm9kZVR5cGUgfHwgb2JqLnNldEludGVydmFsKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICB2YXIgaGFzX293bl9jb25zdHJ1Y3RvciA9IGhhc093bi5jYWxsKG9iaiwgJ2NvbnN0cnVjdG9yJyk7XG4gICAgdmFyIGhhc19pc19wcm9wZXJ0eV9vZl9tZXRob2QgPSBvYmouY29uc3RydWN0b3IgJiYgb2JqLmNvbnN0cnVjdG9yLnByb3RvdHlwZSAmJiBoYXNPd24uY2FsbChvYmouY29uc3RydWN0b3IucHJvdG90eXBlLCAnaXNQcm90b3R5cGVPZicpO1xuICAgIC8vIE5vdCBvd24gY29uc3RydWN0b3IgcHJvcGVydHkgbXVzdCBiZSBPYmplY3RcbiAgICBpZiAob2JqLmNvbnN0cnVjdG9yICYmICFoYXNfb3duX2NvbnN0cnVjdG9yICYmICFoYXNfaXNfcHJvcGVydHlfb2ZfbWV0aG9kKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICAvLyBPd24gcHJvcGVydGllcyBhcmUgZW51bWVyYXRlZCBmaXJzdGx5LCBzbyB0byBzcGVlZCB1cCxcbiAgICAvLyBpZiBsYXN0IG9uZSBpcyBvd24sIHRoZW4gYWxsIHByb3BlcnRpZXMgYXJlIG93bi5cbiAgICB2YXIga2V5O1xuICAgIGZvciAoa2V5IGluIG9iaikge31cblxuICAgIHJldHVybiBrZXkgPT09IHVuZGVmaW5lZCB8fCBoYXNPd24uY2FsbChvYmosIGtleSk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGV4dGVuZCgpIHtcbiAgICBcInVzZSBzdHJpY3RcIjtcbiAgICB2YXIgb3B0aW9ucywgbmFtZSwgc3JjLCBjb3B5LCBjb3B5SXNBcnJheSwgY2xvbmUsXG4gICAgICAgIHRhcmdldCA9IGFyZ3VtZW50c1swXSxcbiAgICAgICAgaSA9IDEsXG4gICAgICAgIGxlbmd0aCA9IGFyZ3VtZW50cy5sZW5ndGgsXG4gICAgICAgIGRlZXAgPSBmYWxzZTtcblxuICAgIC8vIEhhbmRsZSBhIGRlZXAgY29weSBzaXR1YXRpb25cbiAgICBpZiAodHlwZW9mIHRhcmdldCA9PT0gXCJib29sZWFuXCIpIHtcbiAgICAgICAgZGVlcCA9IHRhcmdldDtcbiAgICAgICAgdGFyZ2V0ID0gYXJndW1lbnRzWzFdIHx8IHt9O1xuICAgICAgICAvLyBza2lwIHRoZSBib29sZWFuIGFuZCB0aGUgdGFyZ2V0XG4gICAgICAgIGkgPSAyO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIHRhcmdldCAhPT0gXCJvYmplY3RcIiAmJiB0eXBlb2YgdGFyZ2V0ICE9PSBcImZ1bmN0aW9uXCIgfHwgdGFyZ2V0ID09IHVuZGVmaW5lZCkge1xuICAgICAgICB0YXJnZXQgPSB7fTtcbiAgICB9XG5cbiAgICBmb3IgKDsgaSA8IGxlbmd0aDsgKytpKSB7XG4gICAgICAgIC8vIE9ubHkgZGVhbCB3aXRoIG5vbi1udWxsL3VuZGVmaW5lZCB2YWx1ZXNcbiAgICAgICAgaWYgKChvcHRpb25zID0gYXJndW1lbnRzW2ldKSAhPSBudWxsKSB7XG4gICAgICAgICAgICAvLyBFeHRlbmQgdGhlIGJhc2Ugb2JqZWN0XG4gICAgICAgICAgICBmb3IgKG5hbWUgaW4gb3B0aW9ucykge1xuICAgICAgICAgICAgICAgIHNyYyA9IHRhcmdldFtuYW1lXTtcbiAgICAgICAgICAgICAgICBjb3B5ID0gb3B0aW9uc1tuYW1lXTtcblxuICAgICAgICAgICAgICAgIC8vIFByZXZlbnQgbmV2ZXItZW5kaW5nIGxvb3BcbiAgICAgICAgICAgICAgICBpZiAodGFyZ2V0ID09PSBjb3B5KSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIFJlY3Vyc2UgaWYgd2UncmUgbWVyZ2luZyBwbGFpbiBvYmplY3RzIG9yIGFycmF5c1xuICAgICAgICAgICAgICAgIGlmIChkZWVwICYmIGNvcHkgJiYgKGlzUGxhaW5PYmplY3QoY29weSkgfHwgKGNvcHlJc0FycmF5ID0gQXJyYXkuaXNBcnJheShjb3B5KSkpKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChjb3B5SXNBcnJheSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29weUlzQXJyYXkgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsb25lID0gc3JjICYmIEFycmF5LmlzQXJyYXkoc3JjKSA/IHNyYyA6IFtdO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgY2xvbmUgPSBzcmMgJiYgaXNQbGFpbk9iamVjdChzcmMpID8gc3JjIDoge307XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAvLyBOZXZlciBtb3ZlIG9yaWdpbmFsIG9iamVjdHMsIGNsb25lIHRoZW1cbiAgICAgICAgICAgICAgICAgICAgdGFyZ2V0W25hbWVdID0gZXh0ZW5kKGRlZXAsIGNsb25lLCBjb3B5KTtcblxuICAgICAgICAgICAgICAgICAgICAvLyBEb24ndCBicmluZyBpbiB1bmRlZmluZWQgdmFsdWVzXG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChjb3B5ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgdGFyZ2V0W25hbWVdID0gY29weTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBSZXR1cm4gdGhlIG1vZGlmaWVkIG9iamVjdFxuICAgIHJldHVybiB0YXJnZXQ7XG59O1xuXG4iLCIoZnVuY3Rpb24gKGdsb2JhbCl7XG4vKlxuICogQ29weXJpZ2h0IChjKSAyMDE0IFRoZSBQb2x5bWVyIFByb2plY3QgQXV0aG9ycy4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqIFRoaXMgY29kZSBtYXkgb25seSBiZSB1c2VkIHVuZGVyIHRoZSBCU0Qgc3R5bGUgbGljZW5zZSBmb3VuZCBhdCBodHRwOi8vcG9seW1lci5naXRodWIuaW8vTElDRU5TRS50eHRcbiAqIFRoZSBjb21wbGV0ZSBzZXQgb2YgYXV0aG9ycyBtYXkgYmUgZm91bmQgYXQgaHR0cDovL3BvbHltZXIuZ2l0aHViLmlvL0FVVEhPUlMudHh0XG4gKiBUaGUgY29tcGxldGUgc2V0IG9mIGNvbnRyaWJ1dG9ycyBtYXkgYmUgZm91bmQgYXQgaHR0cDovL3BvbHltZXIuZ2l0aHViLmlvL0NPTlRSSUJVVE9SUy50eHRcbiAqIENvZGUgZGlzdHJpYnV0ZWQgYnkgR29vZ2xlIGFzIHBhcnQgb2YgdGhlIHBvbHltZXIgcHJvamVjdCBpcyBhbHNvXG4gKiBzdWJqZWN0IHRvIGFuIGFkZGl0aW9uYWwgSVAgcmlnaHRzIGdyYW50IGZvdW5kIGF0IGh0dHA6Ly9wb2x5bWVyLmdpdGh1Yi5pby9QQVRFTlRTLnR4dFxuICovXG5cbihmdW5jdGlvbihnbG9iYWwpIHtcbiAgJ3VzZSBzdHJpY3QnO1xuXG4gIHZhciB0ZXN0aW5nRXhwb3NlQ3ljbGVDb3VudCA9IGdsb2JhbC50ZXN0aW5nRXhwb3NlQ3ljbGVDb3VudDtcblxuICAvLyBEZXRlY3QgYW5kIGRvIGJhc2ljIHNhbml0eSBjaGVja2luZyBvbiBPYmplY3QvQXJyYXkub2JzZXJ2ZS5cbiAgZnVuY3Rpb24gZGV0ZWN0T2JqZWN0T2JzZXJ2ZSgpIHtcbiAgICBpZiAodHlwZW9mIE9iamVjdC5vYnNlcnZlICE9PSAnZnVuY3Rpb24nIHx8XG4gICAgICAgIHR5cGVvZiBBcnJheS5vYnNlcnZlICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgdmFyIHJlY29yZHMgPSBbXTtcblxuICAgIGZ1bmN0aW9uIGNhbGxiYWNrKHJlY3MpIHtcbiAgICAgIHJlY29yZHMgPSByZWNzO1xuICAgIH1cblxuICAgIHZhciB0ZXN0ID0ge307XG4gICAgdmFyIGFyciA9IFtdO1xuICAgIE9iamVjdC5vYnNlcnZlKHRlc3QsIGNhbGxiYWNrKTtcbiAgICBBcnJheS5vYnNlcnZlKGFyciwgY2FsbGJhY2spO1xuICAgIHRlc3QuaWQgPSAxO1xuICAgIHRlc3QuaWQgPSAyO1xuICAgIGRlbGV0ZSB0ZXN0LmlkO1xuICAgIGFyci5wdXNoKDEsIDIpO1xuICAgIGFyci5sZW5ndGggPSAwO1xuXG4gICAgT2JqZWN0LmRlbGl2ZXJDaGFuZ2VSZWNvcmRzKGNhbGxiYWNrKTtcbiAgICBpZiAocmVjb3Jkcy5sZW5ndGggIT09IDUpXG4gICAgICByZXR1cm4gZmFsc2U7XG5cbiAgICBpZiAocmVjb3Jkc1swXS50eXBlICE9ICdhZGQnIHx8XG4gICAgICAgIHJlY29yZHNbMV0udHlwZSAhPSAndXBkYXRlJyB8fFxuICAgICAgICByZWNvcmRzWzJdLnR5cGUgIT0gJ2RlbGV0ZScgfHxcbiAgICAgICAgcmVjb3Jkc1szXS50eXBlICE9ICdzcGxpY2UnIHx8XG4gICAgICAgIHJlY29yZHNbNF0udHlwZSAhPSAnc3BsaWNlJykge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIE9iamVjdC51bm9ic2VydmUodGVzdCwgY2FsbGJhY2spO1xuICAgIEFycmF5LnVub2JzZXJ2ZShhcnIsIGNhbGxiYWNrKTtcblxuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgdmFyIGhhc09ic2VydmUgPSBkZXRlY3RPYmplY3RPYnNlcnZlKCk7XG5cbiAgZnVuY3Rpb24gZGV0ZWN0RXZhbCgpIHtcbiAgICAvLyBEb24ndCB0ZXN0IGZvciBldmFsIGlmIHdlJ3JlIHJ1bm5pbmcgaW4gYSBDaHJvbWUgQXBwIGVudmlyb25tZW50LlxuICAgIC8vIFdlIGNoZWNrIGZvciBBUElzIHNldCB0aGF0IG9ubHkgZXhpc3QgaW4gYSBDaHJvbWUgQXBwIGNvbnRleHQuXG4gICAgaWYgKHR5cGVvZiBjaHJvbWUgIT09ICd1bmRlZmluZWQnICYmIGNocm9tZS5hcHAgJiYgY2hyb21lLmFwcC5ydW50aW1lKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgLy8gRmlyZWZveCBPUyBBcHBzIGRvIG5vdCBhbGxvdyBldmFsLiBUaGlzIGZlYXR1cmUgZGV0ZWN0aW9uIGlzIHZlcnkgaGFja3lcbiAgICAvLyBidXQgZXZlbiBpZiBzb21lIG90aGVyIHBsYXRmb3JtIGFkZHMgc3VwcG9ydCBmb3IgdGhpcyBmdW5jdGlvbiB0aGlzIGNvZGVcbiAgICAvLyB3aWxsIGNvbnRpbnVlIHRvIHdvcmsuXG4gICAgaWYgKG5hdmlnYXRvci5nZXREZXZpY2VTdG9yYWdlKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgdHJ5IHtcbiAgICAgIHZhciBmID0gbmV3IEZ1bmN0aW9uKCcnLCAncmV0dXJuIHRydWU7Jyk7XG4gICAgICByZXR1cm4gZigpO1xuICAgIH0gY2F0Y2ggKGV4KSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgdmFyIGhhc0V2YWwgPSBkZXRlY3RFdmFsKCk7XG5cbiAgZnVuY3Rpb24gaXNJbmRleChzKSB7XG4gICAgcmV0dXJuICtzID09PSBzID4+PiAwICYmIHMgIT09ICcnO1xuICB9XG5cbiAgZnVuY3Rpb24gdG9OdW1iZXIocykge1xuICAgIHJldHVybiArcztcbiAgfVxuXG4gIGZ1bmN0aW9uIGlzT2JqZWN0KG9iaikge1xuICAgIHJldHVybiBvYmogPT09IE9iamVjdChvYmopO1xuICB9XG5cbiAgdmFyIG51bWJlcklzTmFOID0gZ2xvYmFsLk51bWJlci5pc05hTiB8fCBmdW5jdGlvbih2YWx1ZSkge1xuICAgIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInICYmIGdsb2JhbC5pc05hTih2YWx1ZSk7XG4gIH1cblxuICBmdW5jdGlvbiBhcmVTYW1lVmFsdWUobGVmdCwgcmlnaHQpIHtcbiAgICBpZiAobGVmdCA9PT0gcmlnaHQpXG4gICAgICByZXR1cm4gbGVmdCAhPT0gMCB8fCAxIC8gbGVmdCA9PT0gMSAvIHJpZ2h0O1xuICAgIGlmIChudW1iZXJJc05hTihsZWZ0KSAmJiBudW1iZXJJc05hTihyaWdodCkpXG4gICAgICByZXR1cm4gdHJ1ZTtcblxuICAgIHJldHVybiBsZWZ0ICE9PSBsZWZ0ICYmIHJpZ2h0ICE9PSByaWdodDtcbiAgfVxuXG4gIHZhciBjcmVhdGVPYmplY3QgPSAoJ19fcHJvdG9fXycgaW4ge30pID9cbiAgICBmdW5jdGlvbihvYmopIHsgcmV0dXJuIG9iajsgfSA6XG4gICAgZnVuY3Rpb24ob2JqKSB7XG4gICAgICB2YXIgcHJvdG8gPSBvYmouX19wcm90b19fO1xuICAgICAgaWYgKCFwcm90bylcbiAgICAgICAgcmV0dXJuIG9iajtcbiAgICAgIHZhciBuZXdPYmplY3QgPSBPYmplY3QuY3JlYXRlKHByb3RvKTtcbiAgICAgIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKG9iaikuZm9yRWFjaChmdW5jdGlvbihuYW1lKSB7XG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShuZXdPYmplY3QsIG5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3Iob2JqLCBuYW1lKSk7XG4gICAgICB9KTtcbiAgICAgIHJldHVybiBuZXdPYmplY3Q7XG4gICAgfTtcblxuICB2YXIgaWRlbnRTdGFydCA9ICdbXFwkX2EtekEtWl0nO1xuICB2YXIgaWRlbnRQYXJ0ID0gJ1tcXCRfYS16QS1aMC05XSc7XG4gIHZhciBpZGVudFJlZ0V4cCA9IG5ldyBSZWdFeHAoJ14nICsgaWRlbnRTdGFydCArICcrJyArIGlkZW50UGFydCArICcqJyArICckJyk7XG5cbiAgZnVuY3Rpb24gZ2V0UGF0aENoYXJUeXBlKGNoYXIpIHtcbiAgICBpZiAoY2hhciA9PT0gdW5kZWZpbmVkKVxuICAgICAgcmV0dXJuICdlb2YnO1xuXG4gICAgdmFyIGNvZGUgPSBjaGFyLmNoYXJDb2RlQXQoMCk7XG5cbiAgICBzd2l0Y2goY29kZSkge1xuICAgICAgY2FzZSAweDVCOiAvLyBbXG4gICAgICBjYXNlIDB4NUQ6IC8vIF1cbiAgICAgIGNhc2UgMHgyRTogLy8gLlxuICAgICAgY2FzZSAweDIyOiAvLyBcIlxuICAgICAgY2FzZSAweDI3OiAvLyAnXG4gICAgICBjYXNlIDB4MzA6IC8vIDBcbiAgICAgICAgcmV0dXJuIGNoYXI7XG5cbiAgICAgIGNhc2UgMHg1RjogLy8gX1xuICAgICAgY2FzZSAweDI0OiAvLyAkXG4gICAgICAgIHJldHVybiAnaWRlbnQnO1xuXG4gICAgICBjYXNlIDB4MjA6IC8vIFNwYWNlXG4gICAgICBjYXNlIDB4MDk6IC8vIFRhYlxuICAgICAgY2FzZSAweDBBOiAvLyBOZXdsaW5lXG4gICAgICBjYXNlIDB4MEQ6IC8vIFJldHVyblxuICAgICAgY2FzZSAweEEwOiAgLy8gTm8tYnJlYWsgc3BhY2VcbiAgICAgIGNhc2UgMHhGRUZGOiAgLy8gQnl0ZSBPcmRlciBNYXJrXG4gICAgICBjYXNlIDB4MjAyODogIC8vIExpbmUgU2VwYXJhdG9yXG4gICAgICBjYXNlIDB4MjAyOTogIC8vIFBhcmFncmFwaCBTZXBhcmF0b3JcbiAgICAgICAgcmV0dXJuICd3cyc7XG4gICAgfVxuXG4gICAgLy8gYS16LCBBLVpcbiAgICBpZiAoKDB4NjEgPD0gY29kZSAmJiBjb2RlIDw9IDB4N0EpIHx8ICgweDQxIDw9IGNvZGUgJiYgY29kZSA8PSAweDVBKSlcbiAgICAgIHJldHVybiAnaWRlbnQnO1xuXG4gICAgLy8gMS05XG4gICAgaWYgKDB4MzEgPD0gY29kZSAmJiBjb2RlIDw9IDB4MzkpXG4gICAgICByZXR1cm4gJ251bWJlcic7XG5cbiAgICByZXR1cm4gJ2Vsc2UnO1xuICB9XG5cbiAgdmFyIHBhdGhTdGF0ZU1hY2hpbmUgPSB7XG4gICAgJ2JlZm9yZVBhdGgnOiB7XG4gICAgICAnd3MnOiBbJ2JlZm9yZVBhdGgnXSxcbiAgICAgICdpZGVudCc6IFsnaW5JZGVudCcsICdhcHBlbmQnXSxcbiAgICAgICdbJzogWydiZWZvcmVFbGVtZW50J10sXG4gICAgICAnZW9mJzogWydhZnRlclBhdGgnXVxuICAgIH0sXG5cbiAgICAnaW5QYXRoJzoge1xuICAgICAgJ3dzJzogWydpblBhdGgnXSxcbiAgICAgICcuJzogWydiZWZvcmVJZGVudCddLFxuICAgICAgJ1snOiBbJ2JlZm9yZUVsZW1lbnQnXSxcbiAgICAgICdlb2YnOiBbJ2FmdGVyUGF0aCddXG4gICAgfSxcblxuICAgICdiZWZvcmVJZGVudCc6IHtcbiAgICAgICd3cyc6IFsnYmVmb3JlSWRlbnQnXSxcbiAgICAgICdpZGVudCc6IFsnaW5JZGVudCcsICdhcHBlbmQnXVxuICAgIH0sXG5cbiAgICAnaW5JZGVudCc6IHtcbiAgICAgICdpZGVudCc6IFsnaW5JZGVudCcsICdhcHBlbmQnXSxcbiAgICAgICcwJzogWydpbklkZW50JywgJ2FwcGVuZCddLFxuICAgICAgJ251bWJlcic6IFsnaW5JZGVudCcsICdhcHBlbmQnXSxcbiAgICAgICd3cyc6IFsnaW5QYXRoJywgJ3B1c2gnXSxcbiAgICAgICcuJzogWydiZWZvcmVJZGVudCcsICdwdXNoJ10sXG4gICAgICAnWyc6IFsnYmVmb3JlRWxlbWVudCcsICdwdXNoJ10sXG4gICAgICAnZW9mJzogWydhZnRlclBhdGgnLCAncHVzaCddXG4gICAgfSxcblxuICAgICdiZWZvcmVFbGVtZW50Jzoge1xuICAgICAgJ3dzJzogWydiZWZvcmVFbGVtZW50J10sXG4gICAgICAnMCc6IFsnYWZ0ZXJaZXJvJywgJ2FwcGVuZCddLFxuICAgICAgJ251bWJlcic6IFsnaW5JbmRleCcsICdhcHBlbmQnXSxcbiAgICAgIFwiJ1wiOiBbJ2luU2luZ2xlUXVvdGUnLCAnYXBwZW5kJywgJyddLFxuICAgICAgJ1wiJzogWydpbkRvdWJsZVF1b3RlJywgJ2FwcGVuZCcsICcnXVxuICAgIH0sXG5cbiAgICAnYWZ0ZXJaZXJvJzoge1xuICAgICAgJ3dzJzogWydhZnRlckVsZW1lbnQnLCAncHVzaCddLFxuICAgICAgJ10nOiBbJ2luUGF0aCcsICdwdXNoJ11cbiAgICB9LFxuXG4gICAgJ2luSW5kZXgnOiB7XG4gICAgICAnMCc6IFsnaW5JbmRleCcsICdhcHBlbmQnXSxcbiAgICAgICdudW1iZXInOiBbJ2luSW5kZXgnLCAnYXBwZW5kJ10sXG4gICAgICAnd3MnOiBbJ2FmdGVyRWxlbWVudCddLFxuICAgICAgJ10nOiBbJ2luUGF0aCcsICdwdXNoJ11cbiAgICB9LFxuXG4gICAgJ2luU2luZ2xlUXVvdGUnOiB7XG4gICAgICBcIidcIjogWydhZnRlckVsZW1lbnQnXSxcbiAgICAgICdlb2YnOiBbJ2Vycm9yJ10sXG4gICAgICAnZWxzZSc6IFsnaW5TaW5nbGVRdW90ZScsICdhcHBlbmQnXVxuICAgIH0sXG5cbiAgICAnaW5Eb3VibGVRdW90ZSc6IHtcbiAgICAgICdcIic6IFsnYWZ0ZXJFbGVtZW50J10sXG4gICAgICAnZW9mJzogWydlcnJvciddLFxuICAgICAgJ2Vsc2UnOiBbJ2luRG91YmxlUXVvdGUnLCAnYXBwZW5kJ11cbiAgICB9LFxuXG4gICAgJ2FmdGVyRWxlbWVudCc6IHtcbiAgICAgICd3cyc6IFsnYWZ0ZXJFbGVtZW50J10sXG4gICAgICAnXSc6IFsnaW5QYXRoJywgJ3B1c2gnXVxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIG5vb3AoKSB7fVxuXG4gIGZ1bmN0aW9uIHBhcnNlUGF0aChwYXRoKSB7XG4gICAgdmFyIGtleXMgPSBbXTtcbiAgICB2YXIgaW5kZXggPSAtMTtcbiAgICB2YXIgYywgbmV3Q2hhciwga2V5LCB0eXBlLCB0cmFuc2l0aW9uLCBhY3Rpb24sIHR5cGVNYXAsIG1vZGUgPSAnYmVmb3JlUGF0aCc7XG5cbiAgICB2YXIgYWN0aW9ucyA9IHtcbiAgICAgIHB1c2g6IGZ1bmN0aW9uKCkge1xuICAgICAgICBpZiAoa2V5ID09PSB1bmRlZmluZWQpXG4gICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIGtleXMucHVzaChrZXkpO1xuICAgICAgICBrZXkgPSB1bmRlZmluZWQ7XG4gICAgICB9LFxuXG4gICAgICBhcHBlbmQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICBpZiAoa2V5ID09PSB1bmRlZmluZWQpXG4gICAgICAgICAga2V5ID0gbmV3Q2hhclxuICAgICAgICBlbHNlXG4gICAgICAgICAga2V5ICs9IG5ld0NoYXI7XG4gICAgICB9XG4gICAgfTtcblxuICAgIGZ1bmN0aW9uIG1heWJlVW5lc2NhcGVRdW90ZSgpIHtcbiAgICAgIGlmIChpbmRleCA+PSBwYXRoLmxlbmd0aClcbiAgICAgICAgcmV0dXJuO1xuXG4gICAgICB2YXIgbmV4dENoYXIgPSBwYXRoW2luZGV4ICsgMV07XG4gICAgICBpZiAoKG1vZGUgPT0gJ2luU2luZ2xlUXVvdGUnICYmIG5leHRDaGFyID09IFwiJ1wiKSB8fFxuICAgICAgICAgIChtb2RlID09ICdpbkRvdWJsZVF1b3RlJyAmJiBuZXh0Q2hhciA9PSAnXCInKSkge1xuICAgICAgICBpbmRleCsrO1xuICAgICAgICBuZXdDaGFyID0gbmV4dENoYXI7XG4gICAgICAgIGFjdGlvbnMuYXBwZW5kKCk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgIH1cblxuICAgIHdoaWxlIChtb2RlKSB7XG4gICAgICBpbmRleCsrO1xuICAgICAgYyA9IHBhdGhbaW5kZXhdO1xuXG4gICAgICBpZiAoYyA9PSAnXFxcXCcgJiYgbWF5YmVVbmVzY2FwZVF1b3RlKG1vZGUpKVxuICAgICAgICBjb250aW51ZTtcblxuICAgICAgdHlwZSA9IGdldFBhdGhDaGFyVHlwZShjKTtcbiAgICAgIHR5cGVNYXAgPSBwYXRoU3RhdGVNYWNoaW5lW21vZGVdO1xuICAgICAgdHJhbnNpdGlvbiA9IHR5cGVNYXBbdHlwZV0gfHwgdHlwZU1hcFsnZWxzZSddIHx8ICdlcnJvcic7XG5cbiAgICAgIGlmICh0cmFuc2l0aW9uID09ICdlcnJvcicpXG4gICAgICAgIHJldHVybjsgLy8gcGFyc2UgZXJyb3I7XG5cbiAgICAgIG1vZGUgPSB0cmFuc2l0aW9uWzBdO1xuICAgICAgYWN0aW9uID0gYWN0aW9uc1t0cmFuc2l0aW9uWzFdXSB8fCBub29wO1xuICAgICAgbmV3Q2hhciA9IHRyYW5zaXRpb25bMl0gPT09IHVuZGVmaW5lZCA/IGMgOiB0cmFuc2l0aW9uWzJdO1xuICAgICAgYWN0aW9uKCk7XG5cbiAgICAgIGlmIChtb2RlID09PSAnYWZ0ZXJQYXRoJykge1xuICAgICAgICByZXR1cm4ga2V5cztcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm47IC8vIHBhcnNlIGVycm9yXG4gIH1cblxuICBmdW5jdGlvbiBpc0lkZW50KHMpIHtcbiAgICByZXR1cm4gaWRlbnRSZWdFeHAudGVzdChzKTtcbiAgfVxuXG4gIHZhciBjb25zdHJ1Y3RvcklzUHJpdmF0ZSA9IHt9O1xuXG4gIGZ1bmN0aW9uIFBhdGgocGFydHMsIHByaXZhdGVUb2tlbikge1xuICAgIGlmIChwcml2YXRlVG9rZW4gIT09IGNvbnN0cnVjdG9ySXNQcml2YXRlKVxuICAgICAgdGhyb3cgRXJyb3IoJ1VzZSBQYXRoLmdldCB0byByZXRyaWV2ZSBwYXRoIG9iamVjdHMnKTtcblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcGFydHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHRoaXMucHVzaChTdHJpbmcocGFydHNbaV0pKTtcbiAgICB9XG5cbiAgICBpZiAoaGFzRXZhbCAmJiB0aGlzLmxlbmd0aCkge1xuICAgICAgdGhpcy5nZXRWYWx1ZUZyb20gPSB0aGlzLmNvbXBpbGVkR2V0VmFsdWVGcm9tRm4oKTtcbiAgICB9XG4gIH1cblxuICAvLyBUT0RPKHJhZmFlbHcpOiBNYWtlIHNpbXBsZSBMUlUgY2FjaGVcbiAgdmFyIHBhdGhDYWNoZSA9IHt9O1xuXG4gIGZ1bmN0aW9uIGdldFBhdGgocGF0aFN0cmluZykge1xuICAgIGlmIChwYXRoU3RyaW5nIGluc3RhbmNlb2YgUGF0aClcbiAgICAgIHJldHVybiBwYXRoU3RyaW5nO1xuXG4gICAgaWYgKHBhdGhTdHJpbmcgPT0gbnVsbCB8fCBwYXRoU3RyaW5nLmxlbmd0aCA9PSAwKVxuICAgICAgcGF0aFN0cmluZyA9ICcnO1xuXG4gICAgaWYgKHR5cGVvZiBwYXRoU3RyaW5nICE9ICdzdHJpbmcnKSB7XG4gICAgICBpZiAoaXNJbmRleChwYXRoU3RyaW5nLmxlbmd0aCkpIHtcbiAgICAgICAgLy8gQ29uc3RydWN0ZWQgd2l0aCBhcnJheS1saWtlIChwcmUtcGFyc2VkKSBrZXlzXG4gICAgICAgIHJldHVybiBuZXcgUGF0aChwYXRoU3RyaW5nLCBjb25zdHJ1Y3RvcklzUHJpdmF0ZSk7XG4gICAgICB9XG5cbiAgICAgIHBhdGhTdHJpbmcgPSBTdHJpbmcocGF0aFN0cmluZyk7XG4gICAgfVxuXG4gICAgdmFyIHBhdGggPSBwYXRoQ2FjaGVbcGF0aFN0cmluZ107XG4gICAgaWYgKHBhdGgpXG4gICAgICByZXR1cm4gcGF0aDtcblxuICAgIHZhciBwYXJ0cyA9IHBhcnNlUGF0aChwYXRoU3RyaW5nKTtcbiAgICBpZiAoIXBhcnRzKVxuICAgICAgcmV0dXJuIGludmFsaWRQYXRoO1xuXG4gICAgdmFyIHBhdGggPSBuZXcgUGF0aChwYXJ0cywgY29uc3RydWN0b3JJc1ByaXZhdGUpO1xuICAgIHBhdGhDYWNoZVtwYXRoU3RyaW5nXSA9IHBhdGg7XG4gICAgcmV0dXJuIHBhdGg7XG4gIH1cblxuICBQYXRoLmdldCA9IGdldFBhdGg7XG5cbiAgZnVuY3Rpb24gZm9ybWF0QWNjZXNzb3Ioa2V5KSB7XG4gICAgaWYgKGlzSW5kZXgoa2V5KSkge1xuICAgICAgcmV0dXJuICdbJyArIGtleSArICddJztcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuICdbXCInICsga2V5LnJlcGxhY2UoL1wiL2csICdcXFxcXCInKSArICdcIl0nO1xuICAgIH1cbiAgfVxuXG4gIFBhdGgucHJvdG90eXBlID0gY3JlYXRlT2JqZWN0KHtcbiAgICBfX3Byb3RvX186IFtdLFxuICAgIHZhbGlkOiB0cnVlLFxuXG4gICAgdG9TdHJpbmc6IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIHBhdGhTdHJpbmcgPSAnJztcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIga2V5ID0gdGhpc1tpXTtcbiAgICAgICAgaWYgKGlzSWRlbnQoa2V5KSkge1xuICAgICAgICAgIHBhdGhTdHJpbmcgKz0gaSA/ICcuJyArIGtleSA6IGtleTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwYXRoU3RyaW5nICs9IGZvcm1hdEFjY2Vzc29yKGtleSk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHBhdGhTdHJpbmc7XG4gICAgfSxcblxuICAgIGdldFZhbHVlRnJvbTogZnVuY3Rpb24ob2JqLCBkaXJlY3RPYnNlcnZlcikge1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGlmIChvYmogPT0gbnVsbClcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIG9iaiA9IG9ialt0aGlzW2ldXTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBvYmo7XG4gICAgfSxcblxuICAgIGl0ZXJhdGVPYmplY3RzOiBmdW5jdGlvbihvYmosIG9ic2VydmUpIHtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBpZiAoaSlcbiAgICAgICAgICBvYmogPSBvYmpbdGhpc1tpIC0gMV1dO1xuICAgICAgICBpZiAoIWlzT2JqZWN0KG9iaikpXG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICBvYnNlcnZlKG9iaiwgdGhpc1swXSk7XG4gICAgICB9XG4gICAgfSxcblxuICAgIGNvbXBpbGVkR2V0VmFsdWVGcm9tRm46IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIHN0ciA9ICcnO1xuICAgICAgdmFyIHBhdGhTdHJpbmcgPSAnb2JqJztcbiAgICAgIHN0ciArPSAnaWYgKG9iaiAhPSBudWxsJztcbiAgICAgIHZhciBpID0gMDtcbiAgICAgIHZhciBrZXk7XG4gICAgICBmb3IgKDsgaSA8ICh0aGlzLmxlbmd0aCAtIDEpOyBpKyspIHtcbiAgICAgICAga2V5ID0gdGhpc1tpXTtcbiAgICAgICAgcGF0aFN0cmluZyArPSBpc0lkZW50KGtleSkgPyAnLicgKyBrZXkgOiBmb3JtYXRBY2Nlc3NvcihrZXkpO1xuICAgICAgICBzdHIgKz0gJyAmJlxcbiAgICAgJyArIHBhdGhTdHJpbmcgKyAnICE9IG51bGwnO1xuICAgICAgfVxuICAgICAgc3RyICs9ICcpXFxuJztcblxuICAgICAgdmFyIGtleSA9IHRoaXNbaV07XG4gICAgICBwYXRoU3RyaW5nICs9IGlzSWRlbnQoa2V5KSA/ICcuJyArIGtleSA6IGZvcm1hdEFjY2Vzc29yKGtleSk7XG5cbiAgICAgIHN0ciArPSAnICByZXR1cm4gJyArIHBhdGhTdHJpbmcgKyAnO1xcbmVsc2VcXG4gIHJldHVybiB1bmRlZmluZWQ7JztcbiAgICAgIHJldHVybiBuZXcgRnVuY3Rpb24oJ29iaicsIHN0cik7XG4gICAgfSxcblxuICAgIHNldFZhbHVlRnJvbTogZnVuY3Rpb24ob2JqLCB2YWx1ZSkge1xuICAgICAgaWYgKCF0aGlzLmxlbmd0aClcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuXG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMubGVuZ3RoIC0gMTsgaSsrKSB7XG4gICAgICAgIGlmICghaXNPYmplY3Qob2JqKSlcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIG9iaiA9IG9ialt0aGlzW2ldXTtcbiAgICAgIH1cblxuICAgICAgaWYgKCFpc09iamVjdChvYmopKVxuICAgICAgICByZXR1cm4gZmFsc2U7XG5cbiAgICAgIG9ialt0aGlzW2ldXSA9IHZhbHVlO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICB9KTtcblxuICB2YXIgaW52YWxpZFBhdGggPSBuZXcgUGF0aCgnJywgY29uc3RydWN0b3JJc1ByaXZhdGUpO1xuICBpbnZhbGlkUGF0aC52YWxpZCA9IGZhbHNlO1xuICBpbnZhbGlkUGF0aC5nZXRWYWx1ZUZyb20gPSBpbnZhbGlkUGF0aC5zZXRWYWx1ZUZyb20gPSBmdW5jdGlvbigpIHt9O1xuXG4gIHZhciBNQVhfRElSVFlfQ0hFQ0tfQ1lDTEVTID0gMTAwMDtcblxuICBmdW5jdGlvbiBkaXJ0eUNoZWNrKG9ic2VydmVyKSB7XG4gICAgdmFyIGN5Y2xlcyA9IDA7XG4gICAgd2hpbGUgKGN5Y2xlcyA8IE1BWF9ESVJUWV9DSEVDS19DWUNMRVMgJiYgb2JzZXJ2ZXIuY2hlY2tfKCkpIHtcbiAgICAgIGN5Y2xlcysrO1xuICAgIH1cbiAgICBpZiAodGVzdGluZ0V4cG9zZUN5Y2xlQ291bnQpXG4gICAgICBnbG9iYWwuZGlydHlDaGVja0N5Y2xlQ291bnQgPSBjeWNsZXM7XG5cbiAgICByZXR1cm4gY3ljbGVzID4gMDtcbiAgfVxuXG4gIGZ1bmN0aW9uIG9iamVjdElzRW1wdHkob2JqZWN0KSB7XG4gICAgZm9yICh2YXIgcHJvcCBpbiBvYmplY3QpXG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICBmdW5jdGlvbiBkaWZmSXNFbXB0eShkaWZmKSB7XG4gICAgcmV0dXJuIG9iamVjdElzRW1wdHkoZGlmZi5hZGRlZCkgJiZcbiAgICAgICAgICAgb2JqZWN0SXNFbXB0eShkaWZmLnJlbW92ZWQpICYmXG4gICAgICAgICAgIG9iamVjdElzRW1wdHkoZGlmZi5jaGFuZ2VkKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGRpZmZPYmplY3RGcm9tT2xkT2JqZWN0KG9iamVjdCwgb2xkT2JqZWN0KSB7XG4gICAgdmFyIGFkZGVkID0ge307XG4gICAgdmFyIHJlbW92ZWQgPSB7fTtcbiAgICB2YXIgY2hhbmdlZCA9IHt9O1xuXG4gICAgZm9yICh2YXIgcHJvcCBpbiBvbGRPYmplY3QpIHtcbiAgICAgIHZhciBuZXdWYWx1ZSA9IG9iamVjdFtwcm9wXTtcblxuICAgICAgaWYgKG5ld1ZhbHVlICE9PSB1bmRlZmluZWQgJiYgbmV3VmFsdWUgPT09IG9sZE9iamVjdFtwcm9wXSlcbiAgICAgICAgY29udGludWU7XG5cbiAgICAgIGlmICghKHByb3AgaW4gb2JqZWN0KSkge1xuICAgICAgICByZW1vdmVkW3Byb3BdID0gdW5kZWZpbmVkO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKG5ld1ZhbHVlICE9PSBvbGRPYmplY3RbcHJvcF0pXG4gICAgICAgIGNoYW5nZWRbcHJvcF0gPSBuZXdWYWx1ZTtcbiAgICB9XG5cbiAgICBmb3IgKHZhciBwcm9wIGluIG9iamVjdCkge1xuICAgICAgaWYgKHByb3AgaW4gb2xkT2JqZWN0KVxuICAgICAgICBjb250aW51ZTtcblxuICAgICAgYWRkZWRbcHJvcF0gPSBvYmplY3RbcHJvcF07XG4gICAgfVxuXG4gICAgaWYgKEFycmF5LmlzQXJyYXkob2JqZWN0KSAmJiBvYmplY3QubGVuZ3RoICE9PSBvbGRPYmplY3QubGVuZ3RoKVxuICAgICAgY2hhbmdlZC5sZW5ndGggPSBvYmplY3QubGVuZ3RoO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIGFkZGVkOiBhZGRlZCxcbiAgICAgIHJlbW92ZWQ6IHJlbW92ZWQsXG4gICAgICBjaGFuZ2VkOiBjaGFuZ2VkXG4gICAgfTtcbiAgfVxuXG4gIHZhciBlb21UYXNrcyA9IFtdO1xuICBmdW5jdGlvbiBydW5FT01UYXNrcygpIHtcbiAgICBpZiAoIWVvbVRhc2tzLmxlbmd0aClcbiAgICAgIHJldHVybiBmYWxzZTtcblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgZW9tVGFza3MubGVuZ3RoOyBpKyspIHtcbiAgICAgIGVvbVRhc2tzW2ldKCk7XG4gICAgfVxuICAgIGVvbVRhc2tzLmxlbmd0aCA9IDA7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICB2YXIgcnVuRU9NID0gaGFzT2JzZXJ2ZSA/IChmdW5jdGlvbigpe1xuICAgIHZhciBlb21PYmogPSB7IHBpbmdQb25nOiB0cnVlIH07XG4gICAgdmFyIGVvbVJ1blNjaGVkdWxlZCA9IGZhbHNlO1xuXG4gICAgT2JqZWN0Lm9ic2VydmUoZW9tT2JqLCBmdW5jdGlvbigpIHtcbiAgICAgIHJ1bkVPTVRhc2tzKCk7XG4gICAgICBlb21SdW5TY2hlZHVsZWQgPSBmYWxzZTtcbiAgICB9KTtcblxuICAgIHJldHVybiBmdW5jdGlvbihmbikge1xuICAgICAgZW9tVGFza3MucHVzaChmbik7XG4gICAgICBpZiAoIWVvbVJ1blNjaGVkdWxlZCkge1xuICAgICAgICBlb21SdW5TY2hlZHVsZWQgPSB0cnVlO1xuICAgICAgICBlb21PYmoucGluZ1BvbmcgPSAhZW9tT2JqLnBpbmdQb25nO1xuICAgICAgfVxuICAgIH07XG4gIH0pKCkgOlxuICAoZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKGZuKSB7XG4gICAgICBlb21UYXNrcy5wdXNoKGZuKTtcbiAgICB9O1xuICB9KSgpO1xuXG4gIHZhciBvYnNlcnZlZE9iamVjdENhY2hlID0gW107XG5cbiAgZnVuY3Rpb24gbmV3T2JzZXJ2ZWRPYmplY3QoKSB7XG4gICAgdmFyIG9ic2VydmVyO1xuICAgIHZhciBvYmplY3Q7XG4gICAgdmFyIGRpc2NhcmRSZWNvcmRzID0gZmFsc2U7XG4gICAgdmFyIGZpcnN0ID0gdHJ1ZTtcblxuICAgIGZ1bmN0aW9uIGNhbGxiYWNrKHJlY29yZHMpIHtcbiAgICAgIGlmIChvYnNlcnZlciAmJiBvYnNlcnZlci5zdGF0ZV8gPT09IE9QRU5FRCAmJiAhZGlzY2FyZFJlY29yZHMpXG4gICAgICAgIG9ic2VydmVyLmNoZWNrXyhyZWNvcmRzKTtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgb3BlbjogZnVuY3Rpb24ob2JzKSB7XG4gICAgICAgIGlmIChvYnNlcnZlcilcbiAgICAgICAgICB0aHJvdyBFcnJvcignT2JzZXJ2ZWRPYmplY3QgaW4gdXNlJyk7XG5cbiAgICAgICAgaWYgKCFmaXJzdClcbiAgICAgICAgICBPYmplY3QuZGVsaXZlckNoYW5nZVJlY29yZHMoY2FsbGJhY2spO1xuXG4gICAgICAgIG9ic2VydmVyID0gb2JzO1xuICAgICAgICBmaXJzdCA9IGZhbHNlO1xuICAgICAgfSxcbiAgICAgIG9ic2VydmU6IGZ1bmN0aW9uKG9iaiwgYXJyYXlPYnNlcnZlKSB7XG4gICAgICAgIG9iamVjdCA9IG9iajtcbiAgICAgICAgaWYgKGFycmF5T2JzZXJ2ZSlcbiAgICAgICAgICBBcnJheS5vYnNlcnZlKG9iamVjdCwgY2FsbGJhY2spO1xuICAgICAgICBlbHNlXG4gICAgICAgICAgT2JqZWN0Lm9ic2VydmUob2JqZWN0LCBjYWxsYmFjayk7XG4gICAgICB9LFxuICAgICAgZGVsaXZlcjogZnVuY3Rpb24oZGlzY2FyZCkge1xuICAgICAgICBkaXNjYXJkUmVjb3JkcyA9IGRpc2NhcmQ7XG4gICAgICAgIE9iamVjdC5kZWxpdmVyQ2hhbmdlUmVjb3JkcyhjYWxsYmFjayk7XG4gICAgICAgIGRpc2NhcmRSZWNvcmRzID0gZmFsc2U7XG4gICAgICB9LFxuICAgICAgY2xvc2U6IGZ1bmN0aW9uKCkge1xuICAgICAgICBvYnNlcnZlciA9IHVuZGVmaW5lZDtcbiAgICAgICAgT2JqZWN0LnVub2JzZXJ2ZShvYmplY3QsIGNhbGxiYWNrKTtcbiAgICAgICAgb2JzZXJ2ZWRPYmplY3RDYWNoZS5wdXNoKHRoaXMpO1xuICAgICAgfVxuICAgIH07XG4gIH1cblxuICAvKlxuICAgKiBUaGUgb2JzZXJ2ZWRTZXQgYWJzdHJhY3Rpb24gaXMgYSBwZXJmIG9wdGltaXphdGlvbiB3aGljaCByZWR1Y2VzIHRoZSB0b3RhbFxuICAgKiBudW1iZXIgb2YgT2JqZWN0Lm9ic2VydmUgb2JzZXJ2YXRpb25zIG9mIGEgc2V0IG9mIG9iamVjdHMuIFRoZSBpZGVhIGlzIHRoYXRcbiAgICogZ3JvdXBzIG9mIE9ic2VydmVycyB3aWxsIGhhdmUgc29tZSBvYmplY3QgZGVwZW5kZW5jaWVzIGluIGNvbW1vbiBhbmQgdGhpc1xuICAgKiBvYnNlcnZlZCBzZXQgZW5zdXJlcyB0aGF0IGVhY2ggb2JqZWN0IGluIHRoZSB0cmFuc2l0aXZlIGNsb3N1cmUgb2ZcbiAgICogZGVwZW5kZW5jaWVzIGlzIG9ubHkgb2JzZXJ2ZWQgb25jZS4gVGhlIG9ic2VydmVkU2V0IGFjdHMgYXMgYSB3cml0ZSBiYXJyaWVyXG4gICAqIHN1Y2ggdGhhdCB3aGVuZXZlciBhbnkgY2hhbmdlIGNvbWVzIHRocm91Z2gsIGFsbCBPYnNlcnZlcnMgYXJlIGNoZWNrZWQgZm9yXG4gICAqIGNoYW5nZWQgdmFsdWVzLlxuICAgKlxuICAgKiBOb3RlIHRoYXQgdGhpcyBvcHRpbWl6YXRpb24gaXMgZXhwbGljaXRseSBtb3Zpbmcgd29yayBmcm9tIHNldHVwLXRpbWUgdG9cbiAgICogY2hhbmdlLXRpbWUuXG4gICAqXG4gICAqIFRPRE8ocmFmYWVsdyk6IEltcGxlbWVudCBcImdhcmJhZ2UgY29sbGVjdGlvblwiLiBJbiBvcmRlciB0byBtb3ZlIHdvcmsgb2ZmXG4gICAqIHRoZSBjcml0aWNhbCBwYXRoLCB3aGVuIE9ic2VydmVycyBhcmUgY2xvc2VkLCB0aGVpciBvYnNlcnZlZCBvYmplY3RzIGFyZVxuICAgKiBub3QgT2JqZWN0LnVub2JzZXJ2ZShkKS4gQXMgYSByZXN1bHQsIGl0J3NpZXN0YSBwb3NzaWJsZSB0aGF0IGlmIHRoZSBvYnNlcnZlZFNldFxuICAgKiBpcyBrZXB0IG9wZW4sIGJ1dCBzb21lIE9ic2VydmVycyBoYXZlIGJlZW4gY2xvc2VkLCBpdCBjb3VsZCBjYXVzZSBcImxlYWtzXCJcbiAgICogKHByZXZlbnQgb3RoZXJ3aXNlIGNvbGxlY3RhYmxlIG9iamVjdHMgZnJvbSBiZWluZyBjb2xsZWN0ZWQpLiBBdCBzb21lXG4gICAqIHBvaW50LCB3ZSBzaG91bGQgaW1wbGVtZW50IGluY3JlbWVudGFsIFwiZ2NcIiB3aGljaCBrZWVwcyBhIGxpc3Qgb2ZcbiAgICogb2JzZXJ2ZWRTZXRzIHdoaWNoIG1heSBuZWVkIGNsZWFuLXVwIGFuZCBkb2VzIHNtYWxsIGFtb3VudHMgb2YgY2xlYW51cCBvbiBhXG4gICAqIHRpbWVvdXQgdW50aWwgYWxsIGlzIGNsZWFuLlxuICAgKi9cblxuICBmdW5jdGlvbiBnZXRPYnNlcnZlZE9iamVjdChvYnNlcnZlciwgb2JqZWN0LCBhcnJheU9ic2VydmUpIHtcbiAgICB2YXIgZGlyID0gb2JzZXJ2ZWRPYmplY3RDYWNoZS5wb3AoKSB8fCBuZXdPYnNlcnZlZE9iamVjdCgpO1xuICAgIGRpci5vcGVuKG9ic2VydmVyKTtcbiAgICBkaXIub2JzZXJ2ZShvYmplY3QsIGFycmF5T2JzZXJ2ZSk7XG4gICAgcmV0dXJuIGRpcjtcbiAgfVxuXG4gIHZhciBvYnNlcnZlZFNldENhY2hlID0gW107XG5cbiAgZnVuY3Rpb24gbmV3T2JzZXJ2ZWRTZXQoKSB7XG4gICAgdmFyIG9ic2VydmVyQ291bnQgPSAwO1xuICAgIHZhciBvYnNlcnZlcnMgPSBbXTtcbiAgICB2YXIgb2JqZWN0cyA9IFtdO1xuICAgIHZhciByb290T2JqO1xuICAgIHZhciByb290T2JqUHJvcHM7XG5cbiAgICBmdW5jdGlvbiBvYnNlcnZlKG9iaiwgcHJvcCkge1xuICAgICAgaWYgKCFvYmopXG4gICAgICAgIHJldHVybjtcblxuICAgICAgaWYgKG9iaiA9PT0gcm9vdE9iailcbiAgICAgICAgcm9vdE9ialByb3BzW3Byb3BdID0gdHJ1ZTtcblxuICAgICAgaWYgKG9iamVjdHMuaW5kZXhPZihvYmopIDwgMCkge1xuICAgICAgICBvYmplY3RzLnB1c2gob2JqKTtcbiAgICAgICAgT2JqZWN0Lm9ic2VydmUob2JqLCBjYWxsYmFjayk7XG4gICAgICB9XG5cbiAgICAgIG9ic2VydmUoT2JqZWN0LmdldFByb3RvdHlwZU9mKG9iaiksIHByb3ApO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGFsbFJvb3RPYmpOb25PYnNlcnZlZFByb3BzKHJlY3MpIHtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcmVjcy5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgcmVjID0gcmVjc1tpXTtcbiAgICAgICAgaWYgKHJlYy5vYmplY3QgIT09IHJvb3RPYmogfHxcbiAgICAgICAgICAgIHJvb3RPYmpQcm9wc1tyZWMubmFtZV0gfHxcbiAgICAgICAgICAgIHJlYy50eXBlID09PSAnc2V0UHJvdG90eXBlJykge1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gY2FsbGJhY2socmVjcykge1xuICAgICAgaWYgKGFsbFJvb3RPYmpOb25PYnNlcnZlZFByb3BzKHJlY3MpKVxuICAgICAgICByZXR1cm47XG5cbiAgICAgIHZhciBvYnNlcnZlcjtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgb2JzZXJ2ZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIG9ic2VydmVyID0gb2JzZXJ2ZXJzW2ldO1xuICAgICAgICBpZiAob2JzZXJ2ZXIuc3RhdGVfID09IE9QRU5FRCkge1xuICAgICAgICAgIG9ic2VydmVyLml0ZXJhdGVPYmplY3RzXyhvYnNlcnZlKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IG9ic2VydmVycy5sZW5ndGg7IGkrKykge1xuICAgICAgICBvYnNlcnZlciA9IG9ic2VydmVyc1tpXTtcbiAgICAgICAgaWYgKG9ic2VydmVyLnN0YXRlXyA9PSBPUEVORUQpIHtcbiAgICAgICAgICBvYnNlcnZlci5jaGVja18oKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIHZhciByZWNvcmQgPSB7XG4gICAgICBvYmplY3Q6IHVuZGVmaW5lZCxcbiAgICAgIG9iamVjdHM6IG9iamVjdHMsXG4gICAgICBvcGVuOiBmdW5jdGlvbihvYnMsIG9iamVjdCkge1xuICAgICAgICBpZiAoIXJvb3RPYmopIHtcbiAgICAgICAgICByb290T2JqID0gb2JqZWN0O1xuICAgICAgICAgIHJvb3RPYmpQcm9wcyA9IHt9O1xuICAgICAgICB9XG5cbiAgICAgICAgb2JzZXJ2ZXJzLnB1c2gob2JzKTtcbiAgICAgICAgb2JzZXJ2ZXJDb3VudCsrO1xuICAgICAgICBvYnMuaXRlcmF0ZU9iamVjdHNfKG9ic2VydmUpO1xuICAgICAgfSxcbiAgICAgIGNsb3NlOiBmdW5jdGlvbihvYnMpIHtcbiAgICAgICAgb2JzZXJ2ZXJDb3VudC0tO1xuICAgICAgICBpZiAob2JzZXJ2ZXJDb3VudCA+IDApIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IG9iamVjdHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICBPYmplY3QudW5vYnNlcnZlKG9iamVjdHNbaV0sIGNhbGxiYWNrKTtcbiAgICAgICAgICBPYnNlcnZlci51bm9ic2VydmVkQ291bnQrKztcbiAgICAgICAgfVxuXG4gICAgICAgIG9ic2VydmVycy5sZW5ndGggPSAwO1xuICAgICAgICBvYmplY3RzLmxlbmd0aCA9IDA7XG4gICAgICAgIHJvb3RPYmogPSB1bmRlZmluZWQ7XG4gICAgICAgIHJvb3RPYmpQcm9wcyA9IHVuZGVmaW5lZDtcbiAgICAgICAgb2JzZXJ2ZWRTZXRDYWNoZS5wdXNoKHRoaXMpO1xuICAgICAgfVxuICAgIH07XG5cbiAgICByZXR1cm4gcmVjb3JkO1xuICB9XG5cbiAgdmFyIGxhc3RPYnNlcnZlZFNldDtcblxuICBmdW5jdGlvbiBnZXRPYnNlcnZlZFNldChvYnNlcnZlciwgb2JqKSB7XG4gICAgaWYgKCFsYXN0T2JzZXJ2ZWRTZXQgfHwgbGFzdE9ic2VydmVkU2V0Lm9iamVjdCAhPT0gb2JqKSB7XG4gICAgICBsYXN0T2JzZXJ2ZWRTZXQgPSBvYnNlcnZlZFNldENhY2hlLnBvcCgpIHx8IG5ld09ic2VydmVkU2V0KCk7XG4gICAgICBsYXN0T2JzZXJ2ZWRTZXQub2JqZWN0ID0gb2JqO1xuICAgIH1cbiAgICBsYXN0T2JzZXJ2ZWRTZXQub3BlbihvYnNlcnZlciwgb2JqKTtcbiAgICByZXR1cm4gbGFzdE9ic2VydmVkU2V0O1xuICB9XG5cbiAgdmFyIFVOT1BFTkVEID0gMDtcbiAgdmFyIE9QRU5FRCA9IDE7XG4gIHZhciBDTE9TRUQgPSAyO1xuICB2YXIgUkVTRVRUSU5HID0gMztcblxuICB2YXIgbmV4dE9ic2VydmVySWQgPSAxO1xuXG4gIGZ1bmN0aW9uIE9ic2VydmVyKCkge1xuICAgIHRoaXMuc3RhdGVfID0gVU5PUEVORUQ7XG4gICAgdGhpcy5jYWxsYmFja18gPSB1bmRlZmluZWQ7XG4gICAgdGhpcy50YXJnZXRfID0gdW5kZWZpbmVkOyAvLyBUT0RPKHJhZmFlbHcpOiBTaG91bGQgYmUgV2Vha1JlZlxuICAgIHRoaXMuZGlyZWN0T2JzZXJ2ZXJfID0gdW5kZWZpbmVkO1xuICAgIHRoaXMudmFsdWVfID0gdW5kZWZpbmVkO1xuICAgIHRoaXMuaWRfID0gbmV4dE9ic2VydmVySWQrKztcbiAgfVxuXG4gIE9ic2VydmVyLnByb3RvdHlwZSA9IHtcbiAgICBvcGVuOiBmdW5jdGlvbihjYWxsYmFjaywgdGFyZ2V0KSB7XG4gICAgICBpZiAodGhpcy5zdGF0ZV8gIT0gVU5PUEVORUQpXG4gICAgICAgIHRocm93IEVycm9yKCdPYnNlcnZlciBoYXMgYWxyZWFkeSBiZWVuIG9wZW5lZC4nKTtcblxuICAgICAgYWRkVG9BbGwodGhpcyk7XG4gICAgICB0aGlzLmNhbGxiYWNrXyA9IGNhbGxiYWNrO1xuICAgICAgdGhpcy50YXJnZXRfID0gdGFyZ2V0O1xuICAgICAgdGhpcy5jb25uZWN0XygpO1xuICAgICAgdGhpcy5zdGF0ZV8gPSBPUEVORUQ7XG4gICAgICByZXR1cm4gdGhpcy52YWx1ZV87XG4gICAgfSxcblxuICAgIGNsb3NlOiBmdW5jdGlvbigpIHtcbiAgICAgIGlmICh0aGlzLnN0YXRlXyAhPSBPUEVORUQpXG4gICAgICAgIHJldHVybjtcblxuICAgICAgcmVtb3ZlRnJvbUFsbCh0aGlzKTtcbiAgICAgIHRoaXMuZGlzY29ubmVjdF8oKTtcbiAgICAgIHRoaXMudmFsdWVfID0gdW5kZWZpbmVkO1xuICAgICAgdGhpcy5jYWxsYmFja18gPSB1bmRlZmluZWQ7XG4gICAgICB0aGlzLnRhcmdldF8gPSB1bmRlZmluZWQ7XG4gICAgICB0aGlzLnN0YXRlXyA9IENMT1NFRDtcbiAgICB9LFxuXG4gICAgZGVsaXZlcjogZnVuY3Rpb24oKSB7XG4gICAgICBpZiAodGhpcy5zdGF0ZV8gIT0gT1BFTkVEKVxuICAgICAgICByZXR1cm47XG5cbiAgICAgIGRpcnR5Q2hlY2sodGhpcyk7XG4gICAgfSxcblxuICAgIHJlcG9ydF86IGZ1bmN0aW9uKG1vZGVsRXZlbnRzKSB7XG4gICAgICB0cnkge1xuICAgICAgICB0aGlzLmNhbGxiYWNrXy5hcHBseSh0aGlzLnRhcmdldF8sIG1vZGVsRXZlbnRzKTtcbiAgICAgIH0gY2F0Y2ggKGV4KSB7XG4gICAgICAgIE9ic2VydmVyLl9lcnJvclRocm93bkR1cmluZ0NhbGxiYWNrID0gdHJ1ZTtcbiAgICAgICAgY29uc29sZS5lcnJvcignRXhjZXB0aW9uIGNhdWdodCBkdXJpbmcgb2JzZXJ2ZXIgY2FsbGJhY2s6ICcgK1xuICAgICAgICAgICAgICAgICAgICAgICAoZXguc3RhY2sgfHwgZXgpKTtcbiAgICAgIH1cbiAgICB9LFxuXG4gICAgZGlzY2FyZENoYW5nZXM6IGZ1bmN0aW9uKCkge1xuICAgICAgdGhpcy5jaGVja18odW5kZWZpbmVkLCB0cnVlKTtcbiAgICAgIHJldHVybiB0aGlzLnZhbHVlXztcbiAgICB9XG4gIH1cblxuICB2YXIgY29sbGVjdE9ic2VydmVycyA9ICFoYXNPYnNlcnZlO1xuICB2YXIgYWxsT2JzZXJ2ZXJzO1xuICBPYnNlcnZlci5fYWxsT2JzZXJ2ZXJzQ291bnQgPSAwO1xuXG4gIGlmIChjb2xsZWN0T2JzZXJ2ZXJzKSB7XG4gICAgYWxsT2JzZXJ2ZXJzID0gW107XG4gIH1cblxuICBmdW5jdGlvbiBhZGRUb0FsbChvYnNlcnZlcikge1xuICAgIE9ic2VydmVyLl9hbGxPYnNlcnZlcnNDb3VudCsrO1xuICAgIGlmICghY29sbGVjdE9ic2VydmVycylcbiAgICAgIHJldHVybjtcblxuICAgIGFsbE9ic2VydmVycy5wdXNoKG9ic2VydmVyKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlbW92ZUZyb21BbGwob2JzZXJ2ZXIpIHtcbiAgICBPYnNlcnZlci5fYWxsT2JzZXJ2ZXJzQ291bnQtLTtcbiAgfVxuXG4gIHZhciBydW5uaW5nTWljcm90YXNrQ2hlY2twb2ludCA9IGZhbHNlO1xuXG4gIHZhciBoYXNEZWJ1Z0ZvcmNlRnVsbERlbGl2ZXJ5ID0gaGFzT2JzZXJ2ZSAmJiBoYXNFdmFsICYmIChmdW5jdGlvbigpIHtcbiAgICB0cnkge1xuICAgICAgZXZhbCgnJVJ1bk1pY3JvdGFza3MoKScpO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSBjYXRjaCAoZXgpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH0pKCk7XG5cbiAgZ2xvYmFsLlBsYXRmb3JtID0gZ2xvYmFsLlBsYXRmb3JtIHx8IHt9O1xuXG4gIGdsb2JhbC5QbGF0Zm9ybS5wZXJmb3JtTWljcm90YXNrQ2hlY2twb2ludCA9IGZ1bmN0aW9uKCkge1xuICAgIGlmIChydW5uaW5nTWljcm90YXNrQ2hlY2twb2ludClcbiAgICAgIHJldHVybjtcblxuICAgIGlmIChoYXNEZWJ1Z0ZvcmNlRnVsbERlbGl2ZXJ5KSB7XG4gICAgICBldmFsKCclUnVuTWljcm90YXNrcygpJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKCFjb2xsZWN0T2JzZXJ2ZXJzKVxuICAgICAgcmV0dXJuO1xuXG4gICAgcnVubmluZ01pY3JvdGFza0NoZWNrcG9pbnQgPSB0cnVlO1xuXG4gICAgdmFyIGN5Y2xlcyA9IDA7XG4gICAgdmFyIGFueUNoYW5nZWQsIHRvQ2hlY2s7XG5cbiAgICBkbyB7XG4gICAgICBjeWNsZXMrKztcbiAgICAgIHRvQ2hlY2sgPSBhbGxPYnNlcnZlcnM7XG4gICAgICBhbGxPYnNlcnZlcnMgPSBbXTtcbiAgICAgIGFueUNoYW5nZWQgPSBmYWxzZTtcblxuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0b0NoZWNrLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciBvYnNlcnZlciA9IHRvQ2hlY2tbaV07XG4gICAgICAgIGlmIChvYnNlcnZlci5zdGF0ZV8gIT0gT1BFTkVEKVxuICAgICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICAgIGlmIChvYnNlcnZlci5jaGVja18oKSlcbiAgICAgICAgICBhbnlDaGFuZ2VkID0gdHJ1ZTtcblxuICAgICAgICBhbGxPYnNlcnZlcnMucHVzaChvYnNlcnZlcik7XG4gICAgICB9XG4gICAgICBpZiAocnVuRU9NVGFza3MoKSlcbiAgICAgICAgYW55Q2hhbmdlZCA9IHRydWU7XG4gICAgfSB3aGlsZSAoY3ljbGVzIDwgTUFYX0RJUlRZX0NIRUNLX0NZQ0xFUyAmJiBhbnlDaGFuZ2VkKTtcblxuICAgIGlmICh0ZXN0aW5nRXhwb3NlQ3ljbGVDb3VudClcbiAgICAgIGdsb2JhbC5kaXJ0eUNoZWNrQ3ljbGVDb3VudCA9IGN5Y2xlcztcblxuICAgIHJ1bm5pbmdNaWNyb3Rhc2tDaGVja3BvaW50ID0gZmFsc2U7XG4gIH07XG5cbiAgaWYgKGNvbGxlY3RPYnNlcnZlcnMpIHtcbiAgICBnbG9iYWwuUGxhdGZvcm0uY2xlYXJPYnNlcnZlcnMgPSBmdW5jdGlvbigpIHtcbiAgICAgIGFsbE9ic2VydmVycyA9IFtdO1xuICAgIH07XG4gIH1cblxuICBmdW5jdGlvbiBPYmplY3RPYnNlcnZlcihvYmplY3QpIHtcbiAgICBPYnNlcnZlci5jYWxsKHRoaXMpO1xuICAgIHRoaXMudmFsdWVfID0gb2JqZWN0O1xuICAgIHRoaXMub2xkT2JqZWN0XyA9IHVuZGVmaW5lZDtcbiAgfVxuXG4gIE9iamVjdE9ic2VydmVyLnByb3RvdHlwZSA9IGNyZWF0ZU9iamVjdCh7XG4gICAgX19wcm90b19fOiBPYnNlcnZlci5wcm90b3R5cGUsXG5cbiAgICBhcnJheU9ic2VydmU6IGZhbHNlLFxuXG4gICAgY29ubmVjdF86IGZ1bmN0aW9uKGNhbGxiYWNrLCB0YXJnZXQpIHtcbiAgICAgIGlmIChoYXNPYnNlcnZlKSB7XG4gICAgICAgIHRoaXMuZGlyZWN0T2JzZXJ2ZXJfID0gZ2V0T2JzZXJ2ZWRPYmplY3QodGhpcywgdGhpcy52YWx1ZV8sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5hcnJheU9ic2VydmUpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5vbGRPYmplY3RfID0gdGhpcy5jb3B5T2JqZWN0KHRoaXMudmFsdWVfKTtcbiAgICAgIH1cblxuICAgIH0sXG5cbiAgICBjb3B5T2JqZWN0OiBmdW5jdGlvbihvYmplY3QpIHtcbiAgICAgIHZhciBjb3B5ID0gQXJyYXkuaXNBcnJheShvYmplY3QpID8gW10gOiB7fTtcbiAgICAgIGZvciAodmFyIHByb3AgaW4gb2JqZWN0KSB7XG4gICAgICAgIGNvcHlbcHJvcF0gPSBvYmplY3RbcHJvcF07XG4gICAgICB9O1xuICAgICAgaWYgKEFycmF5LmlzQXJyYXkob2JqZWN0KSlcbiAgICAgICAgY29weS5sZW5ndGggPSBvYmplY3QubGVuZ3RoO1xuICAgICAgcmV0dXJuIGNvcHk7XG4gICAgfSxcblxuICAgIGNoZWNrXzogZnVuY3Rpb24oY2hhbmdlUmVjb3Jkcywgc2tpcENoYW5nZXMpIHtcbiAgICAgIHZhciBkaWZmO1xuICAgICAgdmFyIG9sZFZhbHVlcztcbiAgICAgIGlmIChoYXNPYnNlcnZlKSB7XG4gICAgICAgIGlmICghY2hhbmdlUmVjb3JkcylcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG5cbiAgICAgICAgb2xkVmFsdWVzID0ge307XG4gICAgICAgIGRpZmYgPSBkaWZmT2JqZWN0RnJvbUNoYW5nZVJlY29yZHModGhpcy52YWx1ZV8sIGNoYW5nZVJlY29yZHMsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb2xkVmFsdWVzKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG9sZFZhbHVlcyA9IHRoaXMub2xkT2JqZWN0XztcbiAgICAgICAgZGlmZiA9IGRpZmZPYmplY3RGcm9tT2xkT2JqZWN0KHRoaXMudmFsdWVfLCB0aGlzLm9sZE9iamVjdF8pO1xuICAgICAgfVxuXG4gICAgICBpZiAoZGlmZklzRW1wdHkoZGlmZikpXG4gICAgICAgIHJldHVybiBmYWxzZTtcblxuICAgICAgaWYgKCFoYXNPYnNlcnZlKVxuICAgICAgICB0aGlzLm9sZE9iamVjdF8gPSB0aGlzLmNvcHlPYmplY3QodGhpcy52YWx1ZV8pO1xuXG4gICAgICB0aGlzLnJlcG9ydF8oW1xuICAgICAgICBkaWZmLmFkZGVkIHx8IHt9LFxuICAgICAgICBkaWZmLnJlbW92ZWQgfHwge30sXG4gICAgICAgIGRpZmYuY2hhbmdlZCB8fCB7fSxcbiAgICAgICAgZnVuY3Rpb24ocHJvcGVydHkpIHtcbiAgICAgICAgICByZXR1cm4gb2xkVmFsdWVzW3Byb3BlcnR5XTtcbiAgICAgICAgfVxuICAgICAgXSk7XG5cbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0sXG5cbiAgICBkaXNjb25uZWN0XzogZnVuY3Rpb24oKSB7XG4gICAgICBpZiAoaGFzT2JzZXJ2ZSkge1xuICAgICAgICB0aGlzLmRpcmVjdE9ic2VydmVyXy5jbG9zZSgpO1xuICAgICAgICB0aGlzLmRpcmVjdE9ic2VydmVyXyA9IHVuZGVmaW5lZDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMub2xkT2JqZWN0XyA9IHVuZGVmaW5lZDtcbiAgICAgIH1cbiAgICB9LFxuXG4gICAgZGVsaXZlcjogZnVuY3Rpb24oKSB7XG4gICAgICBpZiAodGhpcy5zdGF0ZV8gIT0gT1BFTkVEKVxuICAgICAgICByZXR1cm47XG5cbiAgICAgIGlmIChoYXNPYnNlcnZlKVxuICAgICAgICB0aGlzLmRpcmVjdE9ic2VydmVyXy5kZWxpdmVyKGZhbHNlKTtcbiAgICAgIGVsc2VcbiAgICAgICAgZGlydHlDaGVjayh0aGlzKTtcbiAgICB9LFxuXG4gICAgZGlzY2FyZENoYW5nZXM6IGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKHRoaXMuZGlyZWN0T2JzZXJ2ZXJfKVxuICAgICAgICB0aGlzLmRpcmVjdE9ic2VydmVyXy5kZWxpdmVyKHRydWUpO1xuICAgICAgZWxzZVxuICAgICAgICB0aGlzLm9sZE9iamVjdF8gPSB0aGlzLmNvcHlPYmplY3QodGhpcy52YWx1ZV8pO1xuXG4gICAgICByZXR1cm4gdGhpcy52YWx1ZV87XG4gICAgfVxuICB9KTtcblxuICBmdW5jdGlvbiBBcnJheU9ic2VydmVyKGFycmF5KSB7XG4gICAgaWYgKCFBcnJheS5pc0FycmF5KGFycmF5KSlcbiAgICAgIHRocm93IEVycm9yKCdQcm92aWRlZCBvYmplY3QgaXMgbm90IGFuIEFycmF5Jyk7XG4gICAgT2JqZWN0T2JzZXJ2ZXIuY2FsbCh0aGlzLCBhcnJheSk7XG4gIH1cblxuICBBcnJheU9ic2VydmVyLnByb3RvdHlwZSA9IGNyZWF0ZU9iamVjdCh7XG5cbiAgICBfX3Byb3RvX186IE9iamVjdE9ic2VydmVyLnByb3RvdHlwZSxcblxuICAgIGFycmF5T2JzZXJ2ZTogdHJ1ZSxcblxuICAgIGNvcHlPYmplY3Q6IGZ1bmN0aW9uKGFycikge1xuICAgICAgcmV0dXJuIGFyci5zbGljZSgpO1xuICAgIH0sXG5cbiAgICBjaGVja186IGZ1bmN0aW9uKGNoYW5nZVJlY29yZHMpIHtcbiAgICAgIHZhciBzcGxpY2VzO1xuICAgICAgaWYgKGhhc09ic2VydmUpIHtcbiAgICAgICAgaWYgKCFjaGFuZ2VSZWNvcmRzKVxuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgc3BsaWNlcyA9IHByb2plY3RBcnJheVNwbGljZXModGhpcy52YWx1ZV8sIGNoYW5nZVJlY29yZHMpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc3BsaWNlcyA9IGNhbGNTcGxpY2VzKHRoaXMudmFsdWVfLCAwLCB0aGlzLnZhbHVlXy5sZW5ndGgsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLm9sZE9iamVjdF8sIDAsIHRoaXMub2xkT2JqZWN0Xy5sZW5ndGgpO1xuICAgICAgfVxuXG4gICAgICBpZiAoIXNwbGljZXMgfHwgIXNwbGljZXMubGVuZ3RoKVxuICAgICAgICByZXR1cm4gZmFsc2U7XG5cbiAgICAgIGlmICghaGFzT2JzZXJ2ZSlcbiAgICAgICAgdGhpcy5vbGRPYmplY3RfID0gdGhpcy5jb3B5T2JqZWN0KHRoaXMudmFsdWVfKTtcblxuICAgICAgdGhpcy5yZXBvcnRfKFtzcGxpY2VzXSk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gIH0pO1xuXG4gIEFycmF5T2JzZXJ2ZXIuYXBwbHlTcGxpY2VzID0gZnVuY3Rpb24ocHJldmlvdXMsIGN1cnJlbnQsIHNwbGljZXMpIHtcbiAgICBzcGxpY2VzLmZvckVhY2goZnVuY3Rpb24oc3BsaWNlKSB7XG4gICAgICB2YXIgc3BsaWNlQXJncyA9IFtzcGxpY2UuaW5kZXgsIHNwbGljZS5yZW1vdmVkLmxlbmd0aF07XG4gICAgICB2YXIgYWRkSW5kZXggPSBzcGxpY2UuaW5kZXg7XG4gICAgICB3aGlsZSAoYWRkSW5kZXggPCBzcGxpY2UuaW5kZXggKyBzcGxpY2UuYWRkZWRDb3VudCkge1xuICAgICAgICBzcGxpY2VBcmdzLnB1c2goY3VycmVudFthZGRJbmRleF0pO1xuICAgICAgICBhZGRJbmRleCsrO1xuICAgICAgfVxuXG4gICAgICBBcnJheS5wcm90b3R5cGUuc3BsaWNlLmFwcGx5KHByZXZpb3VzLCBzcGxpY2VBcmdzKTtcbiAgICB9KTtcbiAgfTtcblxuICBmdW5jdGlvbiBQYXRoT2JzZXJ2ZXIob2JqZWN0LCBwYXRoKSB7XG4gICAgT2JzZXJ2ZXIuY2FsbCh0aGlzKTtcblxuICAgIHRoaXMub2JqZWN0XyA9IG9iamVjdDtcbiAgICB0aGlzLnBhdGhfID0gZ2V0UGF0aChwYXRoKTtcbiAgICB0aGlzLmRpcmVjdE9ic2VydmVyXyA9IHVuZGVmaW5lZDtcbiAgfVxuXG4gIFBhdGhPYnNlcnZlci5wcm90b3R5cGUgPSBjcmVhdGVPYmplY3Qoe1xuICAgIF9fcHJvdG9fXzogT2JzZXJ2ZXIucHJvdG90eXBlLFxuXG4gICAgZ2V0IHBhdGgoKSB7XG4gICAgICByZXR1cm4gdGhpcy5wYXRoXztcbiAgICB9LFxuXG4gICAgY29ubmVjdF86IGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKGhhc09ic2VydmUpXG4gICAgICAgIHRoaXMuZGlyZWN0T2JzZXJ2ZXJfID0gZ2V0T2JzZXJ2ZWRTZXQodGhpcywgdGhpcy5vYmplY3RfKTtcblxuICAgICAgdGhpcy5jaGVja18odW5kZWZpbmVkLCB0cnVlKTtcbiAgICB9LFxuXG4gICAgZGlzY29ubmVjdF86IGZ1bmN0aW9uKCkge1xuICAgICAgdGhpcy52YWx1ZV8gPSB1bmRlZmluZWQ7XG5cbiAgICAgIGlmICh0aGlzLmRpcmVjdE9ic2VydmVyXykge1xuICAgICAgICB0aGlzLmRpcmVjdE9ic2VydmVyXy5jbG9zZSh0aGlzKTtcbiAgICAgICAgdGhpcy5kaXJlY3RPYnNlcnZlcl8gPSB1bmRlZmluZWQ7XG4gICAgICB9XG4gICAgfSxcblxuICAgIGl0ZXJhdGVPYmplY3RzXzogZnVuY3Rpb24ob2JzZXJ2ZSkge1xuICAgICAgdGhpcy5wYXRoXy5pdGVyYXRlT2JqZWN0cyh0aGlzLm9iamVjdF8sIG9ic2VydmUpO1xuICAgIH0sXG5cbiAgICBjaGVja186IGZ1bmN0aW9uKGNoYW5nZVJlY29yZHMsIHNraXBDaGFuZ2VzKSB7XG4gICAgICB2YXIgb2xkVmFsdWUgPSB0aGlzLnZhbHVlXztcbiAgICAgIHRoaXMudmFsdWVfID0gdGhpcy5wYXRoXy5nZXRWYWx1ZUZyb20odGhpcy5vYmplY3RfKTtcbiAgICAgIGlmIChza2lwQ2hhbmdlcyB8fCBhcmVTYW1lVmFsdWUodGhpcy52YWx1ZV8sIG9sZFZhbHVlKSlcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuXG4gICAgICB0aGlzLnJlcG9ydF8oW3RoaXMudmFsdWVfLCBvbGRWYWx1ZSwgdGhpc10pO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSxcblxuICAgIHNldFZhbHVlOiBmdW5jdGlvbihuZXdWYWx1ZSkge1xuICAgICAgaWYgKHRoaXMucGF0aF8pXG4gICAgICAgIHRoaXMucGF0aF8uc2V0VmFsdWVGcm9tKHRoaXMub2JqZWN0XywgbmV3VmFsdWUpO1xuICAgIH1cbiAgfSk7XG5cbiAgZnVuY3Rpb24gQ29tcG91bmRPYnNlcnZlcihyZXBvcnRDaGFuZ2VzT25PcGVuKSB7XG4gICAgT2JzZXJ2ZXIuY2FsbCh0aGlzKTtcblxuICAgIHRoaXMucmVwb3J0Q2hhbmdlc09uT3Blbl8gPSByZXBvcnRDaGFuZ2VzT25PcGVuO1xuICAgIHRoaXMudmFsdWVfID0gW107XG4gICAgdGhpcy5kaXJlY3RPYnNlcnZlcl8gPSB1bmRlZmluZWQ7XG4gICAgdGhpcy5vYnNlcnZlZF8gPSBbXTtcbiAgfVxuXG4gIHZhciBvYnNlcnZlclNlbnRpbmVsID0ge307XG5cbiAgQ29tcG91bmRPYnNlcnZlci5wcm90b3R5cGUgPSBjcmVhdGVPYmplY3Qoe1xuICAgIF9fcHJvdG9fXzogT2JzZXJ2ZXIucHJvdG90eXBlLFxuXG4gICAgY29ubmVjdF86IGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKGhhc09ic2VydmUpIHtcbiAgICAgICAgdmFyIG9iamVjdDtcbiAgICAgICAgdmFyIG5lZWRzRGlyZWN0T2JzZXJ2ZXIgPSBmYWxzZTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLm9ic2VydmVkXy5sZW5ndGg7IGkgKz0gMikge1xuICAgICAgICAgIG9iamVjdCA9IHRoaXMub2JzZXJ2ZWRfW2ldXG4gICAgICAgICAgaWYgKG9iamVjdCAhPT0gb2JzZXJ2ZXJTZW50aW5lbCkge1xuICAgICAgICAgICAgbmVlZHNEaXJlY3RPYnNlcnZlciA9IHRydWU7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobmVlZHNEaXJlY3RPYnNlcnZlcilcbiAgICAgICAgICB0aGlzLmRpcmVjdE9ic2VydmVyXyA9IGdldE9ic2VydmVkU2V0KHRoaXMsIG9iamVjdCk7XG4gICAgICB9XG5cbiAgICAgIHRoaXMuY2hlY2tfKHVuZGVmaW5lZCwgIXRoaXMucmVwb3J0Q2hhbmdlc09uT3Blbl8pO1xuICAgIH0sXG5cbiAgICBkaXNjb25uZWN0XzogZnVuY3Rpb24oKSB7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMub2JzZXJ2ZWRfLmxlbmd0aDsgaSArPSAyKSB7XG4gICAgICAgIGlmICh0aGlzLm9ic2VydmVkX1tpXSA9PT0gb2JzZXJ2ZXJTZW50aW5lbClcbiAgICAgICAgICB0aGlzLm9ic2VydmVkX1tpICsgMV0uY2xvc2UoKTtcbiAgICAgIH1cbiAgICAgIHRoaXMub2JzZXJ2ZWRfLmxlbmd0aCA9IDA7XG4gICAgICB0aGlzLnZhbHVlXy5sZW5ndGggPSAwO1xuXG4gICAgICBpZiAodGhpcy5kaXJlY3RPYnNlcnZlcl8pIHtcbiAgICAgICAgdGhpcy5kaXJlY3RPYnNlcnZlcl8uY2xvc2UodGhpcyk7XG4gICAgICAgIHRoaXMuZGlyZWN0T2JzZXJ2ZXJfID0gdW5kZWZpbmVkO1xuICAgICAgfVxuICAgIH0sXG5cbiAgICBhZGRQYXRoOiBmdW5jdGlvbihvYmplY3QsIHBhdGgpIHtcbiAgICAgIGlmICh0aGlzLnN0YXRlXyAhPSBVTk9QRU5FRCAmJiB0aGlzLnN0YXRlXyAhPSBSRVNFVFRJTkcpXG4gICAgICAgIHRocm93IEVycm9yKCdDYW5ub3QgYWRkIHBhdGhzIG9uY2Ugc3RhcnRlZC4nKTtcblxuICAgICAgdmFyIHBhdGggPSBnZXRQYXRoKHBhdGgpO1xuICAgICAgdGhpcy5vYnNlcnZlZF8ucHVzaChvYmplY3QsIHBhdGgpO1xuICAgICAgaWYgKCF0aGlzLnJlcG9ydENoYW5nZXNPbk9wZW5fKVxuICAgICAgICByZXR1cm47XG4gICAgICB2YXIgaW5kZXggPSB0aGlzLm9ic2VydmVkXy5sZW5ndGggLyAyIC0gMTtcbiAgICAgIHRoaXMudmFsdWVfW2luZGV4XSA9IHBhdGguZ2V0VmFsdWVGcm9tKG9iamVjdCk7XG4gICAgfSxcblxuICAgIGFkZE9ic2VydmVyOiBmdW5jdGlvbihvYnNlcnZlcikge1xuICAgICAgaWYgKHRoaXMuc3RhdGVfICE9IFVOT1BFTkVEICYmIHRoaXMuc3RhdGVfICE9IFJFU0VUVElORylcbiAgICAgICAgdGhyb3cgRXJyb3IoJ0Nhbm5vdCBhZGQgb2JzZXJ2ZXJzIG9uY2Ugc3RhcnRlZC4nKTtcblxuICAgICAgdGhpcy5vYnNlcnZlZF8ucHVzaChvYnNlcnZlclNlbnRpbmVsLCBvYnNlcnZlcik7XG4gICAgICBpZiAoIXRoaXMucmVwb3J0Q2hhbmdlc09uT3Blbl8pXG4gICAgICAgIHJldHVybjtcbiAgICAgIHZhciBpbmRleCA9IHRoaXMub2JzZXJ2ZWRfLmxlbmd0aCAvIDIgLSAxO1xuICAgICAgdGhpcy52YWx1ZV9baW5kZXhdID0gb2JzZXJ2ZXIub3Blbih0aGlzLmRlbGl2ZXIsIHRoaXMpO1xuICAgIH0sXG5cbiAgICBzdGFydFJlc2V0OiBmdW5jdGlvbigpIHtcbiAgICAgIGlmICh0aGlzLnN0YXRlXyAhPSBPUEVORUQpXG4gICAgICAgIHRocm93IEVycm9yKCdDYW4gb25seSByZXNldCB3aGlsZSBvcGVuJyk7XG5cbiAgICAgIHRoaXMuc3RhdGVfID0gUkVTRVRUSU5HO1xuICAgICAgdGhpcy5kaXNjb25uZWN0XygpO1xuICAgIH0sXG5cbiAgICBmaW5pc2hSZXNldDogZnVuY3Rpb24oKSB7XG4gICAgICBpZiAodGhpcy5zdGF0ZV8gIT0gUkVTRVRUSU5HKVxuICAgICAgICB0aHJvdyBFcnJvcignQ2FuIG9ubHkgZmluaXNoUmVzZXQgYWZ0ZXIgc3RhcnRSZXNldCcpO1xuICAgICAgdGhpcy5zdGF0ZV8gPSBPUEVORUQ7XG4gICAgICB0aGlzLmNvbm5lY3RfKCk7XG5cbiAgICAgIHJldHVybiB0aGlzLnZhbHVlXztcbiAgICB9LFxuXG4gICAgaXRlcmF0ZU9iamVjdHNfOiBmdW5jdGlvbihvYnNlcnZlKSB7XG4gICAgICB2YXIgb2JqZWN0O1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLm9ic2VydmVkXy5sZW5ndGg7IGkgKz0gMikge1xuICAgICAgICBvYmplY3QgPSB0aGlzLm9ic2VydmVkX1tpXVxuICAgICAgICBpZiAob2JqZWN0ICE9PSBvYnNlcnZlclNlbnRpbmVsKVxuICAgICAgICAgIHRoaXMub2JzZXJ2ZWRfW2kgKyAxXS5pdGVyYXRlT2JqZWN0cyhvYmplY3QsIG9ic2VydmUpXG4gICAgICB9XG4gICAgfSxcblxuICAgIGNoZWNrXzogZnVuY3Rpb24oY2hhbmdlUmVjb3Jkcywgc2tpcENoYW5nZXMpIHtcbiAgICAgIHZhciBvbGRWYWx1ZXM7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMub2JzZXJ2ZWRfLmxlbmd0aDsgaSArPSAyKSB7XG4gICAgICAgIHZhciBvYmplY3QgPSB0aGlzLm9ic2VydmVkX1tpXTtcbiAgICAgICAgdmFyIHBhdGggPSB0aGlzLm9ic2VydmVkX1tpKzFdO1xuICAgICAgICB2YXIgdmFsdWU7XG4gICAgICAgIGlmIChvYmplY3QgPT09IG9ic2VydmVyU2VudGluZWwpIHtcbiAgICAgICAgICB2YXIgb2JzZXJ2YWJsZSA9IHBhdGg7XG4gICAgICAgICAgdmFsdWUgPSB0aGlzLnN0YXRlXyA9PT0gVU5PUEVORUQgP1xuICAgICAgICAgICAgICBvYnNlcnZhYmxlLm9wZW4odGhpcy5kZWxpdmVyLCB0aGlzKSA6XG4gICAgICAgICAgICAgIG9ic2VydmFibGUuZGlzY2FyZENoYW5nZXMoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB2YWx1ZSA9IHBhdGguZ2V0VmFsdWVGcm9tKG9iamVjdCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoc2tpcENoYW5nZXMpIHtcbiAgICAgICAgICB0aGlzLnZhbHVlX1tpIC8gMl0gPSB2YWx1ZTtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChhcmVTYW1lVmFsdWUodmFsdWUsIHRoaXMudmFsdWVfW2kgLyAyXSkpXG4gICAgICAgICAgY29udGludWU7XG5cbiAgICAgICAgb2xkVmFsdWVzID0gb2xkVmFsdWVzIHx8IFtdO1xuICAgICAgICBvbGRWYWx1ZXNbaSAvIDJdID0gdGhpcy52YWx1ZV9baSAvIDJdO1xuICAgICAgICB0aGlzLnZhbHVlX1tpIC8gMl0gPSB2YWx1ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKCFvbGRWYWx1ZXMpXG4gICAgICAgIHJldHVybiBmYWxzZTtcblxuICAgICAgLy8gVE9ETyhyYWZhZWx3KTogSGF2aW5nIG9ic2VydmVkXyBhcyB0aGUgdGhpcmQgY2FsbGJhY2sgYXJnIGhlcmUgaXNcbiAgICAgIC8vIHByZXR0eSBsYW1lIEFQSS4gRml4LlxuICAgICAgdGhpcy5yZXBvcnRfKFt0aGlzLnZhbHVlXywgb2xkVmFsdWVzLCB0aGlzLm9ic2VydmVkX10pO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICB9KTtcblxuICBmdW5jdGlvbiBpZGVudEZuKHZhbHVlKSB7IHJldHVybiB2YWx1ZTsgfVxuXG4gIGZ1bmN0aW9uIE9ic2VydmVyVHJhbnNmb3JtKG9ic2VydmFibGUsIGdldFZhbHVlRm4sIHNldFZhbHVlRm4sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRvbnRQYXNzVGhyb3VnaFNldCkge1xuICAgIHRoaXMuY2FsbGJhY2tfID0gdW5kZWZpbmVkO1xuICAgIHRoaXMudGFyZ2V0XyA9IHVuZGVmaW5lZDtcbiAgICB0aGlzLnZhbHVlXyA9IHVuZGVmaW5lZDtcbiAgICB0aGlzLm9ic2VydmFibGVfID0gb2JzZXJ2YWJsZTtcbiAgICB0aGlzLmdldFZhbHVlRm5fID0gZ2V0VmFsdWVGbiB8fCBpZGVudEZuO1xuICAgIHRoaXMuc2V0VmFsdWVGbl8gPSBzZXRWYWx1ZUZuIHx8IGlkZW50Rm47XG4gICAgLy8gVE9ETyhyYWZhZWx3KTogVGhpcyBpcyBhIHRlbXBvcmFyeSBoYWNrLiBQb2x5bWVyRXhwcmVzc2lvbnMgbmVlZHMgdGhpc1xuICAgIC8vIGF0IHRoZSBtb21lbnQgYmVjYXVzZSBvZiBhIGJ1ZyBpbiBpdCdzaWVzdGEgZGVwZW5kZW5jeSB0cmFja2luZy5cbiAgICB0aGlzLmRvbnRQYXNzVGhyb3VnaFNldF8gPSBkb250UGFzc1Rocm91Z2hTZXQ7XG4gIH1cblxuICBPYnNlcnZlclRyYW5zZm9ybS5wcm90b3R5cGUgPSB7XG4gICAgb3BlbjogZnVuY3Rpb24oY2FsbGJhY2ssIHRhcmdldCkge1xuICAgICAgdGhpcy5jYWxsYmFja18gPSBjYWxsYmFjaztcbiAgICAgIHRoaXMudGFyZ2V0XyA9IHRhcmdldDtcbiAgICAgIHRoaXMudmFsdWVfID1cbiAgICAgICAgICB0aGlzLmdldFZhbHVlRm5fKHRoaXMub2JzZXJ2YWJsZV8ub3Blbih0aGlzLm9ic2VydmVkQ2FsbGJhY2tfLCB0aGlzKSk7XG4gICAgICByZXR1cm4gdGhpcy52YWx1ZV87XG4gICAgfSxcblxuICAgIG9ic2VydmVkQ2FsbGJhY2tfOiBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgdmFsdWUgPSB0aGlzLmdldFZhbHVlRm5fKHZhbHVlKTtcbiAgICAgIGlmIChhcmVTYW1lVmFsdWUodmFsdWUsIHRoaXMudmFsdWVfKSlcbiAgICAgICAgcmV0dXJuO1xuICAgICAgdmFyIG9sZFZhbHVlID0gdGhpcy52YWx1ZV87XG4gICAgICB0aGlzLnZhbHVlXyA9IHZhbHVlO1xuICAgICAgdGhpcy5jYWxsYmFja18uY2FsbCh0aGlzLnRhcmdldF8sIHRoaXMudmFsdWVfLCBvbGRWYWx1ZSk7XG4gICAgfSxcblxuICAgIGRpc2NhcmRDaGFuZ2VzOiBmdW5jdGlvbigpIHtcbiAgICAgIHRoaXMudmFsdWVfID0gdGhpcy5nZXRWYWx1ZUZuXyh0aGlzLm9ic2VydmFibGVfLmRpc2NhcmRDaGFuZ2VzKCkpO1xuICAgICAgcmV0dXJuIHRoaXMudmFsdWVfO1xuICAgIH0sXG5cbiAgICBkZWxpdmVyOiBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiB0aGlzLm9ic2VydmFibGVfLmRlbGl2ZXIoKTtcbiAgICB9LFxuXG4gICAgc2V0VmFsdWU6IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICB2YWx1ZSA9IHRoaXMuc2V0VmFsdWVGbl8odmFsdWUpO1xuICAgICAgaWYgKCF0aGlzLmRvbnRQYXNzVGhyb3VnaFNldF8gJiYgdGhpcy5vYnNlcnZhYmxlXy5zZXRWYWx1ZSlcbiAgICAgICAgcmV0dXJuIHRoaXMub2JzZXJ2YWJsZV8uc2V0VmFsdWUodmFsdWUpO1xuICAgIH0sXG5cbiAgICBjbG9zZTogZnVuY3Rpb24oKSB7XG4gICAgICBpZiAodGhpcy5vYnNlcnZhYmxlXylcbiAgICAgICAgdGhpcy5vYnNlcnZhYmxlXy5jbG9zZSgpO1xuICAgICAgdGhpcy5jYWxsYmFja18gPSB1bmRlZmluZWQ7XG4gICAgICB0aGlzLnRhcmdldF8gPSB1bmRlZmluZWQ7XG4gICAgICB0aGlzLm9ic2VydmFibGVfID0gdW5kZWZpbmVkO1xuICAgICAgdGhpcy52YWx1ZV8gPSB1bmRlZmluZWQ7XG4gICAgICB0aGlzLmdldFZhbHVlRm5fID0gdW5kZWZpbmVkO1xuICAgICAgdGhpcy5zZXRWYWx1ZUZuXyA9IHVuZGVmaW5lZDtcbiAgICB9XG4gIH1cblxuICB2YXIgZXhwZWN0ZWRSZWNvcmRUeXBlcyA9IHtcbiAgICBhZGQ6IHRydWUsXG4gICAgdXBkYXRlOiB0cnVlLFxuICAgIGRlbGV0ZTogdHJ1ZVxuICB9O1xuXG4gIGZ1bmN0aW9uIGRpZmZPYmplY3RGcm9tQ2hhbmdlUmVjb3JkcyhvYmplY3QsIGNoYW5nZVJlY29yZHMsIG9sZFZhbHVlcykge1xuICAgIHZhciBhZGRlZCA9IHt9O1xuICAgIHZhciByZW1vdmVkID0ge307XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNoYW5nZVJlY29yZHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciByZWNvcmQgPSBjaGFuZ2VSZWNvcmRzW2ldO1xuICAgICAgaWYgKCFleHBlY3RlZFJlY29yZFR5cGVzW3JlY29yZC50eXBlXSkge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdVbmtub3duIGNoYW5nZVJlY29yZCB0eXBlOiAnICsgcmVjb3JkLnR5cGUpO1xuICAgICAgICBjb25zb2xlLmVycm9yKHJlY29yZCk7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAoIShyZWNvcmQubmFtZSBpbiBvbGRWYWx1ZXMpKVxuICAgICAgICBvbGRWYWx1ZXNbcmVjb3JkLm5hbWVdID0gcmVjb3JkLm9sZFZhbHVlO1xuXG4gICAgICBpZiAocmVjb3JkLnR5cGUgPT0gJ3VwZGF0ZScpXG4gICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICBpZiAocmVjb3JkLnR5cGUgPT0gJ2FkZCcpIHtcbiAgICAgICAgaWYgKHJlY29yZC5uYW1lIGluIHJlbW92ZWQpXG4gICAgICAgICAgZGVsZXRlIHJlbW92ZWRbcmVjb3JkLm5hbWVdO1xuICAgICAgICBlbHNlXG4gICAgICAgICAgYWRkZWRbcmVjb3JkLm5hbWVdID0gdHJ1ZTtcblxuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgLy8gdHlwZSA9ICdkZWxldGUnXG4gICAgICBpZiAocmVjb3JkLm5hbWUgaW4gYWRkZWQpIHtcbiAgICAgICAgZGVsZXRlIGFkZGVkW3JlY29yZC5uYW1lXTtcbiAgICAgICAgZGVsZXRlIG9sZFZhbHVlc1tyZWNvcmQubmFtZV07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZW1vdmVkW3JlY29yZC5uYW1lXSA9IHRydWU7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZm9yICh2YXIgcHJvcCBpbiBhZGRlZClcbiAgICAgIGFkZGVkW3Byb3BdID0gb2JqZWN0W3Byb3BdO1xuXG4gICAgZm9yICh2YXIgcHJvcCBpbiByZW1vdmVkKVxuICAgICAgcmVtb3ZlZFtwcm9wXSA9IHVuZGVmaW5lZDtcblxuICAgIHZhciBjaGFuZ2VkID0ge307XG4gICAgZm9yICh2YXIgcHJvcCBpbiBvbGRWYWx1ZXMpIHtcbiAgICAgIGlmIChwcm9wIGluIGFkZGVkIHx8IHByb3AgaW4gcmVtb3ZlZClcbiAgICAgICAgY29udGludWU7XG5cbiAgICAgIHZhciBuZXdWYWx1ZSA9IG9iamVjdFtwcm9wXTtcbiAgICAgIGlmIChvbGRWYWx1ZXNbcHJvcF0gIT09IG5ld1ZhbHVlKVxuICAgICAgICBjaGFuZ2VkW3Byb3BdID0gbmV3VmFsdWU7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIGFkZGVkOiBhZGRlZCxcbiAgICAgIHJlbW92ZWQ6IHJlbW92ZWQsXG4gICAgICBjaGFuZ2VkOiBjaGFuZ2VkXG4gICAgfTtcbiAgfVxuXG4gIGZ1bmN0aW9uIG5ld1NwbGljZShpbmRleCwgcmVtb3ZlZCwgYWRkZWRDb3VudCkge1xuICAgIHJldHVybiB7XG4gICAgICBpbmRleDogaW5kZXgsXG4gICAgICByZW1vdmVkOiByZW1vdmVkLFxuICAgICAgYWRkZWRDb3VudDogYWRkZWRDb3VudFxuICAgIH07XG4gIH1cblxuICB2YXIgRURJVF9MRUFWRSA9IDA7XG4gIHZhciBFRElUX1VQREFURSA9IDE7XG4gIHZhciBFRElUX0FERCA9IDI7XG4gIHZhciBFRElUX0RFTEVURSA9IDM7XG5cbiAgZnVuY3Rpb24gQXJyYXlTcGxpY2UoKSB7fVxuXG4gIEFycmF5U3BsaWNlLnByb3RvdHlwZSA9IHtcblxuICAgIC8vIE5vdGU6IFRoaXMgZnVuY3Rpb24gaXMgKmJhc2VkKiBvbiB0aGUgY29tcHV0YXRpb24gb2YgdGhlIExldmVuc2h0ZWluXG4gICAgLy8gXCJlZGl0XCIgZGlzdGFuY2UuIFRoZSBvbmUgY2hhbmdlIGlzIHRoYXQgXCJ1cGRhdGVzXCIgYXJlIHRyZWF0ZWQgYXMgdHdvXG4gICAgLy8gZWRpdHMgLSBub3Qgb25lLiBXaXRoIEFycmF5IHNwbGljZXMsIGFuIHVwZGF0ZSBpcyByZWFsbHkgYSBkZWxldGVcbiAgICAvLyBmb2xsb3dlZCBieSBhbiBhZGQuIEJ5IHJldGFpbmluZyB0aGlzLCB3ZSBvcHRpbWl6ZSBmb3IgXCJrZWVwaW5nXCIgdGhlXG4gICAgLy8gbWF4aW11bSBhcnJheSBpdGVtcyBpbiB0aGUgb3JpZ2luYWwgYXJyYXkuIEZvciBleGFtcGxlOlxuICAgIC8vXG4gICAgLy8gICAneHh4eDEyMycgLT4gJzEyM3l5eXknXG4gICAgLy9cbiAgICAvLyBXaXRoIDEtZWRpdCB1cGRhdGVzLCB0aGUgc2hvcnRlc3QgcGF0aCB3b3VsZCBiZSBqdXN0IHRvIHVwZGF0ZSBhbGwgc2V2ZW5cbiAgICAvLyBjaGFyYWN0ZXJzLiBXaXRoIDItZWRpdCB1cGRhdGVzLCB3ZSBkZWxldGUgNCwgbGVhdmUgMywgYW5kIGFkZCA0LiBUaGlzXG4gICAgLy8gbGVhdmVzIHRoZSBzdWJzdHJpbmcgJzEyMycgaW50YWN0LlxuICAgIGNhbGNFZGl0RGlzdGFuY2VzOiBmdW5jdGlvbihjdXJyZW50LCBjdXJyZW50U3RhcnQsIGN1cnJlbnRFbmQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9sZCwgb2xkU3RhcnQsIG9sZEVuZCkge1xuICAgICAgLy8gXCJEZWxldGlvblwiIGNvbHVtbnNcbiAgICAgIHZhciByb3dDb3VudCA9IG9sZEVuZCAtIG9sZFN0YXJ0ICsgMTtcbiAgICAgIHZhciBjb2x1bW5Db3VudCA9IGN1cnJlbnRFbmQgLSBjdXJyZW50U3RhcnQgKyAxO1xuICAgICAgdmFyIGRpc3RhbmNlcyA9IG5ldyBBcnJheShyb3dDb3VudCk7XG5cbiAgICAgIC8vIFwiQWRkaXRpb25cIiByb3dzLiBJbml0aWFsaXplIG51bGwgY29sdW1uLlxuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCByb3dDb3VudDsgaSsrKSB7XG4gICAgICAgIGRpc3RhbmNlc1tpXSA9IG5ldyBBcnJheShjb2x1bW5Db3VudCk7XG4gICAgICAgIGRpc3RhbmNlc1tpXVswXSA9IGk7XG4gICAgICB9XG5cbiAgICAgIC8vIEluaXRpYWxpemUgbnVsbCByb3dcbiAgICAgIGZvciAodmFyIGogPSAwOyBqIDwgY29sdW1uQ291bnQ7IGorKylcbiAgICAgICAgZGlzdGFuY2VzWzBdW2pdID0gajtcblxuICAgICAgZm9yICh2YXIgaSA9IDE7IGkgPCByb3dDb3VudDsgaSsrKSB7XG4gICAgICAgIGZvciAodmFyIGogPSAxOyBqIDwgY29sdW1uQ291bnQ7IGorKykge1xuICAgICAgICAgIGlmICh0aGlzLmVxdWFscyhjdXJyZW50W2N1cnJlbnRTdGFydCArIGogLSAxXSwgb2xkW29sZFN0YXJ0ICsgaSAtIDFdKSlcbiAgICAgICAgICAgIGRpc3RhbmNlc1tpXVtqXSA9IGRpc3RhbmNlc1tpIC0gMV1baiAtIDFdO1xuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdmFyIG5vcnRoID0gZGlzdGFuY2VzW2kgLSAxXVtqXSArIDE7XG4gICAgICAgICAgICB2YXIgd2VzdCA9IGRpc3RhbmNlc1tpXVtqIC0gMV0gKyAxO1xuICAgICAgICAgICAgZGlzdGFuY2VzW2ldW2pdID0gbm9ydGggPCB3ZXN0ID8gbm9ydGggOiB3ZXN0O1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gZGlzdGFuY2VzO1xuICAgIH0sXG5cbiAgICAvLyBUaGlzIHN0YXJ0cyBhdCB0aGUgZmluYWwgd2VpZ2h0LCBhbmQgd2Fsa3MgXCJiYWNrd2FyZFwiIGJ5IGZpbmRpbmdcbiAgICAvLyB0aGUgbWluaW11bSBwcmV2aW91cyB3ZWlnaHQgcmVjdXJzaXZlbHkgdW50aWwgdGhlIG9yaWdpbiBvZiB0aGUgd2VpZ2h0XG4gICAgLy8gbWF0cml4LlxuICAgIHNwbGljZU9wZXJhdGlvbnNGcm9tRWRpdERpc3RhbmNlczogZnVuY3Rpb24oZGlzdGFuY2VzKSB7XG4gICAgICB2YXIgaSA9IGRpc3RhbmNlcy5sZW5ndGggLSAxO1xuICAgICAgdmFyIGogPSBkaXN0YW5jZXNbMF0ubGVuZ3RoIC0gMTtcbiAgICAgIHZhciBjdXJyZW50ID0gZGlzdGFuY2VzW2ldW2pdO1xuICAgICAgdmFyIGVkaXRzID0gW107XG4gICAgICB3aGlsZSAoaSA+IDAgfHwgaiA+IDApIHtcbiAgICAgICAgaWYgKGkgPT0gMCkge1xuICAgICAgICAgIGVkaXRzLnB1c2goRURJVF9BREQpO1xuICAgICAgICAgIGotLTtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoaiA9PSAwKSB7XG4gICAgICAgICAgZWRpdHMucHVzaChFRElUX0RFTEVURSk7XG4gICAgICAgICAgaS0tO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIHZhciBub3J0aFdlc3QgPSBkaXN0YW5jZXNbaSAtIDFdW2ogLSAxXTtcbiAgICAgICAgdmFyIHdlc3QgPSBkaXN0YW5jZXNbaSAtIDFdW2pdO1xuICAgICAgICB2YXIgbm9ydGggPSBkaXN0YW5jZXNbaV1baiAtIDFdO1xuXG4gICAgICAgIHZhciBtaW47XG4gICAgICAgIGlmICh3ZXN0IDwgbm9ydGgpXG4gICAgICAgICAgbWluID0gd2VzdCA8IG5vcnRoV2VzdCA/IHdlc3QgOiBub3J0aFdlc3Q7XG4gICAgICAgIGVsc2VcbiAgICAgICAgICBtaW4gPSBub3J0aCA8IG5vcnRoV2VzdCA/IG5vcnRoIDogbm9ydGhXZXN0O1xuXG4gICAgICAgIGlmIChtaW4gPT0gbm9ydGhXZXN0KSB7XG4gICAgICAgICAgaWYgKG5vcnRoV2VzdCA9PSBjdXJyZW50KSB7XG4gICAgICAgICAgICBlZGl0cy5wdXNoKEVESVRfTEVBVkUpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBlZGl0cy5wdXNoKEVESVRfVVBEQVRFKTtcbiAgICAgICAgICAgIGN1cnJlbnQgPSBub3J0aFdlc3Q7XG4gICAgICAgICAgfVxuICAgICAgICAgIGktLTtcbiAgICAgICAgICBqLS07XG4gICAgICAgIH0gZWxzZSBpZiAobWluID09IHdlc3QpIHtcbiAgICAgICAgICBlZGl0cy5wdXNoKEVESVRfREVMRVRFKTtcbiAgICAgICAgICBpLS07XG4gICAgICAgICAgY3VycmVudCA9IHdlc3Q7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZWRpdHMucHVzaChFRElUX0FERCk7XG4gICAgICAgICAgai0tO1xuICAgICAgICAgIGN1cnJlbnQgPSBub3J0aDtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBlZGl0cy5yZXZlcnNlKCk7XG4gICAgICByZXR1cm4gZWRpdHM7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFNwbGljZSBQcm9qZWN0aW9uIGZ1bmN0aW9uczpcbiAgICAgKlxuICAgICAqIEEgc3BsaWNlIG1hcCBpcyBhIHJlcHJlc2VudGF0aW9uIG9mIGhvdyBhIHByZXZpb3VzIGFycmF5IG9mIGl0ZW1zXG4gICAgICogd2FzIHRyYW5zZm9ybWVkIGludG8gYSBuZXcgYXJyYXkgb2YgaXRlbXMuIENvbmNlcHR1YWxseSBpdCBpcyBhIGxpc3Qgb2ZcbiAgICAgKiB0dXBsZXMgb2ZcbiAgICAgKlxuICAgICAqICAgPGluZGV4LCByZW1vdmVkLCBhZGRlZENvdW50PlxuICAgICAqXG4gICAgICogd2hpY2ggYXJlIGtlcHQgaW4gYXNjZW5kaW5nIGluZGV4IG9yZGVyIG9mLiBUaGUgdHVwbGUgcmVwcmVzZW50cyB0aGF0IGF0XG4gICAgICogdGhlIHxpbmRleHwsIHxyZW1vdmVkfCBzZXF1ZW5jZSBvZiBpdGVtcyB3ZXJlIHJlbW92ZWQsIGFuZCBjb3VudGluZyBmb3J3YXJkXG4gICAgICogZnJvbSB8aW5kZXh8LCB8YWRkZWRDb3VudHwgaXRlbXMgd2VyZSBhZGRlZC5cbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIExhY2tpbmcgaW5kaXZpZHVhbCBzcGxpY2UgbXV0YXRpb24gaW5mb3JtYXRpb24sIHRoZSBtaW5pbWFsIHNldCBvZlxuICAgICAqIHNwbGljZXMgY2FuIGJlIHN5bnRoZXNpemVkIGdpdmVuIHRoZSBwcmV2aW91cyBzdGF0ZSBhbmQgZmluYWwgc3RhdGUgb2YgYW5cbiAgICAgKiBhcnJheS4gVGhlIGJhc2ljIGFwcHJvYWNoIGlzIHRvIGNhbGN1bGF0ZSB0aGUgZWRpdCBkaXN0YW5jZSBtYXRyaXggYW5kXG4gICAgICogY2hvb3NlIHRoZSBzaG9ydGVzdCBwYXRoIHRocm91Z2ggaXQuXG4gICAgICpcbiAgICAgKiBDb21wbGV4aXR5OiBPKGwgKiBwKVxuICAgICAqICAgbDogVGhlIGxlbmd0aCBvZiB0aGUgY3VycmVudCBhcnJheVxuICAgICAqICAgcDogVGhlIGxlbmd0aCBvZiB0aGUgb2xkIGFycmF5XG4gICAgICovXG4gICAgY2FsY1NwbGljZXM6IGZ1bmN0aW9uKGN1cnJlbnQsIGN1cnJlbnRTdGFydCwgY3VycmVudEVuZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgb2xkLCBvbGRTdGFydCwgb2xkRW5kKSB7XG4gICAgICB2YXIgcHJlZml4Q291bnQgPSAwO1xuICAgICAgdmFyIHN1ZmZpeENvdW50ID0gMDtcblxuICAgICAgdmFyIG1pbkxlbmd0aCA9IE1hdGgubWluKGN1cnJlbnRFbmQgLSBjdXJyZW50U3RhcnQsIG9sZEVuZCAtIG9sZFN0YXJ0KTtcbiAgICAgIGlmIChjdXJyZW50U3RhcnQgPT0gMCAmJiBvbGRTdGFydCA9PSAwKVxuICAgICAgICBwcmVmaXhDb3VudCA9IHRoaXMuc2hhcmVkUHJlZml4KGN1cnJlbnQsIG9sZCwgbWluTGVuZ3RoKTtcblxuICAgICAgaWYgKGN1cnJlbnRFbmQgPT0gY3VycmVudC5sZW5ndGggJiYgb2xkRW5kID09IG9sZC5sZW5ndGgpXG4gICAgICAgIHN1ZmZpeENvdW50ID0gdGhpcy5zaGFyZWRTdWZmaXgoY3VycmVudCwgb2xkLCBtaW5MZW5ndGggLSBwcmVmaXhDb3VudCk7XG5cbiAgICAgIGN1cnJlbnRTdGFydCArPSBwcmVmaXhDb3VudDtcbiAgICAgIG9sZFN0YXJ0ICs9IHByZWZpeENvdW50O1xuICAgICAgY3VycmVudEVuZCAtPSBzdWZmaXhDb3VudDtcbiAgICAgIG9sZEVuZCAtPSBzdWZmaXhDb3VudDtcblxuICAgICAgaWYgKGN1cnJlbnRFbmQgLSBjdXJyZW50U3RhcnQgPT0gMCAmJiBvbGRFbmQgLSBvbGRTdGFydCA9PSAwKVxuICAgICAgICByZXR1cm4gW107XG5cbiAgICAgIGlmIChjdXJyZW50U3RhcnQgPT0gY3VycmVudEVuZCkge1xuICAgICAgICB2YXIgc3BsaWNlID0gbmV3U3BsaWNlKGN1cnJlbnRTdGFydCwgW10sIDApO1xuICAgICAgICB3aGlsZSAob2xkU3RhcnQgPCBvbGRFbmQpXG4gICAgICAgICAgc3BsaWNlLnJlbW92ZWQucHVzaChvbGRbb2xkU3RhcnQrK10pO1xuXG4gICAgICAgIHJldHVybiBbIHNwbGljZSBdO1xuICAgICAgfSBlbHNlIGlmIChvbGRTdGFydCA9PSBvbGRFbmQpXG4gICAgICAgIHJldHVybiBbIG5ld1NwbGljZShjdXJyZW50U3RhcnQsIFtdLCBjdXJyZW50RW5kIC0gY3VycmVudFN0YXJ0KSBdO1xuXG4gICAgICB2YXIgb3BzID0gdGhpcy5zcGxpY2VPcGVyYXRpb25zRnJvbUVkaXREaXN0YW5jZXMoXG4gICAgICAgICAgdGhpcy5jYWxjRWRpdERpc3RhbmNlcyhjdXJyZW50LCBjdXJyZW50U3RhcnQsIGN1cnJlbnRFbmQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbGQsIG9sZFN0YXJ0LCBvbGRFbmQpKTtcblxuICAgICAgdmFyIHNwbGljZSA9IHVuZGVmaW5lZDtcbiAgICAgIHZhciBzcGxpY2VzID0gW107XG4gICAgICB2YXIgaW5kZXggPSBjdXJyZW50U3RhcnQ7XG4gICAgICB2YXIgb2xkSW5kZXggPSBvbGRTdGFydDtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgb3BzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHN3aXRjaChvcHNbaV0pIHtcbiAgICAgICAgICBjYXNlIEVESVRfTEVBVkU6XG4gICAgICAgICAgICBpZiAoc3BsaWNlKSB7XG4gICAgICAgICAgICAgIHNwbGljZXMucHVzaChzcGxpY2UpO1xuICAgICAgICAgICAgICBzcGxpY2UgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGluZGV4Kys7XG4gICAgICAgICAgICBvbGRJbmRleCsrO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSBFRElUX1VQREFURTpcbiAgICAgICAgICAgIGlmICghc3BsaWNlKVxuICAgICAgICAgICAgICBzcGxpY2UgPSBuZXdTcGxpY2UoaW5kZXgsIFtdLCAwKTtcblxuICAgICAgICAgICAgc3BsaWNlLmFkZGVkQ291bnQrKztcbiAgICAgICAgICAgIGluZGV4Kys7XG5cbiAgICAgICAgICAgIHNwbGljZS5yZW1vdmVkLnB1c2gob2xkW29sZEluZGV4XSk7XG4gICAgICAgICAgICBvbGRJbmRleCsrO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSBFRElUX0FERDpcbiAgICAgICAgICAgIGlmICghc3BsaWNlKVxuICAgICAgICAgICAgICBzcGxpY2UgPSBuZXdTcGxpY2UoaW5kZXgsIFtdLCAwKTtcblxuICAgICAgICAgICAgc3BsaWNlLmFkZGVkQ291bnQrKztcbiAgICAgICAgICAgIGluZGV4Kys7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlIEVESVRfREVMRVRFOlxuICAgICAgICAgICAgaWYgKCFzcGxpY2UpXG4gICAgICAgICAgICAgIHNwbGljZSA9IG5ld1NwbGljZShpbmRleCwgW10sIDApO1xuXG4gICAgICAgICAgICBzcGxpY2UucmVtb3ZlZC5wdXNoKG9sZFtvbGRJbmRleF0pO1xuICAgICAgICAgICAgb2xkSW5kZXgrKztcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChzcGxpY2UpIHtcbiAgICAgICAgc3BsaWNlcy5wdXNoKHNwbGljZSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gc3BsaWNlcztcbiAgICB9LFxuXG4gICAgc2hhcmVkUHJlZml4OiBmdW5jdGlvbihjdXJyZW50LCBvbGQsIHNlYXJjaExlbmd0aCkge1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzZWFyY2hMZW5ndGg7IGkrKylcbiAgICAgICAgaWYgKCF0aGlzLmVxdWFscyhjdXJyZW50W2ldLCBvbGRbaV0pKVxuICAgICAgICAgIHJldHVybiBpO1xuICAgICAgcmV0dXJuIHNlYXJjaExlbmd0aDtcbiAgICB9LFxuXG4gICAgc2hhcmVkU3VmZml4OiBmdW5jdGlvbihjdXJyZW50LCBvbGQsIHNlYXJjaExlbmd0aCkge1xuICAgICAgdmFyIGluZGV4MSA9IGN1cnJlbnQubGVuZ3RoO1xuICAgICAgdmFyIGluZGV4MiA9IG9sZC5sZW5ndGg7XG4gICAgICB2YXIgY291bnQgPSAwO1xuICAgICAgd2hpbGUgKGNvdW50IDwgc2VhcmNoTGVuZ3RoICYmIHRoaXMuZXF1YWxzKGN1cnJlbnRbLS1pbmRleDFdLCBvbGRbLS1pbmRleDJdKSlcbiAgICAgICAgY291bnQrKztcblxuICAgICAgcmV0dXJuIGNvdW50O1xuICAgIH0sXG5cbiAgICBjYWxjdWxhdGVTcGxpY2VzOiBmdW5jdGlvbihjdXJyZW50LCBwcmV2aW91cykge1xuICAgICAgcmV0dXJuIHRoaXMuY2FsY1NwbGljZXMoY3VycmVudCwgMCwgY3VycmVudC5sZW5ndGgsIHByZXZpb3VzLCAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJldmlvdXMubGVuZ3RoKTtcbiAgICB9LFxuXG4gICAgZXF1YWxzOiBmdW5jdGlvbihjdXJyZW50VmFsdWUsIHByZXZpb3VzVmFsdWUpIHtcbiAgICAgIHJldHVybiBjdXJyZW50VmFsdWUgPT09IHByZXZpb3VzVmFsdWU7XG4gICAgfVxuICB9O1xuXG4gIHZhciBhcnJheVNwbGljZSA9IG5ldyBBcnJheVNwbGljZSgpO1xuXG4gIGZ1bmN0aW9uIGNhbGNTcGxpY2VzKGN1cnJlbnQsIGN1cnJlbnRTdGFydCwgY3VycmVudEVuZCxcbiAgICAgICAgICAgICAgICAgICAgICAgb2xkLCBvbGRTdGFydCwgb2xkRW5kKSB7XG4gICAgcmV0dXJuIGFycmF5U3BsaWNlLmNhbGNTcGxpY2VzKGN1cnJlbnQsIGN1cnJlbnRTdGFydCwgY3VycmVudEVuZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb2xkLCBvbGRTdGFydCwgb2xkRW5kKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGludGVyc2VjdChzdGFydDEsIGVuZDEsIHN0YXJ0MiwgZW5kMikge1xuICAgIC8vIERpc2pvaW50XG4gICAgaWYgKGVuZDEgPCBzdGFydDIgfHwgZW5kMiA8IHN0YXJ0MSlcbiAgICAgIHJldHVybiAtMTtcblxuICAgIC8vIEFkamFjZW50XG4gICAgaWYgKGVuZDEgPT0gc3RhcnQyIHx8IGVuZDIgPT0gc3RhcnQxKVxuICAgICAgcmV0dXJuIDA7XG5cbiAgICAvLyBOb24temVybyBpbnRlcnNlY3QsIHNwYW4xIGZpcnN0XG4gICAgaWYgKHN0YXJ0MSA8IHN0YXJ0Mikge1xuICAgICAgaWYgKGVuZDEgPCBlbmQyKVxuICAgICAgICByZXR1cm4gZW5kMSAtIHN0YXJ0MjsgLy8gT3ZlcmxhcFxuICAgICAgZWxzZVxuICAgICAgICByZXR1cm4gZW5kMiAtIHN0YXJ0MjsgLy8gQ29udGFpbmVkXG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIE5vbi16ZXJvIGludGVyc2VjdCwgc3BhbjIgZmlyc3RcbiAgICAgIGlmIChlbmQyIDwgZW5kMSlcbiAgICAgICAgcmV0dXJuIGVuZDIgLSBzdGFydDE7IC8vIE92ZXJsYXBcbiAgICAgIGVsc2VcbiAgICAgICAgcmV0dXJuIGVuZDEgLSBzdGFydDE7IC8vIENvbnRhaW5lZFxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIG1lcmdlU3BsaWNlKHNwbGljZXMsIGluZGV4LCByZW1vdmVkLCBhZGRlZENvdW50KSB7XG5cbiAgICB2YXIgc3BsaWNlID0gbmV3U3BsaWNlKGluZGV4LCByZW1vdmVkLCBhZGRlZENvdW50KTtcblxuICAgIHZhciBpbnNlcnRlZCA9IGZhbHNlO1xuICAgIHZhciBpbnNlcnRpb25PZmZzZXQgPSAwO1xuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzcGxpY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgY3VycmVudCA9IHNwbGljZXNbaV07XG4gICAgICBjdXJyZW50LmluZGV4ICs9IGluc2VydGlvbk9mZnNldDtcblxuICAgICAgaWYgKGluc2VydGVkKVxuICAgICAgICBjb250aW51ZTtcblxuICAgICAgdmFyIGludGVyc2VjdENvdW50ID0gaW50ZXJzZWN0KHNwbGljZS5pbmRleCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzcGxpY2UuaW5kZXggKyBzcGxpY2UucmVtb3ZlZC5sZW5ndGgsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY3VycmVudC5pbmRleCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjdXJyZW50LmluZGV4ICsgY3VycmVudC5hZGRlZENvdW50KTtcblxuICAgICAgaWYgKGludGVyc2VjdENvdW50ID49IDApIHtcbiAgICAgICAgLy8gTWVyZ2UgdGhlIHR3byBzcGxpY2VzXG5cbiAgICAgICAgc3BsaWNlcy5zcGxpY2UoaSwgMSk7XG4gICAgICAgIGktLTtcblxuICAgICAgICBpbnNlcnRpb25PZmZzZXQgLT0gY3VycmVudC5hZGRlZENvdW50IC0gY3VycmVudC5yZW1vdmVkLmxlbmd0aDtcblxuICAgICAgICBzcGxpY2UuYWRkZWRDb3VudCArPSBjdXJyZW50LmFkZGVkQ291bnQgLSBpbnRlcnNlY3RDb3VudDtcbiAgICAgICAgdmFyIGRlbGV0ZUNvdW50ID0gc3BsaWNlLnJlbW92ZWQubGVuZ3RoICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgY3VycmVudC5yZW1vdmVkLmxlbmd0aCAtIGludGVyc2VjdENvdW50O1xuXG4gICAgICAgIGlmICghc3BsaWNlLmFkZGVkQ291bnQgJiYgIWRlbGV0ZUNvdW50KSB7XG4gICAgICAgICAgLy8gbWVyZ2VkIHNwbGljZSBpcyBhIG5vb3AuIGRpc2NhcmQuXG4gICAgICAgICAgaW5zZXJ0ZWQgPSB0cnVlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHZhciByZW1vdmVkID0gY3VycmVudC5yZW1vdmVkO1xuXG4gICAgICAgICAgaWYgKHNwbGljZS5pbmRleCA8IGN1cnJlbnQuaW5kZXgpIHtcbiAgICAgICAgICAgIC8vIHNvbWUgcHJlZml4IG9mIHNwbGljZS5yZW1vdmVkIGlzIHByZXBlbmRlZCB0byBjdXJyZW50LnJlbW92ZWQuXG4gICAgICAgICAgICB2YXIgcHJlcGVuZCA9IHNwbGljZS5yZW1vdmVkLnNsaWNlKDAsIGN1cnJlbnQuaW5kZXggLSBzcGxpY2UuaW5kZXgpO1xuICAgICAgICAgICAgQXJyYXkucHJvdG90eXBlLnB1c2guYXBwbHkocHJlcGVuZCwgcmVtb3ZlZCk7XG4gICAgICAgICAgICByZW1vdmVkID0gcHJlcGVuZDtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoc3BsaWNlLmluZGV4ICsgc3BsaWNlLnJlbW92ZWQubGVuZ3RoID4gY3VycmVudC5pbmRleCArIGN1cnJlbnQuYWRkZWRDb3VudCkge1xuICAgICAgICAgICAgLy8gc29tZSBzdWZmaXggb2Ygc3BsaWNlLnJlbW92ZWQgaXMgYXBwZW5kZWQgdG8gY3VycmVudC5yZW1vdmVkLlxuICAgICAgICAgICAgdmFyIGFwcGVuZCA9IHNwbGljZS5yZW1vdmVkLnNsaWNlKGN1cnJlbnQuaW5kZXggKyBjdXJyZW50LmFkZGVkQ291bnQgLSBzcGxpY2UuaW5kZXgpO1xuICAgICAgICAgICAgQXJyYXkucHJvdG90eXBlLnB1c2guYXBwbHkocmVtb3ZlZCwgYXBwZW5kKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBzcGxpY2UucmVtb3ZlZCA9IHJlbW92ZWQ7XG4gICAgICAgICAgaWYgKGN1cnJlbnQuaW5kZXggPCBzcGxpY2UuaW5kZXgpIHtcbiAgICAgICAgICAgIHNwbGljZS5pbmRleCA9IGN1cnJlbnQuaW5kZXg7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKHNwbGljZS5pbmRleCA8IGN1cnJlbnQuaW5kZXgpIHtcbiAgICAgICAgLy8gSW5zZXJ0IHNwbGljZSBoZXJlLlxuXG4gICAgICAgIGluc2VydGVkID0gdHJ1ZTtcblxuICAgICAgICBzcGxpY2VzLnNwbGljZShpLCAwLCBzcGxpY2UpO1xuICAgICAgICBpKys7XG5cbiAgICAgICAgdmFyIG9mZnNldCA9IHNwbGljZS5hZGRlZENvdW50IC0gc3BsaWNlLnJlbW92ZWQubGVuZ3RoXG4gICAgICAgIGN1cnJlbnQuaW5kZXggKz0gb2Zmc2V0O1xuICAgICAgICBpbnNlcnRpb25PZmZzZXQgKz0gb2Zmc2V0O1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmICghaW5zZXJ0ZWQpXG4gICAgICBzcGxpY2VzLnB1c2goc3BsaWNlKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGNyZWF0ZUluaXRpYWxTcGxpY2VzKGFycmF5LCBjaGFuZ2VSZWNvcmRzKSB7XG4gICAgdmFyIHNwbGljZXMgPSBbXTtcblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY2hhbmdlUmVjb3Jkcy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIHJlY29yZCA9IGNoYW5nZVJlY29yZHNbaV07XG4gICAgICBzd2l0Y2gocmVjb3JkLnR5cGUpIHtcbiAgICAgICAgY2FzZSAnc3BsaWNlJzpcbiAgICAgICAgICBtZXJnZVNwbGljZShzcGxpY2VzLCByZWNvcmQuaW5kZXgsIHJlY29yZC5yZW1vdmVkLnNsaWNlKCksIHJlY29yZC5hZGRlZENvdW50KTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnYWRkJzpcbiAgICAgICAgY2FzZSAndXBkYXRlJzpcbiAgICAgICAgY2FzZSAnZGVsZXRlJzpcbiAgICAgICAgICBpZiAoIWlzSW5kZXgocmVjb3JkLm5hbWUpKVxuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgdmFyIGluZGV4ID0gdG9OdW1iZXIocmVjb3JkLm5hbWUpO1xuICAgICAgICAgIGlmIChpbmRleCA8IDApXG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICBtZXJnZVNwbGljZShzcGxpY2VzLCBpbmRleCwgW3JlY29yZC5vbGRWYWx1ZV0sIDEpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1VuZXhwZWN0ZWQgcmVjb3JkIHR5cGU6ICcgKyBKU09OLnN0cmluZ2lmeShyZWNvcmQpKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gc3BsaWNlcztcbiAgfVxuXG4gIGZ1bmN0aW9uIHByb2plY3RBcnJheVNwbGljZXMoYXJyYXksIGNoYW5nZVJlY29yZHMpIHtcbiAgICB2YXIgc3BsaWNlcyA9IFtdO1xuXG4gICAgY3JlYXRlSW5pdGlhbFNwbGljZXMoYXJyYXksIGNoYW5nZVJlY29yZHMpLmZvckVhY2goZnVuY3Rpb24oc3BsaWNlKSB7XG4gICAgICBpZiAoc3BsaWNlLmFkZGVkQ291bnQgPT0gMSAmJiBzcGxpY2UucmVtb3ZlZC5sZW5ndGggPT0gMSkge1xuICAgICAgICBpZiAoc3BsaWNlLnJlbW92ZWRbMF0gIT09IGFycmF5W3NwbGljZS5pbmRleF0pXG4gICAgICAgICAgc3BsaWNlcy5wdXNoKHNwbGljZSk7XG5cbiAgICAgICAgcmV0dXJuXG4gICAgICB9O1xuXG4gICAgICBzcGxpY2VzID0gc3BsaWNlcy5jb25jYXQoY2FsY1NwbGljZXMoYXJyYXksIHNwbGljZS5pbmRleCwgc3BsaWNlLmluZGV4ICsgc3BsaWNlLmFkZGVkQ291bnQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3BsaWNlLnJlbW92ZWQsIDAsIHNwbGljZS5yZW1vdmVkLmxlbmd0aCkpO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIHNwbGljZXM7XG4gIH1cblxuIC8vIEV4cG9ydCB0aGUgb2JzZXJ2ZS1qcyBvYmplY3QgZm9yICoqTm9kZS5qcyoqLCB3aXRoXG4vLyBiYWNrd2FyZHMtY29tcGF0aWJpbGl0eSBmb3IgdGhlIG9sZCBgcmVxdWlyZSgpYCBBUEkuIElmIHdlJ3JlIGluXG4vLyB0aGUgYnJvd3NlciwgZXhwb3J0IGFzIGEgZ2xvYmFsIG9iamVjdC5cbnZhciBleHBvc2UgPSBnbG9iYWw7XG5pZiAodHlwZW9mIGV4cG9ydHMgIT09ICd1bmRlZmluZWQnKSB7XG5pZiAodHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcgJiYgbW9kdWxlLmV4cG9ydHMpIHtcbmV4cG9zZSA9IGV4cG9ydHMgPSBtb2R1bGUuZXhwb3J0cztcbn1cbmV4cG9zZSA9IGV4cG9ydHM7XG59XG5leHBvc2UuT2JzZXJ2ZXIgPSBPYnNlcnZlcjtcbmV4cG9zZS5PYnNlcnZlci5ydW5FT01fID0gcnVuRU9NO1xuZXhwb3NlLk9ic2VydmVyLm9ic2VydmVyU2VudGluZWxfID0gb2JzZXJ2ZXJTZW50aW5lbDsgLy8gZm9yIHRlc3RpbmcuXG5leHBvc2UuT2JzZXJ2ZXIuaGFzT2JqZWN0T2JzZXJ2ZSA9IGhhc09ic2VydmU7XG5leHBvc2UuQXJyYXlPYnNlcnZlciA9IEFycmF5T2JzZXJ2ZXI7XG5leHBvc2UuQXJyYXlPYnNlcnZlci5jYWxjdWxhdGVTcGxpY2VzID0gZnVuY3Rpb24oY3VycmVudCwgcHJldmlvdXMpIHtcbnJldHVybiBhcnJheVNwbGljZS5jYWxjdWxhdGVTcGxpY2VzKGN1cnJlbnQsIHByZXZpb3VzKTtcbn07XG5leHBvc2UuUGxhdGZvcm0gPSBnbG9iYWwuUGxhdGZvcm07XG5leHBvc2UuQXJyYXlTcGxpY2UgPSBBcnJheVNwbGljZTtcbmV4cG9zZS5PYmplY3RPYnNlcnZlciA9IE9iamVjdE9ic2VydmVyO1xuZXhwb3NlLlBhdGhPYnNlcnZlciA9IFBhdGhPYnNlcnZlcjtcbmV4cG9zZS5Db21wb3VuZE9ic2VydmVyID0gQ29tcG91bmRPYnNlcnZlcjtcbmV4cG9zZS5QYXRoID0gUGF0aDtcbmV4cG9zZS5PYnNlcnZlclRyYW5zZm9ybSA9IE9ic2VydmVyVHJhbnNmb3JtO1xufSkodHlwZW9mIGdsb2JhbCAhPT0gJ3VuZGVmaW5lZCcgJiYgZ2xvYmFsICYmIHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnICYmIG1vZHVsZSA/IGdsb2JhbCA6IHRoaXMgfHwgd2luZG93KTtcblxufSkuY2FsbCh0aGlzLHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWwgOiB0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30pIl19
;(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/**
 * Descriptors deal with the description of HTTP requests and are used by Siesta to determine what to do
 * with HTTP request/response bodies.
 * @module http
 */

var _internal = siesta._internal,
    log = _internal.log,
    InternalSiestaError = _internal.error.InternalSiestaError,
    util = _internal.util,
    assert = util.assert,
    defineSubProperty = util.defineSubProperty,
    CollectionRegistry = _internal.CollectionRegistry,
    extend = _internal.extend,
    _ = util._;

var Logger = log.loggerWithName('Descriptor');

var httpMethods = ['POST', 'PATCH', 'PUT', 'HEAD', 'GET', 'DELETE', 'OPTIONS', 'TRACE', 'CONNECT'];

function resolveMethod(methods) {
    // Convert wildcards into methods and ensure is an array of uppercase methods.
    if (methods) {
        if (methods == '*' || methods.indexOf('*') > -1) {
            methods = httpMethods;
        } else if (!util.isArray(methods)) {
            methods = [methods];
        }
    } else {
        methods = ['GET'];
    }
    return _.map(methods, function (x) {
        return x.toUpperCase()
    });
}

/**
 * A descriptor 'describes' possible HTTP requests against an API, and is used to decide whether or not to
 * intercept a HTTP request/response and perform a mapping.
 *
 * @constructor
 * @param {Object} opts
 */
function Descriptor(opts) {
    if (!this) {
        return new Descriptor(opts);
    }

    this._rawOpts = extend(true, {}, opts);
    this._opts = opts;

    var processPath = function (raw) {
        if (!(raw instanceof RegExp)) {
            raw = new RegExp(raw, 'g');
        }
        return raw;
    }.bind(this);

    if (this._opts.path) {
        var paths = this._opts.path;
        if (!util.isArray(paths)) {
            paths = [paths];
        }

        this._opts.path = [];

        _.each(paths, function (p) {
            this._opts.path.push(processPath.call(this, p));
        }.bind(this));
    } else {
        this._opts.path = [''];
    }

    this._opts.method = resolveMethod(this._opts.method);

    // Mappings can be passed as the actual mapping object or as a string (with API specified too)
    if (this._opts.model) {
        if (typeof(this._opts.model) == 'string') {
            if (this._opts.collection) {
                var collection;
                if (typeof(this._opts.collection) == 'string') {
                    collection = CollectionRegistry[this._opts.collection];
                } else {
                    collection = this._opts.collection;
                }
                if (collection) {
                    var actualModel = collection[this._opts.model];
                    if (actualModel) {
                        this._opts.model = actualModel;
                    } else {
                        throw new Error('Model ' + this._opts.model + ' does not exist', {
                            opts: opts,
                            descriptor: this
                        });
                    }
                } else {
                    throw new Error('Collection ' + this._opts.collection + ' does not exist', {
                        opts: opts,
                        descriptor: this
                    });
                }
            } else {
                throw new Error('Passed model as string, but did not specify the collection it belongs to', {
                    opts: opts,
                    descriptor: this
                });
            }
        }
    } else {
        throw new Error('Descriptors must be initialised with a model', {
            opts: opts,
            descriptor: this
        });
    }

    // If key path, convert data key path into an object that we can then use to traverse the HTTP bodies.
    // otherwise leave as string or undefined.
    var data = this._opts.data;
    if (data) {
        if (data.length) {
            var root;
            var arr = data.split('.');
            if (arr.length == 1) {
                root = arr[0];
            } else {
                var obj = {};
                root = obj;
                var previousKey = arr[0];
                for (var i = 1; i < arr.length; i++) {
                    var key = arr[i];
                    if (i == (arr.length - 1)) {
                        obj[previousKey] = key;
                    } else {
                        var newVar = {};
                        obj[previousKey] = newVar;
                        obj = newVar;
                        previousKey = key;
                    }
                }
            }
            this._opts.data = root;
        }
    }

    /**
     * @name path
     * @type {String}
     */
    defineSubProperty.call(this, 'path', this._opts);
    defineSubProperty.call(this, 'method', this._opts);
    defineSubProperty.call(this, 'model', this._opts);
    defineSubProperty.call(this, 'data', this._opts);
    defineSubProperty.call(this, 'transforms', this._opts);
}

_.extend(Descriptor.prototype, {
    httpMethods: httpMethods,
    /**
     * Takes a regex path and returns true if matched
     *
     * @param  {String} path
     * @return {boolean}
     * @internal
     * @example
     * ```js
     * var d = new Descriptor({
     *     path: '/resource/(?P<id>)/'
     * })
     * var matched = d._matchPath('/resource/2');
     * console.log(matched); // {id: '2'}
     * ```
     */
    _matchPath: function (path) {
        var i;
        for (i = 0; i < this._opts.path.length; i++) {
            var regExp = this._opts.path[i];
            if (Logger.trace.isEnabled)
                Logger.trace('Matching path', path, regExp.toString());
            var matched = regExp.exec(path);
            if (Logger.trace.isEnabled) {
                if (matched) {
                    Logger.trace('Matched path successfully', path, regExp.toString());
                }
                else {
                    Logger.trace('Failed to match path', path, regExp.toString());
                }
            }
            if (matched) return true;
        }
        return false;
    },

    /**
     * Returns true if the descriptor accepts the HTTP method.
     *
     * @param  {String} method
     * @return {boolean}
     * @internal
     * @example
     * ```js
     * var d = new Descriptor({
     *     method: ['POST', 'PUT']
     * });
     * console.log(d._matchMethod('GET')); // false
     * ```
     */
    _matchMethod: function (method) {
        for (var i = 0; i < this.method.length; i++) {
            if (method.toUpperCase() == this.method[i]) {
                return true;
            }
        }
        return false;
    },
    /**
     * Performs a breadth-first search through data, embedding obj in the first leaf.
     *
     * @param  {Object} obj
     * @param  {Object} data
     * @return {Object}
     */
    bury: function (obj, data) {
        var root = data;
        var keys = Object.keys(data);
        assert(keys.length == 1);
        var key = keys[0];
        var curr = data;
        while (!(typeof(curr[key]) == 'string')) {
            curr = curr[key];
            keys = Object.keys(curr);
            assert(keys.length == 1);
            key = keys[0];
        }
        var newParent = curr[key];
        var newObj = {};
        curr[key] = newObj;
        newObj[newParent] = obj;
        return root;
    },
    _embedData: function (data) {
        if (this.data) {
            var nested;
            if (typeof(this.data) == 'string') {
                nested = {};
                nested[this.data] = data;
            } else {
                nested = this.bury(data, extend(true, {}, this.data));
            }
            return nested;
        } else {
            return data;
        }
    },
    /**
     * If nested data has been specified in the descriptor, extract the data.
     * @param  {Object} data
     * @return {Object}
     */
    _extractData: function (data) {
        if (Logger.debug.isEnabled)
            Logger.debug('_extractData', data);
        if (this.data) {
            if (typeof(this.data) == 'string') {
                return data[this.data];
            } else {
                var keys = Object.keys(this.data);
                assert(keys.length == 1);
                var currTheirs = data;
                var currOurs = this.data;
                while (typeof(currOurs) != 'string') {
                    keys = Object.keys(currOurs);
                    assert(keys.length == 1);
                    var key = keys[0];
                    currOurs = currOurs[key];
                    currTheirs = currTheirs[key];
                    if (!currTheirs) {
                        break;
                    }
                }
                return currTheirs ? currTheirs[currOurs] : null;
            }
        } else {
            return data;
        }
    },
    /**
     * Returns this descriptors mapping if the request config matches.
     * @param {Object} config
     * @returns {Object}
     */
    _matchConfig: function (config) {
        var matches = config.type ? this._matchMethod(config.type) : {};
        if (matches) {
            matches = config.url ? this._matchPath(config.url) : {};
        }
        return matches;
    },

    /**
     * Returns data if the data matches, performing any extraction as specified in opts.data
     *
     * @param  {Object} data
     * @return {Object}
     */
    _matchData: function (data) {
        var extractedData = null;
        if (this.data) {
            if (data) {
                extractedData = this._extractData(data);
            }
        } else {
            extractedData = data;
        }
        return extractedData;
    },
    /**
     * Check if the HTTP config and returned data match this descriptor definition.
     *
     * @param  {Object} config Config object for $.ajax and similar
     * @param  {Object} data
     * @return {Object} Extracted data
     */
    match: function (config, data) {
        var regexMatches = this._matchConfig(config);
        var matches = !!regexMatches;
        var extractedData = false;
        if (matches) {
            extractedData = this._matchData(data);
        }
        return extractedData;
    },

    /**
     * Apply any transforms.
     * @param  {Object} data Serialised data.
     * @return {Object} Serialised data with applied transformations.
     */
    _transformData: function (data) {
        var transforms = this.transforms;
        if (typeof(transforms) == 'function') {
            data = transforms(data);
        } else {
            for (var attr in transforms) {
                if (transforms.hasOwnProperty(attr)) {
                    if (data[attr]) {
                        var transform = transforms[attr];
                        var val = data[attr];
                        if (typeof(transform) == 'string') {
                            var split = transform.split('.');
                            delete data[attr];
                            if (split.length == 1) {
                                data[split[0]] = val;
                            } else {
                                data[split[0]] = {};
                                var newVal = data[split[0]];
                                for (var i = 1; i < split.length - 1; i++) {
                                    var newAttr = split[i];
                                    newVal[newAttr] = {};
                                    newVal = newVal[newAttr];
                                }
                                newVal[split[split.length - 1]] = val;
                            }
                        } else if (typeof(transform) == 'function') {
                            var transformed = transform(val);
                            if (util.isArray(transformed)) {
                                delete data[attr];
                                data[transformed[0]] = transformed[1];
                            } else {
                                data[attr] = transformed;
                            }
                        } else {
                            throw new InternalSiestaError('Invalid transformer');
                        }
                    }
                }
            }
        }
        return data;
    }
});

exports.Descriptor = Descriptor;
exports.resolveMethod = resolveMethod;
},{}],2:[function(require,module,exports){
var _internal = siesta._internal,
    util = _internal.util,
    _ = util._,
    log = _internal.log;

var Logger = log.loggerWithName('Descriptor');

/**
 * @class Entry point for descriptor registration.
 * @constructor
 */
function DescriptorRegistry() {
    if (!this) {
        return new DescriptorRegistry(opts);
    }
    this.requestDescriptors = {};
    this.responseDescriptors = {};
}

function _registerDescriptor(descriptors, descriptor) {
    var model = descriptor.model;
    var collectionName = model.collectionName;
    if (!descriptors[collectionName]) {
        descriptors[collectionName] = [];
    }
    descriptors[collectionName].push(descriptor);
}

function _descriptorsForCollection(descriptors, collection) {
    var descriptorsForCollection;
    if (typeof(collection) == 'string') {
        descriptorsForCollection = descriptors[collection] || [];
    }
    else {
        descriptorsForCollection = (descriptors[collection.name] || []);
    }
    return descriptorsForCollection;
}


_.extend(DescriptorRegistry.prototype, {
    registerRequestDescriptor: function (requestDescriptor) {
        _registerDescriptor(this.requestDescriptors, requestDescriptor);
    },
    registerResponseDescriptor: function (responseDescriptor) {
        if (Logger.trace.isEnabled)
            Logger.trace('registerResponseDescriptor');
        _registerDescriptor(this.responseDescriptors, responseDescriptor);
    },
    requestDescriptorsForCollection: function (collection) {
        return _descriptorsForCollection(this.requestDescriptors, collection);
    },
    responseDescriptorsForCollection: function (collection) {
        var descriptorsForCollection = _descriptorsForCollection(this.responseDescriptors, collection);
        if (!descriptorsForCollection.length) {
            if (Logger.debug.isEnabled)
                Logger.debug('No response descriptors for collection ', this.responseDescriptors);
        }
        return descriptorsForCollection;
    },
    reset: function () {
        this.requestDescriptors = {};
        this.responseDescriptors = {};
    }
});

exports.DescriptorRegistry = new DescriptorRegistry();
},{}],3:[function(require,module,exports){
/**
 * Provisions usage of $.ajax and similar functions to send HTTP requests mapping
 * the results back onto the object graph automatically.
 * @module http
 */

if (typeof siesta == 'undefined' && typeof module == 'undefined') {
    throw new Error('Could not find window.siesta. Make sure you include siesta.core.js first.');
}

var _internal = siesta._internal,
    Collection = _internal.Collection,
    log = _internal.log,
    util = _internal.util,
    error = _internal.error,
    _ = util._,
    descriptor = require('./descriptor'),
    InternalSiestaError = _internal.error.InternalSiestaError;

var DescriptorRegistry = require('./descriptorRegistry').DescriptorRegistry;


var Logger = log.loggerWithName('HTTP');

/**
 * Log a HTTP response
 * @param opts
 * @param xhr
 * @param [data] - Raw data received in HTTP response.
 */
function logHttpResponse(opts, xhr, data) {
    if (Logger.debug.isEnabled) {
        var logger = Logger.debug;
        var logMessage = opts.type + ' ' + xhr.status + ' ' + opts.url;
        if (Logger.trace.isEnabled && data) {
            logger = Logger.trace;
            logMessage += ': ' + util.prettyPrint(data);
        }
        logger(logMessage);
    }
}

/**
 * Log a HTTP request
 * @param opts
 */
function logHttpRequest(opts) {
    if (Logger.debug.isEnabled) {
        var logger = Logger.debug;
        // TODO: Append query parameters to the URL.
        var logMessage = opts.type + ' ' + opts.url;
        if (Logger.trace.isEnabled) {
            // TODO: If any data is being sent, log that.
            logger = Logger.trace;
        }
        logger(logMessage);
    }
}


/**
 * Send a HTTP request to the given method and path parsing the response.
 * @param {String} method
 * @param {String} path The path to the resource we want to GET
 * @param {Object|Function} optsOrCallback Either an options object or a callback if can use defaults
 * @param {Function} callback Callback if opts specified.
 */
function _httpResponse(method, path, optsOrCallback, callback) {
    var self = this;
    var args = Array.prototype.slice.call(arguments, 2);
    var opts = {};
    var name = this.name;
    if (typeof(args[0]) == 'function') {
        callback = args[0];
    } else if (typeof(args[0]) == 'object') {
        opts = args[0];
        callback = args[1];
    }
    var deferred = util.defer();
    opts.type = method;
    if (!opts.url) { // Allow overrides.
        var baseURL = this.baseURL;
        opts.url = baseURL + path;
    }
    if (opts.parseResponse === undefined) opts.parseResponse = true;
    opts.success = function (data, status, xhr) {
        logHttpResponse(opts, xhr, data);
        var resp = {
            data: data,
            status: status,
            xhr: xhr
        };
        if (opts.parseResponse) {
            var descriptors = DescriptorRegistry.responseDescriptorsForCollection(self);
            var matchedDescriptor;
            var extractedData;
            for (var i = 0; i < descriptors.length; i++) {
                var descriptor = descriptors[i];
                extractedData = descriptor.match(opts, data);
                if (extractedData) {
                    matchedDescriptor = descriptor;
                    break;
                }
            }
            if (matchedDescriptor) {
                if (Logger.trace.isEnabled) {
                    Logger.trace('Model _constructSubOperation data: ' + util.prettyPrint(extractedData));
                }
                if (typeof(extractedData) == 'object') {
                    var mapping = matchedDescriptor.model;
                    mapping.map(extractedData, {override: opts.obj}, function (err, obj) {
                        if (callback) {

                            callback(err, obj, resp);
                        }
                    });
                } else { // Matched, but no data.
                    callback(null, true, resp);
                }
            } else if (callback) {
                if (name) {
                    var err = {};
                    var code = error.ErrorCode.NoDescriptorMatched;
                    err[error.ErrorField.Code] = code;
                    err[error.ErrorField.Message] = error.Message[code];
                    callback(err, null, resp);
                } else {
                    // There was a bug where collection name doesn't exist. If this occurs, then will never get hold of any descriptors.
                    throw new InternalSiestaError('Unnamed collection');
                }
            }
        } else {
            callback(null, null, resp);
        }

    };
    opts.error = function (xhr, status, error) {
        var resp = {
            xhr: xhr,
            status: status,
            error: error
        };
        if (callback) callback(resp, null, resp);
    };
    logHttpRequest(opts);
    siesta.ext.http.ajax(opts);
    return deferred.promise;
}

function _serialiseObject(opts, obj, cb) {
    this._serialise(obj, function (err, data) {
        var retData = data;
        if (opts.fields) {
            retData = {};
            _.each(opts.fields, function (f) {
                retData[f] = data[f];
            });
        }
        cb(err, retData);
    });
}

/**
 * Send a HTTP request to the given method and path
 * @param {String} method
 * @param {String} path The path to the resource we want to GET
 * @param {ModelInstance} object The model we're pushing to the server
 * @param {Object|Function} optsOrCallback Either an options object or a callback if can use defaults
 * @param {Function} callback Callback if opts specified.
 */
function _httpRequest(method, path, object) {
    var self = this;
    var args = Array.prototype.slice.call(arguments, 3);
    var callback;
    var opts = {};
    if (typeof(args[0]) == 'function') {
        callback = args[0];
    } else if (typeof(args[0]) == 'object') {
        opts = args[0];
        callback = args[1];
    }
    var deferred = util.defer(callback);
    callback = deferred.finish.bind(deferred);
    args = Array.prototype.slice.call(args, 2);
    var requestDescriptors = DescriptorRegistry.requestDescriptorsForCollection(this);
    var matchedDescriptor;
    opts.type = method;
    var baseURL = this.baseURL;
    opts.url = baseURL + path;
    for (var i = 0; i < requestDescriptors.length; i++) {
        var requestDescriptor = requestDescriptors[i];
        if (requestDescriptor._matchConfig(opts)) {
            matchedDescriptor = requestDescriptor;
            break;
        }
    }
    if (matchedDescriptor) {
        if (Logger.trace.isEnabled)
            Logger.trace('Matched descriptor: ' + matchedDescriptor._dump(true));
        _serialiseObject.call(matchedDescriptor, object, opts, function (err, data) {
            if (Logger.trace.isEnabled)
                Logger.trace('_serialise', {
                    err: err,
                    data: data
                });
            if (err) {
                if (callback) callback(err, null, null);
            } else {
                opts.data = data;
                opts.obj = object;
                _.partial(_httpResponse, method, path, opts, callback).apply(self, args);
            }
        });

    } else if (callback) {
        if (Logger.trace.isEnabled)
            Logger.trace('Did not match descriptor');
        callback('No descriptor matched', null, null);
    }
    return deferred.promise;
}

/**
 * Send a DELETE request. Also removes the object.
 * @param {String} path The path to the resource to which we want to DELETE
 * @param {ModelInstance} object The model that we would like to PATCH
 * @returns {Promise}
 */
function DELETE(path, object) {
    var args = Array.prototype.slice.call(arguments, 2);
    var opts = {};
    var callback;
    if (typeof(args[0]) == 'function') {
        callback = args[0];
    } else if (typeof(args[0]) == 'object') {
        opts = args[0];
        callback = args[1];
    }
    var deferred = util.defer(callback);
    var deletionMode = opts.deletionMode || 'restore';
    // By default we do not map the response from a DELETE request.
    if (opts.parseResponse === undefined) opts.parseResponse = false;
    _httpResponse.call(this, 'DELETE', path, opts, function (err, x, y, z) {
        if (err) {
            if (deletionMode == 'restore') {
                object.restore();
            }
        } else if (deletionMode == 'success') {
            object.remove();
        }
        callback(err, x, y, z);
        deferred.finish(err, {x: x, y: y, z:z});
    });
    if (deletionMode == 'now' || deletionMode == 'restore') {
        object.remove();
    }
    return deferred.promise;
}

/**
 * Send a HTTP request using the given method
 * @param request Does the request contain data? e.g. POST/PATCH/PUT will be true, GET will false
 * @param method
 * @internal
 * @returns {Promise}
 */
function HTTP_METHOD(request, method) {
    var args = Array.prototype.slice.call(arguments, 2);
    return _.partial(request ? _httpRequest : _httpResponse, method).apply(this, args);
}

/**
 * Send a GET request
 * @param {String} path The path to the resource we want to GET
 * @param {Object|Function} optsOrCallback Either an options object or a callback if can use defaults
 * @param {Function} callback Callback if opts specified.
 * @package HTTP
 * @returns {Promise}
 */
function GET() {
    return _.partial(HTTP_METHOD, false, 'GET').apply(this, arguments);
}

/**
 * Send an OPTIONS request
 * @param {String} path The path to the resource we want to GET
 * @param {Object|Function} optsOrCallback Either an options object or a callback if can use defaults
 * @param {Function} callback Callback if opts specified.
 * @package HTTP
 * @returns {Promise}
 */
function OPTIONS() {
    return _.partial(HTTP_METHOD, false, 'OPTIONS').apply(this, arguments);
}

/**
 * Send an TRACE request
 * @param {String} path The path to the resource we want to GET
 * @param {Object|Function} optsOrCallback Either an options object or a callback if can use defaults
 * @param {Function} callback Callback if opts specified.
 * @package HTTP
 * @returns {Promise}
 */
function TRACE() {
    return _.partial(HTTP_METHOD, false, 'TRACE').apply(this, arguments);
}

/**
 * Send an HEAD request
 * @param {String} path The path to the resource we want to GET
 * @param {Object|Function} optsOrCallback Either an options object or a callback if can use defaults
 * @param {Function} callback Callback if opts specified.
 * @package HTTP
 * @returns {Promise}
 */
function HEAD() {
    return _.partial(HTTP_METHOD, false, 'HEAD').apply(this, arguments);
}

/**
 * Send an POST request
 * @param {String} path The path to the resource we want to GET
 * @param {ModelInstance} model The model that we would like to POST
 * @param {Object|Function} optsOrCallback Either an options object or a callback if can use defaults
 * @param {Function} callback Callback if opts specified.
 * @package HTTP
 * @returns {Promise}
 */
function POST() {
    return _.partial(HTTP_METHOD, true, 'POST').apply(this, arguments);
}

/**
 * Send an PUT request
 * @param {String} path The path to the resource we want to GET
 * @param {ModelInstance} model The model that we would like to POST
 * @param {Object|Function} optsOrCallback Either an options object or a callback if can use defaults
 * @param {Function} callback Callback if opts specified.
 * @package HTTP
 * @returns {Promise}
 */
function PUT() {
    return _.partial(HTTP_METHOD, true, 'PUT').apply(this, arguments);
}

/**
 * Send an PATCH request
 * @param {String} path The path to the resource we want to GET
 * @param {ModelInstance} model The model that we would like to POST
 * @param {Object|Function} optsOrCallback Either an options object or a callback if can use defaults
 * @param {Function} callback Callback if opts specified.
 * @package HTTP
 * @returns {Promise}
 */
function PATCH() {
    return _.partial(HTTP_METHOD, true, 'PATCH').apply(this, arguments);
}


var http = {
    RequestDescriptor: require('./requestDescriptor').RequestDescriptor,
    ResponseDescriptor: require('./responseDescriptor').ResponseDescriptor,
    Descriptor: descriptor.Descriptor,
    _resolveMethod: descriptor.resolveMethod,
    Serialiser: require('./serialiser'),
    DescriptorRegistry: require('./descriptorRegistry').DescriptorRegistry,
    _httpResponse: _httpResponse,
    _httpRequest: _httpRequest,
    DELETE: DELETE,
    HTTP_METHOD: HTTP_METHOD,
    GET: GET,
    TRACE: TRACE,
    OPTIONS: OPTIONS,
    HEAD: HEAD,
    POST: POST,
    PUT: PUT,
    PATCH: PATCH,
    _serialiseObject: _serialiseObject,
    Paginator: require('./paginator')
};

Object.defineProperty(http, 'ajax', {
    get: function () {
        var a = ajax || ($ ? $.ajax : null) || (jQuery ? jQuery.ajax : null);
        if (!a) {
            throw new InternalSiestaError('ajax has not been defined and could not find $.ajax or jQuery.ajax');
        }
        return a;
    },
    set: function (v) {
        ajax = v;
    }
});

_.extend(Collection.prototype, {
    DELETE: DELETE,
    GET: GET,
    TRACE: TRACE,
    OPTIONS: OPTIONS,
    HEAD: HEAD,
    POST: POST,
    PUT: PUT,
    PATCH: PATCH
});

if (!siesta.ext) siesta.ext = {};
siesta.ext.http = http;

Object.defineProperties(siesta.ext, {
    httpEnabled: {
        get: function () {
            if (siesta.ext._httpEnabled !== undefined) {
                return siesta.ext._httpEnabled;
            }
            return !!siesta.ext.http;
        },
        set: function (v) {
            siesta.ext._httpEnabled = v;
        },
        enumerable: true
    }
});

var ajax, serialisers = {};

_.extend(siesta, {
    setAjax: function (_ajax) {
        ajax = _ajax;
    },
    getAjax: function () {
        return siesta.ext.http.ajax;
    },
    serialisers: serialisers,
    serializers: serialisers
});

Object.defineProperties(serialisers, {
    id: {
        get: function () {
            console.log(siesta.ext.httpEnabled);
            if (siesta.ext.httpEnabled) {
                return siesta.ext.http.Serialiser.idSerialiser;
            }
            return null;
        }
    },
    depth: {
        get: function () {
            if (siesta.ext.httpEnabled) {
                return siesta.ext.http.Serialiser.depthSerializer;
            }
            return null;
        }
    }
});

if (typeof module != 'undefined') module.exports = http;

},{"./descriptor":1,"./descriptorRegistry":2,"./paginator":4,"./requestDescriptor":5,"./responseDescriptor":6,"./serialiser":7}],4:[function(require,module,exports){
var _internal = siesta._internal,
    log = _internal.log,
    InternalSiestaError = _internal.error.InternalSiestaError,
    util = _internal.util,
    _ = util._;

var querystring = require('querystring');

function Paginator(opts) {
    this.opts = {};
    util.extendFromOpts(this.opts, opts, {
        path: '/',
        model: null,
        page: 'page',
        queryParams: true,
        pageSize: 'pageSize',
        numPages: 'numPages',
        dataPath: 'data',
        count: 'count',
        type: 'GET',
        dataType: 'json'
    }, false);
    _.extend(this, {
        numPages: null,
        count: null
    });

    this.validate();
}

_.extend(Paginator.prototype, {
    _extract: function (path, data, jqXHR) {
        if (path) {
            if (typeof path == 'function') {
                data = path(data, jqXHR);
            }
            else {
                var splt = path.split('.');
                for (var i = 0; i < splt.length; i++) {
                    var key = splt[i];
                    data = data[key];
                }
            }
        }
        return data;
    },
    _extractData: function (data, jqXHR) {
        return this._extract(this.opts.dataPath, data, jqXHR);
    },
    _extractNumPages: function (data, jqXHR) {
        return this._extract(this.opts.numPages, data, jqXHR);
    },
    _extractCount: function (data, jqXHR) {
        return this._extract(this.opts.count, data, jqXHR);
    },
    /**
     * var parser = document.createElement('a');
     * parser.href = "http://example.com:3000/pathname/?search=test#hash";
     * parser.href = URL;
     * parser.protocol; // => "http:"
     * parser.hostname; // => "example.com"
     * parser.port;     // => "3000"
     * parser.pathname; // => "/pathname/"
     * parser.search;   // => "?search=test"
     * parser.hash;     // => "#hash"
     * parser.host;     // => "example.com:3000"
     * @param {String} URL
     * @private
     */
    _parseURL: function (URL) {
        var parser = document.createElement('a');
        parser.href = URL;
        return parser;
    },
    page: function (optsOrCallback, callback) {
        var self = this;
        var opts = {};
        if (typeof optsOrCallback == 'function') {
            callback = optsOrCallback;
        }
        else if (optsOrCallback) {
            opts = optsOrCallback;
        }
        var deferred = util.defer(callback);
        var page = opts.page,
            pageSize = opts.pageSize;
        callback = deferred.finish.bind(deferred);
        var ajax = siesta.ext.http.ajax,
            ajaxOpts = _.extend({}, this.opts);
        var collection = this.opts.model.collection,
            url = collection.baseURL + this.opts.path;
        if (this.opts.queryParams) {
            var parser = this._parseURL(url);
            var rawQuery = parser.search,
                rawQuerySplt = rawQuery.split('?');
            if (rawQuerySplt.length > 1) rawQuery = rawQuerySplt[1];
            var query = querystring.parse(rawQuery);
            if (page) {
                query[this.opts.page] = page;
            }
            if (pageSize) {
                query[this.opts.pageSize] = pageSize;
            }
            if (Object.keys(query).length) {
                parser.search = '?' + querystring.stringify(query);
            }
            url = parser.href;
        }
        else {
            var data = {};
            if (page) {
                data[this.opts.page] = page;
            }
            if (pageSize) {
                data[this.opts.pageSize] = pageSize;
            }
            ajaxOpts.data = data
        }
        _.extend(ajaxOpts, {
            url: url,
            success: function (data, textStatus, jqXHR) {
                var modelData = self._extractData(data, jqXHR),
                    count = self._extractCount(data, jqXHR),
                    numPages = self._extractNumPages(data, jqXHR);

                self.opts.model.map(modelData, function (err, modelInstances) {
                    if (!err) {
                        self.count = count;
                        self.numPages = numPages;
                        callback(null, modelInstances, {data: data, textStatus: textStatus, jqXHR: jqXHR});
                    }
                    else {
                        callback(err);
                    }
                });
            },
            fail: callback
        });
        ajax(ajaxOpts);
        return deferred.promise;
    },
    validate: function () {
        if (!this.opts.model) throw new InternalSiestaError('Paginator must have a model');
    }
});

module.exports = Paginator;
},{"querystring":10}],5:[function(require,module,exports){
/**
 * @module http
 */

var Descriptor = require('./descriptor').Descriptor,
    Serialiser = require('./serialiser');

var _internal = siesta._internal,
    util = _internal.util,
    _ = util._,
    log = _internal.log,
    defineSubProperty = util.defineSubProperty
    ;

var Logger = log.loggerWithName('Descriptor');

/**
 * @class Describes a HTTP request
 * @param {Object} opts
 */
function RequestDescriptor(opts) {
    if (!this) {
        return new RequestDescriptor(opts);
    }

    Descriptor.call(this, opts);
    if (this._opts['serializer']) {
        this._opts.serialiser = this._opts['serializer'];
    }

    if (!this._opts.serialiser) {
        this._opts.serialiser = Serialiser.depthSerializer(0);
    }


    defineSubProperty.call(this, 'serialiser', this._opts);
    defineSubProperty.call(this, 'serializer', this._opts, 'serialiser');

}

RequestDescriptor.prototype = Object.create(Descriptor.prototype);

_.extend(RequestDescriptor.prototype, {
    _serialise: function (obj, callback) {
        var deferred = util.defer(callback);
        callback = deferred.finish.bind(deferred);
        var self = this;
        if (Logger.trace.isEnabled)
            Logger.trace('_serialise');
        var finished;
        var data = this.serialiser(obj, function (err, data) {
            if (!finished) {
                data = self._transformData(data);
                if (callback) callback(err, self._embedData(data));
            }
        });
        if (data !== undefined) {
            if (Logger.trace.isEnabled)
                Logger.trace('serialiser doesnt use a callback');
            finished = true;
            data = self._transformData(data);
            if (callback) callback(null, self._embedData(data));
        }
        else {
            if (Logger.trace.isEnabled)
                Logger.trace('serialiser uses a callback', this.serialiser);
        }
        return deferred.promise;
    },
    _dump: function (asJson) {
        var obj = {};
        obj.methods = this.method;
        obj.model = this.model.name;
        obj.path = this._rawOpts.path;
        var serialiser;
        if (typeof(this._rawOpts.serialiser) == 'function') {
            serialiser = 'function () { ... }'
        }
        else {
            serialiser = this._rawOpts.serialiser;
        }
        obj.serialiser = serialiser;
        var transforms = {};
        for (var f in this.transforms) {
            if (this.transforms.hasOwnProperty(f)) {
                var transform = this.transforms[f];
                if (typeof(transform) == 'function') {
                    transforms[f] = 'function () { ... }'
                }
                else {
                    transforms[f] = this.transforms[f];
                }
            }
        }
        obj.transforms = transforms;
        return asJson ? util.prettyPrint(obj) : obj;
    }
});

exports.RequestDescriptor = RequestDescriptor;

},{"./descriptor":1,"./serialiser":7}],6:[function(require,module,exports){
/**
 * @module http
 */


var Descriptor = require('./descriptor').Descriptor;

/**
 * Describes what to do with a HTTP response.
 * @constructor
 * @implements {Descriptor}
 * @param {Object} opts
 */
function ResponseDescriptor(opts) {
    if (!this) {
        return new ResponseDescriptor(opts);
    }
    Descriptor.call(this, opts);
}

ResponseDescriptor.prototype = Object.create(Descriptor.prototype);

_.extend(ResponseDescriptor.prototype, {
    _extractData: function (data) {
        var extractedData = Descriptor.prototype._extractData.call(this, data);
        if (extractedData) {
            extractedData = this._transformData(extractedData);
        }
        return extractedData;
    },
    _matchData: function (data) {
        var extractedData = Descriptor.prototype._matchData.call(this, data);
        if (extractedData) {
            extractedData = this._transformData(extractedData);
        }
        return extractedData;
    },
    _dump: function (asJson) {
        var obj = {};
        obj.methods = this.method;
        obj.model = this.model.name;
        obj.path = this._rawOpts.path;
        var transforms = {};
        for (var f in this.transforms) {
            if (this.transforms.hasOwnProperty(f)) {
                var transform = this.transforms[f];
                if (typeof(transform) == 'function') {
                    transforms[f] = 'function () { ... }'
                }
                else {
                    transforms[f] = this.transforms[f];
                }
            }
        }
        obj.transforms = transforms;
        return asJson ? util.prettyPrint(obj) : obj;
    }
});

exports.ResponseDescriptor = ResponseDescriptor;
},{"./descriptor":1}],7:[function(require,module,exports){
/**
 * @module http
 */

var _internal = siesta._internal;

var log = _internal.log,
    utils = _internal.util;
var Logger = log.loggerWithName('Serialisation');
var _ = utils._;


/**
 * Serialises an object into it's remote identifier (as defined by the mapping)
 * @param  {ModelInstance} obj
 * @return {String}
 *
 */
function idSerialiser(obj) {
    var idField = obj.model.id;
    if (idField) {
        return obj[idField] ? obj[idField] : null;
    }
    else {
        if (Logger.debug.isEnabled)
            Logger.debug('No idfield');
        return undefined;
    }
}

/**
 * Serialises obj following relationships to specified depth.
 * @param  {Integer}   depth
 * @param  {ModelInstance}   obj
 * @param  {Function} callback
 */
function depthSerialiser(depth, obj, callback) {
    callback = callback || function () {};
    if (Logger.trace.isEnabled)
        Logger.trace('depthSerialiser');
    var data = {};
    _.each(obj._attributeNames, function (f) {
        if (Logger.trace.isEnabled)
            Logger.trace('field', f);
        if (obj[f]) {
            data[f] = obj[f];
        }
    });
    var waiting = [],
        errors = [],
        result = {},
        finished = [];
    _.each(obj._relationshipNames, function (f) {
        if (Logger.trace.isEnabled)
            Logger.trace('relationshipField', f);
        var proxy = obj.__proxies[f];
        if (proxy.isForward) { // By default only forward relationships
            if (Logger.debug.isEnabled)
                Logger.debug(f);
            waiting.push(f);
            proxy.get(function (err, v) {
                if (Logger.trace.isEnabled)
                    Logger.trace('proxy.get', f);
                if (Logger.debug.isEnabled)
                    Logger.debug(f, v);
                if (err) {
                    errors.push(err);
                    finished.push(f);
                    result[f] = {err: err, v: v};
                }
                else if (v) {
                    if (!depth) {
                        finished.push(f);
                        data[f] = v[obj.__proxies[f].forwardModel.id];
                        result[f] = {err: err, v: v};
                        if ((waiting.length == finished.length) && callback) {
                            callback(errors.length ? errors : null, data, result);
                        }
                    }
                    else {
                        depthSerialiser(depth - 1, v, function (err, subData, resp) {
                            if (err) {
                                errors.push(err);
                            }
                            else {
                                data[f] = subData;
                            }
                            finished.push(f);
                            result[f] = {err: err, v: v, resp: resp};
                            if ((waiting.length == finished.length) && callback) {
                                callback(errors.length ? errors : null, data, result);
                            }
                        });
                    }
                }
                else {
                    if (Logger.debug.isEnabled)
                        Logger.debug('no value for ' + f);
                    finished.push(f);
                    result[f] = {err: err, v: v};
                    if ((waiting.length == finished.length) && callback) {
                        callback(errors.length ? errors : null, data, result);
                    }
                }
            });
        }
    });
    if (!waiting.length) {
        callback(null, data, {});
    }
}


exports.depthSerialiser = function (depth) {
    return _.partial(depthSerialiser, depth);
};
exports.depthSerializer = function (depth) {
    return _.partial(depthSerialiser, depth);
};
exports.idSerializer = idSerialiser;
exports.idSerialiser = idSerialiser;


},{}],8:[function(require,module,exports){
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

'use strict';

// If obj.hasOwnProperty has been overridden, then calling
// obj.hasOwnProperty(prop) will break.
// See: https://github.com/joyent/node/issues/1707
function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

module.exports = function(qs, sep, eq, options) {
  sep = sep || '&';
  eq = eq || '=';
  var obj = {};

  if (typeof qs !== 'string' || qs.length === 0) {
    return obj;
  }

  var regexp = /\+/g;
  qs = qs.split(sep);

  var maxKeys = 1000;
  if (options && typeof options.maxKeys === 'number') {
    maxKeys = options.maxKeys;
  }

  var len = qs.length;
  // maxKeys <= 0 means that we should not limit keys count
  if (maxKeys > 0 && len > maxKeys) {
    len = maxKeys;
  }

  for (var i = 0; i < len; ++i) {
    var x = qs[i].replace(regexp, '%20'),
        idx = x.indexOf(eq),
        kstr, vstr, k, v;

    if (idx >= 0) {
      kstr = x.substr(0, idx);
      vstr = x.substr(idx + 1);
    } else {
      kstr = x;
      vstr = '';
    }

    k = decodeURIComponent(kstr);
    v = decodeURIComponent(vstr);

    if (!hasOwnProperty(obj, k)) {
      obj[k] = v;
    } else if (isArray(obj[k])) {
      obj[k].push(v);
    } else {
      obj[k] = [obj[k], v];
    }
  }

  return obj;
};

var isArray = Array.isArray || function (xs) {
  return Object.prototype.toString.call(xs) === '[object Array]';
};

},{}],9:[function(require,module,exports){
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

'use strict';

var stringifyPrimitive = function(v) {
  switch (typeof v) {
    case 'string':
      return v;

    case 'boolean':
      return v ? 'true' : 'false';

    case 'number':
      return isFinite(v) ? v : '';

    default:
      return '';
  }
};

module.exports = function(obj, sep, eq, name) {
  sep = sep || '&';
  eq = eq || '=';
  if (obj === null) {
    obj = undefined;
  }

  if (typeof obj === 'object') {
    return map(objectKeys(obj), function(k) {
      var ks = encodeURIComponent(stringifyPrimitive(k)) + eq;
      if (isArray(obj[k])) {
        return map(obj[k], function(v) {
          return ks + encodeURIComponent(stringifyPrimitive(v));
        }).join(sep);
      } else {
        return ks + encodeURIComponent(stringifyPrimitive(obj[k]));
      }
    }).join(sep);

  }

  if (!name) return '';
  return encodeURIComponent(stringifyPrimitive(name)) + eq +
         encodeURIComponent(stringifyPrimitive(obj));
};

var isArray = Array.isArray || function (xs) {
  return Object.prototype.toString.call(xs) === '[object Array]';
};

function map (xs, f) {
  if (xs.map) return xs.map(f);
  var res = [];
  for (var i = 0; i < xs.length; i++) {
    res.push(f(xs[i], i));
  }
  return res;
}

var objectKeys = Object.keys || function (obj) {
  var res = [];
  for (var key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) res.push(key);
  }
  return res;
};

},{}],10:[function(require,module,exports){
'use strict';

exports.decode = exports.parse = require('./decode');
exports.encode = exports.stringify = require('./encode');

},{"./decode":8,"./encode":9}]},{},[3])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9odHRwL2Rlc2NyaXB0b3IuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9odHRwL2Rlc2NyaXB0b3JSZWdpc3RyeS5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2h0dHAvaW5kZXguanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9odHRwL3BhZ2luYXRvci5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2h0dHAvcmVxdWVzdERlc2NyaXB0b3IuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9odHRwL3Jlc3BvbnNlRGVzY3JpcHRvci5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2h0dHAvc2VyaWFsaXNlci5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9xdWVyeXN0cmluZy1lczMvZGVjb2RlLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3Qvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL3F1ZXJ5c3RyaW5nLWVzMy9lbmNvZGUuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvcXVlcnlzdHJpbmctZXMzL2luZGV4LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5WEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDemNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsSkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8qKlxuICogRGVzY3JpcHRvcnMgZGVhbCB3aXRoIHRoZSBkZXNjcmlwdGlvbiBvZiBIVFRQIHJlcXVlc3RzIGFuZCBhcmUgdXNlZCBieSBTaWVzdGEgdG8gZGV0ZXJtaW5lIHdoYXQgdG8gZG9cbiAqIHdpdGggSFRUUCByZXF1ZXN0L3Jlc3BvbnNlIGJvZGllcy5cbiAqIEBtb2R1bGUgaHR0cFxuICovXG5cbnZhciBfaW50ZXJuYWwgPSBzaWVzdGEuX2ludGVybmFsLFxuICAgIGxvZyA9IF9pbnRlcm5hbC5sb2csXG4gICAgSW50ZXJuYWxTaWVzdGFFcnJvciA9IF9pbnRlcm5hbC5lcnJvci5JbnRlcm5hbFNpZXN0YUVycm9yLFxuICAgIHV0aWwgPSBfaW50ZXJuYWwudXRpbCxcbiAgICBhc3NlcnQgPSB1dGlsLmFzc2VydCxcbiAgICBkZWZpbmVTdWJQcm9wZXJ0eSA9IHV0aWwuZGVmaW5lU3ViUHJvcGVydHksXG4gICAgQ29sbGVjdGlvblJlZ2lzdHJ5ID0gX2ludGVybmFsLkNvbGxlY3Rpb25SZWdpc3RyeSxcbiAgICBleHRlbmQgPSBfaW50ZXJuYWwuZXh0ZW5kLFxuICAgIF8gPSB1dGlsLl87XG5cbnZhciBMb2dnZXIgPSBsb2cubG9nZ2VyV2l0aE5hbWUoJ0Rlc2NyaXB0b3InKTtcblxudmFyIGh0dHBNZXRob2RzID0gWydQT1NUJywgJ1BBVENIJywgJ1BVVCcsICdIRUFEJywgJ0dFVCcsICdERUxFVEUnLCAnT1BUSU9OUycsICdUUkFDRScsICdDT05ORUNUJ107XG5cbmZ1bmN0aW9uIHJlc29sdmVNZXRob2QobWV0aG9kcykge1xuICAgIC8vIENvbnZlcnQgd2lsZGNhcmRzIGludG8gbWV0aG9kcyBhbmQgZW5zdXJlIGlzIGFuIGFycmF5IG9mIHVwcGVyY2FzZSBtZXRob2RzLlxuICAgIGlmIChtZXRob2RzKSB7XG4gICAgICAgIGlmIChtZXRob2RzID09ICcqJyB8fCBtZXRob2RzLmluZGV4T2YoJyonKSA+IC0xKSB7XG4gICAgICAgICAgICBtZXRob2RzID0gaHR0cE1ldGhvZHM7XG4gICAgICAgIH0gZWxzZSBpZiAoIXV0aWwuaXNBcnJheShtZXRob2RzKSkge1xuICAgICAgICAgICAgbWV0aG9kcyA9IFttZXRob2RzXTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIG1ldGhvZHMgPSBbJ0dFVCddO1xuICAgIH1cbiAgICByZXR1cm4gXy5tYXAobWV0aG9kcywgZnVuY3Rpb24gKHgpIHtcbiAgICAgICAgcmV0dXJuIHgudG9VcHBlckNhc2UoKVxuICAgIH0pO1xufVxuXG4vKipcbiAqIEEgZGVzY3JpcHRvciAnZGVzY3JpYmVzJyBwb3NzaWJsZSBIVFRQIHJlcXVlc3RzIGFnYWluc3QgYW4gQVBJLCBhbmQgaXMgdXNlZCB0byBkZWNpZGUgd2hldGhlciBvciBub3QgdG9cbiAqIGludGVyY2VwdCBhIEhUVFAgcmVxdWVzdC9yZXNwb25zZSBhbmQgcGVyZm9ybSBhIG1hcHBpbmcuXG4gKlxuICogQGNvbnN0cnVjdG9yXG4gKiBAcGFyYW0ge09iamVjdH0gb3B0c1xuICovXG5mdW5jdGlvbiBEZXNjcmlwdG9yKG9wdHMpIHtcbiAgICBpZiAoIXRoaXMpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBEZXNjcmlwdG9yKG9wdHMpO1xuICAgIH1cblxuICAgIHRoaXMuX3Jhd09wdHMgPSBleHRlbmQodHJ1ZSwge30sIG9wdHMpO1xuICAgIHRoaXMuX29wdHMgPSBvcHRzO1xuXG4gICAgdmFyIHByb2Nlc3NQYXRoID0gZnVuY3Rpb24gKHJhdykge1xuICAgICAgICBpZiAoIShyYXcgaW5zdGFuY2VvZiBSZWdFeHApKSB7XG4gICAgICAgICAgICByYXcgPSBuZXcgUmVnRXhwKHJhdywgJ2cnKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmF3O1xuICAgIH0uYmluZCh0aGlzKTtcblxuICAgIGlmICh0aGlzLl9vcHRzLnBhdGgpIHtcbiAgICAgICAgdmFyIHBhdGhzID0gdGhpcy5fb3B0cy5wYXRoO1xuICAgICAgICBpZiAoIXV0aWwuaXNBcnJheShwYXRocykpIHtcbiAgICAgICAgICAgIHBhdGhzID0gW3BhdGhzXTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX29wdHMucGF0aCA9IFtdO1xuXG4gICAgICAgIF8uZWFjaChwYXRocywgZnVuY3Rpb24gKHApIHtcbiAgICAgICAgICAgIHRoaXMuX29wdHMucGF0aC5wdXNoKHByb2Nlc3NQYXRoLmNhbGwodGhpcywgcCkpO1xuICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuX29wdHMucGF0aCA9IFsnJ107XG4gICAgfVxuXG4gICAgdGhpcy5fb3B0cy5tZXRob2QgPSByZXNvbHZlTWV0aG9kKHRoaXMuX29wdHMubWV0aG9kKTtcblxuICAgIC8vIE1hcHBpbmdzIGNhbiBiZSBwYXNzZWQgYXMgdGhlIGFjdHVhbCBtYXBwaW5nIG9iamVjdCBvciBhcyBhIHN0cmluZyAod2l0aCBBUEkgc3BlY2lmaWVkIHRvbylcbiAgICBpZiAodGhpcy5fb3B0cy5tb2RlbCkge1xuICAgICAgICBpZiAodHlwZW9mKHRoaXMuX29wdHMubW9kZWwpID09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fb3B0cy5jb2xsZWN0aW9uKSB7XG4gICAgICAgICAgICAgICAgdmFyIGNvbGxlY3Rpb247XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZih0aGlzLl9vcHRzLmNvbGxlY3Rpb24pID09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbGxlY3Rpb24gPSBDb2xsZWN0aW9uUmVnaXN0cnlbdGhpcy5fb3B0cy5jb2xsZWN0aW9uXTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBjb2xsZWN0aW9uID0gdGhpcy5fb3B0cy5jb2xsZWN0aW9uO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoY29sbGVjdGlvbikge1xuICAgICAgICAgICAgICAgICAgICB2YXIgYWN0dWFsTW9kZWwgPSBjb2xsZWN0aW9uW3RoaXMuX29wdHMubW9kZWxdO1xuICAgICAgICAgICAgICAgICAgICBpZiAoYWN0dWFsTW9kZWwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX29wdHMubW9kZWwgPSBhY3R1YWxNb2RlbDtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignTW9kZWwgJyArIHRoaXMuX29wdHMubW9kZWwgKyAnIGRvZXMgbm90IGV4aXN0Jywge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9wdHM6IG9wdHMsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRvcjogdGhpc1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0NvbGxlY3Rpb24gJyArIHRoaXMuX29wdHMuY29sbGVjdGlvbiArICcgZG9lcyBub3QgZXhpc3QnLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICBvcHRzOiBvcHRzLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRvcjogdGhpc1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignUGFzc2VkIG1vZGVsIGFzIHN0cmluZywgYnV0IGRpZCBub3Qgc3BlY2lmeSB0aGUgY29sbGVjdGlvbiBpdCBiZWxvbmdzIHRvJywge1xuICAgICAgICAgICAgICAgICAgICBvcHRzOiBvcHRzLFxuICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdG9yOiB0aGlzXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0Rlc2NyaXB0b3JzIG11c3QgYmUgaW5pdGlhbGlzZWQgd2l0aCBhIG1vZGVsJywge1xuICAgICAgICAgICAgb3B0czogb3B0cyxcbiAgICAgICAgICAgIGRlc2NyaXB0b3I6IHRoaXNcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gSWYga2V5IHBhdGgsIGNvbnZlcnQgZGF0YSBrZXkgcGF0aCBpbnRvIGFuIG9iamVjdCB0aGF0IHdlIGNhbiB0aGVuIHVzZSB0byB0cmF2ZXJzZSB0aGUgSFRUUCBib2RpZXMuXG4gICAgLy8gb3RoZXJ3aXNlIGxlYXZlIGFzIHN0cmluZyBvciB1bmRlZmluZWQuXG4gICAgdmFyIGRhdGEgPSB0aGlzLl9vcHRzLmRhdGE7XG4gICAgaWYgKGRhdGEpIHtcbiAgICAgICAgaWYgKGRhdGEubGVuZ3RoKSB7XG4gICAgICAgICAgICB2YXIgcm9vdDtcbiAgICAgICAgICAgIHZhciBhcnIgPSBkYXRhLnNwbGl0KCcuJyk7XG4gICAgICAgICAgICBpZiAoYXJyLmxlbmd0aCA9PSAxKSB7XG4gICAgICAgICAgICAgICAgcm9vdCA9IGFyclswXTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdmFyIG9iaiA9IHt9O1xuICAgICAgICAgICAgICAgIHJvb3QgPSBvYmo7XG4gICAgICAgICAgICAgICAgdmFyIHByZXZpb3VzS2V5ID0gYXJyWzBdO1xuICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAxOyBpIDwgYXJyLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBrZXkgPSBhcnJbaV07XG4gICAgICAgICAgICAgICAgICAgIGlmIChpID09IChhcnIubGVuZ3RoIC0gMSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG9ialtwcmV2aW91c0tleV0gPSBrZXk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgbmV3VmFyID0ge307XG4gICAgICAgICAgICAgICAgICAgICAgICBvYmpbcHJldmlvdXNLZXldID0gbmV3VmFyO1xuICAgICAgICAgICAgICAgICAgICAgICAgb2JqID0gbmV3VmFyO1xuICAgICAgICAgICAgICAgICAgICAgICAgcHJldmlvdXNLZXkgPSBrZXk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLl9vcHRzLmRhdGEgPSByb290O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQG5hbWUgcGF0aFxuICAgICAqIEB0eXBlIHtTdHJpbmd9XG4gICAgICovXG4gICAgZGVmaW5lU3ViUHJvcGVydHkuY2FsbCh0aGlzLCAncGF0aCcsIHRoaXMuX29wdHMpO1xuICAgIGRlZmluZVN1YlByb3BlcnR5LmNhbGwodGhpcywgJ21ldGhvZCcsIHRoaXMuX29wdHMpO1xuICAgIGRlZmluZVN1YlByb3BlcnR5LmNhbGwodGhpcywgJ21vZGVsJywgdGhpcy5fb3B0cyk7XG4gICAgZGVmaW5lU3ViUHJvcGVydHkuY2FsbCh0aGlzLCAnZGF0YScsIHRoaXMuX29wdHMpO1xuICAgIGRlZmluZVN1YlByb3BlcnR5LmNhbGwodGhpcywgJ3RyYW5zZm9ybXMnLCB0aGlzLl9vcHRzKTtcbn1cblxuXy5leHRlbmQoRGVzY3JpcHRvci5wcm90b3R5cGUsIHtcbiAgICBodHRwTWV0aG9kczogaHR0cE1ldGhvZHMsXG4gICAgLyoqXG4gICAgICogVGFrZXMgYSByZWdleCBwYXRoIGFuZCByZXR1cm5zIHRydWUgaWYgbWF0Y2hlZFxuICAgICAqXG4gICAgICogQHBhcmFtICB7U3RyaW5nfSBwYXRoXG4gICAgICogQHJldHVybiB7Ym9vbGVhbn1cbiAgICAgKiBAaW50ZXJuYWxcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGBgYGpzXG4gICAgICogdmFyIGQgPSBuZXcgRGVzY3JpcHRvcih7XG4gICAgICogICAgIHBhdGg6ICcvcmVzb3VyY2UvKD9QPGlkPikvJ1xuICAgICAqIH0pXG4gICAgICogdmFyIG1hdGNoZWQgPSBkLl9tYXRjaFBhdGgoJy9yZXNvdXJjZS8yJyk7XG4gICAgICogY29uc29sZS5sb2cobWF0Y2hlZCk7IC8vIHtpZDogJzInfVxuICAgICAqIGBgYFxuICAgICAqL1xuICAgIF9tYXRjaFBhdGg6IGZ1bmN0aW9uIChwYXRoKSB7XG4gICAgICAgIHZhciBpO1xuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgdGhpcy5fb3B0cy5wYXRoLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB2YXIgcmVnRXhwID0gdGhpcy5fb3B0cy5wYXRoW2ldO1xuICAgICAgICAgICAgaWYgKExvZ2dlci50cmFjZS5pc0VuYWJsZWQpXG4gICAgICAgICAgICAgICAgTG9nZ2VyLnRyYWNlKCdNYXRjaGluZyBwYXRoJywgcGF0aCwgcmVnRXhwLnRvU3RyaW5nKCkpO1xuICAgICAgICAgICAgdmFyIG1hdGNoZWQgPSByZWdFeHAuZXhlYyhwYXRoKTtcbiAgICAgICAgICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgaWYgKG1hdGNoZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgTG9nZ2VyLnRyYWNlKCdNYXRjaGVkIHBhdGggc3VjY2Vzc2Z1bGx5JywgcGF0aCwgcmVnRXhwLnRvU3RyaW5nKCkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgTG9nZ2VyLnRyYWNlKCdGYWlsZWQgdG8gbWF0Y2ggcGF0aCcsIHBhdGgsIHJlZ0V4cC50b1N0cmluZygpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAobWF0Y2hlZCkgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRydWUgaWYgdGhlIGRlc2NyaXB0b3IgYWNjZXB0cyB0aGUgSFRUUCBtZXRob2QuXG4gICAgICpcbiAgICAgKiBAcGFyYW0gIHtTdHJpbmd9IG1ldGhvZFxuICAgICAqIEByZXR1cm4ge2Jvb2xlYW59XG4gICAgICogQGludGVybmFsXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBgYGBqc1xuICAgICAqIHZhciBkID0gbmV3IERlc2NyaXB0b3Ioe1xuICAgICAqICAgICBtZXRob2Q6IFsnUE9TVCcsICdQVVQnXVxuICAgICAqIH0pO1xuICAgICAqIGNvbnNvbGUubG9nKGQuX21hdGNoTWV0aG9kKCdHRVQnKSk7IC8vIGZhbHNlXG4gICAgICogYGBgXG4gICAgICovXG4gICAgX21hdGNoTWV0aG9kOiBmdW5jdGlvbiAobWV0aG9kKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5tZXRob2QubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmIChtZXRob2QudG9VcHBlckNhc2UoKSA9PSB0aGlzLm1ldGhvZFtpXSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIFBlcmZvcm1zIGEgYnJlYWR0aC1maXJzdCBzZWFyY2ggdGhyb3VnaCBkYXRhLCBlbWJlZGRpbmcgb2JqIGluIHRoZSBmaXJzdCBsZWFmLlxuICAgICAqXG4gICAgICogQHBhcmFtICB7T2JqZWN0fSBvYmpcbiAgICAgKiBAcGFyYW0gIHtPYmplY3R9IGRhdGFcbiAgICAgKiBAcmV0dXJuIHtPYmplY3R9XG4gICAgICovXG4gICAgYnVyeTogZnVuY3Rpb24gKG9iaiwgZGF0YSkge1xuICAgICAgICB2YXIgcm9vdCA9IGRhdGE7XG4gICAgICAgIHZhciBrZXlzID0gT2JqZWN0LmtleXMoZGF0YSk7XG4gICAgICAgIGFzc2VydChrZXlzLmxlbmd0aCA9PSAxKTtcbiAgICAgICAgdmFyIGtleSA9IGtleXNbMF07XG4gICAgICAgIHZhciBjdXJyID0gZGF0YTtcbiAgICAgICAgd2hpbGUgKCEodHlwZW9mKGN1cnJba2V5XSkgPT0gJ3N0cmluZycpKSB7XG4gICAgICAgICAgICBjdXJyID0gY3VycltrZXldO1xuICAgICAgICAgICAga2V5cyA9IE9iamVjdC5rZXlzKGN1cnIpO1xuICAgICAgICAgICAgYXNzZXJ0KGtleXMubGVuZ3RoID09IDEpO1xuICAgICAgICAgICAga2V5ID0ga2V5c1swXTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgbmV3UGFyZW50ID0gY3VycltrZXldO1xuICAgICAgICB2YXIgbmV3T2JqID0ge307XG4gICAgICAgIGN1cnJba2V5XSA9IG5ld09iajtcbiAgICAgICAgbmV3T2JqW25ld1BhcmVudF0gPSBvYmo7XG4gICAgICAgIHJldHVybiByb290O1xuICAgIH0sXG4gICAgX2VtYmVkRGF0YTogZnVuY3Rpb24gKGRhdGEpIHtcbiAgICAgICAgaWYgKHRoaXMuZGF0YSkge1xuICAgICAgICAgICAgdmFyIG5lc3RlZDtcbiAgICAgICAgICAgIGlmICh0eXBlb2YodGhpcy5kYXRhKSA9PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgIG5lc3RlZCA9IHt9O1xuICAgICAgICAgICAgICAgIG5lc3RlZFt0aGlzLmRhdGFdID0gZGF0YTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbmVzdGVkID0gdGhpcy5idXJ5KGRhdGEsIGV4dGVuZCh0cnVlLCB7fSwgdGhpcy5kYXRhKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gbmVzdGVkO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIGRhdGE7XG4gICAgICAgIH1cbiAgICB9LFxuICAgIC8qKlxuICAgICAqIElmIG5lc3RlZCBkYXRhIGhhcyBiZWVuIHNwZWNpZmllZCBpbiB0aGUgZGVzY3JpcHRvciwgZXh0cmFjdCB0aGUgZGF0YS5cbiAgICAgKiBAcGFyYW0gIHtPYmplY3R9IGRhdGFcbiAgICAgKiBAcmV0dXJuIHtPYmplY3R9XG4gICAgICovXG4gICAgX2V4dHJhY3REYXRhOiBmdW5jdGlvbiAoZGF0YSkge1xuICAgICAgICBpZiAoTG9nZ2VyLmRlYnVnLmlzRW5hYmxlZClcbiAgICAgICAgICAgIExvZ2dlci5kZWJ1ZygnX2V4dHJhY3REYXRhJywgZGF0YSk7XG4gICAgICAgIGlmICh0aGlzLmRhdGEpIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2YodGhpcy5kYXRhKSA9PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgIHJldHVybiBkYXRhW3RoaXMuZGF0YV07XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHZhciBrZXlzID0gT2JqZWN0LmtleXModGhpcy5kYXRhKTtcbiAgICAgICAgICAgICAgICBhc3NlcnQoa2V5cy5sZW5ndGggPT0gMSk7XG4gICAgICAgICAgICAgICAgdmFyIGN1cnJUaGVpcnMgPSBkYXRhO1xuICAgICAgICAgICAgICAgIHZhciBjdXJyT3VycyA9IHRoaXMuZGF0YTtcbiAgICAgICAgICAgICAgICB3aGlsZSAodHlwZW9mKGN1cnJPdXJzKSAhPSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgICAgICBrZXlzID0gT2JqZWN0LmtleXMoY3Vyck91cnMpO1xuICAgICAgICAgICAgICAgICAgICBhc3NlcnQoa2V5cy5sZW5ndGggPT0gMSk7XG4gICAgICAgICAgICAgICAgICAgIHZhciBrZXkgPSBrZXlzWzBdO1xuICAgICAgICAgICAgICAgICAgICBjdXJyT3VycyA9IGN1cnJPdXJzW2tleV07XG4gICAgICAgICAgICAgICAgICAgIGN1cnJUaGVpcnMgPSBjdXJyVGhlaXJzW2tleV07XG4gICAgICAgICAgICAgICAgICAgIGlmICghY3VyclRoZWlycykge1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIGN1cnJUaGVpcnMgPyBjdXJyVGhlaXJzW2N1cnJPdXJzXSA6IG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gZGF0YTtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0aGlzIGRlc2NyaXB0b3JzIG1hcHBpbmcgaWYgdGhlIHJlcXVlc3QgY29uZmlnIG1hdGNoZXMuXG4gICAgICogQHBhcmFtIHtPYmplY3R9IGNvbmZpZ1xuICAgICAqIEByZXR1cm5zIHtPYmplY3R9XG4gICAgICovXG4gICAgX21hdGNoQ29uZmlnOiBmdW5jdGlvbiAoY29uZmlnKSB7XG4gICAgICAgIHZhciBtYXRjaGVzID0gY29uZmlnLnR5cGUgPyB0aGlzLl9tYXRjaE1ldGhvZChjb25maWcudHlwZSkgOiB7fTtcbiAgICAgICAgaWYgKG1hdGNoZXMpIHtcbiAgICAgICAgICAgIG1hdGNoZXMgPSBjb25maWcudXJsID8gdGhpcy5fbWF0Y2hQYXRoKGNvbmZpZy51cmwpIDoge307XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG1hdGNoZXM7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgZGF0YSBpZiB0aGUgZGF0YSBtYXRjaGVzLCBwZXJmb3JtaW5nIGFueSBleHRyYWN0aW9uIGFzIHNwZWNpZmllZCBpbiBvcHRzLmRhdGFcbiAgICAgKlxuICAgICAqIEBwYXJhbSAge09iamVjdH0gZGF0YVxuICAgICAqIEByZXR1cm4ge09iamVjdH1cbiAgICAgKi9cbiAgICBfbWF0Y2hEYXRhOiBmdW5jdGlvbiAoZGF0YSkge1xuICAgICAgICB2YXIgZXh0cmFjdGVkRGF0YSA9IG51bGw7XG4gICAgICAgIGlmICh0aGlzLmRhdGEpIHtcbiAgICAgICAgICAgIGlmIChkYXRhKSB7XG4gICAgICAgICAgICAgICAgZXh0cmFjdGVkRGF0YSA9IHRoaXMuX2V4dHJhY3REYXRhKGRhdGEpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZXh0cmFjdGVkRGF0YSA9IGRhdGE7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGV4dHJhY3RlZERhdGE7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBDaGVjayBpZiB0aGUgSFRUUCBjb25maWcgYW5kIHJldHVybmVkIGRhdGEgbWF0Y2ggdGhpcyBkZXNjcmlwdG9yIGRlZmluaXRpb24uXG4gICAgICpcbiAgICAgKiBAcGFyYW0gIHtPYmplY3R9IGNvbmZpZyBDb25maWcgb2JqZWN0IGZvciAkLmFqYXggYW5kIHNpbWlsYXJcbiAgICAgKiBAcGFyYW0gIHtPYmplY3R9IGRhdGFcbiAgICAgKiBAcmV0dXJuIHtPYmplY3R9IEV4dHJhY3RlZCBkYXRhXG4gICAgICovXG4gICAgbWF0Y2g6IGZ1bmN0aW9uIChjb25maWcsIGRhdGEpIHtcbiAgICAgICAgdmFyIHJlZ2V4TWF0Y2hlcyA9IHRoaXMuX21hdGNoQ29uZmlnKGNvbmZpZyk7XG4gICAgICAgIHZhciBtYXRjaGVzID0gISFyZWdleE1hdGNoZXM7XG4gICAgICAgIHZhciBleHRyYWN0ZWREYXRhID0gZmFsc2U7XG4gICAgICAgIGlmIChtYXRjaGVzKSB7XG4gICAgICAgICAgICBleHRyYWN0ZWREYXRhID0gdGhpcy5fbWF0Y2hEYXRhKGRhdGEpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBleHRyYWN0ZWREYXRhO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBBcHBseSBhbnkgdHJhbnNmb3Jtcy5cbiAgICAgKiBAcGFyYW0gIHtPYmplY3R9IGRhdGEgU2VyaWFsaXNlZCBkYXRhLlxuICAgICAqIEByZXR1cm4ge09iamVjdH0gU2VyaWFsaXNlZCBkYXRhIHdpdGggYXBwbGllZCB0cmFuc2Zvcm1hdGlvbnMuXG4gICAgICovXG4gICAgX3RyYW5zZm9ybURhdGE6IGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgICAgIHZhciB0cmFuc2Zvcm1zID0gdGhpcy50cmFuc2Zvcm1zO1xuICAgICAgICBpZiAodHlwZW9mKHRyYW5zZm9ybXMpID09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIGRhdGEgPSB0cmFuc2Zvcm1zKGRhdGEpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZm9yICh2YXIgYXR0ciBpbiB0cmFuc2Zvcm1zKSB7XG4gICAgICAgICAgICAgICAgaWYgKHRyYW5zZm9ybXMuaGFzT3duUHJvcGVydHkoYXR0cikpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGRhdGFbYXR0cl0pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciB0cmFuc2Zvcm0gPSB0cmFuc2Zvcm1zW2F0dHJdO1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHZhbCA9IGRhdGFbYXR0cl07XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mKHRyYW5zZm9ybSkgPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgc3BsaXQgPSB0cmFuc2Zvcm0uc3BsaXQoJy4nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZWxldGUgZGF0YVthdHRyXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoc3BsaXQubGVuZ3RoID09IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0YVtzcGxpdFswXV0gPSB2YWw7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0YVtzcGxpdFswXV0gPSB7fTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG5ld1ZhbCA9IGRhdGFbc3BsaXRbMF1dO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMTsgaSA8IHNwbGl0Lmxlbmd0aCAtIDE7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG5ld0F0dHIgPSBzcGxpdFtpXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5ld1ZhbFtuZXdBdHRyXSA9IHt9O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV3VmFsID0gbmV3VmFsW25ld0F0dHJdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5ld1ZhbFtzcGxpdFtzcGxpdC5sZW5ndGggLSAxXV0gPSB2YWw7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YodHJhbnNmb3JtKSA9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHRyYW5zZm9ybWVkID0gdHJhbnNmb3JtKHZhbCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHV0aWwuaXNBcnJheSh0cmFuc2Zvcm1lZCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVsZXRlIGRhdGFbYXR0cl07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdGFbdHJhbnNmb3JtZWRbMF1dID0gdHJhbnNmb3JtZWRbMV07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0YVthdHRyXSA9IHRyYW5zZm9ybWVkO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ0ludmFsaWQgdHJhbnNmb3JtZXInKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZGF0YTtcbiAgICB9XG59KTtcblxuZXhwb3J0cy5EZXNjcmlwdG9yID0gRGVzY3JpcHRvcjtcbmV4cG9ydHMucmVzb2x2ZU1ldGhvZCA9IHJlc29sdmVNZXRob2Q7IiwidmFyIF9pbnRlcm5hbCA9IHNpZXN0YS5faW50ZXJuYWwsXG4gICAgdXRpbCA9IF9pbnRlcm5hbC51dGlsLFxuICAgIF8gPSB1dGlsLl8sXG4gICAgbG9nID0gX2ludGVybmFsLmxvZztcblxudmFyIExvZ2dlciA9IGxvZy5sb2dnZXJXaXRoTmFtZSgnRGVzY3JpcHRvcicpO1xuXG4vKipcbiAqIEBjbGFzcyBFbnRyeSBwb2ludCBmb3IgZGVzY3JpcHRvciByZWdpc3RyYXRpb24uXG4gKiBAY29uc3RydWN0b3JcbiAqL1xuZnVuY3Rpb24gRGVzY3JpcHRvclJlZ2lzdHJ5KCkge1xuICAgIGlmICghdGhpcykge1xuICAgICAgICByZXR1cm4gbmV3IERlc2NyaXB0b3JSZWdpc3RyeShvcHRzKTtcbiAgICB9XG4gICAgdGhpcy5yZXF1ZXN0RGVzY3JpcHRvcnMgPSB7fTtcbiAgICB0aGlzLnJlc3BvbnNlRGVzY3JpcHRvcnMgPSB7fTtcbn1cblxuZnVuY3Rpb24gX3JlZ2lzdGVyRGVzY3JpcHRvcihkZXNjcmlwdG9ycywgZGVzY3JpcHRvcikge1xuICAgIHZhciBtb2RlbCA9IGRlc2NyaXB0b3IubW9kZWw7XG4gICAgdmFyIGNvbGxlY3Rpb25OYW1lID0gbW9kZWwuY29sbGVjdGlvbk5hbWU7XG4gICAgaWYgKCFkZXNjcmlwdG9yc1tjb2xsZWN0aW9uTmFtZV0pIHtcbiAgICAgICAgZGVzY3JpcHRvcnNbY29sbGVjdGlvbk5hbWVdID0gW107XG4gICAgfVxuICAgIGRlc2NyaXB0b3JzW2NvbGxlY3Rpb25OYW1lXS5wdXNoKGRlc2NyaXB0b3IpO1xufVxuXG5mdW5jdGlvbiBfZGVzY3JpcHRvcnNGb3JDb2xsZWN0aW9uKGRlc2NyaXB0b3JzLCBjb2xsZWN0aW9uKSB7XG4gICAgdmFyIGRlc2NyaXB0b3JzRm9yQ29sbGVjdGlvbjtcbiAgICBpZiAodHlwZW9mKGNvbGxlY3Rpb24pID09ICdzdHJpbmcnKSB7XG4gICAgICAgIGRlc2NyaXB0b3JzRm9yQ29sbGVjdGlvbiA9IGRlc2NyaXB0b3JzW2NvbGxlY3Rpb25dIHx8IFtdO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgZGVzY3JpcHRvcnNGb3JDb2xsZWN0aW9uID0gKGRlc2NyaXB0b3JzW2NvbGxlY3Rpb24ubmFtZV0gfHwgW10pO1xuICAgIH1cbiAgICByZXR1cm4gZGVzY3JpcHRvcnNGb3JDb2xsZWN0aW9uO1xufVxuXG5cbl8uZXh0ZW5kKERlc2NyaXB0b3JSZWdpc3RyeS5wcm90b3R5cGUsIHtcbiAgICByZWdpc3RlclJlcXVlc3REZXNjcmlwdG9yOiBmdW5jdGlvbiAocmVxdWVzdERlc2NyaXB0b3IpIHtcbiAgICAgICAgX3JlZ2lzdGVyRGVzY3JpcHRvcih0aGlzLnJlcXVlc3REZXNjcmlwdG9ycywgcmVxdWVzdERlc2NyaXB0b3IpO1xuICAgIH0sXG4gICAgcmVnaXN0ZXJSZXNwb25zZURlc2NyaXB0b3I6IGZ1bmN0aW9uIChyZXNwb25zZURlc2NyaXB0b3IpIHtcbiAgICAgICAgaWYgKExvZ2dlci50cmFjZS5pc0VuYWJsZWQpXG4gICAgICAgICAgICBMb2dnZXIudHJhY2UoJ3JlZ2lzdGVyUmVzcG9uc2VEZXNjcmlwdG9yJyk7XG4gICAgICAgIF9yZWdpc3RlckRlc2NyaXB0b3IodGhpcy5yZXNwb25zZURlc2NyaXB0b3JzLCByZXNwb25zZURlc2NyaXB0b3IpO1xuICAgIH0sXG4gICAgcmVxdWVzdERlc2NyaXB0b3JzRm9yQ29sbGVjdGlvbjogZnVuY3Rpb24gKGNvbGxlY3Rpb24pIHtcbiAgICAgICAgcmV0dXJuIF9kZXNjcmlwdG9yc0ZvckNvbGxlY3Rpb24odGhpcy5yZXF1ZXN0RGVzY3JpcHRvcnMsIGNvbGxlY3Rpb24pO1xuICAgIH0sXG4gICAgcmVzcG9uc2VEZXNjcmlwdG9yc0ZvckNvbGxlY3Rpb246IGZ1bmN0aW9uIChjb2xsZWN0aW9uKSB7XG4gICAgICAgIHZhciBkZXNjcmlwdG9yc0ZvckNvbGxlY3Rpb24gPSBfZGVzY3JpcHRvcnNGb3JDb2xsZWN0aW9uKHRoaXMucmVzcG9uc2VEZXNjcmlwdG9ycywgY29sbGVjdGlvbik7XG4gICAgICAgIGlmICghZGVzY3JpcHRvcnNGb3JDb2xsZWN0aW9uLmxlbmd0aCkge1xuICAgICAgICAgICAgaWYgKExvZ2dlci5kZWJ1Zy5pc0VuYWJsZWQpXG4gICAgICAgICAgICAgICAgTG9nZ2VyLmRlYnVnKCdObyByZXNwb25zZSBkZXNjcmlwdG9ycyBmb3IgY29sbGVjdGlvbiAnLCB0aGlzLnJlc3BvbnNlRGVzY3JpcHRvcnMpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBkZXNjcmlwdG9yc0ZvckNvbGxlY3Rpb247XG4gICAgfSxcbiAgICByZXNldDogZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLnJlcXVlc3REZXNjcmlwdG9ycyA9IHt9O1xuICAgICAgICB0aGlzLnJlc3BvbnNlRGVzY3JpcHRvcnMgPSB7fTtcbiAgICB9XG59KTtcblxuZXhwb3J0cy5EZXNjcmlwdG9yUmVnaXN0cnkgPSBuZXcgRGVzY3JpcHRvclJlZ2lzdHJ5KCk7IiwiLyoqXG4gKiBQcm92aXNpb25zIHVzYWdlIG9mICQuYWpheCBhbmQgc2ltaWxhciBmdW5jdGlvbnMgdG8gc2VuZCBIVFRQIHJlcXVlc3RzIG1hcHBpbmdcbiAqIHRoZSByZXN1bHRzIGJhY2sgb250byB0aGUgb2JqZWN0IGdyYXBoIGF1dG9tYXRpY2FsbHkuXG4gKiBAbW9kdWxlIGh0dHBcbiAqL1xuXG5pZiAodHlwZW9mIHNpZXN0YSA9PSAndW5kZWZpbmVkJyAmJiB0eXBlb2YgbW9kdWxlID09ICd1bmRlZmluZWQnKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdDb3VsZCBub3QgZmluZCB3aW5kb3cuc2llc3RhLiBNYWtlIHN1cmUgeW91IGluY2x1ZGUgc2llc3RhLmNvcmUuanMgZmlyc3QuJyk7XG59XG5cbnZhciBfaW50ZXJuYWwgPSBzaWVzdGEuX2ludGVybmFsLFxuICAgIENvbGxlY3Rpb24gPSBfaW50ZXJuYWwuQ29sbGVjdGlvbixcbiAgICBsb2cgPSBfaW50ZXJuYWwubG9nLFxuICAgIHV0aWwgPSBfaW50ZXJuYWwudXRpbCxcbiAgICBlcnJvciA9IF9pbnRlcm5hbC5lcnJvcixcbiAgICBfID0gdXRpbC5fLFxuICAgIGRlc2NyaXB0b3IgPSByZXF1aXJlKCcuL2Rlc2NyaXB0b3InKSxcbiAgICBJbnRlcm5hbFNpZXN0YUVycm9yID0gX2ludGVybmFsLmVycm9yLkludGVybmFsU2llc3RhRXJyb3I7XG5cbnZhciBEZXNjcmlwdG9yUmVnaXN0cnkgPSByZXF1aXJlKCcuL2Rlc2NyaXB0b3JSZWdpc3RyeScpLkRlc2NyaXB0b3JSZWdpc3RyeTtcblxuXG52YXIgTG9nZ2VyID0gbG9nLmxvZ2dlcldpdGhOYW1lKCdIVFRQJyk7XG5cbi8qKlxuICogTG9nIGEgSFRUUCByZXNwb25zZVxuICogQHBhcmFtIG9wdHNcbiAqIEBwYXJhbSB4aHJcbiAqIEBwYXJhbSBbZGF0YV0gLSBSYXcgZGF0YSByZWNlaXZlZCBpbiBIVFRQIHJlc3BvbnNlLlxuICovXG5mdW5jdGlvbiBsb2dIdHRwUmVzcG9uc2Uob3B0cywgeGhyLCBkYXRhKSB7XG4gICAgaWYgKExvZ2dlci5kZWJ1Zy5pc0VuYWJsZWQpIHtcbiAgICAgICAgdmFyIGxvZ2dlciA9IExvZ2dlci5kZWJ1ZztcbiAgICAgICAgdmFyIGxvZ01lc3NhZ2UgPSBvcHRzLnR5cGUgKyAnICcgKyB4aHIuc3RhdHVzICsgJyAnICsgb3B0cy51cmw7XG4gICAgICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkICYmIGRhdGEpIHtcbiAgICAgICAgICAgIGxvZ2dlciA9IExvZ2dlci50cmFjZTtcbiAgICAgICAgICAgIGxvZ01lc3NhZ2UgKz0gJzogJyArIHV0aWwucHJldHR5UHJpbnQoZGF0YSk7XG4gICAgICAgIH1cbiAgICAgICAgbG9nZ2VyKGxvZ01lc3NhZ2UpO1xuICAgIH1cbn1cblxuLyoqXG4gKiBMb2cgYSBIVFRQIHJlcXVlc3RcbiAqIEBwYXJhbSBvcHRzXG4gKi9cbmZ1bmN0aW9uIGxvZ0h0dHBSZXF1ZXN0KG9wdHMpIHtcbiAgICBpZiAoTG9nZ2VyLmRlYnVnLmlzRW5hYmxlZCkge1xuICAgICAgICB2YXIgbG9nZ2VyID0gTG9nZ2VyLmRlYnVnO1xuICAgICAgICAvLyBUT0RPOiBBcHBlbmQgcXVlcnkgcGFyYW1ldGVycyB0byB0aGUgVVJMLlxuICAgICAgICB2YXIgbG9nTWVzc2FnZSA9IG9wdHMudHlwZSArICcgJyArIG9wdHMudXJsO1xuICAgICAgICBpZiAoTG9nZ2VyLnRyYWNlLmlzRW5hYmxlZCkge1xuICAgICAgICAgICAgLy8gVE9ETzogSWYgYW55IGRhdGEgaXMgYmVpbmcgc2VudCwgbG9nIHRoYXQuXG4gICAgICAgICAgICBsb2dnZXIgPSBMb2dnZXIudHJhY2U7XG4gICAgICAgIH1cbiAgICAgICAgbG9nZ2VyKGxvZ01lc3NhZ2UpO1xuICAgIH1cbn1cblxuXG4vKipcbiAqIFNlbmQgYSBIVFRQIHJlcXVlc3QgdG8gdGhlIGdpdmVuIG1ldGhvZCBhbmQgcGF0aCBwYXJzaW5nIHRoZSByZXNwb25zZS5cbiAqIEBwYXJhbSB7U3RyaW5nfSBtZXRob2RcbiAqIEBwYXJhbSB7U3RyaW5nfSBwYXRoIFRoZSBwYXRoIHRvIHRoZSByZXNvdXJjZSB3ZSB3YW50IHRvIEdFVFxuICogQHBhcmFtIHtPYmplY3R8RnVuY3Rpb259IG9wdHNPckNhbGxiYWNrIEVpdGhlciBhbiBvcHRpb25zIG9iamVjdCBvciBhIGNhbGxiYWNrIGlmIGNhbiB1c2UgZGVmYXVsdHNcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIENhbGxiYWNrIGlmIG9wdHMgc3BlY2lmaWVkLlxuICovXG5mdW5jdGlvbiBfaHR0cFJlc3BvbnNlKG1ldGhvZCwgcGF0aCwgb3B0c09yQ2FsbGJhY2ssIGNhbGxiYWNrKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAyKTtcbiAgICB2YXIgb3B0cyA9IHt9O1xuICAgIHZhciBuYW1lID0gdGhpcy5uYW1lO1xuICAgIGlmICh0eXBlb2YoYXJnc1swXSkgPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICBjYWxsYmFjayA9IGFyZ3NbMF07XG4gICAgfSBlbHNlIGlmICh0eXBlb2YoYXJnc1swXSkgPT0gJ29iamVjdCcpIHtcbiAgICAgICAgb3B0cyA9IGFyZ3NbMF07XG4gICAgICAgIGNhbGxiYWNrID0gYXJnc1sxXTtcbiAgICB9XG4gICAgdmFyIGRlZmVycmVkID0gdXRpbC5kZWZlcigpO1xuICAgIG9wdHMudHlwZSA9IG1ldGhvZDtcbiAgICBpZiAoIW9wdHMudXJsKSB7IC8vIEFsbG93IG92ZXJyaWRlcy5cbiAgICAgICAgdmFyIGJhc2VVUkwgPSB0aGlzLmJhc2VVUkw7XG4gICAgICAgIG9wdHMudXJsID0gYmFzZVVSTCArIHBhdGg7XG4gICAgfVxuICAgIGlmIChvcHRzLnBhcnNlUmVzcG9uc2UgPT09IHVuZGVmaW5lZCkgb3B0cy5wYXJzZVJlc3BvbnNlID0gdHJ1ZTtcbiAgICBvcHRzLnN1Y2Nlc3MgPSBmdW5jdGlvbiAoZGF0YSwgc3RhdHVzLCB4aHIpIHtcbiAgICAgICAgbG9nSHR0cFJlc3BvbnNlKG9wdHMsIHhociwgZGF0YSk7XG4gICAgICAgIHZhciByZXNwID0ge1xuICAgICAgICAgICAgZGF0YTogZGF0YSxcbiAgICAgICAgICAgIHN0YXR1czogc3RhdHVzLFxuICAgICAgICAgICAgeGhyOiB4aHJcbiAgICAgICAgfTtcbiAgICAgICAgaWYgKG9wdHMucGFyc2VSZXNwb25zZSkge1xuICAgICAgICAgICAgdmFyIGRlc2NyaXB0b3JzID0gRGVzY3JpcHRvclJlZ2lzdHJ5LnJlc3BvbnNlRGVzY3JpcHRvcnNGb3JDb2xsZWN0aW9uKHNlbGYpO1xuICAgICAgICAgICAgdmFyIG1hdGNoZWREZXNjcmlwdG9yO1xuICAgICAgICAgICAgdmFyIGV4dHJhY3RlZERhdGE7XG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGRlc2NyaXB0b3JzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgdmFyIGRlc2NyaXB0b3IgPSBkZXNjcmlwdG9yc1tpXTtcbiAgICAgICAgICAgICAgICBleHRyYWN0ZWREYXRhID0gZGVzY3JpcHRvci5tYXRjaChvcHRzLCBkYXRhKTtcbiAgICAgICAgICAgICAgICBpZiAoZXh0cmFjdGVkRGF0YSkge1xuICAgICAgICAgICAgICAgICAgICBtYXRjaGVkRGVzY3JpcHRvciA9IGRlc2NyaXB0b3I7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChtYXRjaGVkRGVzY3JpcHRvcikge1xuICAgICAgICAgICAgICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgICAgIExvZ2dlci50cmFjZSgnTW9kZWwgX2NvbnN0cnVjdFN1Yk9wZXJhdGlvbiBkYXRhOiAnICsgdXRpbC5wcmV0dHlQcmludChleHRyYWN0ZWREYXRhKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YoZXh0cmFjdGVkRGF0YSkgPT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIG1hcHBpbmcgPSBtYXRjaGVkRGVzY3JpcHRvci5tb2RlbDtcbiAgICAgICAgICAgICAgICAgICAgbWFwcGluZy5tYXAoZXh0cmFjdGVkRGF0YSwge292ZXJyaWRlOiBvcHRzLm9ian0sIGZ1bmN0aW9uIChlcnIsIG9iaikge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGNhbGxiYWNrKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIsIG9iaiwgcmVzcCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7IC8vIE1hdGNoZWQsIGJ1dCBubyBkYXRhLlxuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhudWxsLCB0cnVlLCByZXNwKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGNhbGxiYWNrKSB7XG4gICAgICAgICAgICAgICAgaWYgKG5hbWUpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGVyciA9IHt9O1xuICAgICAgICAgICAgICAgICAgICB2YXIgY29kZSA9IGVycm9yLkVycm9yQ29kZS5Ob0Rlc2NyaXB0b3JNYXRjaGVkO1xuICAgICAgICAgICAgICAgICAgICBlcnJbZXJyb3IuRXJyb3JGaWVsZC5Db2RlXSA9IGNvZGU7XG4gICAgICAgICAgICAgICAgICAgIGVycltlcnJvci5FcnJvckZpZWxkLk1lc3NhZ2VdID0gZXJyb3IuTWVzc2FnZVtjb2RlXTtcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyLCBudWxsLCByZXNwKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyBUaGVyZSB3YXMgYSBidWcgd2hlcmUgY29sbGVjdGlvbiBuYW1lIGRvZXNuJ3QgZXhpc3QuIElmIHRoaXMgb2NjdXJzLCB0aGVuIHdpbGwgbmV2ZXIgZ2V0IGhvbGQgb2YgYW55IGRlc2NyaXB0b3JzLlxuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignVW5uYW1lZCBjb2xsZWN0aW9uJyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY2FsbGJhY2sobnVsbCwgbnVsbCwgcmVzcCk7XG4gICAgICAgIH1cblxuICAgIH07XG4gICAgb3B0cy5lcnJvciA9IGZ1bmN0aW9uICh4aHIsIHN0YXR1cywgZXJyb3IpIHtcbiAgICAgICAgdmFyIHJlc3AgPSB7XG4gICAgICAgICAgICB4aHI6IHhocixcbiAgICAgICAgICAgIHN0YXR1czogc3RhdHVzLFxuICAgICAgICAgICAgZXJyb3I6IGVycm9yXG4gICAgICAgIH07XG4gICAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2socmVzcCwgbnVsbCwgcmVzcCk7XG4gICAgfTtcbiAgICBsb2dIdHRwUmVxdWVzdChvcHRzKTtcbiAgICBzaWVzdGEuZXh0Lmh0dHAuYWpheChvcHRzKTtcbiAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbn1cblxuZnVuY3Rpb24gX3NlcmlhbGlzZU9iamVjdChvcHRzLCBvYmosIGNiKSB7XG4gICAgdGhpcy5fc2VyaWFsaXNlKG9iaiwgZnVuY3Rpb24gKGVyciwgZGF0YSkge1xuICAgICAgICB2YXIgcmV0RGF0YSA9IGRhdGE7XG4gICAgICAgIGlmIChvcHRzLmZpZWxkcykge1xuICAgICAgICAgICAgcmV0RGF0YSA9IHt9O1xuICAgICAgICAgICAgXy5lYWNoKG9wdHMuZmllbGRzLCBmdW5jdGlvbiAoZikge1xuICAgICAgICAgICAgICAgIHJldERhdGFbZl0gPSBkYXRhW2ZdO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgY2IoZXJyLCByZXREYXRhKTtcbiAgICB9KTtcbn1cblxuLyoqXG4gKiBTZW5kIGEgSFRUUCByZXF1ZXN0IHRvIHRoZSBnaXZlbiBtZXRob2QgYW5kIHBhdGhcbiAqIEBwYXJhbSB7U3RyaW5nfSBtZXRob2RcbiAqIEBwYXJhbSB7U3RyaW5nfSBwYXRoIFRoZSBwYXRoIHRvIHRoZSByZXNvdXJjZSB3ZSB3YW50IHRvIEdFVFxuICogQHBhcmFtIHtNb2RlbEluc3RhbmNlfSBvYmplY3QgVGhlIG1vZGVsIHdlJ3JlIHB1c2hpbmcgdG8gdGhlIHNlcnZlclxuICogQHBhcmFtIHtPYmplY3R8RnVuY3Rpb259IG9wdHNPckNhbGxiYWNrIEVpdGhlciBhbiBvcHRpb25zIG9iamVjdCBvciBhIGNhbGxiYWNrIGlmIGNhbiB1c2UgZGVmYXVsdHNcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIENhbGxiYWNrIGlmIG9wdHMgc3BlY2lmaWVkLlxuICovXG5mdW5jdGlvbiBfaHR0cFJlcXVlc3QobWV0aG9kLCBwYXRoLCBvYmplY3QpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDMpO1xuICAgIHZhciBjYWxsYmFjaztcbiAgICB2YXIgb3B0cyA9IHt9O1xuICAgIGlmICh0eXBlb2YoYXJnc1swXSkgPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICBjYWxsYmFjayA9IGFyZ3NbMF07XG4gICAgfSBlbHNlIGlmICh0eXBlb2YoYXJnc1swXSkgPT0gJ29iamVjdCcpIHtcbiAgICAgICAgb3B0cyA9IGFyZ3NbMF07XG4gICAgICAgIGNhbGxiYWNrID0gYXJnc1sxXTtcbiAgICB9XG4gICAgdmFyIGRlZmVycmVkID0gdXRpbC5kZWZlcihjYWxsYmFjayk7XG4gICAgY2FsbGJhY2sgPSBkZWZlcnJlZC5maW5pc2guYmluZChkZWZlcnJlZCk7XG4gICAgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3MsIDIpO1xuICAgIHZhciByZXF1ZXN0RGVzY3JpcHRvcnMgPSBEZXNjcmlwdG9yUmVnaXN0cnkucmVxdWVzdERlc2NyaXB0b3JzRm9yQ29sbGVjdGlvbih0aGlzKTtcbiAgICB2YXIgbWF0Y2hlZERlc2NyaXB0b3I7XG4gICAgb3B0cy50eXBlID0gbWV0aG9kO1xuICAgIHZhciBiYXNlVVJMID0gdGhpcy5iYXNlVVJMO1xuICAgIG9wdHMudXJsID0gYmFzZVVSTCArIHBhdGg7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCByZXF1ZXN0RGVzY3JpcHRvcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIHJlcXVlc3REZXNjcmlwdG9yID0gcmVxdWVzdERlc2NyaXB0b3JzW2ldO1xuICAgICAgICBpZiAocmVxdWVzdERlc2NyaXB0b3IuX21hdGNoQ29uZmlnKG9wdHMpKSB7XG4gICAgICAgICAgICBtYXRjaGVkRGVzY3JpcHRvciA9IHJlcXVlc3REZXNjcmlwdG9yO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICB9XG4gICAgaWYgKG1hdGNoZWREZXNjcmlwdG9yKSB7XG4gICAgICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKVxuICAgICAgICAgICAgTG9nZ2VyLnRyYWNlKCdNYXRjaGVkIGRlc2NyaXB0b3I6ICcgKyBtYXRjaGVkRGVzY3JpcHRvci5fZHVtcCh0cnVlKSk7XG4gICAgICAgIF9zZXJpYWxpc2VPYmplY3QuY2FsbChtYXRjaGVkRGVzY3JpcHRvciwgb2JqZWN0LCBvcHRzLCBmdW5jdGlvbiAoZXJyLCBkYXRhKSB7XG4gICAgICAgICAgICBpZiAoTG9nZ2VyLnRyYWNlLmlzRW5hYmxlZClcbiAgICAgICAgICAgICAgICBMb2dnZXIudHJhY2UoJ19zZXJpYWxpc2UnLCB7XG4gICAgICAgICAgICAgICAgICAgIGVycjogZXJyLFxuICAgICAgICAgICAgICAgICAgICBkYXRhOiBkYXRhXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhlcnIsIG51bGwsIG51bGwpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBvcHRzLmRhdGEgPSBkYXRhO1xuICAgICAgICAgICAgICAgIG9wdHMub2JqID0gb2JqZWN0O1xuICAgICAgICAgICAgICAgIF8ucGFydGlhbChfaHR0cFJlc3BvbnNlLCBtZXRob2QsIHBhdGgsIG9wdHMsIGNhbGxiYWNrKS5hcHBseShzZWxmLCBhcmdzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICB9IGVsc2UgaWYgKGNhbGxiYWNrKSB7XG4gICAgICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKVxuICAgICAgICAgICAgTG9nZ2VyLnRyYWNlKCdEaWQgbm90IG1hdGNoIGRlc2NyaXB0b3InKTtcbiAgICAgICAgY2FsbGJhY2soJ05vIGRlc2NyaXB0b3IgbWF0Y2hlZCcsIG51bGwsIG51bGwpO1xuICAgIH1cbiAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbn1cblxuLyoqXG4gKiBTZW5kIGEgREVMRVRFIHJlcXVlc3QuIEFsc28gcmVtb3ZlcyB0aGUgb2JqZWN0LlxuICogQHBhcmFtIHtTdHJpbmd9IHBhdGggVGhlIHBhdGggdG8gdGhlIHJlc291cmNlIHRvIHdoaWNoIHdlIHdhbnQgdG8gREVMRVRFXG4gKiBAcGFyYW0ge01vZGVsSW5zdGFuY2V9IG9iamVjdCBUaGUgbW9kZWwgdGhhdCB3ZSB3b3VsZCBsaWtlIHRvIFBBVENIXG4gKiBAcmV0dXJucyB7UHJvbWlzZX1cbiAqL1xuZnVuY3Rpb24gREVMRVRFKHBhdGgsIG9iamVjdCkge1xuICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAyKTtcbiAgICB2YXIgb3B0cyA9IHt9O1xuICAgIHZhciBjYWxsYmFjaztcbiAgICBpZiAodHlwZW9mKGFyZ3NbMF0pID09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgY2FsbGJhY2sgPSBhcmdzWzBdO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mKGFyZ3NbMF0pID09ICdvYmplY3QnKSB7XG4gICAgICAgIG9wdHMgPSBhcmdzWzBdO1xuICAgICAgICBjYWxsYmFjayA9IGFyZ3NbMV07XG4gICAgfVxuICAgIHZhciBkZWZlcnJlZCA9IHV0aWwuZGVmZXIoY2FsbGJhY2spO1xuICAgIHZhciBkZWxldGlvbk1vZGUgPSBvcHRzLmRlbGV0aW9uTW9kZSB8fCAncmVzdG9yZSc7XG4gICAgLy8gQnkgZGVmYXVsdCB3ZSBkbyBub3QgbWFwIHRoZSByZXNwb25zZSBmcm9tIGEgREVMRVRFIHJlcXVlc3QuXG4gICAgaWYgKG9wdHMucGFyc2VSZXNwb25zZSA9PT0gdW5kZWZpbmVkKSBvcHRzLnBhcnNlUmVzcG9uc2UgPSBmYWxzZTtcbiAgICBfaHR0cFJlc3BvbnNlLmNhbGwodGhpcywgJ0RFTEVURScsIHBhdGgsIG9wdHMsIGZ1bmN0aW9uIChlcnIsIHgsIHksIHopIHtcbiAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgaWYgKGRlbGV0aW9uTW9kZSA9PSAncmVzdG9yZScpIHtcbiAgICAgICAgICAgICAgICBvYmplY3QucmVzdG9yZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKGRlbGV0aW9uTW9kZSA9PSAnc3VjY2VzcycpIHtcbiAgICAgICAgICAgIG9iamVjdC5yZW1vdmUoKTtcbiAgICAgICAgfVxuICAgICAgICBjYWxsYmFjayhlcnIsIHgsIHksIHopO1xuICAgICAgICBkZWZlcnJlZC5maW5pc2goZXJyLCB7eDogeCwgeTogeSwgejp6fSk7XG4gICAgfSk7XG4gICAgaWYgKGRlbGV0aW9uTW9kZSA9PSAnbm93JyB8fCBkZWxldGlvbk1vZGUgPT0gJ3Jlc3RvcmUnKSB7XG4gICAgICAgIG9iamVjdC5yZW1vdmUoKTtcbiAgICB9XG4gICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG59XG5cbi8qKlxuICogU2VuZCBhIEhUVFAgcmVxdWVzdCB1c2luZyB0aGUgZ2l2ZW4gbWV0aG9kXG4gKiBAcGFyYW0gcmVxdWVzdCBEb2VzIHRoZSByZXF1ZXN0IGNvbnRhaW4gZGF0YT8gZS5nLiBQT1NUL1BBVENIL1BVVCB3aWxsIGJlIHRydWUsIEdFVCB3aWxsIGZhbHNlXG4gKiBAcGFyYW0gbWV0aG9kXG4gKiBAaW50ZXJuYWxcbiAqIEByZXR1cm5zIHtQcm9taXNlfVxuICovXG5mdW5jdGlvbiBIVFRQX01FVEhPRChyZXF1ZXN0LCBtZXRob2QpIHtcbiAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMik7XG4gICAgcmV0dXJuIF8ucGFydGlhbChyZXF1ZXN0ID8gX2h0dHBSZXF1ZXN0IDogX2h0dHBSZXNwb25zZSwgbWV0aG9kKS5hcHBseSh0aGlzLCBhcmdzKTtcbn1cblxuLyoqXG4gKiBTZW5kIGEgR0VUIHJlcXVlc3RcbiAqIEBwYXJhbSB7U3RyaW5nfSBwYXRoIFRoZSBwYXRoIHRvIHRoZSByZXNvdXJjZSB3ZSB3YW50IHRvIEdFVFxuICogQHBhcmFtIHtPYmplY3R8RnVuY3Rpb259IG9wdHNPckNhbGxiYWNrIEVpdGhlciBhbiBvcHRpb25zIG9iamVjdCBvciBhIGNhbGxiYWNrIGlmIGNhbiB1c2UgZGVmYXVsdHNcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIENhbGxiYWNrIGlmIG9wdHMgc3BlY2lmaWVkLlxuICogQHBhY2thZ2UgSFRUUFxuICogQHJldHVybnMge1Byb21pc2V9XG4gKi9cbmZ1bmN0aW9uIEdFVCgpIHtcbiAgICByZXR1cm4gXy5wYXJ0aWFsKEhUVFBfTUVUSE9ELCBmYWxzZSwgJ0dFVCcpLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG59XG5cbi8qKlxuICogU2VuZCBhbiBPUFRJT05TIHJlcXVlc3RcbiAqIEBwYXJhbSB7U3RyaW5nfSBwYXRoIFRoZSBwYXRoIHRvIHRoZSByZXNvdXJjZSB3ZSB3YW50IHRvIEdFVFxuICogQHBhcmFtIHtPYmplY3R8RnVuY3Rpb259IG9wdHNPckNhbGxiYWNrIEVpdGhlciBhbiBvcHRpb25zIG9iamVjdCBvciBhIGNhbGxiYWNrIGlmIGNhbiB1c2UgZGVmYXVsdHNcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIENhbGxiYWNrIGlmIG9wdHMgc3BlY2lmaWVkLlxuICogQHBhY2thZ2UgSFRUUFxuICogQHJldHVybnMge1Byb21pc2V9XG4gKi9cbmZ1bmN0aW9uIE9QVElPTlMoKSB7XG4gICAgcmV0dXJuIF8ucGFydGlhbChIVFRQX01FVEhPRCwgZmFsc2UsICdPUFRJT05TJykuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbn1cblxuLyoqXG4gKiBTZW5kIGFuIFRSQUNFIHJlcXVlc3RcbiAqIEBwYXJhbSB7U3RyaW5nfSBwYXRoIFRoZSBwYXRoIHRvIHRoZSByZXNvdXJjZSB3ZSB3YW50IHRvIEdFVFxuICogQHBhcmFtIHtPYmplY3R8RnVuY3Rpb259IG9wdHNPckNhbGxiYWNrIEVpdGhlciBhbiBvcHRpb25zIG9iamVjdCBvciBhIGNhbGxiYWNrIGlmIGNhbiB1c2UgZGVmYXVsdHNcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIENhbGxiYWNrIGlmIG9wdHMgc3BlY2lmaWVkLlxuICogQHBhY2thZ2UgSFRUUFxuICogQHJldHVybnMge1Byb21pc2V9XG4gKi9cbmZ1bmN0aW9uIFRSQUNFKCkge1xuICAgIHJldHVybiBfLnBhcnRpYWwoSFRUUF9NRVRIT0QsIGZhbHNlLCAnVFJBQ0UnKS5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xufVxuXG4vKipcbiAqIFNlbmQgYW4gSEVBRCByZXF1ZXN0XG4gKiBAcGFyYW0ge1N0cmluZ30gcGF0aCBUaGUgcGF0aCB0byB0aGUgcmVzb3VyY2Ugd2Ugd2FudCB0byBHRVRcbiAqIEBwYXJhbSB7T2JqZWN0fEZ1bmN0aW9ufSBvcHRzT3JDYWxsYmFjayBFaXRoZXIgYW4gb3B0aW9ucyBvYmplY3Qgb3IgYSBjYWxsYmFjayBpZiBjYW4gdXNlIGRlZmF1bHRzXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBDYWxsYmFjayBpZiBvcHRzIHNwZWNpZmllZC5cbiAqIEBwYWNrYWdlIEhUVFBcbiAqIEByZXR1cm5zIHtQcm9taXNlfVxuICovXG5mdW5jdGlvbiBIRUFEKCkge1xuICAgIHJldHVybiBfLnBhcnRpYWwoSFRUUF9NRVRIT0QsIGZhbHNlLCAnSEVBRCcpLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG59XG5cbi8qKlxuICogU2VuZCBhbiBQT1NUIHJlcXVlc3RcbiAqIEBwYXJhbSB7U3RyaW5nfSBwYXRoIFRoZSBwYXRoIHRvIHRoZSByZXNvdXJjZSB3ZSB3YW50IHRvIEdFVFxuICogQHBhcmFtIHtNb2RlbEluc3RhbmNlfSBtb2RlbCBUaGUgbW9kZWwgdGhhdCB3ZSB3b3VsZCBsaWtlIHRvIFBPU1RcbiAqIEBwYXJhbSB7T2JqZWN0fEZ1bmN0aW9ufSBvcHRzT3JDYWxsYmFjayBFaXRoZXIgYW4gb3B0aW9ucyBvYmplY3Qgb3IgYSBjYWxsYmFjayBpZiBjYW4gdXNlIGRlZmF1bHRzXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBDYWxsYmFjayBpZiBvcHRzIHNwZWNpZmllZC5cbiAqIEBwYWNrYWdlIEhUVFBcbiAqIEByZXR1cm5zIHtQcm9taXNlfVxuICovXG5mdW5jdGlvbiBQT1NUKCkge1xuICAgIHJldHVybiBfLnBhcnRpYWwoSFRUUF9NRVRIT0QsIHRydWUsICdQT1NUJykuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbn1cblxuLyoqXG4gKiBTZW5kIGFuIFBVVCByZXF1ZXN0XG4gKiBAcGFyYW0ge1N0cmluZ30gcGF0aCBUaGUgcGF0aCB0byB0aGUgcmVzb3VyY2Ugd2Ugd2FudCB0byBHRVRcbiAqIEBwYXJhbSB7TW9kZWxJbnN0YW5jZX0gbW9kZWwgVGhlIG1vZGVsIHRoYXQgd2Ugd291bGQgbGlrZSB0byBQT1NUXG4gKiBAcGFyYW0ge09iamVjdHxGdW5jdGlvbn0gb3B0c09yQ2FsbGJhY2sgRWl0aGVyIGFuIG9wdGlvbnMgb2JqZWN0IG9yIGEgY2FsbGJhY2sgaWYgY2FuIHVzZSBkZWZhdWx0c1xuICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgQ2FsbGJhY2sgaWYgb3B0cyBzcGVjaWZpZWQuXG4gKiBAcGFja2FnZSBIVFRQXG4gKiBAcmV0dXJucyB7UHJvbWlzZX1cbiAqL1xuZnVuY3Rpb24gUFVUKCkge1xuICAgIHJldHVybiBfLnBhcnRpYWwoSFRUUF9NRVRIT0QsIHRydWUsICdQVVQnKS5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xufVxuXG4vKipcbiAqIFNlbmQgYW4gUEFUQ0ggcmVxdWVzdFxuICogQHBhcmFtIHtTdHJpbmd9IHBhdGggVGhlIHBhdGggdG8gdGhlIHJlc291cmNlIHdlIHdhbnQgdG8gR0VUXG4gKiBAcGFyYW0ge01vZGVsSW5zdGFuY2V9IG1vZGVsIFRoZSBtb2RlbCB0aGF0IHdlIHdvdWxkIGxpa2UgdG8gUE9TVFxuICogQHBhcmFtIHtPYmplY3R8RnVuY3Rpb259IG9wdHNPckNhbGxiYWNrIEVpdGhlciBhbiBvcHRpb25zIG9iamVjdCBvciBhIGNhbGxiYWNrIGlmIGNhbiB1c2UgZGVmYXVsdHNcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIENhbGxiYWNrIGlmIG9wdHMgc3BlY2lmaWVkLlxuICogQHBhY2thZ2UgSFRUUFxuICogQHJldHVybnMge1Byb21pc2V9XG4gKi9cbmZ1bmN0aW9uIFBBVENIKCkge1xuICAgIHJldHVybiBfLnBhcnRpYWwoSFRUUF9NRVRIT0QsIHRydWUsICdQQVRDSCcpLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG59XG5cblxudmFyIGh0dHAgPSB7XG4gICAgUmVxdWVzdERlc2NyaXB0b3I6IHJlcXVpcmUoJy4vcmVxdWVzdERlc2NyaXB0b3InKS5SZXF1ZXN0RGVzY3JpcHRvcixcbiAgICBSZXNwb25zZURlc2NyaXB0b3I6IHJlcXVpcmUoJy4vcmVzcG9uc2VEZXNjcmlwdG9yJykuUmVzcG9uc2VEZXNjcmlwdG9yLFxuICAgIERlc2NyaXB0b3I6IGRlc2NyaXB0b3IuRGVzY3JpcHRvcixcbiAgICBfcmVzb2x2ZU1ldGhvZDogZGVzY3JpcHRvci5yZXNvbHZlTWV0aG9kLFxuICAgIFNlcmlhbGlzZXI6IHJlcXVpcmUoJy4vc2VyaWFsaXNlcicpLFxuICAgIERlc2NyaXB0b3JSZWdpc3RyeTogcmVxdWlyZSgnLi9kZXNjcmlwdG9yUmVnaXN0cnknKS5EZXNjcmlwdG9yUmVnaXN0cnksXG4gICAgX2h0dHBSZXNwb25zZTogX2h0dHBSZXNwb25zZSxcbiAgICBfaHR0cFJlcXVlc3Q6IF9odHRwUmVxdWVzdCxcbiAgICBERUxFVEU6IERFTEVURSxcbiAgICBIVFRQX01FVEhPRDogSFRUUF9NRVRIT0QsXG4gICAgR0VUOiBHRVQsXG4gICAgVFJBQ0U6IFRSQUNFLFxuICAgIE9QVElPTlM6IE9QVElPTlMsXG4gICAgSEVBRDogSEVBRCxcbiAgICBQT1NUOiBQT1NULFxuICAgIFBVVDogUFVULFxuICAgIFBBVENIOiBQQVRDSCxcbiAgICBfc2VyaWFsaXNlT2JqZWN0OiBfc2VyaWFsaXNlT2JqZWN0LFxuICAgIFBhZ2luYXRvcjogcmVxdWlyZSgnLi9wYWdpbmF0b3InKVxufTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGh0dHAsICdhamF4Jywge1xuICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgYSA9IGFqYXggfHwgKCQgPyAkLmFqYXggOiBudWxsKSB8fCAoalF1ZXJ5ID8galF1ZXJ5LmFqYXggOiBudWxsKTtcbiAgICAgICAgaWYgKCFhKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignYWpheCBoYXMgbm90IGJlZW4gZGVmaW5lZCBhbmQgY291bGQgbm90IGZpbmQgJC5hamF4IG9yIGpRdWVyeS5hamF4Jyk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGE7XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uICh2KSB7XG4gICAgICAgIGFqYXggPSB2O1xuICAgIH1cbn0pO1xuXG5fLmV4dGVuZChDb2xsZWN0aW9uLnByb3RvdHlwZSwge1xuICAgIERFTEVURTogREVMRVRFLFxuICAgIEdFVDogR0VULFxuICAgIFRSQUNFOiBUUkFDRSxcbiAgICBPUFRJT05TOiBPUFRJT05TLFxuICAgIEhFQUQ6IEhFQUQsXG4gICAgUE9TVDogUE9TVCxcbiAgICBQVVQ6IFBVVCxcbiAgICBQQVRDSDogUEFUQ0hcbn0pO1xuXG5pZiAoIXNpZXN0YS5leHQpIHNpZXN0YS5leHQgPSB7fTtcbnNpZXN0YS5leHQuaHR0cCA9IGh0dHA7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKHNpZXN0YS5leHQsIHtcbiAgICBodHRwRW5hYmxlZDoge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGlmIChzaWVzdGEuZXh0Ll9odHRwRW5hYmxlZCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHNpZXN0YS5leHQuX2h0dHBFbmFibGVkO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuICEhc2llc3RhLmV4dC5odHRwO1xuICAgICAgICB9LFxuICAgICAgICBzZXQ6IGZ1bmN0aW9uICh2KSB7XG4gICAgICAgICAgICBzaWVzdGEuZXh0Ll9odHRwRW5hYmxlZCA9IHY7XG4gICAgICAgIH0sXG4gICAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICB9XG59KTtcblxudmFyIGFqYXgsIHNlcmlhbGlzZXJzID0ge307XG5cbl8uZXh0ZW5kKHNpZXN0YSwge1xuICAgIHNldEFqYXg6IGZ1bmN0aW9uIChfYWpheCkge1xuICAgICAgICBhamF4ID0gX2FqYXg7XG4gICAgfSxcbiAgICBnZXRBamF4OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiBzaWVzdGEuZXh0Lmh0dHAuYWpheDtcbiAgICB9LFxuICAgIHNlcmlhbGlzZXJzOiBzZXJpYWxpc2VycyxcbiAgICBzZXJpYWxpemVyczogc2VyaWFsaXNlcnNcbn0pO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydGllcyhzZXJpYWxpc2Vycywge1xuICAgIGlkOiB7XG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coc2llc3RhLmV4dC5odHRwRW5hYmxlZCk7XG4gICAgICAgICAgICBpZiAoc2llc3RhLmV4dC5odHRwRW5hYmxlZCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBzaWVzdGEuZXh0Lmh0dHAuU2VyaWFsaXNlci5pZFNlcmlhbGlzZXI7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgZGVwdGg6IHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBpZiAoc2llc3RhLmV4dC5odHRwRW5hYmxlZCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBzaWVzdGEuZXh0Lmh0dHAuU2VyaWFsaXNlci5kZXB0aFNlcmlhbGl6ZXI7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cbn0pO1xuXG5pZiAodHlwZW9mIG1vZHVsZSAhPSAndW5kZWZpbmVkJykgbW9kdWxlLmV4cG9ydHMgPSBodHRwO1xuIiwidmFyIF9pbnRlcm5hbCA9IHNpZXN0YS5faW50ZXJuYWwsXG4gICAgbG9nID0gX2ludGVybmFsLmxvZyxcbiAgICBJbnRlcm5hbFNpZXN0YUVycm9yID0gX2ludGVybmFsLmVycm9yLkludGVybmFsU2llc3RhRXJyb3IsXG4gICAgdXRpbCA9IF9pbnRlcm5hbC51dGlsLFxuICAgIF8gPSB1dGlsLl87XG5cbnZhciBxdWVyeXN0cmluZyA9IHJlcXVpcmUoJ3F1ZXJ5c3RyaW5nJyk7XG5cbmZ1bmN0aW9uIFBhZ2luYXRvcihvcHRzKSB7XG4gICAgdGhpcy5vcHRzID0ge307XG4gICAgdXRpbC5leHRlbmRGcm9tT3B0cyh0aGlzLm9wdHMsIG9wdHMsIHtcbiAgICAgICAgcGF0aDogJy8nLFxuICAgICAgICBtb2RlbDogbnVsbCxcbiAgICAgICAgcGFnZTogJ3BhZ2UnLFxuICAgICAgICBxdWVyeVBhcmFtczogdHJ1ZSxcbiAgICAgICAgcGFnZVNpemU6ICdwYWdlU2l6ZScsXG4gICAgICAgIG51bVBhZ2VzOiAnbnVtUGFnZXMnLFxuICAgICAgICBkYXRhUGF0aDogJ2RhdGEnLFxuICAgICAgICBjb3VudDogJ2NvdW50JyxcbiAgICAgICAgdHlwZTogJ0dFVCcsXG4gICAgICAgIGRhdGFUeXBlOiAnanNvbidcbiAgICB9LCBmYWxzZSk7XG4gICAgXy5leHRlbmQodGhpcywge1xuICAgICAgICBudW1QYWdlczogbnVsbCxcbiAgICAgICAgY291bnQ6IG51bGxcbiAgICB9KTtcblxuICAgIHRoaXMudmFsaWRhdGUoKTtcbn1cblxuXy5leHRlbmQoUGFnaW5hdG9yLnByb3RvdHlwZSwge1xuICAgIF9leHRyYWN0OiBmdW5jdGlvbiAocGF0aCwgZGF0YSwganFYSFIpIHtcbiAgICAgICAgaWYgKHBhdGgpIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgcGF0aCA9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICAgICAgZGF0YSA9IHBhdGgoZGF0YSwganFYSFIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgdmFyIHNwbHQgPSBwYXRoLnNwbGl0KCcuJyk7XG4gICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzcGx0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBrZXkgPSBzcGx0W2ldO1xuICAgICAgICAgICAgICAgICAgICBkYXRhID0gZGF0YVtrZXldO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZGF0YTtcbiAgICB9LFxuICAgIF9leHRyYWN0RGF0YTogZnVuY3Rpb24gKGRhdGEsIGpxWEhSKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9leHRyYWN0KHRoaXMub3B0cy5kYXRhUGF0aCwgZGF0YSwganFYSFIpO1xuICAgIH0sXG4gICAgX2V4dHJhY3ROdW1QYWdlczogZnVuY3Rpb24gKGRhdGEsIGpxWEhSKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9leHRyYWN0KHRoaXMub3B0cy5udW1QYWdlcywgZGF0YSwganFYSFIpO1xuICAgIH0sXG4gICAgX2V4dHJhY3RDb3VudDogZnVuY3Rpb24gKGRhdGEsIGpxWEhSKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9leHRyYWN0KHRoaXMub3B0cy5jb3VudCwgZGF0YSwganFYSFIpO1xuICAgIH0sXG4gICAgLyoqXG4gICAgICogdmFyIHBhcnNlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2EnKTtcbiAgICAgKiBwYXJzZXIuaHJlZiA9IFwiaHR0cDovL2V4YW1wbGUuY29tOjMwMDAvcGF0aG5hbWUvP3NlYXJjaD10ZXN0I2hhc2hcIjtcbiAgICAgKiBwYXJzZXIuaHJlZiA9IFVSTDtcbiAgICAgKiBwYXJzZXIucHJvdG9jb2w7IC8vID0+IFwiaHR0cDpcIlxuICAgICAqIHBhcnNlci5ob3N0bmFtZTsgLy8gPT4gXCJleGFtcGxlLmNvbVwiXG4gICAgICogcGFyc2VyLnBvcnQ7ICAgICAvLyA9PiBcIjMwMDBcIlxuICAgICAqIHBhcnNlci5wYXRobmFtZTsgLy8gPT4gXCIvcGF0aG5hbWUvXCJcbiAgICAgKiBwYXJzZXIuc2VhcmNoOyAgIC8vID0+IFwiP3NlYXJjaD10ZXN0XCJcbiAgICAgKiBwYXJzZXIuaGFzaDsgICAgIC8vID0+IFwiI2hhc2hcIlxuICAgICAqIHBhcnNlci5ob3N0OyAgICAgLy8gPT4gXCJleGFtcGxlLmNvbTozMDAwXCJcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gVVJMXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfcGFyc2VVUkw6IGZ1bmN0aW9uIChVUkwpIHtcbiAgICAgICAgdmFyIHBhcnNlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2EnKTtcbiAgICAgICAgcGFyc2VyLmhyZWYgPSBVUkw7XG4gICAgICAgIHJldHVybiBwYXJzZXI7XG4gICAgfSxcbiAgICBwYWdlOiBmdW5jdGlvbiAob3B0c09yQ2FsbGJhY2ssIGNhbGxiYWNrKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgdmFyIG9wdHMgPSB7fTtcbiAgICAgICAgaWYgKHR5cGVvZiBvcHRzT3JDYWxsYmFjayA9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICBjYWxsYmFjayA9IG9wdHNPckNhbGxiYWNrO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKG9wdHNPckNhbGxiYWNrKSB7XG4gICAgICAgICAgICBvcHRzID0gb3B0c09yQ2FsbGJhY2s7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIGRlZmVycmVkID0gdXRpbC5kZWZlcihjYWxsYmFjayk7XG4gICAgICAgIHZhciBwYWdlID0gb3B0cy5wYWdlLFxuICAgICAgICAgICAgcGFnZVNpemUgPSBvcHRzLnBhZ2VTaXplO1xuICAgICAgICBjYWxsYmFjayA9IGRlZmVycmVkLmZpbmlzaC5iaW5kKGRlZmVycmVkKTtcbiAgICAgICAgdmFyIGFqYXggPSBzaWVzdGEuZXh0Lmh0dHAuYWpheCxcbiAgICAgICAgICAgIGFqYXhPcHRzID0gXy5leHRlbmQoe30sIHRoaXMub3B0cyk7XG4gICAgICAgIHZhciBjb2xsZWN0aW9uID0gdGhpcy5vcHRzLm1vZGVsLmNvbGxlY3Rpb24sXG4gICAgICAgICAgICB1cmwgPSBjb2xsZWN0aW9uLmJhc2VVUkwgKyB0aGlzLm9wdHMucGF0aDtcbiAgICAgICAgaWYgKHRoaXMub3B0cy5xdWVyeVBhcmFtcykge1xuICAgICAgICAgICAgdmFyIHBhcnNlciA9IHRoaXMuX3BhcnNlVVJMKHVybCk7XG4gICAgICAgICAgICB2YXIgcmF3UXVlcnkgPSBwYXJzZXIuc2VhcmNoLFxuICAgICAgICAgICAgICAgIHJhd1F1ZXJ5U3BsdCA9IHJhd1F1ZXJ5LnNwbGl0KCc/Jyk7XG4gICAgICAgICAgICBpZiAocmF3UXVlcnlTcGx0Lmxlbmd0aCA+IDEpIHJhd1F1ZXJ5ID0gcmF3UXVlcnlTcGx0WzFdO1xuICAgICAgICAgICAgdmFyIHF1ZXJ5ID0gcXVlcnlzdHJpbmcucGFyc2UocmF3UXVlcnkpO1xuICAgICAgICAgICAgaWYgKHBhZ2UpIHtcbiAgICAgICAgICAgICAgICBxdWVyeVt0aGlzLm9wdHMucGFnZV0gPSBwYWdlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHBhZ2VTaXplKSB7XG4gICAgICAgICAgICAgICAgcXVlcnlbdGhpcy5vcHRzLnBhZ2VTaXplXSA9IHBhZ2VTaXplO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKE9iamVjdC5rZXlzKHF1ZXJ5KS5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICBwYXJzZXIuc2VhcmNoID0gJz8nICsgcXVlcnlzdHJpbmcuc3RyaW5naWZ5KHF1ZXJ5KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHVybCA9IHBhcnNlci5ocmVmO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdmFyIGRhdGEgPSB7fTtcbiAgICAgICAgICAgIGlmIChwYWdlKSB7XG4gICAgICAgICAgICAgICAgZGF0YVt0aGlzLm9wdHMucGFnZV0gPSBwYWdlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHBhZ2VTaXplKSB7XG4gICAgICAgICAgICAgICAgZGF0YVt0aGlzLm9wdHMucGFnZVNpemVdID0gcGFnZVNpemU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBhamF4T3B0cy5kYXRhID0gZGF0YVxuICAgICAgICB9XG4gICAgICAgIF8uZXh0ZW5kKGFqYXhPcHRzLCB7XG4gICAgICAgICAgICB1cmw6IHVybCxcbiAgICAgICAgICAgIHN1Y2Nlc3M6IGZ1bmN0aW9uIChkYXRhLCB0ZXh0U3RhdHVzLCBqcVhIUikge1xuICAgICAgICAgICAgICAgIHZhciBtb2RlbERhdGEgPSBzZWxmLl9leHRyYWN0RGF0YShkYXRhLCBqcVhIUiksXG4gICAgICAgICAgICAgICAgICAgIGNvdW50ID0gc2VsZi5fZXh0cmFjdENvdW50KGRhdGEsIGpxWEhSKSxcbiAgICAgICAgICAgICAgICAgICAgbnVtUGFnZXMgPSBzZWxmLl9leHRyYWN0TnVtUGFnZXMoZGF0YSwganFYSFIpO1xuXG4gICAgICAgICAgICAgICAgc2VsZi5vcHRzLm1vZGVsLm1hcChtb2RlbERhdGEsIGZ1bmN0aW9uIChlcnIsIG1vZGVsSW5zdGFuY2VzKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzZWxmLmNvdW50ID0gY291bnQ7XG4gICAgICAgICAgICAgICAgICAgICAgICBzZWxmLm51bVBhZ2VzID0gbnVtUGFnZXM7XG4gICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhudWxsLCBtb2RlbEluc3RhbmNlcywge2RhdGE6IGRhdGEsIHRleHRTdGF0dXM6IHRleHRTdGF0dXMsIGpxWEhSOiBqcVhIUn0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGZhaWw6IGNhbGxiYWNrXG4gICAgICAgIH0pO1xuICAgICAgICBhamF4KGFqYXhPcHRzKTtcbiAgICAgICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG4gICAgfSxcbiAgICB2YWxpZGF0ZTogZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAoIXRoaXMub3B0cy5tb2RlbCkgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ1BhZ2luYXRvciBtdXN0IGhhdmUgYSBtb2RlbCcpO1xuICAgIH1cbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFBhZ2luYXRvcjsiLCIvKipcbiAqIEBtb2R1bGUgaHR0cFxuICovXG5cbnZhciBEZXNjcmlwdG9yID0gcmVxdWlyZSgnLi9kZXNjcmlwdG9yJykuRGVzY3JpcHRvcixcbiAgICBTZXJpYWxpc2VyID0gcmVxdWlyZSgnLi9zZXJpYWxpc2VyJyk7XG5cbnZhciBfaW50ZXJuYWwgPSBzaWVzdGEuX2ludGVybmFsLFxuICAgIHV0aWwgPSBfaW50ZXJuYWwudXRpbCxcbiAgICBfID0gdXRpbC5fLFxuICAgIGxvZyA9IF9pbnRlcm5hbC5sb2csXG4gICAgZGVmaW5lU3ViUHJvcGVydHkgPSB1dGlsLmRlZmluZVN1YlByb3BlcnR5XG4gICAgO1xuXG52YXIgTG9nZ2VyID0gbG9nLmxvZ2dlcldpdGhOYW1lKCdEZXNjcmlwdG9yJyk7XG5cbi8qKlxuICogQGNsYXNzIERlc2NyaWJlcyBhIEhUVFAgcmVxdWVzdFxuICogQHBhcmFtIHtPYmplY3R9IG9wdHNcbiAqL1xuZnVuY3Rpb24gUmVxdWVzdERlc2NyaXB0b3Iob3B0cykge1xuICAgIGlmICghdGhpcykge1xuICAgICAgICByZXR1cm4gbmV3IFJlcXVlc3REZXNjcmlwdG9yKG9wdHMpO1xuICAgIH1cblxuICAgIERlc2NyaXB0b3IuY2FsbCh0aGlzLCBvcHRzKTtcbiAgICBpZiAodGhpcy5fb3B0c1snc2VyaWFsaXplciddKSB7XG4gICAgICAgIHRoaXMuX29wdHMuc2VyaWFsaXNlciA9IHRoaXMuX29wdHNbJ3NlcmlhbGl6ZXInXTtcbiAgICB9XG5cbiAgICBpZiAoIXRoaXMuX29wdHMuc2VyaWFsaXNlcikge1xuICAgICAgICB0aGlzLl9vcHRzLnNlcmlhbGlzZXIgPSBTZXJpYWxpc2VyLmRlcHRoU2VyaWFsaXplcigwKTtcbiAgICB9XG5cblxuICAgIGRlZmluZVN1YlByb3BlcnR5LmNhbGwodGhpcywgJ3NlcmlhbGlzZXInLCB0aGlzLl9vcHRzKTtcbiAgICBkZWZpbmVTdWJQcm9wZXJ0eS5jYWxsKHRoaXMsICdzZXJpYWxpemVyJywgdGhpcy5fb3B0cywgJ3NlcmlhbGlzZXInKTtcblxufVxuXG5SZXF1ZXN0RGVzY3JpcHRvci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKERlc2NyaXB0b3IucHJvdG90eXBlKTtcblxuXy5leHRlbmQoUmVxdWVzdERlc2NyaXB0b3IucHJvdG90eXBlLCB7XG4gICAgX3NlcmlhbGlzZTogZnVuY3Rpb24gKG9iaiwgY2FsbGJhY2spIHtcbiAgICAgICAgdmFyIGRlZmVycmVkID0gdXRpbC5kZWZlcihjYWxsYmFjayk7XG4gICAgICAgIGNhbGxiYWNrID0gZGVmZXJyZWQuZmluaXNoLmJpbmQoZGVmZXJyZWQpO1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKVxuICAgICAgICAgICAgTG9nZ2VyLnRyYWNlKCdfc2VyaWFsaXNlJyk7XG4gICAgICAgIHZhciBmaW5pc2hlZDtcbiAgICAgICAgdmFyIGRhdGEgPSB0aGlzLnNlcmlhbGlzZXIob2JqLCBmdW5jdGlvbiAoZXJyLCBkYXRhKSB7XG4gICAgICAgICAgICBpZiAoIWZpbmlzaGVkKSB7XG4gICAgICAgICAgICAgICAgZGF0YSA9IHNlbGYuX3RyYW5zZm9ybURhdGEoZGF0YSk7XG4gICAgICAgICAgICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhlcnIsIHNlbGYuX2VtYmVkRGF0YShkYXRhKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICBpZiAoZGF0YSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBpZiAoTG9nZ2VyLnRyYWNlLmlzRW5hYmxlZClcbiAgICAgICAgICAgICAgICBMb2dnZXIudHJhY2UoJ3NlcmlhbGlzZXIgZG9lc250IHVzZSBhIGNhbGxiYWNrJyk7XG4gICAgICAgICAgICBmaW5pc2hlZCA9IHRydWU7XG4gICAgICAgICAgICBkYXRhID0gc2VsZi5fdHJhbnNmb3JtRGF0YShkYXRhKTtcbiAgICAgICAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2sobnVsbCwgc2VsZi5fZW1iZWREYXRhKGRhdGEpKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKVxuICAgICAgICAgICAgICAgIExvZ2dlci50cmFjZSgnc2VyaWFsaXNlciB1c2VzIGEgY2FsbGJhY2snLCB0aGlzLnNlcmlhbGlzZXIpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xuICAgIH0sXG4gICAgX2R1bXA6IGZ1bmN0aW9uIChhc0pzb24pIHtcbiAgICAgICAgdmFyIG9iaiA9IHt9O1xuICAgICAgICBvYmoubWV0aG9kcyA9IHRoaXMubWV0aG9kO1xuICAgICAgICBvYmoubW9kZWwgPSB0aGlzLm1vZGVsLm5hbWU7XG4gICAgICAgIG9iai5wYXRoID0gdGhpcy5fcmF3T3B0cy5wYXRoO1xuICAgICAgICB2YXIgc2VyaWFsaXNlcjtcbiAgICAgICAgaWYgKHR5cGVvZih0aGlzLl9yYXdPcHRzLnNlcmlhbGlzZXIpID09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIHNlcmlhbGlzZXIgPSAnZnVuY3Rpb24gKCkgeyAuLi4gfSdcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHNlcmlhbGlzZXIgPSB0aGlzLl9yYXdPcHRzLnNlcmlhbGlzZXI7XG4gICAgICAgIH1cbiAgICAgICAgb2JqLnNlcmlhbGlzZXIgPSBzZXJpYWxpc2VyO1xuICAgICAgICB2YXIgdHJhbnNmb3JtcyA9IHt9O1xuICAgICAgICBmb3IgKHZhciBmIGluIHRoaXMudHJhbnNmb3Jtcykge1xuICAgICAgICAgICAgaWYgKHRoaXMudHJhbnNmb3Jtcy5oYXNPd25Qcm9wZXJ0eShmKSkge1xuICAgICAgICAgICAgICAgIHZhciB0cmFuc2Zvcm0gPSB0aGlzLnRyYW5zZm9ybXNbZl07XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZih0cmFuc2Zvcm0pID09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgICAgICAgICAgdHJhbnNmb3Jtc1tmXSA9ICdmdW5jdGlvbiAoKSB7IC4uLiB9J1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdHJhbnNmb3Jtc1tmXSA9IHRoaXMudHJhbnNmb3Jtc1tmXTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgb2JqLnRyYW5zZm9ybXMgPSB0cmFuc2Zvcm1zO1xuICAgICAgICByZXR1cm4gYXNKc29uID8gdXRpbC5wcmV0dHlQcmludChvYmopIDogb2JqO1xuICAgIH1cbn0pO1xuXG5leHBvcnRzLlJlcXVlc3REZXNjcmlwdG9yID0gUmVxdWVzdERlc2NyaXB0b3I7XG4iLCIvKipcbiAqIEBtb2R1bGUgaHR0cFxuICovXG5cblxudmFyIERlc2NyaXB0b3IgPSByZXF1aXJlKCcuL2Rlc2NyaXB0b3InKS5EZXNjcmlwdG9yO1xuXG4vKipcbiAqIERlc2NyaWJlcyB3aGF0IHRvIGRvIHdpdGggYSBIVFRQIHJlc3BvbnNlLlxuICogQGNvbnN0cnVjdG9yXG4gKiBAaW1wbGVtZW50cyB7RGVzY3JpcHRvcn1cbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRzXG4gKi9cbmZ1bmN0aW9uIFJlc3BvbnNlRGVzY3JpcHRvcihvcHRzKSB7XG4gICAgaWYgKCF0aGlzKSB7XG4gICAgICAgIHJldHVybiBuZXcgUmVzcG9uc2VEZXNjcmlwdG9yKG9wdHMpO1xuICAgIH1cbiAgICBEZXNjcmlwdG9yLmNhbGwodGhpcywgb3B0cyk7XG59XG5cblJlc3BvbnNlRGVzY3JpcHRvci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKERlc2NyaXB0b3IucHJvdG90eXBlKTtcblxuXy5leHRlbmQoUmVzcG9uc2VEZXNjcmlwdG9yLnByb3RvdHlwZSwge1xuICAgIF9leHRyYWN0RGF0YTogZnVuY3Rpb24gKGRhdGEpIHtcbiAgICAgICAgdmFyIGV4dHJhY3RlZERhdGEgPSBEZXNjcmlwdG9yLnByb3RvdHlwZS5fZXh0cmFjdERhdGEuY2FsbCh0aGlzLCBkYXRhKTtcbiAgICAgICAgaWYgKGV4dHJhY3RlZERhdGEpIHtcbiAgICAgICAgICAgIGV4dHJhY3RlZERhdGEgPSB0aGlzLl90cmFuc2Zvcm1EYXRhKGV4dHJhY3RlZERhdGEpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBleHRyYWN0ZWREYXRhO1xuICAgIH0sXG4gICAgX21hdGNoRGF0YTogZnVuY3Rpb24gKGRhdGEpIHtcbiAgICAgICAgdmFyIGV4dHJhY3RlZERhdGEgPSBEZXNjcmlwdG9yLnByb3RvdHlwZS5fbWF0Y2hEYXRhLmNhbGwodGhpcywgZGF0YSk7XG4gICAgICAgIGlmIChleHRyYWN0ZWREYXRhKSB7XG4gICAgICAgICAgICBleHRyYWN0ZWREYXRhID0gdGhpcy5fdHJhbnNmb3JtRGF0YShleHRyYWN0ZWREYXRhKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZXh0cmFjdGVkRGF0YTtcbiAgICB9LFxuICAgIF9kdW1wOiBmdW5jdGlvbiAoYXNKc29uKSB7XG4gICAgICAgIHZhciBvYmogPSB7fTtcbiAgICAgICAgb2JqLm1ldGhvZHMgPSB0aGlzLm1ldGhvZDtcbiAgICAgICAgb2JqLm1vZGVsID0gdGhpcy5tb2RlbC5uYW1lO1xuICAgICAgICBvYmoucGF0aCA9IHRoaXMuX3Jhd09wdHMucGF0aDtcbiAgICAgICAgdmFyIHRyYW5zZm9ybXMgPSB7fTtcbiAgICAgICAgZm9yICh2YXIgZiBpbiB0aGlzLnRyYW5zZm9ybXMpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLnRyYW5zZm9ybXMuaGFzT3duUHJvcGVydHkoZikpIHtcbiAgICAgICAgICAgICAgICB2YXIgdHJhbnNmb3JtID0gdGhpcy50cmFuc2Zvcm1zW2ZdO1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YodHJhbnNmb3JtKSA9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICAgICAgICAgIHRyYW5zZm9ybXNbZl0gPSAnZnVuY3Rpb24gKCkgeyAuLi4gfSdcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRyYW5zZm9ybXNbZl0gPSB0aGlzLnRyYW5zZm9ybXNbZl07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIG9iai50cmFuc2Zvcm1zID0gdHJhbnNmb3JtcztcbiAgICAgICAgcmV0dXJuIGFzSnNvbiA/IHV0aWwucHJldHR5UHJpbnQob2JqKSA6IG9iajtcbiAgICB9XG59KTtcblxuZXhwb3J0cy5SZXNwb25zZURlc2NyaXB0b3IgPSBSZXNwb25zZURlc2NyaXB0b3I7IiwiLyoqXG4gKiBAbW9kdWxlIGh0dHBcbiAqL1xuXG52YXIgX2ludGVybmFsID0gc2llc3RhLl9pbnRlcm5hbDtcblxudmFyIGxvZyA9IF9pbnRlcm5hbC5sb2csXG4gICAgdXRpbHMgPSBfaW50ZXJuYWwudXRpbDtcbnZhciBMb2dnZXIgPSBsb2cubG9nZ2VyV2l0aE5hbWUoJ1NlcmlhbGlzYXRpb24nKTtcbnZhciBfID0gdXRpbHMuXztcblxuXG4vKipcbiAqIFNlcmlhbGlzZXMgYW4gb2JqZWN0IGludG8gaXQncyByZW1vdGUgaWRlbnRpZmllciAoYXMgZGVmaW5lZCBieSB0aGUgbWFwcGluZylcbiAqIEBwYXJhbSAge01vZGVsSW5zdGFuY2V9IG9ialxuICogQHJldHVybiB7U3RyaW5nfVxuICpcbiAqL1xuZnVuY3Rpb24gaWRTZXJpYWxpc2VyKG9iaikge1xuICAgIHZhciBpZEZpZWxkID0gb2JqLm1vZGVsLmlkO1xuICAgIGlmIChpZEZpZWxkKSB7XG4gICAgICAgIHJldHVybiBvYmpbaWRGaWVsZF0gPyBvYmpbaWRGaWVsZF0gOiBudWxsO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgaWYgKExvZ2dlci5kZWJ1Zy5pc0VuYWJsZWQpXG4gICAgICAgICAgICBMb2dnZXIuZGVidWcoJ05vIGlkZmllbGQnKTtcbiAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG59XG5cbi8qKlxuICogU2VyaWFsaXNlcyBvYmogZm9sbG93aW5nIHJlbGF0aW9uc2hpcHMgdG8gc3BlY2lmaWVkIGRlcHRoLlxuICogQHBhcmFtICB7SW50ZWdlcn0gICBkZXB0aFxuICogQHBhcmFtICB7TW9kZWxJbnN0YW5jZX0gICBvYmpcbiAqIEBwYXJhbSAge0Z1bmN0aW9ufSBjYWxsYmFja1xuICovXG5mdW5jdGlvbiBkZXB0aFNlcmlhbGlzZXIoZGVwdGgsIG9iaiwgY2FsbGJhY2spIHtcbiAgICBjYWxsYmFjayA9IGNhbGxiYWNrIHx8IGZ1bmN0aW9uICgpIHt9O1xuICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKVxuICAgICAgICBMb2dnZXIudHJhY2UoJ2RlcHRoU2VyaWFsaXNlcicpO1xuICAgIHZhciBkYXRhID0ge307XG4gICAgXy5lYWNoKG9iai5fYXR0cmlidXRlTmFtZXMsIGZ1bmN0aW9uIChmKSB7XG4gICAgICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKVxuICAgICAgICAgICAgTG9nZ2VyLnRyYWNlKCdmaWVsZCcsIGYpO1xuICAgICAgICBpZiAob2JqW2ZdKSB7XG4gICAgICAgICAgICBkYXRhW2ZdID0gb2JqW2ZdO1xuICAgICAgICB9XG4gICAgfSk7XG4gICAgdmFyIHdhaXRpbmcgPSBbXSxcbiAgICAgICAgZXJyb3JzID0gW10sXG4gICAgICAgIHJlc3VsdCA9IHt9LFxuICAgICAgICBmaW5pc2hlZCA9IFtdO1xuICAgIF8uZWFjaChvYmouX3JlbGF0aW9uc2hpcE5hbWVzLCBmdW5jdGlvbiAoZikge1xuICAgICAgICBpZiAoTG9nZ2VyLnRyYWNlLmlzRW5hYmxlZClcbiAgICAgICAgICAgIExvZ2dlci50cmFjZSgncmVsYXRpb25zaGlwRmllbGQnLCBmKTtcbiAgICAgICAgdmFyIHByb3h5ID0gb2JqLl9fcHJveGllc1tmXTtcbiAgICAgICAgaWYgKHByb3h5LmlzRm9yd2FyZCkgeyAvLyBCeSBkZWZhdWx0IG9ubHkgZm9yd2FyZCByZWxhdGlvbnNoaXBzXG4gICAgICAgICAgICBpZiAoTG9nZ2VyLmRlYnVnLmlzRW5hYmxlZClcbiAgICAgICAgICAgICAgICBMb2dnZXIuZGVidWcoZik7XG4gICAgICAgICAgICB3YWl0aW5nLnB1c2goZik7XG4gICAgICAgICAgICBwcm94eS5nZXQoZnVuY3Rpb24gKGVyciwgdikge1xuICAgICAgICAgICAgICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKVxuICAgICAgICAgICAgICAgICAgICBMb2dnZXIudHJhY2UoJ3Byb3h5LmdldCcsIGYpO1xuICAgICAgICAgICAgICAgIGlmIChMb2dnZXIuZGVidWcuaXNFbmFibGVkKVxuICAgICAgICAgICAgICAgICAgICBMb2dnZXIuZGVidWcoZiwgdik7XG4gICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICBlcnJvcnMucHVzaChlcnIpO1xuICAgICAgICAgICAgICAgICAgICBmaW5pc2hlZC5wdXNoKGYpO1xuICAgICAgICAgICAgICAgICAgICByZXN1bHRbZl0gPSB7ZXJyOiBlcnIsIHY6IHZ9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIGlmICh2KSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghZGVwdGgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZpbmlzaGVkLnB1c2goZik7XG4gICAgICAgICAgICAgICAgICAgICAgICBkYXRhW2ZdID0gdltvYmouX19wcm94aWVzW2ZdLmZvcndhcmRNb2RlbC5pZF07XG4gICAgICAgICAgICAgICAgICAgICAgICByZXN1bHRbZl0gPSB7ZXJyOiBlcnIsIHY6IHZ9O1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCh3YWl0aW5nLmxlbmd0aCA9PSBmaW5pc2hlZC5sZW5ndGgpICYmIGNhbGxiYWNrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyb3JzLmxlbmd0aCA/IGVycm9ycyA6IG51bGwsIGRhdGEsIHJlc3VsdCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkZXB0aFNlcmlhbGlzZXIoZGVwdGggLSAxLCB2LCBmdW5jdGlvbiAoZXJyLCBzdWJEYXRhLCByZXNwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlcnJvcnMucHVzaChlcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0YVtmXSA9IHN1YkRhdGE7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZpbmlzaGVkLnB1c2goZik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzdWx0W2ZdID0ge2VycjogZXJyLCB2OiB2LCByZXNwOiByZXNwfTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoKHdhaXRpbmcubGVuZ3RoID09IGZpbmlzaGVkLmxlbmd0aCkgJiYgY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyb3JzLmxlbmd0aCA/IGVycm9ycyA6IG51bGwsIGRhdGEsIHJlc3VsdCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChMb2dnZXIuZGVidWcuaXNFbmFibGVkKVxuICAgICAgICAgICAgICAgICAgICAgICAgTG9nZ2VyLmRlYnVnKCdubyB2YWx1ZSBmb3IgJyArIGYpO1xuICAgICAgICAgICAgICAgICAgICBmaW5pc2hlZC5wdXNoKGYpO1xuICAgICAgICAgICAgICAgICAgICByZXN1bHRbZl0gPSB7ZXJyOiBlcnIsIHY6IHZ9O1xuICAgICAgICAgICAgICAgICAgICBpZiAoKHdhaXRpbmcubGVuZ3RoID09IGZpbmlzaGVkLmxlbmd0aCkgJiYgY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycm9ycy5sZW5ndGggPyBlcnJvcnMgOiBudWxsLCBkYXRhLCByZXN1bHQpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBpZiAoIXdhaXRpbmcubGVuZ3RoKSB7XG4gICAgICAgIGNhbGxiYWNrKG51bGwsIGRhdGEsIHt9KTtcbiAgICB9XG59XG5cblxuZXhwb3J0cy5kZXB0aFNlcmlhbGlzZXIgPSBmdW5jdGlvbiAoZGVwdGgpIHtcbiAgICByZXR1cm4gXy5wYXJ0aWFsKGRlcHRoU2VyaWFsaXNlciwgZGVwdGgpO1xufTtcbmV4cG9ydHMuZGVwdGhTZXJpYWxpemVyID0gZnVuY3Rpb24gKGRlcHRoKSB7XG4gICAgcmV0dXJuIF8ucGFydGlhbChkZXB0aFNlcmlhbGlzZXIsIGRlcHRoKTtcbn07XG5leHBvcnRzLmlkU2VyaWFsaXplciA9IGlkU2VyaWFsaXNlcjtcbmV4cG9ydHMuaWRTZXJpYWxpc2VyID0gaWRTZXJpYWxpc2VyO1xuXG4iLCIvLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxuJ3VzZSBzdHJpY3QnO1xuXG4vLyBJZiBvYmouaGFzT3duUHJvcGVydHkgaGFzIGJlZW4gb3ZlcnJpZGRlbiwgdGhlbiBjYWxsaW5nXG4vLyBvYmouaGFzT3duUHJvcGVydHkocHJvcCkgd2lsbCBicmVhay5cbi8vIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL2pveWVudC9ub2RlL2lzc3Vlcy8xNzA3XG5mdW5jdGlvbiBoYXNPd25Qcm9wZXJ0eShvYmosIHByb3ApIHtcbiAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvYmosIHByb3ApO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHFzLCBzZXAsIGVxLCBvcHRpb25zKSB7XG4gIHNlcCA9IHNlcCB8fCAnJic7XG4gIGVxID0gZXEgfHwgJz0nO1xuICB2YXIgb2JqID0ge307XG5cbiAgaWYgKHR5cGVvZiBxcyAhPT0gJ3N0cmluZycgfHwgcXMubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuXG4gIHZhciByZWdleHAgPSAvXFwrL2c7XG4gIHFzID0gcXMuc3BsaXQoc2VwKTtcblxuICB2YXIgbWF4S2V5cyA9IDEwMDA7XG4gIGlmIChvcHRpb25zICYmIHR5cGVvZiBvcHRpb25zLm1heEtleXMgPT09ICdudW1iZXInKSB7XG4gICAgbWF4S2V5cyA9IG9wdGlvbnMubWF4S2V5cztcbiAgfVxuXG4gIHZhciBsZW4gPSBxcy5sZW5ndGg7XG4gIC8vIG1heEtleXMgPD0gMCBtZWFucyB0aGF0IHdlIHNob3VsZCBub3QgbGltaXQga2V5cyBjb3VudFxuICBpZiAobWF4S2V5cyA+IDAgJiYgbGVuID4gbWF4S2V5cykge1xuICAgIGxlbiA9IG1heEtleXM7XG4gIH1cblxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbjsgKytpKSB7XG4gICAgdmFyIHggPSBxc1tpXS5yZXBsYWNlKHJlZ2V4cCwgJyUyMCcpLFxuICAgICAgICBpZHggPSB4LmluZGV4T2YoZXEpLFxuICAgICAgICBrc3RyLCB2c3RyLCBrLCB2O1xuXG4gICAgaWYgKGlkeCA+PSAwKSB7XG4gICAgICBrc3RyID0geC5zdWJzdHIoMCwgaWR4KTtcbiAgICAgIHZzdHIgPSB4LnN1YnN0cihpZHggKyAxKTtcbiAgICB9IGVsc2Uge1xuICAgICAga3N0ciA9IHg7XG4gICAgICB2c3RyID0gJyc7XG4gICAgfVxuXG4gICAgayA9IGRlY29kZVVSSUNvbXBvbmVudChrc3RyKTtcbiAgICB2ID0gZGVjb2RlVVJJQ29tcG9uZW50KHZzdHIpO1xuXG4gICAgaWYgKCFoYXNPd25Qcm9wZXJ0eShvYmosIGspKSB7XG4gICAgICBvYmpba10gPSB2O1xuICAgIH0gZWxzZSBpZiAoaXNBcnJheShvYmpba10pKSB7XG4gICAgICBvYmpba10ucHVzaCh2KTtcbiAgICB9IGVsc2Uge1xuICAgICAgb2JqW2tdID0gW29ialtrXSwgdl07XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIG9iajtcbn07XG5cbnZhciBpc0FycmF5ID0gQXJyYXkuaXNBcnJheSB8fCBmdW5jdGlvbiAoeHMpIHtcbiAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbCh4cykgPT09ICdbb2JqZWN0IEFycmF5XSc7XG59O1xuIiwiLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGFcbi8vIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGVcbi8vIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZ1xuLy8gd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLFxuLy8gZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdFxuLy8gcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlXG4vLyBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZFxuLy8gaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTU1xuLy8gT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRlxuLy8gTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTlxuLy8gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sXG4vLyBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1Jcbi8vIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEVcbi8vIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG5cbid1c2Ugc3RyaWN0JztcblxudmFyIHN0cmluZ2lmeVByaW1pdGl2ZSA9IGZ1bmN0aW9uKHYpIHtcbiAgc3dpdGNoICh0eXBlb2Ygdikge1xuICAgIGNhc2UgJ3N0cmluZyc6XG4gICAgICByZXR1cm4gdjtcblxuICAgIGNhc2UgJ2Jvb2xlYW4nOlxuICAgICAgcmV0dXJuIHYgPyAndHJ1ZScgOiAnZmFsc2UnO1xuXG4gICAgY2FzZSAnbnVtYmVyJzpcbiAgICAgIHJldHVybiBpc0Zpbml0ZSh2KSA/IHYgOiAnJztcblxuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gJyc7XG4gIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24ob2JqLCBzZXAsIGVxLCBuYW1lKSB7XG4gIHNlcCA9IHNlcCB8fCAnJic7XG4gIGVxID0gZXEgfHwgJz0nO1xuICBpZiAob2JqID09PSBudWxsKSB7XG4gICAgb2JqID0gdW5kZWZpbmVkO1xuICB9XG5cbiAgaWYgKHR5cGVvZiBvYmogPT09ICdvYmplY3QnKSB7XG4gICAgcmV0dXJuIG1hcChvYmplY3RLZXlzKG9iaiksIGZ1bmN0aW9uKGspIHtcbiAgICAgIHZhciBrcyA9IGVuY29kZVVSSUNvbXBvbmVudChzdHJpbmdpZnlQcmltaXRpdmUoaykpICsgZXE7XG4gICAgICBpZiAoaXNBcnJheShvYmpba10pKSB7XG4gICAgICAgIHJldHVybiBtYXAob2JqW2tdLCBmdW5jdGlvbih2KSB7XG4gICAgICAgICAgcmV0dXJuIGtzICsgZW5jb2RlVVJJQ29tcG9uZW50KHN0cmluZ2lmeVByaW1pdGl2ZSh2KSk7XG4gICAgICAgIH0pLmpvaW4oc2VwKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBrcyArIGVuY29kZVVSSUNvbXBvbmVudChzdHJpbmdpZnlQcmltaXRpdmUob2JqW2tdKSk7XG4gICAgICB9XG4gICAgfSkuam9pbihzZXApO1xuXG4gIH1cblxuICBpZiAoIW5hbWUpIHJldHVybiAnJztcbiAgcmV0dXJuIGVuY29kZVVSSUNvbXBvbmVudChzdHJpbmdpZnlQcmltaXRpdmUobmFtZSkpICsgZXEgK1xuICAgICAgICAgZW5jb2RlVVJJQ29tcG9uZW50KHN0cmluZ2lmeVByaW1pdGl2ZShvYmopKTtcbn07XG5cbnZhciBpc0FycmF5ID0gQXJyYXkuaXNBcnJheSB8fCBmdW5jdGlvbiAoeHMpIHtcbiAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbCh4cykgPT09ICdbb2JqZWN0IEFycmF5XSc7XG59O1xuXG5mdW5jdGlvbiBtYXAgKHhzLCBmKSB7XG4gIGlmICh4cy5tYXApIHJldHVybiB4cy5tYXAoZik7XG4gIHZhciByZXMgPSBbXTtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCB4cy5sZW5ndGg7IGkrKykge1xuICAgIHJlcy5wdXNoKGYoeHNbaV0sIGkpKTtcbiAgfVxuICByZXR1cm4gcmVzO1xufVxuXG52YXIgb2JqZWN0S2V5cyA9IE9iamVjdC5rZXlzIHx8IGZ1bmN0aW9uIChvYmopIHtcbiAgdmFyIHJlcyA9IFtdO1xuICBmb3IgKHZhciBrZXkgaW4gb2JqKSB7XG4gICAgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvYmosIGtleSkpIHJlcy5wdXNoKGtleSk7XG4gIH1cbiAgcmV0dXJuIHJlcztcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbmV4cG9ydHMuZGVjb2RlID0gZXhwb3J0cy5wYXJzZSA9IHJlcXVpcmUoJy4vZGVjb2RlJyk7XG5leHBvcnRzLmVuY29kZSA9IGV4cG9ydHMuc3RyaW5naWZ5ID0gcmVxdWlyZSgnLi9lbmNvZGUnKTtcbiJdfQ==
;(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
if (typeof siesta == 'undefined' && typeof module == 'undefined') {
    throw new Error('Could not find window.siesta. Make sure you include siesta.core.js first.');
}


var _i = siesta._internal,
    cache = _i.cache,
    CollectionRegistry = _i.CollectionRegistry,
    log = _i.log,
    util = _i.util,
    _ = util._,
    events = _i.events;

var DB_NAME = 'siesta',
    pouch = new PouchDB(DB_NAME);

var unsavedObjects = [],
    unsavedObjectsHash = {},
    unsavedObjectsByCollection = {};

var storage = {},
    Logger = log.loggerWithName('Storage');

Logger.setLevel(siesta.log.warn);

/**
 * Serialise a model into a format that PouchDB bulkDocs API can process
 * @param {ModelInstance} modelInstance
 */
function _serialise(modelInstance) {
    var serialised = siesta._.extend({}, modelInstance.__values);
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
    // Add blank object with correct _id to the cache so that can map data onto it.
    delete datum.collection;
    delete datum.model;
    var relationshipNames = model._relationshipNames;
    _.each(relationshipNames, function (r) {
        var _id = datum[r];
        if (siesta.isArray(_id)) {
            datum[r] = _.map(_id, function (x) { return {_id: x}});
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
    if (Logger.trace) {
        var fullyQualifiedName = collectionName + '.' + modelName;
        Logger.trace('Loading instances for ' + fullyQualifiedName);
    }
    var Model = CollectionRegistry[collectionName][modelName];
    var mapFunc = function (doc) {
        if (doc.model == '$1' && doc.collection == '$2') {
            //noinspection JSUnresolvedFunction
            emit(doc._id, doc);
        }
    }.toString().replace('$1', modelName).replace('$2', collectionName);
    if (Logger.trace.isEnabled) Logger.trace('Querying pouch');
    pouch.query({map: mapFunc})
        .then(function (resp) {
            if (Logger.trace.isEnabled) Logger.trace('Queried pouch succesffully');
            var data = siesta._.map(siesta._.pluck(resp.rows, 'value'), function (datum) {
                return _prepareDatum(datum, Model);
            });
            if (Logger.trace.isEnabled) Logger.trace('Mapping data', data);
            Model.map(data, {disableevents: true, _ignoreInstalled: true}, function (err, instances) {
                if (!err) {
                    if (Logger.trace)
                        Logger.trace('Loaded ' + instances.length.toString() + ' instances for ' + fullyQualifiedName);
                }
                else {
                    Logger.error('Error loading models', err);
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
function _load(callback) {
    var deferred = util.defer(callback);
    var collectionNames = CollectionRegistry.collectionNames;
    var tasks = [];
    _.each(collectionNames, function (collectionName) {
        var collection = CollectionRegistry[collectionName],
            modelNames = Object.keys(collection._models);
        _.each(modelNames, function (modelName) {
            tasks.push(function (cb) {
                _loadModel({
                    collectionName: collectionName,
                    modelName: modelName
                }, cb);
            });
        });
    });
    siesta.async.parallel(tasks, function (err, results) {
        if (!err) {
            var instances = [];
            siesta._.each(results, function (r) {instances.concat(r)});
            if (Logger.trace) Logger.trace('Loaded ' + instances.length.toString() + ' instances');
        }
        deferred.finish(err);
    });
    return deferred.promise;
}

function saveConflicts(objects, callback, deferred) {
    pouch.allDocs({keys: _.pluck(objects, '_id')})
        .then(function (resp) {
            for (var i = 0; i < resp.rows.length; i++) {
                objects[i]._rev = resp.rows[i].value.rev;
            }
            saveToPouch(objects, callback, deferred);
        })
        .catch(function (err) {
            deferred.reject(err);
        })
}

function saveToPouch(objects, callback, deferred) {
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
                Logger.error('Error saving object with _id="' + obj._id + '"', response);
            }
        }
        if (conflicts.length) {
            saveConflicts(conflicts, callback, deferred);
        }
        else {
            callback();
            if (deferred) deferred.resolve();
        }
    }, function (err) {
        callback(err);
        if (deferred) deferred.reject(err);
    });
}
/**
 * Save all modelEvents down to PouchDB.
 */
function save(callback) {
    var deferred = util.defer(callback);
    siesta._afterInstall(function () {
        callback = callback || function () {};
        var objects = unsavedObjects;
        unsavedObjects = [];
        unsavedObjectsHash = {};
        unsavedObjectsByCollection = {};
        if (Logger.trace) {
            Logger.trace('Saving objects', _.map(objects, function (x) {
                return x._dump()
            }))
        }
        saveToPouch(objects, callback, deferred);
    });
    return deferred.promise;
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
    save: save,
    _serialise: _serialise,
    _reset: function (cb) {
        siesta.removeListener('Siesta', listener);
        unsavedObjects = [];
        unsavedObjectsHash = {};
        pouch.destroy(function (err) {
            if (!err) {
                pouch = new PouchDB(DB_NAME);
            }
            siesta.on('Siesta', listener);
            Logger.warn('Reset complete');
            cb(err);
        })
    }
});

Object.defineProperties(storage, {
    _unsavedObjects: {
        get: function () {return unsavedObjects}
    },
    _unsavedObjectsHash: {
        get: function () {return unsavedObjectsHash}
    },
    _unsavedObjectsByCollection: {
        get: function () {return unsavedObjectsByCollection}
    },
    _pouch: {
        get: function () {return pouch}
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


if (typeof PouchDB == 'undefined') {
    siesta.ext.storageEnabled = false;
    Logger.error('Storage extension is present but could not find PouchDB. ' +
    'Have you included pouchdb.js in your project? It must be present at window.PouchDB!');
}

module.exports = storage;

},{}]},{},[1])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9zdG9yYWdlL2luZGV4LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiaWYgKHR5cGVvZiBzaWVzdGEgPT0gJ3VuZGVmaW5lZCcgJiYgdHlwZW9mIG1vZHVsZSA9PSAndW5kZWZpbmVkJykge1xuICAgIHRocm93IG5ldyBFcnJvcignQ291bGQgbm90IGZpbmQgd2luZG93LnNpZXN0YS4gTWFrZSBzdXJlIHlvdSBpbmNsdWRlIHNpZXN0YS5jb3JlLmpzIGZpcnN0LicpO1xufVxuXG5cbnZhciBfaSA9IHNpZXN0YS5faW50ZXJuYWwsXG4gICAgY2FjaGUgPSBfaS5jYWNoZSxcbiAgICBDb2xsZWN0aW9uUmVnaXN0cnkgPSBfaS5Db2xsZWN0aW9uUmVnaXN0cnksXG4gICAgbG9nID0gX2kubG9nLFxuICAgIHV0aWwgPSBfaS51dGlsLFxuICAgIF8gPSB1dGlsLl8sXG4gICAgZXZlbnRzID0gX2kuZXZlbnRzO1xuXG52YXIgREJfTkFNRSA9ICdzaWVzdGEnLFxuICAgIHBvdWNoID0gbmV3IFBvdWNoREIoREJfTkFNRSk7XG5cbnZhciB1bnNhdmVkT2JqZWN0cyA9IFtdLFxuICAgIHVuc2F2ZWRPYmplY3RzSGFzaCA9IHt9LFxuICAgIHVuc2F2ZWRPYmplY3RzQnlDb2xsZWN0aW9uID0ge307XG5cbnZhciBzdG9yYWdlID0ge30sXG4gICAgTG9nZ2VyID0gbG9nLmxvZ2dlcldpdGhOYW1lKCdTdG9yYWdlJyk7XG5cbkxvZ2dlci5zZXRMZXZlbChzaWVzdGEubG9nLndhcm4pO1xuXG4vKipcbiAqIFNlcmlhbGlzZSBhIG1vZGVsIGludG8gYSBmb3JtYXQgdGhhdCBQb3VjaERCIGJ1bGtEb2NzIEFQSSBjYW4gcHJvY2Vzc1xuICogQHBhcmFtIHtNb2RlbEluc3RhbmNlfSBtb2RlbEluc3RhbmNlXG4gKi9cbmZ1bmN0aW9uIF9zZXJpYWxpc2UobW9kZWxJbnN0YW5jZSkge1xuICAgIHZhciBzZXJpYWxpc2VkID0gc2llc3RhLl8uZXh0ZW5kKHt9LCBtb2RlbEluc3RhbmNlLl9fdmFsdWVzKTtcbiAgICBzZXJpYWxpc2VkWydjb2xsZWN0aW9uJ10gPSBtb2RlbEluc3RhbmNlLmNvbGxlY3Rpb25OYW1lO1xuICAgIHNlcmlhbGlzZWRbJ21vZGVsJ10gPSBtb2RlbEluc3RhbmNlLm1vZGVsTmFtZTtcbiAgICBzZXJpYWxpc2VkWydfaWQnXSA9IG1vZGVsSW5zdGFuY2UuX2lkO1xuICAgIGlmIChtb2RlbEluc3RhbmNlLnJlbW92ZWQpIHNlcmlhbGlzZWRbJ19kZWxldGVkJ10gPSB0cnVlO1xuICAgIHZhciByZXYgPSBtb2RlbEluc3RhbmNlLl9yZXY7XG4gICAgaWYgKHJldikgc2VyaWFsaXNlZFsnX3JldiddID0gcmV2O1xuICAgIHNlcmlhbGlzZWQgPSBfLnJlZHVjZShtb2RlbEluc3RhbmNlLl9yZWxhdGlvbnNoaXBOYW1lcywgZnVuY3Rpb24gKG1lbW8sIG4pIHtcbiAgICAgICAgdmFyIHZhbCA9IG1vZGVsSW5zdGFuY2Vbbl07XG4gICAgICAgIGlmIChzaWVzdGEuaXNBcnJheSh2YWwpKSB7XG4gICAgICAgICAgICBtZW1vW25dID0gXy5wbHVjayh2YWwsICdfaWQnKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmICh2YWwpIHtcbiAgICAgICAgICAgIG1lbW9bbl0gPSB2YWwuX2lkO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBtZW1vO1xuICAgIH0sIHNlcmlhbGlzZWQpO1xuICAgIHJldHVybiBzZXJpYWxpc2VkO1xufVxuXG5mdW5jdGlvbiBfcHJlcGFyZURhdHVtKGRhdHVtLCBtb2RlbCkge1xuICAgIC8vIEFkZCBibGFuayBvYmplY3Qgd2l0aCBjb3JyZWN0IF9pZCB0byB0aGUgY2FjaGUgc28gdGhhdCBjYW4gbWFwIGRhdGEgb250byBpdC5cbiAgICBkZWxldGUgZGF0dW0uY29sbGVjdGlvbjtcbiAgICBkZWxldGUgZGF0dW0ubW9kZWw7XG4gICAgdmFyIHJlbGF0aW9uc2hpcE5hbWVzID0gbW9kZWwuX3JlbGF0aW9uc2hpcE5hbWVzO1xuICAgIF8uZWFjaChyZWxhdGlvbnNoaXBOYW1lcywgZnVuY3Rpb24gKHIpIHtcbiAgICAgICAgdmFyIF9pZCA9IGRhdHVtW3JdO1xuICAgICAgICBpZiAoc2llc3RhLmlzQXJyYXkoX2lkKSkge1xuICAgICAgICAgICAgZGF0dW1bcl0gPSBfLm1hcChfaWQsIGZ1bmN0aW9uICh4KSB7IHJldHVybiB7X2lkOiB4fX0pO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgZGF0dW1bcl0gPSB7X2lkOiBfaWR9O1xuICAgICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIGRhdHVtO1xufVxuXG4vKipcbiAqXG4gKiBAcGFyYW0gb3B0c1xuICogQHBhcmFtIG9wdHMuY29sbGVjdGlvbk5hbWVcbiAqIEBwYXJhbSBvcHRzLm1vZGVsTmFtZVxuICogQHBhcmFtIGNhbGxiYWNrXG4gKiBAcHJpdmF0ZVxuICovXG5mdW5jdGlvbiBfbG9hZE1vZGVsKG9wdHMsIGNhbGxiYWNrKSB7XG4gICAgdmFyIGNvbGxlY3Rpb25OYW1lID0gb3B0cy5jb2xsZWN0aW9uTmFtZSxcbiAgICAgICAgbW9kZWxOYW1lID0gb3B0cy5tb2RlbE5hbWU7XG4gICAgaWYgKExvZ2dlci50cmFjZSkge1xuICAgICAgICB2YXIgZnVsbHlRdWFsaWZpZWROYW1lID0gY29sbGVjdGlvbk5hbWUgKyAnLicgKyBtb2RlbE5hbWU7XG4gICAgICAgIExvZ2dlci50cmFjZSgnTG9hZGluZyBpbnN0YW5jZXMgZm9yICcgKyBmdWxseVF1YWxpZmllZE5hbWUpO1xuICAgIH1cbiAgICB2YXIgTW9kZWwgPSBDb2xsZWN0aW9uUmVnaXN0cnlbY29sbGVjdGlvbk5hbWVdW21vZGVsTmFtZV07XG4gICAgdmFyIG1hcEZ1bmMgPSBmdW5jdGlvbiAoZG9jKSB7XG4gICAgICAgIGlmIChkb2MubW9kZWwgPT0gJyQxJyAmJiBkb2MuY29sbGVjdGlvbiA9PSAnJDInKSB7XG4gICAgICAgICAgICAvL25vaW5zcGVjdGlvbiBKU1VucmVzb2x2ZWRGdW5jdGlvblxuICAgICAgICAgICAgZW1pdChkb2MuX2lkLCBkb2MpO1xuICAgICAgICB9XG4gICAgfS50b1N0cmluZygpLnJlcGxhY2UoJyQxJywgbW9kZWxOYW1lKS5yZXBsYWNlKCckMicsIGNvbGxlY3Rpb25OYW1lKTtcbiAgICBpZiAoTG9nZ2VyLnRyYWNlLmlzRW5hYmxlZCkgTG9nZ2VyLnRyYWNlKCdRdWVyeWluZyBwb3VjaCcpO1xuICAgIHBvdWNoLnF1ZXJ5KHttYXA6IG1hcEZ1bmN9KVxuICAgICAgICAudGhlbihmdW5jdGlvbiAocmVzcCkge1xuICAgICAgICAgICAgaWYgKExvZ2dlci50cmFjZS5pc0VuYWJsZWQpIExvZ2dlci50cmFjZSgnUXVlcmllZCBwb3VjaCBzdWNjZXNmZnVsbHknKTtcbiAgICAgICAgICAgIHZhciBkYXRhID0gc2llc3RhLl8ubWFwKHNpZXN0YS5fLnBsdWNrKHJlc3Aucm93cywgJ3ZhbHVlJyksIGZ1bmN0aW9uIChkYXR1bSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBfcHJlcGFyZURhdHVtKGRhdHVtLCBNb2RlbCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKSBMb2dnZXIudHJhY2UoJ01hcHBpbmcgZGF0YScsIGRhdGEpO1xuICAgICAgICAgICAgTW9kZWwubWFwKGRhdGEsIHtkaXNhYmxlZXZlbnRzOiB0cnVlLCBfaWdub3JlSW5zdGFsbGVkOiB0cnVlfSwgZnVuY3Rpb24gKGVyciwgaW5zdGFuY2VzKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKExvZ2dlci50cmFjZSlcbiAgICAgICAgICAgICAgICAgICAgICAgIExvZ2dlci50cmFjZSgnTG9hZGVkICcgKyBpbnN0YW5jZXMubGVuZ3RoLnRvU3RyaW5nKCkgKyAnIGluc3RhbmNlcyBmb3IgJyArIGZ1bGx5UXVhbGlmaWVkTmFtZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBMb2dnZXIuZXJyb3IoJ0Vycm9yIGxvYWRpbmcgbW9kZWxzJywgZXJyKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyLCBpbnN0YW5jZXMpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pXG4gICAgICAgIC5jYXRjaChmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICB9KTtcbn1cblxuLyoqXG4gKiBMb2FkIGFsbCBkYXRhIGZyb20gUG91Y2hEQi5cbiAqL1xuZnVuY3Rpb24gX2xvYWQoY2FsbGJhY2spIHtcbiAgICB2YXIgZGVmZXJyZWQgPSB1dGlsLmRlZmVyKGNhbGxiYWNrKTtcbiAgICB2YXIgY29sbGVjdGlvbk5hbWVzID0gQ29sbGVjdGlvblJlZ2lzdHJ5LmNvbGxlY3Rpb25OYW1lcztcbiAgICB2YXIgdGFza3MgPSBbXTtcbiAgICBfLmVhY2goY29sbGVjdGlvbk5hbWVzLCBmdW5jdGlvbiAoY29sbGVjdGlvbk5hbWUpIHtcbiAgICAgICAgdmFyIGNvbGxlY3Rpb24gPSBDb2xsZWN0aW9uUmVnaXN0cnlbY29sbGVjdGlvbk5hbWVdLFxuICAgICAgICAgICAgbW9kZWxOYW1lcyA9IE9iamVjdC5rZXlzKGNvbGxlY3Rpb24uX21vZGVscyk7XG4gICAgICAgIF8uZWFjaChtb2RlbE5hbWVzLCBmdW5jdGlvbiAobW9kZWxOYW1lKSB7XG4gICAgICAgICAgICB0YXNrcy5wdXNoKGZ1bmN0aW9uIChjYikge1xuICAgICAgICAgICAgICAgIF9sb2FkTW9kZWwoe1xuICAgICAgICAgICAgICAgICAgICBjb2xsZWN0aW9uTmFtZTogY29sbGVjdGlvbk5hbWUsXG4gICAgICAgICAgICAgICAgICAgIG1vZGVsTmFtZTogbW9kZWxOYW1lXG4gICAgICAgICAgICAgICAgfSwgY2IpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH0pO1xuICAgIHNpZXN0YS5hc3luYy5wYXJhbGxlbCh0YXNrcywgZnVuY3Rpb24gKGVyciwgcmVzdWx0cykge1xuICAgICAgICBpZiAoIWVycikge1xuICAgICAgICAgICAgdmFyIGluc3RhbmNlcyA9IFtdO1xuICAgICAgICAgICAgc2llc3RhLl8uZWFjaChyZXN1bHRzLCBmdW5jdGlvbiAocikge2luc3RhbmNlcy5jb25jYXQocil9KTtcbiAgICAgICAgICAgIGlmIChMb2dnZXIudHJhY2UpIExvZ2dlci50cmFjZSgnTG9hZGVkICcgKyBpbnN0YW5jZXMubGVuZ3RoLnRvU3RyaW5nKCkgKyAnIGluc3RhbmNlcycpO1xuICAgICAgICB9XG4gICAgICAgIGRlZmVycmVkLmZpbmlzaChlcnIpO1xuICAgIH0pO1xuICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xufVxuXG5mdW5jdGlvbiBzYXZlQ29uZmxpY3RzKG9iamVjdHMsIGNhbGxiYWNrLCBkZWZlcnJlZCkge1xuICAgIHBvdWNoLmFsbERvY3Moe2tleXM6IF8ucGx1Y2sob2JqZWN0cywgJ19pZCcpfSlcbiAgICAgICAgLnRoZW4oZnVuY3Rpb24gKHJlc3ApIHtcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcmVzcC5yb3dzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgb2JqZWN0c1tpXS5fcmV2ID0gcmVzcC5yb3dzW2ldLnZhbHVlLnJldjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHNhdmVUb1BvdWNoKG9iamVjdHMsIGNhbGxiYWNrLCBkZWZlcnJlZCk7XG4gICAgICAgIH0pXG4gICAgICAgIC5jYXRjaChmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICBkZWZlcnJlZC5yZWplY3QoZXJyKTtcbiAgICAgICAgfSlcbn1cblxuZnVuY3Rpb24gc2F2ZVRvUG91Y2gob2JqZWN0cywgY2FsbGJhY2ssIGRlZmVycmVkKSB7XG4gICAgdmFyIGNvbmZsaWN0cyA9IFtdO1xuICAgIHBvdWNoLmJ1bGtEb2NzKF8ubWFwKG9iamVjdHMsIF9zZXJpYWxpc2UpKS50aGVuKGZ1bmN0aW9uIChyZXNwKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcmVzcC5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdmFyIHJlc3BvbnNlID0gcmVzcFtpXTtcbiAgICAgICAgICAgIHZhciBvYmogPSBvYmplY3RzW2ldO1xuICAgICAgICAgICAgaWYgKHJlc3BvbnNlLm9rKSB7XG4gICAgICAgICAgICAgICAgb2JqLl9yZXYgPSByZXNwb25zZS5yZXY7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChyZXNwb25zZS5zdGF0dXMgPT0gNDA5KSB7XG4gICAgICAgICAgICAgICAgY29uZmxpY3RzLnB1c2gob2JqKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIExvZ2dlci5lcnJvcignRXJyb3Igc2F2aW5nIG9iamVjdCB3aXRoIF9pZD1cIicgKyBvYmouX2lkICsgJ1wiJywgcmVzcG9uc2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChjb25mbGljdHMubGVuZ3RoKSB7XG4gICAgICAgICAgICBzYXZlQ29uZmxpY3RzKGNvbmZsaWN0cywgY2FsbGJhY2ssIGRlZmVycmVkKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGNhbGxiYWNrKCk7XG4gICAgICAgICAgICBpZiAoZGVmZXJyZWQpIGRlZmVycmVkLnJlc29sdmUoKTtcbiAgICAgICAgfVxuICAgIH0sIGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgaWYgKGRlZmVycmVkKSBkZWZlcnJlZC5yZWplY3QoZXJyKTtcbiAgICB9KTtcbn1cbi8qKlxuICogU2F2ZSBhbGwgbW9kZWxFdmVudHMgZG93biB0byBQb3VjaERCLlxuICovXG5mdW5jdGlvbiBzYXZlKGNhbGxiYWNrKSB7XG4gICAgdmFyIGRlZmVycmVkID0gdXRpbC5kZWZlcihjYWxsYmFjayk7XG4gICAgc2llc3RhLl9hZnRlckluc3RhbGwoZnVuY3Rpb24gKCkge1xuICAgICAgICBjYWxsYmFjayA9IGNhbGxiYWNrIHx8IGZ1bmN0aW9uICgpIHt9O1xuICAgICAgICB2YXIgb2JqZWN0cyA9IHVuc2F2ZWRPYmplY3RzO1xuICAgICAgICB1bnNhdmVkT2JqZWN0cyA9IFtdO1xuICAgICAgICB1bnNhdmVkT2JqZWN0c0hhc2ggPSB7fTtcbiAgICAgICAgdW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb24gPSB7fTtcbiAgICAgICAgaWYgKExvZ2dlci50cmFjZSkge1xuICAgICAgICAgICAgTG9nZ2VyLnRyYWNlKCdTYXZpbmcgb2JqZWN0cycsIF8ubWFwKG9iamVjdHMsIGZ1bmN0aW9uICh4KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHguX2R1bXAoKVxuICAgICAgICAgICAgfSkpXG4gICAgICAgIH1cbiAgICAgICAgc2F2ZVRvUG91Y2gob2JqZWN0cywgY2FsbGJhY2ssIGRlZmVycmVkKTtcbiAgICB9KTtcbiAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbn1cblxudmFyIGxpc3RlbmVyID0gZnVuY3Rpb24gKG4pIHtcbiAgICB2YXIgY2hhbmdlZE9iamVjdCA9IG4ub2JqLFxuICAgICAgICBpZGVudCA9IGNoYW5nZWRPYmplY3QuX2lkO1xuICAgIGlmICghY2hhbmdlZE9iamVjdCkge1xuICAgICAgICB0aHJvdyBuZXcgX2kuZXJyb3IuSW50ZXJuYWxTaWVzdGFFcnJvcignTm8gb2JqIGZpZWxkIGluIG5vdGlmaWNhdGlvbiByZWNlaXZlZCBieSBzdG9yYWdlIGV4dGVuc2lvbicpO1xuICAgIH1cbiAgICBpZiAoIShpZGVudCBpbiB1bnNhdmVkT2JqZWN0c0hhc2gpKSB7XG4gICAgICAgIHVuc2F2ZWRPYmplY3RzSGFzaFtpZGVudF0gPSBjaGFuZ2VkT2JqZWN0O1xuICAgICAgICB1bnNhdmVkT2JqZWN0cy5wdXNoKGNoYW5nZWRPYmplY3QpO1xuICAgICAgICB2YXIgY29sbGVjdGlvbk5hbWUgPSBjaGFuZ2VkT2JqZWN0LmNvbGxlY3Rpb25OYW1lO1xuICAgICAgICBpZiAoIXVuc2F2ZWRPYmplY3RzQnlDb2xsZWN0aW9uW2NvbGxlY3Rpb25OYW1lXSkge1xuICAgICAgICAgICAgdW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb25bY29sbGVjdGlvbk5hbWVdID0ge307XG4gICAgICAgIH1cbiAgICAgICAgdmFyIG1vZGVsTmFtZSA9IGNoYW5nZWRPYmplY3QubW9kZWwubmFtZTtcbiAgICAgICAgaWYgKCF1bnNhdmVkT2JqZWN0c0J5Q29sbGVjdGlvbltjb2xsZWN0aW9uTmFtZV1bbW9kZWxOYW1lXSkge1xuICAgICAgICAgICAgdW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb25bY29sbGVjdGlvbk5hbWVdW21vZGVsTmFtZV0gPSB7fTtcbiAgICAgICAgfVxuICAgICAgICB1bnNhdmVkT2JqZWN0c0J5Q29sbGVjdGlvbltjb2xsZWN0aW9uTmFtZV1bbW9kZWxOYW1lXVtpZGVudF0gPSBjaGFuZ2VkT2JqZWN0O1xuICAgIH1cbn07XG5zaWVzdGEub24oJ1NpZXN0YScsIGxpc3RlbmVyKTtcblxuXG5fLmV4dGVuZChzdG9yYWdlLCB7XG4gICAgX2xvYWQ6IF9sb2FkLFxuICAgIHNhdmU6IHNhdmUsXG4gICAgX3NlcmlhbGlzZTogX3NlcmlhbGlzZSxcbiAgICBfcmVzZXQ6IGZ1bmN0aW9uIChjYikge1xuICAgICAgICBzaWVzdGEucmVtb3ZlTGlzdGVuZXIoJ1NpZXN0YScsIGxpc3RlbmVyKTtcbiAgICAgICAgdW5zYXZlZE9iamVjdHMgPSBbXTtcbiAgICAgICAgdW5zYXZlZE9iamVjdHNIYXNoID0ge307XG4gICAgICAgIHBvdWNoLmRlc3Ryb3koZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgICAgICBwb3VjaCA9IG5ldyBQb3VjaERCKERCX05BTUUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgc2llc3RhLm9uKCdTaWVzdGEnLCBsaXN0ZW5lcik7XG4gICAgICAgICAgICBMb2dnZXIud2FybignUmVzZXQgY29tcGxldGUnKTtcbiAgICAgICAgICAgIGNiKGVycik7XG4gICAgICAgIH0pXG4gICAgfVxufSk7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKHN0b3JhZ2UsIHtcbiAgICBfdW5zYXZlZE9iamVjdHM6IHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7cmV0dXJuIHVuc2F2ZWRPYmplY3RzfVxuICAgIH0sXG4gICAgX3Vuc2F2ZWRPYmplY3RzSGFzaDoge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtyZXR1cm4gdW5zYXZlZE9iamVjdHNIYXNofVxuICAgIH0sXG4gICAgX3Vuc2F2ZWRPYmplY3RzQnlDb2xsZWN0aW9uOiB7XG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge3JldHVybiB1bnNhdmVkT2JqZWN0c0J5Q29sbGVjdGlvbn1cbiAgICB9LFxuICAgIF9wb3VjaDoge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtyZXR1cm4gcG91Y2h9XG4gICAgfVxufSk7XG5cblxuaWYgKCFzaWVzdGEuZXh0KSBzaWVzdGEuZXh0ID0ge307XG5zaWVzdGEuZXh0LnN0b3JhZ2UgPSBzdG9yYWdlO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydGllcyhzaWVzdGEuZXh0LCB7XG4gICAgc3RvcmFnZUVuYWJsZWQ6IHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBpZiAoc2llc3RhLmV4dC5fc3RvcmFnZUVuYWJsZWQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBzaWVzdGEuZXh0Ll9zdG9yYWdlRW5hYmxlZDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiAhIXNpZXN0YS5leHQuc3RvcmFnZTtcbiAgICAgICAgfSxcbiAgICAgICAgc2V0OiBmdW5jdGlvbiAodikge1xuICAgICAgICAgICAgc2llc3RhLmV4dC5fc3RvcmFnZUVuYWJsZWQgPSB2O1xuICAgICAgICB9LFxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlXG4gICAgfVxufSk7XG5cbnZhciBpbnRlcnZhbCwgc2F2aW5nLCBhdXRvc2F2ZUludGVydmFsID0gMTAwMDtcblxuT2JqZWN0LmRlZmluZVByb3BlcnRpZXMoc2llc3RhLCB7XG4gICAgYXV0b3NhdmU6IHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gISFpbnRlcnZhbDtcbiAgICAgICAgfSxcbiAgICAgICAgc2V0OiBmdW5jdGlvbiAoYXV0b3NhdmUpIHtcbiAgICAgICAgICAgIGlmIChhdXRvc2F2ZSkge1xuICAgICAgICAgICAgICAgIGlmICghaW50ZXJ2YWwpIHtcbiAgICAgICAgICAgICAgICAgICAgaW50ZXJ2YWwgPSBzZXRJbnRlcnZhbChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBDaGVla3kgd2F5IG9mIGF2b2lkaW5nIG11bHRpcGxlIHNhdmVzIGhhcHBlbmluZy4uLlxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFzYXZpbmcpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzYXZpbmcgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNpZXN0YS5zYXZlKGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50cy5lbWl0KCdzYXZlZCcpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNhdmluZyA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9LCBzaWVzdGEuYXV0b3NhdmVJbnRlcnZhbCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgaWYgKGludGVydmFsKSB7XG4gICAgICAgICAgICAgICAgICAgIGNsZWFySW50ZXJ2YWwoaW50ZXJ2YWwpO1xuICAgICAgICAgICAgICAgICAgICBpbnRlcnZhbCA9IG51bGw7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSxcbiAgICBhdXRvc2F2ZUludGVydmFsOiB7XG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIGF1dG9zYXZlSW50ZXJ2YWw7XG4gICAgICAgIH0sXG4gICAgICAgIHNldDogZnVuY3Rpb24gKF9hdXRvc2F2ZUludGVydmFsKSB7XG4gICAgICAgICAgICBhdXRvc2F2ZUludGVydmFsID0gX2F1dG9zYXZlSW50ZXJ2YWw7XG4gICAgICAgICAgICBpZiAoaW50ZXJ2YWwpIHtcbiAgICAgICAgICAgICAgICAvLyBSZXNldCBpbnRlcnZhbFxuICAgICAgICAgICAgICAgIHNpZXN0YS5hdXRvc2F2ZSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIHNpZXN0YS5hdXRvc2F2ZSA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9LFxuICAgIGRpcnR5OiB7XG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdmFyIHVuc2F2ZWRPYmplY3RzQnlDb2xsZWN0aW9uID0gc2llc3RhLmV4dC5zdG9yYWdlLl91bnNhdmVkT2JqZWN0c0J5Q29sbGVjdGlvbjtcbiAgICAgICAgICAgIHJldHVybiAhIU9iamVjdC5rZXlzKHVuc2F2ZWRPYmplY3RzQnlDb2xsZWN0aW9uKS5sZW5ndGg7XG4gICAgICAgIH0sXG4gICAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICB9XG59KTtcblxuXy5leHRlbmQoc2llc3RhLCB7XG4gICAgc2F2ZTogc2F2ZSxcbiAgICBzZXRQb3VjaDogZnVuY3Rpb24gKF9wKSB7XG4gICAgICAgIGlmIChzaWVzdGEuX2NhbkNoYW5nZSkgcG91Y2ggPSBfcDtcbiAgICAgICAgZWxzZSB0aHJvdyBuZXcgRXJyb3IoJ0Nhbm5vdCBjaGFuZ2UgUG91Y2hEQiBpbnN0YW5jZSB3aGVuIGFuIG9iamVjdCBncmFwaCBleGlzdHMuJyk7XG4gICAgfVxufSk7XG5cblxuaWYgKHR5cGVvZiBQb3VjaERCID09ICd1bmRlZmluZWQnKSB7XG4gICAgc2llc3RhLmV4dC5zdG9yYWdlRW5hYmxlZCA9IGZhbHNlO1xuICAgIExvZ2dlci5lcnJvcignU3RvcmFnZSBleHRlbnNpb24gaXMgcHJlc2VudCBidXQgY291bGQgbm90IGZpbmQgUG91Y2hEQi4gJyArXG4gICAgJ0hhdmUgeW91IGluY2x1ZGVkIHBvdWNoZGIuanMgaW4geW91ciBwcm9qZWN0PyBJdCBtdXN0IGJlIHByZXNlbnQgYXQgd2luZG93LlBvdWNoREIhJyk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gc3RvcmFnZTtcbiJdfQ==
