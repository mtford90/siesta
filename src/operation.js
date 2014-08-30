angular.module('restkit.mapping.operation', ['logging'])

    .factory('CompositeOperation', function (BaseOperation, jlog) {

        var $log = jlog.loggerWithName('CompositeOperation');

        function CompositeOperation (name, operations, completionCallback) {
            if (!this) return new CompositeOperation;
            var self = this;
            this.operations = operations;

            var work = function (done) {
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
                        if (self._allOperationsCompleted) {
                            $log.trace('Operations have finished');
                            var errors = _.pluck(self.operations, 'error');
                            var results = _.pluck(self.operations, 'result');
                            done(_.some(errors) ? errors : null, _.some(results) ? results : null);
                        }
                        else {
                            $log.trace('Waiting for operations to finish');
                        }
                    };
                    op.start();
                });
            };

            Object.defineProperty(this, '_allOperationsCompleted', {
                get: function () {
                    var obj = _.pluck(self.operations, 'completed');
                    return _.all(obj);
                },
                enumerable: true,
                configurable: true
            });

            BaseOperation.call(this, name, work, completionCallback);
        }

        CompositeOperation.prototype = Object.create(BaseOperation.prototype);

        return CompositeOperation;

    })

    .factory('BaseOperation', function () {

        function BaseOperation (name, work, completionCallback) {
            if (!this) return new BaseOperation(name, work, completionCallback);
            var self = this;
            this.name = name;
            this.work = work;
            this.error = null;
            this.completed = false;
            this.result = null;
            this.running = false;
            this.completionCallback = completionCallback;
            Object.defineProperty(this, 'failed', {
                get: function () {
                    return !!self.error;
                },
                enumerable: true,
                configurable: true
            });
        }

        BaseOperation.prototype.start = function () {
            this.running = true;
            var self = this;
            this.work(function (err, payload) {
                self.result = payload;
                self.error = err;
                self.completed = true;
                self.running = false;
                if (self.completionCallback) {
                    self.completionCallback.call(this);
                }
            });
        };

        return BaseOperation;
    })

    .factory('Operation', function (jlog) {

        var operationsMonitor = jlog.loggerWithName('Num. Mapping Operations');

        var runningOperations = [];

        function Operation() {
            if (!this) return new Operation();
            Object.defineProperty(this, 'running', {
                get: function () {
                    return runningOperations.indexOf(this) > -1
                },
                enumerable: true,
                configurable: true
            });
        }

        Operation._logNumOperations = function () {
            operationsMonitor.info(this.runningOperations.length.toString());
        };

        Operation.prototype.start = function () {
            runningOperations.push(this);
            Operation._logNumOperations();
        };

        Operation.prototype.finish = function () {
            var idx = runningOperations.indexOf(this);
            runningOperations.splice(idx, 1);
            Operation._logNumOperations();
        };

        Operation.runningOperations = runningOperations;

        Object.defineProperty(Operation, 'operationsAreRunning', {
            get: function () {
                return !!runningOperations.length;
            },
            enumerable: true,
            configurable: true
        });

        return Operation;
    })

    .factory('MappingOperation', function (jlog, RestObject, Store, cache, Operation) {

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

            Operation.call(this);

            var self = this;
            this.mapping = mapping;
            this.data = data;
            this.completion = completion;
            this._obj = null;
            this._errors = {};
            this._operations = [];
            this._finished = [];
            Object.defineProperty(this, 'failed', {
                get: function () {
                    for (var prop in self._errors) {
                        if (self._errors.hasOwnProperty(prop)) {
                            return true;
                        }
                    }
                    return false;
                },
                enumerable: true,
                configurable: true
            });
        }

        MappingOperation.prototype = Object.create(Operation.prototype);


        /**
         * Check to see if all sub-ops have finished. Call the completion function if finished.
         */
        MappingOperation.prototype.checkIfDone = function () {
            var self = this;
            var isFinished = this._operations.length == this._finished.length;
            if (isFinished) {
                this.finish();
                function finishUp() {
                    if (self.completion) {
                        var errors = self.failed ? self._errors : null;
                        if (errors) {
                            $log.trace('Operation failed', self);
                        }
                        else {
                            $log.trace('Operation completed', self);
                        }
                        self.completion(errors, self._obj, self._operations);
                    }
                }
                $log.info('Mapping operation finishing', {obj: this.obj ? this._obj._id : null});

                if (this._obj) {
                    this._obj.save(function (err) {
                        if (err) {
                            self._errors.save = err;
                        }
                        finishUp();
                    })
                }
                else {
                    finishUp();
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
                        var subOperation = new MappingOperation(reverseMapping, item, function (err, related) {
                            $log.info('Mapping operation completed.', {prop: prop, related: related._id, obj: obj._id});
                            if (!err) {
                                mappedArr[i] = related;
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
                                            $log.debug('Error setting relationship', err);
                                            self._errors[prop] = err;
                                        }
                                        else {
                                            $log.debug('Successfully set relationship');
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
                self._operations.push(arrayOperations);
            }
        };

        MappingOperation.prototype._mapAttribute = function (prop, val) {
            $log.trace('_mapAttribute', {prop: prop, val: val, op: this});
            this._obj[prop] = val;
        };

        MappingOperation.prototype._mapRelationship = function (prop, val) {
            $log.trace('_mapRelationship', {prop: prop, val: val, op: this});
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
            var subOperation = new MappingOperation(reverseMapping, val, function (err, related) {
                if (err) {
                    self._errors[prop] = err;
                    self._finished.push(subOperation);
                    self.checkIfDone();
                }
                else {
                    var proxy = self._obj[prop];
                    proxy.set(related, function (err) {
                        if (err) {
                            self._errors[prop] = err;
                        }
                        self._finished.push(subOperation);
                        self.checkIfDone();
                    })
                }
            });
            this._operations.push(subOperation);
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
            $log.info('Mapping operation starting', {obj: this._obj._id});
            var data = this.data;
            for (var prop in data) {
                if (data.hasOwnProperty(prop)) {
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

        /**
         * Kick off the operation.
         */
        MappingOperation.prototype.start = function () {
            Operation.prototype.start.call(this); // super call
            var self = this;
            var data = this.data;
            var remoteIdentifier;
            var idField;
            if (!this._obj) {
                if (data instanceof RestObject) {
                    this._obj = data;
                    this.checkIfDone();
                }
                else {
                    var storeOpts = {};
                    idField = this.mapping.id;
                    if (typeof(data) == 'object') {
                        remoteIdentifier = data[idField];
                    }
                    else {
                        // Here we assume that the data given is a remote identifier.
                        $log.trace('Assuming remote identifier');
                        remoteIdentifier = data;
                        this.data = {};
                        this.data[idField] = data;
                        data = this.data;
                    }
                    if (remoteIdentifier) {
                        $log.debug('Can lookup via remote id');
                        storeOpts[idField] = remoteIdentifier;
                        storeOpts.mapping = this.mapping;
                    }
                    if (data._id) {
                        $log.debug('Can lookup via _id');
                        storeOpts._id = data._id;
                    }
                    if (remoteIdentifier || data._id) {
                        $log.info('Checking store');
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

        return MappingOperation;
    })

    .factory('BulkMappingOperation', function (MappingOperation, jlog, $rootScope, Operation) {
        var $log = jlog.loggerWithName('BulkMappingOperation');

        function BulkMappingOperation(mapping, data, completion) {
            if (!this) {
                return new BulkMappingOperation(mapping, data, completion);
            }
            Operation.call(this);
            var self = this;
            this.mapping = mapping;
            this.data = data;
            this.completion = completion;
            this._operations = [];
            this._results = [];
            this._errors = [];
            this._finished = [];
            Object.defineProperty(this, 'failed', {
                get: function () {
                    return !!self._errors.length;
                },
                enumerable: true,
                configurable: true
            });
        }

        BulkMappingOperation.prototype = Object.create(Operation.prototype);

        BulkMappingOperation.prototype.start = function () {
            Operation.prototype.start.call(this); // super clal
            $log.trace('start');
            var self = this;
            var data = this.data;
            for (var i = 0; i < data.length; i++) {
                (function (idx) {
                    var op = new MappingOperation(self.mapping, data[idx], function (err, obj) {
                        if (err) {
                            self._errors.push(err);
                        }
                        else {
                            self._results[idx] = {err: err, obj: obj, raw: data[idx]};
                        }
                        self._finished.push(op);
                        if (self._finished.length == self._operations.length) {
                            this.finish();
                            if (self.completion) {
                                if (self.failed) {
                                    $log.trace('fail');
                                }
                                else {
                                    $log.trace('success');
                                }
                                self.completion(self.failed ? self._errors : null, _.pluck(self._results, 'obj'), self._results);
                            }
                        }
                    });
                    self._operations.push(op);
                    op.start();
                })(i);
            }
        };

        return BulkMappingOperation;
    })

;