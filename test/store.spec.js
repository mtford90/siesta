var s = require('../core/index'),
    assert = require('chai').assert;

describe('store......', function () {
    var Store = require('../core/store');
    var SiestaModel = require('../core/modelInstance');
    var Collection = require('../core/collection');
    var cache = require('../core/cache');

    var carMapping, collection;

    before(function () {
        s.ext.storageEnabled = false;
    });

    beforeEach(function (done) {
        s.reset(function () {
            collection = s.collection('myCollection');
            Car = collection.model('Car', {
                id: 'id',
                attributes: ['colour', 'name']
            });
            s.install(done);
        });
    });

    describe('get', function () {
        it('already cached', function (done) {
            var model = new SiestaModel(Car);
            var pouchId = 'pouchId';
            model._id = pouchId;
            cache.insert(model);
            Store.get({
                _id: pouchId
            }, function (err, doc) {
                if (err) done(err);
                assert.equal(doc, model);
                done();
            });
        });

        describe('multiple', function () {

            describe('getMultiple', function () {
                //TODO
            });

            describe('getMultipleLocal', function () {
                var cars;

                beforeEach(function () {
                    var o = Car._new({
                        colour: 'red',
                        id: 'remoteId1'
                    });
                    var o1 = Car._new({
                        colour: 'blue',
                        id: 'remoteId2'
                    });
                    var o2 = Car._new({
                        colour: 'green',
                        id: 'remoteId3'
                    });
                    cars = [o, o1, o2];
                    cache.insert(o);
                    cache.insert(o1);
                    cache.insert(o2);
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

            describe('getMultipleRemote', function () {
                describe('cached', function () {

                    var cars;

                    beforeEach(function () {
                        var o = Car._new({
                            colour: 'red',
                            id: 'remoteId1'
                        });
                        var o1 = Car._new({
                            colour: 'blue',
                            id: 'remoteId2'
                        });
                        var o2 = Car._new({
                            colour: 'green',
                            id: 'remoteId3'
                        });
                        cars = [o, o1, o2];
                        cache.insert(o);
                        cache.insert(o1);
                        cache.insert(o2);
                    });

                    it('xyz', function (done) {
                        Store.getMultipleRemote(_.pluck(cars, 'id'), Car, function (err, docs) {
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