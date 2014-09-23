var s = require('../index')
    , assert = require('chai').assert;

describe('store', function () {
    var Store = require('../src/store');
    var Pouch = require('../src/pouch');
    var SiestaModel = require('../src/object').SiestaModel;
    var Collection = require('../src/collection').Collection;
    var cache = require('../src/cache');

    var carMapping, collection;

    beforeEach(function (done) {
        s.reset(true);
        collection = new Collection('myCollection');
        carMapping = collection.mapping('Car', {
            id: 'id',
            attributes: ['colour', 'name']
        });
        collection.install(done);

    });

    describe('get', function () {


        it('already cached', function (done) {
            var model = new SiestaModel(carMapping);
            var pouchId = 'pouchId';
            model._id = pouchId;
            cache.insert(model);
            Store.get({_id: pouchId}, function (err, doc) {
                if (err)done(err);
                assert.equal(doc, model);
                done();
            });
        });

        it('in pouch, have _id', function (done) {
            var pouchid = 'pouchId';
            Pouch.getPouch().put({type: 'Car', collection: 'myCollection', colour: 'red', _id: pouchid}, function (err, doc) {
                if (err) done(err);
                Store.get({_id: pouchid}, function (err, obj) {
                    if (err) done(err);
                    var cachedObject = cache.get({_id: obj._id});
                    try {
                        assert.equal(cachedObject, obj);
                        done();
                    }
                    catch (err) {
                        done(err);
                    }
                });
            });
        });

        it('in pouch, dont have _id', function (done) {
            var pouchid = 'pouchId';
            var remoteId = 'xyz';
            Pouch.getPouch().put({type: 'Car', collection: 'myCollection', colour: 'red', _id: pouchid, id: remoteId}, function (err, doc) {
                if (err) done(err);
                Store.get({id: remoteId, mapping: carMapping}, function (err, doc) {
                    if (err) done(err);
                    done();
                });
            });
        });

        describe('multiple', function () {

            describe('getMultiple', function () {

                describe('not cached', function () {
                    beforeEach(function (done) {
                        Pouch.getPouch().bulkDocs(
                            [
                                {type: 'Car', collection: 'myCollection', colour: 'red', _id: 'localId1', id: 'remoteId1'},
                                {type: 'Car', collection: 'myCollection', colour: 'blue', _id: 'localId2', id: 'remoteId2'},
                                {type: 'Car', collection: 'myCollection', colour: 'green', _id: 'localId3', id: 'remoteId3'}
                            ],
                            function (err) {
                                done(err);
                            }
                        );
                    });
                    it('getMultiple should return multiple', function (done) {
                        Store.getMultiple([
                            {_id: 'localId1'},
                            {_id: 'localId2'},
                            {_id: 'localId3'}
                        ], function (err, docs) {
                            if (err) done(err);
                            _.each(docs, function (d) {
                                assert.instanceOf(d, SiestaModel);
                            });
                            done();
                        });
                    });

                    it('get should proxy to getMultiple if _id is an array', function (done) {
                        Store.get({_id: ['localId1', 'localId2', 'localId3']}, function (err, docs) {
                            if (err) done(err);
                            _.each(docs, function (d) {
                                assert.instanceOf(d, SiestaModel);
                            });
                            done();
                        });
                    });


                });

            });

            describe('getMultipleLocal', function () {

                describe('not cached', function () {

                    beforeEach(function (done) {
                        Pouch.getPouch().bulkDocs(
                            [
                                {type: 'Car', collection: 'myCollection', colour: 'red', _id: 'localId1', id: 'remoteId1'},
                                {type: 'Car', collection: 'myCollection', colour: 'blue', _id: 'localId2', id: 'remoteId2'},
                                {type: 'Car', collection: 'myCollection', colour: 'green', _id: 'localId3', id: 'remoteId3'}
                            ],
                            function (err) {
                                done(err);
                            }
                        );
                    });

                    it('xyz', function (done) {
                        Store.getMultipleLocal(['localId1', 'localId2', 'localId3'], function (err, docs) {
                            if (err) done(err);
                            assert.equal(docs.length, 3);
                            _.each(docs, function (d) {
                                assert.instanceOf(d, SiestaModel);
                            });
                            done();
                        })
                    })
                });
                describe('cached', function () {

                    var cars;

                    beforeEach(function (done) {
                        carMapping.map([
                            {colour: 'red', id: 'remoteId1'},
                            {colour: 'blue', id: 'remoteId2'},
                            {colour: 'green', id: 'remoteId3'}
                        ], function (err, _cars) {
                            if (err) done(err);
                            cars = _cars;
                            done();
                        });
                    });

                    it('xyz', function (done) {
                        Store.getMultipleLocal(_.pluck(cars, '_id'), function (err, docs) {
                            if (err) done(err);
                            assert.equal(docs.length, 3);
                            _.each(docs, function (d) {
                                assert.instanceOf(d, SiestaModel);
                            });
                            done();
                        })
                    })
                });
                describe('partially cached', function () {
                    var cars;

                    beforeEach(function (done) {
                        carMapping.map([
                            {colour: 'red', id: 'remoteId1'},
                            {colour: 'green', id: 'remoteId3'}
                        ], function (err, _cars) {
                            if (err) done(err);
                            cars = _cars;
                            Pouch.getPouch().bulkDocs(
                                [
                                    {type: 'Car', collection: 'myCollection', colour: 'blue', _id: 'localId2', id: 'remoteId2'}
                                ],
                                function (err) {
                                    done(err);
                                }
                            );
                        });
                    });

                    it('xyz', function (done) {
                        var localIdentifiers = _.pluck(cars, '_id');
                        localIdentifiers.push('localId2');
                        Store.getMultipleLocal(localIdentifiers, function (err, docs) {
                            if (err) done(err);
                            assert.equal(docs.length, 3);
                            _.each(docs, function (d) {
                                assert.instanceOf(d, SiestaModel);
                            });
                            done();
                        })
                    })


                });

            });

            describe('getMultipleRemote', function () {
                describe('not cached', function () {

                    beforeEach(function (done) {
                        Pouch.getPouch().bulkDocs(
                            [
                                {type: 'Car', collection: 'myCollection', colour: 'red', _id: 'localId1', id: 'remoteId1'},
                                {type: 'Car', collection: 'myCollection', colour: 'blue', _id: 'localId2', id: 'remoteId2'},
                                {type: 'Car', collection: 'myCollection', colour: 'green', _id: 'localId3', id: 'remoteId3'}
                            ],
                            function (err) {
                                done(err);
                            }
                        );
                    });

                    it('xyz', function (done) {
                        Store.getMultipleRemote(['remoteId1', 'remoteId2', 'remoteId3'], carMapping, function (err, docs) {
                            if (err) done(err);
                            assert.equal(docs.length, 3);
                            dump(docs);
                            _.each(docs, function (d) {
                                assert.instanceOf(d, SiestaModel);
                            });
                            done();
                        })
                    })
                });
                describe('cached', function () {

                    var cars;

                    beforeEach(function (done) {
                        carMapping.map([
                            {colour: 'red', id: 'remoteId1'},
                            {colour: 'blue', id: 'remoteId2'},
                            {colour: 'green', id: 'remoteId3'}
                        ], function (err, _cars) {
                            if (err) done(err);
                            cars = _cars;
                            done();
                        });
                    });

                    it('xyz', function (done) {
                        Store.getMultipleRemote(_.pluck(cars, 'id'), carMapping, function (err, docs) {
                            if (err) done(err);
                            assert.equal(docs.length, 3);
                            _.each(docs, function (d) {
                                assert.instanceOf(d, SiestaModel);
                            });
                            done();
                        })
                    })


                });
                describe('partially cached', function () {
                    var cars;

                    beforeEach(function (done) {
                        carMapping.map([
                            {colour: 'red', id: 'remoteId1'},
                            {colour: 'green', id: 'remoteId3'}
                        ], function (err, _cars) {
                            if (err) done(err);
                            cars = _cars;
                            Pouch.getPouch().bulkDocs(
                                [
                                    {type: 'Car', collection: 'myCollection', colour: 'blue', _id: 'localId2', id: 'remoteId2'}
                                ],
                                function (err) {
                                    done(err);
                                }
                            );
                        });
                    });

                    it('xyz', function (done) {
                        Store.getMultipleRemote(['remoteId1', 'remoteId2', 'remoteId3'], carMapping, function (err, docs) {
                            if (err) done(err);
                            assert.equal(docs.length, 3);
                            _.each(docs, function (d) {
                                assert.instanceOf(d, SiestaModel);
                            });
                            done();
                        })
                    })


                });

            })


        });

    });


});