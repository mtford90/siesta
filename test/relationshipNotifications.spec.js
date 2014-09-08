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


        describe('forward', function () {
            describe('already exists', function () {

                var anotherPerson;

                var carNotifs = [];
                var personNotifs = [];
                var carListener, personListener;

                beforeEach(function (done) {

                    carNotifs = [];
                    personNotifs = [];


                    personMapping.map({name: 'Bob'}, function (err, _anotherPerson) {
                        if (err) done(err);
                        anotherPerson = _anotherPerson;
                        car.owner = anotherPerson;

                        function checkIfDone() {
                            if (carNotifs.length == 1 && personNotifs.length == 2) {
                                done();
                            }
                            else if (carNotifs.length > 1) {
                                done('Too many car notifications.');
                            }
                            else if (personNotifs.length > 2) {
                                done('Too many person notifications.');
                            }
                        }

                        carListener = function (n) {
                            carNotifs.push(n);
                            checkIfDone();
                        };
                        notificationCentre.on('myCollection:Car', carListener);

                        personListener = function (n) {
                            personNotifs.push(n);
                            checkIfDone();
                        };
                        notificationCentre.on('myCollection:Person', personListener);


                        car.owner = person;
                    });
                });

                afterEach(function () {
                    notificationCentre.removeListener('myCollection:Car', carListener);
                    notificationCentre.removeListener('myCollection:Person', personListener);
                });

                it('one car notif', function () {
                    assert.equal(carNotifs.length, 1);
                });

                it('two person notifs', function () {
                    assert.equal(personNotifs.length, 2);
                });

                describe('car notif', function () {

                    var carNotif;

                    beforeEach(function () {
                        carNotif = carNotifs[0];
                    });

                    it('change is of type set', function () {
                        assert.equal(carNotif.change.type, ChangeType.Set);
                    });

                    it('has old', function () {
                        assert.equal(carNotif.change.old, anotherPerson);
                    });

                    it('new is the new owner', function () {
                        assert.equal(carNotif.change.new, person);
                    });

                    it('field is owner', function () {
                        assert.equal(carNotif.change.field, 'owner');
                    });
                });

                describe('person notif', function () {

                    var personNotif;
                    var anotherPersonNotif;

                    beforeEach(function () {
                        _.each(personNotifs, function (p) {
                            if (p.obj == person) {
                                personNotif = p;
                            }
                            else {
                                anotherPersonNotif = p;
                            }
                        });
                    });

                    describe('person notif', function () {
                        it('is of splice type', function () {
                            assert.equal(personNotif.change.type, ChangeType.Splice);
                        });
                        it('index 0', function () {
                            assert.equal(personNotif.change.index, 0);
                        });
                        it('addedCount of 1', function () {
                            assert.equal(personNotif.change.addedCount, 1);
                        });
                        it('removed length 0', function () {
                            assert.notOk(personNotif.change.removed.length);
                        });
                        it('field cars', function () {
                            assert.equal(personNotif.change.field, 'cars');
                        })
                    });

                    describe('another person notif', function () {
                        it('is of splice type', function () {
                            assert.equal(anotherPersonNotif.change.type, ChangeType.Splice);
                        });
                        it('index 0', function () {
                            assert.equal(anotherPersonNotif.change.index, 0);
                        });
                        it('addedCount of 0', function () {
                            assert.equal(anotherPersonNotif.change.addedCount, 0);
                        });
                        it('removed length 1', function () {
                            assert.equal(anotherPersonNotif.change.removed.length, 1);
                        });
                        it('field cars', function () {
                            assert.equal(anotherPersonNotif.change.field, 'cars');
                        })
                    });


                });


            });
            describe('doesnt exist', function () {
                var carNotif, personNotif;


                beforeEach(function (done) {
                    notificationCentre.once('myCollection:Car', function (n) {
                        carNotif = n;
                        done();
                    });
                    notificationCentre.once('myCollection:Person', function (n) {
                        personNotif = n;
                        done();
                    });
                    car.owner = person;
                });


                describe('person notif', function () {
                    it('is of splice type', function () {
                        assert.equal(personNotif.change.type, ChangeType.Splice);
                    });
                    it('index 0', function () {
                        assert.equal(personNotif.change.index, 0);
                    });
                    it('addedCount of 1', function () {
                        assert.equal(personNotif.change.addedCount, 1);
                    });
                    it('removed length 0', function () {
                        assert.notOk(personNotif.change.removed.length);
                    });
                    it('field cars', function () {
                        assert.equal(personNotif.change.field, 'cars');
                    })
                });

                describe('car notif', function () {
                    it('change is of type set', function () {
                        assert.equal(carNotif.change.type, ChangeType.Set);
                    });

                    it('has no old', function () {
                        assert.notOk(carNotif.change.old);
                    });

                    it('new is the new owner', function () {
                        assert.equal(carNotif.change.new, person);
                    });

                    it('field is owner', function () {
                        assert.equal(carNotif.change.field, 'owner');
                    });
                });


            });
        });

        describe('reverse', function () {
            describe('set', function () {
                describe('doesnt exist', function () {
                    var carNotif, personNotif;


                    beforeEach(function (done) {
                        notificationCentre.once('myCollection:Car', function (n) {
                            carNotif = n;
                            if (carNotif && personNotif) {
                                done();
                            }
                        });
                        notificationCentre.once('myCollection:Person', function (n) {
                            personNotif = n;
                            if (carNotif && personNotif) {
                                done();
                            }
                        });
                        person.cars = [car];
                    });


                    describe('person notif', function () {
                        it('change is of type set', function () {
                            assert.equal(personNotif.change.type, ChangeType.Set);
                        });

                        it('has no old', function () {
                            assert.notOk(personNotif.change.old);
                        });

                        it('car is in the persons cars', function () {
                            assert.equal(personNotif.change.new.length, 1);
                            assert.include(personNotif.change.new, car);
                        });

                        it('field is cars', function () {
                            assert.equal(personNotif.change.field, 'cars');
                        });
                    });

                    describe('car notif', function () {
                        it('change is of type set', function () {
                            assert.equal(carNotif.change.type, ChangeType.Set);
                        });

                        it('has no old', function () {
                            assert.notOk(carNotif.change.old);
                        });

                        it('new is the new owner', function () {
                            assert.equal(carNotif.change.new, person);
                        });

                        it('field is owner', function () {
                            assert.equal(carNotif.change.field, 'owner');
                        });
                    });


                });
                describe('already exists', function () {

                    var anotherPerson;

                    var carNotifs = [];
                    var personNotifs = [];
                    var carListener, personListener;

                    beforeEach(function (done) {

                        carNotifs = [];
                        personNotifs = [];


                        personMapping.map({name: 'Bob'}, function (err, _anotherPerson) {
                            if (err) done(err);
                            anotherPerson = _anotherPerson;
                            car.owner = anotherPerson;

                            function checkIfDone() {
                                if (carNotifs.length == 1 && personNotifs.length == 2) {
                                    done();
                                }
                                else if (carNotifs.length > 1) {
                                    done('Too many car notifications.');
                                }
                                else if (personNotifs.length > 2) {
                                    done('Too many person notifications.');
                                }
                            }

                            carListener = function (n) {
                                carNotifs.push(n);
                                checkIfDone();
                            };
                            notificationCentre.on('myCollection:Car', carListener);

                            personListener = function (n) {
                                personNotifs.push(n);
                                checkIfDone();
                            };
                            notificationCentre.on('myCollection:Person', personListener);


                            person.cars = [car];
                        });
                    });

                    afterEach(function () {
                        notificationCentre.removeListener('myCollection:Car', carListener);
                        notificationCentre.removeListener('myCollection:Person', personListener);
                    });

                    it('one car notif', function () {
                        assert.equal(carNotifs.length, 1);
                    });

                    it('two person notifs', function () {
                        assert.equal(personNotifs.length, 2);
                    });

                    describe('car notif', function () {

                        var carNotif;

                        beforeEach(function () {
                            carNotif = carNotifs[0];
                        });

                        it('change is of type set', function () {
                            assert.equal(carNotif.change.type, ChangeType.Set);
                        });

                        it('has old', function () {
                            assert.equal(carNotif.change.old, anotherPerson);
                        });

                        it('new is the new owner', function () {
                            assert.equal(carNotif.change.new, person);
                        });

                        it('field is owner', function () {
                            assert.equal(carNotif.change.field, 'owner');
                        });
                    });

                    describe('person notif', function () {

                        var personNotif;
                        var anotherPersonNotif;

                        beforeEach(function () {
                            _.each(personNotifs, function (p) {
                                if (p.obj == person) {
                                    personNotif = p;
                                }
                                else {
                                    anotherPersonNotif = p;
                                }
                            });
                        });

                        describe('new person notif', function () {
                            it('change is of type set', function () {
                                assert.equal(personNotif.change.type, ChangeType.Set);
                            });

                            it('has no old', function () {
                                assert.notOk(personNotif.change.old);
                            });

                            it('car is in the persons cars', function () {
                                assert.equal(personNotif.change.new.length, 1);
                                assert.include(personNotif.change.new, car);
                            });

                            it('field is cars', function () {
                                assert.equal(personNotif.change.field, 'cars');
                            });

                        });


                        describe('another person notif', function () {
                            it('is of splice type', function () {
                                assert.equal(anotherPersonNotif.change.type, ChangeType.Splice);
                            });
                            it('index 0', function () {
                                assert.equal(anotherPersonNotif.change.index, 0);
                            });
                            it('addedCount of 0', function () {
                                assert.equal(anotherPersonNotif.change.addedCount, 0);
                            });
                            it('removed length 1', function () {
                                assert.equal(anotherPersonNotif.change.removed.length, 1);
                            });
                            it('field cars', function () {
                                assert.equal(anotherPersonNotif.change.field, 'cars');
                            })
                        });

                    });





                });

            });

        });

    });


});


