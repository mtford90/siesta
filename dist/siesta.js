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
        this.emit('change', this.results = results.asModelQuerySet(this.model), {
            index: from,
            removed: [removed],
            type: modelEvents.ModelEventType.Splice,
            obj: this,
            field: 'results'
        });
        results.splice(to, 0, removed);
        this.emit('change', this.results = results.asModelQuerySet(this.model), {
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
},{"./error":11,"./log":14,"./modelEvents":18,"./querySet":21,"./reactiveQuery":22,"./util":25}],2:[function(require,module,exports){
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
exports.getSingleton = getSingleton;
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
},{"../vendor/observe-js/src/observe":31,"./modelEvents":18,"./util":25,"events":29}],13:[function(require,module,exports){
var util = require('./util'),
    CollectionRegistry = require('./collectionRegistry').CollectionRegistry,
    Collection = require('./collection'),
    cache = require('./cache'),
    Model = require('./model'),
    error = require('./error'),
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
        MappingOperation: require('./mappingOperation'),
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
                    siesta.ext.storage._load(function (err) {
                        if (!err) {
                            installed = true;
                            if (self.queuedTasks) self.queuedTasks.execute();
                        }
                        cb(err);
                    });
                }
            });

            return deferred.promise;
        }
        else {
            throw new error.InternalSiestaError('Already installing...');
        }rese

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
},{"./Query":5,"./RelationshipType":7,"./cache":8,"./collection":9,"./collectionRegistry":10,"./error":11,"./events":12,"./log":14,"./mappingOperation":16,"./model":17,"./modelEvents":18,"./modelInstance":19,"./query":20,"./reactiveQuery":22,"./store":23,"./util":25,"extend":30}],14:[function(require,module,exports){
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
        callInit: true
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

                    var initTasks;
                    if (self.callInit) {
                        initTasks = _.reduce(self._newObjects, function (m, o) {
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
                    }
                    else {
                        initTasks = [];
                    }
                    async.parallel(initTasks, function () {
                        done(self.errors.length ? self.errors : null, self.objects);
                    });
                }
                catch (e) {
                    console.error('caught error', e);
                    done(e);
                }
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
                        callInit: this.callInit
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



},{"./cache":8,"./error":11,"./log":14,"./modelEvents":18,"./modelInstance":19,"./store":23,"./util":25}],17:[function(require,module,exports){
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
                    console.log('reverse relationship', relationship);
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
                        this.map({}, function (err) {
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
                            console.log('propertyName', propertyName);
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
                        console.log('muthafukin emission', e);
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

        argDecl[1].split(FN_ARG_SPLIT).forEach(function (arg) {
            arg.replace(FN_ARG, function (all, underscore, name) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9jb3JlL0FycmFuZ2VkUmVhY3RpdmVRdWVyeS5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2NvcmUvTW9kZWxJbnN0YW5jZS5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2NvcmUvT25lVG9NYW55UHJveHkuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9jb3JlL09uZVRvT25lUHJveHkuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9jb3JlL1F1ZXJ5LmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3QvY29yZS9SZWxhdGlvbnNoaXBQcm94eS5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2NvcmUvUmVsYXRpb25zaGlwVHlwZS5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2NvcmUvY2FjaGUuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9jb3JlL2NvbGxlY3Rpb24uanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9jb3JlL2NvbGxlY3Rpb25SZWdpc3RyeS5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2NvcmUvZXJyb3IuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9jb3JlL2V2ZW50cy5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2NvcmUvaW5kZXguanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9jb3JlL2xvZy5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2NvcmUvbWFueVRvTWFueVByb3h5LmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3QvY29yZS9tYXBwaW5nT3BlcmF0aW9uLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3QvY29yZS9tb2RlbC5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2NvcmUvbW9kZWxFdmVudHMuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9jb3JlL3F1ZXJ5U2V0LmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3QvY29yZS9yZWFjdGl2ZVF1ZXJ5LmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3QvY29yZS9zdG9yZS5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2NvcmUvdXRpbC9hc3luYy5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2NvcmUvdXRpbC9pbmRleC5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2NvcmUvdXRpbC9taXNjLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3QvY29yZS91dGlsL3Byb21pc2UuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9jb3JlL3V0aWwvdW5kZXJzY29yZS5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9ldmVudHMvZXZlbnRzLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3Qvbm9kZV9tb2R1bGVzL2V4dGVuZC9pbmRleC5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L3ZlbmRvci9vYnNlcnZlLWpzL3NyYy9vYnNlcnZlLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5S0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25JQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pRQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5VEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6WEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hTQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwSkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hPQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyWkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcnJCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7O0FDL0dBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDak1BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOU9BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMU1BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3UUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdFRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN1NBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLyoqXG4gKiBTb2x2ZXMgdGhlIGNvbW1vbiBwcm9ibGVtIG9mIG1haW50YWluaW5nIHRoZSBvcmRlciBvZiBhIHNldCBvZiBhIG1vZGVscyBhbmQgcXVlcnlpbmcgb24gdGhhdCBvcmRlci5cbiAqXG4gKiBUaGUgc2FtZSBhcyBSZWFjdGl2ZVF1ZXJ5IGJ1dCBlbmFibGVzIG1hbnVhbCByZW9yZGVyaW5nIG9mIG1vZGVscyBhbmQgbWFpbnRhaW5zIGFuIGluZGV4IGZpZWxkLlxuICovXG5cbnZhciBSZWFjdGl2ZVF1ZXJ5ID0gcmVxdWlyZSgnLi9yZWFjdGl2ZVF1ZXJ5JyksXG4gICAgbG9nID0gcmVxdWlyZSgnLi9sb2cnKSxcbiAgICB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyksXG4gICAgZXJyb3IgPSByZXF1aXJlKCcuL2Vycm9yJyksXG4gICAgbW9kZWxFdmVudHMgPSByZXF1aXJlKCcuL21vZGVsRXZlbnRzJyksXG4gICAgSW50ZXJuYWxTaWVzdGFFcnJvciA9IGVycm9yLkludGVybmFsU2llc3RhRXJyb3IsXG4gICAgY29uc3RydWN0UXVlcnlTZXQgPSByZXF1aXJlKCcuL3F1ZXJ5U2V0JyksXG4gICAgY29uc3RydWN0RXJyb3IgPSBlcnJvci5lcnJvckZhY3RvcnkoZXJyb3IuQ29tcG9uZW50cy5BcnJhbmdlZFJlYWN0aXZlUXVlcnkpLFxuICAgIF8gPSB1dGlsLl87XG5cblxudmFyIExvZ2dlciA9IGxvZy5sb2dnZXJXaXRoTmFtZSgnUXVlcnknKTtcblxuZnVuY3Rpb24gQXJyYW5nZWRSZWFjdGl2ZVF1ZXJ5KHF1ZXJ5KSB7XG4gICAgUmVhY3RpdmVRdWVyeS5jYWxsKHRoaXMsIHF1ZXJ5KTtcbiAgICB0aGlzLmluZGV4QXR0cmlidXRlID0gJ2luZGV4Jztcbn1cblxuQXJyYW5nZWRSZWFjdGl2ZVF1ZXJ5LnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoUmVhY3RpdmVRdWVyeS5wcm90b3R5cGUpO1xuXG5fLmV4dGVuZChBcnJhbmdlZFJlYWN0aXZlUXVlcnkucHJvdG90eXBlLCB7XG4gICAgX3JlZnJlc2hJbmRleGVzOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciByZXN1bHRzID0gdGhpcy5yZXN1bHRzLFxuICAgICAgICAgICAgaW5kZXhBdHRyaWJ1dGUgPSB0aGlzLmluZGV4QXR0cmlidXRlO1xuICAgICAgICBpZiAoIXJlc3VsdHMpIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdBcnJhbmdlZFJlYWN0aXZlUXVlcnkgbXVzdCBiZSBpbml0aWFsaXNlZCcpO1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHJlc3VsdHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHZhciBtb2RlbEluc3RhbmNlID0gcmVzdWx0c1tpXTtcbiAgICAgICAgICAgIG1vZGVsSW5zdGFuY2VbaW5kZXhBdHRyaWJ1dGVdID0gaTtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgX21lcmdlSW5kZXhlczogZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgcmVzdWx0cyA9IHRoaXMucmVzdWx0cyxcbiAgICAgICAgICAgIG5ld1Jlc3VsdHMgPSBbXSxcbiAgICAgICAgICAgIG91dE9mQm91bmRzID0gW10sXG4gICAgICAgICAgICB1bmluZGV4ZWQgPSBbXTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCByZXN1bHRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB2YXIgcmVzID0gcmVzdWx0c1tpXSxcbiAgICAgICAgICAgICAgICBzdG9yZWRJbmRleCA9IHJlc1t0aGlzLmluZGV4QXR0cmlidXRlXTtcbiAgICAgICAgICAgIGlmIChzdG9yZWRJbmRleCA9PSB1bmRlZmluZWQpIHsgLy8gbnVsbCBvciB1bmRlZmluZWRcbiAgICAgICAgICAgICAgICB1bmluZGV4ZWQucHVzaChyZXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoc3RvcmVkSW5kZXggPiByZXN1bHRzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIG91dE9mQm91bmRzLnB1c2gocmVzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIEhhbmRsZSBkdXBsaWNhdGUgaW5kZXhlc1xuICAgICAgICAgICAgICAgIGlmICghbmV3UmVzdWx0c1tzdG9yZWRJbmRleF0pIHtcbiAgICAgICAgICAgICAgICAgICAgbmV3UmVzdWx0c1tzdG9yZWRJbmRleF0gPSByZXM7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB1bmluZGV4ZWQucHVzaChyZXMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBvdXRPZkJvdW5kcyA9IF8uc29ydEJ5KG91dE9mQm91bmRzLCBmdW5jdGlvbiAoeCkge1xuICAgICAgICAgICAgcmV0dXJuIHhbdGhpcy5pbmRleEF0dHJpYnV0ZV07XG4gICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICAgIC8vIFNoaWZ0IHRoZSBpbmRleCBvZiBhbGwgbW9kZWxzIHdpdGggaW5kZXhlcyBvdXQgb2YgYm91bmRzIGludG8gdGhlIGNvcnJlY3QgcmFuZ2UuXG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBvdXRPZkJvdW5kcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgcmVzID0gb3V0T2ZCb3VuZHNbaV07XG4gICAgICAgICAgICB2YXIgcmVzdWx0c0luZGV4ID0gdGhpcy5yZXN1bHRzLmxlbmd0aCAtIG91dE9mQm91bmRzLmxlbmd0aCArIGk7XG4gICAgICAgICAgICByZXNbdGhpcy5pbmRleEF0dHJpYnV0ZV0gPSByZXN1bHRzSW5kZXg7XG4gICAgICAgICAgICBuZXdSZXN1bHRzW3Jlc3VsdHNJbmRleF0gPSByZXM7XG4gICAgICAgIH1cbiAgICAgICAgdW5pbmRleGVkID0gdGhpcy5fcXVlcnkuX3NvcnRSZXN1bHRzKHVuaW5kZXhlZCk7XG4gICAgICAgIHZhciBuID0gMDtcbiAgICAgICAgd2hpbGUgKHVuaW5kZXhlZC5sZW5ndGgpIHtcbiAgICAgICAgICAgIHJlcyA9IHVuaW5kZXhlZC5zaGlmdCgpO1xuICAgICAgICAgICAgd2hpbGUgKG5ld1Jlc3VsdHNbbl0pIHtcbiAgICAgICAgICAgICAgICBuKys7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBuZXdSZXN1bHRzW25dID0gcmVzO1xuICAgICAgICAgICAgcmVzW3RoaXMuaW5kZXhBdHRyaWJ1dGVdID0gbjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMucmVzdWx0cyA9IGNvbnN0cnVjdFF1ZXJ5U2V0KG5ld1Jlc3VsdHMsIHRoaXMubW9kZWwpO1xuICAgIH0sXG4gICAgaW5pdDogZnVuY3Rpb24gKGNiKSB7XG4gICAgICAgIHZhciBkZWZlcnJlZCA9IHV0aWwuZGVmZXIoY2IpO1xuICAgICAgICBSZWFjdGl2ZVF1ZXJ5LnByb3RvdHlwZS5pbml0LmNhbGwodGhpcywgZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgICAgICBpZiAoIXRoaXMubW9kZWwuaGFzQXR0cmlidXRlTmFtZWQodGhpcy5pbmRleEF0dHJpYnV0ZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgZXJyID0gY29uc3RydWN0RXJyb3IoJ01vZGVsIFwiJyArIHRoaXMubW9kZWwubmFtZSArICdcIiBkb2VzIG5vdCBoYXZlIGFuIGF0dHJpYnV0ZSBuYW1lZCBcIicgKyB0aGlzLmluZGV4QXR0cmlidXRlICsgJ1wiJylcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX21lcmdlSW5kZXhlcygpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9xdWVyeS5jbGVhck9yZGVyaW5nKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZGVmZXJyZWQuZmluaXNoKGVyciwgZXJyID8gbnVsbCA6IHRoaXMucmVzdWx0cyk7XG4gICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xuICAgIH0sXG4gICAgX2hhbmRsZU5vdGlmOiBmdW5jdGlvbiAobikge1xuICAgICAgICAvLyBXZSBkb24ndCB3YW50IHRvIGtlZXAgZXhlY3V0aW5nIHRoZSBxdWVyeSBlYWNoIHRpbWUgdGhlIGluZGV4IGV2ZW50IGZpcmVzIGFzIHdlJ3JlIGNoYW5naW5nIHRoZSBpbmRleCBvdXJzZWx2ZXNcbiAgICAgICAgaWYgKG4uZmllbGQgIT0gdGhpcy5pbmRleEF0dHJpYnV0ZSkge1xuICAgICAgICAgICAgUmVhY3RpdmVRdWVyeS5wcm90b3R5cGUuX2hhbmRsZU5vdGlmLmNhbGwodGhpcywgbik7XG4gICAgICAgICAgICB0aGlzLl9yZWZyZXNoSW5kZXhlcygpO1xuICAgICAgICB9XG4gICAgfSxcbiAgICB2YWxpZGF0ZUluZGV4OiBmdW5jdGlvbiAoaWR4KSB7XG4gICAgICAgIHZhciBtYXhJbmRleCA9IHRoaXMucmVzdWx0cy5sZW5ndGggLSAxLFxuICAgICAgICAgICAgbWluSW5kZXggPSAwO1xuICAgICAgICBpZiAoIShpZHggPj0gbWluSW5kZXggJiYgaWR4IDw9IG1heEluZGV4KSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbmRleCAnICsgaWR4LnRvU3RyaW5nKCkgKyAnIGlzIG91dCBvZiBib3VuZHMnKTtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgc3dhcE9iamVjdHNBdEluZGV4ZXM6IGZ1bmN0aW9uIChmcm9tLCB0bykge1xuICAgICAgICAvL25vaW5zcGVjdGlvbiBVbm5lY2Vzc2FyeUxvY2FsVmFyaWFibGVKU1xuICAgICAgICB0aGlzLnZhbGlkYXRlSW5kZXgoZnJvbSk7XG4gICAgICAgIHRoaXMudmFsaWRhdGVJbmRleCh0byk7XG4gICAgICAgIHZhciBmcm9tTW9kZWwgPSB0aGlzLnJlc3VsdHNbZnJvbV0sXG4gICAgICAgICAgICB0b01vZGVsID0gdGhpcy5yZXN1bHRzW3RvXTtcbiAgICAgICAgaWYgKCFmcm9tTW9kZWwpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignTm8gbW9kZWwgYXQgaW5kZXggXCInICsgZnJvbS50b1N0cmluZygpICsgJ1wiJyk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCF0b01vZGVsKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ05vIG1vZGVsIGF0IGluZGV4IFwiJyArIHRvLnRvU3RyaW5nKCkgKyAnXCInKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnJlc3VsdHNbdG9dID0gZnJvbU1vZGVsO1xuICAgICAgICB0aGlzLnJlc3VsdHNbZnJvbV0gPSB0b01vZGVsO1xuICAgICAgICBmcm9tTW9kZWxbdGhpcy5pbmRleEF0dHJpYnV0ZV0gPSB0bztcbiAgICAgICAgdG9Nb2RlbFt0aGlzLmluZGV4QXR0cmlidXRlXSA9IGZyb207XG4gICAgfSxcbiAgICBzd2FwT2JqZWN0czogZnVuY3Rpb24gKG9iajEsIG9iajIpIHtcbiAgICAgICAgdmFyIGZyb21JZHggPSB0aGlzLnJlc3VsdHMuaW5kZXhPZihvYmoxKSxcbiAgICAgICAgICAgIHRvSWR4ID0gdGhpcy5yZXN1bHRzLmluZGV4T2Yob2JqMik7XG4gICAgICAgIHRoaXMuc3dhcE9iamVjdHNBdEluZGV4ZXMoZnJvbUlkeCwgdG9JZHgpO1xuICAgIH0sXG4gICAgbW92ZTogZnVuY3Rpb24gKGZyb20sIHRvKSB7XG4gICAgICAgIHRoaXMudmFsaWRhdGVJbmRleChmcm9tKTtcbiAgICAgICAgdGhpcy52YWxpZGF0ZUluZGV4KHRvKTtcbiAgICAgICAgdmFyIHJlc3VsdHMgPSB0aGlzLnJlc3VsdHMubXV0YWJsZUNvcHkoKTtcbiAgICAgICAgKGZ1bmN0aW9uIChvbGRJbmRleCwgbmV3SW5kZXgpIHtcbiAgICAgICAgICAgIGlmIChuZXdJbmRleCA+PSB0aGlzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIHZhciBrID0gbmV3SW5kZXggLSB0aGlzLmxlbmd0aDtcbiAgICAgICAgICAgICAgICB3aGlsZSAoKGstLSkgKyAxKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMucHVzaCh1bmRlZmluZWQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSkuY2FsbChyZXN1bHRzLCBmcm9tLCB0byk7XG4gICAgICAgIHZhciByZW1vdmVkID0gcmVzdWx0cy5zcGxpY2UoZnJvbSwgMSlbMF07XG4gICAgICAgIHRoaXMuZW1pdCgnY2hhbmdlJywgdGhpcy5yZXN1bHRzID0gcmVzdWx0cy5hc01vZGVsUXVlcnlTZXQodGhpcy5tb2RlbCksIHtcbiAgICAgICAgICAgIGluZGV4OiBmcm9tLFxuICAgICAgICAgICAgcmVtb3ZlZDogW3JlbW92ZWRdLFxuICAgICAgICAgICAgdHlwZTogbW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUuU3BsaWNlLFxuICAgICAgICAgICAgb2JqOiB0aGlzLFxuICAgICAgICAgICAgZmllbGQ6ICdyZXN1bHRzJ1xuICAgICAgICB9KTtcbiAgICAgICAgcmVzdWx0cy5zcGxpY2UodG8sIDAsIHJlbW92ZWQpO1xuICAgICAgICB0aGlzLmVtaXQoJ2NoYW5nZScsIHRoaXMucmVzdWx0cyA9IHJlc3VsdHMuYXNNb2RlbFF1ZXJ5U2V0KHRoaXMubW9kZWwpLCB7XG4gICAgICAgICAgICBpbmRleDogdG8sXG4gICAgICAgICAgICBhZGRlZDogW3JlbW92ZWRdLFxuICAgICAgICAgICAgdHlwZTogbW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUuU3BsaWNlLFxuICAgICAgICAgICAgb2JqOiB0aGlzLFxuICAgICAgICAgICAgZmllbGQ6ICdyZXN1bHRzJ1xuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5fcmVmcmVzaEluZGV4ZXMoKTtcbiAgICB9XG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBBcnJhbmdlZFJlYWN0aXZlUXVlcnk7IiwidmFyIGxvZyA9IHJlcXVpcmUoJy4vbG9nJyksXG4gICAgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpLFxuICAgIF8gPSB1dGlsLl8sXG4gICAgZXJyb3IgPSByZXF1aXJlKCcuL2Vycm9yJyksXG4gICAgSW50ZXJuYWxTaWVzdGFFcnJvciA9IGVycm9yLkludGVybmFsU2llc3RhRXJyb3IsXG4gICAgbW9kZWxFdmVudHMgPSByZXF1aXJlKCcuL21vZGVsRXZlbnRzJyksXG4gICAgZXZlbnRzID0gcmVxdWlyZSgnLi9ldmVudHMnKSxcbiAgICBjYWNoZSA9IHJlcXVpcmUoJy4vY2FjaGUnKTtcblxuZnVuY3Rpb24gTW9kZWxJbnN0YW5jZShtb2RlbCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB0aGlzLm1vZGVsID0gbW9kZWw7XG5cbiAgICB1dGlsLnN1YlByb3BlcnRpZXModGhpcywgdGhpcy5tb2RlbCwgW1xuICAgICAgICAnY29sbGVjdGlvbicsXG4gICAgICAgICdjb2xsZWN0aW9uTmFtZScsXG4gICAgICAgICdfYXR0cmlidXRlTmFtZXMnLFxuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAnaWRGaWVsZCcsXG4gICAgICAgICAgICBwcm9wZXJ0eTogJ2lkJ1xuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAnbW9kZWxOYW1lJyxcbiAgICAgICAgICAgIHByb3BlcnR5OiAnbmFtZSdcbiAgICAgICAgfVxuICAgIF0pO1xuXG4gICAgZXZlbnRzLlByb3h5RXZlbnRFbWl0dGVyLmNhbGwodGhpcyk7XG5cbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydGllcyh0aGlzLCB7XG4gICAgICAgIF9yZWxhdGlvbnNoaXBOYW1lczoge1xuICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgdmFyIHByb3hpZXMgPSBfLm1hcChPYmplY3Qua2V5cyhzZWxmLl9fcHJveGllcyB8fCB7fSksIGZ1bmN0aW9uICh4KSB7cmV0dXJuIHNlbGYuX19wcm94aWVzW3hdfSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIF8ubWFwKHByb3hpZXMsIGZ1bmN0aW9uIChwKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChwLmlzRm9yd2FyZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHAuZm9yd2FyZE5hbWU7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gcC5yZXZlcnNlTmFtZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICAgICAgfSxcbiAgICAgICAgZGlydHk6IHtcbiAgICAgICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIGlmIChzaWVzdGEuZXh0LnN0b3JhZ2VFbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBzZWxmLl9pZCBpbiBzaWVzdGEuZXh0LnN0b3JhZ2UuX3Vuc2F2ZWRPYmplY3RzSGFzaDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICAgICAgfSxcbiAgICAgICAgLy8gVGhpcyBpcyBmb3IgUHJveHlFdmVudEVtaXR0ZXIuXG4gICAgICAgIGV2ZW50OiB7XG4gICAgICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtyZXR1cm4gdGhpcy5faWR9XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIHRoaXMucmVtb3ZlZCA9IGZhbHNlO1xufVxuXG5Nb2RlbEluc3RhbmNlLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoZXZlbnRzLlByb3h5RXZlbnRFbWl0dGVyLnByb3RvdHlwZSk7XG5cbl8uZXh0ZW5kKE1vZGVsSW5zdGFuY2UucHJvdG90eXBlLCB7XG4gICAgZ2V0OiBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICAgICAgdmFyIGRlZmVycmVkID0gdXRpbC5kZWZlcihjYWxsYmFjayk7XG4gICAgICAgIGNhbGxiYWNrID0gZGVmZXJyZWQuZmluaXNoLmJpbmQoZGVmZXJyZWQpO1xuICAgICAgICBjYWxsYmFjayhudWxsLCB0aGlzKTtcbiAgICAgICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG4gICAgfSxcbiAgICBlbWl0OiBmdW5jdGlvbiAodHlwZSwgb3B0cykge1xuICAgICAgICBpZiAodHlwZW9mIHR5cGUgPT0gJ29iamVjdCcpIG9wdHMgPSB0eXBlO1xuICAgICAgICBlbHNlIG9wdHMudHlwZSA9IHR5cGU7XG4gICAgICAgIG9wdHMgPSBvcHRzIHx8IHt9O1xuICAgICAgICBfLmV4dGVuZChvcHRzLCB7XG4gICAgICAgICAgICBjb2xsZWN0aW9uOiB0aGlzLmNvbGxlY3Rpb25OYW1lLFxuICAgICAgICAgICAgbW9kZWw6IHRoaXMubW9kZWwubmFtZSxcbiAgICAgICAgICAgIF9pZDogdGhpcy5faWQsXG4gICAgICAgICAgICBvYmo6IHRoaXNcbiAgICAgICAgfSk7XG4gICAgICAgIG1vZGVsRXZlbnRzLmVtaXQob3B0cyk7XG4gICAgfSxcbiAgICByZW1vdmU6IGZ1bmN0aW9uIChjYWxsYmFjaywgbm90aWZpY2F0aW9uKSB7XG4gICAgICAgIG5vdGlmaWNhdGlvbiA9IG5vdGlmaWNhdGlvbiA9PSBudWxsID8gdHJ1ZSA6IG5vdGlmaWNhdGlvbjtcbiAgICAgICAgdmFyIGRlZmVycmVkID0gdXRpbC5kZWZlcihjYWxsYmFjayk7XG4gICAgICAgIGNhbGxiYWNrID0gZGVmZXJyZWQuZmluaXNoLmJpbmQoZGVmZXJyZWQpO1xuICAgICAgICBjYWNoZS5yZW1vdmUodGhpcyk7XG4gICAgICAgIHRoaXMucmVtb3ZlZCA9IHRydWU7XG4gICAgICAgIGlmIChub3RpZmljYXRpb24pIHtcbiAgICAgICAgICAgIHRoaXMuZW1pdChtb2RlbEV2ZW50cy5Nb2RlbEV2ZW50VHlwZS5SZW1vdmUsIHtcbiAgICAgICAgICAgICAgICBvbGQ6IHRoaXNcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIHZhciByZW1vdmUgPSB0aGlzLm1vZGVsLnJlbW92ZTtcbiAgICAgICAgaWYgKHJlbW92ZSkge1xuICAgICAgICAgICAgdmFyIHBhcmFtTmFtZXMgPSB1dGlsLnBhcmFtTmFtZXMocmVtb3ZlKTtcbiAgICAgICAgICAgIGlmIChwYXJhbU5hbWVzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgICAgICAgICByZW1vdmUuY2FsbCh0aGlzLCBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVyciwgc2VsZik7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICByZW1vdmUuY2FsbCh0aGlzKTtcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhudWxsLCB0aGlzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIHRoaXMpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xuICAgIH0sXG4gICAgcmVzdG9yZTogZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgICAgIHZhciBkZWZlcnJlZCA9IHV0aWwuZGVmZXIoY2FsbGJhY2spO1xuICAgICAgICBjYWxsYmFjayA9IGRlZmVycmVkLmZpbmlzaC5iaW5kKGRlZmVycmVkKTtcbiAgICAgICAgdmFyIF9maW5pc2ggPSBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICBpZiAoIWVycikge1xuICAgICAgICAgICAgICAgIHRoaXMuZW1pdChtb2RlbEV2ZW50cy5Nb2RlbEV2ZW50VHlwZS5OZXcsIHtcbiAgICAgICAgICAgICAgICAgICAgbmV3OiB0aGlzXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYWxsYmFjayhlcnIsIHRoaXMpO1xuICAgICAgICB9LmJpbmQodGhpcyk7XG4gICAgICAgIGlmICh0aGlzLnJlbW92ZWQpIHtcbiAgICAgICAgICAgIGNhY2hlLmluc2VydCh0aGlzKTtcbiAgICAgICAgICAgIHRoaXMucmVtb3ZlZCA9IGZhbHNlO1xuICAgICAgICAgICAgdmFyIGluaXQgPSB0aGlzLm1vZGVsLmluaXQ7XG4gICAgICAgICAgICBpZiAoaW5pdCkge1xuICAgICAgICAgICAgICAgIHZhciBwYXJhbU5hbWVzID0gdXRpbC5wYXJhbU5hbWVzKGluaXQpO1xuICAgICAgICAgICAgICAgIGlmIChwYXJhbU5hbWVzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICBpbml0LmNhbGwodGhpcywgX2ZpbmlzaCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBpbml0LmNhbGwodGhpcyk7XG4gICAgICAgICAgICAgICAgICAgIF9maW5pc2goKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBfZmluaXNoKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG4gICAgfVxufSk7XG5cbi8vIEluc3BlY3Rpb25cbl8uZXh0ZW5kKE1vZGVsSW5zdGFuY2UucHJvdG90eXBlLCB7XG4gICAgZ2V0QXR0cmlidXRlczogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gXy5leHRlbmQoe30sIHRoaXMuX192YWx1ZXMpO1xuICAgIH0sXG4gICAgaXNJbnN0YW5jZU9mOiBmdW5jdGlvbiAobW9kZWwpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMubW9kZWwgPT0gbW9kZWw7XG4gICAgfSxcbiAgICBpc0E6IGZ1bmN0aW9uIChtb2RlbCkge1xuICAgICAgICByZXR1cm4gdGhpcy5tb2RlbCA9PSBtb2RlbCB8fCB0aGlzLm1vZGVsLmlzRGVzY2VuZGFudE9mKG1vZGVsKTtcbiAgICB9XG59KTtcblxuLy8gRHVtcFxuXy5leHRlbmQoTW9kZWxJbnN0YW5jZS5wcm90b3R5cGUsIHtcbiAgICBfZHVtcFN0cmluZzogZnVuY3Rpb24gKHJldmVyc2VSZWxhdGlvbnNoaXBzKSB7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh0aGlzLl9kdW1wKHJldmVyc2VSZWxhdGlvbnNoaXBzLCBudWxsLCA0KSk7XG4gICAgfSxcbiAgICBfZHVtcDogZnVuY3Rpb24gKHJldmVyc2VSZWxhdGlvbnNoaXBzKSB7XG4gICAgICAgIHZhciBkdW1wZWQgPSBfLmV4dGVuZCh7fSwgdGhpcy5fX3ZhbHVlcyk7XG4gICAgICAgIGR1bXBlZC5fcmV2ID0gdGhpcy5fcmV2O1xuICAgICAgICBkdW1wZWQuX2lkID0gdGhpcy5faWQ7XG4gICAgICAgIHJldHVybiBkdW1wZWQ7XG4gICAgfVxufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gTW9kZWxJbnN0YW5jZTtcblxuIiwiLyoqXG4gKiBAbW9kdWxlIHJlbGF0aW9uc2hpcHNcbiAqL1xuXG52YXIgUmVsYXRpb25zaGlwUHJveHkgPSByZXF1aXJlKCcuL1JlbGF0aW9uc2hpcFByb3h5JyksXG4gICAgU3RvcmUgPSByZXF1aXJlKCcuL3N0b3JlJyksXG4gICAgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpLFxuICAgIF8gPSB1dGlsLl8sXG4gICAgSW50ZXJuYWxTaWVzdGFFcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKS5JbnRlcm5hbFNpZXN0YUVycm9yLFxuICAgIG1vZGVsRXZlbnRzID0gcmVxdWlyZSgnLi9tb2RlbEV2ZW50cycpLFxuICAgIFNpZXN0YU1vZGVsID0gcmVxdWlyZSgnLi9tb2RlbEluc3RhbmNlJyksXG4gICAgZXZlbnRzID0gcmVxdWlyZSgnLi9ldmVudHMnKSxcbiAgICB3cmFwQXJyYXlGb3JBdHRyaWJ1dGVzID0gZXZlbnRzLndyYXBBcnJheSxcbiAgICBBcnJheU9ic2VydmVyID0gcmVxdWlyZSgnLi4vdmVuZG9yL29ic2VydmUtanMvc3JjL29ic2VydmUnKS5BcnJheU9ic2VydmVyLFxuICAgIE1vZGVsRXZlbnRUeXBlID0gcmVxdWlyZSgnLi9tb2RlbEV2ZW50cycpLk1vZGVsRXZlbnRUeXBlO1xuXG4vKipcbiAqIEBjbGFzcyAgW09uZVRvTWFueVByb3h5IGRlc2NyaXB0aW9uXVxuICogQGNvbnN0cnVjdG9yXG4gKiBAcGFyYW0ge1t0eXBlXX0gb3B0c1xuICovXG5mdW5jdGlvbiBPbmVUb01hbnlQcm94eShvcHRzKSB7XG4gICAgUmVsYXRpb25zaGlwUHJveHkuY2FsbCh0aGlzLCBvcHRzKTtcbiAgICBpZiAodGhpcy5pc1JldmVyc2UpIHRoaXMucmVsYXRlZCA9IFtdO1xufVxuXG5PbmVUb01hbnlQcm94eS5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKFJlbGF0aW9uc2hpcFByb3h5LnByb3RvdHlwZSk7XG5cbl8uZXh0ZW5kKE9uZVRvTWFueVByb3h5LnByb3RvdHlwZSwge1xuICAgIGNsZWFyUmV2ZXJzZTogZnVuY3Rpb24gKHJlbW92ZWQpIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICBfLmVhY2gocmVtb3ZlZCwgZnVuY3Rpb24gKHJlbW92ZWRPYmplY3QpIHtcbiAgICAgICAgICAgIHZhciByZXZlcnNlUHJveHkgPSBzZWxmLnJldmVyc2VQcm94eUZvckluc3RhbmNlKHJlbW92ZWRPYmplY3QpO1xuICAgICAgICAgICAgcmV2ZXJzZVByb3h5LnNldElkQW5kUmVsYXRlZChudWxsKTtcbiAgICAgICAgfSk7XG4gICAgfSxcbiAgICBzZXRSZXZlcnNlT2ZBZGRlZDogZnVuY3Rpb24gKGFkZGVkKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgXy5lYWNoKGFkZGVkLCBmdW5jdGlvbiAoYWRkZWQpIHtcbiAgICAgICAgICAgIHZhciBmb3J3YXJkUHJveHkgPSBzZWxmLnJldmVyc2VQcm94eUZvckluc3RhbmNlKGFkZGVkKTtcbiAgICAgICAgICAgIGZvcndhcmRQcm94eS5zZXRJZEFuZFJlbGF0ZWQoc2VsZi5vYmplY3QpO1xuICAgICAgICB9KTtcbiAgICB9LFxuICAgIHdyYXBBcnJheTogZnVuY3Rpb24gKGFycikge1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgIHdyYXBBcnJheUZvckF0dHJpYnV0ZXMoYXJyLCB0aGlzLnJldmVyc2VOYW1lLCB0aGlzLm9iamVjdCk7XG4gICAgICAgIGlmICghYXJyLmFycmF5T2JzZXJ2ZXIpIHtcbiAgICAgICAgICAgIGFyci5hcnJheU9ic2VydmVyID0gbmV3IEFycmF5T2JzZXJ2ZXIoYXJyKTtcbiAgICAgICAgICAgIHZhciBvYnNlcnZlckZ1bmN0aW9uID0gZnVuY3Rpb24gKHNwbGljZXMpIHtcbiAgICAgICAgICAgICAgICBzcGxpY2VzLmZvckVhY2goZnVuY3Rpb24gKHNwbGljZSkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgYWRkZWQgPSBzcGxpY2UuYWRkZWRDb3VudCA/IGFyci5zbGljZShzcGxpY2UuaW5kZXgsIHNwbGljZS5pbmRleCArIHNwbGljZS5hZGRlZENvdW50KSA6IFtdO1xuICAgICAgICAgICAgICAgICAgICB2YXIgcmVtb3ZlZCA9IHNwbGljZS5yZW1vdmVkO1xuICAgICAgICAgICAgICAgICAgICBzZWxmLmNsZWFyUmV2ZXJzZShyZW1vdmVkKTtcbiAgICAgICAgICAgICAgICAgICAgc2VsZi5zZXRSZXZlcnNlT2ZBZGRlZChhZGRlZCk7XG4gICAgICAgICAgICAgICAgICAgIHZhciBtb2RlbCA9IHNlbGYuZ2V0Rm9yd2FyZE1vZGVsKCk7XG4gICAgICAgICAgICAgICAgICAgIG1vZGVsRXZlbnRzLmVtaXQoe1xuICAgICAgICAgICAgICAgICAgICAgICAgY29sbGVjdGlvbjogbW9kZWwuY29sbGVjdGlvbk5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBtb2RlbDogbW9kZWwubmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIF9pZDogc2VsZi5vYmplY3QuX2lkLFxuICAgICAgICAgICAgICAgICAgICAgICAgZmllbGQ6IHNlbGYuZ2V0Rm9yd2FyZE5hbWUoKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlbW92ZWQ6IHJlbW92ZWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBhZGRlZDogYWRkZWQsXG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiBNb2RlbEV2ZW50VHlwZS5TcGxpY2UsXG4gICAgICAgICAgICAgICAgICAgICAgICBpbmRleDogc3BsaWNlLmluZGV4LFxuICAgICAgICAgICAgICAgICAgICAgICAgb2JqOiBzZWxmLm9iamVjdFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBhcnIuYXJyYXlPYnNlcnZlci5vcGVuKG9ic2VydmVyRnVuY3Rpb24pO1xuICAgICAgICB9XG4gICAgfSxcbiAgICBnZXQ6IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgICAgICB2YXIgZGVmZXJyZWQgPSB1dGlsLmRlZmVyKGNhbGxiYWNrKTtcbiAgICAgICAgY2FsbGJhY2sgPSBkZWZlcnJlZC5maW5pc2guYmluZChkZWZlcnJlZCk7XG4gICAgICAgIGNhbGxiYWNrKG51bGwsIHRoaXMucmVsYXRlZCk7XG4gICAgICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xuICAgIH0sXG4gICAgLyoqXG4gICAgICogVmFsaWRhdGUgdGhlIG9iamVjdCB0aGF0IHdlJ3JlIHNldHRpbmdcbiAgICAgKiBAcGFyYW0gb2JqXG4gICAgICogQHJldHVybnMge3N0cmluZ3xudWxsfSBBbiBlcnJvciBtZXNzYWdlIG9yIG51bGxcbiAgICAgKiBAY2xhc3MgT25lVG9NYW55UHJveHlcbiAgICAgKi9cbiAgICB2YWxpZGF0ZTogZnVuY3Rpb24gKG9iaikge1xuICAgICAgICB2YXIgc3RyID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKG9iaik7XG4gICAgICAgIGlmICh0aGlzLmlzRm9yd2FyZCkge1xuICAgICAgICAgICAgaWYgKHN0ciA9PSAnW29iamVjdCBBcnJheV0nKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuICdDYW5ub3QgYXNzaWduIGFycmF5IGZvcndhcmQgb25lVG9NYW55ICgnICsgc3RyICsgJyk6ICcgKyB0aGlzLmZvcndhcmROYW1lO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgaWYgKHN0ciAhPSAnW29iamVjdCBBcnJheV0nKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuICdDYW5ub3Qgc2NhbGFyIHRvIHJldmVyc2Ugb25lVG9NYW55ICgnICsgc3RyICsgJyk6ICcgKyB0aGlzLnJldmVyc2VOYW1lO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbiAob2JqLCBvcHRzKSB7XG4gICAgICAgIHRoaXMuY2hlY2tJbnN0YWxsZWQoKTtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICBpZiAob2JqKSB7XG4gICAgICAgICAgICB2YXIgZXJyb3JNZXNzYWdlO1xuICAgICAgICAgICAgaWYgKGVycm9yTWVzc2FnZSA9IHRoaXMudmFsaWRhdGUob2JqKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBlcnJvck1lc3NhZ2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLmNsZWFyUmV2ZXJzZVJlbGF0ZWQob3B0cyk7XG4gICAgICAgICAgICAgICAgc2VsZi5zZXRJZEFuZFJlbGF0ZWQob2JqLCBvcHRzKTtcbiAgICAgICAgICAgICAgICBpZiAoc2VsZi5pc1JldmVyc2UpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy53cmFwQXJyYXkoc2VsZi5yZWxhdGVkKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgc2VsZi5zZXRJZEFuZFJlbGF0ZWRSZXZlcnNlKG9iaiwgb3B0cyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmNsZWFyUmV2ZXJzZVJlbGF0ZWQob3B0cyk7XG4gICAgICAgICAgICBzZWxmLnNldElkQW5kUmVsYXRlZChvYmosIG9wdHMpO1xuICAgICAgICB9XG4gICAgfSxcbiAgICBpbnN0YWxsOiBmdW5jdGlvbiAob2JqKSB7XG4gICAgICAgIFJlbGF0aW9uc2hpcFByb3h5LnByb3RvdHlwZS5pbnN0YWxsLmNhbGwodGhpcywgb2JqKTtcblxuICAgICAgICBpZiAodGhpcy5pc1JldmVyc2UpIHtcbiAgICAgICAgICAgIG9ialsoJ3NwbGljZScgKyB1dGlsLmNhcGl0YWxpc2VGaXJzdExldHRlcih0aGlzLnJldmVyc2VOYW1lKSldID0gXy5iaW5kKHRoaXMuc3BsaWNlLCB0aGlzKTtcbiAgICAgICAgICAgIHRoaXMud3JhcEFycmF5KHRoaXMucmVsYXRlZCk7XG4gICAgICAgIH1cblxuICAgIH1cbn0pO1xuXG5cbm1vZHVsZS5leHBvcnRzID0gT25lVG9NYW55UHJveHk7IiwiLyoqXG4gKiBAbW9kdWxlIHJlbGF0aW9uc2hpcHNcbiAqL1xuXG52YXIgUmVsYXRpb25zaGlwUHJveHkgPSByZXF1aXJlKCcuL1JlbGF0aW9uc2hpcFByb3h5JyksXG4gICAgU3RvcmUgPSByZXF1aXJlKCcuL3N0b3JlJyksXG4gICAgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpLFxuICAgIEludGVybmFsU2llc3RhRXJyb3IgPSByZXF1aXJlKCcuL2Vycm9yJykuSW50ZXJuYWxTaWVzdGFFcnJvcixcbiAgICBNb2RlbEV2ZW50VHlwZSA9IHJlcXVpcmUoJy4vbW9kZWxFdmVudHMnKS5Nb2RlbEV2ZW50VHlwZSxcbiAgICBTaWVzdGFNb2RlbCA9IHJlcXVpcmUoJy4vbW9kZWxJbnN0YW5jZScpO1xuXG4vKipcbiAqIFtPbmVUb09uZVByb3h5IGRlc2NyaXB0aW9uXVxuICogQHBhcmFtIHtPYmplY3R9IG9wdHNcbiAqL1xuZnVuY3Rpb24gT25lVG9PbmVQcm94eShvcHRzKSB7XG4gICAgUmVsYXRpb25zaGlwUHJveHkuY2FsbCh0aGlzLCBvcHRzKTtcbn1cblxuXG5PbmVUb09uZVByb3h5LnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoUmVsYXRpb25zaGlwUHJveHkucHJvdG90eXBlKTtcblxuXy5leHRlbmQoT25lVG9PbmVQcm94eS5wcm90b3R5cGUsIHtcbiAgICAvKipcbiAgICAgKiBWYWxpZGF0ZSB0aGUgb2JqZWN0IHRoYXQgd2UncmUgc2V0dGluZ1xuICAgICAqIEBwYXJhbSBvYmpcbiAgICAgKiBAcmV0dXJucyB7c3RyaW5nfG51bGx9IEFuIGVycm9yIG1lc3NhZ2Ugb3IgbnVsbFxuICAgICAqL1xuICAgIHZhbGlkYXRlOiBmdW5jdGlvbiAob2JqKSB7XG4gICAgICAgIGlmIChPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwob2JqKSA9PSAnW29iamVjdCBBcnJheV0nKSB7XG4gICAgICAgICAgICByZXR1cm4gJ0Nhbm5vdCBhc3NpZ24gYXJyYXkgdG8gb25lIHRvIG9uZSByZWxhdGlvbnNoaXAnO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKCghb2JqIGluc3RhbmNlb2YgU2llc3RhTW9kZWwpKSB7XG5cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24gKG9iaiwgb3B0cykge1xuICAgICAgICB0aGlzLmNoZWNrSW5zdGFsbGVkKCk7XG4gICAgICAgIGlmIChvYmopIHtcbiAgICAgICAgICAgIHZhciBlcnJvck1lc3NhZ2U7XG4gICAgICAgICAgICBpZiAoZXJyb3JNZXNzYWdlID0gdGhpcy52YWxpZGF0ZShvYmopKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGVycm9yTWVzc2FnZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuY2xlYXJSZXZlcnNlUmVsYXRlZChvcHRzKTtcbiAgICAgICAgICAgICAgICB0aGlzLnNldElkQW5kUmVsYXRlZChvYmosIG9wdHMpO1xuICAgICAgICAgICAgICAgIHRoaXMuc2V0SWRBbmRSZWxhdGVkUmV2ZXJzZShvYmosIG9wdHMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5jbGVhclJldmVyc2VSZWxhdGVkKG9wdHMpO1xuICAgICAgICAgICAgdGhpcy5zZXRJZEFuZFJlbGF0ZWQob2JqLCBvcHRzKTtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgZ2V0OiBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICAgICAgdmFyIGRlZmVycmVkID0gdXRpbC5kZWZlcihjYWxsYmFjayk7XG4gICAgICAgIGNhbGxiYWNrID0gZGVmZXJyZWQuZmluaXNoLmJpbmQoZGVmZXJyZWQpO1xuICAgICAgICBjYWxsYmFjayhudWxsLCB0aGlzLnJlbGF0ZWQpO1xuICAgICAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbiAgICB9XG59KTtcblxuXG5tb2R1bGUuZXhwb3J0cyA9IE9uZVRvT25lUHJveHk7IiwiLyoqXG4gKiBAbW9kdWxlIHF1ZXJ5XG4gKi9cblxudmFyIGxvZyA9IHJlcXVpcmUoJy4vbG9nJyksXG4gICAgY2FjaGUgPSByZXF1aXJlKCcuL2NhY2hlJyksXG4gICAgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpLFxuICAgIGVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpLFxuICAgIGNvbnN0cnVjdFF1ZXJ5U2V0ID0gcmVxdWlyZSgnLi9xdWVyeVNldCcpLFxuICAgIGNvbnN0cnVjdEVycm9yID0gZXJyb3IuZXJyb3JGYWN0b3J5KGVycm9yLkNvbXBvbmVudHMuUXVlcnkpLFxuICAgIF8gPSB1dGlsLl87XG5cbnZhciBMb2dnZXIgPSBsb2cubG9nZ2VyV2l0aE5hbWUoJ1F1ZXJ5Jyk7XG5cbi8qKlxuICogQGNsYXNzIFtRdWVyeSBkZXNjcmlwdGlvbl1cbiAqIEBwYXJhbSB7TW9kZWx9IG1vZGVsXG4gKiBAcGFyYW0ge09iamVjdH0gcXVlcnlcbiAqL1xuZnVuY3Rpb24gUXVlcnkobW9kZWwsIHF1ZXJ5KSB7XG4gICAgdmFyIG9wdHMgPSB7fTtcbiAgICBmb3IgKHZhciBwcm9wIGluIHF1ZXJ5KSB7XG4gICAgICAgIGlmIChxdWVyeS5oYXNPd25Qcm9wZXJ0eShwcm9wKSkge1xuICAgICAgICAgICAgaWYgKHByb3Auc2xpY2UoMCwgMikgPT0gJ19fJykge1xuICAgICAgICAgICAgICAgIG9wdHNbcHJvcC5zbGljZSgyKV0gPSBxdWVyeVtwcm9wXTtcbiAgICAgICAgICAgICAgICBkZWxldGUgcXVlcnlbcHJvcF07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgXy5leHRlbmQodGhpcywge1xuICAgICAgICBtb2RlbDogbW9kZWwsXG4gICAgICAgIHF1ZXJ5OiBxdWVyeSxcbiAgICAgICAgb3B0czogb3B0c1xuICAgIH0pO1xuICAgIG9wdHMub3JkZXIgPSBvcHRzLm9yZGVyIHx8IFtdO1xuICAgIGlmICghdXRpbC5pc0FycmF5KG9wdHMub3JkZXIpKSBvcHRzLm9yZGVyID0gW29wdHMub3JkZXJdO1xufVxuXG5fLmV4dGVuZChRdWVyeSwge1xuICAgIGNvbXBhcmF0b3JzOiB7XG4gICAgICAgIGU6IGZ1bmN0aW9uIChvcHRzKSB7XG4gICAgICAgICAgICB2YXIgb2JqZWN0VmFsdWUgPSBvcHRzLm9iamVjdFtvcHRzLmZpZWxkXTtcbiAgICAgICAgICAgIGlmIChMb2dnZXIudHJhY2UpIHtcbiAgICAgICAgICAgICAgICB2YXIgc3RyaW5nVmFsdWU7XG4gICAgICAgICAgICAgICAgaWYgKG9iamVjdFZhbHVlID09PSBudWxsKSBzdHJpbmdWYWx1ZSA9ICdudWxsJztcbiAgICAgICAgICAgICAgICBlbHNlIGlmIChvYmplY3RWYWx1ZSA9PT0gdW5kZWZpbmVkKSBzdHJpbmdWYWx1ZSA9ICd1bmRlZmluZWQnO1xuICAgICAgICAgICAgICAgIGVsc2Ugc3RyaW5nVmFsdWUgPSBvYmplY3RWYWx1ZS50b1N0cmluZygpO1xuICAgICAgICAgICAgICAgIExvZ2dlci50cmFjZShvcHRzLmZpZWxkICsgJzogJyArIHN0cmluZ1ZhbHVlICsgJyA9PSAnICsgb3B0cy52YWx1ZS50b1N0cmluZygpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBvYmplY3RWYWx1ZSA9PSBvcHRzLnZhbHVlO1xuICAgICAgICB9LFxuICAgICAgICBsdDogZnVuY3Rpb24gKG9wdHMpIHtcbiAgICAgICAgICAgIGlmICghb3B0cy5pbnZhbGlkKSByZXR1cm4gb3B0cy5vYmplY3Rbb3B0cy5maWVsZF0gPCBvcHRzLnZhbHVlO1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9LFxuICAgICAgICBndDogZnVuY3Rpb24gKG9wdHMpIHtcbiAgICAgICAgICAgIGlmICghb3B0cy5pbnZhbGlkKSByZXR1cm4gb3B0cy5vYmplY3Rbb3B0cy5maWVsZF0gPiBvcHRzLnZhbHVlO1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9LFxuICAgICAgICBsdGU6IGZ1bmN0aW9uIChvcHRzKSB7XG4gICAgICAgICAgICBpZiAoIW9wdHMuaW52YWxpZCkgcmV0dXJuIG9wdHMub2JqZWN0W29wdHMuZmllbGRdIDw9IG9wdHMudmFsdWU7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH0sXG4gICAgICAgIGd0ZTogZnVuY3Rpb24gKG9wdHMpIHtcbiAgICAgICAgICAgIGlmICghb3B0cy5pbnZhbGlkKSByZXR1cm4gb3B0cy5vYmplY3Rbb3B0cy5maWVsZF0gPj0gb3B0cy52YWx1ZTtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfSxcbiAgICAgICAgY29udGFpbnM6IGZ1bmN0aW9uIChvcHRzKSB7XG4gICAgICAgICAgICBpZiAoIW9wdHMuaW52YWxpZCkgcmV0dXJuIG9wdHMub2JqZWN0W29wdHMuZmllbGRdLmluZGV4T2Yob3B0cy52YWx1ZSkgPiAtMTtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgcmVnaXN0ZXJDb21wYXJhdG9yOiBmdW5jdGlvbiAoc3ltYm9sLCBmbikge1xuICAgICAgICBpZiAoIXRoaXMuY29tcGFyYXRvcnNbc3ltYm9sXSlcbiAgICAgICAgICAgIHRoaXMuY29tcGFyYXRvcnNbc3ltYm9sXSA9IGZuO1xuICAgIH1cbn0pO1xuXG5mdW5jdGlvbiBjYWNoZUZvck1vZGVsKG1vZGVsKSB7XG4gICAgdmFyIGNhY2hlQnlUeXBlID0gY2FjaGUuX2xvY2FsQ2FjaGVCeVR5cGU7XG4gICAgdmFyIG1vZGVsTmFtZSA9IG1vZGVsLm5hbWU7XG4gICAgdmFyIGNvbGxlY3Rpb25OYW1lID0gbW9kZWwuY29sbGVjdGlvbk5hbWU7XG4gICAgdmFyIGNhY2hlQnlNb2RlbCA9IGNhY2hlQnlUeXBlW2NvbGxlY3Rpb25OYW1lXTtcbiAgICB2YXIgY2FjaGVCeUxvY2FsSWQ7XG4gICAgaWYgKGNhY2hlQnlNb2RlbCkge1xuICAgICAgICBjYWNoZUJ5TG9jYWxJZCA9IGNhY2hlQnlNb2RlbFttb2RlbE5hbWVdIHx8IHt9O1xuICAgIH1cbiAgICByZXR1cm4gY2FjaGVCeUxvY2FsSWQ7XG59XG5cbl8uZXh0ZW5kKFF1ZXJ5LnByb3RvdHlwZSwge1xuICAgIGV4ZWN1dGU6IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgICAgICB2YXIgZGVmZXJyZWQgPSB1dGlsLmRlZmVyKGNhbGxiYWNrKTtcbiAgICAgICAgY2FsbGJhY2sgPSBkZWZlcnJlZC5maW5pc2guYmluZChkZWZlcnJlZCk7XG4gICAgICAgIHRoaXMuX2V4ZWN1dGVJbk1lbW9yeShjYWxsYmFjayk7XG4gICAgICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xuICAgIH0sXG4gICAgX2R1bXA6IGZ1bmN0aW9uIChhc0pzb24pIHtcbiAgICAgICAgcmV0dXJuIGFzSnNvbiA/ICd7fScgOiB7fTtcbiAgICB9LFxuICAgIHNvcnRGdW5jOiBmdW5jdGlvbiAoZmllbGRzKSB7XG4gICAgICAgIHZhciBzb3J0RnVuYyA9IGZ1bmN0aW9uIChhc2NlbmRpbmcsIGZpZWxkKSB7XG4gICAgICAgICAgICByZXR1cm4gZnVuY3Rpb24gKHYxLCB2Mikge1xuICAgICAgICAgICAgICAgIHZhciBkMSA9IHYxW2ZpZWxkXSxcbiAgICAgICAgICAgICAgICAgICAgZDIgPSB2MltmaWVsZF0sXG4gICAgICAgICAgICAgICAgICAgIHJlcztcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGQxID09ICdzdHJpbmcnIHx8IGQxIGluc3RhbmNlb2YgU3RyaW5nICYmXG4gICAgICAgICAgICAgICAgICAgIHR5cGVvZiBkMiA9PSAnc3RyaW5nJyB8fCBkMiBpbnN0YW5jZW9mIFN0cmluZykge1xuICAgICAgICAgICAgICAgICAgICByZXMgPSBhc2NlbmRpbmcgPyBkMS5sb2NhbGVDb21wYXJlKGQyKSA6IGQyLmxvY2FsZUNvbXBhcmUoZDEpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGQxIGluc3RhbmNlb2YgRGF0ZSkgZDEgPSBkMS5nZXRUaW1lKCk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChkMiBpbnN0YW5jZW9mIERhdGUpIGQyID0gZDIuZ2V0VGltZSgpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoYXNjZW5kaW5nKSByZXMgPSBkMSAtIGQyO1xuICAgICAgICAgICAgICAgICAgICBlbHNlIHJlcyA9IGQyIC0gZDE7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiByZXM7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIHZhciBzID0gdXRpbDtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBmaWVsZHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHZhciBmaWVsZCA9IGZpZWxkc1tpXTtcbiAgICAgICAgICAgIHMgPSBzLnRoZW5CeShzb3J0RnVuYyhmaWVsZC5hc2NlbmRpbmcsIGZpZWxkLmZpZWxkKSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHM7XG4gICAgfSxcbiAgICBfc29ydFJlc3VsdHM6IGZ1bmN0aW9uIChyZXMpIHtcbiAgICAgICAgdmFyIG9yZGVyID0gdGhpcy5vcHRzLm9yZGVyO1xuICAgICAgICBpZiAocmVzICYmIG9yZGVyKSB7XG4gICAgICAgICAgICB2YXIgZmllbGRzID0gXy5tYXAob3JkZXIsIGZ1bmN0aW9uIChvcmRlcmluZykge1xuICAgICAgICAgICAgICAgIHZhciBzcGx0ID0gb3JkZXJpbmcuc3BsaXQoJy0nKSxcbiAgICAgICAgICAgICAgICAgICAgYXNjZW5kaW5nID0gdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgZmllbGQgPSBudWxsO1xuICAgICAgICAgICAgICAgIGlmIChzcGx0Lmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgZmllbGQgPSBzcGx0WzFdO1xuICAgICAgICAgICAgICAgICAgICBhc2NlbmRpbmcgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGZpZWxkID0gc3BsdFswXTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIHtmaWVsZDogZmllbGQsIGFzY2VuZGluZzogYXNjZW5kaW5nfTtcbiAgICAgICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICAgICAgICB2YXIgcyA9IHRoaXMuc29ydEZ1bmMoZmllbGRzKTtcbiAgICAgICAgICAgIGlmIChyZXMuaW1tdXRhYmxlKSByZXMgPSByZXMubXV0YWJsZUNvcHkoKTtcbiAgICAgICAgICAgIHJlcy5zb3J0KHMpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXM7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBSZXR1cm4gYWxsIG1vZGVsIGluc3RhbmNlcyBpbiB0aGUgY2FjaGUuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfZ2V0Q2FjaGVCeUxvY2FsSWQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIF8ucmVkdWNlKHRoaXMubW9kZWwuZGVzY2VuZGFudHMsIGZ1bmN0aW9uIChtZW1vLCBjaGlsZE1vZGVsKSB7XG4gICAgICAgICAgICByZXR1cm4gXy5leHRlbmQobWVtbywgY2FjaGVGb3JNb2RlbChjaGlsZE1vZGVsKSk7XG4gICAgICAgIH0sIF8uZXh0ZW5kKHt9LCBjYWNoZUZvck1vZGVsKHRoaXMubW9kZWwpKSk7XG4gICAgfSxcbiAgICBfZXhlY3V0ZUluTWVtb3J5OiBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICAgICAgdmFyIF9leGVjdXRlSW5NZW1vcnkgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB2YXIgY2FjaGVCeUxvY2FsSWQgPSB0aGlzLl9nZXRDYWNoZUJ5TG9jYWxJZCgpO1xuICAgICAgICAgICAgdmFyIGtleXMgPSBPYmplY3Qua2V5cyhjYWNoZUJ5TG9jYWxJZCk7XG4gICAgICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgICAgICB2YXIgcmVzID0gW107XG4gICAgICAgICAgICB2YXIgZXJyO1xuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBrZXlzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgdmFyIGsgPSBrZXlzW2ldO1xuICAgICAgICAgICAgICAgIHZhciBvYmogPSBjYWNoZUJ5TG9jYWxJZFtrXTtcbiAgICAgICAgICAgICAgICB2YXIgbWF0Y2hlcyA9IHNlbGYub2JqZWN0TWF0Y2hlc1F1ZXJ5KG9iaik7XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZihtYXRjaGVzKSA9PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgICAgICBlcnIgPSBjb25zdHJ1Y3RFcnJvcihtYXRjaGVzKTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG1hdGNoZXMpIHJlcy5wdXNoKG9iaik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmVzID0gdGhpcy5fc29ydFJlc3VsdHMocmVzKTtcbiAgICAgICAgICAgIGNhbGxiYWNrKGVyciwgZXJyID8gbnVsbCA6IGNvbnN0cnVjdFF1ZXJ5U2V0KHJlcywgdGhpcy5tb2RlbCkpO1xuICAgICAgICB9LmJpbmQodGhpcyk7XG4gICAgICAgIGlmICh0aGlzLm9wdHMuaWdub3JlSW5zdGFsbGVkKSB7XG4gICAgICAgICAgICBfZXhlY3V0ZUluTWVtb3J5KCk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBzaWVzdGEuX2FmdGVySW5zdGFsbChfZXhlY3V0ZUluTWVtb3J5KTtcbiAgICAgICAgfVxuXG4gICAgfSxcbiAgICBjbGVhck9yZGVyaW5nOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRoaXMub3B0cy5vcmRlciA9IG51bGw7XG4gICAgfSxcbiAgICBvYmplY3RNYXRjaGVzT3JRdWVyeTogZnVuY3Rpb24gKG9iaiwgb3JRdWVyeSkge1xuICAgICAgICBmb3IgKHZhciBpZHggaW4gb3JRdWVyeSkge1xuICAgICAgICAgICAgaWYgKG9yUXVlcnkuaGFzT3duUHJvcGVydHkoaWR4KSkge1xuICAgICAgICAgICAgICAgIHZhciBxdWVyeSA9IG9yUXVlcnlbaWR4XTtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5vYmplY3RNYXRjaGVzQmFzZVF1ZXJ5KG9iaiwgcXVlcnkpKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfSxcbiAgICBvYmplY3RNYXRjaGVzQW5kUXVlcnk6IGZ1bmN0aW9uIChvYmosIGFuZFF1ZXJ5KSB7XG4gICAgICAgIGZvciAodmFyIGlkeCBpbiBhbmRRdWVyeSkge1xuICAgICAgICAgICAgaWYgKGFuZFF1ZXJ5Lmhhc093blByb3BlcnR5KGlkeCkpIHtcbiAgICAgICAgICAgICAgICB2YXIgcXVlcnkgPSBhbmRRdWVyeVtpZHhdO1xuICAgICAgICAgICAgICAgIGlmICghdGhpcy5vYmplY3RNYXRjaGVzQmFzZVF1ZXJ5KG9iaiwgcXVlcnkpKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSxcbiAgICBzcGxpdE1hdGNoZXM6IGZ1bmN0aW9uIChvYmosIHVucHJvY2Vzc2VkRmllbGQsIHZhbHVlKSB7XG4gICAgICAgIHZhciBvcCA9ICdlJztcbiAgICAgICAgdmFyIGZpZWxkcyA9IHVucHJvY2Vzc2VkRmllbGQuc3BsaXQoJy4nKTtcbiAgICAgICAgdmFyIHNwbHQgPSBmaWVsZHNbZmllbGRzLmxlbmd0aCAtIDFdLnNwbGl0KCdfXycpO1xuICAgICAgICBpZiAoc3BsdC5sZW5ndGggPT0gMikge1xuICAgICAgICAgICAgdmFyIGZpZWxkID0gc3BsdFswXTtcbiAgICAgICAgICAgIG9wID0gc3BsdFsxXTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGZpZWxkID0gc3BsdFswXTtcbiAgICAgICAgfVxuICAgICAgICBmaWVsZHNbZmllbGRzLmxlbmd0aCAtIDFdID0gZmllbGQ7XG4gICAgICAgIF8uZWFjaChmaWVsZHMuc2xpY2UoMCwgZmllbGRzLmxlbmd0aCAtIDEpLCBmdW5jdGlvbiAoZikge1xuICAgICAgICAgICAgb2JqID0gb2JqW2ZdO1xuICAgICAgICB9KTtcbiAgICAgICAgdmFyIHZhbCA9IG9ialtmaWVsZF07XG4gICAgICAgIHZhciBpbnZhbGlkID0gdmFsID09PSBudWxsIHx8IHZhbCA9PT0gdW5kZWZpbmVkO1xuICAgICAgICB2YXIgY29tcGFyYXRvciA9IFF1ZXJ5LmNvbXBhcmF0b3JzW29wXSxcbiAgICAgICAgICAgIG9wdHMgPSB7b2JqZWN0OiBvYmosIGZpZWxkOiBmaWVsZCwgdmFsdWU6IHZhbHVlLCBpbnZhbGlkOiBpbnZhbGlkfTtcbiAgICAgICAgaWYgKCFjb21wYXJhdG9yKSB7XG4gICAgICAgICAgICByZXR1cm4gJ05vIGNvbXBhcmF0b3IgcmVnaXN0ZXJlZCBmb3IgcXVlcnkgb3BlcmF0aW9uIFwiJyArIG9wICsgJ1wiJztcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gY29tcGFyYXRvcihvcHRzKTtcbiAgICB9LFxuICAgIG9iamVjdE1hdGNoZXM6IGZ1bmN0aW9uIChvYmosIHVucHJvY2Vzc2VkRmllbGQsIHZhbHVlLCBxdWVyeSkge1xuICAgICAgICBpZiAodW5wcm9jZXNzZWRGaWVsZCA9PSAnJG9yJykge1xuICAgICAgICAgICAgaWYgKCF0aGlzLm9iamVjdE1hdGNoZXNPclF1ZXJ5KG9iaiwgcXVlcnlbJyRvciddKSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKHVucHJvY2Vzc2VkRmllbGQgPT0gJyRhbmQnKSB7XG4gICAgICAgICAgICBpZiAoIXRoaXMub2JqZWN0TWF0Y2hlc0FuZFF1ZXJ5KG9iaiwgcXVlcnlbJyRhbmQnXSkpIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHZhciBtYXRjaGVzID0gdGhpcy5zcGxpdE1hdGNoZXMob2JqLCB1bnByb2Nlc3NlZEZpZWxkLCB2YWx1ZSk7XG4gICAgICAgICAgICBpZiAodHlwZW9mIG1hdGNoZXMgIT0gJ2Jvb2xlYW4nKSByZXR1cm4gbWF0Y2hlcztcbiAgICAgICAgICAgIGlmICghbWF0Y2hlcykgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH0sXG4gICAgb2JqZWN0TWF0Y2hlc0Jhc2VRdWVyeTogZnVuY3Rpb24gKG9iaiwgcXVlcnkpIHtcbiAgICAgICAgdmFyIGZpZWxkcyA9IE9iamVjdC5rZXlzKHF1ZXJ5KTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBmaWVsZHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHZhciB1bnByb2Nlc3NlZEZpZWxkID0gZmllbGRzW2ldLFxuICAgICAgICAgICAgICAgIHZhbHVlID0gcXVlcnlbdW5wcm9jZXNzZWRGaWVsZF07XG4gICAgICAgICAgICB2YXIgcnQgPSB0aGlzLm9iamVjdE1hdGNoZXMob2JqLCB1bnByb2Nlc3NlZEZpZWxkLCB2YWx1ZSwgcXVlcnkpO1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBydCAhPSAnYm9vbGVhbicpIHJldHVybiBydDtcbiAgICAgICAgICAgIGlmICghcnQpIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9LFxuICAgIG9iamVjdE1hdGNoZXNRdWVyeTogZnVuY3Rpb24gKG9iaikge1xuICAgICAgICByZXR1cm4gdGhpcy5vYmplY3RNYXRjaGVzQmFzZVF1ZXJ5KG9iaiwgdGhpcy5xdWVyeSk7XG4gICAgfVxufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gUXVlcnk7IiwiLyoqXG4gKiBCYXNlIGZ1bmN0aW9uYWxpdHkgZm9yIHJlbGF0aW9uc2hpcHMuXG4gKiBAbW9kdWxlIHJlbGF0aW9uc2hpcHNcbiAqL1xuXG52YXIgSW50ZXJuYWxTaWVzdGFFcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKS5JbnRlcm5hbFNpZXN0YUVycm9yLFxuICAgIFN0b3JlID0gcmVxdWlyZSgnLi9zdG9yZScpLFxuICAgIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKSxcbiAgICBfID0gdXRpbC5fLFxuICAgIFF1ZXJ5ID0gcmVxdWlyZSgnLi9xdWVyeScpLFxuICAgIGxvZyA9IHJlcXVpcmUoJy4vbG9nJyksXG4gICAgY2FjaGUgPSByZXF1aXJlKCcuL2NhY2hlJyksXG4gICAgZXZlbnRzID0gcmVxdWlyZSgnLi9ldmVudHMnKSxcbiAgICB3cmFwQXJyYXlGb3JBdHRyaWJ1dGVzID0gZXZlbnRzLndyYXBBcnJheSxcbiAgICBBcnJheU9ic2VydmVyID0gcmVxdWlyZSgnLi4vdmVuZG9yL29ic2VydmUtanMvc3JjL29ic2VydmUnKS5BcnJheU9ic2VydmVyLFxuICAgIG1vZGVsRXZlbnRzID0gcmVxdWlyZSgnLi9tb2RlbEV2ZW50cycpLFxuICAgIE1vZGVsRXZlbnRUeXBlID0gbW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGU7XG5cbi8qKlxuICogQGNsYXNzICBbUmVsYXRpb25zaGlwUHJveHkgZGVzY3JpcHRpb25dXG4gKiBAcGFyYW0ge09iamVjdH0gb3B0c1xuICogQGNvbnN0cnVjdG9yXG4gKi9cbmZ1bmN0aW9uIFJlbGF0aW9uc2hpcFByb3h5KG9wdHMpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgb3B0cyA9IG9wdHMgfHwge307XG5cbiAgICBfLmV4dGVuZCh0aGlzLCB7XG4gICAgICAgIG9iamVjdDogbnVsbCxcbiAgICAgICAgcmVsYXRlZDogbnVsbFxuICAgIH0pO1xuXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnRpZXModGhpcywge1xuICAgICAgICBpc0ZvcndhcmQ6IHtcbiAgICAgICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiAhc2VsZi5pc1JldmVyc2U7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgc2V0OiBmdW5jdGlvbiAodikge1xuICAgICAgICAgICAgICAgIHNlbGYuaXNSZXZlcnNlID0gIXY7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZVxuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICB1dGlsLmV4dGVuZEZyb21PcHRzKHRoaXMsIG9wdHMsIHtcbiAgICAgICAgcmV2ZXJzZU1vZGVsOiBudWxsLFxuICAgICAgICBmb3J3YXJkTW9kZWw6IG51bGwsXG4gICAgICAgIGZvcndhcmROYW1lOiBudWxsLFxuICAgICAgICByZXZlcnNlTmFtZTogbnVsbCxcbiAgICAgICAgaXNSZXZlcnNlOiBudWxsXG4gICAgfSk7XG5cbiAgICB0aGlzLmNhbmNlbExpc3RlbnMgPSB7fTtcbn1cblxuXy5leHRlbmQoUmVsYXRpb25zaGlwUHJveHksIHt9KTtcblxuXy5leHRlbmQoUmVsYXRpb25zaGlwUHJveHkucHJvdG90eXBlLCB7XG4gICAgLyoqXG4gICAgICogSW5zdGFsbCB0aGlzIHByb3h5IG9uIHRoZSBnaXZlbiBpbnN0YW5jZVxuICAgICAqIEBwYXJhbSB7TW9kZWxJbnN0YW5jZX0gbW9kZWxJbnN0YW5jZVxuICAgICAqL1xuICAgIGluc3RhbGw6IGZ1bmN0aW9uIChtb2RlbEluc3RhbmNlKSB7XG4gICAgICAgIGlmIChtb2RlbEluc3RhbmNlKSB7XG4gICAgICAgICAgICBpZiAoIXRoaXMub2JqZWN0KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5vYmplY3QgPSBtb2RlbEluc3RhbmNlO1xuICAgICAgICAgICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgICAgICAgICB2YXIgbmFtZSA9IHRoaXMuZ2V0Rm9yd2FyZE5hbWUoKTtcbiAgICAgICAgICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkobW9kZWxJbnN0YW5jZSwgbmFtZSwge1xuICAgICAgICAgICAgICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBzZWxmLnJlbGF0ZWQ7XG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIHNldDogZnVuY3Rpb24gKHYpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYuc2V0KHYpO1xuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBpZiAoIW1vZGVsSW5zdGFuY2UuX19wcm94aWVzKSBtb2RlbEluc3RhbmNlLl9fcHJveGllcyA9IHt9O1xuICAgICAgICAgICAgICAgIG1vZGVsSW5zdGFuY2UuX19wcm94aWVzW25hbWVdID0gdGhpcztcbiAgICAgICAgICAgICAgICBpZiAoIW1vZGVsSW5zdGFuY2UuX3Byb3hpZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgbW9kZWxJbnN0YW5jZS5fcHJveGllcyA9IFtdO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBtb2RlbEluc3RhbmNlLl9wcm94aWVzLnB1c2godGhpcyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdBbHJlYWR5IGluc3RhbGxlZC4nKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdObyBvYmplY3QgcGFzc2VkIHRvIHJlbGF0aW9uc2hpcCBpbnN0YWxsJyk7XG4gICAgICAgIH1cbiAgICB9XG5cbn0pO1xuXG4vL25vaW5zcGVjdGlvbiBKU1VudXNlZExvY2FsU3ltYm9sc1xuXy5leHRlbmQoUmVsYXRpb25zaGlwUHJveHkucHJvdG90eXBlLCB7XG4gICAgc2V0OiBmdW5jdGlvbiAob2JqLCBvcHRzKSB7XG4gICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdNdXN0IHN1YmNsYXNzIFJlbGF0aW9uc2hpcFByb3h5Jyk7XG4gICAgfSxcbiAgICBnZXQ6IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignTXVzdCBzdWJjbGFzcyBSZWxhdGlvbnNoaXBQcm94eScpO1xuICAgIH1cbn0pO1xuXG5fLmV4dGVuZChSZWxhdGlvbnNoaXBQcm94eS5wcm90b3R5cGUsIHtcbiAgICBwcm94eUZvckluc3RhbmNlOiBmdW5jdGlvbiAobW9kZWxJbnN0YW5jZSwgcmV2ZXJzZSkge1xuICAgICAgICB2YXIgbmFtZSA9IHJldmVyc2UgPyB0aGlzLmdldFJldmVyc2VOYW1lKCkgOiB0aGlzLmdldEZvcndhcmROYW1lKCksXG4gICAgICAgICAgICBtb2RlbCA9IHJldmVyc2UgPyB0aGlzLnJldmVyc2VNb2RlbCA6IHRoaXMuZm9yd2FyZE1vZGVsO1xuICAgICAgICB2YXIgcmV0O1xuICAgICAgICAvLyBUaGlzIHNob3VsZCBuZXZlciBoYXBwZW4uIFNob3VsZCBnICAgZXQgY2F1Z2h0IGluIHRoZSBtYXBwaW5nIG9wZXJhdGlvbj9cbiAgICAgICAgaWYgKHV0aWwuaXNBcnJheShtb2RlbEluc3RhbmNlKSkge1xuICAgICAgICAgICAgcmV0ID0gXy5tYXAobW9kZWxJbnN0YW5jZSwgZnVuY3Rpb24gKG8pIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gby5fX3Byb3hpZXNbbmFtZV07XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHZhciBwcm94eSA9IG1vZGVsSW5zdGFuY2UuX19wcm94aWVzW25hbWVdO1xuICAgICAgICAgICAgaWYgKCFwcm94eSkge1xuICAgICAgICAgICAgICAgIHZhciBlcnIgPSAnTm8gcHJveHkgd2l0aCBuYW1lIFwiJyArIG5hbWUgKyAnXCIgb24gbWFwcGluZyAnICsgbW9kZWwubmFtZTtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcihlcnIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0ID0gcHJveHk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJldDtcbiAgICB9LFxuICAgIHJldmVyc2VQcm94eUZvckluc3RhbmNlOiBmdW5jdGlvbiAobW9kZWxJbnN0YW5jZSkge1xuICAgICAgICByZXR1cm4gdGhpcy5wcm94eUZvckluc3RhbmNlKG1vZGVsSW5zdGFuY2UsIHRydWUpO1xuICAgIH0sXG4gICAgZ2V0UmV2ZXJzZU5hbWU6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuaXNGb3J3YXJkID8gdGhpcy5yZXZlcnNlTmFtZSA6IHRoaXMuZm9yd2FyZE5hbWU7XG4gICAgfSxcbiAgICBnZXRGb3J3YXJkTmFtZTogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5pc0ZvcndhcmQgPyB0aGlzLmZvcndhcmROYW1lIDogdGhpcy5yZXZlcnNlTmFtZTtcbiAgICB9LFxuICAgIGdldEZvcndhcmRNb2RlbDogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5pc0ZvcndhcmQgPyB0aGlzLmZvcndhcmRNb2RlbCA6IHRoaXMucmV2ZXJzZU1vZGVsO1xuICAgIH0sXG4gICAgY2xlYXJSZW1vdmFsTGlzdGVuZXI6IGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgdmFyIF9pZCA9IG9iai5faWQ7XG4gICAgICAgIHZhciBjYW5jZWxMaXN0ZW4gPSB0aGlzLmNhbmNlbExpc3RlbnNbX2lkXTtcbiAgICAgICAgLy8gVE9ETzogUmVtb3ZlIHRoaXMgY2hlY2suIGNhbmNlbExpc3RlbiBzaG91bGQgYWx3YXlzIGV4aXN0XG4gICAgICAgIGlmIChjYW5jZWxMaXN0ZW4pIHtcbiAgICAgICAgICAgIGNhbmNlbExpc3RlbigpO1xuICAgICAgICAgICAgdGhpcy5jYW5jZWxMaXN0ZW5zW19pZF0gPSBudWxsO1xuICAgICAgICB9XG4gICAgfSxcbiAgICBsaXN0ZW5Gb3JSZW1vdmFsOiBmdW5jdGlvbiAob2JqKSB7XG4gICAgICAgIHRoaXMuY2FuY2VsTGlzdGVuc1tvYmouX2lkXSA9IG9iai5saXN0ZW4oZnVuY3Rpb24gKGUpIHtcbiAgICAgICAgICAgIGlmIChlLnR5cGUgPT0gTW9kZWxFdmVudFR5cGUuUmVtb3ZlKSB7XG4gICAgICAgICAgICAgICAgaWYgKHV0aWwuaXNBcnJheSh0aGlzLnJlbGF0ZWQpKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBpZHggPSB0aGlzLnJlbGF0ZWQuaW5kZXhPZihvYmopO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnNwbGljZShpZHgsIDEpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zZXRJZEFuZFJlbGF0ZWQobnVsbCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHRoaXMuY2xlYXJSZW1vdmFsTGlzdGVuZXIob2JqKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIENvbmZpZ3VyZSBfaWQgYW5kIHJlbGF0ZWQgd2l0aCB0aGUgbmV3IHJlbGF0ZWQgb2JqZWN0LlxuICAgICAqIEBwYXJhbSBvYmpcbiAgICAgKiBAcGFyYW0ge29iamVjdH0gW29wdHNdXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0cy5kaXNhYmxlTm90aWZpY2F0aW9uc11cbiAgICAgKiBAcmV0dXJucyB7U3RyaW5nfHVuZGVmaW5lZH0gLSBFcnJvciBtZXNzYWdlIG9yIHVuZGVmaW5lZFxuICAgICAqL1xuICAgIHNldElkQW5kUmVsYXRlZDogZnVuY3Rpb24gKG9iaiwgb3B0cykge1xuICAgICAgICBvcHRzID0gb3B0cyB8fCB7fTtcbiAgICAgICAgaWYgKCFvcHRzLmRpc2FibGVldmVudHMpIHtcbiAgICAgICAgICAgIHRoaXMucmVnaXN0ZXJTZXRDaGFuZ2Uob2JqKTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgcHJldmlvdXNseVJlbGF0ZWQgPSB0aGlzLnJlbGF0ZWQ7XG4gICAgICAgIGlmIChwcmV2aW91c2x5UmVsYXRlZCkgdGhpcy5jbGVhclJlbW92YWxMaXN0ZW5lcihwcmV2aW91c2x5UmVsYXRlZCk7XG4gICAgICAgIGlmIChvYmopIHtcbiAgICAgICAgICAgIGlmICh1dGlsLmlzQXJyYXkob2JqKSkge1xuICAgICAgICAgICAgICAgIHRoaXMucmVsYXRlZCA9IG9iajtcbiAgICAgICAgICAgICAgICBvYmouZm9yRWFjaChmdW5jdGlvbiAoX29iaikge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmxpc3RlbkZvclJlbW92YWwoX29iaik7XG4gICAgICAgICAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5yZWxhdGVkID0gb2JqO1xuICAgICAgICAgICAgICAgIHRoaXMubGlzdGVuRm9yUmVtb3ZhbChvYmopO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5yZWxhdGVkID0gbnVsbDtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgY2hlY2tJbnN0YWxsZWQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgaWYgKCF0aGlzLm9iamVjdCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ1Byb3h5IG11c3QgYmUgaW5zdGFsbGVkIG9uIGFuIG9iamVjdCBiZWZvcmUgY2FuIHVzZSBpdC4nKTtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgc3BsaWNlcjogZnVuY3Rpb24gKG9wdHMpIHtcbiAgICAgICAgb3B0cyA9IG9wdHMgfHwge307XG4gICAgICAgIHJldHVybiBmdW5jdGlvbiAoaWR4LCBudW1SZW1vdmUpIHtcbiAgICAgICAgICAgIG9wdHMgPSBvcHRzIHx8IHt9O1xuICAgICAgICAgICAgaWYgKCFvcHRzLmRpc2FibGVldmVudHMpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnJlZ2lzdGVyU3BsaWNlQ2hhbmdlLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB2YXIgYWRkID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAyKTtcbiAgICAgICAgICAgIHJldHVybiBfLnBhcnRpYWwodGhpcy5yZWxhdGVkLnNwbGljZSwgaWR4LCBudW1SZW1vdmUpLmFwcGx5KHRoaXMucmVsYXRlZCwgYWRkKTtcbiAgICAgICAgfS5iaW5kKHRoaXMpO1xuICAgIH0sXG4gICAgY2xlYXJSZXZlcnNlUmVsYXRlZDogZnVuY3Rpb24gKG9wdHMpIHtcbiAgICAgICAgb3B0cyA9IG9wdHMgfHwge307XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgaWYgKHRoaXMucmVsYXRlZCkge1xuICAgICAgICAgICAgdmFyIHJldmVyc2VQcm94eSA9IHRoaXMucmV2ZXJzZVByb3h5Rm9ySW5zdGFuY2UodGhpcy5yZWxhdGVkKTtcbiAgICAgICAgICAgIHZhciByZXZlcnNlUHJveGllcyA9IHV0aWwuaXNBcnJheShyZXZlcnNlUHJveHkpID8gcmV2ZXJzZVByb3h5IDogW3JldmVyc2VQcm94eV07XG4gICAgICAgICAgICBfLmVhY2gocmV2ZXJzZVByb3hpZXMsIGZ1bmN0aW9uIChwKSB7XG4gICAgICAgICAgICAgICAgaWYgKHV0aWwuaXNBcnJheShwLnJlbGF0ZWQpKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBpZHggPSBwLnJlbGF0ZWQuaW5kZXhPZihzZWxmLm9iamVjdCk7XG4gICAgICAgICAgICAgICAgICAgIHAubWFrZUNoYW5nZXNUb1JlbGF0ZWRXaXRob3V0T2JzZXJ2YXRpb25zKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHAuc3BsaWNlcihvcHRzKShpZHgsIDEpO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBwLnNldElkQW5kUmVsYXRlZChudWxsLCBvcHRzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgc2V0SWRBbmRSZWxhdGVkUmV2ZXJzZTogZnVuY3Rpb24gKG9iaiwgb3B0cykge1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgIHZhciByZXZlcnNlUHJveHkgPSB0aGlzLnJldmVyc2VQcm94eUZvckluc3RhbmNlKG9iaik7XG4gICAgICAgIHZhciByZXZlcnNlUHJveGllcyA9IHV0aWwuaXNBcnJheShyZXZlcnNlUHJveHkpID8gcmV2ZXJzZVByb3h5IDogW3JldmVyc2VQcm94eV07XG4gICAgICAgIF8uZWFjaChyZXZlcnNlUHJveGllcywgZnVuY3Rpb24gKHApIHtcbiAgICAgICAgICAgIGlmICh1dGlsLmlzQXJyYXkocC5yZWxhdGVkKSkge1xuICAgICAgICAgICAgICAgIHAubWFrZUNoYW5nZXNUb1JlbGF0ZWRXaXRob3V0T2JzZXJ2YXRpb25zKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgcC5zcGxpY2VyKG9wdHMpKHAucmVsYXRlZC5sZW5ndGgsIDAsIHNlbGYub2JqZWN0KTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcC5jbGVhclJldmVyc2VSZWxhdGVkKG9wdHMpO1xuICAgICAgICAgICAgICAgIHAuc2V0SWRBbmRSZWxhdGVkKHNlbGYub2JqZWN0LCBvcHRzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfSxcbiAgICBtYWtlQ2hhbmdlc1RvUmVsYXRlZFdpdGhvdXRPYnNlcnZhdGlvbnM6IGZ1bmN0aW9uIChmKSB7XG4gICAgICAgIGlmICh0aGlzLnJlbGF0ZWQpIHtcbiAgICAgICAgICAgIHRoaXMucmVsYXRlZC5hcnJheU9ic2VydmVyLmNsb3NlKCk7XG4gICAgICAgICAgICB0aGlzLnJlbGF0ZWQuYXJyYXlPYnNlcnZlciA9IG51bGw7XG4gICAgICAgICAgICBmKCk7XG4gICAgICAgICAgICB0aGlzLndyYXBBcnJheSh0aGlzLnJlbGF0ZWQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZigpO1xuICAgICAgICB9XG4gICAgfSxcbiAgICByZWdpc3RlclNldENoYW5nZTogZnVuY3Rpb24gKG9iaikge1xuICAgICAgICB2YXIgcHJveHlPYmplY3QgPSB0aGlzLm9iamVjdDtcbiAgICAgICAgaWYgKCFwcm94eU9iamVjdCkgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ1Byb3h5IG11c3QgaGF2ZSBhbiBvYmplY3QgYXNzb2NpYXRlZCcpO1xuICAgICAgICB2YXIgbW9kZWwgPSBwcm94eU9iamVjdC5tb2RlbC5uYW1lO1xuICAgICAgICB2YXIgY29sbGVjdGlvbk5hbWUgPSBwcm94eU9iamVjdC5jb2xsZWN0aW9uTmFtZTtcbiAgICAgICAgLy8gV2UgdGFrZSBbXSA9PSBudWxsID09IHVuZGVmaW5lZCBpbiB0aGUgY2FzZSBvZiByZWxhdGlvbnNoaXBzLlxuICAgICAgICB2YXIgb2xkID0gdGhpcy5yZWxhdGVkO1xuICAgICAgICBpZiAodXRpbC5pc0FycmF5KG9sZCkgJiYgIW9sZC5sZW5ndGgpIHtcbiAgICAgICAgICAgIG9sZCA9IG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgbW9kZWxFdmVudHMuZW1pdCh7XG4gICAgICAgICAgICBjb2xsZWN0aW9uOiBjb2xsZWN0aW9uTmFtZSxcbiAgICAgICAgICAgIG1vZGVsOiBtb2RlbCxcbiAgICAgICAgICAgIF9pZDogcHJveHlPYmplY3QuX2lkLFxuICAgICAgICAgICAgZmllbGQ6IHRoaXMuZ2V0Rm9yd2FyZE5hbWUoKSxcbiAgICAgICAgICAgIG9sZDogb2xkLFxuICAgICAgICAgICAgbmV3OiBvYmosXG4gICAgICAgICAgICB0eXBlOiBNb2RlbEV2ZW50VHlwZS5TZXQsXG4gICAgICAgICAgICBvYmo6IHByb3h5T2JqZWN0XG4gICAgICAgIH0pO1xuICAgIH0sXG5cbiAgICByZWdpc3RlclNwbGljZUNoYW5nZTogZnVuY3Rpb24gKGlkeCwgbnVtUmVtb3ZlKSB7XG4gICAgICAgIHZhciBhZGQgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDIpO1xuICAgICAgICB2YXIgbW9kZWwgPSB0aGlzLm9iamVjdC5tb2RlbC5uYW1lO1xuICAgICAgICB2YXIgY29sbCA9IHRoaXMub2JqZWN0LmNvbGxlY3Rpb25OYW1lO1xuICAgICAgICBtb2RlbEV2ZW50cy5lbWl0KHtcbiAgICAgICAgICAgIGNvbGxlY3Rpb246IGNvbGwsXG4gICAgICAgICAgICBtb2RlbDogbW9kZWwsXG4gICAgICAgICAgICBfaWQ6IHRoaXMub2JqZWN0Ll9pZCxcbiAgICAgICAgICAgIGZpZWxkOiB0aGlzLmdldEZvcndhcmROYW1lKCksXG4gICAgICAgICAgICBpbmRleDogaWR4LFxuICAgICAgICAgICAgcmVtb3ZlZDogdGhpcy5yZWxhdGVkID8gdGhpcy5yZWxhdGVkLnNsaWNlKGlkeCwgaWR4ICsgbnVtUmVtb3ZlKSA6IG51bGwsXG4gICAgICAgICAgICBhZGRlZDogYWRkLmxlbmd0aCA/IGFkZCA6IFtdLFxuICAgICAgICAgICAgdHlwZTogTW9kZWxFdmVudFR5cGUuU3BsaWNlLFxuICAgICAgICAgICAgb2JqOiB0aGlzLm9iamVjdFxuICAgICAgICB9KTtcbiAgICB9LFxuICAgIHdyYXBBcnJheTogZnVuY3Rpb24gKGFycikge1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgIHdyYXBBcnJheUZvckF0dHJpYnV0ZXMoYXJyLCB0aGlzLnJldmVyc2VOYW1lLCB0aGlzLm9iamVjdCk7XG4gICAgICAgIGlmICghYXJyLmFycmF5T2JzZXJ2ZXIpIHtcbiAgICAgICAgICAgIGFyci5hcnJheU9ic2VydmVyID0gbmV3IEFycmF5T2JzZXJ2ZXIoYXJyKTtcbiAgICAgICAgICAgIHZhciBvYnNlcnZlckZ1bmN0aW9uID0gZnVuY3Rpb24gKHNwbGljZXMpIHtcbiAgICAgICAgICAgICAgICBzcGxpY2VzLmZvckVhY2goZnVuY3Rpb24gKHNwbGljZSkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgYWRkZWQgPSBzcGxpY2UuYWRkZWRDb3VudCA/IGFyci5zbGljZShzcGxpY2UuaW5kZXgsIHNwbGljZS5pbmRleCArIHNwbGljZS5hZGRlZENvdW50KSA6IFtdO1xuICAgICAgICAgICAgICAgICAgICB2YXIgbW9kZWwgPSBzZWxmLmdldEZvcndhcmRNb2RlbCgpO1xuICAgICAgICAgICAgICAgICAgICBtb2RlbEV2ZW50cy5lbWl0KHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbGxlY3Rpb246IG1vZGVsLmNvbGxlY3Rpb25OYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgbW9kZWw6IG1vZGVsLm5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBfaWQ6IHNlbGYub2JqZWN0Ll9pZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGZpZWxkOiBzZWxmLmdldEZvcndhcmROYW1lKCksXG4gICAgICAgICAgICAgICAgICAgICAgICByZW1vdmVkOiBzcGxpY2UucmVtb3ZlZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGFkZGVkOiBhZGRlZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6IE1vZGVsRXZlbnRUeXBlLlNwbGljZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIG9iajogc2VsZi5vYmplY3RcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgYXJyLmFycmF5T2JzZXJ2ZXIub3BlbihvYnNlcnZlckZ1bmN0aW9uKTtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgc3BsaWNlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRoaXMuc3BsaWNlcih7fSkuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9XG5cbn0pO1xuXG5cbm1vZHVsZS5leHBvcnRzID0gUmVsYXRpb25zaGlwUHJveHk7XG5cbiIsIi8qKlxuICogQG1vZHVsZSByZWxhdGlvbnNoaXBcbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgICBPbmVUb01hbnk6ICdPbmVUb01hbnknLFxuICAgIE9uZVRvT25lOiAnT25lVG9PbmUnLFxuICAgIE1hbnlUb01hbnk6ICdNYW55VG9NYW55J1xufTsiLCIvKipcbiAqIFRoaXMgaXMgYW4gaW4tbWVtb3J5IGNhY2hlIGZvciBtb2RlbHMuIE1vZGVscyBhcmUgY2FjaGVkIGJ5IGxvY2FsIGlkIChfaWQpIGFuZCByZW1vdGUgaWQgKGRlZmluZWQgYnkgdGhlIG1hcHBpbmcpLlxuICogTG9va3VwcyBhcmUgcGVyZm9ybWVkIGFnYWluc3QgdGhlIGNhY2hlIHdoZW4gbWFwcGluZy5cbiAqIEBtb2R1bGUgY2FjaGVcbiAqL1xudmFyIGxvZyA9IHJlcXVpcmUoJy4vbG9nJyksXG4gICAgSW50ZXJuYWxTaWVzdGFFcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKS5JbnRlcm5hbFNpZXN0YUVycm9yLFxuICAgIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKTtcblxuXG52YXIgTG9nZ2VyID0gbG9nLmxvZ2dlcldpdGhOYW1lKCdDYWNoZScpO1xuXG52YXIgbG9jYWxDYWNoZUJ5SWQgPSB7fSxcbiAgICBsb2NhbENhY2hlID0ge30sXG4gICAgcmVtb3RlQ2FjaGUgPSB7fTtcblxuLyoqXG4gKiBDbGVhciBvdXQgdGhlIGNhY2hlLlxuICovXG5mdW5jdGlvbiByZXNldCgpIHtcbiAgICByZW1vdGVDYWNoZSA9IHt9O1xuICAgIGxvY2FsQ2FjaGVCeUlkID0ge307XG4gICAgbG9jYWxDYWNoZSA9IHt9O1xufVxuXG4vKipcbiAqIFJldHVybiB0aGUgb2JqZWN0IGluIHRoZSBjYWNoZSBnaXZlbiBhIGxvY2FsIGlkIChfaWQpXG4gKiBAcGFyYW0gIHtTdHJpbmd9IGxvY2FsSWRcbiAqIEByZXR1cm4ge01vZGVsSW5zdGFuY2V9XG4gKi9cbmZ1bmN0aW9uIGdldFZpYUxvY2FsSWQobG9jYWxJZCkge1xuICAgIHZhciBvYmogPSBsb2NhbENhY2hlQnlJZFtsb2NhbElkXTtcbiAgICBpZiAob2JqKSB7XG4gICAgICAgIGlmIChMb2dnZXIuZGVidWcuaXNFbmFibGVkKVxuICAgICAgICAgICAgTG9nZ2VyLmRlYnVnKCdMb2NhbCBjYWNoZSBoaXQ6ICcgKyBvYmouX2R1bXAodHJ1ZSkpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGlmIChMb2dnZXIuZGVidWcuaXNFbmFibGVkKVxuICAgICAgICAgICAgTG9nZ2VyLmRlYnVnKCdMb2NhbCBjYWNoZSBtaXNzOiAnICsgbG9jYWxJZCk7XG4gICAgfVxuICAgIHJldHVybiBvYmo7XG59XG5cbi8qKlxuICogUmV0dXJuIHRoZSBzaW5nbGV0b24gb2JqZWN0IGdpdmVuIGEgc2luZ2xldG9uIG1vZGVsLlxuICogQHBhcmFtICB7TW9kZWx9IG1vZGVsXG4gKiBAcmV0dXJuIHtNb2RlbEluc3RhbmNlfVxuICovXG5mdW5jdGlvbiBnZXRTaW5nbGV0b24obW9kZWwpIHtcbiAgICB2YXIgbW9kZWxOYW1lID0gbW9kZWwubmFtZTtcbiAgICB2YXIgY29sbGVjdGlvbk5hbWUgPSBtb2RlbC5jb2xsZWN0aW9uTmFtZTtcbiAgICB2YXIgY29sbGVjdGlvbkNhY2hlID0gbG9jYWxDYWNoZVtjb2xsZWN0aW9uTmFtZV07XG4gICAgaWYgKGNvbGxlY3Rpb25DYWNoZSkge1xuICAgICAgICB2YXIgdHlwZUNhY2hlID0gY29sbGVjdGlvbkNhY2hlW21vZGVsTmFtZV07XG4gICAgICAgIGlmICh0eXBlQ2FjaGUpIHtcbiAgICAgICAgICAgIHZhciBvYmpzID0gW107XG4gICAgICAgICAgICBmb3IgKHZhciBwcm9wIGluIHR5cGVDYWNoZSkge1xuICAgICAgICAgICAgICAgIGlmICh0eXBlQ2FjaGUuaGFzT3duUHJvcGVydHkocHJvcCkpIHtcbiAgICAgICAgICAgICAgICAgICAgb2Jqcy5wdXNoKHR5cGVDYWNoZVtwcm9wXSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKG9ianMubGVuZ3RoID4gMSkge1xuICAgICAgICAgICAgICAgIHZhciBlcnJTdHIgPSAnQSBzaW5nbGV0b24gbW9kZWwgaGFzIG1vcmUgdGhhbiAxIG9iamVjdCBpbiB0aGUgY2FjaGUhIFRoaXMgaXMgYSBzZXJpb3VzIGVycm9yLiAnICtcbiAgICAgICAgICAgICAgICAgICAgJ0VpdGhlciBhIG1vZGVsIGhhcyBiZWVuIG1vZGlmaWVkIGFmdGVyIG9iamVjdHMgaGF2ZSBhbHJlYWR5IGJlZW4gY3JlYXRlZCwgb3Igc29tZXRoaW5nIGhhcyBnb25lJyArXG4gICAgICAgICAgICAgICAgICAgICd2ZXJ5IHdyb25nLiBQbGVhc2UgZmlsZSBhIGJ1ZyByZXBvcnQgaWYgdGhlIGxhdHRlci4nO1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKGVyclN0cik7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKG9ianMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG9ianNbMF07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG59XG5cbi8qKlxuICogR2l2ZW4gYSByZW1vdGUgaWRlbnRpZmllciBhbmQgYW4gb3B0aW9ucyBvYmplY3QgdGhhdCBkZXNjcmliZXMgbWFwcGluZy9jb2xsZWN0aW9uLFxuICogcmV0dXJuIHRoZSBtb2RlbCBpZiBjYWNoZWQuXG4gKiBAcGFyYW0gIHtTdHJpbmd9IHJlbW90ZUlkXG4gKiBAcGFyYW0gIHtPYmplY3R9IG9wdHNcbiAqIEByZXR1cm4ge01vZGVsSW5zdGFuY2V9XG4gKi9cbmZ1bmN0aW9uIGdldFZpYVJlbW90ZUlkKHJlbW90ZUlkLCBvcHRzKSB7XG4gICAgdmFyIHR5cGUgPSBvcHRzLm1vZGVsLm5hbWU7XG4gICAgdmFyIGNvbGxlY3Rpb25OYW1lID0gb3B0cy5tb2RlbC5jb2xsZWN0aW9uTmFtZTtcbiAgICB2YXIgY29sbGVjdGlvbkNhY2hlID0gcmVtb3RlQ2FjaGVbY29sbGVjdGlvbk5hbWVdO1xuICAgIGlmIChjb2xsZWN0aW9uQ2FjaGUpIHtcbiAgICAgICAgdmFyIHR5cGVDYWNoZSA9IHJlbW90ZUNhY2hlW2NvbGxlY3Rpb25OYW1lXVt0eXBlXTtcbiAgICAgICAgaWYgKHR5cGVDYWNoZSkge1xuICAgICAgICAgICAgdmFyIG9iaiA9IHR5cGVDYWNoZVtyZW1vdGVJZF07XG4gICAgICAgICAgICBpZiAob2JqKSB7XG4gICAgICAgICAgICAgICAgaWYgKExvZ2dlci5kZWJ1ZylcbiAgICAgICAgICAgICAgICAgICAgTG9nZ2VyLmRlYnVnKCdSZW1vdGUgY2FjaGUgaGl0OiAnICsgb2JqLl9kdW1wKHRydWUpKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgaWYgKExvZ2dlci5kZWJ1ZylcbiAgICAgICAgICAgICAgICAgICAgTG9nZ2VyLmRlYnVnKCdSZW1vdGUgY2FjaGUgbWlzczogJyArIHJlbW90ZUlkKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBvYmo7XG4gICAgICAgIH1cbiAgICB9XG4gICAgaWYgKExvZ2dlci5kZWJ1ZylcbiAgICAgICAgTG9nZ2VyLmRlYnVnKCdSZW1vdGUgY2FjaGUgbWlzczogJyArIHJlbW90ZUlkKTtcbiAgICByZXR1cm4gbnVsbDtcbn1cblxuLyoqXG4gKiBJbnNlcnQgYW4gb2JqZXQgaW50byB0aGUgY2FjaGUgdXNpbmcgYSByZW1vdGUgaWRlbnRpZmllciBkZWZpbmVkIGJ5IHRoZSBtYXBwaW5nLlxuICogQHBhcmFtICB7TW9kZWxJbnN0YW5jZX0gb2JqXG4gKiBAcGFyYW0gIHtTdHJpbmd9IHJlbW90ZUlkXG4gKiBAcGFyYW0gIHtTdHJpbmd9IHByZXZpb3VzUmVtb3RlSWQgSWYgcmVtb3RlIGlkIGhhcyBiZWVuIGNoYW5nZWQsIHRoaXMgaXMgdGhlIG9sZCByZW1vdGUgaWRlbnRpZmllclxuICovXG5mdW5jdGlvbiByZW1vdGVJbnNlcnQob2JqLCByZW1vdGVJZCwgcHJldmlvdXNSZW1vdGVJZCkge1xuICAgIGlmIChvYmopIHtcbiAgICAgICAgdmFyIGNvbGxlY3Rpb25OYW1lID0gb2JqLm1vZGVsLmNvbGxlY3Rpb25OYW1lO1xuICAgICAgICBpZiAoY29sbGVjdGlvbk5hbWUpIHtcbiAgICAgICAgICAgIGlmICghcmVtb3RlQ2FjaGVbY29sbGVjdGlvbk5hbWVdKSB7XG4gICAgICAgICAgICAgICAgcmVtb3RlQ2FjaGVbY29sbGVjdGlvbk5hbWVdID0ge307XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB2YXIgdHlwZSA9IG9iai5tb2RlbC5uYW1lO1xuICAgICAgICAgICAgaWYgKHR5cGUpIHtcbiAgICAgICAgICAgICAgICBpZiAoIXJlbW90ZUNhY2hlW2NvbGxlY3Rpb25OYW1lXVt0eXBlXSkge1xuICAgICAgICAgICAgICAgICAgICByZW1vdGVDYWNoZVtjb2xsZWN0aW9uTmFtZV1bdHlwZV0gPSB7fTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKHByZXZpb3VzUmVtb3RlSWQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVtb3RlQ2FjaGVbY29sbGVjdGlvbk5hbWVdW3R5cGVdW3ByZXZpb3VzUmVtb3RlSWRdID0gbnVsbDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdmFyIGNhY2hlZE9iamVjdCA9IHJlbW90ZUNhY2hlW2NvbGxlY3Rpb25OYW1lXVt0eXBlXVtyZW1vdGVJZF07XG4gICAgICAgICAgICAgICAgaWYgKCFjYWNoZWRPYmplY3QpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVtb3RlQ2FjaGVbY29sbGVjdGlvbk5hbWVdW3R5cGVdW3JlbW90ZUlkXSA9IG9iajtcbiAgICAgICAgICAgICAgICAgICAgaWYgKExvZ2dlci5kZWJ1Zy5pc0VuYWJsZWQpXG4gICAgICAgICAgICAgICAgICAgICAgICBMb2dnZXIuZGVidWcoJ1JlbW90ZSBjYWNoZSBpbnNlcnQ6ICcgKyBvYmouX2R1bXAodHJ1ZSkpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoTG9nZ2VyLnRyYWNlLmlzRW5hYmxlZClcbiAgICAgICAgICAgICAgICAgICAgICAgIExvZ2dlci50cmFjZSgnUmVtb3RlIGNhY2hlIG5vdyBsb29rcyBsaWtlOiAnICsgcmVtb3RlRHVtcCh0cnVlKSlcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyBTb21ldGhpbmcgaGFzIGdvbmUgcmVhbGx5IHdyb25nLiBPbmx5IG9uZSBvYmplY3QgZm9yIGEgcGFydGljdWxhciBjb2xsZWN0aW9uL3R5cGUvcmVtb3RlaWQgY29tYm9cbiAgICAgICAgICAgICAgICAgICAgLy8gc2hvdWxkIGV2ZXIgZXhpc3QuXG4gICAgICAgICAgICAgICAgICAgIGlmIChvYmogIT0gY2FjaGVkT2JqZWN0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgbWVzc2FnZSA9ICdPYmplY3QgJyArIGNvbGxlY3Rpb25OYW1lLnRvU3RyaW5nKCkgKyAnOicgKyB0eXBlLnRvU3RyaW5nKCkgKyAnWycgKyBvYmoubW9kZWwuaWQgKyAnPVwiJyArIHJlbW90ZUlkICsgJ1wiXSBhbHJlYWR5IGV4aXN0cyBpbiB0aGUgY2FjaGUuJyArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJyBUaGlzIGlzIGEgc2VyaW91cyBlcnJvciwgcGxlYXNlIGZpbGUgYSBidWcgcmVwb3J0IGlmIHlvdSBhcmUgZXhwZXJpZW5jaW5nIHRoaXMgb3V0IGluIHRoZSB3aWxkJztcbiAgICAgICAgICAgICAgICAgICAgICAgIExvZ2dlci5lcnJvcihtZXNzYWdlLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb2JqOiBvYmosXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FjaGVkT2JqZWN0OiBjYWNoZWRPYmplY3RcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IobWVzc2FnZSk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoTG9nZ2VyLmRlYnVnLmlzRW5hYmxlZClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBMb2dnZXIuZGVidWcoJ09iamVjdCBoYXMgYWxyZWFkeSBiZWVuIGluc2VydGVkOiAnICsgb2JqLl9kdW1wKHRydWUpKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignTW9kZWwgaGFzIG5vIHR5cGUnLCB7XG4gICAgICAgICAgICAgICAgICAgIG1vZGVsOiBvYmoubW9kZWwsXG4gICAgICAgICAgICAgICAgICAgIG9iajogb2JqXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignTW9kZWwgaGFzIG5vIGNvbGxlY3Rpb24nLCB7XG4gICAgICAgICAgICAgICAgbW9kZWw6IG9iai5tb2RlbCxcbiAgICAgICAgICAgICAgICBvYmo6IG9ialxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgICB2YXIgbXNnID0gJ011c3QgcGFzcyBhbiBvYmplY3Qgd2hlbiBpbnNlcnRpbmcgdG8gY2FjaGUnO1xuICAgICAgICBMb2dnZXIuZXJyb3IobXNnKTtcbiAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IobXNnKTtcbiAgICB9XG59XG5cbi8qKlxuICogRHVtcCB0aGUgcmVtb3RlIGlkIGNhY2hlXG4gKiBAcGFyYW0gIHtib29sZWFufSBhc0pzb24gV2hldGhlciBvciBub3QgdG8gYXBwbHkgSlNPTi5zdHJpbmdpZnlcbiAqIEByZXR1cm4ge1N0cmluZ3xPYmplY3R9XG4gKi9cbmZ1bmN0aW9uIHJlbW90ZUR1bXAoYXNKc29uKSB7XG4gICAgdmFyIGR1bXBlZFJlc3RDYWNoZSA9IHt9O1xuICAgIGZvciAodmFyIGNvbGwgaW4gcmVtb3RlQ2FjaGUpIHtcbiAgICAgICAgaWYgKHJlbW90ZUNhY2hlLmhhc093blByb3BlcnR5KGNvbGwpKSB7XG4gICAgICAgICAgICB2YXIgZHVtcGVkQ29sbENhY2hlID0ge307XG4gICAgICAgICAgICBkdW1wZWRSZXN0Q2FjaGVbY29sbF0gPSBkdW1wZWRDb2xsQ2FjaGU7XG4gICAgICAgICAgICB2YXIgY29sbENhY2hlID0gcmVtb3RlQ2FjaGVbY29sbF07XG4gICAgICAgICAgICBmb3IgKHZhciBtb2RlbCBpbiBjb2xsQ2FjaGUpIHtcbiAgICAgICAgICAgICAgICBpZiAoY29sbENhY2hlLmhhc093blByb3BlcnR5KG1vZGVsKSkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgZHVtcGVkTW9kZWxDYWNoZSA9IHt9O1xuICAgICAgICAgICAgICAgICAgICBkdW1wZWRDb2xsQ2FjaGVbbW9kZWxdID0gZHVtcGVkTW9kZWxDYWNoZTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIG1vZGVsQ2FjaGUgPSBjb2xsQ2FjaGVbbW9kZWxdO1xuICAgICAgICAgICAgICAgICAgICBmb3IgKHZhciByZW1vdGVJZCBpbiBtb2RlbENhY2hlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobW9kZWxDYWNoZS5oYXNPd25Qcm9wZXJ0eShyZW1vdGVJZCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAobW9kZWxDYWNoZVtyZW1vdGVJZF0pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZHVtcGVkTW9kZWxDYWNoZVtyZW1vdGVJZF0gPSBtb2RlbENhY2hlW3JlbW90ZUlkXS5fZHVtcCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gYXNKc29uID8gdXRpbC5wcmV0dHlQcmludCgoZHVtcGVkUmVzdENhY2hlLCBudWxsLCA0KSkgOiBkdW1wZWRSZXN0Q2FjaGU7XG59XG5cbi8qKlxuICogRHVtcCB0aGUgbG9jYWwgaWQgKF9pZCkgY2FjaGVcbiAqIEBwYXJhbSAge2Jvb2xlYW59IGFzSnNvbiBXaGV0aGVyIG9yIG5vdCB0byBhcHBseSBKU09OLnN0cmluZ2lmeVxuICogQHJldHVybiB7U3RyaW5nfE9iamVjdH1cbiAqL1xuZnVuY3Rpb24gbG9jYWxEdW1wKGFzSnNvbikge1xuICAgIHZhciBkdW1wZWRJZENhY2hlID0ge307XG4gICAgZm9yICh2YXIgaWQgaW4gbG9jYWxDYWNoZUJ5SWQpIHtcbiAgICAgICAgaWYgKGxvY2FsQ2FjaGVCeUlkLmhhc093blByb3BlcnR5KGlkKSkge1xuICAgICAgICAgICAgZHVtcGVkSWRDYWNoZVtpZF0gPSBsb2NhbENhY2hlQnlJZFtpZF0uX2R1bXAoKVxuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBhc0pzb24gPyB1dGlsLnByZXR0eVByaW50KChkdW1wZWRJZENhY2hlLCBudWxsLCA0KSkgOiBkdW1wZWRJZENhY2hlO1xufVxuXG4vKipcbiAqIER1bXAgdG8gdGhlIGNhY2hlLlxuICogQHBhcmFtICB7Ym9vbGVhbn0gYXNKc29uIFdoZXRoZXIgb3Igbm90IHRvIGFwcGx5IEpTT04uc3RyaW5naWZ5XG4gKiBAcmV0dXJuIHtTdHJpbmd8T2JqZWN0fVxuICovXG5mdW5jdGlvbiBkdW1wKGFzSnNvbikge1xuICAgIHZhciBkdW1wZWQgPSB7XG4gICAgICAgIGxvY2FsQ2FjaGU6IGxvY2FsRHVtcCgpLFxuICAgICAgICByZW1vdGVDYWNoZTogcmVtb3RlRHVtcCgpXG4gICAgfTtcbiAgICByZXR1cm4gYXNKc29uID8gdXRpbC5wcmV0dHlQcmludCgoZHVtcGVkLCBudWxsLCA0KSkgOiBkdW1wZWQ7XG59XG5cbmZ1bmN0aW9uIF9yZW1vdGVDYWNoZSgpIHtcbiAgICByZXR1cm4gcmVtb3RlQ2FjaGVcbn1cblxuZnVuY3Rpb24gX2xvY2FsQ2FjaGUoKSB7XG4gICAgcmV0dXJuIGxvY2FsQ2FjaGVCeUlkO1xufVxuXG4vKipcbiAqIFF1ZXJ5IHRoZSBjYWNoZVxuICogQHBhcmFtICB7T2JqZWN0fSBvcHRzIE9iamVjdCBkZXNjcmliaW5nIHRoZSBxdWVyeVxuICogQHJldHVybiB7TW9kZWxJbnN0YW5jZX1cbiAqIEBleGFtcGxlXG4gKiBgYGBqc1xuICogY2FjaGUuZ2V0KHtfaWQ6ICc1J30pOyAvLyBRdWVyeSBieSBsb2NhbCBpZFxuICogY2FjaGUuZ2V0KHtyZW1vdGVJZDogJzUnLCBtYXBwaW5nOiBteU1hcHBpbmd9KTsgLy8gUXVlcnkgYnkgcmVtb3RlIGlkXG4gKiBgYGBcbiAqL1xuZnVuY3Rpb24gZ2V0KG9wdHMpIHtcbiAgICBpZiAoTG9nZ2VyLmRlYnVnLmlzRW5hYmxlZCkgTG9nZ2VyLmRlYnVnKCdnZXQnLCBvcHRzKTtcbiAgICB2YXIgb2JqLCBpZEZpZWxkLCByZW1vdGVJZDtcbiAgICB2YXIgbG9jYWxJZCA9IG9wdHMuX2lkO1xuICAgIGlmIChsb2NhbElkKSB7XG4gICAgICAgIG9iaiA9IGdldFZpYUxvY2FsSWQobG9jYWxJZCk7XG4gICAgICAgIGlmIChvYmopIHtcbiAgICAgICAgICAgIHJldHVybiBvYmo7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAob3B0cy5tb2RlbCkge1xuICAgICAgICAgICAgICAgIGlkRmllbGQgPSBvcHRzLm1vZGVsLmlkO1xuICAgICAgICAgICAgICAgIHJlbW90ZUlkID0gb3B0c1tpZEZpZWxkXTtcbiAgICAgICAgICAgICAgICBpZiAoTG9nZ2VyLmRlYnVnLmlzRW5hYmxlZCkgTG9nZ2VyLmRlYnVnKGlkRmllbGQgKyAnPScgKyByZW1vdGVJZCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGdldFZpYVJlbW90ZUlkKHJlbW90ZUlkLCBvcHRzKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9IGVsc2UgaWYgKG9wdHMubW9kZWwpIHtcbiAgICAgICAgaWRGaWVsZCA9IG9wdHMubW9kZWwuaWQ7XG4gICAgICAgIHJlbW90ZUlkID0gb3B0c1tpZEZpZWxkXTtcbiAgICAgICAgaWYgKHJlbW90ZUlkKSB7XG4gICAgICAgICAgICByZXR1cm4gZ2V0VmlhUmVtb3RlSWQocmVtb3RlSWQsIG9wdHMpO1xuICAgICAgICB9IGVsc2UgaWYgKG9wdHMubW9kZWwuc2luZ2xldG9uKSB7XG4gICAgICAgICAgICByZXR1cm4gZ2V0U2luZ2xldG9uKG9wdHMubW9kZWwpO1xuICAgICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgICAgTG9nZ2VyLndhcm4oJ0ludmFsaWQgb3B0cyB0byBjYWNoZScsIHtcbiAgICAgICAgICAgIG9wdHM6IG9wdHNcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xufVxuXG4vKipcbiAqIEluc2VydCBhbiBvYmplY3QgaW50byB0aGUgY2FjaGUuXG4gKiBAcGFyYW0gIHtNb2RlbEluc3RhbmNlfSBvYmpcbiAqIEB0aHJvd3Mge0ludGVybmFsU2llc3RhRXJyb3J9IEFuIG9iamVjdCB3aXRoIF9pZC9yZW1vdGVJZCBhbHJlYWR5IGV4aXN0cy4gTm90IHRocm93biBpZiBzYW1lIG9iaGVjdC5cbiAqL1xuZnVuY3Rpb24gaW5zZXJ0KG9iaikge1xuICAgIHZhciBsb2NhbElkID0gb2JqLl9pZDtcbiAgICBpZiAobG9jYWxJZCkge1xuICAgICAgICB2YXIgY29sbGVjdGlvbk5hbWUgPSBvYmoubW9kZWwuY29sbGVjdGlvbk5hbWU7XG4gICAgICAgIHZhciBtb2RlbE5hbWUgPSBvYmoubW9kZWwubmFtZTtcbiAgICAgICAgaWYgKExvZ2dlci5kZWJ1Zy5pc0VuYWJsZWQpXG4gICAgICAgICAgICBMb2dnZXIuZGVidWcoJ0xvY2FsIGNhY2hlIGluc2VydDogJyArIG9iai5fZHVtcFN0cmluZygpKTtcbiAgICAgICAgaWYgKCFsb2NhbENhY2hlQnlJZFtsb2NhbElkXSkge1xuICAgICAgICAgICAgbG9jYWxDYWNoZUJ5SWRbbG9jYWxJZF0gPSBvYmo7XG4gICAgICAgICAgICBpZiAoTG9nZ2VyLnRyYWNlLmlzRW5hYmxlZClcbiAgICAgICAgICAgICAgICBMb2dnZXIudHJhY2UoJ0xvY2FsIGNhY2hlIG5vdyBsb29rcyBsaWtlOiAnICsgbG9jYWxEdW1wKHRydWUpKTtcbiAgICAgICAgICAgIGlmICghbG9jYWxDYWNoZVtjb2xsZWN0aW9uTmFtZV0pIGxvY2FsQ2FjaGVbY29sbGVjdGlvbk5hbWVdID0ge307XG4gICAgICAgICAgICBpZiAoIWxvY2FsQ2FjaGVbY29sbGVjdGlvbk5hbWVdW21vZGVsTmFtZV0pIGxvY2FsQ2FjaGVbY29sbGVjdGlvbk5hbWVdW21vZGVsTmFtZV0gPSB7fTtcbiAgICAgICAgICAgIGxvY2FsQ2FjaGVbY29sbGVjdGlvbk5hbWVdW21vZGVsTmFtZV1bbG9jYWxJZF0gPSBvYmo7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBTb21ldGhpbmcgaGFzIGdvbmUgYmFkbHkgd3JvbmcgaGVyZS4gVHdvIG9iamVjdHMgc2hvdWxkIG5ldmVyIGV4aXN0IHdpdGggdGhlIHNhbWUgX2lkXG4gICAgICAgICAgICBpZiAobG9jYWxDYWNoZUJ5SWRbbG9jYWxJZF0gIT0gb2JqKSB7XG4gICAgICAgICAgICAgICAgdmFyIG1lc3NhZ2UgPSAnT2JqZWN0IHdpdGggX2lkPVwiJyArIGxvY2FsSWQudG9TdHJpbmcoKSArICdcIiBpcyBhbHJlYWR5IGluIHRoZSBjYWNoZS4gJyArXG4gICAgICAgICAgICAgICAgICAgICdUaGlzIGlzIGEgc2VyaW91cyBlcnJvci4gUGxlYXNlIGZpbGUgYSBidWcgcmVwb3J0IGlmIHlvdSBhcmUgZXhwZXJpZW5jaW5nIHRoaXMgb3V0IGluIHRoZSB3aWxkJztcbiAgICAgICAgICAgICAgICBMb2dnZXIuZXJyb3IobWVzc2FnZSk7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IobWVzc2FnZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgdmFyIGlkRmllbGQgPSBvYmouaWRGaWVsZDtcbiAgICB2YXIgcmVtb3RlSWQgPSBvYmpbaWRGaWVsZF07XG4gICAgaWYgKHJlbW90ZUlkKSB7XG4gICAgICAgIHJlbW90ZUluc2VydChvYmosIHJlbW90ZUlkKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBpZiAoTG9nZ2VyLmRlYnVnLmlzRW5hYmxlZClcbiAgICAgICAgICAgIExvZ2dlci5kZWJ1ZygnTm8gcmVtb3RlIGlkIChcIicgKyBpZEZpZWxkICsgJ1wiKSBzbyB3b250IGJlIHBsYWNpbmcgaW4gdGhlIHJlbW90ZSBjYWNoZScsIG9iaik7XG4gICAgfVxufVxuXG4vKipcbiAqIFJldHVybnMgdHJ1ZSBpZiBvYmplY3QgaXMgaW4gdGhlIGNhY2hlXG4gKiBAcGFyYW0gIHtNb2RlbEluc3RhbmNlfSBvYmpcbiAqIEByZXR1cm4ge2Jvb2xlYW59XG4gKi9cbmZ1bmN0aW9uIGNvbnRhaW5zKG9iaikge1xuICAgIHZhciBxID0ge1xuICAgICAgICBfaWQ6IG9iai5faWRcbiAgICB9O1xuICAgIHZhciBtb2RlbCA9IG9iai5tb2RlbDtcbiAgICBpZiAobW9kZWwuaWQpIHtcbiAgICAgICAgaWYgKG9ialttb2RlbC5pZF0pIHtcbiAgICAgICAgICAgIHEubW9kZWwgPSBtb2RlbDtcbiAgICAgICAgICAgIHFbbW9kZWwuaWRdID0gb2JqW21vZGVsLmlkXTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gISFnZXQocSk7XG59XG5cbi8qKlxuICogUmVtb3ZlcyB0aGUgb2JqZWN0IGZyb20gdGhlIGNhY2hlIChpZiBpdCdzIGFjdHVhbGx5IGluIHRoZSBjYWNoZSkgb3RoZXJ3aXNlcyB0aHJvd3MgYW4gZXJyb3IuXG4gKiBAcGFyYW0gIHtNb2RlbEluc3RhbmNlfSBvYmpcbiAqIEB0aHJvd3Mge0ludGVybmFsU2llc3RhRXJyb3J9IElmIG9iamVjdCBhbHJlYWR5IGluIHRoZSBjYWNoZS5cbiAqL1xuZnVuY3Rpb24gcmVtb3ZlKG9iaikge1xuICAgIGlmIChjb250YWlucyhvYmopKSB7XG4gICAgICAgIHZhciBjb2xsZWN0aW9uTmFtZSA9IG9iai5tb2RlbC5jb2xsZWN0aW9uTmFtZTtcbiAgICAgICAgdmFyIG1vZGVsTmFtZSA9IG9iai5tb2RlbC5uYW1lO1xuICAgICAgICB2YXIgX2lkID0gb2JqLl9pZDtcbiAgICAgICAgaWYgKCFtb2RlbE5hbWUpIHRocm93IEludGVybmFsU2llc3RhRXJyb3IoJ05vIG1hcHBpbmcgbmFtZScpO1xuICAgICAgICBpZiAoIWNvbGxlY3Rpb25OYW1lKSB0aHJvdyBJbnRlcm5hbFNpZXN0YUVycm9yKCdObyBjb2xsZWN0aW9uIG5hbWUnKTtcbiAgICAgICAgaWYgKCFfaWQpIHRocm93IEludGVybmFsU2llc3RhRXJyb3IoJ05vIF9pZCcpO1xuICAgICAgICBkZWxldGUgbG9jYWxDYWNoZVtjb2xsZWN0aW9uTmFtZV1bbW9kZWxOYW1lXVtfaWRdO1xuICAgICAgICBkZWxldGUgbG9jYWxDYWNoZUJ5SWRbX2lkXTtcbiAgICAgICAgaWYgKG9iai5tb2RlbC5pZCkge1xuICAgICAgICAgICAgdmFyIHJlbW90ZUlkID0gb2JqW29iai5tb2RlbC5pZF07XG4gICAgICAgICAgICBpZiAocmVtb3RlSWQpIHtcbiAgICAgICAgICAgICAgICBkZWxldGUgcmVtb3RlQ2FjaGVbY29sbGVjdGlvbk5hbWVdW21vZGVsTmFtZV1bcmVtb3RlSWRdO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ09iamVjdCB3YXMgbm90IGluIGNhY2hlLicpO1xuICAgIH1cbn1cblxuXG5leHBvcnRzLl9yZW1vdGVDYWNoZSA9IF9yZW1vdGVDYWNoZTtcbmV4cG9ydHMuX2xvY2FsQ2FjaGUgPSBfbG9jYWxDYWNoZTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCAnX2xvY2FsQ2FjaGVCeVR5cGUnLCB7XG4gICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiBsb2NhbENhY2hlO1xuICAgIH1cbn0pO1xuZXhwb3J0cy5nZXQgPSBnZXQ7XG5leHBvcnRzLmluc2VydCA9IGluc2VydDtcbmV4cG9ydHMucmVtb3RlSW5zZXJ0ID0gcmVtb3RlSW5zZXJ0O1xuZXhwb3J0cy5yZXNldCA9IHJlc2V0O1xuZXhwb3J0cy5fZHVtcCA9IGR1bXA7XG5leHBvcnRzLmNvbnRhaW5zID0gY29udGFpbnM7XG5leHBvcnRzLnJlbW92ZSA9IHJlbW92ZTtcbmV4cG9ydHMuZ2V0U2luZ2xldG9uID0gZ2V0U2luZ2xldG9uOyIsIi8qKlxuICogQG1vZHVsZSBjb2xsZWN0aW9uXG4gKi9cblxudmFyIGxvZyA9IHJlcXVpcmUoJy4vbG9nJyksXG4gICAgQ29sbGVjdGlvblJlZ2lzdHJ5ID0gcmVxdWlyZSgnLi9jb2xsZWN0aW9uUmVnaXN0cnknKS5Db2xsZWN0aW9uUmVnaXN0cnksXG4gICAgSW50ZXJuYWxTaWVzdGFFcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKS5JbnRlcm5hbFNpZXN0YUVycm9yLFxuICAgIE1vZGVsID0gcmVxdWlyZSgnLi9tb2RlbCcpLFxuICAgIGV4dGVuZCA9IHJlcXVpcmUoJ2V4dGVuZCcpLFxuICAgIG9ic2VydmUgPSByZXF1aXJlKCcuLi92ZW5kb3Ivb2JzZXJ2ZS1qcy9zcmMvb2JzZXJ2ZScpLlBsYXRmb3JtLFxuICAgIGV2ZW50cyA9IHJlcXVpcmUoJy4vZXZlbnRzJyksXG4gICAgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpLFxuICAgIF8gPSB1dGlsLl8sXG4gICAgZXJyb3IgPSByZXF1aXJlKCcuL2Vycm9yJyksXG4gICAgY29uc3RydWN0RXJyb3IgPSBlcnJvci5lcnJvckZhY3RvcnkoZXJyb3IuQ29tcG9uZW50cy5Db2xsZWN0aW9uKSxcbiAgICBjYWNoZSA9IHJlcXVpcmUoJy4vY2FjaGUnKTtcblxudmFyIFVOU0FGRV9NRVRIT0RTID0gWydQVVQnLCAnUEFUQ0gnLCAnUE9TVCcsICdERUxFVEUnXSxcbiAgICBMb2dnZXIgPSBsb2cubG9nZ2VyV2l0aE5hbWUoJ0NvbGxlY3Rpb24nKTtcblxuLyoqXG4gKiBBIGNvbGxlY3Rpb24gZGVzY3JpYmVzIGEgc2V0IG9mIG1vZGVscyBhbmQgb3B0aW9uYWxseSBhIFJFU1QgQVBJIHdoaWNoIHdlIHdvdWxkXG4gKiBsaWtlIHRvIG1vZGVsLlxuICpcbiAqIEBwYXJhbSBuYW1lXG4gKiBAcGFyYW0gb3B0c1xuICogQGNvbnN0cnVjdG9yXG4gKlxuICpcbiAqIEBleGFtcGxlXG4gKiBgYGBqc1xuICogdmFyIEdpdEh1YiA9IG5ldyBzaWVzdGEoJ0dpdEh1YicpXG4gKiAvLyAuLi4gY29uZmlndXJlIG1hcHBpbmdzLCBkZXNjcmlwdG9ycyBldGMgLi4uXG4gKiBHaXRIdWIuaW5zdGFsbChmdW5jdGlvbiAoKSB7XG4gKiAgICAgLy8gLi4uIGNhcnJ5IG9uLlxuICogfSk7XG4gKiBgYGBcbiAqL1xuZnVuY3Rpb24gQ29sbGVjdGlvbihuYW1lLCBvcHRzKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGlmICghbmFtZSkgdGhyb3cgbmV3IEVycm9yKCdDb2xsZWN0aW9uIG11c3QgaGF2ZSBhIG5hbWUnKTtcblxuICAgIG9wdHMgPSBvcHRzIHx8IHt9O1xuICAgIHV0aWwuZXh0ZW5kRnJvbU9wdHModGhpcywgb3B0cywge1xuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIFVSTCBvZiB0aGUgQVBJIGUuZy4gaHR0cDovL2FwaS5naXRodWIuY29tXG4gICAgICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICAgICAqL1xuICAgICAgICBiYXNlVVJMOiAnJ1xuICAgIH0pO1xuXG4gICAgXy5leHRlbmQodGhpcywge1xuICAgICAgICBuYW1lOiBuYW1lLFxuICAgICAgICBfcmF3TW9kZWxzOiB7fSxcbiAgICAgICAgX21vZGVsczoge30sXG4gICAgICAgIF9vcHRzOiBvcHRzLFxuICAgICAgICAvKipcbiAgICAgICAgICogU2V0IHRvIHRydWUgaWYgaW5zdGFsbGF0aW9uIGhhcyBzdWNjZWVkZWQuIFlvdSBjYW5ub3QgdXNlIHRoZSBjb2xsZWN0aW9cbiAgICAgICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICAgICAqL1xuICAgICAgICBpbnN0YWxsZWQ6IGZhbHNlXG4gICAgfSk7XG5cbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydGllcyh0aGlzLCB7XG4gICAgICAgIGRpcnR5OiB7XG4gICAgICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBpZiAoc2llc3RhLmV4dC5zdG9yYWdlRW5hYmxlZCkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgdW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb24gPSBzaWVzdGEuZXh0LnN0b3JhZ2UuX3Vuc2F2ZWRPYmplY3RzQnlDb2xsZWN0aW9uLFxuICAgICAgICAgICAgICAgICAgICAgICAgaGFzaCA9IHVuc2F2ZWRPYmplY3RzQnlDb2xsZWN0aW9uW3NlbGYubmFtZV0gfHwge307XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiAhIU9iamVjdC5rZXlzKGhhc2gpLmxlbmd0aDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgQ29sbGVjdGlvblJlZ2lzdHJ5LnJlZ2lzdGVyKHRoaXMpO1xuICAgIGV2ZW50cy5Qcm94eUV2ZW50RW1pdHRlci5jYWxsKHRoaXMsIHRoaXMubmFtZSk7XG59XG5cbkNvbGxlY3Rpb24ucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShldmVudHMuUHJveHlFdmVudEVtaXR0ZXIucHJvdG90eXBlKTtcblxuXy5leHRlbmQoQ29sbGVjdGlvbi5wcm90b3R5cGUsIHtcbiAgICAvKipcbiAgICAgKiBFbnN1cmUgbWFwcGluZ3MgYXJlIGluc3RhbGxlZC5cbiAgICAgKiBAcGFyYW0gW2NhbGxiYWNrXVxuICAgICAqIEBjbGFzcyBDb2xsZWN0aW9uXG4gICAgICovXG4gICAgaW5zdGFsbDogZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgICAgIHZhciBkZWZlcnJlZCA9IHV0aWwuZGVmZXIoY2FsbGJhY2spO1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgIGlmICghdGhpcy5pbnN0YWxsZWQpIHtcbiAgICAgICAgICAgIHZhciBtb2RlbHNUb0luc3RhbGwgPSBbXTtcbiAgICAgICAgICAgIGZvciAodmFyIG5hbWUgaW4gdGhpcy5fbW9kZWxzKSB7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuX21vZGVscy5oYXNPd25Qcm9wZXJ0eShuYW1lKSkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgbW9kZWwgPSB0aGlzLl9tb2RlbHNbbmFtZV07XG4gICAgICAgICAgICAgICAgICAgIG1vZGVsc1RvSW5zdGFsbC5wdXNoKG1vZGVsKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoTG9nZ2VyLmluZm8uaXNFbmFibGVkKVxuICAgICAgICAgICAgICAgIExvZ2dlci5pbmZvKCdUaGVyZSBhcmUgJyArIG1vZGVsc1RvSW5zdGFsbC5sZW5ndGgudG9TdHJpbmcoKSArICcgbWFwcGluZ3MgdG8gaW5zdGFsbCcpO1xuICAgICAgICAgICAgaWYgKG1vZGVsc1RvSW5zdGFsbC5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICB2YXIgdGFza3MgPSBfLm1hcChtb2RlbHNUb0luc3RhbGwsIGZ1bmN0aW9uIChtKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBfLmJpbmQobS5pbnN0YWxsLCBtKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB1dGlsLmFzeW5jLnBhcmFsbGVsKHRhc2tzLCBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIExvZ2dlci5lcnJvcignRmFpbGVkIHRvIGluc3RhbGwgY29sbGVjdGlvbicsIGVycik7XG4gICAgICAgICAgICAgICAgICAgICAgICBzZWxmLl9maW5hbGlzZUluc3RhbGxhdGlvbihlcnIsIGRlZmVycmVkLmZpbmlzaC5iaW5kKGRlZmVycmVkKSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzZWxmLmluc3RhbGxlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgZXJyb3JzID0gW107XG4gICAgICAgICAgICAgICAgICAgICAgICBfLmVhY2gobW9kZWxzVG9JbnN0YWxsLCBmdW5jdGlvbiAobSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChMb2dnZXIuaW5mby5pc0VuYWJsZWQpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIExvZ2dlci5pbmZvKCdJbnN0YWxsaW5nIHJlbGF0aW9uc2hpcHMgZm9yIG1hcHBpbmcgd2l0aCBuYW1lIFwiJyArIG0ubmFtZSArICdcIicpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBlcnIgPSBtLmluc3RhbGxSZWxhdGlvbnNoaXBzKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVycikgZXJyb3JzLnB1c2goZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFlcnJvcnMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXy5lYWNoKG1vZGVsc1RvSW5zdGFsbCwgZnVuY3Rpb24gKG0pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKExvZ2dlci5pbmZvLmlzRW5hYmxlZClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIExvZ2dlci5pbmZvKCdJbnN0YWxsaW5nIHJldmVyc2UgcmVsYXRpb25zaGlwcyBmb3IgbWFwcGluZyB3aXRoIG5hbWUgXCInICsgbS5uYW1lICsgJ1wiJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBlcnIgPSBtLmluc3RhbGxSZXZlcnNlUmVsYXRpb25zaGlwcygpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKSBlcnJvcnMucHVzaChlcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVycm9ycy5sZW5ndGggPT0gMSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVyciA9IGVycm9yc1swXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoZXJyb3JzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVyciA9IGVycm9ycztcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYuX2ZpbmFsaXNlSW5zdGFsbGF0aW9uKGVyciwgZGVmZXJyZWQuZmluaXNoLmJpbmQoZGVmZXJyZWQpKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHNlbGYuX2ZpbmFsaXNlSW5zdGFsbGF0aW9uKG51bGwsIGRlZmVycmVkLmZpbmlzaC5iaW5kKGRlZmVycmVkKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignQ29sbGVjdGlvbiBcIicgKyB0aGlzLm5hbWUgKyAnXCIgaGFzIGFscmVhZHkgYmVlbiBpbnN0YWxsZWQnKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogTWFyayB0aGlzIGNvbGxlY3Rpb24gYXMgaW5zdGFsbGVkLCBhbmQgcGxhY2UgdGhlIGNvbGxlY3Rpb24gb24gdGhlIGdsb2JhbCBTaWVzdGEgb2JqZWN0LlxuICAgICAqIEBwYXJhbSAge09iamVjdH0gICBlcnJcbiAgICAgKiBAcGFyYW0gIHtGdW5jdGlvbn0gY2FsbGJhY2tcbiAgICAgKiBAY2xhc3MgQ29sbGVjdGlvblxuICAgICAqL1xuICAgIF9maW5hbGlzZUluc3RhbGxhdGlvbjogZnVuY3Rpb24gKGVyciwgY2FsbGJhY2spIHtcbiAgICAgICAgaWYgKGVycikgZXJyID0gY29uc3RydWN0RXJyb3IoJ0Vycm9ycyB3ZXJlIGVuY291bnRlcmVkIHdoaWxzdCBzZXR0aW5nIHVwIHRoZSBjb2xsZWN0aW9uJywge2Vycm9yczogZXJyfSk7XG4gICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgICB0aGlzLmluc3RhbGxlZCA9IHRydWU7XG4gICAgICAgICAgICB2YXIgaW5kZXggPSByZXF1aXJlKCcuL2luZGV4Jyk7XG4gICAgICAgICAgICBpbmRleFt0aGlzLm5hbWVdID0gdGhpcztcbiAgICAgICAgfVxuICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgIH0sXG4gICAgLyoqXG4gICAgICogR2l2ZW4gdGhlIG5hbWUgb2YgYSBtYXBwaW5nIGFuZCBhbiBvcHRpb25zIG9iamVjdCBkZXNjcmliaW5nIHRoZSBtYXBwaW5nLCBjcmVhdGluZyBhIE1vZGVsXG4gICAgICogb2JqZWN0LCBpbnN0YWxsIGl0IGFuZCByZXR1cm4gaXQuXG4gICAgICogQHBhcmFtICB7U3RyaW5nfSBuYW1lXG4gICAgICogQHBhcmFtICB7T2JqZWN0fSBvcHRzXG4gICAgICogQHJldHVybiB7TW9kZWx9XG4gICAgICogQGNsYXNzIENvbGxlY3Rpb25cbiAgICAgKi9cbiAgICBfbW9kZWw6IGZ1bmN0aW9uIChuYW1lLCBvcHRzKSB7XG4gICAgICAgIGlmIChuYW1lKSB7XG4gICAgICAgICAgICB0aGlzLl9yYXdNb2RlbHNbbmFtZV0gPSBvcHRzO1xuICAgICAgICAgICAgb3B0cyA9IGV4dGVuZCh0cnVlLCB7fSwgb3B0cyk7XG4gICAgICAgICAgICBvcHRzLm5hbWUgPSBuYW1lO1xuICAgICAgICAgICAgb3B0cy5jb2xsZWN0aW9uID0gdGhpcztcbiAgICAgICAgICAgIHZhciBtb2RlbCA9IG5ldyBNb2RlbChvcHRzKTtcbiAgICAgICAgICAgIHRoaXMuX21vZGVsc1tuYW1lXSA9IG1vZGVsO1xuICAgICAgICAgICAgdGhpc1tuYW1lXSA9IG1vZGVsO1xuICAgICAgICAgICAgcmV0dXJuIG1vZGVsO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdObyBuYW1lIHNwZWNpZmllZCB3aGVuIGNyZWF0aW5nIG1hcHBpbmcnKTtcbiAgICAgICAgfVxuICAgIH0sXG5cblxuICAgIC8qKlxuICAgICAqIFJlZ2lzdGVycyBhIG1vZGVsIHdpdGggdGhpcyBjb2xsZWN0aW9uLlxuICAgICAqIEBwYXJhbSB7U3RyaW5nfE9iamVjdH0gb3B0c09yTmFtZSBBbiBvcHRpb25zIG9iamVjdCBvciB0aGUgbmFtZSBvZiB0aGUgbWFwcGluZy4gTXVzdCBwYXNzIG9wdGlvbnMgYXMgc2Vjb25kIHBhcmFtIGlmIHNwZWNpZnkgbmFtZS5cbiAgICAgKiBAcGFyYW0ge09iamVjdH0gb3B0cyBPcHRpb25zIGlmIG5hbWUgYWxyZWFkeSBzcGVjaWZpZWQuXG4gICAgICogQHJldHVybiB7TW9kZWx9XG4gICAgICogQGNsYXNzIENvbGxlY3Rpb25cbiAgICAgKi9cbiAgICBtb2RlbDogZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgYWNjZXB0TW9kZWxzID0gIXRoaXMuaW5zdGFsbGVkO1xuICAgICAgICBpZiAoYWNjZXB0TW9kZWxzKSB7XG4gICAgICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgICAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHV0aWwuaXNBcnJheShhcmd1bWVudHNbMF0pKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gXy5tYXAoYXJndW1lbnRzWzBdLCBmdW5jdGlvbiAobSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBzZWxmLl9tb2RlbChtLm5hbWUsIG0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5fbW9kZWwoYXJndW1lbnRzWzBdLm5hbWUsIGFyZ3VtZW50c1swXSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGFyZ3VtZW50c1swXSA9PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuX21vZGVsKGFyZ3VtZW50c1swXSwgYXJndW1lbnRzWzFdKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBfLm1hcChhcmd1bWVudHMsIGZ1bmN0aW9uIChtKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHNlbGYuX21vZGVsKG0ubmFtZSwgbSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHRocm93IEVycm9yKCdDYW5ub3QgY3JlYXRlIG5ldyBtb2RlbHMgb25jZSB0aGUgb2JqZWN0IGdyYXBoIGlzIGVzdGFibGlzaGVkIScpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH0sXG5cbiAgICBkZXNjcmlwdG9yOiBmdW5jdGlvbiAob3B0cykge1xuICAgICAgICB2YXIgZGVzY3JpcHRvcnMgPSBbXTtcbiAgICAgICAgaWYgKHNpZXN0YS5leHQuaHR0cEVuYWJsZWQpIHtcbiAgICAgICAgICAgIG9wdHMuY29sbGVjdGlvbiA9IHRoaXM7XG4gICAgICAgICAgICB2YXIgbWV0aG9kcyA9IHNpZXN0YS5leHQuaHR0cC5fcmVzb2x2ZU1ldGhvZChvcHRzLm1ldGhvZCk7XG4gICAgICAgICAgICB2YXIgdW5zYWZlID0gW107XG4gICAgICAgICAgICB2YXIgc2FmZSA9IFtdO1xuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBtZXRob2RzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgdmFyIG0gPSBtZXRob2RzW2ldO1xuICAgICAgICAgICAgICAgIGlmIChVTlNBRkVfTUVUSE9EUy5pbmRleE9mKG0pID4gLTEpIHtcbiAgICAgICAgICAgICAgICAgICAgdW5zYWZlLnB1c2gobSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgc2FmZS5wdXNoKG0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICh1bnNhZmUubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgdmFyIHJlcXVlc3REZXNjcmlwdG9yID0gZXh0ZW5kKHt9LCBvcHRzKTtcbiAgICAgICAgICAgICAgICByZXF1ZXN0RGVzY3JpcHRvci5tZXRob2QgPSB1bnNhZmU7XG4gICAgICAgICAgICAgICAgcmVxdWVzdERlc2NyaXB0b3IgPSBuZXcgc2llc3RhLmV4dC5odHRwLlJlcXVlc3REZXNjcmlwdG9yKHJlcXVlc3REZXNjcmlwdG9yKTtcbiAgICAgICAgICAgICAgICBzaWVzdGEuZXh0Lmh0dHAuRGVzY3JpcHRvclJlZ2lzdHJ5LnJlZ2lzdGVyUmVxdWVzdERlc2NyaXB0b3IocmVxdWVzdERlc2NyaXB0b3IpO1xuICAgICAgICAgICAgICAgIGRlc2NyaXB0b3JzLnB1c2gocmVxdWVzdERlc2NyaXB0b3IpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHNhZmUubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgdmFyIHJlc3BvbnNlRGVzY3JpcHRvciA9IGV4dGVuZCh7fSwgb3B0cyk7XG4gICAgICAgICAgICAgICAgcmVzcG9uc2VEZXNjcmlwdG9yLm1ldGhvZCA9IHNhZmU7XG4gICAgICAgICAgICAgICAgcmVzcG9uc2VEZXNjcmlwdG9yID0gbmV3IHNpZXN0YS5leHQuaHR0cC5SZXNwb25zZURlc2NyaXB0b3IocmVzcG9uc2VEZXNjcmlwdG9yKTtcbiAgICAgICAgICAgICAgICBzaWVzdGEuZXh0Lmh0dHAuRGVzY3JpcHRvclJlZ2lzdHJ5LnJlZ2lzdGVyUmVzcG9uc2VEZXNjcmlwdG9yKHJlc3BvbnNlRGVzY3JpcHRvcik7XG4gICAgICAgICAgICAgICAgZGVzY3JpcHRvcnMucHVzaChyZXNwb25zZURlc2NyaXB0b3IpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdIVFRQIG1vZHVsZSBub3QgaW5zdGFsbGVkLicpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBkZXNjcmlwdG9ycztcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogRHVtcCB0aGlzIGNvbGxlY3Rpb24gYXMgSlNPTlxuICAgICAqIEBwYXJhbSAge0Jvb2xlYW59IGFzSnNvbiBXaGV0aGVyIG9yIG5vdCB0byBhcHBseSBKU09OLnN0cmluZ2lmeVxuICAgICAqIEByZXR1cm4ge1N0cmluZ3xPYmplY3R9XG4gICAgICogQGNsYXNzIENvbGxlY3Rpb25cbiAgICAgKi9cbiAgICBfZHVtcDogZnVuY3Rpb24gKGFzSnNvbikge1xuICAgICAgICB2YXIgb2JqID0ge307XG4gICAgICAgIG9iai5pbnN0YWxsZWQgPSB0aGlzLmluc3RhbGxlZDtcbiAgICAgICAgb2JqLmRvY0lkID0gdGhpcy5fZG9jSWQ7XG4gICAgICAgIG9iai5uYW1lID0gdGhpcy5uYW1lO1xuICAgICAgICBvYmouYmFzZVVSTCA9IHRoaXMuYmFzZVVSTDtcbiAgICAgICAgcmV0dXJuIGFzSnNvbiA/IHV0aWwucHJldHR5UHJpbnQob2JqKSA6IG9iajtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0aGUgbnVtYmVyIG9mIG9iamVjdHMgaW4gdGhpcyBjb2xsZWN0aW9uLlxuICAgICAqXG4gICAgICogQHBhcmFtIGNhbGxiYWNrXG4gICAgICogQHJldHVybnMge1Byb21pc2V9XG4gICAgICovXG4gICAgY291bnQ6IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgICAgICB2YXIgZGVmZXJyZWQgPSB1dGlsLmRlZmVyKGNhbGxiYWNrKTtcbiAgICAgICAgdmFyIHRhc2tzID0gXy5tYXAodGhpcy5fbW9kZWxzLCBmdW5jdGlvbiAobSkge1xuICAgICAgICAgICAgcmV0dXJuIF8uYmluZChtLmNvdW50LCBtKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHV0aWwuYXN5bmMucGFyYWxsZWwodGFza3MsIGZ1bmN0aW9uIChlcnIsIG5zKSB7XG4gICAgICAgICAgICB2YXIgbjtcbiAgICAgICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgICAgICAgbiA9IF8ucmVkdWNlKG5zLCBmdW5jdGlvbiAobSwgcikge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbSArIHJcbiAgICAgICAgICAgICAgICB9LCAwKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGRlZmVycmVkLmZpbmlzaChlcnIsIG4pO1xuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG4gICAgfVxufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gQ29sbGVjdGlvbjsiLCIvKipcbiAqIEBtb2R1bGUgY29sbGVjdGlvblxuICovXG52YXIgXyA9IHJlcXVpcmUoJy4vdXRpbCcpLl87XG5cbmZ1bmN0aW9uIENvbGxlY3Rpb25SZWdpc3RyeSgpIHtcbiAgICBpZiAoIXRoaXMpIHJldHVybiBuZXcgQ29sbGVjdGlvblJlZ2lzdHJ5KCk7XG4gICAgdGhpcy5jb2xsZWN0aW9uTmFtZXMgPSBbXTtcbn1cblxuXy5leHRlbmQoQ29sbGVjdGlvblJlZ2lzdHJ5LnByb3RvdHlwZSwge1xuICAgIHJlZ2lzdGVyOiBmdW5jdGlvbiAoY29sbGVjdGlvbikge1xuICAgICAgICB2YXIgbmFtZSA9IGNvbGxlY3Rpb24ubmFtZTtcbiAgICAgICAgdGhpc1tuYW1lXSA9IGNvbGxlY3Rpb247XG4gICAgICAgIHRoaXMuY29sbGVjdGlvbk5hbWVzLnB1c2gobmFtZSk7XG4gICAgfSxcbiAgICByZXNldDogZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgIF8uZWFjaCh0aGlzLmNvbGxlY3Rpb25OYW1lcywgZnVuY3Rpb24gKG5hbWUpIHtcbiAgICAgICAgICAgIGRlbGV0ZSBzZWxmW25hbWVdO1xuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5jb2xsZWN0aW9uTmFtZXMgPSBbXTtcbiAgICB9XG59KTtcblxuZXhwb3J0cy5Db2xsZWN0aW9uUmVnaXN0cnkgPSBuZXcgQ29sbGVjdGlvblJlZ2lzdHJ5KCk7IiwiLyoqXG4gKiBAbW9kdWxlIGVycm9yXG4gKi9cblxuXG4vKipcbiAqIFJlcHJlc2VudHMgaW50ZXJuYWwgZXJyb3JzLiBUaGVzZSBhcmUgdGhyb3duIHdoZW4gc29tZXRoaW5nIGhhcyBnb25lIHZlcnkgd3JvbmcgaW50ZXJuYWxseS4gSWYgeW91IHNlZSBvbmUgb2YgdGhlc2VcbiAqIG91dCBpbiB0aGUgd2lsZCB5b3UgcHJvYmFibHkgbmVlZCB0byBmaWxlIGEgYnVnIHJlcG9ydCBhcyBpdCBtZWFucyBzb21lIGFzc2VydGlvbiBoYXMgZmFpbGVkLlxuICogQHBhcmFtIG1lc3NhZ2VcbiAqIEBwYXJhbSBjb250ZXh0XG4gKiBAcGFyYW0gc3NmXG4gKiBAY29uc3RydWN0b3JcbiAqL1xuZnVuY3Rpb24gSW50ZXJuYWxTaWVzdGFFcnJvcihtZXNzYWdlLCBjb250ZXh0LCBzc2YpIHtcbiAgICB0aGlzLm1lc3NhZ2UgPSBtZXNzYWdlO1xuICAgIHRoaXMuY29udGV4dCA9IGNvbnRleHQ7XG4gICAgLy8gY2FwdHVyZSBzdGFjayB0cmFjZVxuICAgIHNzZiA9IHNzZiB8fCBhcmd1bWVudHMuY2FsbGVlO1xuICAgIGlmIChzc2YgJiYgRXJyb3IuY2FwdHVyZVN0YWNrVHJhY2UpIHtcbiAgICAgICAgRXJyb3IuY2FwdHVyZVN0YWNrVHJhY2UodGhpcywgc3NmKTtcbiAgICB9XG59XG5cbkludGVybmFsU2llc3RhRXJyb3IucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShFcnJvci5wcm90b3R5cGUpO1xuSW50ZXJuYWxTaWVzdGFFcnJvci5wcm90b3R5cGUubmFtZSA9ICdJbnRlcm5hbFNpZXN0YUVycm9yJztcbkludGVybmFsU2llc3RhRXJyb3IucHJvdG90eXBlLmNvbnN0cnVjdG9yID0gSW50ZXJuYWxTaWVzdGFFcnJvcjtcblxuXG4vKipcbiAqIEZpZWxkcyBvbiBlcnJvciBvYmplY3RzIGRpc2hlZCBvdXQgYnkgU2llc3RhLlxuICogQHR5cGUge09iamVjdH1cbiAqL1xudmFyIEVycm9yRmllbGQgPSB7XG4gICAgICAgIE1lc3NhZ2U6ICdtZXNzYWdlJyxcbiAgICAgICAgQ29kZTogJ2NvZGUnXG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBFbnVtZXJhdGVkIGVycm9ycy5cbiAgICAgKiBAdHlwZSB7T2JqZWN0fVxuICAgICAqL1xuICAgIEVycm9yQ29kZSA9IHtcbiAgICAgICAgVW5rbm93bjogMCxcbiAgICAgICAgLy8gSWYgbm8gZGVzY3JpcHRvciBtYXRjaGVzIGEgSFRUUCByZXNwb25zZS9yZXF1ZXN0IHRoZW4gdGhpcyBlcnJvciBpc1xuICAgICAgICBOb0Rlc2NyaXB0b3JNYXRjaGVkOiAxXG4gICAgfSxcblxuICAgIENvbXBvbmVudHMgPSB7XG4gICAgICAgIE1hcHBpbmc6ICdNYXBwaW5nJyxcbiAgICAgICAgSFRUUDogJ0hUVFAnLFxuICAgICAgICBSZWFjdGl2ZVF1ZXJ5OiAnUmVhY3RpdmVRdWVyeScsXG4gICAgICAgIEFycmFuZ2VkUmVhY3RpdmVRdWVyeTogJ0FycmFuZ2VkUmVhY3RpdmVRdWVyeScsXG4gICAgICAgIENvbGxlY3Rpb246ICdDb2xsZWN0aW9uJyxcbiAgICAgICAgUXVlcnk6ICdRdWVyeSdcbiAgICB9O1xuXG5cbi8qKlxuICogQHBhcmFtIGNvbXBvbmVudFxuICogQHBhcmFtIG1lc3NhZ2VcbiAqIEBwYXJhbSBleHRyYVxuICogQGNvbnN0cnVjdG9yXG4gKi9cbmZ1bmN0aW9uIFNpZXN0YVVzZXJFcnJvcihjb21wb25lbnQsIG1lc3NhZ2UsIGV4dHJhKSB7XG4gICAgZXh0cmEgPSBleHRyYSB8fCB7fTtcbiAgICB0aGlzLmNvbXBvbmVudCA9IGNvbXBvbmVudDtcbiAgICB0aGlzLm1lc3NhZ2UgPSBtZXNzYWdlO1xuICAgIGZvciAodmFyIHByb3AgaW4gZXh0cmEpIHtcbiAgICAgICAgaWYgKGV4dHJhLmhhc093blByb3BlcnR5KHByb3ApKSB7XG4gICAgICAgICAgICB0aGlzW3Byb3BdID0gZXh0cmFbcHJvcF07XG4gICAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5pc1VzZXJFcnJvciA9IHRydWU7XG59XG5cbi8qKlxuICogTWFwIGVycm9yIGNvZGVzIG9udG8gZGVzY3JpcHRpdmUgbWVzc2FnZXMuXG4gKiBAdHlwZSB7T2JqZWN0fVxuICovXG52YXIgTWVzc2FnZSA9IHt9O1xuTWVzc2FnZVtFcnJvckNvZGUuTm9EZXNjcmlwdG9yTWF0Y2hlZF0gPSAnTm8gZGVzY3JpcHRvciBtYXRjaGVkIHRoZSBIVFRQIHJlc3BvbnNlL3JlcXVlc3QuJztcblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gICAgSW50ZXJuYWxTaWVzdGFFcnJvcjogSW50ZXJuYWxTaWVzdGFFcnJvcixcbiAgICBTaWVzdGFVc2VyRXJyb3I6IFNpZXN0YVVzZXJFcnJvcixcbiAgICBFcnJvckNvZGU6IEVycm9yQ29kZSxcbiAgICBFcnJvckZpZWxkOiBFcnJvckZpZWxkLFxuICAgIE1lc3NhZ2U6IE1lc3NhZ2UsXG4gICAgQ29tcG9uZW50czogQ29tcG9uZW50cyxcbiAgICBlcnJvckZhY3Rvcnk6IGZ1bmN0aW9uIChjb21wb25lbnQpIHtcbiAgICAgICAgaWYgKGNvbXBvbmVudCBpbiBDb21wb25lbnRzKSB7XG4gICAgICAgICAgICByZXR1cm4gZnVuY3Rpb24gKG1lc3NhZ2UsIGV4dHJhKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG5ldyBTaWVzdGFVc2VyRXJyb3IoY29tcG9uZW50LCBtZXNzYWdlLCBleHRyYSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBTaWVzdGFVc2VyRXJyb3IoJ05vIHN1Y2ggY29tcG9uZW50IFwiJyArIGNvbXBvbmVudCArICdcIicpO1xuICAgICAgICB9XG4gICAgfVxufTsiLCJ2YXIgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnZXZlbnRzJykuRXZlbnRFbWl0dGVyLFxuICAgIEFycmF5T2JzZXJ2ZXIgPSByZXF1aXJlKCcuLi92ZW5kb3Ivb2JzZXJ2ZS1qcy9zcmMvb2JzZXJ2ZScpLkFycmF5T2JzZXJ2ZXIsXG4gICAgXyA9IHJlcXVpcmUoJy4vdXRpbCcpLl8sXG4gICAgbW9kZWxFdmVudHMgPSByZXF1aXJlKCcuL21vZGVsRXZlbnRzJyk7XG5cbnZhciBldmVudHMgPSBuZXcgRXZlbnRFbWl0dGVyKCk7XG5cbi8qKlxuICogTGlzdGVuIHRvIGEgcGFydGljdWxhciBldmVudCBmcm9tIHRoZSBTaWVzdGEgZ2xvYmFsIEV2ZW50RW1pdHRlci5cbiAqIE1hbmFnZXMgaXRzIG93biBzZXQgb2YgbGlzdGVuZXJzLlxuICogQGNvbnN0cnVjdG9yXG4gKi9cbmZ1bmN0aW9uIFByb3h5RXZlbnRFbWl0dGVyKGV2ZW50KSB7XG4gICAgXy5leHRlbmQodGhpcywge1xuICAgICAgICBldmVudDogZXZlbnQsXG4gICAgICAgIGxpc3RlbmVyczoge31cbiAgICB9KTtcbn1cblxuXy5leHRlbmQoUHJveHlFdmVudEVtaXR0ZXIucHJvdG90eXBlLCB7XG4gICAgbGlzdGVuOiBmdW5jdGlvbiAodHlwZSwgZm4pIHtcbiAgICAgICAgaWYgKHR5cGVvZiB0eXBlID09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIGZuID0gdHlwZTtcbiAgICAgICAgICAgIHR5cGUgPSBudWxsO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdmFyIF9mbiA9IGZuO1xuICAgICAgICAgICAgZm4gPSBmdW5jdGlvbiAoZSkge1xuICAgICAgICAgICAgICAgIGUgPSBlIHx8IHt9O1xuICAgICAgICAgICAgICAgIGlmICh0eXBlKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChlLnR5cGUgPT0gdHlwZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgX2ZuKGUpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBfZm4oZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHZhciBsaXN0ZW5lcnMgPSB0aGlzLmxpc3RlbmVycztcbiAgICAgICAgICAgIGlmICh0eXBlKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFsaXN0ZW5lcnNbdHlwZV0pIGxpc3RlbmVyc1t0eXBlXSA9IFtdO1xuICAgICAgICAgICAgICAgIGxpc3RlbmVyc1t0eXBlXS5wdXNoKGZuKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBldmVudHMub24odGhpcy5ldmVudCwgZm4pO1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdGhpcy5fcmVtb3ZlTGlzdGVuZXIoZm4sIHR5cGUpO1xuICAgICAgICB9LmJpbmQodGhpcyk7XG4gICAgfSxcbiAgICBsaXN0ZW5PbmNlOiBmdW5jdGlvbiAodHlwZSwgZm4pIHtcbiAgICAgICAgdmFyIGV2ZW50ID0gdGhpcy5ldmVudDtcbiAgICAgICAgaWYgKHR5cGVvZiB0eXBlID09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIGZuID0gdHlwZTtcbiAgICAgICAgICAgIHR5cGUgPSBudWxsO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdmFyIF9mbiA9IGZuO1xuICAgICAgICAgICAgZm4gPSBmdW5jdGlvbiAoZSkge1xuICAgICAgICAgICAgICAgIGUgPSBlIHx8IHt9O1xuICAgICAgICAgICAgICAgIGlmICh0eXBlKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChlLnR5cGUgPT0gdHlwZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZXZlbnRzLnJlbW92ZUxpc3RlbmVyKGV2ZW50LCBmbik7XG4gICAgICAgICAgICAgICAgICAgICAgICBfZm4oZSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIF9mbihlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHR5cGUpIHtcbiAgICAgICAgICAgIHJldHVybiBldmVudHMub24oZXZlbnQsIGZuKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBldmVudHMub25jZShldmVudCwgZm4pO1xuICAgICAgICB9XG4gICAgfSxcbiAgICBfcmVtb3ZlTGlzdGVuZXI6IGZ1bmN0aW9uIChmbiwgdHlwZSkge1xuICAgICAgICBpZiAodHlwZSkge1xuICAgICAgICAgICAgdmFyIGxpc3RlbmVycyA9IHRoaXMubGlzdGVuZXJzW3R5cGVdLFxuICAgICAgICAgICAgICAgIGlkeCA9IGxpc3RlbmVycy5pbmRleE9mKGZuKTtcbiAgICAgICAgICAgIGxpc3RlbmVycy5zcGxpY2UoaWR4LCAxKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZXZlbnRzLnJlbW92ZUxpc3RlbmVyKHRoaXMuZXZlbnQsIGZuKTtcbiAgICB9LFxuICAgIGVtaXQ6IGZ1bmN0aW9uICh0eXBlLCBwYXlsb2FkKSB7XG4gICAgICAgIGlmICh0eXBlb2YgdHlwZSA9PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgcGF5bG9hZCA9IHR5cGU7XG4gICAgICAgICAgICB0eXBlID0gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHBheWxvYWQgPSBwYXlsb2FkIHx8IHt9O1xuICAgICAgICAgICAgcGF5bG9hZC50eXBlID0gdHlwZTtcbiAgICAgICAgfVxuICAgICAgICBldmVudHMuZW1pdC5jYWxsKGV2ZW50cywgdGhpcy5ldmVudCwgcGF5bG9hZCk7XG4gICAgfSxcbiAgICBfcmVtb3ZlQWxsTGlzdGVuZXJzOiBmdW5jdGlvbiAodHlwZSkge1xuICAgICAgICAodGhpcy5saXN0ZW5lcnNbdHlwZV0gfHwgW10pLmZvckVhY2goZnVuY3Rpb24gKGZuKSB7XG4gICAgICAgICAgICBldmVudHMucmVtb3ZlTGlzdGVuZXIodGhpcy5ldmVudCwgZm4pO1xuICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICB0aGlzLmxpc3RlbmVyc1t0eXBlXSA9IFtdO1xuICAgIH0sXG4gICAgcmVtb3ZlQWxsTGlzdGVuZXJzOiBmdW5jdGlvbiAodHlwZSkge1xuICAgICAgICBpZiAodHlwZSkge1xuICAgICAgICAgICAgdGhpcy5fcmVtb3ZlQWxsTGlzdGVuZXJzKHR5cGUpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgZm9yICh0eXBlIGluIHRoaXMubGlzdGVuZXJzKSB7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMubGlzdGVuZXJzLmhhc093blByb3BlcnR5KHR5cGUpKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3JlbW92ZUFsbExpc3RlbmVycyh0eXBlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59KTtcblxuLy8gQWxpYXNlc1xuXy5leHRlbmQoUHJveHlFdmVudEVtaXR0ZXIucHJvdG90eXBlLCB7XG4gICAgb246IFByb3h5RXZlbnRFbWl0dGVyLnByb3RvdHlwZS5saXN0ZW5cbn0pO1xuXG5fLmV4dGVuZChldmVudHMsIHtcbiAgICBQcm94eUV2ZW50RW1pdHRlcjogUHJveHlFdmVudEVtaXR0ZXIsXG4gICAgd3JhcEFycmF5OiBmdW5jdGlvbiAoYXJyYXksIGZpZWxkLCBtb2RlbEluc3RhbmNlKSB7XG4gICAgICAgIGlmICghYXJyYXkub2JzZXJ2ZXIpIHtcbiAgICAgICAgICAgIGFycmF5Lm9ic2VydmVyID0gbmV3IEFycmF5T2JzZXJ2ZXIoYXJyYXkpO1xuICAgICAgICAgICAgYXJyYXkub2JzZXJ2ZXIub3BlbihmdW5jdGlvbiAoc3BsaWNlcykge1xuICAgICAgICAgICAgICAgIHZhciBmaWVsZElzQXR0cmlidXRlID0gbW9kZWxJbnN0YW5jZS5fYXR0cmlidXRlTmFtZXMuaW5kZXhPZihmaWVsZCkgPiAtMTtcbiAgICAgICAgICAgICAgICBpZiAoZmllbGRJc0F0dHJpYnV0ZSkge1xuICAgICAgICAgICAgICAgICAgICBzcGxpY2VzLmZvckVhY2goZnVuY3Rpb24gKHNwbGljZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbW9kZWxFdmVudHMuZW1pdCh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29sbGVjdGlvbjogbW9kZWxJbnN0YW5jZS5jb2xsZWN0aW9uTmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtb2RlbDogbW9kZWxJbnN0YW5jZS5tb2RlbC5uYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIF9pZDogbW9kZWxJbnN0YW5jZS5faWQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaW5kZXg6IHNwbGljZS5pbmRleCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZW1vdmVkOiBzcGxpY2UucmVtb3ZlZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhZGRlZDogc3BsaWNlLmFkZGVkQ291bnQgPyBhcnJheS5zbGljZShzcGxpY2UuaW5kZXgsIHNwbGljZS5pbmRleCArIHNwbGljZS5hZGRlZENvdW50KSA6IFtdLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6IG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlLlNwbGljZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmaWVsZDogZmllbGQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb2JqOiBtb2RlbEluc3RhbmNlXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9XG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBldmVudHM7IiwidmFyIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKSxcbiAgICBDb2xsZWN0aW9uUmVnaXN0cnkgPSByZXF1aXJlKCcuL2NvbGxlY3Rpb25SZWdpc3RyeScpLkNvbGxlY3Rpb25SZWdpc3RyeSxcbiAgICBDb2xsZWN0aW9uID0gcmVxdWlyZSgnLi9jb2xsZWN0aW9uJyksXG4gICAgY2FjaGUgPSByZXF1aXJlKCcuL2NhY2hlJyksXG4gICAgTW9kZWwgPSByZXF1aXJlKCcuL21vZGVsJyksXG4gICAgZXJyb3IgPSByZXF1aXJlKCcuL2Vycm9yJyksXG4gICAgZXZlbnRzID0gcmVxdWlyZSgnLi9ldmVudHMnKSxcbiAgICBSZWxhdGlvbnNoaXBUeXBlID0gcmVxdWlyZSgnLi9SZWxhdGlvbnNoaXBUeXBlJyksXG4gICAgUmVhY3RpdmVRdWVyeSA9IHJlcXVpcmUoJy4vcmVhY3RpdmVRdWVyeScpLFxuICAgIG1vZGVsRXZlbnRzID0gcmVxdWlyZSgnLi9tb2RlbEV2ZW50cycpLFxuICAgIFF1ZXJ5ID0gcmVxdWlyZSgnLi9RdWVyeScpLFxuICAgIGxvZyA9IHJlcXVpcmUoJy4vbG9nJyksXG4gICAgXyA9IHV0aWwuXztcblxuXG5pZiAod2luZG93LlEpIHdpbmRvdy5xID0gd2luZG93LlE7XG5cblxuLy8gSW5pdGlhbGlzZSBzaWVzdGEgb2JqZWN0LiBTdHJhbmdlIGZvcm1hdCBmYWNpbGl0aWVzIHVzaW5nIHN1Ym1vZHVsZXMgd2l0aCByZXF1aXJlSlMuXG52YXIgc2llc3RhID0gZnVuY3Rpb24gKGV4dCkge1xuICAgIGlmICghc2llc3RhLmV4dCkgc2llc3RhLmV4dCA9IHt9O1xuICAgIF8uZXh0ZW5kKHNpZXN0YS5leHQsIGV4dCB8fCB7fSk7XG4gICAgcmV0dXJuIHNpZXN0YTtcbn07XG5cbi8vIE5vdGlmaWNhdGlvbnNcbl8uZXh0ZW5kKHNpZXN0YSwge1xuICAgIG9uOiBldmVudHMub24uYmluZChldmVudHMpLFxuICAgIG9mZjogZXZlbnRzLnJlbW92ZUxpc3RlbmVyLmJpbmQoZXZlbnRzKSxcbiAgICBvbmNlOiBldmVudHMub25jZS5iaW5kKGV2ZW50cyksXG4gICAgcmVtb3ZlQWxsTGlzdGVuZXJzOiBldmVudHMucmVtb3ZlQWxsTGlzdGVuZXJzLmJpbmQoZXZlbnRzKVxufSk7XG5fLmV4dGVuZChzaWVzdGEsIHtcbiAgICByZW1vdmVMaXN0ZW5lcjogc2llc3RhLm9mZixcbiAgICBhZGRMaXN0ZW5lcjogc2llc3RhLm9uXG59KTtcblxuLy8gRXhwb3NlIHNvbWUgc3R1ZmYgZm9yIHVzYWdlIGJ5IGV4dGVuc2lvbnMgYW5kL29yIHVzZXJzXG5fLmV4dGVuZChzaWVzdGEsIHtcbiAgICBSZWxhdGlvbnNoaXBUeXBlOiBSZWxhdGlvbnNoaXBUeXBlLFxuICAgIE1vZGVsRXZlbnRUeXBlOiBtb2RlbEV2ZW50cy5Nb2RlbEV2ZW50VHlwZSxcbiAgICBsb2c6IGxvZy5MZXZlbCxcbiAgICBJbnNlcnRpb25Qb2xpY3k6IFJlYWN0aXZlUXVlcnkuSW5zZXJ0aW9uUG9saWN5LFxuICAgIF9pbnRlcm5hbDoge1xuICAgICAgICBsb2c6IGxvZyxcbiAgICAgICAgTW9kZWw6IE1vZGVsLFxuICAgICAgICBtb2RlbDogcmVxdWlyZSgnLi9tb2RlbCcpLFxuICAgICAgICBlcnJvcjogcmVxdWlyZSgnLi9lcnJvcicpLFxuICAgICAgICBNb2RlbEV2ZW50VHlwZTogbW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUsXG4gICAgICAgIHNpZXN0YU1vZGVsOiByZXF1aXJlKCcuL21vZGVsSW5zdGFuY2UnKSxcbiAgICAgICAgZXh0ZW5kOiByZXF1aXJlKCdleHRlbmQnKSxcbiAgICAgICAgTWFwcGluZ09wZXJhdGlvbjogcmVxdWlyZSgnLi9tYXBwaW5nT3BlcmF0aW9uJyksXG4gICAgICAgIGV2ZW50czogcmVxdWlyZSgnLi9ldmVudHMnKSxcbiAgICAgICAgY2FjaGU6IHJlcXVpcmUoJy4vY2FjaGUnKSxcbiAgICAgICAgbW9kZWxFdmVudHM6IG1vZGVsRXZlbnRzLFxuICAgICAgICBDb2xsZWN0aW9uUmVnaXN0cnk6IHJlcXVpcmUoJy4vY29sbGVjdGlvblJlZ2lzdHJ5JykuQ29sbGVjdGlvblJlZ2lzdHJ5LFxuICAgICAgICBDb2xsZWN0aW9uOiBDb2xsZWN0aW9uLFxuICAgICAgICB1dGlsczogdXRpbCxcbiAgICAgICAgdXRpbDogdXRpbCxcbiAgICAgICAgXzogdXRpbC5fLFxuICAgICAgICBxdWVyeTogcmVxdWlyZSgnLi9xdWVyeScpLFxuICAgICAgICBzdG9yZTogcmVxdWlyZSgnLi9zdG9yZScpXG4gICAgfSxcbiAgICBfOiB1dGlsLl8sXG4gICAgYXN5bmM6IHV0aWwuYXN5bmMsXG4gICAgaXNBcnJheTogdXRpbC5pc0FycmF5LFxuICAgIGlzU3RyaW5nOiB1dGlsLmlzU3RyaW5nXG59KTtcblxuc2llc3RhLmV4dCA9IHt9O1xuXG52YXIgaW5zdGFsbGVkID0gZmFsc2UsXG4gICAgaW5zdGFsbGluZyA9IGZhbHNlO1xuXG5cbl8uZXh0ZW5kKHNpZXN0YSwge1xuICAgIC8qKlxuICAgICAqIFdpcGUgZXZlcnl0aGluZy4gVXNlZCBkdXJpbmcgdGVzdCBnZW5lcmFsbHkuXG4gICAgICovXG4gICAgcmVzZXQ6IGZ1bmN0aW9uIChjYikge1xuICAgICAgICBpbnN0YWxsZWQgPSBmYWxzZTtcbiAgICAgICAgaW5zdGFsbGluZyA9IGZhbHNlO1xuICAgICAgICBkZWxldGUgdGhpcy5xdWV1ZWRUYXNrcztcbiAgICAgICAgY2FjaGUucmVzZXQoKTtcbiAgICAgICAgQ29sbGVjdGlvblJlZ2lzdHJ5LnJlc2V0KCk7XG4gICAgICAgIGV2ZW50cy5yZW1vdmVBbGxMaXN0ZW5lcnMoKTtcbiAgICAgICAgaWYgKHNpZXN0YS5leHQuaHR0cEVuYWJsZWQpIHtcbiAgICAgICAgICAgIHNpZXN0YS5leHQuaHR0cC5EZXNjcmlwdG9yUmVnaXN0cnkucmVzZXQoKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoc2llc3RhLmV4dC5zdG9yYWdlRW5hYmxlZCkge1xuICAgICAgICAgICAgc2llc3RhLmV4dC5zdG9yYWdlLl9yZXNldChjYik7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBjYigpO1xuICAgICAgICB9XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBSZW1vdmVzIGFsbCBkYXRhLiBVc2VkIGR1cmluZyB0ZXN0cyBnZW5lcmFsbHkuXG4gICAgICogQHBhcmFtIFtjYl1cbiAgICAgKi9cbiAgICByZXNldERhdGE6IGZ1bmN0aW9uIChjYikge1xuICAgICAgICB2YXIgZGVmZXJyZWQgPSB1dGlsLmRlZmVyKGNiKTtcbiAgICAgICAgY2IgPSBkZWZlcnJlZC5maW5pc2guYmluZChkZWZlcnJlZCk7XG4gICAgICAgIHNpZXN0YS5leHQuc3RvcmFnZS5fcmVzZXQoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdmFyIGNvbGxlY3Rpb25OYW1lcyA9IFtdLFxuICAgICAgICAgICAgICAgIHRhc2tzID0gQ29sbGVjdGlvblJlZ2lzdHJ5LmNvbGxlY3Rpb25OYW1lcy5yZWR1Y2UoZnVuY3Rpb24gKG1lbW8sIGNvbGxlY3Rpb25OYW1lKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBjb2xsZWN0aW9uID0gQ29sbGVjdGlvblJlZ2lzdHJ5W2NvbGxlY3Rpb25OYW1lXSxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1vZGVscyA9IGNvbGxlY3Rpb24uX21vZGVscztcbiAgICAgICAgICAgICAgICAgICAgY29sbGVjdGlvbk5hbWVzLnB1c2goY29sbGVjdGlvbk5hbWUpO1xuICAgICAgICAgICAgICAgICAgICBPYmplY3Qua2V5cyhtb2RlbHMpLmZvckVhY2goZnVuY3Rpb24gKGspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBtb2RlbCA9IG1vZGVsc1trXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lbW8ucHVzaChmdW5jdGlvbiAoZG9uZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1vZGVsLmFsbChmdW5jdGlvbiAoZXJyLCByZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFlcnIpIHJlcy5yZW1vdmUoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZG9uZShlcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbWVtbztcbiAgICAgICAgICAgICAgICB9LCBbXSk7XG4gICAgICAgICAgICB1dGlsLmFzeW5jLnNlcmllcyhcbiAgICAgICAgICAgICAgICBbXG4gICAgICAgICAgICAgICAgICAgIF8ucGFydGlhbCh1dGlsLmFzeW5jLnBhcmFsbGVsLCB0YXNrcylcbiAgICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICAgIGNiKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xuICAgIH0sXG4gICAgLyoqXG4gICAgICogQ3JlYXRlcyBhbmQgcmVnaXN0ZXJzIGEgbmV3IENvbGxlY3Rpb24uXG4gICAgICogQHBhcmFtICB7U3RyaW5nfSBuYW1lXG4gICAgICogQHBhcmFtICB7T2JqZWN0fSBbb3B0c11cbiAgICAgKiBAcmV0dXJuIHtDb2xsZWN0aW9ufVxuICAgICAqL1xuICAgIGNvbGxlY3Rpb246IGZ1bmN0aW9uIChuYW1lLCBvcHRzKSB7XG4gICAgICAgIHJldHVybiBuZXcgQ29sbGVjdGlvbihuYW1lLCBvcHRzKTtcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIEluc3RhbGwgYWxsIGNvbGxlY3Rpb25zLlxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IFtjYl1cbiAgICAgKiBAcmV0dXJucyB7cS5Qcm9taXNlfVxuICAgICAqL1xuICAgIGluc3RhbGw6IGZ1bmN0aW9uIChjYikge1xuICAgICAgICBpZiAoIShpbnN0YWxsaW5nIHx8IGluc3RhbGxlZCkpIHtcbiAgICAgICAgICAgIGluc3RhbGxpbmcgPSB0cnVlO1xuICAgICAgICAgICAgdmFyIGRlZmVycmVkID0gdXRpbC5kZWZlcihjYik7XG4gICAgICAgICAgICBjYiA9IGRlZmVycmVkLmZpbmlzaC5iaW5kKGRlZmVycmVkKTtcbiAgICAgICAgICAgIHZhciBjb2xsZWN0aW9uTmFtZXMgPSBDb2xsZWN0aW9uUmVnaXN0cnkuY29sbGVjdGlvbk5hbWVzLFxuICAgICAgICAgICAgICAgIGNvbGxlY3Rpb25JbnN0YWxsVGFza3MgPSBfLm1hcChjb2xsZWN0aW9uTmFtZXMsIGZ1bmN0aW9uIChuKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbiAoZG9uZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgQ29sbGVjdGlvblJlZ2lzdHJ5W25dLmluc3RhbGwoZG9uZSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgICAgIHNpZXN0YS5hc3luYy5zZXJpZXMoY29sbGVjdGlvbkluc3RhbGxUYXNrcywgZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgY2IoZXJyKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHNpZXN0YS5leHQuc3RvcmFnZS5fbG9hZChmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGluc3RhbGxlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHNlbGYucXVldWVkVGFza3MpIHNlbGYucXVldWVkVGFza3MuZXhlY3V0ZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgY2IoZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgbmV3IGVycm9yLkludGVybmFsU2llc3RhRXJyb3IoJ0FscmVhZHkgaW5zdGFsbGluZy4uLicpO1xuICAgICAgICB9cmVzZVxuXG4gICAgfSxcbiAgICBfcHVzaFRhc2s6IGZ1bmN0aW9uICh0YXNrKSB7XG4gICAgICAgIGlmICghdGhpcy5xdWV1ZWRUYXNrcykge1xuICAgICAgICAgICAgdGhpcy5xdWV1ZWRUYXNrcyA9IG5ldyBmdW5jdGlvbiBRdWV1ZSgpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnRhc2tzID0gW107XG4gICAgICAgICAgICAgICAgdGhpcy5leGVjdXRlID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnRhc2tzLmZvckVhY2goZnVuY3Rpb24gKGYpIHtmKCl9KTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy50YXNrcyA9IFtdO1xuICAgICAgICAgICAgICAgIH0uYmluZCh0aGlzKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5xdWV1ZWRUYXNrcy50YXNrcy5wdXNoKHRhc2spO1xuICAgIH0sXG4gICAgX2FmdGVySW5zdGFsbDogZnVuY3Rpb24gKHRhc2spIHtcbiAgICAgICAgaWYgKCFpbnN0YWxsZWQpIHtcbiAgICAgICAgICAgIGlmICghaW5zdGFsbGluZykge1xuICAgICAgICAgICAgICAgIHRoaXMuaW5zdGFsbChmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIHNldHRpbmcgdXAgc2llc3RhJywgZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgZGVsZXRlIHRoaXMucXVldWVkVGFza3M7XG4gICAgICAgICAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIEluIGNhc2UgaW5zdGFsbGVkIHN0cmFpZ2h0IGF3YXkgZS5nLiBpZiBzdG9yYWdlIGV4dGVuc2lvbiBub3QgaW5zdGFsbGVkLlxuICAgICAgICAgICAgaWYgKCFpbnN0YWxsZWQpIHRoaXMuX3B1c2hUYXNrKHRhc2spO1xuICAgICAgICAgICAgZWxzZSB0YXNrKCk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICB0YXNrKCk7XG4gICAgICAgIH1cbiAgICB9LFxuICAgIHNldExvZ0xldmVsOiBmdW5jdGlvbiAobG9nZ2VyTmFtZSwgbGV2ZWwpIHtcbiAgICAgICAgdmFyIExvZ2dlciA9IGxvZy5sb2dnZXJXaXRoTmFtZShsb2dnZXJOYW1lKTtcbiAgICAgICAgTG9nZ2VyLnNldExldmVsKGxldmVsKTtcbiAgICB9LFxuICAgIG5vdGlmeTogdXRpbC5uZXh0LFxuICAgIHJlZ2lzdGVyQ29tcGFyYXRvcjogUXVlcnkuYmluZChRdWVyeSlcbn0pO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydGllcyhzaWVzdGEsIHtcbiAgICBfY2FuQ2hhbmdlOiB7XG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuICEoaW5zdGFsbGluZyB8fCBpbnN0YWxsZWQpO1xuICAgICAgICB9XG4gICAgfVxufSk7XG5cbmlmICh0eXBlb2Ygd2luZG93ICE9ICd1bmRlZmluZWQnKSB7XG4gICAgd2luZG93LnNpZXN0YSA9IHNpZXN0YTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBzaWVzdGE7IiwiLyoqXG4gKiBEZWFkIHNpbXBsZSBsb2dnaW5nIHNlcnZpY2UuXG4gKiBAbW9kdWxlIGxvZ1xuICovXG5cbnZhciBfID0gcmVxdWlyZSgnLi91dGlsJykuXztcblxudmFyIGxvZ0xldmVscyA9IHt9O1xuXG5cbmZ1bmN0aW9uIExvZ2dlcihuYW1lKSB7XG4gICAgaWYgKCF0aGlzKSByZXR1cm4gbmV3IExvZ2dlcihuYW1lKTtcbiAgICB0aGlzLm5hbWUgPSBuYW1lO1xuICAgIGxvZ0xldmVsc1tuYW1lXSA9IExvZ2dlci5MZXZlbC53YXJuO1xuICAgIHRoaXMudHJhY2UgPSBjb25zdHJ1Y3RQZXJmb3JtZXIodGhpcywgXy5iaW5kKGNvbnNvbGUuZGVidWcgPyBjb25zb2xlLmRlYnVnIDogY29uc29sZS5sb2csIGNvbnNvbGUpLCBMb2dnZXIuTGV2ZWwudHJhY2UpO1xuICAgIHRoaXMuZGVidWcgPSBjb25zdHJ1Y3RQZXJmb3JtZXIodGhpcywgXy5iaW5kKGNvbnNvbGUuZGVidWcgPyBjb25zb2xlLmRlYnVnIDogY29uc29sZS5sb2csIGNvbnNvbGUpLCBMb2dnZXIuTGV2ZWwuZGVidWcpO1xuICAgIHRoaXMuaW5mbyA9IGNvbnN0cnVjdFBlcmZvcm1lcih0aGlzLCBfLmJpbmQoY29uc29sZS5pbmZvID8gY29uc29sZS5pbmZvIDogY29uc29sZS5sb2csIGNvbnNvbGUpLCBMb2dnZXIuTGV2ZWwuaW5mbyk7XG4gICAgdGhpcy5sb2cgPSBjb25zdHJ1Y3RQZXJmb3JtZXIodGhpcywgXy5iaW5kKGNvbnNvbGUubG9nID8gY29uc29sZS5sb2cgOiBjb25zb2xlLmxvZywgY29uc29sZSksIExvZ2dlci5MZXZlbC5pbmZvKTtcbiAgICB0aGlzLndhcm4gPSBjb25zdHJ1Y3RQZXJmb3JtZXIodGhpcywgXy5iaW5kKGNvbnNvbGUud2FybiA/IGNvbnNvbGUud2FybiA6IGNvbnNvbGUubG9nLCBjb25zb2xlKSwgTG9nZ2VyLkxldmVsLndhcm5pbmcpO1xuICAgIHRoaXMuZXJyb3IgPSBjb25zdHJ1Y3RQZXJmb3JtZXIodGhpcywgXy5iaW5kKGNvbnNvbGUuZXJyb3IgPyBjb25zb2xlLmVycm9yIDogY29uc29sZS5sb2csIGNvbnNvbGUpLCBMb2dnZXIuTGV2ZWwuZXJyb3IpO1xuICAgIHRoaXMuZmF0YWwgPSBjb25zdHJ1Y3RQZXJmb3JtZXIodGhpcywgXy5iaW5kKGNvbnNvbGUuZXJyb3IgPyBjb25zb2xlLmVycm9yIDogY29uc29sZS5sb2csIGNvbnNvbGUpLCBMb2dnZXIuTGV2ZWwuZmF0YWwpO1xuXG59XG5cbkxvZ2dlci5MZXZlbCA9IHtcbiAgICB0cmFjZTogMCxcbiAgICBkZWJ1ZzogMSxcbiAgICBpbmZvOiAyLFxuICAgIHdhcm5pbmc6IDMsXG4gICAgd2FybjogMyxcbiAgICBlcnJvcjogNCxcbiAgICBmYXRhbDogNVxufTtcblxuZnVuY3Rpb24gY29uc3RydWN0UGVyZm9ybWVyKGxvZ2dlciwgZiwgbGV2ZWwpIHtcbiAgICB2YXIgcGVyZm9ybWVyID0gZnVuY3Rpb24gKG1lc3NhZ2UpIHtcbiAgICAgICAgbG9nZ2VyLnBlcmZvcm1Mb2coZiwgbGV2ZWwsIG1lc3NhZ2UsIGFyZ3VtZW50cyk7XG4gICAgfTtcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkocGVyZm9ybWVyLCAnaXNFbmFibGVkJywge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHZhciBjdXJyZW50TGV2ZWwgPSBsb2dnZXIuY3VycmVudExldmVsKCk7XG4gICAgICAgICAgICByZXR1cm4gbGV2ZWwgPj0gY3VycmVudExldmVsO1xuICAgICAgICB9LFxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICB9KTtcbiAgICBwZXJmb3JtZXIuZiA9IGY7XG4gICAgcGVyZm9ybWVyLmxvZ2dlciA9IGxvZ2dlcjtcbiAgICBwZXJmb3JtZXIubGV2ZWwgPSBsZXZlbDtcbiAgICByZXR1cm4gcGVyZm9ybWVyO1xufVxuXG5cbkxvZ2dlci5MZXZlbFRleHQgPSB7fTtcbkxvZ2dlci5MZXZlbFRleHQgW0xvZ2dlci5MZXZlbC50cmFjZV0gPSAnVFJBQ0UnO1xuTG9nZ2VyLkxldmVsVGV4dCBbTG9nZ2VyLkxldmVsLmRlYnVnXSA9ICdERUJVRyc7XG5Mb2dnZXIuTGV2ZWxUZXh0IFtMb2dnZXIuTGV2ZWwuaW5mb10gPSAnSU5GTyAnO1xuTG9nZ2VyLkxldmVsVGV4dCBbTG9nZ2VyLkxldmVsLndhcm5pbmddID0gJ1dBUk4gJztcbkxvZ2dlci5MZXZlbFRleHQgW0xvZ2dlci5MZXZlbC5lcnJvcl0gPSAnRVJST1InO1xuXG5Mb2dnZXIubGV2ZWxBc1RleHQgPSBmdW5jdGlvbiAobGV2ZWwpIHtcbiAgICByZXR1cm4gdGhpcy5MZXZlbFRleHRbbGV2ZWxdO1xufTtcblxuTG9nZ2VyLmxvZ2dlcldpdGhOYW1lID0gZnVuY3Rpb24gKG5hbWUpIHtcbiAgICByZXR1cm4gbmV3IExvZ2dlcihuYW1lKTtcbn07XG5cbkxvZ2dlci5wcm90b3R5cGUuY3VycmVudExldmVsID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBsb2dMZXZlbCA9IGxvZ0xldmVsc1t0aGlzLm5hbWVdO1xuICAgIHJldHVybiBsb2dMZXZlbCA/IGxvZ0xldmVsIDogTG9nZ2VyLkxldmVsLnRyYWNlO1xufTtcblxuTG9nZ2VyLnByb3RvdHlwZS5zZXRMZXZlbCA9IGZ1bmN0aW9uIChsZXZlbCkge1xuICAgIGxvZ0xldmVsc1t0aGlzLm5hbWVdID0gbGV2ZWw7XG59O1xuXG5Mb2dnZXIucHJvdG90eXBlLm92ZXJyaWRlID0gZnVuY3Rpb24gKGxldmVsLCBvdmVycmlkZSwgbWVzc2FnZSkge1xuICAgIHZhciBsZXZlbEFzVGV4dCA9IExvZ2dlci5sZXZlbEFzVGV4dChsZXZlbCk7XG4gICAgdmFyIHBlcmZvcm1lciA9IHRoaXNbbGV2ZWxBc1RleHQudHJpbSgpLnRvTG93ZXJDYXNlKCldO1xuICAgIHZhciBmID0gcGVyZm9ybWVyLmY7XG4gICAgdmFyIG90aGVyQXJndW1lbnRzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAzLCBhcmd1bWVudHMubGVuZ3RoKTtcbiAgICB0aGlzLnBlcmZvcm1Mb2coZiwgbGV2ZWwsIG1lc3NhZ2UsIG90aGVyQXJndW1lbnRzLCBvdmVycmlkZSk7XG59O1xuXG5Mb2dnZXIucHJvdG90eXBlLnBlcmZvcm1Mb2cgPSBmdW5jdGlvbiAobG9nRnVuYywgbGV2ZWwsIG1lc3NhZ2UsIG90aGVyQXJndW1lbnRzLCBvdmVycmlkZSkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB2YXIgY3VycmVudExldmVsID0gb3ZlcnJpZGUgIT09IHVuZGVmaW5lZCA/IG92ZXJyaWRlIDogdGhpcy5jdXJyZW50TGV2ZWwoKTtcbiAgICBpZiAoY3VycmVudExldmVsIDw9IGxldmVsKSB7XG4gICAgICAgIGxvZ0Z1bmMgPSBfLnBhcnRpYWwobG9nRnVuYywgTG9nZ2VyLmxldmVsQXNUZXh0KGxldmVsKSArICcgWycgKyBzZWxmLm5hbWUgKyAnXTogJyArIG1lc3NhZ2UpO1xuICAgICAgICB2YXIgYXJncyA9IFtdO1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IG90aGVyQXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBhcmdzW2ldID0gb3RoZXJBcmd1bWVudHNbaV07XG4gICAgICAgIH1cbiAgICAgICAgYXJncy5zcGxpY2UoMCwgMSk7XG4gICAgICAgIGxvZ0Z1bmMuYXBwbHkobG9nRnVuYywgYXJncyk7XG4gICAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBMb2dnZXI7XG4iLCIvKipcbiAqIEBtb2R1bGUgcmVsYXRpb25zaGlwc1xuICovXG5cbnZhciBSZWxhdGlvbnNoaXBQcm94eSA9IHJlcXVpcmUoJy4vUmVsYXRpb25zaGlwUHJveHknKSxcbiAgICBTdG9yZSA9IHJlcXVpcmUoJy4vc3RvcmUnKSxcbiAgICB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyksXG4gICAgXyA9IHV0aWwuXyxcbiAgICBJbnRlcm5hbFNpZXN0YUVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpLkludGVybmFsU2llc3RhRXJyb3IsXG4gICAgbW9kZWxFdmVudHMgPSByZXF1aXJlKCcuL21vZGVsRXZlbnRzJyksXG4gICAgZXZlbnRzID0gcmVxdWlyZSgnLi9ldmVudHMnKSxcbiAgICB3cmFwQXJyYXlGb3JBdHRyaWJ1dGVzID0gZXZlbnRzLndyYXBBcnJheSxcbiAgICBTaWVzdGFNb2RlbCA9IHJlcXVpcmUoJy4vbW9kZWxJbnN0YW5jZScpLFxuICAgIEFycmF5T2JzZXJ2ZXIgPSByZXF1aXJlKCcuLi92ZW5kb3Ivb2JzZXJ2ZS1qcy9zcmMvb2JzZXJ2ZScpLkFycmF5T2JzZXJ2ZXIsXG4gICAgTW9kZWxFdmVudFR5cGUgPSByZXF1aXJlKCcuL21vZGVsRXZlbnRzJykuTW9kZWxFdmVudFR5cGU7XG5cbi8qKlxuICogW01hbnlUb01hbnlQcm94eSBkZXNjcmlwdGlvbl1cbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRzXG4gKi9cbmZ1bmN0aW9uIE1hbnlUb01hbnlQcm94eShvcHRzKSB7XG4gICAgUmVsYXRpb25zaGlwUHJveHkuY2FsbCh0aGlzLCBvcHRzKTtcbiAgICB0aGlzLnJlbGF0ZWQgPSBbXTtcbiAgICB0aGlzLnJlbGF0ZWRDYW5jZWxMaXN0ZW5lcnMgPSB7fTtcbn1cblxuTWFueVRvTWFueVByb3h5LnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoUmVsYXRpb25zaGlwUHJveHkucHJvdG90eXBlKTtcblxuXy5leHRlbmQoTWFueVRvTWFueVByb3h5LnByb3RvdHlwZSwge1xuICAgIGNsZWFyUmV2ZXJzZTogZnVuY3Rpb24gKHJlbW92ZWQpIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICBfLmVhY2gocmVtb3ZlZCwgZnVuY3Rpb24gKHJlbW92ZWRPYmplY3QpIHtcbiAgICAgICAgICAgIHZhciByZXZlcnNlUHJveHkgPSBzZWxmLnJldmVyc2VQcm94eUZvckluc3RhbmNlKHJlbW92ZWRPYmplY3QpO1xuICAgICAgICAgICAgdmFyIGlkeCA9IHJldmVyc2VQcm94eS5yZWxhdGVkLmluZGV4T2Yoc2VsZi5vYmplY3QpO1xuICAgICAgICAgICAgcmV2ZXJzZVByb3h5Lm1ha2VDaGFuZ2VzVG9SZWxhdGVkV2l0aG91dE9ic2VydmF0aW9ucyhmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcmV2ZXJzZVByb3h5LnNwbGljZShpZHgsIDEpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH0sXG4gICAgc2V0UmV2ZXJzZU9mQWRkZWQ6IGZ1bmN0aW9uIChhZGRlZCkge1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgIF8uZWFjaChhZGRlZCwgZnVuY3Rpb24gKGFkZGVkT2JqZWN0KSB7XG4gICAgICAgICAgICB2YXIgcmV2ZXJzZVByb3h5ID0gc2VsZi5yZXZlcnNlUHJveHlGb3JJbnN0YW5jZShhZGRlZE9iamVjdCk7XG4gICAgICAgICAgICByZXZlcnNlUHJveHkubWFrZUNoYW5nZXNUb1JlbGF0ZWRXaXRob3V0T2JzZXJ2YXRpb25zKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICByZXZlcnNlUHJveHkuc3BsaWNlKDAsIDAsIHNlbGYub2JqZWN0KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICB9LFxuICAgIHdyYXBBcnJheTogZnVuY3Rpb24gKGFycikge1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgIHdyYXBBcnJheUZvckF0dHJpYnV0ZXMoYXJyLCB0aGlzLnJldmVyc2VOYW1lLCB0aGlzLm9iamVjdCk7XG4gICAgICAgIGlmICghYXJyLmFycmF5T2JzZXJ2ZXIpIHtcbiAgICAgICAgICAgIGFyci5hcnJheU9ic2VydmVyID0gbmV3IEFycmF5T2JzZXJ2ZXIoYXJyKTtcbiAgICAgICAgICAgIHZhciBvYnNlcnZlckZ1bmN0aW9uID0gZnVuY3Rpb24gKHNwbGljZXMpIHtcbiAgICAgICAgICAgICAgICBzcGxpY2VzLmZvckVhY2goZnVuY3Rpb24gKHNwbGljZSkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgYWRkZWQgPSBzcGxpY2UuYWRkZWRDb3VudCA/IGFyci5zbGljZShzcGxpY2UuaW5kZXgsIHNwbGljZS5pbmRleCArIHNwbGljZS5hZGRlZENvdW50KSA6IFtdO1xuICAgICAgICAgICAgICAgICAgICB2YXIgcmVtb3ZlZCA9IHNwbGljZS5yZW1vdmVkO1xuICAgICAgICAgICAgICAgICAgICBzZWxmLmNsZWFyUmV2ZXJzZShyZW1vdmVkKTtcbiAgICAgICAgICAgICAgICAgICAgc2VsZi5zZXRSZXZlcnNlT2ZBZGRlZChhZGRlZCk7XG4gICAgICAgICAgICAgICAgICAgIHZhciBtb2RlbCA9IHNlbGYuZ2V0Rm9yd2FyZE1vZGVsKCk7XG4gICAgICAgICAgICAgICAgICAgIG1vZGVsRXZlbnRzLmVtaXQoe1xuICAgICAgICAgICAgICAgICAgICAgICAgY29sbGVjdGlvbjogbW9kZWwuY29sbGVjdGlvbk5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBtb2RlbDogbW9kZWwubmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIF9pZDogc2VsZi5vYmplY3QuX2lkLFxuICAgICAgICAgICAgICAgICAgICAgICAgZmllbGQ6IHNlbGYuZ2V0Rm9yd2FyZE5hbWUoKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlbW92ZWQ6IHJlbW92ZWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBhZGRlZDogYWRkZWQsXG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiBNb2RlbEV2ZW50VHlwZS5TcGxpY2UsXG4gICAgICAgICAgICAgICAgICAgICAgICBpbmRleDogc3BsaWNlLmluZGV4LFxuICAgICAgICAgICAgICAgICAgICAgICAgb2JqOiBzZWxmLm9iamVjdFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBhcnIuYXJyYXlPYnNlcnZlci5vcGVuKG9ic2VydmVyRnVuY3Rpb24pO1xuICAgICAgICB9XG4gICAgfSxcbiAgICBnZXQ6IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgICAgICB2YXIgZGVmZXJyZWQgPSB1dGlsLmRlZmVyKGNhbGxiYWNrKTtcbiAgICAgICAgY2FsbGJhY2sgPSBkZWZlcnJlZC5maW5pc2guYmluZChkZWZlcnJlZCk7XG4gICAgICAgIGNhbGxiYWNrKG51bGwsIHRoaXMucmVsYXRlZCk7XG4gICAgICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xuICAgIH0sXG4gICAgdmFsaWRhdGU6IGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgaWYgKE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChvYmopICE9ICdbb2JqZWN0IEFycmF5XScpIHtcbiAgICAgICAgICAgIHJldHVybiAnQ2Fubm90IGFzc2lnbiBzY2FsYXIgdG8gbWFueSB0byBtYW55JztcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24gKG9iaiwgb3B0cykge1xuICAgICAgICB0aGlzLmNoZWNrSW5zdGFsbGVkKCk7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgaWYgKG9iaikge1xuICAgICAgICAgICAgdmFyIGVycm9yTWVzc2FnZTtcbiAgICAgICAgICAgIGlmIChlcnJvck1lc3NhZ2UgPSB0aGlzLnZhbGlkYXRlKG9iaikpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZXJyb3JNZXNzYWdlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5jbGVhclJldmVyc2VSZWxhdGVkKG9wdHMpO1xuICAgICAgICAgICAgICAgIHNlbGYuc2V0SWRBbmRSZWxhdGVkKG9iaiwgb3B0cyk7XG4gICAgICAgICAgICAgICAgdGhpcy53cmFwQXJyYXkob2JqKTtcbiAgICAgICAgICAgICAgICBzZWxmLnNldElkQW5kUmVsYXRlZFJldmVyc2Uob2JqLCBvcHRzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuY2xlYXJSZXZlcnNlUmVsYXRlZChvcHRzKTtcbiAgICAgICAgICAgIHNlbGYuc2V0SWRBbmRSZWxhdGVkKG9iaiwgb3B0cyk7XG4gICAgICAgIH1cbiAgICB9LFxuICAgIGluc3RhbGw6IGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgUmVsYXRpb25zaGlwUHJveHkucHJvdG90eXBlLmluc3RhbGwuY2FsbCh0aGlzLCBvYmopO1xuICAgICAgICB0aGlzLndyYXBBcnJheSh0aGlzLnJlbGF0ZWQpO1xuICAgICAgICBvYmpbKCdzcGxpY2UnICsgdXRpbC5jYXBpdGFsaXNlRmlyc3RMZXR0ZXIodGhpcy5yZXZlcnNlTmFtZSkpXSA9IF8uYmluZCh0aGlzLnNwbGljZSwgdGhpcyk7XG4gICAgfSxcbiAgICByZWdpc3RlclJlbW92YWxMaXN0ZW5lcjogZnVuY3Rpb24gKG9iaikge1xuICAgICAgICB0aGlzLnJlbGF0ZWRDYW5jZWxMaXN0ZW5lcnNbb2JqLl9pZF0gPSBvYmoubGlzdGVuKGZ1bmN0aW9uIChlKSB7XG5cbiAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICB9XG59KTtcblxuXG5tb2R1bGUuZXhwb3J0cyA9IE1hbnlUb01hbnlQcm94eTsiLCIvKipcbiAqIEBtb2R1bGUgbWFwcGluZ1xuICovXG5cbnZhciBTdG9yZSA9IHJlcXVpcmUoJy4vc3RvcmUnKSxcbiAgICBTaWVzdGFNb2RlbCA9IHJlcXVpcmUoJy4vbW9kZWxJbnN0YW5jZScpLFxuICAgIGxvZyA9IHJlcXVpcmUoJy4vbG9nJyksXG4gICAgSW50ZXJuYWxTaWVzdGFFcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKS5JbnRlcm5hbFNpZXN0YUVycm9yLFxuICAgIGNhY2hlID0gcmVxdWlyZSgnLi9jYWNoZScpLFxuICAgIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKSxcbiAgICBfID0gdXRpbC5fLFxuICAgIGFzeW5jID0gdXRpbC5hc3luYyxcbiAgICBNb2RlbEV2ZW50VHlwZSA9IHJlcXVpcmUoJy4vbW9kZWxFdmVudHMnKS5Nb2RlbEV2ZW50VHlwZTtcblxudmFyIExvZ2dlciA9IGxvZy5sb2dnZXJXaXRoTmFtZSgnTWFwcGluZycpO1xuTG9nZ2VyLnNldExldmVsKGxvZy5MZXZlbC50cmFjZSk7XG5cbmZ1bmN0aW9uIFNpZXN0YUVycm9yKG9wdHMpIHtcbiAgICB0aGlzLm9wdHMgPSBvcHRzO1xufVxuU2llc3RhRXJyb3IucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh0aGlzLm9wdHMsIG51bGwsIDQpO1xufTtcblxuXG4vKipcbiAqIEVuY2Fwc3VsYXRlcyB0aGUgaWRlYSBvZiBtYXBwaW5nIGFycmF5cyBvZiBkYXRhIG9udG8gdGhlIG9iamVjdCBncmFwaCBvciBhcnJheXMgb2Ygb2JqZWN0cy5cbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRzXG4gKiBAcGFyYW0gb3B0cy5tb2RlbFxuICogQHBhcmFtIG9wdHMuZGF0YVxuICogQHBhcmFtIG9wdHMub2JqZWN0c1xuICogQHBhcmFtIG9wdHMuZGlzYWJsZU5vdGlmaWNhdGlvbnNcbiAqL1xuZnVuY3Rpb24gTWFwcGluZ09wZXJhdGlvbihvcHRzKSB7XG4gICAgdGhpcy5fb3B0cyA9IG9wdHM7XG5cbiAgICB1dGlsLmV4dGVuZEZyb21PcHRzKHRoaXMsIG9wdHMsIHtcbiAgICAgICAgbW9kZWw6IG51bGwsXG4gICAgICAgIGRhdGE6IG51bGwsXG4gICAgICAgIG9iamVjdHM6IFtdLFxuICAgICAgICBkaXNhYmxlZXZlbnRzOiBmYWxzZSxcbiAgICAgICAgX2lnbm9yZUluc3RhbGxlZDogZmFsc2UsXG4gICAgICAgIGNhbGxJbml0OiB0cnVlXG4gICAgfSk7XG5cbiAgICBfLmV4dGVuZCh0aGlzLCB7XG4gICAgICAgIGVycm9yczogW10sXG4gICAgICAgIHN1YlRhc2tSZXN1bHRzOiB7fSxcbiAgICAgICAgX25ld09iamVjdHM6IFtdXG4gICAgfSk7XG59XG5cblxuXy5leHRlbmQoTWFwcGluZ09wZXJhdGlvbi5wcm90b3R5cGUsIHtcbiAgICBtYXBBdHRyaWJ1dGVzOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5kYXRhLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB2YXIgZGF0dW0gPSB0aGlzLmRhdGFbaV07XG4gICAgICAgICAgICB2YXIgb2JqZWN0ID0gdGhpcy5vYmplY3RzW2ldO1xuICAgICAgICAgICAgLy8gTm8gcG9pbnQgbWFwcGluZyBvYmplY3Qgb250byBpdHNlbGYuIFRoaXMgaGFwcGVucyBpZiBhIE1vZGVsSW5zdGFuY2UgaXMgcGFzc2VkIGFzIGEgcmVsYXRpb25zaGlwLlxuICAgICAgICAgICAgaWYgKGRhdHVtICE9IG9iamVjdCkge1xuICAgICAgICAgICAgICAgIGlmIChvYmplY3QpIHsgLy8gSWYgb2JqZWN0IGlzIGZhbHN5LCB0aGVuIHRoZXJlIHdhcyBhbiBlcnJvciBsb29raW5nIHVwIHRoYXQgb2JqZWN0L2NyZWF0aW5nIGl0LlxuICAgICAgICAgICAgICAgICAgICB2YXIgZmllbGRzID0gdGhpcy5tb2RlbC5fYXR0cmlidXRlTmFtZXM7XG4gICAgICAgICAgICAgICAgICAgIF8uZWFjaChmaWVsZHMsIGZ1bmN0aW9uIChmKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZGF0dW1bZl0gIT09IHVuZGVmaW5lZCkgeyAvLyBudWxsIGlzIGZpbmVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBJZiBldmVudHMgYXJlIGRpc2FibGVkIHdlIHVwZGF0ZSBfX3ZhbHVlcyBvYmplY3QgZGlyZWN0bHkuIFRoaXMgYXZvaWRzIHRyaWdnZXJpbmdcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBldmVudHMgd2hpY2ggYXJlIGJ1aWx0IGludG8gdGhlIHNldCBmdW5jdGlvbiBvZiB0aGUgcHJvcGVydHkuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuZGlzYWJsZWV2ZW50cykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvYmplY3QuX192YWx1ZXNbZl0gPSBkYXR1bVtmXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9iamVjdFtmXSA9IGRhdHVtW2ZdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgICAgICAgICAgICAgICAgLy8gUG91Y2hEQiByZXZpc2lvbiAoaWYgdXNpbmcgc3RvcmFnZSBtb2R1bGUpLlxuICAgICAgICAgICAgICAgICAgICAvLyBUT0RPOiBDYW4gdGhpcyBiZSBwdWxsZWQgb3V0IG9mIGNvcmU/XG4gICAgICAgICAgICAgICAgICAgIGlmIChkYXR1bS5fcmV2KSBvYmplY3QuX3JldiA9IGRhdHVtLl9yZXY7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSxcbiAgICBfbWFwOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgdmFyIGVycjtcbiAgICAgICAgdGhpcy5tYXBBdHRyaWJ1dGVzKCk7XG4gICAgICAgIHZhciByZWxhdGlvbnNoaXBGaWVsZHMgPSBfLmtleXMoc2VsZi5zdWJUYXNrUmVzdWx0cyk7XG4gICAgICAgIF8uZWFjaChyZWxhdGlvbnNoaXBGaWVsZHMsIGZ1bmN0aW9uIChmKSB7XG4gICAgICAgICAgICB2YXIgcmVzID0gc2VsZi5zdWJUYXNrUmVzdWx0c1tmXTtcbiAgICAgICAgICAgIHZhciBpbmRleGVzID0gcmVzLmluZGV4ZXMsXG4gICAgICAgICAgICAgICAgb2JqZWN0cyA9IHJlcy5vYmplY3RzO1xuICAgICAgICAgICAgdmFyIHJlbGF0ZWREYXRhID0gc2VsZi5nZXRSZWxhdGVkRGF0YShmKS5yZWxhdGVkRGF0YTtcbiAgICAgICAgICAgIHZhciB1bmZsYXR0ZW5lZE9iamVjdHMgPSB1dGlsLnVuZmxhdHRlbkFycmF5KG9iamVjdHMsIHJlbGF0ZWREYXRhKTtcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdW5mbGF0dGVuZWRPYmplY3RzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgdmFyIGlkeCA9IGluZGV4ZXNbaV07XG4gICAgICAgICAgICAgICAgLy8gRXJyb3JzIGFyZSBwbHVja2VkIGZyb20gdGhlIHN1Ym9wZXJhdGlvbnMuXG4gICAgICAgICAgICAgICAgdmFyIGVycm9yID0gc2VsZi5lcnJvcnNbaWR4XTtcbiAgICAgICAgICAgICAgICBlcnIgPSBlcnJvciA/IGVycm9yW2ZdIDogbnVsbDtcbiAgICAgICAgICAgICAgICBpZiAoIWVycikge1xuICAgICAgICAgICAgICAgICAgICB2YXIgcmVsYXRlZCA9IHVuZmxhdHRlbmVkT2JqZWN0c1tpXTsgLy8gQ2FuIGJlIGFycmF5IG9yIHNjYWxhci5cbiAgICAgICAgICAgICAgICAgICAgdmFyIG9iamVjdCA9IHNlbGYub2JqZWN0c1tpZHhdO1xuICAgICAgICAgICAgICAgICAgICBpZiAob2JqZWN0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBlcnIgPSBvYmplY3QuX19wcm94aWVzW2ZdLnNldChyZWxhdGVkLCB7ZGlzYWJsZWV2ZW50czogc2VsZi5kaXNhYmxlZXZlbnRzfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFzZWxmLmVycm9yc1tpZHhdKSBzZWxmLmVycm9yc1tpZHhdID0ge307XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc2VsZi5lcnJvcnNbaWR4XVtmXSA9IGVycjtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBGb3IgaW5kaWNlcyB3aGVyZSBubyBvYmplY3QgaXMgcHJlc2VudCwgcGVyZm9ybSBsb29rdXBzLCBjcmVhdGluZyBhIG5ldyBvYmplY3QgaWYgbmVjZXNzYXJ5LlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2xvb2t1cDogZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgICAgIHZhciBkZWZlcnJlZCA9IHV0aWwuZGVmZXIoY2FsbGJhY2spO1xuICAgICAgICBjYWxsYmFjayA9IGRlZmVycmVkLmZpbmlzaC5iaW5kKGRlZmVycmVkKTtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICB2YXIgcmVtb3RlTG9va3VwcyA9IFtdO1xuICAgICAgICB2YXIgbG9jYWxMb29rdXBzID0gW107XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5kYXRhLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAoIXRoaXMub2JqZWN0c1tpXSkge1xuICAgICAgICAgICAgICAgIHZhciBsb29rdXA7XG4gICAgICAgICAgICAgICAgdmFyIGRhdHVtID0gdGhpcy5kYXRhW2ldO1xuICAgICAgICAgICAgICAgIHZhciBpc1NjYWxhciA9IHR5cGVvZiBkYXR1bSA9PSAnc3RyaW5nJyB8fCB0eXBlb2YgZGF0dW0gPT0gJ251bWJlcicgfHwgZGF0dW0gaW5zdGFuY2VvZiBTdHJpbmc7XG4gICAgICAgICAgICAgICAgaWYgKGRhdHVtKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChpc1NjYWxhcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9va3VwID0ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGluZGV4OiBpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdHVtOiB7fVxuICAgICAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvb2t1cC5kYXR1bVtzZWxmLm1vZGVsLmlkXSA9IGRhdHVtO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVtb3RlTG9va3Vwcy5wdXNoKGxvb2t1cCk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoZGF0dW0gaW5zdGFuY2VvZiBTaWVzdGFNb2RlbCkgeyAvLyBXZSB3b24ndCBuZWVkIHRvIHBlcmZvcm0gYW55IG1hcHBpbmcuXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLm9iamVjdHNbaV0gPSBkYXR1bTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChkYXR1bS5faWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvY2FsTG9va3Vwcy5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbmRleDogaSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkYXR1bTogZGF0dW1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGRhdHVtW3NlbGYubW9kZWwuaWRdKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZW1vdGVMb29rdXBzLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGluZGV4OiBpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdHVtOiBkYXR1bVxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLm9iamVjdHNbaV0gPSBzZWxmLl9uZXcoKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMub2JqZWN0c1tpXSA9IG51bGw7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHV0aWwuYXN5bmMucGFyYWxsZWwoW1xuICAgICAgICAgICAgICAgIGZ1bmN0aW9uIChkb25lKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBsb2NhbElkZW50aWZpZXJzID0gXy5wbHVjayhfLnBsdWNrKGxvY2FsTG9va3VwcywgJ2RhdHVtJyksICdfaWQnKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGxvY2FsSWRlbnRpZmllcnMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBTdG9yZS5nZXRNdWx0aXBsZUxvY2FsKGxvY2FsSWRlbnRpZmllcnMsIGZ1bmN0aW9uIChlcnIsIG9iamVjdHMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxvY2FsSWRlbnRpZmllcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBvYmogPSBvYmplY3RzW2ldO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIF9pZCA9IGxvY2FsSWRlbnRpZmllcnNbaV07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgbG9va3VwID0gbG9jYWxMb29rdXBzW2ldO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFvYmopIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBJZiB0aGVyZSBhcmUgbXVsdGlwbGUgbWFwcGluZyBvcGVyYXRpb25zIGdvaW5nIG9uLCB0aGVyZSBtYXkgYmVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvYmogPSBjYWNoZS5nZXQoe19pZDogX2lkfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFvYmopXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9iaiA9IHNlbGYuX25ldyh7X2lkOiBfaWR9LCAhc2VsZi5kaXNhYmxlZXZlbnRzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZWxmLm9iamVjdHNbbG9va3VwLmluZGV4XSA9IG9iajtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2VsZi5vYmplY3RzW2xvb2t1cC5pbmRleF0gPSBvYmo7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZG9uZShlcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkb25lKCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGZ1bmN0aW9uIChkb25lKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciByZW1vdGVJZGVudGlmaWVycyA9IF8ucGx1Y2soXy5wbHVjayhyZW1vdGVMb29rdXBzLCAnZGF0dW0nKSwgc2VsZi5tb2RlbC5pZCk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChyZW1vdGVJZGVudGlmaWVycy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIExvZ2dlci50cmFjZSgnTG9va2luZyB1cCByZW1vdGVJZGVudGlmaWVyczogJyArIHV0aWwucHJldHR5UHJpbnQocmVtb3RlSWRlbnRpZmllcnMpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIFN0b3JlLmdldE11bHRpcGxlUmVtb3RlKHJlbW90ZUlkZW50aWZpZXJzLCBzZWxmLm1vZGVsLCBmdW5jdGlvbiAoZXJyLCBvYmplY3RzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKExvZ2dlci50cmFjZS5pc0VuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciByZXN1bHRzID0ge307XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgb2JqZWN0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc3VsdHNbcmVtb3RlSWRlbnRpZmllcnNbaV1dID0gb2JqZWN0c1tpXSA/IG9iamVjdHNbaV0uX2lkIDogbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIExvZ2dlci50cmFjZSgnUmVzdWx0cyBmb3IgcmVtb3RlSWRlbnRpZmllcnM6ICcgKyB1dGlsLnByZXR0eVByaW50KHJlc3VsdHMpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgb2JqZWN0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG9iaiA9IG9iamVjdHNbaV07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgbG9va3VwID0gcmVtb3RlTG9va3Vwc1tpXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChvYmopIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZWxmLm9iamVjdHNbbG9va3VwLmluZGV4XSA9IG9iajtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGRhdGEgPSB7fTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgcmVtb3RlSWQgPSByZW1vdGVJZGVudGlmaWVyc1tpXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkYXRhW3NlbGYubW9kZWwuaWRdID0gcmVtb3RlSWQ7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGNhY2hlUXVlcnkgPSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1vZGVsOiBzZWxmLm1vZGVsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYWNoZVF1ZXJ5W3NlbGYubW9kZWwuaWRdID0gcmVtb3RlSWQ7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGNhY2hlZCA9IGNhY2hlLmdldChjYWNoZVF1ZXJ5KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoY2FjaGVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYub2JqZWN0c1tsb29rdXAuaW5kZXhdID0gY2FjaGVkO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYub2JqZWN0c1tsb29rdXAuaW5kZXhdID0gc2VsZi5fbmV3KCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIEl0J3MgaW1wb3J0YW50IHRoYXQgd2UgbWFwIHRoZSByZW1vdGUgaWRlbnRpZmllciBoZXJlIHRvIGVuc3VyZSB0aGF0IGl0IGVuZHNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gdXAgaW4gdGhlIGNhY2hlLlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZWxmLm9iamVjdHNbbG9va3VwLmluZGV4XVtzZWxmLm1vZGVsLmlkXSA9IHJlbW90ZUlkO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkb25lKGVycik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRvbmUoKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgICBjYWxsYmFjayk7XG4gICAgICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xuICAgIH0sXG4gICAgX2xvb2t1cFNpbmdsZXRvbjogZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgICAgIHZhciBkZWZlcnJlZCA9IHV0aWwuZGVmZXIoY2FsbGJhY2spO1xuICAgICAgICBjYWxsYmFjayA9IGRlZmVycmVkLmZpbmlzaC5iaW5kKGRlZmVycmVkKTtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICAvLyBQaWNrIGEgcmFuZG9tIF9pZCBmcm9tIHRoZSBhcnJheSBvZiBkYXRhIGJlaW5nIG1hcHBlZCBvbnRvIHRoZSBzaW5nbGV0b24gb2JqZWN0LiBOb3RlIHRoYXQgdGhleSBzaG91bGRcbiAgICAgICAgLy8gYWx3YXlzIGJlIHRoZSBzYW1lLiBUaGlzIGlzIGp1c3QgYSBwcmVjYXV0aW9uLlxuICAgICAgICB2YXIgX2lkcyA9IF8ucGx1Y2soc2VsZi5kYXRhLCAnX2lkJyksXG4gICAgICAgICAgICBfaWQ7XG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBfaWRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAoX2lkc1tpXSkge1xuICAgICAgICAgICAgICAgIF9pZCA9IHtfaWQ6IF9pZHNbaV19O1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8vIFRoZSBtYXBwaW5nIG9wZXJhdGlvbiBpcyByZXNwb25zaWJsZSBmb3IgY3JlYXRpbmcgc2luZ2xldG9uIGluc3RhbmNlcyBpZiB0aGV5IGRvIG5vdCBhbHJlYWR5IGV4aXN0LlxuICAgICAgICB2YXIgc2luZ2xldG9uID0gY2FjaGUuZ2V0U2luZ2xldG9uKHRoaXMubW9kZWwpIHx8IHRoaXMuX25ldyhfaWQpO1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHNlbGYuZGF0YS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgc2VsZi5vYmplY3RzW2ldID0gc2luZ2xldG9uO1xuICAgICAgICB9XG4gICAgICAgIGNhbGxiYWNrKCk7XG4gICAgICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xuICAgIH0sXG4gICAgX25ldzogZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgbW9kZWwgPSB0aGlzLm1vZGVsLFxuICAgICAgICAgICAgbW9kZWxJbnN0YW5jZSA9IG1vZGVsLl9uZXcuYXBwbHkobW9kZWwsIGFyZ3VtZW50cyk7XG4gICAgICAgIHRoaXMuX25ld09iamVjdHMucHVzaChtb2RlbEluc3RhbmNlKTtcbiAgICAgICAgcmV0dXJuIG1vZGVsSW5zdGFuY2U7XG4gICAgfSxcbiAgICBzdGFydDogZnVuY3Rpb24gKGRvbmUpIHtcbiAgICAgICAgaWYgKHRoaXMuZGF0YS5sZW5ndGgpIHtcbiAgICAgICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgICAgIHZhciB0YXNrcyA9IFtdO1xuICAgICAgICAgICAgdmFyIGxvb2t1cEZ1bmMgPSB0aGlzLm1vZGVsLnNpbmdsZXRvbiA/IHRoaXMuX2xvb2t1cFNpbmdsZXRvbiA6IHRoaXMuX2xvb2t1cDtcbiAgICAgICAgICAgIHRhc2tzLnB1c2goXy5iaW5kKGxvb2t1cEZ1bmMsIHRoaXMpKTtcbiAgICAgICAgICAgIHRhc2tzLnB1c2goXy5iaW5kKHRoaXMuX2V4ZWN1dGVTdWJPcGVyYXRpb25zLCB0aGlzKSk7XG4gICAgICAgICAgICB1dGlsLmFzeW5jLnBhcmFsbGVsKHRhc2tzLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgc2VsZi5fbWFwKCk7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gVXNlcnMgYXJlIGFsbG93ZWQgdG8gYWRkIGEgY3VzdG9tIGluaXQgbWV0aG9kIHRvIHRoZSBtZXRob2RzIG9iamVjdCB3aGVuIGRlZmluaW5nIGEgTW9kZWwsIG9mIHRoZSBmb3JtOlxuICAgICAgICAgICAgICAgICAgICAvL1xuICAgICAgICAgICAgICAgICAgICAvL1xuICAgICAgICAgICAgICAgICAgICAvLyBpbml0OiBmdW5jdGlvbiAoW2RvbmVdKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vICAgICAvLyAuLi5cbiAgICAgICAgICAgICAgICAgICAgLy8gIH1cbiAgICAgICAgICAgICAgICAgICAgLy9cbiAgICAgICAgICAgICAgICAgICAgLy9cbiAgICAgICAgICAgICAgICAgICAgLy8gSWYgZG9uZSBpcyBwYXNzZWQsIHRoZW4gX19pbml0IG11c3QgYmUgZXhlY3V0ZWQgYXN5bmNocm9ub3VzbHksIGFuZCB0aGUgbWFwcGluZyBvcGVyYXRpb24gd2lsbCBub3RcbiAgICAgICAgICAgICAgICAgICAgLy8gZmluaXNoIHVudGlsIGFsbCBpbml0cyBoYXZlIGV4ZWN1dGVkLlxuICAgICAgICAgICAgICAgICAgICAvL1xuICAgICAgICAgICAgICAgICAgICAvLyBIZXJlIHdlIGVuc3VyZSB0aGUgZXhlY3V0aW9uIG9mIGFsbCBvZiB0aGVtXG5cbiAgICAgICAgICAgICAgICAgICAgdmFyIGluaXRUYXNrcztcbiAgICAgICAgICAgICAgICAgICAgaWYgKHNlbGYuY2FsbEluaXQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGluaXRUYXNrcyA9IF8ucmVkdWNlKHNlbGYuX25ld09iamVjdHMsIGZ1bmN0aW9uIChtLCBvKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGluaXQgPSBvLm1vZGVsLmluaXQ7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGluaXQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHBhcmFtTmFtZXMgPSB1dGlsLnBhcmFtTmFtZXMoaW5pdCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChwYXJhbU5hbWVzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbS5wdXNoKF8uYmluZChpbml0LCBvLCBkb25lKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbml0LmNhbGwobyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG07XG4gICAgICAgICAgICAgICAgICAgICAgICB9LCBbXSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpbml0VGFza3MgPSBbXTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBhc3luYy5wYXJhbGxlbChpbml0VGFza3MsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRvbmUoc2VsZi5lcnJvcnMubGVuZ3RoID8gc2VsZi5lcnJvcnMgOiBudWxsLCBzZWxmLm9iamVjdHMpO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignY2F1Z2h0IGVycm9yJywgZSk7XG4gICAgICAgICAgICAgICAgICAgIGRvbmUoZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBkb25lKG51bGwsIFtdKTtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgZ2V0UmVsYXRlZERhdGE6IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgICAgIHZhciBpbmRleGVzID0gW107XG4gICAgICAgIHZhciByZWxhdGVkRGF0YSA9IFtdO1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMuZGF0YS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdmFyIGRhdHVtID0gdGhpcy5kYXRhW2ldO1xuICAgICAgICAgICAgaWYgKGRhdHVtKSB7XG4gICAgICAgICAgICAgICAgaWYgKGRhdHVtW25hbWVdKSB7XG4gICAgICAgICAgICAgICAgICAgIGluZGV4ZXMucHVzaChpKTtcbiAgICAgICAgICAgICAgICAgICAgcmVsYXRlZERhdGEucHVzaChkYXR1bVtuYW1lXSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBpbmRleGVzOiBpbmRleGVzLFxuICAgICAgICAgICAgcmVsYXRlZERhdGE6IHJlbGF0ZWREYXRhXG4gICAgICAgIH07XG4gICAgfSxcbiAgICBwcm9jZXNzRXJyb3JzRnJvbVRhc2s6IGZ1bmN0aW9uIChyZWxhdGlvbnNoaXBOYW1lLCBlcnJvcnMsIGluZGV4ZXMpIHtcbiAgICAgICAgaWYgKGVycm9ycy5sZW5ndGgpIHtcbiAgICAgICAgICAgIHZhciByZWxhdGVkRGF0YSA9IHRoaXMuZ2V0UmVsYXRlZERhdGEocmVsYXRpb25zaGlwTmFtZSkucmVsYXRlZERhdGE7XG4gICAgICAgICAgICB2YXIgdW5mbGF0dGVuZWRFcnJvcnMgPSB1dGlsLnVuZmxhdHRlbkFycmF5KGVycm9ycywgcmVsYXRlZERhdGEpO1xuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB1bmZsYXR0ZW5lZEVycm9ycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIHZhciBpZHggPSBpbmRleGVzW2ldO1xuICAgICAgICAgICAgICAgIHZhciBlcnIgPSB1bmZsYXR0ZW5lZEVycm9yc1tpXTtcbiAgICAgICAgICAgICAgICB2YXIgaXNFcnJvciA9IGVycjtcbiAgICAgICAgICAgICAgICBpZiAodXRpbC5pc0FycmF5KGVycikpIGlzRXJyb3IgPSBfLnJlZHVjZShlcnIsIGZ1bmN0aW9uIChtZW1vLCB4KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBtZW1vIHx8IHhcbiAgICAgICAgICAgICAgICB9LCBmYWxzZSk7XG4gICAgICAgICAgICAgICAgaWYgKGlzRXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCF0aGlzLmVycm9yc1tpZHhdKSB0aGlzLmVycm9yc1tpZHhdID0ge307XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZXJyb3JzW2lkeF1bcmVsYXRpb25zaGlwTmFtZV0gPSBlcnI7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSxcbiAgICBfZXhlY3V0ZVN1Yk9wZXJhdGlvbnM6IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXMsXG4gICAgICAgICAgICByZWxhdGlvbnNoaXBOYW1lcyA9IF8ua2V5cyh0aGlzLm1vZGVsLnJlbGF0aW9uc2hpcHMpO1xuICAgICAgICBpZiAocmVsYXRpb25zaGlwTmFtZXMubGVuZ3RoKSB7XG4gICAgICAgICAgICB2YXIgdGFza3MgPSBfLnJlZHVjZShyZWxhdGlvbnNoaXBOYW1lcywgZnVuY3Rpb24gKG0sIHJlbGF0aW9uc2hpcE5hbWUpIHtcbiAgICAgICAgICAgICAgICB2YXIgcmVsYXRpb25zaGlwID0gc2VsZi5tb2RlbC5yZWxhdGlvbnNoaXBzW3JlbGF0aW9uc2hpcE5hbWVdLFxuICAgICAgICAgICAgICAgICAgICByZXZlcnNlTW9kZWwgPSByZWxhdGlvbnNoaXAuZm9yd2FyZE5hbWUgPT0gcmVsYXRpb25zaGlwTmFtZSA/IHJlbGF0aW9uc2hpcC5yZXZlcnNlTW9kZWwgOiByZWxhdGlvbnNoaXAuZm9yd2FyZE1vZGVsO1xuICAgICAgICAgICAgICAgIC8vIE1vY2sgYW55IG1pc3Npbmcgc2luZ2xldG9uIGRhdGEgdG8gZW5zdXJlIHRoYXQgYWxsIHNpbmdsZXRvbiBpbnN0YW5jZXMgYXJlIGNyZWF0ZWQuXG4gICAgICAgICAgICAgICAgaWYgKHJldmVyc2VNb2RlbC5zaW5nbGV0b24gJiYgIXJlbGF0aW9uc2hpcC5pc1JldmVyc2UpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5kYXRhLmZvckVhY2goZnVuY3Rpb24gKGRhdHVtKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWRhdHVtW3JlbGF0aW9uc2hpcE5hbWVdKSBkYXR1bVtyZWxhdGlvbnNoaXBOYW1lXSA9IHt9O1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdmFyIF9fcmV0ID0gdGhpcy5nZXRSZWxhdGVkRGF0YShyZWxhdGlvbnNoaXBOYW1lKSxcbiAgICAgICAgICAgICAgICAgICAgaW5kZXhlcyA9IF9fcmV0LmluZGV4ZXMsXG4gICAgICAgICAgICAgICAgICAgIHJlbGF0ZWREYXRhID0gX19yZXQucmVsYXRlZERhdGE7XG4gICAgICAgICAgICAgICAgaWYgKHJlbGF0ZWREYXRhLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgZmxhdFJlbGF0ZWREYXRhID0gdXRpbC5mbGF0dGVuQXJyYXkocmVsYXRlZERhdGEpO1xuICAgICAgICAgICAgICAgICAgICB2YXIgb3AgPSBuZXcgTWFwcGluZ09wZXJhdGlvbih7XG4gICAgICAgICAgICAgICAgICAgICAgICBtb2RlbDogcmV2ZXJzZU1vZGVsLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGF0YTogZmxhdFJlbGF0ZWREYXRhLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGlzYWJsZWV2ZW50czogc2VsZi5kaXNhYmxlZXZlbnRzLFxuICAgICAgICAgICAgICAgICAgICAgICAgX2lnbm9yZUluc3RhbGxlZDogc2VsZi5faWdub3JlSW5zdGFsbGVkLFxuICAgICAgICAgICAgICAgICAgICAgICAgY2FsbEluaXQ6IHRoaXMuY2FsbEluaXRcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKG9wKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciB0YXNrO1xuICAgICAgICAgICAgICAgICAgICB0YXNrID0gZnVuY3Rpb24gKGRvbmUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG9wLnN0YXJ0KGZ1bmN0aW9uIChlcnJvcnMsIG9iamVjdHMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZWxmLnN1YlRhc2tSZXN1bHRzW3JlbGF0aW9uc2hpcE5hbWVdID0ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlcnJvcnM6IGVycm9ycyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb2JqZWN0czogb2JqZWN0cyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaW5kZXhlczogaW5kZXhlc1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc2VsZi5wcm9jZXNzRXJyb3JzRnJvbVRhc2socmVsYXRpb25zaGlwTmFtZSwgb3AuZXJyb3JzLCBpbmRleGVzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkb25lKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgICAgbS5wdXNoKHRhc2spO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gbTtcbiAgICAgICAgICAgIH0uYmluZCh0aGlzKSwgW10pO1xuICAgICAgICAgICAgYXN5bmMucGFyYWxsZWwodGFza3MsIGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgICB9XG4gICAgfVxufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gTWFwcGluZ09wZXJhdGlvbjtcblxuXG4iLCIvKipcbiAqIEBtb2R1bGUgbWFwcGluZ1xuICovXG5cbnZhciBsb2cgPSByZXF1aXJlKCcuL2xvZycpLFxuICAgIENvbGxlY3Rpb25SZWdpc3RyeSA9IHJlcXVpcmUoJy4vY29sbGVjdGlvblJlZ2lzdHJ5JykuQ29sbGVjdGlvblJlZ2lzdHJ5LFxuICAgIEludGVybmFsU2llc3RhRXJyb3IgPSByZXF1aXJlKCcuL2Vycm9yJykuSW50ZXJuYWxTaWVzdGFFcnJvcixcbiAgICBSZWxhdGlvbnNoaXBUeXBlID0gcmVxdWlyZSgnLi9SZWxhdGlvbnNoaXBUeXBlJyksXG4gICAgUXVlcnkgPSByZXF1aXJlKCcuL3F1ZXJ5JyksXG4gICAgTWFwcGluZ09wZXJhdGlvbiA9IHJlcXVpcmUoJy4vbWFwcGluZ09wZXJhdGlvbicpLFxuICAgIE1vZGVsSW5zdGFuY2UgPSByZXF1aXJlKCcuL21vZGVsSW5zdGFuY2UnKSxcbiAgICB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyksXG4gICAgY2FjaGUgPSByZXF1aXJlKCcuL2NhY2hlJyksXG4gICAgc3RvcmUgPSByZXF1aXJlKCcuL3N0b3JlJyksXG4gICAgZXh0ZW5kID0gcmVxdWlyZSgnZXh0ZW5kJyksXG4gICAgbW9kZWxFdmVudHMgPSByZXF1aXJlKCcuL21vZGVsRXZlbnRzJyksXG4gICAgZXZlbnRzID0gcmVxdWlyZSgnLi9ldmVudHMnKSxcbiAgICB3cmFwQXJyYXkgPSByZXF1aXJlKCcuL2V2ZW50cycpLndyYXBBcnJheSxcbiAgICBwcm94eSA9IHJlcXVpcmUoJy4vUmVsYXRpb25zaGlwUHJveHknKSxcbiAgICBPbmVUb01hbnlQcm94eSA9IHJlcXVpcmUoJy4vT25lVG9NYW55UHJveHknKSxcbiAgICBPbmVUb09uZVByb3h5ID0gcmVxdWlyZSgnLi9PbmVUb09uZVByb3h5JyksXG4gICAgTWFueVRvTWFueVByb3h5ID0gcmVxdWlyZSgnLi9tYW55VG9NYW55UHJveHknKSxcbiAgICBSZWFjdGl2ZVF1ZXJ5ID0gcmVxdWlyZSgnLi9yZWFjdGl2ZVF1ZXJ5JyksXG4gICAgQXJyYW5nZWRSZWFjdGl2ZVF1ZXJ5ID0gcmVxdWlyZSgnLi9BcnJhbmdlZFJlYWN0aXZlUXVlcnknKSxcbiAgICBfID0gdXRpbC5fLFxuICAgIGd1aWQgPSB1dGlsLmd1aWQsXG4gICAgTW9kZWxFdmVudFR5cGUgPSBtb2RlbEV2ZW50cy5Nb2RlbEV2ZW50VHlwZTtcblxudmFyIExvZ2dlciA9IGxvZy5sb2dnZXJXaXRoTmFtZSgnTW9kZWwnKTtcblxuXG4vKipcbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gb3B0c1xuICovXG5mdW5jdGlvbiBNb2RlbChvcHRzKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHRoaXMuX29wdHMgPSBvcHRzID8gXy5leHRlbmQoe30sIG9wdHMpIDoge307XG5cbiAgICB1dGlsLmV4dGVuZEZyb21PcHRzKHRoaXMsIG9wdHMsIHtcbiAgICAgICAgbWV0aG9kczoge30sXG4gICAgICAgIGF0dHJpYnV0ZXM6IFtdLFxuICAgICAgICBjb2xsZWN0aW9uOiBmdW5jdGlvbiAoYykge1xuICAgICAgICAgICAgaWYgKHV0aWwuaXNTdHJpbmcoYykpIHtcbiAgICAgICAgICAgICAgICBjID0gQ29sbGVjdGlvblJlZ2lzdHJ5W2NdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGM7XG4gICAgICAgIH0sXG4gICAgICAgIGlkOiAnaWQnLFxuICAgICAgICByZWxhdGlvbnNoaXBzOiBbXSxcbiAgICAgICAgbmFtZTogbnVsbCxcbiAgICAgICAgaW5kZXhlczogW10sXG4gICAgICAgIHNpbmdsZXRvbjogZmFsc2UsXG4gICAgICAgIHN0YXRpY3M6IHRoaXMuaW5zdGFsbFN0YXRpY3MuYmluZCh0aGlzKSxcbiAgICAgICAgcHJvcGVydGllczoge30sXG4gICAgICAgIGluaXQ6IG51bGwsXG4gICAgICAgIHJlbW92ZTogbnVsbFxuICAgIH0pO1xuXG5cbiAgICB0aGlzLmF0dHJpYnV0ZXMgPSBNb2RlbC5fcHJvY2Vzc0F0dHJpYnV0ZXModGhpcy5hdHRyaWJ1dGVzKTtcblxuICAgIF8uZXh0ZW5kKHRoaXMsIHtcbiAgICAgICAgX2luc3RhbGxlZDogZmFsc2UsXG4gICAgICAgIF9yZWxhdGlvbnNoaXBzSW5zdGFsbGVkOiBmYWxzZSxcbiAgICAgICAgX3JldmVyc2VSZWxhdGlvbnNoaXBzSW5zdGFsbGVkOiBmYWxzZSxcbiAgICAgICAgY2hpbGRyZW46IFtdXG4gICAgfSk7XG5cbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydGllcyh0aGlzLCB7XG4gICAgICAgIF9yZWxhdGlvbnNoaXBOYW1lczoge1xuICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIE9iamVjdC5rZXlzKHNlbGYucmVsYXRpb25zaGlwcyk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZVxuICAgICAgICB9LFxuICAgICAgICBfYXR0cmlidXRlTmFtZXM6IHtcbiAgICAgICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHZhciBuYW1lcyA9IFtdO1xuICAgICAgICAgICAgICAgIGlmIChzZWxmLmlkKSB7XG4gICAgICAgICAgICAgICAgICAgIG5hbWVzLnB1c2goc2VsZi5pZCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIF8uZWFjaChzZWxmLmF0dHJpYnV0ZXMsIGZ1bmN0aW9uICh4KSB7XG4gICAgICAgICAgICAgICAgICAgIG5hbWVzLnB1c2goeC5uYW1lKVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIHJldHVybiBuYW1lcztcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgICAgIH0sXG4gICAgICAgIGluc3RhbGxlZDoge1xuICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHNlbGYuX2luc3RhbGxlZCAmJiBzZWxmLl9yZWxhdGlvbnNoaXBzSW5zdGFsbGVkICYmIHNlbGYuX3JldmVyc2VSZWxhdGlvbnNoaXBzSW5zdGFsbGVkO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICAgICAgfSxcbiAgICAgICAgZGVzY2VuZGFudHM6IHtcbiAgICAgICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBfLnJlZHVjZShzZWxmLmNoaWxkcmVuLCBmdW5jdGlvbiAobWVtbywgZGVzY2VuZGFudCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gQXJyYXkucHJvdG90eXBlLmNvbmNhdC5jYWxsKG1lbW8sIGRlc2NlbmRhbnQuZGVzY2VuZGFudHMpO1xuICAgICAgICAgICAgICAgIH0uYmluZChzZWxmKSwgXy5leHRlbmQoW10sIHNlbGYuY2hpbGRyZW4pKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlXG4gICAgICAgIH0sXG4gICAgICAgIGRpcnR5OiB7XG4gICAgICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBpZiAoc2llc3RhLmV4dC5zdG9yYWdlRW5hYmxlZCkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgdW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb24gPSBzaWVzdGEuZXh0LnN0b3JhZ2UuX3Vuc2F2ZWRPYmplY3RzQnlDb2xsZWN0aW9uLFxuICAgICAgICAgICAgICAgICAgICAgICAgaGFzaCA9ICh1bnNhdmVkT2JqZWN0c0J5Q29sbGVjdGlvblt0aGlzLmNvbGxlY3Rpb25OYW1lXSB8fCB7fSlbdGhpcy5uYW1lXSB8fCB7fTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuICEhT2JqZWN0LmtleXMoaGFzaCkubGVuZ3RoO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZVxuICAgICAgICB9LFxuICAgICAgICBjb2xsZWN0aW9uTmFtZToge1xuICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuY29sbGVjdGlvbi5uYW1lO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICAgICAgfVxuICAgIH0pO1xuICAgIGV2ZW50cy5Qcm94eUV2ZW50RW1pdHRlci5jYWxsKHRoaXMsIHRoaXMuY29sbGVjdGlvbk5hbWUgKyAnOicgKyB0aGlzLm5hbWUpO1xuXG5cbn1cblxuXy5leHRlbmQoTW9kZWwsIHtcbiAgICAvKipcbiAgICAgKiBOb3JtYWxpc2UgYXR0cmlidXRlcyBwYXNzZWQgdmlhIHRoZSBvcHRpb25zIGRpY3Rpb25hcnkuXG4gICAgICogQHBhcmFtIGF0dHJpYnV0ZXNcbiAgICAgKiBAcmV0dXJucyB7QXJyYXl9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfcHJvY2Vzc0F0dHJpYnV0ZXM6IGZ1bmN0aW9uIChhdHRyaWJ1dGVzKSB7XG4gICAgICAgIHJldHVybiBfLnJlZHVjZShhdHRyaWJ1dGVzLCBmdW5jdGlvbiAobSwgYSkge1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBhID09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgICAgbS5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgbmFtZTogYVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgbS5wdXNoKGEpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIG07XG4gICAgICAgIH0sIFtdKVxuICAgIH1cbn0pO1xuXG5Nb2RlbC5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKGV2ZW50cy5Qcm94eUV2ZW50RW1pdHRlci5wcm90b3R5cGUpO1xuXG5fLmV4dGVuZChNb2RlbC5wcm90b3R5cGUsIHtcbiAgICBpbnN0YWxsU3RhdGljczogZnVuY3Rpb24gKHN0YXRpY3MpIHtcbiAgICAgICAgaWYgKHN0YXRpY3MpIHtcbiAgICAgICAgICAgIF8uZWFjaChPYmplY3Qua2V5cyhzdGF0aWNzKSwgZnVuY3Rpb24gKHN0YXRpY05hbWUpIHtcbiAgICAgICAgICAgICAgICBpZiAodGhpc1tzdGF0aWNOYW1lXSkge1xuICAgICAgICAgICAgICAgICAgICBMb2dnZXIuZXJyb3IoJ1N0YXRpYyBtZXRob2Qgd2l0aCBuYW1lIFwiJyArIHN0YXRpY05hbWUgKyAnXCIgYWxyZWFkeSBleGlzdHMuIElnbm9yaW5nIGl0LicpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpc1tzdGF0aWNOYW1lXSA9IHN0YXRpY3Nbc3RhdGljTmFtZV0uYmluZCh0aGlzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBzdGF0aWNzO1xuICAgIH0sXG4gICAgLyoqXG4gICAgICogSW5zdGFsbCByZWxhdGlvbnNoaXBzLiBSZXR1cm5zIGVycm9yIGluIGZvcm0gb2Ygc3RyaW5nIGlmIGZhaWxzLlxuICAgICAqIEByZXR1cm4ge1N0cmluZ3xudWxsfVxuICAgICAqL1xuICAgIGluc3RhbGxSZWxhdGlvbnNoaXBzOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmICghdGhpcy5fcmVsYXRpb25zaGlwc0luc3RhbGxlZCkge1xuICAgICAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICAgICAgc2VsZi5fcmVsYXRpb25zaGlwcyA9IFtdO1xuICAgICAgICAgICAgaWYgKHNlbGYuX29wdHMucmVsYXRpb25zaGlwcykge1xuICAgICAgICAgICAgICAgIGZvciAodmFyIG5hbWUgaW4gc2VsZi5fb3B0cy5yZWxhdGlvbnNoaXBzKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChzZWxmLl9vcHRzLnJlbGF0aW9uc2hpcHMuaGFzT3duUHJvcGVydHkobmFtZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciByZWxhdGlvbnNoaXAgPSBzZWxmLl9vcHRzLnJlbGF0aW9uc2hpcHNbbmFtZV07XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBJZiBhIHJldmVyc2UgcmVsYXRpb25zaGlwIGlzIGluc3RhbGxlZCBiZWZvcmVoYW5kLCB3ZSBkbyBub3Qgd2FudCB0byBwcm9jZXNzIHRoZW0uXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIXJlbGF0aW9uc2hpcC5pc1JldmVyc2UpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoTG9nZ2VyLmRlYnVnLmlzRW5hYmxlZClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgTG9nZ2VyLmRlYnVnKHNlbGYubmFtZSArICc6IGNvbmZpZ3VyaW5nIHJlbGF0aW9uc2hpcCAnICsgbmFtZSwgcmVsYXRpb25zaGlwKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIXJlbGF0aW9uc2hpcC50eXBlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzZWxmLnNpbmdsZXRvbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVsYXRpb25zaGlwLnR5cGUgPSBSZWxhdGlvbnNoaXBUeXBlLk9uZVRvT25lO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVsYXRpb25zaGlwLnR5cGUgPSBSZWxhdGlvbnNoaXBUeXBlLk9uZVRvTWFueTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoc2VsZi5zaW5nbGV0b24gJiYgcmVsYXRpb25zaGlwLnR5cGUgPT0gUmVsYXRpb25zaGlwVHlwZS5NYW55VG9NYW55KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiAnU2luZ2xldG9uIG1vZGVsIGNhbm5vdCB1c2UgTWFueVRvTWFueSByZWxhdGlvbnNoaXAuJztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHJlbGF0aW9uc2hpcC50eXBlID09IFJlbGF0aW9uc2hpcFR5cGUuT25lVG9NYW55IHx8XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlbGF0aW9uc2hpcC50eXBlID09IFJlbGF0aW9uc2hpcFR5cGUuT25lVG9PbmUgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVsYXRpb25zaGlwLnR5cGUgPT0gUmVsYXRpb25zaGlwVHlwZS5NYW55VG9NYW55KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBtb2RlbE5hbWUgPSByZWxhdGlvbnNoaXAubW9kZWw7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlbGV0ZSByZWxhdGlvbnNoaXAubW9kZWw7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciByZXZlcnNlTW9kZWw7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChtb2RlbE5hbWUgaW5zdGFuY2VvZiBNb2RlbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV2ZXJzZU1vZGVsID0gbW9kZWxOYW1lO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKExvZ2dlci5kZWJ1Zy5pc0VuYWJsZWQpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgTG9nZ2VyLmRlYnVnKCdyZXZlcnNlTW9kZWxOYW1lJywgbW9kZWxOYW1lKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghc2VsZi5jb2xsZWN0aW9uKSB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignTW9kZWwgbXVzdCBoYXZlIGNvbGxlY3Rpb24nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBjb2xsZWN0aW9uID0gc2VsZi5jb2xsZWN0aW9uO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFjb2xsZWN0aW9uKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ0NvbGxlY3Rpb24gJyArIHNlbGYuY29sbGVjdGlvbk5hbWUgKyAnIG5vdCByZWdpc3RlcmVkJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXZlcnNlTW9kZWwgPSBjb2xsZWN0aW9uW21vZGVsTmFtZV07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIXJldmVyc2VNb2RlbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGFyciA9IG1vZGVsTmFtZS5zcGxpdCgnLicpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGFyci5sZW5ndGggPT0gMikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBjb2xsZWN0aW9uTmFtZSA9IGFyclswXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtb2RlbE5hbWUgPSBhcnJbMV07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG90aGVyQ29sbGVjdGlvbiA9IENvbGxlY3Rpb25SZWdpc3RyeVtjb2xsZWN0aW9uTmFtZV07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFvdGhlckNvbGxlY3Rpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuICdDb2xsZWN0aW9uIHdpdGggbmFtZSBcIicgKyBjb2xsZWN0aW9uTmFtZSArICdcIiBkb2VzIG5vdCBleGlzdC4nO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXZlcnNlTW9kZWwgPSBvdGhlckNvbGxlY3Rpb25bbW9kZWxOYW1lXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoTG9nZ2VyLmRlYnVnLmlzRW5hYmxlZClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIExvZ2dlci5kZWJ1ZygncmV2ZXJzZU1vZGVsJywgcmV2ZXJzZU1vZGVsKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHJldmVyc2VNb2RlbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVsYXRpb25zaGlwLnJldmVyc2VNb2RlbCA9IHJldmVyc2VNb2RlbDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlbGF0aW9uc2hpcC5mb3J3YXJkTW9kZWwgPSB0aGlzO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVsYXRpb25zaGlwLmZvcndhcmROYW1lID0gbmFtZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlbGF0aW9uc2hpcC5yZXZlcnNlTmFtZSA9IHJlbGF0aW9uc2hpcC5yZXZlcnNlIHx8ICdyZXZlcnNlXycgKyBuYW1lO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVsZXRlIHJlbGF0aW9uc2hpcC5yZXZlcnNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVsYXRpb25zaGlwLmlzUmV2ZXJzZSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuICdNb2RlbCB3aXRoIG5hbWUgXCInICsgbW9kZWxOYW1lLnRvU3RyaW5nKCkgKyAnXCIgZG9lcyBub3QgZXhpc3QnO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuICdSZWxhdGlvbnNoaXAgdHlwZSAnICsgcmVsYXRpb25zaGlwLnR5cGUgKyAnIGRvZXMgbm90IGV4aXN0JztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLl9yZWxhdGlvbnNoaXBzSW5zdGFsbGVkID0gdHJ1ZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdSZWxhdGlvbnNoaXBzIGZvciBcIicgKyB0aGlzLm5hbWUgKyAnXCIgaGF2ZSBhbHJlYWR5IGJlZW4gaW5zdGFsbGVkJyk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSxcbiAgICBpbnN0YWxsUmV2ZXJzZVJlbGF0aW9uc2hpcHM6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9yZXZlcnNlUmVsYXRpb25zaGlwc0luc3RhbGxlZCkge1xuICAgICAgICAgICAgZm9yICh2YXIgZm9yd2FyZE5hbWUgaW4gdGhpcy5yZWxhdGlvbnNoaXBzKSB7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMucmVsYXRpb25zaGlwcy5oYXNPd25Qcm9wZXJ0eShmb3J3YXJkTmFtZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHJlbGF0aW9uc2hpcCA9IHRoaXMucmVsYXRpb25zaGlwc1tmb3J3YXJkTmFtZV07XG4gICAgICAgICAgICAgICAgICAgIHJlbGF0aW9uc2hpcCA9IGV4dGVuZCh0cnVlLCB7fSwgcmVsYXRpb25zaGlwKTtcbiAgICAgICAgICAgICAgICAgICAgcmVsYXRpb25zaGlwLmlzUmV2ZXJzZSA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIHZhciByZXZlcnNlTW9kZWwgPSByZWxhdGlvbnNoaXAucmV2ZXJzZU1vZGVsLFxuICAgICAgICAgICAgICAgICAgICAgICAgcmV2ZXJzZU5hbWUgPSByZWxhdGlvbnNoaXAucmV2ZXJzZU5hbWU7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdyZXZlcnNlIHJlbGF0aW9uc2hpcCcsIHJlbGF0aW9uc2hpcCk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChyZXZlcnNlTW9kZWwuc2luZ2xldG9uKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAocmVsYXRpb25zaGlwLnR5cGUgPT0gUmVsYXRpb25zaGlwVHlwZS5NYW55VG9NYW55KSByZXR1cm4gJ1NpbmdsZXRvbiBtb2RlbCBjYW5ub3QgYmUgcmVsYXRlZCB2aWEgcmV2ZXJzZSBNYW55VG9NYW55JztcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChyZWxhdGlvbnNoaXAudHlwZSA9PSBSZWxhdGlvbnNoaXBUeXBlLk9uZVRvTWFueSkgcmV0dXJuICdTaW5nbGV0b24gbW9kZWwgY2Fubm90IGJlIHJlbGF0ZWQgdmlhIHJldmVyc2UgT25lVG9NYW55JztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAoTG9nZ2VyLmRlYnVnLmlzRW5hYmxlZClcbiAgICAgICAgICAgICAgICAgICAgICAgIExvZ2dlci5kZWJ1Zyh0aGlzLm5hbWUgKyAnOiBjb25maWd1cmluZyAgcmV2ZXJzZSByZWxhdGlvbnNoaXAgJyArIHJldmVyc2VOYW1lKTtcbiAgICAgICAgICAgICAgICAgICAgcmV2ZXJzZU1vZGVsLnJlbGF0aW9uc2hpcHNbcmV2ZXJzZU5hbWVdID0gcmVsYXRpb25zaGlwO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuX3JldmVyc2VSZWxhdGlvbnNoaXBzSW5zdGFsbGVkID0gdHJ1ZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdSZXZlcnNlIHJlbGF0aW9uc2hpcHMgZm9yIFwiJyArIHRoaXMubmFtZSArICdcIiBoYXZlIGFscmVhZHkgYmVlbiBpbnN0YWxsZWQuJyk7XG4gICAgICAgIH1cbiAgICB9LFxuICAgIF9xdWVyeTogZnVuY3Rpb24gKHF1ZXJ5KSB7XG4gICAgICAgIHZhciBxdWVyeSA9IG5ldyBRdWVyeSh0aGlzLCBxdWVyeSB8fCB7fSk7XG4gICAgICAgIHJldHVybiBxdWVyeTtcbiAgICB9LFxuICAgIHF1ZXJ5OiBmdW5jdGlvbiAocXVlcnksIGNhbGxiYWNrKSB7XG4gICAgICAgIGlmICghdGhpcy5zaW5nbGV0b24pIHJldHVybiAodGhpcy5fcXVlcnkocXVlcnkpKS5leGVjdXRlKGNhbGxiYWNrKTtcbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICB2YXIgZGVmZXJyZWQgPSB1dGlsLmRlZmVyKGNhbGxiYWNrKTtcbiAgICAgICAgICAgIGNhbGxiYWNrID0gZGVmZXJyZWQuZmluaXNoLmJpbmQoZGVmZXJyZWQpO1xuICAgICAgICAgICAgKHRoaXMuX3F1ZXJ5KHtfX2lnbm9yZUluc3RhbGxlZDogdHJ1ZX0pKS5leGVjdXRlKGZ1bmN0aW9uIChlcnIsIG9ianMpIHtcbiAgICAgICAgICAgICAgICBpZiAoZXJyKSBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyBDYWNoZSBhIG5ldyBzaW5nbGV0b24gYW5kIHRoZW4gcmVleGVjdXRlIHRoZSBxdWVyeVxuICAgICAgICAgICAgICAgICAgICBxdWVyeSA9IF8uZXh0ZW5kKHt9LCBxdWVyeSk7XG4gICAgICAgICAgICAgICAgICAgIHF1ZXJ5Ll9faWdub3JlSW5zdGFsbGVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFvYmpzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5tYXAoe30sIGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAodGhpcy5fcXVlcnkocXVlcnkpKS5leGVjdXRlKGNhbGxiYWNrKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICh0aGlzLl9xdWVyeShxdWVyeSkpLmV4ZWN1dGUoY2FsbGJhY2spO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgICAgICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xuICAgICAgICB9XG4gICAgfSxcbiAgICByZWFjdGl2ZVF1ZXJ5OiBmdW5jdGlvbiAocXVlcnkpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBSZWFjdGl2ZVF1ZXJ5KG5ldyBRdWVyeSh0aGlzLCBxdWVyeSB8fCB7fSkpO1xuICAgIH0sXG4gICAgYXJyYW5nZWRSZWFjdGl2ZVF1ZXJ5OiBmdW5jdGlvbiAocXVlcnkpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBBcnJhbmdlZFJlYWN0aXZlUXVlcnkobmV3IFF1ZXJ5KHRoaXMsIHF1ZXJ5IHx8IHt9KSk7XG4gICAgfSxcbiAgICBvbmU6IGZ1bmN0aW9uIChvcHRzLCBjYikge1xuICAgICAgICBpZiAodHlwZW9mIG9wdHMgPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgY2IgPSBvcHRzO1xuICAgICAgICAgICAgb3B0cyA9IHt9O1xuICAgICAgICB9XG4gICAgICAgIHZhciBkZWZlcnJlZCA9IHV0aWwuZGVmZXIoY2IpO1xuICAgICAgICBjYiA9IGRlZmVycmVkLmZpbmlzaC5iaW5kKGRlZmVycmVkKTtcbiAgICAgICAgdGhpcy5xdWVyeShvcHRzLCBmdW5jdGlvbiAoZXJyLCByZXMpIHtcbiAgICAgICAgICAgIGlmIChlcnIpIGNiKGVycik7XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZiAocmVzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgY2IoJ01vcmUgdGhhbiBvbmUgaW5zdGFuY2UgcmV0dXJuZWQgd2hlbiBleGVjdXRpbmcgZ2V0IHF1ZXJ5IScpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzID0gcmVzLmxlbmd0aCA/IHJlc1swXSA6IG51bGw7XG4gICAgICAgICAgICAgICAgICAgIGNiKG51bGwsIHJlcyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG4gICAgfSxcbiAgICBhbGw6IGZ1bmN0aW9uIChxLCBjYikge1xuICAgICAgICBpZiAodHlwZW9mIHEgPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgY2IgPSBxO1xuICAgICAgICAgICAgcSA9IHt9O1xuICAgICAgICB9XG4gICAgICAgIHEgPSBxIHx8IHt9O1xuICAgICAgICB2YXIgcXVlcnkgPSB7fTtcbiAgICAgICAgaWYgKHEuX19vcmRlcikgcXVlcnkuX19vcmRlciA9IHEuX19vcmRlcjtcbiAgICAgICAgcmV0dXJuIHRoaXMucXVlcnkocSwgY2IpO1xuICAgIH0sXG4gICAgaW5zdGFsbDogZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgICAgIGlmIChMb2dnZXIuaW5mby5pc0VuYWJsZWQpIExvZ2dlci5pbmZvKCdJbnN0YWxsaW5nIG1hcHBpbmcgJyArIHRoaXMubmFtZSk7XG4gICAgICAgIHZhciBkZWZlcnJlZCA9IHV0aWwuZGVmZXIoY2FsbGJhY2spO1xuICAgICAgICBjYWxsYmFjayA9IGRlZmVycmVkLmZpbmlzaC5iaW5kKGRlZmVycmVkKTtcbiAgICAgICAgaWYgKCF0aGlzLl9pbnN0YWxsZWQpIHtcbiAgICAgICAgICAgIHRoaXMuX2luc3RhbGxlZCA9IHRydWU7XG4gICAgICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ01vZGVsIFwiJyArIHRoaXMubmFtZSArICdcIiBoYXMgYWxyZWFkeSBiZWVuIGluc3RhbGxlZCcpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xuICAgIH0sXG4gICAgLyoqXG4gICAgICogTWFwIGRhdGEgaW50byBTaWVzdGEuXG4gICAgICpcbiAgICAgKiBAcGFyYW0gZGF0YSBSYXcgZGF0YSByZWNlaXZlZCByZW1vdGVseSBvciBvdGhlcndpc2VcbiAgICAgKiBAcGFyYW0ge2Z1bmN0aW9ufG9iamVjdH0gW29wdHNdXG4gICAgICogQHBhcmFtIHtib29sZWFufSBvcHRzLm92ZXJyaWRlXG4gICAgICogQHBhcmFtIHtib29sZWFufSBvcHRzLl9pZ25vcmVJbnN0YWxsZWQgLSBBbiBlc2NhcGUgY2xhdXNlIHRoYXQgYWxsb3dzIG1hcHBpbmcgb250byBNb2RlbHMgZXZlbiBpZiBpbnN0YWxsIHByb2Nlc3MgaGFzIG5vdCBmaW5pc2hlZC5cbiAgICAgKiBAcGFyYW0ge2Z1bmN0aW9ufSBbY2FsbGJhY2tdIENhbGxlZCBvbmNlIHBvdWNoIHBlcnNpc3RlbmNlIHJldHVybnMuXG4gICAgICovXG4gICAgbWFwOiBmdW5jdGlvbiAoZGF0YSwgb3B0cywgY2FsbGJhY2spIHtcbiAgICAgICAgaWYgKHR5cGVvZiBvcHRzID09ICdmdW5jdGlvbicpIGNhbGxiYWNrID0gb3B0cztcbiAgICAgICAgb3B0cyA9IG9wdHMgfHwge307XG4gICAgICAgIHZhciBkZWZlcnJlZCA9IHV0aWwuZGVmZXIoY2FsbGJhY2spO1xuICAgICAgICB2YXIgX21hcCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHZhciBvdmVycmlkZXMgPSBvcHRzLm92ZXJyaWRlO1xuICAgICAgICAgICAgaWYgKG92ZXJyaWRlcykge1xuICAgICAgICAgICAgICAgIGlmICh1dGlsLmlzQXJyYXkob3ZlcnJpZGVzKSkgb3B0cy5vYmplY3RzID0gb3ZlcnJpZGVzO1xuICAgICAgICAgICAgICAgIGVsc2Ugb3B0cy5vYmplY3RzID0gW292ZXJyaWRlc107XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBkZWxldGUgb3B0cy5vdmVycmlkZTtcbiAgICAgICAgICAgIGlmICh1dGlsLmlzQXJyYXkoZGF0YSkpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9tYXBCdWxrKGRhdGEsIG9wdHMsIGRlZmVycmVkLmZpbmlzaC5iaW5kKGRlZmVycmVkKSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuX21hcEJ1bGsoW2RhdGFdLCBvcHRzLCBmdW5jdGlvbiAoZXJyLCBvYmplY3RzKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBvYmo7XG4gICAgICAgICAgICAgICAgICAgIGlmIChvYmplY3RzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAob2JqZWN0cy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBvYmogPSBvYmplY3RzWzBdO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGRlZmVycmVkLmZpbmlzaChlcnIgPyAodXRpbC5pc0FycmF5KGVycikgPyBlcnJbMF0gOiBlcnIpIDogbnVsbCwgb2JqKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfS5iaW5kKHRoaXMpO1xuICAgICAgICBpZiAob3B0cy5faWdub3JlSW5zdGFsbGVkKSB7XG4gICAgICAgICAgICBfbWFwKCk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBzaWVzdGEuX2FmdGVySW5zdGFsbChfbWFwKTtcbiAgICAgICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG4gICAgfSxcbiAgICBfbWFwQnVsazogZnVuY3Rpb24gKGRhdGEsIG9wdHMsIGNhbGxiYWNrKSB7XG4gICAgICAgIF8uZXh0ZW5kKG9wdHMsIHttb2RlbDogdGhpcywgZGF0YTogZGF0YX0pO1xuICAgICAgICB2YXIgb3AgPSBuZXcgTWFwcGluZ09wZXJhdGlvbihvcHRzKTtcbiAgICAgICAgb3Auc3RhcnQoZnVuY3Rpb24gKGVyciwgb2JqZWN0cykge1xuICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2sobnVsbCwgb2JqZWN0cyB8fCBbXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH0sXG4gICAgX2NvdW50Q2FjaGU6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIGNvbGxDYWNoZSA9IGNhY2hlLl9sb2NhbENhY2hlQnlUeXBlW3RoaXMuY29sbGVjdGlvbk5hbWVdIHx8IHt9O1xuICAgICAgICB2YXIgbW9kZWxDYWNoZSA9IGNvbGxDYWNoZVt0aGlzLm5hbWVdIHx8IHt9O1xuICAgICAgICByZXR1cm4gXy5yZWR1Y2UoT2JqZWN0LmtleXMobW9kZWxDYWNoZSksIGZ1bmN0aW9uIChtLCBfaWQpIHtcbiAgICAgICAgICAgIG1bX2lkXSA9IHt9O1xuICAgICAgICAgICAgcmV0dXJuIG07XG4gICAgICAgIH0sIHt9KTtcbiAgICB9LFxuICAgIGNvdW50OiBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICAgICAgdmFyIGRlZmVycmVkID0gdXRpbC5kZWZlcihjYWxsYmFjayk7XG4gICAgICAgIGNhbGxiYWNrID0gZGVmZXJyZWQuZmluaXNoLmJpbmQoZGVmZXJyZWQpO1xuICAgICAgICB2YXIgaGFzaCA9IHRoaXMuX2NvdW50Q2FjaGUoKTtcbiAgICAgICAgY2FsbGJhY2sobnVsbCwgT2JqZWN0LmtleXMoaGFzaCkubGVuZ3RoKTtcbiAgICAgICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBDb252ZXJ0IHJhdyBkYXRhIGludG8gYSBNb2RlbEluc3RhbmNlXG4gICAgICogQHJldHVybnMge01vZGVsSW5zdGFuY2V9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfbmV3OiBmdW5jdGlvbiAoZGF0YSwgc2hvdWxkUmVnaXN0ZXJDaGFuZ2UpIHtcbiAgICAgICAgc2hvdWxkUmVnaXN0ZXJDaGFuZ2UgPSBzaG91bGRSZWdpc3RlckNoYW5nZSA9PT0gdW5kZWZpbmVkID8gdHJ1ZSA6IHNob3VsZFJlZ2lzdGVyQ2hhbmdlO1xuICAgICAgICBpZiAodGhpcy5pbnN0YWxsZWQpIHtcbiAgICAgICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgICAgIHZhciBfaWQ7XG4gICAgICAgICAgICBpZiAoZGF0YSkge1xuICAgICAgICAgICAgICAgIF9pZCA9IGRhdGEuX2lkID8gZGF0YS5faWQgOiBndWlkKCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIF9pZCA9IGd1aWQoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHZhciBuZXdNb2RlbCA9IG5ldyBNb2RlbEluc3RhbmNlKHRoaXMpO1xuICAgICAgICAgICAgaWYgKExvZ2dlci5pbmZvLmlzRW5hYmxlZClcbiAgICAgICAgICAgICAgICBMb2dnZXIuaW5mbygnTmV3IG9iamVjdCBjcmVhdGVkIF9pZD1cIicgKyBfaWQudG9TdHJpbmcoKSArICdcIiwgdHlwZT0nICsgdGhpcy5uYW1lLCBkYXRhKTtcbiAgICAgICAgICAgIG5ld01vZGVsLl9pZCA9IF9pZDtcbiAgICAgICAgICAgIC8vIFBsYWNlIGF0dHJpYnV0ZXMgb24gdGhlIG9iamVjdC5cbiAgICAgICAgICAgIHZhciB2YWx1ZXMgPSB7fTtcbiAgICAgICAgICAgIG5ld01vZGVsLl9fdmFsdWVzID0gdmFsdWVzO1xuICAgICAgICAgICAgdmFyIGRlZmF1bHRzID0gXy5yZWR1Y2UodGhpcy5hdHRyaWJ1dGVzLCBmdW5jdGlvbiAobSwgYSkge1xuICAgICAgICAgICAgICAgIGlmIChhLmRlZmF1bHQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICBtW2EubmFtZV0gPSBhLmRlZmF1bHQ7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiBtO1xuICAgICAgICAgICAgfSwge30pO1xuICAgICAgICAgICAgXy5leHRlbmQodmFsdWVzLCBkZWZhdWx0cyk7XG4gICAgICAgICAgICBpZiAoZGF0YSkgXy5leHRlbmQodmFsdWVzLCBkYXRhKTtcbiAgICAgICAgICAgIHZhciBmaWVsZHMgPSB0aGlzLl9hdHRyaWJ1dGVOYW1lcztcbiAgICAgICAgICAgIHZhciBpZHggPSBmaWVsZHMuaW5kZXhPZih0aGlzLmlkKTtcbiAgICAgICAgICAgIGlmIChpZHggPiAtMSkge1xuICAgICAgICAgICAgICAgIGZpZWxkcy5zcGxpY2UoaWR4LCAxKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIF8uZWFjaChmaWVsZHMsIGZ1bmN0aW9uIChmaWVsZCkge1xuICAgICAgICAgICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShuZXdNb2RlbCwgZmllbGQsIHtcbiAgICAgICAgICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgdmFsdWUgPSBuZXdNb2RlbC5fX3ZhbHVlc1tmaWVsZF07XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdmFsdWUgPT09IHVuZGVmaW5lZCA/IG51bGwgOiB2YWx1ZTtcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgc2V0OiBmdW5jdGlvbiAodikge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG9sZCA9IG5ld01vZGVsLl9fdmFsdWVzW2ZpZWxkXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBwcm9wZXJ0eURlcGVuZGVuY2llcyA9IHRoaXMuX3Byb3BlcnR5RGVwZW5kZW5jaWVzW2ZpZWxkXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHByb3BlcnR5RGVwZW5kZW5jaWVzID0gXy5tYXAocHJvcGVydHlEZXBlbmRlbmNpZXMsIGZ1bmN0aW9uIChkZXBlbmRhbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcm9wOiBkZXBlbmRhbnQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9sZDogdGhpc1tkZXBlbmRhbnRdXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIG5ld01vZGVsLl9fdmFsdWVzW2ZpZWxkXSA9IHY7XG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0eURlcGVuZGVuY2llcy5mb3JFYWNoKGZ1bmN0aW9uIChkZXApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgcHJvcGVydHlOYW1lID0gZGVwLnByb3A7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ3Byb3BlcnR5TmFtZScsIHByb3BlcnR5TmFtZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG5ld18gPSB0aGlzW3Byb3BlcnR5TmFtZV07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbW9kZWxFdmVudHMuZW1pdCh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbGxlY3Rpb246IHNlbGYuY29sbGVjdGlvbk5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1vZGVsOiBzZWxmLm5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIF9pZDogbmV3TW9kZWwuX2lkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBuZXc6IG5ld18sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9sZDogZGVwLm9sZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogTW9kZWxFdmVudFR5cGUuU2V0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmaWVsZDogcHJvcGVydHlOYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvYmo6IG5ld01vZGVsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGUgPSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29sbGVjdGlvbjogc2VsZi5jb2xsZWN0aW9uTmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtb2RlbDogc2VsZi5uYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIF9pZDogbmV3TW9kZWwuX2lkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5ldzogdixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbGQ6IG9sZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiBNb2RlbEV2ZW50VHlwZS5TZXQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZmllbGQ6IGZpZWxkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9iajogbmV3TW9kZWxcbiAgICAgICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgICAgICAgICB3aW5kb3cubGFzdEVtaXNzaW9uID0gZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdtdXRoYWZ1a2luIGVtaXNzaW9uJywgZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBtb2RlbEV2ZW50cy5lbWl0KGUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHV0aWwuaXNBcnJheSh2KSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHdyYXBBcnJheSh2LCBmaWVsZCwgbmV3TW9kZWwpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBfLmVhY2goT2JqZWN0LmtleXModGhpcy5tZXRob2RzKSwgZnVuY3Rpb24gKG1ldGhvZE5hbWUpIHtcbiAgICAgICAgICAgICAgICBpZiAobmV3TW9kZWxbbWV0aG9kTmFtZV0gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICBuZXdNb2RlbFttZXRob2ROYW1lXSA9IHRoaXMubWV0aG9kc1ttZXRob2ROYW1lXS5iaW5kKG5ld01vZGVsKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIExvZ2dlci5lcnJvcignQSBtZXRob2Qgd2l0aCBuYW1lIFwiJyArIG1ldGhvZE5hbWUgKyAnXCIgYWxyZWFkeSBleGlzdHMuIElnbm9yaW5nIGl0LicpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0uYmluZCh0aGlzKSk7XG5cbiAgICAgICAgICAgIHZhciBfcHJvcGVydHlOYW1lcyA9IE9iamVjdC5rZXlzKHRoaXMucHJvcGVydGllcyksXG4gICAgICAgICAgICAgICAgX3Byb3BlcnR5RGVwZW5kZW5jaWVzID0ge307XG4gICAgICAgICAgICBfLmVhY2goX3Byb3BlcnR5TmFtZXMsIGZ1bmN0aW9uIChwcm9wTmFtZSkge1xuICAgICAgICAgICAgICAgIHZhciBwcm9wRGVmID0gdGhpcy5wcm9wZXJ0aWVzW3Byb3BOYW1lXTtcbiAgICAgICAgICAgICAgICB2YXIgZGVwZW5kZW5jaWVzID0gcHJvcERlZi5kZXBlbmRlbmNpZXMgfHwgW107XG4gICAgICAgICAgICAgICAgZGVwZW5kZW5jaWVzLmZvckVhY2goZnVuY3Rpb24gKGF0dHIpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFfcHJvcGVydHlEZXBlbmRlbmNpZXNbYXR0cl0pIF9wcm9wZXJ0eURlcGVuZGVuY2llc1thdHRyXSA9IFtdO1xuICAgICAgICAgICAgICAgICAgICBfcHJvcGVydHlEZXBlbmRlbmNpZXNbYXR0cl0ucHVzaChwcm9wTmFtZSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgZGVsZXRlIHByb3BEZWYuZGVwZW5kZW5jaWVzO1xuICAgICAgICAgICAgICAgIGlmIChuZXdNb2RlbFtwcm9wTmFtZV0gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkobmV3TW9kZWwsIHByb3BOYW1lLCBwcm9wRGVmKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIExvZ2dlci5lcnJvcignQSBwcm9wZXJ0eS9tZXRob2Qgd2l0aCBuYW1lIFwiJyArIHByb3BOYW1lICsgJ1wiIGFscmVhZHkgZXhpc3RzLiBJZ25vcmluZyBpdC4nKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LmJpbmQodGhpcykpO1xuXG4gICAgICAgICAgICBuZXdNb2RlbC5fcHJvcGVydHlEZXBlbmRlbmNpZXMgPSBfcHJvcGVydHlEZXBlbmRlbmNpZXM7XG5cbiAgICAgICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShuZXdNb2RlbCwgdGhpcy5pZCwge1xuICAgICAgICAgICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbmV3TW9kZWwuX192YWx1ZXNbc2VsZi5pZF0gfHwgbnVsbDtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHNldDogZnVuY3Rpb24gKHYpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIG9sZCA9IG5ld01vZGVsW3NlbGYuaWRdO1xuICAgICAgICAgICAgICAgICAgICBuZXdNb2RlbC5fX3ZhbHVlc1tzZWxmLmlkXSA9IHY7XG4gICAgICAgICAgICAgICAgICAgIG1vZGVsRXZlbnRzLmVtaXQoe1xuICAgICAgICAgICAgICAgICAgICAgICAgY29sbGVjdGlvbjogc2VsZi5jb2xsZWN0aW9uTmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1vZGVsOiBzZWxmLm5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBfaWQ6IG5ld01vZGVsLl9pZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIG5ldzogdixcbiAgICAgICAgICAgICAgICAgICAgICAgIG9sZDogb2xkLFxuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogTW9kZWxFdmVudFR5cGUuU2V0LFxuICAgICAgICAgICAgICAgICAgICAgICAgZmllbGQ6IHNlbGYuaWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBvYmo6IG5ld01vZGVsXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICBjYWNoZS5yZW1vdGVJbnNlcnQobmV3TW9kZWwsIHYsIG9sZCk7XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBmb3IgKHZhciBuYW1lIGluIHRoaXMucmVsYXRpb25zaGlwcykge1xuICAgICAgICAgICAgICAgIHZhciBwcm94eTtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5yZWxhdGlvbnNoaXBzLmhhc093blByb3BlcnR5KG5hbWUpKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciByZWxhdGlvbnNoaXBPcHRzID0gXy5leHRlbmQoe30sIHRoaXMucmVsYXRpb25zaGlwc1tuYW1lXSksXG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlID0gcmVsYXRpb25zaGlwT3B0cy50eXBlO1xuICAgICAgICAgICAgICAgICAgICBkZWxldGUgcmVsYXRpb25zaGlwT3B0cy50eXBlO1xuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZSA9PSBSZWxhdGlvbnNoaXBUeXBlLk9uZVRvTWFueSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcHJveHkgPSBuZXcgT25lVG9NYW55UHJveHkocmVsYXRpb25zaGlwT3B0cyk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAodHlwZSA9PSBSZWxhdGlvbnNoaXBUeXBlLk9uZVRvT25lKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwcm94eSA9IG5ldyBPbmVUb09uZVByb3h5KHJlbGF0aW9uc2hpcE9wdHMpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHR5cGUgPT0gUmVsYXRpb25zaGlwVHlwZS5NYW55VG9NYW55KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwcm94eSA9IG5ldyBNYW55VG9NYW55UHJveHkocmVsYXRpb25zaGlwT3B0cyk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignTm8gc3VjaCByZWxhdGlvbnNoaXAgdHlwZTogJyArIHR5cGUpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHByb3h5Lmluc3RhbGwobmV3TW9kZWwpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2FjaGUuaW5zZXJ0KG5ld01vZGVsKTtcbiAgICAgICAgICAgIGlmIChzaG91bGRSZWdpc3RlckNoYW5nZSkge1xuICAgICAgICAgICAgICAgIG1vZGVsRXZlbnRzLmVtaXQoe1xuICAgICAgICAgICAgICAgICAgICBjb2xsZWN0aW9uOiB0aGlzLmNvbGxlY3Rpb25OYW1lLFxuICAgICAgICAgICAgICAgICAgICBtb2RlbDogdGhpcy5uYW1lLFxuICAgICAgICAgICAgICAgICAgICBfaWQ6IG5ld01vZGVsLl9pZCxcbiAgICAgICAgICAgICAgICAgICAgbmV3OiBuZXdNb2RlbCxcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogTW9kZWxFdmVudFR5cGUuTmV3LFxuICAgICAgICAgICAgICAgICAgICBvYmo6IG5ld01vZGVsXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gbmV3TW9kZWw7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignTW9kZWwgbXVzdCBiZSBmdWxseSBpbnN0YWxsZWQgYmVmb3JlIGNyZWF0aW5nIGFueSBtb2RlbHMnKTtcbiAgICAgICAgfVxuXG4gICAgfSxcbiAgICBfZHVtcDogZnVuY3Rpb24gKGFzSlNPTikge1xuICAgICAgICB2YXIgZHVtcGVkID0ge307XG4gICAgICAgIGR1bXBlZC5uYW1lID0gdGhpcy5uYW1lO1xuICAgICAgICBkdW1wZWQuYXR0cmlidXRlcyA9IHRoaXMuYXR0cmlidXRlcztcbiAgICAgICAgZHVtcGVkLmlkID0gdGhpcy5pZDtcbiAgICAgICAgZHVtcGVkLmNvbGxlY3Rpb24gPSB0aGlzLmNvbGxlY3Rpb25OYW1lO1xuICAgICAgICBkdW1wZWQucmVsYXRpb25zaGlwcyA9IF8ubWFwKHRoaXMucmVsYXRpb25zaGlwcywgZnVuY3Rpb24gKHIpIHtcbiAgICAgICAgICAgIHJldHVybiByLmlzRm9yd2FyZCA/IHIuZm9yd2FyZE5hbWUgOiByLnJldmVyc2VOYW1lO1xuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIGFzSlNPTiA/IHV0aWwucHJldHR5UHJpbnQoZHVtcGVkKSA6IGR1bXBlZDtcbiAgICB9LFxuICAgIHRvU3RyaW5nOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiAnTW9kZWxbJyArIHRoaXMubmFtZSArICddJztcbiAgICB9XG5cbn0pO1xuXG5cblxuLy9cbi8vXy5leHRlbmQoTW9kZWwucHJvdG90eXBlLCB7XG4vLyAgICBsaXN0ZW46IGZ1bmN0aW9uIChmbikge1xuLy8gICAgICAgIGV2ZW50cy5vbih0aGlzLmNvbGxlY3Rpb25OYW1lICsgJzonICsgdGhpcy5uYW1lLCBmbik7XG4vLyAgICAgICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbi8vICAgICAgICAgICAgdGhpcy5yZW1vdmVMaXN0ZW5lcihmbik7XG4vLyAgICAgICAgfS5iaW5kKHRoaXMpO1xuLy8gICAgfSxcbi8vICAgIGxpc3Rlbk9uY2U6IGZ1bmN0aW9uIChmbikge1xuLy8gICAgICAgIHJldHVybiBldmVudHMub25jZSh0aGlzLmNvbGxlY3Rpb25OYW1lICsgJzonICsgdGhpcy5uYW1lLCBmbik7XG4vLyAgICB9LFxuLy8gICAgcmVtb3ZlTGlzdGVuZXI6IGZ1bmN0aW9uIChmbikge1xuLy8gICAgICAgIHJldHVybiBldmVudHMucmVtb3ZlTGlzdGVuZXIodGhpcy5jb2xsZWN0aW9uTmFtZSArICc6JyArIHRoaXMubmFtZSwgZm4pO1xuLy8gICAgfVxuLy99KTtcbi8vXG4vLy8vIEFsaWFzZXNcbi8vXy5leHRlbmQoTW9kZWwucHJvdG90eXBlLCB7XG4vLyAgICBvbjogTW9kZWwucHJvdG90eXBlLmxpc3RlblxuLy99KTtcblxuLy8gU3ViY2xhc3Npbmdcbl8uZXh0ZW5kKE1vZGVsLnByb3RvdHlwZSwge1xuICAgIGNoaWxkOiBmdW5jdGlvbiAobmFtZU9yT3B0cywgb3B0cykge1xuICAgICAgICBpZiAodHlwZW9mIG5hbWVPck9wdHMgPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIG9wdHMubmFtZSA9IG5hbWVPck9wdHM7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBvcHRzID0gbmFtZTtcbiAgICAgICAgfVxuICAgICAgICBfLmV4dGVuZChvcHRzLCB7XG4gICAgICAgICAgICBhdHRyaWJ1dGVzOiBBcnJheS5wcm90b3R5cGUuY29uY2F0LmNhbGwob3B0cy5hdHRyaWJ1dGVzIHx8IFtdLCB0aGlzLl9vcHRzLmF0dHJpYnV0ZXMpLFxuICAgICAgICAgICAgcmVsYXRpb25zaGlwczogXy5leHRlbmQob3B0cy5yZWxhdGlvbnNoaXBzIHx8IHt9LCB0aGlzLl9vcHRzLnJlbGF0aW9uc2hpcHMpLFxuICAgICAgICAgICAgbWV0aG9kczogXy5leHRlbmQoXy5leHRlbmQoe30sIHRoaXMuX29wdHMubWV0aG9kcykgfHwge30sIG9wdHMubWV0aG9kcyksXG4gICAgICAgICAgICBzdGF0aWNzOiBfLmV4dGVuZChfLmV4dGVuZCh7fSwgdGhpcy5fb3B0cy5zdGF0aWNzKSB8fCB7fSwgb3B0cy5zdGF0aWNzKSxcbiAgICAgICAgICAgIHByb3BlcnRpZXM6IF8uZXh0ZW5kKF8uZXh0ZW5kKHt9LCB0aGlzLl9vcHRzLnByb3BlcnRpZXMpIHx8IHt9LCBvcHRzLnByb3BlcnRpZXMpLFxuICAgICAgICAgICAgaWQ6IG9wdHMuaWQgfHwgdGhpcy5fb3B0cy5pZCxcbiAgICAgICAgICAgIGluaXQ6IG9wdHMuaW5pdCB8fCB0aGlzLl9vcHRzLmluaXQsXG4gICAgICAgICAgICByZW1vdmU6IG9wdHMucmVtb3ZlIHx8IHRoaXMuX29wdHMucmVtb3ZlXG4gICAgICAgIH0pO1xuICAgICAgICB2YXIgbW9kZWwgPSB0aGlzLmNvbGxlY3Rpb24ubW9kZWwob3B0cy5uYW1lLCBvcHRzKTtcbiAgICAgICAgbW9kZWwucGFyZW50ID0gdGhpcztcbiAgICAgICAgdGhpcy5jaGlsZHJlbi5wdXNoKG1vZGVsKTtcbiAgICAgICAgcmV0dXJuIG1vZGVsO1xuICAgIH0sXG4gICAgaXNDaGlsZE9mOiBmdW5jdGlvbiAocGFyZW50KSB7XG4gICAgICAgIHJldHVybiB0aGlzLnBhcmVudCA9PSBwYXJlbnQ7XG4gICAgfSxcbiAgICBpc1BhcmVudE9mOiBmdW5jdGlvbiAoY2hpbGQpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuY2hpbGRyZW4uaW5kZXhPZihjaGlsZCkgPiAtMTtcbiAgICB9LFxuICAgIGlzRGVzY2VuZGFudE9mOiBmdW5jdGlvbiAoYW5jZXN0b3IpIHtcbiAgICAgICAgdmFyIHBhcmVudCA9IHRoaXMucGFyZW50O1xuICAgICAgICB3aGlsZSAocGFyZW50KSB7XG4gICAgICAgICAgICBpZiAocGFyZW50ID09IGFuY2VzdG9yKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIHBhcmVudCA9IHBhcmVudC5wYXJlbnQ7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH0sXG4gICAgaXNBbmNlc3Rvck9mOiBmdW5jdGlvbiAoZGVzY2VuZGFudCkge1xuICAgICAgICByZXR1cm4gdGhpcy5kZXNjZW5kYW50cy5pbmRleE9mKGRlc2NlbmRhbnQpID4gLTE7XG4gICAgfSxcbiAgICBoYXNBdHRyaWJ1dGVOYW1lZDogZnVuY3Rpb24gKGF0dHJpYnV0ZU5hbWUpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2F0dHJpYnV0ZU5hbWVzLmluZGV4T2YoYXR0cmlidXRlTmFtZSkgPiAtMTtcbiAgICB9XG59KTtcblxuXy5leHRlbmQoTW9kZWwucHJvdG90eXBlLCB7XG4gICAgcGFnaW5hdG9yOiBmdW5jdGlvbiAob3B0cykge1xuICAgICAgICBpZiAoc2llc3RhLmV4dC5odHRwRW5hYmxlZCkge1xuICAgICAgICAgICAgdmFyIFBhZ2luYXRvciA9IHNpZXN0YS5leHQuaHR0cC5QYWdpbmF0b3I7XG4gICAgICAgICAgICBvcHRzID0gb3B0cyB8fCB7fTtcbiAgICAgICAgICAgIG9wdHMubW9kZWwgPSB0aGlzO1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBQYWdpbmF0b3Iob3B0cyk7XG4gICAgICAgIH1cbiAgICB9XG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBNb2RlbDtcbiIsInZhciBldmVudHMgPSByZXF1aXJlKCcuL2V2ZW50cycpLFxuICAgIEludGVybmFsU2llc3RhRXJyb3IgPSByZXF1aXJlKCcuL2Vycm9yJykuSW50ZXJuYWxTaWVzdGFFcnJvcixcbiAgICBsb2cgPSByZXF1aXJlKCcuL2xvZycpLFxuICAgIGV4dGVuZCA9IHJlcXVpcmUoJy4vdXRpbCcpLl8uZXh0ZW5kLFxuICAgIGNvbGxlY3Rpb25SZWdpc3RyeSA9IHJlcXVpcmUoJy4vY29sbGVjdGlvblJlZ2lzdHJ5JykuQ29sbGVjdGlvblJlZ2lzdHJ5O1xuXG52YXIgTG9nZ2VyID0gbG9nLmxvZ2dlcldpdGhOYW1lKCdNb2RlbEV2ZW50cycpO1xuXG4vKipcbiAqIENvbnN0YW50cyB0aGF0IGRlc2NyaWJlIGNoYW5nZSBldmVudHMuXG4gKiBTZXQgPT4gQSBuZXcgdmFsdWUgaXMgYXNzaWduZWQgdG8gYW4gYXR0cmlidXRlL3JlbGF0aW9uc2hpcFxuICogU3BsaWNlID0+IEFsbCBqYXZhc2NyaXB0IGFycmF5IG9wZXJhdGlvbnMgYXJlIGRlc2NyaWJlZCBhcyBzcGxpY2VzLlxuICogRGVsZXRlID0+IFVzZWQgaW4gdGhlIGNhc2Ugd2hlcmUgb2JqZWN0cyBhcmUgcmVtb3ZlZCBmcm9tIGFuIGFycmF5LCBidXQgYXJyYXkgb3JkZXIgaXMgbm90IGtub3duIGluIGFkdmFuY2UuXG4gKiBSZW1vdmUgPT4gT2JqZWN0IGRlbGV0aW9uIGV2ZW50c1xuICogTmV3ID0+IE9iamVjdCBjcmVhdGlvbiBldmVudHNcbiAqIEB0eXBlIHtPYmplY3R9XG4gKi9cbnZhciBNb2RlbEV2ZW50VHlwZSA9IHtcbiAgICAgICAgU2V0OiAnU2V0JyxcbiAgICAgICAgU3BsaWNlOiAnU3BsaWNlJyxcbiAgICAgICAgTmV3OiAnTmV3JyxcbiAgICAgICAgUmVtb3ZlOiAnUmVtb3ZlJ1xuICAgIH07XG5cbi8qKlxuICogUmVwcmVzZW50cyBhbiBpbmRpdmlkdWFsIGNoYW5nZS5cbiAqIEBwYXJhbSBvcHRzXG4gKiBAY29uc3RydWN0b3JcbiAqL1xuZnVuY3Rpb24gTW9kZWxFdmVudChvcHRzKSB7XG4gICAgdGhpcy5fb3B0cyA9IG9wdHMgfHwge307XG4gICAgT2JqZWN0LmtleXMob3B0cykuZm9yRWFjaChmdW5jdGlvbiAoaykge1xuICAgICAgICB0aGlzW2tdID0gb3B0c1trXTtcbiAgICB9LmJpbmQodGhpcykpO1xufVxuXG5Nb2RlbEV2ZW50LnByb3RvdHlwZS5fZHVtcCA9IGZ1bmN0aW9uIChwcmV0dHkpIHtcbiAgICB2YXIgZHVtcGVkID0ge307XG4gICAgZHVtcGVkLmNvbGxlY3Rpb24gPSAodHlwZW9mIHRoaXMuY29sbGVjdGlvbikgPT0gJ3N0cmluZycgPyB0aGlzLmNvbGxlY3Rpb24gOiB0aGlzLmNvbGxlY3Rpb24uX2R1bXAoKTtcbiAgICBkdW1wZWQubW9kZWwgPSAodHlwZW9mIHRoaXMubW9kZWwpID09ICdzdHJpbmcnID8gdGhpcy5tb2RlbCA6IHRoaXMubW9kZWwubmFtZTtcbiAgICBkdW1wZWQuX2lkID0gdGhpcy5faWQ7XG4gICAgZHVtcGVkLmZpZWxkID0gdGhpcy5maWVsZDtcbiAgICBkdW1wZWQudHlwZSA9IHRoaXMudHlwZTtcbiAgICBpZiAodGhpcy5pbmRleCkgZHVtcGVkLmluZGV4ID0gdGhpcy5pbmRleDtcbiAgICBpZiAodGhpcy5hZGRlZCkgZHVtcGVkLmFkZGVkID0gXy5tYXAodGhpcy5hZGRlZCwgZnVuY3Rpb24gKHgpIHtyZXR1cm4geC5fZHVtcCgpfSk7XG4gICAgaWYgKHRoaXMucmVtb3ZlZCkgZHVtcGVkLnJlbW92ZWQgPSBfLm1hcCh0aGlzLnJlbW92ZWQsIGZ1bmN0aW9uICh4KSB7cmV0dXJuIHguX2R1bXAoKX0pO1xuICAgIGlmICh0aGlzLm9sZCkgZHVtcGVkLm9sZCA9IHRoaXMub2xkO1xuICAgIGlmICh0aGlzLm5ldykgZHVtcGVkLm5ldyA9IHRoaXMubmV3O1xuICAgIHJldHVybiBwcmV0dHkgPyB1dGlsLnByZXR0eVByaW50KGR1bXBlZCkgOiBkdW1wZWQ7XG59O1xuXG4vKipcbiAqIEJyb2FkY2FzXG4gKiBAcGFyYW0gIHtTdHJpbmd9IGNvbGxlY3Rpb25OYW1lXG4gKiBAcGFyYW0gIHtTdHJpbmd9IG1vZGVsTmFtZVxuICogQHBhcmFtICB7T2JqZWN0fSBjIGFuIG9wdGlvbnMgZGljdGlvbmFyeSByZXByZXNlbnRpbmcgdGhlIGNoYW5nZVxuICogQHJldHVybiB7W3R5cGVdfVxuICovXG5mdW5jdGlvbiBicm9hZGNhc3RFdmVudChjb2xsZWN0aW9uTmFtZSwgbW9kZWxOYW1lLCBjKSB7XG4gICAgaWYgKExvZ2dlci50cmFjZS5pc0VuYWJsZWQpIExvZ2dlci50cmFjZSgnU2VuZGluZyBub3RpZmljYXRpb24gXCInICsgY29sbGVjdGlvbk5hbWUgKyAnXCIgb2YgdHlwZSAnICsgYy50eXBlKTtcbiAgICBldmVudHMuZW1pdChjb2xsZWN0aW9uTmFtZSwgYyk7XG4gICAgdmFyIG1vZGVsTm90aWYgPSBjb2xsZWN0aW9uTmFtZSArICc6JyArIG1vZGVsTmFtZTtcbiAgICBpZiAoTG9nZ2VyLnRyYWNlLmlzRW5hYmxlZCkgTG9nZ2VyLnRyYWNlKCdTZW5kaW5nIG5vdGlmaWNhdGlvbiBcIicgKyBtb2RlbE5vdGlmICsgJ1wiIG9mIHR5cGUgJyArIGMudHlwZSk7XG4gICAgZXZlbnRzLmVtaXQobW9kZWxOb3RpZiwgYyk7XG4gICAgdmFyIGdlbmVyaWNOb3RpZiA9ICdTaWVzdGEnO1xuICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKSBMb2dnZXIudHJhY2UoJ1NlbmRpbmcgbm90aWZpY2F0aW9uIFwiJyArIGdlbmVyaWNOb3RpZiArICdcIiBvZiB0eXBlICcgKyBjLnR5cGUpO1xuICAgIGV2ZW50cy5lbWl0KGdlbmVyaWNOb3RpZiwgYyk7XG4gICAgdmFyIGxvY2FsSWROb3RpZiA9IGMuX2lkO1xuICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKSBMb2dnZXIudHJhY2UoJ1NlbmRpbmcgbm90aWZpY2F0aW9uIFwiJyArIGxvY2FsSWROb3RpZiArICdcIiBvZiB0eXBlICcgKyBjLnR5cGUpO1xuICAgIGV2ZW50cy5lbWl0KGxvY2FsSWROb3RpZiwgYyk7XG4gICAgdmFyIGNvbGxlY3Rpb24gPSBjb2xsZWN0aW9uUmVnaXN0cnlbY29sbGVjdGlvbk5hbWVdO1xuICAgIHZhciBlcnI7XG4gICAgaWYgKCFjb2xsZWN0aW9uKSB7XG4gICAgICAgIGVyciA9ICdObyBzdWNoIGNvbGxlY3Rpb24gXCInICsgY29sbGVjdGlvbk5hbWUgKyAnXCInO1xuICAgICAgICBMb2dnZXIuZXJyb3IoZXJyLCBjb2xsZWN0aW9uUmVnaXN0cnkpO1xuICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcihlcnIpO1xuICAgIH1cbiAgICB2YXIgbW9kZWwgPSBjb2xsZWN0aW9uW21vZGVsTmFtZV07XG4gICAgaWYgKCFtb2RlbCkge1xuICAgICAgICBlcnIgPSAnTm8gc3VjaCBtb2RlbCBcIicgKyBtb2RlbE5hbWUgKyAnXCInO1xuICAgICAgICBMb2dnZXIuZXJyb3IoZXJyLCBjb2xsZWN0aW9uUmVnaXN0cnkpO1xuICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcihlcnIpO1xuICAgIH1cbiAgICBpZiAobW9kZWwuaWQgJiYgYy5vYmpbbW9kZWwuaWRdKSB7XG4gICAgICAgIHZhciByZW1vdGVJZE5vdGlmID0gY29sbGVjdGlvbk5hbWUgKyAnOicgKyBtb2RlbE5hbWUgKyAnOicgKyBjLm9ialttb2RlbC5pZF07XG4gICAgICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKSBMb2dnZXIudHJhY2UoJ1NlbmRpbmcgbm90aWZpY2F0aW9uIFwiJyArIHJlbW90ZUlkTm90aWYgKyAnXCIgb2YgdHlwZSAnICsgYy50eXBlKTtcbiAgICAgICAgZXZlbnRzLmVtaXQocmVtb3RlSWROb3RpZiwgYyk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiB2YWxpZGF0ZUV2ZW50T3B0cyhvcHRzKSB7XG4gICAgaWYgKCFvcHRzLm1vZGVsKSB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignTXVzdCBwYXNzIGEgbW9kZWwnKTtcbiAgICBpZiAoIW9wdHMuY29sbGVjdGlvbikgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ011c3QgcGFzcyBhIGNvbGxlY3Rpb24nKTtcbiAgICBpZiAoIW9wdHMuX2lkKSB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignTXVzdCBwYXNzIGEgbG9jYWwgaWRlbnRpZmllcicpO1xuICAgIGlmICghb3B0cy5vYmopIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdNdXN0IHBhc3MgdGhlIG9iamVjdCcpO1xufVxuXG5mdW5jdGlvbiBlbWl0KG9wdHMpIHtcbiAgICB2YWxpZGF0ZUV2ZW50T3B0cyhvcHRzKTtcbiAgICB2YXIgY29sbGVjdGlvbiA9IG9wdHMuY29sbGVjdGlvbjtcbiAgICB2YXIgbW9kZWwgPSBvcHRzLm1vZGVsO1xuICAgIHZhciBjID0gbmV3IE1vZGVsRXZlbnQob3B0cyk7XG4gICAgYnJvYWRjYXN0RXZlbnQoY29sbGVjdGlvbiwgbW9kZWwsIGMpO1xuICAgIHJldHVybiBjO1xufVxuXG5leHRlbmQoZXhwb3J0cywge1xuICAgIE1vZGVsRXZlbnQ6IE1vZGVsRXZlbnQsXG4gICAgZW1pdDogZW1pdCxcbiAgICB2YWxpZGF0ZUV2ZW50T3B0czogdmFsaWRhdGVFdmVudE9wdHMsXG4gICAgTW9kZWxFdmVudFR5cGU6IE1vZGVsRXZlbnRUeXBlXG59KTsiLCJ2YXIgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpLFxuICAgIFNpZXN0YVVzZXJFcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKS5TaWVzdGFVc2VyRXJyb3IsXG4gICAgTW9kZWxJbnN0YW5jZSA9IHJlcXVpcmUoJy4vTW9kZWxJbnN0YW5jZScpLFxuICAgIF8gPSByZXF1aXJlKCcuL3V0aWwnKS5fO1xuXG4vKlxuIFRPRE86IFVzZSBFUzYgUHJveHkgaW5zdGVhZC5cbiBFdmVudHVhbGx5IHF1ZXJ5IHNldHMgc2hvdWxkIHVzZSBFUzYgUHJveGllcyB3aGljaCB3aWxsIGJlIG11Y2ggbW9yZSBuYXR1cmFsIGFuZCByb2J1c3QuIEUuZy4gbm8gbmVlZCBmb3IgdGhlIGJlbG93XG4gKi9cbnZhciBBUlJBWV9NRVRIT0RTID0gWydwdXNoJywgJ3NvcnQnLCAncmV2ZXJzZScsICdzcGxpY2UnLCAnc2hpZnQnLCAndW5zaGlmdCddLFxuICAgIE5VTUJFUl9NRVRIT0RTID0gWyd0b1N0cmluZycsICd0b0V4cG9uZW50aWFsJywgJ3RvRml4ZWQnLCAndG9QcmVjaXNpb24nLCAndmFsdWVPZiddLFxuICAgIE5VTUJFUl9QUk9QRVJUSUVTID0gWydNQVhfVkFMVUUnLCAnTUlOX1ZBTFVFJywgJ05FR0FUSVZFX0lORklOSVRZJywgJ05hTicsICdQT1NJVElWRV9JTkZJTklUWSddLFxuICAgIFNUUklOR19NRVRIT0RTID0gWydjaGFyQXQnLCAnY2hhckNvZGVBdCcsICdjb25jYXQnLCAnZnJvbUNoYXJDb2RlJywgJ2luZGV4T2YnLCAnbGFzdEluZGV4T2YnLCAnbG9jYWxlQ29tcGFyZScsXG4gICAgICAgICdtYXRjaCcsICdyZXBsYWNlJywgJ3NlYXJjaCcsICdzbGljZScsICdzcGxpdCcsICdzdWJzdHInLCAnc3Vic3RyaW5nJywgJ3RvTG9jYWxlTG93ZXJDYXNlJywgJ3RvTG9jYWxlVXBwZXJDYXNlJyxcbiAgICAgICAgJ3RvTG93ZXJDYXNlJywgJ3RvU3RyaW5nJywgJ3RvVXBwZXJDYXNlJywgJ3RyaW0nLCAndmFsdWVPZiddLFxuICAgIFNUUklOR19QUk9QRVJUSUVTID0gWydsZW5ndGgnXTtcblxuLyoqXG4gKiBSZXR1cm4gdGhlIHByb3BlcnR5IG5hbWVzIGZvciBhIGdpdmVuIG9iamVjdC4gSGFuZGxlcyBzcGVjaWFsIGNhc2VzIHN1Y2ggYXMgc3RyaW5ncyBhbmQgbnVtYmVycyB0aGF0IGRvIG5vdCBoYXZlXG4gKiB0aGUgZ2V0T3duUHJvcGVydHlOYW1lcyBmdW5jdGlvbi5cbiAqIFRoZSBzcGVjaWFsIGNhc2VzIGFyZSB2ZXJ5IG11Y2ggaGFja3MuIFRoaXMgaGFjayBjYW4gYmUgcmVtb3ZlZCBvbmNlIHRoZSBQcm94eSBvYmplY3QgaXMgbW9yZSB3aWRlbHkgYWRvcHRlZC5cbiAqIEBwYXJhbSBvYmplY3RcbiAqIEByZXR1cm5zIHtBcnJheX1cbiAqL1xuZnVuY3Rpb24gZ2V0UHJvcGVydHlOYW1lcyhvYmplY3QpIHtcbiAgICB2YXIgcHJvcGVydHlOYW1lcztcbiAgICBpZiAodHlwZW9mIG9iamVjdCA9PSAnc3RyaW5nJyB8fCBvYmplY3QgaW5zdGFuY2VvZiBTdHJpbmcpIHtcbiAgICAgICAgcHJvcGVydHlOYW1lcyA9IFNUUklOR19NRVRIT0RTLmNvbmNhdChTVFJJTkdfUFJPUEVSVElFUyk7XG4gICAgfVxuICAgIGVsc2UgaWYgKHR5cGVvZiBvYmplY3QgPT0gJ251bWJlcicgfHwgb2JqZWN0IGluc3RhbmNlb2YgTnVtYmVyKSB7XG4gICAgICAgIHByb3BlcnR5TmFtZXMgPSBOVU1CRVJfTUVUSE9EUy5jb25jYXQoTlVNQkVSX1BST1BFUlRJRVMpO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgcHJvcGVydHlOYW1lcyA9IG9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKCk7XG4gICAgfVxuICAgIHJldHVybiBwcm9wZXJ0eU5hbWVzO1xufVxuXG4vKipcbiAqIERlZmluZSBhIHByb3h5IHByb3BlcnR5IHRvIGF0dHJpYnV0ZXMgb24gb2JqZWN0cyBpbiB0aGUgYXJyYXlcbiAqIEBwYXJhbSBhcnJcbiAqIEBwYXJhbSBwcm9wXG4gKi9cbmZ1bmN0aW9uIGRlZmluZUF0dHJpYnV0ZShhcnIsIHByb3ApIHtcbiAgICBpZiAoIShwcm9wIGluIGFycikpIHsgLy8gZS5nLiB3ZSBjYW5ub3QgcmVkZWZpbmUgLmxlbmd0aFxuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoYXJyLCBwcm9wLCB7XG4gICAgICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gcXVlcnlTZXQoXy5wbHVjayhhcnIsIHByb3ApKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBzZXQ6IGZ1bmN0aW9uICh2KSB7XG4gICAgICAgICAgICAgICAgaWYgKHV0aWwuaXNBcnJheSh2KSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5sZW5ndGggIT0gdi5sZW5ndGgpIHRocm93IG5ldyBTaWVzdGFVc2VyRXJyb3Ioe21lc3NhZ2U6ICdNdXN0IGJlIHNhbWUgbGVuZ3RoJ30pO1xuICAgICAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHYubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXNbaV1bcHJvcF0gPSB2W2ldO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgdGhpcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpc1tpXVtwcm9wXSA9IHY7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gaXNQcm9taXNlKG9iaikge1xuICAgIC8vIFRPRE86IERvbid0IHRoaW5rIHRoaXMgaXMgdmVyeSByb2J1c3QuXG4gICAgcmV0dXJuIG9iai50aGVuICYmIG9iai5jYXRjaDtcbn1cblxuLyoqXG4gKiBEZWZpbmUgYSBwcm94eSBtZXRob2Qgb24gdGhlIGFycmF5IGlmIG5vdCBhbHJlYWR5IGluIGV4aXN0ZW5jZS5cbiAqIEBwYXJhbSBhcnJcbiAqIEBwYXJhbSBwcm9wXG4gKi9cbmZ1bmN0aW9uIGRlZmluZU1ldGhvZChhcnIsIHByb3ApIHtcbiAgICBpZiAoIShwcm9wIGluIGFycikpIHsgLy8gZS5nLiB3ZSBkb24ndCB3YW50IHRvIHJlZGVmaW5lIHRvU3RyaW5nXG4gICAgICAgIGFycltwcm9wXSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHZhciBhcmdzID0gYXJndW1lbnRzLFxuICAgICAgICAgICAgICAgIHJlcyA9IHRoaXMubWFwKGZ1bmN0aW9uIChwKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBwW3Byb3BdLmFwcGx5KHAsIGFyZ3MpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgdmFyIGFyZVByb21pc2VzID0gZmFsc2U7XG4gICAgICAgICAgICBpZiAocmVzLmxlbmd0aCkgYXJlUHJvbWlzZXMgPSBpc1Byb21pc2UocmVzWzBdKTtcbiAgICAgICAgICAgIHJldHVybiBhcmVQcm9taXNlcyA/IHdpbmRvdy5RLmFsbChyZXMpIDogcXVlcnlTZXQocmVzKTtcbiAgICAgICAgfTtcbiAgICB9XG59XG5cbi8qKlxuICogVHJhbnNmb3JtIHRoZSBhcnJheSBpbnRvIGEgcXVlcnkgc2V0LlxuICogUmVuZGVycyB0aGUgYXJyYXkgaW1tdXRhYmxlLlxuICogQHBhcmFtIGFyclxuICogQHBhcmFtIG1vZGVsIC0gVGhlIG1vZGVsIHdpdGggd2hpY2ggdG8gcHJveHkgdG9cbiAqL1xuZnVuY3Rpb24gbW9kZWxRdWVyeVNldChhcnIsIG1vZGVsKSB7XG4gICAgYXJyID0gXy5leHRlbmQoW10sIGFycik7XG4gICAgdmFyIGF0dHJpYnV0ZU5hbWVzID0gbW9kZWwuX2F0dHJpYnV0ZU5hbWVzLFxuICAgICAgICByZWxhdGlvbnNoaXBOYW1lcyA9IG1vZGVsLl9yZWxhdGlvbnNoaXBOYW1lcyxcbiAgICAgICAgbmFtZXMgPSBhdHRyaWJ1dGVOYW1lcy5jb25jYXQocmVsYXRpb25zaGlwTmFtZXMpLmNvbmNhdChpbnN0YW5jZU1ldGhvZHMpO1xuICAgIG5hbWVzLmZvckVhY2goXy5wYXJ0aWFsKGRlZmluZUF0dHJpYnV0ZSwgYXJyKSk7XG4gICAgdmFyIGluc3RhbmNlTWV0aG9kcyA9IE9iamVjdC5rZXlzKE1vZGVsSW5zdGFuY2UucHJvdG90eXBlKTtcbiAgICBpbnN0YW5jZU1ldGhvZHMuZm9yRWFjaChfLnBhcnRpYWwoZGVmaW5lTWV0aG9kLCBhcnIpKTtcbiAgICByZXR1cm4gcmVuZGVySW1tdXRhYmxlKGFycik7XG59XG5cbi8qKlxuICogVHJhbnNmb3JtIHRoZSBhcnJheSBpbnRvIGEgcXVlcnkgc2V0LCBiYXNlZCBvbiB3aGF0ZXZlciBpcyBpbiBpdC5cbiAqIE5vdGUgdGhhdCBhbGwgb2JqZWN0cyBtdXN0IGJlIG9mIHRoZSBzYW1lIHR5cGUuIFRoaXMgZnVuY3Rpb24gd2lsbCB0YWtlIHRoZSBmaXJzdCBvYmplY3QgYW5kIGRlY2lkZSBob3cgdG8gcHJveHlcbiAqIGJhc2VkIG9uIHRoYXQuXG4gKiBAcGFyYW0gYXJyXG4gKi9cbmZ1bmN0aW9uIHF1ZXJ5U2V0KGFycikge1xuICAgIGlmIChhcnIubGVuZ3RoKSB7XG4gICAgICAgIHZhciByZWZlcmVuY2VPYmplY3QgPSBhcnJbMF0sXG4gICAgICAgICAgICBwcm9wZXJ0eU5hbWVzID0gZ2V0UHJvcGVydHlOYW1lcyhyZWZlcmVuY2VPYmplY3QpO1xuICAgICAgICBwcm9wZXJ0eU5hbWVzLmZvckVhY2goZnVuY3Rpb24gKHByb3ApIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgcmVmZXJlbmNlT2JqZWN0W3Byb3BdID09ICdmdW5jdGlvbicpIGRlZmluZU1ldGhvZChhcnIsIHByb3AsIGFyZ3VtZW50cyk7XG4gICAgICAgICAgICBlbHNlIGRlZmluZUF0dHJpYnV0ZShhcnIsIHByb3ApO1xuICAgICAgICB9KTtcbiAgICB9XG4gICAgcmV0dXJuIHJlbmRlckltbXV0YWJsZShhcnIpO1xufVxuXG5mdW5jdGlvbiB0aHJvd0ltbXV0YWJsZUVycm9yKCkge1xuICAgIHRocm93IG5ldyBFcnJvcignQ2Fubm90IG1vZGlmeSBhIHF1ZXJ5IHNldCcpO1xufVxuXG4vKipcbiAqIFJlbmRlciBhbiBhcnJheSBpbW11dGFibGUgYnkgcmVwbGFjaW5nIGFueSBmdW5jdGlvbnMgdGhhdCBjYW4gbXV0YXRlIGl0LlxuICogQHBhcmFtIGFyclxuICovXG5mdW5jdGlvbiByZW5kZXJJbW11dGFibGUoYXJyKSB7XG4gICAgQVJSQVlfTUVUSE9EUy5mb3JFYWNoKGZ1bmN0aW9uIChwKSB7XG4gICAgICAgIGFycltwXSA9IHRocm93SW1tdXRhYmxlRXJyb3I7XG4gICAgfSk7XG4gICAgYXJyLmltbXV0YWJsZSA9IHRydWU7XG4gICAgYXJyLm11dGFibGVDb3B5ID0gYXJyLmFzQXJyYXkgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBtdXRhYmxlQXJyID0gXy5tYXAodGhpcywgZnVuY3Rpb24gKHgpIHtyZXR1cm4geH0pO1xuICAgICAgICBtdXRhYmxlQXJyLmFzUXVlcnlTZXQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gcXVlcnlTZXQodGhpcyk7XG4gICAgICAgIH07XG4gICAgICAgIG11dGFibGVBcnIuYXNNb2RlbFF1ZXJ5U2V0ID0gZnVuY3Rpb24gKG1vZGVsKSB7XG4gICAgICAgICAgICByZXR1cm4gbW9kZWxRdWVyeVNldCh0aGlzLCBtb2RlbCk7XG4gICAgICAgIH07XG4gICAgICAgIHJldHVybiBtdXRhYmxlQXJyO1xuICAgIH07XG4gICAgcmV0dXJuIGFycjtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBtb2RlbFF1ZXJ5U2V0OyIsIi8qKlxuICogRm9yIHRob3NlIGZhbWlsaWFyIHdpdGggQXBwbGUncyBDb2NvYSBsaWJyYXJ5LCByZWFjdGl2ZSBxdWVyaWVzIHJvdWdobHkgbWFwIG9udG8gTlNGZXRjaGVkUmVzdWx0c0NvbnRyb2xsZXIuXG4gKlxuICogVGhleSBwcmVzZW50IGEgcXVlcnkgc2V0IHRoYXQgJ3JlYWN0cycgdG8gY2hhbmdlcyBpbiB0aGUgdW5kZXJseWluZyBkYXRhLlxuICogQG1vZHVsZSByZWFjdGl2ZVF1ZXJ5XG4gKi9cblxudmFyIGxvZyA9IHJlcXVpcmUoJy4vbG9nJyksXG4gICAgUXVlcnkgPSByZXF1aXJlKCcuL3F1ZXJ5JyksXG4gICAgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnZXZlbnRzJykuRXZlbnRFbWl0dGVyLFxuICAgIGV2ZW50cyA9IHJlcXVpcmUoJy4vZXZlbnRzJyksXG4gICAgbW9kZWxFdmVudHMgPSByZXF1aXJlKCcuL21vZGVsRXZlbnRzJyksXG4gICAgSW50ZXJuYWxTaWVzdGFFcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKS5JbnRlcm5hbFNpZXN0YUVycm9yLFxuICAgIGNvbnN0cnVjdFF1ZXJ5U2V0ID0gcmVxdWlyZSgnLi9xdWVyeVNldCcpLFxuICAgIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKSxcbiAgICBfID0gdXRpbC5fO1xuXG52YXIgTG9nZ2VyID0gbG9nLmxvZ2dlcldpdGhOYW1lKCdRdWVyeScpO1xuXG4vKipcbiAqXG4gKiBAcGFyYW0ge1F1ZXJ5fSBxdWVyeSAtIFRoZSB1bmRlcmx5aW5nIHF1ZXJ5XG4gKiBAY29uc3RydWN0b3JcbiAqL1xuZnVuY3Rpb24gUmVhY3RpdmVRdWVyeShxdWVyeSkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBFdmVudEVtaXR0ZXIuY2FsbCh0aGlzKTtcblxuICAgIF8uZXh0ZW5kKHRoaXMsIHtcbiAgICAgICAgX3F1ZXJ5OiBxdWVyeSxcbiAgICAgICAgcmVzdWx0czogY29uc3RydWN0UXVlcnlTZXQoW10sIHF1ZXJ5Lm1vZGVsKSxcbiAgICAgICAgaW5zZXJ0aW9uUG9saWN5OiBSZWFjdGl2ZVF1ZXJ5Lkluc2VydGlvblBvbGljeS5CYWNrLFxuICAgICAgICBpbml0aWFsaXNlZDogZmFsc2VcbiAgICB9KTtcblxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKHRoaXMsIHtcbiAgICAgICAgaW5pdGlhbGl6ZWQ6IHtnZXQ6IGZ1bmN0aW9uICgpIHtyZXR1cm4gdGhpcy5pbml0aWFsaXNlZH19LFxuICAgICAgICBtb2RlbDoge2dldDogZnVuY3Rpb24gKCkgeyByZXR1cm4gc2VsZi5fcXVlcnkubW9kZWwgfX0sXG4gICAgICAgIGNvbGxlY3Rpb246IHtnZXQ6IGZ1bmN0aW9uICgpIHsgcmV0dXJuIHNlbGYubW9kZWwuY29sbGVjdGlvbk5hbWUgfX1cbiAgICB9KTtcbn1cblxuUmVhY3RpdmVRdWVyeS5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKEV2ZW50RW1pdHRlci5wcm90b3R5cGUpO1xuXG5fLmV4dGVuZChSZWFjdGl2ZVF1ZXJ5LCB7XG4gICAgSW5zZXJ0aW9uUG9saWN5OiB7XG4gICAgICAgIEZyb250OiAnRnJvbnQnLFxuICAgICAgICBCYWNrOiAnQmFjaydcbiAgICB9XG59KTtcblxuXy5leHRlbmQoUmVhY3RpdmVRdWVyeS5wcm90b3R5cGUsIHtcbiAgICBpbml0OiBmdW5jdGlvbiAoY2IpIHtcbiAgICAgICAgaWYgKExvZ2dlci50cmFjZSkgTG9nZ2VyLnRyYWNlKCdpbml0Jyk7XG4gICAgICAgIHZhciBkZWZlcnJlZCA9IHV0aWwuZGVmZXIoY2IpO1xuICAgICAgICBjYiA9IGRlZmVycmVkLmZpbmlzaC5iaW5kKGRlZmVycmVkKTtcbiAgICAgICAgaWYgKCF0aGlzLmluaXRpYWxpc2VkKSB7XG4gICAgICAgICAgICB0aGlzLl9xdWVyeS5leGVjdXRlKGZ1bmN0aW9uIChlcnIsIHJlc3VsdHMpIHtcbiAgICAgICAgICAgICAgICBpZiAoIWVycikge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnJlc3VsdHMgPSByZXN1bHRzO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIXRoaXMuaGFuZGxlcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG5hbWUgPSB0aGlzLl9jb25zdHJ1Y3ROb3RpZmljYXRpb25OYW1lKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgaGFuZGxlciA9IGZ1bmN0aW9uIChuKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5faGFuZGxlTm90aWYobik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9LmJpbmQodGhpcyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmhhbmRsZXIgPSBoYW5kbGVyO1xuICAgICAgICAgICAgICAgICAgICAgICAgZXZlbnRzLm9uKG5hbWUsIGhhbmRsZXIpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmIChMb2dnZXIudHJhY2UpIExvZ2dlci50cmFjZSgnTGlzdGVuaW5nIHRvICcgKyBuYW1lKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5pbml0aWFsaXNlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIGNiKG51bGwsIHRoaXMucmVzdWx0cyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBjYihlcnIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBjYihudWxsLCB0aGlzLnJlc3VsdHMpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xuICAgIH0sXG4gICAgaW5zZXJ0OiBmdW5jdGlvbiAobmV3T2JqKSB7XG4gICAgICAgIHZhciByZXN1bHRzID0gdGhpcy5yZXN1bHRzLm11dGFibGVDb3B5KCk7XG4gICAgICAgIGlmICh0aGlzLmluc2VydGlvblBvbGljeSA9PSBSZWFjdGl2ZVF1ZXJ5Lkluc2VydGlvblBvbGljeS5CYWNrKSB7XG4gICAgICAgICAgICB2YXIgaWR4ID0gcmVzdWx0cy5wdXNoKG5ld09iaik7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBpZHggPSByZXN1bHRzLnVuc2hpZnQobmV3T2JqKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnJlc3VsdHMgPSByZXN1bHRzLmFzTW9kZWxRdWVyeVNldCh0aGlzLm1vZGVsKTtcbiAgICAgICAgcmV0dXJuIGlkeDtcbiAgICB9LFxuICAgIF9oYW5kbGVOb3RpZjogZnVuY3Rpb24gKG4pIHtcbiAgICAgICAgaWYgKExvZ2dlci50cmFjZSkgTG9nZ2VyLnRyYWNlKCdfaGFuZGxlTm90aWYnLCBuKTtcbiAgICAgICAgaWYgKG4udHlwZSA9PSBtb2RlbEV2ZW50cy5Nb2RlbEV2ZW50VHlwZS5OZXcpIHtcbiAgICAgICAgICAgIHZhciBuZXdPYmogPSBuLm5ldztcbiAgICAgICAgICAgIGlmICh0aGlzLl9xdWVyeS5vYmplY3RNYXRjaGVzUXVlcnkobmV3T2JqKSkge1xuICAgICAgICAgICAgICAgIGlmIChMb2dnZXIudHJhY2UpIExvZ2dlci50cmFjZSgnTmV3IG9iamVjdCBtYXRjaGVzJywgbmV3T2JqLl9kdW1wU3RyaW5nKCkpO1xuICAgICAgICAgICAgICAgIHZhciBpZHggPSB0aGlzLmluc2VydChuZXdPYmopO1xuICAgICAgICAgICAgICAgIHRoaXMuZW1pdCgnY2hhbmdlJywgdGhpcy5yZXN1bHRzLCB7XG4gICAgICAgICAgICAgICAgICAgIGluZGV4OiBpZHgsXG4gICAgICAgICAgICAgICAgICAgIGFkZGVkOiBbbmV3T2JqXSxcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogbW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUuU3BsaWNlLFxuICAgICAgICAgICAgICAgICAgICBvYmo6IHRoaXNcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmIChMb2dnZXIudHJhY2UpIExvZ2dlci50cmFjZSgnTmV3IG9iamVjdCBkb2VzIG5vdCBtYXRjaCcsIG5ld09iai5fZHVtcFN0cmluZygpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChuLnR5cGUgPT0gbW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUuU2V0KSB7XG4gICAgICAgICAgICBuZXdPYmogPSBuLm9iajtcbiAgICAgICAgICAgIHZhciBpbmRleCA9IHRoaXMucmVzdWx0cy5pbmRleE9mKG5ld09iaiksXG4gICAgICAgICAgICAgICAgYWxyZWFkeUNvbnRhaW5zID0gaW5kZXggPiAtMSxcbiAgICAgICAgICAgICAgICBtYXRjaGVzID0gdGhpcy5fcXVlcnkub2JqZWN0TWF0Y2hlc1F1ZXJ5KG5ld09iaik7XG4gICAgICAgICAgICBpZiAobWF0Y2hlcyAmJiAhYWxyZWFkeUNvbnRhaW5zKSB7XG4gICAgICAgICAgICAgICAgaWYgKExvZ2dlci50cmFjZSkgTG9nZ2VyLnRyYWNlKCdVcGRhdGVkIG9iamVjdCBub3cgbWF0Y2hlcyEnLCBuZXdPYmouX2R1bXBTdHJpbmcoKSk7XG4gICAgICAgICAgICAgICAgaWR4ID0gdGhpcy5pbnNlcnQobmV3T2JqKTtcbiAgICAgICAgICAgICAgICB0aGlzLmVtaXQoJ2NoYW5nZScsIHRoaXMucmVzdWx0cywge1xuICAgICAgICAgICAgICAgICAgICBpbmRleDogaWR4LFxuICAgICAgICAgICAgICAgICAgICBhZGRlZDogW25ld09ial0sXG4gICAgICAgICAgICAgICAgICAgIHR5cGU6IG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlLlNwbGljZSxcbiAgICAgICAgICAgICAgICAgICAgb2JqOiB0aGlzXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmICghbWF0Y2hlcyAmJiBhbHJlYWR5Q29udGFpbnMpIHtcbiAgICAgICAgICAgICAgICBpZiAoTG9nZ2VyLnRyYWNlKSBMb2dnZXIudHJhY2UoJ1VwZGF0ZWQgb2JqZWN0IG5vIGxvbmdlciBtYXRjaGVzIScsIG5ld09iai5fZHVtcFN0cmluZygpKTtcbiAgICAgICAgICAgICAgICByZXN1bHRzID0gdGhpcy5yZXN1bHRzLm11dGFibGVDb3B5KCk7XG4gICAgICAgICAgICAgICAgdmFyIHJlbW92ZWQgPSByZXN1bHRzLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgICAgICAgICAgdGhpcy5yZXN1bHRzID0gcmVzdWx0cy5hc01vZGVsUXVlcnlTZXQodGhpcy5tb2RlbCk7XG4gICAgICAgICAgICAgICAgdGhpcy5lbWl0KCdjaGFuZ2UnLCB0aGlzLnJlc3VsdHMsIHtcbiAgICAgICAgICAgICAgICAgICAgaW5kZXg6IGluZGV4LFxuICAgICAgICAgICAgICAgICAgICBvYmo6IHRoaXMsXG4gICAgICAgICAgICAgICAgICAgIG5ldzogbmV3T2JqLFxuICAgICAgICAgICAgICAgICAgICB0eXBlOiBtb2RlbEV2ZW50cy5Nb2RlbEV2ZW50VHlwZS5TcGxpY2UsXG4gICAgICAgICAgICAgICAgICAgIHJlbW92ZWQ6IHJlbW92ZWRcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKCFtYXRjaGVzICYmICFhbHJlYWR5Q29udGFpbnMpIHtcbiAgICAgICAgICAgICAgICBpZiAoTG9nZ2VyLnRyYWNlKSBMb2dnZXIudHJhY2UoJ0RvZXMgbm90IGNvbnRhaW4sIGJ1dCBkb2VzbnQgbWF0Y2ggc28gbm90IGluc2VydGluZycsIG5ld09iai5fZHVtcFN0cmluZygpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKG1hdGNoZXMgJiYgYWxyZWFkeUNvbnRhaW5zKSB7XG4gICAgICAgICAgICAgICAgaWYgKExvZ2dlci50cmFjZSkgTG9nZ2VyLnRyYWNlKCdNYXRjaGVzIGJ1dCBhbHJlYWR5IGNvbnRhaW5zJywgbmV3T2JqLl9kdW1wU3RyaW5nKCkpO1xuICAgICAgICAgICAgICAgIC8vIFNlbmQgdGhlIG5vdGlmaWNhdGlvbiBvdmVyLiBcbiAgICAgICAgICAgICAgICB0aGlzLmVtaXQoJ2NoYW5nZScsIHRoaXMucmVzdWx0cywgbik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAobi50eXBlID09IG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlLlJlbW92ZSkge1xuICAgICAgICAgICAgbmV3T2JqID0gbi5vYmo7XG4gICAgICAgICAgICB2YXIgcmVzdWx0cyA9IHRoaXMucmVzdWx0cy5tdXRhYmxlQ29weSgpO1xuICAgICAgICAgICAgaW5kZXggPSByZXN1bHRzLmluZGV4T2YobmV3T2JqKTtcbiAgICAgICAgICAgIGlmIChpbmRleCA+IC0xKSB7XG4gICAgICAgICAgICAgICAgaWYgKExvZ2dlci50cmFjZSkgTG9nZ2VyLnRyYWNlKCdSZW1vdmluZyBvYmplY3QnLCBuZXdPYmouX2R1bXBTdHJpbmcoKSk7XG4gICAgICAgICAgICAgICAgcmVtb3ZlZCA9IHJlc3VsdHMuc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgICAgICAgICB0aGlzLnJlc3VsdHMgPSBjb25zdHJ1Y3RRdWVyeVNldChyZXN1bHRzLCB0aGlzLm1vZGVsKTtcbiAgICAgICAgICAgICAgICB0aGlzLmVtaXQoJ2NoYW5nZScsIHRoaXMucmVzdWx0cywge1xuICAgICAgICAgICAgICAgICAgICBpbmRleDogaW5kZXgsXG4gICAgICAgICAgICAgICAgICAgIG9iajogdGhpcyxcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogbW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUuU3BsaWNlLFxuICAgICAgICAgICAgICAgICAgICByZW1vdmVkOiByZW1vdmVkXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZiAoTG9nZ2VyLnRyYWNlKSBMb2dnZXIudHJhY2UoJ05vIG1vZGVsRXZlbnRzIG5lY2Nlc3NhcnkuJywgbmV3T2JqLl9kdW1wU3RyaW5nKCkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ1Vua25vd24gY2hhbmdlIHR5cGUgXCInICsgbi50eXBlLnRvU3RyaW5nKCkgKyAnXCInKVxuICAgICAgICB9XG4gICAgICAgIHRoaXMucmVzdWx0cyA9IGNvbnN0cnVjdFF1ZXJ5U2V0KHRoaXMuX3F1ZXJ5Ll9zb3J0UmVzdWx0cyh0aGlzLnJlc3VsdHMpLCB0aGlzLm1vZGVsKTtcbiAgICB9LFxuICAgIF9jb25zdHJ1Y3ROb3RpZmljYXRpb25OYW1lOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLm1vZGVsLmNvbGxlY3Rpb25OYW1lICsgJzonICsgdGhpcy5tb2RlbC5uYW1lO1xuICAgIH0sXG4gICAgdGVybWluYXRlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmICh0aGlzLmhhbmRsZXIpIHtcbiAgICAgICAgICAgIGV2ZW50cy5yZW1vdmVMaXN0ZW5lcih0aGlzLl9jb25zdHJ1Y3ROb3RpZmljYXRpb25OYW1lKCksIHRoaXMuaGFuZGxlcik7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5yZXN1bHRzID0gbnVsbDtcbiAgICAgICAgdGhpcy5oYW5kbGVyID0gbnVsbDtcbiAgICB9LFxuICAgIGxpc3RlbjogZnVuY3Rpb24gKGZuKSB7XG4gICAgICAgIHRoaXMub24oJ2NoYW5nZScsIGZuKTtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIoJ2NoYW5nZScsIGZuKTtcbiAgICAgICAgfS5iaW5kKHRoaXMpO1xuICAgIH0sXG4gICAgbGlzdGVuT25jZTogZnVuY3Rpb24gKGZuKSB7XG4gICAgICAgIHRoaXMub25jZSgnY2hhbmdlJywgZm4pO1xuICAgIH1cbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFJlYWN0aXZlUXVlcnk7IiwiLyoqXG4gKiBUaGUgXCJzdG9yZVwiIGlzIHJlc3BvbnNpYmxlIGZvciBtZWRpYXRpbmcgYmV0d2VlbiB0aGUgaW4tbWVtb3J5IGNhY2hlIGFuZCBhbnkgcGVyc2lzdGVudCBzdG9yYWdlLlxuICogTm90ZSB0aGF0IHBlcnNpc3RlbnQgc3RvcmFnZSBoYXMgbm90IGJlZW4gcHJvcGVybHkgaW1wbGVtZW50ZWQgeWV0IGFuZCBzbyB0aGlzIGlzIHByZXR0eSB1c2VsZXNzLlxuICogQWxsIHF1ZXJpZXMgd2lsbCBnbyBzdHJhaWdodCB0byB0aGUgY2FjaGUgaW5zdGVhZC5cbiAqIEBtb2R1bGUgc3RvcmVcbiAqL1xuXG52YXIgSW50ZXJuYWxTaWVzdGFFcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKS5JbnRlcm5hbFNpZXN0YUVycm9yLFxuICAgIGxvZyA9IHJlcXVpcmUoJy4vbG9nJyksXG4gICAgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpLFxuICAgIF8gPSB1dGlsLl8sXG4gICAgY2FjaGUgPSByZXF1aXJlKCcuL2NhY2hlJyk7XG5cblxudmFyIExvZ2dlciA9IGxvZy5sb2dnZXJXaXRoTmFtZSgnU3RvcmUnKTtcblxuLyoqXG4gKiBbZ2V0IGRlc2NyaXB0aW9uXVxuICogQHBhcmFtICB7T2JqZWN0fSAgIG9wdHNcbiAqIEBwYXJhbSAge0Z1bmN0aW9ufSBjYWxsYmFja1xuICogQHJldHVybiB7UHJvbWlzZX1cbiAqIEBleGFtcGxlXG4gKiBgYGBqc1xuICogdmFyIHh5eiA9ICdhZnNkZic7XG4gKiBgYGBcbiAqIEBleGFtcGxlXG4gKiBgYGBqc1xuICogdmFyIGFiYyA9ICdhc2RzZCc7XG4gKiBgYGBcbiAqL1xuZnVuY3Rpb24gZ2V0KG9wdHMsIGNhbGxiYWNrKSB7XG4gICAgdmFyIGRlZmVycmVkID0gdXRpbC5kZWZlcihjYWxsYmFjayk7XG4gICAgY2FsbGJhY2sgPSBkZWZlcnJlZC5maW5pc2guYmluZChkZWZlcnJlZCk7XG4gICAgaWYgKExvZ2dlci5kZWJ1Zy5pc0VuYWJsZWQpXG4gICAgICAgIExvZ2dlci5kZWJ1ZygnZ2V0Jywgb3B0cyk7XG4gICAgdmFyIHNpZXN0YU1vZGVsO1xuICAgIGlmIChvcHRzLl9pZCkge1xuICAgICAgICBpZiAodXRpbC5pc0FycmF5KG9wdHMuX2lkKSkge1xuICAgICAgICAgICAgLy8gUHJveHkgb250byBnZXRNdWx0aXBsZSBpbnN0ZWFkLlxuICAgICAgICAgICAgZ2V0TXVsdGlwbGUoXy5tYXAob3B0cy5faWQsIGZ1bmN0aW9uIChpZCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgIF9pZDogaWRcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KSwgY2FsbGJhY2spO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc2llc3RhTW9kZWwgPSBjYWNoZS5nZXQob3B0cyk7XG4gICAgICAgICAgICBpZiAoc2llc3RhTW9kZWwpIHtcbiAgICAgICAgICAgICAgICBpZiAoTG9nZ2VyLmRlYnVnLmlzRW5hYmxlZClcbiAgICAgICAgICAgICAgICAgICAgTG9nZ2VyLmRlYnVnKCdIYWQgY2FjaGVkIG9iamVjdCcsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG9wdHM6IG9wdHMsXG4gICAgICAgICAgICAgICAgICAgICAgICBvYmo6IHNpZXN0YU1vZGVsXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2sobnVsbCwgc2llc3RhTW9kZWwpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZiAodXRpbC5pc0FycmF5KG9wdHMuX2lkKSkge1xuICAgICAgICAgICAgICAgICAgICAvLyBQcm94eSBvbnRvIGdldE11bHRpcGxlIGluc3RlYWQuXG4gICAgICAgICAgICAgICAgICAgIGdldE11bHRpcGxlKF8ubWFwKG9wdHMuX2lkLCBmdW5jdGlvbiAoaWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgX2lkOiBpZFxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9KSwgY2FsbGJhY2spO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHN0b3JhZ2UgPSBzaWVzdGEuZXh0LnN0b3JhZ2U7XG4gICAgICAgICAgICAgICAgICAgIGlmIChzdG9yYWdlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzdG9yYWdlLnN0b3JlLmdldEZyb21Qb3VjaChvcHRzLCBjYWxsYmFjayk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1N0b3JhZ2UgbW9kdWxlIG5vdCBpbnN0YWxsZWQnKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0gZWxzZSBpZiAob3B0cy5tb2RlbCkge1xuICAgICAgICBpZiAodXRpbC5pc0FycmF5KG9wdHNbb3B0cy5tb2RlbC5pZF0pKSB7XG4gICAgICAgICAgICAvLyBQcm94eSBvbnRvIGdldE11bHRpcGxlIGluc3RlYWQuXG4gICAgICAgICAgICBnZXRNdWx0aXBsZShfLm1hcChvcHRzW29wdHMubW9kZWwuaWRdLCBmdW5jdGlvbiAoaWQpIHtcbiAgICAgICAgICAgICAgICB2YXIgbyA9IHt9O1xuICAgICAgICAgICAgICAgIG9bb3B0cy5tb2RlbC5pZF0gPSBpZDtcbiAgICAgICAgICAgICAgICBvLm1vZGVsID0gb3B0cy5tb2RlbDtcbiAgICAgICAgICAgICAgICByZXR1cm4gb1xuICAgICAgICAgICAgfSksIGNhbGxiYWNrKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHNpZXN0YU1vZGVsID0gY2FjaGUuZ2V0KG9wdHMpO1xuICAgICAgICAgICAgaWYgKHNpZXN0YU1vZGVsKSB7XG4gICAgICAgICAgICAgICAgaWYgKExvZ2dlci5kZWJ1Zy5pc0VuYWJsZWQpXG4gICAgICAgICAgICAgICAgICAgIExvZ2dlci5kZWJ1ZygnSGFkIGNhY2hlZCBvYmplY3QnLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICBvcHRzOiBvcHRzLFxuICAgICAgICAgICAgICAgICAgICAgICAgb2JqOiBzaWVzdGFNb2RlbFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKG51bGwsIHNpZXN0YU1vZGVsKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdmFyIG1vZGVsID0gb3B0cy5tb2RlbDtcbiAgICAgICAgICAgICAgICBpZiAobW9kZWwuc2luZ2xldG9uKSB7XG4gICAgICAgICAgICAgICAgICAgIG1vZGVsLm9uZShjYWxsYmFjayk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGlkRmllbGQgPSBtb2RlbC5pZDtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGlkID0gb3B0c1tpZEZpZWxkXTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIG9uZU9wdHMgPSB7fTtcbiAgICAgICAgICAgICAgICAgICAgb25lT3B0c1tpZEZpZWxkXSA9IGlkO1xuICAgICAgICAgICAgICAgICAgICBpZiAoaWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG1vZGVsLm9uZShvbmVPcHRzLCBmdW5jdGlvbiAoZXJyLCBvYmopIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAob2JqKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhudWxsLCBvYmopO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2sobnVsbCwgbnVsbCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ0ludmFsaWQgb3B0aW9ucyBnaXZlbiB0byBzdG9yZS4gTWlzc2luZyBcIicgKyBpZEZpZWxkLnRvU3RyaW5nKCkgKyAnLlwiJyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIE5vIHdheSBpbiB3aGljaCB0byBmaW5kIGFuIG9iamVjdCBsb2NhbGx5LlxuICAgICAgICB2YXIgY29udGV4dCA9IHtcbiAgICAgICAgICAgIG9wdHM6IG9wdHNcbiAgICAgICAgfTtcbiAgICAgICAgdmFyIG1zZyA9ICdJbnZhbGlkIG9wdGlvbnMgZ2l2ZW4gdG8gc3RvcmUnO1xuICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcihtc2csIGNvbnRleHQpO1xuICAgIH1cbiAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbn1cblxuZnVuY3Rpb24gZ2V0TXVsdGlwbGUob3B0c0FycmF5LCBjYWxsYmFjaykge1xuICAgIHZhciBkZWZlcnJlZCA9IHV0aWwuZGVmZXIoY2FsbGJhY2spO1xuICAgIGNhbGxiYWNrID0gZGVmZXJyZWQuZmluaXNoLmJpbmQoZGVmZXJyZWQpO1xuICAgIHZhciBkb2NzID0gW107XG4gICAgdmFyIGVycm9ycyA9IFtdO1xuICAgIF8uZWFjaChvcHRzQXJyYXksIGZ1bmN0aW9uIChvcHRzKSB7XG4gICAgICAgIGdldChvcHRzLCBmdW5jdGlvbiAoZXJyLCBkb2MpIHtcbiAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICBlcnJvcnMucHVzaChlcnIpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBkb2NzLnB1c2goZG9jKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChkb2NzLmxlbmd0aCArIGVycm9ycy5sZW5ndGggPT0gb3B0c0FycmF5Lmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIGlmIChjYWxsYmFjaykge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZXJyb3JzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyb3JzKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIGRvY3MpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9KTtcbiAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbn1cbi8qKlxuICogVXNlcyBwb3VjaCBidWxrIGZldGNoIEFQSS4gTXVjaCBmYXN0ZXIgdGhhbiBnZXRNdWx0aXBsZS5cbiAqIEBwYXJhbSBsb2NhbElkZW50aWZpZXJzXG4gKiBAcGFyYW0gY2FsbGJhY2tcbiAqL1xuZnVuY3Rpb24gZ2V0TXVsdGlwbGVMb2NhbChsb2NhbElkZW50aWZpZXJzLCBjYWxsYmFjaykge1xuICAgIHZhciBkZWZlcnJlZCA9IHV0aWwuZGVmZXIoY2FsbGJhY2spO1xuICAgIGNhbGxiYWNrID0gZGVmZXJyZWQuZmluaXNoLmJpbmQoZGVmZXJyZWQpO1xuICAgIHZhciByZXN1bHRzID0gXy5yZWR1Y2UobG9jYWxJZGVudGlmaWVycywgZnVuY3Rpb24gKG1lbW8sIF9pZCkge1xuICAgICAgICB2YXIgb2JqID0gY2FjaGUuZ2V0KHtcbiAgICAgICAgICAgIF9pZDogX2lkXG4gICAgICAgIH0pO1xuICAgICAgICBpZiAob2JqKSB7XG4gICAgICAgICAgICBtZW1vLmNhY2hlZFtfaWRdID0gb2JqO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbWVtby5ub3RDYWNoZWQucHVzaChfaWQpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBtZW1vO1xuICAgIH0sIHtcbiAgICAgICAgY2FjaGVkOiB7fSxcbiAgICAgICAgbm90Q2FjaGVkOiBbXVxuICAgIH0pO1xuXG4gICAgZnVuY3Rpb24gZmluaXNoKGVycikge1xuICAgICAgICBpZiAoY2FsbGJhY2spIHtcbiAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhudWxsLCBfLm1hcChsb2NhbElkZW50aWZpZXJzLCBmdW5jdGlvbiAoX2lkKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiByZXN1bHRzLmNhY2hlZFtfaWRdO1xuICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuLy8gICAgaWYgKHNpZXN0YS5leHQuc3RvcmFnZUVuYWJsZWQgJiYgcmVzdWx0cy5ub3RDYWNoZWQubGVuZ3RoKSB7XG4vLyAgICAgICAgc2llc3RhLmV4dC5zdG9yYWdlLnN0b3JlLmdldE11bHRpcGxlTG9jYWxGcm9tQ291Y2gocmVzdWx0cywgZmluaXNoKTtcbi8vICAgIH0gZWxzZSB7XG4gICAgZmluaXNoKCk7XG4vLyAgICB9XG4gICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG59XG5cbmZ1bmN0aW9uIGdldE11bHRpcGxlUmVtb3RlKHJlbW90ZUlkZW50aWZpZXJzLCBtb2RlbCwgY2FsbGJhY2spIHtcbiAgICB2YXIgZGVmZXJyZWQgPSB1dGlsLmRlZmVyKGNhbGxiYWNrKTtcbiAgICBjYWxsYmFjayA9IGRlZmVycmVkLmZpbmlzaC5iaW5kKGRlZmVycmVkKTtcbiAgICB2YXIgcmVzdWx0cyA9IF8ucmVkdWNlKHJlbW90ZUlkZW50aWZpZXJzLCBmdW5jdGlvbiAobWVtbywgaWQpIHtcbiAgICAgICAgdmFyIGNhY2hlUXVlcnkgPSB7XG4gICAgICAgICAgICBtb2RlbDogbW9kZWxcbiAgICAgICAgfTtcbiAgICAgICAgY2FjaGVRdWVyeVttb2RlbC5pZF0gPSBpZDtcbiAgICAgICAgdmFyIG9iaiA9IGNhY2hlLmdldChjYWNoZVF1ZXJ5KTtcbiAgICAgICAgaWYgKG9iaikge1xuICAgICAgICAgICAgbWVtby5jYWNoZWRbaWRdID0gb2JqO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbWVtby5ub3RDYWNoZWQucHVzaChpZCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG1lbW87XG4gICAgfSwge1xuICAgICAgICBjYWNoZWQ6IHt9LFxuICAgICAgICBub3RDYWNoZWQ6IFtdXG4gICAgfSk7XG5cbiAgICBmdW5jdGlvbiBmaW5pc2goZXJyKSB7XG4gICAgICAgIGlmIChjYWxsYmFjaykge1xuICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIF8ubWFwKHJlbW90ZUlkZW50aWZpZXJzLCBmdW5jdGlvbiAoaWQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHJlc3VsdHMuY2FjaGVkW2lkXTtcbiAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmaW5pc2goKTtcbiAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gICAgZ2V0OiBnZXQsXG4gICAgZ2V0TXVsdGlwbGU6IGdldE11bHRpcGxlLFxuICAgIGdldE11bHRpcGxlTG9jYWw6IGdldE11bHRpcGxlTG9jYWwsXG4gICAgZ2V0TXVsdGlwbGVSZW1vdGU6IGdldE11bHRpcGxlUmVtb3RlXG59O1xuIiwidmFyIG1pc2MgPSByZXF1aXJlKCcuL21pc2MnKSxcbiAgICBfID0gcmVxdWlyZSgnLi91bmRlcnNjb3JlJyk7XG5cbmZ1bmN0aW9uIGRvUGFyYWxsZWwoZm4pIHtcbiAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cyk7XG4gICAgICAgIHJldHVybiBmbi5hcHBseShudWxsLCBbZWFjaF0uY29uY2F0KGFyZ3MpKTtcbiAgICB9O1xufVxuXG52YXIgbWFwID0gZG9QYXJhbGxlbChfYXN5bmNNYXApO1xuXG52YXIgcm9vdDtcblxuZnVuY3Rpb24gX21hcChhcnIsIGl0ZXJhdG9yKSB7XG4gICAgaWYgKGFyci5tYXApIHtcbiAgICAgICAgcmV0dXJuIGFyci5tYXAoaXRlcmF0b3IpO1xuICAgIH1cbiAgICB2YXIgcmVzdWx0cyA9IFtdO1xuICAgIGVhY2goYXJyLCBmdW5jdGlvbiAoeCwgaSwgYSkge1xuICAgICAgICByZXN1bHRzLnB1c2goaXRlcmF0b3IoeCwgaSwgYSkpO1xuICAgIH0pO1xuICAgIHJldHVybiByZXN1bHRzO1xufVxuXG5mdW5jdGlvbiBfYXN5bmNNYXAoZWFjaGZuLCBhcnIsIGl0ZXJhdG9yLCBjYWxsYmFjaykge1xuICAgIGFyciA9IF9tYXAoYXJyLCBmdW5jdGlvbiAoeCwgaSkge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgaW5kZXg6IGksXG4gICAgICAgICAgICB2YWx1ZTogeFxuICAgICAgICB9O1xuICAgIH0pO1xuICAgIGlmICghY2FsbGJhY2spIHtcbiAgICAgICAgZWFjaGZuKGFyciwgZnVuY3Rpb24gKHgsIGNhbGxiYWNrKSB7XG4gICAgICAgICAgICBpdGVyYXRvcih4LnZhbHVlLCBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgICB2YXIgcmVzdWx0cyA9IFtdO1xuICAgICAgICBlYWNoZm4oYXJyLCBmdW5jdGlvbiAoeCwgY2FsbGJhY2spIHtcbiAgICAgICAgICAgIGl0ZXJhdG9yKHgudmFsdWUsIGZ1bmN0aW9uIChlcnIsIHYpIHtcbiAgICAgICAgICAgICAgICByZXN1bHRzW3guaW5kZXhdID0gdjtcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0sIGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgIGNhbGxiYWNrKGVyciwgcmVzdWx0cyk7XG4gICAgICAgIH0pO1xuICAgIH1cbn1cblxudmFyIG1hcFNlcmllcyA9IGRvU2VyaWVzKF9hc3luY01hcCk7XG5cbmZ1bmN0aW9uIGRvU2VyaWVzKGZuKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuICAgICAgICByZXR1cm4gZm4uYXBwbHkobnVsbCwgW2VhY2hTZXJpZXNdLmNvbmNhdChhcmdzKSk7XG4gICAgfTtcbn1cblxuXG5mdW5jdGlvbiBlYWNoU2VyaWVzKGFyciwgaXRlcmF0b3IsIGNhbGxiYWNrKSB7XG4gICAgY2FsbGJhY2sgPSBjYWxsYmFjayB8fCBmdW5jdGlvbiAoKSB7fTtcbiAgICBpZiAoIWFyci5sZW5ndGgpIHtcbiAgICAgICAgcmV0dXJuIGNhbGxiYWNrKCk7XG4gICAgfVxuICAgIHZhciBjb21wbGV0ZWQgPSAwO1xuICAgIHZhciBpdGVyYXRlID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBpdGVyYXRvcihhcnJbY29tcGxldGVkXSwgZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2sgPSBmdW5jdGlvbiAoKSB7fTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29tcGxldGVkICs9IDE7XG4gICAgICAgICAgICAgICAgaWYgKGNvbXBsZXRlZCA+PSBhcnIubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgaXRlcmF0ZSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfTtcbiAgICBpdGVyYXRlKCk7XG59XG5cblxuZnVuY3Rpb24gX2VhY2goYXJyLCBpdGVyYXRvcikge1xuICAgIGlmIChhcnIuZm9yRWFjaCkge1xuICAgICAgICByZXR1cm4gYXJyLmZvckVhY2goaXRlcmF0b3IpO1xuICAgIH1cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGFyci5sZW5ndGg7IGkgKz0gMSkge1xuICAgICAgICBpdGVyYXRvcihhcnJbaV0sIGksIGFycik7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBlYWNoKGFyciwgaXRlcmF0b3IsIGNhbGxiYWNrKSB7XG4gICAgY2FsbGJhY2sgPSBjYWxsYmFjayB8fCBmdW5jdGlvbiAoKSB7fTtcbiAgICBpZiAoIWFyci5sZW5ndGgpIHtcbiAgICAgICAgcmV0dXJuIGNhbGxiYWNrKCk7XG4gICAgfVxuICAgIHZhciBjb21wbGV0ZWQgPSAwO1xuICAgIF9lYWNoKGFyciwgZnVuY3Rpb24gKHgpIHtcbiAgICAgICAgaXRlcmF0b3IoeCwgb25seV9vbmNlKGRvbmUpKTtcbiAgICB9KTtcblxuICAgIGZ1bmN0aW9uIGRvbmUoZXJyKSB7XG4gICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICBjYWxsYmFjayA9IGZ1bmN0aW9uICgpIHt9O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29tcGxldGVkICs9IDE7XG4gICAgICAgICAgICBpZiAoY29tcGxldGVkID49IGFyci5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufVxuXG5cblxuXG52YXIgX3BhcmFsbGVsID0gZnVuY3Rpb24gKGVhY2hmbiwgdGFza3MsIGNhbGxiYWNrKSB7XG4gICAgY2FsbGJhY2sgPSBjYWxsYmFjayB8fCBmdW5jdGlvbiAoKSB7fTtcbiAgICBpZiAobWlzYy5pc0FycmF5KHRhc2tzKSkge1xuICAgICAgICBlYWNoZm4ubWFwKHRhc2tzLCBmdW5jdGlvbiAoZm4sIGNhbGxiYWNrKSB7XG4gICAgICAgICAgICBpZiAoZm4pIHtcbiAgICAgICAgICAgICAgICBmbihmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGFyZ3MubGVuZ3RoIDw9IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFyZ3MgPSBhcmdzWzBdO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrLmNhbGwobnVsbCwgZXJyLCBhcmdzKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSwgY2FsbGJhY2spO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHZhciByZXN1bHRzID0ge307XG4gICAgICAgIGVhY2hmbi5lYWNoKE9iamVjdC5rZXlzKHRhc2tzKSwgZnVuY3Rpb24gKGssIGNhbGxiYWNrKSB7XG4gICAgICAgICAgICB0YXNrc1trXShmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgICAgICAgICAgICAgIGlmIChhcmdzLmxlbmd0aCA8PSAxKSB7XG4gICAgICAgICAgICAgICAgICAgIGFyZ3MgPSBhcmdzWzBdO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXN1bHRzW2tdID0gYXJncztcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0sIGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgIGNhbGxiYWNrKGVyciwgcmVzdWx0cyk7XG4gICAgICAgIH0pO1xuICAgIH1cbn07XG5cbmZ1bmN0aW9uIHNlcmllcyh0YXNrcywgY2FsbGJhY2spIHtcbiAgICBjYWxsYmFjayA9IGNhbGxiYWNrIHx8IGZ1bmN0aW9uICgpIHt9O1xuICAgIGlmIChtaXNjLmlzQXJyYXkodGFza3MpKSB7XG4gICAgICAgIG1hcFNlcmllcyh0YXNrcywgZnVuY3Rpb24gKGZuLCBjYWxsYmFjaykge1xuICAgICAgICAgICAgaWYgKGZuKSB7XG4gICAgICAgICAgICAgICAgZm4oZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgICAgICAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChhcmdzLmxlbmd0aCA8PSAxKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhcmdzID0gYXJnc1swXTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjay5jYWxsKG51bGwsIGVyciwgYXJncyk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sIGNhbGxiYWNrKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICB2YXIgcmVzdWx0cyA9IHt9O1xuICAgICAgICBlYWNoU2VyaWVzKF8ua2V5cyh0YXNrcyksIGZ1bmN0aW9uIChrLCBjYWxsYmFjaykge1xuICAgICAgICAgICAgdGFza3Nba10oZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICAgICAgICAgICAgICBpZiAoYXJncy5sZW5ndGggPD0gMSkge1xuICAgICAgICAgICAgICAgICAgICBhcmdzID0gYXJnc1swXTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmVzdWx0c1trXSA9IGFyZ3M7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9LCBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICBjYWxsYmFjayhlcnIsIHJlc3VsdHMpO1xuICAgICAgICB9KTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIG9ubHlfb25jZShmbikge1xuICAgIHZhciBjYWxsZWQgPSBmYWxzZTtcbiAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAoY2FsbGVkKSB0aHJvdyBuZXcgRXJyb3IoXCJDYWxsYmFjayB3YXMgYWxyZWFkeSBjYWxsZWQuXCIpO1xuICAgICAgICBjYWxsZWQgPSB0cnVlO1xuICAgICAgICBmbi5hcHBseShyb290LCBhcmd1bWVudHMpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gcGFyYWxsZWwodGFza3MsIGNhbGxiYWNrKSB7XG4gICAgX3BhcmFsbGVsKHtcbiAgICAgICAgbWFwOiBtYXAsXG4gICAgICAgIGVhY2g6IGVhY2hcbiAgICB9LCB0YXNrcywgY2FsbGJhY2spO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgICBzZXJpZXM6IHNlcmllcyxcbiAgICBwYXJhbGxlbDogcGFyYWxsZWxcbn07IiwiLypcbiAqIFRoaXMgaXMgYSBjb2xsZWN0aW9uIG9mIHV0aWxpdGllcyB0YWtlbiBmcm9tIGxpYnJhcmllcyBzdWNoIGFzIGFzeW5jLmpzLCB1bmRlcnNjb3JlLmpzIGV0Yy5cbiAqIEBtb2R1bGUgdXRpbFxuICovXG5cbnZhciBfID0gcmVxdWlyZSgnLi91bmRlcnNjb3JlJyksXG4gICAgYXN5bmMgPSByZXF1aXJlKCcuL2FzeW5jJyksXG4gICAgbWlzYyA9IHJlcXVpcmUoJy4vbWlzYycpO1xuXG5fLmV4dGVuZChtb2R1bGUuZXhwb3J0cywge1xuICAgIF86IF8sXG4gICAgZGVmZXI6IHJlcXVpcmUoJy4vcHJvbWlzZScpLFxuICAgIGFzeW5jOiBhc3luY1xufSk7XG5fLmV4dGVuZChtb2R1bGUuZXhwb3J0cywgbWlzYyk7XG4iLCJ2YXIgb2JzZXJ2ZSA9IHJlcXVpcmUoJy4uLy4uL3ZlbmRvci9vYnNlcnZlLWpzL3NyYy9vYnNlcnZlJykuUGxhdGZvcm0sXG4gICAgXyA9IHJlcXVpcmUoJy4vdW5kZXJzY29yZScpLFxuICAgIEludGVybmFsU2llc3RhRXJyb3IgPSByZXF1aXJlKCcuLy4uL2Vycm9yJykuSW50ZXJuYWxTaWVzdGFFcnJvcjtcblxuLy8gVXNlZCBieSBwYXJhbU5hbWVzIGZ1bmN0aW9uLlxudmFyIEZOX0FSR1MgPSAvXmZ1bmN0aW9uXFxzKlteXFwoXSpcXChcXHMqKFteXFwpXSopXFwpL20sXG4gICAgRk5fQVJHX1NQTElUID0gLywvLFxuICAgIEZOX0FSRyA9IC9eXFxzKihfPykoLis/KVxcMVxccyokLyxcbiAgICBTVFJJUF9DT01NRU5UUyA9IC8oKFxcL1xcLy4qJCl8KFxcL1xcKltcXHNcXFNdKj9cXCpcXC8pKS9tZztcblxuZnVuY3Rpb24gY2IoY2FsbGJhY2ssIGRlZmVycmVkKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjay5hcHBseShjYWxsYmFjaywgYXJndW1lbnRzKTtcbiAgICAgICAgaWYgKGRlZmVycmVkKSB7XG4gICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgZGVmZXJyZWQucmVqZWN0KGVycik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBkZWZlcnJlZC5yZXNvbHZlLmFwcGx5KGRlZmVycmVkLCBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH07XG59XG5cbnZhciBpc0FycmF5U2hpbSA9IGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgcmV0dXJuIF8udG9TdHJpbmcuY2FsbChvYmopID09PSAnW29iamVjdCBBcnJheV0nO1xuICAgIH0sXG4gICAgaXNBcnJheSA9IEFycmF5LmlzQXJyYXkgfHwgaXNBcnJheVNoaW0sXG4gICAgaXNTdHJpbmcgPSBmdW5jdGlvbiAobykge1xuICAgICAgICByZXR1cm4gdHlwZW9mIG8gPT0gJ3N0cmluZycgfHwgbyBpbnN0YW5jZW9mIFN0cmluZ1xuICAgIH07XG5fLmV4dGVuZChtb2R1bGUuZXhwb3J0cywge1xuICAgIC8qKlxuICAgICAqIFBlcmZvcm1zIGRpcnR5IGNoZWNrL09iamVjdC5vYnNlcnZlIGNhbGxiYWNrcyBkZXBlbmRpbmcgb24gdGhlIGJyb3dzZXIuXG4gICAgICpcbiAgICAgKiBJZiBPYmplY3Qub2JzZXJ2ZSBpcyBwcmVzZW50LFxuICAgICAqIEBwYXJhbSBjYWxsYmFja1xuICAgICAqL1xuICAgIG5leHQ6IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgICAgICBvYnNlcnZlLnBlcmZvcm1NaWNyb3Rhc2tDaGVja3BvaW50KCk7XG4gICAgICAgIHNldFRpbWVvdXQoY2FsbGJhY2spO1xuICAgIH0sXG4gICAgLyoqXG4gICAgICogUmV0dXJucyBhIGhhbmRsZXIgdGhhdCBhY3RzIHVwb24gYSBjYWxsYmFjayBvciBhIHByb21pc2UgZGVwZW5kaW5nIG9uIHRoZSByZXN1bHQgb2YgYSBkaWZmZXJlbnQgY2FsbGJhY2suXG4gICAgICogQHBhcmFtIGNhbGxiYWNrXG4gICAgICogQHBhcmFtIFtkZWZlcnJlZF1cbiAgICAgKiBAcmV0dXJucyB7RnVuY3Rpb259XG4gICAgICovXG4gICAgY2I6IGNiLFxuICAgIGd1aWQ6IChmdW5jdGlvbiAoKSB7XG4gICAgICAgIGZ1bmN0aW9uIHM0KCkge1xuICAgICAgICAgICAgcmV0dXJuIE1hdGguZmxvb3IoKDEgKyBNYXRoLnJhbmRvbSgpKSAqIDB4MTAwMDApXG4gICAgICAgICAgICAgICAgLnRvU3RyaW5nKDE2KVxuICAgICAgICAgICAgICAgIC5zdWJzdHJpbmcoMSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIHM0KCkgKyBzNCgpICsgJy0nICsgczQoKSArICctJyArIHM0KCkgKyAnLScgK1xuICAgICAgICAgICAgICAgIHM0KCkgKyAnLScgKyBzNCgpICsgczQoKSArIHM0KCk7XG4gICAgICAgIH07XG4gICAgfSkoKSxcbiAgICBhc3NlcnQ6IGZ1bmN0aW9uIChjb25kaXRpb24sIG1lc3NhZ2UsIGNvbnRleHQpIHtcbiAgICAgICAgaWYgKCFjb25kaXRpb24pIHtcbiAgICAgICAgICAgIG1lc3NhZ2UgPSBtZXNzYWdlIHx8IFwiQXNzZXJ0aW9uIGZhaWxlZFwiO1xuICAgICAgICAgICAgY29udGV4dCA9IGNvbnRleHQgfHwge307XG4gICAgICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcihtZXNzYWdlLCBjb250ZXh0KTtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgdGhlbkJ5OiAoZnVuY3Rpb24gKCkge1xuICAgICAgICAvKiBtaXhpbiBmb3IgdGhlIGB0aGVuQnlgIHByb3BlcnR5ICovXG4gICAgICAgIGZ1bmN0aW9uIGV4dGVuZChmKSB7XG4gICAgICAgICAgICBmLnRoZW5CeSA9IHRiO1xuICAgICAgICAgICAgcmV0dXJuIGY7XG4gICAgICAgIH1cblxuICAgICAgICAvKiBhZGRzIGEgc2Vjb25kYXJ5IGNvbXBhcmUgZnVuY3Rpb24gdG8gdGhlIHRhcmdldCBmdW5jdGlvbiAoYHRoaXNgIGNvbnRleHQpXG4gICAgICAgICB3aGljaCBpcyBhcHBsaWVkIGluIGNhc2UgdGhlIGZpcnN0IG9uZSByZXR1cm5zIDAgKGVxdWFsKVxuICAgICAgICAgcmV0dXJucyBhIG5ldyBjb21wYXJlIGZ1bmN0aW9uLCB3aGljaCBoYXMgYSBgdGhlbkJ5YCBtZXRob2QgYXMgd2VsbCAqL1xuICAgICAgICBmdW5jdGlvbiB0Yih5KSB7XG4gICAgICAgICAgICB2YXIgeCA9IHRoaXM7XG4gICAgICAgICAgICByZXR1cm4gZXh0ZW5kKGZ1bmN0aW9uIChhLCBiKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHgoYSwgYikgfHwgeShhLCBiKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGV4dGVuZDtcbiAgICB9KSgpLFxuICAgIGRlZmVyOiBmdW5jdGlvbiAoY2IpIHtcbiAgICAgICAgdmFyIGRlZmVycmVkO1xuICAgICAgICBjYiA9IGNiIHx8IGZ1bmN0aW9uICgpIHt9O1xuICAgICAgICBpZiAod2luZG93LnEpIHtcbiAgICAgICAgICAgIGRlZmVycmVkID0gd2luZG93LnEuZGVmZXIoKTtcbiAgICAgICAgICAgIHZhciByZWplY3QgPSBkZWZlcnJlZC5yZWplY3QsXG4gICAgICAgICAgICAgICAgcmVzb2x2ZSA9IGRlZmVycmVkLnJlc29sdmU7XG4gICAgICAgICAgICBfLmV4dGVuZChkZWZlcnJlZCwge1xuICAgICAgICAgICAgICAgIHJlamVjdDogZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgICAgICAgICBjYihlcnIpO1xuICAgICAgICAgICAgICAgICAgICByZWplY3QuY2FsbCh0aGlzLCBlcnIpO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgcmVzb2x2ZTogZnVuY3Rpb24gKHJlcykge1xuICAgICAgICAgICAgICAgICAgICBjYihudWxsLCByZXMpO1xuICAgICAgICAgICAgICAgICAgICByZXNvbHZlLmNhbGwodGhpcywgcmVzKTtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGZpbmlzaDogZnVuY3Rpb24gKGVyciwgcmVzKSB7XG4gICAgICAgICAgICAgICAgICAgIGNiKGVyciwgcmVzKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGVycikgcmVqZWN0LmNhbGwodGhpcywgZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgZWxzZSByZXNvbHZlLmNhbGwodGhpcywgcmVzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGRlZmVycmVkID0ge1xuICAgICAgICAgICAgICAgIHByb21pc2U6IHVuZGVmaW5lZCxcbiAgICAgICAgICAgICAgICByZWplY3Q6IGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgY2IoZXJyKTtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHJlc29sdmU6IGZ1bmN0aW9uIChyZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgY2IobnVsbCwgcmVzKVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgZmluaXNoOiBmdW5jdGlvbiAoZXJyLCByZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgY2IoZXJyLCByZXMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZGVmZXJyZWQ7XG4gICAgfSxcbiAgICBkZWZpbmVTdWJQcm9wZXJ0eTogZnVuY3Rpb24gKHByb3BlcnR5LCBzdWJPYmosIGlubmVyUHJvcGVydHkpIHtcbiAgICAgICAgcmV0dXJuIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCBwcm9wZXJ0eSwge1xuICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgaWYgKGlubmVyUHJvcGVydHkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHN1Yk9ialtpbm5lclByb3BlcnR5XTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBzdWJPYmpbcHJvcGVydHldO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBzZXQ6IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICAgICAgICAgIGlmIChpbm5lclByb3BlcnR5KSB7XG4gICAgICAgICAgICAgICAgICAgIHN1Yk9ialtpbm5lclByb3BlcnR5XSA9IHZhbHVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgc3ViT2JqW3Byb3BlcnR5XSA9IHZhbHVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgICAgIH0pO1xuICAgIH0sXG4gICAgZGVmaW5lU3ViUHJvcGVydHlOb1NldDogZnVuY3Rpb24gKHByb3BlcnR5LCBzdWJPYmosIGlubmVyUHJvcGVydHkpIHtcbiAgICAgICAgcmV0dXJuIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCBwcm9wZXJ0eSwge1xuICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgaWYgKGlubmVyUHJvcGVydHkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHN1Yk9ialtpbm5lclByb3BlcnR5XTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBzdWJPYmpbcHJvcGVydHldO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgICAgIH0pO1xuICAgIH0sXG4gICAgc3ViUHJvcGVydGllczogZnVuY3Rpb24gKG9iaiwgc3ViT2JqLCBwcm9wZXJ0aWVzKSB7XG4gICAgICAgIGlmICghaXNBcnJheShwcm9wZXJ0aWVzKSkge1xuICAgICAgICAgICAgcHJvcGVydGllcyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMik7XG4gICAgICAgIH1cbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBwcm9wZXJ0aWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAoZnVuY3Rpb24gKHByb3BlcnR5KSB7XG4gICAgICAgICAgICAgICAgdmFyIG9wdHMgPSB7XG4gICAgICAgICAgICAgICAgICAgIHNldDogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIG5hbWU6IHByb3BlcnR5LFxuICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0eTogcHJvcGVydHlcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIGlmICghaXNTdHJpbmcocHJvcGVydHkpKSB7XG4gICAgICAgICAgICAgICAgICAgIF8uZXh0ZW5kKG9wdHMsIHByb3BlcnR5KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdmFyIGRlc2MgPSB7XG4gICAgICAgICAgICAgICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHN1Yk9ialtvcHRzLnByb3BlcnR5XTtcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICBpZiAob3B0cy5zZXQpIHtcbiAgICAgICAgICAgICAgICAgICAgZGVzYy5zZXQgPSBmdW5jdGlvbiAodikge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3ViT2JqW29wdHMucHJvcGVydHldID0gdjtcbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG9iaiwgb3B0cy5uYW1lLCBkZXNjKTtcbiAgICAgICAgICAgIH0pKHByb3BlcnRpZXNbaV0pO1xuICAgICAgICB9XG4gICAgfSxcbiAgICBjYXBpdGFsaXNlRmlyc3RMZXR0ZXI6IGZ1bmN0aW9uIChzdHJpbmcpIHtcbiAgICAgICAgcmV0dXJuIHN0cmluZy5jaGFyQXQoMCkudG9VcHBlckNhc2UoKSArIHN0cmluZy5zbGljZSgxKTtcbiAgICB9LFxuICAgIGV4dGVuZEZyb21PcHRzOiBmdW5jdGlvbiAob2JqLCBvcHRzLCBkZWZhdWx0cywgZXJyb3JPblVua25vd24pIHtcbiAgICAgICAgZXJyb3JPblVua25vd24gPSBlcnJvck9uVW5rbm93biA9PSB1bmRlZmluZWQgPyB0cnVlIDogZXJyb3JPblVua25vd247XG4gICAgICAgIGlmIChlcnJvck9uVW5rbm93bikge1xuICAgICAgICAgICAgdmFyIGRlZmF1bHRLZXlzID0gT2JqZWN0LmtleXMoZGVmYXVsdHMpLFxuICAgICAgICAgICAgICAgIG9wdHNLZXlzID0gT2JqZWN0LmtleXMob3B0cyk7XG4gICAgICAgICAgICB2YXIgdW5rbm93bktleXMgPSBvcHRzS2V5cy5maWx0ZXIoZnVuY3Rpb24gKG4pIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZGVmYXVsdEtleXMuaW5kZXhPZihuKSA9PSAtMVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBpZiAodW5rbm93bktleXMubGVuZ3RoKSB0aHJvdyBFcnJvcignVW5rbm93biBvcHRpb25zOiAnICsgdW5rbm93bktleXMudG9TdHJpbmcoKSk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gQXBwbHkgYW55IGZ1bmN0aW9ucyBzcGVjaWZpZWQgaW4gdGhlIGRlZmF1bHRzLlxuICAgICAgICBfLmVhY2goT2JqZWN0LmtleXMoZGVmYXVsdHMpLCBmdW5jdGlvbiAoaykge1xuICAgICAgICAgICAgdmFyIGQgPSBkZWZhdWx0c1trXTtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgZCA9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICAgICAgZGVmYXVsdHNba10gPSBkKG9wdHNba10pO1xuICAgICAgICAgICAgICAgIGRlbGV0ZSBvcHRzW2tdO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgXy5leHRlbmQoZGVmYXVsdHMsIG9wdHMpO1xuICAgICAgICBfLmV4dGVuZChvYmosIGRlZmF1bHRzKTtcbiAgICB9LFxuICAgIGlzU3RyaW5nOiBpc1N0cmluZyxcbiAgICBpc0FycmF5OiBpc0FycmF5LFxuICAgIHByZXR0eVByaW50OiBmdW5jdGlvbiAobykge1xuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkobywgbnVsbCwgNCk7XG4gICAgfSxcbiAgICBmbGF0dGVuQXJyYXk6IGZ1bmN0aW9uIChhcnIpIHtcbiAgICAgICAgcmV0dXJuIF8ucmVkdWNlKGFyciwgZnVuY3Rpb24gKG1lbW8sIGUpIHtcbiAgICAgICAgICAgIGlmIChpc0FycmF5KGUpKSB7XG4gICAgICAgICAgICAgICAgbWVtbyA9IG1lbW8uY29uY2F0KGUpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBtZW1vLnB1c2goZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gbWVtbztcbiAgICAgICAgfSwgW10pO1xuICAgIH0sXG4gICAgdW5mbGF0dGVuQXJyYXk6IGZ1bmN0aW9uIChhcnIsIG1vZGVsQXJyKSB7XG4gICAgICAgIHZhciBuID0gMDtcbiAgICAgICAgdmFyIHVuZmxhdHRlbmVkID0gW107XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbW9kZWxBcnIubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmIChpc0FycmF5KG1vZGVsQXJyW2ldKSkge1xuICAgICAgICAgICAgICAgIHZhciBuZXdBcnIgPSBbXTtcbiAgICAgICAgICAgICAgICB1bmZsYXR0ZW5lZFtpXSA9IG5ld0FycjtcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBqID0gMDsgaiA8IG1vZGVsQXJyW2ldLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICAgICAgICAgIG5ld0Fyci5wdXNoKGFycltuXSk7XG4gICAgICAgICAgICAgICAgICAgIG4rKztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHVuZmxhdHRlbmVkW2ldID0gYXJyW25dO1xuICAgICAgICAgICAgICAgIG4rKztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdW5mbGF0dGVuZWQ7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBSZXR1cm4gdGhlIHBhcmFtZXRlciBuYW1lcyBvZiBhIGZ1bmN0aW9uLlxuICAgICAqIE5vdGU6IGFkYXB0ZWQgZnJvbSBBbmd1bGFySlMgZGVwZW5kZW5jeSBpbmplY3Rpb24gOilcbiAgICAgKiBAcGFyYW0gZm5cbiAgICAgKi9cbiAgICBwYXJhbU5hbWVzOiBmdW5jdGlvbiAoZm4pIHtcbiAgICAgICAgLy8gVE9ETzogSXMgdGhlcmUgYSBtb3JlIHJvYnVzdCB3YXkgb2YgZG9pbmcgdGhpcz9cbiAgICAgICAgdmFyIHBhcmFtcyA9IFtdLFxuICAgICAgICAgICAgZm5UZXh0LFxuICAgICAgICAgICAgYXJnRGVjbDtcbiAgICAgICAgZm5UZXh0ID0gZm4udG9TdHJpbmcoKS5yZXBsYWNlKFNUUklQX0NPTU1FTlRTLCAnJyk7XG4gICAgICAgIGFyZ0RlY2wgPSBmblRleHQubWF0Y2goRk5fQVJHUyk7XG5cbiAgICAgICAgYXJnRGVjbFsxXS5zcGxpdChGTl9BUkdfU1BMSVQpLmZvckVhY2goZnVuY3Rpb24gKGFyZykge1xuICAgICAgICAgICAgYXJnLnJlcGxhY2UoRk5fQVJHLCBmdW5jdGlvbiAoYWxsLCB1bmRlcnNjb3JlLCBuYW1lKSB7XG4gICAgICAgICAgICAgICAgcGFyYW1zLnB1c2gobmFtZSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBwYXJhbXM7XG4gICAgfVxufSk7IiwiLyoqXG4gKiBBIGNyYXp5IHNpbXBsZSBwcm9taXNlIGxpYnJhcnkuXG4gKiBAbW9kdWxlIHV0aWwucHJvbWlzZVxuICovXG5cbmZ1bmN0aW9uIHMocGFzcykge1xuICAgIHJldHVybiBmdW5jdGlvbiAocmVzKSB7XG4gICAgICAgIHRoaXMucmVzID0gcmVzO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgdGhpcy5zdWNjZXNzLmZvckVhY2goZnVuY3Rpb24gKHMpIHtzKHBhc3MgPyByZXMgOiB1bmRlZmluZWQpfSk7XG4gICAgICAgIH1cbiAgICAgICAgY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgZS5jYWxsKHRoaXMsIGVycik7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmZ1bmN0aW9uIGYoZXJyKSB7XG4gICAgdGhpcy5fZmFpbCA9IGVycjtcbiAgICB0aGlzLmVycm9yID0gZXJyO1xuICAgIHRoaXMuZmFpbHVyZS5mb3JFYWNoKGZ1bmN0aW9uIChzKSB7cyhlcnIpfSk7XG4gICAgdGhpcy5lcnJvcnMuZm9yRWFjaChmdW5jdGlvbiAocykge3MoZXJyKX0pO1xufVxuXG5mdW5jdGlvbiBlKGVycikge1xuICAgIHRoaXMuZXJyb3IgPSBlcnI7XG4gICAgdGhpcy5lcnJvcnMuZm9yRWFjaChmdW5jdGlvbiAocykge3MoZXJyKX0pO1xufVxuXG5mdW5jdGlvbiBQcm9taXNlKCkge1xuICAgIF8uZXh0ZW5kKHRoaXMsIHtcbiAgICAgICAgc3VjY2VzczogW10sXG4gICAgICAgIGZhaWx1cmU6IFtdLFxuICAgICAgICBlcnJvcnM6IFtdLFxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUgUHJvbWlzZVxuICAgICAgICAgKi9cbiAgICAgICAgX25leHRQcm9taXNlOiBudWxsXG4gICAgfSk7XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsICduZXh0UHJvbWlzZScsIHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBpZiAoIXRoaXMuX25leHRQcm9taXNlKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fbmV4dFByb21pc2UgPSBuZXcgUHJvbWlzZSgpO1xuICAgICAgICAgICAgICAgIHRoaXMuc3VjY2Vzcy5wdXNoKHMoZmFsc2UpLmJpbmQodGhpcy5fbmV4dFByb21pc2UpKTtcbiAgICAgICAgICAgICAgICB0aGlzLmZhaWx1cmUucHVzaChmLmJpbmQodGhpcy5fbmV4dFByb21pc2UpKTtcbiAgICAgICAgICAgICAgICB0aGlzLmVycm9ycy5wdXNoKGUuYmluZCh0aGlzLl9uZXh0UHJvbWlzZSkpO1xuICAgICAgICAgICAgICAgIHRoaXMuX25leHRQcm9taXNlLl9mYWlsID0gdGhpcy5fZmFpbDtcbiAgICAgICAgICAgICAgICB0aGlzLl9uZXh0UHJvbWlzZS5lcnJvciA9IHRoaXMuZXJyb3I7XG4gICAgICAgICAgICAgICAgdGhpcy5fbmV4dFByb21pc2UucmVzID0gdGhpcy5yZXM7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fbmV4dFByb21pc2U7XG4gICAgICAgIH1cbiAgICB9KTtcbn1cbnZhciBmYWlsID0gZnVuY3Rpb24gKGVycm9yKSB7XG4gICAgaWYgKGVycm9yKSB7XG4gICAgICAgIGlmICh0aGlzLmVycm9yKSBlcnJvcih0aGlzLmVycm9yKTtcbiAgICAgICAgZWxzZSB0aGlzLmVycm9ycy5wdXNoKGVycm9yKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMubmV4dFByb21pc2U7XG59O1xuXy5leHRlbmQoUHJvbWlzZS5wcm90b3R5cGUsIHtcbiAgICB0aGVuOiBmdW5jdGlvbiAoc3VjY2VzcywgZmFpbHVyZSkge1xuICAgICAgICBpZiAoc3VjY2Vzcykge1xuICAgICAgICAgICAgaWYgKHRoaXMucmVzKSBzdWNjZXNzKHRoaXMucmVzKTtcbiAgICAgICAgICAgIGVsc2UgdGhpcy5zdWNjZXNzLnB1c2goc3VjY2Vzcyk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGZhaWx1cmUpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9mYWlsKSBmYWlsdXJlKHRoaXMuX2ZhaWwpO1xuICAgICAgICAgICAgZWxzZSB0aGlzLmZhaWx1cmUucHVzaChmYWlsdXJlKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5uZXh0UHJvbWlzZTtcbiAgICB9LFxuICAgIGNhdGNoOiBmYWlsLFxuICAgIGZhaWw6IGZhaWwsXG4gICAgZG9uZTogZnVuY3Rpb24gKHN1Y2Nlc3MsIGZhaWx1cmUpIHtcbiAgICAgICAgdGhpcy50aGVuKHN1Y2Nlc3MpLmNhdGNoKGZhaWx1cmUpO1xuICAgIH1cbn0pO1xuXG5mdW5jdGlvbiBEZWZlcnJlZChjYikge1xuICAgIF8uZXh0ZW5kKHRoaXMsIHtcbiAgICAgICAgY2I6IGNiIHx8IGZ1bmN0aW9uICgpIHt9LFxuICAgICAgICBwcm9taXNlOiBuZXcgUHJvbWlzZSgpXG4gICAgfSk7XG59XG5cbl8uZXh0ZW5kKERlZmVycmVkLnByb3RvdHlwZSwge1xuICAgIHJlc29sdmU6IGZ1bmN0aW9uIChyZXMpIHtcbiAgICAgICAgcyh0cnVlKS5jYWxsKHRoaXMucHJvbWlzZSwgcmVzKTtcbiAgICAgICAgdGhpcy5jYihudWxsLCByZXMpO1xuICAgIH0sXG4gICAgcmVqZWN0OiBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgIGYuY2FsbCh0aGlzLnByb21pc2UsIGVycik7XG4gICAgICAgIHRoaXMuY2IoZXJyID8gZXJyIDogdHJ1ZSk7XG4gICAgfSxcbiAgICBmaW5pc2g6IGZ1bmN0aW9uIChlcnIsIHJlcykge1xuICAgICAgICBpZiAodGhpcyA9PSB3aW5kb3cpIHRocm93ICd3dGYnO1xuICAgICAgICBpZiAoZXJyKSB0aGlzLnJlamVjdChlcnIpO1xuICAgICAgICBlbHNlIHRoaXMucmVzb2x2ZShyZXMpO1xuICAgIH1cbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChjYikge1xuICAgIHJldHVybiBuZXcgRGVmZXJyZWQoY2IpO1xufTsiLCIvKipcbiAqIE9mdGVuIHVzZWQgZnVuY3Rpb25zIGZyb20gdW5kZXJzY29yZSwgcHVsbGVkIG91dCBmb3IgYnJldml0eS5cbiAqIEBtb2R1bGUgdW5kZXJzY29yZVxuICovXG5cbnZhciBfID0ge30sXG4gICAgQXJyYXlQcm90byA9IEFycmF5LnByb3RvdHlwZSxcbiAgICBGdW5jUHJvdG8gPSBGdW5jdGlvbi5wcm90b3R5cGUsXG4gICAgbmF0aXZlRm9yRWFjaCA9IEFycmF5UHJvdG8uZm9yRWFjaCxcbiAgICBuYXRpdmVNYXAgPSBBcnJheVByb3RvLm1hcCxcbiAgICBuYXRpdmVSZWR1Y2UgPSBBcnJheVByb3RvLnJlZHVjZSxcbiAgICBuYXRpdmVCaW5kID0gRnVuY1Byb3RvLmJpbmQsXG4gICAgc2xpY2UgPSBBcnJheVByb3RvLnNsaWNlLFxuICAgIGJyZWFrZXIgPSB7fSxcbiAgICBjdG9yID0gZnVuY3Rpb24gKCkge307XG5cbmZ1bmN0aW9uIGtleXMob2JqKSB7XG4gICAgaWYgKE9iamVjdC5rZXlzKSB7XG4gICAgICAgIHJldHVybiBPYmplY3Qua2V5cyhvYmopO1xuICAgIH1cbiAgICB2YXIga2V5cyA9IFtdO1xuICAgIGZvciAodmFyIGsgaW4gb2JqKSB7XG4gICAgICAgIGlmIChvYmouaGFzT3duUHJvcGVydHkoaykpIHtcbiAgICAgICAgICAgIGtleXMucHVzaChrKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4ga2V5cztcbn1cblxuXy5rZXlzID0ga2V5cztcblxuXy5lYWNoID0gXy5mb3JFYWNoID0gZnVuY3Rpb24gKG9iaiwgaXRlcmF0b3IsIGNvbnRleHQpIHtcbiAgICBpZiAob2JqID09IG51bGwpIHJldHVybiBvYmo7XG4gICAgaWYgKG5hdGl2ZUZvckVhY2ggJiYgb2JqLmZvckVhY2ggPT09IG5hdGl2ZUZvckVhY2gpIHtcbiAgICAgICAgb2JqLmZvckVhY2goaXRlcmF0b3IsIGNvbnRleHQpO1xuICAgIH0gZWxzZSBpZiAob2JqLmxlbmd0aCA9PT0gK29iai5sZW5ndGgpIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbmd0aCA9IG9iai5sZW5ndGg7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaWYgKGl0ZXJhdG9yLmNhbGwoY29udGV4dCwgb2JqW2ldLCBpLCBvYmopID09PSBicmVha2VyKSByZXR1cm47XG4gICAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgICB2YXIga2V5cyA9IF8ua2V5cyhvYmopO1xuICAgICAgICBmb3IgKHZhciBpID0gMCwgbGVuZ3RoID0ga2V5cy5sZW5ndGg7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaWYgKGl0ZXJhdG9yLmNhbGwoY29udGV4dCwgb2JqW2tleXNbaV1dLCBrZXlzW2ldLCBvYmopID09PSBicmVha2VyKSByZXR1cm47XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG9iajtcbn07XG5cbi8vIFJldHVybiB0aGUgcmVzdWx0cyBvZiBhcHBseWluZyB0aGUgaXRlcmF0b3IgdG8gZWFjaCBlbGVtZW50LlxuLy8gRGVsZWdhdGVzIHRvICoqRUNNQVNjcmlwdCA1KioncyBuYXRpdmUgYG1hcGAgaWYgYXZhaWxhYmxlLlxuXy5tYXAgPSBfLmNvbGxlY3QgPSBmdW5jdGlvbiAob2JqLCBpdGVyYXRvciwgY29udGV4dCkge1xuICAgIHZhciByZXN1bHRzID0gW107XG4gICAgaWYgKG9iaiA9PSBudWxsKSByZXR1cm4gcmVzdWx0cztcbiAgICBpZiAobmF0aXZlTWFwICYmIG9iai5tYXAgPT09IG5hdGl2ZU1hcCkgcmV0dXJuIG9iai5tYXAoaXRlcmF0b3IsIGNvbnRleHQpO1xuICAgIF8uZWFjaChvYmosIGZ1bmN0aW9uICh2YWx1ZSwgaW5kZXgsIGxpc3QpIHtcbiAgICAgICAgcmVzdWx0cy5wdXNoKGl0ZXJhdG9yLmNhbGwoY29udGV4dCwgdmFsdWUsIGluZGV4LCBsaXN0KSk7XG4gICAgfSk7XG4gICAgcmV0dXJuIHJlc3VsdHM7XG59O1xuXG4vLyBJbnRlcm5hbCBmdW5jdGlvbiB0aGF0IHJldHVybnMgYW4gZWZmaWNpZW50IChmb3IgY3VycmVudCBlbmdpbmVzKSB2ZXJzaW9uXG4vLyBvZiB0aGUgcGFzc2VkLWluIGNhbGxiYWNrLCB0byBiZSByZXBlYXRlZGx5IGFwcGxpZWQgaW4gb3RoZXIgVW5kZXJzY29yZVxuLy8gZnVuY3Rpb25zLlxudmFyIGNyZWF0ZUNhbGxiYWNrID0gZnVuY3Rpb24gKGZ1bmMsIGNvbnRleHQsIGFyZ0NvdW50KSB7XG4gICAgaWYgKGNvbnRleHQgPT09IHZvaWQgMCkgcmV0dXJuIGZ1bmM7XG4gICAgc3dpdGNoIChhcmdDb3VudCA9PSBudWxsID8gMyA6IGFyZ0NvdW50KSB7XG4gICAgICAgIGNhc2UgMTpcbiAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZnVuYy5jYWxsKGNvbnRleHQsIHZhbHVlKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgIGNhc2UgMjpcbiAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbiAodmFsdWUsIG90aGVyKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZ1bmMuY2FsbChjb250ZXh0LCB2YWx1ZSwgb3RoZXIpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgY2FzZSAzOlxuICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uICh2YWx1ZSwgaW5kZXgsIGNvbGxlY3Rpb24pIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZnVuYy5jYWxsKGNvbnRleHQsIHZhbHVlLCBpbmRleCwgY29sbGVjdGlvbik7XG4gICAgICAgICAgICB9O1xuICAgICAgICBjYXNlIDQ6XG4gICAgICAgICAgICByZXR1cm4gZnVuY3Rpb24gKGFjY3VtdWxhdG9yLCB2YWx1ZSwgaW5kZXgsIGNvbGxlY3Rpb24pIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZnVuYy5jYWxsKGNvbnRleHQsIGFjY3VtdWxhdG9yLCB2YWx1ZSwgaW5kZXgsIGNvbGxlY3Rpb24pO1xuICAgICAgICAgICAgfTtcbiAgICB9XG4gICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmMuYXBwbHkoY29udGV4dCwgYXJndW1lbnRzKTtcbiAgICB9O1xufTtcblxuLy8gUnVuIGEgZnVuY3Rpb24gKipuKiogdGltZXMuXG5fLnRpbWVzID0gZnVuY3Rpb24gKG4sIGl0ZXJhdGVlLCBjb250ZXh0KSB7XG4gICAgdmFyIGFjY3VtID0gbmV3IEFycmF5KE1hdGgubWF4KDAsIG4pKTtcbiAgICBpdGVyYXRlZSA9IGNyZWF0ZUNhbGxiYWNrKGl0ZXJhdGVlLCBjb250ZXh0LCAxKTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IG47IGkrKykgYWNjdW1baV0gPSBpdGVyYXRlZShpKTtcbiAgICByZXR1cm4gYWNjdW07XG59O1xuXG4vLyBQYXJ0aWFsbHkgYXBwbHkgYSBmdW5jdGlvbiBieSBjcmVhdGluZyBhIHZlcnNpb24gdGhhdCBoYXMgaGFkIHNvbWUgb2YgaXRzXG4vLyBhcmd1bWVudHMgcHJlLWZpbGxlZCwgd2l0aG91dCBjaGFuZ2luZyBpdHMgZHluYW1pYyBgdGhpc2AgY29udGV4dC4gXyBhY3RzXG4vLyBhcyBhIHBsYWNlaG9sZGVyLCBhbGxvd2luZyBhbnkgY29tYmluYXRpb24gb2YgYXJndW1lbnRzIHRvIGJlIHByZS1maWxsZWQuXG5fLnBhcnRpYWwgPSBmdW5jdGlvbiAoZnVuYykge1xuICAgIHZhciBib3VuZEFyZ3MgPSBzbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIHBvc2l0aW9uID0gMDtcbiAgICAgICAgdmFyIGFyZ3MgPSBib3VuZEFyZ3Muc2xpY2UoKTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbmd0aCA9IGFyZ3MubGVuZ3RoOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmIChhcmdzW2ldID09PSBfKSBhcmdzW2ldID0gYXJndW1lbnRzW3Bvc2l0aW9uKytdO1xuICAgICAgICB9XG4gICAgICAgIHdoaWxlIChwb3NpdGlvbiA8IGFyZ3VtZW50cy5sZW5ndGgpIGFyZ3MucHVzaChhcmd1bWVudHNbcG9zaXRpb24rK10pO1xuICAgICAgICByZXR1cm4gZnVuYy5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICB9O1xufTtcblxuLy8gQ29udmVuaWVuY2UgdmVyc2lvbiBvZiBhIGNvbW1vbiB1c2UgY2FzZSBvZiBgbWFwYDogZmV0Y2hpbmcgYSBwcm9wZXJ0eS5cbl8ucGx1Y2sgPSBmdW5jdGlvbiAob2JqLCBrZXkpIHtcbiAgICByZXR1cm4gXy5tYXAob2JqLCBfLnByb3BlcnR5KGtleSkpO1xufTtcblxudmFyIHJlZHVjZUVycm9yID0gJ1JlZHVjZSBvZiBlbXB0eSBhcnJheSB3aXRoIG5vIGluaXRpYWwgdmFsdWUnO1xuXG4vLyAqKlJlZHVjZSoqIGJ1aWxkcyB1cCBhIHNpbmdsZSByZXN1bHQgZnJvbSBhIGxpc3Qgb2YgdmFsdWVzLCBha2EgYGluamVjdGAsXG4vLyBvciBgZm9sZGxgLiBEZWxlZ2F0ZXMgdG8gKipFQ01BU2NyaXB0IDUqKidzIG5hdGl2ZSBgcmVkdWNlYCBpZiBhdmFpbGFibGUuXG5fLnJlZHVjZSA9IF8uZm9sZGwgPSBfLmluamVjdCA9IGZ1bmN0aW9uIChvYmosIGl0ZXJhdG9yLCBtZW1vLCBjb250ZXh0KSB7XG4gICAgdmFyIGluaXRpYWwgPSBhcmd1bWVudHMubGVuZ3RoID4gMjtcbiAgICBpZiAob2JqID09IG51bGwpIG9iaiA9IFtdO1xuICAgIGlmIChuYXRpdmVSZWR1Y2UgJiYgb2JqLnJlZHVjZSA9PT0gbmF0aXZlUmVkdWNlKSB7XG4gICAgICAgIGlmIChjb250ZXh0KSBpdGVyYXRvciA9IF8uYmluZChpdGVyYXRvciwgY29udGV4dCk7XG4gICAgICAgIHJldHVybiBpbml0aWFsID8gb2JqLnJlZHVjZShpdGVyYXRvciwgbWVtbykgOiBvYmoucmVkdWNlKGl0ZXJhdG9yKTtcbiAgICB9XG4gICAgXy5lYWNoKG9iaiwgZnVuY3Rpb24gKHZhbHVlLCBpbmRleCwgbGlzdCkge1xuICAgICAgICBpZiAoIWluaXRpYWwpIHtcbiAgICAgICAgICAgIG1lbW8gPSB2YWx1ZTtcbiAgICAgICAgICAgIGluaXRpYWwgPSB0cnVlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbWVtbyA9IGl0ZXJhdG9yLmNhbGwoY29udGV4dCwgbWVtbywgdmFsdWUsIGluZGV4LCBsaXN0KTtcbiAgICAgICAgfVxuICAgIH0pO1xuICAgIGlmICghaW5pdGlhbCkgdGhyb3cgbmV3IFR5cGVFcnJvcihyZWR1Y2VFcnJvcik7XG4gICAgcmV0dXJuIG1lbW87XG59O1xuXG5fLnByb3BlcnR5ID0gZnVuY3Rpb24gKGtleSkge1xuICAgIHJldHVybiBmdW5jdGlvbiAob2JqKSB7XG4gICAgICAgIHJldHVybiBvYmpba2V5XTtcbiAgICB9O1xufTtcblxuLy8gT3B0aW1pemUgYGlzRnVuY3Rpb25gIGlmIGFwcHJvcHJpYXRlLlxuaWYgKHR5cGVvZigvLi8pICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgXy5pc0Z1bmN0aW9uID0gZnVuY3Rpb24gKG9iaikge1xuICAgICAgICByZXR1cm4gdHlwZW9mIG9iaiA9PT0gJ2Z1bmN0aW9uJztcbiAgICB9O1xufVxuXG5fLmlzT2JqZWN0ID0gZnVuY3Rpb24gKG9iaikge1xuICAgIHZhciB0eXBlID0gdHlwZW9mIG9iajtcbiAgICByZXR1cm4gdHlwZSA9PT0gJ2Z1bmN0aW9uJyB8fCB0eXBlID09PSAnb2JqZWN0JyAmJiAhIW9iajtcbn07XG5cbi8vIEFuIGludGVybmFsIGZ1bmN0aW9uIHRvIGdlbmVyYXRlIGxvb2t1cCBpdGVyYXRvcnMuXG52YXIgbG9va3VwSXRlcmF0b3IgPSBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICBpZiAodmFsdWUgPT0gbnVsbCkgcmV0dXJuIF8uaWRlbnRpdHk7XG4gICAgaWYgKF8uaXNGdW5jdGlvbih2YWx1ZSkpIHJldHVybiB2YWx1ZTtcbiAgICByZXR1cm4gXy5wcm9wZXJ0eSh2YWx1ZSk7XG59O1xuXG4vLyBTb3J0IHRoZSBvYmplY3QncyB2YWx1ZXMgYnkgYSBjcml0ZXJpb24gcHJvZHVjZWQgYnkgYW4gaXRlcmF0b3IuXG5fLnNvcnRCeSA9IGZ1bmN0aW9uIChvYmosIGl0ZXJhdG9yLCBjb250ZXh0KSB7XG4gICAgaXRlcmF0b3IgPSBsb29rdXBJdGVyYXRvcihpdGVyYXRvcik7XG4gICAgcmV0dXJuIF8ucGx1Y2soXy5tYXAob2JqLCBmdW5jdGlvbiAodmFsdWUsIGluZGV4LCBsaXN0KSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICB2YWx1ZTogdmFsdWUsXG4gICAgICAgICAgICBpbmRleDogaW5kZXgsXG4gICAgICAgICAgICBjcml0ZXJpYTogaXRlcmF0b3IuY2FsbChjb250ZXh0LCB2YWx1ZSwgaW5kZXgsIGxpc3QpXG4gICAgICAgIH07XG4gICAgfSkuc29ydChmdW5jdGlvbiAobGVmdCwgcmlnaHQpIHtcbiAgICAgICAgdmFyIGEgPSBsZWZ0LmNyaXRlcmlhO1xuICAgICAgICB2YXIgYiA9IHJpZ2h0LmNyaXRlcmlhO1xuICAgICAgICBpZiAoYSAhPT0gYikge1xuICAgICAgICAgICAgaWYgKGEgPiBiIHx8IGEgPT09IHZvaWQgMCkgcmV0dXJuIDE7XG4gICAgICAgICAgICBpZiAoYSA8IGIgfHwgYiA9PT0gdm9pZCAwKSByZXR1cm4gLTE7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGxlZnQuaW5kZXggLSByaWdodC5pbmRleDtcbiAgICB9KSwgJ3ZhbHVlJyk7XG59O1xuXG5cbi8vIENyZWF0ZSBhIGZ1bmN0aW9uIGJvdW5kIHRvIGEgZ2l2ZW4gb2JqZWN0IChhc3NpZ25pbmcgYHRoaXNgLCBhbmQgYXJndW1lbnRzLFxuLy8gb3B0aW9uYWxseSkuIERlbGVnYXRlcyB0byAqKkVDTUFTY3JpcHQgNSoqJ3MgbmF0aXZlIGBGdW5jdGlvbi5iaW5kYCBpZlxuLy8gYXZhaWxhYmxlLlxuXy5iaW5kID0gZnVuY3Rpb24gKGZ1bmMsIGNvbnRleHQpIHtcbiAgICB2YXIgYXJncywgYm91bmQ7XG4gICAgaWYgKG5hdGl2ZUJpbmQgJiYgZnVuYy5iaW5kID09PSBuYXRpdmVCaW5kKSByZXR1cm4gbmF0aXZlQmluZC5hcHBseShmdW5jLCBzbGljZS5jYWxsKGFyZ3VtZW50cywgMSkpO1xuICAgIGlmICghXy5pc0Z1bmN0aW9uKGZ1bmMpKSB0aHJvdyBuZXcgVHlwZUVycm9yO1xuICAgIGFyZ3MgPSBzbGljZS5jYWxsKGFyZ3VtZW50cywgMik7XG4gICAgcmV0dXJuIGJvdW5kID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAoISh0aGlzIGluc3RhbmNlb2YgYm91bmQpKSByZXR1cm4gZnVuYy5hcHBseShjb250ZXh0LCBhcmdzLmNvbmNhdChzbGljZS5jYWxsKGFyZ3VtZW50cykpKTtcbiAgICAgICAgY3Rvci5wcm90b3R5cGUgPSBmdW5jLnByb3RvdHlwZTtcbiAgICAgICAgdmFyIHNlbGYgPSBuZXcgY3RvcjtcbiAgICAgICAgY3Rvci5wcm90b3R5cGUgPSBudWxsO1xuICAgICAgICB1XG4gICAgICAgIHZhciByZXN1bHQgPSBmdW5jLmFwcGx5KHNlbGYsIGFyZ3MuY29uY2F0KHNsaWNlLmNhbGwoYXJndW1lbnRzKSkpO1xuICAgICAgICBpZiAoT2JqZWN0KHJlc3VsdCkgPT09IHJlc3VsdCkgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgcmV0dXJuIHNlbGY7XG4gICAgfTtcbn07XG5cbl8uaWRlbnRpdHkgPSBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICByZXR1cm4gdmFsdWU7XG59O1xuXG5fLnppcCA9IGZ1bmN0aW9uIChhcnJheSkge1xuICAgIGlmIChhcnJheSA9PSBudWxsKSByZXR1cm4gW107XG4gICAgdmFyIGxlbmd0aCA9IF8ubWF4KGFyZ3VtZW50cywgJ2xlbmd0aCcpLmxlbmd0aDtcbiAgICB2YXIgcmVzdWx0cyA9IEFycmF5KGxlbmd0aCk7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgICByZXN1bHRzW2ldID0gXy5wbHVjayhhcmd1bWVudHMsIGkpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0cztcbn07XG5cbi8vIFJldHVybiB0aGUgbWF4aW11bSBlbGVtZW50IChvciBlbGVtZW50LWJhc2VkIGNvbXB1dGF0aW9uKS5cbl8ubWF4ID0gZnVuY3Rpb24gKG9iaiwgaXRlcmF0ZWUsIGNvbnRleHQpIHtcbiAgICB2YXIgcmVzdWx0ID0gLUluZmluaXR5LFxuICAgICAgICBsYXN0Q29tcHV0ZWQgPSAtSW5maW5pdHksXG4gICAgICAgIHZhbHVlLCBjb21wdXRlZDtcbiAgICBpZiAoaXRlcmF0ZWUgPT0gbnVsbCAmJiBvYmogIT0gbnVsbCkge1xuICAgICAgICBvYmogPSBvYmoubGVuZ3RoID09PSArb2JqLmxlbmd0aCA/IG9iaiA6IF8udmFsdWVzKG9iaik7XG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBsZW5ndGggPSBvYmoubGVuZ3RoOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHZhbHVlID0gb2JqW2ldO1xuICAgICAgICAgICAgaWYgKHZhbHVlID4gcmVzdWx0KSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0ID0gdmFsdWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgICBpdGVyYXRlZSA9IF8uaXRlcmF0ZWUoaXRlcmF0ZWUsIGNvbnRleHQpO1xuICAgICAgICBfLmVhY2gob2JqLCBmdW5jdGlvbiAodmFsdWUsIGluZGV4LCBsaXN0KSB7XG4gICAgICAgICAgICBjb21wdXRlZCA9IGl0ZXJhdGVlKHZhbHVlLCBpbmRleCwgbGlzdCk7XG4gICAgICAgICAgICBpZiAoY29tcHV0ZWQgPiBsYXN0Q29tcHV0ZWQgfHwgY29tcHV0ZWQgPT09IC1JbmZpbml0eSAmJiByZXN1bHQgPT09IC1JbmZpbml0eSkge1xuICAgICAgICAgICAgICAgIHJlc3VsdCA9IHZhbHVlO1xuICAgICAgICAgICAgICAgIGxhc3RDb21wdXRlZCA9IGNvbXB1dGVkO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbn07XG5cblxuXy5pdGVyYXRlZSA9IGZ1bmN0aW9uICh2YWx1ZSwgY29udGV4dCwgYXJnQ291bnQpIHtcbiAgICBpZiAodmFsdWUgPT0gbnVsbCkgcmV0dXJuIF8uaWRlbnRpdHk7XG4gICAgaWYgKF8uaXNGdW5jdGlvbih2YWx1ZSkpIHJldHVybiBjcmVhdGVDYWxsYmFjayh2YWx1ZSwgY29udGV4dCwgYXJnQ291bnQpO1xuICAgIGlmIChfLmlzT2JqZWN0KHZhbHVlKSkgcmV0dXJuIF8ubWF0Y2hlcyh2YWx1ZSk7XG4gICAgcmV0dXJuIF8ucHJvcGVydHkodmFsdWUpO1xufTtcblxuXy5wYWlycyA9IGZ1bmN0aW9uIChvYmopIHtcbiAgICB2YXIga2V5cyA9IF8ua2V5cyhvYmopO1xuICAgIHZhciBsZW5ndGggPSBrZXlzLmxlbmd0aDtcbiAgICB2YXIgcGFpcnMgPSBBcnJheShsZW5ndGgpO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgcGFpcnNbaV0gPSBba2V5c1tpXSwgb2JqW2tleXNbaV1dXTtcbiAgICB9XG4gICAgcmV0dXJuIHBhaXJzO1xufTtcblxuXy5tYXRjaGVzID0gZnVuY3Rpb24gKGF0dHJzKSB7XG4gICAgdmFyIHBhaXJzID0gXy5wYWlycyhhdHRycyksXG4gICAgICAgIGxlbmd0aCA9IHBhaXJzLmxlbmd0aDtcbiAgICByZXR1cm4gZnVuY3Rpb24gKG9iaikge1xuICAgICAgICBpZiAob2JqID09IG51bGwpIHJldHVybiAhbGVuZ3RoO1xuICAgICAgICBvYmogPSBuZXcgT2JqZWN0KG9iaik7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHZhciBwYWlyID0gcGFpcnNbaV0sXG4gICAgICAgICAgICAgICAga2V5ID0gcGFpclswXTtcbiAgICAgICAgICAgIGlmIChwYWlyWzFdICE9PSBvYmpba2V5XSB8fCAhKGtleSBpbiBvYmopKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfTtcbn07XG5cbl8uc29tZSA9IGZ1bmN0aW9uIChvYmosIHByZWRpY2F0ZSwgY29udGV4dCkge1xuICAgIGlmIChvYmogPT0gbnVsbCkgcmV0dXJuIGZhbHNlO1xuICAgIHByZWRpY2F0ZSA9IF8uaXRlcmF0ZWUocHJlZGljYXRlLCBjb250ZXh0KTtcbiAgICB2YXIga2V5cyA9IG9iai5sZW5ndGggIT09ICtvYmoubGVuZ3RoICYmIF8ua2V5cyhvYmopLFxuICAgICAgICBsZW5ndGggPSAoa2V5cyB8fCBvYmopLmxlbmd0aCxcbiAgICAgICAgaW5kZXgsIGN1cnJlbnRLZXk7XG4gICAgZm9yIChpbmRleCA9IDA7IGluZGV4IDwgbGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICAgIGN1cnJlbnRLZXkgPSBrZXlzID8ga2V5c1tpbmRleF0gOiBpbmRleDtcbiAgICAgICAgaWYgKHByZWRpY2F0ZShvYmpbY3VycmVudEtleV0sIGN1cnJlbnRLZXksIG9iaikpIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG59O1xuXG5cbi8vIEV4dGVuZCBhIGdpdmVuIG9iamVjdCB3aXRoIGFsbCB0aGUgcHJvcGVydGllcyBpbiBwYXNzZWQtaW4gb2JqZWN0KHMpLlxuXy5leHRlbmQgPSBmdW5jdGlvbiAob2JqKSB7XG4gICAgaWYgKCFfLmlzT2JqZWN0KG9iaikpIHJldHVybiBvYmo7XG4gICAgdmFyIHNvdXJjZSwgcHJvcDtcbiAgICBmb3IgKHZhciBpID0gMSwgbGVuZ3RoID0gYXJndW1lbnRzLmxlbmd0aDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHNvdXJjZSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgZm9yIChwcm9wIGluIHNvdXJjZSkge1xuICAgICAgICAgICAgLy9ub2luc3BlY3Rpb24gSlNVbmZpbHRlcmVkRm9ySW5Mb29wXG4gICAgICAgICAgICBpZiAoaGFzT3duUHJvcGVydHkuY2FsbChzb3VyY2UsIHByb3ApKSB7XG4gICAgICAgICAgICAgICAgLy9ub2luc3BlY3Rpb24gSlNVbmZpbHRlcmVkRm9ySW5Mb29wXG4gICAgICAgICAgICAgICAgb2JqW3Byb3BdID0gc291cmNlW3Byb3BdO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBvYmo7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IF87IiwiLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGFcbi8vIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGVcbi8vIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZ1xuLy8gd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLFxuLy8gZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdFxuLy8gcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlXG4vLyBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZFxuLy8gaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTU1xuLy8gT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRlxuLy8gTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTlxuLy8gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sXG4vLyBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1Jcbi8vIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEVcbi8vIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG5cbmZ1bmN0aW9uIEV2ZW50RW1pdHRlcigpIHtcbiAgdGhpcy5fZXZlbnRzID0gdGhpcy5fZXZlbnRzIHx8IHt9O1xuICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSB0aGlzLl9tYXhMaXN0ZW5lcnMgfHwgdW5kZWZpbmVkO1xufVxubW9kdWxlLmV4cG9ydHMgPSBFdmVudEVtaXR0ZXI7XG5cbi8vIEJhY2t3YXJkcy1jb21wYXQgd2l0aCBub2RlIDAuMTAueFxuRXZlbnRFbWl0dGVyLkV2ZW50RW1pdHRlciA9IEV2ZW50RW1pdHRlcjtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fZXZlbnRzID0gdW5kZWZpbmVkO1xuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fbWF4TGlzdGVuZXJzID0gdW5kZWZpbmVkO1xuXG4vLyBCeSBkZWZhdWx0IEV2ZW50RW1pdHRlcnMgd2lsbCBwcmludCBhIHdhcm5pbmcgaWYgbW9yZSB0aGFuIDEwIGxpc3RlbmVycyBhcmVcbi8vIGFkZGVkIHRvIGl0LiBUaGlzIGlzIGEgdXNlZnVsIGRlZmF1bHQgd2hpY2ggaGVscHMgZmluZGluZyBtZW1vcnkgbGVha3MuXG5FdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycyA9IDEwO1xuXG4vLyBPYnZpb3VzbHkgbm90IGFsbCBFbWl0dGVycyBzaG91bGQgYmUgbGltaXRlZCB0byAxMC4gVGhpcyBmdW5jdGlvbiBhbGxvd3Ncbi8vIHRoYXQgdG8gYmUgaW5jcmVhc2VkLiBTZXQgdG8gemVybyBmb3IgdW5saW1pdGVkLlxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5zZXRNYXhMaXN0ZW5lcnMgPSBmdW5jdGlvbihuKSB7XG4gIGlmICghaXNOdW1iZXIobikgfHwgbiA8IDAgfHwgaXNOYU4obikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCduIG11c3QgYmUgYSBwb3NpdGl2ZSBudW1iZXInKTtcbiAgdGhpcy5fbWF4TGlzdGVuZXJzID0gbjtcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmVtaXQgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciBlciwgaGFuZGxlciwgbGVuLCBhcmdzLCBpLCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgLy8gSWYgdGhlcmUgaXMgbm8gJ2Vycm9yJyBldmVudCBsaXN0ZW5lciB0aGVuIHRocm93LlxuICBpZiAodHlwZSA9PT0gJ2Vycm9yJykge1xuICAgIGlmICghdGhpcy5fZXZlbnRzLmVycm9yIHx8XG4gICAgICAgIChpc09iamVjdCh0aGlzLl9ldmVudHMuZXJyb3IpICYmICF0aGlzLl9ldmVudHMuZXJyb3IubGVuZ3RoKSkge1xuICAgICAgZXIgPSBhcmd1bWVudHNbMV07XG4gICAgICBpZiAoZXIgaW5zdGFuY2VvZiBFcnJvcikge1xuICAgICAgICB0aHJvdyBlcjsgLy8gVW5oYW5kbGVkICdlcnJvcicgZXZlbnRcbiAgICAgIH1cbiAgICAgIHRocm93IFR5cGVFcnJvcignVW5jYXVnaHQsIHVuc3BlY2lmaWVkIFwiZXJyb3JcIiBldmVudC4nKTtcbiAgICB9XG4gIH1cblxuICBoYW5kbGVyID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIGlmIChpc1VuZGVmaW5lZChoYW5kbGVyKSlcbiAgICByZXR1cm4gZmFsc2U7XG5cbiAgaWYgKGlzRnVuY3Rpb24oaGFuZGxlcikpIHtcbiAgICBzd2l0Y2ggKGFyZ3VtZW50cy5sZW5ndGgpIHtcbiAgICAgIC8vIGZhc3QgY2FzZXNcbiAgICAgIGNhc2UgMTpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMjpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAzOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdLCBhcmd1bWVudHNbMl0pO1xuICAgICAgICBicmVhaztcbiAgICAgIC8vIHNsb3dlclxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgbGVuID0gYXJndW1lbnRzLmxlbmd0aDtcbiAgICAgICAgYXJncyA9IG5ldyBBcnJheShsZW4gLSAxKTtcbiAgICAgICAgZm9yIChpID0gMTsgaSA8IGxlbjsgaSsrKVxuICAgICAgICAgIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuICAgICAgICBoYW5kbGVyLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgIH1cbiAgfSBlbHNlIGlmIChpc09iamVjdChoYW5kbGVyKSkge1xuICAgIGxlbiA9IGFyZ3VtZW50cy5sZW5ndGg7XG4gICAgYXJncyA9IG5ldyBBcnJheShsZW4gLSAxKTtcbiAgICBmb3IgKGkgPSAxOyBpIDwgbGVuOyBpKyspXG4gICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcblxuICAgIGxpc3RlbmVycyA9IGhhbmRsZXIuc2xpY2UoKTtcbiAgICBsZW4gPSBsaXN0ZW5lcnMubGVuZ3RoO1xuICAgIGZvciAoaSA9IDA7IGkgPCBsZW47IGkrKylcbiAgICAgIGxpc3RlbmVyc1tpXS5hcHBseSh0aGlzLCBhcmdzKTtcbiAgfVxuXG4gIHJldHVybiB0cnVlO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIHZhciBtO1xuXG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcblxuICAvLyBUbyBhdm9pZCByZWN1cnNpb24gaW4gdGhlIGNhc2UgdGhhdCB0eXBlID09PSBcIm5ld0xpc3RlbmVyXCIhIEJlZm9yZVxuICAvLyBhZGRpbmcgaXQgdG8gdGhlIGxpc3RlbmVycywgZmlyc3QgZW1pdCBcIm5ld0xpc3RlbmVyXCIuXG4gIGlmICh0aGlzLl9ldmVudHMubmV3TGlzdGVuZXIpXG4gICAgdGhpcy5lbWl0KCduZXdMaXN0ZW5lcicsIHR5cGUsXG4gICAgICAgICAgICAgIGlzRnVuY3Rpb24obGlzdGVuZXIubGlzdGVuZXIpID9cbiAgICAgICAgICAgICAgbGlzdGVuZXIubGlzdGVuZXIgOiBsaXN0ZW5lcik7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgLy8gT3B0aW1pemUgdGhlIGNhc2Ugb2Ygb25lIGxpc3RlbmVyLiBEb24ndCBuZWVkIHRoZSBleHRyYSBhcnJheSBvYmplY3QuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gbGlzdGVuZXI7XG4gIGVsc2UgaWYgKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkpXG4gICAgLy8gSWYgd2UndmUgYWxyZWFkeSBnb3QgYW4gYXJyYXksIGp1c3QgYXBwZW5kLlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5wdXNoKGxpc3RlbmVyKTtcbiAgZWxzZVxuICAgIC8vIEFkZGluZyB0aGUgc2Vjb25kIGVsZW1lbnQsIG5lZWQgdG8gY2hhbmdlIHRvIGFycmF5LlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IFt0aGlzLl9ldmVudHNbdHlwZV0sIGxpc3RlbmVyXTtcblxuICAvLyBDaGVjayBmb3IgbGlzdGVuZXIgbGVha1xuICBpZiAoaXNPYmplY3QodGhpcy5fZXZlbnRzW3R5cGVdKSAmJiAhdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCkge1xuICAgIHZhciBtO1xuICAgIGlmICghaXNVbmRlZmluZWQodGhpcy5fbWF4TGlzdGVuZXJzKSkge1xuICAgICAgbSA9IHRoaXMuX21heExpc3RlbmVycztcbiAgICB9IGVsc2Uge1xuICAgICAgbSA9IEV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzO1xuICAgIH1cblxuICAgIGlmIChtICYmIG0gPiAwICYmIHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGggPiBtKSB7XG4gICAgICB0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkID0gdHJ1ZTtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJyhub2RlKSB3YXJuaW5nOiBwb3NzaWJsZSBFdmVudEVtaXR0ZXIgbWVtb3J5ICcgK1xuICAgICAgICAgICAgICAgICAgICAnbGVhayBkZXRlY3RlZC4gJWQgbGlzdGVuZXJzIGFkZGVkLiAnICtcbiAgICAgICAgICAgICAgICAgICAgJ1VzZSBlbWl0dGVyLnNldE1heExpc3RlbmVycygpIHRvIGluY3JlYXNlIGxpbWl0LicsXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGgpO1xuICAgICAgaWYgKHR5cGVvZiBjb25zb2xlLnRyYWNlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIC8vIG5vdCBzdXBwb3J0ZWQgaW4gSUUgMTBcbiAgICAgICAgY29uc29sZS50cmFjZSgpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbiA9IEV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXI7XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub25jZSA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICB2YXIgZmlyZWQgPSBmYWxzZTtcblxuICBmdW5jdGlvbiBnKCkge1xuICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgZyk7XG5cbiAgICBpZiAoIWZpcmVkKSB7XG4gICAgICBmaXJlZCA9IHRydWU7XG4gICAgICBsaXN0ZW5lci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH1cbiAgfVxuXG4gIGcubGlzdGVuZXIgPSBsaXN0ZW5lcjtcbiAgdGhpcy5vbih0eXBlLCBnKTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbi8vIGVtaXRzIGEgJ3JlbW92ZUxpc3RlbmVyJyBldmVudCBpZmYgdGhlIGxpc3RlbmVyIHdhcyByZW1vdmVkXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUxpc3RlbmVyID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgdmFyIGxpc3QsIHBvc2l0aW9uLCBsZW5ndGgsIGk7XG5cbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzIHx8ICF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgbGlzdCA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgbGVuZ3RoID0gbGlzdC5sZW5ndGg7XG4gIHBvc2l0aW9uID0gLTE7XG5cbiAgaWYgKGxpc3QgPT09IGxpc3RlbmVyIHx8XG4gICAgICAoaXNGdW5jdGlvbihsaXN0Lmxpc3RlbmVyKSAmJiBsaXN0Lmxpc3RlbmVyID09PSBsaXN0ZW5lcikpIHtcbiAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIGlmICh0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpXG4gICAgICB0aGlzLmVtaXQoJ3JlbW92ZUxpc3RlbmVyJywgdHlwZSwgbGlzdGVuZXIpO1xuXG4gIH0gZWxzZSBpZiAoaXNPYmplY3QobGlzdCkpIHtcbiAgICBmb3IgKGkgPSBsZW5ndGg7IGktLSA+IDA7KSB7XG4gICAgICBpZiAobGlzdFtpXSA9PT0gbGlzdGVuZXIgfHxcbiAgICAgICAgICAobGlzdFtpXS5saXN0ZW5lciAmJiBsaXN0W2ldLmxpc3RlbmVyID09PSBsaXN0ZW5lcikpIHtcbiAgICAgICAgcG9zaXRpb24gPSBpO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAocG9zaXRpb24gPCAwKVxuICAgICAgcmV0dXJuIHRoaXM7XG5cbiAgICBpZiAobGlzdC5sZW5ndGggPT09IDEpIHtcbiAgICAgIGxpc3QubGVuZ3RoID0gMDtcbiAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgfSBlbHNlIHtcbiAgICAgIGxpc3Quc3BsaWNlKHBvc2l0aW9uLCAxKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKVxuICAgICAgdGhpcy5lbWl0KCdyZW1vdmVMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciBrZXksIGxpc3RlbmVycztcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICByZXR1cm4gdGhpcztcblxuICAvLyBub3QgbGlzdGVuaW5nIGZvciByZW1vdmVMaXN0ZW5lciwgbm8gbmVlZCB0byBlbWl0XG4gIGlmICghdGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKSB7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApXG4gICAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICBlbHNlIGlmICh0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLy8gZW1pdCByZW1vdmVMaXN0ZW5lciBmb3IgYWxsIGxpc3RlbmVycyBvbiBhbGwgZXZlbnRzXG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgZm9yIChrZXkgaW4gdGhpcy5fZXZlbnRzKSB7XG4gICAgICBpZiAoa2V5ID09PSAncmVtb3ZlTGlzdGVuZXInKSBjb250aW51ZTtcbiAgICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKGtleSk7XG4gICAgfVxuICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKCdyZW1vdmVMaXN0ZW5lcicpO1xuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgbGlzdGVuZXJzID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIGlmIChpc0Z1bmN0aW9uKGxpc3RlbmVycykpIHtcbiAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGxpc3RlbmVycyk7XG4gIH0gZWxzZSB7XG4gICAgLy8gTElGTyBvcmRlclxuICAgIHdoaWxlIChsaXN0ZW5lcnMubGVuZ3RoKVxuICAgICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnNbbGlzdGVuZXJzLmxlbmd0aCAtIDFdKTtcbiAgfVxuICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5saXN0ZW5lcnMgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciByZXQ7XG4gIGlmICghdGhpcy5fZXZlbnRzIHx8ICF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0ID0gW107XG4gIGVsc2UgaWYgKGlzRnVuY3Rpb24odGhpcy5fZXZlbnRzW3R5cGVdKSlcbiAgICByZXQgPSBbdGhpcy5fZXZlbnRzW3R5cGVdXTtcbiAgZWxzZVxuICAgIHJldCA9IHRoaXMuX2V2ZW50c1t0eXBlXS5zbGljZSgpO1xuICByZXR1cm4gcmV0O1xufTtcblxuRXZlbnRFbWl0dGVyLmxpc3RlbmVyQ291bnQgPSBmdW5jdGlvbihlbWl0dGVyLCB0eXBlKSB7XG4gIHZhciByZXQ7XG4gIGlmICghZW1pdHRlci5fZXZlbnRzIHx8ICFlbWl0dGVyLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0ID0gMDtcbiAgZWxzZSBpZiAoaXNGdW5jdGlvbihlbWl0dGVyLl9ldmVudHNbdHlwZV0pKVxuICAgIHJldCA9IDE7XG4gIGVsc2VcbiAgICByZXQgPSBlbWl0dGVyLl9ldmVudHNbdHlwZV0ubGVuZ3RoO1xuICByZXR1cm4gcmV0O1xufTtcblxuZnVuY3Rpb24gaXNGdW5jdGlvbihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdmdW5jdGlvbic7XG59XG5cbmZ1bmN0aW9uIGlzTnVtYmVyKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ251bWJlcic7XG59XG5cbmZ1bmN0aW9uIGlzT2JqZWN0KGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ29iamVjdCcgJiYgYXJnICE9PSBudWxsO1xufVxuXG5mdW5jdGlvbiBpc1VuZGVmaW5lZChhcmcpIHtcbiAgcmV0dXJuIGFyZyA9PT0gdm9pZCAwO1xufVxuIiwidmFyIGhhc093biA9IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHk7XG52YXIgdG9TdHJpbmcgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nO1xudmFyIHVuZGVmaW5lZDtcblxudmFyIGlzUGxhaW5PYmplY3QgPSBmdW5jdGlvbiBpc1BsYWluT2JqZWN0KG9iaikge1xuICAgIFwidXNlIHN0cmljdFwiO1xuICAgIGlmICghb2JqIHx8IHRvU3RyaW5nLmNhbGwob2JqKSAhPT0gJ1tvYmplY3QgT2JqZWN0XScgfHwgb2JqLm5vZGVUeXBlIHx8IG9iai5zZXRJbnRlcnZhbCkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgdmFyIGhhc19vd25fY29uc3RydWN0b3IgPSBoYXNPd24uY2FsbChvYmosICdjb25zdHJ1Y3RvcicpO1xuICAgIHZhciBoYXNfaXNfcHJvcGVydHlfb2ZfbWV0aG9kID0gb2JqLmNvbnN0cnVjdG9yICYmIG9iai5jb25zdHJ1Y3Rvci5wcm90b3R5cGUgJiYgaGFzT3duLmNhbGwob2JqLmNvbnN0cnVjdG9yLnByb3RvdHlwZSwgJ2lzUHJvdG90eXBlT2YnKTtcbiAgICAvLyBOb3Qgb3duIGNvbnN0cnVjdG9yIHByb3BlcnR5IG11c3QgYmUgT2JqZWN0XG4gICAgaWYgKG9iai5jb25zdHJ1Y3RvciAmJiAhaGFzX293bl9jb25zdHJ1Y3RvciAmJiAhaGFzX2lzX3Byb3BlcnR5X29mX21ldGhvZCkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgLy8gT3duIHByb3BlcnRpZXMgYXJlIGVudW1lcmF0ZWQgZmlyc3RseSwgc28gdG8gc3BlZWQgdXAsXG4gICAgLy8gaWYgbGFzdCBvbmUgaXMgb3duLCB0aGVuIGFsbCBwcm9wZXJ0aWVzIGFyZSBvd24uXG4gICAgdmFyIGtleTtcbiAgICBmb3IgKGtleSBpbiBvYmopIHt9XG5cbiAgICByZXR1cm4ga2V5ID09PSB1bmRlZmluZWQgfHwgaGFzT3duLmNhbGwob2JqLCBrZXkpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBleHRlbmQoKSB7XG4gICAgXCJ1c2Ugc3RyaWN0XCI7XG4gICAgdmFyIG9wdGlvbnMsIG5hbWUsIHNyYywgY29weSwgY29weUlzQXJyYXksIGNsb25lLFxuICAgICAgICB0YXJnZXQgPSBhcmd1bWVudHNbMF0sXG4gICAgICAgIGkgPSAxLFxuICAgICAgICBsZW5ndGggPSBhcmd1bWVudHMubGVuZ3RoLFxuICAgICAgICBkZWVwID0gZmFsc2U7XG5cbiAgICAvLyBIYW5kbGUgYSBkZWVwIGNvcHkgc2l0dWF0aW9uXG4gICAgaWYgKHR5cGVvZiB0YXJnZXQgPT09IFwiYm9vbGVhblwiKSB7XG4gICAgICAgIGRlZXAgPSB0YXJnZXQ7XG4gICAgICAgIHRhcmdldCA9IGFyZ3VtZW50c1sxXSB8fCB7fTtcbiAgICAgICAgLy8gc2tpcCB0aGUgYm9vbGVhbiBhbmQgdGhlIHRhcmdldFxuICAgICAgICBpID0gMjtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiB0YXJnZXQgIT09IFwib2JqZWN0XCIgJiYgdHlwZW9mIHRhcmdldCAhPT0gXCJmdW5jdGlvblwiIHx8IHRhcmdldCA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgdGFyZ2V0ID0ge307XG4gICAgfVxuXG4gICAgZm9yICg7IGkgPCBsZW5ndGg7ICsraSkge1xuICAgICAgICAvLyBPbmx5IGRlYWwgd2l0aCBub24tbnVsbC91bmRlZmluZWQgdmFsdWVzXG4gICAgICAgIGlmICgob3B0aW9ucyA9IGFyZ3VtZW50c1tpXSkgIT0gbnVsbCkge1xuICAgICAgICAgICAgLy8gRXh0ZW5kIHRoZSBiYXNlIG9iamVjdFxuICAgICAgICAgICAgZm9yIChuYW1lIGluIG9wdGlvbnMpIHtcbiAgICAgICAgICAgICAgICBzcmMgPSB0YXJnZXRbbmFtZV07XG4gICAgICAgICAgICAgICAgY29weSA9IG9wdGlvbnNbbmFtZV07XG5cbiAgICAgICAgICAgICAgICAvLyBQcmV2ZW50IG5ldmVyLWVuZGluZyBsb29wXG4gICAgICAgICAgICAgICAgaWYgKHRhcmdldCA9PT0gY29weSkge1xuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBSZWN1cnNlIGlmIHdlJ3JlIG1lcmdpbmcgcGxhaW4gb2JqZWN0cyBvciBhcnJheXNcbiAgICAgICAgICAgICAgICBpZiAoZGVlcCAmJiBjb3B5ICYmIChpc1BsYWluT2JqZWN0KGNvcHkpIHx8IChjb3B5SXNBcnJheSA9IEFycmF5LmlzQXJyYXkoY29weSkpKSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoY29weUlzQXJyYXkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvcHlJc0FycmF5ID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICBjbG9uZSA9IHNyYyAmJiBBcnJheS5pc0FycmF5KHNyYykgPyBzcmMgOiBbXTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsb25lID0gc3JjICYmIGlzUGxhaW5PYmplY3Qoc3JjKSA/IHNyYyA6IHt9O1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gTmV2ZXIgbW92ZSBvcmlnaW5hbCBvYmplY3RzLCBjbG9uZSB0aGVtXG4gICAgICAgICAgICAgICAgICAgIHRhcmdldFtuYW1lXSA9IGV4dGVuZChkZWVwLCBjbG9uZSwgY29weSk7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gRG9uJ3QgYnJpbmcgaW4gdW5kZWZpbmVkIHZhbHVlc1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoY29weSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgIHRhcmdldFtuYW1lXSA9IGNvcHk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gUmV0dXJuIHRoZSBtb2RpZmllZCBvYmplY3RcbiAgICByZXR1cm4gdGFyZ2V0O1xufTtcblxuIiwiKGZ1bmN0aW9uIChnbG9iYWwpe1xuLypcbiAqIENvcHlyaWdodCAoYykgMjAxNCBUaGUgUG9seW1lciBQcm9qZWN0IEF1dGhvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiBUaGlzIGNvZGUgbWF5IG9ubHkgYmUgdXNlZCB1bmRlciB0aGUgQlNEIHN0eWxlIGxpY2Vuc2UgZm91bmQgYXQgaHR0cDovL3BvbHltZXIuZ2l0aHViLmlvL0xJQ0VOU0UudHh0XG4gKiBUaGUgY29tcGxldGUgc2V0IG9mIGF1dGhvcnMgbWF5IGJlIGZvdW5kIGF0IGh0dHA6Ly9wb2x5bWVyLmdpdGh1Yi5pby9BVVRIT1JTLnR4dFxuICogVGhlIGNvbXBsZXRlIHNldCBvZiBjb250cmlidXRvcnMgbWF5IGJlIGZvdW5kIGF0IGh0dHA6Ly9wb2x5bWVyLmdpdGh1Yi5pby9DT05UUklCVVRPUlMudHh0XG4gKiBDb2RlIGRpc3RyaWJ1dGVkIGJ5IEdvb2dsZSBhcyBwYXJ0IG9mIHRoZSBwb2x5bWVyIHByb2plY3QgaXMgYWxzb1xuICogc3ViamVjdCB0byBhbiBhZGRpdGlvbmFsIElQIHJpZ2h0cyBncmFudCBmb3VuZCBhdCBodHRwOi8vcG9seW1lci5naXRodWIuaW8vUEFURU5UUy50eHRcbiAqL1xuXG4oZnVuY3Rpb24oZ2xvYmFsKSB7XG4gICd1c2Ugc3RyaWN0JztcblxuICB2YXIgdGVzdGluZ0V4cG9zZUN5Y2xlQ291bnQgPSBnbG9iYWwudGVzdGluZ0V4cG9zZUN5Y2xlQ291bnQ7XG5cbiAgLy8gRGV0ZWN0IGFuZCBkbyBiYXNpYyBzYW5pdHkgY2hlY2tpbmcgb24gT2JqZWN0L0FycmF5Lm9ic2VydmUuXG4gIGZ1bmN0aW9uIGRldGVjdE9iamVjdE9ic2VydmUoKSB7XG4gICAgaWYgKHR5cGVvZiBPYmplY3Qub2JzZXJ2ZSAhPT0gJ2Z1bmN0aW9uJyB8fFxuICAgICAgICB0eXBlb2YgQXJyYXkub2JzZXJ2ZSAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHZhciByZWNvcmRzID0gW107XG5cbiAgICBmdW5jdGlvbiBjYWxsYmFjayhyZWNzKSB7XG4gICAgICByZWNvcmRzID0gcmVjcztcbiAgICB9XG5cbiAgICB2YXIgdGVzdCA9IHt9O1xuICAgIHZhciBhcnIgPSBbXTtcbiAgICBPYmplY3Qub2JzZXJ2ZSh0ZXN0LCBjYWxsYmFjayk7XG4gICAgQXJyYXkub2JzZXJ2ZShhcnIsIGNhbGxiYWNrKTtcbiAgICB0ZXN0LmlkID0gMTtcbiAgICB0ZXN0LmlkID0gMjtcbiAgICBkZWxldGUgdGVzdC5pZDtcbiAgICBhcnIucHVzaCgxLCAyKTtcbiAgICBhcnIubGVuZ3RoID0gMDtcblxuICAgIE9iamVjdC5kZWxpdmVyQ2hhbmdlUmVjb3JkcyhjYWxsYmFjayk7XG4gICAgaWYgKHJlY29yZHMubGVuZ3RoICE9PSA1KVxuICAgICAgcmV0dXJuIGZhbHNlO1xuXG4gICAgaWYgKHJlY29yZHNbMF0udHlwZSAhPSAnYWRkJyB8fFxuICAgICAgICByZWNvcmRzWzFdLnR5cGUgIT0gJ3VwZGF0ZScgfHxcbiAgICAgICAgcmVjb3Jkc1syXS50eXBlICE9ICdkZWxldGUnIHx8XG4gICAgICAgIHJlY29yZHNbM10udHlwZSAhPSAnc3BsaWNlJyB8fFxuICAgICAgICByZWNvcmRzWzRdLnR5cGUgIT0gJ3NwbGljZScpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBPYmplY3QudW5vYnNlcnZlKHRlc3QsIGNhbGxiYWNrKTtcbiAgICBBcnJheS51bm9ic2VydmUoYXJyLCBjYWxsYmFjayk7XG5cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIHZhciBoYXNPYnNlcnZlID0gZGV0ZWN0T2JqZWN0T2JzZXJ2ZSgpO1xuXG4gIGZ1bmN0aW9uIGRldGVjdEV2YWwoKSB7XG4gICAgLy8gRG9uJ3QgdGVzdCBmb3IgZXZhbCBpZiB3ZSdyZSBydW5uaW5nIGluIGEgQ2hyb21lIEFwcCBlbnZpcm9ubWVudC5cbiAgICAvLyBXZSBjaGVjayBmb3IgQVBJcyBzZXQgdGhhdCBvbmx5IGV4aXN0IGluIGEgQ2hyb21lIEFwcCBjb250ZXh0LlxuICAgIGlmICh0eXBlb2YgY2hyb21lICE9PSAndW5kZWZpbmVkJyAmJiBjaHJvbWUuYXBwICYmIGNocm9tZS5hcHAucnVudGltZSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIC8vIEZpcmVmb3ggT1MgQXBwcyBkbyBub3QgYWxsb3cgZXZhbC4gVGhpcyBmZWF0dXJlIGRldGVjdGlvbiBpcyB2ZXJ5IGhhY2t5XG4gICAgLy8gYnV0IGV2ZW4gaWYgc29tZSBvdGhlciBwbGF0Zm9ybSBhZGRzIHN1cHBvcnQgZm9yIHRoaXMgZnVuY3Rpb24gdGhpcyBjb2RlXG4gICAgLy8gd2lsbCBjb250aW51ZSB0byB3b3JrLlxuICAgIGlmIChuYXZpZ2F0b3IuZ2V0RGV2aWNlU3RvcmFnZSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHRyeSB7XG4gICAgICB2YXIgZiA9IG5ldyBGdW5jdGlvbignJywgJ3JldHVybiB0cnVlOycpO1xuICAgICAgcmV0dXJuIGYoKTtcbiAgICB9IGNhdGNoIChleCkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIHZhciBoYXNFdmFsID0gZGV0ZWN0RXZhbCgpO1xuXG4gIGZ1bmN0aW9uIGlzSW5kZXgocykge1xuICAgIHJldHVybiArcyA9PT0gcyA+Pj4gMCAmJiBzICE9PSAnJztcbiAgfVxuXG4gIGZ1bmN0aW9uIHRvTnVtYmVyKHMpIHtcbiAgICByZXR1cm4gK3M7XG4gIH1cblxuICBmdW5jdGlvbiBpc09iamVjdChvYmopIHtcbiAgICByZXR1cm4gb2JqID09PSBPYmplY3Qob2JqKTtcbiAgfVxuXG4gIHZhciBudW1iZXJJc05hTiA9IGdsb2JhbC5OdW1iZXIuaXNOYU4gfHwgZnVuY3Rpb24odmFsdWUpIHtcbiAgICByZXR1cm4gdHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJyAmJiBnbG9iYWwuaXNOYU4odmFsdWUpO1xuICB9XG5cbiAgZnVuY3Rpb24gYXJlU2FtZVZhbHVlKGxlZnQsIHJpZ2h0KSB7XG4gICAgaWYgKGxlZnQgPT09IHJpZ2h0KVxuICAgICAgcmV0dXJuIGxlZnQgIT09IDAgfHwgMSAvIGxlZnQgPT09IDEgLyByaWdodDtcbiAgICBpZiAobnVtYmVySXNOYU4obGVmdCkgJiYgbnVtYmVySXNOYU4ocmlnaHQpKVxuICAgICAgcmV0dXJuIHRydWU7XG5cbiAgICByZXR1cm4gbGVmdCAhPT0gbGVmdCAmJiByaWdodCAhPT0gcmlnaHQ7XG4gIH1cblxuICB2YXIgY3JlYXRlT2JqZWN0ID0gKCdfX3Byb3RvX18nIGluIHt9KSA/XG4gICAgZnVuY3Rpb24ob2JqKSB7IHJldHVybiBvYmo7IH0gOlxuICAgIGZ1bmN0aW9uKG9iaikge1xuICAgICAgdmFyIHByb3RvID0gb2JqLl9fcHJvdG9fXztcbiAgICAgIGlmICghcHJvdG8pXG4gICAgICAgIHJldHVybiBvYmo7XG4gICAgICB2YXIgbmV3T2JqZWN0ID0gT2JqZWN0LmNyZWF0ZShwcm90byk7XG4gICAgICBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhvYmopLmZvckVhY2goZnVuY3Rpb24obmFtZSkge1xuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkobmV3T2JqZWN0LCBuYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKG9iaiwgbmFtZSkpO1xuICAgICAgfSk7XG4gICAgICByZXR1cm4gbmV3T2JqZWN0O1xuICAgIH07XG5cbiAgdmFyIGlkZW50U3RhcnQgPSAnW1xcJF9hLXpBLVpdJztcbiAgdmFyIGlkZW50UGFydCA9ICdbXFwkX2EtekEtWjAtOV0nO1xuICB2YXIgaWRlbnRSZWdFeHAgPSBuZXcgUmVnRXhwKCdeJyArIGlkZW50U3RhcnQgKyAnKycgKyBpZGVudFBhcnQgKyAnKicgKyAnJCcpO1xuXG4gIGZ1bmN0aW9uIGdldFBhdGhDaGFyVHlwZShjaGFyKSB7XG4gICAgaWYgKGNoYXIgPT09IHVuZGVmaW5lZClcbiAgICAgIHJldHVybiAnZW9mJztcblxuICAgIHZhciBjb2RlID0gY2hhci5jaGFyQ29kZUF0KDApO1xuXG4gICAgc3dpdGNoKGNvZGUpIHtcbiAgICAgIGNhc2UgMHg1QjogLy8gW1xuICAgICAgY2FzZSAweDVEOiAvLyBdXG4gICAgICBjYXNlIDB4MkU6IC8vIC5cbiAgICAgIGNhc2UgMHgyMjogLy8gXCJcbiAgICAgIGNhc2UgMHgyNzogLy8gJ1xuICAgICAgY2FzZSAweDMwOiAvLyAwXG4gICAgICAgIHJldHVybiBjaGFyO1xuXG4gICAgICBjYXNlIDB4NUY6IC8vIF9cbiAgICAgIGNhc2UgMHgyNDogLy8gJFxuICAgICAgICByZXR1cm4gJ2lkZW50JztcblxuICAgICAgY2FzZSAweDIwOiAvLyBTcGFjZVxuICAgICAgY2FzZSAweDA5OiAvLyBUYWJcbiAgICAgIGNhc2UgMHgwQTogLy8gTmV3bGluZVxuICAgICAgY2FzZSAweDBEOiAvLyBSZXR1cm5cbiAgICAgIGNhc2UgMHhBMDogIC8vIE5vLWJyZWFrIHNwYWNlXG4gICAgICBjYXNlIDB4RkVGRjogIC8vIEJ5dGUgT3JkZXIgTWFya1xuICAgICAgY2FzZSAweDIwMjg6ICAvLyBMaW5lIFNlcGFyYXRvclxuICAgICAgY2FzZSAweDIwMjk6ICAvLyBQYXJhZ3JhcGggU2VwYXJhdG9yXG4gICAgICAgIHJldHVybiAnd3MnO1xuICAgIH1cblxuICAgIC8vIGEteiwgQS1aXG4gICAgaWYgKCgweDYxIDw9IGNvZGUgJiYgY29kZSA8PSAweDdBKSB8fCAoMHg0MSA8PSBjb2RlICYmIGNvZGUgPD0gMHg1QSkpXG4gICAgICByZXR1cm4gJ2lkZW50JztcblxuICAgIC8vIDEtOVxuICAgIGlmICgweDMxIDw9IGNvZGUgJiYgY29kZSA8PSAweDM5KVxuICAgICAgcmV0dXJuICdudW1iZXInO1xuXG4gICAgcmV0dXJuICdlbHNlJztcbiAgfVxuXG4gIHZhciBwYXRoU3RhdGVNYWNoaW5lID0ge1xuICAgICdiZWZvcmVQYXRoJzoge1xuICAgICAgJ3dzJzogWydiZWZvcmVQYXRoJ10sXG4gICAgICAnaWRlbnQnOiBbJ2luSWRlbnQnLCAnYXBwZW5kJ10sXG4gICAgICAnWyc6IFsnYmVmb3JlRWxlbWVudCddLFxuICAgICAgJ2VvZic6IFsnYWZ0ZXJQYXRoJ11cbiAgICB9LFxuXG4gICAgJ2luUGF0aCc6IHtcbiAgICAgICd3cyc6IFsnaW5QYXRoJ10sXG4gICAgICAnLic6IFsnYmVmb3JlSWRlbnQnXSxcbiAgICAgICdbJzogWydiZWZvcmVFbGVtZW50J10sXG4gICAgICAnZW9mJzogWydhZnRlclBhdGgnXVxuICAgIH0sXG5cbiAgICAnYmVmb3JlSWRlbnQnOiB7XG4gICAgICAnd3MnOiBbJ2JlZm9yZUlkZW50J10sXG4gICAgICAnaWRlbnQnOiBbJ2luSWRlbnQnLCAnYXBwZW5kJ11cbiAgICB9LFxuXG4gICAgJ2luSWRlbnQnOiB7XG4gICAgICAnaWRlbnQnOiBbJ2luSWRlbnQnLCAnYXBwZW5kJ10sXG4gICAgICAnMCc6IFsnaW5JZGVudCcsICdhcHBlbmQnXSxcbiAgICAgICdudW1iZXInOiBbJ2luSWRlbnQnLCAnYXBwZW5kJ10sXG4gICAgICAnd3MnOiBbJ2luUGF0aCcsICdwdXNoJ10sXG4gICAgICAnLic6IFsnYmVmb3JlSWRlbnQnLCAncHVzaCddLFxuICAgICAgJ1snOiBbJ2JlZm9yZUVsZW1lbnQnLCAncHVzaCddLFxuICAgICAgJ2VvZic6IFsnYWZ0ZXJQYXRoJywgJ3B1c2gnXVxuICAgIH0sXG5cbiAgICAnYmVmb3JlRWxlbWVudCc6IHtcbiAgICAgICd3cyc6IFsnYmVmb3JlRWxlbWVudCddLFxuICAgICAgJzAnOiBbJ2FmdGVyWmVybycsICdhcHBlbmQnXSxcbiAgICAgICdudW1iZXInOiBbJ2luSW5kZXgnLCAnYXBwZW5kJ10sXG4gICAgICBcIidcIjogWydpblNpbmdsZVF1b3RlJywgJ2FwcGVuZCcsICcnXSxcbiAgICAgICdcIic6IFsnaW5Eb3VibGVRdW90ZScsICdhcHBlbmQnLCAnJ11cbiAgICB9LFxuXG4gICAgJ2FmdGVyWmVybyc6IHtcbiAgICAgICd3cyc6IFsnYWZ0ZXJFbGVtZW50JywgJ3B1c2gnXSxcbiAgICAgICddJzogWydpblBhdGgnLCAncHVzaCddXG4gICAgfSxcblxuICAgICdpbkluZGV4Jzoge1xuICAgICAgJzAnOiBbJ2luSW5kZXgnLCAnYXBwZW5kJ10sXG4gICAgICAnbnVtYmVyJzogWydpbkluZGV4JywgJ2FwcGVuZCddLFxuICAgICAgJ3dzJzogWydhZnRlckVsZW1lbnQnXSxcbiAgICAgICddJzogWydpblBhdGgnLCAncHVzaCddXG4gICAgfSxcblxuICAgICdpblNpbmdsZVF1b3RlJzoge1xuICAgICAgXCInXCI6IFsnYWZ0ZXJFbGVtZW50J10sXG4gICAgICAnZW9mJzogWydlcnJvciddLFxuICAgICAgJ2Vsc2UnOiBbJ2luU2luZ2xlUXVvdGUnLCAnYXBwZW5kJ11cbiAgICB9LFxuXG4gICAgJ2luRG91YmxlUXVvdGUnOiB7XG4gICAgICAnXCInOiBbJ2FmdGVyRWxlbWVudCddLFxuICAgICAgJ2VvZic6IFsnZXJyb3InXSxcbiAgICAgICdlbHNlJzogWydpbkRvdWJsZVF1b3RlJywgJ2FwcGVuZCddXG4gICAgfSxcblxuICAgICdhZnRlckVsZW1lbnQnOiB7XG4gICAgICAnd3MnOiBbJ2FmdGVyRWxlbWVudCddLFxuICAgICAgJ10nOiBbJ2luUGF0aCcsICdwdXNoJ11cbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBub29wKCkge31cblxuICBmdW5jdGlvbiBwYXJzZVBhdGgocGF0aCkge1xuICAgIHZhciBrZXlzID0gW107XG4gICAgdmFyIGluZGV4ID0gLTE7XG4gICAgdmFyIGMsIG5ld0NoYXIsIGtleSwgdHlwZSwgdHJhbnNpdGlvbiwgYWN0aW9uLCB0eXBlTWFwLCBtb2RlID0gJ2JlZm9yZVBhdGgnO1xuXG4gICAgdmFyIGFjdGlvbnMgPSB7XG4gICAgICBwdXNoOiBmdW5jdGlvbigpIHtcbiAgICAgICAgaWYgKGtleSA9PT0gdW5kZWZpbmVkKVxuICAgICAgICAgIHJldHVybjtcblxuICAgICAgICBrZXlzLnB1c2goa2V5KTtcbiAgICAgICAga2V5ID0gdW5kZWZpbmVkO1xuICAgICAgfSxcblxuICAgICAgYXBwZW5kOiBmdW5jdGlvbigpIHtcbiAgICAgICAgaWYgKGtleSA9PT0gdW5kZWZpbmVkKVxuICAgICAgICAgIGtleSA9IG5ld0NoYXJcbiAgICAgICAgZWxzZVxuICAgICAgICAgIGtleSArPSBuZXdDaGFyO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBmdW5jdGlvbiBtYXliZVVuZXNjYXBlUXVvdGUoKSB7XG4gICAgICBpZiAoaW5kZXggPj0gcGF0aC5sZW5ndGgpXG4gICAgICAgIHJldHVybjtcblxuICAgICAgdmFyIG5leHRDaGFyID0gcGF0aFtpbmRleCArIDFdO1xuICAgICAgaWYgKChtb2RlID09ICdpblNpbmdsZVF1b3RlJyAmJiBuZXh0Q2hhciA9PSBcIidcIikgfHxcbiAgICAgICAgICAobW9kZSA9PSAnaW5Eb3VibGVRdW90ZScgJiYgbmV4dENoYXIgPT0gJ1wiJykpIHtcbiAgICAgICAgaW5kZXgrKztcbiAgICAgICAgbmV3Q2hhciA9IG5leHRDaGFyO1xuICAgICAgICBhY3Rpb25zLmFwcGVuZCgpO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB3aGlsZSAobW9kZSkge1xuICAgICAgaW5kZXgrKztcbiAgICAgIGMgPSBwYXRoW2luZGV4XTtcblxuICAgICAgaWYgKGMgPT0gJ1xcXFwnICYmIG1heWJlVW5lc2NhcGVRdW90ZShtb2RlKSlcbiAgICAgICAgY29udGludWU7XG5cbiAgICAgIHR5cGUgPSBnZXRQYXRoQ2hhclR5cGUoYyk7XG4gICAgICB0eXBlTWFwID0gcGF0aFN0YXRlTWFjaGluZVttb2RlXTtcbiAgICAgIHRyYW5zaXRpb24gPSB0eXBlTWFwW3R5cGVdIHx8IHR5cGVNYXBbJ2Vsc2UnXSB8fCAnZXJyb3InO1xuXG4gICAgICBpZiAodHJhbnNpdGlvbiA9PSAnZXJyb3InKVxuICAgICAgICByZXR1cm47IC8vIHBhcnNlIGVycm9yO1xuXG4gICAgICBtb2RlID0gdHJhbnNpdGlvblswXTtcbiAgICAgIGFjdGlvbiA9IGFjdGlvbnNbdHJhbnNpdGlvblsxXV0gfHwgbm9vcDtcbiAgICAgIG5ld0NoYXIgPSB0cmFuc2l0aW9uWzJdID09PSB1bmRlZmluZWQgPyBjIDogdHJhbnNpdGlvblsyXTtcbiAgICAgIGFjdGlvbigpO1xuXG4gICAgICBpZiAobW9kZSA9PT0gJ2FmdGVyUGF0aCcpIHtcbiAgICAgICAgcmV0dXJuIGtleXM7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuOyAvLyBwYXJzZSBlcnJvclxuICB9XG5cbiAgZnVuY3Rpb24gaXNJZGVudChzKSB7XG4gICAgcmV0dXJuIGlkZW50UmVnRXhwLnRlc3Qocyk7XG4gIH1cblxuICB2YXIgY29uc3RydWN0b3JJc1ByaXZhdGUgPSB7fTtcblxuICBmdW5jdGlvbiBQYXRoKHBhcnRzLCBwcml2YXRlVG9rZW4pIHtcbiAgICBpZiAocHJpdmF0ZVRva2VuICE9PSBjb25zdHJ1Y3RvcklzUHJpdmF0ZSlcbiAgICAgIHRocm93IEVycm9yKCdVc2UgUGF0aC5nZXQgdG8gcmV0cmlldmUgcGF0aCBvYmplY3RzJyk7XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHBhcnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB0aGlzLnB1c2goU3RyaW5nKHBhcnRzW2ldKSk7XG4gICAgfVxuXG4gICAgaWYgKGhhc0V2YWwgJiYgdGhpcy5sZW5ndGgpIHtcbiAgICAgIHRoaXMuZ2V0VmFsdWVGcm9tID0gdGhpcy5jb21waWxlZEdldFZhbHVlRnJvbUZuKCk7XG4gICAgfVxuICB9XG5cbiAgLy8gVE9ETyhyYWZhZWx3KTogTWFrZSBzaW1wbGUgTFJVIGNhY2hlXG4gIHZhciBwYXRoQ2FjaGUgPSB7fTtcblxuICBmdW5jdGlvbiBnZXRQYXRoKHBhdGhTdHJpbmcpIHtcbiAgICBpZiAocGF0aFN0cmluZyBpbnN0YW5jZW9mIFBhdGgpXG4gICAgICByZXR1cm4gcGF0aFN0cmluZztcblxuICAgIGlmIChwYXRoU3RyaW5nID09IG51bGwgfHwgcGF0aFN0cmluZy5sZW5ndGggPT0gMClcbiAgICAgIHBhdGhTdHJpbmcgPSAnJztcblxuICAgIGlmICh0eXBlb2YgcGF0aFN0cmluZyAhPSAnc3RyaW5nJykge1xuICAgICAgaWYgKGlzSW5kZXgocGF0aFN0cmluZy5sZW5ndGgpKSB7XG4gICAgICAgIC8vIENvbnN0cnVjdGVkIHdpdGggYXJyYXktbGlrZSAocHJlLXBhcnNlZCkga2V5c1xuICAgICAgICByZXR1cm4gbmV3IFBhdGgocGF0aFN0cmluZywgY29uc3RydWN0b3JJc1ByaXZhdGUpO1xuICAgICAgfVxuXG4gICAgICBwYXRoU3RyaW5nID0gU3RyaW5nKHBhdGhTdHJpbmcpO1xuICAgIH1cblxuICAgIHZhciBwYXRoID0gcGF0aENhY2hlW3BhdGhTdHJpbmddO1xuICAgIGlmIChwYXRoKVxuICAgICAgcmV0dXJuIHBhdGg7XG5cbiAgICB2YXIgcGFydHMgPSBwYXJzZVBhdGgocGF0aFN0cmluZyk7XG4gICAgaWYgKCFwYXJ0cylcbiAgICAgIHJldHVybiBpbnZhbGlkUGF0aDtcblxuICAgIHZhciBwYXRoID0gbmV3IFBhdGgocGFydHMsIGNvbnN0cnVjdG9ySXNQcml2YXRlKTtcbiAgICBwYXRoQ2FjaGVbcGF0aFN0cmluZ10gPSBwYXRoO1xuICAgIHJldHVybiBwYXRoO1xuICB9XG5cbiAgUGF0aC5nZXQgPSBnZXRQYXRoO1xuXG4gIGZ1bmN0aW9uIGZvcm1hdEFjY2Vzc29yKGtleSkge1xuICAgIGlmIChpc0luZGV4KGtleSkpIHtcbiAgICAgIHJldHVybiAnWycgKyBrZXkgKyAnXSc7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiAnW1wiJyArIGtleS5yZXBsYWNlKC9cIi9nLCAnXFxcXFwiJykgKyAnXCJdJztcbiAgICB9XG4gIH1cblxuICBQYXRoLnByb3RvdHlwZSA9IGNyZWF0ZU9iamVjdCh7XG4gICAgX19wcm90b19fOiBbXSxcbiAgICB2YWxpZDogdHJ1ZSxcblxuICAgIHRvU3RyaW5nOiBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBwYXRoU3RyaW5nID0gJyc7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIGtleSA9IHRoaXNbaV07XG4gICAgICAgIGlmIChpc0lkZW50KGtleSkpIHtcbiAgICAgICAgICBwYXRoU3RyaW5nICs9IGkgPyAnLicgKyBrZXkgOiBrZXk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGF0aFN0cmluZyArPSBmb3JtYXRBY2Nlc3NvcihrZXkpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBwYXRoU3RyaW5nO1xuICAgIH0sXG5cbiAgICBnZXRWYWx1ZUZyb206IGZ1bmN0aW9uKG9iaiwgZGlyZWN0T2JzZXJ2ZXIpIHtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBpZiAob2JqID09IG51bGwpXG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICBvYmogPSBvYmpbdGhpc1tpXV07XG4gICAgICB9XG4gICAgICByZXR1cm4gb2JqO1xuICAgIH0sXG5cbiAgICBpdGVyYXRlT2JqZWN0czogZnVuY3Rpb24ob2JqLCBvYnNlcnZlKSB7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaWYgKGkpXG4gICAgICAgICAgb2JqID0gb2JqW3RoaXNbaSAtIDFdXTtcbiAgICAgICAgaWYgKCFpc09iamVjdChvYmopKVxuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgb2JzZXJ2ZShvYmosIHRoaXNbMF0pO1xuICAgICAgfVxuICAgIH0sXG5cbiAgICBjb21waWxlZEdldFZhbHVlRnJvbUZuOiBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBzdHIgPSAnJztcbiAgICAgIHZhciBwYXRoU3RyaW5nID0gJ29iaic7XG4gICAgICBzdHIgKz0gJ2lmIChvYmogIT0gbnVsbCc7XG4gICAgICB2YXIgaSA9IDA7XG4gICAgICB2YXIga2V5O1xuICAgICAgZm9yICg7IGkgPCAodGhpcy5sZW5ndGggLSAxKTsgaSsrKSB7XG4gICAgICAgIGtleSA9IHRoaXNbaV07XG4gICAgICAgIHBhdGhTdHJpbmcgKz0gaXNJZGVudChrZXkpID8gJy4nICsga2V5IDogZm9ybWF0QWNjZXNzb3Ioa2V5KTtcbiAgICAgICAgc3RyICs9ICcgJiZcXG4gICAgICcgKyBwYXRoU3RyaW5nICsgJyAhPSBudWxsJztcbiAgICAgIH1cbiAgICAgIHN0ciArPSAnKVxcbic7XG5cbiAgICAgIHZhciBrZXkgPSB0aGlzW2ldO1xuICAgICAgcGF0aFN0cmluZyArPSBpc0lkZW50KGtleSkgPyAnLicgKyBrZXkgOiBmb3JtYXRBY2Nlc3NvcihrZXkpO1xuXG4gICAgICBzdHIgKz0gJyAgcmV0dXJuICcgKyBwYXRoU3RyaW5nICsgJztcXG5lbHNlXFxuICByZXR1cm4gdW5kZWZpbmVkOyc7XG4gICAgICByZXR1cm4gbmV3IEZ1bmN0aW9uKCdvYmonLCBzdHIpO1xuICAgIH0sXG5cbiAgICBzZXRWYWx1ZUZyb206IGZ1bmN0aW9uKG9iaiwgdmFsdWUpIHtcbiAgICAgIGlmICghdGhpcy5sZW5ndGgpXG4gICAgICAgIHJldHVybiBmYWxzZTtcblxuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLmxlbmd0aCAtIDE7IGkrKykge1xuICAgICAgICBpZiAoIWlzT2JqZWN0KG9iaikpXG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICBvYmogPSBvYmpbdGhpc1tpXV07XG4gICAgICB9XG5cbiAgICAgIGlmICghaXNPYmplY3Qob2JqKSlcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuXG4gICAgICBvYmpbdGhpc1tpXV0gPSB2YWx1ZTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgfSk7XG5cbiAgdmFyIGludmFsaWRQYXRoID0gbmV3IFBhdGgoJycsIGNvbnN0cnVjdG9ySXNQcml2YXRlKTtcbiAgaW52YWxpZFBhdGgudmFsaWQgPSBmYWxzZTtcbiAgaW52YWxpZFBhdGguZ2V0VmFsdWVGcm9tID0gaW52YWxpZFBhdGguc2V0VmFsdWVGcm9tID0gZnVuY3Rpb24oKSB7fTtcblxuICB2YXIgTUFYX0RJUlRZX0NIRUNLX0NZQ0xFUyA9IDEwMDA7XG5cbiAgZnVuY3Rpb24gZGlydHlDaGVjayhvYnNlcnZlcikge1xuICAgIHZhciBjeWNsZXMgPSAwO1xuICAgIHdoaWxlIChjeWNsZXMgPCBNQVhfRElSVFlfQ0hFQ0tfQ1lDTEVTICYmIG9ic2VydmVyLmNoZWNrXygpKSB7XG4gICAgICBjeWNsZXMrKztcbiAgICB9XG4gICAgaWYgKHRlc3RpbmdFeHBvc2VDeWNsZUNvdW50KVxuICAgICAgZ2xvYmFsLmRpcnR5Q2hlY2tDeWNsZUNvdW50ID0gY3ljbGVzO1xuXG4gICAgcmV0dXJuIGN5Y2xlcyA+IDA7XG4gIH1cblxuICBmdW5jdGlvbiBvYmplY3RJc0VtcHR5KG9iamVjdCkge1xuICAgIGZvciAodmFyIHByb3AgaW4gb2JqZWN0KVxuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgZnVuY3Rpb24gZGlmZklzRW1wdHkoZGlmZikge1xuICAgIHJldHVybiBvYmplY3RJc0VtcHR5KGRpZmYuYWRkZWQpICYmXG4gICAgICAgICAgIG9iamVjdElzRW1wdHkoZGlmZi5yZW1vdmVkKSAmJlxuICAgICAgICAgICBvYmplY3RJc0VtcHR5KGRpZmYuY2hhbmdlZCk7XG4gIH1cblxuICBmdW5jdGlvbiBkaWZmT2JqZWN0RnJvbU9sZE9iamVjdChvYmplY3QsIG9sZE9iamVjdCkge1xuICAgIHZhciBhZGRlZCA9IHt9O1xuICAgIHZhciByZW1vdmVkID0ge307XG4gICAgdmFyIGNoYW5nZWQgPSB7fTtcblxuICAgIGZvciAodmFyIHByb3AgaW4gb2xkT2JqZWN0KSB7XG4gICAgICB2YXIgbmV3VmFsdWUgPSBvYmplY3RbcHJvcF07XG5cbiAgICAgIGlmIChuZXdWYWx1ZSAhPT0gdW5kZWZpbmVkICYmIG5ld1ZhbHVlID09PSBvbGRPYmplY3RbcHJvcF0pXG4gICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICBpZiAoIShwcm9wIGluIG9iamVjdCkpIHtcbiAgICAgICAgcmVtb3ZlZFtwcm9wXSA9IHVuZGVmaW5lZDtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGlmIChuZXdWYWx1ZSAhPT0gb2xkT2JqZWN0W3Byb3BdKVxuICAgICAgICBjaGFuZ2VkW3Byb3BdID0gbmV3VmFsdWU7XG4gICAgfVxuXG4gICAgZm9yICh2YXIgcHJvcCBpbiBvYmplY3QpIHtcbiAgICAgIGlmIChwcm9wIGluIG9sZE9iamVjdClcbiAgICAgICAgY29udGludWU7XG5cbiAgICAgIGFkZGVkW3Byb3BdID0gb2JqZWN0W3Byb3BdO1xuICAgIH1cblxuICAgIGlmIChBcnJheS5pc0FycmF5KG9iamVjdCkgJiYgb2JqZWN0Lmxlbmd0aCAhPT0gb2xkT2JqZWN0Lmxlbmd0aClcbiAgICAgIGNoYW5nZWQubGVuZ3RoID0gb2JqZWN0Lmxlbmd0aDtcblxuICAgIHJldHVybiB7XG4gICAgICBhZGRlZDogYWRkZWQsXG4gICAgICByZW1vdmVkOiByZW1vdmVkLFxuICAgICAgY2hhbmdlZDogY2hhbmdlZFxuICAgIH07XG4gIH1cblxuICB2YXIgZW9tVGFza3MgPSBbXTtcbiAgZnVuY3Rpb24gcnVuRU9NVGFza3MoKSB7XG4gICAgaWYgKCFlb21UYXNrcy5sZW5ndGgpXG4gICAgICByZXR1cm4gZmFsc2U7XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGVvbVRhc2tzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBlb21UYXNrc1tpXSgpO1xuICAgIH1cbiAgICBlb21UYXNrcy5sZW5ndGggPSAwO1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgdmFyIHJ1bkVPTSA9IGhhc09ic2VydmUgPyAoZnVuY3Rpb24oKXtcbiAgICB2YXIgZW9tT2JqID0geyBwaW5nUG9uZzogdHJ1ZSB9O1xuICAgIHZhciBlb21SdW5TY2hlZHVsZWQgPSBmYWxzZTtcblxuICAgIE9iamVjdC5vYnNlcnZlKGVvbU9iaiwgZnVuY3Rpb24oKSB7XG4gICAgICBydW5FT01UYXNrcygpO1xuICAgICAgZW9tUnVuU2NoZWR1bGVkID0gZmFsc2U7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gZnVuY3Rpb24oZm4pIHtcbiAgICAgIGVvbVRhc2tzLnB1c2goZm4pO1xuICAgICAgaWYgKCFlb21SdW5TY2hlZHVsZWQpIHtcbiAgICAgICAgZW9tUnVuU2NoZWR1bGVkID0gdHJ1ZTtcbiAgICAgICAgZW9tT2JqLnBpbmdQb25nID0gIWVvbU9iai5waW5nUG9uZztcbiAgICAgIH1cbiAgICB9O1xuICB9KSgpIDpcbiAgKGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBmdW5jdGlvbihmbikge1xuICAgICAgZW9tVGFza3MucHVzaChmbik7XG4gICAgfTtcbiAgfSkoKTtcblxuICB2YXIgb2JzZXJ2ZWRPYmplY3RDYWNoZSA9IFtdO1xuXG4gIGZ1bmN0aW9uIG5ld09ic2VydmVkT2JqZWN0KCkge1xuICAgIHZhciBvYnNlcnZlcjtcbiAgICB2YXIgb2JqZWN0O1xuICAgIHZhciBkaXNjYXJkUmVjb3JkcyA9IGZhbHNlO1xuICAgIHZhciBmaXJzdCA9IHRydWU7XG5cbiAgICBmdW5jdGlvbiBjYWxsYmFjayhyZWNvcmRzKSB7XG4gICAgICBpZiAob2JzZXJ2ZXIgJiYgb2JzZXJ2ZXIuc3RhdGVfID09PSBPUEVORUQgJiYgIWRpc2NhcmRSZWNvcmRzKVxuICAgICAgICBvYnNlcnZlci5jaGVja18ocmVjb3Jkcyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIG9wZW46IGZ1bmN0aW9uKG9icykge1xuICAgICAgICBpZiAob2JzZXJ2ZXIpXG4gICAgICAgICAgdGhyb3cgRXJyb3IoJ09ic2VydmVkT2JqZWN0IGluIHVzZScpO1xuXG4gICAgICAgIGlmICghZmlyc3QpXG4gICAgICAgICAgT2JqZWN0LmRlbGl2ZXJDaGFuZ2VSZWNvcmRzKGNhbGxiYWNrKTtcblxuICAgICAgICBvYnNlcnZlciA9IG9icztcbiAgICAgICAgZmlyc3QgPSBmYWxzZTtcbiAgICAgIH0sXG4gICAgICBvYnNlcnZlOiBmdW5jdGlvbihvYmosIGFycmF5T2JzZXJ2ZSkge1xuICAgICAgICBvYmplY3QgPSBvYmo7XG4gICAgICAgIGlmIChhcnJheU9ic2VydmUpXG4gICAgICAgICAgQXJyYXkub2JzZXJ2ZShvYmplY3QsIGNhbGxiYWNrKTtcbiAgICAgICAgZWxzZVxuICAgICAgICAgIE9iamVjdC5vYnNlcnZlKG9iamVjdCwgY2FsbGJhY2spO1xuICAgICAgfSxcbiAgICAgIGRlbGl2ZXI6IGZ1bmN0aW9uKGRpc2NhcmQpIHtcbiAgICAgICAgZGlzY2FyZFJlY29yZHMgPSBkaXNjYXJkO1xuICAgICAgICBPYmplY3QuZGVsaXZlckNoYW5nZVJlY29yZHMoY2FsbGJhY2spO1xuICAgICAgICBkaXNjYXJkUmVjb3JkcyA9IGZhbHNlO1xuICAgICAgfSxcbiAgICAgIGNsb3NlOiBmdW5jdGlvbigpIHtcbiAgICAgICAgb2JzZXJ2ZXIgPSB1bmRlZmluZWQ7XG4gICAgICAgIE9iamVjdC51bm9ic2VydmUob2JqZWN0LCBjYWxsYmFjayk7XG4gICAgICAgIG9ic2VydmVkT2JqZWN0Q2FjaGUucHVzaCh0aGlzKTtcbiAgICAgIH1cbiAgICB9O1xuICB9XG5cbiAgLypcbiAgICogVGhlIG9ic2VydmVkU2V0IGFic3RyYWN0aW9uIGlzIGEgcGVyZiBvcHRpbWl6YXRpb24gd2hpY2ggcmVkdWNlcyB0aGUgdG90YWxcbiAgICogbnVtYmVyIG9mIE9iamVjdC5vYnNlcnZlIG9ic2VydmF0aW9ucyBvZiBhIHNldCBvZiBvYmplY3RzLiBUaGUgaWRlYSBpcyB0aGF0XG4gICAqIGdyb3VwcyBvZiBPYnNlcnZlcnMgd2lsbCBoYXZlIHNvbWUgb2JqZWN0IGRlcGVuZGVuY2llcyBpbiBjb21tb24gYW5kIHRoaXNcbiAgICogb2JzZXJ2ZWQgc2V0IGVuc3VyZXMgdGhhdCBlYWNoIG9iamVjdCBpbiB0aGUgdHJhbnNpdGl2ZSBjbG9zdXJlIG9mXG4gICAqIGRlcGVuZGVuY2llcyBpcyBvbmx5IG9ic2VydmVkIG9uY2UuIFRoZSBvYnNlcnZlZFNldCBhY3RzIGFzIGEgd3JpdGUgYmFycmllclxuICAgKiBzdWNoIHRoYXQgd2hlbmV2ZXIgYW55IGNoYW5nZSBjb21lcyB0aHJvdWdoLCBhbGwgT2JzZXJ2ZXJzIGFyZSBjaGVja2VkIGZvclxuICAgKiBjaGFuZ2VkIHZhbHVlcy5cbiAgICpcbiAgICogTm90ZSB0aGF0IHRoaXMgb3B0aW1pemF0aW9uIGlzIGV4cGxpY2l0bHkgbW92aW5nIHdvcmsgZnJvbSBzZXR1cC10aW1lIHRvXG4gICAqIGNoYW5nZS10aW1lLlxuICAgKlxuICAgKiBUT0RPKHJhZmFlbHcpOiBJbXBsZW1lbnQgXCJnYXJiYWdlIGNvbGxlY3Rpb25cIi4gSW4gb3JkZXIgdG8gbW92ZSB3b3JrIG9mZlxuICAgKiB0aGUgY3JpdGljYWwgcGF0aCwgd2hlbiBPYnNlcnZlcnMgYXJlIGNsb3NlZCwgdGhlaXIgb2JzZXJ2ZWQgb2JqZWN0cyBhcmVcbiAgICogbm90IE9iamVjdC51bm9ic2VydmUoZCkuIEFzIGEgcmVzdWx0LCBpdCdzaWVzdGEgcG9zc2libGUgdGhhdCBpZiB0aGUgb2JzZXJ2ZWRTZXRcbiAgICogaXMga2VwdCBvcGVuLCBidXQgc29tZSBPYnNlcnZlcnMgaGF2ZSBiZWVuIGNsb3NlZCwgaXQgY291bGQgY2F1c2UgXCJsZWFrc1wiXG4gICAqIChwcmV2ZW50IG90aGVyd2lzZSBjb2xsZWN0YWJsZSBvYmplY3RzIGZyb20gYmVpbmcgY29sbGVjdGVkKS4gQXQgc29tZVxuICAgKiBwb2ludCwgd2Ugc2hvdWxkIGltcGxlbWVudCBpbmNyZW1lbnRhbCBcImdjXCIgd2hpY2gga2VlcHMgYSBsaXN0IG9mXG4gICAqIG9ic2VydmVkU2V0cyB3aGljaCBtYXkgbmVlZCBjbGVhbi11cCBhbmQgZG9lcyBzbWFsbCBhbW91bnRzIG9mIGNsZWFudXAgb24gYVxuICAgKiB0aW1lb3V0IHVudGlsIGFsbCBpcyBjbGVhbi5cbiAgICovXG5cbiAgZnVuY3Rpb24gZ2V0T2JzZXJ2ZWRPYmplY3Qob2JzZXJ2ZXIsIG9iamVjdCwgYXJyYXlPYnNlcnZlKSB7XG4gICAgdmFyIGRpciA9IG9ic2VydmVkT2JqZWN0Q2FjaGUucG9wKCkgfHwgbmV3T2JzZXJ2ZWRPYmplY3QoKTtcbiAgICBkaXIub3BlbihvYnNlcnZlcik7XG4gICAgZGlyLm9ic2VydmUob2JqZWN0LCBhcnJheU9ic2VydmUpO1xuICAgIHJldHVybiBkaXI7XG4gIH1cblxuICB2YXIgb2JzZXJ2ZWRTZXRDYWNoZSA9IFtdO1xuXG4gIGZ1bmN0aW9uIG5ld09ic2VydmVkU2V0KCkge1xuICAgIHZhciBvYnNlcnZlckNvdW50ID0gMDtcbiAgICB2YXIgb2JzZXJ2ZXJzID0gW107XG4gICAgdmFyIG9iamVjdHMgPSBbXTtcbiAgICB2YXIgcm9vdE9iajtcbiAgICB2YXIgcm9vdE9ialByb3BzO1xuXG4gICAgZnVuY3Rpb24gb2JzZXJ2ZShvYmosIHByb3ApIHtcbiAgICAgIGlmICghb2JqKVxuICAgICAgICByZXR1cm47XG5cbiAgICAgIGlmIChvYmogPT09IHJvb3RPYmopXG4gICAgICAgIHJvb3RPYmpQcm9wc1twcm9wXSA9IHRydWU7XG5cbiAgICAgIGlmIChvYmplY3RzLmluZGV4T2Yob2JqKSA8IDApIHtcbiAgICAgICAgb2JqZWN0cy5wdXNoKG9iaik7XG4gICAgICAgIE9iamVjdC5vYnNlcnZlKG9iaiwgY2FsbGJhY2spO1xuICAgICAgfVxuXG4gICAgICBvYnNlcnZlKE9iamVjdC5nZXRQcm90b3R5cGVPZihvYmopLCBwcm9wKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBhbGxSb290T2JqTm9uT2JzZXJ2ZWRQcm9wcyhyZWNzKSB7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHJlY3MubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIHJlYyA9IHJlY3NbaV07XG4gICAgICAgIGlmIChyZWMub2JqZWN0ICE9PSByb290T2JqIHx8XG4gICAgICAgICAgICByb290T2JqUHJvcHNbcmVjLm5hbWVdIHx8XG4gICAgICAgICAgICByZWMudHlwZSA9PT0gJ3NldFByb3RvdHlwZScpIHtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGNhbGxiYWNrKHJlY3MpIHtcbiAgICAgIGlmIChhbGxSb290T2JqTm9uT2JzZXJ2ZWRQcm9wcyhyZWNzKSlcbiAgICAgICAgcmV0dXJuO1xuXG4gICAgICB2YXIgb2JzZXJ2ZXI7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IG9ic2VydmVycy5sZW5ndGg7IGkrKykge1xuICAgICAgICBvYnNlcnZlciA9IG9ic2VydmVyc1tpXTtcbiAgICAgICAgaWYgKG9ic2VydmVyLnN0YXRlXyA9PSBPUEVORUQpIHtcbiAgICAgICAgICBvYnNlcnZlci5pdGVyYXRlT2JqZWN0c18ob2JzZXJ2ZSk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBvYnNlcnZlcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgb2JzZXJ2ZXIgPSBvYnNlcnZlcnNbaV07XG4gICAgICAgIGlmIChvYnNlcnZlci5zdGF0ZV8gPT0gT1BFTkVEKSB7XG4gICAgICAgICAgb2JzZXJ2ZXIuY2hlY2tfKCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICB2YXIgcmVjb3JkID0ge1xuICAgICAgb2JqZWN0OiB1bmRlZmluZWQsXG4gICAgICBvYmplY3RzOiBvYmplY3RzLFxuICAgICAgb3BlbjogZnVuY3Rpb24ob2JzLCBvYmplY3QpIHtcbiAgICAgICAgaWYgKCFyb290T2JqKSB7XG4gICAgICAgICAgcm9vdE9iaiA9IG9iamVjdDtcbiAgICAgICAgICByb290T2JqUHJvcHMgPSB7fTtcbiAgICAgICAgfVxuXG4gICAgICAgIG9ic2VydmVycy5wdXNoKG9icyk7XG4gICAgICAgIG9ic2VydmVyQ291bnQrKztcbiAgICAgICAgb2JzLml0ZXJhdGVPYmplY3RzXyhvYnNlcnZlKTtcbiAgICAgIH0sXG4gICAgICBjbG9zZTogZnVuY3Rpb24ob2JzKSB7XG4gICAgICAgIG9ic2VydmVyQ291bnQtLTtcbiAgICAgICAgaWYgKG9ic2VydmVyQ291bnQgPiAwKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBvYmplY3RzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgT2JqZWN0LnVub2JzZXJ2ZShvYmplY3RzW2ldLCBjYWxsYmFjayk7XG4gICAgICAgICAgT2JzZXJ2ZXIudW5vYnNlcnZlZENvdW50Kys7XG4gICAgICAgIH1cblxuICAgICAgICBvYnNlcnZlcnMubGVuZ3RoID0gMDtcbiAgICAgICAgb2JqZWN0cy5sZW5ndGggPSAwO1xuICAgICAgICByb290T2JqID0gdW5kZWZpbmVkO1xuICAgICAgICByb290T2JqUHJvcHMgPSB1bmRlZmluZWQ7XG4gICAgICAgIG9ic2VydmVkU2V0Q2FjaGUucHVzaCh0aGlzKTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgcmV0dXJuIHJlY29yZDtcbiAgfVxuXG4gIHZhciBsYXN0T2JzZXJ2ZWRTZXQ7XG5cbiAgZnVuY3Rpb24gZ2V0T2JzZXJ2ZWRTZXQob2JzZXJ2ZXIsIG9iaikge1xuICAgIGlmICghbGFzdE9ic2VydmVkU2V0IHx8IGxhc3RPYnNlcnZlZFNldC5vYmplY3QgIT09IG9iaikge1xuICAgICAgbGFzdE9ic2VydmVkU2V0ID0gb2JzZXJ2ZWRTZXRDYWNoZS5wb3AoKSB8fCBuZXdPYnNlcnZlZFNldCgpO1xuICAgICAgbGFzdE9ic2VydmVkU2V0Lm9iamVjdCA9IG9iajtcbiAgICB9XG4gICAgbGFzdE9ic2VydmVkU2V0Lm9wZW4ob2JzZXJ2ZXIsIG9iaik7XG4gICAgcmV0dXJuIGxhc3RPYnNlcnZlZFNldDtcbiAgfVxuXG4gIHZhciBVTk9QRU5FRCA9IDA7XG4gIHZhciBPUEVORUQgPSAxO1xuICB2YXIgQ0xPU0VEID0gMjtcbiAgdmFyIFJFU0VUVElORyA9IDM7XG5cbiAgdmFyIG5leHRPYnNlcnZlcklkID0gMTtcblxuICBmdW5jdGlvbiBPYnNlcnZlcigpIHtcbiAgICB0aGlzLnN0YXRlXyA9IFVOT1BFTkVEO1xuICAgIHRoaXMuY2FsbGJhY2tfID0gdW5kZWZpbmVkO1xuICAgIHRoaXMudGFyZ2V0XyA9IHVuZGVmaW5lZDsgLy8gVE9ETyhyYWZhZWx3KTogU2hvdWxkIGJlIFdlYWtSZWZcbiAgICB0aGlzLmRpcmVjdE9ic2VydmVyXyA9IHVuZGVmaW5lZDtcbiAgICB0aGlzLnZhbHVlXyA9IHVuZGVmaW5lZDtcbiAgICB0aGlzLmlkXyA9IG5leHRPYnNlcnZlcklkKys7XG4gIH1cblxuICBPYnNlcnZlci5wcm90b3R5cGUgPSB7XG4gICAgb3BlbjogZnVuY3Rpb24oY2FsbGJhY2ssIHRhcmdldCkge1xuICAgICAgaWYgKHRoaXMuc3RhdGVfICE9IFVOT1BFTkVEKVxuICAgICAgICB0aHJvdyBFcnJvcignT2JzZXJ2ZXIgaGFzIGFscmVhZHkgYmVlbiBvcGVuZWQuJyk7XG5cbiAgICAgIGFkZFRvQWxsKHRoaXMpO1xuICAgICAgdGhpcy5jYWxsYmFja18gPSBjYWxsYmFjaztcbiAgICAgIHRoaXMudGFyZ2V0XyA9IHRhcmdldDtcbiAgICAgIHRoaXMuY29ubmVjdF8oKTtcbiAgICAgIHRoaXMuc3RhdGVfID0gT1BFTkVEO1xuICAgICAgcmV0dXJuIHRoaXMudmFsdWVfO1xuICAgIH0sXG5cbiAgICBjbG9zZTogZnVuY3Rpb24oKSB7XG4gICAgICBpZiAodGhpcy5zdGF0ZV8gIT0gT1BFTkVEKVxuICAgICAgICByZXR1cm47XG5cbiAgICAgIHJlbW92ZUZyb21BbGwodGhpcyk7XG4gICAgICB0aGlzLmRpc2Nvbm5lY3RfKCk7XG4gICAgICB0aGlzLnZhbHVlXyA9IHVuZGVmaW5lZDtcbiAgICAgIHRoaXMuY2FsbGJhY2tfID0gdW5kZWZpbmVkO1xuICAgICAgdGhpcy50YXJnZXRfID0gdW5kZWZpbmVkO1xuICAgICAgdGhpcy5zdGF0ZV8gPSBDTE9TRUQ7XG4gICAgfSxcblxuICAgIGRlbGl2ZXI6IGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKHRoaXMuc3RhdGVfICE9IE9QRU5FRClcbiAgICAgICAgcmV0dXJuO1xuXG4gICAgICBkaXJ0eUNoZWNrKHRoaXMpO1xuICAgIH0sXG5cbiAgICByZXBvcnRfOiBmdW5jdGlvbihjaGFuZ2VzKSB7XG4gICAgICB0cnkge1xuICAgICAgICB0aGlzLmNhbGxiYWNrXy5hcHBseSh0aGlzLnRhcmdldF8sIGNoYW5nZXMpO1xuICAgICAgfSBjYXRjaCAoZXgpIHtcbiAgICAgICAgT2JzZXJ2ZXIuX2Vycm9yVGhyb3duRHVyaW5nQ2FsbGJhY2sgPSB0cnVlO1xuICAgICAgICBjb25zb2xlLmVycm9yKCdFeGNlcHRpb24gY2F1Z2h0IGR1cmluZyBvYnNlcnZlciBjYWxsYmFjazogJyArXG4gICAgICAgICAgICAgICAgICAgICAgIChleC5zdGFjayB8fCBleCkpO1xuICAgICAgfVxuICAgIH0sXG5cbiAgICBkaXNjYXJkQ2hhbmdlczogZnVuY3Rpb24oKSB7XG4gICAgICB0aGlzLmNoZWNrXyh1bmRlZmluZWQsIHRydWUpO1xuICAgICAgcmV0dXJuIHRoaXMudmFsdWVfO1xuICAgIH1cbiAgfVxuXG4gIHZhciBjb2xsZWN0T2JzZXJ2ZXJzID0gIWhhc09ic2VydmU7XG4gIHZhciBhbGxPYnNlcnZlcnM7XG4gIE9ic2VydmVyLl9hbGxPYnNlcnZlcnNDb3VudCA9IDA7XG5cbiAgaWYgKGNvbGxlY3RPYnNlcnZlcnMpIHtcbiAgICBhbGxPYnNlcnZlcnMgPSBbXTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGFkZFRvQWxsKG9ic2VydmVyKSB7XG4gICAgT2JzZXJ2ZXIuX2FsbE9ic2VydmVyc0NvdW50Kys7XG4gICAgaWYgKCFjb2xsZWN0T2JzZXJ2ZXJzKVxuICAgICAgcmV0dXJuO1xuXG4gICAgYWxsT2JzZXJ2ZXJzLnB1c2gob2JzZXJ2ZXIpO1xuICB9XG5cbiAgZnVuY3Rpb24gcmVtb3ZlRnJvbUFsbChvYnNlcnZlcikge1xuICAgIE9ic2VydmVyLl9hbGxPYnNlcnZlcnNDb3VudC0tO1xuICB9XG5cbiAgdmFyIHJ1bm5pbmdNaWNyb3Rhc2tDaGVja3BvaW50ID0gZmFsc2U7XG5cbiAgdmFyIGhhc0RlYnVnRm9yY2VGdWxsRGVsaXZlcnkgPSBoYXNPYnNlcnZlICYmIGhhc0V2YWwgJiYgKGZ1bmN0aW9uKCkge1xuICAgIHRyeSB7XG4gICAgICBldmFsKCclUnVuTWljcm90YXNrcygpJyk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9IGNhdGNoIChleCkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfSkoKTtcblxuICBnbG9iYWwuUGxhdGZvcm0gPSBnbG9iYWwuUGxhdGZvcm0gfHwge307XG5cbiAgZ2xvYmFsLlBsYXRmb3JtLnBlcmZvcm1NaWNyb3Rhc2tDaGVja3BvaW50ID0gZnVuY3Rpb24oKSB7XG4gICAgaWYgKHJ1bm5pbmdNaWNyb3Rhc2tDaGVja3BvaW50KVxuICAgICAgcmV0dXJuO1xuXG4gICAgaWYgKGhhc0RlYnVnRm9yY2VGdWxsRGVsaXZlcnkpIHtcbiAgICAgIGV2YWwoJyVSdW5NaWNyb3Rhc2tzKCknKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoIWNvbGxlY3RPYnNlcnZlcnMpXG4gICAgICByZXR1cm47XG5cbiAgICBydW5uaW5nTWljcm90YXNrQ2hlY2twb2ludCA9IHRydWU7XG5cbiAgICB2YXIgY3ljbGVzID0gMDtcbiAgICB2YXIgYW55Q2hhbmdlZCwgdG9DaGVjaztcblxuICAgIGRvIHtcbiAgICAgIGN5Y2xlcysrO1xuICAgICAgdG9DaGVjayA9IGFsbE9ic2VydmVycztcbiAgICAgIGFsbE9ic2VydmVycyA9IFtdO1xuICAgICAgYW55Q2hhbmdlZCA9IGZhbHNlO1xuXG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRvQ2hlY2subGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIG9ic2VydmVyID0gdG9DaGVja1tpXTtcbiAgICAgICAgaWYgKG9ic2VydmVyLnN0YXRlXyAhPSBPUEVORUQpXG4gICAgICAgICAgY29udGludWU7XG5cbiAgICAgICAgaWYgKG9ic2VydmVyLmNoZWNrXygpKVxuICAgICAgICAgIGFueUNoYW5nZWQgPSB0cnVlO1xuXG4gICAgICAgIGFsbE9ic2VydmVycy5wdXNoKG9ic2VydmVyKTtcbiAgICAgIH1cbiAgICAgIGlmIChydW5FT01UYXNrcygpKVxuICAgICAgICBhbnlDaGFuZ2VkID0gdHJ1ZTtcbiAgICB9IHdoaWxlIChjeWNsZXMgPCBNQVhfRElSVFlfQ0hFQ0tfQ1lDTEVTICYmIGFueUNoYW5nZWQpO1xuXG4gICAgaWYgKHRlc3RpbmdFeHBvc2VDeWNsZUNvdW50KVxuICAgICAgZ2xvYmFsLmRpcnR5Q2hlY2tDeWNsZUNvdW50ID0gY3ljbGVzO1xuXG4gICAgcnVubmluZ01pY3JvdGFza0NoZWNrcG9pbnQgPSBmYWxzZTtcbiAgfTtcblxuICBpZiAoY29sbGVjdE9ic2VydmVycykge1xuICAgIGdsb2JhbC5QbGF0Zm9ybS5jbGVhck9ic2VydmVycyA9IGZ1bmN0aW9uKCkge1xuICAgICAgYWxsT2JzZXJ2ZXJzID0gW107XG4gICAgfTtcbiAgfVxuXG4gIGZ1bmN0aW9uIE9iamVjdE9ic2VydmVyKG9iamVjdCkge1xuICAgIE9ic2VydmVyLmNhbGwodGhpcyk7XG4gICAgdGhpcy52YWx1ZV8gPSBvYmplY3Q7XG4gICAgdGhpcy5vbGRPYmplY3RfID0gdW5kZWZpbmVkO1xuICB9XG5cbiAgT2JqZWN0T2JzZXJ2ZXIucHJvdG90eXBlID0gY3JlYXRlT2JqZWN0KHtcbiAgICBfX3Byb3RvX186IE9ic2VydmVyLnByb3RvdHlwZSxcblxuICAgIGFycmF5T2JzZXJ2ZTogZmFsc2UsXG5cbiAgICBjb25uZWN0XzogZnVuY3Rpb24oY2FsbGJhY2ssIHRhcmdldCkge1xuICAgICAgaWYgKGhhc09ic2VydmUpIHtcbiAgICAgICAgdGhpcy5kaXJlY3RPYnNlcnZlcl8gPSBnZXRPYnNlcnZlZE9iamVjdCh0aGlzLCB0aGlzLnZhbHVlXyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmFycmF5T2JzZXJ2ZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLm9sZE9iamVjdF8gPSB0aGlzLmNvcHlPYmplY3QodGhpcy52YWx1ZV8pO1xuICAgICAgfVxuXG4gICAgfSxcblxuICAgIGNvcHlPYmplY3Q6IGZ1bmN0aW9uKG9iamVjdCkge1xuICAgICAgdmFyIGNvcHkgPSBBcnJheS5pc0FycmF5KG9iamVjdCkgPyBbXSA6IHt9O1xuICAgICAgZm9yICh2YXIgcHJvcCBpbiBvYmplY3QpIHtcbiAgICAgICAgY29weVtwcm9wXSA9IG9iamVjdFtwcm9wXTtcbiAgICAgIH07XG4gICAgICBpZiAoQXJyYXkuaXNBcnJheShvYmplY3QpKVxuICAgICAgICBjb3B5Lmxlbmd0aCA9IG9iamVjdC5sZW5ndGg7XG4gICAgICByZXR1cm4gY29weTtcbiAgICB9LFxuXG4gICAgY2hlY2tfOiBmdW5jdGlvbihjaGFuZ2VSZWNvcmRzLCBza2lwQ2hhbmdlcykge1xuICAgICAgdmFyIGRpZmY7XG4gICAgICB2YXIgb2xkVmFsdWVzO1xuICAgICAgaWYgKGhhc09ic2VydmUpIHtcbiAgICAgICAgaWYgKCFjaGFuZ2VSZWNvcmRzKVxuICAgICAgICAgIHJldHVybiBmYWxzZTtcblxuICAgICAgICBvbGRWYWx1ZXMgPSB7fTtcbiAgICAgICAgZGlmZiA9IGRpZmZPYmplY3RGcm9tQ2hhbmdlUmVjb3Jkcyh0aGlzLnZhbHVlXywgY2hhbmdlUmVjb3JkcyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbGRWYWx1ZXMpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgb2xkVmFsdWVzID0gdGhpcy5vbGRPYmplY3RfO1xuICAgICAgICBkaWZmID0gZGlmZk9iamVjdEZyb21PbGRPYmplY3QodGhpcy52YWx1ZV8sIHRoaXMub2xkT2JqZWN0Xyk7XG4gICAgICB9XG5cbiAgICAgIGlmIChkaWZmSXNFbXB0eShkaWZmKSlcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuXG4gICAgICBpZiAoIWhhc09ic2VydmUpXG4gICAgICAgIHRoaXMub2xkT2JqZWN0XyA9IHRoaXMuY29weU9iamVjdCh0aGlzLnZhbHVlXyk7XG5cbiAgICAgIHRoaXMucmVwb3J0XyhbXG4gICAgICAgIGRpZmYuYWRkZWQgfHwge30sXG4gICAgICAgIGRpZmYucmVtb3ZlZCB8fCB7fSxcbiAgICAgICAgZGlmZi5jaGFuZ2VkIHx8IHt9LFxuICAgICAgICBmdW5jdGlvbihwcm9wZXJ0eSkge1xuICAgICAgICAgIHJldHVybiBvbGRWYWx1ZXNbcHJvcGVydHldO1xuICAgICAgICB9XG4gICAgICBdKTtcblxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSxcblxuICAgIGRpc2Nvbm5lY3RfOiBmdW5jdGlvbigpIHtcbiAgICAgIGlmIChoYXNPYnNlcnZlKSB7XG4gICAgICAgIHRoaXMuZGlyZWN0T2JzZXJ2ZXJfLmNsb3NlKCk7XG4gICAgICAgIHRoaXMuZGlyZWN0T2JzZXJ2ZXJfID0gdW5kZWZpbmVkO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5vbGRPYmplY3RfID0gdW5kZWZpbmVkO1xuICAgICAgfVxuICAgIH0sXG5cbiAgICBkZWxpdmVyOiBmdW5jdGlvbigpIHtcbiAgICAgIGlmICh0aGlzLnN0YXRlXyAhPSBPUEVORUQpXG4gICAgICAgIHJldHVybjtcblxuICAgICAgaWYgKGhhc09ic2VydmUpXG4gICAgICAgIHRoaXMuZGlyZWN0T2JzZXJ2ZXJfLmRlbGl2ZXIoZmFsc2UpO1xuICAgICAgZWxzZVxuICAgICAgICBkaXJ0eUNoZWNrKHRoaXMpO1xuICAgIH0sXG5cbiAgICBkaXNjYXJkQ2hhbmdlczogZnVuY3Rpb24oKSB7XG4gICAgICBpZiAodGhpcy5kaXJlY3RPYnNlcnZlcl8pXG4gICAgICAgIHRoaXMuZGlyZWN0T2JzZXJ2ZXJfLmRlbGl2ZXIodHJ1ZSk7XG4gICAgICBlbHNlXG4gICAgICAgIHRoaXMub2xkT2JqZWN0XyA9IHRoaXMuY29weU9iamVjdCh0aGlzLnZhbHVlXyk7XG5cbiAgICAgIHJldHVybiB0aGlzLnZhbHVlXztcbiAgICB9XG4gIH0pO1xuXG4gIGZ1bmN0aW9uIEFycmF5T2JzZXJ2ZXIoYXJyYXkpIHtcbiAgICBpZiAoIUFycmF5LmlzQXJyYXkoYXJyYXkpKVxuICAgICAgdGhyb3cgRXJyb3IoJ1Byb3ZpZGVkIG9iamVjdCBpcyBub3QgYW4gQXJyYXknKTtcbiAgICBPYmplY3RPYnNlcnZlci5jYWxsKHRoaXMsIGFycmF5KTtcbiAgfVxuXG4gIEFycmF5T2JzZXJ2ZXIucHJvdG90eXBlID0gY3JlYXRlT2JqZWN0KHtcblxuICAgIF9fcHJvdG9fXzogT2JqZWN0T2JzZXJ2ZXIucHJvdG90eXBlLFxuXG4gICAgYXJyYXlPYnNlcnZlOiB0cnVlLFxuXG4gICAgY29weU9iamVjdDogZnVuY3Rpb24oYXJyKSB7XG4gICAgICByZXR1cm4gYXJyLnNsaWNlKCk7XG4gICAgfSxcblxuICAgIGNoZWNrXzogZnVuY3Rpb24oY2hhbmdlUmVjb3Jkcykge1xuICAgICAgdmFyIHNwbGljZXM7XG4gICAgICBpZiAoaGFzT2JzZXJ2ZSkge1xuICAgICAgICBpZiAoIWNoYW5nZVJlY29yZHMpXG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICBzcGxpY2VzID0gcHJvamVjdEFycmF5U3BsaWNlcyh0aGlzLnZhbHVlXywgY2hhbmdlUmVjb3Jkcyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzcGxpY2VzID0gY2FsY1NwbGljZXModGhpcy52YWx1ZV8sIDAsIHRoaXMudmFsdWVfLmxlbmd0aCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMub2xkT2JqZWN0XywgMCwgdGhpcy5vbGRPYmplY3RfLmxlbmd0aCk7XG4gICAgICB9XG5cbiAgICAgIGlmICghc3BsaWNlcyB8fCAhc3BsaWNlcy5sZW5ndGgpXG4gICAgICAgIHJldHVybiBmYWxzZTtcblxuICAgICAgaWYgKCFoYXNPYnNlcnZlKVxuICAgICAgICB0aGlzLm9sZE9iamVjdF8gPSB0aGlzLmNvcHlPYmplY3QodGhpcy52YWx1ZV8pO1xuXG4gICAgICB0aGlzLnJlcG9ydF8oW3NwbGljZXNdKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgfSk7XG5cbiAgQXJyYXlPYnNlcnZlci5hcHBseVNwbGljZXMgPSBmdW5jdGlvbihwcmV2aW91cywgY3VycmVudCwgc3BsaWNlcykge1xuICAgIHNwbGljZXMuZm9yRWFjaChmdW5jdGlvbihzcGxpY2UpIHtcbiAgICAgIHZhciBzcGxpY2VBcmdzID0gW3NwbGljZS5pbmRleCwgc3BsaWNlLnJlbW92ZWQubGVuZ3RoXTtcbiAgICAgIHZhciBhZGRJbmRleCA9IHNwbGljZS5pbmRleDtcbiAgICAgIHdoaWxlIChhZGRJbmRleCA8IHNwbGljZS5pbmRleCArIHNwbGljZS5hZGRlZENvdW50KSB7XG4gICAgICAgIHNwbGljZUFyZ3MucHVzaChjdXJyZW50W2FkZEluZGV4XSk7XG4gICAgICAgIGFkZEluZGV4Kys7XG4gICAgICB9XG5cbiAgICAgIEFycmF5LnByb3RvdHlwZS5zcGxpY2UuYXBwbHkocHJldmlvdXMsIHNwbGljZUFyZ3MpO1xuICAgIH0pO1xuICB9O1xuXG4gIGZ1bmN0aW9uIFBhdGhPYnNlcnZlcihvYmplY3QsIHBhdGgpIHtcbiAgICBPYnNlcnZlci5jYWxsKHRoaXMpO1xuXG4gICAgdGhpcy5vYmplY3RfID0gb2JqZWN0O1xuICAgIHRoaXMucGF0aF8gPSBnZXRQYXRoKHBhdGgpO1xuICAgIHRoaXMuZGlyZWN0T2JzZXJ2ZXJfID0gdW5kZWZpbmVkO1xuICB9XG5cbiAgUGF0aE9ic2VydmVyLnByb3RvdHlwZSA9IGNyZWF0ZU9iamVjdCh7XG4gICAgX19wcm90b19fOiBPYnNlcnZlci5wcm90b3R5cGUsXG5cbiAgICBnZXQgcGF0aCgpIHtcbiAgICAgIHJldHVybiB0aGlzLnBhdGhfO1xuICAgIH0sXG5cbiAgICBjb25uZWN0XzogZnVuY3Rpb24oKSB7XG4gICAgICBpZiAoaGFzT2JzZXJ2ZSlcbiAgICAgICAgdGhpcy5kaXJlY3RPYnNlcnZlcl8gPSBnZXRPYnNlcnZlZFNldCh0aGlzLCB0aGlzLm9iamVjdF8pO1xuXG4gICAgICB0aGlzLmNoZWNrXyh1bmRlZmluZWQsIHRydWUpO1xuICAgIH0sXG5cbiAgICBkaXNjb25uZWN0XzogZnVuY3Rpb24oKSB7XG4gICAgICB0aGlzLnZhbHVlXyA9IHVuZGVmaW5lZDtcblxuICAgICAgaWYgKHRoaXMuZGlyZWN0T2JzZXJ2ZXJfKSB7XG4gICAgICAgIHRoaXMuZGlyZWN0T2JzZXJ2ZXJfLmNsb3NlKHRoaXMpO1xuICAgICAgICB0aGlzLmRpcmVjdE9ic2VydmVyXyA9IHVuZGVmaW5lZDtcbiAgICAgIH1cbiAgICB9LFxuXG4gICAgaXRlcmF0ZU9iamVjdHNfOiBmdW5jdGlvbihvYnNlcnZlKSB7XG4gICAgICB0aGlzLnBhdGhfLml0ZXJhdGVPYmplY3RzKHRoaXMub2JqZWN0Xywgb2JzZXJ2ZSk7XG4gICAgfSxcblxuICAgIGNoZWNrXzogZnVuY3Rpb24oY2hhbmdlUmVjb3Jkcywgc2tpcENoYW5nZXMpIHtcbiAgICAgIHZhciBvbGRWYWx1ZSA9IHRoaXMudmFsdWVfO1xuICAgICAgdGhpcy52YWx1ZV8gPSB0aGlzLnBhdGhfLmdldFZhbHVlRnJvbSh0aGlzLm9iamVjdF8pO1xuICAgICAgaWYgKHNraXBDaGFuZ2VzIHx8IGFyZVNhbWVWYWx1ZSh0aGlzLnZhbHVlXywgb2xkVmFsdWUpKVxuICAgICAgICByZXR1cm4gZmFsc2U7XG5cbiAgICAgIHRoaXMucmVwb3J0XyhbdGhpcy52YWx1ZV8sIG9sZFZhbHVlLCB0aGlzXSk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9LFxuXG4gICAgc2V0VmFsdWU6IGZ1bmN0aW9uKG5ld1ZhbHVlKSB7XG4gICAgICBpZiAodGhpcy5wYXRoXylcbiAgICAgICAgdGhpcy5wYXRoXy5zZXRWYWx1ZUZyb20odGhpcy5vYmplY3RfLCBuZXdWYWx1ZSk7XG4gICAgfVxuICB9KTtcblxuICBmdW5jdGlvbiBDb21wb3VuZE9ic2VydmVyKHJlcG9ydENoYW5nZXNPbk9wZW4pIHtcbiAgICBPYnNlcnZlci5jYWxsKHRoaXMpO1xuXG4gICAgdGhpcy5yZXBvcnRDaGFuZ2VzT25PcGVuXyA9IHJlcG9ydENoYW5nZXNPbk9wZW47XG4gICAgdGhpcy52YWx1ZV8gPSBbXTtcbiAgICB0aGlzLmRpcmVjdE9ic2VydmVyXyA9IHVuZGVmaW5lZDtcbiAgICB0aGlzLm9ic2VydmVkXyA9IFtdO1xuICB9XG5cbiAgdmFyIG9ic2VydmVyU2VudGluZWwgPSB7fTtcblxuICBDb21wb3VuZE9ic2VydmVyLnByb3RvdHlwZSA9IGNyZWF0ZU9iamVjdCh7XG4gICAgX19wcm90b19fOiBPYnNlcnZlci5wcm90b3R5cGUsXG5cbiAgICBjb25uZWN0XzogZnVuY3Rpb24oKSB7XG4gICAgICBpZiAoaGFzT2JzZXJ2ZSkge1xuICAgICAgICB2YXIgb2JqZWN0O1xuICAgICAgICB2YXIgbmVlZHNEaXJlY3RPYnNlcnZlciA9IGZhbHNlO1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMub2JzZXJ2ZWRfLmxlbmd0aDsgaSArPSAyKSB7XG4gICAgICAgICAgb2JqZWN0ID0gdGhpcy5vYnNlcnZlZF9baV1cbiAgICAgICAgICBpZiAob2JqZWN0ICE9PSBvYnNlcnZlclNlbnRpbmVsKSB7XG4gICAgICAgICAgICBuZWVkc0RpcmVjdE9ic2VydmVyID0gdHJ1ZTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChuZWVkc0RpcmVjdE9ic2VydmVyKVxuICAgICAgICAgIHRoaXMuZGlyZWN0T2JzZXJ2ZXJfID0gZ2V0T2JzZXJ2ZWRTZXQodGhpcywgb2JqZWN0KTtcbiAgICAgIH1cblxuICAgICAgdGhpcy5jaGVja18odW5kZWZpbmVkLCAhdGhpcy5yZXBvcnRDaGFuZ2VzT25PcGVuXyk7XG4gICAgfSxcblxuICAgIGRpc2Nvbm5lY3RfOiBmdW5jdGlvbigpIHtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5vYnNlcnZlZF8ubGVuZ3RoOyBpICs9IDIpIHtcbiAgICAgICAgaWYgKHRoaXMub2JzZXJ2ZWRfW2ldID09PSBvYnNlcnZlclNlbnRpbmVsKVxuICAgICAgICAgIHRoaXMub2JzZXJ2ZWRfW2kgKyAxXS5jbG9zZSgpO1xuICAgICAgfVxuICAgICAgdGhpcy5vYnNlcnZlZF8ubGVuZ3RoID0gMDtcbiAgICAgIHRoaXMudmFsdWVfLmxlbmd0aCA9IDA7XG5cbiAgICAgIGlmICh0aGlzLmRpcmVjdE9ic2VydmVyXykge1xuICAgICAgICB0aGlzLmRpcmVjdE9ic2VydmVyXy5jbG9zZSh0aGlzKTtcbiAgICAgICAgdGhpcy5kaXJlY3RPYnNlcnZlcl8gPSB1bmRlZmluZWQ7XG4gICAgICB9XG4gICAgfSxcblxuICAgIGFkZFBhdGg6IGZ1bmN0aW9uKG9iamVjdCwgcGF0aCkge1xuICAgICAgaWYgKHRoaXMuc3RhdGVfICE9IFVOT1BFTkVEICYmIHRoaXMuc3RhdGVfICE9IFJFU0VUVElORylcbiAgICAgICAgdGhyb3cgRXJyb3IoJ0Nhbm5vdCBhZGQgcGF0aHMgb25jZSBzdGFydGVkLicpO1xuXG4gICAgICB2YXIgcGF0aCA9IGdldFBhdGgocGF0aCk7XG4gICAgICB0aGlzLm9ic2VydmVkXy5wdXNoKG9iamVjdCwgcGF0aCk7XG4gICAgICBpZiAoIXRoaXMucmVwb3J0Q2hhbmdlc09uT3Blbl8pXG4gICAgICAgIHJldHVybjtcbiAgICAgIHZhciBpbmRleCA9IHRoaXMub2JzZXJ2ZWRfLmxlbmd0aCAvIDIgLSAxO1xuICAgICAgdGhpcy52YWx1ZV9baW5kZXhdID0gcGF0aC5nZXRWYWx1ZUZyb20ob2JqZWN0KTtcbiAgICB9LFxuXG4gICAgYWRkT2JzZXJ2ZXI6IGZ1bmN0aW9uKG9ic2VydmVyKSB7XG4gICAgICBpZiAodGhpcy5zdGF0ZV8gIT0gVU5PUEVORUQgJiYgdGhpcy5zdGF0ZV8gIT0gUkVTRVRUSU5HKVxuICAgICAgICB0aHJvdyBFcnJvcignQ2Fubm90IGFkZCBvYnNlcnZlcnMgb25jZSBzdGFydGVkLicpO1xuXG4gICAgICB0aGlzLm9ic2VydmVkXy5wdXNoKG9ic2VydmVyU2VudGluZWwsIG9ic2VydmVyKTtcbiAgICAgIGlmICghdGhpcy5yZXBvcnRDaGFuZ2VzT25PcGVuXylcbiAgICAgICAgcmV0dXJuO1xuICAgICAgdmFyIGluZGV4ID0gdGhpcy5vYnNlcnZlZF8ubGVuZ3RoIC8gMiAtIDE7XG4gICAgICB0aGlzLnZhbHVlX1tpbmRleF0gPSBvYnNlcnZlci5vcGVuKHRoaXMuZGVsaXZlciwgdGhpcyk7XG4gICAgfSxcblxuICAgIHN0YXJ0UmVzZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKHRoaXMuc3RhdGVfICE9IE9QRU5FRClcbiAgICAgICAgdGhyb3cgRXJyb3IoJ0NhbiBvbmx5IHJlc2V0IHdoaWxlIG9wZW4nKTtcblxuICAgICAgdGhpcy5zdGF0ZV8gPSBSRVNFVFRJTkc7XG4gICAgICB0aGlzLmRpc2Nvbm5lY3RfKCk7XG4gICAgfSxcblxuICAgIGZpbmlzaFJlc2V0OiBmdW5jdGlvbigpIHtcbiAgICAgIGlmICh0aGlzLnN0YXRlXyAhPSBSRVNFVFRJTkcpXG4gICAgICAgIHRocm93IEVycm9yKCdDYW4gb25seSBmaW5pc2hSZXNldCBhZnRlciBzdGFydFJlc2V0Jyk7XG4gICAgICB0aGlzLnN0YXRlXyA9IE9QRU5FRDtcbiAgICAgIHRoaXMuY29ubmVjdF8oKTtcblxuICAgICAgcmV0dXJuIHRoaXMudmFsdWVfO1xuICAgIH0sXG5cbiAgICBpdGVyYXRlT2JqZWN0c186IGZ1bmN0aW9uKG9ic2VydmUpIHtcbiAgICAgIHZhciBvYmplY3Q7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMub2JzZXJ2ZWRfLmxlbmd0aDsgaSArPSAyKSB7XG4gICAgICAgIG9iamVjdCA9IHRoaXMub2JzZXJ2ZWRfW2ldXG4gICAgICAgIGlmIChvYmplY3QgIT09IG9ic2VydmVyU2VudGluZWwpXG4gICAgICAgICAgdGhpcy5vYnNlcnZlZF9baSArIDFdLml0ZXJhdGVPYmplY3RzKG9iamVjdCwgb2JzZXJ2ZSlcbiAgICAgIH1cbiAgICB9LFxuXG4gICAgY2hlY2tfOiBmdW5jdGlvbihjaGFuZ2VSZWNvcmRzLCBza2lwQ2hhbmdlcykge1xuICAgICAgdmFyIG9sZFZhbHVlcztcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5vYnNlcnZlZF8ubGVuZ3RoOyBpICs9IDIpIHtcbiAgICAgICAgdmFyIG9iamVjdCA9IHRoaXMub2JzZXJ2ZWRfW2ldO1xuICAgICAgICB2YXIgcGF0aCA9IHRoaXMub2JzZXJ2ZWRfW2krMV07XG4gICAgICAgIHZhciB2YWx1ZTtcbiAgICAgICAgaWYgKG9iamVjdCA9PT0gb2JzZXJ2ZXJTZW50aW5lbCkge1xuICAgICAgICAgIHZhciBvYnNlcnZhYmxlID0gcGF0aDtcbiAgICAgICAgICB2YWx1ZSA9IHRoaXMuc3RhdGVfID09PSBVTk9QRU5FRCA/XG4gICAgICAgICAgICAgIG9ic2VydmFibGUub3Blbih0aGlzLmRlbGl2ZXIsIHRoaXMpIDpcbiAgICAgICAgICAgICAgb2JzZXJ2YWJsZS5kaXNjYXJkQ2hhbmdlcygpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHZhbHVlID0gcGF0aC5nZXRWYWx1ZUZyb20ob2JqZWN0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChza2lwQ2hhbmdlcykge1xuICAgICAgICAgIHRoaXMudmFsdWVfW2kgLyAyXSA9IHZhbHVlO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGFyZVNhbWVWYWx1ZSh2YWx1ZSwgdGhpcy52YWx1ZV9baSAvIDJdKSlcbiAgICAgICAgICBjb250aW51ZTtcblxuICAgICAgICBvbGRWYWx1ZXMgPSBvbGRWYWx1ZXMgfHwgW107XG4gICAgICAgIG9sZFZhbHVlc1tpIC8gMl0gPSB0aGlzLnZhbHVlX1tpIC8gMl07XG4gICAgICAgIHRoaXMudmFsdWVfW2kgLyAyXSA9IHZhbHVlO1xuICAgICAgfVxuXG4gICAgICBpZiAoIW9sZFZhbHVlcylcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuXG4gICAgICAvLyBUT0RPKHJhZmFlbHcpOiBIYXZpbmcgb2JzZXJ2ZWRfIGFzIHRoZSB0aGlyZCBjYWxsYmFjayBhcmcgaGVyZSBpc1xuICAgICAgLy8gcHJldHR5IGxhbWUgQVBJLiBGaXguXG4gICAgICB0aGlzLnJlcG9ydF8oW3RoaXMudmFsdWVfLCBvbGRWYWx1ZXMsIHRoaXMub2JzZXJ2ZWRfXSk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gIH0pO1xuXG4gIGZ1bmN0aW9uIGlkZW50Rm4odmFsdWUpIHsgcmV0dXJuIHZhbHVlOyB9XG5cbiAgZnVuY3Rpb24gT2JzZXJ2ZXJUcmFuc2Zvcm0ob2JzZXJ2YWJsZSwgZ2V0VmFsdWVGbiwgc2V0VmFsdWVGbixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZG9udFBhc3NUaHJvdWdoU2V0KSB7XG4gICAgdGhpcy5jYWxsYmFja18gPSB1bmRlZmluZWQ7XG4gICAgdGhpcy50YXJnZXRfID0gdW5kZWZpbmVkO1xuICAgIHRoaXMudmFsdWVfID0gdW5kZWZpbmVkO1xuICAgIHRoaXMub2JzZXJ2YWJsZV8gPSBvYnNlcnZhYmxlO1xuICAgIHRoaXMuZ2V0VmFsdWVGbl8gPSBnZXRWYWx1ZUZuIHx8IGlkZW50Rm47XG4gICAgdGhpcy5zZXRWYWx1ZUZuXyA9IHNldFZhbHVlRm4gfHwgaWRlbnRGbjtcbiAgICAvLyBUT0RPKHJhZmFlbHcpOiBUaGlzIGlzIGEgdGVtcG9yYXJ5IGhhY2suIFBvbHltZXJFeHByZXNzaW9ucyBuZWVkcyB0aGlzXG4gICAgLy8gYXQgdGhlIG1vbWVudCBiZWNhdXNlIG9mIGEgYnVnIGluIGl0J3NpZXN0YSBkZXBlbmRlbmN5IHRyYWNraW5nLlxuICAgIHRoaXMuZG9udFBhc3NUaHJvdWdoU2V0XyA9IGRvbnRQYXNzVGhyb3VnaFNldDtcbiAgfVxuXG4gIE9ic2VydmVyVHJhbnNmb3JtLnByb3RvdHlwZSA9IHtcbiAgICBvcGVuOiBmdW5jdGlvbihjYWxsYmFjaywgdGFyZ2V0KSB7XG4gICAgICB0aGlzLmNhbGxiYWNrXyA9IGNhbGxiYWNrO1xuICAgICAgdGhpcy50YXJnZXRfID0gdGFyZ2V0O1xuICAgICAgdGhpcy52YWx1ZV8gPVxuICAgICAgICAgIHRoaXMuZ2V0VmFsdWVGbl8odGhpcy5vYnNlcnZhYmxlXy5vcGVuKHRoaXMub2JzZXJ2ZWRDYWxsYmFja18sIHRoaXMpKTtcbiAgICAgIHJldHVybiB0aGlzLnZhbHVlXztcbiAgICB9LFxuXG4gICAgb2JzZXJ2ZWRDYWxsYmFja186IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICB2YWx1ZSA9IHRoaXMuZ2V0VmFsdWVGbl8odmFsdWUpO1xuICAgICAgaWYgKGFyZVNhbWVWYWx1ZSh2YWx1ZSwgdGhpcy52YWx1ZV8pKVxuICAgICAgICByZXR1cm47XG4gICAgICB2YXIgb2xkVmFsdWUgPSB0aGlzLnZhbHVlXztcbiAgICAgIHRoaXMudmFsdWVfID0gdmFsdWU7XG4gICAgICB0aGlzLmNhbGxiYWNrXy5jYWxsKHRoaXMudGFyZ2V0XywgdGhpcy52YWx1ZV8sIG9sZFZhbHVlKTtcbiAgICB9LFxuXG4gICAgZGlzY2FyZENoYW5nZXM6IGZ1bmN0aW9uKCkge1xuICAgICAgdGhpcy52YWx1ZV8gPSB0aGlzLmdldFZhbHVlRm5fKHRoaXMub2JzZXJ2YWJsZV8uZGlzY2FyZENoYW5nZXMoKSk7XG4gICAgICByZXR1cm4gdGhpcy52YWx1ZV87XG4gICAgfSxcblxuICAgIGRlbGl2ZXI6IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHRoaXMub2JzZXJ2YWJsZV8uZGVsaXZlcigpO1xuICAgIH0sXG5cbiAgICBzZXRWYWx1ZTogZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgIHZhbHVlID0gdGhpcy5zZXRWYWx1ZUZuXyh2YWx1ZSk7XG4gICAgICBpZiAoIXRoaXMuZG9udFBhc3NUaHJvdWdoU2V0XyAmJiB0aGlzLm9ic2VydmFibGVfLnNldFZhbHVlKVxuICAgICAgICByZXR1cm4gdGhpcy5vYnNlcnZhYmxlXy5zZXRWYWx1ZSh2YWx1ZSk7XG4gICAgfSxcblxuICAgIGNsb3NlOiBmdW5jdGlvbigpIHtcbiAgICAgIGlmICh0aGlzLm9ic2VydmFibGVfKVxuICAgICAgICB0aGlzLm9ic2VydmFibGVfLmNsb3NlKCk7XG4gICAgICB0aGlzLmNhbGxiYWNrXyA9IHVuZGVmaW5lZDtcbiAgICAgIHRoaXMudGFyZ2V0XyA9IHVuZGVmaW5lZDtcbiAgICAgIHRoaXMub2JzZXJ2YWJsZV8gPSB1bmRlZmluZWQ7XG4gICAgICB0aGlzLnZhbHVlXyA9IHVuZGVmaW5lZDtcbiAgICAgIHRoaXMuZ2V0VmFsdWVGbl8gPSB1bmRlZmluZWQ7XG4gICAgICB0aGlzLnNldFZhbHVlRm5fID0gdW5kZWZpbmVkO1xuICAgIH1cbiAgfVxuXG4gIHZhciBleHBlY3RlZFJlY29yZFR5cGVzID0ge1xuICAgIGFkZDogdHJ1ZSxcbiAgICB1cGRhdGU6IHRydWUsXG4gICAgZGVsZXRlOiB0cnVlXG4gIH07XG5cbiAgZnVuY3Rpb24gZGlmZk9iamVjdEZyb21DaGFuZ2VSZWNvcmRzKG9iamVjdCwgY2hhbmdlUmVjb3Jkcywgb2xkVmFsdWVzKSB7XG4gICAgdmFyIGFkZGVkID0ge307XG4gICAgdmFyIHJlbW92ZWQgPSB7fTtcblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY2hhbmdlUmVjb3Jkcy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIHJlY29yZCA9IGNoYW5nZVJlY29yZHNbaV07XG4gICAgICBpZiAoIWV4cGVjdGVkUmVjb3JkVHlwZXNbcmVjb3JkLnR5cGVdKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ1Vua25vd24gY2hhbmdlUmVjb3JkIHR5cGU6ICcgKyByZWNvcmQudHlwZSk7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IocmVjb3JkKTtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGlmICghKHJlY29yZC5uYW1lIGluIG9sZFZhbHVlcykpXG4gICAgICAgIG9sZFZhbHVlc1tyZWNvcmQubmFtZV0gPSByZWNvcmQub2xkVmFsdWU7XG5cbiAgICAgIGlmIChyZWNvcmQudHlwZSA9PSAndXBkYXRlJylcbiAgICAgICAgY29udGludWU7XG5cbiAgICAgIGlmIChyZWNvcmQudHlwZSA9PSAnYWRkJykge1xuICAgICAgICBpZiAocmVjb3JkLm5hbWUgaW4gcmVtb3ZlZClcbiAgICAgICAgICBkZWxldGUgcmVtb3ZlZFtyZWNvcmQubmFtZV07XG4gICAgICAgIGVsc2VcbiAgICAgICAgICBhZGRlZFtyZWNvcmQubmFtZV0gPSB0cnVlO1xuXG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICAvLyB0eXBlID0gJ2RlbGV0ZSdcbiAgICAgIGlmIChyZWNvcmQubmFtZSBpbiBhZGRlZCkge1xuICAgICAgICBkZWxldGUgYWRkZWRbcmVjb3JkLm5hbWVdO1xuICAgICAgICBkZWxldGUgb2xkVmFsdWVzW3JlY29yZC5uYW1lXTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJlbW92ZWRbcmVjb3JkLm5hbWVdID0gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmb3IgKHZhciBwcm9wIGluIGFkZGVkKVxuICAgICAgYWRkZWRbcHJvcF0gPSBvYmplY3RbcHJvcF07XG5cbiAgICBmb3IgKHZhciBwcm9wIGluIHJlbW92ZWQpXG4gICAgICByZW1vdmVkW3Byb3BdID0gdW5kZWZpbmVkO1xuXG4gICAgdmFyIGNoYW5nZWQgPSB7fTtcbiAgICBmb3IgKHZhciBwcm9wIGluIG9sZFZhbHVlcykge1xuICAgICAgaWYgKHByb3AgaW4gYWRkZWQgfHwgcHJvcCBpbiByZW1vdmVkKVxuICAgICAgICBjb250aW51ZTtcblxuICAgICAgdmFyIG5ld1ZhbHVlID0gb2JqZWN0W3Byb3BdO1xuICAgICAgaWYgKG9sZFZhbHVlc1twcm9wXSAhPT0gbmV3VmFsdWUpXG4gICAgICAgIGNoYW5nZWRbcHJvcF0gPSBuZXdWYWx1ZTtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgYWRkZWQ6IGFkZGVkLFxuICAgICAgcmVtb3ZlZDogcmVtb3ZlZCxcbiAgICAgIGNoYW5nZWQ6IGNoYW5nZWRcbiAgICB9O1xuICB9XG5cbiAgZnVuY3Rpb24gbmV3U3BsaWNlKGluZGV4LCByZW1vdmVkLCBhZGRlZENvdW50KSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGluZGV4OiBpbmRleCxcbiAgICAgIHJlbW92ZWQ6IHJlbW92ZWQsXG4gICAgICBhZGRlZENvdW50OiBhZGRlZENvdW50XG4gICAgfTtcbiAgfVxuXG4gIHZhciBFRElUX0xFQVZFID0gMDtcbiAgdmFyIEVESVRfVVBEQVRFID0gMTtcbiAgdmFyIEVESVRfQUREID0gMjtcbiAgdmFyIEVESVRfREVMRVRFID0gMztcblxuICBmdW5jdGlvbiBBcnJheVNwbGljZSgpIHt9XG5cbiAgQXJyYXlTcGxpY2UucHJvdG90eXBlID0ge1xuXG4gICAgLy8gTm90ZTogVGhpcyBmdW5jdGlvbiBpcyAqYmFzZWQqIG9uIHRoZSBjb21wdXRhdGlvbiBvZiB0aGUgTGV2ZW5zaHRlaW5cbiAgICAvLyBcImVkaXRcIiBkaXN0YW5jZS4gVGhlIG9uZSBjaGFuZ2UgaXMgdGhhdCBcInVwZGF0ZXNcIiBhcmUgdHJlYXRlZCBhcyB0d29cbiAgICAvLyBlZGl0cyAtIG5vdCBvbmUuIFdpdGggQXJyYXkgc3BsaWNlcywgYW4gdXBkYXRlIGlzIHJlYWxseSBhIGRlbGV0ZVxuICAgIC8vIGZvbGxvd2VkIGJ5IGFuIGFkZC4gQnkgcmV0YWluaW5nIHRoaXMsIHdlIG9wdGltaXplIGZvciBcImtlZXBpbmdcIiB0aGVcbiAgICAvLyBtYXhpbXVtIGFycmF5IGl0ZW1zIGluIHRoZSBvcmlnaW5hbCBhcnJheS4gRm9yIGV4YW1wbGU6XG4gICAgLy9cbiAgICAvLyAgICd4eHh4MTIzJyAtPiAnMTIzeXl5eSdcbiAgICAvL1xuICAgIC8vIFdpdGggMS1lZGl0IHVwZGF0ZXMsIHRoZSBzaG9ydGVzdCBwYXRoIHdvdWxkIGJlIGp1c3QgdG8gdXBkYXRlIGFsbCBzZXZlblxuICAgIC8vIGNoYXJhY3RlcnMuIFdpdGggMi1lZGl0IHVwZGF0ZXMsIHdlIGRlbGV0ZSA0LCBsZWF2ZSAzLCBhbmQgYWRkIDQuIFRoaXNcbiAgICAvLyBsZWF2ZXMgdGhlIHN1YnN0cmluZyAnMTIzJyBpbnRhY3QuXG4gICAgY2FsY0VkaXREaXN0YW5jZXM6IGZ1bmN0aW9uKGN1cnJlbnQsIGN1cnJlbnRTdGFydCwgY3VycmVudEVuZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb2xkLCBvbGRTdGFydCwgb2xkRW5kKSB7XG4gICAgICAvLyBcIkRlbGV0aW9uXCIgY29sdW1uc1xuICAgICAgdmFyIHJvd0NvdW50ID0gb2xkRW5kIC0gb2xkU3RhcnQgKyAxO1xuICAgICAgdmFyIGNvbHVtbkNvdW50ID0gY3VycmVudEVuZCAtIGN1cnJlbnRTdGFydCArIDE7XG4gICAgICB2YXIgZGlzdGFuY2VzID0gbmV3IEFycmF5KHJvd0NvdW50KTtcblxuICAgICAgLy8gXCJBZGRpdGlvblwiIHJvd3MuIEluaXRpYWxpemUgbnVsbCBjb2x1bW4uXG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHJvd0NvdW50OyBpKyspIHtcbiAgICAgICAgZGlzdGFuY2VzW2ldID0gbmV3IEFycmF5KGNvbHVtbkNvdW50KTtcbiAgICAgICAgZGlzdGFuY2VzW2ldWzBdID0gaTtcbiAgICAgIH1cblxuICAgICAgLy8gSW5pdGlhbGl6ZSBudWxsIHJvd1xuICAgICAgZm9yICh2YXIgaiA9IDA7IGogPCBjb2x1bW5Db3VudDsgaisrKVxuICAgICAgICBkaXN0YW5jZXNbMF1bal0gPSBqO1xuXG4gICAgICBmb3IgKHZhciBpID0gMTsgaSA8IHJvd0NvdW50OyBpKyspIHtcbiAgICAgICAgZm9yICh2YXIgaiA9IDE7IGogPCBjb2x1bW5Db3VudDsgaisrKSB7XG4gICAgICAgICAgaWYgKHRoaXMuZXF1YWxzKGN1cnJlbnRbY3VycmVudFN0YXJ0ICsgaiAtIDFdLCBvbGRbb2xkU3RhcnQgKyBpIC0gMV0pKVxuICAgICAgICAgICAgZGlzdGFuY2VzW2ldW2pdID0gZGlzdGFuY2VzW2kgLSAxXVtqIC0gMV07XG4gICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICB2YXIgbm9ydGggPSBkaXN0YW5jZXNbaSAtIDFdW2pdICsgMTtcbiAgICAgICAgICAgIHZhciB3ZXN0ID0gZGlzdGFuY2VzW2ldW2ogLSAxXSArIDE7XG4gICAgICAgICAgICBkaXN0YW5jZXNbaV1bal0gPSBub3J0aCA8IHdlc3QgPyBub3J0aCA6IHdlc3Q7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBkaXN0YW5jZXM7XG4gICAgfSxcblxuICAgIC8vIFRoaXMgc3RhcnRzIGF0IHRoZSBmaW5hbCB3ZWlnaHQsIGFuZCB3YWxrcyBcImJhY2t3YXJkXCIgYnkgZmluZGluZ1xuICAgIC8vIHRoZSBtaW5pbXVtIHByZXZpb3VzIHdlaWdodCByZWN1cnNpdmVseSB1bnRpbCB0aGUgb3JpZ2luIG9mIHRoZSB3ZWlnaHRcbiAgICAvLyBtYXRyaXguXG4gICAgc3BsaWNlT3BlcmF0aW9uc0Zyb21FZGl0RGlzdGFuY2VzOiBmdW5jdGlvbihkaXN0YW5jZXMpIHtcbiAgICAgIHZhciBpID0gZGlzdGFuY2VzLmxlbmd0aCAtIDE7XG4gICAgICB2YXIgaiA9IGRpc3RhbmNlc1swXS5sZW5ndGggLSAxO1xuICAgICAgdmFyIGN1cnJlbnQgPSBkaXN0YW5jZXNbaV1bal07XG4gICAgICB2YXIgZWRpdHMgPSBbXTtcbiAgICAgIHdoaWxlIChpID4gMCB8fCBqID4gMCkge1xuICAgICAgICBpZiAoaSA9PSAwKSB7XG4gICAgICAgICAgZWRpdHMucHVzaChFRElUX0FERCk7XG4gICAgICAgICAgai0tO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIGlmIChqID09IDApIHtcbiAgICAgICAgICBlZGl0cy5wdXNoKEVESVRfREVMRVRFKTtcbiAgICAgICAgICBpLS07XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIG5vcnRoV2VzdCA9IGRpc3RhbmNlc1tpIC0gMV1baiAtIDFdO1xuICAgICAgICB2YXIgd2VzdCA9IGRpc3RhbmNlc1tpIC0gMV1bal07XG4gICAgICAgIHZhciBub3J0aCA9IGRpc3RhbmNlc1tpXVtqIC0gMV07XG5cbiAgICAgICAgdmFyIG1pbjtcbiAgICAgICAgaWYgKHdlc3QgPCBub3J0aClcbiAgICAgICAgICBtaW4gPSB3ZXN0IDwgbm9ydGhXZXN0ID8gd2VzdCA6IG5vcnRoV2VzdDtcbiAgICAgICAgZWxzZVxuICAgICAgICAgIG1pbiA9IG5vcnRoIDwgbm9ydGhXZXN0ID8gbm9ydGggOiBub3J0aFdlc3Q7XG5cbiAgICAgICAgaWYgKG1pbiA9PSBub3J0aFdlc3QpIHtcbiAgICAgICAgICBpZiAobm9ydGhXZXN0ID09IGN1cnJlbnQpIHtcbiAgICAgICAgICAgIGVkaXRzLnB1c2goRURJVF9MRUFWRSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGVkaXRzLnB1c2goRURJVF9VUERBVEUpO1xuICAgICAgICAgICAgY3VycmVudCA9IG5vcnRoV2VzdDtcbiAgICAgICAgICB9XG4gICAgICAgICAgaS0tO1xuICAgICAgICAgIGotLTtcbiAgICAgICAgfSBlbHNlIGlmIChtaW4gPT0gd2VzdCkge1xuICAgICAgICAgIGVkaXRzLnB1c2goRURJVF9ERUxFVEUpO1xuICAgICAgICAgIGktLTtcbiAgICAgICAgICBjdXJyZW50ID0gd2VzdDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBlZGl0cy5wdXNoKEVESVRfQUREKTtcbiAgICAgICAgICBqLS07XG4gICAgICAgICAgY3VycmVudCA9IG5vcnRoO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGVkaXRzLnJldmVyc2UoKTtcbiAgICAgIHJldHVybiBlZGl0cztcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogU3BsaWNlIFByb2plY3Rpb24gZnVuY3Rpb25zOlxuICAgICAqXG4gICAgICogQSBzcGxpY2UgbWFwIGlzIGEgcmVwcmVzZW50YXRpb24gb2YgaG93IGEgcHJldmlvdXMgYXJyYXkgb2YgaXRlbXNcbiAgICAgKiB3YXMgdHJhbnNmb3JtZWQgaW50byBhIG5ldyBhcnJheSBvZiBpdGVtcy4gQ29uY2VwdHVhbGx5IGl0IGlzIGEgbGlzdCBvZlxuICAgICAqIHR1cGxlcyBvZlxuICAgICAqXG4gICAgICogICA8aW5kZXgsIHJlbW92ZWQsIGFkZGVkQ291bnQ+XG4gICAgICpcbiAgICAgKiB3aGljaCBhcmUga2VwdCBpbiBhc2NlbmRpbmcgaW5kZXggb3JkZXIgb2YuIFRoZSB0dXBsZSByZXByZXNlbnRzIHRoYXQgYXRcbiAgICAgKiB0aGUgfGluZGV4fCwgfHJlbW92ZWR8IHNlcXVlbmNlIG9mIGl0ZW1zIHdlcmUgcmVtb3ZlZCwgYW5kIGNvdW50aW5nIGZvcndhcmRcbiAgICAgKiBmcm9tIHxpbmRleHwsIHxhZGRlZENvdW50fCBpdGVtcyB3ZXJlIGFkZGVkLlxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogTGFja2luZyBpbmRpdmlkdWFsIHNwbGljZSBtdXRhdGlvbiBpbmZvcm1hdGlvbiwgdGhlIG1pbmltYWwgc2V0IG9mXG4gICAgICogc3BsaWNlcyBjYW4gYmUgc3ludGhlc2l6ZWQgZ2l2ZW4gdGhlIHByZXZpb3VzIHN0YXRlIGFuZCBmaW5hbCBzdGF0ZSBvZiBhblxuICAgICAqIGFycmF5LiBUaGUgYmFzaWMgYXBwcm9hY2ggaXMgdG8gY2FsY3VsYXRlIHRoZSBlZGl0IGRpc3RhbmNlIG1hdHJpeCBhbmRcbiAgICAgKiBjaG9vc2UgdGhlIHNob3J0ZXN0IHBhdGggdGhyb3VnaCBpdC5cbiAgICAgKlxuICAgICAqIENvbXBsZXhpdHk6IE8obCAqIHApXG4gICAgICogICBsOiBUaGUgbGVuZ3RoIG9mIHRoZSBjdXJyZW50IGFycmF5XG4gICAgICogICBwOiBUaGUgbGVuZ3RoIG9mIHRoZSBvbGQgYXJyYXlcbiAgICAgKi9cbiAgICBjYWxjU3BsaWNlczogZnVuY3Rpb24oY3VycmVudCwgY3VycmVudFN0YXJ0LCBjdXJyZW50RW5kLFxuICAgICAgICAgICAgICAgICAgICAgICAgICBvbGQsIG9sZFN0YXJ0LCBvbGRFbmQpIHtcbiAgICAgIHZhciBwcmVmaXhDb3VudCA9IDA7XG4gICAgICB2YXIgc3VmZml4Q291bnQgPSAwO1xuXG4gICAgICB2YXIgbWluTGVuZ3RoID0gTWF0aC5taW4oY3VycmVudEVuZCAtIGN1cnJlbnRTdGFydCwgb2xkRW5kIC0gb2xkU3RhcnQpO1xuICAgICAgaWYgKGN1cnJlbnRTdGFydCA9PSAwICYmIG9sZFN0YXJ0ID09IDApXG4gICAgICAgIHByZWZpeENvdW50ID0gdGhpcy5zaGFyZWRQcmVmaXgoY3VycmVudCwgb2xkLCBtaW5MZW5ndGgpO1xuXG4gICAgICBpZiAoY3VycmVudEVuZCA9PSBjdXJyZW50Lmxlbmd0aCAmJiBvbGRFbmQgPT0gb2xkLmxlbmd0aClcbiAgICAgICAgc3VmZml4Q291bnQgPSB0aGlzLnNoYXJlZFN1ZmZpeChjdXJyZW50LCBvbGQsIG1pbkxlbmd0aCAtIHByZWZpeENvdW50KTtcblxuICAgICAgY3VycmVudFN0YXJ0ICs9IHByZWZpeENvdW50O1xuICAgICAgb2xkU3RhcnQgKz0gcHJlZml4Q291bnQ7XG4gICAgICBjdXJyZW50RW5kIC09IHN1ZmZpeENvdW50O1xuICAgICAgb2xkRW5kIC09IHN1ZmZpeENvdW50O1xuXG4gICAgICBpZiAoY3VycmVudEVuZCAtIGN1cnJlbnRTdGFydCA9PSAwICYmIG9sZEVuZCAtIG9sZFN0YXJ0ID09IDApXG4gICAgICAgIHJldHVybiBbXTtcblxuICAgICAgaWYgKGN1cnJlbnRTdGFydCA9PSBjdXJyZW50RW5kKSB7XG4gICAgICAgIHZhciBzcGxpY2UgPSBuZXdTcGxpY2UoY3VycmVudFN0YXJ0LCBbXSwgMCk7XG4gICAgICAgIHdoaWxlIChvbGRTdGFydCA8IG9sZEVuZClcbiAgICAgICAgICBzcGxpY2UucmVtb3ZlZC5wdXNoKG9sZFtvbGRTdGFydCsrXSk7XG5cbiAgICAgICAgcmV0dXJuIFsgc3BsaWNlIF07XG4gICAgICB9IGVsc2UgaWYgKG9sZFN0YXJ0ID09IG9sZEVuZClcbiAgICAgICAgcmV0dXJuIFsgbmV3U3BsaWNlKGN1cnJlbnRTdGFydCwgW10sIGN1cnJlbnRFbmQgLSBjdXJyZW50U3RhcnQpIF07XG5cbiAgICAgIHZhciBvcHMgPSB0aGlzLnNwbGljZU9wZXJhdGlvbnNGcm9tRWRpdERpc3RhbmNlcyhcbiAgICAgICAgICB0aGlzLmNhbGNFZGl0RGlzdGFuY2VzKGN1cnJlbnQsIGN1cnJlbnRTdGFydCwgY3VycmVudEVuZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9sZCwgb2xkU3RhcnQsIG9sZEVuZCkpO1xuXG4gICAgICB2YXIgc3BsaWNlID0gdW5kZWZpbmVkO1xuICAgICAgdmFyIHNwbGljZXMgPSBbXTtcbiAgICAgIHZhciBpbmRleCA9IGN1cnJlbnRTdGFydDtcbiAgICAgIHZhciBvbGRJbmRleCA9IG9sZFN0YXJ0O1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBvcHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgc3dpdGNoKG9wc1tpXSkge1xuICAgICAgICAgIGNhc2UgRURJVF9MRUFWRTpcbiAgICAgICAgICAgIGlmIChzcGxpY2UpIHtcbiAgICAgICAgICAgICAgc3BsaWNlcy5wdXNoKHNwbGljZSk7XG4gICAgICAgICAgICAgIHNwbGljZSA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaW5kZXgrKztcbiAgICAgICAgICAgIG9sZEluZGV4Kys7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlIEVESVRfVVBEQVRFOlxuICAgICAgICAgICAgaWYgKCFzcGxpY2UpXG4gICAgICAgICAgICAgIHNwbGljZSA9IG5ld1NwbGljZShpbmRleCwgW10sIDApO1xuXG4gICAgICAgICAgICBzcGxpY2UuYWRkZWRDb3VudCsrO1xuICAgICAgICAgICAgaW5kZXgrKztcblxuICAgICAgICAgICAgc3BsaWNlLnJlbW92ZWQucHVzaChvbGRbb2xkSW5kZXhdKTtcbiAgICAgICAgICAgIG9sZEluZGV4Kys7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlIEVESVRfQUREOlxuICAgICAgICAgICAgaWYgKCFzcGxpY2UpXG4gICAgICAgICAgICAgIHNwbGljZSA9IG5ld1NwbGljZShpbmRleCwgW10sIDApO1xuXG4gICAgICAgICAgICBzcGxpY2UuYWRkZWRDb3VudCsrO1xuICAgICAgICAgICAgaW5kZXgrKztcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgRURJVF9ERUxFVEU6XG4gICAgICAgICAgICBpZiAoIXNwbGljZSlcbiAgICAgICAgICAgICAgc3BsaWNlID0gbmV3U3BsaWNlKGluZGV4LCBbXSwgMCk7XG5cbiAgICAgICAgICAgIHNwbGljZS5yZW1vdmVkLnB1c2gob2xkW29sZEluZGV4XSk7XG4gICAgICAgICAgICBvbGRJbmRleCsrO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKHNwbGljZSkge1xuICAgICAgICBzcGxpY2VzLnB1c2goc3BsaWNlKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBzcGxpY2VzO1xuICAgIH0sXG5cbiAgICBzaGFyZWRQcmVmaXg6IGZ1bmN0aW9uKGN1cnJlbnQsIG9sZCwgc2VhcmNoTGVuZ3RoKSB7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHNlYXJjaExlbmd0aDsgaSsrKVxuICAgICAgICBpZiAoIXRoaXMuZXF1YWxzKGN1cnJlbnRbaV0sIG9sZFtpXSkpXG4gICAgICAgICAgcmV0dXJuIGk7XG4gICAgICByZXR1cm4gc2VhcmNoTGVuZ3RoO1xuICAgIH0sXG5cbiAgICBzaGFyZWRTdWZmaXg6IGZ1bmN0aW9uKGN1cnJlbnQsIG9sZCwgc2VhcmNoTGVuZ3RoKSB7XG4gICAgICB2YXIgaW5kZXgxID0gY3VycmVudC5sZW5ndGg7XG4gICAgICB2YXIgaW5kZXgyID0gb2xkLmxlbmd0aDtcbiAgICAgIHZhciBjb3VudCA9IDA7XG4gICAgICB3aGlsZSAoY291bnQgPCBzZWFyY2hMZW5ndGggJiYgdGhpcy5lcXVhbHMoY3VycmVudFstLWluZGV4MV0sIG9sZFstLWluZGV4Ml0pKVxuICAgICAgICBjb3VudCsrO1xuXG4gICAgICByZXR1cm4gY291bnQ7XG4gICAgfSxcblxuICAgIGNhbGN1bGF0ZVNwbGljZXM6IGZ1bmN0aW9uKGN1cnJlbnQsIHByZXZpb3VzKSB7XG4gICAgICByZXR1cm4gdGhpcy5jYWxjU3BsaWNlcyhjdXJyZW50LCAwLCBjdXJyZW50Lmxlbmd0aCwgcHJldmlvdXMsIDAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcmV2aW91cy5sZW5ndGgpO1xuICAgIH0sXG5cbiAgICBlcXVhbHM6IGZ1bmN0aW9uKGN1cnJlbnRWYWx1ZSwgcHJldmlvdXNWYWx1ZSkge1xuICAgICAgcmV0dXJuIGN1cnJlbnRWYWx1ZSA9PT0gcHJldmlvdXNWYWx1ZTtcbiAgICB9XG4gIH07XG5cbiAgdmFyIGFycmF5U3BsaWNlID0gbmV3IEFycmF5U3BsaWNlKCk7XG5cbiAgZnVuY3Rpb24gY2FsY1NwbGljZXMoY3VycmVudCwgY3VycmVudFN0YXJ0LCBjdXJyZW50RW5kLFxuICAgICAgICAgICAgICAgICAgICAgICBvbGQsIG9sZFN0YXJ0LCBvbGRFbmQpIHtcbiAgICByZXR1cm4gYXJyYXlTcGxpY2UuY2FsY1NwbGljZXMoY3VycmVudCwgY3VycmVudFN0YXJ0LCBjdXJyZW50RW5kLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbGQsIG9sZFN0YXJ0LCBvbGRFbmQpO1xuICB9XG5cbiAgZnVuY3Rpb24gaW50ZXJzZWN0KHN0YXJ0MSwgZW5kMSwgc3RhcnQyLCBlbmQyKSB7XG4gICAgLy8gRGlzam9pbnRcbiAgICBpZiAoZW5kMSA8IHN0YXJ0MiB8fCBlbmQyIDwgc3RhcnQxKVxuICAgICAgcmV0dXJuIC0xO1xuXG4gICAgLy8gQWRqYWNlbnRcbiAgICBpZiAoZW5kMSA9PSBzdGFydDIgfHwgZW5kMiA9PSBzdGFydDEpXG4gICAgICByZXR1cm4gMDtcblxuICAgIC8vIE5vbi16ZXJvIGludGVyc2VjdCwgc3BhbjEgZmlyc3RcbiAgICBpZiAoc3RhcnQxIDwgc3RhcnQyKSB7XG4gICAgICBpZiAoZW5kMSA8IGVuZDIpXG4gICAgICAgIHJldHVybiBlbmQxIC0gc3RhcnQyOyAvLyBPdmVybGFwXG4gICAgICBlbHNlXG4gICAgICAgIHJldHVybiBlbmQyIC0gc3RhcnQyOyAvLyBDb250YWluZWRcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gTm9uLXplcm8gaW50ZXJzZWN0LCBzcGFuMiBmaXJzdFxuICAgICAgaWYgKGVuZDIgPCBlbmQxKVxuICAgICAgICByZXR1cm4gZW5kMiAtIHN0YXJ0MTsgLy8gT3ZlcmxhcFxuICAgICAgZWxzZVxuICAgICAgICByZXR1cm4gZW5kMSAtIHN0YXJ0MTsgLy8gQ29udGFpbmVkXG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gbWVyZ2VTcGxpY2Uoc3BsaWNlcywgaW5kZXgsIHJlbW92ZWQsIGFkZGVkQ291bnQpIHtcblxuICAgIHZhciBzcGxpY2UgPSBuZXdTcGxpY2UoaW5kZXgsIHJlbW92ZWQsIGFkZGVkQ291bnQpO1xuXG4gICAgdmFyIGluc2VydGVkID0gZmFsc2U7XG4gICAgdmFyIGluc2VydGlvbk9mZnNldCA9IDA7XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHNwbGljZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBjdXJyZW50ID0gc3BsaWNlc1tpXTtcbiAgICAgIGN1cnJlbnQuaW5kZXggKz0gaW5zZXJ0aW9uT2Zmc2V0O1xuXG4gICAgICBpZiAoaW5zZXJ0ZWQpXG4gICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICB2YXIgaW50ZXJzZWN0Q291bnQgPSBpbnRlcnNlY3Qoc3BsaWNlLmluZGV4LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNwbGljZS5pbmRleCArIHNwbGljZS5yZW1vdmVkLmxlbmd0aCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjdXJyZW50LmluZGV4LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGN1cnJlbnQuaW5kZXggKyBjdXJyZW50LmFkZGVkQ291bnQpO1xuXG4gICAgICBpZiAoaW50ZXJzZWN0Q291bnQgPj0gMCkge1xuICAgICAgICAvLyBNZXJnZSB0aGUgdHdvIHNwbGljZXNcblxuICAgICAgICBzcGxpY2VzLnNwbGljZShpLCAxKTtcbiAgICAgICAgaS0tO1xuXG4gICAgICAgIGluc2VydGlvbk9mZnNldCAtPSBjdXJyZW50LmFkZGVkQ291bnQgLSBjdXJyZW50LnJlbW92ZWQubGVuZ3RoO1xuXG4gICAgICAgIHNwbGljZS5hZGRlZENvdW50ICs9IGN1cnJlbnQuYWRkZWRDb3VudCAtIGludGVyc2VjdENvdW50O1xuICAgICAgICB2YXIgZGVsZXRlQ291bnQgPSBzcGxpY2UucmVtb3ZlZC5sZW5ndGggK1xuICAgICAgICAgICAgICAgICAgICAgICAgICBjdXJyZW50LnJlbW92ZWQubGVuZ3RoIC0gaW50ZXJzZWN0Q291bnQ7XG5cbiAgICAgICAgaWYgKCFzcGxpY2UuYWRkZWRDb3VudCAmJiAhZGVsZXRlQ291bnQpIHtcbiAgICAgICAgICAvLyBtZXJnZWQgc3BsaWNlIGlzIGEgbm9vcC4gZGlzY2FyZC5cbiAgICAgICAgICBpbnNlcnRlZCA9IHRydWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdmFyIHJlbW92ZWQgPSBjdXJyZW50LnJlbW92ZWQ7XG5cbiAgICAgICAgICBpZiAoc3BsaWNlLmluZGV4IDwgY3VycmVudC5pbmRleCkge1xuICAgICAgICAgICAgLy8gc29tZSBwcmVmaXggb2Ygc3BsaWNlLnJlbW92ZWQgaXMgcHJlcGVuZGVkIHRvIGN1cnJlbnQucmVtb3ZlZC5cbiAgICAgICAgICAgIHZhciBwcmVwZW5kID0gc3BsaWNlLnJlbW92ZWQuc2xpY2UoMCwgY3VycmVudC5pbmRleCAtIHNwbGljZS5pbmRleCk7XG4gICAgICAgICAgICBBcnJheS5wcm90b3R5cGUucHVzaC5hcHBseShwcmVwZW5kLCByZW1vdmVkKTtcbiAgICAgICAgICAgIHJlbW92ZWQgPSBwcmVwZW5kO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChzcGxpY2UuaW5kZXggKyBzcGxpY2UucmVtb3ZlZC5sZW5ndGggPiBjdXJyZW50LmluZGV4ICsgY3VycmVudC5hZGRlZENvdW50KSB7XG4gICAgICAgICAgICAvLyBzb21lIHN1ZmZpeCBvZiBzcGxpY2UucmVtb3ZlZCBpcyBhcHBlbmRlZCB0byBjdXJyZW50LnJlbW92ZWQuXG4gICAgICAgICAgICB2YXIgYXBwZW5kID0gc3BsaWNlLnJlbW92ZWQuc2xpY2UoY3VycmVudC5pbmRleCArIGN1cnJlbnQuYWRkZWRDb3VudCAtIHNwbGljZS5pbmRleCk7XG4gICAgICAgICAgICBBcnJheS5wcm90b3R5cGUucHVzaC5hcHBseShyZW1vdmVkLCBhcHBlbmQpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHNwbGljZS5yZW1vdmVkID0gcmVtb3ZlZDtcbiAgICAgICAgICBpZiAoY3VycmVudC5pbmRleCA8IHNwbGljZS5pbmRleCkge1xuICAgICAgICAgICAgc3BsaWNlLmluZGV4ID0gY3VycmVudC5pbmRleDtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAoc3BsaWNlLmluZGV4IDwgY3VycmVudC5pbmRleCkge1xuICAgICAgICAvLyBJbnNlcnQgc3BsaWNlIGhlcmUuXG5cbiAgICAgICAgaW5zZXJ0ZWQgPSB0cnVlO1xuXG4gICAgICAgIHNwbGljZXMuc3BsaWNlKGksIDAsIHNwbGljZSk7XG4gICAgICAgIGkrKztcblxuICAgICAgICB2YXIgb2Zmc2V0ID0gc3BsaWNlLmFkZGVkQ291bnQgLSBzcGxpY2UucmVtb3ZlZC5sZW5ndGhcbiAgICAgICAgY3VycmVudC5pbmRleCArPSBvZmZzZXQ7XG4gICAgICAgIGluc2VydGlvbk9mZnNldCArPSBvZmZzZXQ7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKCFpbnNlcnRlZClcbiAgICAgIHNwbGljZXMucHVzaChzcGxpY2UpO1xuICB9XG5cbiAgZnVuY3Rpb24gY3JlYXRlSW5pdGlhbFNwbGljZXMoYXJyYXksIGNoYW5nZVJlY29yZHMpIHtcbiAgICB2YXIgc3BsaWNlcyA9IFtdO1xuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjaGFuZ2VSZWNvcmRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgcmVjb3JkID0gY2hhbmdlUmVjb3Jkc1tpXTtcbiAgICAgIHN3aXRjaChyZWNvcmQudHlwZSkge1xuICAgICAgICBjYXNlICdzcGxpY2UnOlxuICAgICAgICAgIG1lcmdlU3BsaWNlKHNwbGljZXMsIHJlY29yZC5pbmRleCwgcmVjb3JkLnJlbW92ZWQuc2xpY2UoKSwgcmVjb3JkLmFkZGVkQ291bnQpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdhZGQnOlxuICAgICAgICBjYXNlICd1cGRhdGUnOlxuICAgICAgICBjYXNlICdkZWxldGUnOlxuICAgICAgICAgIGlmICghaXNJbmRleChyZWNvcmQubmFtZSkpXG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICB2YXIgaW5kZXggPSB0b051bWJlcihyZWNvcmQubmFtZSk7XG4gICAgICAgICAgaWYgKGluZGV4IDwgMClcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgIG1lcmdlU3BsaWNlKHNwbGljZXMsIGluZGV4LCBbcmVjb3JkLm9sZFZhbHVlXSwgMSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgY29uc29sZS5lcnJvcignVW5leHBlY3RlZCByZWNvcmQgdHlwZTogJyArIEpTT04uc3RyaW5naWZ5KHJlY29yZCkpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBzcGxpY2VzO1xuICB9XG5cbiAgZnVuY3Rpb24gcHJvamVjdEFycmF5U3BsaWNlcyhhcnJheSwgY2hhbmdlUmVjb3Jkcykge1xuICAgIHZhciBzcGxpY2VzID0gW107XG5cbiAgICBjcmVhdGVJbml0aWFsU3BsaWNlcyhhcnJheSwgY2hhbmdlUmVjb3JkcykuZm9yRWFjaChmdW5jdGlvbihzcGxpY2UpIHtcbiAgICAgIGlmIChzcGxpY2UuYWRkZWRDb3VudCA9PSAxICYmIHNwbGljZS5yZW1vdmVkLmxlbmd0aCA9PSAxKSB7XG4gICAgICAgIGlmIChzcGxpY2UucmVtb3ZlZFswXSAhPT0gYXJyYXlbc3BsaWNlLmluZGV4XSlcbiAgICAgICAgICBzcGxpY2VzLnB1c2goc3BsaWNlKTtcblxuICAgICAgICByZXR1cm5cbiAgICAgIH07XG5cbiAgICAgIHNwbGljZXMgPSBzcGxpY2VzLmNvbmNhdChjYWxjU3BsaWNlcyhhcnJheSwgc3BsaWNlLmluZGV4LCBzcGxpY2UuaW5kZXggKyBzcGxpY2UuYWRkZWRDb3VudCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzcGxpY2UucmVtb3ZlZCwgMCwgc3BsaWNlLnJlbW92ZWQubGVuZ3RoKSk7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gc3BsaWNlcztcbiAgfVxuXG4gLy8gRXhwb3J0IHRoZSBvYnNlcnZlLWpzIG9iamVjdCBmb3IgKipOb2RlLmpzKiosIHdpdGhcbi8vIGJhY2t3YXJkcy1jb21wYXRpYmlsaXR5IGZvciB0aGUgb2xkIGByZXF1aXJlKClgIEFQSS4gSWYgd2UncmUgaW5cbi8vIHRoZSBicm93c2VyLCBleHBvcnQgYXMgYSBnbG9iYWwgb2JqZWN0LlxudmFyIGV4cG9zZSA9IGdsb2JhbDtcbmlmICh0eXBlb2YgZXhwb3J0cyAhPT0gJ3VuZGVmaW5lZCcpIHtcbmlmICh0eXBlb2YgbW9kdWxlICE9PSAndW5kZWZpbmVkJyAmJiBtb2R1bGUuZXhwb3J0cykge1xuZXhwb3NlID0gZXhwb3J0cyA9IG1vZHVsZS5leHBvcnRzO1xufVxuZXhwb3NlID0gZXhwb3J0cztcbn1cbmV4cG9zZS5PYnNlcnZlciA9IE9ic2VydmVyO1xuZXhwb3NlLk9ic2VydmVyLnJ1bkVPTV8gPSBydW5FT007XG5leHBvc2UuT2JzZXJ2ZXIub2JzZXJ2ZXJTZW50aW5lbF8gPSBvYnNlcnZlclNlbnRpbmVsOyAvLyBmb3IgdGVzdGluZy5cbmV4cG9zZS5PYnNlcnZlci5oYXNPYmplY3RPYnNlcnZlID0gaGFzT2JzZXJ2ZTtcbmV4cG9zZS5BcnJheU9ic2VydmVyID0gQXJyYXlPYnNlcnZlcjtcbmV4cG9zZS5BcnJheU9ic2VydmVyLmNhbGN1bGF0ZVNwbGljZXMgPSBmdW5jdGlvbihjdXJyZW50LCBwcmV2aW91cykge1xucmV0dXJuIGFycmF5U3BsaWNlLmNhbGN1bGF0ZVNwbGljZXMoY3VycmVudCwgcHJldmlvdXMpO1xufTtcbmV4cG9zZS5QbGF0Zm9ybSA9IGdsb2JhbC5QbGF0Zm9ybTtcbmV4cG9zZS5BcnJheVNwbGljZSA9IEFycmF5U3BsaWNlO1xuZXhwb3NlLk9iamVjdE9ic2VydmVyID0gT2JqZWN0T2JzZXJ2ZXI7XG5leHBvc2UuUGF0aE9ic2VydmVyID0gUGF0aE9ic2VydmVyO1xuZXhwb3NlLkNvbXBvdW5kT2JzZXJ2ZXIgPSBDb21wb3VuZE9ic2VydmVyO1xuZXhwb3NlLlBhdGggPSBQYXRoO1xuZXhwb3NlLk9ic2VydmVyVHJhbnNmb3JtID0gT2JzZXJ2ZXJUcmFuc2Zvcm07XG59KSh0eXBlb2YgZ2xvYmFsICE9PSAndW5kZWZpbmVkJyAmJiBnbG9iYWwgJiYgdHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcgJiYgbW9kdWxlID8gZ2xvYmFsIDogdGhpcyB8fCB3aW5kb3cpO1xuXG59KS5jYWxsKHRoaXMsdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbCA6IHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSkiXX0=
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9odHRwL2Rlc2NyaXB0b3IuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9odHRwL2Rlc2NyaXB0b3JSZWdpc3RyeS5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2h0dHAvaW5kZXguanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9odHRwL3BhZ2luYXRvci5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2h0dHAvcmVxdWVzdERlc2NyaXB0b3IuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9odHRwL3Jlc3BvbnNlRGVzY3JpcHRvci5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2h0dHAvc2VyaWFsaXNlci5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9xdWVyeXN0cmluZy1lczMvZGVjb2RlLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3Qvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL3F1ZXJ5c3RyaW5nLWVzMy9lbmNvZGUuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvcXVlcnlzdHJpbmctZXMzL2luZGV4LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5WEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hjQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvKipcbiAqIERlc2NyaXB0b3JzIGRlYWwgd2l0aCB0aGUgZGVzY3JpcHRpb24gb2YgSFRUUCByZXF1ZXN0cyBhbmQgYXJlIHVzZWQgYnkgU2llc3RhIHRvIGRldGVybWluZSB3aGF0IHRvIGRvXG4gKiB3aXRoIEhUVFAgcmVxdWVzdC9yZXNwb25zZSBib2RpZXMuXG4gKiBAbW9kdWxlIGh0dHBcbiAqL1xuXG52YXIgX2ludGVybmFsID0gc2llc3RhLl9pbnRlcm5hbCxcbiAgICBsb2cgPSBfaW50ZXJuYWwubG9nLFxuICAgIEludGVybmFsU2llc3RhRXJyb3IgPSBfaW50ZXJuYWwuZXJyb3IuSW50ZXJuYWxTaWVzdGFFcnJvcixcbiAgICB1dGlsID0gX2ludGVybmFsLnV0aWwsXG4gICAgYXNzZXJ0ID0gdXRpbC5hc3NlcnQsXG4gICAgZGVmaW5lU3ViUHJvcGVydHkgPSB1dGlsLmRlZmluZVN1YlByb3BlcnR5LFxuICAgIENvbGxlY3Rpb25SZWdpc3RyeSA9IF9pbnRlcm5hbC5Db2xsZWN0aW9uUmVnaXN0cnksXG4gICAgZXh0ZW5kID0gX2ludGVybmFsLmV4dGVuZCxcbiAgICBfID0gdXRpbC5fO1xuXG52YXIgTG9nZ2VyID0gbG9nLmxvZ2dlcldpdGhOYW1lKCdEZXNjcmlwdG9yJyk7XG5cbnZhciBodHRwTWV0aG9kcyA9IFsnUE9TVCcsICdQQVRDSCcsICdQVVQnLCAnSEVBRCcsICdHRVQnLCAnREVMRVRFJywgJ09QVElPTlMnLCAnVFJBQ0UnLCAnQ09OTkVDVCddO1xuXG5mdW5jdGlvbiByZXNvbHZlTWV0aG9kKG1ldGhvZHMpIHtcbiAgICAvLyBDb252ZXJ0IHdpbGRjYXJkcyBpbnRvIG1ldGhvZHMgYW5kIGVuc3VyZSBpcyBhbiBhcnJheSBvZiB1cHBlcmNhc2UgbWV0aG9kcy5cbiAgICBpZiAobWV0aG9kcykge1xuICAgICAgICBpZiAobWV0aG9kcyA9PSAnKicgfHwgbWV0aG9kcy5pbmRleE9mKCcqJykgPiAtMSkge1xuICAgICAgICAgICAgbWV0aG9kcyA9IGh0dHBNZXRob2RzO1xuICAgICAgICB9IGVsc2UgaWYgKCF1dGlsLmlzQXJyYXkobWV0aG9kcykpIHtcbiAgICAgICAgICAgIG1ldGhvZHMgPSBbbWV0aG9kc107XG4gICAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgICBtZXRob2RzID0gWydHRVQnXTtcbiAgICB9XG4gICAgcmV0dXJuIF8ubWFwKG1ldGhvZHMsIGZ1bmN0aW9uICh4KSB7XG4gICAgICAgIHJldHVybiB4LnRvVXBwZXJDYXNlKClcbiAgICB9KTtcbn1cblxuLyoqXG4gKiBBIGRlc2NyaXB0b3IgJ2Rlc2NyaWJlcycgcG9zc2libGUgSFRUUCByZXF1ZXN0cyBhZ2FpbnN0IGFuIEFQSSwgYW5kIGlzIHVzZWQgdG8gZGVjaWRlIHdoZXRoZXIgb3Igbm90IHRvXG4gKiBpbnRlcmNlcHQgYSBIVFRQIHJlcXVlc3QvcmVzcG9uc2UgYW5kIHBlcmZvcm0gYSBtYXBwaW5nLlxuICpcbiAqIEBjb25zdHJ1Y3RvclxuICogQHBhcmFtIHtPYmplY3R9IG9wdHNcbiAqL1xuZnVuY3Rpb24gRGVzY3JpcHRvcihvcHRzKSB7XG4gICAgaWYgKCF0aGlzKSB7XG4gICAgICAgIHJldHVybiBuZXcgRGVzY3JpcHRvcihvcHRzKTtcbiAgICB9XG5cbiAgICB0aGlzLl9yYXdPcHRzID0gZXh0ZW5kKHRydWUsIHt9LCBvcHRzKTtcbiAgICB0aGlzLl9vcHRzID0gb3B0cztcblxuICAgIHZhciBwcm9jZXNzUGF0aCA9IGZ1bmN0aW9uIChyYXcpIHtcbiAgICAgICAgaWYgKCEocmF3IGluc3RhbmNlb2YgUmVnRXhwKSkge1xuICAgICAgICAgICAgcmF3ID0gbmV3IFJlZ0V4cChyYXcsICdnJyk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJhdztcbiAgICB9LmJpbmQodGhpcyk7XG5cbiAgICBpZiAodGhpcy5fb3B0cy5wYXRoKSB7XG4gICAgICAgIHZhciBwYXRocyA9IHRoaXMuX29wdHMucGF0aDtcbiAgICAgICAgaWYgKCF1dGlsLmlzQXJyYXkocGF0aHMpKSB7XG4gICAgICAgICAgICBwYXRocyA9IFtwYXRoc107XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9vcHRzLnBhdGggPSBbXTtcblxuICAgICAgICBfLmVhY2gocGF0aHMsIGZ1bmN0aW9uIChwKSB7XG4gICAgICAgICAgICB0aGlzLl9vcHRzLnBhdGgucHVzaChwcm9jZXNzUGF0aC5jYWxsKHRoaXMsIHApKTtcbiAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLl9vcHRzLnBhdGggPSBbJyddO1xuICAgIH1cblxuICAgIHRoaXMuX29wdHMubWV0aG9kID0gcmVzb2x2ZU1ldGhvZCh0aGlzLl9vcHRzLm1ldGhvZCk7XG5cbiAgICAvLyBNYXBwaW5ncyBjYW4gYmUgcGFzc2VkIGFzIHRoZSBhY3R1YWwgbWFwcGluZyBvYmplY3Qgb3IgYXMgYSBzdHJpbmcgKHdpdGggQVBJIHNwZWNpZmllZCB0b28pXG4gICAgaWYgKHRoaXMuX29wdHMubW9kZWwpIHtcbiAgICAgICAgaWYgKHR5cGVvZih0aGlzLl9vcHRzLm1vZGVsKSA9PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgaWYgKHRoaXMuX29wdHMuY29sbGVjdGlvbikge1xuICAgICAgICAgICAgICAgIHZhciBjb2xsZWN0aW9uO1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YodGhpcy5fb3B0cy5jb2xsZWN0aW9uKSA9PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgICAgICBjb2xsZWN0aW9uID0gQ29sbGVjdGlvblJlZ2lzdHJ5W3RoaXMuX29wdHMuY29sbGVjdGlvbl07XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgY29sbGVjdGlvbiA9IHRoaXMuX29wdHMuY29sbGVjdGlvbjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKGNvbGxlY3Rpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGFjdHVhbE1vZGVsID0gY29sbGVjdGlvblt0aGlzLl9vcHRzLm1vZGVsXTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGFjdHVhbE1vZGVsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9vcHRzLm1vZGVsID0gYWN0dWFsTW9kZWw7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ01vZGVsICcgKyB0aGlzLl9vcHRzLm1vZGVsICsgJyBkb2VzIG5vdCBleGlzdCcsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBvcHRzOiBvcHRzLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0b3I6IHRoaXNcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdDb2xsZWN0aW9uICcgKyB0aGlzLl9vcHRzLmNvbGxlY3Rpb24gKyAnIGRvZXMgbm90IGV4aXN0Jywge1xuICAgICAgICAgICAgICAgICAgICAgICAgb3B0czogb3B0cyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0b3I6IHRoaXNcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1Bhc3NlZCBtb2RlbCBhcyBzdHJpbmcsIGJ1dCBkaWQgbm90IHNwZWNpZnkgdGhlIGNvbGxlY3Rpb24gaXQgYmVsb25ncyB0bycsIHtcbiAgICAgICAgICAgICAgICAgICAgb3B0czogb3B0cyxcbiAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRvcjogdGhpc1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdEZXNjcmlwdG9ycyBtdXN0IGJlIGluaXRpYWxpc2VkIHdpdGggYSBtb2RlbCcsIHtcbiAgICAgICAgICAgIG9wdHM6IG9wdHMsXG4gICAgICAgICAgICBkZXNjcmlwdG9yOiB0aGlzXG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIElmIGtleSBwYXRoLCBjb252ZXJ0IGRhdGEga2V5IHBhdGggaW50byBhbiBvYmplY3QgdGhhdCB3ZSBjYW4gdGhlbiB1c2UgdG8gdHJhdmVyc2UgdGhlIEhUVFAgYm9kaWVzLlxuICAgIC8vIG90aGVyd2lzZSBsZWF2ZSBhcyBzdHJpbmcgb3IgdW5kZWZpbmVkLlxuICAgIHZhciBkYXRhID0gdGhpcy5fb3B0cy5kYXRhO1xuICAgIGlmIChkYXRhKSB7XG4gICAgICAgIGlmIChkYXRhLmxlbmd0aCkge1xuICAgICAgICAgICAgdmFyIHJvb3Q7XG4gICAgICAgICAgICB2YXIgYXJyID0gZGF0YS5zcGxpdCgnLicpO1xuICAgICAgICAgICAgaWYgKGFyci5sZW5ndGggPT0gMSkge1xuICAgICAgICAgICAgICAgIHJvb3QgPSBhcnJbMF07XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHZhciBvYmogPSB7fTtcbiAgICAgICAgICAgICAgICByb290ID0gb2JqO1xuICAgICAgICAgICAgICAgIHZhciBwcmV2aW91c0tleSA9IGFyclswXTtcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMTsgaSA8IGFyci5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICB2YXIga2V5ID0gYXJyW2ldO1xuICAgICAgICAgICAgICAgICAgICBpZiAoaSA9PSAoYXJyLmxlbmd0aCAtIDEpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBvYmpbcHJldmlvdXNLZXldID0ga2V5O1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG5ld1ZhciA9IHt9O1xuICAgICAgICAgICAgICAgICAgICAgICAgb2JqW3ByZXZpb3VzS2V5XSA9IG5ld1ZhcjtcbiAgICAgICAgICAgICAgICAgICAgICAgIG9iaiA9IG5ld1ZhcjtcbiAgICAgICAgICAgICAgICAgICAgICAgIHByZXZpb3VzS2V5ID0ga2V5O1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5fb3B0cy5kYXRhID0gcm9vdDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBuYW1lIHBhdGhcbiAgICAgKiBAdHlwZSB7U3RyaW5nfVxuICAgICAqL1xuICAgIGRlZmluZVN1YlByb3BlcnR5LmNhbGwodGhpcywgJ3BhdGgnLCB0aGlzLl9vcHRzKTtcbiAgICBkZWZpbmVTdWJQcm9wZXJ0eS5jYWxsKHRoaXMsICdtZXRob2QnLCB0aGlzLl9vcHRzKTtcbiAgICBkZWZpbmVTdWJQcm9wZXJ0eS5jYWxsKHRoaXMsICdtb2RlbCcsIHRoaXMuX29wdHMpO1xuICAgIGRlZmluZVN1YlByb3BlcnR5LmNhbGwodGhpcywgJ2RhdGEnLCB0aGlzLl9vcHRzKTtcbiAgICBkZWZpbmVTdWJQcm9wZXJ0eS5jYWxsKHRoaXMsICd0cmFuc2Zvcm1zJywgdGhpcy5fb3B0cyk7XG59XG5cbl8uZXh0ZW5kKERlc2NyaXB0b3IucHJvdG90eXBlLCB7XG4gICAgaHR0cE1ldGhvZHM6IGh0dHBNZXRob2RzLFxuICAgIC8qKlxuICAgICAqIFRha2VzIGEgcmVnZXggcGF0aCBhbmQgcmV0dXJucyB0cnVlIGlmIG1hdGNoZWRcbiAgICAgKlxuICAgICAqIEBwYXJhbSAge1N0cmluZ30gcGF0aFxuICAgICAqIEByZXR1cm4ge2Jvb2xlYW59XG4gICAgICogQGludGVybmFsXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBgYGBqc1xuICAgICAqIHZhciBkID0gbmV3IERlc2NyaXB0b3Ioe1xuICAgICAqICAgICBwYXRoOiAnL3Jlc291cmNlLyg/UDxpZD4pLydcbiAgICAgKiB9KVxuICAgICAqIHZhciBtYXRjaGVkID0gZC5fbWF0Y2hQYXRoKCcvcmVzb3VyY2UvMicpO1xuICAgICAqIGNvbnNvbGUubG9nKG1hdGNoZWQpOyAvLyB7aWQ6ICcyJ31cbiAgICAgKiBgYGBcbiAgICAgKi9cbiAgICBfbWF0Y2hQYXRoOiBmdW5jdGlvbiAocGF0aCkge1xuICAgICAgICB2YXIgaTtcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IHRoaXMuX29wdHMucGF0aC5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdmFyIHJlZ0V4cCA9IHRoaXMuX29wdHMucGF0aFtpXTtcbiAgICAgICAgICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKVxuICAgICAgICAgICAgICAgIExvZ2dlci50cmFjZSgnTWF0Y2hpbmcgcGF0aCcsIHBhdGgsIHJlZ0V4cC50b1N0cmluZygpKTtcbiAgICAgICAgICAgIHZhciBtYXRjaGVkID0gcmVnRXhwLmV4ZWMocGF0aCk7XG4gICAgICAgICAgICBpZiAoTG9nZ2VyLnRyYWNlLmlzRW5hYmxlZCkge1xuICAgICAgICAgICAgICAgIGlmIChtYXRjaGVkKSB7XG4gICAgICAgICAgICAgICAgICAgIExvZ2dlci50cmFjZSgnTWF0Y2hlZCBwYXRoIHN1Y2Nlc3NmdWxseScsIHBhdGgsIHJlZ0V4cC50b1N0cmluZygpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIExvZ2dlci50cmFjZSgnRmFpbGVkIHRvIG1hdGNoIHBhdGgnLCBwYXRoLCByZWdFeHAudG9TdHJpbmcoKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKG1hdGNoZWQpIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0cnVlIGlmIHRoZSBkZXNjcmlwdG9yIGFjY2VwdHMgdGhlIEhUVFAgbWV0aG9kLlxuICAgICAqXG4gICAgICogQHBhcmFtICB7U3RyaW5nfSBtZXRob2RcbiAgICAgKiBAcmV0dXJuIHtib29sZWFufVxuICAgICAqIEBpbnRlcm5hbFxuICAgICAqIEBleGFtcGxlXG4gICAgICogYGBganNcbiAgICAgKiB2YXIgZCA9IG5ldyBEZXNjcmlwdG9yKHtcbiAgICAgKiAgICAgbWV0aG9kOiBbJ1BPU1QnLCAnUFVUJ11cbiAgICAgKiB9KTtcbiAgICAgKiBjb25zb2xlLmxvZyhkLl9tYXRjaE1ldGhvZCgnR0VUJykpOyAvLyBmYWxzZVxuICAgICAqIGBgYFxuICAgICAqL1xuICAgIF9tYXRjaE1ldGhvZDogZnVuY3Rpb24gKG1ldGhvZCkge1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMubWV0aG9kLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAobWV0aG9kLnRvVXBwZXJDYXNlKCkgPT0gdGhpcy5tZXRob2RbaV0pIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBQZXJmb3JtcyBhIGJyZWFkdGgtZmlyc3Qgc2VhcmNoIHRocm91Z2ggZGF0YSwgZW1iZWRkaW5nIG9iaiBpbiB0aGUgZmlyc3QgbGVhZi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSAge09iamVjdH0gb2JqXG4gICAgICogQHBhcmFtICB7T2JqZWN0fSBkYXRhXG4gICAgICogQHJldHVybiB7T2JqZWN0fVxuICAgICAqL1xuICAgIGJ1cnk6IGZ1bmN0aW9uIChvYmosIGRhdGEpIHtcbiAgICAgICAgdmFyIHJvb3QgPSBkYXRhO1xuICAgICAgICB2YXIga2V5cyA9IE9iamVjdC5rZXlzKGRhdGEpO1xuICAgICAgICBhc3NlcnQoa2V5cy5sZW5ndGggPT0gMSk7XG4gICAgICAgIHZhciBrZXkgPSBrZXlzWzBdO1xuICAgICAgICB2YXIgY3VyciA9IGRhdGE7XG4gICAgICAgIHdoaWxlICghKHR5cGVvZihjdXJyW2tleV0pID09ICdzdHJpbmcnKSkge1xuICAgICAgICAgICAgY3VyciA9IGN1cnJba2V5XTtcbiAgICAgICAgICAgIGtleXMgPSBPYmplY3Qua2V5cyhjdXJyKTtcbiAgICAgICAgICAgIGFzc2VydChrZXlzLmxlbmd0aCA9PSAxKTtcbiAgICAgICAgICAgIGtleSA9IGtleXNbMF07XG4gICAgICAgIH1cbiAgICAgICAgdmFyIG5ld1BhcmVudCA9IGN1cnJba2V5XTtcbiAgICAgICAgdmFyIG5ld09iaiA9IHt9O1xuICAgICAgICBjdXJyW2tleV0gPSBuZXdPYmo7XG4gICAgICAgIG5ld09ialtuZXdQYXJlbnRdID0gb2JqO1xuICAgICAgICByZXR1cm4gcm9vdDtcbiAgICB9LFxuICAgIF9lbWJlZERhdGE6IGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgICAgIGlmICh0aGlzLmRhdGEpIHtcbiAgICAgICAgICAgIHZhciBuZXN0ZWQ7XG4gICAgICAgICAgICBpZiAodHlwZW9mKHRoaXMuZGF0YSkgPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICBuZXN0ZWQgPSB7fTtcbiAgICAgICAgICAgICAgICBuZXN0ZWRbdGhpcy5kYXRhXSA9IGRhdGE7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIG5lc3RlZCA9IHRoaXMuYnVyeShkYXRhLCBleHRlbmQodHJ1ZSwge30sIHRoaXMuZGF0YSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIG5lc3RlZDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBkYXRhO1xuICAgICAgICB9XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBJZiBuZXN0ZWQgZGF0YSBoYXMgYmVlbiBzcGVjaWZpZWQgaW4gdGhlIGRlc2NyaXB0b3IsIGV4dHJhY3QgdGhlIGRhdGEuXG4gICAgICogQHBhcmFtICB7T2JqZWN0fSBkYXRhXG4gICAgICogQHJldHVybiB7T2JqZWN0fVxuICAgICAqL1xuICAgIF9leHRyYWN0RGF0YTogZnVuY3Rpb24gKGRhdGEpIHtcbiAgICAgICAgaWYgKExvZ2dlci5kZWJ1Zy5pc0VuYWJsZWQpXG4gICAgICAgICAgICBMb2dnZXIuZGVidWcoJ19leHRyYWN0RGF0YScsIGRhdGEpO1xuICAgICAgICBpZiAodGhpcy5kYXRhKSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mKHRoaXMuZGF0YSkgPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZGF0YVt0aGlzLmRhdGFdO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB2YXIga2V5cyA9IE9iamVjdC5rZXlzKHRoaXMuZGF0YSk7XG4gICAgICAgICAgICAgICAgYXNzZXJ0KGtleXMubGVuZ3RoID09IDEpO1xuICAgICAgICAgICAgICAgIHZhciBjdXJyVGhlaXJzID0gZGF0YTtcbiAgICAgICAgICAgICAgICB2YXIgY3Vyck91cnMgPSB0aGlzLmRhdGE7XG4gICAgICAgICAgICAgICAgd2hpbGUgKHR5cGVvZihjdXJyT3VycykgIT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICAgICAga2V5cyA9IE9iamVjdC5rZXlzKGN1cnJPdXJzKTtcbiAgICAgICAgICAgICAgICAgICAgYXNzZXJ0KGtleXMubGVuZ3RoID09IDEpO1xuICAgICAgICAgICAgICAgICAgICB2YXIga2V5ID0ga2V5c1swXTtcbiAgICAgICAgICAgICAgICAgICAgY3Vyck91cnMgPSBjdXJyT3Vyc1trZXldO1xuICAgICAgICAgICAgICAgICAgICBjdXJyVGhlaXJzID0gY3VyclRoZWlyc1trZXldO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWN1cnJUaGVpcnMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiBjdXJyVGhlaXJzID8gY3VyclRoZWlyc1tjdXJyT3Vyc10gOiBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIGRhdGE7XG4gICAgICAgIH1cbiAgICB9LFxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdGhpcyBkZXNjcmlwdG9ycyBtYXBwaW5nIGlmIHRoZSByZXF1ZXN0IGNvbmZpZyBtYXRjaGVzLlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBjb25maWdcbiAgICAgKiBAcmV0dXJucyB7T2JqZWN0fVxuICAgICAqL1xuICAgIF9tYXRjaENvbmZpZzogZnVuY3Rpb24gKGNvbmZpZykge1xuICAgICAgICB2YXIgbWF0Y2hlcyA9IGNvbmZpZy50eXBlID8gdGhpcy5fbWF0Y2hNZXRob2QoY29uZmlnLnR5cGUpIDoge307XG4gICAgICAgIGlmIChtYXRjaGVzKSB7XG4gICAgICAgICAgICBtYXRjaGVzID0gY29uZmlnLnVybCA/IHRoaXMuX21hdGNoUGF0aChjb25maWcudXJsKSA6IHt9O1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBtYXRjaGVzO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGRhdGEgaWYgdGhlIGRhdGEgbWF0Y2hlcywgcGVyZm9ybWluZyBhbnkgZXh0cmFjdGlvbiBhcyBzcGVjaWZpZWQgaW4gb3B0cy5kYXRhXG4gICAgICpcbiAgICAgKiBAcGFyYW0gIHtPYmplY3R9IGRhdGFcbiAgICAgKiBAcmV0dXJuIHtPYmplY3R9XG4gICAgICovXG4gICAgX21hdGNoRGF0YTogZnVuY3Rpb24gKGRhdGEpIHtcbiAgICAgICAgdmFyIGV4dHJhY3RlZERhdGEgPSBudWxsO1xuICAgICAgICBpZiAodGhpcy5kYXRhKSB7XG4gICAgICAgICAgICBpZiAoZGF0YSkge1xuICAgICAgICAgICAgICAgIGV4dHJhY3RlZERhdGEgPSB0aGlzLl9leHRyYWN0RGF0YShkYXRhKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGV4dHJhY3RlZERhdGEgPSBkYXRhO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBleHRyYWN0ZWREYXRhO1xuICAgIH0sXG4gICAgLyoqXG4gICAgICogQ2hlY2sgaWYgdGhlIEhUVFAgY29uZmlnIGFuZCByZXR1cm5lZCBkYXRhIG1hdGNoIHRoaXMgZGVzY3JpcHRvciBkZWZpbml0aW9uLlxuICAgICAqXG4gICAgICogQHBhcmFtICB7T2JqZWN0fSBjb25maWcgQ29uZmlnIG9iamVjdCBmb3IgJC5hamF4IGFuZCBzaW1pbGFyXG4gICAgICogQHBhcmFtICB7T2JqZWN0fSBkYXRhXG4gICAgICogQHJldHVybiB7T2JqZWN0fSBFeHRyYWN0ZWQgZGF0YVxuICAgICAqL1xuICAgIG1hdGNoOiBmdW5jdGlvbiAoY29uZmlnLCBkYXRhKSB7XG4gICAgICAgIHZhciByZWdleE1hdGNoZXMgPSB0aGlzLl9tYXRjaENvbmZpZyhjb25maWcpO1xuICAgICAgICB2YXIgbWF0Y2hlcyA9ICEhcmVnZXhNYXRjaGVzO1xuICAgICAgICB2YXIgZXh0cmFjdGVkRGF0YSA9IGZhbHNlO1xuICAgICAgICBpZiAobWF0Y2hlcykge1xuICAgICAgICAgICAgZXh0cmFjdGVkRGF0YSA9IHRoaXMuX21hdGNoRGF0YShkYXRhKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZXh0cmFjdGVkRGF0YTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQXBwbHkgYW55IHRyYW5zZm9ybXMuXG4gICAgICogQHBhcmFtICB7T2JqZWN0fSBkYXRhIFNlcmlhbGlzZWQgZGF0YS5cbiAgICAgKiBAcmV0dXJuIHtPYmplY3R9IFNlcmlhbGlzZWQgZGF0YSB3aXRoIGFwcGxpZWQgdHJhbnNmb3JtYXRpb25zLlxuICAgICAqL1xuICAgIF90cmFuc2Zvcm1EYXRhOiBmdW5jdGlvbiAoZGF0YSkge1xuICAgICAgICB2YXIgdHJhbnNmb3JtcyA9IHRoaXMudHJhbnNmb3JtcztcbiAgICAgICAgaWYgKHR5cGVvZih0cmFuc2Zvcm1zKSA9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICBkYXRhID0gdHJhbnNmb3JtcyhkYXRhKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGZvciAodmFyIGF0dHIgaW4gdHJhbnNmb3Jtcykge1xuICAgICAgICAgICAgICAgIGlmICh0cmFuc2Zvcm1zLmhhc093blByb3BlcnR5KGF0dHIpKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChkYXRhW2F0dHJdKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgdHJhbnNmb3JtID0gdHJhbnNmb3Jtc1thdHRyXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciB2YWwgPSBkYXRhW2F0dHJdO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZih0cmFuc2Zvcm0pID09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHNwbGl0ID0gdHJhbnNmb3JtLnNwbGl0KCcuJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVsZXRlIGRhdGFbYXR0cl07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHNwbGl0Lmxlbmd0aCA9PSAxKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdGFbc3BsaXRbMF1dID0gdmFsO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdGFbc3BsaXRbMF1dID0ge307XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBuZXdWYWwgPSBkYXRhW3NwbGl0WzBdXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDE7IGkgPCBzcGxpdC5sZW5ndGggLSAxOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBuZXdBdHRyID0gc3BsaXRbaV07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBuZXdWYWxbbmV3QXR0cl0gPSB7fTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5ld1ZhbCA9IG5ld1ZhbFtuZXdBdHRyXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBuZXdWYWxbc3BsaXRbc3BsaXQubGVuZ3RoIC0gMV1dID0gdmFsO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAodHlwZW9mKHRyYW5zZm9ybSkgPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciB0cmFuc2Zvcm1lZCA9IHRyYW5zZm9ybSh2YWwpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICh1dGlsLmlzQXJyYXkodHJhbnNmb3JtZWQpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlbGV0ZSBkYXRhW2F0dHJdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkYXRhW3RyYW5zZm9ybWVkWzBdXSA9IHRyYW5zZm9ybWVkWzFdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdGFbYXR0cl0gPSB0cmFuc2Zvcm1lZDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdJbnZhbGlkIHRyYW5zZm9ybWVyJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGRhdGE7XG4gICAgfVxufSk7XG5cbmV4cG9ydHMuRGVzY3JpcHRvciA9IERlc2NyaXB0b3I7XG5leHBvcnRzLnJlc29sdmVNZXRob2QgPSByZXNvbHZlTWV0aG9kOyIsInZhciBfaW50ZXJuYWwgPSBzaWVzdGEuX2ludGVybmFsLFxuICAgIHV0aWwgPSBfaW50ZXJuYWwudXRpbCxcbiAgICBfID0gdXRpbC5fLFxuICAgIGxvZyA9IF9pbnRlcm5hbC5sb2c7XG5cbnZhciBMb2dnZXIgPSBsb2cubG9nZ2VyV2l0aE5hbWUoJ0Rlc2NyaXB0b3InKTtcblxuLyoqXG4gKiBAY2xhc3MgRW50cnkgcG9pbnQgZm9yIGRlc2NyaXB0b3IgcmVnaXN0cmF0aW9uLlxuICogQGNvbnN0cnVjdG9yXG4gKi9cbmZ1bmN0aW9uIERlc2NyaXB0b3JSZWdpc3RyeSgpIHtcbiAgICBpZiAoIXRoaXMpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBEZXNjcmlwdG9yUmVnaXN0cnkob3B0cyk7XG4gICAgfVxuICAgIHRoaXMucmVxdWVzdERlc2NyaXB0b3JzID0ge307XG4gICAgdGhpcy5yZXNwb25zZURlc2NyaXB0b3JzID0ge307XG59XG5cbmZ1bmN0aW9uIF9yZWdpc3RlckRlc2NyaXB0b3IoZGVzY3JpcHRvcnMsIGRlc2NyaXB0b3IpIHtcbiAgICB2YXIgbW9kZWwgPSBkZXNjcmlwdG9yLm1vZGVsO1xuICAgIHZhciBjb2xsZWN0aW9uTmFtZSA9IG1vZGVsLmNvbGxlY3Rpb25OYW1lO1xuICAgIGlmICghZGVzY3JpcHRvcnNbY29sbGVjdGlvbk5hbWVdKSB7XG4gICAgICAgIGRlc2NyaXB0b3JzW2NvbGxlY3Rpb25OYW1lXSA9IFtdO1xuICAgIH1cbiAgICBkZXNjcmlwdG9yc1tjb2xsZWN0aW9uTmFtZV0ucHVzaChkZXNjcmlwdG9yKTtcbn1cblxuZnVuY3Rpb24gX2Rlc2NyaXB0b3JzRm9yQ29sbGVjdGlvbihkZXNjcmlwdG9ycywgY29sbGVjdGlvbikge1xuICAgIHZhciBkZXNjcmlwdG9yc0ZvckNvbGxlY3Rpb247XG4gICAgaWYgKHR5cGVvZihjb2xsZWN0aW9uKSA9PSAnc3RyaW5nJykge1xuICAgICAgICBkZXNjcmlwdG9yc0ZvckNvbGxlY3Rpb24gPSBkZXNjcmlwdG9yc1tjb2xsZWN0aW9uXSB8fCBbXTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIGRlc2NyaXB0b3JzRm9yQ29sbGVjdGlvbiA9IChkZXNjcmlwdG9yc1tjb2xsZWN0aW9uLm5hbWVdIHx8IFtdKTtcbiAgICB9XG4gICAgcmV0dXJuIGRlc2NyaXB0b3JzRm9yQ29sbGVjdGlvbjtcbn1cblxuXG5fLmV4dGVuZChEZXNjcmlwdG9yUmVnaXN0cnkucHJvdG90eXBlLCB7XG4gICAgcmVnaXN0ZXJSZXF1ZXN0RGVzY3JpcHRvcjogZnVuY3Rpb24gKHJlcXVlc3REZXNjcmlwdG9yKSB7XG4gICAgICAgIF9yZWdpc3RlckRlc2NyaXB0b3IodGhpcy5yZXF1ZXN0RGVzY3JpcHRvcnMsIHJlcXVlc3REZXNjcmlwdG9yKTtcbiAgICB9LFxuICAgIHJlZ2lzdGVyUmVzcG9uc2VEZXNjcmlwdG9yOiBmdW5jdGlvbiAocmVzcG9uc2VEZXNjcmlwdG9yKSB7XG4gICAgICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKVxuICAgICAgICAgICAgTG9nZ2VyLnRyYWNlKCdyZWdpc3RlclJlc3BvbnNlRGVzY3JpcHRvcicpO1xuICAgICAgICBfcmVnaXN0ZXJEZXNjcmlwdG9yKHRoaXMucmVzcG9uc2VEZXNjcmlwdG9ycywgcmVzcG9uc2VEZXNjcmlwdG9yKTtcbiAgICB9LFxuICAgIHJlcXVlc3REZXNjcmlwdG9yc0ZvckNvbGxlY3Rpb246IGZ1bmN0aW9uIChjb2xsZWN0aW9uKSB7XG4gICAgICAgIHJldHVybiBfZGVzY3JpcHRvcnNGb3JDb2xsZWN0aW9uKHRoaXMucmVxdWVzdERlc2NyaXB0b3JzLCBjb2xsZWN0aW9uKTtcbiAgICB9LFxuICAgIHJlc3BvbnNlRGVzY3JpcHRvcnNGb3JDb2xsZWN0aW9uOiBmdW5jdGlvbiAoY29sbGVjdGlvbikge1xuICAgICAgICB2YXIgZGVzY3JpcHRvcnNGb3JDb2xsZWN0aW9uID0gX2Rlc2NyaXB0b3JzRm9yQ29sbGVjdGlvbih0aGlzLnJlc3BvbnNlRGVzY3JpcHRvcnMsIGNvbGxlY3Rpb24pO1xuICAgICAgICBpZiAoIWRlc2NyaXB0b3JzRm9yQ29sbGVjdGlvbi5sZW5ndGgpIHtcbiAgICAgICAgICAgIGlmIChMb2dnZXIuZGVidWcuaXNFbmFibGVkKVxuICAgICAgICAgICAgICAgIExvZ2dlci5kZWJ1ZygnTm8gcmVzcG9uc2UgZGVzY3JpcHRvcnMgZm9yIGNvbGxlY3Rpb24gJywgdGhpcy5yZXNwb25zZURlc2NyaXB0b3JzKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZGVzY3JpcHRvcnNGb3JDb2xsZWN0aW9uO1xuICAgIH0sXG4gICAgcmVzZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGhpcy5yZXF1ZXN0RGVzY3JpcHRvcnMgPSB7fTtcbiAgICAgICAgdGhpcy5yZXNwb25zZURlc2NyaXB0b3JzID0ge307XG4gICAgfVxufSk7XG5cbmV4cG9ydHMuRGVzY3JpcHRvclJlZ2lzdHJ5ID0gbmV3IERlc2NyaXB0b3JSZWdpc3RyeSgpOyIsIi8qKlxuICogUHJvdmlzaW9ucyB1c2FnZSBvZiAkLmFqYXggYW5kIHNpbWlsYXIgZnVuY3Rpb25zIHRvIHNlbmQgSFRUUCByZXF1ZXN0cyBtYXBwaW5nXG4gKiB0aGUgcmVzdWx0cyBiYWNrIG9udG8gdGhlIG9iamVjdCBncmFwaCBhdXRvbWF0aWNhbGx5LlxuICogQG1vZHVsZSBodHRwXG4gKi9cblxuaWYgKHR5cGVvZiBzaWVzdGEgPT0gJ3VuZGVmaW5lZCcgJiYgdHlwZW9mIG1vZHVsZSA9PSAndW5kZWZpbmVkJykge1xuICAgIHRocm93IG5ldyBFcnJvcignQ291bGQgbm90IGZpbmQgd2luZG93LnNpZXN0YS4gTWFrZSBzdXJlIHlvdSBpbmNsdWRlIHNpZXN0YS5jb3JlLmpzIGZpcnN0LicpO1xufVxuXG52YXIgX2ludGVybmFsID0gc2llc3RhLl9pbnRlcm5hbCxcbiAgICBDb2xsZWN0aW9uID0gX2ludGVybmFsLkNvbGxlY3Rpb24sXG4gICAgbG9nID0gX2ludGVybmFsLmxvZyxcbiAgICB1dGlsID0gX2ludGVybmFsLnV0aWwsXG4gICAgZXJyb3IgPSBfaW50ZXJuYWwuZXJyb3IsXG4gICAgXyA9IHV0aWwuXyxcbiAgICBkZXNjcmlwdG9yID0gcmVxdWlyZSgnLi9kZXNjcmlwdG9yJyksXG4gICAgSW50ZXJuYWxTaWVzdGFFcnJvciA9IF9pbnRlcm5hbC5lcnJvci5JbnRlcm5hbFNpZXN0YUVycm9yO1xuXG52YXIgRGVzY3JpcHRvclJlZ2lzdHJ5ID0gcmVxdWlyZSgnLi9kZXNjcmlwdG9yUmVnaXN0cnknKS5EZXNjcmlwdG9yUmVnaXN0cnk7XG5cblxudmFyIExvZ2dlciA9IGxvZy5sb2dnZXJXaXRoTmFtZSgnSFRUUCcpO1xuXG4vKipcbiAqIExvZyBhIEhUVFAgcmVzcG9uc2VcbiAqIEBwYXJhbSBvcHRzXG4gKiBAcGFyYW0geGhyXG4gKiBAcGFyYW0gW2RhdGFdIC0gUmF3IGRhdGEgcmVjZWl2ZWQgaW4gSFRUUCByZXNwb25zZS5cbiAqL1xuZnVuY3Rpb24gbG9nSHR0cFJlc3BvbnNlKG9wdHMsIHhociwgZGF0YSkge1xuICAgIGlmIChMb2dnZXIuZGVidWcuaXNFbmFibGVkKSB7XG4gICAgICAgIHZhciBsb2dnZXIgPSBMb2dnZXIuZGVidWc7XG4gICAgICAgIHZhciBsb2dNZXNzYWdlID0gb3B0cy50eXBlICsgJyAnICsgeGhyLnN0YXR1cyArICcgJyArIG9wdHMudXJsO1xuICAgICAgICBpZiAoTG9nZ2VyLnRyYWNlLmlzRW5hYmxlZCAmJiBkYXRhKSB7XG4gICAgICAgICAgICBsb2dnZXIgPSBMb2dnZXIudHJhY2U7XG4gICAgICAgICAgICBsb2dNZXNzYWdlICs9ICc6ICcgKyB1dGlsLnByZXR0eVByaW50KGRhdGEpO1xuICAgICAgICB9XG4gICAgICAgIGxvZ2dlcihsb2dNZXNzYWdlKTtcbiAgICB9XG59XG5cbi8qKlxuICogTG9nIGEgSFRUUCByZXF1ZXN0XG4gKiBAcGFyYW0gb3B0c1xuICovXG5mdW5jdGlvbiBsb2dIdHRwUmVxdWVzdChvcHRzKSB7XG4gICAgaWYgKExvZ2dlci5kZWJ1Zy5pc0VuYWJsZWQpIHtcbiAgICAgICAgdmFyIGxvZ2dlciA9IExvZ2dlci5kZWJ1ZztcbiAgICAgICAgLy8gVE9ETzogQXBwZW5kIHF1ZXJ5IHBhcmFtZXRlcnMgdG8gdGhlIFVSTC5cbiAgICAgICAgdmFyIGxvZ01lc3NhZ2UgPSBvcHRzLnR5cGUgKyAnICcgKyBvcHRzLnVybDtcbiAgICAgICAgaWYgKExvZ2dlci50cmFjZS5pc0VuYWJsZWQpIHtcbiAgICAgICAgICAgIC8vIFRPRE86IElmIGFueSBkYXRhIGlzIGJlaW5nIHNlbnQsIGxvZyB0aGF0LlxuICAgICAgICAgICAgbG9nZ2VyID0gTG9nZ2VyLnRyYWNlO1xuICAgICAgICB9XG4gICAgICAgIGxvZ2dlcihsb2dNZXNzYWdlKTtcbiAgICB9XG59XG5cblxuLyoqXG4gKiBTZW5kIGEgSFRUUCByZXF1ZXN0IHRvIHRoZSBnaXZlbiBtZXRob2QgYW5kIHBhdGggcGFyc2luZyB0aGUgcmVzcG9uc2UuXG4gKiBAcGFyYW0ge1N0cmluZ30gbWV0aG9kXG4gKiBAcGFyYW0ge1N0cmluZ30gcGF0aCBUaGUgcGF0aCB0byB0aGUgcmVzb3VyY2Ugd2Ugd2FudCB0byBHRVRcbiAqIEBwYXJhbSB7T2JqZWN0fEZ1bmN0aW9ufSBvcHRzT3JDYWxsYmFjayBFaXRoZXIgYW4gb3B0aW9ucyBvYmplY3Qgb3IgYSBjYWxsYmFjayBpZiBjYW4gdXNlIGRlZmF1bHRzXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBDYWxsYmFjayBpZiBvcHRzIHNwZWNpZmllZC5cbiAqL1xuZnVuY3Rpb24gX2h0dHBSZXNwb25zZShtZXRob2QsIHBhdGgsIG9wdHNPckNhbGxiYWNrLCBjYWxsYmFjaykge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMik7XG4gICAgdmFyIG9wdHMgPSB7fTtcbiAgICB2YXIgbmFtZSA9IHRoaXMubmFtZTtcbiAgICBpZiAodHlwZW9mKGFyZ3NbMF0pID09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgY2FsbGJhY2sgPSBhcmdzWzBdO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mKGFyZ3NbMF0pID09ICdvYmplY3QnKSB7XG4gICAgICAgIG9wdHMgPSBhcmdzWzBdO1xuICAgICAgICBjYWxsYmFjayA9IGFyZ3NbMV07XG4gICAgfVxuICAgIHZhciBkZWZlcnJlZCA9IHV0aWwuZGVmZXIoKTtcbiAgICBvcHRzLnR5cGUgPSBtZXRob2Q7XG4gICAgaWYgKCFvcHRzLnVybCkgeyAvLyBBbGxvdyBvdmVycmlkZXMuXG4gICAgICAgIHZhciBiYXNlVVJMID0gdGhpcy5iYXNlVVJMO1xuICAgICAgICBvcHRzLnVybCA9IGJhc2VVUkwgKyBwYXRoO1xuICAgIH1cbiAgICBpZiAob3B0cy5wYXJzZVJlc3BvbnNlID09PSB1bmRlZmluZWQpIG9wdHMucGFyc2VSZXNwb25zZSA9IHRydWU7XG4gICAgb3B0cy5zdWNjZXNzID0gZnVuY3Rpb24gKGRhdGEsIHN0YXR1cywgeGhyKSB7XG4gICAgICAgIGxvZ0h0dHBSZXNwb25zZShvcHRzLCB4aHIsIGRhdGEpO1xuICAgICAgICB2YXIgcmVzcCA9IHtcbiAgICAgICAgICAgIGRhdGE6IGRhdGEsXG4gICAgICAgICAgICBzdGF0dXM6IHN0YXR1cyxcbiAgICAgICAgICAgIHhocjogeGhyXG4gICAgICAgIH07XG4gICAgICAgIGlmIChvcHRzLnBhcnNlUmVzcG9uc2UpIHtcbiAgICAgICAgICAgIHZhciBkZXNjcmlwdG9ycyA9IERlc2NyaXB0b3JSZWdpc3RyeS5yZXNwb25zZURlc2NyaXB0b3JzRm9yQ29sbGVjdGlvbihzZWxmKTtcbiAgICAgICAgICAgIHZhciBtYXRjaGVkRGVzY3JpcHRvcjtcbiAgICAgICAgICAgIHZhciBleHRyYWN0ZWREYXRhO1xuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBkZXNjcmlwdG9ycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIHZhciBkZXNjcmlwdG9yID0gZGVzY3JpcHRvcnNbaV07XG4gICAgICAgICAgICAgICAgZXh0cmFjdGVkRGF0YSA9IGRlc2NyaXB0b3IubWF0Y2gob3B0cywgZGF0YSk7XG4gICAgICAgICAgICAgICAgaWYgKGV4dHJhY3RlZERhdGEpIHtcbiAgICAgICAgICAgICAgICAgICAgbWF0Y2hlZERlc2NyaXB0b3IgPSBkZXNjcmlwdG9yO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAobWF0Y2hlZERlc2NyaXB0b3IpIHtcbiAgICAgICAgICAgICAgICBpZiAoTG9nZ2VyLnRyYWNlLmlzRW5hYmxlZCkge1xuICAgICAgICAgICAgICAgICAgICBMb2dnZXIudHJhY2UoJ01vZGVsIF9jb25zdHJ1Y3RTdWJPcGVyYXRpb24gZGF0YTogJyArIHV0aWwucHJldHR5UHJpbnQoZXh0cmFjdGVkRGF0YSkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mKGV4dHJhY3RlZERhdGEpID09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBtYXBwaW5nID0gbWF0Y2hlZERlc2NyaXB0b3IubW9kZWw7XG4gICAgICAgICAgICAgICAgICAgIG1hcHBpbmcubWFwKGV4dHJhY3RlZERhdGEsIHtvdmVycmlkZTogb3B0cy5vYmp9LCBmdW5jdGlvbiAoZXJyLCBvYmopIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjYWxsYmFjaykge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyLCBvYmosIHJlc3ApO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgeyAvLyBNYXRjaGVkLCBidXQgbm8gZGF0YS5cbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2sobnVsbCwgdHJ1ZSwgcmVzcCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmIChjYWxsYmFjaykge1xuICAgICAgICAgICAgICAgIGlmIChuYW1lKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBlcnIgPSB7fTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGNvZGUgPSBlcnJvci5FcnJvckNvZGUuTm9EZXNjcmlwdG9yTWF0Y2hlZDtcbiAgICAgICAgICAgICAgICAgICAgZXJyW2Vycm9yLkVycm9yRmllbGQuQ29kZV0gPSBjb2RlO1xuICAgICAgICAgICAgICAgICAgICBlcnJbZXJyb3IuRXJyb3JGaWVsZC5NZXNzYWdlXSA9IGVycm9yLk1lc3NhZ2VbY29kZV07XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVyciwgbnVsbCwgcmVzcCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gVGhlcmUgd2FzIGEgYnVnIHdoZXJlIGNvbGxlY3Rpb24gbmFtZSBkb2Vzbid0IGV4aXN0LiBJZiB0aGlzIG9jY3VycywgdGhlbiB3aWxsIG5ldmVyIGdldCBob2xkIG9mIGFueSBkZXNjcmlwdG9ycy5cbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ1VubmFtZWQgY29sbGVjdGlvbicpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIG51bGwsIHJlc3ApO1xuICAgICAgICB9XG5cbiAgICB9O1xuICAgIG9wdHMuZXJyb3IgPSBmdW5jdGlvbiAoeGhyLCBzdGF0dXMsIGVycm9yKSB7XG4gICAgICAgIHZhciByZXNwID0ge1xuICAgICAgICAgICAgeGhyOiB4aHIsXG4gICAgICAgICAgICBzdGF0dXM6IHN0YXR1cyxcbiAgICAgICAgICAgIGVycm9yOiBlcnJvclxuICAgICAgICB9O1xuICAgICAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKHJlc3AsIG51bGwsIHJlc3ApO1xuICAgIH07XG4gICAgbG9nSHR0cFJlcXVlc3Qob3B0cyk7XG4gICAgc2llc3RhLmV4dC5odHRwLmFqYXgob3B0cyk7XG4gICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG59XG5cbmZ1bmN0aW9uIF9zZXJpYWxpc2VPYmplY3Qob3B0cywgb2JqLCBjYikge1xuICAgIHRoaXMuX3NlcmlhbGlzZShvYmosIGZ1bmN0aW9uIChlcnIsIGRhdGEpIHtcbiAgICAgICAgdmFyIHJldERhdGEgPSBkYXRhO1xuICAgICAgICBpZiAob3B0cy5maWVsZHMpIHtcbiAgICAgICAgICAgIHJldERhdGEgPSB7fTtcbiAgICAgICAgICAgIF8uZWFjaChvcHRzLmZpZWxkcywgZnVuY3Rpb24gKGYpIHtcbiAgICAgICAgICAgICAgICByZXREYXRhW2ZdID0gZGF0YVtmXTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGNiKGVyciwgcmV0RGF0YSk7XG4gICAgfSk7XG59XG5cbi8qKlxuICogU2VuZCBhIEhUVFAgcmVxdWVzdCB0byB0aGUgZ2l2ZW4gbWV0aG9kIGFuZCBwYXRoXG4gKiBAcGFyYW0ge1N0cmluZ30gbWV0aG9kXG4gKiBAcGFyYW0ge1N0cmluZ30gcGF0aCBUaGUgcGF0aCB0byB0aGUgcmVzb3VyY2Ugd2Ugd2FudCB0byBHRVRcbiAqIEBwYXJhbSB7TW9kZWxJbnN0YW5jZX0gb2JqZWN0IFRoZSBtb2RlbCB3ZSdyZSBwdXNoaW5nIHRvIHRoZSBzZXJ2ZXJcbiAqIEBwYXJhbSB7T2JqZWN0fEZ1bmN0aW9ufSBvcHRzT3JDYWxsYmFjayBFaXRoZXIgYW4gb3B0aW9ucyBvYmplY3Qgb3IgYSBjYWxsYmFjayBpZiBjYW4gdXNlIGRlZmF1bHRzXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBDYWxsYmFjayBpZiBvcHRzIHNwZWNpZmllZC5cbiAqL1xuZnVuY3Rpb24gX2h0dHBSZXF1ZXN0KG1ldGhvZCwgcGF0aCwgb2JqZWN0KSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAzKTtcbiAgICB2YXIgY2FsbGJhY2s7XG4gICAgdmFyIG9wdHMgPSB7fTtcbiAgICBpZiAodHlwZW9mKGFyZ3NbMF0pID09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgY2FsbGJhY2sgPSBhcmdzWzBdO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mKGFyZ3NbMF0pID09ICdvYmplY3QnKSB7XG4gICAgICAgIG9wdHMgPSBhcmdzWzBdO1xuICAgICAgICBjYWxsYmFjayA9IGFyZ3NbMV07XG4gICAgfVxuICAgIHZhciBkZWZlcnJlZCA9IHV0aWwuZGVmZXIoY2FsbGJhY2spO1xuICAgIGNhbGxiYWNrID0gZGVmZXJyZWQuZmluaXNoLmJpbmQoZGVmZXJyZWQpO1xuICAgIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmdzLCAyKTtcbiAgICB2YXIgcmVxdWVzdERlc2NyaXB0b3JzID0gRGVzY3JpcHRvclJlZ2lzdHJ5LnJlcXVlc3REZXNjcmlwdG9yc0ZvckNvbGxlY3Rpb24odGhpcyk7XG4gICAgdmFyIG1hdGNoZWREZXNjcmlwdG9yO1xuICAgIG9wdHMudHlwZSA9IG1ldGhvZDtcbiAgICB2YXIgYmFzZVVSTCA9IHRoaXMuYmFzZVVSTDtcbiAgICBvcHRzLnVybCA9IGJhc2VVUkwgKyBwYXRoO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcmVxdWVzdERlc2NyaXB0b3JzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciByZXF1ZXN0RGVzY3JpcHRvciA9IHJlcXVlc3REZXNjcmlwdG9yc1tpXTtcbiAgICAgICAgaWYgKHJlcXVlc3REZXNjcmlwdG9yLl9tYXRjaENvbmZpZyhvcHRzKSkge1xuICAgICAgICAgICAgbWF0Y2hlZERlc2NyaXB0b3IgPSByZXF1ZXN0RGVzY3JpcHRvcjtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgfVxuICAgIGlmIChtYXRjaGVkRGVzY3JpcHRvcikge1xuICAgICAgICBpZiAoTG9nZ2VyLnRyYWNlLmlzRW5hYmxlZClcbiAgICAgICAgICAgIExvZ2dlci50cmFjZSgnTWF0Y2hlZCBkZXNjcmlwdG9yOiAnICsgbWF0Y2hlZERlc2NyaXB0b3IuX2R1bXAodHJ1ZSkpO1xuICAgICAgICBfc2VyaWFsaXNlT2JqZWN0LmNhbGwobWF0Y2hlZERlc2NyaXB0b3IsIG9iamVjdCwgb3B0cywgZnVuY3Rpb24gKGVyciwgZGF0YSkge1xuICAgICAgICAgICAgaWYgKExvZ2dlci50cmFjZS5pc0VuYWJsZWQpXG4gICAgICAgICAgICAgICAgTG9nZ2VyLnRyYWNlKCdfc2VyaWFsaXNlJywge1xuICAgICAgICAgICAgICAgICAgICBlcnI6IGVycixcbiAgICAgICAgICAgICAgICAgICAgZGF0YTogZGF0YVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2soZXJyLCBudWxsLCBudWxsKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgb3B0cy5kYXRhID0gZGF0YTtcbiAgICAgICAgICAgICAgICBvcHRzLm9iaiA9IG9iamVjdDtcbiAgICAgICAgICAgICAgICBfLnBhcnRpYWwoX2h0dHBSZXNwb25zZSwgbWV0aG9kLCBwYXRoLCBvcHRzLCBjYWxsYmFjaykuYXBwbHkoc2VsZiwgYXJncyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgfSBlbHNlIGlmIChjYWxsYmFjaykge1xuICAgICAgICBpZiAoTG9nZ2VyLnRyYWNlLmlzRW5hYmxlZClcbiAgICAgICAgICAgIExvZ2dlci50cmFjZSgnRGlkIG5vdCBtYXRjaCBkZXNjcmlwdG9yJyk7XG4gICAgICAgIGNhbGxiYWNrKCdObyBkZXNjcmlwdG9yIG1hdGNoZWQnLCBudWxsLCBudWxsKTtcbiAgICB9XG4gICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG59XG5cbi8qKlxuICogU2VuZCBhIERFTEVURSByZXF1ZXN0LiBBbHNvIHJlbW92ZXMgdGhlIG9iamVjdC5cbiAqIEBwYXJhbSB7U3RyaW5nfSBwYXRoIFRoZSBwYXRoIHRvIHRoZSByZXNvdXJjZSB0byB3aGljaCB3ZSB3YW50IHRvIERFTEVURVxuICogQHBhcmFtIHtNb2RlbEluc3RhbmNlfSBvYmplY3QgVGhlIG1vZGVsIHRoYXQgd2Ugd291bGQgbGlrZSB0byBQQVRDSFxuICogQHJldHVybnMge1Byb21pc2V9XG4gKi9cbmZ1bmN0aW9uIERFTEVURShwYXRoLCBvYmplY3QpIHtcbiAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMik7XG4gICAgdmFyIG9wdHMgPSB7fTtcbiAgICB2YXIgY2FsbGJhY2s7XG4gICAgaWYgKHR5cGVvZihhcmdzWzBdKSA9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIGNhbGxiYWNrID0gYXJnc1swXTtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZihhcmdzWzBdKSA9PSAnb2JqZWN0Jykge1xuICAgICAgICBvcHRzID0gYXJnc1swXTtcbiAgICAgICAgY2FsbGJhY2sgPSBhcmdzWzFdO1xuICAgIH1cbiAgICB2YXIgZGVmZXJyZWQgPSB1dGlsLmRlZmVyKGNhbGxiYWNrKTtcbiAgICB2YXIgZGVsZXRpb25Nb2RlID0gb3B0cy5kZWxldGlvbk1vZGUgfHwgJ3Jlc3RvcmUnO1xuICAgIC8vIEJ5IGRlZmF1bHQgd2UgZG8gbm90IG1hcCB0aGUgcmVzcG9uc2UgZnJvbSBhIERFTEVURSByZXF1ZXN0LlxuICAgIGlmIChvcHRzLnBhcnNlUmVzcG9uc2UgPT09IHVuZGVmaW5lZCkgb3B0cy5wYXJzZVJlc3BvbnNlID0gZmFsc2U7XG4gICAgX2h0dHBSZXNwb25zZS5jYWxsKHRoaXMsICdERUxFVEUnLCBwYXRoLCBvcHRzLCBmdW5jdGlvbiAoZXJyLCB4LCB5LCB6KSB7XG4gICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgIGlmIChkZWxldGlvbk1vZGUgPT0gJ3Jlc3RvcmUnKSB7XG4gICAgICAgICAgICAgICAgb2JqZWN0LnJlc3RvcmUoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChkZWxldGlvbk1vZGUgPT0gJ3N1Y2Nlc3MnKSB7XG4gICAgICAgICAgICBvYmplY3QucmVtb3ZlKCk7XG4gICAgICAgIH1cbiAgICAgICAgY2FsbGJhY2soZXJyLCB4LCB5LCB6KTtcbiAgICAgICAgZGVmZXJyZWQuZmluaXNoKGVyciwge3g6IHgsIHk6IHksIHo6en0pO1xuICAgIH0pO1xuICAgIGlmIChkZWxldGlvbk1vZGUgPT0gJ25vdycgfHwgZGVsZXRpb25Nb2RlID09ICdyZXN0b3JlJykge1xuICAgICAgICBvYmplY3QucmVtb3ZlKCk7XG4gICAgfVxuICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xufVxuXG4vKipcbiAqIFNlbmQgYSBIVFRQIHJlcXVlc3QgdXNpbmcgdGhlIGdpdmVuIG1ldGhvZFxuICogQHBhcmFtIHJlcXVlc3QgRG9lcyB0aGUgcmVxdWVzdCBjb250YWluIGRhdGE/IGUuZy4gUE9TVC9QQVRDSC9QVVQgd2lsbCBiZSB0cnVlLCBHRVQgd2lsbCBmYWxzZVxuICogQHBhcmFtIG1ldGhvZFxuICogQGludGVybmFsXG4gKiBAcmV0dXJucyB7UHJvbWlzZX1cbiAqL1xuZnVuY3Rpb24gSFRUUF9NRVRIT0QocmVxdWVzdCwgbWV0aG9kKSB7XG4gICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDIpO1xuICAgIHJldHVybiBfLnBhcnRpYWwocmVxdWVzdCA/IF9odHRwUmVxdWVzdCA6IF9odHRwUmVzcG9uc2UsIG1ldGhvZCkuYXBwbHkodGhpcywgYXJncyk7XG59XG5cbi8qKlxuICogU2VuZCBhIEdFVCByZXF1ZXN0XG4gKiBAcGFyYW0ge1N0cmluZ30gcGF0aCBUaGUgcGF0aCB0byB0aGUgcmVzb3VyY2Ugd2Ugd2FudCB0byBHRVRcbiAqIEBwYXJhbSB7T2JqZWN0fEZ1bmN0aW9ufSBvcHRzT3JDYWxsYmFjayBFaXRoZXIgYW4gb3B0aW9ucyBvYmplY3Qgb3IgYSBjYWxsYmFjayBpZiBjYW4gdXNlIGRlZmF1bHRzXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBDYWxsYmFjayBpZiBvcHRzIHNwZWNpZmllZC5cbiAqIEBwYWNrYWdlIEhUVFBcbiAqIEByZXR1cm5zIHtQcm9taXNlfVxuICovXG5mdW5jdGlvbiBHRVQoKSB7XG4gICAgcmV0dXJuIF8ucGFydGlhbChIVFRQX01FVEhPRCwgZmFsc2UsICdHRVQnKS5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xufVxuXG4vKipcbiAqIFNlbmQgYW4gT1BUSU9OUyByZXF1ZXN0XG4gKiBAcGFyYW0ge1N0cmluZ30gcGF0aCBUaGUgcGF0aCB0byB0aGUgcmVzb3VyY2Ugd2Ugd2FudCB0byBHRVRcbiAqIEBwYXJhbSB7T2JqZWN0fEZ1bmN0aW9ufSBvcHRzT3JDYWxsYmFjayBFaXRoZXIgYW4gb3B0aW9ucyBvYmplY3Qgb3IgYSBjYWxsYmFjayBpZiBjYW4gdXNlIGRlZmF1bHRzXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBDYWxsYmFjayBpZiBvcHRzIHNwZWNpZmllZC5cbiAqIEBwYWNrYWdlIEhUVFBcbiAqIEByZXR1cm5zIHtQcm9taXNlfVxuICovXG5mdW5jdGlvbiBPUFRJT05TKCkge1xuICAgIHJldHVybiBfLnBhcnRpYWwoSFRUUF9NRVRIT0QsIGZhbHNlLCAnT1BUSU9OUycpLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG59XG5cbi8qKlxuICogU2VuZCBhbiBUUkFDRSByZXF1ZXN0XG4gKiBAcGFyYW0ge1N0cmluZ30gcGF0aCBUaGUgcGF0aCB0byB0aGUgcmVzb3VyY2Ugd2Ugd2FudCB0byBHRVRcbiAqIEBwYXJhbSB7T2JqZWN0fEZ1bmN0aW9ufSBvcHRzT3JDYWxsYmFjayBFaXRoZXIgYW4gb3B0aW9ucyBvYmplY3Qgb3IgYSBjYWxsYmFjayBpZiBjYW4gdXNlIGRlZmF1bHRzXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBDYWxsYmFjayBpZiBvcHRzIHNwZWNpZmllZC5cbiAqIEBwYWNrYWdlIEhUVFBcbiAqIEByZXR1cm5zIHtQcm9taXNlfVxuICovXG5mdW5jdGlvbiBUUkFDRSgpIHtcbiAgICByZXR1cm4gXy5wYXJ0aWFsKEhUVFBfTUVUSE9ELCBmYWxzZSwgJ1RSQUNFJykuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbn1cblxuLyoqXG4gKiBTZW5kIGFuIEhFQUQgcmVxdWVzdFxuICogQHBhcmFtIHtTdHJpbmd9IHBhdGggVGhlIHBhdGggdG8gdGhlIHJlc291cmNlIHdlIHdhbnQgdG8gR0VUXG4gKiBAcGFyYW0ge09iamVjdHxGdW5jdGlvbn0gb3B0c09yQ2FsbGJhY2sgRWl0aGVyIGFuIG9wdGlvbnMgb2JqZWN0IG9yIGEgY2FsbGJhY2sgaWYgY2FuIHVzZSBkZWZhdWx0c1xuICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgQ2FsbGJhY2sgaWYgb3B0cyBzcGVjaWZpZWQuXG4gKiBAcGFja2FnZSBIVFRQXG4gKiBAcmV0dXJucyB7UHJvbWlzZX1cbiAqL1xuZnVuY3Rpb24gSEVBRCgpIHtcbiAgICByZXR1cm4gXy5wYXJ0aWFsKEhUVFBfTUVUSE9ELCBmYWxzZSwgJ0hFQUQnKS5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xufVxuXG4vKipcbiAqIFNlbmQgYW4gUE9TVCByZXF1ZXN0XG4gKiBAcGFyYW0ge1N0cmluZ30gcGF0aCBUaGUgcGF0aCB0byB0aGUgcmVzb3VyY2Ugd2Ugd2FudCB0byBHRVRcbiAqIEBwYXJhbSB7TW9kZWxJbnN0YW5jZX0gbW9kZWwgVGhlIG1vZGVsIHRoYXQgd2Ugd291bGQgbGlrZSB0byBQT1NUXG4gKiBAcGFyYW0ge09iamVjdHxGdW5jdGlvbn0gb3B0c09yQ2FsbGJhY2sgRWl0aGVyIGFuIG9wdGlvbnMgb2JqZWN0IG9yIGEgY2FsbGJhY2sgaWYgY2FuIHVzZSBkZWZhdWx0c1xuICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgQ2FsbGJhY2sgaWYgb3B0cyBzcGVjaWZpZWQuXG4gKiBAcGFja2FnZSBIVFRQXG4gKiBAcmV0dXJucyB7UHJvbWlzZX1cbiAqL1xuZnVuY3Rpb24gUE9TVCgpIHtcbiAgICByZXR1cm4gXy5wYXJ0aWFsKEhUVFBfTUVUSE9ELCB0cnVlLCAnUE9TVCcpLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG59XG5cbi8qKlxuICogU2VuZCBhbiBQVVQgcmVxdWVzdFxuICogQHBhcmFtIHtTdHJpbmd9IHBhdGggVGhlIHBhdGggdG8gdGhlIHJlc291cmNlIHdlIHdhbnQgdG8gR0VUXG4gKiBAcGFyYW0ge01vZGVsSW5zdGFuY2V9IG1vZGVsIFRoZSBtb2RlbCB0aGF0IHdlIHdvdWxkIGxpa2UgdG8gUE9TVFxuICogQHBhcmFtIHtPYmplY3R8RnVuY3Rpb259IG9wdHNPckNhbGxiYWNrIEVpdGhlciBhbiBvcHRpb25zIG9iamVjdCBvciBhIGNhbGxiYWNrIGlmIGNhbiB1c2UgZGVmYXVsdHNcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIENhbGxiYWNrIGlmIG9wdHMgc3BlY2lmaWVkLlxuICogQHBhY2thZ2UgSFRUUFxuICogQHJldHVybnMge1Byb21pc2V9XG4gKi9cbmZ1bmN0aW9uIFBVVCgpIHtcbiAgICByZXR1cm4gXy5wYXJ0aWFsKEhUVFBfTUVUSE9ELCB0cnVlLCAnUFVUJykuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbn1cblxuLyoqXG4gKiBTZW5kIGFuIFBBVENIIHJlcXVlc3RcbiAqIEBwYXJhbSB7U3RyaW5nfSBwYXRoIFRoZSBwYXRoIHRvIHRoZSByZXNvdXJjZSB3ZSB3YW50IHRvIEdFVFxuICogQHBhcmFtIHtNb2RlbEluc3RhbmNlfSBtb2RlbCBUaGUgbW9kZWwgdGhhdCB3ZSB3b3VsZCBsaWtlIHRvIFBPU1RcbiAqIEBwYXJhbSB7T2JqZWN0fEZ1bmN0aW9ufSBvcHRzT3JDYWxsYmFjayBFaXRoZXIgYW4gb3B0aW9ucyBvYmplY3Qgb3IgYSBjYWxsYmFjayBpZiBjYW4gdXNlIGRlZmF1bHRzXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBDYWxsYmFjayBpZiBvcHRzIHNwZWNpZmllZC5cbiAqIEBwYWNrYWdlIEhUVFBcbiAqIEByZXR1cm5zIHtQcm9taXNlfVxuICovXG5mdW5jdGlvbiBQQVRDSCgpIHtcbiAgICByZXR1cm4gXy5wYXJ0aWFsKEhUVFBfTUVUSE9ELCB0cnVlLCAnUEFUQ0gnKS5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xufVxuXG5cbnZhciBodHRwID0ge1xuICAgIFJlcXVlc3REZXNjcmlwdG9yOiByZXF1aXJlKCcuL3JlcXVlc3REZXNjcmlwdG9yJykuUmVxdWVzdERlc2NyaXB0b3IsXG4gICAgUmVzcG9uc2VEZXNjcmlwdG9yOiByZXF1aXJlKCcuL3Jlc3BvbnNlRGVzY3JpcHRvcicpLlJlc3BvbnNlRGVzY3JpcHRvcixcbiAgICBEZXNjcmlwdG9yOiBkZXNjcmlwdG9yLkRlc2NyaXB0b3IsXG4gICAgX3Jlc29sdmVNZXRob2Q6IGRlc2NyaXB0b3IucmVzb2x2ZU1ldGhvZCxcbiAgICBTZXJpYWxpc2VyOiByZXF1aXJlKCcuL3NlcmlhbGlzZXInKSxcbiAgICBEZXNjcmlwdG9yUmVnaXN0cnk6IHJlcXVpcmUoJy4vZGVzY3JpcHRvclJlZ2lzdHJ5JykuRGVzY3JpcHRvclJlZ2lzdHJ5LFxuICAgIF9odHRwUmVzcG9uc2U6IF9odHRwUmVzcG9uc2UsXG4gICAgX2h0dHBSZXF1ZXN0OiBfaHR0cFJlcXVlc3QsXG4gICAgREVMRVRFOiBERUxFVEUsXG4gICAgSFRUUF9NRVRIT0Q6IEhUVFBfTUVUSE9ELFxuICAgIEdFVDogR0VULFxuICAgIFRSQUNFOiBUUkFDRSxcbiAgICBPUFRJT05TOiBPUFRJT05TLFxuICAgIEhFQUQ6IEhFQUQsXG4gICAgUE9TVDogUE9TVCxcbiAgICBQVVQ6IFBVVCxcbiAgICBQQVRDSDogUEFUQ0gsXG4gICAgX3NlcmlhbGlzZU9iamVjdDogX3NlcmlhbGlzZU9iamVjdCxcbiAgICBQYWdpbmF0b3I6IHJlcXVpcmUoJy4vcGFnaW5hdG9yJylcbn07XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShodHRwLCAnYWpheCcsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIGEgPSBhamF4IHx8ICgkID8gJC5hamF4IDogbnVsbCkgfHwgKGpRdWVyeSA/IGpRdWVyeS5hamF4IDogbnVsbCk7XG4gICAgICAgIGlmICghYSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ2FqYXggaGFzIG5vdCBiZWVuIGRlZmluZWQgYW5kIGNvdWxkIG5vdCBmaW5kICQuYWpheCBvciBqUXVlcnkuYWpheCcpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBhO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbiAodikge1xuICAgICAgICBhamF4ID0gdjtcbiAgICB9XG59KTtcblxuXy5leHRlbmQoQ29sbGVjdGlvbi5wcm90b3R5cGUsIHtcbiAgICBERUxFVEU6IERFTEVURSxcbiAgICBHRVQ6IEdFVCxcbiAgICBUUkFDRTogVFJBQ0UsXG4gICAgT1BUSU9OUzogT1BUSU9OUyxcbiAgICBIRUFEOiBIRUFELFxuICAgIFBPU1Q6IFBPU1QsXG4gICAgUFVUOiBQVVQsXG4gICAgUEFUQ0g6IFBBVENIXG59KTtcblxuaWYgKCFzaWVzdGEuZXh0KSBzaWVzdGEuZXh0ID0ge307XG5zaWVzdGEuZXh0Lmh0dHAgPSBodHRwO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydGllcyhzaWVzdGEuZXh0LCB7XG4gICAgaHR0cEVuYWJsZWQ6IHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBpZiAoc2llc3RhLmV4dC5faHR0cEVuYWJsZWQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBzaWVzdGEuZXh0Ll9odHRwRW5hYmxlZDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiAhIXNpZXN0YS5leHQuaHR0cDtcbiAgICAgICAgfSxcbiAgICAgICAgc2V0OiBmdW5jdGlvbiAodikge1xuICAgICAgICAgICAgc2llc3RhLmV4dC5faHR0cEVuYWJsZWQgPSB2O1xuICAgICAgICB9LFxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlXG4gICAgfVxufSk7XG5cbnZhciBhamF4LCBzZXJpYWxpc2VycyA9IHt9O1xuXG5fLmV4dGVuZChzaWVzdGEsIHtcbiAgICBzZXRBamF4OiBmdW5jdGlvbiAoX2FqYXgpIHtcbiAgICAgICAgYWpheCA9IF9hamF4O1xuICAgIH0sXG4gICAgZ2V0QWpheDogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gc2llc3RhLmV4dC5odHRwLmFqYXg7XG4gICAgfSxcbiAgICBzZXJpYWxpc2Vyczogc2VyaWFsaXNlcnMsXG4gICAgc2VyaWFsaXplcnM6IHNlcmlhbGlzZXJzXG59KTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnRpZXMoc2VyaWFsaXNlcnMsIHtcbiAgICBpZDoge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGlmIChzaWVzdGEuZXh0Lmh0dHBFbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHNpZXN0YS5leHQuaHR0cC5TZXJpYWxpc2VyLmlkU2VyaWFsaXNlcjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgfSxcbiAgICBkZXB0aDoge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGlmIChzaWVzdGEuZXh0Lmh0dHBFbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHNpZXN0YS5leHQuaHR0cC5TZXJpYWxpc2VyLmRlcHRoU2VyaWFsaXplcjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgfVxufSk7XG5cbmlmICh0eXBlb2YgbW9kdWxlICE9ICd1bmRlZmluZWQnKSBtb2R1bGUuZXhwb3J0cyA9IGh0dHA7XG4iLCJ2YXIgX2ludGVybmFsID0gc2llc3RhLl9pbnRlcm5hbCxcbiAgICBsb2cgPSBfaW50ZXJuYWwubG9nLFxuICAgIEludGVybmFsU2llc3RhRXJyb3IgPSBfaW50ZXJuYWwuZXJyb3IuSW50ZXJuYWxTaWVzdGFFcnJvcixcbiAgICB1dGlsID0gX2ludGVybmFsLnV0aWwsXG4gICAgXyA9IHV0aWwuXztcblxudmFyIHF1ZXJ5c3RyaW5nID0gcmVxdWlyZSgncXVlcnlzdHJpbmcnKTtcblxuZnVuY3Rpb24gUGFnaW5hdG9yKG9wdHMpIHtcbiAgICB0aGlzLm9wdHMgPSB7fTtcbiAgICB1dGlsLmV4dGVuZEZyb21PcHRzKHRoaXMub3B0cywgb3B0cywge1xuICAgICAgICBwYXRoOiAnLycsXG4gICAgICAgIG1vZGVsOiBudWxsLFxuICAgICAgICBwYWdlOiAncGFnZScsXG4gICAgICAgIHF1ZXJ5UGFyYW1zOiB0cnVlLFxuICAgICAgICBwYWdlU2l6ZTogJ3BhZ2VTaXplJyxcbiAgICAgICAgbnVtUGFnZXM6ICdudW1QYWdlcycsXG4gICAgICAgIGRhdGFQYXRoOiAnZGF0YScsXG4gICAgICAgIGNvdW50OiAnY291bnQnLFxuICAgICAgICB0eXBlOiAnR0VUJyxcbiAgICAgICAgZGF0YVR5cGU6ICdqc29uJ1xuICAgIH0sIGZhbHNlKTtcbiAgICBfLmV4dGVuZCh0aGlzLCB7XG4gICAgICAgIG51bVBhZ2VzOiBudWxsLFxuICAgICAgICBjb3VudDogbnVsbFxuICAgIH0pO1xuXG4gICAgdGhpcy52YWxpZGF0ZSgpO1xufVxuXG5fLmV4dGVuZChQYWdpbmF0b3IucHJvdG90eXBlLCB7XG4gICAgX2V4dHJhY3Q6IGZ1bmN0aW9uIChwYXRoLCBkYXRhLCBqcVhIUikge1xuICAgICAgICBpZiAocGF0aCkge1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBwYXRoID09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgICAgICBkYXRhID0gcGF0aChkYXRhLCBqcVhIUik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICB2YXIgc3BsdCA9IHBhdGguc3BsaXQoJy4nKTtcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHNwbHQubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGtleSA9IHNwbHRbaV07XG4gICAgICAgICAgICAgICAgICAgIGRhdGEgPSBkYXRhW2tleV07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBkYXRhO1xuICAgIH0sXG4gICAgX2V4dHJhY3REYXRhOiBmdW5jdGlvbiAoZGF0YSwganFYSFIpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2V4dHJhY3QodGhpcy5vcHRzLmRhdGFQYXRoLCBkYXRhLCBqcVhIUik7XG4gICAgfSxcbiAgICBfZXh0cmFjdE51bVBhZ2VzOiBmdW5jdGlvbiAoZGF0YSwganFYSFIpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2V4dHJhY3QodGhpcy5vcHRzLm51bVBhZ2VzLCBkYXRhLCBqcVhIUik7XG4gICAgfSxcbiAgICBfZXh0cmFjdENvdW50OiBmdW5jdGlvbiAoZGF0YSwganFYSFIpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2V4dHJhY3QodGhpcy5vcHRzLmNvdW50LCBkYXRhLCBqcVhIUik7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiB2YXIgcGFyc2VyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYScpO1xuICAgICAqIHBhcnNlci5ocmVmID0gXCJodHRwOi8vZXhhbXBsZS5jb206MzAwMC9wYXRobmFtZS8/c2VhcmNoPXRlc3QjaGFzaFwiO1xuICAgICAqIHBhcnNlci5ocmVmID0gVVJMO1xuICAgICAqIHBhcnNlci5wcm90b2NvbDsgLy8gPT4gXCJodHRwOlwiXG4gICAgICogcGFyc2VyLmhvc3RuYW1lOyAvLyA9PiBcImV4YW1wbGUuY29tXCJcbiAgICAgKiBwYXJzZXIucG9ydDsgICAgIC8vID0+IFwiMzAwMFwiXG4gICAgICogcGFyc2VyLnBhdGhuYW1lOyAvLyA9PiBcIi9wYXRobmFtZS9cIlxuICAgICAqIHBhcnNlci5zZWFyY2g7ICAgLy8gPT4gXCI/c2VhcmNoPXRlc3RcIlxuICAgICAqIHBhcnNlci5oYXNoOyAgICAgLy8gPT4gXCIjaGFzaFwiXG4gICAgICogcGFyc2VyLmhvc3Q7ICAgICAvLyA9PiBcImV4YW1wbGUuY29tOjMwMDBcIlxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBVUkxcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9wYXJzZVVSTDogZnVuY3Rpb24gKFVSTCkge1xuICAgICAgICB2YXIgcGFyc2VyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYScpO1xuICAgICAgICBwYXJzZXIuaHJlZiA9IFVSTDtcbiAgICAgICAgcmV0dXJuIHBhcnNlcjtcbiAgICB9LFxuICAgIHBhZ2U6IGZ1bmN0aW9uIChvcHRzT3JDYWxsYmFjaywgY2FsbGJhY2spIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICB2YXIgb3B0cyA9IHt9O1xuICAgICAgICBpZiAodHlwZW9mIG9wdHNPckNhbGxiYWNrID09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIGNhbGxiYWNrID0gb3B0c09yQ2FsbGJhY2s7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAob3B0c09yQ2FsbGJhY2spIHtcbiAgICAgICAgICAgIG9wdHMgPSBvcHRzT3JDYWxsYmFjaztcbiAgICAgICAgfVxuICAgICAgICB2YXIgZGVmZXJyZWQgPSB1dGlsLmRlZmVyKGNhbGxiYWNrKTtcbiAgICAgICAgdmFyIHBhZ2UgPSBvcHRzLnBhZ2UsXG4gICAgICAgICAgICBwYWdlU2l6ZSA9IG9wdHMucGFnZVNpemU7XG4gICAgICAgIGNhbGxiYWNrID0gZGVmZXJyZWQuZmluaXNoLmJpbmQoZGVmZXJyZWQpO1xuICAgICAgICB2YXIgYWpheCA9IHNpZXN0YS5leHQuaHR0cC5hamF4LFxuICAgICAgICAgICAgYWpheE9wdHMgPSBfLmV4dGVuZCh7fSwgdGhpcy5vcHRzKTtcbiAgICAgICAgdmFyIGNvbGxlY3Rpb24gPSB0aGlzLm9wdHMubW9kZWwuY29sbGVjdGlvbixcbiAgICAgICAgICAgIHVybCA9IGNvbGxlY3Rpb24uYmFzZVVSTCArIHRoaXMub3B0cy5wYXRoO1xuICAgICAgICBpZiAodGhpcy5vcHRzLnF1ZXJ5UGFyYW1zKSB7XG4gICAgICAgICAgICB2YXIgcGFyc2VyID0gdGhpcy5fcGFyc2VVUkwodXJsKTtcbiAgICAgICAgICAgIHZhciByYXdRdWVyeSA9IHBhcnNlci5zZWFyY2gsXG4gICAgICAgICAgICAgICAgcmF3UXVlcnlTcGx0ID0gcmF3UXVlcnkuc3BsaXQoJz8nKTtcbiAgICAgICAgICAgIGlmIChyYXdRdWVyeVNwbHQubGVuZ3RoID4gMSkgcmF3UXVlcnkgPSByYXdRdWVyeVNwbHRbMV07XG4gICAgICAgICAgICB2YXIgcXVlcnkgPSBxdWVyeXN0cmluZy5wYXJzZShyYXdRdWVyeSk7XG4gICAgICAgICAgICBpZiAocGFnZSkge1xuICAgICAgICAgICAgICAgIHF1ZXJ5W3RoaXMub3B0cy5wYWdlXSA9IHBhZ2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAocGFnZVNpemUpIHtcbiAgICAgICAgICAgICAgICBxdWVyeVt0aGlzLm9wdHMucGFnZVNpemVdID0gcGFnZVNpemU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoT2JqZWN0LmtleXMocXVlcnkpLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIHBhcnNlci5zZWFyY2ggPSAnPycgKyBxdWVyeXN0cmluZy5zdHJpbmdpZnkocXVlcnkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdXJsID0gcGFyc2VyLmhyZWY7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICB2YXIgZGF0YSA9IHt9O1xuICAgICAgICAgICAgaWYgKHBhZ2UpIHtcbiAgICAgICAgICAgICAgICBkYXRhW3RoaXMub3B0cy5wYWdlXSA9IHBhZ2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAocGFnZVNpemUpIHtcbiAgICAgICAgICAgICAgICBkYXRhW3RoaXMub3B0cy5wYWdlU2l6ZV0gPSBwYWdlU2l6ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGFqYXhPcHRzLmRhdGEgPSBkYXRhXG4gICAgICAgIH1cbiAgICAgICAgXy5leHRlbmQoYWpheE9wdHMsIHtcbiAgICAgICAgICAgIHVybDogdXJsLFxuICAgICAgICAgICAgc3VjY2VzczogZnVuY3Rpb24gKGRhdGEsIHRleHRTdGF0dXMsIGpxWEhSKSB7XG4gICAgICAgICAgICAgICAgdmFyIG1vZGVsRGF0YSA9IHNlbGYuX2V4dHJhY3REYXRhKGRhdGEsIGpxWEhSKSxcbiAgICAgICAgICAgICAgICAgICAgY291bnQgPSBzZWxmLl9leHRyYWN0Q291bnQoZGF0YSwganFYSFIpLFxuICAgICAgICAgICAgICAgICAgICBudW1QYWdlcyA9IHNlbGYuX2V4dHJhY3ROdW1QYWdlcyhkYXRhLCBqcVhIUik7XG5cbiAgICAgICAgICAgICAgICBzZWxmLm9wdHMubW9kZWwubWFwKG1vZGVsRGF0YSwgZnVuY3Rpb24gKGVyciwgbW9kZWxJbnN0YW5jZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYuY291bnQgPSBjb3VudDtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYubnVtUGFnZXMgPSBudW1QYWdlcztcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIG1vZGVsSW5zdGFuY2VzLCB7ZGF0YTogZGF0YSwgdGV4dFN0YXR1czogdGV4dFN0YXR1cywganFYSFI6IGpxWEhSfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgZmFpbDogY2FsbGJhY2tcbiAgICAgICAgfSk7XG4gICAgICAgIGFqYXgoYWpheE9wdHMpO1xuICAgICAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbiAgICB9LFxuICAgIHZhbGlkYXRlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmICghdGhpcy5vcHRzLm1vZGVsKSB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignUGFnaW5hdG9yIG11c3QgaGF2ZSBhIG1vZGVsJyk7XG4gICAgfVxufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gUGFnaW5hdG9yOyIsIi8qKlxuICogQG1vZHVsZSBodHRwXG4gKi9cblxudmFyIERlc2NyaXB0b3IgPSByZXF1aXJlKCcuL2Rlc2NyaXB0b3InKS5EZXNjcmlwdG9yLFxuICAgIFNlcmlhbGlzZXIgPSByZXF1aXJlKCcuL3NlcmlhbGlzZXInKTtcblxudmFyIF9pbnRlcm5hbCA9IHNpZXN0YS5faW50ZXJuYWwsXG4gICAgdXRpbCA9IF9pbnRlcm5hbC51dGlsLFxuICAgIF8gPSB1dGlsLl8sXG4gICAgbG9nID0gX2ludGVybmFsLmxvZyxcbiAgICBkZWZpbmVTdWJQcm9wZXJ0eSA9IHV0aWwuZGVmaW5lU3ViUHJvcGVydHlcbiAgICA7XG5cbnZhciBMb2dnZXIgPSBsb2cubG9nZ2VyV2l0aE5hbWUoJ0Rlc2NyaXB0b3InKTtcblxuLyoqXG4gKiBAY2xhc3MgRGVzY3JpYmVzIGEgSFRUUCByZXF1ZXN0XG4gKiBAcGFyYW0ge09iamVjdH0gb3B0c1xuICovXG5mdW5jdGlvbiBSZXF1ZXN0RGVzY3JpcHRvcihvcHRzKSB7XG4gICAgaWYgKCF0aGlzKSB7XG4gICAgICAgIHJldHVybiBuZXcgUmVxdWVzdERlc2NyaXB0b3Iob3B0cyk7XG4gICAgfVxuXG4gICAgRGVzY3JpcHRvci5jYWxsKHRoaXMsIG9wdHMpO1xuICAgIGlmICh0aGlzLl9vcHRzWydzZXJpYWxpemVyJ10pIHtcbiAgICAgICAgdGhpcy5fb3B0cy5zZXJpYWxpc2VyID0gdGhpcy5fb3B0c1snc2VyaWFsaXplciddO1xuICAgIH1cblxuICAgIGlmICghdGhpcy5fb3B0cy5zZXJpYWxpc2VyKSB7XG4gICAgICAgIHRoaXMuX29wdHMuc2VyaWFsaXNlciA9IFNlcmlhbGlzZXIuZGVwdGhTZXJpYWxpemVyKDApO1xuICAgIH1cblxuXG4gICAgZGVmaW5lU3ViUHJvcGVydHkuY2FsbCh0aGlzLCAnc2VyaWFsaXNlcicsIHRoaXMuX29wdHMpO1xuICAgIGRlZmluZVN1YlByb3BlcnR5LmNhbGwodGhpcywgJ3NlcmlhbGl6ZXInLCB0aGlzLl9vcHRzLCAnc2VyaWFsaXNlcicpO1xuXG59XG5cblJlcXVlc3REZXNjcmlwdG9yLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoRGVzY3JpcHRvci5wcm90b3R5cGUpO1xuXG5fLmV4dGVuZChSZXF1ZXN0RGVzY3JpcHRvci5wcm90b3R5cGUsIHtcbiAgICBfc2VyaWFsaXNlOiBmdW5jdGlvbiAob2JqLCBjYWxsYmFjaykge1xuICAgICAgICB2YXIgZGVmZXJyZWQgPSB1dGlsLmRlZmVyKGNhbGxiYWNrKTtcbiAgICAgICAgY2FsbGJhY2sgPSBkZWZlcnJlZC5maW5pc2guYmluZChkZWZlcnJlZCk7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgaWYgKExvZ2dlci50cmFjZS5pc0VuYWJsZWQpXG4gICAgICAgICAgICBMb2dnZXIudHJhY2UoJ19zZXJpYWxpc2UnKTtcbiAgICAgICAgdmFyIGZpbmlzaGVkO1xuICAgICAgICB2YXIgZGF0YSA9IHRoaXMuc2VyaWFsaXNlcihvYmosIGZ1bmN0aW9uIChlcnIsIGRhdGEpIHtcbiAgICAgICAgICAgIGlmICghZmluaXNoZWQpIHtcbiAgICAgICAgICAgICAgICBkYXRhID0gc2VsZi5fdHJhbnNmb3JtRGF0YShkYXRhKTtcbiAgICAgICAgICAgICAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKGVyciwgc2VsZi5fZW1iZWREYXRhKGRhdGEpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIGlmIChkYXRhICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKVxuICAgICAgICAgICAgICAgIExvZ2dlci50cmFjZSgnc2VyaWFsaXNlciBkb2VzbnQgdXNlIGEgY2FsbGJhY2snKTtcbiAgICAgICAgICAgIGZpbmlzaGVkID0gdHJ1ZTtcbiAgICAgICAgICAgIGRhdGEgPSBzZWxmLl90cmFuc2Zvcm1EYXRhKGRhdGEpO1xuICAgICAgICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhudWxsLCBzZWxmLl9lbWJlZERhdGEoZGF0YSkpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgaWYgKExvZ2dlci50cmFjZS5pc0VuYWJsZWQpXG4gICAgICAgICAgICAgICAgTG9nZ2VyLnRyYWNlKCdzZXJpYWxpc2VyIHVzZXMgYSBjYWxsYmFjaycsIHRoaXMuc2VyaWFsaXNlcik7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG4gICAgfSxcbiAgICBfZHVtcDogZnVuY3Rpb24gKGFzSnNvbikge1xuICAgICAgICB2YXIgb2JqID0ge307XG4gICAgICAgIG9iai5tZXRob2RzID0gdGhpcy5tZXRob2Q7XG4gICAgICAgIG9iai5tb2RlbCA9IHRoaXMubW9kZWwubmFtZTtcbiAgICAgICAgb2JqLnBhdGggPSB0aGlzLl9yYXdPcHRzLnBhdGg7XG4gICAgICAgIHZhciBzZXJpYWxpc2VyO1xuICAgICAgICBpZiAodHlwZW9mKHRoaXMuX3Jhd09wdHMuc2VyaWFsaXNlcikgPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgc2VyaWFsaXNlciA9ICdmdW5jdGlvbiAoKSB7IC4uLiB9J1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgc2VyaWFsaXNlciA9IHRoaXMuX3Jhd09wdHMuc2VyaWFsaXNlcjtcbiAgICAgICAgfVxuICAgICAgICBvYmouc2VyaWFsaXNlciA9IHNlcmlhbGlzZXI7XG4gICAgICAgIHZhciB0cmFuc2Zvcm1zID0ge307XG4gICAgICAgIGZvciAodmFyIGYgaW4gdGhpcy50cmFuc2Zvcm1zKSB7XG4gICAgICAgICAgICBpZiAodGhpcy50cmFuc2Zvcm1zLmhhc093blByb3BlcnR5KGYpKSB7XG4gICAgICAgICAgICAgICAgdmFyIHRyYW5zZm9ybSA9IHRoaXMudHJhbnNmb3Jtc1tmXTtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mKHRyYW5zZm9ybSkgPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgICAgICAgICB0cmFuc2Zvcm1zW2ZdID0gJ2Z1bmN0aW9uICgpIHsgLi4uIH0nXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0cmFuc2Zvcm1zW2ZdID0gdGhpcy50cmFuc2Zvcm1zW2ZdO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBvYmoudHJhbnNmb3JtcyA9IHRyYW5zZm9ybXM7XG4gICAgICAgIHJldHVybiBhc0pzb24gPyB1dGlsLnByZXR0eVByaW50KG9iaikgOiBvYmo7XG4gICAgfVxufSk7XG5cbmV4cG9ydHMuUmVxdWVzdERlc2NyaXB0b3IgPSBSZXF1ZXN0RGVzY3JpcHRvcjtcbiIsIi8qKlxuICogQG1vZHVsZSBodHRwXG4gKi9cblxuXG52YXIgRGVzY3JpcHRvciA9IHJlcXVpcmUoJy4vZGVzY3JpcHRvcicpLkRlc2NyaXB0b3I7XG5cbi8qKlxuICogRGVzY3JpYmVzIHdoYXQgdG8gZG8gd2l0aCBhIEhUVFAgcmVzcG9uc2UuXG4gKiBAY29uc3RydWN0b3JcbiAqIEBpbXBsZW1lbnRzIHtEZXNjcmlwdG9yfVxuICogQHBhcmFtIHtPYmplY3R9IG9wdHNcbiAqL1xuZnVuY3Rpb24gUmVzcG9uc2VEZXNjcmlwdG9yKG9wdHMpIHtcbiAgICBpZiAoIXRoaXMpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBSZXNwb25zZURlc2NyaXB0b3Iob3B0cyk7XG4gICAgfVxuICAgIERlc2NyaXB0b3IuY2FsbCh0aGlzLCBvcHRzKTtcbn1cblxuUmVzcG9uc2VEZXNjcmlwdG9yLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoRGVzY3JpcHRvci5wcm90b3R5cGUpO1xuXG5fLmV4dGVuZChSZXNwb25zZURlc2NyaXB0b3IucHJvdG90eXBlLCB7XG4gICAgX2V4dHJhY3REYXRhOiBmdW5jdGlvbiAoZGF0YSkge1xuICAgICAgICB2YXIgZXh0cmFjdGVkRGF0YSA9IERlc2NyaXB0b3IucHJvdG90eXBlLl9leHRyYWN0RGF0YS5jYWxsKHRoaXMsIGRhdGEpO1xuICAgICAgICBpZiAoZXh0cmFjdGVkRGF0YSkge1xuICAgICAgICAgICAgZXh0cmFjdGVkRGF0YSA9IHRoaXMuX3RyYW5zZm9ybURhdGEoZXh0cmFjdGVkRGF0YSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGV4dHJhY3RlZERhdGE7XG4gICAgfSxcbiAgICBfbWF0Y2hEYXRhOiBmdW5jdGlvbiAoZGF0YSkge1xuICAgICAgICB2YXIgZXh0cmFjdGVkRGF0YSA9IERlc2NyaXB0b3IucHJvdG90eXBlLl9tYXRjaERhdGEuY2FsbCh0aGlzLCBkYXRhKTtcbiAgICAgICAgaWYgKGV4dHJhY3RlZERhdGEpIHtcbiAgICAgICAgICAgIGV4dHJhY3RlZERhdGEgPSB0aGlzLl90cmFuc2Zvcm1EYXRhKGV4dHJhY3RlZERhdGEpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBleHRyYWN0ZWREYXRhO1xuICAgIH0sXG4gICAgX2R1bXA6IGZ1bmN0aW9uIChhc0pzb24pIHtcbiAgICAgICAgdmFyIG9iaiA9IHt9O1xuICAgICAgICBvYmoubWV0aG9kcyA9IHRoaXMubWV0aG9kO1xuICAgICAgICBvYmoubW9kZWwgPSB0aGlzLm1vZGVsLm5hbWU7XG4gICAgICAgIG9iai5wYXRoID0gdGhpcy5fcmF3T3B0cy5wYXRoO1xuICAgICAgICB2YXIgdHJhbnNmb3JtcyA9IHt9O1xuICAgICAgICBmb3IgKHZhciBmIGluIHRoaXMudHJhbnNmb3Jtcykge1xuICAgICAgICAgICAgaWYgKHRoaXMudHJhbnNmb3Jtcy5oYXNPd25Qcm9wZXJ0eShmKSkge1xuICAgICAgICAgICAgICAgIHZhciB0cmFuc2Zvcm0gPSB0aGlzLnRyYW5zZm9ybXNbZl07XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZih0cmFuc2Zvcm0pID09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgICAgICAgICAgdHJhbnNmb3Jtc1tmXSA9ICdmdW5jdGlvbiAoKSB7IC4uLiB9J1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdHJhbnNmb3Jtc1tmXSA9IHRoaXMudHJhbnNmb3Jtc1tmXTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgb2JqLnRyYW5zZm9ybXMgPSB0cmFuc2Zvcm1zO1xuICAgICAgICByZXR1cm4gYXNKc29uID8gdXRpbC5wcmV0dHlQcmludChvYmopIDogb2JqO1xuICAgIH1cbn0pO1xuXG5leHBvcnRzLlJlc3BvbnNlRGVzY3JpcHRvciA9IFJlc3BvbnNlRGVzY3JpcHRvcjsiLCIvKipcbiAqIEBtb2R1bGUgaHR0cFxuICovXG5cbnZhciBfaW50ZXJuYWwgPSBzaWVzdGEuX2ludGVybmFsO1xuXG52YXIgbG9nID0gX2ludGVybmFsLmxvZyxcbiAgICB1dGlscyA9IF9pbnRlcm5hbC51dGlsO1xudmFyIExvZ2dlciA9IGxvZy5sb2dnZXJXaXRoTmFtZSgnU2VyaWFsaXNhdGlvbicpO1xudmFyIF8gPSB1dGlscy5fO1xuXG5cbi8qKlxuICogU2VyaWFsaXNlcyBhbiBvYmplY3QgaW50byBpdCdzIHJlbW90ZSBpZGVudGlmaWVyIChhcyBkZWZpbmVkIGJ5IHRoZSBtYXBwaW5nKVxuICogQHBhcmFtICB7TW9kZWxJbnN0YW5jZX0gb2JqXG4gKiBAcmV0dXJuIHtTdHJpbmd9XG4gKlxuICovXG5mdW5jdGlvbiBpZFNlcmlhbGlzZXIob2JqKSB7XG4gICAgdmFyIGlkRmllbGQgPSBvYmoubW9kZWwuaWQ7XG4gICAgaWYgKGlkRmllbGQpIHtcbiAgICAgICAgcmV0dXJuIG9ialtpZEZpZWxkXSA/IG9ialtpZEZpZWxkXSA6IG51bGw7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICBpZiAoTG9nZ2VyLmRlYnVnLmlzRW5hYmxlZClcbiAgICAgICAgICAgIExvZ2dlci5kZWJ1ZygnTm8gaWRmaWVsZCcpO1xuICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cbn1cblxuLyoqXG4gKiBTZXJpYWxpc2VzIG9iaiBmb2xsb3dpbmcgcmVsYXRpb25zaGlwcyB0byBzcGVjaWZpZWQgZGVwdGguXG4gKiBAcGFyYW0gIHtJbnRlZ2VyfSAgIGRlcHRoXG4gKiBAcGFyYW0gIHtNb2RlbEluc3RhbmNlfSAgIG9ialxuICogQHBhcmFtICB7RnVuY3Rpb259IGNhbGxiYWNrXG4gKi9cbmZ1bmN0aW9uIGRlcHRoU2VyaWFsaXNlcihkZXB0aCwgb2JqLCBjYWxsYmFjaykge1xuICAgIGNhbGxiYWNrID0gY2FsbGJhY2sgfHwgZnVuY3Rpb24gKCkge307XG4gICAgaWYgKExvZ2dlci50cmFjZS5pc0VuYWJsZWQpXG4gICAgICAgIExvZ2dlci50cmFjZSgnZGVwdGhTZXJpYWxpc2VyJyk7XG4gICAgdmFyIGRhdGEgPSB7fTtcbiAgICBfLmVhY2gob2JqLl9hdHRyaWJ1dGVOYW1lcywgZnVuY3Rpb24gKGYpIHtcbiAgICAgICAgaWYgKExvZ2dlci50cmFjZS5pc0VuYWJsZWQpXG4gICAgICAgICAgICBMb2dnZXIudHJhY2UoJ2ZpZWxkJywgZik7XG4gICAgICAgIGlmIChvYmpbZl0pIHtcbiAgICAgICAgICAgIGRhdGFbZl0gPSBvYmpbZl07XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICB2YXIgd2FpdGluZyA9IFtdLFxuICAgICAgICBlcnJvcnMgPSBbXSxcbiAgICAgICAgcmVzdWx0ID0ge30sXG4gICAgICAgIGZpbmlzaGVkID0gW107XG4gICAgXy5lYWNoKG9iai5fcmVsYXRpb25zaGlwTmFtZXMsIGZ1bmN0aW9uIChmKSB7XG4gICAgICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKVxuICAgICAgICAgICAgTG9nZ2VyLnRyYWNlKCdyZWxhdGlvbnNoaXBGaWVsZCcsIGYpO1xuICAgICAgICB2YXIgcHJveHkgPSBvYmouX19wcm94aWVzW2ZdO1xuICAgICAgICBpZiAocHJveHkuaXNGb3J3YXJkKSB7IC8vIEJ5IGRlZmF1bHQgb25seSBmb3J3YXJkIHJlbGF0aW9uc2hpcHNcbiAgICAgICAgICAgIGlmIChMb2dnZXIuZGVidWcuaXNFbmFibGVkKVxuICAgICAgICAgICAgICAgIExvZ2dlci5kZWJ1ZyhmKTtcbiAgICAgICAgICAgIHdhaXRpbmcucHVzaChmKTtcbiAgICAgICAgICAgIHByb3h5LmdldChmdW5jdGlvbiAoZXJyLCB2KSB7XG4gICAgICAgICAgICAgICAgaWYgKExvZ2dlci50cmFjZS5pc0VuYWJsZWQpXG4gICAgICAgICAgICAgICAgICAgIExvZ2dlci50cmFjZSgncHJveHkuZ2V0JywgZik7XG4gICAgICAgICAgICAgICAgaWYgKExvZ2dlci5kZWJ1Zy5pc0VuYWJsZWQpXG4gICAgICAgICAgICAgICAgICAgIExvZ2dlci5kZWJ1ZyhmLCB2KTtcbiAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGVycm9ycy5wdXNoKGVycik7XG4gICAgICAgICAgICAgICAgICAgIGZpbmlzaGVkLnB1c2goZik7XG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdFtmXSA9IHtlcnI6IGVyciwgdjogdn07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2UgaWYgKHYpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFkZXB0aCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZmluaXNoZWQucHVzaChmKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRhdGFbZl0gPSB2W29iai5fX3Byb3hpZXNbZl0uZm9yd2FyZE1vZGVsLmlkXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc3VsdFtmXSA9IHtlcnI6IGVyciwgdjogdn07XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoKHdhaXRpbmcubGVuZ3RoID09IGZpbmlzaGVkLmxlbmd0aCkgJiYgY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnJvcnMubGVuZ3RoID8gZXJyb3JzIDogbnVsbCwgZGF0YSwgcmVzdWx0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlcHRoU2VyaWFsaXNlcihkZXB0aCAtIDEsIHYsIGZ1bmN0aW9uIChlcnIsIHN1YkRhdGEsIHJlc3ApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVycm9ycy5wdXNoKGVycik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkYXRhW2ZdID0gc3ViRGF0YTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZmluaXNoZWQucHVzaChmKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXN1bHRbZl0gPSB7ZXJyOiBlcnIsIHY6IHYsIHJlc3A6IHJlc3B9O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICgod2FpdGluZy5sZW5ndGggPT0gZmluaXNoZWQubGVuZ3RoKSAmJiBjYWxsYmFjaykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnJvcnMubGVuZ3RoID8gZXJyb3JzIDogbnVsbCwgZGF0YSwgcmVzdWx0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKExvZ2dlci5kZWJ1Zy5pc0VuYWJsZWQpXG4gICAgICAgICAgICAgICAgICAgICAgICBMb2dnZXIuZGVidWcoJ25vIHZhbHVlIGZvciAnICsgZik7XG4gICAgICAgICAgICAgICAgICAgIGZpbmlzaGVkLnB1c2goZik7XG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdFtmXSA9IHtlcnI6IGVyciwgdjogdn07XG4gICAgICAgICAgICAgICAgICAgIGlmICgod2FpdGluZy5sZW5ndGggPT0gZmluaXNoZWQubGVuZ3RoKSAmJiBjYWxsYmFjaykge1xuICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyb3JzLmxlbmd0aCA/IGVycm9ycyA6IG51bGwsIGRhdGEsIHJlc3VsdCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH0pO1xuICAgIGlmICghd2FpdGluZy5sZW5ndGgpIHtcbiAgICAgICAgY2FsbGJhY2sobnVsbCwgZGF0YSwge30pO1xuICAgIH1cbn1cblxuXG5leHBvcnRzLmRlcHRoU2VyaWFsaXNlciA9IGZ1bmN0aW9uIChkZXB0aCkge1xuICAgIHJldHVybiBfLnBhcnRpYWwoZGVwdGhTZXJpYWxpc2VyLCBkZXB0aCk7XG59O1xuZXhwb3J0cy5kZXB0aFNlcmlhbGl6ZXIgPSBmdW5jdGlvbiAoZGVwdGgpIHtcbiAgICByZXR1cm4gXy5wYXJ0aWFsKGRlcHRoU2VyaWFsaXNlciwgZGVwdGgpO1xufTtcbmV4cG9ydHMuaWRTZXJpYWxpemVyID0gaWRTZXJpYWxpc2VyO1xuZXhwb3J0cy5pZFNlcmlhbGlzZXIgPSBpZFNlcmlhbGlzZXI7XG5cbiIsIi8vIENvcHlyaWdodCBKb3llbnQsIEluYy4gYW5kIG90aGVyIE5vZGUgY29udHJpYnV0b3JzLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhXG4vLyBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlXG4vLyBcIlNvZnR3YXJlXCIpLCB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmdcbi8vIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCxcbi8vIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXRcbi8vIHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZVxuLy8gZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4vL1xuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWRcbi8vIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuLy9cbi8vIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1Ncbi8vIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0Zcbi8vIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU5cbi8vIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLFxuLy8gREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SXG4vLyBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFXG4vLyBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxuXG4ndXNlIHN0cmljdCc7XG5cbi8vIElmIG9iai5oYXNPd25Qcm9wZXJ0eSBoYXMgYmVlbiBvdmVycmlkZGVuLCB0aGVuIGNhbGxpbmdcbi8vIG9iai5oYXNPd25Qcm9wZXJ0eShwcm9wKSB3aWxsIGJyZWFrLlxuLy8gU2VlOiBodHRwczovL2dpdGh1Yi5jb20vam95ZW50L25vZGUvaXNzdWVzLzE3MDdcbmZ1bmN0aW9uIGhhc093blByb3BlcnR5KG9iaiwgcHJvcCkge1xuICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG9iaiwgcHJvcCk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24ocXMsIHNlcCwgZXEsIG9wdGlvbnMpIHtcbiAgc2VwID0gc2VwIHx8ICcmJztcbiAgZXEgPSBlcSB8fCAnPSc7XG4gIHZhciBvYmogPSB7fTtcblxuICBpZiAodHlwZW9mIHFzICE9PSAnc3RyaW5nJyB8fCBxcy5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4gb2JqO1xuICB9XG5cbiAgdmFyIHJlZ2V4cCA9IC9cXCsvZztcbiAgcXMgPSBxcy5zcGxpdChzZXApO1xuXG4gIHZhciBtYXhLZXlzID0gMTAwMDtcbiAgaWYgKG9wdGlvbnMgJiYgdHlwZW9mIG9wdGlvbnMubWF4S2V5cyA9PT0gJ251bWJlcicpIHtcbiAgICBtYXhLZXlzID0gb3B0aW9ucy5tYXhLZXlzO1xuICB9XG5cbiAgdmFyIGxlbiA9IHFzLmxlbmd0aDtcbiAgLy8gbWF4S2V5cyA8PSAwIG1lYW5zIHRoYXQgd2Ugc2hvdWxkIG5vdCBsaW1pdCBrZXlzIGNvdW50XG4gIGlmIChtYXhLZXlzID4gMCAmJiBsZW4gPiBtYXhLZXlzKSB7XG4gICAgbGVuID0gbWF4S2V5cztcbiAgfVxuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyArK2kpIHtcbiAgICB2YXIgeCA9IHFzW2ldLnJlcGxhY2UocmVnZXhwLCAnJTIwJyksXG4gICAgICAgIGlkeCA9IHguaW5kZXhPZihlcSksXG4gICAgICAgIGtzdHIsIHZzdHIsIGssIHY7XG5cbiAgICBpZiAoaWR4ID49IDApIHtcbiAgICAgIGtzdHIgPSB4LnN1YnN0cigwLCBpZHgpO1xuICAgICAgdnN0ciA9IHguc3Vic3RyKGlkeCArIDEpO1xuICAgIH0gZWxzZSB7XG4gICAgICBrc3RyID0geDtcbiAgICAgIHZzdHIgPSAnJztcbiAgICB9XG5cbiAgICBrID0gZGVjb2RlVVJJQ29tcG9uZW50KGtzdHIpO1xuICAgIHYgPSBkZWNvZGVVUklDb21wb25lbnQodnN0cik7XG5cbiAgICBpZiAoIWhhc093blByb3BlcnR5KG9iaiwgaykpIHtcbiAgICAgIG9ialtrXSA9IHY7XG4gICAgfSBlbHNlIGlmIChpc0FycmF5KG9ialtrXSkpIHtcbiAgICAgIG9ialtrXS5wdXNoKHYpO1xuICAgIH0gZWxzZSB7XG4gICAgICBvYmpba10gPSBbb2JqW2tdLCB2XTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gb2JqO1xufTtcblxudmFyIGlzQXJyYXkgPSBBcnJheS5pc0FycmF5IHx8IGZ1bmN0aW9uICh4cykge1xuICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHhzKSA9PT0gJ1tvYmplY3QgQXJyYXldJztcbn07XG4iLCIvLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgc3RyaW5naWZ5UHJpbWl0aXZlID0gZnVuY3Rpb24odikge1xuICBzd2l0Y2ggKHR5cGVvZiB2KSB7XG4gICAgY2FzZSAnc3RyaW5nJzpcbiAgICAgIHJldHVybiB2O1xuXG4gICAgY2FzZSAnYm9vbGVhbic6XG4gICAgICByZXR1cm4gdiA/ICd0cnVlJyA6ICdmYWxzZSc7XG5cbiAgICBjYXNlICdudW1iZXInOlxuICAgICAgcmV0dXJuIGlzRmluaXRlKHYpID8gdiA6ICcnO1xuXG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiAnJztcbiAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihvYmosIHNlcCwgZXEsIG5hbWUpIHtcbiAgc2VwID0gc2VwIHx8ICcmJztcbiAgZXEgPSBlcSB8fCAnPSc7XG4gIGlmIChvYmogPT09IG51bGwpIHtcbiAgICBvYmogPSB1bmRlZmluZWQ7XG4gIH1cblxuICBpZiAodHlwZW9mIG9iaiA9PT0gJ29iamVjdCcpIHtcbiAgICByZXR1cm4gbWFwKG9iamVjdEtleXMob2JqKSwgZnVuY3Rpb24oaykge1xuICAgICAgdmFyIGtzID0gZW5jb2RlVVJJQ29tcG9uZW50KHN0cmluZ2lmeVByaW1pdGl2ZShrKSkgKyBlcTtcbiAgICAgIGlmIChpc0FycmF5KG9ialtrXSkpIHtcbiAgICAgICAgcmV0dXJuIG1hcChvYmpba10sIGZ1bmN0aW9uKHYpIHtcbiAgICAgICAgICByZXR1cm4ga3MgKyBlbmNvZGVVUklDb21wb25lbnQoc3RyaW5naWZ5UHJpbWl0aXZlKHYpKTtcbiAgICAgICAgfSkuam9pbihzZXApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGtzICsgZW5jb2RlVVJJQ29tcG9uZW50KHN0cmluZ2lmeVByaW1pdGl2ZShvYmpba10pKTtcbiAgICAgIH1cbiAgICB9KS5qb2luKHNlcCk7XG5cbiAgfVxuXG4gIGlmICghbmFtZSkgcmV0dXJuICcnO1xuICByZXR1cm4gZW5jb2RlVVJJQ29tcG9uZW50KHN0cmluZ2lmeVByaW1pdGl2ZShuYW1lKSkgKyBlcSArXG4gICAgICAgICBlbmNvZGVVUklDb21wb25lbnQoc3RyaW5naWZ5UHJpbWl0aXZlKG9iaikpO1xufTtcblxudmFyIGlzQXJyYXkgPSBBcnJheS5pc0FycmF5IHx8IGZ1bmN0aW9uICh4cykge1xuICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHhzKSA9PT0gJ1tvYmplY3QgQXJyYXldJztcbn07XG5cbmZ1bmN0aW9uIG1hcCAoeHMsIGYpIHtcbiAgaWYgKHhzLm1hcCkgcmV0dXJuIHhzLm1hcChmKTtcbiAgdmFyIHJlcyA9IFtdO1xuICBmb3IgKHZhciBpID0gMDsgaSA8IHhzLmxlbmd0aDsgaSsrKSB7XG4gICAgcmVzLnB1c2goZih4c1tpXSwgaSkpO1xuICB9XG4gIHJldHVybiByZXM7XG59XG5cbnZhciBvYmplY3RLZXlzID0gT2JqZWN0LmtleXMgfHwgZnVuY3Rpb24gKG9iaikge1xuICB2YXIgcmVzID0gW107XG4gIGZvciAodmFyIGtleSBpbiBvYmopIHtcbiAgICBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG9iaiwga2V5KSkgcmVzLnB1c2goa2V5KTtcbiAgfVxuICByZXR1cm4gcmVzO1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxuZXhwb3J0cy5kZWNvZGUgPSBleHBvcnRzLnBhcnNlID0gcmVxdWlyZSgnLi9kZWNvZGUnKTtcbmV4cG9ydHMuZW5jb2RlID0gZXhwb3J0cy5zdHJpbmdpZnkgPSByZXF1aXJlKCcuL2VuY29kZScpO1xuIl19
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
            Model.map(data, {disableevents: true, _ignoreInstalled: true, callInit: false}, function (err, instances) {
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
                siesta._.each(results, function (r) {instances.concat(r)});
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9zdG9yYWdlL2luZGV4LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiaWYgKHR5cGVvZiBzaWVzdGEgPT0gJ3VuZGVmaW5lZCcgJiYgdHlwZW9mIG1vZHVsZSA9PSAndW5kZWZpbmVkJykge1xuICAgIHRocm93IG5ldyBFcnJvcignQ291bGQgbm90IGZpbmQgd2luZG93LnNpZXN0YS4gTWFrZSBzdXJlIHlvdSBpbmNsdWRlIHNpZXN0YS5jb3JlLmpzIGZpcnN0LicpO1xufVxuXG5cbnZhciBfaSA9IHNpZXN0YS5faW50ZXJuYWwsXG4gICAgY2FjaGUgPSBfaS5jYWNoZSxcbiAgICBDb2xsZWN0aW9uUmVnaXN0cnkgPSBfaS5Db2xsZWN0aW9uUmVnaXN0cnksXG4gICAgbG9nID0gX2kubG9nLFxuICAgIHV0aWwgPSBfaS51dGlsLFxuICAgIF8gPSB1dGlsLl8sXG4gICAgZXZlbnRzID0gX2kuZXZlbnRzO1xuXG52YXIgREJfTkFNRSA9ICdzaWVzdGEnLFxuICAgIHBvdWNoID0gbmV3IFBvdWNoREIoREJfTkFNRSk7XG5cbnZhciB1bnNhdmVkT2JqZWN0cyA9IFtdLFxuICAgIHVuc2F2ZWRPYmplY3RzSGFzaCA9IHt9LFxuICAgIHVuc2F2ZWRPYmplY3RzQnlDb2xsZWN0aW9uID0ge307XG5cbnZhciBzdG9yYWdlID0ge30sXG4gICAgTG9nZ2VyID0gbG9nLmxvZ2dlcldpdGhOYW1lKCdTdG9yYWdlJyk7XG5cblxuLyoqXG4gKiBTZXJpYWxpc2UgYSBtb2RlbCBpbnRvIGEgZm9ybWF0IHRoYXQgUG91Y2hEQiBidWxrRG9jcyBBUEkgY2FuIHByb2Nlc3NcbiAqIEBwYXJhbSB7TW9kZWxJbnN0YW5jZX0gbW9kZWxJbnN0YW5jZVxuICovXG5mdW5jdGlvbiBfc2VyaWFsaXNlKG1vZGVsSW5zdGFuY2UpIHtcbiAgICB2YXIgc2VyaWFsaXNlZCA9IHNpZXN0YS5fLmV4dGVuZCh7fSwgbW9kZWxJbnN0YW5jZS5fX3ZhbHVlcyk7XG4gICAgc2VyaWFsaXNlZFsnY29sbGVjdGlvbiddID0gbW9kZWxJbnN0YW5jZS5jb2xsZWN0aW9uTmFtZTtcbiAgICBzZXJpYWxpc2VkWydtb2RlbCddID0gbW9kZWxJbnN0YW5jZS5tb2RlbE5hbWU7XG4gICAgc2VyaWFsaXNlZFsnX2lkJ10gPSBtb2RlbEluc3RhbmNlLl9pZDtcbiAgICBpZiAobW9kZWxJbnN0YW5jZS5yZW1vdmVkKSBzZXJpYWxpc2VkWydfZGVsZXRlZCddID0gdHJ1ZTtcbiAgICB2YXIgcmV2ID0gbW9kZWxJbnN0YW5jZS5fcmV2O1xuICAgIGlmIChyZXYpIHNlcmlhbGlzZWRbJ19yZXYnXSA9IHJldjtcbiAgICBzZXJpYWxpc2VkID0gXy5yZWR1Y2UobW9kZWxJbnN0YW5jZS5fcmVsYXRpb25zaGlwTmFtZXMsIGZ1bmN0aW9uIChtZW1vLCBuKSB7XG4gICAgICAgIHZhciB2YWwgPSBtb2RlbEluc3RhbmNlW25dO1xuICAgICAgICBpZiAoc2llc3RhLmlzQXJyYXkodmFsKSkge1xuICAgICAgICAgICAgbWVtb1tuXSA9IF8ucGx1Y2sodmFsLCAnX2lkJyk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAodmFsKSB7XG4gICAgICAgICAgICBtZW1vW25dID0gdmFsLl9pZDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbWVtbztcbiAgICB9LCBzZXJpYWxpc2VkKTtcbiAgICByZXR1cm4gc2VyaWFsaXNlZDtcbn1cblxuZnVuY3Rpb24gX3ByZXBhcmVEYXR1bShkYXR1bSwgbW9kZWwpIHtcbiAgICAvLyBBZGQgYmxhbmsgb2JqZWN0IHdpdGggY29ycmVjdCBfaWQgdG8gdGhlIGNhY2hlIHNvIHRoYXQgY2FuIG1hcCBkYXRhIG9udG8gaXQuXG4gICAgZGVsZXRlIGRhdHVtLmNvbGxlY3Rpb247XG4gICAgZGVsZXRlIGRhdHVtLm1vZGVsO1xuICAgIHZhciByZWxhdGlvbnNoaXBOYW1lcyA9IG1vZGVsLl9yZWxhdGlvbnNoaXBOYW1lcztcbiAgICBfLmVhY2gocmVsYXRpb25zaGlwTmFtZXMsIGZ1bmN0aW9uIChyKSB7XG4gICAgICAgIHZhciBfaWQgPSBkYXR1bVtyXTtcbiAgICAgICAgaWYgKHNpZXN0YS5pc0FycmF5KF9pZCkpIHtcbiAgICAgICAgICAgIGRhdHVtW3JdID0gXy5tYXAoX2lkLCBmdW5jdGlvbiAoeCkgeyByZXR1cm4ge19pZDogeH19KTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGRhdHVtW3JdID0ge19pZDogX2lkfTtcbiAgICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiBkYXR1bTtcbn1cblxuLyoqXG4gKlxuICogQHBhcmFtIG9wdHNcbiAqIEBwYXJhbSBvcHRzLmNvbGxlY3Rpb25OYW1lXG4gKiBAcGFyYW0gb3B0cy5tb2RlbE5hbWVcbiAqIEBwYXJhbSBjYWxsYmFja1xuICogQHByaXZhdGVcbiAqL1xuZnVuY3Rpb24gX2xvYWRNb2RlbChvcHRzLCBjYWxsYmFjaykge1xuICAgIHZhciBjb2xsZWN0aW9uTmFtZSA9IG9wdHMuY29sbGVjdGlvbk5hbWUsXG4gICAgICAgIG1vZGVsTmFtZSA9IG9wdHMubW9kZWxOYW1lO1xuICAgIGlmIChMb2dnZXIudHJhY2UpIHtcbiAgICAgICAgdmFyIGZ1bGx5UXVhbGlmaWVkTmFtZSA9IGNvbGxlY3Rpb25OYW1lICsgJy4nICsgbW9kZWxOYW1lO1xuICAgICAgICBMb2dnZXIudHJhY2UoJ0xvYWRpbmcgaW5zdGFuY2VzIGZvciAnICsgZnVsbHlRdWFsaWZpZWROYW1lKTtcbiAgICB9XG4gICAgdmFyIE1vZGVsID0gQ29sbGVjdGlvblJlZ2lzdHJ5W2NvbGxlY3Rpb25OYW1lXVttb2RlbE5hbWVdO1xuICAgIHZhciBtYXBGdW5jID0gZnVuY3Rpb24gKGRvYykge1xuICAgICAgICBpZiAoZG9jLm1vZGVsID09ICckMScgJiYgZG9jLmNvbGxlY3Rpb24gPT0gJyQyJykge1xuICAgICAgICAgICAgLy9ub2luc3BlY3Rpb24gSlNVbnJlc29sdmVkRnVuY3Rpb25cbiAgICAgICAgICAgIGVtaXQoZG9jLl9pZCwgZG9jKTtcbiAgICAgICAgfVxuICAgIH0udG9TdHJpbmcoKS5yZXBsYWNlKCckMScsIG1vZGVsTmFtZSkucmVwbGFjZSgnJDInLCBjb2xsZWN0aW9uTmFtZSk7XG4gICAgaWYgKExvZ2dlci50cmFjZS5pc0VuYWJsZWQpIExvZ2dlci50cmFjZSgnUXVlcnlpbmcgcG91Y2gnKTtcbiAgICBwb3VjaC5xdWVyeSh7bWFwOiBtYXBGdW5jfSlcbiAgICAgICAgLnRoZW4oZnVuY3Rpb24gKHJlc3ApIHtcbiAgICAgICAgICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKSBMb2dnZXIudHJhY2UoJ1F1ZXJpZWQgcG91Y2ggc3VjY2VzZmZ1bGx5Jyk7XG4gICAgICAgICAgICB2YXIgZGF0YSA9IHNpZXN0YS5fLm1hcChzaWVzdGEuXy5wbHVjayhyZXNwLnJvd3MsICd2YWx1ZScpLCBmdW5jdGlvbiAoZGF0dW0pIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gX3ByZXBhcmVEYXR1bShkYXR1bSwgTW9kZWwpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBpZiAoTG9nZ2VyLnRyYWNlLmlzRW5hYmxlZCkgTG9nZ2VyLnRyYWNlKCdNYXBwaW5nIGRhdGEnLCBkYXRhKTtcbiAgICAgICAgICAgIE1vZGVsLm1hcChkYXRhLCB7ZGlzYWJsZWV2ZW50czogdHJ1ZSwgX2lnbm9yZUluc3RhbGxlZDogdHJ1ZSwgY2FsbEluaXQ6IGZhbHNlfSwgZnVuY3Rpb24gKGVyciwgaW5zdGFuY2VzKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKExvZ2dlci50cmFjZS5pc0VuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIExvZ2dlci50cmFjZSgnTG9hZGVkICcgKyBpbnN0YW5jZXMgPyBpbnN0YW5jZXMubGVuZ3RoLnRvU3RyaW5nKCkgOiAwICsgJyBpbnN0YW5jZXMgZm9yICcgKyBmdWxseVF1YWxpZmllZE5hbWUpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBMb2dnZXIuZXJyb3IoJ0Vycm9yIGxvYWRpbmcgbW9kZWxzJywgZXJyKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyLCBpbnN0YW5jZXMpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pXG4gICAgICAgIC5jYXRjaChmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICB9KTtcbn1cblxuLyoqXG4gKiBMb2FkIGFsbCBkYXRhIGZyb20gUG91Y2hEQi5cbiAqL1xuZnVuY3Rpb24gX2xvYWQoY2FsbGJhY2spIHtcbiAgICBpZiAoc2F2aW5nKSB0aHJvdyBuZXcgRXJyb3IoJ25vdCBsb2FkZWQgeWV0IGhvdyBjYW4gaSBzYXZlJyk7XG4gICAgdmFyIGRlZmVycmVkID0gdXRpbC5kZWZlcihjYWxsYmFjayk7XG4gICAgaWYgKHNpZXN0YS5leHQuc3RvcmFnZUVuYWJsZWQpIHtcbiAgICAgICAgdmFyIGNvbGxlY3Rpb25OYW1lcyA9IENvbGxlY3Rpb25SZWdpc3RyeS5jb2xsZWN0aW9uTmFtZXM7XG4gICAgICAgIHZhciB0YXNrcyA9IFtdO1xuICAgICAgICBfLmVhY2goY29sbGVjdGlvbk5hbWVzLCBmdW5jdGlvbiAoY29sbGVjdGlvbk5hbWUpIHtcbiAgICAgICAgICAgIHZhciBjb2xsZWN0aW9uID0gQ29sbGVjdGlvblJlZ2lzdHJ5W2NvbGxlY3Rpb25OYW1lXSxcbiAgICAgICAgICAgICAgICBtb2RlbE5hbWVzID0gT2JqZWN0LmtleXMoY29sbGVjdGlvbi5fbW9kZWxzKTtcbiAgICAgICAgICAgIF8uZWFjaChtb2RlbE5hbWVzLCBmdW5jdGlvbiAobW9kZWxOYW1lKSB7XG4gICAgICAgICAgICAgICAgdGFza3MucHVzaChmdW5jdGlvbiAoY2IpIHtcbiAgICAgICAgICAgICAgICAgICAgX2xvYWRNb2RlbCh7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb2xsZWN0aW9uTmFtZTogY29sbGVjdGlvbk5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBtb2RlbE5hbWU6IG1vZGVsTmFtZVxuICAgICAgICAgICAgICAgICAgICB9LCBjYik7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgICAgIHNpZXN0YS5hc3luYy5wYXJhbGxlbCh0YXNrcywgZnVuY3Rpb24gKGVyciwgcmVzdWx0cykge1xuICAgICAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgICAgICB2YXIgaW5zdGFuY2VzID0gW107XG4gICAgICAgICAgICAgICAgc2llc3RhLl8uZWFjaChyZXN1bHRzLCBmdW5jdGlvbiAocikge2luc3RhbmNlcy5jb25jYXQocil9KTtcbiAgICAgICAgICAgICAgICBpZiAoTG9nZ2VyLnRyYWNlKSBMb2dnZXIudHJhY2UoJ0xvYWRlZCAnICsgaW5zdGFuY2VzLmxlbmd0aC50b1N0cmluZygpICsgJyBpbnN0YW5jZXMnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGRlZmVycmVkLmZpbmlzaChlcnIpO1xuICAgICAgICB9KTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIGRlZmVycmVkLmZpbmlzaCgpO1xuICAgIH1cbiAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbn1cblxuZnVuY3Rpb24gc2F2ZUNvbmZsaWN0cyhvYmplY3RzLCBjYWxsYmFjaywgZGVmZXJyZWQpIHtcbiAgICBwb3VjaC5hbGxEb2NzKHtrZXlzOiBfLnBsdWNrKG9iamVjdHMsICdfaWQnKX0pXG4gICAgICAgIC50aGVuKGZ1bmN0aW9uIChyZXNwKSB7XG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHJlc3Aucm93cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIG9iamVjdHNbaV0uX3JldiA9IHJlc3Aucm93c1tpXS52YWx1ZS5yZXY7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBzYXZlVG9Qb3VjaChvYmplY3RzLCBjYWxsYmFjaywgZGVmZXJyZWQpO1xuICAgICAgICB9KVxuICAgICAgICAuY2F0Y2goZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgZGVmZXJyZWQucmVqZWN0KGVycik7XG4gICAgICAgIH0pXG59XG5cbmZ1bmN0aW9uIHNhdmVUb1BvdWNoKG9iamVjdHMsIGNhbGxiYWNrLCBkZWZlcnJlZCkge1xuICAgIHZhciBjb25mbGljdHMgPSBbXTtcbiAgICBwb3VjaC5idWxrRG9jcyhfLm1hcChvYmplY3RzLCBfc2VyaWFsaXNlKSkudGhlbihmdW5jdGlvbiAocmVzcCkge1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHJlc3AubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHZhciByZXNwb25zZSA9IHJlc3BbaV07XG4gICAgICAgICAgICB2YXIgb2JqID0gb2JqZWN0c1tpXTtcbiAgICAgICAgICAgIGlmIChyZXNwb25zZS5vaykge1xuICAgICAgICAgICAgICAgIG9iai5fcmV2ID0gcmVzcG9uc2UucmV2O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAocmVzcG9uc2Uuc3RhdHVzID09IDQwOSkge1xuICAgICAgICAgICAgICAgIGNvbmZsaWN0cy5wdXNoKG9iaik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBMb2dnZXIuZXJyb3IoJ0Vycm9yIHNhdmluZyBvYmplY3Qgd2l0aCBfaWQ9XCInICsgb2JqLl9pZCArICdcIicsIHJlc3BvbnNlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoY29uZmxpY3RzLmxlbmd0aCkge1xuICAgICAgICAgICAgc2F2ZUNvbmZsaWN0cyhjb25mbGljdHMsIGNhbGxiYWNrLCBkZWZlcnJlZCk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgICAgICAgaWYgKGRlZmVycmVkKSBkZWZlcnJlZC5yZXNvbHZlKCk7XG4gICAgICAgIH1cbiAgICB9LCBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgIGlmIChkZWZlcnJlZCkgZGVmZXJyZWQucmVqZWN0KGVycik7XG4gICAgfSk7XG59XG4vKipcbiAqIFNhdmUgYWxsIG1vZGVsRXZlbnRzIGRvd24gdG8gUG91Y2hEQi5cbiAqL1xuZnVuY3Rpb24gc2F2ZShjYWxsYmFjaykge1xuICAgIHZhciBkZWZlcnJlZCA9IHV0aWwuZGVmZXIoY2FsbGJhY2spO1xuICAgIHNpZXN0YS5fYWZ0ZXJJbnN0YWxsKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgY2FsbGJhY2sgPSBjYWxsYmFjayB8fCBmdW5jdGlvbiAoKSB7fTtcbiAgICAgICAgdmFyIG9iamVjdHMgPSB1bnNhdmVkT2JqZWN0cztcbiAgICAgICAgdW5zYXZlZE9iamVjdHMgPSBbXTtcbiAgICAgICAgdW5zYXZlZE9iamVjdHNIYXNoID0ge307XG4gICAgICAgIHVuc2F2ZWRPYmplY3RzQnlDb2xsZWN0aW9uID0ge307XG4gICAgICAgIGlmIChMb2dnZXIudHJhY2UpIHtcbiAgICAgICAgICAgIExvZ2dlci50cmFjZSgnU2F2aW5nIG9iamVjdHMnLCBfLm1hcChvYmplY3RzLCBmdW5jdGlvbiAoeCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB4Ll9kdW1wKClcbiAgICAgICAgICAgIH0pKVxuICAgICAgICB9XG4gICAgICAgIHNhdmVUb1BvdWNoKG9iamVjdHMsIGNhbGxiYWNrLCBkZWZlcnJlZCk7XG4gICAgfSk7XG4gICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG59XG5cbnZhciBsaXN0ZW5lciA9IGZ1bmN0aW9uIChuKSB7XG4gICAgdmFyIGNoYW5nZWRPYmplY3QgPSBuLm9iaixcbiAgICAgICAgaWRlbnQgPSBjaGFuZ2VkT2JqZWN0Ll9pZDtcbiAgICBpZiAoIWNoYW5nZWRPYmplY3QpIHtcbiAgICAgICAgdGhyb3cgbmV3IF9pLmVycm9yLkludGVybmFsU2llc3RhRXJyb3IoJ05vIG9iaiBmaWVsZCBpbiBub3RpZmljYXRpb24gcmVjZWl2ZWQgYnkgc3RvcmFnZSBleHRlbnNpb24nKTtcbiAgICB9XG4gICAgaWYgKCEoaWRlbnQgaW4gdW5zYXZlZE9iamVjdHNIYXNoKSkge1xuICAgICAgICB1bnNhdmVkT2JqZWN0c0hhc2hbaWRlbnRdID0gY2hhbmdlZE9iamVjdDtcbiAgICAgICAgdW5zYXZlZE9iamVjdHMucHVzaChjaGFuZ2VkT2JqZWN0KTtcbiAgICAgICAgdmFyIGNvbGxlY3Rpb25OYW1lID0gY2hhbmdlZE9iamVjdC5jb2xsZWN0aW9uTmFtZTtcbiAgICAgICAgaWYgKCF1bnNhdmVkT2JqZWN0c0J5Q29sbGVjdGlvbltjb2xsZWN0aW9uTmFtZV0pIHtcbiAgICAgICAgICAgIHVuc2F2ZWRPYmplY3RzQnlDb2xsZWN0aW9uW2NvbGxlY3Rpb25OYW1lXSA9IHt9O1xuICAgICAgICB9XG4gICAgICAgIHZhciBtb2RlbE5hbWUgPSBjaGFuZ2VkT2JqZWN0Lm1vZGVsLm5hbWU7XG4gICAgICAgIGlmICghdW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb25bY29sbGVjdGlvbk5hbWVdW21vZGVsTmFtZV0pIHtcbiAgICAgICAgICAgIHVuc2F2ZWRPYmplY3RzQnlDb2xsZWN0aW9uW2NvbGxlY3Rpb25OYW1lXVttb2RlbE5hbWVdID0ge307XG4gICAgICAgIH1cbiAgICAgICAgdW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb25bY29sbGVjdGlvbk5hbWVdW21vZGVsTmFtZV1baWRlbnRdID0gY2hhbmdlZE9iamVjdDtcbiAgICB9XG59O1xuc2llc3RhLm9uKCdTaWVzdGEnLCBsaXN0ZW5lcik7XG5cblxuXy5leHRlbmQoc3RvcmFnZSwge1xuICAgIF9sb2FkOiBfbG9hZCxcbiAgICBzYXZlOiBzYXZlLFxuICAgIF9zZXJpYWxpc2U6IF9zZXJpYWxpc2UsXG4gICAgX3Jlc2V0OiBmdW5jdGlvbiAoY2IpIHtcbiAgICAgICAgc2llc3RhLnJlbW92ZUxpc3RlbmVyKCdTaWVzdGEnLCBsaXN0ZW5lcik7XG4gICAgICAgIHVuc2F2ZWRPYmplY3RzID0gW107XG4gICAgICAgIHVuc2F2ZWRPYmplY3RzSGFzaCA9IHt9O1xuICAgICAgICBwb3VjaC5kZXN0cm95KGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgICAgICAgcG91Y2ggPSBuZXcgUG91Y2hEQihEQl9OQU1FKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHNpZXN0YS5vbignU2llc3RhJywgbGlzdGVuZXIpO1xuICAgICAgICAgICAgTG9nZ2VyLndhcm4oJ1Jlc2V0IGNvbXBsZXRlJyk7XG4gICAgICAgICAgICBjYihlcnIpO1xuICAgICAgICB9KVxuICAgIH1cbn0pO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydGllcyhzdG9yYWdlLCB7XG4gICAgX3Vuc2F2ZWRPYmplY3RzOiB7XG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge3JldHVybiB1bnNhdmVkT2JqZWN0c31cbiAgICB9LFxuICAgIF91bnNhdmVkT2JqZWN0c0hhc2g6IHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7cmV0dXJuIHVuc2F2ZWRPYmplY3RzSGFzaH1cbiAgICB9LFxuICAgIF91bnNhdmVkT2JqZWN0c0J5Q29sbGVjdGlvbjoge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtyZXR1cm4gdW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb259XG4gICAgfSxcbiAgICBfcG91Y2g6IHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7cmV0dXJuIHBvdWNofVxuICAgIH1cbn0pO1xuXG5cbmlmICghc2llc3RhLmV4dCkgc2llc3RhLmV4dCA9IHt9O1xuc2llc3RhLmV4dC5zdG9yYWdlID0gc3RvcmFnZTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnRpZXMoc2llc3RhLmV4dCwge1xuICAgIHN0b3JhZ2VFbmFibGVkOiB7XG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgaWYgKHNpZXN0YS5leHQuX3N0b3JhZ2VFbmFibGVkICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gc2llc3RhLmV4dC5fc3RvcmFnZUVuYWJsZWQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gISFzaWVzdGEuZXh0LnN0b3JhZ2U7XG4gICAgICAgIH0sXG4gICAgICAgIHNldDogZnVuY3Rpb24gKHYpIHtcbiAgICAgICAgICAgIHNpZXN0YS5leHQuX3N0b3JhZ2VFbmFibGVkID0gdjtcbiAgICAgICAgfSxcbiAgICAgICAgZW51bWVyYWJsZTogdHJ1ZVxuICAgIH1cbn0pO1xuXG52YXIgaW50ZXJ2YWwsIHNhdmluZywgYXV0b3NhdmVJbnRlcnZhbCA9IDEwMDA7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKHNpZXN0YSwge1xuICAgIGF1dG9zYXZlOiB7XG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuICEhaW50ZXJ2YWw7XG4gICAgICAgIH0sXG4gICAgICAgIHNldDogZnVuY3Rpb24gKGF1dG9zYXZlKSB7XG4gICAgICAgICAgICBpZiAoYXV0b3NhdmUpIHtcbiAgICAgICAgICAgICAgICBpZiAoIWludGVydmFsKSB7XG4gICAgICAgICAgICAgICAgICAgIGludGVydmFsID0gc2V0SW50ZXJ2YWwoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gQ2hlZWt5IHdheSBvZiBhdm9pZGluZyBtdWx0aXBsZSBzYXZlcyBoYXBwZW5pbmcuLi5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghc2F2aW5nKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc2F2aW5nID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzaWVzdGEuc2F2ZShmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBldmVudHMuZW1pdCgnc2F2ZWQnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzYXZpbmcgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSwgc2llc3RhLmF1dG9zYXZlSW50ZXJ2YWwpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmIChpbnRlcnZhbCkge1xuICAgICAgICAgICAgICAgICAgICBjbGVhckludGVydmFsKGludGVydmFsKTtcbiAgICAgICAgICAgICAgICAgICAgaW50ZXJ2YWwgPSBudWxsO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0sXG4gICAgYXV0b3NhdmVJbnRlcnZhbDoge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiBhdXRvc2F2ZUludGVydmFsO1xuICAgICAgICB9LFxuICAgICAgICBzZXQ6IGZ1bmN0aW9uIChfYXV0b3NhdmVJbnRlcnZhbCkge1xuICAgICAgICAgICAgYXV0b3NhdmVJbnRlcnZhbCA9IF9hdXRvc2F2ZUludGVydmFsO1xuICAgICAgICAgICAgaWYgKGludGVydmFsKSB7XG4gICAgICAgICAgICAgICAgLy8gUmVzZXQgaW50ZXJ2YWxcbiAgICAgICAgICAgICAgICBzaWVzdGEuYXV0b3NhdmUgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBzaWVzdGEuYXV0b3NhdmUgPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSxcbiAgICBkaXJ0eToge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHZhciB1bnNhdmVkT2JqZWN0c0J5Q29sbGVjdGlvbiA9IHNpZXN0YS5leHQuc3RvcmFnZS5fdW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb247XG4gICAgICAgICAgICByZXR1cm4gISFPYmplY3Qua2V5cyh1bnNhdmVkT2JqZWN0c0J5Q29sbGVjdGlvbikubGVuZ3RoO1xuICAgICAgICB9LFxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlXG4gICAgfVxufSk7XG5cbl8uZXh0ZW5kKHNpZXN0YSwge1xuICAgIHNhdmU6IHNhdmUsXG4gICAgc2V0UG91Y2g6IGZ1bmN0aW9uIChfcCkge1xuICAgICAgICBpZiAoc2llc3RhLl9jYW5DaGFuZ2UpIHBvdWNoID0gX3A7XG4gICAgICAgIGVsc2UgdGhyb3cgbmV3IEVycm9yKCdDYW5ub3QgY2hhbmdlIFBvdWNoREIgaW5zdGFuY2Ugd2hlbiBhbiBvYmplY3QgZ3JhcGggZXhpc3RzLicpO1xuICAgIH1cbn0pO1xuXG5cbmlmICh0eXBlb2YgUG91Y2hEQiA9PSAndW5kZWZpbmVkJykge1xuICAgIHNpZXN0YS5leHQuc3RvcmFnZUVuYWJsZWQgPSBmYWxzZTtcbiAgICBMb2dnZXIuZXJyb3IoJ1N0b3JhZ2UgZXh0ZW5zaW9uIGlzIHByZXNlbnQgYnV0IGNvdWxkIG5vdCBmaW5kIFBvdWNoREIuICcgK1xuICAgICdIYXZlIHlvdSBpbmNsdWRlZCBwb3VjaGRiLmpzIGluIHlvdXIgcHJvamVjdD8gSXQgbXVzdCBiZSBwcmVzZW50IGF0IHdpbmRvdy5Qb3VjaERCIScpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHN0b3JhZ2U7XG4iXX0=
;(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/**
 * An extension for enabling performance monitoring of Siesta.
 * Current features:
 *  - Time mapping operations.
 *  - Time maps.
 */


if (typeof siesta == 'undefined' && typeof module == 'undefined') {
    throw new Error('Could not find window.siesta. Make sure you include siesta.core.js first.');
}

var util = siesta._internal.util;

if (!siesta.ext) siesta.ext = {};

// TODO: Place this in Siesta core and use it for all other extensions.
function installExtension(name, ext) {
    siesta.ext[name] = ext;
    var publicProp = name + 'Enabled',
        privateProp = '_' + publicProp;
    Object.defineProperty(siesta.ext, publicProp, {
        get: function () {
            if (siesta.ext[privateProp] !== undefined) {
                return siesta.ext[privateProp];
            }
            return !!siesta.ext[name];
        },
        set: function () {
            siesta.ext[privateProp] = v;
        }
    })
}


var performance = {};
installExtension('performance', performance);

function timeMaps() {
    var Model = siesta._internal.Model,
        oldMap = Model.prototype.map;
    Model.prototype.map = function (data, opts, callback) {
        var start = (new Date).getTime(),
            numDatums = util.isArray(data) ? data.length : 1,
            deferred = util.defer(callback);
        oldMap.call(this, data, opts, function (err, res) {
            var end = (new Date).getTime(),
                timeTaken = end - start;
            console.info('[Performance: model.prototype.map] It took ' + timeTaken + 'ms to map ' + numDatums + ' datums to "' + this.name + '"');
            deferred.finish(err, res);
        }.bind(this));
        return deferred.promise;
    };
}

function timeQueries() {
    var Model = siesta._internal.Model,
        oldQuery = Model.prototype.query;
    Model.prototype.query = function (query, callback) {
        var deferred = util.defer(callback);
        callback = deferred.finish.bind(deferred);
        var start = (new Date).getTime();
        oldQuery.call(this, query, function (err, res) {
            var end = (new Date).getTime(),
                timeTaken = end - start;
            console.info('[Performance: Model.prototype.query] It took ' + timeTaken + 'ms to query');
            callback(err, res);
        });

        return deferred.promise;
    };
}

//timeMaps();
timeQueries();
module.exports = performance;
},{}]},{},[1])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9wZXJmb3JtYW5jZS9pbmRleC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8qKlxuICogQW4gZXh0ZW5zaW9uIGZvciBlbmFibGluZyBwZXJmb3JtYW5jZSBtb25pdG9yaW5nIG9mIFNpZXN0YS5cbiAqIEN1cnJlbnQgZmVhdHVyZXM6XG4gKiAgLSBUaW1lIG1hcHBpbmcgb3BlcmF0aW9ucy5cbiAqICAtIFRpbWUgbWFwcy5cbiAqL1xuXG5cbmlmICh0eXBlb2Ygc2llc3RhID09ICd1bmRlZmluZWQnICYmIHR5cGVvZiBtb2R1bGUgPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0NvdWxkIG5vdCBmaW5kIHdpbmRvdy5zaWVzdGEuIE1ha2Ugc3VyZSB5b3UgaW5jbHVkZSBzaWVzdGEuY29yZS5qcyBmaXJzdC4nKTtcbn1cblxudmFyIHV0aWwgPSBzaWVzdGEuX2ludGVybmFsLnV0aWw7XG5cbmlmICghc2llc3RhLmV4dCkgc2llc3RhLmV4dCA9IHt9O1xuXG4vLyBUT0RPOiBQbGFjZSB0aGlzIGluIFNpZXN0YSBjb3JlIGFuZCB1c2UgaXQgZm9yIGFsbCBvdGhlciBleHRlbnNpb25zLlxuZnVuY3Rpb24gaW5zdGFsbEV4dGVuc2lvbihuYW1lLCBleHQpIHtcbiAgICBzaWVzdGEuZXh0W25hbWVdID0gZXh0O1xuICAgIHZhciBwdWJsaWNQcm9wID0gbmFtZSArICdFbmFibGVkJyxcbiAgICAgICAgcHJpdmF0ZVByb3AgPSAnXycgKyBwdWJsaWNQcm9wO1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShzaWVzdGEuZXh0LCBwdWJsaWNQcm9wLCB7XG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgaWYgKHNpZXN0YS5leHRbcHJpdmF0ZVByb3BdICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gc2llc3RhLmV4dFtwcml2YXRlUHJvcF07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gISFzaWVzdGEuZXh0W25hbWVdO1xuICAgICAgICB9LFxuICAgICAgICBzZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHNpZXN0YS5leHRbcHJpdmF0ZVByb3BdID0gdjtcbiAgICAgICAgfVxuICAgIH0pXG59XG5cblxudmFyIHBlcmZvcm1hbmNlID0ge307XG5pbnN0YWxsRXh0ZW5zaW9uKCdwZXJmb3JtYW5jZScsIHBlcmZvcm1hbmNlKTtcblxuZnVuY3Rpb24gdGltZU1hcHMoKSB7XG4gICAgdmFyIE1vZGVsID0gc2llc3RhLl9pbnRlcm5hbC5Nb2RlbCxcbiAgICAgICAgb2xkTWFwID0gTW9kZWwucHJvdG90eXBlLm1hcDtcbiAgICBNb2RlbC5wcm90b3R5cGUubWFwID0gZnVuY3Rpb24gKGRhdGEsIG9wdHMsIGNhbGxiYWNrKSB7XG4gICAgICAgIHZhciBzdGFydCA9IChuZXcgRGF0ZSkuZ2V0VGltZSgpLFxuICAgICAgICAgICAgbnVtRGF0dW1zID0gdXRpbC5pc0FycmF5KGRhdGEpID8gZGF0YS5sZW5ndGggOiAxLFxuICAgICAgICAgICAgZGVmZXJyZWQgPSB1dGlsLmRlZmVyKGNhbGxiYWNrKTtcbiAgICAgICAgb2xkTWFwLmNhbGwodGhpcywgZGF0YSwgb3B0cywgZnVuY3Rpb24gKGVyciwgcmVzKSB7XG4gICAgICAgICAgICB2YXIgZW5kID0gKG5ldyBEYXRlKS5nZXRUaW1lKCksXG4gICAgICAgICAgICAgICAgdGltZVRha2VuID0gZW5kIC0gc3RhcnQ7XG4gICAgICAgICAgICBjb25zb2xlLmluZm8oJ1tQZXJmb3JtYW5jZTogbW9kZWwucHJvdG90eXBlLm1hcF0gSXQgdG9vayAnICsgdGltZVRha2VuICsgJ21zIHRvIG1hcCAnICsgbnVtRGF0dW1zICsgJyBkYXR1bXMgdG8gXCInICsgdGhpcy5uYW1lICsgJ1wiJyk7XG4gICAgICAgICAgICBkZWZlcnJlZC5maW5pc2goZXJyLCByZXMpO1xuICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbiAgICB9O1xufVxuXG5mdW5jdGlvbiB0aW1lUXVlcmllcygpIHtcbiAgICB2YXIgTW9kZWwgPSBzaWVzdGEuX2ludGVybmFsLk1vZGVsLFxuICAgICAgICBvbGRRdWVyeSA9IE1vZGVsLnByb3RvdHlwZS5xdWVyeTtcbiAgICBNb2RlbC5wcm90b3R5cGUucXVlcnkgPSBmdW5jdGlvbiAocXVlcnksIGNhbGxiYWNrKSB7XG4gICAgICAgIHZhciBkZWZlcnJlZCA9IHV0aWwuZGVmZXIoY2FsbGJhY2spO1xuICAgICAgICBjYWxsYmFjayA9IGRlZmVycmVkLmZpbmlzaC5iaW5kKGRlZmVycmVkKTtcbiAgICAgICAgdmFyIHN0YXJ0ID0gKG5ldyBEYXRlKS5nZXRUaW1lKCk7XG4gICAgICAgIG9sZFF1ZXJ5LmNhbGwodGhpcywgcXVlcnksIGZ1bmN0aW9uIChlcnIsIHJlcykge1xuICAgICAgICAgICAgdmFyIGVuZCA9IChuZXcgRGF0ZSkuZ2V0VGltZSgpLFxuICAgICAgICAgICAgICAgIHRpbWVUYWtlbiA9IGVuZCAtIHN0YXJ0O1xuICAgICAgICAgICAgY29uc29sZS5pbmZvKCdbUGVyZm9ybWFuY2U6IE1vZGVsLnByb3RvdHlwZS5xdWVyeV0gSXQgdG9vayAnICsgdGltZVRha2VuICsgJ21zIHRvIHF1ZXJ5Jyk7XG4gICAgICAgICAgICBjYWxsYmFjayhlcnIsIHJlcyk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xuICAgIH07XG59XG5cbi8vdGltZU1hcHMoKTtcbnRpbWVRdWVyaWVzKCk7XG5tb2R1bGUuZXhwb3J0cyA9IHBlcmZvcm1hbmNlOyJdfQ==
