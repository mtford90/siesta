var s = require('../index')
    , assert = require('chai').assert;

describe('relationship notifications', function () {

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

    describe('no fault', function () {

        var notif;

        describe('forward', function () {
            describe('already exists', function () {

                var anotherPerson;

                beforeEach(function (done) {
                    personMapping.map({name: 'Bob'}, function (err, _anotherPerson) {
                        if (err) done(err);
                        anotherPerson = _anotherPerson;
                        car.owner = anotherPerson;
                        notificationCentre.once('myCollection:Car', function (n) {
                            notif = n;
                            done();
                        });
                        car.owner = person;
                    });


                });

                it('change is of type set', function () {
                    assert.equal(notif.change.type, ChangeType.Set);
                });

                it('has old', function () {
                    assert.equal(notif.change.old, anotherPerson);
                });

                it('new is the new owner', function () {
                    assert.equal(notif.change.new, person);
                });

                it('field is owner', function () {
                    assert.equal(notif.change.field, 'owner');
                });

            });

            describe('doesnt exist', function () {
                beforeEach(function (done) {
                    notificationCentre.once('myCollection:Car', function (n) {
                        notif = n;
                        done();
                    });
                    car.owner = person;
                });
                it('change is of type set', function () {
                    assert.equal(notif.change.type, ChangeType.Set);
                });

                it('has no old', function () {
                    assert.notOk(notif.change.old);
                });

                it('new is the new owner', function () {
                    assert.equal(notif.change.new, person);
                });

                it('field is owner', function () {
                    assert.equal(notif.change.field, 'owner');
                });
            });
        });





    });


});