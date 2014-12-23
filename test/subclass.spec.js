var s = require('../core/index'),
    assert = require('chai').assert;

var SiestaModel = require('../core/siestaModel').SiestaModel
    , cache = require('../core/cache')
    , Collection = require('../core/collection').Collection;

describe('Subclass', function () {

    before(function () {
        s.ext.storageEnabled = false;
    });

    describe('hierarchy', function () {
        var collection, Car, SportsCar;



        beforeEach(function (done) {
            s.reset(function (){
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
            s.reset(function () {
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

    describe('relationships', function () {
        var collection, Car, SportsCar, Person;

        var mike;

        describe('names', function () {
            beforeEach(function (done) {
                s.reset(function () {
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
                    SportsCar = Car.child('SportsCar', {
                        attributes: ['maxSpeed']
                    });
                    Person = collection.model('Person', {
                        attributes: ['age', 'name']
                    });

                    collection.install(done);
                });
            });
            it('child attributes', function () {
                assert.include(SportsCar._relationshipNames, 'owner');
            });

            it('parent attributes', function () {
                assert.include(Car._relationshipNames, 'owner');
            });

        });

        describe('relationship types', function () {

            describe('OneToMany', function () {
                beforeEach(function (done) {
                    s.reset(function () {
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
                        SportsCar = Car.child('SportsCar', {
                            attributes: ['maxSpeed']
                        });
                        Person = collection.model('Person', {
                            attributes: ['age', 'name']
                        });

                        collection.install()
                            .then(Person.map({age: 24, name: 'Mike'}).then(function (_mike) {
                                mike = _mike;
                                Car.map({colour: 'red', name: 'Aston Martin', owner: {_id: mike._id}})
                                    .then(SportsCar.map({colour: 'yellow', name: 'Lamborghini', maxSpeed: 160, owner: {_id: mike._id}}))
                                    .then(function () {
                                        done();
                                    })
                                    .catch(done)
                                    .done();
                            })
                        ).catch(done).done();
                    });


                });

                it('same relationship', function () {
                    assert.ok(mike);
                    assert.equal(mike.cars.length, 2);
                    var car = _.filter(mike.cars, function (x) {return x.mapping == Car})[0]
                        , sportsCar = _.filter(mike.cars, function (x) {return x.mapping == SportsCar})[0];
                    assert.ok(car);
                    assert.ok(sportsCar);
                    assert.equal(car.owner, mike);
                    assert.equal(sportsCar.owner, mike);
                });
            });

            describe('OneToOne', function () {
                beforeEach(function (done) {
                    s.reset(function () {
                        collection = new Collection('myCollection');
                        Car = collection.model('Car', {
                            attributes: ['colour', 'name'],
                            relationships: {
                                owner: {
                                    mapping: 'Person',
                                    type: 'OneToOne',
                                    reverse: 'car'
                                }
                            }
                        });
                        SportsCar = Car.child('SportsCar', {
                            attributes: ['maxSpeed']
                        });
                        Person = collection.model('Person', {
                            attributes: ['age', 'name']
                        });

                        collection.install()
                            .then(Person.map({age: 24, name: 'Mike'}).then(function (_mike) {
                                mike = _mike;
                                Car.map({colour: 'red', name: 'Aston Martin', owner: {_id: mike._id}})
                                    .then(SportsCar.map({colour: 'yellow', name: 'Lamborghini', maxSpeed: 160, owner: {_id: mike._id}}))
                                    .then(function () {
                                        done();
                                    })
                                    .catch(done)
                                    .done();
                            })
                        ).catch(done).done();
                    });


                });

                it('same relationship', function (done) {
                    assert.ok(mike);
                    assert.ok(mike.car.isInstanceOf(SportsCar));
                    assert.equal(mike.car.owner, mike);
                    Car.all().execute().then(function (cars) {
                        var car = _.filter(cars, function (x) {return x.mapping == Car})[0]
                            , sportsCar = _.filter(cars, function (x) {return x.mapping == SportsCar})[0];
                        assert.ok(car);
                        assert.ok(sportsCar);
                        assert.notOk(car.owner, 'The plain car should no longer have an owner');
                        done();
                    });
                });
            });

            describe('ManyToMany', function () {
                beforeEach(function (done) {
                    s.reset(function () {
                        collection = new Collection('myCollection');
                        Car = collection.model('Car', {
                            attributes: ['colour', 'name'],
                            relationships: {
                                owners: {
                                    mapping: 'Person',
                                    type: 'ManyToMany',
                                    reverse: 'cars'
                                }
                            }
                        });
                        SportsCar = Car.child('SportsCar', {
                            attributes: ['maxSpeed']
                        });
                        Person = collection.model('Person', {
                            attributes: ['age', 'name']
                        });

                        collection.install()
                            .then(Person.map({age: 24, name: 'Mike'}).then(function (_mike) {
                                mike = _mike;
                                Car.map({colour: 'red', name: 'Aston Martin', owners: [{_id: mike._id}]})
                                    .then(SportsCar.map({colour: 'yellow', name: 'Lamborghini', maxSpeed: 160, owners: [{_id: mike._id}]}))
                                    .then(function () {
                                        done();
                                    })
                                    .catch(done)
                                    .done();
                            })
                        ).catch(done).done();
                    });

                });

                it('same relationship', function () {
                    assert.ok(mike);
                    assert.equal(mike.cars.length, 2);
                    var car = _.filter(mike.cars, function (x) {return x.mapping == Car})[0]
                        , sportsCar = _.filter(mike.cars, function (x) {return x.mapping == SportsCar})[0];
                    assert.ok(car);
                    assert.ok(sportsCar);
                    assert.include(car.owners, mike);
                    assert.include(sportsCar.owners, mike);
                });
            });



        });


    });

    describe('query', function () {
        var collection, Car, SportsCar, SuperCar;

        beforeEach(function (done) {
            s.reset(function () {
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
            s.reset(function () {
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

        it('isAncestorOf', function () {
            assert.ok(Car.isAncestorOf(SportsCar));
            assert.ok(Car.isAncestorOf(SuperCar));
            assert.ok(SportsCar.isAncestorOf(SuperCar));
            assert.notOk(SuperCar.isAncestorOf(SportsCar));
            assert.notOk(SuperCar.isAncestorOf(Person));
        });

        it('isInstanceOf', function (done) {
            SuperCar.map({colour: 'red', name: 'lamborghini', attr: 1})
                .then(function (car) {
                    assert.ok(car.isInstanceOf(SuperCar));
                    assert.ok(car.isInstanceOf(SportsCar));
                    assert.ok(car.isInstanceOf(Car));
                    assert.notOk(car.isInstanceOf(Person));
                    done();
                })
                .catch(done)
                .done();
        });


    })


});