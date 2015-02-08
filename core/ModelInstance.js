(function () {
    var log = require('./log'),
        util = require('./util'),
        _ = util._,
        error = require('./error'),
        InternalSiestaError = error.InternalSiestaError,
        modelEvents = require('./modelEvents'),
        events = require('./events'),
        cache = require('./cache');

    function ModelInstance(model) {
        var self = this;
        this.model = model;

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
                get: function () {
                    var proxies = _.map(Object.keys(self.__proxies || {}), function (x) {
                        return self.__proxies[x]
                    });
                    return _.map(proxies, function (p) {
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
                get: function () {
                    if (siesta.ext.storageEnabled) {
                        return self._id in siesta.ext.storage._unsavedObjectsHash;
                    }
                    else return undefined;
                },
                enumerable: true
            },
            // This is for ProxyEventEmitter.
            event: {
                get: function () {
                    return this._id
                }
            }
        });

        this.removed = false;
    }

    ModelInstance.prototype = Object.create(events.ProxyEventEmitter.prototype);

    _.extend(ModelInstance.prototype, {
        get: function (cb) {
            return util.promise(cb, function (cb) {
                cb(null, this);
            }.bind(this));
        },
        emit: function (type, opts) {
            if (typeof type == 'object') opts = type;
            else opts.type = type;
            opts = opts || {};
            _.extend(opts, {
                collection: this.collectionName,
                model: this.model.name,
                _id: this._id,
                obj: this
            });
            modelEvents.emit(opts);
        },
        remove: function (cb, notification) {
            notification = notification == null ? true : notification;
            return util.promise(cb, function (cb) {
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
                        remove.call(this, function (err) {
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
        restore: function (cb) {
            return util.promise(cb, function (cb) {
                var _finish = function (err) {
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
    _.extend(ModelInstance.prototype, {
        getAttributes: function () {
            return _.extend({}, this.__values);
        },
        isInstanceOf: function (model) {
            return this.model == model;
        },
        isA: function (model) {
            return this.model == model || this.model.isDescendantOf(model);
        }
    });

    // Dump
    _.extend(ModelInstance.prototype, {
        _dumpString: function (reverseRelationships) {
            return JSON.stringify(this._dump(reverseRelationships, null, 4));
        },
        _dump: function (reverseRelationships) {
            var dumped = _.extend({}, this.__values);
            dumped._rev = this._rev;
            dumped._id = this._id;
            return dumped;
        }
    });

    module.exports = ModelInstance;


})();