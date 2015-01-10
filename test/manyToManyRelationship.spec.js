var s = require('../core/index'),
    assert = require('chai').assert;

describe('relationship proxy', function () {

    before(function () {
        s.ext.storageEnabled = false;
    });

    var RelationshipProxy = require('../core/RelationshipProxy'),
        OneToOneProxy = require('../core/OneToOneProxy'),
        OneToManyProxy = require('../core/OneToManyProxy'),
        ManyToManyProxy = require('../core/manyToManyProxy'),
        SiestaModel = require('../core/modelInstance'),
        cache = require('../core/cache');

    var MyCollection, Car, Person;
    var carProxy, personProxy;
    var car, person;


    beforeEach(function (done) {
        s.reset(function () {
            MyCollection = s.collection('MyCollection');
            Car = MyCollection.model('Car', {
                id: 'id',
                attributes: ['colour', 'name']
            });
            Person = MyCollection.model('Person', {
                id: 'id',
                attributes: ['name', 'age']
            });
            done();
        });
    });


    describe('get', function () {
        beforeEach(function () {
            carProxy = new ManyToManyProxy({
                reverseModel: Person,
                forwardModel: Car,
                reverseName: 'cars',
                forwardName: 'owners',
                isReverse: false
            });
            personProxy = new ManyToManyProxy({
                reverseModel: Person,
                forwardModel: Car,
                reverseName: 'cars',
                forwardName: 'owners',
                isReverse: true
            });
            car = new SiestaModel(Car);
            car._id = 'car';
            carProxy.install(car);
            person = new SiestaModel(Person);
            person._id = 'person';
            personProxy.install(person);
            cache.insert(person);
            cache.insert(car);
        });


        it('forward', function (done) {
            carProxy.related = [person];
            carProxy.get(function (err, people) {
                if (err) done(err);
                assert.include(people, person);
                assert.include(carProxy.related, person);
                done();
            });
        });

        it('reverse', function (done) {
            personProxy.related = [car];
            personProxy.get(function (err, cars) {
                if (err) done(err);
                assert.include(cars, car);
                assert.include(personProxy.related, car);
                done();
            });
        });
    });

    describe('set', function () {
        var carProxy, personProxy;
        var car, person;
        beforeEach(function () {
            carProxy = new ManyToManyProxy({
                reverseModel: Person,
                forwardModel: Car,
                reverseName: 'cars',
                forwardName: 'owners',
                isReverse: false
            });
            personProxy = new ManyToManyProxy({
                reverseModel: Person,
                forwardModel: Car,
                reverseName: 'cars',
                forwardName: 'owners',
                isReverse: true
            });
            car = new SiestaModel(Car);
            car._id = 'car';
            carProxy.install(car);
            person = new SiestaModel(Person);
            person._id = 'person';
            personProxy.install(person);
        });

        describe('none pre-existing', function () {

            describe('forward', function () {
                it('should set forward', function () {
                    car.owners = [person];
                    assert.include(car.owners, person);
                    assert.include(carProxy.related, person);
                });

                it('should set reverse', function () {
                    car.owners = [person];
                    assert.include(person.cars, car);
                    assert.include(personProxy.related, car);
                });
            });

            describe('backwards', function () {
                it('should set forward', function () {
                    person.cars = [car];
                    assert.include(person.cars, car);
                    assert.include(personProxy.related, car);

                });

                it('should set reverse', function () {
                    person.cars = [car];
                    assert.include(car.owners, person);
                    assert.include(carProxy.related, person);
                });
            });
        });


        describe('pre-existing', function () {

            var anotherPerson, anotherPersonProxy;

            beforeEach(function () {
                anotherPerson = new SiestaModel(Person);
                anotherPerson._id = 'anotherPerson';
                anotherPersonProxy = new ManyToManyProxy({
                    reverseModel: Person,
                    forwardModel: Car,
                    reverseName: 'cars',
                    forwardName: 'owners',
                    isReverse: true
                });
                anotherPersonProxy.install(anotherPerson);
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
                        assert.include(carProxy.related, person);
                    });

                    it('should set reverse', function () {
                        car.owners = [person];
                        assert.include(person.cars, car);
                        assert.include(personProxy.related, car);
                    });

                    it('should clear the old', function () {
                        car.owners = [person];
                        assert.equal(anotherPersonProxy.related.length, 0);
                    });

                });

                describe('backwards', function () {
                    it('should set forward', function () {
                        person.cars = [car];
                        assert.include(person.cars, car);
                        assert.include(personProxy.related, car);
                    });

                    it('should set reverse', function () {
                        person.cars = [car];
                        assert.include(car.owners, person);
                        assert.include(carProxy.related, person);
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
                        assert.include(carProxy.related, person);
                    });

                    it('should set reverse', function () {
                        car.owners = [person];
                        assert.include(person.cars, car);
                        assert.include(personProxy.related, car);
                    });

                });

                describe('backwards', function () {
                    it('should set forward', function () {
                        person.cars = [car];
                        assert.include(person.cars, car);
                        assert.include(personProxy.related, car);
                    });

                    it('should set reverse', function () {
                        person.cars = [car];
                    });


                });

            });


        });
    });

    describe('removal', function () {
        beforeEach(function () {
            carProxy = new ManyToManyProxy({
                reverseModel: Person,
                forwardModel: Car,
                reverseName: 'cars',
                forwardName: 'owners',
                isReverse: false
            });
            personProxy = new ManyToManyProxy({
                reverseModel: Person,
                forwardModel: Car,
                reverseName: 'cars',
                forwardName: 'owners',
                isReverse: true
            });
            car = new SiestaModel(Car);
            car._id = 'car';
            carProxy.install(car);
            person = new SiestaModel(Person);
            person._id = 'person';
            personProxy.install(person);
            cache.insert(person);
            cache.insert(car);
        });

        it('removal', function (done) {
            car.owners = [person];
            person.remove().then(function () {
                assert.notOk(car.owners.length);
                done();
            }).catch(done);
        });

        it('reverse removal', function (done) {
            person.cars = [car];
            car.remove().then(function () {
                assert.notOk(person.cars.length);
                done();
            }).catch(done);
        });

    });


});