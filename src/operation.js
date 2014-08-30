angular.module('restkit.mapping.operation', ['logging'])

    .factory('CompositeOperation', function (BaseOperation, jlog) {

        var $log = jlog.loggerWithName('CompositeOperation');

        function CompositeOperation(name, operations, completionCallback) {
            if (!this) return new CompositeOperation;
            var self = this;
            this.operations = operations;

            var work = function (done) {
                $log.trace('Starting ' + self._numOperationsRemaining.toString() + ' operations');
                _.each(self.operations, function (op) {
                    if (op.name) {
                        $log.trace('Starting operation with name "' + op.name + '"');
                    }
                    else {
                        $log.trace('Starting unnamed operation');
                    }
                    op.completionCallback = function () {
                        if (op.name) {
                            $log.trace('Finished operation with name "' + op.name + '"');
                        }
                        else {
                            $log.trace('Finished unnamed operation');
                        }
                        var numOperationsRemaining = self._numOperationsRemaining;
                        if (!numOperationsRemaining) {
                            $log.trace('Operations have finished');
                            var errors = _.pluck(self.operations, 'error');
                            var results = _.pluck(self.operations, 'result');
                            done(_.some(errors) ? errors : null, _.some(results) ? results : null);
                        }
                        else {
                            $log.trace('Waiting for ' + numOperationsRemaining.toString() + ' operations to finish');
                        }
                    };
                    op.start();
                });
            };

            Object.defineProperty(this, '_numOperationsRemaining', {
                get: function () {
                    return _.reduce(self.operations, function (memo, op) {
                        if (op.completed) {
                            return memo + 0;
                        }
                        return memo + 1;
                    }, 0);
                },
                enumerable: true,
                configurable: true
            });

            BaseOperation.call(this, name, work, completionCallback);
        }

        CompositeOperation.prototype = Object.create(BaseOperation.prototype);

        CompositeOperation.prototype._dump = function (asJson) {
            var self = this;
            var obj = {
                name: this.name,
                purpose: this.purpose,
                error: this.error,
                completed: this.completed,
                failed: this.failed,
                running: this.running,
                completedOperations: _.reduce(self.operations, function (memo, op) {
                    if (op.completed) {
                        memo.push(op._dump());
                    }
                    return memo;
                }, []),
                uncompletedOperations: _.reduce(self.operations, function (memo, op) {
                    if (!op.completed) {
                        memo.push(op._dump());
                    }
                    return memo;
                }, [])
            };
            return asJson ? JSON.stringify(obj, null, 4) : obj;
        };

        return CompositeOperation;

    })

    .factory('BaseOperation', function (jlog) {

        var $log = jlog.loggerWithName('BaseOperation');

        function BaseOperation(name, work, completionCallback) {
            if (!this) return new BaseOperation(name, work, completionCallback);
            var self = this;
            this.name = name;
            this.work = work;
            this.error = null;
            this.completed = false;
            this.result = null;
            this.running = false;
            this.completionCallback = completionCallback;
            this.purpose = '';
            Object.defineProperty(this, 'failed', {
                get: function () {
                    return !!self.error;
                },
                enumerable: true,
                configurable: true
            });
        }

        BaseOperation.prototype.start = function () {
            if (!this.running && !this.completed) {
                $log.trace('Starting operation with name "' + this.name + '"');
                this.running = true;
                var self = this;
                this.work(function (err, payload) {
                    self.result = payload;
                    self.error = err;
                    self.completed = true;
                    self.running = false;
                    $log.trace('Finished operation with name "' + this.name + '"');
                    if (self.completionCallback) {
                        self.completionCallback.call(this);
                    }
                });
            }
            else {
                $log.warn('Start called twice on operation');
                dump(new Error().stack);
            }
        };

        BaseOperation.prototype._dump = function (asJson) {
            var obj = {
                purpose: this.purpose,
                name: this.name,
                error: this.error,
                completed: this.completed,
                failed: this.failed,
                running: this.running
            };
            return asJson ? JSON.stringify(obj, null, 4) : obj;
        };

        return BaseOperation;
    })


    .factory('MappingOperation', function (jlog, RestObject, Store, cache, BaseOperation) {

        var $log = jlog.loggerWithName('MappingOperation');

        /**
         *
         * @param mapping
         * @param data The data we are want to map onto obj.
         * @param completion Called when this mapping operation completes, failed or otherwise.
         * @constructor
         */
        function MappingOperation(mapping, data, completion) {
            if (!this) {
                return new MappingOperation(mapping, data, completion);
            }
            var self = this;
            this.mapping = mapping;
            this.data = data;
            this._obj = null;
            this._errors = {};
            this.operations = [];
            this._finished = [];

            var work = function (done) {
                this._done = done;
                var data = self.data;
                var remoteIdentifier;
                var idField;
                if (!self._obj) {
                    if (data instanceof RestObject) {
                        self._obj = data;
                        this.checkIfDone();
                    }
                    else {
                        var storeOpts = {};
                        idField = self.mapping.id;
                        if (typeof(data) == 'object') {
                            remoteIdentifier = data[idField];
                        }
                        else {
                            // Here we assume that the data given is a remote identifier.
                            $log.trace('Assuming remote identifier');
                            remoteIdentifier = data;
                            self.data = {};
                            self.data[idField] = data;
                            data = self.data;
                        }
                        if (remoteIdentifier) {
                            $log.debug('Can lookup via remote id');
                            storeOpts[idField] = remoteIdentifier;
                            storeOpts.mapping = self.mapping;
                        }
                        if (data._id) {
                            $log.debug('Can lookup via _id');
                            storeOpts._id = data._id;
                        }
                        if (remoteIdentifier || data._id) {
                            Store.get(storeOpts, function (err, obj) {
                                if (!err) {
                                    if (!obj) {
                                        var newData = {};
                                        if (remoteIdentifier && idField) {
                                            newData[idField] = remoteIdentifier;
                                        }
                                        // Check the cache just in case we've been beaten to it by another mapping operation.
                                        // The Store will go out to Pouch if it's not in the cache, giving other operations the
                                        // chance to get here first and insert a new object into the store.
                                        // TODO: Alternative would be to only allow one Store operation at a time.
                                        var restObject = cache.get(storeOpts);
                                        if (restObject) {
                                            // The race condition occurred. Use the object created by the other mapping operation
                                            // instead.
                                            self._obj = restObject;
                                            self._startMapping();
                                        }
                                        else {
                                            restObject = self.mapping._new(newData);
                                            restObject.save(function (err) {
                                                if (err) {
                                                    self._errors = err;
                                                    self.checkIfDone();
                                                }
                                                else {
                                                    self._obj = restObject;
                                                    self._startMapping();
                                                }
                                            });
                                        }
                                    }
                                    else {
                                        self._obj = obj;
                                        self._startMapping();
                                    }
                                }
                                else {
                                    self._errors = err;
                                    self.checkIfDone();
                                }
                            });
                        }
                        else {
                            var restObject = self.mapping._new();
                            restObject.save(function (err) {
                                if (err) {
                                    self._errors = err;
                                    self.checkIfDone();
                                }
                                else {
                                    self._obj = restObject;
                                    self._startMapping();
                                }
                            });

                        }

                    }
                }
                else {
                    self._startMapping();
                }
            };


            BaseOperation.call(this, 'MappingOperation', work, completion);


        }

        MappingOperation.prototype = Object.create(BaseOperation.prototype);


        /**
         * Check to see if all sub-ops have finished. Call the completion function if finished.
         */
        MappingOperation.prototype.checkIfDone = function () {
            var self = this;
            var isFinished = this.operations.length == this._finished.length;
            if (isFinished) {
                $log.info('Mapping operation finishing', {obj: this.obj ? this._obj._id : null});
                if (this._obj) {
                    this._obj.save(function (err) {
                        if (err) {
                            self._errors.save = err;
                        }
                        var isError = false;
                        for (var prop in self._errors) {
                            if (self._errors.hasOwnProperty(prop)) {
                                isError = true;
                                break;
                            }
                        }
                        self._done(isError ? self._errors : null, self._obj);
                    })
                }
                else {
                    var isError = false;
                    for (var prop in self._errors) {
                        if (self._errors.hasOwnProperty(prop)) {
                            isError = true;
                            break;
                        }
                    }
                    self._done(isError ? self._errors : null, self._obj);
                }
            }
        };

        MappingOperation.prototype._mapArray = function (prop, arr) {
            $log.trace('_mapArray', {prop: prop, arr: arr, op: this});
            var self = this;
            var obj = this._obj;
            if (this._isAttribute(prop)) {
                this._mapAttribute(prop, arr);
            }
            else { // Reverse foreign key or many to many. We need to map all elements in the array.
                var relationship = obj[prop].relationship;
                var isForward = relationship.isForward(obj);
                var reverseMapping;
                if (isForward) {
                    reverseMapping = relationship.reverseMapping;
                }
                else {
                    reverseMapping = relationship.mapping;
                }
                var mappedArr = [];
                var errors = [];
                var numFinished = 0;
                var arrayOperations = [];
                // Need to use an IEFE as i+item are mutable and the operations are completed async.
                for (var i = 0; i < arr.length; i++) {
                    (function (i, item) {
                        var subOperation = new MappingOperation(reverseMapping, item, function () {
                            var err = subOperation.error;
                            if (!err) {
                                mappedArr[i] = subOperation._obj;
                            }
                            else {
                                errors.push(err);
                            }
                            numFinished++;
                            if (numFinished == arr.length) {
                                if (!errors.length) {
                                    var proxy = obj[prop];
                                    $log.debug('Setting relationship ' + prop);
                                    proxy.set(mappedArr, function (err) {
                                        if (err) {
                                            $log.debug('Error setting relationship "' + prop + '"', err);
                                            self._errors[prop] = err;
                                            dump(self._errors);
                                        }
                                        else {
                                            $log.debug('Successfully set relationship', prop);
                                            dump(self._errors);
                                        }
                                        self._finished.push(arrayOperations);
                                        self.checkIfDone();
                                    })
                                }
                                else {
                                    self._errors[prop] = errors;
                                    self._finished.push(arrayOperations);
                                    self.checkIfDone();
                                }
                            }
                        });
                        arrayOperations[i] = subOperation;
                        subOperation.start();
                    })(i, arr[i]);
                }
                self.operations.push(arrayOperations);
            }
        };

        MappingOperation.prototype._mapAttribute = function (prop, val) {
            this._obj[prop] = val;
        };

        MappingOperation.prototype._mapRelationship = function (prop, val) {
            var self = this;
            var obj = this._obj;
            var relationship = obj[prop].relationship;
            var isForward = relationship.isForward(obj);
            var reverseMapping;
            if (isForward) {
                reverseMapping = relationship.reverseMapping;
            }
            else {
                reverseMapping = relationship.mapping;
            }
            var subOperation = new MappingOperation(reverseMapping, val, function () {
                var err = subOperation.error;
                if (err) {
                    self._errors[prop] = err;
                    self._finished.push(subOperation);
                    self.checkIfDone();
                }
                else {
                    var related = subOperation._obj;
                    var proxy = self._obj[prop];
                    proxy.set(related, function (err) {
                        if (err) {
                            self._errors[prop] = err;
                        }
                        else {
                        }
                        self._finished.push(subOperation);
                        self.checkIfDone();
                    })
                }
            });
            this.operations.push(subOperation);
            subOperation.start();
        };

        MappingOperation.prototype._isAttribute = function (prop) {
            return this._obj._fields.indexOf(prop) > -1;
        };

        MappingOperation.prototype._isRelationship = function (prop) {
            return this._obj._relationshipFields.indexOf(prop) > -1;
        };

        /**
         * Kick off the mapping.
         * @private
         */
        MappingOperation.prototype._startMapping = function () {
            var data = this.data;
            $log.info('Mapping operation starting', {obj: this._obj._id, data: data});
            for (var prop in data) {
                if (data.hasOwnProperty(prop)) {
                    $log.trace('Checking "' + prop + '"');
                    var val = data[prop];
                    if (Object.prototype.toString.call(val) == '[object Array]') {
                        this._mapArray(prop, val);
                    }
                    else {
                        if (this._isAttribute(prop)) {
                            this._mapAttribute(prop, val);
                        }
                        else if (this._isRelationship(prop)) {
                            this._mapRelationship(prop, val);
                        }
                        else {
                            $log.debug('No such property ' + prop.toString());
                        }
                    }
                }
            }
            // If no relationships etc, no sub-ops will be spawned.
            this.checkIfDone();
        };

        MappingOperation.prototype._dump = function (asJson) {
            var obj = {};
            obj.name = this.name;
            obj.purpose = this.purpose;
            obj.data = this.data;
            obj.obj = this._obj ? this._obj._dump() : null;
            obj.completed = this.completed;
            obj.errors = this._errors;
            obj.mapping = this.mapping.type;
            return asJson ? JSON.stringify(obj, null, 4) : obj;
        };

        return MappingOperation;
    })

;