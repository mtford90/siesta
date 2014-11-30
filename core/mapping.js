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
    , SiestaModel = require('./siestaModel').SiestaModel
    , util = require('./util')
    , defineSubProperty = util.defineSubProperty
    , cache = require('./cache')
    , store = require('./store')
    , extend = require('extend')
    , coreChanges = require('./changes')
    , wrapArray = require('./notificationCentre').wrapArray
    , OneToManyProxy = require('./oneToManyProxy')
    , OneToOneProxy = require('./oneToOneProxy')
    , ManyToManyProxy = require('./manyToManyProxy')
    , _ = util._
    , RelationshipType = relationship.RelationshipType
    , guid = util.guid
    , ChangeType = coreChanges.ChangeType
    ;

var Logger = log.loggerWithName('Mapping');
Logger.setLevel(log.Level.warn);

/**
 *
 * @param {Object} opts
 */
function Mapping(opts) {
    var self = this;
    this._opts = opts;

    Object.defineProperty(this, '_fields', {
        get: function () {
            var fields = [];
            if (self.id) {
                fields.push(self.id);
            }
            if (self._opts.attributes) {
                _.each(self._opts.attributes, function (x) {
                    fields.push(x)
                });
            }
            return fields;
        },
        enumerable: true,
        configurable: true
    });

    /**
     * @name type
     * @type {String}
     */
    defineSubProperty.call(this, 'type', self._opts);

    /**
     * @name id
     * @type {String}
     */
    Object.defineProperty(this, 'id', {
        get: function () {
            return self._opts['id'] || 'id';
        },
        set: function (v) {
            self._opts['id'] = v;
        },
        enumerable: true
    });

    defineSubProperty.call(this, 'collection', self._opts);
    defineSubProperty.call(this, 'attributes', self._opts);
    defineSubProperty.call(this, 'relationships', self._opts);
    defineSubProperty.call(this, 'indexes', self._opts);
    defineSubProperty.call(this, 'subclass', self._opts);
    defineSubProperty.call(this, 'singleton', self._opts);

    if (!this.relationships) {
        this.relationships = [];
    }

    if (!this.indexes) {
        this.indexes = [];
    }

    this._validateSubclass();

    this._installed = false;
    this._relationshipsInstalled = false;
    this._reverseRelationshipsInstalled = false;

    Object.defineProperty(this, 'installed', {
        get: function () {
            return self._installed && self._relationshipsInstalled && self._reverseRelationshipsInstalled;
        },
        enumerable: true,
        configurable: true
    });

}

