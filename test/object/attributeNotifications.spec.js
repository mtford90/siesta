var s = require('../../index')
    , assert = require('chai').assert;

describe('notifications', function () {

    var Collection = require('../../src/collection').Collection
        , ChangeType = require('../../src/changeType').ChangeType;

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
                            dump(n.change.new);
                            notif = n;
                            if (notif && genericNotif && collectionNotif) {
                                done();
                            }
                        });
                        s.once('myCollection', function (n) {
                            dump(n.change.new);
                            collectionNotif = n;
                            if (notif && genericNotif && collectionNotif) {
                                done();
                            }
                        });
                        s.once('Fount', function (n) {
                            dump(n.change.new);
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

                it('changeDict contains attribute name', function () {
                    var change = notif.change;
                    assert.equal(change.field, 'colours');
                });

                it('changeDict contains change type', function () {
                    var change = notif.change;
                    assert.equal(change.type, ChangeType.Insert);
                });

                it('changeDict contains new value', function () {
                    var change = notif.change;

                    assert.equal(change.new.length, 1);
                    assert.include(change.new, 'green');
                });

                it('changeDict contains index', function () {
                    var change = notif.change;
                    assert.equal(change.index, 2);
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

                it('changeDict contains attribute name', function () {
                    var change = notif.change;
                    assert.equal(change.field, 'colours');
                });

                it('changeDict contains change type', function () {
                    var change = notif.change;
                    assert.equal(change.type, ChangeType.Remove);
                });

                it('changeDict contains old value', function () {
                    var change = notif.change;

                    assert.equal(change.old.length, 1);
                    assert.include(change.old, 'blue');
                });

                it('changeDict contains index', function () {
                    var change = notif.change;
                    assert.equal(change.index, 1);
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

                it('changeDict contains attribute name', function () {
                    var change = notif.change;
                    assert.equal(change.field, 'colours');
                });

                it('changeDict contains change type', function () {
                    var change = notif.change;
                    assert.equal(change.type, ChangeType.Remove);
                });

                it('changeDict contains old value', function () {
                    var change = notif.change;

                    assert.equal(change.old.length, 1);
                    assert.include(change.old, 'red');
                });

                it('changeDict contains index', function () {
                    var change = notif.change;
                    assert.equal(change.index, 0);
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

                it('changeDict contains attribute name', function () {
                    var change = notif.change;
                    assert.equal(change.field, 'colours');
                });

                it('changeDict contains change type', function () {
                    var change = notif.change;
                    assert.equal(change.type, ChangeType.Insert);
                });

                it('changeDict contains new value', function () {
                    var change = notif.change;

                    assert.equal(change.new.length, 1);
                    assert.include(change.new, 'green');
                });

                it('changeDict contains index', function () {
                    var change = notif.change;
                    assert.equal(change.index, 0);
                });

            });

            describe('sort', function () {
                beforeEach(function (done) {
                    carMapping.map({colours: ['red', 'green', 'blue'], name: 'Aston Martin', id: 'xyz'}, function (err, _car) {
                        car = _car;
                        if (err) done(err);
                        s.once('myCollection:Car', function (n) {
                            notif = n;

                            done();
                        });
                        car.colours.sort();

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
                    assert.equal(change.field, 'colours');
                });

                it('changeDict contains change type', function () {
                    var change = notif.change;
                    assert.equal(change.type, ChangeType.Move);
                });

                it('changeDict contains indexes', function () {
                    var change = notif.change;

                    assert.equal(change.indexes.length, 1);
                });

                it('correct order', function () {
                    assert.equal(car.colours[0], 'blue');
                    assert.equal(car.colours[1], 'green');
                    assert.equal(car.colours[2], 'red');
                })
            });

            describe('reverse', function () {
                beforeEach(function (done) {
                    carMapping.map({colours: ['red', 'green', 'blue'], name: 'Aston Martin', id: 'xyz'}, function (err, _car) {
                        car = _car;
                        if (err) done(err);
                        s.once('myCollection:Car', function (n) {
                            notif = n;

                            done();
                        });
                        car.colours.reverse();

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
                    assert.equal(change.field, 'colours');
                });

                it('changeDict contains change type', function () {
                    var change = notif.change;
                    assert.equal(change.type, ChangeType.Move);
                });

                it('changeDict contains indexes', function () {
                    var change = notif.change;

                    assert.equal(change.indexes.length, 1);
                });

                it('correct order', function () {
                    assert.equal(car.colours[0], 'blue');
                    assert.equal(car.colours[1], 'green');
                    assert.equal(car.colours[2], 'red');
                })
            });

            describe('assign', function () {
                beforeEach(function (done) {
                    carMapping.map({colours: ['red', 'green', 'blue'], name: 'Aston Martin', id: 'xyz'}, function (err, _car) {
                        car = _car;
                        if (err) done(err);
                        s.once('myCollection:Car', function (n) {
                            notif = n;

                            done();
                        });
                        car.colours.setObjectAtIndex('purple', 1);

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
                    assert.equal(change.field, 'colours');
                });

                it('changeDict contains change type', function () {
                    var change = notif.change;
                    assert.equal(change.type, ChangeType.Replace);
                });

                it('changeDict contains old value', function () {
                    var change = notif.change;
                    assert.equal(change.old, 'green');
                });

                it('changeDict contains new value', function () {
                    var change = notif.change;
                    assert.equal(change.new, 'purple');
                });

                it('changeDict contains index', function () {
                    var change = notif.change;
                    assert.equal(change.index, 1);
                });


            });

            describe('splice', function () {

                describe('add 1', function () {
                    beforeEach(function (done) {
                        car = carMapping.map({colours: ['red', 'green', 'blue'], name: 'Aston Martin', id: 'xyz'}, function (err, _car) {
                            car = _car;
                            if (err) done(err);
                            s.once('myCollection:Car', function (n) {
                                notif = n;

                                done();
                            });
                            car.colours.splice(1, 0, 'purple');

                        });
                    });

                    it('array has changed as expected', function () {
                        assert.equal(car.colours.length, 4);
                        assert.equal(car.colours[0], 'red');
                        assert.equal(car.colours[1], 'purple');
                        assert.equal(car.colours[2], 'green');
                        assert.equal(car.colours[3], 'blue');
                    });

                    it('changeDict contains attribute name', function () {
                        var change = notif.change;
                        assert.equal(change.length, 1);
                        assert.equal(change[0].field, 'colours');
                    });

                    it('changeDict contains change type', function () {
                        var change = notif.change;
                        assert.equal(change.length, 1);
                        assert.equal(change[0].type, ChangeType.Insert);
                    });

                    it('changeDict contains index', function () {
                        var change = notif.change;
                        assert.equal(change.length, 1);
                        assert.equal(change[0].index, 1);
                    });

                    it('changeDict contains new', function () {
                        var change = notif.change;
                        assert.equal(change.length, 1);
                        assert.equal(change[0].new.length, 1);
                        assert.include(change[0].new, 'purple');
                    });
                });

                describe('delete 1, add 1', function () {
                    beforeEach(function (done) {
                        carMapping.map({colours: ['red', 'green', 'blue'], name: 'Aston Martin', id: 'xyz'}, function (err, _car) {
                            car = _car;
                            if (err) done(err);
                            s.once('myCollection:Car', function (n) {
                                notif = n;

                                done();
                            });
                            car.colours.splice(1, 1, 'purple');

                        });
                    });

                    it('array has changed as expected', function () {
                        assert.equal(car.colours.length, 3);
                        assert.equal(car.colours[0], 'red');
                        assert.equal(car.colours[1], 'purple');
                        assert.equal(car.colours[2], 'blue');
                    });

                    it('changeDict contains attribute name', function () {
                        var change = notif.change;
                        assert.equal(change.length, 1);
                        assert.equal(change[0].field, 'colours');
                    });

                    it('changeDict contains change type', function () {
                        var change = notif.change;
                        assert.equal(change.length, 1);
                        assert.equal(change[0].type, ChangeType.Replace);
                    });

                    it('changeDict contains index', function () {
                        var change = notif.change;
                        assert.equal(change.length, 1);
                        assert.equal(change[0].index, 1);
                    });

                    it('changeDict contains new', function () {
                        var change = notif.change;
                        assert.equal(change.length, 1);
                        assert.equal(change[0].new.length, 1);
                        assert.include(change[0].new, 'purple');
                    });

                    it('changeDict contains old', function () {
                        var change = notif.change;
                        assert.equal(change.length, 1);
                        assert.equal(change[0].old.length, 1);
                        assert.include(change[0].old, 'green');
                    });
                });

                describe('delete 2', function () {
                    beforeEach(function (done) {
                        carMapping.map({colours: ['red', 'green', 'blue'], name: 'Aston Martin', id: 'xyz'}, function (err, _car) {
                            car = _car;
                            if (err) done(err);
                            s.once('myCollection:Car', function (n) {
                                notif = n;

                                done();
                            });
                            car.colours.splice(1, 2);

                        });

                    });

                    it('array has changed as expected', function () {
                        assert.equal(car.colours.length, 1);
                        assert.equal(car.colours[0], 'red');
                    });

                    it('changeDict contains attribute name', function () {
                        var change = notif.change;
                        assert.equal(change.length, 1);
                        assert.equal(change[0].field, 'colours');
                    });

                    it('changeDict contains change type', function () {
                        var change = notif.change;
                        assert.equal(change.length, 1);
                        assert.equal(change[0].type, ChangeType.Remove);
                    });

                    it('changeDict contains index', function () {
                        var change = notif.change;
                        assert.equal(change.length, 1);
                        assert.equal(change[0].index, 1);
                    });

                    it('changeDict contains old', function () {
                        var change = notif.change;
                        assert.equal(change.length, 1);
                        assert.equal(change[0].old.length, 2);
                        assert.include(change[0].old, 'green');
                        assert.include(change[0].old, 'blue');
                    });
                });

                describe('delete 2, add 1', function () {
                    beforeEach(function (done) {
                        carMapping.map({colours: ['red', 'green', 'blue'], name: 'Aston Martin', id: 'xyz'}, function (err, _car) {
                            car = _car;
                            if (err) done(err);
                            s.once('myCollection:Car', function (n) {
                                notif = n;
                                done();
                            });
                            car.colours.splice(1, 2, 'purple');

                        });
                    });

                    it('array has changed as expected', function () {
                        assert.equal(car.colours.length, 2);
                        assert.equal(car.colours[0], 'red');
                        assert.equal(car.colours[1], 'purple');
                    });

                    it('changeDict contains attribute name', function () {
                        var change = notif.change;
                        assert.equal(change.length, 2);
                        assert.equal(change[0].field, 'colours');
                        assert.equal(change[1].field, 'colours');
                    });

                    it('changeDict contains change type', function () {
                        var change = notif.change;
                        assert.equal(change.length, 2);
                        var removalChange = change[0];
                        var replacementChange = change[1];
                        assert.equal(removalChange.type, ChangeType.Remove);
                        assert.equal(replacementChange.type, ChangeType.Replace);
                    });

                    it('changeDict contains index', function () {
                        var change = notif.change;
                        assert.equal(change.length, 2);
                        var removalChange = change[0];
                        var replacementChange = change[1];
                        assert.equal(removalChange.index, 2);
                        assert.equal(replacementChange.index, 1);
                    });

                    it('changeDict contains old', function () {
                        var change = notif.change;
                        assert.equal(change.length, 2);
                        var removalChange = change[0];
                        var replacementChange = change[1];
                        assert.include(removalChange.old, 'blue');
                        assert.include(replacementChange.old, 'green');
                    });

                    it('changeDict contains new', function () {
                        var change = notif.change;
                        assert.equal(change.length, 2);
                        var replacementChange = change[1];
                        assert.include(replacementChange.new, 'purple');
                    });
                });

                describe('delete 2, add 3', function () {
                    beforeEach(function (done) {
                        carMapping.map({colours: ['red', 'green', 'blue'], name: 'Aston Martin', id: 'xyz'}, function (err, _car) {
                            car = _car;
                            if (err) done(err);
                            s.once('myCollection:Car', function (n) {
                                notif = n;
                                done();
                            });
                            car.colours.splice(1, 2, 'purple', 'yellow', 'indigo');

                        });

                    });

                    it('array has changed as expected', function () {
                        assert.equal(car.colours.length, 4);
                        assert.equal(car.colours[0], 'red');
                        assert.equal(car.colours[1], 'purple');
                        assert.equal(car.colours[2], 'yellow');
                        assert.equal(car.colours[3], 'indigo');
                    });

                    it('changeDict contains attribute name', function () {
                        var change = notif.change;
                        assert.equal(change.length, 2);
                        assert.equal(change[0].field, 'colours');
                        assert.equal(change[1].field, 'colours');
                    });

                    it('changeDict contains change type', function () {
                        var change = notif.change;
                        assert.equal(change.length, 2);
                        var removalChange = change[0];
                        var replacementChange = change[1];
                        assert.equal(removalChange.type, ChangeType.Replace);
                        assert.equal(replacementChange.type, ChangeType.Insert);
                    });

                    it('changeDict contains index', function () {
                        var change = notif.change;
                        assert.equal(change.length, 2);
                        var replacementChange = change[0];
                        var insertionChange = change[1];
                        assert.equal(replacementChange.index, 1);
                        assert.equal(insertionChange.index, 3);
                    });

                });

            });

        });

    });

});