var assert = require('chai').assert,
  internal = siesta._internal,
  ModelInstance = internal.ModelInstance,
  cache = internal.cache,
  Condition = internal.Condition,
  RelationshipType = siesta.RelationshipType;

describe('cache...', function() {
  var app = siesta.app;

  before(function() {
    app.storageEnabled = false;
  });
  var Car;

  describe('insertion', function() {
    beforeEach(function(done) {
      app.reset(function() {
        var coll = app.collection('myCollection');
        Car = coll.model('Car', {
          id: 'id',
          attributes: ['colour', 'name']
        });
        done();
      });
    });
    it('by pouch id', function() {
      var car = new ModelInstance(Car);
      car.localId = 'dsfsd';
      app.cache.insert(car);
      assert.equal(car, app.cache._localCache()[car.localId]);
      assert.equal(car, app.cache._localCacheByType[car.model.collectionName][car.modelName][car.localId], car);
    });

    it('by default id', function() {
      var car = new ModelInstance(Car);
      car.id = 'dsfsd';
      app.cache.insert(car);

      var remoteCache = app.cache._remoteCache();
      assert.equal(car, remoteCache[car.collectionName][car.modelName][car.id]);
    });

    it('by custom id', function() {
      var m = Car;
      m.id = 'customId';
      var car = new ModelInstance(m);
      car.customId = 'dsfsd';
      app.cache.insert(car);
      var remoteCache = app.cache._remoteCache();
      assert.equal(car, remoteCache[car.collectionName][car.modelName][car.customId]);
    });

  });

  describe('get', function() {
    beforeEach(function(done) {
      app.reset(function() {
        var Collection = app.collection('myCollection');
        Car = Collection.model('Car', {
          id: 'id',
          attributes: ['colour', 'name']
        });
        done();
      });
    });
    it('by pouch id', function() {
      var r = new ModelInstance(Car);
      r.id = 'dsfsd';
      app.cache.insert(r);
      var returned = app.cache.get({
        model: Car,
        id: 'dsfsd'
      });
      assert.equal(returned, r);
    });
    it('by rest id', function() {
      var model = new ModelInstance(Car);
      model.id = 'dsfsd';
      model.localId = 'xyz';
      app.cache.insert(model);
      var returned = app.cache.get({
        model: Car,
        id: 'dsfsd'
      });
      assert.equal(returned, model);
    });
  });

  describe('full test', function() {
    var collection, Car, Person;

    beforeEach(function(done) {
      app.reset(function() {
        collection = app.collection('myCollection');
        Person = collection.model('Person', {
          id: 'id',
          attributes: ['name', 'age']
        });
        Car = collection.model('Car', {
          id: 'id',
          attributes: ['colour', 'name'],
          relationships: {
            owner: {
              model: 'Person',
              type: RelationshipType.OneToMany,
              reverse: 'cars'
            }
          }
        });
        done();
      });

    });

    describe('errors', function() {

      it('ignore duplicate inserts if is the same object', function() {
        var person = Person._instance({
          name: 'Michael Ford',
          age: 23,
          id: 'xyz'
        });
        app.cache.insert(person);
        app.cache.insert(person); // Should be fine as is the exact same object.
      });

      it('cant insert object with same localId', function() {
        var person = Person._instance({
          name: 'Michael Ford',
          age: 23,
          id: 'xyz'
        });
        app.cache.insert(person);
        var duplicateObject = new ModelInstance(Person);
        duplicateObject.localId = person.localId;
        assert.throws(function() {
          app.cache.insert(duplicateObject);
        }, siesta.InternalsError);
      });

      it('cant insert object with same id', function() {
        var person = Person._instance({
          name: 'Michael Ford',
          age: 23,
          id: 'xyz'
        });
        app.cache.insert(person);

        assert.throws(function() {
          app.cache.insert(Person._instance({
            name: 'Michael Ford',
            age: 23,
            id: 'xyz'
          }));
        }, siesta.InternalsError);
      });
    });

  });


});
