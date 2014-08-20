describe('rest', function () {

    var RestAPI;
    var api;

    function configureAPI(done, callback) {
        console.log('configureAPI');
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

        it('global access', function () {
            assert.equal(api, RestAPI.myApi);
        });

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
                console.log('apiAgain');
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
                        console.log('doc:', doc);
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

            describe('raw mapping to Mapping object', function () {
                function assertMapping(api) {
                    var rawMapping = api._mappings.Person;
                    assert.ok(rawMapping);
                    var mappingObj = api.Person;
                    console.log('mappingObj:', mappingObj);
                    assert.equal(mappingObj.type, 'Person');
                    assert.equal(mappingObj.id, 'id');
                    assert.equal(mappingObj.api, 'myApi');
                    assert.include(mappingObj._fields, 'name');
                    assert.include(mappingObj._fields, 'age');
                    assert.ok(mappingObj);
                }

                it('mappings', function () {
                    assertMapping(api);
                });
                it('reconfig', function (done) {
                    var a = new RestAPI('myApi', function (err, version) {
                        if (err) done(err);
                    }, function () {
                        assertMapping(a);
                        done();
                    });
                })
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
                    console.log('reconfig');
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