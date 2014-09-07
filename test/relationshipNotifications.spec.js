var s = require('../index')
    , assert = require('chai').assert;

describe.only('relationship notifications', function () {

    var Collection = require('../src/collection').Collection
        , ChangeType = require('../src/changeType').ChangeType
        , RelationshipType = require('../src/relationship').RelationshipType
        , notificationCentre = require('../src/notificationCentre').notificationCentre
    ;

    beforeEach(function () {
        s.reset(true);
    });

    var collection, carMapping, personMapping;
    var car, person;

    afterEach(function () {
        person = null;
        car = null;
        collection = null;
        carMapping = null;
    });


    beforeEach(function (done) {

        collection = new Collection('myCollection');
        carMapping = collection.mapping('Car', {
            id: 'id',
            attributes: ['colour', 'name'],
            relationships: {
                owner: {
                    mapping: 'Person',
                    type: RelationshipType.ForeignKey,
                    reverse: 'cars'
                }
            }
        });
        personMapping = collection.mapping('Person', {
            id: 'id',
            attributes: ['name', 'age']
        });
        collection.install(function () {
            carMapping.map({colour: 'red', name: 'Aston Martin'}, function (err, _car) {
                if (err) done(err);
                car = _car;
                personMapping.map({name: 'Michael Ford'}, function (err, _person) {
                    if (err) done(err);
                    person = _person;
                    done();
                });
            });
        });

    });

    describe('forward', function () {
        beforeEach(function (done) {
            notificationCentre.once('myCollection:Car', function () {
                done();
            });
        });


        it('xyz', function () {
        });
    });




});