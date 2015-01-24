if (typeof siesta == 'undefined' && typeof module == 'undefined') {
    throw new Error('Could not find window.siesta. Make sure you include siesta.core.js first.');
}

var _i = siesta._internal,
    cache = _i.cache,
    CollectionRegistry = _i.CollectionRegistry,
    log = _i.log,
    util = _i.util,
    _ = util._,
    events = _i.events;

var unsavedObjects = [],
    unsavedObjectsHash = {},
    unsavedObjectsByCollection = {};

var storage = {},
    Logger = log.loggerWithName('Storage');


function _initMeta() {
    return {dateFields: []};
}

function fullyQualifiedModelName(collectionName, modelName) {
    return collectionName + '.' + modelName;
}
if (typeof PouchDB == 'undefined') {
    siesta.ext.storageEnabled = false;
    console.log('PouchDB is not present therefore storage is disabled.');
}
else {
    var DB_NAME = 'siesta',
        pouch = new PouchDB(DB_NAME);

    /**
     * Sometimes siesta needs to store some extra information about the model instance.
     * @param serialised
     * @private
     */
    function _addMeta(serialised) {
        // PouchDB <= 3.2.1 has a bug whereby date fields are not deserialised properly if you use db.query
        // therefore we need to add extra info to the object for deserialising dates manually.
        serialised.siesta_meta = _initMeta();
        for (var prop in serialised) {
            if (serialised.hasOwnProperty(prop)) {
                if (serialised[prop] instanceof Date) {
                    serialised.siesta_meta.dateFields.push(prop);
                }
            }
        }
    }

    function _processMeta(datum) {
        var meta = datum.siesta_meta || _initMeta();
        // PouchDB <= 3.2.1 has a bug whereby date fields are not deserialised properly if you use db.query
        // therefore we need to add extra info to the object for deserialising dates manually.
        meta.dateFields.forEach(function (dateField) {
            var value = datum[dateField];
            if (!(value instanceof Date)) {
                datum[dateField] = new Date(Date.parse(value));
            }
        });
        delete datum.siesta_meta;
    }

    function constructIndexDesignDoc(name) {
        var views = {};
        views[name] = {
            map: function (doc) {
                emit(doc.collection + '.' + doc.model);
            }.toString()
        };
        return {
            _id: '_design/' + name,
            views: views
        };
    }

    function constructIndexes() {
        var indexes = [];
        for (var collectionName in unsavedObjectsByCollection) {
            if (unsavedObjectsByCollection.hasOwnProperty(collectionName)) {
                var unsavedObjectsByModel = unsavedObjectsByCollection[collectionName];
                for (var modelName in unsavedObjectsByModel) {
                    if (unsavedObjectsByModel.hasOwnProperty(modelName)) {
                        var fullyQualifiedName = fullyQualifiedModelName(collectionName, modelName);
                        indexes.push(constructIndexDesignDoc(fullyQualifiedName));
                    }
                }
            }
        }
        return indexes;
    }

    /**
     * Lazily create indexes as objects are saved down.
     */
    function _ensureIndexes(cb) {
        // TODO: Shouldn't be checking for existence of indexes EVERY SINGLE TIME. Can make note of which already exist.
        console.log('_ensureIndexes');
        var indexes = constructIndexes();
        pouch.bulkDocs(indexes)
            .then(function (resp) {
                var errors = [];
                for (var i = 0; i < resp.length; i++) {
                    var response = resp[i];
                    if (!response.ok) {
                        // Conflict means already exists, and this is fine!
                        var isConflict = response.status == 409;
                        if (!isConflict) errors.push(response);
                    }
                }
                cb(errors.length ? errors : null);
            })
            .catch(cb);
    }

    /**
     * Serialise a model into a format that PouchDB bulkDocs API can process
     * @param {ModelInstance} modelInstance
     */
    function _serialise(modelInstance) {
        var serialised = siesta._.extend({}, modelInstance.__values);
        _addMeta(serialised);
        serialised['collection'] = modelInstance.collectionName;
        serialised['model'] = modelInstance.modelName;
        serialised['_id'] = modelInstance._id;
        if (modelInstance.removed) serialised['_deleted'] = true;
        var rev = modelInstance._rev;
        if (rev) serialised['_rev'] = rev;
        serialised = _.reduce(modelInstance._relationshipNames, function (memo, n) {
            var val = modelInstance[n];
            if (siesta.isArray(val)) {
                memo[n] = _.pluck(val, '_id');
            }
            else if (val) {
                memo[n] = val._id;
            }
            return memo;
        }, serialised);
        return serialised;
    }

    function _prepareDatum(datum, model) {
        _processMeta(datum);
        delete datum.collection;
        delete datum.model;
        var relationshipNames = model._relationshipNames;
        _.each(relationshipNames, function (r) {
            var _id = datum[r];
            if (siesta.isArray(_id)) {
                datum[r] = _.map(_id, function (x) {
                    return {_id: x}
                });
            }
            else {
                datum[r] = {_id: _id};
            }
        });
        return datum;
    }

    /**
     *
     * @param opts
     * @param opts.collectionName
     * @param opts.modelName
     * @param callback
     * @private
     */
    function _loadModel(opts, callback) {
        var collectionName = opts.collectionName,
            modelName = opts.modelName;
        var fullyQualifiedName = fullyQualifiedModelName(collectionName, modelName);
        if (Logger.trace) {
            Logger.trace('Loading instances for ' + fullyQualifiedName);
        }
        var Model = CollectionRegistry[collectionName][modelName];
        var mapFunc = function (doc) {
            if (doc.model == '$1' && doc.collection == '$2') {
                //noinspection JSUnresolvedFunction
                emit(doc._id, doc);
            }
        }.toString().replace('$1', modelName).replace('$2', collectionName);
        if (Logger.trace.isEnabled) Logger.trace('Querying pouch');
        pouch.query({map: mapFunc})
            .then(function (resp) {
                if (Logger.trace.isEnabled) Logger.trace('Queried pouch successfully');
                var data = siesta._.map(siesta._.pluck(resp.rows, 'value'), function (datum) {
                    return _prepareDatum(datum, Model);
                });
                if (Logger.trace.isEnabled) Logger.trace('Mapping data', data);
                Model.graph(data, {
                    disableevents: true,
                    _ignoreInstalled: true,
                    fromStorage: true
                }, function (err, instances) {
                    if (!err) {
                        if (Logger.trace.isEnabled) {
                            Logger.trace('Loaded ' + instances ? instances.length.toString() : 0 + ' instances for ' + fullyQualifiedName);
                        }
                    }
                    else {
                        Logger.error('Error loading models', err);
                    }
                    callback(err, instances);
                });
            })
            .catch(function (err) {
                callback(err);
            });

    }

    /**
     * Load all data from PouchDB.
     */
    function _load(callback) {
        if (saving) throw new Error('not loaded yet how can i save');
        var deferred = util.defer(callback);
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
                        instances = instances.concat(r)
                    });
                    n = instances.length;
                    if (Logger.trace) {
                        Logger.trace('Loaded ' + n.toString() + ' instances');
                    }
                }
                deferred.finish(err, n);
            });
        }
        else {
            deferred.finish();
        }
        return deferred.promise;
    }

    function saveConflicts(objects, callback, deferred) {
        pouch.allDocs({keys: _.pluck(objects, '_id')})
            .then(function (resp) {
                for (var i = 0; i < resp.rows.length; i++) {
                    objects[i]._rev = resp.rows[i].value.rev;
                }
                saveToPouch(objects, callback, deferred);
            })
            .catch(function (err) {
                deferred.reject(err);
            })
    }

    function saveToPouch(objects, callback, deferred) {
        var conflicts = [];
        pouch.bulkDocs(_.map(objects, _serialise)).then(function (resp) {
            for (var i = 0; i < resp.length; i++) {
                var response = resp[i];
                var obj = objects[i];
                if (response.ok) {
                    obj._rev = response.rev;
                }
                else if (response.status == 409) {
                    conflicts.push(obj);
                }
                else {
                    Logger.error('Error saving object with _id="' + obj._id + '"', response);
                }
            }
            if (conflicts.length) {
                saveConflicts(conflicts, callback, deferred);
            }
            else {
                callback();
                if (deferred) deferred.resolve();
            }
        }, function (err) {
            callback(err);
            if (deferred) deferred.reject(err);
        });
    }


    /**
     * Save all modelEvents down to PouchDB.
     */
    function save(callback) {
        var deferred = util.defer(callback);
        callback = deferred.finish.bind(deferred);
        _ensureIndexes(function (err) {
            if (err) {
                console.error('Error ensuring indexes', err);
                callback(err);
            }
            else {
                siesta._afterInstall(function () {
                    var objects = unsavedObjects;
                    unsavedObjects = [];
                    unsavedObjectsHash = {};
                    unsavedObjectsByCollection = {};
                    if (Logger.trace) {
                        Logger.trace('Saving objects', _.map(objects, function (x) {
                            return x._dump()
                        }))
                    }
                    saveToPouch(objects, callback, deferred);
                });
            }
        });
        return deferred.promise;
    }

    var listener = function (n) {
        var changedObject = n.obj,
            ident = changedObject._id;
        if (!changedObject) {
            throw new _i.error.InternalSiestaError('No obj field in notification received by storage extension');
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
    siesta.on('Siesta', listener);


    _.extend(storage, {
        _load: _load,
        _loadModel: _loadModel,
        save: save,
        _serialise: _serialise,
        _reset: function (cb) {
            siesta.removeListener('Siesta', listener);
            unsavedObjects = [];
            unsavedObjectsHash = {};
            pouch.destroy(function (err) {
                if (!err) {
                    pouch = new PouchDB(DB_NAME);
                }
                siesta.on('Siesta', listener);
                Logger.warn('Reset complete');
                cb(err);
            })
        }
    });

    Object.defineProperties(storage, {
        _unsavedObjects: {
            get: function () {
                return unsavedObjects
            }
        },
        _unsavedObjectsHash: {
            get: function () {
                return unsavedObjectsHash
            }
        },
        _unsavedObjectsByCollection: {
            get: function () {
                return unsavedObjectsByCollection
            }
        },
        _pouch: {
            get: function () {
                return pouch
            }
        }
    });


    if (!siesta.ext) siesta.ext = {};
    siesta.ext.storage = storage;

    Object.defineProperties(siesta.ext, {
        storageEnabled: {
            get: function () {
                if (siesta.ext._storageEnabled !== undefined) {
                    return siesta.ext._storageEnabled;
                }
                return !!siesta.ext.storage;
            },
            set: function (v) {
                siesta.ext._storageEnabled = v;
            },
            enumerable: true
        }
    });

    var interval, saving, autosaveInterval = 1000;

    Object.defineProperties(siesta, {
        autosave: {
            get: function () {
                return !!interval;
            },
            set: function (autosave) {
                if (autosave) {
                    if (!interval) {
                        interval = setInterval(function () {
                            // Cheeky way of avoiding multiple saves happening...
                            if (!saving) {
                                saving = true;
                                siesta.save(function (err) {
                                    if (!err) {
                                        events.emit('saved');
                                    }
                                    saving = false;
                                });
                            }
                        }, siesta.autosaveInterval);
                    }
                }
                else {
                    if (interval) {
                        clearInterval(interval);
                        interval = null;
                    }
                }
            }
        },
        autosaveInterval: {
            get: function () {
                return autosaveInterval;
            },
            set: function (_autosaveInterval) {
                autosaveInterval = _autosaveInterval;
                if (interval) {
                    // Reset interval
                    siesta.autosave = false;
                    siesta.autosave = true;
                }
            }
        },
        dirty: {
            get: function () {
                var unsavedObjectsByCollection = siesta.ext.storage._unsavedObjectsByCollection;
                return !!Object.keys(unsavedObjectsByCollection).length;
            },
            enumerable: true
        }
    });

    _.extend(siesta, {
        save: save,
        setPouch: function (_p) {
            if (siesta._canChange) pouch = _p;
            else throw new Error('Cannot change PouchDB instance when an object graph exists.');
        }
    });

}

module.exports = storage;
