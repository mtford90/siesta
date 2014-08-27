angular.module('restkit.object', ['restkit'])

    .factory('RestObject', function (defineSubProperty, PouchDocSync, jlog) {

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
                    return self.__dirtyFields.length > 0;
                },
                enumerable: true,
                configurable: true
            });
        }


        /**
         * Write down any dirty fields to PouchDB.
         * @param callback Called when completed
         */
        RestObject.prototype.save = function (callback) {
            $log.trace('save');
            var self = this;
            var dirtyFields = $.extend({}, this.__dirtyFields);
            var changes = {};
            _.each(dirtyFields, function (field) {
                changes[field] = self[field];
            });
            PouchDocSync.retryUntilWrittenMultiple(this._id, changes, function (err) {
                if (err) {
                    $log.error('Error saving object.', err);
                }
                else {
                    $log.trace('Successfully saved.');
                    _.each(dirtyFields, function (f) {
                        var idx = self.__dirtyFields.indexOf(f);
                        if (idx > -1) {
                            self.__dirtyFields.splice(idx, 1);
                        }
                    });
                }
                if (callback) callback(err);
            });
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