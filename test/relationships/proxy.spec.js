var s = require('../../index')
    , assert = require('chai').assert;

describe('relationship proxy', function () {

    var Collection = require('../../src/collection').Collection;
    var ForeignKeyRelationship = require('../../src/foreignKeyRelationship').ForeignKeyRelationship;
    var RelatedObjectProxy = require('../../src/relationship').RelatedObjectProxy;
    var collection, carMapping, personMapping;

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
        collection.install(done);

    });

    function configureAPI(type, reverseName, done) {
        collection = new Collection('myCollection');
        carMapping = collection.mapping('Car', {
            id: 'id',
            attributes: ['colour', 'name'],
            relationships: {
                owner: {
                    mapping: 'Person',
                    type: type,
                    reverse: reverseName
                }
            }
        });
        personMapping = collection.mapping('Person', {
            id: 'id',
            attributes: ['name', 'age']
        });
        collection.install(done);


    }


    describe('faults', function () {
        it('not a fault if no related object', function () {
            var car = carMapping._new({colour: 'red', name: 'Aston Martin', id: 'asdasd'});
            var relationship = new ForeignKeyRelationship('owner', 'cars', carMapping, personMapping);
            var proxy = new RelatedObjectProxy(relationship, car);
            assert.notOk(proxy.isFault());
        });
        it('is not a fault if related object exists', function () {
            var person = personMapping._new({name: 'Michael Ford', id: 'asdasd'});
            var car = carMapping._new({colour: 'red', name: 'Aston Martin', id: 'asdasd'});
            var relationship = new ForeignKeyRelationship('owner', 'cars', carMapping, personMapping);
            var proxy = new RelatedObjectProxy(relationship, car);
            proxy._id = person._id;
            proxy.relatedObject = person;
            assert.notOk(proxy.isFault());
        });
        it('is a fault if related object exists, but hasnt been obtained yet', function () {
            var person = personMapping._new({name: 'Michael Ford', id: 'asdasd'});
            var car = carMapping._new({colour: 'red', name: 'Aston Martin', id: 'asdasd'});
            var relationship = new ForeignKeyRelationship('owner', 'cars', carMapping, personMapping);
            var proxy = new RelatedObjectProxy(relationship, car);
            proxy._id = person._id;
            assert.ok(proxy.isFault());
        });
    });





});