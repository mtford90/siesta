describe('rest', function () {

    var Collection, CollectionRegistry;
    var collection;

    function configureAPI(done, callback) {
        console.log('configureAPI');
        var configCalled = false;
        collection = new Collection('myCollection', function (err, version) {
            if (err) done(err);
            assert.notOk(version);
            collection.version = 1;
            if (callback) callback();
            configCalled = true;
        }, function () {
            assert.ok(configCalled, 'configuration function should be called');
            done();
        });
        return collection;
    }

    beforeEach(function () {
        module('restkit', function ($provide) {
            $provide.value('$log', console);
            $provide.value('$q', Q);
        });

        inject(function (_Collection_, _CollectionRegistry_) {
            Collection = _Collection_;
            CollectionRegistry = _CollectionRegistry_;
        });

        Collection._reset();
    });

    describe('Create Basic Rest API', function () {

        beforeEach(configureAPI);

        it('global access', function () {
            assert.equal(CollectionRegistry.myCollection, collection);
        });

        describe('persistence', function () {
            it('version is set', function (done) {
                Collection._getPouch().get(collection._docId, function (err, doc) {
                    if (err) done(err);
                    assert.equal(doc.version, collection.version);
                    done();
                });
            });

            it('_doc is set and is of same revision', function (done) {
                Collection._getPouch().get(collection._docId, function (err, doc) {
                    if (err) done(err);
                    assert.equal(doc._rev, collection._doc._rev);
                    done();
                });
            });
        });

        describe('reconfiguration', function () {
            var collectionAgain;
            var newVersion = 2;

            beforeEach(function (done) {
                var configCalled = false;
                console.log('collectionAgain');
                collectionAgain = new Collection('myCollection', function (err, version) {
                    if (err) done(err);
                    assert.equal(version, 1);
                    assert.equal(collectionAgain.version, 1);
                    collectionAgain.version = newVersion;
                    configCalled = true;
                }, function () {
                    assert.ok(configCalled, 'configuration function should be called');
                    done();
                });
            });

            describe('persistence', function () {
                it('version is updated', function (done) {
                    Collection._getPouch().get(collectionAgain._docId, function (err, doc) {
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

        var collection;
        describe('basic', function () {

            beforeEach(function (done) {
                collection = configureAPI(done, function () {
                    collection.registerMapping('Person', {
                        id: 'id',
                        attributes: ['name', 'age']
                    });
                });
            });

            describe('raw mapping to Mapping object', function () {
                function assertMapping(collection) {
                    var rawMapping = collection._mappings.Person;
                    assert.ok(rawMapping);
                    var mappingObj = collection.Person;
                    console.log('mappingObj:', mappingObj);
                    assert.equal(mappingObj.type, 'Person');
                    assert.equal(mappingObj.id, 'id');
                    assert.equal(mappingObj.collection, 'myCollection');
                    assert.include(mappingObj._fields, 'name');
                    assert.include(mappingObj._fields, 'age');
                    assert.ok(mappingObj);
                }

                it('mappings', function () {
                    assertMapping(collection);
                });
                it('reconfig', function (done) {
                    var a = new Collection('myCollection', function (err, version) {
                        if (err) done(err);
                    }, function () {
                        assertMapping(a);
                        done();
                    });
                })
            });

            describe('persistence', function () {
                it('version is updated', function (done) {
                    Collection._getPouch().get(collection._docId, function (err, doc) {
                        if (err) done(err);
                        assert.ok(doc.mappings.Person);

                        done();
                    });
                });
                it('reconfig', function (done) {
                    console.log('reconfig');
                    var a = new Collection('myCollection', function (err, version) {
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
                collection = configureAPI(done, function () {
                    collection.registerMapping('Person', {
                        id: 'id',
                        attributes: ['name', 'age'],
                        indexes: ['name', 'age']
                    });
                });
            });
        });

    })

});