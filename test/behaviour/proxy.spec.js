var s = require('../../index')
    , assert = require('chai').assert;

describe('proxy integration', function () {

    var Collection = require('../../src/collection').Collection;
    var cache = require('../../src/cache');
    var RelationshipType = require('../../src/relationship').RelationshipType;

    var carMapping, personMapping;

    var collection;

    beforeEach(function (done) {
        s.reset(true);
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
            name: 'Aston Martin', owner: {
                name: 'Michael Ford',
                age: 2,
                id: 2
            },
            id: 5
        }, function (err, car) {
            if (err) done(err);
            collection.save(function (err) {
                if (err) done(err);
                cache.reset();
                personMapping.get(2, function (err, p) {
                    var proxy = p.carsProxy;
                    assert.ok(p.cars.isFault);
                    p.carsProxy.get(function (err, cars) {
                        assert.equal(cars.length, 1);
                        done(err);
                    });
                });
            });
        });
    });

});