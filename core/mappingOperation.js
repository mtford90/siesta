var ModelInstance = require('./ModelInstance'),
  log = require('./log')('graph'),
  cache = require('./cache'),
  util = require('./util');

function SiestaError(opts) {
  this.opts = opts;
}

SiestaError.prototype.toString = function() {
  return JSON.stringify(this.opts, null, 4);
};

/**
 * Encapsulates the idea of mapping arrays of data onto the object graph or arrays of objects.
 * @param {Object} opts
 * @param opts.model
 * @param opts.data
 * @param opts.objects
 * @param opts.disableNotifications
 */
function MappingOperation(opts) {
  this._opts = opts;

  util.extendFromOpts(this, opts, {
    model: null,
    data: null,
    objects: [],
    disableevents: false,
    _ignoreInstalled: false,
    fromStorage: false
  });

  util.extend(this, {
    errors: [],
    subTaskResults: {},
    _newObjects: []
  });

  this.model._installReversePlaceholders();
  this.data = this.preprocessData();
}

util.extend(MappingOperation.prototype, {
  mapAttributes: function() {
    for (var i = 0; i < this.data.length; i++) {
      var datum = this.data[i],
        object = this.objects[i];
      // No point mapping object onto itself. This happens if a ModelInstance is passed as a relationship.
      if (datum != object) {
        if (object) { // If object is falsy, then there was an error looking up that object/creating it.
          var fields = this.model._attributeNames;
          fields.forEach(function(f) {
            if (datum[f] !== undefined) { // null is fine
              // If events are disabled we update __values object directly. This avoids triggering
              // events which are built into the set function of the property.
              if (this.disableevents) {
                object.__values[f] = datum[f];
              }
              else {
                object[f] = datum[f];
              }
            }
          }.bind(this));
          // PouchDB revision (if using storage module).
          // TODO: Can this be pulled out of core?
          if (datum._rev) object._rev = datum._rev;
        }
      }
    }
  },
  _map: function() {
    var self = this;
    var err;
    this.mapAttributes();
    var relationshipFields = Object.keys(self.subTaskResults);
    relationshipFields.forEach(function(f) {
      var res = self.subTaskResults[f];
      var indexes = res.indexes,
        objects = res.objects;
      var relatedData = self.getRelatedData(f).relatedData;
      var unflattenedObjects = util.unflattenArray(objects, relatedData);
      for (var i = 0; i < unflattenedObjects.length; i++) {
        var idx = indexes[i];
        // Errors are plucked from the suboperations.
        var error = self.errors[idx];
        err = error ? error[f] : null;
        if (!err) {
          var related = unflattenedObjects[i]; // Can be array or scalar.
          var object = self.objects[idx];
          if (object) {
            err = object.__proxies[f].set(related, {disableevents: self.disableevents});
            if (err) {
              if (!self.errors[idx]) self.errors[idx] = {};
              self.errors[idx][f] = err;
            }
          }
        }
      }
    });
  },
  /**
   * Figure out which data items require a cache lookup.
   * @returns {{remoteLookups: Array, localLookups: Array}}
   * @private
   */
  _sortLookups: function() {
    var remoteLookups = [];
    var localLookups = [];
    for (var i = 0; i < this.data.length; i++) {
      if (!this.objects[i]) {
        var lookup;
        var datum = this.data[i];
        var isScalar = typeof datum == 'string' || typeof datum == 'number' || datum instanceof String;
        if (datum) {
          if (isScalar) {
            lookup = {
              index: i,
              datum: {}
            };
            lookup.datum[this.model.id] = datum;
            remoteLookups.push(lookup);
          } else if (datum instanceof ModelInstance) { // We won't need to perform any mapping.
            this.objects[i] = datum;
          } else if (datum.localId) {
            localLookups.push({
              index: i,
              datum: datum
            });
          } else if (datum[this.model.id]) {
            remoteLookups.push({
              index: i,
              datum: datum
            });
          } else {
            this.objects[i] = this._instance();
          }
        } else {
          this.objects[i] = null;
        }
      }
    }
    return {remoteLookups: remoteLookups, localLookups: localLookups};
  },
  _performLocalLookups: function(localLookups) {
    var localIdentifiers = util.pluck(util.pluck(localLookups, 'datum'), 'localId'),
      localObjects = cache.getViaLocalId(localIdentifiers);
    for (var i = 0; i < localIdentifiers.length; i++) {
      var obj = localObjects[i];
      var localId = localIdentifiers[i];
      var lookup = localLookups[i];
      if (!obj) {
        // If there are multiple mapping operations going on, there may be
        obj = cache.get({localId: localId});
        if (!obj) obj = this._instance({localId: localId}, !this.disableevents);
        this.objects[lookup.index] = obj;
      } else {
        this.objects[lookup.index] = obj;
      }
    }

  },
  _performRemoteLookups: function(remoteLookups) {
    var remoteIdentifiers = util.pluck(util.pluck(remoteLookups, 'datum'), this.model.id),
      remoteObjects = cache.getViaRemoteId(remoteIdentifiers, {model: this.model});
    for (var i = 0; i < remoteObjects.length; i++) {
      var obj = remoteObjects[i],
        lookup = remoteLookups[i];
      if (obj) {
        this.objects[lookup.index] = obj;
      } else {
        var data = {};
        var remoteId = remoteIdentifiers[i];
        data[this.model.id] = remoteId;
        var cacheQuery = {
          model: this.model
        };
        cacheQuery[this.model.id] = remoteId;
        var cached = cache.get(cacheQuery);
        if (cached) {
          this.objects[lookup.index] = cached;
        } else {
          this.objects[lookup.index] = this._instance();
          // It's important that we map the remote identifier here to ensure that it ends
          // up in the cache.
          this.objects[lookup.index][this.model.id] = remoteId;
        }
      }
    }
  },
  /**
   * For indices where no object is present, perform cache lookups, creating a new object if necessary.
   * @private
   */
  _lookup: function() {
    if (this.model.singleton) {
      this._lookupSingleton();
    }
    else {
      var lookups = this._sortLookups(),
        remoteLookups = lookups.remoteLookups,
        localLookups = lookups.localLookups;
      this._performLocalLookups(localLookups);
      this._performRemoteLookups(remoteLookups);
    }
  },
  _lookupSingleton: function() {
    // Pick a random localId from the array of data being mapped onto the singleton object. Note that they should
    // always be the same. This is just a precaution.
    var localIdentifiers = util.pluck(this.data, 'localId'), localId;
    for (i = 0; i < localIdentifiers.length; i++) {
      if (localIdentifiers[i]) {
        localId = {localId: localIdentifiers[i]};
        break;
      }
    }
    // The mapping operation is responsible for creating singleton instances if they do not already exist.
    var singleton = cache.getSingleton(this.model) || this._instance(localId);
    for (var i = 0; i < this.data.length; i++) {
      this.objects[i] = singleton;
    }
  },
  _instance: function() {
    var model = this.model,
      modelInstance = model._instance.apply(model, arguments);
    this._newObjects.push(modelInstance);
    return modelInstance;
  },

  preprocessData: function() {
    var data = util.extend([], this.data);
    return data.map(function(datum) {
      if (datum) {
        if (!util.isString(datum)) {
          var keys = Object.keys(datum);
          keys.forEach(function(k) {
            var isRelationship = this.model._relationshipNames.indexOf(k) > -1;

            if (isRelationship) {
              var val = datum[k];
              if (val instanceof ModelInstance) {
                datum[k] = {localId: val.localId};
              }

            }
          }.bind(this));
        }
      }
      return datum;
    }.bind(this));
  },
  start: function(done) {
    var data = this.data;
    if (data.length) {
      var self = this;
      var tasks = [];
      this._lookup();
      tasks.push(this._executeSubOperations.bind(this));
      util.parallel(tasks, function(err) {
        if (err) console.error(err);
        self._map();
        // Users are allowed to add a custom init method to the methods object when defining a Model, of the form:
        //
        //
        // init: function ([done]) {
        //     // ...
        //  }
        //
        //
        // If done is passed, then __init must be executed asynchronously, and the mapping operation will not
        // finish until all inits have executed.
        //
        // Here we ensure the execution of all of them
        var fromStorage = this.fromStorage;
        var initTasks = self._newObjects.reduce(function(memo, o) {
          var init = o.model.init;
          if (init) {
            var paramNames = util.paramNames(init);
            if (paramNames.length > 1) {
              memo.push(init.bind(o, fromStorage, done));
            }
            else {
              init.call(o, fromStorage);
            }
          }
          o._emitEvents = true;
          o._emitNew();
          return memo;
        }, []);
        util.parallel(initTasks, function() {
          done(self.errors.length ? self.errors : null, self.objects);
        });
      }.bind(this));
    } else {
      done(null, []);
    }
  },
  getRelatedData: function(name) {
    var indexes = [];
    var relatedData = [];
    for (var i = 0; i < this.data.length; i++) {
      var datum = this.data[i];
      if (datum) {
        var val = datum[name];
        if (val) {
          indexes.push(i);
          relatedData.push(val);
        }
      }
    }
    return {
      indexes: indexes,
      relatedData: relatedData
    };
  }
  ,
  processErrorsFromTask: function(relationshipName, errors, indexes) {
    if (errors.length) {
      var relatedData = this.getRelatedData(relationshipName).relatedData;
      var unflattenedErrors = util.unflattenArray(errors, relatedData);
      for (var i = 0; i < unflattenedErrors.length; i++) {
        var idx = indexes[i];
        var err = unflattenedErrors[i];
        var isError = err;
        if (util.isArray(err)) isError = err.reduce(function(memo, x) {
          return memo || x
        }, false);
        if (isError) {
          if (!this.errors[idx]) this.errors[idx] = {};
          this.errors[idx][relationshipName] = err;
        }
      }
    }
  },
  _executeSubOperations: function(callback) {
    var self = this,
      relationshipNames = Object.keys(this.model.relationships);
    if (relationshipNames.length) {
      var tasks = relationshipNames.reduce(function(m, relationshipName) {
        var relationship = self.model.relationships[relationshipName];
        var reverseModel = relationship.forwardName == relationshipName ? relationship.reverseModel : relationship.forwardModel;
        // Mock any missing singleton data to ensure that all singleton instances are created.
        if (reverseModel.singleton && !relationship.isReverse) {
          this.data.forEach(function(datum) {
            if (!datum[relationshipName]) datum[relationshipName] = {};
          });
        }
        var __ret = this.getRelatedData(relationshipName),
          indexes = __ret.indexes,
          relatedData = __ret.relatedData;
        if (relatedData.length) {
          var flatRelatedData = util.flattenArray(relatedData);
          var op = new MappingOperation({
            model: reverseModel,
            data: flatRelatedData,
            disableevents: self.disableevents,
            _ignoreInstalled: self._ignoreInstalled,
            fromStorage: this.fromStorage
          });
        }

        if (op) {
          var task;
          task = function(done) {
            op.start(function(errors, objects) {
              self.subTaskResults[relationshipName] = {
                errors: errors,
                objects: objects,
                indexes: indexes
              };
              self.processErrorsFromTask(relationshipName, op.errors, indexes);
              done();
            });
          };
          m.push(task);
        }
        return m;
      }.bind(this), []);
      util.parallel(tasks, function(err) {
        callback(err);
      });
    } else {
      callback();
    }
  }
})
;

module.exports = MappingOperation;