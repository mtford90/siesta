/**
 * This spec tests that removal of the old siesta.install() step that was required before use has been removed correctly
 */

var assert = require('chai').assert,
  internal = siesta._internal,
  CollectionRegistry = internal.CollectionRegistry,
  RelationshipType = siesta.RelationshipType;

describe('install step', function() {
  var MyCollection, Person;

  beforeEach(function(done) {
    siesta.reset(done);
  });

  describe('no storage', function() {
    before(function() {
      siesta.ext.storageEnabled = false;
    });

    beforeEach(function() {
      MyCollection = siesta.collection('MyCollection');
      Person = MyCollection.model('Person', {
        id: 'id',
        attributes: ['name', 'age', 'index']
      });
    });

    it('map', function(done) {
      Person.graph({name: 'Mike', age: 24})
        .then(function() {
          done();
        })
        .catch(done);
    });

    it('query', function(done) {
      Person.query({age__gt: 23})
        .then(function(res) {
          assert.notOk(res.length, 'Should be no results');
          done();
        })
        .catch(done);
    });

    it('reactive query', function(done) {
      var rq = Person._reactiveQuery({age__lt: 30});
      rq.init()
        .then(function() {
          assert.notOk(rq.results.length);
          rq.terminate();
          done();
        })
        .catch(done);
    });

    it('arranged reactive query', function(done) {
      var rq = Person._arrangedReactiveQuery({age__lt: 30});
      rq.init()
        .then(function() {
          assert.notOk(rq.results.length);
          rq.terminate();
          done();
        })
        .catch(done);
    });

    it('should not be able to define a model after install', function(done) {
      siesta.install().then(function() {
        assert.throws(function() {
          MyCollection.model('AnotherModel', {
            id: 'id',
            attributes: ['something']
          });
        }, Error);

        done();
      }).catch(done);
    })
  });

  describe('storage', function() {
    before(function() {
      siesta.ext.storageEnabled = true;
    });

    after(function(done) {
      siesta.reset(function() {
        siesta.ext.storageEnabled = false;
        siesta.ext.storage._pouch.allDocs().then(function(resp) {
          done();
        });
      })
    });

    beforeEach(function() {
      MyCollection = siesta.collection('MyCollection');
      Person = MyCollection.model('Person', {
        id: 'id',
        attributes: ['name', 'age', 'index']
      });
    });

    it('map', function(done) {
      Person.graph({name: 'Mike', age: 24})
        .then(function() {
          done();
        })
        .catch(done);
    });


    it('query', function(done) {
      siesta.ext.storage._pouch.bulkDocs([
        {collection: 'MyCollection', model: 'Person', name: 'Mike', age: 24},
        {collection: 'MyCollection', model: 'Person', name: 'Bob', age: 21}
      ]).then(function() {
        Person.query({age__gt: 23})
          .then(function(res) {
            assert.equal(res.length, 1, 'Should have installed and loaded before returning from the query');
            done();
          })
          .catch(done);
      }).catch(done);
    });


    it('reactive query', function(done) {
      siesta.ext.storage._pouch.bulkDocs([
        {collection: 'MyCollection', model: 'Person', name: 'Mike', age: 24},
        {collection: 'MyCollection', model: 'Person', name: 'Bob', age: 21}
      ]).then(function() {
        var rq = Person._reactiveQuery({age__gt: 23});
        rq.init()
          .then(function() {
            assert.equal(rq.results.length, 1, 'Should have installed and loaded before returning from the query');
            rq.terminate();
            done();
          })
          .catch(done);
      }).catch(done);
    });

    it('arranged reactive query', function(done) {
      siesta.ext.storage._pouch.bulkDocs([
        {collection: 'MyCollection', model: 'Person', name: 'Mike', age: 24},
        {collection: 'MyCollection', model: 'Person', name: 'Bob', age: 21}
      ]).then(function() {
        var rq = Person._arrangedReactiveQuery({age__gt: 23});
        rq.init()
          .then(function() {
            assert.equal(rq.results.length, 1, 'Should have installed and loaded before returning from the query');
            rq.terminate();
            done();
          })
          .catch(done);
      }).catch(done);
    });


  });

  describe('install relationships', function() {
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

    describe('valid', function() {
      describe('Foreign Key', function() {

        beforeEach(function(done) {
          configureAPI(RelationshipType.OneToMany, function(err) {
            if (err) done(err);
            done();
          });
        });

        it('configures reverse mapping', function() {
          assert.equal(Car.relationships.owner.reverseModel, Person);
        });

        it('configures reverse name', function() {
          assert.equal(Car.relationships.owner.reverseName, 'cars');

          it('configures forward mapping', function() {
            assert.equal(Car.relationships.owner.forwardModel, Car);
          });

        });
        it('configures forward name', function() {
          assert.equal(Car.relationships.owner.forwardName, 'owner');
        });

        it('installs on reverse', function() {
          var keys = Object.keys(Person.relationships.cars);
          for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            if (key != 'isForward' && key != 'isReverse') {
              assert.equal(Person.relationships.cars[key], Car.relationships.owner[key]);
            }
          }
        });


      });

      describe('OneToOne', function() {

        beforeEach(function(done) {
          configureAPI(RelationshipType.OneToOne, function(err) {
            if (err) done(err);
            done();
          });


        });
        it('configures reverse mapping', function() {
          assert.equal(Car.relationships.owner.reverseModel, Person);
        });

        it('configures reverse name', function() {
          assert.equal(Car.relationships.owner.reverseName, 'cars');


        });

        it('configures forward mapping', function() {
          assert.equal(Car.relationships.owner.forwardModel, Car);
        });
        it('configures forward name', function() {
          assert.equal(Car.relationships.owner.forwardName, 'owner');
        });

        it('installs on reverse', function() {
          var keys = Object.keys(Person.relationships.cars);
          for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            if (key != 'isForward' && key != 'isReverse') {
              assert.equal(Person.relationships.cars[key], Car.relationships.owner[key]);
            }
          }
        });
      });
    });

    describe('invalid', function() {
      it('No such mapping', function(done) {
        var collection = siesta.collection('myCollection');
        collection.model('Car', {
          id: 'id',
          attributes: ['colour', 'name'],
          relationships: {
            owner: {
              model: 'asd',
              type: RelationshipType.OneToMany,
              reverse: 'cars'
            }
          }
        });
        siesta.install(function(err) {
          assert.ok(err);
          done();
        });
      });

      it('No such relationship type', function(done) {
        var collection = siesta.collection('myCollection');
        collection.model('Car', {
          id: 'id',
          attributes: ['colour', 'name'],
          relationships: {
            owner: {
              model: 'Person',

              type: 'invalidtype',
              reverse: 'cars'
            }
          }
        });
        collection.model('Person', {
          id: 'id',
          attributes: ['name', 'age']
        });

        siesta.install(function(err) {
          assert.ok(err);
          done();
        });

      });
    });


  });


});

describe('add stuff after install', function() {

  beforeEach(function(done) {
    siesta.reset(done);
  });
  it('add collection', function(done) {
    var MyCollection = siesta.collection('MyCollection'),
      Person = MyCollection.model('Person', {
        id: 'id',
        attributes: ['name', 'age', 'index']
      });
    siesta
      .install()
      .then(function() {
        var AnotherCollection = siesta.collection('AnotherCollection');
        assert.equal(siesta.AnotherCollection, AnotherCollection);
        assert.equal(CollectionRegistry.AnotherCollection, AnotherCollection);
        done();
      }).catch(done);
  });
});