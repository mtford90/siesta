var assert = require('chai').assert,
  internal = siesta._internal,
  ModelInstance = internal.ModelInstance,
  cache = internal.cache,
  OneToManyProxy = internal.OneToManyProxy;

describe('remove models from object graph', function() {

  before(function() {
    siesta.ext.storageEnabled = false;
  });

  describe('one to many', function() {
    var MyCollection, Car, Person;
    var car, person;

    beforeEach(function(done) {
      siesta.reset(function() {
        MyCollection = siesta.collection('MyCollection');
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
        siesta.install(function() {
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


});