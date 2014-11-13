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
        var proxy = model.__proxies[this.field];
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
        var proxy = model.__proxies[this.field];
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
        var proxy = model.__proxies[this.field];
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
    var deferred = window.q ? window.q.defer() : null;
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
    return deferred ? deferred.promise : null;
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