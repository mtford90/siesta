angular.module('restkit.mapping', ['restkit.indexing', 'restkit', 'restkit.query', 'restkit.relationship', 'restkit.notifications', 'restkit.mapping.operation'])

    .factory('Mapping', function (cache, broadcast, Pouch, MappingOperation, SaveOperation, CompositeOperation, $rootScope, ChangeType, Indexes, Query, defineSubProperty, guid, CollectionRegistry, RestObject, jlog, RestError, RelationshipType, ForeignKeyRelationship, OneToOneRelationship, PouchDocAdapter, Store) {

        var $log = jlog.loggerWithName('Mapping');

        function Mapping(opts) {
            var self = this;
            this._opts = opts;
            Object.defineProperty(this, '_fields', {
                get: function () {
                    var fields = [];
                    if (self._opts.id) {
                        fields.push(self._opts.id);
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
            defineSubProperty.call(this, 'collection', self._opts);
            defineSubProperty.call(this, 'attributes', self._opts);

            this._relationships = [];

            Object.defineProperty(this, 'relationships', {
                get: function () {
                    return self._relationships;
                },
                enumerable: true,
                configurable: true
            });

            this.__dirtyObjects = [];

            Object.defineProperty(this, 'isDirty', {
                get: function () {
                    return !!self.__dirtyObjects.length;
                },
                enumerable: true,
                configurable: true
            });

        }

        Mapping.prototype._markObjectAsDirty = function (obj) {
            if (this.__dirtyObjects.indexOf(obj) < 0) {
                this.__dirtyObjects.push(obj);
            }
            this._markCollectionAsDirtyIfNeccessary();
        };

        Mapping.prototype._unmarkObjectAsDirty = function (obj) {
            var idx = this.__dirtyObjects.indexOf(obj);
            if (idx > -1) {
                this.__dirtyObjects.splice(idx, 1);
            }
            this._markCollectionAsDirtyIfNeccessary();
        };

        Mapping.prototype._markCollectionAsDirtyIfNeccessary = function () {
            var collection = CollectionRegistry[this.collection];
            if (collection) {
                if (this.__dirtyObjects.length) {
                    collection._markMappingAsDirty(this);
                }
                else {
                    collection._unmarkMappingAsDirty(this);
                }
            }
            else {
                throw new RestError('Collection "' + this.collection + '" does not exist.');
            }

        };

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
                        var collection = CollectionRegistry[self.collection];
                        $log.debug('collection', CollectionRegistry);
                        var reverseMapping = collection[mappingName];

                        if (!reverseMapping) {
                            var arr = mappingName.split('.');
                            if (arr.length == 2) {
                                var collectionName = arr[0];
                                mappingName = arr[1];
                                var otherCollection = CollectionRegistry[collectionName];
                                if (!otherCollection) {
                                    throw new RestError('Collection with name "' + collectionName + '" does not exist.');
                                }
                                reverseMapping = otherCollection[mappingName];
                            }
                        }
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
                $log.debug('Configuring reverse relationship "' + r.reverseName + '" on ' + reverseMapping.type);
                if (reverseMapping.relationships.indexOf(r) < 0) {
                    reverseMapping.relationships.push(r);
                }
                $log.debug(reverseMapping.type + ' now has relationships:', reverseMapping.relationships);
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
                Indexes.installIndexes(this.collection, this.type, this._fields, callback);
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
            if (!this.collection) {
                errors.push('A mapping must belong to an collection');
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
                restObject._markFieldAsDirty(field);
                broadcast(restObject, {
                    type: ChangeType.Insert,
                    new: objects,
                    field: field,
                    index: this.length - 1
                });
                return res;
            }

            if (array.push.name != 'fountPush') {
                array.push = _.bind(fountPush, array, array.push);
            }

            function fountPop(pop) {
                var objects = Array.prototype.slice.call(arguments, 1);
                if (this.length) {
                    var old = [this[this.length - 1]];
                    var res = pop.apply(this, objects);
                    restObject._markFieldAsDirty(field);
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
                    restObject._markFieldAsDirty(field);
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
                restObject._markFieldAsDirty(field);
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
                restObject._markFieldAsDirty(field);
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
                restObject._markFieldAsDirty(field);
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
                restObject._markFieldAsDirty(field);
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
                restObject._markFieldAsDirty(field);
                broadcast(restObject, changes);
                return res;
            }

            if (array.splice.name != 'fountSplice') {
                array.splice = _.bind(fountSplice, array, array.splice);
            }


        }

        /**
         * Map data into Fount.
         *
         * @param data Raw data received remotely or otherwise
         * @param callback Called once pouch persistence returns.
         * @param obj Force mapping to this object
         */
        Mapping.prototype.map = function (data, callback, obj) {
            if (Object.prototype.toString.call(data) == '[object Array]') {
                return this._mapBulk(data, callback);
            }
            else {
                var op = new MappingOperation(this, data, function () {
                    var err = op.error;
                    if (err) {
                        if (callback) callback(err);
                    }
                    else if (callback) {
                        callback(null, op._obj, op.operations);
                    }
                });
                op._obj = obj;
                op.start();
                return op;
            }
        };


        Mapping.prototype._mapBulk = function (data, callback) {
            $log.trace('_mapBulk: ' + JSON.stringify(data, null, 4));
            var self = this;
            var operations = _.map(data, function (datum) {
                return new MappingOperation(self, datum);
            });
            var op = new CompositeOperation('Bulk Mapping', operations, function (err) {
                if (err) {
                    callback(err);
                }
                else {
                    var objects = _.pluck(operations, '_obj');
                    var res = _.map(operations, function (op) {
                        return {
                            err: op.error,
                            obj: op._obj,
                            raw: op.data,
                            op: op
                        }
                    });
                    callback(null, objects, res);
                }

            });
            op.start();
            return op;
        };

        /**
         * Convert raw data into a RestObject
         * @returns {RestObject}
         * @private
         */
        Mapping.prototype._new = function (data) {
            var self = this;
            var _id = guid();
            var restObject = new RestObject(this);
            $log.info('New object created _id="' + _id.toString() + '"', data);
            restObject._id = _id;
            // Place attributes on the object.
            restObject.__values = data || {};
            var fields = this._fields;
            var idx = fields.indexOf(this.id);
            if (idx > -1) {
                fields.splice(idx, 1);
            }
            restObject.__dirtyFields = [];
            _.each(fields, function (field) {

                Object.defineProperty(restObject, field, {
                    get: function () {
                        return restObject.__values[field] || null;
                    },
                    set: function (v) {
                        var old = restObject.__values[field];
                        restObject.__values[field] = v;
                        broadcast(restObject, {
                            type: ChangeType.Set,
                            old: old,
                            new: v,
                            field: field
                        });
                        if (Object.prototype.toString.call(v) === '[object Array]') {
                            wrapArray(v, field, restObject);
                        }

                        if (v != old) {
                            jlog.loggerWithName('RestObject').trace('Marking "' + field + '" as dirty for _id="' + restObject._id + '" as just changed to ' + v);
                            restObject._markFieldAsDirty(field);
                        }

                    },
                    enumerable: true,
                    configurable: true
                });
            });

            Object.defineProperty(restObject, this.id, {
                get: function () {
                    return restObject.__values[self.id] || null;
                },
                set: function (v) {
                    var old = restObject.__values[self.id];
                    restObject.__values[self.id] = v;
                    broadcast(restObject, {
                        type: ChangeType.Set,
                        old: old,
                        new: v,
                        field: self.id
                    });
                    cache.remoteInsert(restObject, v, old);
                },
                enumerable: true,
                configurable: true
            });


            // Place relationships on the object.
            _.each(this.relationships, function (relationship) {
                relationship.contributeToRestObject(restObject);
            });

            return restObject;
        };

        Mapping.prototype.save = function (callback) {
            var dirtyObjects = this.__dirtyObjects;
            if (dirtyObjects.length) {
                var saveOperations = _.map(dirtyObjects, function (obj) {
                    return new SaveOperation(obj);
                });
                var op = new CompositeOperation('Save at mapping level', saveOperations, function () {
                    if (callback) callback(op.error ? op.error : null);
                });
                op.start();
                return op;
            }
            else {
                if (callback) callback();
            }
        };

        Mapping.prototype._dump = function (asJSON) {
            var dumped = {};
            dumped.name = this.type;
            dumped.attributes = this.attributes;
            dumped.id = this.id;
            dumped.collection = this.collection;
            dumped.relationships = _.map(this.relationships, function (r) {
                if (r.isForward(this)) {
                    return r.name;
                }
                else {
                    return r.reverseName;
                }
            });
            return asJSON ? JSON.stringify(dumped, null, 4) : dumped;
        };

        Mapping.prototype.toString = function () {
            return 'Mapping[' + this.type + ']';
        };


        return Mapping;
    })

    .factory('MappingError', function (RestError) {
        /**
         * A subclass of RestError specifcally for errors that occur during mapping.
         * @param message
         * @param context
         * @param ssf
         * @returns {MappingError}
         * @constructor
         */
        function MappingError(message, context, ssf) {
            if (!this) {
                return new MappingError(message, context);
            }

            this.message = message;

            this.context = context;
            // capture stack trace
            ssf = ssf || arguments.callee;
            if (ssf && RestError.captureStackTrace) {
                RestError.captureStackTrace(this, ssf);
            }
        }

        MappingError.prototype = Object.create(RestError.prototype);
        MappingError.prototype.name = 'MappingError';
        MappingError.prototype.constructor = MappingError;

        return MappingError;
    })


;