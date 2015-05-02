var log = require('./log')('model'),
  InternalSiestaError = require('./error').InternalSiestaError,
  RelationshipType = require('./RelationshipType'),
  Filter = require('./Filter'),
  MappingOperation = require('./mappingOperation'),
  ModelInstance = require('./ModelInstance'),
  util = require('./util'),
  argsarray = require('argsarray'),
  error = require('./error'),
  extend = require('extend'),
  modelEvents = require('./modelEvents'),
  Condition = require('./Condition'),
  ProxyEventEmitter = require('./ProxyEventEmitter'),
  Promise = util.Promise,
  SiestaPromise = require('./Promise'),
  Placeholder = require('./Placeholder'),
  ReactiveFilter = require('./ReactiveFilter'),
  InstanceFactory = require('./instanceFactory');

/**
 *
 * @param {Object} opts
 */
function Model(opts) {
  var self = this;

  // Used when creating new contexts when must clone all the models/collections over to the new one
  this._rawOpts = util.extend({}, opts || {});
  this._opts = opts ? util.extend({}, opts) : {};

  util.extendFromOpts(this, opts, {
    methods: {},
    attributes: [],
    collection: null,
    id: 'id',
    relationships: [],
    name: null,
    indexes: [],
    singleton: false,
    statics: this.installStatics.bind(this),
    properties: {},
    init: null,
    serialise: null,
    serialiseField: null,
    serialisableFields: null,
    remove: null,
    parseAttribute: null
  }, false);

  if (!this.parseAttribute) {
    this.parseAttribute = function(attrName, value) {
      return value;
    }
  }

  this.attributes = Model._processAttributes(this.attributes);

  this._factory = new InstanceFactory(this);
  this._instance = this._factory._instance.bind(this._factory);

  util.extend(this, {
    _relationshipsInstalled: false,
    _reverseRelationshipsInstalled: false,
    children: []
  });

  Object.defineProperties(this, {
    _relationshipNames: {
      get: function() {
        return Object.keys(self.relationships);
      },
      enumerable: true
    },
    _attributeNames: {
      get: function() {
        var names = [];
        if (self.id) {
          names.push(self.id);
        }
        self.attributes.forEach(function(x) {
          names.push(x.name)
        });
        return names;
      },
      enumerable: true,
      configurable: true
    },
    installed: {
      get: function() {
        return self._relationshipsInstalled && self._reverseRelationshipsInstalled;
      },
      enumerable: true,
      configurable: true
    },
    descendants: {
      get: function() {
        return self.children.reduce(function(memo, descendant) {
          return Array.prototype.concat.call(memo, descendant.descendants);
        }.bind(self), util.extend([], self.children));
      },
      enumerable: true
    },
    dirty: {
      get: function() {
        if (this.context.storage) {
          var unsavedObjectsByCollection = this.context._storage._unsavedObjectsByCollection,
            hash = (unsavedObjectsByCollection[this.collectionName] || {})[this.name] || {};
          return !!Object.keys(hash).length;
        }
        else return undefined;
      },
      enumerable: true
    },
    collectionName: {
      get: function() {
        return this.collection.name;
      },
      enumerable: true
    },
    context: {
      get: function() {
        return this.collection.context;
      }
    }
  });
  var globalEventName = this.collectionName + ':' + this.name,
    proxied = {
      filter: this.filter.bind(this)
    };

  ProxyEventEmitter.call(this, this.context, globalEventName, proxied);

  this.installRelationships();
  this.installReverseRelationships();

  this._indexIsInstalled = new Condition(function(done) {
    if (this.context.storage) {
      this.context._storage.ensureIndexInstalled(this, function(err) {
        done(err);
      });
    }
    else done();
  }.bind(this));

  this._modelLoadedFromStorage = new Condition(function(done) {
    var storage = this.context.storage;
    if (storage) {
      this.context._storage.loadModel({model: this}, function(err) {
        done(err);
      });
    }
    else done();
  }.bind(this));

  this._storageEnabled = new Condition([this._indexIsInstalled, this._modelLoadedFromStorage]);
}

util.extend(Model, {
  /**
   * Normalise attributes passed via the options dictionary.
   * @param attributes
   * @returns {Array}
   * @private
   */
  _processAttributes: function(attributes) {
    return attributes.reduce(function(m, a) {
      if (typeof a == 'string') {
        m.push({
          name: a
        });
      }
      else {
        m.push(a);
      }
      return m;
    }, [])
  },
  install: function(models, cb) {
    cb = cb || function() {};
    return new SiestaPromise(function(resolve, reject) {
      var storageConditions = models.map(function(x) {return x._storageEnabled});
      Condition
        .all
        .apply(Condition, storageConditions)
        .then(function() {
          models.forEach(function(m) {
            m._installReversePlaceholders();
          });
          cb();
          resolve();
        })
        .catch(function(err) {
          reject(err);
        });
    });
  }

});

