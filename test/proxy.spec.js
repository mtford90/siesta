var s = require('../index')
    , assert = require('chai').assert;

describe('new object proxy', function () {

    var NewObjectProxy = require('../src/proxy').NewObjectProxy;
    var OneToOneProxy = require('../src/oneToOneProxy').OneToOneProxy;
    var ForeignKeyProxy = require('../src/proxy').ForeignKeyProxy;
    var Mapping = require('../src/mapping').Mapping;
    var SiestaModel = require('../src/object').SiestaModel;
    var Fault = require('../src/proxy').Fault;
    var RestError = require('../src/error').RestError;
    var Collection = require('../src/collection').Collection;
    var cache = require('../src/cache');
    var changes = require('../src/changes');

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
                    assert.equal(personChange.new, car._id);
                    assert.notOk(personChange.old);
                    assert.equal(carChange.collection, 'myCollection');
                    assert.equal(carChange.mapping, 'Car');
                    assert.equal(carChange._id, car._id);
                    assert.equal(carChange.field, 'owner');
                    assert.equal(carChange.new, person._id);
                    assert.notOk(carChange.old);
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

                function validateChanges() {
                    var carChanges = changes.changesForIdentifier(car._id);
                    assert.equal(carChanges.length, 2);
                    var personChanges = changes.changesForIdentifier(person._id);
                    assert.equal(personChanges.length, 1);
                    var anotherPersonChanges = changes.changesForIdentifier(anotherPerson._id);
                    dump(JSON.stringify(_.map(anotherPersonChanges, function (x) {return x._dump()})));
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
                    assert.equal(personChange.new, car._id);
                    assert.notOk(personChange.old);
                    assert.equal(firstAnotherPersonChange.collection, 'myCollection');
                    assert.equal(firstAnotherPersonChange.mapping, 'Person');
                    assert.equal(firstAnotherPersonChange._id, anotherPerson._id);
                    assert.equal(firstAnotherPersonChange.field, 'cars');
                    assert.equal(firstAnotherPersonChange.new, car._id);
                    assert.notOk(firstAnotherPersonChange.old);
                    assert.equal(secondCarChange.collection, 'myCollection');
                    assert.equal(secondCarChange.mapping, 'Car');
                    assert.equal(secondCarChange._id, car._id);
                    assert.equal(secondCarChange.field, 'owner');
                    assert.equal(secondCarChange.new, person._id);
                    assert.equal(secondCarChange.old, anotherPerson._id);
                    assert.equal(firstCarChange.collection, 'myCollection');
                    assert.equal(firstCarChange.mapping, 'Car');
                    assert.equal(firstCarChange._id, car._id);
                    assert.equal(firstCarChange.field, 'owner');
                    assert.equal(firstCarChange.new, anotherPerson._id);
                    assert.notOk(firstCarChange.old);
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
                            assert.instanceOf(anotherPerson.cars, Fault);
                            dump(anotherPersonProxy._id);
                            assert.notOk(anotherPersonProxy._id);
//                            assert.notOk(anotherPersonProxy.related);
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

                        it('should clear the old', function () {
                            person.cars = car;
                            assert.instanceOf(anotherPerson.cars, Fault);
                            assert.notOk(anotherPersonProxy._id);
                            assert.notOk(anotherPersonProxy.related);
                        });

                        it('should set changes', function () {
                            person.cars = car;
                            validateChanges();
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

            });
        })
    });

