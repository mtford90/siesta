var s = require('../core/index'),
    assert = require('chai').assert;


var Query = require('../core/query').Query,
    Collection = require('../core/collection').Collection;


describe.only('storage', function () {

    beforeEach(function (done) {
        s.reset(done);
    });

    describe('serialisation', function () {

        describe('attributes only', function () {
            var collection, Car;

            beforeEach(function (done) {
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

    describe('save', function () {
        var collection, Car;

        beforeEach(function (done) {
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

        it('new object', function (done) {
            assert.equal(1, s.ext.storage._unsavedObjects.length, 'Should be one car to save.');
            var car = s.ext.storage._unsavedObjects[0];
            siesta.save().then(function () {
                assert.equal(0, s.ext.storage._unsavedObjects.length, 'Should be no more cars');
                s.ext.storage._pouch.get(car._id).then(function (carDoc) {
                    assert.ok(carDoc);
                    assert.equal(carDoc._id, car._id, 'Should have same _id');
                    assert.equal(carDoc._rev, car._rev, 'Should have same revision');
                    assert.equal(carDoc.collection, 'myCollection');
                    assert.equal(carDoc.model, 'Car');
                    assert.equal(carDoc.colour, 'black');
                    assert.equal(carDoc.name, 'bentley');
                    assert.equal(carDoc.id, 2);
                    done();
                }).catch(done);
            }).catch(done).done();
        });

        it('update object', function (done) {
            assert.equal(1, s.ext.storage._unsavedObjects.length, 'Should be one car to save.');
            var car = s.ext.storage._unsavedObjects[0];
            siesta.save().then(function () {
                assert.equal(0, s.ext.storage._unsavedObjects.length, 'Should be no more cars');
                car.colour = 'blue';
                siesta.save().then(function () {
                    s.ext.storage._pouch.get(car._id).then(function (carDoc) {
                        assert.ok(carDoc);
                        assert.equal(carDoc._id, car._id, 'Should have same _id');
                        assert.equal(carDoc._rev, car._rev, 'Should have same revision');
                        assert.equal(carDoc.collection, 'myCollection');
                        assert.equal(carDoc.model, 'Car');
                        assert.equal(carDoc.colour, 'blue');
                        assert.equal(carDoc.name, 'bentley');
                        assert.equal(carDoc.id, 2);
                        done();
                    }).catch(done);
                }).catch(done).done();
            }).catch(done).done();
        })

    });

    describe('load', function () {
        describe('attributes only', function () {
            var collection, Car;

            beforeEach(function (done) {
                collection = new Collection('myCollection');
                Car = collection.model('Car', {
                    attributes: ['colour', 'name']
                });
                collection.install(done);
            });
            it('abc', function (done) {
                s.ext.storage._pouch.bulkDocs([
                    {collection: 'myCollection', model: 'Car', colour: 'red', name: 'Aston Martin'},
                    {collection: 'myCollection', model: 'Car', colour: 'black', name: 'Bentley'}
                ]).then(function () {
                    s.ext.storage._load().then(function () {
                        assert.notOk(s.ext.storage._unsavedObjects.length, 'Should not be anything to save, i.e. no notifications sent');
                        Car.all().execute().then(function (cars) {
                            assert.equal(cars.length, 2, 'Should have loaded the two cars');
                            var redCar = _.filter(cars, function (x) {return x.colour == 'red'})[0],
                                blackCar = _.filter(cars, function (x) {return x.colour == 'black'})[0];
                            assert.equal(redCar.colour, 'red');
                            assert.equal(redCar.name, 'Aston Martin');
                            assert.ok(redCar._rev);
                            assert.ok(redCar._id);
                            assert.equal(blackCar.colour, 'black');
                            assert.equal(blackCar.name, 'Bentley');
                            assert.ok(blackCar._rev);
                            assert.ok(blackCar._id);
                            done();
                        }).catch(done).done();
                    }).catch(done).done();
                }).catch(done);
            })
        });


    });

});