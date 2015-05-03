var assert = require('chai').assert;

var Collection = siesta;

describe('reactive filter', function() {
  var MyCollection, Person;
  var app = siesta.app('reactive-filter');

  beforeEach(function(done) {
    // Ensure that storage is wiped clean for each test.
    app.storage = true;
    app.reset(function() {
      app.storage = false;
      done();
    });
  });

  describe('unordered', function() {
    var initialData = [
      {
        name: 'Bob',
        age: 19,
        id: 1
      },
      {
        name: 'John',
        age: 40,
        id: 3
      },
      {
        name: 'Mike',
        age: 24,
        id: 2
      }
    ];
    beforeEach(function() {
      MyCollection = app.collection('MyCollection');
      Person = MyCollection.model('Person', {
        id: 'id',
        attributes: ['name', 'age']
      });
    });
    it('initial results', function(done) {
      Person.graph(initialData).then(function() {
        var rq = Person._reactiveFilter({age__lt: 30});
        assert.notOk(rq.initialised, 'Should not yet be initialised');
        rq.init(function(err, results) {
          if (err) done(err);
          else {
            assert.equal(results, rq.results);
            assert.ok(rq.initialised, 'Should be initialised');
            assert.ok(rq.initialized, 'Should be initialized');
            assert.equal(rq.results.length, 2, 'Should be 2 results');
            _.each(rq.results, function(r) {
              assert.ok(r.age < 30, 'All results should be younger than 30')
            });
            rq.terminate();
            app.notify(done);
          }
        });
      }, done).catch(done);
    });

    describe('updates', function() {

      describe('new matching filter', function() {
        function assertExpectedResults(results, peter) {
          assert.equal(results.length, 3, 'Should now be 3 results');
          assert.include(results, peter, 'The results should include peter');
          _.each(results, function(r) {
            assert.ok(r.age < 30, 'All results should be younger than 30')
          });
        }

        it('results are as expected', function(done) {
          Person.graph(initialData).then(function() {
            var rq = Person._reactiveFilter({age__lt: 30});
            rq.init(function(err, results) {
              if (err) done(err);
              else {
                assert.equal(results, rq.results);
                Person.graph({name: 'Peter', age: 21, id: 4}).then(function(peter) {
                  try {
                    assertExpectedResults(rq.results, peter);
                    rq.terminate();
                    app.notify(done);
                  }
                  catch (e) {
                    done(e);
                  }
                }).catch(done);
              }
            });
          }).catch(done);
        });

        it('emission', function(done) {
          Person.graph(initialData).then(function() {
            var rq = Person._reactiveFilter({age__lt: 30});
            rq.init(function(err, results) {
              if (err) done(err);
              else {
                assert.equal(results, rq.results);
                rq.once('*', function(change) {
                  var added = change.added;
                  assert.equal(added.length, 1);
                  var peter = added[0];
                  assert.equal(change.type, siesta.ModelEventType.Splice);
                  assertExpectedResults(rq.results, peter);
                  rq.terminate();
                  app.notify(done);
                });
                Person.graph({name: 'Peter', age: 21, id: 4}).then(function() {
                }).catch(done);

              }
            });
          }).catch(done);
        });

      });

      describe('new, not matching filter', function() {
        function matchResults(rq, peter) {
          assert.equal(rq.results.length, 2, 'Should still be 2 results');
          assert.notInclude(rq.results, peter, 'The results should not include peter');
          _.each(rq.results, function(r) {
            assert.ok(r.age < 30, 'All results should be younger than 30')
          });
        }

        it('results match', function(done) {
          Person.graph(initialData).then(function() {
            var rq = Person._reactiveFilter({age__lt: 30});
            rq.init(function(err, results) {
              if (err) done(err);
              else {
                assert.equal(results, rq.results);
                Person.graph({name: 'Peter', age: 33, id: 4}).then(function(peter) {
                  try {
                    matchResults(rq, peter);
                    rq.terminate();
                    app.notify(done);
                  }
                  catch (e) {
                    done(e);
                  }
                }).catch(done);
              }
            });
          }).catch(done);
        });

      });

      describe('update, no longer matching', function() {
        function assertResultsOk(results, person) {
          assert.equal(results.length, 1, 'Should now only be 1 result');
          assert.notInclude(results, person, 'The results should not include peter');
        }

        it('results match', function(done) {
          Person.graph(initialData).then(function(res) {
            var person = res[0];
            person.age = 40;
            var rq = Person._reactiveFilter({age__lt: 30});
            rq.init(function(err, results) {
              if (err) done(err);
              else {
                assert.equal(results, rq.results);
                app.notify(function() {
                  try {
                    assertResultsOk(rq.results, person);
                    rq.terminate();
                    app.notify(done);
                  }
                  catch (e) {
                    done(e);
                  }
                });
              }
            });
          }).catch(done);
        });

        it('emission', function(done) {
          Person.graph(initialData).then(function(res) {
            var person = res[0];
            var rq = Person._reactiveFilter({age__lt: 30});
            rq.init(function(err) {
              if (err) done(err);
              else {
                var cancelListen;
                cancelListen = rq.on('*', function(change) {
                  var results = rq.results;
                  assertResultsOk(results, person);
                  var removed = change.removed;
                  assert.include(removed, person);
                  assert.equal(change.type, siesta.ModelEventType.Splice);
                  assert.equal(change.obj, rq);
                  cancelListen();
                  rq.terminate();
                  app.notify(done);
                });
                person.age = 40;
                app.notify();
              }
            }).catch(done);
          }).catch(done);
        });

      });

      it('update, still matching, should emit the notification', function(done) {
        Person.graph(initialData).then(function(res) {
          var person = res[0];
          var rq = Person._reactiveFilter({age__lt: 30});
          rq.init(function(err) {
            if (err) done(err);
            else {
              rq.once('*', function(n) {
                assert.equal(rq.results.length, 2, 'Should still be 2 results');
                assert.equal(n.obj, person);
                assert.equal(n.field, 'age');
                assert.equal(n.new, 29);
                rq.terminate();
                done();
              });
              person.age = 29;
              app.notify();
            }
          }).catch(done);
        }).catch(done);
      });

      describe('removal', function() {
        function assertResultsCorrect(rq, person) {
          assert.equal(rq.results.length, 1, 'Should now only be 1 result');
          assert.notInclude(rq.results, person, 'The results should not include peter');
        }

        it('results correct', function(done) {
          Person.graph(initialData).then(function(res) {
            var person = res[0];
            var rq = Person._reactiveFilter({age__lt: 30});
            rq.init(function(err) {
              person.delete(function() {
                if (err) done(err);
                else {
                  app.notify(function() {
                    try {
                      assertResultsCorrect(rq, person);
                      rq.terminate();
                      done();
                    }
                    catch (e) {
                      done(e);
                    }
                  });
                }
              });
            });

          }).catch(done);
        });

        it('emission', function(done) {
          Person.graph(initialData)
            .then(function(res) {
              var person = res[0];
              var rq = Person._reactiveFilter({age__lt: 30});
              rq.init(function(err) {
                if (err) done(err);
                else {
                  rq.once('*', function(change) {
                    try {
                      var removed = change.removed;
                      assert.include(removed, person);
                      assert.equal(change.type, siesta.ModelEventType.Splice);
                      assert.equal(change.obj, rq);
                      assertResultsCorrect(rq, person);
                      rq.terminate();
                      app.notify(done);
                    }
                    catch (e) {
                      done(e);
                    }
                  });
                  person.delete();
                  app.notify();
                }
              });
            }).catch(done);
        });


        it('emission, having listened before init', function(done) {
          Person.graph(initialData)
            .then(function(res) {
              var person = res[0];
              var rq = Person._reactiveFilter({age__lt: 30});
              rq.once('*', function(change) {
                try {
                  var removed = change.removed;
                  assert.include(removed, person);
                  assert.equal(change.type, siesta.ModelEventType.Splice);
                  assert.equal(change.obj, rq);
                  assertResultsCorrect(rq, person);
                  rq.terminate();
                  app.notify(done);
                }
                catch (e) {
                  done(e);
                }
              });
              rq.init(function(err) {
                if (err) done(err);
                else {
                  person.delete();
                  app.notify();
                }
              });
            }).catch(done);
        });


      });

      describe('manual', function() {
        function assertResultsOk(results, person) {
          assert.equal(results.length, 1, 'Should now only be 1 result');
          assert.notInclude(results, person, 'The results should not include peter');
        }

        it('results are as expected', function(done) {
          Person.graph(initialData).then(function(res) {
            var person = res[0];
            var rq = Person._reactiveFilter({age__lt: 30});
            rq.init(function(err, results) {
              if (err) done(err);
              else {
                assert.equal(results, rq.results);
                person.__values.age = 40; // Assigning to values ensures we don't trigger any notifications!
                rq.update(function(err) {
                  assert.notOk(err);
                  assertResultsOk(rq.results, person);
                  rq.terminate();
                  done();
                });
              }
            });
          }).catch(done);
        });
      });
    });
  });

  describe('ordered', function() {
    var initialData = [
      {
        name: 'Bob',
        age: 19,
        id: 1
      },
      {
        name: 'John',
        age: 40,
        id: 3
      },
      {
        name: 'Mike',
        age: 24,
        id: 2
      },
      {
        name: 'James',
        age: 12,
        id: 4
      }
    ];

    beforeEach(function(done) {
      app.reset(function() {
        MyCollection = app.collection('MyCollection');
        Person = MyCollection.model('Person', {
          id: 'id',
          attributes: ['name', 'age']
        });
        done();
      });
    });

    it('initial results', function(done) {
      Person.graph(initialData).then(function() {
        var rq = Person._reactiveFilter({age__lt: 30, __order: 'age'});
        assert.notOk(rq.initialised, 'Should not yet be initialised');
        rq.init(function(err, results) {
          if (err) done(err);
          else {
            assert.ok(rq.initialised, 'Should be initialised');
            assert.ok(rq.initialized, 'Should be initialized');
            assert.equal(rq.results.length, 3, 'Should be 3 results');
            _.each(rq.results, function(r) {
              assert.ok(r.age < 30, 'All results should be younger than 30')
            });
            var lastAge = rq.results[0].age;
            for (var i = 1; i < rq.results.length; i++) {
              var age = rq.results[i].age;
              assert(age > lastAge, 'Should be ascending order ' + age.toString() + ' > ' + lastAge.toString());
            }
            rq.terminate();
            app.notify(done);
          }
        });
      }, done).catch(done);
    });

    it('add new, matching', function(done) {
      Person.graph(initialData).then(function() {
        var rq = Person._reactiveFilter({age__lt: 30, __order: 'age'});
        assert.notOk(rq.initialised, 'Should not yet be initialised');
        rq.init().then(function() {
          Person.graph({name: 'peter', age: 10}).then(function() {
            app.notify(function() {
              assert.equal(rq.results.length, 4, 'Should be 4 results');
              _.each(rq.results, function(r) {
                assert.ok(r.age < 30, 'All results should be younger than 30')
              });
              var lastAge = rq.results[0].age;
              for (var i = 1; i < rq.results.length; i++) {
                var age = rq.results[i].age;
                assert(age > lastAge, 'Should be ascending order ' + age.toString() + ' > ' + lastAge.toString());
              }
              rq.terminate();
              done();
            })
          });
        }).catch(done);
      }, done).catch(done);
    });

  });


  describe('chains', function() {
    beforeEach(function(done) {
      app.reset(function() {
        MyCollection = app.collection('MyCollection');
        Person = MyCollection.model('Person', {
          id: 'id',
          attributes: ['name', 'age']
        });
        done();
      });
    });
    it('emission, register handler afterwards', function(done) {
      var cancel;
      cancel = Person.filter({age__lt: 30})
        .then(function() {
          Person.graph({name: 'Peter', age: 21, id: 4}).catch(done);
        })
        .on('*', function() {
          cancel();
          done();
        });
    });
    it('emission, register handler first', function(done) {
      var cancel;
      cancel = Person.filter({age__lt: 30})
        .on('*', function() {
          cancel();
          done();
        })
        .then(function() {
          Person.graph({name: 'Peter', age: 21, id: 4}).catch(done);
        });
    });
    it('emission, multiple handlers', function(done) {
      var cancel;
      var numCalls = 0;
      cancel = Person.filter({age__lt: 30})
        .then(function() {
          Person.graph({name: 'Peter', age: 21, id: 4}).catch(done);
        })
        .on('*', function() {
          console.log(1);
          numCalls++;
        })
        .on('*', function() {
          console.log(2);
          numCalls++;
        })
        .on('*', function() {
          console.log(3);
          numCalls++;
          assert.equal(numCalls, 3);
          cancel();
          done();
        })

    });
    it('emission, multiple handlers, weird order', function(done) {
      var cancel;
      var numCalls = 0;
      cancel = Person.filter({age__lt: 30})
        .on('*', function() {
          numCalls++;
        })
        .then(function() {
          Person.graph({name: 'Peter', age: 21, id: 4}).catch(done);
        })
        .on('*', function() {
          numCalls++;
        })
        .on('*', function() {
          numCalls++;
          assert.equal(numCalls, 3);
          cancel();
          done();
        });

    });
  });

});
