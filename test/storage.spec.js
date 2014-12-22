var s = require('../core/index'),
    assert = require('chai').assert;


var Query = require('../core/query').Query
    , Collection = require('../core/collection').Collection;

describe('storage', function () {

    beforeEach(function () {
        s.reset(true);
    });

    describe('serialisation', function () {

        describe('attributes only', function () {
            var collection, Car;

            beforeEach(function (done) {
                s.reset(true);
                collection = new Collection('myCollection');
                Car = collection.model('Car', {
                    attributes: ['colour', 'name']
                });
                collection.install(done);
            });

            it('storage', function (done) {
                Car.map({colour: 'black', name: 'bentley', id: 2})
                    .then(function (car) {
                        car._rev = '123'; //Fake pouchdb revision.
                        var serialised = s.ext.storage._serialise(car);
                        assert.equal(serialised.colour, 'black');
                        assert.equal(serialised.name, 'bentley');
                        assert.equal(serialised.id, 2);
                        assert.equal(serialised._id, car._id);
                        assert.equal(serialised.collection, 'myCollection');
                        assert.equal(serialised.model, 'Car');
                        assert.equal(serialised._rev, car._rev);
                        done();
                    })
                    .catch(done)
                    .done();
            });
        });

        describe('relationships', function () {
            var collection, Car, Person;

            beforeEach(function (done) {
                s.reset(true);
                collection = new Collection('myCollection');
                Car = collection.model('Car', {
                    attributes: ['colour', 'name'],
                    relationships: {
                        owner: {
                            mapping: 'Person',
                            type: 'OneToMany',
                            reverse: 'cars'
                        }
                    }
                });
                Person = collection.model('Person', {
                    attributes: ['age', 'name']

                });
                collection.install(done);
            });

            it('onetomany', function (done) {
                Person.map({name: 'Michael', age: 24}).then(function (person) {
                    Car.map({colour: 'black', name: 'bentley', id: 2, owner: {_id: person._id}})
                        .then(function (car) {
                            var serialisedCar = s.ext.storage._serialise(car);
                            assert.equal(serialisedCar.colour, 'black');
                            assert.equal(serialisedCar.name, 'bentley');
                            assert.equal(serialisedCar.id, 2);
                            assert.equal(serialisedCar._id, car._id);
                            assert.equal(serialisedCar.collection, 'myCollection');
                            assert.equal(serialisedCar.owner, person._id);
                            assert.equal(serialisedCar.model, 'Car');
                            var serialisedPerson = s.ext.storage._serialise(person);
                            assert.equal(serialisedPerson.name, 'Michael');
                            assert.equal(serialisedPerson.age, 24);
                            assert.include(serialisedPerson.cars, car._id);
                            assert.equal(serialisedPerson.collection, 'myCollection');
                            assert.equal(serialisedPerson.model, 'Person');
                            done();
                        })
                        .catch(done)
                        .done();
                }).catch(done).done();

            });
        });

    });

    describe.only('save', function () {
        var collection, Car;

        beforeEach(function (done) {
            s.reset(true);
            collection = new Collection('myCollection');
            Car = collection.model('Car', {
                attributes: ['colour', 'name']
            });
            collection.install()
                .then(Car.map({colour: 'black', name: 'bentley', id: 2}))
                .then(done)
                .catch(done)
                .done();
        });

        it('save', function (done) {
            assert.equal(1, s.ext.storage._unsavedObjects.length, 'Should be one car to save.');
            var car = s.ext.storage._unsavedObjects[0];
            siesta.save().then(function () {
                assert.equal(0, s.ext.storage._unsavedObjects.length, 'Should be no more cars');
                done();
            }).catch(done).done();
        })
    })

});