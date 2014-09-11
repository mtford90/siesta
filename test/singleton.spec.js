var s = require('../index')
    , assert = require('chai').assert;

describe('singleton', function () {

    var SiestaModel = require('../src/object').SiestaModel;
    var Collection = require('../src/collection').Collection;
    var cache = require('../src/cache');
    var store = require('../src/store');

    var collection, carMapping;

    function CarObject() {
        SiestaModel.apply(this, arguments);
    }

    CarObject.prototype = Object.create(SiestaModel.prototype);

    beforeEach(function (done) {
        s.reset(true);
        collection = new Collection('Car');
        carMapping = collection.mapping('Car', {
            id: 'id',
            attributes: ['colour', 'name'],
            singleton: true
        });
        collection.install(done);
    });

    it('should raise an error if we try create more than one', function (done) {
        var obj = carMapping._new({colour: 'red'});
        obj.save(function (err) {
            if (err) done(err);
            obj = carMapping._new({colour: 'blue'});
            obj.save(function (err) {
                if (err) {
                    dump(err);
                    done();
                }
                else {
                    done('Did not receive an error creating two singletons!');
                }
            });
        });
    });

    it('should map onto the same singleton object, even if a different identifier', function (done) {
        carMapping.map({colour: 'red', id: 5}, function (err, car) {
            if (err) done(err);
            carMapping.map({colour: 'blue', id: 10}, function (err, car2) {
                if (err) done(err);
                assert.equal(car, car2);
                assert.equal(car.colour, 'blue');
                assert.equal(car.id, 10);
                done();
            });
        });
    });

    it('should map onto the same singleton object', function (done) {
        carMapping.map({colour: 'red'}, function (err, car) {
            if (err) done(err);
            carMapping.map({colour: 'blue'}, function (err, car2) {
                if (err) done(err);
                assert.equal(car, car2);
                assert.equal(car.colour, 'blue');
                done();
            });
        });
    });

    it('store should return singleton', function (done) {
        carMapping.map({colour: 'red', id: 5}, function (err, car) {
            if (err) done(err);
            cache.reset();
            store.get({mapping: carMapping}, function (err, obj) {
                if (err) done(err);
                assert.equal(obj._id, car._id);
                done();
            });
        });
    });

    it('cache should return singleton', function (done) {
        carMapping.map({colour: 'red', id: 5}, function (err, car) {
            if (err) done(err);
            var obj = cache.get({mapping: carMapping});
            assert.equal(obj, car);
            done();
        });
    });

    it('get should simply return the car', function (done) {
        carMapping.map({colour: 'red', id: 5}, function (err, car) {
            if (err) done(err);
            carMapping.get(function (err, _car) {
                if (err) done(err);
                assert.equal(car, _car);
                done();
            });
        });
    });

});