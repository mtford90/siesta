var s = require('../src/index'),
    assert = require('chai').assert;

describe('singleton mapping', function() {

    var SiestaModel = require('../src/siestaModel').SiestaModel;
    var Collection = require('../src/collection').Collection;
    var cache = require('../src/cache');
    var store = require('../src/store');

    var collection, carMapping;

    function CarObject() {
        SiestaModel.apply(this, arguments);
    }

    CarObject.prototype = Object.create(SiestaModel.prototype);

    beforeEach(function(done) {
        s.reset(true);
        collection = new Collection('Car');
        carMapping = collection.mapping('Car', {
            id: 'id',
            attributes: ['colour', 'name'],
            singleton: true
        });
        collection.install(done);
    });

    it('should map onto the same singleton object, even if a different identifier', function(done) {
        carMapping.map({
            colour: 'red',
            id: 5
        }, function(err, car) {
            if (err) done(err);
            carMapping.map({
                colour: 'blue',
                id: 10
            }, function(err, car2) {
                if (err) done(err);
                assert.equal(car, car2);
                assert.equal(car.colour, 'blue');
                assert.equal(car.id, 10);
                done();
            });
        });
    });

    it('should map onto the same singleton object', function(done) {
        carMapping.map({
            colour: 'red'
        }, function(err, car) {
            if (err) done(err);
            carMapping.map({
                colour: 'blue'
            }, function(err, car2) {
                if (err) done(err);
                assert.equal(car, car2);
                assert.equal(car.colour, 'blue');
                done();
            });
        });
    });



    it('cache should return singleton', function(done) {
        carMapping.map({
            colour: 'red',
            id: 5
        }, function(err, car) {
            if (err) done(err);
            var obj = cache.get({
                mapping: carMapping
            });
            assert.equal(obj, car);
            done();
        });
    });

    it('get should simply return the car', function(done) {
        this.timeout(5000);
        carMapping.map({
            colour: 'red',
            id: 5
        }, function(err, car) {
            if (err) done(err);
            carMapping.get(function(err, _car) {
                if (err) done(err);
                assert.equal(car, _car);
                done();
            });
        });
    });

});