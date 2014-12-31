var s = require('../core/index'),
    assert = require('chai').assert;

describe('mapping relationships', function () {


    var Collection = require('../core/collection');
    var InternalSiestaError = require('../core/error').InternalSiestaError;
    var RelationshipType = require('../core/RelationshipType');
    before(function () {
        s.ext.storageEnabled = false;
    });

    beforeEach(function (done) {
        s.reset(done);
    });

    var collection, carMapping, personMapping;

    function configureAPI(type, done) {
        collection = s.collection('myCollection');
        carMapping = collection.model('Car', {
            id: 'id',
            attributes: ['colour', 'name'],
            relationships: {
                owner: {
                    model: 'Person',
                    type: type,
                    reverse: 'cars'
                }
            }
        });
        personMapping = collection.model('Person', {
            id: 'id',
            attributes: ['name', 'age']
        });
        s.install(done);
    }

    describe('valid', function () {


        describe('Foreign Key', function () {

            beforeEach(function (done) {
                configureAPI(RelationshipType.OneToMany, function (err) {
                    if (err) done(err);
                    done();
                });
            });

            it('configures reverse mapping', function () {
                assert.equal(carMapping.relationships.owner.reverseModel, personMapping);
            });

            it('configures reverse name', function () {
                assert.equal(carMapping.relationships.owner.reverseName, 'cars');

                it('configures forward mapping', function () {
                    assert.equal(carMapping.relationships.owner.forwardModel, carMapping);
                });

            });
            it('configures forward name', function () {
                assert.equal(carMapping.relationships.owner.forwardName, 'owner');
            });

            it('installs on reverse', function () {
                var keys = Object.keys(personMapping.relationships.cars);
                for (var i = 0; i < keys.length; i++) {
                    var key = keys[i];
                    if (key != 'isForward' && key != 'isReverse') {
                        assert.equal(personMapping.relationships.cars[key], carMapping.relationships.owner[key]);
                    }
                }
            });


        });

        describe('OneToOne', function () {

            beforeEach(function (done) {
                configureAPI(RelationshipType.OneToOne, function (err) {
                    if (err) done(err);
                    done();
                });


            });
            it('configures reverse mapping', function () {
                assert.equal(carMapping.relationships.owner.reverseModel, personMapping);
            });

            it('configures reverse name', function () {
                assert.equal(carMapping.relationships.owner.reverseName, 'cars');


            });

            it('configures forward mapping', function () {
                assert.equal(carMapping.relationships.owner.forwardModel, carMapping);
            });
            it('configures forward name', function () {
                assert.equal(carMapping.relationships.owner.forwardName, 'owner');
            });

            it('installs on reverse', function () {
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


    describe('invalid', function () {
        it('No such mapping', function (done) {
            var collection = s.collection('myCollection');
            collection.model('Car', {
                id: 'id',
                attributes: ['colour', 'name'],
                relationships: {
                    owner: {
                        model: 'asd',
                        type: RelationshipType.OneToMany,
                        reverse: 'cars'
                    }
                }
            });
            s.install(function (err) {
                assert.ok(err);
                done();
            });
        });

        it('No such relationship type', function (done) {
            var collection = s.collection('myCollection');
            collection.model('Car', {
                id: 'id',
                attributes: ['colour', 'name'],
                relationships: {
                    owner: {
                        model: 'Person',

                        type: 'invalidtype',
                        reverse: 'cars'
                    }
                }
            });
            collection.model('Person', {
                id: 'id',
                attributes: ['name', 'age']
            });

            s.install(function (err) {
                assert.ok(err);
                done();
            });

        });
    });


});