angular.module('restkit.relationship', ['restkit', 'restkit.store'])

    .factory('Relationship', function () {
        function Relationship() {

        }
        return Relationship;
    })

    .factory('ManyToManyRelationship', function () {
        function ManyToManyRelationship() {

        }
        return ManyToManyRelationship;
    })

    .factory('OneToManyRelationship', function () {
        function OneToManyRelationship() {

        }
        return OneToManyRelationship;
    })

    .factory('OneToOneRelationship', function () {
        function OneToOneRelationship() {

        }
        return OneToOneRelationship;
    })



;