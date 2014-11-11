var _i = siesta._internal
    , log = _i.log
    , util = _i.util
    , _ = util._
    , cache = _i.cache
    , guid = _i.misc.guid
    , InternalSiestaError = _i.error.InternalSiestaError
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