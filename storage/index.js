if (typeof siesta == 'undefined' && typeof module == 'undefined') {
  throw new Error('Could not find window.siesta. Make sure you include siesta.core.js first.');
}

var _i = siesta._internal,
  cache = _i.cache,
  CollectionRegistry = _i.CollectionRegistry,
  log = _i.log('storage'),
  error = _i.error,
  util = _i.util,
  events = _i.events;

var unsavedObjects = [],
  unsavedObjectsHash = {},
  unsavedObjectsByCollection = {};

var storage = {};

// Variables beginning with underscore are treated as special by PouchDB/CouchDB so when serialising we need to
// replace with something else.
var UNDERSCORE = /_/g,
  UNDERSCORE_REPLACEMENT = /@/g;

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
  var DEFAULT_DB_NAME = 'siesta',
    DB_NAME = DEFAULT_DB_NAME,
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
    meta.dateFields.forEach(function(dateField) {
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
      map: function(doc) {
        if (doc.collection == '$1' && doc.model == '$2') emit(doc.collection + '.' + doc.model, doc);
      }.toString().replace('$1', collectionName).replace('$2', modelName)
    };
    return {
      _id: '_design/' + fullyQualifiedName,
      views: views
    };
  }

  /**
   * Ensure that the PouchDB index for the given model exists, creating it if not.
   * @param model
   * @param cb
   */
  function ensureIndexInstalled(model, cb) {
    function fn(resp) {
      var err;
      if (!resp.ok) {
        if (resp.status == 409) {
          err = null;
          model.indexInstalled = true;
        }
      }
      cb(err);
    }

    pouch
      .put(constructIndexDesignDoc(model.collectionName, model.name))
      .then(fn)
      .catch(fn);
  }

  /**
   * Serialise a model into a format that PouchDB bulkDocs API can process
   * @param {ModelInstance} modelInstance
   */
  function _serialise(modelInstance) {
    var serialised = {};
    var __values = modelInstance.__values;
    serialised = util.extend(serialised, __values);
    Object.keys(serialised).forEach(function(k) {
      serialised[k.replace(UNDERSCORE, '@')] = __values[k];
    });
    _addMeta(serialised);
    serialised['collection'] = modelInstance.collectionName;
    serialised['model'] = modelInstance.modelName;
    serialised['_id'] = modelInstance.localId;
    if (modelInstance.removed) serialised['_deleted'] = true;
    var rev = modelInstance._rev;
    if (rev) serialised['_rev'] = rev;
    serialised = modelInstance._relationshipNames.reduce(function(memo, n) {
      var val = modelInstance[n];
      if (siesta.isArray(val)) {
        memo[n] = util.pluck(val, 'localId');
      }
      else if (val) {
        memo[n] = val.localId;
      }
      return memo;
    }, serialised);
    return serialised;
  }

  function _prepareDatum(rawDatum, model) {
    _processMeta(rawDatum);
    delete rawDatum.collection;
    delete rawDatum.model;
    rawDatum.localId = rawDatum._id;
    delete rawDatum._id;
    var datum = {};
    Object.keys(rawDatum).forEach(function(k) {
      datum[k.replace(UNDERSCORE_REPLACEMENT, '_')] = rawDatum[k];
    });

    var relationshipNames = model._relationshipNames;
    relationshipNames.forEach(function(r) {
      var localId = datum[r];
      if (localId) {
        if (siesta.isArray(localId)) {
          datum[r] = localId.map(function(x) {
            return {localId: x}
          });
        }
        else {
          datum[r] = {localId: localId};
        }
      }

    });
    return datum;
  }

  /**
   *
   * @param opts
   * @param [opts.collectionName]
   * @param [opts.modelName]
   * @param [opts.model]
   * @param cb
   * @private
   */
  function loadModel(opts, cb) {
    var loaded = {};
    var collectionName = opts.collectionName,
      modelName = opts.modelName,
      model = opts.model;
    if (model) {
      collectionName = model.collectionName;
      modelName = model.name;
    }

    var fullyQualifiedName = fullyQualifiedModelName(collectionName, modelName);
    var Model = CollectionRegistry[collectionName][modelName];
    pouch
      .query(fullyQualifiedName)
      .then(function(resp) {
        console.log('Queried pouch successfully');
        var rows = resp.rows;
        var data = util.pluck(rows, 'value').map(function(datum) {
          return _prepareDatum(datum, Model);
        });

        data.map(function(datum) {
          var remoteId = datum[Model.id];
          if (remoteId) {
            if (loaded[remoteId]) {
              console.error('Duplicates detected in storage. You have encountered a serious bug. Please report this.');
            }
            else {
              loaded[remoteId] = datum;
            }
          }
        });

        Model._graph(data, {
          _ignoreInstalled: true,
          fromStorage: true
        }, function(err, instances) {
          if (!err) {
            console.log('Loaded ' + instances ? instances.length.toString() : 0 + ' instances for ' + fullyQualifiedName);
            model.on('*', listener);
          }
          else {
            console.error('Error loading models', err);
          }
          cb(err, instances);
        });
      })
      .catch(function(err) {
        cb(err);
      });

  }

  function saveConflicts(objects, cb) {
    pouch.allDocs({keys: util.pluck(objects, 'localId')})
      .then(function(resp) {
        for (var i = 0; i < resp.rows.length; i++) {
          objects[i]._rev = resp.rows[i].value.rev;
        }
        saveToPouch(objects, cb);
      })
      .catch(function(err) {
        cb(err);
      })
  }

  function saveToPouch(objects, cb) {
    var conflicts = [];
    var serialisedDocs = objects.map(_serialise);
    pouch.bulkDocs(serialisedDocs).then(function(resp) {
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
          log('Error saving object with localId="' + obj.localId + '"', response);
        }
      }
      if (conflicts.length) {
        saveConflicts(conflicts, cb);
      }
      else {
        cb();
      }
    }, function(err) {
      cb(err);
    });
  }


  /**
   * Save all modelEvents down to PouchDB.
   */
  function save(cb) {
    return util.promise(cb, function(cb) {
      var instances = unsavedObjects;
      unsavedObjects = [];
      unsavedObjectsHash = {};
      unsavedObjectsByCollection = {};
      saveToPouch(instances, cb);
    }.bind(this));
  }

  function listener(n) {
    var changedObject = n.obj,
      ident = changedObject.localId;
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
  }

  util.extend(storage, {
    loadModel: loadModel,
    save: save,
    _serialise: _serialise,
    ensureIndexInstalled: ensureIndexInstalled,
    /**
     * Used during testing only.
     * @param cb
     * @private
     */
    _reset: function(cb) {
      siesta.removeListener('Siesta', listener);
      unsavedObjects = [];
      unsavedObjectsHash = {};
      pouch
        .allDocs()
        .then(function(result) {
          var docs = result.rows.map(function(r) {
            console.log('r', r);
            return {_id: r.id, _deleted: true, _rev: r.value.rev};
          });
          console.log('docs', docs);
          pouch.bulkDocs(docs).then(function() {
            pouch.compact().then(function() {cb()}).catch(cb);
          }).catch(cb);
        }).catch(cb);
    }
  });

  Object.defineProperties(storage, {
    _unsavedObjects: {
      get: function() {
        return unsavedObjects
      }
    },
    _unsavedObjectsHash: {
      get: function() {
        return unsavedObjectsHash
      }
    },
    _unsavedObjectsByCollection: {
      get: function() {
        return unsavedObjectsByCollection
      }
    },
    _pouch: {
      get: function() {
        return pouch
      }
    }
  });

  if (!siesta.ext) siesta.ext = {};
  siesta.ext.storage = storage;

  Object.defineProperties(siesta.ext, {
    storageEnabled: {
      get: function() {
        if (siesta.ext._storageEnabled !== undefined) {
          return siesta.ext._storageEnabled;
        }
        return !!siesta.ext.storage;
      },
      set: function(v) {
        siesta.ext._storageEnabled = v;
      },
      enumerable: true
    }
  });

  var interval, saving, autosaveInterval = 1000;

  Object.defineProperties(siesta, {
    autosave: {
      get: function() {
        return !!interval;
      },
      set: function(autosave) {
        if (autosave) {
          if (!interval) {
            interval = setInterval(function() {
              // Cheeky way of avoiding multiple saves happening...
              if (!saving) {
                saving = true;
                siesta.save(function(err) {
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
      get: function() {
        return autosaveInterval;
      },
      set: function(_autosaveInterval) {
        autosaveInterval = _autosaveInterval;
        if (interval) {
          // Reset interval
          siesta.autosave = false;
          siesta.autosave = true;
        }
      }
    },
    dirty: {
      get: function() {
        var unsavedObjectsByCollection = siesta.ext.storage._unsavedObjectsByCollection;
        return !!Object.keys(unsavedObjectsByCollection).length;
      },
      enumerable: true
    }
  });

  util.extend(siesta, {
    save: save,
    setPouch: function(_p) {
      if (siesta._canChange) pouch = _p;
      else throw new Error('Cannot change PouchDB instance when an object graph exists.');
    }
  });

}

module.exports = storage;
