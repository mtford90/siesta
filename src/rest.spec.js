describe('abc', function () {

    var RestAPI;
    var api;

    function configureAPI(done, callback) {
        var configCalled = false;
        api = new RestAPI('myApi', function (err, version) {
            if (err) done(err);
            assert.notOk(version);
            api.version = 1;
            if (callback) callback();
            configCalled = true;
        }, function () {
            assert.ok(configCalled, 'configuration function should be called');
            done();
        });
        return api;
    }

    beforeEach(function () {
        module('restkit', function ($provide) {
            $provide.value('$log', console);
            $provide.value('$q', Q);
        });

        inject(function (_RestAPI_) {
            RestAPI = _RestAPI_;
        });

        RestAPI._reset();
    });

    describe('Create Basic Rest API', function () {

        beforeEach(configureAPI);

        describe('persistence', function () {
            it('version is set', function (done) {
                RestAPI._getPouch().get(api._docId, function (err, doc) {
                    if (err) done(err);
                    assert.equal(doc.version, api.version);
                    done();
                });
            });

            it('_doc is set and is of same revision', function (done) {
                RestAPI._getPouch().get(api._docId, function (err, doc) {
                    if (err) done(err);
                    assert.equal(doc._rev, api._doc._rev);
                    done();
                });
            });
        });

        describe('reconfiguration', function () {
            var apiAgain;
            var newVersion = 2;

            beforeEach(function (done) {
                var configCalled = false;
                apiAgain = new RestAPI('myApi', function (err, version) {
                    if (err) done(err);
                    assert.equal(version, 1);
                    assert.equal(apiAgain.version, 1);
                    apiAgain.version = newVersion;
                    configCalled = true;
                }, function () {
                    assert.ok(configCalled, 'configuration function should be called');
                    done();
                });
            });

            describe('persistence', function () {
                it('version is updated', function (done) {
                    RestAPI._getPouch().get(apiAgain._docId, function (err, doc) {
                        if (err) done(err);
                        assert.equal(doc.version, newVersion);
                        done();
                    });
                });
            });


        });
    });

    describe('Object mapping registration', function () {

        var api;


        describe('basic', function () {

            beforeEach(function (done) {
                api = configureAPI(done, function () {
                    api.registerMapping('Person', {
                        id: 'id',
                        attributes: ['name', 'age']
                    });
                });
            });

            it('mappings', function () {
                assert.ok(api._mappings.Person);
                assert.ok(api.Person);
            });

            describe('persistence', function () {
                it('version is updated', function (done) {
                    RestAPI._getPouch().get(api._docId, function (err, doc) {
                        if (err) done(err);
                        assert.ok(doc.mappings.Person);

                        done();
                    });
                });
                it('reconfig', function (done) {
                    var a = new RestAPI('myApi', function (err, version) {
                        if (err) done(err);
                    }, function () {
                        console.log(a._mappings);
                        assert.ok(a._mappings.Person);
                        done();
                    });
                })
            });
        });



        describe('indexing', function () {
            beforeEach(function (done) {
                api = configureAPI(done, function () {
                    api.registerMapping('Person', {
                        id: 'id',
                        attributes: ['name', 'age'],
                        indexes: ['name', 'age']
                    });
                });
            });
        });

    })

});