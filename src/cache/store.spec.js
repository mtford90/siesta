describe('store', function () {

    var Collection, cache, RestObject, Mapping, Store, Pouch;

    var carMapping, api;

    beforeEach(function (done) {
        module('restkit.store', function ($provide) {
            $provide.value('$log', console);
            $provide.value('$q', Q);
        });

        inject(function (_Collection_, _cache_, _RestObject_, _Store_, _Mapping_, _Pouch_) {
            Collection = _Collection_;
            cache = _cache_;
            RestObject = _RestObject_;
            Mapping = _Mapping_;
            Store = _Store_;
            Pouch = _Pouch_;
        });
        Collection._reset();
        api = new Collection('myApi', function (err, version) {
            if (err) done(err);
            carMapping = api.registerMapping('Car', {
                id: 'id',
                attributes: ['colour', 'name']
            });
        }, function () {
            done();
        });
    });

    describe('get', function () {
        it('already cached', function (done) {
            var restObject = new RestObject(carMapping);
            var pouchId = 'pouchId';
            restObject._id = pouchId;
            cache.insert(restObject);
            Store.get({_id: pouchId}, function (err, doc) {
                if (err)done(err);
                console.log('doc:', doc);
                assert.equal(doc, restObject);
                done();
            });
        });

        it('in pouch, have _id', function (done) {
            var pouchid = 'pouchId';
            Pouch.getPouch().put({type: 'Car', api: 'myApi', colour: 'red', _id: pouchid}, function (err, doc) {
                if (err) done(err);
                Store.get({_id: pouchid}, function (err, doc) {
                    if (err) done(err);
                    console.log('doc:', doc);
                    done();
                });
            });
        });

        it('in pouch, dont have _id', function (done) {
            var pouchid = 'pouchId';
            var remoteId = 'xyz';
            Pouch.getPouch().put({type: 'Car', api: 'myApi', colour: 'red', _id: pouchid, id: remoteId}, function (err, doc) {
                if (err) done(err);
                Store.get({id: remoteId, mapping: carMapping}, function (err, doc) {
                    if (err) done(err);
                    console.log('doc:', doc);
                    done();
                });
            });
        });

        describe('multiple', function () {

            beforeEach(function (done) {
                Pouch.getPouch().bulkDocs(
                    [
                        {type: 'Car', api: 'myApi', colour: 'red', _id: 'localId1', id: 'remoteId1'},
                        {type: 'Car', api: 'myApi', colour: 'blue', _id: 'localId2', id: 'remoteId2'},
                        {type: 'Car', api: 'myApi', colour: 'green', _id: 'localId3', id: 'remoteId3'}
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
                    console.log('docs:', docs);
                    _.each(docs, function (d) {
                        assert.instanceOf(d, RestObject);
                    });
                    done();
                });
            });

            it('get should proxy to getMultiple if _id is an array', function (done) {
                Store.get({_id: ['localId1', 'localId2', 'localId3']}, function (err, docs) {
                    if (err) done(err);
                    console.log('docs:', docs);
                    _.each(docs, function (d) {
                        assert.instanceOf(d, RestObject);
                    });
                    done();
                });
            });

        });

    });

    describe('put objects to store', function () {

        describe('store object that has never been stored', function () {
            var car;
            beforeEach(function (done) {
                car = carMapping._new();
                car.colour = 'red';
                car.id = 'remoteId';
                Store.put(car, function (err) {
                    done(err);
                });
            });
            it('should be in cache', function () {
                assert.equal(cache.get({_id: car._id}), car);
            });
            it('should be in pouch', function (done) {
                Pouch.getPouch().get(car._id, function (err, doc) {
                    if (err) done(err);
                    assert.equal(doc._id, car._id);
                    done();
                });
            });
            describe('store object that has been stored before', function () {
                var err;
                beforeEach(function (done) {
                    Store.put(car, function (_err) {
                        done();
                        err = _err;
                    });
                });

                it('should not return an error', function () {
                    assert.notOk(err);
                });

                it('should be in cache', function () {
                    assert.equal(cache.get({_id: car._id}), car);
                });

                it('should be in pouch', function (done) {
                    Pouch.getPouch().get(car._id, function (err, doc) {
                        if (err) done(err);
                        assert.equal(doc._id, car._id);
                        done();
                    });
                });

            });
        });

    });


});