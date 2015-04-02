var assert = require('chai').assert,
  internal = siesta._internal,
  ModelInstance = internal.ModelInstance,
  RelationshipType = siesta.RelationshipType;

describe('intercoll relationships', function() {

  before(function() {
    siesta.ext.storageEnabled = false;
  });

  beforeEach(function(done) {
    siesta.reset(done);
  });

  var Collection, Car, Person;

  function configureAPI(type, done) {
    Collection = siesta.collection('myCollection');
    Car = Collection.model('Car', {
      id: 'id',
      attributes: ['colour', 'name'],
      relationships: {
        owner: {
          model: 'Person',
          type: type,
          reverse: 'cars'
        }
      }
    });
    Person = Collection.model('Person', {
      id: 'id',
      attributes: ['name', 'age']
    });
    siesta.install(done);
  }

  describe('Inter-collection', function() {
    var anotherCollection;
    var obj;

    beforeEach(function(done) {
      configureAPI(RelationshipType.OneToMany, done);
    });

    afterEach(function() {
      anotherCollection = undefined;
      obj = undefined;
    });

    describe('foreign key', function() {
      beforeEach(function(done) {
        anotherCollection = siesta.collection('anotherCollection');
        anotherCollection.model('AnotherMapping', {
          attributes: ['field'],
          relationships: {
            person: {
              model: 'myCollection.Person',
              type: RelationshipType.OneToMany,
              reverse: 'other'
            }
          }
        });

        anotherCollection['AnotherMapping'].graph({
          field: 5,
          person: {name: 'Michael', age: 23, id: 'xyz'}
        }, function(err, _obj) {
          if (err) done(err);
          obj = _obj;
          done();
        });
      });

      it('installs forward', function() {
        var person = obj.person;
        assert.instanceOf(person, ModelInstance);
        assert.equal(person.collectionName, 'myCollection');
        assert.equal(person.collection, Collection);
        assert.equal(person.name, 'Michael');
        assert.equal(person.age, 23);
      });

      it('installs backwards', function() {
        var person = obj.person;
        assert.include(person.other, obj);
      });

    });
  });


});