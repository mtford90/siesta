var assert = require('chai').assert;

describe('Subclass', function() {
  var Collection, Car, SportsCar;

  before(function() {
    siesta.ext.storageEnabled = false;
  });

  beforeEach(function(done) {
    siesta.reset(done);
  });

  describe('hierarchy', function() {
    beforeEach(function(done) {
      Collection = siesta.collection('myCollection');

      Car = Collection.model('Car', {
        id: 'id',
        attributes: ['colour', 'name']
      });
      SportsCar = Car.child('SportsCar', {
        attributes: ['maxSpeed']
      });

      siesta.install(done);
    });

    it('children', function() {
      assert.include(Car.children, SportsCar, 'Child should be added to children array');
    });

    it('parent', function() {
      assert.equal(SportsCar.parent, Car, 'Parent should be assigned');
    });

  });

  describe('attributes', function() {
    beforeEach(function(done) {
      Collection = siesta.collection('myCollection');

      Car = Collection.model('Car', {
        id: 'id',
        attributes: ['colour', 'name']
      });
      SportsCar = Car.child('SportsCar', {
        attributes: ['maxSpeed']
      });

      siesta.install(done);
    });

    it('child attributes', function() {
      assert.include(SportsCar._attributeNames, 'maxSpeed');
      assert.include(SportsCar._attributeNames, 'colour');
      assert.include(SportsCar._attributeNames, 'name');
    });

    it('parent attributes', function() {
      assert.notInclude(Car._attributeNames, 'maxSpeed');
      assert.include(Car._attributeNames, 'colour');
      assert.include(Car._attributeNames, 'name');
    });
  });

  describe('relationships', function() {
    var Collection, Car, SportsCar, Person;

    var mike;

    describe('names', function() {
      beforeEach(function(done) {
        Collection = siesta.collection('myCollection');
        Car = Collection.model('Car', {
          attributes: ['colour', 'name'],
          relationships: {
            owner: {
              model: 'Person',
              type: 'OneToMany',
              reverse: 'cars'
            }
          }
        });
        SportsCar = Car.child('SportsCar', {
          attributes: ['maxSpeed']
        });
        Person = Collection.model('Person', {
          attributes: ['age', 'name']
        });

        siesta.install(done);
      });
      it('child attributes', function() {
        assert.include(SportsCar._relationshipNames, 'owner');
      });

      it('parent attributes', function() {
        assert.include(Car._relationshipNames, 'owner');
      });

    });

    describe('relationship types', function() {

      describe('OneToMany', function() {
        beforeEach(function(done) {
          siesta.reset(function() {
            Collection = siesta.collection('myCollection');
            Car = Collection.model('Car', {
              attributes: ['colour', 'name'],
              relationships: {
                owner: {
                  model: 'Person',
                  type: 'OneToMany',
                  reverse: 'cars'
                }
              }
            });
            SportsCar = Car.child('SportsCar', {
              attributes: ['maxSpeed']
            });
            Person = Collection.model('Person', {
              attributes: ['age', 'name']
            });

            Person.graph({age: 24, name: 'Mike'}).then(function(_mike) {
              mike = _mike;
              Car.graph({colour: 'red', name: 'Aston Martin', owner: {localId: mike.localId}})
                .then(SportsCar.graph({
                  colour: 'yellow',
                  name: 'Lamborghini',
                  maxSpeed: 160,
                  owner: {localId: mike.localId}
                }))
                .then(function() {
                  done();
                })
                .catch(done)
              ;
            });
          });


        });

        it('same relationship', function() {
          assert.ok(mike);
          assert.equal(mike.cars.length, 2);
          var car = _.filter(mike.cars, function(x) {return x.model == Car})[0],
            sportsCar = _.filter(mike.cars, function(x) {return x.model == SportsCar})[0];
          assert.ok(car);
          assert.ok(sportsCar);
          assert.equal(car.owner, mike);
          assert.equal(sportsCar.owner, mike);
        });
      });

      describe('OneToOne', function() {
        beforeEach(function(done) {
          siesta.reset(function() {
            Collection = siesta.collection('myCollection');
            Car = Collection.model('Car', {
              attributes: ['colour', 'name'],
              relationships: {
                owner: {
                  model: 'Person',
                  type: 'OneToOne',
                  reverse: 'car'
                }
              }
            });
            SportsCar = Car.child('SportsCar', {
              attributes: ['maxSpeed']
            });
            Person = Collection.model('Person', {
              attributes: ['age', 'name']
            });

            Person.graph({age: 24, name: 'Mike'}).then(function(_mike) {
              mike = _mike;
              Car.graph({colour: 'red', name: 'Aston Martin', owner: {localId: mike.localId}})
                .then(SportsCar.graph({
                  colour: 'yellow',
                  name: 'Lamborghini',
                  maxSpeed: 160,
                  owner: {localId: mike.localId}
                }))
                .then(function() {
                  done();
                })
                .catch(done)
              ;
            });
          });


        });

        it('same relationship', function(done) {
          assert.ok(mike);
          assert.ok(mike.car.isInstanceOf(SportsCar));
          assert.equal(mike.car.owner, mike);
          Car.all().then(function(cars) {
            var car = _.filter(cars, function(x) {return x.model == Car})[0],
              sportsCar = _.filter(cars, function(x) {return x.model == SportsCar})[0];
            assert.ok(car);
            assert.ok(sportsCar);
            assert.notOk(car.owner, 'The plain car should no longer have an owner');
            done();
          });
        });
      });

      describe('ManyToMany', function() {
        beforeEach(function(done) {
          siesta.reset(function() {
            Collection = siesta.collection('myCollection');
            Car = Collection.model('Car', {
              attributes: ['colour', 'name'],
              relationships: {
                owners: {
                  model: 'Person',
                  type: 'ManyToMany',
                  reverse: 'cars'
                }
              }
            });
            SportsCar = Car.child('SportsCar', {
              attributes: ['maxSpeed']
            });
            Person = Collection.model('Person', {
              attributes: ['age', 'name']
            });

            Person.graph({age: 24, name: 'Mike'}).then(function(_mike) {
              mike = _mike;
              Car.graph({colour: 'red', name: 'Aston Martin', owners: [{localId: mike.localId}]})
                .then(SportsCar.graph({
                  colour: 'yellow',
                  name: 'Lamborghini',
                  maxSpeed: 160,
                  owners: [{localId: mike.localId}]
                }))
                .then(function() {
                  done();
                })
                .catch(done)
              ;
            })
          });

        });

        it('same relationship', function() {
          assert.ok(mike);
          assert.equal(mike.cars.length, 2);
          var car = _.filter(mike.cars, function(x) {return x.model == Car})[0],
            sportsCar = _.filter(mike.cars, function(x) {return x.model == SportsCar})[0];
          assert.ok(car);
          assert.ok(sportsCar);
          assert.include(car.owners, mike);
          assert.include(sportsCar.owners, mike);
        });
      });


    });


  });

  describe('methods', function() {
    var Collection, Car, SportsCar;
    beforeEach(function(done) {
      siesta.reset(function() {
        Collection = siesta.collection('myCollection');
        Car = Collection.model('Car', {
          attributes: ['x'],
          methods: {
            aMethod: function() {
              return 'a';
            }
          }
        });
        SportsCar = Car.child('SportsCar', {
          attributes: ['y'],
          methods: {
            anotherMethod: function() {
              return 'b';
            }
          }
        });
        siesta.install(done);
      });
    });

    it('parent method available on parent', function(done) {
      Car.graph({x: 1}).then(function(c) {
        assert.equal(c.aMethod(), 'a');
        done();
      }).catch(done);
    });

    it('child method not available on parent', function(done) {
      Car.graph({x: 1}).then(function(c) {
        assert.notOk(c.anotherMethod);
        done();
      }).catch(done);
    });

    it('parent method available on child', function(done) {
      SportsCar.graph({x: 1, y: 2}).then(function(c) {
        assert.equal(c.aMethod(), 'a');
        done();
      }).catch(done);
    });

    it('the childs other method is available', function(done) {
      SportsCar.graph({x: 1, y: 2}).then(function(c) {
        assert.equal(c.anotherMethod(), 'b');
        done();
      }).catch(done);
    });
  });

  describe('statics', function() {
    var Collection, Car, SportsCar;
    beforeEach(function(done) {
      siesta.reset(function() {
        Collection = siesta.collection('myCollection');
        Car = Collection.model('Car', {
          attributes: ['x'],
          statics: {
            aStaticMethod: function() {
              return 'a';
            }
          }
        });
        SportsCar = Car.child('SportsCar', {
          attributes: ['y'],
          statics: {
            anotherStaticMethod: function() {
              return 'b';
            }
          }
        });
        siesta.install(done);
      });
    });

    it('parent static available on parent', function() {
      assert.equal(Car.aStaticMethod(), 'a');
    });


    it('child static not available on parent', function() {
      assert.notOk(Car.anotherStaticMethod);
    });


    it('child static available', function() {
      assert.equal(SportsCar.anotherStaticMethod(), 'b');
    });

    it('parents static available on child', function() {
      assert.equal(SportsCar.aStaticMethod(), 'a');
    });
  });

  describe('id', function() {

    it('inherits', function(done) {
      Collection = siesta.collection('myCollection');
      Car = Collection.model('Car', {
        id: 'blah'
      });
      SportsCar = Car.child('SportsCar', {});
      siesta.install(function() {
        assert.equal(Car.id, 'blah');
        assert.equal(SportsCar.id, 'blah');
        done();
      });
    });

    it('overrides', function(done) {
      Collection = siesta.collection('myCollection');
      Car = Collection.model('Car', {
        id: 'blah'
      });
      SportsCar = Car.child('SportsCar', {
        id: 'blah2'
      });
      siesta.install(function() {
        assert.equal(Car.id, 'blah');
        assert.equal(SportsCar.id, 'blah2');
        done();
      });
    });

  });

  describe('properties', function() {
    beforeEach(function(done) {
      Collection = siesta.collection('myCollection');

      Car = Collection.model('Car', {
        attributes: ['x'],
        properties: {
          parent: {
            get: function() {
              return 'a';
            }
          }
        }
      });
      SportsCar = Car.child('SportsCar', {
        attributes: ['y'],
        properties: {
          child: {
            get: function() {
              return 'b';
            }
          }
        }
      });

      siesta.install(done);
    });

    it('parent property should be available on parent', function(done) {
      Car.graph({x: 1})
        .then(function(c) {
          assert.equal(c.parent, 'a');
          done();
        })
        .catch(done);
    });

    it('child property should not be available on parent', function(done) {
      Car.graph({x: 1})
        .then(function(c) {
          assert.notOk(c.child);
          done();
        })
        .catch(done);
    });

    it('parent property should be available on child', function(done) {
      SportsCar.graph({x: 1})
        .then(function(c) {
          assert.equal(c.parent, 'a');
          done();
        })
        .catch(done);
    });

    it('child property should be available on child', function(done) {
      SportsCar.graph({x: 1})
        .then(function(c) {
          assert.equal(c.child, 'b');
          done();
        })
        .catch(done);
    });
  });

  describe('init', function() {
    var Collection, Car, SportsCar;

    it('parent init inherited by child', function() {
      Collection = siesta.collection('myCollection');
      Car = Collection.model('Car', {
        init: function(fromStorage) {
          assert.notOk(fromStorage);
          return 'a';
        }
      });
      SportsCar = Car.child('SportsCar', {});
      siesta.install(function() {
        assert.equal(Car.init(), 'a');
        assert.equal(SportsCar.init(), 'a');
      });
    });

    it('parent init overriden by child', function() {
      Collection = siesta.collection('myCollection');
      Car = Collection.model('Car', {
        init: function(fromStorage) {
          assert.notOk(fromStorage);
          return 'a';
        }
      });
      SportsCar = Car.child('SportsCar', {
        init: function(fromStorage) {
          assert.notOk(fromStorage);
          return 'b';
        }
      });
      siesta.install(function() {
        assert.equal(Car.init(), 'a');
        assert.equal(SportsCar.init(), 'b');
      });
    });

  });

  describe('remove', function() {
    var Collection, Car, SportsCar;

    it('parent remove inherited by child', function() {
      Collection = siesta.collection('myCollection');
      Car = Collection.model('Car', {
        remove: function() {
          return 'a';
        }
      });
      SportsCar = Car.child('SportsCar', {});
      siesta.install(function() {
        assert.equal(Car.remove(), 'a');
        assert.equal(SportsCar.remove(), 'a');
      });
    });

    it('parent remove overriden by child', function() {
      Collection = siesta.collection('myCollection');
      Car = Collection.model('Car', {
        remove: function() {
          return 'a';
        }
      });
      SportsCar = Car.child('SportsCar', {
        remove: function() {
          return 'b';
        }
      });
      siesta.install(function() {
        assert.equal(Car.remove(), 'a');
        assert.equal(SportsCar.remove(), 'b');
      });
    });

  });


  describe('serialise', function() {
    var Collection, Car, SportsCar;

    it('parent serialise inherited by child', function(done) {
      Collection = siesta.collection('myCollection');
      Car = Collection.model('Car', {
        attributes: ['x'],
        serialise: function(model) {
          return 'a';
        }
      });
      SportsCar = Car.child('SportsCar', {
        attributes: ['y']
      });
      SportsCar.graph({})
        .then(function(c) {
          assert.equal(c.serialise(), 'a');
          done();
        }, done);
    });

    it('parent serialise overriden by child', function(done) {
      Collection = siesta.collection('myCollection');
      Car = Collection.model('Car', {
        attributes: ['x'],
        serialise: function(model) {
          return 'a';
        }
      });
      SportsCar = Car.child('SportsCar', {
        attributes: ['y'],
        serialise: function(model) {
          return 'b';
        }
      });
      SportsCar.graph({})
        .then(function(c) {
          assert.equal(c.serialise(), 'b');
          done();
        }, done);
    });
  });

  describe('serialiseField', function() {
    var Collection, Car, SportsCar;

    it('parent serialiseField inherited by child', function(done) {
      Collection = siesta.collection('myCollection');
      Car = Collection.model('Car', {
        attributes: ['x'],
        serialiseField: function(field, value) {
          if (field == 'x') {
            return 'a';
          }
        }
      });
      SportsCar = Car.child('SportsCar', {
        attributes: ['y']
      });
      SportsCar.graph({})
        .then(function(c) {
          assert.equal(c.serialise().x, 'a');
          done();
        }, done);
    });

    it('parent serialiseField overriden by child', function(done) {
      Collection = siesta.collection('myCollection');
      Car = Collection.model('Car', {
        attributes: ['x'],
        serialiseField: function(field, value) {
          if (field == 'x') {
            return 'a';
          }
        }
      });
      SportsCar = Car.child('SportsCar', {
        attributes: ['y'],
        serialiseField: function(field, value) {
          if (field == 'x') {
            return 'b';
          }
        }
      });
      SportsCar.graph({})
        .then(function(c) {
          assert.equal(c.serialise().x, 'b');
          done();
        }, done);
    });
  });

  describe('parseAttribute', function() {
    var Collection, Car, SportsCar;

    it('parent parseAttribute inherited by child', function(done) {
      Collection = siesta.collection('myCollection');
      Car = Collection.model('Car', {
        attributes: ['x'],
        parseAttribute: function(field, value) {
          if (field == 'x') {
            return 'a';
          }
          return value;
        }
      });
      SportsCar = Car.child('SportsCar', {
        attributes: ['y']
      });
      SportsCar.graph({x: 1})
        .then(function(c) {
          assert.equal(c.x, 'a');
          done();
        }, done);
    });

    it('parent parseAttribute overriden by child', function(done) {
      Collection = siesta.collection('myCollection');
      Car = Collection.model('Car', {
        attributes: ['x'],
        parseAttribute: function(field, value) {
          if (field == 'x') {
            return 'a';
          }
          return value;
        }
      });
      SportsCar = Car.child('SportsCar', {
        attributes: ['y'],
        parseAttribute: function(field, value) {
          if (field == 'x') {
            return 'b';
          }
          return value;
        }
      });
      SportsCar.graph({x: 1})
        .then(function(c) {
          assert.equal(c.x, 'b');
          done();
        }, done);
    });
  });


  describe('query', function() {
    var collection, Car, SportsCar, SuperCar;

    beforeEach(function(done) {
      siesta.reset(function() {
        collection = siesta.collection('myCollection');

        Car = collection.model('Car', {
          id: 'id',
          attributes: ['colour', 'name']
        });
        SportsCar = Car.child('SportsCar', {
          attributes: ['maxSpeed']
        });
        SuperCar = SportsCar.child('SuperCar', {
          attributes: ['attr']
        });

        Car.graph({colour: 'red', name: 'Aston Martin'})
          .then(function() {
            SportsCar.graph({colour: 'blue', maxSpeed: 160, name: 'Lamborghini'})
              .then(function() {
                SuperCar.graph({colour: 'blue', maxSpeed: 160, name: 'Lamborghini', attr: 5})
                  .then(function() {
                    done();
                  })
                  .catch(done);
              })
              .catch(done);
          })
          .catch(done);

      });

    });

    it('parent query', function(done) {
      Car.all()
        .then(function(cars) {
          assert.equal(cars.length, 3, 'All descends should be returned');
          done();
        })
        .catch(done)
      ;
    });

    it('middle query', function(done) {
      SportsCar.all()
        .then(function(cars) {
          assert.equal(cars.length, 2, 'Sports cars and super cars should be returned');
          done();
        })
        .catch(done)
      ;
    });

    it('child query', function(done) {
      SuperCar.all()
        .then(function(cars) {
          assert.equal(cars.length, 1, 'Only the supercar should be returned');
          done();
        })
        .catch(done)
      ;
    });


  });

  describe('inspection', function() {

    var collection, Car, SportsCar, Person, SuperCar;

    beforeEach(function(done) {
      siesta.reset(function() {
        collection = siesta.collection('myCollection');
        Car = collection.model('Car', {
          id: 'id',
          attributes: ['colour', 'name']
        });
        SportsCar = Car.child('SportsCar', {
          attributes: ['maxSpeed']
        });
        Person = collection.model('Person', {
          attributes: ['name']
        });
        SuperCar = SportsCar.child('SuperCar', {
          attributes: ['attr']
        });

        siesta.install(done);
      });
    });

    it('isChildOf', function() {
      assert.ok(SportsCar.isChildOf(Car));
      assert.ok(SuperCar.isChildOf(SportsCar));
      assert.notOk(SportsCar.isChildOf(Person));
      assert.notOk(Car.isChildOf(SportsCar));
      assert.notOk(SuperCar.isChildOf(Car));
    });

    it('isParentOf', function() {
      assert.ok(Car.isParentOf(SportsCar));
      assert.ok(SportsCar.isParentOf(SuperCar));
      assert.notOk(Car.isParentOf(SuperCar));
      assert.notOk(Car.isParentOf(Person));
      assert.notOk(SportsCar.isParentOf(Car));
      assert.notOk(SportsCar.isParentOf(Person));
    });

    it('isDescendantOf', function() {
      assert.ok(SportsCar.isDescendantOf(Car));
      assert.ok(SuperCar.isDescendantOf(SportsCar));
      assert.ok(SuperCar.isDescendantOf(Car));
      assert.notOk(Car.isDescendantOf(SuperCar));
      assert.notOk(Person.isDescendantOf(Car));
    });

    it('isAncestorOf', function() {
      assert.ok(Car.isAncestorOf(SportsCar));
      assert.ok(Car.isAncestorOf(SuperCar));
      assert.ok(SportsCar.isAncestorOf(SuperCar));
      assert.notOk(SuperCar.isAncestorOf(SportsCar));
      assert.notOk(SuperCar.isAncestorOf(Person));
    });

    it('isInstanceOf', function(done) {
      SuperCar.graph({colour: 'red', name: 'lamborghini', attr: 1})
        .then(function(car) {
          assert.ok(car.isInstanceOf(SuperCar));
          assert.notOk(car.isInstanceOf(SportsCar));
          assert.notOk(car.isInstanceOf(Car));
          assert.notOk(car.isInstanceOf(Person));
          done();
        })
        .catch(done)
      ;
    });

    it('isA', function(done) {
      SuperCar.graph({colour: 'red', name: 'lamborghini', attr: 1})
        .then(function(car) {
          assert.ok(car.isA(SuperCar));
          assert.ok(car.isA(SportsCar));
          assert.ok(car.isA(Car));
          assert.notOk(car.isInstanceOf(Person));
          done();
        })
        .catch(done)
      ;
    });


  })


});