Model.prototype = Object.create(ProxyEventEmitter.prototype);

util.extend(Model.prototype, {
  installStatics: function(statics) {
    if (statics) {
      Object.keys(statics).forEach(function(staticName) {
        if (this[staticName]) {
          log('Static method with name "' + staticName + '" already exists. Ignoring it.');
        }
        else {
          this[staticName] = statics[staticName].bind(this);
        }
      }.bind(this));
    }
    return statics;
  },
  _validateRelationshipType: function(relationship) {
    if (!relationship.type) {
      if (this.singleton) relationship.type = RelationshipType.OneToOne;
      else relationship.type = RelationshipType.OneToMany;
    }
    if (this.singleton && relationship.type == RelationshipType.ManyToMany)
      throw new Error('Singleton model cannot use ManyToMany relationship.');
    if (Object.keys(RelationshipType).indexOf(relationship.type) < 0)
      throw new Error('Relationship type ' + relationship.type + ' does not exist');
  },
  _getReverseModel: function(reverseName) {
    var reverseModel;
    if (reverseName instanceof Model) reverseModel = reverseName;
    else reverseModel = this.collection[reverseName];
    if (!reverseModel) { // May have used Collection.Model format.
      var arr = reverseName.split('.');
      if (arr.length == 2) {
        var collectionName = arr[0];
        reverseName = arr[1];
        var otherCollection = this.context.collections[collectionName];
        if (otherCollection)
          reverseModel = otherCollection[reverseName];
      }
    }
    return reverseModel;
  },
  /**
   * Return the reverse model or a placeholder that will be resolved later.
   * @param forwardName
   * @param reverseName
   * @returns {*}
   * @private
   */
  _getReverseModelOrPlaceholder: function(forwardName, reverseName) {
    var reverseModel = this._getReverseModel(reverseName);
    return reverseModel || new Placeholder({name: reverseName, ref: this, forwardName: forwardName});
  },
  /**
   * Install relationships. Returns error in form of string if fails.
   * @return {String|null}
   */
  installRelationships: function() {
    if (!this._relationshipsInstalled) {
      var err = null;
      for (var name in this._opts.relationships) {
        if (this._opts.relationships.hasOwnProperty(name)) {
          var relationship = this._opts.relationships[name];
          if (!relationship.deletion) relationship.deletion = siesta.constants.Deletion.Nullify;
          // If a reverse relationship is installed beforehand, we do not want to process them.
          var isForward = !relationship.isReverse;
          if (isForward) {
            log(this.name + ': configuring relationship ' + name, relationship);
            if (!(err = this._validateRelationshipType(relationship))) {
              var reverseModelName = relationship.model;
              if (reverseModelName) {
                var reverseModel = this._getReverseModelOrPlaceholder(name, reverseModelName);
                util.extend(relationship, {
                  reverseModel: reverseModel,
                  forwardModel: this,
                  forwardName: name,
                  reverseName: relationship.reverse || 'reverse_' + name,
                  isReverse: false
                });
                delete relationship.model;
                delete relationship.reverse;

              }
              else return 'Must pass model';
            }
          }
        }
      }
    } else {
      throw new InternalSiestaError('Relationships for "' + this.name + '" have already been installed');
    }
    if (!err) this._relationshipsInstalled = true;
    return err;
  },
  _installReverse: function(relationship) {
    var reverseRelationship = util.extend({}, relationship);
    reverseRelationship.isReverse = true;
    var reverseModel = reverseRelationship.reverseModel;
    var isPlaceholder = reverseModel.isPlaceholder;
    if (isPlaceholder) {
      var modelName = reverseRelationship.reverseModel.name;
      reverseModel = this._getReverseModel(modelName);
      if (reverseModel) {
        reverseRelationship.reverseModel = reverseModel;
        relationship.reverseModel = reverseModel;
      }
    }


    if (reverseModel) {

      var reverseName = reverseRelationship.reverseName,
        forwardModel = reverseRelationship.forwardModel;

      if (reverseModel != this || reverseModel == forwardModel) {
        if (reverseModel.singleton) {
          if (reverseRelationship.type == RelationshipType.ManyToMany) throw new Error('Singleton model cannot be related via reverse ManyToMany');
          if (reverseRelationship.type == RelationshipType.OneToMany) throw new Error('Singleton model cannot be related via reverse OneToMany');
        }
        if (reverseModel.relationships[reverseName]) {
          // We are ok to redefine reverse relationships whereby the models are in the same hierarchy
          var isAncestorModel = reverseModel.relationships[reverseName].forwardModel.isAncestorOf(this);
          var isDescendentModel = reverseModel.relationships[reverseName].forwardModel.isDescendantOf(this);
          if (!isAncestorModel && !isDescendentModel && !isPlaceholder) {
            throw new Error('Reverse relationship "' + reverseName + '" already exists on model "' + reverseModel.name + '"');
          }
        }
        reverseModel.relationships[reverseName] = reverseRelationship;
      }

      var existingReverseInstances = (this.context.cache._localCacheByType[reverseModel.collectionName] || {})[reverseModel.name] || {};
      Object.keys(existingReverseInstances).forEach(function(localId) {
        var instancce = existingReverseInstances[localId];
        this._factory._installRelationship(reverseRelationship, instancce);
      }.bind(this));

    }
  },
  /**
   * Cycle through relationships and replace any placeholders with the actual models where possible.
   */
  _installReversePlaceholders: function() {
    for (var forwardName in this.relationships) {
      if (this.relationships.hasOwnProperty(forwardName)) {
        var relationship = this.relationships[forwardName];
        if (relationship.reverseModel.isPlaceholder) {
          this._installReverse(relationship);
        }
      }
    }
  },
  installReverseRelationships: function() {
    if (!this._reverseRelationshipsInstalled) {
      for (var forwardName in this.relationships) {
        if (this.relationships.hasOwnProperty(forwardName)) {
          this._installReverse(this.relationships[forwardName]);
        }
      }
      this._reverseRelationshipsInstalled = true;
    }
    else {
      throw new InternalSiestaError('Reverse relationships for "' + this.name + '" have already been installed.');
    }
  },
  _filter: function(filter) {
    return new Filter(this, filter || {});
  },
  filter: function(filter, cb) {
    var filterInstance;
    var promise = util.promise(cb, function(cb) {
      this.context._ensureInstalled(function() {
        if (!this.singleton) {
          filterInstance = this._filter(filter);
          return filterInstance.execute(cb);
        }
        else {
          filterInstance = this._filter({__ignoreInstalled: true});
          filterInstance.execute(function(err, objs) {
            if (err) cb(err);
            else {
              // Cache a new singleton and then reexecute the filter
              filter = util.extend({}, filter);
              filter.__ignoreInstalled = true;
              if (!objs.length) {
                this.graph({}, function(err) {
                  if (!err) {
                    filterInstance = this._filter(filter);
                    filterInstance.execute(cb);
                  }
                  else {
                    cb(err);
                  }
                }.bind(this));
              }
              else {
                filterInstance = this._filter(filter);
                filterInstance.execute(cb);
              }
            }
          }.bind(this));
        }
      }.bind(this));
    }.bind(this));

    // By wrapping the promise in another promise we can push the invocations to the bottom of the event loop so that
    // any event handlers added to the chain are honoured straight away.
    var linkPromise = new util.Promise(function(resolve, reject) {
      promise.then(argsarray(function(args) {
        setImmediate(function() {
          resolve.apply(null, args);
        });
      }), argsarray(function(args) {
        setImmediate(function() {
          reject.apply(null, args);
        })
      }));
    });

    return this._link({
      then: linkPromise.then.bind(linkPromise),
      catch: linkPromise.catch.bind(linkPromise),
      on: argsarray(function(args) {
        var rq = new ReactiveFilter(this._filter(filter));
        rq.init();
        rq.on.apply(rq, args);
      }.bind(this))
    });
  },
  /**
   * Only used in testing at the moment.
   * @param filter
   * @returns {ReactiveFilter}
   */
  _reactiveFilter: function(filter) {
    return new ReactiveFilter(new Filter(this, filter || {}));
  },
  one: function(opts, cb) {
    if (typeof opts == 'function') {
      cb = opts;
      opts = {};
    }
    return util.promise(cb, function(cb) {
      this.filter(opts, function(err, res) {
        if (err) cb(err);
        else {
          if (res.length > 1) {
            cb(error('More than one instance returned when executing get filter!'));
          }
          else {
            res = res.length ? res[0] : null;
            cb(null, res);
          }
        }
      });
    }.bind(this));
  },
  all: function(f, cb) {
    if (typeof f == 'function') {
      cb = f;
      f = {};
    }
    f = f || {};
    var filter = {};
    if (f.__order) filter.__order = f.__order;
    return this.filter(f, cb);
  },
  _attributeDefinitionWithName: function(name) {
    for (var i = 0; i < this.attributes.length; i++) {
      var attributeDefinition = this.attributes[i];
      if (attributeDefinition.name == name) return attributeDefinition;
    }
  },
  _graph: function(data, opts, cb) {
    var _map = function() {
      var overrides = opts.override;
      if (overrides) {
        if (util.isArray(overrides)) opts.objects = overrides;
        else opts.objects = [overrides];
      }
      delete opts.override;
      if (util.isArray(data)) {
        this._mapBulk(data, opts, cb);
      } else {
        this._mapBulk([data], opts, function(err, objects) {
          var obj;
          if (objects) {
            if (objects.length) {
              obj = objects[0];
            }
          }
          err = err ? (util.isArray(data) ? err : (util.isArray(err) ? err[0] : err)) : null;
          cb(err, obj);
        });
      }
    }.bind(this);
    _map();
  },
  /**
   * Map data into Siesta.
   *
   * @param data Raw data received remotely or otherwise
   * @param {function|object} [opts]
   * @param {boolean} opts.override
   * @param {boolean} opts._ignoreInstalled - A hack that allows mapping onto Models even if install process has not finished.
   * @param {function} [cb] Called once pouch persistence returns.
   */
  graph: function(data, opts, cb) {
    if (typeof opts == 'function') cb = opts;
    opts = opts || {};
    return util.promise(cb, function(cb) {
      this
        .context
        ._ensureInstalled(function(err) {
          if (!err) {
            this._graph(data, opts, cb);
          }
          else {
            cb(err);
          }
        }.bind(this));
    }.bind(this));
  },
  _mapBulk: function(data, opts, callback) {
    util.extend(opts, {model: this, data: data});
    var op = new MappingOperation(opts);
    op.start(function(err, objects) {
      if (err) {
        if (callback) callback(err);
      } else {
        callback(null, objects || []);
      }
    });
  },
  _countCache: function() {
    var collCache = this.context.cache._localCacheByType[this.collectionName] || {};
    var modelCache = collCache[this.name] || {};
    return Object.keys(modelCache).reduce(function(m, localId) {
      m[localId] = {};
      return m;
    }, {});
  },
  count: function(cb) {
    return util.promise(cb, function(cb) {
      this.context._ensureInstalled(function() {
        cb(null, Object.keys(this._countCache()).length);
      }.bind(this));
    }.bind(this));
  },
  _dump: function(asJSON) {
    var dumped = {};
    dumped.name = this.name;
    dumped.attributes = this.attributes;
    dumped.id = this.id;
    dumped.collection = this.collectionName;
    dumped.relationships = this.relationships.map(function(r) {
      return r.isForward ? r.forwardName : r.reverseName;
    });
    return asJSON ? util.prettyPrint(dumped) : dumped;
  },
  toString: function() {
    return 'Model[' + this.name + ']';
  },
  removeAll: function(cb) {
    return util.promise(cb, function(cb) {
      this.all()
        .then(function(instances) {
          instances.remove();
          cb();
        })
        .catch(cb);
    }.bind(this));
  }

});

