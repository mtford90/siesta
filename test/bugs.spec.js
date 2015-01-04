/**
 * Random tests for bugs that crop up.
 *
 * TODO: All tests within this file need to be sorted and moved into appropriate specs.
 */

var s = require('../core/index'),
    assert = require('chai').assert;

describe('bugs', function () {
    beforeEach(function (done) {
        s.reset(done);
    });
    describe('ensure that mapping relationships using various methods works', function () {
        describe('ModelInstance', function () {
            describe('OneToOne', function () {
                it('forward', function (done) {
                    var Collection = s.collection('Collection'),
                        Person = Collection.model('Person', {
                            id: 'id',
                            attributes: ['name']
                        }),
                        Car = Collection.model('Car', {
                            id: 'id',
                            attributes: ['name'],
                            relationships: {
                                owner: {
                                    model: 'Person',
                                    type: 'OneToOne',
                                    reverse: 'car'
                                }
                            }
                        });
                    s.install()
                        .then(function () {
                            Person.map({name: 'Michael', id: 1})
                                .then(function (person) {
                                    Car.map({name: 'car', owner: person})
                                        .then(function (car) {
                                            assert.equal(car.owner, person);
                                            done();
                                        })
                                        .catch(done);
                                })
                                .catch(done);
                        })
                        .catch(done);
                });
                it('reverse', function (done) {
                    var Collection = s.collection('Collection'),
                        Person = Collection.model('Person', {
                            id: 'id',
                            attributes: ['name']
                        }),
                        Car = Collection.model('Car', {
                            id: 'id',
                            attributes: ['name'],
                            relationships: {
                                owner: {
                                    model: 'Person',
                                    type: 'OneToOne',
                                    reverse: 'car'
                                }
                            }
                        });
                    s.install()
                        .then(function () {
                            Car.map({name: 'car'})
                                .then(function (car) {
                                    Person.map({name: 'Michael', id: 1, car: car})
                                        .then(function (person) {
                                            assert.equal(person.car, car);
                                        })
                                        .catch(done);
                                    done();
                                })
                                .catch(done);
                        })
                        .catch(done);
                });
            });
            describe('OneToMany', function () {
                it('forward', function (done) {
                    var Collection = s.collection('Collection'),
                        Person = Collection.model('Person', {
                            id: 'id',
                            attributes: ['name']
                        }),
                        Car = Collection.model('Car', {
                            id: 'id',
                            attributes: ['name'],
                            relationships: {
                                owner: {
                                    model: 'Person',
                                    type: 'OneToMany',
                                    reverse: 'cars'
                                }
                            }
                        });
                    s.install()
                        .then(function () {
                            Person.map({name: 'Michael', id: 1})
                                .then(function (person) {
                                    Car.map({name: 'car', owner: person})
                                        .then(function (car) {
                                            assert.equal(car.owner, person);
                                            done();
                                        })
                                        .catch(done);
                                })
                                .catch(done);
                        })
                        .catch(done);
                });
                it('reverse', function (done) {
                    var Collection = s.collection('Collection'),
                        Person = Collection.model('Person', {
                            id: 'id',
                            attributes: ['name']
                        }),
                        Car = Collection.model('Car', {
                            id: 'id',
                            attributes: ['name'],
                            relationships: {
                                owner: {
                                    model: 'Person',
                                    type: 'OneToMany',
                                    reverse: 'cars'
                                }
                            }
                        });
                    s.install()
                        .then(function () {
                            Car.map([{name: 'car'}, {name: 'anotherCar'}])
                                .then(function (cars) {
                                    Person.map({name: 'Michael', id: 1, cars: cars})
                                        .then(function (person) {
                                            assert.include(person.cars, cars[0]);
                                            assert.include(person.cars, cars[1]);
                                            done();
                                        })
                                        .catch(done);
                                })
                                .catch(done);
                        })
                        .catch(done);
                });
            });
            describe('ManyToMany', function () {
                it('forward', function (done) {
                    var Collection = s.collection('Collection'),
                        Person = Collection.model('Person', {
                            id: 'id',
                            attributes: ['name']
                        }),
                        Car = Collection.model('Car', {
                            id: 'id',
                            attributes: ['name'],
                            relationships: {
                                owners: {
                                    model: 'Person',
                                    type: 'ManyToMany',
                                    reverse: 'cars'
                                }
                            }
                        });
                    s.install()
                        .then(function () {
                            Person.map([{name: 'Michael', id: 1}])
                                .then(function (people) {
                                    Car.map({name: 'car', owners: people})
                                        .then(function (car) {
                                            assert.include(car.owners, people[0]);
                                            done();
                                        })
                                        .catch(done);
                                })
                                .catch(done);
                        })
                        .catch(done);
                });
                it('reverse', function (done) {
                    var Collection = s.collection('Collection'),
                        Person = Collection.model('Person', {
                            id: 'id',
                            attributes: ['name']
                        }),
                        Car = Collection.model('Car', {
                            id: 'id',
                            attributes: ['name'],
                            relationships: {
                                owners: {
                                    model: 'Person',
                                    type: 'ManyToMany',
                                    reverse: 'cars'
                                }
                            }
                        });
                    s.install()
                        .then(function () {
                            Car.map([{name: 'car'}, {name: 'anotherCar'}])
                                .then(function (cars) {
                                    Person.map({name: 'Michael', id: 1, cars: cars})
                                        .then(function (person) {
                                            assert.include(person.cars, cars[0]);
                                            assert.include(person.cars, cars[1]);
                                            done();
                                        })
                                        .catch(done);
                                })
                                .catch(done);
                        })
                        .catch(done);
                });
            });

        });
    });
});