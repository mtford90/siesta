var s = require('../index')
    , assert = require('chai').assert;

describe('new object proxy', function () {

    var NewObjectProxy = require('../src/proxy').NewObjectProxy;
    var OneToOneProxy = require('../src/oneToOneProxy').OneToOneProxy;
    var ForeignKeyProxy = require('../src/foreignKeyProxy').ForeignKeyProxy;
    var ManyToManyProxy = require('../src/manyToManyProxy').ManyToManyProxy;
    var Mapping = require('../src/mapping').Mapping;
    var SiestaModel = require('../src/object').SiestaModel;
    var Fault = require('../src/proxy').Fault;
    var RestError = require('../src/error').RestError;
    var Collection = require('../src/collection').Collection;
    var cache = require('../src/cache');
    var changes = require('../src/pouch/changes');
    var ChangeType = require('../src/pouch/changeType').ChangeType;

    var carMapping, personMapping;

    var collection;

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

    describe('generic', function () {
        describe('installation', function () {
            var car, person, relationship, proxy;

            beforeEach(function () {
                proxy = new NewObjectProxy({
                    reverseMapping: personMapping,
                    forwardMapping: carMapping,
                    reverseName: 'cars',
                    forwardName: 'owner'
                });
                car = new SiestaModel(carMapping);
                person = new SiestaModel(personMapping);
            });

            it('throws an error if try to install twice', function () {
                proxy.install(car);
                assert.throws(function () {
                    proxy.install(car);
                }, RestError);
            });

            it('isReverse throws an error if proxy not installed', function () {
                assert.throws(function () {
                    proxy.isForward;
                }, RestError);
            });

            it('isReverse throws an error if proxy not installed', function () {
                assert.throws(function () {
                    proxy.isForward;
                }, RestError);
            });

            describe('forward installation', function () {
                beforeEach(function () {
                    proxy.install(car);
                });

                it('installs setter', function () {
                    assert.ok(car['setOwner']);
                });
                it('installs getter', function () {
                    assert.ok(car['getOwner']);
                });

                describe('faults', function () {
                    it('is forward', function () {
                        assert.ok(proxy.isForward);
                    });

                    it('is not reverse', function () {
                        assert.notOk(proxy.isReverse);
                    });

                    describe('no relationship', function () {
                        it('is a fault object', function () {
                            assert.instanceOf(car.owner, Fault);
                        });

                        it('is faulted, as no relationship set', function () {
                            assert.ok(car.owner.isFault);
                        });
                    });

                    describe('relationship, faulted', function () {
                        beforeEach(function () {
                            proxy._id = 'xyz';
                        });

                        it('is a fault object', function () {
                            assert.instanceOf(car.owner, Fault);
                        });

                        it('is faulted, as _id exists, but no related object', function () {
                            assert.ok(car.owner.isFault);
                        });
                    });

                    describe('relationship, faulted', function () {
                        beforeEach(function () {
                            proxy._id = 'xyz';
                            proxy.related = new SiestaModel(personMapping);
                            proxy.related._id = 'xyz';
                        });

                        it('is a fault object', function () {
                            assert.equal(car.owner, proxy.related);
                        });

                        it('is not faulted, as relationship set and related assigned', function () {
                            assert.notOk(car.owner.isFault);
                        });
                    })
                });

            });

            describe('reverse installation', function () {
                beforeEach(function () {
                    proxy.install(person);
                });

                describe('faults', function () {
                    it('is reerse', function () {
                        assert.ok(proxy.isReverse);
                    });

                    it('is not forward', function () {
                        assert.notOk(proxy.isForward);
                    });

                    describe('no relationship', function () {
                        it('is a fault object', function () {
                            assert.instanceOf(person.cars, Fault);
                        });

                        it('is faulted, as no relationship set', function () {
                            assert.ok(person.cars.isFault);
                        });
                    });

                    describe('relationship, faulted', function () {
                        beforeEach(function () {
                            proxy._id = ['xyz'];
                        });

                        it('is a fault object', function () {
                            assert.instanceOf(person.cars, Fault);
                        });

                        it('is faulted, as relationship set', function () {
                            assert.ok(person.cars.isFault);
                        });
                    });

                    describe('relationship, faulted', function () {
                        beforeEach(function () {
                            proxy._id = 'xyz';
                            proxy.related = [new SiestaModel(carMapping)];
                            proxy.related[0]._id = 'xyz';
                        });

                        it('is a fault object', function () {
                            assert.equal(person.cars[0], proxy.related[0]);
                        });

                        it('is not faulted, as relationship set and related assigned', function () {
                            assert.notOk(person.cars.isFault);
                        });
                    })
                });
            });
        });

        describe('subclass', function () {
            var car, person, proxy;

            beforeEach(function () {
                proxy = new NewObjectProxy({
                    reverseMapping: personMapping,
                    forwardMapping: carMapping,
                    reverseName: 'cars',
                    forwardName: 'owner'
                });
                car = new SiestaModel(carMapping);
                person = new SiestaModel(personMapping);
                proxy.install(car);
            });

            it('set should fail if not subclasses', function () {
                assert.throws(function () {
                    car.owner = person;
                }, RestError);
                assert.throws(function () {
                    car.owner.set(person);
                }, RestError);
            });

            it('get should fail if not subclasses', function () {
                assert.throws(function () {
                    car.owner.get(function () {

                    })
                }, RestError);
            })
        })

    });

    describe('one-to-one', function () {
        var carProxy, personProxy;
        var car, person;

        describe('get', function () {
            beforeEach(function () {
                carProxy = new OneToOneProxy({
                    reverseMapping: personMapping,
                    forwardMapping: carMapping,
                    reverseName: 'cars',
                    forwardName: 'owner'
                });
                personProxy = new OneToOneProxy({
                    reverseMapping: personMapping,
                    forwardMapping: carMapping,
                    reverseName: 'cars',
                    forwardName: 'owner'
                });
                car = new SiestaModel(carMapping);
                car._id = 'car';
                carProxy.install(car);
                person = new SiestaModel(personMapping);
                person._id = 'person';
                personProxy.install(person);
                cache.insert(person);
                cache.insert(car);
            });

            it('forward', function (done) {
                carProxy._id = person._id;
                assert.ok(carProxy.isFault);
                carProxy.get(function (err, obj) {
                    if (err) done(err);
                    assert.equal(person, obj);
                    done();
                });
            });

            it('reverse', function (done) {
                personProxy._id = car._id;
                assert.ok(personProxy.isFault);
                personProxy.get(function (err, obj) {
                    if (err) done(err);
                    assert.equal(car, obj);
                    assert.equal(personProxy.related, car);
                    done();
                });
            });


        });
        describe('set', function () {
            var carProxy, personProxy;
            var car, person;
            beforeEach(function () {
                carProxy = new OneToOneProxy({
                    reverseMapping: personMapping,
                    forwardMapping: carMapping,
                    reverseName: 'cars',
                    forwardName: 'owner'
                });
                personProxy = new OneToOneProxy({
                    reverseMapping: personMapping,
                    forwardMapping: carMapping,
                    reverseName: 'cars',
                    forwardName: 'owner'
                });
                car = new SiestaModel(carMapping);
                car._id = 'car';
                carProxy.install(car);
                carProxy.isFault = false;
                person = new SiestaModel(personMapping);
                person._id = 'person';
                personProxy.install(person);
                personProxy.isFault = false;
            });

            describe('none pre-existing', function () {

                function validateChanges() {
                    var carChanges = changes.changesForIdentifier(car._id);
                    assert.equal(carChanges.length, 1);
                    var personChanges = changes.changesForIdentifier(person._id);
                    assert.equal(personChanges.length, 1);
                    var personChange = personChanges[0];
                    var carChange = carChanges[0];
                    assert.equal(personChange.collection, 'myCollection');
                    assert.equal(personChange.mapping, 'Person');
                    assert.equal(personChange._id, person._id);
                    assert.equal(personChange.field, 'cars');
                    assert.equal(personChange.new, car);
                    assert.equal(personChange.newId, car._id);
                    assert.notOk(personChange.old);
                    assert.notOk(personChange.oldId);
                    assert.equal(carChange.collection, 'myCollection');
                    assert.equal(carChange.mapping, 'Car');
                    assert.equal(carChange._id, car._id);
                    assert.equal(carChange.field, 'owner');
                    assert.equal(carChange.new, person);
                    assert.equal(carChange.newId, person._id);
                    assert.notOk(carChange.old);
                    assert.notOk(carChange.oldId);
                }

                describe('forward', function () {
                    it('should set forward', function () {
                        car.owner = person;
                        assert.equal(car.owner, person);
                        assert.equal(carProxy._id, person._id);
                        assert.equal(carProxy.related, person);
                    });

                    it('should set reverse', function () {
                        car.owner = person;
                        assert.equal(person.cars, car);
                        assert.equal(personProxy._id, car._id);
                        assert.equal(personProxy.related, car);
                    });

                    it('should set changes', function () {
                        car.owner = person;
                        validateChanges();
                    });
                });

                describe('backwards', function () {
                    it('should set forward', function () {
                        person.cars = car;
                        assert.equal(person.cars, car);
                        assert.equal(personProxy._id, car._id);
                        assert.equal(personProxy.related, car);

                    });

                    it('should set reverse', function () {
                        person.cars = car;
                        assert.equal(car.owner, person);
                        assert.equal(carProxy._id, person._id);
                        assert.equal(carProxy.related, person);
                    });

                    it('should set changes', function () {
                        person.cars = car;
                        validateChanges();
                    });
                });


            });

            describe('pre-existing', function () {

                var anotherPerson, anotherPersonProxy;

                function validateChangesNoFault() {
                    var carChanges = changes.changesForIdentifier(car._id);
                    assert.equal(carChanges.length, 2);
                    var personChanges = changes.changesForIdentifier(person._id);
                    assert.equal(personChanges.length, 1);
                    var anotherPersonChanges = changes.changesForIdentifier(anotherPerson._id);
                    assert.equal(anotherPersonChanges.length, 2);
                    var personChange = personChanges[0];
                    var firstCarChange = carChanges[0];
                    var secondCarChange = carChanges[1];
                    var firstAnotherPersonChange = anotherPersonChanges[0];
                    var secondAnotherPersonChange = anotherPersonChanges[1];
                    assert.equal(personChange.collection, 'myCollection');
                    assert.equal(personChange.mapping, 'Person');
                    assert.equal(personChange._id, person._id);
                    assert.equal(personChange.field, 'cars');
                    assert.equal(personChange.new, car);
                    assert.equal(personChange.newId, car._id);
                    assert.notOk(personChange.old);
                    assert.notOk(personChange.oldId);
                    assert.equal(firstAnotherPersonChange.collection, 'myCollection');
                    assert.equal(firstAnotherPersonChange.mapping, 'Person');
                    assert.equal(firstAnotherPersonChange._id, anotherPerson._id);
                    assert.equal(firstAnotherPersonChange.field, 'cars');
                    assert.equal(firstAnotherPersonChange.newId, car._id);
                    assert.equal(firstAnotherPersonChange.new, car);
                    assert.notOk(firstAnotherPersonChange.old);
                    assert.notOk(firstAnotherPersonChange.oldId);
                    assert.equal(secondCarChange.collection, 'myCollection');
                    assert.equal(secondCarChange.mapping, 'Car');
                    assert.equal(secondCarChange._id, car._id);
                    assert.equal(secondCarChange.field, 'owner');
                    assert.equal(secondCarChange.new, person);
                    assert.equal(secondCarChange.newId, person._id);
                    assert.equal(secondCarChange.old, anotherPerson);
                    assert.equal(secondCarChange.oldId, anotherPerson._id);
                    assert.equal(firstCarChange.collection, 'myCollection');
                    assert.equal(firstCarChange.mapping, 'Car');
                    assert.equal(firstCarChange._id, car._id);
                    assert.equal(firstCarChange.field, 'owner');
                    assert.equal(firstCarChange.new, anotherPerson);
                    assert.equal(firstCarChange.newId, anotherPerson._id);
                    assert.notOk(firstCarChange.old);
                    assert.notOk(firstCarChange.oldId);
                }

                function validateChangesFault() {
                    var carChanges = changes.changesForIdentifier(car._id);
                    assert.equal(carChanges.length, 2);
                    var personChanges = changes.changesForIdentifier(person._id);
                    assert.equal(personChanges.length, 1);
                    var anotherPersonChanges = changes.changesForIdentifier(anotherPerson._id);
                    assert.equal(anotherPersonChanges.length, 2);
                    var personChange = personChanges[0];
                    var firstCarChange = carChanges[0];
                    var secondCarChange = carChanges[1];
                    var firstAnotherPersonChange = anotherPersonChanges[0];
                    var secondAnotherPersonChange = anotherPersonChanges[1];
                    assert.equal(personChange.collection, 'myCollection');
                    assert.equal(personChange.mapping, 'Person');
                    assert.equal(personChange._id, person._id);
                    assert.equal(personChange.field, 'cars');
                    assert.equal(personChange.new, car);
                    assert.equal(personChange.newId, car._id);
                    assert.notOk(personChange.old);
                    assert.notOk(personChange.oldId);
                    assert.equal(firstAnotherPersonChange.collection, 'myCollection');
                    assert.equal(firstAnotherPersonChange.mapping, 'Person');
                    assert.equal(firstAnotherPersonChange._id, anotherPerson._id);
                    assert.equal(firstAnotherPersonChange.field, 'cars');
                    assert.equal(firstAnotherPersonChange.newId, car._id);
                    assert.equal(firstAnotherPersonChange.new, car);
                    assert.notOk(firstAnotherPersonChange.old);
                    assert.notOk(firstAnotherPersonChange.oldId);
                    assert.equal(secondCarChange.collection, 'myCollection');
                    assert.equal(secondCarChange.mapping, 'Car');
                    assert.equal(secondCarChange._id, car._id);
                    assert.equal(secondCarChange.field, 'owner');
                    assert.equal(secondCarChange.new, person);
                    assert.equal(secondCarChange.newId, person._id);
                    // Due to fault.
                    assert.notOk(secondCarChange.old);
                    assert.equal(secondCarChange.oldId, anotherPerson._id);
                    assert.equal(firstCarChange.collection, 'myCollection');
                    assert.equal(firstCarChange.mapping, 'Car');
                    assert.equal(firstCarChange._id, car._id);
                    assert.equal(firstCarChange.field, 'owner');
                    assert.equal(firstCarChange.new, anotherPerson);
                    assert.equal(firstCarChange.newId, anotherPerson._id);
                    assert.notOk(firstCarChange.old);
                    assert.notOk(firstCarChange.oldId);
                }

                beforeEach(function () {
                    anotherPerson = new SiestaModel(personMapping);
                    anotherPerson._id = 'anotherPerson';
                    anotherPersonProxy = new OneToOneProxy({
                        reverseMapping: personMapping,
                        forwardMapping: carMapping,
                        reverseName: 'cars',
                        forwardName: 'owner'
                    });
                    anotherPersonProxy.install(anotherPerson);
                    anotherPersonProxy.isFault = false;
                    cache.insert(anotherPerson);
                    cache.insert(person);
                    cache.insert(car);
                });


                describe('no fault', function () {
                    beforeEach(function () {
                        car.owner = anotherPerson;
                    });
                    describe('forward', function () {
                        it('should set forward', function () {
                            car.owner = person;
                            assert.equal(car.owner, person);
                            assert.equal(carProxy._id, person._id);
                            assert.equal(carProxy.related, person);
                        });

                        it('should set reverse', function () {
                            car.owner = person;
                            assert.equal(person.cars, car);
                            assert.equal(personProxy._id, car._id);
                            assert.equal(personProxy.related, car);
                        });

                        it('should clear the old', function () {
                            car.owner = person;
                            assert.notOk(anotherPersonProxy.isFault);
                            assert.notOk(anotherPersonProxy._id);
                            assert.notOk(anotherPersonProxy.related);
                        });
                        it('should set changes', function () {
                            car.owner = person;
                            validateChangesNoFault();
                        });

                    });
                    describe('backwards', function () {
                        it('should set forward', function () {
                            person.cars = car;
                            assert.equal(person.cars, car);
                            assert.equal(personProxy._id, car._id);
                            assert.equal(personProxy.related, car);

                        });

                        it('should set reverse', function () {
                            person.cars = car;
                            assert.equal(car.owner, person);
                            assert.equal(carProxy._id, person._id);
                            assert.equal(carProxy.related, person);
                        });

                        it('should clear the old', function () {
                            person.cars = car;
                            assert.notOk(anotherPersonProxy._id);
                            assert.notOk(anotherPersonProxy.related);
                            assert.notOk(anotherPersonProxy.isFault);
                        });

                        it('should set changes', function () {
                            person.cars = car;
                            validateChangesNoFault();
                        });
                    });
                });
                describe('fault', function () {
                    beforeEach(function () {
                        car.owner = anotherPerson;
                        carProxy.related = undefined;
                        anotherPersonProxy.related = undefined;
                    });
                    describe('forward', function () {
                        it('should set forward', function () {
                            car.owner = person;
                            assert.equal(car.owner, person);
                            assert.equal(carProxy._id, person._id);
                            assert.equal(carProxy.related, person);
                        });

                        it('should set reverse', function () {
                            car.owner = person;
                            assert.equal(person.cars, car);
                            assert.equal(personProxy._id, car._id);
                            assert.equal(personProxy.related, car);
                        });

                        it('should set changes', function () {
                            car.owner = person;
                            validateChangesFault();
                        });

                    });
                    describe('backwards', function () {
                        it('should set forward', function () {
                            person.cars = car;
                            assert.equal(person.cars, car);
                            assert.equal(personProxy._id, car._id);
                            assert.equal(personProxy.related, car);

                        });

                        it('should set reverse', function () {
                            person.cars = car;
                            assert.equal(car.owner, person);
                            assert.equal(carProxy._id, person._id);
                            assert.equal(carProxy.related, person);
                        });

                        it('should set changes', function () {
                            person.cars = car;
                            validateChangesFault();
                        });
                    });
                });

            });
        })
    });

    describe('foreign key', function () {
        var carProxy, personProxy;
        var car, person;

        describe('get', function () {
            beforeEach(function () {
                carProxy = new ForeignKeyProxy({
                    reverseMapping: personMapping,
                    forwardMapping: carMapping,
                    reverseName: 'cars',
                    forwardName: 'owner'
                });
                personProxy = new ForeignKeyProxy({
                    reverseMapping: personMapping,
                    forwardMapping: carMapping,
                    reverseName: 'cars',
                    forwardName: 'owner'
                });
                car = new SiestaModel(carMapping);
                car._id = 'car';
                carProxy.install(car);
                person = new SiestaModel(personMapping);
                person._id = 'person';
                personProxy.install(person);
                cache.insert(person);
                cache.insert(car);
            });

            describe('get', function () {
                describe('no fault', function () {

                    beforeEach(function () {
                        carProxy.isFault = false;
                        personProxy.isFault = false;
                    });

                    it('forward', function (done) {
                        carProxy._id = person._id;
                        carProxy.related = person;
                        carProxy.get(function (err, obj) {
                            if (err) done(err);
                            assert.equal(person, obj);
                            done();
                        });
                    });

                    it('reverse', function (done) {
                        personProxy._id = [car._id];
                        personProxy.related = [car];
                        personProxy.get(function (err, cars) {
                            if (err) done(err);
                            assert.include(cars, car);
                            assert.include(personProxy.related, car);
                            done();
                        });
                    });
                });

                describe('fault', function () {
                    it('forward', function (done) {
                        carProxy._id = person._id;
                        carProxy.get(function (err, obj) {
                            if (err) done(err);
                            assert.equal(person, obj);
                            done();
                        });
                    });

                    it('reverse', function (done) {
                        personProxy._id = [car._id];
                        personProxy.get(function (err, cars) {
                            if (err) done(err);
                            assert.equal(cars.length, 1);
                            assert.include(cars, car);
                            assert.include(personProxy.related, car);
                            done();
                        });
                    });
                });

            });


        });

        describe('set', function () {
            var carProxy, personProxy;
            var car, person;
            beforeEach(function () {
                carProxy = new ForeignKeyProxy({
                    reverseMapping: personMapping,
                    forwardMapping: carMapping,
                    reverseName: 'cars',
                    forwardName: 'owner'
                });
                personProxy = new ForeignKeyProxy({
                    reverseMapping: personMapping,
                    forwardMapping: carMapping,
                    reverseName: 'cars',
                    forwardName: 'owner'
                });
                car = new SiestaModel(carMapping);
                car._id = 'car';
                carProxy.install(car);
                carProxy.isFault = false;
                person = new SiestaModel(personMapping);
                person._id = 'person';
                personProxy.install(person);
                personProxy.isFault = false;
            });

            describe('none pre-existing', function () {

                describe('forward', function () {
                    it('should set forward', function () {
                        car.owner = person;
                        assert.equal(car.owner, person);
                        assert.equal(carProxy._id, person._id);
                        assert.equal(carProxy.related, person);
                    });

                    it('should set reverse', function () {
                        car.owner = person;
                        assert.include(person.cars, car);
                        assert.include(personProxy._id, car._id);
                        assert.include(personProxy.related, car);
                    });

                    it('multiple', function () {
                        car.owner = person;
                        var anotherCar = new SiestaModel(carMapping);
                        anotherCar._id = 'anotherCar';
                        var anotherCarProxy = new ForeignKeyProxy({
                            reverseMapping: personMapping,
                            forwardMapping: carMapping,
                            reverseName: 'cars',
                            forwardName: 'owner'
                        });
                        anotherCarProxy.install(anotherCar);
                        anotherCarProxy.isFault = false;
                        anotherCar.owner = person;
                        assert.include(person.cars, car);
                        assert.include(person.cars, anotherCar);
                        assert.equal(car.owner, person);
                        assert.equal(anotherCar.owner, person);
                    })
                });

                describe('backwards', function () {
                    it('should set forward', function () {
                        person.cars = [car];
                        assert.include(person.cars, car);
                        assert.include(personProxy._id, car._id);
                        assert.include(personProxy.related, car);

                    });

                    it('should set reverse', function () {
                        person.cars = [car];
                        assert.equal(car.owner, person);
                        assert.equal(carProxy._id, person._id);
                        assert.equal(carProxy.related, person);
                    });
                });
            });


            describe('pre-existing', function () {

                var anotherPerson, anotherPersonProxy;

                beforeEach(function () {
                    anotherPerson = new SiestaModel(personMapping);
                    anotherPerson._id = 'anotherPerson';
                    anotherPersonProxy = new ForeignKeyProxy({
                        reverseMapping: personMapping,
                        forwardMapping: carMapping,
                        reverseName: 'cars',
                        forwardName: 'owner'
                    });
                    anotherPersonProxy.install(anotherPerson);
                    anotherPersonProxy.isFault = false;
                    cache.insert(anotherPerson);
                    cache.insert(person);
                    cache.insert(car);
                });


                describe('no fault', function () {


                    beforeEach(function () {
                        car.owner = anotherPerson;
                    });

                    describe('forward', function () {
                        it('should set forward', function () {
                            car.owner = person;
                            assert.equal(car.owner, person);
                            assert.equal(carProxy._id, person._id);
                            assert.equal(carProxy.related, person);
                        });

                        it('should set reverse', function () {
                            car.owner = person;
                            assert.include(person.cars, car);
                            assert.include(personProxy._id, car._id);
                            assert.include(personProxy.related, car);
                        });

                        it('should clear the old', function () {
                            car.owner = person;
                            assert.equal(anotherPersonProxy._id.length, 0);
                            assert.equal(anotherPersonProxy.related.length, 0);
                        });


                        it('generates correct changes', function () {
                            car.owner = person;
                            var carChanges = changes.changesForIdentifier(car._id);
                            assert.equal(carChanges.length, 2);
                            var personChanges = changes.changesForIdentifier(person._id);
                            assert.equal(personChanges.length, 1);
                            var anotherPersonChanges = changes.changesForIdentifier(anotherPerson._id);
                            assert.equal(anotherPersonChanges.length, 2);
                            var personChange = personChanges[0];
                            var firstCarChange = carChanges[0];
                            var secondCarChange = carChanges[1];
                            var firstAnotherPersonChange = anotherPersonChanges[0];
                            var secondAnotherPersonChange = anotherPersonChanges[1];
                            assert.equal(personChange.collection, 'myCollection');
                            assert.equal(personChange.mapping, 'Person');
                            assert.equal(personChange._id, person._id);
                            assert.equal(personChange.field, 'cars');
                            assert.equal(personChange.index, 0);
                            assert.equal(personChange.added.length, 1);
                            assert.include(personChange.added, car);
                            assert.equal(personChange.addedId.length, 1);
                            assert.include(personChange.addedId, car._id);
                            assert.equal(personChange.type, ChangeType.Splice);
                            assert.equal(firstAnotherPersonChange.collection, 'myCollection');
                            assert.equal(firstAnotherPersonChange.mapping, 'Person');
                            assert.equal(firstAnotherPersonChange._id, anotherPerson._id);
                            assert.equal(firstAnotherPersonChange.field, 'cars');
                            assert.equal(firstAnotherPersonChange.index, 0);
                            assert.equal(firstAnotherPersonChange.addedId.length, 1, 'First change addedId populated');
                            assert.include(firstAnotherPersonChange.addedId, car._id);
                            assert.equal(firstAnotherPersonChange.added.length, 1);
                            assert.include(firstAnotherPersonChange.added, car);
                            assert.equal(firstAnotherPersonChange.removed.length, 0);
                            assert.equal(firstAnotherPersonChange.type, ChangeType.Splice);
                            assert.equal(secondAnotherPersonChange.collection, 'myCollection');
                            assert.equal(secondAnotherPersonChange.mapping, 'Person');
                            assert.equal(secondAnotherPersonChange._id, anotherPerson._id);
                            assert.equal(secondAnotherPersonChange.field, 'cars');
                            assert.equal(secondAnotherPersonChange.index, 0);
                            assert.equal(secondAnotherPersonChange.added.length, 0);
                            assert.equal(secondAnotherPersonChange.removedId.length, 1);
                            assert.include(secondAnotherPersonChange.removedId, car._id);
                            assert.equal(secondAnotherPersonChange.removed.length, 1);
                            assert.include(secondAnotherPersonChange.removed, car);
                            assert.equal(secondAnotherPersonChange.type, ChangeType.Splice);
                            assert.equal(secondCarChange.collection, 'myCollection');
                            assert.equal(secondCarChange.mapping, 'Car');
                            assert.equal(secondCarChange._id, car._id);
                            assert.equal(secondCarChange.field, 'owner');
                            assert.equal(secondCarChange.new, person);
                            assert.equal(secondCarChange.newId, person._id);
                            assert.equal(secondCarChange.old, anotherPerson);
                            assert.equal(secondCarChange.oldId, anotherPerson._id);
                            assert.equal(secondCarChange.type, ChangeType.Set);
                            assert.equal(firstCarChange.collection, 'myCollection');
                            assert.equal(firstCarChange.mapping, 'Car');
                            assert.equal(firstCarChange._id, car._id);
                            assert.equal(firstCarChange.field, 'owner');
                            assert.equal(firstCarChange.newId, anotherPerson._id);
                            assert.equal(firstCarChange.new, anotherPerson);
                            assert.notOk(firstCarChange.old);
                            assert.notOk(firstCarChange.oldId);
                            assert.equal(firstCarChange.type, ChangeType.Set);
                        });

                    });

                    describe('backwards', function () {
                        it('should set forward', function () {
                            person.cars = [car];
                            assert.include(person.cars, car);
                            assert.include(personProxy._id, car._id);
                            assert.include(personProxy.related, car);
                        });

                        it('should set reverse', function () {
                            person.cars = [car];
                            assert.equal(car.owner, person);
                            assert.equal(carProxy._id, person._id);
                            assert.equal(carProxy.related, person);
                        });

                        it('should clear the old', function () {
                            person.cars = [car];
                            assert.equal(anotherPersonProxy._id.length, 0);
                            assert.equal(anotherPersonProxy.related.length, 0);
                        });

                        it('generates correct changes', function () {
                            person.cars = [car];
                            var carChanges = changes.changesForIdentifier(car._id);
                            assert.equal(carChanges.length, 2);
                            var personChanges = changes.changesForIdentifier(person._id);
                            assert.equal(personChanges.length, 1);
                            var anotherPersonChanges = changes.changesForIdentifier(anotherPerson._id);
                            assert.equal(anotherPersonChanges.length, 2);
                            var personChange = personChanges[0];
                            var firstCarChange = carChanges[0];
                            var secondCarChange = carChanges[1];
                            var firstAnotherPersonChange = anotherPersonChanges[0];
                            var secondAnotherPersonChange = anotherPersonChanges[1];
                            assert.equal(personChange.collection, 'myCollection');
                            assert.equal(personChange.mapping, 'Person');
                            assert.equal(personChange._id, person._id);
                            assert.equal(personChange.field, 'cars');
                            assert.notOk(personChange.old);
                            assert.notOk(personChange.oldId);
                            assert.equal(personChange.new.length, 1);
                            assert.equal(personChange.newId.length, 1);
                            assert.include(personChange.newId, car._id);
                            assert.include(personChange.new, car);
                            assert.equal(personChange.type, ChangeType.Set);
                            assert.equal(firstAnotherPersonChange.collection, 'myCollection');
                            assert.equal(firstAnotherPersonChange.mapping, 'Person');
                            assert.equal(firstAnotherPersonChange._id, anotherPerson._id);
                            assert.equal(firstAnotherPersonChange.field, 'cars');
                            assert.equal(firstAnotherPersonChange.index, 0);
                            assert.equal(firstAnotherPersonChange.added.length, 1);
                            assert.equal(firstAnotherPersonChange.addedId.length, 1);
                            assert.equal(firstAnotherPersonChange.removed.length, 0);
                            assert.equal(firstAnotherPersonChange.removedId.length, 0);
                            assert.equal(firstAnotherPersonChange.type, ChangeType.Splice);
                            assert.include(firstAnotherPersonChange.added, car);
                            assert.include(firstAnotherPersonChange.addedId, car._id);
                            assert.equal(secondAnotherPersonChange.collection, 'myCollection');
                            assert.equal(secondAnotherPersonChange.mapping, 'Person');
                            assert.equal(secondAnotherPersonChange._id, anotherPerson._id);
                            assert.equal(secondAnotherPersonChange.field, 'cars');
                            assert.equal(secondAnotherPersonChange.index, 0);
                            assert.equal(secondAnotherPersonChange.added.length, 0);
                            assert.equal(secondAnotherPersonChange.addedId.length, 0);
                            assert.equal(secondAnotherPersonChange.removed.length, 1);
                            assert.equal(secondAnotherPersonChange.removedId.length, 1);
                            assert.include(secondAnotherPersonChange.removedId, car._id);
                            assert.include(secondAnotherPersonChange.removed, car);
                            assert.equal(secondAnotherPersonChange.type, ChangeType.Splice);
                            assert.equal(secondCarChange.collection, 'myCollection');
                            assert.equal(secondCarChange.mapping, 'Car');
                            assert.equal(secondCarChange._id, car._id);
                            assert.equal(secondCarChange.field, 'owner');
                            assert.equal(secondCarChange.newId, person._id);
                            assert.equal(secondCarChange.new, person);
                            assert.equal(secondCarChange.old, anotherPerson);
                            assert.equal(secondCarChange.oldId, anotherPerson._id);
                            assert.equal(secondCarChange.type, ChangeType.Set);
                            assert.equal(firstCarChange.collection, 'myCollection');
                            assert.equal(firstCarChange.mapping, 'Car');
                            assert.equal(firstCarChange._id, car._id);
                            assert.equal(firstCarChange.field, 'owner');
                            assert.equal(firstCarChange.new, anotherPerson);
                            assert.equal(firstCarChange.newId, anotherPerson._id);
                            assert.notOk(firstCarChange.old);
                            assert.notOk(firstCarChange.oldId);
                            assert.equal(firstCarChange.type, ChangeType.Set);
                        });
                    });
                });

                describe('fault', function () {
                    beforeEach(function () {
                        car.owner = anotherPerson;
                        carProxy.related = undefined;
                        anotherPersonProxy.related = undefined;
                    });
                    describe('forward', function () {
                        it('should set forward', function () {
                            car.owner = person;
                            assert.equal(car.owner, person);
                            assert.equal(carProxy._id, person._id);
                            assert.equal(carProxy.related, person);
                        });

                        it('should set reverse', function () {
                            car.owner = person;
                            assert.include(person.cars, car);
                            assert.include(personProxy._id, car._id);
                            assert.include(personProxy.related, car);
                        });

                        it('generates correct changes', function () {
                            car.owner = person;
                            var carChanges = changes.changesForIdentifier(car._id);
                            assert.equal(carChanges.length, 2);
                            var personChanges = changes.changesForIdentifier(person._id);
                            assert.equal(personChanges.length, 1);
                            var anotherPersonChanges = changes.changesForIdentifier(anotherPerson._id);
                            assert.equal(anotherPersonChanges.length, 2);
                            var personChange = personChanges[0];
                            var firstCarChange = carChanges[0];
                            var secondCarChange = carChanges[1];
                            var firstAnotherPersonChange = anotherPersonChanges[0];
                            var secondAnotherPersonChange = anotherPersonChanges[1];
                            assert.equal(personChange.collection, 'myCollection');
                            assert.equal(personChange.mapping, 'Person');
                            assert.equal(personChange._id, person._id);
                            assert.equal(personChange.field, 'cars');
                            assert.equal(personChange.index, 0);
                            assert.equal(personChange.addedId.length, 1);
                            assert.include(personChange.addedId, car._id);
                            assert.equal(personChange.added.length, 1);
                            assert.include(personChange.added, car);
                            assert.equal(personChange.type, ChangeType.Splice);
                            assert.equal(firstAnotherPersonChange.collection, 'myCollection');
                            assert.equal(firstAnotherPersonChange.mapping, 'Person');
                            assert.equal(firstAnotherPersonChange._id, anotherPerson._id);
                            assert.equal(firstAnotherPersonChange.field, 'cars');
                            assert.equal(firstAnotherPersonChange.index, 0);
                            assert.equal(firstAnotherPersonChange.added.length, 1);
                            assert.include(firstAnotherPersonChange.added, car);
                            assert.equal(firstAnotherPersonChange.addedId.length, 1);
                            assert.include(firstAnotherPersonChange.addedId, car._id);
                            assert.equal(firstAnotherPersonChange.removed.length, 0);
                            assert.equal(firstAnotherPersonChange.type, ChangeType.Splice);
                            assert.equal(secondAnotherPersonChange.collection, 'myCollection');
                            assert.equal(secondAnotherPersonChange.mapping, 'Person');
                            assert.equal(secondAnotherPersonChange._id, anotherPerson._id);
                            assert.equal(secondAnotherPersonChange.field, 'cars');
                            assert.equal(secondAnotherPersonChange.removed.length, 1);
                            assert.include(secondAnotherPersonChange.removed, car);
                            assert.equal(secondAnotherPersonChange.removedId.length, 1);
                            assert.include(secondAnotherPersonChange.removedId, car._id);
                            assert.equal(secondAnotherPersonChange.type, ChangeType.Remove);
                            assert.equal(secondCarChange.collection, 'myCollection');
                            assert.equal(secondCarChange.mapping, 'Car');
                            assert.equal(secondCarChange._id, car._id);
                            assert.equal(secondCarChange.field, 'owner');
                            assert.equal(secondCarChange.new, person);
                            // Due to the fault.
                            assert.notOk(secondCarChange.old);
                            assert.equal(secondCarChange.newId, person._id);
                            assert.equal(secondCarChange.oldId, anotherPerson._id);
                            assert.equal(secondCarChange.type, ChangeType.Set);
                            assert.equal(firstCarChange.collection, 'myCollection');
                            assert.equal(firstCarChange.mapping, 'Car');
                            assert.equal(firstCarChange._id, car._id);
                            assert.equal(firstCarChange.field, 'owner');
                            assert.equal(firstCarChange.newId, anotherPerson._id);
                            assert.equal(firstCarChange.new, anotherPerson);
                            assert.notOk(firstCarChange.old);
                            assert.equal(firstCarChange.type, ChangeType.Set);
                        });

                    });

                    describe('backwards', function () {
                        it('should set forward', function () {
                            person.cars = [car];
                            assert.include(person.cars, car);
                            assert.include(personProxy._id, car._id);
                            assert.include(personProxy.related, car);
                        });

                        it('should set reverse', function () {
                            person.cars = [car];
                            assert.equal(car.owner, person);
                            assert.equal(carProxy._id, person._id);
                            assert.equal(carProxy.related, person);
                        });

                        it('generates correct changes', function () {
                            person.cars = [car];
                            var carChanges = changes.changesForIdentifier(car._id);
                            assert.equal(carChanges.length, 2);
                            var personChanges = changes.changesForIdentifier(person._id);
                            assert.equal(personChanges.length, 1);
                            var anotherPersonChanges = changes.changesForIdentifier(anotherPerson._id);
                            assert.equal(anotherPersonChanges.length, 2);
                            var personChange = personChanges[0];
                            var firstCarChange = carChanges[0];
                            var secondCarChange = carChanges[1];
                            var firstAnotherPersonChange = anotherPersonChanges[0];
                            var secondAnotherPersonChange = anotherPersonChanges[1];
                            assert.equal(personChange.collection, 'myCollection');
                            assert.equal(personChange.mapping, 'Person');
                            assert.equal(personChange._id, person._id);
                            assert.equal(personChange.field, 'cars');
                            assert.notOk(personChange.old);
                            assert.equal(personChange.newId.length, 1);
                            assert.include(personChange.newId, car._id);
                            assert.equal(personChange.new.length, 1);
                            assert.include(personChange.new, car);
                            assert.equal(personChange.newId.length, 1);
                            assert.include(personChange.newId, car._id);
                            assert.equal(personChange.type, ChangeType.Set);
                            assert.equal(firstAnotherPersonChange.collection, 'myCollection');
                            assert.equal(firstAnotherPersonChange.mapping, 'Person');
                            assert.equal(firstAnotherPersonChange._id, anotherPerson._id);
                            assert.equal(firstAnotherPersonChange.field, 'cars');
                            assert.equal(firstAnotherPersonChange.index, 0);
                            assert.equal(firstAnotherPersonChange.addedId.length, 1);
                            assert.include(firstAnotherPersonChange.addedId, car._id);
                            assert.equal(firstAnotherPersonChange.added.length, 1);
                            assert.include(firstAnotherPersonChange.added, car);
                            assert.equal(firstAnotherPersonChange.removed.length, 0);
                            assert.equal(firstAnotherPersonChange.removedId.length, 0);
                            assert.equal(firstAnotherPersonChange.type, ChangeType.Splice);
                            assert.equal(secondAnotherPersonChange.collection, 'myCollection');
                            assert.equal(secondAnotherPersonChange.mapping, 'Person');
                            assert.equal(secondAnotherPersonChange._id, anotherPerson._id);
                            assert.equal(secondAnotherPersonChange.field, 'cars');
                            assert.equal(secondAnotherPersonChange.removed.length, 1);
                            assert.include(secondAnotherPersonChange.removed, car);
                            assert.equal(secondAnotherPersonChange.removedId.length, 1);
                            assert.include(secondAnotherPersonChange.removedId, car._id);
                            assert.equal(secondAnotherPersonChange.type, ChangeType.Remove);
                            assert.equal(secondCarChange.collection, 'myCollection');
                            assert.equal(secondCarChange.mapping, 'Car');
                            assert.equal(secondCarChange._id, car._id);
                            assert.equal(secondCarChange.field, 'owner');
                            assert.equal(secondCarChange.newId, person._id);
                            assert.equal(secondCarChange.oldId, anotherPerson._id);
                            assert.equal(secondCarChange.new, person);
                            // Due to fault.
                            assert.notOk(secondCarChange.old);
                            assert.equal(secondCarChange.type, ChangeType.Set);
                            assert.equal(firstCarChange.collection, 'myCollection');
                            assert.equal(firstCarChange.mapping, 'Car');
                            assert.equal(firstCarChange._id, car._id);
                            assert.equal(firstCarChange.field, 'owner');
                            assert.equal(firstCarChange.newId, anotherPerson._id);
                            assert.equal(firstCarChange.new, anotherPerson);
                            assert.notOk(firstCarChange.old);
                            assert.notOk(firstCarChange.oldId);
                            assert.equal(firstCarChange.type, ChangeType.Set);
                        });

                    });

                });


            });

        })


    });

    describe('many to many', function () {
        var carProxy, personProxy;
        var car, person;

        describe('get', function () {
            beforeEach(function () {
                carProxy = new ManyToManyProxy({
                    reverseMapping: personMapping,
                    forwardMapping: carMapping,
                    reverseName: 'cars',
                    forwardName: 'owners'
                });
                personProxy = new ManyToManyProxy({
                    reverseMapping: personMapping,
                    forwardMapping: carMapping,
                    reverseName: 'cars',
                    forwardName: 'owners'
                });
                car = new SiestaModel(carMapping);
                car._id = 'car';
                carProxy.install(car);
                person = new SiestaModel(personMapping);
                person._id = 'person';
                personProxy.install(person);
                cache.insert(person);
                cache.insert(car);
            });

            describe('no fault', function () {

                beforeEach(function () {
                    carProxy.isFault = false;
                    personProxy.isFault = false;
                });

                it('forward', function (done) {
                    carProxy._id = [person._id];
                    carProxy.related = [person];
                    carProxy.get(function (err, people) {
                        if (err) done(err);
                        assert.include(people, person);
                        assert.include(carProxy.related, person);
                        done();
                    });
                });

                it('reverse', function (done) {
                    personProxy._id = [car._id];
                    personProxy.related = [car];
                    personProxy.get(function (err, cars) {
                        if (err) done(err);
                        assert.include(cars, car);
                        assert.include(personProxy.related, car);
                        done();
                    });
                });
            });

            describe('fault', function () {
                it('forward', function (done) {
                    carProxy._id = [person._id];
                    carProxy.get(function (err, people) {
                        if (err) done(err);
                        assert.include(people, person);
                        assert.include(carProxy.related, person);
                        done();
                    });
                });

                it('reverse', function (done) {
                    personProxy._id = [car._id];
                    personProxy.get(function (err, cars) {
                        if (err) done(err);
                        assert.equal(cars.length, 1);
                        assert.include(cars, car);
                        assert.include(personProxy.related, car);
                        done();
                    });
                });
            });

        });

        describe('set', function () {
            var carProxy, personProxy;
            var car, person;
            beforeEach(function () {
                carProxy = new ManyToManyProxy({
                    reverseMapping: personMapping,
                    forwardMapping: carMapping,
                    reverseName: 'cars',
                    forwardName: 'owners'
                });
                personProxy = new ManyToManyProxy({
                    reverseMapping: personMapping,
                    forwardMapping: carMapping,
                    reverseName: 'cars',
                    forwardName: 'owners'
                });
                car = new SiestaModel(carMapping);
                car._id = 'car';
                carProxy.install(car);
                carProxy.isFault = false;
                person = new SiestaModel(personMapping);
                person._id = 'person';
                personProxy.install(person);
                personProxy.isFault = false;
            });

            describe('none pre-existing', function () {

                describe('forward', function () {
                    it('should set forward', function () {
                        car.owners = [person];
                        assert.include(car.owners, person);
                        assert.include(carProxy._id, person._id);
                        assert.include(carProxy.related, person);
                    });

                    it('should set reverse', function () {
                        car.owners = [person];
                        assert.include(person.cars, car);
                        assert.include(personProxy._id, car._id);
                        assert.include(personProxy.related, car);
                    });
                });

                describe('backwards', function () {
                    it('should set forward', function () {
                        person.cars = [car];
                        assert.include(person.cars, car);
                        assert.include(personProxy._id, car._id);
                        assert.include(personProxy.related, car);

                    });

                    it('should set reverse', function () {
                        person.cars = [car];
                        assert.include(car.owners, person);
                        assert.include(carProxy._id, person._id);
                        assert.include(carProxy.related, person);
                    });
                });
            });


            describe('pre-existing', function () {

                var anotherPerson, anotherPersonProxy;

                beforeEach(function () {
                    anotherPerson = new SiestaModel(personMapping);
                    anotherPerson._id = 'anotherPerson';
                    anotherPersonProxy = new ManyToManyProxy({
                        reverseMapping: personMapping,
                        forwardMapping: carMapping,
                        reverseName: 'cars',
                        forwardName: 'owners'
                    });
                    anotherPersonProxy.install(anotherPerson);
                    anotherPersonProxy.isFault = false;
                    cache.insert(anotherPerson);
                    cache.insert(person);
                    cache.insert(car);
                });

                describe('no fault', function () {
                    beforeEach(function () {
                        car.owners = [anotherPerson];
                    });

                    describe('forward', function () {
                        it('should set forward', function () {
                            car.owners = [person];
                            assert.include(car.owners, person);
                            assert.include(carProxy._id, person._id);
                            assert.include(carProxy.related, person);
                        });

                        it('should set reverse', function () {
                            car.owners = [person];
                            assert.include(person.cars, car);
                            assert.include(personProxy._id, car._id);
                            assert.include(personProxy.related, car);
                        });

                        it('should clear the old', function () {
                            car.owners = [person];
                            assert.equal(anotherPersonProxy._id.length, 0);
                            assert.equal(anotherPersonProxy.related.length, 0);
                        });

                        it('generates correct changes', function () {
                            car.owners = [person];
                            var carChanges = changes.changesForIdentifier(car._id);
                            assert.equal(carChanges.length, 2);
                            var personChanges = changes.changesForIdentifier(person._id);
                            assert.equal(personChanges.length, 1);
                            var anotherPersonChanges = changes.changesForIdentifier(anotherPerson._id);
                            assert.equal(anotherPersonChanges.length, 2);
                            var personChange = personChanges[0];
                            var firstCarChange = carChanges[0];
                            var secondCarChange = carChanges[1];
                            var firstAnotherPersonChange = anotherPersonChanges[0];
                            var secondAnotherPersonChange = anotherPersonChanges[1];
                            assert.equal(personChange.collection, 'myCollection');
                            assert.equal(personChange.mapping, 'Person');
                            assert.equal(personChange._id, person._id);
                            assert.equal(personChange.field, 'cars');
                            assert.equal(personChange.index, 0);
                            assert.equal(personChange.addedId.length, 1);
                            assert.include(personChange.addedId, car._id);
                            assert.equal(personChange.added.length, 1);
                            assert.include(personChange.added, car);
                            assert.equal(personChange.type, ChangeType.Splice);
                            assert.equal(firstAnotherPersonChange.collection, 'myCollection');
                            assert.equal(firstAnotherPersonChange.mapping, 'Person');
                            assert.equal(firstAnotherPersonChange._id, anotherPerson._id);
                            assert.equal(firstAnotherPersonChange.field, 'cars');
                            assert.equal(firstAnotherPersonChange.index, 0);
                            assert.equal(firstAnotherPersonChange.addedId.length, 1);
                            assert.include(firstAnotherPersonChange.addedId, car._id);
                            assert.equal(firstAnotherPersonChange.added.length, 1);
                            assert.include(firstAnotherPersonChange.added, car);
                            assert.equal(firstAnotherPersonChange.removed.length, 0);
                            assert.equal(firstAnotherPersonChange.type, ChangeType.Splice);
                            assert.equal(secondAnotherPersonChange.collection, 'myCollection');
                            assert.equal(secondAnotherPersonChange.mapping, 'Person');
                            assert.equal(secondAnotherPersonChange._id, anotherPerson._id);
                            assert.equal(secondAnotherPersonChange.field, 'cars');
                            assert.equal(secondAnotherPersonChange.index, 0);
                            assert.equal(secondAnotherPersonChange.added.length, 0);
                            assert.equal(secondAnotherPersonChange.removedId.length, 1);
                            assert.include(secondAnotherPersonChange.removedId, car._id);
                            assert.equal(secondAnotherPersonChange.removed.length, 1);
                            assert.include(secondAnotherPersonChange.removed, car);
                            assert.equal(secondAnotherPersonChange.type, ChangeType.Splice);
                            assert.equal(secondCarChange.collection, 'myCollection');
                            assert.equal(secondCarChange.mapping, 'Car');
                            assert.equal(secondCarChange._id, car._id);
                            assert.equal(secondCarChange.field, 'owners');
                            assert.equal(secondCarChange.old.length, 1);
                            assert.equal(secondCarChange.new.length, 1);
                            assert.include(secondCarChange.new, person);
                            assert.equal(secondCarChange.newId.length, 1);
                            assert.include(secondCarChange.newId, person._id);
                            assert.equal(secondCarChange.type, ChangeType.Set);
                            assert.equal(firstCarChange.collection, 'myCollection');
                            assert.equal(firstCarChange.mapping, 'Car');
                            assert.equal(firstCarChange._id, car._id);
                            assert.equal(firstCarChange.field, 'owners');
                            assert.equal(firstCarChange.new.length, 1);
                            assert.include(firstCarChange.new, anotherPerson);
                            assert.equal(firstCarChange.newId.length, 1);
                            assert.include(firstCarChange.newId, anotherPerson._id);
                            assert.notOk(firstCarChange.old);
                            assert.notOk(firstCarChange.oldId);
                            assert.equal(firstCarChange.type, ChangeType.Set);
                        });

                    });

                    describe('backwards', function () {
                        it('should set forward', function () {
                            person.cars = [car];
                            assert.include(person.cars, car);
                            assert.include(personProxy._id, car._id);
                            assert.include(personProxy.related, car);
                        });

                        it('should set reverse', function () {
                            person.cars = [car];
                            assert.include(car.owners, person);
                            assert.include(carProxy._id, person._id);
                            assert.include(carProxy.related, person);
                        });

                        it('generates correct changes', function () {
                            person.cars = [car];
                            var carChanges = changes.changesForIdentifier(car._id);
                            assert.equal(carChanges.length, 2);
                            var personChanges = changes.changesForIdentifier(person._id);
                            assert.equal(personChanges.length, 1);
                            var anotherPersonChanges = changes.changesForIdentifier(anotherPerson._id);
                            assert.equal(anotherPersonChanges.length, 1);
                            var personChange = personChanges[0];
                            var firstCarChange = carChanges[0];
                            var secondCarChange = carChanges[1];
                            var firstAnotherPersonChange = anotherPersonChanges[0];
                            assert.equal(personChange.collection, 'myCollection');
                            assert.equal(personChange.mapping, 'Person');
                            assert.equal(personChange._id, person._id);
                            assert.equal(personChange.field, 'cars');
                            assert.notOk(personChange.old);
                            assert.equal(personChange.new.length, 1);
                            assert.include(personChange.new, car);
                            assert.equal(personChange.newId.length, 1);
                            assert.include(personChange.newId, car._id);
                            assert.equal(personChange.type, ChangeType.Set);
                            assert.equal(firstAnotherPersonChange.type, ChangeType.Splice);
                            assert.equal(firstAnotherPersonChange.collection, 'myCollection');
                            assert.equal(firstAnotherPersonChange.mapping, 'Person');
                            assert.equal(firstAnotherPersonChange._id, anotherPerson._id);
                            assert.equal(firstAnotherPersonChange.field, 'cars');
                            assert.equal(firstAnotherPersonChange.index, 0);
                            assert.equal(firstAnotherPersonChange.addedId.length, 1);
                            assert.include(firstAnotherPersonChange.addedId, car._id);
                            assert.equal(firstAnotherPersonChange.added.length, 1);
                            assert.include(firstAnotherPersonChange.added, car);
                            assert.equal(firstAnotherPersonChange.removed.length, 0);
                            assert.equal(firstAnotherPersonChange.removedId.length, 0);
                            assert.equal(secondCarChange.collection, 'myCollection');
                            assert.equal(secondCarChange.mapping, 'Car');
                            assert.equal(secondCarChange._id, car._id);
                            assert.equal(secondCarChange.field, 'owners');
                            assert.equal(secondCarChange.index, 1);
                            assert.equal(secondCarChange.type, ChangeType.Splice);
                            assert.include(secondCarChange.added, person);
                            assert.include(secondCarChange.addedId, person._id);
                            assert.equal(firstCarChange.collection, 'myCollection');
                            assert.equal(firstCarChange.mapping, 'Car');
                            assert.equal(firstCarChange._id, car._id);
                            assert.equal(firstCarChange.field, 'owners');
                            assert.include(firstCarChange.new, anotherPerson);
                            assert.include(firstCarChange.newId, anotherPerson._id);
                            assert.notOk(firstCarChange.old);
                            assert.notOk(firstCarChange.oldId);
                            assert.equal(firstCarChange.type, ChangeType.Set);
                        });
                    });
                });

                describe('fault', function () {
                    beforeEach(function () {
                        car.owners = [anotherPerson];
                        carProxy.related = undefined;
                        anotherPersonProxy.related = undefined;
                    });
                    describe('forward', function () {
                        it('should set forward', function () {
                            car.owners = [person];
                            assert.include(car.owners, person);
                            assert.include(carProxy._id, person._id);
                            assert.include(carProxy.related, person);
                        });

                        it('should set reverse', function () {
                            car.owners = [person];
                            assert.include(person.cars, car);
                            assert.include(personProxy._id, car._id);
                            assert.include(personProxy.related, car);
                        });

                        it('generates correct changes', function () {
                            car.owners = [person];
                            var carChanges = changes.changesForIdentifier(car._id);
                            assert.equal(carChanges.length, 2);
                            var personChanges = changes.changesForIdentifier(person._id);
                            assert.equal(personChanges.length, 1);
                            var anotherPersonChanges = changes.changesForIdentifier(anotherPerson._id);
                            assert.equal(anotherPersonChanges.length, 2);
                            var personChange = personChanges[0];
                            var firstCarChange = carChanges[0];
                            var secondCarChange = carChanges[1];
                            var firstAnotherPersonChange = anotherPersonChanges[0];
                            var secondAnotherPersonChange = anotherPersonChanges[1];
                            assert.equal(personChange.type, ChangeType.Splice);
                            assert.equal(personChange.collection, 'myCollection');
                            assert.equal(personChange.mapping, 'Person');
                            assert.equal(personChange._id, person._id);
                            assert.equal(personChange.field, 'cars');
                            assert.equal(personChange.index, 0);
                            assert.equal(personChange.addedId.length, 1);
                            assert.include(personChange.addedId, car._id);
                            assert.equal(personChange.added.length, 1);
                            assert.include(personChange.added, car);
                            assert.equal(firstAnotherPersonChange.type, ChangeType.Splice);
                            assert.equal(firstAnotherPersonChange.collection, 'myCollection');
                            assert.equal(firstAnotherPersonChange.mapping, 'Person');
                            assert.equal(firstAnotherPersonChange._id, anotherPerson._id);
                            assert.equal(firstAnotherPersonChange.field, 'cars');
                            assert.equal(firstAnotherPersonChange.index, 0);
                            assert.equal(firstAnotherPersonChange.added.length, 1);
                            assert.equal(firstAnotherPersonChange.removed.length, 0);
                            assert.equal(firstAnotherPersonChange.addedId.length, 1);
                            assert.equal(firstAnotherPersonChange.removedId.length, 0);
                            assert.include(firstAnotherPersonChange.addedId, car._id);
                            assert.include(firstAnotherPersonChange.added, car);
                            assert.equal(secondAnotherPersonChange.type, ChangeType.Remove);
                            assert.equal(secondAnotherPersonChange.collection, 'myCollection');
                            assert.equal(secondAnotherPersonChange.mapping, 'Person');
                            assert.equal(secondAnotherPersonChange._id, anotherPerson._id);
                            assert.equal(secondAnotherPersonChange.field, 'cars');
                            assert.equal(secondAnotherPersonChange.removed.length, 1);
                            assert.include(secondAnotherPersonChange.removed, car);
                            assert.equal(secondAnotherPersonChange.removedId.length, 1);
                            assert.include(secondAnotherPersonChange.removedId, car._id);
                            assert.equal(secondCarChange.type, ChangeType.Set);
                            assert.equal(secondCarChange.collection, 'myCollection');
                            assert.equal(secondCarChange.mapping, 'Car');
                            assert.equal(secondCarChange._id, car._id);
                            assert.equal(secondCarChange.field, 'owners');
                            assert.equal(secondCarChange.oldId.length, 1);
                            assert.equal(secondCarChange.newId.length, 1);
                            assert.include(secondCarChange.new, person);
                            assert.include(secondCarChange.newId, person._id);
                            assert.equal(firstCarChange.type, ChangeType.Set);
                            assert.equal(firstCarChange.collection, 'myCollection');
                            assert.equal(firstCarChange.mapping, 'Car');
                            assert.equal(firstCarChange._id, car._id);
                            assert.equal(firstCarChange.field, 'owners');
                            assert.equal(firstCarChange.new.length, 1);
                            assert.equal(firstCarChange.newId.length, 1);
                            assert.include(firstCarChange.new, anotherPerson);
                            assert.include(firstCarChange.newId, anotherPerson._id);
                            assert.notOk(firstCarChange.old);
                            assert.notOk(firstCarChange.oldId);
                        });

                    });

                    describe('backwards', function () {
                        it('should set forward', function () {
                            person.cars = [car];
                            assert.include(person.cars, car);
                            assert.include(personProxy._id, car._id);
                            assert.include(personProxy.related, car);
                        });

                        it('should set reverse', function () {
                            person.cars = [car];
                            assert.include(carProxy._id, person._id);
                        });

                        it('generates correct changes', function () {
                            person.cars = [car];
                            var carChanges = changes.changesForIdentifier(car._id);
                            assert.equal(carChanges.length, 2);
                            var personChanges = changes.changesForIdentifier(person._id);
                            assert.equal(personChanges.length, 1);
                            var anotherPersonChanges = changes.changesForIdentifier(anotherPerson._id);
                            assert.equal(anotherPersonChanges.length, 1);
                            var personChange = personChanges[0];
                            var firstCarChange = carChanges[0];
                            var secondCarChange = carChanges[1];
                            var firstAnotherPersonChange = anotherPersonChanges[0];
                            assert.equal(personChange.type, ChangeType.Set);
                            assert.equal(personChange.collection, 'myCollection');
                            assert.equal(personChange.mapping, 'Person');
                            assert.equal(personChange._id, person._id);
                            assert.equal(personChange.field, 'cars');
                            assert.notOk(personChange.old);
                            assert.equal(personChange.new.length, 1);
                            assert.equal(personChange.newId.length, 1);
                            assert.include(personChange.newId, car._id);
                            assert.include(personChange.new, car);
                            assert.equal(firstAnotherPersonChange.type, ChangeType.Splice);
                            assert.equal(firstAnotherPersonChange.collection, 'myCollection');
                            assert.equal(firstAnotherPersonChange.mapping, 'Person');
                            assert.equal(firstAnotherPersonChange._id, anotherPerson._id);
                            assert.equal(firstAnotherPersonChange.field, 'cars');
                            assert.equal(firstAnotherPersonChange.index, 0);
                            assert.equal(firstAnotherPersonChange.added.length, 1);
                            assert.equal(firstAnotherPersonChange.addedId.length, 1);
                            assert.include(firstAnotherPersonChange.addedId, car._id);
                            assert.include(firstAnotherPersonChange.added, car);
                            assert.equal(firstAnotherPersonChange.removed.length, 0);
                            assert.equal(firstAnotherPersonChange.removedId.length, 0);
                            assert.equal(secondCarChange.type, ChangeType.Splice);
                            assert.equal(secondCarChange.collection, 'myCollection');
                            assert.equal(secondCarChange.mapping, 'Car');
                            assert.equal(secondCarChange._id, car._id);
                            assert.equal(secondCarChange.field, 'owners');
                            assert.equal(secondCarChange.index, 1);
                            assert.include(secondCarChange.addedId, person._id);
                            assert.include(secondCarChange.added, person);
                            assert.equal(firstCarChange.type, ChangeType.Set);
                            assert.equal(firstCarChange.collection, 'myCollection');
                            assert.equal(firstCarChange.mapping, 'Car');
                            assert.equal(firstCarChange._id, car._id);
                            assert.equal(firstCarChange.field, 'owners');
                            assert.include(firstCarChange.new, anotherPerson);
                            assert.include(firstCarChange.newId, anotherPerson._id);
                            assert.notOk(firstCarChange.old);
                            assert.notOk(firstCarChange.oldId);
                        });


                    });

                });



            });
        })


    });
});

