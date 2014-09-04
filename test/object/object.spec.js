var s = require('../../index')
    , assert = require('chai').assert;

describe('object!!', function () {



    var
        RestObject = s.RestObject
        , Mapping = s.Mapping;



    beforeEach(function () {
        s.reset(true);
    });

    it('idField', function () {
        var mapping = new Mapping({
            type: 'Car',
            id: 'id',
            attributes: ['colour', 'name'],
            collection: 'myCollection'
        });
        var r = new RestObject(mapping);
        assert.equal(r.idField, 'id');
    });

    it('type field', function () {
        var mapping = new Mapping({
            type: 'Car',
            id: 'id',
            attributes: ['colour', 'name'],
            collection: 'myCollection'
        });
        var r = new RestObject(mapping);
        assert.equal(r.type, 'Car');
    });

    it('collection field', function () {
        var mapping = new Mapping({
            type: 'Car',
            id: 'id',
            attributes: ['colour', 'name'],
            collection: 'myCollection'
        });
        var r = new RestObject(mapping);
        assert.equal(r.collection, 'myCollection');
    });

});