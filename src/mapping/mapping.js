angular.module('restkit.mapping', ['restkit.indexing', 'restkit', 'restkit.query', 'restkit.relationship', 'restkit.notifications'])

    .factory('Mapping', function (broadcast, Pouch, $rootScope, ChangeType, Indexes, Query, defineSubProperty, guid, RestAPIRegistry, RestObject, jlog, RestError, RelationshipType, ForeignKeyRelationship, OneToOneRelationship, PouchDocAdapter, Store) {

        var $log = jlog.loggerWithName('Mapping');

        function Mapping(opts) {
            var self = this;
            this._opts = opts;
            Object.defineProperty(this, '_fields', {
                get: function () {
                    var fields = [];
                    if (self._opts.id) {
                        fields.push('id');
                    }
                    if (self._opts.attributes) {
                        _.each(self._opts.attributes, function (x) {fields.push(x)});
                    }
                    return fields;
                },
                enumerable: true,
                configurable: true
            });

            defineSubProperty.call(this, 'type', self._opts);
            defineSubProperty.call(this, 'id', self._opts);
            defineSubProperty.call(this, 'api', self._opts);
            defineSubProperty.call(this, 'attributes', self._opts);

            this._relationships = null;

            Object.defineProperty(this, 'relationships', {
                get: function () {
                    return self._relationships;
                },
                enumerable: true,
                configurable: true
            });

        }

        Mapping.prototype.installRelationships = function () {
            var self = this;
            self._relationships = [];
            if (self._opts.relationships) {
                for (var name in self._opts.relationships) {
                    $log.debug(self.type + ': configuring relationship ' + name);
                    if (self._opts.relationships.hasOwnProperty(name)) {
                        var relationship = self._opts.relationships[name];
                        var relationshipClass;
                        if (relationship.type == RelationshipType.ForeignKey) {
                            relationshipClass = ForeignKeyRelationship;
                        }
                        else if (relationship.type == RelationshipType.OneToOne) {
                            relationshipClass = OneToOneRelationship;
                        }
                        else {
                            throw new RestError('Unknown relationship type "' + relationship.type.toString() + '"');
                        }
                        var mappingName = relationship.mapping;
                        $log.debug('reverseMappingName', mappingName);
                        var api = RestAPIRegistry[self.api];
                        $log.debug('api', RestAPIRegistry);
                        var reverseMapping = api[mappingName];
                        if (reverseMapping) {
                            $log.debug('reverseMapping', reverseMapping);
                            var relationshipObj = new relationshipClass(name, relationship.reverse, self, reverseMapping);
                            self._relationships.push(relationshipObj);
                        }
                        else {
                            throw new RestError('Mapping with name "' + mappingName.toString() + '" does not exist');
                        }
                    }
                }
            }
        };

        Mapping.prototype.installReverseRelationships = function () {
            _.each(this.relationships, function (r) {
                var reverseMapping = r.reverseMapping;
                if (reverseMapping.relationships.indexOf(r) < 0) {
                    reverseMapping.relationships.push(r);
                }
            });
        };

        Mapping.prototype.query = function (query, callback) {
            var q = new Query(this, query);
            q.execute(callback);
        };

        Mapping.prototype.get = function (id, callback) {
            var opts = {};
            opts[this.id] = id;
            var q = new Query(this, opts);
            q.execute(function (err, rows) {
                var obj = null;
                if (!err && rows.length) {
                    if (rows.length > 1) {
                        err = 'More than one object with id=' + id.toString();
                    }
                    else {
                        obj = rows[0];
                    }
                }
                if (callback) callback(err, obj);
            });
        };

        Mapping.prototype.all = function (callback) {
            var q = new Query(this, {});
            q.execute(callback);
        };

        Mapping.prototype.install = function (callback) {
            var errors = this._validate();
            if (!errors.length) {
                Indexes.installIndexes(this.api, this.type, this._fields, callback);
            }
            else {
                if (callback) callback(errors);
            }
        };

        Mapping.prototype._validate = function () {
            var errors = [];
            if (!this.type) {
                errors.push('Must specify a type');
            }
            if (!this.api) {
                errors.push('A mapping must belong to an api');
            }
            return errors;
        };


        /**
         * Wraps the methods of a javascript array object so that notifications are sent
         * on calls.
         *
         * @param array the array we have wrapping
         * @param field name of the field
         * @param restObject the object to which this array is a property
         */
        function wrapArray(array, field, restObject) {
            function fountPush(push) {
                var objects = Array.prototype.slice.call(arguments, 1);
                var res = push.apply(this, objects);
                broadcast(restObject, {
                    type: ChangeType.Insert,
                    new: objects,
                    field: field,
                    index: this.length - 1
                });
                return  res;
            }

            if (array.push.name != 'fountPush') {
                array.push = _.bind(fountPush, array, array.push);
            }

            function fountPop(pop) {
                var objects = Array.prototype.slice.call(arguments, 1);
                if (this.length) {
                    var old = [this[this.length - 1]];
                    var res = pop.apply(this, objects);
                    broadcast(restObject, {
                        type: ChangeType.Remove,
                        old: old,
                        field: field,
                        index: this.length
                    });
                    return  res;
                }
                else {
                    return pop.apply(this, objects);
                }
            }

            if (array.pop.name != 'fountPop') {
                array.pop = _.bind(fountPop, array, array.pop);
            }

            function fountShift(shift) {
                var objects = Array.prototype.slice.call(arguments, 1);
                if (this.length) {
                    var old = [this[0]];
                    var res = shift.apply(this, objects);
                    broadcast(restObject, {
                        type: ChangeType.Remove,
                        old: old,
                        field: field,
                        index: 0
                    });
                    return  res;
                }
                else {
                    return shift.apply(this, objects);
                }
            }

            if (array.shift.name != 'fountShift') {
                array.shift = _.bind(fountShift, array, array.shift);
            }

            function fountUnshift(unshift) {
                var objects = Array.prototype.slice.call(arguments, 1);
                var res = unshift.apply(this, objects);
                broadcast(restObject, {
                    type: ChangeType.Insert,
                    new: objects,
                    field: field,
                    index: 0
                });
                return res;
            }

            if (array.unshift.name != 'fountUnshift') {
                array.unshift = _.bind(fountUnshift, array, array.unshift);
            }

            function Swap(oldIndex, newIndex) {
                this.oldIndex = oldIndex;
                this.newIndex = newIndex;
            }

            function computeDiff(arr, otherArr) {
                var indexes = [];
                indexes.in = _.bind(function (other) {
                    //noinspection JSPotentiallyInvalidUsageOfThis
                    for (var i = 0; i < this.length; i++) {
                        var thisObj = this[i];
                        if (thisObj.oldIndex == other.oldIndex && thisObj.newIndex == other.newIndex) {
                            return true;
                        }
                        if (thisObj.newIndex == other.oldIndex && thisObj.oldIndex == other.newIndex) {
                            return true;
                        }
                    }
                    return false;
                }, indexes);

                for (var i = 0; i < arr.length; i++) {
                    var obj = arr[i];
                    var newIndex = i;
                    var oldIndex = otherArr.indexOf(obj);
                    if (newIndex != oldIndex) {
                        var swap = new Swap(oldIndex, newIndex);
                        if (!indexes.in(swap)) {
                            indexes.push(swap);
                        }
                    }
                }
                return indexes;
            }

            function fountSort(sort) {
                var clone = $.extend(true, [], this);
                var objects = Array.prototype.slice.call(arguments, 1);
                var res = sort.apply(this, objects);
                var indexes = computeDiff(this, clone);
                broadcast(restObject, {
                    type: ChangeType.Move,
                    field: field,
                    indexes: indexes
                });
                return res;
            }

            if (array.sort.name != 'fountSort') {
                array.sort = _.bind(fountSort, array, array.sort);
            }

            function fountReverse(reverse) {
                var clone = $.extend(true, [], this);
                var objects = Array.prototype.slice.call(arguments, 1);
                var res = reverse.apply(this, objects);
                var indexes = computeDiff(this, clone);
                broadcast(restObject, {
                    type: ChangeType.Move,
                    field: field,
                    indexes: indexes
                });
                return res;
            }

            if (array.reverse.name != 'fountReverse') {
                array.reverse = _.bind(fountReverse, array, array.reverse);
            }

            array.setObjectAtIndex = function (obj, index) {
                var old = this[index];
                this[index] = obj;
                broadcast(restObject, {
                    type: ChangeType.Replace,
                    field: field,
                    index: index,
                    old: old,
                    new: obj
                });
            };

            function fountSplice(splice, index, howMany) {
                var self = this;
                var objects = Array.prototype.slice.call(arguments, 3);
                var removals = [];
                var replacements = [];
                var insertions = [];
                for (var i = index; i < index + Math.max(howMany, objects.length); i++) {
                    var relativeIndex = i - index;
                    var newObject;
                    if (objects.length && relativeIndex < objects.length && relativeIndex < howMany) { // Replacement
                        var oldObject = this[i];
                        newObject = objects[relativeIndex];
                        replacements.push({index: index, oldObject: this[i], newObject: newObject});
                        $log.debug('Replacement', oldObject, newObject);
                    }
                    else if (objects.length && relativeIndex < objects.length) { // Insertion
                        newObject = objects[relativeIndex];
                        insertions.push({index: i, newObject: newObject});
                        $log.debug('Insertion', i, newObject);
                    }
                    else if (relativeIndex < howMany) { // Deletion
                        $log.debug('Deletion');
                        removals.push(i);
                    }
                }
                var changes = [];
                var old;
                var newObjs;
                if (removals.length) {
                    old = _.map(removals, function (i) { return self[i]});
                    changes.push({
                        type: ChangeType.Remove,
                        index: removals[0],
                        old: old,
                        field: field
                    })
                }
                if (replacements.length) {
                    old = _.pluck(replacements, 'oldObject');
                    newObjs = _.pluck(replacements, 'newObject');
                    changes.push({
                        type: ChangeType.Replace,
                        field: field,
                        index: replacements[0].index,
                        old: old,
                        new: newObjs
                    })
                }
                if (insertions.length) {
                    newObjs = _.pluck(insertions, 'newObject');
                    changes.push({
                        type: ChangeType.Insert,
                        field: field,
                        index: insertions[0].index,
                        new: newObjs
                    })
                }
                var res = _.bind(splice, this, index, howMany).apply(this, objects);
                broadcast(restObject, changes);
                return res;
            }

            if (array.splice.name != 'fountSplice') {
                array.splice = _.bind(fountSplice, array, array.splice);
            }


        }

        Mapping.prototype._map = function (obj, data, callback) {
            var waiting = [];
            var errors = [];
            var results = [];
            for (var prop in data) {
                if (data.hasOwnProperty(prop)) {
                    $log.debug('_map', prop);
                    var val = data[prop];
                    if (obj._fields.indexOf(prop) > -1) {
                        obj[prop] = val;
                        // TODO: Differentiate between scalar attributes + arrays
                    }
                    else if (obj._relationshipFields.indexOf(prop) > -1) {
                        if (val instanceof RestObject) {
                            $log.error('NYI');
                            // TODO: Awesome. Set the relationship.
                        }
                        else if (typeof(val) == 'object' && !(Object.prototype.toString.call(val) == '[object Array]')) {
                            $log.error('NYI');
                            // TODO: Use the relationship to get the mapping, and perform the mapping.
                        }
                        else { // Store lookup needed.
                            $log.debug('Store lookup needed', val);
                            var relationship = obj[prop].relationship;
                            var isForward = relationship.isForward(obj);
                            var reverseMapping;
                            if (isForward) {
                                reverseMapping = relationship.reverseMapping;
                            }
                            else {
                                reverseMapping = relationship.mapping;
                            }
                            var idField = reverseMapping.id;
                            var reverseData;
                            if (Object.prototype.toString.call(val) == '[object Array]') {
                                reverseData = _.map(val, function (id) {
                                    var o = {};
                                    // Executed straight away so the warning below isn't an issue.
                                    //noinspection JSReferencingMutableVariableFromClosure
                                    o[idField] = id;
                                    return o;
                                });
                            }
                            else {
                                reverseData = {};
                                reverseData[idField] = val;
                            }

                            var ref = {obj: obj, data: data, field: prop};
                            waiting.push(ref);
                            dump(waiting);
                            function checkIfDone() {
                                $log.debug('checkIfDone');
                                if (waiting.length == results.length) {
                                    if (callback) callback(errors.length ? errors : null, obj, results);
                                }
                            }

                            function map(ref, prop, reverseMapping, reverseData) {
                                reverseMapping.map(reverseData, function (err, related) {
                                    if (err) {
                                        ref.err = err;
                                        errors.push(err);
                                        results.push(ref);
                                        checkIfDone();
                                    }
                                    else {
                                        var proxy = obj[prop];
                                        dump(proxy);
                                        proxy.set(related, function (err) {
                                            if (err) {
                                                ref.err = err;
                                                errors.push(err);
                                            }
                                            results.push(ref);
                                            checkIfDone();
                                        });
                                    }
                                });
                            }

                            map(ref, prop, reverseMapping, reverseData);

                        }
                    }
                }
            }
            if (!waiting.length) { // No store lookups were required.
                $log.debug('no store lookups required');
                if (callback) {
                    callback(null, obj);
                }
            }
        };

        /**
         * Map data into Fount.
         *
         * @param data Raw data received remotely or otherwise
         * @param callback Called once pouch persistence returns.
         */
        Mapping.prototype.map = function (data, callback) {
            if (Object.prototype.toString.call(data) === '[object Array]') {
                this._mapBulk(data, callback);
            }
            else {
                var self = this;
                var storeOpts = {};
                var identifier = data[this.id];
                if (identifier) {
                    storeOpts[this.id] = identifier;
                    storeOpts.mapping = this;
                }
                if (data._id) {
                    storeOpts._id = data._id;
                }
                Store.get(storeOpts, function (err, obj) {
                    if (!err) {
                        if (!obj) {
                            var restObject = self._new(data);
                            Store.put(restObject, function (err) {
                                if (err) {
                                    if (callback) callback(err);
                                }
                                else {
                                    self._map(restObject, data, callback);
                                }
                            });
                        }
                        else {
                            $log.info('Mapping attributes');
                            self._map(obj, data);
                            if (callback) {
                                callback(null, obj);
                            }
                        }
                    }
                    else if (callback) {
                        callback(err);
                    }
                });
            }
        };

        Mapping.prototype._mapBulk = function (data, callback) {
            var self = this;
            var objs = [];
            var errs = [];
            var res = [];

            function done() {
                if (callback) callback(errs.length ? errs : null, objs, res);
            }

            _.each(data, function (d) {
                self.map(d, function (err, obj) {
                    if (obj) objs.push(obj);
                    if (err) errs.push(err);
                    res.push({err: err, obj: obj, raw: d});
                    if (res.length == data.length) {
                        done();
                    }
                });
            });
        };

        /**
         * Convert raw data into a RestObject
         * @returns {RestObject}
         * @private
         */
        Mapping.prototype._new = function () {
            var _id = guid();
            var restObject = new RestObject(this);
            restObject._id = _id;
            // Place attributes on the object.
            restObject.__values = {};
            _.each(this._fields, function (field) {
                Object.defineProperty(restObject, field, {
                    get: function () {
                        return restObject.__values[field];
                    },
                    set: function (v) {
                        broadcast(restObject, {
                            type: ChangeType.Set,
                            old: restObject.__values[field],
                            new: v,
                            field: field
                        });
                        if (Object.prototype.toString.call(v) === '[object Array]') {
                            wrapArray(v, field, restObject);
                        }
                        restObject.__values[field] = v;
                    },
                    enumerable: true,
                    configurable: true
                });

            });
            // Place relationships on the object.
            _.each(this.relationships, function (relationship) {
                relationship.contributeToRestObject(restObject);
            });
            return restObject;
        };


        Mapping.prototype.toString = function () {
            return 'Mapping[' + this.type + ']';
        };

        return Mapping;
    })

;