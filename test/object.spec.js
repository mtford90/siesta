var s = require('../index'),
    assert = require('chai').assert;

describe('object!!', function() {

    var SiestaModel = require('../src/object').SiestaModel;
    var Mapping = require('../src/mapping').Mapping;
    var cache = require('../src/cache');

    var mapping;

    beforeEach(function() {
        s.reset(true);
        mapping = new Mapping({
            type: 'Car',
            id: 'id',
            attributes: ['colour', 'name'],
            collection: 'myCollection'
        });
    });

    describe('fields', function() {

        it('idField', function() {
            var r = new SiestaModel(mapping);
            assert.equal(r.idField, 'id');
        });

        it('type field', function() {
            var r = new SiestaModel(mapping);
            assert.equal(r.type, 'Car');
        });

        it('collection field', function() {
            var r = new SiestaModel(mapping);
            assert.equal(r.collection, 'myCollection');
        });

        it('type field', function() {
            var r = new SiestaModel(mapping);
            assert.notOk(r.isSaved);
        });

    });

    describe.only('removal', function() {

        var car;

        function remove() {
            car = new SiestaModel(mapping);
            car.colour = 'red';
            car.name = 'Aston Martin';
            car.id = '2';
            car._id = 'xyz';
            cache.insert(car);
            assert.notOk(car.removed);
            assert.ok(cache.contains(car));
            car.remove();
            assert.notOk(cache.contains(car));
            assert.ok(car.removed);
        }

        it('deletion', function() {
            remove();
        });

        it('restore', function() {
            remove();
            car.restore();
            assert.notOk(car.removed);
            assert.ok(cache.contains(car));
        });

    });

});