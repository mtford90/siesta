/*
 * Changes describe differences between the in-memory object graph and the object graph sat in the databases.
 *
 * Faulted objects being pulled into memory will have changes applied to them.
 *
 * On siesta.save() all changes will be merged into the database.
 */

var defineSubProperty = require('./../misc').defineSubProperty;

var RestError = require('./../error').RestError;
var ChangeType = require('./changeType').ChangeType;

var pouch = require('./pouch');

var util = require('./../util');
var _ = util._;
var Operation = require('../../vendor/operations.js/src/operation').Operation;
var OperationQueue = require('../../vendor/operations.js/src/queue').OperationQueue;
var SiestaModel = require('./../object').SiestaModel;
var extend = require('extend');
var notificationCentre = require('./../notificationCentre').notificationCentre;

var unmergedChanges = {};

var log = require('../../vendor/operations.js/src/log');
var cache = require('./../cache');
var Logger = log.loggerWithName('changes');

Logger.setLevel(log.Level.warn);

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

/**
 * Represents an individual change.
 * @param opts
 * @constructor
 */
function Change(opts) {
    this._opts = opts;
    if (!this._opts) {
        this._opts = {};
    }
    defineSubProperty.call(this, 'collection', this._opts);
    defineSubProperty.call(this, 'mapping', this._opts);
    defineSubProperty.call(this, '_id', this._opts);
    defineSubProperty.call(this, 'field', this._opts);
    defineSubProperty.call(this, 'type', this._opts);
    defineSubProperty.call(this, 'index', this._opts);
    defineSubProperty.call(this, 'added', this._opts);
    defineSubProperty.call(this, 'addedId', this._opts);
    defineSubProperty.call(this, 'removed', this._opts);
    defineSubProperty.call(this, 'removedId', this._opts);
    defineSubProperty.call(this, 'new', this._opts);
    defineSubProperty.call(this, 'newId', this._opts);
    defineSubProperty.call(this, 'old', this._opts);
    defineSubProperty.call(this, 'oldId', this._opts);
}

Change.prototype._dump = function (json) {
    var dumped = {};
//    dumped.collection = this.collection;
//    dumped.mapping = this.mapping;
//    dumped._id = this._id;
//    dumped.field = this.field;
//    dumped.type = this.type;
//    if (this.index) dumped.index = this.index;
//    if (this.added) dumped.added = _.map(this.added, function (x) {return x._dump()});
//    if (this.removed) dumped.removed = _.map(this.removed, function (x) {return x._dump()});
//    if (this.old) dumped.old = this.old;
//    if (this.new) dumped.new = this.new;
    return json ? JSON.stringify(dumped, null, 4) : dumped;
};

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
    var changes = {};
    for (var collectionName in unmergedChanges) {
        if (unmergedChanges.hasOwnProperty(collectionName)) {
            var collectionChanges = unmergedChanges[collectionName];
            for (var mappingName in collectionChanges) {
                if (collectionChanges.hasOwnProperty(mappingName)) {
                    var mappingChanges = collectionChanges[mappingName];
                    extend(changes, mappingChanges);
                }
            }
        }
    }
    return changes;
}

function changesForIdentifier(ident) {
    return changesByIdentifiers()[ident] || [];
}


/**
 * Merge unmergedChanges into PouchDB
 */
function mergeChanges(callback) {
    var changes = changesByIdentifiers();
    var numChanges = _.keys(changes).length;
    if (numChanges) {
        if (Logger.debug.isEnabled)
            Logger.debug('Merging ' + numChanges.toString() + ' changes');
        var op = new Operation('Merge Changes', function (done) {
            if (Logger.debug.isEnabled)
                Logger.debug('Beggining merge operation');
            var identifiers = [];
            for (var prop in changes) {
                if (changes.hasOwnProperty(prop)) {
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
                        var change = changes[doc._id];
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
}

function broadcast(collection, mapping, c) {
    if (Logger.trace.isEnabled) Logger.trace('Sending notification "' + collection + '"');
    notificationCentre.emit(collection, c);
    var mappingNotif = collection + ':' + mapping;
    if (Logger.trace.isEnabled) Logger.trace('Sending notification "' + mappingNotif + '"');
    notificationCentre.emit(mappingNotif, c);
    var genericNotif = 'Siesta';
    if (Logger.trace.isEnabled) Logger.trace('Sending notification "' + genericNotif + '"');
    notificationCentre.emit(genericNotif, c);
}
/**
 * Register that a change has been made.
 * @param opts
 */
function registerChange(opts) {
    var collection = opts.collection;
    var mapping = opts.mapping;
    var _id = opts._id;
    if (!mapping) throw new RestError('Must pass a mapping');
    if (!collection) throw new RestError('Must pass a collection');
    if (!_id) throw new RestError('Must pass a local identifier');
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
    var c = new Change(opts);
    objChanges.push(c);
    broadcast(collection, mapping, c);
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

exports.Change = Change;
exports.registerChange = registerChange;
exports.mergeChanges = mergeChanges;
exports.changesForIdentifier = changesForIdentifier;
exports.resetChanges = function resetChanges() {
    unmergedChanges = {};
};

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