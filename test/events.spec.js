var s = require('../core/index'),
    assert = require('chai').assert;

describe('events', function () {

    before(function () {
        s.ext.storageEnabled = false;
    });

    var ModelEventType = require('../core/modelEvents').ModelEventType,
        util = require('../core/util'),
        events = require('../core/events'),
        RelationshipType = require('../core/RelationshipType');

    beforeEach(function (done) {
        s.reset(done);
    });

    var Collection, Car, Person, car;
    var event, collectionEvent, genericEvent, localIdEvent, remoteIdEvent;

    describe('basics', function () {
        it('simple emissions work', function (done) {
            events.once('blah', function () {
                done();
            });
            events.emit('blah');
        });

        it('emissions with payloads work', function (done) {
            var p = {};
            events.once('blah', function (payload) {
                assert.equal(payload, p);
                done();
            });
            events.emit('blah', p);
        });
    });

    describe('attributes', function () {
        afterEach(function () {
            event = null;
            collectionEvent = null;
            genericEvent = null;
            car = null;
            Collection = null;
            Car = null;
        });

        describe('set value', function () {

            beforeEach(function (done) {
                Collection = s.collection('myCollection');
                Car = Collection.model('Car', {
                    id: 'id',
                    attributes: ['colour', 'name']
                });
                Car.map({
                    colour: 'red',
                    name: 'Aston Martin',
                    id: 'xyz'
                }, function (err, _car) {
                    if (err) {
                        done(err);
                    } else {
                        car = _car;

                        function checkDone() {
                            if (event &&
                                genericEvent &&
                                collectionEvent &&
                                localIdEvent &&
                                remoteIdEvent) {
                                done();
                            }
                        }

                        s.once('myCollection:Car', function (n) {
                            event = n;
                            checkDone();
                        });
                        s.once('myCollection', function (n) {
                            collectionEvent = n;
                            checkDone();
                        });
                        s.once('Siesta', function (n) {
                            genericEvent = n;
                            checkDone();
                        });
                        s.once(_car._id, function (n) {
                            localIdEvent = n;
                            checkDone();
                        });
                        s.once('myCollection:Car:xyz', function (n) {
                            remoteIdEvent = n;
                            checkDone();
                        });
                        car.colour = 'blue';
                    }
                });

            });

            it('all notifs equal', function () {
                assert.equal(event, genericEvent);
                assert.equal(genericEvent, collectionEvent);
                assert.equal(collectionEvent, localIdEvent);
                assert.equal(localIdEvent, remoteIdEvent);
            });

            it('notif contains collection', function () {
                assert.equal(event.collection, 'myCollection');
            });

            it('notif contains mapping', function () {
                assert.equal(event.model, 'Car');
            });

            it('changeDict contains attribute name', function () {
                assert.equal(event.field, 'colour');
            });

            it('changeDict contains change type', function () {
                assert.equal(event.type, ModelEventType.Set);
            });

            it('changeDict contains old value', function () {
                assert.equal(event.old, 'red');
            });

            it('changeDict contains new value', function () {
                assert.equal(event.new, 'blue');
            });

            it('changeDict contains new value', function () {
                assert.equal(event._id, car._id);
            });

        });

        describe('array events', function () {
            beforeEach(function () {
                Collection = s.collection('myCollection');
                Car = Collection.model('Car', {
                    id: 'id',
                    attributes: ['colours', 'name']
                });
            });

            it('sends events for all levels', function (done) {
                var notifs = [];
                Car.map({
                    colours: ['red', 'blue'],
                    name: 'Aston Martin',
                    id: 'xyz'
                }, function (err, _car) {
                    car = _car;
                    if (err) done(err);
                    var listener = function (n) {
                        notifs.push(n);
                        if (notifs.length >= 5) {
                            done();
                        }
                    };
                    s.once('myCollection:Car', listener);
                    s.once('myCollection', listener);
                    s.once('Siesta', listener);
                    s.once(_car._id, listener);
                    s.once('myCollection:Car:xyz', listener);
                    car.colours.push('green');
                    s.notify();
                });
            });

            describe('push', function () {
                beforeEach(function (done) {
                    Car.map({
                        colours: ['red', 'blue'],
                        name: 'Aston Martin',
                        id: 'xyz'
                    }, function (err, _car) {
                        car = _car;
                        if (err) done(err);
                        s.once('myCollection:Car', function (n) {
                            event = n;
                            done();
                        });
                        car.colours.push('green');
                        s.notify();
                    });
                });

                it('notif contains collection', function () {
                    assert.equal(event.collection, 'myCollection');
                });

                it('notif contains mapping', function () {
                    assert.equal(event.model, 'Car');
                });

                it('notif contains object', function () {
                    assert.equal(event._id, car._id);
                });

                it('changeDict contains change', function () {
                    assert.equal(event.field, 'colours');
                    assert.equal(event.type, ModelEventType.Splice);
                    assert.equal(event.index, 2);
                    assert.equal(event.removed.length, 0);
                    assert.equal(event.added.length, 1);
                });

            });

            describe('pop', function () {
                beforeEach(function (done) {
                    Car.map({
                        colours: ['red', 'blue'],
                        name: 'Aston Martin',
                        id: 'xyz'
                    }, function (err, _car) {
                        car = _car;
                        if (err) done(err);
                        s.once('myCollection:Car', function (n) {
                            event = n;
                            done();
                        });
                        car.colours.pop();
                        s.notify();
                    });
                });

                it('notif contains collection', function () {
                    assert.equal(event.collection, 'myCollection');
                });

                it('notif contains mapping', function () {
                    assert.equal(event.model, 'Car');
                });

                it('notif contains _id', function () {
                    assert.equal(event._id, car._id);
                });

                it('notif contains change', function () {
                    assert.equal(event.field, 'colours');
                    assert.equal(event.type, ModelEventType.Splice);
                    assert.equal(event.index, 1);
                    assert.equal(event.removed.length, 1);
                    assert.include(event.removed, 'blue');
                    assert.equal(event.added.length, 0);
                });
            });

            describe('shift', function () {
                beforeEach(function (done) {
                    Car.map({
                        colours: ['red', 'blue'],
                        name: 'Aston Martin',
                        id: 'xyz'
                    }, function (err, _car) {
                        car = _car;
                        if (err) done(err);
                        s.once('myCollection:Car', function (n) {
                            event = n;
                            done();
                        });
                        car.colours.shift();
                        s.notify();
                    });
                });

                it('notif contains collection', function () {
                    assert.equal(event.collection, 'myCollection');
                });

                it('notif contains mapping', function () {
                    assert.equal(event.model, 'Car');
                });

                it('notif contains id', function () {
                    assert.equal(event._id, car._id);
                });

                it('notif contains change', function () {
                    assert.equal(event.field, 'colours');
                    assert.equal(event.type, ModelEventType.Splice);
                    assert.equal(event.index, 0);
                    assert.equal(event.removed.length, 1);
                    assert.include(event.removed, 'red');
                    assert.equal(event.added.length, 0);

                });


            });

            describe('unshift', function () {
                beforeEach(function (done) {
                    Car.map({
                        colours: ['red', 'blue'],
                        name: 'Aston Martin',
                        id: 'xyz'
                    }, function (err, _car) {
                        car = _car;

                        s.once('myCollection:Car', function (n) {
                            event = n;
                            done();
                        });
                        car.colours.unshift('green');
                        s.notify();
                    });

                });

                it('notif contains type', function () {
                    assert.equal(event.collection, 'myCollection');
                });

                it('notif contains mapping', function () {
                    assert.equal(event.model, 'Car');
                });

                it('notif contains object', function () {
                    assert.equal(event._id, car._id);
                });

                it('notif contains change', function () {
                    assert.equal(event.field, 'colours');
                    assert.equal(event.type, ModelEventType.Splice);
                    assert.equal(event.index, 0);
                    assert.equal(event.removed.length, 0);
                    assert.equal(event.added.length, 1);
                });

            });

            describe('sort', function () {
                var notifs = [];

                beforeEach(function (done) {
                    notifs = [];
                    Car.map({
                        colours: ['red', 'green', 'blue'],
                        name: 'Aston Martin',
                        id: 'xyz'
                    }, function (err, _car) {
                        car = _car;
                        if (err) done(err);
                        var listener = function (n) {
                            notifs.push(n);
                            if (notifs.length == 2) {
                                s.removeListener('myCollection:Car', listener);
                                done();
                            }
                        };
                        s.on('myCollection:Car', listener);
                        car.colours.sort();
                        s.notify();
                    });
                });

                it('notif contains colleciton', function () {
                    _.each(notifs, function (notif) {
                        assert.equal(notif.collection, 'myCollection');
                    });
                });

                it('notif contains mapping', function () {
                    _.each(notifs, function (notif) {
                        assert.equal(notif.model, 'Car');
                    });
                });

                it('notif contains object', function () {
                    _.each(notifs, function (notif) {
                        assert.equal(notif._id, car._id);
                    });
                });

                it('notif contains change', function () {
                    var removalNotif;
                    var addNotif;
                    _.each(notifs, function (notif) {
                        assert.equal(notif.field, 'colours');
                        assert.equal(notif.type, ModelEventType.Splice);
                        if (notif.removed.length) {
                            removalNotif = notif;
                        } else if (notif.added) {
                            addNotif = notif;
                        }
                    });


                });
            });
        });

    });

    describe('relationships', function () {
        var collection;
        var car, person;

        beforeEach(function (done) {
            s.reset(done);
        });

        describe('array', function () {

            var personEvent, personGenericEvent, personCollectionEvent;
            var carEvent, carGenericEvent, carCollectionEvent;

            describe('foreign key', function () {
                beforeEach(function () {
                    collection = s.collection('myCollection');
                    Car = collection.model('Car', {
                        id: 'id',
                        attributes: ['colours', 'name'],
                        relationships: {
                            owner: {
                                model: 'Person',
                                type: RelationshipType.OneToMany,
                                reverse: 'cars'
                            }
                        }
                    });
                    Person = collection.model('Person', {
                        id: 'id',
                        attributes: ['name', 'age']
                    });
                });

                describe('push', function () {

                    var anotherCar;

                    beforeEach(function (done) {
                        s.install()
                            .then(function () {
                                car = Car._new();
                                anotherCar = Car._new();
                                person = Person._new();

                                person.cars = [car];
                                s.on('myCollection:Person', function (n) {
                                    if (n.type == ModelEventType.Splice && n.model == 'Person') {
                                        personEvent = n;
                                    }
                                });
                                s.on('myCollection', function (n) {
                                    if (n.type == ModelEventType.Splice && n.model == 'Person') {
                                        personCollectionEvent = n;
                                    }
                                });
                                s.on('Siesta', function (n) {
                                    if (n.type == ModelEventType.Splice && n.model == 'Person') {
                                        personGenericEvent = n;
                                    }
                                });
                                s.on('myCollection:Car', function (n) {
                                    if (n.type == ModelEventType.Set && n.model == 'Car') {
                                        carEvent = n;
                                    }
                                });
                                s.on('myCollection', function (n) {
                                    if (n.type == ModelEventType.Set && n.model == 'Car') {
                                        carCollectionEvent = n;
                                    }
                                });
                                s.on('Siesta', function (n) {
                                    if (n.type == ModelEventType.Set && n.model == 'Car') {
                                        carGenericEvent = n;
                                    }
                                });
                                person.cars.push(anotherCar);
                                util.next(function () {
                                    events.removeAllListeners();
                                    done();
                                })
                            })
                            .catch(done);
                    });

                    describe('person', function () {
                        it('type', function () {
                            assert.equal(personEvent.type, ModelEventType.Splice);
                            assert.equal(personGenericEvent.type, ModelEventType.Splice);
                            assert.equal(personCollectionEvent.type, ModelEventType.Splice);
                        });


                        it('added', function () {
                            assert.include(personEvent.added, anotherCar);
                            assert.include(personGenericEvent.added, anotherCar);
                            assert.include(personCollectionEvent.added, anotherCar);
                        });
                    });

                    describe('car', function () {
                        it('type', function () {
                            assert.equal(carEvent.type, ModelEventType.Set);
                            assert.equal(carGenericEvent.type, ModelEventType.Set);
                            assert.equal(carCollectionEvent.type, ModelEventType.Set);
                        });

                        it('new', function () {
                            assert.equal(carEvent.new, person);
                            assert.equal(carGenericEvent.new, person);
                            assert.equal(carCollectionEvent.new, person);
                        })
                    });
                });

                describe('splice', function () {

                    beforeEach(function (done) {
                        s.install()
                            .then(function () {
                                car = Car._new();
                                person = Person._new();
                                person.cars = [car];
                                s.on('myCollection:Person', function (n) {
                                    if (n.type == ModelEventType.Splice) {
                                        personEvent = n;
                                    }
                                });
                                s.on('myCollection', function (n) {
                                    if (n.type == ModelEventType.Splice) {
                                        personCollectionEvent = n;
                                    }
                                });
                                s.on('Siesta', function (n) {
                                    if (n.type == ModelEventType.Splice) {
                                        personGenericEvent = n;
                                    }
                                });
                                s.on('myCollection:Car', function (n) {
                                    if (n.type == ModelEventType.Set && n.model == 'Car') {
                                        carEvent = n;
                                    }
                                });
                                s.on('myCollection', function (n) {
                                    if (n.type == ModelEventType.Set && n.model == 'Car') {
                                        carCollectionEvent = n;
                                    }
                                });
                                s.on('Siesta', function (n) {
                                    if (n.type == ModelEventType.Set && n.model == 'Car') {
                                        carGenericEvent = n;
                                    }
                                });
                                person.cars.splice(0, 1);
                                util.next(function () {
                                    events.removeAllListeners();
                                    done();
                                })
                            })
                            .catch(done);
                    });

                    describe('person', function () {
                        it('type', function () {
                            assert.equal(personEvent.type, ModelEventType.Splice);
                            assert.equal(personGenericEvent.type, ModelEventType.Splice);
                            assert.equal(personCollectionEvent.type, ModelEventType.Splice);
                        });

                        it('added', function () {
                            assert.include(personEvent.removed, car);
                            assert.include(personGenericEvent.removed, car);
                            assert.include(personCollectionEvent.removed, car);
                        });
                    });

                    describe('car', function () {
                        it('type', function () {
                            assert.equal(carEvent.type, ModelEventType.Set);
                            assert.equal(carGenericEvent.type, ModelEventType.Set);
                            assert.equal(carCollectionEvent.type, ModelEventType.Set);
                        });

                        it('new', function () {
                            assert.notOk(carEvent.new);
                            assert.notOk(carGenericEvent.new);
                            assert.notOk(carCollectionEvent.new);
                        });

                        it('old', function () {
                            assert.equal(carEvent.old, person);
                            assert.equal(carGenericEvent.old, person);
                            assert.equal(carCollectionEvent.old, person);
                        });


                    });

                });

            });

            describe('many to many', function () {
                beforeEach(function () {
                    collection = s.collection('myCollection');
                    Car = collection.model('Car', {
                        id: 'id',
                        attributes: ['colours', 'name'],
                        relationships: {
                            owners: {
                                model: 'Person',
                                type: RelationshipType.ManyToMany,
                                reverse: 'cars'
                            }
                        }
                    });
                    Person = collection.model('Person', {
                        id: 'id',
                        attributes: ['name', 'age']
                    });
                });

                describe('no faults', function () {

                    var anotherCar;

                    describe('push', function () {
                        beforeEach(function (done) {
                            s.install(function () {
                                car = Car._new();
                                anotherCar = Car._new();
                                person = Person._new();
                                person.cars = [car];
                                s.on('myCollection:Person', function (n) {
                                    if (n.type == ModelEventType.Splice && n.model == 'Person') {
                                        personEvent = n;
                                    }
                                });
                                s.on('myCollection', function (n) {
                                    if (n.type == ModelEventType.Splice && n.model == 'Person') {
                                        personCollectionEvent = n;
                                    }
                                });
                                s.on('Siesta', function (n) {
                                    if (n.type == ModelEventType.Splice && n.model == 'Person') {
                                        personGenericEvent = n;
                                    }
                                });
                                s.on('myCollection:Car', function (n) {
                                    if (n.type == ModelEventType.Splice && n.model == 'Car') {
                                        carEvent = n;
                                    }
                                });
                                s.on('myCollection', function (n) {
                                    if (n.type == ModelEventType.Splice && n.model == 'Car') {
                                        carCollectionEvent = n;
                                    }
                                });
                                s.on('Siesta', function (n) {
                                    if (n.type == ModelEventType.Splice && n.model == 'Car') {
                                        carGenericEvent = n;
                                    }
                                });
                                person.cars.push(anotherCar);
                                util.next(function () {
                                    events.removeAllListeners();
                                    done();
                                });
                            });
                        });

                        describe('person', function () {

                            it('type', function () {
                                assert.equal(personEvent.type, ModelEventType.Splice);
                                assert.equal(personGenericEvent.type, ModelEventType.Splice);
                                assert.equal(personCollectionEvent.type, ModelEventType.Splice);
                            });


                            it('added', function () {
                                assert.include(personEvent.added, anotherCar);
                                assert.include(personGenericEvent.added, anotherCar);
                                assert.include(personCollectionEvent.added, anotherCar);
                            });
                        });

                        describe('car', function () {
                            it('type', function () {
                                assert.equal(carEvent.type, ModelEventType.Splice);
                                assert.equal(carGenericEvent.type, ModelEventType.Splice);
                                assert.equal(carCollectionEvent.type, ModelEventType.Splice);
                            });


                            it('added', function () {
                                assert.include(carEvent.added, person);
                                assert.include(carGenericEvent.added, person);
                                assert.include(carCollectionEvent.added, person);
                            });
                        });


                    });

                    describe('splice', function () {
                        beforeEach(function (done) {
                            s.install()
                                .then(function () {
                                    car = Car._new();
                                    person = Person._new();
                                    person.cars = [car];
                                    s.on('myCollection:Person', function (n) {
                                        if (n.type == ModelEventType.Splice && n.model == 'Person') {
                                            event = n;
                                        }
                                    });
                                    s.on('myCollection', function (n) {
                                        if (n.type == ModelEventType.Splice && n.model == 'Person') {
                                            collectionEvent = n;
                                        }
                                    });
                                    s.on('Siesta', function (n) {
                                        if (n.type == ModelEventType.Splice && n.model == 'Person') {
                                            genericEvent = n;
                                        }
                                    });
                                    s.on('myCollection:Car', function (n) {
                                        if (n.type == ModelEventType.Splice && n.model == 'Car') {
                                            carEvent = n;
                                        }
                                    });
                                    s.on('myCollection', function (n) {
                                        if (n.type == ModelEventType.Splice && n.model == 'Car') {
                                            carCollectionEvent = n;
                                        }
                                    });
                                    s.on('Siesta', function (n) {
                                        if (n.type == ModelEventType.Splice && n.model == 'Car') {
                                            carGenericEvent = n;
                                        }
                                    });
                                    person.cars.splice(0, 1);
                                    util.next(function () {
                                        events.removeAllListeners();
                                        done();
                                    })
                                })
                                .catch(done);
                        });


                        it('type', function () {
                            assert.equal(event.type, ModelEventType.Splice);
                            assert.equal(genericEvent.type, ModelEventType.Splice);
                            assert.equal(collectionEvent.type, ModelEventType.Splice);
                            assert.equal(carEvent.type, ModelEventType.Splice);
                            assert.equal(carGenericEvent.type, ModelEventType.Splice);
                            assert.equal(carCollectionEvent.type, ModelEventType.Splice);
                        });

                    });
                });

            });

        });

    });

    describe('new object', function () {

        beforeEach(function (done) {
            event = null;
            genericEvent = null;
            collectionEvent = null;
            Collection = s.collection('myCollection');
            Car = Collection.model('Car', {
                id: 'id',
                attributes: ['colour', 'name']
            });
            s.on('myCollection:Car', function (n) {
                if (n.type == ModelEventType.New) {
                    event = n;
                }
            });
            s.on('myCollection', function (n) {
                if (n.type == ModelEventType.New) {
                    collectionEvent = n;
                }
            });
            s.on('Siesta', function (n) {
                if (n.type == ModelEventType.New) {
                    genericEvent = n;
                }
            });
            Car.map({
                colour: 'red',
                name: 'Aston Martin',
                id: 'xyz'
            }, function (err, _car) {
                if (err) {
                    done(err);
                } else {
                    car = _car;
                    events.removeAllListeners();
                    done();
                }
            });
        });

        it('is notif', function () {
            assert.ok(event);
        });

        it('is genericNotif', function () {
            assert.ok(genericEvent);
        });

        it('is collectionNotif', function () {
            assert.ok(collectionEvent);
        });

        it('type is New', function () {
            assert.equal(event.type, ModelEventType.New);
            assert.equal(genericEvent.type, ModelEventType.New);
            assert.equal(collectionEvent.type, ModelEventType.New);
        });

        it('new', function () {
            assert.equal(event.new, car);
            assert.equal(genericEvent.new, car);
            assert.equal(collectionEvent.new, car);
        });

        it('_id', function () {
            assert.equal(event._id, car._id);
            assert.equal(genericEvent._id, car._id);
            assert.equal(collectionEvent._id, car._id);
        });

    });

    describe('object removal', function () {

        beforeEach(function (done) {
            event = null;
            genericEvent = null;
            collectionEvent = null;
            Collection = s.collection('myCollection');
            Car = Collection.model('Car', {
                id: 'id',
                attributes: ['colour', 'name']
            });
            Car.map({
                colour: 'red',
                name: 'Aston Martin',
                id: 'xyz'
            }, function (err, _car) {
                if (err) {
                    done(err);
                } else {
                    car = _car;
                    s.on('myCollection:Car', function (n) {
                        if (n.type == ModelEventType.Remove) {
                            event = n;
                        }
                    });
                    s.on('myCollection', function (n) {
                        if (n.type == ModelEventType.Remove) {
                            collectionEvent = n;
                        }
                    });
                    s.on('Siesta', function (n) {
                        if (n.type == ModelEventType.Remove) {
                            genericEvent = n;
                        }
                    });
                    car.remove();
                    events.removeAllListeners();
                    done();
                }
            });
        });

        it('is notif', function () {
            assert.ok(event);
        });

        it('is genericNotif', function () {
            assert.ok(genericEvent);
        });

        it('is collectionNotif', function () {
            assert.ok(collectionEvent);
        });

        it('type is Remove', function () {
            assert.equal(event.type, ModelEventType.Remove);
            assert.equal(genericEvent.type, ModelEventType.Remove);
            assert.equal(collectionEvent.type, ModelEventType.Remove);
        });

        it('old', function () {
            assert.equal(event.old, car);
            assert.equal(genericEvent.old, car);
            assert.equal(collectionEvent.old, car);
        });

        it('_id', function () {
            assert.equal(event._id, car._id);
            assert.equal(genericEvent._id, car._id);
            assert.equal(collectionEvent._id, car._id);
        });

    });

    describe('object restoration', function () {
        beforeEach(function (done) {
            event = null;
            genericEvent = null;
            collectionEvent = null;
            Collection = s.collection('myCollection');
            Car = Collection.model('Car', {
                id: 'id',
                attributes: ['colour', 'name']
            });
            Car.map({
                colour: 'red',
                name: 'Aston Martin',
                id: 'xyz'
            }, function (err, _car) {
                if (err) {
                    done(err);
                } else {
                    car = _car;
                    car.remove();
                    s.on('myCollection:Car', function (n) {
                        if (n.type == ModelEventType.New) {
                            event = n;
                        }
                    });
                    s.on('myCollection', function (n) {
                        if (n.type == ModelEventType.New) {
                            collectionEvent = n;
                        }
                    });
                    s.on('Siesta', function (n) {
                        if (n.type == ModelEventType.New) {
                            genericEvent = n;
                        }
                    });
                    car.restore();
                    events.removeAllListeners();
                    done();
                }
            });
        });

        it('is notif', function () {
            assert.ok(event);
        });

        it('is genericNotif', function () {
            assert.ok(genericEvent);
        });

        it('is collectionNotif', function () {
            assert.ok(collectionEvent);
        });

        it('type is New', function () {
            assert.equal(event.type, ModelEventType.New);
            assert.equal(genericEvent.type, ModelEventType.New);
            assert.equal(collectionEvent.type, ModelEventType.New);
        });

        it('new', function () {
            assert.equal(event.new, car);
            assert.equal(genericEvent.new, car);
            assert.equal(collectionEvent.new, car);
        });

        it('_id', function () {
            assert.equal(event._id, car._id);
            assert.equal(genericEvent._id, car._id);
            assert.equal(collectionEvent._id, car._id);
        });
    });

    describe.only('proxy event emission', function () {
        var Car;
        beforeEach(function () {
            Collection = s.collection('myCollection');
            Car = Collection.model('Car', {
                id: 'id',
                attributes: ['colour', 'name']
            });
        });
        it('collection', function (done) {
            var listener;
            listener = function (n) {
                assert.ok(n);
                cancelListen();
                done();
            };
            var cancelListen = Collection.listen(listener);
            Car.map({colour: 'red', name: 'Aston Martin'});
        });

        it('mapping', function (done) {
            var listener;
            listener = function (n) {
                assert.ok(n);
                cancelListen();
                done();
            };
            var cancelListen = Car.listen(listener);
            Car.map({colour: 'red', name: 'Aston Martin'});
        });

        it('object', function (done) {
            Car.map({id: 1, colour: 'red', name: 'Aston Martin'}).then(function (car) {
                var listener;
                listener = function (n) {
                    assert.ok(n);
                    cancelListen();
                    done();
                };
                var cancelListen = car.listen(listener);
                Car.map({id: 1, colour: 'blue'});
            }).catch(done).done();
        });

    })

});