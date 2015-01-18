(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
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

if (typeof PouchDB == 'undefined') {
    siesta.ext.storageEnabled = false;
    Logger.error('Storage extension is present but could not find PouchDB. ' +
    'Have you included pouchdb.js in your project? It must be present at window.PouchDB!');
}
else {
    var DB_NAME = 'siesta',
        pouch = new PouchDB(DB_NAME);

    /**
     * Serialise a model into a format that PouchDB bulkDocs API can process
     * @param {ModelInstance} modelInstance
     */
    function _serialise(modelInstance) {
        var serialised = siesta._.extend({}, modelInstance.__values);
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
        // Add blank object with correct _id to the cache so that can map data onto it.
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
        if (Logger.trace) {
            var fullyQualifiedName = collectionName + '.' + modelName;
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
                if (Logger.trace.isEnabled) Logger.trace('Queried pouch succesffully');
                var data = siesta._.map(siesta._.pluck(resp.rows, 'value'), function (datum) {
                    return _prepareDatum(datum, Model);
                });
                if (Logger.trace.isEnabled) Logger.trace('Mapping data', data);
                Model.map(data, {
                    disableevents: true,
                    _ignoreInstalled: true,
                    callInit: false
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
                        _loadModel({
                            collectionName: collectionName,
                            modelName: modelName
                        }, cb);
                    });
                });
            });
            siesta.async.parallel(tasks, function (err, results) {
                if (!err) {
                    var instances = [];
                    siesta._.each(results, function (r) {
                        instances.concat(r)
                    });
                    if (Logger.trace) Logger.trace('Loaded ' + instances.length.toString() + ' instances');
                }
                deferred.finish(err);
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
        siesta._afterInstall(function () {
            callback = callback || function () {
            };
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

},{}]},{},[1])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9zdG9yYWdlL2luZGV4LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsImlmICh0eXBlb2Ygc2llc3RhID09ICd1bmRlZmluZWQnICYmIHR5cGVvZiBtb2R1bGUgPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0NvdWxkIG5vdCBmaW5kIHdpbmRvdy5zaWVzdGEuIE1ha2Ugc3VyZSB5b3UgaW5jbHVkZSBzaWVzdGEuY29yZS5qcyBmaXJzdC4nKTtcbn1cblxudmFyIF9pID0gc2llc3RhLl9pbnRlcm5hbCxcbiAgICBjYWNoZSA9IF9pLmNhY2hlLFxuICAgIENvbGxlY3Rpb25SZWdpc3RyeSA9IF9pLkNvbGxlY3Rpb25SZWdpc3RyeSxcbiAgICBsb2cgPSBfaS5sb2csXG4gICAgdXRpbCA9IF9pLnV0aWwsXG4gICAgXyA9IHV0aWwuXyxcbiAgICBldmVudHMgPSBfaS5ldmVudHM7XG5cbnZhciB1bnNhdmVkT2JqZWN0cyA9IFtdLFxuICAgIHVuc2F2ZWRPYmplY3RzSGFzaCA9IHt9LFxuICAgIHVuc2F2ZWRPYmplY3RzQnlDb2xsZWN0aW9uID0ge307XG5cbnZhciBzdG9yYWdlID0ge30sXG4gICAgTG9nZ2VyID0gbG9nLmxvZ2dlcldpdGhOYW1lKCdTdG9yYWdlJyk7XG5cbmlmICh0eXBlb2YgUG91Y2hEQiA9PSAndW5kZWZpbmVkJykge1xuICAgIHNpZXN0YS5leHQuc3RvcmFnZUVuYWJsZWQgPSBmYWxzZTtcbiAgICBMb2dnZXIuZXJyb3IoJ1N0b3JhZ2UgZXh0ZW5zaW9uIGlzIHByZXNlbnQgYnV0IGNvdWxkIG5vdCBmaW5kIFBvdWNoREIuICcgK1xuICAgICdIYXZlIHlvdSBpbmNsdWRlZCBwb3VjaGRiLmpzIGluIHlvdXIgcHJvamVjdD8gSXQgbXVzdCBiZSBwcmVzZW50IGF0IHdpbmRvdy5Qb3VjaERCIScpO1xufVxuZWxzZSB7XG4gICAgdmFyIERCX05BTUUgPSAnc2llc3RhJyxcbiAgICAgICAgcG91Y2ggPSBuZXcgUG91Y2hEQihEQl9OQU1FKTtcblxuICAgIC8qKlxuICAgICAqIFNlcmlhbGlzZSBhIG1vZGVsIGludG8gYSBmb3JtYXQgdGhhdCBQb3VjaERCIGJ1bGtEb2NzIEFQSSBjYW4gcHJvY2Vzc1xuICAgICAqIEBwYXJhbSB7TW9kZWxJbnN0YW5jZX0gbW9kZWxJbnN0YW5jZVxuICAgICAqL1xuICAgIGZ1bmN0aW9uIF9zZXJpYWxpc2UobW9kZWxJbnN0YW5jZSkge1xuICAgICAgICB2YXIgc2VyaWFsaXNlZCA9IHNpZXN0YS5fLmV4dGVuZCh7fSwgbW9kZWxJbnN0YW5jZS5fX3ZhbHVlcyk7XG4gICAgICAgIHNlcmlhbGlzZWRbJ2NvbGxlY3Rpb24nXSA9IG1vZGVsSW5zdGFuY2UuY29sbGVjdGlvbk5hbWU7XG4gICAgICAgIHNlcmlhbGlzZWRbJ21vZGVsJ10gPSBtb2RlbEluc3RhbmNlLm1vZGVsTmFtZTtcbiAgICAgICAgc2VyaWFsaXNlZFsnX2lkJ10gPSBtb2RlbEluc3RhbmNlLl9pZDtcbiAgICAgICAgaWYgKG1vZGVsSW5zdGFuY2UucmVtb3ZlZCkgc2VyaWFsaXNlZFsnX2RlbGV0ZWQnXSA9IHRydWU7XG4gICAgICAgIHZhciByZXYgPSBtb2RlbEluc3RhbmNlLl9yZXY7XG4gICAgICAgIGlmIChyZXYpIHNlcmlhbGlzZWRbJ19yZXYnXSA9IHJldjtcbiAgICAgICAgc2VyaWFsaXNlZCA9IF8ucmVkdWNlKG1vZGVsSW5zdGFuY2UuX3JlbGF0aW9uc2hpcE5hbWVzLCBmdW5jdGlvbiAobWVtbywgbikge1xuICAgICAgICAgICAgdmFyIHZhbCA9IG1vZGVsSW5zdGFuY2Vbbl07XG4gICAgICAgICAgICBpZiAoc2llc3RhLmlzQXJyYXkodmFsKSkge1xuICAgICAgICAgICAgICAgIG1lbW9bbl0gPSBfLnBsdWNrKHZhbCwgJ19pZCcpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAodmFsKSB7XG4gICAgICAgICAgICAgICAgbWVtb1tuXSA9IHZhbC5faWQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gbWVtbztcbiAgICAgICAgfSwgc2VyaWFsaXNlZCk7XG4gICAgICAgIHJldHVybiBzZXJpYWxpc2VkO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIF9wcmVwYXJlRGF0dW0oZGF0dW0sIG1vZGVsKSB7XG4gICAgICAgIC8vIEFkZCBibGFuayBvYmplY3Qgd2l0aCBjb3JyZWN0IF9pZCB0byB0aGUgY2FjaGUgc28gdGhhdCBjYW4gbWFwIGRhdGEgb250byBpdC5cbiAgICAgICAgZGVsZXRlIGRhdHVtLmNvbGxlY3Rpb247XG4gICAgICAgIGRlbGV0ZSBkYXR1bS5tb2RlbDtcbiAgICAgICAgdmFyIHJlbGF0aW9uc2hpcE5hbWVzID0gbW9kZWwuX3JlbGF0aW9uc2hpcE5hbWVzO1xuICAgICAgICBfLmVhY2gocmVsYXRpb25zaGlwTmFtZXMsIGZ1bmN0aW9uIChyKSB7XG4gICAgICAgICAgICB2YXIgX2lkID0gZGF0dW1bcl07XG4gICAgICAgICAgICBpZiAoc2llc3RhLmlzQXJyYXkoX2lkKSkge1xuICAgICAgICAgICAgICAgIGRhdHVtW3JdID0gXy5tYXAoX2lkLCBmdW5jdGlvbiAoeCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4ge19pZDogeH1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGRhdHVtW3JdID0ge19pZDogX2lkfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBkYXR1bTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKlxuICAgICAqIEBwYXJhbSBvcHRzXG4gICAgICogQHBhcmFtIG9wdHMuY29sbGVjdGlvbk5hbWVcbiAgICAgKiBAcGFyYW0gb3B0cy5tb2RlbE5hbWVcbiAgICAgKiBAcGFyYW0gY2FsbGJhY2tcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIGZ1bmN0aW9uIF9sb2FkTW9kZWwob3B0cywgY2FsbGJhY2spIHtcbiAgICAgICAgdmFyIGNvbGxlY3Rpb25OYW1lID0gb3B0cy5jb2xsZWN0aW9uTmFtZSxcbiAgICAgICAgICAgIG1vZGVsTmFtZSA9IG9wdHMubW9kZWxOYW1lO1xuICAgICAgICBpZiAoTG9nZ2VyLnRyYWNlKSB7XG4gICAgICAgICAgICB2YXIgZnVsbHlRdWFsaWZpZWROYW1lID0gY29sbGVjdGlvbk5hbWUgKyAnLicgKyBtb2RlbE5hbWU7XG4gICAgICAgICAgICBMb2dnZXIudHJhY2UoJ0xvYWRpbmcgaW5zdGFuY2VzIGZvciAnICsgZnVsbHlRdWFsaWZpZWROYW1lKTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgTW9kZWwgPSBDb2xsZWN0aW9uUmVnaXN0cnlbY29sbGVjdGlvbk5hbWVdW21vZGVsTmFtZV07XG4gICAgICAgIHZhciBtYXBGdW5jID0gZnVuY3Rpb24gKGRvYykge1xuICAgICAgICAgICAgaWYgKGRvYy5tb2RlbCA9PSAnJDEnICYmIGRvYy5jb2xsZWN0aW9uID09ICckMicpIHtcbiAgICAgICAgICAgICAgICAvL25vaW5zcGVjdGlvbiBKU1VucmVzb2x2ZWRGdW5jdGlvblxuICAgICAgICAgICAgICAgIGVtaXQoZG9jLl9pZCwgZG9jKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfS50b1N0cmluZygpLnJlcGxhY2UoJyQxJywgbW9kZWxOYW1lKS5yZXBsYWNlKCckMicsIGNvbGxlY3Rpb25OYW1lKTtcbiAgICAgICAgaWYgKExvZ2dlci50cmFjZS5pc0VuYWJsZWQpIExvZ2dlci50cmFjZSgnUXVlcnlpbmcgcG91Y2gnKTtcbiAgICAgICAgcG91Y2gucXVlcnkoe21hcDogbWFwRnVuY30pXG4gICAgICAgICAgICAudGhlbihmdW5jdGlvbiAocmVzcCkge1xuICAgICAgICAgICAgICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKSBMb2dnZXIudHJhY2UoJ1F1ZXJpZWQgcG91Y2ggc3VjY2VzZmZ1bGx5Jyk7XG4gICAgICAgICAgICAgICAgdmFyIGRhdGEgPSBzaWVzdGEuXy5tYXAoc2llc3RhLl8ucGx1Y2socmVzcC5yb3dzLCAndmFsdWUnKSwgZnVuY3Rpb24gKGRhdHVtKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBfcHJlcGFyZURhdHVtKGRhdHVtLCBNb2RlbCk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgaWYgKExvZ2dlci50cmFjZS5pc0VuYWJsZWQpIExvZ2dlci50cmFjZSgnTWFwcGluZyBkYXRhJywgZGF0YSk7XG4gICAgICAgICAgICAgICAgTW9kZWwubWFwKGRhdGEsIHtcbiAgICAgICAgICAgICAgICAgICAgZGlzYWJsZWV2ZW50czogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgX2lnbm9yZUluc3RhbGxlZDogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgY2FsbEluaXQ6IGZhbHNlXG4gICAgICAgICAgICAgICAgfSwgZnVuY3Rpb24gKGVyciwgaW5zdGFuY2VzKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoTG9nZ2VyLnRyYWNlLmlzRW5hYmxlZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIExvZ2dlci50cmFjZSgnTG9hZGVkICcgKyBpbnN0YW5jZXMgPyBpbnN0YW5jZXMubGVuZ3RoLnRvU3RyaW5nKCkgOiAwICsgJyBpbnN0YW5jZXMgZm9yICcgKyBmdWxseVF1YWxpZmllZE5hbWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgTG9nZ2VyLmVycm9yKCdFcnJvciBsb2FkaW5nIG1vZGVscycsIGVycik7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyLCBpbnN0YW5jZXMpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIC5jYXRjaChmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIExvYWQgYWxsIGRhdGEgZnJvbSBQb3VjaERCLlxuICAgICAqL1xuICAgIGZ1bmN0aW9uIF9sb2FkKGNhbGxiYWNrKSB7XG4gICAgICAgIGlmIChzYXZpbmcpIHRocm93IG5ldyBFcnJvcignbm90IGxvYWRlZCB5ZXQgaG93IGNhbiBpIHNhdmUnKTtcbiAgICAgICAgdmFyIGRlZmVycmVkID0gdXRpbC5kZWZlcihjYWxsYmFjayk7XG4gICAgICAgIGlmIChzaWVzdGEuZXh0LnN0b3JhZ2VFbmFibGVkKSB7XG4gICAgICAgICAgICB2YXIgY29sbGVjdGlvbk5hbWVzID0gQ29sbGVjdGlvblJlZ2lzdHJ5LmNvbGxlY3Rpb25OYW1lcztcbiAgICAgICAgICAgIHZhciB0YXNrcyA9IFtdO1xuICAgICAgICAgICAgXy5lYWNoKGNvbGxlY3Rpb25OYW1lcywgZnVuY3Rpb24gKGNvbGxlY3Rpb25OYW1lKSB7XG4gICAgICAgICAgICAgICAgdmFyIGNvbGxlY3Rpb24gPSBDb2xsZWN0aW9uUmVnaXN0cnlbY29sbGVjdGlvbk5hbWVdLFxuICAgICAgICAgICAgICAgICAgICBtb2RlbE5hbWVzID0gT2JqZWN0LmtleXMoY29sbGVjdGlvbi5fbW9kZWxzKTtcbiAgICAgICAgICAgICAgICBfLmVhY2gobW9kZWxOYW1lcywgZnVuY3Rpb24gKG1vZGVsTmFtZSkge1xuICAgICAgICAgICAgICAgICAgICB0YXNrcy5wdXNoKGZ1bmN0aW9uIChjYikge1xuICAgICAgICAgICAgICAgICAgICAgICAgX2xvYWRNb2RlbCh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29sbGVjdGlvbk5hbWU6IGNvbGxlY3Rpb25OYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1vZGVsTmFtZTogbW9kZWxOYW1lXG4gICAgICAgICAgICAgICAgICAgICAgICB9LCBjYik7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBzaWVzdGEuYXN5bmMucGFyYWxsZWwodGFza3MsIGZ1bmN0aW9uIChlcnIsIHJlc3VsdHMpIHtcbiAgICAgICAgICAgICAgICBpZiAoIWVycikge1xuICAgICAgICAgICAgICAgICAgICB2YXIgaW5zdGFuY2VzID0gW107XG4gICAgICAgICAgICAgICAgICAgIHNpZXN0YS5fLmVhY2gocmVzdWx0cywgZnVuY3Rpb24gKHIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGluc3RhbmNlcy5jb25jYXQocilcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChMb2dnZXIudHJhY2UpIExvZ2dlci50cmFjZSgnTG9hZGVkICcgKyBpbnN0YW5jZXMubGVuZ3RoLnRvU3RyaW5nKCkgKyAnIGluc3RhbmNlcycpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBkZWZlcnJlZC5maW5pc2goZXJyKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgZGVmZXJyZWQuZmluaXNoKCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gc2F2ZUNvbmZsaWN0cyhvYmplY3RzLCBjYWxsYmFjaywgZGVmZXJyZWQpIHtcbiAgICAgICAgcG91Y2guYWxsRG9jcyh7a2V5czogXy5wbHVjayhvYmplY3RzLCAnX2lkJyl9KVxuICAgICAgICAgICAgLnRoZW4oZnVuY3Rpb24gKHJlc3ApIHtcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHJlc3Aucm93cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBvYmplY3RzW2ldLl9yZXYgPSByZXNwLnJvd3NbaV0udmFsdWUucmV2O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBzYXZlVG9Qb3VjaChvYmplY3RzLCBjYWxsYmFjaywgZGVmZXJyZWQpO1xuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIC5jYXRjaChmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgZGVmZXJyZWQucmVqZWN0KGVycik7XG4gICAgICAgICAgICB9KVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIHNhdmVUb1BvdWNoKG9iamVjdHMsIGNhbGxiYWNrLCBkZWZlcnJlZCkge1xuICAgICAgICB2YXIgY29uZmxpY3RzID0gW107XG4gICAgICAgIHBvdWNoLmJ1bGtEb2NzKF8ubWFwKG9iamVjdHMsIF9zZXJpYWxpc2UpKS50aGVuKGZ1bmN0aW9uIChyZXNwKSB7XG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHJlc3AubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICB2YXIgcmVzcG9uc2UgPSByZXNwW2ldO1xuICAgICAgICAgICAgICAgIHZhciBvYmogPSBvYmplY3RzW2ldO1xuICAgICAgICAgICAgICAgIGlmIChyZXNwb25zZS5vaykge1xuICAgICAgICAgICAgICAgICAgICBvYmouX3JldiA9IHJlc3BvbnNlLnJldjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSBpZiAocmVzcG9uc2Uuc3RhdHVzID09IDQwOSkge1xuICAgICAgICAgICAgICAgICAgICBjb25mbGljdHMucHVzaChvYmopO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgTG9nZ2VyLmVycm9yKCdFcnJvciBzYXZpbmcgb2JqZWN0IHdpdGggX2lkPVwiJyArIG9iai5faWQgKyAnXCInLCByZXNwb25zZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGNvbmZsaWN0cy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICBzYXZlQ29uZmxpY3RzKGNvbmZsaWN0cywgY2FsbGJhY2ssIGRlZmVycmVkKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKCk7XG4gICAgICAgICAgICAgICAgaWYgKGRlZmVycmVkKSBkZWZlcnJlZC5yZXNvbHZlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sIGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICBpZiAoZGVmZXJyZWQpIGRlZmVycmVkLnJlamVjdChlcnIpO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTYXZlIGFsbCBtb2RlbEV2ZW50cyBkb3duIHRvIFBvdWNoREIuXG4gICAgICovXG4gICAgZnVuY3Rpb24gc2F2ZShjYWxsYmFjaykge1xuICAgICAgICB2YXIgZGVmZXJyZWQgPSB1dGlsLmRlZmVyKGNhbGxiYWNrKTtcbiAgICAgICAgc2llc3RhLl9hZnRlckluc3RhbGwoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgY2FsbGJhY2sgPSBjYWxsYmFjayB8fCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgdmFyIG9iamVjdHMgPSB1bnNhdmVkT2JqZWN0cztcbiAgICAgICAgICAgIHVuc2F2ZWRPYmplY3RzID0gW107XG4gICAgICAgICAgICB1bnNhdmVkT2JqZWN0c0hhc2ggPSB7fTtcbiAgICAgICAgICAgIHVuc2F2ZWRPYmplY3RzQnlDb2xsZWN0aW9uID0ge307XG4gICAgICAgICAgICBpZiAoTG9nZ2VyLnRyYWNlKSB7XG4gICAgICAgICAgICAgICAgTG9nZ2VyLnRyYWNlKCdTYXZpbmcgb2JqZWN0cycsIF8ubWFwKG9iamVjdHMsIGZ1bmN0aW9uICh4KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB4Ll9kdW1wKClcbiAgICAgICAgICAgICAgICB9KSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHNhdmVUb1BvdWNoKG9iamVjdHMsIGNhbGxiYWNrLCBkZWZlcnJlZCk7XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbiAgICB9XG5cbiAgICB2YXIgbGlzdGVuZXIgPSBmdW5jdGlvbiAobikge1xuICAgICAgICB2YXIgY2hhbmdlZE9iamVjdCA9IG4ub2JqLFxuICAgICAgICAgICAgaWRlbnQgPSBjaGFuZ2VkT2JqZWN0Ll9pZDtcbiAgICAgICAgaWYgKCFjaGFuZ2VkT2JqZWN0KSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgX2kuZXJyb3IuSW50ZXJuYWxTaWVzdGFFcnJvcignTm8gb2JqIGZpZWxkIGluIG5vdGlmaWNhdGlvbiByZWNlaXZlZCBieSBzdG9yYWdlIGV4dGVuc2lvbicpO1xuICAgICAgICB9XG4gICAgICAgIGlmICghKGlkZW50IGluIHVuc2F2ZWRPYmplY3RzSGFzaCkpIHtcbiAgICAgICAgICAgIHVuc2F2ZWRPYmplY3RzSGFzaFtpZGVudF0gPSBjaGFuZ2VkT2JqZWN0O1xuICAgICAgICAgICAgdW5zYXZlZE9iamVjdHMucHVzaChjaGFuZ2VkT2JqZWN0KTtcbiAgICAgICAgICAgIHZhciBjb2xsZWN0aW9uTmFtZSA9IGNoYW5nZWRPYmplY3QuY29sbGVjdGlvbk5hbWU7XG4gICAgICAgICAgICBpZiAoIXVuc2F2ZWRPYmplY3RzQnlDb2xsZWN0aW9uW2NvbGxlY3Rpb25OYW1lXSkge1xuICAgICAgICAgICAgICAgIHVuc2F2ZWRPYmplY3RzQnlDb2xsZWN0aW9uW2NvbGxlY3Rpb25OYW1lXSA9IHt9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdmFyIG1vZGVsTmFtZSA9IGNoYW5nZWRPYmplY3QubW9kZWwubmFtZTtcbiAgICAgICAgICAgIGlmICghdW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb25bY29sbGVjdGlvbk5hbWVdW21vZGVsTmFtZV0pIHtcbiAgICAgICAgICAgICAgICB1bnNhdmVkT2JqZWN0c0J5Q29sbGVjdGlvbltjb2xsZWN0aW9uTmFtZV1bbW9kZWxOYW1lXSA9IHt9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb25bY29sbGVjdGlvbk5hbWVdW21vZGVsTmFtZV1baWRlbnRdID0gY2hhbmdlZE9iamVjdDtcbiAgICAgICAgfVxuICAgIH07XG4gICAgc2llc3RhLm9uKCdTaWVzdGEnLCBsaXN0ZW5lcik7XG5cblxuICAgIF8uZXh0ZW5kKHN0b3JhZ2UsIHtcbiAgICAgICAgX2xvYWQ6IF9sb2FkLFxuICAgICAgICBzYXZlOiBzYXZlLFxuICAgICAgICBfc2VyaWFsaXNlOiBfc2VyaWFsaXNlLFxuICAgICAgICBfcmVzZXQ6IGZ1bmN0aW9uIChjYikge1xuICAgICAgICAgICAgc2llc3RhLnJlbW92ZUxpc3RlbmVyKCdTaWVzdGEnLCBsaXN0ZW5lcik7XG4gICAgICAgICAgICB1bnNhdmVkT2JqZWN0cyA9IFtdO1xuICAgICAgICAgICAgdW5zYXZlZE9iamVjdHNIYXNoID0ge307XG4gICAgICAgICAgICBwb3VjaC5kZXN0cm95KGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgICAgICBpZiAoIWVycikge1xuICAgICAgICAgICAgICAgICAgICBwb3VjaCA9IG5ldyBQb3VjaERCKERCX05BTUUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBzaWVzdGEub24oJ1NpZXN0YScsIGxpc3RlbmVyKTtcbiAgICAgICAgICAgICAgICBMb2dnZXIud2FybignUmVzZXQgY29tcGxldGUnKTtcbiAgICAgICAgICAgICAgICBjYihlcnIpO1xuICAgICAgICAgICAgfSlcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnRpZXMoc3RvcmFnZSwge1xuICAgICAgICBfdW5zYXZlZE9iamVjdHM6IHtcbiAgICAgICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB1bnNhdmVkT2JqZWN0c1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICBfdW5zYXZlZE9iamVjdHNIYXNoOiB7XG4gICAgICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdW5zYXZlZE9iamVjdHNIYXNoXG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIF91bnNhdmVkT2JqZWN0c0J5Q29sbGVjdGlvbjoge1xuICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHVuc2F2ZWRPYmplY3RzQnlDb2xsZWN0aW9uXG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIF9wb3VjaDoge1xuICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHBvdWNoXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcblxuXG4gICAgaWYgKCFzaWVzdGEuZXh0KSBzaWVzdGEuZXh0ID0ge307XG4gICAgc2llc3RhLmV4dC5zdG9yYWdlID0gc3RvcmFnZTtcblxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKHNpZXN0YS5leHQsIHtcbiAgICAgICAgc3RvcmFnZUVuYWJsZWQ6IHtcbiAgICAgICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIGlmIChzaWVzdGEuZXh0Ll9zdG9yYWdlRW5hYmxlZCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBzaWVzdGEuZXh0Ll9zdG9yYWdlRW5hYmxlZDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuICEhc2llc3RhLmV4dC5zdG9yYWdlO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHNldDogZnVuY3Rpb24gKHYpIHtcbiAgICAgICAgICAgICAgICBzaWVzdGEuZXh0Ll9zdG9yYWdlRW5hYmxlZCA9IHY7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZVxuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICB2YXIgaW50ZXJ2YWwsIHNhdmluZywgYXV0b3NhdmVJbnRlcnZhbCA9IDEwMDA7XG5cbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydGllcyhzaWVzdGEsIHtcbiAgICAgICAgYXV0b3NhdmU6IHtcbiAgICAgICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiAhIWludGVydmFsO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHNldDogZnVuY3Rpb24gKGF1dG9zYXZlKSB7XG4gICAgICAgICAgICAgICAgaWYgKGF1dG9zYXZlKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghaW50ZXJ2YWwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGludGVydmFsID0gc2V0SW50ZXJ2YWwoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIENoZWVreSB3YXkgb2YgYXZvaWRpbmcgbXVsdGlwbGUgc2F2ZXMgaGFwcGVuaW5nLi4uXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFzYXZpbmcpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2F2aW5nID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2llc3RhLnNhdmUoZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBldmVudHMuZW1pdCgnc2F2ZWQnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNhdmluZyA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9LCBzaWVzdGEuYXV0b3NhdmVJbnRlcnZhbCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChpbnRlcnZhbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY2xlYXJJbnRlcnZhbChpbnRlcnZhbCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpbnRlcnZhbCA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIGF1dG9zYXZlSW50ZXJ2YWw6IHtcbiAgICAgICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBhdXRvc2F2ZUludGVydmFsO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHNldDogZnVuY3Rpb24gKF9hdXRvc2F2ZUludGVydmFsKSB7XG4gICAgICAgICAgICAgICAgYXV0b3NhdmVJbnRlcnZhbCA9IF9hdXRvc2F2ZUludGVydmFsO1xuICAgICAgICAgICAgICAgIGlmIChpbnRlcnZhbCkge1xuICAgICAgICAgICAgICAgICAgICAvLyBSZXNldCBpbnRlcnZhbFxuICAgICAgICAgICAgICAgICAgICBzaWVzdGEuYXV0b3NhdmUgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgc2llc3RhLmF1dG9zYXZlID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIGRpcnR5OiB7XG4gICAgICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICB2YXIgdW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb24gPSBzaWVzdGEuZXh0LnN0b3JhZ2UuX3Vuc2F2ZWRPYmplY3RzQnlDb2xsZWN0aW9uO1xuICAgICAgICAgICAgICAgIHJldHVybiAhIU9iamVjdC5rZXlzKHVuc2F2ZWRPYmplY3RzQnlDb2xsZWN0aW9uKS5sZW5ndGg7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZVxuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICBfLmV4dGVuZChzaWVzdGEsIHtcbiAgICAgICAgc2F2ZTogc2F2ZSxcbiAgICAgICAgc2V0UG91Y2g6IGZ1bmN0aW9uIChfcCkge1xuICAgICAgICAgICAgaWYgKHNpZXN0YS5fY2FuQ2hhbmdlKSBwb3VjaCA9IF9wO1xuICAgICAgICAgICAgZWxzZSB0aHJvdyBuZXcgRXJyb3IoJ0Nhbm5vdCBjaGFuZ2UgUG91Y2hEQiBpbnN0YW5jZSB3aGVuIGFuIG9iamVjdCBncmFwaCBleGlzdHMuJyk7XG4gICAgICAgIH1cbiAgICB9KTtcblxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHN0b3JhZ2U7XG4iXX0=
