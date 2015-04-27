var assert = require('chai').assert,
  internal = siesta._internal,
  ModelInstance = internal.ModelInstance,
  cache = internal.cache,
  OneToOneProxy = internal.OneToOneProxy;

describe('one to one relationship', function() {

  var app = siesta.createApp('one-to-one');

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
      carProxy = new OneToOneProxy({
        reverseModel: Person,
        forwardModel: Car,
        reverseName: 'cars',
        forwardName: 'owner',
        isReverse: false
      });
      personProxy = new OneToOneProxy({
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

    it('forward', function(done) {
      carProxy.related = person;
      carProxy.get(function(err, obj) {
        if (err) done(err);
        assert.equal(person, obj);
        done();
      });
    });

    it('reverse', function(done) {
      personProxy.related = car;
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
        reverseModel: Person,
        forwardModel: Car,
        reverseName: 'cars',
        forwardName: 'owner',
        isReverse: false
      });
      personProxy = new OneToOneProxy({
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
          assert.equal(person.cars, car);
          assert.equal(personProxy.related, car);
        });
      });

      describe('backwards', function() {
        it('should set forward', function() {
          person.cars = car;
          assert.equal(person.cars, car);
          assert.equal(personProxy.related, car);

        });

        it('should set reverse', function() {
          person.cars = car;
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
        anotherPersonProxy = new OneToOneProxy({
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
            assert.equal(person.cars, car);
            assert.equal(personProxy.related, car);
          });

          it('should clear the old', function() {
            car.owner = person;
            assert.notOk(anotherPersonProxy.localId);
            assert.notOk(anotherPersonProxy.related);
          });
        });
        describe('backwards', function() {
          it('should set forward', function() {
            person.cars = car;
            assert.equal(person.cars, car);
            assert.equal(personProxy.related, car);

          });

          it('should set reverse', function() {
            person.cars = car;
            assert.equal(car.owner, person);
            assert.equal(carProxy.related, person);
          });

          it('should clear the old', function() {
            person.cars = car;
            assert.notOk(anotherPersonProxy.localId);
            assert.notOk(anotherPersonProxy.related);
          });

        });
      });


    });
  });

  describe('removal', function() {
    beforeEach(function() {
      carProxy = new OneToOneProxy({
        reverseModel: Person,
        forwardModel: Car,
        reverseName: 'car',
        forwardName: 'owner',
        isReverse: false
      });
      personProxy = new OneToOneProxy({
        reverseModel: Person,
        forwardModel: Car,
        reverseName: 'car',
        forwardName: 'owner',
        isReverse: true
      });
      car = instance(Car);
      car.localId = 'car';
      carProxy.install(car);
      person = instance(Person);
      person.localId = 'person';
      personProxy.install(person);
      app.cache.insert(car);
      app.cache.insert(person);
    });

    it('removal', function(done) {
      car.owner = person;
      person.remove().then(function() {
        assert.notOk(car.owner);
        done();
      }).catch(done);
    });

    it('reverse removal', function(done) {
      person.car = car;
      car.remove().then(function() {
        assert.notOk(person.car);
        done();
      }).catch(done);
    });

  });


});
