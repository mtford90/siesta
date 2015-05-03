var assert = require('chai').assert,
  internal = siesta.lib,
  Model = internal.Model,
  SiestaUserError = internal.error.SiestaUserError,
  createFilterSet = internal.filterSet,
  Filter = internal.Filter;

describe('filter...', function() {
  var app = siesta.app('filter');
  before(function() {
    app.storage = false;
  });
  beforeEach(function(done) {
    app.reset(done);
  });

  describe('basic', function() {
    var Collection, Mapping;

    beforeEach(function() {
      Collection = app.collection('myCollection');
      Mapping = Collection.model('Person', {
        id: 'id',
        attributes: ['name', 'age']
      });
    });
    it('object exists', function(done) {
      Mapping.graph({
        name: 'Michael',
        age: 15
      }, function(err, obj) {
        if (err) done(err);
        else {
          assert.ok(obj);
          var q = new Filter(Mapping, {
            age: 15
          });
          q.execute(function(err, objs) {
            if (err) done(err);
            assert.equal(objs.length, 1);
            assert.equal(objs[0], obj);
            done();
          });
        }
      });
    });

    it('object does not exist', function(done) {
      Mapping.graph({
        name: 'Michael',
        age: 21
      }, function(err, obj) {
        if (err) done(err);
        else {
          assert.ok(obj);
          var q = new Filter(Mapping, {
            age: 15
          });
          q.execute(function(err, objs) {
            if (err) done(err);
            assert.equal(objs.length, 0);
            done();
          });
        }
      });
    });

    it('multiple matches', function(done) {
      Mapping.graph([
        {
          name: 'Michael',
          age: 21
        },
        {
          name: 'Bob',
          age: 21
        }
      ], function(err, mapped) {
        if (err) done(err);
        else {
          assert.ok(mapped);
          var q = new Filter(Mapping, {
            age: 21
          });
          q.execute(function(err, objs) {
            if (err) done(err);
            assert.equal(objs.length, 2);
            assert.include(objs, mapped[0]);
            assert.include(objs, mapped[1]);
            done();
          });
        }
      });
    });
  });

  describe('built-in comparators', function() {

    describe('e', function() {
      var collection, Person, Car;

      beforeEach(function() {
        collection = app.collection('myCollection');
        Person = collection.model('Person', {
          id: 'id',
          attributes: ['name', 'age']
        });
        Car = collection.model('Car', {
          id: 'id',
          attributes: ['colour', 'name'],
          relationships: {
            owner: {
              type: 'OneToMany',
              model: 'Person',
              reverse: 'cars'
            }
          }
        });
      });

      describe('attributes', function() {
        it('matches', function(done) {
          Person.graph([
            {
              name: 'Michael',
              age: 21
            },
            {
              name: 'Bob',
              age: 21
            }
          ], function(err, mapped) {
            if (err) done(err);
            else {
              assert.ok(mapped);
              var q = new Filter(Person, {
                age__e: 21
              });
              q.execute(function(err, objs) {
                if (err) done(err);
                assert.equal(objs.length, 2);
                assert.include(objs, mapped[0]);
                assert.include(objs, mapped[1]);
                done();
              });
            }
          });
        });

        it('no matches', function(done) {
          Person.graph([
            {
              name: 'Michael',
              age: 21
            },
            {
              name: 'Bob',
              age: 21
            }
          ], function(err, mapped) {
            if (err) done(err);
            else {
              assert.ok(mapped);
              var q = new Filter(Person, {
                age__e: 23
              });
              q.execute(function(err, objs) {
                if (err) done(err);
                assert.notOk(objs.length);
                done();
              });
            }
          });
        });
      });

      describe('relationships', function() {
        it('model', function(done) {
          Person.graph({
            name: 'Michael',
            age: 21
          }, function(err, person) {
            assert.ok(person, 'should return a person');
            if (err) done(err);
            Car.graph({
              colour: 'red',
              name: 'Aston Martin',
              owner: person
            }, function(err, car) {
              if (err) done(err);
              else {
                assert.equal(car.owner, person);
                var q = new Filter(Car, {
                  owner__e: person
                });
                q.execute().then(function(objs) {
                  assert.ok(objs.length);
                  done();
                }).catch(done);
              }
            });
          });
        });
      });
    });

    describe('ne', function() {
      var collection, Person, Car;

      beforeEach(function() {
        collection = app.collection('myCollection');
        Person = collection.model('Person', {
          id: 'id',
          attributes: ['name', 'age']
        });
        Car = collection.model('Car', {
          id: 'id',
          attributes: ['colour', 'name'],
          relationships: {
            owner: {
              type: 'OneToMany',
              model: 'Person',
              reverse: 'cars'
            }
          }
        });
      });

      describe('attributes', function() {
        it('matches', function(done) {
          Person.graph([
            {
              name: 'Michael',
              age: 21
            },
            {
              name: 'Bob',
              age: 22
            }
          ], function(err, mapped) {
            if (err) done(err);
            else {
              assert.ok(mapped);
              var q = new Filter(Person, {
                age__ne: 21
              });
              q.execute(function(err, objs) {
                if (err) done(err);
                assert.equal(objs.length, 1);
                assert.include(objs, mapped[1]);
                done();
              });
            }
          });
        });

        it('no matches', function(done) {
          Person.graph([
            {
              name: 'Michael',
              age: 21
            },
            {
              name: 'Bob',
              age: 21
            }
          ], function(err, mapped) {
            if (err) done(err);
            else {
              assert.ok(mapped);
              var q = new Filter(Person, {
                age__ne: 21
              });
              q.execute(function(err, objs) {
                if (err) done(err);
                assert.notOk(objs.length);
                done();
              });
            }
          });
        });
      });

      describe('relationships', function() {
        it('model', function(done) {
          Person.graph([{
            name: 'Michael',
            age: 21
          }, {
            name: 'John',
            age: 22
          }], function(err, people) {
            if (err) done(err);
            else {
              var michael = people[0];
              var john = people[1];
              Car.graph([{
                colour: 'red',
                name: 'Aston Martin',
                owner: michael
              }, {
                colour: 'blue',
                name: 'Lamby',
                owner: john
              }], function(err, car) {
                if (err) done(err);
                else {
                  var q = new Filter(Car, {
                    owner__ne: michael
                  });
                  q.execute().then(function(objs) {
                    assert.equal(objs.length, 1);
                    var car = objs[0];
                    assert.equal(car.owner, john);
                    done();
                  }).catch(done);
                }
              });
            }
          });
        });
      });
    });

    describe('lt', function() {
      var Collection, Person;

      beforeEach(function() {
        Collection = app.collection('myCollection');
        Person = Collection.model('Person', {
          id: 'id',
          attributes: ['name', 'age']
        });
      });

      it('null shouldnt match', function(done) {
        Person.graph([
          {
            name: 'Michael',
            age: null
          },
          {
            name: 'Bob',
            age: 21
          }
        ], function(err, mapped) {
          if (err) done(err);
          else {
            assert.ok(mapped);
            var q = new Filter(Person, {
              age__lt: 22
            });
            q.execute(function(err, objs) {
              if (err) done(err);
              assert.equal(objs.length, 1);
              assert.include(objs, mapped[1]);
              done();
            });
          }
        });
      });

      it('undefined shouldnt match', function(done) {
        Person.graph([
          {
            name: 'Michael',
            age: undefined
          },
          {
            name: 'Bob',
            age: 21
          }
        ], function(err, mapped) {
          if (err) done(err);
          else {
            assert.ok(mapped);
            var q = new Filter(Person, {
              age__lt: 22
            });
            q.execute(function(err, objs) {
              if (err) done(err);
              assert.equal(objs.length, 1);
              assert.include(objs, mapped[1]);
              done();
            });
          }
        });
      });

      it('matches all', function(done) {
        Person.graph([
          {
            name: 'Michael',
            age: 21
          },
          {
            name: 'Bob',
            age: 21
          }
        ], function(err, mapped) {
          if (err) done(err);
          else {
            assert.ok(mapped);
            var q = new Filter(Person, {
              age__lt: 22
            });
            q.execute(function(err, objs) {
              if (err) done(err);
              assert.equal(objs.length, 2);
              assert.include(objs, mapped[0]);
              assert.include(objs, mapped[1]);
              done();
            });
          }
        });
      });

      it('matches some', function(done) {
        Person.graph([
          {
            name: 'Michael',
            age: 21
          },
          {
            name: 'Bob',
            age: 22
          }
        ], function(err, mapped) {
          if (err) done(err);
          else {
            assert.ok(mapped);
            var q = new Filter(Person, {
              age__lt: 22
            });
            q.execute(function(err, objs) {
              if (err) done(err);
              assert.equal(objs.length, 1);
              assert.include(objs, mapped[0]);
              done();
            });
          }
        });
      });

      it('no matches', function(done) {
        Person.graph([
          {
            name: 'Michael',
            age: 21
          },
          {
            name: 'Bob',
            age: 21
          }
        ], function(err, mapped) {
          if (err) done(err);
          else {
            assert.ok(mapped);
            var q = new Filter(Person, {
              age__lt: 21
            });
            q.execute(function(err, objs) {
              if (err) done(err);
              assert.notOk(objs.length);
              done();
            });
          }
        });
      });
    });

    describe('lte', function() {
      var collection, Person;

      beforeEach(function() {
        collection = app.collection('myCollection');
        Person = collection.model('Person', {
          id: 'id',
          attributes: ['name', 'age']
        });
      });

      it('matches all', function(done) {
        Person.graph([
          {
            name: 'Michael',
            age: 21
          },
          {
            name: 'Bob',
            age: 21
          }
        ], function(err, mapped) {
          if (err) done(err);
          else {
            assert.ok(mapped);
            var q = new Filter(Person, {
              age__lte: 21
            });
            q.execute(function(err, objs) {
              if (err) done(err);
              assert.equal(objs.length, 2);
              assert.include(objs, mapped[0]);
              assert.include(objs, mapped[1]);
              done();
            });
          }
        });
      });

      it('matches some', function(done) {
        Person.graph([
          {
            name: 'Michael',
            age: 21
          },
          {
            name: 'Bob',
            age: 22
          },
          {
            name: 'John',
            age: 23
          }
        ], function(err, mapped) {
          if (err) done(err);
          else {
            assert.ok(mapped);
            var q = new Filter(Person, {
              age__lte: 22
            });
            q.execute(function(err, objs) {
              if (err) done(err);
              assert.equal(objs.length, 2);
              assert.include(objs, mapped[0]);
              assert.include(objs, mapped[1]);
              done();
            });
          }
        });
      });

      it('no matches', function(done) {
        Person.graph([
          {
            name: 'Michael',
            age: 21
          },
          {
            name: 'Bob',
            age: 21
          }
        ], function(err, mapped) {
          if (err) done(err);
          else {
            assert.ok(mapped);
            var q = new Filter(Person, {
              age__lte: 20
            });
            q.execute(function(err, objs) {
              if (err) done(err);
              assert.notOk(objs.length);
              done();
            });
          }
        });
      });
    });

    describe('gt', function() {
      var collection, Person;

      beforeEach(function() {
        collection = app.collection('myCollection');
        Person = collection.model('Person', {
          id: 'id',
          attributes: ['name', 'age']
        });
      });

      it('matches all', function(done) {
        Person.graph([
          {
            name: 'Michael',
            age: 21
          },
          {
            name: 'Bob',
            age: 21
          }
        ], function(err, mapped) {
          if (err) done(err);
          else {
            assert.ok(mapped);
            var q = new Filter(Person, {
              age__gt: 20
            });
            q.execute(function(err, objs) {
              if (err) done(err);
              assert.equal(objs.length, 2);
              assert.include(objs, mapped[0]);
              assert.include(objs, mapped[1]);
              done();
            });
          }
        });
      });

      it('matches some', function(done) {
        Person.graph([
          {
            name: 'Michael',
            age: 21
          },
          {
            name: 'Bob',
            age: 22
          },
          {
            name: 'John',
            age: 23
          }
        ], function(err, mapped) {
          if (err) done(err);
          else {
            assert.ok(mapped);
            var q = new Filter(Person, {
              age__gt: 21
            });
            q.execute(function(err, objs) {
              if (err) done(err);
              assert.equal(objs.length, 2);
              assert.include(objs, mapped[1]);
              assert.include(objs, mapped[2]);
              done();
            });
          }
        });
      });

      it('no matches', function(done) {
        Person.graph([
          {
            name: 'Michael',
            age: 21
          },
          {
            name: 'Bob',
            age: 21
          }
        ], function(err, mapped) {
          if (err) done(err);
          else {
            assert.ok(mapped);
            var q = new Filter(Person, {
              age__gt: 21
            });
            q.execute(function(err, objs) {
              if (err) done(err);
              assert.notOk(objs.length);
              done();
            });
          }
        });
      });
    });

    describe('gte', function() {
      var Collection, Person;

      beforeEach(function() {
        Collection = app.collection('myCollection');
        Person = Collection.model('Person', {
          id: 'id',
          attributes: ['name', 'age']
        });
      });

      it('matches all', function(done) {
        Person.graph([
          {
            name: 'Michael',
            age: 21
          },
          {
            name: 'Bob',
            age: 21
          }
        ], function(err, mapped) {
          if (err) done(err);
          else {
            assert.ok(mapped);
            var q = new Filter(Person, {
              age__gte: 21
            });
            q.execute(function(err, objs) {
              if (err) done(err);
              assert.equal(objs.length, 2);
              assert.include(objs, mapped[0]);
              assert.include(objs, mapped[1]);
              done();
            });
          }
        });
      });

      it('matches some', function(done) {
        Person.graph([
          {
            name: 'Michael',
            age: 21
          },
          {
            name: 'Bob',
            age: 22
          },
          {
            name: 'John',
            age: 23
          }
        ], function(err, mapped) {
          if (err) done(err);
          else {
            assert.ok(mapped);
            var q = new Filter(Person, {
              age__gte: 22
            });
            q.execute(function(err, objs) {
              if (err) done(err);
              assert.equal(objs.length, 2);
              assert.include(objs, mapped[1]);
              assert.include(objs, mapped[2]);
              done();
            });
          }
        });
      });

      it('no matches', function(done) {
        Person.graph([
          {
            name: 'Michael',
            age: 21
          },
          {
            name: 'Bob',
            age: 21
          }
        ], function(err, mapped) {
          if (err) done(err);
          else {
            assert.ok(mapped);
            var q = new Filter(Person, {
              age__gte: 22
            });
            q.execute(function(err, objs) {
              if (err) done(err);
              assert.notOk(objs.length);
              done();
            });
          }
        });
      });
    });

    describe('contains', function() {
      var Collection, Model;
      beforeEach(function(done) {
        app.reset(function() {
          Collection = app.collection('myCollection');
          Model = Collection.model('Person', {
            attributes: ['name']
          });
          done();
        });
      });
      it('string contains', function(done) {
        Model.graph([
          {name: 'aaaabb'},
          {name: '111122'},
          {name: '4343bb'}
        ]).then(function() {
          Model.filter({name__contains: 'bb'}).then(function(res) {
            assert.equal(res.length, 2);
            res.forEach(function(m) {
              assert(m.name.indexOf('bb') > -1, 'All contain');
            });
            done();
          }).catch(done);
        }).catch(done);
      });
      it('array contains', function(done) {
        Model.graph([
          {name: [1, 2, 3]},
          {name: [4, 5, 6]},
          {name: [3, 4, 5]}
        ]).then(function() {
          Model.filter({name__contains: 3}).then(function(res) {
            assert.equal(res.length, 2);
            res.forEach(function(m) {
              assert(m.name.indexOf(3) > -1, 'All contain');
            });
            done();
          }).catch(done);
        }).catch(done);
      });

    });


    describe('errors', function() {
      var Collection, Person, Car;
      beforeEach(function() {
        Collection = app.collection('myCollection');
        Person = Collection.model('Person', {
          id: 'id',
          attributes: ['name', 'age']
        });
        Car = Collection.model('Car', {
          id: 'id',
          attributes: ['colour', 'name'],
          relationships: {
            owner: {
              type: 'OneToMany',
              model: 'Person',
              reverse: 'cars'
            }
          }
        });
      });

      it('invalid op', function(done) {
        Person.graph([
          {
            name: 'Michael',
            age: 21
          },
          {
            name: 'Bob',
            age: 21
          }
        ], function(err, mapped) {
          if (err) done(err);
          else {
            assert.ok(mapped);
            var q = new Filter(Person, {
              age__dfsoigsd: 21
            });
            q.execute(function(err, objs) {
              assert.ok(err);
              assert.notOk(objs);
              done();
            });
          }
        });
      })
    });


  });

  describe('registering comparators', function() {

    var Collection, Person;

    beforeEach(function() {
      Collection = app.collection('myCollection');
      Person = Collection.model('Person', {
        id: 'id',
        attributes: ['age']
      });
    });

    it('register', function(done) {
      app.registerComparator('three', function(opts) {
        var value = opts.object[opts.field];
        return value == 3;
      });
      Person.graph([{age: 2}, {age: 3}])
        .then(function() {
          Person.filter({age__three: 'doesnt matter'})
            .then(function(res) {
              assert.equal(res.length, 1);
              done();
            }).catch(done);
        }).catch(done);
    });
  });

  describe('order', function() {
    var Collection, Person;
    beforeEach(function() {
      Collection = app.collection('myCollection');
      Person = Collection.model('Person', {
        id: 'id',
        attributes: ['name', 'age', 'dob']
      });
    });

    it('descending order', function(done) {
      Person.graph([
        {name: 'Mike', age: 24},
        {name: 'Bob', age: 40},
        {name: 'John', age: 12}
      ]).then(function() {
        Person.filter({__order: '-age'})
          .then(function(orderedPeople) {
            var lastAge = orderedPeople[0].age;
            for (var i = 1; i < orderedPeople.length; i++) {
              var person = orderedPeople[i];
              assert(person.age < lastAge, 'Should be descending');
              lastAge = person.age;
            }
            done();
          }).catch(done);
      }).catch(done);
    });

    it('ascending order', function(done) {
      Person.graph([
        {name: 'Mike', age: 24},
        {name: 'Bob', age: 40},
        {name: 'John', age: 12}
      ]).then(function() {
        Person.filter({__order: 'age'})
          .then(function(orderedPeople) {
            var lastAge = orderedPeople[0].age;
            for (var i = 1; i < orderedPeople.length; i++) {
              var person = orderedPeople[i];
              assert(person.age > lastAge, 'Should be descending');
              lastAge = person.age;
            }
            done();
          }).catch(done);
      }).catch(done);
    });

    it('multiple order, array', function(done) {
      Person.graph([
        {name: 'Mike', age: 24},
        {name: 'Bob', age: 24},
        {name: 'John', age: 12}
      ]).then(function() {
        var filter = Person.filter({__order: ['age', 'name']})
          .then(function(orderedPeople) {
            var lastAge = orderedPeople[0].age;
            for (var i = 1; i < orderedPeople.length; i++) {
              var person = orderedPeople[i];
              assert(person.age >= lastAge, 'Should be ascending');
              lastAge = person.age;
            }
            done();
          }).catch(done);
      }).catch(done);
    });

    it('date order', function(done) {
      Person.graph([
        {name: 'Mike', dob: new Date(1990, 9, 10)},
        {name: 'Bob', dob: new Date(1993, 1, 12)},
        {name: 'John', dob: new Date(1984, 3, 5)}
      ]).then(function() {
        Person.filter({__order: 'dob'})
          .then(function(orderedPeople) {
            var lastDob = orderedPeople[0].dob;
            for (var i = 1; i < orderedPeople.length; i++) {
              var person = orderedPeople[i];
              assert(person.dob >= lastDob, 'Should be ascending');
              lastDob = person.dob;
            }
            done();
          }).catch(done);
      }).catch(done);
    });


    it('alphabetical order, ascending', function(done) {
      Person.graph([
        {name: 'Mike'},
        {name: 'Bob'},
        {name: 'John'}
      ]).then(function(people) {
        Person.filter({__order: 'name'})
          .then(function(orderedPeople) {
            console.log(_.pluck(orderedPeople, 'name'));
            assert.equal(orderedPeople[0], people[1]);
            assert.equal(orderedPeople[1], people[2]);
            assert.equal(orderedPeople[2], people[0]);
            done();
          }).catch(done);
      }).catch(done);
    });


    it('alphabetical order, descending', function(done) {
      Person.graph([
        {name: 'Mike'},
        {name: 'Bob'},
        {name: 'John'}
      ]).then(function(people) {
        Person.filter({__order: '-name'})
          .then(function(orderedPeople) {
            console.log(_.pluck(orderedPeople, 'name'));
            assert.equal(orderedPeople[2], people[1]);
            assert.equal(orderedPeople[1], people[2]);
            assert.equal(orderedPeople[0], people[0]);
            done();
          }).catch(done);
      }).catch(done);
    });
  });

  describe('$or', function() {
    var Collection, Person;
    beforeEach(function() {
      Collection = app.collection('myCollection');
      Person = Collection.model('Person', {
        id: 'id',
        attributes: ['name', 'age']
      });
    });
    it('simple', function(done) {
      Person.graph([
        {name: 'Mike', age: 24},
        {name: 'Bob', age: 22},
        {name: 'Peter', age: 29}
      ]).then(function() {
        Person.filter({
          $or: [
            {age: 24},
            {age: 22}
          ]
        }).then(function(res) {
          assert.equal(res.length, 2);
          _.each(res, function(r) {
            assert.ok(r.age == 24 || r.age == 22);
          });
          done();
        }).catch(done);
      }).catch(done);
    });
    it('still simple', function(done) {
      Person.graph([
        {name: 'Mike', age: 24},
        {name: 'Bob', age: 22},
        {name: 'Peter', age: 24}
      ]).then(function() {
        Person.filter({
          $or: [
            {age: 24, name: 'Mike'},
            {age: 22}
          ]
        }).then(function(res) {
          assert.equal(res.length, 2);
          _.each(res, function(r) {
            assert.ok(r.age == 24 || r.age == 22);
          });
          done();
        }).catch(done);
      }).catch(done);
    });

    it('nested', function(done) {
      Person.graph([
        {name: 'Mike', age: 24},
        {name: 'Bob', age: 22},
        {name: 'Peter', age: 24},
        {name: 'Roger', age: 24}
      ]).then(function() {
        Person.filter({
          $or: [
            {$or: [{name: 'Mike'}, {name: 'Peter'}], age: 24},
            {age: 22}
          ]
        }).then(function(res) {
          assert.equal(res.length, 3);
          done();
        }).catch(done);
      }).catch(done);
    });

    it('weird', function(done) {
      Person.graph([
        {name: 'Mike', age: 22},
        {name: 'Bob', age: 24},
        {name: 'Peter', age: 29}
      ]).then(function() {
        Person.filter({
          $or: {
            age: 24,
            name: 'Mike'
          }
        }).then(function(res) {
          assert.equal(res.length, 2);
          _.each(res, function(r) {
            assert.ok(r.age == 24 || r.name == 'Mike');
          });
          done();
        }).catch(done);
      }).catch(done);
    });
  });

  describe('$and', function() {
    var Collection, Person;
    beforeEach(function() {
      Collection = app.collection('myCollection');
      Person = Collection.model('Person', {
        id: 'id',
        attributes: ['name', 'age']
      });
    });
    it('simple', function(done) {
      Person.graph([
        {name: 'Mike', age: 24},
        {name: 'Bob', age: 24},
        {name: 'Peter', age: 24}
      ])
        .then(function() {
          Person.filter({
            $and: [
              {age: 24},
              {name: 'Mike'}
            ]
          }).then(function(res) {
            assert.equal(res.length, 1);
            var r = res[0];
            assert.equal(r.age, 24);
            assert.equal(r.name, 'Mike');
            done();
          }).catch(done);
        })
        .catch(done)
      ;
    });

    it('mixture', function(done) {
      Person.graph([
        {name: 'Mike', age: 24},
        {name: 'Bob', age: 22},
        {name: 'Peter', age: 24},
        {name: 'Roger', age: 24}
      ])
        .then(function() {
          Person.filter({
            $and: [
              {$or: [{name: 'Mike'}, {name: 'Peter'}]},
              {age: 24}
            ]
          }).then(function(res) {
            assert.equal(res.length, 2);
            done();
          }).catch(done);
        })
        .catch(done)
      ;
    });
  });

  describe('nested', function() {
    var Collection, Car, Person;
    beforeEach(function() {
      Collection = app.collection('myCollection');
      Car = Collection.model('Car', {
        id: 'id',
        attributes: ['name', 'colour'],
        relationships: {
          owner: {
            model: 'Person',
            type: 'OneToMany',
            reverse: 'cars'
          }
        }
      });
      Person = Collection.model('Person', {
        id: 'id',
        attributes: ['name', 'age']
      });
    });

    it('nested equals', function(done) {
      Car.graph([
        {name: 'Aston Martin', colour: 'black', owner: {id: 1, name: 'Mike', age: 23}},
        {name: 'Aston Martin', colour: 'blue', owner: {id: 1}},
        {name: 'Bentley', colour: 'green', owner: {id: 2, name: 'Bob', age: 22}}
      ])
        .then(function() {
          Car.filter({'owner.age': 23})
            .then(function(cars) {
              assert.equal(cars.length, 2);
              done();
            })
            .catch(done)
          ;
        })
        .catch(done)
      ;
    });

    it('nested op', function(done) {
      Car.graph([
        {name: 'Aston Martin', colour: 'black', owner: {id: 1, name: 'Mike', age: 23}},
        {name: 'Aston Martin', colour: 'blue', owner: {id: 2, name: 'John', age: 24}},
        {name: 'Bentley', colour: 'green', owner: {id: 3, name: 'Bob', age: 25}}
      ])
        .then(function() {
          Car.filter({'owner.age__lte': 24})
            .then(function(cars) {
              assert.equal(cars.length, 2);
              done();
            })
            .catch(done)
          ;
        })
        .catch(done)
      ;
    });


  });

  describe('filtering non-relationship objects', function() {

    it('object', function(done) {
      var Collection = app.collection('myCollection'),
        Model = Collection.model('Model', {
          id: 'id',
          attributes: ['x']
        });
      var data = [{x: {y: 1}}, {x: {y: 2}}];
      Model.graph(data)
        .then(function() {
          Model.filter({'x.y': 1})
            .then(function(res) {
              assert.equal(res.length, 1);
              assert.equal(res[0].x.y, 1);
              done();
            }).catch(done);
        }).catch(done);
    });


    it('should be able to deal with bad attribute accesses', function(done) {
      var Collection = app.collection('myCollection'),
        Model = Collection.model('Model', {
          id: 'id',
          attributes: ['x']
        });
      var data = [{x: {y: 1}}, {}];
      Model.graph(data)
        .then(function() {
          Model.filter({'x.y': 1})
            .then(function(res) {
              assert.equal(res.length, 1);
              assert.equal(res[0].x.y, 1);
              done();
            }).catch(done);
        }).catch(done);
    });

    it('should be able to deal with different value types', function(done) {
      var Collection = app.collection('myCollection'),
        Model = Collection.model('Model', {
          id: 'id',
          attributes: ['x']
        });
      var data = [{x: {y: 1}}, {x: {y: {z: 1}}}, {x: {y: undefined}}, {x: {y: null}}, {x: {y: [1, 2, 3]}}];
      Model.graph(data)
        .then(function() {
          Model.filter({'x.y': 1})
            .then(function(res) {
              assert.equal(res.length, 1);
              assert.equal(res[0].x.y, 1);
              done();
            }).catch(done);
        }).catch(done);
    });


  });

  describe('filtering non-relationship arrays', function() {
    it('should be able to match against arrays', function(done) {
      var Collection = app.collection('myCollection'),
        Model = Collection.model('Model', {
          id: 'id',
          attributes: ['x']
        });
      var data = [{x: {y: [1, 2, 3]}}, {x: {y: [4, 5, 6]}}];
      Model.graph(data)
        .then(function() {
          Model.filter({'x.y__contains': 2})
            .then(function(res) {
              assert.equal(res.length, 1);
              assert.include(res[0].x.y, 2);
              done();
            }).catch(done);
        }).catch(done);
    });

    it('should be able to match against arrays, even if data not always an arrayan array.', function(done) {
      var Collection = app.collection('myCollection'),
        Model = Collection.model('Model', {
          id: 'id',
          attributes: ['x']
        });
      var data = [{x: {y: [1, 2, 3]}}, {x: {y: 1}}, {x: {y: {}}}, {x: {y: undefined}}, {x: {y: null}}, {x: 1}];
      Model.graph(data)
        .then(function() {
          Model.filter({'x.y__contains': 2})
            .then(function(res) {
              assert.equal(res.length, 1);
              assert.include(res[0].x.y, 2);
              done();
            }).catch(done);
        }).catch(done);
    });
  });

  describe('filter sets', function() {

    function _instance(Model, data) {
      var instance = Model._instance(data);
      instance._emitEvents = true;
      return instance;
    }

    before(function() {
      app.storage = false;
    });

    beforeEach(function(done) {
      app.reset(done);
    });

    describe('attributes', function() {
      var filterSet, Collection, Person;
      var michael, bob;
      beforeEach(function(done) {
        Collection = app.collection('myCollection');
        Person = Collection.model('Person', {
          id: 'id',
          attributes: ['name', 'age']
        });
        Person._storageEnabled.then(function() {
          michael = _instance(Person, {name: 'Michael', age: 24});
          bob = _instance(Person, {name: 'Bob', age: 21});
          filterSet = createFilterSet([michael, bob], Person);
          done();
        }).catch(done);
      });

      it('contains the instances', function() {
        assert.include(filterSet, michael);
        assert.include(filterSet, bob);
      });

      it('contains the ages', function() {
        var ages = filterSet.age;
        assert.include(ages, michael.age);
        assert.include(ages, bob.age);
      });

      it('can set ages', function() {
        var michaelsNewAge = 25,
          bobsNewAge = 28;
        filterSet.age = [michaelsNewAge, bobsNewAge];
        assert.equal(michael.age, michaelsNewAge);
        assert.equal(bob.age, bobsNewAge);
      });

      it('should throw an error if attempt to set with a diff. length array', function() {
        assert.throws(function() {
          filterSet.age = [1, 2, 3];
        }, SiestaUserError);
      });

      it('can set a single age', function() {
        var newAge = 25;
        filterSet.age = newAge;
        assert.equal(michael.age, newAge);
        assert.equal(bob.age, newAge);
      });

      it('uppercase all names', function() {
        var nameQuerySet = filterSet.name;
        assert.include(nameQuerySet, 'Michael');
        assert.include(nameQuerySet, 'Bob');
        filterSet.name = nameQuerySet.toUpperCase();
        assert.equal(michael.name, 'MICHAEL');
        assert.equal(bob.name, 'BOB');
      });

      it('uppercase then lowercase all names', function() {
        var nameQuerySet = filterSet.name;
        assert.include(nameQuerySet, 'Michael');
        assert.include(nameQuerySet, 'Bob');
        var upper = nameQuerySet.toUpperCase();
        filterSet.name = upper.toLowerCase();
        assert.equal(michael.name, 'michael');
        assert.equal(bob.name, 'bob');
      });

    });

    describe('relationships', function() {
      var Collection, Person, Car;
      var michael, bob;
      beforeEach(function(done) {
        Collection = app.collection('myCollection');
        Person = Collection.model('Person', {
          attributes: ['name', 'age']
        });
        Car = Collection.model('Car', {
          attributes: ['colour'],
          relationships: {
            owner: {
              model: 'Person',
              reverse: 'cars'
            }
          }
        });
        Model
          .install([Person, Car])
          .then(function() {
            michael = _instance(Person, {name: 'Michael', age: 24});
            bob = _instance(Person, {name: 'Bob', age: 21});
            michael.cars = [_instance(Car, {colour: 'red'}), _instance(Car, {colour: 'blue'})];
            done();
          })
          .catch(done);
      });

      it('new owner', function() {
        var filterSet = createFilterSet(michael.cars, Car);
        filterSet.owner = bob;
        assert.equal(bob.cars.length, 2);
        assert.equal(michael.cars.length, 0)
      });

      it('remove all cars', function(done) {
        var cars = _.extend([], michael.cars),
          filterSet = createFilterSet(cars, Car);

        filterSet.delete().then(function() {
          app.notify(function() {
            cars.forEach(function(c) {
              assert.ok(c.removed);
            });
            assert.equal(bob.cars.length, 0);
            assert.equal(michael.cars.length, 0);
            done();
          });
        });
      })
    });

  });


  describe('relationships', function() {
    describe('one-to-many', function() {
      var Collection, Model, RelatedModel;

      beforeEach(function() {
        Collection = app.collection('Collection');
        Model = Collection.model('Model', {
          attributes: ['x'],
          relationships: {
            rel: {
              model: 'RelatedModel',
              reverse: 'reverseRel'
            }
          }
        });
        RelatedModel = Collection.model('RelatedModel', {
          attributes: ['y']
        });
      });


      describe('forward', function() {
        var data;
        beforeEach(function(done) {
          Collection.graph({
            RelatedModel: [
              {
                id: 3,
                y: 1,
                reverseRel: [{id: 1, x: 'x'}]
              }
            ]
          }).then(function(_data) {
            data = _data;
            done();
          }).catch(done);
        });

        it('simple', function(done) {
          var instance = data.RelatedModel[0];
          Model.filter({rel: instance})
            .then(function(instances) {
              console.log('?', instances);

              assert.include(instance.reverseRel, instances[0]);
              done();
            })
            .catch(done);
        });

        it('simple, _id', function(done) {
          var instance = data.RelatedModel[0];
          Model
            .filter({'rel.id': instance.id})
            .then(function(instances) {
              console.log('?', instances);
              assert.equal(instances.length, 1);
              assert.include(instance.reverseRel, instances[0]);
              done();
            })
            .catch(done);
        });

      });

      describe('reverse', function() {
        var data;
        beforeEach(function(done) {
          Collection.graph({
            RelatedModel: [
              {
                id: 3,
                y: 1,
                reverseRel: [{id: 1, x: 'x'}]
              }
            ]
          }).then(function(_data) {
            data = _data;
            done();
          }).catch(done);
        });

        it('simple', function(done) {
          var reverseInstance = data.RelatedModel[0];
          var instance = reverseInstance.reverseRel[0];
          RelatedModel
            .filter({reverseRel__in: instance})
            .then(function(instances) {
              assert.equal(instances[0], reverseInstance);
              done();
            })
            .catch(done);
        });

        it('simple, _id', function(done) {
          var reverseInstance = data.RelatedModel[0],
            instance = reverseInstance.reverseRel[0];
          RelatedModel
            .filter({'reverseRel.id__in': instance.id})
            .then(function(instances) {
              console.log(instances);
              assert.equal(instances[0], reverseInstance);
              console.log(3);
              done();
            })
            .catch(done);
        });

      });
    });
  });
});
