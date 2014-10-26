var s = require('../index'),
    assert = require('chai').assert;

describe('notifications', function() {

    var Collection = require('../src/collection').Collection,
        ChangeType = require('../src/changes').ChangeType,
        util = require('../src/util')
    notificationCentre = require('../src/notificationCentre').notificationCentre;

    beforeEach(function() {
        s.reset(true);
    });

    var car;
    var collection, carMapping;
    var car;

    var notif, collectionNotif, genericNotif;

    describe('attributes', function() {
        afterEach(function() {
            notif = null;
            collectionNotif = null;
            genericNotif = null;
            car = null;
            collection = null;
            carMapping = null;
        });

        describe('set value', function() {

            beforeEach(function(done) {

                collection = new Collection('myCollection');
                carMapping = collection.mapping('Car', {
                    id: 'id',
                    attributes: ['colour', 'name']
                });
                collection.install(function(err) {
                    if (err) done(err);
                    carMapping.map({
                        colour: 'red',
                        name: 'Aston Martin',
                        id: 'xyz'
                    }, function(err, _car) {
                        if (err) {
                            done(err);
                        } else {
                            car = _car;
                            s.once('myCollection:Car', function(n) {
                                notif = n;
                                if (notif && genericNotif && collectionNotif) {
                                    done();
                                }
                            });
                            s.once('myCollection', function(n) {
                                collectionNotif = n;
                                if (notif && genericNotif && collectionNotif) {
                                    done();
                                }
                            });
                            s.once('Siesta', function(n) {
                                genericNotif = n;
                                if (notif && genericNotif && collectionNotif) {
                                    done();
                                }
                            });
                            car.colour = 'blue';
                        }
                    });
                });

            });


            it('notif contains collection', function() {
                assert.equal(notif.collection, 'myCollection');
            });

            it('notif contains mapping', function() {
                assert.equal(notif.mapping, 'Car');
            });

            it('changeDict contains attribute name', function() {
                assert.equal(notif.field, 'colour');
            });

            it('changeDict contains change type', function() {
                assert.equal(notif.type, ChangeType.Set);
            });

            it('changeDict contains old value', function() {
                assert.equal(notif.old, 'red');
            });

            it('changeDict contains new value', function() {
                assert.equal(notif.new, 'blue');
            });

            it('changeDict contains new value', function() {
                assert.equal(notif._id, car._id);
            });

        });

        describe('array notifications', function() {
            beforeEach(function(done) {
                collection = new Collection('myCollection');
                carMapping = collection.mapping('Car', {
                    id: 'id',
                    attributes: ['colours', 'name']
                });
                collection.install(done);
            });

            it('sends notifications for all levels', function(done) {
                var notifs = [];
                carMapping.map({
                    colours: ['red', 'blue'],
                    name: 'Aston Martin',
                    id: 'xyz'
                }, function(err, _car) {
                    car = _car;
                    if (err) done(err);
                    var listener = function(n) {
                        notifs.push(n);
                        if (notifs.length >= 3) {
                            done();
                        }
                    };
                    s.once('myCollection:Car', listener);
                    s.once('myCollection', listener);
                    s.once('Siesta', listener);
                    car.colours.push('green');
                });
            });

            describe('push', function() {
                beforeEach(function(done) {
                    carMapping.map({
                        colours: ['red', 'blue'],
                        name: 'Aston Martin',
                        id: 'xyz'
                    }, function(err, _car) {
                        car = _car;
                        if (err) done(err);
                        s.once('myCollection:Car', function(n) {
                            notif = n;
                            done();
                        });
                        car.colours.push('green');

                    });
                });

                it('notif contains collection', function() {
                    assert.equal(notif.collection, 'myCollection');
                });

                it('notif contains mapping', function() {
                    assert.equal(notif.mapping, 'Car');
                });

                it('notif contains object', function() {
                    assert.equal(notif._id, car._id);
                });

                it('changeDict contains change', function() {
                    assert.equal(notif.field, 'colours');
                    assert.equal(notif.type, ChangeType.Splice);
                    assert.equal(notif.index, 2);
                    assert.equal(notif.removed.length, 0);
                    assert.equal(notif.added.length, 1);
                });

            });

            describe('pop', function() {
                beforeEach(function(done) {
                    carMapping.map({
                        colours: ['red', 'blue'],
                        name: 'Aston Martin',
                        id: 'xyz'
                    }, function(err, _car) {
                        car = _car;
                        if (err) done(err);
                        s.once('myCollection:Car', function(n) {
                            notif = n;
                            done();
                        });
                        car.colours.pop();
                    });
                });

                it('notif contains collection', function() {
                    assert.equal(notif.collection, 'myCollection');
                });

                it('notif contains mapping', function() {
                    assert.equal(notif.mapping, 'Car');
                });

                it('notif contains _id', function() {
                    assert.equal(notif._id, car._id);
                });

                it('notif contains change', function() {
                    assert.equal(notif.field, 'colours');
                    assert.equal(notif.type, ChangeType.Splice);
                    assert.equal(notif.index, 1);
                    assert.equal(notif.removed.length, 1);
                    assert.include(notif.removed, 'blue');
                    assert.equal(notif.added.length, 0);
                });
            });

            describe('shift', function() {
                beforeEach(function(done) {
                    carMapping.map({
                        colours: ['red', 'blue'],
                        name: 'Aston Martin',
                        id: 'xyz'
                    }, function(err, _car) {
                        car = _car;
                        if (err) done(err);
                        s.once('myCollection:Car', function(n) {
                            notif = n;
                            done();
                        });
                        car.colours.shift();
                    });
                });

                it('notif contains collection', function() {
                    assert.equal(notif.collection, 'myCollection');
                });

                it('notif contains mapping', function() {
                    assert.equal(notif.mapping, 'Car');
                });

                it('notif contains id', function() {
                    assert.equal(notif._id, car._id);
                });

                it('notif contains change', function() {
                    assert.equal(notif.field, 'colours');
                    assert.equal(notif.type, ChangeType.Splice);
                    assert.equal(notif.index, 0);
                    assert.equal(notif.removed.length, 1);
                    assert.include(notif.removed, 'red');
                    assert.equal(notif.added.length, 0);

                });


            });

            describe('unshift', function() {
                beforeEach(function(done) {
                    carMapping.map({
                        colours: ['red', 'blue'],
                        name: 'Aston Martin',
                        id: 'xyz'
                    }, function(err, _car) {
                        car = _car;

                        s.once('myCollection:Car', function(n) {
                            notif = n;
                            done();
                        });
                        car.colours.unshift('green');
                    });

                });

                it('notif contains type', function() {
                    assert.equal(notif.collection, 'myCollection');
                });

                it('notif contains mapping', function() {
                    assert.equal(notif.mapping, 'Car');
                });

                it('notif contains object', function() {
                    assert.equal(notif._id, car._id);
                });

                it('notif contains change', function() {
                    assert.equal(notif.field, 'colours');
                    assert.equal(notif.type, ChangeType.Splice);
                    assert.equal(notif.index, 0);
                    assert.equal(notif.removed.length, 0);
                    assert.equal(notif.added.length, 1);
                });

            });

            describe('sort', function() {
                var notifs = [];

                beforeEach(function(done) {
                    notifs = [];
                    carMapping.map({
                        colours: ['red', 'green', 'blue'],
                        name: 'Aston Martin',
                        id: 'xyz'
                    }, function(err, _car) {
                        car = _car;
                        if (err) done(err);
                        var listener = function(n) {
                            notifs.push(n);
                            if (notifs.length == 2) {
                                s.removeListener('myCollection:Car', listener);
                                done();
                            }
                        };
                        s.on('myCollection:Car', listener);
                        car.colours.sort();

                    });
                });

                it('notif contains colleciton', function() {
                    _.each(notifs, function(notif) {
                        assert.equal(notif.collection, 'myCollection');
                    });
                });

                it('notif contains mapping', function() {
                    _.each(notifs, function(notif) {
                        assert.equal(notif.mapping, 'Car');
                    });
                });

                it('notif contains object', function() {
                    _.each(notifs, function(notif) {
                        assert.equal(notif._id, car._id);
                    });
                });

                it('notif contains change', function() {
                    var removalNotif;
                    var addNotif;
                    _.each(notifs, function(notif) {
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

    describe('relationships', function() {
        var collection;
        var car, person;
        var carMapping, personMapping;

        var Collection = require('../src/collection').Collection;


        beforeEach(function(done) {
            s.reset(true);
            done();
        });

        describe('array', function() {

            var personNotif, personGenericNotif, personCollectionNotif;
            var carNotif, carGenericNotif, carCollectionNotif;

            describe('foreign key', function() {
                beforeEach(function(done) {
                    collection = new Collection('myCollection');

                    carMapping = collection.mapping('Car', {
                        id: 'id',
                        attributes: ['colours', 'name'],
                        relationships: {
                            owner: {
                                mapping: 'Person',
                                type: RelationshipType.OneToMany,
                                reverse: 'cars'
                            }
                        }
                    });

                    personMapping = collection.mapping('Person', {
                        id: 'id',
                        attributes: ['name', 'age']
                    });

                    collection.install(done);
                });

                describe('push', function() {

                    beforeEach(function(done) {
                        car = carMapping._new();
                        var anotherCar = carMapping._new();
                        person = personMapping._new();
                        person.cars = [car];
                        s.on('myCollection:Person', function(n) {
                            if (n.type == ChangeType.Splice && n.mapping == 'Person') {
                                personNotif = n;
                            }
                        });
                        s.on('myCollection', function(n) {
                            if (n.type == ChangeType.Splice && n.mapping == 'Person') {
                                personCollectionNotif = n;
                            }
                        });
                        s.on('Siesta', function(n) {
                            if (n.type == ChangeType.Splice && n.mapping == 'Person') {
                                personGenericNotif = n;
                            }
                        });
                        s.on('myCollection:Car', function(n) {
                            if (n.type == ChangeType.Set && n.mapping == 'Car') {
                                carNotif = n;
                            }
                        });
                        s.on('myCollection', function(n) {
                            if (n.type == ChangeType.Set && n.mapping == 'Car') {
                                carCollectionNotif = n;
                            }
                        });
                        s.on('Siesta', function(n) {
                            if (n.type == ChangeType.Set && n.mapping == 'Car') {
                                carGenericNotif = n;
                            }
                        });
                        person.cars.push(anotherCar);
                        util.next(function() {
                            notificationCentre.removeAllListeners();
                            done();
                        })
                    });


                    it('type', function() {
                        assert.equal(personNotif.type, ChangeType.Splice);
                        assert.equal(personGenericNotif.type, ChangeType.Splice);
                        assert.equal(personCollectionNotif.type, ChangeType.Splice);
                        assert.equal(carNotif.type, ChangeType.Set);
                        assert.equal(carGenericNotif.type, ChangeType.Set);
                        assert.equal(carCollectionNotif.type, ChangeType.Set);
                    });


                });

                describe('splice', function(done) {

                    beforeEach(function(done) {
                        car = carMapping._new();
                        person = personMapping._new();
                        person.cars = [car];
                        s.on('myCollection:Person', function(n) {
                            if (n.type == ChangeType.Splice) {
                                notif = n;
                            }
                        });
                        s.on('myCollection', function(n) {
                            if (n.type == ChangeType.Splice) {
                                collectionNotif = n;
                            }
                        });
                        s.on('Siesta', function(n) {
                            if (n.type == ChangeType.Splice) {
                                genericNotif = n;
                            }
                        });
                        s.on('myCollection:Car', function(n) {
                            if (n.type == ChangeType.Set && n.mapping == 'Car') {
                                carNotif = n;
                            }
                        });
                        s.on('myCollection', function(n) {
                            if (n.type == ChangeType.Set && n.mapping == 'Car') {
                                carCollectionNotif = n;
                            }
                        });
                        s.on('Siesta', function(n) {
                            if (n.type == ChangeType.Set && n.mapping == 'Car') {
                                carGenericNotif = n;
                            }
                        });
                        person.cars.splice(0, 1);
                        util.next(function() {
                            notificationCentre.removeAllListeners();
                            done();
                        })
                    });

                    it('type', function() {
                        assert.equal(notif.type, ChangeType.Splice);
                        assert.equal(genericNotif.type, ChangeType.Splice);
                        assert.equal(collectionNotif.type, ChangeType.Splice);
                        assert.equal(carNotif.type, ChangeType.Set);
                        assert.equal(carGenericNotif.type, ChangeType.Set);
                        assert.equal(carCollectionNotif.type, ChangeType.Set);
                    });

                });

            });

            describe('many to many', function() {
                beforeEach(function(done) {
                    collection = new Collection('myCollection');

                    carMapping = collection.mapping('Car', {
                        id: 'id',
                        attributes: ['colours', 'name'],
                        relationships: {
                            owners: {
                                mapping: 'Person',
                                type: RelationshipType.ManyToMany,
                                reverse: 'cars'
                            }
                        }
                    });

                    personMapping = collection.mapping('Person', {
                        id: 'id',
                        attributes: ['name', 'age']
                    });

                    collection.install(done);
                });

                describe('no faults', function() {

                    describe('push', function(done) {
                        beforeEach(function(done) {
                            car = carMapping._new();
                            var anotherCar = carMapping._new();
                            person = personMapping._new();
                            person.cars = [car];
                            s.on('myCollection:Person', function(n) {
                                if (n.type == ChangeType.Splice && n.mapping == 'Person') {
                                    notif = n;
                                }
                            });
                            s.on('myCollection', function(n) {
                                if (n.type == ChangeType.Splice && n.mapping == 'Person') {
                                    collectionNotif = n;
                                }
                            });
                            s.on('Siesta', function(n) {
                                if (n.type == ChangeType.Splice && n.mapping == 'Person') {
                                    genericNotif = n;
                                }
                            });
                            s.on('myCollection:Car', function(n) {
                                if (n.type == ChangeType.Splice && n.mapping == 'Car') {
                                    carNotif = n;
                                }
                            });
                            s.on('myCollection', function(n) {
                                if (n.type == ChangeType.Splice && n.mapping == 'Car') {
                                    carCollectionNotif = n;
                                }
                            });
                            s.on('Siesta', function(n) {
                                if (n.type == ChangeType.Splice && n.mapping == 'Car') {
                                    carGenericNotif = n;
                                }
                            });
                            person.cars.push(anotherCar);
                            util.next(function() {
                                notificationCentre.removeAllListeners();
                                done();
                            });
                        });


                        it('type', function() {
                            assert.equal(notif.type, ChangeType.Splice);
                            assert.equal(genericNotif.type, ChangeType.Splice);
                            assert.equal(collectionNotif.type, ChangeType.Splice);
                            assert.equal(carNotif.type, ChangeType.Splice);
                            assert.equal(carGenericNotif.type, ChangeType.Splice);
                            assert.equal(carCollectionNotif.type, ChangeType.Splice);
                        });

                    });

                    describe('splice', function() {
                        beforeEach(function(done) {
                            car = carMapping._new();
                            person = personMapping._new();
                            person.cars = [car];
                            s.on('myCollection:Person', function(n) {
                                if (n.type == ChangeType.Splice && n.mapping == 'Person') {
                                    notif = n;
                                }
                            });
                            s.on('myCollection', function(n) {
                                if (n.type == ChangeType.Splice && n.mapping == 'Person') {
                                    collectionNotif = n;
                                }
                            });
                            s.on('Siesta', function(n) {
                                if (n.type == ChangeType.Splice && n.mapping == 'Person') {
                                    genericNotif = n;
                                }
                            });
                            s.on('myCollection:Car', function(n) {
                                if (n.type == ChangeType.Splice && n.mapping == 'Car') {
                                    carNotif = n;
                                }
                            });
                            s.on('myCollection', function(n) {
                                if (n.type == ChangeType.Splice && n.mapping == 'Car') {
                                    carCollectionNotif = n;
                                }
                            });
                            s.on('Siesta', function(n) {
                                if (n.type == ChangeType.Splice && n.mapping == 'Car') {
                                    carGenericNotif = n;
                                }
                            });
                            person.cars.splice(0, 1);
                            util.next(function() {
                                notificationCentre.removeAllListeners();
                                done();
                            })
                        });


                        it('type', function() {
                            assert.equal(notif.type, ChangeType.Splice);
                            assert.equal(genericNotif.type, ChangeType.Splice);
                            assert.equal(collectionNotif.type, ChangeType.Splice);
                            assert.equal(carNotif.type, ChangeType.Splice);
                            assert.equal(carGenericNotif.type, ChangeType.Splice);
                            assert.equal(carCollectionNotif.type, ChangeType.Splice);
                        });

                    });
                });

                // describe('fault in the reverse', function() {
                //     it('push', function(done) {
                //         car = carMapping._new();
                //         var anotherCar = carMapping._new();
                //         person = personMapping._new();
                //         person.cars = [car];
                //         car.ownersProxy.related = null;
                //         person.cars.push(anotherCar);
                //         util.next(function() {
                //             var allChanges = s.ext.storage.changes.allChanges;
                //             assert.equal(allChanges.length, 2);
                //             var splicePredicate = function(x) {
                //                 return x._id === person._id
                //             };
                //             var spliceChange = _.find(allChanges, splicePredicate);
                //             assert.equal(spliceChange.type, ChangeType.Splice);
                //             assert.include(spliceChange.addedId, anotherCar._id);
                //             assert.equal(spliceChange.index, 1);
                //             assert.equal(spliceChange.field, 'cars');
                //             done();
                //         });
                //     });

                //     it('splice', function(done) {
                //         car = carMapping._new();
                //         person = personMapping._new();
                //         person.cars = [car];
                //         s.ext.storage.changes.resetChanges();
                //         car.ownersProxy.related = null;
                //         person.cars.splice(0, 1);
                //         util.next(function() {
                //             var allChanges = s.ext.storage.changes.allChanges;
                //             assert.equal(allChanges.length, 2);
                //             var personPred = function(x) {
                //                 return x._id === person._id
                //             };
                //             var personChange = _.find(allChanges, personPred);
                //             var carPred = function(x) {
                //                 return x._id === car._id
                //             };
                //             var carChange = _.find(allChanges, carPred);
                //             assert.include(personChange.removed, car);
                //             assert.notOk(car.ownersProxy._id.length);
                //             assert.equal(personChange.type, ChangeType.Splice);
                //             done();
                //         });
                //     });
                // });
            });

        });

    });

    describe('new object', function() {

        beforeEach(function(done) {
            notif = null;
            genericNotif = null;
            collectionNotif = null;
            collection = new Collection('myCollection');
            carMapping = collection.mapping('Car', {
                id: 'id',
                attributes: ['colour', 'name']
            });
            collection.install(function(err) {
                if (err) done(err);
                s.on('myCollection:Car', function(n) {
                    if (n.type == ChangeType.New) {
                        notif = n;
                    }
                });
                s.on('myCollection', function(n) {
                    if (n.type == ChangeType.New) {
                        collectionNotif = n;
                    }
                });
                s.on('Siesta', function(n) {
                    if (n.type == ChangeType.New) {
                        genericNotif = n;
                    }
                });
                carMapping.map({
                    colour: 'red',
                    name: 'Aston Martin',
                    id: 'xyz'
                }, function(err, _car) {
                    if (err) {
                        done(err);
                    } else {
                        car = _car;
                        notificationCentre.removeAllListeners();
                        done();
                    }
                });
            });
        });

        it('is notif', function() {
            assert.ok(notif);
        });

        it('is genericNotif', function() {
            assert.ok(genericNotif);
        });

        it('is collectionNotif', function() {
            assert.ok(collectionNotif);
        });

        it('type is New', function() {
            assert.equal(notif.type, ChangeType.New);
            assert.equal(genericNotif.type, ChangeType.New);
            assert.equal(collectionNotif.type, ChangeType.New);
        });

        it('new', function() {
            assert.equal(notif.new, car);
            assert.equal(genericNotif.new, car);
            assert.equal(collectionNotif.new, car);
        });

        it('_id', function() {
            assert.equal(notif.newId, car._id);
            assert.equal(genericNotif.newId, car._id);
            assert.equal(collectionNotif.newId, car._id);
            assert.equal(notif._id, car._id);
            assert.equal(genericNotif._id, car._id);
            assert.equal(collectionNotif._id, car._id);
        });

    });

    describe('object removal', function() {

        beforeEach(function(done) {
            notif = null;
            genericNotif = null;
            collectionNotif = null;
            collection = new Collection('myCollection');
            carMapping = collection.mapping('Car', {
                id: 'id',
                attributes: ['colour', 'name']
            });
            collection.install(function(err) {
                if (err) done(err);
                carMapping.map({
                    colour: 'red',
                    name: 'Aston Martin',
                    id: 'xyz'
                }, function(err, _car) {
                    if (err) {
                        done(err);
                    } else {
                        car = _car;
                        s.on('myCollection:Car', function(n) {
                            if (n.type == ChangeType.Remove) {
                                notif = n;
                            }
                        });
                        s.on('myCollection', function(n) {
                            if (n.type == ChangeType.Remove) {
                                collectionNotif = n;
                            }
                        });
                        s.on('Siesta', function(n) {
                            if (n.type == ChangeType.Remove) {
                                genericNotif = n;
                            }
                        });
                        car.remove();
                        notificationCentre.removeAllListeners();
                        done();
                    }
                });
            });
        });

        it('is notif', function() {
            assert.ok(notif);
        });

        it('is genericNotif', function() {
            assert.ok(genericNotif);
        });

        it('is collectionNotif', function() {
            assert.ok(collectionNotif);
        });

        it('type is New', function() {
            assert.equal(notif.type, ChangeType.Remove);
            assert.equal(genericNotif.type, ChangeType.Remove);
            assert.equal(collectionNotif.type, ChangeType.Remove);
        });

        it('new', function() {
            assert.equal(notif.old, car);
            assert.equal(genericNotif.old, car);
            assert.equal(collectionNotif.old, car);
        });

        it('_id', function() {
            assert.equal(notif.oldId, car._id);
            assert.equal(genericNotif.oldId, car._id);
            assert.equal(collectionNotif.oldId, car._id);
            assert.equal(notif._id, car._id);
            assert.equal(genericNotif._id, car._id);
            assert.equal(collectionNotif._id, car._id);
        });

    });

    describe('object restoration', function() {
        beforeEach(function(done) {
            notif = null;
            genericNotif = null;
            collectionNotif = null;
            collection = new Collection('myCollection');
            carMapping = collection.mapping('Car', {
                id: 'id',
                attributes: ['colour', 'name']
            });
            collection.install(function(err) {
                if (err) done(err);
                carMapping.map({
                    colour: 'red',
                    name: 'Aston Martin',
                    id: 'xyz'
                }, function(err, _car) {
                    if (err) {
                        done(err);
                    } else {
                        car = _car;
                        car.remove();
                        s.on('myCollection:Car', function(n) {
                            if (n.type == ChangeType.New) {
                                notif = n;
                            }
                        });
                        s.on('myCollection', function(n) {
                            if (n.type == ChangeType.New) {
                                collectionNotif = n;
                            }
                        });
                        s.on('Siesta', function(n) {
                            if (n.type == ChangeType.New) {
                                genericNotif = n;
                            }
                        });
                        car.restore();
                        notificationCentre.removeAllListeners();
                        done();
                    }
                });
            });
        });

        it('is notif', function() {
            assert.ok(notif);
        });

        it('is genericNotif', function() {
            assert.ok(genericNotif);
        });

        it('is collectionNotif', function() {
            assert.ok(collectionNotif);
        });

        it('type is New', function() {
            assert.equal(notif.type, ChangeType.New);
            assert.equal(genericNotif.type, ChangeType.New);
            assert.equal(collectionNotif.type, ChangeType.New);
        });

        it('new', function() {
            assert.equal(notif.new, car);
            assert.equal(genericNotif.new, car);
            assert.equal(collectionNotif.new, car);
        });

        it('_id', function() {
            assert.equal(notif.newId, car._id);
            assert.equal(genericNotif.newId, car._id);
            assert.equal(collectionNotif.newId, car._id);
            assert.equal(notif._id, car._id);
            assert.equal(genericNotif._id, car._id);
            assert.equal(collectionNotif._id, car._id);
        });
    });

});