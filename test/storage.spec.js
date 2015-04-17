var assert = require('chai').assert,
  internal = siesta._internal,
  Model = internal.Model;

describe.only('storage', function() {

  before(function() {
    siesta.ext.storageEnabled = true;
  });

  beforeEach(function(done) {
    siesta.reset(done);
  });

  describe('serialisation', function() {

    describe('attributes only', function() {
      var Collection, Car;

      beforeEach(function() {
        Collection = siesta.collection('myCollection');
        Car = Collection.model('Car', {
          attributes: ['colour', 'name']
        });
      });

      it('storage', function(done) {
        Car.graph({colour: 'black', name: 'bentley', id: 2})
          .then(function(car) {
            car._rev = '123'; //Fake pouchdb revision.
            var serialised = siesta.ext.storage._serialise(car);
            assert.equal(serialised.colour, 'black');
            assert.equal(serialised.name, 'bentley');
            assert.equal(serialised.id, 2);
            assert.equal(serialised._id, car.localId);
            assert.equal(serialised.collection, 'myCollection');
            assert.equal(serialised.model, 'Car');
            assert.equal(serialised._rev, car._rev);
            done();
          })
          .catch(done)
        ;
      });
    });

    describe('relationships', function() {
      var Collection, Car, Person;

      beforeEach(function() {
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
        Person = Collection.model('Person', {
          attributes: ['age', 'name']
        });
      });

      it('onetomany', function(done) {
        Person.graph({name: 'Michael', age: 24}).then(function(person) {
          Car.graph({colour: 'black', name: 'bentley', id: 2, owner: {localId: person.localId}})
            .then(function(car) {
              var serialisedCar = siesta.ext.storage._serialise(car);
              assert.equal(serialisedCar.colour, 'black');
              assert.equal(serialisedCar.name, 'bentley');
              assert.equal(serialisedCar.id, 2);
              assert.equal(serialisedCar._id, car.localId);
              assert.equal(serialisedCar.collection, 'myCollection');
              assert.equal(serialisedCar.owner, person.localId);
              assert.equal(serialisedCar.model, 'Car');
              var serialisedPerson = siesta.ext.storage._serialise(person);
              assert.equal(serialisedPerson.name, 'Michael');
              assert.equal(serialisedPerson.age, 24);
              assert.include(serialisedPerson.cars, car.localId);
              assert.equal(serialisedPerson.collection, 'myCollection');
              assert.equal(serialisedPerson.model, 'Person');
              done();
            })
            .catch(done)
          ;
        }).catch(done);

      });
    });

    describe('dates', function() {
      var Model, Collection;
      beforeEach(function() {
        Collection = siesta.collection('myCollection');
        Model = Collection.model('Model', {
          attributes: ['date', 'x']
        });
      });
      it('meta', function(done) {
        Model.graph({x: 1, date: new Date()})
          .then(function(car) {
            var serialised = siesta.ext.storage._serialise(car);
            console.log('serialised', serialised);
            var meta = serialised.siesta_meta;
            assert.ok(meta, 'should have a meta object');
            assert.equal(meta.dateFields.length, 1);
            assert.include(meta.dateFields, 'date');
            car.date = 2;
            serialised = siesta.ext.storage._serialise(car);
            meta = serialised.siesta_meta;
            assert.ok(meta, 'should  have a meta object');
            assert.equal(meta.dateFields.length, 0);
            done();
          }).catch(done);
      })

    });

  });

  describe('save', function() {
    var Collection, Car;

    beforeEach(function(done) {
      Collection = siesta.collection('myCollection');
      Car = Collection.model('Car', {
        attributes: ['colour', 'name']
      });
      Car.graph({colour: 'black', name: 'bentley', id: 2}).then(function() {
        done()
      }).catch(done);
    });

    it('new object', function(done) {
      assert.equal(1, siesta.ext.storage._unsavedObjects.length, 'Should be one car to save.');
      var car = siesta.ext.storage._unsavedObjects[0];
      siesta.save().then(function() {
        assert.equal(0, siesta.ext.storage._unsavedObjects.length, 'Should be no more cars');
        siesta.ext.storage._pouch.get(car.localId).then(function(carDoc) {
          assert.ok(carDoc);
          assert.equal(carDoc._id, car.localId, 'Should have same localId');
          assert.equal(carDoc._rev, car._rev, 'Should have same revision');
          assert.equal(carDoc.collection, 'myCollection');
          assert.equal(carDoc.model, 'Car');
          assert.equal(carDoc.colour, 'black');
          assert.equal(carDoc.name, 'bentley');
          assert.equal(carDoc.id, 2);
          done();
        }).catch(done);
      }).catch(done);
    });

    it('update object', function(done) {
      assert.equal(1, siesta.ext.storage._unsavedObjects.length, 'Should be one car to save.');
      var car = siesta.ext.storage._unsavedObjects[0];
      siesta.save().then(function() {
        assert.equal(0, siesta.ext.storage._unsavedObjects.length, 'Should be no more cars');
        car.colour = 'blue';
        siesta.save().then(function() {
          siesta.ext.storage._pouch.get(car.localId).then(function(carDoc) {
            assert.ok(carDoc);
            assert.equal(carDoc._id, car.localId, 'Should have same localId');
            assert.equal(carDoc._rev, car._rev, 'Should have same revision');
            assert.equal(carDoc.collection, 'myCollection');
            assert.equal(carDoc.model, 'Car');
            assert.equal(carDoc.colour, 'blue');
            assert.equal(carDoc.name, 'bentley');
            assert.equal(carDoc.id, 2);
            done();
          }).catch(done);
        }).catch(done);
      }).catch(done);
    });


    it('remove object', function(done) {
      var car = siesta.ext.storage._unsavedObjects[0];
      siesta.save().then(function() {
        car.remove()
          .then(function() {
            siesta.notify(function() {
              siesta.save().then(function() {
                siesta.ext.storage._pouch.get(car.localId).then(function() {
                  done('Should be deleted...');
                }).catch(function(e) {
                  assert.equal(e.status, 404);
                  done();
                });
              }).catch(done);
            });
          })
          .catch(done);

      }).catch(done);
    });

  });

  describe('load', function() {

    describe('attributes only', function() {
      var Collection, Car;

      beforeEach(function() {
        Collection = siesta.collection('myCollection');
        Car = Collection.model('Car', {
          attributes: ['colour', 'name']
        });
      });
      it('load attributes', function(done) {
        siesta.ext.storage._pouch.bulkDocs([
          {collection: 'myCollection', model: 'Car', colour: 'red', name: 'Aston Martin'},
          {collection: 'myCollection', model: 'Car', colour: 'black', name: 'Bentley'}
        ]).then(function() {
          assert.notOk(siesta.ext.storage._unsavedObjects.length, 'Notifications should be disabled');
          Car.all().then(function(cars) {
            assert.equal(cars.length, 2, 'Should have loaded the two cars');
            var redCar = _.filter(cars, function(x) {
                return x.colour == 'red'
              })[0],
              blackCar = _.filter(cars, function(x) {
                return x.colour == 'black'
              })[0];
            assert.equal(redCar.colour, 'red');
            assert.equal(redCar.name, 'Aston Martin');
            assert.ok(redCar._rev);
            assert.ok(redCar.localId);
            assert.equal(blackCar.colour, 'black');
            assert.equal(blackCar.name, 'Bentley');
            assert.ok(blackCar._rev);
            assert.ok(blackCar.localId);
            done();
          }).catch(done);
        }).catch(done);
      })
    });

    describe('relationships', function() {


      var Collection, Car, Person;

      describe('one-to-many', function() {
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
          Person = Collection.model('Person', {
            attributes: ['name', 'age']
          });

          siesta.ext.storage._pouch.bulkDocs([
            {
              collection: 'myCollection',
              model: 'Car',
              colour: 'red',
              name: 'Aston Martin',
              owner: 'xyz',
              _id: 'abc'
            },
            {
              collection: 'myCollection',
              model: 'Car',
              colour: 'black',
              name: 'Bentley',
              owner: 'xyz',
              _id: 'def'
            },
            {
              collection: 'myCollection',
              model: 'Person',
              name: 'Michael',
              age: 24,
              _id: 'xyz',
              cars: ['abc', 'def']
            }
          ]).then(function() {
            Model
              .install([Person, Car])
              .then(function() {
                assert.notOk(siesta.ext.storage._unsavedObjects.length, 'Notifications should be disabled');
                done();
              })
              .catch(done);
          }).catch(done);

        });

        it('cars', function(done) {
          Car.all().then(function(cars) {
            assert.equal(cars.length, 2, 'Should have loaded the two cars');
            var redCar = _.filter(cars, function(x) {
                return x.colour == 'red'
              })[0],
              blackCar = _.filter(cars, function(x) {
                return x.colour == 'black'
              })[0];
            assert.equal(redCar.colour, 'red');
            assert.equal(redCar.name, 'Aston Martin');
            assert.ok(redCar._rev);
            assert.ok(redCar.localId);
            assert.equal(blackCar.colour, 'black');
            assert.equal(blackCar.name, 'Bentley');
            assert.ok(blackCar._rev);
            assert.ok(blackCar.localId);
            assert.equal(redCar.owner.localId, 'xyz');
            assert.equal(blackCar.owner.localId, 'xyz');
            done();
          }).catch(done);

        });

        it('people', function(done) {
          Person.all().then(function(people) {
            assert.equal(people.length, 1, 'Should have loaded one person');
            var person = people[0];
            assert.equal(person.name, 'Michael');
            assert.equal(person.age, 24);
            assert.equal(person.cars.length, 2);
            assert.include(_.pluck(person.cars, 'localId'), 'abc');
            assert.include(_.pluck(person.cars, 'localId'), 'def');
            done();
          }).catch(done);
        });
      });

      it('manytomany', function(done) {
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
        Person = Collection.model('Person', {
          attributes: ['name', 'age']
        });

        siesta.ext.storage._pouch.bulkDocs([
          {
            collection: 'myCollection',
            model: 'Car',
            colour: 'red',
            name: 'Aston Martin',
            owners: ['xyz'],
            _id: 'abc'
          },
          {
            collection: 'myCollection',
            model: 'Car',
            colour: 'black',
            name: 'Bentley',
            owners: ['xyz'],
            _id: 'def'
          },
          {
            collection: 'myCollection',
            model: 'Person',
            name: 'Michael',
            age: 24,
            _id: 'xyz',
            cars: ['abc', 'def']
          },
          {
            collection: 'myCollection',
            model: 'Person',
            name: 'Bob',
            age: 24,
            _id: 'xyz',
            cars: ['abc']
          }
        ]).then(function() {
          Model
            .install([Person, Car])
            .then(function() {
              assert.notOk(siesta.ext.storage._unsavedObjects.length, 'Notifications should be disabled');
              Car.all().then(function(cars) {
                assert.equal(cars.length, 2, 'Should have loaded the two cars');
                var redCar = _.filter(cars, function(x) {
                    return x.colour == 'red'
                  })[0],
                  blackCar = _.filter(cars, function(x) {
                    return x.colour == 'black'
                  })[0];
                assert.equal(redCar.colour, 'red');
                assert.equal(redCar.name, 'Aston Martin');
                assert.ok(redCar._rev);
                assert.ok(redCar.localId);
                assert.equal(blackCar.colour, 'black');
                assert.equal(blackCar.name, 'Bentley');
                assert.ok(blackCar._rev);
                assert.ok(blackCar.localId);
                assert.include(_.pluck(redCar.owners, 'localId'), 'xyz');
                assert.include(_.pluck(blackCar.owners, 'localId'), 'xyz');
                done();
              }).catch(done);
            }).catch(done);
        }).catch(done);
      });

      it('onetoone', function(done) {
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
        Person = Collection.model('Person', {
          attributes: ['name', 'age']
        });

        siesta.ext.storage._pouch.bulkDocs([
          {
            collection: 'myCollection',
            model: 'Car',
            colour: 'red',
            name: 'Aston Martin',
            owner: 'xyz',
            _id: 'abc'
          },
          {
            collection: 'myCollection',
            model: 'Car',
            colour: 'black',
            name: 'Bentley',
            owner: 'xyz',
            _id: 'def'
          },
          {
            collection: 'myCollection',
            model: 'Person',
            name: 'Michael',
            age: 24,
            _id: 'xyz',
            car: 'def'
          }
        ]).then(function() {
          assert.notOk(siesta.ext.storage._unsavedObjects.length, 'Notifications should be disabled');
          Car.all().then(function(cars) {
            assert.equal(cars.length, 2, 'Should have loaded the two cars');
            var redCar = _.filter(cars, function(x) {
                return x.colour == 'red'
              })[0],
              blackCar = _.filter(cars, function(x) {
                return x.colour == 'black'
              })[0];
            assert.equal(redCar.colour, 'red');
            assert.equal(redCar.name, 'Aston Martin');
            assert.ok(redCar._rev);
            assert.ok(redCar.localId);
            assert.equal(blackCar.colour, 'black');
            assert.equal(blackCar.name, 'Bentley');
            assert.ok(blackCar._rev);
            assert.ok(blackCar.localId);
            assert.notOk(redCar.owner);
            assert.equal(blackCar.owner.localId, 'xyz');
            done();
          }).catch(done);
        }).catch(done);
      });

    });

    describe('load on install', function() {
      var collection, Car, Person;

      beforeEach(function(done) {

        collection = siesta.collection('myCollection');
        Car = collection.model('Car', {
          attributes: ['colour', 'name'],
          relationships: {
            owner: {
              model: 'Person',
              type: 'OneToMany',
              reverse: 'cars'
            }
          }
        });
        Person = collection.model('Person', {
          attributes: ['name', 'age']
        });

        siesta.ext.storage._pouch.bulkDocs([
          {
            collection: 'myCollection',
            model: 'Car',
            colour: 'red',
            name: 'Aston Martin',
            owner: 'xyz',
            _id: 'abc'
          },
          {
            collection: 'myCollection',
            model: 'Car',
            colour: 'black',
            name: 'Bentley',
            owner: 'xyz',
            _id: 'def'
          },
          {
            collection: 'myCollection',
            model: 'Person',
            name: 'Michael',
            age: 24,
            _id: 'xyz',
            cars: ['abc', 'def']
          }
        ]).then(function() {
          done();
        }).catch(done);

      });

      it('cars', function(done) {
        Car.all().then(function(cars) {
          assert.equal(cars.length, 2);
          done();
        }).catch(done);
      });

      it('people', function(done) {
        Person.all().then(function(people) {
          assert.equal(people.length, 1);
          done();
        }).catch(done);
      });

    });


  });

  describe('inspection', function() {
    var MyCollection, Car, Person, car, person, MyOtherModel, MyOtherCollection;
    beforeEach(function(done) {
      MyCollection = siesta.collection('MyCollection');
      MyOtherCollection = siesta.collection('MyOtherCollection');
      Car = MyCollection.model('Car', {
        attributes: ['colour', 'name']
      });
      Person = MyCollection.model('Person', {
        attributes: ['age', 'name']
      });
      MyOtherModel = MyOtherCollection.model('MyOtherModel', {
        attributes: ['attr']
      });
      Car.graph({colour: 'black', name: 'bentley', id: 2})
        .then(function(_car) {
          car = _car;
          Person.graph({name: 'Michael', age: 24})
            .then(function(_person) {
              person = _person;
              done();
            });
        }).catch(done);
    });

    it('global dirtyness', function(done) {
      assert.ok(siesta.dirty);
      siesta
        .save()
        .then(function() {
          assert.notOk(siesta.dirty);
          done();
        }).catch(done);
    });

    it('collection dirtyness', function(done) {
      assert.ok(MyCollection.dirty);
      siesta.save().then(function() {
        assert.notOk(MyCollection.dirty);
        MyOtherModel.graph({attr: 'xyz'})
          .then(function() {
            assert.notOk(MyCollection.dirty);
            assert.ok(MyOtherCollection.dirty);
            done();
          })
          .catch(done)
        ;
      }).catch(done);
    });

    it('model dirtyness', function(done) {
      assert.ok(Car.dirty);
      siesta.save().then(function() {
        assert.notOk(Car.dirty);
        person.name = 'bob';
        assert.ok(Person.dirty);
        assert.notOk(Car.dirty);
        done();
      }).catch(done);
    });

    it('model instance dirtyness', function(done) {
      assert.ok(car.dirty);
      siesta.save().then(function() {
        assert.notOk(car.dirty);
        person.name = 'bob';
        assert.ok(person.dirty);
        assert.notOk(car.dirty);
        done();
      }).catch(done);
    });


  });

  describe('singleton', function() {
    var Pomodoro, ColourConfig;

    describe('save', function() {

      beforeEach(function() {
        Pomodoro = siesta.collection('Pomodoro');
        ColourConfig = Pomodoro.model('ColourConfig', {
          attributes: ['primary', 'shortBreak', 'longBreak'],
          singleton: true
        });
      });

      function extracted(cb) {
        siesta.ext.storage._pouch.query(function(doc) {
          if (doc.model == 'ColourConfig') {
            emit(doc._id, doc);
          }
        }, {include_docs: true})
          .then(function(resp) {
            var rows = resp.rows;
            cb(null, rows);
          }).catch(cb);
      }

      it('repeated saves', function(done) {
        siesta.ext.storage._pouch.put({
          collection: 'Pomodoro',
          model: 'ColourConfig',
          primary: 'red',
          shortBreak: 'blue',
          longBreak: 'green',
          _id: 'xyz'
        }).then(function() {
          ColourConfig
            .one()
            .then(function(colourConfig) {
              extracted(function(err, rows) {
                if (!err) {
                  assert.equal(rows.length, 1, 'Should only ever be one row for singleton after the load');
                  assert.equal(colourConfig.primary, 'red');
                  assert.equal(colourConfig.shortBreak, 'blue');
                  assert.equal(colourConfig.longBreak, 'green');
                  siesta.save()
                    .then(function() {
                      extracted(function(err, rows) {
                        if (!err) {
                          assert.equal(rows.length, 1, 'Should only ever be one row for singleton after the save');
                          done();
                        }
                        else done(err);
                      });
                    }).catch(done);
                }
                else done(err);
              });
            }).catch(done)
        });
      });
    });



  });


  describe('saving and loading different data types', function() {
    var db;

    beforeEach(function() {
      db = siesta.ext.storage._pouch;
    });

    describe('date', function() {
      it('save', function(done) {
        var Collection = siesta.collection('MyCollection'),
          Model = Collection.model('myModel', {
            attributes: ['date']
          });
        Model.graph({date: new Date()})
          .then(function(m) {
            siesta.save().then(function() {
              db.get(m.localId).then(function(data) {
                assert.ok(typeof data.date == 'number');
                done();
              }).catch(done);
            }).catch(done);
          }).catch(done);
      });

      it('load', function(done) {
        db.bulkDocs([
          {
            collection: 'MyCollection',
            model: 'myModel',
            date: (new Date()).getTime(),
            siesta_meta: {dateFields: ['date']}
          }
        ], {include_docs: true}).then(function(objs) {
          db.get(objs[0].id).then(function(obj) {
            var Collection = siesta.collection('MyCollection'),
              Model = Collection.model('myModel', {
                attributes: ['date']
              });
            Model.one().then(function(m) {
              console.log('date', m.date);
              assert.ok(m.date instanceof Date, 'siesta should reload date objects correctly');
              done();
            }).catch(done);
          }).catch(done);
        }).catch(done);
      });
    });
  });

  describe('prevent duplicates', function() {
    it('it should be impossible to write down multiple objects to pouchdb that have the same remote id', function(done) {
      var Collection = siesta.collection('MyCollection'),
        Model = Collection.model('myModel', {
          id: '_id',
          attributes: ['name'],
          store: function(instance) {
            return instance.name;
          }
        });
      internal.Model.install([Model]).then(function () {
        var pouch = siesta.ext.storage._pouch;
        done();
      });
    })
  });

});