//
//    describe('foreign key', function () {
//        var carProxy, personProxy;
//        var car, person;
//
//        describe('get', function () {
//            beforeEach(function () {
//                carProxy = new OneToOneProxy({
//                    reverseMapping: personMapping,
//                    forwardMapping: carMapping,
//                    reverseName: 'cars',
//                    forwardName: 'owner'
//                });
//                personProxy = new OneToOneProxy({
//                    reverseMapping: personMapping,
//                    forwardMapping: carMapping,
//                    reverseName: 'cars',
//                    forwardName: 'owner'
//                });
//                car = new SiestaModel(carMapping);
//                car._id = 'car';
//                carProxy.install(car);
//                carProxy.isFault = false;
//                person = new SiestaModel(personMapping);
//                person._id = 'person';
//                personProxy.isFault = false;
//                personProxy.install(person);
//                cache.insert(person);
//                cache.insert(car);
//            });
//
//            describe('get', function () {
//                it('forward', function (done) {
//                    carProxy._id = person._id;
//                    assert.ok(carProxy.isFault);
//                    carProxy.get(function (err, obj) {
//                        if (err) done(err);
//                        assert.equal(person, obj);
//                        done();
//                    });
//                });
//
//                it('reverse', function (done) {
//                    personProxy._id = car._id;
//                    assert.ok(personProxy.isFault);
//                    personProxy.get(function (err, obj) {
//                        if (err) done(err);
//                        assert.equal(car, obj);
//                        assert.equal(personProxy.related, car);
//                        done();
//                    });
//                });
//            });
//
//
//        });
//
//        describe('set', function () {
//            var carProxy, personProxy;
//            var car, person;
//            beforeEach(function () {
//                carProxy = new ForeignKeyProxy({
//                    reverseMapping: personMapping,
//                    forwardMapping: carMapping,
//                    reverseName: 'cars',
//                    forwardName: 'owner'
//                });
//                personProxy = new ForeignKeyProxy({
//                    reverseMapping: personMapping,
//                    forwardMapping: carMapping,
//                    reverseName: 'cars',
//                    forwardName: 'owner'
//                });
//                car = new SiestaModel(carMapping);
//                car._id = 'car';
//                carProxy.install(car);
//                carProxy.isFault = false;
//                person = new SiestaModel(personMapping);
//                person._id = 'person';
//                personProxy.install(person);
//                personProxy.isFault = false;
//            });
//
//            describe('none pre-existing', function () {
//
//                describe('forward', function () {
//                    it('should set forward', function () {
//                        car.owner = person;
//                        assert.equal(car.owner, person);
//                        assert.equal(carProxy._id, person._id);
//                        assert.equal(carProxy.related, person);
//                    });
//
//                    it('should set reverse', function () {
//                        car.owner = person;
//                        assert.include(person.cars, car);
//                        assert.include(personProxy._id, car._id);
//                        assert.include(personProxy.related, car);
//                    });
//                });
//
//                describe('backwards', function () {
//                    it('should set forward', function () {
//                        person.cars = [car];
//                        assert.include(person.cars, car);
//                        assert.include(personProxy._id, car._id);
//                        assert.include(personProxy.related, car);
//
//                    });
//
//                    it('should set reverse', function () {
//                        person.cars = [car];
//                        assert.equal(car.owner, person);
//                        assert.equal(carProxy._id, person._id);
//                        assert.equal(carProxy.related, person);
//                    });
//                });
//
//
//            });
//
//
//            describe('pre-existing', function () {
//
//                var anotherPerson, anotherPersonProxy;
//
//                beforeEach(function () {
//                    anotherPerson = new SiestaModel(personMapping);
//                    anotherPerson._id = 'anotherPerson';
//                    anotherPersonProxy = new ForeignKeyProxy({
//                        reverseMapping: personMapping,
//                        forwardMapping: carMapping,
//                        reverseName: 'cars',
//                        forwardName: 'owner'
//                    });
//                    anotherPersonProxy.install(anotherPerson);
//                    cache.insert(anotherPerson);
//                    cache.insert(person);
//                    cache.insert(car);
//                });
//
//                function testPrexisting() {
//                    describe('forward', function () {
//                        it('should set forward', function () {
//                            car.owner = person;
//                            assert.equal(car.owner, person);
//                            assert.equal(carProxy._id, person._id);
//                            assert.equal(carProxy.related, person);
//                        });
//
//                        it('should set reverse', function () {
//                            car.owner = person;
//                            assert.include(person.cars, car);
//                            assert.include(personProxy._id, car._id);
//                            assert.include(personProxy.related, car);
//                        });
//
//                        it('should clear the old', function () {
//                            car.owner = person;
//                            assert.equal(anotherPersonProxy._id.length, 0);
//                            assert.equal(anotherPersonProxy.related.length, 0);
//                        });
//
//                    });
//                    describe('backwards', function () {
//                        it('should set forward', function () {
//                            person.cars = [car];
//                            assert.include(person.cars, car);
//                            assert.include(personProxy._id, car._id);
//                            assert.include(personProxy.related, car);
//
//                        });
//
//                        it('should set reverse', function () {
//                            person.cars = [car];
//                            assert.equal(car.owner, person);
//                            assert.equal(carProxy._id, person._id);
//                            assert.equal(carProxy.related, person);
//                        });
//
//                        it('should clear the old', function () {
//                            person.cars = [car];
//                            assert.equal(anotherPersonProxy._id.length, 0);
//                            assert.equal(anotherPersonProxy.related.length, 0);
//                        })
//                    });
//                }
//
//                describe('no fault', function () {
//                    beforeEach(function () {
//                        car.owner = anotherPerson;
//                    });
//                    testPrexisting();
//                });
//
//                describe('fault', function () {
//                    beforeEach(function () {
//                        carProxy._id = anotherPerson._id;
//                        anotherPersonProxy._id = [car._id];
//                    });
//                    testPrexisting();
//                });
//
//                describe('forward fault only', function () {
//                    beforeEach(function () {
//                        carProxy._id = anotherPerson._id;
//                        anotherPersonProxy._id = [car._id];
//                        anotherPersonProxy.related = [car];
//                        anotherPersonProxy._wrapArray(anotherPersonProxy.related);
//                    });
//                    testPrexisting();
//                });
//
//                describe('reverse fault only', function () {
//                    beforeEach(function () {
//                        carProxy._id = anotherPerson._id;
//                        carProxy.related = anotherPerson;
//                        anotherPersonProxy._id = [car._id];
//                    });
//                    testPrexisting();
//                });
//
//            });
//
//        })
//
//
//    });


});

