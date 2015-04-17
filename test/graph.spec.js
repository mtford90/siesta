var assert = require('chai').assert,
    internal = siesta._internal,
    RelationshipType = siesta.RelationshipType,
    ModelInstance = internal.ModelInstance;

describe('perform mapping', function() {

  var Collection, Car, Person;

  before(function() {
    siesta.ext.storageEnabled = false;
  });

  beforeEach(function(done) {
    Collection = null;
    Car = null;
    Person = null;
    siesta.reset(done);
  });


  describe('attributes', function() {
    describe('default values', function() {
      it('simple', function(done) {
        var Collection = siesta.collection('Collection'),
            Model = Collection.model('Model', {
              id: 'id',
              attributes: [
                {
                  name: 'field1',
                  default: 1
                },
                {
                  name: 'field2',
                  default: 'xyz'
                },
                'field3'
              ]
            });
        Model.graph({field1: 5, field3: 'abc'})
            .then(function(p) {
              assert.equal(p.field1, 5);
              assert.equal(p.field2, 'xyz');
              assert.equal(p.field3, 'abc');
              done();
            })
            .catch(done);
      });

      it('false', function(done) {
        var Collection = siesta.collection('Collection'),
            Model = Collection.model('Model', {
              id: 'id',
              attributes: [
                {
                  name: 'field1',
                  default: false
                },
                'field2'
              ]
            });
        Model.graph({field2: 'abc'})
            .then(function(p) {
              assert(p.field1 === false, 'should be false');
              assert.equal(p.field2, 'abc');
              done();
            })
            .catch(done);
      });

      it('true', function(done) {
        var Collection = siesta.collection('Collection'),
            Model = Collection.model('Model', {
              id: 'id',
              attributes: [
                {
                  name: 'field1',
                  default: true
                },
                'field2'
              ]
            });
        Model.graph({field2: 'abc'})
            .then(function(p) {
              assert(p.field1 === true, 'should be true');
              assert.equal(p.field2, 'abc');
              done();
            })
            .catch(done);
      });

      it('null', function(done) {
        var Collection = siesta.collection('Collection'),
            Model = Collection.model('Model', {
              id: 'id',
              attributes: [
                {
                  name: 'field1',
                  default: null
                },
                'field2'
              ]
            });
        Model.graph({field2: 'abc'})
            .then(function(p) {
              assert(p.field1 === null);
              assert.equal(p.field2, 'abc');
              done();
            })
            .catch(done);
      });


      it('empty string', function(done) {
        var Collection = siesta.collection('Collection'),
            Model = Collection.model('Model', {
              id: 'id',
              attributes: [
                {
                  name: 'field1',
                  default: ''
                },
                'field2'
              ]
            });
        Model.graph({field2: 'abc'})
            .then(function(p) {
              assert(p.field1 == '');
              assert.equal(p.field2, 'abc');
              done();
            })
            .catch(done);
      });
    });
  });

  describe('empty', function() {
    beforeEach(function() {
      Collection = siesta.collection('myCollection');
      Car = Collection.model('Car', {
        id: 'id',
        attributes: ['colour', 'name']
      });
    });
    it('empty', function(done) {
      Car.graph({}).then(function(_obj) {
        assert.ok(_obj);
        done();
      }).catch(done);
    });
  });

  describe('no id', function() {
    beforeEach(function() {
      Collection = siesta.collection('myCollection');
      Car = Collection.model('Car', {
        id: 'id',
        attributes: ['colour', 'name']
      });
    });
    it('xyz', function(done) {
      var obj;
      Car.graph({
        colour: 'red',
        name: 'Aston Martin'
      }, function(err, _obj) {
        if (err) {
          done(err);
        } else {
          obj = _obj;
          done();
        }
      });
    })
  });

  describe('no relationships', function() {
    var obj;

    beforeEach(function(done) {
      Collection = siesta.collection('myCollection');
      Car = Collection.model('Car', {
        id: 'id',
        attributes: ['colour', 'name']
      });
      Car.graph({
        colour: 'red',
        name: 'Aston Martin',
        id: 'dfadf'
      }, function(err, _obj) {
        if (err) {
          done(err);
        }
        obj = _obj;
        done();
      });
    });

    describe('new', function() {

      it('returns a model', function() {
        assert.instanceOf(obj, ModelInstance);
      });

      it('has the right fields', function() {
        assert.equal(obj.colour, 'red');
        assert.equal(obj.name, 'Aston Martin');
        assert.equal(obj.id, 'dfadf');
        assert.ok(obj.localId);
      });
    });

    describe('existing in cache', function() {

      describe('via id', function() {
        var newObj;
        beforeEach(function(done) {
          Car.graph({
            colour: 'blue',
            id: 'dfadf'
          }, function(err, obj) {
            if (err) done(err);
            newObj = obj;
            done();
          });
        });

        it('should be mapped onto the old object', function() {
          assert.equal(newObj, obj);
        });

        it('should have the new colour', function() {
          assert.equal(newObj.colour, 'blue');
        });
      });

      describe('via localId', function() {
        var newObj;
        beforeEach(function(done) {
          Car.graph({
            colour: 'blue',
            localId: obj.localId
          }, function(err, obj) {
            if (err) done(err);
            newObj = obj;
            done();
          });
        });

        it('should be mapped onto the old object', function() {
          assert.equal(newObj, obj);
        });

        it('should have the new colour', function() {
          assert.equal(newObj.colour, 'blue');
        });
      });
    });
  });

  describe('with relationship', function() {
    describe('foreign key', function() {
      beforeEach(function(done) {
        Collection = siesta.collection('myCollection');
        Person = Collection.model('Person', {
          id: 'id',
          attributes: ['name', 'age']
        });
        Car = Collection.model('Car', {
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


      describe('remote id', function() {

        describe('forward', function() {
          describe('object that already exists', function() {
            var person, car;
            beforeEach(function(done) {
              Person.graph({
                name: 'Michael Ford',
                age: 23,
                id: 'personRemoteId'
              }, function(err, _person) {
                if (err) done(err);
                person = _person;
                Car.graph({
                  name: 'Bentley',
                  colour: 'black',
                  owner: 'personRemoteId',
                  id: 'carRemoteId'
                }, function(err, _car) {
                  if (err) {

                    done(err);
                  }
                  car = _car;
                  done();
                });
              });
            });

            it('owner of car should be michael', function(done) {
              assert.equal(car.owner, person);
              car.__proxies['owner'].get(function(err, owner) {
                if (err) done(err);
                assert.equal(owner, person);
                done();
              })
            });
            it('michael should own the car', function(done) {
              person.__proxies['cars'].get(function(err, cars) {
                if (err) done(err);
                assert.include(cars, car);
                done();
              });
            });
          });

          describe('remote id of an object that doesnt exist', function() {
            var car;
            beforeEach(function(done) {
              Car.graph({
                name: 'Bentley',
                colour: 'black',
                owner: 'personRemoteId',
                id: 'carRemoteId'
              }, function(err, _car) {

                if (err) done(err);
                car = _car;
                done();
              });
            });
            it('car should have a new owner and new owner should have a car', function(done) {
              car.__proxies['owner'].get(function(err, person) {
                if (err) done(err);
                assert.equal(person.id, 'personRemoteId');
                person.__proxies['cars'].get(function(err, cars) {
                  if (err) done(err);
                  assert.equal(cars.length, 1);
                  assert.include(cars, car);
                  done();
                });
              });
            })

          })
        });

        describe('reverse', function() {
          describe('remoteids of objects that already exist', function() {
            var person, cars;
            beforeEach(function(done) {
              var raw = [{
                colour: 'red',
                name: 'Aston Martin',
                id: 'remoteId1'
              }, {
                colour: 'blue',
                name: 'Lambo',
                id: "remoteId2"
              }, {
                colour: 'green',
                name: 'Ford',
                id: "remoteId3"
              }];
              Car._mapBulk(raw, {}, function(err, objs, res) {
                if (err) {
                  done(err);
                } else {
                  cars = objs;
                  Person.graph({
                    name: 'Michael Ford',
                    age: 23,
                    id: 'personRemoteId',
                    cars: ['remoteId1', 'remoteId2', 'remoteId3']
                  }, function(err, _person) {
                    if (err) {
                      done(err);
                    } else {
                      person = _person;
                      done();
                    }

                  });
                }

              });
            });

            it('cars should have person as their owner', function() {
              _.each(cars, function(car) {
                assert.equal(car.owner, person);
              })
            });

            it('person should have car objects', function() {
              _.each(cars, function(car) {
                assert.include(person.cars, car);
              })
            });
          });

          describe('remoteids of objects that dont exist', function() {
            var person;
            beforeEach(function(done) {
              Person.graph({
                name: 'Michael Ford',
                age: 23,
                id: 'personRemoteId',
                cars: ['remoteId1', 'remoteId2', 'remoteId3']
              }, function(err, _person) {
                if (err) done(err);
                person = _person;
                done();
              });
            });

            it('person has 3 new cars, and those cars are owned by the person', function(done) {
              person.__proxies['cars'].get(function(err, cars) {
                done(err);
                assert.equal(cars.length, 3);
                _.each(cars, function(car) {
                  assert.equal(car.owner, person);
                })
              });
            })
          });

          describe('mixture', function() {
            var person, cars;
            beforeEach(function(done) {
              var raw = [{
                colour: 'red',
                name: 'Aston Martin',
                id: 'remoteId1'
              }, {
                colour: 'green',
                name: 'Ford',
                id: "remoteId3"
              }];
              Car._mapBulk(raw, {}, function(err, objs, res) {
                if (err) done(err);
                cars = objs;
                Person.graph({
                  name: 'Michael Ford',
                  age: 23,
                  id: 'personRemoteId',
                  cars: ['remoteId1', 'remoteId2', 'remoteId3']
                }, function(err, _person) {
                  if (err) done(err);
                  person = _person;
                  done();
                });
              });
            });

            it('cars should have person as their owner', function() {
              _.each(cars, function(car) {
                assert.equal(car.owner, person);
              })
            });

            it('person should have car objects', function() {
              _.each(cars, function(car) {
                assert.include(person.cars, car);
              })
            });

            it('person has 3 new cars, and those cars are owned by the person', function(done) {
              person.__proxies['cars'].get(function(err, cars) {
                done(err);
                assert.equal(cars.length, 3);
                _.each(cars, function(car) {
                  assert.equal(car.owner, person);
                })
              });
            })


          })
        })

      });
      describe('object', function() {

        describe('forward', function() {
          var person, car;
          beforeEach(function(done) {
            Person.graph({
              name: 'Michael Ford',
              age: 23,
              id: 'personRemoteId'
            }, function(err, _person) {
              if (err) done(err);
              person = _person;
              Car.graph({
                name: 'Bentley',
                colour: 'black',
                owner: person,
                id: 'carRemoteId'
              }, function(err, _car) {
                if (err) done(err);
                car = _car;
                done();
              });
            });
          });
          it('owner of car should be michael', function(done) {
            car.__proxies['owner'].get(function(err, owner) {
              if (err) done(err);
              assert.equal(owner, person);
              done();
            })
          });
          it('michael should the car', function(done) {
            person.__proxies['cars'].get(function(err, cars) {
              if (err) done(err);
              assert.include(cars, car);
              done();
            });
          });
        });

        describe('reverse', function() {
          var person, cars;
          beforeEach(function(done) {
            var raw = [{
              colour: 'red',
              name: 'Aston Martin',
              id: 'remoteId1'
            }, {
              colour: 'blue',
              name: 'Lambo',
              id: "remoteId2"
            }, {
              colour: 'green',
              name: 'Ford',
              id: "remoteId3"
            }];
            Car._mapBulk(raw, {}, function(err, objs, res) {
              if (err) done(err);
              cars = objs;
              Person.graph({
                name: 'Michael Ford',
                age: 23,
                id: 'personRemoteId',
                cars: objs
              }, function(err, _person) {
                if (err) done(err);
                person = _person;
                done();
              });
            });
          });

          it('cars should have person as their owner', function() {
            _.each(cars, function(car) {
              assert.equal(car.owner, person);
            })
          });

          it('person should have car objects', function() {
            _.each(cars, function(car) {
              assert.include(person.cars, car);
            })
          });
        })

      });

      describe('local id within object', function() {
        describe('forward', function() {
          var person, car;
          beforeEach(function(done) {
            Person.graph({
              name: 'Michael Ford',
              age: 23,
              id: 'personRemoteId'
            }, function(err, _person) {
              if (err) done(err);
              person = _person;
              Car.graph({
                name: 'Bentley',
                colour: 'black',
                owner: {
                  localId: person.localId
                },
                id: 'carRemoteId'
              }, function(err, _car) {
                if (err) {

                  done(err);
                }
                car = _car;
                done();
              });
            });
          });
          it('owner of car should be michael', function(done) {
            car.__proxies['owner'].get(function(err, owner) {
              if (err) done(err);
              assert.equal(owner, person);
              done();
            })
          });
          it('michael should the car', function(done) {
            person.__proxies['cars'].get(function(err, cars) {
              if (err) done(err);
              assert.include(cars, car);
              done();
            });
          });
        });
        describe('reverse', function() {
          var person, cars;
          beforeEach(function(done) {
            var raw = [{
              colour: 'red',
              name: 'Aston Martin',
              id: 'remoteId1'
            }, {
              colour: 'blue',
              name: 'Lambo',
              id: "remoteId2"
            }, {
              colour: 'green',
              name: 'Ford',
              id: "remoteId3"
            }];
            Car._mapBulk(raw, {}, function(err, objs, res) {
              if (err) {

                done(err);
              } else {}
              cars = objs;
              Person.graph({
                name: 'Michael Ford',
                age: 23,
                id: 'personRemoteId',
                cars: _.map(cars, function(car) {
                  return {
                    localId: car.localId
                  }
                })
              }, function(err, _person) {
                if (err) {
                  done(err);
                } else {}
                person = _person;
                done();
              });
            });
          });

          it('cars should have person as their owner', function() {
            _.each(cars, function(car) {
              assert.equal(car.owner, person);
            })
          });

          it('person should have car objects', function() {
            _.each(cars, function(car) {
              assert.include(person.cars, car);
            })
          });
        })
      });

      describe('remote id within object', function() {

        describe('forward', function() {
          describe('object that already exists', function() {
            var person, car;
            beforeEach(function(done) {
              Person.graph({
                name: 'Michael Ford',
                age: 23,
                id: 'personRemoteId123'
              }, function(err, _person) {
                if (err) done(err);
                person = _person;
                Car.graph({
                  name: 'Bentley',
                  colour: 'black',
                  owner: {
                    id: 'personRemoteId123'
                  },
                  id: 'carRemoteId'
                }, function(err, _car) {
                  if (err) {
                    done(err);
                  }
                  car = _car;
                  done();
                });
              });
            });
            it('owner of car should be michael', function(done) {
              car.__proxies['owner'].get(function(err, owner) {
                if (err) done(err);
                assert.equal(owner, person);
                done();
              })
            });
            it('michael should the car', function(done) {
              person.__proxies['cars'].get(function(err, cars) {
                if (err) done(err);
                assert.include(cars, car);
                done();
              });
            });
          });

          describe('remote id of an object that doesnt exist', function() {
            var car;
            beforeEach(function(done) {
              Car.graph({
                name: 'Bentley',
                colour: 'black',
                owner: {
                  id: 'personRemoteId'
                },
                id: 'carRemoteId'
              }, function(err, _car) {
                if (err) done(err);
                car = _car;
                done();
              });
            });
            it('car should have a new owner and new owner should have a car', function(done) {
              car.__proxies['owner'].get(function(err, person) {
                if (err) done(err);
                assert.equal(person.id, 'personRemoteId');
                person.__proxies['cars'].get(function(err, cars) {
                  if (err) done(err);
                  assert.equal(cars.length, 1);
                  assert.include(cars, car);
                  done();
                });
              });
            })

          })
        });

        describe('reverse', function() {
          describe('remoteids of objects that already exist', function() {
            var person, cars;
            beforeEach(function(done) {
              var raw = [{
                colour: 'red',
                name: 'Aston Martin',
                id: 'remoteId1'
              }, {
                colour: 'blue',
                name: 'Lambo',
                id: "remoteId2"
              }, {
                colour: 'green',
                name: 'Ford',
                id: "remoteId3"
              }];
              Car._mapBulk(raw, {}, function(err, objs, res) {
                if (err) {

                  done(err);
                } else {

                }
                cars = objs;

                Person.graph({
                  name: 'Michael Ford',
                  age: 23,
                  id: 'personRemoteId',
                  cars: [{
                    id: 'remoteId1'
                  }, {
                    id: 'remoteId2'
                  }, {
                    id: 'remoteId3'
                  }]
                }, function(err, _person) {
                  if (err) {

                    done(err);
                  } else {

                  }
                  person = _person;
                  done();
                });
              });
            });

            it('cars should have person as their owner', function() {
              _.each(cars, function(car) {
                assert.equal(car.owner, person);
              })
            });

            it('person should have car objects', function() {
              _.each(cars, function(car) {
                assert.include(person.cars, car);
              })
            });
          });

          describe('remoteids of objects that dont exist', function() {
            var person;
            beforeEach(function(done) {
              Person.graph({
                name: 'Michael Ford',
                age: 23,
                id: 'personRemoteId',
                cars: [{
                  id: 'remoteId1'
                }, {
                  id: 'remoteId2'
                }, {
                  id: 'remoteId3'
                }]
              }, function(err, _person) {
                if (err) done(err);
                person = _person;
                done();
              });
            });

            it('person has 3 new cars, and those cars are owned by the person', function(done) {
              person.__proxies['cars'].get(function(err, cars) {
                done(err);
                assert.equal(cars.length, 3);
                _.each(cars, function(car) {
                  assert.equal(car.owner, person);
                })
              });
            })
          });

          describe('mixture', function() {
            var person, cars;
            beforeEach(function(done) {
              var raw = [{
                colour: 'red',
                name: 'Aston Martin',
                id: 'remoteId1'
              }, {
                colour: 'green',
                name: 'Ford',
                id: "remoteId3"
              }];
              Car._mapBulk(raw, {}, function(err, objs, res) {
                if (err) done(err);
                cars = objs;
                Person.graph({
                  name: 'Michael Ford',
                  age: 23,
                  id: 'personRemoteId',
                  cars: [{
                    id: 'remoteId1'
                  }, {
                    id: 'remoteId2'
                  }, {
                    id: 'remoteId3'
                  }]
                }, function(err, _person) {
                  if (err) done(err);
                  person = _person;
                  done();
                });
              });
            });

            it('cars should have person as their owner', function() {
              _.each(cars, function(car) {
                assert.equal(car.owner, person);
              })
            });

            it('person should have car objects', function() {
              _.each(cars, function(car) {
                assert.include(person.cars, car);
              })
            });

            it('person has 3 new cars, and those cars are owned by the person', function(done) {
              person.__proxies['cars'].get(function(err, cars) {
                done(err);
                assert.equal(cars.length, 3);
                _.each(cars, function(car) {
                  assert.equal(car.owner, person);
                })
              });
            })


          })
        })

      });
    });

    describe('one-to-one', function() {
      var personModel;
      beforeEach(function(done) {
        Collection = siesta.collection('myCollection');
        Person = Collection.model('Person', {
          id: 'id',
          attributes: ['name', 'age']
        });
        Car = Collection.model('Car', {
          id: 'id',
          attributes: ['colour', 'name'],
          relationships: {
            owner: {
              model: 'Person',
              type: RelationshipType.OneToOne,
              reverse: 'car'
            }
          }
        });
        done();


      });


      describe('remote id', function() {
        describe('forward', function() {
          describe('object that already exists', function() {
            var person, car;
            beforeEach(function(done) {
              Person.graph({
                name: 'Michael Ford',
                age: 23,
                id: 'personRemoteId'
              }, function(err, _person) {
                if (err) done(err);
                person = _person;
                Car.graph({
                  name: 'Bentley',
                  colour: 'black',
                  id: 'carRemoteId',
                  owner: 'personRemoteId'
                }, function(err, _car) {
                  if (err) {

                    done(err);
                  }
                  car = _car;

                  done();
                });
              });

            });
            it('owner of car should be michael', function(done) {
              car.__proxies['owner'].get(function(err, owner) {
                if (err) done(err);
                assert.equal(owner, person);
                done();
              })
            });
            it('michael should own the car', function(done) {
              person.__proxies['car'].get(function(err, personsCar) {
                if (err) done(err);
                assert.equal(car, personsCar);
                done();
              });
            });
          });
          describe('remote id of an object that doesnt exist', function() {
            var car;
            beforeEach(function(done) {
              Car.graph({
                name: 'Bentley',
                colour: 'black',
                owner: 'personRemoteId',
                id: 'carRemoteId'
              }, function(err, _car) {
                if (err) done(err);
                car = _car;
                done();
              });
            });
            it('car should have a new owner and new owner should have a car', function(done) {
              car.__proxies['owner'].get(function(err, person) {
                if (err) done(err);
                assert.equal(person.id, 'personRemoteId');
                person.__proxies['car'].get(function(err, personsCar) {
                  if (err) done(err);
                  assert.equal(personsCar, car);
                  done();
                });
              });
            })

          })
        });
        describe('reverse', function() {
          describe('object that already exists', function() {
            var person, car;
            beforeEach(function(done) {
              Car.graph({
                name: 'Bentley',
                colour: 'black',
                id: 'carRemoteId'
              }, function(err, _car) {
                if (err) {

                  done(err);
                }
                car = _car;
                Person.graph({
                  name: 'Michael Ford',
                  age: 23,
                  car: 'carRemoteId',
                  id: 'personRemoteId'
                }, function(err, _person) {
                  if (err) done(err);
                  person = _person;
                  done();
                });
              });
            });
            it('owner of car should be michael', function(done) {
              car.__proxies['owner'].get(function(err, owner) {
                if (err) done(err);
                assert.equal(owner, person);
                done();
              })
            });
            it('michael should own the car', function(done) {
              person.__proxies['car'].get(function(err, personsCar) {
                if (err) done(err);
                assert.equal(car, personsCar);
                done();
              });
            });
          });

          describe('remote id of an object that doesnt exist', function() {
            var car;
            beforeEach(function(done) {
              Car.graph({
                name: 'Bentley',
                colour: 'black',
                owner: 'personRemoteId',
                id: 'carRemoteId'
              }, function(err, _car) {
                if (err) done(err);
                car = _car;
                done();
              });
            });
            it('car should have a new owner and new owner should have a car', function(done) {
              car.__proxies['owner'].get(function(err, person) {
                if (err) done(err);
                assert.equal(person.id, 'personRemoteId');
                person.__proxies['car'].get(function(err, personsCar) {
                  if (err) done(err);
                  assert.equal(personsCar, car);
                  done();
                });
              });
            })

          })
        });
      });

      describe('remote id within object', function() {
        describe('forward', function() {
          describe('object that already exists', function() {
            var person, car;
            beforeEach(function(done) {
              Person.graph({
                name: 'Michael Ford',
                age: 23,
                id: 'personRemoteId'
              }, function(err, _person) {
                if (err) done(err);
                person = _person;
                Car.graph({
                  name: 'Bentley',
                  colour: 'black',
                  id: 'carRemoteId',
                  owner: {
                    id: 'personRemoteId'
                  }
                }, function(err, _car) {
                  if (err) {

                    done(err);
                  }
                  car = _car;

                  done();
                });
              });
            });
            it('owner of car should be michael', function(done) {
              car.__proxies['owner'].get(function(err, owner) {
                if (err) done(err);
                assert.equal(owner, person);
                done();
              })
            });
            it('michael should own the car', function(done) {
              person.__proxies['car'].get(function(err, personsCar) {
                if (err) done(err);
                assert.equal(car, personsCar);
                done();
              });
            });
          });

          describe('remote id of an object that doesnt exist', function() {
            var car;
            beforeEach(function(done) {
              Car.graph({
                name: 'Bentley',
                colour: 'black',
                owner: {
                  id: 'personRemoteId'
                },
                id: 'carRemoteId'
              }, function(err, _car) {
                if (err) done(err);
                car = _car;
                done();
              });
            });
            it('car should have a new owner and new owner should have a car', function(done) {
              car.__proxies['owner'].get(function(err, person) {
                if (err) done(err);
                assert.equal(person.id, 'personRemoteId');
                person.__proxies['car'].get(function(err, personsCar) {
                  if (err) done(err);
                  assert.equal(personsCar, car);
                  done();
                });
              });
            })

          })
        });
        describe('reverse', function() {
          describe('object that already exists', function() {
            var person, car;
            beforeEach(function(done) {
              Car.graph({
                name: 'Bentley',
                colour: 'black',
                id: 'carRemoteId'
              }, function(err, _car) {
                if (err) {

                  done(err);
                }
                car = _car;
                Person.graph({
                  name: 'Michael Ford',
                  age: 23,
                  car: {
                    id: 'carRemoteId'
                  },
                  id: 'personRemoteId'
                }, function(err, _person) {
                  if (err) done(err);
                  person = _person;
                  done();
                });
              });
            });
            it('owner of car should be michael', function(done) {
              car.__proxies['owner'].get(function(err, owner) {
                if (err) done(err);
                assert.equal(owner, person);
                done();
              })
            });
            it('michael should own the car', function(done) {
              person.__proxies['car'].get(function(err, personsCar) {
                if (err) done(err);
                assert.equal(car, personsCar);
                done();
              });
            });
          });

          describe('remote id of an object that doesnt exist', function() {
            var car;
            beforeEach(function(done) {
              Car.graph({
                name: 'Bentley',
                colour: 'black',
                owner: {
                  id: 'personRemoteId'
                },
                id: 'carRemoteId'
              }, function(err, _car) {
                if (err) done(err);
                car = _car;
                done();
              });
            });
            it('car should have a new owner and new owner should have a car', function(done) {
              car.__proxies['owner'].get(function(err, person) {
                if (err) done(err);
                assert.equal(person.id, 'personRemoteId');
                person.__proxies['car'].get(function(err, personsCar) {
                  if (err) done(err);
                  assert.equal(personsCar, car);
                  done();
                });
              });
            })

          })
        });
      });

      describe('localId within object', function() {
        describe('forward', function() {
          var person, car;
          beforeEach(function(done) {
            Person.graph({
              name: 'Michael Ford',
              age: 23,
              id: 'personRemoteId'
            }, function(err, _person) {
              if (err) done(err);
              person = _person;
              Car.graph({
                name: 'Bentley',
                colour: 'black',
                id: 'carRemoteId',
                owner: {
                  localId: person.localId
                }
              }, function(err, _car) {
                if (err) {

                  done(err);
                }
                car = _car;

                done();
              });
            });
          });
          it('owner of car should be michael', function(done) {
            car.__proxies['owner'].get(function(err, owner) {
              if (err) done(err);
              assert.equal(owner, person);
              done();
            })
          });
          it('michael should own the car', function(done) {
            person.__proxies['car'].get(function(err, personsCar) {
              if (err) done(err);
              assert.equal(car, personsCar);
              done();
            });
          });
        });
        describe('reverse', function() {
          var person, car;
          beforeEach(function(done) {
            Car.graph({
              name: 'Bentley',
              colour: 'black',
              id: 'carRemoteId'
            }, function(err, _car) {
              if (err) {

                done(err);
              }
              car = _car;
              Person.graph({
                name: 'Michael Ford',
                age: 23,
                car: {
                  localId: car.localId
                },
                id: 'personRemoteId'
              }, function(err, _person) {
                if (err) done(err);
                person = _person;
                done();
              });
            });
          });
          it('owner of car should be michael', function(done) {
            car.__proxies['owner'].get(function(err, owner) {
              if (err) done(err);
              assert.equal(owner, person);
              done();
            })
          });
          it('michael should own the car', function(done) {
            person.__proxies['car'].get(function(err, personsCar) {
              if (err) done(err);
              assert.equal(car, personsCar);
              done();
            });
          });

        });
      });

      describe('object', function() {
        describe('forward', function() {
          var person, car;
          beforeEach(function(done) {
            Person.graph({
              name: 'Michael Ford',
              age: 23,
              id: 'personRemoteId'
            }, function(err, _person) {
              if (err) done(err);
              person = _person;
              Car.graph({
                name: 'Bentley',
                colour: 'black',
                id: 'carRemoteId',
                owner: person
              }, function(err, _car) {
                if (err) {

                  done(err);
                }
                car = _car;
                done();
              });
            });
          });
          it('owner of car should be michael', function(done) {
            car.__proxies['owner'].get(function(err, owner) {
              if (err) done(err);
              assert.equal(owner, person);
              done();
            })
          });
          it('michael should own the car', function(done) {
            person.__proxies['car'].get(function(err, personsCar) {
              if (err) done(err);
              assert.equal(car, personsCar);
              done();
            });
          });
        });
        describe('reverse', function() {
          var person, car;
          beforeEach(function(done) {
            Car.graph({
              name: 'Bentley',
              colour: 'black',
              id: 'carRemoteId'
            }, function(err, _car) {
              if (err) {

                done(err);
              }
              car = _car;
              Person.graph({
                name: 'Michael Ford',
                age: 23,
                car: car,
                id: 'personRemoteId'
              }, function(err, _person) {
                if (err) done(err);
                person = _person;
                done();
              });
            });
          });
          it('owner of car should be michael', function(done) {
            car.__proxies['owner'].get(function(err, owner) {
              if (err) done(err);
              assert.equal(owner, person);
              done();
            })
          });
          it('michael should own the car', function(done) {
            person.__proxies['car'].get(function(err, personsCar) {
              if (err) done(err);
              assert.equal(car, personsCar);
              done();
            });
          });

        });
      });
    });
  });

  describe('caveats', function() {
    beforeEach(function() {
      Collection = siesta.collection('myCollection');
      Car = Collection.model('Car', {
        id: 'id',
        attributes: ['colour', 'name']
      });
    });

    it('mapping an attribute that doesnt exist', function(done) {
      Car.graph({
        colour: 'red',
        name: 'aston martin',
        extraneous: 'blah'
      }, function(err, car) {
        if (err) done(err);
        assert.notOk(car.extraneous);
        done();
      });
    });

  });

  describe('errors', function() {
    describe('one-to-one', function() {
      beforeEach(function() {
        Collection = siesta.collection('myCollection');
        Person = Collection.model('Person', {
          id: 'id',
          attributes: ['name', 'age']
        });
        Car = Collection.model('Car', {
          id: 'id',
          attributes: ['colour', 'name'],
          relationships: {
            owner: {
              model: 'Person',
              type: RelationshipType.OneToOne,
              reverse: 'car'
            }
          }
        });
      });

      it('assign array to scalar relationship', function(done) {
        Car.graph({
          colour: 'red',
          name: 'Aston Martin',
          owner: ['remoteId1', 'remoteId2'],
          id: 'carRemoteId'
        }, function(err, obj) {
          console.log('err', err);
          var ownerError = err.owner;
          assert.ok(ownerError);
          done();
        });
      });

      it('assign array to scalar relationship reverse', function(done) {
        Person.graph({
          name: 'Michael Ford',
          car: ['remoteId1', 'remoteId2'],
          age: 23,
          id: 'personRemoteId'
        }, function(err, obj) {
          assert.ok(err.car);
          done();
        });
      });


    });
    describe('foreign key', function() {

      beforeEach(function() {
        Collection = siesta.collection('myCollection');
        Person = Collection.model('Person', {
          id: 'id',
          attributes: ['name', 'age']
        });
        Car = Collection.model('Car', {
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
      });

      it('assign array to scalar relationship', function(done) {
        Car.graph({
          colour: 'red',
          name: 'Aston Martin',
          owner: ['remoteId1', 'remoteId2'],
          id: 'carRemoteId'
        }, function(err) {
          var ownerError = err.owner;
          assert.ok(ownerError);
          done();
        });
      });

      it('assign scalar to vector relationship reverse', function(done) {
        Person.graph({
          name: 'Michael Ford',
          cars: 'remoteId1',
          age: 23,
          id: 'personRemoteId'
        }, function(err, obj) {
          assert.ok(err.cars);
          done();
        });
      });


    });
  });

  describe('bulk', function() {
    describe('new', function() {
      describe('no relationships', function() {
        beforeEach(function(done) {
          Collection = siesta.collection('myCollection');
          Car = Collection.model('Car', {
            id: 'id',
            attributes: ['colour', 'name']
          });
          done();
        });

        it('all valid', function(done) {
          var raw = [{
            colour: 'red',
            name: 'Aston Martin',
            id: 'remoteId1sdfsdfdsfgsdf'
          }, {
            colour: 'blue',
            name: 'Lambo',
            id: "remoteId2dfgdfgdfg"
          }, {
            colour: 'green',
            name: 'Ford',
            id: "remoteId3dfgdfgdfgdfg"
          }];
          Car._mapBulk(raw, {}, function(err, objs) {
            if (err) done(err);
            assert.equal(objs.length, raw.length);
            assert.equal(objs[0].colour, 'red');
            assert.equal(objs[1].colour, 'blue');
            assert.equal(objs[2].colour, 'green');
            done();
          })
        });
      });
      describe('foreign key', function() {
        var personModel;

        beforeEach(function(done) {
          Collection = siesta.collection('myCollection');
          Person = Collection.model('Person', {
            id: 'id',
            attributes: ['name', 'age']
          });
          Car = Collection.model('Car', {
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

        it('same owner using _mapBulk', function(done) {
          var ownerId = 'ownerId462345345';
          var raw = [{
            colour: 'red',
            name: 'Aston Martin',
            id: 'remoteId1',
            owner: ownerId
          }, {
            colour: 'blue',
            name: 'Lambo',
            id: "remoteId2",
            owner: ownerId
          }, {
            colour: 'green',
            name: 'Ford',
            id: "remoteId3",
            owner: ownerId
          }];
          Car._mapBulk(raw, {}, function(err, objs) {
            if (err) done(err);
            assert.equal(objs.length, raw.length);
            assert.equal(objs[0].owner, objs[1].owner);
            assert.equal(objs[1].owner, objs[2].owner);
            done();
          })
        });

        it('same owner using map', function(done) {
          var ownerId = 'ownerId!!!334';
          var carRaw1 = {
            colour: 'red',
            name: 'Aston Martin',
            id: 'remoteId1',
            owner: ownerId
          };
          var carRaw2 = {
            colour: 'blue',
            name: 'Lambo',
            id: "remoteId2",
            owner: ownerId
          };
          Car.graph(carRaw1, function(err, car1) {
            if (err) {
              done(err);
            } else {
              Car.graph(carRaw2, function(err, car2) {
                if (err) done(err);
                assert.equal(car1.owner, car2.owner);
                done();
              })
            }
          });
        })
      })
    });

    describe('faulted relationships', function() {
      var cars;

      var personModel;

      beforeEach(function(done) {
        Collection = siesta.collection('myCollection');
        Person = Collection.model('Person', {
          id: 'id',
          attributes: ['name', 'age']
        });
        Car = Collection.model('Car', {
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


      describe('via remote id', function() {
        beforeEach(function(done) {
          Person.graph({
            name: 'Michael Ford',
            age: 23,
            id: 'personRemoteId'
          }, function(err) {
            if (err) done(err);
            var raw = [{
              colour: 'red',
              name: 'Aston Martin',
              id: 'remoteId1',
              owner: 'personRemoteId'
            }, {
              colour: 'blue',
              name: 'Lambo',
              id: "remoteId2",
              owner: 'personRemoteId'
            }, {
              colour: 'green',
              name: 'Ford',
              id: "remoteId3",
              owner: 'personRemoteId'
            }];
            Car._mapBulk(raw, {}, function(err, objs, res) {
              if (err) {
                done(err);
              }
              cars = objs;
              done();
            });

          });
        });

        it('should have mapped onto Michael', function() {
          assert.equal(cars.length, 3);
          assert.equal(cars[0].owner, cars[1].owner);
          assert.equal(cars[1].owner, cars[2].owner);
        });

      });


      describe('bulk bulk', function() {
        beforeEach(function(done) {
          cars = [];
          Person.graph({
            name: 'Michael Ford',
            age: 23,
            id: 'personRemoteId'
          }, function(err) {
            if (err) done(err);
            var raw1 = [{
              colour: 'red',
              name: 'Aston Martin',
              id: 'remoteId1',
              owner: 'personRemoteId'
            }, {
              colour: 'blue',
              name: 'Lambo',
              id: "remoteId2",
              owner: 'personRemoteId'
            }, {
              colour: 'green',
              name: 'Ford',
              id: "remoteId3",
              owner: 'personRemoteId'
            }];
            Car._mapBulk(raw1, {}, function(err, objs, res) {
              if (err) {
                done(err);
              }
              _.each(objs, function(o) {
                cars.push(o);
              });
              if (cars.length == 9) {
                done();
              }
            });
            var raw2 = [{
              colour: 'red',
              name: 'Peauget',
              id: 'remoteId4',
              owner: 'personRemoteId'
            }, {
              colour: 'blue',
              name: 'Chevy',
              id: "remoteId5",
              owner: 'personRemoteId'
            }, {
              colour: 'green',
              name: 'Ford',
              id: "remoteId6",
              owner: 'personRemoteId'
            }];
            Car._mapBulk(raw2, {}, function(err, objs, res) {
              if (err) {
                done(err);
              }
              _.each(objs, function(o) {
                cars.push(o);
              });
              if (cars.length == 9) {
                done();
              }
            });
            var raw3 = [{
              colour: 'red',
              name: 'Ferarri',
              id: 'remoteId7',
              owner: 'personRemoteId'
            }, {
              colour: 'blue',
              name: 'Volvo',
              id: "remoteId8",
              owner: 'personRemoteId'
            }, {
              colour: 'green',
              name: 'Dodge',
              id: "remoteId9",
              owner: 'personRemoteId'
            }];
            Car._mapBulk(raw3, {}, function(err, objs, res) {
              if (err) {
                done(err);
              }
              _.each(objs, function(o) {
                cars.push(o);
              });
              if (cars.length == 9) {
                done();
              }
            });

          });
        });

        it('should have mapped onto Michael', function() {
          assert.equal(cars.length, 9);
          for (var i = 0; i < 8; i++) {
            assert.equal(cars[i].owner, cars[i + 1].owner);
          }
        });

      });

      describe('via nested remote id', function() {
        beforeEach(function(done) {
          Person.graph({
            name: 'Michael Ford',
            age: 23,
            id: 'personRemoteId'
          }, function(err) {
            if (err) done(err);
            var raw = [{
              colour: 'red',
              name: 'Aston Martin',
              id: 'remoteId1',
              owner: {
                id: 'personRemoteId'
              }
            }, {
              colour: 'blue',
              name: 'Lambo',
              id: "remoteId2",
              owner: {
                id: 'personRemoteId'
              }
            }, {
              colour: 'green',
              name: 'Ford',
              id: "remoteId3",
              owner: {
                id: 'personRemoteId'
              }
            }];
            Car._mapBulk(raw, {}, function(err, objs, res) {
              if (err) {
                done(err);
              }
              cars = objs;
              done();
            });

          });
        });

        it('should have mapped onto Michael', function() {
          assert.equal(cars.length, 3);
          assert.equal(cars[0].owner, cars[1].owner);
          assert.equal(cars[1].owner, cars[2].owner);
        });

      });

      describe('via nested remote id with unmergedChanges', function() {
        this.timeout(5000);
        beforeEach(function(done) {
          Person.graph({
            name: 'Michael Ford',
            age: 23,
            id: 'personRemoteId'
          }, function(err) {
            if (err) done(err);
            var raw = [{
              colour: 'red',
              name: 'Aston Martin',
              id: 'remoteId1',
              owner: {
                id: 'personRemoteId'
              }
            }, {
              colour: 'blue',
              name: 'Lambo',
              id: "remoteId2",
              owner: {
                id: 'personRemoteId',
                name: 'Bob'
              }
            }, {
              colour: 'green',
              name: 'Ford',
              id: "remoteId3",
              owner: {
                id: 'personRemoteId'
              }
            }];
            Car._mapBulk(raw, {}, function(err, objs, res) {
              if (err) {
                done(err);
              }
              cars = objs;
              done();
            });

          });
        });

        it('should have mapped onto Michael', function() {
          assert.equal(cars.length, 3);
          assert.equal(cars[0].owner, cars[1].owner);
          assert.equal(cars[1].owner, cars[2].owner);
        });
        it('should have changed the name', function() {
          assert.equal(cars[0].owner.name, 'Bob');
          assert.equal(cars[1].owner.name, 'Bob');
          assert.equal(cars[2].owner.name, 'Bob');
        });

      })

    });


  });

  describe('higher level mapping', function() {

    describe('collection level', function() {
      var Collection, PersonModel, CarModel;

      beforeEach(function(done) {
        siesta.reset(function() {
          Collection = siesta.collection('myCollection');
          PersonModel = Collection.model('Person', {
            id: 'id',
            attributes: ['name', 'age']
          });
          CarModel = Collection.model('Car', {
            id: 'id',
            attributes: ['colour']
          });
          done();
        });
      });
      it('map singles', function(done) {
        Collection.graph({
          Car: {colour: 'red', id: 5}
        }).then(function(results) {
          var carResult = results.Car;
          assert.equal(carResult.colour, 'red');
          done();
        }).catch(done);
      });

      it('map multiples', function(done) {
        Collection.graph({
          Car: [{colour: 'red', id: 5}, {colour: 'blue', id: 6}]
        }).then(function(results) {
          var carResults = results.Car;
          assert.equal(carResults.length, 2);
          done();
        }).catch(done);
      });

      it('map multiple types', function(done) {
        Collection.graph({
          Car: [{colour: 'red', id: 5}, {colour: 'blue', id: 6}],
          Person: {name: 'Mike', age: 24}
        }).then(function(results) {
          var carResults = results.Car,
              personResults = results.Person;
          assert.equal(carResults.length, 2);
          assert.equal(personResults.name, 'Mike');
          done();
        }).catch(done);
      });

      it('invalid model', function(done) {
        Collection.graph({
          Car: [{colour: 'red', id: 5}, {colour: 'blue', id: 6}],
          Invalid: {name: 'Mike', age: 24}
        }).then(function() {
          done('Should not have succeeeded');
        }).catch(function(err) {
          assert.equal(err.invalidModelName, 'Invalid');
          assert.ok(err);
          done();
        });
      });
    });

    describe('siesta level', function() {
      var Collection, PersonModel, CarModel, OtherCollection, OtherModel;


      beforeEach(function(done) {
        siesta.reset(function() {
          Collection = siesta.collection('Collection');
          PersonModel = Collection.model('Person', {
            id: 'id',
            attributes: ['name', 'age']
          });
          CarModel = Collection.model('Car', {
            id: 'id',
            attributes: ['colour']
          });
          OtherCollection = siesta.collection('OtherCollection');
          OtherModel = OtherCollection.model('Other', {
            attributes: ['attr']
          });
          done();
        });
      });

      it('map single collection & model', function(done) {
        siesta.graph({
          Collection: {
            Car: {colour: 'red', id: 5}
          }
        }).then(function(results) {
          var carResult = results.Collection.Car;
          assert.equal(carResult.colour, 'red');
          done();
        }).catch(done);
      });

      it('map array', function(done) {
        siesta.graph({
          Collection: {
            Car: [{colour: 'red', id: 5}, {colour: 'blue', id: 6}]
          }
        }).then(function(results) {
          var carResults = results.Collection.Car;
          assert.equal(carResults.length, 2);
          done();
        }).catch(done);
      });

      it('map multiple models', function(done) {
        siesta.graph({
          Collection: {
            Car: [{colour: 'red', id: 5}, {colour: 'blue', id: 6}],
            Person: {name: 'Mike', age: 24}
          }
        }).then(function(results) {
          var carResults = results.Collection.Car,
              personResults = results.Collection.Person;
          assert.equal(carResults.length, 2);
          assert.equal(personResults.name, 'Mike');
          done();
        }).catch(done);
      });

      it('map multiple collections', function(done) {
        siesta.graph({
          Collection: {
            Car: [{colour: 'red', id: 5}, {colour: 'blue', id: 6}],
            Person: {name: 'Mike', age: 24}
          },
          OtherCollection: {
            Other: {attr: 1}
          }
        }).then(function(results) {
          var carResults = results.Collection.Car,
              personResults = results.Collection.Person,
              otherResults = results.OtherCollection.Other;
          assert.equal(carResults.length, 2);
          assert.equal(personResults.name, 'Mike');
          assert.equal(otherResults.attr, 1);
          done();
        }).catch(done);
      });

      it('invalid model', function(done) {
        siesta.graph({
          Collection: {
            Car: [{colour: 'red', id: 5}, {colour: 'blue', id: 6}],
            Invalid: {name: 'Mike', age: 24}
          }
        }).then(function() {
          done('Should not have succeeeded');
        }).catch(function(err) {
          assert.equal(err.length, 1);
          err = err[0];
          assert.equal(err.invalidModelName, 'Invalid');
          assert.ok(err);
          done();
        });
      });

      it('invalid collection', function(done) {
        siesta.graph({
          Invalid: {
            Car: [{colour: 'red', id: 5}, {colour: 'blue', id: 6}],
            Person: {name: 'Mike', age: 24}
          }
        }).then(function() {
          done('Should not have succeeeded');
        }).catch(function(err) {
          assert.equal(err.invalidCollectionName, 'Invalid');
          assert.ok(err);
          done();
        });
      });
    });

  });
});