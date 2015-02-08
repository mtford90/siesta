(function () {
    if (typeof siesta == 'undefined' && typeof module == 'undefined') {
        throw new Error('Could not find window.siesta. Make sure you include siesta.core.js first.');
    }

    var _i = siesta._internal,
        cache = _i.cache,
        CollectionRegistry = _i.CollectionRegistry,
        log = _i.log('Storage'),
        error = _i.error,
        util = _i.util,
        _ = util._,
        events = _i.events;

    var unsavedObjects = [],
        unsavedObjectsHash = {},
        unsavedObjectsByCollection = {};

    var storage = {};


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
            pouch = new PouchDB(DB_NAME, {auto_compaction: true});

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
                        serialised[prop] = serialised[prop].getTime();
                    }
                }
            }
        }

        function _processMeta(datum) {
            var meta = datum.siesta_meta || _initMeta();
            meta.dateFields.forEach(function (dateField) {
                var value = datum[dateField];
                if (!(value instanceof Date)) {
                    datum[dateField] = new Date(value);
                }
            });
            delete datum.siesta_meta;
        }

        function constructIndexDesignDoc(collectionName, modelName) {
            var fullyQualifiedName = fullyQualifiedModelName(collectionName, modelName);
            var views = {};
            views[fullyQualifiedName] = {
                map: function (doc) {
                    if (doc.collection == '$1' && doc.model == '$2') emit(doc.collection + '.' + doc.model, doc);
                }.toString().replace('$1', collectionName).replace('$2', modelName)
            };
            return {
                _id: '_design/' + fullyQualifiedName,
                views: views
            };
        }

        function constructIndexesForAll() {
            var indexes = [];
            var registry = siesta._internal.CollectionRegistry;
            registry.collectionNames.forEach(function (collectionName) {
                var models = registry[collectionName]._models;
                for (var modelName in models) {
                    if (models.hasOwnProperty(modelName)) {
                        indexes.push(constructIndexDesignDoc(collectionName, modelName));
                    }
                }
            });
            return indexes;
        }

        function __ensureIndexes(indexes, cb) {
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
                    cb(errors.length ? error('multiple errors', {errors: errors}) : null);
                })
                .catch(cb);
        }

        function ensureIndexesForAll(cb) {
            var indexes = constructIndexesForAll();
            __ensureIndexes(indexes, cb);
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
            log('Loading instances for ' + fullyQualifiedName);
            var Model = CollectionRegistry[collectionName][modelName];
            log('Querying pouch');
            pouch.query(fullyQualifiedName)
                //pouch.query({map: mapFunc})
                .then(function (resp) {
                    log('Queried pouch successfully');
                    var data = siesta._.map(siesta._.pluck(resp.rows, 'value'), function (datum) {
                        return _prepareDatum(datum, Model);
                    });
                    log('Mapping data', data);
                    Model.graph(data, {
                        disableevents: true,
                        _ignoreInstalled: true,
                        fromStorage: true
                    }, function (err, instances) {
                        if (!err) {
                            if (log.enabled)
                                log('Loaded ' + instances ? instances.length.toString() : 0 + ' instances for ' + fullyQualifiedName);
                        }
                        else {
                            log('Error loading models', err);
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
        function _load(cb) {
            if (saving) throw new Error('not loaded yet how can i save');
            return util.promise(cb, function (cb) {
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
                            if (log) {
                                log('Loaded ' + n.toString() + ' instances');
                            }
                        }
                        cb(err, n);
                    });
                }
                else {
                    cb();
                }
            }.bind(this));
        }

        function saveConflicts(objects, cb) {
            pouch.allDocs({keys: _.pluck(objects, '_id')})
                .then(function (resp) {
                    for (var i = 0; i < resp.rows.length; i++) {
                        objects[i]._rev = resp.rows[i].value.rev;
                    }
                    saveToPouch(objects, cb);
                })
                .catch(function (err) {
                    cb(err);
                })
        }

        function saveToPouch(objects, cb) {
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
                        log('Error saving object with _id="' + obj._id + '"', response);
                    }
                }
                if (conflicts.length) {
                    saveConflicts(conflicts, cb);
                }
                else {
                    cb();
                }
            }, function (err) {
                cb(err);
            });
        }


        /**
         * Save all modelEvents down to PouchDB.
         */
        function save(cb) {
            return util.promise(cb, function (cb) {
                siesta._afterInstall(function () {
                    var objects = unsavedObjects;
                    unsavedObjects = [];
                    unsavedObjectsHash = {};
                    unsavedObjectsByCollection = {};
                    if (log) {
                        log('Saving objects', _.map(objects, function (x) {
                            return x._dump()
                        }))
                    }
                    saveToPouch(objects, cb);
                });
            }.bind(this));

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
            ensureIndexesForAll: ensureIndexesForAll,
            _reset: function (cb) {
                siesta.removeListener('Siesta', listener);
                unsavedObjects = [];
                unsavedObjectsHash = {};
                pouch.destroy(function (err) {
                    if (!err) {
                        pouch = new PouchDB(DB_NAME);
                    }
                    siesta.on('Siesta', listener);
                    log('Reset complete');
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

})();