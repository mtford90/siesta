var s = require('../index')
    , assert = require('chai').assert;

describe('new object proxy', function () {

    var NewObjectProxy = require('../src/proxy').NewObjectProxy;
    var OneToOneProxy = require('../src/proxy').OneToOneProxy;
    var ForeignKeyProxy = require('../src/proxy').ForeignKeyProxy;
    var Mapping = require('../src/mapping').Mapping;
    var RestObject = require('../src/object').RestObject;
    var Fault = require('../src/proxy').Fault;
    var RestError = require('../src/error').RestError;
    var cache = require('../src/cache');

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
                car = new RestObject(carMapping);
                person = new RestObject(personMapping);
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

                        it('is not faulted, as no relationship set', function () {
                            assert.notOk(car.owner.isFault);
                        });
                    });

                    describe('relationship, faulted', function () {
                        beforeEach(function () {
                            proxy._id = 'xyz';
                        });

                        it('is a fault object', function () {
                            assert.instanceOf(car.owner, Fault);
                        });

                        it('is faulted, as relationship set', function () {
                            assert.ok(car.owner.isFault);
                        });
                    });

                    describe('relationship, faulted', function () {
                        beforeEach(function () {
                            proxy._id = 'xyz';
                            proxy.related = new RestObject(personMapping);
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

                        it('is not faulted, as no relationship set', function () {
                            assert.notOk(person.cars.isFault);
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
                            proxy.related = [new RestObject(carMapping)];
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
                car = new RestObject(carMapping);
                person = new RestObject(personMapping);
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
                car = new RestObject(carMapping);
                car._id = 'xyz';
                carProxy.install(car);
                person = new RestObject(personMapping);
                person._id = '123';
                personProxy.install(person);
                cache.insert(person);
                cache.insert(car);
            });

            describe('get', function () {
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
                car = new RestObject(carMapping);
                car._id = 'xyz';
                carProxy.install(car);
                person = new RestObject(personMapping);
                person._id = '123';
                personProxy.install(person);
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
                        assert.equal(person.cars, car);
                        assert.equal(personProxy._id, car._id);
                        assert.equal(personProxy.related, car);
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
                });


            });

            describe('pre-existing', function () {

                var anotherPerson, anotherPersonProxy;

                beforeEach(function () {
                    anotherPerson = new RestObject(personMapping);
                    anotherPerson._id = 'abc';
                    anotherPersonProxy = new OneToOneProxy({
                        reverseMapping: personMapping,
                        forwardMapping: carMapping,
                        reverseName: 'cars',
                        forwardName: 'owner'
                    });
                    anotherPersonProxy.install(anotherPerson);
                    cache.insert(anotherPerson);
                    cache.insert(person);
                    cache.insert(car);
                });

                function testPrexisting() {
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
                            assert.notOk(anotherPersonProxy._id);
                            assert.notOk(anotherPersonProxy.related);
                        })
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
                        })
                    });
                }

                describe('no fault', function () {
                    beforeEach(function () {
                        car.owner = anotherPerson;
                    });
                    testPrexisting();
                });

                describe('fault', function () {
                    beforeEach(function () {
                        carProxy._id = anotherPerson._id;
                        anotherPersonProxy._id = car._id;
                    });
                    testPrexisting();
                });

                describe('forward fault only', function () {
                    beforeEach(function () {
                        carProxy._id = anotherPerson._id;
                        anotherPersonProxy._id = car._id;
                        anotherPersonProxy.related = car;
                    });
                    testPrexisting();
                });

                describe('reverse fault only', function () {
                    beforeEach(function () {
                        carProxy._id = anotherPerson._id;
                        carProxy.related = anotherPerson;
                        anotherPersonProxy._id = car._id;
                    });
                    testPrexisting();
                });

            });
        })


    });


    describe.only('foreign key', function () {
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
                car = new RestObject(carMapping);
                car._id = 'xyz';
                carProxy.install(car);
                person = new RestObject(personMapping);
                person._id = '123';
                personProxy.install(person);
                cache.insert(person);
                cache.insert(car);
            });

            describe('get', function () {
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
                car = new RestObject(carMapping);
                car._id = 'xyz';
                carProxy.install(car);
                person = new RestObject(personMapping);
                person._id = '123';
                personProxy.install(person);
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
                    anotherPerson = new RestObject(personMapping);
                    anotherPerson._id = 'abc';
                    anotherPersonProxy = new ForeignKeyProxy({
                        reverseMapping: personMapping,
                        forwardMapping: carMapping,
                        reverseName: 'cars',
                        forwardName: 'owner'
                    });
                    anotherPersonProxy.install(anotherPerson);
                    cache.insert(anotherPerson);
                    cache.insert(person);
                    cache.insert(car);
                });

                function testPrexisting() {
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
                        })
                    });
                }

                describe('no fault', function () {
                    beforeEach(function () {
                        car.owner = anotherPerson;
                    });
                    testPrexisting();
                });

                describe('fault', function () {
                    beforeEach(function () {
                        carProxy._id = anotherPerson._id;
                        anotherPersonProxy._id = [car._id];
                    });
                    testPrexisting();
                });

                describe('forward fault only', function () {
                    beforeEach(function () {
                        carProxy._id = anotherPerson._id;
                        anotherPersonProxy._id = [car._id];
                        anotherPersonProxy.related = [car];
                    });
                    testPrexisting();
                });

                describe('reverse fault only', function () {
                    beforeEach(function () {
                        carProxy._id = anotherPerson._id;
                        carProxy.related = anotherPerson;
                        anotherPersonProxy._id = [car._id];
                    });
                    testPrexisting();
                });

            });

        })


    });


});

