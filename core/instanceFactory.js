(function () {
    var log = require('./log')('Model'),
        InternalSiestaError = require('./error').InternalSiestaError,
        RelationshipType = require('./RelationshipType'),
        Query = require('./Query'),
        ModelInstance = require('./ModelInstance'),
        util = require('./util'),
        _ = util._,
        guid = util.guid,
        cache = require('./cache'),
        store = require('./store'),
        extend = require('extend'),
        modelEvents = require('./modelEvents'),
        wrapArray = require('./events').wrapArray,
        OneToManyProxy = require('./OneToManyProxy'),
        OneToOneProxy = require('./OneToOneProxy'),
        ManyToManyProxy = require('./ManyToManyProxy'),
        ReactiveQuery = require('./ReactiveQuery'),
        ArrangedReactiveQuery = require('./ArrangedReactiveQuery'),
        ModelEventType = modelEvents.ModelEventType;

    function ModelInstanceFactory(model) {
        this.model = model;
    }

    ModelInstanceFactory.prototype = {
        _getLocalId: function (data) {
            var _id;
            if (data) {
                _id = data._id ? data._id : guid();
            } else {
                _id = guid();
            }
            return _id;
        },
        /**
         * Configure attributes
         * @param modelInstance
         * @param data
         * @private
         */

        _installAttributes: function (modelInstance, data) {
            var Model = this.model,
                attributeNames = Model._attributeNames,
                idx = attributeNames.indexOf(Model.id);
            _.extend(modelInstance, {
                __values: _.extend(_.reduce(Model.attributes, function (m, a) {
                    if (a.default !== undefined) m[a.name] = a.default;
                    return m;
                }, {}), data || {})
            });
            if (idx > -1) attributeNames.splice(idx, 1);
            _.each(attributeNames, function (attributeName) {
                Object.defineProperty(modelInstance, attributeName, {
                    get: function () {
                        var value = modelInstance.__values[attributeName];
                        return value === undefined ? null : value;
                    },
                    set: function (v) {
                        var old = modelInstance.__values[attributeName];
                        var propertyDependencies = this._propertyDependencies[attributeName];
                            propertyDependencies = _.map(propertyDependencies, function (dependant) {
                                return {
                                    prop: dependant,
                                    old: this[dependant]
                                }
                            }.bind(this));

                        modelInstance.__values[attributeName] = v;
                        propertyDependencies.forEach(function (dep) {
                            var propertyName = dep.prop;
                            var new_ = this[propertyName];
                            modelEvents.emit({
                                collection: Model.collectionName,
                                model: Model.name,
                                _id: modelInstance._id,
                                new: new_,
                                old: dep.old,
                                type: ModelEventType.Set,
                                field: propertyName,
                                obj: modelInstance
                            });
                        }.bind(this));
                        var e = {
                            collection: Model.collectionName,
                            model: Model.name,
                            _id: modelInstance._id,
                            new: v,
                            old: old,
                            type: ModelEventType.Set,
                            field: attributeName,
                            obj: modelInstance
                        };
                        window.lastEmission = e;
                        modelEvents.emit(e);
                        if (util.isArray(v)) {
                            wrapArray(v, attributeName, modelInstance);
                        }
                    },
                    enumerable: true,
                    configurable: true
                });
            });
        },
        _installMethods: function (modelInstance) {
            var Model = this.model;
            _.each(Object.keys(Model.methods), function (methodName) {
                if (modelInstance[methodName] === undefined) {
                    modelInstance[methodName] = Model.methods[methodName].bind(modelInstance);
                }
                else {
                    log('A method with name "' + methodName + '" already exists. Ignoring it.');
                }
            }.bind(this));
        },
        _installProperties: function (modelInstance) {
            var _propertyNames = Object.keys(this.model.properties),
                _propertyDependencies = {};
            _.each(_propertyNames, function (propName) {
                var propDef = this.model.properties[propName];
                var dependencies = propDef.dependencies || [];
                dependencies.forEach(function (attr) {
                    if (!_propertyDependencies[attr]) _propertyDependencies[attr] = [];
                    _propertyDependencies[attr].push(propName);
                });
                delete propDef.dependencies;
                if (modelInstance[propName] === undefined) {
                    Object.defineProperty(modelInstance, propName, propDef);
                }
                else {
                    log('A property/method with name "' + propName + '" already exists. Ignoring it.');
                }
            }.bind(this));

            modelInstance._propertyDependencies = _propertyDependencies;
        },
        _installRemoteId: function (modelInstance) {
            var Model = this.model;
            Object.defineProperty(modelInstance, this.model.id, {
                get: function () {
                    return modelInstance.__values[Model.id] || null;
                },
                set: function (v) {
                    var old = modelInstance[Model.id];
                    modelInstance.__values[Model.id] = v;
                    modelEvents.emit({
                        collection: Model.collectionName,
                        model: Model.name,
                        _id: modelInstance._id,
                        new: v,
                        old: old,
                        type: ModelEventType.Set,
                        field: Model.id,
                        obj: modelInstance
                    });
                    cache.remoteInsert(modelInstance, v, old);
                },
                enumerable: true,
                configurable: true
            });
        },
        _installRelationships: function (modelInstance) {
            var model = this.model;
            for (var name in model.relationships) {
                var proxy;
                if (model.relationships.hasOwnProperty(name)) {
                    var relationshipOpts = _.extend({}, model.relationships[name]),
                        type = relationshipOpts.type;
                    delete relationshipOpts.type;
                    if (type == RelationshipType.OneToMany) {
                        proxy = new OneToManyProxy(relationshipOpts);
                    } else if (type == RelationshipType.OneToOne) {
                        proxy = new OneToOneProxy(relationshipOpts);
                    } else if (type == RelationshipType.ManyToMany) {
                        proxy = new ManyToManyProxy(relationshipOpts);
                    } else {
                        throw new InternalSiestaError('No such relationship type: ' + type);
                    }
                }
                proxy.install(modelInstance);
            }
        },
        _registerInstance: function (modelInstance, shouldRegisterChange) {
            cache.insert(modelInstance);
            shouldRegisterChange = shouldRegisterChange === undefined ? true : shouldRegisterChange;
            if (shouldRegisterChange) {
                modelEvents.emit({
                    collection: this.model.collectionName,
                    model: this.model.name,
                    _id: modelInstance._id,
                    new: modelInstance,
                    type: ModelEventType.New,
                    obj: modelInstance
                });
            }
        },
        _installLocalId: function (modelInstance, data) {
            modelInstance._id = this._getLocalId(data);
        },
        /**
         * Convert raw data into a ModelInstance
         * @returns {ModelInstance}
         */
        _instance: function (data, shouldRegisterChange) {
            if (this.model.installed) {
                var modelInstance = new ModelInstance(this.model);
                this._installLocalId(modelInstance, data);
                this._installAttributes(modelInstance, data);
                this._installMethods(modelInstance);
                this._installProperties(modelInstance);
                this._installRemoteId(modelInstance);
                this._installRelationships(modelInstance);
                this._registerInstance(modelInstance, shouldRegisterChange);
                return modelInstance;
            } else {
                throw new InternalSiestaError('Model must be fully installed before creating any models');
            }
        }
    };

    module.exports = function (model) {
        var factory = new ModelInstanceFactory(model);
        return factory._instance.bind(factory);
    }
})();