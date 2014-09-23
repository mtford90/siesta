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

var unmergedChanges = {};

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

/**
 * Apply this change to the given object.
 * Will throw an error if this object does not match the change.
 * Changes can be applied to a SiestaModel or a PouchDB document.
 * @param obj
 */
Change.prototype.apply = function (obj) {
    var self = this;
    var removed;
    var field = this.field;
    var collection = this.collection;
    var mapping = this.mapping;
    if (!field) throw new RestError('Must pass field to change');
    if (!collection) throw new RestError('Must pass collection to change');
    if (!mapping) throw new RestError('Must pass mapping to change');
    if (obj._id != this._id) {
        throw new RestError('Cannot apply change with _id="' + this._id.toString() + '" to object with _id="' + obj._id.toString());
    }
    if (this.type == ChangeType.Set) {
        var old = obj[field];
        if (old != this.old) {
            // This is bad. Something has gone out of sync or we're applying unmergedChanges out of order.
            throw new RestError('Old value does not match new value: ' + JSON.stringify({old: this.old, actualOld: old ? old : null}, null, 4));
        }
        obj[field] = this.new;
    }
    else if (this.type == ChangeType.Splice) {
        removed = this.removed;
        var added = this.added;
        var index = this.index;
        if (!(removed || added)) {
            throw new RestError('Must remove or add something with a splice change.');
        }
        if (this.index === undefined || this.index === null) {
            throw new RestError('Must pass index to splice change');
        }
        var arr = obj[field];
        var actuallyRemoved = arr.splice(index, removed.length, added);
        if (!arraysEqual(actuallyRemoved, this.removed)) {
            throw new RestError('Objects actually removed did not match those specified in the change');
        }
    }
    else if (this.type == ChangeType.Remove) {
        removed = this.removed;
        if (!removed) {
            throw new RestError('Must pass removed');
        }
        _.each(removed, function (r) {
            var arr = obj[self.field];
            var idx = arr.indexOf(r);
            arr.splice(idx, 1);
        });
    }
    else {
        throw new RestError('Unknown change type "' + this.type.toString() + '"');
    }
    if (!obj.collection) {
        obj.collection = collection;
    }
    if (!obj.mapping) {
        obj.mapping = mapping;
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
    objChanges.push(new Change(opts));
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