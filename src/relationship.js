angular.module('restkit.relationship', ['restkit', 'restkit.store'])

    .factory('Relationship', function () {
        function Relationship(name, reverseName, mapping, reverseMapping) {
            if (!this) {
                return new Relationship(name, reverseName, mapping);
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
            Relationship.call(this, mapping);
        }
        ManyToManyRelationship.prototype = Object.create(Relationship.prototype);
        return ManyToManyRelationship;
    })

    .factory('ForeignKeyRelationship', function (Relationship) {
        function ForeignKeyRelationship(name, reverseName, mapping, reverseMapping) {
            if (!this) {
                return new ForeignKeyRelationship(name, reverseName, mapping, reverseMapping);
            }
            Relationship.call(this, mapping);
        }
        ForeignKeyRelationship.prototype = Object.create(Relationship.prototype);
        ForeignKeyRelationship.prototype.getRelated = function (obj, callback) {

        };
        return ForeignKeyRelationship;
    })

    .factory('OneToOneRelationship', function (Relationship) {
        function OneToOneRelationship(name, reverseName, mapping, reverseMapping) {
            if (!this) {
                return new OneToOneRelationship(name, reverseName, mapping, reverseMapping);
            }
            Relationship.call(this, mapping);
        }
        OneToOneRelationship.prototype = Object.create(Relationship.prototype);
        return OneToOneRelationship;
    })



;