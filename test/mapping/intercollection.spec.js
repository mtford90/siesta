var s = require('../../core/index'),
    assert = require('chai').assert;

describe('intercoll relationships', function () {

    var SiestaModel = require('../../core/modelInstance'),
        RelationshipType = require('../../core/RelationshipType');

    before(function () {
        s.ext.storageEnabled = false;
    });

    beforeEach(function (done) {
        s.reset(done);
    });

    var Collection, Car, Person;

    function configureAPI(type, done) {
        Collection = s.collection('myCollection');
        Car = Collection.model('Car', {
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
        Person = Collection.model('Person', {
            id: 'id',
            attributes: ['name', 'age']
        });
        s.install(done);
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
                    anotherCollection['AnotherMapping'].map({
                        field: 5,
                        person: {name: 'Michael', age: 23, id: 'xyz'}
                    }, function (err, _obj) {
                        if (err) done(err);
                        obj = _obj;
                        done();
                    });
                });

            });

            it('installs forward', function () {
                var person = obj.person;
                assert.instanceOf(person, SiestaModel);
                assert.equal(person.collectionName, 'myCollection');
                assert.equal(person.collection, Collection);
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