angular.module('restkit.relationship', ['restkit', 'restkit.store'])

    .factory('Relationship', function () {
        function Relationship(name, reverseName, mapping, reverseMapping) {
            if (!this) {
                return new Relationship(name, reverseName, mapping, reverseMapping);
            }
            this.mapping = mapping;
            this.name = name;
            this.reverseName = reverseName;
            this.reverseMapping = reverseMapping;
        }

        Relationship.prototype.getRelated = function (obj, callback) {
            throw Error('Relationship.getRelated must be overridden');
        };
        return Relationship;
    })

    .factory('ManyToManyRelationship', function (Relationship,  Store, jlog) {

        var $log = jlog.loggerWithName('ManyToManyRelationship');

        function ManyToManyRelationship(name, reverseName, mapping, reverseMapping) {
            if (!this) {
                return new ManyToManyRelationship(name, reverseName, mapping, reverseMapping);
            }
            Relationship.call(this, name, reverseName, mapping, reverseMapping);
        }

        ManyToManyRelationship.prototype = Object.create(Relationship.prototype);

        ManyToManyRelationship.prototype.getRelated = function (obj, callback) {

            var self = this;
            var storeQueries;
            if (obj[this.name]) {
                storeQueries = _.map(obj[this.name], function(_id) {return {_id: _id}});
            }
            else {
                if (callback) callback('No local or remote id for relationship "' + this.name.toString() + '"');
                return;
            }
            Store.getMultiple(storeQueries, function (errs) {
                if (errs) {
                    var allErrorsAre404 = true;
                    for (var i=0;i<errs.length;i++) {
                        var err = errs[i];
                        if (err.status != 404) {
                            allErrorsAre404 = false;
                            break;
                        }
                    }
                    if (allErrorsAre404) {
                        $log.debug('Couldnt find using _id, therefore using as remote id');
                        // Attempt to use the identifier as a remote id and lookup that way instead.
                        storeQueries = _.map(obj[self.name], function (id) {
                            var storeQuery = {};
                            storeQuery[self.reverseMapping.id] = id;
                            storeQuery.mapping = self.reverseMapping;
                            return storeQuery;
                        });
                        Store.getMultiple(storeQueries, callback);
                    }
                    else {
                        if (callback) callback(errs);
                    }
                }
                else if (callback) {
                    callback();
                }
            });
        };

        return ManyToManyRelationship;
    })

    .factory('ForeignKeyRelationship', function (Relationship, Store, jlog) {
        var $log = jlog.loggerWithName('ForeignKeyRelationship');

        function ForeignKeyRelationship(name, reverseName, mapping, reverseMapping) {
            if (!this) {
                return new ForeignKeyRelationship(name, reverseName, mapping, reverseMapping);
            }
            Relationship.call(this, name, reverseName, mapping, reverseMapping);
        }

        ForeignKeyRelationship.prototype = Object.create(Relationship.prototype);

        ForeignKeyRelationship.prototype.getRelated = function (obj, callback) {

            var self = this;
            var storeQuery = {};
            if (obj[this.name]) {
                storeQuery._id = obj[this.name];
            }
            else {
                if (callback) callback('No local or remote id for relationship "' + this.name.toString() + '"');
                return;
            }
            Store.get(storeQuery, function (err) {
                if (err) {
                    if (err.status == 404) {
                        $log.debug('Couldnt find using _id, therefore using as remote id');
                        // Attempt to use the identifier as a remote id and lookup that way instead.
                        storeQuery = {};
                        storeQuery[self.reverseMapping.id] = obj[self.name];
                        storeQuery.mapping = self.reverseMapping;
                        $log.debug(1);
                        Store.get(storeQuery, callback);
                    }
                    else {
                        if (callback) callback(err);
                    }
                }
                else if (callback) {
                    callback();
                }
            });
        };

        return ForeignKeyRelationship;
    })

    .factory('OneToOneRelationship', function (Relationship, Store, jlog) {
        var $log = jlog.loggerWithName('OneToOneRelationship');

        function OneToOneRelationship(name, reverseName, mapping, reverseMapping) {
            if (!this) {
                return new OneToOneRelationship(name, reverseName, mapping, reverseMapping);
            }
            Relationship.call(this, name, reverseName, mapping, reverseMapping);
        }

        OneToOneRelationship.prototype = Object.create(Relationship.prototype);

        OneToOneRelationship.prototype.getRelated = function (obj, callback) {
            var self = this;
            var storeQuery = {};
            if (obj[this.name]) {
                storeQuery._id = obj[this.name];
            }
            else {
                if (callback) callback('No local or remote id for relationship "' + this.name.toString() + '"');
                return;
            }
            Store.get(storeQuery, function (err) {
                if (err) {
                    if (err.status == 404) {
                        $log.debug('Couldnt find using _id, therefore using as remote id');
                        // Attempt to use the identifier as a remote id and lookup that way instead.
                        storeQuery = {};
                        storeQuery[self.reverseMapping.id] = obj[self.name];
                        storeQuery.mapping = self.reverseMapping;
                        $log.debug(1);
                        Store.get(storeQuery, callback);
                    }
                    else {
                        if (callback) callback(err);
                    }
                }
                else if (callback) {
                    callback();
                }
            });
        };

        return OneToOneRelationship;
    })


;