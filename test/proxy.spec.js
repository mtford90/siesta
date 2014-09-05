var s = require('../index')
    , assert = require('chai').assert;

describe.only('new object proxy', function () {

    var NewObjectProxy = require('../src/relationship').NewObjectProxy;
    var Mapping = require('../src/mapping').Mapping;
    var RestObject = require('../src/object').RestObject;
    var Fault = require('../src/relationship').Fault;
    var RestError = require('../src/error').RestError;

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


});