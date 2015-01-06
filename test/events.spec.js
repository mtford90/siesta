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

    var collection, carMapping, car;
    var notif, collectionNotif, genericNotif, localIdNotif, remoteIdNotif;

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
            notif = null;
            collectionNotif = null;
            genericNotif = null;
            car = null;
            collection = null;
            Car = null;
        });

        describe('set value', function () {

            beforeEach(function (done) {
                collection = s.collection('myCollection');
                Car = collection.model('Car', {
                    id: 'id',
                    attributes: ['colour', 'name']
                });
                s.install(function (err) {
                    if (err) done(err);
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
                                if (notif &&
                                    genericNotif &&
                                    collectionNotif &&
                                    localIdNotif &&
                                    remoteIdNotif) {
                                    done();
                                }
                            }

                            s.once('myCollection:Car', function (n) {
                                notif = n;
                                checkDone();
                            });
                            s.once('myCollection', function (n) {
                                collectionNotif = n;
                                checkDone();
                            });
                            s.once('Siesta', function (n) {
                                genericNotif = n;
                                checkDone();
                            });
                            s.once(_car._id, function (n) {
                                localIdNotif = n;
                                checkDone();
                            });
                            s.once('myCollection:Car:xyz', function (n) {
                                remoteIdNotif = n;
                                checkDone();
                            });
                            car.colour = 'blue';
                        }
                    });
                });

            });

            it('all notifs equal', function () {
                assert.equal(notif, genericNotif);
                assert.equal(genericNotif, collectionNotif);
                assert.equal(collectionNotif, localIdNotif);
                assert.equal(localIdNotif, remoteIdNotif);
            });

            it('notif contains collection', function () {
                assert.equal(notif.collection, 'myCollection');
            });

            it('notif contains mapping', function () {
                assert.equal(notif.model, 'Car');
            });

            it('changeDict contains attribute name', function () {
                assert.equal(notif.field, 'colour');
            });

            it('changeDict contains change type', function () {
                assert.equal(notif.type, ModelEventType.Set);
            });

            it('changeDict contains old value', function () {
                assert.equal(notif.old, 'red');
            });

            it('changeDict contains new value', function () {
                assert.equal(notif.new, 'blue');
            });

            it('changeDict contains new value', function () {
                assert.equal(notif._id, car._id);
            });

        });

        describe('array events', function () {
            beforeEach(function (done) {
                collection = s.collection('myCollection');
                Car = collection.model('Car', {
                    id: 'id',
                    attributes: ['colours', 'name']
                });
                s.install(done);
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
                            notif = n;
                            done();
                        });
                        car.colours.push('green');
                        s.notify();
                    });
                });

                it('notif contains collection', function () {
                    assert.equal(notif.collection, 'myCollection');
                });

                it('notif contains mapping', function () {
                    assert.equal(notif.model, 'Car');
                });

                it('notif contains object', function () {
                    assert.equal(notif._id, car._id);
                });

                it('changeDict contains change', function () {
                    assert.equal(notif.field, 'colours');
                    assert.equal(notif.type, ModelEventType.Splice);
                    assert.equal(notif.index, 2);
                    assert.equal(notif.removed.length, 0);
                    assert.equal(notif.added.length, 1);
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
                            notif = n;
                            done();
                        });
                        car.colours.pop();
                        s.notify();
                    });
                });

                it('notif contains collection', function () {
                    assert.equal(notif.collection, 'myCollection');
                });

                it('notif contains mapping', function () {
                    assert.equal(notif.model, 'Car');
                });

                it('notif contains _id', function () {
                    assert.equal(notif._id, car._id);
                });

                it('notif contains change', function () {
                    assert.equal(notif.field, 'colours');
                    assert.equal(notif.type, ModelEventType.Splice);
                    assert.equal(notif.index, 1);
                    assert.equal(notif.removed.length, 1);
                    assert.include(notif.removed, 'blue');
                    assert.equal(notif.added.length, 0);
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
                            notif = n;
                            done();
                        });
                        car.colours.shift();
                        s.notify();
                    });
                });

                it('notif contains collection', function () {
                    assert.equal(notif.collection, 'myCollection');
                });

                it('notif contains mapping', function () {
                    assert.equal(notif.model, 'Car');
                });

                it('notif contains id', function () {
                    assert.equal(notif._id, car._id);
                });

                it('notif contains change', function () {
                    assert.equal(notif.field, 'colours');
                    assert.equal(notif.type, ModelEventType.Splice);
                    assert.equal(notif.index, 0);
                    assert.equal(notif.removed.length, 1);
                    assert.include(notif.removed, 'red');
                    assert.equal(notif.added.length, 0);

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
                            notif = n;
                            done();
                        });
                        car.colours.unshift('green');
                        s.notify();
                    });

                });

                it('notif contains type', function () {
                    assert.equal(notif.collection, 'myCollection');
                });

                it('notif contains mapping', function () {
                    assert.equal(notif.model, 'Car');
                });

                it('notif contains object', function () {
                    assert.equal(notif._id, car._id);
                });

                it('notif contains change', function () {
                    assert.equal(notif.field, 'colours');
                    assert.equal(notif.type, ModelEventType.Splice);
                    assert.equal(notif.index, 0);
                    assert.equal(notif.removed.length, 0);
                    assert.equal(notif.added.length, 1);
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
        var carMapping, personMapping;

        var Collection = require('../core/collection');


        beforeEach(function (done) {
            s.reset(done);
        });

        describe('array', function () {

            var personNotif, personGenericNotif, personCollectionNotif;
            var carNotif, carGenericNotif, carCollectionNotif;

            describe('foreign key', function () {
                beforeEach(function (done) {
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

                    s.install(done);
                });

                describe('push', function () {

                    var anotherCar;

                    beforeEach(function (done) {
                        car = Car._new();
                        anotherCar = Car._new();
                        person = Person._new();
                        person.cars = [car];
                        s.on('myCollection:Person', function (n) {
                            if (n.type == ModelEventType.Splice && n.model == 'Person') {
                                personNotif = n;
                            }
                        });
                        s.on('myCollection', function (n) {
                            if (n.type == ModelEventType.Splice && n.model == 'Person') {
                                personCollectionNotif = n;
                            }
                        });
                        s.on('Siesta', function (n) {
                            if (n.type == ModelEventType.Splice && n.model == 'Person') {
                                personGenericNotif = n;
                            }
                        });
                        s.on('myCollection:Car', function (n) {
                            if (n.type == ModelEventType.Set && n.model == 'Car') {
                                carNotif = n;
                            }
                        });
                        s.on('myCollection', function (n) {
                            if (n.type == ModelEventType.Set && n.model == 'Car') {
                                carCollectionNotif = n;
                            }
                        });
                        s.on('Siesta', function (n) {
                            if (n.type == ModelEventType.Set && n.model == 'Car') {
                                carGenericNotif = n;
                            }
                        });
                        person.cars.push(anotherCar);
                        util.next(function () {
                            events.removeAllListeners();
                            done();
                        })
                    });

                    describe('person', function () {
                        it('type', function () {
                            assert.equal(personNotif.type, ModelEventType.Splice);
                            assert.equal(personGenericNotif.type, ModelEventType.Splice);
                            assert.equal(personCollectionNotif.type, ModelEventType.Splice);
                        });


                        it('added', function () {
                            assert.include(personNotif.added, anotherCar);
                            assert.include(personGenericNotif.added, anotherCar);
                            assert.include(personCollectionNotif.added, anotherCar);
                        });
                    });

                    describe('car', function () {
                        it('type', function () {
                            assert.equal(carNotif.type, ModelEventType.Set);
                            assert.equal(carGenericNotif.type, ModelEventType.Set);
                            assert.equal(carCollectionNotif.type, ModelEventType.Set);
                        });

                        it('new', function () {
                            assert.equal(carNotif.new, person);
                            assert.equal(carGenericNotif.new, person);
                            assert.equal(carCollectionNotif.new, person);
                        })
                    });
                });

                describe('splice', function (done) {

                    beforeEach(function (done) {
                        car = Car._new();
                        person = Person._new();
                        person.cars = [car];
                        s.on('myCollection:Person', function (n) {
                            if (n.type == ModelEventType.Splice) {
                                personNotif = n;
                            }
                        });
                        s.on('myCollection', function (n) {
                            if (n.type == ModelEventType.Splice) {
                                personCollectionNotif = n;
                            }
                        });
                        s.on('Siesta', function (n) {
                            if (n.type == ModelEventType.Splice) {
                                personGenericNotif = n;
                            }
                        });
                        s.on('myCollection:Car', function (n) {
                            if (n.type == ModelEventType.Set && n.model == 'Car') {
                                carNotif = n;
                            }
                        });
                        s.on('myCollection', function (n) {
                            if (n.type == ModelEventType.Set && n.model == 'Car') {
                                carCollectionNotif = n;
                            }
                        });
                        s.on('Siesta', function (n) {
                            if (n.type == ModelEventType.Set && n.model == 'Car') {
                                carGenericNotif = n;
                            }
                        });
                        person.cars.splice(0, 1);
                        util.next(function () {
                            events.removeAllListeners();
                            done();
                        })
                    });

                    describe('person', function () {
                        it('type', function () {
                            assert.equal(personNotif.type, ModelEventType.Splice);
                            assert.equal(personGenericNotif.type, ModelEventType.Splice);
                            assert.equal(personCollectionNotif.type, ModelEventType.Splice);
                        });

                        it('added', function () {
                            assert.include(personNotif.removed, car);
                            assert.include(personGenericNotif.removed, car);
                            assert.include(personCollectionNotif.removed, car);
                        });
                    });

                    describe('car', function () {
                        it('type', function () {
                            assert.equal(carNotif.type, ModelEventType.Set);
                            assert.equal(carGenericNotif.type, ModelEventType.Set);
                            assert.equal(carCollectionNotif.type, ModelEventType.Set);
                        });

                        it('new', function () {
                            assert.notOk(carNotif.new);
                            assert.notOk(carGenericNotif.new);
                            assert.notOk(carCollectionNotif.new);
                        });

                        it('old', function () {
                            assert.equal(carNotif.old, person);
                            assert.equal(carGenericNotif.old, person);
                            assert.equal(carCollectionNotif.old, person);
                        });


                    });

                });

            });

            describe('many to many', function () {
                beforeEach(function (done) {
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

                    s.install(done);
                });

                describe('no faults', function () {

                    var anotherCar;

                    describe('push', function (done) {
                        beforeEach(function (done) {
                            car = Car._new();
                            anotherCar = Car._new();
                            person = Person._new();
                            person.cars = [car];
                            s.on('myCollection:Person', function (n) {
                                if (n.type == ModelEventType.Splice && n.model == 'Person') {
                                    personNotif = n;
                                }
                            });
                            s.on('myCollection', function (n) {
                                if (n.type == ModelEventType.Splice && n.model == 'Person') {
                                    personCollectionNotif = n;
                                }
                            });
                            s.on('Siesta', function (n) {
                                if (n.type == ModelEventType.Splice && n.model == 'Person') {
                                    personGenericNotif = n;
                                }
                            });
                            s.on('myCollection:Car', function (n) {
                                if (n.type == ModelEventType.Splice && n.model == 'Car') {
                                    carNotif = n;
                                }
                            });
                            s.on('myCollection', function (n) {
                                if (n.type == ModelEventType.Splice && n.model == 'Car') {
                                    carCollectionNotif = n;
                                }
                            });
                            s.on('Siesta', function (n) {
                                if (n.type == ModelEventType.Splice && n.model == 'Car') {
                                    carGenericNotif = n;
                                }
                            });
                            person.cars.push(anotherCar);
                            util.next(function () {
                                events.removeAllListeners();
                                done();
                            });
                        });

                        describe('person', function () {

                            it('type', function () {
                                assert.equal(personNotif.type, ModelEventType.Splice);
                                assert.equal(personGenericNotif.type, ModelEventType.Splice);
                                assert.equal(personCollectionNotif.type, ModelEventType.Splice);
                            });



                            it('added', function () {
                                assert.include(personNotif.added, anotherCar);
                                assert.include(personGenericNotif.added, anotherCar);
                                assert.include(personCollectionNotif.added, anotherCar);
                            });
                        });

                        describe('car', function () {
                            it('type', function () {
                                assert.equal(carNotif.type, ModelEventType.Splice);
                                assert.equal(carGenericNotif.type, ModelEventType.Splice);
                                assert.equal(carCollectionNotif.type, ModelEventType.Splice);
                            });



                            it('added', function () {
                                assert.include(carNotif.added, person);
                                assert.include(carGenericNotif.added, person);
                                assert.include(carCollectionNotif.added, person);
                            });
                        });


                    });

                    describe('splice', function () {
                        beforeEach(function (done) {
                            car = Car._new();
                            person = Person._new();
                            person.cars = [car];
                            s.on('myCollection:Person', function (n) {
                                if (n.type == ModelEventType.Splice && n.model == 'Person') {
                                    notif = n;
                                }
                            });
                            s.on('myCollection', function (n) {
                                if (n.type == ModelEventType.Splice && n.model == 'Person') {
                                    collectionNotif = n;
                                }
                            });
                            s.on('Siesta', function (n) {
                                if (n.type == ModelEventType.Splice && n.model == 'Person') {
                                    genericNotif = n;
                                }
                            });
                            s.on('myCollection:Car', function (n) {
                                if (n.type == ModelEventType.Splice && n.model == 'Car') {
                                    carNotif = n;
                                }
                            });
                            s.on('myCollection', function (n) {
                                if (n.type == ModelEventType.Splice && n.model == 'Car') {
                                    carCollectionNotif = n;
                                }
                            });
                            s.on('Siesta', function (n) {
                                if (n.type == ModelEventType.Splice && n.model == 'Car') {
                                    carGenericNotif = n;
                                }
                            });
                            person.cars.splice(0, 1);
                            util.next(function () {
                                events.removeAllListeners();
                                done();
                            })
                        });


                        it('type', function () {
                            assert.equal(notif.type, ModelEventType.Splice);
                            assert.equal(genericNotif.type, ModelEventType.Splice);
                            assert.equal(collectionNotif.type, ModelEventType.Splice);
                            assert.equal(carNotif.type, ModelEventType.Splice);
                            assert.equal(carGenericNotif.type, ModelEventType.Splice);
                            assert.equal(carCollectionNotif.type, ModelEventType.Splice);
                        });

                    });
                });

            });

        });

    });

    describe('new object', function () {

        beforeEach(function (done) {
            notif = null;
            genericNotif = null;
            collectionNotif = null;
            collection = s.collection('myCollection');
            Car = collection.model('Car', {
                id: 'id',
                attributes: ['colour', 'name']
            });
            s.install(function (err) {
                if (err) done(err);
                s.on('myCollection:Car', function (n) {
                    if (n.type == ModelEventType.New) {
                        notif = n;
                    }
                });
                s.on('myCollection', function (n) {
                    if (n.type == ModelEventType.New) {
                        collectionNotif = n;
                    }
                });
                s.on('Siesta', function (n) {
                    if (n.type == ModelEventType.New) {
                        genericNotif = n;
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
        });

        it('is notif', function () {
            assert.ok(notif);
        });

        it('is genericNotif', function () {
            assert.ok(genericNotif);
        });

        it('is collectionNotif', function () {
            assert.ok(collectionNotif);
        });

        it('type is New', function () {
            assert.equal(notif.type, ModelEventType.New);
            assert.equal(genericNotif.type, ModelEventType.New);
            assert.equal(collectionNotif.type, ModelEventType.New);
        });

        it('new', function () {
            assert.equal(notif.new, car);
            assert.equal(genericNotif.new, car);
            assert.equal(collectionNotif.new, car);
        });

        it('_id', function () {
            assert.equal(notif._id, car._id);
            assert.equal(genericNotif._id, car._id);
            assert.equal(collectionNotif._id, car._id);
        });

    });

    describe('object removal', function () {

        beforeEach(function (done) {
            notif = null;
            genericNotif = null;
            collectionNotif = null;
            collection = s.collection('myCollection');
            Car = collection.model('Car', {
                id: 'id',
                attributes: ['colour', 'name']
            });
            s.install(function (err) {
                if (err) done(err);
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
                                notif = n;
                            }
                        });
                        s.on('myCollection', function (n) {
                            if (n.type == ModelEventType.Remove) {
                                collectionNotif = n;
                            }
                        });
                        s.on('Siesta', function (n) {
                            if (n.type == ModelEventType.Remove) {
                                genericNotif = n;
                            }
                        });
                        car.remove();
                        events.removeAllListeners();
                        done();
                    }
                });
            });
        });

        it('is notif', function () {
            assert.ok(notif);
        });

        it('is genericNotif', function () {
            assert.ok(genericNotif);
        });

        it('is collectionNotif', function () {
            assert.ok(collectionNotif);
        });

        it('type is Remove', function () {
            assert.equal(notif.type, ModelEventType.Remove);
            assert.equal(genericNotif.type, ModelEventType.Remove);
            assert.equal(collectionNotif.type, ModelEventType.Remove);
        });

        it('old', function () {
            assert.equal(notif.old, car);
            assert.equal(genericNotif.old, car);
            assert.equal(collectionNotif.old, car);
        });

        it('_id', function () {
            assert.equal(notif._id, car._id);
            assert.equal(genericNotif._id, car._id);
            assert.equal(collectionNotif._id, car._id);
        });

    });

    describe('object restoration', function () {
        beforeEach(function (done) {
            notif = null;
            genericNotif = null;
            collectionNotif = null;
            collection = s.collection('myCollection');
            Car = collection.model('Car', {
                id: 'id',
                attributes: ['colour', 'name']
            });
            s.install(function (err) {
                if (err) done(err);
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
                                notif = n;
                            }
                        });
                        s.on('myCollection', function (n) {
                            if (n.type == ModelEventType.New) {
                                collectionNotif = n;
                            }
                        });
                        s.on('Siesta', function (n) {
                            if (n.type == ModelEventType.New) {
                                genericNotif = n;
                            }
                        });
                        car.restore();
                        events.removeAllListeners();
                        done();
                    }
                });
            });
        });

        it('is notif', function () {
            assert.ok(notif);
        });

        it('is genericNotif', function () {
            assert.ok(genericNotif);
        });

        it('is collectionNotif', function () {
            assert.ok(collectionNotif);
        });

        it('type is New', function () {
            assert.equal(notif.type, ModelEventType.New);
            assert.equal(genericNotif.type, ModelEventType.New);
            assert.equal(collectionNotif.type, ModelEventType.New);
        });

        it('new', function () {
            assert.equal(notif.new, car);
            assert.equal(genericNotif.new, car);
            assert.equal(collectionNotif.new, car);
        });

        it('_id', function () {
            assert.equal(notif._id, car._id);
            assert.equal(genericNotif._id, car._id);
            assert.equal(collectionNotif._id, car._id);
        });
    });

    describe('convenience', function () {
        var Car;
        beforeEach(function (done) {
            collection = s.collection('myCollection');
            Car = collection.model('Car', {
                id: 'id',
                attributes: ['colour', 'name']
            });
            s.install(done);
        });
        it('collection', function (done) {
            var listener;
            listener = function (n) {
                assert.ok(n);
                cancelListen();
                done();
            };
            var cancelListen = collection.listen(listener);
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