var assert = require('chai').assert,
    internal = siesta._internal,
    SiestaUserError = internal.error.SiestaUserError,
    createQuerySet = internal.querySet;

describe('query sets', function () {

    before(function () {
        siesta.ext.storageEnabled = false;
    });

    beforeEach(function (done) {
        siesta.reset(done);
    });

    describe('attributes', function () {
        var querySet, Collection, Person;
        var michael, bob;
        beforeEach(function (done) {
            Collection = siesta.collection('myCollection');
            Person = Collection.model('Person', {
                id: 'id',
                attributes: ['name', 'age']
            });
            siesta.install(function () {
                michael = Person._new({name: 'Michael', age: 24});
                bob = Person._new({name: 'Bob', age: 21});
                querySet = createQuerySet([michael, bob], Person);
                done();
            });
        });

        it('contains the instances', function () {
            assert.include(querySet, michael);
            assert.include(querySet, bob);
        });

        it('contains the ages', function () {
            var ages = querySet.age;
            assert.include(ages, michael.age);
            assert.include(ages, bob.age);
        });

        it('can set ages', function () {
            var michaelsNewAge = 25,
                bobsNewAge = 28;
            querySet.age = [michaelsNewAge, bobsNewAge];
            assert.equal(michael.age, michaelsNewAge);
            assert.equal(bob.age, bobsNewAge);
        });

        it('should throw an error if attempt to set with a diff. length array', function () {
            assert.throws(function () {
                querySet.age = [1, 2, 3];
            }, SiestaUserError);
        });

        it('can set a single age', function () {
            var newAge = 25;
            querySet.age = newAge;
            assert.equal(michael.age, newAge);
            assert.equal(bob.age, newAge);
        });

        it('uppercase all names', function () {
            var nameQuerySet = querySet.name;
            assert.include(nameQuerySet, 'Michael');
            assert.include(nameQuerySet, 'Bob');
            querySet.name = nameQuerySet.toUpperCase();
            assert.equal(michael.name, 'MICHAEL');
            assert.equal(bob.name, 'BOB');
        });

        it('uppercase then lowercase all names', function () {
            var nameQuerySet = querySet.name;
            assert.include(nameQuerySet, 'Michael');
            assert.include(nameQuerySet, 'Bob');
            var upper = nameQuerySet.toUpperCase();
            querySet.name = upper.toLowerCase();
            assert.equal(michael.name, 'michael');
            assert.equal(bob.name, 'bob');
        });

    });

    describe('relationships', function () {
        var Collection, Person, Car;
        var michael, bob;
        beforeEach(function (done) {
            Collection = siesta.collection('myCollection');
            Person = Collection.model('Person', {
                attributes: ['name', 'age']
            });
            Car = Collection.model('Car', {
                attributes: ['colour'],
                relationships: {
                    owner: {
                        model: 'Person',
                        reverse: 'cars'
                    }
                }
            });
            siesta.install(function () {
                michael = Person._new({name: 'Michael', age: 24});
                bob = Person._new({name: 'Bob', age: 21});
                michael.cars = [Car._new({colour: 'red'}), Car._new({colour: 'blue'})];

                done();
            });

        });

        it('new owner', function () {
            var querySet = createQuerySet(michael.cars, Car);
            querySet.owner = bob;
            assert.equal(bob.cars.length, 2);
            assert.equal(michael.cars.length, 0)
        });

        it('remove all cars', function (done) {
            var cars = _.extend([], michael.cars),
                querySet = createQuerySet(cars, Car);

            querySet.remove().then(function () {
                siesta.notify(function () {
                    cars.forEach(function (c) {
                        assert.ok(c.removed);
                    });
                    assert.equal(bob.cars.length, 0);
                    assert.equal(michael.cars.length, 0);
                    done();
                });
            });
        })
    });

});