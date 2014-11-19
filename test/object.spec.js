var s = require('../src/index'),
    assert = require('chai').assert;

describe('object!!', function() {

    var SiestaModel = require('../src/siestaModel').SiestaModel;
    var Mapping = require('../src/mapping').Mapping;
    var cache = require('../src/cache');
    var Collection = require('../src/collection').Collection;

    var mapping, collection;

    beforeEach(function(done) {
        s.reset(true);
        collection = new Collection('myCollection');
        mapping = collection.mapping({
            name: 'Car',
            id: 'id',
            attributes: ['colour', 'name'],
            collection: 'myCollection'
        })
        collection.install(done);
    });

    describe('fields', function() {


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

    describe('removal', function() {

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