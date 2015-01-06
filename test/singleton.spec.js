var s = require('../core/index'),
    assert = require('chai').assert;

describe('singleton mapping', function () {

    var SiestaModel = require('../core/modelInstance'),
        cache = require('../core/cache');

    var Collection, Car;

    function CarObject() {
        SiestaModel.apply(this, arguments);
    }

    CarObject.prototype = Object.create(SiestaModel.prototype);
    before(function () {
        s.ext.storageEnabled = false;
    });

    beforeEach(function (done) {
        s.reset(function () {
            Collection = s.collection('Car');
            Car = Collection.model('Car', {
                id: 'id',
                attributes: [
                    {name: 'colour', default: 'red'},
                    'name'
                ],
                singleton: true
            });
            s.install(done);
        });
    });

    it('should map onto the same singleton object, even if a different identifier', function (done) {
        Car.map({
            colour: 'red',
            id: 5
        }).then(function (car) {
            assert.ok(car, 'Map should return a car...');
            Car.map({
                colour: 'blue',
                id: 10
            }).then(function (car2) {
                assert.equal(car, car2);
                assert.equal(car.colour, 'blue');
                assert.equal(car.id, 10);
                done();
            }).catch(done).done();
        }).catch(done).done()
    });

    it('should map onto the same singleton object', function (done) {
        Car.map({
            colour: 'red'
        }, function (err, car) {
            if (err) done(err);
            Car.map({
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
        Car.map({
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

    it('get should simply return the car', function (done) {
        Car.map({
            colour: 'red',
            id: 5
        }, function (err, car) {
            if (err) done(err);
            Car.one().execute(function (err, _car) {
                if (err) done(err);
                assert.equal(car, _car);
                done();
            });
        });
    });

    it('get should return an empty car, even if nothing has ever been mapped', function (done) {
        Car.one().execute().then(function (car) {
            assert.ok(car);
            done();
        }).catch(done);
    });

    it('query should return an empty car, even if nothing has ever been mapped', function (done) {
        Car.query({}).execute().then(function (cars) {
            assert.equal(cars.length, 1);
            done();
        }).catch(done);
    });

    it('all should return an empty car, even if nothing has ever been mapped', function (done) {
        Car.all().execute().then(function (cars) {
            assert.equal(cars.length, 1);
            done();
        }).catch(done);
    });

    it('default attributes should work with singletons', function (done) {
        Car.one().execute().then(function (car) {
            assert.ok(car);
            assert.equal(car.colour, 'red');
            done();
        }).catch(done);
    });

    describe('nested singletons', function () {
        var MoreComplicatedCollection, ParentConfig,
            FirstChildConfig, SecondChildConfig;
        beforeEach(function (done) {
            s.reset(function () {
                MoreComplicatedCollection = s.collection('MyCollection');
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
                s.install(done);
            });
        });

        it('relationships are automatically setup', function (done) {
            ParentConfig.one().execute().then(function (parent) {
                FirstChildConfig.one().execute().then(function (firstChild) {
                    SecondChildConfig.one().execute().then(function (secondChild) {
                        assert.equal(parent.settings, firstChild);
                        assert.equal(parent.otherSettings, secondChild);
                        assert.equal(firstChild.parent, parent);
                        assert.equal(secondChild.parent, parent);
                        done();
                    }).catch(done).done();
                }).catch(done).done();
            }).catch(done).done();
        })
    });

    describe('methods', function () {
        var Pomodoro, PomodoroTimer;
        beforeEach(function (done) {
            siesta.reset(function () {
                var initialised = false;
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
                    methods: {
                        __init: function (cb) {
                            initialised = true;
                            this.poop = true;
                            cb();
                        }
                    },
                    singleton: true
                });
                siesta.install()
                    .then(function () {
                        assert.ok(initialised, 'singleton instance should have been initialised...');
                        done();
                    }).
                    catch(done);
            });
        });
        it('instance exists', function (done) {
            PomodoroTimer.one()
                .execute()
                .then(function (timer) {
                    assert.ok(timer);
                    assert.ok(timer.poop);
                    done();
                })
                .catch(done);
        })
    });

    describe('relationships', function () {
        var Person;

        it('OneToOne', function (done) {
            s.reset(function () {
                Collection = s.collection('Collection');
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
                s.install(function () {
                    Car.map({name: 'Blah', owner: {name: 'Blah blah'}})
                        .then(function (car) {
                            assert.ok(car);
                            done();
                        })
                        .catch(done);
                });
            });
        });

        it('ManyToMany', function (done) {
            s.reset(function () {
                Collection = s.collection('Collection');
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
                    attributes: ['name']
                });
                s.install()
                    .then(function () {
                        Car.map({name: 'Blah', owners: [{name: 'Blah blah'}, {name: 'Michael'}]})
                            .then(function (car) {
                                assert.ok(car);
                                assert.equal(car.owners.length, 2);
                                done();
                            })
                            .catch(function (err) {
                                console.error(err);
                                done(err);
                            });
                    }).catch(function (err) {
                        console.error(err);
                        done(err);
                    });
            });
        });

        it('OneToMany', function (done) {
            s.reset(function () {
                Collection = s.collection('Collection');
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
                s.install()
                    .then(function () {
                        Car.map({name: 'Blah', owner: {name: 'Blah blah'}})
                            .then(function (car) {
                                assert.ok(car);
                                assert.ok(car.owner);
                                done();
                            })
                            .catch(function (err) {
                                console.error(err);
                                done(err);
                            });
                    }).catch(function (err) {
                        console.error(err);
                        done(err);
                    });
            });
        });



    });

});