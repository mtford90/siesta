var s = require('../../src/index')
    , assert = require('chai').assert;

describe('mapping validation', function () {
    var Mapping =  require('../../src/mapping').Mapping;

    beforeEach(function () {
        s.reset(true);
    });

    describe('validation', function () {
        it('no type', function () {
            var m = new Mapping({
                id: 'id',
                attributes: ['field1', 'field2'],
                collection: 'myCollection'
            });
            var errors = m._validate();
            assert.equal(1, errors.length);
        });
        it('no collection', function () {
            var m = new Mapping({
                id: 'id',
                attributes: ['field1', 'field2'],
                type: 'Car'
            });
            var errors = m._validate();
            assert.equal(1, errors.length);
        });
    });
});