/**
 * @module mapping
 */

var log = require('./operation/log')
    , CollectionRegistry = require('./collectionRegistry').CollectionRegistry
    , InternalSiestaError = require('./error').InternalSiestaError
    , relationship = require('./relationship')
    , Query = require('./query').Query
    , Operation = require('./operation/operation').Operation
    , BulkMappingOperation = require('./mappingOperation').BulkMappingOperation
    , SiestaModel = require('./modelInstance').ModelInstance
    , util = require('./util')
    , cache = require('./cache')
    , store = require('./store')
    , extend = require('extend')
    , coreChanges = require('./changes')
    , notificationCentre = require('./notificationCentre').notificationCentre
    , wrapArray = require('./notificationCentre').wrapArray
    , OneToManyProxy = require('./oneToManyProxy')
    , OneToOneProxy = require('./oneToOneProxy')
    , ManyToManyProxy = require('./manyToManyProxy')
    , ReactiveQuery = require('./reactiveQuery')
    , PositionalReactiveQuery = require('./positionedReactiveQuery')
    , _ = util._
    , RelationshipType = relationship.RelationshipType
    , guid = util.guid
    , ChangeType = coreChanges.ChangeType
    ;

var Logger = log.loggerWithName('Model');
Logger.setLevel(log.Level.trace);

/**
 *
 * @param {Object} opts
 */
function Model(opts) {
    var self = this;
    this._opts = opts;

    util.extendFromOpts(this, opts, {
        methods: {},
        type: null,
        attributes: [],
        collection: null,
        id: 'id',
        relationships: [],
        name: null,
        indexes: [],
        singleton: false,
        statics: this.installStatics.bind(this)
    });

    this.attributes = Model._processAttributes(this.attributes);

    _.extend(this, {
        _installed: false,
        _relationshipsInstalled: false,
        _reverseRelationshipsInstalled: false,
        children: []
    });


    util.defineProperties(this, {
        _relationshipNames: {
            get: function () {
                return Object.keys(self.relationships);
            },
            enumerable: true
        },
        _attributeNames: {
            get: function () {
                var names = [];
                if (self.id) {
                    names.push(self.id);
                }
                _.each(self.attributes, function (x) {
                    names.push(x.name)
                });
                return names;
            },
            enumerable: true,
            configurable: true
        },
        installed: {
            get: function () {
                return self._installed && self._relationshipsInstalled && self._reverseRelationshipsInstalled;
            },
            enumerable: true,
            configurable: true
        },
        descendants: {
            get: function () {
                return _.reduce(self.children, function (memo, descendant) {
                    return Array.prototype.concat.call(memo, descendant.descendants);
                }.bind(self), _.extend([], self.children));
            },
            enumerable: true
        },
        dirty: {
            get: function () {
                if (siesta.ext.storageEnabled) {
                    var unsavedObjectsByCollection = siesta.ext.storage._unsavedObjectsByCollection,
                        hash = (unsavedObjectsByCollection[this.collection] || {})[this.type] || {};
                    return !!Object.keys(hash).length;
                }
                else return undefined;
            },
            enumerable: true
        }
    });

}

