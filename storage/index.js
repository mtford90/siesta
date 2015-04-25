if (typeof siesta == 'undefined' && typeof module == 'undefined') {
  throw new Error('Could not find window.siesta. Make sure you include siesta.core.js first.');
}

var _i = siesta._internal,
  log = _i.log('storage'),
  error = _i.error,
  util = _i.util;

// Variables beginning with underscore are treated as special by PouchDB/CouchDB so when serialising we need to
// replace with something else.
var UNDERSCORE = /_/g,
  UNDERSCORE_REPLACEMENT = /@/g;

function Storage(name) {
  name = name || 'siesta';

  this.unsavedObjects = [];
  this.unsavedObjectsHash = {};
  this.unsavedObjectsByCollection = {};

  Object.defineProperties(this, {
    _unsavedObjects: {
      get: function() {
        return this.unsavedObjects
      }
    },
    _unsavedObjectsHash: {
      get: function() {
        return this.unsavedObjectsHash
      }
    },
    _unsavedObjectsByCollection: {
      get: function() {
        return this.unsavedObjectsByCollection
      }
    },
    _pouch: {
      get: function() {
        return this.pouch
      }
    }
  });

  this.pouch = new PouchDB(name, {auto_compaction: true})
}

Storage.prototype = {
  /**
   * Save all modelEvents down to PouchDB.
   */
  save: function(cb) {
    return util.promise(cb, function(cb) {
      siesta._ensureInstalled(function() {
        var instances = storage.unsavedObjects;
        this.unsavedObjects = [];
        this.unsavedObjectsHash = {};
        this.unsavedObjectsByCollection = {};
        this.saveToPouch(instances, cb);
      }.bind(this));
    }.bind(this));
  },
  saveToPouch: function(objects, cb) {
    var conflicts = [];
    var serialisedDocs = objects.map(this._serialise.bind(this));
    this.pouch.bulkDocs(serialisedDocs).then(function(resp) {
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
        this.saveConflicts(conflicts, cb);
      }
      else {
        cb();
      }
    }, function(err) {
      cb(err);
    });
  },
  saveConflicts: function(objects, cb) {
    this
      .pouch
      .allDocs({keys: util.pluck(objects, 'localId')})
      .then(function(resp) {
        for (var i = 0; i < resp.rows.length; i++) {
          objects[i]._rev = resp.rows[i].value.rev;
        }
        this.saveToPouch(objects, cb);
      })
      .catch(function(err) {
        cb(err);
      })
  },
  /**
   * Ensure that the PouchDB index for the given model exists, creating it if not.
   * @param model
   * @param cb
   */
  ensureIndexInstalled: function(model, cb) {
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

    this
      .pouch
      .put(this.constructIndexDesignDoc(model.collectionName, model.name))
      .then(fn)
      .catch(fn);
  },
  /**
   *
   * @param opts
   * @param [opts.collectionName]
   * @param [opts.modelName]
   * @param [opts.model]
   * @param cb
   * @private
   */
  loadModel: function(opts, cb) {
    var loaded = {};
    var collectionName = opts.collectionName,
      modelName = opts.modelName,
      model = opts.model;
    if (model) {
      collectionName = model.collectionName;
      modelName = model.name;
    }

    var fullyQualifiedName = this.fullyQualifiedModelName(collectionName, modelName);
    var Model = siesta.app.collectionRegistry[collectionName][modelName];
    this
      .pouch
      .query(fullyQualifiedName)
      .then(function(resp) {
        console.log('Queried pouch successfully');
        var rows = resp.rows;
        var data = util.pluck(rows, 'value').map(function(datum) {
          return this._prepareDatum(datum, Model);
        }.bind(this));

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
          disableevents: true,
          fromStorage: true
        }, function(err, instances) {
          if (!err) {
            console.log('Loaded ' + instances ? instances.length.toString() : 0 + ' instances for ' + fullyQualifiedName);
            this._listener = this.listener.bind(this);
            model.on('*', this._listener);
          }
          else {
            console.error('Error loading models', err);
          }
          cb(err, instances);
        }.bind(this));
      }.bind(this))
      .catch(function(err) {
        cb(err);
      });

  },
  _prepareDatum: function(rawDatum, model) {
    this._processMeta(rawDatum);
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
  },
  _processMeta: function(datum) {
    var meta = datum.siesta_meta || this._initMeta();
    meta.dateFields.forEach(function(dateField) {
      var value = datum[dateField];
      if (!(value instanceof Date)) {
        datum[dateField] = new Date(value);
      }
    });
    delete datum.siesta_meta;
  },

  _initMeta: function() {
    return {dateFields: []};
  },

  /**
   * Sometimes siesta needs to store some extra information about the model instance.
   * @param serialised
   */
  _addMeta: function(serialised) {
    serialised.siesta_meta = this._initMeta();
    for (var prop in serialised) {
      if (serialised.hasOwnProperty(prop)) {
        if (serialised[prop] instanceof Date) {
          serialised.siesta_meta.dateFields.push(prop);
          serialised[prop] = serialised[prop].getTime();
        }
      }
    }
  },

  listener: function(n) {
    var changedObject = n.obj,
      ident = changedObject.localId;
    if (!changedObject) {
      throw new _i.error.InternalSiestaError('No obj field in notification received by storage extension');
    }
    if (!(ident in this.unsavedObjectsHash)) {
      this.unsavedObjectsHash[ident] = changedObject;
      this.unsavedObjects.push(changedObject);
      var collectionName = changedObject.collectionName;
      if (!this.unsavedObjectsByCollection[collectionName]) {
        this.unsavedObjectsByCollection[collectionName] = {};
      }
      var modelName = changedObject.model.name;
      if (!this.unsavedObjectsByCollection[collectionName][modelName]) {
        this.unsavedObjectsByCollection[collectionName][modelName] = {};
      }
      this.unsavedObjectsByCollection[collectionName][modelName][ident] = changedObject;
    }
  },
  _reset: function(cb) {
    if (this._listener) siesta.removeListener('Siesta', this._listener);
    this.unsavedObjects = [];
    this.unsavedObjectsHash = {};

    this
      .pouch
      .allDocs()
      .then(function(results) {
        var docs = results.rows.map(function(r) {
          return {_id: r.id, _rev: r.value.rev, _deleted: true};
        });

        this.pouch
          .bulkDocs(docs)
          .then(function() {cb()})
          .catch(cb);
      }.bind(this))
      .catch(cb);
  },
  /**
   * Serialise a model into a format that PouchDB bulkDocs API can process
   * @param {ModelInstance} modelInstance
   */
  _serialise: function(modelInstance) {
    console.log(1);
    var serialised = {};
    var __values = modelInstance.__values;
    serialised = util.extend(serialised, __values);
    Object.keys(serialised).forEach(function(k) {
      serialised[k.replace(UNDERSCORE, '@')] = __values[k];
    });
    this._addMeta(serialised);
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
  },
  constructIndexDesignDoc: function(collectionName, modelName) {
    var fullyQualifiedName = this.fullyQualifiedModelName(collectionName, modelName);
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
  },
  fullyQualifiedModelName: function(collectionName, modelName) {
    return collectionName + '.' + modelName;
  }
};


var storage = new Storage();


if (typeof PouchDB == 'undefined') {
  siesta.ext.storageEnabled = false;
  console.log('PouchDB is not present therefore storage is disabled.');
}
else {
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
                    siesta.app.events.emit('saved');
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
        return !!Object.keys(storage.unsavedObjectsByCollection).length;
      },
      enumerable: true
    }
  });

  util.extend(siesta, {
    save: storage.save.bind(storage),
    setPouch: function(p) {
      storage.pouch = p;
    }
  });

}

module.exports = storage;
