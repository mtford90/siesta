var s = require('../../index')
    , assert = require('chai').assert;

describe('mapping queries', function () {

    var Pouch = require('../../src/pouch');
    var SiestaModel = require('../../src/object').SiestaModel;
    var Collection = require('../../src/collection').Collection;
    var RelationshipType = require('../../src/relationship').RelationshipType;
    var cache = require('../../src/cache');

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

    describe('reverse', function () {

        var carMapping, personMapping;

        var collection;

        beforeEach(function (done) {
            collection = new Collection('myCollection');
            carMapping = collection.mapping('Car', {
                id: 'id',
                attributes: ['colour', 'name'],
                relationships: {
                    owner: {
                        type: RelationshipType.ForeignKey,
                        reverse: 'cars',
                        mapping: 'Person'
                    }
                }
            });
            personMapping = collection.mapping('Person', {
                id: 'id',
                attributes: ['name', 'age']
            });
            collection.install(done);
        });

        it('xyz', function (done) {
            carMapping.map({
                colour: 'red',
                name: 'Aston Martin',
                owner: {
                    name: 'Michael Ford',
                    age: 2,
                    id: '2'
                },
                id: 5
            }, function (err, car) {
                if (err) done(err);
                cache.reset();
                personMapping.get('2', function (err, p) {
                    assert.ok(p, 'Should be able to fetch the person');
                    dump(p.cars);
                    assert.ok(p.cars.isFault);
                    p.carsProxy.get(function (err, cars) {
                        assert.equal(cars.length, 1);
                        assert.equal(cars[0].owner, p);
                        done(err);
                    });
                });
            });
        });
    });

});