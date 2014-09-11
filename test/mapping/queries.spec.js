var s = require('../../index')
    , assert = require('chai').assert;

describe('mapping queries', function () {

    var Pouch = require('../../src/pouch');
    var SiestaModel = require('../../src/object').SiestaModel;
    var Collection = require('../../src/collection').Collection;

    beforeEach(function () {
        s.reset(true);
    });

    describe('queries', function () {
        var collection, mapping;
        beforeEach(function (done) {
            collection = new Collection('myCollection');
            mapping = collection.mapping('Car', {
                id: 'id',
                attributes: ['color', 'name']
            });
            collection.install(function (err) {
                if (err) done(err);
                Pouch.getPouch().bulkDocs([
                    {
                        type: 'Car',
                        id: 4,
                        color: 'red',
                        name: 'Aston Martin',
                        collection: 'myCollection'
                    },
                    {
                        type: 'Car',
                        id: 5,
                        color: 'blue',
                        name: 'Ford',
                        collection: 'myCollection'
                    }
                ], function (err) {
                    done(err);
                });
            });


        });

        it('all', function (done) {
            mapping.all(function (err, cars) {
                if (err) done(err);
                assert.equal(cars.length, 2);
                _.each(cars, function (car) {
                    assert.instanceOf(car, SiestaModel);
                });
                done();
            });
        });

        it('query', function (done) {
            mapping.query({color: 'red'}, function (err, cars) {
                if (err) done(err);
                assert.equal(cars.length, 1);
                _.each(cars, function (car) {
                    assert.instanceOf(car, SiestaModel);
                });
                done();
            });
        });

        it('get', function (done) {
            mapping.get(4, function (err, car) {
                if (err) done(err);
                assert.ok(car);
                assert.instanceOf(car, SiestaModel);
                assert.equal(car.color, 'red');
                done();
            });
        });

    });

});