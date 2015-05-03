var log = require('./log'),
  util = require('./util'),
  error = require('./error'),
  modelEvents = require('./modelEvents'),
  ModelEventType = modelEvents.ModelEventType,
  ProxyEventEmitter = require('./ProxyEventEmitter');


function ModelInstance(model) {
  if (!model) throw new Error('wtf');
  var self = this;
  this.model = model;

  ProxyEventEmitter.call(this, model.context);

  this.__proxies = {};
  this._proxies = [];

  util.subProperties(this, this.model, [
    'collection',
    'collectionName',
    '_attributeNames',
    {
      name: 'idField',
      property: 'id'
    },
    {
      name: 'modelName',
      property: 'name'
    }
  ]);


  Object.defineProperties(this, {
    _relationshipNames: {
      get: function() {
        var proxies = Object.keys(self.__proxies || {}).map(function(x) {
          return self.__proxies[x]
        });
        return proxies.map(function(p) {
          if (p.isForward) {
            return p.forwardName;
          } else {
            return p.reverseName;
          }
        });
      },
      enumerable: true,
      configurable: true
    },
    dirty: {
      get: function() {
        if (this.context.storage) {
          return self.localId in this.context._storage._unsavedObjectsHash;
        }
        else return undefined;
      },
      enumerable: true
    },
    // This is for ProxyEventEmitter.
    event: {
      get: function() {
        return this.localId
      }
    },
    context: {
      get: function() {
        return this.model.context;
      }
    }
  });

  this.removed = false;

  /**
   * Whether or not events (set, remove etc) are emitted for this model instance.
   *
   * This is used as a way of controlling what events are emitted when the model instance is created. E.g. we don't
   * want to send a metric shit ton of 'set' events if we're newly creating an instance. We only want to send the
   * 'new' event once constructed.
   *
   * This is probably a bit of a hack and should be removed eventually.
   * @type {boolean}
   * @private
   */
  this._emitEvents = false;
}

ModelInstance.prototype = Object.create(ProxyEventEmitter.prototype);

util.extend(ModelInstance.prototype, {
  get: function(cb) {
    return util.promise(cb, function(cb) {
      cb(null, this);
    }.bind(this));
  },
  emit: function(type, opts) {
    if (typeof type == 'object') opts = type;
    else opts.type = type;
    opts = opts || {};
    util.extend(opts, {
      collection: this.collectionName,
      model: this.model.name,
      localId: this.localId,
      obj: this
    });
    this.context.broadcast(opts);
  },
  delete: function(cb, notification) {
    _.each(this._relationshipNames, function(name) {
      var toDelete;
      var def = this.model.relationships[name];
      if (def) {
        if (def.deletion === siesta.constants.Deletion.Cascade) {
          if (def.type == 'OneToMany') {
            if (def.isReverse) {
              toDelete = this[name];
            }
          }
          else if (def.type == 'OneToOne') {
            var val = this[name];
            if (val)  toDelete = [val];
          }
        }
      }

      if (util.isArray(this[name])) {
        this[name] = [];
      }
      else {
        this[name] = null;
      }
      if (toDelete) {
        toDelete.forEach(function(r) {
          r.delete();
        });
      }

    }.bind(this));
    notification = notification == null ? true : notification;
    return util.promise(cb, function(cb) {
      this.context.cache.remove(this);
      this.removed = true;
      if (notification) {
        this.emit(modelEvents.ModelEventType.Delete, {
          old: this
        });
      }
      var remove = this.model.remove;
      if (remove) {
        var paramNames = util.paramNames(remove);
        if (paramNames.length) {
          var self = this;
          remove.call(this, function(err) {
            cb(err, self);
          });
        }
        else {
          remove.call(this);
          cb(null, this);
        }
      }
      else {
        cb(null, this);
      }
    }.bind(this));
  },
  restore: function(cb) {
    return util.promise(cb, function(cb) {
      var _finish = function(err) {
        if (!err) {
          this.emit(modelEvents.ModelEventType.New, {
            new: this
          });
        }
        cb(err, this);
      }.bind(this);
      if (this.removed) {
        this.context.cache.insert(this);
        this.removed = false;
        var init = this.model.init;
        if (init) {
          var paramNames = util.paramNames(init);
          var fromStorage = true;
          if (paramNames.length > 1) {
            init.call(this, fromStorage, _finish);
          }
          else {
            init.call(this, fromStorage);
            _finish();
          }
        }
        else {
          _finish();
        }
      }
    }.bind(this));
  }
});

// Inspection
util.extend(ModelInstance.prototype, {
  getAttributes: function() {
    return util.extend({}, this.__values);
  },
  isInstanceOf: function(model) {
    return this.model == model;
  },
  isA: function(model) {
    return this.model == model || this.model.isDescendantOf(model);
  }
});

// Dump
util.extend(ModelInstance.prototype, {
  _dumpString: function(reverseRelationships) {
    return JSON.stringify(this._dump(reverseRelationships, null, 4));
  },
  _dump: function(reverseRelationships) {
    var dumped = util.extend({}, this.__values);
    dumped._rev = this._rev;
    dumped.localId = this.localId;
    return dumped;
  }
});



util.extend(ModelInstance.prototype, {
  /**
   * Emit an event indicating that this instance has just been created.
   * @private
   */
  _emitNew: function() {
    this.context.broadcast({
      collection: this.model.collectionName,
      model: this.model.name,
      localId: this.localId,
      new: this,
      type: ModelEventType.New,
      obj: this
    });
  }
});

module.exports = ModelInstance;
