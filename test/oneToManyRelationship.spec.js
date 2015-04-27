var assert = require('chai').assert,
  internal = siesta._internal,
  ModelInstance = internal.ModelInstance,
  cache = internal.cache,
  OneToManyProxy = internal.OneToManyProxy;

describe('one to many relationship', function() {

  var app = siesta.createApp('one-to-many');

  before(function() {
    app.storageEnabled = false;
  });

  function instance(model) {
    var i = new ModelInstance(model);
    i._emitEvents = true;
    return i;
  }

  var MyCollection, Car, Person;
  var carProxy, personProxy;
  var car, person;


  beforeEach(function(done) {
    app.reset(function() {
      MyCollection = app.collection('MyCollection');
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

  describe('get', function() {
    beforeEach(function() {
      carProxy = new OneToManyProxy({
        reverseModel: Person,
        forwardModel: Car,
        reverseName: 'cars',
        forwardName: 'owner',
        isReverse: false
      });
      personProxy = new OneToManyProxy({
        reverseModel: Person,
        forwardModel: Car,
        reverseName: 'cars',
        forwardName: 'owner',
        isReverse: true
      });
      car = instance(Car);
      car.localId = 'car';
      carProxy.install(car);
      person = instance(Person);
      person.localId = 'person';
      personProxy.install(person);
      app.cache.insert(person);
      app.cache.insert(car);
    });

    describe('get', function() {
      it('forward', function(done) {
        carProxy.related = person;
        carProxy.related = person;
        carProxy.get(function(err, obj) {
          if (err) done(err);
          assert.equal(person, obj);
          done();
        });
      });

      it('reverse', function(done) {
        personProxy.related = [car];
        personProxy.get(function(err, cars) {
          if (err) done(err);
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
      carProxy = new OneToManyProxy({
        reverseModel: Person,
        forwardModel: Car,
        reverseName: 'cars',
        forwardName: 'owner',
        isReverse: false
      });
      personProxy = new OneToManyProxy({
        reverseModel: Person,
        forwardModel: Car,
        reverseName: 'cars',
        forwardName: 'owner',
        isReverse: true
      });
      car = instance(Car);
      car.localId = 'car';
      carProxy.install(car);
      person = instance(Person);
      person.localId = 'person';
      personProxy.install(person);
    });
    describe('none pre-existing', function() {

      describe('forward', function() {
        it('should set forward', function() {
          car.owner = person;
          assert.equal(car.owner, person);
          assert.equal(carProxy.related, person);
        });

        it('should set reverse', function() {
          car.owner = person;
          assert.include(person.cars, car);
          assert.include(personProxy.related, car);
        });

        it('multiple', function() {
          car.owner = person;
          var anotherCar = instance(Car);
          anotherCar.localId = 'anotherCar';
          var anotherCarProxy = new OneToManyProxy({
            reverseModel: Person,
            forwardModel: Car,
            reverseName: 'cars',
            forwardName: 'owner',
            isReverse: false
          });
          anotherCarProxy.install(anotherCar);
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
          assert.include(personProxy.related, car);

        });

        it('should set reverse', function() {
          person.cars = [car];
          assert.equal(car.owner, person);
          assert.equal(carProxy.related, person);
        });
      });
    });
    describe('pre-existing', function() {

      var anotherPerson, anotherPersonProxy;

      beforeEach(function() {
        anotherPerson = instance(Person);
        anotherPerson.localId = 'anotherPerson';
        anotherPersonProxy = new OneToManyProxy({
          reverseModel: Person,
          forwardModel: Car,
          reverseName: 'cars',
          forwardName: 'owner',
          isReverse: true
        });
        anotherPersonProxy.install(anotherPerson);
        app.cache.insert(anotherPerson);
        app.cache.insert(person);
        app.cache.insert(car);
      });

      describe('no fault', function() {
        beforeEach(function() {
          car.owner = anotherPerson;
        });
        describe('forward', function() {
          it('should set forward', function() {
            car.owner = person;
            assert.equal(car.owner, person);
            assert.equal(carProxy.related, person);
          });

          it('should set reverse', function() {
            car.owner = person;
            assert.include(person.cars, car);
            assert.include(personProxy.related, car);
          });

          it('should clear the old', function() {
            car.owner = person;
            assert.equal(anotherPersonProxy.related.length, 0);
          });

        });
        describe('backwards', function() {
          it('should set forward', function() {
            person.cars = [car];
            assert.include(person.cars, car);
            assert.include(personProxy.related, car);
          });

          it('should set reverse', function() {
            person.cars = [car];
            assert.equal(car.owner, person);
            assert.equal(carProxy.related, person);
          });

          it('should clear the old', function() {
            person.cars = [car];
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
            assert.equal(carProxy.related, person);
          });

          it('should set reverse', function() {
            car.owner = person;
            assert.include(person.cars, car);
            assert.include(personProxy.related, car);
          });

        });
        describe('backwards', function() {
          it('should set forward', function() {
            person.cars = [car];
            assert.include(person.cars, car);
            assert.include(personProxy.related, car);
          });

          it('should set reverse', function() {
            person.cars = [car];
            assert.equal(car.owner, person);
            assert.equal(carProxy.related, person);
          });

        });
      });


    });
  });

  describe('removal', function() {
    beforeEach(function() {
      carProxy = new OneToManyProxy({
        reverseModel: Person,
        forwardModel: Car,
        reverseName: 'cars',
        forwardName: 'owner',
        isReverse: false
      });
      personProxy = new OneToManyProxy({
        reverseModel: Person,
        forwardModel: Car,
        reverseName: 'cars',
        forwardName: 'owner',
        isReverse: true
      });
      car = instance(Car);
      car.localId = 'car';
      carProxy.install(car);
      person = instance(Person);
      person.localId = 'person';
      personProxy.install(person);
      app.cache.insert(person);
      app.cache.insert(car);
    });

    it('removal', function(done) {
      car.owner = person;
      person.remove().then(function() {
        assert.notOk(car.owner);
        done();
      }).catch(done);
    });

    it('reverse removal', function(done) {
      person.cars = [car];
      car.remove().then(function() {
        assert.notOk(person.cars.length);
        done();
      }).catch(done);
    });

  });


});
