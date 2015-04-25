var log = require('./log'),
  util = require('./util'),
  error = require('./error'),
  modelEvents = require('./modelEvents'),
  ModelEventType = modelEvents.ModelEventType,
  events = require('./events'),
  cache = require('./cache');

function ModelInstance(model) {
  var self = this;
  this.model = model;

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

  events.ProxyEventEmitter.call(this);

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
        if (siesta.ext.storageEnabled) {
          return self.localId in siesta.ext.storage._unsavedObjectsHash;
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
    app: {
      get: function() {
        return this.model.app;
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

ModelInstance.prototype = Object.create(events.ProxyEventEmitter.prototype);

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
    modelEvents.emit(opts);
  },
  remove: function(cb, notification) {
    _.each(this._relationshipNames, function(name) {
      if (util.isArray(this[name])) {
        this[name] = [];
      }
      else {
        this[name] = null;
      }
    }.bind(this));
    notification = notification == null ? true : notification;
    return util.promise(cb, function(cb) {
      cache.remove(this);
      this.removed = true;
      if (notification) {
        this.emit(modelEvents.ModelEventType.Remove, {
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
        cache.insert(this);
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

function defaultSerialiser(attrName, value) {
  return value;
}

// Serialisation
util.extend(ModelInstance.prototype, {
  _defaultSerialise: function(opts) {
    var serialised = {};
    var includeNullAttributes = opts.includeNullAttributes !== undefined ? opts.includeNullAttributes : true,
      includeNullRelationships = opts.includeNullRelationships !== undefined ? opts.includeNullRelationships : true;
    var serialisableFields = this.model.serialisableFields ||
      this._attributeNames.concat.apply(this._attributeNames, this._relationshipNames).concat(this.id);
    this._attributeNames.forEach(function(attrName) {
      if (serialisableFields.indexOf(attrName) > -1) {
        var attrDefinition = this.model._attributeDefinitionWithName(attrName) || {};
        var serialiser;
        if (attrDefinition.serialise) serialiser = attrDefinition.serialise.bind(this);
        else {
          var serialiseField = this.model.serialiseField || defaultSerialiser;
          serialiser = serialiseField.bind(this, attrName);
        }
        var val = this[attrName];
        if (val === null) {
          if (includeNullAttributes) {
            serialised[attrName] = serialiser(val);
          }
        }
        else if (val !== undefined) {
          serialised[attrName] = serialiser(val);
        }
      }
    }.bind(this));
    this._relationshipNames.forEach(function(relName) {
      if (serialisableFields.indexOf(relName) > -1) {
        var val = this[relName],
          rel = this.model.relationships[relName];

        if (rel && !rel.isReverse) {
          var serialiser;
          if (rel.serialise) {
            serialiser = rel.serialise.bind(this);
          }
          else {
            var serialiseField = this.model.serialiseField;
            if (!serialiseField) {
              if (util.isArray(val)) val = util.pluck(val, this.model.id);
              else if (val) val = val[this.model.id];
            }
            serialiseField = serialiseField || defaultSerialiser;
            serialiser = serialiseField.bind(this, relName);
          }
          if (val === null) {
            if (includeNullRelationships) {
              serialised[relName] = serialiser(val);
            }
          }
          else if (util.isArray(val)) {
            if ((includeNullRelationships && !val.length) || val.length) {
              serialised[relName] = serialiser(val);
            }
          }
          else if (val !== undefined) {
            serialised[relName] = serialiser(val);
          }
        }
      }
    }.bind(this));
    return serialised;
  },
  serialise: function(opts) {
    opts = opts || {};
    if (!this.model.serialise) return this._defaultSerialise(opts);
    else return this.model.serialise(this, opts);
  }
});

util.extend(ModelInstance.prototype, {
  /**
   * Emit an event indicating that this instance has just been created.
   * @private
   */
  _emitNew: function() {
    modelEvents.emit({
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
