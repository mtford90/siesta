var assert = require('chai').assert,
    internal = siesta._internal,
    Model = internal.Model;

describe('model serialisation', function() {

  var Collection, PersonModel, CarModel, CustomModel;

  before(function() {
    siesta.ext.storageEnabled = false;
  });

  beforeEach(function(done) {
    siesta.reset(function() {
      Collection = siesta.collection('myCollection');
      CustomModel = Collection.model('Custom', {
        attributes: ['attr'],
        serialise: function(model) {
          return model.attr;
        }
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
          var serialised = person.serialise();
          assert.equal(serialised.name, 'Mike');
          assert.equal(serialised.age, 24);
          assert.equal(serialised.id, null);
          assert.equal(Object.keys(serialised).length, 3);
          done();
        }).catch(done);
  });

  it('default serialisation, no nulls', function(done) {
    PersonModel
        .graph({name: 'Mike', age: 24})
        .then(function(person) {
          var serialised = person.serialise({includeNullAttributes: false});
          assert.equal(serialised.name, 'Mike');
          assert.equal(serialised.age, 24);
          console.log('serialised', serialised);
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
          var serialised = car.serialise();
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
          var serialised = car.serialise();
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
          var serialised = person.serialise();
          assert.notOk(serialised.ownedCars);
          done();
        }).catch(function(err) {
          console.error(err);
          done(err);
        })
  });

  describe('custom serialisation', function() {
    beforeEach(function(done) {
      siesta.reset(done);
    });
    it('comprehensive', function(done) {
      Collection = siesta.collection('myCollection');
      CustomModel = Collection.model('Custom', {
        attributes: ['attr'],
        serialise: function(model) {
          return model.attr;
        }
      });
      CustomModel.graph({attr: 5}, function(err, model) {
        if (err) done(err);
        else {
          var serialised = model.serialise();
          assert.equal(serialised, 5);
          done();
        }
      });
    });
    it('field by field', function(done) {
      Collection = siesta.collection('myCollection');
      CustomModel = Collection.model('Custom', {
        attributes: ['attr1', 'attr2'],
        serialiseField: function(fieldName, value) {
          if (fieldName == 'attr1') return 1;
          return value;
        }
      });
      CustomModel.graph({
        attr1: 'attr1',
        attr2: 'attr2'
      }).then(function(model) {
        assert.equal(model.serialise().attr1, 1);
        assert.equal(model.serialise().attr2, 'attr2');
        done();
      }).catch(done);
    });
    describe('attribute', function() {
      it('attribute', function(done) {
        Collection = siesta.collection('myCollection');
        CustomModel = Collection.model('Custom', {
          attributes: [
            {
              name: 'attr1',
              serialise: function(value) {
                return 1;
              }
            },
            'attr2'
          ]
        });
        CustomModel.graph({
          attr1: 'attr1',
          attr2: 'attr2'
        }).then(function(model) {
          assert.equal(model.serialise().attr1, 1);
          assert.equal(model.serialise().attr2, 'attr2');
          done();
        }).catch(done);
      });
      it('serialiseField should be overidden by serialise', function(done) {
        Collection = siesta.collection('myCollection');
        CustomModel = Collection.model('Custom', {
          attributes: [
            {
              name: 'attr1',
              serialise: function(value) {
                return 1;
              }
            },
            'attr2'
          ],
          serialiseField: function(field, value) {
            if (field == 'attr1') {
              return 2;
            }
            else if (field == 'attr2') {
              return 5;
            }
            return value;
          }
        });
        CustomModel.graph({
          attr1: 'attr1',
          attr2: 'attr2'
        }).then(function(model) {
          assert.equal(model.serialise().attr1, 1);
          assert.equal(model.serialise().attr2, 5);
          done();
        }).catch(done);
      });
      it('serialise should override per-attribute serialise', function(done) {
        Collection = siesta.collection('myCollection');
        CustomModel = Collection.model('Custom', {
          attributes: [
            {
              name: 'attr1',
              serialise: function(value) {
                return 1;
              }
            },
            'attr2'
          ],
          serialise: function(model) {
            return 1;
          }
        });
        CustomModel.graph({
          attr1: 'attr1',
          attr2: 'attr2'
        }).then(function(model) {
          assert.equal(model.serialise(), 1);
          done();
        }).catch(done);
      });

    });
    describe('relationship', function() {
      var OtherModel;
      it('relationship', function(done) {
        Collection = siesta.collection('myCollection');
        CustomModel = Collection.model('Custom', {
          attributes: ['attr1'],
          relationships: {
            other: {
              model: 'Other',
              reverse: 'customs',
              serialise: function(instance) {
                return 1;
              }
            }
          }
        });
        OtherModel = Collection.model('Other', {});
        CustomModel.graph({
          attr1: 'asdasdasd',
          other: 'abcd'
        }).then(function(custom) {
          var serialised = custom.serialise();
          assert.equal(serialised.other, 1);
          done();
        }).catch(done);
      });
      it('serialiseField should be overidden by serialise', function(done) {
        Collection = siesta.collection('myCollection');
        CustomModel = Collection.model('Custom', {
          relationships: {
            other: {
              model: 'Other',
              reverse: 'customs',
              serialise: function(instance) {
                return 1;
              }
            }
          },
          serialiseField: function(field, value) {
            if (field == 'other') {
              return 2;
            }
            return value;
          }
        });
        OtherModel = Collection.model('Other', {});
        CustomModel.graph({
          other: 'abcd'
        }).then(function(custom) {
          var serialised = custom.serialise();
          assert.equal(serialised.other, 1);
          done();
        }).catch(done);
      });
      it('serialise should override per-relationship serialise', function(done) {
        Collection = siesta.collection('myCollection');
        CustomModel = Collection.model('Custom', {
          relationships: {
            other: {
              model: 'Other',
              reverse: 'customs',
              serialise: function(instance) {
                return 1;
              }
            }
          },
          serialise: function(model) {
            return 2;
          }
        });
        OtherModel = Collection.model('Other', {});
        CustomModel.graph({
          other: 'abcd'
        }).then(function(custom) {
          var serialised = custom.serialise();
          assert.equal(serialised, 2);
          done();
        }).catch(done);
      });
    });

    describe('serialisableFields', function() {
      var OtherModel;
      describe('attributes', function() {
        it('plain', function(done) {
          Collection = siesta.collection('myCollection');
          CustomModel = Collection.model('Custom', {
            attributes: ['attr1', 'attr2'],
            serialisableFields: ['attr1', 'id']
          });
          CustomModel.graph({
            attr1: 'abcd',
            attr2: 'def',
            id: 5
          }).then(function(custom) {
            var serialised = custom.serialise();
            assert.equal(serialised.attr1, 'abcd');
            assert.notOk(serialised.attr2);
            assert.equal(serialised.id, 5);
            done();
          }).catch(done);
        });
        it('remote id', function(done) {
          Collection = siesta.collection('myCollection');
          CustomModel = Collection.model('Custom', {
            attributes: ['attr1', 'attr2'],
            serialisableFields: ['attr1']
          });
          CustomModel.graph({
            attr1: 'abcd',
            attr2: 'def',
            id: 5
          }).then(function(custom) {
            var serialised = custom.serialise();
            assert.equal(serialised.attr1, 'abcd');
            assert.notOk(serialised.attr2);
            assert.notOk(serialised.id);
            done();
          }).catch(done);
        });
        it('overrides serialiseField', function(done) {
          Collection = siesta.collection('myCollection');
          CustomModel = Collection.model('Custom', {
            attributes: ['attr1', 'attr2'],
            serialisableFields: ['attr1', 'id'],
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
            var serialised = custom.serialise();
            assert.equal(serialised.attr1, 'abcd');
            assert.notOk(serialised.attr2);
            assert.equal(serialised.id, 5);
            done();
          }).catch(done);
        });
      });

      it('relationships', function(done) {
        Collection = siesta.collection('myCollection');
        CustomModel = Collection.model('Custom', {
          attributes: ['attr1', 'attr2'],
          serialisableFields: ['attr1', 'id'],
          relationships: {
            other: {
              model: 'Other',
              reverse: 'customs',
              serialise: function(instance) {
                return 1;
              }
            }
          },
        });

        OtherModel = Collection.model('Other', {});
        CustomModel.graph({
          attr1: 'abcd',
          attr2: 'def',
          id: 5
        }).then(function(custom) {
          var serialised = custom.serialise();
          assert.notOk(serialised.other);
          done();
        }).catch(done);
      });

    })
  });

});