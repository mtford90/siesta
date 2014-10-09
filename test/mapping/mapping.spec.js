var s = require('../../index')
    , assert = require('chai').assert;

describe('mapping!', function () {
    var Mapping = require('../../src/mapping').Mapping;

    beforeEach(function () {
        s.reset(true);
    });

    it('_fields', function () {
        var m = new Mapping({
            type: 'type',
            id: 'id',
            attributes: ['field1', 'field2']
        });
        assert.include(m._fields, 'id');
        assert.include(m._fields, 'field1');
        assert.include(m._fields, 'field2');
        assert.notInclude(m._fields, 'type');
    });

    it('attributes', function () {
        var m = new Mapping({
            type: 'type',
            id: 'id',
            attributes: ['field1', 'field2']
        });
        assert.include(m.attributes, 'field1');
        assert.include(m.attributes, 'field2');
    });

    it('type', function () {
        var m = new Mapping({
            type: 'type',
            id: 'id',
            attributes: ['field1', 'field2']
        });
        assert.equal(m.type, 'type');
    });

    it('id', function () {
        var m = new Mapping({
            type: 'type',
            id: 'id',
            attributes: ['field1', 'field2']
        });
        assert.equal(m.id, 'id');
    });

    it('installation', function (done) {
        var m = new Mapping({
            type: 'Type',
            id: 'id',
            attributes: ['field1', 'field2'],
            collection: 'myCollection'
        });
        m.install(function (err) {
            if (err) done(err);
            assert.equal(s.ext.storage.Index.indexes.length, 8);
            done();
        });
    });


});