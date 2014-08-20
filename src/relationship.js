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

    .factory('ManyToManyRelationship', function (Relationship) {
        function ManyToManyRelationship(name, reverseName, mapping, reverseMapping) {
            if (!this) {
                return new ManyToManyRelationship(name, reverseName, mapping, reverseMapping);
            }
            Relationship.call(this, name, reverseName, mapping, reverseMapping);
        }
        ManyToManyRelationship.prototype = Object.create(Relationship.prototype);
        return ManyToManyRelationship;
    })

    .factory('ForeignKeyRelationship', function (Relationship, Store) {
        function ForeignKeyRelationship(name, reverseName, mapping, reverseMapping) {
            if (!this) {
                return new ForeignKeyRelationship(name, reverseName, mapping, reverseMapping);
            }
            Relationship.call(this, name, reverseName, mapping, reverseMapping);
        }
        ForeignKeyRelationship.prototype = Object.create(Relationship.prototype);

        ForeignKeyRelationship.prototype.getRelated = function (obj, callback) {
            var localIdField = this.name + 'LocalId';
            var remoteIdField = this.name + 'RemoteId';
            var storeQuery = {};
            if (obj[localIdField]) {
                storeQuery._id = obj[localIdField];
            }
            else if (obj[remoteIdField]) {
                storeQuery[this.reverseMapping.id] = obj[remoteIdField];
                storeQuery.mapping = this.reverseMapping;
            }
            else {
                if (callback) callback('No local or remote id for relationship "' + this.name.toString() + '"');
                return;
            }
            Store.get(storeQuery, callback);
        };

        return ForeignKeyRelationship;
    })

    .factory('OneToOneRelationship', function (Relationship) {
        function OneToOneRelationship(name, reverseName, mapping, reverseMapping) {
            if (!this) {
                return new OneToOneRelationship(name, reverseName, mapping, reverseMapping);
            }
            Relationship.call(this, name, reverseName, mapping, reverseMapping);
        }
        OneToOneRelationship.prototype = Object.create(Relationship.prototype);
        return OneToOneRelationship;
    })



;