_.extend(Mapping.prototype, {
    /**
     * Ensure that any subclasses passed to the mapping are valid and working correctly.
     * @private
     */
    _validateSubclass: function () {
        if (this.subclass && this.subclass !== SiestaModel) {
            var obj = new this.subclass(this);
            if (!obj.mapping) {
                throw new InternalSiestaError('Subclass for mapping "' + this.type + '" has not been configured correctly. ' +
                'Did you call super?');
            }
            if (this.subclass.prototype == SiestaModel.prototype) {
                throw new InternalSiestaError('Subclass for mapping "' + this.type + '" has not been configured correctly. ' +
                'You should use Object.create on SiestaModel prototype.');
            }
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
                    if (Logger.debug.isEnabled)
                        Logger.debug(self.type + ': configuring relationship ' + name);
                    if (self._opts.relationships.hasOwnProperty(name)) {
                        var relationship = self._opts.relationships[name];
                        if (relationship.type == RelationshipType.OneToMany ||
                            relationship.type == RelationshipType.OneToOne ||
                            relationship.type == RelationshipType.ManyToMany) {
                            var mappingName = relationship.mapping;
                            if (Logger.debug.isEnabled)
                                Logger.debug('reverseMappingName', mappingName);
                            if (!self.collection) throw new InternalSiestaError('Mapping must have collection');
                            var collection = CollectionRegistry[self.collection];
                            if (!collection) {
                                throw new InternalSiestaError('Collection ' + self.collection + ' not registered');
                            }
                            var reverseMapping = collection[mappingName];
                            if (!reverseMapping) {
                                var arr = mappingName.split('.');
                                if (arr.length == 2) {
                                    var collectionName = arr[0];
                                    mappingName = arr[1];
                                    var otherCollection = CollectionRegistry[collectionName];
                                    if (!otherCollection) {
                                        return 'Collection with name "' + collectionName + '" does not exist.';
                                    }
                                    reverseMapping = otherCollection[mappingName];
                                }
                            }
                            if (Logger.debug.isEnabled)
                                Logger.debug('reverseMapping', reverseMapping);
                            if (reverseMapping) {
                                relationship.reverseMapping = reverseMapping;
                                relationship.forwardMapping = this;
                                relationship.forwardName = name;
                                relationship.reverseName = relationship.reverse;
                                relationship.isReverse = false;
                            } else {
                                return 'Mapping with name "' + mappingName.toString() + '" does not exist';
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
                    var reverseMapping = relationship.reverseMapping;
                    var reverseName = relationship.reverseName;
                    if (Logger.debug.isEnabled)
                        Logger.debug(self.type + ': configuring  reverse relationship ' + name);
                    reverseMapping.relationships[reverseName] = relationship;
                }
            }
            this._reverseRelationshipsInstalled = true;
        } else {
            throw new InternalSiestaError('Reverse relationships for "' + this.type + '" have already been installed.');
        }
    },
    query: function (query, callback) {
        var deferred = window.q ? window.q.defer() : null;
        callback = util.constructCallbackAndPromiseHandler(callback, deferred);
        var _query = new Query(this, query);
        _query.execute(callback);
        return deferred ? deferred.promise : null;
    },
    get: function (idOrCallback, callback) {
        var deferred = window.q ? window.q.defer() : null;
        callback = util.constructCallbackAndPromiseHandler(callback, deferred);

        function finish(err, res) {
            if (callback) callback(err, res);
        }

        if (this.singleton) {
            if (typeof idOrCallback == 'function') {
                callback = idOrCallback;
            }
            this.all(function (err, objs) {
                if (err) finish(err);
                if (objs.length > 1) {
                    throw new InternalSiestaError('Somehow more than one object has been created for a singleton mapping! ' +
                    'This is a serious error, please file a bug report.');
                } else if (objs.length) {
                    finish(null, objs[0]);
                } else {
                    finish(null, objs[0]);
                }
            });
        } else {
            var opts = {};
            opts[this.id] = idOrCallback;
            opts.mapping = this;
            var obj = cache.get(opts);
            if (obj) {
                finish(null, obj);
            } else {
                delete opts.mapping;
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
                    finish(err, obj);
                });
            }

        }
        return deferred ? deferred.promise : null;
    },
    all: function (callback) {
        var deferred = window.q ? window.q.defer() : null;
        callback = util.constructCallbackAndPromiseHandler(callback, deferred);
        var query = new Query(this, {});
        query.execute(callback);
        return deferred ? deferred.promise : null;
    },
    install: function (callback) {
        if (Logger.info.isEnabled) Logger.info('Installing mapping ' + this.type);
        var deferred = window.q ? window.q.defer() : null;
        callback = util.constructCallbackAndPromiseHandler(callback, deferred);
        if (!this._installed) {
            var errors = this._validate();
            this._installed = true;
            if (Logger.info.isEnabled) {
                if (errors.length) Logger.error('Errors installing mapping ' + this.type + ': ' + errors);
                else Logger.info('Installed mapping ' + this.type);
            }
            if (callback) callback(errors.length ? errors : null);
        } else {
            throw new InternalSiestaError('Mapping "' + this.type + '" has already been installed');
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
     * @param callback Called once pouch persistence returns.
     * @param override Force mapping to this object
     */
    map: function (data, callback, override) {
        var deferred = window.q ? window.q.defer() : null;
        callback = util.constructCallbackAndPromiseHandler(callback, deferred);
        if (this.installed) {
            if (util.isArray(data)) {
                this._mapBulk(data, callback, override);
            } else {
                this._mapBulk([data], function (err, objects) {
                    if (callback) {
                        var obj;
                        if (objects) {
                            if (objects.length) {
                                obj = objects[0];
                            }
                        }
                        callback(err ? err[0] : null, obj);
                    }
                }, override ? [override] : undefined);
            }
        } else {
            throw new InternalSiestaError('Mapping must be fully installed before creating any models');
        }
        return deferred ? deferred.promise : null;
    },
    _mapBulk: function (data, callback, override) {
        var deferred = window.q ? window.q.defer() : null;
        callback = util.constructCallbackAndPromiseHandler(callback, deferred);
        var opts = {
            mapping: this,
            data: data
        };
        if (override) opts.objects = override;
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
        return deferred ? deferred.promise : null;
    },
    _countCache: function () {
        var collCache = cache._localCacheByType[this.collection] || {};
        var mappingCache = collCache[this.type] || {};
        return _.reduce(Object.keys(mappingCache), function (m, _id) {
            m[_id] = {};
            return m;
        }, {});
    },
    count: function (callback) {
        var deferred = window.q ? window.q.defer() : null;
        callback = util.constructCallbackAndPromiseHandler(callback, deferred);
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
     * Convert raw data into a SiestaModel
     * @returns {SiestaModel}
     * @private
     */
    _new: function (data) {
        if (this.installed) {
            var self = this;
            var _id;
            if (data) {
                _id = data._id ? data._id : guid();
            } else {
                _id = guid();
            }
            var newModel;
            if (this.subclass) {
                newModel = new this.subclass(this);
            } else {
                newModel = new SiestaModel(this);
            }
            if (Logger.info.isEnabled)
                Logger.info('New object created _id="' + _id.toString() + '", type=' + this.type, data);
            newModel._id = _id;
            // Place attributes on the object.
            newModel.__values = data || {};
            var fields = this._fields;
            var idx = fields.indexOf(this.id);
            if (idx > -1) {
                fields.splice(idx, 1);
            }
            _.each(fields, function (field) {
                Object.defineProperty(newModel, field, {
                    get: function () {
                        return newModel.__values[field] || null;
                    },
                    set: function (v) {
                        var old = newModel.__values[field];
                        newModel.__values[field] = v;
                        coreChanges.registerChange({
                            collection: self.collection,
                            mapping: self.type,
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

            Object.defineProperty(newModel, this.id, {
                get: function () {
                    return newModel.__values[self.id] || null;
                },
                set: function (v) {
                    var old = newModel[self.id];
                    newModel.__values[self.id] = v;
                    coreChanges.registerChange({
                        collection: self.collection,
                        mapping: self.type,
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
            coreChanges.registerChange({
                collection: this.collection,
                mapping: this.type,
                _id: newModel._id,
                newId: newModel._id,
                new: newModel,
                type: ChangeType.New,
                obj: newModel
            });
            return newModel;
        } else {
            util.printStackTrace();
            throw new InternalSiestaError('Mapping must be fully installed before creating any models');
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
        return 'Mapping[' + this.type + ']';
    }
});

exports.Mapping = Mapping;
