var assert = require('chai').assert,
  internal = siesta._internal,
  cache = internal.cache,
  ModelInstance = internal.ModelInstance,
  ManyToManyProxy = internal.ManyToManyProxy;

describe('many to many proxy', function() {

  var app = siesta.createApp('many-to-many');

  function instance(model) {
    var i = new ModelInstance(model);
    i._emitEvents = true;
    return i;
  }

  before(function() {
    app.storage = false;
  });
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
      car = instance(Car);
      car.localId = 'car';
      carProxy.install(car);
      person = instance(Person);
      person.localId = 'person';
      personProxy.install(person);
      app.cache.insert(person);
      app.cache.insert(car);
    });


    it('forward', function(done) {
      carProxy.related = [person];
      carProxy.get(function(err, people) {
        if (err) done(err);
        assert.include(people, person);
        assert.include(carProxy.related, person);
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

  describe('set', function() {
    var carProxy, personProxy;
    var car, person;
    beforeEach(function() {
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
          car.owners = [person];
          assert.include(car.owners, person);
          assert.include(carProxy.related, person);
        });

        it('should set reverse', function() {
          car.owners = [person];
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
          assert.include(car.owners, person);
          assert.include(carProxy.related, person);
        });
      });
    });


    describe('pre-existing', function() {

      var anotherPerson, anotherPersonProxy;

      beforeEach(function() {
        anotherPerson = instance(Person);
        anotherPerson.localId = 'anotherPerson';
        anotherPersonProxy = new ManyToManyProxy({
          reverseModel: Person,
          forwardModel: Car,
          reverseName: 'cars',
          forwardName: 'owners',
          isReverse: true
        });
        anotherPersonProxy.install(anotherPerson);
        app.cache.insert(anotherPerson);
        app.cache.insert(person);
        app.cache.insert(car);
      });

      describe('no fault', function() {
        beforeEach(function() {
          car.owners = [anotherPerson];
        });

        describe('forward', function() {
          it('should set forward', function() {
            car.owners = [person];
            assert.include(car.owners, person);
            assert.include(carProxy.related, person);
          });

          it('should set reverse', function() {
            car.owners = [person];
            assert.include(person.cars, car);
            assert.include(personProxy.related, car);
          });

          it('should clear the old', function() {
            car.owners = [person];
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
            assert.include(car.owners, person);
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
            assert.include(carProxy.related, person);
          });

          it('should set reverse', function() {
            car.owners = [person];
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
          });
        });
      });
    });
  });

  describe('removal', function() {
    beforeEach(function(done) {
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
      car = instance(Car);
      car.localId = 'car';
      carProxy.install(car);
      person = instance(Person);
      person.localId = 'person';
      personProxy.install(person);
      app.cache.insert(person);
      app.cache.insert(car);
      done();
    });

    it('removal', function(done) {
      car.owners = [person];
      person.remove().then(function() {
        assert.notOk(car.owners.length);
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
