angular.module('restkit.mapping.operation', [])

    .factory('MappingOperation', function (jlog, RestObject, Store, cache) {

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

        /**
         * Check to see if all sub-ops have finished. Call the completion function if finished.
         */
        MappingOperation.prototype.checkIfDone = function () {
            var isFinished = this._operations.length == this._finished.length;
            if (isFinished) {
                $log.info('Mapping operation finishing', {obj: this._obj._id});
                if (this.completion) {
                    var errors = this.failed ? this._errors : null;
                    if (errors) {
                        $log.trace('Operation failed', this);
                    }
                    else {
                        $log.trace('Operation completed', this);
                    }
                    this.completion(errors, this._obj, this._operations);
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
                                    $log.debug('Setting relationship '  + prop);
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
            var self = this;
            var data = this.data;
            var remoteIdentifier;
            var idField;
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
                                Store.put(restObject, function (err) {
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
        };

        return MappingOperation;
    })

    .factory('BulkMappingOperation', function (MappingOperation, jlog, $rootScope) {
        var $log = jlog.loggerWithName('BulkMappingOperation');

        function BulkMappingOperation(mapping, data, completion) {
            if (!this) {
                return new BulkMappingOperation(mapping, data, completion);
            }
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

        BulkMappingOperation.prototype.start = function () {
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
                            if (self.completion) {
                                if (self.failed) {
                                    $log.trace('fail');
                                }
                                else {
                                    $log.trace('success');
                                }
                                self.completion(self.failed ?  self._errors : null, _.pluck(self._results, 'obj'), self._results);
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