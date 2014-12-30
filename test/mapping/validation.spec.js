var s = require('../../core/index')
    , assert = require('chai').assert;

describe('mapping validation', function () {
    var Mapping =  require('../../core/model').Model;

    before(function () {
        s.ext.storageEnabled = false;
    });

    beforeEach(function (done) {
        s.reset(done);
    });

    describe('validation', function () {
        it('no name', function () {
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
                name: 'Car'
            });
            var errors = m._validate();
            assert.equal(1, errors.length);
        });
    });
});