_.extend(Model, {
    /**
     * Normalise attributes passed via the options dictionary.
     * @param attributes
     * @returns {Array}
     * @private
     */
    _processAttributes: function (attributes) {
        return _.reduce(attributes, function (m, a) {
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

_.extend(Model.prototype, {
    installStatics: function (statics) {
        if (statics) {
            _.each(Object.keys(statics), function (staticName) {
                if (this[staticName]) {
                    Logger.error('Static method with name "' + staticName + '" already exists. Ignoring it.');
                }
                else {
                    this[staticName] = statics[staticName].bind(this);
                }
            }.bind(this));
        }
    },
    /**
     * Install relationships. Returns error in form of string if fails.
     * @return {String|null}
     */
    installRelationships: function () {
        if (!this._relationshipsInstalled) {
            var self = this;
            self._relationships = [];
            if (self._opts.relationships) {
                for (var name in self._opts.relationships) {
                    if (self._opts.relationships.hasOwnProperty(name)) {
                        var relationship = self._opts.relationships[name];
                        if (Logger.debug.isEnabled)
                            Logger.debug(self.type + ': configuring relationship ' + name, relationship);
                        if (self.singleton) {
                            if (relationship.type != RelationshipType.OneToOne) {
                                Logger.warn('Singleton mappings can only be used with OneToOne relationships');
                            }
                            relationship.type = RelationshipType.OneToOne;
                        }
                        if (relationship.type == RelationshipType.OneToMany ||
                            relationship.type == RelationshipType.OneToOne ||
                            relationship.type == RelationshipType.ManyToMany) {
                            var modelName = relationship.model;
                            if (Logger.debug.isEnabled)
                                Logger.debug('reverseModelName', modelName);
                            if (!self.collection) throw new InternalSiestaError('Model must have collection');
                            var collection = CollectionRegistry[self.collection];
                            if (!collection) {
                                throw new InternalSiestaError('Collection ' + self.collection + ' not registered');
                            }
                            var reverseModel = collection[modelName];
                            if (!reverseModel) {
                                var arr = modelName.split('.');
                                if (arr.length == 2) {
                                    var collectionName = arr[0];
                                    modelName = arr[1];
                                    var otherCollection = CollectionRegistry[collectionName];
                                    if (!otherCollection) {
                                        return 'Collection with name "' + collectionName + '" does not exist.';
                                    }
                                    reverseModel = otherCollection[modelName];
                                }
                            }
                            if (Logger.debug.isEnabled)
                                Logger.debug('reverseModel', reverseModel);
                            if (reverseModel) {
                                relationship.reverseModel = reverseModel;
                                relationship.forwardModel = this;
                                relationship.forwardName = name;
                                relationship.reverseName = relationship.reverse;
                                relationship.isReverse = false;
                            } else {
                                return 'Model with name "' + modelName.toString() + '" does not exist';
                            }
                        } else {
                            return 'Relationship type ' + relationship.type + ' does not exist';
                        }
                    }
                }
            }
            this._relationshipsInstalled = true;
        } else {
            throw new InternalSiestaError('Relationships for "' + this.type + '" have already been installed');
        }
        return null;
    },
    installReverseRelationships: function () {
        if (!this._reverseRelationshipsInstalled) {
            for (var forwardName in this.relationships) {
                if (this.relationships.hasOwnProperty(forwardName)) {
                    var relationship = this.relationships[forwardName];
                    relationship = extend(true, {}, relationship);
                    relationship.isReverse = true;
                    var reverseModel = relationship.reverseModel;
                    var reverseName = relationship.reverseName;
                    if (Logger.debug.isEnabled)
                        Logger.debug(this.type + ': configuring  reverse relationship ' + reverseName);
                    reverseModel.relationships[reverseName] = relationship;
                }
            }
            this._reverseRelationshipsInstalled = true;
        } else {
            throw new InternalSiestaError('Reverse relationships for "' + this.type + '" have already been installed.');
        }
    },
    ensureSingletons: function (callback) {
        if (this.singleton) {
            this.get(function (err, obj) {
                if (err) {
                    callback(err);
                }
                else {
                    if (!obj) {
                        var data = {};
                        var relationships = this.relationships;
                        data = _.reduce(Object.keys(relationships), function (m, name) {
                            var r = relationships[name];
                            if (r.isReverse) {
                                data[r.reverseName] = {};
                            }
                            return data;
                        }, data);
                        this.map(data, function (err, obj) {
                            if (Logger.trace) Logger.trace('Ensured singleton mapping "' + this.type + '"', obj);
                            callback(err, obj);
                        }.bind(this));
                    }
                    else {
                        if (Logger.trace) Logger.trace('Singleton already exists for mapping "' + this.type + '"', obj);
                        callback(null, obj);
                    }
                }
            }.bind(this));
        }
        else {
            callback();
        }
    }, /**
     * Any post installation steps that need to be performed.
     */
    finaliseInstallation: function (callback) {
        if (this.singleton) {
            // Ensure that the singleton objects exist, and that all singleton relationships
            // are hooked up.
            // TODO: Any parent singletons will be having empty data mapped twice when their own finalise is called... Pointless.
            this.ensureSingletons(callback);
        }
        else callback();
    },
    query: function (query) {
        return new Query(this, query || {});
    },
    reactiveQuery: function (query) {
        return new ReactiveQuery(new Query(this, query || {}));
    },
    positionalReactiveQuery: function (query) {
        return new PositionalReactiveQuery(new Query(this, query || {}));
    },
    get: function (idOrCallback, callback) {
        var deferred = window.q ? window.q.defer() : null;
        callback = util.cb(callback, deferred);
        if (this.singleton) {
            if (typeof idOrCallback == 'function') {
                callback = idOrCallback;
            }
            this.all().execute(function (err, objs) {
                if (err) callback(err);
                if (objs.length > 1) {
                    throw new InternalSiestaError('Somehow more than one object has been created for a singleton mapping! ' +
                    'This is a serious error, please file a bug report.');
                } else if (objs.length) {
                    callback(null, objs[0]);
                } else {
                    callback(null, null);
                }
            });
        } else {
            var opts = {};
            opts[this.id] = idOrCallback;
            opts.model = this;
            var obj = cache.get(opts);
            if (obj) {
                callback(null, obj);
            } else {
                delete opts.model;
                var query = new Query(this, opts);
                query.execute(function (err, rows) {
                    var obj = null;
                    if (!err && rows.length) {
                        if (rows.length > 1) {
                            throw new InternalSiestaError('More than one object with id=' + idOrCallback.toString());
                        } else {
                            obj = rows[0];
                        }
                    }
                    callback(err, obj);
                });
            }

        }
        return deferred ? deferred.promise : null;
    },
    all: function () {
        return new Query(this, {});
    },
    install: function (callback) {
        if (Logger.info.isEnabled) Logger.info('Installing mapping ' + this.type);
        var deferred = window.q ? window.q.defer() : null;
        callback = util.cb(callback, deferred);
        if (!this._installed) {
            var errors = this._validate();
            this._installed = true;
            if (Logger.info.isEnabled) {
                if (errors.length) Logger.error('Errors installing mapping ' + this.type + ': ' + errors);
                else Logger.info('Installed mapping ' + this.type);
            }
            callback(errors.length ? errors : null);
        } else {
            throw new InternalSiestaError('Model "' + this.type + '" has already been installed');
        }
        return deferred ? deferred.promise : null;
    },
    _validate: function () {
        var errors = [];
        if (!this.type) {
            errors.push('Must specify a type');
        }
        if (!this.collection) {
            errors.push('A mapping must belong to an collection');
        }
        return errors;
    },
    /**
     * Map data into Siesta.
     *
     * @param data Raw data received remotely or otherwise
     * @param {function|object} [optsOrCallback]
     * @param {boolean} optsOrCallback.override
     * @param {function} [callback] Called once pouch persistence returns.
     */
    map: function (data, optsOrCallback, callback) {
        var opts;
        if (typeof optsOrCallback == 'function') callback = optsOrCallback;
        else if (optsOrCallback) opts = optsOrCallback;
        opts = opts || {};
        var deferred = util.defer(callback);
        var overrides = opts.override;
        if (overrides) {
            if (util.isArray(overrides)) opts.objects = overrides;
            else opts.objects = [overrides];
        }
        if (this.installed) {
            if (util.isArray(data)) {
                this._mapBulk(data, opts, deferred.finish);
            } else {

                this._mapBulk([data], opts, function (err, objects) {
                    var obj;
                    if (objects) {
                        if (objects.length) {
                            obj = objects[0];
                        }
                    }
                    deferred.finish(err ? err[0] : null, obj);
                });
            }
        } else {
            throw new InternalSiestaError('Model must be fully installed before creating any models');
        }
        return deferred.promise;
    },
    _mapBulk: function (data, opts, callback) {
        _.extend(opts, {model: this, data: data});
        var op = new BulkMappingOperation(opts);
        op.onCompletion(function () {
            var err = op.error;
            if (err) {
                if (callback) callback(err);
            } else {
                var objects = op.result;
                callback(null, objects);
            }
        });
        op.start();
    },
    _countCache: function () {
        var collCache = cache._localCacheByType[this.collection] || {};
        var modelCache = collCache[this.type] || {};
        return _.reduce(Object.keys(modelCache), function (m, _id) {
            m[_id] = {};
            return m;
        }, {});
    },
    count: function (callback) {
        var deferred = window.q ? window.q.defer() : null;
        callback = util.cb(callback, deferred);
        var hash = this._countCache();
        if (siesta.ext.storageEnabled) {
            var pouch = siesta.ext.storage.Pouch.getPouch();
            var indexName = (new siesta.ext.storage.Index(this.collection, this.type))._getName() + '_';
            pouch.query(indexName, {
                include_docs: false
            }, function (err, resp) {
                var n;
                if (!err) {
                    _.each(_.pluck(resp.rows, 'id'), function (id) {
                        hash[id] = {};
                    });
                    n = Object.keys(hash).length;
                }
                callback(err, n);
            });
        } else {
            callback(null, Object.keys(hash).length)
        }
        return deferred ? deferred.promise : null;
    },
    /**
     * Convert raw data into a ModelInstance
     * @returns {ModelInstance}
     * @private
     */
    _new: function (data, shouldRegisterChange) {
        shouldRegisterChange = shouldRegisterChange === undefined ? true : shouldRegisterChange;
        if (this.installed) {
            var self = this;
            var _id;
            if (data) {
                _id = data._id ? data._id : guid();
            } else {
                _id = guid();
            }
            var newModel = new SiestaModel(this);
            if (Logger.info.isEnabled)
                Logger.info('New object created _id="' + _id.toString() + '", type=' + this.type, data);
            newModel._id = _id;
            // Place attributes on the object.
            var values = {};
            newModel.__values = values;
            var defaults = _.reduce(this.attributes, function (m, a) {
                if (a.default) {
                    m[a.name] = a.default;
                }
                return m;
            }, {});
            _.extend(values, defaults);
            if (data) _.extend(values, data);
            var fields = this._attributeNames;
            var idx = fields.indexOf(this.id);
            if (idx > -1) {
                fields.splice(idx, 1);
            }
            _.each(fields, function (field) {
                Object.defineProperty(newModel, field, {
                    get: function () {
                        var value = newModel.__values[field];
                        return value === undefined ? null : value;
                    },
                    set: function (v) {
                        var old = newModel.__values[field];
                        newModel.__values[field] = v;
                        coreChanges.registerChange({
                            collection: self.collection,
                            model: self.type,
                            _id: newModel._id,
                            new: v,
                            old: old,
                            type: ChangeType.Set,
                            field: field,
                            obj: newModel
                        });
                        if (util.isArray(v)) {
                            wrapArray(v, field, newModel);
                        }
                    },
                    enumerable: true,
                    configurable: true
                });
            });

            _.each(Object.keys(this.methods), function (methodName) {
                newModel[methodName] = this.methods[methodName].bind(newModel);
            }.bind(this));

            Object.defineProperty(newModel, this.id, {
                get: function () {
                    return newModel.__values[self.id] || null;
                },
                set: function (v) {
                    var old = newModel[self.id];
                    newModel.__values[self.id] = v;
                    coreChanges.registerChange({
                        collection: self.collection,
                        model: self.type,
                        _id: newModel._id,
                        new: v,
                        old: old,
                        type: ChangeType.Set,
                        field: self.id,
                        obj: newModel
                    });
                    cache.remoteInsert(newModel, v, old);
                },
                enumerable: true,
                configurable: true
            });
            for (var name in this.relationships) {
                var proxy;
                if (this.relationships.hasOwnProperty(name)) {
                    var relationship = this.relationships[name];
                    if (relationship.type == RelationshipType.OneToMany) {
                        proxy = new OneToManyProxy(relationship);
                    } else if (relationship.type == RelationshipType.OneToOne) {
                        proxy = new OneToOneProxy(relationship);
                    } else if (relationship.type == RelationshipType.ManyToMany) {
                        proxy = new ManyToManyProxy(relationship);
                    } else {
                        throw new InternalSiestaError('No such relationship type: ' + relationship.type);
                    }
                }
                proxy.install(newModel);
                proxy.isFault = false;
            }
            cache.insert(newModel);
            if (shouldRegisterChange) {
                coreChanges.registerChange({
                    collection: this.collection,
                    model: this.type,
                    _id: newModel._id,
                    newId: newModel._id,
                    new: newModel,
                    type: ChangeType.New,
                    obj: newModel
                });
            }
            return newModel;
        } else {
            throw new InternalSiestaError('Model must be fully installed before creating any models');
        }

    },
    _dump: function (asJSON) {
        var dumped = {};
        dumped.name = this.type;
        dumped.attributes = this.attributes;
        dumped.id = this.id;
        dumped.collection = this.collection;
        dumped.relationships = _.map(this.relationships, function (r) {
            return r.isForward ? r.forwardName : r.reverseName;
        });
        return asJSON ? JSON.stringify(dumped, null, 4) : dumped;
    },
    toString: function () {
        return 'Model[' + this.type + ']';
    }

});

_.extend(Model.prototype, {
    listen: function (fn) {
        notificationCentre.on(this.collection + ':' + this.type, fn);
        return function () {
            this.removeListener(fn);
        }.bind(this);
    },
    listenOnce: function (fn) {
        return notificationCentre.once(this.collection + ':' + this.type, fn);
    },
    removeListener: function (fn) {
        return notificationCentre.removeListener(this.collection + ':' + this.type, fn);
    }
});

// Subclassing
_.extend(Model.prototype, {
    child: function (nameOrOpts, opts) {
        if (typeof nameOrOpts == 'string') {
            opts.name = nameOrOpts;
        } else {
            opts = name;
        }
        opts.attributes
            = Array.prototype.concat.call(opts.attributes || [], this._opts.attributes);
        opts.relationships = _.extend(opts.relationships || {}, this._opts.relationships);
        var collection = CollectionRegistry[this.collection];
        var model = collection.model(opts.name, opts);
        model.parent = this;
        this.children.push(model);
        return model;
    },
    isChildOf: function (parent) {
        return this.parent == parent;
    },
    isParentOf: function (child) {
        return this.children.indexOf(child) > -1;
    },
    isDescendantOf: function (ancestor) {
        var parent = this.parent;
        while (parent) {
            if (parent == ancestor) return true;
            parent = parent.parent;
        }
        return false;
    },
    isAncestorOf: function (descendant) {
        return this.descendants.indexOf(descendant) > -1;
    },
    hasAttributeNamed: function (attributeName) {
        return this._attributeNames.indexOf(attributeName) > -1;
    }
});

_.extend(Model.prototype, {
    paginator: function (opts) {
        if (siesta.ext.httpEnabled) {
            var Paginator = siesta.ext.http.Paginator;
            opts = opts || {};
            if (!opts.paginator) opts.paginator = {};
            opts.paginator.model = this;
            return new Paginator(opts);
        }
    }
});

exports.Model = Model;
