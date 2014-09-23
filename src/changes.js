/*
 * Changes describe differences between the in-memory object graph and the object graph sat in the databases.
 *
 * Faulted objects being pulled into memory will have changes applied to them.
 *
 * On siesta.save() all changes will be merged into the database.
 */

var defineSubProperty = require('./misc').defineSubProperty;

var RestError = require('./error').RestError;
var ChangeType = require('./changeType').ChangeType;

var pouch = require('./pouch');

var util = require('./util');
var _ = util._;

var Operation = require('../vendor/operations.js/src/operation').Operation;
var OperationQueue = require('../vendor/operations.js/src/queue').OperationQueue;

var SiestaModel = require('./object').SiestaModel;

var extend = require('extend');

var notificationCentre = require('./notificationCentre').notificationCentre;

var unmergedChanges = {};

var log = require('../vendor/operations.js/src/log');

var Logger = log.loggerWithName('changes');

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

function applySplice(obj, index, removed, added) {
    if (!(removed || added)) {
        throw new RestError('Must remove or add something with a splice change.');
    }
    if (index === undefined || index === null) {
        throw new RestError('Must pass index to splice change');
    }
    var arr = obj[this.field];
    var actuallyRemoved = arr.splice(index, removed.length, added);
    if (!arraysEqual(actuallyRemoved, removed)) {
        throw new RestError('Objects actually removed did not match those specified in the change');
    }
}

function applyRemove(removed, obj) {
    var self = this;
    if (!removed) {
        throw new RestError('Must pass removed');
    }
    _.each(removed, function (r) {
        var arr = obj[self.field];
        var idx = arr.indexOf(r);
        arr.splice(idx, 1);
    });
}

function applySet(obj, newVal, old) {
    var actualOld = obj[this.field];
    if (actualOld != old) {
        // This is bad. Something has gone out of sync or we're applying unmergedChanges out of order.
        throw new RestError('Old value does not match new value: ' + JSON.stringify({old: old ? old : null, actualOld: actualOld ? actualOld : null}, null, 4));
    }
    obj[this.field] = newVal;
}

/**
 * Apply this change to the given object.
 * Will throw an error if this object does not match the change.
 * Changes can be applied to a SiestaModel or a PouchDB document.
 * @param doc
 */
Change.prototype.apply = function (doc) {
    var collection = this.collection;
    var mapping = this.mapping;
    if (!this.field) throw new RestError('Must pass field to change');
    if (!collection) throw new RestError('Must pass collection to change');
    if (!mapping) throw new RestError('Must pass mapping to change');
    if (doc._id != this._id) {
        throw new RestError('Cannot apply change with _id="' + this._id.toString() + '" to object with _id="' + doc._id.toString() + '"');
    }
    if (this.type == ChangeType.Set) {
        applySet.call(this, doc, this.newId || this.new, this.oldId || this.old);
    }
    else if (this.type == ChangeType.Splice) {
        applySplice.call(this, doc, this.index, this.removedId || this.removed, this.addedId || this.added);
    }
    else if (this.type == ChangeType.Remove) {
        applyRemove.call(this, this.removedId || this.removed, doc);
    }
    else {
        throw new RestError('Unknown change type "' + this.type.toString() + '"');
    }
    if (!doc.collection) {
        doc.collection = collection.name;
    }
    if (!doc.mapping) {
        doc.mapping = mapping.type;
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
    var op = new Operation('Merge Changes', function (done) {
        var changes = changesByIdentifiers();
        var identifiers = [];
        for (var prop in changes) {
            if (changes.hasOwnProperty(prop)) {
                identifiers.push(prop);
            }
        }
        var db = pouch.getPouch();
        db.allDocs({keys: identifiers, include_docs: true}, function (err, resp) {
            if (err) {
                done(err);
            }
            else {
                var bulkDocs = [];
                var errors = [];
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
                    dump(doc);
                    var change = changes[doc._id];
                    _.each(change, function (c) {
                        c.apply(doc);
                    });
                    bulkDocs.push(doc);
                });
                db.bulkDocs(bulkDocs, function (err) {
                    if (err) {
                        if (errors.length) {
                            errors.push(err);
                            done(errors);
                        }
                        else {
                            done(err);
                        }
                    }
                    else {
                        done();
                    }
                });
            }
        });
    });
    op.onCompletion(function () {
        if (callback) callback(op.error);
    });
    mergeQueue.addOperation(op);
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
exports.resetChanges = function () {
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