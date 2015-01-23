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
    modelEvents = require('./modelEvents'),
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
},{"./error":11,"./log":14,"./modelEvents":18,"./querySet":23,"./reactiveQuery":24,"./util":28}],2:[function(require,module,exports){
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
        },
        // This is for ProxyEventEmitter.
        event: {
            get: function () {return this._id}
        }
    });

    this.removed = false;
}

ModelInstance.prototype = Object.create(events.ProxyEventEmitter.prototype);

_.extend(ModelInstance.prototype, {
    get: function (callback) {
        var deferred = util.defer(callback);
        callback = deferred.finish.bind(deferred);
        callback(null, this);
        return deferred.promise;
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
    remove: function (callback, notification) {
        notification = notification == null ? true : notification;
        var deferred = util.defer(callback);
        callback = deferred.finish.bind(deferred);
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
                this.emit(modelEvents.ModelEventType.New, {
                    new: this
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
        return deferred.promise;
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


},{"./cache":8,"./error":11,"./events":12,"./log":14,"./modelEvents":18,"./util":28}],3:[function(require,module,exports){
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
},{"../vendor/observe-js/src/observe":44,"./RelationshipProxy":6,"./error":11,"./events":12,"./modelEvents":18,"./modelInstance":19,"./store":26,"./util":28}],4:[function(require,module,exports){
/**
 * @module relationships
 */

var RelationshipProxy = require('./RelationshipProxy'),
    Store = require('./store'),
    util = require('./util'),
    _ = util._,
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
},{"./RelationshipProxy":6,"./error":11,"./modelEvents":18,"./modelInstance":19,"./store":26,"./util":28}],5:[function(require,module,exports){
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
        },
        contains: function (opts) {
            if (!opts.invalid) return opts.object[opts.field].indexOf(opts.value) > -1;
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
                    err = constructError(matches);
                    break;
                } else {
                    if (matches) res.push(obj);
                }
            }
            res = this._sortResults(res);
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
},{"./cache":8,"./error":11,"./log":14,"./querySet":23,"./util":28}],6:[function(require,module,exports){
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


},{"../vendor/observe-js/src/observe":44,"./cache":8,"./error":11,"./events":12,"./log":14,"./modelEvents":18,"./query":22,"./store":26,"./util":28}],7:[function(require,module,exports){
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
exports.getSingleton = getSingleton;
},{"./error":11,"./log":14,"./util":28}],9:[function(require,module,exports){
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
            throw new InternalSiestaError('Collection "' + this.name + '" has already been installed');
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

module.exports = Collection;
},{"../vendor/observe-js/src/observe":44,"./cache":8,"./collectionRegistry":10,"./error":11,"./events":12,"./index":13,"./log":14,"./model":17,"./util":28,"extend":42}],10:[function(require,module,exports){
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
},{"./util":28}],11:[function(require,module,exports){
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
                return new SiestaUserError(component, message, extra);
            }
        }

        else {
            throw new SiestaUserError('No such component "' + component + '"');
        }
    }
};
},{}],12:[function(require,module,exports){
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
},{"../vendor/observe-js/src/observe":44,"./modelEvents":18,"./util":28,"events":38}],13:[function(require,module,exports){
var util = require('./util'),
    CollectionRegistry = require('./collectionRegistry').CollectionRegistry,
    Collection = require('./collection'),
    cache = require('./cache'),
    Model = require('./model'),
    error = require('./error'),
    events = require('./events'),
    RelationshipType = require('./RelationshipType'),
    ReactiveQuery = require('./reactiveQuery'),
    ManyToManyProxy = require('./manyToManyProxy'),
    OneToOneProxy = require('./oneToOneProxy'),
    OneToManyProxy = require('./oneToManyProxy'),
    RelationshipProxy = require('./relationshipProxy'),
    modelEvents = require('./modelEvents'),
    Query = require('./Query'),
    querySet = require('./querySet'),
    log = require('./log'),
    _ = util._;



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
        ModelInstance: require('./modelInstance'),
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
        if (siesta.ext.httpEnabled) {
            siesta.ext.http.DescriptorRegistry.reset();
        }
        if (siesta.ext.storageEnabled) {
            siesta.ext.storage._reset(cb);
        }
        else {
            cb();
        }
    },
    /**
     * Removes all data. Used during tests generally.
     * @param [cb]
     */
    resetData: function (cb) {
        var deferred = util.defer(cb);
        cb = deferred.finish.bind(deferred);
        siesta.ext.storage._reset(function () {
            var collectionNames = [],
                tasks = CollectionRegistry.collectionNames.reduce(function (memo, collectionName) {
                    var collection = CollectionRegistry[collectionName],
                        models = collection._models;
                    collectionNames.push(collectionName);
                    Object.keys(models).forEach(function (k) {
                        var model = models[k];
                        memo.push(function (done) {
                            model.all(function (err, res) {
                                if (!err) res.remove();
                                done(err);
                            });
                        });
                    });
                    return memo;
                }, []);
            util.async.series(
                [
                    _.partial(util.async.parallel, tasks)
                ],
                cb);
        });
        return deferred.promise;
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
        if (!(installing || installed)) {
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
                    cb(err);
                }
                else {
                    if (siesta.ext.httpEnabled) {
                        var errors = [];

                        function setupDescriptors(descriptors) {
                            Object.keys(descriptors).forEach(function (collectionName) {
                                var descriptorsForCollection = descriptors[collectionName];
                                descriptorsForCollection.forEach(function (d) {
                                    var error = d._resolveCollectionAndModel();
                                    console.log('error', error);
                                    if (error) errors.push(error);
                                });
                            });
                        }

                        var descriptorRegistry = siesta.ext.http.DescriptorRegistry,
                            requestDescriptors = descriptorRegistry.requestDescriptors,
                            responseDescriptors = descriptorRegistry.responseDescriptors;
                        setupDescriptors(requestDescriptors);
                        setupDescriptors(responseDescriptors);
                        console.log('errors', errors);
                        if (errors.length) {
                            cb(errors);
                            return;
                        }
                    }
                    if (siesta.ext.storageEnabled) {
                        siesta.ext.storage._load(function (err) {
                            if (!err) {
                                installed = true;
                                if (self.queuedTasks) self.queuedTasks.execute();
                            }
                            cb(err);
                        });
                    }
                    else {
                        installed = true;
                        if (self.queuedTasks) self.queuedTasks.execute();
                        cb();
                    }

                }
            });

            return deferred.promise;
        }
        else {
            throw new error.InternalSiestaError('Already installing...');
        }
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
    window['siesta'] = siesta;
}

module.exports = siesta;

/**
 * TODO: This could be dangerous?
 * Pretty damn useful to be able to access the bound object on a function tho.
 * See: http://stackoverflow.com/questions/14307264/what-object-javascript-function-is-bound-to-what-is-its-this
 */
var _bind = Function.prototype.apply.bind(Function.prototype.bind);
Object.defineProperty(Function.prototype, 'bind', {
    value: function(obj) {
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

(function loadExtensions() {
    require('../http');
    require('../storage');
})();

},{"../http":33,"../storage":43,"../vendor/observe-js/src/observe":44,"./Query":5,"./RelationshipType":7,"./cache":8,"./collection":9,"./collectionRegistry":10,"./error":11,"./events":12,"./log":14,"./manyToManyProxy":15,"./mappingOperation":16,"./model":17,"./modelEvents":18,"./modelInstance":19,"./oneToManyProxy":20,"./oneToOneProxy":21,"./querySet":23,"./reactiveQuery":24,"./relationshipProxy":25,"./store":26,"./util":28,"extend":42}],14:[function(require,module,exports){
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

},{"./util":28}],15:[function(require,module,exports){
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
},{"../vendor/observe-js/src/observe":44,"./RelationshipProxy":6,"./error":11,"./events":12,"./modelEvents":18,"./modelInstance":19,"./store":26,"./util":28}],16:[function(require,module,exports){
/**
 * @module mapping
 */

var Store = require('./store'),
    SiestaModel = require('./modelInstance'),
    log = require('./log'),
    InternalSiestaError = require('./error').InternalSiestaError,
    cache = require('./cache'),
    util = require('./util'),
    _ = util._,
    async = util.async,
    ModelEventType = require('./modelEvents').ModelEventType;

var Logger = log.loggerWithName('Mapping');
Logger.setLevel(log.Level.trace);

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
                        this.objects[i] = self._new();
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
        var singleton = cache.getSingleton(this.model) || this._new(_id);
        for (var i = 0; i < self.data.length; i++) {
            self.objects[i] = singleton;
        }
        callback();
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
                    console.error('caught error', e);
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



},{"./cache":8,"./error":11,"./log":14,"./modelEvents":18,"./modelInstance":19,"./store":26,"./util":28}],17:[function(require,module,exports){
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
                            if (self.singleton && relationship.type == RelationshipType.ManyToMany) {
                                return 'Singleton model cannot use ManyToMany relationship.';
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
                    var reverseModel = relationship.reverseModel,
                        reverseName = relationship.reverseName;
                    if (reverseModel.singleton) {
                        if (relationship.type == RelationshipType.ManyToMany) return 'Singleton model cannot be related via reverse ManyToMany';
                        if (relationship.type == RelationshipType.OneToMany) return 'Singleton model cannot be related via reverse OneToMany';
                    }
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
    _query: function (query) {
        var query = new Query(this, query || {});
        return query;
    },
    query: function (query, callback) {
        if (!this.singleton) return (this._query(query)).execute(callback);
        else {
            var deferred = util.defer(callback);
            callback = deferred.finish.bind(deferred);
            (this._query({__ignoreInstalled: true})).execute(function (err, objs) {
                if (err) callback(err);
                else {
                    // Cache a new singleton and then reexecute the query
                    query = _.extend({}, query);
                    query.__ignoreInstalled = true;
                    if (!objs.length) {
                        this.graph({}, function (err) {
                            if (!err) {
                                (this._query(query)).execute(callback);
                            }
                            else {
                                callback(err);
                            }
                        }.bind(this));
                    }
                    else {
                        (this._query(query)).execute(callback);
                    }
                }
            }.bind(this));
            return deferred.promise;
        }
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
        var deferred = util.defer(cb);
        cb = deferred.finish.bind(deferred);
        this.query(opts, function (err, res) {
            if (err) cb(err);
            else {
                if (res.length > 1) {
                    cb('More than one instance returned when executing get query!');
                }
                else {
                    res = res.length ? res[0] : null;
                    cb(null, res);
                }
            }
        });
        return deferred.promise;
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
    graph: function (data, opts, callback) {
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
                    deferred.finish(err ? (util.isArray(err) ? err[0] : err) : null, obj);
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
    count: function (callback) {
        var deferred = util.defer(callback);
        callback = deferred.finish.bind(deferred);
        var hash = this._countCache();
        callback(null, Object.keys(hash).length);
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
                        var propertyDependencies = this._propertyDependencies[field];
                        propertyDependencies = _.map(propertyDependencies, function (dependant) {
                            return {
                                prop: dependant,
                                old: this[dependant]
                            }
                        }.bind(this));
                        newModel.__values[field] = v;
                        propertyDependencies.forEach(function (dep) {
                            var propertyName = dep.prop;
                            var new_ = this[propertyName];
                            modelEvents.emit({
                                collection: self.collectionName,
                                model: self.name,
                                _id: newModel._id,
                                new: new_,
                                old: dep.old,
                                type: ModelEventType.Set,
                                field: propertyName,
                                obj: newModel
                            });
                        }.bind(this));
                        var e = {
                            collection: self.collectionName,
                            model: self.name,
                            _id: newModel._id,
                            new: v,
                            old: old,
                            type: ModelEventType.Set,
                            field: field,
                            obj: newModel
                        };
                        window.lastEmission = e;
                        modelEvents.emit(e);
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

            var _propertyNames = Object.keys(this.properties),
                _propertyDependencies = {};
            _.each(_propertyNames, function (propName) {
                var propDef = this.properties[propName];
                var dependencies = propDef.dependencies || [];
                dependencies.forEach(function (attr) {
                    if (!_propertyDependencies[attr]) _propertyDependencies[attr] = [];
                    _propertyDependencies[attr].push(propName);
                });
                delete propDef.dependencies;
                if (newModel[propName] === undefined) {
                    Object.defineProperty(newModel, propName, propDef);
                }
                else {
                    Logger.error('A property/method with name "' + propName + '" already exists. Ignoring it.');
                }
            }.bind(this));

            newModel._propertyDependencies = _propertyDependencies;

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



//
//_.extend(Model.prototype, {
//    listen: function (fn) {
//        events.on(this.collectionName + ':' + this.name, fn);
//        return function () {
//            this.removeListener(fn);
//        }.bind(this);
//    },
//    listenOnce: function (fn) {
//        return events.once(this.collectionName + ':' + this.name, fn);
//    },
//    removeListener: function (fn) {
//        return events.removeListener(this.collectionName + ':' + this.name, fn);
//    }
//});
//
//// Aliases
//_.extend(Model.prototype, {
//    on: Model.prototype.listen
//});

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

},{"./ArrangedReactiveQuery":1,"./OneToManyProxy":3,"./OneToOneProxy":4,"./RelationshipProxy":6,"./RelationshipType":7,"./cache":8,"./collectionRegistry":10,"./error":11,"./events":12,"./log":14,"./manyToManyProxy":15,"./mappingOperation":16,"./modelEvents":18,"./modelInstance":19,"./query":22,"./reactiveQuery":24,"./store":26,"./util":28,"extend":42}],18:[function(require,module,exports){
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
},{"./collectionRegistry":10,"./error":11,"./events":12,"./log":14,"./util":28}],19:[function(require,module,exports){
module.exports=require(2)
},{"./cache":8,"./error":11,"./events":12,"./log":14,"./modelEvents":18,"./util":28,"/Users/mtford/Playground/rest/core/ModelInstance.js":2}],20:[function(require,module,exports){
module.exports=require(3)
},{"../vendor/observe-js/src/observe":44,"./RelationshipProxy":6,"./error":11,"./events":12,"./modelEvents":18,"./modelInstance":19,"./store":26,"./util":28,"/Users/mtford/Playground/rest/core/OneToManyProxy.js":3}],21:[function(require,module,exports){
module.exports=require(4)
},{"./RelationshipProxy":6,"./error":11,"./modelEvents":18,"./modelInstance":19,"./store":26,"./util":28,"/Users/mtford/Playground/rest/core/OneToOneProxy.js":4}],22:[function(require,module,exports){
module.exports=require(5)
},{"./cache":8,"./error":11,"./log":14,"./querySet":23,"./util":28,"/Users/mtford/Playground/rest/core/Query.js":5}],23:[function(require,module,exports){
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
            return arePromises ? siesta.q.all(res) : querySet(res);
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
},{"./ModelInstance":2,"./error":11,"./util":28}],24:[function(require,module,exports){
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
                this.emit('change', {
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
                this.emit('change', {
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
                this.emit('change', {
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
                this.emit('change', n);
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
                this.emit('change', {
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
},{"./error":11,"./events":12,"./log":14,"./modelEvents":18,"./query":22,"./querySet":23,"./util":28,"events":38}],25:[function(require,module,exports){
module.exports=require(6)
},{"../vendor/observe-js/src/observe":44,"./cache":8,"./error":11,"./events":12,"./log":14,"./modelEvents":18,"./query":22,"./store":26,"./util":28,"/Users/mtford/Playground/rest/core/RelationshipProxy.js":6}],26:[function(require,module,exports){
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

},{"./cache":8,"./error":11,"./log":14,"./util":28}],27:[function(require,module,exports){
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
},{"./misc":29,"./underscore":30}],28:[function(require,module,exports){
/*
 * This is a collection of utilities taken from libraries such as async.js, underscore.js etc.
 * @module util
 */

var _ = require('./underscore'),
    async = require('./async'),
    misc = require('./misc');

_.extend(module.exports, {
    _: _,
    async: async
});
_.extend(module.exports, misc);

},{"./async":27,"./misc":29,"./underscore":30}],29:[function(require,module,exports){
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
    defer: function (cb) {
        var deferred;
        cb = cb || function () {};
        if (siesta.q) {
            deferred = siesta.q.defer();
            var reject = deferred.reject,
                resolve = deferred.resolve;
            _.extend(deferred, {
                reject: function (err) {
                    cb(err);
                    reject.call(this, err);
                },
                resolve: function (res) {
                    var thisArg = cb.__siesta_bound_object || cb;
                    var args = Array.prototype.slice.call(arguments, 0);
                    args.unshift(null);
                    cb.apply(thisArg, args);
                    resolve.apply(this, arguments);
                },
                finish: function (err, res) {
                    if (err) {
                        this.reject(err);
                    }
                    else {
                        var args = Array.prototype.slice.call(arguments, 1);
                        this.resolve.apply(this, args);
                    }
                }
            });
        }
        else {
            deferred = {
                promise: undefined,
                reject: function (err) {
                    var thisArg = cb.__siesta_bound_object || cb;
                    cb.apply(thisArg, arguments);
                },
                resolve: function (res) {
                    var thisArg = cb.__siesta_bound_object || cb;
                    var args = Array.prototype.slice.call(arguments, 0);
                    args.unshift(null);
                    cb.apply(thisArg, args);
                },
                finish: function (err, res) {
                    var thisArg = cb.__siesta_bound_object || cb;
                    cb.apply(thisArg, arguments)
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

        argDecl[1].split(FN_ARG_SPLIT).forEach(function (arg) {
            arg.replace(FN_ARG, function (all, underscore, name) {
                params.push(name);
            });
        });
        return params;
    }
});
},{"../../vendor/observe-js/src/observe":44,"./../error":11,"./underscore":30}],30:[function(require,module,exports){
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
},{}],31:[function(require,module,exports){
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

    //this._resolveCollectionAndModel();

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
    defineSubProperty.call(this, 'data', this._opts);
    defineSubProperty.call(this, 'transforms', this._opts);
}

_.extend(Descriptor.prototype, {
    httpMethods: httpMethods,
    _resolveCollectionAndModel: function () {
        var collection;
        var rawCollection = this._opts.collection,
            rawModel = this._opts.model;
        console.log('rawCollection', rawCollection);
        console.log('rawModel', rawModel);
        if (rawCollection) {
            if (typeof rawCollection == 'string') {
                collection = CollectionRegistry[rawCollection];
            }
            else {
                collection = rawCollection;
            }
        }
        else if (rawModel && !util.isString(rawModel)) {
            collection = rawModel.collection;
        }
        else {
            return 'Must pass collection or a model object';
        }

        var actualModel;
        // Mappings can be passed as the actual mapping object or as a string (with API specified too)
        if (rawModel) {
            if (util.isString(rawModel)) {
                actualModel = collection._models[rawModel];
                if (actualModel) {
                    this._opts.model = actualModel;
                } else {
                    return 'Model ' + rawModel + ' does not exist in collection';
                }
            }
            else {
                if (rawModel.collection != collection) {
                    return 'Passed model is not part of the passed collection';
                }
                actualModel = rawModel;
            }
        }
        else {
            return 'Descriptors must be initialised with a model';
        }

        this.model = actualModel;
        this.collection = collection;
    },
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
},{}],32:[function(require,module,exports){
var _internal = siesta._internal,
    util = _internal.util,
    _ = util._,
    InternalSiestaError = _internal.error.InternalSiestaError,
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
    var model = descriptor._opts.model,
        collection = descriptor._opts.collection,
        collectionName;
    if (collection) {
        if (util.isString(collection)) collectionName = collection;
        else collectionName = collection.name;
    }
    else if (model) {
        if (util.isString(model)) throw new InternalSiestaError('Not enough information to register the descriptor');
        else collectionName = model.collection.name;
    }
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
    if (Logger.trace.isEnabled) {
        Logger.trace('_descriptorsForCollection', {
            collection: collection,
            allDescriptors: descriptors,
            descriptors: descriptorsForCollection
        })
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
                Logger.debug('No response descriptors for collection ', {collection: collection});
        }
        return descriptorsForCollection;
    },
    reset: function () {
        this.requestDescriptors = {};
        this.responseDescriptors = {};
    }
});

exports.DescriptorRegistry = new DescriptorRegistry();
},{}],33:[function(require,module,exports){
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
    var deferred = util.defer(callback);
    callback = deferred.finish.bind(deferred);
    siesta._afterInstall(function () {
        opts.type = method; // jquery
        opts.method = method; // $http
        if (!opts.url) { // Allow overrides.
            var baseURL = this.baseURL;
            opts.url = baseURL + path;
        }
        if (opts.parseResponse === undefined) opts.parseResponse = true;
        function success(data, status, xhr) {
            logHttpResponse(opts, xhr, data);

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
                        var Model = matchedDescriptor.model;
                        Model.graph(extractedData, {override: opts.obj}, function (err, obj) {
                            callback(err, obj, data, xhr);
                        });
                    } else { // Matched, but no data.
                        callback(null, null, null, xhr);
                    }
                } else if (callback) {
                    if (name) {
                        callback(null, null, data, xhr);
                    } else {
                        // There was a bug where collection name doesn't exist. If this occurs, then will never get hold of any descriptors.
                        throw new InternalSiestaError('Unnamed collection');
                    }
                }
            } else {
                callback(null, null, data, xhr);
            }

        }

        function error(xhr, status, error) {
            if (callback) callback(error, null, null, xhr);
        }

        logHttpRequest(opts);
        var ajax = siesta.ext.http.ajax;
        if (ajax) {
            var promise = ajax(opts);
            if (promise.success) { // $http and jquery <1.8
                promise.success(success);
                promise.error(error);
            }
            else if (promise.done) { // jquery >= 1.8
                promise.done(success);
                promise.fail(error);
            }
            else {
                callback('Incompatible ajax function. Could not find success/fail methods on returned promise.');
            }
        }
        else {
            callback('No ajax function. Ensure that either $.ajax is available, or call siesta.setAjax(ajax) with a compatible ajax function e.g. zepto, jquery, $http')
        }
    }.bind(this));
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
        deferred.finish(err, {x: x, y: y, z: z});
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
        return ajax || ($ ? $.ajax : null) || (jQuery ? jQuery.ajax : null);
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

Object.defineProperty(siesta, 'ajax', {
    get: function () {
        return ajax;
    },
    set: function (_ajax) {
        ajax = _ajax;
    }
});

Object.defineProperties(serialisers, {
    id: {
        get: function () {
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

},{"./descriptor":31,"./descriptorRegistry":32,"./paginator":34,"./requestDescriptor":35,"./responseDescriptor":36,"./serialiser":37}],34:[function(require,module,exports){
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

                self.opts.model.graph(modelData, function (err, modelInstances) {
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
},{"querystring":41}],35:[function(require,module,exports){
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

},{"./descriptor":31,"./serialiser":37}],36:[function(require,module,exports){
/**
 * @module http
 */


var Descriptor = require('./descriptor').Descriptor,
    _ = siesta._internal.util._;

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
},{"./descriptor":31}],37:[function(require,module,exports){
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


},{}],38:[function(require,module,exports){
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

},{}],39:[function(require,module,exports){
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

},{}],40:[function(require,module,exports){
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

},{}],41:[function(require,module,exports){
'use strict';

exports.decode = exports.parse = require('./decode');
exports.encode = exports.stringify = require('./encode');

},{"./decode":39,"./encode":40}],42:[function(require,module,exports){
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


},{}],43:[function(require,module,exports){
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

var unsavedObjects = [],
    unsavedObjectsHash = {},
    unsavedObjectsByCollection = {};

var storage = {},
    Logger = log.loggerWithName('Storage');

if (typeof PouchDB == 'undefined') {
    siesta.ext.storageEnabled = false;
    console.log('PouchDB is not present therefore storage is disabled.');
}
else {
    var DB_NAME = 'siesta',
        pouch = new PouchDB(DB_NAME);

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
                Model.graph(data, {
                    disableevents: true,
                    _ignoreInstalled: true,
                    fromStorage: true
                }, function (err, instances) {
                    if (!err) {
                        if (Logger.trace.isEnabled) {
                            Logger.trace('Loaded ' + instances ? instances.length.toString() : 0 + ' instances for ' + fullyQualifiedName);
                        }
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
        if (saving) throw new Error('not loaded yet how can i save');
        var deferred = util.defer(callback);
        if (siesta.ext.storageEnabled) {
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
                    siesta._.each(results, function (r) {
                        instances.concat(r)
                    });
                    if (Logger.trace) Logger.trace('Loaded ' + instances.length.toString() + ' instances');
                }
                deferred.finish(err);
            });
        }
        else {
            deferred.finish();
        }
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
            callback = callback || function () {
            };
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

},{}],44:[function(require,module,exports){
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
},{}]},{},[13])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9jb3JlL0FycmFuZ2VkUmVhY3RpdmVRdWVyeS5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2NvcmUvTW9kZWxJbnN0YW5jZS5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2NvcmUvT25lVG9NYW55UHJveHkuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9jb3JlL09uZVRvT25lUHJveHkuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9jb3JlL1F1ZXJ5LmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3QvY29yZS9SZWxhdGlvbnNoaXBQcm94eS5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2NvcmUvUmVsYXRpb25zaGlwVHlwZS5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2NvcmUvY2FjaGUuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9jb3JlL2NvbGxlY3Rpb24uanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9jb3JlL2NvbGxlY3Rpb25SZWdpc3RyeS5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2NvcmUvZXJyb3IuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9jb3JlL2V2ZW50cy5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2NvcmUvaW5kZXguanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9jb3JlL2xvZy5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2NvcmUvbWFueVRvTWFueVByb3h5LmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3QvY29yZS9tYXBwaW5nT3BlcmF0aW9uLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3QvY29yZS9tb2RlbC5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2NvcmUvbW9kZWxFdmVudHMuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9jb3JlL3F1ZXJ5U2V0LmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3QvY29yZS9yZWFjdGl2ZVF1ZXJ5LmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3QvY29yZS9zdG9yZS5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2NvcmUvdXRpbC9hc3luYy5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2NvcmUvdXRpbC9pbmRleC5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2NvcmUvdXRpbC9taXNjLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3QvY29yZS91dGlsL3VuZGVyc2NvcmUuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9odHRwL2Rlc2NyaXB0b3IuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9odHRwL2Rlc2NyaXB0b3JSZWdpc3RyeS5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2h0dHAvaW5kZXguanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9odHRwL3BhZ2luYXRvci5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2h0dHAvcmVxdWVzdERlc2NyaXB0b3IuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9odHRwL3Jlc3BvbnNlRGVzY3JpcHRvci5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2h0dHAvc2VyaWFsaXNlci5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9ldmVudHMvZXZlbnRzLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3Qvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL3F1ZXJ5c3RyaW5nLWVzMy9kZWNvZGUuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvcXVlcnlzdHJpbmctZXMzL2VuY29kZS5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9xdWVyeXN0cmluZy1lczMvaW5kZXguanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9ub2RlX21vZHVsZXMvZXh0ZW5kL2luZGV4LmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3Qvc3RvcmFnZS9pbmRleC5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L3ZlbmRvci9vYnNlcnZlLWpzL3NyYy9vYnNlcnZlLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6S0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvS0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25JQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDelFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlUQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDUkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pYQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDalRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25HQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5U0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6SEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL1lBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xyQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7Ozs7Ozs7QUMvR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2SkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ2pNQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlPQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFNQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDZEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pSQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RUQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcllBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25kQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN1NBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0pBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyWEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8qKlxuICogU29sdmVzIHRoZSBjb21tb24gcHJvYmxlbSBvZiBtYWludGFpbmluZyB0aGUgb3JkZXIgb2YgYSBzZXQgb2YgYSBtb2RlbHMgYW5kIHF1ZXJ5aW5nIG9uIHRoYXQgb3JkZXIuXG4gKlxuICogVGhlIHNhbWUgYXMgUmVhY3RpdmVRdWVyeSBidXQgZW5hYmxlcyBtYW51YWwgcmVvcmRlcmluZyBvZiBtb2RlbHMgYW5kIG1haW50YWlucyBhbiBpbmRleCBmaWVsZC5cbiAqL1xuXG52YXIgUmVhY3RpdmVRdWVyeSA9IHJlcXVpcmUoJy4vcmVhY3RpdmVRdWVyeScpLFxuICAgIGxvZyA9IHJlcXVpcmUoJy4vbG9nJyksXG4gICAgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpLFxuICAgIGVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpLFxuICAgIG1vZGVsRXZlbnRzID0gcmVxdWlyZSgnLi9tb2RlbEV2ZW50cycpLFxuICAgIEludGVybmFsU2llc3RhRXJyb3IgPSBlcnJvci5JbnRlcm5hbFNpZXN0YUVycm9yLFxuICAgIGNvbnN0cnVjdFF1ZXJ5U2V0ID0gcmVxdWlyZSgnLi9xdWVyeVNldCcpLFxuICAgIGNvbnN0cnVjdEVycm9yID0gZXJyb3IuZXJyb3JGYWN0b3J5KGVycm9yLkNvbXBvbmVudHMuQXJyYW5nZWRSZWFjdGl2ZVF1ZXJ5KSxcbiAgICBfID0gdXRpbC5fO1xuXG5cbnZhciBMb2dnZXIgPSBsb2cubG9nZ2VyV2l0aE5hbWUoJ1F1ZXJ5Jyk7XG5cbmZ1bmN0aW9uIEFycmFuZ2VkUmVhY3RpdmVRdWVyeShxdWVyeSkge1xuICAgIFJlYWN0aXZlUXVlcnkuY2FsbCh0aGlzLCBxdWVyeSk7XG4gICAgdGhpcy5pbmRleEF0dHJpYnV0ZSA9ICdpbmRleCc7XG59XG5cbkFycmFuZ2VkUmVhY3RpdmVRdWVyeS5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKFJlYWN0aXZlUXVlcnkucHJvdG90eXBlKTtcblxuXy5leHRlbmQoQXJyYW5nZWRSZWFjdGl2ZVF1ZXJ5LnByb3RvdHlwZSwge1xuICAgIF9yZWZyZXNoSW5kZXhlczogZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgcmVzdWx0cyA9IHRoaXMucmVzdWx0cyxcbiAgICAgICAgICAgIGluZGV4QXR0cmlidXRlID0gdGhpcy5pbmRleEF0dHJpYnV0ZTtcbiAgICAgICAgaWYgKCFyZXN1bHRzKSB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignQXJyYW5nZWRSZWFjdGl2ZVF1ZXJ5IG11c3QgYmUgaW5pdGlhbGlzZWQnKTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCByZXN1bHRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB2YXIgbW9kZWxJbnN0YW5jZSA9IHJlc3VsdHNbaV07XG4gICAgICAgICAgICBtb2RlbEluc3RhbmNlW2luZGV4QXR0cmlidXRlXSA9IGk7XG4gICAgICAgIH1cbiAgICB9LFxuICAgIF9tZXJnZUluZGV4ZXM6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIHJlc3VsdHMgPSB0aGlzLnJlc3VsdHMsXG4gICAgICAgICAgICBuZXdSZXN1bHRzID0gW10sXG4gICAgICAgICAgICBvdXRPZkJvdW5kcyA9IFtdLFxuICAgICAgICAgICAgdW5pbmRleGVkID0gW107XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcmVzdWx0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdmFyIHJlcyA9IHJlc3VsdHNbaV0sXG4gICAgICAgICAgICAgICAgc3RvcmVkSW5kZXggPSByZXNbdGhpcy5pbmRleEF0dHJpYnV0ZV07XG4gICAgICAgICAgICBpZiAoc3RvcmVkSW5kZXggPT0gdW5kZWZpbmVkKSB7IC8vIG51bGwgb3IgdW5kZWZpbmVkXG4gICAgICAgICAgICAgICAgdW5pbmRleGVkLnB1c2gocmVzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKHN0b3JlZEluZGV4ID4gcmVzdWx0cy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICBvdXRPZkJvdW5kcy5wdXNoKHJlcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBIYW5kbGUgZHVwbGljYXRlIGluZGV4ZXNcbiAgICAgICAgICAgICAgICBpZiAoIW5ld1Jlc3VsdHNbc3RvcmVkSW5kZXhdKSB7XG4gICAgICAgICAgICAgICAgICAgIG5ld1Jlc3VsdHNbc3RvcmVkSW5kZXhdID0gcmVzO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdW5pbmRleGVkLnB1c2gocmVzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgb3V0T2ZCb3VuZHMgPSBfLnNvcnRCeShvdXRPZkJvdW5kcywgZnVuY3Rpb24gKHgpIHtcbiAgICAgICAgICAgIHJldHVybiB4W3RoaXMuaW5kZXhBdHRyaWJ1dGVdO1xuICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICAvLyBTaGlmdCB0aGUgaW5kZXggb2YgYWxsIG1vZGVscyB3aXRoIGluZGV4ZXMgb3V0IG9mIGJvdW5kcyBpbnRvIHRoZSBjb3JyZWN0IHJhbmdlLlxuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgb3V0T2ZCb3VuZHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHJlcyA9IG91dE9mQm91bmRzW2ldO1xuICAgICAgICAgICAgdmFyIHJlc3VsdHNJbmRleCA9IHRoaXMucmVzdWx0cy5sZW5ndGggLSBvdXRPZkJvdW5kcy5sZW5ndGggKyBpO1xuICAgICAgICAgICAgcmVzW3RoaXMuaW5kZXhBdHRyaWJ1dGVdID0gcmVzdWx0c0luZGV4O1xuICAgICAgICAgICAgbmV3UmVzdWx0c1tyZXN1bHRzSW5kZXhdID0gcmVzO1xuICAgICAgICB9XG4gICAgICAgIHVuaW5kZXhlZCA9IHRoaXMuX3F1ZXJ5Ll9zb3J0UmVzdWx0cyh1bmluZGV4ZWQpO1xuICAgICAgICB2YXIgbiA9IDA7XG4gICAgICAgIHdoaWxlICh1bmluZGV4ZWQubGVuZ3RoKSB7XG4gICAgICAgICAgICByZXMgPSB1bmluZGV4ZWQuc2hpZnQoKTtcbiAgICAgICAgICAgIHdoaWxlIChuZXdSZXN1bHRzW25dKSB7XG4gICAgICAgICAgICAgICAgbisrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbmV3UmVzdWx0c1tuXSA9IHJlcztcbiAgICAgICAgICAgIHJlc1t0aGlzLmluZGV4QXR0cmlidXRlXSA9IG47XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnJlc3VsdHMgPSBjb25zdHJ1Y3RRdWVyeVNldChuZXdSZXN1bHRzLCB0aGlzLm1vZGVsKTtcbiAgICB9LFxuICAgIGluaXQ6IGZ1bmN0aW9uIChjYikge1xuICAgICAgICB2YXIgZGVmZXJyZWQgPSB1dGlsLmRlZmVyKGNiKTtcbiAgICAgICAgUmVhY3RpdmVRdWVyeS5wcm90b3R5cGUuaW5pdC5jYWxsKHRoaXMsIGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgICAgICAgaWYgKCF0aGlzLm1vZGVsLmhhc0F0dHJpYnV0ZU5hbWVkKHRoaXMuaW5kZXhBdHRyaWJ1dGUpKSB7XG4gICAgICAgICAgICAgICAgICAgIGVyciA9IGNvbnN0cnVjdEVycm9yKCdNb2RlbCBcIicgKyB0aGlzLm1vZGVsLm5hbWUgKyAnXCIgZG9lcyBub3QgaGF2ZSBhbiBhdHRyaWJ1dGUgbmFtZWQgXCInICsgdGhpcy5pbmRleEF0dHJpYnV0ZSArICdcIicpXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9tZXJnZUluZGV4ZXMoKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fcXVlcnkuY2xlYXJPcmRlcmluZygpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGRlZmVycmVkLmZpbmlzaChlcnIsIGVyciA/IG51bGwgOiB0aGlzLnJlc3VsdHMpO1xuICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbiAgICB9LFxuICAgIF9oYW5kbGVOb3RpZjogZnVuY3Rpb24gKG4pIHtcbiAgICAgICAgLy8gV2UgZG9uJ3Qgd2FudCB0byBrZWVwIGV4ZWN1dGluZyB0aGUgcXVlcnkgZWFjaCB0aW1lIHRoZSBpbmRleCBldmVudCBmaXJlcyBhcyB3ZSdyZSBjaGFuZ2luZyB0aGUgaW5kZXggb3Vyc2VsdmVzXG4gICAgICAgIGlmIChuLmZpZWxkICE9IHRoaXMuaW5kZXhBdHRyaWJ1dGUpIHtcbiAgICAgICAgICAgIFJlYWN0aXZlUXVlcnkucHJvdG90eXBlLl9oYW5kbGVOb3RpZi5jYWxsKHRoaXMsIG4pO1xuICAgICAgICAgICAgdGhpcy5fcmVmcmVzaEluZGV4ZXMoKTtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgdmFsaWRhdGVJbmRleDogZnVuY3Rpb24gKGlkeCkge1xuICAgICAgICB2YXIgbWF4SW5kZXggPSB0aGlzLnJlc3VsdHMubGVuZ3RoIC0gMSxcbiAgICAgICAgICAgIG1pbkluZGV4ID0gMDtcbiAgICAgICAgaWYgKCEoaWR4ID49IG1pbkluZGV4ICYmIGlkeCA8PSBtYXhJbmRleCkpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignSW5kZXggJyArIGlkeC50b1N0cmluZygpICsgJyBpcyBvdXQgb2YgYm91bmRzJyk7XG4gICAgICAgIH1cbiAgICB9LFxuICAgIHN3YXBPYmplY3RzQXRJbmRleGVzOiBmdW5jdGlvbiAoZnJvbSwgdG8pIHtcbiAgICAgICAgLy9ub2luc3BlY3Rpb24gVW5uZWNlc3NhcnlMb2NhbFZhcmlhYmxlSlNcbiAgICAgICAgdGhpcy52YWxpZGF0ZUluZGV4KGZyb20pO1xuICAgICAgICB0aGlzLnZhbGlkYXRlSW5kZXgodG8pO1xuICAgICAgICB2YXIgZnJvbU1vZGVsID0gdGhpcy5yZXN1bHRzW2Zyb21dLFxuICAgICAgICAgICAgdG9Nb2RlbCA9IHRoaXMucmVzdWx0c1t0b107XG4gICAgICAgIGlmICghZnJvbU1vZGVsKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ05vIG1vZGVsIGF0IGluZGV4IFwiJyArIGZyb20udG9TdHJpbmcoKSArICdcIicpO1xuICAgICAgICB9XG4gICAgICAgIGlmICghdG9Nb2RlbCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdObyBtb2RlbCBhdCBpbmRleCBcIicgKyB0by50b1N0cmluZygpICsgJ1wiJyk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5yZXN1bHRzW3RvXSA9IGZyb21Nb2RlbDtcbiAgICAgICAgdGhpcy5yZXN1bHRzW2Zyb21dID0gdG9Nb2RlbDtcbiAgICAgICAgZnJvbU1vZGVsW3RoaXMuaW5kZXhBdHRyaWJ1dGVdID0gdG87XG4gICAgICAgIHRvTW9kZWxbdGhpcy5pbmRleEF0dHJpYnV0ZV0gPSBmcm9tO1xuICAgIH0sXG4gICAgc3dhcE9iamVjdHM6IGZ1bmN0aW9uIChvYmoxLCBvYmoyKSB7XG4gICAgICAgIHZhciBmcm9tSWR4ID0gdGhpcy5yZXN1bHRzLmluZGV4T2Yob2JqMSksXG4gICAgICAgICAgICB0b0lkeCA9IHRoaXMucmVzdWx0cy5pbmRleE9mKG9iajIpO1xuICAgICAgICB0aGlzLnN3YXBPYmplY3RzQXRJbmRleGVzKGZyb21JZHgsIHRvSWR4KTtcbiAgICB9LFxuICAgIG1vdmU6IGZ1bmN0aW9uIChmcm9tLCB0bykge1xuICAgICAgICB0aGlzLnZhbGlkYXRlSW5kZXgoZnJvbSk7XG4gICAgICAgIHRoaXMudmFsaWRhdGVJbmRleCh0byk7XG4gICAgICAgIHZhciByZXN1bHRzID0gdGhpcy5yZXN1bHRzLm11dGFibGVDb3B5KCk7XG4gICAgICAgIChmdW5jdGlvbiAob2xkSW5kZXgsIG5ld0luZGV4KSB7XG4gICAgICAgICAgICBpZiAobmV3SW5kZXggPj0gdGhpcy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICB2YXIgayA9IG5ld0luZGV4IC0gdGhpcy5sZW5ndGg7XG4gICAgICAgICAgICAgICAgd2hpbGUgKChrLS0pICsgMSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnB1c2godW5kZWZpbmVkKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pLmNhbGwocmVzdWx0cywgZnJvbSwgdG8pO1xuICAgICAgICB2YXIgcmVtb3ZlZCA9IHJlc3VsdHMuc3BsaWNlKGZyb20sIDEpWzBdO1xuICAgICAgICB0aGlzLnJlc3VsdHMgPSByZXN1bHRzLmFzTW9kZWxRdWVyeVNldCh0aGlzLm1vZGVsKTtcbiAgICAgICAgdGhpcy5lbWl0KCdjaGFuZ2UnLCB7XG4gICAgICAgICAgICBpbmRleDogZnJvbSxcbiAgICAgICAgICAgIHJlbW92ZWQ6IFtyZW1vdmVkXSxcbiAgICAgICAgICAgIHR5cGU6IG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlLlNwbGljZSxcbiAgICAgICAgICAgIG9iajogdGhpcyxcbiAgICAgICAgICAgIGZpZWxkOiAncmVzdWx0cydcbiAgICAgICAgfSk7XG4gICAgICAgIHJlc3VsdHMuc3BsaWNlKHRvLCAwLCByZW1vdmVkKTtcbiAgICAgICAgdGhpcy5yZXN1bHRzID0gcmVzdWx0cy5hc01vZGVsUXVlcnlTZXQodGhpcy5tb2RlbCk7XG4gICAgICAgIHRoaXMuZW1pdCgnY2hhbmdlJywge1xuICAgICAgICAgICAgaW5kZXg6IHRvLFxuICAgICAgICAgICAgYWRkZWQ6IFtyZW1vdmVkXSxcbiAgICAgICAgICAgIHR5cGU6IG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlLlNwbGljZSxcbiAgICAgICAgICAgIG9iajogdGhpcyxcbiAgICAgICAgICAgIGZpZWxkOiAncmVzdWx0cydcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuX3JlZnJlc2hJbmRleGVzKCk7XG4gICAgfVxufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gQXJyYW5nZWRSZWFjdGl2ZVF1ZXJ5OyIsInZhciBsb2cgPSByZXF1aXJlKCcuL2xvZycpLFxuICAgIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKSxcbiAgICBfID0gdXRpbC5fLFxuICAgIGVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpLFxuICAgIEludGVybmFsU2llc3RhRXJyb3IgPSBlcnJvci5JbnRlcm5hbFNpZXN0YUVycm9yLFxuICAgIG1vZGVsRXZlbnRzID0gcmVxdWlyZSgnLi9tb2RlbEV2ZW50cycpLFxuICAgIGV2ZW50cyA9IHJlcXVpcmUoJy4vZXZlbnRzJyksXG4gICAgY2FjaGUgPSByZXF1aXJlKCcuL2NhY2hlJyk7XG5cbmZ1bmN0aW9uIE1vZGVsSW5zdGFuY2UobW9kZWwpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdGhpcy5tb2RlbCA9IG1vZGVsO1xuXG4gICAgdXRpbC5zdWJQcm9wZXJ0aWVzKHRoaXMsIHRoaXMubW9kZWwsIFtcbiAgICAgICAgJ2NvbGxlY3Rpb24nLFxuICAgICAgICAnY29sbGVjdGlvbk5hbWUnLFxuICAgICAgICAnX2F0dHJpYnV0ZU5hbWVzJyxcbiAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogJ2lkRmllbGQnLFxuICAgICAgICAgICAgcHJvcGVydHk6ICdpZCdcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogJ21vZGVsTmFtZScsXG4gICAgICAgICAgICBwcm9wZXJ0eTogJ25hbWUnXG4gICAgICAgIH1cbiAgICBdKTtcblxuICAgIGV2ZW50cy5Qcm94eUV2ZW50RW1pdHRlci5jYWxsKHRoaXMpO1xuXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnRpZXModGhpcywge1xuICAgICAgICBfcmVsYXRpb25zaGlwTmFtZXM6IHtcbiAgICAgICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHZhciBwcm94aWVzID0gXy5tYXAoT2JqZWN0LmtleXMoc2VsZi5fX3Byb3hpZXMgfHwge30pLCBmdW5jdGlvbiAoeCkge3JldHVybiBzZWxmLl9fcHJveGllc1t4XX0pO1xuICAgICAgICAgICAgICAgIHJldHVybiBfLm1hcChwcm94aWVzLCBmdW5jdGlvbiAocCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAocC5pc0ZvcndhcmQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBwLmZvcndhcmROYW1lO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHAucmV2ZXJzZU5hbWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgICAgIH0sXG4gICAgICAgIGRpcnR5OiB7XG4gICAgICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBpZiAoc2llc3RhLmV4dC5zdG9yYWdlRW5hYmxlZCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gc2VsZi5faWQgaW4gc2llc3RhLmV4dC5zdG9yYWdlLl91bnNhdmVkT2JqZWN0c0hhc2g7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2UgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlXG4gICAgICAgIH0sXG4gICAgICAgIC8vIFRoaXMgaXMgZm9yIFByb3h5RXZlbnRFbWl0dGVyLlxuICAgICAgICBldmVudDoge1xuICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7cmV0dXJuIHRoaXMuX2lkfVxuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICB0aGlzLnJlbW92ZWQgPSBmYWxzZTtcbn1cblxuTW9kZWxJbnN0YW5jZS5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKGV2ZW50cy5Qcm94eUV2ZW50RW1pdHRlci5wcm90b3R5cGUpO1xuXG5fLmV4dGVuZChNb2RlbEluc3RhbmNlLnByb3RvdHlwZSwge1xuICAgIGdldDogZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgICAgIHZhciBkZWZlcnJlZCA9IHV0aWwuZGVmZXIoY2FsbGJhY2spO1xuICAgICAgICBjYWxsYmFjayA9IGRlZmVycmVkLmZpbmlzaC5iaW5kKGRlZmVycmVkKTtcbiAgICAgICAgY2FsbGJhY2sobnVsbCwgdGhpcyk7XG4gICAgICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xuICAgIH0sXG4gICAgZW1pdDogZnVuY3Rpb24gKHR5cGUsIG9wdHMpIHtcbiAgICAgICAgaWYgKHR5cGVvZiB0eXBlID09ICdvYmplY3QnKSBvcHRzID0gdHlwZTtcbiAgICAgICAgZWxzZSBvcHRzLnR5cGUgPSB0eXBlO1xuICAgICAgICBvcHRzID0gb3B0cyB8fCB7fTtcbiAgICAgICAgXy5leHRlbmQob3B0cywge1xuICAgICAgICAgICAgY29sbGVjdGlvbjogdGhpcy5jb2xsZWN0aW9uTmFtZSxcbiAgICAgICAgICAgIG1vZGVsOiB0aGlzLm1vZGVsLm5hbWUsXG4gICAgICAgICAgICBfaWQ6IHRoaXMuX2lkLFxuICAgICAgICAgICAgb2JqOiB0aGlzXG4gICAgICAgIH0pO1xuICAgICAgICBtb2RlbEV2ZW50cy5lbWl0KG9wdHMpO1xuICAgIH0sXG4gICAgcmVtb3ZlOiBmdW5jdGlvbiAoY2FsbGJhY2ssIG5vdGlmaWNhdGlvbikge1xuICAgICAgICBub3RpZmljYXRpb24gPSBub3RpZmljYXRpb24gPT0gbnVsbCA/IHRydWUgOiBub3RpZmljYXRpb247XG4gICAgICAgIHZhciBkZWZlcnJlZCA9IHV0aWwuZGVmZXIoY2FsbGJhY2spO1xuICAgICAgICBjYWxsYmFjayA9IGRlZmVycmVkLmZpbmlzaC5iaW5kKGRlZmVycmVkKTtcbiAgICAgICAgY2FjaGUucmVtb3ZlKHRoaXMpO1xuICAgICAgICB0aGlzLnJlbW92ZWQgPSB0cnVlO1xuICAgICAgICBpZiAobm90aWZpY2F0aW9uKSB7XG4gICAgICAgICAgICB0aGlzLmVtaXQobW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUuUmVtb3ZlLCB7XG4gICAgICAgICAgICAgICAgb2xkOiB0aGlzXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgcmVtb3ZlID0gdGhpcy5tb2RlbC5yZW1vdmU7XG4gICAgICAgIGlmIChyZW1vdmUpIHtcbiAgICAgICAgICAgIHZhciBwYXJhbU5hbWVzID0gdXRpbC5wYXJhbU5hbWVzKHJlbW92ZSk7XG4gICAgICAgICAgICBpZiAocGFyYW1OYW1lcy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgICAgICAgICAgcmVtb3ZlLmNhbGwodGhpcywgZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIsIHNlbGYpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgcmVtb3ZlLmNhbGwodGhpcyk7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2sobnVsbCwgdGhpcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBjYWxsYmFjayhudWxsLCB0aGlzKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbiAgICB9LFxuICAgIHJlc3RvcmU6IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgICAgICB2YXIgZGVmZXJyZWQgPSB1dGlsLmRlZmVyKGNhbGxiYWNrKTtcbiAgICAgICAgY2FsbGJhY2sgPSBkZWZlcnJlZC5maW5pc2guYmluZChkZWZlcnJlZCk7XG4gICAgICAgIHZhciBfZmluaXNoID0gZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmVtaXQobW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUuTmV3LCB7XG4gICAgICAgICAgICAgICAgICAgIG5ldzogdGhpc1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2FsbGJhY2soZXJyLCB0aGlzKTtcbiAgICAgICAgfS5iaW5kKHRoaXMpO1xuICAgICAgICBpZiAodGhpcy5yZW1vdmVkKSB7XG4gICAgICAgICAgICBjYWNoZS5pbnNlcnQodGhpcyk7XG4gICAgICAgICAgICB0aGlzLnJlbW92ZWQgPSBmYWxzZTtcbiAgICAgICAgICAgIHZhciBpbml0ID0gdGhpcy5tb2RlbC5pbml0O1xuICAgICAgICAgICAgaWYgKGluaXQpIHtcbiAgICAgICAgICAgICAgICB2YXIgcGFyYW1OYW1lcyA9IHV0aWwucGFyYW1OYW1lcyhpbml0KTtcbiAgICAgICAgICAgICAgICB2YXIgZnJvbVN0b3JhZ2UgPSB0cnVlO1xuICAgICAgICAgICAgICAgIGlmIChwYXJhbU5hbWVzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgaW5pdC5jYWxsKHRoaXMsIGZyb21TdG9yYWdlLCBfZmluaXNoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGluaXQuY2FsbCh0aGlzLCBmcm9tU3RvcmFnZSk7XG4gICAgICAgICAgICAgICAgICAgIF9maW5pc2goKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBfZmluaXNoKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG4gICAgfVxufSk7XG5cbi8vIEluc3BlY3Rpb25cbl8uZXh0ZW5kKE1vZGVsSW5zdGFuY2UucHJvdG90eXBlLCB7XG4gICAgZ2V0QXR0cmlidXRlczogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gXy5leHRlbmQoe30sIHRoaXMuX192YWx1ZXMpO1xuICAgIH0sXG4gICAgaXNJbnN0YW5jZU9mOiBmdW5jdGlvbiAobW9kZWwpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMubW9kZWwgPT0gbW9kZWw7XG4gICAgfSxcbiAgICBpc0E6IGZ1bmN0aW9uIChtb2RlbCkge1xuICAgICAgICByZXR1cm4gdGhpcy5tb2RlbCA9PSBtb2RlbCB8fCB0aGlzLm1vZGVsLmlzRGVzY2VuZGFudE9mKG1vZGVsKTtcbiAgICB9XG59KTtcblxuLy8gRHVtcFxuXy5leHRlbmQoTW9kZWxJbnN0YW5jZS5wcm90b3R5cGUsIHtcbiAgICBfZHVtcFN0cmluZzogZnVuY3Rpb24gKHJldmVyc2VSZWxhdGlvbnNoaXBzKSB7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh0aGlzLl9kdW1wKHJldmVyc2VSZWxhdGlvbnNoaXBzLCBudWxsLCA0KSk7XG4gICAgfSxcbiAgICBfZHVtcDogZnVuY3Rpb24gKHJldmVyc2VSZWxhdGlvbnNoaXBzKSB7XG4gICAgICAgIHZhciBkdW1wZWQgPSBfLmV4dGVuZCh7fSwgdGhpcy5fX3ZhbHVlcyk7XG4gICAgICAgIGR1bXBlZC5fcmV2ID0gdGhpcy5fcmV2O1xuICAgICAgICBkdW1wZWQuX2lkID0gdGhpcy5faWQ7XG4gICAgICAgIHJldHVybiBkdW1wZWQ7XG4gICAgfVxufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gTW9kZWxJbnN0YW5jZTtcblxuIiwiLyoqXG4gKiBAbW9kdWxlIHJlbGF0aW9uc2hpcHNcbiAqL1xuXG52YXIgUmVsYXRpb25zaGlwUHJveHkgPSByZXF1aXJlKCcuL1JlbGF0aW9uc2hpcFByb3h5JyksXG4gICAgU3RvcmUgPSByZXF1aXJlKCcuL3N0b3JlJyksXG4gICAgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpLFxuICAgIF8gPSB1dGlsLl8sXG4gICAgSW50ZXJuYWxTaWVzdGFFcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKS5JbnRlcm5hbFNpZXN0YUVycm9yLFxuICAgIG1vZGVsRXZlbnRzID0gcmVxdWlyZSgnLi9tb2RlbEV2ZW50cycpLFxuICAgIFNpZXN0YU1vZGVsID0gcmVxdWlyZSgnLi9tb2RlbEluc3RhbmNlJyksXG4gICAgZXZlbnRzID0gcmVxdWlyZSgnLi9ldmVudHMnKSxcbiAgICB3cmFwQXJyYXlGb3JBdHRyaWJ1dGVzID0gZXZlbnRzLndyYXBBcnJheSxcbiAgICBBcnJheU9ic2VydmVyID0gcmVxdWlyZSgnLi4vdmVuZG9yL29ic2VydmUtanMvc3JjL29ic2VydmUnKS5BcnJheU9ic2VydmVyLFxuICAgIE1vZGVsRXZlbnRUeXBlID0gcmVxdWlyZSgnLi9tb2RlbEV2ZW50cycpLk1vZGVsRXZlbnRUeXBlO1xuXG4vKipcbiAqIEBjbGFzcyAgW09uZVRvTWFueVByb3h5IGRlc2NyaXB0aW9uXVxuICogQGNvbnN0cnVjdG9yXG4gKiBAcGFyYW0ge1t0eXBlXX0gb3B0c1xuICovXG5mdW5jdGlvbiBPbmVUb01hbnlQcm94eShvcHRzKSB7XG4gICAgUmVsYXRpb25zaGlwUHJveHkuY2FsbCh0aGlzLCBvcHRzKTtcbiAgICBpZiAodGhpcy5pc1JldmVyc2UpIHRoaXMucmVsYXRlZCA9IFtdO1xufVxuXG5PbmVUb01hbnlQcm94eS5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKFJlbGF0aW9uc2hpcFByb3h5LnByb3RvdHlwZSk7XG5cbl8uZXh0ZW5kKE9uZVRvTWFueVByb3h5LnByb3RvdHlwZSwge1xuICAgIGNsZWFyUmV2ZXJzZTogZnVuY3Rpb24gKHJlbW92ZWQpIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICBfLmVhY2gocmVtb3ZlZCwgZnVuY3Rpb24gKHJlbW92ZWRPYmplY3QpIHtcbiAgICAgICAgICAgIHZhciByZXZlcnNlUHJveHkgPSBzZWxmLnJldmVyc2VQcm94eUZvckluc3RhbmNlKHJlbW92ZWRPYmplY3QpO1xuICAgICAgICAgICAgcmV2ZXJzZVByb3h5LnNldElkQW5kUmVsYXRlZChudWxsKTtcbiAgICAgICAgfSk7XG4gICAgfSxcbiAgICBzZXRSZXZlcnNlT2ZBZGRlZDogZnVuY3Rpb24gKGFkZGVkKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgXy5lYWNoKGFkZGVkLCBmdW5jdGlvbiAoYWRkZWQpIHtcbiAgICAgICAgICAgIHZhciBmb3J3YXJkUHJveHkgPSBzZWxmLnJldmVyc2VQcm94eUZvckluc3RhbmNlKGFkZGVkKTtcbiAgICAgICAgICAgIGZvcndhcmRQcm94eS5zZXRJZEFuZFJlbGF0ZWQoc2VsZi5vYmplY3QpO1xuICAgICAgICB9KTtcbiAgICB9LFxuICAgIHdyYXBBcnJheTogZnVuY3Rpb24gKGFycikge1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgIHdyYXBBcnJheUZvckF0dHJpYnV0ZXMoYXJyLCB0aGlzLnJldmVyc2VOYW1lLCB0aGlzLm9iamVjdCk7XG4gICAgICAgIGlmICghYXJyLmFycmF5T2JzZXJ2ZXIpIHtcbiAgICAgICAgICAgIGFyci5hcnJheU9ic2VydmVyID0gbmV3IEFycmF5T2JzZXJ2ZXIoYXJyKTtcbiAgICAgICAgICAgIHZhciBvYnNlcnZlckZ1bmN0aW9uID0gZnVuY3Rpb24gKHNwbGljZXMpIHtcbiAgICAgICAgICAgICAgICBzcGxpY2VzLmZvckVhY2goZnVuY3Rpb24gKHNwbGljZSkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgYWRkZWQgPSBzcGxpY2UuYWRkZWRDb3VudCA/IGFyci5zbGljZShzcGxpY2UuaW5kZXgsIHNwbGljZS5pbmRleCArIHNwbGljZS5hZGRlZENvdW50KSA6IFtdO1xuICAgICAgICAgICAgICAgICAgICB2YXIgcmVtb3ZlZCA9IHNwbGljZS5yZW1vdmVkO1xuICAgICAgICAgICAgICAgICAgICBzZWxmLmNsZWFyUmV2ZXJzZShyZW1vdmVkKTtcbiAgICAgICAgICAgICAgICAgICAgc2VsZi5zZXRSZXZlcnNlT2ZBZGRlZChhZGRlZCk7XG4gICAgICAgICAgICAgICAgICAgIHZhciBtb2RlbCA9IHNlbGYuZ2V0Rm9yd2FyZE1vZGVsKCk7XG4gICAgICAgICAgICAgICAgICAgIG1vZGVsRXZlbnRzLmVtaXQoe1xuICAgICAgICAgICAgICAgICAgICAgICAgY29sbGVjdGlvbjogbW9kZWwuY29sbGVjdGlvbk5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBtb2RlbDogbW9kZWwubmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIF9pZDogc2VsZi5vYmplY3QuX2lkLFxuICAgICAgICAgICAgICAgICAgICAgICAgZmllbGQ6IHNlbGYuZ2V0Rm9yd2FyZE5hbWUoKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlbW92ZWQ6IHJlbW92ZWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBhZGRlZDogYWRkZWQsXG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiBNb2RlbEV2ZW50VHlwZS5TcGxpY2UsXG4gICAgICAgICAgICAgICAgICAgICAgICBpbmRleDogc3BsaWNlLmluZGV4LFxuICAgICAgICAgICAgICAgICAgICAgICAgb2JqOiBzZWxmLm9iamVjdFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBhcnIuYXJyYXlPYnNlcnZlci5vcGVuKG9ic2VydmVyRnVuY3Rpb24pO1xuICAgICAgICB9XG4gICAgfSxcbiAgICBnZXQ6IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgICAgICB2YXIgZGVmZXJyZWQgPSB1dGlsLmRlZmVyKGNhbGxiYWNrKTtcbiAgICAgICAgY2FsbGJhY2sgPSBkZWZlcnJlZC5maW5pc2guYmluZChkZWZlcnJlZCk7XG4gICAgICAgIGNhbGxiYWNrKG51bGwsIHRoaXMucmVsYXRlZCk7XG4gICAgICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xuICAgIH0sXG4gICAgLyoqXG4gICAgICogVmFsaWRhdGUgdGhlIG9iamVjdCB0aGF0IHdlJ3JlIHNldHRpbmdcbiAgICAgKiBAcGFyYW0gb2JqXG4gICAgICogQHJldHVybnMge3N0cmluZ3xudWxsfSBBbiBlcnJvciBtZXNzYWdlIG9yIG51bGxcbiAgICAgKiBAY2xhc3MgT25lVG9NYW55UHJveHlcbiAgICAgKi9cbiAgICB2YWxpZGF0ZTogZnVuY3Rpb24gKG9iaikge1xuICAgICAgICB2YXIgc3RyID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKG9iaik7XG4gICAgICAgIGlmICh0aGlzLmlzRm9yd2FyZCkge1xuICAgICAgICAgICAgaWYgKHN0ciA9PSAnW29iamVjdCBBcnJheV0nKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuICdDYW5ub3QgYXNzaWduIGFycmF5IGZvcndhcmQgb25lVG9NYW55ICgnICsgc3RyICsgJyk6ICcgKyB0aGlzLmZvcndhcmROYW1lO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgaWYgKHN0ciAhPSAnW29iamVjdCBBcnJheV0nKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuICdDYW5ub3Qgc2NhbGFyIHRvIHJldmVyc2Ugb25lVG9NYW55ICgnICsgc3RyICsgJyk6ICcgKyB0aGlzLnJldmVyc2VOYW1lO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbiAob2JqLCBvcHRzKSB7XG4gICAgICAgIHRoaXMuY2hlY2tJbnN0YWxsZWQoKTtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICBpZiAob2JqKSB7XG4gICAgICAgICAgICB2YXIgZXJyb3JNZXNzYWdlO1xuICAgICAgICAgICAgaWYgKGVycm9yTWVzc2FnZSA9IHRoaXMudmFsaWRhdGUob2JqKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBlcnJvck1lc3NhZ2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLmNsZWFyUmV2ZXJzZVJlbGF0ZWQob3B0cyk7XG4gICAgICAgICAgICAgICAgc2VsZi5zZXRJZEFuZFJlbGF0ZWQob2JqLCBvcHRzKTtcbiAgICAgICAgICAgICAgICBpZiAoc2VsZi5pc1JldmVyc2UpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy53cmFwQXJyYXkoc2VsZi5yZWxhdGVkKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgc2VsZi5zZXRJZEFuZFJlbGF0ZWRSZXZlcnNlKG9iaiwgb3B0cyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmNsZWFyUmV2ZXJzZVJlbGF0ZWQob3B0cyk7XG4gICAgICAgICAgICBzZWxmLnNldElkQW5kUmVsYXRlZChvYmosIG9wdHMpO1xuICAgICAgICB9XG4gICAgfSxcbiAgICBpbnN0YWxsOiBmdW5jdGlvbiAob2JqKSB7XG4gICAgICAgIFJlbGF0aW9uc2hpcFByb3h5LnByb3RvdHlwZS5pbnN0YWxsLmNhbGwodGhpcywgb2JqKTtcblxuICAgICAgICBpZiAodGhpcy5pc1JldmVyc2UpIHtcbiAgICAgICAgICAgIG9ialsoJ3NwbGljZScgKyB1dGlsLmNhcGl0YWxpc2VGaXJzdExldHRlcih0aGlzLnJldmVyc2VOYW1lKSldID0gXy5iaW5kKHRoaXMuc3BsaWNlLCB0aGlzKTtcbiAgICAgICAgICAgIHRoaXMud3JhcEFycmF5KHRoaXMucmVsYXRlZCk7XG4gICAgICAgIH1cblxuICAgIH1cbn0pO1xuXG5cbm1vZHVsZS5leHBvcnRzID0gT25lVG9NYW55UHJveHk7IiwiLyoqXG4gKiBAbW9kdWxlIHJlbGF0aW9uc2hpcHNcbiAqL1xuXG52YXIgUmVsYXRpb25zaGlwUHJveHkgPSByZXF1aXJlKCcuL1JlbGF0aW9uc2hpcFByb3h5JyksXG4gICAgU3RvcmUgPSByZXF1aXJlKCcuL3N0b3JlJyksXG4gICAgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpLFxuICAgIF8gPSB1dGlsLl8sXG4gICAgSW50ZXJuYWxTaWVzdGFFcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKS5JbnRlcm5hbFNpZXN0YUVycm9yLFxuICAgIE1vZGVsRXZlbnRUeXBlID0gcmVxdWlyZSgnLi9tb2RlbEV2ZW50cycpLk1vZGVsRXZlbnRUeXBlLFxuICAgIFNpZXN0YU1vZGVsID0gcmVxdWlyZSgnLi9tb2RlbEluc3RhbmNlJyk7XG5cbi8qKlxuICogW09uZVRvT25lUHJveHkgZGVzY3JpcHRpb25dXG4gKiBAcGFyYW0ge09iamVjdH0gb3B0c1xuICovXG5mdW5jdGlvbiBPbmVUb09uZVByb3h5KG9wdHMpIHtcbiAgICBSZWxhdGlvbnNoaXBQcm94eS5jYWxsKHRoaXMsIG9wdHMpO1xufVxuXG5cbk9uZVRvT25lUHJveHkucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShSZWxhdGlvbnNoaXBQcm94eS5wcm90b3R5cGUpO1xuXG5fLmV4dGVuZChPbmVUb09uZVByb3h5LnByb3RvdHlwZSwge1xuICAgIC8qKlxuICAgICAqIFZhbGlkYXRlIHRoZSBvYmplY3QgdGhhdCB3ZSdyZSBzZXR0aW5nXG4gICAgICogQHBhcmFtIG9ialxuICAgICAqIEByZXR1cm5zIHtzdHJpbmd8bnVsbH0gQW4gZXJyb3IgbWVzc2FnZSBvciBudWxsXG4gICAgICovXG4gICAgdmFsaWRhdGU6IGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgaWYgKE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChvYmopID09ICdbb2JqZWN0IEFycmF5XScpIHtcbiAgICAgICAgICAgIHJldHVybiAnQ2Fubm90IGFzc2lnbiBhcnJheSB0byBvbmUgdG8gb25lIHJlbGF0aW9uc2hpcCc7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoKCFvYmogaW5zdGFuY2VvZiBTaWVzdGFNb2RlbCkpIHtcblxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbiAob2JqLCBvcHRzKSB7XG4gICAgICAgIHRoaXMuY2hlY2tJbnN0YWxsZWQoKTtcbiAgICAgICAgaWYgKG9iaikge1xuICAgICAgICAgICAgdmFyIGVycm9yTWVzc2FnZTtcbiAgICAgICAgICAgIGlmIChlcnJvck1lc3NhZ2UgPSB0aGlzLnZhbGlkYXRlKG9iaikpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZXJyb3JNZXNzYWdlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5jbGVhclJldmVyc2VSZWxhdGVkKG9wdHMpO1xuICAgICAgICAgICAgICAgIHRoaXMuc2V0SWRBbmRSZWxhdGVkKG9iaiwgb3B0cyk7XG4gICAgICAgICAgICAgICAgdGhpcy5zZXRJZEFuZFJlbGF0ZWRSZXZlcnNlKG9iaiwgb3B0cyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmNsZWFyUmV2ZXJzZVJlbGF0ZWQob3B0cyk7XG4gICAgICAgICAgICB0aGlzLnNldElkQW5kUmVsYXRlZChvYmosIG9wdHMpO1xuICAgICAgICB9XG4gICAgfSxcbiAgICBnZXQ6IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgICAgICB2YXIgZGVmZXJyZWQgPSB1dGlsLmRlZmVyKGNhbGxiYWNrKTtcbiAgICAgICAgY2FsbGJhY2sgPSBkZWZlcnJlZC5maW5pc2guYmluZChkZWZlcnJlZCk7XG4gICAgICAgIGNhbGxiYWNrKG51bGwsIHRoaXMucmVsYXRlZCk7XG4gICAgICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xuICAgIH1cbn0pO1xuXG5cbm1vZHVsZS5leHBvcnRzID0gT25lVG9PbmVQcm94eTsiLCIvKipcbiAqIEBtb2R1bGUgcXVlcnlcbiAqL1xuXG52YXIgbG9nID0gcmVxdWlyZSgnLi9sb2cnKSxcbiAgICBjYWNoZSA9IHJlcXVpcmUoJy4vY2FjaGUnKSxcbiAgICB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyksXG4gICAgZXJyb3IgPSByZXF1aXJlKCcuL2Vycm9yJyksXG4gICAgY29uc3RydWN0UXVlcnlTZXQgPSByZXF1aXJlKCcuL3F1ZXJ5U2V0JyksXG4gICAgY29uc3RydWN0RXJyb3IgPSBlcnJvci5lcnJvckZhY3RvcnkoZXJyb3IuQ29tcG9uZW50cy5RdWVyeSksXG4gICAgXyA9IHV0aWwuXztcblxudmFyIExvZ2dlciA9IGxvZy5sb2dnZXJXaXRoTmFtZSgnUXVlcnknKTtcblxuLyoqXG4gKiBAY2xhc3MgW1F1ZXJ5IGRlc2NyaXB0aW9uXVxuICogQHBhcmFtIHtNb2RlbH0gbW9kZWxcbiAqIEBwYXJhbSB7T2JqZWN0fSBxdWVyeVxuICovXG5mdW5jdGlvbiBRdWVyeShtb2RlbCwgcXVlcnkpIHtcbiAgICB2YXIgb3B0cyA9IHt9O1xuICAgIGZvciAodmFyIHByb3AgaW4gcXVlcnkpIHtcbiAgICAgICAgaWYgKHF1ZXJ5Lmhhc093blByb3BlcnR5KHByb3ApKSB7XG4gICAgICAgICAgICBpZiAocHJvcC5zbGljZSgwLCAyKSA9PSAnX18nKSB7XG4gICAgICAgICAgICAgICAgb3B0c1twcm9wLnNsaWNlKDIpXSA9IHF1ZXJ5W3Byb3BdO1xuICAgICAgICAgICAgICAgIGRlbGV0ZSBxdWVyeVtwcm9wXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbiAgICBfLmV4dGVuZCh0aGlzLCB7XG4gICAgICAgIG1vZGVsOiBtb2RlbCxcbiAgICAgICAgcXVlcnk6IHF1ZXJ5LFxuICAgICAgICBvcHRzOiBvcHRzXG4gICAgfSk7XG4gICAgb3B0cy5vcmRlciA9IG9wdHMub3JkZXIgfHwgW107XG4gICAgaWYgKCF1dGlsLmlzQXJyYXkob3B0cy5vcmRlcikpIG9wdHMub3JkZXIgPSBbb3B0cy5vcmRlcl07XG59XG5cbl8uZXh0ZW5kKFF1ZXJ5LCB7XG4gICAgY29tcGFyYXRvcnM6IHtcbiAgICAgICAgZTogZnVuY3Rpb24gKG9wdHMpIHtcbiAgICAgICAgICAgIHZhciBvYmplY3RWYWx1ZSA9IG9wdHMub2JqZWN0W29wdHMuZmllbGRdO1xuICAgICAgICAgICAgaWYgKExvZ2dlci50cmFjZSkge1xuICAgICAgICAgICAgICAgIHZhciBzdHJpbmdWYWx1ZTtcbiAgICAgICAgICAgICAgICBpZiAob2JqZWN0VmFsdWUgPT09IG51bGwpIHN0cmluZ1ZhbHVlID0gJ251bGwnO1xuICAgICAgICAgICAgICAgIGVsc2UgaWYgKG9iamVjdFZhbHVlID09PSB1bmRlZmluZWQpIHN0cmluZ1ZhbHVlID0gJ3VuZGVmaW5lZCc7XG4gICAgICAgICAgICAgICAgZWxzZSBzdHJpbmdWYWx1ZSA9IG9iamVjdFZhbHVlLnRvU3RyaW5nKCk7XG4gICAgICAgICAgICAgICAgTG9nZ2VyLnRyYWNlKG9wdHMuZmllbGQgKyAnOiAnICsgc3RyaW5nVmFsdWUgKyAnID09ICcgKyBvcHRzLnZhbHVlLnRvU3RyaW5nKCkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIG9iamVjdFZhbHVlID09IG9wdHMudmFsdWU7XG4gICAgICAgIH0sXG4gICAgICAgIGx0OiBmdW5jdGlvbiAob3B0cykge1xuICAgICAgICAgICAgaWYgKCFvcHRzLmludmFsaWQpIHJldHVybiBvcHRzLm9iamVjdFtvcHRzLmZpZWxkXSA8IG9wdHMudmFsdWU7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH0sXG4gICAgICAgIGd0OiBmdW5jdGlvbiAob3B0cykge1xuICAgICAgICAgICAgaWYgKCFvcHRzLmludmFsaWQpIHJldHVybiBvcHRzLm9iamVjdFtvcHRzLmZpZWxkXSA+IG9wdHMudmFsdWU7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH0sXG4gICAgICAgIGx0ZTogZnVuY3Rpb24gKG9wdHMpIHtcbiAgICAgICAgICAgIGlmICghb3B0cy5pbnZhbGlkKSByZXR1cm4gb3B0cy5vYmplY3Rbb3B0cy5maWVsZF0gPD0gb3B0cy52YWx1ZTtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfSxcbiAgICAgICAgZ3RlOiBmdW5jdGlvbiAob3B0cykge1xuICAgICAgICAgICAgaWYgKCFvcHRzLmludmFsaWQpIHJldHVybiBvcHRzLm9iamVjdFtvcHRzLmZpZWxkXSA+PSBvcHRzLnZhbHVlO1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9LFxuICAgICAgICBjb250YWluczogZnVuY3Rpb24gKG9wdHMpIHtcbiAgICAgICAgICAgIGlmICghb3B0cy5pbnZhbGlkKSByZXR1cm4gb3B0cy5vYmplY3Rbb3B0cy5maWVsZF0uaW5kZXhPZihvcHRzLnZhbHVlKSA+IC0xO1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgfSxcbiAgICByZWdpc3RlckNvbXBhcmF0b3I6IGZ1bmN0aW9uIChzeW1ib2wsIGZuKSB7XG4gICAgICAgIGlmICghdGhpcy5jb21wYXJhdG9yc1tzeW1ib2xdKVxuICAgICAgICAgICAgdGhpcy5jb21wYXJhdG9yc1tzeW1ib2xdID0gZm47XG4gICAgfVxufSk7XG5cbmZ1bmN0aW9uIGNhY2hlRm9yTW9kZWwobW9kZWwpIHtcbiAgICB2YXIgY2FjaGVCeVR5cGUgPSBjYWNoZS5fbG9jYWxDYWNoZUJ5VHlwZTtcbiAgICB2YXIgbW9kZWxOYW1lID0gbW9kZWwubmFtZTtcbiAgICB2YXIgY29sbGVjdGlvbk5hbWUgPSBtb2RlbC5jb2xsZWN0aW9uTmFtZTtcbiAgICB2YXIgY2FjaGVCeU1vZGVsID0gY2FjaGVCeVR5cGVbY29sbGVjdGlvbk5hbWVdO1xuICAgIHZhciBjYWNoZUJ5TG9jYWxJZDtcbiAgICBpZiAoY2FjaGVCeU1vZGVsKSB7XG4gICAgICAgIGNhY2hlQnlMb2NhbElkID0gY2FjaGVCeU1vZGVsW21vZGVsTmFtZV0gfHwge307XG4gICAgfVxuICAgIHJldHVybiBjYWNoZUJ5TG9jYWxJZDtcbn1cblxuXy5leHRlbmQoUXVlcnkucHJvdG90eXBlLCB7XG4gICAgZXhlY3V0ZTogZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgICAgIHZhciBkZWZlcnJlZCA9IHV0aWwuZGVmZXIoY2FsbGJhY2spO1xuICAgICAgICBjYWxsYmFjayA9IGRlZmVycmVkLmZpbmlzaC5iaW5kKGRlZmVycmVkKTtcbiAgICAgICAgdGhpcy5fZXhlY3V0ZUluTWVtb3J5KGNhbGxiYWNrKTtcbiAgICAgICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG4gICAgfSxcbiAgICBfZHVtcDogZnVuY3Rpb24gKGFzSnNvbikge1xuICAgICAgICByZXR1cm4gYXNKc29uID8gJ3t9JyA6IHt9O1xuICAgIH0sXG4gICAgc29ydEZ1bmM6IGZ1bmN0aW9uIChmaWVsZHMpIHtcbiAgICAgICAgdmFyIHNvcnRGdW5jID0gZnVuY3Rpb24gKGFzY2VuZGluZywgZmllbGQpIHtcbiAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbiAodjEsIHYyKSB7XG4gICAgICAgICAgICAgICAgdmFyIGQxID0gdjFbZmllbGRdLFxuICAgICAgICAgICAgICAgICAgICBkMiA9IHYyW2ZpZWxkXSxcbiAgICAgICAgICAgICAgICAgICAgcmVzO1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgZDEgPT0gJ3N0cmluZycgfHwgZDEgaW5zdGFuY2VvZiBTdHJpbmcgJiZcbiAgICAgICAgICAgICAgICAgICAgdHlwZW9mIGQyID09ICdzdHJpbmcnIHx8IGQyIGluc3RhbmNlb2YgU3RyaW5nKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlcyA9IGFzY2VuZGluZyA/IGQxLmxvY2FsZUNvbXBhcmUoZDIpIDogZDIubG9jYWxlQ29tcGFyZShkMSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZDEgaW5zdGFuY2VvZiBEYXRlKSBkMSA9IGQxLmdldFRpbWUoKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGQyIGluc3RhbmNlb2YgRGF0ZSkgZDIgPSBkMi5nZXRUaW1lKCk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChhc2NlbmRpbmcpIHJlcyA9IGQxIC0gZDI7XG4gICAgICAgICAgICAgICAgICAgIGVsc2UgcmVzID0gZDIgLSBkMTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlcztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgdmFyIHMgPSB1dGlsO1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGZpZWxkcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdmFyIGZpZWxkID0gZmllbGRzW2ldO1xuICAgICAgICAgICAgcyA9IHMudGhlbkJ5KHNvcnRGdW5jKGZpZWxkLmFzY2VuZGluZywgZmllbGQuZmllbGQpKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcyA9PSB1dGlsID8gbnVsbCA6IHM7XG4gICAgfSxcbiAgICBfc29ydFJlc3VsdHM6IGZ1bmN0aW9uIChyZXMpIHtcbiAgICAgICAgdmFyIG9yZGVyID0gdGhpcy5vcHRzLm9yZGVyO1xuICAgICAgICBpZiAocmVzICYmIG9yZGVyKSB7XG4gICAgICAgICAgICB2YXIgZmllbGRzID0gXy5tYXAob3JkZXIsIGZ1bmN0aW9uIChvcmRlcmluZykge1xuICAgICAgICAgICAgICAgIHZhciBzcGx0ID0gb3JkZXJpbmcuc3BsaXQoJy0nKSxcbiAgICAgICAgICAgICAgICAgICAgYXNjZW5kaW5nID0gdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgZmllbGQgPSBudWxsO1xuICAgICAgICAgICAgICAgIGlmIChzcGx0Lmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgZmllbGQgPSBzcGx0WzFdO1xuICAgICAgICAgICAgICAgICAgICBhc2NlbmRpbmcgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGZpZWxkID0gc3BsdFswXTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIHtmaWVsZDogZmllbGQsIGFzY2VuZGluZzogYXNjZW5kaW5nfTtcbiAgICAgICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICAgICAgICB2YXIgc29ydEZ1bmMgPSB0aGlzLnNvcnRGdW5jKGZpZWxkcyk7XG4gICAgICAgICAgICBpZiAocmVzLmltbXV0YWJsZSkgcmVzID0gcmVzLm11dGFibGVDb3B5KCk7XG4gICAgICAgICAgICBpZiAoc29ydEZ1bmMpIHJlcy5zb3J0KHNvcnRGdW5jKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzO1xuICAgIH0sXG4gICAgLyoqXG4gICAgICogUmV0dXJuIGFsbCBtb2RlbCBpbnN0YW5jZXMgaW4gdGhlIGNhY2hlLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2dldENhY2hlQnlMb2NhbElkOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiBfLnJlZHVjZSh0aGlzLm1vZGVsLmRlc2NlbmRhbnRzLCBmdW5jdGlvbiAobWVtbywgY2hpbGRNb2RlbCkge1xuICAgICAgICAgICAgcmV0dXJuIF8uZXh0ZW5kKG1lbW8sIGNhY2hlRm9yTW9kZWwoY2hpbGRNb2RlbCkpO1xuICAgICAgICB9LCBfLmV4dGVuZCh7fSwgY2FjaGVGb3JNb2RlbCh0aGlzLm1vZGVsKSkpO1xuICAgIH0sXG4gICAgX2V4ZWN1dGVJbk1lbW9yeTogZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgICAgIHZhciBfZXhlY3V0ZUluTWVtb3J5ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdmFyIGNhY2hlQnlMb2NhbElkID0gdGhpcy5fZ2V0Q2FjaGVCeUxvY2FsSWQoKTtcbiAgICAgICAgICAgIHZhciBrZXlzID0gT2JqZWN0LmtleXMoY2FjaGVCeUxvY2FsSWQpO1xuICAgICAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICAgICAgdmFyIHJlcyA9IFtdO1xuICAgICAgICAgICAgdmFyIGVycjtcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwga2V5cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIHZhciBrID0ga2V5c1tpXTtcbiAgICAgICAgICAgICAgICB2YXIgb2JqID0gY2FjaGVCeUxvY2FsSWRba107XG4gICAgICAgICAgICAgICAgdmFyIG1hdGNoZXMgPSBzZWxmLm9iamVjdE1hdGNoZXNRdWVyeShvYmopO1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YobWF0Y2hlcykgPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICAgICAgZXJyID0gY29uc3RydWN0RXJyb3IobWF0Y2hlcyk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChtYXRjaGVzKSByZXMucHVzaChvYmopO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJlcyA9IHRoaXMuX3NvcnRSZXN1bHRzKHJlcyk7XG4gICAgICAgICAgICBjYWxsYmFjayhlcnIsIGVyciA/IG51bGwgOiBjb25zdHJ1Y3RRdWVyeVNldChyZXMsIHRoaXMubW9kZWwpKTtcbiAgICAgICAgfS5iaW5kKHRoaXMpO1xuICAgICAgICBpZiAodGhpcy5vcHRzLmlnbm9yZUluc3RhbGxlZCkge1xuICAgICAgICAgICAgX2V4ZWN1dGVJbk1lbW9yeSgpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgc2llc3RhLl9hZnRlckluc3RhbGwoX2V4ZWN1dGVJbk1lbW9yeSk7XG4gICAgICAgIH1cblxuICAgIH0sXG4gICAgY2xlYXJPcmRlcmluZzogZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLm9wdHMub3JkZXIgPSBudWxsO1xuICAgIH0sXG4gICAgb2JqZWN0TWF0Y2hlc09yUXVlcnk6IGZ1bmN0aW9uIChvYmosIG9yUXVlcnkpIHtcbiAgICAgICAgZm9yICh2YXIgaWR4IGluIG9yUXVlcnkpIHtcbiAgICAgICAgICAgIGlmIChvclF1ZXJ5Lmhhc093blByb3BlcnR5KGlkeCkpIHtcbiAgICAgICAgICAgICAgICB2YXIgcXVlcnkgPSBvclF1ZXJ5W2lkeF07XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMub2JqZWN0TWF0Y2hlc0Jhc2VRdWVyeShvYmosIHF1ZXJ5KSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH0sXG4gICAgb2JqZWN0TWF0Y2hlc0FuZFF1ZXJ5OiBmdW5jdGlvbiAob2JqLCBhbmRRdWVyeSkge1xuICAgICAgICBmb3IgKHZhciBpZHggaW4gYW5kUXVlcnkpIHtcbiAgICAgICAgICAgIGlmIChhbmRRdWVyeS5oYXNPd25Qcm9wZXJ0eShpZHgpKSB7XG4gICAgICAgICAgICAgICAgdmFyIHF1ZXJ5ID0gYW5kUXVlcnlbaWR4XTtcbiAgICAgICAgICAgICAgICBpZiAoIXRoaXMub2JqZWN0TWF0Y2hlc0Jhc2VRdWVyeShvYmosIHF1ZXJ5KSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH0sXG4gICAgc3BsaXRNYXRjaGVzOiBmdW5jdGlvbiAob2JqLCB1bnByb2Nlc3NlZEZpZWxkLCB2YWx1ZSkge1xuICAgICAgICB2YXIgb3AgPSAnZSc7XG4gICAgICAgIHZhciBmaWVsZHMgPSB1bnByb2Nlc3NlZEZpZWxkLnNwbGl0KCcuJyk7XG4gICAgICAgIHZhciBzcGx0ID0gZmllbGRzW2ZpZWxkcy5sZW5ndGggLSAxXS5zcGxpdCgnX18nKTtcbiAgICAgICAgaWYgKHNwbHQubGVuZ3RoID09IDIpIHtcbiAgICAgICAgICAgIHZhciBmaWVsZCA9IHNwbHRbMF07XG4gICAgICAgICAgICBvcCA9IHNwbHRbMV07XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBmaWVsZCA9IHNwbHRbMF07XG4gICAgICAgIH1cbiAgICAgICAgZmllbGRzW2ZpZWxkcy5sZW5ndGggLSAxXSA9IGZpZWxkO1xuICAgICAgICBfLmVhY2goZmllbGRzLnNsaWNlKDAsIGZpZWxkcy5sZW5ndGggLSAxKSwgZnVuY3Rpb24gKGYpIHtcbiAgICAgICAgICAgIG9iaiA9IG9ialtmXTtcbiAgICAgICAgfSk7XG4gICAgICAgIHZhciB2YWwgPSBvYmpbZmllbGRdO1xuICAgICAgICB2YXIgaW52YWxpZCA9IHZhbCA9PT0gbnVsbCB8fCB2YWwgPT09IHVuZGVmaW5lZDtcbiAgICAgICAgdmFyIGNvbXBhcmF0b3IgPSBRdWVyeS5jb21wYXJhdG9yc1tvcF0sXG4gICAgICAgICAgICBvcHRzID0ge29iamVjdDogb2JqLCBmaWVsZDogZmllbGQsIHZhbHVlOiB2YWx1ZSwgaW52YWxpZDogaW52YWxpZH07XG4gICAgICAgIGlmICghY29tcGFyYXRvcikge1xuICAgICAgICAgICAgcmV0dXJuICdObyBjb21wYXJhdG9yIHJlZ2lzdGVyZWQgZm9yIHF1ZXJ5IG9wZXJhdGlvbiBcIicgKyBvcCArICdcIic7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGNvbXBhcmF0b3Iob3B0cyk7XG4gICAgfSxcbiAgICBvYmplY3RNYXRjaGVzOiBmdW5jdGlvbiAob2JqLCB1bnByb2Nlc3NlZEZpZWxkLCB2YWx1ZSwgcXVlcnkpIHtcbiAgICAgICAgaWYgKHVucHJvY2Vzc2VkRmllbGQgPT0gJyRvcicpIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5vYmplY3RNYXRjaGVzT3JRdWVyeShvYmosIHF1ZXJ5Wyckb3InXSkpIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmICh1bnByb2Nlc3NlZEZpZWxkID09ICckYW5kJykge1xuICAgICAgICAgICAgaWYgKCF0aGlzLm9iamVjdE1hdGNoZXNBbmRRdWVyeShvYmosIHF1ZXJ5WyckYW5kJ10pKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICB2YXIgbWF0Y2hlcyA9IHRoaXMuc3BsaXRNYXRjaGVzKG9iaiwgdW5wcm9jZXNzZWRGaWVsZCwgdmFsdWUpO1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBtYXRjaGVzICE9ICdib29sZWFuJykgcmV0dXJuIG1hdGNoZXM7XG4gICAgICAgICAgICBpZiAoIW1hdGNoZXMpIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9LFxuICAgIG9iamVjdE1hdGNoZXNCYXNlUXVlcnk6IGZ1bmN0aW9uIChvYmosIHF1ZXJ5KSB7XG4gICAgICAgIHZhciBmaWVsZHMgPSBPYmplY3Qua2V5cyhxdWVyeSk7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgZmllbGRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB2YXIgdW5wcm9jZXNzZWRGaWVsZCA9IGZpZWxkc1tpXSxcbiAgICAgICAgICAgICAgICB2YWx1ZSA9IHF1ZXJ5W3VucHJvY2Vzc2VkRmllbGRdO1xuICAgICAgICAgICAgdmFyIHJ0ID0gdGhpcy5vYmplY3RNYXRjaGVzKG9iaiwgdW5wcm9jZXNzZWRGaWVsZCwgdmFsdWUsIHF1ZXJ5KTtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgcnQgIT0gJ2Jvb2xlYW4nKSByZXR1cm4gcnQ7XG4gICAgICAgICAgICBpZiAoIXJ0KSByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSxcbiAgICBvYmplY3RNYXRjaGVzUXVlcnk6IGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgcmV0dXJuIHRoaXMub2JqZWN0TWF0Y2hlc0Jhc2VRdWVyeShvYmosIHRoaXMucXVlcnkpO1xuICAgIH1cbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFF1ZXJ5OyIsIi8qKlxuICogQmFzZSBmdW5jdGlvbmFsaXR5IGZvciByZWxhdGlvbnNoaXBzLlxuICogQG1vZHVsZSByZWxhdGlvbnNoaXBzXG4gKi9cblxudmFyIEludGVybmFsU2llc3RhRXJyb3IgPSByZXF1aXJlKCcuL2Vycm9yJykuSW50ZXJuYWxTaWVzdGFFcnJvcixcbiAgICBTdG9yZSA9IHJlcXVpcmUoJy4vc3RvcmUnKSxcbiAgICB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyksXG4gICAgXyA9IHV0aWwuXyxcbiAgICBRdWVyeSA9IHJlcXVpcmUoJy4vcXVlcnknKSxcbiAgICBsb2cgPSByZXF1aXJlKCcuL2xvZycpLFxuICAgIGNhY2hlID0gcmVxdWlyZSgnLi9jYWNoZScpLFxuICAgIGV2ZW50cyA9IHJlcXVpcmUoJy4vZXZlbnRzJyksXG4gICAgd3JhcEFycmF5Rm9yQXR0cmlidXRlcyA9IGV2ZW50cy53cmFwQXJyYXksXG4gICAgQXJyYXlPYnNlcnZlciA9IHJlcXVpcmUoJy4uL3ZlbmRvci9vYnNlcnZlLWpzL3NyYy9vYnNlcnZlJykuQXJyYXlPYnNlcnZlcixcbiAgICBtb2RlbEV2ZW50cyA9IHJlcXVpcmUoJy4vbW9kZWxFdmVudHMnKSxcbiAgICBNb2RlbEV2ZW50VHlwZSA9IG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlO1xuXG4vKipcbiAqIEBjbGFzcyAgW1JlbGF0aW9uc2hpcFByb3h5IGRlc2NyaXB0aW9uXVxuICogQHBhcmFtIHtPYmplY3R9IG9wdHNcbiAqIEBjb25zdHJ1Y3RvclxuICovXG5mdW5jdGlvbiBSZWxhdGlvbnNoaXBQcm94eShvcHRzKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIG9wdHMgPSBvcHRzIHx8IHt9O1xuXG4gICAgXy5leHRlbmQodGhpcywge1xuICAgICAgICBvYmplY3Q6IG51bGwsXG4gICAgICAgIHJlbGF0ZWQ6IG51bGxcbiAgICB9KTtcblxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKHRoaXMsIHtcbiAgICAgICAgaXNGb3J3YXJkOiB7XG4gICAgICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gIXNlbGYuaXNSZXZlcnNlO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHNldDogZnVuY3Rpb24gKHYpIHtcbiAgICAgICAgICAgICAgICBzZWxmLmlzUmV2ZXJzZSA9ICF2O1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgdXRpbC5leHRlbmRGcm9tT3B0cyh0aGlzLCBvcHRzLCB7XG4gICAgICAgIHJldmVyc2VNb2RlbDogbnVsbCxcbiAgICAgICAgZm9yd2FyZE1vZGVsOiBudWxsLFxuICAgICAgICBmb3J3YXJkTmFtZTogbnVsbCxcbiAgICAgICAgcmV2ZXJzZU5hbWU6IG51bGwsXG4gICAgICAgIGlzUmV2ZXJzZTogbnVsbFxuICAgIH0pO1xuXG4gICAgdGhpcy5jYW5jZWxMaXN0ZW5zID0ge307XG59XG5cbl8uZXh0ZW5kKFJlbGF0aW9uc2hpcFByb3h5LCB7fSk7XG5cbl8uZXh0ZW5kKFJlbGF0aW9uc2hpcFByb3h5LnByb3RvdHlwZSwge1xuICAgIC8qKlxuICAgICAqIEluc3RhbGwgdGhpcyBwcm94eSBvbiB0aGUgZ2l2ZW4gaW5zdGFuY2VcbiAgICAgKiBAcGFyYW0ge01vZGVsSW5zdGFuY2V9IG1vZGVsSW5zdGFuY2VcbiAgICAgKi9cbiAgICBpbnN0YWxsOiBmdW5jdGlvbiAobW9kZWxJbnN0YW5jZSkge1xuICAgICAgICBpZiAobW9kZWxJbnN0YW5jZSkge1xuICAgICAgICAgICAgaWYgKCF0aGlzLm9iamVjdCkge1xuICAgICAgICAgICAgICAgIHRoaXMub2JqZWN0ID0gbW9kZWxJbnN0YW5jZTtcbiAgICAgICAgICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgICAgICAgICAgdmFyIG5hbWUgPSB0aGlzLmdldEZvcndhcmROYW1lKCk7XG4gICAgICAgICAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG1vZGVsSW5zdGFuY2UsIG5hbWUsIHtcbiAgICAgICAgICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gc2VsZi5yZWxhdGVkO1xuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICBzZXQ6IGZ1bmN0aW9uICh2KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzZWxmLnNldCh2KTtcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgaWYgKCFtb2RlbEluc3RhbmNlLl9fcHJveGllcykgbW9kZWxJbnN0YW5jZS5fX3Byb3hpZXMgPSB7fTtcbiAgICAgICAgICAgICAgICBtb2RlbEluc3RhbmNlLl9fcHJveGllc1tuYW1lXSA9IHRoaXM7XG4gICAgICAgICAgICAgICAgaWYgKCFtb2RlbEluc3RhbmNlLl9wcm94aWVzKSB7XG4gICAgICAgICAgICAgICAgICAgIG1vZGVsSW5zdGFuY2UuX3Byb3hpZXMgPSBbXTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgbW9kZWxJbnN0YW5jZS5fcHJveGllcy5wdXNoKHRoaXMpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignQWxyZWFkeSBpbnN0YWxsZWQuJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignTm8gb2JqZWN0IHBhc3NlZCB0byByZWxhdGlvbnNoaXAgaW5zdGFsbCcpO1xuICAgICAgICB9XG4gICAgfVxuXG59KTtcblxuLy9ub2luc3BlY3Rpb24gSlNVbnVzZWRMb2NhbFN5bWJvbHNcbl8uZXh0ZW5kKFJlbGF0aW9uc2hpcFByb3h5LnByb3RvdHlwZSwge1xuICAgIHNldDogZnVuY3Rpb24gKG9iaiwgb3B0cykge1xuICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignTXVzdCBzdWJjbGFzcyBSZWxhdGlvbnNoaXBQcm94eScpO1xuICAgIH0sXG4gICAgZ2V0OiBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ011c3Qgc3ViY2xhc3MgUmVsYXRpb25zaGlwUHJveHknKTtcbiAgICB9XG59KTtcblxuXy5leHRlbmQoUmVsYXRpb25zaGlwUHJveHkucHJvdG90eXBlLCB7XG4gICAgcHJveHlGb3JJbnN0YW5jZTogZnVuY3Rpb24gKG1vZGVsSW5zdGFuY2UsIHJldmVyc2UpIHtcbiAgICAgICAgdmFyIG5hbWUgPSByZXZlcnNlID8gdGhpcy5nZXRSZXZlcnNlTmFtZSgpIDogdGhpcy5nZXRGb3J3YXJkTmFtZSgpLFxuICAgICAgICAgICAgbW9kZWwgPSByZXZlcnNlID8gdGhpcy5yZXZlcnNlTW9kZWwgOiB0aGlzLmZvcndhcmRNb2RlbDtcbiAgICAgICAgdmFyIHJldDtcbiAgICAgICAgLy8gVGhpcyBzaG91bGQgbmV2ZXIgaGFwcGVuLiBTaG91bGQgZyAgIGV0IGNhdWdodCBpbiB0aGUgbWFwcGluZyBvcGVyYXRpb24/XG4gICAgICAgIGlmICh1dGlsLmlzQXJyYXkobW9kZWxJbnN0YW5jZSkpIHtcbiAgICAgICAgICAgIHJldCA9IF8ubWFwKG1vZGVsSW5zdGFuY2UsIGZ1bmN0aW9uIChvKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG8uX19wcm94aWVzW25hbWVdO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB2YXIgcHJveHkgPSBtb2RlbEluc3RhbmNlLl9fcHJveGllc1tuYW1lXTtcbiAgICAgICAgICAgIGlmICghcHJveHkpIHtcbiAgICAgICAgICAgICAgICB2YXIgZXJyID0gJ05vIHByb3h5IHdpdGggbmFtZSBcIicgKyBuYW1lICsgJ1wiIG9uIG1hcHBpbmcgJyArIG1vZGVsLm5hbWU7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoZXJyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldCA9IHByb3h5O1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXQ7XG4gICAgfSxcbiAgICByZXZlcnNlUHJveHlGb3JJbnN0YW5jZTogZnVuY3Rpb24gKG1vZGVsSW5zdGFuY2UpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMucHJveHlGb3JJbnN0YW5jZShtb2RlbEluc3RhbmNlLCB0cnVlKTtcbiAgICB9LFxuICAgIGdldFJldmVyc2VOYW1lOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmlzRm9yd2FyZCA/IHRoaXMucmV2ZXJzZU5hbWUgOiB0aGlzLmZvcndhcmROYW1lO1xuICAgIH0sXG4gICAgZ2V0Rm9yd2FyZE5hbWU6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuaXNGb3J3YXJkID8gdGhpcy5mb3J3YXJkTmFtZSA6IHRoaXMucmV2ZXJzZU5hbWU7XG4gICAgfSxcbiAgICBnZXRGb3J3YXJkTW9kZWw6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuaXNGb3J3YXJkID8gdGhpcy5mb3J3YXJkTW9kZWwgOiB0aGlzLnJldmVyc2VNb2RlbDtcbiAgICB9LFxuICAgIGNsZWFyUmVtb3ZhbExpc3RlbmVyOiBmdW5jdGlvbiAob2JqKSB7XG4gICAgICAgIHZhciBfaWQgPSBvYmouX2lkO1xuICAgICAgICB2YXIgY2FuY2VsTGlzdGVuID0gdGhpcy5jYW5jZWxMaXN0ZW5zW19pZF07XG4gICAgICAgIC8vIFRPRE86IFJlbW92ZSB0aGlzIGNoZWNrLiBjYW5jZWxMaXN0ZW4gc2hvdWxkIGFsd2F5cyBleGlzdFxuICAgICAgICBpZiAoY2FuY2VsTGlzdGVuKSB7XG4gICAgICAgICAgICBjYW5jZWxMaXN0ZW4oKTtcbiAgICAgICAgICAgIHRoaXMuY2FuY2VsTGlzdGVuc1tfaWRdID0gbnVsbDtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgbGlzdGVuRm9yUmVtb3ZhbDogZnVuY3Rpb24gKG9iaikge1xuICAgICAgICB0aGlzLmNhbmNlbExpc3RlbnNbb2JqLl9pZF0gPSBvYmoubGlzdGVuKGZ1bmN0aW9uIChlKSB7XG4gICAgICAgICAgICBpZiAoZS50eXBlID09IE1vZGVsRXZlbnRUeXBlLlJlbW92ZSkge1xuICAgICAgICAgICAgICAgIGlmICh1dGlsLmlzQXJyYXkodGhpcy5yZWxhdGVkKSkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgaWR4ID0gdGhpcy5yZWxhdGVkLmluZGV4T2Yob2JqKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zcGxpY2UoaWR4LCAxKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc2V0SWRBbmRSZWxhdGVkKG51bGwpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB0aGlzLmNsZWFyUmVtb3ZhbExpc3RlbmVyKG9iaik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBDb25maWd1cmUgX2lkIGFuZCByZWxhdGVkIHdpdGggdGhlIG5ldyByZWxhdGVkIG9iamVjdC5cbiAgICAgKiBAcGFyYW0gb2JqXG4gICAgICogQHBhcmFtIHtvYmplY3R9IFtvcHRzXVxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdHMuZGlzYWJsZU5vdGlmaWNhdGlvbnNdXG4gICAgICogQHJldHVybnMge1N0cmluZ3x1bmRlZmluZWR9IC0gRXJyb3IgbWVzc2FnZSBvciB1bmRlZmluZWRcbiAgICAgKi9cbiAgICBzZXRJZEFuZFJlbGF0ZWQ6IGZ1bmN0aW9uIChvYmosIG9wdHMpIHtcbiAgICAgICAgb3B0cyA9IG9wdHMgfHwge307XG4gICAgICAgIGlmICghb3B0cy5kaXNhYmxlZXZlbnRzKSB7XG4gICAgICAgICAgICB0aGlzLnJlZ2lzdGVyU2V0Q2hhbmdlKG9iaik7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIHByZXZpb3VzbHlSZWxhdGVkID0gdGhpcy5yZWxhdGVkO1xuICAgICAgICBpZiAocHJldmlvdXNseVJlbGF0ZWQpIHRoaXMuY2xlYXJSZW1vdmFsTGlzdGVuZXIocHJldmlvdXNseVJlbGF0ZWQpO1xuICAgICAgICBpZiAob2JqKSB7XG4gICAgICAgICAgICBpZiAodXRpbC5pc0FycmF5KG9iaikpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnJlbGF0ZWQgPSBvYmo7XG4gICAgICAgICAgICAgICAgb2JqLmZvckVhY2goZnVuY3Rpb24gKF9vYmopIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5saXN0ZW5Gb3JSZW1vdmFsKF9vYmopO1xuICAgICAgICAgICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMucmVsYXRlZCA9IG9iajtcbiAgICAgICAgICAgICAgICB0aGlzLmxpc3RlbkZvclJlbW92YWwob2JqKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMucmVsYXRlZCA9IG51bGw7XG4gICAgICAgIH1cbiAgICB9LFxuICAgIGNoZWNrSW5zdGFsbGVkOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmICghdGhpcy5vYmplY3QpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdQcm94eSBtdXN0IGJlIGluc3RhbGxlZCBvbiBhbiBvYmplY3QgYmVmb3JlIGNhbiB1c2UgaXQuJyk7XG4gICAgICAgIH1cbiAgICB9LFxuICAgIHNwbGljZXI6IGZ1bmN0aW9uIChvcHRzKSB7XG4gICAgICAgIG9wdHMgPSBvcHRzIHx8IHt9O1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKGlkeCwgbnVtUmVtb3ZlKSB7XG4gICAgICAgICAgICBvcHRzID0gb3B0cyB8fCB7fTtcbiAgICAgICAgICAgIGlmICghb3B0cy5kaXNhYmxlZXZlbnRzKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5yZWdpc3RlclNwbGljZUNoYW5nZS5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdmFyIGFkZCA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMik7XG4gICAgICAgICAgICByZXR1cm4gXy5wYXJ0aWFsKHRoaXMucmVsYXRlZC5zcGxpY2UsIGlkeCwgbnVtUmVtb3ZlKS5hcHBseSh0aGlzLnJlbGF0ZWQsIGFkZCk7XG4gICAgICAgIH0uYmluZCh0aGlzKTtcbiAgICB9LFxuICAgIGNsZWFyUmV2ZXJzZVJlbGF0ZWQ6IGZ1bmN0aW9uIChvcHRzKSB7XG4gICAgICAgIG9wdHMgPSBvcHRzIHx8IHt9O1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgIGlmICh0aGlzLnJlbGF0ZWQpIHtcbiAgICAgICAgICAgIHZhciByZXZlcnNlUHJveHkgPSB0aGlzLnJldmVyc2VQcm94eUZvckluc3RhbmNlKHRoaXMucmVsYXRlZCk7XG4gICAgICAgICAgICB2YXIgcmV2ZXJzZVByb3hpZXMgPSB1dGlsLmlzQXJyYXkocmV2ZXJzZVByb3h5KSA/IHJldmVyc2VQcm94eSA6IFtyZXZlcnNlUHJveHldO1xuICAgICAgICAgICAgXy5lYWNoKHJldmVyc2VQcm94aWVzLCBmdW5jdGlvbiAocCkge1xuICAgICAgICAgICAgICAgIGlmICh1dGlsLmlzQXJyYXkocC5yZWxhdGVkKSkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgaWR4ID0gcC5yZWxhdGVkLmluZGV4T2Yoc2VsZi5vYmplY3QpO1xuICAgICAgICAgICAgICAgICAgICBwLm1ha2VDaGFuZ2VzVG9SZWxhdGVkV2l0aG91dE9ic2VydmF0aW9ucyhmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwLnNwbGljZXIob3B0cykoaWR4LCAxKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcC5zZXRJZEFuZFJlbGF0ZWQobnVsbCwgb3B0cyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9LFxuICAgIHNldElkQW5kUmVsYXRlZFJldmVyc2U6IGZ1bmN0aW9uIChvYmosIG9wdHMpIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICB2YXIgcmV2ZXJzZVByb3h5ID0gdGhpcy5yZXZlcnNlUHJveHlGb3JJbnN0YW5jZShvYmopO1xuICAgICAgICB2YXIgcmV2ZXJzZVByb3hpZXMgPSB1dGlsLmlzQXJyYXkocmV2ZXJzZVByb3h5KSA/IHJldmVyc2VQcm94eSA6IFtyZXZlcnNlUHJveHldO1xuICAgICAgICBfLmVhY2gocmV2ZXJzZVByb3hpZXMsIGZ1bmN0aW9uIChwKSB7XG4gICAgICAgICAgICBpZiAodXRpbC5pc0FycmF5KHAucmVsYXRlZCkpIHtcbiAgICAgICAgICAgICAgICBwLm1ha2VDaGFuZ2VzVG9SZWxhdGVkV2l0aG91dE9ic2VydmF0aW9ucyhmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIHAuc3BsaWNlcihvcHRzKShwLnJlbGF0ZWQubGVuZ3RoLCAwLCBzZWxmLm9iamVjdCk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHAuY2xlYXJSZXZlcnNlUmVsYXRlZChvcHRzKTtcbiAgICAgICAgICAgICAgICBwLnNldElkQW5kUmVsYXRlZChzZWxmLm9iamVjdCwgb3B0cyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH0sXG4gICAgbWFrZUNoYW5nZXNUb1JlbGF0ZWRXaXRob3V0T2JzZXJ2YXRpb25zOiBmdW5jdGlvbiAoZikge1xuICAgICAgICBpZiAodGhpcy5yZWxhdGVkKSB7XG4gICAgICAgICAgICB0aGlzLnJlbGF0ZWQuYXJyYXlPYnNlcnZlci5jbG9zZSgpO1xuICAgICAgICAgICAgdGhpcy5yZWxhdGVkLmFycmF5T2JzZXJ2ZXIgPSBudWxsO1xuICAgICAgICAgICAgZigpO1xuICAgICAgICAgICAgdGhpcy53cmFwQXJyYXkodGhpcy5yZWxhdGVkKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGYoKTtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgcmVnaXN0ZXJTZXRDaGFuZ2U6IGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgdmFyIHByb3h5T2JqZWN0ID0gdGhpcy5vYmplY3Q7XG4gICAgICAgIGlmICghcHJveHlPYmplY3QpIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdQcm94eSBtdXN0IGhhdmUgYW4gb2JqZWN0IGFzc29jaWF0ZWQnKTtcbiAgICAgICAgdmFyIG1vZGVsID0gcHJveHlPYmplY3QubW9kZWwubmFtZTtcbiAgICAgICAgdmFyIGNvbGxlY3Rpb25OYW1lID0gcHJveHlPYmplY3QuY29sbGVjdGlvbk5hbWU7XG4gICAgICAgIC8vIFdlIHRha2UgW10gPT0gbnVsbCA9PSB1bmRlZmluZWQgaW4gdGhlIGNhc2Ugb2YgcmVsYXRpb25zaGlwcy5cbiAgICAgICAgdmFyIG9sZCA9IHRoaXMucmVsYXRlZDtcbiAgICAgICAgaWYgKHV0aWwuaXNBcnJheShvbGQpICYmICFvbGQubGVuZ3RoKSB7XG4gICAgICAgICAgICBvbGQgPSBudWxsO1xuICAgICAgICB9XG4gICAgICAgIG1vZGVsRXZlbnRzLmVtaXQoe1xuICAgICAgICAgICAgY29sbGVjdGlvbjogY29sbGVjdGlvbk5hbWUsXG4gICAgICAgICAgICBtb2RlbDogbW9kZWwsXG4gICAgICAgICAgICBfaWQ6IHByb3h5T2JqZWN0Ll9pZCxcbiAgICAgICAgICAgIGZpZWxkOiB0aGlzLmdldEZvcndhcmROYW1lKCksXG4gICAgICAgICAgICBvbGQ6IG9sZCxcbiAgICAgICAgICAgIG5ldzogb2JqLFxuICAgICAgICAgICAgdHlwZTogTW9kZWxFdmVudFR5cGUuU2V0LFxuICAgICAgICAgICAgb2JqOiBwcm94eU9iamVjdFxuICAgICAgICB9KTtcbiAgICB9LFxuXG4gICAgcmVnaXN0ZXJTcGxpY2VDaGFuZ2U6IGZ1bmN0aW9uIChpZHgsIG51bVJlbW92ZSkge1xuICAgICAgICB2YXIgYWRkID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAyKTtcbiAgICAgICAgdmFyIG1vZGVsID0gdGhpcy5vYmplY3QubW9kZWwubmFtZTtcbiAgICAgICAgdmFyIGNvbGwgPSB0aGlzLm9iamVjdC5jb2xsZWN0aW9uTmFtZTtcbiAgICAgICAgbW9kZWxFdmVudHMuZW1pdCh7XG4gICAgICAgICAgICBjb2xsZWN0aW9uOiBjb2xsLFxuICAgICAgICAgICAgbW9kZWw6IG1vZGVsLFxuICAgICAgICAgICAgX2lkOiB0aGlzLm9iamVjdC5faWQsXG4gICAgICAgICAgICBmaWVsZDogdGhpcy5nZXRGb3J3YXJkTmFtZSgpLFxuICAgICAgICAgICAgaW5kZXg6IGlkeCxcbiAgICAgICAgICAgIHJlbW92ZWQ6IHRoaXMucmVsYXRlZCA/IHRoaXMucmVsYXRlZC5zbGljZShpZHgsIGlkeCArIG51bVJlbW92ZSkgOiBudWxsLFxuICAgICAgICAgICAgYWRkZWQ6IGFkZC5sZW5ndGggPyBhZGQgOiBbXSxcbiAgICAgICAgICAgIHR5cGU6IE1vZGVsRXZlbnRUeXBlLlNwbGljZSxcbiAgICAgICAgICAgIG9iajogdGhpcy5vYmplY3RcbiAgICAgICAgfSk7XG4gICAgfSxcbiAgICB3cmFwQXJyYXk6IGZ1bmN0aW9uIChhcnIpIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICB3cmFwQXJyYXlGb3JBdHRyaWJ1dGVzKGFyciwgdGhpcy5yZXZlcnNlTmFtZSwgdGhpcy5vYmplY3QpO1xuICAgICAgICBpZiAoIWFyci5hcnJheU9ic2VydmVyKSB7XG4gICAgICAgICAgICBhcnIuYXJyYXlPYnNlcnZlciA9IG5ldyBBcnJheU9ic2VydmVyKGFycik7XG4gICAgICAgICAgICB2YXIgb2JzZXJ2ZXJGdW5jdGlvbiA9IGZ1bmN0aW9uIChzcGxpY2VzKSB7XG4gICAgICAgICAgICAgICAgc3BsaWNlcy5mb3JFYWNoKGZ1bmN0aW9uIChzcGxpY2UpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGFkZGVkID0gc3BsaWNlLmFkZGVkQ291bnQgPyBhcnIuc2xpY2Uoc3BsaWNlLmluZGV4LCBzcGxpY2UuaW5kZXggKyBzcGxpY2UuYWRkZWRDb3VudCkgOiBbXTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIG1vZGVsID0gc2VsZi5nZXRGb3J3YXJkTW9kZWwoKTtcbiAgICAgICAgICAgICAgICAgICAgbW9kZWxFdmVudHMuZW1pdCh7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb2xsZWN0aW9uOiBtb2RlbC5jb2xsZWN0aW9uTmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1vZGVsOiBtb2RlbC5uYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgX2lkOiBzZWxmLm9iamVjdC5faWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBmaWVsZDogc2VsZi5nZXRGb3J3YXJkTmFtZSgpLFxuICAgICAgICAgICAgICAgICAgICAgICAgcmVtb3ZlZDogc3BsaWNlLnJlbW92ZWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBhZGRlZDogYWRkZWQsXG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiBNb2RlbEV2ZW50VHlwZS5TcGxpY2UsXG4gICAgICAgICAgICAgICAgICAgICAgICBvYmo6IHNlbGYub2JqZWN0XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIGFyci5hcnJheU9ic2VydmVyLm9wZW4ob2JzZXJ2ZXJGdW5jdGlvbik7XG4gICAgICAgIH1cbiAgICB9LFxuICAgIHNwbGljZTogZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLnNwbGljZXIoe30pLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfVxuXG59KTtcblxuXG5tb2R1bGUuZXhwb3J0cyA9IFJlbGF0aW9uc2hpcFByb3h5O1xuXG4iLCIvKipcbiAqIEBtb2R1bGUgcmVsYXRpb25zaGlwXG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gICAgT25lVG9NYW55OiAnT25lVG9NYW55JyxcbiAgICBPbmVUb09uZTogJ09uZVRvT25lJyxcbiAgICBNYW55VG9NYW55OiAnTWFueVRvTWFueSdcbn07IiwiLyoqXG4gKiBUaGlzIGlzIGFuIGluLW1lbW9yeSBjYWNoZSBmb3IgbW9kZWxzLiBNb2RlbHMgYXJlIGNhY2hlZCBieSBsb2NhbCBpZCAoX2lkKSBhbmQgcmVtb3RlIGlkIChkZWZpbmVkIGJ5IHRoZSBtYXBwaW5nKS5cbiAqIExvb2t1cHMgYXJlIHBlcmZvcm1lZCBhZ2FpbnN0IHRoZSBjYWNoZSB3aGVuIG1hcHBpbmcuXG4gKiBAbW9kdWxlIGNhY2hlXG4gKi9cbnZhciBsb2cgPSByZXF1aXJlKCcuL2xvZycpLFxuICAgIEludGVybmFsU2llc3RhRXJyb3IgPSByZXF1aXJlKCcuL2Vycm9yJykuSW50ZXJuYWxTaWVzdGFFcnJvcixcbiAgICB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyk7XG5cblxudmFyIExvZ2dlciA9IGxvZy5sb2dnZXJXaXRoTmFtZSgnQ2FjaGUnKTtcblxudmFyIGxvY2FsQ2FjaGVCeUlkID0ge30sXG4gICAgbG9jYWxDYWNoZSA9IHt9LFxuICAgIHJlbW90ZUNhY2hlID0ge307XG5cbi8qKlxuICogQ2xlYXIgb3V0IHRoZSBjYWNoZS5cbiAqL1xuZnVuY3Rpb24gcmVzZXQoKSB7XG4gICAgcmVtb3RlQ2FjaGUgPSB7fTtcbiAgICBsb2NhbENhY2hlQnlJZCA9IHt9O1xuICAgIGxvY2FsQ2FjaGUgPSB7fTtcbn1cblxuLyoqXG4gKiBSZXR1cm4gdGhlIG9iamVjdCBpbiB0aGUgY2FjaGUgZ2l2ZW4gYSBsb2NhbCBpZCAoX2lkKVxuICogQHBhcmFtICB7U3RyaW5nfSBsb2NhbElkXG4gKiBAcmV0dXJuIHtNb2RlbEluc3RhbmNlfVxuICovXG5mdW5jdGlvbiBnZXRWaWFMb2NhbElkKGxvY2FsSWQpIHtcbiAgICB2YXIgb2JqID0gbG9jYWxDYWNoZUJ5SWRbbG9jYWxJZF07XG4gICAgaWYgKG9iaikge1xuICAgICAgICBpZiAoTG9nZ2VyLmRlYnVnLmlzRW5hYmxlZClcbiAgICAgICAgICAgIExvZ2dlci5kZWJ1ZygnTG9jYWwgY2FjaGUgaGl0OiAnICsgb2JqLl9kdW1wKHRydWUpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBpZiAoTG9nZ2VyLmRlYnVnLmlzRW5hYmxlZClcbiAgICAgICAgICAgIExvZ2dlci5kZWJ1ZygnTG9jYWwgY2FjaGUgbWlzczogJyArIGxvY2FsSWQpO1xuICAgIH1cbiAgICByZXR1cm4gb2JqO1xufVxuXG4vKipcbiAqIFJldHVybiB0aGUgc2luZ2xldG9uIG9iamVjdCBnaXZlbiBhIHNpbmdsZXRvbiBtb2RlbC5cbiAqIEBwYXJhbSAge01vZGVsfSBtb2RlbFxuICogQHJldHVybiB7TW9kZWxJbnN0YW5jZX1cbiAqL1xuZnVuY3Rpb24gZ2V0U2luZ2xldG9uKG1vZGVsKSB7XG4gICAgdmFyIG1vZGVsTmFtZSA9IG1vZGVsLm5hbWU7XG4gICAgdmFyIGNvbGxlY3Rpb25OYW1lID0gbW9kZWwuY29sbGVjdGlvbk5hbWU7XG4gICAgdmFyIGNvbGxlY3Rpb25DYWNoZSA9IGxvY2FsQ2FjaGVbY29sbGVjdGlvbk5hbWVdO1xuICAgIGlmIChjb2xsZWN0aW9uQ2FjaGUpIHtcbiAgICAgICAgdmFyIHR5cGVDYWNoZSA9IGNvbGxlY3Rpb25DYWNoZVttb2RlbE5hbWVdO1xuICAgICAgICBpZiAodHlwZUNhY2hlKSB7XG4gICAgICAgICAgICB2YXIgb2JqcyA9IFtdO1xuICAgICAgICAgICAgZm9yICh2YXIgcHJvcCBpbiB0eXBlQ2FjaGUpIHtcbiAgICAgICAgICAgICAgICBpZiAodHlwZUNhY2hlLmhhc093blByb3BlcnR5KHByb3ApKSB7XG4gICAgICAgICAgICAgICAgICAgIG9ianMucHVzaCh0eXBlQ2FjaGVbcHJvcF0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChvYmpzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICAgICAgICB2YXIgZXJyU3RyID0gJ0Egc2luZ2xldG9uIG1vZGVsIGhhcyBtb3JlIHRoYW4gMSBvYmplY3QgaW4gdGhlIGNhY2hlISBUaGlzIGlzIGEgc2VyaW91cyBlcnJvci4gJyArXG4gICAgICAgICAgICAgICAgICAgICdFaXRoZXIgYSBtb2RlbCBoYXMgYmVlbiBtb2RpZmllZCBhZnRlciBvYmplY3RzIGhhdmUgYWxyZWFkeSBiZWVuIGNyZWF0ZWQsIG9yIHNvbWV0aGluZyBoYXMgZ29uZScgK1xuICAgICAgICAgICAgICAgICAgICAndmVyeSB3cm9uZy4gUGxlYXNlIGZpbGUgYSBidWcgcmVwb3J0IGlmIHRoZSBsYXR0ZXIuJztcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcihlcnJTdHIpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChvYmpzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBvYmpzWzBdO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xufVxuXG4vKipcbiAqIEdpdmVuIGEgcmVtb3RlIGlkZW50aWZpZXIgYW5kIGFuIG9wdGlvbnMgb2JqZWN0IHRoYXQgZGVzY3JpYmVzIG1hcHBpbmcvY29sbGVjdGlvbixcbiAqIHJldHVybiB0aGUgbW9kZWwgaWYgY2FjaGVkLlxuICogQHBhcmFtICB7U3RyaW5nfSByZW1vdGVJZFxuICogQHBhcmFtICB7T2JqZWN0fSBvcHRzXG4gKiBAcmV0dXJuIHtNb2RlbEluc3RhbmNlfVxuICovXG5mdW5jdGlvbiBnZXRWaWFSZW1vdGVJZChyZW1vdGVJZCwgb3B0cykge1xuICAgIHZhciB0eXBlID0gb3B0cy5tb2RlbC5uYW1lO1xuICAgIHZhciBjb2xsZWN0aW9uTmFtZSA9IG9wdHMubW9kZWwuY29sbGVjdGlvbk5hbWU7XG4gICAgdmFyIGNvbGxlY3Rpb25DYWNoZSA9IHJlbW90ZUNhY2hlW2NvbGxlY3Rpb25OYW1lXTtcbiAgICBpZiAoY29sbGVjdGlvbkNhY2hlKSB7XG4gICAgICAgIHZhciB0eXBlQ2FjaGUgPSByZW1vdGVDYWNoZVtjb2xsZWN0aW9uTmFtZV1bdHlwZV07XG4gICAgICAgIGlmICh0eXBlQ2FjaGUpIHtcbiAgICAgICAgICAgIHZhciBvYmogPSB0eXBlQ2FjaGVbcmVtb3RlSWRdO1xuICAgICAgICAgICAgaWYgKG9iaikge1xuICAgICAgICAgICAgICAgIGlmIChMb2dnZXIuZGVidWcpXG4gICAgICAgICAgICAgICAgICAgIExvZ2dlci5kZWJ1ZygnUmVtb3RlIGNhY2hlIGhpdDogJyArIG9iai5fZHVtcCh0cnVlKSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmIChMb2dnZXIuZGVidWcpXG4gICAgICAgICAgICAgICAgICAgIExvZ2dlci5kZWJ1ZygnUmVtb3RlIGNhY2hlIG1pc3M6ICcgKyByZW1vdGVJZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gb2JqO1xuICAgICAgICB9XG4gICAgfVxuICAgIGlmIChMb2dnZXIuZGVidWcpXG4gICAgICAgIExvZ2dlci5kZWJ1ZygnUmVtb3RlIGNhY2hlIG1pc3M6ICcgKyByZW1vdGVJZCk7XG4gICAgcmV0dXJuIG51bGw7XG59XG5cbi8qKlxuICogSW5zZXJ0IGFuIG9iamV0IGludG8gdGhlIGNhY2hlIHVzaW5nIGEgcmVtb3RlIGlkZW50aWZpZXIgZGVmaW5lZCBieSB0aGUgbWFwcGluZy5cbiAqIEBwYXJhbSAge01vZGVsSW5zdGFuY2V9IG9ialxuICogQHBhcmFtICB7U3RyaW5nfSByZW1vdGVJZFxuICogQHBhcmFtICB7U3RyaW5nfSBwcmV2aW91c1JlbW90ZUlkIElmIHJlbW90ZSBpZCBoYXMgYmVlbiBjaGFuZ2VkLCB0aGlzIGlzIHRoZSBvbGQgcmVtb3RlIGlkZW50aWZpZXJcbiAqL1xuZnVuY3Rpb24gcmVtb3RlSW5zZXJ0KG9iaiwgcmVtb3RlSWQsIHByZXZpb3VzUmVtb3RlSWQpIHtcbiAgICBpZiAob2JqKSB7XG4gICAgICAgIHZhciBjb2xsZWN0aW9uTmFtZSA9IG9iai5tb2RlbC5jb2xsZWN0aW9uTmFtZTtcbiAgICAgICAgaWYgKGNvbGxlY3Rpb25OYW1lKSB7XG4gICAgICAgICAgICBpZiAoIXJlbW90ZUNhY2hlW2NvbGxlY3Rpb25OYW1lXSkge1xuICAgICAgICAgICAgICAgIHJlbW90ZUNhY2hlW2NvbGxlY3Rpb25OYW1lXSA9IHt9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdmFyIHR5cGUgPSBvYmoubW9kZWwubmFtZTtcbiAgICAgICAgICAgIGlmICh0eXBlKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFyZW1vdGVDYWNoZVtjb2xsZWN0aW9uTmFtZV1bdHlwZV0pIHtcbiAgICAgICAgICAgICAgICAgICAgcmVtb3RlQ2FjaGVbY29sbGVjdGlvbk5hbWVdW3R5cGVdID0ge307XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChwcmV2aW91c1JlbW90ZUlkKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlbW90ZUNhY2hlW2NvbGxlY3Rpb25OYW1lXVt0eXBlXVtwcmV2aW91c1JlbW90ZUlkXSA9IG51bGw7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHZhciBjYWNoZWRPYmplY3QgPSByZW1vdGVDYWNoZVtjb2xsZWN0aW9uTmFtZV1bdHlwZV1bcmVtb3RlSWRdO1xuICAgICAgICAgICAgICAgIGlmICghY2FjaGVkT2JqZWN0KSB7XG4gICAgICAgICAgICAgICAgICAgIHJlbW90ZUNhY2hlW2NvbGxlY3Rpb25OYW1lXVt0eXBlXVtyZW1vdGVJZF0gPSBvYmo7XG4gICAgICAgICAgICAgICAgICAgIGlmIChMb2dnZXIuZGVidWcuaXNFbmFibGVkKVxuICAgICAgICAgICAgICAgICAgICAgICAgTG9nZ2VyLmRlYnVnKCdSZW1vdGUgY2FjaGUgaW5zZXJ0OiAnICsgb2JqLl9kdW1wKHRydWUpKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKExvZ2dlci50cmFjZS5pc0VuYWJsZWQpXG4gICAgICAgICAgICAgICAgICAgICAgICBMb2dnZXIudHJhY2UoJ1JlbW90ZSBjYWNoZSBub3cgbG9va3MgbGlrZTogJyArIHJlbW90ZUR1bXAodHJ1ZSkpXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gU29tZXRoaW5nIGhhcyBnb25lIHJlYWxseSB3cm9uZy4gT25seSBvbmUgb2JqZWN0IGZvciBhIHBhcnRpY3VsYXIgY29sbGVjdGlvbi90eXBlL3JlbW90ZWlkIGNvbWJvXG4gICAgICAgICAgICAgICAgICAgIC8vIHNob3VsZCBldmVyIGV4aXN0LlxuICAgICAgICAgICAgICAgICAgICBpZiAob2JqICE9IGNhY2hlZE9iamVjdCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG1lc3NhZ2UgPSAnT2JqZWN0ICcgKyBjb2xsZWN0aW9uTmFtZS50b1N0cmluZygpICsgJzonICsgdHlwZS50b1N0cmluZygpICsgJ1snICsgb2JqLm1vZGVsLmlkICsgJz1cIicgKyByZW1vdGVJZCArICdcIl0gYWxyZWFkeSBleGlzdHMgaW4gdGhlIGNhY2hlLicgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICcgVGhpcyBpcyBhIHNlcmlvdXMgZXJyb3IsIHBsZWFzZSBmaWxlIGEgYnVnIHJlcG9ydCBpZiB5b3UgYXJlIGV4cGVyaWVuY2luZyB0aGlzIG91dCBpbiB0aGUgd2lsZCc7XG4gICAgICAgICAgICAgICAgICAgICAgICBMb2dnZXIuZXJyb3IobWVzc2FnZSwge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9iajogb2JqLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhY2hlZE9iamVjdDogY2FjaGVkT2JqZWN0XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKG1lc3NhZ2UpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKExvZ2dlci5kZWJ1Zy5pc0VuYWJsZWQpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgTG9nZ2VyLmRlYnVnKCdPYmplY3QgaGFzIGFscmVhZHkgYmVlbiBpbnNlcnRlZDogJyArIG9iai5fZHVtcCh0cnVlKSk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ01vZGVsIGhhcyBubyB0eXBlJywge1xuICAgICAgICAgICAgICAgICAgICBtb2RlbDogb2JqLm1vZGVsLFxuICAgICAgICAgICAgICAgICAgICBvYmo6IG9ialxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ01vZGVsIGhhcyBubyBjb2xsZWN0aW9uJywge1xuICAgICAgICAgICAgICAgIG1vZGVsOiBvYmoubW9kZWwsXG4gICAgICAgICAgICAgICAgb2JqOiBvYmpcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdmFyIG1zZyA9ICdNdXN0IHBhc3MgYW4gb2JqZWN0IHdoZW4gaW5zZXJ0aW5nIHRvIGNhY2hlJztcbiAgICAgICAgTG9nZ2VyLmVycm9yKG1zZyk7XG4gICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKG1zZyk7XG4gICAgfVxufVxuXG4vKipcbiAqIER1bXAgdGhlIHJlbW90ZSBpZCBjYWNoZVxuICogQHBhcmFtICB7Ym9vbGVhbn0gYXNKc29uIFdoZXRoZXIgb3Igbm90IHRvIGFwcGx5IEpTT04uc3RyaW5naWZ5XG4gKiBAcmV0dXJuIHtTdHJpbmd8T2JqZWN0fVxuICovXG5mdW5jdGlvbiByZW1vdGVEdW1wKGFzSnNvbikge1xuICAgIHZhciBkdW1wZWRSZXN0Q2FjaGUgPSB7fTtcbiAgICBmb3IgKHZhciBjb2xsIGluIHJlbW90ZUNhY2hlKSB7XG4gICAgICAgIGlmIChyZW1vdGVDYWNoZS5oYXNPd25Qcm9wZXJ0eShjb2xsKSkge1xuICAgICAgICAgICAgdmFyIGR1bXBlZENvbGxDYWNoZSA9IHt9O1xuICAgICAgICAgICAgZHVtcGVkUmVzdENhY2hlW2NvbGxdID0gZHVtcGVkQ29sbENhY2hlO1xuICAgICAgICAgICAgdmFyIGNvbGxDYWNoZSA9IHJlbW90ZUNhY2hlW2NvbGxdO1xuICAgICAgICAgICAgZm9yICh2YXIgbW9kZWwgaW4gY29sbENhY2hlKSB7XG4gICAgICAgICAgICAgICAgaWYgKGNvbGxDYWNoZS5oYXNPd25Qcm9wZXJ0eShtb2RlbCkpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGR1bXBlZE1vZGVsQ2FjaGUgPSB7fTtcbiAgICAgICAgICAgICAgICAgICAgZHVtcGVkQ29sbENhY2hlW21vZGVsXSA9IGR1bXBlZE1vZGVsQ2FjaGU7XG4gICAgICAgICAgICAgICAgICAgIHZhciBtb2RlbENhY2hlID0gY29sbENhY2hlW21vZGVsXTtcbiAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgcmVtb3RlSWQgaW4gbW9kZWxDYWNoZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG1vZGVsQ2FjaGUuaGFzT3duUHJvcGVydHkocmVtb3RlSWQpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG1vZGVsQ2FjaGVbcmVtb3RlSWRdKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGR1bXBlZE1vZGVsQ2FjaGVbcmVtb3RlSWRdID0gbW9kZWxDYWNoZVtyZW1vdGVJZF0uX2R1bXAoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGFzSnNvbiA/IHV0aWwucHJldHR5UHJpbnQoKGR1bXBlZFJlc3RDYWNoZSwgbnVsbCwgNCkpIDogZHVtcGVkUmVzdENhY2hlO1xufVxuXG4vKipcbiAqIER1bXAgdGhlIGxvY2FsIGlkIChfaWQpIGNhY2hlXG4gKiBAcGFyYW0gIHtib29sZWFufSBhc0pzb24gV2hldGhlciBvciBub3QgdG8gYXBwbHkgSlNPTi5zdHJpbmdpZnlcbiAqIEByZXR1cm4ge1N0cmluZ3xPYmplY3R9XG4gKi9cbmZ1bmN0aW9uIGxvY2FsRHVtcChhc0pzb24pIHtcbiAgICB2YXIgZHVtcGVkSWRDYWNoZSA9IHt9O1xuICAgIGZvciAodmFyIGlkIGluIGxvY2FsQ2FjaGVCeUlkKSB7XG4gICAgICAgIGlmIChsb2NhbENhY2hlQnlJZC5oYXNPd25Qcm9wZXJ0eShpZCkpIHtcbiAgICAgICAgICAgIGR1bXBlZElkQ2FjaGVbaWRdID0gbG9jYWxDYWNoZUJ5SWRbaWRdLl9kdW1wKClcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gYXNKc29uID8gdXRpbC5wcmV0dHlQcmludCgoZHVtcGVkSWRDYWNoZSwgbnVsbCwgNCkpIDogZHVtcGVkSWRDYWNoZTtcbn1cblxuLyoqXG4gKiBEdW1wIHRvIHRoZSBjYWNoZS5cbiAqIEBwYXJhbSAge2Jvb2xlYW59IGFzSnNvbiBXaGV0aGVyIG9yIG5vdCB0byBhcHBseSBKU09OLnN0cmluZ2lmeVxuICogQHJldHVybiB7U3RyaW5nfE9iamVjdH1cbiAqL1xuZnVuY3Rpb24gZHVtcChhc0pzb24pIHtcbiAgICB2YXIgZHVtcGVkID0ge1xuICAgICAgICBsb2NhbENhY2hlOiBsb2NhbER1bXAoKSxcbiAgICAgICAgcmVtb3RlQ2FjaGU6IHJlbW90ZUR1bXAoKVxuICAgIH07XG4gICAgcmV0dXJuIGFzSnNvbiA/IHV0aWwucHJldHR5UHJpbnQoKGR1bXBlZCwgbnVsbCwgNCkpIDogZHVtcGVkO1xufVxuXG5mdW5jdGlvbiBfcmVtb3RlQ2FjaGUoKSB7XG4gICAgcmV0dXJuIHJlbW90ZUNhY2hlXG59XG5cbmZ1bmN0aW9uIF9sb2NhbENhY2hlKCkge1xuICAgIHJldHVybiBsb2NhbENhY2hlQnlJZDtcbn1cblxuLyoqXG4gKiBRdWVyeSB0aGUgY2FjaGVcbiAqIEBwYXJhbSAge09iamVjdH0gb3B0cyBPYmplY3QgZGVzY3JpYmluZyB0aGUgcXVlcnlcbiAqIEByZXR1cm4ge01vZGVsSW5zdGFuY2V9XG4gKiBAZXhhbXBsZVxuICogYGBganNcbiAqIGNhY2hlLmdldCh7X2lkOiAnNSd9KTsgLy8gUXVlcnkgYnkgbG9jYWwgaWRcbiAqIGNhY2hlLmdldCh7cmVtb3RlSWQ6ICc1JywgbWFwcGluZzogbXlNYXBwaW5nfSk7IC8vIFF1ZXJ5IGJ5IHJlbW90ZSBpZFxuICogYGBgXG4gKi9cbmZ1bmN0aW9uIGdldChvcHRzKSB7XG4gICAgaWYgKExvZ2dlci5kZWJ1Zy5pc0VuYWJsZWQpIExvZ2dlci5kZWJ1ZygnZ2V0Jywgb3B0cyk7XG4gICAgdmFyIG9iaiwgaWRGaWVsZCwgcmVtb3RlSWQ7XG4gICAgdmFyIGxvY2FsSWQgPSBvcHRzLl9pZDtcbiAgICBpZiAobG9jYWxJZCkge1xuICAgICAgICBvYmogPSBnZXRWaWFMb2NhbElkKGxvY2FsSWQpO1xuICAgICAgICBpZiAob2JqKSB7XG4gICAgICAgICAgICByZXR1cm4gb2JqO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaWYgKG9wdHMubW9kZWwpIHtcbiAgICAgICAgICAgICAgICBpZEZpZWxkID0gb3B0cy5tb2RlbC5pZDtcbiAgICAgICAgICAgICAgICByZW1vdGVJZCA9IG9wdHNbaWRGaWVsZF07XG4gICAgICAgICAgICAgICAgaWYgKExvZ2dlci5kZWJ1Zy5pc0VuYWJsZWQpIExvZ2dlci5kZWJ1ZyhpZEZpZWxkICsgJz0nICsgcmVtb3RlSWQpO1xuICAgICAgICAgICAgICAgIHJldHVybiBnZXRWaWFSZW1vdGVJZChyZW1vdGVJZCwgb3B0cyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSBlbHNlIGlmIChvcHRzLm1vZGVsKSB7XG4gICAgICAgIGlkRmllbGQgPSBvcHRzLm1vZGVsLmlkO1xuICAgICAgICByZW1vdGVJZCA9IG9wdHNbaWRGaWVsZF07XG4gICAgICAgIGlmIChyZW1vdGVJZCkge1xuICAgICAgICAgICAgcmV0dXJuIGdldFZpYVJlbW90ZUlkKHJlbW90ZUlkLCBvcHRzKTtcbiAgICAgICAgfSBlbHNlIGlmIChvcHRzLm1vZGVsLnNpbmdsZXRvbikge1xuICAgICAgICAgICAgcmV0dXJuIGdldFNpbmdsZXRvbihvcHRzLm1vZGVsKTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIExvZ2dlci53YXJuKCdJbnZhbGlkIG9wdHMgdG8gY2FjaGUnLCB7XG4gICAgICAgICAgICBvcHRzOiBvcHRzXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbn1cblxuLyoqXG4gKiBJbnNlcnQgYW4gb2JqZWN0IGludG8gdGhlIGNhY2hlLlxuICogQHBhcmFtICB7TW9kZWxJbnN0YW5jZX0gb2JqXG4gKiBAdGhyb3dzIHtJbnRlcm5hbFNpZXN0YUVycm9yfSBBbiBvYmplY3Qgd2l0aCBfaWQvcmVtb3RlSWQgYWxyZWFkeSBleGlzdHMuIE5vdCB0aHJvd24gaWYgc2FtZSBvYmhlY3QuXG4gKi9cbmZ1bmN0aW9uIGluc2VydChvYmopIHtcbiAgICB2YXIgbG9jYWxJZCA9IG9iai5faWQ7XG4gICAgaWYgKGxvY2FsSWQpIHtcbiAgICAgICAgdmFyIGNvbGxlY3Rpb25OYW1lID0gb2JqLm1vZGVsLmNvbGxlY3Rpb25OYW1lO1xuICAgICAgICB2YXIgbW9kZWxOYW1lID0gb2JqLm1vZGVsLm5hbWU7XG4gICAgICAgIGlmIChMb2dnZXIuZGVidWcuaXNFbmFibGVkKVxuICAgICAgICAgICAgTG9nZ2VyLmRlYnVnKCdMb2NhbCBjYWNoZSBpbnNlcnQ6ICcgKyBvYmouX2R1bXBTdHJpbmcoKSk7XG4gICAgICAgIGlmICghbG9jYWxDYWNoZUJ5SWRbbG9jYWxJZF0pIHtcbiAgICAgICAgICAgIGxvY2FsQ2FjaGVCeUlkW2xvY2FsSWRdID0gb2JqO1xuICAgICAgICAgICAgaWYgKExvZ2dlci50cmFjZS5pc0VuYWJsZWQpXG4gICAgICAgICAgICAgICAgTG9nZ2VyLnRyYWNlKCdMb2NhbCBjYWNoZSBub3cgbG9va3MgbGlrZTogJyArIGxvY2FsRHVtcCh0cnVlKSk7XG4gICAgICAgICAgICBpZiAoIWxvY2FsQ2FjaGVbY29sbGVjdGlvbk5hbWVdKSBsb2NhbENhY2hlW2NvbGxlY3Rpb25OYW1lXSA9IHt9O1xuICAgICAgICAgICAgaWYgKCFsb2NhbENhY2hlW2NvbGxlY3Rpb25OYW1lXVttb2RlbE5hbWVdKSBsb2NhbENhY2hlW2NvbGxlY3Rpb25OYW1lXVttb2RlbE5hbWVdID0ge307XG4gICAgICAgICAgICBsb2NhbENhY2hlW2NvbGxlY3Rpb25OYW1lXVttb2RlbE5hbWVdW2xvY2FsSWRdID0gb2JqO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gU29tZXRoaW5nIGhhcyBnb25lIGJhZGx5IHdyb25nIGhlcmUuIFR3byBvYmplY3RzIHNob3VsZCBuZXZlciBleGlzdCB3aXRoIHRoZSBzYW1lIF9pZFxuICAgICAgICAgICAgaWYgKGxvY2FsQ2FjaGVCeUlkW2xvY2FsSWRdICE9IG9iaikge1xuICAgICAgICAgICAgICAgIHZhciBtZXNzYWdlID0gJ09iamVjdCB3aXRoIF9pZD1cIicgKyBsb2NhbElkLnRvU3RyaW5nKCkgKyAnXCIgaXMgYWxyZWFkeSBpbiB0aGUgY2FjaGUuICcgK1xuICAgICAgICAgICAgICAgICAgICAnVGhpcyBpcyBhIHNlcmlvdXMgZXJyb3IuIFBsZWFzZSBmaWxlIGEgYnVnIHJlcG9ydCBpZiB5b3UgYXJlIGV4cGVyaWVuY2luZyB0aGlzIG91dCBpbiB0aGUgd2lsZCc7XG4gICAgICAgICAgICAgICAgTG9nZ2VyLmVycm9yKG1lc3NhZ2UpO1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKG1lc3NhZ2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIHZhciBpZEZpZWxkID0gb2JqLmlkRmllbGQ7XG4gICAgdmFyIHJlbW90ZUlkID0gb2JqW2lkRmllbGRdO1xuICAgIGlmIChyZW1vdGVJZCkge1xuICAgICAgICByZW1vdGVJbnNlcnQob2JqLCByZW1vdGVJZCk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKExvZ2dlci5kZWJ1Zy5pc0VuYWJsZWQpXG4gICAgICAgICAgICBMb2dnZXIuZGVidWcoJ05vIHJlbW90ZSBpZCAoXCInICsgaWRGaWVsZCArICdcIikgc28gd29udCBiZSBwbGFjaW5nIGluIHRoZSByZW1vdGUgY2FjaGUnLCBvYmopO1xuICAgIH1cbn1cblxuLyoqXG4gKiBSZXR1cm5zIHRydWUgaWYgb2JqZWN0IGlzIGluIHRoZSBjYWNoZVxuICogQHBhcmFtICB7TW9kZWxJbnN0YW5jZX0gb2JqXG4gKiBAcmV0dXJuIHtib29sZWFufVxuICovXG5mdW5jdGlvbiBjb250YWlucyhvYmopIHtcbiAgICB2YXIgcSA9IHtcbiAgICAgICAgX2lkOiBvYmouX2lkXG4gICAgfTtcbiAgICB2YXIgbW9kZWwgPSBvYmoubW9kZWw7XG4gICAgaWYgKG1vZGVsLmlkKSB7XG4gICAgICAgIGlmIChvYmpbbW9kZWwuaWRdKSB7XG4gICAgICAgICAgICBxLm1vZGVsID0gbW9kZWw7XG4gICAgICAgICAgICBxW21vZGVsLmlkXSA9IG9ialttb2RlbC5pZF07XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuICEhZ2V0KHEpO1xufVxuXG4vKipcbiAqIFJlbW92ZXMgdGhlIG9iamVjdCBmcm9tIHRoZSBjYWNoZSAoaWYgaXQncyBhY3R1YWxseSBpbiB0aGUgY2FjaGUpIG90aGVyd2lzZXMgdGhyb3dzIGFuIGVycm9yLlxuICogQHBhcmFtICB7TW9kZWxJbnN0YW5jZX0gb2JqXG4gKiBAdGhyb3dzIHtJbnRlcm5hbFNpZXN0YUVycm9yfSBJZiBvYmplY3QgYWxyZWFkeSBpbiB0aGUgY2FjaGUuXG4gKi9cbmZ1bmN0aW9uIHJlbW92ZShvYmopIHtcbiAgICBpZiAoY29udGFpbnMob2JqKSkge1xuICAgICAgICB2YXIgY29sbGVjdGlvbk5hbWUgPSBvYmoubW9kZWwuY29sbGVjdGlvbk5hbWU7XG4gICAgICAgIHZhciBtb2RlbE5hbWUgPSBvYmoubW9kZWwubmFtZTtcbiAgICAgICAgdmFyIF9pZCA9IG9iai5faWQ7XG4gICAgICAgIGlmICghbW9kZWxOYW1lKSB0aHJvdyBJbnRlcm5hbFNpZXN0YUVycm9yKCdObyBtYXBwaW5nIG5hbWUnKTtcbiAgICAgICAgaWYgKCFjb2xsZWN0aW9uTmFtZSkgdGhyb3cgSW50ZXJuYWxTaWVzdGFFcnJvcignTm8gY29sbGVjdGlvbiBuYW1lJyk7XG4gICAgICAgIGlmICghX2lkKSB0aHJvdyBJbnRlcm5hbFNpZXN0YUVycm9yKCdObyBfaWQnKTtcbiAgICAgICAgZGVsZXRlIGxvY2FsQ2FjaGVbY29sbGVjdGlvbk5hbWVdW21vZGVsTmFtZV1bX2lkXTtcbiAgICAgICAgZGVsZXRlIGxvY2FsQ2FjaGVCeUlkW19pZF07XG4gICAgICAgIGlmIChvYmoubW9kZWwuaWQpIHtcbiAgICAgICAgICAgIHZhciByZW1vdGVJZCA9IG9ialtvYmoubW9kZWwuaWRdO1xuICAgICAgICAgICAgaWYgKHJlbW90ZUlkKSB7XG4gICAgICAgICAgICAgICAgZGVsZXRlIHJlbW90ZUNhY2hlW2NvbGxlY3Rpb25OYW1lXVttb2RlbE5hbWVdW3JlbW90ZUlkXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdPYmplY3Qgd2FzIG5vdCBpbiBjYWNoZS4nKTtcbiAgICB9XG59XG5cblxuZXhwb3J0cy5fcmVtb3RlQ2FjaGUgPSBfcmVtb3RlQ2FjaGU7XG5leHBvcnRzLl9sb2NhbENhY2hlID0gX2xvY2FsQ2FjaGU7XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgJ19sb2NhbENhY2hlQnlUeXBlJywge1xuICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gbG9jYWxDYWNoZTtcbiAgICB9XG59KTtcbmV4cG9ydHMuZ2V0ID0gZ2V0O1xuZXhwb3J0cy5pbnNlcnQgPSBpbnNlcnQ7XG5leHBvcnRzLnJlbW90ZUluc2VydCA9IHJlbW90ZUluc2VydDtcbmV4cG9ydHMucmVzZXQgPSByZXNldDtcbmV4cG9ydHMuX2R1bXAgPSBkdW1wO1xuZXhwb3J0cy5jb250YWlucyA9IGNvbnRhaW5zO1xuZXhwb3J0cy5yZW1vdmUgPSByZW1vdmU7XG5leHBvcnRzLmdldFNpbmdsZXRvbiA9IGdldFNpbmdsZXRvbjsiLCIvKipcbiAqIEBtb2R1bGUgY29sbGVjdGlvblxuICovXG5cbnZhciBsb2cgPSByZXF1aXJlKCcuL2xvZycpLFxuICAgIENvbGxlY3Rpb25SZWdpc3RyeSA9IHJlcXVpcmUoJy4vY29sbGVjdGlvblJlZ2lzdHJ5JykuQ29sbGVjdGlvblJlZ2lzdHJ5LFxuICAgIEludGVybmFsU2llc3RhRXJyb3IgPSByZXF1aXJlKCcuL2Vycm9yJykuSW50ZXJuYWxTaWVzdGFFcnJvcixcbiAgICBNb2RlbCA9IHJlcXVpcmUoJy4vbW9kZWwnKSxcbiAgICBleHRlbmQgPSByZXF1aXJlKCdleHRlbmQnKSxcbiAgICBvYnNlcnZlID0gcmVxdWlyZSgnLi4vdmVuZG9yL29ic2VydmUtanMvc3JjL29ic2VydmUnKS5QbGF0Zm9ybSxcbiAgICBldmVudHMgPSByZXF1aXJlKCcuL2V2ZW50cycpLFxuICAgIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKSxcbiAgICBfID0gdXRpbC5fLFxuICAgIGVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpLFxuICAgIGNvbnN0cnVjdEVycm9yID0gZXJyb3IuZXJyb3JGYWN0b3J5KGVycm9yLkNvbXBvbmVudHMuQ29sbGVjdGlvbiksXG4gICAgY2FjaGUgPSByZXF1aXJlKCcuL2NhY2hlJyk7XG5cbnZhciBVTlNBRkVfTUVUSE9EUyA9IFsnUFVUJywgJ1BBVENIJywgJ1BPU1QnLCAnREVMRVRFJ10sXG4gICAgTG9nZ2VyID0gbG9nLmxvZ2dlcldpdGhOYW1lKCdDb2xsZWN0aW9uJyk7XG5cbi8qKlxuICogQSBjb2xsZWN0aW9uIGRlc2NyaWJlcyBhIHNldCBvZiBtb2RlbHMgYW5kIG9wdGlvbmFsbHkgYSBSRVNUIEFQSSB3aGljaCB3ZSB3b3VsZFxuICogbGlrZSB0byBtb2RlbC5cbiAqXG4gKiBAcGFyYW0gbmFtZVxuICogQHBhcmFtIG9wdHNcbiAqIEBjb25zdHJ1Y3RvclxuICpcbiAqXG4gKiBAZXhhbXBsZVxuICogYGBganNcbiAqIHZhciBHaXRIdWIgPSBuZXcgc2llc3RhKCdHaXRIdWInKVxuICogLy8gLi4uIGNvbmZpZ3VyZSBtYXBwaW5ncywgZGVzY3JpcHRvcnMgZXRjIC4uLlxuICogR2l0SHViLmluc3RhbGwoZnVuY3Rpb24gKCkge1xuICogICAgIC8vIC4uLiBjYXJyeSBvbi5cbiAqIH0pO1xuICogYGBgXG4gKi9cbmZ1bmN0aW9uIENvbGxlY3Rpb24obmFtZSwgb3B0cykge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBpZiAoIW5hbWUpIHRocm93IG5ldyBFcnJvcignQ29sbGVjdGlvbiBtdXN0IGhhdmUgYSBuYW1lJyk7XG5cbiAgICBvcHRzID0gb3B0cyB8fCB7fTtcbiAgICB1dGlsLmV4dGVuZEZyb21PcHRzKHRoaXMsIG9wdHMsIHtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBVUkwgb2YgdGhlIEFQSSBlLmcuIGh0dHA6Ly9hcGkuZ2l0aHViLmNvbVxuICAgICAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAgICAgKi9cbiAgICAgICAgYmFzZVVSTDogJydcbiAgICB9KTtcblxuICAgIF8uZXh0ZW5kKHRoaXMsIHtcbiAgICAgICAgbmFtZTogbmFtZSxcbiAgICAgICAgX3Jhd01vZGVsczoge30sXG4gICAgICAgIF9tb2RlbHM6IHt9LFxuICAgICAgICBfb3B0czogb3B0cyxcbiAgICAgICAgLyoqXG4gICAgICAgICAqIFNldCB0byB0cnVlIGlmIGluc3RhbGxhdGlvbiBoYXMgc3VjY2VlZGVkLiBZb3UgY2Fubm90IHVzZSB0aGUgY29sbGVjdGlvXG4gICAgICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAgICAgKi9cbiAgICAgICAgaW5zdGFsbGVkOiBmYWxzZVxuICAgIH0pO1xuXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnRpZXModGhpcywge1xuICAgICAgICBkaXJ0eToge1xuICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgaWYgKHNpZXN0YS5leHQuc3RvcmFnZUVuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHVuc2F2ZWRPYmplY3RzQnlDb2xsZWN0aW9uID0gc2llc3RhLmV4dC5zdG9yYWdlLl91bnNhdmVkT2JqZWN0c0J5Q29sbGVjdGlvbixcbiAgICAgICAgICAgICAgICAgICAgICAgIGhhc2ggPSB1bnNhdmVkT2JqZWN0c0J5Q29sbGVjdGlvbltzZWxmLm5hbWVdIHx8IHt9O1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gISFPYmplY3Qua2V5cyhoYXNoKS5sZW5ndGg7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2UgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlXG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIENvbGxlY3Rpb25SZWdpc3RyeS5yZWdpc3Rlcih0aGlzKTtcbiAgICBldmVudHMuUHJveHlFdmVudEVtaXR0ZXIuY2FsbCh0aGlzLCB0aGlzLm5hbWUpO1xufVxuXG5Db2xsZWN0aW9uLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoZXZlbnRzLlByb3h5RXZlbnRFbWl0dGVyLnByb3RvdHlwZSk7XG5cbl8uZXh0ZW5kKENvbGxlY3Rpb24ucHJvdG90eXBlLCB7XG4gICAgLyoqXG4gICAgICogRW5zdXJlIG1hcHBpbmdzIGFyZSBpbnN0YWxsZWQuXG4gICAgICogQHBhcmFtIFtjYWxsYmFja11cbiAgICAgKiBAY2xhc3MgQ29sbGVjdGlvblxuICAgICAqL1xuICAgIGluc3RhbGw6IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgICAgICB2YXIgZGVmZXJyZWQgPSB1dGlsLmRlZmVyKGNhbGxiYWNrKTtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICBpZiAoIXRoaXMuaW5zdGFsbGVkKSB7XG4gICAgICAgICAgICB2YXIgbW9kZWxzVG9JbnN0YWxsID0gW107XG4gICAgICAgICAgICBmb3IgKHZhciBuYW1lIGluIHRoaXMuX21vZGVscykge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLl9tb2RlbHMuaGFzT3duUHJvcGVydHkobmFtZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIG1vZGVsID0gdGhpcy5fbW9kZWxzW25hbWVdO1xuICAgICAgICAgICAgICAgICAgICBtb2RlbHNUb0luc3RhbGwucHVzaChtb2RlbCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKExvZ2dlci5pbmZvLmlzRW5hYmxlZClcbiAgICAgICAgICAgICAgICBMb2dnZXIuaW5mbygnVGhlcmUgYXJlICcgKyBtb2RlbHNUb0luc3RhbGwubGVuZ3RoLnRvU3RyaW5nKCkgKyAnIG1hcHBpbmdzIHRvIGluc3RhbGwnKTtcbiAgICAgICAgICAgIGlmIChtb2RlbHNUb0luc3RhbGwubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgdmFyIHRhc2tzID0gXy5tYXAobW9kZWxzVG9JbnN0YWxsLCBmdW5jdGlvbiAobSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gXy5iaW5kKG0uaW5zdGFsbCwgbSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgdXRpbC5hc3luYy5wYXJhbGxlbCh0YXNrcywgZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBMb2dnZXIuZXJyb3IoJ0ZhaWxlZCB0byBpbnN0YWxsIGNvbGxlY3Rpb24nLCBlcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgc2VsZi5fZmluYWxpc2VJbnN0YWxsYXRpb24oZXJyLCBkZWZlcnJlZC5maW5pc2guYmluZChkZWZlcnJlZCkpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2VsZi5pbnN0YWxsZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGVycm9ycyA9IFtdO1xuICAgICAgICAgICAgICAgICAgICAgICAgXy5lYWNoKG1vZGVsc1RvSW5zdGFsbCwgZnVuY3Rpb24gKG0pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoTG9nZ2VyLmluZm8uaXNFbmFibGVkKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBMb2dnZXIuaW5mbygnSW5zdGFsbGluZyByZWxhdGlvbnNoaXBzIGZvciBtYXBwaW5nIHdpdGggbmFtZSBcIicgKyBtLm5hbWUgKyAnXCInKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgZXJyID0gbS5pbnN0YWxsUmVsYXRpb25zaGlwcygpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIGVycm9ycy5wdXNoKGVycik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghZXJyb3JzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIF8uZWFjaChtb2RlbHNUb0luc3RhbGwsIGZ1bmN0aW9uIChtKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChMb2dnZXIuaW5mby5pc0VuYWJsZWQpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBMb2dnZXIuaW5mbygnSW5zdGFsbGluZyByZXZlcnNlIHJlbGF0aW9uc2hpcHMgZm9yIG1hcHBpbmcgd2l0aCBuYW1lIFwiJyArIG0ubmFtZSArICdcIicpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgZXJyID0gbS5pbnN0YWxsUmV2ZXJzZVJlbGF0aW9uc2hpcHMoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVycikgZXJyb3JzLnB1c2goZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlcnJvcnMubGVuZ3RoID09IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlcnIgPSBlcnJvcnNbMF07XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGVycm9ycy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlcnIgPSBlcnJvcnM7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBzZWxmLl9maW5hbGlzZUluc3RhbGxhdGlvbihlcnIsIGRlZmVycmVkLmZpbmlzaC5iaW5kKGRlZmVycmVkKSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBzZWxmLl9maW5hbGlzZUluc3RhbGxhdGlvbihudWxsLCBkZWZlcnJlZC5maW5pc2guYmluZChkZWZlcnJlZCkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ0NvbGxlY3Rpb24gXCInICsgdGhpcy5uYW1lICsgJ1wiIGhhcyBhbHJlYWR5IGJlZW4gaW5zdGFsbGVkJyk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIE1hcmsgdGhpcyBjb2xsZWN0aW9uIGFzIGluc3RhbGxlZCwgYW5kIHBsYWNlIHRoZSBjb2xsZWN0aW9uIG9uIHRoZSBnbG9iYWwgU2llc3RhIG9iamVjdC5cbiAgICAgKiBAcGFyYW0gIHtPYmplY3R9ICAgZXJyXG4gICAgICogQHBhcmFtICB7RnVuY3Rpb259IGNhbGxiYWNrXG4gICAgICogQGNsYXNzIENvbGxlY3Rpb25cbiAgICAgKi9cbiAgICBfZmluYWxpc2VJbnN0YWxsYXRpb246IGZ1bmN0aW9uIChlcnIsIGNhbGxiYWNrKSB7XG4gICAgICAgIGlmIChlcnIpIGVyciA9IGNvbnN0cnVjdEVycm9yKCdFcnJvcnMgd2VyZSBlbmNvdW50ZXJlZCB3aGlsc3Qgc2V0dGluZyB1cCB0aGUgY29sbGVjdGlvbicsIHtlcnJvcnM6IGVycn0pO1xuICAgICAgICBpZiAoIWVycikge1xuICAgICAgICAgICAgdGhpcy5pbnN0YWxsZWQgPSB0cnVlO1xuICAgICAgICAgICAgdmFyIGluZGV4ID0gcmVxdWlyZSgnLi9pbmRleCcpO1xuICAgICAgICAgICAgaW5kZXhbdGhpcy5uYW1lXSA9IHRoaXM7XG4gICAgICAgIH1cbiAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIEdpdmVuIHRoZSBuYW1lIG9mIGEgbWFwcGluZyBhbmQgYW4gb3B0aW9ucyBvYmplY3QgZGVzY3JpYmluZyB0aGUgbWFwcGluZywgY3JlYXRpbmcgYSBNb2RlbFxuICAgICAqIG9iamVjdCwgaW5zdGFsbCBpdCBhbmQgcmV0dXJuIGl0LlxuICAgICAqIEBwYXJhbSAge1N0cmluZ30gbmFtZVxuICAgICAqIEBwYXJhbSAge09iamVjdH0gb3B0c1xuICAgICAqIEByZXR1cm4ge01vZGVsfVxuICAgICAqIEBjbGFzcyBDb2xsZWN0aW9uXG4gICAgICovXG4gICAgX21vZGVsOiBmdW5jdGlvbiAobmFtZSwgb3B0cykge1xuICAgICAgICBpZiAobmFtZSkge1xuICAgICAgICAgICAgdGhpcy5fcmF3TW9kZWxzW25hbWVdID0gb3B0cztcbiAgICAgICAgICAgIG9wdHMgPSBleHRlbmQodHJ1ZSwge30sIG9wdHMpO1xuICAgICAgICAgICAgb3B0cy5uYW1lID0gbmFtZTtcbiAgICAgICAgICAgIG9wdHMuY29sbGVjdGlvbiA9IHRoaXM7XG4gICAgICAgICAgICB2YXIgbW9kZWwgPSBuZXcgTW9kZWwob3B0cyk7XG4gICAgICAgICAgICB0aGlzLl9tb2RlbHNbbmFtZV0gPSBtb2RlbDtcbiAgICAgICAgICAgIHRoaXNbbmFtZV0gPSBtb2RlbDtcbiAgICAgICAgICAgIHJldHVybiBtb2RlbDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignTm8gbmFtZSBzcGVjaWZpZWQgd2hlbiBjcmVhdGluZyBtYXBwaW5nJyk7XG4gICAgICAgIH1cbiAgICB9LFxuXG5cbiAgICAvKipcbiAgICAgKiBSZWdpc3RlcnMgYSBtb2RlbCB3aXRoIHRoaXMgY29sbGVjdGlvbi5cbiAgICAgKiBAcGFyYW0ge1N0cmluZ3xPYmplY3R9IG9wdHNPck5hbWUgQW4gb3B0aW9ucyBvYmplY3Qgb3IgdGhlIG5hbWUgb2YgdGhlIG1hcHBpbmcuIE11c3QgcGFzcyBvcHRpb25zIGFzIHNlY29uZCBwYXJhbSBpZiBzcGVjaWZ5IG5hbWUuXG4gICAgICogQHBhcmFtIHtPYmplY3R9IG9wdHMgT3B0aW9ucyBpZiBuYW1lIGFscmVhZHkgc3BlY2lmaWVkLlxuICAgICAqIEByZXR1cm4ge01vZGVsfVxuICAgICAqIEBjbGFzcyBDb2xsZWN0aW9uXG4gICAgICovXG4gICAgbW9kZWw6IGZ1bmN0aW9uIChvcCkge1xuICAgICAgICB2YXIgYWNjZXB0TW9kZWxzID0gIXRoaXMuaW5zdGFsbGVkO1xuICAgICAgICBpZiAoYWNjZXB0TW9kZWxzKSB7XG4gICAgICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgICAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHV0aWwuaXNBcnJheShhcmd1bWVudHNbMF0pKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gXy5tYXAoYXJndW1lbnRzWzBdLCBmdW5jdGlvbiAobSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBzZWxmLl9tb2RlbChtLm5hbWUsIG0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgbmFtZSwgb3B0cztcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh1dGlsLmlzU3RyaW5nKGFyZ3VtZW50c1swXSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBuYW1lID0gYXJndW1lbnRzWzBdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9wdHMgPSB7fTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9wdHMgPSBhcmd1bWVudHNbMF07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbmFtZSA9IG9wdHMubmFtZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLl9tb2RlbChuYW1lLCBvcHRzKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgYXJndW1lbnRzWzBdID09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5fbW9kZWwoYXJndW1lbnRzWzBdLCBhcmd1bWVudHNbMV0pO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIF8ubWFwKGFyZ3VtZW50cywgZnVuY3Rpb24gKG0pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gc2VsZi5fbW9kZWwobS5uYW1lLCBtKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgRXJyb3IoJ0Nhbm5vdCBjcmVhdGUgbmV3IG1vZGVscyBvbmNlIHRoZSBvYmplY3QgZ3JhcGggaXMgZXN0YWJsaXNoZWQhJyk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSxcblxuICAgIGRlc2NyaXB0b3I6IGZ1bmN0aW9uIChvcHRzKSB7XG4gICAgICAgIHZhciBkZXNjcmlwdG9ycyA9IFtdO1xuICAgICAgICBpZiAoc2llc3RhLmV4dC5odHRwRW5hYmxlZCkge1xuICAgICAgICAgICAgb3B0cy5jb2xsZWN0aW9uID0gdGhpcztcbiAgICAgICAgICAgIHZhciBtZXRob2RzID0gc2llc3RhLmV4dC5odHRwLl9yZXNvbHZlTWV0aG9kKG9wdHMubWV0aG9kKTtcbiAgICAgICAgICAgIHZhciB1bnNhZmUgPSBbXTtcbiAgICAgICAgICAgIHZhciBzYWZlID0gW107XG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IG1ldGhvZHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICB2YXIgbSA9IG1ldGhvZHNbaV07XG4gICAgICAgICAgICAgICAgaWYgKFVOU0FGRV9NRVRIT0RTLmluZGV4T2YobSkgPiAtMSkge1xuICAgICAgICAgICAgICAgICAgICB1bnNhZmUucHVzaChtKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBzYWZlLnB1c2gobSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHVuc2FmZS5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICB2YXIgcmVxdWVzdERlc2NyaXB0b3IgPSBleHRlbmQoe30sIG9wdHMpO1xuICAgICAgICAgICAgICAgIHJlcXVlc3REZXNjcmlwdG9yLm1ldGhvZCA9IHVuc2FmZTtcbiAgICAgICAgICAgICAgICByZXF1ZXN0RGVzY3JpcHRvciA9IG5ldyBzaWVzdGEuZXh0Lmh0dHAuUmVxdWVzdERlc2NyaXB0b3IocmVxdWVzdERlc2NyaXB0b3IpO1xuICAgICAgICAgICAgICAgIHNpZXN0YS5leHQuaHR0cC5EZXNjcmlwdG9yUmVnaXN0cnkucmVnaXN0ZXJSZXF1ZXN0RGVzY3JpcHRvcihyZXF1ZXN0RGVzY3JpcHRvcik7XG4gICAgICAgICAgICAgICAgZGVzY3JpcHRvcnMucHVzaChyZXF1ZXN0RGVzY3JpcHRvcik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoc2FmZS5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICB2YXIgcmVzcG9uc2VEZXNjcmlwdG9yID0gZXh0ZW5kKHt9LCBvcHRzKTtcbiAgICAgICAgICAgICAgICByZXNwb25zZURlc2NyaXB0b3IubWV0aG9kID0gc2FmZTtcbiAgICAgICAgICAgICAgICByZXNwb25zZURlc2NyaXB0b3IgPSBuZXcgc2llc3RhLmV4dC5odHRwLlJlc3BvbnNlRGVzY3JpcHRvcihyZXNwb25zZURlc2NyaXB0b3IpO1xuICAgICAgICAgICAgICAgIHNpZXN0YS5leHQuaHR0cC5EZXNjcmlwdG9yUmVnaXN0cnkucmVnaXN0ZXJSZXNwb25zZURlc2NyaXB0b3IocmVzcG9uc2VEZXNjcmlwdG9yKTtcbiAgICAgICAgICAgICAgICBkZXNjcmlwdG9ycy5wdXNoKHJlc3BvbnNlRGVzY3JpcHRvcik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0hUVFAgbW9kdWxlIG5vdCBpbnN0YWxsZWQuJyk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGRlc2NyaXB0b3JzO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBEdW1wIHRoaXMgY29sbGVjdGlvbiBhcyBKU09OXG4gICAgICogQHBhcmFtICB7Qm9vbGVhbn0gYXNKc29uIFdoZXRoZXIgb3Igbm90IHRvIGFwcGx5IEpTT04uc3RyaW5naWZ5XG4gICAgICogQHJldHVybiB7U3RyaW5nfE9iamVjdH1cbiAgICAgKiBAY2xhc3MgQ29sbGVjdGlvblxuICAgICAqL1xuICAgIF9kdW1wOiBmdW5jdGlvbiAoYXNKc29uKSB7XG4gICAgICAgIHZhciBvYmogPSB7fTtcbiAgICAgICAgb2JqLmluc3RhbGxlZCA9IHRoaXMuaW5zdGFsbGVkO1xuICAgICAgICBvYmouZG9jSWQgPSB0aGlzLl9kb2NJZDtcbiAgICAgICAgb2JqLm5hbWUgPSB0aGlzLm5hbWU7XG4gICAgICAgIG9iai5iYXNlVVJMID0gdGhpcy5iYXNlVVJMO1xuICAgICAgICByZXR1cm4gYXNKc29uID8gdXRpbC5wcmV0dHlQcmludChvYmopIDogb2JqO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRoZSBudW1iZXIgb2Ygb2JqZWN0cyBpbiB0aGlzIGNvbGxlY3Rpb24uXG4gICAgICpcbiAgICAgKiBAcGFyYW0gY2FsbGJhY2tcbiAgICAgKiBAcmV0dXJucyB7UHJvbWlzZX1cbiAgICAgKi9cbiAgICBjb3VudDogZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgICAgIHZhciBkZWZlcnJlZCA9IHV0aWwuZGVmZXIoY2FsbGJhY2spO1xuICAgICAgICB2YXIgdGFza3MgPSBfLm1hcCh0aGlzLl9tb2RlbHMsIGZ1bmN0aW9uIChtKSB7XG4gICAgICAgICAgICByZXR1cm4gXy5iaW5kKG0uY291bnQsIG0pO1xuICAgICAgICB9KTtcbiAgICAgICAgdXRpbC5hc3luYy5wYXJhbGxlbCh0YXNrcywgZnVuY3Rpb24gKGVyciwgbnMpIHtcbiAgICAgICAgICAgIHZhciBuO1xuICAgICAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgICAgICBuID0gXy5yZWR1Y2UobnMsIGZ1bmN0aW9uIChtLCByKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBtICsgclxuICAgICAgICAgICAgICAgIH0sIDApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZGVmZXJyZWQuZmluaXNoKGVyciwgbik7XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbiAgICB9XG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBDb2xsZWN0aW9uOyIsIi8qKlxuICogQG1vZHVsZSBjb2xsZWN0aW9uXG4gKi9cbnZhciBfID0gcmVxdWlyZSgnLi91dGlsJykuXztcblxuZnVuY3Rpb24gQ29sbGVjdGlvblJlZ2lzdHJ5KCkge1xuICAgIGlmICghdGhpcykgcmV0dXJuIG5ldyBDb2xsZWN0aW9uUmVnaXN0cnkoKTtcbiAgICB0aGlzLmNvbGxlY3Rpb25OYW1lcyA9IFtdO1xufVxuXG5fLmV4dGVuZChDb2xsZWN0aW9uUmVnaXN0cnkucHJvdG90eXBlLCB7XG4gICAgcmVnaXN0ZXI6IGZ1bmN0aW9uIChjb2xsZWN0aW9uKSB7XG4gICAgICAgIHZhciBuYW1lID0gY29sbGVjdGlvbi5uYW1lO1xuICAgICAgICB0aGlzW25hbWVdID0gY29sbGVjdGlvbjtcbiAgICAgICAgdGhpcy5jb2xsZWN0aW9uTmFtZXMucHVzaChuYW1lKTtcbiAgICB9LFxuICAgIHJlc2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgXy5lYWNoKHRoaXMuY29sbGVjdGlvbk5hbWVzLCBmdW5jdGlvbiAobmFtZSkge1xuICAgICAgICAgICAgZGVsZXRlIHNlbGZbbmFtZV07XG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLmNvbGxlY3Rpb25OYW1lcyA9IFtdO1xuICAgIH1cbn0pO1xuXG5leHBvcnRzLkNvbGxlY3Rpb25SZWdpc3RyeSA9IG5ldyBDb2xsZWN0aW9uUmVnaXN0cnkoKTsiLCIvKipcbiAqIEBtb2R1bGUgZXJyb3JcbiAqL1xuXG5cbi8qKlxuICogUmVwcmVzZW50cyBpbnRlcm5hbCBlcnJvcnMuIFRoZXNlIGFyZSB0aHJvd24gd2hlbiBzb21ldGhpbmcgaGFzIGdvbmUgdmVyeSB3cm9uZyBpbnRlcm5hbGx5LiBJZiB5b3Ugc2VlIG9uZSBvZiB0aGVzZVxuICogb3V0IGluIHRoZSB3aWxkIHlvdSBwcm9iYWJseSBuZWVkIHRvIGZpbGUgYSBidWcgcmVwb3J0IGFzIGl0IG1lYW5zIHNvbWUgYXNzZXJ0aW9uIGhhcyBmYWlsZWQuXG4gKiBAcGFyYW0gbWVzc2FnZVxuICogQHBhcmFtIGNvbnRleHRcbiAqIEBwYXJhbSBzc2ZcbiAqIEBjb25zdHJ1Y3RvclxuICovXG5mdW5jdGlvbiBJbnRlcm5hbFNpZXN0YUVycm9yKG1lc3NhZ2UsIGNvbnRleHQsIHNzZikge1xuICAgIHRoaXMubWVzc2FnZSA9IG1lc3NhZ2U7XG4gICAgdGhpcy5jb250ZXh0ID0gY29udGV4dDtcbiAgICAvLyBjYXB0dXJlIHN0YWNrIHRyYWNlXG4gICAgc3NmID0gc3NmIHx8IGFyZ3VtZW50cy5jYWxsZWU7XG4gICAgaWYgKHNzZiAmJiBFcnJvci5jYXB0dXJlU3RhY2tUcmFjZSkge1xuICAgICAgICBFcnJvci5jYXB0dXJlU3RhY2tUcmFjZSh0aGlzLCBzc2YpO1xuICAgIH1cbn1cblxuSW50ZXJuYWxTaWVzdGFFcnJvci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKEVycm9yLnByb3RvdHlwZSk7XG5JbnRlcm5hbFNpZXN0YUVycm9yLnByb3RvdHlwZS5uYW1lID0gJ0ludGVybmFsU2llc3RhRXJyb3InO1xuSW50ZXJuYWxTaWVzdGFFcnJvci5wcm90b3R5cGUuY29uc3RydWN0b3IgPSBJbnRlcm5hbFNpZXN0YUVycm9yO1xuXG5cbi8qKlxuICogRmllbGRzIG9uIGVycm9yIG9iamVjdHMgZGlzaGVkIG91dCBieSBTaWVzdGEuXG4gKiBAdHlwZSB7T2JqZWN0fVxuICovXG52YXIgRXJyb3JGaWVsZCA9IHtcbiAgICAgICAgTWVzc2FnZTogJ21lc3NhZ2UnLFxuICAgICAgICBDb2RlOiAnY29kZSdcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIEVudW1lcmF0ZWQgZXJyb3JzLlxuICAgICAqIEB0eXBlIHtPYmplY3R9XG4gICAgICovXG4gICAgRXJyb3JDb2RlID0ge1xuICAgICAgICBVbmtub3duOiAwLFxuICAgICAgICAvLyBJZiBubyBkZXNjcmlwdG9yIG1hdGNoZXMgYSBIVFRQIHJlc3BvbnNlL3JlcXVlc3QgdGhlbiB0aGlzIGVycm9yIGlzXG4gICAgICAgIE5vRGVzY3JpcHRvck1hdGNoZWQ6IDFcbiAgICB9LFxuXG4gICAgQ29tcG9uZW50cyA9IHtcbiAgICAgICAgTWFwcGluZzogJ01hcHBpbmcnLFxuICAgICAgICBIVFRQOiAnSFRUUCcsXG4gICAgICAgIFJlYWN0aXZlUXVlcnk6ICdSZWFjdGl2ZVF1ZXJ5JyxcbiAgICAgICAgQXJyYW5nZWRSZWFjdGl2ZVF1ZXJ5OiAnQXJyYW5nZWRSZWFjdGl2ZVF1ZXJ5JyxcbiAgICAgICAgQ29sbGVjdGlvbjogJ0NvbGxlY3Rpb24nLFxuICAgICAgICBRdWVyeTogJ1F1ZXJ5J1xuICAgIH07XG5cblxuLyoqXG4gKiBAcGFyYW0gY29tcG9uZW50XG4gKiBAcGFyYW0gbWVzc2FnZVxuICogQHBhcmFtIGV4dHJhXG4gKiBAY29uc3RydWN0b3JcbiAqL1xuZnVuY3Rpb24gU2llc3RhVXNlckVycm9yKGNvbXBvbmVudCwgbWVzc2FnZSwgZXh0cmEpIHtcbiAgICBleHRyYSA9IGV4dHJhIHx8IHt9O1xuICAgIHRoaXMuY29tcG9uZW50ID0gY29tcG9uZW50O1xuICAgIHRoaXMubWVzc2FnZSA9IG1lc3NhZ2U7XG4gICAgZm9yICh2YXIgcHJvcCBpbiBleHRyYSkge1xuICAgICAgICBpZiAoZXh0cmEuaGFzT3duUHJvcGVydHkocHJvcCkpIHtcbiAgICAgICAgICAgIHRoaXNbcHJvcF0gPSBleHRyYVtwcm9wXTtcbiAgICAgICAgfVxuICAgIH1cbiAgICB0aGlzLmlzVXNlckVycm9yID0gdHJ1ZTtcbn1cblxuLyoqXG4gKiBNYXAgZXJyb3IgY29kZXMgb250byBkZXNjcmlwdGl2ZSBtZXNzYWdlcy5cbiAqIEB0eXBlIHtPYmplY3R9XG4gKi9cbnZhciBNZXNzYWdlID0ge307XG5NZXNzYWdlW0Vycm9yQ29kZS5Ob0Rlc2NyaXB0b3JNYXRjaGVkXSA9ICdObyBkZXNjcmlwdG9yIG1hdGNoZWQgdGhlIEhUVFAgcmVzcG9uc2UvcmVxdWVzdC4nO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgICBJbnRlcm5hbFNpZXN0YUVycm9yOiBJbnRlcm5hbFNpZXN0YUVycm9yLFxuICAgIFNpZXN0YVVzZXJFcnJvcjogU2llc3RhVXNlckVycm9yLFxuICAgIEVycm9yQ29kZTogRXJyb3JDb2RlLFxuICAgIEVycm9yRmllbGQ6IEVycm9yRmllbGQsXG4gICAgTWVzc2FnZTogTWVzc2FnZSxcbiAgICBDb21wb25lbnRzOiBDb21wb25lbnRzLFxuICAgIGVycm9yRmFjdG9yeTogZnVuY3Rpb24gKGNvbXBvbmVudCkge1xuICAgICAgICBpZiAoY29tcG9uZW50IGluIENvbXBvbmVudHMpIHtcbiAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbiAobWVzc2FnZSwgZXh0cmEpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbmV3IFNpZXN0YVVzZXJFcnJvcihjb21wb25lbnQsIG1lc3NhZ2UsIGV4dHJhKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgbmV3IFNpZXN0YVVzZXJFcnJvcignTm8gc3VjaCBjb21wb25lbnQgXCInICsgY29tcG9uZW50ICsgJ1wiJyk7XG4gICAgICAgIH1cbiAgICB9XG59OyIsInZhciBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCdldmVudHMnKS5FdmVudEVtaXR0ZXIsXG4gICAgQXJyYXlPYnNlcnZlciA9IHJlcXVpcmUoJy4uL3ZlbmRvci9vYnNlcnZlLWpzL3NyYy9vYnNlcnZlJykuQXJyYXlPYnNlcnZlcixcbiAgICBfID0gcmVxdWlyZSgnLi91dGlsJykuXyxcbiAgICBtb2RlbEV2ZW50cyA9IHJlcXVpcmUoJy4vbW9kZWxFdmVudHMnKTtcblxudmFyIGV2ZW50cyA9IG5ldyBFdmVudEVtaXR0ZXIoKTtcbmV2ZW50cy5zZXRNYXhMaXN0ZW5lcnMoMTAwKTtcblxuLyoqXG4gKiBMaXN0ZW4gdG8gYSBwYXJ0aWN1bGFyIGV2ZW50IGZyb20gdGhlIFNpZXN0YSBnbG9iYWwgRXZlbnRFbWl0dGVyLlxuICogTWFuYWdlcyBpdHMgb3duIHNldCBvZiBsaXN0ZW5lcnMuXG4gKiBAY29uc3RydWN0b3JcbiAqL1xuZnVuY3Rpb24gUHJveHlFdmVudEVtaXR0ZXIoZXZlbnQpIHtcbiAgICBfLmV4dGVuZCh0aGlzLCB7XG4gICAgICAgIGV2ZW50OiBldmVudCxcbiAgICAgICAgbGlzdGVuZXJzOiB7fVxuICAgIH0pO1xufVxuXG5fLmV4dGVuZChQcm94eUV2ZW50RW1pdHRlci5wcm90b3R5cGUsIHtcbiAgICBsaXN0ZW46IGZ1bmN0aW9uICh0eXBlLCBmbikge1xuICAgICAgICBpZiAodHlwZW9mIHR5cGUgPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgZm4gPSB0eXBlO1xuICAgICAgICAgICAgdHlwZSA9IG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICB2YXIgX2ZuID0gZm47XG4gICAgICAgICAgICBmbiA9IGZ1bmN0aW9uIChlKSB7XG4gICAgICAgICAgICAgICAgZSA9IGUgfHwge307XG4gICAgICAgICAgICAgICAgaWYgKHR5cGUpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGUudHlwZSA9PSB0eXBlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBfZm4oZSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIF9mbihlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgdmFyIGxpc3RlbmVycyA9IHRoaXMubGlzdGVuZXJzO1xuICAgICAgICAgICAgaWYgKHR5cGUpIHtcbiAgICAgICAgICAgICAgICBpZiAoIWxpc3RlbmVyc1t0eXBlXSkgbGlzdGVuZXJzW3R5cGVdID0gW107XG4gICAgICAgICAgICAgICAgbGlzdGVuZXJzW3R5cGVdLnB1c2goZm4pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGV2ZW50cy5vbih0aGlzLmV2ZW50LCBmbik7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB0aGlzLl9yZW1vdmVMaXN0ZW5lcihmbiwgdHlwZSk7XG4gICAgICAgIH0uYmluZCh0aGlzKTtcbiAgICB9LFxuICAgIGxpc3Rlbk9uY2U6IGZ1bmN0aW9uICh0eXBlLCBmbikge1xuICAgICAgICB2YXIgZXZlbnQgPSB0aGlzLmV2ZW50O1xuICAgICAgICBpZiAodHlwZW9mIHR5cGUgPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgZm4gPSB0eXBlO1xuICAgICAgICAgICAgdHlwZSA9IG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICB2YXIgX2ZuID0gZm47XG4gICAgICAgICAgICBmbiA9IGZ1bmN0aW9uIChlKSB7XG4gICAgICAgICAgICAgICAgZSA9IGUgfHwge307XG4gICAgICAgICAgICAgICAgaWYgKHR5cGUpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGUudHlwZSA9PSB0eXBlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBldmVudHMucmVtb3ZlTGlzdGVuZXIoZXZlbnQsIGZuKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIF9mbihlKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgX2ZuKGUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAodHlwZSkge1xuICAgICAgICAgICAgcmV0dXJuIGV2ZW50cy5vbihldmVudCwgZm4pO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIGV2ZW50cy5vbmNlKGV2ZW50LCBmbik7XG4gICAgICAgIH1cbiAgICB9LFxuICAgIF9yZW1vdmVMaXN0ZW5lcjogZnVuY3Rpb24gKGZuLCB0eXBlKSB7XG4gICAgICAgIGlmICh0eXBlKSB7XG4gICAgICAgICAgICB2YXIgbGlzdGVuZXJzID0gdGhpcy5saXN0ZW5lcnNbdHlwZV0sXG4gICAgICAgICAgICAgICAgaWR4ID0gbGlzdGVuZXJzLmluZGV4T2YoZm4pO1xuICAgICAgICAgICAgbGlzdGVuZXJzLnNwbGljZShpZHgsIDEpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBldmVudHMucmVtb3ZlTGlzdGVuZXIodGhpcy5ldmVudCwgZm4pO1xuICAgIH0sXG4gICAgZW1pdDogZnVuY3Rpb24gKHR5cGUsIHBheWxvYWQpIHtcbiAgICAgICAgaWYgKHR5cGVvZiB0eXBlID09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICBwYXlsb2FkID0gdHlwZTtcbiAgICAgICAgICAgIHR5cGUgPSBudWxsO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgcGF5bG9hZCA9IHBheWxvYWQgfHwge307XG4gICAgICAgICAgICBwYXlsb2FkLnR5cGUgPSB0eXBlO1xuICAgICAgICB9XG4gICAgICAgIGV2ZW50cy5lbWl0LmNhbGwoZXZlbnRzLCB0aGlzLmV2ZW50LCBwYXlsb2FkKTtcbiAgICB9LFxuICAgIF9yZW1vdmVBbGxMaXN0ZW5lcnM6IGZ1bmN0aW9uICh0eXBlKSB7XG4gICAgICAgICh0aGlzLmxpc3RlbmVyc1t0eXBlXSB8fCBbXSkuZm9yRWFjaChmdW5jdGlvbiAoZm4pIHtcbiAgICAgICAgICAgIGV2ZW50cy5yZW1vdmVMaXN0ZW5lcih0aGlzLmV2ZW50LCBmbik7XG4gICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICAgIHRoaXMubGlzdGVuZXJzW3R5cGVdID0gW107XG4gICAgfSxcbiAgICByZW1vdmVBbGxMaXN0ZW5lcnM6IGZ1bmN0aW9uICh0eXBlKSB7XG4gICAgICAgIGlmICh0eXBlKSB7XG4gICAgICAgICAgICB0aGlzLl9yZW1vdmVBbGxMaXN0ZW5lcnModHlwZSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBmb3IgKHR5cGUgaW4gdGhpcy5saXN0ZW5lcnMpIHtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5saXN0ZW5lcnMuaGFzT3duUHJvcGVydHkodHlwZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fcmVtb3ZlQWxsTGlzdGVuZXJzKHR5cGUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn0pO1xuXG4vLyBBbGlhc2VzXG5fLmV4dGVuZChQcm94eUV2ZW50RW1pdHRlci5wcm90b3R5cGUsIHtcbiAgICBvbjogUHJveHlFdmVudEVtaXR0ZXIucHJvdG90eXBlLmxpc3RlblxufSk7XG5cbl8uZXh0ZW5kKGV2ZW50cywge1xuICAgIFByb3h5RXZlbnRFbWl0dGVyOiBQcm94eUV2ZW50RW1pdHRlcixcbiAgICB3cmFwQXJyYXk6IGZ1bmN0aW9uIChhcnJheSwgZmllbGQsIG1vZGVsSW5zdGFuY2UpIHtcbiAgICAgICAgaWYgKCFhcnJheS5vYnNlcnZlcikge1xuICAgICAgICAgICAgYXJyYXkub2JzZXJ2ZXIgPSBuZXcgQXJyYXlPYnNlcnZlcihhcnJheSk7XG4gICAgICAgICAgICBhcnJheS5vYnNlcnZlci5vcGVuKGZ1bmN0aW9uIChzcGxpY2VzKSB7XG4gICAgICAgICAgICAgICAgdmFyIGZpZWxkSXNBdHRyaWJ1dGUgPSBtb2RlbEluc3RhbmNlLl9hdHRyaWJ1dGVOYW1lcy5pbmRleE9mKGZpZWxkKSA+IC0xO1xuICAgICAgICAgICAgICAgIGlmIChmaWVsZElzQXR0cmlidXRlKSB7XG4gICAgICAgICAgICAgICAgICAgIHNwbGljZXMuZm9yRWFjaChmdW5jdGlvbiAoc3BsaWNlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBtb2RlbEV2ZW50cy5lbWl0KHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb2xsZWN0aW9uOiBtb2RlbEluc3RhbmNlLmNvbGxlY3Rpb25OYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1vZGVsOiBtb2RlbEluc3RhbmNlLm1vZGVsLm5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgX2lkOiBtb2RlbEluc3RhbmNlLl9pZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbmRleDogc3BsaWNlLmluZGV4LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlbW92ZWQ6IHNwbGljZS5yZW1vdmVkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFkZGVkOiBzcGxpY2UuYWRkZWRDb3VudCA/IGFycmF5LnNsaWNlKHNwbGljZS5pbmRleCwgc3BsaWNlLmluZGV4ICsgc3BsaWNlLmFkZGVkQ291bnQpIDogW10sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogbW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUuU3BsaWNlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZpZWxkOiBmaWVsZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBvYmo6IG1vZGVsSW5zdGFuY2VcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH1cbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGV2ZW50czsiLCJ2YXIgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpLFxuICAgIENvbGxlY3Rpb25SZWdpc3RyeSA9IHJlcXVpcmUoJy4vY29sbGVjdGlvblJlZ2lzdHJ5JykuQ29sbGVjdGlvblJlZ2lzdHJ5LFxuICAgIENvbGxlY3Rpb24gPSByZXF1aXJlKCcuL2NvbGxlY3Rpb24nKSxcbiAgICBjYWNoZSA9IHJlcXVpcmUoJy4vY2FjaGUnKSxcbiAgICBNb2RlbCA9IHJlcXVpcmUoJy4vbW9kZWwnKSxcbiAgICBlcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKSxcbiAgICBldmVudHMgPSByZXF1aXJlKCcuL2V2ZW50cycpLFxuICAgIFJlbGF0aW9uc2hpcFR5cGUgPSByZXF1aXJlKCcuL1JlbGF0aW9uc2hpcFR5cGUnKSxcbiAgICBSZWFjdGl2ZVF1ZXJ5ID0gcmVxdWlyZSgnLi9yZWFjdGl2ZVF1ZXJ5JyksXG4gICAgTWFueVRvTWFueVByb3h5ID0gcmVxdWlyZSgnLi9tYW55VG9NYW55UHJveHknKSxcbiAgICBPbmVUb09uZVByb3h5ID0gcmVxdWlyZSgnLi9vbmVUb09uZVByb3h5JyksXG4gICAgT25lVG9NYW55UHJveHkgPSByZXF1aXJlKCcuL29uZVRvTWFueVByb3h5JyksXG4gICAgUmVsYXRpb25zaGlwUHJveHkgPSByZXF1aXJlKCcuL3JlbGF0aW9uc2hpcFByb3h5JyksXG4gICAgbW9kZWxFdmVudHMgPSByZXF1aXJlKCcuL21vZGVsRXZlbnRzJyksXG4gICAgUXVlcnkgPSByZXF1aXJlKCcuL1F1ZXJ5JyksXG4gICAgcXVlcnlTZXQgPSByZXF1aXJlKCcuL3F1ZXJ5U2V0JyksXG4gICAgbG9nID0gcmVxdWlyZSgnLi9sb2cnKSxcbiAgICBfID0gdXRpbC5fO1xuXG5cblxuLy8gSW5pdGlhbGlzZSBzaWVzdGEgb2JqZWN0LiBTdHJhbmdlIGZvcm1hdCBmYWNpbGl0aWVzIHVzaW5nIHN1Ym1vZHVsZXMgd2l0aCByZXF1aXJlSlMgKGV2ZW50dWFsbHkpXG52YXIgc2llc3RhID0gZnVuY3Rpb24gKGV4dCkge1xuICAgIGlmICghc2llc3RhLmV4dCkgc2llc3RhLmV4dCA9IHt9O1xuICAgIF8uZXh0ZW5kKHNpZXN0YS5leHQsIGV4dCB8fCB7fSk7XG4gICAgcmV0dXJuIHNpZXN0YTtcbn07XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShzaWVzdGEsICdxJywge1xuICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcSB8fCB3aW5kb3cucSB8fCB3aW5kb3cuUVxuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbiAocSkge1xuICAgICAgICB0aGlzLl9xID0gcTtcbiAgICB9XG59KTtcblxuLy8gTm90aWZpY2F0aW9uc1xuXy5leHRlbmQoc2llc3RhLCB7XG4gICAgb246IGV2ZW50cy5vbi5iaW5kKGV2ZW50cyksXG4gICAgb2ZmOiBldmVudHMucmVtb3ZlTGlzdGVuZXIuYmluZChldmVudHMpLFxuICAgIG9uY2U6IGV2ZW50cy5vbmNlLmJpbmQoZXZlbnRzKSxcbiAgICByZW1vdmVBbGxMaXN0ZW5lcnM6IGV2ZW50cy5yZW1vdmVBbGxMaXN0ZW5lcnMuYmluZChldmVudHMpXG59KTtcbl8uZXh0ZW5kKHNpZXN0YSwge1xuICAgIHJlbW92ZUxpc3RlbmVyOiBzaWVzdGEub2ZmLFxuICAgIGFkZExpc3RlbmVyOiBzaWVzdGEub25cbn0pO1xuXG4vLyBFeHBvc2Ugc29tZSBzdHVmZiBmb3IgdXNhZ2UgYnkgZXh0ZW5zaW9ucyBhbmQvb3IgdXNlcnNcbl8uZXh0ZW5kKHNpZXN0YSwge1xuICAgIFJlbGF0aW9uc2hpcFR5cGU6IFJlbGF0aW9uc2hpcFR5cGUsXG4gICAgTW9kZWxFdmVudFR5cGU6IG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlLFxuICAgIGxvZzogbG9nLkxldmVsLFxuICAgIEluc2VydGlvblBvbGljeTogUmVhY3RpdmVRdWVyeS5JbnNlcnRpb25Qb2xpY3ksXG4gICAgX2ludGVybmFsOiB7XG4gICAgICAgIGxvZzogbG9nLFxuICAgICAgICBNb2RlbDogTW9kZWwsXG4gICAgICAgIGVycm9yOiBlcnJvcixcbiAgICAgICAgTW9kZWxFdmVudFR5cGU6IG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlLFxuICAgICAgICBNb2RlbEluc3RhbmNlOiByZXF1aXJlKCcuL21vZGVsSW5zdGFuY2UnKSxcbiAgICAgICAgZXh0ZW5kOiByZXF1aXJlKCdleHRlbmQnKSxcbiAgICAgICAgTWFwcGluZ09wZXJhdGlvbjogcmVxdWlyZSgnLi9tYXBwaW5nT3BlcmF0aW9uJyksXG4gICAgICAgIGV2ZW50czogZXZlbnRzLFxuICAgICAgICBQcm94eUV2ZW50RW1pdHRlcjogZXZlbnRzLlByb3h5RXZlbnRFbWl0dGVyLFxuICAgICAgICBjYWNoZTogcmVxdWlyZSgnLi9jYWNoZScpLFxuICAgICAgICBtb2RlbEV2ZW50czogbW9kZWxFdmVudHMsXG4gICAgICAgIENvbGxlY3Rpb25SZWdpc3RyeTogcmVxdWlyZSgnLi9jb2xsZWN0aW9uUmVnaXN0cnknKS5Db2xsZWN0aW9uUmVnaXN0cnksXG4gICAgICAgIENvbGxlY3Rpb246IENvbGxlY3Rpb24sXG4gICAgICAgIHV0aWxzOiB1dGlsLFxuICAgICAgICB1dGlsOiB1dGlsLFxuICAgICAgICBfOiB1dGlsLl8sXG4gICAgICAgIHF1ZXJ5U2V0OiBxdWVyeVNldCxcbiAgICAgICAgb2JzZXJ2ZTogcmVxdWlyZSgnLi4vdmVuZG9yL29ic2VydmUtanMvc3JjL29ic2VydmUnKSxcbiAgICAgICAgUXVlcnk6IFF1ZXJ5LFxuICAgICAgICBTdG9yZTogcmVxdWlyZSgnLi9zdG9yZScpLFxuICAgICAgICBNYW55VG9NYW55UHJveHk6IE1hbnlUb01hbnlQcm94eSxcbiAgICAgICAgT25lVG9NYW55UHJveHk6IE9uZVRvTWFueVByb3h5LFxuICAgICAgICBPbmVUb09uZVByb3h5OiBPbmVUb09uZVByb3h5LFxuICAgICAgICBSZWxhdGlvbnNoaXBQcm94eTogUmVsYXRpb25zaGlwUHJveHlcbiAgICB9LFxuICAgIF86IHV0aWwuXyxcbiAgICBhc3luYzogdXRpbC5hc3luYyxcbiAgICBpc0FycmF5OiB1dGlsLmlzQXJyYXksXG4gICAgaXNTdHJpbmc6IHV0aWwuaXNTdHJpbmdcbn0pO1xuXG5zaWVzdGEuZXh0ID0ge307XG5cbnZhciBpbnN0YWxsZWQgPSBmYWxzZSxcbiAgICBpbnN0YWxsaW5nID0gZmFsc2U7XG5cblxuXy5leHRlbmQoc2llc3RhLCB7XG4gICAgLyoqXG4gICAgICogV2lwZSBldmVyeXRoaW5nLiBVc2VkIGR1cmluZyB0ZXN0IGdlbmVyYWxseS5cbiAgICAgKi9cbiAgICByZXNldDogZnVuY3Rpb24gKGNiKSB7XG4gICAgICAgIGluc3RhbGxlZCA9IGZhbHNlO1xuICAgICAgICBpbnN0YWxsaW5nID0gZmFsc2U7XG4gICAgICAgIGRlbGV0ZSB0aGlzLnF1ZXVlZFRhc2tzO1xuICAgICAgICBjYWNoZS5yZXNldCgpO1xuICAgICAgICBDb2xsZWN0aW9uUmVnaXN0cnkucmVzZXQoKTtcbiAgICAgICAgZXZlbnRzLnJlbW92ZUFsbExpc3RlbmVycygpO1xuICAgICAgICBpZiAoc2llc3RhLmV4dC5odHRwRW5hYmxlZCkge1xuICAgICAgICAgICAgc2llc3RhLmV4dC5odHRwLkRlc2NyaXB0b3JSZWdpc3RyeS5yZXNldCgpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChzaWVzdGEuZXh0LnN0b3JhZ2VFbmFibGVkKSB7XG4gICAgICAgICAgICBzaWVzdGEuZXh0LnN0b3JhZ2UuX3Jlc2V0KGNiKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGNiKCk7XG4gICAgICAgIH1cbiAgICB9LFxuICAgIC8qKlxuICAgICAqIFJlbW92ZXMgYWxsIGRhdGEuIFVzZWQgZHVyaW5nIHRlc3RzIGdlbmVyYWxseS5cbiAgICAgKiBAcGFyYW0gW2NiXVxuICAgICAqL1xuICAgIHJlc2V0RGF0YTogZnVuY3Rpb24gKGNiKSB7XG4gICAgICAgIHZhciBkZWZlcnJlZCA9IHV0aWwuZGVmZXIoY2IpO1xuICAgICAgICBjYiA9IGRlZmVycmVkLmZpbmlzaC5iaW5kKGRlZmVycmVkKTtcbiAgICAgICAgc2llc3RhLmV4dC5zdG9yYWdlLl9yZXNldChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB2YXIgY29sbGVjdGlvbk5hbWVzID0gW10sXG4gICAgICAgICAgICAgICAgdGFza3MgPSBDb2xsZWN0aW9uUmVnaXN0cnkuY29sbGVjdGlvbk5hbWVzLnJlZHVjZShmdW5jdGlvbiAobWVtbywgY29sbGVjdGlvbk5hbWUpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGNvbGxlY3Rpb24gPSBDb2xsZWN0aW9uUmVnaXN0cnlbY29sbGVjdGlvbk5hbWVdLFxuICAgICAgICAgICAgICAgICAgICAgICAgbW9kZWxzID0gY29sbGVjdGlvbi5fbW9kZWxzO1xuICAgICAgICAgICAgICAgICAgICBjb2xsZWN0aW9uTmFtZXMucHVzaChjb2xsZWN0aW9uTmFtZSk7XG4gICAgICAgICAgICAgICAgICAgIE9iamVjdC5rZXlzKG1vZGVscykuZm9yRWFjaChmdW5jdGlvbiAoaykge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG1vZGVsID0gbW9kZWxzW2tdO1xuICAgICAgICAgICAgICAgICAgICAgICAgbWVtby5wdXNoKGZ1bmN0aW9uIChkb25lKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbW9kZWwuYWxsKGZ1bmN0aW9uIChlcnIsIHJlcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWVycikgcmVzLnJlbW92ZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkb25lKGVycik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBtZW1vO1xuICAgICAgICAgICAgICAgIH0sIFtdKTtcbiAgICAgICAgICAgIHV0aWwuYXN5bmMuc2VyaWVzKFxuICAgICAgICAgICAgICAgIFtcbiAgICAgICAgICAgICAgICAgICAgXy5wYXJ0aWFsKHV0aWwuYXN5bmMucGFyYWxsZWwsIHRhc2tzKVxuICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgICAgY2IpO1xuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIGFuZCByZWdpc3RlcnMgYSBuZXcgQ29sbGVjdGlvbi5cbiAgICAgKiBAcGFyYW0gIHtTdHJpbmd9IG5hbWVcbiAgICAgKiBAcGFyYW0gIHtPYmplY3R9IFtvcHRzXVxuICAgICAqIEByZXR1cm4ge0NvbGxlY3Rpb259XG4gICAgICovXG4gICAgY29sbGVjdGlvbjogZnVuY3Rpb24gKG5hbWUsIG9wdHMpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBDb2xsZWN0aW9uKG5hbWUsIG9wdHMpO1xuICAgIH0sXG4gICAgLyoqXG4gICAgICogSW5zdGFsbCBhbGwgY29sbGVjdGlvbnMuXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gW2NiXVxuICAgICAqIEByZXR1cm5zIHtxLlByb21pc2V9XG4gICAgICovXG4gICAgaW5zdGFsbDogZnVuY3Rpb24gKGNiKSB7XG4gICAgICAgIGlmICghKGluc3RhbGxpbmcgfHwgaW5zdGFsbGVkKSkge1xuICAgICAgICAgICAgaW5zdGFsbGluZyA9IHRydWU7XG4gICAgICAgICAgICB2YXIgZGVmZXJyZWQgPSB1dGlsLmRlZmVyKGNiKTtcbiAgICAgICAgICAgIGNiID0gZGVmZXJyZWQuZmluaXNoLmJpbmQoZGVmZXJyZWQpO1xuXG4gICAgICAgICAgICB2YXIgY29sbGVjdGlvbk5hbWVzID0gQ29sbGVjdGlvblJlZ2lzdHJ5LmNvbGxlY3Rpb25OYW1lcyxcbiAgICAgICAgICAgICAgICBjb2xsZWN0aW9uSW5zdGFsbFRhc2tzID0gXy5tYXAoY29sbGVjdGlvbk5hbWVzLCBmdW5jdGlvbiAobikge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZnVuY3Rpb24gKGRvbmUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIENvbGxlY3Rpb25SZWdpc3RyeVtuXS5pbnN0YWxsKGRvbmUpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgICAgICBzaWVzdGEuYXN5bmMuc2VyaWVzKGNvbGxlY3Rpb25JbnN0YWxsVGFza3MsIGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGNiKGVycik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBpZiAoc2llc3RhLmV4dC5odHRwRW5hYmxlZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGVycm9ycyA9IFtdO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBmdW5jdGlvbiBzZXR1cERlc2NyaXB0b3JzKGRlc2NyaXB0b3JzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgT2JqZWN0LmtleXMoZGVzY3JpcHRvcnMpLmZvckVhY2goZnVuY3Rpb24gKGNvbGxlY3Rpb25OYW1lKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBkZXNjcmlwdG9yc0ZvckNvbGxlY3Rpb24gPSBkZXNjcmlwdG9yc1tjb2xsZWN0aW9uTmFtZV07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0b3JzRm9yQ29sbGVjdGlvbi5mb3JFYWNoKGZ1bmN0aW9uIChkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgZXJyb3IgPSBkLl9yZXNvbHZlQ29sbGVjdGlvbkFuZE1vZGVsKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnZXJyb3InLCBlcnJvcik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXJyb3IpIGVycm9ycy5wdXNoKGVycm9yKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBkZXNjcmlwdG9yUmVnaXN0cnkgPSBzaWVzdGEuZXh0Lmh0dHAuRGVzY3JpcHRvclJlZ2lzdHJ5LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlcXVlc3REZXNjcmlwdG9ycyA9IGRlc2NyaXB0b3JSZWdpc3RyeS5yZXF1ZXN0RGVzY3JpcHRvcnMsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzcG9uc2VEZXNjcmlwdG9ycyA9IGRlc2NyaXB0b3JSZWdpc3RyeS5yZXNwb25zZURlc2NyaXB0b3JzO1xuICAgICAgICAgICAgICAgICAgICAgICAgc2V0dXBEZXNjcmlwdG9ycyhyZXF1ZXN0RGVzY3JpcHRvcnMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgc2V0dXBEZXNjcmlwdG9ycyhyZXNwb25zZURlc2NyaXB0b3JzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdlcnJvcnMnLCBlcnJvcnMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVycm9ycy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYihlcnJvcnMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAoc2llc3RhLmV4dC5zdG9yYWdlRW5hYmxlZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2llc3RhLmV4dC5zdG9yYWdlLl9sb2FkKGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbnN0YWxsZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoc2VsZi5xdWV1ZWRUYXNrcykgc2VsZi5xdWV1ZWRUYXNrcy5leGVjdXRlKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNiKGVycik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGluc3RhbGxlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoc2VsZi5xdWV1ZWRUYXNrcykgc2VsZi5xdWV1ZWRUYXNrcy5leGVjdXRlKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjYigpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgZXJyb3IuSW50ZXJuYWxTaWVzdGFFcnJvcignQWxyZWFkeSBpbnN0YWxsaW5nLi4uJyk7XG4gICAgICAgIH1cbiAgICB9LFxuICAgIF9wdXNoVGFzazogZnVuY3Rpb24gKHRhc2spIHtcbiAgICAgICAgaWYgKCF0aGlzLnF1ZXVlZFRhc2tzKSB7XG4gICAgICAgICAgICB0aGlzLnF1ZXVlZFRhc2tzID0gbmV3IGZ1bmN0aW9uIFF1ZXVlKCkge1xuICAgICAgICAgICAgICAgIHRoaXMudGFza3MgPSBbXTtcbiAgICAgICAgICAgICAgICB0aGlzLmV4ZWN1dGUgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMudGFza3MuZm9yRWFjaChmdW5jdGlvbiAoZikge1xuICAgICAgICAgICAgICAgICAgICAgICAgZigpXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnRhc2tzID0gW107XG4gICAgICAgICAgICAgICAgfS5iaW5kKHRoaXMpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnF1ZXVlZFRhc2tzLnRhc2tzLnB1c2godGFzayk7XG4gICAgfSxcbiAgICBfYWZ0ZXJJbnN0YWxsOiBmdW5jdGlvbiAodGFzaykge1xuICAgICAgICBpZiAoIWluc3RhbGxlZCkge1xuICAgICAgICAgICAgaWYgKCFpbnN0YWxsaW5nKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5pbnN0YWxsKGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGVycikgY29uc29sZS5lcnJvcignRXJyb3Igc2V0dGluZyB1cCBzaWVzdGEnLCBlcnIpO1xuICAgICAgICAgICAgICAgICAgICBkZWxldGUgdGhpcy5xdWV1ZWRUYXNrcztcbiAgICAgICAgICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gSW4gY2FzZSBpbnN0YWxsZWQgc3RyYWlnaHQgYXdheSBlLmcuIGlmIHN0b3JhZ2UgZXh0ZW5zaW9uIG5vdCBpbnN0YWxsZWQuXG4gICAgICAgICAgICBpZiAoIWluc3RhbGxlZCkgdGhpcy5fcHVzaFRhc2sodGFzayk7XG4gICAgICAgICAgICBlbHNlIHRhc2soKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHRhc2soKTtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgc2V0TG9nTGV2ZWw6IGZ1bmN0aW9uIChsb2dnZXJOYW1lLCBsZXZlbCkge1xuICAgICAgICB2YXIgTG9nZ2VyID0gbG9nLmxvZ2dlcldpdGhOYW1lKGxvZ2dlck5hbWUpO1xuICAgICAgICBMb2dnZXIuc2V0TGV2ZWwobGV2ZWwpO1xuICAgIH0sXG4gICAgbm90aWZ5OiB1dGlsLm5leHQsXG4gICAgcmVnaXN0ZXJDb21wYXJhdG9yOiBRdWVyeS5iaW5kKFF1ZXJ5KVxufSk7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKHNpZXN0YSwge1xuICAgIF9jYW5DaGFuZ2U6IHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gIShpbnN0YWxsaW5nIHx8IGluc3RhbGxlZCk7XG4gICAgICAgIH1cbiAgICB9XG59KTtcblxuaWYgKHR5cGVvZiB3aW5kb3cgIT0gJ3VuZGVmaW5lZCcpIHtcbiAgICB3aW5kb3dbJ3NpZXN0YSddID0gc2llc3RhO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHNpZXN0YTtcblxuLyoqXG4gKiBUT0RPOiBUaGlzIGNvdWxkIGJlIGRhbmdlcm91cz9cbiAqIFByZXR0eSBkYW1uIHVzZWZ1bCB0byBiZSBhYmxlIHRvIGFjY2VzcyB0aGUgYm91bmQgb2JqZWN0IG9uIGEgZnVuY3Rpb24gdGhvLlxuICogU2VlOiBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vcXVlc3Rpb25zLzE0MzA3MjY0L3doYXQtb2JqZWN0LWphdmFzY3JpcHQtZnVuY3Rpb24taXMtYm91bmQtdG8td2hhdC1pcy1pdHMtdGhpc1xuICovXG52YXIgX2JpbmQgPSBGdW5jdGlvbi5wcm90b3R5cGUuYXBwbHkuYmluZChGdW5jdGlvbi5wcm90b3R5cGUuYmluZCk7XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoRnVuY3Rpb24ucHJvdG90eXBlLCAnYmluZCcsIHtcbiAgICB2YWx1ZTogZnVuY3Rpb24ob2JqKSB7XG4gICAgICAgIHZhciBib3VuZEZ1bmN0aW9uID0gX2JpbmQodGhpcywgYXJndW1lbnRzKTtcbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KGJvdW5kRnVuY3Rpb24sICdfX3NpZXN0YV9ib3VuZF9vYmplY3QnLCB7XG4gICAgICAgICAgICB2YWx1ZTogb2JqLFxuICAgICAgICAgICAgd3JpdGFibGU6IHRydWUsXG4gICAgICAgICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICAgICAgICBlbnVtZXJhYmxlOiBmYWxzZVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIGJvdW5kRnVuY3Rpb247XG4gICAgfVxufSk7XG5cbihmdW5jdGlvbiBsb2FkRXh0ZW5zaW9ucygpIHtcbiAgICByZXF1aXJlKCcuLi9odHRwJyk7XG4gICAgcmVxdWlyZSgnLi4vc3RvcmFnZScpO1xufSkoKTtcbiIsIi8qKlxuICogRGVhZCBzaW1wbGUgbG9nZ2luZyBzZXJ2aWNlLlxuICogQG1vZHVsZSBsb2dcbiAqL1xuXG52YXIgXyA9IHJlcXVpcmUoJy4vdXRpbCcpLl87XG5cbnZhciBsb2dMZXZlbHMgPSB7fTtcblxuXG5mdW5jdGlvbiBMb2dnZXIobmFtZSkge1xuICAgIGlmICghdGhpcykgcmV0dXJuIG5ldyBMb2dnZXIobmFtZSk7XG4gICAgdGhpcy5uYW1lID0gbmFtZTtcbiAgICBsb2dMZXZlbHNbbmFtZV0gPSBMb2dnZXIuTGV2ZWwud2FybjtcbiAgICB0aGlzLnRyYWNlID0gY29uc3RydWN0UGVyZm9ybWVyKHRoaXMsIF8uYmluZChjb25zb2xlLmRlYnVnID8gY29uc29sZS5kZWJ1ZyA6IGNvbnNvbGUubG9nLCBjb25zb2xlKSwgTG9nZ2VyLkxldmVsLnRyYWNlKTtcbiAgICB0aGlzLmRlYnVnID0gY29uc3RydWN0UGVyZm9ybWVyKHRoaXMsIF8uYmluZChjb25zb2xlLmRlYnVnID8gY29uc29sZS5kZWJ1ZyA6IGNvbnNvbGUubG9nLCBjb25zb2xlKSwgTG9nZ2VyLkxldmVsLmRlYnVnKTtcbiAgICB0aGlzLmluZm8gPSBjb25zdHJ1Y3RQZXJmb3JtZXIodGhpcywgXy5iaW5kKGNvbnNvbGUuaW5mbyA/IGNvbnNvbGUuaW5mbyA6IGNvbnNvbGUubG9nLCBjb25zb2xlKSwgTG9nZ2VyLkxldmVsLmluZm8pO1xuICAgIHRoaXMubG9nID0gY29uc3RydWN0UGVyZm9ybWVyKHRoaXMsIF8uYmluZChjb25zb2xlLmxvZyA/IGNvbnNvbGUubG9nIDogY29uc29sZS5sb2csIGNvbnNvbGUpLCBMb2dnZXIuTGV2ZWwuaW5mbyk7XG4gICAgdGhpcy53YXJuID0gY29uc3RydWN0UGVyZm9ybWVyKHRoaXMsIF8uYmluZChjb25zb2xlLndhcm4gPyBjb25zb2xlLndhcm4gOiBjb25zb2xlLmxvZywgY29uc29sZSksIExvZ2dlci5MZXZlbC53YXJuaW5nKTtcbiAgICB0aGlzLmVycm9yID0gY29uc3RydWN0UGVyZm9ybWVyKHRoaXMsIF8uYmluZChjb25zb2xlLmVycm9yID8gY29uc29sZS5lcnJvciA6IGNvbnNvbGUubG9nLCBjb25zb2xlKSwgTG9nZ2VyLkxldmVsLmVycm9yKTtcbiAgICB0aGlzLmZhdGFsID0gY29uc3RydWN0UGVyZm9ybWVyKHRoaXMsIF8uYmluZChjb25zb2xlLmVycm9yID8gY29uc29sZS5lcnJvciA6IGNvbnNvbGUubG9nLCBjb25zb2xlKSwgTG9nZ2VyLkxldmVsLmZhdGFsKTtcblxufVxuXG5Mb2dnZXIuTGV2ZWwgPSB7XG4gICAgdHJhY2U6IDAsXG4gICAgZGVidWc6IDEsXG4gICAgaW5mbzogMixcbiAgICB3YXJuaW5nOiAzLFxuICAgIHdhcm46IDMsXG4gICAgZXJyb3I6IDQsXG4gICAgZmF0YWw6IDVcbn07XG5cbmZ1bmN0aW9uIGNvbnN0cnVjdFBlcmZvcm1lcihsb2dnZXIsIGYsIGxldmVsKSB7XG4gICAgdmFyIHBlcmZvcm1lciA9IGZ1bmN0aW9uIChtZXNzYWdlKSB7XG4gICAgICAgIGxvZ2dlci5wZXJmb3JtTG9nKGYsIGxldmVsLCBtZXNzYWdlLCBhcmd1bWVudHMpO1xuICAgIH07XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHBlcmZvcm1lciwgJ2lzRW5hYmxlZCcsIHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB2YXIgY3VycmVudExldmVsID0gbG9nZ2VyLmN1cnJlbnRMZXZlbCgpO1xuICAgICAgICAgICAgcmV0dXJuIGxldmVsID49IGN1cnJlbnRMZXZlbDtcbiAgICAgICAgfSxcbiAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgfSk7XG4gICAgcGVyZm9ybWVyLmYgPSBmO1xuICAgIHBlcmZvcm1lci5sb2dnZXIgPSBsb2dnZXI7XG4gICAgcGVyZm9ybWVyLmxldmVsID0gbGV2ZWw7XG4gICAgcmV0dXJuIHBlcmZvcm1lcjtcbn1cblxuXG5Mb2dnZXIuTGV2ZWxUZXh0ID0ge307XG5Mb2dnZXIuTGV2ZWxUZXh0IFtMb2dnZXIuTGV2ZWwudHJhY2VdID0gJ1RSQUNFJztcbkxvZ2dlci5MZXZlbFRleHQgW0xvZ2dlci5MZXZlbC5kZWJ1Z10gPSAnREVCVUcnO1xuTG9nZ2VyLkxldmVsVGV4dCBbTG9nZ2VyLkxldmVsLmluZm9dID0gJ0lORk8gJztcbkxvZ2dlci5MZXZlbFRleHQgW0xvZ2dlci5MZXZlbC53YXJuaW5nXSA9ICdXQVJOICc7XG5Mb2dnZXIuTGV2ZWxUZXh0IFtMb2dnZXIuTGV2ZWwuZXJyb3JdID0gJ0VSUk9SJztcblxuTG9nZ2VyLmxldmVsQXNUZXh0ID0gZnVuY3Rpb24gKGxldmVsKSB7XG4gICAgcmV0dXJuIHRoaXMuTGV2ZWxUZXh0W2xldmVsXTtcbn07XG5cbkxvZ2dlci5sb2dnZXJXaXRoTmFtZSA9IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgcmV0dXJuIG5ldyBMb2dnZXIobmFtZSk7XG59O1xuXG5Mb2dnZXIucHJvdG90eXBlLmN1cnJlbnRMZXZlbCA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgbG9nTGV2ZWwgPSBsb2dMZXZlbHNbdGhpcy5uYW1lXTtcbiAgICByZXR1cm4gbG9nTGV2ZWwgPyBsb2dMZXZlbCA6IExvZ2dlci5MZXZlbC50cmFjZTtcbn07XG5cbkxvZ2dlci5wcm90b3R5cGUuc2V0TGV2ZWwgPSBmdW5jdGlvbiAobGV2ZWwpIHtcbiAgICBsb2dMZXZlbHNbdGhpcy5uYW1lXSA9IGxldmVsO1xufTtcblxuTG9nZ2VyLnByb3RvdHlwZS5vdmVycmlkZSA9IGZ1bmN0aW9uIChsZXZlbCwgb3ZlcnJpZGUsIG1lc3NhZ2UpIHtcbiAgICB2YXIgbGV2ZWxBc1RleHQgPSBMb2dnZXIubGV2ZWxBc1RleHQobGV2ZWwpO1xuICAgIHZhciBwZXJmb3JtZXIgPSB0aGlzW2xldmVsQXNUZXh0LnRyaW0oKS50b0xvd2VyQ2FzZSgpXTtcbiAgICB2YXIgZiA9IHBlcmZvcm1lci5mO1xuICAgIHZhciBvdGhlckFyZ3VtZW50cyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMywgYXJndW1lbnRzLmxlbmd0aCk7XG4gICAgdGhpcy5wZXJmb3JtTG9nKGYsIGxldmVsLCBtZXNzYWdlLCBvdGhlckFyZ3VtZW50cywgb3ZlcnJpZGUpO1xufTtcblxuTG9nZ2VyLnByb3RvdHlwZS5wZXJmb3JtTG9nID0gZnVuY3Rpb24gKGxvZ0Z1bmMsIGxldmVsLCBtZXNzYWdlLCBvdGhlckFyZ3VtZW50cywgb3ZlcnJpZGUpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIGN1cnJlbnRMZXZlbCA9IG92ZXJyaWRlICE9PSB1bmRlZmluZWQgPyBvdmVycmlkZSA6IHRoaXMuY3VycmVudExldmVsKCk7XG4gICAgaWYgKGN1cnJlbnRMZXZlbCA8PSBsZXZlbCkge1xuICAgICAgICBsb2dGdW5jID0gXy5wYXJ0aWFsKGxvZ0Z1bmMsIExvZ2dlci5sZXZlbEFzVGV4dChsZXZlbCkgKyAnIFsnICsgc2VsZi5uYW1lICsgJ106ICcgKyBtZXNzYWdlKTtcbiAgICAgICAgdmFyIGFyZ3MgPSBbXTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBvdGhlckFyZ3VtZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgYXJnc1tpXSA9IG90aGVyQXJndW1lbnRzW2ldO1xuICAgICAgICB9XG4gICAgICAgIGFyZ3Muc3BsaWNlKDAsIDEpO1xuICAgICAgICBsb2dGdW5jLmFwcGx5KGxvZ0Z1bmMsIGFyZ3MpO1xuICAgIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gTG9nZ2VyO1xuIiwiLyoqXG4gKiBAbW9kdWxlIHJlbGF0aW9uc2hpcHNcbiAqL1xuXG52YXIgUmVsYXRpb25zaGlwUHJveHkgPSByZXF1aXJlKCcuL1JlbGF0aW9uc2hpcFByb3h5JyksXG4gICAgU3RvcmUgPSByZXF1aXJlKCcuL3N0b3JlJyksXG4gICAgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpLFxuICAgIF8gPSB1dGlsLl8sXG4gICAgSW50ZXJuYWxTaWVzdGFFcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKS5JbnRlcm5hbFNpZXN0YUVycm9yLFxuICAgIG1vZGVsRXZlbnRzID0gcmVxdWlyZSgnLi9tb2RlbEV2ZW50cycpLFxuICAgIGV2ZW50cyA9IHJlcXVpcmUoJy4vZXZlbnRzJyksXG4gICAgd3JhcEFycmF5Rm9yQXR0cmlidXRlcyA9IGV2ZW50cy53cmFwQXJyYXksXG4gICAgU2llc3RhTW9kZWwgPSByZXF1aXJlKCcuL21vZGVsSW5zdGFuY2UnKSxcbiAgICBBcnJheU9ic2VydmVyID0gcmVxdWlyZSgnLi4vdmVuZG9yL29ic2VydmUtanMvc3JjL29ic2VydmUnKS5BcnJheU9ic2VydmVyLFxuICAgIE1vZGVsRXZlbnRUeXBlID0gcmVxdWlyZSgnLi9tb2RlbEV2ZW50cycpLk1vZGVsRXZlbnRUeXBlO1xuXG4vKipcbiAqIFtNYW55VG9NYW55UHJveHkgZGVzY3JpcHRpb25dXG4gKiBAcGFyYW0ge09iamVjdH0gb3B0c1xuICovXG5mdW5jdGlvbiBNYW55VG9NYW55UHJveHkob3B0cykge1xuICAgIFJlbGF0aW9uc2hpcFByb3h5LmNhbGwodGhpcywgb3B0cyk7XG4gICAgdGhpcy5yZWxhdGVkID0gW107XG4gICAgdGhpcy5yZWxhdGVkQ2FuY2VsTGlzdGVuZXJzID0ge307XG59XG5cbk1hbnlUb01hbnlQcm94eS5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKFJlbGF0aW9uc2hpcFByb3h5LnByb3RvdHlwZSk7XG5cbl8uZXh0ZW5kKE1hbnlUb01hbnlQcm94eS5wcm90b3R5cGUsIHtcbiAgICBjbGVhclJldmVyc2U6IGZ1bmN0aW9uIChyZW1vdmVkKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgXy5lYWNoKHJlbW92ZWQsIGZ1bmN0aW9uIChyZW1vdmVkT2JqZWN0KSB7XG4gICAgICAgICAgICB2YXIgcmV2ZXJzZVByb3h5ID0gc2VsZi5yZXZlcnNlUHJveHlGb3JJbnN0YW5jZShyZW1vdmVkT2JqZWN0KTtcbiAgICAgICAgICAgIHZhciBpZHggPSByZXZlcnNlUHJveHkucmVsYXRlZC5pbmRleE9mKHNlbGYub2JqZWN0KTtcbiAgICAgICAgICAgIHJldmVyc2VQcm94eS5tYWtlQ2hhbmdlc1RvUmVsYXRlZFdpdGhvdXRPYnNlcnZhdGlvbnMoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHJldmVyc2VQcm94eS5zcGxpY2UoaWR4LCAxKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICB9LFxuICAgIHNldFJldmVyc2VPZkFkZGVkOiBmdW5jdGlvbiAoYWRkZWQpIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICBfLmVhY2goYWRkZWQsIGZ1bmN0aW9uIChhZGRlZE9iamVjdCkge1xuICAgICAgICAgICAgdmFyIHJldmVyc2VQcm94eSA9IHNlbGYucmV2ZXJzZVByb3h5Rm9ySW5zdGFuY2UoYWRkZWRPYmplY3QpO1xuICAgICAgICAgICAgcmV2ZXJzZVByb3h5Lm1ha2VDaGFuZ2VzVG9SZWxhdGVkV2l0aG91dE9ic2VydmF0aW9ucyhmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcmV2ZXJzZVByb3h5LnNwbGljZSgwLCAwLCBzZWxmLm9iamVjdCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgfSxcbiAgICB3cmFwQXJyYXk6IGZ1bmN0aW9uIChhcnIpIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICB3cmFwQXJyYXlGb3JBdHRyaWJ1dGVzKGFyciwgdGhpcy5yZXZlcnNlTmFtZSwgdGhpcy5vYmplY3QpO1xuICAgICAgICBpZiAoIWFyci5hcnJheU9ic2VydmVyKSB7XG4gICAgICAgICAgICBhcnIuYXJyYXlPYnNlcnZlciA9IG5ldyBBcnJheU9ic2VydmVyKGFycik7XG4gICAgICAgICAgICB2YXIgb2JzZXJ2ZXJGdW5jdGlvbiA9IGZ1bmN0aW9uIChzcGxpY2VzKSB7XG4gICAgICAgICAgICAgICAgc3BsaWNlcy5mb3JFYWNoKGZ1bmN0aW9uIChzcGxpY2UpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGFkZGVkID0gc3BsaWNlLmFkZGVkQ291bnQgPyBhcnIuc2xpY2Uoc3BsaWNlLmluZGV4LCBzcGxpY2UuaW5kZXggKyBzcGxpY2UuYWRkZWRDb3VudCkgOiBbXTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHJlbW92ZWQgPSBzcGxpY2UucmVtb3ZlZDtcbiAgICAgICAgICAgICAgICAgICAgc2VsZi5jbGVhclJldmVyc2UocmVtb3ZlZCk7XG4gICAgICAgICAgICAgICAgICAgIHNlbGYuc2V0UmV2ZXJzZU9mQWRkZWQoYWRkZWQpO1xuICAgICAgICAgICAgICAgICAgICB2YXIgbW9kZWwgPSBzZWxmLmdldEZvcndhcmRNb2RlbCgpO1xuICAgICAgICAgICAgICAgICAgICBtb2RlbEV2ZW50cy5lbWl0KHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbGxlY3Rpb246IG1vZGVsLmNvbGxlY3Rpb25OYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgbW9kZWw6IG1vZGVsLm5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBfaWQ6IHNlbGYub2JqZWN0Ll9pZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGZpZWxkOiBzZWxmLmdldEZvcndhcmROYW1lKCksXG4gICAgICAgICAgICAgICAgICAgICAgICByZW1vdmVkOiByZW1vdmVkLFxuICAgICAgICAgICAgICAgICAgICAgICAgYWRkZWQ6IGFkZGVkLFxuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogTW9kZWxFdmVudFR5cGUuU3BsaWNlLFxuICAgICAgICAgICAgICAgICAgICAgICAgaW5kZXg6IHNwbGljZS5pbmRleCxcbiAgICAgICAgICAgICAgICAgICAgICAgIG9iajogc2VsZi5vYmplY3RcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgYXJyLmFycmF5T2JzZXJ2ZXIub3BlbihvYnNlcnZlckZ1bmN0aW9uKTtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgZ2V0OiBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICAgICAgdmFyIGRlZmVycmVkID0gdXRpbC5kZWZlcihjYWxsYmFjayk7XG4gICAgICAgIGNhbGxiYWNrID0gZGVmZXJyZWQuZmluaXNoLmJpbmQoZGVmZXJyZWQpO1xuICAgICAgICBjYWxsYmFjayhudWxsLCB0aGlzLnJlbGF0ZWQpO1xuICAgICAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbiAgICB9LFxuICAgIHZhbGlkYXRlOiBmdW5jdGlvbiAob2JqKSB7XG4gICAgICAgIGlmIChPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwob2JqKSAhPSAnW29iamVjdCBBcnJheV0nKSB7XG4gICAgICAgICAgICByZXR1cm4gJ0Nhbm5vdCBhc3NpZ24gc2NhbGFyIHRvIG1hbnkgdG8gbWFueSc7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uIChvYmosIG9wdHMpIHtcbiAgICAgICAgdGhpcy5jaGVja0luc3RhbGxlZCgpO1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgIGlmIChvYmopIHtcbiAgICAgICAgICAgIHZhciBlcnJvck1lc3NhZ2U7XG4gICAgICAgICAgICBpZiAoZXJyb3JNZXNzYWdlID0gdGhpcy52YWxpZGF0ZShvYmopKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGVycm9yTWVzc2FnZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuY2xlYXJSZXZlcnNlUmVsYXRlZChvcHRzKTtcbiAgICAgICAgICAgICAgICBzZWxmLnNldElkQW5kUmVsYXRlZChvYmosIG9wdHMpO1xuICAgICAgICAgICAgICAgIHRoaXMud3JhcEFycmF5KG9iaik7XG4gICAgICAgICAgICAgICAgc2VsZi5zZXRJZEFuZFJlbGF0ZWRSZXZlcnNlKG9iaiwgb3B0cyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmNsZWFyUmV2ZXJzZVJlbGF0ZWQob3B0cyk7XG4gICAgICAgICAgICBzZWxmLnNldElkQW5kUmVsYXRlZChvYmosIG9wdHMpO1xuICAgICAgICB9XG4gICAgfSxcbiAgICBpbnN0YWxsOiBmdW5jdGlvbiAob2JqKSB7XG4gICAgICAgIFJlbGF0aW9uc2hpcFByb3h5LnByb3RvdHlwZS5pbnN0YWxsLmNhbGwodGhpcywgb2JqKTtcbiAgICAgICAgdGhpcy53cmFwQXJyYXkodGhpcy5yZWxhdGVkKTtcbiAgICAgICAgb2JqWygnc3BsaWNlJyArIHV0aWwuY2FwaXRhbGlzZUZpcnN0TGV0dGVyKHRoaXMucmV2ZXJzZU5hbWUpKV0gPSBfLmJpbmQodGhpcy5zcGxpY2UsIHRoaXMpO1xuICAgIH0sXG4gICAgcmVnaXN0ZXJSZW1vdmFsTGlzdGVuZXI6IGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgdGhpcy5yZWxhdGVkQ2FuY2VsTGlzdGVuZXJzW29iai5faWRdID0gb2JqLmxpc3RlbihmdW5jdGlvbiAoZSkge1xuXG4gICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgfVxufSk7XG5cblxubW9kdWxlLmV4cG9ydHMgPSBNYW55VG9NYW55UHJveHk7IiwiLyoqXG4gKiBAbW9kdWxlIG1hcHBpbmdcbiAqL1xuXG52YXIgU3RvcmUgPSByZXF1aXJlKCcuL3N0b3JlJyksXG4gICAgU2llc3RhTW9kZWwgPSByZXF1aXJlKCcuL21vZGVsSW5zdGFuY2UnKSxcbiAgICBsb2cgPSByZXF1aXJlKCcuL2xvZycpLFxuICAgIEludGVybmFsU2llc3RhRXJyb3IgPSByZXF1aXJlKCcuL2Vycm9yJykuSW50ZXJuYWxTaWVzdGFFcnJvcixcbiAgICBjYWNoZSA9IHJlcXVpcmUoJy4vY2FjaGUnKSxcbiAgICB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyksXG4gICAgXyA9IHV0aWwuXyxcbiAgICBhc3luYyA9IHV0aWwuYXN5bmMsXG4gICAgTW9kZWxFdmVudFR5cGUgPSByZXF1aXJlKCcuL21vZGVsRXZlbnRzJykuTW9kZWxFdmVudFR5cGU7XG5cbnZhciBMb2dnZXIgPSBsb2cubG9nZ2VyV2l0aE5hbWUoJ01hcHBpbmcnKTtcbkxvZ2dlci5zZXRMZXZlbChsb2cuTGV2ZWwudHJhY2UpO1xuXG5mdW5jdGlvbiBTaWVzdGFFcnJvcihvcHRzKSB7XG4gICAgdGhpcy5vcHRzID0gb3B0cztcbn1cblNpZXN0YUVycm9yLnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkodGhpcy5vcHRzLCBudWxsLCA0KTtcbn07XG5cblxuLyoqXG4gKiBFbmNhcHN1bGF0ZXMgdGhlIGlkZWEgb2YgbWFwcGluZyBhcnJheXMgb2YgZGF0YSBvbnRvIHRoZSBvYmplY3QgZ3JhcGggb3IgYXJyYXlzIG9mIG9iamVjdHMuXG4gKiBAcGFyYW0ge09iamVjdH0gb3B0c1xuICogQHBhcmFtIG9wdHMubW9kZWxcbiAqIEBwYXJhbSBvcHRzLmRhdGFcbiAqIEBwYXJhbSBvcHRzLm9iamVjdHNcbiAqIEBwYXJhbSBvcHRzLmRpc2FibGVOb3RpZmljYXRpb25zXG4gKi9cbmZ1bmN0aW9uIE1hcHBpbmdPcGVyYXRpb24ob3B0cykge1xuICAgIHRoaXMuX29wdHMgPSBvcHRzO1xuXG4gICAgdXRpbC5leHRlbmRGcm9tT3B0cyh0aGlzLCBvcHRzLCB7XG4gICAgICAgIG1vZGVsOiBudWxsLFxuICAgICAgICBkYXRhOiBudWxsLFxuICAgICAgICBvYmplY3RzOiBbXSxcbiAgICAgICAgZGlzYWJsZWV2ZW50czogZmFsc2UsXG4gICAgICAgIF9pZ25vcmVJbnN0YWxsZWQ6IGZhbHNlLFxuICAgICAgICBmcm9tU3RvcmFnZTogZmFsc2VcbiAgICB9KTtcblxuICAgIF8uZXh0ZW5kKHRoaXMsIHtcbiAgICAgICAgZXJyb3JzOiBbXSxcbiAgICAgICAgc3ViVGFza1Jlc3VsdHM6IHt9LFxuICAgICAgICBfbmV3T2JqZWN0czogW11cbiAgICB9KTtcbn1cblxuXG5fLmV4dGVuZChNYXBwaW5nT3BlcmF0aW9uLnByb3RvdHlwZSwge1xuICAgIG1hcEF0dHJpYnV0ZXM6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLmRhdGEubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHZhciBkYXR1bSA9IHRoaXMuZGF0YVtpXTtcbiAgICAgICAgICAgIHZhciBvYmplY3QgPSB0aGlzLm9iamVjdHNbaV07XG4gICAgICAgICAgICAvLyBObyBwb2ludCBtYXBwaW5nIG9iamVjdCBvbnRvIGl0c2VsZi4gVGhpcyBoYXBwZW5zIGlmIGEgTW9kZWxJbnN0YW5jZSBpcyBwYXNzZWQgYXMgYSByZWxhdGlvbnNoaXAuXG4gICAgICAgICAgICBpZiAoZGF0dW0gIT0gb2JqZWN0KSB7XG4gICAgICAgICAgICAgICAgaWYgKG9iamVjdCkgeyAvLyBJZiBvYmplY3QgaXMgZmFsc3ksIHRoZW4gdGhlcmUgd2FzIGFuIGVycm9yIGxvb2tpbmcgdXAgdGhhdCBvYmplY3QvY3JlYXRpbmcgaXQuXG4gICAgICAgICAgICAgICAgICAgIHZhciBmaWVsZHMgPSB0aGlzLm1vZGVsLl9hdHRyaWJ1dGVOYW1lcztcbiAgICAgICAgICAgICAgICAgICAgXy5lYWNoKGZpZWxkcywgZnVuY3Rpb24gKGYpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChkYXR1bVtmXSAhPT0gdW5kZWZpbmVkKSB7IC8vIG51bGwgaXMgZmluZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIElmIGV2ZW50cyBhcmUgZGlzYWJsZWQgd2UgdXBkYXRlIF9fdmFsdWVzIG9iamVjdCBkaXJlY3RseS4gVGhpcyBhdm9pZHMgdHJpZ2dlcmluZ1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGV2ZW50cyB3aGljaCBhcmUgYnVpbHQgaW50byB0aGUgc2V0IGZ1bmN0aW9uIG9mIHRoZSBwcm9wZXJ0eS5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5kaXNhYmxlZXZlbnRzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9iamVjdC5fX3ZhbHVlc1tmXSA9IGRhdHVtW2ZdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb2JqZWN0W2ZdID0gZGF0dW1bZl07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICAgICAgICAgICAgICAvLyBQb3VjaERCIHJldmlzaW9uIChpZiB1c2luZyBzdG9yYWdlIG1vZHVsZSkuXG4gICAgICAgICAgICAgICAgICAgIC8vIFRPRE86IENhbiB0aGlzIGJlIHB1bGxlZCBvdXQgb2YgY29yZT9cbiAgICAgICAgICAgICAgICAgICAgaWYgKGRhdHVtLl9yZXYpIG9iamVjdC5fcmV2ID0gZGF0dW0uX3JldjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9LFxuICAgIF9tYXA6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICB2YXIgZXJyO1xuICAgICAgICB0aGlzLm1hcEF0dHJpYnV0ZXMoKTtcbiAgICAgICAgdmFyIHJlbGF0aW9uc2hpcEZpZWxkcyA9IF8ua2V5cyhzZWxmLnN1YlRhc2tSZXN1bHRzKTtcbiAgICAgICAgXy5lYWNoKHJlbGF0aW9uc2hpcEZpZWxkcywgZnVuY3Rpb24gKGYpIHtcbiAgICAgICAgICAgIHZhciByZXMgPSBzZWxmLnN1YlRhc2tSZXN1bHRzW2ZdO1xuICAgICAgICAgICAgdmFyIGluZGV4ZXMgPSByZXMuaW5kZXhlcyxcbiAgICAgICAgICAgICAgICBvYmplY3RzID0gcmVzLm9iamVjdHM7XG4gICAgICAgICAgICB2YXIgcmVsYXRlZERhdGEgPSBzZWxmLmdldFJlbGF0ZWREYXRhKGYpLnJlbGF0ZWREYXRhO1xuICAgICAgICAgICAgdmFyIHVuZmxhdHRlbmVkT2JqZWN0cyA9IHV0aWwudW5mbGF0dGVuQXJyYXkob2JqZWN0cywgcmVsYXRlZERhdGEpO1xuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB1bmZsYXR0ZW5lZE9iamVjdHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICB2YXIgaWR4ID0gaW5kZXhlc1tpXTtcbiAgICAgICAgICAgICAgICAvLyBFcnJvcnMgYXJlIHBsdWNrZWQgZnJvbSB0aGUgc3Vib3BlcmF0aW9ucy5cbiAgICAgICAgICAgICAgICB2YXIgZXJyb3IgPSBzZWxmLmVycm9yc1tpZHhdO1xuICAgICAgICAgICAgICAgIGVyciA9IGVycm9yID8gZXJyb3JbZl0gOiBudWxsO1xuICAgICAgICAgICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciByZWxhdGVkID0gdW5mbGF0dGVuZWRPYmplY3RzW2ldOyAvLyBDYW4gYmUgYXJyYXkgb3Igc2NhbGFyLlxuICAgICAgICAgICAgICAgICAgICB2YXIgb2JqZWN0ID0gc2VsZi5vYmplY3RzW2lkeF07XG4gICAgICAgICAgICAgICAgICAgIGlmIChvYmplY3QpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVyciA9IG9iamVjdC5fX3Byb3hpZXNbZl0uc2V0KHJlbGF0ZWQsIHtkaXNhYmxlZXZlbnRzOiBzZWxmLmRpc2FibGVldmVudHN9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIXNlbGYuZXJyb3JzW2lkeF0pIHNlbGYuZXJyb3JzW2lkeF0gPSB7fTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZWxmLmVycm9yc1tpZHhdW2ZdID0gZXJyO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIEZvciBpbmRpY2VzIHdoZXJlIG5vIG9iamVjdCBpcyBwcmVzZW50LCBwZXJmb3JtIGxvb2t1cHMsIGNyZWF0aW5nIGEgbmV3IG9iamVjdCBpZiBuZWNlc3NhcnkuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfbG9va3VwOiBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICAgICAgdmFyIGRlZmVycmVkID0gdXRpbC5kZWZlcihjYWxsYmFjayk7XG4gICAgICAgIGNhbGxiYWNrID0gZGVmZXJyZWQuZmluaXNoLmJpbmQoZGVmZXJyZWQpO1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgIHZhciByZW1vdGVMb29rdXBzID0gW107XG4gICAgICAgIHZhciBsb2NhbExvb2t1cHMgPSBbXTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLmRhdGEubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5vYmplY3RzW2ldKSB7XG4gICAgICAgICAgICAgICAgdmFyIGxvb2t1cDtcbiAgICAgICAgICAgICAgICB2YXIgZGF0dW0gPSB0aGlzLmRhdGFbaV07XG4gICAgICAgICAgICAgICAgdmFyIGlzU2NhbGFyID0gdHlwZW9mIGRhdHVtID09ICdzdHJpbmcnIHx8IHR5cGVvZiBkYXR1bSA9PSAnbnVtYmVyJyB8fCBkYXR1bSBpbnN0YW5jZW9mIFN0cmluZztcbiAgICAgICAgICAgICAgICBpZiAoZGF0dW0pIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGlzU2NhbGFyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb29rdXAgPSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaW5kZXg6IGksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0dW06IHt9XG4gICAgICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9va3VwLmRhdHVtW3NlbGYubW9kZWwuaWRdID0gZGF0dW07XG4gICAgICAgICAgICAgICAgICAgICAgICByZW1vdGVMb29rdXBzLnB1c2gobG9va3VwKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChkYXR1bSBpbnN0YW5jZW9mIFNpZXN0YU1vZGVsKSB7IC8vIFdlIHdvbid0IG5lZWQgdG8gcGVyZm9ybSBhbnkgbWFwcGluZy5cbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMub2JqZWN0c1tpXSA9IGRhdHVtO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGRhdHVtLl9pZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9jYWxMb29rdXBzLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGluZGV4OiBpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdHVtOiBkYXR1bVxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoZGF0dW1bc2VsZi5tb2RlbC5pZF0pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlbW90ZUxvb2t1cHMucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaW5kZXg6IGksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0dW06IGRhdHVtXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMub2JqZWN0c1tpXSA9IHNlbGYuX25ldygpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5vYmplY3RzW2ldID0gbnVsbDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgdXRpbC5hc3luYy5wYXJhbGxlbChbXG4gICAgICAgICAgICAgICAgZnVuY3Rpb24gKGRvbmUpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGxvY2FsSWRlbnRpZmllcnMgPSBfLnBsdWNrKF8ucGx1Y2sobG9jYWxMb29rdXBzLCAnZGF0dW0nKSwgJ19pZCcpO1xuICAgICAgICAgICAgICAgICAgICBpZiAobG9jYWxJZGVudGlmaWVycy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIFN0b3JlLmdldE11bHRpcGxlTG9jYWwobG9jYWxJZGVudGlmaWVycywgZnVuY3Rpb24gKGVyciwgb2JqZWN0cykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbG9jYWxJZGVudGlmaWVycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG9iaiA9IG9iamVjdHNbaV07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgX2lkID0gbG9jYWxJZGVudGlmaWVyc1tpXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBsb29rdXAgPSBsb2NhbExvb2t1cHNbaV07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIW9iaikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIElmIHRoZXJlIGFyZSBtdWx0aXBsZSBtYXBwaW5nIG9wZXJhdGlvbnMgZ29pbmcgb24sIHRoZXJlIG1heSBiZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9iaiA9IGNhY2hlLmdldCh7X2lkOiBfaWR9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIW9iailcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb2JqID0gc2VsZi5fbmV3KHtfaWQ6IF9pZH0sICFzZWxmLmRpc2FibGVldmVudHMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYub2JqZWN0c1tsb29rdXAuaW5kZXhdID0gb2JqO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZWxmLm9iamVjdHNbbG9va3VwLmluZGV4XSA9IG9iajtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkb25lKGVycik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRvbmUoKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgZnVuY3Rpb24gKGRvbmUpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHJlbW90ZUlkZW50aWZpZXJzID0gXy5wbHVjayhfLnBsdWNrKHJlbW90ZUxvb2t1cHMsICdkYXR1bScpLCBzZWxmLm1vZGVsLmlkKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHJlbW90ZUlkZW50aWZpZXJzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKExvZ2dlci50cmFjZS5pc0VuYWJsZWQpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgTG9nZ2VyLnRyYWNlKCdMb29raW5nIHVwIHJlbW90ZUlkZW50aWZpZXJzOiAnICsgdXRpbC5wcmV0dHlQcmludChyZW1vdGVJZGVudGlmaWVycykpO1xuICAgICAgICAgICAgICAgICAgICAgICAgU3RvcmUuZ2V0TXVsdGlwbGVSZW1vdGUocmVtb3RlSWRlbnRpZmllcnMsIHNlbGYubW9kZWwsIGZ1bmN0aW9uIChlcnIsIG9iamVjdHMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoTG9nZ2VyLnRyYWNlLmlzRW5hYmxlZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHJlc3VsdHMgPSB7fTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCBvYmplY3RzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzdWx0c1tyZW1vdGVJZGVudGlmaWVyc1tpXV0gPSBvYmplY3RzW2ldID8gb2JqZWN0c1tpXS5faWQgOiBudWxsO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgTG9nZ2VyLnRyYWNlKCdSZXN1bHRzIGZvciByZW1vdGVJZGVudGlmaWVyczogJyArIHV0aWwucHJldHR5UHJpbnQocmVzdWx0cykpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCBvYmplY3RzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgb2JqID0gb2JqZWN0c1tpXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBsb29rdXAgPSByZW1vdGVMb29rdXBzW2ldO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG9iaikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYub2JqZWN0c1tsb29rdXAuaW5kZXhdID0gb2JqO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgZGF0YSA9IHt9O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciByZW1vdGVJZCA9IHJlbW90ZUlkZW50aWZpZXJzW2ldO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdGFbc2VsZi5tb2RlbC5pZF0gPSByZW1vdGVJZDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgY2FjaGVRdWVyeSA9IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbW9kZWw6IHNlbGYubW9kZWxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhY2hlUXVlcnlbc2VsZi5tb2RlbC5pZF0gPSByZW1vdGVJZDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgY2FjaGVkID0gY2FjaGUuZ2V0KGNhY2hlUXVlcnkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjYWNoZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2VsZi5vYmplY3RzW2xvb2t1cC5pbmRleF0gPSBjYWNoZWQ7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2VsZi5vYmplY3RzW2xvb2t1cC5pbmRleF0gPSBzZWxmLl9uZXcoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gSXQncyBpbXBvcnRhbnQgdGhhdCB3ZSBtYXAgdGhlIHJlbW90ZSBpZGVudGlmaWVyIGhlcmUgdG8gZW5zdXJlIHRoYXQgaXQgZW5kc1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyB1cCBpbiB0aGUgY2FjaGUuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYub2JqZWN0c1tsb29rdXAuaW5kZXhdW3NlbGYubW9kZWwuaWRdID0gcmVtb3RlSWQ7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRvbmUoZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgZG9uZSgpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIGNhbGxiYWNrKTtcbiAgICAgICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG4gICAgfSxcbiAgICBfbG9va3VwU2luZ2xldG9uOiBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICAgICAgdmFyIGRlZmVycmVkID0gdXRpbC5kZWZlcihjYWxsYmFjayk7XG4gICAgICAgIGNhbGxiYWNrID0gZGVmZXJyZWQuZmluaXNoLmJpbmQoZGVmZXJyZWQpO1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgIC8vIFBpY2sgYSByYW5kb20gX2lkIGZyb20gdGhlIGFycmF5IG9mIGRhdGEgYmVpbmcgbWFwcGVkIG9udG8gdGhlIHNpbmdsZXRvbiBvYmplY3QuIE5vdGUgdGhhdCB0aGV5IHNob3VsZFxuICAgICAgICAvLyBhbHdheXMgYmUgdGhlIHNhbWUuIFRoaXMgaXMganVzdCBhIHByZWNhdXRpb24uXG4gICAgICAgIHZhciBfaWRzID0gXy5wbHVjayhzZWxmLmRhdGEsICdfaWQnKSxcbiAgICAgICAgICAgIF9pZDtcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IF9pZHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmIChfaWRzW2ldKSB7XG4gICAgICAgICAgICAgICAgX2lkID0ge19pZDogX2lkc1tpXX07XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gVGhlIG1hcHBpbmcgb3BlcmF0aW9uIGlzIHJlc3BvbnNpYmxlIGZvciBjcmVhdGluZyBzaW5nbGV0b24gaW5zdGFuY2VzIGlmIHRoZXkgZG8gbm90IGFscmVhZHkgZXhpc3QuXG4gICAgICAgIHZhciBzaW5nbGV0b24gPSBjYWNoZS5nZXRTaW5nbGV0b24odGhpcy5tb2RlbCkgfHwgdGhpcy5fbmV3KF9pZCk7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc2VsZi5kYXRhLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBzZWxmLm9iamVjdHNbaV0gPSBzaW5nbGV0b247XG4gICAgICAgIH1cbiAgICAgICAgY2FsbGJhY2soKTtcbiAgICAgICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG4gICAgfSxcbiAgICBfbmV3OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBtb2RlbCA9IHRoaXMubW9kZWwsXG4gICAgICAgICAgICBtb2RlbEluc3RhbmNlID0gbW9kZWwuX25ldy5hcHBseShtb2RlbCwgYXJndW1lbnRzKTtcbiAgICAgICAgdGhpcy5fbmV3T2JqZWN0cy5wdXNoKG1vZGVsSW5zdGFuY2UpO1xuICAgICAgICByZXR1cm4gbW9kZWxJbnN0YW5jZTtcbiAgICB9LFxuICAgIHN0YXJ0OiBmdW5jdGlvbiAoZG9uZSkge1xuICAgICAgICBpZiAodGhpcy5kYXRhLmxlbmd0aCkge1xuICAgICAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICAgICAgdmFyIHRhc2tzID0gW107XG4gICAgICAgICAgICB2YXIgbG9va3VwRnVuYyA9IHRoaXMubW9kZWwuc2luZ2xldG9uID8gdGhpcy5fbG9va3VwU2luZ2xldG9uIDogdGhpcy5fbG9va3VwO1xuICAgICAgICAgICAgdGFza3MucHVzaChfLmJpbmQobG9va3VwRnVuYywgdGhpcykpO1xuICAgICAgICAgICAgdGFza3MucHVzaChfLmJpbmQodGhpcy5fZXhlY3V0ZVN1Yk9wZXJhdGlvbnMsIHRoaXMpKTtcbiAgICAgICAgICAgIHV0aWwuYXN5bmMucGFyYWxsZWwodGFza3MsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBzZWxmLl9tYXAoKTtcblxuICAgICAgICAgICAgICAgICAgICAvLyBVc2VycyBhcmUgYWxsb3dlZCB0byBhZGQgYSBjdXN0b20gaW5pdCBtZXRob2QgdG8gdGhlIG1ldGhvZHMgb2JqZWN0IHdoZW4gZGVmaW5pbmcgYSBNb2RlbCwgb2YgdGhlIGZvcm06XG4gICAgICAgICAgICAgICAgICAgIC8vXG4gICAgICAgICAgICAgICAgICAgIC8vXG4gICAgICAgICAgICAgICAgICAgIC8vIGluaXQ6IGZ1bmN0aW9uIChbZG9uZV0pIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gICAgIC8vIC4uLlxuICAgICAgICAgICAgICAgICAgICAvLyAgfVxuICAgICAgICAgICAgICAgICAgICAvL1xuICAgICAgICAgICAgICAgICAgICAvL1xuICAgICAgICAgICAgICAgICAgICAvLyBJZiBkb25lIGlzIHBhc3NlZCwgdGhlbiBfX2luaXQgbXVzdCBiZSBleGVjdXRlZCBhc3luY2hyb25vdXNseSwgYW5kIHRoZSBtYXBwaW5nIG9wZXJhdGlvbiB3aWxsIG5vdFxuICAgICAgICAgICAgICAgICAgICAvLyBmaW5pc2ggdW50aWwgYWxsIGluaXRzIGhhdmUgZXhlY3V0ZWQuXG4gICAgICAgICAgICAgICAgICAgIC8vXG4gICAgICAgICAgICAgICAgICAgIC8vIEhlcmUgd2UgZW5zdXJlIHRoZSBleGVjdXRpb24gb2YgYWxsIG9mIHRoZW1cbiAgICAgICAgICAgICAgICAgICAgdmFyIGZyb21TdG9yYWdlID0gdGhpcy5mcm9tU3RvcmFnZTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGluaXRUYXNrcyA9IF8ucmVkdWNlKHNlbGYuX25ld09iamVjdHMsIGZ1bmN0aW9uIChtLCBvKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgaW5pdCA9IG8ubW9kZWwuaW5pdDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpbml0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHBhcmFtTmFtZXMgPSB1dGlsLnBhcmFtTmFtZXMoaW5pdCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHBhcmFtTmFtZXMubGVuZ3RoID4gMSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtLnB1c2goXy5iaW5kKGluaXQsIG8sIGZyb21TdG9yYWdlLCBkb25lKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbml0LmNhbGwobywgZnJvbVN0b3JhZ2UpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBtO1xuICAgICAgICAgICAgICAgICAgICB9LCBbXSk7XG4gICAgICAgICAgICAgICAgICAgIGFzeW5jLnBhcmFsbGVsKGluaXRUYXNrcywgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZG9uZShzZWxmLmVycm9ycy5sZW5ndGggPyBzZWxmLmVycm9ycyA6IG51bGwsIHNlbGYub2JqZWN0cyk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdjYXVnaHQgZXJyb3InLCBlKTtcbiAgICAgICAgICAgICAgICAgICAgZG9uZShlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZG9uZShudWxsLCBbXSk7XG4gICAgICAgIH1cbiAgICB9LFxuICAgIGdldFJlbGF0ZWREYXRhOiBmdW5jdGlvbiAobmFtZSkge1xuICAgICAgICB2YXIgaW5kZXhlcyA9IFtdO1xuICAgICAgICB2YXIgcmVsYXRlZERhdGEgPSBbXTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLmRhdGEubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHZhciBkYXR1bSA9IHRoaXMuZGF0YVtpXTtcbiAgICAgICAgICAgIGlmIChkYXR1bSkge1xuICAgICAgICAgICAgICAgIGlmIChkYXR1bVtuYW1lXSkge1xuICAgICAgICAgICAgICAgICAgICBpbmRleGVzLnB1c2goaSk7XG4gICAgICAgICAgICAgICAgICAgIHJlbGF0ZWREYXRhLnB1c2goZGF0dW1bbmFtZV0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgaW5kZXhlczogaW5kZXhlcyxcbiAgICAgICAgICAgIHJlbGF0ZWREYXRhOiByZWxhdGVkRGF0YVxuICAgICAgICB9O1xuICAgIH0sXG4gICAgcHJvY2Vzc0Vycm9yc0Zyb21UYXNrOiBmdW5jdGlvbiAocmVsYXRpb25zaGlwTmFtZSwgZXJyb3JzLCBpbmRleGVzKSB7XG4gICAgICAgIGlmIChlcnJvcnMubGVuZ3RoKSB7XG4gICAgICAgICAgICB2YXIgcmVsYXRlZERhdGEgPSB0aGlzLmdldFJlbGF0ZWREYXRhKHJlbGF0aW9uc2hpcE5hbWUpLnJlbGF0ZWREYXRhO1xuICAgICAgICAgICAgdmFyIHVuZmxhdHRlbmVkRXJyb3JzID0gdXRpbC51bmZsYXR0ZW5BcnJheShlcnJvcnMsIHJlbGF0ZWREYXRhKTtcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdW5mbGF0dGVuZWRFcnJvcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICB2YXIgaWR4ID0gaW5kZXhlc1tpXTtcbiAgICAgICAgICAgICAgICB2YXIgZXJyID0gdW5mbGF0dGVuZWRFcnJvcnNbaV07XG4gICAgICAgICAgICAgICAgdmFyIGlzRXJyb3IgPSBlcnI7XG4gICAgICAgICAgICAgICAgaWYgKHV0aWwuaXNBcnJheShlcnIpKSBpc0Vycm9yID0gXy5yZWR1Y2UoZXJyLCBmdW5jdGlvbiAobWVtbywgeCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbWVtbyB8fCB4XG4gICAgICAgICAgICAgICAgfSwgZmFsc2UpO1xuICAgICAgICAgICAgICAgIGlmIChpc0Vycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghdGhpcy5lcnJvcnNbaWR4XSkgdGhpcy5lcnJvcnNbaWR4XSA9IHt9O1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmVycm9yc1tpZHhdW3JlbGF0aW9uc2hpcE5hbWVdID0gZXJyO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0sXG4gICAgX2V4ZWN1dGVTdWJPcGVyYXRpb25zOiBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzLFxuICAgICAgICAgICAgcmVsYXRpb25zaGlwTmFtZXMgPSBfLmtleXModGhpcy5tb2RlbC5yZWxhdGlvbnNoaXBzKTtcbiAgICAgICAgaWYgKHJlbGF0aW9uc2hpcE5hbWVzLmxlbmd0aCkge1xuICAgICAgICAgICAgdmFyIHRhc2tzID0gXy5yZWR1Y2UocmVsYXRpb25zaGlwTmFtZXMsIGZ1bmN0aW9uIChtLCByZWxhdGlvbnNoaXBOYW1lKSB7XG4gICAgICAgICAgICAgICAgdmFyIHJlbGF0aW9uc2hpcCA9IHNlbGYubW9kZWwucmVsYXRpb25zaGlwc1tyZWxhdGlvbnNoaXBOYW1lXSxcbiAgICAgICAgICAgICAgICAgICAgcmV2ZXJzZU1vZGVsID0gcmVsYXRpb25zaGlwLmZvcndhcmROYW1lID09IHJlbGF0aW9uc2hpcE5hbWUgPyByZWxhdGlvbnNoaXAucmV2ZXJzZU1vZGVsIDogcmVsYXRpb25zaGlwLmZvcndhcmRNb2RlbDtcbiAgICAgICAgICAgICAgICAvLyBNb2NrIGFueSBtaXNzaW5nIHNpbmdsZXRvbiBkYXRhIHRvIGVuc3VyZSB0aGF0IGFsbCBzaW5nbGV0b24gaW5zdGFuY2VzIGFyZSBjcmVhdGVkLlxuICAgICAgICAgICAgICAgIGlmIChyZXZlcnNlTW9kZWwuc2luZ2xldG9uICYmICFyZWxhdGlvbnNoaXAuaXNSZXZlcnNlKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZGF0YS5mb3JFYWNoKGZ1bmN0aW9uIChkYXR1bSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFkYXR1bVtyZWxhdGlvbnNoaXBOYW1lXSkgZGF0dW1bcmVsYXRpb25zaGlwTmFtZV0gPSB7fTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHZhciBfX3JldCA9IHRoaXMuZ2V0UmVsYXRlZERhdGEocmVsYXRpb25zaGlwTmFtZSksXG4gICAgICAgICAgICAgICAgICAgIGluZGV4ZXMgPSBfX3JldC5pbmRleGVzLFxuICAgICAgICAgICAgICAgICAgICByZWxhdGVkRGF0YSA9IF9fcmV0LnJlbGF0ZWREYXRhO1xuICAgICAgICAgICAgICAgIGlmIChyZWxhdGVkRGF0YS5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGZsYXRSZWxhdGVkRGF0YSA9IHV0aWwuZmxhdHRlbkFycmF5KHJlbGF0ZWREYXRhKTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIG9wID0gbmV3IE1hcHBpbmdPcGVyYXRpb24oe1xuICAgICAgICAgICAgICAgICAgICAgICAgbW9kZWw6IHJldmVyc2VNb2RlbCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRhdGE6IGZsYXRSZWxhdGVkRGF0YSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRpc2FibGVldmVudHM6IHNlbGYuZGlzYWJsZWV2ZW50cyxcbiAgICAgICAgICAgICAgICAgICAgICAgIF9pZ25vcmVJbnN0YWxsZWQ6IHNlbGYuX2lnbm9yZUluc3RhbGxlZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGZyb21TdG9yYWdlOiB0aGlzLmZyb21TdG9yYWdlXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChvcCkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgdGFzaztcbiAgICAgICAgICAgICAgICAgICAgdGFzayA9IGZ1bmN0aW9uIChkb25lKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBvcC5zdGFydChmdW5jdGlvbiAoZXJyb3JzLCBvYmplY3RzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc2VsZi5zdWJUYXNrUmVzdWx0c1tyZWxhdGlvbnNoaXBOYW1lXSA9IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZXJyb3JzOiBlcnJvcnMsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9iamVjdHM6IG9iamVjdHMsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGluZGV4ZXM6IGluZGV4ZXNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYucHJvY2Vzc0Vycm9yc0Zyb21UYXNrKHJlbGF0aW9uc2hpcE5hbWUsIG9wLmVycm9ycywgaW5kZXhlcyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZG9uZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgICAgIG0ucHVzaCh0YXNrKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIG07XG4gICAgICAgICAgICB9LmJpbmQodGhpcyksIFtdKTtcbiAgICAgICAgICAgIGFzeW5jLnBhcmFsbGVsKHRhc2tzLCBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY2FsbGJhY2soKTtcbiAgICAgICAgfVxuICAgIH1cbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IE1hcHBpbmdPcGVyYXRpb247XG5cblxuIiwiLyoqXG4gKiBAbW9kdWxlIG1hcHBpbmdcbiAqL1xuXG52YXIgbG9nID0gcmVxdWlyZSgnLi9sb2cnKSxcbiAgICBDb2xsZWN0aW9uUmVnaXN0cnkgPSByZXF1aXJlKCcuL2NvbGxlY3Rpb25SZWdpc3RyeScpLkNvbGxlY3Rpb25SZWdpc3RyeSxcbiAgICBJbnRlcm5hbFNpZXN0YUVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpLkludGVybmFsU2llc3RhRXJyb3IsXG4gICAgUmVsYXRpb25zaGlwVHlwZSA9IHJlcXVpcmUoJy4vUmVsYXRpb25zaGlwVHlwZScpLFxuICAgIFF1ZXJ5ID0gcmVxdWlyZSgnLi9xdWVyeScpLFxuICAgIE1hcHBpbmdPcGVyYXRpb24gPSByZXF1aXJlKCcuL21hcHBpbmdPcGVyYXRpb24nKSxcbiAgICBNb2RlbEluc3RhbmNlID0gcmVxdWlyZSgnLi9tb2RlbEluc3RhbmNlJyksXG4gICAgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpLFxuICAgIGNhY2hlID0gcmVxdWlyZSgnLi9jYWNoZScpLFxuICAgIHN0b3JlID0gcmVxdWlyZSgnLi9zdG9yZScpLFxuICAgIGV4dGVuZCA9IHJlcXVpcmUoJ2V4dGVuZCcpLFxuICAgIG1vZGVsRXZlbnRzID0gcmVxdWlyZSgnLi9tb2RlbEV2ZW50cycpLFxuICAgIGV2ZW50cyA9IHJlcXVpcmUoJy4vZXZlbnRzJyksXG4gICAgd3JhcEFycmF5ID0gcmVxdWlyZSgnLi9ldmVudHMnKS53cmFwQXJyYXksXG4gICAgcHJveHkgPSByZXF1aXJlKCcuL1JlbGF0aW9uc2hpcFByb3h5JyksXG4gICAgT25lVG9NYW55UHJveHkgPSByZXF1aXJlKCcuL09uZVRvTWFueVByb3h5JyksXG4gICAgT25lVG9PbmVQcm94eSA9IHJlcXVpcmUoJy4vT25lVG9PbmVQcm94eScpLFxuICAgIE1hbnlUb01hbnlQcm94eSA9IHJlcXVpcmUoJy4vbWFueVRvTWFueVByb3h5JyksXG4gICAgUmVhY3RpdmVRdWVyeSA9IHJlcXVpcmUoJy4vcmVhY3RpdmVRdWVyeScpLFxuICAgIEFycmFuZ2VkUmVhY3RpdmVRdWVyeSA9IHJlcXVpcmUoJy4vQXJyYW5nZWRSZWFjdGl2ZVF1ZXJ5JyksXG4gICAgXyA9IHV0aWwuXyxcbiAgICBndWlkID0gdXRpbC5ndWlkLFxuICAgIE1vZGVsRXZlbnRUeXBlID0gbW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGU7XG5cbnZhciBMb2dnZXIgPSBsb2cubG9nZ2VyV2l0aE5hbWUoJ01vZGVsJyk7XG5cblxuLyoqXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IG9wdHNcbiAqL1xuZnVuY3Rpb24gTW9kZWwob3B0cykge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB0aGlzLl9vcHRzID0gb3B0cyA/IF8uZXh0ZW5kKHt9LCBvcHRzKSA6IHt9O1xuXG4gICAgdXRpbC5leHRlbmRGcm9tT3B0cyh0aGlzLCBvcHRzLCB7XG4gICAgICAgIG1ldGhvZHM6IHt9LFxuICAgICAgICBhdHRyaWJ1dGVzOiBbXSxcbiAgICAgICAgY29sbGVjdGlvbjogZnVuY3Rpb24gKGMpIHtcbiAgICAgICAgICAgIGlmICh1dGlsLmlzU3RyaW5nKGMpKSB7XG4gICAgICAgICAgICAgICAgYyA9IENvbGxlY3Rpb25SZWdpc3RyeVtjXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBjO1xuICAgICAgICB9LFxuICAgICAgICBpZDogJ2lkJyxcbiAgICAgICAgcmVsYXRpb25zaGlwczogW10sXG4gICAgICAgIG5hbWU6IG51bGwsXG4gICAgICAgIGluZGV4ZXM6IFtdLFxuICAgICAgICBzaW5nbGV0b246IGZhbHNlLFxuICAgICAgICBzdGF0aWNzOiB0aGlzLmluc3RhbGxTdGF0aWNzLmJpbmQodGhpcyksXG4gICAgICAgIHByb3BlcnRpZXM6IHt9LFxuICAgICAgICBpbml0OiBudWxsLFxuICAgICAgICByZW1vdmU6IG51bGxcbiAgICB9KTtcblxuXG4gICAgdGhpcy5hdHRyaWJ1dGVzID0gTW9kZWwuX3Byb2Nlc3NBdHRyaWJ1dGVzKHRoaXMuYXR0cmlidXRlcyk7XG5cbiAgICBfLmV4dGVuZCh0aGlzLCB7XG4gICAgICAgIF9pbnN0YWxsZWQ6IGZhbHNlLFxuICAgICAgICBfcmVsYXRpb25zaGlwc0luc3RhbGxlZDogZmFsc2UsXG4gICAgICAgIF9yZXZlcnNlUmVsYXRpb25zaGlwc0luc3RhbGxlZDogZmFsc2UsXG4gICAgICAgIGNoaWxkcmVuOiBbXVxuICAgIH0pO1xuXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnRpZXModGhpcywge1xuICAgICAgICBfcmVsYXRpb25zaGlwTmFtZXM6IHtcbiAgICAgICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBPYmplY3Qua2V5cyhzZWxmLnJlbGF0aW9uc2hpcHMpO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICAgICAgfSxcbiAgICAgICAgX2F0dHJpYnV0ZU5hbWVzOiB7XG4gICAgICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICB2YXIgbmFtZXMgPSBbXTtcbiAgICAgICAgICAgICAgICBpZiAoc2VsZi5pZCkge1xuICAgICAgICAgICAgICAgICAgICBuYW1lcy5wdXNoKHNlbGYuaWQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBfLmVhY2goc2VsZi5hdHRyaWJ1dGVzLCBmdW5jdGlvbiAoeCkge1xuICAgICAgICAgICAgICAgICAgICBuYW1lcy5wdXNoKHgubmFtZSlcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICByZXR1cm4gbmFtZXM7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgICAgICB9LFxuICAgICAgICBpbnN0YWxsZWQ6IHtcbiAgICAgICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBzZWxmLl9pbnN0YWxsZWQgJiYgc2VsZi5fcmVsYXRpb25zaGlwc0luc3RhbGxlZCAmJiBzZWxmLl9yZXZlcnNlUmVsYXRpb25zaGlwc0luc3RhbGxlZDtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgICAgIH0sXG4gICAgICAgIGRlc2NlbmRhbnRzOiB7XG4gICAgICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gXy5yZWR1Y2Uoc2VsZi5jaGlsZHJlbiwgZnVuY3Rpb24gKG1lbW8sIGRlc2NlbmRhbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIEFycmF5LnByb3RvdHlwZS5jb25jYXQuY2FsbChtZW1vLCBkZXNjZW5kYW50LmRlc2NlbmRhbnRzKTtcbiAgICAgICAgICAgICAgICB9LmJpbmQoc2VsZiksIF8uZXh0ZW5kKFtdLCBzZWxmLmNoaWxkcmVuKSk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZVxuICAgICAgICB9LFxuICAgICAgICBkaXJ0eToge1xuICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgaWYgKHNpZXN0YS5leHQuc3RvcmFnZUVuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHVuc2F2ZWRPYmplY3RzQnlDb2xsZWN0aW9uID0gc2llc3RhLmV4dC5zdG9yYWdlLl91bnNhdmVkT2JqZWN0c0J5Q29sbGVjdGlvbixcbiAgICAgICAgICAgICAgICAgICAgICAgIGhhc2ggPSAodW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb25bdGhpcy5jb2xsZWN0aW9uTmFtZV0gfHwge30pW3RoaXMubmFtZV0gfHwge307XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiAhIU9iamVjdC5rZXlzKGhhc2gpLmxlbmd0aDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICAgICAgfSxcbiAgICAgICAgY29sbGVjdGlvbk5hbWU6IHtcbiAgICAgICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmNvbGxlY3Rpb24ubmFtZTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlXG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBldmVudHMuUHJveHlFdmVudEVtaXR0ZXIuY2FsbCh0aGlzLCB0aGlzLmNvbGxlY3Rpb25OYW1lICsgJzonICsgdGhpcy5uYW1lKTtcblxuXG59XG5cbl8uZXh0ZW5kKE1vZGVsLCB7XG4gICAgLyoqXG4gICAgICogTm9ybWFsaXNlIGF0dHJpYnV0ZXMgcGFzc2VkIHZpYSB0aGUgb3B0aW9ucyBkaWN0aW9uYXJ5LlxuICAgICAqIEBwYXJhbSBhdHRyaWJ1dGVzXG4gICAgICogQHJldHVybnMge0FycmF5fVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3Byb2Nlc3NBdHRyaWJ1dGVzOiBmdW5jdGlvbiAoYXR0cmlidXRlcykge1xuICAgICAgICByZXR1cm4gXy5yZWR1Y2UoYXR0cmlidXRlcywgZnVuY3Rpb24gKG0sIGEpIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgYSA9PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgIG0ucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgIG5hbWU6IGFcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIG0ucHVzaChhKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBtO1xuICAgICAgICB9LCBbXSlcbiAgICB9XG59KTtcblxuTW9kZWwucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShldmVudHMuUHJveHlFdmVudEVtaXR0ZXIucHJvdG90eXBlKTtcblxuXy5leHRlbmQoTW9kZWwucHJvdG90eXBlLCB7XG4gICAgaW5zdGFsbFN0YXRpY3M6IGZ1bmN0aW9uIChzdGF0aWNzKSB7XG4gICAgICAgIGlmIChzdGF0aWNzKSB7XG4gICAgICAgICAgICBfLmVhY2goT2JqZWN0LmtleXMoc3RhdGljcyksIGZ1bmN0aW9uIChzdGF0aWNOYW1lKSB7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXNbc3RhdGljTmFtZV0pIHtcbiAgICAgICAgICAgICAgICAgICAgTG9nZ2VyLmVycm9yKCdTdGF0aWMgbWV0aG9kIHdpdGggbmFtZSBcIicgKyBzdGF0aWNOYW1lICsgJ1wiIGFscmVhZHkgZXhpc3RzLiBJZ25vcmluZyBpdC4nKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXNbc3RhdGljTmFtZV0gPSBzdGF0aWNzW3N0YXRpY05hbWVdLmJpbmQodGhpcyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gc3RhdGljcztcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIEluc3RhbGwgcmVsYXRpb25zaGlwcy4gUmV0dXJucyBlcnJvciBpbiBmb3JtIG9mIHN0cmluZyBpZiBmYWlscy5cbiAgICAgKiBAcmV0dXJuIHtTdHJpbmd8bnVsbH1cbiAgICAgKi9cbiAgICBpbnN0YWxsUmVsYXRpb25zaGlwczogZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAoIXRoaXMuX3JlbGF0aW9uc2hpcHNJbnN0YWxsZWQpIHtcbiAgICAgICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgICAgIHNlbGYuX3JlbGF0aW9uc2hpcHMgPSBbXTtcbiAgICAgICAgICAgIGlmIChzZWxmLl9vcHRzLnJlbGF0aW9uc2hpcHMpIHtcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBuYW1lIGluIHNlbGYuX29wdHMucmVsYXRpb25zaGlwcykge1xuICAgICAgICAgICAgICAgICAgICBpZiAoc2VsZi5fb3B0cy5yZWxhdGlvbnNoaXBzLmhhc093blByb3BlcnR5KG5hbWUpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgcmVsYXRpb25zaGlwID0gc2VsZi5fb3B0cy5yZWxhdGlvbnNoaXBzW25hbWVdO1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gSWYgYSByZXZlcnNlIHJlbGF0aW9uc2hpcCBpcyBpbnN0YWxsZWQgYmVmb3JlaGFuZCwgd2UgZG8gbm90IHdhbnQgdG8gcHJvY2VzcyB0aGVtLlxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFyZWxhdGlvbnNoaXAuaXNSZXZlcnNlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKExvZ2dlci5kZWJ1Zy5pc0VuYWJsZWQpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIExvZ2dlci5kZWJ1ZyhzZWxmLm5hbWUgKyAnOiBjb25maWd1cmluZyByZWxhdGlvbnNoaXAgJyArIG5hbWUsIHJlbGF0aW9uc2hpcCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFyZWxhdGlvbnNoaXAudHlwZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoc2VsZi5zaW5nbGV0b24pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlbGF0aW9uc2hpcC50eXBlID0gUmVsYXRpb25zaGlwVHlwZS5PbmVUb09uZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlbGF0aW9uc2hpcC50eXBlID0gUmVsYXRpb25zaGlwVHlwZS5PbmVUb01hbnk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHNlbGYuc2luZ2xldG9uICYmIHJlbGF0aW9uc2hpcC50eXBlID09IFJlbGF0aW9uc2hpcFR5cGUuTWFueVRvTWFueSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gJ1NpbmdsZXRvbiBtb2RlbCBjYW5ub3QgdXNlIE1hbnlUb01hbnkgcmVsYXRpb25zaGlwLic7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChyZWxhdGlvbnNoaXAudHlwZSA9PSBSZWxhdGlvbnNoaXBUeXBlLk9uZVRvTWFueSB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZWxhdGlvbnNoaXAudHlwZSA9PSBSZWxhdGlvbnNoaXBUeXBlLk9uZVRvT25lIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlbGF0aW9uc2hpcC50eXBlID09IFJlbGF0aW9uc2hpcFR5cGUuTWFueVRvTWFueSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgbW9kZWxOYW1lID0gcmVsYXRpb25zaGlwLm1vZGVsO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZWxldGUgcmVsYXRpb25zaGlwLm1vZGVsO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgcmV2ZXJzZU1vZGVsO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAobW9kZWxOYW1lIGluc3RhbmNlb2YgTW9kZWwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldmVyc2VNb2RlbCA9IG1vZGVsTmFtZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChMb2dnZXIuZGVidWcuaXNFbmFibGVkKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIExvZ2dlci5kZWJ1ZygncmV2ZXJzZU1vZGVsTmFtZScsIG1vZGVsTmFtZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIXNlbGYuY29sbGVjdGlvbikgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ01vZGVsIG11c3QgaGF2ZSBjb2xsZWN0aW9uJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgY29sbGVjdGlvbiA9IHNlbGYuY29sbGVjdGlvbjtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghY29sbGVjdGlvbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdDb2xsZWN0aW9uICcgKyBzZWxmLmNvbGxlY3Rpb25OYW1lICsgJyBub3QgcmVnaXN0ZXJlZCcpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV2ZXJzZU1vZGVsID0gY29sbGVjdGlvblttb2RlbE5hbWVdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFyZXZlcnNlTW9kZWwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBhcnIgPSBtb2RlbE5hbWUuc3BsaXQoJy4nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChhcnIubGVuZ3RoID09IDIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgY29sbGVjdGlvbk5hbWUgPSBhcnJbMF07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbW9kZWxOYW1lID0gYXJyWzFdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBvdGhlckNvbGxlY3Rpb24gPSBDb2xsZWN0aW9uUmVnaXN0cnlbY29sbGVjdGlvbk5hbWVdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghb3RoZXJDb2xsZWN0aW9uKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiAnQ29sbGVjdGlvbiB3aXRoIG5hbWUgXCInICsgY29sbGVjdGlvbk5hbWUgKyAnXCIgZG9lcyBub3QgZXhpc3QuJztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV2ZXJzZU1vZGVsID0gb3RoZXJDb2xsZWN0aW9uW21vZGVsTmFtZV07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKExvZ2dlci5kZWJ1Zy5pc0VuYWJsZWQpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBMb2dnZXIuZGVidWcoJ3JldmVyc2VNb2RlbCcsIHJldmVyc2VNb2RlbCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChyZXZlcnNlTW9kZWwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlbGF0aW9uc2hpcC5yZXZlcnNlTW9kZWwgPSByZXZlcnNlTW9kZWw7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZWxhdGlvbnNoaXAuZm9yd2FyZE1vZGVsID0gdGhpcztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlbGF0aW9uc2hpcC5mb3J3YXJkTmFtZSA9IG5hbWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZWxhdGlvbnNoaXAucmV2ZXJzZU5hbWUgPSByZWxhdGlvbnNoaXAucmV2ZXJzZSB8fCAncmV2ZXJzZV8nICsgbmFtZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlbGV0ZSByZWxhdGlvbnNoaXAucmV2ZXJzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlbGF0aW9uc2hpcC5pc1JldmVyc2UgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiAnTW9kZWwgd2l0aCBuYW1lIFwiJyArIG1vZGVsTmFtZS50b1N0cmluZygpICsgJ1wiIGRvZXMgbm90IGV4aXN0JztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiAnUmVsYXRpb25zaGlwIHR5cGUgJyArIHJlbGF0aW9uc2hpcC50eXBlICsgJyBkb2VzIG5vdCBleGlzdCc7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5fcmVsYXRpb25zaGlwc0luc3RhbGxlZCA9IHRydWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignUmVsYXRpb25zaGlwcyBmb3IgXCInICsgdGhpcy5uYW1lICsgJ1wiIGhhdmUgYWxyZWFkeSBiZWVuIGluc3RhbGxlZCcpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH0sXG4gICAgaW5zdGFsbFJldmVyc2VSZWxhdGlvbnNoaXBzOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmICghdGhpcy5fcmV2ZXJzZVJlbGF0aW9uc2hpcHNJbnN0YWxsZWQpIHtcbiAgICAgICAgICAgIGZvciAodmFyIGZvcndhcmROYW1lIGluIHRoaXMucmVsYXRpb25zaGlwcykge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLnJlbGF0aW9uc2hpcHMuaGFzT3duUHJvcGVydHkoZm9yd2FyZE5hbWUpKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciByZWxhdGlvbnNoaXAgPSB0aGlzLnJlbGF0aW9uc2hpcHNbZm9yd2FyZE5hbWVdO1xuICAgICAgICAgICAgICAgICAgICByZWxhdGlvbnNoaXAgPSBleHRlbmQodHJ1ZSwge30sIHJlbGF0aW9uc2hpcCk7XG4gICAgICAgICAgICAgICAgICAgIHJlbGF0aW9uc2hpcC5pc1JldmVyc2UgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB2YXIgcmV2ZXJzZU1vZGVsID0gcmVsYXRpb25zaGlwLnJldmVyc2VNb2RlbCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldmVyc2VOYW1lID0gcmVsYXRpb25zaGlwLnJldmVyc2VOYW1lO1xuICAgICAgICAgICAgICAgICAgICBpZiAocmV2ZXJzZU1vZGVsLnNpbmdsZXRvbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHJlbGF0aW9uc2hpcC50eXBlID09IFJlbGF0aW9uc2hpcFR5cGUuTWFueVRvTWFueSkgcmV0dXJuICdTaW5nbGV0b24gbW9kZWwgY2Fubm90IGJlIHJlbGF0ZWQgdmlhIHJldmVyc2UgTWFueVRvTWFueSc7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAocmVsYXRpb25zaGlwLnR5cGUgPT0gUmVsYXRpb25zaGlwVHlwZS5PbmVUb01hbnkpIHJldHVybiAnU2luZ2xldG9uIG1vZGVsIGNhbm5vdCBiZSByZWxhdGVkIHZpYSByZXZlcnNlIE9uZVRvTWFueSc7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKExvZ2dlci5kZWJ1Zy5pc0VuYWJsZWQpXG4gICAgICAgICAgICAgICAgICAgICAgICBMb2dnZXIuZGVidWcodGhpcy5uYW1lICsgJzogY29uZmlndXJpbmcgIHJldmVyc2UgcmVsYXRpb25zaGlwICcgKyByZXZlcnNlTmFtZSk7XG4gICAgICAgICAgICAgICAgICAgIHJldmVyc2VNb2RlbC5yZWxhdGlvbnNoaXBzW3JldmVyc2VOYW1lXSA9IHJlbGF0aW9uc2hpcDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLl9yZXZlcnNlUmVsYXRpb25zaGlwc0luc3RhbGxlZCA9IHRydWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignUmV2ZXJzZSByZWxhdGlvbnNoaXBzIGZvciBcIicgKyB0aGlzLm5hbWUgKyAnXCIgaGF2ZSBhbHJlYWR5IGJlZW4gaW5zdGFsbGVkLicpO1xuICAgICAgICB9XG4gICAgfSxcbiAgICBfcXVlcnk6IGZ1bmN0aW9uIChxdWVyeSkge1xuICAgICAgICB2YXIgcXVlcnkgPSBuZXcgUXVlcnkodGhpcywgcXVlcnkgfHwge30pO1xuICAgICAgICByZXR1cm4gcXVlcnk7XG4gICAgfSxcbiAgICBxdWVyeTogZnVuY3Rpb24gKHF1ZXJ5LCBjYWxsYmFjaykge1xuICAgICAgICBpZiAoIXRoaXMuc2luZ2xldG9uKSByZXR1cm4gKHRoaXMuX3F1ZXJ5KHF1ZXJ5KSkuZXhlY3V0ZShjYWxsYmFjayk7XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdmFyIGRlZmVycmVkID0gdXRpbC5kZWZlcihjYWxsYmFjayk7XG4gICAgICAgICAgICBjYWxsYmFjayA9IGRlZmVycmVkLmZpbmlzaC5iaW5kKGRlZmVycmVkKTtcbiAgICAgICAgICAgICh0aGlzLl9xdWVyeSh7X19pZ25vcmVJbnN0YWxsZWQ6IHRydWV9KSkuZXhlY3V0ZShmdW5jdGlvbiAoZXJyLCBvYmpzKSB7XG4gICAgICAgICAgICAgICAgaWYgKGVycikgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gQ2FjaGUgYSBuZXcgc2luZ2xldG9uIGFuZCB0aGVuIHJlZXhlY3V0ZSB0aGUgcXVlcnlcbiAgICAgICAgICAgICAgICAgICAgcXVlcnkgPSBfLmV4dGVuZCh7fSwgcXVlcnkpO1xuICAgICAgICAgICAgICAgICAgICBxdWVyeS5fX2lnbm9yZUluc3RhbGxlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIGlmICghb2Jqcy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZ3JhcGgoe30sIGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAodGhpcy5fcXVlcnkocXVlcnkpKS5leGVjdXRlKGNhbGxiYWNrKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICh0aGlzLl9xdWVyeShxdWVyeSkpLmV4ZWN1dGUoY2FsbGJhY2spO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgICAgICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xuICAgICAgICB9XG4gICAgfSxcbiAgICByZWFjdGl2ZVF1ZXJ5OiBmdW5jdGlvbiAocXVlcnkpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBSZWFjdGl2ZVF1ZXJ5KG5ldyBRdWVyeSh0aGlzLCBxdWVyeSB8fCB7fSkpO1xuICAgIH0sXG4gICAgYXJyYW5nZWRSZWFjdGl2ZVF1ZXJ5OiBmdW5jdGlvbiAocXVlcnkpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBBcnJhbmdlZFJlYWN0aXZlUXVlcnkobmV3IFF1ZXJ5KHRoaXMsIHF1ZXJ5IHx8IHt9KSk7XG4gICAgfSxcbiAgICBvbmU6IGZ1bmN0aW9uIChvcHRzLCBjYikge1xuICAgICAgICBpZiAodHlwZW9mIG9wdHMgPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgY2IgPSBvcHRzO1xuICAgICAgICAgICAgb3B0cyA9IHt9O1xuICAgICAgICB9XG4gICAgICAgIHZhciBkZWZlcnJlZCA9IHV0aWwuZGVmZXIoY2IpO1xuICAgICAgICBjYiA9IGRlZmVycmVkLmZpbmlzaC5iaW5kKGRlZmVycmVkKTtcbiAgICAgICAgdGhpcy5xdWVyeShvcHRzLCBmdW5jdGlvbiAoZXJyLCByZXMpIHtcbiAgICAgICAgICAgIGlmIChlcnIpIGNiKGVycik7XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZiAocmVzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgY2IoJ01vcmUgdGhhbiBvbmUgaW5zdGFuY2UgcmV0dXJuZWQgd2hlbiBleGVjdXRpbmcgZ2V0IHF1ZXJ5IScpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzID0gcmVzLmxlbmd0aCA/IHJlc1swXSA6IG51bGw7XG4gICAgICAgICAgICAgICAgICAgIGNiKG51bGwsIHJlcyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG4gICAgfSxcbiAgICBhbGw6IGZ1bmN0aW9uIChxLCBjYikge1xuICAgICAgICBpZiAodHlwZW9mIHEgPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgY2IgPSBxO1xuICAgICAgICAgICAgcSA9IHt9O1xuICAgICAgICB9XG4gICAgICAgIHEgPSBxIHx8IHt9O1xuICAgICAgICB2YXIgcXVlcnkgPSB7fTtcbiAgICAgICAgaWYgKHEuX19vcmRlcikgcXVlcnkuX19vcmRlciA9IHEuX19vcmRlcjtcbiAgICAgICAgcmV0dXJuIHRoaXMucXVlcnkocSwgY2IpO1xuICAgIH0sXG4gICAgaW5zdGFsbDogZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgICAgIGlmIChMb2dnZXIuaW5mby5pc0VuYWJsZWQpIExvZ2dlci5pbmZvKCdJbnN0YWxsaW5nIG1hcHBpbmcgJyArIHRoaXMubmFtZSk7XG4gICAgICAgIHZhciBkZWZlcnJlZCA9IHV0aWwuZGVmZXIoY2FsbGJhY2spO1xuICAgICAgICBjYWxsYmFjayA9IGRlZmVycmVkLmZpbmlzaC5iaW5kKGRlZmVycmVkKTtcbiAgICAgICAgaWYgKCF0aGlzLl9pbnN0YWxsZWQpIHtcbiAgICAgICAgICAgIHRoaXMuX2luc3RhbGxlZCA9IHRydWU7XG4gICAgICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ01vZGVsIFwiJyArIHRoaXMubmFtZSArICdcIiBoYXMgYWxyZWFkeSBiZWVuIGluc3RhbGxlZCcpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xuICAgIH0sXG4gICAgLyoqXG4gICAgICogTWFwIGRhdGEgaW50byBTaWVzdGEuXG4gICAgICpcbiAgICAgKiBAcGFyYW0gZGF0YSBSYXcgZGF0YSByZWNlaXZlZCByZW1vdGVseSBvciBvdGhlcndpc2VcbiAgICAgKiBAcGFyYW0ge2Z1bmN0aW9ufG9iamVjdH0gW29wdHNdXG4gICAgICogQHBhcmFtIHtib29sZWFufSBvcHRzLm92ZXJyaWRlXG4gICAgICogQHBhcmFtIHtib29sZWFufSBvcHRzLl9pZ25vcmVJbnN0YWxsZWQgLSBBbiBlc2NhcGUgY2xhdXNlIHRoYXQgYWxsb3dzIG1hcHBpbmcgb250byBNb2RlbHMgZXZlbiBpZiBpbnN0YWxsIHByb2Nlc3MgaGFzIG5vdCBmaW5pc2hlZC5cbiAgICAgKiBAcGFyYW0ge2Z1bmN0aW9ufSBbY2FsbGJhY2tdIENhbGxlZCBvbmNlIHBvdWNoIHBlcnNpc3RlbmNlIHJldHVybnMuXG4gICAgICovXG4gICAgZ3JhcGg6IGZ1bmN0aW9uIChkYXRhLCBvcHRzLCBjYWxsYmFjaykge1xuICAgICAgICBpZiAodHlwZW9mIG9wdHMgPT0gJ2Z1bmN0aW9uJykgY2FsbGJhY2sgPSBvcHRzO1xuICAgICAgICBvcHRzID0gb3B0cyB8fCB7fTtcbiAgICAgICAgdmFyIGRlZmVycmVkID0gdXRpbC5kZWZlcihjYWxsYmFjayk7XG4gICAgICAgIHZhciBfbWFwID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdmFyIG92ZXJyaWRlcyA9IG9wdHMub3ZlcnJpZGU7XG4gICAgICAgICAgICBpZiAob3ZlcnJpZGVzKSB7XG4gICAgICAgICAgICAgICAgaWYgKHV0aWwuaXNBcnJheShvdmVycmlkZXMpKSBvcHRzLm9iamVjdHMgPSBvdmVycmlkZXM7XG4gICAgICAgICAgICAgICAgZWxzZSBvcHRzLm9iamVjdHMgPSBbb3ZlcnJpZGVzXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGRlbGV0ZSBvcHRzLm92ZXJyaWRlO1xuICAgICAgICAgICAgaWYgKHV0aWwuaXNBcnJheShkYXRhKSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX21hcEJ1bGsoZGF0YSwgb3B0cywgZGVmZXJyZWQuZmluaXNoLmJpbmQoZGVmZXJyZWQpKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fbWFwQnVsayhbZGF0YV0sIG9wdHMsIGZ1bmN0aW9uIChlcnIsIG9iamVjdHMpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIG9iajtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG9iamVjdHMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChvYmplY3RzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9iaiA9IG9iamVjdHNbMF07XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZGVmZXJyZWQuZmluaXNoKGVyciA/ICh1dGlsLmlzQXJyYXkoZXJyKSA/IGVyclswXSA6IGVycikgOiBudWxsLCBvYmopO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LmJpbmQodGhpcyk7XG4gICAgICAgIGlmIChvcHRzLl9pZ25vcmVJbnN0YWxsZWQpIHtcbiAgICAgICAgICAgIF9tYXAoKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHNpZXN0YS5fYWZ0ZXJJbnN0YWxsKF9tYXApO1xuICAgICAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbiAgICB9LFxuICAgIF9tYXBCdWxrOiBmdW5jdGlvbiAoZGF0YSwgb3B0cywgY2FsbGJhY2spIHtcbiAgICAgICAgXy5leHRlbmQob3B0cywge21vZGVsOiB0aGlzLCBkYXRhOiBkYXRhfSk7XG4gICAgICAgIHZhciBvcCA9IG5ldyBNYXBwaW5nT3BlcmF0aW9uKG9wdHMpO1xuICAgICAgICBvcC5zdGFydChmdW5jdGlvbiAoZXJyLCBvYmplY3RzKSB7XG4gICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhudWxsLCBvYmplY3RzIHx8IFtdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfSxcbiAgICBfY291bnRDYWNoZTogZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgY29sbENhY2hlID0gY2FjaGUuX2xvY2FsQ2FjaGVCeVR5cGVbdGhpcy5jb2xsZWN0aW9uTmFtZV0gfHwge307XG4gICAgICAgIHZhciBtb2RlbENhY2hlID0gY29sbENhY2hlW3RoaXMubmFtZV0gfHwge307XG4gICAgICAgIHJldHVybiBfLnJlZHVjZShPYmplY3Qua2V5cyhtb2RlbENhY2hlKSwgZnVuY3Rpb24gKG0sIF9pZCkge1xuICAgICAgICAgICAgbVtfaWRdID0ge307XG4gICAgICAgICAgICByZXR1cm4gbTtcbiAgICAgICAgfSwge30pO1xuICAgIH0sXG4gICAgY291bnQ6IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgICAgICB2YXIgZGVmZXJyZWQgPSB1dGlsLmRlZmVyKGNhbGxiYWNrKTtcbiAgICAgICAgY2FsbGJhY2sgPSBkZWZlcnJlZC5maW5pc2guYmluZChkZWZlcnJlZCk7XG4gICAgICAgIHZhciBoYXNoID0gdGhpcy5fY291bnRDYWNoZSgpO1xuICAgICAgICBjYWxsYmFjayhudWxsLCBPYmplY3Qua2V5cyhoYXNoKS5sZW5ndGgpO1xuICAgICAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIENvbnZlcnQgcmF3IGRhdGEgaW50byBhIE1vZGVsSW5zdGFuY2VcbiAgICAgKiBAcmV0dXJucyB7TW9kZWxJbnN0YW5jZX1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9uZXc6IGZ1bmN0aW9uIChkYXRhLCBzaG91bGRSZWdpc3RlckNoYW5nZSkge1xuICAgICAgICBzaG91bGRSZWdpc3RlckNoYW5nZSA9IHNob3VsZFJlZ2lzdGVyQ2hhbmdlID09PSB1bmRlZmluZWQgPyB0cnVlIDogc2hvdWxkUmVnaXN0ZXJDaGFuZ2U7XG4gICAgICAgIGlmICh0aGlzLmluc3RhbGxlZCkge1xuICAgICAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICAgICAgdmFyIF9pZDtcbiAgICAgICAgICAgIGlmIChkYXRhKSB7XG4gICAgICAgICAgICAgICAgX2lkID0gZGF0YS5faWQgPyBkYXRhLl9pZCA6IGd1aWQoKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgX2lkID0gZ3VpZCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdmFyIG5ld01vZGVsID0gbmV3IE1vZGVsSW5zdGFuY2UodGhpcyk7XG4gICAgICAgICAgICBpZiAoTG9nZ2VyLmluZm8uaXNFbmFibGVkKVxuICAgICAgICAgICAgICAgIExvZ2dlci5pbmZvKCdOZXcgb2JqZWN0IGNyZWF0ZWQgX2lkPVwiJyArIF9pZC50b1N0cmluZygpICsgJ1wiLCB0eXBlPScgKyB0aGlzLm5hbWUsIGRhdGEpO1xuICAgICAgICAgICAgbmV3TW9kZWwuX2lkID0gX2lkO1xuICAgICAgICAgICAgLy8gUGxhY2UgYXR0cmlidXRlcyBvbiB0aGUgb2JqZWN0LlxuICAgICAgICAgICAgdmFyIHZhbHVlcyA9IHt9O1xuICAgICAgICAgICAgbmV3TW9kZWwuX192YWx1ZXMgPSB2YWx1ZXM7XG4gICAgICAgICAgICB2YXIgZGVmYXVsdHMgPSBfLnJlZHVjZSh0aGlzLmF0dHJpYnV0ZXMsIGZ1bmN0aW9uIChtLCBhKSB7XG4gICAgICAgICAgICAgICAgaWYgKGEuZGVmYXVsdCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgIG1bYS5uYW1lXSA9IGEuZGVmYXVsdDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIG07XG4gICAgICAgICAgICB9LCB7fSk7XG4gICAgICAgICAgICBfLmV4dGVuZCh2YWx1ZXMsIGRlZmF1bHRzKTtcbiAgICAgICAgICAgIGlmIChkYXRhKSBfLmV4dGVuZCh2YWx1ZXMsIGRhdGEpO1xuICAgICAgICAgICAgdmFyIGZpZWxkcyA9IHRoaXMuX2F0dHJpYnV0ZU5hbWVzO1xuICAgICAgICAgICAgdmFyIGlkeCA9IGZpZWxkcy5pbmRleE9mKHRoaXMuaWQpO1xuICAgICAgICAgICAgaWYgKGlkeCA+IC0xKSB7XG4gICAgICAgICAgICAgICAgZmllbGRzLnNwbGljZShpZHgsIDEpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXy5lYWNoKGZpZWxkcywgZnVuY3Rpb24gKGZpZWxkKSB7XG4gICAgICAgICAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG5ld01vZGVsLCBmaWVsZCwge1xuICAgICAgICAgICAgICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciB2YWx1ZSA9IG5ld01vZGVsLl9fdmFsdWVzW2ZpZWxkXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB2YWx1ZSA9PT0gdW5kZWZpbmVkID8gbnVsbCA6IHZhbHVlO1xuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICBzZXQ6IGZ1bmN0aW9uICh2KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgb2xkID0gbmV3TW9kZWwuX192YWx1ZXNbZmllbGRdO1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHByb3BlcnR5RGVwZW5kZW5jaWVzID0gdGhpcy5fcHJvcGVydHlEZXBlbmRlbmNpZXNbZmllbGRdO1xuICAgICAgICAgICAgICAgICAgICAgICAgcHJvcGVydHlEZXBlbmRlbmNpZXMgPSBfLm1hcChwcm9wZXJ0eURlcGVuZGVuY2llcywgZnVuY3Rpb24gKGRlcGVuZGFudCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByb3A6IGRlcGVuZGFudCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb2xkOiB0aGlzW2RlcGVuZGFudF1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICAgICAgICAgICAgICAgICAgbmV3TW9kZWwuX192YWx1ZXNbZmllbGRdID0gdjtcbiAgICAgICAgICAgICAgICAgICAgICAgIHByb3BlcnR5RGVwZW5kZW5jaWVzLmZvckVhY2goZnVuY3Rpb24gKGRlcCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBwcm9wZXJ0eU5hbWUgPSBkZXAucHJvcDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgbmV3XyA9IHRoaXNbcHJvcGVydHlOYW1lXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtb2RlbEV2ZW50cy5lbWl0KHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29sbGVjdGlvbjogc2VsZi5jb2xsZWN0aW9uTmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbW9kZWw6IHNlbGYubmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgX2lkOiBuZXdNb2RlbC5faWQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5ldzogbmV3XyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb2xkOiBkZXAub2xkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiBNb2RlbEV2ZW50VHlwZS5TZXQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZpZWxkOiBwcm9wZXJ0eU5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9iajogbmV3TW9kZWxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgZSA9IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb2xsZWN0aW9uOiBzZWxmLmNvbGxlY3Rpb25OYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1vZGVsOiBzZWxmLm5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgX2lkOiBuZXdNb2RlbC5faWQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV3OiB2LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9sZDogb2xkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6IE1vZGVsRXZlbnRUeXBlLlNldCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmaWVsZDogZmllbGQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb2JqOiBuZXdNb2RlbFxuICAgICAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHdpbmRvdy5sYXN0RW1pc3Npb24gPSBlO1xuICAgICAgICAgICAgICAgICAgICAgICAgbW9kZWxFdmVudHMuZW1pdChlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh1dGlsLmlzQXJyYXkodikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB3cmFwQXJyYXkodiwgZmllbGQsIG5ld01vZGVsKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgXy5lYWNoKE9iamVjdC5rZXlzKHRoaXMubWV0aG9kcyksIGZ1bmN0aW9uIChtZXRob2ROYW1lKSB7XG4gICAgICAgICAgICAgICAgaWYgKG5ld01vZGVsW21ldGhvZE5hbWVdID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgbmV3TW9kZWxbbWV0aG9kTmFtZV0gPSB0aGlzLm1ldGhvZHNbbWV0aG9kTmFtZV0uYmluZChuZXdNb2RlbCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBMb2dnZXIuZXJyb3IoJ0EgbWV0aG9kIHdpdGggbmFtZSBcIicgKyBtZXRob2ROYW1lICsgJ1wiIGFscmVhZHkgZXhpc3RzLiBJZ25vcmluZyBpdC4nKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LmJpbmQodGhpcykpO1xuXG4gICAgICAgICAgICB2YXIgX3Byb3BlcnR5TmFtZXMgPSBPYmplY3Qua2V5cyh0aGlzLnByb3BlcnRpZXMpLFxuICAgICAgICAgICAgICAgIF9wcm9wZXJ0eURlcGVuZGVuY2llcyA9IHt9O1xuICAgICAgICAgICAgXy5lYWNoKF9wcm9wZXJ0eU5hbWVzLCBmdW5jdGlvbiAocHJvcE5hbWUpIHtcbiAgICAgICAgICAgICAgICB2YXIgcHJvcERlZiA9IHRoaXMucHJvcGVydGllc1twcm9wTmFtZV07XG4gICAgICAgICAgICAgICAgdmFyIGRlcGVuZGVuY2llcyA9IHByb3BEZWYuZGVwZW5kZW5jaWVzIHx8IFtdO1xuICAgICAgICAgICAgICAgIGRlcGVuZGVuY2llcy5mb3JFYWNoKGZ1bmN0aW9uIChhdHRyKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghX3Byb3BlcnR5RGVwZW5kZW5jaWVzW2F0dHJdKSBfcHJvcGVydHlEZXBlbmRlbmNpZXNbYXR0cl0gPSBbXTtcbiAgICAgICAgICAgICAgICAgICAgX3Byb3BlcnR5RGVwZW5kZW5jaWVzW2F0dHJdLnB1c2gocHJvcE5hbWUpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGRlbGV0ZSBwcm9wRGVmLmRlcGVuZGVuY2llcztcbiAgICAgICAgICAgICAgICBpZiAobmV3TW9kZWxbcHJvcE5hbWVdID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG5ld01vZGVsLCBwcm9wTmFtZSwgcHJvcERlZik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBMb2dnZXIuZXJyb3IoJ0EgcHJvcGVydHkvbWV0aG9kIHdpdGggbmFtZSBcIicgKyBwcm9wTmFtZSArICdcIiBhbHJlYWR5IGV4aXN0cy4gSWdub3JpbmcgaXQuJyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfS5iaW5kKHRoaXMpKTtcblxuICAgICAgICAgICAgbmV3TW9kZWwuX3Byb3BlcnR5RGVwZW5kZW5jaWVzID0gX3Byb3BlcnR5RGVwZW5kZW5jaWVzO1xuXG4gICAgICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkobmV3TW9kZWwsIHRoaXMuaWQsIHtcbiAgICAgICAgICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG5ld01vZGVsLl9fdmFsdWVzW3NlbGYuaWRdIHx8IG51bGw7XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBzZXQ6IGZ1bmN0aW9uICh2KSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBvbGQgPSBuZXdNb2RlbFtzZWxmLmlkXTtcbiAgICAgICAgICAgICAgICAgICAgbmV3TW9kZWwuX192YWx1ZXNbc2VsZi5pZF0gPSB2O1xuICAgICAgICAgICAgICAgICAgICBtb2RlbEV2ZW50cy5lbWl0KHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbGxlY3Rpb246IHNlbGYuY29sbGVjdGlvbk5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBtb2RlbDogc2VsZi5uYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgX2lkOiBuZXdNb2RlbC5faWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBuZXc6IHYsXG4gICAgICAgICAgICAgICAgICAgICAgICBvbGQ6IG9sZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6IE1vZGVsRXZlbnRUeXBlLlNldCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGZpZWxkOiBzZWxmLmlkLFxuICAgICAgICAgICAgICAgICAgICAgICAgb2JqOiBuZXdNb2RlbFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgY2FjaGUucmVtb3RlSW5zZXJ0KG5ld01vZGVsLCB2LCBvbGQpO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgZm9yICh2YXIgbmFtZSBpbiB0aGlzLnJlbGF0aW9uc2hpcHMpIHtcbiAgICAgICAgICAgICAgICB2YXIgcHJveHk7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMucmVsYXRpb25zaGlwcy5oYXNPd25Qcm9wZXJ0eShuYW1lKSkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgcmVsYXRpb25zaGlwT3B0cyA9IF8uZXh0ZW5kKHt9LCB0aGlzLnJlbGF0aW9uc2hpcHNbbmFtZV0pLFxuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZSA9IHJlbGF0aW9uc2hpcE9wdHMudHlwZTtcbiAgICAgICAgICAgICAgICAgICAgZGVsZXRlIHJlbGF0aW9uc2hpcE9wdHMudHlwZTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGUgPT0gUmVsYXRpb25zaGlwVHlwZS5PbmVUb01hbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHByb3h5ID0gbmV3IE9uZVRvTWFueVByb3h5KHJlbGF0aW9uc2hpcE9wdHMpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHR5cGUgPT0gUmVsYXRpb25zaGlwVHlwZS5PbmVUb09uZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcHJveHkgPSBuZXcgT25lVG9PbmVQcm94eShyZWxhdGlvbnNoaXBPcHRzKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmICh0eXBlID09IFJlbGF0aW9uc2hpcFR5cGUuTWFueVRvTWFueSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcHJveHkgPSBuZXcgTWFueVRvTWFueVByb3h5KHJlbGF0aW9uc2hpcE9wdHMpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ05vIHN1Y2ggcmVsYXRpb25zaGlwIHR5cGU6ICcgKyB0eXBlKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBwcm94eS5pbnN0YWxsKG5ld01vZGVsKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhY2hlLmluc2VydChuZXdNb2RlbCk7XG4gICAgICAgICAgICBpZiAoc2hvdWxkUmVnaXN0ZXJDaGFuZ2UpIHtcbiAgICAgICAgICAgICAgICBtb2RlbEV2ZW50cy5lbWl0KHtcbiAgICAgICAgICAgICAgICAgICAgY29sbGVjdGlvbjogdGhpcy5jb2xsZWN0aW9uTmFtZSxcbiAgICAgICAgICAgICAgICAgICAgbW9kZWw6IHRoaXMubmFtZSxcbiAgICAgICAgICAgICAgICAgICAgX2lkOiBuZXdNb2RlbC5faWQsXG4gICAgICAgICAgICAgICAgICAgIG5ldzogbmV3TW9kZWwsXG4gICAgICAgICAgICAgICAgICAgIHR5cGU6IE1vZGVsRXZlbnRUeXBlLk5ldyxcbiAgICAgICAgICAgICAgICAgICAgb2JqOiBuZXdNb2RlbFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIG5ld01vZGVsO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ01vZGVsIG11c3QgYmUgZnVsbHkgaW5zdGFsbGVkIGJlZm9yZSBjcmVhdGluZyBhbnkgbW9kZWxzJyk7XG4gICAgICAgIH1cblxuICAgIH0sXG4gICAgX2R1bXA6IGZ1bmN0aW9uIChhc0pTT04pIHtcbiAgICAgICAgdmFyIGR1bXBlZCA9IHt9O1xuICAgICAgICBkdW1wZWQubmFtZSA9IHRoaXMubmFtZTtcbiAgICAgICAgZHVtcGVkLmF0dHJpYnV0ZXMgPSB0aGlzLmF0dHJpYnV0ZXM7XG4gICAgICAgIGR1bXBlZC5pZCA9IHRoaXMuaWQ7XG4gICAgICAgIGR1bXBlZC5jb2xsZWN0aW9uID0gdGhpcy5jb2xsZWN0aW9uTmFtZTtcbiAgICAgICAgZHVtcGVkLnJlbGF0aW9uc2hpcHMgPSBfLm1hcCh0aGlzLnJlbGF0aW9uc2hpcHMsIGZ1bmN0aW9uIChyKSB7XG4gICAgICAgICAgICByZXR1cm4gci5pc0ZvcndhcmQgPyByLmZvcndhcmROYW1lIDogci5yZXZlcnNlTmFtZTtcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBhc0pTT04gPyB1dGlsLnByZXR0eVByaW50KGR1bXBlZCkgOiBkdW1wZWQ7XG4gICAgfSxcbiAgICB0b1N0cmluZzogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gJ01vZGVsWycgKyB0aGlzLm5hbWUgKyAnXSc7XG4gICAgfVxuXG59KTtcblxuXG5cbi8vXG4vL18uZXh0ZW5kKE1vZGVsLnByb3RvdHlwZSwge1xuLy8gICAgbGlzdGVuOiBmdW5jdGlvbiAoZm4pIHtcbi8vICAgICAgICBldmVudHMub24odGhpcy5jb2xsZWN0aW9uTmFtZSArICc6JyArIHRoaXMubmFtZSwgZm4pO1xuLy8gICAgICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4vLyAgICAgICAgICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIoZm4pO1xuLy8gICAgICAgIH0uYmluZCh0aGlzKTtcbi8vICAgIH0sXG4vLyAgICBsaXN0ZW5PbmNlOiBmdW5jdGlvbiAoZm4pIHtcbi8vICAgICAgICByZXR1cm4gZXZlbnRzLm9uY2UodGhpcy5jb2xsZWN0aW9uTmFtZSArICc6JyArIHRoaXMubmFtZSwgZm4pO1xuLy8gICAgfSxcbi8vICAgIHJlbW92ZUxpc3RlbmVyOiBmdW5jdGlvbiAoZm4pIHtcbi8vICAgICAgICByZXR1cm4gZXZlbnRzLnJlbW92ZUxpc3RlbmVyKHRoaXMuY29sbGVjdGlvbk5hbWUgKyAnOicgKyB0aGlzLm5hbWUsIGZuKTtcbi8vICAgIH1cbi8vfSk7XG4vL1xuLy8vLyBBbGlhc2VzXG4vL18uZXh0ZW5kKE1vZGVsLnByb3RvdHlwZSwge1xuLy8gICAgb246IE1vZGVsLnByb3RvdHlwZS5saXN0ZW5cbi8vfSk7XG5cbi8vIFN1YmNsYXNzaW5nXG5fLmV4dGVuZChNb2RlbC5wcm90b3R5cGUsIHtcbiAgICBjaGlsZDogZnVuY3Rpb24gKG5hbWVPck9wdHMsIG9wdHMpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBuYW1lT3JPcHRzID09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICBvcHRzLm5hbWUgPSBuYW1lT3JPcHRzO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgb3B0cyA9IG5hbWU7XG4gICAgICAgIH1cbiAgICAgICAgXy5leHRlbmQob3B0cywge1xuICAgICAgICAgICAgYXR0cmlidXRlczogQXJyYXkucHJvdG90eXBlLmNvbmNhdC5jYWxsKG9wdHMuYXR0cmlidXRlcyB8fCBbXSwgdGhpcy5fb3B0cy5hdHRyaWJ1dGVzKSxcbiAgICAgICAgICAgIHJlbGF0aW9uc2hpcHM6IF8uZXh0ZW5kKG9wdHMucmVsYXRpb25zaGlwcyB8fCB7fSwgdGhpcy5fb3B0cy5yZWxhdGlvbnNoaXBzKSxcbiAgICAgICAgICAgIG1ldGhvZHM6IF8uZXh0ZW5kKF8uZXh0ZW5kKHt9LCB0aGlzLl9vcHRzLm1ldGhvZHMpIHx8IHt9LCBvcHRzLm1ldGhvZHMpLFxuICAgICAgICAgICAgc3RhdGljczogXy5leHRlbmQoXy5leHRlbmQoe30sIHRoaXMuX29wdHMuc3RhdGljcykgfHwge30sIG9wdHMuc3RhdGljcyksXG4gICAgICAgICAgICBwcm9wZXJ0aWVzOiBfLmV4dGVuZChfLmV4dGVuZCh7fSwgdGhpcy5fb3B0cy5wcm9wZXJ0aWVzKSB8fCB7fSwgb3B0cy5wcm9wZXJ0aWVzKSxcbiAgICAgICAgICAgIGlkOiBvcHRzLmlkIHx8IHRoaXMuX29wdHMuaWQsXG4gICAgICAgICAgICBpbml0OiBvcHRzLmluaXQgfHwgdGhpcy5fb3B0cy5pbml0LFxuICAgICAgICAgICAgcmVtb3ZlOiBvcHRzLnJlbW92ZSB8fCB0aGlzLl9vcHRzLnJlbW92ZVxuICAgICAgICB9KTtcbiAgICAgICAgdmFyIG1vZGVsID0gdGhpcy5jb2xsZWN0aW9uLm1vZGVsKG9wdHMubmFtZSwgb3B0cyk7XG4gICAgICAgIG1vZGVsLnBhcmVudCA9IHRoaXM7XG4gICAgICAgIHRoaXMuY2hpbGRyZW4ucHVzaChtb2RlbCk7XG4gICAgICAgIHJldHVybiBtb2RlbDtcbiAgICB9LFxuICAgIGlzQ2hpbGRPZjogZnVuY3Rpb24gKHBhcmVudCkge1xuICAgICAgICByZXR1cm4gdGhpcy5wYXJlbnQgPT0gcGFyZW50O1xuICAgIH0sXG4gICAgaXNQYXJlbnRPZjogZnVuY3Rpb24gKGNoaWxkKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmNoaWxkcmVuLmluZGV4T2YoY2hpbGQpID4gLTE7XG4gICAgfSxcbiAgICBpc0Rlc2NlbmRhbnRPZjogZnVuY3Rpb24gKGFuY2VzdG9yKSB7XG4gICAgICAgIHZhciBwYXJlbnQgPSB0aGlzLnBhcmVudDtcbiAgICAgICAgd2hpbGUgKHBhcmVudCkge1xuICAgICAgICAgICAgaWYgKHBhcmVudCA9PSBhbmNlc3RvcikgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICBwYXJlbnQgPSBwYXJlbnQucGFyZW50O1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9LFxuICAgIGlzQW5jZXN0b3JPZjogZnVuY3Rpb24gKGRlc2NlbmRhbnQpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZGVzY2VuZGFudHMuaW5kZXhPZihkZXNjZW5kYW50KSA+IC0xO1xuICAgIH0sXG4gICAgaGFzQXR0cmlidXRlTmFtZWQ6IGZ1bmN0aW9uIChhdHRyaWJ1dGVOYW1lKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hdHRyaWJ1dGVOYW1lcy5pbmRleE9mKGF0dHJpYnV0ZU5hbWUpID4gLTE7XG4gICAgfVxufSk7XG5cbl8uZXh0ZW5kKE1vZGVsLnByb3RvdHlwZSwge1xuICAgIHBhZ2luYXRvcjogZnVuY3Rpb24gKG9wdHMpIHtcbiAgICAgICAgaWYgKHNpZXN0YS5leHQuaHR0cEVuYWJsZWQpIHtcbiAgICAgICAgICAgIHZhciBQYWdpbmF0b3IgPSBzaWVzdGEuZXh0Lmh0dHAuUGFnaW5hdG9yO1xuICAgICAgICAgICAgb3B0cyA9IG9wdHMgfHwge307XG4gICAgICAgICAgICBvcHRzLm1vZGVsID0gdGhpcztcbiAgICAgICAgICAgIHJldHVybiBuZXcgUGFnaW5hdG9yKG9wdHMpO1xuICAgICAgICB9XG4gICAgfVxufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gTW9kZWw7XG4iLCJ2YXIgZXZlbnRzID0gcmVxdWlyZSgnLi9ldmVudHMnKSxcbiAgICBJbnRlcm5hbFNpZXN0YUVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpLkludGVybmFsU2llc3RhRXJyb3IsXG4gICAgbG9nID0gcmVxdWlyZSgnLi9sb2cnKSxcbiAgICBleHRlbmQgPSByZXF1aXJlKCcuL3V0aWwnKS5fLmV4dGVuZCxcbiAgICBjb2xsZWN0aW9uUmVnaXN0cnkgPSByZXF1aXJlKCcuL2NvbGxlY3Rpb25SZWdpc3RyeScpLkNvbGxlY3Rpb25SZWdpc3RyeTtcblxudmFyIExvZ2dlciA9IGxvZy5sb2dnZXJXaXRoTmFtZSgnTW9kZWxFdmVudHMnKTtcblxuLyoqXG4gKiBDb25zdGFudHMgdGhhdCBkZXNjcmliZSBjaGFuZ2UgZXZlbnRzLlxuICogU2V0ID0+IEEgbmV3IHZhbHVlIGlzIGFzc2lnbmVkIHRvIGFuIGF0dHJpYnV0ZS9yZWxhdGlvbnNoaXBcbiAqIFNwbGljZSA9PiBBbGwgamF2YXNjcmlwdCBhcnJheSBvcGVyYXRpb25zIGFyZSBkZXNjcmliZWQgYXMgc3BsaWNlcy5cbiAqIERlbGV0ZSA9PiBVc2VkIGluIHRoZSBjYXNlIHdoZXJlIG9iamVjdHMgYXJlIHJlbW92ZWQgZnJvbSBhbiBhcnJheSwgYnV0IGFycmF5IG9yZGVyIGlzIG5vdCBrbm93biBpbiBhZHZhbmNlLlxuICogUmVtb3ZlID0+IE9iamVjdCBkZWxldGlvbiBldmVudHNcbiAqIE5ldyA9PiBPYmplY3QgY3JlYXRpb24gZXZlbnRzXG4gKiBAdHlwZSB7T2JqZWN0fVxuICovXG52YXIgTW9kZWxFdmVudFR5cGUgPSB7XG4gICAgICAgIFNldDogJ1NldCcsXG4gICAgICAgIFNwbGljZTogJ1NwbGljZScsXG4gICAgICAgIE5ldzogJ05ldycsXG4gICAgICAgIFJlbW92ZTogJ1JlbW92ZSdcbiAgICB9O1xuXG4vKipcbiAqIFJlcHJlc2VudHMgYW4gaW5kaXZpZHVhbCBjaGFuZ2UuXG4gKiBAcGFyYW0gb3B0c1xuICogQGNvbnN0cnVjdG9yXG4gKi9cbmZ1bmN0aW9uIE1vZGVsRXZlbnQob3B0cykge1xuICAgIHRoaXMuX29wdHMgPSBvcHRzIHx8IHt9O1xuICAgIE9iamVjdC5rZXlzKG9wdHMpLmZvckVhY2goZnVuY3Rpb24gKGspIHtcbiAgICAgICAgdGhpc1trXSA9IG9wdHNba107XG4gICAgfS5iaW5kKHRoaXMpKTtcbn1cblxuTW9kZWxFdmVudC5wcm90b3R5cGUuX2R1bXAgPSBmdW5jdGlvbiAocHJldHR5KSB7XG4gICAgdmFyIGR1bXBlZCA9IHt9O1xuICAgIGR1bXBlZC5jb2xsZWN0aW9uID0gKHR5cGVvZiB0aGlzLmNvbGxlY3Rpb24pID09ICdzdHJpbmcnID8gdGhpcy5jb2xsZWN0aW9uIDogdGhpcy5jb2xsZWN0aW9uLl9kdW1wKCk7XG4gICAgZHVtcGVkLm1vZGVsID0gKHR5cGVvZiB0aGlzLm1vZGVsKSA9PSAnc3RyaW5nJyA/IHRoaXMubW9kZWwgOiB0aGlzLm1vZGVsLm5hbWU7XG4gICAgZHVtcGVkLl9pZCA9IHRoaXMuX2lkO1xuICAgIGR1bXBlZC5maWVsZCA9IHRoaXMuZmllbGQ7XG4gICAgZHVtcGVkLnR5cGUgPSB0aGlzLnR5cGU7XG4gICAgaWYgKHRoaXMuaW5kZXgpIGR1bXBlZC5pbmRleCA9IHRoaXMuaW5kZXg7XG4gICAgaWYgKHRoaXMuYWRkZWQpIGR1bXBlZC5hZGRlZCA9IF8ubWFwKHRoaXMuYWRkZWQsIGZ1bmN0aW9uICh4KSB7cmV0dXJuIHguX2R1bXAoKX0pO1xuICAgIGlmICh0aGlzLnJlbW92ZWQpIGR1bXBlZC5yZW1vdmVkID0gXy5tYXAodGhpcy5yZW1vdmVkLCBmdW5jdGlvbiAoeCkge3JldHVybiB4Ll9kdW1wKCl9KTtcbiAgICBpZiAodGhpcy5vbGQpIGR1bXBlZC5vbGQgPSB0aGlzLm9sZDtcbiAgICBpZiAodGhpcy5uZXcpIGR1bXBlZC5uZXcgPSB0aGlzLm5ldztcbiAgICByZXR1cm4gcHJldHR5ID8gdXRpbC5wcmV0dHlQcmludChkdW1wZWQpIDogZHVtcGVkO1xufTtcblxuLyoqXG4gKiBCcm9hZGNhc1xuICogQHBhcmFtICB7U3RyaW5nfSBjb2xsZWN0aW9uTmFtZVxuICogQHBhcmFtICB7U3RyaW5nfSBtb2RlbE5hbWVcbiAqIEBwYXJhbSAge09iamVjdH0gYyBhbiBvcHRpb25zIGRpY3Rpb25hcnkgcmVwcmVzZW50aW5nIHRoZSBjaGFuZ2VcbiAqIEByZXR1cm4ge1t0eXBlXX1cbiAqL1xuZnVuY3Rpb24gYnJvYWRjYXN0RXZlbnQoY29sbGVjdGlvbk5hbWUsIG1vZGVsTmFtZSwgYykge1xuICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKSBMb2dnZXIudHJhY2UoJ1NlbmRpbmcgbm90aWZpY2F0aW9uIFwiJyArIGNvbGxlY3Rpb25OYW1lICsgJ1wiIG9mIHR5cGUgJyArIGMudHlwZSk7XG4gICAgZXZlbnRzLmVtaXQoY29sbGVjdGlvbk5hbWUsIGMpO1xuICAgIHZhciBtb2RlbE5vdGlmID0gY29sbGVjdGlvbk5hbWUgKyAnOicgKyBtb2RlbE5hbWU7XG4gICAgaWYgKExvZ2dlci50cmFjZS5pc0VuYWJsZWQpIExvZ2dlci50cmFjZSgnU2VuZGluZyBub3RpZmljYXRpb24gXCInICsgbW9kZWxOb3RpZiArICdcIiBvZiB0eXBlICcgKyBjLnR5cGUpO1xuICAgIGV2ZW50cy5lbWl0KG1vZGVsTm90aWYsIGMpO1xuICAgIHZhciBnZW5lcmljTm90aWYgPSAnU2llc3RhJztcbiAgICBpZiAoTG9nZ2VyLnRyYWNlLmlzRW5hYmxlZCkgTG9nZ2VyLnRyYWNlKCdTZW5kaW5nIG5vdGlmaWNhdGlvbiBcIicgKyBnZW5lcmljTm90aWYgKyAnXCIgb2YgdHlwZSAnICsgYy50eXBlKTtcbiAgICBldmVudHMuZW1pdChnZW5lcmljTm90aWYsIGMpO1xuICAgIHZhciBsb2NhbElkTm90aWYgPSBjLl9pZDtcbiAgICBpZiAoTG9nZ2VyLnRyYWNlLmlzRW5hYmxlZCkgTG9nZ2VyLnRyYWNlKCdTZW5kaW5nIG5vdGlmaWNhdGlvbiBcIicgKyBsb2NhbElkTm90aWYgKyAnXCIgb2YgdHlwZSAnICsgYy50eXBlKTtcbiAgICBldmVudHMuZW1pdChsb2NhbElkTm90aWYsIGMpO1xuICAgIHZhciBjb2xsZWN0aW9uID0gY29sbGVjdGlvblJlZ2lzdHJ5W2NvbGxlY3Rpb25OYW1lXTtcbiAgICB2YXIgZXJyO1xuICAgIGlmICghY29sbGVjdGlvbikge1xuICAgICAgICBlcnIgPSAnTm8gc3VjaCBjb2xsZWN0aW9uIFwiJyArIGNvbGxlY3Rpb25OYW1lICsgJ1wiJztcbiAgICAgICAgTG9nZ2VyLmVycm9yKGVyciwgY29sbGVjdGlvblJlZ2lzdHJ5KTtcbiAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoZXJyKTtcbiAgICB9XG4gICAgdmFyIG1vZGVsID0gY29sbGVjdGlvblttb2RlbE5hbWVdO1xuICAgIGlmICghbW9kZWwpIHtcbiAgICAgICAgZXJyID0gJ05vIHN1Y2ggbW9kZWwgXCInICsgbW9kZWxOYW1lICsgJ1wiJztcbiAgICAgICAgTG9nZ2VyLmVycm9yKGVyciwgY29sbGVjdGlvblJlZ2lzdHJ5KTtcbiAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoZXJyKTtcbiAgICB9XG4gICAgaWYgKG1vZGVsLmlkICYmIGMub2JqW21vZGVsLmlkXSkge1xuICAgICAgICB2YXIgcmVtb3RlSWROb3RpZiA9IGNvbGxlY3Rpb25OYW1lICsgJzonICsgbW9kZWxOYW1lICsgJzonICsgYy5vYmpbbW9kZWwuaWRdO1xuICAgICAgICBpZiAoTG9nZ2VyLnRyYWNlLmlzRW5hYmxlZCkgTG9nZ2VyLnRyYWNlKCdTZW5kaW5nIG5vdGlmaWNhdGlvbiBcIicgKyByZW1vdGVJZE5vdGlmICsgJ1wiIG9mIHR5cGUgJyArIGMudHlwZSk7XG4gICAgICAgIGV2ZW50cy5lbWl0KHJlbW90ZUlkTm90aWYsIGMpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gdmFsaWRhdGVFdmVudE9wdHMob3B0cykge1xuICAgIGlmICghb3B0cy5tb2RlbCkgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ011c3QgcGFzcyBhIG1vZGVsJyk7XG4gICAgaWYgKCFvcHRzLmNvbGxlY3Rpb24pIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdNdXN0IHBhc3MgYSBjb2xsZWN0aW9uJyk7XG4gICAgaWYgKCFvcHRzLl9pZCkgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ011c3QgcGFzcyBhIGxvY2FsIGlkZW50aWZpZXInKTtcbiAgICBpZiAoIW9wdHMub2JqKSB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignTXVzdCBwYXNzIHRoZSBvYmplY3QnKTtcbn1cblxuZnVuY3Rpb24gZW1pdChvcHRzKSB7XG4gICAgdmFsaWRhdGVFdmVudE9wdHMob3B0cyk7XG4gICAgdmFyIGNvbGxlY3Rpb24gPSBvcHRzLmNvbGxlY3Rpb247XG4gICAgdmFyIG1vZGVsID0gb3B0cy5tb2RlbDtcbiAgICB2YXIgYyA9IG5ldyBNb2RlbEV2ZW50KG9wdHMpO1xuICAgIGJyb2FkY2FzdEV2ZW50KGNvbGxlY3Rpb24sIG1vZGVsLCBjKTtcbiAgICByZXR1cm4gYztcbn1cblxuZXh0ZW5kKGV4cG9ydHMsIHtcbiAgICBNb2RlbEV2ZW50OiBNb2RlbEV2ZW50LFxuICAgIGVtaXQ6IGVtaXQsXG4gICAgdmFsaWRhdGVFdmVudE9wdHM6IHZhbGlkYXRlRXZlbnRPcHRzLFxuICAgIE1vZGVsRXZlbnRUeXBlOiBNb2RlbEV2ZW50VHlwZVxufSk7IiwidmFyIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKSxcbiAgICBTaWVzdGFVc2VyRXJyb3IgPSByZXF1aXJlKCcuL2Vycm9yJykuU2llc3RhVXNlckVycm9yLFxuICAgIE1vZGVsSW5zdGFuY2UgPSByZXF1aXJlKCcuL01vZGVsSW5zdGFuY2UnKSxcbiAgICBfID0gcmVxdWlyZSgnLi91dGlsJykuXztcblxuLypcbiBUT0RPOiBVc2UgRVM2IFByb3h5IGluc3RlYWQuXG4gRXZlbnR1YWxseSBxdWVyeSBzZXRzIHNob3VsZCB1c2UgRVM2IFByb3hpZXMgd2hpY2ggd2lsbCBiZSBtdWNoIG1vcmUgbmF0dXJhbCBhbmQgcm9idXN0LiBFLmcuIG5vIG5lZWQgZm9yIHRoZSBiZWxvd1xuICovXG52YXIgQVJSQVlfTUVUSE9EUyA9IFsncHVzaCcsICdzb3J0JywgJ3JldmVyc2UnLCAnc3BsaWNlJywgJ3NoaWZ0JywgJ3Vuc2hpZnQnXSxcbiAgICBOVU1CRVJfTUVUSE9EUyA9IFsndG9TdHJpbmcnLCAndG9FeHBvbmVudGlhbCcsICd0b0ZpeGVkJywgJ3RvUHJlY2lzaW9uJywgJ3ZhbHVlT2YnXSxcbiAgICBOVU1CRVJfUFJPUEVSVElFUyA9IFsnTUFYX1ZBTFVFJywgJ01JTl9WQUxVRScsICdORUdBVElWRV9JTkZJTklUWScsICdOYU4nLCAnUE9TSVRJVkVfSU5GSU5JVFknXSxcbiAgICBTVFJJTkdfTUVUSE9EUyA9IFsnY2hhckF0JywgJ2NoYXJDb2RlQXQnLCAnY29uY2F0JywgJ2Zyb21DaGFyQ29kZScsICdpbmRleE9mJywgJ2xhc3RJbmRleE9mJywgJ2xvY2FsZUNvbXBhcmUnLFxuICAgICAgICAnbWF0Y2gnLCAncmVwbGFjZScsICdzZWFyY2gnLCAnc2xpY2UnLCAnc3BsaXQnLCAnc3Vic3RyJywgJ3N1YnN0cmluZycsICd0b0xvY2FsZUxvd2VyQ2FzZScsICd0b0xvY2FsZVVwcGVyQ2FzZScsXG4gICAgICAgICd0b0xvd2VyQ2FzZScsICd0b1N0cmluZycsICd0b1VwcGVyQ2FzZScsICd0cmltJywgJ3ZhbHVlT2YnXSxcbiAgICBTVFJJTkdfUFJPUEVSVElFUyA9IFsnbGVuZ3RoJ107XG5cbi8qKlxuICogUmV0dXJuIHRoZSBwcm9wZXJ0eSBuYW1lcyBmb3IgYSBnaXZlbiBvYmplY3QuIEhhbmRsZXMgc3BlY2lhbCBjYXNlcyBzdWNoIGFzIHN0cmluZ3MgYW5kIG51bWJlcnMgdGhhdCBkbyBub3QgaGF2ZVxuICogdGhlIGdldE93blByb3BlcnR5TmFtZXMgZnVuY3Rpb24uXG4gKiBUaGUgc3BlY2lhbCBjYXNlcyBhcmUgdmVyeSBtdWNoIGhhY2tzLiBUaGlzIGhhY2sgY2FuIGJlIHJlbW92ZWQgb25jZSB0aGUgUHJveHkgb2JqZWN0IGlzIG1vcmUgd2lkZWx5IGFkb3B0ZWQuXG4gKiBAcGFyYW0gb2JqZWN0XG4gKiBAcmV0dXJucyB7QXJyYXl9XG4gKi9cbmZ1bmN0aW9uIGdldFByb3BlcnR5TmFtZXMob2JqZWN0KSB7XG4gICAgdmFyIHByb3BlcnR5TmFtZXM7XG4gICAgaWYgKHR5cGVvZiBvYmplY3QgPT0gJ3N0cmluZycgfHwgb2JqZWN0IGluc3RhbmNlb2YgU3RyaW5nKSB7XG4gICAgICAgIHByb3BlcnR5TmFtZXMgPSBTVFJJTkdfTUVUSE9EUy5jb25jYXQoU1RSSU5HX1BST1BFUlRJRVMpO1xuICAgIH1cbiAgICBlbHNlIGlmICh0eXBlb2Ygb2JqZWN0ID09ICdudW1iZXInIHx8IG9iamVjdCBpbnN0YW5jZW9mIE51bWJlcikge1xuICAgICAgICBwcm9wZXJ0eU5hbWVzID0gTlVNQkVSX01FVEhPRFMuY29uY2F0KE5VTUJFUl9QUk9QRVJUSUVTKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIHByb3BlcnR5TmFtZXMgPSBvYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcygpO1xuICAgIH1cbiAgICByZXR1cm4gcHJvcGVydHlOYW1lcztcbn1cblxuLyoqXG4gKiBEZWZpbmUgYSBwcm94eSBwcm9wZXJ0eSB0byBhdHRyaWJ1dGVzIG9uIG9iamVjdHMgaW4gdGhlIGFycmF5XG4gKiBAcGFyYW0gYXJyXG4gKiBAcGFyYW0gcHJvcFxuICovXG5mdW5jdGlvbiBkZWZpbmVBdHRyaWJ1dGUoYXJyLCBwcm9wKSB7XG4gICAgaWYgKCEocHJvcCBpbiBhcnIpKSB7IC8vIGUuZy4gd2UgY2Fubm90IHJlZGVmaW5lIC5sZW5ndGhcbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KGFyciwgcHJvcCwge1xuICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHF1ZXJ5U2V0KF8ucGx1Y2soYXJyLCBwcm9wKSk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgc2V0OiBmdW5jdGlvbiAodikge1xuICAgICAgICAgICAgICAgIGlmICh1dGlsLmlzQXJyYXkodikpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMubGVuZ3RoICE9IHYubGVuZ3RoKSB0aHJvdyBuZXcgU2llc3RhVXNlckVycm9yKHttZXNzYWdlOiAnTXVzdCBiZSBzYW1lIGxlbmd0aCd9KTtcbiAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB2Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzW2ldW3Byb3BdID0gdltpXTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgZm9yIChpID0gMDsgaSA8IHRoaXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXNbaV1bcHJvcF0gPSB2O1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGlzUHJvbWlzZShvYmopIHtcbiAgICAvLyBUT0RPOiBEb24ndCB0aGluayB0aGlzIGlzIHZlcnkgcm9idXN0LlxuICAgIHJldHVybiBvYmoudGhlbiAmJiBvYmouY2F0Y2g7XG59XG5cbi8qKlxuICogRGVmaW5lIGEgcHJveHkgbWV0aG9kIG9uIHRoZSBhcnJheSBpZiBub3QgYWxyZWFkeSBpbiBleGlzdGVuY2UuXG4gKiBAcGFyYW0gYXJyXG4gKiBAcGFyYW0gcHJvcFxuICovXG5mdW5jdGlvbiBkZWZpbmVNZXRob2QoYXJyLCBwcm9wKSB7XG4gICAgaWYgKCEocHJvcCBpbiBhcnIpKSB7IC8vIGUuZy4gd2UgZG9uJ3Qgd2FudCB0byByZWRlZmluZSB0b1N0cmluZ1xuICAgICAgICBhcnJbcHJvcF0gPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB2YXIgYXJncyA9IGFyZ3VtZW50cyxcbiAgICAgICAgICAgICAgICByZXMgPSB0aGlzLm1hcChmdW5jdGlvbiAocCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gcFtwcm9wXS5hcHBseShwLCBhcmdzKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHZhciBhcmVQcm9taXNlcyA9IGZhbHNlO1xuICAgICAgICAgICAgaWYgKHJlcy5sZW5ndGgpIGFyZVByb21pc2VzID0gaXNQcm9taXNlKHJlc1swXSk7XG4gICAgICAgICAgICByZXR1cm4gYXJlUHJvbWlzZXMgPyBzaWVzdGEucS5hbGwocmVzKSA6IHF1ZXJ5U2V0KHJlcyk7XG4gICAgICAgIH07XG4gICAgfVxufVxuXG4vKipcbiAqIFRyYW5zZm9ybSB0aGUgYXJyYXkgaW50byBhIHF1ZXJ5IHNldC5cbiAqIFJlbmRlcnMgdGhlIGFycmF5IGltbXV0YWJsZS5cbiAqIEBwYXJhbSBhcnJcbiAqIEBwYXJhbSBtb2RlbCAtIFRoZSBtb2RlbCB3aXRoIHdoaWNoIHRvIHByb3h5IHRvXG4gKi9cbmZ1bmN0aW9uIG1vZGVsUXVlcnlTZXQoYXJyLCBtb2RlbCkge1xuICAgIGFyciA9IF8uZXh0ZW5kKFtdLCBhcnIpO1xuICAgIHZhciBhdHRyaWJ1dGVOYW1lcyA9IG1vZGVsLl9hdHRyaWJ1dGVOYW1lcyxcbiAgICAgICAgcmVsYXRpb25zaGlwTmFtZXMgPSBtb2RlbC5fcmVsYXRpb25zaGlwTmFtZXMsXG4gICAgICAgIG5hbWVzID0gYXR0cmlidXRlTmFtZXMuY29uY2F0KHJlbGF0aW9uc2hpcE5hbWVzKS5jb25jYXQoaW5zdGFuY2VNZXRob2RzKTtcbiAgICBuYW1lcy5mb3JFYWNoKF8ucGFydGlhbChkZWZpbmVBdHRyaWJ1dGUsIGFycikpO1xuICAgIHZhciBpbnN0YW5jZU1ldGhvZHMgPSBPYmplY3Qua2V5cyhNb2RlbEluc3RhbmNlLnByb3RvdHlwZSk7XG4gICAgaW5zdGFuY2VNZXRob2RzLmZvckVhY2goXy5wYXJ0aWFsKGRlZmluZU1ldGhvZCwgYXJyKSk7XG4gICAgcmV0dXJuIHJlbmRlckltbXV0YWJsZShhcnIpO1xufVxuXG4vKipcbiAqIFRyYW5zZm9ybSB0aGUgYXJyYXkgaW50byBhIHF1ZXJ5IHNldCwgYmFzZWQgb24gd2hhdGV2ZXIgaXMgaW4gaXQuXG4gKiBOb3RlIHRoYXQgYWxsIG9iamVjdHMgbXVzdCBiZSBvZiB0aGUgc2FtZSB0eXBlLiBUaGlzIGZ1bmN0aW9uIHdpbGwgdGFrZSB0aGUgZmlyc3Qgb2JqZWN0IGFuZCBkZWNpZGUgaG93IHRvIHByb3h5XG4gKiBiYXNlZCBvbiB0aGF0LlxuICogQHBhcmFtIGFyclxuICovXG5mdW5jdGlvbiBxdWVyeVNldChhcnIpIHtcbiAgICBpZiAoYXJyLmxlbmd0aCkge1xuICAgICAgICB2YXIgcmVmZXJlbmNlT2JqZWN0ID0gYXJyWzBdLFxuICAgICAgICAgICAgcHJvcGVydHlOYW1lcyA9IGdldFByb3BlcnR5TmFtZXMocmVmZXJlbmNlT2JqZWN0KTtcbiAgICAgICAgcHJvcGVydHlOYW1lcy5mb3JFYWNoKGZ1bmN0aW9uIChwcm9wKSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIHJlZmVyZW5jZU9iamVjdFtwcm9wXSA9PSAnZnVuY3Rpb24nKSBkZWZpbmVNZXRob2QoYXJyLCBwcm9wLCBhcmd1bWVudHMpO1xuICAgICAgICAgICAgZWxzZSBkZWZpbmVBdHRyaWJ1dGUoYXJyLCBwcm9wKTtcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIHJldHVybiByZW5kZXJJbW11dGFibGUoYXJyKTtcbn1cblxuZnVuY3Rpb24gdGhyb3dJbW11dGFibGVFcnJvcigpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0Nhbm5vdCBtb2RpZnkgYSBxdWVyeSBzZXQnKTtcbn1cblxuLyoqXG4gKiBSZW5kZXIgYW4gYXJyYXkgaW1tdXRhYmxlIGJ5IHJlcGxhY2luZyBhbnkgZnVuY3Rpb25zIHRoYXQgY2FuIG11dGF0ZSBpdC5cbiAqIEBwYXJhbSBhcnJcbiAqL1xuZnVuY3Rpb24gcmVuZGVySW1tdXRhYmxlKGFycikge1xuICAgIEFSUkFZX01FVEhPRFMuZm9yRWFjaChmdW5jdGlvbiAocCkge1xuICAgICAgICBhcnJbcF0gPSB0aHJvd0ltbXV0YWJsZUVycm9yO1xuICAgIH0pO1xuICAgIGFyci5pbW11dGFibGUgPSB0cnVlO1xuICAgIGFyci5tdXRhYmxlQ29weSA9IGFyci5hc0FycmF5ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgbXV0YWJsZUFyciA9IF8ubWFwKHRoaXMsIGZ1bmN0aW9uICh4KSB7cmV0dXJuIHh9KTtcbiAgICAgICAgbXV0YWJsZUFyci5hc1F1ZXJ5U2V0ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIHF1ZXJ5U2V0KHRoaXMpO1xuICAgICAgICB9O1xuICAgICAgICBtdXRhYmxlQXJyLmFzTW9kZWxRdWVyeVNldCA9IGZ1bmN0aW9uIChtb2RlbCkge1xuICAgICAgICAgICAgcmV0dXJuIG1vZGVsUXVlcnlTZXQodGhpcywgbW9kZWwpO1xuICAgICAgICB9O1xuICAgICAgICByZXR1cm4gbXV0YWJsZUFycjtcbiAgICB9O1xuICAgIHJldHVybiBhcnI7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gbW9kZWxRdWVyeVNldDsiLCIvKipcbiAqIEZvciB0aG9zZSBmYW1pbGlhciB3aXRoIEFwcGxlJ3MgQ29jb2EgbGlicmFyeSwgcmVhY3RpdmUgcXVlcmllcyByb3VnaGx5IG1hcCBvbnRvIE5TRmV0Y2hlZFJlc3VsdHNDb250cm9sbGVyLlxuICpcbiAqIFRoZXkgcHJlc2VudCBhIHF1ZXJ5IHNldCB0aGF0ICdyZWFjdHMnIHRvIGNoYW5nZXMgaW4gdGhlIHVuZGVybHlpbmcgZGF0YS5cbiAqIEBtb2R1bGUgcmVhY3RpdmVRdWVyeVxuICovXG5cbnZhciBsb2cgPSByZXF1aXJlKCcuL2xvZycpLFxuICAgIFF1ZXJ5ID0gcmVxdWlyZSgnLi9xdWVyeScpLFxuICAgIEV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJ2V2ZW50cycpLkV2ZW50RW1pdHRlcixcbiAgICBldmVudHMgPSByZXF1aXJlKCcuL2V2ZW50cycpLFxuICAgIG1vZGVsRXZlbnRzID0gcmVxdWlyZSgnLi9tb2RlbEV2ZW50cycpLFxuICAgIEludGVybmFsU2llc3RhRXJyb3IgPSByZXF1aXJlKCcuL2Vycm9yJykuSW50ZXJuYWxTaWVzdGFFcnJvcixcbiAgICBjb25zdHJ1Y3RRdWVyeVNldCA9IHJlcXVpcmUoJy4vcXVlcnlTZXQnKSxcbiAgICB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyksXG4gICAgXyA9IHV0aWwuXztcblxudmFyIExvZ2dlciA9IGxvZy5sb2dnZXJXaXRoTmFtZSgnUXVlcnknKTtcblxuLyoqXG4gKlxuICogQHBhcmFtIHtRdWVyeX0gcXVlcnkgLSBUaGUgdW5kZXJseWluZyBxdWVyeVxuICogQGNvbnN0cnVjdG9yXG4gKi9cbmZ1bmN0aW9uIFJlYWN0aXZlUXVlcnkocXVlcnkpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgRXZlbnRFbWl0dGVyLmNhbGwodGhpcyk7XG5cbiAgICBfLmV4dGVuZCh0aGlzLCB7XG4gICAgICAgIF9xdWVyeTogcXVlcnksXG4gICAgICAgIHJlc3VsdHM6IGNvbnN0cnVjdFF1ZXJ5U2V0KFtdLCBxdWVyeS5tb2RlbCksXG4gICAgICAgIGluc2VydGlvblBvbGljeTogUmVhY3RpdmVRdWVyeS5JbnNlcnRpb25Qb2xpY3kuQmFjayxcbiAgICAgICAgaW5pdGlhbGlzZWQ6IGZhbHNlXG4gICAgfSk7XG5cbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydGllcyh0aGlzLCB7XG4gICAgICAgIGluaXRpYWxpemVkOiB7Z2V0OiBmdW5jdGlvbiAoKSB7cmV0dXJuIHRoaXMuaW5pdGlhbGlzZWR9fSxcbiAgICAgICAgbW9kZWw6IHtnZXQ6IGZ1bmN0aW9uICgpIHsgcmV0dXJuIHNlbGYuX3F1ZXJ5Lm1vZGVsIH19LFxuICAgICAgICBjb2xsZWN0aW9uOiB7Z2V0OiBmdW5jdGlvbiAoKSB7IHJldHVybiBzZWxmLm1vZGVsLmNvbGxlY3Rpb25OYW1lIH19XG4gICAgfSk7XG59XG5cblJlYWN0aXZlUXVlcnkucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShFdmVudEVtaXR0ZXIucHJvdG90eXBlKTtcblxuXy5leHRlbmQoUmVhY3RpdmVRdWVyeSwge1xuICAgIEluc2VydGlvblBvbGljeToge1xuICAgICAgICBGcm9udDogJ0Zyb250JyxcbiAgICAgICAgQmFjazogJ0JhY2snXG4gICAgfVxufSk7XG5cbl8uZXh0ZW5kKFJlYWN0aXZlUXVlcnkucHJvdG90eXBlLCB7XG4gICAgaW5pdDogZnVuY3Rpb24gKGNiKSB7XG4gICAgICAgIGlmIChMb2dnZXIudHJhY2UpIExvZ2dlci50cmFjZSgnaW5pdCcpO1xuICAgICAgICB2YXIgZGVmZXJyZWQgPSB1dGlsLmRlZmVyKGNiKTtcbiAgICAgICAgY2IgPSBkZWZlcnJlZC5maW5pc2guYmluZChkZWZlcnJlZCk7XG4gICAgICAgIGlmICghdGhpcy5pbml0aWFsaXNlZCkge1xuICAgICAgICAgICAgdGhpcy5fcXVlcnkuZXhlY3V0ZShmdW5jdGlvbiAoZXJyLCByZXN1bHRzKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5yZXN1bHRzID0gcmVzdWx0cztcbiAgICAgICAgICAgICAgICAgICAgaWYgKCF0aGlzLmhhbmRsZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBuYW1lID0gdGhpcy5fY29uc3RydWN0Tm90aWZpY2F0aW9uTmFtZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGhhbmRsZXIgPSBmdW5jdGlvbiAobikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2hhbmRsZU5vdGlmKG4pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfS5iaW5kKHRoaXMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5oYW5kbGVyID0gaGFuZGxlcjtcbiAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50cy5vbihuYW1lLCBoYW5kbGVyKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAoTG9nZ2VyLnRyYWNlKSBMb2dnZXIudHJhY2UoJ0xpc3RlbmluZyB0byAnICsgbmFtZSk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuaW5pdGlhbGlzZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICBjYihudWxsLCB0aGlzLnJlc3VsdHMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgY2IoZXJyKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgY2IobnVsbCwgdGhpcy5yZXN1bHRzKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbiAgICB9LFxuICAgIGluc2VydDogZnVuY3Rpb24gKG5ld09iaikge1xuICAgICAgICB2YXIgcmVzdWx0cyA9IHRoaXMucmVzdWx0cy5tdXRhYmxlQ29weSgpO1xuICAgICAgICBpZiAodGhpcy5pbnNlcnRpb25Qb2xpY3kgPT0gUmVhY3RpdmVRdWVyeS5JbnNlcnRpb25Qb2xpY3kuQmFjaykge1xuICAgICAgICAgICAgdmFyIGlkeCA9IHJlc3VsdHMucHVzaChuZXdPYmopO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgaWR4ID0gcmVzdWx0cy51bnNoaWZ0KG5ld09iaik7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5yZXN1bHRzID0gcmVzdWx0cy5hc01vZGVsUXVlcnlTZXQodGhpcy5tb2RlbCk7XG4gICAgICAgIHJldHVybiBpZHg7XG4gICAgfSxcbiAgICBfaGFuZGxlTm90aWY6IGZ1bmN0aW9uIChuKSB7XG4gICAgICAgIGlmIChMb2dnZXIudHJhY2UpIExvZ2dlci50cmFjZSgnX2hhbmRsZU5vdGlmJywgbik7XG4gICAgICAgIGlmIChuLnR5cGUgPT0gbW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUuTmV3KSB7XG4gICAgICAgICAgICB2YXIgbmV3T2JqID0gbi5uZXc7XG4gICAgICAgICAgICBpZiAodGhpcy5fcXVlcnkub2JqZWN0TWF0Y2hlc1F1ZXJ5KG5ld09iaikpIHtcbiAgICAgICAgICAgICAgICBpZiAoTG9nZ2VyLnRyYWNlKSBMb2dnZXIudHJhY2UoJ05ldyBvYmplY3QgbWF0Y2hlcycsIG5ld09iai5fZHVtcFN0cmluZygpKTtcbiAgICAgICAgICAgICAgICB2YXIgaWR4ID0gdGhpcy5pbnNlcnQobmV3T2JqKTtcbiAgICAgICAgICAgICAgICB0aGlzLmVtaXQoJ2NoYW5nZScsIHtcbiAgICAgICAgICAgICAgICAgICAgaW5kZXg6IGlkeCxcbiAgICAgICAgICAgICAgICAgICAgYWRkZWQ6IFtuZXdPYmpdLFxuICAgICAgICAgICAgICAgICAgICB0eXBlOiBtb2RlbEV2ZW50cy5Nb2RlbEV2ZW50VHlwZS5TcGxpY2UsXG4gICAgICAgICAgICAgICAgICAgIG9iajogdGhpc1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgaWYgKExvZ2dlci50cmFjZSkgTG9nZ2VyLnRyYWNlKCdOZXcgb2JqZWN0IGRvZXMgbm90IG1hdGNoJywgbmV3T2JqLl9kdW1wU3RyaW5nKCkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKG4udHlwZSA9PSBtb2RlbEV2ZW50cy5Nb2RlbEV2ZW50VHlwZS5TZXQpIHtcbiAgICAgICAgICAgIG5ld09iaiA9IG4ub2JqO1xuICAgICAgICAgICAgdmFyIGluZGV4ID0gdGhpcy5yZXN1bHRzLmluZGV4T2YobmV3T2JqKSxcbiAgICAgICAgICAgICAgICBhbHJlYWR5Q29udGFpbnMgPSBpbmRleCA+IC0xLFxuICAgICAgICAgICAgICAgIG1hdGNoZXMgPSB0aGlzLl9xdWVyeS5vYmplY3RNYXRjaGVzUXVlcnkobmV3T2JqKTtcbiAgICAgICAgICAgIGlmIChtYXRjaGVzICYmICFhbHJlYWR5Q29udGFpbnMpIHtcbiAgICAgICAgICAgICAgICBpZiAoTG9nZ2VyLnRyYWNlKSBMb2dnZXIudHJhY2UoJ1VwZGF0ZWQgb2JqZWN0IG5vdyBtYXRjaGVzIScsIG5ld09iai5fZHVtcFN0cmluZygpKTtcbiAgICAgICAgICAgICAgICBpZHggPSB0aGlzLmluc2VydChuZXdPYmopO1xuICAgICAgICAgICAgICAgIHRoaXMuZW1pdCgnY2hhbmdlJywge1xuICAgICAgICAgICAgICAgICAgICBpbmRleDogaWR4LFxuICAgICAgICAgICAgICAgICAgICBhZGRlZDogW25ld09ial0sXG4gICAgICAgICAgICAgICAgICAgIHR5cGU6IG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlLlNwbGljZSxcbiAgICAgICAgICAgICAgICAgICAgb2JqOiB0aGlzXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmICghbWF0Y2hlcyAmJiBhbHJlYWR5Q29udGFpbnMpIHtcbiAgICAgICAgICAgICAgICBpZiAoTG9nZ2VyLnRyYWNlKSBMb2dnZXIudHJhY2UoJ1VwZGF0ZWQgb2JqZWN0IG5vIGxvbmdlciBtYXRjaGVzIScsIG5ld09iai5fZHVtcFN0cmluZygpKTtcbiAgICAgICAgICAgICAgICByZXN1bHRzID0gdGhpcy5yZXN1bHRzLm11dGFibGVDb3B5KCk7XG4gICAgICAgICAgICAgICAgdmFyIHJlbW92ZWQgPSByZXN1bHRzLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgICAgICAgICAgdGhpcy5yZXN1bHRzID0gcmVzdWx0cy5hc01vZGVsUXVlcnlTZXQodGhpcy5tb2RlbCk7XG4gICAgICAgICAgICAgICAgdGhpcy5lbWl0KCdjaGFuZ2UnLCB7XG4gICAgICAgICAgICAgICAgICAgIGluZGV4OiBpbmRleCxcbiAgICAgICAgICAgICAgICAgICAgb2JqOiB0aGlzLFxuICAgICAgICAgICAgICAgICAgICBuZXc6IG5ld09iaixcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogbW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUuU3BsaWNlLFxuICAgICAgICAgICAgICAgICAgICByZW1vdmVkOiByZW1vdmVkXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmICghbWF0Y2hlcyAmJiAhYWxyZWFkeUNvbnRhaW5zKSB7XG4gICAgICAgICAgICAgICAgaWYgKExvZ2dlci50cmFjZSkgTG9nZ2VyLnRyYWNlKCdEb2VzIG5vdCBjb250YWluLCBidXQgZG9lc250IG1hdGNoIHNvIG5vdCBpbnNlcnRpbmcnLCBuZXdPYmouX2R1bXBTdHJpbmcoKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChtYXRjaGVzICYmIGFscmVhZHlDb250YWlucykge1xuICAgICAgICAgICAgICAgIGlmIChMb2dnZXIudHJhY2UpIExvZ2dlci50cmFjZSgnTWF0Y2hlcyBidXQgYWxyZWFkeSBjb250YWlucycsIG5ld09iai5fZHVtcFN0cmluZygpKTtcbiAgICAgICAgICAgICAgICAvLyBTZW5kIHRoZSBub3RpZmljYXRpb24gb3Zlci4gXG4gICAgICAgICAgICAgICAgdGhpcy5lbWl0KCdjaGFuZ2UnLCBuKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChuLnR5cGUgPT0gbW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUuUmVtb3ZlKSB7XG4gICAgICAgICAgICBuZXdPYmogPSBuLm9iajtcbiAgICAgICAgICAgIHZhciByZXN1bHRzID0gdGhpcy5yZXN1bHRzLm11dGFibGVDb3B5KCk7XG4gICAgICAgICAgICBpbmRleCA9IHJlc3VsdHMuaW5kZXhPZihuZXdPYmopO1xuICAgICAgICAgICAgaWYgKGluZGV4ID4gLTEpIHtcbiAgICAgICAgICAgICAgICBpZiAoTG9nZ2VyLnRyYWNlKSBMb2dnZXIudHJhY2UoJ1JlbW92aW5nIG9iamVjdCcsIG5ld09iai5fZHVtcFN0cmluZygpKTtcbiAgICAgICAgICAgICAgICByZW1vdmVkID0gcmVzdWx0cy5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICAgICAgICAgIHRoaXMucmVzdWx0cyA9IGNvbnN0cnVjdFF1ZXJ5U2V0KHJlc3VsdHMsIHRoaXMubW9kZWwpO1xuICAgICAgICAgICAgICAgIHRoaXMuZW1pdCgnY2hhbmdlJywge1xuICAgICAgICAgICAgICAgICAgICBpbmRleDogaW5kZXgsXG4gICAgICAgICAgICAgICAgICAgIG9iajogdGhpcyxcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogbW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUuU3BsaWNlLFxuICAgICAgICAgICAgICAgICAgICByZW1vdmVkOiByZW1vdmVkXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZiAoTG9nZ2VyLnRyYWNlKSBMb2dnZXIudHJhY2UoJ05vIG1vZGVsRXZlbnRzIG5lY2Nlc3NhcnkuJywgbmV3T2JqLl9kdW1wU3RyaW5nKCkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ1Vua25vd24gY2hhbmdlIHR5cGUgXCInICsgbi50eXBlLnRvU3RyaW5nKCkgKyAnXCInKVxuICAgICAgICB9XG4gICAgICAgIHRoaXMucmVzdWx0cyA9IGNvbnN0cnVjdFF1ZXJ5U2V0KHRoaXMuX3F1ZXJ5Ll9zb3J0UmVzdWx0cyh0aGlzLnJlc3VsdHMpLCB0aGlzLm1vZGVsKTtcbiAgICB9LFxuICAgIF9jb25zdHJ1Y3ROb3RpZmljYXRpb25OYW1lOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLm1vZGVsLmNvbGxlY3Rpb25OYW1lICsgJzonICsgdGhpcy5tb2RlbC5uYW1lO1xuICAgIH0sXG4gICAgdGVybWluYXRlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmICh0aGlzLmhhbmRsZXIpIHtcbiAgICAgICAgICAgIGV2ZW50cy5yZW1vdmVMaXN0ZW5lcih0aGlzLl9jb25zdHJ1Y3ROb3RpZmljYXRpb25OYW1lKCksIHRoaXMuaGFuZGxlcik7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5yZXN1bHRzID0gbnVsbDtcbiAgICAgICAgdGhpcy5oYW5kbGVyID0gbnVsbDtcbiAgICB9LFxuICAgIGxpc3RlbjogZnVuY3Rpb24gKGZuKSB7XG4gICAgICAgIHRoaXMub24oJ2NoYW5nZScsIGZuKTtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIoJ2NoYW5nZScsIGZuKTtcbiAgICAgICAgfS5iaW5kKHRoaXMpO1xuICAgIH0sXG4gICAgbGlzdGVuT25jZTogZnVuY3Rpb24gKGZuKSB7XG4gICAgICAgIHRoaXMub25jZSgnY2hhbmdlJywgZm4pO1xuICAgIH1cbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFJlYWN0aXZlUXVlcnk7IiwiLyoqXG4gKiBUaGUgXCJzdG9yZVwiIGlzIHJlc3BvbnNpYmxlIGZvciBtZWRpYXRpbmcgYmV0d2VlbiB0aGUgaW4tbWVtb3J5IGNhY2hlIGFuZCBhbnkgcGVyc2lzdGVudCBzdG9yYWdlLlxuICogTm90ZSB0aGF0IHBlcnNpc3RlbnQgc3RvcmFnZSBoYXMgbm90IGJlZW4gcHJvcGVybHkgaW1wbGVtZW50ZWQgeWV0IGFuZCBzbyB0aGlzIGlzIHByZXR0eSB1c2VsZXNzLlxuICogQWxsIHF1ZXJpZXMgd2lsbCBnbyBzdHJhaWdodCB0byB0aGUgY2FjaGUgaW5zdGVhZC5cbiAqIEBtb2R1bGUgc3RvcmVcbiAqL1xuXG52YXIgSW50ZXJuYWxTaWVzdGFFcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKS5JbnRlcm5hbFNpZXN0YUVycm9yLFxuICAgIGxvZyA9IHJlcXVpcmUoJy4vbG9nJyksXG4gICAgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpLFxuICAgIF8gPSB1dGlsLl8sXG4gICAgY2FjaGUgPSByZXF1aXJlKCcuL2NhY2hlJyk7XG5cblxudmFyIExvZ2dlciA9IGxvZy5sb2dnZXJXaXRoTmFtZSgnU3RvcmUnKTtcblxuLyoqXG4gKiBbZ2V0IGRlc2NyaXB0aW9uXVxuICogQHBhcmFtICB7T2JqZWN0fSAgIG9wdHNcbiAqIEBwYXJhbSAge0Z1bmN0aW9ufSBjYWxsYmFja1xuICogQHJldHVybiB7UHJvbWlzZX1cbiAqIEBleGFtcGxlXG4gKiBgYGBqc1xuICogdmFyIHh5eiA9ICdhZnNkZic7XG4gKiBgYGBcbiAqIEBleGFtcGxlXG4gKiBgYGBqc1xuICogdmFyIGFiYyA9ICdhc2RzZCc7XG4gKiBgYGBcbiAqL1xuZnVuY3Rpb24gZ2V0KG9wdHMsIGNhbGxiYWNrKSB7XG4gICAgdmFyIGRlZmVycmVkID0gdXRpbC5kZWZlcihjYWxsYmFjayk7XG4gICAgY2FsbGJhY2sgPSBkZWZlcnJlZC5maW5pc2guYmluZChkZWZlcnJlZCk7XG4gICAgaWYgKExvZ2dlci5kZWJ1Zy5pc0VuYWJsZWQpXG4gICAgICAgIExvZ2dlci5kZWJ1ZygnZ2V0Jywgb3B0cyk7XG4gICAgdmFyIHNpZXN0YU1vZGVsO1xuICAgIGlmIChvcHRzLl9pZCkge1xuICAgICAgICBpZiAodXRpbC5pc0FycmF5KG9wdHMuX2lkKSkge1xuICAgICAgICAgICAgLy8gUHJveHkgb250byBnZXRNdWx0aXBsZSBpbnN0ZWFkLlxuICAgICAgICAgICAgZ2V0TXVsdGlwbGUoXy5tYXAob3B0cy5faWQsIGZ1bmN0aW9uIChpZCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgIF9pZDogaWRcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KSwgY2FsbGJhY2spO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc2llc3RhTW9kZWwgPSBjYWNoZS5nZXQob3B0cyk7XG4gICAgICAgICAgICBpZiAoc2llc3RhTW9kZWwpIHtcbiAgICAgICAgICAgICAgICBpZiAoTG9nZ2VyLmRlYnVnLmlzRW5hYmxlZClcbiAgICAgICAgICAgICAgICAgICAgTG9nZ2VyLmRlYnVnKCdIYWQgY2FjaGVkIG9iamVjdCcsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG9wdHM6IG9wdHMsXG4gICAgICAgICAgICAgICAgICAgICAgICBvYmo6IHNpZXN0YU1vZGVsXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2sobnVsbCwgc2llc3RhTW9kZWwpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZiAodXRpbC5pc0FycmF5KG9wdHMuX2lkKSkge1xuICAgICAgICAgICAgICAgICAgICAvLyBQcm94eSBvbnRvIGdldE11bHRpcGxlIGluc3RlYWQuXG4gICAgICAgICAgICAgICAgICAgIGdldE11bHRpcGxlKF8ubWFwKG9wdHMuX2lkLCBmdW5jdGlvbiAoaWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgX2lkOiBpZFxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9KSwgY2FsbGJhY2spO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHN0b3JhZ2UgPSBzaWVzdGEuZXh0LnN0b3JhZ2U7XG4gICAgICAgICAgICAgICAgICAgIGlmIChzdG9yYWdlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzdG9yYWdlLnN0b3JlLmdldEZyb21Qb3VjaChvcHRzLCBjYWxsYmFjayk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1N0b3JhZ2UgbW9kdWxlIG5vdCBpbnN0YWxsZWQnKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0gZWxzZSBpZiAob3B0cy5tb2RlbCkge1xuICAgICAgICBpZiAodXRpbC5pc0FycmF5KG9wdHNbb3B0cy5tb2RlbC5pZF0pKSB7XG4gICAgICAgICAgICAvLyBQcm94eSBvbnRvIGdldE11bHRpcGxlIGluc3RlYWQuXG4gICAgICAgICAgICBnZXRNdWx0aXBsZShfLm1hcChvcHRzW29wdHMubW9kZWwuaWRdLCBmdW5jdGlvbiAoaWQpIHtcbiAgICAgICAgICAgICAgICB2YXIgbyA9IHt9O1xuICAgICAgICAgICAgICAgIG9bb3B0cy5tb2RlbC5pZF0gPSBpZDtcbiAgICAgICAgICAgICAgICBvLm1vZGVsID0gb3B0cy5tb2RlbDtcbiAgICAgICAgICAgICAgICByZXR1cm4gb1xuICAgICAgICAgICAgfSksIGNhbGxiYWNrKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHNpZXN0YU1vZGVsID0gY2FjaGUuZ2V0KG9wdHMpO1xuICAgICAgICAgICAgaWYgKHNpZXN0YU1vZGVsKSB7XG4gICAgICAgICAgICAgICAgaWYgKExvZ2dlci5kZWJ1Zy5pc0VuYWJsZWQpXG4gICAgICAgICAgICAgICAgICAgIExvZ2dlci5kZWJ1ZygnSGFkIGNhY2hlZCBvYmplY3QnLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICBvcHRzOiBvcHRzLFxuICAgICAgICAgICAgICAgICAgICAgICAgb2JqOiBzaWVzdGFNb2RlbFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKG51bGwsIHNpZXN0YU1vZGVsKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdmFyIG1vZGVsID0gb3B0cy5tb2RlbDtcbiAgICAgICAgICAgICAgICBpZiAobW9kZWwuc2luZ2xldG9uKSB7XG4gICAgICAgICAgICAgICAgICAgIG1vZGVsLm9uZShjYWxsYmFjayk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGlkRmllbGQgPSBtb2RlbC5pZDtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGlkID0gb3B0c1tpZEZpZWxkXTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIG9uZU9wdHMgPSB7fTtcbiAgICAgICAgICAgICAgICAgICAgb25lT3B0c1tpZEZpZWxkXSA9IGlkO1xuICAgICAgICAgICAgICAgICAgICBpZiAoaWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG1vZGVsLm9uZShvbmVPcHRzLCBmdW5jdGlvbiAoZXJyLCBvYmopIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAob2JqKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhudWxsLCBvYmopO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2sobnVsbCwgbnVsbCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ0ludmFsaWQgb3B0aW9ucyBnaXZlbiB0byBzdG9yZS4gTWlzc2luZyBcIicgKyBpZEZpZWxkLnRvU3RyaW5nKCkgKyAnLlwiJyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIE5vIHdheSBpbiB3aGljaCB0byBmaW5kIGFuIG9iamVjdCBsb2NhbGx5LlxuICAgICAgICB2YXIgY29udGV4dCA9IHtcbiAgICAgICAgICAgIG9wdHM6IG9wdHNcbiAgICAgICAgfTtcbiAgICAgICAgdmFyIG1zZyA9ICdJbnZhbGlkIG9wdGlvbnMgZ2l2ZW4gdG8gc3RvcmUnO1xuICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcihtc2csIGNvbnRleHQpO1xuICAgIH1cbiAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbn1cblxuZnVuY3Rpb24gZ2V0TXVsdGlwbGUob3B0c0FycmF5LCBjYWxsYmFjaykge1xuICAgIHZhciBkZWZlcnJlZCA9IHV0aWwuZGVmZXIoY2FsbGJhY2spO1xuICAgIGNhbGxiYWNrID0gZGVmZXJyZWQuZmluaXNoLmJpbmQoZGVmZXJyZWQpO1xuICAgIHZhciBkb2NzID0gW107XG4gICAgdmFyIGVycm9ycyA9IFtdO1xuICAgIF8uZWFjaChvcHRzQXJyYXksIGZ1bmN0aW9uIChvcHRzKSB7XG4gICAgICAgIGdldChvcHRzLCBmdW5jdGlvbiAoZXJyLCBkb2MpIHtcbiAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICBlcnJvcnMucHVzaChlcnIpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBkb2NzLnB1c2goZG9jKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChkb2NzLmxlbmd0aCArIGVycm9ycy5sZW5ndGggPT0gb3B0c0FycmF5Lmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIGlmIChjYWxsYmFjaykge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZXJyb3JzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyb3JzKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIGRvY3MpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9KTtcbiAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbn1cbi8qKlxuICogVXNlcyBwb3VjaCBidWxrIGZldGNoIEFQSS4gTXVjaCBmYXN0ZXIgdGhhbiBnZXRNdWx0aXBsZS5cbiAqIEBwYXJhbSBsb2NhbElkZW50aWZpZXJzXG4gKiBAcGFyYW0gY2FsbGJhY2tcbiAqL1xuZnVuY3Rpb24gZ2V0TXVsdGlwbGVMb2NhbChsb2NhbElkZW50aWZpZXJzLCBjYWxsYmFjaykge1xuICAgIHZhciBkZWZlcnJlZCA9IHV0aWwuZGVmZXIoY2FsbGJhY2spO1xuICAgIGNhbGxiYWNrID0gZGVmZXJyZWQuZmluaXNoLmJpbmQoZGVmZXJyZWQpO1xuICAgIHZhciByZXN1bHRzID0gXy5yZWR1Y2UobG9jYWxJZGVudGlmaWVycywgZnVuY3Rpb24gKG1lbW8sIF9pZCkge1xuICAgICAgICB2YXIgb2JqID0gY2FjaGUuZ2V0KHtcbiAgICAgICAgICAgIF9pZDogX2lkXG4gICAgICAgIH0pO1xuICAgICAgICBpZiAob2JqKSB7XG4gICAgICAgICAgICBtZW1vLmNhY2hlZFtfaWRdID0gb2JqO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbWVtby5ub3RDYWNoZWQucHVzaChfaWQpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBtZW1vO1xuICAgIH0sIHtcbiAgICAgICAgY2FjaGVkOiB7fSxcbiAgICAgICAgbm90Q2FjaGVkOiBbXVxuICAgIH0pO1xuXG4gICAgZnVuY3Rpb24gZmluaXNoKGVycikge1xuICAgICAgICBpZiAoY2FsbGJhY2spIHtcbiAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhudWxsLCBfLm1hcChsb2NhbElkZW50aWZpZXJzLCBmdW5jdGlvbiAoX2lkKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiByZXN1bHRzLmNhY2hlZFtfaWRdO1xuICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuLy8gICAgaWYgKHNpZXN0YS5leHQuc3RvcmFnZUVuYWJsZWQgJiYgcmVzdWx0cy5ub3RDYWNoZWQubGVuZ3RoKSB7XG4vLyAgICAgICAgc2llc3RhLmV4dC5zdG9yYWdlLnN0b3JlLmdldE11bHRpcGxlTG9jYWxGcm9tQ291Y2gocmVzdWx0cywgZmluaXNoKTtcbi8vICAgIH0gZWxzZSB7XG4gICAgZmluaXNoKCk7XG4vLyAgICB9XG4gICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG59XG5cbmZ1bmN0aW9uIGdldE11bHRpcGxlUmVtb3RlKHJlbW90ZUlkZW50aWZpZXJzLCBtb2RlbCwgY2FsbGJhY2spIHtcbiAgICB2YXIgZGVmZXJyZWQgPSB1dGlsLmRlZmVyKGNhbGxiYWNrKTtcbiAgICBjYWxsYmFjayA9IGRlZmVycmVkLmZpbmlzaC5iaW5kKGRlZmVycmVkKTtcbiAgICB2YXIgcmVzdWx0cyA9IF8ucmVkdWNlKHJlbW90ZUlkZW50aWZpZXJzLCBmdW5jdGlvbiAobWVtbywgaWQpIHtcbiAgICAgICAgdmFyIGNhY2hlUXVlcnkgPSB7XG4gICAgICAgICAgICBtb2RlbDogbW9kZWxcbiAgICAgICAgfTtcbiAgICAgICAgY2FjaGVRdWVyeVttb2RlbC5pZF0gPSBpZDtcbiAgICAgICAgdmFyIG9iaiA9IGNhY2hlLmdldChjYWNoZVF1ZXJ5KTtcbiAgICAgICAgaWYgKG9iaikge1xuICAgICAgICAgICAgbWVtby5jYWNoZWRbaWRdID0gb2JqO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbWVtby5ub3RDYWNoZWQucHVzaChpZCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG1lbW87XG4gICAgfSwge1xuICAgICAgICBjYWNoZWQ6IHt9LFxuICAgICAgICBub3RDYWNoZWQ6IFtdXG4gICAgfSk7XG5cbiAgICBmdW5jdGlvbiBmaW5pc2goZXJyKSB7XG4gICAgICAgIGlmIChjYWxsYmFjaykge1xuICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIF8ubWFwKHJlbW90ZUlkZW50aWZpZXJzLCBmdW5jdGlvbiAoaWQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHJlc3VsdHMuY2FjaGVkW2lkXTtcbiAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmaW5pc2goKTtcbiAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gICAgZ2V0OiBnZXQsXG4gICAgZ2V0TXVsdGlwbGU6IGdldE11bHRpcGxlLFxuICAgIGdldE11bHRpcGxlTG9jYWw6IGdldE11bHRpcGxlTG9jYWwsXG4gICAgZ2V0TXVsdGlwbGVSZW1vdGU6IGdldE11bHRpcGxlUmVtb3RlXG59O1xuIiwidmFyIG1pc2MgPSByZXF1aXJlKCcuL21pc2MnKSxcbiAgICBfID0gcmVxdWlyZSgnLi91bmRlcnNjb3JlJyk7XG5cbmZ1bmN0aW9uIGRvUGFyYWxsZWwoZm4pIHtcbiAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cyk7XG4gICAgICAgIHJldHVybiBmbi5hcHBseShudWxsLCBbZWFjaF0uY29uY2F0KGFyZ3MpKTtcbiAgICB9O1xufVxuXG52YXIgbWFwID0gZG9QYXJhbGxlbChfYXN5bmNNYXApO1xuXG52YXIgcm9vdDtcblxuZnVuY3Rpb24gX21hcChhcnIsIGl0ZXJhdG9yKSB7XG4gICAgaWYgKGFyci5tYXApIHtcbiAgICAgICAgcmV0dXJuIGFyci5tYXAoaXRlcmF0b3IpO1xuICAgIH1cbiAgICB2YXIgcmVzdWx0cyA9IFtdO1xuICAgIGVhY2goYXJyLCBmdW5jdGlvbiAoeCwgaSwgYSkge1xuICAgICAgICByZXN1bHRzLnB1c2goaXRlcmF0b3IoeCwgaSwgYSkpO1xuICAgIH0pO1xuICAgIHJldHVybiByZXN1bHRzO1xufVxuXG5mdW5jdGlvbiBfYXN5bmNNYXAoZWFjaGZuLCBhcnIsIGl0ZXJhdG9yLCBjYWxsYmFjaykge1xuICAgIGFyciA9IF9tYXAoYXJyLCBmdW5jdGlvbiAoeCwgaSkge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgaW5kZXg6IGksXG4gICAgICAgICAgICB2YWx1ZTogeFxuICAgICAgICB9O1xuICAgIH0pO1xuICAgIGlmICghY2FsbGJhY2spIHtcbiAgICAgICAgZWFjaGZuKGFyciwgZnVuY3Rpb24gKHgsIGNhbGxiYWNrKSB7XG4gICAgICAgICAgICBpdGVyYXRvcih4LnZhbHVlLCBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgICB2YXIgcmVzdWx0cyA9IFtdO1xuICAgICAgICBlYWNoZm4oYXJyLCBmdW5jdGlvbiAoeCwgY2FsbGJhY2spIHtcbiAgICAgICAgICAgIGl0ZXJhdG9yKHgudmFsdWUsIGZ1bmN0aW9uIChlcnIsIHYpIHtcbiAgICAgICAgICAgICAgICByZXN1bHRzW3guaW5kZXhdID0gdjtcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0sIGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgIGNhbGxiYWNrKGVyciwgcmVzdWx0cyk7XG4gICAgICAgIH0pO1xuICAgIH1cbn1cblxudmFyIG1hcFNlcmllcyA9IGRvU2VyaWVzKF9hc3luY01hcCk7XG5cbmZ1bmN0aW9uIGRvU2VyaWVzKGZuKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuICAgICAgICByZXR1cm4gZm4uYXBwbHkobnVsbCwgW2VhY2hTZXJpZXNdLmNvbmNhdChhcmdzKSk7XG4gICAgfTtcbn1cblxuXG5mdW5jdGlvbiBlYWNoU2VyaWVzKGFyciwgaXRlcmF0b3IsIGNhbGxiYWNrKSB7XG4gICAgY2FsbGJhY2sgPSBjYWxsYmFjayB8fCBmdW5jdGlvbiAoKSB7fTtcbiAgICBpZiAoIWFyci5sZW5ndGgpIHtcbiAgICAgICAgcmV0dXJuIGNhbGxiYWNrKCk7XG4gICAgfVxuICAgIHZhciBjb21wbGV0ZWQgPSAwO1xuICAgIHZhciBpdGVyYXRlID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBpdGVyYXRvcihhcnJbY29tcGxldGVkXSwgZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2sgPSBmdW5jdGlvbiAoKSB7fTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29tcGxldGVkICs9IDE7XG4gICAgICAgICAgICAgICAgaWYgKGNvbXBsZXRlZCA+PSBhcnIubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgaXRlcmF0ZSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfTtcbiAgICBpdGVyYXRlKCk7XG59XG5cblxuZnVuY3Rpb24gX2VhY2goYXJyLCBpdGVyYXRvcikge1xuICAgIGlmIChhcnIuZm9yRWFjaCkge1xuICAgICAgICByZXR1cm4gYXJyLmZvckVhY2goaXRlcmF0b3IpO1xuICAgIH1cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGFyci5sZW5ndGg7IGkgKz0gMSkge1xuICAgICAgICBpdGVyYXRvcihhcnJbaV0sIGksIGFycik7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBlYWNoKGFyciwgaXRlcmF0b3IsIGNhbGxiYWNrKSB7XG4gICAgY2FsbGJhY2sgPSBjYWxsYmFjayB8fCBmdW5jdGlvbiAoKSB7fTtcbiAgICBpZiAoIWFyci5sZW5ndGgpIHtcbiAgICAgICAgcmV0dXJuIGNhbGxiYWNrKCk7XG4gICAgfVxuICAgIHZhciBjb21wbGV0ZWQgPSAwO1xuICAgIF9lYWNoKGFyciwgZnVuY3Rpb24gKHgpIHtcbiAgICAgICAgaXRlcmF0b3IoeCwgb25seV9vbmNlKGRvbmUpKTtcbiAgICB9KTtcblxuICAgIGZ1bmN0aW9uIGRvbmUoZXJyKSB7XG4gICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICBjYWxsYmFjayA9IGZ1bmN0aW9uICgpIHt9O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29tcGxldGVkICs9IDE7XG4gICAgICAgICAgICBpZiAoY29tcGxldGVkID49IGFyci5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufVxuXG5cblxuXG52YXIgX3BhcmFsbGVsID0gZnVuY3Rpb24gKGVhY2hmbiwgdGFza3MsIGNhbGxiYWNrKSB7XG4gICAgY2FsbGJhY2sgPSBjYWxsYmFjayB8fCBmdW5jdGlvbiAoKSB7fTtcbiAgICBpZiAobWlzYy5pc0FycmF5KHRhc2tzKSkge1xuICAgICAgICBlYWNoZm4ubWFwKHRhc2tzLCBmdW5jdGlvbiAoZm4sIGNhbGxiYWNrKSB7XG4gICAgICAgICAgICBpZiAoZm4pIHtcbiAgICAgICAgICAgICAgICBmbihmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGFyZ3MubGVuZ3RoIDw9IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFyZ3MgPSBhcmdzWzBdO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrLmNhbGwobnVsbCwgZXJyLCBhcmdzKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSwgY2FsbGJhY2spO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHZhciByZXN1bHRzID0ge307XG4gICAgICAgIGVhY2hmbi5lYWNoKE9iamVjdC5rZXlzKHRhc2tzKSwgZnVuY3Rpb24gKGssIGNhbGxiYWNrKSB7XG4gICAgICAgICAgICB0YXNrc1trXShmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgICAgICAgICAgICAgIGlmIChhcmdzLmxlbmd0aCA8PSAxKSB7XG4gICAgICAgICAgICAgICAgICAgIGFyZ3MgPSBhcmdzWzBdO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXN1bHRzW2tdID0gYXJncztcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0sIGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgIGNhbGxiYWNrKGVyciwgcmVzdWx0cyk7XG4gICAgICAgIH0pO1xuICAgIH1cbn07XG5cbmZ1bmN0aW9uIHNlcmllcyh0YXNrcywgY2FsbGJhY2spIHtcbiAgICBjYWxsYmFjayA9IGNhbGxiYWNrIHx8IGZ1bmN0aW9uICgpIHt9O1xuICAgIGlmIChtaXNjLmlzQXJyYXkodGFza3MpKSB7XG4gICAgICAgIG1hcFNlcmllcyh0YXNrcywgZnVuY3Rpb24gKGZuLCBjYWxsYmFjaykge1xuICAgICAgICAgICAgaWYgKGZuKSB7XG4gICAgICAgICAgICAgICAgZm4oZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgICAgICAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChhcmdzLmxlbmd0aCA8PSAxKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhcmdzID0gYXJnc1swXTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjay5jYWxsKG51bGwsIGVyciwgYXJncyk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sIGNhbGxiYWNrKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICB2YXIgcmVzdWx0cyA9IHt9O1xuICAgICAgICBlYWNoU2VyaWVzKF8ua2V5cyh0YXNrcyksIGZ1bmN0aW9uIChrLCBjYWxsYmFjaykge1xuICAgICAgICAgICAgdGFza3Nba10oZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICAgICAgICAgICAgICBpZiAoYXJncy5sZW5ndGggPD0gMSkge1xuICAgICAgICAgICAgICAgICAgICBhcmdzID0gYXJnc1swXTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmVzdWx0c1trXSA9IGFyZ3M7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9LCBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICBjYWxsYmFjayhlcnIsIHJlc3VsdHMpO1xuICAgICAgICB9KTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIG9ubHlfb25jZShmbikge1xuICAgIHZhciBjYWxsZWQgPSBmYWxzZTtcbiAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAoY2FsbGVkKSB0aHJvdyBuZXcgRXJyb3IoXCJDYWxsYmFjayB3YXMgYWxyZWFkeSBjYWxsZWQuXCIpO1xuICAgICAgICBjYWxsZWQgPSB0cnVlO1xuICAgICAgICBmbi5hcHBseShyb290LCBhcmd1bWVudHMpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gcGFyYWxsZWwodGFza3MsIGNhbGxiYWNrKSB7XG4gICAgX3BhcmFsbGVsKHtcbiAgICAgICAgbWFwOiBtYXAsXG4gICAgICAgIGVhY2g6IGVhY2hcbiAgICB9LCB0YXNrcywgY2FsbGJhY2spO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgICBzZXJpZXM6IHNlcmllcyxcbiAgICBwYXJhbGxlbDogcGFyYWxsZWxcbn07IiwiLypcbiAqIFRoaXMgaXMgYSBjb2xsZWN0aW9uIG9mIHV0aWxpdGllcyB0YWtlbiBmcm9tIGxpYnJhcmllcyBzdWNoIGFzIGFzeW5jLmpzLCB1bmRlcnNjb3JlLmpzIGV0Yy5cbiAqIEBtb2R1bGUgdXRpbFxuICovXG5cbnZhciBfID0gcmVxdWlyZSgnLi91bmRlcnNjb3JlJyksXG4gICAgYXN5bmMgPSByZXF1aXJlKCcuL2FzeW5jJyksXG4gICAgbWlzYyA9IHJlcXVpcmUoJy4vbWlzYycpO1xuXG5fLmV4dGVuZChtb2R1bGUuZXhwb3J0cywge1xuICAgIF86IF8sXG4gICAgYXN5bmM6IGFzeW5jXG59KTtcbl8uZXh0ZW5kKG1vZHVsZS5leHBvcnRzLCBtaXNjKTtcbiIsInZhciBvYnNlcnZlID0gcmVxdWlyZSgnLi4vLi4vdmVuZG9yL29ic2VydmUtanMvc3JjL29ic2VydmUnKS5QbGF0Zm9ybSxcbiAgICBfID0gcmVxdWlyZSgnLi91bmRlcnNjb3JlJyksXG4gICAgSW50ZXJuYWxTaWVzdGFFcnJvciA9IHJlcXVpcmUoJy4vLi4vZXJyb3InKS5JbnRlcm5hbFNpZXN0YUVycm9yO1xuXG4vLyBVc2VkIGJ5IHBhcmFtTmFtZXMgZnVuY3Rpb24uXG52YXIgRk5fQVJHUyA9IC9eZnVuY3Rpb25cXHMqW15cXChdKlxcKFxccyooW15cXCldKilcXCkvbSxcbiAgICBGTl9BUkdfU1BMSVQgPSAvLC8sXG4gICAgRk5fQVJHID0gL15cXHMqKF8/KSguKz8pXFwxXFxzKiQvLFxuICAgIFNUUklQX0NPTU1FTlRTID0gLygoXFwvXFwvLiokKXwoXFwvXFwqW1xcc1xcU10qP1xcKlxcLykpL21nO1xuXG5mdW5jdGlvbiBjYihjYWxsYmFjaywgZGVmZXJyZWQpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24gKGVycikge1xuICAgICAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrLmFwcGx5KGNhbGxiYWNrLCBhcmd1bWVudHMpO1xuICAgICAgICBpZiAoZGVmZXJyZWQpIHtcbiAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICBkZWZlcnJlZC5yZWplY3QoZXJyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGRlZmVycmVkLnJlc29sdmUuYXBwbHkoZGVmZXJyZWQsIEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfTtcbn1cblxudmFyIGlzQXJyYXlTaGltID0gZnVuY3Rpb24gKG9iaikge1xuICAgICAgICByZXR1cm4gXy50b1N0cmluZy5jYWxsKG9iaikgPT09ICdbb2JqZWN0IEFycmF5XSc7XG4gICAgfSxcbiAgICBpc0FycmF5ID0gQXJyYXkuaXNBcnJheSB8fCBpc0FycmF5U2hpbSxcbiAgICBpc1N0cmluZyA9IGZ1bmN0aW9uIChvKSB7XG4gICAgICAgIHJldHVybiB0eXBlb2YgbyA9PSAnc3RyaW5nJyB8fCBvIGluc3RhbmNlb2YgU3RyaW5nXG4gICAgfTtcbl8uZXh0ZW5kKG1vZHVsZS5leHBvcnRzLCB7XG4gICAgLyoqXG4gICAgICogUGVyZm9ybXMgZGlydHkgY2hlY2svT2JqZWN0Lm9ic2VydmUgY2FsbGJhY2tzIGRlcGVuZGluZyBvbiB0aGUgYnJvd3Nlci5cbiAgICAgKlxuICAgICAqIElmIE9iamVjdC5vYnNlcnZlIGlzIHByZXNlbnQsXG4gICAgICogQHBhcmFtIGNhbGxiYWNrXG4gICAgICovXG4gICAgbmV4dDogZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgICAgIG9ic2VydmUucGVyZm9ybU1pY3JvdGFza0NoZWNrcG9pbnQoKTtcbiAgICAgICAgc2V0VGltZW91dChjYWxsYmFjayk7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGEgaGFuZGxlciB0aGF0IGFjdHMgdXBvbiBhIGNhbGxiYWNrIG9yIGEgcHJvbWlzZSBkZXBlbmRpbmcgb24gdGhlIHJlc3VsdCBvZiBhIGRpZmZlcmVudCBjYWxsYmFjay5cbiAgICAgKiBAcGFyYW0gY2FsbGJhY2tcbiAgICAgKiBAcGFyYW0gW2RlZmVycmVkXVxuICAgICAqIEByZXR1cm5zIHtGdW5jdGlvbn1cbiAgICAgKi9cbiAgICBjYjogY2IsXG4gICAgZ3VpZDogKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgZnVuY3Rpb24gczQoKSB7XG4gICAgICAgICAgICByZXR1cm4gTWF0aC5mbG9vcigoMSArIE1hdGgucmFuZG9tKCkpICogMHgxMDAwMClcbiAgICAgICAgICAgICAgICAudG9TdHJpbmcoMTYpXG4gICAgICAgICAgICAgICAgLnN1YnN0cmluZygxKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gczQoKSArIHM0KCkgKyAnLScgKyBzNCgpICsgJy0nICsgczQoKSArICctJyArXG4gICAgICAgICAgICAgICAgczQoKSArICctJyArIHM0KCkgKyBzNCgpICsgczQoKTtcbiAgICAgICAgfTtcbiAgICB9KSgpLFxuICAgIGFzc2VydDogZnVuY3Rpb24gKGNvbmRpdGlvbiwgbWVzc2FnZSwgY29udGV4dCkge1xuICAgICAgICBpZiAoIWNvbmRpdGlvbikge1xuICAgICAgICAgICAgbWVzc2FnZSA9IG1lc3NhZ2UgfHwgXCJBc3NlcnRpb24gZmFpbGVkXCI7XG4gICAgICAgICAgICBjb250ZXh0ID0gY29udGV4dCB8fCB7fTtcbiAgICAgICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKG1lc3NhZ2UsIGNvbnRleHQpO1xuICAgICAgICB9XG4gICAgfSxcbiAgICB0aGVuQnk6IChmdW5jdGlvbiAoKSB7XG4gICAgICAgIC8qIG1peGluIGZvciB0aGUgYHRoZW5CeWAgcHJvcGVydHkgKi9cbiAgICAgICAgZnVuY3Rpb24gZXh0ZW5kKGYpIHtcbiAgICAgICAgICAgIGYudGhlbkJ5ID0gdGI7XG4gICAgICAgICAgICByZXR1cm4gZjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qIGFkZHMgYSBzZWNvbmRhcnkgY29tcGFyZSBmdW5jdGlvbiB0byB0aGUgdGFyZ2V0IGZ1bmN0aW9uIChgdGhpc2AgY29udGV4dClcbiAgICAgICAgIHdoaWNoIGlzIGFwcGxpZWQgaW4gY2FzZSB0aGUgZmlyc3Qgb25lIHJldHVybnMgMCAoZXF1YWwpXG4gICAgICAgICByZXR1cm5zIGEgbmV3IGNvbXBhcmUgZnVuY3Rpb24sIHdoaWNoIGhhcyBhIGB0aGVuQnlgIG1ldGhvZCBhcyB3ZWxsICovXG4gICAgICAgIGZ1bmN0aW9uIHRiKHkpIHtcbiAgICAgICAgICAgIHZhciB4ID0gdGhpcztcbiAgICAgICAgICAgIHJldHVybiBleHRlbmQoZnVuY3Rpb24gKGEsIGIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geChhLCBiKSB8fCB5KGEsIGIpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZXh0ZW5kO1xuICAgIH0pKCksXG4gICAgZGVmZXI6IGZ1bmN0aW9uIChjYikge1xuICAgICAgICB2YXIgZGVmZXJyZWQ7XG4gICAgICAgIGNiID0gY2IgfHwgZnVuY3Rpb24gKCkge307XG4gICAgICAgIGlmIChzaWVzdGEucSkge1xuICAgICAgICAgICAgZGVmZXJyZWQgPSBzaWVzdGEucS5kZWZlcigpO1xuICAgICAgICAgICAgdmFyIHJlamVjdCA9IGRlZmVycmVkLnJlamVjdCxcbiAgICAgICAgICAgICAgICByZXNvbHZlID0gZGVmZXJyZWQucmVzb2x2ZTtcbiAgICAgICAgICAgIF8uZXh0ZW5kKGRlZmVycmVkLCB7XG4gICAgICAgICAgICAgICAgcmVqZWN0OiBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGNiKGVycik7XG4gICAgICAgICAgICAgICAgICAgIHJlamVjdC5jYWxsKHRoaXMsIGVycik7XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICByZXNvbHZlOiBmdW5jdGlvbiAocmVzKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciB0aGlzQXJnID0gY2IuX19zaWVzdGFfYm91bmRfb2JqZWN0IHx8IGNiO1xuICAgICAgICAgICAgICAgICAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMCk7XG4gICAgICAgICAgICAgICAgICAgIGFyZ3MudW5zaGlmdChudWxsKTtcbiAgICAgICAgICAgICAgICAgICAgY2IuYXBwbHkodGhpc0FyZywgYXJncyk7XG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmUuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGZpbmlzaDogZnVuY3Rpb24gKGVyciwgcmVzKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucmVqZWN0KGVycik7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnJlc29sdmUuYXBwbHkodGhpcywgYXJncyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGRlZmVycmVkID0ge1xuICAgICAgICAgICAgICAgIHByb21pc2U6IHVuZGVmaW5lZCxcbiAgICAgICAgICAgICAgICByZWplY3Q6IGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHRoaXNBcmcgPSBjYi5fX3NpZXN0YV9ib3VuZF9vYmplY3QgfHwgY2I7XG4gICAgICAgICAgICAgICAgICAgIGNiLmFwcGx5KHRoaXNBcmcsIGFyZ3VtZW50cyk7XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICByZXNvbHZlOiBmdW5jdGlvbiAocmVzKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciB0aGlzQXJnID0gY2IuX19zaWVzdGFfYm91bmRfb2JqZWN0IHx8IGNiO1xuICAgICAgICAgICAgICAgICAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMCk7XG4gICAgICAgICAgICAgICAgICAgIGFyZ3MudW5zaGlmdChudWxsKTtcbiAgICAgICAgICAgICAgICAgICAgY2IuYXBwbHkodGhpc0FyZywgYXJncyk7XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBmaW5pc2g6IGZ1bmN0aW9uIChlcnIsIHJlcykge1xuICAgICAgICAgICAgICAgICAgICB2YXIgdGhpc0FyZyA9IGNiLl9fc2llc3RhX2JvdW5kX29iamVjdCB8fCBjYjtcbiAgICAgICAgICAgICAgICAgICAgY2IuYXBwbHkodGhpc0FyZywgYXJndW1lbnRzKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZGVmZXJyZWQ7XG4gICAgfSxcbiAgICBkZWZpbmVTdWJQcm9wZXJ0eTogZnVuY3Rpb24gKHByb3BlcnR5LCBzdWJPYmosIGlubmVyUHJvcGVydHkpIHtcbiAgICAgICAgcmV0dXJuIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCBwcm9wZXJ0eSwge1xuICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgaWYgKGlubmVyUHJvcGVydHkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHN1Yk9ialtpbm5lclByb3BlcnR5XTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBzdWJPYmpbcHJvcGVydHldO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBzZXQ6IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICAgICAgICAgIGlmIChpbm5lclByb3BlcnR5KSB7XG4gICAgICAgICAgICAgICAgICAgIHN1Yk9ialtpbm5lclByb3BlcnR5XSA9IHZhbHVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgc3ViT2JqW3Byb3BlcnR5XSA9IHZhbHVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgICAgIH0pO1xuICAgIH0sXG4gICAgZGVmaW5lU3ViUHJvcGVydHlOb1NldDogZnVuY3Rpb24gKHByb3BlcnR5LCBzdWJPYmosIGlubmVyUHJvcGVydHkpIHtcbiAgICAgICAgcmV0dXJuIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCBwcm9wZXJ0eSwge1xuICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgaWYgKGlubmVyUHJvcGVydHkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHN1Yk9ialtpbm5lclByb3BlcnR5XTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBzdWJPYmpbcHJvcGVydHldO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgICAgIH0pO1xuICAgIH0sXG4gICAgc3ViUHJvcGVydGllczogZnVuY3Rpb24gKG9iaiwgc3ViT2JqLCBwcm9wZXJ0aWVzKSB7XG4gICAgICAgIGlmICghaXNBcnJheShwcm9wZXJ0aWVzKSkge1xuICAgICAgICAgICAgcHJvcGVydGllcyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMik7XG4gICAgICAgIH1cbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBwcm9wZXJ0aWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAoZnVuY3Rpb24gKHByb3BlcnR5KSB7XG4gICAgICAgICAgICAgICAgdmFyIG9wdHMgPSB7XG4gICAgICAgICAgICAgICAgICAgIHNldDogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIG5hbWU6IHByb3BlcnR5LFxuICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0eTogcHJvcGVydHlcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIGlmICghaXNTdHJpbmcocHJvcGVydHkpKSB7XG4gICAgICAgICAgICAgICAgICAgIF8uZXh0ZW5kKG9wdHMsIHByb3BlcnR5KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdmFyIGRlc2MgPSB7XG4gICAgICAgICAgICAgICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHN1Yk9ialtvcHRzLnByb3BlcnR5XTtcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICBpZiAob3B0cy5zZXQpIHtcbiAgICAgICAgICAgICAgICAgICAgZGVzYy5zZXQgPSBmdW5jdGlvbiAodikge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3ViT2JqW29wdHMucHJvcGVydHldID0gdjtcbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG9iaiwgb3B0cy5uYW1lLCBkZXNjKTtcbiAgICAgICAgICAgIH0pKHByb3BlcnRpZXNbaV0pO1xuICAgICAgICB9XG4gICAgfSxcbiAgICBjYXBpdGFsaXNlRmlyc3RMZXR0ZXI6IGZ1bmN0aW9uIChzdHJpbmcpIHtcbiAgICAgICAgcmV0dXJuIHN0cmluZy5jaGFyQXQoMCkudG9VcHBlckNhc2UoKSArIHN0cmluZy5zbGljZSgxKTtcbiAgICB9LFxuICAgIGV4dGVuZEZyb21PcHRzOiBmdW5jdGlvbiAob2JqLCBvcHRzLCBkZWZhdWx0cywgZXJyb3JPblVua25vd24pIHtcbiAgICAgICAgZXJyb3JPblVua25vd24gPSBlcnJvck9uVW5rbm93biA9PSB1bmRlZmluZWQgPyB0cnVlIDogZXJyb3JPblVua25vd247XG4gICAgICAgIGlmIChlcnJvck9uVW5rbm93bikge1xuICAgICAgICAgICAgdmFyIGRlZmF1bHRLZXlzID0gT2JqZWN0LmtleXMoZGVmYXVsdHMpLFxuICAgICAgICAgICAgICAgIG9wdHNLZXlzID0gT2JqZWN0LmtleXMob3B0cyk7XG4gICAgICAgICAgICB2YXIgdW5rbm93bktleXMgPSBvcHRzS2V5cy5maWx0ZXIoZnVuY3Rpb24gKG4pIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZGVmYXVsdEtleXMuaW5kZXhPZihuKSA9PSAtMVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBpZiAodW5rbm93bktleXMubGVuZ3RoKSB0aHJvdyBFcnJvcignVW5rbm93biBvcHRpb25zOiAnICsgdW5rbm93bktleXMudG9TdHJpbmcoKSk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gQXBwbHkgYW55IGZ1bmN0aW9ucyBzcGVjaWZpZWQgaW4gdGhlIGRlZmF1bHRzLlxuICAgICAgICBfLmVhY2goT2JqZWN0LmtleXMoZGVmYXVsdHMpLCBmdW5jdGlvbiAoaykge1xuICAgICAgICAgICAgdmFyIGQgPSBkZWZhdWx0c1trXTtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgZCA9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICAgICAgZGVmYXVsdHNba10gPSBkKG9wdHNba10pO1xuICAgICAgICAgICAgICAgIGRlbGV0ZSBvcHRzW2tdO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgXy5leHRlbmQoZGVmYXVsdHMsIG9wdHMpO1xuICAgICAgICBfLmV4dGVuZChvYmosIGRlZmF1bHRzKTtcbiAgICB9LFxuICAgIGlzU3RyaW5nOiBpc1N0cmluZyxcbiAgICBpc0FycmF5OiBpc0FycmF5LFxuICAgIHByZXR0eVByaW50OiBmdW5jdGlvbiAobykge1xuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkobywgbnVsbCwgNCk7XG4gICAgfSxcbiAgICBmbGF0dGVuQXJyYXk6IGZ1bmN0aW9uIChhcnIpIHtcbiAgICAgICAgcmV0dXJuIF8ucmVkdWNlKGFyciwgZnVuY3Rpb24gKG1lbW8sIGUpIHtcbiAgICAgICAgICAgIGlmIChpc0FycmF5KGUpKSB7XG4gICAgICAgICAgICAgICAgbWVtbyA9IG1lbW8uY29uY2F0KGUpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBtZW1vLnB1c2goZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gbWVtbztcbiAgICAgICAgfSwgW10pO1xuICAgIH0sXG4gICAgdW5mbGF0dGVuQXJyYXk6IGZ1bmN0aW9uIChhcnIsIG1vZGVsQXJyKSB7XG4gICAgICAgIHZhciBuID0gMDtcbiAgICAgICAgdmFyIHVuZmxhdHRlbmVkID0gW107XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbW9kZWxBcnIubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmIChpc0FycmF5KG1vZGVsQXJyW2ldKSkge1xuICAgICAgICAgICAgICAgIHZhciBuZXdBcnIgPSBbXTtcbiAgICAgICAgICAgICAgICB1bmZsYXR0ZW5lZFtpXSA9IG5ld0FycjtcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBqID0gMDsgaiA8IG1vZGVsQXJyW2ldLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICAgICAgICAgIG5ld0Fyci5wdXNoKGFycltuXSk7XG4gICAgICAgICAgICAgICAgICAgIG4rKztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHVuZmxhdHRlbmVkW2ldID0gYXJyW25dO1xuICAgICAgICAgICAgICAgIG4rKztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdW5mbGF0dGVuZWQ7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBSZXR1cm4gdGhlIHBhcmFtZXRlciBuYW1lcyBvZiBhIGZ1bmN0aW9uLlxuICAgICAqIE5vdGU6IGFkYXB0ZWQgZnJvbSBBbmd1bGFySlMgZGVwZW5kZW5jeSBpbmplY3Rpb24gOilcbiAgICAgKiBAcGFyYW0gZm5cbiAgICAgKi9cbiAgICBwYXJhbU5hbWVzOiBmdW5jdGlvbiAoZm4pIHtcbiAgICAgICAgLy8gVE9ETzogSXMgdGhlcmUgYSBtb3JlIHJvYnVzdCB3YXkgb2YgZG9pbmcgdGhpcz9cbiAgICAgICAgdmFyIHBhcmFtcyA9IFtdLFxuICAgICAgICAgICAgZm5UZXh0LFxuICAgICAgICAgICAgYXJnRGVjbDtcbiAgICAgICAgZm5UZXh0ID0gZm4udG9TdHJpbmcoKS5yZXBsYWNlKFNUUklQX0NPTU1FTlRTLCAnJyk7XG4gICAgICAgIGFyZ0RlY2wgPSBmblRleHQubWF0Y2goRk5fQVJHUyk7XG5cbiAgICAgICAgYXJnRGVjbFsxXS5zcGxpdChGTl9BUkdfU1BMSVQpLmZvckVhY2goZnVuY3Rpb24gKGFyZykge1xuICAgICAgICAgICAgYXJnLnJlcGxhY2UoRk5fQVJHLCBmdW5jdGlvbiAoYWxsLCB1bmRlcnNjb3JlLCBuYW1lKSB7XG4gICAgICAgICAgICAgICAgcGFyYW1zLnB1c2gobmFtZSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBwYXJhbXM7XG4gICAgfVxufSk7IiwiLyoqXG4gKiBPZnRlbiB1c2VkIGZ1bmN0aW9ucyBmcm9tIHVuZGVyc2NvcmUsIHB1bGxlZCBvdXQgZm9yIGJyZXZpdHkuXG4gKiBAbW9kdWxlIHVuZGVyc2NvcmVcbiAqL1xuXG52YXIgXyA9IHt9LFxuICAgIEFycmF5UHJvdG8gPSBBcnJheS5wcm90b3R5cGUsXG4gICAgRnVuY1Byb3RvID0gRnVuY3Rpb24ucHJvdG90eXBlLFxuICAgIG5hdGl2ZUZvckVhY2ggPSBBcnJheVByb3RvLmZvckVhY2gsXG4gICAgbmF0aXZlTWFwID0gQXJyYXlQcm90by5tYXAsXG4gICAgbmF0aXZlUmVkdWNlID0gQXJyYXlQcm90by5yZWR1Y2UsXG4gICAgbmF0aXZlQmluZCA9IEZ1bmNQcm90by5iaW5kLFxuICAgIHNsaWNlID0gQXJyYXlQcm90by5zbGljZSxcbiAgICBicmVha2VyID0ge30sXG4gICAgY3RvciA9IGZ1bmN0aW9uICgpIHt9O1xuXG5mdW5jdGlvbiBrZXlzKG9iaikge1xuICAgIGlmIChPYmplY3Qua2V5cykge1xuICAgICAgICByZXR1cm4gT2JqZWN0LmtleXMob2JqKTtcbiAgICB9XG4gICAgdmFyIGtleXMgPSBbXTtcbiAgICBmb3IgKHZhciBrIGluIG9iaikge1xuICAgICAgICBpZiAob2JqLmhhc093blByb3BlcnR5KGspKSB7XG4gICAgICAgICAgICBrZXlzLnB1c2goayk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGtleXM7XG59XG5cbl8ua2V5cyA9IGtleXM7XG5cbl8uZWFjaCA9IF8uZm9yRWFjaCA9IGZ1bmN0aW9uIChvYmosIGl0ZXJhdG9yLCBjb250ZXh0KSB7XG4gICAgaWYgKG9iaiA9PSBudWxsKSByZXR1cm4gb2JqO1xuICAgIGlmIChuYXRpdmVGb3JFYWNoICYmIG9iai5mb3JFYWNoID09PSBuYXRpdmVGb3JFYWNoKSB7XG4gICAgICAgIG9iai5mb3JFYWNoKGl0ZXJhdG9yLCBjb250ZXh0KTtcbiAgICB9IGVsc2UgaWYgKG9iai5sZW5ndGggPT09ICtvYmoubGVuZ3RoKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBsZW5ndGggPSBvYmoubGVuZ3RoOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmIChpdGVyYXRvci5jYWxsKGNvbnRleHQsIG9ialtpXSwgaSwgb2JqKSA9PT0gYnJlYWtlcikgcmV0dXJuO1xuICAgICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdmFyIGtleXMgPSBfLmtleXMob2JqKTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbmd0aCA9IGtleXMubGVuZ3RoOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmIChpdGVyYXRvci5jYWxsKGNvbnRleHQsIG9ialtrZXlzW2ldXSwga2V5c1tpXSwgb2JqKSA9PT0gYnJlYWtlcikgcmV0dXJuO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBvYmo7XG59O1xuXG4vLyBSZXR1cm4gdGhlIHJlc3VsdHMgb2YgYXBwbHlpbmcgdGhlIGl0ZXJhdG9yIHRvIGVhY2ggZWxlbWVudC5cbi8vIERlbGVnYXRlcyB0byAqKkVDTUFTY3JpcHQgNSoqJ3MgbmF0aXZlIGBtYXBgIGlmIGF2YWlsYWJsZS5cbl8ubWFwID0gXy5jb2xsZWN0ID0gZnVuY3Rpb24gKG9iaiwgaXRlcmF0b3IsIGNvbnRleHQpIHtcbiAgICB2YXIgcmVzdWx0cyA9IFtdO1xuICAgIGlmIChvYmogPT0gbnVsbCkgcmV0dXJuIHJlc3VsdHM7XG4gICAgaWYgKG5hdGl2ZU1hcCAmJiBvYmoubWFwID09PSBuYXRpdmVNYXApIHJldHVybiBvYmoubWFwKGl0ZXJhdG9yLCBjb250ZXh0KTtcbiAgICBfLmVhY2gob2JqLCBmdW5jdGlvbiAodmFsdWUsIGluZGV4LCBsaXN0KSB7XG4gICAgICAgIHJlc3VsdHMucHVzaChpdGVyYXRvci5jYWxsKGNvbnRleHQsIHZhbHVlLCBpbmRleCwgbGlzdCkpO1xuICAgIH0pO1xuICAgIHJldHVybiByZXN1bHRzO1xufTtcblxuLy8gSW50ZXJuYWwgZnVuY3Rpb24gdGhhdCByZXR1cm5zIGFuIGVmZmljaWVudCAoZm9yIGN1cnJlbnQgZW5naW5lcykgdmVyc2lvblxuLy8gb2YgdGhlIHBhc3NlZC1pbiBjYWxsYmFjaywgdG8gYmUgcmVwZWF0ZWRseSBhcHBsaWVkIGluIG90aGVyIFVuZGVyc2NvcmVcbi8vIGZ1bmN0aW9ucy5cbnZhciBjcmVhdGVDYWxsYmFjayA9IGZ1bmN0aW9uIChmdW5jLCBjb250ZXh0LCBhcmdDb3VudCkge1xuICAgIGlmIChjb250ZXh0ID09PSB2b2lkIDApIHJldHVybiBmdW5jO1xuICAgIHN3aXRjaCAoYXJnQ291bnQgPT0gbnVsbCA/IDMgOiBhcmdDb3VudCkge1xuICAgICAgICBjYXNlIDE6XG4gICAgICAgICAgICByZXR1cm4gZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZ1bmMuY2FsbChjb250ZXh0LCB2YWx1ZSk7XG4gICAgICAgICAgICB9O1xuICAgICAgICBjYXNlIDI6XG4gICAgICAgICAgICByZXR1cm4gZnVuY3Rpb24gKHZhbHVlLCBvdGhlcikge1xuICAgICAgICAgICAgICAgIHJldHVybiBmdW5jLmNhbGwoY29udGV4dCwgdmFsdWUsIG90aGVyKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgIGNhc2UgMzpcbiAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbiAodmFsdWUsIGluZGV4LCBjb2xsZWN0aW9uKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZ1bmMuY2FsbChjb250ZXh0LCB2YWx1ZSwgaW5kZXgsIGNvbGxlY3Rpb24pO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgY2FzZSA0OlxuICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIChhY2N1bXVsYXRvciwgdmFsdWUsIGluZGV4LCBjb2xsZWN0aW9uKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZ1bmMuY2FsbChjb250ZXh0LCBhY2N1bXVsYXRvciwgdmFsdWUsIGluZGV4LCBjb2xsZWN0aW9uKTtcbiAgICAgICAgICAgIH07XG4gICAgfVxuICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiBmdW5jLmFwcGx5KGNvbnRleHQsIGFyZ3VtZW50cyk7XG4gICAgfTtcbn07XG5cbi8vIFJ1biBhIGZ1bmN0aW9uICoqbioqIHRpbWVzLlxuXy50aW1lcyA9IGZ1bmN0aW9uIChuLCBpdGVyYXRlZSwgY29udGV4dCkge1xuICAgIHZhciBhY2N1bSA9IG5ldyBBcnJheShNYXRoLm1heCgwLCBuKSk7XG4gICAgaXRlcmF0ZWUgPSBjcmVhdGVDYWxsYmFjayhpdGVyYXRlZSwgY29udGV4dCwgMSk7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBuOyBpKyspIGFjY3VtW2ldID0gaXRlcmF0ZWUoaSk7XG4gICAgcmV0dXJuIGFjY3VtO1xufTtcblxuLy8gUGFydGlhbGx5IGFwcGx5IGEgZnVuY3Rpb24gYnkgY3JlYXRpbmcgYSB2ZXJzaW9uIHRoYXQgaGFzIGhhZCBzb21lIG9mIGl0c1xuLy8gYXJndW1lbnRzIHByZS1maWxsZWQsIHdpdGhvdXQgY2hhbmdpbmcgaXRzIGR5bmFtaWMgYHRoaXNgIGNvbnRleHQuIF8gYWN0c1xuLy8gYXMgYSBwbGFjZWhvbGRlciwgYWxsb3dpbmcgYW55IGNvbWJpbmF0aW9uIG9mIGFyZ3VtZW50cyB0byBiZSBwcmUtZmlsbGVkLlxuXy5wYXJ0aWFsID0gZnVuY3Rpb24gKGZ1bmMpIHtcbiAgICB2YXIgYm91bmRBcmdzID0gc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBwb3NpdGlvbiA9IDA7XG4gICAgICAgIHZhciBhcmdzID0gYm91bmRBcmdzLnNsaWNlKCk7XG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBsZW5ndGggPSBhcmdzLmxlbmd0aDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAoYXJnc1tpXSA9PT0gXykgYXJnc1tpXSA9IGFyZ3VtZW50c1twb3NpdGlvbisrXTtcbiAgICAgICAgfVxuICAgICAgICB3aGlsZSAocG9zaXRpb24gPCBhcmd1bWVudHMubGVuZ3RoKSBhcmdzLnB1c2goYXJndW1lbnRzW3Bvc2l0aW9uKytdKTtcbiAgICAgICAgcmV0dXJuIGZ1bmMuYXBwbHkodGhpcywgYXJncyk7XG4gICAgfTtcbn07XG5cbi8vIENvbnZlbmllbmNlIHZlcnNpb24gb2YgYSBjb21tb24gdXNlIGNhc2Ugb2YgYG1hcGA6IGZldGNoaW5nIGEgcHJvcGVydHkuXG5fLnBsdWNrID0gZnVuY3Rpb24gKG9iaiwga2V5KSB7XG4gICAgcmV0dXJuIF8ubWFwKG9iaiwgXy5wcm9wZXJ0eShrZXkpKTtcbn07XG5cbnZhciByZWR1Y2VFcnJvciA9ICdSZWR1Y2Ugb2YgZW1wdHkgYXJyYXkgd2l0aCBubyBpbml0aWFsIHZhbHVlJztcblxuLy8gKipSZWR1Y2UqKiBidWlsZHMgdXAgYSBzaW5nbGUgcmVzdWx0IGZyb20gYSBsaXN0IG9mIHZhbHVlcywgYWthIGBpbmplY3RgLFxuLy8gb3IgYGZvbGRsYC4gRGVsZWdhdGVzIHRvICoqRUNNQVNjcmlwdCA1KioncyBuYXRpdmUgYHJlZHVjZWAgaWYgYXZhaWxhYmxlLlxuXy5yZWR1Y2UgPSBfLmZvbGRsID0gXy5pbmplY3QgPSBmdW5jdGlvbiAob2JqLCBpdGVyYXRvciwgbWVtbywgY29udGV4dCkge1xuICAgIHZhciBpbml0aWFsID0gYXJndW1lbnRzLmxlbmd0aCA+IDI7XG4gICAgaWYgKG9iaiA9PSBudWxsKSBvYmogPSBbXTtcbiAgICBpZiAobmF0aXZlUmVkdWNlICYmIG9iai5yZWR1Y2UgPT09IG5hdGl2ZVJlZHVjZSkge1xuICAgICAgICBpZiAoY29udGV4dCkgaXRlcmF0b3IgPSBfLmJpbmQoaXRlcmF0b3IsIGNvbnRleHQpO1xuICAgICAgICByZXR1cm4gaW5pdGlhbCA/IG9iai5yZWR1Y2UoaXRlcmF0b3IsIG1lbW8pIDogb2JqLnJlZHVjZShpdGVyYXRvcik7XG4gICAgfVxuICAgIF8uZWFjaChvYmosIGZ1bmN0aW9uICh2YWx1ZSwgaW5kZXgsIGxpc3QpIHtcbiAgICAgICAgaWYgKCFpbml0aWFsKSB7XG4gICAgICAgICAgICBtZW1vID0gdmFsdWU7XG4gICAgICAgICAgICBpbml0aWFsID0gdHJ1ZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG1lbW8gPSBpdGVyYXRvci5jYWxsKGNvbnRleHQsIG1lbW8sIHZhbHVlLCBpbmRleCwgbGlzdCk7XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBpZiAoIWluaXRpYWwpIHRocm93IG5ldyBUeXBlRXJyb3IocmVkdWNlRXJyb3IpO1xuICAgIHJldHVybiBtZW1vO1xufTtcblxuXy5wcm9wZXJ0eSA9IGZ1bmN0aW9uIChrZXkpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24gKG9iaikge1xuICAgICAgICByZXR1cm4gb2JqW2tleV07XG4gICAgfTtcbn07XG5cbi8vIE9wdGltaXplIGBpc0Z1bmN0aW9uYCBpZiBhcHByb3ByaWF0ZS5cbmlmICh0eXBlb2YoLy4vKSAhPT0gJ2Z1bmN0aW9uJykge1xuICAgIF8uaXNGdW5jdGlvbiA9IGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgcmV0dXJuIHR5cGVvZiBvYmogPT09ICdmdW5jdGlvbic7XG4gICAgfTtcbn1cblxuXy5pc09iamVjdCA9IGZ1bmN0aW9uIChvYmopIHtcbiAgICB2YXIgdHlwZSA9IHR5cGVvZiBvYmo7XG4gICAgcmV0dXJuIHR5cGUgPT09ICdmdW5jdGlvbicgfHwgdHlwZSA9PT0gJ29iamVjdCcgJiYgISFvYmo7XG59O1xuXG4vLyBBbiBpbnRlcm5hbCBmdW5jdGlvbiB0byBnZW5lcmF0ZSBsb29rdXAgaXRlcmF0b3JzLlxudmFyIGxvb2t1cEl0ZXJhdG9yID0gZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgaWYgKHZhbHVlID09IG51bGwpIHJldHVybiBfLmlkZW50aXR5O1xuICAgIGlmIChfLmlzRnVuY3Rpb24odmFsdWUpKSByZXR1cm4gdmFsdWU7XG4gICAgcmV0dXJuIF8ucHJvcGVydHkodmFsdWUpO1xufTtcblxuLy8gU29ydCB0aGUgb2JqZWN0J3MgdmFsdWVzIGJ5IGEgY3JpdGVyaW9uIHByb2R1Y2VkIGJ5IGFuIGl0ZXJhdG9yLlxuXy5zb3J0QnkgPSBmdW5jdGlvbiAob2JqLCBpdGVyYXRvciwgY29udGV4dCkge1xuICAgIGl0ZXJhdG9yID0gbG9va3VwSXRlcmF0b3IoaXRlcmF0b3IpO1xuICAgIHJldHVybiBfLnBsdWNrKF8ubWFwKG9iaiwgZnVuY3Rpb24gKHZhbHVlLCBpbmRleCwgbGlzdCkge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgdmFsdWU6IHZhbHVlLFxuICAgICAgICAgICAgaW5kZXg6IGluZGV4LFxuICAgICAgICAgICAgY3JpdGVyaWE6IGl0ZXJhdG9yLmNhbGwoY29udGV4dCwgdmFsdWUsIGluZGV4LCBsaXN0KVxuICAgICAgICB9O1xuICAgIH0pLnNvcnQoZnVuY3Rpb24gKGxlZnQsIHJpZ2h0KSB7XG4gICAgICAgIHZhciBhID0gbGVmdC5jcml0ZXJpYTtcbiAgICAgICAgdmFyIGIgPSByaWdodC5jcml0ZXJpYTtcbiAgICAgICAgaWYgKGEgIT09IGIpIHtcbiAgICAgICAgICAgIGlmIChhID4gYiB8fCBhID09PSB2b2lkIDApIHJldHVybiAxO1xuICAgICAgICAgICAgaWYgKGEgPCBiIHx8IGIgPT09IHZvaWQgMCkgcmV0dXJuIC0xO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBsZWZ0LmluZGV4IC0gcmlnaHQuaW5kZXg7XG4gICAgfSksICd2YWx1ZScpO1xufTtcblxuXG4vLyBDcmVhdGUgYSBmdW5jdGlvbiBib3VuZCB0byBhIGdpdmVuIG9iamVjdCAoYXNzaWduaW5nIGB0aGlzYCwgYW5kIGFyZ3VtZW50cyxcbi8vIG9wdGlvbmFsbHkpLiBEZWxlZ2F0ZXMgdG8gKipFQ01BU2NyaXB0IDUqKidzIG5hdGl2ZSBgRnVuY3Rpb24uYmluZGAgaWZcbi8vIGF2YWlsYWJsZS5cbl8uYmluZCA9IGZ1bmN0aW9uIChmdW5jLCBjb250ZXh0KSB7XG4gICAgdmFyIGFyZ3MsIGJvdW5kO1xuICAgIGlmIChuYXRpdmVCaW5kICYmIGZ1bmMuYmluZCA9PT0gbmF0aXZlQmluZCkgcmV0dXJuIG5hdGl2ZUJpbmQuYXBwbHkoZnVuYywgc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpKTtcbiAgICBpZiAoIV8uaXNGdW5jdGlvbihmdW5jKSkgdGhyb3cgbmV3IFR5cGVFcnJvcjtcbiAgICBhcmdzID0gc2xpY2UuY2FsbChhcmd1bWVudHMsIDIpO1xuICAgIHJldHVybiBib3VuZCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIGJvdW5kKSkgcmV0dXJuIGZ1bmMuYXBwbHkoY29udGV4dCwgYXJncy5jb25jYXQoc2xpY2UuY2FsbChhcmd1bWVudHMpKSk7XG4gICAgICAgIGN0b3IucHJvdG90eXBlID0gZnVuYy5wcm90b3R5cGU7XG4gICAgICAgIHZhciBzZWxmID0gbmV3IGN0b3I7XG4gICAgICAgIGN0b3IucHJvdG90eXBlID0gbnVsbDtcbiAgICAgICAgdVxuICAgICAgICB2YXIgcmVzdWx0ID0gZnVuYy5hcHBseShzZWxmLCBhcmdzLmNvbmNhdChzbGljZS5jYWxsKGFyZ3VtZW50cykpKTtcbiAgICAgICAgaWYgKE9iamVjdChyZXN1bHQpID09PSByZXN1bHQpIHJldHVybiByZXN1bHQ7XG4gICAgICAgIHJldHVybiBzZWxmO1xuICAgIH07XG59O1xuXG5fLmlkZW50aXR5ID0gZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgcmV0dXJuIHZhbHVlO1xufTtcblxuXy56aXAgPSBmdW5jdGlvbiAoYXJyYXkpIHtcbiAgICBpZiAoYXJyYXkgPT0gbnVsbCkgcmV0dXJuIFtdO1xuICAgIHZhciBsZW5ndGggPSBfLm1heChhcmd1bWVudHMsICdsZW5ndGgnKS5sZW5ndGg7XG4gICAgdmFyIHJlc3VsdHMgPSBBcnJheShsZW5ndGgpO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgcmVzdWx0c1tpXSA9IF8ucGx1Y2soYXJndW1lbnRzLCBpKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdHM7XG59O1xuXG4vLyBSZXR1cm4gdGhlIG1heGltdW0gZWxlbWVudCAob3IgZWxlbWVudC1iYXNlZCBjb21wdXRhdGlvbikuXG5fLm1heCA9IGZ1bmN0aW9uIChvYmosIGl0ZXJhdGVlLCBjb250ZXh0KSB7XG4gICAgdmFyIHJlc3VsdCA9IC1JbmZpbml0eSxcbiAgICAgICAgbGFzdENvbXB1dGVkID0gLUluZmluaXR5LFxuICAgICAgICB2YWx1ZSwgY29tcHV0ZWQ7XG4gICAgaWYgKGl0ZXJhdGVlID09IG51bGwgJiYgb2JqICE9IG51bGwpIHtcbiAgICAgICAgb2JqID0gb2JqLmxlbmd0aCA9PT0gK29iai5sZW5ndGggPyBvYmogOiBfLnZhbHVlcyhvYmopO1xuICAgICAgICBmb3IgKHZhciBpID0gMCwgbGVuZ3RoID0gb2JqLmxlbmd0aDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB2YWx1ZSA9IG9ialtpXTtcbiAgICAgICAgICAgIGlmICh2YWx1ZSA+IHJlc3VsdCkge1xuICAgICAgICAgICAgICAgIHJlc3VsdCA9IHZhbHVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgICAgaXRlcmF0ZWUgPSBfLml0ZXJhdGVlKGl0ZXJhdGVlLCBjb250ZXh0KTtcbiAgICAgICAgXy5lYWNoKG9iaiwgZnVuY3Rpb24gKHZhbHVlLCBpbmRleCwgbGlzdCkge1xuICAgICAgICAgICAgY29tcHV0ZWQgPSBpdGVyYXRlZSh2YWx1ZSwgaW5kZXgsIGxpc3QpO1xuICAgICAgICAgICAgaWYgKGNvbXB1dGVkID4gbGFzdENvbXB1dGVkIHx8IGNvbXB1dGVkID09PSAtSW5maW5pdHkgJiYgcmVzdWx0ID09PSAtSW5maW5pdHkpIHtcbiAgICAgICAgICAgICAgICByZXN1bHQgPSB2YWx1ZTtcbiAgICAgICAgICAgICAgICBsYXN0Q29tcHV0ZWQgPSBjb21wdXRlZDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG59O1xuXG5cbl8uaXRlcmF0ZWUgPSBmdW5jdGlvbiAodmFsdWUsIGNvbnRleHQsIGFyZ0NvdW50KSB7XG4gICAgaWYgKHZhbHVlID09IG51bGwpIHJldHVybiBfLmlkZW50aXR5O1xuICAgIGlmIChfLmlzRnVuY3Rpb24odmFsdWUpKSByZXR1cm4gY3JlYXRlQ2FsbGJhY2sodmFsdWUsIGNvbnRleHQsIGFyZ0NvdW50KTtcbiAgICBpZiAoXy5pc09iamVjdCh2YWx1ZSkpIHJldHVybiBfLm1hdGNoZXModmFsdWUpO1xuICAgIHJldHVybiBfLnByb3BlcnR5KHZhbHVlKTtcbn07XG5cbl8ucGFpcnMgPSBmdW5jdGlvbiAob2JqKSB7XG4gICAgdmFyIGtleXMgPSBfLmtleXMob2JqKTtcbiAgICB2YXIgbGVuZ3RoID0ga2V5cy5sZW5ndGg7XG4gICAgdmFyIHBhaXJzID0gQXJyYXkobGVuZ3RoKTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHBhaXJzW2ldID0gW2tleXNbaV0sIG9ialtrZXlzW2ldXV07XG4gICAgfVxuICAgIHJldHVybiBwYWlycztcbn07XG5cbl8ubWF0Y2hlcyA9IGZ1bmN0aW9uIChhdHRycykge1xuICAgIHZhciBwYWlycyA9IF8ucGFpcnMoYXR0cnMpLFxuICAgICAgICBsZW5ndGggPSBwYWlycy5sZW5ndGg7XG4gICAgcmV0dXJuIGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgaWYgKG9iaiA9PSBudWxsKSByZXR1cm4gIWxlbmd0aDtcbiAgICAgICAgb2JqID0gbmV3IE9iamVjdChvYmopO1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB2YXIgcGFpciA9IHBhaXJzW2ldLFxuICAgICAgICAgICAgICAgIGtleSA9IHBhaXJbMF07XG4gICAgICAgICAgICBpZiAocGFpclsxXSAhPT0gb2JqW2tleV0gfHwgIShrZXkgaW4gb2JqKSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH07XG59O1xuXG5fLnNvbWUgPSBmdW5jdGlvbiAob2JqLCBwcmVkaWNhdGUsIGNvbnRleHQpIHtcbiAgICBpZiAob2JqID09IG51bGwpIHJldHVybiBmYWxzZTtcbiAgICBwcmVkaWNhdGUgPSBfLml0ZXJhdGVlKHByZWRpY2F0ZSwgY29udGV4dCk7XG4gICAgdmFyIGtleXMgPSBvYmoubGVuZ3RoICE9PSArb2JqLmxlbmd0aCAmJiBfLmtleXMob2JqKSxcbiAgICAgICAgbGVuZ3RoID0gKGtleXMgfHwgb2JqKS5sZW5ndGgsXG4gICAgICAgIGluZGV4LCBjdXJyZW50S2V5O1xuICAgIGZvciAoaW5kZXggPSAwOyBpbmRleCA8IGxlbmd0aDsgaW5kZXgrKykge1xuICAgICAgICBjdXJyZW50S2V5ID0ga2V5cyA/IGtleXNbaW5kZXhdIDogaW5kZXg7XG4gICAgICAgIGlmIChwcmVkaWNhdGUob2JqW2N1cnJlbnRLZXldLCBjdXJyZW50S2V5LCBvYmopKSByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xufTtcblxuXG4vLyBFeHRlbmQgYSBnaXZlbiBvYmplY3Qgd2l0aCBhbGwgdGhlIHByb3BlcnRpZXMgaW4gcGFzc2VkLWluIG9iamVjdChzKS5cbl8uZXh0ZW5kID0gZnVuY3Rpb24gKG9iaikge1xuICAgIGlmICghXy5pc09iamVjdChvYmopKSByZXR1cm4gb2JqO1xuICAgIHZhciBzb3VyY2UsIHByb3A7XG4gICAgZm9yICh2YXIgaSA9IDEsIGxlbmd0aCA9IGFyZ3VtZW50cy5sZW5ndGg7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgICBzb3VyY2UgPSBhcmd1bWVudHNbaV07XG4gICAgICAgIGZvciAocHJvcCBpbiBzb3VyY2UpIHtcbiAgICAgICAgICAgIC8vbm9pbnNwZWN0aW9uIEpTVW5maWx0ZXJlZEZvckluTG9vcFxuICAgICAgICAgICAgaWYgKGhhc093blByb3BlcnR5LmNhbGwoc291cmNlLCBwcm9wKSkge1xuICAgICAgICAgICAgICAgIC8vbm9pbnNwZWN0aW9uIEpTVW5maWx0ZXJlZEZvckluTG9vcFxuICAgICAgICAgICAgICAgIG9ialtwcm9wXSA9IHNvdXJjZVtwcm9wXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gb2JqO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBfOyIsIi8qKlxuICogRGVzY3JpcHRvcnMgZGVhbCB3aXRoIHRoZSBkZXNjcmlwdGlvbiBvZiBIVFRQIHJlcXVlc3RzIGFuZCBhcmUgdXNlZCBieSBTaWVzdGEgdG8gZGV0ZXJtaW5lIHdoYXQgdG8gZG9cbiAqIHdpdGggSFRUUCByZXF1ZXN0L3Jlc3BvbnNlIGJvZGllcy5cbiAqIEBtb2R1bGUgaHR0cFxuICovXG5cbnZhciBfaW50ZXJuYWwgPSBzaWVzdGEuX2ludGVybmFsLFxuICAgIGxvZyA9IF9pbnRlcm5hbC5sb2csXG4gICAgSW50ZXJuYWxTaWVzdGFFcnJvciA9IF9pbnRlcm5hbC5lcnJvci5JbnRlcm5hbFNpZXN0YUVycm9yLFxuICAgIHV0aWwgPSBfaW50ZXJuYWwudXRpbCxcbiAgICBhc3NlcnQgPSB1dGlsLmFzc2VydCxcbiAgICBkZWZpbmVTdWJQcm9wZXJ0eSA9IHV0aWwuZGVmaW5lU3ViUHJvcGVydHksXG4gICAgQ29sbGVjdGlvblJlZ2lzdHJ5ID0gX2ludGVybmFsLkNvbGxlY3Rpb25SZWdpc3RyeSxcbiAgICBleHRlbmQgPSBfaW50ZXJuYWwuZXh0ZW5kLFxuICAgIF8gPSB1dGlsLl87XG5cbnZhciBMb2dnZXIgPSBsb2cubG9nZ2VyV2l0aE5hbWUoJ0Rlc2NyaXB0b3InKTtcblxudmFyIGh0dHBNZXRob2RzID0gWydQT1NUJywgJ1BBVENIJywgJ1BVVCcsICdIRUFEJywgJ0dFVCcsICdERUxFVEUnLCAnT1BUSU9OUycsICdUUkFDRScsICdDT05ORUNUJ107XG5cbmZ1bmN0aW9uIHJlc29sdmVNZXRob2QobWV0aG9kcykge1xuICAgIC8vIENvbnZlcnQgd2lsZGNhcmRzIGludG8gbWV0aG9kcyBhbmQgZW5zdXJlIGlzIGFuIGFycmF5IG9mIHVwcGVyY2FzZSBtZXRob2RzLlxuICAgIGlmIChtZXRob2RzKSB7XG4gICAgICAgIGlmIChtZXRob2RzID09ICcqJyB8fCBtZXRob2RzLmluZGV4T2YoJyonKSA+IC0xKSB7XG4gICAgICAgICAgICBtZXRob2RzID0gaHR0cE1ldGhvZHM7XG4gICAgICAgIH0gZWxzZSBpZiAoIXV0aWwuaXNBcnJheShtZXRob2RzKSkge1xuICAgICAgICAgICAgbWV0aG9kcyA9IFttZXRob2RzXTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIG1ldGhvZHMgPSBbJ0dFVCddO1xuICAgIH1cbiAgICByZXR1cm4gXy5tYXAobWV0aG9kcywgZnVuY3Rpb24gKHgpIHtcbiAgICAgICAgcmV0dXJuIHgudG9VcHBlckNhc2UoKVxuICAgIH0pO1xufVxuXG4vKipcbiAqIEEgZGVzY3JpcHRvciAnZGVzY3JpYmVzJyBwb3NzaWJsZSBIVFRQIHJlcXVlc3RzIGFnYWluc3QgYW4gQVBJLCBhbmQgaXMgdXNlZCB0byBkZWNpZGUgd2hldGhlciBvciBub3QgdG9cbiAqIGludGVyY2VwdCBhIEhUVFAgcmVxdWVzdC9yZXNwb25zZSBhbmQgcGVyZm9ybSBhIG1hcHBpbmcuXG4gKlxuICogQGNvbnN0cnVjdG9yXG4gKiBAcGFyYW0ge09iamVjdH0gb3B0c1xuICovXG5mdW5jdGlvbiBEZXNjcmlwdG9yKG9wdHMpIHtcbiAgICBpZiAoIXRoaXMpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBEZXNjcmlwdG9yKG9wdHMpO1xuICAgIH1cblxuICAgIHRoaXMuX3Jhd09wdHMgPSBleHRlbmQodHJ1ZSwge30sIG9wdHMpO1xuICAgIHRoaXMuX29wdHMgPSBvcHRzO1xuXG4gICAgdmFyIHByb2Nlc3NQYXRoID0gZnVuY3Rpb24gKHJhdykge1xuICAgICAgICBpZiAoIShyYXcgaW5zdGFuY2VvZiBSZWdFeHApKSB7XG4gICAgICAgICAgICByYXcgPSBuZXcgUmVnRXhwKHJhdywgJ2cnKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmF3O1xuICAgIH0uYmluZCh0aGlzKTtcblxuICAgIGlmICh0aGlzLl9vcHRzLnBhdGgpIHtcbiAgICAgICAgdmFyIHBhdGhzID0gdGhpcy5fb3B0cy5wYXRoO1xuICAgICAgICBpZiAoIXV0aWwuaXNBcnJheShwYXRocykpIHtcbiAgICAgICAgICAgIHBhdGhzID0gW3BhdGhzXTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX29wdHMucGF0aCA9IFtdO1xuXG4gICAgICAgIF8uZWFjaChwYXRocywgZnVuY3Rpb24gKHApIHtcbiAgICAgICAgICAgIHRoaXMuX29wdHMucGF0aC5wdXNoKHByb2Nlc3NQYXRoLmNhbGwodGhpcywgcCkpO1xuICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuX29wdHMucGF0aCA9IFsnJ107XG4gICAgfVxuXG4gICAgdGhpcy5fb3B0cy5tZXRob2QgPSByZXNvbHZlTWV0aG9kKHRoaXMuX29wdHMubWV0aG9kKTtcblxuICAgIC8vdGhpcy5fcmVzb2x2ZUNvbGxlY3Rpb25BbmRNb2RlbCgpO1xuXG4gICAgLy8gSWYga2V5IHBhdGgsIGNvbnZlcnQgZGF0YSBrZXkgcGF0aCBpbnRvIGFuIG9iamVjdCB0aGF0IHdlIGNhbiB0aGVuIHVzZSB0byB0cmF2ZXJzZSB0aGUgSFRUUCBib2RpZXMuXG4gICAgLy8gb3RoZXJ3aXNlIGxlYXZlIGFzIHN0cmluZyBvciB1bmRlZmluZWQuXG4gICAgdmFyIGRhdGEgPSB0aGlzLl9vcHRzLmRhdGE7XG4gICAgaWYgKGRhdGEpIHtcbiAgICAgICAgaWYgKGRhdGEubGVuZ3RoKSB7XG4gICAgICAgICAgICB2YXIgcm9vdDtcbiAgICAgICAgICAgIHZhciBhcnIgPSBkYXRhLnNwbGl0KCcuJyk7XG4gICAgICAgICAgICBpZiAoYXJyLmxlbmd0aCA9PSAxKSB7XG4gICAgICAgICAgICAgICAgcm9vdCA9IGFyclswXTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdmFyIG9iaiA9IHt9O1xuICAgICAgICAgICAgICAgIHJvb3QgPSBvYmo7XG4gICAgICAgICAgICAgICAgdmFyIHByZXZpb3VzS2V5ID0gYXJyWzBdO1xuICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAxOyBpIDwgYXJyLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBrZXkgPSBhcnJbaV07XG4gICAgICAgICAgICAgICAgICAgIGlmIChpID09IChhcnIubGVuZ3RoIC0gMSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG9ialtwcmV2aW91c0tleV0gPSBrZXk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgbmV3VmFyID0ge307XG4gICAgICAgICAgICAgICAgICAgICAgICBvYmpbcHJldmlvdXNLZXldID0gbmV3VmFyO1xuICAgICAgICAgICAgICAgICAgICAgICAgb2JqID0gbmV3VmFyO1xuICAgICAgICAgICAgICAgICAgICAgICAgcHJldmlvdXNLZXkgPSBrZXk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLl9vcHRzLmRhdGEgPSByb290O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQG5hbWUgcGF0aFxuICAgICAqIEB0eXBlIHtTdHJpbmd9XG4gICAgICovXG4gICAgZGVmaW5lU3ViUHJvcGVydHkuY2FsbCh0aGlzLCAncGF0aCcsIHRoaXMuX29wdHMpO1xuICAgIGRlZmluZVN1YlByb3BlcnR5LmNhbGwodGhpcywgJ21ldGhvZCcsIHRoaXMuX29wdHMpO1xuICAgIGRlZmluZVN1YlByb3BlcnR5LmNhbGwodGhpcywgJ2RhdGEnLCB0aGlzLl9vcHRzKTtcbiAgICBkZWZpbmVTdWJQcm9wZXJ0eS5jYWxsKHRoaXMsICd0cmFuc2Zvcm1zJywgdGhpcy5fb3B0cyk7XG59XG5cbl8uZXh0ZW5kKERlc2NyaXB0b3IucHJvdG90eXBlLCB7XG4gICAgaHR0cE1ldGhvZHM6IGh0dHBNZXRob2RzLFxuICAgIF9yZXNvbHZlQ29sbGVjdGlvbkFuZE1vZGVsOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBjb2xsZWN0aW9uO1xuICAgICAgICB2YXIgcmF3Q29sbGVjdGlvbiA9IHRoaXMuX29wdHMuY29sbGVjdGlvbixcbiAgICAgICAgICAgIHJhd01vZGVsID0gdGhpcy5fb3B0cy5tb2RlbDtcbiAgICAgICAgY29uc29sZS5sb2coJ3Jhd0NvbGxlY3Rpb24nLCByYXdDb2xsZWN0aW9uKTtcbiAgICAgICAgY29uc29sZS5sb2coJ3Jhd01vZGVsJywgcmF3TW9kZWwpO1xuICAgICAgICBpZiAocmF3Q29sbGVjdGlvbikge1xuICAgICAgICAgICAgaWYgKHR5cGVvZiByYXdDb2xsZWN0aW9uID09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgICAgY29sbGVjdGlvbiA9IENvbGxlY3Rpb25SZWdpc3RyeVtyYXdDb2xsZWN0aW9uXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbGxlY3Rpb24gPSByYXdDb2xsZWN0aW9uO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKHJhd01vZGVsICYmICF1dGlsLmlzU3RyaW5nKHJhd01vZGVsKSkge1xuICAgICAgICAgICAgY29sbGVjdGlvbiA9IHJhd01vZGVsLmNvbGxlY3Rpb247XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gJ011c3QgcGFzcyBjb2xsZWN0aW9uIG9yIGEgbW9kZWwgb2JqZWN0JztcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBhY3R1YWxNb2RlbDtcbiAgICAgICAgLy8gTWFwcGluZ3MgY2FuIGJlIHBhc3NlZCBhcyB0aGUgYWN0dWFsIG1hcHBpbmcgb2JqZWN0IG9yIGFzIGEgc3RyaW5nICh3aXRoIEFQSSBzcGVjaWZpZWQgdG9vKVxuICAgICAgICBpZiAocmF3TW9kZWwpIHtcbiAgICAgICAgICAgIGlmICh1dGlsLmlzU3RyaW5nKHJhd01vZGVsKSkge1xuICAgICAgICAgICAgICAgIGFjdHVhbE1vZGVsID0gY29sbGVjdGlvbi5fbW9kZWxzW3Jhd01vZGVsXTtcbiAgICAgICAgICAgICAgICBpZiAoYWN0dWFsTW9kZWwpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fb3B0cy5tb2RlbCA9IGFjdHVhbE1vZGVsO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiAnTW9kZWwgJyArIHJhd01vZGVsICsgJyBkb2VzIG5vdCBleGlzdCBpbiBjb2xsZWN0aW9uJztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZiAocmF3TW9kZWwuY29sbGVjdGlvbiAhPSBjb2xsZWN0aW9uKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiAnUGFzc2VkIG1vZGVsIGlzIG5vdCBwYXJ0IG9mIHRoZSBwYXNzZWQgY29sbGVjdGlvbic7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGFjdHVhbE1vZGVsID0gcmF3TW9kZWw7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gJ0Rlc2NyaXB0b3JzIG11c3QgYmUgaW5pdGlhbGlzZWQgd2l0aCBhIG1vZGVsJztcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMubW9kZWwgPSBhY3R1YWxNb2RlbDtcbiAgICAgICAgdGhpcy5jb2xsZWN0aW9uID0gY29sbGVjdGlvbjtcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIFRha2VzIGEgcmVnZXggcGF0aCBhbmQgcmV0dXJucyB0cnVlIGlmIG1hdGNoZWRcbiAgICAgKlxuICAgICAqIEBwYXJhbSAge1N0cmluZ30gcGF0aFxuICAgICAqIEByZXR1cm4ge2Jvb2xlYW59XG4gICAgICogQGludGVybmFsXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBgYGBqc1xuICAgICAqIHZhciBkID0gbmV3IERlc2NyaXB0b3Ioe1xuICAgICAqICAgICBwYXRoOiAnL3Jlc291cmNlLyg/UDxpZD4pLydcbiAgICAgKiB9KVxuICAgICAqIHZhciBtYXRjaGVkID0gZC5fbWF0Y2hQYXRoKCcvcmVzb3VyY2UvMicpO1xuICAgICAqIGNvbnNvbGUubG9nKG1hdGNoZWQpOyAvLyB7aWQ6ICcyJ31cbiAgICAgKiBgYGBcbiAgICAgKi9cbiAgICBfbWF0Y2hQYXRoOiBmdW5jdGlvbiAocGF0aCkge1xuICAgICAgICB2YXIgaTtcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IHRoaXMuX29wdHMucGF0aC5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdmFyIHJlZ0V4cCA9IHRoaXMuX29wdHMucGF0aFtpXTtcbiAgICAgICAgICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKVxuICAgICAgICAgICAgICAgIExvZ2dlci50cmFjZSgnTWF0Y2hpbmcgcGF0aCcsIHBhdGgsIHJlZ0V4cC50b1N0cmluZygpKTtcbiAgICAgICAgICAgIHZhciBtYXRjaGVkID0gcmVnRXhwLmV4ZWMocGF0aCk7XG4gICAgICAgICAgICBpZiAoTG9nZ2VyLnRyYWNlLmlzRW5hYmxlZCkge1xuICAgICAgICAgICAgICAgIGlmIChtYXRjaGVkKSB7XG4gICAgICAgICAgICAgICAgICAgIExvZ2dlci50cmFjZSgnTWF0Y2hlZCBwYXRoIHN1Y2Nlc3NmdWxseScsIHBhdGgsIHJlZ0V4cC50b1N0cmluZygpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIExvZ2dlci50cmFjZSgnRmFpbGVkIHRvIG1hdGNoIHBhdGgnLCBwYXRoLCByZWdFeHAudG9TdHJpbmcoKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKG1hdGNoZWQpIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0cnVlIGlmIHRoZSBkZXNjcmlwdG9yIGFjY2VwdHMgdGhlIEhUVFAgbWV0aG9kLlxuICAgICAqXG4gICAgICogQHBhcmFtICB7U3RyaW5nfSBtZXRob2RcbiAgICAgKiBAcmV0dXJuIHtib29sZWFufVxuICAgICAqIEBpbnRlcm5hbFxuICAgICAqIEBleGFtcGxlXG4gICAgICogYGBganNcbiAgICAgKiB2YXIgZCA9IG5ldyBEZXNjcmlwdG9yKHtcbiAgICAgKiAgICAgbWV0aG9kOiBbJ1BPU1QnLCAnUFVUJ11cbiAgICAgKiB9KTtcbiAgICAgKiBjb25zb2xlLmxvZyhkLl9tYXRjaE1ldGhvZCgnR0VUJykpOyAvLyBmYWxzZVxuICAgICAqIGBgYFxuICAgICAqL1xuICAgIF9tYXRjaE1ldGhvZDogZnVuY3Rpb24gKG1ldGhvZCkge1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMubWV0aG9kLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAobWV0aG9kLnRvVXBwZXJDYXNlKCkgPT0gdGhpcy5tZXRob2RbaV0pIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBQZXJmb3JtcyBhIGJyZWFkdGgtZmlyc3Qgc2VhcmNoIHRocm91Z2ggZGF0YSwgZW1iZWRkaW5nIG9iaiBpbiB0aGUgZmlyc3QgbGVhZi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSAge09iamVjdH0gb2JqXG4gICAgICogQHBhcmFtICB7T2JqZWN0fSBkYXRhXG4gICAgICogQHJldHVybiB7T2JqZWN0fVxuICAgICAqL1xuICAgIGJ1cnk6IGZ1bmN0aW9uIChvYmosIGRhdGEpIHtcbiAgICAgICAgdmFyIHJvb3QgPSBkYXRhO1xuICAgICAgICB2YXIga2V5cyA9IE9iamVjdC5rZXlzKGRhdGEpO1xuICAgICAgICBhc3NlcnQoa2V5cy5sZW5ndGggPT0gMSk7XG4gICAgICAgIHZhciBrZXkgPSBrZXlzWzBdO1xuICAgICAgICB2YXIgY3VyciA9IGRhdGE7XG4gICAgICAgIHdoaWxlICghKHR5cGVvZihjdXJyW2tleV0pID09ICdzdHJpbmcnKSkge1xuICAgICAgICAgICAgY3VyciA9IGN1cnJba2V5XTtcbiAgICAgICAgICAgIGtleXMgPSBPYmplY3Qua2V5cyhjdXJyKTtcbiAgICAgICAgICAgIGFzc2VydChrZXlzLmxlbmd0aCA9PSAxKTtcbiAgICAgICAgICAgIGtleSA9IGtleXNbMF07XG4gICAgICAgIH1cbiAgICAgICAgdmFyIG5ld1BhcmVudCA9IGN1cnJba2V5XTtcbiAgICAgICAgdmFyIG5ld09iaiA9IHt9O1xuICAgICAgICBjdXJyW2tleV0gPSBuZXdPYmo7XG4gICAgICAgIG5ld09ialtuZXdQYXJlbnRdID0gb2JqO1xuICAgICAgICByZXR1cm4gcm9vdDtcbiAgICB9LFxuICAgIF9lbWJlZERhdGE6IGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgICAgIGlmICh0aGlzLmRhdGEpIHtcbiAgICAgICAgICAgIHZhciBuZXN0ZWQ7XG4gICAgICAgICAgICBpZiAodHlwZW9mKHRoaXMuZGF0YSkgPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICBuZXN0ZWQgPSB7fTtcbiAgICAgICAgICAgICAgICBuZXN0ZWRbdGhpcy5kYXRhXSA9IGRhdGE7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIG5lc3RlZCA9IHRoaXMuYnVyeShkYXRhLCBleHRlbmQodHJ1ZSwge30sIHRoaXMuZGF0YSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIG5lc3RlZDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBkYXRhO1xuICAgICAgICB9XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBJZiBuZXN0ZWQgZGF0YSBoYXMgYmVlbiBzcGVjaWZpZWQgaW4gdGhlIGRlc2NyaXB0b3IsIGV4dHJhY3QgdGhlIGRhdGEuXG4gICAgICogQHBhcmFtICB7T2JqZWN0fSBkYXRhXG4gICAgICogQHJldHVybiB7T2JqZWN0fVxuICAgICAqL1xuICAgIF9leHRyYWN0RGF0YTogZnVuY3Rpb24gKGRhdGEpIHtcbiAgICAgICAgaWYgKExvZ2dlci5kZWJ1Zy5pc0VuYWJsZWQpXG4gICAgICAgICAgICBMb2dnZXIuZGVidWcoJ19leHRyYWN0RGF0YScsIGRhdGEpO1xuICAgICAgICBpZiAodGhpcy5kYXRhKSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mKHRoaXMuZGF0YSkgPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZGF0YVt0aGlzLmRhdGFdO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB2YXIga2V5cyA9IE9iamVjdC5rZXlzKHRoaXMuZGF0YSk7XG4gICAgICAgICAgICAgICAgYXNzZXJ0KGtleXMubGVuZ3RoID09IDEpO1xuICAgICAgICAgICAgICAgIHZhciBjdXJyVGhlaXJzID0gZGF0YTtcbiAgICAgICAgICAgICAgICB2YXIgY3Vyck91cnMgPSB0aGlzLmRhdGE7XG4gICAgICAgICAgICAgICAgd2hpbGUgKHR5cGVvZihjdXJyT3VycykgIT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICAgICAga2V5cyA9IE9iamVjdC5rZXlzKGN1cnJPdXJzKTtcbiAgICAgICAgICAgICAgICAgICAgYXNzZXJ0KGtleXMubGVuZ3RoID09IDEpO1xuICAgICAgICAgICAgICAgICAgICB2YXIga2V5ID0ga2V5c1swXTtcbiAgICAgICAgICAgICAgICAgICAgY3Vyck91cnMgPSBjdXJyT3Vyc1trZXldO1xuICAgICAgICAgICAgICAgICAgICBjdXJyVGhlaXJzID0gY3VyclRoZWlyc1trZXldO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWN1cnJUaGVpcnMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiBjdXJyVGhlaXJzID8gY3VyclRoZWlyc1tjdXJyT3Vyc10gOiBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIGRhdGE7XG4gICAgICAgIH1cbiAgICB9LFxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdGhpcyBkZXNjcmlwdG9ycyBtYXBwaW5nIGlmIHRoZSByZXF1ZXN0IGNvbmZpZyBtYXRjaGVzLlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBjb25maWdcbiAgICAgKiBAcmV0dXJucyB7T2JqZWN0fVxuICAgICAqL1xuICAgIF9tYXRjaENvbmZpZzogZnVuY3Rpb24gKGNvbmZpZykge1xuICAgICAgICB2YXIgbWF0Y2hlcyA9IGNvbmZpZy50eXBlID8gdGhpcy5fbWF0Y2hNZXRob2QoY29uZmlnLnR5cGUpIDoge307XG4gICAgICAgIGlmIChtYXRjaGVzKSB7XG4gICAgICAgICAgICBtYXRjaGVzID0gY29uZmlnLnVybCA/IHRoaXMuX21hdGNoUGF0aChjb25maWcudXJsKSA6IHt9O1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBtYXRjaGVzO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGRhdGEgaWYgdGhlIGRhdGEgbWF0Y2hlcywgcGVyZm9ybWluZyBhbnkgZXh0cmFjdGlvbiBhcyBzcGVjaWZpZWQgaW4gb3B0cy5kYXRhXG4gICAgICpcbiAgICAgKiBAcGFyYW0gIHtPYmplY3R9IGRhdGFcbiAgICAgKiBAcmV0dXJuIHtPYmplY3R9XG4gICAgICovXG4gICAgX21hdGNoRGF0YTogZnVuY3Rpb24gKGRhdGEpIHtcbiAgICAgICAgdmFyIGV4dHJhY3RlZERhdGEgPSBudWxsO1xuICAgICAgICBpZiAodGhpcy5kYXRhKSB7XG4gICAgICAgICAgICBpZiAoZGF0YSkge1xuICAgICAgICAgICAgICAgIGV4dHJhY3RlZERhdGEgPSB0aGlzLl9leHRyYWN0RGF0YShkYXRhKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGV4dHJhY3RlZERhdGEgPSBkYXRhO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBleHRyYWN0ZWREYXRhO1xuICAgIH0sXG4gICAgLyoqXG4gICAgICogQ2hlY2sgaWYgdGhlIEhUVFAgY29uZmlnIGFuZCByZXR1cm5lZCBkYXRhIG1hdGNoIHRoaXMgZGVzY3JpcHRvciBkZWZpbml0aW9uLlxuICAgICAqXG4gICAgICogQHBhcmFtICB7T2JqZWN0fSBjb25maWcgQ29uZmlnIG9iamVjdCBmb3IgJC5hamF4IGFuZCBzaW1pbGFyXG4gICAgICogQHBhcmFtICB7T2JqZWN0fSBkYXRhXG4gICAgICogQHJldHVybiB7T2JqZWN0fSBFeHRyYWN0ZWQgZGF0YVxuICAgICAqL1xuICAgIG1hdGNoOiBmdW5jdGlvbiAoY29uZmlnLCBkYXRhKSB7XG4gICAgICAgIHZhciByZWdleE1hdGNoZXMgPSB0aGlzLl9tYXRjaENvbmZpZyhjb25maWcpO1xuICAgICAgICB2YXIgbWF0Y2hlcyA9ICEhcmVnZXhNYXRjaGVzO1xuICAgICAgICB2YXIgZXh0cmFjdGVkRGF0YSA9IGZhbHNlO1xuICAgICAgICBpZiAobWF0Y2hlcykge1xuICAgICAgICAgICAgZXh0cmFjdGVkRGF0YSA9IHRoaXMuX21hdGNoRGF0YShkYXRhKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZXh0cmFjdGVkRGF0YTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQXBwbHkgYW55IHRyYW5zZm9ybXMuXG4gICAgICogQHBhcmFtICB7T2JqZWN0fSBkYXRhIFNlcmlhbGlzZWQgZGF0YS5cbiAgICAgKiBAcmV0dXJuIHtPYmplY3R9IFNlcmlhbGlzZWQgZGF0YSB3aXRoIGFwcGxpZWQgdHJhbnNmb3JtYXRpb25zLlxuICAgICAqL1xuICAgIF90cmFuc2Zvcm1EYXRhOiBmdW5jdGlvbiAoZGF0YSkge1xuICAgICAgICB2YXIgdHJhbnNmb3JtcyA9IHRoaXMudHJhbnNmb3JtcztcbiAgICAgICAgaWYgKHR5cGVvZih0cmFuc2Zvcm1zKSA9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICBkYXRhID0gdHJhbnNmb3JtcyhkYXRhKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGZvciAodmFyIGF0dHIgaW4gdHJhbnNmb3Jtcykge1xuICAgICAgICAgICAgICAgIGlmICh0cmFuc2Zvcm1zLmhhc093blByb3BlcnR5KGF0dHIpKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChkYXRhW2F0dHJdKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgdHJhbnNmb3JtID0gdHJhbnNmb3Jtc1thdHRyXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciB2YWwgPSBkYXRhW2F0dHJdO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZih0cmFuc2Zvcm0pID09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHNwbGl0ID0gdHJhbnNmb3JtLnNwbGl0KCcuJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVsZXRlIGRhdGFbYXR0cl07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHNwbGl0Lmxlbmd0aCA9PSAxKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdGFbc3BsaXRbMF1dID0gdmFsO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdGFbc3BsaXRbMF1dID0ge307XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBuZXdWYWwgPSBkYXRhW3NwbGl0WzBdXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDE7IGkgPCBzcGxpdC5sZW5ndGggLSAxOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBuZXdBdHRyID0gc3BsaXRbaV07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBuZXdWYWxbbmV3QXR0cl0gPSB7fTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5ld1ZhbCA9IG5ld1ZhbFtuZXdBdHRyXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBuZXdWYWxbc3BsaXRbc3BsaXQubGVuZ3RoIC0gMV1dID0gdmFsO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAodHlwZW9mKHRyYW5zZm9ybSkgPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciB0cmFuc2Zvcm1lZCA9IHRyYW5zZm9ybSh2YWwpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICh1dGlsLmlzQXJyYXkodHJhbnNmb3JtZWQpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlbGV0ZSBkYXRhW2F0dHJdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkYXRhW3RyYW5zZm9ybWVkWzBdXSA9IHRyYW5zZm9ybWVkWzFdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdGFbYXR0cl0gPSB0cmFuc2Zvcm1lZDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdJbnZhbGlkIHRyYW5zZm9ybWVyJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGRhdGE7XG4gICAgfVxufSk7XG5cbmV4cG9ydHMuRGVzY3JpcHRvciA9IERlc2NyaXB0b3I7XG5leHBvcnRzLnJlc29sdmVNZXRob2QgPSByZXNvbHZlTWV0aG9kOyIsInZhciBfaW50ZXJuYWwgPSBzaWVzdGEuX2ludGVybmFsLFxuICAgIHV0aWwgPSBfaW50ZXJuYWwudXRpbCxcbiAgICBfID0gdXRpbC5fLFxuICAgIEludGVybmFsU2llc3RhRXJyb3IgPSBfaW50ZXJuYWwuZXJyb3IuSW50ZXJuYWxTaWVzdGFFcnJvcixcbiAgICBsb2cgPSBfaW50ZXJuYWwubG9nO1xuXG52YXIgTG9nZ2VyID0gbG9nLmxvZ2dlcldpdGhOYW1lKCdEZXNjcmlwdG9yJyk7XG5cbi8qKlxuICogQGNsYXNzIEVudHJ5IHBvaW50IGZvciBkZXNjcmlwdG9yIHJlZ2lzdHJhdGlvbi5cbiAqIEBjb25zdHJ1Y3RvclxuICovXG5mdW5jdGlvbiBEZXNjcmlwdG9yUmVnaXN0cnkoKSB7XG4gICAgaWYgKCF0aGlzKSB7XG4gICAgICAgIHJldHVybiBuZXcgRGVzY3JpcHRvclJlZ2lzdHJ5KG9wdHMpO1xuICAgIH1cbiAgICB0aGlzLnJlcXVlc3REZXNjcmlwdG9ycyA9IHt9O1xuICAgIHRoaXMucmVzcG9uc2VEZXNjcmlwdG9ycyA9IHt9O1xufVxuXG5mdW5jdGlvbiBfcmVnaXN0ZXJEZXNjcmlwdG9yKGRlc2NyaXB0b3JzLCBkZXNjcmlwdG9yKSB7XG4gICAgdmFyIG1vZGVsID0gZGVzY3JpcHRvci5fb3B0cy5tb2RlbCxcbiAgICAgICAgY29sbGVjdGlvbiA9IGRlc2NyaXB0b3IuX29wdHMuY29sbGVjdGlvbixcbiAgICAgICAgY29sbGVjdGlvbk5hbWU7XG4gICAgaWYgKGNvbGxlY3Rpb24pIHtcbiAgICAgICAgaWYgKHV0aWwuaXNTdHJpbmcoY29sbGVjdGlvbikpIGNvbGxlY3Rpb25OYW1lID0gY29sbGVjdGlvbjtcbiAgICAgICAgZWxzZSBjb2xsZWN0aW9uTmFtZSA9IGNvbGxlY3Rpb24ubmFtZTtcbiAgICB9XG4gICAgZWxzZSBpZiAobW9kZWwpIHtcbiAgICAgICAgaWYgKHV0aWwuaXNTdHJpbmcobW9kZWwpKSB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignTm90IGVub3VnaCBpbmZvcm1hdGlvbiB0byByZWdpc3RlciB0aGUgZGVzY3JpcHRvcicpO1xuICAgICAgICBlbHNlIGNvbGxlY3Rpb25OYW1lID0gbW9kZWwuY29sbGVjdGlvbi5uYW1lO1xuICAgIH1cbiAgICBpZiAoIWRlc2NyaXB0b3JzW2NvbGxlY3Rpb25OYW1lXSkge1xuICAgICAgICBkZXNjcmlwdG9yc1tjb2xsZWN0aW9uTmFtZV0gPSBbXTtcbiAgICB9XG4gICAgZGVzY3JpcHRvcnNbY29sbGVjdGlvbk5hbWVdLnB1c2goZGVzY3JpcHRvcik7XG59XG5cbmZ1bmN0aW9uIF9kZXNjcmlwdG9yc0ZvckNvbGxlY3Rpb24oZGVzY3JpcHRvcnMsIGNvbGxlY3Rpb24pIHtcbiAgICB2YXIgZGVzY3JpcHRvcnNGb3JDb2xsZWN0aW9uO1xuICAgIGlmICh0eXBlb2YoY29sbGVjdGlvbikgPT0gJ3N0cmluZycpIHtcbiAgICAgICAgZGVzY3JpcHRvcnNGb3JDb2xsZWN0aW9uID0gZGVzY3JpcHRvcnNbY29sbGVjdGlvbl0gfHwgW107XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICBkZXNjcmlwdG9yc0ZvckNvbGxlY3Rpb24gPSAoZGVzY3JpcHRvcnNbY29sbGVjdGlvbi5uYW1lXSB8fCBbXSk7XG4gICAgfVxuICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKSB7XG4gICAgICAgIExvZ2dlci50cmFjZSgnX2Rlc2NyaXB0b3JzRm9yQ29sbGVjdGlvbicsIHtcbiAgICAgICAgICAgIGNvbGxlY3Rpb246IGNvbGxlY3Rpb24sXG4gICAgICAgICAgICBhbGxEZXNjcmlwdG9yczogZGVzY3JpcHRvcnMsXG4gICAgICAgICAgICBkZXNjcmlwdG9yczogZGVzY3JpcHRvcnNGb3JDb2xsZWN0aW9uXG4gICAgICAgIH0pXG4gICAgfVxuICAgIHJldHVybiBkZXNjcmlwdG9yc0ZvckNvbGxlY3Rpb247XG59XG5cblxuXy5leHRlbmQoRGVzY3JpcHRvclJlZ2lzdHJ5LnByb3RvdHlwZSwge1xuICAgIHJlZ2lzdGVyUmVxdWVzdERlc2NyaXB0b3I6IGZ1bmN0aW9uIChyZXF1ZXN0RGVzY3JpcHRvcikge1xuICAgICAgICBfcmVnaXN0ZXJEZXNjcmlwdG9yKHRoaXMucmVxdWVzdERlc2NyaXB0b3JzLCByZXF1ZXN0RGVzY3JpcHRvcik7XG4gICAgfSxcbiAgICByZWdpc3RlclJlc3BvbnNlRGVzY3JpcHRvcjogZnVuY3Rpb24gKHJlc3BvbnNlRGVzY3JpcHRvcikge1xuICAgICAgICBpZiAoTG9nZ2VyLnRyYWNlLmlzRW5hYmxlZClcbiAgICAgICAgICAgIExvZ2dlci50cmFjZSgncmVnaXN0ZXJSZXNwb25zZURlc2NyaXB0b3InKTtcbiAgICAgICAgX3JlZ2lzdGVyRGVzY3JpcHRvcih0aGlzLnJlc3BvbnNlRGVzY3JpcHRvcnMsIHJlc3BvbnNlRGVzY3JpcHRvcik7XG4gICAgfSxcbiAgICByZXF1ZXN0RGVzY3JpcHRvcnNGb3JDb2xsZWN0aW9uOiBmdW5jdGlvbiAoY29sbGVjdGlvbikge1xuICAgICAgICByZXR1cm4gX2Rlc2NyaXB0b3JzRm9yQ29sbGVjdGlvbih0aGlzLnJlcXVlc3REZXNjcmlwdG9ycywgY29sbGVjdGlvbik7XG4gICAgfSxcbiAgICByZXNwb25zZURlc2NyaXB0b3JzRm9yQ29sbGVjdGlvbjogZnVuY3Rpb24gKGNvbGxlY3Rpb24pIHtcbiAgICAgICAgdmFyIGRlc2NyaXB0b3JzRm9yQ29sbGVjdGlvbiA9IF9kZXNjcmlwdG9yc0ZvckNvbGxlY3Rpb24odGhpcy5yZXNwb25zZURlc2NyaXB0b3JzLCBjb2xsZWN0aW9uKTtcbiAgICAgICAgaWYgKCFkZXNjcmlwdG9yc0ZvckNvbGxlY3Rpb24ubGVuZ3RoKSB7XG4gICAgICAgICAgICBpZiAoTG9nZ2VyLmRlYnVnLmlzRW5hYmxlZClcbiAgICAgICAgICAgICAgICBMb2dnZXIuZGVidWcoJ05vIHJlc3BvbnNlIGRlc2NyaXB0b3JzIGZvciBjb2xsZWN0aW9uICcsIHtjb2xsZWN0aW9uOiBjb2xsZWN0aW9ufSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGRlc2NyaXB0b3JzRm9yQ29sbGVjdGlvbjtcbiAgICB9LFxuICAgIHJlc2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRoaXMucmVxdWVzdERlc2NyaXB0b3JzID0ge307XG4gICAgICAgIHRoaXMucmVzcG9uc2VEZXNjcmlwdG9ycyA9IHt9O1xuICAgIH1cbn0pO1xuXG5leHBvcnRzLkRlc2NyaXB0b3JSZWdpc3RyeSA9IG5ldyBEZXNjcmlwdG9yUmVnaXN0cnkoKTsiLCIvKipcbiAqIFByb3Zpc2lvbnMgdXNhZ2Ugb2YgJC5hamF4IGFuZCBzaW1pbGFyIGZ1bmN0aW9ucyB0byBzZW5kIEhUVFAgcmVxdWVzdHMgbWFwcGluZ1xuICogdGhlIHJlc3VsdHMgYmFjayBvbnRvIHRoZSBvYmplY3QgZ3JhcGggYXV0b21hdGljYWxseS5cbiAqIEBtb2R1bGUgaHR0cFxuICovXG5cbmlmICh0eXBlb2Ygc2llc3RhID09ICd1bmRlZmluZWQnICYmIHR5cGVvZiBtb2R1bGUgPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0NvdWxkIG5vdCBmaW5kIHdpbmRvdy5zaWVzdGEuIE1ha2Ugc3VyZSB5b3UgaW5jbHVkZSBzaWVzdGEuY29yZS5qcyBmaXJzdC4nKTtcbn1cblxudmFyIF9pbnRlcm5hbCA9IHNpZXN0YS5faW50ZXJuYWwsXG4gICAgQ29sbGVjdGlvbiA9IF9pbnRlcm5hbC5Db2xsZWN0aW9uLFxuICAgIGxvZyA9IF9pbnRlcm5hbC5sb2csXG4gICAgdXRpbCA9IF9pbnRlcm5hbC51dGlsLFxuICAgIGVycm9yID0gX2ludGVybmFsLmVycm9yLFxuICAgIF8gPSB1dGlsLl8sXG4gICAgZGVzY3JpcHRvciA9IHJlcXVpcmUoJy4vZGVzY3JpcHRvcicpLFxuICAgIEludGVybmFsU2llc3RhRXJyb3IgPSBfaW50ZXJuYWwuZXJyb3IuSW50ZXJuYWxTaWVzdGFFcnJvcjtcblxudmFyIERlc2NyaXB0b3JSZWdpc3RyeSA9IHJlcXVpcmUoJy4vZGVzY3JpcHRvclJlZ2lzdHJ5JykuRGVzY3JpcHRvclJlZ2lzdHJ5O1xuXG5cbnZhciBMb2dnZXIgPSBsb2cubG9nZ2VyV2l0aE5hbWUoJ0hUVFAnKTtcblxuLyoqXG4gKiBMb2cgYSBIVFRQIHJlc3BvbnNlXG4gKiBAcGFyYW0gb3B0c1xuICogQHBhcmFtIHhoclxuICogQHBhcmFtIFtkYXRhXSAtIFJhdyBkYXRhIHJlY2VpdmVkIGluIEhUVFAgcmVzcG9uc2UuXG4gKi9cbmZ1bmN0aW9uIGxvZ0h0dHBSZXNwb25zZShvcHRzLCB4aHIsIGRhdGEpIHtcbiAgICBpZiAoTG9nZ2VyLmRlYnVnLmlzRW5hYmxlZCkge1xuICAgICAgICB2YXIgbG9nZ2VyID0gTG9nZ2VyLmRlYnVnO1xuICAgICAgICB2YXIgbG9nTWVzc2FnZSA9IG9wdHMudHlwZSArICcgJyArIHhoci5zdGF0dXMgKyAnICcgKyBvcHRzLnVybDtcbiAgICAgICAgaWYgKExvZ2dlci50cmFjZS5pc0VuYWJsZWQgJiYgZGF0YSkge1xuICAgICAgICAgICAgbG9nZ2VyID0gTG9nZ2VyLnRyYWNlO1xuICAgICAgICAgICAgbG9nTWVzc2FnZSArPSAnOiAnICsgdXRpbC5wcmV0dHlQcmludChkYXRhKTtcbiAgICAgICAgfVxuICAgICAgICBsb2dnZXIobG9nTWVzc2FnZSk7XG4gICAgfVxufVxuXG4vKipcbiAqIExvZyBhIEhUVFAgcmVxdWVzdFxuICogQHBhcmFtIG9wdHNcbiAqL1xuZnVuY3Rpb24gbG9nSHR0cFJlcXVlc3Qob3B0cykge1xuICAgIGlmIChMb2dnZXIuZGVidWcuaXNFbmFibGVkKSB7XG4gICAgICAgIHZhciBsb2dnZXIgPSBMb2dnZXIuZGVidWc7XG4gICAgICAgIC8vIFRPRE86IEFwcGVuZCBxdWVyeSBwYXJhbWV0ZXJzIHRvIHRoZSBVUkwuXG4gICAgICAgIHZhciBsb2dNZXNzYWdlID0gb3B0cy50eXBlICsgJyAnICsgb3B0cy51cmw7XG4gICAgICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKSB7XG4gICAgICAgICAgICAvLyBUT0RPOiBJZiBhbnkgZGF0YSBpcyBiZWluZyBzZW50LCBsb2cgdGhhdC5cbiAgICAgICAgICAgIGxvZ2dlciA9IExvZ2dlci50cmFjZTtcbiAgICAgICAgfVxuICAgICAgICBsb2dnZXIobG9nTWVzc2FnZSk7XG4gICAgfVxufVxuXG4vKipcbiAqIFNlbmQgYSBIVFRQIHJlcXVlc3QgdG8gdGhlIGdpdmVuIG1ldGhvZCBhbmQgcGF0aCBwYXJzaW5nIHRoZSByZXNwb25zZS5cbiAqIEBwYXJhbSB7U3RyaW5nfSBtZXRob2RcbiAqIEBwYXJhbSB7U3RyaW5nfSBwYXRoIFRoZSBwYXRoIHRvIHRoZSByZXNvdXJjZSB3ZSB3YW50IHRvIEdFVFxuICogQHBhcmFtIHtPYmplY3R8RnVuY3Rpb259IG9wdHNPckNhbGxiYWNrIEVpdGhlciBhbiBvcHRpb25zIG9iamVjdCBvciBhIGNhbGxiYWNrIGlmIGNhbiB1c2UgZGVmYXVsdHNcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIENhbGxiYWNrIGlmIG9wdHMgc3BlY2lmaWVkLlxuICovXG5mdW5jdGlvbiBfaHR0cFJlc3BvbnNlKG1ldGhvZCwgcGF0aCwgb3B0c09yQ2FsbGJhY2ssIGNhbGxiYWNrKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAyKTtcbiAgICB2YXIgb3B0cyA9IHt9O1xuICAgIHZhciBuYW1lID0gdGhpcy5uYW1lO1xuICAgIGlmICh0eXBlb2YoYXJnc1swXSkgPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICBjYWxsYmFjayA9IGFyZ3NbMF07XG4gICAgfSBlbHNlIGlmICh0eXBlb2YoYXJnc1swXSkgPT0gJ29iamVjdCcpIHtcbiAgICAgICAgb3B0cyA9IGFyZ3NbMF07XG4gICAgICAgIGNhbGxiYWNrID0gYXJnc1sxXTtcbiAgICB9XG4gICAgdmFyIGRlZmVycmVkID0gdXRpbC5kZWZlcihjYWxsYmFjayk7XG4gICAgY2FsbGJhY2sgPSBkZWZlcnJlZC5maW5pc2guYmluZChkZWZlcnJlZCk7XG4gICAgc2llc3RhLl9hZnRlckluc3RhbGwoZnVuY3Rpb24gKCkge1xuICAgICAgICBvcHRzLnR5cGUgPSBtZXRob2Q7IC8vIGpxdWVyeVxuICAgICAgICBvcHRzLm1ldGhvZCA9IG1ldGhvZDsgLy8gJGh0dHBcbiAgICAgICAgaWYgKCFvcHRzLnVybCkgeyAvLyBBbGxvdyBvdmVycmlkZXMuXG4gICAgICAgICAgICB2YXIgYmFzZVVSTCA9IHRoaXMuYmFzZVVSTDtcbiAgICAgICAgICAgIG9wdHMudXJsID0gYmFzZVVSTCArIHBhdGg7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG9wdHMucGFyc2VSZXNwb25zZSA9PT0gdW5kZWZpbmVkKSBvcHRzLnBhcnNlUmVzcG9uc2UgPSB0cnVlO1xuICAgICAgICBmdW5jdGlvbiBzdWNjZXNzKGRhdGEsIHN0YXR1cywgeGhyKSB7XG4gICAgICAgICAgICBsb2dIdHRwUmVzcG9uc2Uob3B0cywgeGhyLCBkYXRhKTtcblxuICAgICAgICAgICAgaWYgKG9wdHMucGFyc2VSZXNwb25zZSkge1xuICAgICAgICAgICAgICAgIHZhciBkZXNjcmlwdG9ycyA9IERlc2NyaXB0b3JSZWdpc3RyeS5yZXNwb25zZURlc2NyaXB0b3JzRm9yQ29sbGVjdGlvbihzZWxmKTtcbiAgICAgICAgICAgICAgICB2YXIgbWF0Y2hlZERlc2NyaXB0b3I7XG4gICAgICAgICAgICAgICAgdmFyIGV4dHJhY3RlZERhdGE7XG4gICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBkZXNjcmlwdG9ycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICB2YXIgZGVzY3JpcHRvciA9IGRlc2NyaXB0b3JzW2ldO1xuICAgICAgICAgICAgICAgICAgICBleHRyYWN0ZWREYXRhID0gZGVzY3JpcHRvci5tYXRjaChvcHRzLCBkYXRhKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGV4dHJhY3RlZERhdGEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG1hdGNoZWREZXNjcmlwdG9yID0gZGVzY3JpcHRvcjtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChtYXRjaGVkRGVzY3JpcHRvcikge1xuICAgICAgICAgICAgICAgICAgICBpZiAoTG9nZ2VyLnRyYWNlLmlzRW5hYmxlZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgTG9nZ2VyLnRyYWNlKCdNb2RlbCBfY29uc3RydWN0U3ViT3BlcmF0aW9uIGRhdGE6ICcgKyB1dGlsLnByZXR0eVByaW50KGV4dHJhY3RlZERhdGEpKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mKGV4dHJhY3RlZERhdGEpID09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgTW9kZWwgPSBtYXRjaGVkRGVzY3JpcHRvci5tb2RlbDtcbiAgICAgICAgICAgICAgICAgICAgICAgIE1vZGVsLmdyYXBoKGV4dHJhY3RlZERhdGEsIHtvdmVycmlkZTogb3B0cy5vYmp9LCBmdW5jdGlvbiAoZXJyLCBvYmopIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIsIG9iaiwgZGF0YSwgeGhyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgeyAvLyBNYXRjaGVkLCBidXQgbm8gZGF0YS5cbiAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIG51bGwsIG51bGwsIHhocik7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGNhbGxiYWNrKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChuYW1lKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhudWxsLCBudWxsLCBkYXRhLCB4aHIpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gVGhlcmUgd2FzIGEgYnVnIHdoZXJlIGNvbGxlY3Rpb24gbmFtZSBkb2Vzbid0IGV4aXN0LiBJZiB0aGlzIG9jY3VycywgdGhlbiB3aWxsIG5ldmVyIGdldCBob2xkIG9mIGFueSBkZXNjcmlwdG9ycy5cbiAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdVbm5hbWVkIGNvbGxlY3Rpb24nKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2sobnVsbCwgbnVsbCwgZGF0YSwgeGhyKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gZXJyb3IoeGhyLCBzdGF0dXMsIGVycm9yKSB7XG4gICAgICAgICAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKGVycm9yLCBudWxsLCBudWxsLCB4aHIpO1xuICAgICAgICB9XG5cbiAgICAgICAgbG9nSHR0cFJlcXVlc3Qob3B0cyk7XG4gICAgICAgIHZhciBhamF4ID0gc2llc3RhLmV4dC5odHRwLmFqYXg7XG4gICAgICAgIGlmIChhamF4KSB7XG4gICAgICAgICAgICB2YXIgcHJvbWlzZSA9IGFqYXgob3B0cyk7XG4gICAgICAgICAgICBpZiAocHJvbWlzZS5zdWNjZXNzKSB7IC8vICRodHRwIGFuZCBqcXVlcnkgPDEuOFxuICAgICAgICAgICAgICAgIHByb21pc2Uuc3VjY2VzcyhzdWNjZXNzKTtcbiAgICAgICAgICAgICAgICBwcm9taXNlLmVycm9yKGVycm9yKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKHByb21pc2UuZG9uZSkgeyAvLyBqcXVlcnkgPj0gMS44XG4gICAgICAgICAgICAgICAgcHJvbWlzZS5kb25lKHN1Y2Nlc3MpO1xuICAgICAgICAgICAgICAgIHByb21pc2UuZmFpbChlcnJvcik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjaygnSW5jb21wYXRpYmxlIGFqYXggZnVuY3Rpb24uIENvdWxkIG5vdCBmaW5kIHN1Y2Nlc3MvZmFpbCBtZXRob2RzIG9uIHJldHVybmVkIHByb21pc2UuJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBjYWxsYmFjaygnTm8gYWpheCBmdW5jdGlvbi4gRW5zdXJlIHRoYXQgZWl0aGVyICQuYWpheCBpcyBhdmFpbGFibGUsIG9yIGNhbGwgc2llc3RhLnNldEFqYXgoYWpheCkgd2l0aCBhIGNvbXBhdGlibGUgYWpheCBmdW5jdGlvbiBlLmcuIHplcHRvLCBqcXVlcnksICRodHRwJylcbiAgICAgICAgfVxuICAgIH0uYmluZCh0aGlzKSk7XG4gICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG59XG5cbmZ1bmN0aW9uIF9zZXJpYWxpc2VPYmplY3Qob3B0cywgb2JqLCBjYikge1xuICAgIHRoaXMuX3NlcmlhbGlzZShvYmosIGZ1bmN0aW9uIChlcnIsIGRhdGEpIHtcbiAgICAgICAgdmFyIHJldERhdGEgPSBkYXRhO1xuICAgICAgICBpZiAob3B0cy5maWVsZHMpIHtcbiAgICAgICAgICAgIHJldERhdGEgPSB7fTtcbiAgICAgICAgICAgIF8uZWFjaChvcHRzLmZpZWxkcywgZnVuY3Rpb24gKGYpIHtcbiAgICAgICAgICAgICAgICByZXREYXRhW2ZdID0gZGF0YVtmXTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGNiKGVyciwgcmV0RGF0YSk7XG4gICAgfSk7XG59XG5cbi8qKlxuICogU2VuZCBhIEhUVFAgcmVxdWVzdCB0byB0aGUgZ2l2ZW4gbWV0aG9kIGFuZCBwYXRoXG4gKiBAcGFyYW0ge1N0cmluZ30gbWV0aG9kXG4gKiBAcGFyYW0ge1N0cmluZ30gcGF0aCBUaGUgcGF0aCB0byB0aGUgcmVzb3VyY2Ugd2Ugd2FudCB0byBHRVRcbiAqIEBwYXJhbSB7TW9kZWxJbnN0YW5jZX0gb2JqZWN0IFRoZSBtb2RlbCB3ZSdyZSBwdXNoaW5nIHRvIHRoZSBzZXJ2ZXJcbiAqIEBwYXJhbSB7T2JqZWN0fEZ1bmN0aW9ufSBvcHRzT3JDYWxsYmFjayBFaXRoZXIgYW4gb3B0aW9ucyBvYmplY3Qgb3IgYSBjYWxsYmFjayBpZiBjYW4gdXNlIGRlZmF1bHRzXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBDYWxsYmFjayBpZiBvcHRzIHNwZWNpZmllZC5cbiAqL1xuZnVuY3Rpb24gX2h0dHBSZXF1ZXN0KG1ldGhvZCwgcGF0aCwgb2JqZWN0KSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAzKTtcbiAgICB2YXIgY2FsbGJhY2s7XG4gICAgdmFyIG9wdHMgPSB7fTtcbiAgICBpZiAodHlwZW9mKGFyZ3NbMF0pID09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgY2FsbGJhY2sgPSBhcmdzWzBdO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mKGFyZ3NbMF0pID09ICdvYmplY3QnKSB7XG4gICAgICAgIG9wdHMgPSBhcmdzWzBdO1xuICAgICAgICBjYWxsYmFjayA9IGFyZ3NbMV07XG4gICAgfVxuICAgIHZhciBkZWZlcnJlZCA9IHV0aWwuZGVmZXIoY2FsbGJhY2spO1xuICAgIGNhbGxiYWNrID0gZGVmZXJyZWQuZmluaXNoLmJpbmQoZGVmZXJyZWQpO1xuICAgIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmdzLCAyKTtcbiAgICB2YXIgcmVxdWVzdERlc2NyaXB0b3JzID0gRGVzY3JpcHRvclJlZ2lzdHJ5LnJlcXVlc3REZXNjcmlwdG9yc0ZvckNvbGxlY3Rpb24odGhpcyk7XG4gICAgdmFyIG1hdGNoZWREZXNjcmlwdG9yO1xuICAgIG9wdHMudHlwZSA9IG1ldGhvZDtcbiAgICB2YXIgYmFzZVVSTCA9IHRoaXMuYmFzZVVSTDtcbiAgICBvcHRzLnVybCA9IGJhc2VVUkwgKyBwYXRoO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcmVxdWVzdERlc2NyaXB0b3JzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciByZXF1ZXN0RGVzY3JpcHRvciA9IHJlcXVlc3REZXNjcmlwdG9yc1tpXTtcbiAgICAgICAgaWYgKHJlcXVlc3REZXNjcmlwdG9yLl9tYXRjaENvbmZpZyhvcHRzKSkge1xuICAgICAgICAgICAgbWF0Y2hlZERlc2NyaXB0b3IgPSByZXF1ZXN0RGVzY3JpcHRvcjtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgfVxuICAgIGlmIChtYXRjaGVkRGVzY3JpcHRvcikge1xuICAgICAgICBpZiAoTG9nZ2VyLnRyYWNlLmlzRW5hYmxlZClcbiAgICAgICAgICAgIExvZ2dlci50cmFjZSgnTWF0Y2hlZCBkZXNjcmlwdG9yOiAnICsgbWF0Y2hlZERlc2NyaXB0b3IuX2R1bXAodHJ1ZSkpO1xuICAgICAgICBfc2VyaWFsaXNlT2JqZWN0LmNhbGwobWF0Y2hlZERlc2NyaXB0b3IsIG9iamVjdCwgb3B0cywgZnVuY3Rpb24gKGVyciwgZGF0YSkge1xuICAgICAgICAgICAgaWYgKExvZ2dlci50cmFjZS5pc0VuYWJsZWQpXG4gICAgICAgICAgICAgICAgTG9nZ2VyLnRyYWNlKCdfc2VyaWFsaXNlJywge1xuICAgICAgICAgICAgICAgICAgICBlcnI6IGVycixcbiAgICAgICAgICAgICAgICAgICAgZGF0YTogZGF0YVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2soZXJyLCBudWxsLCBudWxsKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgb3B0cy5kYXRhID0gZGF0YTtcbiAgICAgICAgICAgICAgICBvcHRzLm9iaiA9IG9iamVjdDtcbiAgICAgICAgICAgICAgICBfLnBhcnRpYWwoX2h0dHBSZXNwb25zZSwgbWV0aG9kLCBwYXRoLCBvcHRzLCBjYWxsYmFjaykuYXBwbHkoc2VsZiwgYXJncyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgfSBlbHNlIGlmIChjYWxsYmFjaykge1xuICAgICAgICBpZiAoTG9nZ2VyLnRyYWNlLmlzRW5hYmxlZClcbiAgICAgICAgICAgIExvZ2dlci50cmFjZSgnRGlkIG5vdCBtYXRjaCBkZXNjcmlwdG9yJyk7XG4gICAgICAgIGNhbGxiYWNrKCdObyBkZXNjcmlwdG9yIG1hdGNoZWQnLCBudWxsLCBudWxsKTtcbiAgICB9XG4gICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG59XG5cbi8qKlxuICogU2VuZCBhIERFTEVURSByZXF1ZXN0LiBBbHNvIHJlbW92ZXMgdGhlIG9iamVjdC5cbiAqIEBwYXJhbSB7U3RyaW5nfSBwYXRoIFRoZSBwYXRoIHRvIHRoZSByZXNvdXJjZSB0byB3aGljaCB3ZSB3YW50IHRvIERFTEVURVxuICogQHBhcmFtIHtNb2RlbEluc3RhbmNlfSBvYmplY3QgVGhlIG1vZGVsIHRoYXQgd2Ugd291bGQgbGlrZSB0byBQQVRDSFxuICogQHJldHVybnMge1Byb21pc2V9XG4gKi9cbmZ1bmN0aW9uIERFTEVURShwYXRoLCBvYmplY3QpIHtcbiAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMik7XG4gICAgdmFyIG9wdHMgPSB7fTtcbiAgICB2YXIgY2FsbGJhY2s7XG4gICAgaWYgKHR5cGVvZihhcmdzWzBdKSA9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIGNhbGxiYWNrID0gYXJnc1swXTtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZihhcmdzWzBdKSA9PSAnb2JqZWN0Jykge1xuICAgICAgICBvcHRzID0gYXJnc1swXTtcbiAgICAgICAgY2FsbGJhY2sgPSBhcmdzWzFdO1xuICAgIH1cbiAgICB2YXIgZGVmZXJyZWQgPSB1dGlsLmRlZmVyKGNhbGxiYWNrKTtcbiAgICB2YXIgZGVsZXRpb25Nb2RlID0gb3B0cy5kZWxldGlvbk1vZGUgfHwgJ3Jlc3RvcmUnO1xuICAgIC8vIEJ5IGRlZmF1bHQgd2UgZG8gbm90IG1hcCB0aGUgcmVzcG9uc2UgZnJvbSBhIERFTEVURSByZXF1ZXN0LlxuICAgIGlmIChvcHRzLnBhcnNlUmVzcG9uc2UgPT09IHVuZGVmaW5lZCkgb3B0cy5wYXJzZVJlc3BvbnNlID0gZmFsc2U7XG4gICAgX2h0dHBSZXNwb25zZS5jYWxsKHRoaXMsICdERUxFVEUnLCBwYXRoLCBvcHRzLCBmdW5jdGlvbiAoZXJyLCB4LCB5LCB6KSB7XG4gICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgIGlmIChkZWxldGlvbk1vZGUgPT0gJ3Jlc3RvcmUnKSB7XG4gICAgICAgICAgICAgICAgb2JqZWN0LnJlc3RvcmUoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChkZWxldGlvbk1vZGUgPT0gJ3N1Y2Nlc3MnKSB7XG4gICAgICAgICAgICBvYmplY3QucmVtb3ZlKCk7XG4gICAgICAgIH1cbiAgICAgICAgY2FsbGJhY2soZXJyLCB4LCB5LCB6KTtcbiAgICAgICAgZGVmZXJyZWQuZmluaXNoKGVyciwge3g6IHgsIHk6IHksIHo6IHp9KTtcbiAgICB9KTtcbiAgICBpZiAoZGVsZXRpb25Nb2RlID09ICdub3cnIHx8IGRlbGV0aW9uTW9kZSA9PSAncmVzdG9yZScpIHtcbiAgICAgICAgb2JqZWN0LnJlbW92ZSgpO1xuICAgIH1cbiAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbn1cblxuLyoqXG4gKiBTZW5kIGEgSFRUUCByZXF1ZXN0IHVzaW5nIHRoZSBnaXZlbiBtZXRob2RcbiAqIEBwYXJhbSByZXF1ZXN0IERvZXMgdGhlIHJlcXVlc3QgY29udGFpbiBkYXRhPyBlLmcuIFBPU1QvUEFUQ0gvUFVUIHdpbGwgYmUgdHJ1ZSwgR0VUIHdpbGwgZmFsc2VcbiAqIEBwYXJhbSBtZXRob2RcbiAqIEBpbnRlcm5hbFxuICogQHJldHVybnMge1Byb21pc2V9XG4gKi9cbmZ1bmN0aW9uIEhUVFBfTUVUSE9EKHJlcXVlc3QsIG1ldGhvZCkge1xuICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAyKTtcbiAgICByZXR1cm4gXy5wYXJ0aWFsKHJlcXVlc3QgPyBfaHR0cFJlcXVlc3QgOiBfaHR0cFJlc3BvbnNlLCBtZXRob2QpLmFwcGx5KHRoaXMsIGFyZ3MpO1xufVxuXG4vKipcbiAqIFNlbmQgYSBHRVQgcmVxdWVzdFxuICogQHBhcmFtIHtTdHJpbmd9IHBhdGggVGhlIHBhdGggdG8gdGhlIHJlc291cmNlIHdlIHdhbnQgdG8gR0VUXG4gKiBAcGFyYW0ge09iamVjdHxGdW5jdGlvbn0gb3B0c09yQ2FsbGJhY2sgRWl0aGVyIGFuIG9wdGlvbnMgb2JqZWN0IG9yIGEgY2FsbGJhY2sgaWYgY2FuIHVzZSBkZWZhdWx0c1xuICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgQ2FsbGJhY2sgaWYgb3B0cyBzcGVjaWZpZWQuXG4gKiBAcGFja2FnZSBIVFRQXG4gKiBAcmV0dXJucyB7UHJvbWlzZX1cbiAqL1xuZnVuY3Rpb24gR0VUKCkge1xuICAgIHJldHVybiBfLnBhcnRpYWwoSFRUUF9NRVRIT0QsIGZhbHNlLCAnR0VUJykuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbn1cblxuLyoqXG4gKiBTZW5kIGFuIE9QVElPTlMgcmVxdWVzdFxuICogQHBhcmFtIHtTdHJpbmd9IHBhdGggVGhlIHBhdGggdG8gdGhlIHJlc291cmNlIHdlIHdhbnQgdG8gR0VUXG4gKiBAcGFyYW0ge09iamVjdHxGdW5jdGlvbn0gb3B0c09yQ2FsbGJhY2sgRWl0aGVyIGFuIG9wdGlvbnMgb2JqZWN0IG9yIGEgY2FsbGJhY2sgaWYgY2FuIHVzZSBkZWZhdWx0c1xuICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgQ2FsbGJhY2sgaWYgb3B0cyBzcGVjaWZpZWQuXG4gKiBAcGFja2FnZSBIVFRQXG4gKiBAcmV0dXJucyB7UHJvbWlzZX1cbiAqL1xuZnVuY3Rpb24gT1BUSU9OUygpIHtcbiAgICByZXR1cm4gXy5wYXJ0aWFsKEhUVFBfTUVUSE9ELCBmYWxzZSwgJ09QVElPTlMnKS5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xufVxuXG4vKipcbiAqIFNlbmQgYW4gVFJBQ0UgcmVxdWVzdFxuICogQHBhcmFtIHtTdHJpbmd9IHBhdGggVGhlIHBhdGggdG8gdGhlIHJlc291cmNlIHdlIHdhbnQgdG8gR0VUXG4gKiBAcGFyYW0ge09iamVjdHxGdW5jdGlvbn0gb3B0c09yQ2FsbGJhY2sgRWl0aGVyIGFuIG9wdGlvbnMgb2JqZWN0IG9yIGEgY2FsbGJhY2sgaWYgY2FuIHVzZSBkZWZhdWx0c1xuICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgQ2FsbGJhY2sgaWYgb3B0cyBzcGVjaWZpZWQuXG4gKiBAcGFja2FnZSBIVFRQXG4gKiBAcmV0dXJucyB7UHJvbWlzZX1cbiAqL1xuZnVuY3Rpb24gVFJBQ0UoKSB7XG4gICAgcmV0dXJuIF8ucGFydGlhbChIVFRQX01FVEhPRCwgZmFsc2UsICdUUkFDRScpLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG59XG5cbi8qKlxuICogU2VuZCBhbiBIRUFEIHJlcXVlc3RcbiAqIEBwYXJhbSB7U3RyaW5nfSBwYXRoIFRoZSBwYXRoIHRvIHRoZSByZXNvdXJjZSB3ZSB3YW50IHRvIEdFVFxuICogQHBhcmFtIHtPYmplY3R8RnVuY3Rpb259IG9wdHNPckNhbGxiYWNrIEVpdGhlciBhbiBvcHRpb25zIG9iamVjdCBvciBhIGNhbGxiYWNrIGlmIGNhbiB1c2UgZGVmYXVsdHNcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIENhbGxiYWNrIGlmIG9wdHMgc3BlY2lmaWVkLlxuICogQHBhY2thZ2UgSFRUUFxuICogQHJldHVybnMge1Byb21pc2V9XG4gKi9cbmZ1bmN0aW9uIEhFQUQoKSB7XG4gICAgcmV0dXJuIF8ucGFydGlhbChIVFRQX01FVEhPRCwgZmFsc2UsICdIRUFEJykuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbn1cblxuLyoqXG4gKiBTZW5kIGFuIFBPU1QgcmVxdWVzdFxuICogQHBhcmFtIHtTdHJpbmd9IHBhdGggVGhlIHBhdGggdG8gdGhlIHJlc291cmNlIHdlIHdhbnQgdG8gR0VUXG4gKiBAcGFyYW0ge01vZGVsSW5zdGFuY2V9IG1vZGVsIFRoZSBtb2RlbCB0aGF0IHdlIHdvdWxkIGxpa2UgdG8gUE9TVFxuICogQHBhcmFtIHtPYmplY3R8RnVuY3Rpb259IG9wdHNPckNhbGxiYWNrIEVpdGhlciBhbiBvcHRpb25zIG9iamVjdCBvciBhIGNhbGxiYWNrIGlmIGNhbiB1c2UgZGVmYXVsdHNcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIENhbGxiYWNrIGlmIG9wdHMgc3BlY2lmaWVkLlxuICogQHBhY2thZ2UgSFRUUFxuICogQHJldHVybnMge1Byb21pc2V9XG4gKi9cbmZ1bmN0aW9uIFBPU1QoKSB7XG4gICAgcmV0dXJuIF8ucGFydGlhbChIVFRQX01FVEhPRCwgdHJ1ZSwgJ1BPU1QnKS5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xufVxuXG4vKipcbiAqIFNlbmQgYW4gUFVUIHJlcXVlc3RcbiAqIEBwYXJhbSB7U3RyaW5nfSBwYXRoIFRoZSBwYXRoIHRvIHRoZSByZXNvdXJjZSB3ZSB3YW50IHRvIEdFVFxuICogQHBhcmFtIHtNb2RlbEluc3RhbmNlfSBtb2RlbCBUaGUgbW9kZWwgdGhhdCB3ZSB3b3VsZCBsaWtlIHRvIFBPU1RcbiAqIEBwYXJhbSB7T2JqZWN0fEZ1bmN0aW9ufSBvcHRzT3JDYWxsYmFjayBFaXRoZXIgYW4gb3B0aW9ucyBvYmplY3Qgb3IgYSBjYWxsYmFjayBpZiBjYW4gdXNlIGRlZmF1bHRzXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBDYWxsYmFjayBpZiBvcHRzIHNwZWNpZmllZC5cbiAqIEBwYWNrYWdlIEhUVFBcbiAqIEByZXR1cm5zIHtQcm9taXNlfVxuICovXG5mdW5jdGlvbiBQVVQoKSB7XG4gICAgcmV0dXJuIF8ucGFydGlhbChIVFRQX01FVEhPRCwgdHJ1ZSwgJ1BVVCcpLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG59XG5cbi8qKlxuICogU2VuZCBhbiBQQVRDSCByZXF1ZXN0XG4gKiBAcGFyYW0ge1N0cmluZ30gcGF0aCBUaGUgcGF0aCB0byB0aGUgcmVzb3VyY2Ugd2Ugd2FudCB0byBHRVRcbiAqIEBwYXJhbSB7TW9kZWxJbnN0YW5jZX0gbW9kZWwgVGhlIG1vZGVsIHRoYXQgd2Ugd291bGQgbGlrZSB0byBQT1NUXG4gKiBAcGFyYW0ge09iamVjdHxGdW5jdGlvbn0gb3B0c09yQ2FsbGJhY2sgRWl0aGVyIGFuIG9wdGlvbnMgb2JqZWN0IG9yIGEgY2FsbGJhY2sgaWYgY2FuIHVzZSBkZWZhdWx0c1xuICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgQ2FsbGJhY2sgaWYgb3B0cyBzcGVjaWZpZWQuXG4gKiBAcGFja2FnZSBIVFRQXG4gKiBAcmV0dXJucyB7UHJvbWlzZX1cbiAqL1xuZnVuY3Rpb24gUEFUQ0goKSB7XG4gICAgcmV0dXJuIF8ucGFydGlhbChIVFRQX01FVEhPRCwgdHJ1ZSwgJ1BBVENIJykuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbn1cblxuXG52YXIgaHR0cCA9IHtcbiAgICBSZXF1ZXN0RGVzY3JpcHRvcjogcmVxdWlyZSgnLi9yZXF1ZXN0RGVzY3JpcHRvcicpLlJlcXVlc3REZXNjcmlwdG9yLFxuICAgIFJlc3BvbnNlRGVzY3JpcHRvcjogcmVxdWlyZSgnLi9yZXNwb25zZURlc2NyaXB0b3InKS5SZXNwb25zZURlc2NyaXB0b3IsXG4gICAgRGVzY3JpcHRvcjogZGVzY3JpcHRvci5EZXNjcmlwdG9yLFxuICAgIF9yZXNvbHZlTWV0aG9kOiBkZXNjcmlwdG9yLnJlc29sdmVNZXRob2QsXG4gICAgU2VyaWFsaXNlcjogcmVxdWlyZSgnLi9zZXJpYWxpc2VyJyksXG4gICAgRGVzY3JpcHRvclJlZ2lzdHJ5OiByZXF1aXJlKCcuL2Rlc2NyaXB0b3JSZWdpc3RyeScpLkRlc2NyaXB0b3JSZWdpc3RyeSxcbiAgICBfaHR0cFJlc3BvbnNlOiBfaHR0cFJlc3BvbnNlLFxuICAgIF9odHRwUmVxdWVzdDogX2h0dHBSZXF1ZXN0LFxuICAgIERFTEVURTogREVMRVRFLFxuICAgIEhUVFBfTUVUSE9EOiBIVFRQX01FVEhPRCxcbiAgICBHRVQ6IEdFVCxcbiAgICBUUkFDRTogVFJBQ0UsXG4gICAgT1BUSU9OUzogT1BUSU9OUyxcbiAgICBIRUFEOiBIRUFELFxuICAgIFBPU1Q6IFBPU1QsXG4gICAgUFVUOiBQVVQsXG4gICAgUEFUQ0g6IFBBVENILFxuICAgIF9zZXJpYWxpc2VPYmplY3Q6IF9zZXJpYWxpc2VPYmplY3QsXG4gICAgUGFnaW5hdG9yOiByZXF1aXJlKCcuL3BhZ2luYXRvcicpXG59O1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoaHR0cCwgJ2FqYXgnLCB7XG4gICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiBhamF4IHx8ICgkID8gJC5hamF4IDogbnVsbCkgfHwgKGpRdWVyeSA/IGpRdWVyeS5hamF4IDogbnVsbCk7XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uICh2KSB7XG4gICAgICAgIGFqYXggPSB2O1xuICAgIH1cbn0pO1xuXG5fLmV4dGVuZChDb2xsZWN0aW9uLnByb3RvdHlwZSwge1xuICAgIERFTEVURTogREVMRVRFLFxuICAgIEdFVDogR0VULFxuICAgIFRSQUNFOiBUUkFDRSxcbiAgICBPUFRJT05TOiBPUFRJT05TLFxuICAgIEhFQUQ6IEhFQUQsXG4gICAgUE9TVDogUE9TVCxcbiAgICBQVVQ6IFBVVCxcbiAgICBQQVRDSDogUEFUQ0hcbn0pO1xuXG5pZiAoIXNpZXN0YS5leHQpIHNpZXN0YS5leHQgPSB7fTtcbnNpZXN0YS5leHQuaHR0cCA9IGh0dHA7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKHNpZXN0YS5leHQsIHtcbiAgICBodHRwRW5hYmxlZDoge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGlmIChzaWVzdGEuZXh0Ll9odHRwRW5hYmxlZCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHNpZXN0YS5leHQuX2h0dHBFbmFibGVkO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuICEhc2llc3RhLmV4dC5odHRwO1xuICAgICAgICB9LFxuICAgICAgICBzZXQ6IGZ1bmN0aW9uICh2KSB7XG4gICAgICAgICAgICBzaWVzdGEuZXh0Ll9odHRwRW5hYmxlZCA9IHY7XG4gICAgICAgIH0sXG4gICAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICB9XG59KTtcblxudmFyIGFqYXgsIHNlcmlhbGlzZXJzID0ge307XG5cbl8uZXh0ZW5kKHNpZXN0YSwge1xuICAgIHNldEFqYXg6IGZ1bmN0aW9uIChfYWpheCkge1xuICAgICAgICBhamF4ID0gX2FqYXg7XG4gICAgfSxcbiAgICBnZXRBamF4OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiBzaWVzdGEuZXh0Lmh0dHAuYWpheDtcbiAgICB9LFxuICAgIHNlcmlhbGlzZXJzOiBzZXJpYWxpc2VycyxcbiAgICBzZXJpYWxpemVyczogc2VyaWFsaXNlcnNcbn0pO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoc2llc3RhLCAnYWpheCcsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIGFqYXg7XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uIChfYWpheCkge1xuICAgICAgICBhamF4ID0gX2FqYXg7XG4gICAgfVxufSk7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKHNlcmlhbGlzZXJzLCB7XG4gICAgaWQ6IHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBpZiAoc2llc3RhLmV4dC5odHRwRW5hYmxlZCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBzaWVzdGEuZXh0Lmh0dHAuU2VyaWFsaXNlci5pZFNlcmlhbGlzZXI7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgZGVwdGg6IHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBpZiAoc2llc3RhLmV4dC5odHRwRW5hYmxlZCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBzaWVzdGEuZXh0Lmh0dHAuU2VyaWFsaXNlci5kZXB0aFNlcmlhbGl6ZXI7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cbn0pO1xuXG5pZiAodHlwZW9mIG1vZHVsZSAhPSAndW5kZWZpbmVkJykgbW9kdWxlLmV4cG9ydHMgPSBodHRwO1xuIiwidmFyIF9pbnRlcm5hbCA9IHNpZXN0YS5faW50ZXJuYWwsXG4gICAgbG9nID0gX2ludGVybmFsLmxvZyxcbiAgICBJbnRlcm5hbFNpZXN0YUVycm9yID0gX2ludGVybmFsLmVycm9yLkludGVybmFsU2llc3RhRXJyb3IsXG4gICAgdXRpbCA9IF9pbnRlcm5hbC51dGlsLFxuICAgIF8gPSB1dGlsLl87XG5cbnZhciBxdWVyeXN0cmluZyA9IHJlcXVpcmUoJ3F1ZXJ5c3RyaW5nJyk7XG5cbmZ1bmN0aW9uIFBhZ2luYXRvcihvcHRzKSB7XG4gICAgdGhpcy5vcHRzID0ge307XG4gICAgdXRpbC5leHRlbmRGcm9tT3B0cyh0aGlzLm9wdHMsIG9wdHMsIHtcbiAgICAgICAgcGF0aDogJy8nLFxuICAgICAgICBtb2RlbDogbnVsbCxcbiAgICAgICAgcGFnZTogJ3BhZ2UnLFxuICAgICAgICBxdWVyeVBhcmFtczogdHJ1ZSxcbiAgICAgICAgcGFnZVNpemU6ICdwYWdlU2l6ZScsXG4gICAgICAgIG51bVBhZ2VzOiAnbnVtUGFnZXMnLFxuICAgICAgICBkYXRhUGF0aDogJ2RhdGEnLFxuICAgICAgICBjb3VudDogJ2NvdW50JyxcbiAgICAgICAgdHlwZTogJ0dFVCcsXG4gICAgICAgIGRhdGFUeXBlOiAnanNvbidcbiAgICB9LCBmYWxzZSk7XG4gICAgXy5leHRlbmQodGhpcywge1xuICAgICAgICBudW1QYWdlczogbnVsbCxcbiAgICAgICAgY291bnQ6IG51bGxcbiAgICB9KTtcblxuICAgIHRoaXMudmFsaWRhdGUoKTtcbn1cblxuXy5leHRlbmQoUGFnaW5hdG9yLnByb3RvdHlwZSwge1xuICAgIF9leHRyYWN0OiBmdW5jdGlvbiAocGF0aCwgZGF0YSwganFYSFIpIHtcbiAgICAgICAgaWYgKHBhdGgpIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgcGF0aCA9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICAgICAgZGF0YSA9IHBhdGgoZGF0YSwganFYSFIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgdmFyIHNwbHQgPSBwYXRoLnNwbGl0KCcuJyk7XG4gICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzcGx0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBrZXkgPSBzcGx0W2ldO1xuICAgICAgICAgICAgICAgICAgICBkYXRhID0gZGF0YVtrZXldO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZGF0YTtcbiAgICB9LFxuICAgIF9leHRyYWN0RGF0YTogZnVuY3Rpb24gKGRhdGEsIGpxWEhSKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9leHRyYWN0KHRoaXMub3B0cy5kYXRhUGF0aCwgZGF0YSwganFYSFIpO1xuICAgIH0sXG4gICAgX2V4dHJhY3ROdW1QYWdlczogZnVuY3Rpb24gKGRhdGEsIGpxWEhSKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9leHRyYWN0KHRoaXMub3B0cy5udW1QYWdlcywgZGF0YSwganFYSFIpO1xuICAgIH0sXG4gICAgX2V4dHJhY3RDb3VudDogZnVuY3Rpb24gKGRhdGEsIGpxWEhSKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9leHRyYWN0KHRoaXMub3B0cy5jb3VudCwgZGF0YSwganFYSFIpO1xuICAgIH0sXG4gICAgLyoqXG4gICAgICogdmFyIHBhcnNlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2EnKTtcbiAgICAgKiBwYXJzZXIuaHJlZiA9IFwiaHR0cDovL2V4YW1wbGUuY29tOjMwMDAvcGF0aG5hbWUvP3NlYXJjaD10ZXN0I2hhc2hcIjtcbiAgICAgKiBwYXJzZXIuaHJlZiA9IFVSTDtcbiAgICAgKiBwYXJzZXIucHJvdG9jb2w7IC8vID0+IFwiaHR0cDpcIlxuICAgICAqIHBhcnNlci5ob3N0bmFtZTsgLy8gPT4gXCJleGFtcGxlLmNvbVwiXG4gICAgICogcGFyc2VyLnBvcnQ7ICAgICAvLyA9PiBcIjMwMDBcIlxuICAgICAqIHBhcnNlci5wYXRobmFtZTsgLy8gPT4gXCIvcGF0aG5hbWUvXCJcbiAgICAgKiBwYXJzZXIuc2VhcmNoOyAgIC8vID0+IFwiP3NlYXJjaD10ZXN0XCJcbiAgICAgKiBwYXJzZXIuaGFzaDsgICAgIC8vID0+IFwiI2hhc2hcIlxuICAgICAqIHBhcnNlci5ob3N0OyAgICAgLy8gPT4gXCJleGFtcGxlLmNvbTozMDAwXCJcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gVVJMXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfcGFyc2VVUkw6IGZ1bmN0aW9uIChVUkwpIHtcbiAgICAgICAgdmFyIHBhcnNlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2EnKTtcbiAgICAgICAgcGFyc2VyLmhyZWYgPSBVUkw7XG4gICAgICAgIHJldHVybiBwYXJzZXI7XG4gICAgfSxcbiAgICBwYWdlOiBmdW5jdGlvbiAob3B0c09yQ2FsbGJhY2ssIGNhbGxiYWNrKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgdmFyIG9wdHMgPSB7fTtcbiAgICAgICAgaWYgKHR5cGVvZiBvcHRzT3JDYWxsYmFjayA9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICBjYWxsYmFjayA9IG9wdHNPckNhbGxiYWNrO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKG9wdHNPckNhbGxiYWNrKSB7XG4gICAgICAgICAgICBvcHRzID0gb3B0c09yQ2FsbGJhY2s7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIGRlZmVycmVkID0gdXRpbC5kZWZlcihjYWxsYmFjayk7XG4gICAgICAgIHZhciBwYWdlID0gb3B0cy5wYWdlLFxuICAgICAgICAgICAgcGFnZVNpemUgPSBvcHRzLnBhZ2VTaXplO1xuICAgICAgICBjYWxsYmFjayA9IGRlZmVycmVkLmZpbmlzaC5iaW5kKGRlZmVycmVkKTtcbiAgICAgICAgdmFyIGFqYXggPSBzaWVzdGEuZXh0Lmh0dHAuYWpheCxcbiAgICAgICAgICAgIGFqYXhPcHRzID0gXy5leHRlbmQoe30sIHRoaXMub3B0cyk7XG4gICAgICAgIHZhciBjb2xsZWN0aW9uID0gdGhpcy5vcHRzLm1vZGVsLmNvbGxlY3Rpb24sXG4gICAgICAgICAgICB1cmwgPSBjb2xsZWN0aW9uLmJhc2VVUkwgKyB0aGlzLm9wdHMucGF0aDtcbiAgICAgICAgaWYgKHRoaXMub3B0cy5xdWVyeVBhcmFtcykge1xuICAgICAgICAgICAgdmFyIHBhcnNlciA9IHRoaXMuX3BhcnNlVVJMKHVybCk7XG4gICAgICAgICAgICB2YXIgcmF3UXVlcnkgPSBwYXJzZXIuc2VhcmNoLFxuICAgICAgICAgICAgICAgIHJhd1F1ZXJ5U3BsdCA9IHJhd1F1ZXJ5LnNwbGl0KCc/Jyk7XG4gICAgICAgICAgICBpZiAocmF3UXVlcnlTcGx0Lmxlbmd0aCA+IDEpIHJhd1F1ZXJ5ID0gcmF3UXVlcnlTcGx0WzFdO1xuICAgICAgICAgICAgdmFyIHF1ZXJ5ID0gcXVlcnlzdHJpbmcucGFyc2UocmF3UXVlcnkpO1xuICAgICAgICAgICAgaWYgKHBhZ2UpIHtcbiAgICAgICAgICAgICAgICBxdWVyeVt0aGlzLm9wdHMucGFnZV0gPSBwYWdlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHBhZ2VTaXplKSB7XG4gICAgICAgICAgICAgICAgcXVlcnlbdGhpcy5vcHRzLnBhZ2VTaXplXSA9IHBhZ2VTaXplO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKE9iamVjdC5rZXlzKHF1ZXJ5KS5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICBwYXJzZXIuc2VhcmNoID0gJz8nICsgcXVlcnlzdHJpbmcuc3RyaW5naWZ5KHF1ZXJ5KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHVybCA9IHBhcnNlci5ocmVmO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdmFyIGRhdGEgPSB7fTtcbiAgICAgICAgICAgIGlmIChwYWdlKSB7XG4gICAgICAgICAgICAgICAgZGF0YVt0aGlzLm9wdHMucGFnZV0gPSBwYWdlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHBhZ2VTaXplKSB7XG4gICAgICAgICAgICAgICAgZGF0YVt0aGlzLm9wdHMucGFnZVNpemVdID0gcGFnZVNpemU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBhamF4T3B0cy5kYXRhID0gZGF0YVxuICAgICAgICB9XG4gICAgICAgIF8uZXh0ZW5kKGFqYXhPcHRzLCB7XG4gICAgICAgICAgICB1cmw6IHVybCxcbiAgICAgICAgICAgIHN1Y2Nlc3M6IGZ1bmN0aW9uIChkYXRhLCB0ZXh0U3RhdHVzLCBqcVhIUikge1xuICAgICAgICAgICAgICAgIHZhciBtb2RlbERhdGEgPSBzZWxmLl9leHRyYWN0RGF0YShkYXRhLCBqcVhIUiksXG4gICAgICAgICAgICAgICAgICAgIGNvdW50ID0gc2VsZi5fZXh0cmFjdENvdW50KGRhdGEsIGpxWEhSKSxcbiAgICAgICAgICAgICAgICAgICAgbnVtUGFnZXMgPSBzZWxmLl9leHRyYWN0TnVtUGFnZXMoZGF0YSwganFYSFIpO1xuXG4gICAgICAgICAgICAgICAgc2VsZi5vcHRzLm1vZGVsLmdyYXBoKG1vZGVsRGF0YSwgZnVuY3Rpb24gKGVyciwgbW9kZWxJbnN0YW5jZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYuY291bnQgPSBjb3VudDtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYubnVtUGFnZXMgPSBudW1QYWdlcztcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIG1vZGVsSW5zdGFuY2VzLCB7ZGF0YTogZGF0YSwgdGV4dFN0YXR1czogdGV4dFN0YXR1cywganFYSFI6IGpxWEhSfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgZmFpbDogY2FsbGJhY2tcbiAgICAgICAgfSk7XG4gICAgICAgIGFqYXgoYWpheE9wdHMpO1xuICAgICAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbiAgICB9LFxuICAgIHZhbGlkYXRlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmICghdGhpcy5vcHRzLm1vZGVsKSB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignUGFnaW5hdG9yIG11c3QgaGF2ZSBhIG1vZGVsJyk7XG4gICAgfVxufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gUGFnaW5hdG9yOyIsIi8qKlxuICogQG1vZHVsZSBodHRwXG4gKi9cblxudmFyIERlc2NyaXB0b3IgPSByZXF1aXJlKCcuL2Rlc2NyaXB0b3InKS5EZXNjcmlwdG9yLFxuICAgIFNlcmlhbGlzZXIgPSByZXF1aXJlKCcuL3NlcmlhbGlzZXInKTtcblxudmFyIF9pbnRlcm5hbCA9IHNpZXN0YS5faW50ZXJuYWwsXG4gICAgdXRpbCA9IF9pbnRlcm5hbC51dGlsLFxuICAgIF8gPSB1dGlsLl8sXG4gICAgbG9nID0gX2ludGVybmFsLmxvZyxcbiAgICBkZWZpbmVTdWJQcm9wZXJ0eSA9IHV0aWwuZGVmaW5lU3ViUHJvcGVydHlcbiAgICA7XG5cbnZhciBMb2dnZXIgPSBsb2cubG9nZ2VyV2l0aE5hbWUoJ0Rlc2NyaXB0b3InKTtcblxuLyoqXG4gKiBAY2xhc3MgRGVzY3JpYmVzIGEgSFRUUCByZXF1ZXN0XG4gKiBAcGFyYW0ge09iamVjdH0gb3B0c1xuICovXG5mdW5jdGlvbiBSZXF1ZXN0RGVzY3JpcHRvcihvcHRzKSB7XG4gICAgaWYgKCF0aGlzKSB7XG4gICAgICAgIHJldHVybiBuZXcgUmVxdWVzdERlc2NyaXB0b3Iob3B0cyk7XG4gICAgfVxuXG4gICAgRGVzY3JpcHRvci5jYWxsKHRoaXMsIG9wdHMpO1xuICAgIGlmICh0aGlzLl9vcHRzWydzZXJpYWxpemVyJ10pIHtcbiAgICAgICAgdGhpcy5fb3B0cy5zZXJpYWxpc2VyID0gdGhpcy5fb3B0c1snc2VyaWFsaXplciddO1xuICAgIH1cblxuICAgIGlmICghdGhpcy5fb3B0cy5zZXJpYWxpc2VyKSB7XG4gICAgICAgIHRoaXMuX29wdHMuc2VyaWFsaXNlciA9IFNlcmlhbGlzZXIuZGVwdGhTZXJpYWxpemVyKDApO1xuICAgIH1cblxuXG4gICAgZGVmaW5lU3ViUHJvcGVydHkuY2FsbCh0aGlzLCAnc2VyaWFsaXNlcicsIHRoaXMuX29wdHMpO1xuICAgIGRlZmluZVN1YlByb3BlcnR5LmNhbGwodGhpcywgJ3NlcmlhbGl6ZXInLCB0aGlzLl9vcHRzLCAnc2VyaWFsaXNlcicpO1xuXG59XG5cblJlcXVlc3REZXNjcmlwdG9yLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoRGVzY3JpcHRvci5wcm90b3R5cGUpO1xuXG5fLmV4dGVuZChSZXF1ZXN0RGVzY3JpcHRvci5wcm90b3R5cGUsIHtcbiAgICBfc2VyaWFsaXNlOiBmdW5jdGlvbiAob2JqLCBjYWxsYmFjaykge1xuICAgICAgICB2YXIgZGVmZXJyZWQgPSB1dGlsLmRlZmVyKGNhbGxiYWNrKTtcbiAgICAgICAgY2FsbGJhY2sgPSBkZWZlcnJlZC5maW5pc2guYmluZChkZWZlcnJlZCk7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgaWYgKExvZ2dlci50cmFjZS5pc0VuYWJsZWQpXG4gICAgICAgICAgICBMb2dnZXIudHJhY2UoJ19zZXJpYWxpc2UnKTtcbiAgICAgICAgdmFyIGZpbmlzaGVkO1xuICAgICAgICB2YXIgZGF0YSA9IHRoaXMuc2VyaWFsaXNlcihvYmosIGZ1bmN0aW9uIChlcnIsIGRhdGEpIHtcbiAgICAgICAgICAgIGlmICghZmluaXNoZWQpIHtcbiAgICAgICAgICAgICAgICBkYXRhID0gc2VsZi5fdHJhbnNmb3JtRGF0YShkYXRhKTtcbiAgICAgICAgICAgICAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKGVyciwgc2VsZi5fZW1iZWREYXRhKGRhdGEpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIGlmIChkYXRhICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKVxuICAgICAgICAgICAgICAgIExvZ2dlci50cmFjZSgnc2VyaWFsaXNlciBkb2VzbnQgdXNlIGEgY2FsbGJhY2snKTtcbiAgICAgICAgICAgIGZpbmlzaGVkID0gdHJ1ZTtcbiAgICAgICAgICAgIGRhdGEgPSBzZWxmLl90cmFuc2Zvcm1EYXRhKGRhdGEpO1xuICAgICAgICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhudWxsLCBzZWxmLl9lbWJlZERhdGEoZGF0YSkpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgaWYgKExvZ2dlci50cmFjZS5pc0VuYWJsZWQpXG4gICAgICAgICAgICAgICAgTG9nZ2VyLnRyYWNlKCdzZXJpYWxpc2VyIHVzZXMgYSBjYWxsYmFjaycsIHRoaXMuc2VyaWFsaXNlcik7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG4gICAgfSxcbiAgICBfZHVtcDogZnVuY3Rpb24gKGFzSnNvbikge1xuICAgICAgICB2YXIgb2JqID0ge307XG4gICAgICAgIG9iai5tZXRob2RzID0gdGhpcy5tZXRob2Q7XG4gICAgICAgIG9iai5tb2RlbCA9IHRoaXMubW9kZWwubmFtZTtcbiAgICAgICAgb2JqLnBhdGggPSB0aGlzLl9yYXdPcHRzLnBhdGg7XG4gICAgICAgIHZhciBzZXJpYWxpc2VyO1xuICAgICAgICBpZiAodHlwZW9mKHRoaXMuX3Jhd09wdHMuc2VyaWFsaXNlcikgPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgc2VyaWFsaXNlciA9ICdmdW5jdGlvbiAoKSB7IC4uLiB9J1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgc2VyaWFsaXNlciA9IHRoaXMuX3Jhd09wdHMuc2VyaWFsaXNlcjtcbiAgICAgICAgfVxuICAgICAgICBvYmouc2VyaWFsaXNlciA9IHNlcmlhbGlzZXI7XG4gICAgICAgIHZhciB0cmFuc2Zvcm1zID0ge307XG4gICAgICAgIGZvciAodmFyIGYgaW4gdGhpcy50cmFuc2Zvcm1zKSB7XG4gICAgICAgICAgICBpZiAodGhpcy50cmFuc2Zvcm1zLmhhc093blByb3BlcnR5KGYpKSB7XG4gICAgICAgICAgICAgICAgdmFyIHRyYW5zZm9ybSA9IHRoaXMudHJhbnNmb3Jtc1tmXTtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mKHRyYW5zZm9ybSkgPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgICAgICAgICB0cmFuc2Zvcm1zW2ZdID0gJ2Z1bmN0aW9uICgpIHsgLi4uIH0nXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0cmFuc2Zvcm1zW2ZdID0gdGhpcy50cmFuc2Zvcm1zW2ZdO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBvYmoudHJhbnNmb3JtcyA9IHRyYW5zZm9ybXM7XG4gICAgICAgIHJldHVybiBhc0pzb24gPyB1dGlsLnByZXR0eVByaW50KG9iaikgOiBvYmo7XG4gICAgfVxufSk7XG5cbmV4cG9ydHMuUmVxdWVzdERlc2NyaXB0b3IgPSBSZXF1ZXN0RGVzY3JpcHRvcjtcbiIsIi8qKlxuICogQG1vZHVsZSBodHRwXG4gKi9cblxuXG52YXIgRGVzY3JpcHRvciA9IHJlcXVpcmUoJy4vZGVzY3JpcHRvcicpLkRlc2NyaXB0b3IsXG4gICAgXyA9IHNpZXN0YS5faW50ZXJuYWwudXRpbC5fO1xuXG4vKipcbiAqIERlc2NyaWJlcyB3aGF0IHRvIGRvIHdpdGggYSBIVFRQIHJlc3BvbnNlLlxuICogQGNvbnN0cnVjdG9yXG4gKiBAaW1wbGVtZW50cyB7RGVzY3JpcHRvcn1cbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRzXG4gKi9cbmZ1bmN0aW9uIFJlc3BvbnNlRGVzY3JpcHRvcihvcHRzKSB7XG4gICAgaWYgKCF0aGlzKSB7XG4gICAgICAgIHJldHVybiBuZXcgUmVzcG9uc2VEZXNjcmlwdG9yKG9wdHMpO1xuICAgIH1cbiAgICBEZXNjcmlwdG9yLmNhbGwodGhpcywgb3B0cyk7XG59XG5cblJlc3BvbnNlRGVzY3JpcHRvci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKERlc2NyaXB0b3IucHJvdG90eXBlKTtcblxuXy5leHRlbmQoUmVzcG9uc2VEZXNjcmlwdG9yLnByb3RvdHlwZSwge1xuICAgIF9leHRyYWN0RGF0YTogZnVuY3Rpb24gKGRhdGEpIHtcbiAgICAgICAgdmFyIGV4dHJhY3RlZERhdGEgPSBEZXNjcmlwdG9yLnByb3RvdHlwZS5fZXh0cmFjdERhdGEuY2FsbCh0aGlzLCBkYXRhKTtcbiAgICAgICAgaWYgKGV4dHJhY3RlZERhdGEpIHtcbiAgICAgICAgICAgIGV4dHJhY3RlZERhdGEgPSB0aGlzLl90cmFuc2Zvcm1EYXRhKGV4dHJhY3RlZERhdGEpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBleHRyYWN0ZWREYXRhO1xuICAgIH0sXG4gICAgX21hdGNoRGF0YTogZnVuY3Rpb24gKGRhdGEpIHtcbiAgICAgICAgdmFyIGV4dHJhY3RlZERhdGEgPSBEZXNjcmlwdG9yLnByb3RvdHlwZS5fbWF0Y2hEYXRhLmNhbGwodGhpcywgZGF0YSk7XG4gICAgICAgIGlmIChleHRyYWN0ZWREYXRhKSB7XG4gICAgICAgICAgICBleHRyYWN0ZWREYXRhID0gdGhpcy5fdHJhbnNmb3JtRGF0YShleHRyYWN0ZWREYXRhKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZXh0cmFjdGVkRGF0YTtcbiAgICB9LFxuICAgIF9kdW1wOiBmdW5jdGlvbiAoYXNKc29uKSB7XG4gICAgICAgIHZhciBvYmogPSB7fTtcbiAgICAgICAgb2JqLm1ldGhvZHMgPSB0aGlzLm1ldGhvZDtcbiAgICAgICAgb2JqLm1vZGVsID0gdGhpcy5tb2RlbC5uYW1lO1xuICAgICAgICBvYmoucGF0aCA9IHRoaXMuX3Jhd09wdHMucGF0aDtcbiAgICAgICAgdmFyIHRyYW5zZm9ybXMgPSB7fTtcbiAgICAgICAgZm9yICh2YXIgZiBpbiB0aGlzLnRyYW5zZm9ybXMpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLnRyYW5zZm9ybXMuaGFzT3duUHJvcGVydHkoZikpIHtcbiAgICAgICAgICAgICAgICB2YXIgdHJhbnNmb3JtID0gdGhpcy50cmFuc2Zvcm1zW2ZdO1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YodHJhbnNmb3JtKSA9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICAgICAgICAgIHRyYW5zZm9ybXNbZl0gPSAnZnVuY3Rpb24gKCkgeyAuLi4gfSdcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRyYW5zZm9ybXNbZl0gPSB0aGlzLnRyYW5zZm9ybXNbZl07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIG9iai50cmFuc2Zvcm1zID0gdHJhbnNmb3JtcztcbiAgICAgICAgcmV0dXJuIGFzSnNvbiA/IHV0aWwucHJldHR5UHJpbnQob2JqKSA6IG9iajtcbiAgICB9XG59KTtcblxuZXhwb3J0cy5SZXNwb25zZURlc2NyaXB0b3IgPSBSZXNwb25zZURlc2NyaXB0b3I7IiwiLyoqXG4gKiBAbW9kdWxlIGh0dHBcbiAqL1xuXG52YXIgX2ludGVybmFsID0gc2llc3RhLl9pbnRlcm5hbDtcblxudmFyIGxvZyA9IF9pbnRlcm5hbC5sb2csXG4gICAgdXRpbHMgPSBfaW50ZXJuYWwudXRpbDtcbnZhciBMb2dnZXIgPSBsb2cubG9nZ2VyV2l0aE5hbWUoJ1NlcmlhbGlzYXRpb24nKTtcbnZhciBfID0gdXRpbHMuXztcblxuXG4vKipcbiAqIFNlcmlhbGlzZXMgYW4gb2JqZWN0IGludG8gaXQncyByZW1vdGUgaWRlbnRpZmllciAoYXMgZGVmaW5lZCBieSB0aGUgbWFwcGluZylcbiAqIEBwYXJhbSAge01vZGVsSW5zdGFuY2V9IG9ialxuICogQHJldHVybiB7U3RyaW5nfVxuICpcbiAqL1xuZnVuY3Rpb24gaWRTZXJpYWxpc2VyKG9iaikge1xuICAgIHZhciBpZEZpZWxkID0gb2JqLm1vZGVsLmlkO1xuICAgIGlmIChpZEZpZWxkKSB7XG4gICAgICAgIHJldHVybiBvYmpbaWRGaWVsZF0gPyBvYmpbaWRGaWVsZF0gOiBudWxsO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgaWYgKExvZ2dlci5kZWJ1Zy5pc0VuYWJsZWQpXG4gICAgICAgICAgICBMb2dnZXIuZGVidWcoJ05vIGlkZmllbGQnKTtcbiAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG59XG5cbi8qKlxuICogU2VyaWFsaXNlcyBvYmogZm9sbG93aW5nIHJlbGF0aW9uc2hpcHMgdG8gc3BlY2lmaWVkIGRlcHRoLlxuICogQHBhcmFtICB7SW50ZWdlcn0gICBkZXB0aFxuICogQHBhcmFtICB7TW9kZWxJbnN0YW5jZX0gICBvYmpcbiAqIEBwYXJhbSAge0Z1bmN0aW9ufSBjYWxsYmFja1xuICovXG5mdW5jdGlvbiBkZXB0aFNlcmlhbGlzZXIoZGVwdGgsIG9iaiwgY2FsbGJhY2spIHtcbiAgICBjYWxsYmFjayA9IGNhbGxiYWNrIHx8IGZ1bmN0aW9uICgpIHt9O1xuICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKVxuICAgICAgICBMb2dnZXIudHJhY2UoJ2RlcHRoU2VyaWFsaXNlcicpO1xuICAgIHZhciBkYXRhID0ge307XG4gICAgXy5lYWNoKG9iai5fYXR0cmlidXRlTmFtZXMsIGZ1bmN0aW9uIChmKSB7XG4gICAgICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKVxuICAgICAgICAgICAgTG9nZ2VyLnRyYWNlKCdmaWVsZCcsIGYpO1xuICAgICAgICBpZiAob2JqW2ZdKSB7XG4gICAgICAgICAgICBkYXRhW2ZdID0gb2JqW2ZdO1xuICAgICAgICB9XG4gICAgfSk7XG4gICAgdmFyIHdhaXRpbmcgPSBbXSxcbiAgICAgICAgZXJyb3JzID0gW10sXG4gICAgICAgIHJlc3VsdCA9IHt9LFxuICAgICAgICBmaW5pc2hlZCA9IFtdO1xuICAgIF8uZWFjaChvYmouX3JlbGF0aW9uc2hpcE5hbWVzLCBmdW5jdGlvbiAoZikge1xuICAgICAgICBpZiAoTG9nZ2VyLnRyYWNlLmlzRW5hYmxlZClcbiAgICAgICAgICAgIExvZ2dlci50cmFjZSgncmVsYXRpb25zaGlwRmllbGQnLCBmKTtcbiAgICAgICAgdmFyIHByb3h5ID0gb2JqLl9fcHJveGllc1tmXTtcbiAgICAgICAgaWYgKHByb3h5LmlzRm9yd2FyZCkgeyAvLyBCeSBkZWZhdWx0IG9ubHkgZm9yd2FyZCByZWxhdGlvbnNoaXBzXG4gICAgICAgICAgICBpZiAoTG9nZ2VyLmRlYnVnLmlzRW5hYmxlZClcbiAgICAgICAgICAgICAgICBMb2dnZXIuZGVidWcoZik7XG4gICAgICAgICAgICB3YWl0aW5nLnB1c2goZik7XG4gICAgICAgICAgICBwcm94eS5nZXQoZnVuY3Rpb24gKGVyciwgdikge1xuICAgICAgICAgICAgICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKVxuICAgICAgICAgICAgICAgICAgICBMb2dnZXIudHJhY2UoJ3Byb3h5LmdldCcsIGYpO1xuICAgICAgICAgICAgICAgIGlmIChMb2dnZXIuZGVidWcuaXNFbmFibGVkKVxuICAgICAgICAgICAgICAgICAgICBMb2dnZXIuZGVidWcoZiwgdik7XG4gICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICBlcnJvcnMucHVzaChlcnIpO1xuICAgICAgICAgICAgICAgICAgICBmaW5pc2hlZC5wdXNoKGYpO1xuICAgICAgICAgICAgICAgICAgICByZXN1bHRbZl0gPSB7ZXJyOiBlcnIsIHY6IHZ9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIGlmICh2KSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghZGVwdGgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZpbmlzaGVkLnB1c2goZik7XG4gICAgICAgICAgICAgICAgICAgICAgICBkYXRhW2ZdID0gdltvYmouX19wcm94aWVzW2ZdLmZvcndhcmRNb2RlbC5pZF07XG4gICAgICAgICAgICAgICAgICAgICAgICByZXN1bHRbZl0gPSB7ZXJyOiBlcnIsIHY6IHZ9O1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCh3YWl0aW5nLmxlbmd0aCA9PSBmaW5pc2hlZC5sZW5ndGgpICYmIGNhbGxiYWNrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyb3JzLmxlbmd0aCA/IGVycm9ycyA6IG51bGwsIGRhdGEsIHJlc3VsdCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkZXB0aFNlcmlhbGlzZXIoZGVwdGggLSAxLCB2LCBmdW5jdGlvbiAoZXJyLCBzdWJEYXRhLCByZXNwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlcnJvcnMucHVzaChlcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0YVtmXSA9IHN1YkRhdGE7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZpbmlzaGVkLnB1c2goZik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzdWx0W2ZdID0ge2VycjogZXJyLCB2OiB2LCByZXNwOiByZXNwfTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoKHdhaXRpbmcubGVuZ3RoID09IGZpbmlzaGVkLmxlbmd0aCkgJiYgY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyb3JzLmxlbmd0aCA/IGVycm9ycyA6IG51bGwsIGRhdGEsIHJlc3VsdCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChMb2dnZXIuZGVidWcuaXNFbmFibGVkKVxuICAgICAgICAgICAgICAgICAgICAgICAgTG9nZ2VyLmRlYnVnKCdubyB2YWx1ZSBmb3IgJyArIGYpO1xuICAgICAgICAgICAgICAgICAgICBmaW5pc2hlZC5wdXNoKGYpO1xuICAgICAgICAgICAgICAgICAgICByZXN1bHRbZl0gPSB7ZXJyOiBlcnIsIHY6IHZ9O1xuICAgICAgICAgICAgICAgICAgICBpZiAoKHdhaXRpbmcubGVuZ3RoID09IGZpbmlzaGVkLmxlbmd0aCkgJiYgY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycm9ycy5sZW5ndGggPyBlcnJvcnMgOiBudWxsLCBkYXRhLCByZXN1bHQpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBpZiAoIXdhaXRpbmcubGVuZ3RoKSB7XG4gICAgICAgIGNhbGxiYWNrKG51bGwsIGRhdGEsIHt9KTtcbiAgICB9XG59XG5cblxuZXhwb3J0cy5kZXB0aFNlcmlhbGlzZXIgPSBmdW5jdGlvbiAoZGVwdGgpIHtcbiAgICByZXR1cm4gXy5wYXJ0aWFsKGRlcHRoU2VyaWFsaXNlciwgZGVwdGgpO1xufTtcbmV4cG9ydHMuZGVwdGhTZXJpYWxpemVyID0gZnVuY3Rpb24gKGRlcHRoKSB7XG4gICAgcmV0dXJuIF8ucGFydGlhbChkZXB0aFNlcmlhbGlzZXIsIGRlcHRoKTtcbn07XG5leHBvcnRzLmlkU2VyaWFsaXplciA9IGlkU2VyaWFsaXNlcjtcbmV4cG9ydHMuaWRTZXJpYWxpc2VyID0gaWRTZXJpYWxpc2VyO1xuXG4iLCIvLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxuZnVuY3Rpb24gRXZlbnRFbWl0dGVyKCkge1xuICB0aGlzLl9ldmVudHMgPSB0aGlzLl9ldmVudHMgfHwge307XG4gIHRoaXMuX21heExpc3RlbmVycyA9IHRoaXMuX21heExpc3RlbmVycyB8fCB1bmRlZmluZWQ7XG59XG5tb2R1bGUuZXhwb3J0cyA9IEV2ZW50RW1pdHRlcjtcblxuLy8gQmFja3dhcmRzLWNvbXBhdCB3aXRoIG5vZGUgMC4xMC54XG5FdmVudEVtaXR0ZXIuRXZlbnRFbWl0dGVyID0gRXZlbnRFbWl0dGVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9ldmVudHMgPSB1bmRlZmluZWQ7XG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9tYXhMaXN0ZW5lcnMgPSB1bmRlZmluZWQ7XG5cbi8vIEJ5IGRlZmF1bHQgRXZlbnRFbWl0dGVycyB3aWxsIHByaW50IGEgd2FybmluZyBpZiBtb3JlIHRoYW4gMTAgbGlzdGVuZXJzIGFyZVxuLy8gYWRkZWQgdG8gaXQuIFRoaXMgaXMgYSB1c2VmdWwgZGVmYXVsdCB3aGljaCBoZWxwcyBmaW5kaW5nIG1lbW9yeSBsZWFrcy5cbkV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzID0gMTA7XG5cbi8vIE9idmlvdXNseSBub3QgYWxsIEVtaXR0ZXJzIHNob3VsZCBiZSBsaW1pdGVkIHRvIDEwLiBUaGlzIGZ1bmN0aW9uIGFsbG93c1xuLy8gdGhhdCB0byBiZSBpbmNyZWFzZWQuIFNldCB0byB6ZXJvIGZvciB1bmxpbWl0ZWQuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnNldE1heExpc3RlbmVycyA9IGZ1bmN0aW9uKG4pIHtcbiAgaWYgKCFpc051bWJlcihuKSB8fCBuIDwgMCB8fCBpc05hTihuKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ24gbXVzdCBiZSBhIHBvc2l0aXZlIG51bWJlcicpO1xuICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSBuO1xuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuZW1pdCA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIGVyLCBoYW5kbGVyLCBsZW4sIGFyZ3MsIGksIGxpc3RlbmVycztcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcblxuICAvLyBJZiB0aGVyZSBpcyBubyAnZXJyb3InIGV2ZW50IGxpc3RlbmVyIHRoZW4gdGhyb3cuXG4gIGlmICh0eXBlID09PSAnZXJyb3InKSB7XG4gICAgaWYgKCF0aGlzLl9ldmVudHMuZXJyb3IgfHxcbiAgICAgICAgKGlzT2JqZWN0KHRoaXMuX2V2ZW50cy5lcnJvcikgJiYgIXRoaXMuX2V2ZW50cy5lcnJvci5sZW5ndGgpKSB7XG4gICAgICBlciA9IGFyZ3VtZW50c1sxXTtcbiAgICAgIGlmIChlciBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICAgIHRocm93IGVyOyAvLyBVbmhhbmRsZWQgJ2Vycm9yJyBldmVudFxuICAgICAgfVxuICAgICAgdGhyb3cgVHlwZUVycm9yKCdVbmNhdWdodCwgdW5zcGVjaWZpZWQgXCJlcnJvclwiIGV2ZW50LicpO1xuICAgIH1cbiAgfVxuXG4gIGhhbmRsZXIgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgaWYgKGlzVW5kZWZpbmVkKGhhbmRsZXIpKVxuICAgIHJldHVybiBmYWxzZTtcblxuICBpZiAoaXNGdW5jdGlvbihoYW5kbGVyKSkge1xuICAgIHN3aXRjaCAoYXJndW1lbnRzLmxlbmd0aCkge1xuICAgICAgLy8gZmFzdCBjYXNlc1xuICAgICAgY2FzZSAxOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcyk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAyOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDM6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0sIGFyZ3VtZW50c1syXSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgLy8gc2xvd2VyXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBsZW4gPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgICAgICBhcmdzID0gbmV3IEFycmF5KGxlbiAtIDEpO1xuICAgICAgICBmb3IgKGkgPSAxOyBpIDwgbGVuOyBpKyspXG4gICAgICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG4gICAgICAgIGhhbmRsZXIuYXBwbHkodGhpcywgYXJncyk7XG4gICAgfVxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGhhbmRsZXIpKSB7XG4gICAgbGVuID0gYXJndW1lbnRzLmxlbmd0aDtcbiAgICBhcmdzID0gbmV3IEFycmF5KGxlbiAtIDEpO1xuICAgIGZvciAoaSA9IDE7IGkgPCBsZW47IGkrKylcbiAgICAgIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuXG4gICAgbGlzdGVuZXJzID0gaGFuZGxlci5zbGljZSgpO1xuICAgIGxlbiA9IGxpc3RlbmVycy5sZW5ndGg7XG4gICAgZm9yIChpID0gMDsgaSA8IGxlbjsgaSsrKVxuICAgICAgbGlzdGVuZXJzW2ldLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICB9XG5cbiAgcmV0dXJuIHRydWU7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgdmFyIG07XG5cbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuXG4gIC8vIFRvIGF2b2lkIHJlY3Vyc2lvbiBpbiB0aGUgY2FzZSB0aGF0IHR5cGUgPT09IFwibmV3TGlzdGVuZXJcIiEgQmVmb3JlXG4gIC8vIGFkZGluZyBpdCB0byB0aGUgbGlzdGVuZXJzLCBmaXJzdCBlbWl0IFwibmV3TGlzdGVuZXJcIi5cbiAgaWYgKHRoaXMuX2V2ZW50cy5uZXdMaXN0ZW5lcilcbiAgICB0aGlzLmVtaXQoJ25ld0xpc3RlbmVyJywgdHlwZSxcbiAgICAgICAgICAgICAgaXNGdW5jdGlvbihsaXN0ZW5lci5saXN0ZW5lcikgP1xuICAgICAgICAgICAgICBsaXN0ZW5lci5saXN0ZW5lciA6IGxpc3RlbmVyKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICAvLyBPcHRpbWl6ZSB0aGUgY2FzZSBvZiBvbmUgbGlzdGVuZXIuIERvbid0IG5lZWQgdGhlIGV4dHJhIGFycmF5IG9iamVjdC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBsaXN0ZW5lcjtcbiAgZWxzZSBpZiAoaXNPYmplY3QodGhpcy5fZXZlbnRzW3R5cGVdKSlcbiAgICAvLyBJZiB3ZSd2ZSBhbHJlYWR5IGdvdCBhbiBhcnJheSwganVzdCBhcHBlbmQuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdLnB1c2gobGlzdGVuZXIpO1xuICBlbHNlXG4gICAgLy8gQWRkaW5nIHRoZSBzZWNvbmQgZWxlbWVudCwgbmVlZCB0byBjaGFuZ2UgdG8gYXJyYXkuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gW3RoaXMuX2V2ZW50c1t0eXBlXSwgbGlzdGVuZXJdO1xuXG4gIC8vIENoZWNrIGZvciBsaXN0ZW5lciBsZWFrXG4gIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pICYmICF0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkKSB7XG4gICAgdmFyIG07XG4gICAgaWYgKCFpc1VuZGVmaW5lZCh0aGlzLl9tYXhMaXN0ZW5lcnMpKSB7XG4gICAgICBtID0gdGhpcy5fbWF4TGlzdGVuZXJzO1xuICAgIH0gZWxzZSB7XG4gICAgICBtID0gRXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnM7XG4gICAgfVxuXG4gICAgaWYgKG0gJiYgbSA+IDAgJiYgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCA+IG0pIHtcbiAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQgPSB0cnVlO1xuICAgICAgY29uc29sZS5lcnJvcignKG5vZGUpIHdhcm5pbmc6IHBvc3NpYmxlIEV2ZW50RW1pdHRlciBtZW1vcnkgJyArXG4gICAgICAgICAgICAgICAgICAgICdsZWFrIGRldGVjdGVkLiAlZCBsaXN0ZW5lcnMgYWRkZWQuICcgK1xuICAgICAgICAgICAgICAgICAgICAnVXNlIGVtaXR0ZXIuc2V0TWF4TGlzdGVuZXJzKCkgdG8gaW5jcmVhc2UgbGltaXQuJyxcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCk7XG4gICAgICBpZiAodHlwZW9mIGNvbnNvbGUudHJhY2UgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgLy8gbm90IHN1cHBvcnRlZCBpbiBJRSAxMFxuICAgICAgICBjb25zb2xlLnRyYWNlKCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uID0gRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lcjtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbmNlID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIHZhciBmaXJlZCA9IGZhbHNlO1xuXG4gIGZ1bmN0aW9uIGcoKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBnKTtcblxuICAgIGlmICghZmlyZWQpIHtcbiAgICAgIGZpcmVkID0gdHJ1ZTtcbiAgICAgIGxpc3RlbmVyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfVxuICB9XG5cbiAgZy5saXN0ZW5lciA9IGxpc3RlbmVyO1xuICB0aGlzLm9uKHR5cGUsIGcpO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuLy8gZW1pdHMgYSAncmVtb3ZlTGlzdGVuZXInIGV2ZW50IGlmZiB0aGUgbGlzdGVuZXIgd2FzIHJlbW92ZWRcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbGlzdCwgcG9zaXRpb24sIGxlbmd0aCwgaTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICByZXR1cm4gdGhpcztcblxuICBsaXN0ID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuICBsZW5ndGggPSBsaXN0Lmxlbmd0aDtcbiAgcG9zaXRpb24gPSAtMTtcblxuICBpZiAobGlzdCA9PT0gbGlzdGVuZXIgfHxcbiAgICAgIChpc0Z1bmN0aW9uKGxpc3QubGlzdGVuZXIpICYmIGxpc3QubGlzdGVuZXIgPT09IGxpc3RlbmVyKSkge1xuICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG5cbiAgfSBlbHNlIGlmIChpc09iamVjdChsaXN0KSkge1xuICAgIGZvciAoaSA9IGxlbmd0aDsgaS0tID4gMDspIHtcbiAgICAgIGlmIChsaXN0W2ldID09PSBsaXN0ZW5lciB8fFxuICAgICAgICAgIChsaXN0W2ldLmxpc3RlbmVyICYmIGxpc3RbaV0ubGlzdGVuZXIgPT09IGxpc3RlbmVyKSkge1xuICAgICAgICBwb3NpdGlvbiA9IGk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChwb3NpdGlvbiA8IDApXG4gICAgICByZXR1cm4gdGhpcztcblxuICAgIGlmIChsaXN0Lmxlbmd0aCA9PT0gMSkge1xuICAgICAgbGlzdC5sZW5ndGggPSAwO1xuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGlzdC5zcGxpY2UocG9zaXRpb24sIDEpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpXG4gICAgICB0aGlzLmVtaXQoJ3JlbW92ZUxpc3RlbmVyJywgdHlwZSwgbGlzdGVuZXIpO1xuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUFsbExpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIGtleSwgbGlzdGVuZXJzO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIC8vIG5vdCBsaXN0ZW5pbmcgZm9yIHJlbW92ZUxpc3RlbmVyLCBubyBuZWVkIHRvIGVtaXRcbiAgaWYgKCF0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpIHtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMClcbiAgICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIGVsc2UgaWYgKHRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvLyBlbWl0IHJlbW92ZUxpc3RlbmVyIGZvciBhbGwgbGlzdGVuZXJzIG9uIGFsbCBldmVudHNcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApIHtcbiAgICBmb3IgKGtleSBpbiB0aGlzLl9ldmVudHMpIHtcbiAgICAgIGlmIChrZXkgPT09ICdyZW1vdmVMaXN0ZW5lcicpIGNvbnRpbnVlO1xuICAgICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoa2V5KTtcbiAgICB9XG4gICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoJ3JlbW92ZUxpc3RlbmVyJyk7XG4gICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBsaXN0ZW5lcnMgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgaWYgKGlzRnVuY3Rpb24obGlzdGVuZXJzKSkge1xuICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzKTtcbiAgfSBlbHNlIHtcbiAgICAvLyBMSUZPIG9yZGVyXG4gICAgd2hpbGUgKGxpc3RlbmVycy5sZW5ndGgpXG4gICAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGxpc3RlbmVyc1tsaXN0ZW5lcnMubGVuZ3RoIC0gMV0pO1xuICB9XG4gIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmxpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIHJldDtcbiAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICByZXQgPSBbXTtcbiAgZWxzZSBpZiAoaXNGdW5jdGlvbih0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIHJldCA9IFt0aGlzLl9ldmVudHNbdHlwZV1dO1xuICBlbHNlXG4gICAgcmV0ID0gdGhpcy5fZXZlbnRzW3R5cGVdLnNsaWNlKCk7XG4gIHJldHVybiByZXQ7XG59O1xuXG5FdmVudEVtaXR0ZXIubGlzdGVuZXJDb3VudCA9IGZ1bmN0aW9uKGVtaXR0ZXIsIHR5cGUpIHtcbiAgdmFyIHJldDtcbiAgaWYgKCFlbWl0dGVyLl9ldmVudHMgfHwgIWVtaXR0ZXIuX2V2ZW50c1t0eXBlXSlcbiAgICByZXQgPSAwO1xuICBlbHNlIGlmIChpc0Z1bmN0aW9uKGVtaXR0ZXIuX2V2ZW50c1t0eXBlXSkpXG4gICAgcmV0ID0gMTtcbiAgZWxzZVxuICAgIHJldCA9IGVtaXR0ZXIuX2V2ZW50c1t0eXBlXS5sZW5ndGg7XG4gIHJldHVybiByZXQ7XG59O1xuXG5mdW5jdGlvbiBpc0Z1bmN0aW9uKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ2Z1bmN0aW9uJztcbn1cblxuZnVuY3Rpb24gaXNOdW1iZXIoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnbnVtYmVyJztcbn1cblxuZnVuY3Rpb24gaXNPYmplY3QoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnb2JqZWN0JyAmJiBhcmcgIT09IG51bGw7XG59XG5cbmZ1bmN0aW9uIGlzVW5kZWZpbmVkKGFyZykge1xuICByZXR1cm4gYXJnID09PSB2b2lkIDA7XG59XG4iLCIvLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxuJ3VzZSBzdHJpY3QnO1xuXG4vLyBJZiBvYmouaGFzT3duUHJvcGVydHkgaGFzIGJlZW4gb3ZlcnJpZGRlbiwgdGhlbiBjYWxsaW5nXG4vLyBvYmouaGFzT3duUHJvcGVydHkocHJvcCkgd2lsbCBicmVhay5cbi8vIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL2pveWVudC9ub2RlL2lzc3Vlcy8xNzA3XG5mdW5jdGlvbiBoYXNPd25Qcm9wZXJ0eShvYmosIHByb3ApIHtcbiAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvYmosIHByb3ApO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHFzLCBzZXAsIGVxLCBvcHRpb25zKSB7XG4gIHNlcCA9IHNlcCB8fCAnJic7XG4gIGVxID0gZXEgfHwgJz0nO1xuICB2YXIgb2JqID0ge307XG5cbiAgaWYgKHR5cGVvZiBxcyAhPT0gJ3N0cmluZycgfHwgcXMubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuXG4gIHZhciByZWdleHAgPSAvXFwrL2c7XG4gIHFzID0gcXMuc3BsaXQoc2VwKTtcblxuICB2YXIgbWF4S2V5cyA9IDEwMDA7XG4gIGlmIChvcHRpb25zICYmIHR5cGVvZiBvcHRpb25zLm1heEtleXMgPT09ICdudW1iZXInKSB7XG4gICAgbWF4S2V5cyA9IG9wdGlvbnMubWF4S2V5cztcbiAgfVxuXG4gIHZhciBsZW4gPSBxcy5sZW5ndGg7XG4gIC8vIG1heEtleXMgPD0gMCBtZWFucyB0aGF0IHdlIHNob3VsZCBub3QgbGltaXQga2V5cyBjb3VudFxuICBpZiAobWF4S2V5cyA+IDAgJiYgbGVuID4gbWF4S2V5cykge1xuICAgIGxlbiA9IG1heEtleXM7XG4gIH1cblxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbjsgKytpKSB7XG4gICAgdmFyIHggPSBxc1tpXS5yZXBsYWNlKHJlZ2V4cCwgJyUyMCcpLFxuICAgICAgICBpZHggPSB4LmluZGV4T2YoZXEpLFxuICAgICAgICBrc3RyLCB2c3RyLCBrLCB2O1xuXG4gICAgaWYgKGlkeCA+PSAwKSB7XG4gICAgICBrc3RyID0geC5zdWJzdHIoMCwgaWR4KTtcbiAgICAgIHZzdHIgPSB4LnN1YnN0cihpZHggKyAxKTtcbiAgICB9IGVsc2Uge1xuICAgICAga3N0ciA9IHg7XG4gICAgICB2c3RyID0gJyc7XG4gICAgfVxuXG4gICAgayA9IGRlY29kZVVSSUNvbXBvbmVudChrc3RyKTtcbiAgICB2ID0gZGVjb2RlVVJJQ29tcG9uZW50KHZzdHIpO1xuXG4gICAgaWYgKCFoYXNPd25Qcm9wZXJ0eShvYmosIGspKSB7XG4gICAgICBvYmpba10gPSB2O1xuICAgIH0gZWxzZSBpZiAoaXNBcnJheShvYmpba10pKSB7XG4gICAgICBvYmpba10ucHVzaCh2KTtcbiAgICB9IGVsc2Uge1xuICAgICAgb2JqW2tdID0gW29ialtrXSwgdl07XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIG9iajtcbn07XG5cbnZhciBpc0FycmF5ID0gQXJyYXkuaXNBcnJheSB8fCBmdW5jdGlvbiAoeHMpIHtcbiAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbCh4cykgPT09ICdbb2JqZWN0IEFycmF5XSc7XG59O1xuIiwiLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGFcbi8vIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGVcbi8vIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZ1xuLy8gd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLFxuLy8gZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdFxuLy8gcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlXG4vLyBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZFxuLy8gaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTU1xuLy8gT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRlxuLy8gTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTlxuLy8gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sXG4vLyBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1Jcbi8vIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEVcbi8vIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG5cbid1c2Ugc3RyaWN0JztcblxudmFyIHN0cmluZ2lmeVByaW1pdGl2ZSA9IGZ1bmN0aW9uKHYpIHtcbiAgc3dpdGNoICh0eXBlb2Ygdikge1xuICAgIGNhc2UgJ3N0cmluZyc6XG4gICAgICByZXR1cm4gdjtcblxuICAgIGNhc2UgJ2Jvb2xlYW4nOlxuICAgICAgcmV0dXJuIHYgPyAndHJ1ZScgOiAnZmFsc2UnO1xuXG4gICAgY2FzZSAnbnVtYmVyJzpcbiAgICAgIHJldHVybiBpc0Zpbml0ZSh2KSA/IHYgOiAnJztcblxuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gJyc7XG4gIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24ob2JqLCBzZXAsIGVxLCBuYW1lKSB7XG4gIHNlcCA9IHNlcCB8fCAnJic7XG4gIGVxID0gZXEgfHwgJz0nO1xuICBpZiAob2JqID09PSBudWxsKSB7XG4gICAgb2JqID0gdW5kZWZpbmVkO1xuICB9XG5cbiAgaWYgKHR5cGVvZiBvYmogPT09ICdvYmplY3QnKSB7XG4gICAgcmV0dXJuIG1hcChvYmplY3RLZXlzKG9iaiksIGZ1bmN0aW9uKGspIHtcbiAgICAgIHZhciBrcyA9IGVuY29kZVVSSUNvbXBvbmVudChzdHJpbmdpZnlQcmltaXRpdmUoaykpICsgZXE7XG4gICAgICBpZiAoaXNBcnJheShvYmpba10pKSB7XG4gICAgICAgIHJldHVybiBtYXAob2JqW2tdLCBmdW5jdGlvbih2KSB7XG4gICAgICAgICAgcmV0dXJuIGtzICsgZW5jb2RlVVJJQ29tcG9uZW50KHN0cmluZ2lmeVByaW1pdGl2ZSh2KSk7XG4gICAgICAgIH0pLmpvaW4oc2VwKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBrcyArIGVuY29kZVVSSUNvbXBvbmVudChzdHJpbmdpZnlQcmltaXRpdmUob2JqW2tdKSk7XG4gICAgICB9XG4gICAgfSkuam9pbihzZXApO1xuXG4gIH1cblxuICBpZiAoIW5hbWUpIHJldHVybiAnJztcbiAgcmV0dXJuIGVuY29kZVVSSUNvbXBvbmVudChzdHJpbmdpZnlQcmltaXRpdmUobmFtZSkpICsgZXEgK1xuICAgICAgICAgZW5jb2RlVVJJQ29tcG9uZW50KHN0cmluZ2lmeVByaW1pdGl2ZShvYmopKTtcbn07XG5cbnZhciBpc0FycmF5ID0gQXJyYXkuaXNBcnJheSB8fCBmdW5jdGlvbiAoeHMpIHtcbiAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbCh4cykgPT09ICdbb2JqZWN0IEFycmF5XSc7XG59O1xuXG5mdW5jdGlvbiBtYXAgKHhzLCBmKSB7XG4gIGlmICh4cy5tYXApIHJldHVybiB4cy5tYXAoZik7XG4gIHZhciByZXMgPSBbXTtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCB4cy5sZW5ndGg7IGkrKykge1xuICAgIHJlcy5wdXNoKGYoeHNbaV0sIGkpKTtcbiAgfVxuICByZXR1cm4gcmVzO1xufVxuXG52YXIgb2JqZWN0S2V5cyA9IE9iamVjdC5rZXlzIHx8IGZ1bmN0aW9uIChvYmopIHtcbiAgdmFyIHJlcyA9IFtdO1xuICBmb3IgKHZhciBrZXkgaW4gb2JqKSB7XG4gICAgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvYmosIGtleSkpIHJlcy5wdXNoKGtleSk7XG4gIH1cbiAgcmV0dXJuIHJlcztcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbmV4cG9ydHMuZGVjb2RlID0gZXhwb3J0cy5wYXJzZSA9IHJlcXVpcmUoJy4vZGVjb2RlJyk7XG5leHBvcnRzLmVuY29kZSA9IGV4cG9ydHMuc3RyaW5naWZ5ID0gcmVxdWlyZSgnLi9lbmNvZGUnKTtcbiIsInZhciBoYXNPd24gPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5O1xudmFyIHRvU3RyaW5nID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZztcbnZhciB1bmRlZmluZWQ7XG5cbnZhciBpc1BsYWluT2JqZWN0ID0gZnVuY3Rpb24gaXNQbGFpbk9iamVjdChvYmopIHtcbiAgICBcInVzZSBzdHJpY3RcIjtcbiAgICBpZiAoIW9iaiB8fCB0b1N0cmluZy5jYWxsKG9iaikgIT09ICdbb2JqZWN0IE9iamVjdF0nIHx8IG9iai5ub2RlVHlwZSB8fCBvYmouc2V0SW50ZXJ2YWwpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHZhciBoYXNfb3duX2NvbnN0cnVjdG9yID0gaGFzT3duLmNhbGwob2JqLCAnY29uc3RydWN0b3InKTtcbiAgICB2YXIgaGFzX2lzX3Byb3BlcnR5X29mX21ldGhvZCA9IG9iai5jb25zdHJ1Y3RvciAmJiBvYmouY29uc3RydWN0b3IucHJvdG90eXBlICYmIGhhc093bi5jYWxsKG9iai5jb25zdHJ1Y3Rvci5wcm90b3R5cGUsICdpc1Byb3RvdHlwZU9mJyk7XG4gICAgLy8gTm90IG93biBjb25zdHJ1Y3RvciBwcm9wZXJ0eSBtdXN0IGJlIE9iamVjdFxuICAgIGlmIChvYmouY29uc3RydWN0b3IgJiYgIWhhc19vd25fY29uc3RydWN0b3IgJiYgIWhhc19pc19wcm9wZXJ0eV9vZl9tZXRob2QpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIC8vIE93biBwcm9wZXJ0aWVzIGFyZSBlbnVtZXJhdGVkIGZpcnN0bHksIHNvIHRvIHNwZWVkIHVwLFxuICAgIC8vIGlmIGxhc3Qgb25lIGlzIG93biwgdGhlbiBhbGwgcHJvcGVydGllcyBhcmUgb3duLlxuICAgIHZhciBrZXk7XG4gICAgZm9yIChrZXkgaW4gb2JqKSB7fVxuXG4gICAgcmV0dXJuIGtleSA9PT0gdW5kZWZpbmVkIHx8IGhhc093bi5jYWxsKG9iaiwga2V5KTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gZXh0ZW5kKCkge1xuICAgIFwidXNlIHN0cmljdFwiO1xuICAgIHZhciBvcHRpb25zLCBuYW1lLCBzcmMsIGNvcHksIGNvcHlJc0FycmF5LCBjbG9uZSxcbiAgICAgICAgdGFyZ2V0ID0gYXJndW1lbnRzWzBdLFxuICAgICAgICBpID0gMSxcbiAgICAgICAgbGVuZ3RoID0gYXJndW1lbnRzLmxlbmd0aCxcbiAgICAgICAgZGVlcCA9IGZhbHNlO1xuXG4gICAgLy8gSGFuZGxlIGEgZGVlcCBjb3B5IHNpdHVhdGlvblxuICAgIGlmICh0eXBlb2YgdGFyZ2V0ID09PSBcImJvb2xlYW5cIikge1xuICAgICAgICBkZWVwID0gdGFyZ2V0O1xuICAgICAgICB0YXJnZXQgPSBhcmd1bWVudHNbMV0gfHwge307XG4gICAgICAgIC8vIHNraXAgdGhlIGJvb2xlYW4gYW5kIHRoZSB0YXJnZXRcbiAgICAgICAgaSA9IDI7XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgdGFyZ2V0ICE9PSBcIm9iamVjdFwiICYmIHR5cGVvZiB0YXJnZXQgIT09IFwiZnVuY3Rpb25cIiB8fCB0YXJnZXQgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHRhcmdldCA9IHt9O1xuICAgIH1cblxuICAgIGZvciAoOyBpIDwgbGVuZ3RoOyArK2kpIHtcbiAgICAgICAgLy8gT25seSBkZWFsIHdpdGggbm9uLW51bGwvdW5kZWZpbmVkIHZhbHVlc1xuICAgICAgICBpZiAoKG9wdGlvbnMgPSBhcmd1bWVudHNbaV0pICE9IG51bGwpIHtcbiAgICAgICAgICAgIC8vIEV4dGVuZCB0aGUgYmFzZSBvYmplY3RcbiAgICAgICAgICAgIGZvciAobmFtZSBpbiBvcHRpb25zKSB7XG4gICAgICAgICAgICAgICAgc3JjID0gdGFyZ2V0W25hbWVdO1xuICAgICAgICAgICAgICAgIGNvcHkgPSBvcHRpb25zW25hbWVdO1xuXG4gICAgICAgICAgICAgICAgLy8gUHJldmVudCBuZXZlci1lbmRpbmcgbG9vcFxuICAgICAgICAgICAgICAgIGlmICh0YXJnZXQgPT09IGNvcHkpIHtcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gUmVjdXJzZSBpZiB3ZSdyZSBtZXJnaW5nIHBsYWluIG9iamVjdHMgb3IgYXJyYXlzXG4gICAgICAgICAgICAgICAgaWYgKGRlZXAgJiYgY29weSAmJiAoaXNQbGFpbk9iamVjdChjb3B5KSB8fCAoY29weUlzQXJyYXkgPSBBcnJheS5pc0FycmF5KGNvcHkpKSkpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGNvcHlJc0FycmF5KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb3B5SXNBcnJheSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgY2xvbmUgPSBzcmMgJiYgQXJyYXkuaXNBcnJheShzcmMpID8gc3JjIDogW107XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjbG9uZSA9IHNyYyAmJiBpc1BsYWluT2JqZWN0KHNyYykgPyBzcmMgOiB7fTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIE5ldmVyIG1vdmUgb3JpZ2luYWwgb2JqZWN0cywgY2xvbmUgdGhlbVxuICAgICAgICAgICAgICAgICAgICB0YXJnZXRbbmFtZV0gPSBleHRlbmQoZGVlcCwgY2xvbmUsIGNvcHkpO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIERvbid0IGJyaW5nIGluIHVuZGVmaW5lZCB2YWx1ZXNcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGNvcHkgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICB0YXJnZXRbbmFtZV0gPSBjb3B5O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIFJldHVybiB0aGUgbW9kaWZpZWQgb2JqZWN0XG4gICAgcmV0dXJuIHRhcmdldDtcbn07XG5cbiIsImlmICh0eXBlb2Ygc2llc3RhID09ICd1bmRlZmluZWQnICYmIHR5cGVvZiBtb2R1bGUgPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0NvdWxkIG5vdCBmaW5kIHdpbmRvdy5zaWVzdGEuIE1ha2Ugc3VyZSB5b3UgaW5jbHVkZSBzaWVzdGEuY29yZS5qcyBmaXJzdC4nKTtcbn1cblxudmFyIF9pID0gc2llc3RhLl9pbnRlcm5hbCxcbiAgICBjYWNoZSA9IF9pLmNhY2hlLFxuICAgIENvbGxlY3Rpb25SZWdpc3RyeSA9IF9pLkNvbGxlY3Rpb25SZWdpc3RyeSxcbiAgICBsb2cgPSBfaS5sb2csXG4gICAgdXRpbCA9IF9pLnV0aWwsXG4gICAgXyA9IHV0aWwuXyxcbiAgICBldmVudHMgPSBfaS5ldmVudHM7XG5cbnZhciB1bnNhdmVkT2JqZWN0cyA9IFtdLFxuICAgIHVuc2F2ZWRPYmplY3RzSGFzaCA9IHt9LFxuICAgIHVuc2F2ZWRPYmplY3RzQnlDb2xsZWN0aW9uID0ge307XG5cbnZhciBzdG9yYWdlID0ge30sXG4gICAgTG9nZ2VyID0gbG9nLmxvZ2dlcldpdGhOYW1lKCdTdG9yYWdlJyk7XG5cbmlmICh0eXBlb2YgUG91Y2hEQiA9PSAndW5kZWZpbmVkJykge1xuICAgIHNpZXN0YS5leHQuc3RvcmFnZUVuYWJsZWQgPSBmYWxzZTtcbiAgICBjb25zb2xlLmxvZygnUG91Y2hEQiBpcyBub3QgcHJlc2VudCB0aGVyZWZvcmUgc3RvcmFnZSBpcyBkaXNhYmxlZC4nKTtcbn1cbmVsc2Uge1xuICAgIHZhciBEQl9OQU1FID0gJ3NpZXN0YScsXG4gICAgICAgIHBvdWNoID0gbmV3IFBvdWNoREIoREJfTkFNRSk7XG5cbiAgICAvKipcbiAgICAgKiBTZXJpYWxpc2UgYSBtb2RlbCBpbnRvIGEgZm9ybWF0IHRoYXQgUG91Y2hEQiBidWxrRG9jcyBBUEkgY2FuIHByb2Nlc3NcbiAgICAgKiBAcGFyYW0ge01vZGVsSW5zdGFuY2V9IG1vZGVsSW5zdGFuY2VcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBfc2VyaWFsaXNlKG1vZGVsSW5zdGFuY2UpIHtcbiAgICAgICAgdmFyIHNlcmlhbGlzZWQgPSBzaWVzdGEuXy5leHRlbmQoe30sIG1vZGVsSW5zdGFuY2UuX192YWx1ZXMpO1xuICAgICAgICBzZXJpYWxpc2VkWydjb2xsZWN0aW9uJ10gPSBtb2RlbEluc3RhbmNlLmNvbGxlY3Rpb25OYW1lO1xuICAgICAgICBzZXJpYWxpc2VkWydtb2RlbCddID0gbW9kZWxJbnN0YW5jZS5tb2RlbE5hbWU7XG4gICAgICAgIHNlcmlhbGlzZWRbJ19pZCddID0gbW9kZWxJbnN0YW5jZS5faWQ7XG4gICAgICAgIGlmIChtb2RlbEluc3RhbmNlLnJlbW92ZWQpIHNlcmlhbGlzZWRbJ19kZWxldGVkJ10gPSB0cnVlO1xuICAgICAgICB2YXIgcmV2ID0gbW9kZWxJbnN0YW5jZS5fcmV2O1xuICAgICAgICBpZiAocmV2KSBzZXJpYWxpc2VkWydfcmV2J10gPSByZXY7XG4gICAgICAgIHNlcmlhbGlzZWQgPSBfLnJlZHVjZShtb2RlbEluc3RhbmNlLl9yZWxhdGlvbnNoaXBOYW1lcywgZnVuY3Rpb24gKG1lbW8sIG4pIHtcbiAgICAgICAgICAgIHZhciB2YWwgPSBtb2RlbEluc3RhbmNlW25dO1xuICAgICAgICAgICAgaWYgKHNpZXN0YS5pc0FycmF5KHZhbCkpIHtcbiAgICAgICAgICAgICAgICBtZW1vW25dID0gXy5wbHVjayh2YWwsICdfaWQnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKHZhbCkge1xuICAgICAgICAgICAgICAgIG1lbW9bbl0gPSB2YWwuX2lkO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIG1lbW87XG4gICAgICAgIH0sIHNlcmlhbGlzZWQpO1xuICAgICAgICByZXR1cm4gc2VyaWFsaXNlZDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBfcHJlcGFyZURhdHVtKGRhdHVtLCBtb2RlbCkge1xuICAgICAgICAvLyBBZGQgYmxhbmsgb2JqZWN0IHdpdGggY29ycmVjdCBfaWQgdG8gdGhlIGNhY2hlIHNvIHRoYXQgY2FuIG1hcCBkYXRhIG9udG8gaXQuXG4gICAgICAgIGRlbGV0ZSBkYXR1bS5jb2xsZWN0aW9uO1xuICAgICAgICBkZWxldGUgZGF0dW0ubW9kZWw7XG4gICAgICAgIHZhciByZWxhdGlvbnNoaXBOYW1lcyA9IG1vZGVsLl9yZWxhdGlvbnNoaXBOYW1lcztcbiAgICAgICAgXy5lYWNoKHJlbGF0aW9uc2hpcE5hbWVzLCBmdW5jdGlvbiAocikge1xuICAgICAgICAgICAgdmFyIF9pZCA9IGRhdHVtW3JdO1xuICAgICAgICAgICAgaWYgKHNpZXN0YS5pc0FycmF5KF9pZCkpIHtcbiAgICAgICAgICAgICAgICBkYXR1bVtyXSA9IF8ubWFwKF9pZCwgZnVuY3Rpb24gKHgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHtfaWQ6IHh9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBkYXR1bVtyXSA9IHtfaWQ6IF9pZH07XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gZGF0dW07XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICpcbiAgICAgKiBAcGFyYW0gb3B0c1xuICAgICAqIEBwYXJhbSBvcHRzLmNvbGxlY3Rpb25OYW1lXG4gICAgICogQHBhcmFtIG9wdHMubW9kZWxOYW1lXG4gICAgICogQHBhcmFtIGNhbGxiYWNrXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBfbG9hZE1vZGVsKG9wdHMsIGNhbGxiYWNrKSB7XG4gICAgICAgIHZhciBjb2xsZWN0aW9uTmFtZSA9IG9wdHMuY29sbGVjdGlvbk5hbWUsXG4gICAgICAgICAgICBtb2RlbE5hbWUgPSBvcHRzLm1vZGVsTmFtZTtcbiAgICAgICAgaWYgKExvZ2dlci50cmFjZSkge1xuICAgICAgICAgICAgdmFyIGZ1bGx5UXVhbGlmaWVkTmFtZSA9IGNvbGxlY3Rpb25OYW1lICsgJy4nICsgbW9kZWxOYW1lO1xuICAgICAgICAgICAgTG9nZ2VyLnRyYWNlKCdMb2FkaW5nIGluc3RhbmNlcyBmb3IgJyArIGZ1bGx5UXVhbGlmaWVkTmFtZSk7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIE1vZGVsID0gQ29sbGVjdGlvblJlZ2lzdHJ5W2NvbGxlY3Rpb25OYW1lXVttb2RlbE5hbWVdO1xuICAgICAgICB2YXIgbWFwRnVuYyA9IGZ1bmN0aW9uIChkb2MpIHtcbiAgICAgICAgICAgIGlmIChkb2MubW9kZWwgPT0gJyQxJyAmJiBkb2MuY29sbGVjdGlvbiA9PSAnJDInKSB7XG4gICAgICAgICAgICAgICAgLy9ub2luc3BlY3Rpb24gSlNVbnJlc29sdmVkRnVuY3Rpb25cbiAgICAgICAgICAgICAgICBlbWl0KGRvYy5faWQsIGRvYyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0udG9TdHJpbmcoKS5yZXBsYWNlKCckMScsIG1vZGVsTmFtZSkucmVwbGFjZSgnJDInLCBjb2xsZWN0aW9uTmFtZSk7XG4gICAgICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKSBMb2dnZXIudHJhY2UoJ1F1ZXJ5aW5nIHBvdWNoJyk7XG4gICAgICAgIHBvdWNoLnF1ZXJ5KHttYXA6IG1hcEZ1bmN9KVxuICAgICAgICAgICAgLnRoZW4oZnVuY3Rpb24gKHJlc3ApIHtcbiAgICAgICAgICAgICAgICBpZiAoTG9nZ2VyLnRyYWNlLmlzRW5hYmxlZCkgTG9nZ2VyLnRyYWNlKCdRdWVyaWVkIHBvdWNoIHN1Y2Nlc2ZmdWxseScpO1xuICAgICAgICAgICAgICAgIHZhciBkYXRhID0gc2llc3RhLl8ubWFwKHNpZXN0YS5fLnBsdWNrKHJlc3Aucm93cywgJ3ZhbHVlJyksIGZ1bmN0aW9uIChkYXR1bSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gX3ByZXBhcmVEYXR1bShkYXR1bSwgTW9kZWwpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKSBMb2dnZXIudHJhY2UoJ01hcHBpbmcgZGF0YScsIGRhdGEpO1xuICAgICAgICAgICAgICAgIE1vZGVsLmdyYXBoKGRhdGEsIHtcbiAgICAgICAgICAgICAgICAgICAgZGlzYWJsZWV2ZW50czogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgX2lnbm9yZUluc3RhbGxlZDogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgZnJvbVN0b3JhZ2U6IHRydWVcbiAgICAgICAgICAgICAgICB9LCBmdW5jdGlvbiAoZXJyLCBpbnN0YW5jZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgTG9nZ2VyLnRyYWNlKCdMb2FkZWQgJyArIGluc3RhbmNlcyA/IGluc3RhbmNlcy5sZW5ndGgudG9TdHJpbmcoKSA6IDAgKyAnIGluc3RhbmNlcyBmb3IgJyArIGZ1bGx5UXVhbGlmaWVkTmFtZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBMb2dnZXIuZXJyb3IoJ0Vycm9yIGxvYWRpbmcgbW9kZWxzJywgZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIsIGluc3RhbmNlcyk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgLmNhdGNoKGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogTG9hZCBhbGwgZGF0YSBmcm9tIFBvdWNoREIuXG4gICAgICovXG4gICAgZnVuY3Rpb24gX2xvYWQoY2FsbGJhY2spIHtcbiAgICAgICAgaWYgKHNhdmluZykgdGhyb3cgbmV3IEVycm9yKCdub3QgbG9hZGVkIHlldCBob3cgY2FuIGkgc2F2ZScpO1xuICAgICAgICB2YXIgZGVmZXJyZWQgPSB1dGlsLmRlZmVyKGNhbGxiYWNrKTtcbiAgICAgICAgaWYgKHNpZXN0YS5leHQuc3RvcmFnZUVuYWJsZWQpIHtcbiAgICAgICAgICAgIHZhciBjb2xsZWN0aW9uTmFtZXMgPSBDb2xsZWN0aW9uUmVnaXN0cnkuY29sbGVjdGlvbk5hbWVzO1xuICAgICAgICAgICAgdmFyIHRhc2tzID0gW107XG4gICAgICAgICAgICBfLmVhY2goY29sbGVjdGlvbk5hbWVzLCBmdW5jdGlvbiAoY29sbGVjdGlvbk5hbWUpIHtcbiAgICAgICAgICAgICAgICB2YXIgY29sbGVjdGlvbiA9IENvbGxlY3Rpb25SZWdpc3RyeVtjb2xsZWN0aW9uTmFtZV0sXG4gICAgICAgICAgICAgICAgICAgIG1vZGVsTmFtZXMgPSBPYmplY3Qua2V5cyhjb2xsZWN0aW9uLl9tb2RlbHMpO1xuICAgICAgICAgICAgICAgIF8uZWFjaChtb2RlbE5hbWVzLCBmdW5jdGlvbiAobW9kZWxOYW1lKSB7XG4gICAgICAgICAgICAgICAgICAgIHRhc2tzLnB1c2goZnVuY3Rpb24gKGNiKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBfbG9hZE1vZGVsKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb2xsZWN0aW9uTmFtZTogY29sbGVjdGlvbk5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbW9kZWxOYW1lOiBtb2RlbE5hbWVcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sIGNiKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHNpZXN0YS5hc3luYy5wYXJhbGxlbCh0YXNrcywgZnVuY3Rpb24gKGVyciwgcmVzdWx0cykge1xuICAgICAgICAgICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBpbnN0YW5jZXMgPSBbXTtcbiAgICAgICAgICAgICAgICAgICAgc2llc3RhLl8uZWFjaChyZXN1bHRzLCBmdW5jdGlvbiAocikge1xuICAgICAgICAgICAgICAgICAgICAgICAgaW5zdGFuY2VzLmNvbmNhdChyKVxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKExvZ2dlci50cmFjZSkgTG9nZ2VyLnRyYWNlKCdMb2FkZWQgJyArIGluc3RhbmNlcy5sZW5ndGgudG9TdHJpbmcoKSArICcgaW5zdGFuY2VzJyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGRlZmVycmVkLmZpbmlzaChlcnIpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBkZWZlcnJlZC5maW5pc2goKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBzYXZlQ29uZmxpY3RzKG9iamVjdHMsIGNhbGxiYWNrLCBkZWZlcnJlZCkge1xuICAgICAgICBwb3VjaC5hbGxEb2NzKHtrZXlzOiBfLnBsdWNrKG9iamVjdHMsICdfaWQnKX0pXG4gICAgICAgICAgICAudGhlbihmdW5jdGlvbiAocmVzcCkge1xuICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcmVzcC5yb3dzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIG9iamVjdHNbaV0uX3JldiA9IHJlc3Aucm93c1tpXS52YWx1ZS5yZXY7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHNhdmVUb1BvdWNoKG9iamVjdHMsIGNhbGxiYWNrLCBkZWZlcnJlZCk7XG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgLmNhdGNoKGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgICAgICBkZWZlcnJlZC5yZWplY3QoZXJyKTtcbiAgICAgICAgICAgIH0pXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gc2F2ZVRvUG91Y2gob2JqZWN0cywgY2FsbGJhY2ssIGRlZmVycmVkKSB7XG4gICAgICAgIHZhciBjb25mbGljdHMgPSBbXTtcbiAgICAgICAgcG91Y2guYnVsa0RvY3MoXy5tYXAob2JqZWN0cywgX3NlcmlhbGlzZSkpLnRoZW4oZnVuY3Rpb24gKHJlc3ApIHtcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcmVzcC5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIHZhciByZXNwb25zZSA9IHJlc3BbaV07XG4gICAgICAgICAgICAgICAgdmFyIG9iaiA9IG9iamVjdHNbaV07XG4gICAgICAgICAgICAgICAgaWYgKHJlc3BvbnNlLm9rKSB7XG4gICAgICAgICAgICAgICAgICAgIG9iai5fcmV2ID0gcmVzcG9uc2UucmV2O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIGlmIChyZXNwb25zZS5zdGF0dXMgPT0gNDA5KSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbmZsaWN0cy5wdXNoKG9iaik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBMb2dnZXIuZXJyb3IoJ0Vycm9yIHNhdmluZyBvYmplY3Qgd2l0aCBfaWQ9XCInICsgb2JqLl9pZCArICdcIicsIHJlc3BvbnNlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoY29uZmxpY3RzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIHNhdmVDb25mbGljdHMoY29uZmxpY3RzLCBjYWxsYmFjaywgZGVmZXJyZWQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soKTtcbiAgICAgICAgICAgICAgICBpZiAoZGVmZXJyZWQpIGRlZmVycmVkLnJlc29sdmUoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSwgZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgIGlmIChkZWZlcnJlZCkgZGVmZXJyZWQucmVqZWN0KGVycik7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNhdmUgYWxsIG1vZGVsRXZlbnRzIGRvd24gdG8gUG91Y2hEQi5cbiAgICAgKi9cbiAgICBmdW5jdGlvbiBzYXZlKGNhbGxiYWNrKSB7XG4gICAgICAgIHZhciBkZWZlcnJlZCA9IHV0aWwuZGVmZXIoY2FsbGJhY2spO1xuICAgICAgICBzaWVzdGEuX2FmdGVySW5zdGFsbChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBjYWxsYmFjayA9IGNhbGxiYWNrIHx8IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICB2YXIgb2JqZWN0cyA9IHVuc2F2ZWRPYmplY3RzO1xuICAgICAgICAgICAgdW5zYXZlZE9iamVjdHMgPSBbXTtcbiAgICAgICAgICAgIHVuc2F2ZWRPYmplY3RzSGFzaCA9IHt9O1xuICAgICAgICAgICAgdW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb24gPSB7fTtcbiAgICAgICAgICAgIGlmIChMb2dnZXIudHJhY2UpIHtcbiAgICAgICAgICAgICAgICBMb2dnZXIudHJhY2UoJ1NhdmluZyBvYmplY3RzJywgXy5tYXAob2JqZWN0cywgZnVuY3Rpb24gKHgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHguX2R1bXAoKVxuICAgICAgICAgICAgICAgIH0pKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgc2F2ZVRvUG91Y2gob2JqZWN0cywgY2FsbGJhY2ssIGRlZmVycmVkKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xuICAgIH1cblxuICAgIHZhciBsaXN0ZW5lciA9IGZ1bmN0aW9uIChuKSB7XG4gICAgICAgIHZhciBjaGFuZ2VkT2JqZWN0ID0gbi5vYmosXG4gICAgICAgICAgICBpZGVudCA9IGNoYW5nZWRPYmplY3QuX2lkO1xuICAgICAgICBpZiAoIWNoYW5nZWRPYmplY3QpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBfaS5lcnJvci5JbnRlcm5hbFNpZXN0YUVycm9yKCdObyBvYmogZmllbGQgaW4gbm90aWZpY2F0aW9uIHJlY2VpdmVkIGJ5IHN0b3JhZ2UgZXh0ZW5zaW9uJyk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCEoaWRlbnQgaW4gdW5zYXZlZE9iamVjdHNIYXNoKSkge1xuICAgICAgICAgICAgdW5zYXZlZE9iamVjdHNIYXNoW2lkZW50XSA9IGNoYW5nZWRPYmplY3Q7XG4gICAgICAgICAgICB1bnNhdmVkT2JqZWN0cy5wdXNoKGNoYW5nZWRPYmplY3QpO1xuICAgICAgICAgICAgdmFyIGNvbGxlY3Rpb25OYW1lID0gY2hhbmdlZE9iamVjdC5jb2xsZWN0aW9uTmFtZTtcbiAgICAgICAgICAgIGlmICghdW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb25bY29sbGVjdGlvbk5hbWVdKSB7XG4gICAgICAgICAgICAgICAgdW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb25bY29sbGVjdGlvbk5hbWVdID0ge307XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB2YXIgbW9kZWxOYW1lID0gY2hhbmdlZE9iamVjdC5tb2RlbC5uYW1lO1xuICAgICAgICAgICAgaWYgKCF1bnNhdmVkT2JqZWN0c0J5Q29sbGVjdGlvbltjb2xsZWN0aW9uTmFtZV1bbW9kZWxOYW1lXSkge1xuICAgICAgICAgICAgICAgIHVuc2F2ZWRPYmplY3RzQnlDb2xsZWN0aW9uW2NvbGxlY3Rpb25OYW1lXVttb2RlbE5hbWVdID0ge307XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB1bnNhdmVkT2JqZWN0c0J5Q29sbGVjdGlvbltjb2xsZWN0aW9uTmFtZV1bbW9kZWxOYW1lXVtpZGVudF0gPSBjaGFuZ2VkT2JqZWN0O1xuICAgICAgICB9XG4gICAgfTtcbiAgICBzaWVzdGEub24oJ1NpZXN0YScsIGxpc3RlbmVyKTtcblxuXG4gICAgXy5leHRlbmQoc3RvcmFnZSwge1xuICAgICAgICBfbG9hZDogX2xvYWQsXG4gICAgICAgIHNhdmU6IHNhdmUsXG4gICAgICAgIF9zZXJpYWxpc2U6IF9zZXJpYWxpc2UsXG4gICAgICAgIF9yZXNldDogZnVuY3Rpb24gKGNiKSB7XG4gICAgICAgICAgICBzaWVzdGEucmVtb3ZlTGlzdGVuZXIoJ1NpZXN0YScsIGxpc3RlbmVyKTtcbiAgICAgICAgICAgIHVuc2F2ZWRPYmplY3RzID0gW107XG4gICAgICAgICAgICB1bnNhdmVkT2JqZWN0c0hhc2ggPSB7fTtcbiAgICAgICAgICAgIHBvdWNoLmRlc3Ryb3koZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIHBvdWNoID0gbmV3IFBvdWNoREIoREJfTkFNRSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHNpZXN0YS5vbignU2llc3RhJywgbGlzdGVuZXIpO1xuICAgICAgICAgICAgICAgIExvZ2dlci53YXJuKCdSZXNldCBjb21wbGV0ZScpO1xuICAgICAgICAgICAgICAgIGNiKGVycik7XG4gICAgICAgICAgICB9KVxuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydGllcyhzdG9yYWdlLCB7XG4gICAgICAgIF91bnNhdmVkT2JqZWN0czoge1xuICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHVuc2F2ZWRPYmplY3RzXG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIF91bnNhdmVkT2JqZWN0c0hhc2g6IHtcbiAgICAgICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB1bnNhdmVkT2JqZWN0c0hhc2hcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgX3Vuc2F2ZWRPYmplY3RzQnlDb2xsZWN0aW9uOiB7XG4gICAgICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb25cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgX3BvdWNoOiB7XG4gICAgICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gcG91Y2hcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xuXG5cbiAgICBpZiAoIXNpZXN0YS5leHQpIHNpZXN0YS5leHQgPSB7fTtcbiAgICBzaWVzdGEuZXh0LnN0b3JhZ2UgPSBzdG9yYWdlO1xuXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnRpZXMoc2llc3RhLmV4dCwge1xuICAgICAgICBzdG9yYWdlRW5hYmxlZDoge1xuICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgaWYgKHNpZXN0YS5leHQuX3N0b3JhZ2VFbmFibGVkICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHNpZXN0YS5leHQuX3N0b3JhZ2VFbmFibGVkO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gISFzaWVzdGEuZXh0LnN0b3JhZ2U7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgc2V0OiBmdW5jdGlvbiAodikge1xuICAgICAgICAgICAgICAgIHNpZXN0YS5leHQuX3N0b3JhZ2VFbmFibGVkID0gdjtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlXG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIHZhciBpbnRlcnZhbCwgc2F2aW5nLCBhdXRvc2F2ZUludGVydmFsID0gMTAwMDtcblxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKHNpZXN0YSwge1xuICAgICAgICBhdXRvc2F2ZToge1xuICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuICEhaW50ZXJ2YWw7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgc2V0OiBmdW5jdGlvbiAoYXV0b3NhdmUpIHtcbiAgICAgICAgICAgICAgICBpZiAoYXV0b3NhdmUpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFpbnRlcnZhbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaW50ZXJ2YWwgPSBzZXRJbnRlcnZhbChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gQ2hlZWt5IHdheSBvZiBhdm9pZGluZyBtdWx0aXBsZSBzYXZlcyBoYXBwZW5pbmcuLi5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIXNhdmluZykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzYXZpbmcgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzaWVzdGEuc2F2ZShmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50cy5lbWl0KCdzYXZlZCcpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2F2aW5nID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0sIHNpZXN0YS5hdXRvc2F2ZUludGVydmFsKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGludGVydmFsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjbGVhckludGVydmFsKGludGVydmFsKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGludGVydmFsID0gbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgYXV0b3NhdmVJbnRlcnZhbDoge1xuICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGF1dG9zYXZlSW50ZXJ2YWw7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgc2V0OiBmdW5jdGlvbiAoX2F1dG9zYXZlSW50ZXJ2YWwpIHtcbiAgICAgICAgICAgICAgICBhdXRvc2F2ZUludGVydmFsID0gX2F1dG9zYXZlSW50ZXJ2YWw7XG4gICAgICAgICAgICAgICAgaWYgKGludGVydmFsKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFJlc2V0IGludGVydmFsXG4gICAgICAgICAgICAgICAgICAgIHNpZXN0YS5hdXRvc2F2ZSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICBzaWVzdGEuYXV0b3NhdmUgPSB0cnVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgZGlydHk6IHtcbiAgICAgICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHZhciB1bnNhdmVkT2JqZWN0c0J5Q29sbGVjdGlvbiA9IHNpZXN0YS5leHQuc3RvcmFnZS5fdW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb247XG4gICAgICAgICAgICAgICAgcmV0dXJuICEhT2JqZWN0LmtleXModW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb24pLmxlbmd0aDtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlXG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIF8uZXh0ZW5kKHNpZXN0YSwge1xuICAgICAgICBzYXZlOiBzYXZlLFxuICAgICAgICBzZXRQb3VjaDogZnVuY3Rpb24gKF9wKSB7XG4gICAgICAgICAgICBpZiAoc2llc3RhLl9jYW5DaGFuZ2UpIHBvdWNoID0gX3A7XG4gICAgICAgICAgICBlbHNlIHRocm93IG5ldyBFcnJvcignQ2Fubm90IGNoYW5nZSBQb3VjaERCIGluc3RhbmNlIHdoZW4gYW4gb2JqZWN0IGdyYXBoIGV4aXN0cy4nKTtcbiAgICAgICAgfVxuICAgIH0pO1xuXG59XG5cbm1vZHVsZS5leHBvcnRzID0gc3RvcmFnZTtcbiIsIihmdW5jdGlvbiAoZ2xvYmFsKXtcbi8qXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTQgVGhlIFBvbHltZXIgUHJvamVjdCBBdXRob3JzLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogVGhpcyBjb2RlIG1heSBvbmx5IGJlIHVzZWQgdW5kZXIgdGhlIEJTRCBzdHlsZSBsaWNlbnNlIGZvdW5kIGF0IGh0dHA6Ly9wb2x5bWVyLmdpdGh1Yi5pby9MSUNFTlNFLnR4dFxuICogVGhlIGNvbXBsZXRlIHNldCBvZiBhdXRob3JzIG1heSBiZSBmb3VuZCBhdCBodHRwOi8vcG9seW1lci5naXRodWIuaW8vQVVUSE9SUy50eHRcbiAqIFRoZSBjb21wbGV0ZSBzZXQgb2YgY29udHJpYnV0b3JzIG1heSBiZSBmb3VuZCBhdCBodHRwOi8vcG9seW1lci5naXRodWIuaW8vQ09OVFJJQlVUT1JTLnR4dFxuICogQ29kZSBkaXN0cmlidXRlZCBieSBHb29nbGUgYXMgcGFydCBvZiB0aGUgcG9seW1lciBwcm9qZWN0IGlzIGFsc29cbiAqIHN1YmplY3QgdG8gYW4gYWRkaXRpb25hbCBJUCByaWdodHMgZ3JhbnQgZm91bmQgYXQgaHR0cDovL3BvbHltZXIuZ2l0aHViLmlvL1BBVEVOVFMudHh0XG4gKi9cblxuKGZ1bmN0aW9uKGdsb2JhbCkge1xuICAndXNlIHN0cmljdCc7XG5cbiAgdmFyIHRlc3RpbmdFeHBvc2VDeWNsZUNvdW50ID0gZ2xvYmFsLnRlc3RpbmdFeHBvc2VDeWNsZUNvdW50O1xuXG4gIC8vIERldGVjdCBhbmQgZG8gYmFzaWMgc2FuaXR5IGNoZWNraW5nIG9uIE9iamVjdC9BcnJheS5vYnNlcnZlLlxuICBmdW5jdGlvbiBkZXRlY3RPYmplY3RPYnNlcnZlKCkge1xuICAgIGlmICh0eXBlb2YgT2JqZWN0Lm9ic2VydmUgIT09ICdmdW5jdGlvbicgfHxcbiAgICAgICAgdHlwZW9mIEFycmF5Lm9ic2VydmUgIT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICB2YXIgcmVjb3JkcyA9IFtdO1xuXG4gICAgZnVuY3Rpb24gY2FsbGJhY2socmVjcykge1xuICAgICAgcmVjb3JkcyA9IHJlY3M7XG4gICAgfVxuXG4gICAgdmFyIHRlc3QgPSB7fTtcbiAgICB2YXIgYXJyID0gW107XG4gICAgT2JqZWN0Lm9ic2VydmUodGVzdCwgY2FsbGJhY2spO1xuICAgIEFycmF5Lm9ic2VydmUoYXJyLCBjYWxsYmFjayk7XG4gICAgdGVzdC5pZCA9IDE7XG4gICAgdGVzdC5pZCA9IDI7XG4gICAgZGVsZXRlIHRlc3QuaWQ7XG4gICAgYXJyLnB1c2goMSwgMik7XG4gICAgYXJyLmxlbmd0aCA9IDA7XG5cbiAgICBPYmplY3QuZGVsaXZlckNoYW5nZVJlY29yZHMoY2FsbGJhY2spO1xuICAgIGlmIChyZWNvcmRzLmxlbmd0aCAhPT0gNSlcbiAgICAgIHJldHVybiBmYWxzZTtcblxuICAgIGlmIChyZWNvcmRzWzBdLnR5cGUgIT0gJ2FkZCcgfHxcbiAgICAgICAgcmVjb3Jkc1sxXS50eXBlICE9ICd1cGRhdGUnIHx8XG4gICAgICAgIHJlY29yZHNbMl0udHlwZSAhPSAnZGVsZXRlJyB8fFxuICAgICAgICByZWNvcmRzWzNdLnR5cGUgIT0gJ3NwbGljZScgfHxcbiAgICAgICAgcmVjb3Jkc1s0XS50eXBlICE9ICdzcGxpY2UnKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgT2JqZWN0LnVub2JzZXJ2ZSh0ZXN0LCBjYWxsYmFjayk7XG4gICAgQXJyYXkudW5vYnNlcnZlKGFyciwgY2FsbGJhY2spO1xuXG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICB2YXIgaGFzT2JzZXJ2ZSA9IGRldGVjdE9iamVjdE9ic2VydmUoKTtcblxuICBmdW5jdGlvbiBkZXRlY3RFdmFsKCkge1xuICAgIC8vIERvbid0IHRlc3QgZm9yIGV2YWwgaWYgd2UncmUgcnVubmluZyBpbiBhIENocm9tZSBBcHAgZW52aXJvbm1lbnQuXG4gICAgLy8gV2UgY2hlY2sgZm9yIEFQSXMgc2V0IHRoYXQgb25seSBleGlzdCBpbiBhIENocm9tZSBBcHAgY29udGV4dC5cbiAgICBpZiAodHlwZW9mIGNocm9tZSAhPT0gJ3VuZGVmaW5lZCcgJiYgY2hyb21lLmFwcCAmJiBjaHJvbWUuYXBwLnJ1bnRpbWUpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICAvLyBGaXJlZm94IE9TIEFwcHMgZG8gbm90IGFsbG93IGV2YWwuIFRoaXMgZmVhdHVyZSBkZXRlY3Rpb24gaXMgdmVyeSBoYWNreVxuICAgIC8vIGJ1dCBldmVuIGlmIHNvbWUgb3RoZXIgcGxhdGZvcm0gYWRkcyBzdXBwb3J0IGZvciB0aGlzIGZ1bmN0aW9uIHRoaXMgY29kZVxuICAgIC8vIHdpbGwgY29udGludWUgdG8gd29yay5cbiAgICBpZiAobmF2aWdhdG9yLmdldERldmljZVN0b3JhZ2UpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICB0cnkge1xuICAgICAgdmFyIGYgPSBuZXcgRnVuY3Rpb24oJycsICdyZXR1cm4gdHJ1ZTsnKTtcbiAgICAgIHJldHVybiBmKCk7XG4gICAgfSBjYXRjaCAoZXgpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cblxuICB2YXIgaGFzRXZhbCA9IGRldGVjdEV2YWwoKTtcblxuICBmdW5jdGlvbiBpc0luZGV4KHMpIHtcbiAgICByZXR1cm4gK3MgPT09IHMgPj4+IDAgJiYgcyAhPT0gJyc7XG4gIH1cblxuICBmdW5jdGlvbiB0b051bWJlcihzKSB7XG4gICAgcmV0dXJuICtzO1xuICB9XG5cbiAgdmFyIG51bWJlcklzTmFOID0gZ2xvYmFsLk51bWJlci5pc05hTiB8fCBmdW5jdGlvbih2YWx1ZSkge1xuICAgIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInICYmIGdsb2JhbC5pc05hTih2YWx1ZSk7XG4gIH1cblxuXG4gIHZhciBjcmVhdGVPYmplY3QgPSAoJ19fcHJvdG9fXycgaW4ge30pID9cbiAgICBmdW5jdGlvbihvYmopIHsgcmV0dXJuIG9iajsgfSA6XG4gICAgZnVuY3Rpb24ob2JqKSB7XG4gICAgICB2YXIgcHJvdG8gPSBvYmouX19wcm90b19fO1xuICAgICAgaWYgKCFwcm90bylcbiAgICAgICAgcmV0dXJuIG9iajtcbiAgICAgIHZhciBuZXdPYmplY3QgPSBPYmplY3QuY3JlYXRlKHByb3RvKTtcbiAgICAgIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKG9iaikuZm9yRWFjaChmdW5jdGlvbihuYW1lKSB7XG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShuZXdPYmplY3QsIG5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3Iob2JqLCBuYW1lKSk7XG4gICAgICB9KTtcbiAgICAgIHJldHVybiBuZXdPYmplY3Q7XG4gICAgfTtcblxuICB2YXIgaWRlbnRTdGFydCA9ICdbXFwkX2EtekEtWl0nO1xuICB2YXIgaWRlbnRQYXJ0ID0gJ1tcXCRfYS16QS1aMC05XSc7XG5cblxuICB2YXIgTUFYX0RJUlRZX0NIRUNLX0NZQ0xFUyA9IDEwMDA7XG5cbiAgZnVuY3Rpb24gZGlydHlDaGVjayhvYnNlcnZlcikge1xuICAgIHZhciBjeWNsZXMgPSAwO1xuICAgIHdoaWxlIChjeWNsZXMgPCBNQVhfRElSVFlfQ0hFQ0tfQ1lDTEVTICYmIG9ic2VydmVyLmNoZWNrXygpKSB7XG4gICAgICBjeWNsZXMrKztcbiAgICB9XG4gICAgaWYgKHRlc3RpbmdFeHBvc2VDeWNsZUNvdW50KVxuICAgICAgZ2xvYmFsLmRpcnR5Q2hlY2tDeWNsZUNvdW50ID0gY3ljbGVzO1xuXG4gICAgcmV0dXJuIGN5Y2xlcyA+IDA7XG4gIH1cblxuICBmdW5jdGlvbiBvYmplY3RJc0VtcHR5KG9iamVjdCkge1xuICAgIGZvciAodmFyIHByb3AgaW4gb2JqZWN0KVxuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgZnVuY3Rpb24gZGlmZklzRW1wdHkoZGlmZikge1xuICAgIHJldHVybiBvYmplY3RJc0VtcHR5KGRpZmYuYWRkZWQpICYmXG4gICAgICAgICAgIG9iamVjdElzRW1wdHkoZGlmZi5yZW1vdmVkKSAmJlxuICAgICAgICAgICBvYmplY3RJc0VtcHR5KGRpZmYuY2hhbmdlZCk7XG4gIH1cblxuICBmdW5jdGlvbiBkaWZmT2JqZWN0RnJvbU9sZE9iamVjdChvYmplY3QsIG9sZE9iamVjdCkge1xuICAgIHZhciBhZGRlZCA9IHt9O1xuICAgIHZhciByZW1vdmVkID0ge307XG4gICAgdmFyIGNoYW5nZWQgPSB7fTtcblxuICAgIGZvciAodmFyIHByb3AgaW4gb2xkT2JqZWN0KSB7XG4gICAgICB2YXIgbmV3VmFsdWUgPSBvYmplY3RbcHJvcF07XG5cbiAgICAgIGlmIChuZXdWYWx1ZSAhPT0gdW5kZWZpbmVkICYmIG5ld1ZhbHVlID09PSBvbGRPYmplY3RbcHJvcF0pXG4gICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICBpZiAoIShwcm9wIGluIG9iamVjdCkpIHtcbiAgICAgICAgcmVtb3ZlZFtwcm9wXSA9IHVuZGVmaW5lZDtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGlmIChuZXdWYWx1ZSAhPT0gb2xkT2JqZWN0W3Byb3BdKVxuICAgICAgICBjaGFuZ2VkW3Byb3BdID0gbmV3VmFsdWU7XG4gICAgfVxuXG4gICAgZm9yICh2YXIgcHJvcCBpbiBvYmplY3QpIHtcbiAgICAgIGlmIChwcm9wIGluIG9sZE9iamVjdClcbiAgICAgICAgY29udGludWU7XG5cbiAgICAgIGFkZGVkW3Byb3BdID0gb2JqZWN0W3Byb3BdO1xuICAgIH1cblxuICAgIGlmIChBcnJheS5pc0FycmF5KG9iamVjdCkgJiYgb2JqZWN0Lmxlbmd0aCAhPT0gb2xkT2JqZWN0Lmxlbmd0aClcbiAgICAgIGNoYW5nZWQubGVuZ3RoID0gb2JqZWN0Lmxlbmd0aDtcblxuICAgIHJldHVybiB7XG4gICAgICBhZGRlZDogYWRkZWQsXG4gICAgICByZW1vdmVkOiByZW1vdmVkLFxuICAgICAgY2hhbmdlZDogY2hhbmdlZFxuICAgIH07XG4gIH1cblxuICB2YXIgZW9tVGFza3MgPSBbXTtcbiAgZnVuY3Rpb24gcnVuRU9NVGFza3MoKSB7XG4gICAgaWYgKCFlb21UYXNrcy5sZW5ndGgpXG4gICAgICByZXR1cm4gZmFsc2U7XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGVvbVRhc2tzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBlb21UYXNrc1tpXSgpO1xuICAgIH1cbiAgICBlb21UYXNrcy5sZW5ndGggPSAwO1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgdmFyIHJ1bkVPTSA9IGhhc09ic2VydmUgPyAoZnVuY3Rpb24oKXtcbiAgICB2YXIgZW9tT2JqID0geyBwaW5nUG9uZzogdHJ1ZSB9O1xuICAgIHZhciBlb21SdW5TY2hlZHVsZWQgPSBmYWxzZTtcblxuICAgIE9iamVjdC5vYnNlcnZlKGVvbU9iaiwgZnVuY3Rpb24oKSB7XG4gICAgICBydW5FT01UYXNrcygpO1xuICAgICAgZW9tUnVuU2NoZWR1bGVkID0gZmFsc2U7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gZnVuY3Rpb24oZm4pIHtcbiAgICAgIGVvbVRhc2tzLnB1c2goZm4pO1xuICAgICAgaWYgKCFlb21SdW5TY2hlZHVsZWQpIHtcbiAgICAgICAgZW9tUnVuU2NoZWR1bGVkID0gdHJ1ZTtcbiAgICAgICAgZW9tT2JqLnBpbmdQb25nID0gIWVvbU9iai5waW5nUG9uZztcbiAgICAgIH1cbiAgICB9O1xuICB9KSgpIDpcbiAgKGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBmdW5jdGlvbihmbikge1xuICAgICAgZW9tVGFza3MucHVzaChmbik7XG4gICAgfTtcbiAgfSkoKTtcblxuICB2YXIgb2JzZXJ2ZWRPYmplY3RDYWNoZSA9IFtdO1xuXG4gIGZ1bmN0aW9uIG5ld09ic2VydmVkT2JqZWN0KCkge1xuICAgIHZhciBvYnNlcnZlcjtcbiAgICB2YXIgb2JqZWN0O1xuICAgIHZhciBkaXNjYXJkUmVjb3JkcyA9IGZhbHNlO1xuICAgIHZhciBmaXJzdCA9IHRydWU7XG5cbiAgICBmdW5jdGlvbiBjYWxsYmFjayhyZWNvcmRzKSB7XG4gICAgICBpZiAob2JzZXJ2ZXIgJiYgb2JzZXJ2ZXIuc3RhdGVfID09PSBPUEVORUQgJiYgIWRpc2NhcmRSZWNvcmRzKVxuICAgICAgICBvYnNlcnZlci5jaGVja18ocmVjb3Jkcyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIG9wZW46IGZ1bmN0aW9uKG9icykge1xuICAgICAgICBpZiAob2JzZXJ2ZXIpXG4gICAgICAgICAgdGhyb3cgRXJyb3IoJ09ic2VydmVkT2JqZWN0IGluIHVzZScpO1xuXG4gICAgICAgIGlmICghZmlyc3QpXG4gICAgICAgICAgT2JqZWN0LmRlbGl2ZXJDaGFuZ2VSZWNvcmRzKGNhbGxiYWNrKTtcblxuICAgICAgICBvYnNlcnZlciA9IG9icztcbiAgICAgICAgZmlyc3QgPSBmYWxzZTtcbiAgICAgIH0sXG4gICAgICBvYnNlcnZlOiBmdW5jdGlvbihvYmosIGFycmF5T2JzZXJ2ZSkge1xuICAgICAgICBvYmplY3QgPSBvYmo7XG4gICAgICAgIGlmIChhcnJheU9ic2VydmUpXG4gICAgICAgICAgQXJyYXkub2JzZXJ2ZShvYmplY3QsIGNhbGxiYWNrKTtcbiAgICAgICAgZWxzZVxuICAgICAgICAgIE9iamVjdC5vYnNlcnZlKG9iamVjdCwgY2FsbGJhY2spO1xuICAgICAgfSxcbiAgICAgIGRlbGl2ZXI6IGZ1bmN0aW9uKGRpc2NhcmQpIHtcbiAgICAgICAgZGlzY2FyZFJlY29yZHMgPSBkaXNjYXJkO1xuICAgICAgICBPYmplY3QuZGVsaXZlckNoYW5nZVJlY29yZHMoY2FsbGJhY2spO1xuICAgICAgICBkaXNjYXJkUmVjb3JkcyA9IGZhbHNlO1xuICAgICAgfSxcbiAgICAgIGNsb3NlOiBmdW5jdGlvbigpIHtcbiAgICAgICAgb2JzZXJ2ZXIgPSB1bmRlZmluZWQ7XG4gICAgICAgIE9iamVjdC51bm9ic2VydmUob2JqZWN0LCBjYWxsYmFjayk7XG4gICAgICAgIG9ic2VydmVkT2JqZWN0Q2FjaGUucHVzaCh0aGlzKTtcbiAgICAgIH1cbiAgICB9O1xuICB9XG5cbiAgLypcbiAgICogVGhlIG9ic2VydmVkU2V0IGFic3RyYWN0aW9uIGlzIGEgcGVyZiBvcHRpbWl6YXRpb24gd2hpY2ggcmVkdWNlcyB0aGUgdG90YWxcbiAgICogbnVtYmVyIG9mIE9iamVjdC5vYnNlcnZlIG9ic2VydmF0aW9ucyBvZiBhIHNldCBvZiBvYmplY3RzLiBUaGUgaWRlYSBpcyB0aGF0XG4gICAqIGdyb3VwcyBvZiBPYnNlcnZlcnMgd2lsbCBoYXZlIHNvbWUgb2JqZWN0IGRlcGVuZGVuY2llcyBpbiBjb21tb24gYW5kIHRoaXNcbiAgICogb2JzZXJ2ZWQgc2V0IGVuc3VyZXMgdGhhdCBlYWNoIG9iamVjdCBpbiB0aGUgdHJhbnNpdGl2ZSBjbG9zdXJlIG9mXG4gICAqIGRlcGVuZGVuY2llcyBpcyBvbmx5IG9ic2VydmVkIG9uY2UuIFRoZSBvYnNlcnZlZFNldCBhY3RzIGFzIGEgd3JpdGUgYmFycmllclxuICAgKiBzdWNoIHRoYXQgd2hlbmV2ZXIgYW55IGNoYW5nZSBjb21lcyB0aHJvdWdoLCBhbGwgT2JzZXJ2ZXJzIGFyZSBjaGVja2VkIGZvclxuICAgKiBjaGFuZ2VkIHZhbHVlcy5cbiAgICpcbiAgICogTm90ZSB0aGF0IHRoaXMgb3B0aW1pemF0aW9uIGlzIGV4cGxpY2l0bHkgbW92aW5nIHdvcmsgZnJvbSBzZXR1cC10aW1lIHRvXG4gICAqIGNoYW5nZS10aW1lLlxuICAgKlxuICAgKiBUT0RPKHJhZmFlbHcpOiBJbXBsZW1lbnQgXCJnYXJiYWdlIGNvbGxlY3Rpb25cIi4gSW4gb3JkZXIgdG8gbW92ZSB3b3JrIG9mZlxuICAgKiB0aGUgY3JpdGljYWwgcGF0aCwgd2hlbiBPYnNlcnZlcnMgYXJlIGNsb3NlZCwgdGhlaXIgb2JzZXJ2ZWQgb2JqZWN0cyBhcmVcbiAgICogbm90IE9iamVjdC51bm9ic2VydmUoZCkuIEFzIGEgcmVzdWx0LCBpdCdzaWVzdGEgcG9zc2libGUgdGhhdCBpZiB0aGUgb2JzZXJ2ZWRTZXRcbiAgICogaXMga2VwdCBvcGVuLCBidXQgc29tZSBPYnNlcnZlcnMgaGF2ZSBiZWVuIGNsb3NlZCwgaXQgY291bGQgY2F1c2UgXCJsZWFrc1wiXG4gICAqIChwcmV2ZW50IG90aGVyd2lzZSBjb2xsZWN0YWJsZSBvYmplY3RzIGZyb20gYmVpbmcgY29sbGVjdGVkKS4gQXQgc29tZVxuICAgKiBwb2ludCwgd2Ugc2hvdWxkIGltcGxlbWVudCBpbmNyZW1lbnRhbCBcImdjXCIgd2hpY2gga2VlcHMgYSBsaXN0IG9mXG4gICAqIG9ic2VydmVkU2V0cyB3aGljaCBtYXkgbmVlZCBjbGVhbi11cCBhbmQgZG9lcyBzbWFsbCBhbW91bnRzIG9mIGNsZWFudXAgb24gYVxuICAgKiB0aW1lb3V0IHVudGlsIGFsbCBpcyBjbGVhbi5cbiAgICovXG5cbiAgZnVuY3Rpb24gZ2V0T2JzZXJ2ZWRPYmplY3Qob2JzZXJ2ZXIsIG9iamVjdCwgYXJyYXlPYnNlcnZlKSB7XG4gICAgdmFyIGRpciA9IG9ic2VydmVkT2JqZWN0Q2FjaGUucG9wKCkgfHwgbmV3T2JzZXJ2ZWRPYmplY3QoKTtcbiAgICBkaXIub3BlbihvYnNlcnZlcik7XG4gICAgZGlyLm9ic2VydmUob2JqZWN0LCBhcnJheU9ic2VydmUpO1xuICAgIHJldHVybiBkaXI7XG4gIH1cblxuICB2YXIgb2JzZXJ2ZWRTZXRDYWNoZSA9IFtdO1xuXG4gIGZ1bmN0aW9uIG5ld09ic2VydmVkU2V0KCkge1xuICAgIHZhciBvYnNlcnZlckNvdW50ID0gMDtcbiAgICB2YXIgb2JzZXJ2ZXJzID0gW107XG4gICAgdmFyIG9iamVjdHMgPSBbXTtcbiAgICB2YXIgcm9vdE9iajtcbiAgICB2YXIgcm9vdE9ialByb3BzO1xuXG4gICAgZnVuY3Rpb24gb2JzZXJ2ZShvYmosIHByb3ApIHtcbiAgICAgIGlmICghb2JqKVxuICAgICAgICByZXR1cm47XG5cbiAgICAgIGlmIChvYmogPT09IHJvb3RPYmopXG4gICAgICAgIHJvb3RPYmpQcm9wc1twcm9wXSA9IHRydWU7XG5cbiAgICAgIGlmIChvYmplY3RzLmluZGV4T2Yob2JqKSA8IDApIHtcbiAgICAgICAgb2JqZWN0cy5wdXNoKG9iaik7XG4gICAgICAgIE9iamVjdC5vYnNlcnZlKG9iaiwgY2FsbGJhY2spO1xuICAgICAgfVxuXG4gICAgICBvYnNlcnZlKE9iamVjdC5nZXRQcm90b3R5cGVPZihvYmopLCBwcm9wKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBhbGxSb290T2JqTm9uT2JzZXJ2ZWRQcm9wcyhyZWNzKSB7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHJlY3MubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIHJlYyA9IHJlY3NbaV07XG4gICAgICAgIGlmIChyZWMub2JqZWN0ICE9PSByb290T2JqIHx8XG4gICAgICAgICAgICByb290T2JqUHJvcHNbcmVjLm5hbWVdIHx8XG4gICAgICAgICAgICByZWMudHlwZSA9PT0gJ3NldFByb3RvdHlwZScpIHtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGNhbGxiYWNrKHJlY3MpIHtcbiAgICAgIGlmIChhbGxSb290T2JqTm9uT2JzZXJ2ZWRQcm9wcyhyZWNzKSlcbiAgICAgICAgcmV0dXJuO1xuXG4gICAgICB2YXIgb2JzZXJ2ZXI7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IG9ic2VydmVycy5sZW5ndGg7IGkrKykge1xuICAgICAgICBvYnNlcnZlciA9IG9ic2VydmVyc1tpXTtcbiAgICAgICAgaWYgKG9ic2VydmVyLnN0YXRlXyA9PSBPUEVORUQpIHtcbiAgICAgICAgICBvYnNlcnZlci5pdGVyYXRlT2JqZWN0c18ob2JzZXJ2ZSk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBvYnNlcnZlcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgb2JzZXJ2ZXIgPSBvYnNlcnZlcnNbaV07XG4gICAgICAgIGlmIChvYnNlcnZlci5zdGF0ZV8gPT0gT1BFTkVEKSB7XG4gICAgICAgICAgb2JzZXJ2ZXIuY2hlY2tfKCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICB2YXIgcmVjb3JkID0ge1xuICAgICAgb2JqZWN0OiB1bmRlZmluZWQsXG4gICAgICBvYmplY3RzOiBvYmplY3RzLFxuICAgICAgb3BlbjogZnVuY3Rpb24ob2JzLCBvYmplY3QpIHtcbiAgICAgICAgaWYgKCFyb290T2JqKSB7XG4gICAgICAgICAgcm9vdE9iaiA9IG9iamVjdDtcbiAgICAgICAgICByb290T2JqUHJvcHMgPSB7fTtcbiAgICAgICAgfVxuXG4gICAgICAgIG9ic2VydmVycy5wdXNoKG9icyk7XG4gICAgICAgIG9ic2VydmVyQ291bnQrKztcbiAgICAgICAgb2JzLml0ZXJhdGVPYmplY3RzXyhvYnNlcnZlKTtcbiAgICAgIH0sXG4gICAgICBjbG9zZTogZnVuY3Rpb24ob2JzKSB7XG4gICAgICAgIG9ic2VydmVyQ291bnQtLTtcbiAgICAgICAgaWYgKG9ic2VydmVyQ291bnQgPiAwKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBvYmplY3RzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgT2JqZWN0LnVub2JzZXJ2ZShvYmplY3RzW2ldLCBjYWxsYmFjayk7XG4gICAgICAgICAgT2JzZXJ2ZXIudW5vYnNlcnZlZENvdW50Kys7XG4gICAgICAgIH1cblxuICAgICAgICBvYnNlcnZlcnMubGVuZ3RoID0gMDtcbiAgICAgICAgb2JqZWN0cy5sZW5ndGggPSAwO1xuICAgICAgICByb290T2JqID0gdW5kZWZpbmVkO1xuICAgICAgICByb290T2JqUHJvcHMgPSB1bmRlZmluZWQ7XG4gICAgICAgIG9ic2VydmVkU2V0Q2FjaGUucHVzaCh0aGlzKTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgcmV0dXJuIHJlY29yZDtcbiAgfVxuXG4gIHZhciBsYXN0T2JzZXJ2ZWRTZXQ7XG5cbiAgdmFyIFVOT1BFTkVEID0gMDtcbiAgdmFyIE9QRU5FRCA9IDE7XG4gIHZhciBDTE9TRUQgPSAyO1xuXG4gIHZhciBuZXh0T2JzZXJ2ZXJJZCA9IDE7XG5cbiAgZnVuY3Rpb24gT2JzZXJ2ZXIoKSB7XG4gICAgdGhpcy5zdGF0ZV8gPSBVTk9QRU5FRDtcbiAgICB0aGlzLmNhbGxiYWNrXyA9IHVuZGVmaW5lZDtcbiAgICB0aGlzLnRhcmdldF8gPSB1bmRlZmluZWQ7IC8vIFRPRE8ocmFmYWVsdyk6IFNob3VsZCBiZSBXZWFrUmVmXG4gICAgdGhpcy5kaXJlY3RPYnNlcnZlcl8gPSB1bmRlZmluZWQ7XG4gICAgdGhpcy52YWx1ZV8gPSB1bmRlZmluZWQ7XG4gICAgdGhpcy5pZF8gPSBuZXh0T2JzZXJ2ZXJJZCsrO1xuICB9XG5cbiAgT2JzZXJ2ZXIucHJvdG90eXBlID0ge1xuICAgIG9wZW46IGZ1bmN0aW9uKGNhbGxiYWNrLCB0YXJnZXQpIHtcbiAgICAgIGlmICh0aGlzLnN0YXRlXyAhPSBVTk9QRU5FRClcbiAgICAgICAgdGhyb3cgRXJyb3IoJ09ic2VydmVyIGhhcyBhbHJlYWR5IGJlZW4gb3BlbmVkLicpO1xuXG4gICAgICBhZGRUb0FsbCh0aGlzKTtcbiAgICAgIHRoaXMuY2FsbGJhY2tfID0gY2FsbGJhY2s7XG4gICAgICB0aGlzLnRhcmdldF8gPSB0YXJnZXQ7XG4gICAgICB0aGlzLmNvbm5lY3RfKCk7XG4gICAgICB0aGlzLnN0YXRlXyA9IE9QRU5FRDtcbiAgICAgIHJldHVybiB0aGlzLnZhbHVlXztcbiAgICB9LFxuXG4gICAgY2xvc2U6IGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKHRoaXMuc3RhdGVfICE9IE9QRU5FRClcbiAgICAgICAgcmV0dXJuO1xuXG4gICAgICByZW1vdmVGcm9tQWxsKHRoaXMpO1xuICAgICAgdGhpcy5kaXNjb25uZWN0XygpO1xuICAgICAgdGhpcy52YWx1ZV8gPSB1bmRlZmluZWQ7XG4gICAgICB0aGlzLmNhbGxiYWNrXyA9IHVuZGVmaW5lZDtcbiAgICAgIHRoaXMudGFyZ2V0XyA9IHVuZGVmaW5lZDtcbiAgICAgIHRoaXMuc3RhdGVfID0gQ0xPU0VEO1xuICAgIH0sXG5cbiAgICBkZWxpdmVyOiBmdW5jdGlvbigpIHtcbiAgICAgIGlmICh0aGlzLnN0YXRlXyAhPSBPUEVORUQpXG4gICAgICAgIHJldHVybjtcblxuICAgICAgZGlydHlDaGVjayh0aGlzKTtcbiAgICB9LFxuXG4gICAgcmVwb3J0XzogZnVuY3Rpb24oY2hhbmdlcykge1xuICAgICAgdHJ5IHtcbiAgICAgICAgdGhpcy5jYWxsYmFja18uYXBwbHkodGhpcy50YXJnZXRfLCBjaGFuZ2VzKTtcbiAgICAgIH0gY2F0Y2ggKGV4KSB7XG4gICAgICAgIE9ic2VydmVyLl9lcnJvclRocm93bkR1cmluZ0NhbGxiYWNrID0gdHJ1ZTtcbiAgICAgICAgY29uc29sZS5lcnJvcignRXhjZXB0aW9uIGNhdWdodCBkdXJpbmcgb2JzZXJ2ZXIgY2FsbGJhY2s6ICcgK1xuICAgICAgICAgICAgICAgICAgICAgICAoZXguc3RhY2sgfHwgZXgpKTtcbiAgICAgIH1cbiAgICB9LFxuXG4gICAgZGlzY2FyZENoYW5nZXM6IGZ1bmN0aW9uKCkge1xuICAgICAgdGhpcy5jaGVja18odW5kZWZpbmVkLCB0cnVlKTtcbiAgICAgIHJldHVybiB0aGlzLnZhbHVlXztcbiAgICB9XG4gIH1cblxuICB2YXIgY29sbGVjdE9ic2VydmVycyA9ICFoYXNPYnNlcnZlO1xuICB2YXIgYWxsT2JzZXJ2ZXJzO1xuICBPYnNlcnZlci5fYWxsT2JzZXJ2ZXJzQ291bnQgPSAwO1xuXG4gIGlmIChjb2xsZWN0T2JzZXJ2ZXJzKSB7XG4gICAgYWxsT2JzZXJ2ZXJzID0gW107XG4gIH1cblxuICBmdW5jdGlvbiBhZGRUb0FsbChvYnNlcnZlcikge1xuICAgIE9ic2VydmVyLl9hbGxPYnNlcnZlcnNDb3VudCsrO1xuICAgIGlmICghY29sbGVjdE9ic2VydmVycylcbiAgICAgIHJldHVybjtcblxuICAgIGFsbE9ic2VydmVycy5wdXNoKG9ic2VydmVyKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlbW92ZUZyb21BbGwob2JzZXJ2ZXIpIHtcbiAgICBPYnNlcnZlci5fYWxsT2JzZXJ2ZXJzQ291bnQtLTtcbiAgfVxuXG4gIHZhciBydW5uaW5nTWljcm90YXNrQ2hlY2twb2ludCA9IGZhbHNlO1xuXG4gIHZhciBoYXNEZWJ1Z0ZvcmNlRnVsbERlbGl2ZXJ5ID0gaGFzT2JzZXJ2ZSAmJiBoYXNFdmFsICYmIChmdW5jdGlvbigpIHtcbiAgICB0cnkge1xuICAgICAgZXZhbCgnJVJ1bk1pY3JvdGFza3MoKScpO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSBjYXRjaCAoZXgpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH0pKCk7XG5cbiAgZ2xvYmFsLlBsYXRmb3JtID0gZ2xvYmFsLlBsYXRmb3JtIHx8IHt9O1xuXG4gIGdsb2JhbC5QbGF0Zm9ybS5wZXJmb3JtTWljcm90YXNrQ2hlY2twb2ludCA9IGZ1bmN0aW9uKCkge1xuICAgIGlmIChydW5uaW5nTWljcm90YXNrQ2hlY2twb2ludClcbiAgICAgIHJldHVybjtcblxuICAgIGlmIChoYXNEZWJ1Z0ZvcmNlRnVsbERlbGl2ZXJ5KSB7XG4gICAgICBldmFsKCclUnVuTWljcm90YXNrcygpJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKCFjb2xsZWN0T2JzZXJ2ZXJzKVxuICAgICAgcmV0dXJuO1xuXG4gICAgcnVubmluZ01pY3JvdGFza0NoZWNrcG9pbnQgPSB0cnVlO1xuXG4gICAgdmFyIGN5Y2xlcyA9IDA7XG4gICAgdmFyIGFueUNoYW5nZWQsIHRvQ2hlY2s7XG5cbiAgICBkbyB7XG4gICAgICBjeWNsZXMrKztcbiAgICAgIHRvQ2hlY2sgPSBhbGxPYnNlcnZlcnM7XG4gICAgICBhbGxPYnNlcnZlcnMgPSBbXTtcbiAgICAgIGFueUNoYW5nZWQgPSBmYWxzZTtcblxuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0b0NoZWNrLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciBvYnNlcnZlciA9IHRvQ2hlY2tbaV07XG4gICAgICAgIGlmIChvYnNlcnZlci5zdGF0ZV8gIT0gT1BFTkVEKVxuICAgICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICAgIGlmIChvYnNlcnZlci5jaGVja18oKSlcbiAgICAgICAgICBhbnlDaGFuZ2VkID0gdHJ1ZTtcblxuICAgICAgICBhbGxPYnNlcnZlcnMucHVzaChvYnNlcnZlcik7XG4gICAgICB9XG4gICAgICBpZiAocnVuRU9NVGFza3MoKSlcbiAgICAgICAgYW55Q2hhbmdlZCA9IHRydWU7XG4gICAgfSB3aGlsZSAoY3ljbGVzIDwgTUFYX0RJUlRZX0NIRUNLX0NZQ0xFUyAmJiBhbnlDaGFuZ2VkKTtcblxuICAgIGlmICh0ZXN0aW5nRXhwb3NlQ3ljbGVDb3VudClcbiAgICAgIGdsb2JhbC5kaXJ0eUNoZWNrQ3ljbGVDb3VudCA9IGN5Y2xlcztcblxuICAgIHJ1bm5pbmdNaWNyb3Rhc2tDaGVja3BvaW50ID0gZmFsc2U7XG4gIH07XG5cbiAgaWYgKGNvbGxlY3RPYnNlcnZlcnMpIHtcbiAgICBnbG9iYWwuUGxhdGZvcm0uY2xlYXJPYnNlcnZlcnMgPSBmdW5jdGlvbigpIHtcbiAgICAgIGFsbE9ic2VydmVycyA9IFtdO1xuICAgIH07XG4gIH1cblxuICBmdW5jdGlvbiBPYmplY3RPYnNlcnZlcihvYmplY3QpIHtcbiAgICBPYnNlcnZlci5jYWxsKHRoaXMpO1xuICAgIHRoaXMudmFsdWVfID0gb2JqZWN0O1xuICAgIHRoaXMub2xkT2JqZWN0XyA9IHVuZGVmaW5lZDtcbiAgfVxuXG4gIE9iamVjdE9ic2VydmVyLnByb3RvdHlwZSA9IGNyZWF0ZU9iamVjdCh7XG4gICAgX19wcm90b19fOiBPYnNlcnZlci5wcm90b3R5cGUsXG5cbiAgICBhcnJheU9ic2VydmU6IGZhbHNlLFxuXG4gICAgY29ubmVjdF86IGZ1bmN0aW9uKGNhbGxiYWNrLCB0YXJnZXQpIHtcbiAgICAgIGlmIChoYXNPYnNlcnZlKSB7XG4gICAgICAgIHRoaXMuZGlyZWN0T2JzZXJ2ZXJfID0gZ2V0T2JzZXJ2ZWRPYmplY3QodGhpcywgdGhpcy52YWx1ZV8sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5hcnJheU9ic2VydmUpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5vbGRPYmplY3RfID0gdGhpcy5jb3B5T2JqZWN0KHRoaXMudmFsdWVfKTtcbiAgICAgIH1cblxuICAgIH0sXG5cbiAgICBjb3B5T2JqZWN0OiBmdW5jdGlvbihvYmplY3QpIHtcbiAgICAgIHZhciBjb3B5ID0gQXJyYXkuaXNBcnJheShvYmplY3QpID8gW10gOiB7fTtcbiAgICAgIGZvciAodmFyIHByb3AgaW4gb2JqZWN0KSB7XG4gICAgICAgIGNvcHlbcHJvcF0gPSBvYmplY3RbcHJvcF07XG4gICAgICB9O1xuICAgICAgaWYgKEFycmF5LmlzQXJyYXkob2JqZWN0KSlcbiAgICAgICAgY29weS5sZW5ndGggPSBvYmplY3QubGVuZ3RoO1xuICAgICAgcmV0dXJuIGNvcHk7XG4gICAgfSxcblxuICAgIGNoZWNrXzogZnVuY3Rpb24oY2hhbmdlUmVjb3Jkcywgc2tpcENoYW5nZXMpIHtcbiAgICAgIHZhciBkaWZmO1xuICAgICAgdmFyIG9sZFZhbHVlcztcbiAgICAgIGlmIChoYXNPYnNlcnZlKSB7XG4gICAgICAgIGlmICghY2hhbmdlUmVjb3JkcylcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG5cbiAgICAgICAgb2xkVmFsdWVzID0ge307XG4gICAgICAgIGRpZmYgPSBkaWZmT2JqZWN0RnJvbUNoYW5nZVJlY29yZHModGhpcy52YWx1ZV8sIGNoYW5nZVJlY29yZHMsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb2xkVmFsdWVzKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG9sZFZhbHVlcyA9IHRoaXMub2xkT2JqZWN0XztcbiAgICAgICAgZGlmZiA9IGRpZmZPYmplY3RGcm9tT2xkT2JqZWN0KHRoaXMudmFsdWVfLCB0aGlzLm9sZE9iamVjdF8pO1xuICAgICAgfVxuXG4gICAgICBpZiAoZGlmZklzRW1wdHkoZGlmZikpXG4gICAgICAgIHJldHVybiBmYWxzZTtcblxuICAgICAgaWYgKCFoYXNPYnNlcnZlKVxuICAgICAgICB0aGlzLm9sZE9iamVjdF8gPSB0aGlzLmNvcHlPYmplY3QodGhpcy52YWx1ZV8pO1xuXG4gICAgICB0aGlzLnJlcG9ydF8oW1xuICAgICAgICBkaWZmLmFkZGVkIHx8IHt9LFxuICAgICAgICBkaWZmLnJlbW92ZWQgfHwge30sXG4gICAgICAgIGRpZmYuY2hhbmdlZCB8fCB7fSxcbiAgICAgICAgZnVuY3Rpb24ocHJvcGVydHkpIHtcbiAgICAgICAgICByZXR1cm4gb2xkVmFsdWVzW3Byb3BlcnR5XTtcbiAgICAgICAgfVxuICAgICAgXSk7XG5cbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0sXG5cbiAgICBkaXNjb25uZWN0XzogZnVuY3Rpb24oKSB7XG4gICAgICBpZiAoaGFzT2JzZXJ2ZSkge1xuICAgICAgICB0aGlzLmRpcmVjdE9ic2VydmVyXy5jbG9zZSgpO1xuICAgICAgICB0aGlzLmRpcmVjdE9ic2VydmVyXyA9IHVuZGVmaW5lZDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMub2xkT2JqZWN0XyA9IHVuZGVmaW5lZDtcbiAgICAgIH1cbiAgICB9LFxuXG4gICAgZGVsaXZlcjogZnVuY3Rpb24oKSB7XG4gICAgICBpZiAodGhpcy5zdGF0ZV8gIT0gT1BFTkVEKVxuICAgICAgICByZXR1cm47XG5cbiAgICAgIGlmIChoYXNPYnNlcnZlKVxuICAgICAgICB0aGlzLmRpcmVjdE9ic2VydmVyXy5kZWxpdmVyKGZhbHNlKTtcbiAgICAgIGVsc2VcbiAgICAgICAgZGlydHlDaGVjayh0aGlzKTtcbiAgICB9LFxuXG4gICAgZGlzY2FyZENoYW5nZXM6IGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKHRoaXMuZGlyZWN0T2JzZXJ2ZXJfKVxuICAgICAgICB0aGlzLmRpcmVjdE9ic2VydmVyXy5kZWxpdmVyKHRydWUpO1xuICAgICAgZWxzZVxuICAgICAgICB0aGlzLm9sZE9iamVjdF8gPSB0aGlzLmNvcHlPYmplY3QodGhpcy52YWx1ZV8pO1xuXG4gICAgICByZXR1cm4gdGhpcy52YWx1ZV87XG4gICAgfVxuICB9KTtcblxuICBmdW5jdGlvbiBBcnJheU9ic2VydmVyKGFycmF5KSB7XG4gICAgaWYgKCFBcnJheS5pc0FycmF5KGFycmF5KSlcbiAgICAgIHRocm93IEVycm9yKCdQcm92aWRlZCBvYmplY3QgaXMgbm90IGFuIEFycmF5Jyk7XG4gICAgT2JqZWN0T2JzZXJ2ZXIuY2FsbCh0aGlzLCBhcnJheSk7XG4gIH1cblxuICBBcnJheU9ic2VydmVyLnByb3RvdHlwZSA9IGNyZWF0ZU9iamVjdCh7XG5cbiAgICBfX3Byb3RvX186IE9iamVjdE9ic2VydmVyLnByb3RvdHlwZSxcblxuICAgIGFycmF5T2JzZXJ2ZTogdHJ1ZSxcblxuICAgIGNvcHlPYmplY3Q6IGZ1bmN0aW9uKGFycikge1xuICAgICAgcmV0dXJuIGFyci5zbGljZSgpO1xuICAgIH0sXG5cbiAgICBjaGVja186IGZ1bmN0aW9uKGNoYW5nZVJlY29yZHMpIHtcbiAgICAgIHZhciBzcGxpY2VzO1xuICAgICAgaWYgKGhhc09ic2VydmUpIHtcbiAgICAgICAgaWYgKCFjaGFuZ2VSZWNvcmRzKVxuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgc3BsaWNlcyA9IHByb2plY3RBcnJheVNwbGljZXModGhpcy52YWx1ZV8sIGNoYW5nZVJlY29yZHMpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc3BsaWNlcyA9IGNhbGNTcGxpY2VzKHRoaXMudmFsdWVfLCAwLCB0aGlzLnZhbHVlXy5sZW5ndGgsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLm9sZE9iamVjdF8sIDAsIHRoaXMub2xkT2JqZWN0Xy5sZW5ndGgpO1xuICAgICAgfVxuXG4gICAgICBpZiAoIXNwbGljZXMgfHwgIXNwbGljZXMubGVuZ3RoKVxuICAgICAgICByZXR1cm4gZmFsc2U7XG5cbiAgICAgIGlmICghaGFzT2JzZXJ2ZSlcbiAgICAgICAgdGhpcy5vbGRPYmplY3RfID0gdGhpcy5jb3B5T2JqZWN0KHRoaXMudmFsdWVfKTtcblxuICAgICAgdGhpcy5yZXBvcnRfKFtzcGxpY2VzXSk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gIH0pO1xuXG4gIEFycmF5T2JzZXJ2ZXIuYXBwbHlTcGxpY2VzID0gZnVuY3Rpb24ocHJldmlvdXMsIGN1cnJlbnQsIHNwbGljZXMpIHtcbiAgICBzcGxpY2VzLmZvckVhY2goZnVuY3Rpb24oc3BsaWNlKSB7XG4gICAgICB2YXIgc3BsaWNlQXJncyA9IFtzcGxpY2UuaW5kZXgsIHNwbGljZS5yZW1vdmVkLmxlbmd0aF07XG4gICAgICB2YXIgYWRkSW5kZXggPSBzcGxpY2UuaW5kZXg7XG4gICAgICB3aGlsZSAoYWRkSW5kZXggPCBzcGxpY2UuaW5kZXggKyBzcGxpY2UuYWRkZWRDb3VudCkge1xuICAgICAgICBzcGxpY2VBcmdzLnB1c2goY3VycmVudFthZGRJbmRleF0pO1xuICAgICAgICBhZGRJbmRleCsrO1xuICAgICAgfVxuXG4gICAgICBBcnJheS5wcm90b3R5cGUuc3BsaWNlLmFwcGx5KHByZXZpb3VzLCBzcGxpY2VBcmdzKTtcbiAgICB9KTtcbiAgfTtcblxuICB2YXIgb2JzZXJ2ZXJTZW50aW5lbCA9IHt9O1xuXG4gIHZhciBleHBlY3RlZFJlY29yZFR5cGVzID0ge1xuICAgIGFkZDogdHJ1ZSxcbiAgICB1cGRhdGU6IHRydWUsXG4gICAgZGVsZXRlOiB0cnVlXG4gIH07XG5cbiAgZnVuY3Rpb24gZGlmZk9iamVjdEZyb21DaGFuZ2VSZWNvcmRzKG9iamVjdCwgY2hhbmdlUmVjb3Jkcywgb2xkVmFsdWVzKSB7XG4gICAgdmFyIGFkZGVkID0ge307XG4gICAgdmFyIHJlbW92ZWQgPSB7fTtcblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY2hhbmdlUmVjb3Jkcy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIHJlY29yZCA9IGNoYW5nZVJlY29yZHNbaV07XG4gICAgICBpZiAoIWV4cGVjdGVkUmVjb3JkVHlwZXNbcmVjb3JkLnR5cGVdKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ1Vua25vd24gY2hhbmdlUmVjb3JkIHR5cGU6ICcgKyByZWNvcmQudHlwZSk7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IocmVjb3JkKTtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGlmICghKHJlY29yZC5uYW1lIGluIG9sZFZhbHVlcykpXG4gICAgICAgIG9sZFZhbHVlc1tyZWNvcmQubmFtZV0gPSByZWNvcmQub2xkVmFsdWU7XG5cbiAgICAgIGlmIChyZWNvcmQudHlwZSA9PSAndXBkYXRlJylcbiAgICAgICAgY29udGludWU7XG5cbiAgICAgIGlmIChyZWNvcmQudHlwZSA9PSAnYWRkJykge1xuICAgICAgICBpZiAocmVjb3JkLm5hbWUgaW4gcmVtb3ZlZClcbiAgICAgICAgICBkZWxldGUgcmVtb3ZlZFtyZWNvcmQubmFtZV07XG4gICAgICAgIGVsc2VcbiAgICAgICAgICBhZGRlZFtyZWNvcmQubmFtZV0gPSB0cnVlO1xuXG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICAvLyB0eXBlID0gJ2RlbGV0ZSdcbiAgICAgIGlmIChyZWNvcmQubmFtZSBpbiBhZGRlZCkge1xuICAgICAgICBkZWxldGUgYWRkZWRbcmVjb3JkLm5hbWVdO1xuICAgICAgICBkZWxldGUgb2xkVmFsdWVzW3JlY29yZC5uYW1lXTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJlbW92ZWRbcmVjb3JkLm5hbWVdID0gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmb3IgKHZhciBwcm9wIGluIGFkZGVkKVxuICAgICAgYWRkZWRbcHJvcF0gPSBvYmplY3RbcHJvcF07XG5cbiAgICBmb3IgKHZhciBwcm9wIGluIHJlbW92ZWQpXG4gICAgICByZW1vdmVkW3Byb3BdID0gdW5kZWZpbmVkO1xuXG4gICAgdmFyIGNoYW5nZWQgPSB7fTtcbiAgICBmb3IgKHZhciBwcm9wIGluIG9sZFZhbHVlcykge1xuICAgICAgaWYgKHByb3AgaW4gYWRkZWQgfHwgcHJvcCBpbiByZW1vdmVkKVxuICAgICAgICBjb250aW51ZTtcblxuICAgICAgdmFyIG5ld1ZhbHVlID0gb2JqZWN0W3Byb3BdO1xuICAgICAgaWYgKG9sZFZhbHVlc1twcm9wXSAhPT0gbmV3VmFsdWUpXG4gICAgICAgIGNoYW5nZWRbcHJvcF0gPSBuZXdWYWx1ZTtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgYWRkZWQ6IGFkZGVkLFxuICAgICAgcmVtb3ZlZDogcmVtb3ZlZCxcbiAgICAgIGNoYW5nZWQ6IGNoYW5nZWRcbiAgICB9O1xuICB9XG5cbiAgZnVuY3Rpb24gbmV3U3BsaWNlKGluZGV4LCByZW1vdmVkLCBhZGRlZENvdW50KSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGluZGV4OiBpbmRleCxcbiAgICAgIHJlbW92ZWQ6IHJlbW92ZWQsXG4gICAgICBhZGRlZENvdW50OiBhZGRlZENvdW50XG4gICAgfTtcbiAgfVxuXG4gIHZhciBFRElUX0xFQVZFID0gMDtcbiAgdmFyIEVESVRfVVBEQVRFID0gMTtcbiAgdmFyIEVESVRfQUREID0gMjtcbiAgdmFyIEVESVRfREVMRVRFID0gMztcblxuICBmdW5jdGlvbiBBcnJheVNwbGljZSgpIHt9XG5cbiAgQXJyYXlTcGxpY2UucHJvdG90eXBlID0ge1xuXG4gICAgLy8gTm90ZTogVGhpcyBmdW5jdGlvbiBpcyAqYmFzZWQqIG9uIHRoZSBjb21wdXRhdGlvbiBvZiB0aGUgTGV2ZW5zaHRlaW5cbiAgICAvLyBcImVkaXRcIiBkaXN0YW5jZS4gVGhlIG9uZSBjaGFuZ2UgaXMgdGhhdCBcInVwZGF0ZXNcIiBhcmUgdHJlYXRlZCBhcyB0d29cbiAgICAvLyBlZGl0cyAtIG5vdCBvbmUuIFdpdGggQXJyYXkgc3BsaWNlcywgYW4gdXBkYXRlIGlzIHJlYWxseSBhIGRlbGV0ZVxuICAgIC8vIGZvbGxvd2VkIGJ5IGFuIGFkZC4gQnkgcmV0YWluaW5nIHRoaXMsIHdlIG9wdGltaXplIGZvciBcImtlZXBpbmdcIiB0aGVcbiAgICAvLyBtYXhpbXVtIGFycmF5IGl0ZW1zIGluIHRoZSBvcmlnaW5hbCBhcnJheS4gRm9yIGV4YW1wbGU6XG4gICAgLy9cbiAgICAvLyAgICd4eHh4MTIzJyAtPiAnMTIzeXl5eSdcbiAgICAvL1xuICAgIC8vIFdpdGggMS1lZGl0IHVwZGF0ZXMsIHRoZSBzaG9ydGVzdCBwYXRoIHdvdWxkIGJlIGp1c3QgdG8gdXBkYXRlIGFsbCBzZXZlblxuICAgIC8vIGNoYXJhY3RlcnMuIFdpdGggMi1lZGl0IHVwZGF0ZXMsIHdlIGRlbGV0ZSA0LCBsZWF2ZSAzLCBhbmQgYWRkIDQuIFRoaXNcbiAgICAvLyBsZWF2ZXMgdGhlIHN1YnN0cmluZyAnMTIzJyBpbnRhY3QuXG4gICAgY2FsY0VkaXREaXN0YW5jZXM6IGZ1bmN0aW9uKGN1cnJlbnQsIGN1cnJlbnRTdGFydCwgY3VycmVudEVuZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb2xkLCBvbGRTdGFydCwgb2xkRW5kKSB7XG4gICAgICAvLyBcIkRlbGV0aW9uXCIgY29sdW1uc1xuICAgICAgdmFyIHJvd0NvdW50ID0gb2xkRW5kIC0gb2xkU3RhcnQgKyAxO1xuICAgICAgdmFyIGNvbHVtbkNvdW50ID0gY3VycmVudEVuZCAtIGN1cnJlbnRTdGFydCArIDE7XG4gICAgICB2YXIgZGlzdGFuY2VzID0gbmV3IEFycmF5KHJvd0NvdW50KTtcblxuICAgICAgLy8gXCJBZGRpdGlvblwiIHJvd3MuIEluaXRpYWxpemUgbnVsbCBjb2x1bW4uXG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHJvd0NvdW50OyBpKyspIHtcbiAgICAgICAgZGlzdGFuY2VzW2ldID0gbmV3IEFycmF5KGNvbHVtbkNvdW50KTtcbiAgICAgICAgZGlzdGFuY2VzW2ldWzBdID0gaTtcbiAgICAgIH1cblxuICAgICAgLy8gSW5pdGlhbGl6ZSBudWxsIHJvd1xuICAgICAgZm9yICh2YXIgaiA9IDA7IGogPCBjb2x1bW5Db3VudDsgaisrKVxuICAgICAgICBkaXN0YW5jZXNbMF1bal0gPSBqO1xuXG4gICAgICBmb3IgKHZhciBpID0gMTsgaSA8IHJvd0NvdW50OyBpKyspIHtcbiAgICAgICAgZm9yICh2YXIgaiA9IDE7IGogPCBjb2x1bW5Db3VudDsgaisrKSB7XG4gICAgICAgICAgaWYgKHRoaXMuZXF1YWxzKGN1cnJlbnRbY3VycmVudFN0YXJ0ICsgaiAtIDFdLCBvbGRbb2xkU3RhcnQgKyBpIC0gMV0pKVxuICAgICAgICAgICAgZGlzdGFuY2VzW2ldW2pdID0gZGlzdGFuY2VzW2kgLSAxXVtqIC0gMV07XG4gICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICB2YXIgbm9ydGggPSBkaXN0YW5jZXNbaSAtIDFdW2pdICsgMTtcbiAgICAgICAgICAgIHZhciB3ZXN0ID0gZGlzdGFuY2VzW2ldW2ogLSAxXSArIDE7XG4gICAgICAgICAgICBkaXN0YW5jZXNbaV1bal0gPSBub3J0aCA8IHdlc3QgPyBub3J0aCA6IHdlc3Q7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBkaXN0YW5jZXM7XG4gICAgfSxcblxuICAgIC8vIFRoaXMgc3RhcnRzIGF0IHRoZSBmaW5hbCB3ZWlnaHQsIGFuZCB3YWxrcyBcImJhY2t3YXJkXCIgYnkgZmluZGluZ1xuICAgIC8vIHRoZSBtaW5pbXVtIHByZXZpb3VzIHdlaWdodCByZWN1cnNpdmVseSB1bnRpbCB0aGUgb3JpZ2luIG9mIHRoZSB3ZWlnaHRcbiAgICAvLyBtYXRyaXguXG4gICAgc3BsaWNlT3BlcmF0aW9uc0Zyb21FZGl0RGlzdGFuY2VzOiBmdW5jdGlvbihkaXN0YW5jZXMpIHtcbiAgICAgIHZhciBpID0gZGlzdGFuY2VzLmxlbmd0aCAtIDE7XG4gICAgICB2YXIgaiA9IGRpc3RhbmNlc1swXS5sZW5ndGggLSAxO1xuICAgICAgdmFyIGN1cnJlbnQgPSBkaXN0YW5jZXNbaV1bal07XG4gICAgICB2YXIgZWRpdHMgPSBbXTtcbiAgICAgIHdoaWxlIChpID4gMCB8fCBqID4gMCkge1xuICAgICAgICBpZiAoaSA9PSAwKSB7XG4gICAgICAgICAgZWRpdHMucHVzaChFRElUX0FERCk7XG4gICAgICAgICAgai0tO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIGlmIChqID09IDApIHtcbiAgICAgICAgICBlZGl0cy5wdXNoKEVESVRfREVMRVRFKTtcbiAgICAgICAgICBpLS07XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIG5vcnRoV2VzdCA9IGRpc3RhbmNlc1tpIC0gMV1baiAtIDFdO1xuICAgICAgICB2YXIgd2VzdCA9IGRpc3RhbmNlc1tpIC0gMV1bal07XG4gICAgICAgIHZhciBub3J0aCA9IGRpc3RhbmNlc1tpXVtqIC0gMV07XG5cbiAgICAgICAgdmFyIG1pbjtcbiAgICAgICAgaWYgKHdlc3QgPCBub3J0aClcbiAgICAgICAgICBtaW4gPSB3ZXN0IDwgbm9ydGhXZXN0ID8gd2VzdCA6IG5vcnRoV2VzdDtcbiAgICAgICAgZWxzZVxuICAgICAgICAgIG1pbiA9IG5vcnRoIDwgbm9ydGhXZXN0ID8gbm9ydGggOiBub3J0aFdlc3Q7XG5cbiAgICAgICAgaWYgKG1pbiA9PSBub3J0aFdlc3QpIHtcbiAgICAgICAgICBpZiAobm9ydGhXZXN0ID09IGN1cnJlbnQpIHtcbiAgICAgICAgICAgIGVkaXRzLnB1c2goRURJVF9MRUFWRSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGVkaXRzLnB1c2goRURJVF9VUERBVEUpO1xuICAgICAgICAgICAgY3VycmVudCA9IG5vcnRoV2VzdDtcbiAgICAgICAgICB9XG4gICAgICAgICAgaS0tO1xuICAgICAgICAgIGotLTtcbiAgICAgICAgfSBlbHNlIGlmIChtaW4gPT0gd2VzdCkge1xuICAgICAgICAgIGVkaXRzLnB1c2goRURJVF9ERUxFVEUpO1xuICAgICAgICAgIGktLTtcbiAgICAgICAgICBjdXJyZW50ID0gd2VzdDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBlZGl0cy5wdXNoKEVESVRfQUREKTtcbiAgICAgICAgICBqLS07XG4gICAgICAgICAgY3VycmVudCA9IG5vcnRoO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGVkaXRzLnJldmVyc2UoKTtcbiAgICAgIHJldHVybiBlZGl0cztcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogU3BsaWNlIFByb2plY3Rpb24gZnVuY3Rpb25zOlxuICAgICAqXG4gICAgICogQSBzcGxpY2UgbWFwIGlzIGEgcmVwcmVzZW50YXRpb24gb2YgaG93IGEgcHJldmlvdXMgYXJyYXkgb2YgaXRlbXNcbiAgICAgKiB3YXMgdHJhbnNmb3JtZWQgaW50byBhIG5ldyBhcnJheSBvZiBpdGVtcy4gQ29uY2VwdHVhbGx5IGl0IGlzIGEgbGlzdCBvZlxuICAgICAqIHR1cGxlcyBvZlxuICAgICAqXG4gICAgICogICA8aW5kZXgsIHJlbW92ZWQsIGFkZGVkQ291bnQ+XG4gICAgICpcbiAgICAgKiB3aGljaCBhcmUga2VwdCBpbiBhc2NlbmRpbmcgaW5kZXggb3JkZXIgb2YuIFRoZSB0dXBsZSByZXByZXNlbnRzIHRoYXQgYXRcbiAgICAgKiB0aGUgfGluZGV4fCwgfHJlbW92ZWR8IHNlcXVlbmNlIG9mIGl0ZW1zIHdlcmUgcmVtb3ZlZCwgYW5kIGNvdW50aW5nIGZvcndhcmRcbiAgICAgKiBmcm9tIHxpbmRleHwsIHxhZGRlZENvdW50fCBpdGVtcyB3ZXJlIGFkZGVkLlxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogTGFja2luZyBpbmRpdmlkdWFsIHNwbGljZSBtdXRhdGlvbiBpbmZvcm1hdGlvbiwgdGhlIG1pbmltYWwgc2V0IG9mXG4gICAgICogc3BsaWNlcyBjYW4gYmUgc3ludGhlc2l6ZWQgZ2l2ZW4gdGhlIHByZXZpb3VzIHN0YXRlIGFuZCBmaW5hbCBzdGF0ZSBvZiBhblxuICAgICAqIGFycmF5LiBUaGUgYmFzaWMgYXBwcm9hY2ggaXMgdG8gY2FsY3VsYXRlIHRoZSBlZGl0IGRpc3RhbmNlIG1hdHJpeCBhbmRcbiAgICAgKiBjaG9vc2UgdGhlIHNob3J0ZXN0IHBhdGggdGhyb3VnaCBpdC5cbiAgICAgKlxuICAgICAqIENvbXBsZXhpdHk6IE8obCAqIHApXG4gICAgICogICBsOiBUaGUgbGVuZ3RoIG9mIHRoZSBjdXJyZW50IGFycmF5XG4gICAgICogICBwOiBUaGUgbGVuZ3RoIG9mIHRoZSBvbGQgYXJyYXlcbiAgICAgKi9cbiAgICBjYWxjU3BsaWNlczogZnVuY3Rpb24oY3VycmVudCwgY3VycmVudFN0YXJ0LCBjdXJyZW50RW5kLFxuICAgICAgICAgICAgICAgICAgICAgICAgICBvbGQsIG9sZFN0YXJ0LCBvbGRFbmQpIHtcbiAgICAgIHZhciBwcmVmaXhDb3VudCA9IDA7XG4gICAgICB2YXIgc3VmZml4Q291bnQgPSAwO1xuXG4gICAgICB2YXIgbWluTGVuZ3RoID0gTWF0aC5taW4oY3VycmVudEVuZCAtIGN1cnJlbnRTdGFydCwgb2xkRW5kIC0gb2xkU3RhcnQpO1xuICAgICAgaWYgKGN1cnJlbnRTdGFydCA9PSAwICYmIG9sZFN0YXJ0ID09IDApXG4gICAgICAgIHByZWZpeENvdW50ID0gdGhpcy5zaGFyZWRQcmVmaXgoY3VycmVudCwgb2xkLCBtaW5MZW5ndGgpO1xuXG4gICAgICBpZiAoY3VycmVudEVuZCA9PSBjdXJyZW50Lmxlbmd0aCAmJiBvbGRFbmQgPT0gb2xkLmxlbmd0aClcbiAgICAgICAgc3VmZml4Q291bnQgPSB0aGlzLnNoYXJlZFN1ZmZpeChjdXJyZW50LCBvbGQsIG1pbkxlbmd0aCAtIHByZWZpeENvdW50KTtcblxuICAgICAgY3VycmVudFN0YXJ0ICs9IHByZWZpeENvdW50O1xuICAgICAgb2xkU3RhcnQgKz0gcHJlZml4Q291bnQ7XG4gICAgICBjdXJyZW50RW5kIC09IHN1ZmZpeENvdW50O1xuICAgICAgb2xkRW5kIC09IHN1ZmZpeENvdW50O1xuXG4gICAgICBpZiAoY3VycmVudEVuZCAtIGN1cnJlbnRTdGFydCA9PSAwICYmIG9sZEVuZCAtIG9sZFN0YXJ0ID09IDApXG4gICAgICAgIHJldHVybiBbXTtcblxuICAgICAgaWYgKGN1cnJlbnRTdGFydCA9PSBjdXJyZW50RW5kKSB7XG4gICAgICAgIHZhciBzcGxpY2UgPSBuZXdTcGxpY2UoY3VycmVudFN0YXJ0LCBbXSwgMCk7XG4gICAgICAgIHdoaWxlIChvbGRTdGFydCA8IG9sZEVuZClcbiAgICAgICAgICBzcGxpY2UucmVtb3ZlZC5wdXNoKG9sZFtvbGRTdGFydCsrXSk7XG5cbiAgICAgICAgcmV0dXJuIFsgc3BsaWNlIF07XG4gICAgICB9IGVsc2UgaWYgKG9sZFN0YXJ0ID09IG9sZEVuZClcbiAgICAgICAgcmV0dXJuIFsgbmV3U3BsaWNlKGN1cnJlbnRTdGFydCwgW10sIGN1cnJlbnRFbmQgLSBjdXJyZW50U3RhcnQpIF07XG5cbiAgICAgIHZhciBvcHMgPSB0aGlzLnNwbGljZU9wZXJhdGlvbnNGcm9tRWRpdERpc3RhbmNlcyhcbiAgICAgICAgICB0aGlzLmNhbGNFZGl0RGlzdGFuY2VzKGN1cnJlbnQsIGN1cnJlbnRTdGFydCwgY3VycmVudEVuZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9sZCwgb2xkU3RhcnQsIG9sZEVuZCkpO1xuXG4gICAgICB2YXIgc3BsaWNlID0gdW5kZWZpbmVkO1xuICAgICAgdmFyIHNwbGljZXMgPSBbXTtcbiAgICAgIHZhciBpbmRleCA9IGN1cnJlbnRTdGFydDtcbiAgICAgIHZhciBvbGRJbmRleCA9IG9sZFN0YXJ0O1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBvcHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgc3dpdGNoKG9wc1tpXSkge1xuICAgICAgICAgIGNhc2UgRURJVF9MRUFWRTpcbiAgICAgICAgICAgIGlmIChzcGxpY2UpIHtcbiAgICAgICAgICAgICAgc3BsaWNlcy5wdXNoKHNwbGljZSk7XG4gICAgICAgICAgICAgIHNwbGljZSA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaW5kZXgrKztcbiAgICAgICAgICAgIG9sZEluZGV4Kys7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlIEVESVRfVVBEQVRFOlxuICAgICAgICAgICAgaWYgKCFzcGxpY2UpXG4gICAgICAgICAgICAgIHNwbGljZSA9IG5ld1NwbGljZShpbmRleCwgW10sIDApO1xuXG4gICAgICAgICAgICBzcGxpY2UuYWRkZWRDb3VudCsrO1xuICAgICAgICAgICAgaW5kZXgrKztcblxuICAgICAgICAgICAgc3BsaWNlLnJlbW92ZWQucHVzaChvbGRbb2xkSW5kZXhdKTtcbiAgICAgICAgICAgIG9sZEluZGV4Kys7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlIEVESVRfQUREOlxuICAgICAgICAgICAgaWYgKCFzcGxpY2UpXG4gICAgICAgICAgICAgIHNwbGljZSA9IG5ld1NwbGljZShpbmRleCwgW10sIDApO1xuXG4gICAgICAgICAgICBzcGxpY2UuYWRkZWRDb3VudCsrO1xuICAgICAgICAgICAgaW5kZXgrKztcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgRURJVF9ERUxFVEU6XG4gICAgICAgICAgICBpZiAoIXNwbGljZSlcbiAgICAgICAgICAgICAgc3BsaWNlID0gbmV3U3BsaWNlKGluZGV4LCBbXSwgMCk7XG5cbiAgICAgICAgICAgIHNwbGljZS5yZW1vdmVkLnB1c2gob2xkW29sZEluZGV4XSk7XG4gICAgICAgICAgICBvbGRJbmRleCsrO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKHNwbGljZSkge1xuICAgICAgICBzcGxpY2VzLnB1c2goc3BsaWNlKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBzcGxpY2VzO1xuICAgIH0sXG5cbiAgICBzaGFyZWRQcmVmaXg6IGZ1bmN0aW9uKGN1cnJlbnQsIG9sZCwgc2VhcmNoTGVuZ3RoKSB7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHNlYXJjaExlbmd0aDsgaSsrKVxuICAgICAgICBpZiAoIXRoaXMuZXF1YWxzKGN1cnJlbnRbaV0sIG9sZFtpXSkpXG4gICAgICAgICAgcmV0dXJuIGk7XG4gICAgICByZXR1cm4gc2VhcmNoTGVuZ3RoO1xuICAgIH0sXG5cbiAgICBzaGFyZWRTdWZmaXg6IGZ1bmN0aW9uKGN1cnJlbnQsIG9sZCwgc2VhcmNoTGVuZ3RoKSB7XG4gICAgICB2YXIgaW5kZXgxID0gY3VycmVudC5sZW5ndGg7XG4gICAgICB2YXIgaW5kZXgyID0gb2xkLmxlbmd0aDtcbiAgICAgIHZhciBjb3VudCA9IDA7XG4gICAgICB3aGlsZSAoY291bnQgPCBzZWFyY2hMZW5ndGggJiYgdGhpcy5lcXVhbHMoY3VycmVudFstLWluZGV4MV0sIG9sZFstLWluZGV4Ml0pKVxuICAgICAgICBjb3VudCsrO1xuXG4gICAgICByZXR1cm4gY291bnQ7XG4gICAgfSxcblxuICAgIGNhbGN1bGF0ZVNwbGljZXM6IGZ1bmN0aW9uKGN1cnJlbnQsIHByZXZpb3VzKSB7XG4gICAgICByZXR1cm4gdGhpcy5jYWxjU3BsaWNlcyhjdXJyZW50LCAwLCBjdXJyZW50Lmxlbmd0aCwgcHJldmlvdXMsIDAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcmV2aW91cy5sZW5ndGgpO1xuICAgIH0sXG5cbiAgICBlcXVhbHM6IGZ1bmN0aW9uKGN1cnJlbnRWYWx1ZSwgcHJldmlvdXNWYWx1ZSkge1xuICAgICAgcmV0dXJuIGN1cnJlbnRWYWx1ZSA9PT0gcHJldmlvdXNWYWx1ZTtcbiAgICB9XG4gIH07XG5cbiAgdmFyIGFycmF5U3BsaWNlID0gbmV3IEFycmF5U3BsaWNlKCk7XG5cbiAgZnVuY3Rpb24gY2FsY1NwbGljZXMoY3VycmVudCwgY3VycmVudFN0YXJ0LCBjdXJyZW50RW5kLFxuICAgICAgICAgICAgICAgICAgICAgICBvbGQsIG9sZFN0YXJ0LCBvbGRFbmQpIHtcbiAgICByZXR1cm4gYXJyYXlTcGxpY2UuY2FsY1NwbGljZXMoY3VycmVudCwgY3VycmVudFN0YXJ0LCBjdXJyZW50RW5kLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbGQsIG9sZFN0YXJ0LCBvbGRFbmQpO1xuICB9XG5cbiAgZnVuY3Rpb24gaW50ZXJzZWN0KHN0YXJ0MSwgZW5kMSwgc3RhcnQyLCBlbmQyKSB7XG4gICAgLy8gRGlzam9pbnRcbiAgICBpZiAoZW5kMSA8IHN0YXJ0MiB8fCBlbmQyIDwgc3RhcnQxKVxuICAgICAgcmV0dXJuIC0xO1xuXG4gICAgLy8gQWRqYWNlbnRcbiAgICBpZiAoZW5kMSA9PSBzdGFydDIgfHwgZW5kMiA9PSBzdGFydDEpXG4gICAgICByZXR1cm4gMDtcblxuICAgIC8vIE5vbi16ZXJvIGludGVyc2VjdCwgc3BhbjEgZmlyc3RcbiAgICBpZiAoc3RhcnQxIDwgc3RhcnQyKSB7XG4gICAgICBpZiAoZW5kMSA8IGVuZDIpXG4gICAgICAgIHJldHVybiBlbmQxIC0gc3RhcnQyOyAvLyBPdmVybGFwXG4gICAgICBlbHNlXG4gICAgICAgIHJldHVybiBlbmQyIC0gc3RhcnQyOyAvLyBDb250YWluZWRcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gTm9uLXplcm8gaW50ZXJzZWN0LCBzcGFuMiBmaXJzdFxuICAgICAgaWYgKGVuZDIgPCBlbmQxKVxuICAgICAgICByZXR1cm4gZW5kMiAtIHN0YXJ0MTsgLy8gT3ZlcmxhcFxuICAgICAgZWxzZVxuICAgICAgICByZXR1cm4gZW5kMSAtIHN0YXJ0MTsgLy8gQ29udGFpbmVkXG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gbWVyZ2VTcGxpY2Uoc3BsaWNlcywgaW5kZXgsIHJlbW92ZWQsIGFkZGVkQ291bnQpIHtcblxuICAgIHZhciBzcGxpY2UgPSBuZXdTcGxpY2UoaW5kZXgsIHJlbW92ZWQsIGFkZGVkQ291bnQpO1xuXG4gICAgdmFyIGluc2VydGVkID0gZmFsc2U7XG4gICAgdmFyIGluc2VydGlvbk9mZnNldCA9IDA7XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHNwbGljZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBjdXJyZW50ID0gc3BsaWNlc1tpXTtcbiAgICAgIGN1cnJlbnQuaW5kZXggKz0gaW5zZXJ0aW9uT2Zmc2V0O1xuXG4gICAgICBpZiAoaW5zZXJ0ZWQpXG4gICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICB2YXIgaW50ZXJzZWN0Q291bnQgPSBpbnRlcnNlY3Qoc3BsaWNlLmluZGV4LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNwbGljZS5pbmRleCArIHNwbGljZS5yZW1vdmVkLmxlbmd0aCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjdXJyZW50LmluZGV4LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGN1cnJlbnQuaW5kZXggKyBjdXJyZW50LmFkZGVkQ291bnQpO1xuXG4gICAgICBpZiAoaW50ZXJzZWN0Q291bnQgPj0gMCkge1xuICAgICAgICAvLyBNZXJnZSB0aGUgdHdvIHNwbGljZXNcblxuICAgICAgICBzcGxpY2VzLnNwbGljZShpLCAxKTtcbiAgICAgICAgaS0tO1xuXG4gICAgICAgIGluc2VydGlvbk9mZnNldCAtPSBjdXJyZW50LmFkZGVkQ291bnQgLSBjdXJyZW50LnJlbW92ZWQubGVuZ3RoO1xuXG4gICAgICAgIHNwbGljZS5hZGRlZENvdW50ICs9IGN1cnJlbnQuYWRkZWRDb3VudCAtIGludGVyc2VjdENvdW50O1xuICAgICAgICB2YXIgZGVsZXRlQ291bnQgPSBzcGxpY2UucmVtb3ZlZC5sZW5ndGggK1xuICAgICAgICAgICAgICAgICAgICAgICAgICBjdXJyZW50LnJlbW92ZWQubGVuZ3RoIC0gaW50ZXJzZWN0Q291bnQ7XG5cbiAgICAgICAgaWYgKCFzcGxpY2UuYWRkZWRDb3VudCAmJiAhZGVsZXRlQ291bnQpIHtcbiAgICAgICAgICAvLyBtZXJnZWQgc3BsaWNlIGlzIGEgbm9vcC4gZGlzY2FyZC5cbiAgICAgICAgICBpbnNlcnRlZCA9IHRydWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdmFyIHJlbW92ZWQgPSBjdXJyZW50LnJlbW92ZWQ7XG5cbiAgICAgICAgICBpZiAoc3BsaWNlLmluZGV4IDwgY3VycmVudC5pbmRleCkge1xuICAgICAgICAgICAgLy8gc29tZSBwcmVmaXggb2Ygc3BsaWNlLnJlbW92ZWQgaXMgcHJlcGVuZGVkIHRvIGN1cnJlbnQucmVtb3ZlZC5cbiAgICAgICAgICAgIHZhciBwcmVwZW5kID0gc3BsaWNlLnJlbW92ZWQuc2xpY2UoMCwgY3VycmVudC5pbmRleCAtIHNwbGljZS5pbmRleCk7XG4gICAgICAgICAgICBBcnJheS5wcm90b3R5cGUucHVzaC5hcHBseShwcmVwZW5kLCByZW1vdmVkKTtcbiAgICAgICAgICAgIHJlbW92ZWQgPSBwcmVwZW5kO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChzcGxpY2UuaW5kZXggKyBzcGxpY2UucmVtb3ZlZC5sZW5ndGggPiBjdXJyZW50LmluZGV4ICsgY3VycmVudC5hZGRlZENvdW50KSB7XG4gICAgICAgICAgICAvLyBzb21lIHN1ZmZpeCBvZiBzcGxpY2UucmVtb3ZlZCBpcyBhcHBlbmRlZCB0byBjdXJyZW50LnJlbW92ZWQuXG4gICAgICAgICAgICB2YXIgYXBwZW5kID0gc3BsaWNlLnJlbW92ZWQuc2xpY2UoY3VycmVudC5pbmRleCArIGN1cnJlbnQuYWRkZWRDb3VudCAtIHNwbGljZS5pbmRleCk7XG4gICAgICAgICAgICBBcnJheS5wcm90b3R5cGUucHVzaC5hcHBseShyZW1vdmVkLCBhcHBlbmQpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHNwbGljZS5yZW1vdmVkID0gcmVtb3ZlZDtcbiAgICAgICAgICBpZiAoY3VycmVudC5pbmRleCA8IHNwbGljZS5pbmRleCkge1xuICAgICAgICAgICAgc3BsaWNlLmluZGV4ID0gY3VycmVudC5pbmRleDtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAoc3BsaWNlLmluZGV4IDwgY3VycmVudC5pbmRleCkge1xuICAgICAgICAvLyBJbnNlcnQgc3BsaWNlIGhlcmUuXG5cbiAgICAgICAgaW5zZXJ0ZWQgPSB0cnVlO1xuXG4gICAgICAgIHNwbGljZXMuc3BsaWNlKGksIDAsIHNwbGljZSk7XG4gICAgICAgIGkrKztcblxuICAgICAgICB2YXIgb2Zmc2V0ID0gc3BsaWNlLmFkZGVkQ291bnQgLSBzcGxpY2UucmVtb3ZlZC5sZW5ndGhcbiAgICAgICAgY3VycmVudC5pbmRleCArPSBvZmZzZXQ7XG4gICAgICAgIGluc2VydGlvbk9mZnNldCArPSBvZmZzZXQ7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKCFpbnNlcnRlZClcbiAgICAgIHNwbGljZXMucHVzaChzcGxpY2UpO1xuICB9XG5cbiAgZnVuY3Rpb24gY3JlYXRlSW5pdGlhbFNwbGljZXMoYXJyYXksIGNoYW5nZVJlY29yZHMpIHtcbiAgICB2YXIgc3BsaWNlcyA9IFtdO1xuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjaGFuZ2VSZWNvcmRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgcmVjb3JkID0gY2hhbmdlUmVjb3Jkc1tpXTtcbiAgICAgIHN3aXRjaChyZWNvcmQudHlwZSkge1xuICAgICAgICBjYXNlICdzcGxpY2UnOlxuICAgICAgICAgIG1lcmdlU3BsaWNlKHNwbGljZXMsIHJlY29yZC5pbmRleCwgcmVjb3JkLnJlbW92ZWQuc2xpY2UoKSwgcmVjb3JkLmFkZGVkQ291bnQpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdhZGQnOlxuICAgICAgICBjYXNlICd1cGRhdGUnOlxuICAgICAgICBjYXNlICdkZWxldGUnOlxuICAgICAgICAgIGlmICghaXNJbmRleChyZWNvcmQubmFtZSkpXG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICB2YXIgaW5kZXggPSB0b051bWJlcihyZWNvcmQubmFtZSk7XG4gICAgICAgICAgaWYgKGluZGV4IDwgMClcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgIG1lcmdlU3BsaWNlKHNwbGljZXMsIGluZGV4LCBbcmVjb3JkLm9sZFZhbHVlXSwgMSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgY29uc29sZS5lcnJvcignVW5leHBlY3RlZCByZWNvcmQgdHlwZTogJyArIEpTT04uc3RyaW5naWZ5KHJlY29yZCkpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBzcGxpY2VzO1xuICB9XG5cbiAgZnVuY3Rpb24gcHJvamVjdEFycmF5U3BsaWNlcyhhcnJheSwgY2hhbmdlUmVjb3Jkcykge1xuICAgIHZhciBzcGxpY2VzID0gW107XG5cbiAgICBjcmVhdGVJbml0aWFsU3BsaWNlcyhhcnJheSwgY2hhbmdlUmVjb3JkcykuZm9yRWFjaChmdW5jdGlvbihzcGxpY2UpIHtcbiAgICAgIGlmIChzcGxpY2UuYWRkZWRDb3VudCA9PSAxICYmIHNwbGljZS5yZW1vdmVkLmxlbmd0aCA9PSAxKSB7XG4gICAgICAgIGlmIChzcGxpY2UucmVtb3ZlZFswXSAhPT0gYXJyYXlbc3BsaWNlLmluZGV4XSlcbiAgICAgICAgICBzcGxpY2VzLnB1c2goc3BsaWNlKTtcblxuICAgICAgICByZXR1cm5cbiAgICAgIH07XG5cbiAgICAgIHNwbGljZXMgPSBzcGxpY2VzLmNvbmNhdChjYWxjU3BsaWNlcyhhcnJheSwgc3BsaWNlLmluZGV4LCBzcGxpY2UuaW5kZXggKyBzcGxpY2UuYWRkZWRDb3VudCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzcGxpY2UucmVtb3ZlZCwgMCwgc3BsaWNlLnJlbW92ZWQubGVuZ3RoKSk7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gc3BsaWNlcztcbiAgfVxuXG4gLy8gRXhwb3J0IHRoZSBvYnNlcnZlLWpzIG9iamVjdCBmb3IgKipOb2RlLmpzKiosIHdpdGhcbi8vIGJhY2t3YXJkcy1jb21wYXRpYmlsaXR5IGZvciB0aGUgb2xkIGByZXF1aXJlKClgIEFQSS4gSWYgd2UncmUgaW5cbi8vIHRoZSBicm93c2VyLCBleHBvcnQgYXMgYSBnbG9iYWwgb2JqZWN0LlxudmFyIGV4cG9zZSA9IGdsb2JhbDtcbmlmICh0eXBlb2YgZXhwb3J0cyAhPT0gJ3VuZGVmaW5lZCcpIHtcbmlmICh0eXBlb2YgbW9kdWxlICE9PSAndW5kZWZpbmVkJyAmJiBtb2R1bGUuZXhwb3J0cykge1xuZXhwb3NlID0gZXhwb3J0cyA9IG1vZHVsZS5leHBvcnRzO1xufVxuZXhwb3NlID0gZXhwb3J0cztcbn1cbmV4cG9zZS5PYnNlcnZlciA9IE9ic2VydmVyO1xuZXhwb3NlLk9ic2VydmVyLnJ1bkVPTV8gPSBydW5FT007XG5leHBvc2UuT2JzZXJ2ZXIub2JzZXJ2ZXJTZW50aW5lbF8gPSBvYnNlcnZlclNlbnRpbmVsOyAvLyBmb3IgdGVzdGluZy5cbmV4cG9zZS5PYnNlcnZlci5oYXNPYmplY3RPYnNlcnZlID0gaGFzT2JzZXJ2ZTtcbmV4cG9zZS5BcnJheU9ic2VydmVyID0gQXJyYXlPYnNlcnZlcjtcbmV4cG9zZS5BcnJheU9ic2VydmVyLmNhbGN1bGF0ZVNwbGljZXMgPSBmdW5jdGlvbihjdXJyZW50LCBwcmV2aW91cykge1xucmV0dXJuIGFycmF5U3BsaWNlLmNhbGN1bGF0ZVNwbGljZXMoY3VycmVudCwgcHJldmlvdXMpO1xufTtcbmV4cG9zZS5QbGF0Zm9ybSA9IGdsb2JhbC5QbGF0Zm9ybTtcbmV4cG9zZS5BcnJheVNwbGljZSA9IEFycmF5U3BsaWNlO1xuZXhwb3NlLk9iamVjdE9ic2VydmVyID0gT2JqZWN0T2JzZXJ2ZXI7XG59KSh0eXBlb2YgZ2xvYmFsICE9PSAndW5kZWZpbmVkJyAmJiBnbG9iYWwgJiYgdHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcgJiYgbW9kdWxlID8gZ2xvYmFsIDogdGhpcyB8fCB3aW5kb3cpO1xuXG59KS5jYWxsKHRoaXMsdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbCA6IHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSkiXX0=
