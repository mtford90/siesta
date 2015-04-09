var log = require('./log')('model'),
  CollectionRegistry = require('./collectionRegistry').CollectionRegistry,
  InternalSiestaError = require('./error').InternalSiestaError,
  RelationshipType = require('./RelationshipType'),
  Query = require('./Query'),
  MappingOperation = require('./mappingOperation'),
  ModelInstance = require('./ModelInstance'),
  util = require('./util'),
  cache = require('./cache'),
  argsarray = require('argsarray'),
  error = require('./error'),
  extend = require('extend'),
  modelEvents = require('./modelEvents'),
  Condition = require('./Condition'),
  events = require('./events'),
  Placeholder = require('./Placeholder'),
  ReactiveQuery = require('./ReactiveQuery'),
  InstanceFactory = require('./instanceFactory');

/**
 *
 * @param {Object} opts
 */
function Model(opts) {
  var self = this;
  this._opts = opts ? util.extend({}, opts) : {};

  util.extendFromOpts(this, opts, {
    methods: {},
    attributes: [],
    collection: function(c) {
      if (util.isString(c)) {
        c = CollectionRegistry[c];
      }
      return c;
    },
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

  if (!this.serialiseField) {
    this.serialiseField = function(attrName, value) {
      return value;
    };
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
        if (siesta.ext.storageEnabled) {
          var unsavedObjectsByCollection = siesta.ext.storage._unsavedObjectsByCollection,
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
    }
  });
  var globalEventName = this.collectionName + ':' + this.name,
    proxied = {
      query: this.query.bind(this)
    };

  events.ProxyEventEmitter.call(this, globalEventName, proxied);

  this._indexIsInstalled = new Condition(function(done) {
    if (siesta.ext.storageEnabled) siesta.ext.storage.ensureIndexInstalled(this, done);
    else done();
  }.bind(this));

  this._modelLoadedFromStorage = new Condition(function(done) {
    if (siesta.ext.storageEnabled) siesta.ext.storage.loadModel({model: this}, done);
    else done();
  });

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
  }

});

