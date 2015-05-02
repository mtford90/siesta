var assert = require('chai').assert,
  internal = siesta.lib,
  Model = internal.Model;

describe('model serialisation', function () {

  var Collection, PersonModel, CarModel, CustomModel;
  var app = siesta.createApp('model-serialisation');

  var Serialiser = siesta.lib.Serialiser;

  before(function () {
    app.storage = false;
  });

  beforeEach(function (done) {
    app.reset(function () {
      Collection = app.collection('myCollection');
      CustomModel = Collection.model('Custom', {
        attributes: ['attr'],
        serialise: function (model) {
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

  it('default serialisation, no relationships', function (done) {
    PersonModel
      .graph({name: 'Mike', age: 24})
      .then(function (person) {
        var s = new Serialiser(PersonModel);
        var serialised = s.data(person);
        assert.equal(serialised.name, 'Mike');
        assert.equal(serialised.age, 24);
        assert.equal(serialised.id, null);
        assert.equal(Object.keys(serialised).length, 3);
        done();
      }).catch(done);
  });

  it('default serialisation, no nulls', function (done) {
    var data = {name: 'Mike', age: 24};
    PersonModel
      .graph(data)
      .then(function (person) {
        var opts = {includeNullAttributes: false};
        var s = new Serialiser(PersonModel, opts);
        var serialised = s.data(person, opts);
        assert.equal(serialised.name, 'Mike');
        assert.equal(serialised.age, 24);
        assert.equal(Object.keys(serialised).length, 2);
        done();
      }).catch(done);
  });

  it('default serialisation, one-to-many relationship', function (done) {
    Collection
      .graph({
        Person: {name: 'Mike', age: 24, id: 1},
        Car: {colour: 'red', id: 2, owner: 1}
      })
      .then(function (results) {
        var car = results.Car;
        var s = new Serialiser(CarModel);
        var serialised = s.data(car);
        assert.equal(serialised.owner, 1);
        done();
      }).catch(done)
  });

  it('default serialisation, many-to-many relationship', function (done) {
    Collection
      .graph({
        Person: {name: 'Mike', age: 24, id: 1},
        Car: {colour: 'red', id: 2, owners: [1]}
      })
      .then(function (results) {
        var car = results.Car;
        var s = new Serialiser(CarModel);
        var serialised = s.data(car);
        assert.include(serialised.owners, 1);
        done();
      }).catch(function (err) {
        console.error(err);
        done(err);
      })
  });
  it('default serialisation, many-to-many relationship, reverse', function (done) {
    Collection
      .graph({
        Person: {name: 'Mike', age: 24, id: 1, ownedCars: [2]},
        Car: {colour: 'red', id: 2}
      })
      .then(function (results) {
        var person = results.Person;
        var s = new Serialiser(CarModel);
        var serialised = s.data(person);
        assert.notOk(serialised.ownedCars);
        done();
      }).catch(function (err) {
        console.error(err);
        done(err);
      })
  });

  describe('custom serialisation', function () {
    beforeEach(function (done) {
      app.reset(done);
    });


    it('field by field', function (done) {
      Collection = app.collection('myCollection');
      CustomModel = Collection.model('Custom', {
        attributes: ['attr1', 'attr2'],
        serialiseField: function (fieldName, value) {
          if (fieldName == 'attr1') return 1;
          return value;
        }
      });
      CustomModel.graph({
        attr1: 'attr1',
        attr2: 'attr2'
      }).then(function (model) {
        var s = new Serialiser(model, {
          serialiseField: function (fieldName, value) {
            if (fieldName == 'attr1') return 1;
            return value;
          }
        });
        var serialised = s.data(model);
        assert.equal(serialised.attr1, 1);
        assert.equal(serialised.attr2, 'attr2');
        done();
      }).catch(done);
    });

    it('should not include key if undefined is returned', function (done) {
      Collection = app.collection('myCollection');
      CustomModel = Collection.model('Custom', {
        attributes: ['attr1', 'attr2']
      });
      CustomModel.graph({
        attr1: 'attr1',
        attr2: 'attr2'
      }).then(function (model) {
        var s = new Serialiser(CustomModel, {
          serialiseField: function (fieldName, value) {
            if (fieldName == 'attr1') return undefined;
            return value;
          }
        });
        var serialised = s.data(model);
        assert.equal(serialised.attr2, 'attr2');
        assert.notInclude(Object.keys(serialised), 'attr1');
        done();
      }).catch(done);
    });

    describe('attribute', function () {
      it('attribute', function (done) {
        Collection = app.collection('myCollection');
        CustomModel = Collection.model('Custom', {
          attributes: [
            'attr1',
            'attr2'
          ]
        });
        var s = new Serialiser(CustomModel, {
          attr1: function () {
            return 1;
          }
        });
        CustomModel.graph({
          attr1: 'attr1',
          attr2: 'attr2'
        }).then(function (model) {
          var serialised = s.data(model);
          assert.equal(serialised.attr1, 1);
          assert.equal(serialised.attr2, 'attr2');
          done();
        }).catch(done);
      });

      it('should not include key if undefined is returned', function (done) {
        Collection = app.collection('myCollection');
        CustomModel = Collection.model('Custom', {
          attributes: [
            'attr1',
            'attr2'
          ]
        });

        var s = new Serialiser(CustomModel, {
          attr1: function () {
            return undefined;
          }
        });

        CustomModel.graph({
          attr1: 'attr1',
          attr2: 'attr2'
        }).then(function (model) {
          var serialised = s.data(model);
          assert.notInclude(Object.keys(serialised), 'attr1');
          assert.equal(serialised.attr2, 'attr2');
          done();
        }).catch(done);

      });

      it('serialiseField should be overidden by serialise', function (done) {
        Collection = app.collection('myCollection');
        CustomModel = Collection.model('Custom', {
          attributes: [
            'attr1',
            'attr2'
          ]
        });

        var s = new Serialiser(CustomModel, {
          attr1: function () {
            return 1;
          },
          serialiseField: function (field, value) {
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
        }).then(function (model) {
          var serialised = s.data(model);
          assert.equal(serialised.attr1, 1);
          assert.equal(serialised.attr2, 5);
          done();
        }).catch(done);
      });

    });
    describe('relationship', function () {
      var OtherModel;

      it('serialise', function (done) {
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
          other: function (instance) {
            _instance = instance;
            return 1;
          }
        });

        CustomModel.graph({
          attr1: 'asdasdasd',
          other: 'abcd'
        }).then(function (custom) {
          var serialised = s.data(custom);
          assert.equal(_instance, custom.other);
          assert.equal(serialised.other, 1);
          done();
        }).catch(done);
      });

      it('serialiseField', function (done) {
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
          serialiseField: function (field, value) {
            if (field == 'other') {
              return value.id;
            }
            return value;
          }
        });

        CustomModel.graph({
          attr1: 'asdasdasd',
          other: 'abcd'
        }).then(function (custom) {
          var serialised = s.data(custom);
          assert.equal(serialised.other, custom.other.id);
          done();
        }).catch(done);
      });

      it('should not include the relationship if undefined is returned...', function (done) {
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
          other: function (instance) {
            return undefined;
          }
        });

        OtherModel = Collection.model('Other', {});
        CustomModel.graph({
          attr1: 'asdasdasd',
          other: 'abcd'
        }).then(function (custom) {
          var serialised = s.data(custom);
          assert.notInclude(Object.keys(serialised), 'other');
          done();
        }).catch(done);
      });


      it('serialiseField should be overidden by serialise', function (done) {
        Collection = app.collection('myCollection');
        CustomModel = Collection.model('Custom', {
          relationships: {
            other: {
              model: 'Other',
              reverse: 'customs'
            }
          }
        });
        OtherModel = Collection.model('Other', {});

        var s = new Serialiser(CustomModel, {
          other: function () {
            return 1;
          },
          serialiseField: function (field, value) {
            if (field == 'other') {
              return 2;
            }
            return value;
          }
        });

        CustomModel.graph({
          other: 'abcd'
        }).then(function (custom) {
          var serialised = s.data(custom);
          assert.equal(serialised.other, 1);
          done();
        }).catch(done);
      });

    });

    describe('serialisableFields', function () {
      var OtherModel;
      describe('attributes', function () {
        it('plain', function (done) {
          Collection = app.collection('myCollection');
          CustomModel = Collection.model('Custom', {
            attributes: ['attr1', 'attr2']
          });

          var s = new Serialiser(CustomModel, {
            serialisableFields: ['attr1', 'id']
          });

          CustomModel.graph({
            attr1: 'abcd',
            attr2: 'def',
            id: 5
          }).then(function (custom) {
            var serialised = s.data(custom);
            assert.equal(serialised.attr1, 'abcd');
            assert.notOk(serialised.attr2);
            assert.equal(serialised.id, 5);
            done();
          }).catch(done);
        });

        it('remote id', function (done) {
          Collection = app.collection('myCollection');
          CustomModel = Collection.model('Custom', {
            attributes: ['attr1', 'attr2']
          });
          var s = new Serialiser(CustomModel, {
            serialisableFields: ['attr1']
          });
          CustomModel.graph({
            attr1: 'abcd',
            attr2: 'def',
            id: 5
          }).then(function (custom) {
            var serialised = s.data(custom);
            assert.equal(serialised.attr1, 'abcd');
            assert.notOk(serialised.attr2);
            assert.notOk(serialised.id);
            done();
          }).catch(done);
        });

        it('overrides serialiseField', function (done) {
          Collection = app.collection('myCollection');
          CustomModel = Collection.model('Custom', {
            attributes: ['attr1', 'attr2']
          });

          var s = new Serialiser(CustomModel, {
            serialisableFields: ['attr1', 'id'],
            serialiseField: function (field, value) {
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
          }).then(function (custom) {
            var serialised = s.data(custom);
            assert.equal(serialised.attr1, 'abcd');
            assert.notOk(serialised.attr2);
            assert.equal(serialised.id, 5);
            done();
          }).catch(done);
        });
      });

      it('relationships', function (done) {
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
          other: function (instance) {
            _instance = instance;
            return 1;
          },
          serialisableFields: ['attr1', 'id']
        });

        OtherModel = Collection.model('Other', {});
        CustomModel.graph({
          attr1: 'abcd',
          attr2: 'def',
          id: 5
        }).then(function (custom) {
          var serialised = s.data(custom);
          assert.notOk(serialised.other);
          done();
        }).catch(done);
      });

    })
  });

});


