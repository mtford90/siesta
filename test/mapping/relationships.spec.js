var s = require('../../index')
    , assert = require('chai').assert;

describe('mapping relationships', function () {



    var RestObject =  require('../../src/object').RestObject;

        var Collection =  require('../../src/collection').Collection;
        var RestError =  require('../../src/error').RestError;
        var RelationshipType =  require('../../src/relationship').RelationshipType;

        var ForeignKeyRelationship =  require('../../src/foreignKeyRelationship').ForeignKeyRelationship;

       var OneToOneRelationship =  require('../../src/oneToOneRelationship').OneToOneRelationship;


    beforeEach(function () {
        s.reset(true);
    });

    describe('valid', function () {
        var collection, carMapping, personMapping;

        function configureAPI(type, done) {
            collection = new Collection('myCollection');
            carMapping = collection.mapping('Car', {
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
            personMapping = collection.mapping('Person', {
                id: 'id',
                attributes: ['name', 'age']
            });
            collection.install(done);
        }

        describe('Foreign Key', function () {

            beforeEach(function (done) {
                configureAPI(RelationshipType.ForeignKey, function (err) {
                    if (err) done(err);
                    done();
                });
            });

            it('one relationship in car mapping', function () {
                var carRelationships = carMapping.relationships;
                assert.equal(carRelationships.length, 1);
            });

            it('one relationship in person mapping', function () {
                var personRelationships = personMapping.relationships;
                assert.equal(personRelationships.length, 1);
            });

            it('relationship in car and person mapping are the same', function () {
                var carRelationships = carMapping.relationships;
                var personRelationships = personMapping.relationships;
                assert.equal(carRelationships[0], personRelationships[0]);
            });

            it('is a foreign key relationship', function () {
                var carRelationships = carMapping.relationships;
                var r = carRelationships[0];
                    assert.instanceOf(r, ForeignKeyRelationship);
            });

            it('forward mapping is the car mapping', function () {
                var carRelationships = carMapping.relationships;
                var r = carRelationships[0];
                assert.equal(r.mapping, carMapping);
            });

            it('reverse mapping is the person mapping', function () {
                var carRelationships = carMapping.relationships;
                var r = carRelationships[0];
                assert.equal(r.reverseMapping, personMapping);
            });

        });

        describe('OneToOne', function () {

            beforeEach(function (done) {
                configureAPI(RelationshipType.OneToOne, function (err) {
                    if (err) done(err);
                    done();
                });
            });

            it('one relationship in car mapping', function () {
                var carRelationships = carMapping.relationships;
                assert.equal(carRelationships.length, 1);
            });

            it('one relationship in person mapping', function () {
                var personRelationships = personMapping.relationships;
                assert.equal(personRelationships.length, 1);
            });

            it('relationship in car and person mapping are the same', function () {
                var carRelationships = carMapping.relationships;
                var personRelationships = personMapping.relationships;
                assert.equal(carRelationships[0], personRelationships[0]);
            });

            it('is a one-to-one key relationship', function () {
                var carRelationships = carMapping.relationships;
                var r = carRelationships[0];
                    assert.instanceOf(r, OneToOneRelationship);
            });

            it('forward mapping is the car mapping', function () {
                var carRelationships = carMapping.relationships;
                var r = carRelationships[0];
                assert.equal(r.mapping, carMapping);
            });

            it('reverse mapping is the person mapping', function () {
                var carRelationships = carMapping.relationships;
                var r = carRelationships[0];
                assert.equal(r.reverseMapping, personMapping);
            });


        });

        describe('Inter-collection', function () {
            var anotherCollection;
            var obj;

            beforeEach(function (done) {
                configureAPI(RelationshipType.ForeignKey, done);
            });

            afterEach(function () {
                anotherCollection = undefined;
                obj = undefined;
            });

            describe('foreign key', function () {
                beforeEach(function (done) {
                    anotherCollection = new Collection('anotherCollection');

                    anotherCollection.mapping('AnotherMapping', {
                        attributes: ['field'],
                        relationships: {
                            person: {
                                mapping: 'myCollection.Person',
                                type: RelationshipType.ForeignKey,
                                reverse: 'other'
                            }
                        }
                    });

                    anotherCollection.install(function (err) {
                        if (err) done(err);
                        anotherCollection['AnotherMapping'].map({field: 5, person: {name: 'Michael', age: 23, id: 'xyz'}}, function (err, _obj) {
                            if (err) done(err);
                            obj = _obj;
                            done();
                        });
                    });

                });

                it('installs forward', function () {
                    var person = obj.person.relatedObject;
                    assert.instanceOf(person, RestObject);
                    assert.equal(person.collection, 'myCollection');
                    assert.equal(person.name, 'Michael');
                    assert.equal(person.age, 23);
                });

                it('installs backwards', function () {
                    var person = obj.person.relatedObject;
                    assert.include(person.other.relatedObject, obj);
                });

            });
        });
    });

    describe('invalid', function () {
        it('No such mapping', function (done) {
            var collection = new Collection('myCollection');
            collection.mapping('Car', {
                id: 'id',
                attributes: ['colour', 'name'],
                relationships: {
                    owner: {
                        mapping: 'asd',
                        type: RelationshipType.ForeignKey,
                        reverse: 'cars'
                    }
                }
            });
            collection.install(function (err) {
                assert.instanceOf(err, RestError);
                done();
            });
        });

        it('No such relationship type', function (done) {
            var collection = new Collection('myCollection');
            collection.mapping('Car', {
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
            collection.mapping('Person', {
                id: 'id',
                attributes: ['name', 'age']
            });

            collection.install(function (err) {
                assert.instanceOf(err, RestError);
                done();
            });

        });
    });


});