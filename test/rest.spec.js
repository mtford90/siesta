var s = require('../core/index')
    , assert = require('chai').assert;


describe('rest', function () {
    var Collection = require('../core/collection').Collection;
    var CollectionRegistry = require('../core/collectionRegistry').CollectionRegistry;
    var collection;
    before(function () {
        s.ext.storageEnabled = false;
    });

    beforeEach(function (done) {
        s.reset(done);
    });

    describe('Create Basic Rest API', function () {

        beforeEach(function (done) {
            collection = s.collection('myCollection');
            s.install(done);
        });

        it('global access', function () {
            assert.equal(CollectionRegistry.myCollection, collection);
        });

    });

    describe('Object mapping registration', function () {

        var collection;
        describe('basic', function () {

            beforeEach(function (done) {
                collection = s.collection('myCollection');
                collection.model('Person', {
                    id: 'id',
                    attributes: ['name', 'age']
                });
                s.install(done);
            });

            describe('raw mapping to Model object', function () {
                function assertMapping(collection) {
                    var rawMapping = collection._rawModels.Person;
                    assert.ok(rawMapping);
                    var Model = collection.Person;
                    assert.equal(Model.name, 'Person');
                    assert.equal(Model.id, 'id');
                    assert.equal(Model.collection, 'myCollection');
                    assert.include(Model._attributeNames, 'name');
                    assert.include(Model._attributeNames, 'age');
                    assert.ok(Model);
                }

                it('mappings', function () {
                    assertMapping(collection);
                });
            });

        });


    })

});