// Subclassing
util.extend(Model.prototype, {
  child: function(nameOrOpts, opts) {
    if (typeof nameOrOpts == 'string') {
      opts.name = nameOrOpts;
    } else {
      opts = name;
    }
    util.extend(opts, {
      attributes: Array.prototype.concat.call(opts.attributes || [], this._opts.attributes),
      relationships: util.extend(opts.relationships || {}, this._opts.relationships),
      methods: util.extend(util.extend({}, this._opts.methods) || {}, opts.methods),
      statics: util.extend(util.extend({}, this._opts.statics) || {}, opts.statics),
      properties: util.extend(util.extend({}, this._opts.properties) || {}, opts.properties),
      id: opts.id || this._opts.id,
      init: opts.init || this._opts.init,
      remove: opts.remove || this._opts.remove,
      parseAttribute: opts.parseAttribute || this._opts.parseAttribute
    });

    var model = this.collection.model(opts.name, opts);
    model.parent = this;
    this.children.push(model);
    return model;
  },
  isChildOf: function(parent) {
    return this.parent == parent;
  },
  isParentOf: function(child) {
    return this.children.indexOf(child) > -1;
  },
  isDescendantOf: function(ancestor) {
    var parent = this.parent;
    while (parent) {
      if (parent == ancestor) return true;
      parent = parent.parent;
    }
    return false;
  },
  isAncestorOf: function(descendant) {
    return this.descendants.indexOf(descendant) > -1;
  },
  hasAttributeNamed: function(attributeName) {
    return this._attributeNames.indexOf(attributeName) > -1;
  }
});


module.exports = Model;
