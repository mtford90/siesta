var s = require('../core/index'),
    assert = require('chai').assert;

var SiestaModel = require('../core/siestaModel').SiestaModel
    , cache = require('../core/cache')
    , Collection = require('../core/collection').Collection;

describe.only('Subclass', function () {

    describe('hierarchy', function () {
        var collection, Car, SportsCar;

        beforeEach(function (done) {
            s.reset(true);
            collection = new Collection('myCollection');

            Car = collection.model('Car', {
                id: 'id',
                attributes: ['colour', 'name']
            });
            SportsCar = Car.child('SportsCar', {
                attributes: ['maxSpeed']
            });

            collection.install(done);
        });

        it('children', function () {
            assert.include(Car.children, SportsCar, 'Child should be added to children array');
        });

        it('parent', function () {
            assert.equal(SportsCar.parent, Car, 'Parent should be assigned');
        });

    });

    describe('attributes', function () {
        var collection, Car, SportsCar;

        beforeEach(function (done) {
            s.reset(true);
            collection = new Collection('myCollection');

            Car = collection.model('Car', {
                id: 'id',
                attributes: ['colour', 'name']
            });
            SportsCar = Car.child('SportsCar', {
                attributes: ['maxSpeed']
            });

            collection.install(done);
        });

        it('child attributes', function () {
            assert.include(SportsCar._attributeNames, 'maxSpeed');
            assert.include(SportsCar._attributeNames, 'colour');
            assert.include(SportsCar._attributeNames, 'name');
        });

        it('parent attributes', function () {
            assert.notInclude(Car._attributeNames, 'maxSpeed');
            assert.include(Car._attributeNames, 'colour');
            assert.include(Car._attributeNames, 'name');
        });
    });

    describe('query', function () {
        var collection, Car, SportsCar, SuperCar;

        beforeEach(function (done) {
            s.reset(true);
            collection = new Collection('myCollection');

            Car = collection.model('Car', {
                id: 'id',
                attributes: ['colour', 'name']
            });
            SportsCar = Car.child('SportsCar', {
                attributes: ['maxSpeed']
            });
            SuperCar = SportsCar.child('SuperCar', {
                attributes: ['attr']
            });

            collection.install()
                .then(Car.map({colour: 'red', name: 'Aston Martin'}))
                .then(SportsCar.map({colour: 'blue', maxSpeed: 160, name: 'Lamborghini'}))
                .then(SuperCar.map({colour: 'blue', maxSpeed: 160, name: 'Lamborghini', attr: 5}))
                .then(function () {done()})
                .catch(done)
                .done();
        });

        it('parent query', function (done) {
            Car.all()
                .execute()
                .then(function (cars) {
                    assert.equal(cars.length, 3, 'All descends should be returned');
                    done();
                })
                .catch(done)
                .done();
        });

        it('middle query', function (done) {
            SportsCar.all()
                .execute()
                .then(function (cars) {
                    assert.equal(cars.length, 2, 'Sports cars and super cars should be returned');
                    done();
                })
                .catch(done)
                .done();
        });

        it('child query', function (done) {
            SuperCar.all()
                .execute()
                .then(function (cars) {
                    assert.equal(cars.length, 1, 'Only the supercar should be returned');
                    done();
                })
                .catch(done)
                .done();
        });


    });

    describe('inspection', function () {

        var collection, Car, SportsCar, Person, SuperCar;

        beforeEach(function (done) {
            s.reset(true);
            collection = new Collection('myCollection');

            Car = collection.model('Car', {
                id: 'id',
                attributes: ['colour', 'name']
            });
            SportsCar = Car.child('SportsCar', {
                attributes: ['maxSpeed']
            });
            Person = collection.model('Person', {
                attributes: ['name']
            });
            SuperCar = SportsCar.child('SuperCar', {
                attributes: ['attr']
            });



            collection.install(done);
        });

        it('isChildOf', function () {
            assert.ok(SportsCar.isChildOf(Car));
            assert.ok(SuperCar.isChildOf(SportsCar));
            assert.notOk(SportsCar.isChildOf(Person));
            assert.notOk(Car.isChildOf(SportsCar));
            assert.notOk(SuperCar.isChildOf(Car));
        });

        it('isParentOf', function () {
            assert.ok(Car.isParentOf(SportsCar));
            assert.ok(SportsCar.isParentOf(SuperCar));
            assert.notOk(Car.isParentOf(SuperCar));
            assert.notOk(Car.isParentOf(Person));
            assert.notOk(SportsCar.isParentOf(Car));
            assert.notOk(SportsCar.isParentOf(Person));
        });

        it('isDescendantOf', function () {
            assert.ok(SportsCar.isDescendantOf(Car));
            assert.ok(SuperCar.isDescendantOf(SportsCar));
            assert.ok(SuperCar.isDescendantOf(Car));
            assert.notOk(Car.isDescendantOf(SuperCar));
            assert.notOk(Person.isDescendantOf(Car));
        });

    })


});