Model.prototype = Object.create(events.ProxyEventEmitter.prototype);

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
    if (this.singleton && relationship.type == RelationshipType.ManyToMany) {
      return 'Singleton model cannot use ManyToMany relationship.';
    }
    if (Object.keys(RelationshipType).indexOf(relationship.type) < 0)
      return 'Relationship type ' + relationship.type + ' does not exist';
    return null;
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
        var otherCollection = CollectionRegistry[collectionName];
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
    var reverseModel = relationship.reverseModel;
    var isPlaceholder = reverseModel.isPlaceholder;
    if (isPlaceholder) {
      var modelName = relationship.reverseModel.name;
      reverseModel = this._getReverseModel(modelName);
      if (reverseModel) {
        relationship.reverseModel = reverseModel;
      }
    }
    if (reverseModel) {
      var err;
      var reverseName = relationship.reverseName,
        forwardModel = relationship.forwardModel;

      if (reverseModel != this || reverseModel == forwardModel) {
        if (reverseModel.singleton) {
          if (relationship.type == RelationshipType.ManyToMany) err = 'Singleton model cannot be related via reverse ManyToMany';
          if (relationship.type == RelationshipType.OneToMany) err = 'Singleton model cannot be related via reverse OneToMany';
        }
        if (!err) {
          log(this.name + ': configuring  reverse relationship ' + reverseName);
          if (reverseModel.relationships[reverseName]) {
            // We are ok to redefine reverse relationships whereby the models are in the same hierarchy
            var isAncestorModel = reverseModel.relationships[reverseName].forwardModel.isAncestorOf(this);
            var isDescendentModel = reverseModel.relationships[reverseName].forwardModel.isDescendantOf(this);
            if (!isAncestorModel && !isDescendentModel) {
              err = 'Reverse relationship "' + reverseName + '" already exists on model "' + reverseModel.name + '"';
            }
          }
          if (!err) {
            reverseModel.relationships[reverseName] = relationship;
          }
        }
      }
      if (isPlaceholder) {
        var existingReverseInstances = (cache._localCacheByType[reverseModel.collectionName] || {})[reverseModel.name] || {};
        Object.keys(existingReverseInstances).forEach(function(localId) {
          var instancce = existingReverseInstances[localId];
          var r = util.extend({}, relationship);
          r.isReverse = true;
          this._factory._installRelationship(r, instancce);
        }.bind(this));
      }
    }
    return err;
  },
  /**
   * Cycle through relationships and replace any placeholders with the actual models where possible.
   */
  _installReversePlaceholders: function() {
    for (var forwardName in this.relationships) {
      if (this.relationships.hasOwnProperty(forwardName)) {
        var relationship = this.relationships[forwardName];
        if (relationship.reverseModel.isPlaceholder) this._installReverse(relationship);
      }
    }
  },
  installReverseRelationships: function() {
    if (!this._reverseRelationshipsInstalled) {
      for (var forwardName in this.relationships) {
        if (this.relationships.hasOwnProperty(forwardName)) {
          var relationship = this.relationships[forwardName];
          relationship = extend(true, {}, relationship);
          relationship.isReverse = true;
          var err = this._installReverse(relationship);
        }
      }
      this._reverseRelationshipsInstalled = true;
    }
    else {
      throw new InternalSiestaError('Reverse relationships for "' + this.name + '" have already been installed.');
    }
    return err;
  },
  _query: function(query) {
    return new Query(this, query || {});
  },
  query: function(query, cb) {
    var queryInstance;
    var promise = util.promise(cb, function(cb) {
      if (!this.singleton) {
        queryInstance = this._query(query);
        return queryInstance.execute(cb);
      }
      else {
        queryInstance = this._query({__ignoreInstalled: true});
        queryInstance.execute(function(err, objs) {
          if (err) cb(err);
          else {
            // Cache a new singleton and then reexecute the query
            query = util.extend({}, query);
            query.__ignoreInstalled = true;
            if (!objs.length) {
              this.graph({}, function(err) {
                if (!err) {
                  queryInstance = this._query(query);
                  queryInstance.execute(cb);
                }
                else {
                  cb(err);
                }
              }.bind(this));
            }
            else {
              queryInstance = this._query(query);
              queryInstance.execute(cb);
            }
          }
        }.bind(this));
      }
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
        var rq = new ReactiveQuery(this._query(query));
        rq.init();
        rq.on.apply(rq, args);
      }.bind(this))
    });
  },
  /**
   * Only used in testing at the moment.
   * @param query
   * @returns {ReactiveQuery}
   */
  _reactiveQuery: function(query) {
    return new ReactiveQuery(new Query(this, query || {}));
  },
  one: function(opts, cb) {
    if (typeof opts == 'function') {
      cb = opts;
      opts = {};
    }
    return util.promise(cb, function(cb) {
      this.query(opts, function(err, res) {
        if (err) cb(err);
        else {
          if (res.length > 1) {
            cb(error('More than one instance returned when executing get query!'));
          }
          else {
            res = res.length ? res[0] : null;
            cb(null, res);
          }
        }
      });
    }.bind(this));
  },
  all: function(q, cb) {
    if (typeof q == 'function') {
      cb = q;
      q = {};
    }
    q = q || {};
    var query = {};
    if (q.__order) query.__order = q.__order;
    return this.query(q, cb);
  },
  _attributeDefinitionWithName: function(name) {
    for (var i = 0; i < this.attributes.length; i++) {
      var attributeDefinition = this.attributes[i];
      if (attributeDefinition.name == name) return attributeDefinition;
    }
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
      if (opts._ignoreInstalled) {
        _map();
      }
      else siesta._afterInstall(_map);
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
    var collCache = cache._localCacheByType[this.collectionName] || {};
    var modelCache = collCache[this.name] || {};
    return Object.keys(modelCache).reduce(function(m, localId) {
      m[localId] = {};
      return m;
    }, {});
  },
  count: function(cb) {
    return util.promise(cb, function(cb) {
      cb(null, Object.keys(this._countCache()).length);
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
      serialise: opts.serialise || this._opts.serialise,
      serialiseField: opts.serialiseField || this._opts.serialiseField,
      parseAttribute: opts.parseAttribute || this._opts.parseAttribute
    });

    if (this._opts.serialisableFields) {
      opts.serialisableFields = Array.prototype.concat.apply(opts.serialisableFields || [], this._opts.serialisableFields);
    }

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
