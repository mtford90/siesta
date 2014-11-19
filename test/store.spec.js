var s = require('../index'),
    assert = require('chai').assert;

describe('store......', function() {
    var Store = require('../src/store');
    var SiestaModel = require('../src/siestaModel').SiestaModel;
    var Collection = require('../src/collection').Collection;
    var cache = require('../src/cache');

    var carMapping, collection;

    beforeEach(function(done) {
        s.reset(true);
        collection = new Collection('myCollection');
        carMapping = collection.mapping('Car', {
            id: 'id',
            attributes: ['colour', 'name']
        });
        collection.install(done);
    });

    describe('get', function() {
        it('already cached', function(done) {
            var model = new SiestaModel(carMapping);
            var pouchId = 'pouchId';
            model._id = pouchId;
            cache.insert(model);
            Store.get({
                _id: pouchId
            }, function(err, doc) {
                if (err) done(err);
                assert.equal(doc, model);
                done();
            });
        });

        describe('multiple', function() {

            describe('getMultiple', function() {
                //TODO
            });

            describe('getMultipleLocal', function() {
                var cars;

                beforeEach(function() {
                    var o = carMapping._new({
                        colour: 'red',
                        id: 'remoteId1'
                    });
                    var o1 = carMapping._new({
                        colour: 'blue',
                        id: 'remoteId2'
                    });
                    var o2 = carMapping._new({
                        colour: 'green',
                        id: 'remoteId3'
                    });
                    cars = [o, o1, o2];
                    cache.insert(o);
                    cache.insert(o1);
                    cache.insert(o2);
                });

                it('xyz', function(done) {
                    Store.getMultipleLocal(_.pluck(cars, '_id'), function(err, docs) {
                        if (err) done(err);
                        assert.equal(docs.length, 3);
                        _.each(docs, function(d) {
                            assert.instanceOf(d, SiestaModel);
                        });
                        done();
                    })
                })


            });

            describe('getMultipleRemote', function() {
                describe('cached', function() {

                    var cars;

                    beforeEach(function() {
                        var o = carMapping._new({
                            colour: 'red',
                            id: 'remoteId1'
                        });
                        var o1 = carMapping._new({
                            colour: 'blue',
                            id: 'remoteId2'
                        });
                        var o2 = carMapping._new({
                            colour: 'green',
                            id: 'remoteId3'
                        });
                        cars = [o, o1, o2];
                        cache.insert(o);
                        cache.insert(o1);
                        cache.insert(o2);
                    });

                    it('xyz', function(done) {
                        Store.getMultipleRemote(_.pluck(cars, 'id'), carMapping, function(err, docs) {
                            if (err) done(err);
                            assert.equal(docs.length, 3);
                            _.each(docs, function(d) {
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