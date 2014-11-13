var s = require('../index'),
    assert = require('chai').assert;

describe('new object proxy', function() {

    var RelationshipProxy = require('../src/proxy').RelationshipProxy;
    var OneToOneProxy = require('../src/oneToOneProxy');
    var OneToManyProxy = require('../src/oneToManyProxy');
    var ManyToManyProxy = require('../src/manyToManyProxy');
    var SiestaModel = require('../src/siestaModel').SiestaModel;
    var Fault = require('../src/proxy').Fault;
    var InternalSiestaError = require('../src/error').InternalSiestaError;
    var Collection = require('../src/collection').Collection;
    var cache = require('../src/cache');
    var ChangeType = require('../src/changes').ChangeType;

    var carMapping, personMapping;

    var collection;

    beforeEach(function(done) {
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

    describe('generic', function() {
        describe('installation', function() {
            var car, person, relationship, proxy;

            beforeEach(function() {
                proxy = new RelationshipProxy({
                    reverseMapping: personMapping,
                    forwardMapping: carMapping,
                    reverseName: 'cars',
                    forwardName: 'owner',
                    isForward: true
                });
                car = new SiestaModel(carMapping);
                person = new SiestaModel(personMapping);
            });

            it('throws an error if try to install twice', function() {
                proxy.install(car);
                assert.throws(function() {
                    proxy.install(car);
                }, InternalSiestaError);
            });

            describe('forward installation', function() {
                beforeEach(function() {
                    proxy = new RelationshipProxy({
                        reverseMapping: personMapping,
                        forwardMapping: carMapping,
                        reverseName: 'cars',
                        forwardName: 'owner',
                        isForward: true
                    });
                    proxy.install(car);
                });



                describe('faults', function() {
                    it('is forward', function() {
                        assert.ok(proxy.isForward);
                    });

                    it('is not reverse', function() {
                        assert.notOk(proxy.isReverse);
                    });

                    describe('no relationship', function() {
                        it('is a fault object', function() {
                            assert.instanceOf(car.owner, Fault);
                        });

                        it('is faulted, as no relationship set', function() {
                            assert.ok(car.owner.isFault);
                        });
                    });

                    describe('relationship, faulted', function() {
                        beforeEach(function() {
                            proxy._id = 'xyz';
                        });

                        it('is a fault object', function() {
                            assert.instanceOf(car.owner, Fault);
                        });

                        it('is faulted, as _id exists, but no related object', function() {
                            assert.ok(car.owner.isFault);
                        });
                    });

                    describe('relationship, faulted', function() {
                        beforeEach(function() {
                            proxy._id = 'xyz';
                            proxy.related = new SiestaModel(personMapping);
                            proxy.related._id = 'xyz';
                        });

                        it('is a fault object', function() {
                            assert.equal(car.owner, proxy.related);
                        });

                        it('is not faulted, as relationship set and related assigned', function() {
                            assert.notOk(car.owner.isFault);
                        });
                    })
                });

            });

            describe('reverse installation', function() {
                beforeEach(function() {
                    proxy = new RelationshipProxy({
                        reverseMapping: personMapping,
                        forwardMapping: carMapping,
                        reverseName: 'cars',
                        forwardName: 'owner',
                        isForward: false
                    });
                    proxy.install(person);

                });

                describe('faults', function() {
                    it('is reerse', function() {
                        assert.ok(proxy.isReverse);
                    });

                    it('is not forward', function() {
                        assert.notOk(proxy.isForward);
                    });

                    describe('no relationship', function() {
                        it('is a fault object', function() {
                            assert.instanceOf(person.cars, Fault);
                        });

                        it('is faulted, as no relationship set', function() {
                            assert.ok(person.cars.isFault);
                        });
                    });

                    describe('relationship, faulted', function() {
                        beforeEach(function() {
                            proxy._id = ['xyz'];
                        });

                        it('is a fault object', function() {
                            assert.instanceOf(person.cars, Fault);
                        });

                        it('is faulted, as relationship set', function() {
                            assert.ok(person.cars.isFault);
                        });
                    });

                    describe('relationship, faulted', function() {
                        beforeEach(function() {
                            proxy._id = 'xyz';
                            proxy.related = [new SiestaModel(carMapping)];
                            proxy.related[0]._id = 'xyz';
                        });

                        it('is a fault object', function() {
                            assert.equal(person.cars[0], proxy.related[0]);
                        });

                        it('is not faulted, as relationship set and related assigned', function() {
                            assert.notOk(person.cars.isFault);
                        });
                    })
                });
            });
        });

        describe('subclass', function() {
            var car, person, proxy;

            beforeEach(function() {
                proxy = new RelationshipProxy({
                    reverseMapping: personMapping,
                    forwardMapping: carMapping,
                    reverseName: 'cars',
                    forwardName: 'owner',
                    isForward: true

                });
                car = new SiestaModel(carMapping);
                person = new SiestaModel(personMapping);
                proxy.install(car);
            });

            it('set should fail if not subclasses', function() {
                assert.throws(function() {
                    car.owner = person;
                }, InternalSiestaError);
                assert.throws(function() {
                    car.owner.set(person);
                }, InternalSiestaError);
            });

            it('get should fail if not subclasses', function() {
                assert.throws(function() {
                    car.owner.get(function() {

                    })
                }, InternalSiestaError);
            })
        })

    });

    describe('one-to-one', function() {
        var carProxy, personProxy;
        var car, person;

        describe('get', function() {
            beforeEach(function() {
                carProxy = new OneToOneProxy({
                    reverseMapping: personMapping,
                    forwardMapping: carMapping,
                    reverseName: 'cars',
                    forwardName: 'owner',
                    isForward: true
                });
                personProxy = new OneToOneProxy({
                    reverseMapping: personMapping,
                    forwardMapping: carMapping,
                    reverseName: 'cars',
                    forwardName: 'owner',
                    isForward: false
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

            it('forward', function(done) {
                carProxy._id = person._id;
                assert.ok(carProxy.isFault);
                carProxy.get(function(err, obj) {
                    if (err) done(err);
                    assert.equal(person, obj);
                    done();
                });
            });

            it('reverse', function(done) {
                personProxy._id = car._id;
                assert.ok(personProxy.isFault);
                personProxy.get(function(err, obj) {
                    if (err) done(err);
                    assert.equal(car, obj);
                    assert.equal(personProxy.related, car);
                    done();
                });
            });
        });

        describe('set', function() {
            var carProxy, personProxy;
            var car, person;
            beforeEach(function() {
                carProxy = new OneToOneProxy({
                    reverseMapping: personMapping,
                    forwardMapping: carMapping,
                    reverseName: 'cars',
                    forwardName: 'owner',
                    isForward: true
                });
                personProxy = new OneToOneProxy({
                    reverseMapping: personMapping,
                    forwardMapping: carMapping,
                    reverseName: 'cars',
                    forwardName: 'owner',
                    isForward: false
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

            describe('none pre-existing', function() {
                describe('forward', function() {
                    it('should set forward', function() {
                        car.owner = person;
                        assert.equal(car.owner, person);
                        assert.equal(carProxy._id, person._id);
                        assert.equal(carProxy.related, person);
                    });

                    it('should set reverse', function() {
                        car.owner = person;
                        assert.equal(person.cars, car);
                        assert.equal(personProxy._id, car._id);
                        assert.equal(personProxy.related, car);
                    });
                });

                describe('backwards', function() {
                    it('should set forward', function() {
                        person.cars = car;
                        assert.equal(person.cars, car);
                        assert.equal(personProxy._id, car._id);
                        assert.equal(personProxy.related, car);

                    });

                    it('should set reverse', function() {
                        person.cars = car;
                        assert.equal(car.owner, person);
                        assert.equal(carProxy._id, person._id);
                        assert.equal(carProxy.related, person);
                    });
                });


            });

            describe('pre-existing', function() {

                var anotherPerson, anotherPersonProxy;

                beforeEach(function() {
                    anotherPerson = new SiestaModel(personMapping);
                    anotherPerson._id = 'anotherPerson';
                    anotherPersonProxy = new OneToOneProxy({
                        reverseMapping: personMapping,
                        forwardMapping: carMapping,
                        reverseName: 'cars',
                        forwardName: 'owner',
                        isForward: false
                    });
                    anotherPersonProxy.install(anotherPerson);
                    anotherPersonProxy.isFault = false;
                    cache.insert(anotherPerson);
                    cache.insert(person);
                    cache.insert(car);
                });


                describe('no fault', function() {
                    beforeEach(function() {
                        car.owner = anotherPerson;
                    });
                    describe('forward', function() {
                        it('should set forward', function() {
                            car.owner = person;
                            assert.equal(car.owner, person);
                            assert.equal(carProxy._id, person._id);
                            assert.equal(carProxy.related, person);
                        });

                        it('should set reverse', function() {
                            car.owner = person;
                            assert.equal(person.cars, car);
                            assert.equal(personProxy._id, car._id);
                            assert.equal(personProxy.related, car);
                        });

                        it('should clear the old', function() {
                            car.owner = person;
                            assert.notOk(anotherPersonProxy.isFault);
                            assert.notOk(anotherPersonProxy._id);
                            assert.notOk(anotherPersonProxy.related);
                        });
                    });
                    describe('backwards', function() {
                        it('should set forward', function() {
                            person.cars = car;
                            assert.equal(person.cars, car);
                            assert.equal(personProxy._id, car._id);
                            assert.equal(personProxy.related, car);

                        });

                        it('should set reverse', function() {
                            person.cars = car;
                            assert.equal(car.owner, person);
                            assert.equal(carProxy._id, person._id);
                            assert.equal(carProxy.related, person);
                        });

                        it('should clear the old', function() {
                            person.cars = car;
                            assert.notOk(anotherPersonProxy._id);
                            assert.notOk(anotherPersonProxy.related);
                            assert.notOk(anotherPersonProxy.isFault);
                        });

                    });
                });

                describe('fault', function() {
                    beforeEach(function() {
                        car.owner = anotherPerson;
                        carProxy.related = undefined;
                        anotherPersonProxy.related = undefined;
                    });
                    describe('forward', function() {
                        it('should set forward', function() {
                            car.owner = person;
                            assert.equal(car.owner, person);
                            assert.equal(carProxy._id, person._id);
                            assert.equal(carProxy.related, person);
                        });

                        it('should set reverse', function() {
                            car.owner = person;
                            assert.equal(person.cars, car);
                            assert.equal(personProxy._id, car._id);
                            assert.equal(personProxy.related, car);
                        });

                    });
                    describe('backwards', function() {
                        it('should set forward', function() {
                            person.cars = car;
                            assert.equal(person.cars, car);
                            assert.equal(personProxy._id, car._id);
                            assert.equal(personProxy.related, car);

                        });

                        it('should set reverse', function() {
                            person.cars = car;
                            assert.equal(car.owner, person);
                            assert.equal(carProxy._id, person._id);
                            assert.equal(carProxy.related, person);
                        });

                    });
                });

            });
        })
    });

    describe('foreign key', function() {
        var carProxy, personProxy;
        var car, person;

        describe('get', function() {
            beforeEach(function() {
                carProxy = new OneToManyProxy({
                    reverseMapping: personMapping,
                    forwardMapping: carMapping,
                    reverseName: 'cars',
                    forwardName: 'owner',
                    isForward: true
                });
                personProxy = new OneToManyProxy({
                    reverseMapping: personMapping,
                    forwardMapping: carMapping,
                    reverseName: 'cars',
                    forwardName: 'owner',
                    isForward: false
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

            describe('get', function() {
                describe('no fault', function() {

                    beforeEach(function() {
                        carProxy.isFault = false;
                        personProxy.isFault = false;
                    });

                    it('forward', function(done) {
                        carProxy._id = person._id;
                        carProxy.related = person;
                        carProxy.get(function(err, obj) {
                            if (err) done(err);
                            assert.equal(person, obj);
                            done();
                        });
                    });

                    it('reverse', function(done) {
                        personProxy._id = [car._id];
                        personProxy.related = [car];
                        personProxy.get(function(err, cars) {
                            if (err) done(err);
                            assert.include(cars, car);
                            assert.include(personProxy.related, car);
                            done();
                        });
                    });
                });

                describe('fault', function() {
                    it('forward', function(done) {
                        carProxy._id = person._id;
                        carProxy.get(function(err, obj) {
                            if (err) done(err);
                            assert.equal(person, obj);
                            done();
                        });
                    });

                    it('reverse', function(done) {
                        personProxy._id = [car._id];
                        personProxy.get(function(err, cars) {
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

        describe('set', function() {
            var carProxy, personProxy;
            var car, person;
            beforeEach(function() {
                carProxy = new OneToManyProxy({
                    reverseMapping: personMapping,
                    forwardMapping: carMapping,
                    reverseName: 'cars',
                    forwardName: 'owner',
                    isForward: true
                });
                personProxy = new OneToManyProxy({
                    reverseMapping: personMapping,
                    forwardMapping: carMapping,
                    reverseName: 'cars',
                    forwardName: 'owner',
                    isForward: false
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
            describe('none pre-existing', function() {

                describe('forward', function() {
                    it('should set forward', function() {
                        car.owner = person;
                        assert.equal(car.owner, person);
                        assert.equal(carProxy._id, person._id);
                        assert.equal(carProxy.related, person);
                    });

                    it('should set reverse', function() {
                        car.owner = person;
                        assert.include(person.cars, car);
                        assert.include(personProxy._id, car._id);
                        assert.include(personProxy.related, car);
                    });

                    it('multiple', function() {
                        car.owner = person;
                        var anotherCar = new SiestaModel(carMapping);
                        anotherCar._id = 'anotherCar';
                        var anotherCarProxy = new OneToManyProxy({
                            reverseMapping: personMapping,
                            forwardMapping: carMapping,
                            reverseName: 'cars',
                            forwardName: 'owner',
                            isForward: true
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

                describe('backwards', function() {
                    it('should set forward', function() {
                        person.cars = [car];
                        assert.include(person.cars, car);
                        assert.include(personProxy._id, car._id);
                        assert.include(personProxy.related, car);

                    });

                    it('should set reverse', function() {
                        person.cars = [car];
                        assert.equal(car.owner, person);
                        assert.equal(carProxy._id, person._id);
                        assert.equal(carProxy.related, person);
                    });
                });
            });
            describe('pre-existing', function() {

                var anotherPerson, anotherPersonProxy;

                beforeEach(function() {
                    anotherPerson = new SiestaModel(personMapping);
                    anotherPerson._id = 'anotherPerson';
                    anotherPersonProxy = new OneToManyProxy({
                        reverseMapping: personMapping,
                        forwardMapping: carMapping,
                        reverseName: 'cars',
                        forwardName: 'owner',
                        isForward: false
                    });
                    anotherPersonProxy.install(anotherPerson);
                    anotherPersonProxy.isFault = false;
                    cache.insert(anotherPerson);
                    cache.insert(person);
                    cache.insert(car);
                });

                describe('no fault', function() {
                    beforeEach(function() {
                        car.owner = anotherPerson;
                    });
                    describe('forward', function() {
                        it('should set forward', function() {
                            car.owner = person;
                            assert.equal(car.owner, person);
                            assert.equal(carProxy._id, person._id);
                            assert.equal(carProxy.related, person);
                        });

                        it('should set reverse', function() {
                            car.owner = person;
                            assert.include(person.cars, car);
                            assert.include(personProxy._id, car._id);
                            assert.include(personProxy.related, car);
                        });

                        it('should clear the old', function() {
                            car.owner = person;
                            assert.equal(anotherPersonProxy._id.length, 0);
                            assert.equal(anotherPersonProxy.related.length, 0);
                        });

                    });
                    describe('backwards', function() {
                        it('should set forward', function() {
                            person.cars = [car];
                            assert.include(person.cars, car);
                            assert.include(personProxy._id, car._id);
                            assert.include(personProxy.related, car);
                        });

                        it('should set reverse', function() {
                            person.cars = [car];
                            assert.equal(car.owner, person);
                            assert.equal(carProxy._id, person._id);
                            assert.equal(carProxy.related, person);
                        });

                        it('should clear the old', function() {
                            person.cars = [car];
                            assert.equal(anotherPersonProxy._id.length, 0);
                            assert.equal(anotherPersonProxy.related.length, 0);
                        });

                    });
                });

                describe('fault', function() {
                    beforeEach(function() {
                        car.owner = anotherPerson;
                        carProxy.related = undefined;
                        anotherPersonProxy.related = undefined;
                    });
                    describe('forward', function() {
                        it('should set forward', function() {
                            car.owner = person;
                            assert.equal(car.owner, person);
                            assert.equal(carProxy._id, person._id);
                            assert.equal(carProxy.related, person);
                        });

                        it('should set reverse', function() {
                            car.owner = person;
                            assert.include(person.cars, car);
                            assert.include(personProxy._id, car._id);
                            assert.include(personProxy.related, car);
                        });

                    });
                    describe('backwards', function() {
                        it('should set forward', function() {
                            person.cars = [car];
                            assert.include(person.cars, car);
                            assert.include(personProxy._id, car._id);
                            assert.include(personProxy.related, car);
                        });

                        it('should set reverse', function() {
                            person.cars = [car];
                            assert.equal(car.owner, person);
                            assert.equal(carProxy._id, person._id);
                            assert.equal(carProxy.related, person);
                        });

                    });
                });


            });
        });



    });

    describe('many to many', function() {
        var carProxy, personProxy;
        var car, person;

        describe('get', function() {
            beforeEach(function() {
                carProxy = new ManyToManyProxy({
                    reverseMapping: personMapping,
                    forwardMapping: carMapping,
                    reverseName: 'cars',
                    forwardName: 'owners',
                    isForward: true
                });
                personProxy = new ManyToManyProxy({
                    reverseMapping: personMapping,
                    forwardMapping: carMapping,
                    reverseName: 'cars',
                    forwardName: 'owners',
                    isReverse: true
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

            describe('no fault', function() {

                beforeEach(function() {
                    carProxy.isFault = false;
                    personProxy.isFault = false;
                });

                it('forward', function(done) {
                    carProxy._id = [person._id];
                    carProxy.related = [person];
                    carProxy.get(function(err, people) {
                        if (err) done(err);
                        assert.include(people, person);
                        assert.include(carProxy.related, person);
                        done();
                    });
                });

                it('reverse', function(done) {
                    personProxy._id = [car._id];
                    personProxy.related = [car];
                    personProxy.get(function(err, cars) {
                        if (err) done(err);
                        assert.include(cars, car);
                        assert.include(personProxy.related, car);
                        done();
                    });
                });
            });

            describe('fault', function() {
                it('forward', function(done) {
                    carProxy._id = [person._id];
                    carProxy.get(function(err, people) {
                        if (err) done(err);
                        assert.include(people, person);
                        assert.include(carProxy.related, person);
                        done();
                    });
                });

                it('reverse', function(done) {
                    personProxy._id = [car._id];
                    personProxy.get(function(err, cars) {
                        if (err) done(err);
                        assert.equal(cars.length, 1);
                        assert.include(cars, car);
                        assert.include(personProxy.related, car);
                        done();
                    });
                });
            });

        });

        describe('set', function() {
            var carProxy, personProxy;
            var car, person;
            beforeEach(function() {
                carProxy = new ManyToManyProxy({
                    reverseMapping: personMapping,
                    forwardMapping: carMapping,
                    reverseName: 'cars',
                    forwardName: 'owners', 
                    isForward: true
                });
                personProxy = new ManyToManyProxy({
                    reverseMapping: personMapping,
                    forwardMapping: carMapping,
                    reverseName: 'cars',
                    forwardName: 'owners',
                    isForward: false
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

            describe('none pre-existing', function() {

                describe('forward', function() {
                    it('should set forward', function() {
                        car.owners = [person];
                        assert.include(car.owners, person);
                        assert.include(carProxy._id, person._id);
                        assert.include(carProxy.related, person);
                    });

                    it('should set reverse', function() {
                        car.owners = [person];
                        assert.include(person.cars, car);
                        assert.include(personProxy._id, car._id);
                        assert.include(personProxy.related, car);
                    });
                });

                describe('backwards', function() {
                    it('should set forward', function() {
                        person.cars = [car];
                        assert.include(person.cars, car);
                        assert.include(personProxy._id, car._id);
                        assert.include(personProxy.related, car);

                    });

                    it('should set reverse', function() {
                        person.cars = [car];
                        assert.include(car.owners, person);
                        assert.include(carProxy._id, person._id);
                        assert.include(carProxy.related, person);
                    });
                });
            });


            describe('pre-existing', function() {

                var anotherPerson, anotherPersonProxy;

                beforeEach(function() {
                    anotherPerson = new SiestaModel(personMapping);
                    anotherPerson._id = 'anotherPerson';
                    anotherPersonProxy = new ManyToManyProxy({
                        reverseMapping: personMapping,
                        forwardMapping: carMapping,
                        reverseName: 'cars',
                        forwardName: 'owners',
                        isForward: false
                    });
                    anotherPersonProxy.install(anotherPerson);
                    anotherPersonProxy.isFault = false;
                    cache.insert(anotherPerson);
                    cache.insert(person);
                    cache.insert(car);
                });

                describe('no fault', function() {
                    beforeEach(function() {
                        car.owners = [anotherPerson];
                    });

                    describe('forward', function() {
                        it('should set forward', function() {
                            car.owners = [person];
                            assert.include(car.owners, person);
                            assert.include(carProxy._id, person._id);
                            assert.include(carProxy.related, person);
                        });

                        it('should set reverse', function() {
                            car.owners = [person];
                            assert.include(person.cars, car);
                            assert.include(personProxy._id, car._id);
                            assert.include(personProxy.related, car);
                        });

                        it('should clear the old', function() {
                            car.owners = [person];
                            assert.equal(anotherPersonProxy._id.length, 0);
                            assert.equal(anotherPersonProxy.related.length, 0);
                        });

                    });

                    describe('backwards', function() {
                        it('should set forward', function() {
                            person.cars = [car];
                            assert.include(person.cars, car);
                            assert.include(personProxy._id, car._id);
                            assert.include(personProxy.related, car);
                        });

                        it('should set reverse', function() {
                            person.cars = [car];
                            assert.include(car.owners, person);
                            assert.include(carProxy._id, person._id);
                            assert.include(carProxy.related, person);
                        });
                    });
                });

                describe('fault', function() {
                    beforeEach(function() {
                        car.owners = [anotherPerson];
                        carProxy.related = undefined;
                        anotherPersonProxy.related = undefined;
                    });
                    describe('forward', function() {
                        it('should set forward', function() {
                            car.owners = [person];
                            assert.include(car.owners, person);
                            assert.include(carProxy._id, person._id);
                            assert.include(carProxy.related, person);
                        });

                        it('should set reverse', function() {
                            car.owners = [person];
                            assert.include(person.cars, car);
                            assert.include(personProxy._id, car._id);
                            assert.include(personProxy.related, car);
                        });

                    });

                    describe('backwards', function() {
                        it('should set forward', function() {
                            person.cars = [car];
                            assert.include(person.cars, car);
                            assert.include(personProxy._id, car._id);
                            assert.include(personProxy.related, car);
                        });

                        it('should set reverse', function() {
                            person.cars = [car];
                            assert.include(carProxy._id, person._id);
                        });


                    });

                });



            });
        })


    });
});