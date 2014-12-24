var s = require('../../core/index')
    , assert = require('chai').assert;

describe('intercoll relationships', function () {


    var SiestaModel = require('../../core/modelInstance').ModelInstance;
    var Collection = require('../../core/collection').Collection;
    var RelationshipType = require('../../core/relationship').RelationshipType;

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
                anotherCollection = s.collection('anotherCollection');

                anotherCollection.model('AnotherMapping', {
                    attributes: ['field'],
                    relationships: {
                        person: {
                            model: 'myCollection.Person',
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