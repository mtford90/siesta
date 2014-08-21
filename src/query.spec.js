describe('query', function () {

    var Index, Pouch, Indexes, RawQuery, Query, RestAPI, RestObject, RestError;

    beforeEach(function () {
        module('restkit.query', function ($provide) {
            $provide.value('$log', console);
            $provide.value('$q', Q);
        });

        module('restkit.mapper', function ($provide) {
            $provide.value('$log', console);
            $provide.value('$q', Q);
        });

        inject(function (_Index_, _Pouch_, _Indexes_, _RawQuery_, _Query_, _RestAPI_, _RestObject_, _RestError_) {
            Index = _Index_;
            Indexes = _Indexes_;
            Pouch = _Pouch_;
            RawQuery = _RawQuery_;
            Query = _Query_;
            RestAPI = _RestAPI_;
            RestObject = _RestObject_;
            RestError = _RestError_;
        });

        Pouch.reset();

    });

    describe('raw query', function () {
        it('design doc name', function () {
            console.log(RawQuery);
            var name = new RawQuery('myApi', 'Car', {colour: 'red', name: 'Aston Martin'})._getDesignDocName();
            assert.equal(name, '_design/myApi_Index_Car_colour_name');
        });


        it('fields', function () {
            console.log(RawQuery);
            var q = new RawQuery('myApi', 'Car', {colour: 'red', name: 'Aston Martin'});
            var fields = q._getFields();
            assert.include(fields, 'colour');
            assert.include(fields, 'name');
        });

        it('construct key', function () {
            console.log(RawQuery);
            var q = new RawQuery('myApi', 'Car', {colour: 'red', name: 'Aston Martin'});
            var key = q._constructKey();
            assert.equal(key, 'red_Aston Martin');
        });

        it('execute with no index', function () {
            console.log(RawQuery);
            var q = new RawQuery();
            assert.throws(_.bind(q.execute, q, 'myApi', 'Car', {colour: 'red', name: 'Aston Martin'}), RestError);
        });

        it('execute with index', function (done) {
            console.log(RawQuery);
            var q = new RawQuery('myApi', 'Car', {colour: 'red', name: 'Aston Martin'});
            var i = new Index('myApi', 'Car', ['colour', 'name']);
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
            var q = new RawQuery('myApi', 'Car', {colour: 'red', name: 'Aston Martin'});
            var i = new Index('myApi', 'Car', ['colour', 'name']);
            i.install(function (err) {
                if (err) done(err);
                Pouch.getPouch().post({'type': 'Car', colour: 'red', name: 'Aston Martin', api: 'myApi'}, function (err) {
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
    });

    describe('query', function () {
        var api, mapping;

        it('asdasd', function (done) {
            api = new RestAPI('myApi', function (err, version) {
                if (err) done(err);
                mapping = api.registerMapping('Person', {
                    id: 'id',
                    attributes: ['name', 'age']
                });
            }, function (err) {
                if (err) done(err);
                Pouch.getPouch().post({type: 'Person', age: 23, api: 'myApi', name: 'Michael'}, function (err, resp) {
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