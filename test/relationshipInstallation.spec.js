var s = require('../core/index'),
    assert = require('chai').assert;

describe('mapping relationships', function() {


    var Collection = require('../core/collection').Collection;
    var InternalSiestaError = require('../core/error').InternalSiestaError;
    var RelationshipType = require('../core/relationship').RelationshipType;
    before(function () {
        s.ext.storageEnabled = false;
    });

    beforeEach(function(done) {
        s.reset(done);
    });

    var collection, carMapping, personMapping;

    function configureAPI(type, done) {
        collection = new Collection('myCollection');
        carMapping = collection.model('Car', {
            id: 'id',
            attributes: ['colour', 'name'],
            relationships: {
                owner: {
                    mapping: 'Person',
                    type: type,
                    reverse: 'cars'
                }
            }
        });
        personMapping = collection.model('Person', {
            id: 'id',
            attributes: ['name', 'age']
        });
        collection.install(done);
    }

    describe('valid', function() {


        describe('Foreign Key', function() {

            beforeEach(function(done) {
                configureAPI(RelationshipType.OneToMany, function(err) {
                    if (err) done(err);
                    done();
                });
            });

            it('configures reverse mapping', function() {
                assert.equal(carMapping.relationships.owner.reverseMapping, personMapping);
            });

            it('configures reverse name', function() {
                assert.equal(carMapping.relationships.owner.reverseName, 'cars');

                it('configures forward mapping', function() {
                    assert.equal(carMapping.relationships.owner.forwardMapping, carMapping);
                });

            });
            it('configures forward name', function() {
                assert.equal(carMapping.relationships.owner.forwardName, 'owner');
            });

            it('installs on reverse', function() {
                var keys = Object.keys(personMapping.relationships.cars);
                for (var i = 0; i < keys.length; i++) {
                    var key = keys[i];
                    if (key != 'isForward' && key != 'isReverse') {
                        assert.equal(personMapping.relationships.cars[key], carMapping.relationships.owner[key]);
                    }
                }
            });


        });

        describe('OneToOne', function() {

            beforeEach(function(done) {
                configureAPI(RelationshipType.OneToOne, function(err) {
                    if (err) done(err);
                    done();
                });


            });
            it('configures reverse mapping', function() {
                assert.equal(carMapping.relationships.owner.reverseMapping, personMapping);
            });

            it('configures reverse name', function() {
                assert.equal(carMapping.relationships.owner.reverseName, 'cars');



            });

            it('configures forward mapping', function() {
                assert.equal(carMapping.relationships.owner.forwardMapping, carMapping);
            });
            it('configures forward name', function() {
                assert.equal(carMapping.relationships.owner.forwardName, 'owner');
            });

            it('installs on reverse', function() {
                var keys = Object.keys(personMapping.relationships.cars);
                for (var i = 0; i < keys.length; i++) {
                    var key = keys[i];
                    if (key != 'isForward' && key != 'isReverse') {
                        assert.equal(personMapping.relationships.cars[key], carMapping.relationships.owner[key]);
                    }
                }
            });





        });

    });



    describe('invalid', function() {
        it('No such mapping', function(done) {
            var collection = new Collection('myCollection');
            collection.model('Car', {
                id: 'id',
                attributes: ['colour', 'name'],
                relationships: {
                    owner: {
                        mapping: 'asd',
                        type: RelationshipType.OneToMany,
                        reverse: 'cars'
                    }
                }
            });
            collection.install(function(err) {
                assert.ok(err);
                done();
            });
        });

        it('No such relationship type', function(done) {
            var collection = new Collection('myCollection');
            collection.model('Car', {
                id: 'id',
                attributes: ['colour', 'name'],
                relationships: {
                    owner: {
                        mapping: 'Person',

                        type: 'invalidtype',
                        reverse: 'cars'
                    }
                }
            });
            collection.model('Person', {
                id: 'id',
                attributes: ['name', 'age']
            });

            collection.install(function(err) {
                assert.ok(err);
                done();
            });

        });
    });


});