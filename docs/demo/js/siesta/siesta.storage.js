(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/*
 * Changes describe differences between the in-memory object graph and the object graph sat in the databases.
 *
 * Faulted objects being pulled into memory will have changes applied to them.
 *
 * On siesta.save() all changes will be merged into the database.
 */

var _i = siesta._internal
    , InternalSiestaError = _i.error.InternalSiestaError
    , util = _i.util
    , _ = util._
    , Operation = _i.Operation
    , OperationQueue = _i.OperationQueue
    , object = _i.object
    , SiestaModel = object.SiestaModel
    , extend = _i.extend
    , log = _i.log
    , cache = _i.cache
    , coreChanges = _i.coreChanges
    , Change = coreChanges.Change
    , ChangeType = coreChanges.ChangeType
    , collection = _i.collection
    , q = _i.q
    ;

var pouch = require('./pouch');
var index = require('./index');

var Logger = log.loggerWithName('changes');
Logger.setLevel(log.Level.warn);

var unmergedChanges = {};

/**
 * Used to ensure merge operation only finishes once all changes are made to the database.
 * This is because of (what I think is) a bug in PouchDB whereby the bulkDocs callback is called before
 * all changes have actually been made in the database. By waiting for all the database change events to return
 * we can ensure that there is no merge overlaps and hence no race conditions.
 * @type {{}}
 */
var waitingForObservations = {};

/**
 * Populated by each merge operation that is currently executing. When all observations related to the merged changes
 * are received, this function is called, ending the merge operation.
 * @type {function}
 */
var finishWaitingForObservations;

// The moment that changes are propagated to Pouch we need to remove said change from unmergedChanges.
pouch.addObserver(function (e) {
    var id = e.id;
    for (var collectionName in unmergedChanges) {
        if (unmergedChanges.hasOwnProperty(collectionName)) {
            var collectionChanges = unmergedChanges[collectionName];
            for (var mappingName in collectionChanges) {
                if (collectionChanges.hasOwnProperty(mappingName)) {
                    var mappingChanges = collectionChanges[mappingName];
                    if (mappingChanges[id]) {
                        delete mappingChanges[id];
                        delete waitingForObservations[id];
                        if (!_.keys(waitingForObservations).length && finishWaitingForObservations) {
                            finishWaitingForObservations();
                            finishWaitingForObservations = null;
                        }
                        return;
                    }
                }
            }
        }
    }
});

var mergeQueue = new OperationQueue('Merge Queue');
mergeQueue.maxConcurrentOperations = 1;
mergeQueue.start();

function arraysEqual(a, b) {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (a.length != b.length) return false;
    for (var i = 0; i < a.length; ++i) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

function applySplice(obj, field, index, removed, added) {
    if (!(removed || added)) {
        throw new InternalSiestaError('Must remove or add something with a splice change.');
    }
    if (index === undefined || index === null) {
        throw new InternalSiestaError('Must pass index to splice change');
    }
    var arr = obj[field];
    var actuallyRemoved = _.partial(arr.splice, index, removed.length).apply(arr, added);
    // TODO: FIX THIS!!!! 
    // if (!arraysEqual(actuallyRemoved, removed)) {
    //     var err = 'Objects actually removed did not match those specified in the change';
    //     Logger.error(err, {actuallyRemoved: actuallyRemoved, expectedRemoved: removed})
    //     throw new InternalSiestaError(err);
    // }
}

function applyRemove(field, removed, obj) {
    if (!removed) {
        throw new InternalSiestaError('Must pass removed');
    }
    _.each(removed, function (r) {
        var arr = obj[field];
        var idx = arr.indexOf(r);
        arr.splice(idx, 1);
    });
}

function applySet(obj, field, newVal, old) {
    var actualOld = obj[field];
    if (actualOld != old) {
        // This is bad. Something has gone out of sync or we're applying unmergedChanges out of order.
        throw new InternalSiestaError('Old value does not match new value: ' + JSON.stringify({old: old ? old : null, actualOld: actualOld ? actualOld : null}, null, 4));
    }
    obj[field] = newVal;
}

function validateChange() {
    if (!this.field) throw new InternalSiestaError('Must pass field to change');
    if (!this.collection) throw new InternalSiestaError('Must pass collection to change');
    if (!this.mapping) throw new InternalSiestaError('Must pass mapping to change');
}
function validateObject(obj) {
    if (obj._id != this._id) {
        throw new InternalSiestaError('Cannot apply change with _id="' + this._id.toString() + '" to object with _id="' + obj._id.toString() + '"');
    }
}

var oldRegisterChange = coreChanges.registerChange;

coreChanges.registerChange = function (opts) {
    coreChanges.validateChange(opts);
    var collection = opts.collection;
    var mapping = opts.mapping;
    var _id = opts._id;
    if (!unmergedChanges[collection.name]) {
        unmergedChanges[collection.name] = {};
    }
    var collectionChanges = unmergedChanges[collection.name];
    if (!collectionChanges[mapping.type]) {
        collectionChanges[mapping.type] = {};
    }
    if (!collectionChanges[mapping.type][_id]) {
        collectionChanges[mapping.type][_id] = [];
    }
    var objChanges = collectionChanges[mapping.type][_id];
    var c = oldRegisterChange(opts);
    objChanges.push(c);
};


Change.prototype.apply = function (doc) {
    validateChange.call(this);
    validateObject.call(this, doc);
    if (this.type == ChangeType.Set) {
        applySet.call(this, doc, this.field, this.newId || this.new, this.oldId || this.old);
    }
    else if (this.type == ChangeType.Splice) {
        if (!doc[this.field]) doc[this.field] = [];
        applySplice.call(this, doc, this.field, this.index, this.removedId || this.removed, this.addedId || this.added);
    }
    else if (this.type == ChangeType.Delete) {
        applyRemove.call(this, this.field, this.removedId || this.removed, doc);
    }
    else {
        throw new InternalSiestaError('Unknown change type "' + this.type.toString() + '"');
    }
    if (!doc.collection) {
        doc.collection = this.collection;
    }
    if (!doc.mapping) {
        doc.mapping = this.mapping;
    }
    if (!doc.type) {
        doc.type = this.mapping;
    }
};

function applySetToSiestaModel(isField, model) {
    if (isField) {
        applySet.call(this, model.__values, this.field, this.new, this.old);
    }
    else {
        var identifier = this.newId || (this.new ? this.new._id : null);
        var oldIdentifier = this.oldId || (this.old ? this.old._id : null);
        var proxy = model[this.field + 'Proxy'];
//        var isFaulted = proxy.isFault;
        applySet.call(this, proxy, '_id', identifier, oldIdentifier);
        var _new = this.new || (this.newId ? cache.get({_id: this.newId}) : null);
        var old = this.old || (this.oldId ? cache.get({_id: this.oldId}) : null);
        if (_new || old) {
            applySet.call(this, proxy, 'related', _new, old);
        }
        else {
            // Fault
            proxy.related = null;
        }
    }
}

function applySpliceToSiestaModel(isField, model) {
    if (isField) {
        applySplice.call(this, model.__values, this.field, this.index, this.removed, this.added);
    }
    else {
        var removedIdentifiers = this.removedId || (this.removed ? _.pluck(this.removed, '_id') : []);
        var addedIdentifiers = this.addedId || (this.added ? _.pluck(this.added, '_id') : []);
        var proxy = model[this.field + 'Proxy'];
        var isFaulted = proxy.isFault;
        applySplice.call(this, proxy, '_id', this.index, removedIdentifiers, addedIdentifiers);
        if (!isFaulted) {
            var removed = this.removed || _.map(removedIdentifiers, function (x) {return cache.get({_id: x})});
            var allRemovedCached = _.reduce(removed, function (memo, x) {return x && memo}, true);
            var added = this.added || _.map(addedIdentifiers, function (x) {return cache.get({_id: x})});
            var allAddedCached = _.reduce(added, function (memo, x) {return x && memo}, true);
            if (allRemovedCached && allAddedCached) {
                applySplice.call(this, proxy, 'related', this.index, removed, added);
            }
            else if (!allRemovedCached) {
                // Something has gone very wrong if we end up here.
                throw new InternalSiestaError('If not faulted, all removed objects should be cache.');
            }
            else {
                // Fault
                proxy.related = null;
            }
        }
    }
}

function applyRemoveToSiestaModel(isField, model) {
    if (isField) {
        applyRemove.call(this, this.field, this.removed, model);
    }
    else {
        var removed = this.removedId || (this.removed ? _.pluck(this.removed, '_id') : []);
        var proxy = model[this.field + 'Proxy'];
        var isFaulted = proxy.isFault;
        applyRemove.call(this, '_id', removed, proxy);
        if (!isFaulted && this.removed) {
            applyRemove.call(this, 'related', this.removed, proxy);
        }
    }
}

/**
 *
 * @param model - An instance of SiestaModel
 */
Change.prototype.applySiestaModel = function (model) {
    validateChange.call(this);
    validateObject.call(this, model);
    var relationshipFields = _.keys(this.mapping.relationships);
    var fields = this.mapping._fields;
    var isField = fields.indexOf(this.field) > -1;
    var isRelationshipField = relationshipFields.indexOf(this.field) > -1;
    if (!(isField || isRelationshipField)) {
        throw new InternalSiestaError('Field "' + this.field + '" does not exist within mapping "' + this.mapping.type + '"');
    }
    if (this.type == ChangeType.Set) {
        applySetToSiestaModel.call(this, isField, model);
    }
    else if (this.type == ChangeType.Splice) {
        applySpliceToSiestaModel.call(this, isField, model);
    }
    else if (this.type == ChangeType.Delete) {
        applyRemoveToSiestaModel.call(this, isField, model);
    }
    else {
        throw new InternalSiestaError('Unknown change type "' + this.type.toString() + '"');
    }
};

function changesByIdentifiers() {
    var res = {};
    for (var collectionName in unmergedChanges) {
        if (unmergedChanges.hasOwnProperty(collectionName)) {
            var collectionChanges = unmergedChanges[collectionName];
            for (var mappingName in collectionChanges) {
                if (collectionChanges.hasOwnProperty(mappingName)) {
                    var mappingChanges = collectionChanges[mappingName];
                    extend(res, mappingChanges);
                }
            }
        }
    }
    return res;
}

function changesForIdentifier(ident) {
    return changesByIdentifiers()[ident] || [];
}


/**
 * Merge unmergedChanges into PouchDB
 */
function mergeChanges(callback) {
    var deferred = q.defer();
    callback = util.constructCallbackAndPromiseHandler(callback, deferred);
    var changesByIdents = changesByIdentifiers();
    var numChanges = _.keys(changesByIdents).length;
    if (numChanges) {
        if (Logger.debug.isEnabled)
            Logger.debug('Merging ' + numChanges.toString() + ' changes');
        var op = new Operation('Merge Changes', function (done) {
            if (Logger.debug.isEnabled)
                Logger.debug('Beggining merge operation');
            var identifiers = [];
            for (var prop in changesByIdents) {
                if (changesByIdents.hasOwnProperty(prop)) {
                    identifiers.push(prop);
                }
            }
            var db = pouch.getPouch();
            if (Logger.debug.isEnabled)
                Logger.debug('Getting docs');
            _.each(identifiers, function (i) {waitingForObservations[i] = {}});
            db.allDocs({keys: identifiers, include_docs: true}, function (err, resp) {
                if (err) {
                    done(err);
                }
                else {
                    if (Logger.debug.isEnabled)
                        Logger.debug('Got docs');
                    var bulkDocs = [];
                    var errors = [];
                    if (Logger.debug.isEnabled)
                        Logger.debug('Updating docs docs');
                    _.each(resp.rows, function (row) {
                        var doc;
                        if (row.error) {
                            if (row.error == 'not_found') {
                                doc = {
                                    _id: row.key
                                }
                            }
                            else {
                                errors.push(row.error);
                            }
                        }
                        else {
                            doc = row.doc;
                        }
                        var change = changesByIdents[doc._id];
                        _.each(change, function (c) {
                            c.apply(doc);
                        });
                        bulkDocs.push(doc);
                    });
                    if (Logger.debug.isEnabled)
                        Logger.debug('Saving docs');
                    var tasks = [];
                    tasks.push(function (callback) {
                        if (_.keys(waitingForObservations).length) {
                            if (Logger.debug.isEnabled)
                                Logger.debug('waiting for observations');
                            finishWaitingForObservations = function () {
                                if (Logger.debug.isEnabled)
                                    Logger.debug('finished waiting for observations');
                                callback();
                            };
                        }
                        else {
                            if (Logger.debug.isEnabled)
                                Logger.debug('no observations to wait for');
                            callback();
                        }
                    });
                    tasks.push(function (callback) {
                        db.bulkDocs(bulkDocs, function (er, resp) {
                            if (err) {
                                if (errors.length) {
                                    errors.push(err);
                                    callback(errors);
                                }
                                else {
                                    callback(err);
                                }
                            }
                            else {
                                if (Logger.debug.isEnabled)
                                    Logger.debug('Saved docs', resp);
                                callback();
                            }
                        });
                    });

                    util.parallel(tasks, done);
                }
            });
        });
        op.onCompletion(function () {
            if (callback) callback(op.error);
        });
        mergeQueue.addOperation(op);
    }
    else if (callback) {
        if (Logger.debug.isEnabled)
            Logger.debug('Nothing to merge');
        callback();
    }
    return deferred.promise;
}

/**
 * Returns an array of all pending unmergedChanges.
 * @returns {Array}
 */
function allChanges() {
    var allChanges = [];
    for (var collectionName in unmergedChanges) {
        if (unmergedChanges.hasOwnProperty(collectionName)) {
            var collectionChanges = unmergedChanges[collectionName];
            for (var mappingName in collectionChanges) {
                if (collectionChanges.hasOwnProperty(mappingName)) {
                    var mappingChanges = collectionChanges[mappingName];
                    for (var objectId in mappingChanges) {
                        if (mappingChanges.hasOwnProperty(objectId)) {
                            allChanges = allChanges.concat(mappingChanges[objectId]);
                        }
                    }
                }
            }
        }
    }
    return allChanges;
}

function resetChanges() {
    unmergedChanges = {};
}


// Use defineProperty so that we can inject unmergedChanges for testing.
Object.defineProperty(exports, 'changes', {
    get: function () {
        return unmergedChanges;
    },
    set: function (v) {
        unmergedChanges = v;
    },
    enumerable: true,
    configurable: true
});

Object.defineProperty(exports, 'allChanges', {
    get: allChanges,
    enumerable: true,
    configurable: true
});

var oldConstructor = SiestaModel.prototype.constructor;

function _SiestaModel(mapping) {
    var self = this;
    oldConstructor.call(this, mapping);
    Object.defineProperty(this, 'changes', {
        get: function () {
            return changesForIdentifier(this._id);
        },
        enumerable: true
    });
}

_SiestaModel.prototype = Object.create(SiestaModel.prototype);

_SiestaModel.prototype.applyChanges = function () {
    if (this._id) {
        var self = this;
        _.each(this.changes, function (c) {
            c.apply(self);
        });
    }
    else {
        throw new InternalSiestaError('Cannot apply changes to object with no _id');
    }
};

SiestaModel.prototype = new _SiestaModel();

//noinspection JSValidateTypes

exports._SiestaModel = _SiestaModel;
exports.registerChange = coreChanges.registerChange;
exports.mergeChanges = mergeChanges;
exports.changesForIdentifier = changesForIdentifier;
exports.resetChanges = resetChanges;
},{"./index":2,"./pouch":3}],2:[function(require,module,exports){
var _i = siesta._internal
    , InternalSiestaError = _i.error.InternalSiestaError
    , mapping = _i.mapping
    , log = _i.log
    , util = _i.util
    , q = _i.q
    , _ = util._
    ;

var Pouch = require('./pouch');

var Logger = log.loggerWithName('Index');
Logger.setLevel(log.Level.warn);

function combine(a, min) {
    var fn = function (n, src, got, all) {
        if (n == 0) {
            if (got.length > 0) {
                all[all.length] = got;
            }
            return;
        }
        for (var j = 0; j < src.length; j++) {
            fn(n - 1, src.slice(j + 1), got.concat([src[j]]), all);
        }
    };
    var all = [];
    for (var i = min; i < a.length; i++) {
        fn(i, a, [], all);
    }
    all.push(a);
    return all;
}

function getFieldCombinations(fields) {
    var combinations = combine(fields, 1);
    combinations.push([]);
    return  combinations;
}

function constructIndexes(collection, modelName, fields) {
    var combinations = getFieldCombinations(fields);
    return _.map(combinations, function (fields) {
        return new Index(collection, modelName, fields);
    });
}

function installIndexes(collection, modelName, fields, callback) {
    var deferred = q.defer();
    callback = util.constructCallbackAndPromiseHandler(callback, deferred);
    var indexes = constructIndexes(collection, modelName, fields);
    var numCompleted = 0;
    var errors = [];
    _.each(indexes, function (index) {
        index.install(function (err) {
            if (err) {
                errors.push(err);
            }
            numCompleted++;
            if (numCompleted == indexes.length) {
                if (Logger.info.isEnabled)
                    Logger.info('Successfully installed all indexes');
                callback(errors.length ? errors : null);
            }
        });
    });
    return deferred.promise;
}


function Index(collection, type, fields_or_field) {
    this.type = type;
    this.collection = collection;
    if (fields_or_field) {
        if (fields_or_field.length) {
            this.fields = _.sortBy(fields_or_field, function (x) {return x});
        }
        else {
            this.fields = [fields_or_field];
        }
    }
    else {
        this.fields = [];
    }
}

Index.prototype._getDesignDocName = function () {
    var name = this._getName();
    return '_design/' + name;
};

/**
 * Return a PouchDB secondary index.
 * See http://pouchdb.com/2014/05/01/secondary-indexes-have-landed-in-pouchdb.html
 * @private
 */
Index.prototype._constructPouchDbView = function () {
    var name = this._getName();
    var index = {
        _id: this._getDesignDocName(),
        views: {}
    };
    index.views[name] = {
        map: this._constructMapFunction()
    };
    return  index
};

Index.prototype._constructMapFunction = function () {
    this._validate();
    var fields = this.fields;
    var type = this.type;
    var collection = this.collection;
    return mapping.constructMapFunction(collection, type, fields);
};

Index.prototype._validate = function () {
    if (!this.type) {
        throw new InternalSiestaError('Type must be specified in order to construct index map function.', {index: this});
    }
    if (!this.collection) {
        throw new InternalSiestaError('API must be specified in order to construct index map function.', {index: this});
    }
};

Index.prototype._dump = function () {
    return this._getName();
};

Index.prototype._getName = function () {
    this._validate();
    var appendix = _.reduce(this.fields, function (memo, field) {return memo + '_' + field}, '');
    return this.collection + '_' + 'Index_' + this.type + appendix;
};

Index.prototype.install = function (callback) {
    var deferred = q.defer();
    callback = util.constructCallbackAndPromiseHandler(callback, deferred);
    this._validate();
    var self = this;
    var constructPouchDbView = this._constructPouchDbView();
    var indexName = this._getName();
    if (Logger.debug.isEnabled)
        Logger.debug('Installing Index: ' + indexName, constructPouchDbView);
    Pouch.getPouch().put(constructPouchDbView, function (err, resp) {
        if (err) {
            if (err.status === 409) {
                if (Logger.debug.isEnabled)
                    Logger.debug(indexName + ' already installed');
                err = null;
            }
        }
        if (!err && Index.indexes.indexOf(self) < 0) {
            Index.indexes.push(self);
        }
        callback(err, resp);
    });
    return deferred.promise;
};

Index.indexes = [];

exports.Index = Index;
exports._constructIndexes = constructIndexes;
exports._getFieldCombinations = getFieldCombinations;
exports.installIndexes = installIndexes;

exports.clearIndexes = function () {
    Index.indexes = [];
};
},{"./pouch":3}],3:[function(require,module,exports){
var _i = siesta._internal
    , log = _i.log
    , util = _i.util
    , _ = util._
    , cache = _i.cache
    , guid = _i.misc.guid
    , InternalSiestaError = _i.error.InternalSiestaError
    , q = _i.q
    , CollectionRegistry = _i.CollectionRegistry;

var Logger = log.loggerWithName('Pouch');
Logger.setLevel(log.Level.warn);

var pouch = new PouchDB('siesta');

var changeEmitter;
var changeObservers = [];

configureChangeEmitter();

var POUCH_EVENT = 'change';

function retryUntilWrittenMultiple(docId, newValues, callback) {
    var deferred = q.defer();
    callback = util.constructCallbackAndPromiseHandler(callback, deferred);
    getPouch().get(docId, function (err, doc) {
        if (err) {
            var msg = 'Unable to get doc with _id="' + docId + '". This is a serious error and means that ' +
                'a live object is now out of sync with PouchDB.';
            Logger.error(msg);
            if (callback) callback(err);
        }
        else {
            for (var key in newValues) {
                if (newValues.hasOwnProperty(key)) {
                    doc[key] = newValues[key];
                }
            }
            getPouch().put(doc, function (err, resp) {
                if (err) {
                    if (err.status == 409) {
                        retryUntilWrittenMultiple(docId, newValues);
                    }
                    else {
                        var msg = 'Unable to update doc with _id="' + docId + '". This is a serious error and means that ' +
                            'a live object is now out of sync with PouchDB.';
                        Logger.error(msg);
                        if (callback) callback(err);
                    }
                }
                else {
                    if (Logger.trace.isEnabled)
                        Logger.trace('Successfully persisted unmergedChanges: ' + JSON.stringify({doc: doc._id, pouchDBResponse: resp, changes: newValues}, null, 4));
                    if (callback) callback(null, resp.rev);
                }
            });
        }
    });
    return deferred.promise;
}

function configureChangeEmitter() {
    if (changeEmitter) {
        changeEmitter.cancel();
    }

    changeEmitter = pouch.changes({
        since: 'now',
        live: true
    });

    _.each(changeObservers, function (o) {
        changeEmitter.on(POUCH_EVENT, o);
    });
}

function _reset(inMemory) {
    var dbName = guid();
    if (inMemory) {
        if (typeof window != 'undefined') {
            pouch = new PouchDB('siesta-' + dbName, {adapter: 'memory'});
            configureChangeEmitter();
        }
        else {
            throw 'nyi';
        }
    }
    else {
        throw 'Only in memory pouchDB supported atm';
//        pouch = new PouchDB(dbName);
    }
}

function reset(inMemory, callback) {
    var deferred = q.defer();
    callback = util.constructCallbackAndPromiseHandler(callback, deferred);
    if (pouch) {
        pouch.destroy();
    }
    _reset(inMemory);
    if (callback) callback();
    return deferred.promise;
}

function getPouch() {
    return pouch;
}

function validate(doc) {
    var collectionName = doc.collection;
    if (collectionName) {
        var collection = CollectionRegistry[collectionName];
        if (collection) {
            var mappingType = doc.type;
            if (mappingType) {
                var mapping = collection[mappingType];
                if (mapping) {
                    return mapping;
                }
                else {
                    throw new InternalSiestaError('Cannot convert PouchDB document into SiestaModel. ' +
                        'No mapping with type ' + mappingType.toString(), {doc: doc})
                }
            }
            else {
                throw new InternalSiestaError('Cannot convert PouchDB document into SiestaModel. ' +
                    'No type field within document', {doc: doc});
            }
        }
        else {
            throw new InternalSiestaError('Cannot convert PouchDB document into SiestaModel. ' +
                'API "' + collectionName.toString() + '" doesnt exist.', {doc: doc});
        }

    }
    else {
        throw new InternalSiestaError('Cannot convert PouchDB document into SiestaModel. ' +
            'No collection field within document', {doc: doc});
    }
}

function toNew(doc) {
    var mapping = validate(doc);
    var obj = mapping._new({_id: doc._id});
//    obj._id = doc._id;
    obj._rev = doc._rev;
    obj.isSaved = true;
    for (var prop in doc) {
        if (doc.hasOwnProperty(prop)) {
            if (obj._fields.indexOf(prop) > -1) {
                obj.__values[prop] = doc[prop];
            }
            else if (obj._relationshipFields.indexOf(prop) > -1) {
                obj[prop + 'Proxy']._id = doc[prop];
            }
        }
    }
    return obj;
}

function toSiesta(docs) {
    if (Logger.debug.isEnabled) Logger.debug('toSiesta');
    var mapped = [];
    for (var i = 0; i < docs.length; i++) {
        var doc = docs[i];
        if (doc) {
            var opts = {_id: doc._id};
            var type = doc.type;
            var collection = doc.collection;
            var mapping = CollectionRegistry[collection][type];
            if (mapping.id) {
                opts[mapping.id] = doc[mapping.id];
                opts.mapping = mapping;
            }
            var cached = cache.get(opts);
            if (cached) {
                mapped[i] = cached;
            }
            else {
                mapped[i] = toNew(doc);
                cache.insert(mapped[i]);
                mapped[i].applyChanges();  // Apply unsaved changes.
            }
        }
        else {
            mapped[i] = null;
        }
    }
    return mapped;
}

function from(obj) {
    if (Logger.trace.isEnabled)
        Logger.trace('from', {obj: obj});
    var mapping = obj.mapping;
    var adapted = {};
    _.each(mapping._fields, function (f) {
        if (Logger.trace.isEnabled)
            Logger.trace('field', f);
        var v = obj[f];
        if (Logger.trace.isEnabled)
            Logger.trace(f + '=', v);
        if (v) {
            adapted[f] = v;
        }
    });
    _.each(obj._proxies, function (p) {
        // Only forward relationships are stored in the database.
        if (p.isForward) {
            var name = p.forwardName;
            if (p._id) {
                adapted[name] = p._id;
            }
        }
    });
    adapted._id = obj._id;
    adapted._rev = obj._rev;
    adapted.type = obj.mapping.type;
    adapted.collection = obj.collection;
    return adapted;
}

exports.toNew = toNew;
exports._validate = validate;
exports.from = from;
exports.toSiesta = toSiesta;
exports.retryUntilWrittenMultiple = retryUntilWrittenMultiple;
exports.reset = reset;
exports.getPouch = getPouch;
exports.setPouch = function (_p) {
    pouch = _p;
    configureChangeEmitter();
};

exports.addObserver = function (o) {
    if (Logger.debug.isEnabled) Logger.debug('Adding observer', o);
    changeObservers.push(o);
    if (changeEmitter) changeEmitter.on(POUCH_EVENT, o);
};

exports.removeObserver = function (o) {
    var idx = changeObservers.indexOf(o);
    if (idx > -1) {
        if (changeEmitter) changeEmitter.removeListener(POUCH_EVENT, o);
        changeObservers.splice(idx, 1);
    }
};
},{}],4:[function(require,module,exports){
var _i = siesta._internal
    , mapping = _i.mapping
    , utils = _i.utils
    , util = _i.utils
    , _ = utils._
    , log = _i.log
    , InternalSiestaError = _i.error.InternalSiestaError
    , Query = _i.query.Query
    , q = _i.q
;

var Logger = log.loggerWithName('RawQuery');
Logger.setLevel(log.Level.warn);

var Pouch = require('./pouch')
    , index = require('./index')
    , Index = index.Index
    ;

function RawQuery(collection, modelName, query) {
    var self = this;
    this.collection = collection;
    this.modelName = modelName;
    this.query = query;

    Object.defineProperty(self, 'mapping', {
        configurable: true,
        enumerable: true,
        get: function () {
            var collection = require('./index')[self.collection];
            if (collection) {
                return collection[self.modelName];
            }
            return null;
        }
    });
}

function resultsCallback(callback, err, resp) {
    var deferred = q.defer();
    callback = util.constructCallbackAndPromiseHandler(callback, deferred);
    if (err) {
        if (callback) callback(err);
    }
    else {
        var results = _.pluck(resp.rows, 'value');
        if (callback) callback(null, results);
    }
    return deferred.promise;
}

RawQuery.prototype.execute = function (callback) {
    var deferred = q.defer();
    callback = util.constructCallbackAndPromiseHandler(callback, deferred);
    if (this.mapping) { // During unit testing, we don't populate this.mapping, but rather configure Pouch manually.
        if (!this.mapping.installed) {
            throw new InternalSiestaError('Mapping must be installed');
        }
    }
    var self = this;
    var designDocId = this._getDesignDocName();
    var indexName = self._getIndexName();
    Pouch.getPouch().get(designDocId, function (err) {
        var partialCallback = _.partial(resultsCallback, callback);

        function finish(err, docs) {
            if (Logger.trace.isEnabled)
                Logger.trace('Received results: ', docs);
            partialCallback(err, docs);
        }

        var key;
        if (!err) {
            key = self._constructKey();
            if (!key.length) {
                key = self.modelName;
            }
            if (Logger.debug.isEnabled)
                Logger.debug('Executing query ' + indexName + ':' + ' ' + key);
            Pouch.getPouch().query(indexName, {key: key}, finish);
        }
        else {
            if (err.status == 404) {
                Logger.warn('Couldnt find index "' + indexName + '" and hence must iterate through every single document.');
                var fields = self._sortedFields();
                // TODO: Clean up constructMapFunction so can output both string+func version so don't need eval here.
                // TODO: For some reason constructMapFunction2 (which returns a function) wont work with pouch.
                // I'm thinking that pouch probably doesnt support closures in its queries which would mean
                // we'd have to stick with eval here.
                var f = mapping.constructMapFunction(self.collection, self.modelName, fields);
                eval('var mapFunc = ' + f);
                key = self._constructKey(fields);
                if (!key.length) {
                    key = self.modelName;
                }
                //noinspection JSUnresolvedVariable
                Pouch.getPouch().query(mapFunc, {key: key}, finish);
            }
            else {
                finish(err);
            }
        }
    });
    return deferred.promise;
};

RawQuery.prototype._getFields = function () {
    var fields = [];
    for (var field in this.query) {
        if (this.query.hasOwnProperty(field)) {
            fields.push(field);
        }
    }
    return fields;
};

RawQuery.prototype._sortedFields = function () {
    var fields = this._getFields();
    return _.sortBy(fields, function (x) {return x});
};

RawQuery.prototype._constructKey = function () {
    var self = this;
    var sortedFields = this._sortedFields();
    var key = _.reduce(sortedFields, function (memo, x) {
        var v;
        if (x === null) {
            v = 'null';
        }
        else if (x === undefined) {
            v = 'undefined';
        }
        else {
            v = self.query[x].toString()
        }
        return memo + v + '_';
    }, '');
    return key.substring(0, key.length - 1);
};

RawQuery.prototype._getDesignDocName = function () {
    var i = new index.Index(this.collection, this.modelName, this._getFields());
    return i._getDesignDocName();
};

RawQuery.prototype._getIndexName = function () {
    var i = new index.Index(this.collection, this.modelName, this._getFields());
    return i._getName();
};

RawQuery.prototype._dump = function (asJson) {
    var obj = {};
    obj.collection = this.collection;
    obj.mapping = this.modelName;
    obj.query = this.query;
    obj.index = this._getIndexName();
    obj.designDoc = this._getDesignDocName();
    return asJson ? JSON.stringify(obj, null, 4) : obj;
};



exports.RawQuery = RawQuery;
},{"./index":2,"./pouch":3}],5:[function(require,module,exports){
(function () {

    var _i = siesta._internal
        , mapping = _i.mapping
        , q = _i.q
        , util = _i.util
        , extend = _.extend
        , Mapping = mapping.Mapping
        ;

    var changes = require('./changes')
        , pouch = require('./pouch')
        , query = require('./query')
        , index = require('./index')
        , store = require('./store')
        ;

    var oldReset = siesta.reset;

    siesta.reset = function (inMemory, callback) {
        changes.resetChanges();
        index.clearIndexes();
        pouch.reset(inMemory, callback);
        oldReset.apply(oldReset, arguments);
    };

    var oldInstall = mapping.Mapping.prototype.install;

    Mapping.prototype.getIndexesToInstall = function () {
        var self = this;
        var fieldHash = _.reduce(self._fields, function (m, f) {
            m[f] = {};
            return m
        }, {});
        for (var prop in self.relationships) {
            if (self.relationships.hasOwnProperty(prop)) {
                var r = self.relationships[prop];
                if (r.reverse != prop) {
                    fieldHash[prop] = {};
                }
            }
        }
        var indexesToInstall = _.reduce(self.indexes, function (m, f) {
            if (fieldHash[f]) m.push(f);
            return m;
        }, []);
        if (self.id) indexesToInstall.push(self.id);
        return  indexesToInstall;
    };

    Mapping.prototype.install = function (callback) {
        var deferred = q.defer();
        callback = util.constructCallbackAndPromiseHandler(callback, deferred);
        var self = this;
        oldInstall.call(this, function (err) {
            if (!err) {
                var indexesToInstall = self.getIndexesToInstall();
                index.installIndexes(self.collection, self.type, indexesToInstall, function (err) {
                    self._installed = !err;
                    if (callback) callback(err);
                });
            }
            else if (callback) {
                callback(err);
            }
        });
        return deferred.promise;
    };

    if (!siesta.ext) {
        siesta.ext = {};
    }

    siesta.ext.storage = {
        changes: changes,
        pouch: pouch,
        Pouch: pouch,
        query: query,
        index: index,
        store: store,
        Index: index.Index,
        RawQuery: query.RawQuery
    };

})();
},{"./changes":1,"./index":2,"./pouch":3,"./query":4,"./store":6}],6:[function(require,module,exports){
var _i = siesta._internal
    , wrappedCallback = _i.misc.wrappedCallback
    , util = _i.util
    , _ = util._
    , cache = _i.cache
    , InternalSiestaError = _i.error.InternalSiestaError
    , log = _i.log
    , coreStore = _i.store
    , q = _i.q
;

var Logger = log.loggerWithName('Store');
Logger.setLevel(log.Level.warn);

var PouchAdapter = require('./pouch');
var index = require('./index');
var Index = index.Index;

function getFromPouch(opts, callback) {
    PouchAdapter.getPouch().get(opts._id).then(function (doc) {
        var docs = PouchAdapter.toSiesta([doc]);
        if (callback) callback(null, docs.length ? docs[0] : null);
    }, wrappedCallback(callback));
}

function getMultipleLocalFromCouch(results, callback) {
    var deferred = q.defer();
    callback = util.constructCallbackAndPromiseHandler(callback, deferred);
    PouchAdapter.getPouch().allDocs({keys: results.notCached, include_docs: true}, function (err, docs) {
        if (err) {
            callback(err);
        }
        else {
            var rows = _.pluck(docs.rows, 'doc');
            var models = PouchAdapter.toSiesta(rows);
            _.each(models, function (m) {
                if (m) {
                    results.cached[m._id] = m;
                }
            });
            callback();
        }
    });
    return deferred.promise;
}

function getMultipleRemoteFrompouch(mapping, remoteIdentifiers, results, callback) {
    if (Logger.trace.isEnabled) Logger.trace('getMultipleRemoteFrompouch(' + mapping.type + '):', remoteIdentifiers);
    var deferred = q.defer();
    callback = util.constructCallbackAndPromiseHandler(callback, deferred);
    var i = new Index(mapping.collection, mapping.type, [mapping.id]);
    var name = i._getName();
    PouchAdapter.getPouch().query(name, {keys: _.map(remoteIdentifiers, function (i) {return i.toString();}), include_docs: true}, function (err, docs) {
        if (err) {
            callback(err);
        }
        else {
            var rows = _.pluck(docs.rows, 'value');
            if (Logger.trace.isEnabled) Logger.trace('[ROWS] getMultipleRemoteFrompouch(' + mapping.type + '):', rows);
            var models = PouchAdapter.toSiesta(rows);
            _.each(models, function (model) {
                var remoteId = model[mapping.id];
                results.cached[remoteId] = model;
                var idx = results.notCached.indexOf(remoteId);
                results.notCached.splice(idx, 1);
            });
            if (Logger.trace.isEnabled) {
                Logger.trace('[RESULTS] getMultipleRemoteFrompouch(' + mapping.type + '):', results);
            }
            callback();
        }
    });
    return deferred.promise;
}

exports.getFromPouch = getFromPouch;
exports.getMultipleLocalFromCouch = getMultipleLocalFromCouch;
exports.getMultipleRemoteFrompouch = getMultipleRemoteFrompouch;
},{"./index":2,"./pouch":3}]},{},[5])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9zcmMvcG91Y2gvY2hhbmdlcy5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L3NyYy9wb3VjaC9pbmRleC5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L3NyYy9wb3VjaC9wb3VjaC5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L3NyYy9wb3VjaC9xdWVyeS5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L3NyYy9wb3VjaC9zdG9yYWdlLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3Qvc3JjL3BvdWNoL3N0b3JlLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL2VBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDektBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsS0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvKlxuICogQ2hhbmdlcyBkZXNjcmliZSBkaWZmZXJlbmNlcyBiZXR3ZWVuIHRoZSBpbi1tZW1vcnkgb2JqZWN0IGdyYXBoIGFuZCB0aGUgb2JqZWN0IGdyYXBoIHNhdCBpbiB0aGUgZGF0YWJhc2VzLlxuICpcbiAqIEZhdWx0ZWQgb2JqZWN0cyBiZWluZyBwdWxsZWQgaW50byBtZW1vcnkgd2lsbCBoYXZlIGNoYW5nZXMgYXBwbGllZCB0byB0aGVtLlxuICpcbiAqIE9uIHNpZXN0YS5zYXZlKCkgYWxsIGNoYW5nZXMgd2lsbCBiZSBtZXJnZWQgaW50byB0aGUgZGF0YWJhc2UuXG4gKi9cblxudmFyIF9pID0gc2llc3RhLl9pbnRlcm5hbFxuICAgICwgSW50ZXJuYWxTaWVzdGFFcnJvciA9IF9pLmVycm9yLkludGVybmFsU2llc3RhRXJyb3JcbiAgICAsIHV0aWwgPSBfaS51dGlsXG4gICAgLCBfID0gdXRpbC5fXG4gICAgLCBPcGVyYXRpb24gPSBfaS5PcGVyYXRpb25cbiAgICAsIE9wZXJhdGlvblF1ZXVlID0gX2kuT3BlcmF0aW9uUXVldWVcbiAgICAsIG9iamVjdCA9IF9pLm9iamVjdFxuICAgICwgU2llc3RhTW9kZWwgPSBvYmplY3QuU2llc3RhTW9kZWxcbiAgICAsIGV4dGVuZCA9IF9pLmV4dGVuZFxuICAgICwgbG9nID0gX2kubG9nXG4gICAgLCBjYWNoZSA9IF9pLmNhY2hlXG4gICAgLCBjb3JlQ2hhbmdlcyA9IF9pLmNvcmVDaGFuZ2VzXG4gICAgLCBDaGFuZ2UgPSBjb3JlQ2hhbmdlcy5DaGFuZ2VcbiAgICAsIENoYW5nZVR5cGUgPSBjb3JlQ2hhbmdlcy5DaGFuZ2VUeXBlXG4gICAgLCBjb2xsZWN0aW9uID0gX2kuY29sbGVjdGlvblxuICAgICwgcSA9IF9pLnFcbiAgICA7XG5cbnZhciBwb3VjaCA9IHJlcXVpcmUoJy4vcG91Y2gnKTtcbnZhciBpbmRleCA9IHJlcXVpcmUoJy4vaW5kZXgnKTtcblxudmFyIExvZ2dlciA9IGxvZy5sb2dnZXJXaXRoTmFtZSgnY2hhbmdlcycpO1xuTG9nZ2VyLnNldExldmVsKGxvZy5MZXZlbC53YXJuKTtcblxudmFyIHVubWVyZ2VkQ2hhbmdlcyA9IHt9O1xuXG4vKipcbiAqIFVzZWQgdG8gZW5zdXJlIG1lcmdlIG9wZXJhdGlvbiBvbmx5IGZpbmlzaGVzIG9uY2UgYWxsIGNoYW5nZXMgYXJlIG1hZGUgdG8gdGhlIGRhdGFiYXNlLlxuICogVGhpcyBpcyBiZWNhdXNlIG9mICh3aGF0IEkgdGhpbmsgaXMpIGEgYnVnIGluIFBvdWNoREIgd2hlcmVieSB0aGUgYnVsa0RvY3MgY2FsbGJhY2sgaXMgY2FsbGVkIGJlZm9yZVxuICogYWxsIGNoYW5nZXMgaGF2ZSBhY3R1YWxseSBiZWVuIG1hZGUgaW4gdGhlIGRhdGFiYXNlLiBCeSB3YWl0aW5nIGZvciBhbGwgdGhlIGRhdGFiYXNlIGNoYW5nZSBldmVudHMgdG8gcmV0dXJuXG4gKiB3ZSBjYW4gZW5zdXJlIHRoYXQgdGhlcmUgaXMgbm8gbWVyZ2Ugb3ZlcmxhcHMgYW5kIGhlbmNlIG5vIHJhY2UgY29uZGl0aW9ucy5cbiAqIEB0eXBlIHt7fX1cbiAqL1xudmFyIHdhaXRpbmdGb3JPYnNlcnZhdGlvbnMgPSB7fTtcblxuLyoqXG4gKiBQb3B1bGF0ZWQgYnkgZWFjaCBtZXJnZSBvcGVyYXRpb24gdGhhdCBpcyBjdXJyZW50bHkgZXhlY3V0aW5nLiBXaGVuIGFsbCBvYnNlcnZhdGlvbnMgcmVsYXRlZCB0byB0aGUgbWVyZ2VkIGNoYW5nZXNcbiAqIGFyZSByZWNlaXZlZCwgdGhpcyBmdW5jdGlvbiBpcyBjYWxsZWQsIGVuZGluZyB0aGUgbWVyZ2Ugb3BlcmF0aW9uLlxuICogQHR5cGUge2Z1bmN0aW9ufVxuICovXG52YXIgZmluaXNoV2FpdGluZ0Zvck9ic2VydmF0aW9ucztcblxuLy8gVGhlIG1vbWVudCB0aGF0IGNoYW5nZXMgYXJlIHByb3BhZ2F0ZWQgdG8gUG91Y2ggd2UgbmVlZCB0byByZW1vdmUgc2FpZCBjaGFuZ2UgZnJvbSB1bm1lcmdlZENoYW5nZXMuXG5wb3VjaC5hZGRPYnNlcnZlcihmdW5jdGlvbiAoZSkge1xuICAgIHZhciBpZCA9IGUuaWQ7XG4gICAgZm9yICh2YXIgY29sbGVjdGlvbk5hbWUgaW4gdW5tZXJnZWRDaGFuZ2VzKSB7XG4gICAgICAgIGlmICh1bm1lcmdlZENoYW5nZXMuaGFzT3duUHJvcGVydHkoY29sbGVjdGlvbk5hbWUpKSB7XG4gICAgICAgICAgICB2YXIgY29sbGVjdGlvbkNoYW5nZXMgPSB1bm1lcmdlZENoYW5nZXNbY29sbGVjdGlvbk5hbWVdO1xuICAgICAgICAgICAgZm9yICh2YXIgbWFwcGluZ05hbWUgaW4gY29sbGVjdGlvbkNoYW5nZXMpIHtcbiAgICAgICAgICAgICAgICBpZiAoY29sbGVjdGlvbkNoYW5nZXMuaGFzT3duUHJvcGVydHkobWFwcGluZ05hbWUpKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBtYXBwaW5nQ2hhbmdlcyA9IGNvbGxlY3Rpb25DaGFuZ2VzW21hcHBpbmdOYW1lXTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG1hcHBpbmdDaGFuZ2VzW2lkXSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZGVsZXRlIG1hcHBpbmdDaGFuZ2VzW2lkXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlbGV0ZSB3YWl0aW5nRm9yT2JzZXJ2YXRpb25zW2lkXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghXy5rZXlzKHdhaXRpbmdGb3JPYnNlcnZhdGlvbnMpLmxlbmd0aCAmJiBmaW5pc2hXYWl0aW5nRm9yT2JzZXJ2YXRpb25zKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZmluaXNoV2FpdGluZ0Zvck9ic2VydmF0aW9ucygpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZpbmlzaFdhaXRpbmdGb3JPYnNlcnZhdGlvbnMgPSBudWxsO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufSk7XG5cbnZhciBtZXJnZVF1ZXVlID0gbmV3IE9wZXJhdGlvblF1ZXVlKCdNZXJnZSBRdWV1ZScpO1xubWVyZ2VRdWV1ZS5tYXhDb25jdXJyZW50T3BlcmF0aW9ucyA9IDE7XG5tZXJnZVF1ZXVlLnN0YXJ0KCk7XG5cbmZ1bmN0aW9uIGFycmF5c0VxdWFsKGEsIGIpIHtcbiAgICBpZiAoYSA9PT0gYikgcmV0dXJuIHRydWU7XG4gICAgaWYgKGEgPT0gbnVsbCB8fCBiID09IG51bGwpIHJldHVybiBmYWxzZTtcbiAgICBpZiAoYS5sZW5ndGggIT0gYi5sZW5ndGgpIHJldHVybiBmYWxzZTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGEubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgaWYgKGFbaV0gIT09IGJbaV0pIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgcmV0dXJuIHRydWU7XG59XG5cbmZ1bmN0aW9uIGFwcGx5U3BsaWNlKG9iaiwgZmllbGQsIGluZGV4LCByZW1vdmVkLCBhZGRlZCkge1xuICAgIGlmICghKHJlbW92ZWQgfHwgYWRkZWQpKSB7XG4gICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdNdXN0IHJlbW92ZSBvciBhZGQgc29tZXRoaW5nIHdpdGggYSBzcGxpY2UgY2hhbmdlLicpO1xuICAgIH1cbiAgICBpZiAoaW5kZXggPT09IHVuZGVmaW5lZCB8fCBpbmRleCA9PT0gbnVsbCkge1xuICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignTXVzdCBwYXNzIGluZGV4IHRvIHNwbGljZSBjaGFuZ2UnKTtcbiAgICB9XG4gICAgdmFyIGFyciA9IG9ialtmaWVsZF07XG4gICAgdmFyIGFjdHVhbGx5UmVtb3ZlZCA9IF8ucGFydGlhbChhcnIuc3BsaWNlLCBpbmRleCwgcmVtb3ZlZC5sZW5ndGgpLmFwcGx5KGFyciwgYWRkZWQpO1xuICAgIC8vIFRPRE86IEZJWCBUSElTISEhISBcbiAgICAvLyBpZiAoIWFycmF5c0VxdWFsKGFjdHVhbGx5UmVtb3ZlZCwgcmVtb3ZlZCkpIHtcbiAgICAvLyAgICAgdmFyIGVyciA9ICdPYmplY3RzIGFjdHVhbGx5IHJlbW92ZWQgZGlkIG5vdCBtYXRjaCB0aG9zZSBzcGVjaWZpZWQgaW4gdGhlIGNoYW5nZSc7XG4gICAgLy8gICAgIExvZ2dlci5lcnJvcihlcnIsIHthY3R1YWxseVJlbW92ZWQ6IGFjdHVhbGx5UmVtb3ZlZCwgZXhwZWN0ZWRSZW1vdmVkOiByZW1vdmVkfSlcbiAgICAvLyAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoZXJyKTtcbiAgICAvLyB9XG59XG5cbmZ1bmN0aW9uIGFwcGx5UmVtb3ZlKGZpZWxkLCByZW1vdmVkLCBvYmopIHtcbiAgICBpZiAoIXJlbW92ZWQpIHtcbiAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ011c3QgcGFzcyByZW1vdmVkJyk7XG4gICAgfVxuICAgIF8uZWFjaChyZW1vdmVkLCBmdW5jdGlvbiAocikge1xuICAgICAgICB2YXIgYXJyID0gb2JqW2ZpZWxkXTtcbiAgICAgICAgdmFyIGlkeCA9IGFyci5pbmRleE9mKHIpO1xuICAgICAgICBhcnIuc3BsaWNlKGlkeCwgMSk7XG4gICAgfSk7XG59XG5cbmZ1bmN0aW9uIGFwcGx5U2V0KG9iaiwgZmllbGQsIG5ld1ZhbCwgb2xkKSB7XG4gICAgdmFyIGFjdHVhbE9sZCA9IG9ialtmaWVsZF07XG4gICAgaWYgKGFjdHVhbE9sZCAhPSBvbGQpIHtcbiAgICAgICAgLy8gVGhpcyBpcyBiYWQuIFNvbWV0aGluZyBoYXMgZ29uZSBvdXQgb2Ygc3luYyBvciB3ZSdyZSBhcHBseWluZyB1bm1lcmdlZENoYW5nZXMgb3V0IG9mIG9yZGVyLlxuICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignT2xkIHZhbHVlIGRvZXMgbm90IG1hdGNoIG5ldyB2YWx1ZTogJyArIEpTT04uc3RyaW5naWZ5KHtvbGQ6IG9sZCA/IG9sZCA6IG51bGwsIGFjdHVhbE9sZDogYWN0dWFsT2xkID8gYWN0dWFsT2xkIDogbnVsbH0sIG51bGwsIDQpKTtcbiAgICB9XG4gICAgb2JqW2ZpZWxkXSA9IG5ld1ZhbDtcbn1cblxuZnVuY3Rpb24gdmFsaWRhdGVDaGFuZ2UoKSB7XG4gICAgaWYgKCF0aGlzLmZpZWxkKSB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignTXVzdCBwYXNzIGZpZWxkIHRvIGNoYW5nZScpO1xuICAgIGlmICghdGhpcy5jb2xsZWN0aW9uKSB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignTXVzdCBwYXNzIGNvbGxlY3Rpb24gdG8gY2hhbmdlJyk7XG4gICAgaWYgKCF0aGlzLm1hcHBpbmcpIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdNdXN0IHBhc3MgbWFwcGluZyB0byBjaGFuZ2UnKTtcbn1cbmZ1bmN0aW9uIHZhbGlkYXRlT2JqZWN0KG9iaikge1xuICAgIGlmIChvYmouX2lkICE9IHRoaXMuX2lkKSB7XG4gICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdDYW5ub3QgYXBwbHkgY2hhbmdlIHdpdGggX2lkPVwiJyArIHRoaXMuX2lkLnRvU3RyaW5nKCkgKyAnXCIgdG8gb2JqZWN0IHdpdGggX2lkPVwiJyArIG9iai5faWQudG9TdHJpbmcoKSArICdcIicpO1xuICAgIH1cbn1cblxudmFyIG9sZFJlZ2lzdGVyQ2hhbmdlID0gY29yZUNoYW5nZXMucmVnaXN0ZXJDaGFuZ2U7XG5cbmNvcmVDaGFuZ2VzLnJlZ2lzdGVyQ2hhbmdlID0gZnVuY3Rpb24gKG9wdHMpIHtcbiAgICBjb3JlQ2hhbmdlcy52YWxpZGF0ZUNoYW5nZShvcHRzKTtcbiAgICB2YXIgY29sbGVjdGlvbiA9IG9wdHMuY29sbGVjdGlvbjtcbiAgICB2YXIgbWFwcGluZyA9IG9wdHMubWFwcGluZztcbiAgICB2YXIgX2lkID0gb3B0cy5faWQ7XG4gICAgaWYgKCF1bm1lcmdlZENoYW5nZXNbY29sbGVjdGlvbi5uYW1lXSkge1xuICAgICAgICB1bm1lcmdlZENoYW5nZXNbY29sbGVjdGlvbi5uYW1lXSA9IHt9O1xuICAgIH1cbiAgICB2YXIgY29sbGVjdGlvbkNoYW5nZXMgPSB1bm1lcmdlZENoYW5nZXNbY29sbGVjdGlvbi5uYW1lXTtcbiAgICBpZiAoIWNvbGxlY3Rpb25DaGFuZ2VzW21hcHBpbmcudHlwZV0pIHtcbiAgICAgICAgY29sbGVjdGlvbkNoYW5nZXNbbWFwcGluZy50eXBlXSA9IHt9O1xuICAgIH1cbiAgICBpZiAoIWNvbGxlY3Rpb25DaGFuZ2VzW21hcHBpbmcudHlwZV1bX2lkXSkge1xuICAgICAgICBjb2xsZWN0aW9uQ2hhbmdlc1ttYXBwaW5nLnR5cGVdW19pZF0gPSBbXTtcbiAgICB9XG4gICAgdmFyIG9iakNoYW5nZXMgPSBjb2xsZWN0aW9uQ2hhbmdlc1ttYXBwaW5nLnR5cGVdW19pZF07XG4gICAgdmFyIGMgPSBvbGRSZWdpc3RlckNoYW5nZShvcHRzKTtcbiAgICBvYmpDaGFuZ2VzLnB1c2goYyk7XG59O1xuXG5cbkNoYW5nZS5wcm90b3R5cGUuYXBwbHkgPSBmdW5jdGlvbiAoZG9jKSB7XG4gICAgdmFsaWRhdGVDaGFuZ2UuY2FsbCh0aGlzKTtcbiAgICB2YWxpZGF0ZU9iamVjdC5jYWxsKHRoaXMsIGRvYyk7XG4gICAgaWYgKHRoaXMudHlwZSA9PSBDaGFuZ2VUeXBlLlNldCkge1xuICAgICAgICBhcHBseVNldC5jYWxsKHRoaXMsIGRvYywgdGhpcy5maWVsZCwgdGhpcy5uZXdJZCB8fCB0aGlzLm5ldywgdGhpcy5vbGRJZCB8fCB0aGlzLm9sZCk7XG4gICAgfVxuICAgIGVsc2UgaWYgKHRoaXMudHlwZSA9PSBDaGFuZ2VUeXBlLlNwbGljZSkge1xuICAgICAgICBpZiAoIWRvY1t0aGlzLmZpZWxkXSkgZG9jW3RoaXMuZmllbGRdID0gW107XG4gICAgICAgIGFwcGx5U3BsaWNlLmNhbGwodGhpcywgZG9jLCB0aGlzLmZpZWxkLCB0aGlzLmluZGV4LCB0aGlzLnJlbW92ZWRJZCB8fCB0aGlzLnJlbW92ZWQsIHRoaXMuYWRkZWRJZCB8fCB0aGlzLmFkZGVkKTtcbiAgICB9XG4gICAgZWxzZSBpZiAodGhpcy50eXBlID09IENoYW5nZVR5cGUuRGVsZXRlKSB7XG4gICAgICAgIGFwcGx5UmVtb3ZlLmNhbGwodGhpcywgdGhpcy5maWVsZCwgdGhpcy5yZW1vdmVkSWQgfHwgdGhpcy5yZW1vdmVkLCBkb2MpO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ1Vua25vd24gY2hhbmdlIHR5cGUgXCInICsgdGhpcy50eXBlLnRvU3RyaW5nKCkgKyAnXCInKTtcbiAgICB9XG4gICAgaWYgKCFkb2MuY29sbGVjdGlvbikge1xuICAgICAgICBkb2MuY29sbGVjdGlvbiA9IHRoaXMuY29sbGVjdGlvbjtcbiAgICB9XG4gICAgaWYgKCFkb2MubWFwcGluZykge1xuICAgICAgICBkb2MubWFwcGluZyA9IHRoaXMubWFwcGluZztcbiAgICB9XG4gICAgaWYgKCFkb2MudHlwZSkge1xuICAgICAgICBkb2MudHlwZSA9IHRoaXMubWFwcGluZztcbiAgICB9XG59O1xuXG5mdW5jdGlvbiBhcHBseVNldFRvU2llc3RhTW9kZWwoaXNGaWVsZCwgbW9kZWwpIHtcbiAgICBpZiAoaXNGaWVsZCkge1xuICAgICAgICBhcHBseVNldC5jYWxsKHRoaXMsIG1vZGVsLl9fdmFsdWVzLCB0aGlzLmZpZWxkLCB0aGlzLm5ldywgdGhpcy5vbGQpO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgdmFyIGlkZW50aWZpZXIgPSB0aGlzLm5ld0lkIHx8ICh0aGlzLm5ldyA/IHRoaXMubmV3Ll9pZCA6IG51bGwpO1xuICAgICAgICB2YXIgb2xkSWRlbnRpZmllciA9IHRoaXMub2xkSWQgfHwgKHRoaXMub2xkID8gdGhpcy5vbGQuX2lkIDogbnVsbCk7XG4gICAgICAgIHZhciBwcm94eSA9IG1vZGVsW3RoaXMuZmllbGQgKyAnUHJveHknXTtcbi8vICAgICAgICB2YXIgaXNGYXVsdGVkID0gcHJveHkuaXNGYXVsdDtcbiAgICAgICAgYXBwbHlTZXQuY2FsbCh0aGlzLCBwcm94eSwgJ19pZCcsIGlkZW50aWZpZXIsIG9sZElkZW50aWZpZXIpO1xuICAgICAgICB2YXIgX25ldyA9IHRoaXMubmV3IHx8ICh0aGlzLm5ld0lkID8gY2FjaGUuZ2V0KHtfaWQ6IHRoaXMubmV3SWR9KSA6IG51bGwpO1xuICAgICAgICB2YXIgb2xkID0gdGhpcy5vbGQgfHwgKHRoaXMub2xkSWQgPyBjYWNoZS5nZXQoe19pZDogdGhpcy5vbGRJZH0pIDogbnVsbCk7XG4gICAgICAgIGlmIChfbmV3IHx8IG9sZCkge1xuICAgICAgICAgICAgYXBwbHlTZXQuY2FsbCh0aGlzLCBwcm94eSwgJ3JlbGF0ZWQnLCBfbmV3LCBvbGQpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgLy8gRmF1bHRcbiAgICAgICAgICAgIHByb3h5LnJlbGF0ZWQgPSBudWxsO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5mdW5jdGlvbiBhcHBseVNwbGljZVRvU2llc3RhTW9kZWwoaXNGaWVsZCwgbW9kZWwpIHtcbiAgICBpZiAoaXNGaWVsZCkge1xuICAgICAgICBhcHBseVNwbGljZS5jYWxsKHRoaXMsIG1vZGVsLl9fdmFsdWVzLCB0aGlzLmZpZWxkLCB0aGlzLmluZGV4LCB0aGlzLnJlbW92ZWQsIHRoaXMuYWRkZWQpO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgdmFyIHJlbW92ZWRJZGVudGlmaWVycyA9IHRoaXMucmVtb3ZlZElkIHx8ICh0aGlzLnJlbW92ZWQgPyBfLnBsdWNrKHRoaXMucmVtb3ZlZCwgJ19pZCcpIDogW10pO1xuICAgICAgICB2YXIgYWRkZWRJZGVudGlmaWVycyA9IHRoaXMuYWRkZWRJZCB8fCAodGhpcy5hZGRlZCA/IF8ucGx1Y2sodGhpcy5hZGRlZCwgJ19pZCcpIDogW10pO1xuICAgICAgICB2YXIgcHJveHkgPSBtb2RlbFt0aGlzLmZpZWxkICsgJ1Byb3h5J107XG4gICAgICAgIHZhciBpc0ZhdWx0ZWQgPSBwcm94eS5pc0ZhdWx0O1xuICAgICAgICBhcHBseVNwbGljZS5jYWxsKHRoaXMsIHByb3h5LCAnX2lkJywgdGhpcy5pbmRleCwgcmVtb3ZlZElkZW50aWZpZXJzLCBhZGRlZElkZW50aWZpZXJzKTtcbiAgICAgICAgaWYgKCFpc0ZhdWx0ZWQpIHtcbiAgICAgICAgICAgIHZhciByZW1vdmVkID0gdGhpcy5yZW1vdmVkIHx8IF8ubWFwKHJlbW92ZWRJZGVudGlmaWVycywgZnVuY3Rpb24gKHgpIHtyZXR1cm4gY2FjaGUuZ2V0KHtfaWQ6IHh9KX0pO1xuICAgICAgICAgICAgdmFyIGFsbFJlbW92ZWRDYWNoZWQgPSBfLnJlZHVjZShyZW1vdmVkLCBmdW5jdGlvbiAobWVtbywgeCkge3JldHVybiB4ICYmIG1lbW99LCB0cnVlKTtcbiAgICAgICAgICAgIHZhciBhZGRlZCA9IHRoaXMuYWRkZWQgfHwgXy5tYXAoYWRkZWRJZGVudGlmaWVycywgZnVuY3Rpb24gKHgpIHtyZXR1cm4gY2FjaGUuZ2V0KHtfaWQ6IHh9KX0pO1xuICAgICAgICAgICAgdmFyIGFsbEFkZGVkQ2FjaGVkID0gXy5yZWR1Y2UoYWRkZWQsIGZ1bmN0aW9uIChtZW1vLCB4KSB7cmV0dXJuIHggJiYgbWVtb30sIHRydWUpO1xuICAgICAgICAgICAgaWYgKGFsbFJlbW92ZWRDYWNoZWQgJiYgYWxsQWRkZWRDYWNoZWQpIHtcbiAgICAgICAgICAgICAgICBhcHBseVNwbGljZS5jYWxsKHRoaXMsIHByb3h5LCAncmVsYXRlZCcsIHRoaXMuaW5kZXgsIHJlbW92ZWQsIGFkZGVkKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKCFhbGxSZW1vdmVkQ2FjaGVkKSB7XG4gICAgICAgICAgICAgICAgLy8gU29tZXRoaW5nIGhhcyBnb25lIHZlcnkgd3JvbmcgaWYgd2UgZW5kIHVwIGhlcmUuXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ0lmIG5vdCBmYXVsdGVkLCBhbGwgcmVtb3ZlZCBvYmplY3RzIHNob3VsZCBiZSBjYWNoZS4nKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIEZhdWx0XG4gICAgICAgICAgICAgICAgcHJveHkucmVsYXRlZCA9IG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmZ1bmN0aW9uIGFwcGx5UmVtb3ZlVG9TaWVzdGFNb2RlbChpc0ZpZWxkLCBtb2RlbCkge1xuICAgIGlmIChpc0ZpZWxkKSB7XG4gICAgICAgIGFwcGx5UmVtb3ZlLmNhbGwodGhpcywgdGhpcy5maWVsZCwgdGhpcy5yZW1vdmVkLCBtb2RlbCk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICB2YXIgcmVtb3ZlZCA9IHRoaXMucmVtb3ZlZElkIHx8ICh0aGlzLnJlbW92ZWQgPyBfLnBsdWNrKHRoaXMucmVtb3ZlZCwgJ19pZCcpIDogW10pO1xuICAgICAgICB2YXIgcHJveHkgPSBtb2RlbFt0aGlzLmZpZWxkICsgJ1Byb3h5J107XG4gICAgICAgIHZhciBpc0ZhdWx0ZWQgPSBwcm94eS5pc0ZhdWx0O1xuICAgICAgICBhcHBseVJlbW92ZS5jYWxsKHRoaXMsICdfaWQnLCByZW1vdmVkLCBwcm94eSk7XG4gICAgICAgIGlmICghaXNGYXVsdGVkICYmIHRoaXMucmVtb3ZlZCkge1xuICAgICAgICAgICAgYXBwbHlSZW1vdmUuY2FsbCh0aGlzLCAncmVsYXRlZCcsIHRoaXMucmVtb3ZlZCwgcHJveHkpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG4vKipcbiAqXG4gKiBAcGFyYW0gbW9kZWwgLSBBbiBpbnN0YW5jZSBvZiBTaWVzdGFNb2RlbFxuICovXG5DaGFuZ2UucHJvdG90eXBlLmFwcGx5U2llc3RhTW9kZWwgPSBmdW5jdGlvbiAobW9kZWwpIHtcbiAgICB2YWxpZGF0ZUNoYW5nZS5jYWxsKHRoaXMpO1xuICAgIHZhbGlkYXRlT2JqZWN0LmNhbGwodGhpcywgbW9kZWwpO1xuICAgIHZhciByZWxhdGlvbnNoaXBGaWVsZHMgPSBfLmtleXModGhpcy5tYXBwaW5nLnJlbGF0aW9uc2hpcHMpO1xuICAgIHZhciBmaWVsZHMgPSB0aGlzLm1hcHBpbmcuX2ZpZWxkcztcbiAgICB2YXIgaXNGaWVsZCA9IGZpZWxkcy5pbmRleE9mKHRoaXMuZmllbGQpID4gLTE7XG4gICAgdmFyIGlzUmVsYXRpb25zaGlwRmllbGQgPSByZWxhdGlvbnNoaXBGaWVsZHMuaW5kZXhPZih0aGlzLmZpZWxkKSA+IC0xO1xuICAgIGlmICghKGlzRmllbGQgfHwgaXNSZWxhdGlvbnNoaXBGaWVsZCkpIHtcbiAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ0ZpZWxkIFwiJyArIHRoaXMuZmllbGQgKyAnXCIgZG9lcyBub3QgZXhpc3Qgd2l0aGluIG1hcHBpbmcgXCInICsgdGhpcy5tYXBwaW5nLnR5cGUgKyAnXCInKTtcbiAgICB9XG4gICAgaWYgKHRoaXMudHlwZSA9PSBDaGFuZ2VUeXBlLlNldCkge1xuICAgICAgICBhcHBseVNldFRvU2llc3RhTW9kZWwuY2FsbCh0aGlzLCBpc0ZpZWxkLCBtb2RlbCk7XG4gICAgfVxuICAgIGVsc2UgaWYgKHRoaXMudHlwZSA9PSBDaGFuZ2VUeXBlLlNwbGljZSkge1xuICAgICAgICBhcHBseVNwbGljZVRvU2llc3RhTW9kZWwuY2FsbCh0aGlzLCBpc0ZpZWxkLCBtb2RlbCk7XG4gICAgfVxuICAgIGVsc2UgaWYgKHRoaXMudHlwZSA9PSBDaGFuZ2VUeXBlLkRlbGV0ZSkge1xuICAgICAgICBhcHBseVJlbW92ZVRvU2llc3RhTW9kZWwuY2FsbCh0aGlzLCBpc0ZpZWxkLCBtb2RlbCk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignVW5rbm93biBjaGFuZ2UgdHlwZSBcIicgKyB0aGlzLnR5cGUudG9TdHJpbmcoKSArICdcIicpO1xuICAgIH1cbn07XG5cbmZ1bmN0aW9uIGNoYW5nZXNCeUlkZW50aWZpZXJzKCkge1xuICAgIHZhciByZXMgPSB7fTtcbiAgICBmb3IgKHZhciBjb2xsZWN0aW9uTmFtZSBpbiB1bm1lcmdlZENoYW5nZXMpIHtcbiAgICAgICAgaWYgKHVubWVyZ2VkQ2hhbmdlcy5oYXNPd25Qcm9wZXJ0eShjb2xsZWN0aW9uTmFtZSkpIHtcbiAgICAgICAgICAgIHZhciBjb2xsZWN0aW9uQ2hhbmdlcyA9IHVubWVyZ2VkQ2hhbmdlc1tjb2xsZWN0aW9uTmFtZV07XG4gICAgICAgICAgICBmb3IgKHZhciBtYXBwaW5nTmFtZSBpbiBjb2xsZWN0aW9uQ2hhbmdlcykge1xuICAgICAgICAgICAgICAgIGlmIChjb2xsZWN0aW9uQ2hhbmdlcy5oYXNPd25Qcm9wZXJ0eShtYXBwaW5nTmFtZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIG1hcHBpbmdDaGFuZ2VzID0gY29sbGVjdGlvbkNoYW5nZXNbbWFwcGluZ05hbWVdO1xuICAgICAgICAgICAgICAgICAgICBleHRlbmQocmVzLCBtYXBwaW5nQ2hhbmdlcyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiByZXM7XG59XG5cbmZ1bmN0aW9uIGNoYW5nZXNGb3JJZGVudGlmaWVyKGlkZW50KSB7XG4gICAgcmV0dXJuIGNoYW5nZXNCeUlkZW50aWZpZXJzKClbaWRlbnRdIHx8IFtdO1xufVxuXG5cbi8qKlxuICogTWVyZ2UgdW5tZXJnZWRDaGFuZ2VzIGludG8gUG91Y2hEQlxuICovXG5mdW5jdGlvbiBtZXJnZUNoYW5nZXMoY2FsbGJhY2spIHtcbiAgICB2YXIgZGVmZXJyZWQgPSBxLmRlZmVyKCk7XG4gICAgY2FsbGJhY2sgPSB1dGlsLmNvbnN0cnVjdENhbGxiYWNrQW5kUHJvbWlzZUhhbmRsZXIoY2FsbGJhY2ssIGRlZmVycmVkKTtcbiAgICB2YXIgY2hhbmdlc0J5SWRlbnRzID0gY2hhbmdlc0J5SWRlbnRpZmllcnMoKTtcbiAgICB2YXIgbnVtQ2hhbmdlcyA9IF8ua2V5cyhjaGFuZ2VzQnlJZGVudHMpLmxlbmd0aDtcbiAgICBpZiAobnVtQ2hhbmdlcykge1xuICAgICAgICBpZiAoTG9nZ2VyLmRlYnVnLmlzRW5hYmxlZClcbiAgICAgICAgICAgIExvZ2dlci5kZWJ1ZygnTWVyZ2luZyAnICsgbnVtQ2hhbmdlcy50b1N0cmluZygpICsgJyBjaGFuZ2VzJyk7XG4gICAgICAgIHZhciBvcCA9IG5ldyBPcGVyYXRpb24oJ01lcmdlIENoYW5nZXMnLCBmdW5jdGlvbiAoZG9uZSkge1xuICAgICAgICAgICAgaWYgKExvZ2dlci5kZWJ1Zy5pc0VuYWJsZWQpXG4gICAgICAgICAgICAgICAgTG9nZ2VyLmRlYnVnKCdCZWdnaW5pbmcgbWVyZ2Ugb3BlcmF0aW9uJyk7XG4gICAgICAgICAgICB2YXIgaWRlbnRpZmllcnMgPSBbXTtcbiAgICAgICAgICAgIGZvciAodmFyIHByb3AgaW4gY2hhbmdlc0J5SWRlbnRzKSB7XG4gICAgICAgICAgICAgICAgaWYgKGNoYW5nZXNCeUlkZW50cy5oYXNPd25Qcm9wZXJ0eShwcm9wKSkge1xuICAgICAgICAgICAgICAgICAgICBpZGVudGlmaWVycy5wdXNoKHByb3ApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHZhciBkYiA9IHBvdWNoLmdldFBvdWNoKCk7XG4gICAgICAgICAgICBpZiAoTG9nZ2VyLmRlYnVnLmlzRW5hYmxlZClcbiAgICAgICAgICAgICAgICBMb2dnZXIuZGVidWcoJ0dldHRpbmcgZG9jcycpO1xuICAgICAgICAgICAgXy5lYWNoKGlkZW50aWZpZXJzLCBmdW5jdGlvbiAoaSkge3dhaXRpbmdGb3JPYnNlcnZhdGlvbnNbaV0gPSB7fX0pO1xuICAgICAgICAgICAgZGIuYWxsRG9jcyh7a2V5czogaWRlbnRpZmllcnMsIGluY2x1ZGVfZG9jczogdHJ1ZX0sIGZ1bmN0aW9uIChlcnIsIHJlc3ApIHtcbiAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGRvbmUoZXJyKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChMb2dnZXIuZGVidWcuaXNFbmFibGVkKVxuICAgICAgICAgICAgICAgICAgICAgICAgTG9nZ2VyLmRlYnVnKCdHb3QgZG9jcycpO1xuICAgICAgICAgICAgICAgICAgICB2YXIgYnVsa0RvY3MgPSBbXTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGVycm9ycyA9IFtdO1xuICAgICAgICAgICAgICAgICAgICBpZiAoTG9nZ2VyLmRlYnVnLmlzRW5hYmxlZClcbiAgICAgICAgICAgICAgICAgICAgICAgIExvZ2dlci5kZWJ1ZygnVXBkYXRpbmcgZG9jcyBkb2NzJyk7XG4gICAgICAgICAgICAgICAgICAgIF8uZWFjaChyZXNwLnJvd3MsIGZ1bmN0aW9uIChyb3cpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBkb2M7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAocm93LmVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHJvdy5lcnJvciA9PSAnbm90X2ZvdW5kJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkb2MgPSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBfaWQ6IHJvdy5rZXlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZXJyb3JzLnB1c2gocm93LmVycm9yKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkb2MgPSByb3cuZG9jO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGNoYW5nZSA9IGNoYW5nZXNCeUlkZW50c1tkb2MuX2lkXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIF8uZWFjaChjaGFuZ2UsIGZ1bmN0aW9uIChjKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYy5hcHBseShkb2MpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBidWxrRG9jcy5wdXNoKGRvYyk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICBpZiAoTG9nZ2VyLmRlYnVnLmlzRW5hYmxlZClcbiAgICAgICAgICAgICAgICAgICAgICAgIExvZ2dlci5kZWJ1ZygnU2F2aW5nIGRvY3MnKTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHRhc2tzID0gW107XG4gICAgICAgICAgICAgICAgICAgIHRhc2tzLnB1c2goZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoXy5rZXlzKHdhaXRpbmdGb3JPYnNlcnZhdGlvbnMpLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChMb2dnZXIuZGVidWcuaXNFbmFibGVkKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBMb2dnZXIuZGVidWcoJ3dhaXRpbmcgZm9yIG9ic2VydmF0aW9ucycpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZpbmlzaFdhaXRpbmdGb3JPYnNlcnZhdGlvbnMgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChMb2dnZXIuZGVidWcuaXNFbmFibGVkKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgTG9nZ2VyLmRlYnVnKCdmaW5pc2hlZCB3YWl0aW5nIGZvciBvYnNlcnZhdGlvbnMnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKExvZ2dlci5kZWJ1Zy5pc0VuYWJsZWQpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIExvZ2dlci5kZWJ1Zygnbm8gb2JzZXJ2YXRpb25zIHRvIHdhaXQgZm9yJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIHRhc2tzLnB1c2goZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkYi5idWxrRG9jcyhidWxrRG9jcywgZnVuY3Rpb24gKGVyLCByZXNwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXJyb3JzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZXJyb3JzLnB1c2goZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycm9ycyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoTG9nZ2VyLmRlYnVnLmlzRW5hYmxlZClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIExvZ2dlci5kZWJ1ZygnU2F2ZWQgZG9jcycsIHJlc3ApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgICAgICB1dGlsLnBhcmFsbGVsKHRhc2tzLCBkb25lKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgICAgIG9wLm9uQ29tcGxldGlvbihmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKG9wLmVycm9yKTtcbiAgICAgICAgfSk7XG4gICAgICAgIG1lcmdlUXVldWUuYWRkT3BlcmF0aW9uKG9wKTtcbiAgICB9XG4gICAgZWxzZSBpZiAoY2FsbGJhY2spIHtcbiAgICAgICAgaWYgKExvZ2dlci5kZWJ1Zy5pc0VuYWJsZWQpXG4gICAgICAgICAgICBMb2dnZXIuZGVidWcoJ05vdGhpbmcgdG8gbWVyZ2UnKTtcbiAgICAgICAgY2FsbGJhY2soKTtcbiAgICB9XG4gICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG59XG5cbi8qKlxuICogUmV0dXJucyBhbiBhcnJheSBvZiBhbGwgcGVuZGluZyB1bm1lcmdlZENoYW5nZXMuXG4gKiBAcmV0dXJucyB7QXJyYXl9XG4gKi9cbmZ1bmN0aW9uIGFsbENoYW5nZXMoKSB7XG4gICAgdmFyIGFsbENoYW5nZXMgPSBbXTtcbiAgICBmb3IgKHZhciBjb2xsZWN0aW9uTmFtZSBpbiB1bm1lcmdlZENoYW5nZXMpIHtcbiAgICAgICAgaWYgKHVubWVyZ2VkQ2hhbmdlcy5oYXNPd25Qcm9wZXJ0eShjb2xsZWN0aW9uTmFtZSkpIHtcbiAgICAgICAgICAgIHZhciBjb2xsZWN0aW9uQ2hhbmdlcyA9IHVubWVyZ2VkQ2hhbmdlc1tjb2xsZWN0aW9uTmFtZV07XG4gICAgICAgICAgICBmb3IgKHZhciBtYXBwaW5nTmFtZSBpbiBjb2xsZWN0aW9uQ2hhbmdlcykge1xuICAgICAgICAgICAgICAgIGlmIChjb2xsZWN0aW9uQ2hhbmdlcy5oYXNPd25Qcm9wZXJ0eShtYXBwaW5nTmFtZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIG1hcHBpbmdDaGFuZ2VzID0gY29sbGVjdGlvbkNoYW5nZXNbbWFwcGluZ05hbWVdO1xuICAgICAgICAgICAgICAgICAgICBmb3IgKHZhciBvYmplY3RJZCBpbiBtYXBwaW5nQ2hhbmdlcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG1hcHBpbmdDaGFuZ2VzLmhhc093blByb3BlcnR5KG9iamVjdElkKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFsbENoYW5nZXMgPSBhbGxDaGFuZ2VzLmNvbmNhdChtYXBwaW5nQ2hhbmdlc1tvYmplY3RJZF0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBhbGxDaGFuZ2VzO1xufVxuXG5mdW5jdGlvbiByZXNldENoYW5nZXMoKSB7XG4gICAgdW5tZXJnZWRDaGFuZ2VzID0ge307XG59XG5cblxuLy8gVXNlIGRlZmluZVByb3BlcnR5IHNvIHRoYXQgd2UgY2FuIGluamVjdCB1bm1lcmdlZENoYW5nZXMgZm9yIHRlc3RpbmcuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgJ2NoYW5nZXMnLCB7XG4gICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB1bm1lcmdlZENoYW5nZXM7XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uICh2KSB7XG4gICAgICAgIHVubWVyZ2VkQ2hhbmdlcyA9IHY7XG4gICAgfSxcbiAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxufSk7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCAnYWxsQ2hhbmdlcycsIHtcbiAgICBnZXQ6IGFsbENoYW5nZXMsXG4gICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICBjb25maWd1cmFibGU6IHRydWVcbn0pO1xuXG52YXIgb2xkQ29uc3RydWN0b3IgPSBTaWVzdGFNb2RlbC5wcm90b3R5cGUuY29uc3RydWN0b3I7XG5cbmZ1bmN0aW9uIF9TaWVzdGFNb2RlbChtYXBwaW5nKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIG9sZENvbnN0cnVjdG9yLmNhbGwodGhpcywgbWFwcGluZyk7XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsICdjaGFuZ2VzJywge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiBjaGFuZ2VzRm9ySWRlbnRpZmllcih0aGlzLl9pZCk7XG4gICAgICAgIH0sXG4gICAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICB9KTtcbn1cblxuX1NpZXN0YU1vZGVsLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoU2llc3RhTW9kZWwucHJvdG90eXBlKTtcblxuX1NpZXN0YU1vZGVsLnByb3RvdHlwZS5hcHBseUNoYW5nZXMgPSBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKHRoaXMuX2lkKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgXy5lYWNoKHRoaXMuY2hhbmdlcywgZnVuY3Rpb24gKGMpIHtcbiAgICAgICAgICAgIGMuYXBwbHkoc2VsZik7XG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ0Nhbm5vdCBhcHBseSBjaGFuZ2VzIHRvIG9iamVjdCB3aXRoIG5vIF9pZCcpO1xuICAgIH1cbn07XG5cblNpZXN0YU1vZGVsLnByb3RvdHlwZSA9IG5ldyBfU2llc3RhTW9kZWwoKTtcblxuLy9ub2luc3BlY3Rpb24gSlNWYWxpZGF0ZVR5cGVzXG5cbmV4cG9ydHMuX1NpZXN0YU1vZGVsID0gX1NpZXN0YU1vZGVsO1xuZXhwb3J0cy5yZWdpc3RlckNoYW5nZSA9IGNvcmVDaGFuZ2VzLnJlZ2lzdGVyQ2hhbmdlO1xuZXhwb3J0cy5tZXJnZUNoYW5nZXMgPSBtZXJnZUNoYW5nZXM7XG5leHBvcnRzLmNoYW5nZXNGb3JJZGVudGlmaWVyID0gY2hhbmdlc0ZvcklkZW50aWZpZXI7XG5leHBvcnRzLnJlc2V0Q2hhbmdlcyA9IHJlc2V0Q2hhbmdlczsiLCJ2YXIgX2kgPSBzaWVzdGEuX2ludGVybmFsXG4gICAgLCBJbnRlcm5hbFNpZXN0YUVycm9yID0gX2kuZXJyb3IuSW50ZXJuYWxTaWVzdGFFcnJvclxuICAgICwgbWFwcGluZyA9IF9pLm1hcHBpbmdcbiAgICAsIGxvZyA9IF9pLmxvZ1xuICAgICwgdXRpbCA9IF9pLnV0aWxcbiAgICAsIHEgPSBfaS5xXG4gICAgLCBfID0gdXRpbC5fXG4gICAgO1xuXG52YXIgUG91Y2ggPSByZXF1aXJlKCcuL3BvdWNoJyk7XG5cbnZhciBMb2dnZXIgPSBsb2cubG9nZ2VyV2l0aE5hbWUoJ0luZGV4Jyk7XG5Mb2dnZXIuc2V0TGV2ZWwobG9nLkxldmVsLndhcm4pO1xuXG5mdW5jdGlvbiBjb21iaW5lKGEsIG1pbikge1xuICAgIHZhciBmbiA9IGZ1bmN0aW9uIChuLCBzcmMsIGdvdCwgYWxsKSB7XG4gICAgICAgIGlmIChuID09IDApIHtcbiAgICAgICAgICAgIGlmIChnb3QubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgIGFsbFthbGwubGVuZ3RoXSA9IGdvdDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBmb3IgKHZhciBqID0gMDsgaiA8IHNyYy5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgZm4obiAtIDEsIHNyYy5zbGljZShqICsgMSksIGdvdC5jb25jYXQoW3NyY1tqXV0pLCBhbGwpO1xuICAgICAgICB9XG4gICAgfTtcbiAgICB2YXIgYWxsID0gW107XG4gICAgZm9yICh2YXIgaSA9IG1pbjsgaSA8IGEubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgZm4oaSwgYSwgW10sIGFsbCk7XG4gICAgfVxuICAgIGFsbC5wdXNoKGEpO1xuICAgIHJldHVybiBhbGw7XG59XG5cbmZ1bmN0aW9uIGdldEZpZWxkQ29tYmluYXRpb25zKGZpZWxkcykge1xuICAgIHZhciBjb21iaW5hdGlvbnMgPSBjb21iaW5lKGZpZWxkcywgMSk7XG4gICAgY29tYmluYXRpb25zLnB1c2goW10pO1xuICAgIHJldHVybiAgY29tYmluYXRpb25zO1xufVxuXG5mdW5jdGlvbiBjb25zdHJ1Y3RJbmRleGVzKGNvbGxlY3Rpb24sIG1vZGVsTmFtZSwgZmllbGRzKSB7XG4gICAgdmFyIGNvbWJpbmF0aW9ucyA9IGdldEZpZWxkQ29tYmluYXRpb25zKGZpZWxkcyk7XG4gICAgcmV0dXJuIF8ubWFwKGNvbWJpbmF0aW9ucywgZnVuY3Rpb24gKGZpZWxkcykge1xuICAgICAgICByZXR1cm4gbmV3IEluZGV4KGNvbGxlY3Rpb24sIG1vZGVsTmFtZSwgZmllbGRzKTtcbiAgICB9KTtcbn1cblxuZnVuY3Rpb24gaW5zdGFsbEluZGV4ZXMoY29sbGVjdGlvbiwgbW9kZWxOYW1lLCBmaWVsZHMsIGNhbGxiYWNrKSB7XG4gICAgdmFyIGRlZmVycmVkID0gcS5kZWZlcigpO1xuICAgIGNhbGxiYWNrID0gdXRpbC5jb25zdHJ1Y3RDYWxsYmFja0FuZFByb21pc2VIYW5kbGVyKGNhbGxiYWNrLCBkZWZlcnJlZCk7XG4gICAgdmFyIGluZGV4ZXMgPSBjb25zdHJ1Y3RJbmRleGVzKGNvbGxlY3Rpb24sIG1vZGVsTmFtZSwgZmllbGRzKTtcbiAgICB2YXIgbnVtQ29tcGxldGVkID0gMDtcbiAgICB2YXIgZXJyb3JzID0gW107XG4gICAgXy5lYWNoKGluZGV4ZXMsIGZ1bmN0aW9uIChpbmRleCkge1xuICAgICAgICBpbmRleC5pbnN0YWxsKGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICBlcnJvcnMucHVzaChlcnIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbnVtQ29tcGxldGVkKys7XG4gICAgICAgICAgICBpZiAobnVtQ29tcGxldGVkID09IGluZGV4ZXMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgaWYgKExvZ2dlci5pbmZvLmlzRW5hYmxlZClcbiAgICAgICAgICAgICAgICAgICAgTG9nZ2VyLmluZm8oJ1N1Y2Nlc3NmdWxseSBpbnN0YWxsZWQgYWxsIGluZGV4ZXMnKTtcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnJvcnMubGVuZ3RoID8gZXJyb3JzIDogbnVsbCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH0pO1xuICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xufVxuXG5cbmZ1bmN0aW9uIEluZGV4KGNvbGxlY3Rpb24sIHR5cGUsIGZpZWxkc19vcl9maWVsZCkge1xuICAgIHRoaXMudHlwZSA9IHR5cGU7XG4gICAgdGhpcy5jb2xsZWN0aW9uID0gY29sbGVjdGlvbjtcbiAgICBpZiAoZmllbGRzX29yX2ZpZWxkKSB7XG4gICAgICAgIGlmIChmaWVsZHNfb3JfZmllbGQubGVuZ3RoKSB7XG4gICAgICAgICAgICB0aGlzLmZpZWxkcyA9IF8uc29ydEJ5KGZpZWxkc19vcl9maWVsZCwgZnVuY3Rpb24gKHgpIHtyZXR1cm4geH0pO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5maWVsZHMgPSBbZmllbGRzX29yX2ZpZWxkXTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgdGhpcy5maWVsZHMgPSBbXTtcbiAgICB9XG59XG5cbkluZGV4LnByb3RvdHlwZS5fZ2V0RGVzaWduRG9jTmFtZSA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgbmFtZSA9IHRoaXMuX2dldE5hbWUoKTtcbiAgICByZXR1cm4gJ19kZXNpZ24vJyArIG5hbWU7XG59O1xuXG4vKipcbiAqIFJldHVybiBhIFBvdWNoREIgc2Vjb25kYXJ5IGluZGV4LlxuICogU2VlIGh0dHA6Ly9wb3VjaGRiLmNvbS8yMDE0LzA1LzAxL3NlY29uZGFyeS1pbmRleGVzLWhhdmUtbGFuZGVkLWluLXBvdWNoZGIuaHRtbFxuICogQHByaXZhdGVcbiAqL1xuSW5kZXgucHJvdG90eXBlLl9jb25zdHJ1Y3RQb3VjaERiVmlldyA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgbmFtZSA9IHRoaXMuX2dldE5hbWUoKTtcbiAgICB2YXIgaW5kZXggPSB7XG4gICAgICAgIF9pZDogdGhpcy5fZ2V0RGVzaWduRG9jTmFtZSgpLFxuICAgICAgICB2aWV3czoge31cbiAgICB9O1xuICAgIGluZGV4LnZpZXdzW25hbWVdID0ge1xuICAgICAgICBtYXA6IHRoaXMuX2NvbnN0cnVjdE1hcEZ1bmN0aW9uKClcbiAgICB9O1xuICAgIHJldHVybiAgaW5kZXhcbn07XG5cbkluZGV4LnByb3RvdHlwZS5fY29uc3RydWN0TWFwRnVuY3Rpb24gPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5fdmFsaWRhdGUoKTtcbiAgICB2YXIgZmllbGRzID0gdGhpcy5maWVsZHM7XG4gICAgdmFyIHR5cGUgPSB0aGlzLnR5cGU7XG4gICAgdmFyIGNvbGxlY3Rpb24gPSB0aGlzLmNvbGxlY3Rpb247XG4gICAgcmV0dXJuIG1hcHBpbmcuY29uc3RydWN0TWFwRnVuY3Rpb24oY29sbGVjdGlvbiwgdHlwZSwgZmllbGRzKTtcbn07XG5cbkluZGV4LnByb3RvdHlwZS5fdmFsaWRhdGUgPSBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKCF0aGlzLnR5cGUpIHtcbiAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ1R5cGUgbXVzdCBiZSBzcGVjaWZpZWQgaW4gb3JkZXIgdG8gY29uc3RydWN0IGluZGV4IG1hcCBmdW5jdGlvbi4nLCB7aW5kZXg6IHRoaXN9KTtcbiAgICB9XG4gICAgaWYgKCF0aGlzLmNvbGxlY3Rpb24pIHtcbiAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ0FQSSBtdXN0IGJlIHNwZWNpZmllZCBpbiBvcmRlciB0byBjb25zdHJ1Y3QgaW5kZXggbWFwIGZ1bmN0aW9uLicsIHtpbmRleDogdGhpc30pO1xuICAgIH1cbn07XG5cbkluZGV4LnByb3RvdHlwZS5fZHVtcCA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdGhpcy5fZ2V0TmFtZSgpO1xufTtcblxuSW5kZXgucHJvdG90eXBlLl9nZXROYW1lID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuX3ZhbGlkYXRlKCk7XG4gICAgdmFyIGFwcGVuZGl4ID0gXy5yZWR1Y2UodGhpcy5maWVsZHMsIGZ1bmN0aW9uIChtZW1vLCBmaWVsZCkge3JldHVybiBtZW1vICsgJ18nICsgZmllbGR9LCAnJyk7XG4gICAgcmV0dXJuIHRoaXMuY29sbGVjdGlvbiArICdfJyArICdJbmRleF8nICsgdGhpcy50eXBlICsgYXBwZW5kaXg7XG59O1xuXG5JbmRleC5wcm90b3R5cGUuaW5zdGFsbCA9IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgIHZhciBkZWZlcnJlZCA9IHEuZGVmZXIoKTtcbiAgICBjYWxsYmFjayA9IHV0aWwuY29uc3RydWN0Q2FsbGJhY2tBbmRQcm9taXNlSGFuZGxlcihjYWxsYmFjaywgZGVmZXJyZWQpO1xuICAgIHRoaXMuX3ZhbGlkYXRlKCk7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciBjb25zdHJ1Y3RQb3VjaERiVmlldyA9IHRoaXMuX2NvbnN0cnVjdFBvdWNoRGJWaWV3KCk7XG4gICAgdmFyIGluZGV4TmFtZSA9IHRoaXMuX2dldE5hbWUoKTtcbiAgICBpZiAoTG9nZ2VyLmRlYnVnLmlzRW5hYmxlZClcbiAgICAgICAgTG9nZ2VyLmRlYnVnKCdJbnN0YWxsaW5nIEluZGV4OiAnICsgaW5kZXhOYW1lLCBjb25zdHJ1Y3RQb3VjaERiVmlldyk7XG4gICAgUG91Y2guZ2V0UG91Y2goKS5wdXQoY29uc3RydWN0UG91Y2hEYlZpZXcsIGZ1bmN0aW9uIChlcnIsIHJlc3ApIHtcbiAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgaWYgKGVyci5zdGF0dXMgPT09IDQwOSkge1xuICAgICAgICAgICAgICAgIGlmIChMb2dnZXIuZGVidWcuaXNFbmFibGVkKVxuICAgICAgICAgICAgICAgICAgICBMb2dnZXIuZGVidWcoaW5kZXhOYW1lICsgJyBhbHJlYWR5IGluc3RhbGxlZCcpO1xuICAgICAgICAgICAgICAgIGVyciA9IG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFlcnIgJiYgSW5kZXguaW5kZXhlcy5pbmRleE9mKHNlbGYpIDwgMCkge1xuICAgICAgICAgICAgSW5kZXguaW5kZXhlcy5wdXNoKHNlbGYpO1xuICAgICAgICB9XG4gICAgICAgIGNhbGxiYWNrKGVyciwgcmVzcCk7XG4gICAgfSk7XG4gICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG59O1xuXG5JbmRleC5pbmRleGVzID0gW107XG5cbmV4cG9ydHMuSW5kZXggPSBJbmRleDtcbmV4cG9ydHMuX2NvbnN0cnVjdEluZGV4ZXMgPSBjb25zdHJ1Y3RJbmRleGVzO1xuZXhwb3J0cy5fZ2V0RmllbGRDb21iaW5hdGlvbnMgPSBnZXRGaWVsZENvbWJpbmF0aW9ucztcbmV4cG9ydHMuaW5zdGFsbEluZGV4ZXMgPSBpbnN0YWxsSW5kZXhlcztcblxuZXhwb3J0cy5jbGVhckluZGV4ZXMgPSBmdW5jdGlvbiAoKSB7XG4gICAgSW5kZXguaW5kZXhlcyA9IFtdO1xufTsiLCJ2YXIgX2kgPSBzaWVzdGEuX2ludGVybmFsXG4gICAgLCBsb2cgPSBfaS5sb2dcbiAgICAsIHV0aWwgPSBfaS51dGlsXG4gICAgLCBfID0gdXRpbC5fXG4gICAgLCBjYWNoZSA9IF9pLmNhY2hlXG4gICAgLCBndWlkID0gX2kubWlzYy5ndWlkXG4gICAgLCBJbnRlcm5hbFNpZXN0YUVycm9yID0gX2kuZXJyb3IuSW50ZXJuYWxTaWVzdGFFcnJvclxuICAgICwgcSA9IF9pLnFcbiAgICAsIENvbGxlY3Rpb25SZWdpc3RyeSA9IF9pLkNvbGxlY3Rpb25SZWdpc3RyeTtcblxudmFyIExvZ2dlciA9IGxvZy5sb2dnZXJXaXRoTmFtZSgnUG91Y2gnKTtcbkxvZ2dlci5zZXRMZXZlbChsb2cuTGV2ZWwud2Fybik7XG5cbnZhciBwb3VjaCA9IG5ldyBQb3VjaERCKCdzaWVzdGEnKTtcblxudmFyIGNoYW5nZUVtaXR0ZXI7XG52YXIgY2hhbmdlT2JzZXJ2ZXJzID0gW107XG5cbmNvbmZpZ3VyZUNoYW5nZUVtaXR0ZXIoKTtcblxudmFyIFBPVUNIX0VWRU5UID0gJ2NoYW5nZSc7XG5cbmZ1bmN0aW9uIHJldHJ5VW50aWxXcml0dGVuTXVsdGlwbGUoZG9jSWQsIG5ld1ZhbHVlcywgY2FsbGJhY2spIHtcbiAgICB2YXIgZGVmZXJyZWQgPSBxLmRlZmVyKCk7XG4gICAgY2FsbGJhY2sgPSB1dGlsLmNvbnN0cnVjdENhbGxiYWNrQW5kUHJvbWlzZUhhbmRsZXIoY2FsbGJhY2ssIGRlZmVycmVkKTtcbiAgICBnZXRQb3VjaCgpLmdldChkb2NJZCwgZnVuY3Rpb24gKGVyciwgZG9jKSB7XG4gICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgIHZhciBtc2cgPSAnVW5hYmxlIHRvIGdldCBkb2Mgd2l0aCBfaWQ9XCInICsgZG9jSWQgKyAnXCIuIFRoaXMgaXMgYSBzZXJpb3VzIGVycm9yIGFuZCBtZWFucyB0aGF0ICcgK1xuICAgICAgICAgICAgICAgICdhIGxpdmUgb2JqZWN0IGlzIG5vdyBvdXQgb2Ygc3luYyB3aXRoIFBvdWNoREIuJztcbiAgICAgICAgICAgIExvZ2dlci5lcnJvcihtc2cpO1xuICAgICAgICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhlcnIpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgZm9yICh2YXIga2V5IGluIG5ld1ZhbHVlcykge1xuICAgICAgICAgICAgICAgIGlmIChuZXdWYWx1ZXMuaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgICAgICAgICAgICAgICBkb2Nba2V5XSA9IG5ld1ZhbHVlc1trZXldO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGdldFBvdWNoKCkucHV0KGRvYywgZnVuY3Rpb24gKGVyciwgcmVzcCkge1xuICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGVyci5zdGF0dXMgPT0gNDA5KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXRyeVVudGlsV3JpdHRlbk11bHRpcGxlKGRvY0lkLCBuZXdWYWx1ZXMpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG1zZyA9ICdVbmFibGUgdG8gdXBkYXRlIGRvYyB3aXRoIF9pZD1cIicgKyBkb2NJZCArICdcIi4gVGhpcyBpcyBhIHNlcmlvdXMgZXJyb3IgYW5kIG1lYW5zIHRoYXQgJyArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJ2EgbGl2ZSBvYmplY3QgaXMgbm93IG91dCBvZiBzeW5jIHdpdGggUG91Y2hEQi4nO1xuICAgICAgICAgICAgICAgICAgICAgICAgTG9nZ2VyLmVycm9yKG1zZyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKVxuICAgICAgICAgICAgICAgICAgICAgICAgTG9nZ2VyLnRyYWNlKCdTdWNjZXNzZnVsbHkgcGVyc2lzdGVkIHVubWVyZ2VkQ2hhbmdlczogJyArIEpTT04uc3RyaW5naWZ5KHtkb2M6IGRvYy5faWQsIHBvdWNoREJSZXNwb25zZTogcmVzcCwgY2hhbmdlczogbmV3VmFsdWVzfSwgbnVsbCwgNCkpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKG51bGwsIHJlc3AucmV2KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xufVxuXG5mdW5jdGlvbiBjb25maWd1cmVDaGFuZ2VFbWl0dGVyKCkge1xuICAgIGlmIChjaGFuZ2VFbWl0dGVyKSB7XG4gICAgICAgIGNoYW5nZUVtaXR0ZXIuY2FuY2VsKCk7XG4gICAgfVxuXG4gICAgY2hhbmdlRW1pdHRlciA9IHBvdWNoLmNoYW5nZXMoe1xuICAgICAgICBzaW5jZTogJ25vdycsXG4gICAgICAgIGxpdmU6IHRydWVcbiAgICB9KTtcblxuICAgIF8uZWFjaChjaGFuZ2VPYnNlcnZlcnMsIGZ1bmN0aW9uIChvKSB7XG4gICAgICAgIGNoYW5nZUVtaXR0ZXIub24oUE9VQ0hfRVZFTlQsIG8pO1xuICAgIH0pO1xufVxuXG5mdW5jdGlvbiBfcmVzZXQoaW5NZW1vcnkpIHtcbiAgICB2YXIgZGJOYW1lID0gZ3VpZCgpO1xuICAgIGlmIChpbk1lbW9yeSkge1xuICAgICAgICBpZiAodHlwZW9mIHdpbmRvdyAhPSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgcG91Y2ggPSBuZXcgUG91Y2hEQignc2llc3RhLScgKyBkYk5hbWUsIHthZGFwdGVyOiAnbWVtb3J5J30pO1xuICAgICAgICAgICAgY29uZmlndXJlQ2hhbmdlRW1pdHRlcigpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgJ255aSc7XG4gICAgICAgIH1cbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIHRocm93ICdPbmx5IGluIG1lbW9yeSBwb3VjaERCIHN1cHBvcnRlZCBhdG0nO1xuLy8gICAgICAgIHBvdWNoID0gbmV3IFBvdWNoREIoZGJOYW1lKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIHJlc2V0KGluTWVtb3J5LCBjYWxsYmFjaykge1xuICAgIHZhciBkZWZlcnJlZCA9IHEuZGVmZXIoKTtcbiAgICBjYWxsYmFjayA9IHV0aWwuY29uc3RydWN0Q2FsbGJhY2tBbmRQcm9taXNlSGFuZGxlcihjYWxsYmFjaywgZGVmZXJyZWQpO1xuICAgIGlmIChwb3VjaCkge1xuICAgICAgICBwb3VjaC5kZXN0cm95KCk7XG4gICAgfVxuICAgIF9yZXNldChpbk1lbW9yeSk7XG4gICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjaygpO1xuICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xufVxuXG5mdW5jdGlvbiBnZXRQb3VjaCgpIHtcbiAgICByZXR1cm4gcG91Y2g7XG59XG5cbmZ1bmN0aW9uIHZhbGlkYXRlKGRvYykge1xuICAgIHZhciBjb2xsZWN0aW9uTmFtZSA9IGRvYy5jb2xsZWN0aW9uO1xuICAgIGlmIChjb2xsZWN0aW9uTmFtZSkge1xuICAgICAgICB2YXIgY29sbGVjdGlvbiA9IENvbGxlY3Rpb25SZWdpc3RyeVtjb2xsZWN0aW9uTmFtZV07XG4gICAgICAgIGlmIChjb2xsZWN0aW9uKSB7XG4gICAgICAgICAgICB2YXIgbWFwcGluZ1R5cGUgPSBkb2MudHlwZTtcbiAgICAgICAgICAgIGlmIChtYXBwaW5nVHlwZSkge1xuICAgICAgICAgICAgICAgIHZhciBtYXBwaW5nID0gY29sbGVjdGlvblttYXBwaW5nVHlwZV07XG4gICAgICAgICAgICAgICAgaWYgKG1hcHBpbmcpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG1hcHBpbmc7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignQ2Fubm90IGNvbnZlcnQgUG91Y2hEQiBkb2N1bWVudCBpbnRvIFNpZXN0YU1vZGVsLiAnICtcbiAgICAgICAgICAgICAgICAgICAgICAgICdObyBtYXBwaW5nIHdpdGggdHlwZSAnICsgbWFwcGluZ1R5cGUudG9TdHJpbmcoKSwge2RvYzogZG9jfSlcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignQ2Fubm90IGNvbnZlcnQgUG91Y2hEQiBkb2N1bWVudCBpbnRvIFNpZXN0YU1vZGVsLiAnICtcbiAgICAgICAgICAgICAgICAgICAgJ05vIHR5cGUgZmllbGQgd2l0aGluIGRvY3VtZW50Jywge2RvYzogZG9jfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignQ2Fubm90IGNvbnZlcnQgUG91Y2hEQiBkb2N1bWVudCBpbnRvIFNpZXN0YU1vZGVsLiAnICtcbiAgICAgICAgICAgICAgICAnQVBJIFwiJyArIGNvbGxlY3Rpb25OYW1lLnRvU3RyaW5nKCkgKyAnXCIgZG9lc250IGV4aXN0LicsIHtkb2M6IGRvY30pO1xuICAgICAgICB9XG5cbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdDYW5ub3QgY29udmVydCBQb3VjaERCIGRvY3VtZW50IGludG8gU2llc3RhTW9kZWwuICcgK1xuICAgICAgICAgICAgJ05vIGNvbGxlY3Rpb24gZmllbGQgd2l0aGluIGRvY3VtZW50Jywge2RvYzogZG9jfSk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiB0b05ldyhkb2MpIHtcbiAgICB2YXIgbWFwcGluZyA9IHZhbGlkYXRlKGRvYyk7XG4gICAgdmFyIG9iaiA9IG1hcHBpbmcuX25ldyh7X2lkOiBkb2MuX2lkfSk7XG4vLyAgICBvYmouX2lkID0gZG9jLl9pZDtcbiAgICBvYmouX3JldiA9IGRvYy5fcmV2O1xuICAgIG9iai5pc1NhdmVkID0gdHJ1ZTtcbiAgICBmb3IgKHZhciBwcm9wIGluIGRvYykge1xuICAgICAgICBpZiAoZG9jLmhhc093blByb3BlcnR5KHByb3ApKSB7XG4gICAgICAgICAgICBpZiAob2JqLl9maWVsZHMuaW5kZXhPZihwcm9wKSA+IC0xKSB7XG4gICAgICAgICAgICAgICAgb2JqLl9fdmFsdWVzW3Byb3BdID0gZG9jW3Byb3BdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAob2JqLl9yZWxhdGlvbnNoaXBGaWVsZHMuaW5kZXhPZihwcm9wKSA+IC0xKSB7XG4gICAgICAgICAgICAgICAgb2JqW3Byb3AgKyAnUHJveHknXS5faWQgPSBkb2NbcHJvcF07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG9iajtcbn1cblxuZnVuY3Rpb24gdG9TaWVzdGEoZG9jcykge1xuICAgIGlmIChMb2dnZXIuZGVidWcuaXNFbmFibGVkKSBMb2dnZXIuZGVidWcoJ3RvU2llc3RhJyk7XG4gICAgdmFyIG1hcHBlZCA9IFtdO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgZG9jcy5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgZG9jID0gZG9jc1tpXTtcbiAgICAgICAgaWYgKGRvYykge1xuICAgICAgICAgICAgdmFyIG9wdHMgPSB7X2lkOiBkb2MuX2lkfTtcbiAgICAgICAgICAgIHZhciB0eXBlID0gZG9jLnR5cGU7XG4gICAgICAgICAgICB2YXIgY29sbGVjdGlvbiA9IGRvYy5jb2xsZWN0aW9uO1xuICAgICAgICAgICAgdmFyIG1hcHBpbmcgPSBDb2xsZWN0aW9uUmVnaXN0cnlbY29sbGVjdGlvbl1bdHlwZV07XG4gICAgICAgICAgICBpZiAobWFwcGluZy5pZCkge1xuICAgICAgICAgICAgICAgIG9wdHNbbWFwcGluZy5pZF0gPSBkb2NbbWFwcGluZy5pZF07XG4gICAgICAgICAgICAgICAgb3B0cy5tYXBwaW5nID0gbWFwcGluZztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHZhciBjYWNoZWQgPSBjYWNoZS5nZXQob3B0cyk7XG4gICAgICAgICAgICBpZiAoY2FjaGVkKSB7XG4gICAgICAgICAgICAgICAgbWFwcGVkW2ldID0gY2FjaGVkO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgbWFwcGVkW2ldID0gdG9OZXcoZG9jKTtcbiAgICAgICAgICAgICAgICBjYWNoZS5pbnNlcnQobWFwcGVkW2ldKTtcbiAgICAgICAgICAgICAgICBtYXBwZWRbaV0uYXBwbHlDaGFuZ2VzKCk7ICAvLyBBcHBseSB1bnNhdmVkIGNoYW5nZXMuXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBtYXBwZWRbaV0gPSBudWxsO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBtYXBwZWQ7XG59XG5cbmZ1bmN0aW9uIGZyb20ob2JqKSB7XG4gICAgaWYgKExvZ2dlci50cmFjZS5pc0VuYWJsZWQpXG4gICAgICAgIExvZ2dlci50cmFjZSgnZnJvbScsIHtvYmo6IG9ian0pO1xuICAgIHZhciBtYXBwaW5nID0gb2JqLm1hcHBpbmc7XG4gICAgdmFyIGFkYXB0ZWQgPSB7fTtcbiAgICBfLmVhY2gobWFwcGluZy5fZmllbGRzLCBmdW5jdGlvbiAoZikge1xuICAgICAgICBpZiAoTG9nZ2VyLnRyYWNlLmlzRW5hYmxlZClcbiAgICAgICAgICAgIExvZ2dlci50cmFjZSgnZmllbGQnLCBmKTtcbiAgICAgICAgdmFyIHYgPSBvYmpbZl07XG4gICAgICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKVxuICAgICAgICAgICAgTG9nZ2VyLnRyYWNlKGYgKyAnPScsIHYpO1xuICAgICAgICBpZiAodikge1xuICAgICAgICAgICAgYWRhcHRlZFtmXSA9IHY7XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBfLmVhY2gob2JqLl9wcm94aWVzLCBmdW5jdGlvbiAocCkge1xuICAgICAgICAvLyBPbmx5IGZvcndhcmQgcmVsYXRpb25zaGlwcyBhcmUgc3RvcmVkIGluIHRoZSBkYXRhYmFzZS5cbiAgICAgICAgaWYgKHAuaXNGb3J3YXJkKSB7XG4gICAgICAgICAgICB2YXIgbmFtZSA9IHAuZm9yd2FyZE5hbWU7XG4gICAgICAgICAgICBpZiAocC5faWQpIHtcbiAgICAgICAgICAgICAgICBhZGFwdGVkW25hbWVdID0gcC5faWQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBhZGFwdGVkLl9pZCA9IG9iai5faWQ7XG4gICAgYWRhcHRlZC5fcmV2ID0gb2JqLl9yZXY7XG4gICAgYWRhcHRlZC50eXBlID0gb2JqLm1hcHBpbmcudHlwZTtcbiAgICBhZGFwdGVkLmNvbGxlY3Rpb24gPSBvYmouY29sbGVjdGlvbjtcbiAgICByZXR1cm4gYWRhcHRlZDtcbn1cblxuZXhwb3J0cy50b05ldyA9IHRvTmV3O1xuZXhwb3J0cy5fdmFsaWRhdGUgPSB2YWxpZGF0ZTtcbmV4cG9ydHMuZnJvbSA9IGZyb207XG5leHBvcnRzLnRvU2llc3RhID0gdG9TaWVzdGE7XG5leHBvcnRzLnJldHJ5VW50aWxXcml0dGVuTXVsdGlwbGUgPSByZXRyeVVudGlsV3JpdHRlbk11bHRpcGxlO1xuZXhwb3J0cy5yZXNldCA9IHJlc2V0O1xuZXhwb3J0cy5nZXRQb3VjaCA9IGdldFBvdWNoO1xuZXhwb3J0cy5zZXRQb3VjaCA9IGZ1bmN0aW9uIChfcCkge1xuICAgIHBvdWNoID0gX3A7XG4gICAgY29uZmlndXJlQ2hhbmdlRW1pdHRlcigpO1xufTtcblxuZXhwb3J0cy5hZGRPYnNlcnZlciA9IGZ1bmN0aW9uIChvKSB7XG4gICAgaWYgKExvZ2dlci5kZWJ1Zy5pc0VuYWJsZWQpIExvZ2dlci5kZWJ1ZygnQWRkaW5nIG9ic2VydmVyJywgbyk7XG4gICAgY2hhbmdlT2JzZXJ2ZXJzLnB1c2gobyk7XG4gICAgaWYgKGNoYW5nZUVtaXR0ZXIpIGNoYW5nZUVtaXR0ZXIub24oUE9VQ0hfRVZFTlQsIG8pO1xufTtcblxuZXhwb3J0cy5yZW1vdmVPYnNlcnZlciA9IGZ1bmN0aW9uIChvKSB7XG4gICAgdmFyIGlkeCA9IGNoYW5nZU9ic2VydmVycy5pbmRleE9mKG8pO1xuICAgIGlmIChpZHggPiAtMSkge1xuICAgICAgICBpZiAoY2hhbmdlRW1pdHRlcikgY2hhbmdlRW1pdHRlci5yZW1vdmVMaXN0ZW5lcihQT1VDSF9FVkVOVCwgbyk7XG4gICAgICAgIGNoYW5nZU9ic2VydmVycy5zcGxpY2UoaWR4LCAxKTtcbiAgICB9XG59OyIsInZhciBfaSA9IHNpZXN0YS5faW50ZXJuYWxcbiAgICAsIG1hcHBpbmcgPSBfaS5tYXBwaW5nXG4gICAgLCB1dGlscyA9IF9pLnV0aWxzXG4gICAgLCB1dGlsID0gX2kudXRpbHNcbiAgICAsIF8gPSB1dGlscy5fXG4gICAgLCBsb2cgPSBfaS5sb2dcbiAgICAsIEludGVybmFsU2llc3RhRXJyb3IgPSBfaS5lcnJvci5JbnRlcm5hbFNpZXN0YUVycm9yXG4gICAgLCBRdWVyeSA9IF9pLnF1ZXJ5LlF1ZXJ5XG4gICAgLCBxID0gX2kucVxuO1xuXG52YXIgTG9nZ2VyID0gbG9nLmxvZ2dlcldpdGhOYW1lKCdSYXdRdWVyeScpO1xuTG9nZ2VyLnNldExldmVsKGxvZy5MZXZlbC53YXJuKTtcblxudmFyIFBvdWNoID0gcmVxdWlyZSgnLi9wb3VjaCcpXG4gICAgLCBpbmRleCA9IHJlcXVpcmUoJy4vaW5kZXgnKVxuICAgICwgSW5kZXggPSBpbmRleC5JbmRleFxuICAgIDtcblxuZnVuY3Rpb24gUmF3UXVlcnkoY29sbGVjdGlvbiwgbW9kZWxOYW1lLCBxdWVyeSkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB0aGlzLmNvbGxlY3Rpb24gPSBjb2xsZWN0aW9uO1xuICAgIHRoaXMubW9kZWxOYW1lID0gbW9kZWxOYW1lO1xuICAgIHRoaXMucXVlcnkgPSBxdWVyeTtcblxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShzZWxmLCAnbWFwcGluZycsIHtcbiAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHZhciBjb2xsZWN0aW9uID0gcmVxdWlyZSgnLi9pbmRleCcpW3NlbGYuY29sbGVjdGlvbl07XG4gICAgICAgICAgICBpZiAoY29sbGVjdGlvbikge1xuICAgICAgICAgICAgICAgIHJldHVybiBjb2xsZWN0aW9uW3NlbGYubW9kZWxOYW1lXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgfSk7XG59XG5cbmZ1bmN0aW9uIHJlc3VsdHNDYWxsYmFjayhjYWxsYmFjaywgZXJyLCByZXNwKSB7XG4gICAgdmFyIGRlZmVycmVkID0gcS5kZWZlcigpO1xuICAgIGNhbGxiYWNrID0gdXRpbC5jb25zdHJ1Y3RDYWxsYmFja0FuZFByb21pc2VIYW5kbGVyKGNhbGxiYWNrLCBkZWZlcnJlZCk7XG4gICAgaWYgKGVycikge1xuICAgICAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKGVycik7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICB2YXIgcmVzdWx0cyA9IF8ucGx1Y2socmVzcC5yb3dzLCAndmFsdWUnKTtcbiAgICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhudWxsLCByZXN1bHRzKTtcbiAgICB9XG4gICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG59XG5cblJhd1F1ZXJ5LnByb3RvdHlwZS5leGVjdXRlID0gZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgdmFyIGRlZmVycmVkID0gcS5kZWZlcigpO1xuICAgIGNhbGxiYWNrID0gdXRpbC5jb25zdHJ1Y3RDYWxsYmFja0FuZFByb21pc2VIYW5kbGVyKGNhbGxiYWNrLCBkZWZlcnJlZCk7XG4gICAgaWYgKHRoaXMubWFwcGluZykgeyAvLyBEdXJpbmcgdW5pdCB0ZXN0aW5nLCB3ZSBkb24ndCBwb3B1bGF0ZSB0aGlzLm1hcHBpbmcsIGJ1dCByYXRoZXIgY29uZmlndXJlIFBvdWNoIG1hbnVhbGx5LlxuICAgICAgICBpZiAoIXRoaXMubWFwcGluZy5pbnN0YWxsZWQpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdNYXBwaW5nIG11c3QgYmUgaW5zdGFsbGVkJyk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciBkZXNpZ25Eb2NJZCA9IHRoaXMuX2dldERlc2lnbkRvY05hbWUoKTtcbiAgICB2YXIgaW5kZXhOYW1lID0gc2VsZi5fZ2V0SW5kZXhOYW1lKCk7XG4gICAgUG91Y2guZ2V0UG91Y2goKS5nZXQoZGVzaWduRG9jSWQsIGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgdmFyIHBhcnRpYWxDYWxsYmFjayA9IF8ucGFydGlhbChyZXN1bHRzQ2FsbGJhY2ssIGNhbGxiYWNrKTtcblxuICAgICAgICBmdW5jdGlvbiBmaW5pc2goZXJyLCBkb2NzKSB7XG4gICAgICAgICAgICBpZiAoTG9nZ2VyLnRyYWNlLmlzRW5hYmxlZClcbiAgICAgICAgICAgICAgICBMb2dnZXIudHJhY2UoJ1JlY2VpdmVkIHJlc3VsdHM6ICcsIGRvY3MpO1xuICAgICAgICAgICAgcGFydGlhbENhbGxiYWNrKGVyciwgZG9jcyk7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIga2V5O1xuICAgICAgICBpZiAoIWVycikge1xuICAgICAgICAgICAga2V5ID0gc2VsZi5fY29uc3RydWN0S2V5KCk7XG4gICAgICAgICAgICBpZiAoIWtleS5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICBrZXkgPSBzZWxmLm1vZGVsTmFtZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChMb2dnZXIuZGVidWcuaXNFbmFibGVkKVxuICAgICAgICAgICAgICAgIExvZ2dlci5kZWJ1ZygnRXhlY3V0aW5nIHF1ZXJ5ICcgKyBpbmRleE5hbWUgKyAnOicgKyAnICcgKyBrZXkpO1xuICAgICAgICAgICAgUG91Y2guZ2V0UG91Y2goKS5xdWVyeShpbmRleE5hbWUsIHtrZXk6IGtleX0sIGZpbmlzaCk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBpZiAoZXJyLnN0YXR1cyA9PSA0MDQpIHtcbiAgICAgICAgICAgICAgICBMb2dnZXIud2FybignQ291bGRudCBmaW5kIGluZGV4IFwiJyArIGluZGV4TmFtZSArICdcIiBhbmQgaGVuY2UgbXVzdCBpdGVyYXRlIHRocm91Z2ggZXZlcnkgc2luZ2xlIGRvY3VtZW50LicpO1xuICAgICAgICAgICAgICAgIHZhciBmaWVsZHMgPSBzZWxmLl9zb3J0ZWRGaWVsZHMoKTtcbiAgICAgICAgICAgICAgICAvLyBUT0RPOiBDbGVhbiB1cCBjb25zdHJ1Y3RNYXBGdW5jdGlvbiBzbyBjYW4gb3V0cHV0IGJvdGggc3RyaW5nK2Z1bmMgdmVyc2lvbiBzbyBkb24ndCBuZWVkIGV2YWwgaGVyZS5cbiAgICAgICAgICAgICAgICAvLyBUT0RPOiBGb3Igc29tZSByZWFzb24gY29uc3RydWN0TWFwRnVuY3Rpb24yICh3aGljaCByZXR1cm5zIGEgZnVuY3Rpb24pIHdvbnQgd29yayB3aXRoIHBvdWNoLlxuICAgICAgICAgICAgICAgIC8vIEknbSB0aGlua2luZyB0aGF0IHBvdWNoIHByb2JhYmx5IGRvZXNudCBzdXBwb3J0IGNsb3N1cmVzIGluIGl0cyBxdWVyaWVzIHdoaWNoIHdvdWxkIG1lYW5cbiAgICAgICAgICAgICAgICAvLyB3ZSdkIGhhdmUgdG8gc3RpY2sgd2l0aCBldmFsIGhlcmUuXG4gICAgICAgICAgICAgICAgdmFyIGYgPSBtYXBwaW5nLmNvbnN0cnVjdE1hcEZ1bmN0aW9uKHNlbGYuY29sbGVjdGlvbiwgc2VsZi5tb2RlbE5hbWUsIGZpZWxkcyk7XG4gICAgICAgICAgICAgICAgZXZhbCgndmFyIG1hcEZ1bmMgPSAnICsgZik7XG4gICAgICAgICAgICAgICAga2V5ID0gc2VsZi5fY29uc3RydWN0S2V5KGZpZWxkcyk7XG4gICAgICAgICAgICAgICAgaWYgKCFrZXkubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgIGtleSA9IHNlbGYubW9kZWxOYW1lO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAvL25vaW5zcGVjdGlvbiBKU1VucmVzb2x2ZWRWYXJpYWJsZVxuICAgICAgICAgICAgICAgIFBvdWNoLmdldFBvdWNoKCkucXVlcnkobWFwRnVuYywge2tleToga2V5fSwgZmluaXNoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGZpbmlzaChlcnIpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG59O1xuXG5SYXdRdWVyeS5wcm90b3R5cGUuX2dldEZpZWxkcyA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgZmllbGRzID0gW107XG4gICAgZm9yICh2YXIgZmllbGQgaW4gdGhpcy5xdWVyeSkge1xuICAgICAgICBpZiAodGhpcy5xdWVyeS5oYXNPd25Qcm9wZXJ0eShmaWVsZCkpIHtcbiAgICAgICAgICAgIGZpZWxkcy5wdXNoKGZpZWxkKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZmllbGRzO1xufTtcblxuUmF3UXVlcnkucHJvdG90eXBlLl9zb3J0ZWRGaWVsZHMgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIGZpZWxkcyA9IHRoaXMuX2dldEZpZWxkcygpO1xuICAgIHJldHVybiBfLnNvcnRCeShmaWVsZHMsIGZ1bmN0aW9uICh4KSB7cmV0dXJuIHh9KTtcbn07XG5cblJhd1F1ZXJ5LnByb3RvdHlwZS5fY29uc3RydWN0S2V5ID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB2YXIgc29ydGVkRmllbGRzID0gdGhpcy5fc29ydGVkRmllbGRzKCk7XG4gICAgdmFyIGtleSA9IF8ucmVkdWNlKHNvcnRlZEZpZWxkcywgZnVuY3Rpb24gKG1lbW8sIHgpIHtcbiAgICAgICAgdmFyIHY7XG4gICAgICAgIGlmICh4ID09PSBudWxsKSB7XG4gICAgICAgICAgICB2ID0gJ251bGwnO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKHggPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgdiA9ICd1bmRlZmluZWQnO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdiA9IHNlbGYucXVlcnlbeF0udG9TdHJpbmcoKVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBtZW1vICsgdiArICdfJztcbiAgICB9LCAnJyk7XG4gICAgcmV0dXJuIGtleS5zdWJzdHJpbmcoMCwga2V5Lmxlbmd0aCAtIDEpO1xufTtcblxuUmF3UXVlcnkucHJvdG90eXBlLl9nZXREZXNpZ25Eb2NOYW1lID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBpID0gbmV3IGluZGV4LkluZGV4KHRoaXMuY29sbGVjdGlvbiwgdGhpcy5tb2RlbE5hbWUsIHRoaXMuX2dldEZpZWxkcygpKTtcbiAgICByZXR1cm4gaS5fZ2V0RGVzaWduRG9jTmFtZSgpO1xufTtcblxuUmF3UXVlcnkucHJvdG90eXBlLl9nZXRJbmRleE5hbWUgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIGkgPSBuZXcgaW5kZXguSW5kZXgodGhpcy5jb2xsZWN0aW9uLCB0aGlzLm1vZGVsTmFtZSwgdGhpcy5fZ2V0RmllbGRzKCkpO1xuICAgIHJldHVybiBpLl9nZXROYW1lKCk7XG59O1xuXG5SYXdRdWVyeS5wcm90b3R5cGUuX2R1bXAgPSBmdW5jdGlvbiAoYXNKc29uKSB7XG4gICAgdmFyIG9iaiA9IHt9O1xuICAgIG9iai5jb2xsZWN0aW9uID0gdGhpcy5jb2xsZWN0aW9uO1xuICAgIG9iai5tYXBwaW5nID0gdGhpcy5tb2RlbE5hbWU7XG4gICAgb2JqLnF1ZXJ5ID0gdGhpcy5xdWVyeTtcbiAgICBvYmouaW5kZXggPSB0aGlzLl9nZXRJbmRleE5hbWUoKTtcbiAgICBvYmouZGVzaWduRG9jID0gdGhpcy5fZ2V0RGVzaWduRG9jTmFtZSgpO1xuICAgIHJldHVybiBhc0pzb24gPyBKU09OLnN0cmluZ2lmeShvYmosIG51bGwsIDQpIDogb2JqO1xufTtcblxuXG5cbmV4cG9ydHMuUmF3UXVlcnkgPSBSYXdRdWVyeTsiLCIoZnVuY3Rpb24gKCkge1xuXG4gICAgdmFyIF9pID0gc2llc3RhLl9pbnRlcm5hbFxuICAgICAgICAsIG1hcHBpbmcgPSBfaS5tYXBwaW5nXG4gICAgICAgICwgcSA9IF9pLnFcbiAgICAgICAgLCB1dGlsID0gX2kudXRpbFxuICAgICAgICAsIGV4dGVuZCA9IF8uZXh0ZW5kXG4gICAgICAgICwgTWFwcGluZyA9IG1hcHBpbmcuTWFwcGluZ1xuICAgICAgICA7XG5cbiAgICB2YXIgY2hhbmdlcyA9IHJlcXVpcmUoJy4vY2hhbmdlcycpXG4gICAgICAgICwgcG91Y2ggPSByZXF1aXJlKCcuL3BvdWNoJylcbiAgICAgICAgLCBxdWVyeSA9IHJlcXVpcmUoJy4vcXVlcnknKVxuICAgICAgICAsIGluZGV4ID0gcmVxdWlyZSgnLi9pbmRleCcpXG4gICAgICAgICwgc3RvcmUgPSByZXF1aXJlKCcuL3N0b3JlJylcbiAgICAgICAgO1xuXG4gICAgdmFyIG9sZFJlc2V0ID0gc2llc3RhLnJlc2V0O1xuXG4gICAgc2llc3RhLnJlc2V0ID0gZnVuY3Rpb24gKGluTWVtb3J5LCBjYWxsYmFjaykge1xuICAgICAgICBjaGFuZ2VzLnJlc2V0Q2hhbmdlcygpO1xuICAgICAgICBpbmRleC5jbGVhckluZGV4ZXMoKTtcbiAgICAgICAgcG91Y2gucmVzZXQoaW5NZW1vcnksIGNhbGxiYWNrKTtcbiAgICAgICAgb2xkUmVzZXQuYXBwbHkob2xkUmVzZXQsIGFyZ3VtZW50cyk7XG4gICAgfTtcblxuICAgIHZhciBvbGRJbnN0YWxsID0gbWFwcGluZy5NYXBwaW5nLnByb3RvdHlwZS5pbnN0YWxsO1xuXG4gICAgTWFwcGluZy5wcm90b3R5cGUuZ2V0SW5kZXhlc1RvSW5zdGFsbCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICB2YXIgZmllbGRIYXNoID0gXy5yZWR1Y2Uoc2VsZi5fZmllbGRzLCBmdW5jdGlvbiAobSwgZikge1xuICAgICAgICAgICAgbVtmXSA9IHt9O1xuICAgICAgICAgICAgcmV0dXJuIG1cbiAgICAgICAgfSwge30pO1xuICAgICAgICBmb3IgKHZhciBwcm9wIGluIHNlbGYucmVsYXRpb25zaGlwcykge1xuICAgICAgICAgICAgaWYgKHNlbGYucmVsYXRpb25zaGlwcy5oYXNPd25Qcm9wZXJ0eShwcm9wKSkge1xuICAgICAgICAgICAgICAgIHZhciByID0gc2VsZi5yZWxhdGlvbnNoaXBzW3Byb3BdO1xuICAgICAgICAgICAgICAgIGlmIChyLnJldmVyc2UgIT0gcHJvcCkge1xuICAgICAgICAgICAgICAgICAgICBmaWVsZEhhc2hbcHJvcF0gPSB7fTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgdmFyIGluZGV4ZXNUb0luc3RhbGwgPSBfLnJlZHVjZShzZWxmLmluZGV4ZXMsIGZ1bmN0aW9uIChtLCBmKSB7XG4gICAgICAgICAgICBpZiAoZmllbGRIYXNoW2ZdKSBtLnB1c2goZik7XG4gICAgICAgICAgICByZXR1cm4gbTtcbiAgICAgICAgfSwgW10pO1xuICAgICAgICBpZiAoc2VsZi5pZCkgaW5kZXhlc1RvSW5zdGFsbC5wdXNoKHNlbGYuaWQpO1xuICAgICAgICByZXR1cm4gIGluZGV4ZXNUb0luc3RhbGw7XG4gICAgfTtcblxuICAgIE1hcHBpbmcucHJvdG90eXBlLmluc3RhbGwgPSBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICAgICAgdmFyIGRlZmVycmVkID0gcS5kZWZlcigpO1xuICAgICAgICBjYWxsYmFjayA9IHV0aWwuY29uc3RydWN0Q2FsbGJhY2tBbmRQcm9taXNlSGFuZGxlcihjYWxsYmFjaywgZGVmZXJyZWQpO1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgIG9sZEluc3RhbGwuY2FsbCh0aGlzLCBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICBpZiAoIWVycikge1xuICAgICAgICAgICAgICAgIHZhciBpbmRleGVzVG9JbnN0YWxsID0gc2VsZi5nZXRJbmRleGVzVG9JbnN0YWxsKCk7XG4gICAgICAgICAgICAgICAgaW5kZXguaW5zdGFsbEluZGV4ZXMoc2VsZi5jb2xsZWN0aW9uLCBzZWxmLnR5cGUsIGluZGV4ZXNUb0luc3RhbGwsIGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgc2VsZi5faW5zdGFsbGVkID0gIWVycjtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG4gICAgfTtcblxuICAgIGlmICghc2llc3RhLmV4dCkge1xuICAgICAgICBzaWVzdGEuZXh0ID0ge307XG4gICAgfVxuXG4gICAgc2llc3RhLmV4dC5zdG9yYWdlID0ge1xuICAgICAgICBjaGFuZ2VzOiBjaGFuZ2VzLFxuICAgICAgICBwb3VjaDogcG91Y2gsXG4gICAgICAgIFBvdWNoOiBwb3VjaCxcbiAgICAgICAgcXVlcnk6IHF1ZXJ5LFxuICAgICAgICBpbmRleDogaW5kZXgsXG4gICAgICAgIHN0b3JlOiBzdG9yZSxcbiAgICAgICAgSW5kZXg6IGluZGV4LkluZGV4LFxuICAgICAgICBSYXdRdWVyeTogcXVlcnkuUmF3UXVlcnlcbiAgICB9O1xuXG59KSgpOyIsInZhciBfaSA9IHNpZXN0YS5faW50ZXJuYWxcbiAgICAsIHdyYXBwZWRDYWxsYmFjayA9IF9pLm1pc2Mud3JhcHBlZENhbGxiYWNrXG4gICAgLCB1dGlsID0gX2kudXRpbFxuICAgICwgXyA9IHV0aWwuX1xuICAgICwgY2FjaGUgPSBfaS5jYWNoZVxuICAgICwgSW50ZXJuYWxTaWVzdGFFcnJvciA9IF9pLmVycm9yLkludGVybmFsU2llc3RhRXJyb3JcbiAgICAsIGxvZyA9IF9pLmxvZ1xuICAgICwgY29yZVN0b3JlID0gX2kuc3RvcmVcbiAgICAsIHEgPSBfaS5xXG47XG5cbnZhciBMb2dnZXIgPSBsb2cubG9nZ2VyV2l0aE5hbWUoJ1N0b3JlJyk7XG5Mb2dnZXIuc2V0TGV2ZWwobG9nLkxldmVsLndhcm4pO1xuXG52YXIgUG91Y2hBZGFwdGVyID0gcmVxdWlyZSgnLi9wb3VjaCcpO1xudmFyIGluZGV4ID0gcmVxdWlyZSgnLi9pbmRleCcpO1xudmFyIEluZGV4ID0gaW5kZXguSW5kZXg7XG5cbmZ1bmN0aW9uIGdldEZyb21Qb3VjaChvcHRzLCBjYWxsYmFjaykge1xuICAgIFBvdWNoQWRhcHRlci5nZXRQb3VjaCgpLmdldChvcHRzLl9pZCkudGhlbihmdW5jdGlvbiAoZG9jKSB7XG4gICAgICAgIHZhciBkb2NzID0gUG91Y2hBZGFwdGVyLnRvU2llc3RhKFtkb2NdKTtcbiAgICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhudWxsLCBkb2NzLmxlbmd0aCA/IGRvY3NbMF0gOiBudWxsKTtcbiAgICB9LCB3cmFwcGVkQ2FsbGJhY2soY2FsbGJhY2spKTtcbn1cblxuZnVuY3Rpb24gZ2V0TXVsdGlwbGVMb2NhbEZyb21Db3VjaChyZXN1bHRzLCBjYWxsYmFjaykge1xuICAgIHZhciBkZWZlcnJlZCA9IHEuZGVmZXIoKTtcbiAgICBjYWxsYmFjayA9IHV0aWwuY29uc3RydWN0Q2FsbGJhY2tBbmRQcm9taXNlSGFuZGxlcihjYWxsYmFjaywgZGVmZXJyZWQpO1xuICAgIFBvdWNoQWRhcHRlci5nZXRQb3VjaCgpLmFsbERvY3Moe2tleXM6IHJlc3VsdHMubm90Q2FjaGVkLCBpbmNsdWRlX2RvY3M6IHRydWV9LCBmdW5jdGlvbiAoZXJyLCBkb2NzKSB7XG4gICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICB2YXIgcm93cyA9IF8ucGx1Y2soZG9jcy5yb3dzLCAnZG9jJyk7XG4gICAgICAgICAgICB2YXIgbW9kZWxzID0gUG91Y2hBZGFwdGVyLnRvU2llc3RhKHJvd3MpO1xuICAgICAgICAgICAgXy5lYWNoKG1vZGVscywgZnVuY3Rpb24gKG0pIHtcbiAgICAgICAgICAgICAgICBpZiAobSkge1xuICAgICAgICAgICAgICAgICAgICByZXN1bHRzLmNhY2hlZFttLl9pZF0gPSBtO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgY2FsbGJhY2soKTtcbiAgICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xufVxuXG5mdW5jdGlvbiBnZXRNdWx0aXBsZVJlbW90ZUZyb21wb3VjaChtYXBwaW5nLCByZW1vdGVJZGVudGlmaWVycywgcmVzdWx0cywgY2FsbGJhY2spIHtcbiAgICBpZiAoTG9nZ2VyLnRyYWNlLmlzRW5hYmxlZCkgTG9nZ2VyLnRyYWNlKCdnZXRNdWx0aXBsZVJlbW90ZUZyb21wb3VjaCgnICsgbWFwcGluZy50eXBlICsgJyk6JywgcmVtb3RlSWRlbnRpZmllcnMpO1xuICAgIHZhciBkZWZlcnJlZCA9IHEuZGVmZXIoKTtcbiAgICBjYWxsYmFjayA9IHV0aWwuY29uc3RydWN0Q2FsbGJhY2tBbmRQcm9taXNlSGFuZGxlcihjYWxsYmFjaywgZGVmZXJyZWQpO1xuICAgIHZhciBpID0gbmV3IEluZGV4KG1hcHBpbmcuY29sbGVjdGlvbiwgbWFwcGluZy50eXBlLCBbbWFwcGluZy5pZF0pO1xuICAgIHZhciBuYW1lID0gaS5fZ2V0TmFtZSgpO1xuICAgIFBvdWNoQWRhcHRlci5nZXRQb3VjaCgpLnF1ZXJ5KG5hbWUsIHtrZXlzOiBfLm1hcChyZW1vdGVJZGVudGlmaWVycywgZnVuY3Rpb24gKGkpIHtyZXR1cm4gaS50b1N0cmluZygpO30pLCBpbmNsdWRlX2RvY3M6IHRydWV9LCBmdW5jdGlvbiAoZXJyLCBkb2NzKSB7XG4gICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICB2YXIgcm93cyA9IF8ucGx1Y2soZG9jcy5yb3dzLCAndmFsdWUnKTtcbiAgICAgICAgICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKSBMb2dnZXIudHJhY2UoJ1tST1dTXSBnZXRNdWx0aXBsZVJlbW90ZUZyb21wb3VjaCgnICsgbWFwcGluZy50eXBlICsgJyk6Jywgcm93cyk7XG4gICAgICAgICAgICB2YXIgbW9kZWxzID0gUG91Y2hBZGFwdGVyLnRvU2llc3RhKHJvd3MpO1xuICAgICAgICAgICAgXy5lYWNoKG1vZGVscywgZnVuY3Rpb24gKG1vZGVsKSB7XG4gICAgICAgICAgICAgICAgdmFyIHJlbW90ZUlkID0gbW9kZWxbbWFwcGluZy5pZF07XG4gICAgICAgICAgICAgICAgcmVzdWx0cy5jYWNoZWRbcmVtb3RlSWRdID0gbW9kZWw7XG4gICAgICAgICAgICAgICAgdmFyIGlkeCA9IHJlc3VsdHMubm90Q2FjaGVkLmluZGV4T2YocmVtb3RlSWQpO1xuICAgICAgICAgICAgICAgIHJlc3VsdHMubm90Q2FjaGVkLnNwbGljZShpZHgsIDEpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBpZiAoTG9nZ2VyLnRyYWNlLmlzRW5hYmxlZCkge1xuICAgICAgICAgICAgICAgIExvZ2dlci50cmFjZSgnW1JFU1VMVFNdIGdldE11bHRpcGxlUmVtb3RlRnJvbXBvdWNoKCcgKyBtYXBwaW5nLnR5cGUgKyAnKTonLCByZXN1bHRzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhbGxiYWNrKCk7XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbn1cblxuZXhwb3J0cy5nZXRGcm9tUG91Y2ggPSBnZXRGcm9tUG91Y2g7XG5leHBvcnRzLmdldE11bHRpcGxlTG9jYWxGcm9tQ291Y2ggPSBnZXRNdWx0aXBsZUxvY2FsRnJvbUNvdWNoO1xuZXhwb3J0cy5nZXRNdWx0aXBsZVJlbW90ZUZyb21wb3VjaCA9IGdldE11bHRpcGxlUmVtb3RlRnJvbXBvdWNoOyJdfQ==
