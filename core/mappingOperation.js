/**
 * @module mapping
 */

var Store = require('./store')
    , SiestaModel = require('./modelInstance')
    , log = require('./operation/log')
    , Operation = require('./operation/operation').Operation
    , InternalSiestaError = require('./error').InternalSiestaError
    , Query = require('./query').Query
    , cache = require('./cache')
    , util = require('./util')
    , _ = util._
    , defineSubProperty = util.defineSubProperty
    , ChangeType = require('./changes').ChangeType;

var Logger = log.loggerWithName('MappingOperation');
Logger.setLevel(log.Level.warn);

function flattenArray(arr) {
    return _.reduce(arr, function (memo, e) {
        if (util.isArray(e)) {
            memo = memo.concat(e);
        } else {
            memo.push(e);
        }
        return memo;
    }, []);
}

function SiestaError(opts) {
    this.opts = opts;
}
SiestaError.prototype.toString = function () {
    return JSON.stringify(this.opts, null, 4);
};

function unflattenArray(arr, modelArr) {
    var n = 0;
    var unflattened = [];
    for (var i = 0; i < modelArr.length; i++) {
        if (util.isArray(modelArr[i])) {
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
}

/**
 * Defines an encapsulated mapping operation where opts takes a mappin
 * @param {Object} opts
 */
function BulkMappingOperation(opts) {
    Operation.call(this);

    this._opts = opts;

    /**
     * @name mapping
     * @type {Model}
     */
    defineSubProperty.call(this, 'model', this._opts);

    /**
     * @name data
     * @type {Array}
     */
    defineSubProperty.call(this, 'data', this._opts);

    /**
     * @name objects
     * @type {Array}
     */
    defineSubProperty.call(this, 'objects', this._opts);

    /**
     * @name disableNotifications
     * @type {bool}
     */
    defineSubProperty.call(this, 'disableNotifications', this._opts);


    if (!this.objects) this.objects = [];

    /**
     * Array of errors where indexes map onto same index as the datum that caused an error.
     * @type {Array}
     */
    this.errors = [];


    this.name = 'Model Operation';
    this.work = _.bind(this._start, this);
    this.subOps = {};
}

BulkMappingOperation.prototype = Object.create(Operation.prototype);

_.extend(BulkMappingOperation.prototype, {
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
                            // If notifications are disabled we update __values object directly. This avoids triggering
                            // notifications which are built into the set function of the property.
                            if (this.disableNotifications) {
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
        var numHits = this.mapAttributes(this);
        var relationshipFields = _.keys(self.subOps);
        _.each(relationshipFields, function (f) {
            var op = self.subOps[f].op;
            var indexes = self.subOps[f].indexes;
            var relatedData = self.getRelatedData(f).relatedData;
            var unflattenedObjects = unflattenArray(op.objects, relatedData);
            for (var i = 0; i < unflattenedObjects.length; i++) {
                var idx = indexes[i];
                // Errors are plucked from the suboperations.
                var error = self.errors[idx];
                err = error ? error[f] : null;
                if (!err) {
                    var related = unflattenedObjects[i]; // Can be array or scalar.
                    var object = self.objects[idx];
                    if (object) {
                        err = object.__proxies[f].set(related, {disableNotifications: self.disableNotifications});
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
        var deferred = window.q ? window.q.defer() : null;
        callback = util.cb(callback, deferred);
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
                            this.objects[i] = self.model._new();
                        }
                    }
                } else {
                    this.objects[i] = null;
                }
            }
        }
        util.async.parallel([
                function (callback) {
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
                                            obj = self.model._new({_id: _id}, !self.disableNotifications);
                                        self.objects[lookup.index] = obj;
                                    } else {
                                        self.objects[lookup.index] = obj;
                                    }
                                }
                            }
                            callback(err);
                        });
                    } else {
                        callback();
                    }
                },
                function (callback) {
                    var remoteIdentifiers = _.pluck(_.pluck(remoteLookups, 'datum'), self.model.id);
                    if (remoteIdentifiers.length) {
                        if (Logger.trace.isEnabled)
                            Logger.trace('Looking up remoteIdentifiers: ' + JSON.stringify(remoteIdentifiers, null, 4));
                        Store.getMultipleRemote(remoteIdentifiers, self.model, function (err, objects) {
                            if (!err) {
                                if (Logger.trace.isEnabled) {
                                    var results = {};
                                    for (i = 0; i < objects.length; i++) {
                                        results[remoteIdentifiers[i]] = objects[i] ? objects[i]._id : null;
                                    }
                                    Logger.trace('Results for remoteIdentifiers: ' + JSON.stringify(results, null, 4));
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
                                            self.objects[lookup.index] = self.model._new();
                                            // It's important that we map the remote identifier here to ensure that it ends
                                            // up in the cache.
                                            self.objects[lookup.index][self.model.id] = remoteId;
                                        }
                                    }
                                }
                            }
                            callback(err);
                        });
                    } else {
                        callback();
                    }
                }
            ],
            callback);
        return deferred ? deferred.promise : null;
    },
    _lookupSingleton: function (callback) {
        var deferred = window.q ? window.q.defer() : null;
        callback = util.cb(callback, deferred);
        var self = this;
        this.model.get(function (err, singleton) {
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
            if (!singleton) singleton = self.model._new(_id);
            if (!err) {
                for (var i = 0; i < self.data.length; i++) {
                    self.objects[i] = singleton;
                }
            }
            callback(err);
        });
        return deferred ? deferred.promise : null;
    },
    _start: function (done) {
        if (this.data.length) {
            var self = this;
            var tasks = [];
            var lookupFunc = this.model.singleton ? this._lookupSingleton : this._lookup;
            tasks.push(_.bind(lookupFunc, this));
            tasks.push(_.bind(this._executeSubOperations, this));
            util.async.parallel(tasks, function () {
                self._map();
                done(self.errors.length ? self.errors : null, self.objects);
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
    _constructSubOperations: function () {
        var subOps = this.subOps;
        var relationships = this.model.relationships;
        for (var name in relationships) {
            if (relationships.hasOwnProperty(name)) {
                var relationship = relationships[name];
                var reverseModel = relationship.forwardName == name ? relationship.reverseModel : relationship.forwardModel;
                var __ret = this.getRelatedData(name);
                var indexes = __ret.indexes;
                var relatedData = __ret.relatedData;
                if (relatedData.length) {
                    var flatRelatedData = flattenArray(relatedData);
                    var op = new BulkMappingOperation({
                        model: reverseModel,
                        data: flatRelatedData,
                        disableNotifications: this.disableNotifications
                    });
                    op.__relationshipName = name;
                    subOps[name] = {
                        op: op,
                        indexes: indexes
                    };
                }
            }
        }
        if (Logger.trace) {
            Logger.trace('Constructed subops for relationships', Object.keys(subOps));
        }
    },
    gatherErrorsFromSubOperations: function () {
        var self = this;
        var relationshipNames = _.keys(this.subOps);
        _.each(relationshipNames, function (name) {
            var op = self.subOps[name].op;
            var indexes = self.subOps[name].indexes;
            var errors = op.errors;
            if (errors.length) {
                var relatedData = self.getRelatedData(name).relatedData;
                var unflattenedErrors = unflattenArray(errors, relatedData);
                for (var i = 0; i < unflattenedErrors.length; i++) {
                    var idx = indexes[i];
                    var err = unflattenedErrors[i];
                    var isError = err;
                    if (util.isArray(err)) isError = _.reduce(err, function (memo, x) {
                        return memo || x
                    }, false);
                    if (isError) {
                        if (!self.errors[idx]) self.errors[idx] = {};
                        self.errors[idx][name] = err;
                    }
                }
            }
        });
    },
    _executeSubOperations: function (callback) {
        var self = this;
        this._constructSubOperations();
        var relationshipNames = _.keys(this.subOps);
        if (relationshipNames.length) {
            var subOperations = _.map(relationshipNames, function (k) {
                return self.subOps[k].op
            });
            var compositeOperation = new Operation(subOperations);
            compositeOperation.onCompletion(function () {
                self.gatherErrorsFromSubOperations(relationshipNames);
                callback();
            });
            compositeOperation.start();
        } else {
            callback();
        }
    }
});


exports.BulkMappingOperation = BulkMappingOperation;
exports.flattenArray = flattenArray;
exports.unflattenArray = unflattenArray;