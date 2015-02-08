var  assert = require('chai').assert,
    internal = siesta._internal,
    cache = internal.cache;

describe('singleton mapping', function () {

    var Collection, Car;

    before(function () {
        siesta.ext.storageEnabled = false;
    });

    beforeEach(function (done) {
        siesta.reset(function () {
            Collection = siesta.collection('Car');
            Car = Collection.model('Car', {
                id: 'id',
                attributes: [
                    {name: 'colour', default: 'red'},
                    'name'
                ],
                singleton: true
            });
            done();
        });
    });

    it('should map onto the same singleton object, even if a different identifier', function (done) {
        Car.graph({
            colour: 'red',
            id: 5
        }).then(function (car) {
            assert.ok(car, 'Map should return a car...');
            Car.graph({
                colour: 'blue',
                id: 10
            }).then(function (car2) {
                assert.equal(car, car2);
                assert.equal(car.colour, 'blue');
                assert.equal(car.id, 10);
                done();
            }).catch(done);
        }).catch(done);
    });

    it('should map onto the same singleton object', function (done) {
        Car.graph({
            colour: 'red'
        }, function (err, car) {
            if (err) done(err);
            Car.graph({
                colour: 'blue'
            }, function (err, car2) {
                if (err) done(err);
                assert.equal(car, car2);
                assert.equal(car.colour, 'blue');
                done();
            });
        });
    });

    it('cache should return singleton', function (done) {
        Car.graph({
            colour: 'red',
            id: 5
        }, function (err, car) {
            if (err) done(err);
            var obj = cache.get({
                model: Car
            });
            assert.equal(obj, car);
            done();
        });
    });

    it('one should simply return the car', function (done) {
        Car.graph({
            colour: 'red',
            id: 5
        }, function (err, car) {
            if (err) done(err);
            Car.one(function (err, _car) {
                if (err) done(err);
                assert.equal(car, _car);
                done();
            });
        });
    });

    it('get should return an empty car, even if nothing has ever been mapped', function (done) {
        Car.one().then(function (car) {
            assert.ok(car);
            done();
        }).catch(done);
    });

    it('query should return an empty car, even if nothing has ever been mapped', function (done) {
        Car.query({}).then(function (cars) {
            assert.equal(cars.length, 1);
            done();
        }).catch(done);
    });

    it('all should return an empty car, even if nothing has ever been mapped', function (done) {
        Car.all().then(function (cars) {
            assert.equal(cars.length, 1);
            done();
        }).catch(done);
    });

    it('default attributes should work with singletons', function (done) {
        Car.one().then(function (car) {
            assert.ok(car);
            assert.equal(car.colour, 'red');
            done();
        }).catch(done);
    });

    describe('nested singletons', function () {
        var MoreComplicatedCollection, ParentConfig,
            FirstChildConfig, SecondChildConfig;
        beforeEach(function (done) {
            siesta.reset(function () {
                MoreComplicatedCollection = siesta.collection('MyCollection');
                ParentConfig = MoreComplicatedCollection.model('ParentConfig', {
                    relationships: {
                        settings: {
                            model: 'FirstChildConfig',
                            reverse: 'parent'
                        },
                        otherSettings: {
                            model: 'SecondChildConfig',
                            reverse: 'parent'
                        }
                    },
                    singleton: true
                });
                FirstChildConfig = MoreComplicatedCollection.model('FirstChildConfig', {
                    attributes: ['field1', 'field2'],
                    singleton: true
                });
                SecondChildConfig = MoreComplicatedCollection.model('SecondChildConfig', {
                    attributes: ['field3', 'field4'],
                    singleton: true
                });
                done();
            });
        });

        describe('relationships are automatically setup', function () {
            it('when mapped', function (done) {
                ParentConfig.graph({}).then(function (parent) {
                    assert.ok(parent);
                    assert.ok(parent.settings, 'should have created an instance for the first singleton child');
                    assert.ok(parent.otherSettings, 'should have created an instance for the second singleton child');
                    done();
                }).catch(done);
            });
            it('and the same is returned when queried', function (done) {
                ParentConfig.one().then(function (parent) {
                    FirstChildConfig.one().then(function (firstChild) {
                        SecondChildConfig.one().then(function (secondChild) {
                            assert.equal(parent.settings, firstChild);
                            assert.equal(parent.otherSettings, secondChild);
                            assert.equal(firstChild.parent, parent);
                            assert.equal(secondChild.parent, parent);
                            done();
                        }).catch(done);
                    }).catch(done);
                }).catch(done);
            })
        });


    });

    describe('methods', function () {
        var Pomodoro, PomodoroTimer;
        var initialised;
        beforeEach(function (done) {
            siesta.reset(function () {
                initialised = false;
                Pomodoro = siesta.collection('Pomodoro');
                PomodoroTimer = Pomodoro.model('PomodoroTimer', {
                    attributes: [
                        {
                            name: 'seconds',
                            default: 25 * 60
                        },
                        {
                            name: 'round',
                            default: 1
                        },
                        {
                            name: 'target',
                            default: 1
                        }
                    ],
                    init: function (fromStorage, cb) {
                        assert.notOk(fromStorage);
                        initialised = true;
                        this.poop = true;
                        cb();
                    },
                    singleton: true
                });
                siesta.install().then(function () {done()}).catch(done);
            });
        });
        it('instance exists', function (done) {
            PomodoroTimer.one()
                .then(function (timer) {
                    assert.ok(timer, 'the singleton instance should exist');
                    assert.ok(initialised, 'init should have been called');
                    assert.ok(timer.poop, 'attribute should have been set');
                    done();
                })
                .catch(done);
        })
    });

    describe('relationships', function () {
        var Person;

        describe('OneToOne', function () {
            it('with ordinary model', function (done) {
                siesta.reset(function () {
                    Collection = siesta.collection('Collection');
                    Car = Collection.model('Car', {
                        id: 'id',
                        attributes: [
                            'name'
                        ],
                        relationships: {
                            owner: {
                                type: 'OneToOne',
                                model: 'Person',
                                reverse: 'car'
                            }
                        },
                        singleton: true
                    });
                    Person = Collection.model('Person', {
                        id: 'id',
                        attributes: ['name']
                    });
                    Car.graph({name: 'Blah', owner: {name: 'Blah blah'}})
                        .then(function (car) {
                            assert.ok(car);
                            done();
                        })
                        .catch(done);
                });
            });


            it('with singleton model', function (done) {
                siesta.reset(function () {
                    Collection = siesta.collection('Collection');
                    Car = Collection.model('Car', {
                        id: 'id',
                        attributes: [
                            'name'
                        ],
                        relationships: {
                            owner: {
                                type: 'OneToOne',
                                model: 'Person',
                                reverse: 'car'
                            }
                        },
                        singleton: true
                    });
                    Person = Collection.model('Person', {
                        id: 'id',
                        attributes: ['name'],
                        singleton: true
                    });
                    Car.graph({name: 'Blah', owner: {name: 'Blah blah'}})
                        .then(function (car) {
                            assert.ok(car);
                            done();
                        })
                        .catch(done);
                });
            });
        });

        describe('ManyToMany', function () {
          
            it('should throw error with singleton model', function (done) {
                siesta.reset(function () {
                    Collection = siesta.collection('Collection');
                    Car = Collection.model('Car', {
                        id: 'id',
                        attributes: [
                            'name'
                        ],
                        relationships: {
                            owners: {
                                type: 'ManyToMany',
                                model: 'Person',
                                reverse: 'cars'
                            }
                        },
                        singleton: true
                    });
                    Person = Collection.model('Person', {
                        id: 'id',
                        attributes: ['name'],
                        singleton: true
                    });
                    siesta.install(function (err) {
                        assert.ok(err);
                        done();
                    })
                });
            });

        });

        describe('OneToMany', function () {
            it('with ordinary model', function (done) {
                siesta.reset(function () {
                    Collection = siesta.collection('Collection');
                    Car = Collection.model('Car', {
                        id: 'id',
                        attributes: [
                            'name'
                        ],
                        relationships: {
                            owner: {
                                type: 'OneToMany',
                                model: 'Person',
                                reverse: 'cars'
                            }
                        },
                        singleton: true
                    });
                    Person = Collection.model('Person', {
                        id: 'id',
                        attributes: ['name']
                    });
                    Car.graph({name: 'Blah', owner: {name: 'Blah blah'}})
                        .then(function (car) {
                            assert.ok(car);
                            assert.ok(car.owner);
                            done();
                        })
                        .catch(function (err) {
                            console.error(err);
                            done(err);
                        });
                });
            });

            it('with singleton model', function (done) {
                siesta.reset(function () {
                    Collection = siesta.collection('Collection');
                    Car = Collection.model('Car', {
                        id: 'id',
                        attributes: [
                            'name'
                        ],
                        relationships: {
                            owner: {
                                type: 'OneToMany',
                                model: 'Person',
                                reverse: 'cars'
                            }
                        },
                        singleton: true
                    });
                    Person = Collection.model('Person', {
                        id: 'id',
                        attributes: ['name'],
                        singleton: true
                    });
                    siesta.install(function (err) {
                        assert.ok(err);
                        done();
                    })
                });
            });

        });





    });



});