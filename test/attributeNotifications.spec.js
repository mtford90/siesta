var s = require('../index')
    , assert = require('chai').assert;

describe('notifications', function () {

    var Collection = require('../src/collection').Collection
        , ChangeType = require('../src/changeType').ChangeType;

    beforeEach(function () {
        s.reset(true);
    });

    describe('attributes', function () {
        var collection, carMapping;
        var car;

        var notif, collectionNotif, genericNotif;

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

                collection = new Collection('myCollection');
                carMapping = collection.mapping('Car', {
                    id: 'id',
                    attributes: ['colour', 'name']
                });
                collection.install(function (err) {
                    if (err) done(err);
                    carMapping.map({colour: 'red', name: 'Aston Martin', id: 'xyz'}, function (err, _car) {
                        car = _car;
                        if (err) done(err);
                        s.once('myCollection:Car', function (n) {
                            notif = n;
                            if (notif && genericNotif && collectionNotif) {
                                done();
                            }
                        });
                        s.once('myCollection', function (n) {
                            collectionNotif = n;
                            if (notif && genericNotif && collectionNotif) {
                                done();
                            }
                        });
                        s.once('Fount', function (n) {
                            genericNotif = n;
                            if (notif && genericNotif && collectionNotif) {
                                done();
                            }
                        });
                        car.colour = 'blue';

                    });
                });

            });


            it('notif contains type', function () {
                assert.equal(notif.collection, 'myCollection');
            });

            it('notif contains collection', function () {
                assert.equal(notif.type, 'Car');
            });

            it('notif contains object', function () {
                assert.equal(notif.obj, car);
            });

            it('changeDict contains attribute name', function () {
                var change = notif.change;
                assert.equal(change.field, 'colour');
            });

            it('changeDict contains change type', function () {
                var change = notif.change;
                assert.equal(change.type, ChangeType.Set);
            });

            it('changeDict contains old value', function () {
                var change = notif.change;
                assert.equal(change.old, 'red');
            });

            it('changeDict contains new value', function () {
                var change = notif.change;
                assert.equal(change.new, 'blue');
            });

        });

        describe('array notifications', function () {
            beforeEach(function (done) {
                collection = new Collection('myCollection');
                carMapping = collection.mapping('Car', {
                    id: 'id',
                    attributes: ['colours', 'name']
                });
                collection.install(done);
            });

            it('sends notifications for all levels', function (done) {
                var notifs = [];
                carMapping.map({colours: ['red', 'blue'], name: 'Aston Martin', id: 'xyz'}, function (err, _car) {
                    car = _car;
                    if (err) done(err);
                    var listener = function (n) {
                        notifs.push(n);
                        if (notifs.length >= 3) {
                            done();
                        }
                    };
                    s.once('myCollection:Car', listener);
                    s.once('myCollection', listener);
                    s.once('Fount', listener);
                    car.colours.push('green');
                });
            });

            describe('push', function () {
                beforeEach(function (done) {
                    carMapping.map({colours: ['red', 'blue'], name: 'Aston Martin', id: 'xyz'}, function (err, _car) {
                        car = _car;
                        if (err) done(err);
                        s.once('myCollection:Car', function (n) {
                            notif = n;
                            done();
                        });
                        car.colours.push('green');

                    });
                });

                it('notif contains type', function () {
                    assert.equal(notif.collection, 'myCollection');
                });

                it('notif contains collection', function () {
                    assert.equal(notif.type, 'Car');
                });

                it('notif contains object', function () {
                    assert.equal(notif.obj, car);
                });

                it('changeDict contains change', function () {
                    var change = notif.change;
                    assert.equal(change.field, 'colours');
                    assert.equal(change.type, ChangeType.Splice);
                    assert.equal(change.index, 2);
                    assert.equal(change.removed.length, 0);
                    assert.equal(change.addedCount, 1);
                });

            });

            describe('pop', function () {
                beforeEach(function (done) {
                    carMapping.map({colours: ['red', 'blue'], name: 'Aston Martin', id: 'xyz'}, function (err, _car) {
                        car = _car;
                        if (err) done(err);
                        s.once('myCollection:Car', function (n) {
                            notif = n;
                            done();
                        });
                        car.colours.pop();

                    });
                });

                it('notif contains type', function () {
                    assert.equal(notif.collection, 'myCollection');
                });

                it('notif contains collection', function () {
                    assert.equal(notif.type, 'Car');
                });

                it('notif contains object', function () {
                    assert.equal(notif.obj, car);
                });

                it('notif contains change', function () {
                    var change = notif.change;
                    assert.equal(change.field, 'colours');
                    assert.equal(change.type, ChangeType.Splice);
                    assert.equal(change.index, 1);
                    assert.equal(change.removed.length, 1);
                    assert.include(change.removed, 'blue');
                    assert.equal(change.addedCount, 0);
                });
            });

            describe('shift', function () {
                beforeEach(function (done) {
                    carMapping.map({colours: ['red', 'blue'], name: 'Aston Martin', id: 'xyz'}, function (err, _car) {
                        car = _car;
                        if (err) done(err);
                        s.once('myCollection:Car', function (n) {
                            notif = n;
                            done();
                        });
                        car.colours.shift();
                    });
                });

                it('notif contains type', function () {
                    assert.equal(notif.collection, 'myCollection');
                });

                it('notif contains collection', function () {
                    assert.equal(notif.type, 'Car');
                });

                it('notif contains object', function () {
                    assert.equal(notif.obj, car);
                });

                it('notif contains change', function () {
                    var change = notif.change;
                    assert.equal(change.field, 'colours');
                    assert.equal(change.type, ChangeType.Splice);
                    assert.equal(change.index, 0);
                    assert.equal(change.removed.length, 1);
                    assert.include(change.removed, 'red');
                    assert.equal(change.addedCount, 0);

                });


            });

            describe('unshift', function () {
                beforeEach(function (done) {
                    carMapping.map({colours: ['red', 'blue'], name: 'Aston Martin', id: 'xyz'}, function (err, _car) {
                        car = _car;
                        car.save(function (err) {
                            if (err) done(err);
                            s.once('myCollection:Car', function (n) {
                                notif = n;
                                done();
                            });
                            car.colours.unshift('green');
                        });
                    });

                });

                it('notif contains type', function () {
                    assert.equal(notif.collection, 'myCollection');
                });

                it('notif contains collection', function () {
                    assert.equal(notif.type, 'Car');
                });

                it('notif contains object', function () {
                    assert.equal(notif.obj, car);
                });

                it('notif contains change', function () {
                    var change = notif.change;
                    assert.equal(change.field, 'colours');
                    assert.equal(change.type, ChangeType.Splice);
                    assert.equal(change.index, 0);
                    assert.equal(change.removed.length, 0);
                    assert.equal(change.addedCount, 1);
                });

            });

            describe('sort', function () {
                var notifs = [];

                beforeEach(function (done) {
                    notifs = [];
                    carMapping.map({colours: ['red', 'green', 'blue'], name: 'Aston Martin', id: 'xyz'}, function (err, _car) {
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

                    });
                });

                it('notif contains type', function () {
                    _.each(notifs, function (notif) {
                        assert.equal(notif.collection, 'myCollection');
                    });
                });

                it('notif contains collection', function () {
                    _.each(notifs, function (notif) {
                        assert.equal(notif.type, 'Car');
                    });
                });

                it('notif contains object', function () {
                    _.each(notifs, function (notif) {
                        assert.equal(notif.obj, car);
                    });
                });

                it('notif contains change', function () {
                    var removalNotif;
                    var addNotif;
                    _.each(notifs, function (notif) {
                        var change = notif.change;
                        assert.equal(change.field, 'colours');
                        assert.equal(change.type, ChangeType.Splice);
                        if (change.removed.length) {
                            removalNotif = notif;
                        }
                        else if (change.addedCount) {
                            addNotif = notif;
                        }
                    });


                });
            });
        });

    });

});