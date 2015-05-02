var assert = require('chai').assert,
  internal = siesta.lib,
  Model = internal.Model;

describe.only('Serialiser', function() {
  var Collection, PersonModel, CarModel, CustomModel;
  var app = siesta.createApp('model-serialisation');

  var Serialiser = siesta.lib.Serialiser;
  var Deserialiser = siesta.lib.Deserialiser;

  before(function() {
    app.storage = false;
  });

  describe('serialisation', function() {
    beforeEach(function(done) {
      app.reset(function() {
        Collection = app.collection('myCollection');
        CustomModel = Collection.model('Custom', {
          attributes: ['attr']
        });
        PersonModel = Collection.model('Person', {
          id: 'id',
          attributes: ['name', 'age']
        });
        CarModel = Collection.model('Car', {
          id: 'id',
          attributes: ['colour'],
          relationships: {
            owner: {
              model: PersonModel,
              reverse: 'cars'
            },
            owners: {
              model: PersonModel,
              type: 'ManyToMany',
              reverse: 'ownedCars'
            }
          }
        });
        done();
      });
    });

    it('default serialisation, no relationships', function(done) {
      PersonModel
        .graph({name: 'Mike', age: 24})
        .then(function(person) {
          var s = new Serialiser(PersonModel);
          var serialised = s.data(person);
          assert.equal(serialised.name, 'Mike');
          assert.equal(serialised.age, 24);
          assert.equal(serialised.id, null);
          assert.equal(Object.keys(serialised).length, 3);
          done();
        }).catch(done);
    });

    it('default serialisation, no nulls', function(done) {
      var data = {name: 'Mike', age: 24};
      PersonModel
        .graph(data)
        .then(function(person) {
          var opts = {includeNullAttributes: false};
          var s = new Serialiser(PersonModel, opts);
          var serialised = s.data(person, opts);
          assert.equal(serialised.name, 'Mike');
          assert.equal(serialised.age, 24);
          assert.equal(Object.keys(serialised).length, 2);
          done();
        }).catch(done);
    });

    it('default serialisation, one-to-many relationship', function(done) {
      Collection
        .graph({
          Person: {name: 'Mike', age: 24, id: 1},
          Car: {colour: 'red', id: 2, owner: 1}
        })
        .then(function(results) {
          var car = results.Car;
          var s = new Serialiser(CarModel);
          var serialised = s.data(car);
          assert.equal(serialised.owner, 1);
          done();
        }).catch(done)
    });

    it('default serialisation, many-to-many relationship', function(done) {
      Collection
        .graph({
          Person: {name: 'Mike', age: 24, id: 1},
          Car: {colour: 'red', id: 2, owners: [1]}
        })
        .then(function(results) {
          var car = results.Car;
          var s = new Serialiser(CarModel);
          var serialised = s.data(car);
          assert.include(serialised.owners, 1);
          done();
        }).catch(function(err) {
          console.error(err);
          done(err);
        })
    });

    it('default serialisation, many-to-many relationship, reverse', function(done) {
      Collection
        .graph({
          Person: {name: 'Mike', age: 24, id: 1, ownedCars: [2]},
          Car: {colour: 'red', id: 2}
        })
        .then(function(results) {
          var person = results.Person;
          var s = new Serialiser(CarModel);
          var serialised = s.data(person);
          assert.notOk(serialised.ownedCars);
          done();
        }).catch(function(err) {
          console.error(err);
          done(err);
        })
    });

    describe('custom serialisation', function() {
      beforeEach(function(done) {
        app.reset(done);
      });

      describe('attribute', function() {

        it('attribute', function(done) {
          Collection = app.collection('myCollection');
          CustomModel = Collection.model('Custom', {
            attributes: [
              'attr1',
              'attr2'
            ]
          });
          var s = new Serialiser(CustomModel, {
            attr1: function() {
              return 1;
            }
          });
          CustomModel.graph({
            attr1: 'attr1',
            attr2: 'attr2'
          }).then(function(model) {
            var serialised = s.data(model);
            assert.equal(serialised.attr1, 1);
            assert.equal(serialised.attr2, 'attr2');
            done();
          }).catch(done);
        });

        it('should not include key if undefined is returned', function(done) {
          Collection = app.collection('myCollection');
          CustomModel = Collection.model('Custom', {
            attributes: [
              'attr1',
              'attr2'
            ]
          });

          var s = new Serialiser(CustomModel, {
            attr1: function() {
              return undefined;
            }
          });

          CustomModel.graph({
            attr1: 'attr1',
            attr2: 'attr2'
          }).then(function(model) {
            var serialised = s.data(model);
            assert.notInclude(Object.keys(serialised), 'attr1');
            assert.equal(serialised.attr2, 'attr2');
            done();
          }).catch(done);

        });


      });

      describe('relationship', function() {
        var OtherModel;

        it('serialise', function(done) {
          var _instance;
          Collection = app.collection('myCollection');
          CustomModel = Collection.model('Custom', {
            attributes: ['attr1'],
            relationships: {
              other: {
                model: 'Other',
                reverse: 'customs'
              }
            }
          });
          OtherModel = Collection.model('Other', {});

          var s = new Serialiser(CustomModel, {
            other: function(instance) {
              _instance = instance;
              return 1;
            }
          });

          CustomModel.graph({
            attr1: 'asdasdasd',
            other: 'abcd'
          }).then(function(custom) {
            var serialised = s.data(custom);
            assert.equal(_instance, custom.other);
            assert.equal(serialised.other, 1);
            done();
          }).catch(done);
        });

        it('should not include the relationship if undefined is returned...', function(done) {
          var _instance;
          Collection = app.collection('myCollection');
          CustomModel = Collection.model('Custom', {
            attributes: ['attr1'],
            relationships: {
              other: {
                model: 'Other',
                reverse: 'customs'
              }
            }
          });

          var s = new Serialiser(CustomModel, {
            other: function(instance) {
              return undefined;
            }
          });

          OtherModel = Collection.model('Other', {});
          CustomModel.graph({
            attr1: 'asdasdasd',
            other: 'abcd'
          }).then(function(custom) {
            var serialised = s.data(custom);
            assert.notInclude(Object.keys(serialised), 'other');
            done();
          }).catch(done);
        });


      });

      describe('fields', function() {
        var OtherModel;

        describe('attributes', function() {
          it('plain', function(done) {
            Collection = app.collection('myCollection');
            CustomModel = Collection.model('Custom', {
              attributes: ['attr1', 'attr2']
            });

            var s = new Serialiser(CustomModel, {
              fields: ['attr1', 'id']
            });

            CustomModel.graph({
              attr1: 'abcd',
              attr2: 'def',
              id: 5
            }).then(function(custom) {
              var serialised = s.data(custom);
              assert.equal(serialised.attr1, 'abcd');
              assert.notOk(serialised.attr2);
              assert.equal(serialised.id, 5);
              done();
            }).catch(done);
          });

          it('remote id', function(done) {
            Collection = app.collection('myCollection');
            CustomModel = Collection.model('Custom', {
              attributes: ['attr1', 'attr2']
            });
            var s = new Serialiser(CustomModel, {
              fields: ['attr1']
            });
            CustomModel.graph({
              attr1: 'abcd',
              attr2: 'def',
              id: 5
            }).then(function(custom) {
              var serialised = s.data(custom);
              assert.equal(serialised.attr1, 'abcd');
              assert.notOk(serialised.attr2);
              assert.notOk(serialised.id);
              done();
            }).catch(done);
          });

          it('overrides serialiseField', function(done) {
            Collection = app.collection('myCollection');
            CustomModel = Collection.model('Custom', {
              attributes: ['attr1', 'attr2']
            });

            var s = new Serialiser(CustomModel, {
              fields: ['attr1', 'id'],
              serialiseField: function(field, value) {
                if (field == 'attr2') {
                  return 2;
                }
                return value;
              }
            });

            CustomModel.graph({
              attr1: 'abcd',
              attr2: 'def',
              id: 5
            }).then(function(custom) {
              var serialised = s.data(custom);
              assert.equal(serialised.attr1, 'abcd');
              assert.notOk(serialised.attr2);
              assert.equal(serialised.id, 5);
              done();
            }).catch(done);
          });
        });

        it('relationships', function(done) {
          var _instance;
          Collection = app.collection('myCollection');
          CustomModel = Collection.model('Custom', {
            attributes: ['attr1', 'attr2'],
            relationships: {
              other: {
                model: 'Other',
                reverse: 'customs'
              }
            }
          });

          var s = new Serialiser(CustomModel, {
            other: function(instance) {
              _instance = instance;
              return 1;
            },
            fields: ['attr1', 'id']
          });

          OtherModel = Collection.model('Other', {});
          CustomModel.graph({
            attr1: 'abcd',
            attr2: 'def',
            id: 5
          }).then(function(custom) {
            var serialised = s.data(custom);
            assert.notOk(serialised.other);
            done();
          }).catch(done);
        });

      })
    });

    it('array', function(done) {
      var data = [{name: 'Mike', age: 24}, {name: 'Bob', age: 23}];
      PersonModel
        .graph(data)
        .then(function(people) {
          var s = new Serialiser(PersonModel);
          var serialised = s.data(people);
          assert.equal(serialised.length, 2);
          done();
        }).catch(done);
    });

  });

  describe('deserialisation', function() {
    beforeEach(function(done) {
      app.reset(function() {
        done();
      });
    });
    it('default should do nothing', function() {
      var d = new Deserialiser(CustomModel);
      var deserialised = d._deserialise({attr1: 1});
      assert.equal(deserialised.attr1, 1);
    });
    it('non default', function() {
      var d = new Deserialiser(CustomModel, {
        attr1: function(v) {
          return v * 2;
        }
      });
      var deserialised = d._deserialise({attr1: 1});
      assert.equal(deserialised.attr1, 2);
    });
    it('non default graph', function(done) {
      var d = new Deserialiser(CustomModel, {
        attr1: function(v) {
          return v * 2;
        }
      });
      d.deserialise({
        attr1: 1
      }).then(function(instance) {
        assert.equal(instance.attr1, 2);
        done();
      }).catch(done);
    });
    it('non default graph array', function(done) {
      var d = new Deserialiser(CustomModel, {
        attr1: function(v) {
          return v * 2;
        }
      });
      d.deserialise([{
        attr1: 1
      }, {
        attr1: 2
      }]).then(function(instances) {
        assert.equal(instances[0].attr1, 2);
        assert.equal(instances[1].attr1, 4);
        done();
      }).catch(done);
    });
  })

});
