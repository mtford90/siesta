var s = require('../../index')
    , assert = require('chai').assert;

describe('intercoll relationships', function () {


    var SiestaModel = require('../../src/siestaModel').SiestaModel;
    var Collection = require('../../src/collection').Collection;
    var RelationshipType = require('../../src/relationship').RelationshipType;

    beforeEach(function () {
        s.reset(true);
    });

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

    describe('Inter-collection', function () {
        var anotherCollection;
        var obj;

        beforeEach(function (done) {
            configureAPI(RelationshipType.OneToMany, done);
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
                            type: RelationshipType.OneToMany,
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
                var person = obj.person;
                assert.instanceOf(person, SiestaModel);
                assert.equal(person.collection, 'myCollection');
                assert.equal(person.name, 'Michael');
                assert.equal(person.age, 23);
            });

            it('installs backwards', function () {
                var person = obj.person;
                assert.include(person.other, obj);
            });

        });
    });


});