(function () {

    var log = require('./log')('Model'),
        CollectionRegistry = require('./collectionRegistry').CollectionRegistry,
        InternalSiestaError = require('./error').InternalSiestaError,
        RelationshipType = require('./RelationshipType'),
        Query = require('./Query'),
        MappingOperation = require('./mappingOperation'),
        ModelInstance = require('./ModelInstance'),
        util = require('./util'),
        cache = require('./cache'),
        store = require('./store'),
        error = require('./error'),
        extend = require('extend'),
        modelEvents = require('./modelEvents'),
        events = require('./events'),
        OneToOneProxy = require('./OneToOneProxy'),
        ManyToManyProxy = require('./ManyToManyProxy'),
        ReactiveQuery = require('./ReactiveQuery'),
        instanceFactory = require('./instanceFactory'),
        ArrangedReactiveQuery = require('./ArrangedReactiveQuery'),
        _ = util._;

    /**
     *
     * @param {Object} opts
     */
    function Model(opts) {
        var self = this;
        this._opts = opts ? _.extend({}, opts) : {};

        util.extendFromOpts(this, opts, {
            methods: {},
            attributes: [],
            collection: function (c) {
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
            remove: null
        });

        this.attributes = Model._processAttributes(this.attributes);

        this._instance = new instanceFactory(this);

        _.extend(this, {
            _installed: false,
            _relationshipsInstalled: false,
            _reverseRelationshipsInstalled: false,
            children: []
        });

        Object.defineProperties(this, {
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
                            hash = (unsavedObjectsByCollection[this.collectionName] || {})[this.name] || {};
                        return !!Object.keys(hash).length;
                    }
                    else return undefined;
                },
                enumerable: true
            },
            collectionName: {
                get: function () {
                    return this.collection.name;
                },
                enumerable: true
            }
        });
        events.ProxyEventEmitter.call(this, this.collectionName + ':' + this.name);
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

    Model.prototype = Object.create(events.ProxyEventEmitter.prototype);

    _.extend(Model.prototype, {
        installStatics: function (statics) {
            if (statics) {
                _.each(Object.keys(statics), function (staticName) {
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
        _validateRelationshipType: function (relationship) {
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

        /**
         * Install relationships. Returns error in form of string if fails.
         * @return {String|null}
         */
        installRelationships: function () {
            if (!this._relationshipsInstalled) {
                var self = this,
                    err = null;
                self._relationships = [];
                if (self._opts.relationships) {
                    for (var name in self._opts.relationships) {
                        if (self._opts.relationships.hasOwnProperty(name)) {
                            var relationship = self._opts.relationships[name];
                            // If a reverse relationship is installed beforehand, we do not want to process them.
                            if (!relationship.isReverse) {
                                log(this.name + ': configuring relationship ' + name, relationship);
                                if (!(err = this._validateRelationshipType(relationship))) {
                                    var modelName = relationship.model;
                                    delete relationship.model;
                                    var reverseModel;
                                    if (modelName instanceof Model) {
                                        reverseModel = modelName;
                                    }
                                    else {
                                        log('reverseModelName', modelName);
                                        if (!self.collection) throw new InternalSiestaError('Model must have collection');
                                        var collection = self.collection;
                                        if (!collection)    throw new InternalSiestaError('Collection ' + self.collectionName + ' not registered');
                                        reverseModel = collection[modelName];
                                    }
                                    if (!reverseModel) {
                                        var arr = modelName.split('.');
                                        if (arr.length == 2) {
                                            var collectionName = arr[0];
                                            modelName = arr[1];
                                            var otherCollection = CollectionRegistry[collectionName];
                                            if (!otherCollection) return 'Collection with name "' + collectionName + '" does not exist.';
                                            reverseModel = otherCollection[modelName];
                                        }
                                    }
                                    log('reverseModel', reverseModel);
                                    if (reverseModel) {
                                        _.extend(relationship, {
                                            reverseModel: reverseModel,
                                            forwardModel: this,
                                            forwardName: name,
                                            reverseName: relationship.reverse || 'reverse_' + name,
                                            isReverse: false
                                        });
                                        delete relationship.reverse;
                                    } else return 'Model with name "' + modelName.toString() + '" does not exist';
                                }
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
        installReverseRelationships: function () {
            if (!this._reverseRelationshipsInstalled) {
                for (var forwardName in this.relationships) {
                    if (this.relationships.hasOwnProperty(forwardName)) {
                        var relationship = this.relationships[forwardName];
                        relationship = extend(true, {}, relationship);
                        relationship.isReverse = true;
                        var reverseModel = relationship.reverseModel,
                            reverseName = relationship.reverseName;
                        if (reverseModel.singleton) {
                            if (relationship.type == RelationshipType.ManyToMany) return 'Singleton model cannot be related via reverse ManyToMany';
                            if (relationship.type == RelationshipType.OneToMany) return 'Singleton model cannot be related via reverse OneToMany';
                        }
                        log(this.name + ': configuring  reverse relationship ' + reverseName);
                        reverseModel.relationships[reverseName] = relationship;
                    }
                }
                this._reverseRelationshipsInstalled = true;
            } else {
                throw new InternalSiestaError('Reverse relationships for "' + this.name + '" have already been installed.');
            }
        },
        _query: function (query) {
            return new Query(this, query || {});
        },
        query: function (query, cb) {
            return util.promise(cb, function (cb) {
                if (!this.singleton) return (this._query(query)).execute(cb);
                else {
                    (this._query({__ignoreInstalled: true})).execute(function (err, objs) {
                        if (err) cb(err);
                        else {
                            // Cache a new singleton and then reexecute the query
                            query = _.extend({}, query);
                            query.__ignoreInstalled = true;
                            if (!objs.length) {
                                this.graph({}, function (err) {
                                    if (!err) {
                                        (this._query(query)).execute(cb);
                                    }
                                    else {
                                        cb(err);
                                    }
                                }.bind(this));
                            }
                            else {
                                (this._query(query)).execute(cb);
                            }
                        }
                    }.bind(this));
                }
            }.bind(this));

        },
        reactiveQuery: function (query) {
            return new ReactiveQuery(new Query(this, query || {}));
        },
        arrangedReactiveQuery: function (query) {
            return new ArrangedReactiveQuery(new Query(this, query || {}));
        },
        one: function (opts, cb) {
            if (typeof opts == 'function') {
                cb = opts;
                opts = {};
            }
            return util.promise(cb, function (cb) {
                this.query(opts, function (err, res) {
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
        all: function (q, cb) {
            if (typeof q == 'function') {
                cb = q;
                q = {};
            }
            q = q || {};
            var query = {};
            if (q.__order) query.__order = q.__order;
            return this.query(q, cb);
        },
        install: function (cb) {
            log('Installing mapping ' + this.name);
            return util.promise(cb, function (cb) {
                if (!this._installed) {
                    this._installed = true;
                    cb();
                } else {
                    throw new InternalSiestaError('Model "' + this.name + '" has already been installed');
                }
            }.bind(this));
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
        graph: function (data, opts, cb) {
            if (typeof opts == 'function') cb = opts;
            opts = opts || {};
            return util.promise(cb, function (cb) {
                var _map = function () {
                    var overrides = opts.override;
                    if (overrides) {
                        if (util.isArray(overrides)) opts.objects = overrides;
                        else opts.objects = [overrides];
                    }
                    delete opts.override;
                    if (util.isArray(data)) {
                        this._mapBulk(data, opts, cb);
                    } else {
                        this._mapBulk([data], opts, function (err, objects) {
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
        _mapBulk: function (data, opts, callback) {
            _.extend(opts, {model: this, data: data});
            var op = new MappingOperation(opts);
            op.start(function (err, objects) {
                if (err) {
                    if (callback) callback(err);
                } else {
                    callback(null, objects || []);
                }
            });
        },
        _countCache: function () {
            var collCache = cache._localCacheByType[this.collectionName] || {};
            var modelCache = collCache[this.name] || {};
            return _.reduce(Object.keys(modelCache), function (m, _id) {
                m[_id] = {};
                return m;
            }, {});
        },
        count: function (cb) {
            return util.promise(cb, function (cb) {
                cb(null, Object.keys(this._countCache()).length);
            }.bind(this));
        },
        _dump: function (asJSON) {
            var dumped = {};
            dumped.name = this.name;
            dumped.attributes = this.attributes;
            dumped.id = this.id;
            dumped.collection = this.collectionName;
            dumped.relationships = _.map(this.relationships, function (r) {
                return r.isForward ? r.forwardName : r.reverseName;
            });
            return asJSON ? util.prettyPrint(dumped) : dumped;
        },
        toString: function () {
            return 'Model[' + this.name + ']';
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
            _.extend(opts, {
                attributes: Array.prototype.concat.call(opts.attributes || [], this._opts.attributes),
                relationships: _.extend(opts.relationships || {}, this._opts.relationships),
                methods: _.extend(_.extend({}, this._opts.methods) || {}, opts.methods),
                statics: _.extend(_.extend({}, this._opts.statics) || {}, opts.statics),
                properties: _.extend(_.extend({}, this._opts.properties) || {}, opts.properties),
                id: opts.id || this._opts.id,
                init: opts.init || this._opts.init,
                remove: opts.remove || this._opts.remove
            });
            var model = this.collection.model(opts.name, opts);
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

    module.exports = Model;

})();
