describe('abc', function () {

    var RestAPI;

    beforeEach(function () {
        module('restkit.mapping', function ($provide) {
            $provide.value('$log', console);
            $provide.value('$q', Q);
        });

        inject(function (_RestAPI_) {
            RestAPI = _RestAPI_;
        });

        RestAPI._reset();

    });

    describe('Create Rest API', function () {

        var api;

        beforeEach(function (done) {
            var configCalled = false;
            api = new RestAPI('myApi', function (err, version) {
                if (err) done(err);
                assert.notOk(version);
                api.version = 1;
                configCalled = true;
            }, function () {
                assert.ok(configCalled, 'configuration function should be called');
                done();
            });
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