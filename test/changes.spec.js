var s = require('../index')
    , assert = require('chai').assert;

describe('changes', function () {

    var changes = require('../src/changes');
    var RestError = require('../src/error').RestError;

    var Collection = require('../src/collection').Collection;

    var collection, mapping;

    beforeEach(function (done) {
        s.reset(true);
        collection = new Collection('myCollection');
        mapping = collection.mapping('Car', {
            id: 'id',
            attributes: ['colour', 'name']
        });
        collection.install(done);
    });

    describe('registering changes', function () {

        it('xyz', function () {
            changes.registerChange({
                collection: collection,
                mapping: mapping,
                _id: 'xyz'
            })
        });

        describe('errors', function () {
            it('should throw an error if no mapping', function () {
                assert.throws(
                    function () {
                        changes.registerChange({
                            collection: collection
                        })
                    }, RestError
                );
            });

            it('should throw an error if no collection', function () {
                assert.throws(
                    function () {
                        changes.registerChange({
                            mapping: mapping
                        })
                    }, RestError
                );
            })
        });

    });

    describe('applying changes', function () {

    });

    describe('merge changes', function () {

    });

});