(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
"use strict";

/**
 * Solves the common problem of maintaining the order of a set of a models and querying on that order.
 *
 * The same as ReactiveQuery but enables manual reordering of models and maintains an index field.
 */

(function () {

    var ReactiveQuery = require("./ReactiveQuery"),
        log = require("./log")("query"),
        util = require("./util"),
        error = require("./error"),
        modelEvents = require("./modelEvents"),
        InternalSiestaError = error.InternalSiestaError,
        constructQuerySet = require("./QuerySet"),
        _ = util._;

    function ArrangedReactiveQuery(query) {
        ReactiveQuery.call(this, query);
        this.indexAttribute = "index";
    }

    ArrangedReactiveQuery.prototype = Object.create(ReactiveQuery.prototype);

    _.extend(ArrangedReactiveQuery.prototype, {
        _refreshIndexes: function _refreshIndexes() {
            var results = this.results,
                indexAttribute = this.indexAttribute;
            if (!results) throw new InternalSiestaError("ArrangedReactiveQuery must be initialised");
            for (var i = 0; i < results.length; i++) {
                var modelInstance = results[i];
                modelInstance[indexAttribute] = i;
            }
        },
        _mergeIndexes: function _mergeIndexes() {
            var results = this.results,
                newResults = [],
                outOfBounds = [],
                unindexed = [];
            for (var i = 0; i < results.length; i++) {
                var res = results[i],
                    storedIndex = res[this.indexAttribute];
                if (storedIndex == undefined) {
                    // null or undefined
                    unindexed.push(res);
                } else if (storedIndex > results.length) {
                    outOfBounds.push(res);
                } else {
                    // Handle duplicate indexes
                    if (!newResults[storedIndex]) {
                        newResults[storedIndex] = res;
                    } else {
                        unindexed.push(res);
                    }
                }
            }
            outOfBounds = _.sortBy(outOfBounds, (function (x) {
                return x[this.indexAttribute];
            }).bind(this));
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
        init: function init(cb) {
            return util.promise(cb, (function (cb) {
                ReactiveQuery.prototype.init.call(this, (function (err) {
                    if (!err) {
                        if (!this.model.hasAttributeNamed(this.indexAttribute)) {
                            err = error("Model \"" + this.model.name + "\" does not have an attribute named \"" + this.indexAttribute + "\"");
                        } else {
                            this._mergeIndexes();
                            this._query.clearOrdering();
                        }
                    }
                    cb(err, err ? null : this.results);
                }).bind(this));
            }).bind(this));
        },
        _handleNotif: function _handleNotif(n) {
            // We don't want to keep executing the query each time the index event fires as we're changing the index ourselves
            if (n.field != this.indexAttribute) {
                ReactiveQuery.prototype._handleNotif.call(this, n);
                this._refreshIndexes();
            }
        },
        validateIndex: function validateIndex(idx) {
            var maxIndex = this.results.length - 1,
                minIndex = 0;
            if (!(idx >= minIndex && idx <= maxIndex)) {
                throw new Error("Index " + idx.toString() + " is out of bounds");
            }
        },
        swapObjectsAtIndexes: function swapObjectsAtIndexes(from, to) {
            //noinspection UnnecessaryLocalVariableJS
            this.validateIndex(from);
            this.validateIndex(to);
            var fromModel = this.results[from],
                toModel = this.results[to];
            if (!fromModel) {
                throw new Error("No model at index \"" + from.toString() + "\"");
            }
            if (!toModel) {
                throw new Error("No model at index \"" + to.toString() + "\"");
            }
            this.results[to] = fromModel;
            this.results[from] = toModel;
            fromModel[this.indexAttribute] = to;
            toModel[this.indexAttribute] = from;
        },
        swapObjects: function swapObjects(obj1, obj2) {
            var fromIdx = this.results.indexOf(obj1),
                toIdx = this.results.indexOf(obj2);
            this.swapObjectsAtIndexes(fromIdx, toIdx);
        },
        move: function move(from, to) {
            this.validateIndex(from);
            this.validateIndex(to);
            var results = this.results.mutableCopy();
            (function (oldIndex, newIndex) {
                if (newIndex >= this.length) {
                    var k = newIndex - this.length;
                    while (k-- + 1) {
                        this.push(undefined);
                    }
                }
            }).call(results, from, to);
            var removed = results.splice(from, 1)[0];
            this.results = results.asModelQuerySet(this.model);
            this.emit("change", {
                index: from,
                removed: [removed],
                type: modelEvents.ModelEventType.Splice,
                obj: this,
                field: "results"
            });
            results.splice(to, 0, removed);
            this.results = results.asModelQuerySet(this.model);
            this.emit("change", {
                index: to,
                added: [removed],
                type: modelEvents.ModelEventType.Splice,
                obj: this,
                field: "results"
            });
            this._refreshIndexes();
        }
    });

    module.exports = ArrangedReactiveQuery;
})();

},{"./QuerySet":7,"./ReactiveQuery":8,"./error":14,"./log":18,"./modelEvents":21,"./util":24}],2:[function(require,module,exports){
"use strict";

(function () {
    /**
     * @module relationships
     */

    var RelationshipProxy = require("./RelationshipProxy"),
        Store = require("./store"),
        util = require("./util"),
        _ = util._,
        InternalSiestaError = require("./error").InternalSiestaError,
        modelEvents = require("./modelEvents"),
        events = require("./events"),
        wrapArrayForAttributes = events.wrapArray,
        SiestaModel = require("./ModelInstance"),
        ArrayObserver = require("../vendor/observe-js/src/observe").ArrayObserver,
        ModelEventType = require("./modelEvents").ModelEventType;

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
        clearReverse: function clearReverse(removed) {
            var self = this;
            _.each(removed, function (removedObject) {
                var reverseProxy = self.reverseProxyForInstance(removedObject);
                var idx = reverseProxy.related.indexOf(self.object);
                reverseProxy.makeChangesToRelatedWithoutObservations(function () {
                    reverseProxy.splice(idx, 1);
                });
            });
        },
        setReverseOfAdded: function setReverseOfAdded(added) {
            var self = this;
            _.each(added, function (addedObject) {
                var reverseProxy = self.reverseProxyForInstance(addedObject);
                reverseProxy.makeChangesToRelatedWithoutObservations(function () {
                    reverseProxy.splice(0, 0, self.object);
                });
            });
        },
        wrapArray: function wrapArray(arr) {
            var self = this;
            wrapArrayForAttributes(arr, this.reverseName, this.object);
            if (!arr.arrayObserver) {
                arr.arrayObserver = new ArrayObserver(arr);
                var observerFunction = function observerFunction(splices) {
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
        get: function get(cb) {
            return util.promise(cb, (function (cb) {
                cb(null, this.related);
            }).bind(this));
        },
        validate: function validate(obj) {
            if (Object.prototype.toString.call(obj) != "[object Array]") {
                return "Cannot assign scalar to many to many";
            }
            return null;
        },
        set: function set(obj, opts) {
            this.checkInstalled();
            var self = this;
            if (obj) {
                var errorMessage;
                if (errorMessage = this.validate(obj)) {
                    return errorMessage;
                } else {
                    this.clearReverseRelated(opts);
                    self.setIdAndRelated(obj, opts);
                    this.wrapArray(obj);
                    self.setIdAndRelatedReverse(obj, opts);
                }
            } else {
                this.clearReverseRelated(opts);
                self.setIdAndRelated(obj, opts);
            }
        },
        install: function install(obj) {
            RelationshipProxy.prototype.install.call(this, obj);
            this.wrapArray(this.related);
            obj["splice" + util.capitaliseFirstLetter(this.reverseName)] = _.bind(this.splice, this);
        },
        registerRemovalListener: function registerRemovalListener(obj) {
            this.relatedCancelListeners[obj._id] = obj.listen((function (e) {}).bind(this));
        }
    });

    module.exports = ManyToManyProxy;
})();

},{"../vendor/observe-js/src/observe":53,"./ModelInstance":3,"./RelationshipProxy":9,"./error":14,"./events":15,"./modelEvents":21,"./store":22,"./util":24}],3:[function(require,module,exports){
"use strict";

(function () {
    var log = require("./log"),
        util = require("./util"),
        _ = util._,
        error = require("./error"),
        InternalSiestaError = error.InternalSiestaError,
        modelEvents = require("./modelEvents"),
        events = require("./events"),
        cache = require("./cache");

    function ModelInstance(model) {
        var self = this;
        this.model = model;

        util.subProperties(this, this.model, ["collection", "collectionName", "_attributeNames", {
            name: "idField",
            property: "id"
        }, {
            name: "modelName",
            property: "name"
        }]);

        events.ProxyEventEmitter.call(this);

        Object.defineProperties(this, {
            _relationshipNames: {
                get: function get() {
                    var proxies = _.map(Object.keys(self.__proxies || {}), function (x) {
                        return self.__proxies[x];
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
                get: function get() {
                    if (siesta.ext.storageEnabled) {
                        return self._id in siesta.ext.storage._unsavedObjectsHash;
                    } else {
                        return undefined;
                    }
                },
                enumerable: true
            },
            // This is for ProxyEventEmitter.
            event: {
                get: function get() {
                    return this._id;
                }
            }
        });

        this.removed = false;
    }

    ModelInstance.prototype = Object.create(events.ProxyEventEmitter.prototype);

    _.extend(ModelInstance.prototype, {
        get: function get(cb) {
            return util.promise(cb, (function (cb) {
                cb(null, this);
            }).bind(this));
        },
        emit: function emit(type, opts) {
            if (typeof type == "object") opts = type;else opts.type = type;
            opts = opts || {};
            _.extend(opts, {
                collection: this.collectionName,
                model: this.model.name,
                _id: this._id,
                obj: this
            });
            modelEvents.emit(opts);
        },
        remove: function remove(cb, notification) {
            notification = notification == null ? true : notification;
            return util.promise(cb, (function (cb) {
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
                    } else {
                        remove.call(this);
                        cb(null, this);
                    }
                } else {
                    cb(null, this);
                }
            }).bind(this));
        },
        restore: function restore(cb) {
            return util.promise(cb, (function (cb) {
                var _finish = (function (err) {
                    if (!err) {
                        this.emit(modelEvents.ModelEventType.New, {
                            "new": this
                        });
                    }
                    cb(err, this);
                }).bind(this);
                if (this.removed) {
                    cache.insert(this);
                    this.removed = false;
                    var init = this.model.init;
                    if (init) {
                        var paramNames = util.paramNames(init);
                        var fromStorage = true;
                        if (paramNames.length > 1) {
                            init.call(this, fromStorage, _finish);
                        } else {
                            init.call(this, fromStorage);
                            _finish();
                        }
                    } else {
                        _finish();
                    }
                }
            }).bind(this));
        }
    });

    // Inspection
    _.extend(ModelInstance.prototype, {
        getAttributes: function getAttributes() {
            return _.extend({}, this.__values);
        },
        isInstanceOf: function isInstanceOf(model) {
            return this.model == model;
        },
        isA: function isA(model) {
            return this.model == model || this.model.isDescendantOf(model);
        }
    });

    // Dump
    _.extend(ModelInstance.prototype, {
        _dumpString: function _dumpString(reverseRelationships) {
            return JSON.stringify(this._dump(reverseRelationships, null, 4));
        },
        _dump: function _dump(reverseRelationships) {
            var dumped = _.extend({}, this.__values);
            dumped._rev = this._rev;
            dumped._id = this._id;
            return dumped;
        }
    });

    module.exports = ModelInstance;
})();

},{"./cache":11,"./error":14,"./events":15,"./log":18,"./modelEvents":21,"./util":24}],4:[function(require,module,exports){
"use strict";

(function () {
    var RelationshipProxy = require("./RelationshipProxy"),
        Store = require("./store"),
        util = require("./util"),
        _ = util._,
        InternalSiestaError = require("./error").InternalSiestaError,
        modelEvents = require("./modelEvents"),
        events = require("./events"),
        wrapArrayForAttributes = events.wrapArray,
        ArrayObserver = require("../vendor/observe-js/src/observe").ArrayObserver,
        ModelEventType = require("./modelEvents").ModelEventType;

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
        clearReverse: function clearReverse(removed) {
            var self = this;
            _.each(removed, function (removedObject) {
                var reverseProxy = self.reverseProxyForInstance(removedObject);
                reverseProxy.setIdAndRelated(null);
            });
        },
        setReverseOfAdded: function setReverseOfAdded(added) {
            var self = this;
            _.each(added, function (added) {
                var forwardProxy = self.reverseProxyForInstance(added);
                forwardProxy.setIdAndRelated(self.object);
            });
        },
        wrapArray: function wrapArray(arr) {
            var self = this;
            wrapArrayForAttributes(arr, this.reverseName, this.object);
            if (!arr.arrayObserver) {
                arr.arrayObserver = new ArrayObserver(arr);
                var observerFunction = function observerFunction(splices) {
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
        get: function get(cb) {
            return util.promise(cb, (function (cb) {
                cb(null, this.related);
            }).bind(this));
        },
        /**
         * Validate the object that we're setting
         * @param obj
         * @returns {string|null} An error message or null
         * @class OneToManyProxy
         */
        validate: function validate(obj) {
            var str = Object.prototype.toString.call(obj);
            if (this.isForward) {
                if (str == "[object Array]") {
                    return "Cannot assign array forward oneToMany (" + str + "): " + this.forwardName;
                }
            } else {
                if (str != "[object Array]") {
                    return "Cannot scalar to reverse oneToMany (" + str + "): " + this.reverseName;
                }
            }
            return null;
        },
        set: function set(obj, opts) {
            this.checkInstalled();
            var self = this;
            if (obj) {
                var errorMessage;
                if (errorMessage = this.validate(obj)) {
                    return errorMessage;
                } else {
                    this.clearReverseRelated(opts);
                    self.setIdAndRelated(obj, opts);
                    if (self.isReverse) {
                        this.wrapArray(self.related);
                    }
                    self.setIdAndRelatedReverse(obj, opts);
                }
            } else {
                this.clearReverseRelated(opts);
                self.setIdAndRelated(obj, opts);
            }
        },
        install: function install(obj) {
            RelationshipProxy.prototype.install.call(this, obj);

            if (this.isReverse) {
                obj["splice" + util.capitaliseFirstLetter(this.reverseName)] = _.bind(this.splice, this);
                this.wrapArray(this.related);
            }
        }
    });

    module.exports = OneToManyProxy;
})();

},{"../vendor/observe-js/src/observe":53,"./RelationshipProxy":9,"./error":14,"./events":15,"./modelEvents":21,"./store":22,"./util":24}],5:[function(require,module,exports){
"use strict";

(function () {
    var RelationshipProxy = require("./RelationshipProxy"),
        util = require("./util"),
        _ = util._,
        SiestaModel = require("./ModelInstance");

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
        validate: function validate(obj) {
            if (Object.prototype.toString.call(obj) == "[object Array]") {
                return "Cannot assign array to one to one relationship";
            } else if (!obj instanceof SiestaModel) {}
            return null;
        },
        set: function set(obj, opts) {
            this.checkInstalled();
            if (obj) {
                var errorMessage;
                if (errorMessage = this.validate(obj)) {
                    return errorMessage;
                } else {
                    this.clearReverseRelated(opts);
                    this.setIdAndRelated(obj, opts);
                    this.setIdAndRelatedReverse(obj, opts);
                }
            } else {
                this.clearReverseRelated(opts);
                this.setIdAndRelated(obj, opts);
            }
        },
        get: function get(cb) {
            return util.promise(cb, (function (cb) {
                cb(null, this.related);
            }).bind(this));
        }
    });

    module.exports = OneToOneProxy;
})();

},{"./ModelInstance":3,"./RelationshipProxy":9,"./util":24}],6:[function(require,module,exports){
"use strict";

(function () {
    var log = require("./log")("query"),
        cache = require("./cache"),
        util = require("./util"),
        error = require("./error"),
        constructQuerySet = require("./QuerySet"),
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
                if (prop.slice(0, 2) == "__") {
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
        e: function e(opts) {
            var objectValue = opts.object[opts.field];
            if (log.enabled) {
                var stringValue;
                if (objectValue === null) stringValue = "null";else if (objectValue === undefined) stringValue = "undefined";else stringValue = objectValue.toString();
                log(opts.field + ": " + stringValue + " == " + opts.value.toString());
            }
            return objectValue == opts.value;
        },
        lt: function lt(opts) {
            if (!opts.invalid) {
                return opts.object[opts.field] < opts.value;
            }return false;
        },
        gt: function gt(opts) {
            if (!opts.invalid) {
                return opts.object[opts.field] > opts.value;
            }return false;
        },
        lte: function lte(opts) {
            if (!opts.invalid) {
                return opts.object[opts.field] <= opts.value;
            }return false;
        },
        gte: function gte(opts) {
            if (!opts.invalid) {
                return opts.object[opts.field] >= opts.value;
            }return false;
        },
        contains: function contains(opts) {
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
        registerComparator: function registerComparator(symbol, fn) {
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
        execute: function execute(cb) {
            return util.promise(cb, (function (cb) {
                this._executeInMemory(cb);
            }).bind(this));
        },
        _dump: function _dump(asJson) {
            return asJson ? "{}" : {};
        },
        sortFunc: function sortFunc(fields) {
            var sortFunc = function sortFunc(ascending, field) {
                return function (v1, v2) {
                    var d1 = v1[field],
                        d2 = v2[field],
                        res;
                    if (typeof d1 == "string" || d1 instanceof String && typeof d2 == "string" || d2 instanceof String) {
                        res = ascending ? d1.localeCompare(d2) : d2.localeCompare(d1);
                    } else {
                        if (d1 instanceof Date) d1 = d1.getTime();
                        if (d2 instanceof Date) d2 = d2.getTime();
                        if (ascending) res = d1 - d2;else res = d2 - d1;
                    }
                    return res;
                };
            };
            var s = util;
            for (var i = 0; i < fields.length; i++) {
                var field = fields[i];
                s = s.thenBy(sortFunc(field.ascending, field.field));
            }
            return s == util ? null : s;
        },
        _sortResults: function _sortResults(res) {
            var order = this.opts.order;
            if (res && order) {
                var fields = _.map(order, (function (ordering) {
                    var splt = ordering.split("-"),
                        ascending = true,
                        field = null;
                    if (splt.length > 1) {
                        field = splt[1];
                        ascending = false;
                    } else {
                        field = splt[0];
                    }
                    return { field: field, ascending: ascending };
                }).bind(this));
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
        _getCacheByLocalId: function _getCacheByLocalId() {
            return _.reduce(this.model.descendants, function (memo, childModel) {
                return _.extend(memo, cacheForModel(childModel));
            }, _.extend({}, cacheForModel(this.model)));
        },
        _executeInMemory: function _executeInMemory(callback) {
            var _executeInMemory = (function () {
                var cacheByLocalId = this._getCacheByLocalId();
                var keys = Object.keys(cacheByLocalId);
                var self = this;
                var res = [];
                var err;
                for (var i = 0; i < keys.length; i++) {
                    var k = keys[i];
                    var obj = cacheByLocalId[k];
                    var matches = self.objectMatchesQuery(obj);
                    if (typeof matches == "string") {
                        err = error(matches);
                        break;
                    } else {
                        if (matches) res.push(obj);
                    }
                }
                res = this._sortResults(res);
                if (err) log("Error executing query", err);
                callback(err, err ? null : constructQuerySet(res, this.model));
            }).bind(this);
            if (this.opts.ignoreInstalled) {
                _executeInMemory();
            } else {
                siesta._afterInstall(_executeInMemory);
            }
        },
        clearOrdering: function clearOrdering() {
            this.opts.order = null;
        },
        objectMatchesOrQuery: function objectMatchesOrQuery(obj, orQuery) {
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
        objectMatchesAndQuery: function objectMatchesAndQuery(obj, andQuery) {
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
        splitMatches: function splitMatches(obj, unprocessedField, value) {
            var op = "e";
            var fields = unprocessedField.split(".");
            var splt = fields[fields.length - 1].split("__");
            if (splt.length == 2) {
                var field = splt[0];
                op = splt[1];
            } else {
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
                    opts = { object: obj, field: field, value: value, invalid: invalid };
                if (!comparator) {
                    return "No comparator registered for query operation \"" + op + "\"";
                }
                return comparator(opts);
            }
            return false;
        },
        objectMatches: function objectMatches(obj, unprocessedField, value, query) {
            if (unprocessedField == "$or") {
                if (!this.objectMatchesOrQuery(obj, query.$or)) {
                    return false;
                }
            } else if (unprocessedField == "$and") {
                if (!this.objectMatchesAndQuery(obj, query.$and)) {
                    return false;
                }
            } else {
                var matches = this.splitMatches(obj, unprocessedField, value);
                if (typeof matches != "boolean") {
                    return matches;
                }if (!matches) {
                    return false;
                }
            }
            return true;
        },
        objectMatchesBaseQuery: function objectMatchesBaseQuery(obj, query) {
            var fields = Object.keys(query);
            for (var i = 0; i < fields.length; i++) {
                var unprocessedField = fields[i],
                    value = query[unprocessedField];
                var rt = this.objectMatches(obj, unprocessedField, value, query);
                if (typeof rt != "boolean") {
                    return rt;
                }if (!rt) {
                    return false;
                }
            }
            return true;
        },
        objectMatchesQuery: function objectMatchesQuery(obj) {
            return this.objectMatchesBaseQuery(obj, this.query);
        }
    });

    module.exports = Query;
})();

},{"./QuerySet":7,"./cache":11,"./error":14,"./log":18,"./util":24}],7:[function(require,module,exports){
"use strict";

var util = require("./util"),
    Promise = util.Promise,
    error = require("./error"),
    ModelInstance = require("./ModelInstance"),
    _ = require("./util")._;

/*
 TODO: Use ES6 Proxy instead.
 Eventually query sets should use ES6 Proxies which will be much more natural and robust. E.g. no need for the below
 */
var ARRAY_METHODS = ["push", "sort", "reverse", "splice", "shift", "unshift"],
    NUMBER_METHODS = ["toString", "toExponential", "toFixed", "toPrecision", "valueOf"],
    NUMBER_PROPERTIES = ["MAX_VALUE", "MIN_VALUE", "NEGATIVE_INFINITY", "NaN", "POSITIVE_INFINITY"],
    STRING_METHODS = ["charAt", "charCodeAt", "concat", "fromCharCode", "indexOf", "lastIndexOf", "localeCompare", "match", "replace", "search", "slice", "split", "substr", "substring", "toLocaleLowerCase", "toLocaleUpperCase", "toLowerCase", "toString", "toUpperCase", "trim", "valueOf"],
    STRING_PROPERTIES = ["length"];

/**
 * Return the property names for a given object. Handles special cases such as strings and numbers that do not have
 * the getOwnPropertyNames function.
 * The special cases are very much hacks. This hack can be removed once the Proxy object is more widely adopted.
 * @param object
 * @returns {Array}
 */
function getPropertyNames(object) {
    var propertyNames;
    if (typeof object == "string" || object instanceof String) {
        propertyNames = STRING_METHODS.concat(STRING_PROPERTIES);
    } else if (typeof object == "number" || object instanceof Number) {
        propertyNames = NUMBER_METHODS.concat(NUMBER_PROPERTIES);
    } else {
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
    if (!(prop in arr)) {
        // e.g. we cannot redefine .length
        Object.defineProperty(arr, prop, {
            get: function get() {
                return querySet(_.pluck(arr, prop));
            },
            set: function set(v) {
                if (util.isArray(v)) {
                    if (this.length != v.length) throw error({ message: "Must be same length" });
                    for (var i = 0; i < v.length; i++) {
                        this[i][prop] = v[i];
                    }
                } else {
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
    return obj.then && obj["catch"];
}

/**
 * Define a proxy method on the array if not already in existence.
 * @param arr
 * @param prop
 */
function defineMethod(arr, prop) {
    if (!(prop in arr)) {
        // e.g. we don't want to redefine toString
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
            if (typeof referenceObject[prop] == "function") defineMethod(arr, prop, arguments);else defineAttribute(arr, prop);
        });
    }
    return renderImmutable(arr);
}

function throwImmutableError() {
    throw new Error("Cannot modify a query set");
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
        var mutableArr = _.map(this, function (x) {
            return x;
        });
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

},{"./ModelInstance":3,"./error":14,"./util":24}],8:[function(require,module,exports){
"use strict";

/**
 * For those familiar with Apple's Cocoa library, reactive queries roughly map onto NSFetchedResultsController.
 *
 * They present a query set that 'reacts' to changes in the underlying data.
 * @module reactiveQuery
 */

(function () {

    var log = require("./log")("query"),
        Query = require("./Query"),
        EventEmitter = require("events").EventEmitter,
        events = require("./events"),
        modelEvents = require("./modelEvents"),
        InternalSiestaError = require("./error").InternalSiestaError,
        constructQuerySet = require("./QuerySet"),
        util = require("./util"),
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
                get: function get() {
                    return this.initialised;
                }
            },
            model: {
                get: function get() {
                    return self._query.model;
                }
            },
            collection: {
                get: function get() {
                    return self.model.collectionName;
                }
            }
        });
    }

    ReactiveQuery.prototype = Object.create(EventEmitter.prototype);

    _.extend(ReactiveQuery, {
        InsertionPolicy: {
            Front: "Front",
            Back: "Back"
        }
    });

    _.extend(ReactiveQuery.prototype, {
        /**
         *
         * @param cb
         * @param {bool} _ignoreInit - execute query again, initialised or not.
         * @returns {*}
         */
        init: function init(cb, _ignoreInit) {
            if (log) log("init");
            return util.promise(cb, (function (cb) {
                if (!this.initialised || _ignoreInit) {
                    this._query.execute((function (err, results) {
                        if (!err) {
                            this.results = results;
                            if (!this.handler) {
                                var name = this._constructNotificationName();
                                var handler = (function (n) {
                                    this._handleNotif(n);
                                }).bind(this);
                                this.handler = handler;
                                events.on(name, handler);
                            }
                            if (log) log("Listening to " + name);
                            this.initialised = true;
                            cb(null, this.results);
                        } else {
                            cb(err);
                        }
                    }).bind(this));
                } else {
                    cb(null, this.results);
                }
            }).bind(this));
        },
        insert: function insert(newObj) {
            var results = this.results.mutableCopy();
            if (this.insertionPolicy == ReactiveQuery.InsertionPolicy.Back) {
                var idx = results.push(newObj);
            } else {
                idx = results.unshift(newObj);
            }
            this.results = results.asModelQuerySet(this.model);
            return idx;
        },
        /**
         * Execute the underlying query again.
         * @param cb
         */
        update: function update(cb) {
            return this.init(cb, true);
        },
        _handleNotif: function _handleNotif(n) {
            log("_handleNotif", n);
            if (n.type == modelEvents.ModelEventType.New) {
                var newObj = n["new"];
                if (this._query.objectMatchesQuery(newObj)) {
                    log("New object matches", newObj._dumpString());
                    var idx = this.insert(newObj);
                    this.emit("change", {
                        index: idx,
                        added: [newObj],
                        type: modelEvents.ModelEventType.Splice,
                        obj: this
                    });
                } else {
                    log("New object does not match", newObj._dumpString());
                }
            } else if (n.type == modelEvents.ModelEventType.Set) {
                newObj = n.obj;
                var index = this.results.indexOf(newObj),
                    alreadyContains = index > -1,
                    matches = this._query.objectMatchesQuery(newObj);
                if (matches && !alreadyContains) {
                    log("Updated object now matches!", newObj._dumpString());
                    idx = this.insert(newObj);
                    this.emit("change", {
                        index: idx,
                        added: [newObj],
                        type: modelEvents.ModelEventType.Splice,
                        obj: this
                    });
                } else if (!matches && alreadyContains) {
                    log("Updated object no longer matches!", newObj._dumpString());
                    results = this.results.mutableCopy();
                    var removed = results.splice(index, 1);
                    this.results = results.asModelQuerySet(this.model);
                    this.emit("change", {
                        index: index,
                        obj: this,
                        "new": newObj,
                        type: modelEvents.ModelEventType.Splice,
                        removed: removed
                    });
                } else if (!matches && !alreadyContains) {
                    log("Does not contain, but doesnt match so not inserting", newObj._dumpString());
                } else if (matches && alreadyContains) {
                    log("Matches but already contains", newObj._dumpString());
                    // Send the notification over.
                    this.emit("change", n);
                }
            } else if (n.type == modelEvents.ModelEventType.Remove) {
                newObj = n.obj;
                var results = this.results.mutableCopy();
                index = results.indexOf(newObj);
                if (index > -1) {
                    log("Removing object", newObj._dumpString());
                    removed = results.splice(index, 1);
                    this.results = constructQuerySet(results, this.model);
                    this.emit("change", {
                        index: index,
                        obj: this,
                        type: modelEvents.ModelEventType.Splice,
                        removed: removed
                    });
                } else {
                    log("No modelEvents neccessary.", newObj._dumpString());
                }
            } else {
                throw new InternalSiestaError("Unknown change type \"" + n.type.toString() + "\"");
            }
            this.results = constructQuerySet(this._query._sortResults(this.results), this.model);
        },
        _constructNotificationName: function _constructNotificationName() {
            return this.model.collectionName + ":" + this.model.name;
        },
        terminate: function terminate() {
            if (this.handler) {
                events.removeListener(this._constructNotificationName(), this.handler);
            }
            this.results = null;
            this.handler = null;
        },
        listen: function listen(fn) {
            this.on("change", fn);
            return (function () {
                this.removeListener("change", fn);
            }).bind(this);
        },
        listenOnce: function listenOnce(fn) {
            this.once("change", fn);
        }
    });

    module.exports = ReactiveQuery;
})();

},{"./Query":6,"./QuerySet":7,"./error":14,"./events":15,"./log":18,"./modelEvents":21,"./util":24,"events":29}],9:[function(require,module,exports){
"use strict";

/**
 * Base functionality for relationships.
 * @module relationships
 */
(function () {
    var InternalSiestaError = require("./error").InternalSiestaError,
        Store = require("./store"),
        util = require("./util"),
        _ = util._,
        Query = require("./Query"),
        log = require("./log"),
        cache = require("./cache"),
        events = require("./events"),
        wrapArrayForAttributes = events.wrapArray,
        ArrayObserver = require("../vendor/observe-js/src/observe").ArrayObserver,
        modelEvents = require("./modelEvents"),
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
                get: function get() {
                    return !self.isReverse;
                },
                set: function set(v) {
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
        install: function install(modelInstance) {
            if (modelInstance) {
                if (!this.object) {
                    this.object = modelInstance;
                    var self = this;
                    var name = this.getForwardName();
                    Object.defineProperty(modelInstance, name, {
                        get: function get() {
                            return self.related;
                        },
                        set: function set(v) {
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
                    throw new InternalSiestaError("Already installed.");
                }
            } else {
                throw new InternalSiestaError("No object passed to relationship install");
            }
        }

    });

    //noinspection JSUnusedLocalSymbols
    _.extend(RelationshipProxy.prototype, {
        set: function set(obj, opts) {
            throw new InternalSiestaError("Must subclass RelationshipProxy");
        },
        get: function get(callback) {
            throw new InternalSiestaError("Must subclass RelationshipProxy");
        }
    });

    _.extend(RelationshipProxy.prototype, {
        proxyForInstance: function proxyForInstance(modelInstance, reverse) {
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
                    var err = "No proxy with name \"" + name + "\" on mapping " + model.name;
                    throw new InternalSiestaError(err);
                }
                ret = proxy;
            }
            return ret;
        },
        reverseProxyForInstance: function reverseProxyForInstance(modelInstance) {
            return this.proxyForInstance(modelInstance, true);
        },
        getReverseName: function getReverseName() {
            return this.isForward ? this.reverseName : this.forwardName;
        },
        getForwardName: function getForwardName() {
            return this.isForward ? this.forwardName : this.reverseName;
        },
        getForwardModel: function getForwardModel() {
            return this.isForward ? this.forwardModel : this.reverseModel;
        },
        clearRemovalListener: function clearRemovalListener(obj) {
            var _id = obj._id;
            var cancelListen = this.cancelListens[_id];
            // TODO: Remove this check. cancelListen should always exist
            if (cancelListen) {
                cancelListen();
                this.cancelListens[_id] = null;
            }
        },
        listenForRemoval: function listenForRemoval(obj) {
            this.cancelListens[obj._id] = obj.listen((function (e) {
                if (e.type == ModelEventType.Remove) {
                    if (util.isArray(this.related)) {
                        var idx = this.related.indexOf(obj);
                        this.splice(idx, 1);
                    } else {
                        this.setIdAndRelated(null);
                    }
                    this.clearRemovalListener(obj);
                }
            }).bind(this));
        },
        /**
         * Configure _id and related with the new related object.
         * @param obj
         * @param {object} [opts]
         * @param {boolean} [opts.disableNotifications]
         * @returns {String|undefined} - Error message or undefined
         */
        setIdAndRelated: function setIdAndRelated(obj, opts) {
            opts = opts || {};
            if (!opts.disableevents) {
                this.registerSetChange(obj);
            }
            var previouslyRelated = this.related;
            if (previouslyRelated) this.clearRemovalListener(previouslyRelated);
            if (obj) {
                if (util.isArray(obj)) {
                    this.related = obj;
                    obj.forEach((function (_obj) {
                        this.listenForRemoval(_obj);
                    }).bind(this));
                } else {
                    this.related = obj;
                    this.listenForRemoval(obj);
                }
            } else {
                this.related = null;
            }
        },
        checkInstalled: function checkInstalled() {
            if (!this.object) {
                throw new InternalSiestaError("Proxy must be installed on an object before can use it.");
            }
        },
        splicer: function splicer(opts) {
            opts = opts || {};
            return (function (idx, numRemove) {
                opts = opts || {};
                if (!opts.disableevents) {
                    this.registerSpliceChange.apply(this, arguments);
                }
                var add = Array.prototype.slice.call(arguments, 2);
                return _.partial(this.related.splice, idx, numRemove).apply(this.related, add);
            }).bind(this);
        },
        clearReverseRelated: function clearReverseRelated(opts) {
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
        setIdAndRelatedReverse: function setIdAndRelatedReverse(obj, opts) {
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
        makeChangesToRelatedWithoutObservations: function makeChangesToRelatedWithoutObservations(f) {
            if (this.related) {
                this.related.arrayObserver.close();
                this.related.arrayObserver = null;
                f();
                this.wrapArray(this.related);
            } else {
                f();
            }
        },
        registerSetChange: function registerSetChange(obj) {
            var proxyObject = this.object;
            if (!proxyObject) throw new InternalSiestaError("Proxy must have an object associated");
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
                "new": obj,
                type: ModelEventType.Set,
                obj: proxyObject
            });
        },

        registerSpliceChange: function registerSpliceChange(idx, numRemove) {
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
        wrapArray: function wrapArray(arr) {
            var self = this;
            wrapArrayForAttributes(arr, this.reverseName, this.object);
            if (!arr.arrayObserver) {
                arr.arrayObserver = new ArrayObserver(arr);
                var observerFunction = function observerFunction(splices) {
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
        splice: function splice() {
            this.splicer({}).apply(this, arguments);
        }

    });

    module.exports = RelationshipProxy;
})();

},{"../vendor/observe-js/src/observe":53,"./Query":6,"./cache":11,"./error":14,"./events":15,"./log":18,"./modelEvents":21,"./store":22,"./util":24}],10:[function(require,module,exports){
"use strict";

(function () {
    module.exports = {
        OneToMany: "OneToMany",
        OneToOne: "OneToOne",
        ManyToMany: "ManyToMany"
    };
})();

},{}],11:[function(require,module,exports){
"use strict";

/**
 * This is an in-memory cache for models. Models are cached by local id (_id) and remote id (defined by the mapping).
 * Lookups are performed against the cache when mapping.
 * @module cache
 */
(function () {

    var log = require("./log")("cache"),
        InternalSiestaError = require("./error").InternalSiestaError,
        util = require("./util");

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
            log("Local cache hit: " + obj._dump(true));
        } else {
            log("Local cache miss: " + localId);
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
                    var errStr = "A singleton model has more than 1 object in the cache! This is a serious error. " + "Either a model has been modified after objects have already been created, or something has gone" + "very wrong. Please file a bug report if the latter.";
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
                    log("Remote cache hit: " + obj._dump(true));
                } else {
                    log("Remote cache miss: " + remoteId);
                }
                return obj;
            }
        }
        log("Remote cache miss: " + remoteId);
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
                        log("Remote cache insert: " + obj._dump(true));
                        log("Remote cache now looks like: " + remoteDump(true));
                    } else {
                        // Something has gone really wrong. Only one object for a particular collection/type/remoteid combo
                        // should ever exist.
                        if (obj != cachedObject) {
                            var message = "Object " + collectionName.toString() + ":" + type.toString() + "[" + obj.model.id + "=\"" + remoteId + "\"] already exists in the cache." + " This is a serious error, please file a bug report if you are experiencing this out in the wild";
                            log(message, {
                                obj: obj,
                                cachedObject: cachedObject
                            });
                            throw new InternalSiestaError(message);
                        } else {
                            log("Object has already been inserted: " + obj._dump(true));
                        }
                    }
                } else {
                    throw new InternalSiestaError("Model has no type", {
                        model: obj.model,
                        obj: obj
                    });
                }
            } else {
                throw new InternalSiestaError("Model has no collection", {
                    model: obj.model,
                    obj: obj
                });
            }
        } else {
            var msg = "Must pass an object when inserting to cache";
            log(msg);
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
                dumpedIdCache[id] = localCacheById[id]._dump();
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
        return remoteCache;
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
        log("get", opts);
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
                    log(idField + "=" + remoteId);
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
            log("Invalid opts to cache", {
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
            log("Local cache insert: " + obj._dumpString());
            if (!localCacheById[localId]) {
                localCacheById[localId] = obj;
                log("Local cache now looks like: " + localDump(true));
                if (!localCache[collectionName]) localCache[collectionName] = {};
                if (!localCache[collectionName][modelName]) localCache[collectionName][modelName] = {};
                localCache[collectionName][modelName][localId] = obj;
            } else {
                // Something has gone badly wrong here. Two objects should never exist with the same _id
                if (localCacheById[localId] != obj) {
                    var message = "Object with _id=\"" + localId.toString() + "\" is already in the cache. " + "This is a serious error. Please file a bug report if you are experiencing this out in the wild";
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
            log("No remote id (\"" + idField + "\") so wont be placing in the remote cache", obj);
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
            if (!modelName) throw InternalSiestaError("No mapping name");
            if (!collectionName) throw InternalSiestaError("No collection name");
            if (!_id) throw InternalSiestaError("No _id");
            delete localCache[collectionName][modelName][_id];
            delete localCacheById[_id];
            if (obj.model.id) {
                var remoteId = obj[obj.model.id];
                if (remoteId) {
                    delete remoteCache[collectionName][modelName][remoteId];
                }
            }
        } else {
            throw new InternalSiestaError("Object was not in cache.");
        }
    }

    exports._remoteCache = _remoteCache;
    exports._localCache = _localCache;
    Object.defineProperty(exports, "_localCacheByType", {
        get: function get() {
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

},{"./error":14,"./log":18,"./util":24}],12:[function(require,module,exports){
"use strict";

/**
 * @module collection
 */
(function () {
    var log = require("./log")("collection"),
        CollectionRegistry = require("./collectionRegistry").CollectionRegistry,
        InternalSiestaError = require("./error").InternalSiestaError,
        Model = require("./model"),
        extend = require("extend"),
        observe = require("../vendor/observe-js/src/observe").Platform,
        events = require("./events"),
        util = require("./util"),
        _ = util._,
        error = require("./error"),
        cache = require("./cache");

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
        if (!name) throw new Error("Collection must have a name");

        opts = opts || {};
        util.extendFromOpts(this, opts, {
            /**
             * The URL of the API e.g. http://api.github.com
             * @type {string}
             */
            baseURL: ""
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
                get: function get() {
                    if (siesta.ext.storageEnabled) {
                        var unsavedObjectsByCollection = siesta.ext.storage._unsavedObjectsByCollection,
                            hash = unsavedObjectsByCollection[self.name] || {};
                        return !!Object.keys(hash).length;
                    } else {
                        return undefined;
                    }
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
        install: function install(cb) {
            return util.promise(cb, (function (cb) {
                var self = this;
                if (!this.installed) {
                    var modelsToInstall = [];
                    for (var name in this._models) {
                        if (this._models.hasOwnProperty(name)) {
                            var model = this._models[name];
                            modelsToInstall.push(model);
                        }
                    }
                    log("There are " + modelsToInstall.length.toString() + " mappings to install");
                    if (modelsToInstall.length) {
                        var tasks = _.map(modelsToInstall, function (m) {
                            return _.bind(m.install, m);
                        });
                        util.async.parallel(tasks, function (err) {
                            if (err) {
                                log("Failed to install collection", err);
                                self._finaliseInstallation(err, cb);
                            } else {
                                self.installed = true;
                                var errors = [];
                                _.each(modelsToInstall, function (m) {
                                    log("Installing relationships for mapping with name \"" + m.name + "\"");
                                    var err = m.installRelationships();
                                    if (err) errors.push(err);
                                });
                                if (!errors.length) {
                                    _.each(modelsToInstall, function (m) {
                                        log("Installing reverse relationships for mapping with name \"" + m.name + "\"");
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
                    throw new InternalSiestaError("Collection \"" + this.name + "\" has already been installed");
                }
            }).bind(this));
        },

        /**
         * Mark this collection as installed, and place the collection on the global Siesta object.
         * @param  {Object}   err
         * @param  {Function} callback
         * @class Collection
         */
        _finaliseInstallation: function _finaliseInstallation(err, callback) {
            if (err) err = error("Errors were encountered whilst setting up the collection", { errors: err });
            if (!err) {
                this.installed = true;
                var index = require("./index");
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
        _model: function _model(name, opts) {
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
                throw new Error("No name specified when creating mapping");
            }
        },

        /**
         * Registers a model with this collection.
         * @param {String|Object} optsOrName An options object or the name of the mapping. Must pass options as second param if specify name.
         * @param {Object} opts Options if name already specified.
         * @return {Model}
         * @class Collection
         */
        model: function model(op) {
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
                            } else {
                                opts = arguments[0];
                                name = opts.name;
                            }
                            return this._model(name, opts);
                        }
                    } else {
                        if (typeof arguments[0] == "string") {
                            return this._model(arguments[0], arguments[1]);
                        } else {
                            return _.map(arguments, function (m) {
                                return self._model(m.name, m);
                            });
                        }
                    }
                }
            } else {
                throw Error("Cannot create new models once the object graph is established!");
            }
            return null;
        },

        /**
         * Dump this collection as JSON
         * @param  {Boolean} asJson Whether or not to apply JSON.stringify
         * @return {String|Object}
         * @class Collection
         */
        _dump: function _dump(asJson) {
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
        count: function count(cb) {
            return util.promise(cb, (function (cb) {
                var tasks = _.map(this._models, function (m) {
                    return _.bind(m.count, m);
                });
                util.async.parallel(tasks, function (err, ns) {
                    var n;
                    if (!err) {
                        n = _.reduce(ns, function (m, r) {
                            return m + r;
                        }, 0);
                    }
                    cb(err, n);
                });
            }).bind(this));
        }
    });

    module.exports = Collection;
})();

},{"../vendor/observe-js/src/observe":53,"./cache":11,"./collectionRegistry":13,"./error":14,"./events":15,"./index":16,"./log":18,"./model":20,"./util":24,"extend":33}],13:[function(require,module,exports){
"use strict";

/**
 * @module collection
 */
(function () {
    var _ = require("./util")._;

    function CollectionRegistry() {
        if (!this) {
            return new CollectionRegistry();
        }this.collectionNames = [];
    }

    _.extend(CollectionRegistry.prototype, {
        register: function register(collection) {
            var name = collection.name;
            this[name] = collection;
            this.collectionNames.push(name);
        },
        reset: function reset() {
            var self = this;
            _.each(this.collectionNames, function (name) {
                delete self[name];
            });
            this.collectionNames = [];
        }
    });

    exports.CollectionRegistry = new CollectionRegistry();
})();

},{"./util":24}],14:[function(require,module,exports){
"use strict";

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
        if (ssf && Error.captureStackTrace) {
            Error.captureStackTrace(this, ssf);
        }
    }

    InternalSiestaError.prototype = Object.create(Error.prototype);
    InternalSiestaError.prototype.name = "InternalSiestaError";
    InternalSiestaError.prototype.constructor = InternalSiestaError;

    function isSiestaError(err) {
        if (typeof err == "object") {
            return "error" in err && "ok" in err && "reason" in err;
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

},{}],15:[function(require,module,exports){
"use strict";

(function () {
    var EventEmitter = require("events").EventEmitter,
        ArrayObserver = require("../vendor/observe-js/src/observe").ArrayObserver,
        _ = require("./util")._,
        modelEvents = require("./modelEvents");

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
        listen: function listen(type, fn) {
            if (typeof type == "function") {
                fn = type;
                type = null;
            } else {
                var _fn = fn;
                fn = function (e) {
                    e = e || {};
                    if (type) {
                        if (e.type == type) {
                            _fn(e);
                        }
                    } else {
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
            return (function () {
                this._removeListener(fn, type);
            }).bind(this);
        },
        listenOnce: function listenOnce(type, fn) {
            var event = this.event;
            if (typeof type == "function") {
                fn = type;
                type = null;
            } else {
                var _fn = fn;
                fn = function (e) {
                    e = e || {};
                    if (type) {
                        if (e.type == type) {
                            events.removeListener(event, fn);
                            _fn(e);
                        }
                    } else {
                        _fn(e);
                    }
                };
            }
            if (type) {
                return events.on(event, fn);
            } else {
                return events.once(event, fn);
            }
        },
        _removeListener: function _removeListener(fn, type) {
            if (type) {
                var listeners = this.listeners[type],
                    idx = listeners.indexOf(fn);
                listeners.splice(idx, 1);
            }
            return events.removeListener(this.event, fn);
        },
        emit: function emit(type, payload) {
            if (typeof type == "object") {
                payload = type;
                type = null;
            } else {
                payload = payload || {};
                payload.type = type;
            }
            events.emit.call(events, this.event, payload);
        },
        _removeAllListeners: function _removeAllListeners(type) {
            (this.listeners[type] || []).forEach((function (fn) {
                events.removeListener(this.event, fn);
            }).bind(this));
            this.listeners[type] = [];
        },
        removeAllListeners: function removeAllListeners(type) {
            if (type) {
                this._removeAllListeners(type);
            } else {
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
        wrapArray: function wrapArray(array, field, modelInstance) {
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

},{"../vendor/observe-js/src/observe":53,"./modelEvents":21,"./util":24,"events":29}],16:[function(require,module,exports){
"use strict";

(function () {
    var util = require("./util"),
        CollectionRegistry = require("./collectionRegistry").CollectionRegistry,
        Collection = require("./collection"),
        cache = require("./cache"),
        Model = require("./model"),
        error = require("./error"),
        events = require("./events"),
        RelationshipType = require("./RelationshipType"),
        ReactiveQuery = require("./ReactiveQuery"),
        ManyToManyProxy = require("./ManyToManyProxy"),
        OneToOneProxy = require("./OneToOneProxy"),
        OneToManyProxy = require("./OneToManyProxy"),
        RelationshipProxy = require("./RelationshipProxy"),
        modelEvents = require("./modelEvents"),
        Query = require("./Query"),
        querySet = require("./QuerySet"),
        log = require("./log"),
        _ = util._;
    util._patchBind();

    // Initialise siesta object. Strange format facilities using submodules with requireJS (eventually)
    var siesta = (function () {
        function _getOuter() {
            return siesta;
        }

        return function siesta(ext) {
            if (!_getOuter().ext) _getOuter().ext = {};
            _.extend(_getOuter().ext, ext || {});
            return _getOuter();
        };
    })();

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
            ModelInstance: require("./ModelInstance"),
            extend: require("extend"),
            MappingOperation: require("./mappingOperation"),
            events: events,
            ProxyEventEmitter: events.ProxyEventEmitter,
            cache: require("./cache"),
            modelEvents: modelEvents,
            CollectionRegistry: require("./collectionRegistry").CollectionRegistry,
            Collection: Collection,
            utils: util,
            util: util,
            _: util._,
            querySet: querySet,
            observe: require("../vendor/observe-js/src/observe"),
            Query: Query,
            Store: require("./store"),
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
        reset: function reset(cb) {
            installed = false;
            installing = false;
            delete this.queuedTasks;
            cache.reset();
            CollectionRegistry.reset();
            events.removeAllListeners();
            if (siesta.ext.storageEnabled) {
                siesta.ext.storage._reset(cb);
            } else {
                cb();
            }
        },
        /**
         * Creates and registers a new Collection.
         * @param  {String} name
         * @param  {Object} [opts]
         * @return {Collection}
         */
        collection: function collection(name, opts) {
            return new Collection(name, opts);
        },
        /**
         * Install all collections.
         * @param {Function} [cb]
         * @returns {q.Promise}
         */
        install: function install(cb) {
            if (!installing && !installed) {
                return util.promise(cb, (function (cb) {
                    installing = true;
                    var collectionNames = CollectionRegistry.collectionNames,
                        tasks = _.map(collectionNames, function (n) {
                        return CollectionRegistry[n].install.bind(CollectionRegistry[n]);
                    }),
                        storageEnabled = siesta.ext.storageEnabled;
                    if (storageEnabled) tasks = tasks.concat([siesta.ext.storage.ensureIndexesForAll, siesta.ext.storage._load]);
                    tasks.push((function (done) {
                        installed = true;
                        if (this.queuedTasks) this.queuedTasks.execute();
                        done();
                    }).bind(this));
                    siesta.async.series(tasks, cb);
                }).bind(this));
            } else cb(error("already installing"));
        },
        _pushTask: function _pushTask(task) {
            if (!this.queuedTasks) {
                this.queuedTasks = new function Queue() {
                    this.tasks = [];
                    this.execute = (function () {
                        this.tasks.forEach(function (f) {
                            f();
                        });
                        this.tasks = [];
                    }).bind(this);
                }();
            }
            this.queuedTasks.tasks.push(task);
        },
        _afterInstall: function _afterInstall(task) {
            if (!installed) {
                if (!installing) {
                    this.install((function (err) {
                        if (err) console.error("Error setting up siesta", err);
                        delete this.queuedTasks;
                    }).bind(this));
                }
                // In case installed straight away e.g. if storage extension not installed.
                if (!installed) this._pushTask(task);else task();
            } else {
                task();
            }
        },
        setLogLevel: function setLogLevel(loggerName, level) {
            var Logger = log.loggerWithName(loggerName);
            Logger.setLevel(level);
        },
        notify: util.next,
        registerComparator: Query.registerComparator.bind(Query)
    });

    Object.defineProperties(siesta, {
        _canChange: {
            get: function get() {
                return !(installing || installed);
            }
        }
    });

    if (typeof window != "undefined") {
        window.siesta = siesta;
    }

    siesta.log = require("debug");

    module.exports = siesta;

    (function loadExtensions() {
        require("../storage");
    })();
})();

},{"../storage":52,"../vendor/observe-js/src/observe":53,"./ManyToManyProxy":2,"./ModelInstance":3,"./OneToManyProxy":4,"./OneToOneProxy":5,"./Query":6,"./QuerySet":7,"./ReactiveQuery":8,"./RelationshipProxy":9,"./RelationshipType":10,"./cache":11,"./collection":12,"./collectionRegistry":13,"./error":14,"./events":15,"./log":18,"./mappingOperation":19,"./model":20,"./modelEvents":21,"./store":22,"./util":24,"debug":30,"extend":33}],17:[function(require,module,exports){
"use strict";

(function () {
    var log = require("./log")("model"),
        InternalSiestaError = require("./error").InternalSiestaError,
        RelationshipType = require("./RelationshipType"),
        Query = require("./Query"),
        ModelInstance = require("./ModelInstance"),
        util = require("./util"),
        _ = util._,
        guid = util.guid,
        cache = require("./cache"),
        store = require("./store"),
        extend = require("extend"),
        modelEvents = require("./modelEvents"),
        wrapArray = require("./events").wrapArray,
        OneToManyProxy = require("./OneToManyProxy"),
        OneToOneProxy = require("./OneToOneProxy"),
        ManyToManyProxy = require("./ManyToManyProxy"),
        ReactiveQuery = require("./ReactiveQuery"),
        ArrangedReactiveQuery = require("./ArrangedReactiveQuery"),
        ModelEventType = modelEvents.ModelEventType;

    function ModelInstanceFactory(model) {
        this.model = model;
    }

    ModelInstanceFactory.prototype = {
        _getLocalId: function _getLocalId(data) {
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

        _installAttributes: function _installAttributes(modelInstance, data) {
            var Model = this.model,
                attributeNames = Model._attributeNames,
                idx = attributeNames.indexOf(Model.id);
            _.extend(modelInstance, {
                __values: _.extend(_.reduce(Model.attributes, function (m, a) {
                    if (a["default"] !== undefined) m[a.name] = a["default"];
                    return m;
                }, {}), data || {})
            });
            if (idx > -1) attributeNames.splice(idx, 1);
            _.each(attributeNames, function (attributeName) {
                Object.defineProperty(modelInstance, attributeName, {
                    get: function get() {
                        var value = modelInstance.__values[attributeName];
                        return value === undefined ? null : value;
                    },
                    set: function set(v) {
                        var old = modelInstance.__values[attributeName];
                        var propertyDependencies = this._propertyDependencies[attributeName];
                        propertyDependencies = _.map(propertyDependencies, (function (dependant) {
                            return {
                                prop: dependant,
                                old: this[dependant]
                            };
                        }).bind(this));

                        modelInstance.__values[attributeName] = v;
                        propertyDependencies.forEach((function (dep) {
                            var propertyName = dep.prop;
                            var new_ = this[propertyName];
                            modelEvents.emit({
                                collection: Model.collectionName,
                                model: Model.name,
                                _id: modelInstance._id,
                                "new": new_,
                                old: dep.old,
                                type: ModelEventType.Set,
                                field: propertyName,
                                obj: modelInstance
                            });
                        }).bind(this));
                        var e = {
                            collection: Model.collectionName,
                            model: Model.name,
                            _id: modelInstance._id,
                            "new": v,
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
        _installMethods: function _installMethods(modelInstance) {
            var Model = this.model;
            _.each(Object.keys(Model.methods), (function (methodName) {
                if (modelInstance[methodName] === undefined) {
                    modelInstance[methodName] = Model.methods[methodName].bind(modelInstance);
                } else {
                    log("A method with name \"" + methodName + "\" already exists. Ignoring it.");
                }
            }).bind(this));
        },
        _installProperties: function _installProperties(modelInstance) {
            var _propertyNames = Object.keys(this.model.properties),
                _propertyDependencies = {};
            _.each(_propertyNames, (function (propName) {
                var propDef = this.model.properties[propName];
                var dependencies = propDef.dependencies || [];
                dependencies.forEach(function (attr) {
                    if (!_propertyDependencies[attr]) _propertyDependencies[attr] = [];
                    _propertyDependencies[attr].push(propName);
                });
                delete propDef.dependencies;
                if (modelInstance[propName] === undefined) {
                    Object.defineProperty(modelInstance, propName, propDef);
                } else {
                    log("A property/method with name \"" + propName + "\" already exists. Ignoring it.");
                }
            }).bind(this));

            modelInstance._propertyDependencies = _propertyDependencies;
        },
        _installRemoteId: function _installRemoteId(modelInstance) {
            var Model = this.model;
            Object.defineProperty(modelInstance, this.model.id, {
                get: function get() {
                    return modelInstance.__values[Model.id] || null;
                },
                set: function set(v) {
                    var old = modelInstance[Model.id];
                    modelInstance.__values[Model.id] = v;
                    modelEvents.emit({
                        collection: Model.collectionName,
                        model: Model.name,
                        _id: modelInstance._id,
                        "new": v,
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
        _installRelationships: function _installRelationships(modelInstance) {
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
                        throw new InternalSiestaError("No such relationship type: " + type);
                    }
                }
                proxy.install(modelInstance);
            }
        },
        _registerInstance: function _registerInstance(modelInstance, shouldRegisterChange) {
            cache.insert(modelInstance);
            shouldRegisterChange = shouldRegisterChange === undefined ? true : shouldRegisterChange;
            if (shouldRegisterChange) {
                modelEvents.emit({
                    collection: this.model.collectionName,
                    model: this.model.name,
                    _id: modelInstance._id,
                    "new": modelInstance,
                    type: ModelEventType.New,
                    obj: modelInstance
                });
            }
        },
        _installLocalId: function _installLocalId(modelInstance, data) {
            modelInstance._id = this._getLocalId(data);
        },
        /**
         * Convert raw data into a ModelInstance
         * @returns {ModelInstance}
         */
        _instance: function _instance(data, shouldRegisterChange) {
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
                throw new InternalSiestaError("Model must be fully installed before creating any models");
            }
        }
    };

    module.exports = function (model) {
        var factory = new ModelInstanceFactory(model);
        return factory._instance.bind(factory);
    };
})();

},{"./ArrangedReactiveQuery":1,"./ManyToManyProxy":2,"./ModelInstance":3,"./OneToManyProxy":4,"./OneToOneProxy":5,"./Query":6,"./ReactiveQuery":8,"./RelationshipType":10,"./cache":11,"./error":14,"./events":15,"./log":18,"./modelEvents":21,"./store":22,"./util":24,"extend":33}],18:[function(require,module,exports){
"use strict";

(function () {
    /**
     * Dead simple logging service based on visionmedia/debug
     * @module log
     */

    var debug = require("debug"),
        argsarray = require("argsarray");

    module.exports = function (name) {
        var log = debug("siesta:" + name);
        var fn = argsarray(function (args) {
            log.call(log, args);
        });
        Object.defineProperty(fn, "enabled", {
            get: function get() {
                return debug.enabled(name);
            }
        });
        return fn;
    };
})();

},{"argsarray":27,"debug":30}],19:[function(require,module,exports){
"use strict";

(function () {
    var Store = require("./store"),
        SiestaModel = require("./ModelInstance"),
        log = require("./log")("mapping"),
        cache = require("./cache"),
        util = require("./util"),
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
        mapAttributes: function mapAttributes() {
            for (var i = 0; i < this.data.length; i++) {
                var datum = this.data[i];
                var object = this.objects[i];
                // No point mapping object onto itself. This happens if a ModelInstance is passed as a relationship.
                if (datum != object) {
                    if (object) {
                        // If object is falsy, then there was an error looking up that object/creating it.
                        var fields = this.model._attributeNames;
                        _.each(fields, (function (f) {
                            if (datum[f] !== undefined) {
                                // null is fine
                                // If events are disabled we update __values object directly. This avoids triggering
                                // events which are built into the set function of the property.
                                if (this.disableevents) {
                                    object.__values[f] = datum[f];
                                } else {
                                    object[f] = datum[f];
                                }
                            }
                        }).bind(this));
                        // PouchDB revision (if using storage module).
                        // TODO: Can this be pulled out of core?
                        if (datum._rev) object._rev = datum._rev;
                    }
                }
            }
        },
        _map: function _map() {
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
                            err = object.__proxies[f].set(related, { disableevents: self.disableevents });
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
        _lookup: function _lookup(cb) {
            return util.promise(cb, (function (cb) {
                var self = this;
                var remoteLookups = [];
                var localLookups = [];
                for (var i = 0; i < this.data.length; i++) {
                    if (!this.objects[i]) {
                        var lookup;
                        var datum = this.data[i];
                        var isScalar = typeof datum == "string" || typeof datum == "number" || datum instanceof String;
                        if (datum) {
                            if (isScalar) {
                                lookup = {
                                    index: i,
                                    datum: {}
                                };
                                lookup.datum[self.model.id] = datum;
                                remoteLookups.push(lookup);
                            } else if (datum instanceof SiestaModel) {
                                // We won't need to perform any mapping.
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
                util.async.parallel([function (done) {
                    var localIdentifiers = _.pluck(_.pluck(localLookups, "datum"), "_id");
                    if (localIdentifiers.length) {
                        Store.getMultipleLocal(localIdentifiers, function (err, objects) {
                            if (!err) {
                                for (var i = 0; i < localIdentifiers.length; i++) {
                                    var obj = objects[i];
                                    var _id = localIdentifiers[i];
                                    var lookup = localLookups[i];
                                    if (!obj) {
                                        // If there are multiple mapping operations going on, there may be
                                        obj = cache.get({ _id: _id });
                                        if (!obj) obj = self._instance({ _id: _id }, !self.disableevents);
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
                }, function (done) {
                    var remoteIdentifiers = _.pluck(_.pluck(remoteLookups, "datum"), self.model.id);
                    if (remoteIdentifiers.length) {
                        log("Looking up remoteIdentifiers: " + util.prettyPrint(remoteIdentifiers));
                        Store.getMultipleRemote(remoteIdentifiers, self.model, function (err, objects) {
                            if (!err) {
                                if (log.enabled) {
                                    var results = {};
                                    for (i = 0; i < objects.length; i++) {
                                        results[remoteIdentifiers[i]] = objects[i] ? objects[i]._id : null;
                                    }
                                    log("Results for remoteIdentifiers: " + util.prettyPrint(results));
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
                }], cb);
            }).bind(this));
        },
        _lookupSingleton: function _lookupSingleton(cb) {
            return util.promise(cb, (function (cb) {
                var self = this;
                // Pick a random _id from the array of data being mapped onto the singleton object. Note that they should
                // always be the same. This is just a precaution.
                var _ids = _.pluck(self.data, "_id"),
                    _id;
                for (i = 0; i < _ids.length; i++) {
                    if (_ids[i]) {
                        _id = { _id: _ids[i] };
                        break;
                    }
                }
                // The mapping operation is responsible for creating singleton instances if they do not already exist.
                var singleton = cache.getSingleton(this.model) || this._instance(_id);
                for (var i = 0; i < self.data.length; i++) {
                    self.objects[i] = singleton;
                }
                cb();
            }).bind(this));
        },
        _instance: function _instance() {
            var model = this.model,
                modelInstance = model._instance.apply(model, arguments);
            this._newObjects.push(modelInstance);
            return modelInstance;
        },
        start: function start(done) {
            if (this.data.length) {
                var self = this;
                var tasks = [];
                var lookupFunc = this.model.singleton ? this._lookupSingleton : this._lookup;
                tasks.push(_.bind(lookupFunc, this));
                tasks.push(_.bind(this._executeSubOperations, this));
                util.async.parallel(tasks, (function () {
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
                                } else {
                                    init.call(o, fromStorage);
                                }
                            }
                            return m;
                        }, []);
                        async.parallel(initTasks, function () {
                            done(self.errors.length ? self.errors : null, self.objects);
                        });
                    } catch (e) {
                        console.error("Uncaught error when executing init funcitons on models.", e);
                        done(e);
                    }
                }).bind(this));
            } else {
                done(null, []);
            }
        },
        getRelatedData: function getRelatedData(name) {
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
        processErrorsFromTask: function processErrorsFromTask(relationshipName, errors, indexes) {
            if (errors.length) {
                var relatedData = this.getRelatedData(relationshipName).relatedData;
                var unflattenedErrors = util.unflattenArray(errors, relatedData);
                for (var i = 0; i < unflattenedErrors.length; i++) {
                    var idx = indexes[i];
                    var err = unflattenedErrors[i];
                    var isError = err;
                    if (util.isArray(err)) isError = _.reduce(err, function (memo, x) {
                        return memo || x;
                    }, false);
                    if (isError) {
                        if (!this.errors[idx]) this.errors[idx] = {};
                        this.errors[idx][relationshipName] = err;
                    }
                }
            }
        },
        _executeSubOperations: function _executeSubOperations(callback) {
            var self = this,
                relationshipNames = _.keys(this.model.relationships);
            if (relationshipNames.length) {
                var tasks = _.reduce(relationshipNames, (function (m, relationshipName) {
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
                }).bind(this), []);
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

},{"./ModelInstance":3,"./cache":11,"./log":18,"./store":22,"./util":24}],20:[function(require,module,exports){
"use strict";

(function () {

    var log = require("./log")("model"),
        CollectionRegistry = require("./collectionRegistry").CollectionRegistry,
        InternalSiestaError = require("./error").InternalSiestaError,
        RelationshipType = require("./RelationshipType"),
        Query = require("./Query"),
        MappingOperation = require("./mappingOperation"),
        ModelInstance = require("./ModelInstance"),
        util = require("./util"),
        cache = require("./cache"),
        store = require("./store"),
        error = require("./error"),
        extend = require("extend"),
        modelEvents = require("./modelEvents"),
        events = require("./events"),
        OneToOneProxy = require("./OneToOneProxy"),
        ManyToManyProxy = require("./ManyToManyProxy"),
        ReactiveQuery = require("./ReactiveQuery"),
        instanceFactory = require("./instanceFactory"),
        ArrangedReactiveQuery = require("./ArrangedReactiveQuery"),
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
            collection: function collection(c) {
                if (util.isString(c)) {
                    c = CollectionRegistry[c];
                }
                return c;
            },
            id: "id",
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
                get: function get() {
                    return Object.keys(self.relationships);
                },
                enumerable: true
            },
            _attributeNames: {
                get: function get() {
                    var names = [];
                    if (self.id) {
                        names.push(self.id);
                    }
                    _.each(self.attributes, function (x) {
                        names.push(x.name);
                    });
                    return names;
                },
                enumerable: true,
                configurable: true
            },
            installed: {
                get: function get() {
                    return self._installed && self._relationshipsInstalled && self._reverseRelationshipsInstalled;
                },
                enumerable: true,
                configurable: true
            },
            descendants: {
                get: function get() {
                    return _.reduce(self.children, (function (memo, descendant) {
                        return Array.prototype.concat.call(memo, descendant.descendants);
                    }).bind(self), _.extend([], self.children));
                },
                enumerable: true
            },
            dirty: {
                get: function get() {
                    if (siesta.ext.storageEnabled) {
                        var unsavedObjectsByCollection = siesta.ext.storage._unsavedObjectsByCollection,
                            hash = (unsavedObjectsByCollection[this.collectionName] || {})[this.name] || {};
                        return !!Object.keys(hash).length;
                    } else {
                        return undefined;
                    }
                },
                enumerable: true
            },
            collectionName: {
                get: function get() {
                    return this.collection.name;
                },
                enumerable: true
            }
        });
        events.ProxyEventEmitter.call(this, this.collectionName + ":" + this.name);
    }

    _.extend(Model, {
        /**
         * Normalise attributes passed via the options dictionary.
         * @param attributes
         * @returns {Array}
         * @private
         */
        _processAttributes: function _processAttributes(attributes) {
            return _.reduce(attributes, function (m, a) {
                if (typeof a == "string") {
                    m.push({
                        name: a
                    });
                } else {
                    m.push(a);
                }
                return m;
            }, []);
        }
    });

    Model.prototype = Object.create(events.ProxyEventEmitter.prototype);

    _.extend(Model.prototype, {
        installStatics: function installStatics(statics) {
            if (statics) {
                _.each(Object.keys(statics), (function (staticName) {
                    if (this[staticName]) {
                        log("Static method with name \"" + staticName + "\" already exists. Ignoring it.");
                    } else {
                        this[staticName] = statics[staticName].bind(this);
                    }
                }).bind(this));
            }
            return statics;
        },
        _validateRelationshipType: function _validateRelationshipType(relationship) {
            if (!relationship.type) {
                if (this.singleton) relationship.type = RelationshipType.OneToOne;else relationship.type = RelationshipType.OneToMany;
            }
            if (this.singleton && relationship.type == RelationshipType.ManyToMany) {
                return "Singleton model cannot use ManyToMany relationship.";
            }
            if (Object.keys(RelationshipType).indexOf(relationship.type) < 0) {
                return "Relationship type " + relationship.type + " does not exist";
            }return null;
        },

        /**
         * Install relationships. Returns error in form of string if fails.
         * @return {String|null}
         */
        installRelationships: function installRelationships() {
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
                                log(this.name + ": configuring relationship " + name, relationship);
                                if (!(err = this._validateRelationshipType(relationship))) {
                                    var modelName = relationship.model;
                                    delete relationship.model;
                                    var reverseModel;
                                    if (modelName instanceof Model) {
                                        reverseModel = modelName;
                                    } else {
                                        log("reverseModelName", modelName);
                                        if (!self.collection) throw new InternalSiestaError("Model must have collection");
                                        var collection = self.collection;
                                        if (!collection) throw new InternalSiestaError("Collection " + self.collectionName + " not registered");
                                        reverseModel = collection[modelName];
                                    }
                                    if (!reverseModel) {
                                        var arr = modelName.split(".");
                                        if (arr.length == 2) {
                                            var collectionName = arr[0];
                                            modelName = arr[1];
                                            var otherCollection = CollectionRegistry[collectionName];
                                            if (!otherCollection) {
                                                return "Collection with name \"" + collectionName + "\" does not exist.";
                                            }reverseModel = otherCollection[modelName];
                                        }
                                    }
                                    log("reverseModel", reverseModel);
                                    if (reverseModel) {
                                        _.extend(relationship, {
                                            reverseModel: reverseModel,
                                            forwardModel: this,
                                            forwardName: name,
                                            reverseName: relationship.reverse || "reverse_" + name,
                                            isReverse: false
                                        });
                                        delete relationship.reverse;
                                    } else {
                                        return "Model with name \"" + modelName.toString() + "\" does not exist";
                                    }
                                }
                            }
                        }
                    }
                }
            } else {
                throw new InternalSiestaError("Relationships for \"" + this.name + "\" have already been installed");
            }
            if (!err) this._relationshipsInstalled = true;
            return err;
        },
        installReverseRelationships: function installReverseRelationships() {
            if (!this._reverseRelationshipsInstalled) {
                for (var forwardName in this.relationships) {
                    if (this.relationships.hasOwnProperty(forwardName)) {
                        var relationship = this.relationships[forwardName];
                        relationship = extend(true, {}, relationship);
                        relationship.isReverse = true;
                        var reverseModel = relationship.reverseModel,
                            reverseName = relationship.reverseName;
                        if (reverseModel.singleton) {
                            if (relationship.type == RelationshipType.ManyToMany) {
                                return "Singleton model cannot be related via reverse ManyToMany";
                            }if (relationship.type == RelationshipType.OneToMany) {
                                return "Singleton model cannot be related via reverse OneToMany";
                            }
                        }
                        log(this.name + ": configuring  reverse relationship " + reverseName);
                        reverseModel.relationships[reverseName] = relationship;
                    }
                }
                this._reverseRelationshipsInstalled = true;
            } else {
                throw new InternalSiestaError("Reverse relationships for \"" + this.name + "\" have already been installed.");
            }
        },
        _query: function _query(query) {
            return new Query(this, query || {});
        },
        query: function query(query, cb) {
            return util.promise(cb, (function (cb) {
                if (!this.singleton) return this._query(query).execute(cb);else {
                    this._query({ __ignoreInstalled: true }).execute((function (err, objs) {
                        if (err) cb(err);else {
                            // Cache a new singleton and then reexecute the query
                            query = _.extend({}, query);
                            query.__ignoreInstalled = true;
                            if (!objs.length) {
                                this.graph({}, (function (err) {
                                    if (!err) {
                                        this._query(query).execute(cb);
                                    } else {
                                        cb(err);
                                    }
                                }).bind(this));
                            } else {
                                this._query(query).execute(cb);
                            }
                        }
                    }).bind(this));
                }
            }).bind(this));
        },
        reactiveQuery: function reactiveQuery(query) {
            return new ReactiveQuery(new Query(this, query || {}));
        },
        arrangedReactiveQuery: function arrangedReactiveQuery(query) {
            return new ArrangedReactiveQuery(new Query(this, query || {}));
        },
        one: function one(opts, cb) {
            if (typeof opts == "function") {
                cb = opts;
                opts = {};
            }
            return util.promise(cb, (function (cb) {
                this.query(opts, function (err, res) {
                    if (err) cb(err);else {
                        if (res.length > 1) {
                            cb(error("More than one instance returned when executing get query!"));
                        } else {
                            res = res.length ? res[0] : null;
                            cb(null, res);
                        }
                    }
                });
            }).bind(this));
        },
        all: function all(q, cb) {
            if (typeof q == "function") {
                cb = q;
                q = {};
            }
            q = q || {};
            var query = {};
            if (q.__order) query.__order = q.__order;
            return this.query(q, cb);
        },
        install: function install(cb) {
            log("Installing mapping " + this.name);
            return util.promise(cb, (function (cb) {
                if (!this._installed) {
                    this._installed = true;
                    cb();
                } else {
                    throw new InternalSiestaError("Model \"" + this.name + "\" has already been installed");
                }
            }).bind(this));
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
        graph: function graph(data, opts, cb) {
            if (typeof opts == "function") cb = opts;
            opts = opts || {};
            return util.promise(cb, (function (cb) {
                var _map = (function () {
                    var overrides = opts.override;
                    if (overrides) {
                        if (util.isArray(overrides)) opts.objects = overrides;else opts.objects = [overrides];
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
                            err = err ? util.isArray(data) ? err : util.isArray(err) ? err[0] : err : null;
                            cb(err, obj);
                        });
                    }
                }).bind(this);
                if (opts._ignoreInstalled) {
                    _map();
                } else siesta._afterInstall(_map);
            }).bind(this));
        },
        _mapBulk: function _mapBulk(data, opts, callback) {
            _.extend(opts, { model: this, data: data });
            var op = new MappingOperation(opts);
            op.start(function (err, objects) {
                if (err) {
                    if (callback) callback(err);
                } else {
                    callback(null, objects || []);
                }
            });
        },
        _countCache: function _countCache() {
            var collCache = cache._localCacheByType[this.collectionName] || {};
            var modelCache = collCache[this.name] || {};
            return _.reduce(Object.keys(modelCache), function (m, _id) {
                m[_id] = {};
                return m;
            }, {});
        },
        count: function count(cb) {
            return util.promise(cb, (function (cb) {
                cb(null, Object.keys(this._countCache()).length);
            }).bind(this));
        },
        _dump: function _dump(asJSON) {
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
        toString: function toString() {
            return "Model[" + this.name + "]";
        }

    });

    // Subclassing
    _.extend(Model.prototype, {
        child: function child(nameOrOpts, opts) {
            if (typeof nameOrOpts == "string") {
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
        isChildOf: function isChildOf(parent) {
            return this.parent == parent;
        },
        isParentOf: function isParentOf(child) {
            return this.children.indexOf(child) > -1;
        },
        isDescendantOf: function isDescendantOf(ancestor) {
            var parent = this.parent;
            while (parent) {
                if (parent == ancestor) {
                    return true;
                }parent = parent.parent;
            }
            return false;
        },
        isAncestorOf: function isAncestorOf(descendant) {
            return this.descendants.indexOf(descendant) > -1;
        },
        hasAttributeNamed: function hasAttributeNamed(attributeName) {
            return this._attributeNames.indexOf(attributeName) > -1;
        }
    });

    module.exports = Model;
})();

},{"./ArrangedReactiveQuery":1,"./ManyToManyProxy":2,"./ModelInstance":3,"./OneToOneProxy":5,"./Query":6,"./ReactiveQuery":8,"./RelationshipType":10,"./cache":11,"./collectionRegistry":13,"./error":14,"./events":15,"./instanceFactory":17,"./log":18,"./mappingOperation":19,"./modelEvents":21,"./store":22,"./util":24,"extend":33}],21:[function(require,module,exports){
"use strict";

(function () {
    var events = require("./events"),
        InternalSiestaError = require("./error").InternalSiestaError,
        log = require("./log")("events"),
        extend = require("./util")._.extend,
        collectionRegistry = require("./collectionRegistry").CollectionRegistry;

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
        Set: "Set",
        Splice: "Splice",
        New: "New",
        Remove: "Remove"
    };

    /**
     * Represents an individual change.
     * @param opts
     * @constructor
     */
    function ModelEvent(opts) {
        this._opts = opts || {};
        Object.keys(opts).forEach((function (k) {
            this[k] = opts[k];
        }).bind(this));
    }

    ModelEvent.prototype._dump = function (pretty) {
        var dumped = {};
        dumped.collection = typeof this.collection == "string" ? this.collection : this.collection._dump();
        dumped.model = typeof this.model == "string" ? this.model : this.model.name;
        dumped._id = this._id;
        dumped.field = this.field;
        dumped.type = this.type;
        if (this.index) dumped.index = this.index;
        if (this.added) dumped.added = _.map(this.added, function (x) {
            return x._dump();
        });
        if (this.removed) dumped.removed = _.map(this.removed, function (x) {
            return x._dump();
        });
        if (this.old) dumped.old = this.old;
        if (this["new"]) dumped["new"] = this["new"];
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
        log("Sending notification \"" + collectionName + "\" of type " + c.type);
        events.emit(collectionName, c);
        var modelNotif = collectionName + ":" + modelName;
        log("Sending notification \"" + modelNotif + "\" of type " + c.type);
        events.emit(modelNotif, c);
        var genericNotif = "Siesta";
        log("Sending notification \"" + genericNotif + "\" of type " + c.type);
        events.emit(genericNotif, c);
        var localIdNotif = c._id;
        log("Sending notification \"" + localIdNotif + "\" of type " + c.type);
        events.emit(localIdNotif, c);
        var collection = collectionRegistry[collectionName];
        var err;
        if (!collection) {
            err = "No such collection \"" + collectionName + "\"";
            log(err, collectionRegistry);
            throw new InternalSiestaError(err);
        }
        var model = collection[modelName];
        if (!model) {
            err = "No such model \"" + modelName + "\"";
            log(err, collectionRegistry);
            throw new InternalSiestaError(err);
        }
        if (model.id && c.obj[model.id]) {
            var remoteIdNotif = collectionName + ":" + modelName + ":" + c.obj[model.id];
            log("Sending notification \"" + remoteIdNotif + "\" of type " + c.type);
            events.emit(remoteIdNotif, c);
        }
    }

    function validateEventOpts(opts) {
        if (!opts.model) throw new InternalSiestaError("Must pass a model");
        if (!opts.collection) throw new InternalSiestaError("Must pass a collection");
        if (!opts._id) throw new InternalSiestaError("Must pass a local identifier");
        if (!opts.obj) throw new InternalSiestaError("Must pass the object");
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

},{"./collectionRegistry":13,"./error":14,"./events":15,"./log":18,"./util":24}],22:[function(require,module,exports){
"use strict";

/**
 * The "store" is responsible for mediating between the in-memory cache and any persistent storage.
 * Note that persistent storage has not been properly implemented yet and so this is pretty useless.
 * All queries will go straight to the cache instead.
 * @module store
 */

(function () {
    var InternalSiestaError = require("./error").InternalSiestaError,
        log = require("./log")("store"),
        util = require("./util"),
        _ = util._,
        cache = require("./cache");

    function get(opts, cb) {
        log("get", opts);
        var siestaModel;
        return util.promise(cb, (function (cb) {
            if (opts._id) {
                if (util.isArray(opts._id)) {
                    // Proxy onto getMultiple instead.
                    getMultiple(_.map(opts._id, function (id) {
                        return {
                            _id: id
                        };
                    }), cb);
                } else {
                    siestaModel = cache.get(opts);
                    if (siestaModel) {
                        if (log.enabled) log("Had cached object", {
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
                                };
                            }), cb);
                        } else if (cb) {
                            var storage = siesta.ext.storage;
                            if (storage) {
                                storage.store.getFromPouch(opts, cb);
                            } else {
                                throw new Error("Storage module not installed");
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
                        return o;
                    }), cb);
                } else {
                    siestaModel = cache.get(opts);
                    if (siestaModel) {
                        if (log.enabled) log("Had cached object", {
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
                                throw new InternalSiestaError("Invalid options given to store. Missing \"" + idField.toString() + ".\"");
                            }
                        }
                    }
                }
            } else {
                // No way in which to find an object locally.
                var context = {
                    opts: opts
                };
                var msg = "Invalid options given to store";
                throw new InternalSiestaError(msg, context);
            }
        }).bind(this));
    }

    function getMultiple(optsArray, cb) {
        return util.promise(cb, (function (cb) {
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
        }).bind(this));
    }

    /**
     * Uses pouch bulk fetch API. Much faster than getMultiple.
     * @param localIdentifiers
     * @param cb
     */
    function getMultipleLocal(localIdentifiers, cb) {
        return util.promise(cb, (function (cb) {
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
        }).bind(this));
    }

    function getMultipleRemote(remoteIdentifiers, model, cb) {
        return util.promise(cb, (function (cb) {
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
        }).bind(this));
    }

    module.exports = {
        get: get,
        getMultiple: getMultiple,
        getMultipleLocal: getMultipleLocal,
        getMultipleRemote: getMultipleRemote
    };
})();

},{"./cache":11,"./error":14,"./log":18,"./util":24}],23:[function(require,module,exports){
"use strict";

(function () {
    var misc = require("./misc"),
        _ = require("./underscore");

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
        var iterate = (function () {
            function _getOuter() {
                return iterate;
            }

            return function iterate() {
                iterator(arr[completed], function (err) {
                    if (err) {
                        callback(err);
                        callback = function () {};
                    } else {
                        completed += 1;
                        if (completed >= arr.length) {
                            callback();
                        } else {
                            _getOuter()();
                        }
                    }
                });
            };
        })();
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

    var _parallel = function _parallel(eachfn, tasks, callback) {
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
        };
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
"use strict";

/*
 * This is a collection of utilities taken from libraries such as async.js, underscore.js etc.
 * @module util
 */

(function () {
    var _ = require("./underscore"),
        async = require("./async"),
        misc = require("./misc");

    _.extend(module.exports, {
        _: _,
        async: async
    });
    _.extend(module.exports, misc);
})();

},{"./async":23,"./misc":25,"./underscore":26}],25:[function(require,module,exports){
"use strict";

(function () {
    var observe = require("../../vendor/observe-js/src/observe").Platform,
        _ = require("./underscore"),
        Promise = require("lie"),
        argsarray = require("argsarray"),
        InternalSiestaError = require("./../error").InternalSiestaError;

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
                } else {
                    deferred.resolve.apply(deferred, Array.prototype.slice.call(arguments, 1));
                }
            }
        };
    }

    var isArrayShim = function isArrayShim(obj) {
        return _.toString.call(obj) === "[object Array]";
    },
        isArray = Array.isArray || isArrayShim,
        isString = function isString(o) {
        return typeof o == "string" || o instanceof String;
    };
    _.extend(module.exports, {
        /**
         * Performs dirty check/Object.observe callbacks depending on the browser.
         *
         * If Object.observe is present,
         * @param callback
         */
        next: function next(callback) {
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
                return Math.floor((1 + Math.random()) * 65536).toString(16).substring(1);
            }

            return function () {
                return s4() + s4() + "-" + s4() + "-" + s4() + "-" + s4() + "-" + s4() + s4() + s4();
            };
        })(),
        assert: function assert(condition, message, context) {
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
        defineSubProperty: function defineSubProperty(property, subObj, innerProperty) {
            return Object.defineProperty(this, property, {
                get: function get() {
                    if (innerProperty) {
                        return subObj[innerProperty];
                    } else {
                        return subObj[property];
                    }
                },
                set: function set(value) {
                    if (innerProperty) {
                        subObj[innerProperty] = value;
                    } else {
                        subObj[property] = value;
                    }
                },
                enumerable: true,
                configurable: true
            });
        },
        defineSubPropertyNoSet: function defineSubPropertyNoSet(property, subObj, innerProperty) {
            return Object.defineProperty(this, property, {
                get: function get() {
                    if (innerProperty) {
                        return subObj[innerProperty];
                    } else {
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
        _patchBind: function _patchBind() {
            var _bind = Function.prototype.apply.bind(Function.prototype.bind);
            Object.defineProperty(Function.prototype, "bind", {
                value: function value(obj) {
                    var boundFunction = _bind(this, arguments);
                    Object.defineProperty(boundFunction, "__siesta_bound_object", {
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
        promise: function promise(cb, fn) {
            cb = cb || function () {};
            return new Promise(function (resolve, reject) {
                var _cb = argsarray(function (args) {
                    var err = args[0],
                        rest = args.slice(1);
                    if (err) reject(err);else resolve(rest[0]);
                    var bound = cb.__siesta_bound_object || cb; // Preserve bound object.
                    cb.apply(bound, args);
                });
                fn(_cb);
            });
        },
        subProperties: function subProperties(obj, subObj, properties) {
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
                        get: function get() {
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
        capitaliseFirstLetter: function capitaliseFirstLetter(string) {
            return string.charAt(0).toUpperCase() + string.slice(1);
        },
        extendFromOpts: function extendFromOpts(obj, opts, defaults, errorOnUnknown) {
            errorOnUnknown = errorOnUnknown == undefined ? true : errorOnUnknown;
            if (errorOnUnknown) {
                var defaultKeys = Object.keys(defaults),
                    optsKeys = Object.keys(opts);
                var unknownKeys = optsKeys.filter(function (n) {
                    return defaultKeys.indexOf(n) == -1;
                });
                if (unknownKeys.length) throw Error("Unknown options: " + unknownKeys.toString());
            }
            // Apply any functions specified in the defaults.
            _.each(Object.keys(defaults), function (k) {
                var d = defaults[k];
                if (typeof d == "function") {
                    defaults[k] = d(opts[k]);
                    delete opts[k];
                }
            });
            _.extend(defaults, opts);
            _.extend(obj, defaults);
        },
        isString: isString,
        isArray: isArray,
        prettyPrint: function prettyPrint(o) {
            return JSON.stringify(o, null, 4);
        },
        flattenArray: function flattenArray(arr) {
            return _.reduce(arr, function (memo, e) {
                if (isArray(e)) {
                    memo = memo.concat(e);
                } else {
                    memo.push(e);
                }
                return memo;
            }, []);
        },
        unflattenArray: function unflattenArray(arr, modelArr) {
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
        paramNames: function paramNames(fn) {
            // TODO: Is there a more robust way of doing this?
            var params = [],
                fnText,
                argDecl;
            fnText = fn.toString().replace(STRIP_COMMENTS, "");
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

},{"../../vendor/observe-js/src/observe":53,"./../error":14,"./underscore":26,"argsarray":27,"lie":37}],26:[function(require,module,exports){
"use strict";

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
        ctor = function ctor() {};

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
    var createCallback = function createCallback(func, context, argCount) {
        if (context === void 0) {
            return func;
        }switch (argCount == null ? 3 : argCount) {
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

    var reduceError = "Reduce of empty array with no initial value";

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
    if (typeof /./ !== "function") {
        _.isFunction = function (obj) {
            return typeof obj === "function";
        };
    }

    _.isObject = function (obj) {
        var type = typeof obj;
        return type === "function" || type === "object" && !!obj;
    };

    // An internal function to generate lookup iterators.
    var lookupIterator = function lookupIterator(value) {
        if (value == null) {
            return _.identity;
        }if (_.isFunction(value)) {
            return value;
        }return _.property(value);
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
        }), "value");
    };

    // Create a function bound to a given object (assigning `this`, and arguments,
    // optionally). Delegates to **ECMAScript 5**'s native `Function.bind` if
    // available.
    _.bind = function (func, context) {
        var args, bound;
        if (nativeBind && func.bind === nativeBind) return nativeBind.apply(func, slice.call(arguments, 1));
        if (!_.isFunction(func)) throw new TypeError();
        args = slice.call(arguments, 2);
        return bound = function () {
            if (!(this instanceof bound)) return func.apply(context, args.concat(slice.call(arguments)));
            ctor.prototype = func.prototype;
            var self = new ctor();
            ctor.prototype = null;
            u;
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
        var length = _.max(arguments, "length").length;
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
            value,
            computed;
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
            index,
            currentKey;
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
"use strict";

(function () {
    if (typeof siesta == "undefined" && typeof module == "undefined") {
        throw new Error("Could not find window.siesta. Make sure you include siesta.core.js first.");
    }

    var _i = siesta._internal,
        cache = _i.cache,
        CollectionRegistry = _i.CollectionRegistry,
        log = _i.log("Storage"),
        error = _i.error,
        util = _i.util,
        _ = util._,
        events = _i.events;

    var unsavedObjects = [],
        unsavedObjectsHash = {},
        unsavedObjectsByCollection = {};

    var storage = {};

    function _initMeta() {
        return { dateFields: [] };
    }

    function fullyQualifiedModelName(collectionName, modelName) {
        return collectionName + "." + modelName;
    }

    if (typeof PouchDB == "undefined") {
        siesta.ext.storageEnabled = false;
        console.log("PouchDB is not present therefore storage is disabled.");
    } else {
        var DB_NAME, pouch;
        var listener;
        var interval, saving, autosaveInterval;

        (function () {
            var _addMeta =

            /**
             * Sometimes siesta needs to store some extra information about the model instance.
             * @param serialised
             * @private
             */
            function (serialised) {
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
            };

            var _processMeta = function (datum) {
                var meta = datum.siesta_meta || _initMeta();
                meta.dateFields.forEach(function (dateField) {
                    var value = datum[dateField];
                    if (!(value instanceof Date)) {
                        datum[dateField] = new Date(value);
                    }
                });
                delete datum.siesta_meta;
            };

            var constructIndexDesignDoc = function (collectionName, modelName) {
                var fullyQualifiedName = fullyQualifiedModelName(collectionName, modelName);
                var views = {};
                views[fullyQualifiedName] = {
                    map: (function (doc) {
                        if (doc.collection == "$1" && doc.model == "$2") emit(doc.collection + "." + doc.model, doc);
                    }).toString().replace("$1", collectionName).replace("$2", modelName)
                };
                return {
                    _id: "_design/" + fullyQualifiedName,
                    views: views
                };
            };

            var constructIndexesForAll = function () {
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
            };

            var __ensureIndexes = function (indexes, cb) {
                pouch.bulkDocs(indexes).then(function (resp) {
                    var errors = [];
                    for (var i = 0; i < resp.length; i++) {
                        var response = resp[i];
                        if (!response.ok) {
                            // Conflict means already exists, and this is fine!
                            var isConflict = response.status == 409;
                            if (!isConflict) errors.push(response);
                        }
                    }
                    cb(errors.length ? error("multiple errors", { errors: errors }) : null);
                })["catch"](cb);
            };

            var ensureIndexesForAll = function (cb) {
                var indexes = constructIndexesForAll();
                __ensureIndexes(indexes, cb);
            };

            var _serialise =

            /**
             * Serialise a model into a format that PouchDB bulkDocs API can process
             * @param {ModelInstance} modelInstance
             */
            function (modelInstance) {
                var serialised = siesta._.extend({}, modelInstance.__values);
                _addMeta(serialised);
                serialised.collection = modelInstance.collectionName;
                serialised.model = modelInstance.modelName;
                serialised._id = modelInstance._id;
                if (modelInstance.removed) serialised._deleted = true;
                var rev = modelInstance._rev;
                if (rev) serialised._rev = rev;
                serialised = _.reduce(modelInstance._relationshipNames, function (memo, n) {
                    var val = modelInstance[n];
                    if (siesta.isArray(val)) {
                        memo[n] = _.pluck(val, "_id");
                    } else if (val) {
                        memo[n] = val._id;
                    }
                    return memo;
                }, serialised);
                return serialised;
            };

            var _prepareDatum = function (datum, model) {
                _processMeta(datum);
                delete datum.collection;
                delete datum.model;
                var relationshipNames = model._relationshipNames;
                _.each(relationshipNames, function (r) {
                    var _id = datum[r];
                    if (siesta.isArray(_id)) {
                        datum[r] = _.map(_id, function (x) {
                            return { _id: x };
                        });
                    } else {
                        datum[r] = { _id: _id };
                    }
                });
                return datum;
            };

            var _loadModel =

            /**
             *
             * @param opts
             * @param opts.collectionName
             * @param opts.modelName
             * @param callback
             * @private
             */
            function (opts, callback) {
                var collectionName = opts.collectionName,
                    modelName = opts.modelName;
                var fullyQualifiedName = fullyQualifiedModelName(collectionName, modelName);
                log("Loading instances for " + fullyQualifiedName);
                var Model = CollectionRegistry[collectionName][modelName];
                log("Querying pouch");
                pouch.query(fullyQualifiedName)
                //pouch.query({map: mapFunc})
                .then(function (resp) {
                    log("Queried pouch successfully");
                    var data = siesta._.map(siesta._.pluck(resp.rows, "value"), function (datum) {
                        return _prepareDatum(datum, Model);
                    });
                    log("Mapping data", data);
                    Model.graph(data, {
                        disableevents: true,
                        _ignoreInstalled: true,
                        fromStorage: true
                    }, function (err, instances) {
                        if (!err) {
                            if (log.enabled) log("Loaded " + instances ? instances.length.toString() : 0 + " instances for " + fullyQualifiedName);
                        } else {
                            log("Error loading models", err);
                        }
                        callback(err, instances);
                    });
                })["catch"](function (err) {
                    callback(err);
                });
            };

            var _load =

            /**
             * Load all data from PouchDB.
             */
            function (cb) {
                if (saving) throw new Error("not loaded yet how can i save");
                return util.promise(cb, (function (cb) {
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
                                    instances = instances.concat(r);
                                });
                                n = instances.length;
                                if (log) {
                                    log("Loaded " + n.toString() + " instances");
                                }
                            }
                            cb(err, n);
                        });
                    } else {
                        cb();
                    }
                }).bind(this));
            };

            var saveConflicts = function (objects, cb) {
                pouch.allDocs({ keys: _.pluck(objects, "_id") }).then(function (resp) {
                    for (var i = 0; i < resp.rows.length; i++) {
                        objects[i]._rev = resp.rows[i].value.rev;
                    }
                    saveToPouch(objects, cb);
                })["catch"](function (err) {
                    cb(err);
                });
            };

            var saveToPouch = function (objects, cb) {
                var conflicts = [];
                pouch.bulkDocs(_.map(objects, _serialise)).then(function (resp) {
                    for (var i = 0; i < resp.length; i++) {
                        var response = resp[i];
                        var obj = objects[i];
                        if (response.ok) {
                            obj._rev = response.rev;
                        } else if (response.status == 409) {
                            conflicts.push(obj);
                        } else {
                            log("Error saving object with _id=\"" + obj._id + "\"", response);
                        }
                    }
                    if (conflicts.length) {
                        saveConflicts(conflicts, cb);
                    } else {
                        cb();
                    }
                }, function (err) {
                    cb(err);
                });
            };

            var save =

            /**
             * Save all modelEvents down to PouchDB.
             */
            function (cb) {
                return util.promise(cb, (function (cb) {
                    siesta._afterInstall(function () {
                        var objects = unsavedObjects;
                        unsavedObjects = [];
                        unsavedObjectsHash = {};
                        unsavedObjectsByCollection = {};
                        if (log) {
                            log("Saving objects", _.map(objects, function (x) {
                                return x._dump();
                            }));
                        }
                        saveToPouch(objects, cb);
                    });
                }).bind(this));
            };

            DB_NAME = "siesta";
            pouch = new PouchDB(DB_NAME, { auto_compaction: true });

            listener = function listener(n) {
                var changedObject = n.obj,
                    ident = changedObject._id;
                if (!changedObject) {
                    throw new _i.error.InternalSiestaError("No obj field in notification received by storage extension");
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

            siesta.on("Siesta", listener);

            _.extend(storage, {
                _load: _load,
                _loadModel: _loadModel,
                save: save,
                _serialise: _serialise,
                ensureIndexesForAll: ensureIndexesForAll,
                _reset: function _reset(cb) {
                    siesta.removeListener("Siesta", listener);
                    unsavedObjects = [];
                    unsavedObjectsHash = {};
                    pouch.destroy(function (err) {
                        if (!err) {
                            pouch = new PouchDB(DB_NAME);
                        }
                        siesta.on("Siesta", listener);
                        log("Reset complete");
                        cb(err);
                    });
                }

            });

            Object.defineProperties(storage, {
                _unsavedObjects: {
                    get: function get() {
                        return unsavedObjects;
                    }
                },
                _unsavedObjectsHash: {
                    get: function get() {
                        return unsavedObjectsHash;
                    }
                },
                _unsavedObjectsByCollection: {
                    get: function get() {
                        return unsavedObjectsByCollection;
                    }
                },
                _pouch: {
                    get: function get() {
                        return pouch;
                    }
                }
            });

            if (!siesta.ext) siesta.ext = {};
            siesta.ext.storage = storage;

            Object.defineProperties(siesta.ext, {
                storageEnabled: {
                    get: function get() {
                        if (siesta.ext._storageEnabled !== undefined) {
                            return siesta.ext._storageEnabled;
                        }
                        return !!siesta.ext.storage;
                    },
                    set: function set(v) {
                        siesta.ext._storageEnabled = v;
                    },
                    enumerable: true
                }
            });

            autosaveInterval = 1000;

            Object.defineProperties(siesta, {
                autosave: {
                    get: function get() {
                        return !!interval;
                    },
                    set: function set(autosave) {
                        if (autosave) {
                            if (!interval) {
                                interval = setInterval(function () {
                                    // Cheeky way of avoiding multiple saves happening...
                                    if (!saving) {
                                        saving = true;
                                        siesta.save(function (err) {
                                            if (!err) {
                                                events.emit("saved");
                                            }
                                            saving = false;
                                        });
                                    }
                                }, siesta.autosaveInterval);
                            }
                        } else {
                            if (interval) {
                                clearInterval(interval);
                                interval = null;
                            }
                        }
                    }
                },
                autosaveInterval: {
                    get: function get() {
                        return autosaveInterval;
                    },
                    set: function set(_autosaveInterval) {
                        autosaveInterval = _autosaveInterval;
                        if (interval) {
                            // Reset interval
                            siesta.autosave = false;
                            siesta.autosave = true;
                        }
                    }
                },
                dirty: {
                    get: function get() {
                        var unsavedObjectsByCollection = siesta.ext.storage._unsavedObjectsByCollection;
                        return !!Object.keys(unsavedObjectsByCollection).length;
                    },
                    enumerable: true
                }
            });

            _.extend(siesta, {
                save: save,
                setPouch: function setPouch(_p) {
                    if (siesta._canChange) pouch = _p;else throw new Error("Cannot change PouchDB instance when an object graph exists.");
                }
            });
        })();
    }

    module.exports = storage;
})();

},{}],53:[function(require,module,exports){
(function (global){
"use strict";

/*
 * Copyright (c) 2014 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */

(function (global) {
  "use strict";

  var testingExposeCycleCount = global.testingExposeCycleCount;

  // Detect and do basic sanity checking on Object/Array.observe.
  function detectObjectObserve() {
    if (typeof Object.observe !== "function" || typeof Array.observe !== "function") {
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
    if (records.length !== 5) {
      return false;
    }if (records[0].type != "add" || records[1].type != "update" || records[2].type != "delete" || records[3].type != "splice" || records[4].type != "splice") {
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
    if (typeof chrome !== "undefined" && chrome.app && chrome.app.runtime) {
      return false;
    }

    // Firefox OS Apps do not allow eval. This feature detection is very hacky
    // but even if some other platform adds support for this function this code
    // will continue to work.
    if (navigator.getDeviceStorage) {
      return false;
    }

    try {
      var f = new Function("", "return true;");
      return f();
    } catch (ex) {
      return false;
    }
  }

  var hasEval = detectEval();

  function isIndex(s) {
    return +s === s >>> 0 && s !== "";
  }

  function toNumber(s) {
    return +s;
  }

  var numberIsNaN = global.Number.isNaN || function (value) {
    return typeof value === "number" && global.isNaN(value);
  };

  var createObject = "__proto__" in {} ? function (obj) {
    return obj;
  } : function (obj) {
    var proto = obj.__proto__;
    if (!proto) return obj;
    var newObject = Object.create(proto);
    Object.getOwnPropertyNames(obj).forEach(function (name) {
      Object.defineProperty(newObject, name, Object.getOwnPropertyDescriptor(obj, name));
    });
    return newObject;
  };

  var identStart = "[$_a-zA-Z]";
  var identPart = "[$_a-zA-Z0-9]";

  var MAX_DIRTY_CHECK_CYCLES = 1000;

  function dirtyCheck(observer) {
    var cycles = 0;
    while (cycles < MAX_DIRTY_CHECK_CYCLES && observer.check_()) {
      cycles++;
    }
    if (testingExposeCycleCount) global.dirtyCheckCycleCount = cycles;

    return cycles > 0;
  }

  function objectIsEmpty(object) {
    for (var prop in object) return false;
    return true;
  }

  function diffIsEmpty(diff) {
    return objectIsEmpty(diff.added) && objectIsEmpty(diff.removed) && objectIsEmpty(diff.changed);
  }

  function diffObjectFromOldObject(object, oldObject) {
    var added = {};
    var removed = {};
    var changed = {};

    for (var prop in oldObject) {
      var newValue = object[prop];

      if (newValue !== undefined && newValue === oldObject[prop]) continue;

      if (!(prop in object)) {
        removed[prop] = undefined;
        continue;
      }

      if (newValue !== oldObject[prop]) changed[prop] = newValue;
    }

    for (var prop in object) {
      if (prop in oldObject) continue;

      added[prop] = object[prop];
    }

    if (Array.isArray(object) && object.length !== oldObject.length) changed.length = object.length;

    return {
      added: added,
      removed: removed,
      changed: changed
    };
  }

  var eomTasks = [];
  function runEOMTasks() {
    if (!eomTasks.length) {
      return false;
    }for (var i = 0; i < eomTasks.length; i++) {
      eomTasks[i]();
    }
    eomTasks.length = 0;
    return true;
  }

  var runEOM = hasObserve ? (function () {
    var eomObj = { pingPong: true };
    var eomRunScheduled = false;

    Object.observe(eomObj, function () {
      runEOMTasks();
      eomRunScheduled = false;
    });

    return function (fn) {
      eomTasks.push(fn);
      if (!eomRunScheduled) {
        eomRunScheduled = true;
        eomObj.pingPong = !eomObj.pingPong;
      }
    };
  })() : (function () {
    return function (fn) {
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
      if (observer && observer.state_ === OPENED && !discardRecords) observer.check_(records);
    }

    return {
      open: function open(obs) {
        if (observer) throw Error("ObservedObject in use");

        if (!first) Object.deliverChangeRecords(callback);

        observer = obs;
        first = false;
      },
      observe: function observe(obj, arrayObserve) {
        object = obj;
        if (arrayObserve) Array.observe(object, callback);else Object.observe(object, callback);
      },
      deliver: function deliver(discard) {
        discardRecords = discard;
        Object.deliverChangeRecords(callback);
        discardRecords = false;
      },
      close: function close() {
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
      if (!obj) {
        return;
      }if (obj === rootObj) rootObjProps[prop] = true;

      if (objects.indexOf(obj) < 0) {
        objects.push(obj);
        Object.observe(obj, callback);
      }

      observe(Object.getPrototypeOf(obj), prop);
    }

    function allRootObjNonObservedProps(recs) {
      for (var i = 0; i < recs.length; i++) {
        var rec = recs[i];
        if (rec.object !== rootObj || rootObjProps[rec.name] || rec.type === "setPrototype") {
          return false;
        }
      }
      return true;
    }

    function callback(recs) {
      if (allRootObjNonObservedProps(recs)) {
        return;
      }var observer;
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
      open: function open(obs, object) {
        if (!rootObj) {
          rootObj = object;
          rootObjProps = {};
        }

        observers.push(obs);
        observerCount++;
        obs.iterateObjects_(observe);
      },
      close: function close(obs) {
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
    open: function open(callback, target) {
      if (this.state_ != UNOPENED) throw Error("Observer has already been opened.");

      addToAll(this);
      this.callback_ = callback;
      this.target_ = target;
      this.connect_();
      this.state_ = OPENED;
      return this.value_;
    },

    close: function close() {
      if (this.state_ != OPENED) {
        return;
      }removeFromAll(this);
      this.disconnect_();
      this.value_ = undefined;
      this.callback_ = undefined;
      this.target_ = undefined;
      this.state_ = CLOSED;
    },

    deliver: function deliver() {
      if (this.state_ != OPENED) {
        return;
      }dirtyCheck(this);
    },

    report_: function report_(changes) {
      try {
        this.callback_.apply(this.target_, changes);
      } catch (ex) {
        Observer._errorThrownDuringCallback = true;
        console.error("Exception caught during observer callback: " + (ex.stack || ex));
      }
    },

    discardChanges: function discardChanges() {
      this.check_(undefined, true);
      return this.value_;
    }
  };

  var collectObservers = !hasObserve;
  var allObservers;
  Observer._allObserversCount = 0;

  if (collectObservers) {
    allObservers = [];
  }

  function addToAll(observer) {
    Observer._allObserversCount++;
    if (!collectObservers) {
      return;
    }allObservers.push(observer);
  }

  function removeFromAll(observer) {
    Observer._allObserversCount--;
  }

  var runningMicrotaskCheckpoint = false;

  var hasDebugForceFullDelivery = hasObserve && hasEval && (function () {
    try {
      eval("%RunMicrotasks()");
      return true;
    } catch (ex) {
      return false;
    }
  })();

  global.Platform = global.Platform || {};

  global.Platform.performMicrotaskCheckpoint = function () {
    if (runningMicrotaskCheckpoint) return;

    if (hasDebugForceFullDelivery) {
      eval("%RunMicrotasks()");
      return;
    }

    if (!collectObservers) return;

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
        if (observer.state_ != OPENED) continue;

        if (observer.check_()) anyChanged = true;

        allObservers.push(observer);
      }
      if (runEOMTasks()) anyChanged = true;
    } while (cycles < MAX_DIRTY_CHECK_CYCLES && anyChanged);

    if (testingExposeCycleCount) global.dirtyCheckCycleCount = cycles;

    runningMicrotaskCheckpoint = false;
  };

  if (collectObservers) {
    global.Platform.clearObservers = function () {
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

    connect_: function connect_(callback, target) {
      if (hasObserve) {
        this.directObserver_ = getObservedObject(this, this.value_, this.arrayObserve);
      } else {
        this.oldObject_ = this.copyObject(this.value_);
      }
    },

    copyObject: function copyObject(object) {
      var copy = Array.isArray(object) ? [] : {};
      for (var prop in object) {
        copy[prop] = object[prop];
      };
      if (Array.isArray(object)) copy.length = object.length;
      return copy;
    },

    check_: function check_(changeRecords, skipChanges) {
      var diff;
      var oldValues;
      if (hasObserve) {
        if (!changeRecords) {
          return false;
        }oldValues = {};
        diff = diffObjectFromChangeRecords(this.value_, changeRecords, oldValues);
      } else {
        oldValues = this.oldObject_;
        diff = diffObjectFromOldObject(this.value_, this.oldObject_);
      }

      if (diffIsEmpty(diff)) {
        return false;
      }if (!hasObserve) this.oldObject_ = this.copyObject(this.value_);

      this.report_([diff.added || {}, diff.removed || {}, diff.changed || {}, function (property) {
        return oldValues[property];
      }]);

      return true;
    },

    disconnect_: function disconnect_() {
      if (hasObserve) {
        this.directObserver_.close();
        this.directObserver_ = undefined;
      } else {
        this.oldObject_ = undefined;
      }
    },

    deliver: function deliver() {
      if (this.state_ != OPENED) {
        return;
      }if (hasObserve) this.directObserver_.deliver(false);else dirtyCheck(this);
    },

    discardChanges: function discardChanges() {
      if (this.directObserver_) this.directObserver_.deliver(true);else this.oldObject_ = this.copyObject(this.value_);

      return this.value_;
    }
  });

  function ArrayObserver(array) {
    if (!Array.isArray(array)) throw Error("Provided object is not an Array");
    ObjectObserver.call(this, array);
  }

  ArrayObserver.prototype = createObject({

    __proto__: ObjectObserver.prototype,

    arrayObserve: true,

    copyObject: function copyObject(arr) {
      return arr.slice();
    },

    check_: function check_(changeRecords) {
      var splices;
      if (hasObserve) {
        if (!changeRecords) {
          return false;
        }splices = projectArraySplices(this.value_, changeRecords);
      } else {
        splices = calcSplices(this.value_, 0, this.value_.length, this.oldObject_, 0, this.oldObject_.length);
      }

      if (!splices || !splices.length) {
        return false;
      }if (!hasObserve) this.oldObject_ = this.copyObject(this.value_);

      this.report_([splices]);
      return true;
    }
  });

  ArrayObserver.applySplices = function (previous, current, splices) {
    splices.forEach(function (splice) {
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
    "delete": true
  };

  function diffObjectFromChangeRecords(object, changeRecords, oldValues) {
    var added = {};
    var removed = {};

    for (var i = 0; i < changeRecords.length; i++) {
      var record = changeRecords[i];
      if (!expectedRecordTypes[record.type]) {
        console.error("Unknown changeRecord type: " + record.type);
        console.error(record);
        continue;
      }

      if (!(record.name in oldValues)) oldValues[record.name] = record.oldValue;

      if (record.type == "update") continue;

      if (record.type == "add") {
        if (record.name in removed) delete removed[record.name];else added[record.name] = true;

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

    for (var prop in added) added[prop] = object[prop];

    for (var prop in removed) removed[prop] = undefined;

    var changed = {};
    for (var prop in oldValues) {
      if (prop in added || prop in removed) continue;

      var newValue = object[prop];
      if (oldValues[prop] !== newValue) changed[prop] = newValue;
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
    calcEditDistances: function calcEditDistances(current, currentStart, currentEnd, old, oldStart, oldEnd) {
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
      for (var j = 0; j < columnCount; j++) distances[0][j] = j;

      for (var i = 1; i < rowCount; i++) {
        for (var j = 1; j < columnCount; j++) {
          if (this.equals(current[currentStart + j - 1], old[oldStart + i - 1])) distances[i][j] = distances[i - 1][j - 1];else {
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
    spliceOperationsFromEditDistances: function spliceOperationsFromEditDistances(distances) {
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
        if (west < north) min = west < northWest ? west : northWest;else min = north < northWest ? north : northWest;

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
    calcSplices: function calcSplices(current, currentStart, currentEnd, old, oldStart, oldEnd) {
      var prefixCount = 0;
      var suffixCount = 0;

      var minLength = Math.min(currentEnd - currentStart, oldEnd - oldStart);
      if (currentStart == 0 && oldStart == 0) prefixCount = this.sharedPrefix(current, old, minLength);

      if (currentEnd == current.length && oldEnd == old.length) suffixCount = this.sharedSuffix(current, old, minLength - prefixCount);

      currentStart += prefixCount;
      oldStart += prefixCount;
      currentEnd -= suffixCount;
      oldEnd -= suffixCount;

      if (currentEnd - currentStart == 0 && oldEnd - oldStart == 0) {
        return [];
      }if (currentStart == currentEnd) {
        var splice = newSplice(currentStart, [], 0);
        while (oldStart < oldEnd) splice.removed.push(old[oldStart++]);

        return [splice];
      } else if (oldStart == oldEnd) {
        return [newSplice(currentStart, [], currentEnd - currentStart)];
      }var ops = this.spliceOperationsFromEditDistances(this.calcEditDistances(current, currentStart, currentEnd, old, oldStart, oldEnd));

      var splice = undefined;
      var splices = [];
      var index = currentStart;
      var oldIndex = oldStart;
      for (var i = 0; i < ops.length; i++) {
        switch (ops[i]) {
          case EDIT_LEAVE:
            if (splice) {
              splices.push(splice);
              splice = undefined;
            }

            index++;
            oldIndex++;
            break;
          case EDIT_UPDATE:
            if (!splice) splice = newSplice(index, [], 0);

            splice.addedCount++;
            index++;

            splice.removed.push(old[oldIndex]);
            oldIndex++;
            break;
          case EDIT_ADD:
            if (!splice) splice = newSplice(index, [], 0);

            splice.addedCount++;
            index++;
            break;
          case EDIT_DELETE:
            if (!splice) splice = newSplice(index, [], 0);

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

    sharedPrefix: function sharedPrefix(current, old, searchLength) {
      for (var i = 0; i < searchLength; i++) if (!this.equals(current[i], old[i])) {
        return i;
      }return searchLength;
    },

    sharedSuffix: function sharedSuffix(current, old, searchLength) {
      var index1 = current.length;
      var index2 = old.length;
      var count = 0;
      while (count < searchLength && this.equals(current[--index1], old[--index2])) count++;

      return count;
    },

    calculateSplices: function calculateSplices(current, previous) {
      return this.calcSplices(current, 0, current.length, previous, 0, previous.length);
    },

    equals: function equals(currentValue, previousValue) {
      return currentValue === previousValue;
    }
  };

  var arraySplice = new ArraySplice();

  function calcSplices(current, currentStart, currentEnd, old, oldStart, oldEnd) {
    return arraySplice.calcSplices(current, currentStart, currentEnd, old, oldStart, oldEnd);
  }

  function intersect(start1, end1, start2, end2) {
    // Disjoint
    if (end1 < start2 || end2 < start1) {
      return -1;
    } // Adjacent
    if (end1 == start2 || end2 == start1) {
      return 0;
    } // Non-zero intersect, span1 first
    if (start1 < start2) {
      if (end1 < end2) {
        return end1 - start2; // Overlap
      } else {
        return end2 - start2; // Contained
      }
    } else {
      // Non-zero intersect, span2 first
      if (end2 < end1) {
        return end2 - start1; // Overlap
      } else {
        return end1 - start1; // Contained
      }
    }
  }

  function mergeSplice(splices, index, removed, addedCount) {

    var splice = newSplice(index, removed, addedCount);

    var inserted = false;
    var insertionOffset = 0;

    for (var i = 0; i < splices.length; i++) {
      var current = splices[i];
      current.index += insertionOffset;

      if (inserted) continue;

      var intersectCount = intersect(splice.index, splice.index + splice.removed.length, current.index, current.index + current.addedCount);

      if (intersectCount >= 0) {
        // Merge the two splices

        splices.splice(i, 1);
        i--;

        insertionOffset -= current.addedCount - current.removed.length;

        splice.addedCount += current.addedCount - intersectCount;
        var deleteCount = splice.removed.length + current.removed.length - intersectCount;

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

        var offset = splice.addedCount - splice.removed.length;
        current.index += offset;
        insertionOffset += offset;
      }
    }

    if (!inserted) splices.push(splice);
  }

  function createInitialSplices(array, changeRecords) {
    var splices = [];

    for (var i = 0; i < changeRecords.length; i++) {
      var record = changeRecords[i];
      switch (record.type) {
        case "splice":
          mergeSplice(splices, record.index, record.removed.slice(), record.addedCount);
          break;
        case "add":
        case "update":
        case "delete":
          if (!isIndex(record.name)) continue;
          var index = toNumber(record.name);
          if (index < 0) continue;
          mergeSplice(splices, index, [record.oldValue], 1);
          break;
        default:
          console.error("Unexpected record type: " + JSON.stringify(record));
          break;
      }
    }

    return splices;
  }

  function projectArraySplices(array, changeRecords) {
    var splices = [];

    createInitialSplices(array, changeRecords).forEach(function (splice) {
      if (splice.addedCount == 1 && splice.removed.length == 1) {
        if (splice.removed[0] !== array[splice.index]) splices.push(splice);

        return;
      };

      splices = splices.concat(calcSplices(array, splice.index, splice.index + splice.addedCount, splice.removed, 0, splice.removed.length));
    });

    return splices;
  }

  // Export the observe-js object for **Node.js**, with
  // backwards-compatibility for the old `require()` API. If we're in
  // the browser, export as a global object.
  var expose = global;
  if (typeof exports !== "undefined") {
    if (typeof module !== "undefined" && module.exports) {
      expose = exports = module.exports;
    }
    expose = exports;
  }
  expose.Observer = Observer;
  expose.Observer.runEOM_ = runEOM;
  expose.Observer.observerSentinel_ = observerSentinel; // for testing.
  expose.Observer.hasObjectObserve = hasObserve;
  expose.ArrayObserver = ArrayObserver;
  expose.ArrayObserver.calculateSplices = function (current, previous) {
    return arraySplice.calculateSplices(current, previous);
  };
  expose.Platform = global.Platform;
  expose.ArraySplice = ArraySplice;
  expose.ObjectObserver = ObjectObserver;
})(typeof global !== "undefined" && global && typeof module !== "undefined" && module ? global : undefined || window);

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}]},{},[16])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9jb3JlL0FycmFuZ2VkUmVhY3RpdmVRdWVyeS5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2NvcmUvTWFueVRvTWFueVByb3h5LmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3QvY29yZS9Nb2RlbEluc3RhbmNlLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3QvY29yZS9PbmVUb01hbnlQcm94eS5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2NvcmUvT25lVG9PbmVQcm94eS5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2NvcmUvUXVlcnkuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9jb3JlL1F1ZXJ5U2V0LmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3QvY29yZS9SZWFjdGl2ZVF1ZXJ5LmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3QvY29yZS9SZWxhdGlvbnNoaXBQcm94eS5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2NvcmUvUmVsYXRpb25zaGlwVHlwZS5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2NvcmUvY2FjaGUuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9jb3JlL2NvbGxlY3Rpb24uanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9jb3JlL2NvbGxlY3Rpb25SZWdpc3RyeS5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2NvcmUvZXJyb3IuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9jb3JlL2V2ZW50cy5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2NvcmUvaW5kZXguanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9jb3JlL2luc3RhbmNlRmFjdG9yeS5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2NvcmUvbG9nLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3QvY29yZS9tYXBwaW5nT3BlcmF0aW9uLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3QvY29yZS9tb2RlbC5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2NvcmUvbW9kZWxFdmVudHMuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9jb3JlL3N0b3JlLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3QvY29yZS91dGlsL2FzeW5jLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3QvY29yZS91dGlsL2luZGV4LmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3QvY29yZS91dGlsL21pc2MuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9jb3JlL3V0aWwvdW5kZXJzY29yZS5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L25vZGVfbW9kdWxlcy9hcmdzYXJyYXkvaW5kZXguanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1yZXNvbHZlL2VtcHR5LmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3Qvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2V2ZW50cy9ldmVudHMuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9ub2RlX21vZHVsZXMvZGVidWcvYnJvd3Nlci5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L25vZGVfbW9kdWxlcy9kZWJ1Zy9kZWJ1Zy5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L25vZGVfbW9kdWxlcy9kZWJ1Zy9ub2RlX21vZHVsZXMvbXMvaW5kZXguanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9ub2RlX21vZHVsZXMvZXh0ZW5kL2luZGV4LmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3Qvbm9kZV9tb2R1bGVzL2xpZS9saWIvSU5URVJOQUwuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9ub2RlX21vZHVsZXMvbGllL2xpYi9hbGwuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9ub2RlX21vZHVsZXMvbGllL2xpYi9oYW5kbGVycy5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L25vZGVfbW9kdWxlcy9saWUvbGliL2luZGV4LmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3Qvbm9kZV9tb2R1bGVzL2xpZS9saWIvcHJvbWlzZS5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L25vZGVfbW9kdWxlcy9saWUvbGliL3F1ZXVlSXRlbS5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L25vZGVfbW9kdWxlcy9saWUvbGliL3JhY2UuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9ub2RlX21vZHVsZXMvbGllL2xpYi9yZWplY3QuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9ub2RlX21vZHVsZXMvbGllL2xpYi9yZXNvbHZlLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3Qvbm9kZV9tb2R1bGVzL2xpZS9saWIvcmVzb2x2ZVRoZW5hYmxlLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3Qvbm9kZV9tb2R1bGVzL2xpZS9saWIvc3RhdGVzLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3Qvbm9kZV9tb2R1bGVzL2xpZS9saWIvdHJ5Q2F0Y2guanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9ub2RlX21vZHVsZXMvbGllL2xpYi91bndyYXAuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9ub2RlX21vZHVsZXMvbGllL25vZGVfbW9kdWxlcy9pbW1lZGlhdGUvbGliL2luZGV4LmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3Qvbm9kZV9tb2R1bGVzL2xpZS9ub2RlX21vZHVsZXMvaW1tZWRpYXRlL2xpYi9tZXNzYWdlQ2hhbm5lbC5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L25vZGVfbW9kdWxlcy9saWUvbm9kZV9tb2R1bGVzL2ltbWVkaWF0ZS9saWIvbXV0YXRpb24uanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9ub2RlX21vZHVsZXMvbGllL25vZGVfbW9kdWxlcy9pbW1lZGlhdGUvbGliL3N0YXRlQ2hhbmdlLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3Qvbm9kZV9tb2R1bGVzL2xpZS9ub2RlX21vZHVsZXMvaW1tZWRpYXRlL2xpYi90aW1lb3V0LmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3Qvc3RvcmFnZS9pbmRleC5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L3ZlbmRvci9vYnNlcnZlLWpzL3NyYy9vYnNlcnZlLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7Ozs7QUNNQSxDQUFDLFlBQVk7O0FBRVQsUUFBSSxhQUFhLEdBQUcsT0FBTyxDQUFDLGlCQUFpQixDQUFDO1FBQzFDLEdBQUcsR0FBRyxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUMsT0FBTyxDQUFDO1FBQy9CLElBQUksR0FBRyxPQUFPLENBQUMsUUFBUSxDQUFDO1FBQ3hCLEtBQUssR0FBRyxPQUFPLENBQUMsU0FBUyxDQUFDO1FBQzFCLFdBQVcsR0FBRyxPQUFP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QUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN1NBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5SkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JNQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0pBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNWQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDZEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25CQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDVEEsQ0FBQyxZQUFZO0FBQ1QsUUFBSSxPQUFPLE1BQU0sSUFBSSxXQUFXLElBQUksT0FBTyxNQUFNLElBQUksV0FBVyxFQUFFO0FBQzlELGNBQU0sSUFBSSxLQUFLLENBQUMsMkVBQTJFLENBQUMsQ0FBQztL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YSxDQUFDO0FBQ3JDLFFBQU0sQ0FBQyxhQUFhLENBQUMsZ0JBQWdCLEdBQUcsVUFBUyxPQUFPLEVBQUUsUUFBUSxFQUFFO0FBQ3BFLFdBQU8sV0FBVyxDQUFDLGdCQUFnQixDQUFDLE9BQU8sRUFBRSxRQUFRLENBQUMsQ0FBQztHQUN0RCxDQUFDO0FBQ0YsUUFBTSxDQUFDLFFBQVEsR0FBRyxNQUFNLENBQUMsUUFBUSxDQUFDO0FBQ2xDLFFBQU0sQ0FBQyxXQUFXLEdBQUcsV0FBVyxDQUFDO0FBQ2pDLFFBQU0sQ0FBQyxjQUFjLEdBQUcsY0FBYyxDQUFDO0NBQ3RDLENBQUEsQ0FBRSxPQUFPLE1BQU0sS0FBSyxXQUFXLElBQUksTUFBTSxJQUFJLE9BQU8sTUFBTSxLQUFLLFdBQVcsSUFBSSxNQUFNLEdBQUcsTUFBTSxHQUFHLGFBQVEsTUFBTSxDQUFDLENBQUMiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLyoqXG4gKiBTb2x2ZXMgdGhlIGNvbW1vbiBwcm9ibGVtIG9mIG1haW50YWluaW5nIHRoZSBvcmRlciBvZiBhIHNldCBvZiBhIG1vZGVscyBhbmQgcXVlcnlpbmcgb24gdGhhdCBvcmRlci5cbiAqXG4gKiBUaGUgc2FtZSBhcyBSZWFjdGl2ZVF1ZXJ5IGJ1dCBlbmFibGVzIG1hbnVhbCByZW9yZGVyaW5nIG9mIG1vZGVscyBhbmQgbWFpbnRhaW5zIGFuIGluZGV4IGZpZWxkLlxuICovXG5cbihmdW5jdGlvbiAoKSB7XG5cbiAgICB2YXIgUmVhY3RpdmVRdWVyeSA9IHJlcXVpcmUoJy4vUmVhY3RpdmVRdWVyeScpLFxuICAgICAgICBsb2cgPSByZXF1aXJlKCcuL2xvZycpKCdxdWVyeScpLFxuICAgICAgICB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyksXG4gICAgICAgIGVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpLFxuICAgICAgICBtb2RlbEV2ZW50cyA9IHJlcXVpcmUoJy4vbW9kZWxFdmVudHMnKSxcbiAgICAgICAgSW50ZXJuYWxTaWVzdGFFcnJvciA9IGVycm9yLkludGVybmFsU2llc3RhRXJyb3IsXG4gICAgICAgIGNvbnN0cnVjdFF1ZXJ5U2V0ID0gcmVxdWlyZSgnLi9RdWVyeVNldCcpLFxuICAgICAgICBfID0gdXRpbC5fO1xuXG4gICAgZnVuY3Rpb24gQXJyYW5nZWRSZWFjdGl2ZVF1ZXJ5KHF1ZXJ5KSB7XG4gICAgICAgIFJlYWN0aXZlUXVlcnkuY2FsbCh0aGlzLCBxdWVyeSk7XG4gICAgICAgIHRoaXMuaW5kZXhBdHRyaWJ1dGUgPSAnaW5kZXgnO1xuICAgIH1cblxuICAgIEFycmFuZ2VkUmVhY3RpdmVRdWVyeS5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKFJlYWN0aXZlUXVlcnkucHJvdG90eXBlKTtcblxuICAgIF8uZXh0ZW5kKEFycmFuZ2VkUmVhY3RpdmVRdWVyeS5wcm90b3R5cGUsIHtcbiAgICAgICAgX3JlZnJlc2hJbmRleGVzOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB2YXIgcmVzdWx0cyA9IHRoaXMucmVzdWx0cyxcbiAgICAgICAgICAgICAgICBpbmRleEF0dHJpYnV0ZSA9IHRoaXMuaW5kZXhBdHRyaWJ1dGU7XG4gICAgICAgICAgICBpZiAoIXJlc3VsdHMpIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdBcnJhbmdlZFJlYWN0aXZlUXVlcnkgbXVzdCBiZSBpbml0aWFsaXNlZCcpO1xuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCByZXN1bHRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgdmFyIG1vZGVsSW5zdGFuY2UgPSByZXN1bHRzW2ldO1xuICAgICAgICAgICAgICAgIG1vZGVsSW5zdGFuY2VbaW5kZXhBdHRyaWJ1dGVdID0gaTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgX21lcmdlSW5kZXhlczogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdmFyIHJlc3VsdHMgPSB0aGlzLnJlc3VsdHMsXG4gICAgICAgICAgICAgICAgbmV3UmVzdWx0cyA9IFtdLFxuICAgICAgICAgICAgICAgIG91dE9mQm91bmRzID0gW10sXG4gICAgICAgICAgICAgICAgdW5pbmRleGVkID0gW107XG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHJlc3VsdHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICB2YXIgcmVzID0gcmVzdWx0c1tpXSxcbiAgICAgICAgICAgICAgICAgICAgc3RvcmVkSW5kZXggPSByZXNbdGhpcy5pbmRleEF0dHJpYnV0ZV07XG4gICAgICAgICAgICAgICAgaWYgKHN0b3JlZEluZGV4ID09IHVuZGVmaW5lZCkgeyAvLyBudWxsIG9yIHVuZGVmaW5lZFxuICAgICAgICAgICAgICAgICAgICB1bmluZGV4ZWQucHVzaChyZXMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIGlmIChzdG9yZWRJbmRleCA+IHJlc3VsdHMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgIG91dE9mQm91bmRzLnB1c2gocmVzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIEhhbmRsZSBkdXBsaWNhdGUgaW5kZXhlc1xuICAgICAgICAgICAgICAgICAgICBpZiAoIW5ld1Jlc3VsdHNbc3RvcmVkSW5kZXhdKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBuZXdSZXN1bHRzW3N0b3JlZEluZGV4XSA9IHJlcztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHVuaW5kZXhlZC5wdXNoKHJlcyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBvdXRPZkJvdW5kcyA9IF8uc29ydEJ5KG91dE9mQm91bmRzLCBmdW5jdGlvbiAoeCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB4W3RoaXMuaW5kZXhBdHRyaWJ1dGVdO1xuICAgICAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgICAgICAgIC8vIFNoaWZ0IHRoZSBpbmRleCBvZiBhbGwgbW9kZWxzIHdpdGggaW5kZXhlcyBvdXQgb2YgYm91bmRzIGludG8gdGhlIGNvcnJlY3QgcmFuZ2UuXG4gICAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgb3V0T2ZCb3VuZHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICByZXMgPSBvdXRPZkJvdW5kc1tpXTtcbiAgICAgICAgICAgICAgICB2YXIgcmVzdWx0c0luZGV4ID0gdGhpcy5yZXN1bHRzLmxlbmd0aCAtIG91dE9mQm91bmRzLmxlbmd0aCArIGk7XG4gICAgICAgICAgICAgICAgcmVzW3RoaXMuaW5kZXhBdHRyaWJ1dGVdID0gcmVzdWx0c0luZGV4O1xuICAgICAgICAgICAgICAgIG5ld1Jlc3VsdHNbcmVzdWx0c0luZGV4XSA9IHJlcztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHVuaW5kZXhlZCA9IHRoaXMuX3F1ZXJ5Ll9zb3J0UmVzdWx0cyh1bmluZGV4ZWQpO1xuICAgICAgICAgICAgdmFyIG4gPSAwO1xuICAgICAgICAgICAgd2hpbGUgKHVuaW5kZXhlZC5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICByZXMgPSB1bmluZGV4ZWQuc2hpZnQoKTtcbiAgICAgICAgICAgICAgICB3aGlsZSAobmV3UmVzdWx0c1tuXSkge1xuICAgICAgICAgICAgICAgICAgICBuKys7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIG5ld1Jlc3VsdHNbbl0gPSByZXM7XG4gICAgICAgICAgICAgICAgcmVzW3RoaXMuaW5kZXhBdHRyaWJ1dGVdID0gbjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5yZXN1bHRzID0gY29uc3RydWN0UXVlcnlTZXQobmV3UmVzdWx0cywgdGhpcy5tb2RlbCk7XG4gICAgICAgIH0sXG4gICAgICAgIGluaXQ6IGZ1bmN0aW9uIChjYikge1xuICAgICAgICAgICAgcmV0dXJuIHV0aWwucHJvbWlzZShjYiwgZnVuY3Rpb24gKGNiKSB7XG4gICAgICAgICAgICAgICAgUmVhY3RpdmVRdWVyeS5wcm90b3R5cGUuaW5pdC5jYWxsKHRoaXMsIGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghdGhpcy5tb2RlbC5oYXNBdHRyaWJ1dGVOYW1lZCh0aGlzLmluZGV4QXR0cmlidXRlKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVyciA9IGVycm9yKCdNb2RlbCBcIicgKyB0aGlzLm1vZGVsLm5hbWUgKyAnXCIgZG9lcyBub3QgaGF2ZSBhbiBhdHRyaWJ1dGUgbmFtZWQgXCInICsgdGhpcy5pbmRleEF0dHJpYnV0ZSArICdcIicpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fbWVyZ2VJbmRleGVzKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fcXVlcnkuY2xlYXJPcmRlcmluZygpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGNiKGVyciwgZXJyID8gbnVsbCA6IHRoaXMucmVzdWx0cyk7XG4gICAgICAgICAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICAgIH0sXG4gICAgICAgIF9oYW5kbGVOb3RpZjogZnVuY3Rpb24gKG4pIHtcbiAgICAgICAgICAgIC8vIFdlIGRvbid0IHdhbnQgdG8ga2VlcCBleGVjdXRpbmcgdGhlIHF1ZXJ5IGVhY2ggdGltZSB0aGUgaW5kZXggZXZlbnQgZmlyZXMgYXMgd2UncmUgY2hhbmdpbmcgdGhlIGluZGV4IG91cnNlbHZlc1xuICAgICAgICAgICAgaWYgKG4uZmllbGQgIT0gdGhpcy5pbmRleEF0dHJpYnV0ZSkge1xuICAgICAgICAgICAgICAgIFJlYWN0aXZlUXVlcnkucHJvdG90eXBlLl9oYW5kbGVOb3RpZi5jYWxsKHRoaXMsIG4pO1xuICAgICAgICAgICAgICAgIHRoaXMuX3JlZnJlc2hJbmRleGVzKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHZhbGlkYXRlSW5kZXg6IGZ1bmN0aW9uIChpZHgpIHtcbiAgICAgICAgICAgIHZhciBtYXhJbmRleCA9IHRoaXMucmVzdWx0cy5sZW5ndGggLSAxLFxuICAgICAgICAgICAgICAgIG1pbkluZGV4ID0gMDtcbiAgICAgICAgICAgIGlmICghKGlkeCA+PSBtaW5JbmRleCAmJiBpZHggPD0gbWF4SW5kZXgpKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbmRleCAnICsgaWR4LnRvU3RyaW5nKCkgKyAnIGlzIG91dCBvZiBib3VuZHMnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgc3dhcE9iamVjdHNBdEluZGV4ZXM6IGZ1bmN0aW9uIChmcm9tLCB0bykge1xuICAgICAgICAgICAgLy9ub2luc3BlY3Rpb24gVW5uZWNlc3NhcnlMb2NhbFZhcmlhYmxlSlNcbiAgICAgICAgICAgIHRoaXMudmFsaWRhdGVJbmRleChmcm9tKTtcbiAgICAgICAgICAgIHRoaXMudmFsaWRhdGVJbmRleCh0byk7XG4gICAgICAgICAgICB2YXIgZnJvbU1vZGVsID0gdGhpcy5yZXN1bHRzW2Zyb21dLFxuICAgICAgICAgICAgICAgIHRvTW9kZWwgPSB0aGlzLnJlc3VsdHNbdG9dO1xuICAgICAgICAgICAgaWYgKCFmcm9tTW9kZWwpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ05vIG1vZGVsIGF0IGluZGV4IFwiJyArIGZyb20udG9TdHJpbmcoKSArICdcIicpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKCF0b01vZGVsKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdObyBtb2RlbCBhdCBpbmRleCBcIicgKyB0by50b1N0cmluZygpICsgJ1wiJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLnJlc3VsdHNbdG9dID0gZnJvbU1vZGVsO1xuICAgICAgICAgICAgdGhpcy5yZXN1bHRzW2Zyb21dID0gdG9Nb2RlbDtcbiAgICAgICAgICAgIGZyb21Nb2RlbFt0aGlzLmluZGV4QXR0cmlidXRlXSA9IHRvO1xuICAgICAgICAgICAgdG9Nb2RlbFt0aGlzLmluZGV4QXR0cmlidXRlXSA9IGZyb207XG4gICAgICAgIH0sXG4gICAgICAgIHN3YXBPYmplY3RzOiBmdW5jdGlvbiAob2JqMSwgb2JqMikge1xuICAgICAgICAgICAgdmFyIGZyb21JZHggPSB0aGlzLnJlc3VsdHMuaW5kZXhPZihvYmoxKSxcbiAgICAgICAgICAgICAgICB0b0lkeCA9IHRoaXMucmVzdWx0cy5pbmRleE9mKG9iajIpO1xuICAgICAgICAgICAgdGhpcy5zd2FwT2JqZWN0c0F0SW5kZXhlcyhmcm9tSWR4LCB0b0lkeCk7XG4gICAgICAgIH0sXG4gICAgICAgIG1vdmU6IGZ1bmN0aW9uIChmcm9tLCB0bykge1xuICAgICAgICAgICAgdGhpcy52YWxpZGF0ZUluZGV4KGZyb20pO1xuICAgICAgICAgICAgdGhpcy52YWxpZGF0ZUluZGV4KHRvKTtcbiAgICAgICAgICAgIHZhciByZXN1bHRzID0gdGhpcy5yZXN1bHRzLm11dGFibGVDb3B5KCk7XG4gICAgICAgICAgICAoZnVuY3Rpb24gKG9sZEluZGV4LCBuZXdJbmRleCkge1xuICAgICAgICAgICAgICAgIGlmIChuZXdJbmRleCA+PSB0aGlzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgayA9IG5ld0luZGV4IC0gdGhpcy5sZW5ndGg7XG4gICAgICAgICAgICAgICAgICAgIHdoaWxlICgoay0tKSArIDEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucHVzaCh1bmRlZmluZWQpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSkuY2FsbChyZXN1bHRzLCBmcm9tLCB0byk7XG4gICAgICAgICAgICB2YXIgcmVtb3ZlZCA9IHJlc3VsdHMuc3BsaWNlKGZyb20sIDEpWzBdO1xuICAgICAgICAgICAgdGhpcy5yZXN1bHRzID0gcmVzdWx0cy5hc01vZGVsUXVlcnlTZXQodGhpcy5tb2RlbCk7XG4gICAgICAgICAgICB0aGlzLmVtaXQoJ2NoYW5nZScsIHtcbiAgICAgICAgICAgICAgICBpbmRleDogZnJvbSxcbiAgICAgICAgICAgICAgICByZW1vdmVkOiBbcmVtb3ZlZF0sXG4gICAgICAgICAgICAgICAgdHlwZTogbW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUuU3BsaWNlLFxuICAgICAgICAgICAgICAgIG9iajogdGhpcyxcbiAgICAgICAgICAgICAgICBmaWVsZDogJ3Jlc3VsdHMnXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJlc3VsdHMuc3BsaWNlKHRvLCAwLCByZW1vdmVkKTtcbiAgICAgICAgICAgIHRoaXMucmVzdWx0cyA9IHJlc3VsdHMuYXNNb2RlbFF1ZXJ5U2V0KHRoaXMubW9kZWwpO1xuICAgICAgICAgICAgdGhpcy5lbWl0KCdjaGFuZ2UnLCB7XG4gICAgICAgICAgICAgICAgaW5kZXg6IHRvLFxuICAgICAgICAgICAgICAgIGFkZGVkOiBbcmVtb3ZlZF0sXG4gICAgICAgICAgICAgICAgdHlwZTogbW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUuU3BsaWNlLFxuICAgICAgICAgICAgICAgIG9iajogdGhpcyxcbiAgICAgICAgICAgICAgICBmaWVsZDogJ3Jlc3VsdHMnXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHRoaXMuX3JlZnJlc2hJbmRleGVzKCk7XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIG1vZHVsZS5leHBvcnRzID0gQXJyYW5nZWRSZWFjdGl2ZVF1ZXJ5O1xufSkoKTsiLCIoZnVuY3Rpb24gKCkge1xuICAgIC8qKlxuICAgICAqIEBtb2R1bGUgcmVsYXRpb25zaGlwc1xuICAgICAqL1xuXG4gICAgdmFyIFJlbGF0aW9uc2hpcFByb3h5ID0gcmVxdWlyZSgnLi9SZWxhdGlvbnNoaXBQcm94eScpLFxuICAgICAgICBTdG9yZSA9IHJlcXVpcmUoJy4vc3RvcmUnKSxcbiAgICAgICAgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpLFxuICAgICAgICBfID0gdXRpbC5fLFxuICAgICAgICBJbnRlcm5hbFNpZXN0YUVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpLkludGVybmFsU2llc3RhRXJyb3IsXG4gICAgICAgIG1vZGVsRXZlbnRzID0gcmVxdWlyZSgnLi9tb2RlbEV2ZW50cycpLFxuICAgICAgICBldmVudHMgPSByZXF1aXJlKCcuL2V2ZW50cycpLFxuICAgICAgICB3cmFwQXJyYXlGb3JBdHRyaWJ1dGVzID0gZXZlbnRzLndyYXBBcnJheSxcbiAgICAgICAgU2llc3RhTW9kZWwgPSByZXF1aXJlKCcuL01vZGVsSW5zdGFuY2UnKSxcbiAgICAgICAgQXJyYXlPYnNlcnZlciA9IHJlcXVpcmUoJy4uL3ZlbmRvci9vYnNlcnZlLWpzL3NyYy9vYnNlcnZlJykuQXJyYXlPYnNlcnZlcixcbiAgICAgICAgTW9kZWxFdmVudFR5cGUgPSByZXF1aXJlKCcuL21vZGVsRXZlbnRzJykuTW9kZWxFdmVudFR5cGU7XG5cbiAgICAvKipcbiAgICAgKiBbTWFueVRvTWFueVByb3h5IGRlc2NyaXB0aW9uXVxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBvcHRzXG4gICAgICovXG4gICAgZnVuY3Rpb24gTWFueVRvTWFueVByb3h5KG9wdHMpIHtcbiAgICAgICAgUmVsYXRpb25zaGlwUHJveHkuY2FsbCh0aGlzLCBvcHRzKTtcbiAgICAgICAgdGhpcy5yZWxhdGVkID0gW107XG4gICAgICAgIHRoaXMucmVsYXRlZENhbmNlbExpc3RlbmVycyA9IHt9O1xuICAgIH1cblxuICAgIE1hbnlUb01hbnlQcm94eS5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKFJlbGF0aW9uc2hpcFByb3h5LnByb3RvdHlwZSk7XG5cbiAgICBfLmV4dGVuZChNYW55VG9NYW55UHJveHkucHJvdG90eXBlLCB7XG4gICAgICAgIGNsZWFyUmV2ZXJzZTogZnVuY3Rpb24gKHJlbW92ZWQpIHtcbiAgICAgICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgICAgIF8uZWFjaChyZW1vdmVkLCBmdW5jdGlvbiAocmVtb3ZlZE9iamVjdCkge1xuICAgICAgICAgICAgICAgIHZhciByZXZlcnNlUHJveHkgPSBzZWxmLnJldmVyc2VQcm94eUZvckluc3RhbmNlKHJlbW92ZWRPYmplY3QpO1xuICAgICAgICAgICAgICAgIHZhciBpZHggPSByZXZlcnNlUHJveHkucmVsYXRlZC5pbmRleE9mKHNlbGYub2JqZWN0KTtcbiAgICAgICAgICAgICAgICByZXZlcnNlUHJveHkubWFrZUNoYW5nZXNUb1JlbGF0ZWRXaXRob3V0T2JzZXJ2YXRpb25zKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV2ZXJzZVByb3h5LnNwbGljZShpZHgsIDEpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0sXG4gICAgICAgIHNldFJldmVyc2VPZkFkZGVkOiBmdW5jdGlvbiAoYWRkZWQpIHtcbiAgICAgICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgICAgIF8uZWFjaChhZGRlZCwgZnVuY3Rpb24gKGFkZGVkT2JqZWN0KSB7XG4gICAgICAgICAgICAgICAgdmFyIHJldmVyc2VQcm94eSA9IHNlbGYucmV2ZXJzZVByb3h5Rm9ySW5zdGFuY2UoYWRkZWRPYmplY3QpO1xuICAgICAgICAgICAgICAgIHJldmVyc2VQcm94eS5tYWtlQ2hhbmdlc1RvUmVsYXRlZFdpdGhvdXRPYnNlcnZhdGlvbnMoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICByZXZlcnNlUHJveHkuc3BsaWNlKDAsIDAsIHNlbGYub2JqZWN0KTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9LFxuICAgICAgICB3cmFwQXJyYXk6IGZ1bmN0aW9uIChhcnIpIHtcbiAgICAgICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgICAgIHdyYXBBcnJheUZvckF0dHJpYnV0ZXMoYXJyLCB0aGlzLnJldmVyc2VOYW1lLCB0aGlzLm9iamVjdCk7XG4gICAgICAgICAgICBpZiAoIWFyci5hcnJheU9ic2VydmVyKSB7XG4gICAgICAgICAgICAgICAgYXJyLmFycmF5T2JzZXJ2ZXIgPSBuZXcgQXJyYXlPYnNlcnZlcihhcnIpO1xuICAgICAgICAgICAgICAgIHZhciBvYnNlcnZlckZ1bmN0aW9uID0gZnVuY3Rpb24gKHNwbGljZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgc3BsaWNlcy5mb3JFYWNoKGZ1bmN0aW9uIChzcGxpY2UpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBhZGRlZCA9IHNwbGljZS5hZGRlZENvdW50ID8gYXJyLnNsaWNlKHNwbGljZS5pbmRleCwgc3BsaWNlLmluZGV4ICsgc3BsaWNlLmFkZGVkQ291bnQpIDogW107XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgcmVtb3ZlZCA9IHNwbGljZS5yZW1vdmVkO1xuICAgICAgICAgICAgICAgICAgICAgICAgc2VsZi5jbGVhclJldmVyc2UocmVtb3ZlZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBzZWxmLnNldFJldmVyc2VPZkFkZGVkKGFkZGVkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBtb2RlbCA9IHNlbGYuZ2V0Rm9yd2FyZE1vZGVsKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBtb2RlbEV2ZW50cy5lbWl0KHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb2xsZWN0aW9uOiBtb2RlbC5jb2xsZWN0aW9uTmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtb2RlbDogbW9kZWwubmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBfaWQ6IHNlbGYub2JqZWN0Ll9pZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmaWVsZDogc2VsZi5nZXRGb3J3YXJkTmFtZSgpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlbW92ZWQ6IHJlbW92ZWQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYWRkZWQ6IGFkZGVkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6IE1vZGVsRXZlbnRUeXBlLlNwbGljZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbmRleDogc3BsaWNlLmluZGV4LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9iajogc2VsZi5vYmplY3RcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIGFyci5hcnJheU9ic2VydmVyLm9wZW4ob2JzZXJ2ZXJGdW5jdGlvbik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIGdldDogZnVuY3Rpb24gKGNiKSB7XG4gICAgICAgICAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbiAoY2IpIHtcbiAgICAgICAgICAgICAgICBjYihudWxsLCB0aGlzLnJlbGF0ZWQpO1xuICAgICAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgICAgfSxcbiAgICAgICAgdmFsaWRhdGU6IGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgICAgIGlmIChPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwob2JqKSAhPSAnW29iamVjdCBBcnJheV0nKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuICdDYW5ub3QgYXNzaWduIHNjYWxhciB0byBtYW55IHRvIG1hbnknO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH0sXG4gICAgICAgIHNldDogZnVuY3Rpb24gKG9iaiwgb3B0cykge1xuICAgICAgICAgICAgdGhpcy5jaGVja0luc3RhbGxlZCgpO1xuICAgICAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICAgICAgaWYgKG9iaikge1xuICAgICAgICAgICAgICAgIHZhciBlcnJvck1lc3NhZ2U7XG4gICAgICAgICAgICAgICAgaWYgKGVycm9yTWVzc2FnZSA9IHRoaXMudmFsaWRhdGUob2JqKSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZXJyb3JNZXNzYWdlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5jbGVhclJldmVyc2VSZWxhdGVkKG9wdHMpO1xuICAgICAgICAgICAgICAgICAgICBzZWxmLnNldElkQW5kUmVsYXRlZChvYmosIG9wdHMpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLndyYXBBcnJheShvYmopO1xuICAgICAgICAgICAgICAgICAgICBzZWxmLnNldElkQW5kUmVsYXRlZFJldmVyc2Uob2JqLCBvcHRzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLmNsZWFyUmV2ZXJzZVJlbGF0ZWQob3B0cyk7XG4gICAgICAgICAgICAgICAgc2VsZi5zZXRJZEFuZFJlbGF0ZWQob2JqLCBvcHRzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgaW5zdGFsbDogZnVuY3Rpb24gKG9iaikge1xuICAgICAgICAgICAgUmVsYXRpb25zaGlwUHJveHkucHJvdG90eXBlLmluc3RhbGwuY2FsbCh0aGlzLCBvYmopO1xuICAgICAgICAgICAgdGhpcy53cmFwQXJyYXkodGhpcy5yZWxhdGVkKTtcbiAgICAgICAgICAgIG9ialsoJ3NwbGljZScgKyB1dGlsLmNhcGl0YWxpc2VGaXJzdExldHRlcih0aGlzLnJldmVyc2VOYW1lKSldID0gXy5iaW5kKHRoaXMuc3BsaWNlLCB0aGlzKTtcbiAgICAgICAgfSxcbiAgICAgICAgcmVnaXN0ZXJSZW1vdmFsTGlzdGVuZXI6IGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgICAgIHRoaXMucmVsYXRlZENhbmNlbExpc3RlbmVyc1tvYmouX2lkXSA9IG9iai5saXN0ZW4oZnVuY3Rpb24gKGUpIHtcblxuICAgICAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgICAgfVxuICAgIH0pO1xuXG5cbiAgICBtb2R1bGUuZXhwb3J0cyA9IE1hbnlUb01hbnlQcm94eTtcbn0pKCk7IiwiKGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgbG9nID0gcmVxdWlyZSgnLi9sb2cnKSxcbiAgICAgICAgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpLFxuICAgICAgICBfID0gdXRpbC5fLFxuICAgICAgICBlcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKSxcbiAgICAgICAgSW50ZXJuYWxTaWVzdGFFcnJvciA9IGVycm9yLkludGVybmFsU2llc3RhRXJyb3IsXG4gICAgICAgIG1vZGVsRXZlbnRzID0gcmVxdWlyZSgnLi9tb2RlbEV2ZW50cycpLFxuICAgICAgICBldmVudHMgPSByZXF1aXJlKCcuL2V2ZW50cycpLFxuICAgICAgICBjYWNoZSA9IHJlcXVpcmUoJy4vY2FjaGUnKTtcblxuICAgIGZ1bmN0aW9uIE1vZGVsSW5zdGFuY2UobW9kZWwpIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICB0aGlzLm1vZGVsID0gbW9kZWw7XG5cbiAgICAgICAgdXRpbC5zdWJQcm9wZXJ0aWVzKHRoaXMsIHRoaXMubW9kZWwsIFtcbiAgICAgICAgICAgICdjb2xsZWN0aW9uJyxcbiAgICAgICAgICAgICdjb2xsZWN0aW9uTmFtZScsXG4gICAgICAgICAgICAnX2F0dHJpYnV0ZU5hbWVzJyxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBuYW1lOiAnaWRGaWVsZCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydHk6ICdpZCdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgbmFtZTogJ21vZGVsTmFtZScsXG4gICAgICAgICAgICAgICAgcHJvcGVydHk6ICduYW1lJ1xuICAgICAgICAgICAgfVxuICAgICAgICBdKTtcblxuICAgICAgICBldmVudHMuUHJveHlFdmVudEVtaXR0ZXIuY2FsbCh0aGlzKTtcblxuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydGllcyh0aGlzLCB7XG4gICAgICAgICAgICBfcmVsYXRpb25zaGlwTmFtZXM6IHtcbiAgICAgICAgICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHByb3hpZXMgPSBfLm1hcChPYmplY3Qua2V5cyhzZWxmLl9fcHJveGllcyB8fCB7fSksIGZ1bmN0aW9uICh4KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gc2VsZi5fX3Byb3hpZXNbeF1cbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBfLm1hcChwcm94aWVzLCBmdW5jdGlvbiAocCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHAuaXNGb3J3YXJkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHAuZm9yd2FyZE5hbWU7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBwLnJldmVyc2VOYW1lO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgICAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgZGlydHk6IHtcbiAgICAgICAgICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHNpZXN0YS5leHQuc3RvcmFnZUVuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBzZWxmLl9pZCBpbiBzaWVzdGEuZXh0LnN0b3JhZ2UuX3Vuc2F2ZWRPYmplY3RzSGFzaDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBlbHNlIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgLy8gVGhpcyBpcyBmb3IgUHJveHlFdmVudEVtaXR0ZXIuXG4gICAgICAgICAgICBldmVudDoge1xuICAgICAgICAgICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5faWRcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRoaXMucmVtb3ZlZCA9IGZhbHNlO1xuICAgIH1cblxuICAgIE1vZGVsSW5zdGFuY2UucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShldmVudHMuUHJveHlFdmVudEVtaXR0ZXIucHJvdG90eXBlKTtcblxuICAgIF8uZXh0ZW5kKE1vZGVsSW5zdGFuY2UucHJvdG90eXBlLCB7XG4gICAgICAgIGdldDogZnVuY3Rpb24gKGNiKSB7XG4gICAgICAgICAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbiAoY2IpIHtcbiAgICAgICAgICAgICAgICBjYihudWxsLCB0aGlzKTtcbiAgICAgICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICAgIH0sXG4gICAgICAgIGVtaXQ6IGZ1bmN0aW9uICh0eXBlLCBvcHRzKSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIHR5cGUgPT0gJ29iamVjdCcpIG9wdHMgPSB0eXBlO1xuICAgICAgICAgICAgZWxzZSBvcHRzLnR5cGUgPSB0eXBlO1xuICAgICAgICAgICAgb3B0cyA9IG9wdHMgfHwge307XG4gICAgICAgICAgICBfLmV4dGVuZChvcHRzLCB7XG4gICAgICAgICAgICAgICAgY29sbGVjdGlvbjogdGhpcy5jb2xsZWN0aW9uTmFtZSxcbiAgICAgICAgICAgICAgICBtb2RlbDogdGhpcy5tb2RlbC5uYW1lLFxuICAgICAgICAgICAgICAgIF9pZDogdGhpcy5faWQsXG4gICAgICAgICAgICAgICAgb2JqOiB0aGlzXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIG1vZGVsRXZlbnRzLmVtaXQob3B0cyk7XG4gICAgICAgIH0sXG4gICAgICAgIHJlbW92ZTogZnVuY3Rpb24gKGNiLCBub3RpZmljYXRpb24pIHtcbiAgICAgICAgICAgIG5vdGlmaWNhdGlvbiA9IG5vdGlmaWNhdGlvbiA9PSBudWxsID8gdHJ1ZSA6IG5vdGlmaWNhdGlvbjtcbiAgICAgICAgICAgIHJldHVybiB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uIChjYikge1xuICAgICAgICAgICAgICAgIGNhY2hlLnJlbW92ZSh0aGlzKTtcbiAgICAgICAgICAgICAgICB0aGlzLnJlbW92ZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgIGlmIChub3RpZmljYXRpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5lbWl0KG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlLlJlbW92ZSwge1xuICAgICAgICAgICAgICAgICAgICAgICAgb2xkOiB0aGlzXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB2YXIgcmVtb3ZlID0gdGhpcy5tb2RlbC5yZW1vdmU7XG4gICAgICAgICAgICAgICAgaWYgKHJlbW92ZSkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgcGFyYW1OYW1lcyA9IHV0aWwucGFyYW1OYW1lcyhyZW1vdmUpO1xuICAgICAgICAgICAgICAgICAgICBpZiAocGFyYW1OYW1lcy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlbW92ZS5jYWxsKHRoaXMsIGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYihlcnIsIHNlbGYpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZW1vdmUuY2FsbCh0aGlzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNiKG51bGwsIHRoaXMpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBjYihudWxsLCB0aGlzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICB9LFxuICAgICAgICByZXN0b3JlOiBmdW5jdGlvbiAoY2IpIHtcbiAgICAgICAgICAgIHJldHVybiB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uIChjYikge1xuICAgICAgICAgICAgICAgIHZhciBfZmluaXNoID0gZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5lbWl0KG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlLk5ldywge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5ldzogdGhpc1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgY2IoZXJyLCB0aGlzKTtcbiAgICAgICAgICAgICAgICB9LmJpbmQodGhpcyk7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMucmVtb3ZlZCkge1xuICAgICAgICAgICAgICAgICAgICBjYWNoZS5pbnNlcnQodGhpcyk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMucmVtb3ZlZCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICB2YXIgaW5pdCA9IHRoaXMubW9kZWwuaW5pdDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGluaXQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBwYXJhbU5hbWVzID0gdXRpbC5wYXJhbU5hbWVzKGluaXQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGZyb21TdG9yYWdlID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChwYXJhbU5hbWVzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbml0LmNhbGwodGhpcywgZnJvbVN0b3JhZ2UsIF9maW5pc2gpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaW5pdC5jYWxsKHRoaXMsIGZyb21TdG9yYWdlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBfZmluaXNoKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBfZmluaXNoKCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBJbnNwZWN0aW9uXG4gICAgXy5leHRlbmQoTW9kZWxJbnN0YW5jZS5wcm90b3R5cGUsIHtcbiAgICAgICAgZ2V0QXR0cmlidXRlczogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIF8uZXh0ZW5kKHt9LCB0aGlzLl9fdmFsdWVzKTtcbiAgICAgICAgfSxcbiAgICAgICAgaXNJbnN0YW5jZU9mOiBmdW5jdGlvbiAobW9kZWwpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLm1vZGVsID09IG1vZGVsO1xuICAgICAgICB9LFxuICAgICAgICBpc0E6IGZ1bmN0aW9uIChtb2RlbCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMubW9kZWwgPT0gbW9kZWwgfHwgdGhpcy5tb2RlbC5pc0Rlc2NlbmRhbnRPZihtb2RlbCk7XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIER1bXBcbiAgICBfLmV4dGVuZChNb2RlbEluc3RhbmNlLnByb3RvdHlwZSwge1xuICAgICAgICBfZHVtcFN0cmluZzogZnVuY3Rpb24gKHJldmVyc2VSZWxhdGlvbnNoaXBzKSB7XG4gICAgICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkodGhpcy5fZHVtcChyZXZlcnNlUmVsYXRpb25zaGlwcywgbnVsbCwgNCkpO1xuICAgICAgICB9LFxuICAgICAgICBfZHVtcDogZnVuY3Rpb24gKHJldmVyc2VSZWxhdGlvbnNoaXBzKSB7XG4gICAgICAgICAgICB2YXIgZHVtcGVkID0gXy5leHRlbmQoe30sIHRoaXMuX192YWx1ZXMpO1xuICAgICAgICAgICAgZHVtcGVkLl9yZXYgPSB0aGlzLl9yZXY7XG4gICAgICAgICAgICBkdW1wZWQuX2lkID0gdGhpcy5faWQ7XG4gICAgICAgICAgICByZXR1cm4gZHVtcGVkO1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICBtb2R1bGUuZXhwb3J0cyA9IE1vZGVsSW5zdGFuY2U7XG5cblxufSkoKTsiLCIoZnVuY3Rpb24gKCkge1xuICAgIHZhciBSZWxhdGlvbnNoaXBQcm94eSA9IHJlcXVpcmUoJy4vUmVsYXRpb25zaGlwUHJveHknKSxcbiAgICAgICAgU3RvcmUgPSByZXF1aXJlKCcuL3N0b3JlJyksXG4gICAgICAgIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKSxcbiAgICAgICAgXyA9IHV0aWwuXyxcbiAgICAgICAgSW50ZXJuYWxTaWVzdGFFcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKS5JbnRlcm5hbFNpZXN0YUVycm9yLFxuICAgICAgICBtb2RlbEV2ZW50cyA9IHJlcXVpcmUoJy4vbW9kZWxFdmVudHMnKSxcbiAgICAgICAgZXZlbnRzID0gcmVxdWlyZSgnLi9ldmVudHMnKSxcbiAgICAgICAgd3JhcEFycmF5Rm9yQXR0cmlidXRlcyA9IGV2ZW50cy53cmFwQXJyYXksXG4gICAgICAgIEFycmF5T2JzZXJ2ZXIgPSByZXF1aXJlKCcuLi92ZW5kb3Ivb2JzZXJ2ZS1qcy9zcmMvb2JzZXJ2ZScpLkFycmF5T2JzZXJ2ZXIsXG4gICAgICAgIE1vZGVsRXZlbnRUeXBlID0gcmVxdWlyZSgnLi9tb2RlbEV2ZW50cycpLk1vZGVsRXZlbnRUeXBlO1xuXG4gICAgLyoqXG4gICAgICogQGNsYXNzICBbT25lVG9NYW55UHJveHkgZGVzY3JpcHRpb25dXG4gICAgICogQGNvbnN0cnVjdG9yXG4gICAgICogQHBhcmFtIHtbdHlwZV19IG9wdHNcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBPbmVUb01hbnlQcm94eShvcHRzKSB7XG4gICAgICAgIFJlbGF0aW9uc2hpcFByb3h5LmNhbGwodGhpcywgb3B0cyk7XG4gICAgICAgIGlmICh0aGlzLmlzUmV2ZXJzZSkgdGhpcy5yZWxhdGVkID0gW107XG4gICAgfVxuXG4gICAgT25lVG9NYW55UHJveHkucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShSZWxhdGlvbnNoaXBQcm94eS5wcm90b3R5cGUpO1xuXG4gICAgXy5leHRlbmQoT25lVG9NYW55UHJveHkucHJvdG90eXBlLCB7XG4gICAgICAgIGNsZWFyUmV2ZXJzZTogZnVuY3Rpb24gKHJlbW92ZWQpIHtcbiAgICAgICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgICAgIF8uZWFjaChyZW1vdmVkLCBmdW5jdGlvbiAocmVtb3ZlZE9iamVjdCkge1xuICAgICAgICAgICAgICAgIHZhciByZXZlcnNlUHJveHkgPSBzZWxmLnJldmVyc2VQcm94eUZvckluc3RhbmNlKHJlbW92ZWRPYmplY3QpO1xuICAgICAgICAgICAgICAgIHJldmVyc2VQcm94eS5zZXRJZEFuZFJlbGF0ZWQobnVsbCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSxcbiAgICAgICAgc2V0UmV2ZXJzZU9mQWRkZWQ6IGZ1bmN0aW9uIChhZGRlZCkge1xuICAgICAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICAgICAgXy5lYWNoKGFkZGVkLCBmdW5jdGlvbiAoYWRkZWQpIHtcbiAgICAgICAgICAgICAgICB2YXIgZm9yd2FyZFByb3h5ID0gc2VsZi5yZXZlcnNlUHJveHlGb3JJbnN0YW5jZShhZGRlZCk7XG4gICAgICAgICAgICAgICAgZm9yd2FyZFByb3h5LnNldElkQW5kUmVsYXRlZChzZWxmLm9iamVjdCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSxcbiAgICAgICAgd3JhcEFycmF5OiBmdW5jdGlvbiAoYXJyKSB7XG4gICAgICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgICAgICB3cmFwQXJyYXlGb3JBdHRyaWJ1dGVzKGFyciwgdGhpcy5yZXZlcnNlTmFtZSwgdGhpcy5vYmplY3QpO1xuICAgICAgICAgICAgaWYgKCFhcnIuYXJyYXlPYnNlcnZlcikge1xuICAgICAgICAgICAgICAgIGFyci5hcnJheU9ic2VydmVyID0gbmV3IEFycmF5T2JzZXJ2ZXIoYXJyKTtcbiAgICAgICAgICAgICAgICB2YXIgb2JzZXJ2ZXJGdW5jdGlvbiA9IGZ1bmN0aW9uIChzcGxpY2VzKSB7XG4gICAgICAgICAgICAgICAgICAgIHNwbGljZXMuZm9yRWFjaChmdW5jdGlvbiAoc3BsaWNlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgYWRkZWQgPSBzcGxpY2UuYWRkZWRDb3VudCA/IGFyci5zbGljZShzcGxpY2UuaW5kZXgsIHNwbGljZS5pbmRleCArIHNwbGljZS5hZGRlZENvdW50KSA6IFtdO1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHJlbW92ZWQgPSBzcGxpY2UucmVtb3ZlZDtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYuY2xlYXJSZXZlcnNlKHJlbW92ZWQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgc2VsZi5zZXRSZXZlcnNlT2ZBZGRlZChhZGRlZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgbW9kZWwgPSBzZWxmLmdldEZvcndhcmRNb2RlbCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgbW9kZWxFdmVudHMuZW1pdCh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29sbGVjdGlvbjogbW9kZWwuY29sbGVjdGlvbk5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbW9kZWw6IG1vZGVsLm5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgX2lkOiBzZWxmLm9iamVjdC5faWQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZmllbGQ6IHNlbGYuZ2V0Rm9yd2FyZE5hbWUoKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZW1vdmVkOiByZW1vdmVkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFkZGVkOiBhZGRlZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiBNb2RlbEV2ZW50VHlwZS5TcGxpY2UsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaW5kZXg6IHNwbGljZS5pbmRleCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBvYmo6IHNlbGYub2JqZWN0XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICBhcnIuYXJyYXlPYnNlcnZlci5vcGVuKG9ic2VydmVyRnVuY3Rpb24pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICBnZXQ6IGZ1bmN0aW9uIChjYikge1xuICAgICAgICAgICAgcmV0dXJuIHV0aWwucHJvbWlzZShjYiwgZnVuY3Rpb24gKGNiKSB7XG4gICAgICAgICAgICAgICAgY2IobnVsbCwgdGhpcy5yZWxhdGVkKTtcbiAgICAgICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICAgIH0sXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBWYWxpZGF0ZSB0aGUgb2JqZWN0IHRoYXQgd2UncmUgc2V0dGluZ1xuICAgICAgICAgKiBAcGFyYW0gb2JqXG4gICAgICAgICAqIEByZXR1cm5zIHtzdHJpbmd8bnVsbH0gQW4gZXJyb3IgbWVzc2FnZSBvciBudWxsXG4gICAgICAgICAqIEBjbGFzcyBPbmVUb01hbnlQcm94eVxuICAgICAgICAgKi9cbiAgICAgICAgdmFsaWRhdGU6IGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgICAgIHZhciBzdHIgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwob2JqKTtcbiAgICAgICAgICAgIGlmICh0aGlzLmlzRm9yd2FyZCkge1xuICAgICAgICAgICAgICAgIGlmIChzdHIgPT0gJ1tvYmplY3QgQXJyYXldJykge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gJ0Nhbm5vdCBhc3NpZ24gYXJyYXkgZm9yd2FyZCBvbmVUb01hbnkgKCcgKyBzdHIgKyAnKTogJyArIHRoaXMuZm9yd2FyZE5hbWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgaWYgKHN0ciAhPSAnW29iamVjdCBBcnJheV0nKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiAnQ2Fubm90IHNjYWxhciB0byByZXZlcnNlIG9uZVRvTWFueSAoJyArIHN0ciArICcpOiAnICsgdGhpcy5yZXZlcnNlTmFtZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfSxcbiAgICAgICAgc2V0OiBmdW5jdGlvbiAob2JqLCBvcHRzKSB7XG4gICAgICAgICAgICB0aGlzLmNoZWNrSW5zdGFsbGVkKCk7XG4gICAgICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgICAgICBpZiAob2JqKSB7XG4gICAgICAgICAgICAgICAgdmFyIGVycm9yTWVzc2FnZTtcbiAgICAgICAgICAgICAgICBpZiAoZXJyb3JNZXNzYWdlID0gdGhpcy52YWxpZGF0ZShvYmopKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBlcnJvck1lc3NhZ2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmNsZWFyUmV2ZXJzZVJlbGF0ZWQob3B0cyk7XG4gICAgICAgICAgICAgICAgICAgIHNlbGYuc2V0SWRBbmRSZWxhdGVkKG9iaiwgb3B0cyk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChzZWxmLmlzUmV2ZXJzZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy53cmFwQXJyYXkoc2VsZi5yZWxhdGVkKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBzZWxmLnNldElkQW5kUmVsYXRlZFJldmVyc2Uob2JqLCBvcHRzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLmNsZWFyUmV2ZXJzZVJlbGF0ZWQob3B0cyk7XG4gICAgICAgICAgICAgICAgc2VsZi5zZXRJZEFuZFJlbGF0ZWQob2JqLCBvcHRzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgaW5zdGFsbDogZnVuY3Rpb24gKG9iaikge1xuICAgICAgICAgICAgUmVsYXRpb25zaGlwUHJveHkucHJvdG90eXBlLmluc3RhbGwuY2FsbCh0aGlzLCBvYmopO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5pc1JldmVyc2UpIHtcbiAgICAgICAgICAgICAgICBvYmpbKCdzcGxpY2UnICsgdXRpbC5jYXBpdGFsaXNlRmlyc3RMZXR0ZXIodGhpcy5yZXZlcnNlTmFtZSkpXSA9IF8uYmluZCh0aGlzLnNwbGljZSwgdGhpcyk7XG4gICAgICAgICAgICAgICAgdGhpcy53cmFwQXJyYXkodGhpcy5yZWxhdGVkKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICB9XG4gICAgfSk7XG5cblxuICAgIG1vZHVsZS5leHBvcnRzID0gT25lVG9NYW55UHJveHk7XG59KSgpOyIsIihmdW5jdGlvbiAoKSB7XG4gICAgdmFyIFJlbGF0aW9uc2hpcFByb3h5ID0gcmVxdWlyZSgnLi9SZWxhdGlvbnNoaXBQcm94eScpLFxuICAgICAgICB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyksXG4gICAgICAgIF8gPSB1dGlsLl8sXG4gICAgICAgIFNpZXN0YU1vZGVsID0gcmVxdWlyZSgnLi9Nb2RlbEluc3RhbmNlJyk7XG5cbiAgICAvKipcbiAgICAgKiBbT25lVG9PbmVQcm94eSBkZXNjcmlwdGlvbl1cbiAgICAgKiBAcGFyYW0ge09iamVjdH0gb3B0c1xuICAgICAqL1xuICAgIGZ1bmN0aW9uIE9uZVRvT25lUHJveHkob3B0cykge1xuICAgICAgICBSZWxhdGlvbnNoaXBQcm94eS5jYWxsKHRoaXMsIG9wdHMpO1xuICAgIH1cblxuXG4gICAgT25lVG9PbmVQcm94eS5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKFJlbGF0aW9uc2hpcFByb3h5LnByb3RvdHlwZSk7XG5cbiAgICBfLmV4dGVuZChPbmVUb09uZVByb3h5LnByb3RvdHlwZSwge1xuICAgICAgICAvKipcbiAgICAgICAgICogVmFsaWRhdGUgdGhlIG9iamVjdCB0aGF0IHdlJ3JlIHNldHRpbmdcbiAgICAgICAgICogQHBhcmFtIG9ialxuICAgICAgICAgKiBAcmV0dXJucyB7c3RyaW5nfG51bGx9IEFuIGVycm9yIG1lc3NhZ2Ugb3IgbnVsbFxuICAgICAgICAgKi9cbiAgICAgICAgdmFsaWRhdGU6IGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgICAgIGlmIChPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwob2JqKSA9PSAnW29iamVjdCBBcnJheV0nKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuICdDYW5ub3QgYXNzaWduIGFycmF5IHRvIG9uZSB0byBvbmUgcmVsYXRpb25zaGlwJztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKCghb2JqIGluc3RhbmNlb2YgU2llc3RhTW9kZWwpKSB7XG5cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9LFxuICAgICAgICBzZXQ6IGZ1bmN0aW9uIChvYmosIG9wdHMpIHtcbiAgICAgICAgICAgIHRoaXMuY2hlY2tJbnN0YWxsZWQoKTtcbiAgICAgICAgICAgIGlmIChvYmopIHtcbiAgICAgICAgICAgICAgICB2YXIgZXJyb3JNZXNzYWdlO1xuICAgICAgICAgICAgICAgIGlmIChlcnJvck1lc3NhZ2UgPSB0aGlzLnZhbGlkYXRlKG9iaikpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGVycm9yTWVzc2FnZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY2xlYXJSZXZlcnNlUmVsYXRlZChvcHRzKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zZXRJZEFuZFJlbGF0ZWQob2JqLCBvcHRzKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zZXRJZEFuZFJlbGF0ZWRSZXZlcnNlKG9iaiwgb3B0cyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5jbGVhclJldmVyc2VSZWxhdGVkKG9wdHMpO1xuICAgICAgICAgICAgICAgIHRoaXMuc2V0SWRBbmRSZWxhdGVkKG9iaiwgb3B0cyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIGdldDogZnVuY3Rpb24gKGNiKSB7XG4gICAgICAgICAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbiAoY2IpIHtcbiAgICAgICAgICAgICAgICBjYihudWxsLCB0aGlzLnJlbGF0ZWQpO1xuICAgICAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgICAgfVxuICAgIH0pO1xuXG5cbiAgICBtb2R1bGUuZXhwb3J0cyA9IE9uZVRvT25lUHJveHk7XG59KSgpOyIsIihmdW5jdGlvbiAoKSB7XG4gICAgdmFyIGxvZyA9IHJlcXVpcmUoJy4vbG9nJykoJ3F1ZXJ5JyksXG4gICAgICAgIGNhY2hlID0gcmVxdWlyZSgnLi9jYWNoZScpLFxuICAgICAgICB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyksXG4gICAgICAgIGVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpLFxuICAgICAgICBjb25zdHJ1Y3RRdWVyeVNldCA9IHJlcXVpcmUoJy4vUXVlcnlTZXQnKSxcbiAgICAgICAgXyA9IHV0aWwuXztcblxuICAgIC8qKlxuICAgICAqIEBjbGFzcyBbUXVlcnkgZGVzY3JpcHRpb25dXG4gICAgICogQHBhcmFtIHtNb2RlbH0gbW9kZWxcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gcXVlcnlcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBRdWVyeShtb2RlbCwgcXVlcnkpIHtcbiAgICAgICAgdmFyIG9wdHMgPSB7fTtcbiAgICAgICAgZm9yICh2YXIgcHJvcCBpbiBxdWVyeSkge1xuICAgICAgICAgICAgaWYgKHF1ZXJ5Lmhhc093blByb3BlcnR5KHByb3ApKSB7XG4gICAgICAgICAgICAgICAgaWYgKHByb3Auc2xpY2UoMCwgMikgPT0gJ19fJykge1xuICAgICAgICAgICAgICAgICAgICBvcHRzW3Byb3Auc2xpY2UoMildID0gcXVlcnlbcHJvcF07XG4gICAgICAgICAgICAgICAgICAgIGRlbGV0ZSBxdWVyeVtwcm9wXTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgXy5leHRlbmQodGhpcywge1xuICAgICAgICAgICAgbW9kZWw6IG1vZGVsLFxuICAgICAgICAgICAgcXVlcnk6IHF1ZXJ5LFxuICAgICAgICAgICAgb3B0czogb3B0c1xuICAgICAgICB9KTtcbiAgICAgICAgb3B0cy5vcmRlciA9IG9wdHMub3JkZXIgfHwgW107XG4gICAgICAgIGlmICghdXRpbC5pc0FycmF5KG9wdHMub3JkZXIpKSBvcHRzLm9yZGVyID0gW29wdHMub3JkZXJdO1xuICAgIH1cblxuICAgIHZhciBjb21wYXJhdG9ycyA9IHtcbiAgICAgICAgZTogZnVuY3Rpb24gKG9wdHMpIHtcbiAgICAgICAgICAgIHZhciBvYmplY3RWYWx1ZSA9IG9wdHMub2JqZWN0W29wdHMuZmllbGRdO1xuICAgICAgICAgICAgaWYgKGxvZy5lbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgdmFyIHN0cmluZ1ZhbHVlO1xuICAgICAgICAgICAgICAgIGlmIChvYmplY3RWYWx1ZSA9PT0gbnVsbCkgc3RyaW5nVmFsdWUgPSAnbnVsbCc7XG4gICAgICAgICAgICAgICAgZWxzZSBpZiAob2JqZWN0VmFsdWUgPT09IHVuZGVmaW5lZCkgc3RyaW5nVmFsdWUgPSAndW5kZWZpbmVkJztcbiAgICAgICAgICAgICAgICBlbHNlIHN0cmluZ1ZhbHVlID0gb2JqZWN0VmFsdWUudG9TdHJpbmcoKTtcbiAgICAgICAgICAgICAgICBsb2cob3B0cy5maWVsZCArICc6ICcgKyBzdHJpbmdWYWx1ZSArICcgPT0gJyArIG9wdHMudmFsdWUudG9TdHJpbmcoKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gb2JqZWN0VmFsdWUgPT0gb3B0cy52YWx1ZTtcbiAgICAgICAgfSxcbiAgICAgICAgbHQ6IGZ1bmN0aW9uIChvcHRzKSB7XG4gICAgICAgICAgICBpZiAoIW9wdHMuaW52YWxpZCkgcmV0dXJuIG9wdHMub2JqZWN0W29wdHMuZmllbGRdIDwgb3B0cy52YWx1ZTtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfSxcbiAgICAgICAgZ3Q6IGZ1bmN0aW9uIChvcHRzKSB7XG4gICAgICAgICAgICBpZiAoIW9wdHMuaW52YWxpZCkgcmV0dXJuIG9wdHMub2JqZWN0W29wdHMuZmllbGRdID4gb3B0cy52YWx1ZTtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfSxcbiAgICAgICAgbHRlOiBmdW5jdGlvbiAob3B0cykge1xuICAgICAgICAgICAgaWYgKCFvcHRzLmludmFsaWQpIHJldHVybiBvcHRzLm9iamVjdFtvcHRzLmZpZWxkXSA8PSBvcHRzLnZhbHVlO1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9LFxuICAgICAgICBndGU6IGZ1bmN0aW9uIChvcHRzKSB7XG4gICAgICAgICAgICBpZiAoIW9wdHMuaW52YWxpZCkgcmV0dXJuIG9wdHMub2JqZWN0W29wdHMuZmllbGRdID49IG9wdHMudmFsdWU7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH0sXG4gICAgICAgIGNvbnRhaW5zOiBmdW5jdGlvbiAob3B0cykge1xuICAgICAgICAgICAgaWYgKCFvcHRzLmludmFsaWQpIHtcbiAgICAgICAgICAgICAgICB2YXIgYXJyID0gb3B0cy5vYmplY3Rbb3B0cy5maWVsZF07XG4gICAgICAgICAgICAgICAgaWYgKHV0aWwuaXNBcnJheShhcnIpIHx8IHV0aWwuaXNTdHJpbmcoYXJyKSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gYXJyLmluZGV4T2Yob3B0cy52YWx1ZSkgPiAtMTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgXy5leHRlbmQoUXVlcnksIHtcbiAgICAgICAgY29tcGFyYXRvcnM6IGNvbXBhcmF0b3JzLFxuICAgICAgICByZWdpc3RlckNvbXBhcmF0b3I6IGZ1bmN0aW9uIChzeW1ib2wsIGZuKSB7XG4gICAgICAgICAgICBpZiAoIWNvbXBhcmF0b3JzW3N5bWJvbF0pIHtcbiAgICAgICAgICAgICAgICBjb21wYXJhdG9yc1tzeW1ib2xdID0gZm47XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIGZ1bmN0aW9uIGNhY2hlRm9yTW9kZWwobW9kZWwpIHtcbiAgICAgICAgdmFyIGNhY2hlQnlUeXBlID0gY2FjaGUuX2xvY2FsQ2FjaGVCeVR5cGU7XG4gICAgICAgIHZhciBtb2RlbE5hbWUgPSBtb2RlbC5uYW1lO1xuICAgICAgICB2YXIgY29sbGVjdGlvbk5hbWUgPSBtb2RlbC5jb2xsZWN0aW9uTmFtZTtcbiAgICAgICAgdmFyIGNhY2hlQnlNb2RlbCA9IGNhY2hlQnlUeXBlW2NvbGxlY3Rpb25OYW1lXTtcbiAgICAgICAgdmFyIGNhY2hlQnlMb2NhbElkO1xuICAgICAgICBpZiAoY2FjaGVCeU1vZGVsKSB7XG4gICAgICAgICAgICBjYWNoZUJ5TG9jYWxJZCA9IGNhY2hlQnlNb2RlbFttb2RlbE5hbWVdIHx8IHt9O1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBjYWNoZUJ5TG9jYWxJZDtcbiAgICB9XG5cbiAgICBfLmV4dGVuZChRdWVyeS5wcm90b3R5cGUsIHtcbiAgICAgICAgZXhlY3V0ZTogZnVuY3Rpb24gKGNiKSB7XG4gICAgICAgICAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbiAoY2IpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9leGVjdXRlSW5NZW1vcnkoY2IpO1xuICAgICAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgICAgfSxcbiAgICAgICAgX2R1bXA6IGZ1bmN0aW9uIChhc0pzb24pIHtcbiAgICAgICAgICAgIHJldHVybiBhc0pzb24gPyAne30nIDoge307XG4gICAgICAgIH0sXG4gICAgICAgIHNvcnRGdW5jOiBmdW5jdGlvbiAoZmllbGRzKSB7XG4gICAgICAgICAgICB2YXIgc29ydEZ1bmMgPSBmdW5jdGlvbiAoYXNjZW5kaW5nLCBmaWVsZCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbiAodjEsIHYyKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBkMSA9IHYxW2ZpZWxkXSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGQyID0gdjJbZmllbGRdLFxuICAgICAgICAgICAgICAgICAgICAgICAgcmVzO1xuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGQxID09ICdzdHJpbmcnIHx8IGQxIGluc3RhbmNlb2YgU3RyaW5nICYmXG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlb2YgZDIgPT0gJ3N0cmluZycgfHwgZDIgaW5zdGFuY2VvZiBTdHJpbmcpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlcyA9IGFzY2VuZGluZyA/IGQxLmxvY2FsZUNvbXBhcmUoZDIpIDogZDIubG9jYWxlQ29tcGFyZShkMSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZDEgaW5zdGFuY2VvZiBEYXRlKSBkMSA9IGQxLmdldFRpbWUoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChkMiBpbnN0YW5jZW9mIERhdGUpIGQyID0gZDIuZ2V0VGltZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGFzY2VuZGluZykgcmVzID0gZDEgLSBkMjtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsc2UgcmVzID0gZDIgLSBkMTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gcmVzO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICB2YXIgcyA9IHV0aWw7XG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGZpZWxkcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIHZhciBmaWVsZCA9IGZpZWxkc1tpXTtcbiAgICAgICAgICAgICAgICBzID0gcy50aGVuQnkoc29ydEZ1bmMoZmllbGQuYXNjZW5kaW5nLCBmaWVsZC5maWVsZCkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHMgPT0gdXRpbCA/IG51bGwgOiBzO1xuICAgICAgICB9LFxuICAgICAgICBfc29ydFJlc3VsdHM6IGZ1bmN0aW9uIChyZXMpIHtcbiAgICAgICAgICAgIHZhciBvcmRlciA9IHRoaXMub3B0cy5vcmRlcjtcbiAgICAgICAgICAgIGlmIChyZXMgJiYgb3JkZXIpIHtcbiAgICAgICAgICAgICAgICB2YXIgZmllbGRzID0gXy5tYXAob3JkZXIsIGZ1bmN0aW9uIChvcmRlcmluZykge1xuICAgICAgICAgICAgICAgICAgICB2YXIgc3BsdCA9IG9yZGVyaW5nLnNwbGl0KCctJyksXG4gICAgICAgICAgICAgICAgICAgICAgICBhc2NlbmRpbmcgPSB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgZmllbGQgPSBudWxsO1xuICAgICAgICAgICAgICAgICAgICBpZiAoc3BsdC5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBmaWVsZCA9IHNwbHRbMV07XG4gICAgICAgICAgICAgICAgICAgICAgICBhc2NlbmRpbmcgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZpZWxkID0gc3BsdFswXTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4ge2ZpZWxkOiBmaWVsZCwgYXNjZW5kaW5nOiBhc2NlbmRpbmd9O1xuICAgICAgICAgICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICAgICAgICAgICAgdmFyIHNvcnRGdW5jID0gdGhpcy5zb3J0RnVuYyhmaWVsZHMpO1xuICAgICAgICAgICAgICAgIGlmIChyZXMuaW1tdXRhYmxlKSByZXMgPSByZXMubXV0YWJsZUNvcHkoKTtcbiAgICAgICAgICAgICAgICBpZiAoc29ydEZ1bmMpIHJlcy5zb3J0KHNvcnRGdW5jKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiByZXM7XG4gICAgICAgIH0sXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBSZXR1cm4gYWxsIG1vZGVsIGluc3RhbmNlcyBpbiB0aGUgY2FjaGUuXG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICBfZ2V0Q2FjaGVCeUxvY2FsSWQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiBfLnJlZHVjZSh0aGlzLm1vZGVsLmRlc2NlbmRhbnRzLCBmdW5jdGlvbiAobWVtbywgY2hpbGRNb2RlbCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBfLmV4dGVuZChtZW1vLCBjYWNoZUZvck1vZGVsKGNoaWxkTW9kZWwpKTtcbiAgICAgICAgICAgIH0sIF8uZXh0ZW5kKHt9LCBjYWNoZUZvck1vZGVsKHRoaXMubW9kZWwpKSk7XG4gICAgICAgIH0sXG4gICAgICAgIF9leGVjdXRlSW5NZW1vcnk6IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgICAgICAgICAgdmFyIF9leGVjdXRlSW5NZW1vcnkgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgdmFyIGNhY2hlQnlMb2NhbElkID0gdGhpcy5fZ2V0Q2FjaGVCeUxvY2FsSWQoKTtcbiAgICAgICAgICAgICAgICB2YXIga2V5cyA9IE9iamVjdC5rZXlzKGNhY2hlQnlMb2NhbElkKTtcbiAgICAgICAgICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgICAgICAgICAgdmFyIHJlcyA9IFtdO1xuICAgICAgICAgICAgICAgIHZhciBlcnI7XG4gICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBrZXlzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBrID0ga2V5c1tpXTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIG9iaiA9IGNhY2hlQnlMb2NhbElkW2tdO1xuICAgICAgICAgICAgICAgICAgICB2YXIgbWF0Y2hlcyA9IHNlbGYub2JqZWN0TWF0Y2hlc1F1ZXJ5KG9iaik7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YobWF0Y2hlcykgPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVyciA9IGVycm9yKG1hdGNoZXMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobWF0Y2hlcykgcmVzLnB1c2gob2JqKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXMgPSB0aGlzLl9zb3J0UmVzdWx0cyhyZXMpO1xuICAgICAgICAgICAgICAgIGlmIChlcnIpIGxvZygnRXJyb3IgZXhlY3V0aW5nIHF1ZXJ5JywgZXJyKTtcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIsIGVyciA/IG51bGwgOiBjb25zdHJ1Y3RRdWVyeVNldChyZXMsIHRoaXMubW9kZWwpKTtcbiAgICAgICAgICAgIH0uYmluZCh0aGlzKTtcbiAgICAgICAgICAgIGlmICh0aGlzLm9wdHMuaWdub3JlSW5zdGFsbGVkKSB7XG4gICAgICAgICAgICAgICAgX2V4ZWN1dGVJbk1lbW9yeSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgc2llc3RhLl9hZnRlckluc3RhbGwoX2V4ZWN1dGVJbk1lbW9yeSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfSxcbiAgICAgICAgY2xlYXJPcmRlcmluZzogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdGhpcy5vcHRzLm9yZGVyID0gbnVsbDtcbiAgICAgICAgfSxcbiAgICAgICAgb2JqZWN0TWF0Y2hlc09yUXVlcnk6IGZ1bmN0aW9uIChvYmosIG9yUXVlcnkpIHtcbiAgICAgICAgICAgIGZvciAodmFyIGlkeCBpbiBvclF1ZXJ5KSB7XG4gICAgICAgICAgICAgICAgaWYgKG9yUXVlcnkuaGFzT3duUHJvcGVydHkoaWR4KSkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgcXVlcnkgPSBvclF1ZXJ5W2lkeF07XG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLm9iamVjdE1hdGNoZXNCYXNlUXVlcnkob2JqLCBxdWVyeSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9LFxuICAgICAgICBvYmplY3RNYXRjaGVzQW5kUXVlcnk6IGZ1bmN0aW9uIChvYmosIGFuZFF1ZXJ5KSB7XG4gICAgICAgICAgICBmb3IgKHZhciBpZHggaW4gYW5kUXVlcnkpIHtcbiAgICAgICAgICAgICAgICBpZiAoYW5kUXVlcnkuaGFzT3duUHJvcGVydHkoaWR4KSkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgcXVlcnkgPSBhbmRRdWVyeVtpZHhdO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIXRoaXMub2JqZWN0TWF0Y2hlc0Jhc2VRdWVyeShvYmosIHF1ZXJ5KSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH0sXG4gICAgICAgIHNwbGl0TWF0Y2hlczogZnVuY3Rpb24gKG9iaiwgdW5wcm9jZXNzZWRGaWVsZCwgdmFsdWUpIHtcbiAgICAgICAgICAgIHZhciBvcCA9ICdlJztcbiAgICAgICAgICAgIHZhciBmaWVsZHMgPSB1bnByb2Nlc3NlZEZpZWxkLnNwbGl0KCcuJyk7XG4gICAgICAgICAgICB2YXIgc3BsdCA9IGZpZWxkc1tmaWVsZHMubGVuZ3RoIC0gMV0uc3BsaXQoJ19fJyk7XG4gICAgICAgICAgICBpZiAoc3BsdC5sZW5ndGggPT0gMikge1xuICAgICAgICAgICAgICAgIHZhciBmaWVsZCA9IHNwbHRbMF07XG4gICAgICAgICAgICAgICAgb3AgPSBzcGx0WzFdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgZmllbGQgPSBzcGx0WzBdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZmllbGRzW2ZpZWxkcy5sZW5ndGggLSAxXSA9IGZpZWxkO1xuICAgICAgICAgICAgXy5lYWNoKGZpZWxkcy5zbGljZSgwLCBmaWVsZHMubGVuZ3RoIC0gMSksIGZ1bmN0aW9uIChmKSB7XG4gICAgICAgICAgICAgICAgb2JqID0gb2JqW2ZdO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAvLyBJZiB3ZSBnZXQgdG8gdGhlIHBvaW50IHdoZXJlIHdlJ3JlIGFib3V0IHRvIGluZGV4IG51bGwgb3IgdW5kZWZpbmVkIHdlIHN0b3AgLSBvYnZpb3VzbHkgdGhpcyBvYmplY3QgZG9lc1xuICAgICAgICAgICAgLy8gbm90IG1hdGNoIHRoZSBxdWVyeS5cbiAgICAgICAgICAgIHZhciBub3ROdWxsT3JVbmRlZmluZWQgPSBvYmogIT0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgaWYgKG5vdE51bGxPclVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIHZhciB2YWwgPSBvYmpbZmllbGRdOyAvLyBCcmVha3MgaGVyZS5cbiAgICAgICAgICAgICAgICB2YXIgaW52YWxpZCA9IHZhbCA9PT0gbnVsbCB8fCB2YWwgPT09IHVuZGVmaW5lZDtcbiAgICAgICAgICAgICAgICB2YXIgY29tcGFyYXRvciA9IFF1ZXJ5LmNvbXBhcmF0b3JzW29wXSxcbiAgICAgICAgICAgICAgICAgICAgb3B0cyA9IHtvYmplY3Q6IG9iaiwgZmllbGQ6IGZpZWxkLCB2YWx1ZTogdmFsdWUsIGludmFsaWQ6IGludmFsaWR9O1xuICAgICAgICAgICAgICAgIGlmICghY29tcGFyYXRvcikge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gJ05vIGNvbXBhcmF0b3IgcmVnaXN0ZXJlZCBmb3IgcXVlcnkgb3BlcmF0aW9uIFwiJyArIG9wICsgJ1wiJztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIGNvbXBhcmF0b3Iob3B0cyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH0sXG4gICAgICAgIG9iamVjdE1hdGNoZXM6IGZ1bmN0aW9uIChvYmosIHVucHJvY2Vzc2VkRmllbGQsIHZhbHVlLCBxdWVyeSkge1xuICAgICAgICAgICAgaWYgKHVucHJvY2Vzc2VkRmllbGQgPT0gJyRvcicpIHtcbiAgICAgICAgICAgICAgICBpZiAoIXRoaXMub2JqZWN0TWF0Y2hlc09yUXVlcnkob2JqLCBxdWVyeVsnJG9yJ10pKSByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmICh1bnByb2Nlc3NlZEZpZWxkID09ICckYW5kJykge1xuICAgICAgICAgICAgICAgIGlmICghdGhpcy5vYmplY3RNYXRjaGVzQW5kUXVlcnkob2JqLCBxdWVyeVsnJGFuZCddKSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgdmFyIG1hdGNoZXMgPSB0aGlzLnNwbGl0TWF0Y2hlcyhvYmosIHVucHJvY2Vzc2VkRmllbGQsIHZhbHVlKTtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIG1hdGNoZXMgIT0gJ2Jvb2xlYW4nKSByZXR1cm4gbWF0Y2hlcztcbiAgICAgICAgICAgICAgICBpZiAoIW1hdGNoZXMpIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9LFxuICAgICAgICBvYmplY3RNYXRjaGVzQmFzZVF1ZXJ5OiBmdW5jdGlvbiAob2JqLCBxdWVyeSkge1xuICAgICAgICAgICAgdmFyIGZpZWxkcyA9IE9iamVjdC5rZXlzKHF1ZXJ5KTtcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgZmllbGRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgdmFyIHVucHJvY2Vzc2VkRmllbGQgPSBmaWVsZHNbaV0sXG4gICAgICAgICAgICAgICAgICAgIHZhbHVlID0gcXVlcnlbdW5wcm9jZXNzZWRGaWVsZF07XG4gICAgICAgICAgICAgICAgdmFyIHJ0ID0gdGhpcy5vYmplY3RNYXRjaGVzKG9iaiwgdW5wcm9jZXNzZWRGaWVsZCwgdmFsdWUsIHF1ZXJ5KTtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIHJ0ICE9ICdib29sZWFuJykgcmV0dXJuIHJ0O1xuICAgICAgICAgICAgICAgIGlmICghcnQpIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9LFxuICAgICAgICBvYmplY3RNYXRjaGVzUXVlcnk6IGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLm9iamVjdE1hdGNoZXNCYXNlUXVlcnkob2JqLCB0aGlzLnF1ZXJ5KTtcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBRdWVyeTtcbn0pKCk7IiwidmFyIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKSxcbiAgICBQcm9taXNlID0gdXRpbC5Qcm9taXNlLFxuICAgIGVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpLFxuICAgIE1vZGVsSW5zdGFuY2UgPSByZXF1aXJlKCcuL01vZGVsSW5zdGFuY2UnKSxcbiAgICBfID0gcmVxdWlyZSgnLi91dGlsJykuXztcblxuLypcbiBUT0RPOiBVc2UgRVM2IFByb3h5IGluc3RlYWQuXG4gRXZlbnR1YWxseSBxdWVyeSBzZXRzIHNob3VsZCB1c2UgRVM2IFByb3hpZXMgd2hpY2ggd2lsbCBiZSBtdWNoIG1vcmUgbmF0dXJhbCBhbmQgcm9idXN0LiBFLmcuIG5vIG5lZWQgZm9yIHRoZSBiZWxvd1xuICovXG52YXIgQVJSQVlfTUVUSE9EUyA9IFsncHVzaCcsICdzb3J0JywgJ3JldmVyc2UnLCAnc3BsaWNlJywgJ3NoaWZ0JywgJ3Vuc2hpZnQnXSxcbiAgICBOVU1CRVJfTUVUSE9EUyA9IFsndG9TdHJpbmcnLCAndG9FeHBvbmVudGlhbCcsICd0b0ZpeGVkJywgJ3RvUHJlY2lzaW9uJywgJ3ZhbHVlT2YnXSxcbiAgICBOVU1CRVJfUFJPUEVSVElFUyA9IFsnTUFYX1ZBTFVFJywgJ01JTl9WQUxVRScsICdORUdBVElWRV9JTkZJTklUWScsICdOYU4nLCAnUE9TSVRJVkVfSU5GSU5JVFknXSxcbiAgICBTVFJJTkdfTUVUSE9EUyA9IFsnY2hhckF0JywgJ2NoYXJDb2RlQXQnLCAnY29uY2F0JywgJ2Zyb21DaGFyQ29kZScsICdpbmRleE9mJywgJ2xhc3RJbmRleE9mJywgJ2xvY2FsZUNvbXBhcmUnLFxuICAgICAgICAnbWF0Y2gnLCAncmVwbGFjZScsICdzZWFyY2gnLCAnc2xpY2UnLCAnc3BsaXQnLCAnc3Vic3RyJywgJ3N1YnN0cmluZycsICd0b0xvY2FsZUxvd2VyQ2FzZScsICd0b0xvY2FsZVVwcGVyQ2FzZScsXG4gICAgICAgICd0b0xvd2VyQ2FzZScsICd0b1N0cmluZycsICd0b1VwcGVyQ2FzZScsICd0cmltJywgJ3ZhbHVlT2YnXSxcbiAgICBTVFJJTkdfUFJPUEVSVElFUyA9IFsnbGVuZ3RoJ107XG5cbi8qKlxuICogUmV0dXJuIHRoZSBwcm9wZXJ0eSBuYW1lcyBmb3IgYSBnaXZlbiBvYmplY3QuIEhhbmRsZXMgc3BlY2lhbCBjYXNlcyBzdWNoIGFzIHN0cmluZ3MgYW5kIG51bWJlcnMgdGhhdCBkbyBub3QgaGF2ZVxuICogdGhlIGdldE93blByb3BlcnR5TmFtZXMgZnVuY3Rpb24uXG4gKiBUaGUgc3BlY2lhbCBjYXNlcyBhcmUgdmVyeSBtdWNoIGhhY2tzLiBUaGlzIGhhY2sgY2FuIGJlIHJlbW92ZWQgb25jZSB0aGUgUHJveHkgb2JqZWN0IGlzIG1vcmUgd2lkZWx5IGFkb3B0ZWQuXG4gKiBAcGFyYW0gb2JqZWN0XG4gKiBAcmV0dXJucyB7QXJyYXl9XG4gKi9cbmZ1bmN0aW9uIGdldFByb3BlcnR5TmFtZXMob2JqZWN0KSB7XG4gICAgdmFyIHByb3BlcnR5TmFtZXM7XG4gICAgaWYgKHR5cGVvZiBvYmplY3QgPT0gJ3N0cmluZycgfHwgb2JqZWN0IGluc3RhbmNlb2YgU3RyaW5nKSB7XG4gICAgICAgIHByb3BlcnR5TmFtZXMgPSBTVFJJTkdfTUVUSE9EUy5jb25jYXQoU1RSSU5HX1BST1BFUlRJRVMpO1xuICAgIH1cbiAgICBlbHNlIGlmICh0eXBlb2Ygb2JqZWN0ID09ICdudW1iZXInIHx8IG9iamVjdCBpbnN0YW5jZW9mIE51bWJlcikge1xuICAgICAgICBwcm9wZXJ0eU5hbWVzID0gTlVNQkVSX01FVEhPRFMuY29uY2F0KE5VTUJFUl9QUk9QRVJUSUVTKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIHByb3BlcnR5TmFtZXMgPSBvYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcygpO1xuICAgIH1cbiAgICByZXR1cm4gcHJvcGVydHlOYW1lcztcbn1cblxuLyoqXG4gKiBEZWZpbmUgYSBwcm94eSBwcm9wZXJ0eSB0byBhdHRyaWJ1dGVzIG9uIG9iamVjdHMgaW4gdGhlIGFycmF5XG4gKiBAcGFyYW0gYXJyXG4gKiBAcGFyYW0gcHJvcFxuICovXG5mdW5jdGlvbiBkZWZpbmVBdHRyaWJ1dGUoYXJyLCBwcm9wKSB7XG4gICAgaWYgKCEocHJvcCBpbiBhcnIpKSB7IC8vIGUuZy4gd2UgY2Fubm90IHJlZGVmaW5lIC5sZW5ndGhcbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KGFyciwgcHJvcCwge1xuICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHF1ZXJ5U2V0KF8ucGx1Y2soYXJyLCBwcm9wKSk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgc2V0OiBmdW5jdGlvbiAodikge1xuICAgICAgICAgICAgICAgIGlmICh1dGlsLmlzQXJyYXkodikpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMubGVuZ3RoICE9IHYubGVuZ3RoKSB0aHJvdyBlcnJvcih7bWVzc2FnZTogJ011c3QgYmUgc2FtZSBsZW5ndGgnfSk7XG4gICAgICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdi5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpc1tpXVtwcm9wXSA9IHZbaV07XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCB0aGlzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzW2ldW3Byb3BdID0gdjtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBpc1Byb21pc2Uob2JqKSB7XG4gICAgLy8gVE9ETzogRG9uJ3QgdGhpbmsgdGhpcyBpcyB2ZXJ5IHJvYnVzdC5cbiAgICByZXR1cm4gb2JqLnRoZW4gJiYgb2JqLmNhdGNoO1xufVxuXG4vKipcbiAqIERlZmluZSBhIHByb3h5IG1ldGhvZCBvbiB0aGUgYXJyYXkgaWYgbm90IGFscmVhZHkgaW4gZXhpc3RlbmNlLlxuICogQHBhcmFtIGFyclxuICogQHBhcmFtIHByb3BcbiAqL1xuZnVuY3Rpb24gZGVmaW5lTWV0aG9kKGFyciwgcHJvcCkge1xuICAgIGlmICghKHByb3AgaW4gYXJyKSkgeyAvLyBlLmcuIHdlIGRvbid0IHdhbnQgdG8gcmVkZWZpbmUgdG9TdHJpbmdcbiAgICAgICAgYXJyW3Byb3BdID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdmFyIGFyZ3MgPSBhcmd1bWVudHMsXG4gICAgICAgICAgICAgICAgcmVzID0gdGhpcy5tYXAoZnVuY3Rpb24gKHApIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHBbcHJvcF0uYXBwbHkocCwgYXJncyk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB2YXIgYXJlUHJvbWlzZXMgPSBmYWxzZTtcbiAgICAgICAgICAgIGlmIChyZXMubGVuZ3RoKSBhcmVQcm9taXNlcyA9IGlzUHJvbWlzZShyZXNbMF0pO1xuICAgICAgICAgICAgcmV0dXJuIGFyZVByb21pc2VzID8gUHJvbWlzZS5hbGwocmVzKSA6IHF1ZXJ5U2V0KHJlcyk7XG4gICAgICAgIH07XG4gICAgfVxufVxuXG4vKipcbiAqIFRyYW5zZm9ybSB0aGUgYXJyYXkgaW50byBhIHF1ZXJ5IHNldC5cbiAqIFJlbmRlcnMgdGhlIGFycmF5IGltbXV0YWJsZS5cbiAqIEBwYXJhbSBhcnJcbiAqIEBwYXJhbSBtb2RlbCAtIFRoZSBtb2RlbCB3aXRoIHdoaWNoIHRvIHByb3h5IHRvXG4gKi9cbmZ1bmN0aW9uIG1vZGVsUXVlcnlTZXQoYXJyLCBtb2RlbCkge1xuICAgIGFyciA9IF8uZXh0ZW5kKFtdLCBhcnIpO1xuICAgIHZhciBhdHRyaWJ1dGVOYW1lcyA9IG1vZGVsLl9hdHRyaWJ1dGVOYW1lcyxcbiAgICAgICAgcmVsYXRpb25zaGlwTmFtZXMgPSBtb2RlbC5fcmVsYXRpb25zaGlwTmFtZXMsXG4gICAgICAgIG5hbWVzID0gYXR0cmlidXRlTmFtZXMuY29uY2F0KHJlbGF0aW9uc2hpcE5hbWVzKS5jb25jYXQoaW5zdGFuY2VNZXRob2RzKTtcbiAgICBuYW1lcy5mb3JFYWNoKF8ucGFydGlhbChkZWZpbmVBdHRyaWJ1dGUsIGFycikpO1xuICAgIHZhciBpbnN0YW5jZU1ldGhvZHMgPSBPYmplY3Qua2V5cyhNb2RlbEluc3RhbmNlLnByb3RvdHlwZSk7XG4gICAgaW5zdGFuY2VNZXRob2RzLmZvckVhY2goXy5wYXJ0aWFsKGRlZmluZU1ldGhvZCwgYXJyKSk7XG4gICAgcmV0dXJuIHJlbmRlckltbXV0YWJsZShhcnIpO1xufVxuXG4vKipcbiAqIFRyYW5zZm9ybSB0aGUgYXJyYXkgaW50byBhIHF1ZXJ5IHNldCwgYmFzZWQgb24gd2hhdGV2ZXIgaXMgaW4gaXQuXG4gKiBOb3RlIHRoYXQgYWxsIG9iamVjdHMgbXVzdCBiZSBvZiB0aGUgc2FtZSB0eXBlLiBUaGlzIGZ1bmN0aW9uIHdpbGwgdGFrZSB0aGUgZmlyc3Qgb2JqZWN0IGFuZCBkZWNpZGUgaG93IHRvIHByb3h5XG4gKiBiYXNlZCBvbiB0aGF0LlxuICogQHBhcmFtIGFyclxuICovXG5mdW5jdGlvbiBxdWVyeVNldChhcnIpIHtcbiAgICBpZiAoYXJyLmxlbmd0aCkge1xuICAgICAgICB2YXIgcmVmZXJlbmNlT2JqZWN0ID0gYXJyWzBdLFxuICAgICAgICAgICAgcHJvcGVydHlOYW1lcyA9IGdldFByb3BlcnR5TmFtZXMocmVmZXJlbmNlT2JqZWN0KTtcbiAgICAgICAgcHJvcGVydHlOYW1lcy5mb3JFYWNoKGZ1bmN0aW9uIChwcm9wKSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIHJlZmVyZW5jZU9iamVjdFtwcm9wXSA9PSAnZnVuY3Rpb24nKSBkZWZpbmVNZXRob2QoYXJyLCBwcm9wLCBhcmd1bWVudHMpO1xuICAgICAgICAgICAgZWxzZSBkZWZpbmVBdHRyaWJ1dGUoYXJyLCBwcm9wKTtcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIHJldHVybiByZW5kZXJJbW11dGFibGUoYXJyKTtcbn1cblxuZnVuY3Rpb24gdGhyb3dJbW11dGFibGVFcnJvcigpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0Nhbm5vdCBtb2RpZnkgYSBxdWVyeSBzZXQnKTtcbn1cblxuLyoqXG4gKiBSZW5kZXIgYW4gYXJyYXkgaW1tdXRhYmxlIGJ5IHJlcGxhY2luZyBhbnkgZnVuY3Rpb25zIHRoYXQgY2FuIG11dGF0ZSBpdC5cbiAqIEBwYXJhbSBhcnJcbiAqL1xuZnVuY3Rpb24gcmVuZGVySW1tdXRhYmxlKGFycikge1xuICAgIEFSUkFZX01FVEhPRFMuZm9yRWFjaChmdW5jdGlvbiAocCkge1xuICAgICAgICBhcnJbcF0gPSB0aHJvd0ltbXV0YWJsZUVycm9yO1xuICAgIH0pO1xuICAgIGFyci5pbW11dGFibGUgPSB0cnVlO1xuICAgIGFyci5tdXRhYmxlQ29weSA9IGFyci5hc0FycmF5ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgbXV0YWJsZUFyciA9IF8ubWFwKHRoaXMsIGZ1bmN0aW9uICh4KSB7cmV0dXJuIHh9KTtcbiAgICAgICAgbXV0YWJsZUFyci5hc1F1ZXJ5U2V0ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIHF1ZXJ5U2V0KHRoaXMpO1xuICAgICAgICB9O1xuICAgICAgICBtdXRhYmxlQXJyLmFzTW9kZWxRdWVyeVNldCA9IGZ1bmN0aW9uIChtb2RlbCkge1xuICAgICAgICAgICAgcmV0dXJuIG1vZGVsUXVlcnlTZXQodGhpcywgbW9kZWwpO1xuICAgICAgICB9O1xuICAgICAgICByZXR1cm4gbXV0YWJsZUFycjtcbiAgICB9O1xuICAgIHJldHVybiBhcnI7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gbW9kZWxRdWVyeVNldDsiLCIvKipcbiAqIEZvciB0aG9zZSBmYW1pbGlhciB3aXRoIEFwcGxlJ3MgQ29jb2EgbGlicmFyeSwgcmVhY3RpdmUgcXVlcmllcyByb3VnaGx5IG1hcCBvbnRvIE5TRmV0Y2hlZFJlc3VsdHNDb250cm9sbGVyLlxuICpcbiAqIFRoZXkgcHJlc2VudCBhIHF1ZXJ5IHNldCB0aGF0ICdyZWFjdHMnIHRvIGNoYW5nZXMgaW4gdGhlIHVuZGVybHlpbmcgZGF0YS5cbiAqIEBtb2R1bGUgcmVhY3RpdmVRdWVyeVxuICovXG5cblxuKGZ1bmN0aW9uICgpIHtcblxuICAgIHZhciBsb2cgPSByZXF1aXJlKCcuL2xvZycpKCdxdWVyeScpLFxuICAgICAgICBRdWVyeSA9IHJlcXVpcmUoJy4vUXVlcnknKSxcbiAgICAgICAgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnZXZlbnRzJykuRXZlbnRFbWl0dGVyLFxuICAgICAgICBldmVudHMgPSByZXF1aXJlKCcuL2V2ZW50cycpLFxuICAgICAgICBtb2RlbEV2ZW50cyA9IHJlcXVpcmUoJy4vbW9kZWxFdmVudHMnKSxcbiAgICAgICAgSW50ZXJuYWxTaWVzdGFFcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKS5JbnRlcm5hbFNpZXN0YUVycm9yLFxuICAgICAgICBjb25zdHJ1Y3RRdWVyeVNldCA9IHJlcXVpcmUoJy4vUXVlcnlTZXQnKSxcbiAgICAgICAgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpLFxuICAgICAgICBfID0gdXRpbC5fO1xuXG4gICAgLyoqXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1F1ZXJ5fSBxdWVyeSAtIFRoZSB1bmRlcmx5aW5nIHF1ZXJ5XG4gICAgICogQGNvbnN0cnVjdG9yXG4gICAgICovXG4gICAgZnVuY3Rpb24gUmVhY3RpdmVRdWVyeShxdWVyeSkge1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgIEV2ZW50RW1pdHRlci5jYWxsKHRoaXMpO1xuXG4gICAgICAgIF8uZXh0ZW5kKHRoaXMsIHtcbiAgICAgICAgICAgIF9xdWVyeTogcXVlcnksXG4gICAgICAgICAgICByZXN1bHRzOiBjb25zdHJ1Y3RRdWVyeVNldChbXSwgcXVlcnkubW9kZWwpLFxuICAgICAgICAgICAgaW5zZXJ0aW9uUG9saWN5OiBSZWFjdGl2ZVF1ZXJ5Lkluc2VydGlvblBvbGljeS5CYWNrLFxuICAgICAgICAgICAgaW5pdGlhbGlzZWQ6IGZhbHNlXG4gICAgICAgIH0pO1xuXG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKHRoaXMsIHtcbiAgICAgICAgICAgIGluaXRpYWxpemVkOiB7XG4gICAgICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmluaXRpYWxpc2VkXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIG1vZGVsOiB7XG4gICAgICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBzZWxmLl9xdWVyeS5tb2RlbFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBjb2xsZWN0aW9uOiB7XG4gICAgICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBzZWxmLm1vZGVsLmNvbGxlY3Rpb25OYW1lXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBSZWFjdGl2ZVF1ZXJ5LnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoRXZlbnRFbWl0dGVyLnByb3RvdHlwZSk7XG5cbiAgICBfLmV4dGVuZChSZWFjdGl2ZVF1ZXJ5LCB7XG4gICAgICAgIEluc2VydGlvblBvbGljeToge1xuICAgICAgICAgICAgRnJvbnQ6ICdGcm9udCcsXG4gICAgICAgICAgICBCYWNrOiAnQmFjaydcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgXy5leHRlbmQoUmVhY3RpdmVRdWVyeS5wcm90b3R5cGUsIHtcbiAgICAgICAgLyoqXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSBjYlxuICAgICAgICAgKiBAcGFyYW0ge2Jvb2x9IF9pZ25vcmVJbml0IC0gZXhlY3V0ZSBxdWVyeSBhZ2FpbiwgaW5pdGlhbGlzZWQgb3Igbm90LlxuICAgICAgICAgKiBAcmV0dXJucyB7Kn1cbiAgICAgICAgICovXG4gICAgICAgIGluaXQ6IGZ1bmN0aW9uIChjYiwgX2lnbm9yZUluaXQpIHtcbiAgICAgICAgICAgIGlmIChsb2cpIGxvZygnaW5pdCcpO1xuICAgICAgICAgICAgcmV0dXJuIHV0aWwucHJvbWlzZShjYiwgZnVuY3Rpb24gKGNiKSB7XG4gICAgICAgICAgICAgICAgaWYgKCghdGhpcy5pbml0aWFsaXNlZCkgfHwgX2lnbm9yZUluaXQpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fcXVlcnkuZXhlY3V0ZShmdW5jdGlvbiAoZXJyLCByZXN1bHRzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucmVzdWx0cyA9IHJlc3VsdHM7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCF0aGlzLmhhbmRsZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG5hbWUgPSB0aGlzLl9jb25zdHJ1Y3ROb3RpZmljYXRpb25OYW1lKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBoYW5kbGVyID0gZnVuY3Rpb24gKG4pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2hhbmRsZU5vdGlmKG4pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LmJpbmQodGhpcyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuaGFuZGxlciA9IGhhbmRsZXI7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50cy5vbihuYW1lLCBoYW5kbGVyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGxvZykgbG9nKCdMaXN0ZW5pbmcgdG8gJyArIG5hbWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuaW5pdGlhbGlzZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNiKG51bGwsIHRoaXMucmVzdWx0cyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYihlcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgY2IobnVsbCwgdGhpcy5yZXN1bHRzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICB9LFxuICAgICAgICBpbnNlcnQ6IGZ1bmN0aW9uIChuZXdPYmopIHtcbiAgICAgICAgICAgIHZhciByZXN1bHRzID0gdGhpcy5yZXN1bHRzLm11dGFibGVDb3B5KCk7XG4gICAgICAgICAgICBpZiAodGhpcy5pbnNlcnRpb25Qb2xpY3kgPT0gUmVhY3RpdmVRdWVyeS5JbnNlcnRpb25Qb2xpY3kuQmFjaykge1xuICAgICAgICAgICAgICAgIHZhciBpZHggPSByZXN1bHRzLnB1c2gobmV3T2JqKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGlkeCA9IHJlc3VsdHMudW5zaGlmdChuZXdPYmopO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5yZXN1bHRzID0gcmVzdWx0cy5hc01vZGVsUXVlcnlTZXQodGhpcy5tb2RlbCk7XG4gICAgICAgICAgICByZXR1cm4gaWR4O1xuICAgICAgICB9LFxuICAgICAgICAvKipcbiAgICAgICAgICogRXhlY3V0ZSB0aGUgdW5kZXJseWluZyBxdWVyeSBhZ2Fpbi5cbiAgICAgICAgICogQHBhcmFtIGNiXG4gICAgICAgICAqL1xuICAgICAgICB1cGRhdGU6IGZ1bmN0aW9uIChjYikge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuaW5pdChjYiwgdHJ1ZSlcbiAgICAgICAgfSxcbiAgICAgICAgX2hhbmRsZU5vdGlmOiBmdW5jdGlvbiAobikge1xuICAgICAgICAgICAgbG9nKCdfaGFuZGxlTm90aWYnLCBuKTtcbiAgICAgICAgICAgIGlmIChuLnR5cGUgPT0gbW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUuTmV3KSB7XG4gICAgICAgICAgICAgICAgdmFyIG5ld09iaiA9IG4ubmV3O1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLl9xdWVyeS5vYmplY3RNYXRjaGVzUXVlcnkobmV3T2JqKSkge1xuICAgICAgICAgICAgICAgICAgICBsb2coJ05ldyBvYmplY3QgbWF0Y2hlcycsIG5ld09iai5fZHVtcFN0cmluZygpKTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGlkeCA9IHRoaXMuaW5zZXJ0KG5ld09iaik7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZW1pdCgnY2hhbmdlJywge1xuICAgICAgICAgICAgICAgICAgICAgICAgaW5kZXg6IGlkeCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGFkZGVkOiBbbmV3T2JqXSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6IG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlLlNwbGljZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIG9iajogdGhpc1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZygnTmV3IG9iamVjdCBkb2VzIG5vdCBtYXRjaCcsIG5ld09iai5fZHVtcFN0cmluZygpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChuLnR5cGUgPT0gbW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUuU2V0KSB7XG4gICAgICAgICAgICAgICAgbmV3T2JqID0gbi5vYmo7XG4gICAgICAgICAgICAgICAgdmFyIGluZGV4ID0gdGhpcy5yZXN1bHRzLmluZGV4T2YobmV3T2JqKSxcbiAgICAgICAgICAgICAgICAgICAgYWxyZWFkeUNvbnRhaW5zID0gaW5kZXggPiAtMSxcbiAgICAgICAgICAgICAgICAgICAgbWF0Y2hlcyA9IHRoaXMuX3F1ZXJ5Lm9iamVjdE1hdGNoZXNRdWVyeShuZXdPYmopO1xuICAgICAgICAgICAgICAgIGlmIChtYXRjaGVzICYmICFhbHJlYWR5Q29udGFpbnMpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nKCdVcGRhdGVkIG9iamVjdCBub3cgbWF0Y2hlcyEnLCBuZXdPYmouX2R1bXBTdHJpbmcoKSk7XG4gICAgICAgICAgICAgICAgICAgIGlkeCA9IHRoaXMuaW5zZXJ0KG5ld09iaik7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZW1pdCgnY2hhbmdlJywge1xuICAgICAgICAgICAgICAgICAgICAgICAgaW5kZXg6IGlkeCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGFkZGVkOiBbbmV3T2JqXSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6IG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlLlNwbGljZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIG9iajogdGhpc1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSBpZiAoIW1hdGNoZXMgJiYgYWxyZWFkeUNvbnRhaW5zKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZygnVXBkYXRlZCBvYmplY3Qgbm8gbG9uZ2VyIG1hdGNoZXMhJywgbmV3T2JqLl9kdW1wU3RyaW5nKCkpO1xuICAgICAgICAgICAgICAgICAgICByZXN1bHRzID0gdGhpcy5yZXN1bHRzLm11dGFibGVDb3B5KCk7XG4gICAgICAgICAgICAgICAgICAgIHZhciByZW1vdmVkID0gcmVzdWx0cy5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnJlc3VsdHMgPSByZXN1bHRzLmFzTW9kZWxRdWVyeVNldCh0aGlzLm1vZGVsKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5lbWl0KCdjaGFuZ2UnLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpbmRleDogaW5kZXgsXG4gICAgICAgICAgICAgICAgICAgICAgICBvYmo6IHRoaXMsXG4gICAgICAgICAgICAgICAgICAgICAgICBuZXc6IG5ld09iaixcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6IG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlLlNwbGljZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlbW92ZWQ6IHJlbW92ZWRcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2UgaWYgKCFtYXRjaGVzICYmICFhbHJlYWR5Q29udGFpbnMpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nKCdEb2VzIG5vdCBjb250YWluLCBidXQgZG9lc250IG1hdGNoIHNvIG5vdCBpbnNlcnRpbmcnLCBuZXdPYmouX2R1bXBTdHJpbmcoKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2UgaWYgKG1hdGNoZXMgJiYgYWxyZWFkeUNvbnRhaW5zKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZygnTWF0Y2hlcyBidXQgYWxyZWFkeSBjb250YWlucycsIG5ld09iai5fZHVtcFN0cmluZygpKTtcbiAgICAgICAgICAgICAgICAgICAgLy8gU2VuZCB0aGUgbm90aWZpY2F0aW9uIG92ZXIuXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZW1pdCgnY2hhbmdlJywgbik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAobi50eXBlID09IG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlLlJlbW92ZSkge1xuICAgICAgICAgICAgICAgIG5ld09iaiA9IG4ub2JqO1xuICAgICAgICAgICAgICAgIHZhciByZXN1bHRzID0gdGhpcy5yZXN1bHRzLm11dGFibGVDb3B5KCk7XG4gICAgICAgICAgICAgICAgaW5kZXggPSByZXN1bHRzLmluZGV4T2YobmV3T2JqKTtcbiAgICAgICAgICAgICAgICBpZiAoaW5kZXggPiAtMSkge1xuICAgICAgICAgICAgICAgICAgICBsb2coJ1JlbW92aW5nIG9iamVjdCcsIG5ld09iai5fZHVtcFN0cmluZygpKTtcbiAgICAgICAgICAgICAgICAgICAgcmVtb3ZlZCA9IHJlc3VsdHMuc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5yZXN1bHRzID0gY29uc3RydWN0UXVlcnlTZXQocmVzdWx0cywgdGhpcy5tb2RlbCk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZW1pdCgnY2hhbmdlJywge1xuICAgICAgICAgICAgICAgICAgICAgICAgaW5kZXg6IGluZGV4LFxuICAgICAgICAgICAgICAgICAgICAgICAgb2JqOiB0aGlzLFxuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogbW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUuU3BsaWNlLFxuICAgICAgICAgICAgICAgICAgICAgICAgcmVtb3ZlZDogcmVtb3ZlZFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZygnTm8gbW9kZWxFdmVudHMgbmVjY2Vzc2FyeS4nLCBuZXdPYmouX2R1bXBTdHJpbmcoKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ1Vua25vd24gY2hhbmdlIHR5cGUgXCInICsgbi50eXBlLnRvU3RyaW5nKCkgKyAnXCInKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5yZXN1bHRzID0gY29uc3RydWN0UXVlcnlTZXQodGhpcy5fcXVlcnkuX3NvcnRSZXN1bHRzKHRoaXMucmVzdWx0cyksIHRoaXMubW9kZWwpO1xuICAgICAgICB9LFxuICAgICAgICBfY29uc3RydWN0Tm90aWZpY2F0aW9uTmFtZTogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMubW9kZWwuY29sbGVjdGlvbk5hbWUgKyAnOicgKyB0aGlzLm1vZGVsLm5hbWU7XG4gICAgICAgIH0sXG4gICAgICAgIHRlcm1pbmF0ZTogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgaWYgKHRoaXMuaGFuZGxlcikge1xuICAgICAgICAgICAgICAgIGV2ZW50cy5yZW1vdmVMaXN0ZW5lcih0aGlzLl9jb25zdHJ1Y3ROb3RpZmljYXRpb25OYW1lKCksIHRoaXMuaGFuZGxlcik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLnJlc3VsdHMgPSBudWxsO1xuICAgICAgICAgICAgdGhpcy5oYW5kbGVyID0gbnVsbDtcbiAgICAgICAgfSxcbiAgICAgICAgbGlzdGVuOiBmdW5jdGlvbiAoZm4pIHtcbiAgICAgICAgICAgIHRoaXMub24oJ2NoYW5nZScsIGZuKTtcbiAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5yZW1vdmVMaXN0ZW5lcignY2hhbmdlJywgZm4pO1xuICAgICAgICAgICAgfS5iaW5kKHRoaXMpO1xuICAgICAgICB9LFxuICAgICAgICBsaXN0ZW5PbmNlOiBmdW5jdGlvbiAoZm4pIHtcbiAgICAgICAgICAgIHRoaXMub25jZSgnY2hhbmdlJywgZm4pO1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICBtb2R1bGUuZXhwb3J0cyA9IFJlYWN0aXZlUXVlcnk7XG59KSgpOyIsIi8qKlxuICogQmFzZSBmdW5jdGlvbmFsaXR5IGZvciByZWxhdGlvbnNoaXBzLlxuICogQG1vZHVsZSByZWxhdGlvbnNoaXBzXG4gKi9cbihmdW5jdGlvbiAoKSB7XG4gICAgdmFyIEludGVybmFsU2llc3RhRXJyb3IgPSByZXF1aXJlKCcuL2Vycm9yJykuSW50ZXJuYWxTaWVzdGFFcnJvcixcbiAgICAgICAgU3RvcmUgPSByZXF1aXJlKCcuL3N0b3JlJyksXG4gICAgICAgIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKSxcbiAgICAgICAgXyA9IHV0aWwuXyxcbiAgICAgICAgUXVlcnkgPSByZXF1aXJlKCcuL1F1ZXJ5JyksXG4gICAgICAgIGxvZyA9IHJlcXVpcmUoJy4vbG9nJyksXG4gICAgICAgIGNhY2hlID0gcmVxdWlyZSgnLi9jYWNoZScpLFxuICAgICAgICBldmVudHMgPSByZXF1aXJlKCcuL2V2ZW50cycpLFxuICAgICAgICB3cmFwQXJyYXlGb3JBdHRyaWJ1dGVzID0gZXZlbnRzLndyYXBBcnJheSxcbiAgICAgICAgQXJyYXlPYnNlcnZlciA9IHJlcXVpcmUoJy4uL3ZlbmRvci9vYnNlcnZlLWpzL3NyYy9vYnNlcnZlJykuQXJyYXlPYnNlcnZlcixcbiAgICAgICAgbW9kZWxFdmVudHMgPSByZXF1aXJlKCcuL21vZGVsRXZlbnRzJyksXG4gICAgICAgIE1vZGVsRXZlbnRUeXBlID0gbW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGU7XG5cbiAgICAvKipcbiAgICAgKiBAY2xhc3MgIFtSZWxhdGlvbnNoaXBQcm94eSBkZXNjcmlwdGlvbl1cbiAgICAgKiBAcGFyYW0ge09iamVjdH0gb3B0c1xuICAgICAqIEBjb25zdHJ1Y3RvclxuICAgICAqL1xuICAgIGZ1bmN0aW9uIFJlbGF0aW9uc2hpcFByb3h5KG9wdHMpIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICBvcHRzID0gb3B0cyB8fCB7fTtcblxuICAgICAgICBfLmV4dGVuZCh0aGlzLCB7XG4gICAgICAgICAgICBvYmplY3Q6IG51bGwsXG4gICAgICAgICAgICByZWxhdGVkOiBudWxsXG4gICAgICAgIH0pO1xuXG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKHRoaXMsIHtcbiAgICAgICAgICAgIGlzRm9yd2FyZDoge1xuICAgICAgICAgICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gIXNlbGYuaXNSZXZlcnNlO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgc2V0OiBmdW5jdGlvbiAodikge1xuICAgICAgICAgICAgICAgICAgICBzZWxmLmlzUmV2ZXJzZSA9ICF2O1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICB1dGlsLmV4dGVuZEZyb21PcHRzKHRoaXMsIG9wdHMsIHtcbiAgICAgICAgICAgIHJldmVyc2VNb2RlbDogbnVsbCxcbiAgICAgICAgICAgIGZvcndhcmRNb2RlbDogbnVsbCxcbiAgICAgICAgICAgIGZvcndhcmROYW1lOiBudWxsLFxuICAgICAgICAgICAgcmV2ZXJzZU5hbWU6IG51bGwsXG4gICAgICAgICAgICBpc1JldmVyc2U6IG51bGxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGhpcy5jYW5jZWxMaXN0ZW5zID0ge307XG4gICAgfVxuXG4gICAgXy5leHRlbmQoUmVsYXRpb25zaGlwUHJveHksIHt9KTtcblxuICAgIF8uZXh0ZW5kKFJlbGF0aW9uc2hpcFByb3h5LnByb3RvdHlwZSwge1xuICAgICAgICAvKipcbiAgICAgICAgICogSW5zdGFsbCB0aGlzIHByb3h5IG9uIHRoZSBnaXZlbiBpbnN0YW5jZVxuICAgICAgICAgKiBAcGFyYW0ge01vZGVsSW5zdGFuY2V9IG1vZGVsSW5zdGFuY2VcbiAgICAgICAgICovXG4gICAgICAgIGluc3RhbGw6IGZ1bmN0aW9uIChtb2RlbEluc3RhbmNlKSB7XG4gICAgICAgICAgICBpZiAobW9kZWxJbnN0YW5jZSkge1xuICAgICAgICAgICAgICAgIGlmICghdGhpcy5vYmplY3QpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5vYmplY3QgPSBtb2RlbEluc3RhbmNlO1xuICAgICAgICAgICAgICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgICAgICAgICAgICAgIHZhciBuYW1lID0gdGhpcy5nZXRGb3J3YXJkTmFtZSgpO1xuICAgICAgICAgICAgICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkobW9kZWxJbnN0YW5jZSwgbmFtZSwge1xuICAgICAgICAgICAgICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHNlbGYucmVsYXRlZDtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICBzZXQ6IGZ1bmN0aW9uICh2KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc2VsZi5zZXQodik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZVxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFtb2RlbEluc3RhbmNlLl9fcHJveGllcykgbW9kZWxJbnN0YW5jZS5fX3Byb3hpZXMgPSB7fTtcbiAgICAgICAgICAgICAgICAgICAgbW9kZWxJbnN0YW5jZS5fX3Byb3hpZXNbbmFtZV0gPSB0aGlzO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIW1vZGVsSW5zdGFuY2UuX3Byb3hpZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG1vZGVsSW5zdGFuY2UuX3Byb3hpZXMgPSBbXTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBtb2RlbEluc3RhbmNlLl9wcm94aWVzLnB1c2godGhpcyk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ0FscmVhZHkgaW5zdGFsbGVkLicpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ05vIG9iamVjdCBwYXNzZWQgdG8gcmVsYXRpb25zaGlwIGluc3RhbGwnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgfSk7XG5cbiAgICAvL25vaW5zcGVjdGlvbiBKU1VudXNlZExvY2FsU3ltYm9sc1xuICAgIF8uZXh0ZW5kKFJlbGF0aW9uc2hpcFByb3h5LnByb3RvdHlwZSwge1xuICAgICAgICBzZXQ6IGZ1bmN0aW9uIChvYmosIG9wdHMpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdNdXN0IHN1YmNsYXNzIFJlbGF0aW9uc2hpcFByb3h5Jyk7XG4gICAgICAgIH0sXG4gICAgICAgIGdldDogZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignTXVzdCBzdWJjbGFzcyBSZWxhdGlvbnNoaXBQcm94eScpO1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICBfLmV4dGVuZChSZWxhdGlvbnNoaXBQcm94eS5wcm90b3R5cGUsIHtcbiAgICAgICAgcHJveHlGb3JJbnN0YW5jZTogZnVuY3Rpb24gKG1vZGVsSW5zdGFuY2UsIHJldmVyc2UpIHtcbiAgICAgICAgICAgIHZhciBuYW1lID0gcmV2ZXJzZSA/IHRoaXMuZ2V0UmV2ZXJzZU5hbWUoKSA6IHRoaXMuZ2V0Rm9yd2FyZE5hbWUoKSxcbiAgICAgICAgICAgICAgICBtb2RlbCA9IHJldmVyc2UgPyB0aGlzLnJldmVyc2VNb2RlbCA6IHRoaXMuZm9yd2FyZE1vZGVsO1xuICAgICAgICAgICAgdmFyIHJldDtcbiAgICAgICAgICAgIC8vIFRoaXMgc2hvdWxkIG5ldmVyIGhhcHBlbi4gU2hvdWxkIGcgICBldCBjYXVnaHQgaW4gdGhlIG1hcHBpbmcgb3BlcmF0aW9uP1xuICAgICAgICAgICAgaWYgKHV0aWwuaXNBcnJheShtb2RlbEluc3RhbmNlKSkge1xuICAgICAgICAgICAgICAgIHJldCA9IF8ubWFwKG1vZGVsSW5zdGFuY2UsIGZ1bmN0aW9uIChvKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBvLl9fcHJveGllc1tuYW1lXTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdmFyIHByb3h5ID0gbW9kZWxJbnN0YW5jZS5fX3Byb3hpZXNbbmFtZV07XG4gICAgICAgICAgICAgICAgaWYgKCFwcm94eSkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgZXJyID0gJ05vIHByb3h5IHdpdGggbmFtZSBcIicgKyBuYW1lICsgJ1wiIG9uIG1hcHBpbmcgJyArIG1vZGVsLm5hbWU7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKGVycik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldCA9IHByb3h5O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHJldDtcbiAgICAgICAgfSxcbiAgICAgICAgcmV2ZXJzZVByb3h5Rm9ySW5zdGFuY2U6IGZ1bmN0aW9uIChtb2RlbEluc3RhbmNlKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5wcm94eUZvckluc3RhbmNlKG1vZGVsSW5zdGFuY2UsIHRydWUpO1xuICAgICAgICB9LFxuICAgICAgICBnZXRSZXZlcnNlTmFtZTogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuaXNGb3J3YXJkID8gdGhpcy5yZXZlcnNlTmFtZSA6IHRoaXMuZm9yd2FyZE5hbWU7XG4gICAgICAgIH0sXG4gICAgICAgIGdldEZvcndhcmROYW1lOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5pc0ZvcndhcmQgPyB0aGlzLmZvcndhcmROYW1lIDogdGhpcy5yZXZlcnNlTmFtZTtcbiAgICAgICAgfSxcbiAgICAgICAgZ2V0Rm9yd2FyZE1vZGVsOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5pc0ZvcndhcmQgPyB0aGlzLmZvcndhcmRNb2RlbCA6IHRoaXMucmV2ZXJzZU1vZGVsO1xuICAgICAgICB9LFxuICAgICAgICBjbGVhclJlbW92YWxMaXN0ZW5lcjogZnVuY3Rpb24gKG9iaikge1xuICAgICAgICAgICAgdmFyIF9pZCA9IG9iai5faWQ7XG4gICAgICAgICAgICB2YXIgY2FuY2VsTGlzdGVuID0gdGhpcy5jYW5jZWxMaXN0ZW5zW19pZF07XG4gICAgICAgICAgICAvLyBUT0RPOiBSZW1vdmUgdGhpcyBjaGVjay4gY2FuY2VsTGlzdGVuIHNob3VsZCBhbHdheXMgZXhpc3RcbiAgICAgICAgICAgIGlmIChjYW5jZWxMaXN0ZW4pIHtcbiAgICAgICAgICAgICAgICBjYW5jZWxMaXN0ZW4oKTtcbiAgICAgICAgICAgICAgICB0aGlzLmNhbmNlbExpc3RlbnNbX2lkXSA9IG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIGxpc3RlbkZvclJlbW92YWw6IGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgICAgIHRoaXMuY2FuY2VsTGlzdGVuc1tvYmouX2lkXSA9IG9iai5saXN0ZW4oZnVuY3Rpb24gKGUpIHtcbiAgICAgICAgICAgICAgICBpZiAoZS50eXBlID09IE1vZGVsRXZlbnRUeXBlLlJlbW92ZSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAodXRpbC5pc0FycmF5KHRoaXMucmVsYXRlZCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBpZHggPSB0aGlzLnJlbGF0ZWQuaW5kZXhPZihvYmopO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zcGxpY2UoaWR4LCAxKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc2V0SWRBbmRSZWxhdGVkKG51bGwpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY2xlYXJSZW1vdmFsTGlzdGVuZXIob2JqKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICB9LFxuICAgICAgICAvKipcbiAgICAgICAgICogQ29uZmlndXJlIF9pZCBhbmQgcmVsYXRlZCB3aXRoIHRoZSBuZXcgcmVsYXRlZCBvYmplY3QuXG4gICAgICAgICAqIEBwYXJhbSBvYmpcbiAgICAgICAgICogQHBhcmFtIHtvYmplY3R9IFtvcHRzXVxuICAgICAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRzLmRpc2FibGVOb3RpZmljYXRpb25zXVxuICAgICAgICAgKiBAcmV0dXJucyB7U3RyaW5nfHVuZGVmaW5lZH0gLSBFcnJvciBtZXNzYWdlIG9yIHVuZGVmaW5lZFxuICAgICAgICAgKi9cbiAgICAgICAgc2V0SWRBbmRSZWxhdGVkOiBmdW5jdGlvbiAob2JqLCBvcHRzKSB7XG4gICAgICAgICAgICBvcHRzID0gb3B0cyB8fCB7fTtcbiAgICAgICAgICAgIGlmICghb3B0cy5kaXNhYmxlZXZlbnRzKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5yZWdpc3RlclNldENoYW5nZShvYmopO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdmFyIHByZXZpb3VzbHlSZWxhdGVkID0gdGhpcy5yZWxhdGVkO1xuICAgICAgICAgICAgaWYgKHByZXZpb3VzbHlSZWxhdGVkKSB0aGlzLmNsZWFyUmVtb3ZhbExpc3RlbmVyKHByZXZpb3VzbHlSZWxhdGVkKTtcbiAgICAgICAgICAgIGlmIChvYmopIHtcbiAgICAgICAgICAgICAgICBpZiAodXRpbC5pc0FycmF5KG9iaikpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5yZWxhdGVkID0gb2JqO1xuICAgICAgICAgICAgICAgICAgICBvYmouZm9yRWFjaChmdW5jdGlvbiAoX29iaikge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5saXN0ZW5Gb3JSZW1vdmFsKF9vYmopO1xuICAgICAgICAgICAgICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMucmVsYXRlZCA9IG9iajtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5saXN0ZW5Gb3JSZW1vdmFsKG9iaik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5yZWxhdGVkID0gbnVsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgY2hlY2tJbnN0YWxsZWQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5vYmplY3QpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignUHJveHkgbXVzdCBiZSBpbnN0YWxsZWQgb24gYW4gb2JqZWN0IGJlZm9yZSBjYW4gdXNlIGl0LicpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICBzcGxpY2VyOiBmdW5jdGlvbiAob3B0cykge1xuICAgICAgICAgICAgb3B0cyA9IG9wdHMgfHwge307XG4gICAgICAgICAgICByZXR1cm4gZnVuY3Rpb24gKGlkeCwgbnVtUmVtb3ZlKSB7XG4gICAgICAgICAgICAgICAgb3B0cyA9IG9wdHMgfHwge307XG4gICAgICAgICAgICAgICAgaWYgKCFvcHRzLmRpc2FibGVldmVudHMpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5yZWdpc3RlclNwbGljZUNoYW5nZS5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB2YXIgYWRkID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAyKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gXy5wYXJ0aWFsKHRoaXMucmVsYXRlZC5zcGxpY2UsIGlkeCwgbnVtUmVtb3ZlKS5hcHBseSh0aGlzLnJlbGF0ZWQsIGFkZCk7XG4gICAgICAgICAgICB9LmJpbmQodGhpcyk7XG4gICAgICAgIH0sXG4gICAgICAgIGNsZWFyUmV2ZXJzZVJlbGF0ZWQ6IGZ1bmN0aW9uIChvcHRzKSB7XG4gICAgICAgICAgICBvcHRzID0gb3B0cyB8fCB7fTtcbiAgICAgICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgICAgIGlmICh0aGlzLnJlbGF0ZWQpIHtcbiAgICAgICAgICAgICAgICB2YXIgcmV2ZXJzZVByb3h5ID0gdGhpcy5yZXZlcnNlUHJveHlGb3JJbnN0YW5jZSh0aGlzLnJlbGF0ZWQpO1xuICAgICAgICAgICAgICAgIHZhciByZXZlcnNlUHJveGllcyA9IHV0aWwuaXNBcnJheShyZXZlcnNlUHJveHkpID8gcmV2ZXJzZVByb3h5IDogW3JldmVyc2VQcm94eV07XG4gICAgICAgICAgICAgICAgXy5lYWNoKHJldmVyc2VQcm94aWVzLCBmdW5jdGlvbiAocCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAodXRpbC5pc0FycmF5KHAucmVsYXRlZCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBpZHggPSBwLnJlbGF0ZWQuaW5kZXhPZihzZWxmLm9iamVjdCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBwLm1ha2VDaGFuZ2VzVG9SZWxhdGVkV2l0aG91dE9ic2VydmF0aW9ucyhmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcC5zcGxpY2VyKG9wdHMpKGlkeCwgMSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHAuc2V0SWRBbmRSZWxhdGVkKG51bGwsIG9wdHMpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHNldElkQW5kUmVsYXRlZFJldmVyc2U6IGZ1bmN0aW9uIChvYmosIG9wdHMpIHtcbiAgICAgICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgICAgIHZhciByZXZlcnNlUHJveHkgPSB0aGlzLnJldmVyc2VQcm94eUZvckluc3RhbmNlKG9iaik7XG4gICAgICAgICAgICB2YXIgcmV2ZXJzZVByb3hpZXMgPSB1dGlsLmlzQXJyYXkocmV2ZXJzZVByb3h5KSA/IHJldmVyc2VQcm94eSA6IFtyZXZlcnNlUHJveHldO1xuICAgICAgICAgICAgXy5lYWNoKHJldmVyc2VQcm94aWVzLCBmdW5jdGlvbiAocCkge1xuICAgICAgICAgICAgICAgIGlmICh1dGlsLmlzQXJyYXkocC5yZWxhdGVkKSkge1xuICAgICAgICAgICAgICAgICAgICBwLm1ha2VDaGFuZ2VzVG9SZWxhdGVkV2l0aG91dE9ic2VydmF0aW9ucyhmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwLnNwbGljZXIob3B0cykocC5yZWxhdGVkLmxlbmd0aCwgMCwgc2VsZi5vYmplY3QpO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBwLmNsZWFyUmV2ZXJzZVJlbGF0ZWQob3B0cyk7XG4gICAgICAgICAgICAgICAgICAgIHAuc2V0SWRBbmRSZWxhdGVkKHNlbGYub2JqZWN0LCBvcHRzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSxcbiAgICAgICAgbWFrZUNoYW5nZXNUb1JlbGF0ZWRXaXRob3V0T2JzZXJ2YXRpb25zOiBmdW5jdGlvbiAoZikge1xuICAgICAgICAgICAgaWYgKHRoaXMucmVsYXRlZCkge1xuICAgICAgICAgICAgICAgIHRoaXMucmVsYXRlZC5hcnJheU9ic2VydmVyLmNsb3NlKCk7XG4gICAgICAgICAgICAgICAgdGhpcy5yZWxhdGVkLmFycmF5T2JzZXJ2ZXIgPSBudWxsO1xuICAgICAgICAgICAgICAgIGYoKTtcbiAgICAgICAgICAgICAgICB0aGlzLndyYXBBcnJheSh0aGlzLnJlbGF0ZWQpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBmKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHJlZ2lzdGVyU2V0Q2hhbmdlOiBmdW5jdGlvbiAob2JqKSB7XG4gICAgICAgICAgICB2YXIgcHJveHlPYmplY3QgPSB0aGlzLm9iamVjdDtcbiAgICAgICAgICAgIGlmICghcHJveHlPYmplY3QpIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdQcm94eSBtdXN0IGhhdmUgYW4gb2JqZWN0IGFzc29jaWF0ZWQnKTtcbiAgICAgICAgICAgIHZhciBtb2RlbCA9IHByb3h5T2JqZWN0Lm1vZGVsLm5hbWU7XG4gICAgICAgICAgICB2YXIgY29sbGVjdGlvbk5hbWUgPSBwcm94eU9iamVjdC5jb2xsZWN0aW9uTmFtZTtcbiAgICAgICAgICAgIC8vIFdlIHRha2UgW10gPT0gbnVsbCA9PSB1bmRlZmluZWQgaW4gdGhlIGNhc2Ugb2YgcmVsYXRpb25zaGlwcy5cbiAgICAgICAgICAgIHZhciBvbGQgPSB0aGlzLnJlbGF0ZWQ7XG4gICAgICAgICAgICBpZiAodXRpbC5pc0FycmF5KG9sZCkgJiYgIW9sZC5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICBvbGQgPSBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbW9kZWxFdmVudHMuZW1pdCh7XG4gICAgICAgICAgICAgICAgY29sbGVjdGlvbjogY29sbGVjdGlvbk5hbWUsXG4gICAgICAgICAgICAgICAgbW9kZWw6IG1vZGVsLFxuICAgICAgICAgICAgICAgIF9pZDogcHJveHlPYmplY3QuX2lkLFxuICAgICAgICAgICAgICAgIGZpZWxkOiB0aGlzLmdldEZvcndhcmROYW1lKCksXG4gICAgICAgICAgICAgICAgb2xkOiBvbGQsXG4gICAgICAgICAgICAgICAgbmV3OiBvYmosXG4gICAgICAgICAgICAgICAgdHlwZTogTW9kZWxFdmVudFR5cGUuU2V0LFxuICAgICAgICAgICAgICAgIG9iajogcHJveHlPYmplY3RcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9LFxuXG4gICAgICAgIHJlZ2lzdGVyU3BsaWNlQ2hhbmdlOiBmdW5jdGlvbiAoaWR4LCBudW1SZW1vdmUpIHtcbiAgICAgICAgICAgIHZhciBhZGQgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDIpO1xuICAgICAgICAgICAgdmFyIG1vZGVsID0gdGhpcy5vYmplY3QubW9kZWwubmFtZTtcbiAgICAgICAgICAgIHZhciBjb2xsID0gdGhpcy5vYmplY3QuY29sbGVjdGlvbk5hbWU7XG4gICAgICAgICAgICBtb2RlbEV2ZW50cy5lbWl0KHtcbiAgICAgICAgICAgICAgICBjb2xsZWN0aW9uOiBjb2xsLFxuICAgICAgICAgICAgICAgIG1vZGVsOiBtb2RlbCxcbiAgICAgICAgICAgICAgICBfaWQ6IHRoaXMub2JqZWN0Ll9pZCxcbiAgICAgICAgICAgICAgICBmaWVsZDogdGhpcy5nZXRGb3J3YXJkTmFtZSgpLFxuICAgICAgICAgICAgICAgIGluZGV4OiBpZHgsXG4gICAgICAgICAgICAgICAgcmVtb3ZlZDogdGhpcy5yZWxhdGVkID8gdGhpcy5yZWxhdGVkLnNsaWNlKGlkeCwgaWR4ICsgbnVtUmVtb3ZlKSA6IG51bGwsXG4gICAgICAgICAgICAgICAgYWRkZWQ6IGFkZC5sZW5ndGggPyBhZGQgOiBbXSxcbiAgICAgICAgICAgICAgICB0eXBlOiBNb2RlbEV2ZW50VHlwZS5TcGxpY2UsXG4gICAgICAgICAgICAgICAgb2JqOiB0aGlzLm9iamVjdFxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0sXG4gICAgICAgIHdyYXBBcnJheTogZnVuY3Rpb24gKGFycikge1xuICAgICAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICAgICAgd3JhcEFycmF5Rm9yQXR0cmlidXRlcyhhcnIsIHRoaXMucmV2ZXJzZU5hbWUsIHRoaXMub2JqZWN0KTtcbiAgICAgICAgICAgIGlmICghYXJyLmFycmF5T2JzZXJ2ZXIpIHtcbiAgICAgICAgICAgICAgICBhcnIuYXJyYXlPYnNlcnZlciA9IG5ldyBBcnJheU9ic2VydmVyKGFycik7XG4gICAgICAgICAgICAgICAgdmFyIG9ic2VydmVyRnVuY3Rpb24gPSBmdW5jdGlvbiAoc3BsaWNlcykge1xuICAgICAgICAgICAgICAgICAgICBzcGxpY2VzLmZvckVhY2goZnVuY3Rpb24gKHNwbGljZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGFkZGVkID0gc3BsaWNlLmFkZGVkQ291bnQgPyBhcnIuc2xpY2Uoc3BsaWNlLmluZGV4LCBzcGxpY2UuaW5kZXggKyBzcGxpY2UuYWRkZWRDb3VudCkgOiBbXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBtb2RlbCA9IHNlbGYuZ2V0Rm9yd2FyZE1vZGVsKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBtb2RlbEV2ZW50cy5lbWl0KHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb2xsZWN0aW9uOiBtb2RlbC5jb2xsZWN0aW9uTmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtb2RlbDogbW9kZWwubmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBfaWQ6IHNlbGYub2JqZWN0Ll9pZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmaWVsZDogc2VsZi5nZXRGb3J3YXJkTmFtZSgpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlbW92ZWQ6IHNwbGljZS5yZW1vdmVkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFkZGVkOiBhZGRlZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiBNb2RlbEV2ZW50VHlwZS5TcGxpY2UsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb2JqOiBzZWxmLm9iamVjdFxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgYXJyLmFycmF5T2JzZXJ2ZXIub3BlbihvYnNlcnZlckZ1bmN0aW9uKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgc3BsaWNlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB0aGlzLnNwbGljZXIoe30pLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgICAgIH1cblxuICAgIH0pO1xuXG5cbiAgICBtb2R1bGUuZXhwb3J0cyA9IFJlbGF0aW9uc2hpcFByb3h5O1xuXG5cbn0pKCk7IiwiKGZ1bmN0aW9uICgpIHtcbiAgICBtb2R1bGUuZXhwb3J0cyA9IHtcbiAgICAgICAgT25lVG9NYW55OiAnT25lVG9NYW55JyxcbiAgICAgICAgT25lVG9PbmU6ICdPbmVUb09uZScsXG4gICAgICAgIE1hbnlUb01hbnk6ICdNYW55VG9NYW55J1xuICAgIH07XG59KSgpOyIsIi8qKlxuICogVGhpcyBpcyBhbiBpbi1tZW1vcnkgY2FjaGUgZm9yIG1vZGVscy4gTW9kZWxzIGFyZSBjYWNoZWQgYnkgbG9jYWwgaWQgKF9pZCkgYW5kIHJlbW90ZSBpZCAoZGVmaW5lZCBieSB0aGUgbWFwcGluZykuXG4gKiBMb29rdXBzIGFyZSBwZXJmb3JtZWQgYWdhaW5zdCB0aGUgY2FjaGUgd2hlbiBtYXBwaW5nLlxuICogQG1vZHVsZSBjYWNoZVxuICovXG4oZnVuY3Rpb24gKCkge1xuXG4gICAgdmFyIGxvZyA9IHJlcXVpcmUoJy4vbG9nJykoJ2NhY2hlJyksXG4gICAgICAgIEludGVybmFsU2llc3RhRXJyb3IgPSByZXF1aXJlKCcuL2Vycm9yJykuSW50ZXJuYWxTaWVzdGFFcnJvcixcbiAgICAgICAgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpO1xuXG5cbiAgICB2YXIgbG9jYWxDYWNoZUJ5SWQgPSB7fSxcbiAgICAgICAgbG9jYWxDYWNoZSA9IHt9LFxuICAgICAgICByZW1vdGVDYWNoZSA9IHt9O1xuXG4gICAgLyoqXG4gICAgICogQ2xlYXIgb3V0IHRoZSBjYWNoZS5cbiAgICAgKi9cbiAgICBmdW5jdGlvbiByZXNldCgpIHtcbiAgICAgICAgcmVtb3RlQ2FjaGUgPSB7fTtcbiAgICAgICAgbG9jYWxDYWNoZUJ5SWQgPSB7fTtcbiAgICAgICAgbG9jYWxDYWNoZSA9IHt9O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybiB0aGUgb2JqZWN0IGluIHRoZSBjYWNoZSBnaXZlbiBhIGxvY2FsIGlkIChfaWQpXG4gICAgICogQHBhcmFtICB7U3RyaW5nfSBsb2NhbElkXG4gICAgICogQHJldHVybiB7TW9kZWxJbnN0YW5jZX1cbiAgICAgKi9cbiAgICBmdW5jdGlvbiBnZXRWaWFMb2NhbElkKGxvY2FsSWQpIHtcbiAgICAgICAgdmFyIG9iaiA9IGxvY2FsQ2FjaGVCeUlkW2xvY2FsSWRdO1xuICAgICAgICBpZiAob2JqKSB7XG4gICAgICAgICAgICBsb2coJ0xvY2FsIGNhY2hlIGhpdDogJyArIG9iai5fZHVtcCh0cnVlKSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBsb2coJ0xvY2FsIGNhY2hlIG1pc3M6ICcgKyBsb2NhbElkKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gb2JqO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybiB0aGUgc2luZ2xldG9uIG9iamVjdCBnaXZlbiBhIHNpbmdsZXRvbiBtb2RlbC5cbiAgICAgKiBAcGFyYW0gIHtNb2RlbH0gbW9kZWxcbiAgICAgKiBAcmV0dXJuIHtNb2RlbEluc3RhbmNlfVxuICAgICAqL1xuICAgIGZ1bmN0aW9uIGdldFNpbmdsZXRvbihtb2RlbCkge1xuICAgICAgICB2YXIgbW9kZWxOYW1lID0gbW9kZWwubmFtZTtcbiAgICAgICAgdmFyIGNvbGxlY3Rpb25OYW1lID0gbW9kZWwuY29sbGVjdGlvbk5hbWU7XG4gICAgICAgIHZhciBjb2xsZWN0aW9uQ2FjaGUgPSBsb2NhbENhY2hlW2NvbGxlY3Rpb25OYW1lXTtcbiAgICAgICAgaWYgKGNvbGxlY3Rpb25DYWNoZSkge1xuICAgICAgICAgICAgdmFyIHR5cGVDYWNoZSA9IGNvbGxlY3Rpb25DYWNoZVttb2RlbE5hbWVdO1xuICAgICAgICAgICAgaWYgKHR5cGVDYWNoZSkge1xuICAgICAgICAgICAgICAgIHZhciBvYmpzID0gW107XG4gICAgICAgICAgICAgICAgZm9yICh2YXIgcHJvcCBpbiB0eXBlQ2FjaGUpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVDYWNoZS5oYXNPd25Qcm9wZXJ0eShwcm9wKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgb2Jqcy5wdXNoKHR5cGVDYWNoZVtwcm9wXSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKG9ianMubGVuZ3RoID4gMSkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgZXJyU3RyID0gJ0Egc2luZ2xldG9uIG1vZGVsIGhhcyBtb3JlIHRoYW4gMSBvYmplY3QgaW4gdGhlIGNhY2hlISBUaGlzIGlzIGEgc2VyaW91cyBlcnJvci4gJyArXG4gICAgICAgICAgICAgICAgICAgICAgICAnRWl0aGVyIGEgbW9kZWwgaGFzIGJlZW4gbW9kaWZpZWQgYWZ0ZXIgb2JqZWN0cyBoYXZlIGFscmVhZHkgYmVlbiBjcmVhdGVkLCBvciBzb21ldGhpbmcgaGFzIGdvbmUnICtcbiAgICAgICAgICAgICAgICAgICAgICAgICd2ZXJ5IHdyb25nLiBQbGVhc2UgZmlsZSBhIGJ1ZyByZXBvcnQgaWYgdGhlIGxhdHRlci4nO1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcihlcnJTdHIpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAob2Jqcy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9ianNbMF07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdpdmVuIGEgcmVtb3RlIGlkZW50aWZpZXIgYW5kIGFuIG9wdGlvbnMgb2JqZWN0IHRoYXQgZGVzY3JpYmVzIG1hcHBpbmcvY29sbGVjdGlvbixcbiAgICAgKiByZXR1cm4gdGhlIG1vZGVsIGlmIGNhY2hlZC5cbiAgICAgKiBAcGFyYW0gIHtTdHJpbmd9IHJlbW90ZUlkXG4gICAgICogQHBhcmFtICB7T2JqZWN0fSBvcHRzXG4gICAgICogQHJldHVybiB7TW9kZWxJbnN0YW5jZX1cbiAgICAgKi9cbiAgICBmdW5jdGlvbiBnZXRWaWFSZW1vdGVJZChyZW1vdGVJZCwgb3B0cykge1xuICAgICAgICB2YXIgdHlwZSA9IG9wdHMubW9kZWwubmFtZTtcbiAgICAgICAgdmFyIGNvbGxlY3Rpb25OYW1lID0gb3B0cy5tb2RlbC5jb2xsZWN0aW9uTmFtZTtcbiAgICAgICAgdmFyIGNvbGxlY3Rpb25DYWNoZSA9IHJlbW90ZUNhY2hlW2NvbGxlY3Rpb25OYW1lXTtcbiAgICAgICAgaWYgKGNvbGxlY3Rpb25DYWNoZSkge1xuICAgICAgICAgICAgdmFyIHR5cGVDYWNoZSA9IHJlbW90ZUNhY2hlW2NvbGxlY3Rpb25OYW1lXVt0eXBlXTtcbiAgICAgICAgICAgIGlmICh0eXBlQ2FjaGUpIHtcbiAgICAgICAgICAgICAgICB2YXIgb2JqID0gdHlwZUNhY2hlW3JlbW90ZUlkXTtcbiAgICAgICAgICAgICAgICBpZiAob2JqKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZygnUmVtb3RlIGNhY2hlIGhpdDogJyArIG9iai5fZHVtcCh0cnVlKSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nKCdSZW1vdGUgY2FjaGUgbWlzczogJyArIHJlbW90ZUlkKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIG9iajtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBsb2coJ1JlbW90ZSBjYWNoZSBtaXNzOiAnICsgcmVtb3RlSWQpO1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJbnNlcnQgYW4gb2JqZXQgaW50byB0aGUgY2FjaGUgdXNpbmcgYSByZW1vdGUgaWRlbnRpZmllciBkZWZpbmVkIGJ5IHRoZSBtYXBwaW5nLlxuICAgICAqIEBwYXJhbSAge01vZGVsSW5zdGFuY2V9IG9ialxuICAgICAqIEBwYXJhbSAge1N0cmluZ30gcmVtb3RlSWRcbiAgICAgKiBAcGFyYW0gIHtTdHJpbmd9IHByZXZpb3VzUmVtb3RlSWQgSWYgcmVtb3RlIGlkIGhhcyBiZWVuIGNoYW5nZWQsIHRoaXMgaXMgdGhlIG9sZCByZW1vdGUgaWRlbnRpZmllclxuICAgICAqL1xuICAgIGZ1bmN0aW9uIHJlbW90ZUluc2VydChvYmosIHJlbW90ZUlkLCBwcmV2aW91c1JlbW90ZUlkKSB7XG4gICAgICAgIGlmIChvYmopIHtcbiAgICAgICAgICAgIHZhciBjb2xsZWN0aW9uTmFtZSA9IG9iai5tb2RlbC5jb2xsZWN0aW9uTmFtZTtcbiAgICAgICAgICAgIGlmIChjb2xsZWN0aW9uTmFtZSkge1xuICAgICAgICAgICAgICAgIGlmICghcmVtb3RlQ2FjaGVbY29sbGVjdGlvbk5hbWVdKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlbW90ZUNhY2hlW2NvbGxlY3Rpb25OYW1lXSA9IHt9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB2YXIgdHlwZSA9IG9iai5tb2RlbC5uYW1lO1xuICAgICAgICAgICAgICAgIGlmICh0eXBlKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghcmVtb3RlQ2FjaGVbY29sbGVjdGlvbk5hbWVdW3R5cGVdKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZW1vdGVDYWNoZVtjb2xsZWN0aW9uTmFtZV1bdHlwZV0gPSB7fTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAocHJldmlvdXNSZW1vdGVJZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVtb3RlQ2FjaGVbY29sbGVjdGlvbk5hbWVdW3R5cGVdW3ByZXZpb3VzUmVtb3RlSWRdID0gbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB2YXIgY2FjaGVkT2JqZWN0ID0gcmVtb3RlQ2FjaGVbY29sbGVjdGlvbk5hbWVdW3R5cGVdW3JlbW90ZUlkXTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFjYWNoZWRPYmplY3QpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlbW90ZUNhY2hlW2NvbGxlY3Rpb25OYW1lXVt0eXBlXVtyZW1vdGVJZF0gPSBvYmo7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2coJ1JlbW90ZSBjYWNoZSBpbnNlcnQ6ICcgKyBvYmouX2R1bXAodHJ1ZSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9nKCdSZW1vdGUgY2FjaGUgbm93IGxvb2tzIGxpa2U6ICcgKyByZW1vdGVEdW1wKHRydWUpKVxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gU29tZXRoaW5nIGhhcyBnb25lIHJlYWxseSB3cm9uZy4gT25seSBvbmUgb2JqZWN0IGZvciBhIHBhcnRpY3VsYXIgY29sbGVjdGlvbi90eXBlL3JlbW90ZWlkIGNvbWJvXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBzaG91bGQgZXZlciBleGlzdC5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChvYmogIT0gY2FjaGVkT2JqZWN0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG1lc3NhZ2UgPSAnT2JqZWN0ICcgKyBjb2xsZWN0aW9uTmFtZS50b1N0cmluZygpICsgJzonICsgdHlwZS50b1N0cmluZygpICsgJ1snICsgb2JqLm1vZGVsLmlkICsgJz1cIicgKyByZW1vdGVJZCArICdcIl0gYWxyZWFkeSBleGlzdHMgaW4gdGhlIGNhY2hlLicgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnIFRoaXMgaXMgYSBzZXJpb3VzIGVycm9yLCBwbGVhc2UgZmlsZSBhIGJ1ZyByZXBvcnQgaWYgeW91IGFyZSBleHBlcmllbmNpbmcgdGhpcyBvdXQgaW4gdGhlIHdpbGQnO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZyhtZXNzYWdlLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9iajogb2JqLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYWNoZWRPYmplY3Q6IGNhY2hlZE9iamVjdFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKG1lc3NhZ2UpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2coJ09iamVjdCBoYXMgYWxyZWFkeSBiZWVuIGluc2VydGVkOiAnICsgb2JqLl9kdW1wKHRydWUpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ01vZGVsIGhhcyBubyB0eXBlJywge1xuICAgICAgICAgICAgICAgICAgICAgICAgbW9kZWw6IG9iai5tb2RlbCxcbiAgICAgICAgICAgICAgICAgICAgICAgIG9iajogb2JqXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ01vZGVsIGhhcyBubyBjb2xsZWN0aW9uJywge1xuICAgICAgICAgICAgICAgICAgICBtb2RlbDogb2JqLm1vZGVsLFxuICAgICAgICAgICAgICAgICAgICBvYmo6IG9ialxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdmFyIG1zZyA9ICdNdXN0IHBhc3MgYW4gb2JqZWN0IHdoZW4gaW5zZXJ0aW5nIHRvIGNhY2hlJztcbiAgICAgICAgICAgIGxvZyhtc2cpO1xuICAgICAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IobXNnKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIER1bXAgdGhlIHJlbW90ZSBpZCBjYWNoZVxuICAgICAqIEBwYXJhbSAge2Jvb2xlYW59IGFzSnNvbiBXaGV0aGVyIG9yIG5vdCB0byBhcHBseSBKU09OLnN0cmluZ2lmeVxuICAgICAqIEByZXR1cm4ge1N0cmluZ3xPYmplY3R9XG4gICAgICovXG4gICAgZnVuY3Rpb24gcmVtb3RlRHVtcChhc0pzb24pIHtcbiAgICAgICAgdmFyIGR1bXBlZFJlc3RDYWNoZSA9IHt9O1xuICAgICAgICBmb3IgKHZhciBjb2xsIGluIHJlbW90ZUNhY2hlKSB7XG4gICAgICAgICAgICBpZiAocmVtb3RlQ2FjaGUuaGFzT3duUHJvcGVydHkoY29sbCkpIHtcbiAgICAgICAgICAgICAgICB2YXIgZHVtcGVkQ29sbENhY2hlID0ge307XG4gICAgICAgICAgICAgICAgZHVtcGVkUmVzdENhY2hlW2NvbGxdID0gZHVtcGVkQ29sbENhY2hlO1xuICAgICAgICAgICAgICAgIHZhciBjb2xsQ2FjaGUgPSByZW1vdGVDYWNoZVtjb2xsXTtcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBtb2RlbCBpbiBjb2xsQ2FjaGUpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGNvbGxDYWNoZS5oYXNPd25Qcm9wZXJ0eShtb2RlbCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBkdW1wZWRNb2RlbENhY2hlID0ge307XG4gICAgICAgICAgICAgICAgICAgICAgICBkdW1wZWRDb2xsQ2FjaGVbbW9kZWxdID0gZHVtcGVkTW9kZWxDYWNoZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBtb2RlbENhY2hlID0gY29sbENhY2hlW21vZGVsXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZvciAodmFyIHJlbW90ZUlkIGluIG1vZGVsQ2FjaGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAobW9kZWxDYWNoZS5oYXNPd25Qcm9wZXJ0eShyZW1vdGVJZCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG1vZGVsQ2FjaGVbcmVtb3RlSWRdKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkdW1wZWRNb2RlbENhY2hlW3JlbW90ZUlkXSA9IG1vZGVsQ2FjaGVbcmVtb3RlSWRdLl9kdW1wKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGFzSnNvbiA/IHV0aWwucHJldHR5UHJpbnQoKGR1bXBlZFJlc3RDYWNoZSwgbnVsbCwgNFxuICAgICkpIDpcbiAgICAgICAgZHVtcGVkUmVzdENhY2hlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIER1bXAgdGhlIGxvY2FsIGlkIChfaWQpIGNhY2hlXG4gICAgICogQHBhcmFtICB7Ym9vbGVhbn0gYXNKc29uIFdoZXRoZXIgb3Igbm90IHRvIGFwcGx5IEpTT04uc3RyaW5naWZ5XG4gICAgICogQHJldHVybiB7U3RyaW5nfE9iamVjdH1cbiAgICAgKi9cbiAgICBmdW5jdGlvbiBsb2NhbER1bXAoYXNKc29uKSB7XG4gICAgICAgIHZhciBkdW1wZWRJZENhY2hlID0ge307XG4gICAgICAgIGZvciAodmFyIGlkIGluIGxvY2FsQ2FjaGVCeUlkKSB7XG4gICAgICAgICAgICBpZiAobG9jYWxDYWNoZUJ5SWQuaGFzT3duUHJvcGVydHkoaWQpKSB7XG4gICAgICAgICAgICAgICAgZHVtcGVkSWRDYWNoZVtpZF0gPSBsb2NhbENhY2hlQnlJZFtpZF0uX2R1bXAoKVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBhc0pzb24gPyB1dGlsLnByZXR0eVByaW50KChkdW1wZWRJZENhY2hlLCBudWxsLCA0XG4gICAgKSkgOlxuICAgICAgICBkdW1wZWRJZENhY2hlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIER1bXAgdG8gdGhlIGNhY2hlLlxuICAgICAqIEBwYXJhbSAge2Jvb2xlYW59IGFzSnNvbiBXaGV0aGVyIG9yIG5vdCB0byBhcHBseSBKU09OLnN0cmluZ2lmeVxuICAgICAqIEByZXR1cm4ge1N0cmluZ3xPYmplY3R9XG4gICAgICovXG4gICAgZnVuY3Rpb24gZHVtcChhc0pzb24pIHtcbiAgICAgICAgdmFyIGR1bXBlZCA9IHtcbiAgICAgICAgICAgIGxvY2FsQ2FjaGU6IGxvY2FsRHVtcCgpLFxuICAgICAgICAgICAgcmVtb3RlQ2FjaGU6IHJlbW90ZUR1bXAoKVxuICAgICAgICB9O1xuICAgICAgICByZXR1cm4gYXNKc29uID8gdXRpbC5wcmV0dHlQcmludCgoZHVtcGVkLCBudWxsLCA0XG4gICAgKSkgOlxuICAgICAgICBkdW1wZWQ7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gX3JlbW90ZUNhY2hlKCkge1xuICAgICAgICByZXR1cm4gcmVtb3RlQ2FjaGVcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBfbG9jYWxDYWNoZSgpIHtcbiAgICAgICAgcmV0dXJuIGxvY2FsQ2FjaGVCeUlkO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFF1ZXJ5IHRoZSBjYWNoZVxuICAgICAqIEBwYXJhbSAge09iamVjdH0gb3B0cyBPYmplY3QgZGVzY3JpYmluZyB0aGUgcXVlcnlcbiAgICAgKiBAcmV0dXJuIHtNb2RlbEluc3RhbmNlfVxuICAgICAqIEBleGFtcGxlXG4gICAgICogYGBganNcbiAgICAgKiBjYWNoZS5nZXQoe19pZDogJzUnfSk7IC8vIFF1ZXJ5IGJ5IGxvY2FsIGlkXG4gICAgICogY2FjaGUuZ2V0KHtyZW1vdGVJZDogJzUnLCBtYXBwaW5nOiBteU1hcHBpbmd9KTsgLy8gUXVlcnkgYnkgcmVtb3RlIGlkXG4gICAgICogYGBgXG4gICAgICovXG4gICAgZnVuY3Rpb24gZ2V0KG9wdHMpIHtcbiAgICAgICAgbG9nKCdnZXQnLCBvcHRzKTtcbiAgICAgICAgdmFyIG9iaiwgaWRGaWVsZCwgcmVtb3RlSWQ7XG4gICAgICAgIHZhciBsb2NhbElkID0gb3B0cy5faWQ7XG4gICAgICAgIGlmIChsb2NhbElkKSB7XG4gICAgICAgICAgICBvYmogPSBnZXRWaWFMb2NhbElkKGxvY2FsSWQpO1xuICAgICAgICAgICAgaWYgKG9iaikge1xuICAgICAgICAgICAgICAgIHJldHVybiBvYmo7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmIChvcHRzLm1vZGVsKSB7XG4gICAgICAgICAgICAgICAgICAgIGlkRmllbGQgPSBvcHRzLm1vZGVsLmlkO1xuICAgICAgICAgICAgICAgICAgICByZW1vdGVJZCA9IG9wdHNbaWRGaWVsZF07XG4gICAgICAgICAgICAgICAgICAgIGxvZyhpZEZpZWxkICsgJz0nICsgcmVtb3RlSWQpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZ2V0VmlhUmVtb3RlSWQocmVtb3RlSWQsIG9wdHMpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChvcHRzLm1vZGVsKSB7XG4gICAgICAgICAgICBpZEZpZWxkID0gb3B0cy5tb2RlbC5pZDtcbiAgICAgICAgICAgIHJlbW90ZUlkID0gb3B0c1tpZEZpZWxkXTtcbiAgICAgICAgICAgIGlmIChyZW1vdGVJZCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBnZXRWaWFSZW1vdGVJZChyZW1vdGVJZCwgb3B0cyk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKG9wdHMubW9kZWwuc2luZ2xldG9uKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGdldFNpbmdsZXRvbihvcHRzLm1vZGVsKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGxvZygnSW52YWxpZCBvcHRzIHRvIGNhY2hlJywge1xuICAgICAgICAgICAgICAgIG9wdHM6IG9wdHNcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEluc2VydCBhbiBvYmplY3QgaW50byB0aGUgY2FjaGUuXG4gICAgICogQHBhcmFtICB7TW9kZWxJbnN0YW5jZX0gb2JqXG4gICAgICogQHRocm93cyB7SW50ZXJuYWxTaWVzdGFFcnJvcn0gQW4gb2JqZWN0IHdpdGggX2lkL3JlbW90ZUlkIGFscmVhZHkgZXhpc3RzLiBOb3QgdGhyb3duIGlmIHNhbWUgb2JoZWN0LlxuICAgICAqL1xuICAgIGZ1bmN0aW9uIGluc2VydChvYmopIHtcbiAgICAgICAgdmFyIGxvY2FsSWQgPSBvYmouX2lkO1xuICAgICAgICBpZiAobG9jYWxJZCkge1xuICAgICAgICAgICAgdmFyIGNvbGxlY3Rpb25OYW1lID0gb2JqLm1vZGVsLmNvbGxlY3Rpb25OYW1lO1xuICAgICAgICAgICAgdmFyIG1vZGVsTmFtZSA9IG9iai5tb2RlbC5uYW1lO1xuICAgICAgICAgICAgbG9nKCdMb2NhbCBjYWNoZSBpbnNlcnQ6ICcgKyBvYmouX2R1bXBTdHJpbmcoKSk7XG4gICAgICAgICAgICBpZiAoIWxvY2FsQ2FjaGVCeUlkW2xvY2FsSWRdKSB7XG4gICAgICAgICAgICAgICAgbG9jYWxDYWNoZUJ5SWRbbG9jYWxJZF0gPSBvYmo7XG4gICAgICAgICAgICAgICAgbG9nKCdMb2NhbCBjYWNoZSBub3cgbG9va3MgbGlrZTogJyArIGxvY2FsRHVtcCh0cnVlKSk7XG4gICAgICAgICAgICAgICAgaWYgKCFsb2NhbENhY2hlW2NvbGxlY3Rpb25OYW1lXSkgbG9jYWxDYWNoZVtjb2xsZWN0aW9uTmFtZV0gPSB7fTtcbiAgICAgICAgICAgICAgICBpZiAoIWxvY2FsQ2FjaGVbY29sbGVjdGlvbk5hbWVdW21vZGVsTmFtZV0pIGxvY2FsQ2FjaGVbY29sbGVjdGlvbk5hbWVdW21vZGVsTmFtZV0gPSB7fTtcbiAgICAgICAgICAgICAgICBsb2NhbENhY2hlW2NvbGxlY3Rpb25OYW1lXVttb2RlbE5hbWVdW2xvY2FsSWRdID0gb2JqO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBTb21ldGhpbmcgaGFzIGdvbmUgYmFkbHkgd3JvbmcgaGVyZS4gVHdvIG9iamVjdHMgc2hvdWxkIG5ldmVyIGV4aXN0IHdpdGggdGhlIHNhbWUgX2lkXG4gICAgICAgICAgICAgICAgaWYgKGxvY2FsQ2FjaGVCeUlkW2xvY2FsSWRdICE9IG9iaikge1xuICAgICAgICAgICAgICAgICAgICB2YXIgbWVzc2FnZSA9ICdPYmplY3Qgd2l0aCBfaWQ9XCInICsgbG9jYWxJZC50b1N0cmluZygpICsgJ1wiIGlzIGFscmVhZHkgaW4gdGhlIGNhY2hlLiAnICtcbiAgICAgICAgICAgICAgICAgICAgICAgICdUaGlzIGlzIGEgc2VyaW91cyBlcnJvci4gUGxlYXNlIGZpbGUgYSBidWcgcmVwb3J0IGlmIHlvdSBhcmUgZXhwZXJpZW5jaW5nIHRoaXMgb3V0IGluIHRoZSB3aWxkJztcbiAgICAgICAgICAgICAgICAgICAgbG9nKG1lc3NhZ2UpO1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcihtZXNzYWdlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgdmFyIGlkRmllbGQgPSBvYmouaWRGaWVsZDtcbiAgICAgICAgdmFyIHJlbW90ZUlkID0gb2JqW2lkRmllbGRdO1xuICAgICAgICBpZiAocmVtb3RlSWQpIHtcbiAgICAgICAgICAgIHJlbW90ZUluc2VydChvYmosIHJlbW90ZUlkKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGxvZygnTm8gcmVtb3RlIGlkIChcIicgKyBpZEZpZWxkICsgJ1wiKSBzbyB3b250IGJlIHBsYWNpbmcgaW4gdGhlIHJlbW90ZSBjYWNoZScsIG9iaik7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRydWUgaWYgb2JqZWN0IGlzIGluIHRoZSBjYWNoZVxuICAgICAqIEBwYXJhbSAge01vZGVsSW5zdGFuY2V9IG9ialxuICAgICAqIEByZXR1cm4ge2Jvb2xlYW59XG4gICAgICovXG4gICAgZnVuY3Rpb24gY29udGFpbnMob2JqKSB7XG4gICAgICAgIHZhciBxID0ge1xuICAgICAgICAgICAgX2lkOiBvYmouX2lkXG4gICAgICAgIH07XG4gICAgICAgIHZhciBtb2RlbCA9IG9iai5tb2RlbDtcbiAgICAgICAgaWYgKG1vZGVsLmlkKSB7XG4gICAgICAgICAgICBpZiAob2JqW21vZGVsLmlkXSkge1xuICAgICAgICAgICAgICAgIHEubW9kZWwgPSBtb2RlbDtcbiAgICAgICAgICAgICAgICBxW21vZGVsLmlkXSA9IG9ialttb2RlbC5pZF07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuICEhZ2V0KHEpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlbW92ZXMgdGhlIG9iamVjdCBmcm9tIHRoZSBjYWNoZSAoaWYgaXQncyBhY3R1YWxseSBpbiB0aGUgY2FjaGUpIG90aGVyd2lzZXMgdGhyb3dzIGFuIGVycm9yLlxuICAgICAqIEBwYXJhbSAge01vZGVsSW5zdGFuY2V9IG9ialxuICAgICAqIEB0aHJvd3Mge0ludGVybmFsU2llc3RhRXJyb3J9IElmIG9iamVjdCBhbHJlYWR5IGluIHRoZSBjYWNoZS5cbiAgICAgKi9cbiAgICBmdW5jdGlvbiByZW1vdmUob2JqKSB7XG4gICAgICAgIGlmIChjb250YWlucyhvYmopKSB7XG4gICAgICAgICAgICB2YXIgY29sbGVjdGlvbk5hbWUgPSBvYmoubW9kZWwuY29sbGVjdGlvbk5hbWU7XG4gICAgICAgICAgICB2YXIgbW9kZWxOYW1lID0gb2JqLm1vZGVsLm5hbWU7XG4gICAgICAgICAgICB2YXIgX2lkID0gb2JqLl9pZDtcbiAgICAgICAgICAgIGlmICghbW9kZWxOYW1lKSB0aHJvdyBJbnRlcm5hbFNpZXN0YUVycm9yKCdObyBtYXBwaW5nIG5hbWUnKTtcbiAgICAgICAgICAgIGlmICghY29sbGVjdGlvbk5hbWUpIHRocm93IEludGVybmFsU2llc3RhRXJyb3IoJ05vIGNvbGxlY3Rpb24gbmFtZScpO1xuICAgICAgICAgICAgaWYgKCFfaWQpIHRocm93IEludGVybmFsU2llc3RhRXJyb3IoJ05vIF9pZCcpO1xuICAgICAgICAgICAgZGVsZXRlIGxvY2FsQ2FjaGVbY29sbGVjdGlvbk5hbWVdW21vZGVsTmFtZV1bX2lkXTtcbiAgICAgICAgICAgIGRlbGV0ZSBsb2NhbENhY2hlQnlJZFtfaWRdO1xuICAgICAgICAgICAgaWYgKG9iai5tb2RlbC5pZCkge1xuICAgICAgICAgICAgICAgIHZhciByZW1vdGVJZCA9IG9ialtvYmoubW9kZWwuaWRdO1xuICAgICAgICAgICAgICAgIGlmIChyZW1vdGVJZCkge1xuICAgICAgICAgICAgICAgICAgICBkZWxldGUgcmVtb3RlQ2FjaGVbY29sbGVjdGlvbk5hbWVdW21vZGVsTmFtZV1bcmVtb3RlSWRdO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdPYmplY3Qgd2FzIG5vdCBpbiBjYWNoZS4nKTtcbiAgICAgICAgfVxuICAgIH1cblxuXG4gICAgZXhwb3J0cy5fcmVtb3RlQ2FjaGUgPSBfcmVtb3RlQ2FjaGU7XG4gICAgZXhwb3J0cy5fbG9jYWxDYWNoZSA9IF9sb2NhbENhY2hlO1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCAnX2xvY2FsQ2FjaGVCeVR5cGUnLCB7XG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIGxvY2FsQ2FjaGU7XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBleHBvcnRzLmdldCA9IGdldDtcbiAgICBleHBvcnRzLmluc2VydCA9IGluc2VydDtcbiAgICBleHBvcnRzLnJlbW90ZUluc2VydCA9IHJlbW90ZUluc2VydDtcbiAgICBleHBvcnRzLnJlc2V0ID0gcmVzZXQ7XG4gICAgZXhwb3J0cy5fZHVtcCA9IGR1bXA7XG4gICAgZXhwb3J0cy5jb250YWlucyA9IGNvbnRhaW5zO1xuICAgIGV4cG9ydHMucmVtb3ZlID0gcmVtb3ZlO1xuICAgIGV4cG9ydHMuZ2V0U2luZ2xldG9uID0gZ2V0U2luZ2xldG9uO1xufSkoKTsiLCIvKipcbiAqIEBtb2R1bGUgY29sbGVjdGlvblxuICovXG4oZnVuY3Rpb24gKCkge1xuICAgIHZhciBsb2cgPSByZXF1aXJlKCcuL2xvZycpKCdjb2xsZWN0aW9uJyksXG4gICAgICAgIENvbGxlY3Rpb25SZWdpc3RyeSA9IHJlcXVpcmUoJy4vY29sbGVjdGlvblJlZ2lzdHJ5JykuQ29sbGVjdGlvblJlZ2lzdHJ5LFxuICAgICAgICBJbnRlcm5hbFNpZXN0YUVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpLkludGVybmFsU2llc3RhRXJyb3IsXG4gICAgICAgIE1vZGVsID0gcmVxdWlyZSgnLi9tb2RlbCcpLFxuICAgICAgICBleHRlbmQgPSByZXF1aXJlKCdleHRlbmQnKSxcbiAgICAgICAgb2JzZXJ2ZSA9IHJlcXVpcmUoJy4uL3ZlbmRvci9vYnNlcnZlLWpzL3NyYy9vYnNlcnZlJykuUGxhdGZvcm0sXG4gICAgICAgIGV2ZW50cyA9IHJlcXVpcmUoJy4vZXZlbnRzJyksXG4gICAgICAgIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKSxcbiAgICAgICAgXyA9IHV0aWwuXyxcbiAgICAgICAgZXJyb3IgPSByZXF1aXJlKCcuL2Vycm9yJyksXG4gICAgICAgIGNhY2hlID0gcmVxdWlyZSgnLi9jYWNoZScpO1xuXG5cbiAgICAvKipcbiAgICAgKiBBIGNvbGxlY3Rpb24gZGVzY3JpYmVzIGEgc2V0IG9mIG1vZGVscyBhbmQgb3B0aW9uYWxseSBhIFJFU1QgQVBJIHdoaWNoIHdlIHdvdWxkXG4gICAgICogbGlrZSB0byBtb2RlbC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSBuYW1lXG4gICAgICogQHBhcmFtIG9wdHNcbiAgICAgKiBAY29uc3RydWN0b3JcbiAgICAgKlxuICAgICAqXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBgYGBqc1xuICAgICAqIHZhciBHaXRIdWIgPSBuZXcgc2llc3RhKCdHaXRIdWInKVxuICAgICAqIC8vIC4uLiBjb25maWd1cmUgbWFwcGluZ3MsIGRlc2NyaXB0b3JzIGV0YyAuLi5cbiAgICAgKiBHaXRIdWIuaW5zdGFsbChmdW5jdGlvbiAoKSB7XG4gICAgICogICAgIC8vIC4uLiBjYXJyeSBvbi5cbiAgICAgKiB9KTtcbiAgICAgKiBgYGBcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBDb2xsZWN0aW9uKG5hbWUsIG9wdHMpIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICBpZiAoIW5hbWUpIHRocm93IG5ldyBFcnJvcignQ29sbGVjdGlvbiBtdXN0IGhhdmUgYSBuYW1lJyk7XG5cbiAgICAgICAgb3B0cyA9IG9wdHMgfHwge307XG4gICAgICAgIHV0aWwuZXh0ZW5kRnJvbU9wdHModGhpcywgb3B0cywge1xuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBUaGUgVVJMIG9mIHRoZSBBUEkgZS5nLiBodHRwOi8vYXBpLmdpdGh1Yi5jb21cbiAgICAgICAgICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIGJhc2VVUkw6ICcnXG4gICAgICAgIH0pO1xuXG4gICAgICAgIF8uZXh0ZW5kKHRoaXMsIHtcbiAgICAgICAgICAgIG5hbWU6IG5hbWUsXG4gICAgICAgICAgICBfcmF3TW9kZWxzOiB7fSxcbiAgICAgICAgICAgIF9tb2RlbHM6IHt9LFxuICAgICAgICAgICAgX29wdHM6IG9wdHMsXG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIFNldCB0byB0cnVlIGlmIGluc3RhbGxhdGlvbiBoYXMgc3VjY2VlZGVkLiBZb3UgY2Fubm90IHVzZSB0aGUgY29sbGVjdGlvXG4gICAgICAgICAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgaW5zdGFsbGVkOiBmYWxzZVxuICAgICAgICB9KTtcblxuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydGllcyh0aGlzLCB7XG4gICAgICAgICAgICBkaXJ0eToge1xuICAgICAgICAgICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoc2llc3RhLmV4dC5zdG9yYWdlRW5hYmxlZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHVuc2F2ZWRPYmplY3RzQnlDb2xsZWN0aW9uID0gc2llc3RhLmV4dC5zdG9yYWdlLl91bnNhdmVkT2JqZWN0c0J5Q29sbGVjdGlvbixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBoYXNoID0gdW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb25bc2VsZi5uYW1lXSB8fCB7fTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiAhIU9iamVjdC5rZXlzKGhhc2gpLmxlbmd0aDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBlbHNlIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlXG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIENvbGxlY3Rpb25SZWdpc3RyeS5yZWdpc3Rlcih0aGlzKTtcbiAgICAgICAgZXZlbnRzLlByb3h5RXZlbnRFbWl0dGVyLmNhbGwodGhpcywgdGhpcy5uYW1lKTtcbiAgICB9XG5cbiAgICBDb2xsZWN0aW9uLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoZXZlbnRzLlByb3h5RXZlbnRFbWl0dGVyLnByb3RvdHlwZSk7XG5cbiAgICBfLmV4dGVuZChDb2xsZWN0aW9uLnByb3RvdHlwZSwge1xuICAgICAgICAvKipcbiAgICAgICAgICogRW5zdXJlIG1hcHBpbmdzIGFyZSBpbnN0YWxsZWQuXG4gICAgICAgICAqIEBwYXJhbSBbY2JdXG4gICAgICAgICAqIEBjbGFzcyBDb2xsZWN0aW9uXG4gICAgICAgICAqL1xuICAgICAgICBpbnN0YWxsOiBmdW5jdGlvbiAoY2IpIHtcbiAgICAgICAgICAgIHJldHVybiB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uIChjYikge1xuICAgICAgICAgICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgICAgICAgICBpZiAoIXRoaXMuaW5zdGFsbGVkKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBtb2RlbHNUb0luc3RhbGwgPSBbXTtcbiAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgbmFtZSBpbiB0aGlzLl9tb2RlbHMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLl9tb2RlbHMuaGFzT3duUHJvcGVydHkobmFtZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgbW9kZWwgPSB0aGlzLl9tb2RlbHNbbmFtZV07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbW9kZWxzVG9JbnN0YWxsLnB1c2gobW9kZWwpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGxvZygnVGhlcmUgYXJlICcgKyBtb2RlbHNUb0luc3RhbGwubGVuZ3RoLnRvU3RyaW5nKCkgKyAnIG1hcHBpbmdzIHRvIGluc3RhbGwnKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG1vZGVsc1RvSW5zdGFsbC5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciB0YXNrcyA9IF8ubWFwKG1vZGVsc1RvSW5zdGFsbCwgZnVuY3Rpb24gKG0pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gXy5iaW5kKG0uaW5zdGFsbCwgbSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHV0aWwuYXN5bmMucGFyYWxsZWwodGFza3MsIGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZygnRmFpbGVkIHRvIGluc3RhbGwgY29sbGVjdGlvbicsIGVycik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYuX2ZpbmFsaXNlSW5zdGFsbGF0aW9uKGVyciwgY2IpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2VsZi5pbnN0YWxsZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgZXJyb3JzID0gW107XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIF8uZWFjaChtb2RlbHNUb0luc3RhbGwsIGZ1bmN0aW9uIChtKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2coJ0luc3RhbGxpbmcgcmVsYXRpb25zaGlwcyBmb3IgbWFwcGluZyB3aXRoIG5hbWUgXCInICsgbS5uYW1lICsgJ1wiJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgZXJyID0gbS5pbnN0YWxsUmVsYXRpb25zaGlwcygpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVycikgZXJyb3JzLnB1c2goZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghZXJyb3JzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXy5lYWNoKG1vZGVsc1RvSW5zdGFsbCwgZnVuY3Rpb24gKG0pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2coJ0luc3RhbGxpbmcgcmV2ZXJzZSByZWxhdGlvbnNoaXBzIGZvciBtYXBwaW5nIHdpdGggbmFtZSBcIicgKyBtLm5hbWUgKyAnXCInKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgZXJyID0gbS5pbnN0YWxsUmV2ZXJzZVJlbGF0aW9uc2hpcHMoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKSBlcnJvcnMucHVzaChlcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVycm9ycy5sZW5ndGggPT0gMSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZXJyID0gZXJyb3JzWzBdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGVycm9ycy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVyciA9IGVycm9ycztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZWxmLl9maW5hbGlzZUluc3RhbGxhdGlvbihlcnIsIGNiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2VsZi5fZmluYWxpc2VJbnN0YWxsYXRpb24obnVsbCwgY2IpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ0NvbGxlY3Rpb24gXCInICsgdGhpcy5uYW1lICsgJ1wiIGhhcyBhbHJlYWR5IGJlZW4gaW5zdGFsbGVkJyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogTWFyayB0aGlzIGNvbGxlY3Rpb24gYXMgaW5zdGFsbGVkLCBhbmQgcGxhY2UgdGhlIGNvbGxlY3Rpb24gb24gdGhlIGdsb2JhbCBTaWVzdGEgb2JqZWN0LlxuICAgICAgICAgKiBAcGFyYW0gIHtPYmplY3R9ICAgZXJyXG4gICAgICAgICAqIEBwYXJhbSAge0Z1bmN0aW9ufSBjYWxsYmFja1xuICAgICAgICAgKiBAY2xhc3MgQ29sbGVjdGlvblxuICAgICAgICAgKi9cbiAgICAgICAgX2ZpbmFsaXNlSW5zdGFsbGF0aW9uOiBmdW5jdGlvbiAoZXJyLCBjYWxsYmFjaykge1xuICAgICAgICAgICAgaWYgKGVycikgZXJyID0gZXJyb3IoJ0Vycm9ycyB3ZXJlIGVuY291bnRlcmVkIHdoaWxzdCBzZXR0aW5nIHVwIHRoZSBjb2xsZWN0aW9uJywge2Vycm9yczogZXJyfSk7XG4gICAgICAgICAgICBpZiAoIWVycikge1xuICAgICAgICAgICAgICAgIHRoaXMuaW5zdGFsbGVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB2YXIgaW5kZXggPSByZXF1aXJlKCcuL2luZGV4Jyk7XG4gICAgICAgICAgICAgICAgaW5kZXhbdGhpcy5uYW1lXSA9IHRoaXM7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICB9LFxuICAgICAgICAvKipcbiAgICAgICAgICogR2l2ZW4gdGhlIG5hbWUgb2YgYSBtYXBwaW5nIGFuZCBhbiBvcHRpb25zIG9iamVjdCBkZXNjcmliaW5nIHRoZSBtYXBwaW5nLCBjcmVhdGluZyBhIE1vZGVsXG4gICAgICAgICAqIG9iamVjdCwgaW5zdGFsbCBpdCBhbmQgcmV0dXJuIGl0LlxuICAgICAgICAgKiBAcGFyYW0gIHtTdHJpbmd9IG5hbWVcbiAgICAgICAgICogQHBhcmFtICB7T2JqZWN0fSBvcHRzXG4gICAgICAgICAqIEByZXR1cm4ge01vZGVsfVxuICAgICAgICAgKiBAY2xhc3MgQ29sbGVjdGlvblxuICAgICAgICAgKi9cbiAgICAgICAgX21vZGVsOiBmdW5jdGlvbiAobmFtZSwgb3B0cykge1xuICAgICAgICAgICAgaWYgKG5hbWUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9yYXdNb2RlbHNbbmFtZV0gPSBvcHRzO1xuICAgICAgICAgICAgICAgIG9wdHMgPSBleHRlbmQodHJ1ZSwge30sIG9wdHMpO1xuICAgICAgICAgICAgICAgIG9wdHMubmFtZSA9IG5hbWU7XG4gICAgICAgICAgICAgICAgb3B0cy5jb2xsZWN0aW9uID0gdGhpcztcbiAgICAgICAgICAgICAgICB2YXIgbW9kZWwgPSBuZXcgTW9kZWwob3B0cyk7XG4gICAgICAgICAgICAgICAgdGhpcy5fbW9kZWxzW25hbWVdID0gbW9kZWw7XG4gICAgICAgICAgICAgICAgdGhpc1tuYW1lXSA9IG1vZGVsO1xuICAgICAgICAgICAgICAgIHJldHVybiBtb2RlbDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdObyBuYW1lIHNwZWNpZmllZCB3aGVuIGNyZWF0aW5nIG1hcHBpbmcnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBSZWdpc3RlcnMgYSBtb2RlbCB3aXRoIHRoaXMgY29sbGVjdGlvbi5cbiAgICAgICAgICogQHBhcmFtIHtTdHJpbmd8T2JqZWN0fSBvcHRzT3JOYW1lIEFuIG9wdGlvbnMgb2JqZWN0IG9yIHRoZSBuYW1lIG9mIHRoZSBtYXBwaW5nLiBNdXN0IHBhc3Mgb3B0aW9ucyBhcyBzZWNvbmQgcGFyYW0gaWYgc3BlY2lmeSBuYW1lLlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gb3B0cyBPcHRpb25zIGlmIG5hbWUgYWxyZWFkeSBzcGVjaWZpZWQuXG4gICAgICAgICAqIEByZXR1cm4ge01vZGVsfVxuICAgICAgICAgKiBAY2xhc3MgQ29sbGVjdGlvblxuICAgICAgICAgKi9cbiAgICAgICAgbW9kZWw6IGZ1bmN0aW9uIChvcCkge1xuICAgICAgICAgICAgdmFyIGFjY2VwdE1vZGVscyA9ICF0aGlzLmluc3RhbGxlZDtcbiAgICAgICAgICAgIGlmIChhY2NlcHRNb2RlbHMpIHtcbiAgICAgICAgICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgICAgICAgICAgaWYgKGFyZ3VtZW50cy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT0gMSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHV0aWwuaXNBcnJheShhcmd1bWVudHNbMF0pKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIF8ubWFwKGFyZ3VtZW50c1swXSwgZnVuY3Rpb24gKG0pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHNlbGYuX21vZGVsKG0ubmFtZSwgbSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBuYW1lLCBvcHRzO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICh1dGlsLmlzU3RyaW5nKGFyZ3VtZW50c1swXSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmFtZSA9IGFyZ3VtZW50c1swXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb3B0cyA9IHt9O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb3B0cyA9IGFyZ3VtZW50c1swXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmFtZSA9IG9wdHMubmFtZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuX21vZGVsKG5hbWUsIG9wdHMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBhcmd1bWVudHNbMF0gPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5fbW9kZWwoYXJndW1lbnRzWzBdLCBhcmd1bWVudHNbMV0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gXy5tYXAoYXJndW1lbnRzLCBmdW5jdGlvbiAobSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gc2VsZi5fbW9kZWwobS5uYW1lLCBtKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHRocm93IEVycm9yKCdDYW5ub3QgY3JlYXRlIG5ldyBtb2RlbHMgb25jZSB0aGUgb2JqZWN0IGdyYXBoIGlzIGVzdGFibGlzaGVkIScpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIER1bXAgdGhpcyBjb2xsZWN0aW9uIGFzIEpTT05cbiAgICAgICAgICogQHBhcmFtICB7Qm9vbGVhbn0gYXNKc29uIFdoZXRoZXIgb3Igbm90IHRvIGFwcGx5IEpTT04uc3RyaW5naWZ5XG4gICAgICAgICAqIEByZXR1cm4ge1N0cmluZ3xPYmplY3R9XG4gICAgICAgICAqIEBjbGFzcyBDb2xsZWN0aW9uXG4gICAgICAgICAqL1xuICAgICAgICBfZHVtcDogZnVuY3Rpb24gKGFzSnNvbikge1xuICAgICAgICAgICAgdmFyIG9iaiA9IHt9O1xuICAgICAgICAgICAgb2JqLmluc3RhbGxlZCA9IHRoaXMuaW5zdGFsbGVkO1xuICAgICAgICAgICAgb2JqLmRvY0lkID0gdGhpcy5fZG9jSWQ7XG4gICAgICAgICAgICBvYmoubmFtZSA9IHRoaXMubmFtZTtcbiAgICAgICAgICAgIG9iai5iYXNlVVJMID0gdGhpcy5iYXNlVVJMO1xuICAgICAgICAgICAgcmV0dXJuIGFzSnNvbiA/IHV0aWwucHJldHR5UHJpbnQob2JqKSA6IG9iajtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogUmV0dXJucyB0aGUgbnVtYmVyIG9mIG9iamVjdHMgaW4gdGhpcyBjb2xsZWN0aW9uLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0gY2JcbiAgICAgICAgICogQHJldHVybnMge1Byb21pc2V9XG4gICAgICAgICAqL1xuICAgICAgICBjb3VudDogZnVuY3Rpb24gKGNiKSB7XG4gICAgICAgICAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbiAoY2IpIHtcbiAgICAgICAgICAgICAgICB2YXIgdGFza3MgPSBfLm1hcCh0aGlzLl9tb2RlbHMsIGZ1bmN0aW9uIChtKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBfLmJpbmQobS5jb3VudCwgbSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgdXRpbC5hc3luYy5wYXJhbGxlbCh0YXNrcywgZnVuY3Rpb24gKGVyciwgbnMpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIG47XG4gICAgICAgICAgICAgICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBuID0gXy5yZWR1Y2UobnMsIGZ1bmN0aW9uIChtLCByKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG0gKyByXG4gICAgICAgICAgICAgICAgICAgICAgICB9LCAwKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBjYihlcnIsIG4pO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBDb2xsZWN0aW9uO1xufSkoKTsiLCIvKipcbiAqIEBtb2R1bGUgY29sbGVjdGlvblxuICovXG4oZnVuY3Rpb24gKCkge1xuICAgIHZhciBfID0gcmVxdWlyZSgnLi91dGlsJykuXztcblxuICAgIGZ1bmN0aW9uIENvbGxlY3Rpb25SZWdpc3RyeSgpIHtcbiAgICAgICAgaWYgKCF0aGlzKSByZXR1cm4gbmV3IENvbGxlY3Rpb25SZWdpc3RyeSgpO1xuICAgICAgICB0aGlzLmNvbGxlY3Rpb25OYW1lcyA9IFtdO1xuICAgIH1cblxuICAgIF8uZXh0ZW5kKENvbGxlY3Rpb25SZWdpc3RyeS5wcm90b3R5cGUsIHtcbiAgICAgICAgcmVnaXN0ZXI6IGZ1bmN0aW9uIChjb2xsZWN0aW9uKSB7XG4gICAgICAgICAgICB2YXIgbmFtZSA9IGNvbGxlY3Rpb24ubmFtZTtcbiAgICAgICAgICAgIHRoaXNbbmFtZV0gPSBjb2xsZWN0aW9uO1xuICAgICAgICAgICAgdGhpcy5jb2xsZWN0aW9uTmFtZXMucHVzaChuYW1lKTtcbiAgICAgICAgfSxcbiAgICAgICAgcmVzZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgICAgIF8uZWFjaCh0aGlzLmNvbGxlY3Rpb25OYW1lcywgZnVuY3Rpb24gKG5hbWUpIHtcbiAgICAgICAgICAgICAgICBkZWxldGUgc2VsZltuYW1lXTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgdGhpcy5jb2xsZWN0aW9uTmFtZXMgPSBbXTtcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgZXhwb3J0cy5Db2xsZWN0aW9uUmVnaXN0cnkgPSBuZXcgQ29sbGVjdGlvblJlZ2lzdHJ5KCk7XG59KSgpOyIsIi8qKlxuICogQG1vZHVsZSBlcnJvclxuICovXG4oZnVuY3Rpb24gKCkge1xuXG4gICAgLyoqXG4gICAgICogVXNlcnMgc2hvdWxkIG5ldmVyIHNlZSB0aGVzZSB0aHJvd24uIEEgYnVnIHJlcG9ydCBzaG91bGQgYmUgZmlsZWQgaWYgc28gYXMgaXQgbWVhbnMgc29tZSBhc3NlcnRpb24gaGFzIGZhaWxlZC5cbiAgICAgKiBAcGFyYW0gbWVzc2FnZVxuICAgICAqIEBwYXJhbSBjb250ZXh0XG4gICAgICogQHBhcmFtIHNzZlxuICAgICAqIEBjb25zdHJ1Y3RvclxuICAgICAqL1xuICAgIGZ1bmN0aW9uIEludGVybmFsU2llc3RhRXJyb3IobWVzc2FnZSwgY29udGV4dCwgc3NmKSB7XG4gICAgICAgIHRoaXMubWVzc2FnZSA9IG1lc3NhZ2U7XG4gICAgICAgIHRoaXMuY29udGV4dCA9IGNvbnRleHQ7XG4gICAgICAgIC8vIGNhcHR1cmUgc3RhY2sgdHJhY2VcbiAgICAgICAgaWYgKHNzZiAmJiBFcnJvci5jYXB0dXJlU3RhY2tUcmFjZSkge1xuICAgICAgICAgICAgRXJyb3IuY2FwdHVyZVN0YWNrVHJhY2UodGhpcywgc3NmKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIEludGVybmFsU2llc3RhRXJyb3IucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShFcnJvci5wcm90b3R5cGUpO1xuICAgIEludGVybmFsU2llc3RhRXJyb3IucHJvdG90eXBlLm5hbWUgPSAnSW50ZXJuYWxTaWVzdGFFcnJvcic7XG4gICAgSW50ZXJuYWxTaWVzdGFFcnJvci5wcm90b3R5cGUuY29uc3RydWN0b3IgPSBJbnRlcm5hbFNpZXN0YUVycm9yO1xuXG4gICAgZnVuY3Rpb24gaXNTaWVzdGFFcnJvcihlcnIpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBlcnIgPT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgIHJldHVybiAnZXJyb3InIGluIGVyciAmJiAnb2snIGluIGVyciAmJiAncmVhc29uJyBpbiBlcnI7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKGVyck1lc3NhZ2UsIGV4dHJhKSB7XG4gICAgICAgIGlmIChpc1NpZXN0YUVycm9yKGVyck1lc3NhZ2UpKSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyTWVzc2FnZTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgZXJyID0ge1xuICAgICAgICAgICAgcmVhc29uOiBlcnJNZXNzYWdlLFxuICAgICAgICAgICAgZXJyb3I6IHRydWUsXG4gICAgICAgICAgICBvazogZmFsc2VcbiAgICAgICAgfTtcbiAgICAgICAgZm9yICh2YXIgcHJvcCBpbiBleHRyYSB8fCB7fSkge1xuICAgICAgICAgICAgaWYgKGV4dHJhLmhhc093blByb3BlcnR5KHByb3ApKSBlcnJbcHJvcF0gPSBleHRyYVtwcm9wXTtcbiAgICAgICAgfVxuICAgICAgICBlcnIudG9TdHJpbmcgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkodGhpcyk7XG4gICAgICAgIH07XG4gICAgICAgIHJldHVybiBlcnI7XG4gICAgfTtcblxuICAgIG1vZHVsZS5leHBvcnRzLkludGVybmFsU2llc3RhRXJyb3IgPSBJbnRlcm5hbFNpZXN0YUVycm9yO1xuXG59KSgpOyIsIihmdW5jdGlvbiAoKSB7XG4gICAgdmFyIEV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJ2V2ZW50cycpLkV2ZW50RW1pdHRlcixcbiAgICAgICAgQXJyYXlPYnNlcnZlciA9IHJlcXVpcmUoJy4uL3ZlbmRvci9vYnNlcnZlLWpzL3NyYy9vYnNlcnZlJykuQXJyYXlPYnNlcnZlcixcbiAgICAgICAgXyA9IHJlcXVpcmUoJy4vdXRpbCcpLl8sXG4gICAgICAgIG1vZGVsRXZlbnRzID0gcmVxdWlyZSgnLi9tb2RlbEV2ZW50cycpO1xuXG4gICAgdmFyIGV2ZW50cyA9IG5ldyBFdmVudEVtaXR0ZXIoKTtcbiAgICBldmVudHMuc2V0TWF4TGlzdGVuZXJzKDEwMCk7XG5cbiAgICAvKipcbiAgICAgKiBMaXN0ZW4gdG8gYSBwYXJ0aWN1bGFyIGV2ZW50IGZyb20gdGhlIFNpZXN0YSBnbG9iYWwgRXZlbnRFbWl0dGVyLlxuICAgICAqIE1hbmFnZXMgaXRzIG93biBzZXQgb2YgbGlzdGVuZXJzLlxuICAgICAqIEBjb25zdHJ1Y3RvclxuICAgICAqL1xuICAgIGZ1bmN0aW9uIFByb3h5RXZlbnRFbWl0dGVyKGV2ZW50KSB7XG4gICAgICAgIF8uZXh0ZW5kKHRoaXMsIHtcbiAgICAgICAgICAgIGV2ZW50OiBldmVudCxcbiAgICAgICAgICAgIGxpc3RlbmVyczoge31cbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgXy5leHRlbmQoUHJveHlFdmVudEVtaXR0ZXIucHJvdG90eXBlLCB7XG4gICAgICAgIGxpc3RlbjogZnVuY3Rpb24gKHR5cGUsIGZuKSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIHR5cGUgPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgICAgIGZuID0gdHlwZTtcbiAgICAgICAgICAgICAgICB0eXBlID0gbnVsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHZhciBfZm4gPSBmbjtcbiAgICAgICAgICAgICAgICBmbiA9IGZ1bmN0aW9uIChlKSB7XG4gICAgICAgICAgICAgICAgICAgIGUgPSBlIHx8IHt9O1xuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGUudHlwZSA9PSB0eXBlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgX2ZuKGUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgX2ZuKGUpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICB2YXIgbGlzdGVuZXJzID0gdGhpcy5saXN0ZW5lcnM7XG4gICAgICAgICAgICAgICAgaWYgKHR5cGUpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFsaXN0ZW5lcnNbdHlwZV0pIGxpc3RlbmVyc1t0eXBlXSA9IFtdO1xuICAgICAgICAgICAgICAgICAgICBsaXN0ZW5lcnNbdHlwZV0ucHVzaChmbik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZXZlbnRzLm9uKHRoaXMuZXZlbnQsIGZuKTtcbiAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fcmVtb3ZlTGlzdGVuZXIoZm4sIHR5cGUpO1xuICAgICAgICAgICAgfS5iaW5kKHRoaXMpO1xuICAgICAgICB9LFxuICAgICAgICBsaXN0ZW5PbmNlOiBmdW5jdGlvbiAodHlwZSwgZm4pIHtcbiAgICAgICAgICAgIHZhciBldmVudCA9IHRoaXMuZXZlbnQ7XG4gICAgICAgICAgICBpZiAodHlwZW9mIHR5cGUgPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgICAgIGZuID0gdHlwZTtcbiAgICAgICAgICAgICAgICB0eXBlID0gbnVsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHZhciBfZm4gPSBmbjtcbiAgICAgICAgICAgICAgICBmbiA9IGZ1bmN0aW9uIChlKSB7XG4gICAgICAgICAgICAgICAgICAgIGUgPSBlIHx8IHt9O1xuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGUudHlwZSA9PSB0eXBlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZXZlbnRzLnJlbW92ZUxpc3RlbmVyKGV2ZW50LCBmbik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgX2ZuKGUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgX2ZuKGUpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHR5cGUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZXZlbnRzLm9uKGV2ZW50LCBmbik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZXZlbnRzLm9uY2UoZXZlbnQsIGZuKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgX3JlbW92ZUxpc3RlbmVyOiBmdW5jdGlvbiAoZm4sIHR5cGUpIHtcbiAgICAgICAgICAgIGlmICh0eXBlKSB7XG4gICAgICAgICAgICAgICAgdmFyIGxpc3RlbmVycyA9IHRoaXMubGlzdGVuZXJzW3R5cGVdLFxuICAgICAgICAgICAgICAgICAgICBpZHggPSBsaXN0ZW5lcnMuaW5kZXhPZihmbik7XG4gICAgICAgICAgICAgICAgbGlzdGVuZXJzLnNwbGljZShpZHgsIDEpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGV2ZW50cy5yZW1vdmVMaXN0ZW5lcih0aGlzLmV2ZW50LCBmbik7XG4gICAgICAgIH0sXG4gICAgICAgIGVtaXQ6IGZ1bmN0aW9uICh0eXBlLCBwYXlsb2FkKSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIHR5cGUgPT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgICAgICBwYXlsb2FkID0gdHlwZTtcbiAgICAgICAgICAgICAgICB0eXBlID0gbnVsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHBheWxvYWQgPSBwYXlsb2FkIHx8IHt9O1xuICAgICAgICAgICAgICAgIHBheWxvYWQudHlwZSA9IHR5cGU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBldmVudHMuZW1pdC5jYWxsKGV2ZW50cywgdGhpcy5ldmVudCwgcGF5bG9hZCk7XG4gICAgICAgIH0sXG4gICAgICAgIF9yZW1vdmVBbGxMaXN0ZW5lcnM6IGZ1bmN0aW9uICh0eXBlKSB7XG4gICAgICAgICAgICAodGhpcy5saXN0ZW5lcnNbdHlwZV0gfHwgW10pLmZvckVhY2goZnVuY3Rpb24gKGZuKSB7XG4gICAgICAgICAgICAgICAgZXZlbnRzLnJlbW92ZUxpc3RlbmVyKHRoaXMuZXZlbnQsIGZuKTtcbiAgICAgICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICAgICAgICB0aGlzLmxpc3RlbmVyc1t0eXBlXSA9IFtdO1xuICAgICAgICB9LFxuICAgICAgICByZW1vdmVBbGxMaXN0ZW5lcnM6IGZ1bmN0aW9uICh0eXBlKSB7XG4gICAgICAgICAgICBpZiAodHlwZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3JlbW92ZUFsbExpc3RlbmVycyh0eXBlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGZvciAodHlwZSBpbiB0aGlzLmxpc3RlbmVycykge1xuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5saXN0ZW5lcnMuaGFzT3duUHJvcGVydHkodHlwZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX3JlbW92ZUFsbExpc3RlbmVycyh0eXBlKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gQWxpYXNlc1xuICAgIF8uZXh0ZW5kKFByb3h5RXZlbnRFbWl0dGVyLnByb3RvdHlwZSwge1xuICAgICAgICBvbjogUHJveHlFdmVudEVtaXR0ZXIucHJvdG90eXBlLmxpc3RlblxuICAgIH0pO1xuXG4gICAgXy5leHRlbmQoZXZlbnRzLCB7XG4gICAgICAgIFByb3h5RXZlbnRFbWl0dGVyOiBQcm94eUV2ZW50RW1pdHRlcixcbiAgICAgICAgd3JhcEFycmF5OiBmdW5jdGlvbiAoYXJyYXksIGZpZWxkLCBtb2RlbEluc3RhbmNlKSB7XG4gICAgICAgICAgICBpZiAoIWFycmF5Lm9ic2VydmVyKSB7XG4gICAgICAgICAgICAgICAgYXJyYXkub2JzZXJ2ZXIgPSBuZXcgQXJyYXlPYnNlcnZlcihhcnJheSk7XG4gICAgICAgICAgICAgICAgYXJyYXkub2JzZXJ2ZXIub3BlbihmdW5jdGlvbiAoc3BsaWNlcykge1xuICAgICAgICAgICAgICAgICAgICB2YXIgZmllbGRJc0F0dHJpYnV0ZSA9IG1vZGVsSW5zdGFuY2UuX2F0dHJpYnV0ZU5hbWVzLmluZGV4T2YoZmllbGQpID4gLTE7XG4gICAgICAgICAgICAgICAgICAgIGlmIChmaWVsZElzQXR0cmlidXRlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzcGxpY2VzLmZvckVhY2goZnVuY3Rpb24gKHNwbGljZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1vZGVsRXZlbnRzLmVtaXQoe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb2xsZWN0aW9uOiBtb2RlbEluc3RhbmNlLmNvbGxlY3Rpb25OYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtb2RlbDogbW9kZWxJbnN0YW5jZS5tb2RlbC5uYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBfaWQ6IG1vZGVsSW5zdGFuY2UuX2lkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbmRleDogc3BsaWNlLmluZGV4LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZW1vdmVkOiBzcGxpY2UucmVtb3ZlZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYWRkZWQ6IHNwbGljZS5hZGRlZENvdW50ID8gYXJyYXkuc2xpY2Uoc3BsaWNlLmluZGV4LCBzcGxpY2UuaW5kZXggKyBzcGxpY2UuYWRkZWRDb3VudCkgOiBbXSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogbW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUuU3BsaWNlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmaWVsZDogZmllbGQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9iajogbW9kZWxJbnN0YW5jZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBldmVudHM7XG59KSgpOyIsIihmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKSxcbiAgICAgICAgQ29sbGVjdGlvblJlZ2lzdHJ5ID0gcmVxdWlyZSgnLi9jb2xsZWN0aW9uUmVnaXN0cnknKS5Db2xsZWN0aW9uUmVnaXN0cnksXG4gICAgICAgIENvbGxlY3Rpb24gPSByZXF1aXJlKCcuL2NvbGxlY3Rpb24nKSxcbiAgICAgICAgY2FjaGUgPSByZXF1aXJlKCcuL2NhY2hlJyksXG4gICAgICAgIE1vZGVsID0gcmVxdWlyZSgnLi9tb2RlbCcpLFxuICAgICAgICBlcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKSxcbiAgICAgICAgZXZlbnRzID0gcmVxdWlyZSgnLi9ldmVudHMnKSxcbiAgICAgICAgUmVsYXRpb25zaGlwVHlwZSA9IHJlcXVpcmUoJy4vUmVsYXRpb25zaGlwVHlwZScpLFxuICAgICAgICBSZWFjdGl2ZVF1ZXJ5ID0gcmVxdWlyZSgnLi9SZWFjdGl2ZVF1ZXJ5JyksXG4gICAgICAgIE1hbnlUb01hbnlQcm94eSA9IHJlcXVpcmUoJy4vTWFueVRvTWFueVByb3h5JyksXG4gICAgICAgIE9uZVRvT25lUHJveHkgPSByZXF1aXJlKCcuL09uZVRvT25lUHJveHknKSxcbiAgICAgICAgT25lVG9NYW55UHJveHkgPSByZXF1aXJlKCcuL09uZVRvTWFueVByb3h5JyksXG4gICAgICAgIFJlbGF0aW9uc2hpcFByb3h5ID0gcmVxdWlyZSgnLi9SZWxhdGlvbnNoaXBQcm94eScpLFxuICAgICAgICBtb2RlbEV2ZW50cyA9IHJlcXVpcmUoJy4vbW9kZWxFdmVudHMnKSxcbiAgICAgICAgUXVlcnkgPSByZXF1aXJlKCcuL1F1ZXJ5JyksXG4gICAgICAgIHF1ZXJ5U2V0ID0gcmVxdWlyZSgnLi9RdWVyeVNldCcpLFxuICAgICAgICBsb2cgPSByZXF1aXJlKCcuL2xvZycpLFxuICAgICAgICBfID0gdXRpbC5fO1xuICAgIHV0aWwuX3BhdGNoQmluZCgpO1xuXG4gICAgLy8gSW5pdGlhbGlzZSBzaWVzdGEgb2JqZWN0LiBTdHJhbmdlIGZvcm1hdCBmYWNpbGl0aWVzIHVzaW5nIHN1Ym1vZHVsZXMgd2l0aCByZXF1aXJlSlMgKGV2ZW50dWFsbHkpXG4gICAgdmFyIHNpZXN0YSA9IGZ1bmN0aW9uIChleHQpIHtcbiAgICAgICAgaWYgKCFzaWVzdGEuZXh0KSBzaWVzdGEuZXh0ID0ge307XG4gICAgICAgIF8uZXh0ZW5kKHNpZXN0YS5leHQsIGV4dCB8fCB7fSk7XG4gICAgICAgIHJldHVybiBzaWVzdGE7XG4gICAgfTtcblxuICAgIC8vIE5vdGlmaWNhdGlvbnNcbiAgICBfLmV4dGVuZChzaWVzdGEsIHtcbiAgICAgICAgb246IGV2ZW50cy5vbi5iaW5kKGV2ZW50cyksXG4gICAgICAgIG9mZjogZXZlbnRzLnJlbW92ZUxpc3RlbmVyLmJpbmQoZXZlbnRzKSxcbiAgICAgICAgb25jZTogZXZlbnRzLm9uY2UuYmluZChldmVudHMpLFxuICAgICAgICByZW1vdmVBbGxMaXN0ZW5lcnM6IGV2ZW50cy5yZW1vdmVBbGxMaXN0ZW5lcnMuYmluZChldmVudHMpXG4gICAgfSk7XG4gICAgXy5leHRlbmQoc2llc3RhLCB7XG4gICAgICAgIHJlbW92ZUxpc3RlbmVyOiBzaWVzdGEub2ZmLFxuICAgICAgICBhZGRMaXN0ZW5lcjogc2llc3RhLm9uXG4gICAgfSk7XG5cbiAgICAvLyBFeHBvc2Ugc29tZSBzdHVmZiBmb3IgdXNhZ2UgYnkgZXh0ZW5zaW9ucyBhbmQvb3IgdXNlcnNcbiAgICBfLmV4dGVuZChzaWVzdGEsIHtcbiAgICAgICAgUmVsYXRpb25zaGlwVHlwZTogUmVsYXRpb25zaGlwVHlwZSxcbiAgICAgICAgTW9kZWxFdmVudFR5cGU6IG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlLFxuICAgICAgICBsb2c6IGxvZy5MZXZlbCxcbiAgICAgICAgSW5zZXJ0aW9uUG9saWN5OiBSZWFjdGl2ZVF1ZXJ5Lkluc2VydGlvblBvbGljeSxcbiAgICAgICAgX2ludGVybmFsOiB7XG4gICAgICAgICAgICBsb2c6IGxvZyxcbiAgICAgICAgICAgIE1vZGVsOiBNb2RlbCxcbiAgICAgICAgICAgIGVycm9yOiBlcnJvcixcbiAgICAgICAgICAgIE1vZGVsRXZlbnRUeXBlOiBtb2RlbEV2ZW50cy5Nb2RlbEV2ZW50VHlwZSxcbiAgICAgICAgICAgIE1vZGVsSW5zdGFuY2U6IHJlcXVpcmUoJy4vTW9kZWxJbnN0YW5jZScpLFxuICAgICAgICAgICAgZXh0ZW5kOiByZXF1aXJlKCdleHRlbmQnKSxcbiAgICAgICAgICAgIE1hcHBpbmdPcGVyYXRpb246IHJlcXVpcmUoJy4vbWFwcGluZ09wZXJhdGlvbicpLFxuICAgICAgICAgICAgZXZlbnRzOiBldmVudHMsXG4gICAgICAgICAgICBQcm94eUV2ZW50RW1pdHRlcjogZXZlbnRzLlByb3h5RXZlbnRFbWl0dGVyLFxuICAgICAgICAgICAgY2FjaGU6IHJlcXVpcmUoJy4vY2FjaGUnKSxcbiAgICAgICAgICAgIG1vZGVsRXZlbnRzOiBtb2RlbEV2ZW50cyxcbiAgICAgICAgICAgIENvbGxlY3Rpb25SZWdpc3RyeTogcmVxdWlyZSgnLi9jb2xsZWN0aW9uUmVnaXN0cnknKS5Db2xsZWN0aW9uUmVnaXN0cnksXG4gICAgICAgICAgICBDb2xsZWN0aW9uOiBDb2xsZWN0aW9uLFxuICAgICAgICAgICAgdXRpbHM6IHV0aWwsXG4gICAgICAgICAgICB1dGlsOiB1dGlsLFxuICAgICAgICAgICAgXzogdXRpbC5fLFxuICAgICAgICAgICAgcXVlcnlTZXQ6IHF1ZXJ5U2V0LFxuICAgICAgICAgICAgb2JzZXJ2ZTogcmVxdWlyZSgnLi4vdmVuZG9yL29ic2VydmUtanMvc3JjL29ic2VydmUnKSxcbiAgICAgICAgICAgIFF1ZXJ5OiBRdWVyeSxcbiAgICAgICAgICAgIFN0b3JlOiByZXF1aXJlKCcuL3N0b3JlJyksXG4gICAgICAgICAgICBNYW55VG9NYW55UHJveHk6IE1hbnlUb01hbnlQcm94eSxcbiAgICAgICAgICAgIE9uZVRvTWFueVByb3h5OiBPbmVUb01hbnlQcm94eSxcbiAgICAgICAgICAgIE9uZVRvT25lUHJveHk6IE9uZVRvT25lUHJveHksXG4gICAgICAgICAgICBSZWxhdGlvbnNoaXBQcm94eTogUmVsYXRpb25zaGlwUHJveHlcbiAgICAgICAgfSxcbiAgICAgICAgXzogdXRpbC5fLFxuICAgICAgICBhc3luYzogdXRpbC5hc3luYyxcbiAgICAgICAgaXNBcnJheTogdXRpbC5pc0FycmF5LFxuICAgICAgICBpc1N0cmluZzogdXRpbC5pc1N0cmluZ1xuICAgIH0pO1xuXG4gICAgc2llc3RhLmV4dCA9IHt9O1xuXG4gICAgdmFyIGluc3RhbGxlZCA9IGZhbHNlLFxuICAgICAgICBpbnN0YWxsaW5nID0gZmFsc2U7XG5cblxuICAgIF8uZXh0ZW5kKHNpZXN0YSwge1xuICAgICAgICAvKipcbiAgICAgICAgICogV2lwZSBldmVyeXRoaW5nLiBVc2VkIGR1cmluZyB0ZXN0IGdlbmVyYWxseS5cbiAgICAgICAgICovXG4gICAgICAgIHJlc2V0OiBmdW5jdGlvbiAoY2IpIHtcbiAgICAgICAgICAgIGluc3RhbGxlZCA9IGZhbHNlO1xuICAgICAgICAgICAgaW5zdGFsbGluZyA9IGZhbHNlO1xuICAgICAgICAgICAgZGVsZXRlIHRoaXMucXVldWVkVGFza3M7XG4gICAgICAgICAgICBjYWNoZS5yZXNldCgpO1xuICAgICAgICAgICAgQ29sbGVjdGlvblJlZ2lzdHJ5LnJlc2V0KCk7XG4gICAgICAgICAgICBldmVudHMucmVtb3ZlQWxsTGlzdGVuZXJzKCk7XG4gICAgICAgICAgICBpZiAoc2llc3RhLmV4dC5zdG9yYWdlRW5hYmxlZCkge1xuICAgICAgICAgICAgICAgIHNpZXN0YS5leHQuc3RvcmFnZS5fcmVzZXQoY2IpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgY2IoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgLyoqXG4gICAgICAgICAqIENyZWF0ZXMgYW5kIHJlZ2lzdGVycyBhIG5ldyBDb2xsZWN0aW9uLlxuICAgICAgICAgKiBAcGFyYW0gIHtTdHJpbmd9IG5hbWVcbiAgICAgICAgICogQHBhcmFtICB7T2JqZWN0fSBbb3B0c11cbiAgICAgICAgICogQHJldHVybiB7Q29sbGVjdGlvbn1cbiAgICAgICAgICovXG4gICAgICAgIGNvbGxlY3Rpb246IGZ1bmN0aW9uIChuYW1lLCBvcHRzKSB7XG4gICAgICAgICAgICByZXR1cm4gbmV3IENvbGxlY3Rpb24obmFtZSwgb3B0cyk7XG4gICAgICAgIH0sXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBJbnN0YWxsIGFsbCBjb2xsZWN0aW9ucy5cbiAgICAgICAgICogQHBhcmFtIHtGdW5jdGlvbn0gW2NiXVxuICAgICAgICAgKiBAcmV0dXJucyB7cS5Qcm9taXNlfVxuICAgICAgICAgKi9cbiAgICAgICAgaW5zdGFsbDogZnVuY3Rpb24gKGNiKSB7XG4gICAgICAgICAgICBpZiAoIWluc3RhbGxpbmcgJiYgIWluc3RhbGxlZCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uIChjYikge1xuICAgICAgICAgICAgICAgICAgICBpbnN0YWxsaW5nID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGNvbGxlY3Rpb25OYW1lcyA9IENvbGxlY3Rpb25SZWdpc3RyeS5jb2xsZWN0aW9uTmFtZXMsXG4gICAgICAgICAgICAgICAgICAgICAgICB0YXNrcyA9IF8ubWFwKGNvbGxlY3Rpb25OYW1lcywgZnVuY3Rpb24gKG4pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gQ29sbGVjdGlvblJlZ2lzdHJ5W25dLmluc3RhbGwuYmluZChDb2xsZWN0aW9uUmVnaXN0cnlbbl0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSksXG4gICAgICAgICAgICAgICAgICAgICAgICBzdG9yYWdlRW5hYmxlZCA9IHNpZXN0YS5leHQuc3RvcmFnZUVuYWJsZWQ7XG4gICAgICAgICAgICAgICAgICAgIGlmIChzdG9yYWdlRW5hYmxlZCkgdGFza3MgPSB0YXNrcy5jb25jYXQoW3NpZXN0YS5leHQuc3RvcmFnZS5lbnN1cmVJbmRleGVzRm9yQWxsLCBzaWVzdGEuZXh0LnN0b3JhZ2UuX2xvYWRdKTtcbiAgICAgICAgICAgICAgICAgICAgdGFza3MucHVzaChmdW5jdGlvbiAoZG9uZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaW5zdGFsbGVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLnF1ZXVlZFRhc2tzKSB0aGlzLnF1ZXVlZFRhc2tzLmV4ZWN1dGUoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRvbmUoKTtcbiAgICAgICAgICAgICAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgICAgICAgICAgICAgICAgc2llc3RhLmFzeW5jLnNlcmllcyh0YXNrcywgY2IpO1xuICAgICAgICAgICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGNiKGVycm9yKCdhbHJlYWR5IGluc3RhbGxpbmcnKSk7XG4gICAgICAgIH0sXG4gICAgICAgIF9wdXNoVGFzazogZnVuY3Rpb24gKHRhc2spIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5xdWV1ZWRUYXNrcykge1xuICAgICAgICAgICAgICAgIHRoaXMucXVldWVkVGFza3MgPSBuZXcgZnVuY3Rpb24gUXVldWUoKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMudGFza3MgPSBbXTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5leGVjdXRlID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy50YXNrcy5mb3JFYWNoKGZ1bmN0aW9uIChmKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZigpXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMudGFza3MgPSBbXTtcbiAgICAgICAgICAgICAgICAgICAgfS5iaW5kKHRoaXMpO1xuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLnF1ZXVlZFRhc2tzLnRhc2tzLnB1c2godGFzayk7XG4gICAgICAgIH0sXG4gICAgICAgIF9hZnRlckluc3RhbGw6IGZ1bmN0aW9uICh0YXNrKSB7XG4gICAgICAgICAgICBpZiAoIWluc3RhbGxlZCkge1xuICAgICAgICAgICAgICAgIGlmICghaW5zdGFsbGluZykge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmluc3RhbGwoZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVycikgY29uc29sZS5lcnJvcignRXJyb3Igc2V0dGluZyB1cCBzaWVzdGEnLCBlcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZGVsZXRlIHRoaXMucXVldWVkVGFza3M7XG4gICAgICAgICAgICAgICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIC8vIEluIGNhc2UgaW5zdGFsbGVkIHN0cmFpZ2h0IGF3YXkgZS5nLiBpZiBzdG9yYWdlIGV4dGVuc2lvbiBub3QgaW5zdGFsbGVkLlxuICAgICAgICAgICAgICAgIGlmICghaW5zdGFsbGVkKSB0aGlzLl9wdXNoVGFzayh0YXNrKTtcbiAgICAgICAgICAgICAgICBlbHNlIHRhc2soKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHRhc2soKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgc2V0TG9nTGV2ZWw6IGZ1bmN0aW9uIChsb2dnZXJOYW1lLCBsZXZlbCkge1xuICAgICAgICAgICAgdmFyIExvZ2dlciA9IGxvZy5sb2dnZXJXaXRoTmFtZShsb2dnZXJOYW1lKTtcbiAgICAgICAgICAgIExvZ2dlci5zZXRMZXZlbChsZXZlbCk7XG4gICAgICAgIH0sXG4gICAgICAgIG5vdGlmeTogdXRpbC5uZXh0LFxuICAgICAgICByZWdpc3RlckNvbXBhcmF0b3I6IFF1ZXJ5LnJlZ2lzdGVyQ29tcGFyYXRvci5iaW5kKFF1ZXJ5KVxuICAgIH0pO1xuXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnRpZXMoc2llc3RhLCB7XG4gICAgICAgIF9jYW5DaGFuZ2U6IHtcbiAgICAgICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiAhKGluc3RhbGxpbmcgfHwgaW5zdGFsbGVkKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgaWYgKHR5cGVvZiB3aW5kb3cgIT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgd2luZG93WydzaWVzdGEnXSA9IHNpZXN0YTtcbiAgICB9XG5cbiAgICBzaWVzdGEubG9nID0gcmVxdWlyZSgnZGVidWcnKTtcblxuICAgIG1vZHVsZS5leHBvcnRzID0gc2llc3RhO1xuXG5cblxuICAgIChmdW5jdGlvbiBsb2FkRXh0ZW5zaW9ucygpIHtcbiAgICAgICAgcmVxdWlyZSgnLi4vc3RvcmFnZScpO1xuICAgIH0pKCk7XG5cbn0pKCk7IiwiKGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgbG9nID0gcmVxdWlyZSgnLi9sb2cnKSgnbW9kZWwnKSxcbiAgICAgICAgSW50ZXJuYWxTaWVzdGFFcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKS5JbnRlcm5hbFNpZXN0YUVycm9yLFxuICAgICAgICBSZWxhdGlvbnNoaXBUeXBlID0gcmVxdWlyZSgnLi9SZWxhdGlvbnNoaXBUeXBlJyksXG4gICAgICAgIFF1ZXJ5ID0gcmVxdWlyZSgnLi9RdWVyeScpLFxuICAgICAgICBNb2RlbEluc3RhbmNlID0gcmVxdWlyZSgnLi9Nb2RlbEluc3RhbmNlJyksXG4gICAgICAgIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKSxcbiAgICAgICAgXyA9IHV0aWwuXyxcbiAgICAgICAgZ3VpZCA9IHV0aWwuZ3VpZCxcbiAgICAgICAgY2FjaGUgPSByZXF1aXJlKCcuL2NhY2hlJyksXG4gICAgICAgIHN0b3JlID0gcmVxdWlyZSgnLi9zdG9yZScpLFxuICAgICAgICBleHRlbmQgPSByZXF1aXJlKCdleHRlbmQnKSxcbiAgICAgICAgbW9kZWxFdmVudHMgPSByZXF1aXJlKCcuL21vZGVsRXZlbnRzJyksXG4gICAgICAgIHdyYXBBcnJheSA9IHJlcXVpcmUoJy4vZXZlbnRzJykud3JhcEFycmF5LFxuICAgICAgICBPbmVUb01hbnlQcm94eSA9IHJlcXVpcmUoJy4vT25lVG9NYW55UHJveHknKSxcbiAgICAgICAgT25lVG9PbmVQcm94eSA9IHJlcXVpcmUoJy4vT25lVG9PbmVQcm94eScpLFxuICAgICAgICBNYW55VG9NYW55UHJveHkgPSByZXF1aXJlKCcuL01hbnlUb01hbnlQcm94eScpLFxuICAgICAgICBSZWFjdGl2ZVF1ZXJ5ID0gcmVxdWlyZSgnLi9SZWFjdGl2ZVF1ZXJ5JyksXG4gICAgICAgIEFycmFuZ2VkUmVhY3RpdmVRdWVyeSA9IHJlcXVpcmUoJy4vQXJyYW5nZWRSZWFjdGl2ZVF1ZXJ5JyksXG4gICAgICAgIE1vZGVsRXZlbnRUeXBlID0gbW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGU7XG5cbiAgICBmdW5jdGlvbiBNb2RlbEluc3RhbmNlRmFjdG9yeShtb2RlbCkge1xuICAgICAgICB0aGlzLm1vZGVsID0gbW9kZWw7XG4gICAgfVxuXG4gICAgTW9kZWxJbnN0YW5jZUZhY3RvcnkucHJvdG90eXBlID0ge1xuICAgICAgICBfZ2V0TG9jYWxJZDogZnVuY3Rpb24gKGRhdGEpIHtcbiAgICAgICAgICAgIHZhciBfaWQ7XG4gICAgICAgICAgICBpZiAoZGF0YSkge1xuICAgICAgICAgICAgICAgIF9pZCA9IGRhdGEuX2lkID8gZGF0YS5faWQgOiBndWlkKCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIF9pZCA9IGd1aWQoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBfaWQ7XG4gICAgICAgIH0sXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBDb25maWd1cmUgYXR0cmlidXRlc1xuICAgICAgICAgKiBAcGFyYW0gbW9kZWxJbnN0YW5jZVxuICAgICAgICAgKiBAcGFyYW0gZGF0YVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cblxuICAgICAgICBfaW5zdGFsbEF0dHJpYnV0ZXM6IGZ1bmN0aW9uIChtb2RlbEluc3RhbmNlLCBkYXRhKSB7XG4gICAgICAgICAgICB2YXIgTW9kZWwgPSB0aGlzLm1vZGVsLFxuICAgICAgICAgICAgICAgIGF0dHJpYnV0ZU5hbWVzID0gTW9kZWwuX2F0dHJpYnV0ZU5hbWVzLFxuICAgICAgICAgICAgICAgIGlkeCA9IGF0dHJpYnV0ZU5hbWVzLmluZGV4T2YoTW9kZWwuaWQpO1xuICAgICAgICAgICAgXy5leHRlbmQobW9kZWxJbnN0YW5jZSwge1xuICAgICAgICAgICAgICAgIF9fdmFsdWVzOiBfLmV4dGVuZChfLnJlZHVjZShNb2RlbC5hdHRyaWJ1dGVzLCBmdW5jdGlvbiAobSwgYSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoYS5kZWZhdWx0ICE9PSB1bmRlZmluZWQpIG1bYS5uYW1lXSA9IGEuZGVmYXVsdDtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG07XG4gICAgICAgICAgICAgICAgfSwge30pLCBkYXRhIHx8IHt9KVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBpZiAoaWR4ID4gLTEpIGF0dHJpYnV0ZU5hbWVzLnNwbGljZShpZHgsIDEpO1xuICAgICAgICAgICAgXy5lYWNoKGF0dHJpYnV0ZU5hbWVzLCBmdW5jdGlvbiAoYXR0cmlidXRlTmFtZSkge1xuICAgICAgICAgICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShtb2RlbEluc3RhbmNlLCBhdHRyaWJ1dGVOYW1lLCB7XG4gICAgICAgICAgICAgICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHZhbHVlID0gbW9kZWxJbnN0YW5jZS5fX3ZhbHVlc1thdHRyaWJ1dGVOYW1lXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB2YWx1ZSA9PT0gdW5kZWZpbmVkID8gbnVsbCA6IHZhbHVlO1xuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICBzZXQ6IGZ1bmN0aW9uICh2KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgb2xkID0gbW9kZWxJbnN0YW5jZS5fX3ZhbHVlc1thdHRyaWJ1dGVOYW1lXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBwcm9wZXJ0eURlcGVuZGVuY2llcyA9IHRoaXMuX3Byb3BlcnR5RGVwZW5kZW5jaWVzW2F0dHJpYnV0ZU5hbWVdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByb3BlcnR5RGVwZW5kZW5jaWVzID0gXy5tYXAocHJvcGVydHlEZXBlbmRlbmNpZXMsIGZ1bmN0aW9uIChkZXBlbmRhbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByb3A6IGRlcGVuZGFudCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9sZDogdGhpc1tkZXBlbmRhbnRdXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LmJpbmQodGhpcykpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBtb2RlbEluc3RhbmNlLl9fdmFsdWVzW2F0dHJpYnV0ZU5hbWVdID0gdjtcbiAgICAgICAgICAgICAgICAgICAgICAgIHByb3BlcnR5RGVwZW5kZW5jaWVzLmZvckVhY2goZnVuY3Rpb24gKGRlcCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBwcm9wZXJ0eU5hbWUgPSBkZXAucHJvcDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgbmV3XyA9IHRoaXNbcHJvcGVydHlOYW1lXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtb2RlbEV2ZW50cy5lbWl0KHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29sbGVjdGlvbjogTW9kZWwuY29sbGVjdGlvbk5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1vZGVsOiBNb2RlbC5uYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBfaWQ6IG1vZGVsSW5zdGFuY2UuX2lkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBuZXc6IG5ld18sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9sZDogZGVwLm9sZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogTW9kZWxFdmVudFR5cGUuU2V0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmaWVsZDogcHJvcGVydHlOYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvYmo6IG1vZGVsSW5zdGFuY2VcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgZSA9IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb2xsZWN0aW9uOiBNb2RlbC5jb2xsZWN0aW9uTmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtb2RlbDogTW9kZWwubmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBfaWQ6IG1vZGVsSW5zdGFuY2UuX2lkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5ldzogdixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbGQ6IG9sZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiBNb2RlbEV2ZW50VHlwZS5TZXQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZmllbGQ6IGF0dHJpYnV0ZU5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb2JqOiBtb2RlbEluc3RhbmNlXG4gICAgICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgICAgICAgd2luZG93Lmxhc3RFbWlzc2lvbiA9IGU7XG4gICAgICAgICAgICAgICAgICAgICAgICBtb2RlbEV2ZW50cy5lbWl0KGUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHV0aWwuaXNBcnJheSh2KSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHdyYXBBcnJheSh2LCBhdHRyaWJ1dGVOYW1lLCBtb2RlbEluc3RhbmNlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSxcbiAgICAgICAgX2luc3RhbGxNZXRob2RzOiBmdW5jdGlvbiAobW9kZWxJbnN0YW5jZSkge1xuICAgICAgICAgICAgdmFyIE1vZGVsID0gdGhpcy5tb2RlbDtcbiAgICAgICAgICAgIF8uZWFjaChPYmplY3Qua2V5cyhNb2RlbC5tZXRob2RzKSwgZnVuY3Rpb24gKG1ldGhvZE5hbWUpIHtcbiAgICAgICAgICAgICAgICBpZiAobW9kZWxJbnN0YW5jZVttZXRob2ROYW1lXSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgIG1vZGVsSW5zdGFuY2VbbWV0aG9kTmFtZV0gPSBNb2RlbC5tZXRob2RzW21ldGhvZE5hbWVdLmJpbmQobW9kZWxJbnN0YW5jZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBsb2coJ0EgbWV0aG9kIHdpdGggbmFtZSBcIicgKyBtZXRob2ROYW1lICsgJ1wiIGFscmVhZHkgZXhpc3RzLiBJZ25vcmluZyBpdC4nKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICB9LFxuICAgICAgICBfaW5zdGFsbFByb3BlcnRpZXM6IGZ1bmN0aW9uIChtb2RlbEluc3RhbmNlKSB7XG4gICAgICAgICAgICB2YXIgX3Byb3BlcnR5TmFtZXMgPSBPYmplY3Qua2V5cyh0aGlzLm1vZGVsLnByb3BlcnRpZXMpLFxuICAgICAgICAgICAgICAgIF9wcm9wZXJ0eURlcGVuZGVuY2llcyA9IHt9O1xuICAgICAgICAgICAgXy5lYWNoKF9wcm9wZXJ0eU5hbWVzLCBmdW5jdGlvbiAocHJvcE5hbWUpIHtcbiAgICAgICAgICAgICAgICB2YXIgcHJvcERlZiA9IHRoaXMubW9kZWwucHJvcGVydGllc1twcm9wTmFtZV07XG4gICAgICAgICAgICAgICAgdmFyIGRlcGVuZGVuY2llcyA9IHByb3BEZWYuZGVwZW5kZW5jaWVzIHx8IFtdO1xuICAgICAgICAgICAgICAgIGRlcGVuZGVuY2llcy5mb3JFYWNoKGZ1bmN0aW9uIChhdHRyKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghX3Byb3BlcnR5RGVwZW5kZW5jaWVzW2F0dHJdKSBfcHJvcGVydHlEZXBlbmRlbmNpZXNbYXR0cl0gPSBbXTtcbiAgICAgICAgICAgICAgICAgICAgX3Byb3BlcnR5RGVwZW5kZW5jaWVzW2F0dHJdLnB1c2gocHJvcE5hbWUpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGRlbGV0ZSBwcm9wRGVmLmRlcGVuZGVuY2llcztcbiAgICAgICAgICAgICAgICBpZiAobW9kZWxJbnN0YW5jZVtwcm9wTmFtZV0gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkobW9kZWxJbnN0YW5jZSwgcHJvcE5hbWUsIHByb3BEZWYpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nKCdBIHByb3BlcnR5L21ldGhvZCB3aXRoIG5hbWUgXCInICsgcHJvcE5hbWUgKyAnXCIgYWxyZWFkeSBleGlzdHMuIElnbm9yaW5nIGl0LicpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0uYmluZCh0aGlzKSk7XG5cbiAgICAgICAgICAgIG1vZGVsSW5zdGFuY2UuX3Byb3BlcnR5RGVwZW5kZW5jaWVzID0gX3Byb3BlcnR5RGVwZW5kZW5jaWVzO1xuICAgICAgICB9LFxuICAgICAgICBfaW5zdGFsbFJlbW90ZUlkOiBmdW5jdGlvbiAobW9kZWxJbnN0YW5jZSkge1xuICAgICAgICAgICAgdmFyIE1vZGVsID0gdGhpcy5tb2RlbDtcbiAgICAgICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShtb2RlbEluc3RhbmNlLCB0aGlzLm1vZGVsLmlkLCB7XG4gICAgICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBtb2RlbEluc3RhbmNlLl9fdmFsdWVzW01vZGVsLmlkXSB8fCBudWxsO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgc2V0OiBmdW5jdGlvbiAodikge1xuICAgICAgICAgICAgICAgICAgICB2YXIgb2xkID0gbW9kZWxJbnN0YW5jZVtNb2RlbC5pZF07XG4gICAgICAgICAgICAgICAgICAgIG1vZGVsSW5zdGFuY2UuX192YWx1ZXNbTW9kZWwuaWRdID0gdjtcbiAgICAgICAgICAgICAgICAgICAgbW9kZWxFdmVudHMuZW1pdCh7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb2xsZWN0aW9uOiBNb2RlbC5jb2xsZWN0aW9uTmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1vZGVsOiBNb2RlbC5uYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgX2lkOiBtb2RlbEluc3RhbmNlLl9pZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIG5ldzogdixcbiAgICAgICAgICAgICAgICAgICAgICAgIG9sZDogb2xkLFxuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogTW9kZWxFdmVudFR5cGUuU2V0LFxuICAgICAgICAgICAgICAgICAgICAgICAgZmllbGQ6IE1vZGVsLmlkLFxuICAgICAgICAgICAgICAgICAgICAgICAgb2JqOiBtb2RlbEluc3RhbmNlXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICBjYWNoZS5yZW1vdGVJbnNlcnQobW9kZWxJbnN0YW5jZSwgdiwgb2xkKTtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgICAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSxcbiAgICAgICAgX2luc3RhbGxSZWxhdGlvbnNoaXBzOiBmdW5jdGlvbiAobW9kZWxJbnN0YW5jZSkge1xuICAgICAgICAgICAgdmFyIG1vZGVsID0gdGhpcy5tb2RlbDtcbiAgICAgICAgICAgIGZvciAodmFyIG5hbWUgaW4gbW9kZWwucmVsYXRpb25zaGlwcykge1xuICAgICAgICAgICAgICAgIHZhciBwcm94eTtcbiAgICAgICAgICAgICAgICBpZiAobW9kZWwucmVsYXRpb25zaGlwcy5oYXNPd25Qcm9wZXJ0eShuYW1lKSkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgcmVsYXRpb25zaGlwT3B0cyA9IF8uZXh0ZW5kKHt9LCBtb2RlbC5yZWxhdGlvbnNoaXBzW25hbWVdKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGUgPSByZWxhdGlvbnNoaXBPcHRzLnR5cGU7XG4gICAgICAgICAgICAgICAgICAgIGRlbGV0ZSByZWxhdGlvbnNoaXBPcHRzLnR5cGU7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0eXBlID09IFJlbGF0aW9uc2hpcFR5cGUuT25lVG9NYW55KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwcm94eSA9IG5ldyBPbmVUb01hbnlQcm94eShyZWxhdGlvbnNoaXBPcHRzKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmICh0eXBlID09IFJlbGF0aW9uc2hpcFR5cGUuT25lVG9PbmUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHByb3h5ID0gbmV3IE9uZVRvT25lUHJveHkocmVsYXRpb25zaGlwT3B0cyk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAodHlwZSA9PSBSZWxhdGlvbnNoaXBUeXBlLk1hbnlUb01hbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHByb3h5ID0gbmV3IE1hbnlUb01hbnlQcm94eShyZWxhdGlvbnNoaXBPcHRzKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdObyBzdWNoIHJlbGF0aW9uc2hpcCB0eXBlOiAnICsgdHlwZSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcHJveHkuaW5zdGFsbChtb2RlbEluc3RhbmNlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgX3JlZ2lzdGVySW5zdGFuY2U6IGZ1bmN0aW9uIChtb2RlbEluc3RhbmNlLCBzaG91bGRSZWdpc3RlckNoYW5nZSkge1xuICAgICAgICAgICAgY2FjaGUuaW5zZXJ0KG1vZGVsSW5zdGFuY2UpO1xuICAgICAgICAgICAgc2hvdWxkUmVnaXN0ZXJDaGFuZ2UgPSBzaG91bGRSZWdpc3RlckNoYW5nZSA9PT0gdW5kZWZpbmVkID8gdHJ1ZSA6IHNob3VsZFJlZ2lzdGVyQ2hhbmdlO1xuICAgICAgICAgICAgaWYgKHNob3VsZFJlZ2lzdGVyQ2hhbmdlKSB7XG4gICAgICAgICAgICAgICAgbW9kZWxFdmVudHMuZW1pdCh7XG4gICAgICAgICAgICAgICAgICAgIGNvbGxlY3Rpb246IHRoaXMubW9kZWwuY29sbGVjdGlvbk5hbWUsXG4gICAgICAgICAgICAgICAgICAgIG1vZGVsOiB0aGlzLm1vZGVsLm5hbWUsXG4gICAgICAgICAgICAgICAgICAgIF9pZDogbW9kZWxJbnN0YW5jZS5faWQsXG4gICAgICAgICAgICAgICAgICAgIG5ldzogbW9kZWxJbnN0YW5jZSxcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogTW9kZWxFdmVudFR5cGUuTmV3LFxuICAgICAgICAgICAgICAgICAgICBvYmo6IG1vZGVsSW5zdGFuY2VcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgX2luc3RhbGxMb2NhbElkOiBmdW5jdGlvbiAobW9kZWxJbnN0YW5jZSwgZGF0YSkge1xuICAgICAgICAgICAgbW9kZWxJbnN0YW5jZS5faWQgPSB0aGlzLl9nZXRMb2NhbElkKGRhdGEpO1xuICAgICAgICB9LFxuICAgICAgICAvKipcbiAgICAgICAgICogQ29udmVydCByYXcgZGF0YSBpbnRvIGEgTW9kZWxJbnN0YW5jZVxuICAgICAgICAgKiBAcmV0dXJucyB7TW9kZWxJbnN0YW5jZX1cbiAgICAgICAgICovXG4gICAgICAgIF9pbnN0YW5jZTogZnVuY3Rpb24gKGRhdGEsIHNob3VsZFJlZ2lzdGVyQ2hhbmdlKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5tb2RlbC5pbnN0YWxsZWQpIHtcbiAgICAgICAgICAgICAgICB2YXIgbW9kZWxJbnN0YW5jZSA9IG5ldyBNb2RlbEluc3RhbmNlKHRoaXMubW9kZWwpO1xuICAgICAgICAgICAgICAgIHRoaXMuX2luc3RhbGxMb2NhbElkKG1vZGVsSW5zdGFuY2UsIGRhdGEpO1xuICAgICAgICAgICAgICAgIHRoaXMuX2luc3RhbGxBdHRyaWJ1dGVzKG1vZGVsSW5zdGFuY2UsIGRhdGEpO1xuICAgICAgICAgICAgICAgIHRoaXMuX2luc3RhbGxNZXRob2RzKG1vZGVsSW5zdGFuY2UpO1xuICAgICAgICAgICAgICAgIHRoaXMuX2luc3RhbGxQcm9wZXJ0aWVzKG1vZGVsSW5zdGFuY2UpO1xuICAgICAgICAgICAgICAgIHRoaXMuX2luc3RhbGxSZW1vdGVJZChtb2RlbEluc3RhbmNlKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9pbnN0YWxsUmVsYXRpb25zaGlwcyhtb2RlbEluc3RhbmNlKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9yZWdpc3Rlckluc3RhbmNlKG1vZGVsSW5zdGFuY2UsIHNob3VsZFJlZ2lzdGVyQ2hhbmdlKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gbW9kZWxJbnN0YW5jZTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ01vZGVsIG11c3QgYmUgZnVsbHkgaW5zdGFsbGVkIGJlZm9yZSBjcmVhdGluZyBhbnkgbW9kZWxzJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAobW9kZWwpIHtcbiAgICAgICAgdmFyIGZhY3RvcnkgPSBuZXcgTW9kZWxJbnN0YW5jZUZhY3RvcnkobW9kZWwpO1xuICAgICAgICByZXR1cm4gZmFjdG9yeS5faW5zdGFuY2UuYmluZChmYWN0b3J5KTtcbiAgICB9XG59KSgpOyIsIihmdW5jdGlvbiAoKSB7XG4gICAgLyoqXG4gICAgICogRGVhZCBzaW1wbGUgbG9nZ2luZyBzZXJ2aWNlIGJhc2VkIG9uIHZpc2lvbm1lZGlhL2RlYnVnXG4gICAgICogQG1vZHVsZSBsb2dcbiAgICAgKi9cblxuICAgIHZhciBkZWJ1ZyA9IHJlcXVpcmUoJ2RlYnVnJyksXG4gICAgICAgIGFyZ3NhcnJheSA9IHJlcXVpcmUoJ2FyZ3NhcnJheScpO1xuXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAobmFtZSkge1xuICAgICAgICB2YXIgbG9nID0gZGVidWcoJ3NpZXN0YTonICsgbmFtZSk7XG4gICAgICAgIHZhciBmbiA9IGFyZ3NhcnJheShmdW5jdGlvbiAoYXJncykge1xuICAgICAgICAgICAgbG9nLmNhbGwobG9nLCBhcmdzKTtcbiAgICAgICAgfSk7XG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShmbiwgJ2VuYWJsZWQnLCB7XG4gICAgICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZGVidWcuZW5hYmxlZChuYW1lKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBmbjtcbiAgICB9O1xufSkoKTsiLCIoZnVuY3Rpb24gKCkge1xuICAgIHZhciBTdG9yZSA9IHJlcXVpcmUoJy4vc3RvcmUnKSxcbiAgICAgICAgU2llc3RhTW9kZWwgPSByZXF1aXJlKCcuL01vZGVsSW5zdGFuY2UnKSxcbiAgICAgICAgbG9nID0gcmVxdWlyZSgnLi9sb2cnKSgnbWFwcGluZycpLFxuICAgICAgICBjYWNoZSA9IHJlcXVpcmUoJy4vY2FjaGUnKSxcbiAgICAgICAgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpLFxuICAgICAgICBfID0gdXRpbC5fLFxuICAgICAgICBhc3luYyA9IHV0aWwuYXN5bmM7XG5cbiAgICBmdW5jdGlvbiBTaWVzdGFFcnJvcihvcHRzKSB7XG4gICAgICAgIHRoaXMub3B0cyA9IG9wdHM7XG4gICAgfVxuICAgIFNpZXN0YUVycm9yLnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHRoaXMub3B0cywgbnVsbCwgNCk7XG4gICAgfTtcblxuXG4gICAgLyoqXG4gICAgICogRW5jYXBzdWxhdGVzIHRoZSBpZGVhIG9mIG1hcHBpbmcgYXJyYXlzIG9mIGRhdGEgb250byB0aGUgb2JqZWN0IGdyYXBoIG9yIGFycmF5cyBvZiBvYmplY3RzLlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBvcHRzXG4gICAgICogQHBhcmFtIG9wdHMubW9kZWxcbiAgICAgKiBAcGFyYW0gb3B0cy5kYXRhI1xuICAgICAqIEBwYXJhbSBvcHRzLm9iamVjdHNcbiAgICAgKiBAcGFyYW0gb3B0cy5kaXNhYmxlTm90aWZpY2F0aW9uc1xuICAgICAqL1xuICAgIGZ1bmN0aW9uIE1hcHBpbmdPcGVyYXRpb24ob3B0cykge1xuICAgICAgICB0aGlzLl9vcHRzID0gb3B0cztcblxuICAgICAgICB1dGlsLmV4dGVuZEZyb21PcHRzKHRoaXMsIG9wdHMsIHtcbiAgICAgICAgICAgIG1vZGVsOiBudWxsLFxuICAgICAgICAgICAgZGF0YTogbnVsbCxcbiAgICAgICAgICAgIG9iamVjdHM6IFtdLFxuICAgICAgICAgICAgZGlzYWJsZWV2ZW50czogZmFsc2UsXG4gICAgICAgICAgICBfaWdub3JlSW5zdGFsbGVkOiBmYWxzZSxcbiAgICAgICAgICAgIGZyb21TdG9yYWdlOiBmYWxzZVxuICAgICAgICB9KTtcblxuICAgICAgICBfLmV4dGVuZCh0aGlzLCB7XG4gICAgICAgICAgICBlcnJvcnM6IFtdLFxuICAgICAgICAgICAgc3ViVGFza1Jlc3VsdHM6IHt9LFxuICAgICAgICAgICAgX25ld09iamVjdHM6IFtdXG4gICAgICAgIH0pO1xuICAgIH1cblxuXG4gICAgXy5leHRlbmQoTWFwcGluZ09wZXJhdGlvbi5wcm90b3R5cGUsIHtcbiAgICAgICAgbWFwQXR0cmlidXRlczogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLmRhdGEubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICB2YXIgZGF0dW0gPSB0aGlzLmRhdGFbaV07XG4gICAgICAgICAgICAgICAgdmFyIG9iamVjdCA9IHRoaXMub2JqZWN0c1tpXTtcbiAgICAgICAgICAgICAgICAvLyBObyBwb2ludCBtYXBwaW5nIG9iamVjdCBvbnRvIGl0c2VsZi4gVGhpcyBoYXBwZW5zIGlmIGEgTW9kZWxJbnN0YW5jZSBpcyBwYXNzZWQgYXMgYSByZWxhdGlvbnNoaXAuXG4gICAgICAgICAgICAgICAgaWYgKGRhdHVtICE9IG9iamVjdCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAob2JqZWN0KSB7IC8vIElmIG9iamVjdCBpcyBmYWxzeSwgdGhlbiB0aGVyZSB3YXMgYW4gZXJyb3IgbG9va2luZyB1cCB0aGF0IG9iamVjdC9jcmVhdGluZyBpdC5cbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBmaWVsZHMgPSB0aGlzLm1vZGVsLl9hdHRyaWJ1dGVOYW1lcztcbiAgICAgICAgICAgICAgICAgICAgICAgIF8uZWFjaChmaWVsZHMsIGZ1bmN0aW9uIChmKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGRhdHVtW2ZdICE9PSB1bmRlZmluZWQpIHsgLy8gbnVsbCBpcyBmaW5lXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIElmIGV2ZW50cyBhcmUgZGlzYWJsZWQgd2UgdXBkYXRlIF9fdmFsdWVzIG9iamVjdCBkaXJlY3RseS4gVGhpcyBhdm9pZHMgdHJpZ2dlcmluZ1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBldmVudHMgd2hpY2ggYXJlIGJ1aWx0IGludG8gdGhlIHNldCBmdW5jdGlvbiBvZiB0aGUgcHJvcGVydHkuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLmRpc2FibGVldmVudHMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9iamVjdC5fX3ZhbHVlc1tmXSA9IGRhdHVtW2ZdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb2JqZWN0W2ZdID0gZGF0dW1bZl07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gUG91Y2hEQiByZXZpc2lvbiAoaWYgdXNpbmcgc3RvcmFnZSBtb2R1bGUpLlxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gVE9ETzogQ2FuIHRoaXMgYmUgcHVsbGVkIG91dCBvZiBjb3JlP1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGRhdHVtLl9yZXYpIG9iamVjdC5fcmV2ID0gZGF0dW0uX3JldjtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgX21hcDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICAgICAgdmFyIGVycjtcbiAgICAgICAgICAgIHRoaXMubWFwQXR0cmlidXRlcygpO1xuICAgICAgICAgICAgdmFyIHJlbGF0aW9uc2hpcEZpZWxkcyA9IF8ua2V5cyhzZWxmLnN1YlRhc2tSZXN1bHRzKTtcbiAgICAgICAgICAgIF8uZWFjaChyZWxhdGlvbnNoaXBGaWVsZHMsIGZ1bmN0aW9uIChmKSB7XG4gICAgICAgICAgICAgICAgdmFyIHJlcyA9IHNlbGYuc3ViVGFza1Jlc3VsdHNbZl07XG4gICAgICAgICAgICAgICAgdmFyIGluZGV4ZXMgPSByZXMuaW5kZXhlcyxcbiAgICAgICAgICAgICAgICAgICAgb2JqZWN0cyA9IHJlcy5vYmplY3RzO1xuICAgICAgICAgICAgICAgIHZhciByZWxhdGVkRGF0YSA9IHNlbGYuZ2V0UmVsYXRlZERhdGEoZikucmVsYXRlZERhdGE7XG4gICAgICAgICAgICAgICAgdmFyIHVuZmxhdHRlbmVkT2JqZWN0cyA9IHV0aWwudW5mbGF0dGVuQXJyYXkob2JqZWN0cywgcmVsYXRlZERhdGEpO1xuICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdW5mbGF0dGVuZWRPYmplY3RzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBpZHggPSBpbmRleGVzW2ldO1xuICAgICAgICAgICAgICAgICAgICAvLyBFcnJvcnMgYXJlIHBsdWNrZWQgZnJvbSB0aGUgc3Vib3BlcmF0aW9ucy5cbiAgICAgICAgICAgICAgICAgICAgdmFyIGVycm9yID0gc2VsZi5lcnJvcnNbaWR4XTtcbiAgICAgICAgICAgICAgICAgICAgZXJyID0gZXJyb3IgPyBlcnJvcltmXSA6IG51bGw7XG4gICAgICAgICAgICAgICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgcmVsYXRlZCA9IHVuZmxhdHRlbmVkT2JqZWN0c1tpXTsgLy8gQ2FuIGJlIGFycmF5IG9yIHNjYWxhci5cbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBvYmplY3QgPSBzZWxmLm9iamVjdHNbaWR4XTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChvYmplY3QpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlcnIgPSBvYmplY3QuX19wcm94aWVzW2ZdLnNldChyZWxhdGVkLCB7ZGlzYWJsZWV2ZW50czogc2VsZi5kaXNhYmxlZXZlbnRzfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIXNlbGYuZXJyb3JzW2lkeF0pIHNlbGYuZXJyb3JzW2lkeF0gPSB7fTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2VsZi5lcnJvcnNbaWR4XVtmXSA9IGVycjtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSxcbiAgICAgICAgLyoqXG4gICAgICAgICAqIEZvciBpbmRpY2VzIHdoZXJlIG5vIG9iamVjdCBpcyBwcmVzZW50LCBwZXJmb3JtIGxvb2t1cHMsIGNyZWF0aW5nIGEgbmV3IG9iamVjdCBpZiBuZWNlc3NhcnkuXG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICBfbG9va3VwOiBmdW5jdGlvbiAoY2IpIHtcbiAgICAgICAgICAgIHJldHVybiB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uIChjYikge1xuICAgICAgICAgICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgICAgICAgICB2YXIgcmVtb3RlTG9va3VwcyA9IFtdO1xuICAgICAgICAgICAgICAgIHZhciBsb2NhbExvb2t1cHMgPSBbXTtcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMuZGF0YS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIXRoaXMub2JqZWN0c1tpXSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGxvb2t1cDtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBkYXR1bSA9IHRoaXMuZGF0YVtpXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBpc1NjYWxhciA9IHR5cGVvZiBkYXR1bSA9PSAnc3RyaW5nJyB8fCB0eXBlb2YgZGF0dW0gPT0gJ251bWJlcicgfHwgZGF0dW0gaW5zdGFuY2VvZiBTdHJpbmc7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZGF0dW0pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoaXNTY2FsYXIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9va3VwID0ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaW5kZXg6IGksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkYXR1bToge31cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9va3VwLmRhdHVtW3NlbGYubW9kZWwuaWRdID0gZGF0dW07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlbW90ZUxvb2t1cHMucHVzaChsb29rdXApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoZGF0dW0gaW5zdGFuY2VvZiBTaWVzdGFNb2RlbCkgeyAvLyBXZSB3b24ndCBuZWVkIHRvIHBlcmZvcm0gYW55IG1hcHBpbmcuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMub2JqZWN0c1tpXSA9IGRhdHVtO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoZGF0dW0uX2lkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvY2FsTG9va3Vwcy5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGluZGV4OiBpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0dW06IGRhdHVtXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoZGF0dW1bc2VsZi5tb2RlbC5pZF0pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVtb3RlTG9va3Vwcy5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGluZGV4OiBpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0dW06IGRhdHVtXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMub2JqZWN0c1tpXSA9IHNlbGYuX2luc3RhbmNlKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLm9iamVjdHNbaV0gPSBudWxsO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHV0aWwuYXN5bmMucGFyYWxsZWwoW1xuICAgICAgICAgICAgICAgICAgICAgICAgZnVuY3Rpb24gKGRvbmUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgbG9jYWxJZGVudGlmaWVycyA9IF8ucGx1Y2soXy5wbHVjayhsb2NhbExvb2t1cHMsICdkYXR1bScpLCAnX2lkJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGxvY2FsSWRlbnRpZmllcnMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFN0b3JlLmdldE11bHRpcGxlTG9jYWwobG9jYWxJZGVudGlmaWVycywgZnVuY3Rpb24gKGVyciwgb2JqZWN0cykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxvY2FsSWRlbnRpZmllcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG9iaiA9IG9iamVjdHNbaV07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBfaWQgPSBsb2NhbElkZW50aWZpZXJzW2ldO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgbG9va3VwID0gbG9jYWxMb29rdXBzW2ldO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIW9iaikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gSWYgdGhlcmUgYXJlIG11bHRpcGxlIG1hcHBpbmcgb3BlcmF0aW9ucyBnb2luZyBvbiwgdGhlcmUgbWF5IGJlXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvYmogPSBjYWNoZS5nZXQoe19pZDogX2lkfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIW9iailcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvYmogPSBzZWxmLl9pbnN0YW5jZSh7X2lkOiBfaWR9LCAhc2VsZi5kaXNhYmxlZXZlbnRzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYub2JqZWN0c1tsb29rdXAuaW5kZXhdID0gb2JqO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2VsZi5vYmplY3RzW2xvb2t1cC5pbmRleF0gPSBvYmo7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkb25lKGVycik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRvbmUoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgZnVuY3Rpb24gKGRvbmUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgcmVtb3RlSWRlbnRpZmllcnMgPSBfLnBsdWNrKF8ucGx1Y2socmVtb3RlTG9va3VwcywgJ2RhdHVtJyksIHNlbGYubW9kZWwuaWQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChyZW1vdGVJZGVudGlmaWVycy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nKCdMb29raW5nIHVwIHJlbW90ZUlkZW50aWZpZXJzOiAnICsgdXRpbC5wcmV0dHlQcmludChyZW1vdGVJZGVudGlmaWVycykpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBTdG9yZS5nZXRNdWx0aXBsZVJlbW90ZShyZW1vdGVJZGVudGlmaWVycywgc2VsZi5tb2RlbCwgZnVuY3Rpb24gKGVyciwgb2JqZWN0cykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAobG9nLmVuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHJlc3VsdHMgPSB7fTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZm9yIChpID0gMDsgaSA8IG9iamVjdHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc3VsdHNbcmVtb3RlSWRlbnRpZmllcnNbaV1dID0gb2JqZWN0c1tpXSA/IG9iamVjdHNbaV0uX2lkIDogbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2coJ1Jlc3VsdHMgZm9yIHJlbW90ZUlkZW50aWZpZXJzOiAnICsgdXRpbC5wcmV0dHlQcmludChyZXN1bHRzKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCBvYmplY3RzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBvYmogPSBvYmplY3RzW2ldO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgbG9va3VwID0gcmVtb3RlTG9va3Vwc1tpXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG9iaikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2VsZi5vYmplY3RzW2xvb2t1cC5pbmRleF0gPSBvYmo7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgZGF0YSA9IHt9O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHJlbW90ZUlkID0gcmVtb3RlSWRlbnRpZmllcnNbaV07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkYXRhW3NlbGYubW9kZWwuaWRdID0gcmVtb3RlSWQ7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgY2FjaGVRdWVyeSA9IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtb2RlbDogc2VsZi5tb2RlbFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhY2hlUXVlcnlbc2VsZi5tb2RlbC5pZF0gPSByZW1vdGVJZDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBjYWNoZWQgPSBjYWNoZS5nZXQoY2FjaGVRdWVyeSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoY2FjaGVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2VsZi5vYmplY3RzW2xvb2t1cC5pbmRleF0gPSBjYWNoZWQ7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYub2JqZWN0c1tsb29rdXAuaW5kZXhdID0gc2VsZi5faW5zdGFuY2UoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBJdCdzIGltcG9ydGFudCB0aGF0IHdlIG1hcCB0aGUgcmVtb3RlIGlkZW50aWZpZXIgaGVyZSB0byBlbnN1cmUgdGhhdCBpdCBlbmRzXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gdXAgaW4gdGhlIGNhY2hlLlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYub2JqZWN0c1tsb29rdXAuaW5kZXhdW3NlbGYubW9kZWwuaWRdID0gcmVtb3RlSWQ7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkb25lKGVycik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRvbmUoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgICAgICAgIGNiKTtcbiAgICAgICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICAgIH0sXG4gICAgICAgIF9sb29rdXBTaW5nbGV0b246IGZ1bmN0aW9uIChjYikge1xuICAgICAgICAgICAgcmV0dXJuIHV0aWwucHJvbWlzZShjYiwgZnVuY3Rpb24gKGNiKSB7XG4gICAgICAgICAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICAgICAgICAgIC8vIFBpY2sgYSByYW5kb20gX2lkIGZyb20gdGhlIGFycmF5IG9mIGRhdGEgYmVpbmcgbWFwcGVkIG9udG8gdGhlIHNpbmdsZXRvbiBvYmplY3QuIE5vdGUgdGhhdCB0aGV5IHNob3VsZFxuICAgICAgICAgICAgICAgIC8vIGFsd2F5cyBiZSB0aGUgc2FtZS4gVGhpcyBpcyBqdXN0IGEgcHJlY2F1dGlvbi5cbiAgICAgICAgICAgICAgICB2YXIgX2lkcyA9IF8ucGx1Y2soc2VsZi5kYXRhLCAnX2lkJyksXG4gICAgICAgICAgICAgICAgICAgIF9pZDtcbiAgICAgICAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgX2lkcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBpZiAoX2lkc1tpXSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgX2lkID0ge19pZDogX2lkc1tpXX07XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAvLyBUaGUgbWFwcGluZyBvcGVyYXRpb24gaXMgcmVzcG9uc2libGUgZm9yIGNyZWF0aW5nIHNpbmdsZXRvbiBpbnN0YW5jZXMgaWYgdGhleSBkbyBub3QgYWxyZWFkeSBleGlzdC5cbiAgICAgICAgICAgICAgICB2YXIgc2luZ2xldG9uID0gY2FjaGUuZ2V0U2luZ2xldG9uKHRoaXMubW9kZWwpIHx8IHRoaXMuX2luc3RhbmNlKF9pZCk7XG4gICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzZWxmLmRhdGEubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgc2VsZi5vYmplY3RzW2ldID0gc2luZ2xldG9uO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjYigpO1xuICAgICAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgICAgfSxcbiAgICAgICAgX2luc3RhbmNlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB2YXIgbW9kZWwgPSB0aGlzLm1vZGVsLFxuICAgICAgICAgICAgICAgIG1vZGVsSW5zdGFuY2UgPSBtb2RlbC5faW5zdGFuY2UuYXBwbHkobW9kZWwsIGFyZ3VtZW50cyk7XG4gICAgICAgICAgICB0aGlzLl9uZXdPYmplY3RzLnB1c2gobW9kZWxJbnN0YW5jZSk7XG4gICAgICAgICAgICByZXR1cm4gbW9kZWxJbnN0YW5jZTtcbiAgICAgICAgfSxcbiAgICAgICAgc3RhcnQ6IGZ1bmN0aW9uIChkb25lKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5kYXRhLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgICAgICAgICB2YXIgdGFza3MgPSBbXTtcbiAgICAgICAgICAgICAgICB2YXIgbG9va3VwRnVuYyA9IHRoaXMubW9kZWwuc2luZ2xldG9uID8gdGhpcy5fbG9va3VwU2luZ2xldG9uIDogdGhpcy5fbG9va3VwO1xuICAgICAgICAgICAgICAgIHRhc2tzLnB1c2goXy5iaW5kKGxvb2t1cEZ1bmMsIHRoaXMpKTtcbiAgICAgICAgICAgICAgICB0YXNrcy5wdXNoKF8uYmluZCh0aGlzLl9leGVjdXRlU3ViT3BlcmF0aW9ucywgdGhpcykpO1xuICAgICAgICAgICAgICAgIHV0aWwuYXN5bmMucGFyYWxsZWwodGFza3MsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYuX21hcCgpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBVc2VycyBhcmUgYWxsb3dlZCB0byBhZGQgYSBjdXN0b20gaW5pdCBtZXRob2QgdG8gdGhlIG1ldGhvZHMgb2JqZWN0IHdoZW4gZGVmaW5pbmcgYSBNb2RlbCwgb2YgdGhlIGZvcm06XG4gICAgICAgICAgICAgICAgICAgICAgICAvL1xuICAgICAgICAgICAgICAgICAgICAgICAgLy9cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGluaXQ6IGZ1bmN0aW9uIChbZG9uZV0pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vICAgICAvLyAuLi5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAvL1xuICAgICAgICAgICAgICAgICAgICAgICAgLy9cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIElmIGRvbmUgaXMgcGFzc2VkLCB0aGVuIF9faW5pdCBtdXN0IGJlIGV4ZWN1dGVkIGFzeW5jaHJvbm91c2x5LCBhbmQgdGhlIG1hcHBpbmcgb3BlcmF0aW9uIHdpbGwgbm90XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBmaW5pc2ggdW50aWwgYWxsIGluaXRzIGhhdmUgZXhlY3V0ZWQuXG4gICAgICAgICAgICAgICAgICAgICAgICAvL1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gSGVyZSB3ZSBlbnN1cmUgdGhlIGV4ZWN1dGlvbiBvZiBhbGwgb2YgdGhlbVxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGZyb21TdG9yYWdlID0gdGhpcy5mcm9tU3RvcmFnZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBpbml0VGFza3MgPSBfLnJlZHVjZShzZWxmLl9uZXdPYmplY3RzLCBmdW5jdGlvbiAobSwgbykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBpbml0ID0gby5tb2RlbC5pbml0O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpbml0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBwYXJhbU5hbWVzID0gdXRpbC5wYXJhbU5hbWVzKGluaXQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAocGFyYW1OYW1lcy5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtLnB1c2goXy5iaW5kKGluaXQsIG8sIGZyb21TdG9yYWdlLCBkb25lKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbml0LmNhbGwobywgZnJvbVN0b3JhZ2UpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBtO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSwgW10pO1xuICAgICAgICAgICAgICAgICAgICAgICAgYXN5bmMucGFyYWxsZWwoaW5pdFRhc2tzLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZG9uZShzZWxmLmVycm9ycy5sZW5ndGggPyBzZWxmLmVycm9ycyA6IG51bGwsIHNlbGYub2JqZWN0cyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignVW5jYXVnaHQgZXJyb3Igd2hlbiBleGVjdXRpbmcgaW5pdCBmdW5jaXRvbnMgb24gbW9kZWxzLicsIGUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZG9uZShlKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGRvbmUobnVsbCwgW10pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICBnZXRSZWxhdGVkRGF0YTogZnVuY3Rpb24gKG5hbWUpIHtcbiAgICAgICAgICAgIHZhciBpbmRleGVzID0gW107XG4gICAgICAgICAgICB2YXIgcmVsYXRlZERhdGEgPSBbXTtcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5kYXRhLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgdmFyIGRhdHVtID0gdGhpcy5kYXRhW2ldO1xuICAgICAgICAgICAgICAgIGlmIChkYXR1bSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZGF0dW1bbmFtZV0pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGluZGV4ZXMucHVzaChpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlbGF0ZWREYXRhLnB1c2goZGF0dW1bbmFtZV0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBpbmRleGVzOiBpbmRleGVzLFxuICAgICAgICAgICAgICAgIHJlbGF0ZWREYXRhOiByZWxhdGVkRGF0YVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfSxcbiAgICAgICAgcHJvY2Vzc0Vycm9yc0Zyb21UYXNrOiBmdW5jdGlvbiAocmVsYXRpb25zaGlwTmFtZSwgZXJyb3JzLCBpbmRleGVzKSB7XG4gICAgICAgICAgICBpZiAoZXJyb3JzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIHZhciByZWxhdGVkRGF0YSA9IHRoaXMuZ2V0UmVsYXRlZERhdGEocmVsYXRpb25zaGlwTmFtZSkucmVsYXRlZERhdGE7XG4gICAgICAgICAgICAgICAgdmFyIHVuZmxhdHRlbmVkRXJyb3JzID0gdXRpbC51bmZsYXR0ZW5BcnJheShlcnJvcnMsIHJlbGF0ZWREYXRhKTtcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHVuZmxhdHRlbmVkRXJyb3JzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBpZHggPSBpbmRleGVzW2ldO1xuICAgICAgICAgICAgICAgICAgICB2YXIgZXJyID0gdW5mbGF0dGVuZWRFcnJvcnNbaV07XG4gICAgICAgICAgICAgICAgICAgIHZhciBpc0Vycm9yID0gZXJyO1xuICAgICAgICAgICAgICAgICAgICBpZiAodXRpbC5pc0FycmF5KGVycikpIGlzRXJyb3IgPSBfLnJlZHVjZShlcnIsIGZ1bmN0aW9uIChtZW1vLCB4KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gbWVtbyB8fCB4XG4gICAgICAgICAgICAgICAgICAgIH0sIGZhbHNlKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGlzRXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghdGhpcy5lcnJvcnNbaWR4XSkgdGhpcy5lcnJvcnNbaWR4XSA9IHt9O1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5lcnJvcnNbaWR4XVtyZWxhdGlvbnNoaXBOYW1lXSA9IGVycjtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgX2V4ZWN1dGVTdWJPcGVyYXRpb25zOiBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICAgICAgICAgIHZhciBzZWxmID0gdGhpcyxcbiAgICAgICAgICAgICAgICByZWxhdGlvbnNoaXBOYW1lcyA9IF8ua2V5cyh0aGlzLm1vZGVsLnJlbGF0aW9uc2hpcHMpO1xuICAgICAgICAgICAgaWYgKHJlbGF0aW9uc2hpcE5hbWVzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIHZhciB0YXNrcyA9IF8ucmVkdWNlKHJlbGF0aW9uc2hpcE5hbWVzLCBmdW5jdGlvbiAobSwgcmVsYXRpb25zaGlwTmFtZSkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgcmVsYXRpb25zaGlwID0gc2VsZi5tb2RlbC5yZWxhdGlvbnNoaXBzW3JlbGF0aW9uc2hpcE5hbWVdLFxuICAgICAgICAgICAgICAgICAgICAgICAgcmV2ZXJzZU1vZGVsID0gcmVsYXRpb25zaGlwLmZvcndhcmROYW1lID09IHJlbGF0aW9uc2hpcE5hbWUgPyByZWxhdGlvbnNoaXAucmV2ZXJzZU1vZGVsIDogcmVsYXRpb25zaGlwLmZvcndhcmRNb2RlbDtcbiAgICAgICAgICAgICAgICAgICAgLy8gTW9jayBhbnkgbWlzc2luZyBzaW5nbGV0b24gZGF0YSB0byBlbnN1cmUgdGhhdCBhbGwgc2luZ2xldG9uIGluc3RhbmNlcyBhcmUgY3JlYXRlZC5cbiAgICAgICAgICAgICAgICAgICAgaWYgKHJldmVyc2VNb2RlbC5zaW5nbGV0b24gJiYgIXJlbGF0aW9uc2hpcC5pc1JldmVyc2UpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGF0YS5mb3JFYWNoKGZ1bmN0aW9uIChkYXR1bSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghZGF0dW1bcmVsYXRpb25zaGlwTmFtZV0pIGRhdHVtW3JlbGF0aW9uc2hpcE5hbWVdID0ge307XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB2YXIgX19yZXQgPSB0aGlzLmdldFJlbGF0ZWREYXRhKHJlbGF0aW9uc2hpcE5hbWUpLFxuICAgICAgICAgICAgICAgICAgICAgICAgaW5kZXhlcyA9IF9fcmV0LmluZGV4ZXMsXG4gICAgICAgICAgICAgICAgICAgICAgICByZWxhdGVkRGF0YSA9IF9fcmV0LnJlbGF0ZWREYXRhO1xuICAgICAgICAgICAgICAgICAgICBpZiAocmVsYXRlZERhdGEubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgZmxhdFJlbGF0ZWREYXRhID0gdXRpbC5mbGF0dGVuQXJyYXkocmVsYXRlZERhdGEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG9wID0gbmV3IE1hcHBpbmdPcGVyYXRpb24oe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1vZGVsOiByZXZlcnNlTW9kZWwsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0YTogZmxhdFJlbGF0ZWREYXRhLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRpc2FibGVldmVudHM6IHNlbGYuZGlzYWJsZWV2ZW50cyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBfaWdub3JlSW5zdGFsbGVkOiBzZWxmLl9pZ25vcmVJbnN0YWxsZWQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZnJvbVN0b3JhZ2U6IHRoaXMuZnJvbVN0b3JhZ2VcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKG9wKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgdGFzaztcbiAgICAgICAgICAgICAgICAgICAgICAgIHRhc2sgPSBmdW5jdGlvbiAoZG9uZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9wLnN0YXJ0KGZ1bmN0aW9uIChlcnJvcnMsIG9iamVjdHMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2VsZi5zdWJUYXNrUmVzdWx0c1tyZWxhdGlvbnNoaXBOYW1lXSA9IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVycm9yczogZXJyb3JzLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb2JqZWN0czogb2JqZWN0cyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGluZGV4ZXM6IGluZGV4ZXNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2VsZi5wcm9jZXNzRXJyb3JzRnJvbVRhc2socmVsYXRpb25zaGlwTmFtZSwgb3AuZXJyb3JzLCBpbmRleGVzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZG9uZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgICAgICAgIG0ucHVzaCh0YXNrKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbTtcbiAgICAgICAgICAgICAgICB9LmJpbmQodGhpcyksIFtdKTtcbiAgICAgICAgICAgICAgICBhc3luYy5wYXJhbGxlbCh0YXNrcywgZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICBtb2R1bGUuZXhwb3J0cyA9IE1hcHBpbmdPcGVyYXRpb247XG5cblxuXG59KSgpOyIsIihmdW5jdGlvbiAoKSB7XG5cbiAgICB2YXIgbG9nID0gcmVxdWlyZSgnLi9sb2cnKSgnbW9kZWwnKSxcbiAgICAgICAgQ29sbGVjdGlvblJlZ2lzdHJ5ID0gcmVxdWlyZSgnLi9jb2xsZWN0aW9uUmVnaXN0cnknKS5Db2xsZWN0aW9uUmVnaXN0cnksXG4gICAgICAgIEludGVybmFsU2llc3RhRXJyb3IgPSByZXF1aXJlKCcuL2Vycm9yJykuSW50ZXJuYWxTaWVzdGFFcnJvcixcbiAgICAgICAgUmVsYXRpb25zaGlwVHlwZSA9IHJlcXVpcmUoJy4vUmVsYXRpb25zaGlwVHlwZScpLFxuICAgICAgICBRdWVyeSA9IHJlcXVpcmUoJy4vUXVlcnknKSxcbiAgICAgICAgTWFwcGluZ09wZXJhdGlvbiA9IHJlcXVpcmUoJy4vbWFwcGluZ09wZXJhdGlvbicpLFxuICAgICAgICBNb2RlbEluc3RhbmNlID0gcmVxdWlyZSgnLi9Nb2RlbEluc3RhbmNlJyksXG4gICAgICAgIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKSxcbiAgICAgICAgY2FjaGUgPSByZXF1aXJlKCcuL2NhY2hlJyksXG4gICAgICAgIHN0b3JlID0gcmVxdWlyZSgnLi9zdG9yZScpLFxuICAgICAgICBlcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKSxcbiAgICAgICAgZXh0ZW5kID0gcmVxdWlyZSgnZXh0ZW5kJyksXG4gICAgICAgIG1vZGVsRXZlbnRzID0gcmVxdWlyZSgnLi9tb2RlbEV2ZW50cycpLFxuICAgICAgICBldmVudHMgPSByZXF1aXJlKCcuL2V2ZW50cycpLFxuICAgICAgICBPbmVUb09uZVByb3h5ID0gcmVxdWlyZSgnLi9PbmVUb09uZVByb3h5JyksXG4gICAgICAgIE1hbnlUb01hbnlQcm94eSA9IHJlcXVpcmUoJy4vTWFueVRvTWFueVByb3h5JyksXG4gICAgICAgIFJlYWN0aXZlUXVlcnkgPSByZXF1aXJlKCcuL1JlYWN0aXZlUXVlcnknKSxcbiAgICAgICAgaW5zdGFuY2VGYWN0b3J5ID0gcmVxdWlyZSgnLi9pbnN0YW5jZUZhY3RvcnknKSxcbiAgICAgICAgQXJyYW5nZWRSZWFjdGl2ZVF1ZXJ5ID0gcmVxdWlyZSgnLi9BcnJhbmdlZFJlYWN0aXZlUXVlcnknKSxcbiAgICAgICAgXyA9IHV0aWwuXztcblxuICAgIC8qKlxuICAgICAqXG4gICAgICogQHBhcmFtIHtPYmplY3R9IG9wdHNcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBNb2RlbChvcHRzKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgdGhpcy5fb3B0cyA9IG9wdHMgPyBfLmV4dGVuZCh7fSwgb3B0cykgOiB7fTtcblxuICAgICAgICB1dGlsLmV4dGVuZEZyb21PcHRzKHRoaXMsIG9wdHMsIHtcbiAgICAgICAgICAgIG1ldGhvZHM6IHt9LFxuICAgICAgICAgICAgYXR0cmlidXRlczogW10sXG4gICAgICAgICAgICBjb2xsZWN0aW9uOiBmdW5jdGlvbiAoYykge1xuICAgICAgICAgICAgICAgIGlmICh1dGlsLmlzU3RyaW5nKGMpKSB7XG4gICAgICAgICAgICAgICAgICAgIGMgPSBDb2xsZWN0aW9uUmVnaXN0cnlbY107XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiBjO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGlkOiAnaWQnLFxuICAgICAgICAgICAgcmVsYXRpb25zaGlwczogW10sXG4gICAgICAgICAgICBuYW1lOiBudWxsLFxuICAgICAgICAgICAgaW5kZXhlczogW10sXG4gICAgICAgICAgICBzaW5nbGV0b246IGZhbHNlLFxuICAgICAgICAgICAgc3RhdGljczogdGhpcy5pbnN0YWxsU3RhdGljcy5iaW5kKHRoaXMpLFxuICAgICAgICAgICAgcHJvcGVydGllczoge30sXG4gICAgICAgICAgICBpbml0OiBudWxsLFxuICAgICAgICAgICAgcmVtb3ZlOiBudWxsXG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRoaXMuYXR0cmlidXRlcyA9IE1vZGVsLl9wcm9jZXNzQXR0cmlidXRlcyh0aGlzLmF0dHJpYnV0ZXMpO1xuXG4gICAgICAgIHRoaXMuX2luc3RhbmNlID0gbmV3IGluc3RhbmNlRmFjdG9yeSh0aGlzKTtcblxuICAgICAgICBfLmV4dGVuZCh0aGlzLCB7XG4gICAgICAgICAgICBfaW5zdGFsbGVkOiBmYWxzZSxcbiAgICAgICAgICAgIF9yZWxhdGlvbnNoaXBzSW5zdGFsbGVkOiBmYWxzZSxcbiAgICAgICAgICAgIF9yZXZlcnNlUmVsYXRpb25zaGlwc0luc3RhbGxlZDogZmFsc2UsXG4gICAgICAgICAgICBjaGlsZHJlbjogW11cbiAgICAgICAgfSk7XG5cbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnRpZXModGhpcywge1xuICAgICAgICAgICAgX3JlbGF0aW9uc2hpcE5hbWVzOiB7XG4gICAgICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBPYmplY3Qua2V5cyhzZWxmLnJlbGF0aW9uc2hpcHMpO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIF9hdHRyaWJ1dGVOYW1lczoge1xuICAgICAgICAgICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgbmFtZXMgPSBbXTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHNlbGYuaWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG5hbWVzLnB1c2goc2VsZi5pZCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgXy5lYWNoKHNlbGYuYXR0cmlidXRlcywgZnVuY3Rpb24gKHgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG5hbWVzLnB1c2goeC5uYW1lKVxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG5hbWVzO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBpbnN0YWxsZWQ6IHtcbiAgICAgICAgICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHNlbGYuX2luc3RhbGxlZCAmJiBzZWxmLl9yZWxhdGlvbnNoaXBzSW5zdGFsbGVkICYmIHNlbGYuX3JldmVyc2VSZWxhdGlvbnNoaXBzSW5zdGFsbGVkO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBkZXNjZW5kYW50czoge1xuICAgICAgICAgICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gXy5yZWR1Y2Uoc2VsZi5jaGlsZHJlbiwgZnVuY3Rpb24gKG1lbW8sIGRlc2NlbmRhbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBBcnJheS5wcm90b3R5cGUuY29uY2F0LmNhbGwobWVtbywgZGVzY2VuZGFudC5kZXNjZW5kYW50cyk7XG4gICAgICAgICAgICAgICAgICAgIH0uYmluZChzZWxmKSwgXy5leHRlbmQoW10sIHNlbGYuY2hpbGRyZW4pKTtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBkaXJ0eToge1xuICAgICAgICAgICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoc2llc3RhLmV4dC5zdG9yYWdlRW5hYmxlZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHVuc2F2ZWRPYmplY3RzQnlDb2xsZWN0aW9uID0gc2llc3RhLmV4dC5zdG9yYWdlLl91bnNhdmVkT2JqZWN0c0J5Q29sbGVjdGlvbixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBoYXNoID0gKHVuc2F2ZWRPYmplY3RzQnlDb2xsZWN0aW9uW3RoaXMuY29sbGVjdGlvbk5hbWVdIHx8IHt9KVt0aGlzLm5hbWVdIHx8IHt9O1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuICEhT2JqZWN0LmtleXMoaGFzaCkubGVuZ3RoO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2UgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBjb2xsZWN0aW9uTmFtZToge1xuICAgICAgICAgICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5jb2xsZWN0aW9uLm5hbWU7XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlXG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICBldmVudHMuUHJveHlFdmVudEVtaXR0ZXIuY2FsbCh0aGlzLCB0aGlzLmNvbGxlY3Rpb25OYW1lICsgJzonICsgdGhpcy5uYW1lKTtcbiAgICB9XG5cbiAgICBfLmV4dGVuZChNb2RlbCwge1xuICAgICAgICAvKipcbiAgICAgICAgICogTm9ybWFsaXNlIGF0dHJpYnV0ZXMgcGFzc2VkIHZpYSB0aGUgb3B0aW9ucyBkaWN0aW9uYXJ5LlxuICAgICAgICAgKiBAcGFyYW0gYXR0cmlidXRlc1xuICAgICAgICAgKiBAcmV0dXJucyB7QXJyYXl9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICBfcHJvY2Vzc0F0dHJpYnV0ZXM6IGZ1bmN0aW9uIChhdHRyaWJ1dGVzKSB7XG4gICAgICAgICAgICByZXR1cm4gXy5yZWR1Y2UoYXR0cmlidXRlcywgZnVuY3Rpb24gKG0sIGEpIHtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGEgPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICAgICAgbS5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG5hbWU6IGFcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBtLnB1c2goYSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiBtO1xuICAgICAgICAgICAgfSwgW10pXG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIE1vZGVsLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoZXZlbnRzLlByb3h5RXZlbnRFbWl0dGVyLnByb3RvdHlwZSk7XG5cbiAgICBfLmV4dGVuZChNb2RlbC5wcm90b3R5cGUsIHtcbiAgICAgICAgaW5zdGFsbFN0YXRpY3M6IGZ1bmN0aW9uIChzdGF0aWNzKSB7XG4gICAgICAgICAgICBpZiAoc3RhdGljcykge1xuICAgICAgICAgICAgICAgIF8uZWFjaChPYmplY3Qua2V5cyhzdGF0aWNzKSwgZnVuY3Rpb24gKHN0YXRpY05hbWUpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXNbc3RhdGljTmFtZV0pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZygnU3RhdGljIG1ldGhvZCB3aXRoIG5hbWUgXCInICsgc3RhdGljTmFtZSArICdcIiBhbHJlYWR5IGV4aXN0cy4gSWdub3JpbmcgaXQuJyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzW3N0YXRpY05hbWVdID0gc3RhdGljc1tzdGF0aWNOYW1lXS5iaW5kKHRoaXMpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBzdGF0aWNzO1xuICAgICAgICB9LFxuICAgICAgICBfdmFsaWRhdGVSZWxhdGlvbnNoaXBUeXBlOiBmdW5jdGlvbiAocmVsYXRpb25zaGlwKSB7XG4gICAgICAgICAgICBpZiAoIXJlbGF0aW9uc2hpcC50eXBlKSB7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuc2luZ2xldG9uKSByZWxhdGlvbnNoaXAudHlwZSA9IFJlbGF0aW9uc2hpcFR5cGUuT25lVG9PbmU7XG4gICAgICAgICAgICAgICAgZWxzZSByZWxhdGlvbnNoaXAudHlwZSA9IFJlbGF0aW9uc2hpcFR5cGUuT25lVG9NYW55O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHRoaXMuc2luZ2xldG9uICYmIHJlbGF0aW9uc2hpcC50eXBlID09IFJlbGF0aW9uc2hpcFR5cGUuTWFueVRvTWFueSkge1xuICAgICAgICAgICAgICAgIHJldHVybiAnU2luZ2xldG9uIG1vZGVsIGNhbm5vdCB1c2UgTWFueVRvTWFueSByZWxhdGlvbnNoaXAuJztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChPYmplY3Qua2V5cyhSZWxhdGlvbnNoaXBUeXBlKS5pbmRleE9mKHJlbGF0aW9uc2hpcC50eXBlKSA8IDApXG4gICAgICAgICAgICAgICAgcmV0dXJuICdSZWxhdGlvbnNoaXAgdHlwZSAnICsgcmVsYXRpb25zaGlwLnR5cGUgKyAnIGRvZXMgbm90IGV4aXN0JztcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBJbnN0YWxsIHJlbGF0aW9uc2hpcHMuIFJldHVybnMgZXJyb3IgaW4gZm9ybSBvZiBzdHJpbmcgaWYgZmFpbHMuXG4gICAgICAgICAqIEByZXR1cm4ge1N0cmluZ3xudWxsfVxuICAgICAgICAgKi9cbiAgICAgICAgaW5zdGFsbFJlbGF0aW9uc2hpcHM6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5fcmVsYXRpb25zaGlwc0luc3RhbGxlZCkge1xuICAgICAgICAgICAgICAgIHZhciBzZWxmID0gdGhpcyxcbiAgICAgICAgICAgICAgICAgICAgZXJyID0gbnVsbDtcbiAgICAgICAgICAgICAgICBzZWxmLl9yZWxhdGlvbnNoaXBzID0gW107XG4gICAgICAgICAgICAgICAgaWYgKHNlbGYuX29wdHMucmVsYXRpb25zaGlwcykge1xuICAgICAgICAgICAgICAgICAgICBmb3IgKHZhciBuYW1lIGluIHNlbGYuX29wdHMucmVsYXRpb25zaGlwcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHNlbGYuX29wdHMucmVsYXRpb25zaGlwcy5oYXNPd25Qcm9wZXJ0eShuYW1lKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciByZWxhdGlvbnNoaXAgPSBzZWxmLl9vcHRzLnJlbGF0aW9uc2hpcHNbbmFtZV07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gSWYgYSByZXZlcnNlIHJlbGF0aW9uc2hpcCBpcyBpbnN0YWxsZWQgYmVmb3JlaGFuZCwgd2UgZG8gbm90IHdhbnQgdG8gcHJvY2VzcyB0aGVtLlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghcmVsYXRpb25zaGlwLmlzUmV2ZXJzZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2codGhpcy5uYW1lICsgJzogY29uZmlndXJpbmcgcmVsYXRpb25zaGlwICcgKyBuYW1lLCByZWxhdGlvbnNoaXApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIShlcnIgPSB0aGlzLl92YWxpZGF0ZVJlbGF0aW9uc2hpcFR5cGUocmVsYXRpb25zaGlwKSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBtb2RlbE5hbWUgPSByZWxhdGlvbnNoaXAubW9kZWw7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZWxldGUgcmVsYXRpb25zaGlwLm1vZGVsO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHJldmVyc2VNb2RlbDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChtb2RlbE5hbWUgaW5zdGFuY2VvZiBNb2RlbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldmVyc2VNb2RlbCA9IG1vZGVsTmFtZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZygncmV2ZXJzZU1vZGVsTmFtZScsIG1vZGVsTmFtZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFzZWxmLmNvbGxlY3Rpb24pIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdNb2RlbCBtdXN0IGhhdmUgY29sbGVjdGlvbicpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBjb2xsZWN0aW9uID0gc2VsZi5jb2xsZWN0aW9uO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghY29sbGVjdGlvbikgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ0NvbGxlY3Rpb24gJyArIHNlbGYuY29sbGVjdGlvbk5hbWUgKyAnIG5vdCByZWdpc3RlcmVkJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV2ZXJzZU1vZGVsID0gY29sbGVjdGlvblttb2RlbE5hbWVdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFyZXZlcnNlTW9kZWwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgYXJyID0gbW9kZWxOYW1lLnNwbGl0KCcuJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGFyci5sZW5ndGggPT0gMikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgY29sbGVjdGlvbk5hbWUgPSBhcnJbMF07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1vZGVsTmFtZSA9IGFyclsxXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG90aGVyQ29sbGVjdGlvbiA9IENvbGxlY3Rpb25SZWdpc3RyeVtjb2xsZWN0aW9uTmFtZV07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghb3RoZXJDb2xsZWN0aW9uKSByZXR1cm4gJ0NvbGxlY3Rpb24gd2l0aCBuYW1lIFwiJyArIGNvbGxlY3Rpb25OYW1lICsgJ1wiIGRvZXMgbm90IGV4aXN0Lic7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldmVyc2VNb2RlbCA9IG90aGVyQ29sbGVjdGlvblttb2RlbE5hbWVdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZygncmV2ZXJzZU1vZGVsJywgcmV2ZXJzZU1vZGVsKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChyZXZlcnNlTW9kZWwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBfLmV4dGVuZChyZWxhdGlvbnNoaXAsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV2ZXJzZU1vZGVsOiByZXZlcnNlTW9kZWwsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZvcndhcmRNb2RlbDogdGhpcyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZm9yd2FyZE5hbWU6IG5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldmVyc2VOYW1lOiByZWxhdGlvbnNoaXAucmV2ZXJzZSB8fCAncmV2ZXJzZV8nICsgbmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaXNSZXZlcnNlOiBmYWxzZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlbGV0ZSByZWxhdGlvbnNoaXAucmV2ZXJzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSByZXR1cm4gJ01vZGVsIHdpdGggbmFtZSBcIicgKyBtb2RlbE5hbWUudG9TdHJpbmcoKSArICdcIiBkb2VzIG5vdCBleGlzdCc7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdSZWxhdGlvbnNoaXBzIGZvciBcIicgKyB0aGlzLm5hbWUgKyAnXCIgaGF2ZSBhbHJlYWR5IGJlZW4gaW5zdGFsbGVkJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIWVycikgdGhpcy5fcmVsYXRpb25zaGlwc0luc3RhbGxlZCA9IHRydWU7XG4gICAgICAgICAgICByZXR1cm4gZXJyO1xuICAgICAgICB9LFxuICAgICAgICBpbnN0YWxsUmV2ZXJzZVJlbGF0aW9uc2hpcHM6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5fcmV2ZXJzZVJlbGF0aW9uc2hpcHNJbnN0YWxsZWQpIHtcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBmb3J3YXJkTmFtZSBpbiB0aGlzLnJlbGF0aW9uc2hpcHMpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMucmVsYXRpb25zaGlwcy5oYXNPd25Qcm9wZXJ0eShmb3J3YXJkTmFtZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciByZWxhdGlvbnNoaXAgPSB0aGlzLnJlbGF0aW9uc2hpcHNbZm9yd2FyZE5hbWVdO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVsYXRpb25zaGlwID0gZXh0ZW5kKHRydWUsIHt9LCByZWxhdGlvbnNoaXApO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVsYXRpb25zaGlwLmlzUmV2ZXJzZSA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgcmV2ZXJzZU1vZGVsID0gcmVsYXRpb25zaGlwLnJldmVyc2VNb2RlbCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXZlcnNlTmFtZSA9IHJlbGF0aW9uc2hpcC5yZXZlcnNlTmFtZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChyZXZlcnNlTW9kZWwuc2luZ2xldG9uKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHJlbGF0aW9uc2hpcC50eXBlID09IFJlbGF0aW9uc2hpcFR5cGUuTWFueVRvTWFueSkgcmV0dXJuICdTaW5nbGV0b24gbW9kZWwgY2Fubm90IGJlIHJlbGF0ZWQgdmlhIHJldmVyc2UgTWFueVRvTWFueSc7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHJlbGF0aW9uc2hpcC50eXBlID09IFJlbGF0aW9uc2hpcFR5cGUuT25lVG9NYW55KSByZXR1cm4gJ1NpbmdsZXRvbiBtb2RlbCBjYW5ub3QgYmUgcmVsYXRlZCB2aWEgcmV2ZXJzZSBPbmVUb01hbnknO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgbG9nKHRoaXMubmFtZSArICc6IGNvbmZpZ3VyaW5nICByZXZlcnNlIHJlbGF0aW9uc2hpcCAnICsgcmV2ZXJzZU5hbWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV2ZXJzZU1vZGVsLnJlbGF0aW9uc2hpcHNbcmV2ZXJzZU5hbWVdID0gcmVsYXRpb25zaGlwO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHRoaXMuX3JldmVyc2VSZWxhdGlvbnNoaXBzSW5zdGFsbGVkID0gdHJ1ZTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ1JldmVyc2UgcmVsYXRpb25zaGlwcyBmb3IgXCInICsgdGhpcy5uYW1lICsgJ1wiIGhhdmUgYWxyZWFkeSBiZWVuIGluc3RhbGxlZC4nKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgX3F1ZXJ5OiBmdW5jdGlvbiAocXVlcnkpIHtcbiAgICAgICAgICAgIHJldHVybiBuZXcgUXVlcnkodGhpcywgcXVlcnkgfHwge30pO1xuICAgICAgICB9LFxuICAgICAgICBxdWVyeTogZnVuY3Rpb24gKHF1ZXJ5LCBjYikge1xuICAgICAgICAgICAgcmV0dXJuIHV0aWwucHJvbWlzZShjYiwgZnVuY3Rpb24gKGNiKSB7XG4gICAgICAgICAgICAgICAgaWYgKCF0aGlzLnNpbmdsZXRvbikgcmV0dXJuICh0aGlzLl9xdWVyeShxdWVyeSkpLmV4ZWN1dGUoY2IpO1xuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAodGhpcy5fcXVlcnkoe19faWdub3JlSW5zdGFsbGVkOiB0cnVlfSkpLmV4ZWN1dGUoZnVuY3Rpb24gKGVyciwgb2Jqcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVycikgY2IoZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIENhY2hlIGEgbmV3IHNpbmdsZXRvbiBhbmQgdGhlbiByZWV4ZWN1dGUgdGhlIHF1ZXJ5XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcXVlcnkgPSBfLmV4dGVuZCh7fSwgcXVlcnkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHF1ZXJ5Ll9faWdub3JlSW5zdGFsbGVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIW9ianMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZ3JhcGgoe30sIGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKHRoaXMuX3F1ZXJ5KHF1ZXJ5KSkuZXhlY3V0ZShjYik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYihlcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKHRoaXMuX3F1ZXJ5KHF1ZXJ5KSkuZXhlY3V0ZShjYik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0uYmluZCh0aGlzKSk7XG5cbiAgICAgICAgfSxcbiAgICAgICAgcmVhY3RpdmVRdWVyeTogZnVuY3Rpb24gKHF1ZXJ5KSB7XG4gICAgICAgICAgICByZXR1cm4gbmV3IFJlYWN0aXZlUXVlcnkobmV3IFF1ZXJ5KHRoaXMsIHF1ZXJ5IHx8IHt9KSk7XG4gICAgICAgIH0sXG4gICAgICAgIGFycmFuZ2VkUmVhY3RpdmVRdWVyeTogZnVuY3Rpb24gKHF1ZXJ5KSB7XG4gICAgICAgICAgICByZXR1cm4gbmV3IEFycmFuZ2VkUmVhY3RpdmVRdWVyeShuZXcgUXVlcnkodGhpcywgcXVlcnkgfHwge30pKTtcbiAgICAgICAgfSxcbiAgICAgICAgb25lOiBmdW5jdGlvbiAob3B0cywgY2IpIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2Ygb3B0cyA9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICAgICAgY2IgPSBvcHRzO1xuICAgICAgICAgICAgICAgIG9wdHMgPSB7fTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uIChjYikge1xuICAgICAgICAgICAgICAgIHRoaXMucXVlcnkob3B0cywgZnVuY3Rpb24gKGVyciwgcmVzKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIGNiKGVycik7XG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHJlcy5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2IoZXJyb3IoJ01vcmUgdGhhbiBvbmUgaW5zdGFuY2UgcmV0dXJuZWQgd2hlbiBleGVjdXRpbmcgZ2V0IHF1ZXJ5IScpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlcyA9IHJlcy5sZW5ndGggPyByZXNbMF0gOiBudWxsO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNiKG51bGwsIHJlcyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICAgIH0sXG4gICAgICAgIGFsbDogZnVuY3Rpb24gKHEsIGNiKSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIHEgPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgICAgIGNiID0gcTtcbiAgICAgICAgICAgICAgICBxID0ge307XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBxID0gcSB8fCB7fTtcbiAgICAgICAgICAgIHZhciBxdWVyeSA9IHt9O1xuICAgICAgICAgICAgaWYgKHEuX19vcmRlcikgcXVlcnkuX19vcmRlciA9IHEuX19vcmRlcjtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnF1ZXJ5KHEsIGNiKTtcbiAgICAgICAgfSxcbiAgICAgICAgaW5zdGFsbDogZnVuY3Rpb24gKGNiKSB7XG4gICAgICAgICAgICBsb2coJ0luc3RhbGxpbmcgbWFwcGluZyAnICsgdGhpcy5uYW1lKTtcbiAgICAgICAgICAgIHJldHVybiB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uIChjYikge1xuICAgICAgICAgICAgICAgIGlmICghdGhpcy5faW5zdGFsbGVkKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2luc3RhbGxlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIGNiKCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ01vZGVsIFwiJyArIHRoaXMubmFtZSArICdcIiBoYXMgYWxyZWFkeSBiZWVuIGluc3RhbGxlZCcpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICAgIH0sXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBNYXAgZGF0YSBpbnRvIFNpZXN0YS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIGRhdGEgUmF3IGRhdGEgcmVjZWl2ZWQgcmVtb3RlbHkgb3Igb3RoZXJ3aXNlXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb258b2JqZWN0fSBbb3B0c11cbiAgICAgICAgICogQHBhcmFtIHtib29sZWFufSBvcHRzLm92ZXJyaWRlXG4gICAgICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gb3B0cy5faWdub3JlSW5zdGFsbGVkIC0gQSBoYWNrIHRoYXQgYWxsb3dzIG1hcHBpbmcgb250byBNb2RlbHMgZXZlbiBpZiBpbnN0YWxsIHByb2Nlc3MgaGFzIG5vdCBmaW5pc2hlZC5cbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbn0gW2NiXSBDYWxsZWQgb25jZSBwb3VjaCBwZXJzaXN0ZW5jZSByZXR1cm5zLlxuICAgICAgICAgKi9cbiAgICAgICAgZ3JhcGg6IGZ1bmN0aW9uIChkYXRhLCBvcHRzLCBjYikge1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBvcHRzID09ICdmdW5jdGlvbicpIGNiID0gb3B0cztcbiAgICAgICAgICAgIG9wdHMgPSBvcHRzIHx8IHt9O1xuICAgICAgICAgICAgcmV0dXJuIHV0aWwucHJvbWlzZShjYiwgZnVuY3Rpb24gKGNiKSB7XG4gICAgICAgICAgICAgICAgdmFyIF9tYXAgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBvdmVycmlkZXMgPSBvcHRzLm92ZXJyaWRlO1xuICAgICAgICAgICAgICAgICAgICBpZiAob3ZlcnJpZGVzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodXRpbC5pc0FycmF5KG92ZXJyaWRlcykpIG9wdHMub2JqZWN0cyA9IG92ZXJyaWRlcztcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsc2Ugb3B0cy5vYmplY3RzID0gW292ZXJyaWRlc107XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZGVsZXRlIG9wdHMub3ZlcnJpZGU7XG4gICAgICAgICAgICAgICAgICAgIGlmICh1dGlsLmlzQXJyYXkoZGF0YSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX21hcEJ1bGsoZGF0YSwgb3B0cywgY2IpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fbWFwQnVsayhbZGF0YV0sIG9wdHMsIGZ1bmN0aW9uIChlcnIsIG9iamVjdHMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgb2JqO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChvYmplY3RzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChvYmplY3RzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb2JqID0gb2JqZWN0c1swXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlcnIgPSBlcnIgPyAodXRpbC5pc0FycmF5KGRhdGEpID8gZXJyIDogKHV0aWwuaXNBcnJheShlcnIpID8gZXJyWzBdIDogZXJyKSkgOiBudWxsO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNiKGVyciwgb2JqKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfS5iaW5kKHRoaXMpO1xuICAgICAgICAgICAgICAgIGlmIChvcHRzLl9pZ25vcmVJbnN0YWxsZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgX21hcCgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHNpZXN0YS5fYWZ0ZXJJbnN0YWxsKF9tYXApO1xuICAgICAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgICAgfSxcbiAgICAgICAgX21hcEJ1bGs6IGZ1bmN0aW9uIChkYXRhLCBvcHRzLCBjYWxsYmFjaykge1xuICAgICAgICAgICAgXy5leHRlbmQob3B0cywge21vZGVsOiB0aGlzLCBkYXRhOiBkYXRhfSk7XG4gICAgICAgICAgICB2YXIgb3AgPSBuZXcgTWFwcGluZ09wZXJhdGlvbihvcHRzKTtcbiAgICAgICAgICAgIG9wLnN0YXJ0KGZ1bmN0aW9uIChlcnIsIG9iamVjdHMpIHtcbiAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhudWxsLCBvYmplY3RzIHx8IFtdKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSxcbiAgICAgICAgX2NvdW50Q2FjaGU6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHZhciBjb2xsQ2FjaGUgPSBjYWNoZS5fbG9jYWxDYWNoZUJ5VHlwZVt0aGlzLmNvbGxlY3Rpb25OYW1lXSB8fCB7fTtcbiAgICAgICAgICAgIHZhciBtb2RlbENhY2hlID0gY29sbENhY2hlW3RoaXMubmFtZV0gfHwge307XG4gICAgICAgICAgICByZXR1cm4gXy5yZWR1Y2UoT2JqZWN0LmtleXMobW9kZWxDYWNoZSksIGZ1bmN0aW9uIChtLCBfaWQpIHtcbiAgICAgICAgICAgICAgICBtW19pZF0gPSB7fTtcbiAgICAgICAgICAgICAgICByZXR1cm4gbTtcbiAgICAgICAgICAgIH0sIHt9KTtcbiAgICAgICAgfSxcbiAgICAgICAgY291bnQ6IGZ1bmN0aW9uIChjYikge1xuICAgICAgICAgICAgcmV0dXJuIHV0aWwucHJvbWlzZShjYiwgZnVuY3Rpb24gKGNiKSB7XG4gICAgICAgICAgICAgICAgY2IobnVsbCwgT2JqZWN0LmtleXModGhpcy5fY291bnRDYWNoZSgpKS5sZW5ndGgpO1xuICAgICAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgICAgfSxcbiAgICAgICAgX2R1bXA6IGZ1bmN0aW9uIChhc0pTT04pIHtcbiAgICAgICAgICAgIHZhciBkdW1wZWQgPSB7fTtcbiAgICAgICAgICAgIGR1bXBlZC5uYW1lID0gdGhpcy5uYW1lO1xuICAgICAgICAgICAgZHVtcGVkLmF0dHJpYnV0ZXMgPSB0aGlzLmF0dHJpYnV0ZXM7XG4gICAgICAgICAgICBkdW1wZWQuaWQgPSB0aGlzLmlkO1xuICAgICAgICAgICAgZHVtcGVkLmNvbGxlY3Rpb24gPSB0aGlzLmNvbGxlY3Rpb25OYW1lO1xuICAgICAgICAgICAgZHVtcGVkLnJlbGF0aW9uc2hpcHMgPSBfLm1hcCh0aGlzLnJlbGF0aW9uc2hpcHMsIGZ1bmN0aW9uIChyKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHIuaXNGb3J3YXJkID8gci5mb3J3YXJkTmFtZSA6IHIucmV2ZXJzZU5hbWU7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiBhc0pTT04gPyB1dGlsLnByZXR0eVByaW50KGR1bXBlZCkgOiBkdW1wZWQ7XG4gICAgICAgIH0sXG4gICAgICAgIHRvU3RyaW5nOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gJ01vZGVsWycgKyB0aGlzLm5hbWUgKyAnXSc7XG4gICAgICAgIH1cblxuICAgIH0pO1xuXG4gICAgLy8gU3ViY2xhc3NpbmdcbiAgICBfLmV4dGVuZChNb2RlbC5wcm90b3R5cGUsIHtcbiAgICAgICAgY2hpbGQ6IGZ1bmN0aW9uIChuYW1lT3JPcHRzLCBvcHRzKSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIG5hbWVPck9wdHMgPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICBvcHRzLm5hbWUgPSBuYW1lT3JPcHRzO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBvcHRzID0gbmFtZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIF8uZXh0ZW5kKG9wdHMsIHtcbiAgICAgICAgICAgICAgICBhdHRyaWJ1dGVzOiBBcnJheS5wcm90b3R5cGUuY29uY2F0LmNhbGwob3B0cy5hdHRyaWJ1dGVzIHx8IFtdLCB0aGlzLl9vcHRzLmF0dHJpYnV0ZXMpLFxuICAgICAgICAgICAgICAgIHJlbGF0aW9uc2hpcHM6IF8uZXh0ZW5kKG9wdHMucmVsYXRpb25zaGlwcyB8fCB7fSwgdGhpcy5fb3B0cy5yZWxhdGlvbnNoaXBzKSxcbiAgICAgICAgICAgICAgICBtZXRob2RzOiBfLmV4dGVuZChfLmV4dGVuZCh7fSwgdGhpcy5fb3B0cy5tZXRob2RzKSB8fCB7fSwgb3B0cy5tZXRob2RzKSxcbiAgICAgICAgICAgICAgICBzdGF0aWNzOiBfLmV4dGVuZChfLmV4dGVuZCh7fSwgdGhpcy5fb3B0cy5zdGF0aWNzKSB8fCB7fSwgb3B0cy5zdGF0aWNzKSxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiBfLmV4dGVuZChfLmV4dGVuZCh7fSwgdGhpcy5fb3B0cy5wcm9wZXJ0aWVzKSB8fCB7fSwgb3B0cy5wcm9wZXJ0aWVzKSxcbiAgICAgICAgICAgICAgICBpZDogb3B0cy5pZCB8fCB0aGlzLl9vcHRzLmlkLFxuICAgICAgICAgICAgICAgIGluaXQ6IG9wdHMuaW5pdCB8fCB0aGlzLl9vcHRzLmluaXQsXG4gICAgICAgICAgICAgICAgcmVtb3ZlOiBvcHRzLnJlbW92ZSB8fCB0aGlzLl9vcHRzLnJlbW92ZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB2YXIgbW9kZWwgPSB0aGlzLmNvbGxlY3Rpb24ubW9kZWwob3B0cy5uYW1lLCBvcHRzKTtcbiAgICAgICAgICAgIG1vZGVsLnBhcmVudCA9IHRoaXM7XG4gICAgICAgICAgICB0aGlzLmNoaWxkcmVuLnB1c2gobW9kZWwpO1xuICAgICAgICAgICAgcmV0dXJuIG1vZGVsO1xuICAgICAgICB9LFxuICAgICAgICBpc0NoaWxkT2Y6IGZ1bmN0aW9uIChwYXJlbnQpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnBhcmVudCA9PSBwYXJlbnQ7XG4gICAgICAgIH0sXG4gICAgICAgIGlzUGFyZW50T2Y6IGZ1bmN0aW9uIChjaGlsZCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuY2hpbGRyZW4uaW5kZXhPZihjaGlsZCkgPiAtMTtcbiAgICAgICAgfSxcbiAgICAgICAgaXNEZXNjZW5kYW50T2Y6IGZ1bmN0aW9uIChhbmNlc3Rvcikge1xuICAgICAgICAgICAgdmFyIHBhcmVudCA9IHRoaXMucGFyZW50O1xuICAgICAgICAgICAgd2hpbGUgKHBhcmVudCkge1xuICAgICAgICAgICAgICAgIGlmIChwYXJlbnQgPT0gYW5jZXN0b3IpIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgIHBhcmVudCA9IHBhcmVudC5wYXJlbnQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH0sXG4gICAgICAgIGlzQW5jZXN0b3JPZjogZnVuY3Rpb24gKGRlc2NlbmRhbnQpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmRlc2NlbmRhbnRzLmluZGV4T2YoZGVzY2VuZGFudCkgPiAtMTtcbiAgICAgICAgfSxcbiAgICAgICAgaGFzQXR0cmlidXRlTmFtZWQ6IGZ1bmN0aW9uIChhdHRyaWJ1dGVOYW1lKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fYXR0cmlidXRlTmFtZXMuaW5kZXhPZihhdHRyaWJ1dGVOYW1lKSA+IC0xO1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICBtb2R1bGUuZXhwb3J0cyA9IE1vZGVsO1xuXG59KSgpO1xuIiwiKGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgZXZlbnRzID0gcmVxdWlyZSgnLi9ldmVudHMnKSxcbiAgICAgICAgSW50ZXJuYWxTaWVzdGFFcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKS5JbnRlcm5hbFNpZXN0YUVycm9yLFxuICAgICAgICBsb2cgPSByZXF1aXJlKCcuL2xvZycpKCdldmVudHMnKSxcbiAgICAgICAgZXh0ZW5kID0gcmVxdWlyZSgnLi91dGlsJykuXy5leHRlbmQsXG4gICAgICAgIGNvbGxlY3Rpb25SZWdpc3RyeSA9IHJlcXVpcmUoJy4vY29sbGVjdGlvblJlZ2lzdHJ5JykuQ29sbGVjdGlvblJlZ2lzdHJ5O1xuXG5cbiAgICAvKipcbiAgICAgKiBDb25zdGFudHMgdGhhdCBkZXNjcmliZSBjaGFuZ2UgZXZlbnRzLlxuICAgICAqIFNldCA9PiBBIG5ldyB2YWx1ZSBpcyBhc3NpZ25lZCB0byBhbiBhdHRyaWJ1dGUvcmVsYXRpb25zaGlwXG4gICAgICogU3BsaWNlID0+IEFsbCBqYXZhc2NyaXB0IGFycmF5IG9wZXJhdGlvbnMgYXJlIGRlc2NyaWJlZCBhcyBzcGxpY2VzLlxuICAgICAqIERlbGV0ZSA9PiBVc2VkIGluIHRoZSBjYXNlIHdoZXJlIG9iamVjdHMgYXJlIHJlbW92ZWQgZnJvbSBhbiBhcnJheSwgYnV0IGFycmF5IG9yZGVyIGlzIG5vdCBrbm93biBpbiBhZHZhbmNlLlxuICAgICAqIFJlbW92ZSA9PiBPYmplY3QgZGVsZXRpb24gZXZlbnRzXG4gICAgICogTmV3ID0+IE9iamVjdCBjcmVhdGlvbiBldmVudHNcbiAgICAgKiBAdHlwZSB7T2JqZWN0fVxuICAgICAqL1xuICAgIHZhciBNb2RlbEV2ZW50VHlwZSA9IHtcbiAgICAgICAgICAgIFNldDogJ1NldCcsXG4gICAgICAgICAgICBTcGxpY2U6ICdTcGxpY2UnLFxuICAgICAgICAgICAgTmV3OiAnTmV3JyxcbiAgICAgICAgICAgIFJlbW92ZTogJ1JlbW92ZSdcbiAgICAgICAgfTtcblxuICAgIC8qKlxuICAgICAqIFJlcHJlc2VudHMgYW4gaW5kaXZpZHVhbCBjaGFuZ2UuXG4gICAgICogQHBhcmFtIG9wdHNcbiAgICAgKiBAY29uc3RydWN0b3JcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBNb2RlbEV2ZW50KG9wdHMpIHtcbiAgICAgICAgdGhpcy5fb3B0cyA9IG9wdHMgfHwge307XG4gICAgICAgIE9iamVjdC5rZXlzKG9wdHMpLmZvckVhY2goZnVuY3Rpb24gKGspIHtcbiAgICAgICAgICAgIHRoaXNba10gPSBvcHRzW2tdO1xuICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgIH1cblxuICAgIE1vZGVsRXZlbnQucHJvdG90eXBlLl9kdW1wID0gZnVuY3Rpb24gKHByZXR0eSkge1xuICAgICAgICB2YXIgZHVtcGVkID0ge307XG4gICAgICAgIGR1bXBlZC5jb2xsZWN0aW9uID0gKHR5cGVvZiB0aGlzLmNvbGxlY3Rpb24pID09ICdzdHJpbmcnID8gdGhpcy5jb2xsZWN0aW9uIDogdGhpcy5jb2xsZWN0aW9uLl9kdW1wKCk7XG4gICAgICAgIGR1bXBlZC5tb2RlbCA9ICh0eXBlb2YgdGhpcy5tb2RlbCkgPT0gJ3N0cmluZycgPyB0aGlzLm1vZGVsIDogdGhpcy5tb2RlbC5uYW1lO1xuICAgICAgICBkdW1wZWQuX2lkID0gdGhpcy5faWQ7XG4gICAgICAgIGR1bXBlZC5maWVsZCA9IHRoaXMuZmllbGQ7XG4gICAgICAgIGR1bXBlZC50eXBlID0gdGhpcy50eXBlO1xuICAgICAgICBpZiAodGhpcy5pbmRleCkgZHVtcGVkLmluZGV4ID0gdGhpcy5pbmRleDtcbiAgICAgICAgaWYgKHRoaXMuYWRkZWQpIGR1bXBlZC5hZGRlZCA9IF8ubWFwKHRoaXMuYWRkZWQsIGZ1bmN0aW9uICh4KSB7cmV0dXJuIHguX2R1bXAoKX0pO1xuICAgICAgICBpZiAodGhpcy5yZW1vdmVkKSBkdW1wZWQucmVtb3ZlZCA9IF8ubWFwKHRoaXMucmVtb3ZlZCwgZnVuY3Rpb24gKHgpIHtyZXR1cm4geC5fZHVtcCgpfSk7XG4gICAgICAgIGlmICh0aGlzLm9sZCkgZHVtcGVkLm9sZCA9IHRoaXMub2xkO1xuICAgICAgICBpZiAodGhpcy5uZXcpIGR1bXBlZC5uZXcgPSB0aGlzLm5ldztcbiAgICAgICAgcmV0dXJuIHByZXR0eSA/IHV0aWwucHJldHR5UHJpbnQoZHVtcGVkKSA6IGR1bXBlZDtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogQnJvYWRjYXNcbiAgICAgKiBAcGFyYW0gIHtTdHJpbmd9IGNvbGxlY3Rpb25OYW1lXG4gICAgICogQHBhcmFtICB7U3RyaW5nfSBtb2RlbE5hbWVcbiAgICAgKiBAcGFyYW0gIHtPYmplY3R9IGMgYW4gb3B0aW9ucyBkaWN0aW9uYXJ5IHJlcHJlc2VudGluZyB0aGUgY2hhbmdlXG4gICAgICogQHJldHVybiB7W3R5cGVdfVxuICAgICAqL1xuICAgIGZ1bmN0aW9uIGJyb2FkY2FzdEV2ZW50KGNvbGxlY3Rpb25OYW1lLCBtb2RlbE5hbWUsIGMpIHtcbiAgICAgICAgbG9nKCdTZW5kaW5nIG5vdGlmaWNhdGlvbiBcIicgKyBjb2xsZWN0aW9uTmFtZSArICdcIiBvZiB0eXBlICcgKyBjLnR5cGUpO1xuICAgICAgICBldmVudHMuZW1pdChjb2xsZWN0aW9uTmFtZSwgYyk7XG4gICAgICAgIHZhciBtb2RlbE5vdGlmID0gY29sbGVjdGlvbk5hbWUgKyAnOicgKyBtb2RlbE5hbWU7XG4gICAgICAgIGxvZygnU2VuZGluZyBub3RpZmljYXRpb24gXCInICsgbW9kZWxOb3RpZiArICdcIiBvZiB0eXBlICcgKyBjLnR5cGUpO1xuICAgICAgICBldmVudHMuZW1pdChtb2RlbE5vdGlmLCBjKTtcbiAgICAgICAgdmFyIGdlbmVyaWNOb3RpZiA9ICdTaWVzdGEnO1xuICAgICAgICBsb2coJ1NlbmRpbmcgbm90aWZpY2F0aW9uIFwiJyArIGdlbmVyaWNOb3RpZiArICdcIiBvZiB0eXBlICcgKyBjLnR5cGUpO1xuICAgICAgICBldmVudHMuZW1pdChnZW5lcmljTm90aWYsIGMpO1xuICAgICAgICB2YXIgbG9jYWxJZE5vdGlmID0gYy5faWQ7XG4gICAgICAgIGxvZygnU2VuZGluZyBub3RpZmljYXRpb24gXCInICsgbG9jYWxJZE5vdGlmICsgJ1wiIG9mIHR5cGUgJyArIGMudHlwZSk7XG4gICAgICAgIGV2ZW50cy5lbWl0KGxvY2FsSWROb3RpZiwgYyk7XG4gICAgICAgIHZhciBjb2xsZWN0aW9uID0gY29sbGVjdGlvblJlZ2lzdHJ5W2NvbGxlY3Rpb25OYW1lXTtcbiAgICAgICAgdmFyIGVycjtcbiAgICAgICAgaWYgKCFjb2xsZWN0aW9uKSB7XG4gICAgICAgICAgICBlcnIgPSAnTm8gc3VjaCBjb2xsZWN0aW9uIFwiJyArIGNvbGxlY3Rpb25OYW1lICsgJ1wiJztcbiAgICAgICAgICAgIGxvZyhlcnIsIGNvbGxlY3Rpb25SZWdpc3RyeSk7XG4gICAgICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcihlcnIpO1xuICAgICAgICB9XG4gICAgICAgIHZhciBtb2RlbCA9IGNvbGxlY3Rpb25bbW9kZWxOYW1lXTtcbiAgICAgICAgaWYgKCFtb2RlbCkge1xuICAgICAgICAgICAgZXJyID0gJ05vIHN1Y2ggbW9kZWwgXCInICsgbW9kZWxOYW1lICsgJ1wiJztcbiAgICAgICAgICAgIGxvZyhlcnIsIGNvbGxlY3Rpb25SZWdpc3RyeSk7XG4gICAgICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcihlcnIpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChtb2RlbC5pZCAmJiBjLm9ialttb2RlbC5pZF0pIHtcbiAgICAgICAgICAgIHZhciByZW1vdGVJZE5vdGlmID0gY29sbGVjdGlvbk5hbWUgKyAnOicgKyBtb2RlbE5hbWUgKyAnOicgKyBjLm9ialttb2RlbC5pZF07XG4gICAgICAgICAgICBsb2coJ1NlbmRpbmcgbm90aWZpY2F0aW9uIFwiJyArIHJlbW90ZUlkTm90aWYgKyAnXCIgb2YgdHlwZSAnICsgYy50eXBlKTtcbiAgICAgICAgICAgIGV2ZW50cy5lbWl0KHJlbW90ZUlkTm90aWYsIGMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gdmFsaWRhdGVFdmVudE9wdHMob3B0cykge1xuICAgICAgICBpZiAoIW9wdHMubW9kZWwpIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdNdXN0IHBhc3MgYSBtb2RlbCcpO1xuICAgICAgICBpZiAoIW9wdHMuY29sbGVjdGlvbikgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ011c3QgcGFzcyBhIGNvbGxlY3Rpb24nKTtcbiAgICAgICAgaWYgKCFvcHRzLl9pZCkgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ011c3QgcGFzcyBhIGxvY2FsIGlkZW50aWZpZXInKTtcbiAgICAgICAgaWYgKCFvcHRzLm9iaikgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ011c3QgcGFzcyB0aGUgb2JqZWN0Jyk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZW1pdChvcHRzKSB7XG4gICAgICAgIHZhbGlkYXRlRXZlbnRPcHRzKG9wdHMpO1xuICAgICAgICB2YXIgY29sbGVjdGlvbiA9IG9wdHMuY29sbGVjdGlvbjtcbiAgICAgICAgdmFyIG1vZGVsID0gb3B0cy5tb2RlbDtcbiAgICAgICAgdmFyIGMgPSBuZXcgTW9kZWxFdmVudChvcHRzKTtcbiAgICAgICAgYnJvYWRjYXN0RXZlbnQoY29sbGVjdGlvbiwgbW9kZWwsIGMpO1xuICAgICAgICByZXR1cm4gYztcbiAgICB9XG5cbiAgICBleHRlbmQoZXhwb3J0cywge1xuICAgICAgICBNb2RlbEV2ZW50OiBNb2RlbEV2ZW50LFxuICAgICAgICBlbWl0OiBlbWl0LFxuICAgICAgICB2YWxpZGF0ZUV2ZW50T3B0czogdmFsaWRhdGVFdmVudE9wdHMsXG4gICAgICAgIE1vZGVsRXZlbnRUeXBlOiBNb2RlbEV2ZW50VHlwZVxuICAgIH0pO1xufSkoKTsiLCIvKipcbiAqIFRoZSBcInN0b3JlXCIgaXMgcmVzcG9uc2libGUgZm9yIG1lZGlhdGluZyBiZXR3ZWVuIHRoZSBpbi1tZW1vcnkgY2FjaGUgYW5kIGFueSBwZXJzaXN0ZW50IHN0b3JhZ2UuXG4gKiBOb3RlIHRoYXQgcGVyc2lzdGVudCBzdG9yYWdlIGhhcyBub3QgYmVlbiBwcm9wZXJseSBpbXBsZW1lbnRlZCB5ZXQgYW5kIHNvIHRoaXMgaXMgcHJldHR5IHVzZWxlc3MuXG4gKiBBbGwgcXVlcmllcyB3aWxsIGdvIHN0cmFpZ2h0IHRvIHRoZSBjYWNoZSBpbnN0ZWFkLlxuICogQG1vZHVsZSBzdG9yZVxuICovXG5cblxuKGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgSW50ZXJuYWxTaWVzdGFFcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKS5JbnRlcm5hbFNpZXN0YUVycm9yLFxuICAgICAgICBsb2cgPSByZXF1aXJlKCcuL2xvZycpKCdzdG9yZScpLFxuICAgICAgICB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyksXG4gICAgICAgIF8gPSB1dGlsLl8sXG4gICAgICAgIGNhY2hlID0gcmVxdWlyZSgnLi9jYWNoZScpO1xuXG5cbiAgICBmdW5jdGlvbiBnZXQob3B0cywgY2IpIHtcbiAgICAgICAgbG9nKCdnZXQnLCBvcHRzKTtcbiAgICAgICAgdmFyIHNpZXN0YU1vZGVsO1xuICAgICAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbiAoY2IpIHtcbiAgICAgICAgICAgIGlmIChvcHRzLl9pZCkge1xuICAgICAgICAgICAgICAgIGlmICh1dGlsLmlzQXJyYXkob3B0cy5faWQpKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFByb3h5IG9udG8gZ2V0TXVsdGlwbGUgaW5zdGVhZC5cbiAgICAgICAgICAgICAgICAgICAgZ2V0TXVsdGlwbGUoXy5tYXAob3B0cy5faWQsIGZ1bmN0aW9uIChpZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBfaWQ6IGlkXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0pLCBjYik7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgc2llc3RhTW9kZWwgPSBjYWNoZS5nZXQob3B0cyk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChzaWVzdGFNb2RlbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGxvZy5lbmFibGVkKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZygnSGFkIGNhY2hlZCBvYmplY3QnLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9wdHM6IG9wdHMsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9iajogc2llc3RhTW9kZWxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjYikgY2IobnVsbCwgc2llc3RhTW9kZWwpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHV0aWwuaXNBcnJheShvcHRzLl9pZCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBQcm94eSBvbnRvIGdldE11bHRpcGxlIGluc3RlYWQuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZ2V0TXVsdGlwbGUoXy5tYXAob3B0cy5faWQsIGZ1bmN0aW9uIChpZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgX2lkOiBpZFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSksIGNiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoY2IpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgc3RvcmFnZSA9IHNpZXN0YS5leHQuc3RvcmFnZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoc3RvcmFnZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdG9yYWdlLnN0b3JlLmdldEZyb21Qb3VjaChvcHRzLCBjYik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdTdG9yYWdlIG1vZHVsZSBub3QgaW5zdGFsbGVkJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmIChvcHRzLm1vZGVsKSB7XG4gICAgICAgICAgICAgICAgaWYgKHV0aWwuaXNBcnJheShvcHRzW29wdHMubW9kZWwuaWRdKSkge1xuICAgICAgICAgICAgICAgICAgICAvLyBQcm94eSBvbnRvIGdldE11bHRpcGxlIGluc3RlYWQuXG4gICAgICAgICAgICAgICAgICAgIGdldE11bHRpcGxlKF8ubWFwKG9wdHNbb3B0cy5tb2RlbC5pZF0sIGZ1bmN0aW9uIChpZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG8gPSB7fTtcbiAgICAgICAgICAgICAgICAgICAgICAgIG9bb3B0cy5tb2RlbC5pZF0gPSBpZDtcbiAgICAgICAgICAgICAgICAgICAgICAgIG8ubW9kZWwgPSBvcHRzLm1vZGVsO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9cbiAgICAgICAgICAgICAgICAgICAgfSksIGNiKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBzaWVzdGFNb2RlbCA9IGNhY2hlLmdldChvcHRzKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHNpZXN0YU1vZGVsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobG9nLmVuYWJsZWQpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nKCdIYWQgY2FjaGVkIG9iamVjdCcsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb3B0czogb3B0cyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb2JqOiBzaWVzdGFNb2RlbFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGNiKSBjYihudWxsLCBzaWVzdGFNb2RlbCk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgbW9kZWwgPSBvcHRzLm1vZGVsO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG1vZGVsLnNpbmdsZXRvbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1vZGVsLm9uZShjYik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBpZEZpZWxkID0gbW9kZWwuaWQ7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGlkID0gb3B0c1tpZEZpZWxkXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgb25lT3B0cyA9IHt9O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9uZU9wdHNbaWRGaWVsZF0gPSBpZDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoaWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbW9kZWwub25lKG9uZU9wdHMsIGZ1bmN0aW9uIChlcnIsIG9iaikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAob2JqKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNiKG51bGwsIG9iaik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2IobnVsbCwgbnVsbCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYihlcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignSW52YWxpZCBvcHRpb25zIGdpdmVuIHRvIHN0b3JlLiBNaXNzaW5nIFwiJyArIGlkRmllbGQudG9TdHJpbmcoKSArICcuXCInKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gTm8gd2F5IGluIHdoaWNoIHRvIGZpbmQgYW4gb2JqZWN0IGxvY2FsbHkuXG4gICAgICAgICAgICAgICAgdmFyIGNvbnRleHQgPSB7XG4gICAgICAgICAgICAgICAgICAgIG9wdHM6IG9wdHNcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIHZhciBtc2cgPSAnSW52YWxpZCBvcHRpb25zIGdpdmVuIHRvIHN0b3JlJztcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcihtc2csIGNvbnRleHQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGdldE11bHRpcGxlKG9wdHNBcnJheSwgY2IpIHtcbiAgICAgICAgcmV0dXJuIHV0aWwucHJvbWlzZShjYiwgZnVuY3Rpb24gKGNiKSB7XG4gICAgICAgICAgICB2YXIgZG9jcyA9IFtdO1xuICAgICAgICAgICAgdmFyIGVycm9ycyA9IFtdO1xuICAgICAgICAgICAgXy5lYWNoKG9wdHNBcnJheSwgZnVuY3Rpb24gKG9wdHMpIHtcbiAgICAgICAgICAgICAgICBnZXQob3B0cywgZnVuY3Rpb24gKGVyciwgZG9jKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVycm9ycy5wdXNoKGVycik7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkb2NzLnB1c2goZG9jKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAoZG9jcy5sZW5ndGggKyBlcnJvcnMubGVuZ3RoID09IG9wdHNBcnJheS5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjYikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlcnJvcnMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNiKGVycm9ycyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2IobnVsbCwgZG9jcyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBVc2VzIHBvdWNoIGJ1bGsgZmV0Y2ggQVBJLiBNdWNoIGZhc3RlciB0aGFuIGdldE11bHRpcGxlLlxuICAgICAqIEBwYXJhbSBsb2NhbElkZW50aWZpZXJzXG4gICAgICogQHBhcmFtIGNiXG4gICAgICovXG4gICAgZnVuY3Rpb24gZ2V0TXVsdGlwbGVMb2NhbChsb2NhbElkZW50aWZpZXJzLCBjYikge1xuICAgICAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbiAoY2IpIHtcbiAgICAgICAgICAgIHZhciByZXN1bHRzID0gXy5yZWR1Y2UobG9jYWxJZGVudGlmaWVycywgZnVuY3Rpb24gKG1lbW8sIF9pZCkge1xuICAgICAgICAgICAgICAgIHZhciBvYmogPSBjYWNoZS5nZXQoe1xuICAgICAgICAgICAgICAgICAgICBfaWQ6IF9pZFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGlmIChvYmopIHtcbiAgICAgICAgICAgICAgICAgICAgbWVtby5jYWNoZWRbX2lkXSA9IG9iajtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBtZW1vLm5vdENhY2hlZC5wdXNoKF9pZCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiBtZW1vO1xuICAgICAgICAgICAgfSwge1xuICAgICAgICAgICAgICAgIGNhY2hlZDoge30sXG4gICAgICAgICAgICAgICAgbm90Q2FjaGVkOiBbXVxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIGZ1bmN0aW9uIGZpbmlzaChlcnIpIHtcbiAgICAgICAgICAgICAgICBpZiAoY2IpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgY2IoZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNiKG51bGwsIF8ubWFwKGxvY2FsSWRlbnRpZmllcnMsIGZ1bmN0aW9uIChfaWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gcmVzdWx0cy5jYWNoZWRbX2lkXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZmluaXNoKCk7XG4gICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZ2V0TXVsdGlwbGVSZW1vdGUocmVtb3RlSWRlbnRpZmllcnMsIG1vZGVsLCBjYikge1xuICAgICAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbiAoY2IpIHtcbiAgICAgICAgICAgIHZhciByZXN1bHRzID0gXy5yZWR1Y2UocmVtb3RlSWRlbnRpZmllcnMsIGZ1bmN0aW9uIChtZW1vLCBpZCkge1xuICAgICAgICAgICAgICAgIHZhciBjYWNoZVF1ZXJ5ID0ge1xuICAgICAgICAgICAgICAgICAgICBtb2RlbDogbW9kZWxcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIGNhY2hlUXVlcnlbbW9kZWwuaWRdID0gaWQ7XG4gICAgICAgICAgICAgICAgdmFyIG9iaiA9IGNhY2hlLmdldChjYWNoZVF1ZXJ5KTtcbiAgICAgICAgICAgICAgICBpZiAob2JqKSB7XG4gICAgICAgICAgICAgICAgICAgIG1lbW8uY2FjaGVkW2lkXSA9IG9iajtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBtZW1vLm5vdENhY2hlZC5wdXNoKGlkKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIG1lbW87XG4gICAgICAgICAgICB9LCB7XG4gICAgICAgICAgICAgICAgY2FjaGVkOiB7fSxcbiAgICAgICAgICAgICAgICBub3RDYWNoZWQ6IFtdXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgZnVuY3Rpb24gZmluaXNoKGVycikge1xuICAgICAgICAgICAgICAgIGlmIChjYikge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjYihlcnIpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgY2IobnVsbCwgXy5tYXAocmVtb3RlSWRlbnRpZmllcnMsIGZ1bmN0aW9uIChpZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiByZXN1bHRzLmNhY2hlZFtpZF07XG4gICAgICAgICAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGZpbmlzaCgpO1xuICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgIH1cblxuICAgIG1vZHVsZS5leHBvcnRzID0ge1xuICAgICAgICBnZXQ6IGdldCxcbiAgICAgICAgZ2V0TXVsdGlwbGU6IGdldE11bHRpcGxlLFxuICAgICAgICBnZXRNdWx0aXBsZUxvY2FsOiBnZXRNdWx0aXBsZUxvY2FsLFxuICAgICAgICBnZXRNdWx0aXBsZVJlbW90ZTogZ2V0TXVsdGlwbGVSZW1vdGVcbiAgICB9O1xuXG59KSgpOyIsIihmdW5jdGlvbiAoKSB7XG4gICAgdmFyIG1pc2MgPSByZXF1aXJlKCcuL21pc2MnKSxcbiAgICAgICAgXyA9IHJlcXVpcmUoJy4vdW5kZXJzY29yZScpO1xuXG4gICAgZnVuY3Rpb24gZG9QYXJhbGxlbChmbikge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuICAgICAgICAgICAgcmV0dXJuIGZuLmFwcGx5KG51bGwsIFtlYWNoXS5jb25jYXQoYXJncykpO1xuICAgICAgICB9O1xuICAgIH1cblxuICAgIHZhciBtYXAgPSBkb1BhcmFsbGVsKF9hc3luY01hcCk7XG5cbiAgICB2YXIgcm9vdDtcblxuICAgIGZ1bmN0aW9uIF9tYXAoYXJyLCBpdGVyYXRvcikge1xuICAgICAgICBpZiAoYXJyLm1hcCkge1xuICAgICAgICAgICAgcmV0dXJuIGFyci5tYXAoaXRlcmF0b3IpO1xuICAgICAgICB9XG4gICAgICAgIHZhciByZXN1bHRzID0gW107XG4gICAgICAgIGVhY2goYXJyLCBmdW5jdGlvbiAoeCwgaSwgYSkge1xuICAgICAgICAgICAgcmVzdWx0cy5wdXNoKGl0ZXJhdG9yKHgsIGksIGEpKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiByZXN1bHRzO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIF9hc3luY01hcChlYWNoZm4sIGFyciwgaXRlcmF0b3IsIGNhbGxiYWNrKSB7XG4gICAgICAgIGFyciA9IF9tYXAoYXJyLCBmdW5jdGlvbiAoeCwgaSkge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBpbmRleDogaSxcbiAgICAgICAgICAgICAgICB2YWx1ZTogeFxuICAgICAgICAgICAgfTtcbiAgICAgICAgfSk7XG4gICAgICAgIGlmICghY2FsbGJhY2spIHtcbiAgICAgICAgICAgIGVhY2hmbihhcnIsIGZ1bmN0aW9uICh4LCBjYWxsYmFjaykge1xuICAgICAgICAgICAgICAgIGl0ZXJhdG9yKHgudmFsdWUsIGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdmFyIHJlc3VsdHMgPSBbXTtcbiAgICAgICAgICAgIGVhY2hmbihhcnIsIGZ1bmN0aW9uICh4LCBjYWxsYmFjaykge1xuICAgICAgICAgICAgICAgIGl0ZXJhdG9yKHgudmFsdWUsIGZ1bmN0aW9uIChlcnIsIHYpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0c1t4LmluZGV4XSA9IHY7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9LCBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyLCByZXN1bHRzKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgdmFyIG1hcFNlcmllcyA9IGRvU2VyaWVzKF9hc3luY01hcCk7XG5cbiAgICBmdW5jdGlvbiBkb1Nlcmllcyhmbikge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuICAgICAgICAgICAgcmV0dXJuIGZuLmFwcGx5KG51bGwsIFtlYWNoU2VyaWVzXS5jb25jYXQoYXJncykpO1xuICAgICAgICB9O1xuICAgIH1cblxuXG4gICAgZnVuY3Rpb24gZWFjaFNlcmllcyhhcnIsIGl0ZXJhdG9yLCBjYWxsYmFjaykge1xuICAgICAgICBjYWxsYmFjayA9IGNhbGxiYWNrIHx8IGZ1bmN0aW9uICgpIHt9O1xuICAgICAgICBpZiAoIWFyci5sZW5ndGgpIHtcbiAgICAgICAgICAgIHJldHVybiBjYWxsYmFjaygpO1xuICAgICAgICB9XG4gICAgICAgIHZhciBjb21wbGV0ZWQgPSAwO1xuICAgICAgICB2YXIgaXRlcmF0ZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGl0ZXJhdG9yKGFycltjb21wbGV0ZWRdLCBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayA9IGZ1bmN0aW9uICgpIHt9O1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbXBsZXRlZCArPSAxO1xuICAgICAgICAgICAgICAgICAgICBpZiAoY29tcGxldGVkID49IGFyci5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKCk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpdGVyYXRlKCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfTtcbiAgICAgICAgaXRlcmF0ZSgpO1xuICAgIH1cblxuXG4gICAgZnVuY3Rpb24gX2VhY2goYXJyLCBpdGVyYXRvcikge1xuICAgICAgICBpZiAoYXJyLmZvckVhY2gpIHtcbiAgICAgICAgICAgIHJldHVybiBhcnIuZm9yRWFjaChpdGVyYXRvcik7XG4gICAgICAgIH1cbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBhcnIubGVuZ3RoOyBpICs9IDEpIHtcbiAgICAgICAgICAgIGl0ZXJhdG9yKGFycltpXSwgaSwgYXJyKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGVhY2goYXJyLCBpdGVyYXRvciwgY2FsbGJhY2spIHtcbiAgICAgICAgY2FsbGJhY2sgPSBjYWxsYmFjayB8fCBmdW5jdGlvbiAoKSB7fTtcbiAgICAgICAgaWYgKCFhcnIubGVuZ3RoKSB7XG4gICAgICAgICAgICByZXR1cm4gY2FsbGJhY2soKTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgY29tcGxldGVkID0gMDtcbiAgICAgICAgX2VhY2goYXJyLCBmdW5jdGlvbiAoeCkge1xuICAgICAgICAgICAgaXRlcmF0b3IoeCwgb25seV9vbmNlKGRvbmUpKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgZnVuY3Rpb24gZG9uZShlcnIpIHtcbiAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrID0gZnVuY3Rpb24gKCkge307XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbXBsZXRlZCArPSAxO1xuICAgICAgICAgICAgICAgIGlmIChjb21wbGV0ZWQgPj0gYXJyLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuXG5cblxuICAgIHZhciBfcGFyYWxsZWwgPSBmdW5jdGlvbiAoZWFjaGZuLCB0YXNrcywgY2FsbGJhY2spIHtcbiAgICAgICAgY2FsbGJhY2sgPSBjYWxsYmFjayB8fCBmdW5jdGlvbiAoKSB7fTtcbiAgICAgICAgaWYgKG1pc2MuaXNBcnJheSh0YXNrcykpIHtcbiAgICAgICAgICAgIGVhY2hmbi5tYXAodGFza3MsIGZ1bmN0aW9uIChmbiwgY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICBpZiAoZm4pIHtcbiAgICAgICAgICAgICAgICAgICAgZm4oZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGFyZ3MubGVuZ3RoIDw9IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhcmdzID0gYXJnc1swXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrLmNhbGwobnVsbCwgZXJyLCBhcmdzKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSwgY2FsbGJhY2spO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdmFyIHJlc3VsdHMgPSB7fTtcbiAgICAgICAgICAgIGVhY2hmbi5lYWNoKE9iamVjdC5rZXlzKHRhc2tzKSwgZnVuY3Rpb24gKGssIGNhbGxiYWNrKSB7XG4gICAgICAgICAgICAgICAgdGFza3Nba10oZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgICAgICAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChhcmdzLmxlbmd0aCA8PSAxKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhcmdzID0gYXJnc1swXTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXN1bHRzW2tdID0gYXJncztcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0sIGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIsIHJlc3VsdHMpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgZnVuY3Rpb24gc2VyaWVzKHRhc2tzLCBjYWxsYmFjaykge1xuICAgICAgICBjYWxsYmFjayA9IGNhbGxiYWNrIHx8IGZ1bmN0aW9uICgpIHt9O1xuICAgICAgICBpZiAobWlzYy5pc0FycmF5KHRhc2tzKSkge1xuICAgICAgICAgICAgbWFwU2VyaWVzKHRhc2tzLCBmdW5jdGlvbiAoZm4sIGNhbGxiYWNrKSB7XG4gICAgICAgICAgICAgICAgaWYgKGZuKSB7XG4gICAgICAgICAgICAgICAgICAgIGZuKGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChhcmdzLmxlbmd0aCA8PSAxKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYXJncyA9IGFyZ3NbMF07XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjay5jYWxsKG51bGwsIGVyciwgYXJncyk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sIGNhbGxiYWNrKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHZhciByZXN1bHRzID0ge307XG4gICAgICAgICAgICBlYWNoU2VyaWVzKF8ua2V5cyh0YXNrcyksIGZ1bmN0aW9uIChrLCBjYWxsYmFjaykge1xuICAgICAgICAgICAgICAgIHRhc2tzW2tdKGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoYXJncy5sZW5ndGggPD0gMSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgYXJncyA9IGFyZ3NbMF07XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0c1trXSA9IGFyZ3M7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9LCBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyLCByZXN1bHRzKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gb25seV9vbmNlKGZuKSB7XG4gICAgICAgIHZhciBjYWxsZWQgPSBmYWxzZTtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGlmIChjYWxsZWQpIHRocm93IG5ldyBFcnJvcihcIkNhbGxiYWNrIHdhcyBhbHJlYWR5IGNhbGxlZC5cIik7XG4gICAgICAgICAgICBjYWxsZWQgPSB0cnVlO1xuICAgICAgICAgICAgZm4uYXBwbHkocm9vdCwgYXJndW1lbnRzKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBhcmFsbGVsKHRhc2tzLCBjYWxsYmFjaykge1xuICAgICAgICBfcGFyYWxsZWwoe1xuICAgICAgICAgICAgbWFwOiBtYXAsXG4gICAgICAgICAgICBlYWNoOiBlYWNoXG4gICAgICAgIH0sIHRhc2tzLCBjYWxsYmFjayk7XG4gICAgfVxuXG4gICAgbW9kdWxlLmV4cG9ydHMgPSB7XG4gICAgICAgIHNlcmllczogc2VyaWVzLFxuICAgICAgICBwYXJhbGxlbDogcGFyYWxsZWxcbiAgICB9O1xufSkoKTsiLCIvKlxuICogVGhpcyBpcyBhIGNvbGxlY3Rpb24gb2YgdXRpbGl0aWVzIHRha2VuIGZyb20gbGlicmFyaWVzIHN1Y2ggYXMgYXN5bmMuanMsIHVuZGVyc2NvcmUuanMgZXRjLlxuICogQG1vZHVsZSB1dGlsXG4gKi9cblxuKGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgXyA9IHJlcXVpcmUoJy4vdW5kZXJzY29yZScpLFxuICAgICAgICBhc3luYyA9IHJlcXVpcmUoJy4vYXN5bmMnKSxcbiAgICAgICAgbWlzYyA9IHJlcXVpcmUoJy4vbWlzYycpO1xuXG4gICAgXy5leHRlbmQobW9kdWxlLmV4cG9ydHMsIHtcbiAgICAgICAgXzogXyxcbiAgICAgICAgYXN5bmM6IGFzeW5jXG4gICAgfSk7XG4gICAgXy5leHRlbmQobW9kdWxlLmV4cG9ydHMsIG1pc2MpO1xuXG59KSgpOyIsIihmdW5jdGlvbiAoKSB7XG4gICAgdmFyIG9ic2VydmUgPSByZXF1aXJlKCcuLi8uLi92ZW5kb3Ivb2JzZXJ2ZS1qcy9zcmMvb2JzZXJ2ZScpLlBsYXRmb3JtLFxuICAgICAgICBfID0gcmVxdWlyZSgnLi91bmRlcnNjb3JlJyksXG4gICAgICAgIFByb21pc2UgPSByZXF1aXJlKCdsaWUnKSxcbiAgICAgICAgYXJnc2FycmF5ID0gcmVxdWlyZSgnYXJnc2FycmF5JyksXG4gICAgICAgIEludGVybmFsU2llc3RhRXJyb3IgPSByZXF1aXJlKCcuLy4uL2Vycm9yJykuSW50ZXJuYWxTaWVzdGFFcnJvcjtcblxuICAgIC8vIFVzZWQgYnkgcGFyYW1OYW1lcyBmdW5jdGlvbi5cbiAgICB2YXIgRk5fQVJHUyA9IC9eZnVuY3Rpb25cXHMqW15cXChdKlxcKFxccyooW15cXCldKilcXCkvbSxcbiAgICAgICAgRk5fQVJHX1NQTElUID0gLywvLFxuICAgICAgICBGTl9BUkcgPSAvXlxccyooXz8pKC4rPylcXDFcXHMqJC8sXG4gICAgICAgIFNUUklQX0NPTU1FTlRTID0gLygoXFwvXFwvLiokKXwoXFwvXFwqW1xcc1xcU10qP1xcKlxcLykpL21nO1xuXG4gICAgZnVuY3Rpb24gY2IoY2FsbGJhY2ssIGRlZmVycmVkKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrLmFwcGx5KGNhbGxiYWNrLCBhcmd1bWVudHMpO1xuICAgICAgICAgICAgaWYgKGRlZmVycmVkKSB7XG4gICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICBkZWZlcnJlZC5yZWplY3QoZXJyKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGRlZmVycmVkLnJlc29sdmUuYXBwbHkoZGVmZXJyZWQsIEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICB2YXIgaXNBcnJheVNoaW0gPSBmdW5jdGlvbiAob2JqKSB7XG4gICAgICAgICAgICByZXR1cm4gXy50b1N0cmluZy5jYWxsKG9iaikgPT09ICdbb2JqZWN0IEFycmF5XSc7XG4gICAgICAgIH0sXG4gICAgICAgIGlzQXJyYXkgPSBBcnJheS5pc0FycmF5IHx8IGlzQXJyYXlTaGltLFxuICAgICAgICBpc1N0cmluZyA9IGZ1bmN0aW9uIChvKSB7XG4gICAgICAgICAgICByZXR1cm4gdHlwZW9mIG8gPT0gJ3N0cmluZycgfHwgbyBpbnN0YW5jZW9mIFN0cmluZ1xuICAgICAgICB9O1xuICAgIF8uZXh0ZW5kKG1vZHVsZS5leHBvcnRzLCB7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBQZXJmb3JtcyBkaXJ0eSBjaGVjay9PYmplY3Qub2JzZXJ2ZSBjYWxsYmFja3MgZGVwZW5kaW5nIG9uIHRoZSBicm93c2VyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBJZiBPYmplY3Qub2JzZXJ2ZSBpcyBwcmVzZW50LFxuICAgICAgICAgKiBAcGFyYW0gY2FsbGJhY2tcbiAgICAgICAgICovXG4gICAgICAgIG5leHQ6IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgICAgICAgICAgb2JzZXJ2ZS5wZXJmb3JtTWljcm90YXNrQ2hlY2twb2ludCgpO1xuICAgICAgICAgICAgc2V0VGltZW91dChjYWxsYmFjayk7XG4gICAgICAgIH0sXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBSZXR1cm5zIGEgaGFuZGxlciB0aGF0IGFjdHMgdXBvbiBhIGNhbGxiYWNrIG9yIGEgcHJvbWlzZSBkZXBlbmRpbmcgb24gdGhlIHJlc3VsdCBvZiBhIGRpZmZlcmVudCBjYWxsYmFjay5cbiAgICAgICAgICogQHBhcmFtIGNhbGxiYWNrXG4gICAgICAgICAqIEBwYXJhbSBbZGVmZXJyZWRdXG4gICAgICAgICAqIEByZXR1cm5zIHtGdW5jdGlvbn1cbiAgICAgICAgICovXG4gICAgICAgIGNiOiBjYixcbiAgICAgICAgZ3VpZDogKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGZ1bmN0aW9uIHM0KCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBNYXRoLmZsb29yKCgxICsgTWF0aC5yYW5kb20oKSkgKiAweDEwMDAwKVxuICAgICAgICAgICAgICAgICAgICAudG9TdHJpbmcoMTYpXG4gICAgICAgICAgICAgICAgICAgIC5zdWJzdHJpbmcoMSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHM0KCkgKyBzNCgpICsgJy0nICsgczQoKSArICctJyArIHM0KCkgKyAnLScgK1xuICAgICAgICAgICAgICAgICAgICBzNCgpICsgJy0nICsgczQoKSArIHM0KCkgKyBzNCgpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfSkoKSxcbiAgICAgICAgYXNzZXJ0OiBmdW5jdGlvbiAoY29uZGl0aW9uLCBtZXNzYWdlLCBjb250ZXh0KSB7XG4gICAgICAgICAgICBpZiAoIWNvbmRpdGlvbikge1xuICAgICAgICAgICAgICAgIG1lc3NhZ2UgPSBtZXNzYWdlIHx8IFwiQXNzZXJ0aW9uIGZhaWxlZFwiO1xuICAgICAgICAgICAgICAgIGNvbnRleHQgPSBjb250ZXh0IHx8IHt9O1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKG1lc3NhZ2UsIGNvbnRleHQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB0aGVuQnk6IChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAvKiBtaXhpbiBmb3IgdGhlIGB0aGVuQnlgIHByb3BlcnR5ICovXG4gICAgICAgICAgICBmdW5jdGlvbiBleHRlbmQoZikge1xuICAgICAgICAgICAgICAgIGYudGhlbkJ5ID0gdGI7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGY7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8qIGFkZHMgYSBzZWNvbmRhcnkgY29tcGFyZSBmdW5jdGlvbiB0byB0aGUgdGFyZ2V0IGZ1bmN0aW9uIChgdGhpc2AgY29udGV4dClcbiAgICAgICAgICAgICB3aGljaCBpcyBhcHBsaWVkIGluIGNhc2UgdGhlIGZpcnN0IG9uZSByZXR1cm5zIDAgKGVxdWFsKVxuICAgICAgICAgICAgIHJldHVybnMgYSBuZXcgY29tcGFyZSBmdW5jdGlvbiwgd2hpY2ggaGFzIGEgYHRoZW5CeWAgbWV0aG9kIGFzIHdlbGwgKi9cbiAgICAgICAgICAgIGZ1bmN0aW9uIHRiKHkpIHtcbiAgICAgICAgICAgICAgICB2YXIgeCA9IHRoaXM7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGV4dGVuZChmdW5jdGlvbiAoYSwgYikge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4geChhLCBiKSB8fCB5KGEsIGIpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gZXh0ZW5kO1xuICAgICAgICB9KSgpLFxuICAgICAgICBkZWZpbmVTdWJQcm9wZXJ0eTogZnVuY3Rpb24gKHByb3BlcnR5LCBzdWJPYmosIGlubmVyUHJvcGVydHkpIHtcbiAgICAgICAgICAgIHJldHVybiBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgcHJvcGVydHksIHtcbiAgICAgICAgICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGlubmVyUHJvcGVydHkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBzdWJPYmpbaW5uZXJQcm9wZXJ0eV07XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gc3ViT2JqW3Byb3BlcnR5XTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgc2V0OiBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGlubmVyUHJvcGVydHkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHN1Yk9ialtpbm5lclByb3BlcnR5XSA9IHZhbHVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3ViT2JqW3Byb3BlcnR5XSA9IHZhbHVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0sXG4gICAgICAgIGRlZmluZVN1YlByb3BlcnR5Tm9TZXQ6IGZ1bmN0aW9uIChwcm9wZXJ0eSwgc3ViT2JqLCBpbm5lclByb3BlcnR5KSB7XG4gICAgICAgICAgICByZXR1cm4gT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsIHByb3BlcnR5LCB7XG4gICAgICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChpbm5lclByb3BlcnR5KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gc3ViT2JqW2lubmVyUHJvcGVydHldO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHN1Yk9ialtwcm9wZXJ0eV07XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgICAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSxcbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRPRE86IFRoaXMgaXMgYmxvb2R5IHVnbHkuXG4gICAgICAgICAqIFByZXR0eSBkYW1uIHVzZWZ1bCB0byBiZSBhYmxlIHRvIGFjY2VzcyB0aGUgYm91bmQgb2JqZWN0IG9uIGEgZnVuY3Rpb24gdGhvLlxuICAgICAgICAgKiBTZWU6IGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9xdWVzdGlvbnMvMTQzMDcyNjQvd2hhdC1vYmplY3QtamF2YXNjcmlwdC1mdW5jdGlvbi1pcy1ib3VuZC10by13aGF0LWlzLWl0cy10aGlzXG4gICAgICAgICAqL1xuICAgICAgICBfcGF0Y2hCaW5kOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB2YXIgX2JpbmQgPSBGdW5jdGlvbi5wcm90b3R5cGUuYXBwbHkuYmluZChGdW5jdGlvbi5wcm90b3R5cGUuYmluZCk7XG4gICAgICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoRnVuY3Rpb24ucHJvdG90eXBlLCAnYmluZCcsIHtcbiAgICAgICAgICAgICAgICB2YWx1ZTogZnVuY3Rpb24gKG9iaikge1xuICAgICAgICAgICAgICAgICAgICB2YXIgYm91bmRGdW5jdGlvbiA9IF9iaW5kKHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgICAgICAgICAgICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShib3VuZEZ1bmN0aW9uLCAnX19zaWVzdGFfYm91bmRfb2JqZWN0Jywge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWU6IG9iaixcbiAgICAgICAgICAgICAgICAgICAgICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgZW51bWVyYWJsZTogZmFsc2VcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBib3VuZEZ1bmN0aW9uO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9LFxuICAgICAgICBQcm9taXNlOiBQcm9taXNlLFxuICAgICAgICBwcm9taXNlOiBmdW5jdGlvbiAoY2IsIGZuKSB7XG4gICAgICAgICAgICBjYiA9IGNiIHx8IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgICAgICAgICAgIHZhciBfY2IgPSBhcmdzYXJyYXkoZnVuY3Rpb24gKGFyZ3MpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGVyciA9IGFyZ3NbMF0sXG4gICAgICAgICAgICAgICAgICAgICAgICByZXN0ID0gYXJncy5zbGljZSgxKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGVycikgcmVqZWN0KGVycik7XG4gICAgICAgICAgICAgICAgICAgIGVsc2UgcmVzb2x2ZShyZXN0WzBdKTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGJvdW5kID0gY2JbJ19fc2llc3RhX2JvdW5kX29iamVjdCddIHx8IGNiOyAvLyBQcmVzZXJ2ZSBib3VuZCBvYmplY3QuXG4gICAgICAgICAgICAgICAgICAgIGNiLmFwcGx5KGJvdW5kLCBhcmdzKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBmbihfY2IpO1xuICAgICAgICAgICAgfSlcbiAgICAgICAgfSxcbiAgICAgICAgc3ViUHJvcGVydGllczogZnVuY3Rpb24gKG9iaiwgc3ViT2JqLCBwcm9wZXJ0aWVzKSB7XG4gICAgICAgICAgICBpZiAoIWlzQXJyYXkocHJvcGVydGllcykpIHtcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcHJvcGVydGllcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIChmdW5jdGlvbiAocHJvcGVydHkpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIG9wdHMgPSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzZXQ6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICAgICAgbmFtZTogcHJvcGVydHksXG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0eTogcHJvcGVydHlcbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFpc1N0cmluZyhwcm9wZXJ0eSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIF8uZXh0ZW5kKG9wdHMsIHByb3BlcnR5KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB2YXIgZGVzYyA9IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBzdWJPYmpbb3B0cy5wcm9wZXJ0eV07XG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgICBpZiAob3B0cy5zZXQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlc2Muc2V0ID0gZnVuY3Rpb24gKHYpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdWJPYmpbb3B0cy5wcm9wZXJ0eV0gPSB2O1xuICAgICAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkob2JqLCBvcHRzLm5hbWUsIGRlc2MpO1xuICAgICAgICAgICAgICAgIH0pKHByb3BlcnRpZXNbaV0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICBjYXBpdGFsaXNlRmlyc3RMZXR0ZXI6IGZ1bmN0aW9uIChzdHJpbmcpIHtcbiAgICAgICAgICAgIHJldHVybiBzdHJpbmcuY2hhckF0KDApLnRvVXBwZXJDYXNlKCkgKyBzdHJpbmcuc2xpY2UoMSk7XG4gICAgICAgIH0sXG4gICAgICAgIGV4dGVuZEZyb21PcHRzOiBmdW5jdGlvbiAob2JqLCBvcHRzLCBkZWZhdWx0cywgZXJyb3JPblVua25vd24pIHtcbiAgICAgICAgICAgIGVycm9yT25Vbmtub3duID0gZXJyb3JPblVua25vd24gPT0gdW5kZWZpbmVkID8gdHJ1ZSA6IGVycm9yT25Vbmtub3duO1xuICAgICAgICAgICAgaWYgKGVycm9yT25Vbmtub3duKSB7XG4gICAgICAgICAgICAgICAgdmFyIGRlZmF1bHRLZXlzID0gT2JqZWN0LmtleXMoZGVmYXVsdHMpLFxuICAgICAgICAgICAgICAgICAgICBvcHRzS2V5cyA9IE9iamVjdC5rZXlzKG9wdHMpO1xuICAgICAgICAgICAgICAgIHZhciB1bmtub3duS2V5cyA9IG9wdHNLZXlzLmZpbHRlcihmdW5jdGlvbiAobikge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZGVmYXVsdEtleXMuaW5kZXhPZihuKSA9PSAtMVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGlmICh1bmtub3duS2V5cy5sZW5ndGgpIHRocm93IEVycm9yKCdVbmtub3duIG9wdGlvbnM6ICcgKyB1bmtub3duS2V5cy50b1N0cmluZygpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIEFwcGx5IGFueSBmdW5jdGlvbnMgc3BlY2lmaWVkIGluIHRoZSBkZWZhdWx0cy5cbiAgICAgICAgICAgIF8uZWFjaChPYmplY3Qua2V5cyhkZWZhdWx0cyksIGZ1bmN0aW9uIChrKSB7XG4gICAgICAgICAgICAgICAgdmFyIGQgPSBkZWZhdWx0c1trXTtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGQgPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgICAgICAgICBkZWZhdWx0c1trXSA9IGQob3B0c1trXSk7XG4gICAgICAgICAgICAgICAgICAgIGRlbGV0ZSBvcHRzW2tdO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgXy5leHRlbmQoZGVmYXVsdHMsIG9wdHMpO1xuICAgICAgICAgICAgXy5leHRlbmQob2JqLCBkZWZhdWx0cyk7XG4gICAgICAgIH0sXG4gICAgICAgIGlzU3RyaW5nOiBpc1N0cmluZyxcbiAgICAgICAgaXNBcnJheTogaXNBcnJheSxcbiAgICAgICAgcHJldHR5UHJpbnQ6IGZ1bmN0aW9uIChvKSB7XG4gICAgICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkobywgbnVsbCwgNCk7XG4gICAgICAgIH0sXG4gICAgICAgIGZsYXR0ZW5BcnJheTogZnVuY3Rpb24gKGFycikge1xuICAgICAgICAgICAgcmV0dXJuIF8ucmVkdWNlKGFyciwgZnVuY3Rpb24gKG1lbW8sIGUpIHtcbiAgICAgICAgICAgICAgICBpZiAoaXNBcnJheShlKSkge1xuICAgICAgICAgICAgICAgICAgICBtZW1vID0gbWVtby5jb25jYXQoZSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgbWVtby5wdXNoKGUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gbWVtbztcbiAgICAgICAgICAgIH0sIFtdKTtcbiAgICAgICAgfSxcbiAgICAgICAgdW5mbGF0dGVuQXJyYXk6IGZ1bmN0aW9uIChhcnIsIG1vZGVsQXJyKSB7XG4gICAgICAgICAgICB2YXIgbiA9IDA7XG4gICAgICAgICAgICB2YXIgdW5mbGF0dGVuZWQgPSBbXTtcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbW9kZWxBcnIubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpZiAoaXNBcnJheShtb2RlbEFycltpXSkpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIG5ld0FyciA9IFtdO1xuICAgICAgICAgICAgICAgICAgICB1bmZsYXR0ZW5lZFtpXSA9IG5ld0FycjtcbiAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgaiA9IDA7IGogPCBtb2RlbEFycltpXS5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgbmV3QXJyLnB1c2goYXJyW25dKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIG4rKztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHVuZmxhdHRlbmVkW2ldID0gYXJyW25dO1xuICAgICAgICAgICAgICAgICAgICBuKys7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHVuZmxhdHRlbmVkO1xuICAgICAgICB9LFxuICAgICAgICAvKipcbiAgICAgICAgICogUmV0dXJuIHRoZSBwYXJhbWV0ZXIgbmFtZXMgb2YgYSBmdW5jdGlvbi5cbiAgICAgICAgICogTm90ZTogYWRhcHRlZCBmcm9tIEFuZ3VsYXJKUyBkZXBlbmRlbmN5IGluamVjdGlvbiA6KVxuICAgICAgICAgKiBAcGFyYW0gZm5cbiAgICAgICAgICovXG4gICAgICAgIHBhcmFtTmFtZXM6IGZ1bmN0aW9uIChmbikge1xuICAgICAgICAgICAgLy8gVE9ETzogSXMgdGhlcmUgYSBtb3JlIHJvYnVzdCB3YXkgb2YgZG9pbmcgdGhpcz9cbiAgICAgICAgICAgIHZhciBwYXJhbXMgPSBbXSxcbiAgICAgICAgICAgICAgICBmblRleHQsXG4gICAgICAgICAgICAgICAgYXJnRGVjbDtcbiAgICAgICAgICAgIGZuVGV4dCA9IGZuLnRvU3RyaW5nKCkucmVwbGFjZShTVFJJUF9DT01NRU5UUywgJycpO1xuICAgICAgICAgICAgYXJnRGVjbCA9IGZuVGV4dC5tYXRjaChGTl9BUkdTKTtcblxuICAgICAgICAgICAgYXJnRGVjbFsxXS5zcGxpdChGTl9BUkdfU1BMSVQpLmZvckVhY2goZnVuY3Rpb24gKGFyZykge1xuICAgICAgICAgICAgICAgIGFyZy5yZXBsYWNlKEZOX0FSRywgZnVuY3Rpb24gKGFsbCwgdW5kZXJzY29yZSwgbmFtZSkge1xuICAgICAgICAgICAgICAgICAgICBwYXJhbXMucHVzaChuYW1lKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIHBhcmFtcztcbiAgICAgICAgfVxuICAgIH0pO1xufSkoKTsiLCIvKipcbiAqIE9mdGVuIHVzZWQgZnVuY3Rpb25zIGZyb20gdW5kZXJzY29yZSwgcHVsbGVkIG91dCBmb3IgYnJldml0eS5cbiAqIEBtb2R1bGUgdW5kZXJzY29yZVxuICovXG5cbihmdW5jdGlvbiAoKSB7XG4gICAgdmFyIF8gPSB7fSxcbiAgICAgICAgQXJyYXlQcm90byA9IEFycmF5LnByb3RvdHlwZSxcbiAgICAgICAgRnVuY1Byb3RvID0gRnVuY3Rpb24ucHJvdG90eXBlLFxuICAgICAgICBuYXRpdmVGb3JFYWNoID0gQXJyYXlQcm90by5mb3JFYWNoLFxuICAgICAgICBuYXRpdmVNYXAgPSBBcnJheVByb3RvLm1hcCxcbiAgICAgICAgbmF0aXZlUmVkdWNlID0gQXJyYXlQcm90by5yZWR1Y2UsXG4gICAgICAgIG5hdGl2ZUJpbmQgPSBGdW5jUHJvdG8uYmluZCxcbiAgICAgICAgc2xpY2UgPSBBcnJheVByb3RvLnNsaWNlLFxuICAgICAgICBicmVha2VyID0ge30sXG4gICAgICAgIGN0b3IgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIH07XG5cbiAgICBmdW5jdGlvbiBrZXlzKG9iaikge1xuICAgICAgICBpZiAoT2JqZWN0LmtleXMpIHtcbiAgICAgICAgICAgIHJldHVybiBPYmplY3Qua2V5cyhvYmopO1xuICAgICAgICB9XG4gICAgICAgIHZhciBrZXlzID0gW107XG4gICAgICAgIGZvciAodmFyIGsgaW4gb2JqKSB7XG4gICAgICAgICAgICBpZiAob2JqLmhhc093blByb3BlcnR5KGspKSB7XG4gICAgICAgICAgICAgICAga2V5cy5wdXNoKGspO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBrZXlzO1xuICAgIH1cblxuICAgIF8ua2V5cyA9IGtleXM7XG5cbiAgICBfLmVhY2ggPSBfLmZvckVhY2ggPSBmdW5jdGlvbiAob2JqLCBpdGVyYXRvciwgY29udGV4dCkge1xuICAgICAgICBpZiAob2JqID09IG51bGwpIHJldHVybiBvYmo7XG4gICAgICAgIGlmIChuYXRpdmVGb3JFYWNoICYmIG9iai5mb3JFYWNoID09PSBuYXRpdmVGb3JFYWNoKSB7XG4gICAgICAgICAgICBvYmouZm9yRWFjaChpdGVyYXRvciwgY29udGV4dCk7XG4gICAgICAgIH0gZWxzZSBpZiAob2JqLmxlbmd0aCA9PT0gK29iai5sZW5ndGgpIHtcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwLCBsZW5ndGggPSBvYmoubGVuZ3RoOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpZiAoaXRlcmF0b3IuY2FsbChjb250ZXh0LCBvYmpbaV0sIGksIG9iaikgPT09IGJyZWFrZXIpIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHZhciBrZXlzID0gXy5rZXlzKG9iaik7XG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMCwgbGVuZ3RoID0ga2V5cy5sZW5ndGg7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIGlmIChpdGVyYXRvci5jYWxsKGNvbnRleHQsIG9ialtrZXlzW2ldXSwga2V5c1tpXSwgb2JqKSA9PT0gYnJlYWtlcikgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBvYmo7XG4gICAgfTtcblxuICAgIC8vIFJldHVybiB0aGUgcmVzdWx0cyBvZiBhcHBseWluZyB0aGUgaXRlcmF0b3IgdG8gZWFjaCBlbGVtZW50LlxuICAgIC8vIERlbGVnYXRlcyB0byAqKkVDTUFTY3JpcHQgNSoqJ3MgbmF0aXZlIGBtYXBgIGlmIGF2YWlsYWJsZS5cbiAgICBfLm1hcCA9IF8uY29sbGVjdCA9IGZ1bmN0aW9uIChvYmosIGl0ZXJhdG9yLCBjb250ZXh0KSB7XG4gICAgICAgIHZhciByZXN1bHRzID0gW107XG4gICAgICAgIGlmIChvYmogPT0gbnVsbCkgcmV0dXJuIHJlc3VsdHM7XG4gICAgICAgIGlmIChuYXRpdmVNYXAgJiYgb2JqLm1hcCA9PT0gbmF0aXZlTWFwKSByZXR1cm4gb2JqLm1hcChpdGVyYXRvciwgY29udGV4dCk7XG4gICAgICAgIF8uZWFjaChvYmosIGZ1bmN0aW9uICh2YWx1ZSwgaW5kZXgsIGxpc3QpIHtcbiAgICAgICAgICAgIHJlc3VsdHMucHVzaChpdGVyYXRvci5jYWxsKGNvbnRleHQsIHZhbHVlLCBpbmRleCwgbGlzdCkpO1xuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIHJlc3VsdHM7XG4gICAgfTtcblxuICAgIC8vIEludGVybmFsIGZ1bmN0aW9uIHRoYXQgcmV0dXJucyBhbiBlZmZpY2llbnQgKGZvciBjdXJyZW50IGVuZ2luZXMpIHZlcnNpb25cbiAgICAvLyBvZiB0aGUgcGFzc2VkLWluIGNhbGxiYWNrLCB0byBiZSByZXBlYXRlZGx5IGFwcGxpZWQgaW4gb3RoZXIgVW5kZXJzY29yZVxuICAgIC8vIGZ1bmN0aW9ucy5cbiAgICB2YXIgY3JlYXRlQ2FsbGJhY2sgPSBmdW5jdGlvbiAoZnVuYywgY29udGV4dCwgYXJnQ291bnQpIHtcbiAgICAgICAgaWYgKGNvbnRleHQgPT09IHZvaWQgMCkgcmV0dXJuIGZ1bmM7XG4gICAgICAgIHN3aXRjaCAoYXJnQ291bnQgPT0gbnVsbCA/IDMgOiBhcmdDb3VudCkge1xuICAgICAgICAgICAgY2FzZSAxOlxuICAgICAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZ1bmMuY2FsbChjb250ZXh0LCB2YWx1ZSk7XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIGNhc2UgMjpcbiAgICAgICAgICAgICAgICByZXR1cm4gZnVuY3Rpb24gKHZhbHVlLCBvdGhlcikge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZnVuYy5jYWxsKGNvbnRleHQsIHZhbHVlLCBvdGhlcik7XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIGNhc2UgMzpcbiAgICAgICAgICAgICAgICByZXR1cm4gZnVuY3Rpb24gKHZhbHVlLCBpbmRleCwgY29sbGVjdGlvbikge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZnVuYy5jYWxsKGNvbnRleHQsIHZhbHVlLCBpbmRleCwgY29sbGVjdGlvbik7XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIGNhc2UgNDpcbiAgICAgICAgICAgICAgICByZXR1cm4gZnVuY3Rpb24gKGFjY3VtdWxhdG9yLCB2YWx1ZSwgaW5kZXgsIGNvbGxlY3Rpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZ1bmMuY2FsbChjb250ZXh0LCBhY2N1bXVsYXRvciwgdmFsdWUsIGluZGV4LCBjb2xsZWN0aW9uKTtcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gZnVuYy5hcHBseShjb250ZXh0LCBhcmd1bWVudHMpO1xuICAgICAgICB9O1xuICAgIH07XG5cbiAgICAvLyBSdW4gYSBmdW5jdGlvbiAqKm4qKiB0aW1lcy5cbiAgICBfLnRpbWVzID0gZnVuY3Rpb24gKG4sIGl0ZXJhdGVlLCBjb250ZXh0KSB7XG4gICAgICAgIHZhciBhY2N1bSA9IG5ldyBBcnJheShNYXRoLm1heCgwLCBuKSk7XG4gICAgICAgIGl0ZXJhdGVlID0gY3JlYXRlQ2FsbGJhY2soaXRlcmF0ZWUsIGNvbnRleHQsIDEpO1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IG47IGkrKykgYWNjdW1baV0gPSBpdGVyYXRlZShpKTtcbiAgICAgICAgcmV0dXJuIGFjY3VtO1xuICAgIH07XG5cbiAgICAvLyBQYXJ0aWFsbHkgYXBwbHkgYSBmdW5jdGlvbiBieSBjcmVhdGluZyBhIHZlcnNpb24gdGhhdCBoYXMgaGFkIHNvbWUgb2YgaXRzXG4gICAgLy8gYXJndW1lbnRzIHByZS1maWxsZWQsIHdpdGhvdXQgY2hhbmdpbmcgaXRzIGR5bmFtaWMgYHRoaXNgIGNvbnRleHQuIF8gYWN0c1xuICAgIC8vIGFzIGEgcGxhY2Vob2xkZXIsIGFsbG93aW5nIGFueSBjb21iaW5hdGlvbiBvZiBhcmd1bWVudHMgdG8gYmUgcHJlLWZpbGxlZC5cbiAgICBfLnBhcnRpYWwgPSBmdW5jdGlvbiAoZnVuYykge1xuICAgICAgICB2YXIgYm91bmRBcmdzID0gc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdmFyIHBvc2l0aW9uID0gMDtcbiAgICAgICAgICAgIHZhciBhcmdzID0gYm91bmRBcmdzLnNsaWNlKCk7XG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMCwgbGVuZ3RoID0gYXJncy5sZW5ndGg7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIGlmIChhcmdzW2ldID09PSBfKSBhcmdzW2ldID0gYXJndW1lbnRzW3Bvc2l0aW9uKytdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgd2hpbGUgKHBvc2l0aW9uIDwgYXJndW1lbnRzLmxlbmd0aCkgYXJncy5wdXNoKGFyZ3VtZW50c1twb3NpdGlvbisrXSk7XG4gICAgICAgICAgICByZXR1cm4gZnVuYy5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICAgICAgfTtcbiAgICB9O1xuXG4gICAgLy8gQ29udmVuaWVuY2UgdmVyc2lvbiBvZiBhIGNvbW1vbiB1c2UgY2FzZSBvZiBgbWFwYDogZmV0Y2hpbmcgYSBwcm9wZXJ0eS5cbiAgICBfLnBsdWNrID0gZnVuY3Rpb24gKG9iaiwga2V5KSB7XG4gICAgICAgIHJldHVybiBfLm1hcChvYmosIF8ucHJvcGVydHkoa2V5KSk7XG4gICAgfTtcblxuICAgIHZhciByZWR1Y2VFcnJvciA9ICdSZWR1Y2Ugb2YgZW1wdHkgYXJyYXkgd2l0aCBubyBpbml0aWFsIHZhbHVlJztcblxuICAgIC8vICoqUmVkdWNlKiogYnVpbGRzIHVwIGEgc2luZ2xlIHJlc3VsdCBmcm9tIGEgbGlzdCBvZiB2YWx1ZXMsIGFrYSBgaW5qZWN0YCxcbiAgICAvLyBvciBgZm9sZGxgLiBEZWxlZ2F0ZXMgdG8gKipFQ01BU2NyaXB0IDUqKidzIG5hdGl2ZSBgcmVkdWNlYCBpZiBhdmFpbGFibGUuXG4gICAgXy5yZWR1Y2UgPSBfLmZvbGRsID0gXy5pbmplY3QgPSBmdW5jdGlvbiAob2JqLCBpdGVyYXRvciwgbWVtbywgY29udGV4dCkge1xuICAgICAgICB2YXIgaW5pdGlhbCA9IGFyZ3VtZW50cy5sZW5ndGggPiAyO1xuICAgICAgICBpZiAob2JqID09IG51bGwpIG9iaiA9IFtdO1xuICAgICAgICBpZiAobmF0aXZlUmVkdWNlICYmIG9iai5yZWR1Y2UgPT09IG5hdGl2ZVJlZHVjZSkge1xuICAgICAgICAgICAgaWYgKGNvbnRleHQpIGl0ZXJhdG9yID0gXy5iaW5kKGl0ZXJhdG9yLCBjb250ZXh0KTtcbiAgICAgICAgICAgIHJldHVybiBpbml0aWFsID8gb2JqLnJlZHVjZShpdGVyYXRvciwgbWVtbykgOiBvYmoucmVkdWNlKGl0ZXJhdG9yKTtcbiAgICAgICAgfVxuICAgICAgICBfLmVhY2gob2JqLCBmdW5jdGlvbiAodmFsdWUsIGluZGV4LCBsaXN0KSB7XG4gICAgICAgICAgICBpZiAoIWluaXRpYWwpIHtcbiAgICAgICAgICAgICAgICBtZW1vID0gdmFsdWU7XG4gICAgICAgICAgICAgICAgaW5pdGlhbCA9IHRydWU7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIG1lbW8gPSBpdGVyYXRvci5jYWxsKGNvbnRleHQsIG1lbW8sIHZhbHVlLCBpbmRleCwgbGlzdCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICBpZiAoIWluaXRpYWwpIHRocm93IG5ldyBUeXBlRXJyb3IocmVkdWNlRXJyb3IpO1xuICAgICAgICByZXR1cm4gbWVtbztcbiAgICB9O1xuXG4gICAgXy5wcm9wZXJ0eSA9IGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgICAgIHJldHVybiBvYmpba2V5XTtcbiAgICAgICAgfTtcbiAgICB9O1xuXG4gICAgLy8gT3B0aW1pemUgYGlzRnVuY3Rpb25gIGlmIGFwcHJvcHJpYXRlLlxuICAgIGlmICh0eXBlb2YoLy4vKSAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICBfLmlzRnVuY3Rpb24gPSBmdW5jdGlvbiAob2JqKSB7XG4gICAgICAgICAgICByZXR1cm4gdHlwZW9mIG9iaiA9PT0gJ2Z1bmN0aW9uJztcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBfLmlzT2JqZWN0ID0gZnVuY3Rpb24gKG9iaikge1xuICAgICAgICB2YXIgdHlwZSA9IHR5cGVvZiBvYmo7XG4gICAgICAgIHJldHVybiB0eXBlID09PSAnZnVuY3Rpb24nIHx8IHR5cGUgPT09ICdvYmplY3QnICYmICEhb2JqO1xuICAgIH07XG5cbiAgICAvLyBBbiBpbnRlcm5hbCBmdW5jdGlvbiB0byBnZW5lcmF0ZSBsb29rdXAgaXRlcmF0b3JzLlxuICAgIHZhciBsb29rdXBJdGVyYXRvciA9IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICBpZiAodmFsdWUgPT0gbnVsbCkgcmV0dXJuIF8uaWRlbnRpdHk7XG4gICAgICAgIGlmIChfLmlzRnVuY3Rpb24odmFsdWUpKSByZXR1cm4gdmFsdWU7XG4gICAgICAgIHJldHVybiBfLnByb3BlcnR5KHZhbHVlKTtcbiAgICB9O1xuXG4gICAgLy8gU29ydCB0aGUgb2JqZWN0J3MgdmFsdWVzIGJ5IGEgY3JpdGVyaW9uIHByb2R1Y2VkIGJ5IGFuIGl0ZXJhdG9yLlxuICAgIF8uc29ydEJ5ID0gZnVuY3Rpb24gKG9iaiwgaXRlcmF0b3IsIGNvbnRleHQpIHtcbiAgICAgICAgaXRlcmF0b3IgPSBsb29rdXBJdGVyYXRvcihpdGVyYXRvcik7XG4gICAgICAgIHJldHVybiBfLnBsdWNrKF8ubWFwKG9iaiwgZnVuY3Rpb24gKHZhbHVlLCBpbmRleCwgbGlzdCkge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICB2YWx1ZTogdmFsdWUsXG4gICAgICAgICAgICAgICAgaW5kZXg6IGluZGV4LFxuICAgICAgICAgICAgICAgIGNyaXRlcmlhOiBpdGVyYXRvci5jYWxsKGNvbnRleHQsIHZhbHVlLCBpbmRleCwgbGlzdClcbiAgICAgICAgICAgIH07XG4gICAgICAgIH0pLnNvcnQoZnVuY3Rpb24gKGxlZnQsIHJpZ2h0KSB7XG4gICAgICAgICAgICB2YXIgYSA9IGxlZnQuY3JpdGVyaWE7XG4gICAgICAgICAgICB2YXIgYiA9IHJpZ2h0LmNyaXRlcmlhO1xuICAgICAgICAgICAgaWYgKGEgIT09IGIpIHtcbiAgICAgICAgICAgICAgICBpZiAoYSA+IGIgfHwgYSA9PT0gdm9pZCAwKSByZXR1cm4gMTtcbiAgICAgICAgICAgICAgICBpZiAoYSA8IGIgfHwgYiA9PT0gdm9pZCAwKSByZXR1cm4gLTE7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gbGVmdC5pbmRleCAtIHJpZ2h0LmluZGV4O1xuICAgICAgICB9KSwgJ3ZhbHVlJyk7XG4gICAgfTtcblxuXG4gICAgLy8gQ3JlYXRlIGEgZnVuY3Rpb24gYm91bmQgdG8gYSBnaXZlbiBvYmplY3QgKGFzc2lnbmluZyBgdGhpc2AsIGFuZCBhcmd1bWVudHMsXG4gICAgLy8gb3B0aW9uYWxseSkuIERlbGVnYXRlcyB0byAqKkVDTUFTY3JpcHQgNSoqJ3MgbmF0aXZlIGBGdW5jdGlvbi5iaW5kYCBpZlxuICAgIC8vIGF2YWlsYWJsZS5cbiAgICBfLmJpbmQgPSBmdW5jdGlvbiAoZnVuYywgY29udGV4dCkge1xuICAgICAgICB2YXIgYXJncywgYm91bmQ7XG4gICAgICAgIGlmIChuYXRpdmVCaW5kICYmIGZ1bmMuYmluZCA9PT0gbmF0aXZlQmluZCkgcmV0dXJuIG5hdGl2ZUJpbmQuYXBwbHkoZnVuYywgc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpKTtcbiAgICAgICAgaWYgKCFfLmlzRnVuY3Rpb24oZnVuYykpIHRocm93IG5ldyBUeXBlRXJyb3I7XG4gICAgICAgIGFyZ3MgPSBzbGljZS5jYWxsKGFyZ3VtZW50cywgMik7XG4gICAgICAgIHJldHVybiBib3VuZCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGlmICghKHRoaXMgaW5zdGFuY2VvZiBib3VuZCkpIHJldHVybiBmdW5jLmFwcGx5KGNvbnRleHQsIGFyZ3MuY29uY2F0KHNsaWNlLmNhbGwoYXJndW1lbnRzKSkpO1xuICAgICAgICAgICAgY3Rvci5wcm90b3R5cGUgPSBmdW5jLnByb3RvdHlwZTtcbiAgICAgICAgICAgIHZhciBzZWxmID0gbmV3IGN0b3I7XG4gICAgICAgICAgICBjdG9yLnByb3RvdHlwZSA9IG51bGw7XG4gICAgICAgICAgICB1XG4gICAgICAgICAgICB2YXIgcmVzdWx0ID0gZnVuYy5hcHBseShzZWxmLCBhcmdzLmNvbmNhdChzbGljZS5jYWxsKGFyZ3VtZW50cykpKTtcbiAgICAgICAgICAgIGlmIChPYmplY3QocmVzdWx0KSA9PT0gcmVzdWx0KSByZXR1cm4gcmVzdWx0O1xuICAgICAgICAgICAgcmV0dXJuIHNlbGY7XG4gICAgICAgIH07XG4gICAgfTtcblxuICAgIF8uaWRlbnRpdHkgPSBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgIH07XG5cbiAgICBfLnppcCA9IGZ1bmN0aW9uIChhcnJheSkge1xuICAgICAgICBpZiAoYXJyYXkgPT0gbnVsbCkgcmV0dXJuIFtdO1xuICAgICAgICB2YXIgbGVuZ3RoID0gXy5tYXgoYXJndW1lbnRzLCAnbGVuZ3RoJykubGVuZ3RoO1xuICAgICAgICB2YXIgcmVzdWx0cyA9IEFycmF5KGxlbmd0aCk7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHJlc3VsdHNbaV0gPSBfLnBsdWNrKGFyZ3VtZW50cywgaSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlc3VsdHM7XG4gICAgfTtcblxuICAgIC8vIFJldHVybiB0aGUgbWF4aW11bSBlbGVtZW50IChvciBlbGVtZW50LWJhc2VkIGNvbXB1dGF0aW9uKS5cbiAgICBfLm1heCA9IGZ1bmN0aW9uIChvYmosIGl0ZXJhdGVlLCBjb250ZXh0KSB7XG4gICAgICAgIHZhciByZXN1bHQgPSAtSW5maW5pdHksXG4gICAgICAgICAgICBsYXN0Q29tcHV0ZWQgPSAtSW5maW5pdHksXG4gICAgICAgICAgICB2YWx1ZSwgY29tcHV0ZWQ7XG4gICAgICAgIGlmIChpdGVyYXRlZSA9PSBudWxsICYmIG9iaiAhPSBudWxsKSB7XG4gICAgICAgICAgICBvYmogPSBvYmoubGVuZ3RoID09PSArb2JqLmxlbmd0aCA/IG9iaiA6IF8udmFsdWVzKG9iaik7XG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMCwgbGVuZ3RoID0gb2JqLmxlbmd0aDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgdmFsdWUgPSBvYmpbaV07XG4gICAgICAgICAgICAgICAgaWYgKHZhbHVlID4gcmVzdWx0KSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdCA9IHZhbHVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGl0ZXJhdGVlID0gXy5pdGVyYXRlZShpdGVyYXRlZSwgY29udGV4dCk7XG4gICAgICAgICAgICBfLmVhY2gob2JqLCBmdW5jdGlvbiAodmFsdWUsIGluZGV4LCBsaXN0KSB7XG4gICAgICAgICAgICAgICAgY29tcHV0ZWQgPSBpdGVyYXRlZSh2YWx1ZSwgaW5kZXgsIGxpc3QpO1xuICAgICAgICAgICAgICAgIGlmIChjb21wdXRlZCA+IGxhc3RDb21wdXRlZCB8fCBjb21wdXRlZCA9PT0gLUluZmluaXR5ICYmIHJlc3VsdCA9PT0gLUluZmluaXR5KSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdCA9IHZhbHVlO1xuICAgICAgICAgICAgICAgICAgICBsYXN0Q29tcHV0ZWQgPSBjb21wdXRlZDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH07XG5cblxuICAgIF8uaXRlcmF0ZWUgPSBmdW5jdGlvbiAodmFsdWUsIGNvbnRleHQsIGFyZ0NvdW50KSB7XG4gICAgICAgIGlmICh2YWx1ZSA9PSBudWxsKSByZXR1cm4gXy5pZGVudGl0eTtcbiAgICAgICAgaWYgKF8uaXNGdW5jdGlvbih2YWx1ZSkpIHJldHVybiBjcmVhdGVDYWxsYmFjayh2YWx1ZSwgY29udGV4dCwgYXJnQ291bnQpO1xuICAgICAgICBpZiAoXy5pc09iamVjdCh2YWx1ZSkpIHJldHVybiBfLm1hdGNoZXModmFsdWUpO1xuICAgICAgICByZXR1cm4gXy5wcm9wZXJ0eSh2YWx1ZSk7XG4gICAgfTtcblxuICAgIF8ucGFpcnMgPSBmdW5jdGlvbiAob2JqKSB7XG4gICAgICAgIHZhciBrZXlzID0gXy5rZXlzKG9iaik7XG4gICAgICAgIHZhciBsZW5ndGggPSBrZXlzLmxlbmd0aDtcbiAgICAgICAgdmFyIHBhaXJzID0gQXJyYXkobGVuZ3RoKTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgcGFpcnNbaV0gPSBba2V5c1tpXSwgb2JqW2tleXNbaV1dXTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcGFpcnM7XG4gICAgfTtcblxuICAgIF8ubWF0Y2hlcyA9IGZ1bmN0aW9uIChhdHRycykge1xuICAgICAgICB2YXIgcGFpcnMgPSBfLnBhaXJzKGF0dHJzKSxcbiAgICAgICAgICAgIGxlbmd0aCA9IHBhaXJzLmxlbmd0aDtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgICAgIGlmIChvYmogPT0gbnVsbCkgcmV0dXJuICFsZW5ndGg7XG4gICAgICAgICAgICBvYmogPSBuZXcgT2JqZWN0KG9iaik7XG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgdmFyIHBhaXIgPSBwYWlyc1tpXSxcbiAgICAgICAgICAgICAgICAgICAga2V5ID0gcGFpclswXTtcbiAgICAgICAgICAgICAgICBpZiAocGFpclsxXSAhPT0gb2JqW2tleV0gfHwgIShrZXkgaW4gb2JqKSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH07XG4gICAgfTtcblxuICAgIF8uc29tZSA9IGZ1bmN0aW9uIChvYmosIHByZWRpY2F0ZSwgY29udGV4dCkge1xuICAgICAgICBpZiAob2JqID09IG51bGwpIHJldHVybiBmYWxzZTtcbiAgICAgICAgcHJlZGljYXRlID0gXy5pdGVyYXRlZShwcmVkaWNhdGUsIGNvbnRleHQpO1xuICAgICAgICB2YXIga2V5cyA9IG9iai5sZW5ndGggIT09ICtvYmoubGVuZ3RoICYmIF8ua2V5cyhvYmopLFxuICAgICAgICAgICAgbGVuZ3RoID0gKGtleXMgfHwgb2JqKS5sZW5ndGgsXG4gICAgICAgICAgICBpbmRleCwgY3VycmVudEtleTtcbiAgICAgICAgZm9yIChpbmRleCA9IDA7IGluZGV4IDwgbGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICAgICAgICBjdXJyZW50S2V5ID0ga2V5cyA/IGtleXNbaW5kZXhdIDogaW5kZXg7XG4gICAgICAgICAgICBpZiAocHJlZGljYXRlKG9ialtjdXJyZW50S2V5XSwgY3VycmVudEtleSwgb2JqKSkgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH07XG5cblxuICAgIC8vIEV4dGVuZCBhIGdpdmVuIG9iamVjdCB3aXRoIGFsbCB0aGUgcHJvcGVydGllcyBpbiBwYXNzZWQtaW4gb2JqZWN0KHMpLlxuICAgIF8uZXh0ZW5kID0gZnVuY3Rpb24gKG9iaikge1xuICAgICAgICBpZiAoIV8uaXNPYmplY3Qob2JqKSkgcmV0dXJuIG9iajtcbiAgICAgICAgdmFyIHNvdXJjZSwgcHJvcDtcbiAgICAgICAgZm9yICh2YXIgaSA9IDEsIGxlbmd0aCA9IGFyZ3VtZW50cy5sZW5ndGg7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgc291cmNlID0gYXJndW1lbnRzW2ldO1xuICAgICAgICAgICAgZm9yIChwcm9wIGluIHNvdXJjZSkge1xuICAgICAgICAgICAgICAgIC8vbm9pbnNwZWN0aW9uIEpTVW5maWx0ZXJlZEZvckluTG9vcFxuICAgICAgICAgICAgICAgIGlmIChoYXNPd25Qcm9wZXJ0eS5jYWxsKHNvdXJjZSwgcHJvcCkpIHtcbiAgICAgICAgICAgICAgICAgICAgLy9ub2luc3BlY3Rpb24gSlNVbmZpbHRlcmVkRm9ySW5Mb29wXG4gICAgICAgICAgICAgICAgICAgIG9ialtwcm9wXSA9IHNvdXJjZVtwcm9wXTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG9iajtcbiAgICB9O1xuXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBfO1xufSkoKTsiLCIndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0gYXJnc0FycmF5O1xuXG5mdW5jdGlvbiBhcmdzQXJyYXkoZnVuKSB7XG4gIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIGxlbiA9IGFyZ3VtZW50cy5sZW5ndGg7XG4gICAgaWYgKGxlbikge1xuICAgICAgdmFyIGFyZ3MgPSBbXTtcbiAgICAgIHZhciBpID0gLTE7XG4gICAgICB3aGlsZSAoKytpIDwgbGVuKSB7XG4gICAgICAgIGFyZ3NbaV0gPSBhcmd1bWVudHNbaV07XG4gICAgICB9XG4gICAgICByZXR1cm4gZnVuLmNhbGwodGhpcywgYXJncyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBmdW4uY2FsbCh0aGlzLCBbXSk7XG4gICAgfVxuICB9O1xufSIsbnVsbCwiLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGFcbi8vIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGVcbi8vIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZ1xuLy8gd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLFxuLy8gZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdFxuLy8gcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlXG4vLyBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZFxuLy8gaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTU1xuLy8gT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRlxuLy8gTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTlxuLy8gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sXG4vLyBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1Jcbi8vIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEVcbi8vIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG5cbmZ1bmN0aW9uIEV2ZW50RW1pdHRlcigpIHtcbiAgdGhpcy5fZXZlbnRzID0gdGhpcy5fZXZlbnRzIHx8IHt9O1xuICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSB0aGlzLl9tYXhMaXN0ZW5lcnMgfHwgdW5kZWZpbmVkO1xufVxubW9kdWxlLmV4cG9ydHMgPSBFdmVudEVtaXR0ZXI7XG5cbi8vIEJhY2t3YXJkcy1jb21wYXQgd2l0aCBub2RlIDAuMTAueFxuRXZlbnRFbWl0dGVyLkV2ZW50RW1pdHRlciA9IEV2ZW50RW1pdHRlcjtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fZXZlbnRzID0gdW5kZWZpbmVkO1xuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fbWF4TGlzdGVuZXJzID0gdW5kZWZpbmVkO1xuXG4vLyBCeSBkZWZhdWx0IEV2ZW50RW1pdHRlcnMgd2lsbCBwcmludCBhIHdhcm5pbmcgaWYgbW9yZSB0aGFuIDEwIGxpc3RlbmVycyBhcmVcbi8vIGFkZGVkIHRvIGl0LiBUaGlzIGlzIGEgdXNlZnVsIGRlZmF1bHQgd2hpY2ggaGVscHMgZmluZGluZyBtZW1vcnkgbGVha3MuXG5FdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycyA9IDEwO1xuXG4vLyBPYnZpb3VzbHkgbm90IGFsbCBFbWl0dGVycyBzaG91bGQgYmUgbGltaXRlZCB0byAxMC4gVGhpcyBmdW5jdGlvbiBhbGxvd3Ncbi8vIHRoYXQgdG8gYmUgaW5jcmVhc2VkLiBTZXQgdG8gemVybyBmb3IgdW5saW1pdGVkLlxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5zZXRNYXhMaXN0ZW5lcnMgPSBmdW5jdGlvbihuKSB7XG4gIGlmICghaXNOdW1iZXIobikgfHwgbiA8IDAgfHwgaXNOYU4obikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCduIG11c3QgYmUgYSBwb3NpdGl2ZSBudW1iZXInKTtcbiAgdGhpcy5fbWF4TGlzdGVuZXJzID0gbjtcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmVtaXQgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciBlciwgaGFuZGxlciwgbGVuLCBhcmdzLCBpLCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgLy8gSWYgdGhlcmUgaXMgbm8gJ2Vycm9yJyBldmVudCBsaXN0ZW5lciB0aGVuIHRocm93LlxuICBpZiAodHlwZSA9PT0gJ2Vycm9yJykge1xuICAgIGlmICghdGhpcy5fZXZlbnRzLmVycm9yIHx8XG4gICAgICAgIChpc09iamVjdCh0aGlzLl9ldmVudHMuZXJyb3IpICYmICF0aGlzLl9ldmVudHMuZXJyb3IubGVuZ3RoKSkge1xuICAgICAgZXIgPSBhcmd1bWVudHNbMV07XG4gICAgICBpZiAoZXIgaW5zdGFuY2VvZiBFcnJvcikge1xuICAgICAgICB0aHJvdyBlcjsgLy8gVW5oYW5kbGVkICdlcnJvcicgZXZlbnRcbiAgICAgIH1cbiAgICAgIHRocm93IFR5cGVFcnJvcignVW5jYXVnaHQsIHVuc3BlY2lmaWVkIFwiZXJyb3JcIiBldmVudC4nKTtcbiAgICB9XG4gIH1cblxuICBoYW5kbGVyID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIGlmIChpc1VuZGVmaW5lZChoYW5kbGVyKSlcbiAgICByZXR1cm4gZmFsc2U7XG5cbiAgaWYgKGlzRnVuY3Rpb24oaGFuZGxlcikpIHtcbiAgICBzd2l0Y2ggKGFyZ3VtZW50cy5sZW5ndGgpIHtcbiAgICAgIC8vIGZhc3QgY2FzZXNcbiAgICAgIGNhc2UgMTpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMjpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAzOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdLCBhcmd1bWVudHNbMl0pO1xuICAgICAgICBicmVhaztcbiAgICAgIC8vIHNsb3dlclxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgbGVuID0gYXJndW1lbnRzLmxlbmd0aDtcbiAgICAgICAgYXJncyA9IG5ldyBBcnJheShsZW4gLSAxKTtcbiAgICAgICAgZm9yIChpID0gMTsgaSA8IGxlbjsgaSsrKVxuICAgICAgICAgIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuICAgICAgICBoYW5kbGVyLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgIH1cbiAgfSBlbHNlIGlmIChpc09iamVjdChoYW5kbGVyKSkge1xuICAgIGxlbiA9IGFyZ3VtZW50cy5sZW5ndGg7XG4gICAgYXJncyA9IG5ldyBBcnJheShsZW4gLSAxKTtcbiAgICBmb3IgKGkgPSAxOyBpIDwgbGVuOyBpKyspXG4gICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcblxuICAgIGxpc3RlbmVycyA9IGhhbmRsZXIuc2xpY2UoKTtcbiAgICBsZW4gPSBsaXN0ZW5lcnMubGVuZ3RoO1xuICAgIGZvciAoaSA9IDA7IGkgPCBsZW47IGkrKylcbiAgICAgIGxpc3RlbmVyc1tpXS5hcHBseSh0aGlzLCBhcmdzKTtcbiAgfVxuXG4gIHJldHVybiB0cnVlO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIHZhciBtO1xuXG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcblxuICAvLyBUbyBhdm9pZCByZWN1cnNpb24gaW4gdGhlIGNhc2UgdGhhdCB0eXBlID09PSBcIm5ld0xpc3RlbmVyXCIhIEJlZm9yZVxuICAvLyBhZGRpbmcgaXQgdG8gdGhlIGxpc3RlbmVycywgZmlyc3QgZW1pdCBcIm5ld0xpc3RlbmVyXCIuXG4gIGlmICh0aGlzLl9ldmVudHMubmV3TGlzdGVuZXIpXG4gICAgdGhpcy5lbWl0KCduZXdMaXN0ZW5lcicsIHR5cGUsXG4gICAgICAgICAgICAgIGlzRnVuY3Rpb24obGlzdGVuZXIubGlzdGVuZXIpID9cbiAgICAgICAgICAgICAgbGlzdGVuZXIubGlzdGVuZXIgOiBsaXN0ZW5lcik7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgLy8gT3B0aW1pemUgdGhlIGNhc2Ugb2Ygb25lIGxpc3RlbmVyLiBEb24ndCBuZWVkIHRoZSBleHRyYSBhcnJheSBvYmplY3QuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gbGlzdGVuZXI7XG4gIGVsc2UgaWYgKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkpXG4gICAgLy8gSWYgd2UndmUgYWxyZWFkeSBnb3QgYW4gYXJyYXksIGp1c3QgYXBwZW5kLlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5wdXNoKGxpc3RlbmVyKTtcbiAgZWxzZVxuICAgIC8vIEFkZGluZyB0aGUgc2Vjb25kIGVsZW1lbnQsIG5lZWQgdG8gY2hhbmdlIHRvIGFycmF5LlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IFt0aGlzLl9ldmVudHNbdHlwZV0sIGxpc3RlbmVyXTtcblxuICAvLyBDaGVjayBmb3IgbGlzdGVuZXIgbGVha1xuICBpZiAoaXNPYmplY3QodGhpcy5fZXZlbnRzW3R5cGVdKSAmJiAhdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCkge1xuICAgIHZhciBtO1xuICAgIGlmICghaXNVbmRlZmluZWQodGhpcy5fbWF4TGlzdGVuZXJzKSkge1xuICAgICAgbSA9IHRoaXMuX21heExpc3RlbmVycztcbiAgICB9IGVsc2Uge1xuICAgICAgbSA9IEV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzO1xuICAgIH1cblxuICAgIGlmIChtICYmIG0gPiAwICYmIHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGggPiBtKSB7XG4gICAgICB0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkID0gdHJ1ZTtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJyhub2RlKSB3YXJuaW5nOiBwb3NzaWJsZSBFdmVudEVtaXR0ZXIgbWVtb3J5ICcgK1xuICAgICAgICAgICAgICAgICAgICAnbGVhayBkZXRlY3RlZC4gJWQgbGlzdGVuZXJzIGFkZGVkLiAnICtcbiAgICAgICAgICAgICAgICAgICAgJ1VzZSBlbWl0dGVyLnNldE1heExpc3RlbmVycygpIHRvIGluY3JlYXNlIGxpbWl0LicsXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGgpO1xuICAgICAgaWYgKHR5cGVvZiBjb25zb2xlLnRyYWNlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIC8vIG5vdCBzdXBwb3J0ZWQgaW4gSUUgMTBcbiAgICAgICAgY29uc29sZS50cmFjZSgpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbiA9IEV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXI7XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub25jZSA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICB2YXIgZmlyZWQgPSBmYWxzZTtcblxuICBmdW5jdGlvbiBnKCkge1xuICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgZyk7XG5cbiAgICBpZiAoIWZpcmVkKSB7XG4gICAgICBmaXJlZCA9IHRydWU7XG4gICAgICBsaXN0ZW5lci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH1cbiAgfVxuXG4gIGcubGlzdGVuZXIgPSBsaXN0ZW5lcjtcbiAgdGhpcy5vbih0eXBlLCBnKTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbi8vIGVtaXRzIGEgJ3JlbW92ZUxpc3RlbmVyJyBldmVudCBpZmYgdGhlIGxpc3RlbmVyIHdhcyByZW1vdmVkXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUxpc3RlbmVyID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgdmFyIGxpc3QsIHBvc2l0aW9uLCBsZW5ndGgsIGk7XG5cbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzIHx8ICF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgbGlzdCA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgbGVuZ3RoID0gbGlzdC5sZW5ndGg7XG4gIHBvc2l0aW9uID0gLTE7XG5cbiAgaWYgKGxpc3QgPT09IGxpc3RlbmVyIHx8XG4gICAgICAoaXNGdW5jdGlvbihsaXN0Lmxpc3RlbmVyKSAmJiBsaXN0Lmxpc3RlbmVyID09PSBsaXN0ZW5lcikpIHtcbiAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIGlmICh0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpXG4gICAgICB0aGlzLmVtaXQoJ3JlbW92ZUxpc3RlbmVyJywgdHlwZSwgbGlzdGVuZXIpO1xuXG4gIH0gZWxzZSBpZiAoaXNPYmplY3QobGlzdCkpIHtcbiAgICBmb3IgKGkgPSBsZW5ndGg7IGktLSA+IDA7KSB7XG4gICAgICBpZiAobGlzdFtpXSA9PT0gbGlzdGVuZXIgfHxcbiAgICAgICAgICAobGlzdFtpXS5saXN0ZW5lciAmJiBsaXN0W2ldLmxpc3RlbmVyID09PSBsaXN0ZW5lcikpIHtcbiAgICAgICAgcG9zaXRpb24gPSBpO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAocG9zaXRpb24gPCAwKVxuICAgICAgcmV0dXJuIHRoaXM7XG5cbiAgICBpZiAobGlzdC5sZW5ndGggPT09IDEpIHtcbiAgICAgIGxpc3QubGVuZ3RoID0gMDtcbiAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgfSBlbHNlIHtcbiAgICAgIGxpc3Quc3BsaWNlKHBvc2l0aW9uLCAxKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKVxuICAgICAgdGhpcy5lbWl0KCdyZW1vdmVMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciBrZXksIGxpc3RlbmVycztcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICByZXR1cm4gdGhpcztcblxuICAvLyBub3QgbGlzdGVuaW5nIGZvciByZW1vdmVMaXN0ZW5lciwgbm8gbmVlZCB0byBlbWl0XG4gIGlmICghdGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKSB7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApXG4gICAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICBlbHNlIGlmICh0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLy8gZW1pdCByZW1vdmVMaXN0ZW5lciBmb3IgYWxsIGxpc3RlbmVycyBvbiBhbGwgZXZlbnRzXG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgZm9yIChrZXkgaW4gdGhpcy5fZXZlbnRzKSB7XG4gICAgICBpZiAoa2V5ID09PSAncmVtb3ZlTGlzdGVuZXInKSBjb250aW51ZTtcbiAgICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKGtleSk7XG4gICAgfVxuICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKCdyZW1vdmVMaXN0ZW5lcicpO1xuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgbGlzdGVuZXJzID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIGlmIChpc0Z1bmN0aW9uKGxpc3RlbmVycykpIHtcbiAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGxpc3RlbmVycyk7XG4gIH0gZWxzZSB7XG4gICAgLy8gTElGTyBvcmRlclxuICAgIHdoaWxlIChsaXN0ZW5lcnMubGVuZ3RoKVxuICAgICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnNbbGlzdGVuZXJzLmxlbmd0aCAtIDFdKTtcbiAgfVxuICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5saXN0ZW5lcnMgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciByZXQ7XG4gIGlmICghdGhpcy5fZXZlbnRzIHx8ICF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0ID0gW107XG4gIGVsc2UgaWYgKGlzRnVuY3Rpb24odGhpcy5fZXZlbnRzW3R5cGVdKSlcbiAgICByZXQgPSBbdGhpcy5fZXZlbnRzW3R5cGVdXTtcbiAgZWxzZVxuICAgIHJldCA9IHRoaXMuX2V2ZW50c1t0eXBlXS5zbGljZSgpO1xuICByZXR1cm4gcmV0O1xufTtcblxuRXZlbnRFbWl0dGVyLmxpc3RlbmVyQ291bnQgPSBmdW5jdGlvbihlbWl0dGVyLCB0eXBlKSB7XG4gIHZhciByZXQ7XG4gIGlmICghZW1pdHRlci5fZXZlbnRzIHx8ICFlbWl0dGVyLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0ID0gMDtcbiAgZWxzZSBpZiAoaXNGdW5jdGlvbihlbWl0dGVyLl9ldmVudHNbdHlwZV0pKVxuICAgIHJldCA9IDE7XG4gIGVsc2VcbiAgICByZXQgPSBlbWl0dGVyLl9ldmVudHNbdHlwZV0ubGVuZ3RoO1xuICByZXR1cm4gcmV0O1xufTtcblxuZnVuY3Rpb24gaXNGdW5jdGlvbihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdmdW5jdGlvbic7XG59XG5cbmZ1bmN0aW9uIGlzTnVtYmVyKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ251bWJlcic7XG59XG5cbmZ1bmN0aW9uIGlzT2JqZWN0KGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ29iamVjdCcgJiYgYXJnICE9PSBudWxsO1xufVxuXG5mdW5jdGlvbiBpc1VuZGVmaW5lZChhcmcpIHtcbiAgcmV0dXJuIGFyZyA9PT0gdm9pZCAwO1xufVxuIiwiXG4vKipcbiAqIFRoaXMgaXMgdGhlIHdlYiBicm93c2VyIGltcGxlbWVudGF0aW9uIG9mIGBkZWJ1ZygpYC5cbiAqXG4gKiBFeHBvc2UgYGRlYnVnKClgIGFzIHRoZSBtb2R1bGUuXG4gKi9cblxuZXhwb3J0cyA9IG1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9kZWJ1ZycpO1xuZXhwb3J0cy5sb2cgPSBsb2c7XG5leHBvcnRzLmZvcm1hdEFyZ3MgPSBmb3JtYXRBcmdzO1xuZXhwb3J0cy5zYXZlID0gc2F2ZTtcbmV4cG9ydHMubG9hZCA9IGxvYWQ7XG5leHBvcnRzLnVzZUNvbG9ycyA9IHVzZUNvbG9ycztcblxuLyoqXG4gKiBVc2UgY2hyb21lLnN0b3JhZ2UubG9jYWwgaWYgd2UgYXJlIGluIGFuIGFwcFxuICovXG5cbnZhciBzdG9yYWdlO1xuXG5pZiAodHlwZW9mIGNocm9tZSAhPT0gJ3VuZGVmaW5lZCcgJiYgdHlwZW9mIGNocm9tZS5zdG9yYWdlICE9PSAndW5kZWZpbmVkJylcbiAgc3RvcmFnZSA9IGNocm9tZS5zdG9yYWdlLmxvY2FsO1xuZWxzZVxuICBzdG9yYWdlID0gd2luZG93LmxvY2FsU3RvcmFnZTtcblxuLyoqXG4gKiBDb2xvcnMuXG4gKi9cblxuZXhwb3J0cy5jb2xvcnMgPSBbXG4gICdsaWdodHNlYWdyZWVuJyxcbiAgJ2ZvcmVzdGdyZWVuJyxcbiAgJ2dvbGRlbnJvZCcsXG4gICdkb2RnZXJibHVlJyxcbiAgJ2RhcmtvcmNoaWQnLFxuICAnY3JpbXNvbidcbl07XG5cbi8qKlxuICogQ3VycmVudGx5IG9ubHkgV2ViS2l0LWJhc2VkIFdlYiBJbnNwZWN0b3JzLCBGaXJlZm94ID49IHYzMSxcbiAqIGFuZCB0aGUgRmlyZWJ1ZyBleHRlbnNpb24gKGFueSBGaXJlZm94IHZlcnNpb24pIGFyZSBrbm93blxuICogdG8gc3VwcG9ydCBcIiVjXCIgQ1NTIGN1c3RvbWl6YXRpb25zLlxuICpcbiAqIFRPRE86IGFkZCBhIGBsb2NhbFN0b3JhZ2VgIHZhcmlhYmxlIHRvIGV4cGxpY2l0bHkgZW5hYmxlL2Rpc2FibGUgY29sb3JzXG4gKi9cblxuZnVuY3Rpb24gdXNlQ29sb3JzKCkge1xuICAvLyBpcyB3ZWJraXQ/IGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9hLzE2NDU5NjA2LzM3Njc3M1xuICByZXR1cm4gKCdXZWJraXRBcHBlYXJhbmNlJyBpbiBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuc3R5bGUpIHx8XG4gICAgLy8gaXMgZmlyZWJ1Zz8gaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL2EvMzk4MTIwLzM3Njc3M1xuICAgICh3aW5kb3cuY29uc29sZSAmJiAoY29uc29sZS5maXJlYnVnIHx8IChjb25zb2xlLmV4Y2VwdGlvbiAmJiBjb25zb2xlLnRhYmxlKSkpIHx8XG4gICAgLy8gaXMgZmlyZWZveCA+PSB2MzE/XG4gICAgLy8gaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9Ub29scy9XZWJfQ29uc29sZSNTdHlsaW5nX21lc3NhZ2VzXG4gICAgKG5hdmlnYXRvci51c2VyQWdlbnQudG9Mb3dlckNhc2UoKS5tYXRjaCgvZmlyZWZveFxcLyhcXGQrKS8pICYmIHBhcnNlSW50KFJlZ0V4cC4kMSwgMTApID49IDMxKTtcbn1cblxuLyoqXG4gKiBNYXAgJWogdG8gYEpTT04uc3RyaW5naWZ5KClgLCBzaW5jZSBubyBXZWIgSW5zcGVjdG9ycyBkbyB0aGF0IGJ5IGRlZmF1bHQuXG4gKi9cblxuZXhwb3J0cy5mb3JtYXR0ZXJzLmogPSBmdW5jdGlvbih2KSB7XG4gIHJldHVybiBKU09OLnN0cmluZ2lmeSh2KTtcbn07XG5cblxuLyoqXG4gKiBDb2xvcml6ZSBsb2cgYXJndW1lbnRzIGlmIGVuYWJsZWQuXG4gKlxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5mdW5jdGlvbiBmb3JtYXRBcmdzKCkge1xuICB2YXIgYXJncyA9IGFyZ3VtZW50cztcbiAgdmFyIHVzZUNvbG9ycyA9IHRoaXMudXNlQ29sb3JzO1xuXG4gIGFyZ3NbMF0gPSAodXNlQ29sb3JzID8gJyVjJyA6ICcnKVxuICAgICsgdGhpcy5uYW1lc3BhY2VcbiAgICArICh1c2VDb2xvcnMgPyAnICVjJyA6ICcgJylcbiAgICArIGFyZ3NbMF1cbiAgICArICh1c2VDb2xvcnMgPyAnJWMgJyA6ICcgJylcbiAgICArICcrJyArIGV4cG9ydHMuaHVtYW5pemUodGhpcy5kaWZmKTtcblxuICBpZiAoIXVzZUNvbG9ycykgcmV0dXJuIGFyZ3M7XG5cbiAgdmFyIGMgPSAnY29sb3I6ICcgKyB0aGlzLmNvbG9yO1xuICBhcmdzID0gW2FyZ3NbMF0sIGMsICdjb2xvcjogaW5oZXJpdCddLmNvbmNhdChBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmdzLCAxKSk7XG5cbiAgLy8gdGhlIGZpbmFsIFwiJWNcIiBpcyBzb21ld2hhdCB0cmlja3ksIGJlY2F1c2UgdGhlcmUgY291bGQgYmUgb3RoZXJcbiAgLy8gYXJndW1lbnRzIHBhc3NlZCBlaXRoZXIgYmVmb3JlIG9yIGFmdGVyIHRoZSAlYywgc28gd2UgbmVlZCB0b1xuICAvLyBmaWd1cmUgb3V0IHRoZSBjb3JyZWN0IGluZGV4IHRvIGluc2VydCB0aGUgQ1NTIGludG9cbiAgdmFyIGluZGV4ID0gMDtcbiAgdmFyIGxhc3RDID0gMDtcbiAgYXJnc1swXS5yZXBsYWNlKC8lW2EteiVdL2csIGZ1bmN0aW9uKG1hdGNoKSB7XG4gICAgaWYgKCclJScgPT09IG1hdGNoKSByZXR1cm47XG4gICAgaW5kZXgrKztcbiAgICBpZiAoJyVjJyA9PT0gbWF0Y2gpIHtcbiAgICAgIC8vIHdlIG9ubHkgYXJlIGludGVyZXN0ZWQgaW4gdGhlICpsYXN0KiAlY1xuICAgICAgLy8gKHRoZSB1c2VyIG1heSBoYXZlIHByb3ZpZGVkIHRoZWlyIG93bilcbiAgICAgIGxhc3RDID0gaW5kZXg7XG4gICAgfVxuICB9KTtcblxuICBhcmdzLnNwbGljZShsYXN0QywgMCwgYyk7XG4gIHJldHVybiBhcmdzO1xufVxuXG4vKipcbiAqIEludm9rZXMgYGNvbnNvbGUubG9nKClgIHdoZW4gYXZhaWxhYmxlLlxuICogTm8tb3Agd2hlbiBgY29uc29sZS5sb2dgIGlzIG5vdCBhIFwiZnVuY3Rpb25cIi5cbiAqXG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbmZ1bmN0aW9uIGxvZygpIHtcbiAgLy8gdGhpcyBoYWNrZXJ5IGlzIHJlcXVpcmVkIGZvciBJRTgvOSwgd2hlcmVcbiAgLy8gdGhlIGBjb25zb2xlLmxvZ2AgZnVuY3Rpb24gZG9lc24ndCBoYXZlICdhcHBseSdcbiAgcmV0dXJuICdvYmplY3QnID09PSB0eXBlb2YgY29uc29sZVxuICAgICYmIGNvbnNvbGUubG9nXG4gICAgJiYgRnVuY3Rpb24ucHJvdG90eXBlLmFwcGx5LmNhbGwoY29uc29sZS5sb2csIGNvbnNvbGUsIGFyZ3VtZW50cyk7XG59XG5cbi8qKlxuICogU2F2ZSBgbmFtZXNwYWNlc2AuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IG5hbWVzcGFjZXNcbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIHNhdmUobmFtZXNwYWNlcykge1xuICB0cnkge1xuICAgIGlmIChudWxsID09IG5hbWVzcGFjZXMpIHtcbiAgICAgIHN0b3JhZ2UucmVtb3ZlSXRlbSgnZGVidWcnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgc3RvcmFnZS5kZWJ1ZyA9IG5hbWVzcGFjZXM7XG4gICAgfVxuICB9IGNhdGNoKGUpIHt9XG59XG5cbi8qKlxuICogTG9hZCBgbmFtZXNwYWNlc2AuXG4gKlxuICogQHJldHVybiB7U3RyaW5nfSByZXR1cm5zIHRoZSBwcmV2aW91c2x5IHBlcnNpc3RlZCBkZWJ1ZyBtb2Rlc1xuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gbG9hZCgpIHtcbiAgdmFyIHI7XG4gIHRyeSB7XG4gICAgciA9IHN0b3JhZ2UuZGVidWc7XG4gIH0gY2F0Y2goZSkge31cbiAgcmV0dXJuIHI7XG59XG5cbi8qKlxuICogRW5hYmxlIG5hbWVzcGFjZXMgbGlzdGVkIGluIGBsb2NhbFN0b3JhZ2UuZGVidWdgIGluaXRpYWxseS5cbiAqL1xuXG5leHBvcnRzLmVuYWJsZShsb2FkKCkpO1xuIiwiXG4vKipcbiAqIFRoaXMgaXMgdGhlIGNvbW1vbiBsb2dpYyBmb3IgYm90aCB0aGUgTm9kZS5qcyBhbmQgd2ViIGJyb3dzZXJcbiAqIGltcGxlbWVudGF0aW9ucyBvZiBgZGVidWcoKWAuXG4gKlxuICogRXhwb3NlIGBkZWJ1ZygpYCBhcyB0aGUgbW9kdWxlLlxuICovXG5cbmV4cG9ydHMgPSBtb2R1bGUuZXhwb3J0cyA9IGRlYnVnO1xuZXhwb3J0cy5jb2VyY2UgPSBjb2VyY2U7XG5leHBvcnRzLmRpc2FibGUgPSBkaXNhYmxlO1xuZXhwb3J0cy5lbmFibGUgPSBlbmFibGU7XG5leHBvcnRzLmVuYWJsZWQgPSBlbmFibGVkO1xuZXhwb3J0cy5odW1hbml6ZSA9IHJlcXVpcmUoJ21zJyk7XG5cbi8qKlxuICogVGhlIGN1cnJlbnRseSBhY3RpdmUgZGVidWcgbW9kZSBuYW1lcywgYW5kIG5hbWVzIHRvIHNraXAuXG4gKi9cblxuZXhwb3J0cy5uYW1lcyA9IFtdO1xuZXhwb3J0cy5za2lwcyA9IFtdO1xuXG4vKipcbiAqIE1hcCBvZiBzcGVjaWFsIFwiJW5cIiBoYW5kbGluZyBmdW5jdGlvbnMsIGZvciB0aGUgZGVidWcgXCJmb3JtYXRcIiBhcmd1bWVudC5cbiAqXG4gKiBWYWxpZCBrZXkgbmFtZXMgYXJlIGEgc2luZ2xlLCBsb3dlcmNhc2VkIGxldHRlciwgaS5lLiBcIm5cIi5cbiAqL1xuXG5leHBvcnRzLmZvcm1hdHRlcnMgPSB7fTtcblxuLyoqXG4gKiBQcmV2aW91c2x5IGFzc2lnbmVkIGNvbG9yLlxuICovXG5cbnZhciBwcmV2Q29sb3IgPSAwO1xuXG4vKipcbiAqIFByZXZpb3VzIGxvZyB0aW1lc3RhbXAuXG4gKi9cblxudmFyIHByZXZUaW1lO1xuXG4vKipcbiAqIFNlbGVjdCBhIGNvbG9yLlxuICpcbiAqIEByZXR1cm4ge051bWJlcn1cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIHNlbGVjdENvbG9yKCkge1xuICByZXR1cm4gZXhwb3J0cy5jb2xvcnNbcHJldkNvbG9yKysgJSBleHBvcnRzLmNvbG9ycy5sZW5ndGhdO1xufVxuXG4vKipcbiAqIENyZWF0ZSBhIGRlYnVnZ2VyIHdpdGggdGhlIGdpdmVuIGBuYW1lc3BhY2VgLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lc3BhY2VcbiAqIEByZXR1cm4ge0Z1bmN0aW9ufVxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5mdW5jdGlvbiBkZWJ1ZyhuYW1lc3BhY2UpIHtcblxuICAvLyBkZWZpbmUgdGhlIGBkaXNhYmxlZGAgdmVyc2lvblxuICBmdW5jdGlvbiBkaXNhYmxlZCgpIHtcbiAgfVxuICBkaXNhYmxlZC5lbmFibGVkID0gZmFsc2U7XG5cbiAgLy8gZGVmaW5lIHRoZSBgZW5hYmxlZGAgdmVyc2lvblxuICBmdW5jdGlvbiBlbmFibGVkKCkge1xuXG4gICAgdmFyIHNlbGYgPSBlbmFibGVkO1xuXG4gICAgLy8gc2V0IGBkaWZmYCB0aW1lc3RhbXBcbiAgICB2YXIgY3VyciA9ICtuZXcgRGF0ZSgpO1xuICAgIHZhciBtcyA9IGN1cnIgLSAocHJldlRpbWUgfHwgY3Vycik7XG4gICAgc2VsZi5kaWZmID0gbXM7XG4gICAgc2VsZi5wcmV2ID0gcHJldlRpbWU7XG4gICAgc2VsZi5jdXJyID0gY3VycjtcbiAgICBwcmV2VGltZSA9IGN1cnI7XG5cbiAgICAvLyBhZGQgdGhlIGBjb2xvcmAgaWYgbm90IHNldFxuICAgIGlmIChudWxsID09IHNlbGYudXNlQ29sb3JzKSBzZWxmLnVzZUNvbG9ycyA9IGV4cG9ydHMudXNlQ29sb3JzKCk7XG4gICAgaWYgKG51bGwgPT0gc2VsZi5jb2xvciAmJiBzZWxmLnVzZUNvbG9ycykgc2VsZi5jb2xvciA9IHNlbGVjdENvbG9yKCk7XG5cbiAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cyk7XG5cbiAgICBhcmdzWzBdID0gZXhwb3J0cy5jb2VyY2UoYXJnc1swXSk7XG5cbiAgICBpZiAoJ3N0cmluZycgIT09IHR5cGVvZiBhcmdzWzBdKSB7XG4gICAgICAvLyBhbnl0aGluZyBlbHNlIGxldCdzIGluc3BlY3Qgd2l0aCAlb1xuICAgICAgYXJncyA9IFsnJW8nXS5jb25jYXQoYXJncyk7XG4gICAgfVxuXG4gICAgLy8gYXBwbHkgYW55IGBmb3JtYXR0ZXJzYCB0cmFuc2Zvcm1hdGlvbnNcbiAgICB2YXIgaW5kZXggPSAwO1xuICAgIGFyZ3NbMF0gPSBhcmdzWzBdLnJlcGxhY2UoLyUoW2EteiVdKS9nLCBmdW5jdGlvbihtYXRjaCwgZm9ybWF0KSB7XG4gICAgICAvLyBpZiB3ZSBlbmNvdW50ZXIgYW4gZXNjYXBlZCAlIHRoZW4gZG9uJ3QgaW5jcmVhc2UgdGhlIGFycmF5IGluZGV4XG4gICAgICBpZiAobWF0Y2ggPT09ICclJScpIHJldHVybiBtYXRjaDtcbiAgICAgIGluZGV4Kys7XG4gICAgICB2YXIgZm9ybWF0dGVyID0gZXhwb3J0cy5mb3JtYXR0ZXJzW2Zvcm1hdF07XG4gICAgICBpZiAoJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGZvcm1hdHRlcikge1xuICAgICAgICB2YXIgdmFsID0gYXJnc1tpbmRleF07XG4gICAgICAgIG1hdGNoID0gZm9ybWF0dGVyLmNhbGwoc2VsZiwgdmFsKTtcblxuICAgICAgICAvLyBub3cgd2UgbmVlZCB0byByZW1vdmUgYGFyZ3NbaW5kZXhdYCBzaW5jZSBpdCdzIGlubGluZWQgaW4gdGhlIGBmb3JtYXRgXG4gICAgICAgIGFyZ3Muc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgaW5kZXgtLTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBtYXRjaDtcbiAgICB9KTtcblxuICAgIGlmICgnZnVuY3Rpb24nID09PSB0eXBlb2YgZXhwb3J0cy5mb3JtYXRBcmdzKSB7XG4gICAgICBhcmdzID0gZXhwb3J0cy5mb3JtYXRBcmdzLmFwcGx5KHNlbGYsIGFyZ3MpO1xuICAgIH1cbiAgICB2YXIgbG9nRm4gPSBlbmFibGVkLmxvZyB8fCBleHBvcnRzLmxvZyB8fCBjb25zb2xlLmxvZy5iaW5kKGNvbnNvbGUpO1xuICAgIGxvZ0ZuLmFwcGx5KHNlbGYsIGFyZ3MpO1xuICB9XG4gIGVuYWJsZWQuZW5hYmxlZCA9IHRydWU7XG5cbiAgdmFyIGZuID0gZXhwb3J0cy5lbmFibGVkKG5hbWVzcGFjZSkgPyBlbmFibGVkIDogZGlzYWJsZWQ7XG5cbiAgZm4ubmFtZXNwYWNlID0gbmFtZXNwYWNlO1xuXG4gIHJldHVybiBmbjtcbn1cblxuLyoqXG4gKiBFbmFibGVzIGEgZGVidWcgbW9kZSBieSBuYW1lc3BhY2VzLiBUaGlzIGNhbiBpbmNsdWRlIG1vZGVzXG4gKiBzZXBhcmF0ZWQgYnkgYSBjb2xvbiBhbmQgd2lsZGNhcmRzLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lc3BhY2VzXG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbmZ1bmN0aW9uIGVuYWJsZShuYW1lc3BhY2VzKSB7XG4gIGV4cG9ydHMuc2F2ZShuYW1lc3BhY2VzKTtcblxuICB2YXIgc3BsaXQgPSAobmFtZXNwYWNlcyB8fCAnJykuc3BsaXQoL1tcXHMsXSsvKTtcbiAgdmFyIGxlbiA9IHNwbGl0Lmxlbmd0aDtcblxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgaWYgKCFzcGxpdFtpXSkgY29udGludWU7IC8vIGlnbm9yZSBlbXB0eSBzdHJpbmdzXG4gICAgbmFtZXNwYWNlcyA9IHNwbGl0W2ldLnJlcGxhY2UoL1xcKi9nLCAnLio/Jyk7XG4gICAgaWYgKG5hbWVzcGFjZXNbMF0gPT09ICctJykge1xuICAgICAgZXhwb3J0cy5za2lwcy5wdXNoKG5ldyBSZWdFeHAoJ14nICsgbmFtZXNwYWNlcy5zdWJzdHIoMSkgKyAnJCcpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgZXhwb3J0cy5uYW1lcy5wdXNoKG5ldyBSZWdFeHAoJ14nICsgbmFtZXNwYWNlcyArICckJykpO1xuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIERpc2FibGUgZGVidWcgb3V0cHV0LlxuICpcbiAqIEBhcGkgcHVibGljXG4gKi9cblxuZnVuY3Rpb24gZGlzYWJsZSgpIHtcbiAgZXhwb3J0cy5lbmFibGUoJycpO1xufVxuXG4vKipcbiAqIFJldHVybnMgdHJ1ZSBpZiB0aGUgZ2l2ZW4gbW9kZSBuYW1lIGlzIGVuYWJsZWQsIGZhbHNlIG90aGVyd2lzZS5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gbmFtZVxuICogQHJldHVybiB7Qm9vbGVhbn1cbiAqIEBhcGkgcHVibGljXG4gKi9cblxuZnVuY3Rpb24gZW5hYmxlZChuYW1lKSB7XG4gIHZhciBpLCBsZW47XG4gIGZvciAoaSA9IDAsIGxlbiA9IGV4cG9ydHMuc2tpcHMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICBpZiAoZXhwb3J0cy5za2lwc1tpXS50ZXN0KG5hbWUpKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG4gIGZvciAoaSA9IDAsIGxlbiA9IGV4cG9ydHMubmFtZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICBpZiAoZXhwb3J0cy5uYW1lc1tpXS50ZXN0KG5hbWUpKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGZhbHNlO1xufVxuXG4vKipcbiAqIENvZXJjZSBgdmFsYC5cbiAqXG4gKiBAcGFyYW0ge01peGVkfSB2YWxcbiAqIEByZXR1cm4ge01peGVkfVxuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gY29lcmNlKHZhbCkge1xuICBpZiAodmFsIGluc3RhbmNlb2YgRXJyb3IpIHJldHVybiB2YWwuc3RhY2sgfHwgdmFsLm1lc3NhZ2U7XG4gIHJldHVybiB2YWw7XG59XG4iLCIvKipcbiAqIEhlbHBlcnMuXG4gKi9cblxudmFyIHMgPSAxMDAwO1xudmFyIG0gPSBzICogNjA7XG52YXIgaCA9IG0gKiA2MDtcbnZhciBkID0gaCAqIDI0O1xudmFyIHkgPSBkICogMzY1LjI1O1xuXG4vKipcbiAqIFBhcnNlIG9yIGZvcm1hdCB0aGUgZ2l2ZW4gYHZhbGAuXG4gKlxuICogT3B0aW9uczpcbiAqXG4gKiAgLSBgbG9uZ2AgdmVyYm9zZSBmb3JtYXR0aW5nIFtmYWxzZV1cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ3xOdW1iZXJ9IHZhbFxuICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnNcbiAqIEByZXR1cm4ge1N0cmluZ3xOdW1iZXJ9XG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24odmFsLCBvcHRpb25zKXtcbiAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG4gIGlmICgnc3RyaW5nJyA9PSB0eXBlb2YgdmFsKSByZXR1cm4gcGFyc2UodmFsKTtcbiAgcmV0dXJuIG9wdGlvbnMubG9uZ1xuICAgID8gbG9uZyh2YWwpXG4gICAgOiBzaG9ydCh2YWwpO1xufTtcblxuLyoqXG4gKiBQYXJzZSB0aGUgZ2l2ZW4gYHN0cmAgYW5kIHJldHVybiBtaWxsaXNlY29uZHMuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHN0clxuICogQHJldHVybiB7TnVtYmVyfVxuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gcGFyc2Uoc3RyKSB7XG4gIHZhciBtYXRjaCA9IC9eKCg/OlxcZCspP1xcLj9cXGQrKSAqKG1zfHNlY29uZHM/fHN8bWludXRlcz98bXxob3Vycz98aHxkYXlzP3xkfHllYXJzP3x5KT8kL2kuZXhlYyhzdHIpO1xuICBpZiAoIW1hdGNoKSByZXR1cm47XG4gIHZhciBuID0gcGFyc2VGbG9hdChtYXRjaFsxXSk7XG4gIHZhciB0eXBlID0gKG1hdGNoWzJdIHx8ICdtcycpLnRvTG93ZXJDYXNlKCk7XG4gIHN3aXRjaCAodHlwZSkge1xuICAgIGNhc2UgJ3llYXJzJzpcbiAgICBjYXNlICd5ZWFyJzpcbiAgICBjYXNlICd5JzpcbiAgICAgIHJldHVybiBuICogeTtcbiAgICBjYXNlICdkYXlzJzpcbiAgICBjYXNlICdkYXknOlxuICAgIGNhc2UgJ2QnOlxuICAgICAgcmV0dXJuIG4gKiBkO1xuICAgIGNhc2UgJ2hvdXJzJzpcbiAgICBjYXNlICdob3VyJzpcbiAgICBjYXNlICdoJzpcbiAgICAgIHJldHVybiBuICogaDtcbiAgICBjYXNlICdtaW51dGVzJzpcbiAgICBjYXNlICdtaW51dGUnOlxuICAgIGNhc2UgJ20nOlxuICAgICAgcmV0dXJuIG4gKiBtO1xuICAgIGNhc2UgJ3NlY29uZHMnOlxuICAgIGNhc2UgJ3NlY29uZCc6XG4gICAgY2FzZSAncyc6XG4gICAgICByZXR1cm4gbiAqIHM7XG4gICAgY2FzZSAnbXMnOlxuICAgICAgcmV0dXJuIG47XG4gIH1cbn1cblxuLyoqXG4gKiBTaG9ydCBmb3JtYXQgZm9yIGBtc2AuXG4gKlxuICogQHBhcmFtIHtOdW1iZXJ9IG1zXG4gKiBAcmV0dXJuIHtTdHJpbmd9XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBzaG9ydChtcykge1xuICBpZiAobXMgPj0gZCkgcmV0dXJuIE1hdGgucm91bmQobXMgLyBkKSArICdkJztcbiAgaWYgKG1zID49IGgpIHJldHVybiBNYXRoLnJvdW5kKG1zIC8gaCkgKyAnaCc7XG4gIGlmIChtcyA+PSBtKSByZXR1cm4gTWF0aC5yb3VuZChtcyAvIG0pICsgJ20nO1xuICBpZiAobXMgPj0gcykgcmV0dXJuIE1hdGgucm91bmQobXMgLyBzKSArICdzJztcbiAgcmV0dXJuIG1zICsgJ21zJztcbn1cblxuLyoqXG4gKiBMb25nIGZvcm1hdCBmb3IgYG1zYC5cbiAqXG4gKiBAcGFyYW0ge051bWJlcn0gbXNcbiAqIEByZXR1cm4ge1N0cmluZ31cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIGxvbmcobXMpIHtcbiAgcmV0dXJuIHBsdXJhbChtcywgZCwgJ2RheScpXG4gICAgfHwgcGx1cmFsKG1zLCBoLCAnaG91cicpXG4gICAgfHwgcGx1cmFsKG1zLCBtLCAnbWludXRlJylcbiAgICB8fCBwbHVyYWwobXMsIHMsICdzZWNvbmQnKVxuICAgIHx8IG1zICsgJyBtcyc7XG59XG5cbi8qKlxuICogUGx1cmFsaXphdGlvbiBoZWxwZXIuXG4gKi9cblxuZnVuY3Rpb24gcGx1cmFsKG1zLCBuLCBuYW1lKSB7XG4gIGlmIChtcyA8IG4pIHJldHVybjtcbiAgaWYgKG1zIDwgbiAqIDEuNSkgcmV0dXJuIE1hdGguZmxvb3IobXMgLyBuKSArICcgJyArIG5hbWU7XG4gIHJldHVybiBNYXRoLmNlaWwobXMgLyBuKSArICcgJyArIG5hbWUgKyAncyc7XG59XG4iLCJ2YXIgaGFzT3duID0gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eTtcbnZhciB0b1N0cmluZyA9IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmc7XG52YXIgdW5kZWZpbmVkO1xuXG52YXIgaXNQbGFpbk9iamVjdCA9IGZ1bmN0aW9uIGlzUGxhaW5PYmplY3Qob2JqKSB7XG4gICAgXCJ1c2Ugc3RyaWN0XCI7XG4gICAgaWYgKCFvYmogfHwgdG9TdHJpbmcuY2FsbChvYmopICE9PSAnW29iamVjdCBPYmplY3RdJyB8fCBvYmoubm9kZVR5cGUgfHwgb2JqLnNldEludGVydmFsKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICB2YXIgaGFzX293bl9jb25zdHJ1Y3RvciA9IGhhc093bi5jYWxsKG9iaiwgJ2NvbnN0cnVjdG9yJyk7XG4gICAgdmFyIGhhc19pc19wcm9wZXJ0eV9vZl9tZXRob2QgPSBvYmouY29uc3RydWN0b3IgJiYgb2JqLmNvbnN0cnVjdG9yLnByb3RvdHlwZSAmJiBoYXNPd24uY2FsbChvYmouY29uc3RydWN0b3IucHJvdG90eXBlLCAnaXNQcm90b3R5cGVPZicpO1xuICAgIC8vIE5vdCBvd24gY29uc3RydWN0b3IgcHJvcGVydHkgbXVzdCBiZSBPYmplY3RcbiAgICBpZiAob2JqLmNvbnN0cnVjdG9yICYmICFoYXNfb3duX2NvbnN0cnVjdG9yICYmICFoYXNfaXNfcHJvcGVydHlfb2ZfbWV0aG9kKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICAvLyBPd24gcHJvcGVydGllcyBhcmUgZW51bWVyYXRlZCBmaXJzdGx5LCBzbyB0byBzcGVlZCB1cCxcbiAgICAvLyBpZiBsYXN0IG9uZSBpcyBvd24sIHRoZW4gYWxsIHByb3BlcnRpZXMgYXJlIG93bi5cbiAgICB2YXIga2V5O1xuICAgIGZvciAoa2V5IGluIG9iaikge31cblxuICAgIHJldHVybiBrZXkgPT09IHVuZGVmaW5lZCB8fCBoYXNPd24uY2FsbChvYmosIGtleSk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGV4dGVuZCgpIHtcbiAgICBcInVzZSBzdHJpY3RcIjtcbiAgICB2YXIgb3B0aW9ucywgbmFtZSwgc3JjLCBjb3B5LCBjb3B5SXNBcnJheSwgY2xvbmUsXG4gICAgICAgIHRhcmdldCA9IGFyZ3VtZW50c1swXSxcbiAgICAgICAgaSA9IDEsXG4gICAgICAgIGxlbmd0aCA9IGFyZ3VtZW50cy5sZW5ndGgsXG4gICAgICAgIGRlZXAgPSBmYWxzZTtcblxuICAgIC8vIEhhbmRsZSBhIGRlZXAgY29weSBzaXR1YXRpb25cbiAgICBpZiAodHlwZW9mIHRhcmdldCA9PT0gXCJib29sZWFuXCIpIHtcbiAgICAgICAgZGVlcCA9IHRhcmdldDtcbiAgICAgICAgdGFyZ2V0ID0gYXJndW1lbnRzWzFdIHx8IHt9O1xuICAgICAgICAvLyBza2lwIHRoZSBib29sZWFuIGFuZCB0aGUgdGFyZ2V0XG4gICAgICAgIGkgPSAyO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIHRhcmdldCAhPT0gXCJvYmplY3RcIiAmJiB0eXBlb2YgdGFyZ2V0ICE9PSBcImZ1bmN0aW9uXCIgfHwgdGFyZ2V0ID09IHVuZGVmaW5lZCkge1xuICAgICAgICB0YXJnZXQgPSB7fTtcbiAgICB9XG5cbiAgICBmb3IgKDsgaSA8IGxlbmd0aDsgKytpKSB7XG4gICAgICAgIC8vIE9ubHkgZGVhbCB3aXRoIG5vbi1udWxsL3VuZGVmaW5lZCB2YWx1ZXNcbiAgICAgICAgaWYgKChvcHRpb25zID0gYXJndW1lbnRzW2ldKSAhPSBudWxsKSB7XG4gICAgICAgICAgICAvLyBFeHRlbmQgdGhlIGJhc2Ugb2JqZWN0XG4gICAgICAgICAgICBmb3IgKG5hbWUgaW4gb3B0aW9ucykge1xuICAgICAgICAgICAgICAgIHNyYyA9IHRhcmdldFtuYW1lXTtcbiAgICAgICAgICAgICAgICBjb3B5ID0gb3B0aW9uc1tuYW1lXTtcblxuICAgICAgICAgICAgICAgIC8vIFByZXZlbnQgbmV2ZXItZW5kaW5nIGxvb3BcbiAgICAgICAgICAgICAgICBpZiAodGFyZ2V0ID09PSBjb3B5KSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIFJlY3Vyc2UgaWYgd2UncmUgbWVyZ2luZyBwbGFpbiBvYmplY3RzIG9yIGFycmF5c1xuICAgICAgICAgICAgICAgIGlmIChkZWVwICYmIGNvcHkgJiYgKGlzUGxhaW5PYmplY3QoY29weSkgfHwgKGNvcHlJc0FycmF5ID0gQXJyYXkuaXNBcnJheShjb3B5KSkpKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChjb3B5SXNBcnJheSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29weUlzQXJyYXkgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsb25lID0gc3JjICYmIEFycmF5LmlzQXJyYXkoc3JjKSA/IHNyYyA6IFtdO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgY2xvbmUgPSBzcmMgJiYgaXNQbGFpbk9iamVjdChzcmMpID8gc3JjIDoge307XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAvLyBOZXZlciBtb3ZlIG9yaWdpbmFsIG9iamVjdHMsIGNsb25lIHRoZW1cbiAgICAgICAgICAgICAgICAgICAgdGFyZ2V0W25hbWVdID0gZXh0ZW5kKGRlZXAsIGNsb25lLCBjb3B5KTtcblxuICAgICAgICAgICAgICAgICAgICAvLyBEb24ndCBicmluZyBpbiB1bmRlZmluZWQgdmFsdWVzXG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChjb3B5ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgdGFyZ2V0W25hbWVdID0gY29weTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBSZXR1cm4gdGhlIG1vZGlmaWVkIG9iamVjdFxuICAgIHJldHVybiB0YXJnZXQ7XG59O1xuXG4iLCIndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0gSU5URVJOQUw7XG5cbmZ1bmN0aW9uIElOVEVSTkFMKCkge30iLCIndXNlIHN0cmljdCc7XG52YXIgUHJvbWlzZSA9IHJlcXVpcmUoJy4vcHJvbWlzZScpO1xudmFyIHJlamVjdCA9IHJlcXVpcmUoJy4vcmVqZWN0Jyk7XG52YXIgcmVzb2x2ZSA9IHJlcXVpcmUoJy4vcmVzb2x2ZScpO1xudmFyIElOVEVSTkFMID0gcmVxdWlyZSgnLi9JTlRFUk5BTCcpO1xudmFyIGhhbmRsZXJzID0gcmVxdWlyZSgnLi9oYW5kbGVycycpO1xubW9kdWxlLmV4cG9ydHMgPSBhbGw7XG5mdW5jdGlvbiBhbGwoaXRlcmFibGUpIHtcbiAgaWYgKE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChpdGVyYWJsZSkgIT09ICdbb2JqZWN0IEFycmF5XScpIHtcbiAgICByZXR1cm4gcmVqZWN0KG5ldyBUeXBlRXJyb3IoJ211c3QgYmUgYW4gYXJyYXknKSk7XG4gIH1cblxuICB2YXIgbGVuID0gaXRlcmFibGUubGVuZ3RoO1xuICB2YXIgY2FsbGVkID0gZmFsc2U7XG4gIGlmICghbGVuKSB7XG4gICAgcmV0dXJuIHJlc29sdmUoW10pO1xuICB9XG5cbiAgdmFyIHZhbHVlcyA9IG5ldyBBcnJheShsZW4pO1xuICB2YXIgcmVzb2x2ZWQgPSAwO1xuICB2YXIgaSA9IC0xO1xuICB2YXIgcHJvbWlzZSA9IG5ldyBQcm9taXNlKElOVEVSTkFMKTtcbiAgXG4gIHdoaWxlICgrK2kgPCBsZW4pIHtcbiAgICBhbGxSZXNvbHZlcihpdGVyYWJsZVtpXSwgaSk7XG4gIH1cbiAgcmV0dXJuIHByb21pc2U7XG4gIGZ1bmN0aW9uIGFsbFJlc29sdmVyKHZhbHVlLCBpKSB7XG4gICAgcmVzb2x2ZSh2YWx1ZSkudGhlbihyZXNvbHZlRnJvbUFsbCwgZnVuY3Rpb24gKGVycm9yKSB7XG4gICAgICBpZiAoIWNhbGxlZCkge1xuICAgICAgICBjYWxsZWQgPSB0cnVlO1xuICAgICAgICBoYW5kbGVycy5yZWplY3QocHJvbWlzZSwgZXJyb3IpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIGZ1bmN0aW9uIHJlc29sdmVGcm9tQWxsKG91dFZhbHVlKSB7XG4gICAgICB2YWx1ZXNbaV0gPSBvdXRWYWx1ZTtcbiAgICAgIGlmICgrK3Jlc29sdmVkID09PSBsZW4gJiAhY2FsbGVkKSB7XG4gICAgICAgIGNhbGxlZCA9IHRydWU7XG4gICAgICAgIGhhbmRsZXJzLnJlc29sdmUocHJvbWlzZSwgdmFsdWVzKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn0iLCIndXNlIHN0cmljdCc7XG52YXIgdHJ5Q2F0Y2ggPSByZXF1aXJlKCcuL3RyeUNhdGNoJyk7XG52YXIgcmVzb2x2ZVRoZW5hYmxlID0gcmVxdWlyZSgnLi9yZXNvbHZlVGhlbmFibGUnKTtcbnZhciBzdGF0ZXMgPSByZXF1aXJlKCcuL3N0YXRlcycpO1xuXG5leHBvcnRzLnJlc29sdmUgPSBmdW5jdGlvbiAoc2VsZiwgdmFsdWUpIHtcbiAgdmFyIHJlc3VsdCA9IHRyeUNhdGNoKGdldFRoZW4sIHZhbHVlKTtcbiAgaWYgKHJlc3VsdC5zdGF0dXMgPT09ICdlcnJvcicpIHtcbiAgICByZXR1cm4gZXhwb3J0cy5yZWplY3Qoc2VsZiwgcmVzdWx0LnZhbHVlKTtcbiAgfVxuICB2YXIgdGhlbmFibGUgPSByZXN1bHQudmFsdWU7XG5cbiAgaWYgKHRoZW5hYmxlKSB7XG4gICAgcmVzb2x2ZVRoZW5hYmxlLnNhZmVseShzZWxmLCB0aGVuYWJsZSk7XG4gIH0gZWxzZSB7XG4gICAgc2VsZi5zdGF0ZSA9IHN0YXRlcy5GVUxGSUxMRUQ7XG4gICAgc2VsZi5vdXRjb21lID0gdmFsdWU7XG4gICAgdmFyIGkgPSAtMTtcbiAgICB2YXIgbGVuID0gc2VsZi5xdWV1ZS5sZW5ndGg7XG4gICAgd2hpbGUgKCsraSA8IGxlbikge1xuICAgICAgc2VsZi5xdWV1ZVtpXS5jYWxsRnVsZmlsbGVkKHZhbHVlKTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHNlbGY7XG59O1xuZXhwb3J0cy5yZWplY3QgPSBmdW5jdGlvbiAoc2VsZiwgZXJyb3IpIHtcbiAgc2VsZi5zdGF0ZSA9IHN0YXRlcy5SRUpFQ1RFRDtcbiAgc2VsZi5vdXRjb21lID0gZXJyb3I7XG4gIHZhciBpID0gLTE7XG4gIHZhciBsZW4gPSBzZWxmLnF1ZXVlLmxlbmd0aDtcbiAgd2hpbGUgKCsraSA8IGxlbikge1xuICAgIHNlbGYucXVldWVbaV0uY2FsbFJlamVjdGVkKGVycm9yKTtcbiAgfVxuICByZXR1cm4gc2VsZjtcbn07XG5cbmZ1bmN0aW9uIGdldFRoZW4ob2JqKSB7XG4gIC8vIE1ha2Ugc3VyZSB3ZSBvbmx5IGFjY2VzcyB0aGUgYWNjZXNzb3Igb25jZSBhcyByZXF1aXJlZCBieSB0aGUgc3BlY1xuICB2YXIgdGhlbiA9IG9iaiAmJiBvYmoudGhlbjtcbiAgaWYgKG9iaiAmJiB0eXBlb2Ygb2JqID09PSAnb2JqZWN0JyAmJiB0eXBlb2YgdGhlbiA9PT0gJ2Z1bmN0aW9uJykge1xuICAgIHJldHVybiBmdW5jdGlvbiBhcHB5VGhlbigpIHtcbiAgICAgIHRoZW4uYXBwbHkob2JqLCBhcmd1bWVudHMpO1xuICAgIH07XG4gIH1cbn0iLCJtb2R1bGUuZXhwb3J0cyA9IGV4cG9ydHMgPSByZXF1aXJlKCcuL3Byb21pc2UnKTtcblxuZXhwb3J0cy5yZXNvbHZlID0gcmVxdWlyZSgnLi9yZXNvbHZlJyk7XG5leHBvcnRzLnJlamVjdCA9IHJlcXVpcmUoJy4vcmVqZWN0Jyk7XG5leHBvcnRzLmFsbCA9IHJlcXVpcmUoJy4vYWxsJyk7XG5leHBvcnRzLnJhY2UgPSByZXF1aXJlKCcuL3JhY2UnKTsiLCIndXNlIHN0cmljdCc7XG5cbnZhciB1bndyYXAgPSByZXF1aXJlKCcuL3Vud3JhcCcpO1xudmFyIElOVEVSTkFMID0gcmVxdWlyZSgnLi9JTlRFUk5BTCcpO1xudmFyIHJlc29sdmVUaGVuYWJsZSA9IHJlcXVpcmUoJy4vcmVzb2x2ZVRoZW5hYmxlJyk7XG52YXIgc3RhdGVzID0gcmVxdWlyZSgnLi9zdGF0ZXMnKTtcbnZhciBRdWV1ZUl0ZW0gPSByZXF1aXJlKCcuL3F1ZXVlSXRlbScpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFByb21pc2U7XG5mdW5jdGlvbiBQcm9taXNlKHJlc29sdmVyKSB7XG4gIGlmICghKHRoaXMgaW5zdGFuY2VvZiBQcm9taXNlKSkge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZShyZXNvbHZlcik7XG4gIH1cbiAgaWYgKHR5cGVvZiByZXNvbHZlciAhPT0gJ2Z1bmN0aW9uJykge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ3Jlc29sdmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuICB9XG4gIHRoaXMuc3RhdGUgPSBzdGF0ZXMuUEVORElORztcbiAgdGhpcy5xdWV1ZSA9IFtdO1xuICB0aGlzLm91dGNvbWUgPSB2b2lkIDA7XG4gIGlmIChyZXNvbHZlciAhPT0gSU5URVJOQUwpIHtcbiAgICByZXNvbHZlVGhlbmFibGUuc2FmZWx5KHRoaXMsIHJlc29sdmVyKTtcbiAgfVxufVxuXG5Qcm9taXNlLnByb3RvdHlwZVsnY2F0Y2gnXSA9IGZ1bmN0aW9uIChvblJlamVjdGVkKSB7XG4gIHJldHVybiB0aGlzLnRoZW4obnVsbCwgb25SZWplY3RlZCk7XG59O1xuUHJvbWlzZS5wcm90b3R5cGUudGhlbiA9IGZ1bmN0aW9uIChvbkZ1bGZpbGxlZCwgb25SZWplY3RlZCkge1xuICBpZiAodHlwZW9mIG9uRnVsZmlsbGVkICE9PSAnZnVuY3Rpb24nICYmIHRoaXMuc3RhdGUgPT09IHN0YXRlcy5GVUxGSUxMRUQgfHxcbiAgICB0eXBlb2Ygb25SZWplY3RlZCAhPT0gJ2Z1bmN0aW9uJyAmJiB0aGlzLnN0YXRlID09PSBzdGF0ZXMuUkVKRUNURUQpIHtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuICB2YXIgcHJvbWlzZSA9IG5ldyBQcm9taXNlKElOVEVSTkFMKTtcblxuICBcbiAgaWYgKHRoaXMuc3RhdGUgIT09IHN0YXRlcy5QRU5ESU5HKSB7XG4gICAgdmFyIHJlc29sdmVyID0gdGhpcy5zdGF0ZSA9PT0gc3RhdGVzLkZVTEZJTExFRCA/IG9uRnVsZmlsbGVkOiBvblJlamVjdGVkO1xuICAgIHVud3JhcChwcm9taXNlLCByZXNvbHZlciwgdGhpcy5vdXRjb21lKTtcbiAgfSBlbHNlIHtcbiAgICB0aGlzLnF1ZXVlLnB1c2gobmV3IFF1ZXVlSXRlbShwcm9taXNlLCBvbkZ1bGZpbGxlZCwgb25SZWplY3RlZCkpO1xuICB9XG5cbiAgcmV0dXJuIHByb21pc2U7XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xudmFyIGhhbmRsZXJzID0gcmVxdWlyZSgnLi9oYW5kbGVycycpO1xudmFyIHVud3JhcCA9IHJlcXVpcmUoJy4vdW53cmFwJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gUXVldWVJdGVtO1xuZnVuY3Rpb24gUXVldWVJdGVtKHByb21pc2UsIG9uRnVsZmlsbGVkLCBvblJlamVjdGVkKSB7XG4gIHRoaXMucHJvbWlzZSA9IHByb21pc2U7XG4gIGlmICh0eXBlb2Ygb25GdWxmaWxsZWQgPT09ICdmdW5jdGlvbicpIHtcbiAgICB0aGlzLm9uRnVsZmlsbGVkID0gb25GdWxmaWxsZWQ7XG4gICAgdGhpcy5jYWxsRnVsZmlsbGVkID0gdGhpcy5vdGhlckNhbGxGdWxmaWxsZWQ7XG4gIH1cbiAgaWYgKHR5cGVvZiBvblJlamVjdGVkID09PSAnZnVuY3Rpb24nKSB7XG4gICAgdGhpcy5vblJlamVjdGVkID0gb25SZWplY3RlZDtcbiAgICB0aGlzLmNhbGxSZWplY3RlZCA9IHRoaXMub3RoZXJDYWxsUmVqZWN0ZWQ7XG4gIH1cbn1cblF1ZXVlSXRlbS5wcm90b3R5cGUuY2FsbEZ1bGZpbGxlZCA9IGZ1bmN0aW9uICh2YWx1ZSkge1xuICBoYW5kbGVycy5yZXNvbHZlKHRoaXMucHJvbWlzZSwgdmFsdWUpO1xufTtcblF1ZXVlSXRlbS5wcm90b3R5cGUub3RoZXJDYWxsRnVsZmlsbGVkID0gZnVuY3Rpb24gKHZhbHVlKSB7XG4gIHVud3JhcCh0aGlzLnByb21pc2UsIHRoaXMub25GdWxmaWxsZWQsIHZhbHVlKTtcbn07XG5RdWV1ZUl0ZW0ucHJvdG90eXBlLmNhbGxSZWplY3RlZCA9IGZ1bmN0aW9uICh2YWx1ZSkge1xuICBoYW5kbGVycy5yZWplY3QodGhpcy5wcm9taXNlLCB2YWx1ZSk7XG59O1xuUXVldWVJdGVtLnByb3RvdHlwZS5vdGhlckNhbGxSZWplY3RlZCA9IGZ1bmN0aW9uICh2YWx1ZSkge1xuICB1bndyYXAodGhpcy5wcm9taXNlLCB0aGlzLm9uUmVqZWN0ZWQsIHZhbHVlKTtcbn07IiwiJ3VzZSBzdHJpY3QnO1xudmFyIFByb21pc2UgPSByZXF1aXJlKCcuL3Byb21pc2UnKTtcbnZhciByZWplY3QgPSByZXF1aXJlKCcuL3JlamVjdCcpO1xudmFyIHJlc29sdmUgPSByZXF1aXJlKCcuL3Jlc29sdmUnKTtcbnZhciBJTlRFUk5BTCA9IHJlcXVpcmUoJy4vSU5URVJOQUwnKTtcbnZhciBoYW5kbGVycyA9IHJlcXVpcmUoJy4vaGFuZGxlcnMnKTtcbm1vZHVsZS5leHBvcnRzID0gcmFjZTtcbmZ1bmN0aW9uIHJhY2UoaXRlcmFibGUpIHtcbiAgaWYgKE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChpdGVyYWJsZSkgIT09ICdbb2JqZWN0IEFycmF5XScpIHtcbiAgICByZXR1cm4gcmVqZWN0KG5ldyBUeXBlRXJyb3IoJ211c3QgYmUgYW4gYXJyYXknKSk7XG4gIH1cblxuICB2YXIgbGVuID0gaXRlcmFibGUubGVuZ3RoO1xuICB2YXIgY2FsbGVkID0gZmFsc2U7XG4gIGlmICghbGVuKSB7XG4gICAgcmV0dXJuIHJlc29sdmUoW10pO1xuICB9XG5cbiAgdmFyIHJlc29sdmVkID0gMDtcbiAgdmFyIGkgPSAtMTtcbiAgdmFyIHByb21pc2UgPSBuZXcgUHJvbWlzZShJTlRFUk5BTCk7XG4gIFxuICB3aGlsZSAoKytpIDwgbGVuKSB7XG4gICAgcmVzb2x2ZXIoaXRlcmFibGVbaV0pO1xuICB9XG4gIHJldHVybiBwcm9taXNlO1xuICBmdW5jdGlvbiByZXNvbHZlcih2YWx1ZSkge1xuICAgIHJlc29sdmUodmFsdWUpLnRoZW4oZnVuY3Rpb24gKHJlc3BvbnNlKSB7XG4gICAgICBpZiAoIWNhbGxlZCkge1xuICAgICAgICBjYWxsZWQgPSB0cnVlO1xuICAgICAgICBoYW5kbGVycy5yZXNvbHZlKHByb21pc2UsIHJlc3BvbnNlKTtcbiAgICAgIH1cbiAgICB9LCBmdW5jdGlvbiAoZXJyb3IpIHtcbiAgICAgIGlmICghY2FsbGVkKSB7XG4gICAgICAgIGNhbGxlZCA9IHRydWU7XG4gICAgICAgIGhhbmRsZXJzLnJlamVjdChwcm9taXNlLCBlcnJvcik7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cbn0iLCIndXNlIHN0cmljdCc7XG5cbnZhciBQcm9taXNlID0gcmVxdWlyZSgnLi9wcm9taXNlJyk7XG52YXIgSU5URVJOQUwgPSByZXF1aXJlKCcuL0lOVEVSTkFMJyk7XG52YXIgaGFuZGxlcnMgPSByZXF1aXJlKCcuL2hhbmRsZXJzJyk7XG5tb2R1bGUuZXhwb3J0cyA9IHJlamVjdDtcblxuZnVuY3Rpb24gcmVqZWN0KHJlYXNvbikge1xuXHR2YXIgcHJvbWlzZSA9IG5ldyBQcm9taXNlKElOVEVSTkFMKTtcblx0cmV0dXJuIGhhbmRsZXJzLnJlamVjdChwcm9taXNlLCByZWFzb24pO1xufSIsIid1c2Ugc3RyaWN0JztcblxudmFyIFByb21pc2UgPSByZXF1aXJlKCcuL3Byb21pc2UnKTtcbnZhciBJTlRFUk5BTCA9IHJlcXVpcmUoJy4vSU5URVJOQUwnKTtcbnZhciBoYW5kbGVycyA9IHJlcXVpcmUoJy4vaGFuZGxlcnMnKTtcbm1vZHVsZS5leHBvcnRzID0gcmVzb2x2ZTtcblxudmFyIEZBTFNFID0gaGFuZGxlcnMucmVzb2x2ZShuZXcgUHJvbWlzZShJTlRFUk5BTCksIGZhbHNlKTtcbnZhciBOVUxMID0gaGFuZGxlcnMucmVzb2x2ZShuZXcgUHJvbWlzZShJTlRFUk5BTCksIG51bGwpO1xudmFyIFVOREVGSU5FRCA9IGhhbmRsZXJzLnJlc29sdmUobmV3IFByb21pc2UoSU5URVJOQUwpLCB2b2lkIDApO1xudmFyIFpFUk8gPSBoYW5kbGVycy5yZXNvbHZlKG5ldyBQcm9taXNlKElOVEVSTkFMKSwgMCk7XG52YXIgRU1QVFlTVFJJTkcgPSBoYW5kbGVycy5yZXNvbHZlKG5ldyBQcm9taXNlKElOVEVSTkFMKSwgJycpO1xuXG5mdW5jdGlvbiByZXNvbHZlKHZhbHVlKSB7XG4gIGlmICh2YWx1ZSkge1xuICAgIGlmICh2YWx1ZSBpbnN0YW5jZW9mIFByb21pc2UpIHtcbiAgICAgIHJldHVybiB2YWx1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGhhbmRsZXJzLnJlc29sdmUobmV3IFByb21pc2UoSU5URVJOQUwpLCB2YWx1ZSk7XG4gIH1cbiAgdmFyIHZhbHVlVHlwZSA9IHR5cGVvZiB2YWx1ZTtcbiAgc3dpdGNoICh2YWx1ZVR5cGUpIHtcbiAgICBjYXNlICdib29sZWFuJzpcbiAgICAgIHJldHVybiBGQUxTRTtcbiAgICBjYXNlICd1bmRlZmluZWQnOlxuICAgICAgcmV0dXJuIFVOREVGSU5FRDtcbiAgICBjYXNlICdvYmplY3QnOlxuICAgICAgcmV0dXJuIE5VTEw7XG4gICAgY2FzZSAnbnVtYmVyJzpcbiAgICAgIHJldHVybiBaRVJPO1xuICAgIGNhc2UgJ3N0cmluZyc6XG4gICAgICByZXR1cm4gRU1QVFlTVFJJTkc7XG4gIH1cbn0iLCIndXNlIHN0cmljdCc7XG52YXIgaGFuZGxlcnMgPSByZXF1aXJlKCcuL2hhbmRsZXJzJyk7XG52YXIgdHJ5Q2F0Y2ggPSByZXF1aXJlKCcuL3RyeUNhdGNoJyk7XG5mdW5jdGlvbiBzYWZlbHlSZXNvbHZlVGhlbmFibGUoc2VsZiwgdGhlbmFibGUpIHtcbiAgLy8gRWl0aGVyIGZ1bGZpbGwsIHJlamVjdCBvciByZWplY3Qgd2l0aCBlcnJvclxuICB2YXIgY2FsbGVkID0gZmFsc2U7XG4gIGZ1bmN0aW9uIG9uRXJyb3IodmFsdWUpIHtcbiAgICBpZiAoY2FsbGVkKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNhbGxlZCA9IHRydWU7XG4gICAgaGFuZGxlcnMucmVqZWN0KHNlbGYsIHZhbHVlKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIG9uU3VjY2Vzcyh2YWx1ZSkge1xuICAgIGlmIChjYWxsZWQpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY2FsbGVkID0gdHJ1ZTtcbiAgICBoYW5kbGVycy5yZXNvbHZlKHNlbGYsIHZhbHVlKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHRyeVRvVW53cmFwKCkge1xuICAgIHRoZW5hYmxlKG9uU3VjY2Vzcywgb25FcnJvcik7XG4gIH1cbiAgXG4gIHZhciByZXN1bHQgPSB0cnlDYXRjaCh0cnlUb1Vud3JhcCk7XG4gIGlmIChyZXN1bHQuc3RhdHVzID09PSAnZXJyb3InKSB7XG4gICAgb25FcnJvcihyZXN1bHQudmFsdWUpO1xuICB9XG59XG5leHBvcnRzLnNhZmVseSA9IHNhZmVseVJlc29sdmVUaGVuYWJsZTsiLCIvLyBMYXp5IG1hbidzIHN5bWJvbHMgZm9yIHN0YXRlc1xuXG5leHBvcnRzLlJFSkVDVEVEID0gWydSRUpFQ1RFRCddO1xuZXhwb3J0cy5GVUxGSUxMRUQgPSBbJ0ZVTEZJTExFRCddO1xuZXhwb3J0cy5QRU5ESU5HID0gWydQRU5ESU5HJ107IiwiJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHRyeUNhdGNoO1xuXG5mdW5jdGlvbiB0cnlDYXRjaChmdW5jLCB2YWx1ZSkge1xuICB2YXIgb3V0ID0ge307XG4gIHRyeSB7XG4gICAgb3V0LnZhbHVlID0gZnVuYyh2YWx1ZSk7XG4gICAgb3V0LnN0YXR1cyA9ICdzdWNjZXNzJztcbiAgfSBjYXRjaCAoZSkge1xuICAgIG91dC5zdGF0dXMgPSAnZXJyb3InO1xuICAgIG91dC52YWx1ZSA9IGU7XG4gIH1cbiAgcmV0dXJuIG91dDtcbn0iLCIndXNlIHN0cmljdCc7XG5cbnZhciBpbW1lZGlhdGUgPSByZXF1aXJlKCdpbW1lZGlhdGUnKTtcbnZhciBoYW5kbGVycyA9IHJlcXVpcmUoJy4vaGFuZGxlcnMnKTtcbm1vZHVsZS5leHBvcnRzID0gdW53cmFwO1xuXG5mdW5jdGlvbiB1bndyYXAocHJvbWlzZSwgZnVuYywgdmFsdWUpIHtcbiAgaW1tZWRpYXRlKGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgcmV0dXJuVmFsdWU7XG4gICAgdHJ5IHtcbiAgICAgIHJldHVyblZhbHVlID0gZnVuYyh2YWx1ZSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgcmV0dXJuIGhhbmRsZXJzLnJlamVjdChwcm9taXNlLCBlKTtcbiAgICB9XG4gICAgaWYgKHJldHVyblZhbHVlID09PSBwcm9taXNlKSB7XG4gICAgICBoYW5kbGVycy5yZWplY3QocHJvbWlzZSwgbmV3IFR5cGVFcnJvcignQ2Fubm90IHJlc29sdmUgcHJvbWlzZSB3aXRoIGl0c2VsZicpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgaGFuZGxlcnMucmVzb2x2ZShwcm9taXNlLCByZXR1cm5WYWx1ZSk7XG4gICAgfVxuICB9KTtcbn0iLCIndXNlIHN0cmljdCc7XG52YXIgdHlwZXMgPSBbXG4gIHJlcXVpcmUoJy4vbmV4dFRpY2snKSxcbiAgcmVxdWlyZSgnLi9tdXRhdGlvbi5qcycpLFxuICByZXF1aXJlKCcuL21lc3NhZ2VDaGFubmVsJyksXG4gIHJlcXVpcmUoJy4vc3RhdGVDaGFuZ2UnKSxcbiAgcmVxdWlyZSgnLi90aW1lb3V0Jylcbl07XG52YXIgZHJhaW5pbmc7XG52YXIgcXVldWUgPSBbXTtcbi8vbmFtZWQgbmV4dFRpY2sgZm9yIGxlc3MgY29uZnVzaW5nIHN0YWNrIHRyYWNlc1xuZnVuY3Rpb24gbmV4dFRpY2soKSB7XG4gIGRyYWluaW5nID0gdHJ1ZTtcbiAgdmFyIGksIG9sZFF1ZXVlO1xuICB2YXIgbGVuID0gcXVldWUubGVuZ3RoO1xuICB3aGlsZSAobGVuKSB7XG4gICAgb2xkUXVldWUgPSBxdWV1ZTtcbiAgICBxdWV1ZSA9IFtdO1xuICAgIGkgPSAtMTtcbiAgICB3aGlsZSAoKytpIDwgbGVuKSB7XG4gICAgICBvbGRRdWV1ZVtpXSgpO1xuICAgIH1cbiAgICBsZW4gPSBxdWV1ZS5sZW5ndGg7XG4gIH1cbiAgZHJhaW5pbmcgPSBmYWxzZTtcbn1cbnZhciBzY2hlZHVsZURyYWluO1xudmFyIGkgPSAtMTtcbnZhciBsZW4gPSB0eXBlcy5sZW5ndGg7XG53aGlsZSAoKysgaSA8IGxlbikge1xuICBpZiAodHlwZXNbaV0gJiYgdHlwZXNbaV0udGVzdCAmJiB0eXBlc1tpXS50ZXN0KCkpIHtcbiAgICBzY2hlZHVsZURyYWluID0gdHlwZXNbaV0uaW5zdGFsbChuZXh0VGljayk7XG4gICAgYnJlYWs7XG4gIH1cbn1cbm1vZHVsZS5leHBvcnRzID0gaW1tZWRpYXRlO1xuZnVuY3Rpb24gaW1tZWRpYXRlKHRhc2spIHtcbiAgaWYgKHF1ZXVlLnB1c2godGFzaykgPT09IDEgJiYgIWRyYWluaW5nKSB7XG4gICAgc2NoZWR1bGVEcmFpbigpO1xuICB9XG59IiwiKGZ1bmN0aW9uIChnbG9iYWwpe1xuJ3VzZSBzdHJpY3QnO1xuXG5leHBvcnRzLnRlc3QgPSBmdW5jdGlvbiAoKSB7XG4gIGlmIChnbG9iYWwuc2V0SW1tZWRpYXRlKSB7XG4gICAgLy8gd2UgY2FuIG9ubHkgZ2V0IGhlcmUgaW4gSUUxMFxuICAgIC8vIHdoaWNoIGRvZXNuJ3QgaGFuZGVsIHBvc3RNZXNzYWdlIHdlbGxcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgcmV0dXJuIHR5cGVvZiBnbG9iYWwuTWVzc2FnZUNoYW5uZWwgIT09ICd1bmRlZmluZWQnO1xufTtcblxuZXhwb3J0cy5pbnN0YWxsID0gZnVuY3Rpb24gKGZ1bmMpIHtcbiAgdmFyIGNoYW5uZWwgPSBuZXcgZ2xvYmFsLk1lc3NhZ2VDaGFubmVsKCk7XG4gIGNoYW5uZWwucG9ydDEub25tZXNzYWdlID0gZnVuYztcbiAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICBjaGFubmVsLnBvcnQyLnBvc3RNZXNzYWdlKDApO1xuICB9O1xufTtcbn0pLmNhbGwodGhpcyx0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiID8gZ2xvYmFsIDogdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9KSIsIihmdW5jdGlvbiAoZ2xvYmFsKXtcbid1c2Ugc3RyaWN0Jztcbi8vYmFzZWQgb2ZmIHJzdnAgaHR0cHM6Ly9naXRodWIuY29tL3RpbGRlaW8vcnN2cC5qc1xuLy9saWNlbnNlIGh0dHBzOi8vZ2l0aHViLmNvbS90aWxkZWlvL3JzdnAuanMvYmxvYi9tYXN0ZXIvTElDRU5TRVxuLy9odHRwczovL2dpdGh1Yi5jb20vdGlsZGVpby9yc3ZwLmpzL2Jsb2IvbWFzdGVyL2xpYi9yc3ZwL2FzYXAuanNcblxudmFyIE11dGF0aW9uID0gZ2xvYmFsLk11dGF0aW9uT2JzZXJ2ZXIgfHwgZ2xvYmFsLldlYktpdE11dGF0aW9uT2JzZXJ2ZXI7XG5cbmV4cG9ydHMudGVzdCA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuIE11dGF0aW9uO1xufTtcblxuZXhwb3J0cy5pbnN0YWxsID0gZnVuY3Rpb24gKGhhbmRsZSkge1xuICB2YXIgY2FsbGVkID0gMDtcbiAgdmFyIG9ic2VydmVyID0gbmV3IE11dGF0aW9uKGhhbmRsZSk7XG4gIHZhciBlbGVtZW50ID0gZ2xvYmFsLmRvY3VtZW50LmNyZWF0ZVRleHROb2RlKCcnKTtcbiAgb2JzZXJ2ZXIub2JzZXJ2ZShlbGVtZW50LCB7XG4gICAgY2hhcmFjdGVyRGF0YTogdHJ1ZVxuICB9KTtcbiAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICBlbGVtZW50LmRhdGEgPSAoY2FsbGVkID0gKytjYWxsZWQgJSAyKTtcbiAgfTtcbn07XG59KS5jYWxsKHRoaXMsdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbCA6IHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSkiLCIoZnVuY3Rpb24gKGdsb2JhbCl7XG4ndXNlIHN0cmljdCc7XG5cbmV4cG9ydHMudGVzdCA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuICdkb2N1bWVudCcgaW4gZ2xvYmFsICYmICdvbnJlYWR5c3RhdGVjaGFuZ2UnIGluIGdsb2JhbC5kb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzY3JpcHQnKTtcbn07XG5cbmV4cG9ydHMuaW5zdGFsbCA9IGZ1bmN0aW9uIChoYW5kbGUpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcblxuICAgIC8vIENyZWF0ZSBhIDxzY3JpcHQ+IGVsZW1lbnQ7IGl0cyByZWFkeXN0YXRlY2hhbmdlIGV2ZW50IHdpbGwgYmUgZmlyZWQgYXN5bmNocm9ub3VzbHkgb25jZSBpdCBpcyBpbnNlcnRlZFxuICAgIC8vIGludG8gdGhlIGRvY3VtZW50LiBEbyBzbywgdGh1cyBxdWV1aW5nIHVwIHRoZSB0YXNrLiBSZW1lbWJlciB0byBjbGVhbiB1cCBvbmNlIGl0J3MgYmVlbiBjYWxsZWQuXG4gICAgdmFyIHNjcmlwdEVsID0gZ2xvYmFsLmRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NjcmlwdCcpO1xuICAgIHNjcmlwdEVsLm9ucmVhZHlzdGF0ZWNoYW5nZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgIGhhbmRsZSgpO1xuXG4gICAgICBzY3JpcHRFbC5vbnJlYWR5c3RhdGVjaGFuZ2UgPSBudWxsO1xuICAgICAgc2NyaXB0RWwucGFyZW50Tm9kZS5yZW1vdmVDaGlsZChzY3JpcHRFbCk7XG4gICAgICBzY3JpcHRFbCA9IG51bGw7XG4gICAgfTtcbiAgICBnbG9iYWwuZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmFwcGVuZENoaWxkKHNjcmlwdEVsKTtcblxuICAgIHJldHVybiBoYW5kbGU7XG4gIH07XG59O1xufSkuY2FsbCh0aGlzLHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWwgOiB0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30pIiwiJ3VzZSBzdHJpY3QnO1xuZXhwb3J0cy50ZXN0ID0gZnVuY3Rpb24gKCkge1xuICByZXR1cm4gdHJ1ZTtcbn07XG5cbmV4cG9ydHMuaW5zdGFsbCA9IGZ1bmN0aW9uICh0KSB7XG4gIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgc2V0VGltZW91dCh0LCAwKTtcbiAgfTtcbn07IiwiKGZ1bmN0aW9uICgpIHtcbiAgICBpZiAodHlwZW9mIHNpZXN0YSA9PSAndW5kZWZpbmVkJyAmJiB0eXBlb2YgbW9kdWxlID09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignQ291bGQgbm90IGZpbmQgd2luZG93LnNpZXN0YS4gTWFrZSBzdXJlIHlvdSBpbmNsdWRlIHNpZXN0YS5jb3JlLmpzIGZpcnN0LicpO1xuICAgIH1cblxuICAgIHZhciBfaSA9IHNpZXN0YS5faW50ZXJuYWwsXG4gICAgICAgIGNhY2hlID0gX2kuY2FjaGUsXG4gICAgICAgIENvbGxlY3Rpb25SZWdpc3RyeSA9IF9pLkNvbGxlY3Rpb25SZWdpc3RyeSxcbiAgICAgICAgbG9nID0gX2kubG9nKCdTdG9yYWdlJyksXG4gICAgICAgIGVycm9yID0gX2kuZXJyb3IsXG4gICAgICAgIHV0aWwgPSBfaS51dGlsLFxuICAgICAgICBfID0gdXRpbC5fLFxuICAgICAgICBldmVudHMgPSBfaS5ldmVudHM7XG5cbiAgICB2YXIgdW5zYXZlZE9iamVjdHMgPSBbXSxcbiAgICAgICAgdW5zYXZlZE9iamVjdHNIYXNoID0ge30sXG4gICAgICAgIHVuc2F2ZWRPYmplY3RzQnlDb2xsZWN0aW9uID0ge307XG5cbiAgICB2YXIgc3RvcmFnZSA9IHt9O1xuXG5cbiAgICBmdW5jdGlvbiBfaW5pdE1ldGEoKSB7XG4gICAgICAgIHJldHVybiB7ZGF0ZUZpZWxkczogW119O1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGZ1bGx5UXVhbGlmaWVkTW9kZWxOYW1lKGNvbGxlY3Rpb25OYW1lLCBtb2RlbE5hbWUpIHtcbiAgICAgICAgcmV0dXJuIGNvbGxlY3Rpb25OYW1lICsgJy4nICsgbW9kZWxOYW1lO1xuICAgIH1cblxuICAgIGlmICh0eXBlb2YgUG91Y2hEQiA9PSAndW5kZWZpbmVkJykge1xuICAgICAgICBzaWVzdGEuZXh0LnN0b3JhZ2VFbmFibGVkID0gZmFsc2U7XG4gICAgICAgIGNvbnNvbGUubG9nKCdQb3VjaERCIGlzIG5vdCBwcmVzZW50IHRoZXJlZm9yZSBzdG9yYWdlIGlzIGRpc2FibGVkLicpO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgdmFyIERCX05BTUUgPSAnc2llc3RhJyxcbiAgICAgICAgICAgIHBvdWNoID0gbmV3IFBvdWNoREIoREJfTkFNRSwge2F1dG9fY29tcGFjdGlvbjogdHJ1ZX0pO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBTb21ldGltZXMgc2llc3RhIG5lZWRzIHRvIHN0b3JlIHNvbWUgZXh0cmEgaW5mb3JtYXRpb24gYWJvdXQgdGhlIG1vZGVsIGluc3RhbmNlLlxuICAgICAgICAgKiBAcGFyYW0gc2VyaWFsaXNlZFxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgZnVuY3Rpb24gX2FkZE1ldGEoc2VyaWFsaXNlZCkge1xuICAgICAgICAgICAgLy8gUG91Y2hEQiA8PSAzLjIuMSBoYXMgYSBidWcgd2hlcmVieSBkYXRlIGZpZWxkcyBhcmUgbm90IGRlc2VyaWFsaXNlZCBwcm9wZXJseSBpZiB5b3UgdXNlIGRiLnF1ZXJ5XG4gICAgICAgICAgICAvLyB0aGVyZWZvcmUgd2UgbmVlZCB0byBhZGQgZXh0cmEgaW5mbyB0byB0aGUgb2JqZWN0IGZvciBkZXNlcmlhbGlzaW5nIGRhdGVzIG1hbnVhbGx5LlxuICAgICAgICAgICAgc2VyaWFsaXNlZC5zaWVzdGFfbWV0YSA9IF9pbml0TWV0YSgpO1xuICAgICAgICAgICAgZm9yICh2YXIgcHJvcCBpbiBzZXJpYWxpc2VkKSB7XG4gICAgICAgICAgICAgICAgaWYgKHNlcmlhbGlzZWQuaGFzT3duUHJvcGVydHkocHJvcCkpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHNlcmlhbGlzZWRbcHJvcF0gaW5zdGFuY2VvZiBEYXRlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzZXJpYWxpc2VkLnNpZXN0YV9tZXRhLmRhdGVGaWVsZHMucHVzaChwcm9wKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlcmlhbGlzZWRbcHJvcF0gPSBzZXJpYWxpc2VkW3Byb3BdLmdldFRpbWUoKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIF9wcm9jZXNzTWV0YShkYXR1bSkge1xuICAgICAgICAgICAgdmFyIG1ldGEgPSBkYXR1bS5zaWVzdGFfbWV0YSB8fCBfaW5pdE1ldGEoKTtcbiAgICAgICAgICAgIG1ldGEuZGF0ZUZpZWxkcy5mb3JFYWNoKGZ1bmN0aW9uIChkYXRlRmllbGQpIHtcbiAgICAgICAgICAgICAgICB2YXIgdmFsdWUgPSBkYXR1bVtkYXRlRmllbGRdO1xuICAgICAgICAgICAgICAgIGlmICghKHZhbHVlIGluc3RhbmNlb2YgRGF0ZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgZGF0dW1bZGF0ZUZpZWxkXSA9IG5ldyBEYXRlKHZhbHVlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGRlbGV0ZSBkYXR1bS5zaWVzdGFfbWV0YTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIGNvbnN0cnVjdEluZGV4RGVzaWduRG9jKGNvbGxlY3Rpb25OYW1lLCBtb2RlbE5hbWUpIHtcbiAgICAgICAgICAgIHZhciBmdWxseVF1YWxpZmllZE5hbWUgPSBmdWxseVF1YWxpZmllZE1vZGVsTmFtZShjb2xsZWN0aW9uTmFtZSwgbW9kZWxOYW1lKTtcbiAgICAgICAgICAgIHZhciB2aWV3cyA9IHt9O1xuICAgICAgICAgICAgdmlld3NbZnVsbHlRdWFsaWZpZWROYW1lXSA9IHtcbiAgICAgICAgICAgICAgICBtYXA6IGZ1bmN0aW9uIChkb2MpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGRvYy5jb2xsZWN0aW9uID09ICckMScgJiYgZG9jLm1vZGVsID09ICckMicpIGVtaXQoZG9jLmNvbGxlY3Rpb24gKyAnLicgKyBkb2MubW9kZWwsIGRvYyk7XG4gICAgICAgICAgICAgICAgfS50b1N0cmluZygpLnJlcGxhY2UoJyQxJywgY29sbGVjdGlvbk5hbWUpLnJlcGxhY2UoJyQyJywgbW9kZWxOYW1lKVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgX2lkOiAnX2Rlc2lnbi8nICsgZnVsbHlRdWFsaWZpZWROYW1lLFxuICAgICAgICAgICAgICAgIHZpZXdzOiB2aWV3c1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIGNvbnN0cnVjdEluZGV4ZXNGb3JBbGwoKSB7XG4gICAgICAgICAgICB2YXIgaW5kZXhlcyA9IFtdO1xuICAgICAgICAgICAgdmFyIHJlZ2lzdHJ5ID0gc2llc3RhLl9pbnRlcm5hbC5Db2xsZWN0aW9uUmVnaXN0cnk7XG4gICAgICAgICAgICByZWdpc3RyeS5jb2xsZWN0aW9uTmFtZXMuZm9yRWFjaChmdW5jdGlvbiAoY29sbGVjdGlvbk5hbWUpIHtcbiAgICAgICAgICAgICAgICB2YXIgbW9kZWxzID0gcmVnaXN0cnlbY29sbGVjdGlvbk5hbWVdLl9tb2RlbHM7XG4gICAgICAgICAgICAgICAgZm9yICh2YXIgbW9kZWxOYW1lIGluIG1vZGVscykge1xuICAgICAgICAgICAgICAgICAgICBpZiAobW9kZWxzLmhhc093blByb3BlcnR5KG1vZGVsTmFtZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGluZGV4ZXMucHVzaChjb25zdHJ1Y3RJbmRleERlc2lnbkRvYyhjb2xsZWN0aW9uTmFtZSwgbW9kZWxOYW1lKSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiBpbmRleGVzO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gX19lbnN1cmVJbmRleGVzKGluZGV4ZXMsIGNiKSB7XG4gICAgICAgICAgICBwb3VjaC5idWxrRG9jcyhpbmRleGVzKVxuICAgICAgICAgICAgICAgIC50aGVuKGZ1bmN0aW9uIChyZXNwKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBlcnJvcnMgPSBbXTtcbiAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCByZXNwLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgcmVzcG9uc2UgPSByZXNwW2ldO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFyZXNwb25zZS5vaykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIENvbmZsaWN0IG1lYW5zIGFscmVhZHkgZXhpc3RzLCBhbmQgdGhpcyBpcyBmaW5lIVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBpc0NvbmZsaWN0ID0gcmVzcG9uc2Uuc3RhdHVzID09IDQwOTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWlzQ29uZmxpY3QpIGVycm9ycy5wdXNoKHJlc3BvbnNlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBjYihlcnJvcnMubGVuZ3RoID8gZXJyb3IoJ211bHRpcGxlIGVycm9ycycsIHtlcnJvcnM6IGVycm9yc30pIDogbnVsbCk7XG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAuY2F0Y2goY2IpO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gZW5zdXJlSW5kZXhlc0ZvckFsbChjYikge1xuICAgICAgICAgICAgdmFyIGluZGV4ZXMgPSBjb25zdHJ1Y3RJbmRleGVzRm9yQWxsKCk7XG4gICAgICAgICAgICBfX2Vuc3VyZUluZGV4ZXMoaW5kZXhlcywgY2IpO1xuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFNlcmlhbGlzZSBhIG1vZGVsIGludG8gYSBmb3JtYXQgdGhhdCBQb3VjaERCIGJ1bGtEb2NzIEFQSSBjYW4gcHJvY2Vzc1xuICAgICAgICAgKiBAcGFyYW0ge01vZGVsSW5zdGFuY2V9IG1vZGVsSW5zdGFuY2VcbiAgICAgICAgICovXG4gICAgICAgIGZ1bmN0aW9uIF9zZXJpYWxpc2UobW9kZWxJbnN0YW5jZSkge1xuICAgICAgICAgICAgdmFyIHNlcmlhbGlzZWQgPSBzaWVzdGEuXy5leHRlbmQoe30sIG1vZGVsSW5zdGFuY2UuX192YWx1ZXMpO1xuICAgICAgICAgICAgX2FkZE1ldGEoc2VyaWFsaXNlZCk7XG4gICAgICAgICAgICBzZXJpYWxpc2VkWydjb2xsZWN0aW9uJ10gPSBtb2RlbEluc3RhbmNlLmNvbGxlY3Rpb25OYW1lO1xuICAgICAgICAgICAgc2VyaWFsaXNlZFsnbW9kZWwnXSA9IG1vZGVsSW5zdGFuY2UubW9kZWxOYW1lO1xuICAgICAgICAgICAgc2VyaWFsaXNlZFsnX2lkJ10gPSBtb2RlbEluc3RhbmNlLl9pZDtcbiAgICAgICAgICAgIGlmIChtb2RlbEluc3RhbmNlLnJlbW92ZWQpIHNlcmlhbGlzZWRbJ19kZWxldGVkJ10gPSB0cnVlO1xuICAgICAgICAgICAgdmFyIHJldiA9IG1vZGVsSW5zdGFuY2UuX3JldjtcbiAgICAgICAgICAgIGlmIChyZXYpIHNlcmlhbGlzZWRbJ19yZXYnXSA9IHJldjtcbiAgICAgICAgICAgIHNlcmlhbGlzZWQgPSBfLnJlZHVjZShtb2RlbEluc3RhbmNlLl9yZWxhdGlvbnNoaXBOYW1lcywgZnVuY3Rpb24gKG1lbW8sIG4pIHtcbiAgICAgICAgICAgICAgICB2YXIgdmFsID0gbW9kZWxJbnN0YW5jZVtuXTtcbiAgICAgICAgICAgICAgICBpZiAoc2llc3RhLmlzQXJyYXkodmFsKSkge1xuICAgICAgICAgICAgICAgICAgICBtZW1vW25dID0gXy5wbHVjayh2YWwsICdfaWQnKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSBpZiAodmFsKSB7XG4gICAgICAgICAgICAgICAgICAgIG1lbW9bbl0gPSB2YWwuX2lkO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gbWVtbztcbiAgICAgICAgICAgIH0sIHNlcmlhbGlzZWQpO1xuICAgICAgICAgICAgcmV0dXJuIHNlcmlhbGlzZWQ7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBfcHJlcGFyZURhdHVtKGRhdHVtLCBtb2RlbCkge1xuICAgICAgICAgICAgX3Byb2Nlc3NNZXRhKGRhdHVtKTtcbiAgICAgICAgICAgIGRlbGV0ZSBkYXR1bS5jb2xsZWN0aW9uO1xuICAgICAgICAgICAgZGVsZXRlIGRhdHVtLm1vZGVsO1xuICAgICAgICAgICAgdmFyIHJlbGF0aW9uc2hpcE5hbWVzID0gbW9kZWwuX3JlbGF0aW9uc2hpcE5hbWVzO1xuICAgICAgICAgICAgXy5lYWNoKHJlbGF0aW9uc2hpcE5hbWVzLCBmdW5jdGlvbiAocikge1xuICAgICAgICAgICAgICAgIHZhciBfaWQgPSBkYXR1bVtyXTtcbiAgICAgICAgICAgICAgICBpZiAoc2llc3RhLmlzQXJyYXkoX2lkKSkge1xuICAgICAgICAgICAgICAgICAgICBkYXR1bVtyXSA9IF8ubWFwKF9pZCwgZnVuY3Rpb24gKHgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB7X2lkOiB4fVxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGRhdHVtW3JdID0ge19pZDogX2lkfTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiBkYXR1bTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0gb3B0c1xuICAgICAgICAgKiBAcGFyYW0gb3B0cy5jb2xsZWN0aW9uTmFtZVxuICAgICAgICAgKiBAcGFyYW0gb3B0cy5tb2RlbE5hbWVcbiAgICAgICAgICogQHBhcmFtIGNhbGxiYWNrXG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICBmdW5jdGlvbiBfbG9hZE1vZGVsKG9wdHMsIGNhbGxiYWNrKSB7XG4gICAgICAgICAgICB2YXIgY29sbGVjdGlvbk5hbWUgPSBvcHRzLmNvbGxlY3Rpb25OYW1lLFxuICAgICAgICAgICAgICAgIG1vZGVsTmFtZSA9IG9wdHMubW9kZWxOYW1lO1xuICAgICAgICAgICAgdmFyIGZ1bGx5UXVhbGlmaWVkTmFtZSA9IGZ1bGx5UXVhbGlmaWVkTW9kZWxOYW1lKGNvbGxlY3Rpb25OYW1lLCBtb2RlbE5hbWUpO1xuICAgICAgICAgICAgbG9nKCdMb2FkaW5nIGluc3RhbmNlcyBmb3IgJyArIGZ1bGx5UXVhbGlmaWVkTmFtZSk7XG4gICAgICAgICAgICB2YXIgTW9kZWwgPSBDb2xsZWN0aW9uUmVnaXN0cnlbY29sbGVjdGlvbk5hbWVdW21vZGVsTmFtZV07XG4gICAgICAgICAgICBsb2coJ1F1ZXJ5aW5nIHBvdWNoJyk7XG4gICAgICAgICAgICBwb3VjaC5xdWVyeShmdWxseVF1YWxpZmllZE5hbWUpXG4gICAgICAgICAgICAgICAgLy9wb3VjaC5xdWVyeSh7bWFwOiBtYXBGdW5jfSlcbiAgICAgICAgICAgICAgICAudGhlbihmdW5jdGlvbiAocmVzcCkge1xuICAgICAgICAgICAgICAgICAgICBsb2coJ1F1ZXJpZWQgcG91Y2ggc3VjY2Vzc2Z1bGx5Jyk7XG4gICAgICAgICAgICAgICAgICAgIHZhciBkYXRhID0gc2llc3RhLl8ubWFwKHNpZXN0YS5fLnBsdWNrKHJlc3Aucm93cywgJ3ZhbHVlJyksIGZ1bmN0aW9uIChkYXR1bSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIF9wcmVwYXJlRGF0dW0oZGF0dW0sIE1vZGVsKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIGxvZygnTWFwcGluZyBkYXRhJywgZGF0YSk7XG4gICAgICAgICAgICAgICAgICAgIE1vZGVsLmdyYXBoKGRhdGEsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRpc2FibGVldmVudHM6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBfaWdub3JlSW5zdGFsbGVkOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgZnJvbVN0b3JhZ2U6IHRydWVcbiAgICAgICAgICAgICAgICAgICAgfSwgZnVuY3Rpb24gKGVyciwgaW5zdGFuY2VzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChsb2cuZW5hYmxlZClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nKCdMb2FkZWQgJyArIGluc3RhbmNlcyA/IGluc3RhbmNlcy5sZW5ndGgudG9TdHJpbmcoKSA6IDAgKyAnIGluc3RhbmNlcyBmb3IgJyArIGZ1bGx5UXVhbGlmaWVkTmFtZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2coJ0Vycm9yIGxvYWRpbmcgbW9kZWxzJywgZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVyciwgaW5zdGFuY2VzKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAuY2F0Y2goZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogTG9hZCBhbGwgZGF0YSBmcm9tIFBvdWNoREIuXG4gICAgICAgICAqL1xuICAgICAgICBmdW5jdGlvbiBfbG9hZChjYikge1xuICAgICAgICAgICAgaWYgKHNhdmluZykgdGhyb3cgbmV3IEVycm9yKCdub3QgbG9hZGVkIHlldCBob3cgY2FuIGkgc2F2ZScpO1xuICAgICAgICAgICAgcmV0dXJuIHV0aWwucHJvbWlzZShjYiwgZnVuY3Rpb24gKGNiKSB7XG4gICAgICAgICAgICAgICAgaWYgKHNpZXN0YS5leHQuc3RvcmFnZUVuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGNvbGxlY3Rpb25OYW1lcyA9IENvbGxlY3Rpb25SZWdpc3RyeS5jb2xsZWN0aW9uTmFtZXM7XG4gICAgICAgICAgICAgICAgICAgIHZhciB0YXNrcyA9IFtdO1xuICAgICAgICAgICAgICAgICAgICBfLmVhY2goY29sbGVjdGlvbk5hbWVzLCBmdW5jdGlvbiAoY29sbGVjdGlvbk5hbWUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBjb2xsZWN0aW9uID0gQ29sbGVjdGlvblJlZ2lzdHJ5W2NvbGxlY3Rpb25OYW1lXSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtb2RlbE5hbWVzID0gT2JqZWN0LmtleXMoY29sbGVjdGlvbi5fbW9kZWxzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIF8uZWFjaChtb2RlbE5hbWVzLCBmdW5jdGlvbiAobW9kZWxOYW1lKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGFza3MucHVzaChmdW5jdGlvbiAoY2IpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gV2UgY2FsbCBmcm9tIHN0b3JhZ2UgdG8gYWxsb3cgZm9yIHJlcGxhY2VtZW50IG9mIF9sb2FkTW9kZWwgZm9yIHBlcmZvcm1hbmNlIGV4dGVuc2lvbi5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RvcmFnZS5fbG9hZE1vZGVsKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbGxlY3Rpb25OYW1lOiBjb2xsZWN0aW9uTmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1vZGVsTmFtZTogbW9kZWxOYW1lXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sIGNiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgc2llc3RhLmFzeW5jLnNlcmllcyh0YXNrcywgZnVuY3Rpb24gKGVyciwgcmVzdWx0cykge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG47XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBpbnN0YW5jZXMgPSBbXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzaWVzdGEuXy5lYWNoKHJlc3VsdHMsIGZ1bmN0aW9uIChyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGluc3RhbmNlcyA9IGluc3RhbmNlcy5jb25jYXQocilcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBuID0gaW5zdGFuY2VzLmxlbmd0aDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAobG9nKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZygnTG9hZGVkICcgKyBuLnRvU3RyaW5nKCkgKyAnIGluc3RhbmNlcycpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGNiKGVyciwgbik7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgY2IoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gc2F2ZUNvbmZsaWN0cyhvYmplY3RzLCBjYikge1xuICAgICAgICAgICAgcG91Y2guYWxsRG9jcyh7a2V5czogXy5wbHVjayhvYmplY3RzLCAnX2lkJyl9KVxuICAgICAgICAgICAgICAgIC50aGVuKGZ1bmN0aW9uIChyZXNwKSB7XG4gICAgICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcmVzcC5yb3dzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBvYmplY3RzW2ldLl9yZXYgPSByZXNwLnJvd3NbaV0udmFsdWUucmV2O1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHNhdmVUb1BvdWNoKG9iamVjdHMsIGNiKTtcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIC5jYXRjaChmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGNiKGVycik7XG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIHNhdmVUb1BvdWNoKG9iamVjdHMsIGNiKSB7XG4gICAgICAgICAgICB2YXIgY29uZmxpY3RzID0gW107XG4gICAgICAgICAgICBwb3VjaC5idWxrRG9jcyhfLm1hcChvYmplY3RzLCBfc2VyaWFsaXNlKSkudGhlbihmdW5jdGlvbiAocmVzcCkge1xuICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcmVzcC5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICB2YXIgcmVzcG9uc2UgPSByZXNwW2ldO1xuICAgICAgICAgICAgICAgICAgICB2YXIgb2JqID0gb2JqZWN0c1tpXTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHJlc3BvbnNlLm9rKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBvYmouX3JldiA9IHJlc3BvbnNlLnJldjtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBlbHNlIGlmIChyZXNwb25zZS5zdGF0dXMgPT0gNDA5KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25mbGljdHMucHVzaChvYmopO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9nKCdFcnJvciBzYXZpbmcgb2JqZWN0IHdpdGggX2lkPVwiJyArIG9iai5faWQgKyAnXCInLCByZXNwb25zZSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKGNvbmZsaWN0cy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgc2F2ZUNvbmZsaWN0cyhjb25mbGljdHMsIGNiKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNiKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSwgZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgICAgIGNiKGVycik7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFNhdmUgYWxsIG1vZGVsRXZlbnRzIGRvd24gdG8gUG91Y2hEQi5cbiAgICAgICAgICovXG4gICAgICAgIGZ1bmN0aW9uIHNhdmUoY2IpIHtcbiAgICAgICAgICAgIHJldHVybiB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uIChjYikge1xuICAgICAgICAgICAgICAgIHNpZXN0YS5fYWZ0ZXJJbnN0YWxsKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIG9iamVjdHMgPSB1bnNhdmVkT2JqZWN0cztcbiAgICAgICAgICAgICAgICAgICAgdW5zYXZlZE9iamVjdHMgPSBbXTtcbiAgICAgICAgICAgICAgICAgICAgdW5zYXZlZE9iamVjdHNIYXNoID0ge307XG4gICAgICAgICAgICAgICAgICAgIHVuc2F2ZWRPYmplY3RzQnlDb2xsZWN0aW9uID0ge307XG4gICAgICAgICAgICAgICAgICAgIGlmIChsb2cpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZygnU2F2aW5nIG9iamVjdHMnLCBfLm1hcChvYmplY3RzLCBmdW5jdGlvbiAoeCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB4Ll9kdW1wKClcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pKVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHNhdmVUb1BvdWNoKG9iamVjdHMsIGNiKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0uYmluZCh0aGlzKSk7XG5cbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBsaXN0ZW5lciA9IGZ1bmN0aW9uIChuKSB7XG4gICAgICAgICAgICB2YXIgY2hhbmdlZE9iamVjdCA9IG4ub2JqLFxuICAgICAgICAgICAgICAgIGlkZW50ID0gY2hhbmdlZE9iamVjdC5faWQ7XG4gICAgICAgICAgICBpZiAoIWNoYW5nZWRPYmplY3QpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgX2kuZXJyb3IuSW50ZXJuYWxTaWVzdGFFcnJvcignTm8gb2JqIGZpZWxkIGluIG5vdGlmaWNhdGlvbiByZWNlaXZlZCBieSBzdG9yYWdlIGV4dGVuc2lvbicpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKCEoaWRlbnQgaW4gdW5zYXZlZE9iamVjdHNIYXNoKSkge1xuICAgICAgICAgICAgICAgIHVuc2F2ZWRPYmplY3RzSGFzaFtpZGVudF0gPSBjaGFuZ2VkT2JqZWN0O1xuICAgICAgICAgICAgICAgIHVuc2F2ZWRPYmplY3RzLnB1c2goY2hhbmdlZE9iamVjdCk7XG4gICAgICAgICAgICAgICAgdmFyIGNvbGxlY3Rpb25OYW1lID0gY2hhbmdlZE9iamVjdC5jb2xsZWN0aW9uTmFtZTtcbiAgICAgICAgICAgICAgICBpZiAoIXVuc2F2ZWRPYmplY3RzQnlDb2xsZWN0aW9uW2NvbGxlY3Rpb25OYW1lXSkge1xuICAgICAgICAgICAgICAgICAgICB1bnNhdmVkT2JqZWN0c0J5Q29sbGVjdGlvbltjb2xsZWN0aW9uTmFtZV0gPSB7fTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdmFyIG1vZGVsTmFtZSA9IGNoYW5nZWRPYmplY3QubW9kZWwubmFtZTtcbiAgICAgICAgICAgICAgICBpZiAoIXVuc2F2ZWRPYmplY3RzQnlDb2xsZWN0aW9uW2NvbGxlY3Rpb25OYW1lXVttb2RlbE5hbWVdKSB7XG4gICAgICAgICAgICAgICAgICAgIHVuc2F2ZWRPYmplY3RzQnlDb2xsZWN0aW9uW2NvbGxlY3Rpb25OYW1lXVttb2RlbE5hbWVdID0ge307XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHVuc2F2ZWRPYmplY3RzQnlDb2xsZWN0aW9uW2NvbGxlY3Rpb25OYW1lXVttb2RlbE5hbWVdW2lkZW50XSA9IGNoYW5nZWRPYmplY3Q7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIHNpZXN0YS5vbignU2llc3RhJywgbGlzdGVuZXIpO1xuXG4gICAgICAgIF8uZXh0ZW5kKHN0b3JhZ2UsIHtcbiAgICAgICAgICAgIF9sb2FkOiBfbG9hZCxcbiAgICAgICAgICAgIF9sb2FkTW9kZWw6IF9sb2FkTW9kZWwsXG4gICAgICAgICAgICBzYXZlOiBzYXZlLFxuICAgICAgICAgICAgX3NlcmlhbGlzZTogX3NlcmlhbGlzZSxcbiAgICAgICAgICAgIGVuc3VyZUluZGV4ZXNGb3JBbGw6IGVuc3VyZUluZGV4ZXNGb3JBbGwsXG4gICAgICAgICAgICBfcmVzZXQ6IGZ1bmN0aW9uIChjYikge1xuICAgICAgICAgICAgICAgIHNpZXN0YS5yZW1vdmVMaXN0ZW5lcignU2llc3RhJywgbGlzdGVuZXIpO1xuICAgICAgICAgICAgICAgIHVuc2F2ZWRPYmplY3RzID0gW107XG4gICAgICAgICAgICAgICAgdW5zYXZlZE9iamVjdHNIYXNoID0ge307XG4gICAgICAgICAgICAgICAgcG91Y2guZGVzdHJveShmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwb3VjaCA9IG5ldyBQb3VjaERCKERCX05BTUUpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHNpZXN0YS5vbignU2llc3RhJywgbGlzdGVuZXIpO1xuICAgICAgICAgICAgICAgICAgICBsb2coJ1Jlc2V0IGNvbXBsZXRlJyk7XG4gICAgICAgICAgICAgICAgICAgIGNiKGVycik7XG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIH1cblxuICAgICAgICB9KTtcblxuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydGllcyhzdG9yYWdlLCB7XG4gICAgICAgICAgICBfdW5zYXZlZE9iamVjdHM6IHtcbiAgICAgICAgICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHVuc2F2ZWRPYmplY3RzXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIF91bnNhdmVkT2JqZWN0c0hhc2g6IHtcbiAgICAgICAgICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHVuc2F2ZWRPYmplY3RzSGFzaFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBfdW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb246IHtcbiAgICAgICAgICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHVuc2F2ZWRPYmplY3RzQnlDb2xsZWN0aW9uXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIF9wb3VjaDoge1xuICAgICAgICAgICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gcG91Y2hcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG5cbiAgICAgICAgaWYgKCFzaWVzdGEuZXh0KSBzaWVzdGEuZXh0ID0ge307XG4gICAgICAgIHNpZXN0YS5leHQuc3RvcmFnZSA9IHN0b3JhZ2U7XG5cbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnRpZXMoc2llc3RhLmV4dCwge1xuICAgICAgICAgICAgc3RvcmFnZUVuYWJsZWQ6IHtcbiAgICAgICAgICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHNpZXN0YS5leHQuX3N0b3JhZ2VFbmFibGVkICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBzaWVzdGEuZXh0Ll9zdG9yYWdlRW5hYmxlZDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gISFzaWVzdGEuZXh0LnN0b3JhZ2U7XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBzZXQ6IGZ1bmN0aW9uICh2KSB7XG4gICAgICAgICAgICAgICAgICAgIHNpZXN0YS5leHQuX3N0b3JhZ2VFbmFibGVkID0gdjtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgdmFyIGludGVydmFsLCBzYXZpbmcsIGF1dG9zYXZlSW50ZXJ2YWwgPSAxMDAwO1xuXG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKHNpZXN0YSwge1xuICAgICAgICAgICAgYXV0b3NhdmU6IHtcbiAgICAgICAgICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuICEhaW50ZXJ2YWw7XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBzZXQ6IGZ1bmN0aW9uIChhdXRvc2F2ZSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoYXV0b3NhdmUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghaW50ZXJ2YWwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbnRlcnZhbCA9IHNldEludGVydmFsKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gQ2hlZWt5IHdheSBvZiBhdm9pZGluZyBtdWx0aXBsZSBzYXZlcyBoYXBwZW5pbmcuLi5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFzYXZpbmcpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNhdmluZyA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzaWVzdGEuc2F2ZShmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZXZlbnRzLmVtaXQoJ3NhdmVkJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNhdmluZyA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LCBzaWVzdGEuYXV0b3NhdmVJbnRlcnZhbCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoaW50ZXJ2YWwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjbGVhckludGVydmFsKGludGVydmFsKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbnRlcnZhbCA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgYXV0b3NhdmVJbnRlcnZhbDoge1xuICAgICAgICAgICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gYXV0b3NhdmVJbnRlcnZhbDtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHNldDogZnVuY3Rpb24gKF9hdXRvc2F2ZUludGVydmFsKSB7XG4gICAgICAgICAgICAgICAgICAgIGF1dG9zYXZlSW50ZXJ2YWwgPSBfYXV0b3NhdmVJbnRlcnZhbDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGludGVydmFsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBSZXNldCBpbnRlcnZhbFxuICAgICAgICAgICAgICAgICAgICAgICAgc2llc3RhLmF1dG9zYXZlID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICBzaWVzdGEuYXV0b3NhdmUgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGRpcnR5OiB7XG4gICAgICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciB1bnNhdmVkT2JqZWN0c0J5Q29sbGVjdGlvbiA9IHNpZXN0YS5leHQuc3RvcmFnZS5fdW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb247XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiAhIU9iamVjdC5rZXlzKHVuc2F2ZWRPYmplY3RzQnlDb2xsZWN0aW9uKS5sZW5ndGg7XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlXG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIF8uZXh0ZW5kKHNpZXN0YSwge1xuICAgICAgICAgICAgc2F2ZTogc2F2ZSxcbiAgICAgICAgICAgIHNldFBvdWNoOiBmdW5jdGlvbiAoX3ApIHtcbiAgICAgICAgICAgICAgICBpZiAoc2llc3RhLl9jYW5DaGFuZ2UpIHBvdWNoID0gX3A7XG4gICAgICAgICAgICAgICAgZWxzZSB0aHJvdyBuZXcgRXJyb3IoJ0Nhbm5vdCBjaGFuZ2UgUG91Y2hEQiBpbnN0YW5jZSB3aGVuIGFuIG9iamVjdCBncmFwaCBleGlzdHMuJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgfVxuXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBzdG9yYWdlO1xuXG59KSgpOyIsIi8qXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTQgVGhlIFBvbHltZXIgUHJvamVjdCBBdXRob3JzLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogVGhpcyBjb2RlIG1heSBvbmx5IGJlIHVzZWQgdW5kZXIgdGhlIEJTRCBzdHlsZSBsaWNlbnNlIGZvdW5kIGF0IGh0dHA6Ly9wb2x5bWVyLmdpdGh1Yi5pby9MSUNFTlNFLnR4dFxuICogVGhlIGNvbXBsZXRlIHNldCBvZiBhdXRob3JzIG1heSBiZSBmb3VuZCBhdCBodHRwOi8vcG9seW1lci5naXRodWIuaW8vQVVUSE9SUy50eHRcbiAqIFRoZSBjb21wbGV0ZSBzZXQgb2YgY29udHJpYnV0b3JzIG1heSBiZSBmb3VuZCBhdCBodHRwOi8vcG9seW1lci5naXRodWIuaW8vQ09OVFJJQlVUT1JTLnR4dFxuICogQ29kZSBkaXN0cmlidXRlZCBieSBHb29nbGUgYXMgcGFydCBvZiB0aGUgcG9seW1lciBwcm9qZWN0IGlzIGFsc29cbiAqIHN1YmplY3QgdG8gYW4gYWRkaXRpb25hbCBJUCByaWdodHMgZ3JhbnQgZm91bmQgYXQgaHR0cDovL3BvbHltZXIuZ2l0aHViLmlvL1BBVEVOVFMudHh0XG4gKi9cblxuKGZ1bmN0aW9uKGdsb2JhbCkge1xuICAndXNlIHN0cmljdCc7XG5cbiAgdmFyIHRlc3RpbmdFeHBvc2VDeWNsZUNvdW50ID0gZ2xvYmFsLnRlc3RpbmdFeHBvc2VDeWNsZUNvdW50O1xuXG4gIC8vIERldGVjdCBhbmQgZG8gYmFzaWMgc2FuaXR5IGNoZWNraW5nIG9uIE9iamVjdC9BcnJheS5vYnNlcnZlLlxuICBmdW5jdGlvbiBkZXRlY3RPYmplY3RPYnNlcnZlKCkge1xuICAgIGlmICh0eXBlb2YgT2JqZWN0Lm9ic2VydmUgIT09ICdmdW5jdGlvbicgfHxcbiAgICAgICAgdHlwZW9mIEFycmF5Lm9ic2VydmUgIT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICB2YXIgcmVjb3JkcyA9IFtdO1xuXG4gICAgZnVuY3Rpb24gY2FsbGJhY2socmVjcykge1xuICAgICAgcmVjb3JkcyA9IHJlY3M7XG4gICAgfVxuXG4gICAgdmFyIHRlc3QgPSB7fTtcbiAgICB2YXIgYXJyID0gW107XG4gICAgT2JqZWN0Lm9ic2VydmUodGVzdCwgY2FsbGJhY2spO1xuICAgIEFycmF5Lm9ic2VydmUoYXJyLCBjYWxsYmFjayk7XG4gICAgdGVzdC5pZCA9IDE7XG4gICAgdGVzdC5pZCA9IDI7XG4gICAgZGVsZXRlIHRlc3QuaWQ7XG4gICAgYXJyLnB1c2goMSwgMik7XG4gICAgYXJyLmxlbmd0aCA9IDA7XG5cbiAgICBPYmplY3QuZGVsaXZlckNoYW5nZVJlY29yZHMoY2FsbGJhY2spO1xuICAgIGlmIChyZWNvcmRzLmxlbmd0aCAhPT0gNSlcbiAgICAgIHJldHVybiBmYWxzZTtcblxuICAgIGlmIChyZWNvcmRzWzBdLnR5cGUgIT0gJ2FkZCcgfHxcbiAgICAgICAgcmVjb3Jkc1sxXS50eXBlICE9ICd1cGRhdGUnIHx8XG4gICAgICAgIHJlY29yZHNbMl0udHlwZSAhPSAnZGVsZXRlJyB8fFxuICAgICAgICByZWNvcmRzWzNdLnR5cGUgIT0gJ3NwbGljZScgfHxcbiAgICAgICAgcmVjb3Jkc1s0XS50eXBlICE9ICdzcGxpY2UnKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgT2JqZWN0LnVub2JzZXJ2ZSh0ZXN0LCBjYWxsYmFjayk7XG4gICAgQXJyYXkudW5vYnNlcnZlKGFyciwgY2FsbGJhY2spO1xuXG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICB2YXIgaGFzT2JzZXJ2ZSA9IGRldGVjdE9iamVjdE9ic2VydmUoKTtcblxuICBmdW5jdGlvbiBkZXRlY3RFdmFsKCkge1xuICAgIC8vIERvbid0IHRlc3QgZm9yIGV2YWwgaWYgd2UncmUgcnVubmluZyBpbiBhIENocm9tZSBBcHAgZW52aXJvbm1lbnQuXG4gICAgLy8gV2UgY2hlY2sgZm9yIEFQSXMgc2V0IHRoYXQgb25seSBleGlzdCBpbiBhIENocm9tZSBBcHAgY29udGV4dC5cbiAgICBpZiAodHlwZW9mIGNocm9tZSAhPT0gJ3VuZGVmaW5lZCcgJiYgY2hyb21lLmFwcCAmJiBjaHJvbWUuYXBwLnJ1bnRpbWUpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICAvLyBGaXJlZm94IE9TIEFwcHMgZG8gbm90IGFsbG93IGV2YWwuIFRoaXMgZmVhdHVyZSBkZXRlY3Rpb24gaXMgdmVyeSBoYWNreVxuICAgIC8vIGJ1dCBldmVuIGlmIHNvbWUgb3RoZXIgcGxhdGZvcm0gYWRkcyBzdXBwb3J0IGZvciB0aGlzIGZ1bmN0aW9uIHRoaXMgY29kZVxuICAgIC8vIHdpbGwgY29udGludWUgdG8gd29yay5cbiAgICBpZiAobmF2aWdhdG9yLmdldERldmljZVN0b3JhZ2UpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICB0cnkge1xuICAgICAgdmFyIGYgPSBuZXcgRnVuY3Rpb24oJycsICdyZXR1cm4gdHJ1ZTsnKTtcbiAgICAgIHJldHVybiBmKCk7XG4gICAgfSBjYXRjaCAoZXgpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cblxuICB2YXIgaGFzRXZhbCA9IGRldGVjdEV2YWwoKTtcblxuICBmdW5jdGlvbiBpc0luZGV4KHMpIHtcbiAgICByZXR1cm4gK3MgPT09IHMgPj4+IDAgJiYgcyAhPT0gJyc7XG4gIH1cblxuICBmdW5jdGlvbiB0b051bWJlcihzKSB7XG4gICAgcmV0dXJuICtzO1xuICB9XG5cbiAgdmFyIG51bWJlcklzTmFOID0gZ2xvYmFsLk51bWJlci5pc05hTiB8fCBmdW5jdGlvbih2YWx1ZSkge1xuICAgIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInICYmIGdsb2JhbC5pc05hTih2YWx1ZSk7XG4gIH1cblxuXG4gIHZhciBjcmVhdGVPYmplY3QgPSAoJ19fcHJvdG9fXycgaW4ge30pID9cbiAgICBmdW5jdGlvbihvYmopIHsgcmV0dXJuIG9iajsgfSA6XG4gICAgZnVuY3Rpb24ob2JqKSB7XG4gICAgICB2YXIgcHJvdG8gPSBvYmouX19wcm90b19fO1xuICAgICAgaWYgKCFwcm90bylcbiAgICAgICAgcmV0dXJuIG9iajtcbiAgICAgIHZhciBuZXdPYmplY3QgPSBPYmplY3QuY3JlYXRlKHByb3RvKTtcbiAgICAgIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKG9iaikuZm9yRWFjaChmdW5jdGlvbihuYW1lKSB7XG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShuZXdPYmplY3QsIG5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3Iob2JqLCBuYW1lKSk7XG4gICAgICB9KTtcbiAgICAgIHJldHVybiBuZXdPYmplY3Q7XG4gICAgfTtcblxuICB2YXIgaWRlbnRTdGFydCA9ICdbXFwkX2EtekEtWl0nO1xuICB2YXIgaWRlbnRQYXJ0ID0gJ1tcXCRfYS16QS1aMC05XSc7XG5cblxuICB2YXIgTUFYX0RJUlRZX0NIRUNLX0NZQ0xFUyA9IDEwMDA7XG5cbiAgZnVuY3Rpb24gZGlydHlDaGVjayhvYnNlcnZlcikge1xuICAgIHZhciBjeWNsZXMgPSAwO1xuICAgIHdoaWxlIChjeWNsZXMgPCBNQVhfRElSVFlfQ0hFQ0tfQ1lDTEVTICYmIG9ic2VydmVyLmNoZWNrXygpKSB7XG4gICAgICBjeWNsZXMrKztcbiAgICB9XG4gICAgaWYgKHRlc3RpbmdFeHBvc2VDeWNsZUNvdW50KVxuICAgICAgZ2xvYmFsLmRpcnR5Q2hlY2tDeWNsZUNvdW50ID0gY3ljbGVzO1xuXG4gICAgcmV0dXJuIGN5Y2xlcyA+IDA7XG4gIH1cblxuICBmdW5jdGlvbiBvYmplY3RJc0VtcHR5KG9iamVjdCkge1xuICAgIGZvciAodmFyIHByb3AgaW4gb2JqZWN0KVxuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgZnVuY3Rpb24gZGlmZklzRW1wdHkoZGlmZikge1xuICAgIHJldHVybiBvYmplY3RJc0VtcHR5KGRpZmYuYWRkZWQpICYmXG4gICAgICAgICAgIG9iamVjdElzRW1wdHkoZGlmZi5yZW1vdmVkKSAmJlxuICAgICAgICAgICBvYmplY3RJc0VtcHR5KGRpZmYuY2hhbmdlZCk7XG4gIH1cblxuICBmdW5jdGlvbiBkaWZmT2JqZWN0RnJvbU9sZE9iamVjdChvYmplY3QsIG9sZE9iamVjdCkge1xuICAgIHZhciBhZGRlZCA9IHt9O1xuICAgIHZhciByZW1vdmVkID0ge307XG4gICAgdmFyIGNoYW5nZWQgPSB7fTtcblxuICAgIGZvciAodmFyIHByb3AgaW4gb2xkT2JqZWN0KSB7XG4gICAgICB2YXIgbmV3VmFsdWUgPSBvYmplY3RbcHJvcF07XG5cbiAgICAgIGlmIChuZXdWYWx1ZSAhPT0gdW5kZWZpbmVkICYmIG5ld1ZhbHVlID09PSBvbGRPYmplY3RbcHJvcF0pXG4gICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICBpZiAoIShwcm9wIGluIG9iamVjdCkpIHtcbiAgICAgICAgcmVtb3ZlZFtwcm9wXSA9IHVuZGVmaW5lZDtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGlmIChuZXdWYWx1ZSAhPT0gb2xkT2JqZWN0W3Byb3BdKVxuICAgICAgICBjaGFuZ2VkW3Byb3BdID0gbmV3VmFsdWU7XG4gICAgfVxuXG4gICAgZm9yICh2YXIgcHJvcCBpbiBvYmplY3QpIHtcbiAgICAgIGlmIChwcm9wIGluIG9sZE9iamVjdClcbiAgICAgICAgY29udGludWU7XG5cbiAgICAgIGFkZGVkW3Byb3BdID0gb2JqZWN0W3Byb3BdO1xuICAgIH1cblxuICAgIGlmIChBcnJheS5pc0FycmF5KG9iamVjdCkgJiYgb2JqZWN0Lmxlbmd0aCAhPT0gb2xkT2JqZWN0Lmxlbmd0aClcbiAgICAgIGNoYW5nZWQubGVuZ3RoID0gb2JqZWN0Lmxlbmd0aDtcblxuICAgIHJldHVybiB7XG4gICAgICBhZGRlZDogYWRkZWQsXG4gICAgICByZW1vdmVkOiByZW1vdmVkLFxuICAgICAgY2hhbmdlZDogY2hhbmdlZFxuICAgIH07XG4gIH1cblxuICB2YXIgZW9tVGFza3MgPSBbXTtcbiAgZnVuY3Rpb24gcnVuRU9NVGFza3MoKSB7XG4gICAgaWYgKCFlb21UYXNrcy5sZW5ndGgpXG4gICAgICByZXR1cm4gZmFsc2U7XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGVvbVRhc2tzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBlb21UYXNrc1tpXSgpO1xuICAgIH1cbiAgICBlb21UYXNrcy5sZW5ndGggPSAwO1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgdmFyIHJ1bkVPTSA9IGhhc09ic2VydmUgPyAoZnVuY3Rpb24oKXtcbiAgICB2YXIgZW9tT2JqID0geyBwaW5nUG9uZzogdHJ1ZSB9O1xuICAgIHZhciBlb21SdW5TY2hlZHVsZWQgPSBmYWxzZTtcblxuICAgIE9iamVjdC5vYnNlcnZlKGVvbU9iaiwgZnVuY3Rpb24oKSB7XG4gICAgICBydW5FT01UYXNrcygpO1xuICAgICAgZW9tUnVuU2NoZWR1bGVkID0gZmFsc2U7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gZnVuY3Rpb24oZm4pIHtcbiAgICAgIGVvbVRhc2tzLnB1c2goZm4pO1xuICAgICAgaWYgKCFlb21SdW5TY2hlZHVsZWQpIHtcbiAgICAgICAgZW9tUnVuU2NoZWR1bGVkID0gdHJ1ZTtcbiAgICAgICAgZW9tT2JqLnBpbmdQb25nID0gIWVvbU9iai5waW5nUG9uZztcbiAgICAgIH1cbiAgICB9O1xuICB9KSgpIDpcbiAgKGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBmdW5jdGlvbihmbikge1xuICAgICAgZW9tVGFza3MucHVzaChmbik7XG4gICAgfTtcbiAgfSkoKTtcblxuICB2YXIgb2JzZXJ2ZWRPYmplY3RDYWNoZSA9IFtdO1xuXG4gIGZ1bmN0aW9uIG5ld09ic2VydmVkT2JqZWN0KCkge1xuICAgIHZhciBvYnNlcnZlcjtcbiAgICB2YXIgb2JqZWN0O1xuICAgIHZhciBkaXNjYXJkUmVjb3JkcyA9IGZhbHNlO1xuICAgIHZhciBmaXJzdCA9IHRydWU7XG5cbiAgICBmdW5jdGlvbiBjYWxsYmFjayhyZWNvcmRzKSB7XG4gICAgICBpZiAob2JzZXJ2ZXIgJiYgb2JzZXJ2ZXIuc3RhdGVfID09PSBPUEVORUQgJiYgIWRpc2NhcmRSZWNvcmRzKVxuICAgICAgICBvYnNlcnZlci5jaGVja18ocmVjb3Jkcyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIG9wZW46IGZ1bmN0aW9uKG9icykge1xuICAgICAgICBpZiAob2JzZXJ2ZXIpXG4gICAgICAgICAgdGhyb3cgRXJyb3IoJ09ic2VydmVkT2JqZWN0IGluIHVzZScpO1xuXG4gICAgICAgIGlmICghZmlyc3QpXG4gICAgICAgICAgT2JqZWN0LmRlbGl2ZXJDaGFuZ2VSZWNvcmRzKGNhbGxiYWNrKTtcblxuICAgICAgICBvYnNlcnZlciA9IG9icztcbiAgICAgICAgZmlyc3QgPSBmYWxzZTtcbiAgICAgIH0sXG4gICAgICBvYnNlcnZlOiBmdW5jdGlvbihvYmosIGFycmF5T2JzZXJ2ZSkge1xuICAgICAgICBvYmplY3QgPSBvYmo7XG4gICAgICAgIGlmIChhcnJheU9ic2VydmUpXG4gICAgICAgICAgQXJyYXkub2JzZXJ2ZShvYmplY3QsIGNhbGxiYWNrKTtcbiAgICAgICAgZWxzZVxuICAgICAgICAgIE9iamVjdC5vYnNlcnZlKG9iamVjdCwgY2FsbGJhY2spO1xuICAgICAgfSxcbiAgICAgIGRlbGl2ZXI6IGZ1bmN0aW9uKGRpc2NhcmQpIHtcbiAgICAgICAgZGlzY2FyZFJlY29yZHMgPSBkaXNjYXJkO1xuICAgICAgICBPYmplY3QuZGVsaXZlckNoYW5nZVJlY29yZHMoY2FsbGJhY2spO1xuICAgICAgICBkaXNjYXJkUmVjb3JkcyA9IGZhbHNlO1xuICAgICAgfSxcbiAgICAgIGNsb3NlOiBmdW5jdGlvbigpIHtcbiAgICAgICAgb2JzZXJ2ZXIgPSB1bmRlZmluZWQ7XG4gICAgICAgIE9iamVjdC51bm9ic2VydmUob2JqZWN0LCBjYWxsYmFjayk7XG4gICAgICAgIG9ic2VydmVkT2JqZWN0Q2FjaGUucHVzaCh0aGlzKTtcbiAgICAgIH1cbiAgICB9O1xuICB9XG5cbiAgLypcbiAgICogVGhlIG9ic2VydmVkU2V0IGFic3RyYWN0aW9uIGlzIGEgcGVyZiBvcHRpbWl6YXRpb24gd2hpY2ggcmVkdWNlcyB0aGUgdG90YWxcbiAgICogbnVtYmVyIG9mIE9iamVjdC5vYnNlcnZlIG9ic2VydmF0aW9ucyBvZiBhIHNldCBvZiBvYmplY3RzLiBUaGUgaWRlYSBpcyB0aGF0XG4gICAqIGdyb3VwcyBvZiBPYnNlcnZlcnMgd2lsbCBoYXZlIHNvbWUgb2JqZWN0IGRlcGVuZGVuY2llcyBpbiBjb21tb24gYW5kIHRoaXNcbiAgICogb2JzZXJ2ZWQgc2V0IGVuc3VyZXMgdGhhdCBlYWNoIG9iamVjdCBpbiB0aGUgdHJhbnNpdGl2ZSBjbG9zdXJlIG9mXG4gICAqIGRlcGVuZGVuY2llcyBpcyBvbmx5IG9ic2VydmVkIG9uY2UuIFRoZSBvYnNlcnZlZFNldCBhY3RzIGFzIGEgd3JpdGUgYmFycmllclxuICAgKiBzdWNoIHRoYXQgd2hlbmV2ZXIgYW55IGNoYW5nZSBjb21lcyB0aHJvdWdoLCBhbGwgT2JzZXJ2ZXJzIGFyZSBjaGVja2VkIGZvclxuICAgKiBjaGFuZ2VkIHZhbHVlcy5cbiAgICpcbiAgICogTm90ZSB0aGF0IHRoaXMgb3B0aW1pemF0aW9uIGlzIGV4cGxpY2l0bHkgbW92aW5nIHdvcmsgZnJvbSBzZXR1cC10aW1lIHRvXG4gICAqIGNoYW5nZS10aW1lLlxuICAgKlxuICAgKiBUT0RPKHJhZmFlbHcpOiBJbXBsZW1lbnQgXCJnYXJiYWdlIGNvbGxlY3Rpb25cIi4gSW4gb3JkZXIgdG8gbW92ZSB3b3JrIG9mZlxuICAgKiB0aGUgY3JpdGljYWwgcGF0aCwgd2hlbiBPYnNlcnZlcnMgYXJlIGNsb3NlZCwgdGhlaXIgb2JzZXJ2ZWQgb2JqZWN0cyBhcmVcbiAgICogbm90IE9iamVjdC51bm9ic2VydmUoZCkuIEFzIGEgcmVzdWx0LCBpdCdzaWVzdGEgcG9zc2libGUgdGhhdCBpZiB0aGUgb2JzZXJ2ZWRTZXRcbiAgICogaXMga2VwdCBvcGVuLCBidXQgc29tZSBPYnNlcnZlcnMgaGF2ZSBiZWVuIGNsb3NlZCwgaXQgY291bGQgY2F1c2UgXCJsZWFrc1wiXG4gICAqIChwcmV2ZW50IG90aGVyd2lzZSBjb2xsZWN0YWJsZSBvYmplY3RzIGZyb20gYmVpbmcgY29sbGVjdGVkKS4gQXQgc29tZVxuICAgKiBwb2ludCwgd2Ugc2hvdWxkIGltcGxlbWVudCBpbmNyZW1lbnRhbCBcImdjXCIgd2hpY2gga2VlcHMgYSBsaXN0IG9mXG4gICAqIG9ic2VydmVkU2V0cyB3aGljaCBtYXkgbmVlZCBjbGVhbi11cCBhbmQgZG9lcyBzbWFsbCBhbW91bnRzIG9mIGNsZWFudXAgb24gYVxuICAgKiB0aW1lb3V0IHVudGlsIGFsbCBpcyBjbGVhbi5cbiAgICovXG5cbiAgZnVuY3Rpb24gZ2V0T2JzZXJ2ZWRPYmplY3Qob2JzZXJ2ZXIsIG9iamVjdCwgYXJyYXlPYnNlcnZlKSB7XG4gICAgdmFyIGRpciA9IG9ic2VydmVkT2JqZWN0Q2FjaGUucG9wKCkgfHwgbmV3T2JzZXJ2ZWRPYmplY3QoKTtcbiAgICBkaXIub3BlbihvYnNlcnZlcik7XG4gICAgZGlyLm9ic2VydmUob2JqZWN0LCBhcnJheU9ic2VydmUpO1xuICAgIHJldHVybiBkaXI7XG4gIH1cblxuICB2YXIgb2JzZXJ2ZWRTZXRDYWNoZSA9IFtdO1xuXG4gIGZ1bmN0aW9uIG5ld09ic2VydmVkU2V0KCkge1xuICAgIHZhciBvYnNlcnZlckNvdW50ID0gMDtcbiAgICB2YXIgb2JzZXJ2ZXJzID0gW107XG4gICAgdmFyIG9iamVjdHMgPSBbXTtcbiAgICB2YXIgcm9vdE9iajtcbiAgICB2YXIgcm9vdE9ialByb3BzO1xuXG4gICAgZnVuY3Rpb24gb2JzZXJ2ZShvYmosIHByb3ApIHtcbiAgICAgIGlmICghb2JqKVxuICAgICAgICByZXR1cm47XG5cbiAgICAgIGlmIChvYmogPT09IHJvb3RPYmopXG4gICAgICAgIHJvb3RPYmpQcm9wc1twcm9wXSA9IHRydWU7XG5cbiAgICAgIGlmIChvYmplY3RzLmluZGV4T2Yob2JqKSA8IDApIHtcbiAgICAgICAgb2JqZWN0cy5wdXNoKG9iaik7XG4gICAgICAgIE9iamVjdC5vYnNlcnZlKG9iaiwgY2FsbGJhY2spO1xuICAgICAgfVxuXG4gICAgICBvYnNlcnZlKE9iamVjdC5nZXRQcm90b3R5cGVPZihvYmopLCBwcm9wKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBhbGxSb290T2JqTm9uT2JzZXJ2ZWRQcm9wcyhyZWNzKSB7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHJlY3MubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIHJlYyA9IHJlY3NbaV07XG4gICAgICAgIGlmIChyZWMub2JqZWN0ICE9PSByb290T2JqIHx8XG4gICAgICAgICAgICByb290T2JqUHJvcHNbcmVjLm5hbWVdIHx8XG4gICAgICAgICAgICByZWMudHlwZSA9PT0gJ3NldFByb3RvdHlwZScpIHtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGNhbGxiYWNrKHJlY3MpIHtcbiAgICAgIGlmIChhbGxSb290T2JqTm9uT2JzZXJ2ZWRQcm9wcyhyZWNzKSlcbiAgICAgICAgcmV0dXJuO1xuXG4gICAgICB2YXIgb2JzZXJ2ZXI7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IG9ic2VydmVycy5sZW5ndGg7IGkrKykge1xuICAgICAgICBvYnNlcnZlciA9IG9ic2VydmVyc1tpXTtcbiAgICAgICAgaWYgKG9ic2VydmVyLnN0YXRlXyA9PSBPUEVORUQpIHtcbiAgICAgICAgICBvYnNlcnZlci5pdGVyYXRlT2JqZWN0c18ob2JzZXJ2ZSk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBvYnNlcnZlcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgb2JzZXJ2ZXIgPSBvYnNlcnZlcnNbaV07XG4gICAgICAgIGlmIChvYnNlcnZlci5zdGF0ZV8gPT0gT1BFTkVEKSB7XG4gICAgICAgICAgb2JzZXJ2ZXIuY2hlY2tfKCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICB2YXIgcmVjb3JkID0ge1xuICAgICAgb2JqZWN0OiB1bmRlZmluZWQsXG4gICAgICBvYmplY3RzOiBvYmplY3RzLFxuICAgICAgb3BlbjogZnVuY3Rpb24ob2JzLCBvYmplY3QpIHtcbiAgICAgICAgaWYgKCFyb290T2JqKSB7XG4gICAgICAgICAgcm9vdE9iaiA9IG9iamVjdDtcbiAgICAgICAgICByb290T2JqUHJvcHMgPSB7fTtcbiAgICAgICAgfVxuXG4gICAgICAgIG9ic2VydmVycy5wdXNoKG9icyk7XG4gICAgICAgIG9ic2VydmVyQ291bnQrKztcbiAgICAgICAgb2JzLml0ZXJhdGVPYmplY3RzXyhvYnNlcnZlKTtcbiAgICAgIH0sXG4gICAgICBjbG9zZTogZnVuY3Rpb24ob2JzKSB7XG4gICAgICAgIG9ic2VydmVyQ291bnQtLTtcbiAgICAgICAgaWYgKG9ic2VydmVyQ291bnQgPiAwKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBvYmplY3RzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgT2JqZWN0LnVub2JzZXJ2ZShvYmplY3RzW2ldLCBjYWxsYmFjayk7XG4gICAgICAgICAgT2JzZXJ2ZXIudW5vYnNlcnZlZENvdW50Kys7XG4gICAgICAgIH1cblxuICAgICAgICBvYnNlcnZlcnMubGVuZ3RoID0gMDtcbiAgICAgICAgb2JqZWN0cy5sZW5ndGggPSAwO1xuICAgICAgICByb290T2JqID0gdW5kZWZpbmVkO1xuICAgICAgICByb290T2JqUHJvcHMgPSB1bmRlZmluZWQ7XG4gICAgICAgIG9ic2VydmVkU2V0Q2FjaGUucHVzaCh0aGlzKTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgcmV0dXJuIHJlY29yZDtcbiAgfVxuXG4gIHZhciBsYXN0T2JzZXJ2ZWRTZXQ7XG5cbiAgdmFyIFVOT1BFTkVEID0gMDtcbiAgdmFyIE9QRU5FRCA9IDE7XG4gIHZhciBDTE9TRUQgPSAyO1xuXG4gIHZhciBuZXh0T2JzZXJ2ZXJJZCA9IDE7XG5cbiAgZnVuY3Rpb24gT2JzZXJ2ZXIoKSB7XG4gICAgdGhpcy5zdGF0ZV8gPSBVTk9QRU5FRDtcbiAgICB0aGlzLmNhbGxiYWNrXyA9IHVuZGVmaW5lZDtcbiAgICB0aGlzLnRhcmdldF8gPSB1bmRlZmluZWQ7IC8vIFRPRE8ocmFmYWVsdyk6IFNob3VsZCBiZSBXZWFrUmVmXG4gICAgdGhpcy5kaXJlY3RPYnNlcnZlcl8gPSB1bmRlZmluZWQ7XG4gICAgdGhpcy52YWx1ZV8gPSB1bmRlZmluZWQ7XG4gICAgdGhpcy5pZF8gPSBuZXh0T2JzZXJ2ZXJJZCsrO1xuICB9XG5cbiAgT2JzZXJ2ZXIucHJvdG90eXBlID0ge1xuICAgIG9wZW46IGZ1bmN0aW9uKGNhbGxiYWNrLCB0YXJnZXQpIHtcbiAgICAgIGlmICh0aGlzLnN0YXRlXyAhPSBVTk9QRU5FRClcbiAgICAgICAgdGhyb3cgRXJyb3IoJ09ic2VydmVyIGhhcyBhbHJlYWR5IGJlZW4gb3BlbmVkLicpO1xuXG4gICAgICBhZGRUb0FsbCh0aGlzKTtcbiAgICAgIHRoaXMuY2FsbGJhY2tfID0gY2FsbGJhY2s7XG4gICAgICB0aGlzLnRhcmdldF8gPSB0YXJnZXQ7XG4gICAgICB0aGlzLmNvbm5lY3RfKCk7XG4gICAgICB0aGlzLnN0YXRlXyA9IE9QRU5FRDtcbiAgICAgIHJldHVybiB0aGlzLnZhbHVlXztcbiAgICB9LFxuXG4gICAgY2xvc2U6IGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKHRoaXMuc3RhdGVfICE9IE9QRU5FRClcbiAgICAgICAgcmV0dXJuO1xuXG4gICAgICByZW1vdmVGcm9tQWxsKHRoaXMpO1xuICAgICAgdGhpcy5kaXNjb25uZWN0XygpO1xuICAgICAgdGhpcy52YWx1ZV8gPSB1bmRlZmluZWQ7XG4gICAgICB0aGlzLmNhbGxiYWNrXyA9IHVuZGVmaW5lZDtcbiAgICAgIHRoaXMudGFyZ2V0XyA9IHVuZGVmaW5lZDtcbiAgICAgIHRoaXMuc3RhdGVfID0gQ0xPU0VEO1xuICAgIH0sXG5cbiAgICBkZWxpdmVyOiBmdW5jdGlvbigpIHtcbiAgICAgIGlmICh0aGlzLnN0YXRlXyAhPSBPUEVORUQpXG4gICAgICAgIHJldHVybjtcblxuICAgICAgZGlydHlDaGVjayh0aGlzKTtcbiAgICB9LFxuXG4gICAgcmVwb3J0XzogZnVuY3Rpb24oY2hhbmdlcykge1xuICAgICAgdHJ5IHtcbiAgICAgICAgdGhpcy5jYWxsYmFja18uYXBwbHkodGhpcy50YXJnZXRfLCBjaGFuZ2VzKTtcbiAgICAgIH0gY2F0Y2ggKGV4KSB7XG4gICAgICAgIE9ic2VydmVyLl9lcnJvclRocm93bkR1cmluZ0NhbGxiYWNrID0gdHJ1ZTtcbiAgICAgICAgY29uc29sZS5lcnJvcignRXhjZXB0aW9uIGNhdWdodCBkdXJpbmcgb2JzZXJ2ZXIgY2FsbGJhY2s6ICcgK1xuICAgICAgICAgICAgICAgICAgICAgICAoZXguc3RhY2sgfHwgZXgpKTtcbiAgICAgIH1cbiAgICB9LFxuXG4gICAgZGlzY2FyZENoYW5nZXM6IGZ1bmN0aW9uKCkge1xuICAgICAgdGhpcy5jaGVja18odW5kZWZpbmVkLCB0cnVlKTtcbiAgICAgIHJldHVybiB0aGlzLnZhbHVlXztcbiAgICB9XG4gIH1cblxuICB2YXIgY29sbGVjdE9ic2VydmVycyA9ICFoYXNPYnNlcnZlO1xuICB2YXIgYWxsT2JzZXJ2ZXJzO1xuICBPYnNlcnZlci5fYWxsT2JzZXJ2ZXJzQ291bnQgPSAwO1xuXG4gIGlmIChjb2xsZWN0T2JzZXJ2ZXJzKSB7XG4gICAgYWxsT2JzZXJ2ZXJzID0gW107XG4gIH1cblxuICBmdW5jdGlvbiBhZGRUb0FsbChvYnNlcnZlcikge1xuICAgIE9ic2VydmVyLl9hbGxPYnNlcnZlcnNDb3VudCsrO1xuICAgIGlmICghY29sbGVjdE9ic2VydmVycylcbiAgICAgIHJldHVybjtcblxuICAgIGFsbE9ic2VydmVycy5wdXNoKG9ic2VydmVyKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlbW92ZUZyb21BbGwob2JzZXJ2ZXIpIHtcbiAgICBPYnNlcnZlci5fYWxsT2JzZXJ2ZXJzQ291bnQtLTtcbiAgfVxuXG4gIHZhciBydW5uaW5nTWljcm90YXNrQ2hlY2twb2ludCA9IGZhbHNlO1xuXG4gIHZhciBoYXNEZWJ1Z0ZvcmNlRnVsbERlbGl2ZXJ5ID0gaGFzT2JzZXJ2ZSAmJiBoYXNFdmFsICYmIChmdW5jdGlvbigpIHtcbiAgICB0cnkge1xuICAgICAgZXZhbCgnJVJ1bk1pY3JvdGFza3MoKScpO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSBjYXRjaCAoZXgpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH0pKCk7XG5cbiAgZ2xvYmFsLlBsYXRmb3JtID0gZ2xvYmFsLlBsYXRmb3JtIHx8IHt9O1xuXG4gIGdsb2JhbC5QbGF0Zm9ybS5wZXJmb3JtTWljcm90YXNrQ2hlY2twb2ludCA9IGZ1bmN0aW9uKCkge1xuICAgIGlmIChydW5uaW5nTWljcm90YXNrQ2hlY2twb2ludClcbiAgICAgIHJldHVybjtcblxuICAgIGlmIChoYXNEZWJ1Z0ZvcmNlRnVsbERlbGl2ZXJ5KSB7XG4gICAgICBldmFsKCclUnVuTWljcm90YXNrcygpJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKCFjb2xsZWN0T2JzZXJ2ZXJzKVxuICAgICAgcmV0dXJuO1xuXG4gICAgcnVubmluZ01pY3JvdGFza0NoZWNrcG9pbnQgPSB0cnVlO1xuXG4gICAgdmFyIGN5Y2xlcyA9IDA7XG4gICAgdmFyIGFueUNoYW5nZWQsIHRvQ2hlY2s7XG5cbiAgICBkbyB7XG4gICAgICBjeWNsZXMrKztcbiAgICAgIHRvQ2hlY2sgPSBhbGxPYnNlcnZlcnM7XG4gICAgICBhbGxPYnNlcnZlcnMgPSBbXTtcbiAgICAgIGFueUNoYW5nZWQgPSBmYWxzZTtcblxuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0b0NoZWNrLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciBvYnNlcnZlciA9IHRvQ2hlY2tbaV07XG4gICAgICAgIGlmIChvYnNlcnZlci5zdGF0ZV8gIT0gT1BFTkVEKVxuICAgICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICAgIGlmIChvYnNlcnZlci5jaGVja18oKSlcbiAgICAgICAgICBhbnlDaGFuZ2VkID0gdHJ1ZTtcblxuICAgICAgICBhbGxPYnNlcnZlcnMucHVzaChvYnNlcnZlcik7XG4gICAgICB9XG4gICAgICBpZiAocnVuRU9NVGFza3MoKSlcbiAgICAgICAgYW55Q2hhbmdlZCA9IHRydWU7XG4gICAgfSB3aGlsZSAoY3ljbGVzIDwgTUFYX0RJUlRZX0NIRUNLX0NZQ0xFUyAmJiBhbnlDaGFuZ2VkKTtcblxuICAgIGlmICh0ZXN0aW5nRXhwb3NlQ3ljbGVDb3VudClcbiAgICAgIGdsb2JhbC5kaXJ0eUNoZWNrQ3ljbGVDb3VudCA9IGN5Y2xlcztcblxuICAgIHJ1bm5pbmdNaWNyb3Rhc2tDaGVja3BvaW50ID0gZmFsc2U7XG4gIH07XG5cbiAgaWYgKGNvbGxlY3RPYnNlcnZlcnMpIHtcbiAgICBnbG9iYWwuUGxhdGZvcm0uY2xlYXJPYnNlcnZlcnMgPSBmdW5jdGlvbigpIHtcbiAgICAgIGFsbE9ic2VydmVycyA9IFtdO1xuICAgIH07XG4gIH1cblxuICBmdW5jdGlvbiBPYmplY3RPYnNlcnZlcihvYmplY3QpIHtcbiAgICBPYnNlcnZlci5jYWxsKHRoaXMpO1xuICAgIHRoaXMudmFsdWVfID0gb2JqZWN0O1xuICAgIHRoaXMub2xkT2JqZWN0XyA9IHVuZGVmaW5lZDtcbiAgfVxuXG4gIE9iamVjdE9ic2VydmVyLnByb3RvdHlwZSA9IGNyZWF0ZU9iamVjdCh7XG4gICAgX19wcm90b19fOiBPYnNlcnZlci5wcm90b3R5cGUsXG5cbiAgICBhcnJheU9ic2VydmU6IGZhbHNlLFxuXG4gICAgY29ubmVjdF86IGZ1bmN0aW9uKGNhbGxiYWNrLCB0YXJnZXQpIHtcbiAgICAgIGlmIChoYXNPYnNlcnZlKSB7XG4gICAgICAgIHRoaXMuZGlyZWN0T2JzZXJ2ZXJfID0gZ2V0T2JzZXJ2ZWRPYmplY3QodGhpcywgdGhpcy52YWx1ZV8sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5hcnJheU9ic2VydmUpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5vbGRPYmplY3RfID0gdGhpcy5jb3B5T2JqZWN0KHRoaXMudmFsdWVfKTtcbiAgICAgIH1cblxuICAgIH0sXG5cbiAgICBjb3B5T2JqZWN0OiBmdW5jdGlvbihvYmplY3QpIHtcbiAgICAgIHZhciBjb3B5ID0gQXJyYXkuaXNBcnJheShvYmplY3QpID8gW10gOiB7fTtcbiAgICAgIGZvciAodmFyIHByb3AgaW4gb2JqZWN0KSB7XG4gICAgICAgIGNvcHlbcHJvcF0gPSBvYmplY3RbcHJvcF07XG4gICAgICB9O1xuICAgICAgaWYgKEFycmF5LmlzQXJyYXkob2JqZWN0KSlcbiAgICAgICAgY29weS5sZW5ndGggPSBvYmplY3QubGVuZ3RoO1xuICAgICAgcmV0dXJuIGNvcHk7XG4gICAgfSxcblxuICAgIGNoZWNrXzogZnVuY3Rpb24oY2hhbmdlUmVjb3Jkcywgc2tpcENoYW5nZXMpIHtcbiAgICAgIHZhciBkaWZmO1xuICAgICAgdmFyIG9sZFZhbHVlcztcbiAgICAgIGlmIChoYXNPYnNlcnZlKSB7XG4gICAgICAgIGlmICghY2hhbmdlUmVjb3JkcylcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG5cbiAgICAgICAgb2xkVmFsdWVzID0ge307XG4gICAgICAgIGRpZmYgPSBkaWZmT2JqZWN0RnJvbUNoYW5nZVJlY29yZHModGhpcy52YWx1ZV8sIGNoYW5nZVJlY29yZHMsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb2xkVmFsdWVzKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG9sZFZhbHVlcyA9IHRoaXMub2xkT2JqZWN0XztcbiAgICAgICAgZGlmZiA9IGRpZmZPYmplY3RGcm9tT2xkT2JqZWN0KHRoaXMudmFsdWVfLCB0aGlzLm9sZE9iamVjdF8pO1xuICAgICAgfVxuXG4gICAgICBpZiAoZGlmZklzRW1wdHkoZGlmZikpXG4gICAgICAgIHJldHVybiBmYWxzZTtcblxuICAgICAgaWYgKCFoYXNPYnNlcnZlKVxuICAgICAgICB0aGlzLm9sZE9iamVjdF8gPSB0aGlzLmNvcHlPYmplY3QodGhpcy52YWx1ZV8pO1xuXG4gICAgICB0aGlzLnJlcG9ydF8oW1xuICAgICAgICBkaWZmLmFkZGVkIHx8IHt9LFxuICAgICAgICBkaWZmLnJlbW92ZWQgfHwge30sXG4gICAgICAgIGRpZmYuY2hhbmdlZCB8fCB7fSxcbiAgICAgICAgZnVuY3Rpb24ocHJvcGVydHkpIHtcbiAgICAgICAgICByZXR1cm4gb2xkVmFsdWVzW3Byb3BlcnR5XTtcbiAgICAgICAgfVxuICAgICAgXSk7XG5cbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0sXG5cbiAgICBkaXNjb25uZWN0XzogZnVuY3Rpb24oKSB7XG4gICAgICBpZiAoaGFzT2JzZXJ2ZSkge1xuICAgICAgICB0aGlzLmRpcmVjdE9ic2VydmVyXy5jbG9zZSgpO1xuICAgICAgICB0aGlzLmRpcmVjdE9ic2VydmVyXyA9IHVuZGVmaW5lZDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMub2xkT2JqZWN0XyA9IHVuZGVmaW5lZDtcbiAgICAgIH1cbiAgICB9LFxuXG4gICAgZGVsaXZlcjogZnVuY3Rpb24oKSB7XG4gICAgICBpZiAodGhpcy5zdGF0ZV8gIT0gT1BFTkVEKVxuICAgICAgICByZXR1cm47XG5cbiAgICAgIGlmIChoYXNPYnNlcnZlKVxuICAgICAgICB0aGlzLmRpcmVjdE9ic2VydmVyXy5kZWxpdmVyKGZhbHNlKTtcbiAgICAgIGVsc2VcbiAgICAgICAgZGlydHlDaGVjayh0aGlzKTtcbiAgICB9LFxuXG4gICAgZGlzY2FyZENoYW5nZXM6IGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKHRoaXMuZGlyZWN0T2JzZXJ2ZXJfKVxuICAgICAgICB0aGlzLmRpcmVjdE9ic2VydmVyXy5kZWxpdmVyKHRydWUpO1xuICAgICAgZWxzZVxuICAgICAgICB0aGlzLm9sZE9iamVjdF8gPSB0aGlzLmNvcHlPYmplY3QodGhpcy52YWx1ZV8pO1xuXG4gICAgICByZXR1cm4gdGhpcy52YWx1ZV87XG4gICAgfVxuICB9KTtcblxuICBmdW5jdGlvbiBBcnJheU9ic2VydmVyKGFycmF5KSB7XG4gICAgaWYgKCFBcnJheS5pc0FycmF5KGFycmF5KSlcbiAgICAgIHRocm93IEVycm9yKCdQcm92aWRlZCBvYmplY3QgaXMgbm90IGFuIEFycmF5Jyk7XG4gICAgT2JqZWN0T2JzZXJ2ZXIuY2FsbCh0aGlzLCBhcnJheSk7XG4gIH1cblxuICBBcnJheU9ic2VydmVyLnByb3RvdHlwZSA9IGNyZWF0ZU9iamVjdCh7XG5cbiAgICBfX3Byb3RvX186IE9iamVjdE9ic2VydmVyLnByb3RvdHlwZSxcblxuICAgIGFycmF5T2JzZXJ2ZTogdHJ1ZSxcblxuICAgIGNvcHlPYmplY3Q6IGZ1bmN0aW9uKGFycikge1xuICAgICAgcmV0dXJuIGFyci5zbGljZSgpO1xuICAgIH0sXG5cbiAgICBjaGVja186IGZ1bmN0aW9uKGNoYW5nZVJlY29yZHMpIHtcbiAgICAgIHZhciBzcGxpY2VzO1xuICAgICAgaWYgKGhhc09ic2VydmUpIHtcbiAgICAgICAgaWYgKCFjaGFuZ2VSZWNvcmRzKVxuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgc3BsaWNlcyA9IHByb2plY3RBcnJheVNwbGljZXModGhpcy52YWx1ZV8sIGNoYW5nZVJlY29yZHMpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc3BsaWNlcyA9IGNhbGNTcGxpY2VzKHRoaXMudmFsdWVfLCAwLCB0aGlzLnZhbHVlXy5sZW5ndGgsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLm9sZE9iamVjdF8sIDAsIHRoaXMub2xkT2JqZWN0Xy5sZW5ndGgpO1xuICAgICAgfVxuXG4gICAgICBpZiAoIXNwbGljZXMgfHwgIXNwbGljZXMubGVuZ3RoKVxuICAgICAgICByZXR1cm4gZmFsc2U7XG5cbiAgICAgIGlmICghaGFzT2JzZXJ2ZSlcbiAgICAgICAgdGhpcy5vbGRPYmplY3RfID0gdGhpcy5jb3B5T2JqZWN0KHRoaXMudmFsdWVfKTtcblxuICAgICAgdGhpcy5yZXBvcnRfKFtzcGxpY2VzXSk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gIH0pO1xuXG4gIEFycmF5T2JzZXJ2ZXIuYXBwbHlTcGxpY2VzID0gZnVuY3Rpb24ocHJldmlvdXMsIGN1cnJlbnQsIHNwbGljZXMpIHtcbiAgICBzcGxpY2VzLmZvckVhY2goZnVuY3Rpb24oc3BsaWNlKSB7XG4gICAgICB2YXIgc3BsaWNlQXJncyA9IFtzcGxpY2UuaW5kZXgsIHNwbGljZS5yZW1vdmVkLmxlbmd0aF07XG4gICAgICB2YXIgYWRkSW5kZXggPSBzcGxpY2UuaW5kZXg7XG4gICAgICB3aGlsZSAoYWRkSW5kZXggPCBzcGxpY2UuaW5kZXggKyBzcGxpY2UuYWRkZWRDb3VudCkge1xuICAgICAgICBzcGxpY2VBcmdzLnB1c2goY3VycmVudFthZGRJbmRleF0pO1xuICAgICAgICBhZGRJbmRleCsrO1xuICAgICAgfVxuXG4gICAgICBBcnJheS5wcm90b3R5cGUuc3BsaWNlLmFwcGx5KHByZXZpb3VzLCBzcGxpY2VBcmdzKTtcbiAgICB9KTtcbiAgfTtcblxuICB2YXIgb2JzZXJ2ZXJTZW50aW5lbCA9IHt9O1xuXG4gIHZhciBleHBlY3RlZFJlY29yZFR5cGVzID0ge1xuICAgIGFkZDogdHJ1ZSxcbiAgICB1cGRhdGU6IHRydWUsXG4gICAgZGVsZXRlOiB0cnVlXG4gIH07XG5cbiAgZnVuY3Rpb24gZGlmZk9iamVjdEZyb21DaGFuZ2VSZWNvcmRzKG9iamVjdCwgY2hhbmdlUmVjb3Jkcywgb2xkVmFsdWVzKSB7XG4gICAgdmFyIGFkZGVkID0ge307XG4gICAgdmFyIHJlbW92ZWQgPSB7fTtcblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY2hhbmdlUmVjb3Jkcy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIHJlY29yZCA9IGNoYW5nZVJlY29yZHNbaV07XG4gICAgICBpZiAoIWV4cGVjdGVkUmVjb3JkVHlwZXNbcmVjb3JkLnR5cGVdKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ1Vua25vd24gY2hhbmdlUmVjb3JkIHR5cGU6ICcgKyByZWNvcmQudHlwZSk7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IocmVjb3JkKTtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGlmICghKHJlY29yZC5uYW1lIGluIG9sZFZhbHVlcykpXG4gICAgICAgIG9sZFZhbHVlc1tyZWNvcmQubmFtZV0gPSByZWNvcmQub2xkVmFsdWU7XG5cbiAgICAgIGlmIChyZWNvcmQudHlwZSA9PSAndXBkYXRlJylcbiAgICAgICAgY29udGludWU7XG5cbiAgICAgIGlmIChyZWNvcmQudHlwZSA9PSAnYWRkJykge1xuICAgICAgICBpZiAocmVjb3JkLm5hbWUgaW4gcmVtb3ZlZClcbiAgICAgICAgICBkZWxldGUgcmVtb3ZlZFtyZWNvcmQubmFtZV07XG4gICAgICAgIGVsc2VcbiAgICAgICAgICBhZGRlZFtyZWNvcmQubmFtZV0gPSB0cnVlO1xuXG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICAvLyB0eXBlID0gJ2RlbGV0ZSdcbiAgICAgIGlmIChyZWNvcmQubmFtZSBpbiBhZGRlZCkge1xuICAgICAgICBkZWxldGUgYWRkZWRbcmVjb3JkLm5hbWVdO1xuICAgICAgICBkZWxldGUgb2xkVmFsdWVzW3JlY29yZC5uYW1lXTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJlbW92ZWRbcmVjb3JkLm5hbWVdID0gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmb3IgKHZhciBwcm9wIGluIGFkZGVkKVxuICAgICAgYWRkZWRbcHJvcF0gPSBvYmplY3RbcHJvcF07XG5cbiAgICBmb3IgKHZhciBwcm9wIGluIHJlbW92ZWQpXG4gICAgICByZW1vdmVkW3Byb3BdID0gdW5kZWZpbmVkO1xuXG4gICAgdmFyIGNoYW5nZWQgPSB7fTtcbiAgICBmb3IgKHZhciBwcm9wIGluIG9sZFZhbHVlcykge1xuICAgICAgaWYgKHByb3AgaW4gYWRkZWQgfHwgcHJvcCBpbiByZW1vdmVkKVxuICAgICAgICBjb250aW51ZTtcblxuICAgICAgdmFyIG5ld1ZhbHVlID0gb2JqZWN0W3Byb3BdO1xuICAgICAgaWYgKG9sZFZhbHVlc1twcm9wXSAhPT0gbmV3VmFsdWUpXG4gICAgICAgIGNoYW5nZWRbcHJvcF0gPSBuZXdWYWx1ZTtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgYWRkZWQ6IGFkZGVkLFxuICAgICAgcmVtb3ZlZDogcmVtb3ZlZCxcbiAgICAgIGNoYW5nZWQ6IGNoYW5nZWRcbiAgICB9O1xuICB9XG5cbiAgZnVuY3Rpb24gbmV3U3BsaWNlKGluZGV4LCByZW1vdmVkLCBhZGRlZENvdW50KSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGluZGV4OiBpbmRleCxcbiAgICAgIHJlbW92ZWQ6IHJlbW92ZWQsXG4gICAgICBhZGRlZENvdW50OiBhZGRlZENvdW50XG4gICAgfTtcbiAgfVxuXG4gIHZhciBFRElUX0xFQVZFID0gMDtcbiAgdmFyIEVESVRfVVBEQVRFID0gMTtcbiAgdmFyIEVESVRfQUREID0gMjtcbiAgdmFyIEVESVRfREVMRVRFID0gMztcblxuICBmdW5jdGlvbiBBcnJheVNwbGljZSgpIHt9XG5cbiAgQXJyYXlTcGxpY2UucHJvdG90eXBlID0ge1xuXG4gICAgLy8gTm90ZTogVGhpcyBmdW5jdGlvbiBpcyAqYmFzZWQqIG9uIHRoZSBjb21wdXRhdGlvbiBvZiB0aGUgTGV2ZW5zaHRlaW5cbiAgICAvLyBcImVkaXRcIiBkaXN0YW5jZS4gVGhlIG9uZSBjaGFuZ2UgaXMgdGhhdCBcInVwZGF0ZXNcIiBhcmUgdHJlYXRlZCBhcyB0d29cbiAgICAvLyBlZGl0cyAtIG5vdCBvbmUuIFdpdGggQXJyYXkgc3BsaWNlcywgYW4gdXBkYXRlIGlzIHJlYWxseSBhIGRlbGV0ZVxuICAgIC8vIGZvbGxvd2VkIGJ5IGFuIGFkZC4gQnkgcmV0YWluaW5nIHRoaXMsIHdlIG9wdGltaXplIGZvciBcImtlZXBpbmdcIiB0aGVcbiAgICAvLyBtYXhpbXVtIGFycmF5IGl0ZW1zIGluIHRoZSBvcmlnaW5hbCBhcnJheS4gRm9yIGV4YW1wbGU6XG4gICAgLy9cbiAgICAvLyAgICd4eHh4MTIzJyAtPiAnMTIzeXl5eSdcbiAgICAvL1xuICAgIC8vIFdpdGggMS1lZGl0IHVwZGF0ZXMsIHRoZSBzaG9ydGVzdCBwYXRoIHdvdWxkIGJlIGp1c3QgdG8gdXBkYXRlIGFsbCBzZXZlblxuICAgIC8vIGNoYXJhY3RlcnMuIFdpdGggMi1lZGl0IHVwZGF0ZXMsIHdlIGRlbGV0ZSA0LCBsZWF2ZSAzLCBhbmQgYWRkIDQuIFRoaXNcbiAgICAvLyBsZWF2ZXMgdGhlIHN1YnN0cmluZyAnMTIzJyBpbnRhY3QuXG4gICAgY2FsY0VkaXREaXN0YW5jZXM6IGZ1bmN0aW9uKGN1cnJlbnQsIGN1cnJlbnRTdGFydCwgY3VycmVudEVuZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb2xkLCBvbGRTdGFydCwgb2xkRW5kKSB7XG4gICAgICAvLyBcIkRlbGV0aW9uXCIgY29sdW1uc1xuICAgICAgdmFyIHJvd0NvdW50ID0gb2xkRW5kIC0gb2xkU3RhcnQgKyAxO1xuICAgICAgdmFyIGNvbHVtbkNvdW50ID0gY3VycmVudEVuZCAtIGN1cnJlbnRTdGFydCArIDE7XG4gICAgICB2YXIgZGlzdGFuY2VzID0gbmV3IEFycmF5KHJvd0NvdW50KTtcblxuICAgICAgLy8gXCJBZGRpdGlvblwiIHJvd3MuIEluaXRpYWxpemUgbnVsbCBjb2x1bW4uXG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHJvd0NvdW50OyBpKyspIHtcbiAgICAgICAgZGlzdGFuY2VzW2ldID0gbmV3IEFycmF5KGNvbHVtbkNvdW50KTtcbiAgICAgICAgZGlzdGFuY2VzW2ldWzBdID0gaTtcbiAgICAgIH1cblxuICAgICAgLy8gSW5pdGlhbGl6ZSBudWxsIHJvd1xuICAgICAgZm9yICh2YXIgaiA9IDA7IGogPCBjb2x1bW5Db3VudDsgaisrKVxuICAgICAgICBkaXN0YW5jZXNbMF1bal0gPSBqO1xuXG4gICAgICBmb3IgKHZhciBpID0gMTsgaSA8IHJvd0NvdW50OyBpKyspIHtcbiAgICAgICAgZm9yICh2YXIgaiA9IDE7IGogPCBjb2x1bW5Db3VudDsgaisrKSB7XG4gICAgICAgICAgaWYgKHRoaXMuZXF1YWxzKGN1cnJlbnRbY3VycmVudFN0YXJ0ICsgaiAtIDFdLCBvbGRbb2xkU3RhcnQgKyBpIC0gMV0pKVxuICAgICAgICAgICAgZGlzdGFuY2VzW2ldW2pdID0gZGlzdGFuY2VzW2kgLSAxXVtqIC0gMV07XG4gICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICB2YXIgbm9ydGggPSBkaXN0YW5jZXNbaSAtIDFdW2pdICsgMTtcbiAgICAgICAgICAgIHZhciB3ZXN0ID0gZGlzdGFuY2VzW2ldW2ogLSAxXSArIDE7XG4gICAgICAgICAgICBkaXN0YW5jZXNbaV1bal0gPSBub3J0aCA8IHdlc3QgPyBub3J0aCA6IHdlc3Q7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBkaXN0YW5jZXM7XG4gICAgfSxcblxuICAgIC8vIFRoaXMgc3RhcnRzIGF0IHRoZSBmaW5hbCB3ZWlnaHQsIGFuZCB3YWxrcyBcImJhY2t3YXJkXCIgYnkgZmluZGluZ1xuICAgIC8vIHRoZSBtaW5pbXVtIHByZXZpb3VzIHdlaWdodCByZWN1cnNpdmVseSB1bnRpbCB0aGUgb3JpZ2luIG9mIHRoZSB3ZWlnaHRcbiAgICAvLyBtYXRyaXguXG4gICAgc3BsaWNlT3BlcmF0aW9uc0Zyb21FZGl0RGlzdGFuY2VzOiBmdW5jdGlvbihkaXN0YW5jZXMpIHtcbiAgICAgIHZhciBpID0gZGlzdGFuY2VzLmxlbmd0aCAtIDE7XG4gICAgICB2YXIgaiA9IGRpc3RhbmNlc1swXS5sZW5ndGggLSAxO1xuICAgICAgdmFyIGN1cnJlbnQgPSBkaXN0YW5jZXNbaV1bal07XG4gICAgICB2YXIgZWRpdHMgPSBbXTtcbiAgICAgIHdoaWxlIChpID4gMCB8fCBqID4gMCkge1xuICAgICAgICBpZiAoaSA9PSAwKSB7XG4gICAgICAgICAgZWRpdHMucHVzaChFRElUX0FERCk7XG4gICAgICAgICAgai0tO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIGlmIChqID09IDApIHtcbiAgICAgICAgICBlZGl0cy5wdXNoKEVESVRfREVMRVRFKTtcbiAgICAgICAgICBpLS07XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIG5vcnRoV2VzdCA9IGRpc3RhbmNlc1tpIC0gMV1baiAtIDFdO1xuICAgICAgICB2YXIgd2VzdCA9IGRpc3RhbmNlc1tpIC0gMV1bal07XG4gICAgICAgIHZhciBub3J0aCA9IGRpc3RhbmNlc1tpXVtqIC0gMV07XG5cbiAgICAgICAgdmFyIG1pbjtcbiAgICAgICAgaWYgKHdlc3QgPCBub3J0aClcbiAgICAgICAgICBtaW4gPSB3ZXN0IDwgbm9ydGhXZXN0ID8gd2VzdCA6IG5vcnRoV2VzdDtcbiAgICAgICAgZWxzZVxuICAgICAgICAgIG1pbiA9IG5vcnRoIDwgbm9ydGhXZXN0ID8gbm9ydGggOiBub3J0aFdlc3Q7XG5cbiAgICAgICAgaWYgKG1pbiA9PSBub3J0aFdlc3QpIHtcbiAgICAgICAgICBpZiAobm9ydGhXZXN0ID09IGN1cnJlbnQpIHtcbiAgICAgICAgICAgIGVkaXRzLnB1c2goRURJVF9MRUFWRSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGVkaXRzLnB1c2goRURJVF9VUERBVEUpO1xuICAgICAgICAgICAgY3VycmVudCA9IG5vcnRoV2VzdDtcbiAgICAgICAgICB9XG4gICAgICAgICAgaS0tO1xuICAgICAgICAgIGotLTtcbiAgICAgICAgfSBlbHNlIGlmIChtaW4gPT0gd2VzdCkge1xuICAgICAgICAgIGVkaXRzLnB1c2goRURJVF9ERUxFVEUpO1xuICAgICAgICAgIGktLTtcbiAgICAgICAgICBjdXJyZW50ID0gd2VzdDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBlZGl0cy5wdXNoKEVESVRfQUREKTtcbiAgICAgICAgICBqLS07XG4gICAgICAgICAgY3VycmVudCA9IG5vcnRoO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGVkaXRzLnJldmVyc2UoKTtcbiAgICAgIHJldHVybiBlZGl0cztcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogU3BsaWNlIFByb2plY3Rpb24gZnVuY3Rpb25zOlxuICAgICAqXG4gICAgICogQSBzcGxpY2UgbWFwIGlzIGEgcmVwcmVzZW50YXRpb24gb2YgaG93IGEgcHJldmlvdXMgYXJyYXkgb2YgaXRlbXNcbiAgICAgKiB3YXMgdHJhbnNmb3JtZWQgaW50byBhIG5ldyBhcnJheSBvZiBpdGVtcy4gQ29uY2VwdHVhbGx5IGl0IGlzIGEgbGlzdCBvZlxuICAgICAqIHR1cGxlcyBvZlxuICAgICAqXG4gICAgICogICA8aW5kZXgsIHJlbW92ZWQsIGFkZGVkQ291bnQ+XG4gICAgICpcbiAgICAgKiB3aGljaCBhcmUga2VwdCBpbiBhc2NlbmRpbmcgaW5kZXggb3JkZXIgb2YuIFRoZSB0dXBsZSByZXByZXNlbnRzIHRoYXQgYXRcbiAgICAgKiB0aGUgfGluZGV4fCwgfHJlbW92ZWR8IHNlcXVlbmNlIG9mIGl0ZW1zIHdlcmUgcmVtb3ZlZCwgYW5kIGNvdW50aW5nIGZvcndhcmRcbiAgICAgKiBmcm9tIHxpbmRleHwsIHxhZGRlZENvdW50fCBpdGVtcyB3ZXJlIGFkZGVkLlxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogTGFja2luZyBpbmRpdmlkdWFsIHNwbGljZSBtdXRhdGlvbiBpbmZvcm1hdGlvbiwgdGhlIG1pbmltYWwgc2V0IG9mXG4gICAgICogc3BsaWNlcyBjYW4gYmUgc3ludGhlc2l6ZWQgZ2l2ZW4gdGhlIHByZXZpb3VzIHN0YXRlIGFuZCBmaW5hbCBzdGF0ZSBvZiBhblxuICAgICAqIGFycmF5LiBUaGUgYmFzaWMgYXBwcm9hY2ggaXMgdG8gY2FsY3VsYXRlIHRoZSBlZGl0IGRpc3RhbmNlIG1hdHJpeCBhbmRcbiAgICAgKiBjaG9vc2UgdGhlIHNob3J0ZXN0IHBhdGggdGhyb3VnaCBpdC5cbiAgICAgKlxuICAgICAqIENvbXBsZXhpdHk6IE8obCAqIHApXG4gICAgICogICBsOiBUaGUgbGVuZ3RoIG9mIHRoZSBjdXJyZW50IGFycmF5XG4gICAgICogICBwOiBUaGUgbGVuZ3RoIG9mIHRoZSBvbGQgYXJyYXlcbiAgICAgKi9cbiAgICBjYWxjU3BsaWNlczogZnVuY3Rpb24oY3VycmVudCwgY3VycmVudFN0YXJ0LCBjdXJyZW50RW5kLFxuICAgICAgICAgICAgICAgICAgICAgICAgICBvbGQsIG9sZFN0YXJ0LCBvbGRFbmQpIHtcbiAgICAgIHZhciBwcmVmaXhDb3VudCA9IDA7XG4gICAgICB2YXIgc3VmZml4Q291bnQgPSAwO1xuXG4gICAgICB2YXIgbWluTGVuZ3RoID0gTWF0aC5taW4oY3VycmVudEVuZCAtIGN1cnJlbnRTdGFydCwgb2xkRW5kIC0gb2xkU3RhcnQpO1xuICAgICAgaWYgKGN1cnJlbnRTdGFydCA9PSAwICYmIG9sZFN0YXJ0ID09IDApXG4gICAgICAgIHByZWZpeENvdW50ID0gdGhpcy5zaGFyZWRQcmVmaXgoY3VycmVudCwgb2xkLCBtaW5MZW5ndGgpO1xuXG4gICAgICBpZiAoY3VycmVudEVuZCA9PSBjdXJyZW50Lmxlbmd0aCAmJiBvbGRFbmQgPT0gb2xkLmxlbmd0aClcbiAgICAgICAgc3VmZml4Q291bnQgPSB0aGlzLnNoYXJlZFN1ZmZpeChjdXJyZW50LCBvbGQsIG1pbkxlbmd0aCAtIHByZWZpeENvdW50KTtcblxuICAgICAgY3VycmVudFN0YXJ0ICs9IHByZWZpeENvdW50O1xuICAgICAgb2xkU3RhcnQgKz0gcHJlZml4Q291bnQ7XG4gICAgICBjdXJyZW50RW5kIC09IHN1ZmZpeENvdW50O1xuICAgICAgb2xkRW5kIC09IHN1ZmZpeENvdW50O1xuXG4gICAgICBpZiAoY3VycmVudEVuZCAtIGN1cnJlbnRTdGFydCA9PSAwICYmIG9sZEVuZCAtIG9sZFN0YXJ0ID09IDApXG4gICAgICAgIHJldHVybiBbXTtcblxuICAgICAgaWYgKGN1cnJlbnRTdGFydCA9PSBjdXJyZW50RW5kKSB7XG4gICAgICAgIHZhciBzcGxpY2UgPSBuZXdTcGxpY2UoY3VycmVudFN0YXJ0LCBbXSwgMCk7XG4gICAgICAgIHdoaWxlIChvbGRTdGFydCA8IG9sZEVuZClcbiAgICAgICAgICBzcGxpY2UucmVtb3ZlZC5wdXNoKG9sZFtvbGRTdGFydCsrXSk7XG5cbiAgICAgICAgcmV0dXJuIFsgc3BsaWNlIF07XG4gICAgICB9IGVsc2UgaWYgKG9sZFN0YXJ0ID09IG9sZEVuZClcbiAgICAgICAgcmV0dXJuIFsgbmV3U3BsaWNlKGN1cnJlbnRTdGFydCwgW10sIGN1cnJlbnRFbmQgLSBjdXJyZW50U3RhcnQpIF07XG5cbiAgICAgIHZhciBvcHMgPSB0aGlzLnNwbGljZU9wZXJhdGlvbnNGcm9tRWRpdERpc3RhbmNlcyhcbiAgICAgICAgICB0aGlzLmNhbGNFZGl0RGlzdGFuY2VzKGN1cnJlbnQsIGN1cnJlbnRTdGFydCwgY3VycmVudEVuZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9sZCwgb2xkU3RhcnQsIG9sZEVuZCkpO1xuXG4gICAgICB2YXIgc3BsaWNlID0gdW5kZWZpbmVkO1xuICAgICAgdmFyIHNwbGljZXMgPSBbXTtcbiAgICAgIHZhciBpbmRleCA9IGN1cnJlbnRTdGFydDtcbiAgICAgIHZhciBvbGRJbmRleCA9IG9sZFN0YXJ0O1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBvcHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgc3dpdGNoKG9wc1tpXSkge1xuICAgICAgICAgIGNhc2UgRURJVF9MRUFWRTpcbiAgICAgICAgICAgIGlmIChzcGxpY2UpIHtcbiAgICAgICAgICAgICAgc3BsaWNlcy5wdXNoKHNwbGljZSk7XG4gICAgICAgICAgICAgIHNwbGljZSA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaW5kZXgrKztcbiAgICAgICAgICAgIG9sZEluZGV4Kys7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlIEVESVRfVVBEQVRFOlxuICAgICAgICAgICAgaWYgKCFzcGxpY2UpXG4gICAgICAgICAgICAgIHNwbGljZSA9IG5ld1NwbGljZShpbmRleCwgW10sIDApO1xuXG4gICAgICAgICAgICBzcGxpY2UuYWRkZWRDb3VudCsrO1xuICAgICAgICAgICAgaW5kZXgrKztcblxuICAgICAgICAgICAgc3BsaWNlLnJlbW92ZWQucHVzaChvbGRbb2xkSW5kZXhdKTtcbiAgICAgICAgICAgIG9sZEluZGV4Kys7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlIEVESVRfQUREOlxuICAgICAgICAgICAgaWYgKCFzcGxpY2UpXG4gICAgICAgICAgICAgIHNwbGljZSA9IG5ld1NwbGljZShpbmRleCwgW10sIDApO1xuXG4gICAgICAgICAgICBzcGxpY2UuYWRkZWRDb3VudCsrO1xuICAgICAgICAgICAgaW5kZXgrKztcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgRURJVF9ERUxFVEU6XG4gICAgICAgICAgICBpZiAoIXNwbGljZSlcbiAgICAgICAgICAgICAgc3BsaWNlID0gbmV3U3BsaWNlKGluZGV4LCBbXSwgMCk7XG5cbiAgICAgICAgICAgIHNwbGljZS5yZW1vdmVkLnB1c2gob2xkW29sZEluZGV4XSk7XG4gICAgICAgICAgICBvbGRJbmRleCsrO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKHNwbGljZSkge1xuICAgICAgICBzcGxpY2VzLnB1c2goc3BsaWNlKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBzcGxpY2VzO1xuICAgIH0sXG5cbiAgICBzaGFyZWRQcmVmaXg6IGZ1bmN0aW9uKGN1cnJlbnQsIG9sZCwgc2VhcmNoTGVuZ3RoKSB7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHNlYXJjaExlbmd0aDsgaSsrKVxuICAgICAgICBpZiAoIXRoaXMuZXF1YWxzKGN1cnJlbnRbaV0sIG9sZFtpXSkpXG4gICAgICAgICAgcmV0dXJuIGk7XG4gICAgICByZXR1cm4gc2VhcmNoTGVuZ3RoO1xuICAgIH0sXG5cbiAgICBzaGFyZWRTdWZmaXg6IGZ1bmN0aW9uKGN1cnJlbnQsIG9sZCwgc2VhcmNoTGVuZ3RoKSB7XG4gICAgICB2YXIgaW5kZXgxID0gY3VycmVudC5sZW5ndGg7XG4gICAgICB2YXIgaW5kZXgyID0gb2xkLmxlbmd0aDtcbiAgICAgIHZhciBjb3VudCA9IDA7XG4gICAgICB3aGlsZSAoY291bnQgPCBzZWFyY2hMZW5ndGggJiYgdGhpcy5lcXVhbHMoY3VycmVudFstLWluZGV4MV0sIG9sZFstLWluZGV4Ml0pKVxuICAgICAgICBjb3VudCsrO1xuXG4gICAgICByZXR1cm4gY291bnQ7XG4gICAgfSxcblxuICAgIGNhbGN1bGF0ZVNwbGljZXM6IGZ1bmN0aW9uKGN1cnJlbnQsIHByZXZpb3VzKSB7XG4gICAgICByZXR1cm4gdGhpcy5jYWxjU3BsaWNlcyhjdXJyZW50LCAwLCBjdXJyZW50Lmxlbmd0aCwgcHJldmlvdXMsIDAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcmV2aW91cy5sZW5ndGgpO1xuICAgIH0sXG5cbiAgICBlcXVhbHM6IGZ1bmN0aW9uKGN1cnJlbnRWYWx1ZSwgcHJldmlvdXNWYWx1ZSkge1xuICAgICAgcmV0dXJuIGN1cnJlbnRWYWx1ZSA9PT0gcHJldmlvdXNWYWx1ZTtcbiAgICB9XG4gIH07XG5cbiAgdmFyIGFycmF5U3BsaWNlID0gbmV3IEFycmF5U3BsaWNlKCk7XG5cbiAgZnVuY3Rpb24gY2FsY1NwbGljZXMoY3VycmVudCwgY3VycmVudFN0YXJ0LCBjdXJyZW50RW5kLFxuICAgICAgICAgICAgICAgICAgICAgICBvbGQsIG9sZFN0YXJ0LCBvbGRFbmQpIHtcbiAgICByZXR1cm4gYXJyYXlTcGxpY2UuY2FsY1NwbGljZXMoY3VycmVudCwgY3VycmVudFN0YXJ0LCBjdXJyZW50RW5kLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbGQsIG9sZFN0YXJ0LCBvbGRFbmQpO1xuICB9XG5cbiAgZnVuY3Rpb24gaW50ZXJzZWN0KHN0YXJ0MSwgZW5kMSwgc3RhcnQyLCBlbmQyKSB7XG4gICAgLy8gRGlzam9pbnRcbiAgICBpZiAoZW5kMSA8IHN0YXJ0MiB8fCBlbmQyIDwgc3RhcnQxKVxuICAgICAgcmV0dXJuIC0xO1xuXG4gICAgLy8gQWRqYWNlbnRcbiAgICBpZiAoZW5kMSA9PSBzdGFydDIgfHwgZW5kMiA9PSBzdGFydDEpXG4gICAgICByZXR1cm4gMDtcblxuICAgIC8vIE5vbi16ZXJvIGludGVyc2VjdCwgc3BhbjEgZmlyc3RcbiAgICBpZiAoc3RhcnQxIDwgc3RhcnQyKSB7XG4gICAgICBpZiAoZW5kMSA8IGVuZDIpXG4gICAgICAgIHJldHVybiBlbmQxIC0gc3RhcnQyOyAvLyBPdmVybGFwXG4gICAgICBlbHNlXG4gICAgICAgIHJldHVybiBlbmQyIC0gc3RhcnQyOyAvLyBDb250YWluZWRcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gTm9uLXplcm8gaW50ZXJzZWN0LCBzcGFuMiBmaXJzdFxuICAgICAgaWYgKGVuZDIgPCBlbmQxKVxuICAgICAgICByZXR1cm4gZW5kMiAtIHN0YXJ0MTsgLy8gT3ZlcmxhcFxuICAgICAgZWxzZVxuICAgICAgICByZXR1cm4gZW5kMSAtIHN0YXJ0MTsgLy8gQ29udGFpbmVkXG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gbWVyZ2VTcGxpY2Uoc3BsaWNlcywgaW5kZXgsIHJlbW92ZWQsIGFkZGVkQ291bnQpIHtcblxuICAgIHZhciBzcGxpY2UgPSBuZXdTcGxpY2UoaW5kZXgsIHJlbW92ZWQsIGFkZGVkQ291bnQpO1xuXG4gICAgdmFyIGluc2VydGVkID0gZmFsc2U7XG4gICAgdmFyIGluc2VydGlvbk9mZnNldCA9IDA7XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHNwbGljZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBjdXJyZW50ID0gc3BsaWNlc1tpXTtcbiAgICAgIGN1cnJlbnQuaW5kZXggKz0gaW5zZXJ0aW9uT2Zmc2V0O1xuXG4gICAgICBpZiAoaW5zZXJ0ZWQpXG4gICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICB2YXIgaW50ZXJzZWN0Q291bnQgPSBpbnRlcnNlY3Qoc3BsaWNlLmluZGV4LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNwbGljZS5pbmRleCArIHNwbGljZS5yZW1vdmVkLmxlbmd0aCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjdXJyZW50LmluZGV4LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGN1cnJlbnQuaW5kZXggKyBjdXJyZW50LmFkZGVkQ291bnQpO1xuXG4gICAgICBpZiAoaW50ZXJzZWN0Q291bnQgPj0gMCkge1xuICAgICAgICAvLyBNZXJnZSB0aGUgdHdvIHNwbGljZXNcblxuICAgICAgICBzcGxpY2VzLnNwbGljZShpLCAxKTtcbiAgICAgICAgaS0tO1xuXG4gICAgICAgIGluc2VydGlvbk9mZnNldCAtPSBjdXJyZW50LmFkZGVkQ291bnQgLSBjdXJyZW50LnJlbW92ZWQubGVuZ3RoO1xuXG4gICAgICAgIHNwbGljZS5hZGRlZENvdW50ICs9IGN1cnJlbnQuYWRkZWRDb3VudCAtIGludGVyc2VjdENvdW50O1xuICAgICAgICB2YXIgZGVsZXRlQ291bnQgPSBzcGxpY2UucmVtb3ZlZC5sZW5ndGggK1xuICAgICAgICAgICAgICAgICAgICAgICAgICBjdXJyZW50LnJlbW92ZWQubGVuZ3RoIC0gaW50ZXJzZWN0Q291bnQ7XG5cbiAgICAgICAgaWYgKCFzcGxpY2UuYWRkZWRDb3VudCAmJiAhZGVsZXRlQ291bnQpIHtcbiAgICAgICAgICAvLyBtZXJnZWQgc3BsaWNlIGlzIGEgbm9vcC4gZGlzY2FyZC5cbiAgICAgICAgICBpbnNlcnRlZCA9IHRydWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdmFyIHJlbW92ZWQgPSBjdXJyZW50LnJlbW92ZWQ7XG5cbiAgICAgICAgICBpZiAoc3BsaWNlLmluZGV4IDwgY3VycmVudC5pbmRleCkge1xuICAgICAgICAgICAgLy8gc29tZSBwcmVmaXggb2Ygc3BsaWNlLnJlbW92ZWQgaXMgcHJlcGVuZGVkIHRvIGN1cnJlbnQucmVtb3ZlZC5cbiAgICAgICAgICAgIHZhciBwcmVwZW5kID0gc3BsaWNlLnJlbW92ZWQuc2xpY2UoMCwgY3VycmVudC5pbmRleCAtIHNwbGljZS5pbmRleCk7XG4gICAgICAgICAgICBBcnJheS5wcm90b3R5cGUucHVzaC5hcHBseShwcmVwZW5kLCByZW1vdmVkKTtcbiAgICAgICAgICAgIHJlbW92ZWQgPSBwcmVwZW5kO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChzcGxpY2UuaW5kZXggKyBzcGxpY2UucmVtb3ZlZC5sZW5ndGggPiBjdXJyZW50LmluZGV4ICsgY3VycmVudC5hZGRlZENvdW50KSB7XG4gICAgICAgICAgICAvLyBzb21lIHN1ZmZpeCBvZiBzcGxpY2UucmVtb3ZlZCBpcyBhcHBlbmRlZCB0byBjdXJyZW50LnJlbW92ZWQuXG4gICAgICAgICAgICB2YXIgYXBwZW5kID0gc3BsaWNlLnJlbW92ZWQuc2xpY2UoY3VycmVudC5pbmRleCArIGN1cnJlbnQuYWRkZWRDb3VudCAtIHNwbGljZS5pbmRleCk7XG4gICAgICAgICAgICBBcnJheS5wcm90b3R5cGUucHVzaC5hcHBseShyZW1vdmVkLCBhcHBlbmQpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHNwbGljZS5yZW1vdmVkID0gcmVtb3ZlZDtcbiAgICAgICAgICBpZiAoY3VycmVudC5pbmRleCA8IHNwbGljZS5pbmRleCkge1xuICAgICAgICAgICAgc3BsaWNlLmluZGV4ID0gY3VycmVudC5pbmRleDtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAoc3BsaWNlLmluZGV4IDwgY3VycmVudC5pbmRleCkge1xuICAgICAgICAvLyBJbnNlcnQgc3BsaWNlIGhlcmUuXG5cbiAgICAgICAgaW5zZXJ0ZWQgPSB0cnVlO1xuXG4gICAgICAgIHNwbGljZXMuc3BsaWNlKGksIDAsIHNwbGljZSk7XG4gICAgICAgIGkrKztcblxuICAgICAgICB2YXIgb2Zmc2V0ID0gc3BsaWNlLmFkZGVkQ291bnQgLSBzcGxpY2UucmVtb3ZlZC5sZW5ndGhcbiAgICAgICAgY3VycmVudC5pbmRleCArPSBvZmZzZXQ7XG4gICAgICAgIGluc2VydGlvbk9mZnNldCArPSBvZmZzZXQ7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKCFpbnNlcnRlZClcbiAgICAgIHNwbGljZXMucHVzaChzcGxpY2UpO1xuICB9XG5cbiAgZnVuY3Rpb24gY3JlYXRlSW5pdGlhbFNwbGljZXMoYXJyYXksIGNoYW5nZVJlY29yZHMpIHtcbiAgICB2YXIgc3BsaWNlcyA9IFtdO1xuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjaGFuZ2VSZWNvcmRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgcmVjb3JkID0gY2hhbmdlUmVjb3Jkc1tpXTtcbiAgICAgIHN3aXRjaChyZWNvcmQudHlwZSkge1xuICAgICAgICBjYXNlICdzcGxpY2UnOlxuICAgICAgICAgIG1lcmdlU3BsaWNlKHNwbGljZXMsIHJlY29yZC5pbmRleCwgcmVjb3JkLnJlbW92ZWQuc2xpY2UoKSwgcmVjb3JkLmFkZGVkQ291bnQpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdhZGQnOlxuICAgICAgICBjYXNlICd1cGRhdGUnOlxuICAgICAgICBjYXNlICdkZWxldGUnOlxuICAgICAgICAgIGlmICghaXNJbmRleChyZWNvcmQubmFtZSkpXG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICB2YXIgaW5kZXggPSB0b051bWJlcihyZWNvcmQubmFtZSk7XG4gICAgICAgICAgaWYgKGluZGV4IDwgMClcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgIG1lcmdlU3BsaWNlKHNwbGljZXMsIGluZGV4LCBbcmVjb3JkLm9sZFZhbHVlXSwgMSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgY29uc29sZS5lcnJvcignVW5leHBlY3RlZCByZWNvcmQgdHlwZTogJyArIEpTT04uc3RyaW5naWZ5KHJlY29yZCkpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBzcGxpY2VzO1xuICB9XG5cbiAgZnVuY3Rpb24gcHJvamVjdEFycmF5U3BsaWNlcyhhcnJheSwgY2hhbmdlUmVjb3Jkcykge1xuICAgIHZhciBzcGxpY2VzID0gW107XG5cbiAgICBjcmVhdGVJbml0aWFsU3BsaWNlcyhhcnJheSwgY2hhbmdlUmVjb3JkcykuZm9yRWFjaChmdW5jdGlvbihzcGxpY2UpIHtcbiAgICAgIGlmIChzcGxpY2UuYWRkZWRDb3VudCA9PSAxICYmIHNwbGljZS5yZW1vdmVkLmxlbmd0aCA9PSAxKSB7XG4gICAgICAgIGlmIChzcGxpY2UucmVtb3ZlZFswXSAhPT0gYXJyYXlbc3BsaWNlLmluZGV4XSlcbiAgICAgICAgICBzcGxpY2VzLnB1c2goc3BsaWNlKTtcblxuICAgICAgICByZXR1cm5cbiAgICAgIH07XG5cbiAgICAgIHNwbGljZXMgPSBzcGxpY2VzLmNvbmNhdChjYWxjU3BsaWNlcyhhcnJheSwgc3BsaWNlLmluZGV4LCBzcGxpY2UuaW5kZXggKyBzcGxpY2UuYWRkZWRDb3VudCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzcGxpY2UucmVtb3ZlZCwgMCwgc3BsaWNlLnJlbW92ZWQubGVuZ3RoKSk7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gc3BsaWNlcztcbiAgfVxuXG4gLy8gRXhwb3J0IHRoZSBvYnNlcnZlLWpzIG9iamVjdCBmb3IgKipOb2RlLmpzKiosIHdpdGhcbi8vIGJhY2t3YXJkcy1jb21wYXRpYmlsaXR5IGZvciB0aGUgb2xkIGByZXF1aXJlKClgIEFQSS4gSWYgd2UncmUgaW5cbi8vIHRoZSBicm93c2VyLCBleHBvcnQgYXMgYSBnbG9iYWwgb2JqZWN0LlxudmFyIGV4cG9zZSA9IGdsb2JhbDtcbmlmICh0eXBlb2YgZXhwb3J0cyAhPT0gJ3VuZGVmaW5lZCcpIHtcbmlmICh0eXBlb2YgbW9kdWxlICE9PSAndW5kZWZpbmVkJyAmJiBtb2R1bGUuZXhwb3J0cykge1xuZXhwb3NlID0gZXhwb3J0cyA9IG1vZHVsZS5leHBvcnRzO1xufVxuZXhwb3NlID0gZXhwb3J0cztcbn1cbmV4cG9zZS5PYnNlcnZlciA9IE9ic2VydmVyO1xuZXhwb3NlLk9ic2VydmVyLnJ1bkVPTV8gPSBydW5FT007XG5leHBvc2UuT2JzZXJ2ZXIub2JzZXJ2ZXJTZW50aW5lbF8gPSBvYnNlcnZlclNlbnRpbmVsOyAvLyBmb3IgdGVzdGluZy5cbmV4cG9zZS5PYnNlcnZlci5oYXNPYmplY3RPYnNlcnZlID0gaGFzT2JzZXJ2ZTtcbmV4cG9zZS5BcnJheU9ic2VydmVyID0gQXJyYXlPYnNlcnZlcjtcbmV4cG9zZS5BcnJheU9ic2VydmVyLmNhbGN1bGF0ZVNwbGljZXMgPSBmdW5jdGlvbihjdXJyZW50LCBwcmV2aW91cykge1xucmV0dXJuIGFycmF5U3BsaWNlLmNhbGN1bGF0ZVNwbGljZXMoY3VycmVudCwgcHJldmlvdXMpO1xufTtcbmV4cG9zZS5QbGF0Zm9ybSA9IGdsb2JhbC5QbGF0Zm9ybTtcbmV4cG9zZS5BcnJheVNwbGljZSA9IEFycmF5U3BsaWNlO1xuZXhwb3NlLk9iamVjdE9ic2VydmVyID0gT2JqZWN0T2JzZXJ2ZXI7XG59KSh0eXBlb2YgZ2xvYmFsICE9PSAndW5kZWZpbmVkJyAmJiBnbG9iYWwgJiYgdHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcgJiYgbW9kdWxlID8gZ2xvYmFsIDogdGhpcyB8fCB3aW5kb3cpO1xuIl19
