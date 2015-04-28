var assert = require('chai').assert,
  internal = siesta._internal,
  ModelInstance = internal.ModelInstance,
  cache = internal.cache,
  OneToManyProxy = internal.OneToManyProxy;

describe('remove models from object graph', function() {

  var app = siesta.createApp('remove');
  before(function() {
    app.storage = false;
  });

  describe('one to one', function() {
    var MyCollection, Car, Person;
    var car, person;

    beforeEach(function(done) {
      app.reset(function() {
        MyCollection = app.collection('MyCollection');
        Car = MyCollection.model('Car', {
          id: 'id',
          attributes: ['colour'],
          relationships: {
            owner: {
              model: 'Person',
              type: 'OneToOne',
              reverse: 'car'
            }
          }
        });
        Person = MyCollection.model('Person', {
          id: 'id',
          attributes: ['name']
        });
        Car.graph({
          id: 1,
          colour: 'red',
          owner: {
            id: 2,
            name: 'mike'
          }
        }).then(function(res) {
          car = res;
          person = res.owner;
          done();
        })
      });
    });

    it('removal', function(done) {
      person
        .remove()
        .then(function() {
          assert.notOk(car.owner);
          done();
        }).catch(done);
    });

    it('reverse removal', function(done) {
      car
        .remove()
        .then(function() {
          assert.notOk(person.car);
          done();
        }).catch(done);
    });
  });

  describe('one to many', function() {
    var MyCollection, Car, Person;
    var car, person;

    beforeEach(function(done) {
      app.reset(function() {
        MyCollection = app.collection('MyCollection');
        Car = MyCollection.model('Car', {
          id: 'id',
          attributes: ['colour'],
          relationships: {
            owner: {
              model: 'Person',
              type: 'OneToMany',
              reverse: 'cars'
            }
          }
        });
        Person = MyCollection.model('Person', {
          id: 'id',
          attributes: ['name']
        });
        Car.graph({
          id: 1,
          colour: 'red',
          owner: {
            id: 2,
            name: 'mike'
          }
        }).then(function(res) {
          car = res;
          person = res.owner;
          done();
        })
      });
    });

    it('removal', function(done) {
      person
        .remove()
        .then(function() {
          assert.notOk(car.owner);
          done();
        }).catch(done);
    });

    it('reverse removal', function(done) {
      car
        .remove()
        .then(function() {
          assert.notOk(person.cars.length);
          done();
        }).catch(done);
    });
  });

  describe('many to many', function() {
    var MyCollection, Car, Person;
    var car, person;

    beforeEach(function(done) {
      app.reset(function() {
        MyCollection = app.collection('MyCollection');
        Car = MyCollection.model('Car', {
          id: 'id',
          attributes: ['colour'],
          relationships: {
            owners: {
              model: 'Person',
              type: 'ManyToMany',
              reverse: 'cars'
            }
          }
        });
        Person = MyCollection.model('Person', {
          id: 'id',
          attributes: ['name']
        });
        Car.graph({
          id: 1,
          colour: 'red',
          owners: [{
            id: 2,
            name: 'mike'
          }]
        }).then(function(res) {
          car = res;
          person = res.owners[0];
          done();
        })
      });
    });

    it('removal', function(done) {
      person
        .remove()
        .then(function() {
          assert.notOk(car.owners.length);
          done();
        }).catch(done);
    });

    it('reverse removal', function(done) {
      car
        .remove()
        .then(function() {
          assert.notOk(person.cars.length);
          done();
        }).catch(done);
    });
  });
});
