var s = require('../index')
    , assert = require('chai').assert;

describe('object!!', function () {

    var SiestaModel = require('../src/object').SiestaModel;
    var Mapping = require('../src/mapping').Mapping;

    var mapping;

    beforeEach(function () {
        s.reset(true);
        mapping = new Mapping({
            type: 'Car',
            id: 'id',
            attributes: ['colour', 'name'],
            collection: 'myCollection'
        });
    });

    describe('fields', function (){

        it('idField', function () {
            var r = new SiestaModel(mapping);
            assert.equal(r.idField, 'id');
        });

        it('type field', function () {
            var r = new SiestaModel(mapping);
            assert.equal(r.type, 'Car');
        });

        it('collection field', function () {
            var r = new SiestaModel(mapping);
            assert.equal(r.collection, 'myCollection');
        });
    });

});