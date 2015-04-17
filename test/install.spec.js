/**
 * This spec tests that removal of the old siesta.install() step that was required before use has been removed correctly
 */

var assert = require('chai').assert,
  internal = siesta._internal,
  Model = internal.Model,
  Condition = internal.Condition,
  CollectionRegistry = internal.CollectionRegistry,
  RelationshipType = siesta.RelationshipType;

describe('installation', function() {
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
          Person
            .query({age__gt: 23})
            .then(function(res) {
              assert.equal(res.length, 1, 'Should have installed and loaded before returning from the query');
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
        Model.install([Person, Car], done);
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
            console.log('Car.relationships', Car.relationships);
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
        it('No such relationship type', function() {
          var collection = siesta.collection('myCollection');
          assert.throws(function() {
            Car = collection.model('Car', {
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

      Model
        .install([Person])
        .then(function() {
          var AnotherCollection = siesta.collection('AnotherCollection');
          assert.equal(siesta.AnotherCollection, AnotherCollection);
          assert.equal(CollectionRegistry.AnotherCollection, AnotherCollection);
          done();
        }).catch(done);
    });

    describe('add simple model', function() {
      var MyCollection, Car;
      beforeEach(function(done) {
        MyCollection = siesta.collection('MyCollection');
        Car = MyCollection.model('Car', {
          attributes: ['type']
        });
        Model
          .install([Car])
          .then(function() {
            done();
          })
          .catch(done);
      });

      it('is available on the collection', function() {
        assert.equal(MyCollection.Car, Car);
      });

      it('graph works', function(done) {
        Car.graph({type: 'red'})
          .then(function(car) {
            assert.ok(car);
            done();
          })
          .catch(done);
      });

    });


    describe('add model with relationship', function() {
      var MyCollection, Car, Person;

      afterEach(function() {
        MyCollection = null;
        Car = null;
        Person = null;
      });

      describe('delay creation of relationship', function() {
        beforeEach(function(done) {
          MyCollection = siesta.collection('MyCollection');
          Person = MyCollection.model('Person', {
            id: 'id',
            attributes: ['name', 'age']
          });
          Car = MyCollection.model('Car', {
            attributes: ['type'],
            relationships: {
              owner: {
                model: 'Person',
                reverse: 'cars'
              }
            }
          });
          Model
            .install([Car, Person])
            .then(function() {

              done();
            })
            .catch(done);
        });

        it('is available on the collection', function() {
          assert.equal(MyCollection.Car, Car);
        });

        it('graph works', function(done) {
          Person.graph({name: 'mike', age: 21})
            .then(function(p) {
              Car.graph({type: 'red', owner: p})
                .then(function(car) {
                  assert.ok(car);
                  assert.equal(car.owner, p);
                  assert.include(p.cars, car);
                  done();
                })
                .catch(done);
            }).catch(done);

        });
      });

      describe('delay creation of related model', function() {
        beforeEach(function() {
          MyCollection = siesta.collection('MyCollection');
          Car = MyCollection.model('Car', {
            attributes: ['type'],
            relationships: {
              owner: {
                model: 'Person',
                reverse: 'cars'
              }
            }
          });
          Person = MyCollection.model('Person', {
            id: 'id',
            attributes: ['name', 'age']
          });
        });

        it('is available on the collection', function() {
          assert.equal(MyCollection.Car, Car);
        });

        it('graph works', function(done) {
          Person
            .graph({name: 'mike', age: 21})
            .then(function(p) {
              console.log('uno');
              Car.graph({type: 'red', owner: p})
                .then(function(car) {
                  console.log('dos');
                  assert.ok(car);
                  assert.equal(car.owner, p);
                  assert.include(p.cars, car);
                  done();
                })
                .catch(done);
            }).catch(done);
        });
      });


    });


  });
});


