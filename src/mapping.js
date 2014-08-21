angular.module('restkit.mapping', ['restkit.indexing', 'restkit', 'restkit.query', 'restkit.relationship'])

    .factory('Mapping', function (Indexes, Query, defineSubProperty, guid, RestAPIRegistry, RestObject, jlog,
                                  RestError, RelationshipType, ForeignKeyRelationship, OneToOneRelationship, ManyToManyRelationship) {

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

            console.log(1);
            this._relationships = null;

            // Lazily construct relationship objects so that all mappings are registered beforehand.
            // Doubt that this has too much performance impact.
            Object.defineProperty(this, 'relationships', {
                get: function () {
                    if (!self._relationships) {
                        $log.debug('lazily constructing relationships');
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
                                    else if (relationship.type == RelationshipType.ManyToMany) {
                                        relationshipClass = ManyToManyRelationship;
                                    }
                                    else {
                                        throw new RestError('Unknown relationship type "' + relationship.type.toString() + '"');
                                    }
                                    var reverseMappingName = relationship.mapping;
                                    $log.debug('reverseMappingName', reverseMappingName);
                                    var api = RestAPIRegistry[self.api];
                                    $log.debug('api', RestAPIRegistry);
                                    var reverseMapping = api[reverseMappingName];
                                    $log.debug('reverseMapping', reverseMapping);
                                    var relationshipObj = new relationshipClass(name, relationship.reverse, self, reverseMapping);
                                    self._relationships.push(relationshipObj);
                                }
                            }
                        }
                    }
                    return self._relationships;
                },
                enumerable: true,
                configurable: true
            });


        }

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
         * Map data into Fount. This is where the magic happens.
         *
         * @param data Raw data received remotely or otherwise
         */
        Mapping.prototype.map = function (data) {

        };

        /**
         * Convert raw data into a RestObject
         * @param data
         * @returns {RestObject}
         * @private
         */
        Mapping.prototype._new = function (data) {
            $log.debug('_new', data);
            var idField = this.id;
            if (data[idField]) {
                var _id = guid();
                var restObject = new RestObject();
                restObject._id = _id;
                _.each(this._fields, function (field) {
                    $log.debug('_new looking for "' + field + '" in ', data);
                    if (data[field]) {
                        restObject[field] = data[field];
                    }
                });
                return restObject;
            }
            else {
                throw new RestError('id field "' + idField.toString() + '" is not present', {data: data});
            }
        };

        return Mapping;
    })

;