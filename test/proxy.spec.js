var s = require('../index')
    , assert = require('chai').assert;

describe('new object proxy', function () {

    var NewObjectProxy = require('../src/relationship').NewObjectProxy;
    var Mapping = require('../src/mapping').Mapping;
    var RestObject = require('../src/object').RestObject;
    var Relationship = require('../src/relationship').Relationship;
    var Fault = require('../src/relationship').Fault;

    var carMapping, personMapping;

    beforeEach(function () {
        s.reset(true);
        carMapping = new Mapping({
            type: 'Car',
            id: 'id',
            attributes: ['colour', 'name'],
            collection: 'myCollection'
        });
        personMapping = new Mapping({
            type: 'Person',
            id: 'id',
            attributes: ['name', 'age'],
            collection: 'myCollection'
        });
    });

    describe('installation', function () {
        var car, person, relationship, proxy;

        beforeEach(function () {
            person = new RestObject(personMapping);
            relationship = new Relationship('owner', 'cars', carMapping, personMapping);
            proxy = new NewObjectProxy(relationship);
        });

        describe('forward installation', function () {
            beforeEach(function () {
                car = new RestObject(carMapping);
                proxy.install(car);
            });

            it('is a fault', function () {
                assert.instanceOf(car.owner, Fault);
                assert.ok(car.owner.isFault);
            })

            it('installs a set function', function () {

            })

        });


    });


});