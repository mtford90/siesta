(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
if (typeof siesta == 'undefined' && typeof module == 'undefined') {
    throw new Error('Could not find window.siesta. Make sure you include siesta.core.js first.');
}


var _i = siesta._internal,
    cache = _i.cache,
    CollectionRegistry = _i.CollectionRegistry,
    log = _i.log,
    util = _i.util,
    events = _i.events;

var DB_NAME = 'siesta',
    pouch = new PouchDB(DB_NAME);

var unsavedObjects = [],
    unsavedObjectsHash = {},
    unsavedObjectsByCollection = {};

var storage = {},
    Logger = log.loggerWithName('Storage');

Logger.setLevel(siesta.log.warn);

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
            datum[r] = _.map(_id, function (x) { return {_id: x}});
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
            Model.map(data, {disableevents: true, _ignoreInstalled: true}, function (err, instances) {
                if (!err) {
                    if (Logger.trace)
                        Logger.trace('Loaded ' + instances.length.toString() + ' instances for ' + fullyQualifiedName);
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
    var deferred = util.defer(callback);
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
            siesta._.each(results, function (r) {instances.concat(r)});
            if (Logger.trace) Logger.trace('Loaded ' + instances.length.toString() + ' instances');
        }
        deferred.finish(err);
    });
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
        callback = callback || function () {};
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
        get: function () {return unsavedObjects}
    },
    _unsavedObjectsHash: {
        get: function () {return unsavedObjectsHash}
    },
    _unsavedObjectsByCollection: {
        get: function () {return unsavedObjectsByCollection}
    },
    _pouch: {
        get: function () {return pouch}
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


if (typeof PouchDB == 'undefined') {
    siesta.ext.storageEnabled = false;
    Logger.error('Storage extension is present but could not find PouchDB. ' +
    'Have you included pouchdb.js in your project? It must be present at window.PouchDB!');
}

module.exports = storage;

},{}]},{},[1])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9zdG9yYWdlL2luZGV4LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsImlmICh0eXBlb2Ygc2llc3RhID09ICd1bmRlZmluZWQnICYmIHR5cGVvZiBtb2R1bGUgPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0NvdWxkIG5vdCBmaW5kIHdpbmRvdy5zaWVzdGEuIE1ha2Ugc3VyZSB5b3UgaW5jbHVkZSBzaWVzdGEuY29yZS5qcyBmaXJzdC4nKTtcbn1cblxuXG52YXIgX2kgPSBzaWVzdGEuX2ludGVybmFsLFxuICAgIGNhY2hlID0gX2kuY2FjaGUsXG4gICAgQ29sbGVjdGlvblJlZ2lzdHJ5ID0gX2kuQ29sbGVjdGlvblJlZ2lzdHJ5LFxuICAgIGxvZyA9IF9pLmxvZyxcbiAgICB1dGlsID0gX2kudXRpbCxcbiAgICBldmVudHMgPSBfaS5ldmVudHM7XG5cbnZhciBEQl9OQU1FID0gJ3NpZXN0YScsXG4gICAgcG91Y2ggPSBuZXcgUG91Y2hEQihEQl9OQU1FKTtcblxudmFyIHVuc2F2ZWRPYmplY3RzID0gW10sXG4gICAgdW5zYXZlZE9iamVjdHNIYXNoID0ge30sXG4gICAgdW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb24gPSB7fTtcblxudmFyIHN0b3JhZ2UgPSB7fSxcbiAgICBMb2dnZXIgPSBsb2cubG9nZ2VyV2l0aE5hbWUoJ1N0b3JhZ2UnKTtcblxuTG9nZ2VyLnNldExldmVsKHNpZXN0YS5sb2cud2Fybik7XG5cbi8qKlxuICogU2VyaWFsaXNlIGEgbW9kZWwgaW50byBhIGZvcm1hdCB0aGF0IFBvdWNoREIgYnVsa0RvY3MgQVBJIGNhbiBwcm9jZXNzXG4gKiBAcGFyYW0ge01vZGVsSW5zdGFuY2V9IG1vZGVsSW5zdGFuY2VcbiAqL1xuZnVuY3Rpb24gX3NlcmlhbGlzZShtb2RlbEluc3RhbmNlKSB7XG4gICAgdmFyIHNlcmlhbGlzZWQgPSBzaWVzdGEuXy5leHRlbmQoe30sIG1vZGVsSW5zdGFuY2UuX192YWx1ZXMpO1xuICAgIHNlcmlhbGlzZWRbJ2NvbGxlY3Rpb24nXSA9IG1vZGVsSW5zdGFuY2UuY29sbGVjdGlvbk5hbWU7XG4gICAgc2VyaWFsaXNlZFsnbW9kZWwnXSA9IG1vZGVsSW5zdGFuY2UubW9kZWxOYW1lO1xuICAgIHNlcmlhbGlzZWRbJ19pZCddID0gbW9kZWxJbnN0YW5jZS5faWQ7XG4gICAgaWYgKG1vZGVsSW5zdGFuY2UucmVtb3ZlZCkgc2VyaWFsaXNlZFsnX2RlbGV0ZWQnXSA9IHRydWU7XG4gICAgdmFyIHJldiA9IG1vZGVsSW5zdGFuY2UuX3JldjtcbiAgICBpZiAocmV2KSBzZXJpYWxpc2VkWydfcmV2J10gPSByZXY7XG4gICAgc2VyaWFsaXNlZCA9IF8ucmVkdWNlKG1vZGVsSW5zdGFuY2UuX3JlbGF0aW9uc2hpcE5hbWVzLCBmdW5jdGlvbiAobWVtbywgbikge1xuICAgICAgICB2YXIgdmFsID0gbW9kZWxJbnN0YW5jZVtuXTtcbiAgICAgICAgaWYgKHNpZXN0YS5pc0FycmF5KHZhbCkpIHtcbiAgICAgICAgICAgIG1lbW9bbl0gPSBfLnBsdWNrKHZhbCwgJ19pZCcpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKHZhbCkge1xuICAgICAgICAgICAgbWVtb1tuXSA9IHZhbC5faWQ7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG1lbW87XG4gICAgfSwgc2VyaWFsaXNlZCk7XG4gICAgcmV0dXJuIHNlcmlhbGlzZWQ7XG59XG5cbmZ1bmN0aW9uIF9wcmVwYXJlRGF0dW0oZGF0dW0sIG1vZGVsKSB7XG4gICAgLy8gQWRkIGJsYW5rIG9iamVjdCB3aXRoIGNvcnJlY3QgX2lkIHRvIHRoZSBjYWNoZSBzbyB0aGF0IGNhbiBtYXAgZGF0YSBvbnRvIGl0LlxuICAgIGRlbGV0ZSBkYXR1bS5jb2xsZWN0aW9uO1xuICAgIGRlbGV0ZSBkYXR1bS5tb2RlbDtcbiAgICB2YXIgcmVsYXRpb25zaGlwTmFtZXMgPSBtb2RlbC5fcmVsYXRpb25zaGlwTmFtZXM7XG4gICAgXy5lYWNoKHJlbGF0aW9uc2hpcE5hbWVzLCBmdW5jdGlvbiAocikge1xuICAgICAgICB2YXIgX2lkID0gZGF0dW1bcl07XG4gICAgICAgIGlmIChzaWVzdGEuaXNBcnJheShfaWQpKSB7XG4gICAgICAgICAgICBkYXR1bVtyXSA9IF8ubWFwKF9pZCwgZnVuY3Rpb24gKHgpIHsgcmV0dXJuIHtfaWQ6IHh9fSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBkYXR1bVtyXSA9IHtfaWQ6IF9pZH07XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gZGF0dW07XG59XG5cbi8qKlxuICpcbiAqIEBwYXJhbSBvcHRzXG4gKiBAcGFyYW0gb3B0cy5jb2xsZWN0aW9uTmFtZVxuICogQHBhcmFtIG9wdHMubW9kZWxOYW1lXG4gKiBAcGFyYW0gY2FsbGJhY2tcbiAqIEBwcml2YXRlXG4gKi9cbmZ1bmN0aW9uIF9sb2FkTW9kZWwob3B0cywgY2FsbGJhY2spIHtcbiAgICB2YXIgY29sbGVjdGlvbk5hbWUgPSBvcHRzLmNvbGxlY3Rpb25OYW1lLFxuICAgICAgICBtb2RlbE5hbWUgPSBvcHRzLm1vZGVsTmFtZTtcbiAgICBpZiAoTG9nZ2VyLnRyYWNlKSB7XG4gICAgICAgIHZhciBmdWxseVF1YWxpZmllZE5hbWUgPSBjb2xsZWN0aW9uTmFtZSArICcuJyArIG1vZGVsTmFtZTtcbiAgICAgICAgTG9nZ2VyLnRyYWNlKCdMb2FkaW5nIGluc3RhbmNlcyBmb3IgJyArIGZ1bGx5UXVhbGlmaWVkTmFtZSk7XG4gICAgfVxuICAgIHZhciBNb2RlbCA9IENvbGxlY3Rpb25SZWdpc3RyeVtjb2xsZWN0aW9uTmFtZV1bbW9kZWxOYW1lXTtcbiAgICB2YXIgbWFwRnVuYyA9IGZ1bmN0aW9uIChkb2MpIHtcbiAgICAgICAgaWYgKGRvYy5tb2RlbCA9PSAnJDEnICYmIGRvYy5jb2xsZWN0aW9uID09ICckMicpIHtcbiAgICAgICAgICAgIC8vbm9pbnNwZWN0aW9uIEpTVW5yZXNvbHZlZEZ1bmN0aW9uXG4gICAgICAgICAgICBlbWl0KGRvYy5faWQsIGRvYyk7XG4gICAgICAgIH1cbiAgICB9LnRvU3RyaW5nKCkucmVwbGFjZSgnJDEnLCBtb2RlbE5hbWUpLnJlcGxhY2UoJyQyJywgY29sbGVjdGlvbk5hbWUpO1xuICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKSBMb2dnZXIudHJhY2UoJ1F1ZXJ5aW5nIHBvdWNoJyk7XG4gICAgcG91Y2gucXVlcnkoe21hcDogbWFwRnVuY30pXG4gICAgICAgIC50aGVuKGZ1bmN0aW9uIChyZXNwKSB7XG4gICAgICAgICAgICBpZiAoTG9nZ2VyLnRyYWNlLmlzRW5hYmxlZCkgTG9nZ2VyLnRyYWNlKCdRdWVyaWVkIHBvdWNoIHN1Y2Nlc2ZmdWxseScpO1xuICAgICAgICAgICAgdmFyIGRhdGEgPSBzaWVzdGEuXy5tYXAoc2llc3RhLl8ucGx1Y2socmVzcC5yb3dzLCAndmFsdWUnKSwgZnVuY3Rpb24gKGRhdHVtKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIF9wcmVwYXJlRGF0dW0oZGF0dW0sIE1vZGVsKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgaWYgKExvZ2dlci50cmFjZS5pc0VuYWJsZWQpIExvZ2dlci50cmFjZSgnTWFwcGluZyBkYXRhJywgZGF0YSk7XG4gICAgICAgICAgICBNb2RlbC5tYXAoZGF0YSwge2Rpc2FibGVldmVudHM6IHRydWUsIF9pZ25vcmVJbnN0YWxsZWQ6IHRydWV9LCBmdW5jdGlvbiAoZXJyLCBpbnN0YW5jZXMpIHtcbiAgICAgICAgICAgICAgICBpZiAoIWVycikge1xuICAgICAgICAgICAgICAgICAgICBpZiAoTG9nZ2VyLnRyYWNlKVxuICAgICAgICAgICAgICAgICAgICAgICAgTG9nZ2VyLnRyYWNlKCdMb2FkZWQgJyArIGluc3RhbmNlcy5sZW5ndGgudG9TdHJpbmcoKSArICcgaW5zdGFuY2VzIGZvciAnICsgZnVsbHlRdWFsaWZpZWROYW1lKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIExvZ2dlci5lcnJvcignRXJyb3IgbG9hZGluZyBtb2RlbHMnLCBlcnIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIsIGluc3RhbmNlcyk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSlcbiAgICAgICAgLmNhdGNoKGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgIH0pO1xufVxuXG4vKipcbiAqIExvYWQgYWxsIGRhdGEgZnJvbSBQb3VjaERCLlxuICovXG5mdW5jdGlvbiBfbG9hZChjYWxsYmFjaykge1xuICAgIHZhciBkZWZlcnJlZCA9IHV0aWwuZGVmZXIoY2FsbGJhY2spO1xuICAgIHZhciBjb2xsZWN0aW9uTmFtZXMgPSBDb2xsZWN0aW9uUmVnaXN0cnkuY29sbGVjdGlvbk5hbWVzO1xuICAgIHZhciB0YXNrcyA9IFtdO1xuICAgIF8uZWFjaChjb2xsZWN0aW9uTmFtZXMsIGZ1bmN0aW9uIChjb2xsZWN0aW9uTmFtZSkge1xuICAgICAgICB2YXIgY29sbGVjdGlvbiA9IENvbGxlY3Rpb25SZWdpc3RyeVtjb2xsZWN0aW9uTmFtZV0sXG4gICAgICAgICAgICBtb2RlbE5hbWVzID0gT2JqZWN0LmtleXMoY29sbGVjdGlvbi5fbW9kZWxzKTtcbiAgICAgICAgXy5lYWNoKG1vZGVsTmFtZXMsIGZ1bmN0aW9uIChtb2RlbE5hbWUpIHtcbiAgICAgICAgICAgIHRhc2tzLnB1c2goZnVuY3Rpb24gKGNiKSB7XG4gICAgICAgICAgICAgICAgX2xvYWRNb2RlbCh7XG4gICAgICAgICAgICAgICAgICAgIGNvbGxlY3Rpb25OYW1lOiBjb2xsZWN0aW9uTmFtZSxcbiAgICAgICAgICAgICAgICAgICAgbW9kZWxOYW1lOiBtb2RlbE5hbWVcbiAgICAgICAgICAgICAgICB9LCBjYik7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgfSk7XG4gICAgc2llc3RhLmFzeW5jLnBhcmFsbGVsKHRhc2tzLCBmdW5jdGlvbiAoZXJyLCByZXN1bHRzKSB7XG4gICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgICB2YXIgaW5zdGFuY2VzID0gW107XG4gICAgICAgICAgICBzaWVzdGEuXy5lYWNoKHJlc3VsdHMsIGZ1bmN0aW9uIChyKSB7aW5zdGFuY2VzLmNvbmNhdChyKX0pO1xuICAgICAgICAgICAgaWYgKExvZ2dlci50cmFjZSkgTG9nZ2VyLnRyYWNlKCdMb2FkZWQgJyArIGluc3RhbmNlcy5sZW5ndGgudG9TdHJpbmcoKSArICcgaW5zdGFuY2VzJyk7XG4gICAgICAgIH1cbiAgICAgICAgZGVmZXJyZWQuZmluaXNoKGVycik7XG4gICAgfSk7XG4gICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG59XG5cbmZ1bmN0aW9uIHNhdmVDb25mbGljdHMob2JqZWN0cywgY2FsbGJhY2ssIGRlZmVycmVkKSB7XG4gICAgcG91Y2guYWxsRG9jcyh7a2V5czogXy5wbHVjayhvYmplY3RzLCAnX2lkJyl9KVxuICAgICAgICAudGhlbihmdW5jdGlvbiAocmVzcCkge1xuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCByZXNwLnJvd3MubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBvYmplY3RzW2ldLl9yZXYgPSByZXNwLnJvd3NbaV0udmFsdWUucmV2O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgc2F2ZVRvUG91Y2gob2JqZWN0cywgY2FsbGJhY2ssIGRlZmVycmVkKTtcbiAgICAgICAgfSlcbiAgICAgICAgLmNhdGNoKGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgIGRlZmVycmVkLnJlamVjdChlcnIpO1xuICAgICAgICB9KVxufVxuXG5mdW5jdGlvbiBzYXZlVG9Qb3VjaChvYmplY3RzLCBjYWxsYmFjaywgZGVmZXJyZWQpIHtcbiAgICB2YXIgY29uZmxpY3RzID0gW107XG4gICAgcG91Y2guYnVsa0RvY3MoXy5tYXAob2JqZWN0cywgX3NlcmlhbGlzZSkpLnRoZW4oZnVuY3Rpb24gKHJlc3ApIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCByZXNwLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB2YXIgcmVzcG9uc2UgPSByZXNwW2ldO1xuICAgICAgICAgICAgdmFyIG9iaiA9IG9iamVjdHNbaV07XG4gICAgICAgICAgICBpZiAocmVzcG9uc2Uub2spIHtcbiAgICAgICAgICAgICAgICBvYmouX3JldiA9IHJlc3BvbnNlLnJldjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKHJlc3BvbnNlLnN0YXR1cyA9PSA0MDkpIHtcbiAgICAgICAgICAgICAgICBjb25mbGljdHMucHVzaChvYmopO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgTG9nZ2VyLmVycm9yKCdFcnJvciBzYXZpbmcgb2JqZWN0IHdpdGggX2lkPVwiJyArIG9iai5faWQgKyAnXCInLCByZXNwb25zZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNvbmZsaWN0cy5sZW5ndGgpIHtcbiAgICAgICAgICAgIHNhdmVDb25mbGljdHMoY29uZmxpY3RzLCBjYWxsYmFjaywgZGVmZXJyZWQpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgY2FsbGJhY2soKTtcbiAgICAgICAgICAgIGlmIChkZWZlcnJlZCkgZGVmZXJyZWQucmVzb2x2ZSgpO1xuICAgICAgICB9XG4gICAgfSwgZnVuY3Rpb24gKGVycikge1xuICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICBpZiAoZGVmZXJyZWQpIGRlZmVycmVkLnJlamVjdChlcnIpO1xuICAgIH0pO1xufVxuLyoqXG4gKiBTYXZlIGFsbCBtb2RlbEV2ZW50cyBkb3duIHRvIFBvdWNoREIuXG4gKi9cbmZ1bmN0aW9uIHNhdmUoY2FsbGJhY2spIHtcbiAgICB2YXIgZGVmZXJyZWQgPSB1dGlsLmRlZmVyKGNhbGxiYWNrKTtcbiAgICBzaWVzdGEuX2FmdGVySW5zdGFsbChmdW5jdGlvbiAoKSB7XG4gICAgICAgIGNhbGxiYWNrID0gY2FsbGJhY2sgfHwgZnVuY3Rpb24gKCkge307XG4gICAgICAgIHZhciBvYmplY3RzID0gdW5zYXZlZE9iamVjdHM7XG4gICAgICAgIHVuc2F2ZWRPYmplY3RzID0gW107XG4gICAgICAgIHVuc2F2ZWRPYmplY3RzSGFzaCA9IHt9O1xuICAgICAgICB1bnNhdmVkT2JqZWN0c0J5Q29sbGVjdGlvbiA9IHt9O1xuICAgICAgICBpZiAoTG9nZ2VyLnRyYWNlKSB7XG4gICAgICAgICAgICBMb2dnZXIudHJhY2UoJ1NhdmluZyBvYmplY3RzJywgXy5tYXAob2JqZWN0cywgZnVuY3Rpb24gKHgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geC5fZHVtcCgpXG4gICAgICAgICAgICB9KSlcbiAgICAgICAgfVxuICAgICAgICBzYXZlVG9Qb3VjaChvYmplY3RzLCBjYWxsYmFjaywgZGVmZXJyZWQpO1xuICAgIH0pO1xuICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xufVxuXG52YXIgbGlzdGVuZXIgPSBmdW5jdGlvbiAobikge1xuICAgIHZhciBjaGFuZ2VkT2JqZWN0ID0gbi5vYmosXG4gICAgICAgIGlkZW50ID0gY2hhbmdlZE9iamVjdC5faWQ7XG4gICAgaWYgKCFjaGFuZ2VkT2JqZWN0KSB7XG4gICAgICAgIHRocm93IG5ldyBfaS5lcnJvci5JbnRlcm5hbFNpZXN0YUVycm9yKCdObyBvYmogZmllbGQgaW4gbm90aWZpY2F0aW9uIHJlY2VpdmVkIGJ5IHN0b3JhZ2UgZXh0ZW5zaW9uJyk7XG4gICAgfVxuICAgIGlmICghKGlkZW50IGluIHVuc2F2ZWRPYmplY3RzSGFzaCkpIHtcbiAgICAgICAgdW5zYXZlZE9iamVjdHNIYXNoW2lkZW50XSA9IGNoYW5nZWRPYmplY3Q7XG4gICAgICAgIHVuc2F2ZWRPYmplY3RzLnB1c2goY2hhbmdlZE9iamVjdCk7XG4gICAgICAgIHZhciBjb2xsZWN0aW9uTmFtZSA9IGNoYW5nZWRPYmplY3QuY29sbGVjdGlvbk5hbWU7XG4gICAgICAgIGlmICghdW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb25bY29sbGVjdGlvbk5hbWVdKSB7XG4gICAgICAgICAgICB1bnNhdmVkT2JqZWN0c0J5Q29sbGVjdGlvbltjb2xsZWN0aW9uTmFtZV0gPSB7fTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgbW9kZWxOYW1lID0gY2hhbmdlZE9iamVjdC5tb2RlbC5uYW1lO1xuICAgICAgICBpZiAoIXVuc2F2ZWRPYmplY3RzQnlDb2xsZWN0aW9uW2NvbGxlY3Rpb25OYW1lXVttb2RlbE5hbWVdKSB7XG4gICAgICAgICAgICB1bnNhdmVkT2JqZWN0c0J5Q29sbGVjdGlvbltjb2xsZWN0aW9uTmFtZV1bbW9kZWxOYW1lXSA9IHt9O1xuICAgICAgICB9XG4gICAgICAgIHVuc2F2ZWRPYmplY3RzQnlDb2xsZWN0aW9uW2NvbGxlY3Rpb25OYW1lXVttb2RlbE5hbWVdW2lkZW50XSA9IGNoYW5nZWRPYmplY3Q7XG4gICAgfVxufTtcbnNpZXN0YS5vbignU2llc3RhJywgbGlzdGVuZXIpO1xuXG5cbl8uZXh0ZW5kKHN0b3JhZ2UsIHtcbiAgICBfbG9hZDogX2xvYWQsXG4gICAgc2F2ZTogc2F2ZSxcbiAgICBfc2VyaWFsaXNlOiBfc2VyaWFsaXNlLFxuICAgIF9yZXNldDogZnVuY3Rpb24gKGNiKSB7XG4gICAgICAgIHNpZXN0YS5yZW1vdmVMaXN0ZW5lcignU2llc3RhJywgbGlzdGVuZXIpO1xuICAgICAgICB1bnNhdmVkT2JqZWN0cyA9IFtdO1xuICAgICAgICB1bnNhdmVkT2JqZWN0c0hhc2ggPSB7fTtcbiAgICAgICAgcG91Y2guZGVzdHJveShmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICBpZiAoIWVycikge1xuICAgICAgICAgICAgICAgIHBvdWNoID0gbmV3IFBvdWNoREIoREJfTkFNRSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBzaWVzdGEub24oJ1NpZXN0YScsIGxpc3RlbmVyKTtcbiAgICAgICAgICAgIExvZ2dlci53YXJuKCdSZXNldCBjb21wbGV0ZScpO1xuICAgICAgICAgICAgY2IoZXJyKTtcbiAgICAgICAgfSlcbiAgICB9XG59KTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnRpZXMoc3RvcmFnZSwge1xuICAgIF91bnNhdmVkT2JqZWN0czoge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtyZXR1cm4gdW5zYXZlZE9iamVjdHN9XG4gICAgfSxcbiAgICBfdW5zYXZlZE9iamVjdHNIYXNoOiB7XG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge3JldHVybiB1bnNhdmVkT2JqZWN0c0hhc2h9XG4gICAgfSxcbiAgICBfdW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb246IHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7cmV0dXJuIHVuc2F2ZWRPYmplY3RzQnlDb2xsZWN0aW9ufVxuICAgIH0sXG4gICAgX3BvdWNoOiB7XG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge3JldHVybiBwb3VjaH1cbiAgICB9XG59KTtcblxuXG5pZiAoIXNpZXN0YS5leHQpIHNpZXN0YS5leHQgPSB7fTtcbnNpZXN0YS5leHQuc3RvcmFnZSA9IHN0b3JhZ2U7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKHNpZXN0YS5leHQsIHtcbiAgICBzdG9yYWdlRW5hYmxlZDoge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGlmIChzaWVzdGEuZXh0Ll9zdG9yYWdlRW5hYmxlZCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHNpZXN0YS5leHQuX3N0b3JhZ2VFbmFibGVkO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuICEhc2llc3RhLmV4dC5zdG9yYWdlO1xuICAgICAgICB9LFxuICAgICAgICBzZXQ6IGZ1bmN0aW9uICh2KSB7XG4gICAgICAgICAgICBzaWVzdGEuZXh0Ll9zdG9yYWdlRW5hYmxlZCA9IHY7XG4gICAgICAgIH0sXG4gICAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICB9XG59KTtcblxudmFyIGludGVydmFsLCBzYXZpbmcsIGF1dG9zYXZlSW50ZXJ2YWwgPSAxMDAwO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydGllcyhzaWVzdGEsIHtcbiAgICBhdXRvc2F2ZToge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiAhIWludGVydmFsO1xuICAgICAgICB9LFxuICAgICAgICBzZXQ6IGZ1bmN0aW9uIChhdXRvc2F2ZSkge1xuICAgICAgICAgICAgaWYgKGF1dG9zYXZlKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFpbnRlcnZhbCkge1xuICAgICAgICAgICAgICAgICAgICBpbnRlcnZhbCA9IHNldEludGVydmFsKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIENoZWVreSB3YXkgb2YgYXZvaWRpbmcgbXVsdGlwbGUgc2F2ZXMgaGFwcGVuaW5nLi4uXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIXNhdmluZykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNhdmluZyA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc2llc3RhLnNhdmUoZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZXZlbnRzLmVtaXQoJ3NhdmVkJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2F2aW5nID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0sIHNpZXN0YS5hdXRvc2F2ZUludGVydmFsKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZiAoaW50ZXJ2YWwpIHtcbiAgICAgICAgICAgICAgICAgICAgY2xlYXJJbnRlcnZhbChpbnRlcnZhbCk7XG4gICAgICAgICAgICAgICAgICAgIGludGVydmFsID0gbnVsbDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9LFxuICAgIGF1dG9zYXZlSW50ZXJ2YWw6IHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gYXV0b3NhdmVJbnRlcnZhbDtcbiAgICAgICAgfSxcbiAgICAgICAgc2V0OiBmdW5jdGlvbiAoX2F1dG9zYXZlSW50ZXJ2YWwpIHtcbiAgICAgICAgICAgIGF1dG9zYXZlSW50ZXJ2YWwgPSBfYXV0b3NhdmVJbnRlcnZhbDtcbiAgICAgICAgICAgIGlmIChpbnRlcnZhbCkge1xuICAgICAgICAgICAgICAgIC8vIFJlc2V0IGludGVydmFsXG4gICAgICAgICAgICAgICAgc2llc3RhLmF1dG9zYXZlID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgc2llc3RhLmF1dG9zYXZlID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0sXG4gICAgZGlydHk6IHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB2YXIgdW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb24gPSBzaWVzdGEuZXh0LnN0b3JhZ2UuX3Vuc2F2ZWRPYmplY3RzQnlDb2xsZWN0aW9uO1xuICAgICAgICAgICAgcmV0dXJuICEhT2JqZWN0LmtleXModW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb24pLmxlbmd0aDtcbiAgICAgICAgfSxcbiAgICAgICAgZW51bWVyYWJsZTogdHJ1ZVxuICAgIH1cbn0pO1xuXG5fLmV4dGVuZChzaWVzdGEsIHtcbiAgICBzYXZlOiBzYXZlLFxuICAgIHNldFBvdWNoOiBmdW5jdGlvbiAoX3ApIHtcbiAgICAgICAgaWYgKHNpZXN0YS5fY2FuQ2hhbmdlKSBwb3VjaCA9IF9wO1xuICAgICAgICBlbHNlIHRocm93IG5ldyBFcnJvcignQ2Fubm90IGNoYW5nZSBQb3VjaERCIGluc3RhbmNlIHdoZW4gYW4gb2JqZWN0IGdyYXBoIGV4aXN0cy4nKTtcbiAgICB9XG59KTtcblxuXG5pZiAodHlwZW9mIFBvdWNoREIgPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBzaWVzdGEuZXh0LnN0b3JhZ2VFbmFibGVkID0gZmFsc2U7XG4gICAgTG9nZ2VyLmVycm9yKCdTdG9yYWdlIGV4dGVuc2lvbiBpcyBwcmVzZW50IGJ1dCBjb3VsZCBub3QgZmluZCBQb3VjaERCLiAnICtcbiAgICAnSGF2ZSB5b3UgaW5jbHVkZWQgcG91Y2hkYi5qcyBpbiB5b3VyIHByb2plY3Q/IEl0IG11c3QgYmUgcHJlc2VudCBhdCB3aW5kb3cuUG91Y2hEQiEnKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBzdG9yYWdlO1xuIl19
