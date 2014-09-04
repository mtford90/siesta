var s = require('../../index')
    , assert = require('chai').assert;

describe('relationship contributions', function () {
    var Collection = s.Collection
        , RestError = s.RestError
        , ForeignKeyRelationship = s.ForeignKeyRelationship
        , RelatedObjectProxy = s.RelatedObjectProxy
        ;

    var collection, carMapping, personMapping, dogMapping;


    beforeEach(function (done) {
        s.reset(true);

        collection = new Collection('myCollection');
        carMapping = collection.mapping('Car', {
            id: 'id',
            attributes: ['colour', 'name']
        });
        personMapping = collection.mapping('Person', {
            id: 'id',
            attributes: ['name', 'age']
        });
        dogMapping = collection.mapping('Dog', {
            id: 'id',
            attributes: ['name', 'age', 'breed']
        });
        collection.install(done);

    });

    it('should contribute to an object belonging to the forward mapping', function () {
        var obj = carMapping._new({colour: 'red', name: 'Aston Martin', id: 'asdasd'});
        var relationship = new ForeignKeyRelationship('owner', 'cars', carMapping, personMapping);
        relationship.contributeToRestObject(obj);
        assert.instanceOf(obj.owner, RelatedObjectProxy);
    });
    it('should contribute to an object belonging to a reverse mapping', function () {
        var obj = personMapping._new({name: 'Michael Ford', id: 'asdasd'});
        var relationship = new ForeignKeyRelationship('owner', 'cars', carMapping, personMapping);
        relationship.contributeToRestObject(obj);
        assert.instanceOf(obj.cars, RelatedObjectProxy);
    });
    it('should throw an error if relationship has ', function () {
        var obj = dogMapping._new({name: 'Woody', id: 'asdasd', age: 2, breed: 'Chinese Crested'});
        var relationship = new ForeignKeyRelationship('owner', 'cars', carMapping, personMapping);
        assert.throws(_.bind(relationship.contributeToRestObject, relationship, obj), RestError);
    })

});