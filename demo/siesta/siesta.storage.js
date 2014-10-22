(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/*
 * Changes describe differences between the in-memory object graph and the object graph sat in the databases.
 *
 * Faulted objects being pulled into memory will have changes applied to them.
 *
 * On siesta.save() all changes will be merged into the database.
 */

var _i = siesta._internal
    , RestError = _i.error.RestError
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
        throw new RestError('Must remove or add something with a splice change.');
    }
    if (index === undefined || index === null) {
        throw new RestError('Must pass index to splice change');
    }
    var arr = obj[field];
    var actuallyRemoved = _.partial(arr.splice, index, removed.length).apply(arr, added);
    if (!arraysEqual(actuallyRemoved, removed)) {
        throw new RestError('Objects actually removed did not match those specified in the change');
    }
}

function applyRemove(field, removed, obj) {
    if (!removed) {
        throw new RestError('Must pass removed');
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
        throw new RestError('Old value does not match new value: ' + JSON.stringify({old: old ? old : null, actualOld: actualOld ? actualOld : null}, null, 4));
    }
    obj[field] = newVal;
}

function validateChange() {
    if (!this.field) throw new RestError('Must pass field to change');
    if (!this.collection) throw new RestError('Must pass collection to change');
    if (!this.mapping) throw new RestError('Must pass mapping to change');
}
function validateObject(obj) {
    if (obj._id != this._id) {
        throw new RestError('Cannot apply change with _id="' + this._id.toString() + '" to object with _id="' + obj._id.toString() + '"');
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
    else if (this.type == ChangeType.Remove) {
        applyRemove.call(this, this.field, this.removedId || this.removed, doc);
    }
    else {
        throw new RestError('Unknown change type "' + this.type.toString() + '"');
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
                throw new RestError('If not faulted, all removed objects should be cache.');
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
        throw new RestError('Field "' + this.field + '" does not exist within mapping "' + this.mapping.type + '"');
    }
    if (this.type == ChangeType.Set) {
        applySetToSiestaModel.call(this, isField, model);
    }
    else if (this.type == ChangeType.Splice) {
        applySpliceToSiestaModel.call(this, isField, model);
    }
    else if (this.type == ChangeType.Remove) {
        applyRemoveToSiestaModel.call(this, isField, model);
    }
    else {
        throw new RestError('Unknown change type "' + this.type.toString() + '"');
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
        throw new RestError('Cannot apply changes to object with no _id');
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
    , RestError = _i.error.RestError
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
        throw new RestError('Type must be specified in order to construct index map function.', {index: this});
    }
    if (!this.collection) {
        throw new RestError('API must be specified in order to construct index map function.', {index: this});
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
    , RestError = _i.error.RestError
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
                    throw new RestError('Cannot convert PouchDB document into SiestaModel. ' +
                        'No mapping with type ' + mappingType.toString(), {doc: doc})
                }
            }
            else {
                throw new RestError('Cannot convert PouchDB document into SiestaModel. ' +
                    'No type field within document', {doc: doc});
            }
        }
        else {
            throw new RestError('Cannot convert PouchDB document into SiestaModel. ' +
                'API "' + collectionName.toString() + '" doesnt exist.', {doc: doc});
        }

    }
    else {
        throw new RestError('Cannot convert PouchDB document into SiestaModel. ' +
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
    , RestError = _i.error.RestError
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
            throw new RestError('Mapping must be installed');
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
    , RestError = _i.error.RestError
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9zcmMvcG91Y2gvY2hhbmdlcy5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L3NyYy9wb3VjaC9pbmRleC5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L3NyYy9wb3VjaC9wb3VjaC5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L3NyYy9wb3VjaC9xdWVyeS5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L3NyYy9wb3VjaC9zdG9yYWdlLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3Qvc3JjL3BvdWNoL3N0b3JlLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNWVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDektBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsS0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvKlxuICogQ2hhbmdlcyBkZXNjcmliZSBkaWZmZXJlbmNlcyBiZXR3ZWVuIHRoZSBpbi1tZW1vcnkgb2JqZWN0IGdyYXBoIGFuZCB0aGUgb2JqZWN0IGdyYXBoIHNhdCBpbiB0aGUgZGF0YWJhc2VzLlxuICpcbiAqIEZhdWx0ZWQgb2JqZWN0cyBiZWluZyBwdWxsZWQgaW50byBtZW1vcnkgd2lsbCBoYXZlIGNoYW5nZXMgYXBwbGllZCB0byB0aGVtLlxuICpcbiAqIE9uIHNpZXN0YS5zYXZlKCkgYWxsIGNoYW5nZXMgd2lsbCBiZSBtZXJnZWQgaW50byB0aGUgZGF0YWJhc2UuXG4gKi9cblxudmFyIF9pID0gc2llc3RhLl9pbnRlcm5hbFxuICAgICwgUmVzdEVycm9yID0gX2kuZXJyb3IuUmVzdEVycm9yXG4gICAgLCB1dGlsID0gX2kudXRpbFxuICAgICwgXyA9IHV0aWwuX1xuICAgICwgT3BlcmF0aW9uID0gX2kuT3BlcmF0aW9uXG4gICAgLCBPcGVyYXRpb25RdWV1ZSA9IF9pLk9wZXJhdGlvblF1ZXVlXG4gICAgLCBvYmplY3QgPSBfaS5vYmplY3RcbiAgICAsIFNpZXN0YU1vZGVsID0gb2JqZWN0LlNpZXN0YU1vZGVsXG4gICAgLCBleHRlbmQgPSBfaS5leHRlbmRcbiAgICAsIGxvZyA9IF9pLmxvZ1xuICAgICwgY2FjaGUgPSBfaS5jYWNoZVxuICAgICwgY29yZUNoYW5nZXMgPSBfaS5jb3JlQ2hhbmdlc1xuICAgICwgQ2hhbmdlID0gY29yZUNoYW5nZXMuQ2hhbmdlXG4gICAgLCBDaGFuZ2VUeXBlID0gY29yZUNoYW5nZXMuQ2hhbmdlVHlwZVxuICAgICwgY29sbGVjdGlvbiA9IF9pLmNvbGxlY3Rpb25cbiAgICAsIHEgPSBfaS5xXG4gICAgO1xuXG52YXIgcG91Y2ggPSByZXF1aXJlKCcuL3BvdWNoJyk7XG52YXIgaW5kZXggPSByZXF1aXJlKCcuL2luZGV4Jyk7XG5cbnZhciBMb2dnZXIgPSBsb2cubG9nZ2VyV2l0aE5hbWUoJ2NoYW5nZXMnKTtcbkxvZ2dlci5zZXRMZXZlbChsb2cuTGV2ZWwud2Fybik7XG5cbnZhciB1bm1lcmdlZENoYW5nZXMgPSB7fTtcblxuLyoqXG4gKiBVc2VkIHRvIGVuc3VyZSBtZXJnZSBvcGVyYXRpb24gb25seSBmaW5pc2hlcyBvbmNlIGFsbCBjaGFuZ2VzIGFyZSBtYWRlIHRvIHRoZSBkYXRhYmFzZS5cbiAqIFRoaXMgaXMgYmVjYXVzZSBvZiAod2hhdCBJIHRoaW5rIGlzKSBhIGJ1ZyBpbiBQb3VjaERCIHdoZXJlYnkgdGhlIGJ1bGtEb2NzIGNhbGxiYWNrIGlzIGNhbGxlZCBiZWZvcmVcbiAqIGFsbCBjaGFuZ2VzIGhhdmUgYWN0dWFsbHkgYmVlbiBtYWRlIGluIHRoZSBkYXRhYmFzZS4gQnkgd2FpdGluZyBmb3IgYWxsIHRoZSBkYXRhYmFzZSBjaGFuZ2UgZXZlbnRzIHRvIHJldHVyblxuICogd2UgY2FuIGVuc3VyZSB0aGF0IHRoZXJlIGlzIG5vIG1lcmdlIG92ZXJsYXBzIGFuZCBoZW5jZSBubyByYWNlIGNvbmRpdGlvbnMuXG4gKiBAdHlwZSB7e319XG4gKi9cbnZhciB3YWl0aW5nRm9yT2JzZXJ2YXRpb25zID0ge307XG5cbi8qKlxuICogUG9wdWxhdGVkIGJ5IGVhY2ggbWVyZ2Ugb3BlcmF0aW9uIHRoYXQgaXMgY3VycmVudGx5IGV4ZWN1dGluZy4gV2hlbiBhbGwgb2JzZXJ2YXRpb25zIHJlbGF0ZWQgdG8gdGhlIG1lcmdlZCBjaGFuZ2VzXG4gKiBhcmUgcmVjZWl2ZWQsIHRoaXMgZnVuY3Rpb24gaXMgY2FsbGVkLCBlbmRpbmcgdGhlIG1lcmdlIG9wZXJhdGlvbi5cbiAqIEB0eXBlIHtmdW5jdGlvbn1cbiAqL1xudmFyIGZpbmlzaFdhaXRpbmdGb3JPYnNlcnZhdGlvbnM7XG5cbi8vIFRoZSBtb21lbnQgdGhhdCBjaGFuZ2VzIGFyZSBwcm9wYWdhdGVkIHRvIFBvdWNoIHdlIG5lZWQgdG8gcmVtb3ZlIHNhaWQgY2hhbmdlIGZyb20gdW5tZXJnZWRDaGFuZ2VzLlxucG91Y2guYWRkT2JzZXJ2ZXIoZnVuY3Rpb24gKGUpIHtcbiAgICB2YXIgaWQgPSBlLmlkO1xuICAgIGZvciAodmFyIGNvbGxlY3Rpb25OYW1lIGluIHVubWVyZ2VkQ2hhbmdlcykge1xuICAgICAgICBpZiAodW5tZXJnZWRDaGFuZ2VzLmhhc093blByb3BlcnR5KGNvbGxlY3Rpb25OYW1lKSkge1xuICAgICAgICAgICAgdmFyIGNvbGxlY3Rpb25DaGFuZ2VzID0gdW5tZXJnZWRDaGFuZ2VzW2NvbGxlY3Rpb25OYW1lXTtcbiAgICAgICAgICAgIGZvciAodmFyIG1hcHBpbmdOYW1lIGluIGNvbGxlY3Rpb25DaGFuZ2VzKSB7XG4gICAgICAgICAgICAgICAgaWYgKGNvbGxlY3Rpb25DaGFuZ2VzLmhhc093blByb3BlcnR5KG1hcHBpbmdOYW1lKSkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgbWFwcGluZ0NoYW5nZXMgPSBjb2xsZWN0aW9uQ2hhbmdlc1ttYXBwaW5nTmFtZV07XG4gICAgICAgICAgICAgICAgICAgIGlmIChtYXBwaW5nQ2hhbmdlc1tpZF0pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlbGV0ZSBtYXBwaW5nQ2hhbmdlc1tpZF07XG4gICAgICAgICAgICAgICAgICAgICAgICBkZWxldGUgd2FpdGluZ0Zvck9ic2VydmF0aW9uc1tpZF07XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIV8ua2V5cyh3YWl0aW5nRm9yT2JzZXJ2YXRpb25zKS5sZW5ndGggJiYgZmluaXNoV2FpdGluZ0Zvck9ic2VydmF0aW9ucykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZpbmlzaFdhaXRpbmdGb3JPYnNlcnZhdGlvbnMoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmaW5pc2hXYWl0aW5nRm9yT2JzZXJ2YXRpb25zID0gbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn0pO1xuXG52YXIgbWVyZ2VRdWV1ZSA9IG5ldyBPcGVyYXRpb25RdWV1ZSgnTWVyZ2UgUXVldWUnKTtcbm1lcmdlUXVldWUubWF4Q29uY3VycmVudE9wZXJhdGlvbnMgPSAxO1xubWVyZ2VRdWV1ZS5zdGFydCgpO1xuXG5mdW5jdGlvbiBhcnJheXNFcXVhbChhLCBiKSB7XG4gICAgaWYgKGEgPT09IGIpIHJldHVybiB0cnVlO1xuICAgIGlmIChhID09IG51bGwgfHwgYiA9PSBudWxsKSByZXR1cm4gZmFsc2U7XG4gICAgaWYgKGEubGVuZ3RoICE9IGIubGVuZ3RoKSByZXR1cm4gZmFsc2U7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBhLmxlbmd0aDsgKytpKSB7XG4gICAgICAgIGlmIChhW2ldICE9PSBiW2ldKSByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIHJldHVybiB0cnVlO1xufVxuXG5mdW5jdGlvbiBhcHBseVNwbGljZShvYmosIGZpZWxkLCBpbmRleCwgcmVtb3ZlZCwgYWRkZWQpIHtcbiAgICBpZiAoIShyZW1vdmVkIHx8IGFkZGVkKSkge1xuICAgICAgICB0aHJvdyBuZXcgUmVzdEVycm9yKCdNdXN0IHJlbW92ZSBvciBhZGQgc29tZXRoaW5nIHdpdGggYSBzcGxpY2UgY2hhbmdlLicpO1xuICAgIH1cbiAgICBpZiAoaW5kZXggPT09IHVuZGVmaW5lZCB8fCBpbmRleCA9PT0gbnVsbCkge1xuICAgICAgICB0aHJvdyBuZXcgUmVzdEVycm9yKCdNdXN0IHBhc3MgaW5kZXggdG8gc3BsaWNlIGNoYW5nZScpO1xuICAgIH1cbiAgICB2YXIgYXJyID0gb2JqW2ZpZWxkXTtcbiAgICB2YXIgYWN0dWFsbHlSZW1vdmVkID0gXy5wYXJ0aWFsKGFyci5zcGxpY2UsIGluZGV4LCByZW1vdmVkLmxlbmd0aCkuYXBwbHkoYXJyLCBhZGRlZCk7XG4gICAgaWYgKCFhcnJheXNFcXVhbChhY3R1YWxseVJlbW92ZWQsIHJlbW92ZWQpKSB7XG4gICAgICAgIHRocm93IG5ldyBSZXN0RXJyb3IoJ09iamVjdHMgYWN0dWFsbHkgcmVtb3ZlZCBkaWQgbm90IG1hdGNoIHRob3NlIHNwZWNpZmllZCBpbiB0aGUgY2hhbmdlJyk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBhcHBseVJlbW92ZShmaWVsZCwgcmVtb3ZlZCwgb2JqKSB7XG4gICAgaWYgKCFyZW1vdmVkKSB7XG4gICAgICAgIHRocm93IG5ldyBSZXN0RXJyb3IoJ011c3QgcGFzcyByZW1vdmVkJyk7XG4gICAgfVxuICAgIF8uZWFjaChyZW1vdmVkLCBmdW5jdGlvbiAocikge1xuICAgICAgICB2YXIgYXJyID0gb2JqW2ZpZWxkXTtcbiAgICAgICAgdmFyIGlkeCA9IGFyci5pbmRleE9mKHIpO1xuICAgICAgICBhcnIuc3BsaWNlKGlkeCwgMSk7XG4gICAgfSk7XG59XG5cbmZ1bmN0aW9uIGFwcGx5U2V0KG9iaiwgZmllbGQsIG5ld1ZhbCwgb2xkKSB7XG4gICAgdmFyIGFjdHVhbE9sZCA9IG9ialtmaWVsZF07XG4gICAgaWYgKGFjdHVhbE9sZCAhPSBvbGQpIHtcbiAgICAgICAgLy8gVGhpcyBpcyBiYWQuIFNvbWV0aGluZyBoYXMgZ29uZSBvdXQgb2Ygc3luYyBvciB3ZSdyZSBhcHBseWluZyB1bm1lcmdlZENoYW5nZXMgb3V0IG9mIG9yZGVyLlxuICAgICAgICB0aHJvdyBuZXcgUmVzdEVycm9yKCdPbGQgdmFsdWUgZG9lcyBub3QgbWF0Y2ggbmV3IHZhbHVlOiAnICsgSlNPTi5zdHJpbmdpZnkoe29sZDogb2xkID8gb2xkIDogbnVsbCwgYWN0dWFsT2xkOiBhY3R1YWxPbGQgPyBhY3R1YWxPbGQgOiBudWxsfSwgbnVsbCwgNCkpO1xuICAgIH1cbiAgICBvYmpbZmllbGRdID0gbmV3VmFsO1xufVxuXG5mdW5jdGlvbiB2YWxpZGF0ZUNoYW5nZSgpIHtcbiAgICBpZiAoIXRoaXMuZmllbGQpIHRocm93IG5ldyBSZXN0RXJyb3IoJ011c3QgcGFzcyBmaWVsZCB0byBjaGFuZ2UnKTtcbiAgICBpZiAoIXRoaXMuY29sbGVjdGlvbikgdGhyb3cgbmV3IFJlc3RFcnJvcignTXVzdCBwYXNzIGNvbGxlY3Rpb24gdG8gY2hhbmdlJyk7XG4gICAgaWYgKCF0aGlzLm1hcHBpbmcpIHRocm93IG5ldyBSZXN0RXJyb3IoJ011c3QgcGFzcyBtYXBwaW5nIHRvIGNoYW5nZScpO1xufVxuZnVuY3Rpb24gdmFsaWRhdGVPYmplY3Qob2JqKSB7XG4gICAgaWYgKG9iai5faWQgIT0gdGhpcy5faWQpIHtcbiAgICAgICAgdGhyb3cgbmV3IFJlc3RFcnJvcignQ2Fubm90IGFwcGx5IGNoYW5nZSB3aXRoIF9pZD1cIicgKyB0aGlzLl9pZC50b1N0cmluZygpICsgJ1wiIHRvIG9iamVjdCB3aXRoIF9pZD1cIicgKyBvYmouX2lkLnRvU3RyaW5nKCkgKyAnXCInKTtcbiAgICB9XG59XG5cbnZhciBvbGRSZWdpc3RlckNoYW5nZSA9IGNvcmVDaGFuZ2VzLnJlZ2lzdGVyQ2hhbmdlO1xuXG5jb3JlQ2hhbmdlcy5yZWdpc3RlckNoYW5nZSA9IGZ1bmN0aW9uIChvcHRzKSB7XG4gICAgY29yZUNoYW5nZXMudmFsaWRhdGVDaGFuZ2Uob3B0cyk7XG4gICAgdmFyIGNvbGxlY3Rpb24gPSBvcHRzLmNvbGxlY3Rpb247XG4gICAgdmFyIG1hcHBpbmcgPSBvcHRzLm1hcHBpbmc7XG4gICAgdmFyIF9pZCA9IG9wdHMuX2lkO1xuICAgIGlmICghdW5tZXJnZWRDaGFuZ2VzW2NvbGxlY3Rpb24ubmFtZV0pIHtcbiAgICAgICAgdW5tZXJnZWRDaGFuZ2VzW2NvbGxlY3Rpb24ubmFtZV0gPSB7fTtcbiAgICB9XG4gICAgdmFyIGNvbGxlY3Rpb25DaGFuZ2VzID0gdW5tZXJnZWRDaGFuZ2VzW2NvbGxlY3Rpb24ubmFtZV07XG4gICAgaWYgKCFjb2xsZWN0aW9uQ2hhbmdlc1ttYXBwaW5nLnR5cGVdKSB7XG4gICAgICAgIGNvbGxlY3Rpb25DaGFuZ2VzW21hcHBpbmcudHlwZV0gPSB7fTtcbiAgICB9XG4gICAgaWYgKCFjb2xsZWN0aW9uQ2hhbmdlc1ttYXBwaW5nLnR5cGVdW19pZF0pIHtcbiAgICAgICAgY29sbGVjdGlvbkNoYW5nZXNbbWFwcGluZy50eXBlXVtfaWRdID0gW107XG4gICAgfVxuICAgIHZhciBvYmpDaGFuZ2VzID0gY29sbGVjdGlvbkNoYW5nZXNbbWFwcGluZy50eXBlXVtfaWRdO1xuICAgIHZhciBjID0gb2xkUmVnaXN0ZXJDaGFuZ2Uob3B0cyk7XG4gICAgb2JqQ2hhbmdlcy5wdXNoKGMpO1xufTtcblxuXG5DaGFuZ2UucHJvdG90eXBlLmFwcGx5ID0gZnVuY3Rpb24gKGRvYykge1xuICAgIHZhbGlkYXRlQ2hhbmdlLmNhbGwodGhpcyk7XG4gICAgdmFsaWRhdGVPYmplY3QuY2FsbCh0aGlzLCBkb2MpO1xuICAgIGlmICh0aGlzLnR5cGUgPT0gQ2hhbmdlVHlwZS5TZXQpIHtcbiAgICAgICAgYXBwbHlTZXQuY2FsbCh0aGlzLCBkb2MsIHRoaXMuZmllbGQsIHRoaXMubmV3SWQgfHwgdGhpcy5uZXcsIHRoaXMub2xkSWQgfHwgdGhpcy5vbGQpO1xuICAgIH1cbiAgICBlbHNlIGlmICh0aGlzLnR5cGUgPT0gQ2hhbmdlVHlwZS5TcGxpY2UpIHtcbiAgICAgICAgaWYgKCFkb2NbdGhpcy5maWVsZF0pIGRvY1t0aGlzLmZpZWxkXSA9IFtdO1xuICAgICAgICBhcHBseVNwbGljZS5jYWxsKHRoaXMsIGRvYywgdGhpcy5maWVsZCwgdGhpcy5pbmRleCwgdGhpcy5yZW1vdmVkSWQgfHwgdGhpcy5yZW1vdmVkLCB0aGlzLmFkZGVkSWQgfHwgdGhpcy5hZGRlZCk7XG4gICAgfVxuICAgIGVsc2UgaWYgKHRoaXMudHlwZSA9PSBDaGFuZ2VUeXBlLlJlbW92ZSkge1xuICAgICAgICBhcHBseVJlbW92ZS5jYWxsKHRoaXMsIHRoaXMuZmllbGQsIHRoaXMucmVtb3ZlZElkIHx8IHRoaXMucmVtb3ZlZCwgZG9jKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBSZXN0RXJyb3IoJ1Vua25vd24gY2hhbmdlIHR5cGUgXCInICsgdGhpcy50eXBlLnRvU3RyaW5nKCkgKyAnXCInKTtcbiAgICB9XG4gICAgaWYgKCFkb2MuY29sbGVjdGlvbikge1xuICAgICAgICBkb2MuY29sbGVjdGlvbiA9IHRoaXMuY29sbGVjdGlvbjtcbiAgICB9XG4gICAgaWYgKCFkb2MubWFwcGluZykge1xuICAgICAgICBkb2MubWFwcGluZyA9IHRoaXMubWFwcGluZztcbiAgICB9XG4gICAgaWYgKCFkb2MudHlwZSkge1xuICAgICAgICBkb2MudHlwZSA9IHRoaXMubWFwcGluZztcbiAgICB9XG59O1xuXG5mdW5jdGlvbiBhcHBseVNldFRvU2llc3RhTW9kZWwoaXNGaWVsZCwgbW9kZWwpIHtcbiAgICBpZiAoaXNGaWVsZCkge1xuICAgICAgICBhcHBseVNldC5jYWxsKHRoaXMsIG1vZGVsLl9fdmFsdWVzLCB0aGlzLmZpZWxkLCB0aGlzLm5ldywgdGhpcy5vbGQpO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgdmFyIGlkZW50aWZpZXIgPSB0aGlzLm5ld0lkIHx8ICh0aGlzLm5ldyA/IHRoaXMubmV3Ll9pZCA6IG51bGwpO1xuICAgICAgICB2YXIgb2xkSWRlbnRpZmllciA9IHRoaXMub2xkSWQgfHwgKHRoaXMub2xkID8gdGhpcy5vbGQuX2lkIDogbnVsbCk7XG4gICAgICAgIHZhciBwcm94eSA9IG1vZGVsW3RoaXMuZmllbGQgKyAnUHJveHknXTtcbi8vICAgICAgICB2YXIgaXNGYXVsdGVkID0gcHJveHkuaXNGYXVsdDtcbiAgICAgICAgYXBwbHlTZXQuY2FsbCh0aGlzLCBwcm94eSwgJ19pZCcsIGlkZW50aWZpZXIsIG9sZElkZW50aWZpZXIpO1xuICAgICAgICB2YXIgX25ldyA9IHRoaXMubmV3IHx8ICh0aGlzLm5ld0lkID8gY2FjaGUuZ2V0KHtfaWQ6IHRoaXMubmV3SWR9KSA6IG51bGwpO1xuICAgICAgICB2YXIgb2xkID0gdGhpcy5vbGQgfHwgKHRoaXMub2xkSWQgPyBjYWNoZS5nZXQoe19pZDogdGhpcy5vbGRJZH0pIDogbnVsbCk7XG4gICAgICAgIGlmIChfbmV3IHx8IG9sZCkge1xuICAgICAgICAgICAgYXBwbHlTZXQuY2FsbCh0aGlzLCBwcm94eSwgJ3JlbGF0ZWQnLCBfbmV3LCBvbGQpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgLy8gRmF1bHRcbiAgICAgICAgICAgIHByb3h5LnJlbGF0ZWQgPSBudWxsO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5mdW5jdGlvbiBhcHBseVNwbGljZVRvU2llc3RhTW9kZWwoaXNGaWVsZCwgbW9kZWwpIHtcbiAgICBpZiAoaXNGaWVsZCkge1xuICAgICAgICBhcHBseVNwbGljZS5jYWxsKHRoaXMsIG1vZGVsLl9fdmFsdWVzLCB0aGlzLmZpZWxkLCB0aGlzLmluZGV4LCB0aGlzLnJlbW92ZWQsIHRoaXMuYWRkZWQpO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgdmFyIHJlbW92ZWRJZGVudGlmaWVycyA9IHRoaXMucmVtb3ZlZElkIHx8ICh0aGlzLnJlbW92ZWQgPyBfLnBsdWNrKHRoaXMucmVtb3ZlZCwgJ19pZCcpIDogW10pO1xuICAgICAgICB2YXIgYWRkZWRJZGVudGlmaWVycyA9IHRoaXMuYWRkZWRJZCB8fCAodGhpcy5hZGRlZCA/IF8ucGx1Y2sodGhpcy5hZGRlZCwgJ19pZCcpIDogW10pO1xuICAgICAgICB2YXIgcHJveHkgPSBtb2RlbFt0aGlzLmZpZWxkICsgJ1Byb3h5J107XG4gICAgICAgIHZhciBpc0ZhdWx0ZWQgPSBwcm94eS5pc0ZhdWx0O1xuICAgICAgICBhcHBseVNwbGljZS5jYWxsKHRoaXMsIHByb3h5LCAnX2lkJywgdGhpcy5pbmRleCwgcmVtb3ZlZElkZW50aWZpZXJzLCBhZGRlZElkZW50aWZpZXJzKTtcbiAgICAgICAgaWYgKCFpc0ZhdWx0ZWQpIHtcbiAgICAgICAgICAgIHZhciByZW1vdmVkID0gdGhpcy5yZW1vdmVkIHx8IF8ubWFwKHJlbW92ZWRJZGVudGlmaWVycywgZnVuY3Rpb24gKHgpIHtyZXR1cm4gY2FjaGUuZ2V0KHtfaWQ6IHh9KX0pO1xuICAgICAgICAgICAgdmFyIGFsbFJlbW92ZWRDYWNoZWQgPSBfLnJlZHVjZShyZW1vdmVkLCBmdW5jdGlvbiAobWVtbywgeCkge3JldHVybiB4ICYmIG1lbW99LCB0cnVlKTtcbiAgICAgICAgICAgIHZhciBhZGRlZCA9IHRoaXMuYWRkZWQgfHwgXy5tYXAoYWRkZWRJZGVudGlmaWVycywgZnVuY3Rpb24gKHgpIHtyZXR1cm4gY2FjaGUuZ2V0KHtfaWQ6IHh9KX0pO1xuICAgICAgICAgICAgdmFyIGFsbEFkZGVkQ2FjaGVkID0gXy5yZWR1Y2UoYWRkZWQsIGZ1bmN0aW9uIChtZW1vLCB4KSB7cmV0dXJuIHggJiYgbWVtb30sIHRydWUpO1xuICAgICAgICAgICAgaWYgKGFsbFJlbW92ZWRDYWNoZWQgJiYgYWxsQWRkZWRDYWNoZWQpIHtcbiAgICAgICAgICAgICAgICBhcHBseVNwbGljZS5jYWxsKHRoaXMsIHByb3h5LCAncmVsYXRlZCcsIHRoaXMuaW5kZXgsIHJlbW92ZWQsIGFkZGVkKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKCFhbGxSZW1vdmVkQ2FjaGVkKSB7XG4gICAgICAgICAgICAgICAgLy8gU29tZXRoaW5nIGhhcyBnb25lIHZlcnkgd3JvbmcgaWYgd2UgZW5kIHVwIGhlcmUuXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IFJlc3RFcnJvcignSWYgbm90IGZhdWx0ZWQsIGFsbCByZW1vdmVkIG9iamVjdHMgc2hvdWxkIGJlIGNhY2hlLicpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gRmF1bHRcbiAgICAgICAgICAgICAgICBwcm94eS5yZWxhdGVkID0gbnVsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn1cblxuZnVuY3Rpb24gYXBwbHlSZW1vdmVUb1NpZXN0YU1vZGVsKGlzRmllbGQsIG1vZGVsKSB7XG4gICAgaWYgKGlzRmllbGQpIHtcbiAgICAgICAgYXBwbHlSZW1vdmUuY2FsbCh0aGlzLCB0aGlzLmZpZWxkLCB0aGlzLnJlbW92ZWQsIG1vZGVsKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIHZhciByZW1vdmVkID0gdGhpcy5yZW1vdmVkSWQgfHwgKHRoaXMucmVtb3ZlZCA/IF8ucGx1Y2sodGhpcy5yZW1vdmVkLCAnX2lkJykgOiBbXSk7XG4gICAgICAgIHZhciBwcm94eSA9IG1vZGVsW3RoaXMuZmllbGQgKyAnUHJveHknXTtcbiAgICAgICAgdmFyIGlzRmF1bHRlZCA9IHByb3h5LmlzRmF1bHQ7XG4gICAgICAgIGFwcGx5UmVtb3ZlLmNhbGwodGhpcywgJ19pZCcsIHJlbW92ZWQsIHByb3h5KTtcbiAgICAgICAgaWYgKCFpc0ZhdWx0ZWQgJiYgdGhpcy5yZW1vdmVkKSB7XG4gICAgICAgICAgICBhcHBseVJlbW92ZS5jYWxsKHRoaXMsICdyZWxhdGVkJywgdGhpcy5yZW1vdmVkLCBwcm94eSk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbi8qKlxuICpcbiAqIEBwYXJhbSBtb2RlbCAtIEFuIGluc3RhbmNlIG9mIFNpZXN0YU1vZGVsXG4gKi9cbkNoYW5nZS5wcm90b3R5cGUuYXBwbHlTaWVzdGFNb2RlbCA9IGZ1bmN0aW9uIChtb2RlbCkge1xuICAgIHZhbGlkYXRlQ2hhbmdlLmNhbGwodGhpcyk7XG4gICAgdmFsaWRhdGVPYmplY3QuY2FsbCh0aGlzLCBtb2RlbCk7XG4gICAgdmFyIHJlbGF0aW9uc2hpcEZpZWxkcyA9IF8ua2V5cyh0aGlzLm1hcHBpbmcucmVsYXRpb25zaGlwcyk7XG4gICAgdmFyIGZpZWxkcyA9IHRoaXMubWFwcGluZy5fZmllbGRzO1xuICAgIHZhciBpc0ZpZWxkID0gZmllbGRzLmluZGV4T2YodGhpcy5maWVsZCkgPiAtMTtcbiAgICB2YXIgaXNSZWxhdGlvbnNoaXBGaWVsZCA9IHJlbGF0aW9uc2hpcEZpZWxkcy5pbmRleE9mKHRoaXMuZmllbGQpID4gLTE7XG4gICAgaWYgKCEoaXNGaWVsZCB8fCBpc1JlbGF0aW9uc2hpcEZpZWxkKSkge1xuICAgICAgICB0aHJvdyBuZXcgUmVzdEVycm9yKCdGaWVsZCBcIicgKyB0aGlzLmZpZWxkICsgJ1wiIGRvZXMgbm90IGV4aXN0IHdpdGhpbiBtYXBwaW5nIFwiJyArIHRoaXMubWFwcGluZy50eXBlICsgJ1wiJyk7XG4gICAgfVxuICAgIGlmICh0aGlzLnR5cGUgPT0gQ2hhbmdlVHlwZS5TZXQpIHtcbiAgICAgICAgYXBwbHlTZXRUb1NpZXN0YU1vZGVsLmNhbGwodGhpcywgaXNGaWVsZCwgbW9kZWwpO1xuICAgIH1cbiAgICBlbHNlIGlmICh0aGlzLnR5cGUgPT0gQ2hhbmdlVHlwZS5TcGxpY2UpIHtcbiAgICAgICAgYXBwbHlTcGxpY2VUb1NpZXN0YU1vZGVsLmNhbGwodGhpcywgaXNGaWVsZCwgbW9kZWwpO1xuICAgIH1cbiAgICBlbHNlIGlmICh0aGlzLnR5cGUgPT0gQ2hhbmdlVHlwZS5SZW1vdmUpIHtcbiAgICAgICAgYXBwbHlSZW1vdmVUb1NpZXN0YU1vZGVsLmNhbGwodGhpcywgaXNGaWVsZCwgbW9kZWwpO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IFJlc3RFcnJvcignVW5rbm93biBjaGFuZ2UgdHlwZSBcIicgKyB0aGlzLnR5cGUudG9TdHJpbmcoKSArICdcIicpO1xuICAgIH1cbn07XG5cbmZ1bmN0aW9uIGNoYW5nZXNCeUlkZW50aWZpZXJzKCkge1xuICAgIHZhciByZXMgPSB7fTtcbiAgICBmb3IgKHZhciBjb2xsZWN0aW9uTmFtZSBpbiB1bm1lcmdlZENoYW5nZXMpIHtcbiAgICAgICAgaWYgKHVubWVyZ2VkQ2hhbmdlcy5oYXNPd25Qcm9wZXJ0eShjb2xsZWN0aW9uTmFtZSkpIHtcbiAgICAgICAgICAgIHZhciBjb2xsZWN0aW9uQ2hhbmdlcyA9IHVubWVyZ2VkQ2hhbmdlc1tjb2xsZWN0aW9uTmFtZV07XG4gICAgICAgICAgICBmb3IgKHZhciBtYXBwaW5nTmFtZSBpbiBjb2xsZWN0aW9uQ2hhbmdlcykge1xuICAgICAgICAgICAgICAgIGlmIChjb2xsZWN0aW9uQ2hhbmdlcy5oYXNPd25Qcm9wZXJ0eShtYXBwaW5nTmFtZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIG1hcHBpbmdDaGFuZ2VzID0gY29sbGVjdGlvbkNoYW5nZXNbbWFwcGluZ05hbWVdO1xuICAgICAgICAgICAgICAgICAgICBleHRlbmQocmVzLCBtYXBwaW5nQ2hhbmdlcyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiByZXM7XG59XG5cbmZ1bmN0aW9uIGNoYW5nZXNGb3JJZGVudGlmaWVyKGlkZW50KSB7XG4gICAgcmV0dXJuIGNoYW5nZXNCeUlkZW50aWZpZXJzKClbaWRlbnRdIHx8IFtdO1xufVxuXG5cbi8qKlxuICogTWVyZ2UgdW5tZXJnZWRDaGFuZ2VzIGludG8gUG91Y2hEQlxuICovXG5mdW5jdGlvbiBtZXJnZUNoYW5nZXMoY2FsbGJhY2spIHtcbiAgICB2YXIgZGVmZXJyZWQgPSBxLmRlZmVyKCk7XG4gICAgY2FsbGJhY2sgPSB1dGlsLmNvbnN0cnVjdENhbGxiYWNrQW5kUHJvbWlzZUhhbmRsZXIoY2FsbGJhY2ssIGRlZmVycmVkKTtcbiAgICB2YXIgY2hhbmdlc0J5SWRlbnRzID0gY2hhbmdlc0J5SWRlbnRpZmllcnMoKTtcbiAgICB2YXIgbnVtQ2hhbmdlcyA9IF8ua2V5cyhjaGFuZ2VzQnlJZGVudHMpLmxlbmd0aDtcbiAgICBpZiAobnVtQ2hhbmdlcykge1xuICAgICAgICBpZiAoTG9nZ2VyLmRlYnVnLmlzRW5hYmxlZClcbiAgICAgICAgICAgIExvZ2dlci5kZWJ1ZygnTWVyZ2luZyAnICsgbnVtQ2hhbmdlcy50b1N0cmluZygpICsgJyBjaGFuZ2VzJyk7XG4gICAgICAgIHZhciBvcCA9IG5ldyBPcGVyYXRpb24oJ01lcmdlIENoYW5nZXMnLCBmdW5jdGlvbiAoZG9uZSkge1xuICAgICAgICAgICAgaWYgKExvZ2dlci5kZWJ1Zy5pc0VuYWJsZWQpXG4gICAgICAgICAgICAgICAgTG9nZ2VyLmRlYnVnKCdCZWdnaW5pbmcgbWVyZ2Ugb3BlcmF0aW9uJyk7XG4gICAgICAgICAgICB2YXIgaWRlbnRpZmllcnMgPSBbXTtcbiAgICAgICAgICAgIGZvciAodmFyIHByb3AgaW4gY2hhbmdlc0J5SWRlbnRzKSB7XG4gICAgICAgICAgICAgICAgaWYgKGNoYW5nZXNCeUlkZW50cy5oYXNPd25Qcm9wZXJ0eShwcm9wKSkge1xuICAgICAgICAgICAgICAgICAgICBpZGVudGlmaWVycy5wdXNoKHByb3ApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHZhciBkYiA9IHBvdWNoLmdldFBvdWNoKCk7XG4gICAgICAgICAgICBpZiAoTG9nZ2VyLmRlYnVnLmlzRW5hYmxlZClcbiAgICAgICAgICAgICAgICBMb2dnZXIuZGVidWcoJ0dldHRpbmcgZG9jcycpO1xuICAgICAgICAgICAgXy5lYWNoKGlkZW50aWZpZXJzLCBmdW5jdGlvbiAoaSkge3dhaXRpbmdGb3JPYnNlcnZhdGlvbnNbaV0gPSB7fX0pO1xuICAgICAgICAgICAgZGIuYWxsRG9jcyh7a2V5czogaWRlbnRpZmllcnMsIGluY2x1ZGVfZG9jczogdHJ1ZX0sIGZ1bmN0aW9uIChlcnIsIHJlc3ApIHtcbiAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGRvbmUoZXJyKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChMb2dnZXIuZGVidWcuaXNFbmFibGVkKVxuICAgICAgICAgICAgICAgICAgICAgICAgTG9nZ2VyLmRlYnVnKCdHb3QgZG9jcycpO1xuICAgICAgICAgICAgICAgICAgICB2YXIgYnVsa0RvY3MgPSBbXTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGVycm9ycyA9IFtdO1xuICAgICAgICAgICAgICAgICAgICBpZiAoTG9nZ2VyLmRlYnVnLmlzRW5hYmxlZClcbiAgICAgICAgICAgICAgICAgICAgICAgIExvZ2dlci5kZWJ1ZygnVXBkYXRpbmcgZG9jcyBkb2NzJyk7XG4gICAgICAgICAgICAgICAgICAgIF8uZWFjaChyZXNwLnJvd3MsIGZ1bmN0aW9uIChyb3cpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBkb2M7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAocm93LmVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHJvdy5lcnJvciA9PSAnbm90X2ZvdW5kJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkb2MgPSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBfaWQ6IHJvdy5rZXlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZXJyb3JzLnB1c2gocm93LmVycm9yKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkb2MgPSByb3cuZG9jO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGNoYW5nZSA9IGNoYW5nZXNCeUlkZW50c1tkb2MuX2lkXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIF8uZWFjaChjaGFuZ2UsIGZ1bmN0aW9uIChjKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYy5hcHBseShkb2MpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBidWxrRG9jcy5wdXNoKGRvYyk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICBpZiAoTG9nZ2VyLmRlYnVnLmlzRW5hYmxlZClcbiAgICAgICAgICAgICAgICAgICAgICAgIExvZ2dlci5kZWJ1ZygnU2F2aW5nIGRvY3MnKTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHRhc2tzID0gW107XG4gICAgICAgICAgICAgICAgICAgIHRhc2tzLnB1c2goZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoXy5rZXlzKHdhaXRpbmdGb3JPYnNlcnZhdGlvbnMpLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChMb2dnZXIuZGVidWcuaXNFbmFibGVkKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBMb2dnZXIuZGVidWcoJ3dhaXRpbmcgZm9yIG9ic2VydmF0aW9ucycpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZpbmlzaFdhaXRpbmdGb3JPYnNlcnZhdGlvbnMgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChMb2dnZXIuZGVidWcuaXNFbmFibGVkKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgTG9nZ2VyLmRlYnVnKCdmaW5pc2hlZCB3YWl0aW5nIGZvciBvYnNlcnZhdGlvbnMnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKExvZ2dlci5kZWJ1Zy5pc0VuYWJsZWQpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIExvZ2dlci5kZWJ1Zygnbm8gb2JzZXJ2YXRpb25zIHRvIHdhaXQgZm9yJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIHRhc2tzLnB1c2goZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkYi5idWxrRG9jcyhidWxrRG9jcywgZnVuY3Rpb24gKGVyLCByZXNwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXJyb3JzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZXJyb3JzLnB1c2goZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycm9ycyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoTG9nZ2VyLmRlYnVnLmlzRW5hYmxlZClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIExvZ2dlci5kZWJ1ZygnU2F2ZWQgZG9jcycsIHJlc3ApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgICAgICB1dGlsLnBhcmFsbGVsKHRhc2tzLCBkb25lKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgICAgIG9wLm9uQ29tcGxldGlvbihmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKG9wLmVycm9yKTtcbiAgICAgICAgfSk7XG4gICAgICAgIG1lcmdlUXVldWUuYWRkT3BlcmF0aW9uKG9wKTtcbiAgICB9XG4gICAgZWxzZSBpZiAoY2FsbGJhY2spIHtcbiAgICAgICAgaWYgKExvZ2dlci5kZWJ1Zy5pc0VuYWJsZWQpXG4gICAgICAgICAgICBMb2dnZXIuZGVidWcoJ05vdGhpbmcgdG8gbWVyZ2UnKTtcbiAgICAgICAgY2FsbGJhY2soKTtcbiAgICB9XG4gICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG59XG5cbi8qKlxuICogUmV0dXJucyBhbiBhcnJheSBvZiBhbGwgcGVuZGluZyB1bm1lcmdlZENoYW5nZXMuXG4gKiBAcmV0dXJucyB7QXJyYXl9XG4gKi9cbmZ1bmN0aW9uIGFsbENoYW5nZXMoKSB7XG4gICAgdmFyIGFsbENoYW5nZXMgPSBbXTtcbiAgICBmb3IgKHZhciBjb2xsZWN0aW9uTmFtZSBpbiB1bm1lcmdlZENoYW5nZXMpIHtcbiAgICAgICAgaWYgKHVubWVyZ2VkQ2hhbmdlcy5oYXNPd25Qcm9wZXJ0eShjb2xsZWN0aW9uTmFtZSkpIHtcbiAgICAgICAgICAgIHZhciBjb2xsZWN0aW9uQ2hhbmdlcyA9IHVubWVyZ2VkQ2hhbmdlc1tjb2xsZWN0aW9uTmFtZV07XG4gICAgICAgICAgICBmb3IgKHZhciBtYXBwaW5nTmFtZSBpbiBjb2xsZWN0aW9uQ2hhbmdlcykge1xuICAgICAgICAgICAgICAgIGlmIChjb2xsZWN0aW9uQ2hhbmdlcy5oYXNPd25Qcm9wZXJ0eShtYXBwaW5nTmFtZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIG1hcHBpbmdDaGFuZ2VzID0gY29sbGVjdGlvbkNoYW5nZXNbbWFwcGluZ05hbWVdO1xuICAgICAgICAgICAgICAgICAgICBmb3IgKHZhciBvYmplY3RJZCBpbiBtYXBwaW5nQ2hhbmdlcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG1hcHBpbmdDaGFuZ2VzLmhhc093blByb3BlcnR5KG9iamVjdElkKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFsbENoYW5nZXMgPSBhbGxDaGFuZ2VzLmNvbmNhdChtYXBwaW5nQ2hhbmdlc1tvYmplY3RJZF0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBhbGxDaGFuZ2VzO1xufVxuXG5mdW5jdGlvbiByZXNldENoYW5nZXMoKSB7XG4gICAgdW5tZXJnZWRDaGFuZ2VzID0ge307XG59XG5cblxuLy8gVXNlIGRlZmluZVByb3BlcnR5IHNvIHRoYXQgd2UgY2FuIGluamVjdCB1bm1lcmdlZENoYW5nZXMgZm9yIHRlc3RpbmcuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgJ2NoYW5nZXMnLCB7XG4gICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB1bm1lcmdlZENoYW5nZXM7XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uICh2KSB7XG4gICAgICAgIHVubWVyZ2VkQ2hhbmdlcyA9IHY7XG4gICAgfSxcbiAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxufSk7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCAnYWxsQ2hhbmdlcycsIHtcbiAgICBnZXQ6IGFsbENoYW5nZXMsXG4gICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICBjb25maWd1cmFibGU6IHRydWVcbn0pO1xuXG52YXIgb2xkQ29uc3RydWN0b3IgPSBTaWVzdGFNb2RlbC5wcm90b3R5cGUuY29uc3RydWN0b3I7XG5cbmZ1bmN0aW9uIF9TaWVzdGFNb2RlbChtYXBwaW5nKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIG9sZENvbnN0cnVjdG9yLmNhbGwodGhpcywgbWFwcGluZyk7XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsICdjaGFuZ2VzJywge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiBjaGFuZ2VzRm9ySWRlbnRpZmllcih0aGlzLl9pZCk7XG4gICAgICAgIH0sXG4gICAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICB9KTtcbn1cblxuX1NpZXN0YU1vZGVsLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoU2llc3RhTW9kZWwucHJvdG90eXBlKTtcblxuX1NpZXN0YU1vZGVsLnByb3RvdHlwZS5hcHBseUNoYW5nZXMgPSBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKHRoaXMuX2lkKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgXy5lYWNoKHRoaXMuY2hhbmdlcywgZnVuY3Rpb24gKGMpIHtcbiAgICAgICAgICAgIGMuYXBwbHkoc2VsZik7XG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IFJlc3RFcnJvcignQ2Fubm90IGFwcGx5IGNoYW5nZXMgdG8gb2JqZWN0IHdpdGggbm8gX2lkJyk7XG4gICAgfVxufTtcblxuU2llc3RhTW9kZWwucHJvdG90eXBlID0gbmV3IF9TaWVzdGFNb2RlbCgpO1xuXG4vL25vaW5zcGVjdGlvbiBKU1ZhbGlkYXRlVHlwZXNcblxuZXhwb3J0cy5fU2llc3RhTW9kZWwgPSBfU2llc3RhTW9kZWw7XG5leHBvcnRzLnJlZ2lzdGVyQ2hhbmdlID0gY29yZUNoYW5nZXMucmVnaXN0ZXJDaGFuZ2U7XG5leHBvcnRzLm1lcmdlQ2hhbmdlcyA9IG1lcmdlQ2hhbmdlcztcbmV4cG9ydHMuY2hhbmdlc0ZvcklkZW50aWZpZXIgPSBjaGFuZ2VzRm9ySWRlbnRpZmllcjtcbmV4cG9ydHMucmVzZXRDaGFuZ2VzID0gcmVzZXRDaGFuZ2VzOyIsInZhciBfaSA9IHNpZXN0YS5faW50ZXJuYWxcbiAgICAsIFJlc3RFcnJvciA9IF9pLmVycm9yLlJlc3RFcnJvclxuICAgICwgbWFwcGluZyA9IF9pLm1hcHBpbmdcbiAgICAsIGxvZyA9IF9pLmxvZ1xuICAgICwgdXRpbCA9IF9pLnV0aWxcbiAgICAsIHEgPSBfaS5xXG4gICAgLCBfID0gdXRpbC5fXG4gICAgO1xuXG52YXIgUG91Y2ggPSByZXF1aXJlKCcuL3BvdWNoJyk7XG5cbnZhciBMb2dnZXIgPSBsb2cubG9nZ2VyV2l0aE5hbWUoJ0luZGV4Jyk7XG5Mb2dnZXIuc2V0TGV2ZWwobG9nLkxldmVsLndhcm4pO1xuXG5mdW5jdGlvbiBjb21iaW5lKGEsIG1pbikge1xuICAgIHZhciBmbiA9IGZ1bmN0aW9uIChuLCBzcmMsIGdvdCwgYWxsKSB7XG4gICAgICAgIGlmIChuID09IDApIHtcbiAgICAgICAgICAgIGlmIChnb3QubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgIGFsbFthbGwubGVuZ3RoXSA9IGdvdDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBmb3IgKHZhciBqID0gMDsgaiA8IHNyYy5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgZm4obiAtIDEsIHNyYy5zbGljZShqICsgMSksIGdvdC5jb25jYXQoW3NyY1tqXV0pLCBhbGwpO1xuICAgICAgICB9XG4gICAgfTtcbiAgICB2YXIgYWxsID0gW107XG4gICAgZm9yICh2YXIgaSA9IG1pbjsgaSA8IGEubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgZm4oaSwgYSwgW10sIGFsbCk7XG4gICAgfVxuICAgIGFsbC5wdXNoKGEpO1xuICAgIHJldHVybiBhbGw7XG59XG5cbmZ1bmN0aW9uIGdldEZpZWxkQ29tYmluYXRpb25zKGZpZWxkcykge1xuICAgIHZhciBjb21iaW5hdGlvbnMgPSBjb21iaW5lKGZpZWxkcywgMSk7XG4gICAgY29tYmluYXRpb25zLnB1c2goW10pO1xuICAgIHJldHVybiAgY29tYmluYXRpb25zO1xufVxuXG5mdW5jdGlvbiBjb25zdHJ1Y3RJbmRleGVzKGNvbGxlY3Rpb24sIG1vZGVsTmFtZSwgZmllbGRzKSB7XG4gICAgdmFyIGNvbWJpbmF0aW9ucyA9IGdldEZpZWxkQ29tYmluYXRpb25zKGZpZWxkcyk7XG4gICAgcmV0dXJuIF8ubWFwKGNvbWJpbmF0aW9ucywgZnVuY3Rpb24gKGZpZWxkcykge1xuICAgICAgICByZXR1cm4gbmV3IEluZGV4KGNvbGxlY3Rpb24sIG1vZGVsTmFtZSwgZmllbGRzKTtcbiAgICB9KTtcbn1cblxuZnVuY3Rpb24gaW5zdGFsbEluZGV4ZXMoY29sbGVjdGlvbiwgbW9kZWxOYW1lLCBmaWVsZHMsIGNhbGxiYWNrKSB7XG4gICAgdmFyIGRlZmVycmVkID0gcS5kZWZlcigpO1xuICAgIGNhbGxiYWNrID0gdXRpbC5jb25zdHJ1Y3RDYWxsYmFja0FuZFByb21pc2VIYW5kbGVyKGNhbGxiYWNrLCBkZWZlcnJlZCk7XG4gICAgdmFyIGluZGV4ZXMgPSBjb25zdHJ1Y3RJbmRleGVzKGNvbGxlY3Rpb24sIG1vZGVsTmFtZSwgZmllbGRzKTtcbiAgICB2YXIgbnVtQ29tcGxldGVkID0gMDtcbiAgICB2YXIgZXJyb3JzID0gW107XG4gICAgXy5lYWNoKGluZGV4ZXMsIGZ1bmN0aW9uIChpbmRleCkge1xuICAgICAgICBpbmRleC5pbnN0YWxsKGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICBlcnJvcnMucHVzaChlcnIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbnVtQ29tcGxldGVkKys7XG4gICAgICAgICAgICBpZiAobnVtQ29tcGxldGVkID09IGluZGV4ZXMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgaWYgKExvZ2dlci5pbmZvLmlzRW5hYmxlZClcbiAgICAgICAgICAgICAgICAgICAgTG9nZ2VyLmluZm8oJ1N1Y2Nlc3NmdWxseSBpbnN0YWxsZWQgYWxsIGluZGV4ZXMnKTtcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnJvcnMubGVuZ3RoID8gZXJyb3JzIDogbnVsbCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH0pO1xuICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xufVxuXG5cbmZ1bmN0aW9uIEluZGV4KGNvbGxlY3Rpb24sIHR5cGUsIGZpZWxkc19vcl9maWVsZCkge1xuICAgIHRoaXMudHlwZSA9IHR5cGU7XG4gICAgdGhpcy5jb2xsZWN0aW9uID0gY29sbGVjdGlvbjtcbiAgICBpZiAoZmllbGRzX29yX2ZpZWxkKSB7XG4gICAgICAgIGlmIChmaWVsZHNfb3JfZmllbGQubGVuZ3RoKSB7XG4gICAgICAgICAgICB0aGlzLmZpZWxkcyA9IF8uc29ydEJ5KGZpZWxkc19vcl9maWVsZCwgZnVuY3Rpb24gKHgpIHtyZXR1cm4geH0pO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5maWVsZHMgPSBbZmllbGRzX29yX2ZpZWxkXTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgdGhpcy5maWVsZHMgPSBbXTtcbiAgICB9XG59XG5cbkluZGV4LnByb3RvdHlwZS5fZ2V0RGVzaWduRG9jTmFtZSA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgbmFtZSA9IHRoaXMuX2dldE5hbWUoKTtcbiAgICByZXR1cm4gJ19kZXNpZ24vJyArIG5hbWU7XG59O1xuXG4vKipcbiAqIFJldHVybiBhIFBvdWNoREIgc2Vjb25kYXJ5IGluZGV4LlxuICogU2VlIGh0dHA6Ly9wb3VjaGRiLmNvbS8yMDE0LzA1LzAxL3NlY29uZGFyeS1pbmRleGVzLWhhdmUtbGFuZGVkLWluLXBvdWNoZGIuaHRtbFxuICogQHByaXZhdGVcbiAqL1xuSW5kZXgucHJvdG90eXBlLl9jb25zdHJ1Y3RQb3VjaERiVmlldyA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgbmFtZSA9IHRoaXMuX2dldE5hbWUoKTtcbiAgICB2YXIgaW5kZXggPSB7XG4gICAgICAgIF9pZDogdGhpcy5fZ2V0RGVzaWduRG9jTmFtZSgpLFxuICAgICAgICB2aWV3czoge31cbiAgICB9O1xuICAgIGluZGV4LnZpZXdzW25hbWVdID0ge1xuICAgICAgICBtYXA6IHRoaXMuX2NvbnN0cnVjdE1hcEZ1bmN0aW9uKClcbiAgICB9O1xuICAgIHJldHVybiAgaW5kZXhcbn07XG5cbkluZGV4LnByb3RvdHlwZS5fY29uc3RydWN0TWFwRnVuY3Rpb24gPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5fdmFsaWRhdGUoKTtcbiAgICB2YXIgZmllbGRzID0gdGhpcy5maWVsZHM7XG4gICAgdmFyIHR5cGUgPSB0aGlzLnR5cGU7XG4gICAgdmFyIGNvbGxlY3Rpb24gPSB0aGlzLmNvbGxlY3Rpb247XG4gICAgcmV0dXJuIG1hcHBpbmcuY29uc3RydWN0TWFwRnVuY3Rpb24oY29sbGVjdGlvbiwgdHlwZSwgZmllbGRzKTtcbn07XG5cbkluZGV4LnByb3RvdHlwZS5fdmFsaWRhdGUgPSBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKCF0aGlzLnR5cGUpIHtcbiAgICAgICAgdGhyb3cgbmV3IFJlc3RFcnJvcignVHlwZSBtdXN0IGJlIHNwZWNpZmllZCBpbiBvcmRlciB0byBjb25zdHJ1Y3QgaW5kZXggbWFwIGZ1bmN0aW9uLicsIHtpbmRleDogdGhpc30pO1xuICAgIH1cbiAgICBpZiAoIXRoaXMuY29sbGVjdGlvbikge1xuICAgICAgICB0aHJvdyBuZXcgUmVzdEVycm9yKCdBUEkgbXVzdCBiZSBzcGVjaWZpZWQgaW4gb3JkZXIgdG8gY29uc3RydWN0IGluZGV4IG1hcCBmdW5jdGlvbi4nLCB7aW5kZXg6IHRoaXN9KTtcbiAgICB9XG59O1xuXG5JbmRleC5wcm90b3R5cGUuX2R1bXAgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2dldE5hbWUoKTtcbn07XG5cbkluZGV4LnByb3RvdHlwZS5fZ2V0TmFtZSA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLl92YWxpZGF0ZSgpO1xuICAgIHZhciBhcHBlbmRpeCA9IF8ucmVkdWNlKHRoaXMuZmllbGRzLCBmdW5jdGlvbiAobWVtbywgZmllbGQpIHtyZXR1cm4gbWVtbyArICdfJyArIGZpZWxkfSwgJycpO1xuICAgIHJldHVybiB0aGlzLmNvbGxlY3Rpb24gKyAnXycgKyAnSW5kZXhfJyArIHRoaXMudHlwZSArIGFwcGVuZGl4O1xufTtcblxuSW5kZXgucHJvdG90eXBlLmluc3RhbGwgPSBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICB2YXIgZGVmZXJyZWQgPSBxLmRlZmVyKCk7XG4gICAgY2FsbGJhY2sgPSB1dGlsLmNvbnN0cnVjdENhbGxiYWNrQW5kUHJvbWlzZUhhbmRsZXIoY2FsbGJhY2ssIGRlZmVycmVkKTtcbiAgICB0aGlzLl92YWxpZGF0ZSgpO1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB2YXIgY29uc3RydWN0UG91Y2hEYlZpZXcgPSB0aGlzLl9jb25zdHJ1Y3RQb3VjaERiVmlldygpO1xuICAgIHZhciBpbmRleE5hbWUgPSB0aGlzLl9nZXROYW1lKCk7XG4gICAgaWYgKExvZ2dlci5kZWJ1Zy5pc0VuYWJsZWQpXG4gICAgICAgIExvZ2dlci5kZWJ1ZygnSW5zdGFsbGluZyBJbmRleDogJyArIGluZGV4TmFtZSwgY29uc3RydWN0UG91Y2hEYlZpZXcpO1xuICAgIFBvdWNoLmdldFBvdWNoKCkucHV0KGNvbnN0cnVjdFBvdWNoRGJWaWV3LCBmdW5jdGlvbiAoZXJyLCByZXNwKSB7XG4gICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgIGlmIChlcnIuc3RhdHVzID09PSA0MDkpIHtcbiAgICAgICAgICAgICAgICBpZiAoTG9nZ2VyLmRlYnVnLmlzRW5hYmxlZClcbiAgICAgICAgICAgICAgICAgICAgTG9nZ2VyLmRlYnVnKGluZGV4TmFtZSArICcgYWxyZWFkeSBpbnN0YWxsZWQnKTtcbiAgICAgICAgICAgICAgICBlcnIgPSBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmICghZXJyICYmIEluZGV4LmluZGV4ZXMuaW5kZXhPZihzZWxmKSA8IDApIHtcbiAgICAgICAgICAgIEluZGV4LmluZGV4ZXMucHVzaChzZWxmKTtcbiAgICAgICAgfVxuICAgICAgICBjYWxsYmFjayhlcnIsIHJlc3ApO1xuICAgIH0pO1xuICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xufTtcblxuSW5kZXguaW5kZXhlcyA9IFtdO1xuXG5leHBvcnRzLkluZGV4ID0gSW5kZXg7XG5leHBvcnRzLl9jb25zdHJ1Y3RJbmRleGVzID0gY29uc3RydWN0SW5kZXhlcztcbmV4cG9ydHMuX2dldEZpZWxkQ29tYmluYXRpb25zID0gZ2V0RmllbGRDb21iaW5hdGlvbnM7XG5leHBvcnRzLmluc3RhbGxJbmRleGVzID0gaW5zdGFsbEluZGV4ZXM7XG5cbmV4cG9ydHMuY2xlYXJJbmRleGVzID0gZnVuY3Rpb24gKCkge1xuICAgIEluZGV4LmluZGV4ZXMgPSBbXTtcbn07IiwidmFyIF9pID0gc2llc3RhLl9pbnRlcm5hbFxuICAgICwgbG9nID0gX2kubG9nXG4gICAgLCB1dGlsID0gX2kudXRpbFxuICAgICwgXyA9IHV0aWwuX1xuICAgICwgY2FjaGUgPSBfaS5jYWNoZVxuICAgICwgZ3VpZCA9IF9pLm1pc2MuZ3VpZFxuICAgICwgUmVzdEVycm9yID0gX2kuZXJyb3IuUmVzdEVycm9yXG4gICAgLCBxID0gX2kucVxuICAgICwgQ29sbGVjdGlvblJlZ2lzdHJ5ID0gX2kuQ29sbGVjdGlvblJlZ2lzdHJ5O1xuXG52YXIgTG9nZ2VyID0gbG9nLmxvZ2dlcldpdGhOYW1lKCdQb3VjaCcpO1xuTG9nZ2VyLnNldExldmVsKGxvZy5MZXZlbC53YXJuKTtcblxudmFyIHBvdWNoID0gbmV3IFBvdWNoREIoJ3NpZXN0YScpO1xuXG52YXIgY2hhbmdlRW1pdHRlcjtcbnZhciBjaGFuZ2VPYnNlcnZlcnMgPSBbXTtcblxuY29uZmlndXJlQ2hhbmdlRW1pdHRlcigpO1xuXG52YXIgUE9VQ0hfRVZFTlQgPSAnY2hhbmdlJztcblxuZnVuY3Rpb24gcmV0cnlVbnRpbFdyaXR0ZW5NdWx0aXBsZShkb2NJZCwgbmV3VmFsdWVzLCBjYWxsYmFjaykge1xuICAgIHZhciBkZWZlcnJlZCA9IHEuZGVmZXIoKTtcbiAgICBjYWxsYmFjayA9IHV0aWwuY29uc3RydWN0Q2FsbGJhY2tBbmRQcm9taXNlSGFuZGxlcihjYWxsYmFjaywgZGVmZXJyZWQpO1xuICAgIGdldFBvdWNoKCkuZ2V0KGRvY0lkLCBmdW5jdGlvbiAoZXJyLCBkb2MpIHtcbiAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgdmFyIG1zZyA9ICdVbmFibGUgdG8gZ2V0IGRvYyB3aXRoIF9pZD1cIicgKyBkb2NJZCArICdcIi4gVGhpcyBpcyBhIHNlcmlvdXMgZXJyb3IgYW5kIG1lYW5zIHRoYXQgJyArXG4gICAgICAgICAgICAgICAgJ2EgbGl2ZSBvYmplY3QgaXMgbm93IG91dCBvZiBzeW5jIHdpdGggUG91Y2hEQi4nO1xuICAgICAgICAgICAgTG9nZ2VyLmVycm9yKG1zZyk7XG4gICAgICAgICAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKGVycik7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBmb3IgKHZhciBrZXkgaW4gbmV3VmFsdWVzKSB7XG4gICAgICAgICAgICAgICAgaWYgKG5ld1ZhbHVlcy5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG4gICAgICAgICAgICAgICAgICAgIGRvY1trZXldID0gbmV3VmFsdWVzW2tleV07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZ2V0UG91Y2goKS5wdXQoZG9jLCBmdW5jdGlvbiAoZXJyLCByZXNwKSB7XG4gICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZXJyLnN0YXR1cyA9PSA0MDkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHJ5VW50aWxXcml0dGVuTXVsdGlwbGUoZG9jSWQsIG5ld1ZhbHVlcyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgbXNnID0gJ1VuYWJsZSB0byB1cGRhdGUgZG9jIHdpdGggX2lkPVwiJyArIGRvY0lkICsgJ1wiLiBUaGlzIGlzIGEgc2VyaW91cyBlcnJvciBhbmQgbWVhbnMgdGhhdCAnICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAnYSBsaXZlIG9iamVjdCBpcyBub3cgb3V0IG9mIHN5bmMgd2l0aCBQb3VjaERCLic7XG4gICAgICAgICAgICAgICAgICAgICAgICBMb2dnZXIuZXJyb3IobXNnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKExvZ2dlci50cmFjZS5pc0VuYWJsZWQpXG4gICAgICAgICAgICAgICAgICAgICAgICBMb2dnZXIudHJhY2UoJ1N1Y2Nlc3NmdWxseSBwZXJzaXN0ZWQgdW5tZXJnZWRDaGFuZ2VzOiAnICsgSlNPTi5zdHJpbmdpZnkoe2RvYzogZG9jLl9pZCwgcG91Y2hEQlJlc3BvbnNlOiByZXNwLCBjaGFuZ2VzOiBuZXdWYWx1ZXN9LCBudWxsLCA0KSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2sobnVsbCwgcmVzcC5yZXYpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG59XG5cbmZ1bmN0aW9uIGNvbmZpZ3VyZUNoYW5nZUVtaXR0ZXIoKSB7XG4gICAgaWYgKGNoYW5nZUVtaXR0ZXIpIHtcbiAgICAgICAgY2hhbmdlRW1pdHRlci5jYW5jZWwoKTtcbiAgICB9XG5cbiAgICBjaGFuZ2VFbWl0dGVyID0gcG91Y2guY2hhbmdlcyh7XG4gICAgICAgIHNpbmNlOiAnbm93JyxcbiAgICAgICAgbGl2ZTogdHJ1ZVxuICAgIH0pO1xuXG4gICAgXy5lYWNoKGNoYW5nZU9ic2VydmVycywgZnVuY3Rpb24gKG8pIHtcbiAgICAgICAgY2hhbmdlRW1pdHRlci5vbihQT1VDSF9FVkVOVCwgbyk7XG4gICAgfSk7XG59XG5cbmZ1bmN0aW9uIF9yZXNldChpbk1lbW9yeSkge1xuICAgIHZhciBkYk5hbWUgPSBndWlkKCk7XG4gICAgaWYgKGluTWVtb3J5KSB7XG4gICAgICAgIGlmICh0eXBlb2Ygd2luZG93ICE9ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICBwb3VjaCA9IG5ldyBQb3VjaERCKCdzaWVzdGEtJyArIGRiTmFtZSwge2FkYXB0ZXI6ICdtZW1vcnknfSk7XG4gICAgICAgICAgICBjb25maWd1cmVDaGFuZ2VFbWl0dGVyKCk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICB0aHJvdyAnbnlpJztcbiAgICAgICAgfVxuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgdGhyb3cgJ09ubHkgaW4gbWVtb3J5IHBvdWNoREIgc3VwcG9ydGVkIGF0bSc7XG4vLyAgICAgICAgcG91Y2ggPSBuZXcgUG91Y2hEQihkYk5hbWUpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gcmVzZXQoaW5NZW1vcnksIGNhbGxiYWNrKSB7XG4gICAgdmFyIGRlZmVycmVkID0gcS5kZWZlcigpO1xuICAgIGNhbGxiYWNrID0gdXRpbC5jb25zdHJ1Y3RDYWxsYmFja0FuZFByb21pc2VIYW5kbGVyKGNhbGxiYWNrLCBkZWZlcnJlZCk7XG4gICAgaWYgKHBvdWNoKSB7XG4gICAgICAgIHBvdWNoLmRlc3Ryb3koKTtcbiAgICB9XG4gICAgX3Jlc2V0KGluTWVtb3J5KTtcbiAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKCk7XG4gICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG59XG5cbmZ1bmN0aW9uIGdldFBvdWNoKCkge1xuICAgIHJldHVybiBwb3VjaDtcbn1cblxuZnVuY3Rpb24gdmFsaWRhdGUoZG9jKSB7XG4gICAgdmFyIGNvbGxlY3Rpb25OYW1lID0gZG9jLmNvbGxlY3Rpb247XG4gICAgaWYgKGNvbGxlY3Rpb25OYW1lKSB7XG4gICAgICAgIHZhciBjb2xsZWN0aW9uID0gQ29sbGVjdGlvblJlZ2lzdHJ5W2NvbGxlY3Rpb25OYW1lXTtcbiAgICAgICAgaWYgKGNvbGxlY3Rpb24pIHtcbiAgICAgICAgICAgIHZhciBtYXBwaW5nVHlwZSA9IGRvYy50eXBlO1xuICAgICAgICAgICAgaWYgKG1hcHBpbmdUeXBlKSB7XG4gICAgICAgICAgICAgICAgdmFyIG1hcHBpbmcgPSBjb2xsZWN0aW9uW21hcHBpbmdUeXBlXTtcbiAgICAgICAgICAgICAgICBpZiAobWFwcGluZykge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbWFwcGluZztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBSZXN0RXJyb3IoJ0Nhbm5vdCBjb252ZXJ0IFBvdWNoREIgZG9jdW1lbnQgaW50byBTaWVzdGFNb2RlbC4gJyArXG4gICAgICAgICAgICAgICAgICAgICAgICAnTm8gbWFwcGluZyB3aXRoIHR5cGUgJyArIG1hcHBpbmdUeXBlLnRvU3RyaW5nKCksIHtkb2M6IGRvY30pXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IFJlc3RFcnJvcignQ2Fubm90IGNvbnZlcnQgUG91Y2hEQiBkb2N1bWVudCBpbnRvIFNpZXN0YU1vZGVsLiAnICtcbiAgICAgICAgICAgICAgICAgICAgJ05vIHR5cGUgZmllbGQgd2l0aGluIGRvY3VtZW50Jywge2RvYzogZG9jfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgUmVzdEVycm9yKCdDYW5ub3QgY29udmVydCBQb3VjaERCIGRvY3VtZW50IGludG8gU2llc3RhTW9kZWwuICcgK1xuICAgICAgICAgICAgICAgICdBUEkgXCInICsgY29sbGVjdGlvbk5hbWUudG9TdHJpbmcoKSArICdcIiBkb2VzbnQgZXhpc3QuJywge2RvYzogZG9jfSk7XG4gICAgICAgIH1cblxuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IFJlc3RFcnJvcignQ2Fubm90IGNvbnZlcnQgUG91Y2hEQiBkb2N1bWVudCBpbnRvIFNpZXN0YU1vZGVsLiAnICtcbiAgICAgICAgICAgICdObyBjb2xsZWN0aW9uIGZpZWxkIHdpdGhpbiBkb2N1bWVudCcsIHtkb2M6IGRvY30pO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gdG9OZXcoZG9jKSB7XG4gICAgdmFyIG1hcHBpbmcgPSB2YWxpZGF0ZShkb2MpO1xuICAgIHZhciBvYmogPSBtYXBwaW5nLl9uZXcoe19pZDogZG9jLl9pZH0pO1xuLy8gICAgb2JqLl9pZCA9IGRvYy5faWQ7XG4gICAgb2JqLl9yZXYgPSBkb2MuX3JldjtcbiAgICBvYmouaXNTYXZlZCA9IHRydWU7XG4gICAgZm9yICh2YXIgcHJvcCBpbiBkb2MpIHtcbiAgICAgICAgaWYgKGRvYy5oYXNPd25Qcm9wZXJ0eShwcm9wKSkge1xuICAgICAgICAgICAgaWYgKG9iai5fZmllbGRzLmluZGV4T2YocHJvcCkgPiAtMSkge1xuICAgICAgICAgICAgICAgIG9iai5fX3ZhbHVlc1twcm9wXSA9IGRvY1twcm9wXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKG9iai5fcmVsYXRpb25zaGlwRmllbGRzLmluZGV4T2YocHJvcCkgPiAtMSkge1xuICAgICAgICAgICAgICAgIG9ialtwcm9wICsgJ1Byb3h5J10uX2lkID0gZG9jW3Byb3BdO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBvYmo7XG59XG5cbmZ1bmN0aW9uIHRvU2llc3RhKGRvY3MpIHtcbiAgICBpZiAoTG9nZ2VyLmRlYnVnLmlzRW5hYmxlZCkgTG9nZ2VyLmRlYnVnKCd0b1NpZXN0YScpO1xuICAgIHZhciBtYXBwZWQgPSBbXTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGRvY3MubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIGRvYyA9IGRvY3NbaV07XG4gICAgICAgIGlmIChkb2MpIHtcbiAgICAgICAgICAgIHZhciBvcHRzID0ge19pZDogZG9jLl9pZH07XG4gICAgICAgICAgICB2YXIgdHlwZSA9IGRvYy50eXBlO1xuICAgICAgICAgICAgdmFyIGNvbGxlY3Rpb24gPSBkb2MuY29sbGVjdGlvbjtcbiAgICAgICAgICAgIHZhciBtYXBwaW5nID0gQ29sbGVjdGlvblJlZ2lzdHJ5W2NvbGxlY3Rpb25dW3R5cGVdO1xuICAgICAgICAgICAgaWYgKG1hcHBpbmcuaWQpIHtcbiAgICAgICAgICAgICAgICBvcHRzW21hcHBpbmcuaWRdID0gZG9jW21hcHBpbmcuaWRdO1xuICAgICAgICAgICAgICAgIG9wdHMubWFwcGluZyA9IG1hcHBpbmc7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB2YXIgY2FjaGVkID0gY2FjaGUuZ2V0KG9wdHMpO1xuICAgICAgICAgICAgaWYgKGNhY2hlZCkge1xuICAgICAgICAgICAgICAgIG1hcHBlZFtpXSA9IGNhY2hlZDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIG1hcHBlZFtpXSA9IHRvTmV3KGRvYyk7XG4gICAgICAgICAgICAgICAgY2FjaGUuaW5zZXJ0KG1hcHBlZFtpXSk7XG4gICAgICAgICAgICAgICAgbWFwcGVkW2ldLmFwcGx5Q2hhbmdlcygpOyAgLy8gQXBwbHkgdW5zYXZlZCBjaGFuZ2VzLlxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgbWFwcGVkW2ldID0gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbWFwcGVkO1xufVxuXG5mdW5jdGlvbiBmcm9tKG9iaikge1xuICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKVxuICAgICAgICBMb2dnZXIudHJhY2UoJ2Zyb20nLCB7b2JqOiBvYmp9KTtcbiAgICB2YXIgbWFwcGluZyA9IG9iai5tYXBwaW5nO1xuICAgIHZhciBhZGFwdGVkID0ge307XG4gICAgXy5lYWNoKG1hcHBpbmcuX2ZpZWxkcywgZnVuY3Rpb24gKGYpIHtcbiAgICAgICAgaWYgKExvZ2dlci50cmFjZS5pc0VuYWJsZWQpXG4gICAgICAgICAgICBMb2dnZXIudHJhY2UoJ2ZpZWxkJywgZik7XG4gICAgICAgIHZhciB2ID0gb2JqW2ZdO1xuICAgICAgICBpZiAoTG9nZ2VyLnRyYWNlLmlzRW5hYmxlZClcbiAgICAgICAgICAgIExvZ2dlci50cmFjZShmICsgJz0nLCB2KTtcbiAgICAgICAgaWYgKHYpIHtcbiAgICAgICAgICAgIGFkYXB0ZWRbZl0gPSB2O1xuICAgICAgICB9XG4gICAgfSk7XG4gICAgXy5lYWNoKG9iai5fcHJveGllcywgZnVuY3Rpb24gKHApIHtcbiAgICAgICAgLy8gT25seSBmb3J3YXJkIHJlbGF0aW9uc2hpcHMgYXJlIHN0b3JlZCBpbiB0aGUgZGF0YWJhc2UuXG4gICAgICAgIGlmIChwLmlzRm9yd2FyZCkge1xuICAgICAgICAgICAgdmFyIG5hbWUgPSBwLmZvcndhcmROYW1lO1xuICAgICAgICAgICAgaWYgKHAuX2lkKSB7XG4gICAgICAgICAgICAgICAgYWRhcHRlZFtuYW1lXSA9IHAuX2lkO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG4gICAgYWRhcHRlZC5faWQgPSBvYmouX2lkO1xuICAgIGFkYXB0ZWQuX3JldiA9IG9iai5fcmV2O1xuICAgIGFkYXB0ZWQudHlwZSA9IG9iai5tYXBwaW5nLnR5cGU7XG4gICAgYWRhcHRlZC5jb2xsZWN0aW9uID0gb2JqLmNvbGxlY3Rpb247XG4gICAgcmV0dXJuIGFkYXB0ZWQ7XG59XG5cbmV4cG9ydHMudG9OZXcgPSB0b05ldztcbmV4cG9ydHMuX3ZhbGlkYXRlID0gdmFsaWRhdGU7XG5leHBvcnRzLmZyb20gPSBmcm9tO1xuZXhwb3J0cy50b1NpZXN0YSA9IHRvU2llc3RhO1xuZXhwb3J0cy5yZXRyeVVudGlsV3JpdHRlbk11bHRpcGxlID0gcmV0cnlVbnRpbFdyaXR0ZW5NdWx0aXBsZTtcbmV4cG9ydHMucmVzZXQgPSByZXNldDtcbmV4cG9ydHMuZ2V0UG91Y2ggPSBnZXRQb3VjaDtcbmV4cG9ydHMuc2V0UG91Y2ggPSBmdW5jdGlvbiAoX3ApIHtcbiAgICBwb3VjaCA9IF9wO1xuICAgIGNvbmZpZ3VyZUNoYW5nZUVtaXR0ZXIoKTtcbn07XG5cbmV4cG9ydHMuYWRkT2JzZXJ2ZXIgPSBmdW5jdGlvbiAobykge1xuICAgIGlmIChMb2dnZXIuZGVidWcuaXNFbmFibGVkKSBMb2dnZXIuZGVidWcoJ0FkZGluZyBvYnNlcnZlcicsIG8pO1xuICAgIGNoYW5nZU9ic2VydmVycy5wdXNoKG8pO1xuICAgIGlmIChjaGFuZ2VFbWl0dGVyKSBjaGFuZ2VFbWl0dGVyLm9uKFBPVUNIX0VWRU5ULCBvKTtcbn07XG5cbmV4cG9ydHMucmVtb3ZlT2JzZXJ2ZXIgPSBmdW5jdGlvbiAobykge1xuICAgIHZhciBpZHggPSBjaGFuZ2VPYnNlcnZlcnMuaW5kZXhPZihvKTtcbiAgICBpZiAoaWR4ID4gLTEpIHtcbiAgICAgICAgaWYgKGNoYW5nZUVtaXR0ZXIpIGNoYW5nZUVtaXR0ZXIucmVtb3ZlTGlzdGVuZXIoUE9VQ0hfRVZFTlQsIG8pO1xuICAgICAgICBjaGFuZ2VPYnNlcnZlcnMuc3BsaWNlKGlkeCwgMSk7XG4gICAgfVxufTsiLCJ2YXIgX2kgPSBzaWVzdGEuX2ludGVybmFsXG4gICAgLCBtYXBwaW5nID0gX2kubWFwcGluZ1xuICAgICwgdXRpbHMgPSBfaS51dGlsc1xuICAgICwgdXRpbCA9IF9pLnV0aWxzXG4gICAgLCBfID0gdXRpbHMuX1xuICAgICwgbG9nID0gX2kubG9nXG4gICAgLCBSZXN0RXJyb3IgPSBfaS5lcnJvci5SZXN0RXJyb3JcbiAgICAsIFF1ZXJ5ID0gX2kucXVlcnkuUXVlcnlcbiAgICAsIHEgPSBfaS5xXG47XG5cbnZhciBMb2dnZXIgPSBsb2cubG9nZ2VyV2l0aE5hbWUoJ1Jhd1F1ZXJ5Jyk7XG5Mb2dnZXIuc2V0TGV2ZWwobG9nLkxldmVsLndhcm4pO1xuXG52YXIgUG91Y2ggPSByZXF1aXJlKCcuL3BvdWNoJylcbiAgICAsIGluZGV4ID0gcmVxdWlyZSgnLi9pbmRleCcpXG4gICAgLCBJbmRleCA9IGluZGV4LkluZGV4XG4gICAgO1xuXG5mdW5jdGlvbiBSYXdRdWVyeShjb2xsZWN0aW9uLCBtb2RlbE5hbWUsIHF1ZXJ5KSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHRoaXMuY29sbGVjdGlvbiA9IGNvbGxlY3Rpb247XG4gICAgdGhpcy5tb2RlbE5hbWUgPSBtb2RlbE5hbWU7XG4gICAgdGhpcy5xdWVyeSA9IHF1ZXJ5O1xuXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHNlbGYsICdtYXBwaW5nJywge1xuICAgICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdmFyIGNvbGxlY3Rpb24gPSByZXF1aXJlKCcuL2luZGV4Jylbc2VsZi5jb2xsZWN0aW9uXTtcbiAgICAgICAgICAgIGlmIChjb2xsZWN0aW9uKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGNvbGxlY3Rpb25bc2VsZi5tb2RlbE5hbWVdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICB9KTtcbn1cblxuZnVuY3Rpb24gcmVzdWx0c0NhbGxiYWNrKGNhbGxiYWNrLCBlcnIsIHJlc3ApIHtcbiAgICB2YXIgZGVmZXJyZWQgPSBxLmRlZmVyKCk7XG4gICAgY2FsbGJhY2sgPSB1dGlsLmNvbnN0cnVjdENhbGxiYWNrQW5kUHJvbWlzZUhhbmRsZXIoY2FsbGJhY2ssIGRlZmVycmVkKTtcbiAgICBpZiAoZXJyKSB7XG4gICAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2soZXJyKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIHZhciByZXN1bHRzID0gXy5wbHVjayhyZXNwLnJvd3MsICd2YWx1ZScpO1xuICAgICAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKG51bGwsIHJlc3VsdHMpO1xuICAgIH1cbiAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbn1cblxuUmF3UXVlcnkucHJvdG90eXBlLmV4ZWN1dGUgPSBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICB2YXIgZGVmZXJyZWQgPSBxLmRlZmVyKCk7XG4gICAgY2FsbGJhY2sgPSB1dGlsLmNvbnN0cnVjdENhbGxiYWNrQW5kUHJvbWlzZUhhbmRsZXIoY2FsbGJhY2ssIGRlZmVycmVkKTtcbiAgICBpZiAodGhpcy5tYXBwaW5nKSB7IC8vIER1cmluZyB1bml0IHRlc3RpbmcsIHdlIGRvbid0IHBvcHVsYXRlIHRoaXMubWFwcGluZywgYnV0IHJhdGhlciBjb25maWd1cmUgUG91Y2ggbWFudWFsbHkuXG4gICAgICAgIGlmICghdGhpcy5tYXBwaW5nLmluc3RhbGxlZCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IFJlc3RFcnJvcignTWFwcGluZyBtdXN0IGJlIGluc3RhbGxlZCcpO1xuICAgICAgICB9XG4gICAgfVxuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB2YXIgZGVzaWduRG9jSWQgPSB0aGlzLl9nZXREZXNpZ25Eb2NOYW1lKCk7XG4gICAgdmFyIGluZGV4TmFtZSA9IHNlbGYuX2dldEluZGV4TmFtZSgpO1xuICAgIFBvdWNoLmdldFBvdWNoKCkuZ2V0KGRlc2lnbkRvY0lkLCBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgIHZhciBwYXJ0aWFsQ2FsbGJhY2sgPSBfLnBhcnRpYWwocmVzdWx0c0NhbGxiYWNrLCBjYWxsYmFjayk7XG5cbiAgICAgICAgZnVuY3Rpb24gZmluaXNoKGVyciwgZG9jcykge1xuICAgICAgICAgICAgaWYgKExvZ2dlci50cmFjZS5pc0VuYWJsZWQpXG4gICAgICAgICAgICAgICAgTG9nZ2VyLnRyYWNlKCdSZWNlaXZlZCByZXN1bHRzOiAnLCBkb2NzKTtcbiAgICAgICAgICAgIHBhcnRpYWxDYWxsYmFjayhlcnIsIGRvY3MpO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGtleTtcbiAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgIGtleSA9IHNlbGYuX2NvbnN0cnVjdEtleSgpO1xuICAgICAgICAgICAgaWYgKCFrZXkubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAga2V5ID0gc2VsZi5tb2RlbE5hbWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoTG9nZ2VyLmRlYnVnLmlzRW5hYmxlZClcbiAgICAgICAgICAgICAgICBMb2dnZXIuZGVidWcoJ0V4ZWN1dGluZyBxdWVyeSAnICsgaW5kZXhOYW1lICsgJzonICsgJyAnICsga2V5KTtcbiAgICAgICAgICAgIFBvdWNoLmdldFBvdWNoKCkucXVlcnkoaW5kZXhOYW1lLCB7a2V5OiBrZXl9LCBmaW5pc2gpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgaWYgKGVyci5zdGF0dXMgPT0gNDA0KSB7XG4gICAgICAgICAgICAgICAgTG9nZ2VyLndhcm4oJ0NvdWxkbnQgZmluZCBpbmRleCBcIicgKyBpbmRleE5hbWUgKyAnXCIgYW5kIGhlbmNlIG11c3QgaXRlcmF0ZSB0aHJvdWdoIGV2ZXJ5IHNpbmdsZSBkb2N1bWVudC4nKTtcbiAgICAgICAgICAgICAgICB2YXIgZmllbGRzID0gc2VsZi5fc29ydGVkRmllbGRzKCk7XG4gICAgICAgICAgICAgICAgLy8gVE9ETzogQ2xlYW4gdXAgY29uc3RydWN0TWFwRnVuY3Rpb24gc28gY2FuIG91dHB1dCBib3RoIHN0cmluZytmdW5jIHZlcnNpb24gc28gZG9uJ3QgbmVlZCBldmFsIGhlcmUuXG4gICAgICAgICAgICAgICAgLy8gVE9ETzogRm9yIHNvbWUgcmVhc29uIGNvbnN0cnVjdE1hcEZ1bmN0aW9uMiAod2hpY2ggcmV0dXJucyBhIGZ1bmN0aW9uKSB3b250IHdvcmsgd2l0aCBwb3VjaC5cbiAgICAgICAgICAgICAgICAvLyBJJ20gdGhpbmtpbmcgdGhhdCBwb3VjaCBwcm9iYWJseSBkb2VzbnQgc3VwcG9ydCBjbG9zdXJlcyBpbiBpdHMgcXVlcmllcyB3aGljaCB3b3VsZCBtZWFuXG4gICAgICAgICAgICAgICAgLy8gd2UnZCBoYXZlIHRvIHN0aWNrIHdpdGggZXZhbCBoZXJlLlxuICAgICAgICAgICAgICAgIHZhciBmID0gbWFwcGluZy5jb25zdHJ1Y3RNYXBGdW5jdGlvbihzZWxmLmNvbGxlY3Rpb24sIHNlbGYubW9kZWxOYW1lLCBmaWVsZHMpO1xuICAgICAgICAgICAgICAgIGV2YWwoJ3ZhciBtYXBGdW5jID0gJyArIGYpO1xuICAgICAgICAgICAgICAgIGtleSA9IHNlbGYuX2NvbnN0cnVjdEtleShmaWVsZHMpO1xuICAgICAgICAgICAgICAgIGlmICgha2V5Lmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICBrZXkgPSBzZWxmLm1vZGVsTmFtZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy9ub2luc3BlY3Rpb24gSlNVbnJlc29sdmVkVmFyaWFibGVcbiAgICAgICAgICAgICAgICBQb3VjaC5nZXRQb3VjaCgpLnF1ZXJ5KG1hcEZ1bmMsIHtrZXk6IGtleX0sIGZpbmlzaCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBmaW5pc2goZXJyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xufTtcblxuUmF3UXVlcnkucHJvdG90eXBlLl9nZXRGaWVsZHMgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIGZpZWxkcyA9IFtdO1xuICAgIGZvciAodmFyIGZpZWxkIGluIHRoaXMucXVlcnkpIHtcbiAgICAgICAgaWYgKHRoaXMucXVlcnkuaGFzT3duUHJvcGVydHkoZmllbGQpKSB7XG4gICAgICAgICAgICBmaWVsZHMucHVzaChmaWVsZCk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGZpZWxkcztcbn07XG5cblJhd1F1ZXJ5LnByb3RvdHlwZS5fc29ydGVkRmllbGRzID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBmaWVsZHMgPSB0aGlzLl9nZXRGaWVsZHMoKTtcbiAgICByZXR1cm4gXy5zb3J0QnkoZmllbGRzLCBmdW5jdGlvbiAoeCkge3JldHVybiB4fSk7XG59O1xuXG5SYXdRdWVyeS5wcm90b3R5cGUuX2NvbnN0cnVjdEtleSA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIHNvcnRlZEZpZWxkcyA9IHRoaXMuX3NvcnRlZEZpZWxkcygpO1xuICAgIHZhciBrZXkgPSBfLnJlZHVjZShzb3J0ZWRGaWVsZHMsIGZ1bmN0aW9uIChtZW1vLCB4KSB7XG4gICAgICAgIHZhciB2O1xuICAgICAgICBpZiAoeCA9PT0gbnVsbCkge1xuICAgICAgICAgICAgdiA9ICdudWxsJztcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmICh4ID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHYgPSAndW5kZWZpbmVkJztcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHYgPSBzZWxmLnF1ZXJ5W3hdLnRvU3RyaW5nKClcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbWVtbyArIHYgKyAnXyc7XG4gICAgfSwgJycpO1xuICAgIHJldHVybiBrZXkuc3Vic3RyaW5nKDAsIGtleS5sZW5ndGggLSAxKTtcbn07XG5cblJhd1F1ZXJ5LnByb3RvdHlwZS5fZ2V0RGVzaWduRG9jTmFtZSA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgaSA9IG5ldyBpbmRleC5JbmRleCh0aGlzLmNvbGxlY3Rpb24sIHRoaXMubW9kZWxOYW1lLCB0aGlzLl9nZXRGaWVsZHMoKSk7XG4gICAgcmV0dXJuIGkuX2dldERlc2lnbkRvY05hbWUoKTtcbn07XG5cblJhd1F1ZXJ5LnByb3RvdHlwZS5fZ2V0SW5kZXhOYW1lID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBpID0gbmV3IGluZGV4LkluZGV4KHRoaXMuY29sbGVjdGlvbiwgdGhpcy5tb2RlbE5hbWUsIHRoaXMuX2dldEZpZWxkcygpKTtcbiAgICByZXR1cm4gaS5fZ2V0TmFtZSgpO1xufTtcblxuUmF3UXVlcnkucHJvdG90eXBlLl9kdW1wID0gZnVuY3Rpb24gKGFzSnNvbikge1xuICAgIHZhciBvYmogPSB7fTtcbiAgICBvYmouY29sbGVjdGlvbiA9IHRoaXMuY29sbGVjdGlvbjtcbiAgICBvYmoubWFwcGluZyA9IHRoaXMubW9kZWxOYW1lO1xuICAgIG9iai5xdWVyeSA9IHRoaXMucXVlcnk7XG4gICAgb2JqLmluZGV4ID0gdGhpcy5fZ2V0SW5kZXhOYW1lKCk7XG4gICAgb2JqLmRlc2lnbkRvYyA9IHRoaXMuX2dldERlc2lnbkRvY05hbWUoKTtcbiAgICByZXR1cm4gYXNKc29uID8gSlNPTi5zdHJpbmdpZnkob2JqLCBudWxsLCA0KSA6IG9iajtcbn07XG5cblxuXG5leHBvcnRzLlJhd1F1ZXJ5ID0gUmF3UXVlcnk7IiwiKGZ1bmN0aW9uICgpIHtcblxuICAgIHZhciBfaSA9IHNpZXN0YS5faW50ZXJuYWxcbiAgICAgICAgLCBtYXBwaW5nID0gX2kubWFwcGluZ1xuICAgICAgICAsIHEgPSBfaS5xXG4gICAgICAgICwgdXRpbCA9IF9pLnV0aWxcbiAgICAgICAgLCBleHRlbmQgPSBfLmV4dGVuZFxuICAgICAgICAsIE1hcHBpbmcgPSBtYXBwaW5nLk1hcHBpbmdcbiAgICAgICAgO1xuXG4gICAgdmFyIGNoYW5nZXMgPSByZXF1aXJlKCcuL2NoYW5nZXMnKVxuICAgICAgICAsIHBvdWNoID0gcmVxdWlyZSgnLi9wb3VjaCcpXG4gICAgICAgICwgcXVlcnkgPSByZXF1aXJlKCcuL3F1ZXJ5JylcbiAgICAgICAgLCBpbmRleCA9IHJlcXVpcmUoJy4vaW5kZXgnKVxuICAgICAgICAsIHN0b3JlID0gcmVxdWlyZSgnLi9zdG9yZScpXG4gICAgICAgIDtcblxuICAgIHZhciBvbGRSZXNldCA9IHNpZXN0YS5yZXNldDtcblxuICAgIHNpZXN0YS5yZXNldCA9IGZ1bmN0aW9uIChpbk1lbW9yeSwgY2FsbGJhY2spIHtcbiAgICAgICAgY2hhbmdlcy5yZXNldENoYW5nZXMoKTtcbiAgICAgICAgaW5kZXguY2xlYXJJbmRleGVzKCk7XG4gICAgICAgIHBvdWNoLnJlc2V0KGluTWVtb3J5LCBjYWxsYmFjayk7XG4gICAgICAgIG9sZFJlc2V0LmFwcGx5KG9sZFJlc2V0LCBhcmd1bWVudHMpO1xuICAgIH07XG5cbiAgICB2YXIgb2xkSW5zdGFsbCA9IG1hcHBpbmcuTWFwcGluZy5wcm90b3R5cGUuaW5zdGFsbDtcblxuICAgIE1hcHBpbmcucHJvdG90eXBlLmdldEluZGV4ZXNUb0luc3RhbGwgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgdmFyIGZpZWxkSGFzaCA9IF8ucmVkdWNlKHNlbGYuX2ZpZWxkcywgZnVuY3Rpb24gKG0sIGYpIHtcbiAgICAgICAgICAgIG1bZl0gPSB7fTtcbiAgICAgICAgICAgIHJldHVybiBtXG4gICAgICAgIH0sIHt9KTtcbiAgICAgICAgZm9yICh2YXIgcHJvcCBpbiBzZWxmLnJlbGF0aW9uc2hpcHMpIHtcbiAgICAgICAgICAgIGlmIChzZWxmLnJlbGF0aW9uc2hpcHMuaGFzT3duUHJvcGVydHkocHJvcCkpIHtcbiAgICAgICAgICAgICAgICB2YXIgciA9IHNlbGYucmVsYXRpb25zaGlwc1twcm9wXTtcbiAgICAgICAgICAgICAgICBpZiAoci5yZXZlcnNlICE9IHByb3ApIHtcbiAgICAgICAgICAgICAgICAgICAgZmllbGRIYXNoW3Byb3BdID0ge307XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHZhciBpbmRleGVzVG9JbnN0YWxsID0gXy5yZWR1Y2Uoc2VsZi5pbmRleGVzLCBmdW5jdGlvbiAobSwgZikge1xuICAgICAgICAgICAgaWYgKGZpZWxkSGFzaFtmXSkgbS5wdXNoKGYpO1xuICAgICAgICAgICAgcmV0dXJuIG07XG4gICAgICAgIH0sIFtdKTtcbiAgICAgICAgaWYgKHNlbGYuaWQpIGluZGV4ZXNUb0luc3RhbGwucHVzaChzZWxmLmlkKTtcbiAgICAgICAgcmV0dXJuICBpbmRleGVzVG9JbnN0YWxsO1xuICAgIH07XG5cbiAgICBNYXBwaW5nLnByb3RvdHlwZS5pbnN0YWxsID0gZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgICAgIHZhciBkZWZlcnJlZCA9IHEuZGVmZXIoKTtcbiAgICAgICAgY2FsbGJhY2sgPSB1dGlsLmNvbnN0cnVjdENhbGxiYWNrQW5kUHJvbWlzZUhhbmRsZXIoY2FsbGJhY2ssIGRlZmVycmVkKTtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICBvbGRJbnN0YWxsLmNhbGwodGhpcywgZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgICAgICB2YXIgaW5kZXhlc1RvSW5zdGFsbCA9IHNlbGYuZ2V0SW5kZXhlc1RvSW5zdGFsbCgpO1xuICAgICAgICAgICAgICAgIGluZGV4Lmluc3RhbGxJbmRleGVzKHNlbGYuY29sbGVjdGlvbiwgc2VsZi50eXBlLCBpbmRleGVzVG9JbnN0YWxsLCBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIHNlbGYuX2luc3RhbGxlZCA9ICFlcnI7XG4gICAgICAgICAgICAgICAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKGNhbGxiYWNrKSB7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xuICAgIH07XG5cbiAgICBpZiAoIXNpZXN0YS5leHQpIHtcbiAgICAgICAgc2llc3RhLmV4dCA9IHt9O1xuICAgIH1cblxuICAgIHNpZXN0YS5leHQuc3RvcmFnZSA9IHtcbiAgICAgICAgY2hhbmdlczogY2hhbmdlcyxcbiAgICAgICAgcG91Y2g6IHBvdWNoLFxuICAgICAgICBQb3VjaDogcG91Y2gsXG4gICAgICAgIHF1ZXJ5OiBxdWVyeSxcbiAgICAgICAgaW5kZXg6IGluZGV4LFxuICAgICAgICBzdG9yZTogc3RvcmUsXG4gICAgICAgIEluZGV4OiBpbmRleC5JbmRleCxcbiAgICAgICAgUmF3UXVlcnk6IHF1ZXJ5LlJhd1F1ZXJ5XG4gICAgfTtcblxufSkoKTsiLCJ2YXIgX2kgPSBzaWVzdGEuX2ludGVybmFsXG4gICAgLCB3cmFwcGVkQ2FsbGJhY2sgPSBfaS5taXNjLndyYXBwZWRDYWxsYmFja1xuICAgICwgdXRpbCA9IF9pLnV0aWxcbiAgICAsIF8gPSB1dGlsLl9cbiAgICAsIGNhY2hlID0gX2kuY2FjaGVcbiAgICAsIFJlc3RFcnJvciA9IF9pLmVycm9yLlJlc3RFcnJvclxuICAgICwgbG9nID0gX2kubG9nXG4gICAgLCBjb3JlU3RvcmUgPSBfaS5zdG9yZVxuICAgICwgcSA9IF9pLnFcbjtcblxudmFyIExvZ2dlciA9IGxvZy5sb2dnZXJXaXRoTmFtZSgnU3RvcmUnKTtcbkxvZ2dlci5zZXRMZXZlbChsb2cuTGV2ZWwud2Fybik7XG5cbnZhciBQb3VjaEFkYXB0ZXIgPSByZXF1aXJlKCcuL3BvdWNoJyk7XG52YXIgaW5kZXggPSByZXF1aXJlKCcuL2luZGV4Jyk7XG52YXIgSW5kZXggPSBpbmRleC5JbmRleDtcblxuZnVuY3Rpb24gZ2V0RnJvbVBvdWNoKG9wdHMsIGNhbGxiYWNrKSB7XG4gICAgUG91Y2hBZGFwdGVyLmdldFBvdWNoKCkuZ2V0KG9wdHMuX2lkKS50aGVuKGZ1bmN0aW9uIChkb2MpIHtcbiAgICAgICAgdmFyIGRvY3MgPSBQb3VjaEFkYXB0ZXIudG9TaWVzdGEoW2RvY10pO1xuICAgICAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKG51bGwsIGRvY3MubGVuZ3RoID8gZG9jc1swXSA6IG51bGwpO1xuICAgIH0sIHdyYXBwZWRDYWxsYmFjayhjYWxsYmFjaykpO1xufVxuXG5mdW5jdGlvbiBnZXRNdWx0aXBsZUxvY2FsRnJvbUNvdWNoKHJlc3VsdHMsIGNhbGxiYWNrKSB7XG4gICAgdmFyIGRlZmVycmVkID0gcS5kZWZlcigpO1xuICAgIGNhbGxiYWNrID0gdXRpbC5jb25zdHJ1Y3RDYWxsYmFja0FuZFByb21pc2VIYW5kbGVyKGNhbGxiYWNrLCBkZWZlcnJlZCk7XG4gICAgUG91Y2hBZGFwdGVyLmdldFBvdWNoKCkuYWxsRG9jcyh7a2V5czogcmVzdWx0cy5ub3RDYWNoZWQsIGluY2x1ZGVfZG9jczogdHJ1ZX0sIGZ1bmN0aW9uIChlcnIsIGRvY3MpIHtcbiAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHZhciByb3dzID0gXy5wbHVjayhkb2NzLnJvd3MsICdkb2MnKTtcbiAgICAgICAgICAgIHZhciBtb2RlbHMgPSBQb3VjaEFkYXB0ZXIudG9TaWVzdGEocm93cyk7XG4gICAgICAgICAgICBfLmVhY2gobW9kZWxzLCBmdW5jdGlvbiAobSkge1xuICAgICAgICAgICAgICAgIGlmIChtKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdHMuY2FjaGVkW20uX2lkXSA9IG07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG59XG5cbmZ1bmN0aW9uIGdldE11bHRpcGxlUmVtb3RlRnJvbXBvdWNoKG1hcHBpbmcsIHJlbW90ZUlkZW50aWZpZXJzLCByZXN1bHRzLCBjYWxsYmFjaykge1xuICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKSBMb2dnZXIudHJhY2UoJ2dldE11bHRpcGxlUmVtb3RlRnJvbXBvdWNoKCcgKyBtYXBwaW5nLnR5cGUgKyAnKTonLCByZW1vdGVJZGVudGlmaWVycyk7XG4gICAgdmFyIGRlZmVycmVkID0gcS5kZWZlcigpO1xuICAgIGNhbGxiYWNrID0gdXRpbC5jb25zdHJ1Y3RDYWxsYmFja0FuZFByb21pc2VIYW5kbGVyKGNhbGxiYWNrLCBkZWZlcnJlZCk7XG4gICAgdmFyIGkgPSBuZXcgSW5kZXgobWFwcGluZy5jb2xsZWN0aW9uLCBtYXBwaW5nLnR5cGUsIFttYXBwaW5nLmlkXSk7XG4gICAgdmFyIG5hbWUgPSBpLl9nZXROYW1lKCk7XG4gICAgUG91Y2hBZGFwdGVyLmdldFBvdWNoKCkucXVlcnkobmFtZSwge2tleXM6IF8ubWFwKHJlbW90ZUlkZW50aWZpZXJzLCBmdW5jdGlvbiAoaSkge3JldHVybiBpLnRvU3RyaW5nKCk7fSksIGluY2x1ZGVfZG9jczogdHJ1ZX0sIGZ1bmN0aW9uIChlcnIsIGRvY3MpIHtcbiAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHZhciByb3dzID0gXy5wbHVjayhkb2NzLnJvd3MsICd2YWx1ZScpO1xuICAgICAgICAgICAgaWYgKExvZ2dlci50cmFjZS5pc0VuYWJsZWQpIExvZ2dlci50cmFjZSgnW1JPV1NdIGdldE11bHRpcGxlUmVtb3RlRnJvbXBvdWNoKCcgKyBtYXBwaW5nLnR5cGUgKyAnKTonLCByb3dzKTtcbiAgICAgICAgICAgIHZhciBtb2RlbHMgPSBQb3VjaEFkYXB0ZXIudG9TaWVzdGEocm93cyk7XG4gICAgICAgICAgICBfLmVhY2gobW9kZWxzLCBmdW5jdGlvbiAobW9kZWwpIHtcbiAgICAgICAgICAgICAgICB2YXIgcmVtb3RlSWQgPSBtb2RlbFttYXBwaW5nLmlkXTtcbiAgICAgICAgICAgICAgICByZXN1bHRzLmNhY2hlZFtyZW1vdGVJZF0gPSBtb2RlbDtcbiAgICAgICAgICAgICAgICB2YXIgaWR4ID0gcmVzdWx0cy5ub3RDYWNoZWQuaW5kZXhPZihyZW1vdGVJZCk7XG4gICAgICAgICAgICAgICAgcmVzdWx0cy5ub3RDYWNoZWQuc3BsaWNlKGlkeCwgMSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgTG9nZ2VyLnRyYWNlKCdbUkVTVUxUU10gZ2V0TXVsdGlwbGVSZW1vdGVGcm9tcG91Y2goJyArIG1hcHBpbmcudHlwZSArICcpOicsIHJlc3VsdHMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2FsbGJhY2soKTtcbiAgICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xufVxuXG5leHBvcnRzLmdldEZyb21Qb3VjaCA9IGdldEZyb21Qb3VjaDtcbmV4cG9ydHMuZ2V0TXVsdGlwbGVMb2NhbEZyb21Db3VjaCA9IGdldE11bHRpcGxlTG9jYWxGcm9tQ291Y2g7XG5leHBvcnRzLmdldE11bHRpcGxlUmVtb3RlRnJvbXBvdWNoID0gZ2V0TXVsdGlwbGVSZW1vdGVGcm9tcG91Y2g7Il19
