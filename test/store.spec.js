var assert = require('chai').assert,
    internal = siesta._internal,
    cache = internal.cache,
    Store = internal.Store,
    ModelInstance = internal.ModelInstance;

describe('store......', function () {
    var Car, Collection;

    before(function () {
        siesta.ext.storageEnabled = false;
    });

    beforeEach(function (done) {
        siesta.reset(function () {
            Collection = siesta.collection('myCollection');
            Car = Collection.model('Car', {
                id: 'id',
                attributes: ['colour', 'name']
            });
            done();
        });
    });

    describe('get', function () {
        it('already cached', function (done) {
            var model = new ModelInstance(Car);
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
            describe('getMultipleLocal', function () {
                var cars;

                beforeEach(function (done) {
                    siesta.install(function () {
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
                        done();
                    }).catch(done);
                });

                it('xyz', function (done) {
                    Store.getMultipleLocal(_.pluck(cars, '_id'), function (err, docs) {
                        if (err) done(err);
                        assert.equal(docs.length, 3);
                        _.each(docs, function (d) {
                            assert.instanceOf(d, ModelInstance);
                        });
                        done();
                    })
                })


            });

            describe('getMultipleRemote', function () {
                describe('cached', function () {

                    var cars;

                    beforeEach(function (done) {
                        siesta.install(function () {
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
                            done();
                        }).catch(done);
                    });

                    it('xyz', function (done) {
                        Store.getMultipleRemote(_.pluck(cars, 'id'), Car, function (err, docs) {
                            if (err) done(err);
                            assert.equal(docs.length, 3);
                            _.each(docs, function (d) {
                                assert.instanceOf(d, ModelInstance);
                            });
                            done();
                        })
                    })


                });

            })


        });

    });


});