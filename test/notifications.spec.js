var s = require('../core/index'),
    assert = require('chai').assert;

describe('notifications', function () {

    before(function () {
        s.ext.storageEnabled = false;
    });

    var ChangeType = require('../core/changes').ChangeType,
        util = require('../core/util'),
        notifications = require('../core/notifications'),
        RelationshipType = require('../core/RelationshipType');

    beforeEach(function (done) {
        s.reset(done);
    });

    var collection, carMapping, car;
    var notif, collectionNotif, genericNotif, localIdNotif, remoteIdNotif;

    describe('basics', function () {
        it('simple emissions work', function (done) {
            notifications.once('blah', function () {
                done();
            });
            notifications.emit('blah');
        });

        it('emissions with payloads work', function (done) {
            var p = {};
            notifications.once('blah', function (payload) {
                assert.equal(payload, p);
                done();
            });
            notifications.emit('blah', p);
        });
    });

    describe('attributes', function () {
        afterEach(function () {
            notif = null;
            collectionNotif = null;
            genericNotif = null;
            car = null;
            collection = null;
            carMapping = null;
        });

        describe('set value', function () {

            beforeEach(function (done) {
                collection = s.collection('myCollection');
                carMapping = collection.model('Car', {
                    id: 'id',
                    attributes: ['colour', 'name']
                });
                s.install(function (err) {
                    if (err) done(err);
                    carMapping.map({
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
            })

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
                assert.equal(notif.type, ChangeType.Set);
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

        describe('array notifications', function () {
            beforeEach(function (done) {
                collection = s.collection('myCollection');
                carMapping = collection.model('Car', {
                    id: 'id',
                    attributes: ['colours', 'name']
                });
                s.install(done);
            });

            it('sends notifications for all levels', function (done) {
                var notifs = [];
                carMapping.map({
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
                    carMapping.map({
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
                    assert.equal(notif.type, ChangeType.Splice);
                    assert.equal(notif.index, 2);
                    assert.equal(notif.removed.length, 0);
                    assert.equal(notif.added.length, 1);
                });

            });

            describe('pop', function () {
                beforeEach(function (done) {
                    carMapping.map({
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
                    assert.equal(notif.type, ChangeType.Splice);
                    assert.equal(notif.index, 1);
                    assert.equal(notif.removed.length, 1);
                    assert.include(notif.removed, 'blue');
                    assert.equal(notif.added.length, 0);
                });
            });

            describe('shift', function () {
                beforeEach(function (done) {
                    carMapping.map({
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
                    assert.equal(notif.type, ChangeType.Splice);
                    assert.equal(notif.index, 0);
                    assert.equal(notif.removed.length, 1);
                    assert.include(notif.removed, 'red');
                    assert.equal(notif.added.length, 0);

                });


            });

            describe('unshift', function () {
                beforeEach(function (done) {
                    carMapping.map({
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
                    assert.equal(notif.type, ChangeType.Splice);
                    assert.equal(notif.index, 0);
                    assert.equal(notif.removed.length, 0);
                    assert.equal(notif.added.length, 1);
                });

            });

            describe('sort', function () {
                var notifs = [];

                beforeEach(function (done) {
                    notifs = [];
                    carMapping.map({
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
                        assert.equal(notif.type, ChangeType.Splice);
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

                    carMapping = collection.model('Car', {
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

                    personMapping = collection.model('Person', {
                        id: 'id',
                        attributes: ['name', 'age']
                    });

                    s.install(done);
                });

                describe('push', function () {

                    var anotherCar;

                    beforeEach(function (done) {
                        car = carMapping._new();
                        anotherCar = carMapping._new();
                        person = personMapping._new();
                        person.cars = [car];
                        s.on('myCollection:Person', function (n) {
                            if (n.type == ChangeType.Splice && n.model == 'Person') {
                                personNotif = n;
                            }
                        });
                        s.on('myCollection', function (n) {
                            if (n.type == ChangeType.Splice && n.model == 'Person') {
                                personCollectionNotif = n;
                            }
                        });
                        s.on('Siesta', function (n) {
                            if (n.type == ChangeType.Splice && n.model == 'Person') {
                                personGenericNotif = n;
                            }
                        });
                        s.on('myCollection:Car', function (n) {
                            if (n.type == ChangeType.Set && n.model == 'Car') {
                                carNotif = n;
                            }
                        });
                        s.on('myCollection', function (n) {
                            if (n.type == ChangeType.Set && n.model == 'Car') {
                                carCollectionNotif = n;
                            }
                        });
                        s.on('Siesta', function (n) {
                            if (n.type == ChangeType.Set && n.model == 'Car') {
                                carGenericNotif = n;
                            }
                        });
                        person.cars.push(anotherCar);
                        util.next(function () {
                            notifications.removeAllListeners();
                            done();
                        })
                    });

                    describe('person', function () {
                        it('type', function () {
                            assert.equal(personNotif.type, ChangeType.Splice);
                            assert.equal(personGenericNotif.type, ChangeType.Splice);
                            assert.equal(personCollectionNotif.type, ChangeType.Splice);
                        });

                        it('id', function () {
                            assert.include(personNotif.addedId, anotherCar._id);
                            assert.include(personGenericNotif.addedId, anotherCar._id);
                            assert.include(personCollectionNotif.addedId, anotherCar._id);
                        });

                        it('added', function () {
                            assert.include(personNotif.added, anotherCar);
                            assert.include(personGenericNotif.added, anotherCar);
                            assert.include(personCollectionNotif.added, anotherCar);
                        });
                    });

                    describe('car', function () {
                        it('type', function () {
                            assert.equal(carNotif.type, ChangeType.Set);
                            assert.equal(carGenericNotif.type, ChangeType.Set);
                            assert.equal(carCollectionNotif.type, ChangeType.Set);
                        });

                        it('id', function () {
                            assert.equal(carNotif.newId, person._id);
                            assert.equal(carGenericNotif.newId, person._id);
                            assert.equal(carCollectionNotif.newId, person._id);
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
                        car = carMapping._new();
                        person = personMapping._new();
                        person.cars = [car];
                        s.on('myCollection:Person', function (n) {
                            if (n.type == ChangeType.Splice) {
                                personNotif = n;
                            }
                        });
                        s.on('myCollection', function (n) {
                            if (n.type == ChangeType.Splice) {
                                personCollectionNotif = n;
                            }
                        });
                        s.on('Siesta', function (n) {
                            if (n.type == ChangeType.Splice) {
                                personGenericNotif = n;
                            }
                        });
                        s.on('myCollection:Car', function (n) {
                            if (n.type == ChangeType.Set && n.model == 'Car') {
                                carNotif = n;
                            }
                        });
                        s.on('myCollection', function (n) {
                            if (n.type == ChangeType.Set && n.model == 'Car') {
                                carCollectionNotif = n;
                            }
                        });
                        s.on('Siesta', function (n) {
                            if (n.type == ChangeType.Set && n.model == 'Car') {
                                carGenericNotif = n;
                            }
                        });
                        person.cars.splice(0, 1);
                        util.next(function () {
                            notifications.removeAllListeners();
                            done();
                        })
                    });

                    describe('person', function () {
                        it('type', function () {
                            assert.equal(personNotif.type, ChangeType.Splice);
                            assert.equal(personGenericNotif.type, ChangeType.Splice);
                            assert.equal(personCollectionNotif.type, ChangeType.Splice);
                        });

                        it('id', function () {
                            assert.include(personNotif.removedId, car._id);
                            assert.include(personGenericNotif.removedId, car._id);
                            assert.include(personCollectionNotif.removedId, car._id);
                        });

                        it('added', function () {
                            assert.include(personNotif.removed, car);
                            assert.include(personGenericNotif.removed, car);
                            assert.include(personCollectionNotif.removed, car);
                        });
                    });

                    describe('car', function () {
                        it('type', function () {
                            assert.equal(carNotif.type, ChangeType.Set);
                            assert.equal(carGenericNotif.type, ChangeType.Set);
                            assert.equal(carCollectionNotif.type, ChangeType.Set);
                        });

                        it('new id', function () {
                            assert.notOk(carNotif.newId)
                            assert.notOk(carGenericNotif.newId);
                            assert.notOk(carCollectionNotif.newId);
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

                        it('old id', function () {
                            assert.equal(carNotif.oldId, person._id);
                            assert.equal(carGenericNotif.oldId, person._id);
                            assert.equal(carCollectionNotif.oldId, person._id);
                        });
                    });

                });

            });

            describe('many to many', function () {
                beforeEach(function (done) {
                    collection = s.collection('myCollection');

                    carMapping = collection.model('Car', {
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

                    personMapping = collection.model('Person', {
                        id: 'id',
                        attributes: ['name', 'age']
                    });

                    s.install(done);
                });

                describe('no faults', function () {

                    var anotherCar;

                    describe('push', function (done) {
                        beforeEach(function (done) {
                            car = carMapping._new();
                            anotherCar = carMapping._new();
                            person = personMapping._new();
                            person.cars = [car];
                            s.on('myCollection:Person', function (n) {
                                if (n.type == ChangeType.Splice && n.model == 'Person') {
                                    personNotif = n;
                                }
                            });
                            s.on('myCollection', function (n) {
                                if (n.type == ChangeType.Splice && n.model == 'Person') {
                                    personCollectionNotif = n;
                                }
                            });
                            s.on('Siesta', function (n) {
                                if (n.type == ChangeType.Splice && n.model == 'Person') {
                                    personGenericNotif = n;
                                }
                            });
                            s.on('myCollection:Car', function (n) {
                                if (n.type == ChangeType.Splice && n.model == 'Car') {
                                    carNotif = n;
                                }
                            });
                            s.on('myCollection', function (n) {
                                if (n.type == ChangeType.Splice && n.model == 'Car') {
                                    carCollectionNotif = n;
                                }
                            });
                            s.on('Siesta', function (n) {
                                if (n.type == ChangeType.Splice && n.model == 'Car') {
                                    carGenericNotif = n;
                                }
                            });
                            person.cars.push(anotherCar);
                            util.next(function () {
                                notifications.removeAllListeners();
                                done();
                            });
                        });

                        describe('person', function () {

                            it('type', function () {
                                assert.equal(personNotif.type, ChangeType.Splice);
                                assert.equal(personGenericNotif.type, ChangeType.Splice);
                                assert.equal(personCollectionNotif.type, ChangeType.Splice);
                            });

                            it('id', function () {
                                assert.include(personNotif.addedId, anotherCar._id);
                                assert.include(personGenericNotif.addedId, anotherCar._id);
                                assert.include(personCollectionNotif.addedId, anotherCar._id);
                            });

                            it('added', function () {
                                assert.include(personNotif.added, anotherCar);
                                assert.include(personGenericNotif.added, anotherCar);
                                assert.include(personCollectionNotif.added, anotherCar);
                            });
                        });

                        describe('car', function () {
                            it('type', function () {
                                assert.equal(carNotif.type, ChangeType.Splice);
                                assert.equal(carGenericNotif.type, ChangeType.Splice);
                                assert.equal(carCollectionNotif.type, ChangeType.Splice);
                            });

                            it('id', function () {
                                assert.include(carNotif.addedId, person._id);
                                assert.include(carGenericNotif.addedId, person._id);
                                assert.include(carCollectionNotif.addedId, person._id);
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
                            car = carMapping._new();
                            person = personMapping._new();
                            person.cars = [car];
                            s.on('myCollection:Person', function (n) {
                                if (n.type == ChangeType.Splice && n.model == 'Person') {
                                    notif = n;
                                }
                            });
                            s.on('myCollection', function (n) {
                                if (n.type == ChangeType.Splice && n.model == 'Person') {
                                    collectionNotif = n;
                                }
                            });
                            s.on('Siesta', function (n) {
                                if (n.type == ChangeType.Splice && n.model == 'Person') {
                                    genericNotif = n;
                                }
                            });
                            s.on('myCollection:Car', function (n) {
                                if (n.type == ChangeType.Splice && n.model == 'Car') {
                                    carNotif = n;
                                }
                            });
                            s.on('myCollection', function (n) {
                                if (n.type == ChangeType.Splice && n.model == 'Car') {
                                    carCollectionNotif = n;
                                }
                            });
                            s.on('Siesta', function (n) {
                                if (n.type == ChangeType.Splice && n.model == 'Car') {
                                    carGenericNotif = n;
                                }
                            });
                            person.cars.splice(0, 1);
                            util.next(function () {
                                notifications.removeAllListeners();
                                done();
                            })
                        });


                        it('type', function () {
                            assert.equal(notif.type, ChangeType.Splice);
                            assert.equal(genericNotif.type, ChangeType.Splice);
                            assert.equal(collectionNotif.type, ChangeType.Splice);
                            assert.equal(carNotif.type, ChangeType.Splice);
                            assert.equal(carGenericNotif.type, ChangeType.Splice);
                            assert.equal(carCollectionNotif.type, ChangeType.Splice);
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
            carMapping = collection.model('Car', {
                id: 'id',
                attributes: ['colour', 'name']
            });
            s.install(function (err) {
                if (err) done(err);
                s.on('myCollection:Car', function (n) {
                    if (n.type == ChangeType.New) {
                        notif = n;
                    }
                });
                s.on('myCollection', function (n) {
                    if (n.type == ChangeType.New) {
                        collectionNotif = n;
                    }
                });
                s.on('Siesta', function (n) {
                    if (n.type == ChangeType.New) {
                        genericNotif = n;
                    }
                });
                carMapping.map({
                    colour: 'red',
                    name: 'Aston Martin',
                    id: 'xyz'
                }, function (err, _car) {
                    if (err) {
                        done(err);
                    } else {
                        car = _car;
                        notifications.removeAllListeners();
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
            assert.equal(notif.type, ChangeType.New);
            assert.equal(genericNotif.type, ChangeType.New);
            assert.equal(collectionNotif.type, ChangeType.New);
        });

        it('new', function () {
            assert.equal(notif.new, car);
            assert.equal(genericNotif.new, car);
            assert.equal(collectionNotif.new, car);
        });

        it('_id', function () {
            assert.equal(notif.newId, car._id);
            assert.equal(genericNotif.newId, car._id);
            assert.equal(collectionNotif.newId, car._id);
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
            carMapping = collection.model('Car', {
                id: 'id',
                attributes: ['colour', 'name']
            });
            s.install(function (err) {
                if (err) done(err);
                carMapping.map({
                    colour: 'red',
                    name: 'Aston Martin',
                    id: 'xyz'
                }, function (err, _car) {
                    if (err) {
                        done(err);
                    } else {
                        car = _car;
                        s.on('myCollection:Car', function (n) {
                            if (n.type == ChangeType.Remove) {
                                notif = n;
                            }
                        });
                        s.on('myCollection', function (n) {
                            if (n.type == ChangeType.Remove) {
                                collectionNotif = n;
                            }
                        });
                        s.on('Siesta', function (n) {
                            if (n.type == ChangeType.Remove) {
                                genericNotif = n;
                            }
                        });
                        car.remove();
                        notifications.removeAllListeners();
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
            assert.equal(notif.type, ChangeType.Remove);
            assert.equal(genericNotif.type, ChangeType.Remove);
            assert.equal(collectionNotif.type, ChangeType.Remove);
        });

        it('new', function () {
            assert.equal(notif.old, car);
            assert.equal(genericNotif.old, car);
            assert.equal(collectionNotif.old, car);
        });

        it('_id', function () {
            assert.equal(notif.oldId, car._id);
            assert.equal(genericNotif.oldId, car._id);
            assert.equal(collectionNotif.oldId, car._id);
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
            carMapping = collection.model('Car', {
                id: 'id',
                attributes: ['colour', 'name']
            });
            s.install(function (err) {
                if (err) done(err);
                carMapping.map({
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
                            if (n.type == ChangeType.New) {
                                notif = n;
                            }
                        });
                        s.on('myCollection', function (n) {
                            if (n.type == ChangeType.New) {
                                collectionNotif = n;
                            }
                        });
                        s.on('Siesta', function (n) {
                            if (n.type == ChangeType.New) {
                                genericNotif = n;
                            }
                        });
                        car.restore();
                        notifications.removeAllListeners();
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
            assert.equal(notif.type, ChangeType.New);
            assert.equal(genericNotif.type, ChangeType.New);
            assert.equal(collectionNotif.type, ChangeType.New);
        });

        it('new', function () {
            assert.equal(notif.new, car);
            assert.equal(genericNotif.new, car);
            assert.equal(collectionNotif.new, car);
        });

        it('_id', function () {
            assert.equal(notif.newId, car._id);
            assert.equal(genericNotif.newId, car._id);
            assert.equal(collectionNotif.newId, car._id);
            assert.equal(notif._id, car._id);
            assert.equal(genericNotif._id, car._id);
            assert.equal(collectionNotif._id, car._id);
        });
    });

    describe('convenience', function () {
        beforeEach(function (done) {
            collection = s.collection('myCollection');
            carMapping = collection.model('Car', {
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
            carMapping.map({colour: 'red', name: 'Aston Martin'});
        });

        it('mapping', function (done) {
            var listener;
            listener = function (n) {
                assert.ok(n);
                cancelListen();
                done();
            };
            var cancelListen = carMapping.listen(listener);
            carMapping.map({colour: 'red', name: 'Aston Martin'});
        });

        it('object', function (done) {
            carMapping.map({id: 1, colour: 'red', name: 'Aston Martin'}).then(function (car) {
                var listener;
                listener = function (n) {
                    assert.ok(n);
                    cancelListen();
                    done();
                };
                var cancelListen = car.listen(listener);
                carMapping.map({id: 1, colour: 'blue'});
            }).catch(done).done();
        });

    })

});