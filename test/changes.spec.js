var s = require('../index')
    , assert = require('./util').assert;

describe('changes!', function () {

    var sut = require('../src/changes');
    var ChangeType = require('../src/changeType').ChangeType;
    var RelationshipType = require('../src/relationship').RelationshipType;
    var Change = sut.Change;

    var RestError = require('../src/error').RestError;

    var Collection = require('../src/collection').Collection;

    var pouch = require('../src/pouch');
    var cache = require('../src/cache');

    var collection, carMapping;

    beforeEach(function () {
        s.reset(true);
    });

    describe('registering changes', function () {
        beforeEach(function (done) {
            collection = new Collection('myCollection');
            carMapping = collection.mapping('Car', {
                id: 'id',
                attributes: ['colour', 'name']
            });
            collection.install(done);
        });

        it('registers a change', function () {
            sut.registerChange({
                collection: collection,
                mapping: carMapping,
                _id: 'xyz'
            });
            var objChanges = sut.changes[collection.name][carMapping.type]['xyz'];
            assert.equal(objChanges.length, 1);
            var change = objChanges[0];
            assert.equal(change.collection, collection);
            assert.equal(change.mapping, carMapping);
            assert.equal(change._id, 'xyz');
        });

        describe('errors', function () {
            it('should throw an error if no mapping', function () {
                assert.throws(
                    function () {
                        sut.registerChange({
                            collection: collection,
                            _id: 'xyz'
                        })
                    }, RestError
                );
            });

            it('should throw an error if no collection', function () {
                assert.throws(
                    function () {
                        sut.registerChange({
                            mapping: carMapping,
                            _id: 'xyz'
                        })
                    }, RestError
                );
            });

            it('should throw an error if no _id', function () {
                assert.throws(
                    function () {
                        sut.registerChange({
                            mapping: carMapping,
                            collection: collection
                        })
                    }, RestError
                );
            })
        });
    });

    describe('all changes', function () {
        beforeEach(function (done) {
            collection = new Collection('myCollection');
            carMapping = collection.mapping('Car', {
                id: 'id',
                attributes: ['colour', 'name']
            });
            collection.install(done);
        });

        it('all changes', function () {
            sut.changes = {
                collection: {
                    mapping1: {
                        xyz: ['adsd', 'asdas']
                    },
                    mapping2: {
                        xyz1: ['dsasda', 'fh43']
                    }
                },
                anotherCollection: {
                    anotherMapping: {
                        obj1: ['asd'],
                        obj2: ['123', '567']
                    }
                }
            };

            assert.equal(sut.allChanges.length, 7);
            assert.include(sut.allChanges, 'adsd');
            assert.include(sut.allChanges, 'asdas');
            assert.include(sut.allChanges, 'dsasda');
            assert.include(sut.allChanges, 'fh43');
            assert.include(sut.allChanges, 'asd');
            assert.include(sut.allChanges, '123');
            assert.include(sut.allChanges, '567');
        });
    });

    describe('applying changes', function () {

        describe('set', function () {
            beforeEach(function (done) {
                collection = new Collection('myCollection');
                carMapping = collection.mapping('Car', {
                    id: 'id',
                    attributes: ['colour', 'name']
                });
                collection.install(done);
            });

            it('set', function () {
                var obj = carMapping._new({colour: 'red', name: 'Aston Martin'});
                var c = new Change();
                c.collection = collection;
                c.mapping = carMapping;
                c.field = 'colour';
                c.type = ChangeType.Set;
                c.new = 'blue';
                c.old = 'red';
                c._id = obj._id;
                c.apply(obj);
                assert.equal(obj.colour, 'blue');
            });

            describe('errors', function () {


                it('incorrect _id', function () {
                    var obj = carMapping._new({colour: 'red', name: 'Aston Martin'});
                    var c = new Change();
                    c.collection = collection;
                    c.mapping = carMapping;
                    c.field = 'colour';
                    c.type = ChangeType.Set;
                    c.new = 'blue';
                    c.old = 'red';
                    c._id = 'randomid';
                    assert.throws(function () {
                        c.apply(obj);
                    }, RestError);
                });
                it('old does not match current', function () {
                    var obj = carMapping._new({colour: 'red', name: 'Aston Martin'});
                    var c = new Change();
                    c.collection = collection;
                    c.mapping = carMapping;
                    c.field = 'colour';
                    c.type = ChangeType.Set;
                    c.new = 'blue';
                    c.old = 'purple';
                    c._id = obj._id;
                    assert.throws(function () {
                        c.apply(obj);
                    }, RestError);
                });
            })
        });

        describe('splice', function () {

            beforeEach(function (done) {
                collection = new Collection('myCollection');
                carMapping = collection.mapping('Car', {
                    id: 'id',
                    attributes: ['colours', 'name']
                });
                collection.install(done);
            });

            it('works', function () {
                var obj = carMapping._new({colours: ['red', 'blue'], name: 'Aston Martin'});
                var c = new Change();
                c.collection = collection;
                c.mapping = carMapping;
                c.field = 'colours';
                c.type = ChangeType.Splice;
                c.index = 1;
                c.added = ['green'];
                c.removed = ['blue'];
                c._id = obj._id;
                c.apply(obj);
                assert.equal(obj.colours.length, 2);
                assert.equal(obj.colours[0], 'red');
                assert.equal(obj.colours[1], 'green');
            });

            describe('errors', function () {
                it('no remove or added', function () {
                    var obj = carMapping._new({colours: ['red', 'blue'], name: 'Aston Martin'});
                    var c = new Change();
                    c.collection = collection;
                    c.mapping = carMapping;
                    c.field = 'colours';
                    c.type = ChangeType.Splice;
                    c.index = 2;
                    c._id = obj._id;
                    assert.throws(function () {
                        c.apply(obj);
                    }, RestError);
                });
                it('no index', function () {
                    var obj = carMapping._new({colours: ['red', 'blue'], name: 'Aston Martin'});
                    var c = new Change();
                    c.collection = collection;
                    c.mapping = carMapping;
                    c.field = 'colours';
                    c.type = ChangeType.Splice;
                    c.added = ['green'];
                    c.removedCount = 1;
                    c._id = obj._id;
                    assert.throws(function () {
                        c.apply(obj);
                    }, RestError);
                });
                it('removed doesnt match', function () {
                    var obj = carMapping._new({colours: ['red', 'blue'], name: 'Aston Martin'});
                    var c = new Change();
                    c.collection = collection;
                    c.mapping = carMapping;
                    c.field = 'colours';
                    c.type = ChangeType.Splice;
                    c.index = 1;
                    c.added = ['green'];
                    c.removed = ['purple'];
                    c._id = obj._id;
                    assert.throws(function () {
                        c.apply(obj);
                    }, RestError);
                });
            });
        });

        describe('remove', function () {
            it('works', function () {
                var obj = carMapping._new({colours: ['red', 'blue'], name: 'Aston Martin'});
                var c = new Change();
                c.collection = collection;
                c.mapping = carMapping;
                c.field = 'colours';
                c.type = ChangeType.Remove;
                c.removed = ['red'];
                c._id = obj._id;
                c.apply(obj);
                assert.equal(obj.colours.length, 1);
                assert.equal(obj.colours[0], 'blue');
            });
            describe('errors', function () {
                it('no removed', function () {
                    var obj = carMapping._new({colours: ['red', 'blue'], name: 'Aston Martin'});
                    var c = new Change();
                    c.collection = collection;
                    c.mapping = carMapping;
                    c.field = 'colours';
                    c.type = ChangeType.Remove;
                    c._id = obj._id;
                    assert.throws(function () {
                        c.apply(obj);
                    }, RestError);
                });

            });
        })

    });

    describe('merge changes', function () {

        function testMerge(changes, docs, callback) {
            sut.changes = changes;
            var db = pouch.getPouch();
            db.bulkDocs(docs, function (err) {
                if (err) {
                    callback(err);
                }
                else {
                    sut.mergeChanges(function (err) {
                        if (err) {
                            callback(err);
                        }
                        else {
                            db.allDocs({keys: _.pluck(docs, '_id'), include_docs: true}, function (err, resp) {
                                if (err) {
                                    callback(err);
                                }
                                else {
                                    callback(null, _.pluck(resp.rows, 'doc'));
                                }
                            })
                        }
                    });
                }
            });
        }

        describe('set', function () {


            describe('attribute', function () {
                beforeEach(function (done) {
                    collection = new Collection('myCollection');
                    carMapping = collection.mapping('Car', {
                        id: 'id',
                        attributes: ['colour', 'name']
                    });
                    collection.install(done);
                });
                it('set attribute', function (done) {
                    var changes = {
                        myCollection: {
                            Car: {
                                localId: [
                                    new Change({
                                        collection: collection,
                                        mapping: carMapping,
                                        field: 'colour',
                                        type: ChangeType.Set,
                                        new: 'blue',
                                        old: 'red',
                                        _id: 'localId'
                                    })
                                ]
                            }
                        }
                    };

                    var docs = [
                        {
                            _id: 'localId',
                            name: 'Aston Martin',
                            colour: 'red',
                            collection: 'myCollection',
                            type: 'Car'
                        }
                    ];

                    testMerge(changes, docs, function (err, docs) {
                        if (err) {
                            done(err);
                        }
                        else {
                            var doc = docs[0];
                            assert.equal(doc.colour, 'blue');
                            assert.notOk(sut.allChanges.length);
                            done();
                        }
                    });
                });

            });

            describe('relationship', function () {

                var personMapping;
                describe('foreign key', function () {
                    beforeEach(function (done) {
                        collection = new Collection('myCollection');
                        carMapping = collection.mapping('Car', {
                            id: 'id',
                            attributes: ['colour', 'name'],
                            relationships: {
                                owner: {
                                    type: RelationshipType.ForeignKey,
                                    reverse: 'cars',
                                    mapping: 'Person'
                                }
                            }
                        });
                        personMapping = collection.mapping('Person', {
                            id: 'id',
                            attributes: ['name', 'age']
                        });
                        collection.install(done);
                    });

                    it('forward', function (done) {
                        var changes = {
                            myCollection: {
                                Car: {
                                    carId: [
                                        new Change({
                                            collection: collection,
                                            mapping: carMapping,
                                            field: 'owner',
                                            type: ChangeType.Set,
                                            newId: 'personId',
                                            oldId: null,
                                            _id: 'carId'
                                        })
                                    ]
                                }
                            }
                        };
                        var docs = [
                            {
                                _id: 'carId',
                                name: 'Aston Martin',
                                colour: 'red',
                                collection: 'myCollection',
                                type: 'Car'
                            }
                        ];

                        testMerge(changes, docs, function (err, docs) {
                            if (err) {
                                done(err);
                            }
                            else {
                                var doc = docs[0];
                                assert.equal(doc.owner, 'personId');
                                done();
                            }
                        });
                    });

                    it('reverse', function (done) {
                        var changes = {
                            myCollection: {
                                Car: {
                                    personId: [
                                        new Change({
                                            collection: collection,
                                            mapping: carMapping,
                                            field: 'owner',
                                            type: ChangeType.Set,
                                            newId: ['carId1', 'carId2', 'carId3'],
                                            oldId: null,
                                            _id: 'personId'
                                        })
                                    ]
                                }
                            }
                        };
                        var docs = [
                            {
                                _id: 'personId',
                                name: 'Michael Ford',
                                age: 24,
                                collection: 'myCollection',
                                type: 'Person'
                            }
                        ];

                        testMerge(changes, docs, function (err, docs) {
                            if (err) {
                                done(err);
                            }
                            else {
                                var doc = docs[0];
                                assert.arrEqual(doc.owner, ['carId1', 'carId2', 'carId3']);
                                dump(docs);
                                done();
                            }
                        });
                    });
                });


            });

        });

    });

    describe('apply changes', function () {

        describe('attribute', function () {

            beforeEach(function (done) {
                collection = new Collection('myCollection');
                carMapping = collection.mapping('Car', {
                    id: 'id',
                    attributes: ['colours', 'name']
                });
                collection.install(done);
            });

            it('set', function () {
                var obj = carMapping._new({colours: 'red', name: 'Aston Martin'});
                var c = new Change({
                    collection: collection,
                    mapping: carMapping,
                    field: 'colours',
                    type: ChangeType.Set,
                    new: 'blue',
                    old: 'red',
                    _id: obj._id
                });
                c.applySiestaModel(obj);
                assert.equal(obj.colours, 'blue');
            });

            it('set, old is wrong', function () {
                var obj = carMapping._new({colours: 'red', name: 'Aston Martin'});
                var c = new Change({
                    collection: collection,
                    mapping: carMapping,
                    field: 'colours',
                    type: ChangeType.Set,
                    new: 'blue',
                    old: 'green',
                    _id: obj._id
                });
                assert.throws(function () {
                    c.applySiestaModel(obj);
                }, RestError);
            });

            it('splice', function () {
                var obj = carMapping._new({colours: ['red', 'blue'], name: 'Aston Martin'});
                var c = new Change({
                    collection: collection,
                    mapping: carMapping,
                    field: 'colours',
                    type: ChangeType.Splice,
                    index: 1,
                    added: ['green'],
                    removed: ['blue'],
                    _id: obj._id
                });
                c.apply(obj);
                assert.equal(obj.colours.length, 2);
                assert.equal(obj.colours[0], 'red');
                assert.equal(obj.colours[1], 'green');
            });

        });

        describe('relationships', function () {

            var personMapping;

            beforeEach(function (done) {
                collection = new Collection('myCollection');
                carMapping = collection.mapping('Car', {
                    id: 'id',
                    attributes: ['colours', 'name'],
                    relationships: {
                        owner: {
                            type: RelationshipType.ForeignKey,
                            reverse: 'cars',
                            mapping: 'Person'
                        }
                    }
                });
                personMapping = collection.mapping('Person', {
                    id: 'id',
                    attributes: ['name', 'age']
                });
                collection.install(done);
            });

            describe('set', function () {

                describe('no old', function () {
                    it('new only', function () {
                        var car = carMapping._new({colours: 'red', name: 'Aston Martin'});
                        var person = personMapping._new({name: 'Michael Ford', age: 23});
                        var c = new Change({
                            collection: collection,
                            mapping: carMapping,
                            field: 'owner',
                            type: ChangeType.Set,
                            new: person,
                            old: null,
                            _id: car._id
                        });
                        c.applySiestaModel(car);
                        var proxy = car.ownerProxy;
                        assert.equal(proxy._id, person._id, 'Should set _id');
                        assert.equal(proxy.related, person, 'Should set person');
                        assert.equal(car.owner, person);
                    });

                    it('newId only', function () {
                        var car = carMapping._new({colours: 'red', name: 'Aston Martin'});
                        var person = personMapping._new({name: 'Michael Ford', age: 23});
                        var c = new Change({
                            collection: collection,
                            mapping: carMapping,
                            field: 'owner',
                            type: ChangeType.Set,
                            newId: person._id,
                            old: null,
                            _id: car._id
                        });
                        c.applySiestaModel(car);
                        var proxy = car.ownerProxy;
                        assert.equal(proxy._id, person._id, 'Should set _id');
                        // person object should be pulled from cache.
                        assert.equal(proxy.related, person, 'Should set person');
                        assert.equal(car.owner, person);
                    });

                    it('both new and newId', function () {
                        var car = carMapping._new({colours: 'red', name: 'Aston Martin'});
                        var person = personMapping._new({name: 'Michael Ford', age: 23});
                        var c = new Change({
                            collection: collection,
                            mapping: carMapping,
                            field: 'owner',
                            type: ChangeType.Set,
                            newId: person._id,
                            new: person,
                            old: null,
                            _id: car._id
                        });
                        c.applySiestaModel(car);
                        var proxy = car.ownerProxy;
                        assert.equal(proxy._id, person._id, 'Should set _id');
                        assert.equal(proxy.related, person, 'Should set person');
                        assert.equal(car.owner, person);
                    });
                });

                describe('old', function () {
                    it('new and old only', function () {
                        var car = carMapping._new({colours: 'red', name: 'Aston Martin'});
                        var person = personMapping._new({name: 'Michael Ford', age: 23});
                        car.owner = person;
                        var newOwner = carMapping._new({name: 'Bob', age: 24});
                        var c = new Change({
                            collection: collection,
                            mapping: carMapping,
                            field: 'owner',
                            type: ChangeType.Set,
                            new: newOwner,
                            old: person,
                            _id: car._id
                        });
                        c.applySiestaModel(car);
                        var proxy = car.ownerProxy;
                        assert.equal(proxy._id, newOwner._id, 'Should set _id');
                        assert.equal(proxy.related, newOwner, 'Should set person');
                        assert.equal(car.owner, newOwner);
                    });

                    it('newId and oldId only, no fault', function () {
                        var car = carMapping._new({colours: 'red', name: 'Aston Martin'});
                        var person = personMapping._new({name: 'Michael Ford', age: 23});
                        car.owner = person;
                        var newOwner = carMapping._new({name: 'Bob', age: 24});
                        var c = new Change({
                            collection: collection,
                            mapping: carMapping,
                            field: 'owner',
                            type: ChangeType.Set,
                            newId: newOwner._id,
                            oldId: person._id,
                            _id: car._id
                        });
                        c.applySiestaModel(car);
                        var proxy = car.ownerProxy;
                        assert.equal(proxy._id, newOwner._id, 'Should set _id');
                        assert.equal(proxy.related, newOwner, 'Should set person');
                        assert.equal(car.owner, newOwner);
                    });

                    it('newId and oldId only, fault', function () {
                        var car = carMapping._new({colours: 'red', name: 'Aston Martin'});
                        var person = personMapping._new({name: 'Michael Ford', age: 23});
                        car.owner = person;
                        var newOwner = carMapping._new({name: 'Bob', age: 24});
                        var c = new Change({
                            collection: collection,
                            mapping: carMapping,
                            field: 'owner',
                            type: ChangeType.Set,
                            newId: newOwner._id,
                            oldId: person._id,
                            _id: car._id
                        });
                        cache.reset();
                        c.applySiestaModel(car);
                        var proxy = car.ownerProxy;
                        assert.equal(proxy._id, newOwner._id, 'Should set _id');
                        assert.notOk(proxy.related);
                        assert.ok(proxy.isFault);
                    });

                });



                describe('errors', function () {
                    it('invalid oldId', function () {
                        var car = carMapping._new({colours: 'red', name: 'Aston Martin'});
                        var person = personMapping._new({name: 'Michael Ford', age: 23});
                        var c = new Change({
                            collection: collection,
                            mapping: carMapping,
                            field: 'owner',
                            type: ChangeType.Set,
                            new: person,
                            oldId: 'xyz',
                            _id: car._id
                        });
                        assert.throws(function () {
                            c.applySiestaModel(car);
                        }, RestError);
                    });
                    it('invalid old', function () {
                        var car = carMapping._new({colours: 'red', name: 'Aston Martin'});
                        var person = personMapping._new({name: 'Michael Ford', age: 23});
                        var c = new Change({
                            collection: collection,
                            mapping: carMapping,
                            field: 'owner',
                            type: ChangeType.Set,
                            new: person,
                            old: {_id: 'xyz'},
                            _id: car._id
                        });
                        assert.throws(function () {
                            c.applySiestaModel(car);
                        }, RestError);
                    });

                })

            });

            describe('splice', function () {

                it('removed only', function () {
                    var person = personMapping._new({name: 'Michael Ford', age: 23});
                    var car1 = carMapping._new({colours: 'red', name: 'Aston Martin'});
                    var car2 = carMapping._new({colours: 'blue', name: 'Aston Martin'});
                    person.cars = [car1, car2];
                    var c = new Change({
                        collection: collection,
                        mapping: personMapping,
                        field: 'cars',
                        type: ChangeType.Splice,
                        index: 0,
                        removed: [car1],
                        _id: person._id
                    });
                    c.applySiestaModel(person);
                    var proxy = person.carsProxy;
                    assert.equal(proxy._id.length, 1);
                    assert.include(proxy._id, car2._id);
                    assert.equal(proxy.related.length, 1);
                    assert.include(proxy.related, car2);
                    assert.equal(person.cars.length, 1);
                });

                it('removedId only, no fault', function () {
                    var person = personMapping._new({name: 'Michael Ford', age: 23});
                    var car1 = carMapping._new({colours: 'red', name: 'Aston Martin'});
                    var car2 = carMapping._new({colours: 'blue', name: 'Aston Martin'});
                    person.cars = [car1, car2];
                    var c = new Change({
                        collection: collection,
                        mapping: personMapping,
                        field: 'cars',
                        type: ChangeType.Splice,
                        index: 0,
                        removedId: [car1._id],
                        _id: person._id
                    });
                    c.applySiestaModel(person);
                    var proxy = person.carsProxy;
                    assert.equal(proxy._id.length, 1);
                    assert.include(proxy._id, car2._id);
                    assert.equal(proxy.related.length, 1);
                    assert.include(proxy.related, car2);
                    assert.equal(person.cars.length, 1);
                });

                it('removedId only, fault', function () {
                    var person = personMapping._new({name: 'Michael Ford', age: 23});
                    var car1 = carMapping._new({colours: 'red', name: 'Aston Martin'});
                    var car2 = carMapping._new({colours: 'blue', name: 'Aston Martin'});
                    person.cars = [car1, car2];
                    var c = new Change({
                        collection: collection,
                        mapping: personMapping,
                        field: 'cars',
                        type: ChangeType.Splice,
                        index: 0,
                        removedId: [car1._id],
                        _id: person._id
                    });
                    cache.reset();
                    var proxy = person.carsProxy;
                    proxy.related = null;
                    c.applySiestaModel(person);
                    assert.equal(proxy._id.length, 1);
                    assert.include(proxy._id, car2._id);
                    assert.ok(proxy.isFault);
                });

                it('added only', function () {
                    var person = personMapping._new({name: 'Michael Ford', age: 23});
                    var car1 = carMapping._new({colours: 'red', name: 'Aston Martin'});
                    var car2 = carMapping._new({colours: 'blue', name: 'Aston Martin'});
                    var car3 = carMapping._new({colours: 'purple', name: 'Aston Martin'});
                    person.cars = [car1, car2];
                    var c = new Change({
                        collection: collection,
                        mapping: personMapping,
                        field: 'cars',
                        type: ChangeType.Splice,
                        index: 0,
                        added: [car3],
                        _id: person._id
                    });
                    c.applySiestaModel(person);
                    var proxy = person.carsProxy;
                    assert.equal(proxy._id.length, 3);
                    assert.include(proxy._id, car3._id);
                    assert.equal(proxy.related.length, 3);
                    assert.include(proxy.related, car3);
                    assert.equal(person.cars.length, 3);
                });


                it('addedId only, no fault', function () {
                    var person = personMapping._new({name: 'Michael Ford', age: 23});
                    var car1 = carMapping._new({colours: 'red', name: 'Aston Martin'});
                    var car2 = carMapping._new({colours: 'blue', name: 'Aston Martin'});
                    var car3 = carMapping._new({colours: 'purple', name: 'Aston Martin'});
                    person.cars = [car1, car2];
                    var c = new Change({
                        collection: collection,
                        mapping: personMapping,
                        field: 'cars',
                        type: ChangeType.Splice,
                        index: 0,
                        addedId: [car3._id],
                        _id: person._id
                    });
                    c.applySiestaModel(person);
                    var proxy = person.carsProxy;
                    assert.equal(proxy._id.length, 3);
                    assert.include(proxy._id, car3._id);
                    assert.equal(proxy.related.length, 3);
                    assert.include(proxy.related, car3);
                    assert.equal(person.cars.length, 3);
                });


                it('addedId only, fault', function () {
                    var person = personMapping._new({name: 'Michael Ford', age: 23});
                    var car1 = carMapping._new({colours: 'red', name: 'Aston Martin'});
                    var car2 = carMapping._new({colours: 'blue', name: 'Aston Martin'});
                    var car3 = carMapping._new({colours: 'purple', name: 'Aston Martin'});
                    person.cars = [car1, car2];
                    var c = new Change({
                        collection: collection,
                        mapping: personMapping,
                        field: 'cars',
                        type: ChangeType.Splice,
                        index: 0,
                        addedId: [car3._id],
                        _id: person._id
                    });
                    cache.reset();
                    c.applySiestaModel(person);
                    var proxy = person.carsProxy;
                    assert.equal(proxy._id.length, 3);
                    assert.include(proxy._id, car3._id);
                    assert.notOk(proxy.related);
                    assert.ok(proxy.isFault);
                });





            });



        });

    })

});