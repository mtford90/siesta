var log = require('../vendor/operations.js/src/log');
var Logger = log.loggerWithName('Pouch');
Logger.setLevel(log.Level.warn);

var CollectionRegistry = require('./collectionRegistry').CollectionRegistry;
var RestError = require('./error').RestError;
var guid = require('./misc').guid;
var cache = require('./cache');
var pouch;

function retryUntilWrittenMultiple(docId, newValues, callback) {

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
                    Logger.trace('Successfully persisted changes: ' + JSON.stringify({doc: doc._id, pouchDBResponse: resp, changes: newValues}, null, 4));
                    if (callback) callback();
                }
            });
        }
    });
}

function _reset(inMemory) {
    var dbName = guid();
    if (inMemory) {
        if (typeof window != 'undefined') {
            pouch = new PouchDB('rest-' + dbName, {adapter: 'memory'});
        }
        else {
            pouch = new PouchDB('rest-' + dbName, {db: require('memdown')});
        }
    }
    else {
        throw 'Only in memory pouchDB supported atm';
//        pouch = new PouchDB(dbName);
    }
}

function reset(inMemory, callback) {
    if (pouch) {
        pouch.destroy();
    }
    _reset(inMemory);
    if (callback) callback();
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
                    throw new RestError('Cannot convert PouchDB document into RestObject. ' +
                        'No mapping with type ' + mappingType.toString(), {doc: doc})
                }
            }
            else {
                throw new RestError('Cannot convert PouchDB document into RestObject. ' +
                    'No type field within document', {doc: doc});
            }
        }
        else {
            throw new RestError('Cannot convert PouchDB document into RestObject. ' +
                'API "' + collectionName.toString() + '" doesnt exist.', {doc: doc});
        }

    }
    else {
        throw new RestError('Cannot convert PouchDB document into RestObject. ' +
            'No collection field within document', {doc: doc});
    }
}

function toNew(doc) {
    var mapping = validate(doc);
    var obj = mapping._new();
    for (var prop in doc) {
        if (doc.hasOwnProperty(prop)) {
            if (obj._fields.indexOf(prop) > -1) {
                obj[prop] = doc[prop];
            }
            else if (obj._relationshipFields.indexOf(prop) > -1) {
                obj[prop]._id = doc[prop];
            }
        }
    }
    return obj;
}

function toFount(docs) {
    var mapped = [];
    for (var i = 0; i < docs.length; i++) {
        var doc = docs[i];
        var cached = cache.get({_id: doc._id});
        if (cached) {
            mapped[i] = cached;
        }
        else {
            mapped[i] = toNew(doc);
        }
    }
    return mapped;
}

function from(obj) {
    Logger.trace('from', {obj: obj});
    var mapping = obj.mapping;
    var adapted = {};
    _.each(mapping._fields, function (f) {
        Logger.trace('field', f);
        var v = obj[f];
        Logger.trace(f + '=', v);
        if (v) {
            adapted[f] = v;
        }
    });
    _.each(mapping.relationships, function (r) {
        Logger.trace('relationship', r);
        // Only forward relationships are stored in the database.
        if (r.isForward(obj)) {
            var name = r.name;
            var proxy = obj[name];
            if (proxy._id) {
                adapted[name] = proxy._id;
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
exports.toFount = toFount;
exports.retryUntilWrittenMultiple = retryUntilWrittenMultiple;
exports.reset = reset;
exports.getPouch = getPouch;
