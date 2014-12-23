var s = require('../core/index')
    , assert = require('chai').assert;


describe('rest', function () {
    var Collection = require('../core/collection').Collection;
    var CollectionRegistry = require('../core/collectionRegistry').CollectionRegistry;
    var collection;


    beforeEach(function () {
        s.reset();
    });

    describe('Create Basic Rest API', function () {

        beforeEach(function (done) {
            collection = new Collection('myCollection');
            collection.install(done);
        });

        it('global access', function () {
            assert.equal(CollectionRegistry.myCollection, collection);
        });

    });

    describe('Object mapping registration', function () {

        var collection;
        describe('basic', function () {

            beforeEach(function (done) {
                collection = new Collection('myCollection');
                collection.model('Person', {
                    id: 'id',
                    attributes: ['name', 'age']
                });
                collection.install(done);
            });

            describe('raw mapping to Mapping object', function () {
                function assertMapping(collection) {
                    var rawMapping = collection._rawMappings.Person;
                    assert.ok(rawMapping);
                    var mappingObj = collection.Person;
                    assert.equal(mappingObj.type, 'Person');
                    assert.equal(mappingObj.id, 'id');
                    assert.equal(mappingObj.collection, 'myCollection');
                    assert.include(mappingObj._attributeNames, 'name');
                    assert.include(mappingObj._attributeNames, 'age');
                    assert.ok(mappingObj);
                }

                it('mappings', function () {
                    assertMapping(collection);
                });
            });

        });


    })

});