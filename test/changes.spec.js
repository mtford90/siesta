var s = require('../index')
    , assert = require('chai').assert;

describe.only('changes', function () {

    var sut = require('../src/changes');
    var ChangeType = require('../src/changeType').ChangeType;
    var Change = sut.Change;

    var RestError = require('../src/error').RestError;

    var Collection = require('../src/collection').Collection;

    var pouch = require('../src/pouch');

    var collection, mapping;

    beforeEach(function () {
        s.reset(true);
    });

    describe('registering changes', function () {
        beforeEach(function (done) {
            collection = new Collection('myCollection');
            mapping = collection.mapping('Car', {
                id: 'id',
                attributes: ['colour', 'name']
            });
            collection.install(done);
        });

        it('registers a change', function () {
            sut.registerChange({
                collection: collection,
                mapping: mapping,
                _id: 'xyz'
            });
            var objChanges = sut.changes[collection.name][mapping.type]['xyz'];
            assert.equal(objChanges.length, 1);
            var change = objChanges[0];
            assert.equal(change.collection, collection);
            assert.equal(change.mapping, mapping);
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
                            mapping: mapping,
                            _id: 'xyz'
                        })
                    }, RestError
                );
            });

            it('should throw an error if no _id', function () {
                assert.throws(
                    function () {
                        sut.registerChange({
                            mapping: mapping,
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
            mapping = collection.mapping('Car', {
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
                mapping = collection.mapping('Car', {
                    id: 'id',
                    attributes: ['colour', 'name']
                });
                collection.install(done);
            });

            it('set', function () {
                var obj = mapping._new({colour: 'red', name: 'Aston Martin'});
                var c = new Change();
                c.collection = collection;
                c.mapping = mapping;
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
                    var obj = mapping._new({colour: 'red', name: 'Aston Martin'});
                    var c = new Change();
                    c.collection = collection;
                    c.mapping = mapping;
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
                    var obj = mapping._new({colour: 'red', name: 'Aston Martin'});
                    var c = new Change();
                    c.collection = collection;
                    c.mapping = mapping;
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
                mapping = collection.mapping('Car', {
                    id: 'id',
                    attributes: ['colours', 'name']
                });
                collection.install(done);
            });

            it('no remove count or added', function () {
                var obj = mapping._new({colours: ['red', 'blue'], name: 'Aston Martin'});
                var c = new Change();
                c.collection = collection;
                c.mapping = mapping;
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
                    var obj = mapping._new({colours: ['red', 'blue'], name: 'Aston Martin'});
                    var c = new Change();
                    c.collection = collection;
                    c.mapping = mapping;
                    c.field = 'colours';
                    c.type = ChangeType.Splice;
                    c.index = 2;
                    c._id = obj._id;
                    assert.throws(function () {
                        c.apply(obj);
                    }, RestError);
                });
                it('no index', function () {
                    var obj = mapping._new({colours: ['red', 'blue'], name: 'Aston Martin'});
                    var c = new Change();
                    c.collection = collection;
                    c.mapping = mapping;
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
                    var obj = mapping._new({colours: ['red', 'blue'], name: 'Aston Martin'});
                    var c = new Change();
                    c.collection = collection;
                    c.mapping = mapping;
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
            })
        });

    });

    describe('merge changes', function () {

        describe('set', function () {
            beforeEach(function (done) {
                collection = new Collection('myCollection');
                mapping = collection.mapping('Car', {
                    id: 'id',
                    attributes: ['colour', 'name']
                });
                collection.install(done);
            });

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

            it('set', function (done) {
                var changes = {
                    myCollection: {
                        Car: {
                            localId: [
                                new Change({
                                    collection: collection,
                                    mapping: mapping,
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

    });
});