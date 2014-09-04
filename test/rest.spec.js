var s = require('../index')
    , assert = require('chai').assert
    , _ = require('underscore');


describe('rest', function () {




    var Collection = s.Collection
        , CollectionRegistry = s.CollectionRegistry;
    var collection;



    beforeEach(function () {
        s.reset(true);
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
                collection.mapping('Person', {
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
            });

        });


    })

});