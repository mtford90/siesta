describe('query', function () {

    var Index, Pouch, Indexes, RawQuery, Query, Collection, RestObject, RestError;

    beforeEach(function () {
        module('restkit.query', function ($provide) {
            $provide.value('$log', console);
            $provide.value('$q', Q);
        });

        module('restkit.object', function ($provide) {
            $provide.value('$log', console);
            $provide.value('$q', Q);
        });

        inject(function (_Index_, _Pouch_, _Indexes_, _RawQuery_, _Query_, _Collection_, _RestObject_, _RestError_, _cache_) {
            Index = _Index_;
            Indexes = _Indexes_;
            Pouch = _Pouch_;
            RawQuery = _RawQuery_;
            Query = _Query_;
            Collection = _Collection_;
            RestObject = _RestObject_;
            cache = _cache_;
        });

        Pouch.reset();
        cache.reset();

    });

    describe('raw query', function () {
        it('design doc name', function () {
            console.log(RawQuery);
            var name = new RawQuery('myCollection', 'Car', {colour: 'red', name: 'Aston Martin'})._getDesignDocName();
            assert.equal(name, '_design/myCollection_Index_Car_colour_name');
        });


        it('fields', function () {
            console.log(RawQuery);
            var q = new RawQuery('myCollection', 'Car', {colour: 'red', name: 'Aston Martin'});
            var fields = q._getFields();
            assert.include(fields, 'colour');
            assert.include(fields, 'name');
        });

        it('construct key', function () {
            console.log(RawQuery);
            var q = new RawQuery('myCollection', 'Car', {colour: 'red', name: 'Aston Martin'});
            var key = q._constructKey();
            assert.equal(key, 'red_Aston Martin');
        });

        it('execute with no rows and no index', function (done) {
            console.log(RawQuery);
            var q = new RawQuery('myCollection', 'Car', {colour: 'red', name: 'Aston Martin'});
            q.execute(function (err, results) {
                if (done) done(err);
                console.log('query results:', results);
                assert.equal(results.length, 0);
                done();
            });
        });

        it('execute with index', function (done) {
            console.log(RawQuery);
            var q = new RawQuery('myCollection', 'Car', {colour: 'red', name: 'Aston Martin'});
            var i = new Index('myCollection', 'Car', ['colour', 'name']);
            i.install(function (err) {
                if (err) done(err);
                q.execute(function (err, results) {
                    if (done) done(err);
                    console.log('query results:', results);
                    assert.equal(results.length, 0);
                    done();
                });
            });
        });

        it('execute with index with rows', function (done) {
            console.log(RawQuery);
            var q = new RawQuery('myCollection', 'Car', {colour: 'red', name: 'Aston Martin'});
            var i = new Index('myCollection', 'Car', ['colour', 'name']);
            i.install(function (err) {
                if (err) done(err);
                Pouch.getPouch().post({'type': 'Car', colour: 'red', name: 'Aston Martin', collection: 'myCollection'}, function (err) {
                    if (err) done(err);
                    q.execute(function (err, results) {
                        if (done) done(err);
                        console.log('query results:', results);
                        assert.equal(results.length, 1);
                        done();
                    });
                });
            });
        });

        it('execute without index with rows', function (done) {
            console.log(RawQuery);
            var q = new RawQuery('myCollection', 'Car', {colour: 'red', name: 'Aston Martin'});
            Pouch.getPouch().post({'type': 'Car', colour: 'red', name: 'Aston Martin', collection: 'myCollection'}, function (err) {
                if (err) done(err);
                q.execute(function (err, results) {
                    if (done) done(err);
                    console.log('query results:', results);
                    assert.equal(results.length, 1);
                    done();
                });
            });
        });


    });

    describe('query', function () {
        var collection, mapping;

        it('asdasd', function (done) {
            collection = new Collection('myCollection', function (err, version) {
                if (err) done(err);
                mapping = collection.registerMapping('Person', {
                    id: 'id',
                    attributes: ['name', 'age']
                });
            }, function (err) {
                if (err) done(err);
                Pouch.getPouch().post({type: 'Person', age: 23, collection: 'myCollection', name: 'Michael'}, function (err, resp) {
                    if (err) done(err);
                    var q = new Query(mapping, {age: 23});
                    q.execute(function (err, objs) {
                        if (err) done(err);
                        try {
                            assert.ok(objs.length);
                            _.each(objs, function (obj) {
                                assert.instanceOf(obj, RestObject);
                            });
                            done();
                        }
                        catch (err) {
                            done(err);
                        }

                    });
                });

            });


        })
    });


});