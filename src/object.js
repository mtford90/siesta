angular.module('restkit.object', ['restkit'])

    .factory('SaveOperation', function (cache, PouchDocSync, Pouch, PouchDocAdapter, jlog) {
        var saveOperations = {};
        var runningSaveOperations = {};

        var $log = jlog.loggerWithName('SaveOperation');

        /**
         * Persists an object. Ensures that only one save operation per object is running at a time.
         * This avoids conflicts.
         *
         * @param object
         * @param callback
         * @returns {SaveOperation}
         * @constructor
         */
        function SaveOperation(object, callback) {
            if (!this) return new SaveOperation(object, callback);
            this.object = object;
            this.callback = callback;
        }

        SaveOperation.prototype._finish = function (err) {
            var operations = saveOperations[this.object._id];
            runningSaveOperations[this.object._id] = null;
            if (err) {
                $log.trace('Error during save operation for id="' + this.object._id + '"', err);
            }
            else {
                $log.trace('Finished save operation for id="' + this.object._id + '"');
            }
            if (this.callback) {
                this.callback(err, self);
            }
            if (operations.length) {
                var nextOp = operations.pop();
                nextOp.start();
            }
        };

        SaveOperation.prototype._initialSave = function () {
            $log.trace('_initialSave');
            var self = this;
            var object = this.object;
            cache.insert(object);
            var adapted = PouchDocAdapter.from(object);
            var dirtyFields = this._getDirtyFields();
            Pouch.getPouch().put(adapted, function (err, resp) {
                if (!err) {
                    object._rev = resp.rev;
                    $log.debug('put success', object);
                    self._clearDirtyFields(dirtyFields);
                }
                self._finish(err);
            });
        };

        SaveOperation.prototype._getDirtyFields = function () {
            var clonedArray = [];
            var dirtyFields = this.object.__dirtyFields;
            _.each(dirtyFields, function (f) {
                clonedArray.push(f);
            });
            return clonedArray;
        };

        /**
         * If we're clearing a dirty relationship field, we need to clear the reverse also.
         * @param fields
         * @param callback
         * @private
         */
        SaveOperation.prototype._clearDirtyRelationshipFields = function (fields, callback) {
            var self = this;
            var savingRelationships = [];
            var errors = [];
            var results = [];

            function unmarkAsRelated(o, relationship) {
                if (relationship.isForward(self.object)) {
                    o._unmarkFieldAsDirty(relationship.reverseName);
                }
                else {
                    o._unmarkFieldAsDirty(relationship.name);
                }
            }

            _.each(fields, function (f) {
                var isRelationship = self.object._fields.indexOf(f) < 0;
                if (isRelationship) {
                    savingRelationships.push(f);
                    var proxy = self.object[f];
                    var relationship = proxy.relationship;
                    proxy.get(function (err, related) {
                        if (!err) {
                            if (Object.prototype.toString.call(related) === '[object Array]') {
                                _.each(related, function (o) {
                                    unmarkAsRelated(o, relationship);
                                })
                            }
                            else {
                                unmarkAsRelated(related, relationship);
                            }
                        }
                        else {
                            errors.push(err);
                        }
                        results.push({related: related, err: err});
                        if (savingRelationships.length == results.length) {
                            if (callback) callback(errors.length ? errors : null, results);
                        }
                    });

                }
            });
            if (!savingRelationships.length) {
                if (callback) callback();
            }
        };

        SaveOperation.prototype._clearDirtyFields = function (fields) {
            $log.trace('_clearDirtyFields', fields);
            this.object._unmarkFieldsAsDirty(fields);
//            this._clearDirtyRelationshipFields(fields, callback);
        };

        SaveOperation.prototype._saveDirtyFields = function () {
            $log.trace('_saveDirtyFields');
            var self = this;
            var dirtyFields = this._getDirtyFields();
            if (dirtyFields.length) {
                $log.trace('_saveDirtyFields, have dirty fields to save', dirtyFields);
                var changes = {};
                _.each(dirtyFields, function (field) {
                    var isAttribute = self.object._fields.indexOf(field) > -1;
                    if (isAttribute) {
                        changes[field] = self.object[field];
                    }
                    else { // Relationship
                        var proxy = self.object[field];
                        changes[field] = proxy._id;
                    }
                });
                $log.trace('_saveDirtyFields, changes:', changes);
                PouchDocSync.retryUntilWrittenMultiple(self.object._id, changes, function (err) {
                    if (err) {
                        $log.error('Error saving object.', err);
                        self._finish(err);
                    }
                    else {
                        $log.trace('Successfully saved.');
                        self._clearDirtyFields(dirtyFields);
                        self._finish(err);
                    }
                });
            }
            else {
                $log.trace('_saveDirtyFields, no dirty fields to save');
                self._finish();
            }
        };

        SaveOperation.prototype._start = function () {
            $log.trace('Starting save operation for id="' + this.object._id + '"');
            var id = this.object._id;
            var ops = saveOperations[id];
            var idx = ops.indexOf(this);
            if (idx > -1) {
                ops.splice(idx, 1);
            }
            runningSaveOperations[ id] = this;
            if (cache.get({_id: id})) {
                this._saveDirtyFields();
            }
            else {
                this._initialSave();
            }
        };

        SaveOperation.prototype.start = function () {
            var id = this.object._id;
            if (!saveOperations[id]) saveOperations[id] = [];
            var ops = saveOperations[id];
            if (runningSaveOperations[id]) {
                ops.push(this);
            }
            else {
                this._start();
            }
        };

        return SaveOperation
    })

    .factory('RestObject', function (defineSubProperty, jlog, SaveOperation) {
        var $log = jlog.loggerWithName('RestObject');

        function RestObject(mapping) {

            if (!this) {
                return new RestObject(mapping);
            }

            var self = this;
            this.mapping = mapping;
            Object.defineProperty(this, 'idField', {
                get: function () {
                    return self.mapping.id ? self.mapping.id : 'id';
                },
                enumerable: true,
                configurable: true
            });
            defineSubProperty.call(this, 'type', this.mapping);
            defineSubProperty.call(this, 'collection', this.mapping);
            defineSubProperty.call(this, '_fields', this.mapping);
            Object.defineProperty(this, '_relationshipFields', {
                get: function () {
                    return _.map(self.mapping.relationships, function (r) {
                        if (r.isForward(self)) {
                            return r.name;
                        }
                        else {
                            return r.reverseName;
                        }
                    });
                },
                enumerable: true,
                configurable: true
            });

            this.__dirtyFields = [];

            Object.defineProperty(this, 'isDirty', {
                get: function () {
                    var isDirty = self.__dirtyFields.length > 0;
                    if (isDirty) {
                        $log.trace('id="' + self._id + '" is dirty', self.__dirtyFields);
                    }
                    return  isDirty;
                },
                enumerable: true,
                configurable: true
            });
        }

        RestObject.prototype._unmarkFieldsAsDirty = function (fields) {
            var self = this;
            _.each(fields, function (f) {
                self._unmarkFieldAsDirty(f);
            })
        };

        RestObject.prototype._unmarkFieldAsDirty = function (field) {
            var idx = this.__dirtyFields.indexOf(field);
            if (idx > -1) {
                this.__dirtyFields.splice(idx, 1);
            }
            this._markTypeAsDirtyIfNeccessary();
        };

        RestObject.prototype._markFieldsAsDirty = function (fields) {
            var self = this;
            _.each(fields, function (f) {
                self._markFieldAsDirty(f);
            });
        };

        RestObject.prototype._markFieldAsDirty = function (field) {
            if (this.__dirtyFields.indexOf(field) < 0) {
                this.__dirtyFields.push(field);
            }
            this._markTypeAsDirtyIfNeccessary();
        };

        /**
         * Mark dirty one level up.
         * @private
         */
        RestObject.prototype._markTypeAsDirtyIfNeccessary = function () {
            if (this.isDirty) {
                this.mapping._markObjectAsDirty(this);
            }
            else {
                this.mapping._unmarkObjectAsDirty(this);
            }
        };

        /**
         * Write down any dirty fields to PouchDB.
         * @param callback Called when completed
         */
        RestObject.prototype.save = function (callback) {
            $log.trace('save');
            var op = new SaveOperation(this, callback);
            op.start();
        };

        return RestObject;
    })

    .factory('FountArray', function () {

    })

    .constant('ChangeType', {
        Set: 'Set',
        Insert: 'Insert',
        Remove: 'Remove',
        Move: 'Move',
        Replace: 'Replace'
    })

;