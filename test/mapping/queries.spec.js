var s = require('../../core/index'),
    assert = require('chai').assert;

describe('mapping queries', function() {

    var SiestaModel = require('../../core/siestaModel').SiestaModel;
    var Collection = require('../../core/collection').Collection;
    var RelationshipType = require('../../core/relationship').RelationshipType;
    var cache = require('../../core/cache');

    beforeEach(function() {
        s.reset(true);
    });

    describe('queries', function() {
        var collection, mapping;
        beforeEach(function(done) {
            collection = new Collection('myCollection');
            mapping = collection.mapping('Car', {
                id: 'id',
                attributes: ['color', 'name']
            });
            collection.install(function(err) {
                if (err) done(err);
                mapping.map([{
                    id: 4,
                    color: 'red',
                    name: 'Aston Martin'
                }, {
                    id: 5,
                    color: 'blue',
                    name: 'Ford'
                }], done);
            });
        });

        it('all', function(done) {
            mapping.all(function(err, cars) {
                if (err) done(err);
                assert.equal(cars.length, 2);
                _.each(cars, function(car) {
                    assert.instanceOf(car, SiestaModel);
                });
                done();
            });
        });

        it('query', function(done) {
            this.timeout(10000);
            mapping.query({
                color: 'red'
            }, function(err, cars) {
                if (err) done(err);
                assert.equal(cars.length, 1);
                _.each(cars, function(car) {
                    assert.instanceOf(car, SiestaModel);
                });
                done();
            });
        });

        it('get', function(done) {
            mapping.get(4, function(err, car) {
                if (err) done(err);
                assert.ok(car);
                assert.instanceOf(car, SiestaModel);
                assert.equal(car.color, 'red');
                done();
            });
        });


    });

    describe('reverse', function() {
        var carMapping, personMapping;

        var collection;

        beforeEach(function(done) {
            collection = new Collection('myCollection');
            carMapping = collection.mapping('Car', {
                id: 'id',
                attributes: ['colour', 'name'],
                relationships: {
                    owner: {
                        type: RelationshipType.OneToMany,
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

        it('cached', function(done) {
            carMapping.map({
                colour: 'red',
                name: 'Aston Martin',
                owner: {
                    name: 'Michael Ford',
                    age: 2,
                    id: '2'
                },
                id: 5
            }, function(err, car) {
                if (err) done(err);
                personMapping.get('2', function(err, p) {
                    if (err) done(err);
                    assert.ok(p, 'Should be able to fetch the person');
                    p.__proxies['cars'].get(function(err, cars) {
                        assert.equal(cars.length, 1);
                        assert.equal(cars[0].owner, p);
                        done(err);
                    });
                });
            });
        });
    });
});