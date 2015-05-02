var assert = require('chai').assert,
  internal = siesta.lib,
  Model = internal.Model,
  ModelInstance = internal.ModelInstance;

describe('Models', function() {

  var app = siesta.createApp('Models');

  before(function() {
    app.storage = false;
  });

  beforeEach(function(done) {
    app.reset(done);
  });

  it('_attributeNames', function() {
    var model = new Model({
      name: 'name',
      id: 'id',
      attributes: ['field1', 'field2'],
      collection: {name: 'x', context: app}
    });
    assert.include(model._attributeNames, 'id');
    assert.include(model._attributeNames, 'field1');
    assert.include(model._attributeNames, 'field2');
    assert.notInclude(model._attributeNames, 'type');
  });

  it('attributes', function() {
    var model = new Model({
      name: 'name',
      id: 'id',
      attributes: ['field1', 'field2'],
      collection: {name: 'x', context: app}
    });
    var attributes = _.pluck(model.attributes, 'name');
    assert.include(attributes, 'field1');
    assert.include(attributes, 'field2');
  });

  it('name', function() {
    var model = new Model({
      name: 'name',
      id: 'id',
      attributes: ['field1', 'field2'],
      collection: {name: 'x', context: app}
    });
    assert.equal(model.name, 'name');
  });

  it('named attribute', function(done) {
    var Collection = app.collection('myCollection');
    var Model = Collection.model({
      name: 'Car',
      id: 'id',
      attributes: [
        {
          name: 'date'
        },
        'name'
      ],
      collection: 'myCollection'
    });
    Model
      .graph({date: 'xyz', name: 'blah'})
      .then(function(model) {
        assert.equal(model.date, 'xyz');
        done();
      })
      .catch(done);
  });

  it('id', function() {
    var model = new Model({
      name: 'name',
      id: 'id',
      attributes: ['field1', 'field2'],
      collection: {name: 'x', context: app}
    });
    assert.equal(model.id, 'id');
  });

  it('define relationship with string', function(done) {
    var Collection = app.collection('myCollection'),
      Person = Collection.model('Person', {
        attributes: ['name']
      }),
      Car = Collection.model('Car', {
        attributes: ['colour'],
        relationships: {
          owner: {
            model: 'Person',
            reverse: 'cars'
          }
        }
      });

    Car.graph({colour: 'red', owner: {name: 'bob'}})
      .then(function(car) {
        assert.ok(car);
        assert.ok(car.owner);
        done();
      })
      .catch(done);
  });

  it('define relationship with model', function(done) {
    var Collection = app.collection('myCollection'),
      Person = Collection.model('Person', {
        attributes: ['name']
      }),
      Car = Collection.model('Car', {
        attributes: ['colour'],
        relationships: {
          owner: {
            model: Person,
            reverse: 'cars'
          }
        }
      });

    Car
      .graph({colour: 'red', owner: {name: 'bob'}})
      .then(function(car) {
        assert.ok(car);
        assert.ok(car.owner);
        done();
      })
      .catch(done);
  });

  describe('basics', function() {
    var Model, Collection;

    beforeEach(function() {
      Collection = app.collection('myCollection');
      Model = Collection.model({
        name: 'Car',
        id: 'id',
        attributes: ['colour', 'name'],
        collection: 'myCollection'
      });
    });

    it('get attributes', function(done) {
      Model.graph({id: 1, colour: 'red', name: 'Aston martin'})
        .then(function(car) {
          var attributes = car.getAttributes();
          assert.equal(Object.keys(attributes).length, 3);
          assert.equal(attributes.id, 1);
          assert.equal(attributes.colour, 'red');
          assert.equal(attributes.name, 'Aston martin');
          done();
        })
        .catch(done);
    });


  });

  describe('fields', function() {
    var Model, Collection;

    beforeEach(function() {
      Collection = app.collection('myCollection');
      Model = Collection.model({
        name: 'Car',
        id: 'id',
        attributes: ['colour', 'name'],
        collection: 'myCollection'
      });
    });

    it('modelName field', function() {
      var r = new ModelInstance(Model);
      assert.equal(r.modelName, 'Car');
    });

    it('collection field', function() {
      var modelInstance = new ModelInstance(Model);
      assert.equal(modelInstance.collectionName, 'myCollection');
      assert.equal(modelInstance.collection, Collection);
    });

  });

  describe('removal', function() {
    var Model, Collection, car;

    beforeEach(function() {
      Collection = app.collection('myCollection');
      Model = Collection.model({
        name: 'Car',
        id: 'id',
        attributes: ['colour', 'name'],
        collection: 'myCollection'
      });
    });


    describe('remote id', function() {
      function remove() {
        car = new ModelInstance(Model);
        car.colour = 'red';
        car.name = 'Aston Martin';
        car.id = '2';
        car.localId = 'xyz';
        app.cache.insert(car);
        assert.notOk(car.removed);
        assert.ok(app.cache.contains(car));
        car.remove();
        assert.notOk(app.cache.contains(car));
        assert.ok(car.removed);
      }

      it('deletion', function() {
        remove();
      });

      it('restore', function() {
        remove();
        car.restore();
        assert.notOk(car.removed);
        assert.ok(app.cache.contains(car));
      });

    });

    describe('no remote id', function() {
      function remove() {
        car = new ModelInstance(Model);
        car.colour = 'red';
        car.name = 'Aston Martin';
        car.localId = 'xyz';
        app.cache.insert(car);
        assert.notOk(car.removed);
        assert.ok(app.cache.contains(car));
        car.remove();
        assert.notOk(app.cache.contains(car));
        assert.ok(car.removed);
      }

      it('deletion', function() {
        remove();
      });

      it('restore', function() {
        remove();
        car.restore();
        assert.notOk(car.removed);
        assert.ok(app.cache.contains(car));
      });
    })


  });

  describe('custom emissions', function() {
    var Model, Collection;

    beforeEach(function() {
      Collection = app.collection('myCollection');
      Model = Collection.model({
        name: 'Car',
        id: 'id',
        attributes: ['colour', 'name'],
        collection: 'myCollection'
      });
    });

    it('string format', function(done) {
      app.reset(function() {
        Collection = app.collection('myCollection');
        Model = Collection.model('Model', {
          attributes: ['colour'],
          methods: {
            foo: function() {
              this.emit('x', {
                y: 1
              });
            }
          }
        });
        Model.graph({colour: 'red'})
          .then(function(m) {
            m.once('*', function(e) {
              console.log('e', e);
              assert.equal(e.type, 'x');
              assert.equal(e.y, 1);
              done();
            });
            m.foo();
          }).catch(done);
      });
    });
    it('obj format', function(done) {
      app.reset(function() {
        Collection = app.collection('myCollection');
        Model = Collection.model('Model', {
          attributes: ['colour'],
          methods: {
            foo: function() {
              this.emit({
                y: 1,
                type: 'x'
              });
            }
          }
        });
        Model.graph({colour: 'red'})
          .then(function(m) {
            m.once('*', function(e) {
              console.log('e', e);
              assert.equal(e.type, 'x');
              assert.equal(e.y, 1);
              done();
            });
            m.foo();
          }).catch(done);
      });
    });
  });

  describe('customisation', function() {
    describe('methods', function() {
      describe('init', function() {
        it('sync', function(done) {
          var C = app.collection('C');
          var M = C.model('M', {
            init: function(fromStorage) {
              assert.notOk(fromStorage);
              assert.equal(this.attr, 1);
              done();
            },
            attributes: ['attr']
          });

          M.graph({
            attr: 1
          }).then(function() {done();}).catch(done);

        });
        it('async', function(done) {
          var C = app.collection('C');
          var initExecuted = false;
          var M = C.model('M', {
            init: function(fromStorage, cb) {
              assert.notOk(fromStorage);
              assert.equal(this.attr, 1);
              initExecuted = true;
              cb();
            },
            attributes: ['attr']
          });
          internal.Model.install([M])
            .then(function() {
              M.graph({
                attr: 1
              })
                .then(function() {
                  assert.ok(initExecuted);
                  done();
                })
                .catch(done);
            })
            .catch(done);
        });
        it('mixture of async and sync', function(done) {
          var C = app.collection('C');
          var asyncInitExecuted = false,
            syncInitExecuted = false;
          var M = C.model('M', {
              init: function(fromStorage, cb) {
                assert.notOk(fromStorage);
                assert.equal(this.attr, 1);
                asyncInitExecuted = true;
                cb();
              },
              attributes: ['attr']
            }),
            M_2 = C.model('M_2', {
              init: function(fromStorage) {
                assert.notOk(fromStorage);
                assert.equal(this.attr, 2);
                syncInitExecuted = true;
              },
              attributes: ['attr']
            });
          M.graph({
            attr: 1
          })
            .then(function() {
              M_2.graph({
                attr: 2
              })
                .then(function() {
                  assert.ok(asyncInitExecuted);
                  assert.ok(syncInitExecuted);
                  done();
                }).catch(done);
            })
            .catch(done);
        });

        it('use queries within', function(done) {
          var C = app.collection('C'),
            asyncInitExecuted = false,
            syncInitExecuted = false;
          var M = C.model('M', {
              init: function(fromStorage, cb) {
                assert.notOk(fromStorage);
                M_2.filter({}).then(function() {
                  asyncInitExecuted = true;
                  cb();
                }).catch(cb);
              },
              attributes: ['attr']
            }),
            M_2 = C.model('M_2', {
              init: function(fromStorage) {
                assert.notOk(fromStorage);
                assert.equal(this.attr, 2);
                syncInitExecuted = true;
              },
              attributes: ['attr']
            });
          M.graph({
            attr: 1
          }).then(function() {
            M_2.graph({
              attr: 2
            }).then(function() {
              assert.ok(asyncInitExecuted);
              assert.ok(syncInitExecuted);
              done();
            }).catch(done);
          }).catch(done);
        });

        it('use singleton within', function(done) {
          var C = app.collection('C');
          var asyncInitExecuted = false;
          var M = C.model('M', {
              init: function(fromStorage, cb) {
                assert.notOk(fromStorage);
                M_2.one().then(function() {
                  asyncInitExecuted = true;
                  cb();
                }).catch(cb);
              },
              attributes: ['attr']
            }),
            M_2 = C.model('M_2', {
              attributes: ['attr'],
              singleton: true
            });
          M.graph({
            attr: 1
          }).then(function() {
            assert.ok(asyncInitExecuted);
            done();
          }).catch(done);
        });

        it('use with singleton', function(done) {
          var C = app.collection('C');
          var asyncInitExecuted = false;
          var M = C.model('M', {
              init: function(fromStorage, cb) {
                assert.notOk(fromStorage);
                M_2.one().then(function() {
                  asyncInitExecuted = true;
                  cb();
                }).catch(cb);
              },
              attributes: ['attr'],
              singleton: true
            }),
            M_2 = C.model('M_2', {
              attributes: ['attr']
            });
          M.graph({
            attr: 1
          }).then(function() {
            assert.ok(asyncInitExecuted);
            done();
          }).catch(done);
        });
      });

      it('valid', function(done) {
        var C = app.collection('C');
        var M = C.model('M', {
          methods: {
            f: function() {
              return this.attr
            }
          },
          attributes: ['attr']
        });

        internal.Model.install([M])
          .then(function() {
            M.graph({
              attr: 'xyz'
            })
              .then(function(m) {
                assert.equal(m.attr, m.f());
                done();
              })
              .catch(done);
          }).catch(done);
      });
      it('clash', function(done) {
        var C = app.collection('C'),
          M = C.model('M', {
            methods: {
              restore: function() {
                return 'a'
              }
            },
            attributes: ['attr']
          });
        M.graph({
          attr: 'xyz'
        }).then(function(m) {
          assert.notEqual(m.restore(), 'a', 'Should not replace existing definitions')
          done();
        }).catch(done);
      });

      it('sync remove', function(done) {
        var C = app.collection('C');
        var m;
        var M = C.model('M', {
          remove: function() {
            assert.equal(this, m);
            done();
          },
          attributes: ['attr']
        });

        M.graph({
          attr: 1
        })
          .then(function(_m) {
            m = _m;
            _m.remove();
            done();
          });

      });
      it('async remove', function(done) {
        var C = app.collection('C');
        var m;
        var removeCalled = false;
        var M = C.model('M', {
          remove: function(cb) {
            assert.equal(this, m);
            removeCalled = true;
            cb();
          },
          attributes: ['attr']
        });

        M.graph({
          attr: 1
        })
          .then(function(_m) {
            m = _m;
            _m.remove()
              .then(function() {
                assert.ok(removeCalled);
                done();
              })
              .catch(done);
          });

      });
      it('init on restore', function(done) {
        var C = app.collection('C');
        var m;
        var initCalled = false;
        var M = C.model('M', {
          init: function(restored) {
            assert.notOk(restored);
            assert.equal(this.attr, 1);
            initCalled = true;
          },
          attributes: ['attr']
        });

        M.graph({
          attr: 1
        }).then(function(_m) {
          m = _m;
          _m.remove()
            .then(function() {
              initCalled = false;
              M.init = function(restored) {
                assert.ok(restored);
                assert.equal(this.attr, 1);
                initCalled = true;
              };
              _m.restore();
              assert.ok(initCalled);
              done();
            }).catch(done);
        }).catch(done);
      });
    });
    describe('statics', function() {
      it('valid', function(done) {
        var C = app.collection('C');
        var M = C.model('M', {
          statics: {
            f: function() {
              return this
            }
          },
          attributes: ['attr']
        });
        internal.Model.install([M])
          .then(function() {
            assert.equal(M.f(), M);
            done();
          }).catch(done);
      });
      it('clash', function(done) {
        var C = app.collection('C');
        var staticMethod = function() {
          return 'a';
        };
        var M = C.model('M', {
          statics: {
            filter: staticMethod
          },
          attributes: ['attr']
        });
        internal.Model.install([M])
          .then(function() {
            assert.notEqual(M.filter(), 'a', 'Existing statics should not be replaced...');
            done();
          })
          .catch(done);
      });

    });
    describe('properties', function() {
      it('define properties', function(done) {
        var C = app.collection('C');
        var M = C.model('M', {
          properties: {
            prop: {
              get: function() {
                return 'a'
              }
            }
          },
          attributes: ['attr']
        });

        M.graph({
          attr: 1
        }).then(function(_m) {
          assert.equal(_m.prop, 'a');
          done();
        }).catch(done);
      });
      it('clash', function(done) {
        var C = app.collection('C');
        var M = C.model('M', {
          properties: {
            restore: {
              get: function() {
                return 'a'
              }
            }
          },
          attributes: ['attr']
        });

        M.graph({
          attr: 1
        }).then(function(_m) {
          assert.notEqual(_m.restore, 'a');
          done();
        }).catch(done);
      });

    });
  });


});
