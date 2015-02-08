(function () {
    var Store = require('./store'),
        SiestaModel = require('./ModelInstance'),
        log = require('./log')('Mapping'),
        cache = require('./cache'),
        util = require('./util'),
        _ = util._,
        async = util.async;

    function SiestaError(opts) {
        this.opts = opts;
    }
    SiestaError.prototype.toString = function () {
        return JSON.stringify(this.opts, null, 4);
    };


    /**
     * Encapsulates the idea of mapping arrays of data onto the object graph or arrays of objects.
     * @param {Object} opts
     * @param opts.model
     * @param opts.data#
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

        _.extend(this, {
            errors: [],
            subTaskResults: {},
            _newObjects: []
        });
    }


    _.extend(MappingOperation.prototype, {
        mapAttributes: function () {
            for (var i = 0; i < this.data.length; i++) {
                var datum = this.data[i];
                var object = this.objects[i];
                // No point mapping object onto itself. This happens if a ModelInstance is passed as a relationship.
                if (datum != object) {
                    if (object) { // If object is falsy, then there was an error looking up that object/creating it.
                        var fields = this.model._attributeNames;
                        _.each(fields, function (f) {
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
        _map: function () {
            var self = this;
            var err;
            this.mapAttributes();
            var relationshipFields = _.keys(self.subTaskResults);
            _.each(relationshipFields, function (f) {
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
         * For indices where no object is present, perform lookups, creating a new object if necessary.
         * @private
         */
        _lookup: function (cb) {
            return util.promise(cb, function (cb) {
                var self = this;
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
                                lookup.datum[self.model.id] = datum;
                                remoteLookups.push(lookup);
                            } else if (datum instanceof SiestaModel) { // We won't need to perform any mapping.
                                this.objects[i] = datum;
                            } else if (datum._id) {
                                localLookups.push({
                                    index: i,
                                    datum: datum
                                });
                            } else if (datum[self.model.id]) {
                                remoteLookups.push({
                                    index: i,
                                    datum: datum
                                });
                            } else {
                                this.objects[i] = self._instance();
                            }
                        } else {
                            this.objects[i] = null;
                        }
                    }
                }
                util.async.parallel([
                        function (done) {
                            var localIdentifiers = _.pluck(_.pluck(localLookups, 'datum'), '_id');
                            if (localIdentifiers.length) {
                                Store.getMultipleLocal(localIdentifiers, function (err, objects) {
                                    if (!err) {
                                        for (var i = 0; i < localIdentifiers.length; i++) {
                                            var obj = objects[i];
                                            var _id = localIdentifiers[i];
                                            var lookup = localLookups[i];
                                            if (!obj) {
                                                // If there are multiple mapping operations going on, there may be
                                                obj = cache.get({_id: _id});
                                                if (!obj)
                                                    obj = self._instance({_id: _id}, !self.disableevents);
                                                self.objects[lookup.index] = obj;
                                            } else {
                                                self.objects[lookup.index] = obj;
                                            }
                                        }
                                    }
                                    done(err);
                                });
                            } else {
                                done();
                            }
                        },
                        function (done) {
                            var remoteIdentifiers = _.pluck(_.pluck(remoteLookups, 'datum'), self.model.id);
                            if (remoteIdentifiers.length) {
                                log('Looking up remoteIdentifiers: ' + util.prettyPrint(remoteIdentifiers));
                                Store.getMultipleRemote(remoteIdentifiers, self.model, function (err, objects) {
                                    if (!err) {
                                        if (log.enabled) {
                                            var results = {};
                                            for (i = 0; i < objects.length; i++) {
                                                results[remoteIdentifiers[i]] = objects[i] ? objects[i]._id : null;
                                            }
                                            log('Results for remoteIdentifiers: ' + util.prettyPrint(results));
                                        }
                                        for (i = 0; i < objects.length; i++) {
                                            var obj = objects[i];
                                            var lookup = remoteLookups[i];
                                            if (obj) {
                                                self.objects[lookup.index] = obj;
                                            } else {
                                                var data = {};
                                                var remoteId = remoteIdentifiers[i];
                                                data[self.model.id] = remoteId;
                                                var cacheQuery = {
                                                    model: self.model
                                                };
                                                cacheQuery[self.model.id] = remoteId;
                                                var cached = cache.get(cacheQuery);
                                                if (cached) {
                                                    self.objects[lookup.index] = cached;
                                                } else {
                                                    self.objects[lookup.index] = self._instance();
                                                    // It's important that we map the remote identifier here to ensure that it ends
                                                    // up in the cache.
                                                    self.objects[lookup.index][self.model.id] = remoteId;
                                                }
                                            }
                                        }
                                    }
                                    done(err);
                                });
                            } else {
                                done();
                            }
                        }
                    ],
                    cb);
            }.bind(this));
        },
        _lookupSingleton: function (cb) {
            return util.promise(cb, function (cb) {
                var self = this;
                // Pick a random _id from the array of data being mapped onto the singleton object. Note that they should
                // always be the same. This is just a precaution.
                var _ids = _.pluck(self.data, '_id'),
                    _id;
                for (i = 0; i < _ids.length; i++) {
                    if (_ids[i]) {
                        _id = {_id: _ids[i]};
                        break;
                    }
                }
                // The mapping operation is responsible for creating singleton instances if they do not already exist.
                var singleton = cache.getSingleton(this.model) || this._instance(_id);
                for (var i = 0; i < self.data.length; i++) {
                    self.objects[i] = singleton;
                }
                cb();
            }.bind(this));
        },
        _instance: function () {
            var model = this.model,
                modelInstance = model._instance.apply(model, arguments);
            this._newObjects.push(modelInstance);
            return modelInstance;
        },
        start: function (done) {
            if (this.data.length) {
                var self = this;
                var tasks = [];
                var lookupFunc = this.model.singleton ? this._lookupSingleton : this._lookup;
                tasks.push(_.bind(lookupFunc, this));
                tasks.push(_.bind(this._executeSubOperations, this));
                util.async.parallel(tasks, function () {
                    try {
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
                        var initTasks = _.reduce(self._newObjects, function (m, o) {
                            var init = o.model.init;
                            if (init) {
                                var paramNames = util.paramNames(init);
                                if (paramNames.length > 1) {
                                    m.push(_.bind(init, o, fromStorage, done));
                                }
                                else {
                                    init.call(o, fromStorage);
                                }
                            }
                            return m;
                        }, []);
                        async.parallel(initTasks, function () {
                            done(self.errors.length ? self.errors : null, self.objects);
                        });
                    }
                    catch (e) {
                        console.error('Uncaught error when executing init funcitons on models.', e);
                        done(e);
                    }
                }.bind(this));
            } else {
                done(null, []);
            }
        },
        getRelatedData: function (name) {
            var indexes = [];
            var relatedData = [];
            for (var i = 0; i < this.data.length; i++) {
                var datum = this.data[i];
                if (datum) {
                    if (datum[name]) {
                        indexes.push(i);
                        relatedData.push(datum[name]);
                    }
                }
            }
            return {
                indexes: indexes,
                relatedData: relatedData
            };
        },
        processErrorsFromTask: function (relationshipName, errors, indexes) {
            if (errors.length) {
                var relatedData = this.getRelatedData(relationshipName).relatedData;
                var unflattenedErrors = util.unflattenArray(errors, relatedData);
                for (var i = 0; i < unflattenedErrors.length; i++) {
                    var idx = indexes[i];
                    var err = unflattenedErrors[i];
                    var isError = err;
                    if (util.isArray(err)) isError = _.reduce(err, function (memo, x) {
                        return memo || x
                    }, false);
                    if (isError) {
                        if (!this.errors[idx]) this.errors[idx] = {};
                        this.errors[idx][relationshipName] = err;
                    }
                }
            }
        },
        _executeSubOperations: function (callback) {
            var self = this,
                relationshipNames = _.keys(this.model.relationships);
            if (relationshipNames.length) {
                var tasks = _.reduce(relationshipNames, function (m, relationshipName) {
                    var relationship = self.model.relationships[relationshipName],
                        reverseModel = relationship.forwardName == relationshipName ? relationship.reverseModel : relationship.forwardModel;
                    // Mock any missing singleton data to ensure that all singleton instances are created.
                    if (reverseModel.singleton && !relationship.isReverse) {
                        this.data.forEach(function (datum) {
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
                        task = function (done) {
                            op.start(function (errors, objects) {
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
                async.parallel(tasks, function (err) {
                    callback(err);
                });
            } else {
                callback();
            }
        }
    });

    module.exports = MappingOperation;



})();