angular.module('restkit.mapping.operation', [])

    .factory('MappingOperation', function (jlog, RestObject, Store) {

        var $log = jlog.loggerWithName('MappingOperation');

        /**
         *
         * @param mapping
         * @param data The data we are want to map onto obj.
         * @param completion Called when this mapping operation completes, failed or otherwise.
         * @constructor
         */
        function MappingOperation(mapping, data, completion) {
            this.mapping = mapping;
            this.data = data;
            this.completion = completion;
            this._obj = null;
            this._errors = {};
            this._operations = [];
            this._finished = [];
        }

        /**
         * Check to see if all sub-ops have finished. Call the completion function if finished.
         */
        MappingOperation.checkIfDone = function () {
            $log.trace('checkIfDone');
            if (this._operations.length == this._finished.length) {
                $log.trace('Operation completed', this);
                if (this.completion) {
                    this.completion(this._errors.length ? this._errors : null, this._operations);
                }
            }
        };

        MappingOperation.prototype._mapArray = function (prop, arr) {
            $log.trace('_mapArray', {prop: prop, arr: arr, op: this});
            var self = this;
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
                for (var i = 0; i < arr.length; i++) {
                    (function (i, item) {
                        var subOperation = new MappingOperation(reverseMapping, item, function (err, related) {
                            if (!err) {
                                mappedArr[i] = related;
                            }
                            else {
                                errors.push(err);
                            }
                            numFinished++;
                            if (numFinished == arr.length) {
                                if (!errors.length) {
                                    var proxy = this._obj[proxy];
                                    proxy.setRelated(mappedArr, function (err) {
                                        if (err) {
                                            self._errors[prop] = err;

                                        }
                                        self._finished.push(subOperation);
                                        self.checkIfDone();
                                    })
                                }
                                else {
                                    self._errors[prop] = errors;
                                    self._finished.push(subOperation);
                                    self.checkIfDone();
                                }
                            }
                        });
                        this._operations.push(subOperation);
                        subOperation.start();
                    })(i, arr[i]);
                }
            }
        };

        MappingOperation.prototype._mapAttribute = function (prop, val) {
            $log.trace('_mapAttribute', {prop: prop, val: val, op: this});
            this.obj[prop] = val;
        };

        MappingOperation.prototype._mapRelationship = function (prop, val) {
            $log.trace('_mapRelationship', {prop: prop, val: val, op: this});
            var self = this;
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
            return this._obj._fields.index(prop) > -1;
        };

        MappingOperation.prototype._isRelationship = function (prop) {
            return this._obj._relationshipFields.indexOf(prop) > -1;
        };

        /**
         * Kick off the mapping.
         * @private
         */
        MappingOperation.prototype._startMapping = function () {
            $log.trace('Start', this);
            var data = this.data;
            var obj = this._obj;
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
            if (data instanceof RestObject) {
                this._obj = data;
                this.checkIfDone();
            }
            else {
                var storeOpts = {};
                var identifier = data[this.mapping.id];
                if (identifier) {
                    storeOpts[this.id] = identifier;
                    storeOpts.mapping = this.mapping;
                }
                if (data._id) {
                    storeOpts._id = data._id;
                }
                Store.get(storeOpts, function (err, obj) {
                    if (!err) {
                        if (!obj) {
                            var restObject = self.mapping._new();
                            Store.put(restObject, function (err) {
                                if (err) {
                                    if (callback) callback(err);
                                }
                                else {
                                    self._obj = restObject;
                                    self._startMapping();
                                }
                            });
                        }
                        else {
                            self._obj = obj;
                            self._startMapping();
                        }
                    }
                    else {
                        self._errors.push(err);
                        self.checkIfDone();
                    }
                });
            }
        };

        return MappingOperation;
    })

;