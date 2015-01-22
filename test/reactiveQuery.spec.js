var assert = require('chai').assert;

var Collection = siesta;

describe('reactive query', function () {
    var MyCollection, Person;

    beforeEach(function (done) {
        // Ensure that storage is wiped clean for each test.
        siesta.ext.storageEnabled = true;
        siesta.reset(function () {
            siesta.ext.storageEnabled = false;
            done();
        });
    });


    describe('unordered', function () {
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
        beforeEach(function () {
            MyCollection = siesta.collection('MyCollection');
            Person = MyCollection.model('Person', {
                id: 'id',
                attributes: ['name', 'age']
            });
        });
        it('initial results', function (done) {
            Person.graph(initialData).then(function () {
                var rq = Person.reactiveQuery({age__lt: 30});
                assert.notOk(rq.initialised, 'Should not yet be initialised');
                rq.init(function (err, results) {
                    if (err) done(err);
                    else {
                        assert.equal(results, rq.results);
                        assert.ok(rq.initialised, 'Should be initialised');
                        assert.ok(rq.initialized, 'Should be initialized');
                        assert.equal(rq.results.length, 2, 'Should be 2 results');
                        _.each(rq.results, function (r) {
                            assert.ok(r.age < 30, 'All results should be younger than 30')
                        });
                        rq.terminate();
                        siesta.notify(done);
                    }
                });
            }, done).catch(done).done();
        });

        describe('updates', function () {

            describe('new matching query', function () {
                function assertExpectedResults(results, peter) {
                    assert.equal(results.length, 3, 'Should now be 3 results');
                    assert.include(results, peter, 'The results should include peter');
                    _.each(results, function (r) {
                        assert.ok(r.age < 30, 'All results should be younger than 30')
                    });
                }

                it('results are as expected', function (done) {
                    Person.graph(initialData).then(function () {
                        var rq = Person.reactiveQuery({age__lt: 30});
                        rq.init(function (err, results) {
                            if (err) done(err);
                            else {
                                assert.equal(results, rq.results);
                                Person.graph({name: 'Peter', age: 21, id: 4}).then(function (peter) {
                                    try {
                                        assertExpectedResults(rq.results, peter);
                                        rq.terminate();
                                        siesta.notify(done);
                                    }
                                    catch (e) {
                                        done(e);
                                    }
                                }).catch(done).done();
                            }
                        });
                    }).catch(done).done();
                });

                it('emission', function (done) {
                    Person.graph(initialData).then(function () {
                        var rq = Person.reactiveQuery({age__lt: 30});
                        rq.init(function (err, results) {
                            if (err) done(err);
                            else {
                                assert.equal(results, rq.results);
                                rq.listenOnce(function (results, change) {
                                    var added = change.added;
                                    assert.equal(added.length, 1);
                                    var peter = added[0];
                                    assert.equal(change.type, siesta.ModelEventType.Splice);
                                    assertExpectedResults(results, peter);
                                    rq.terminate();
                                    siesta.notify(done);
                                });
                                Person.graph({name: 'Peter', age: 21, id: 4}).then(function () {
                                }).catch(done).done();

                            }
                        });
                    }).catch(done).done();
                });

            });

            describe('new, not matching query', function () {
                function matchResults(rq, peter) {
                    assert.equal(rq.results.length, 2, 'Should still be 2 results');
                    assert.notInclude(rq.results, peter, 'The results should not include peter');
                    _.each(rq.results, function (r) {
                        assert.ok(r.age < 30, 'All results should be younger than 30')
                    });
                }

                it('results match', function (done) {
                    Person.graph(initialData).then(function () {
                        var rq = Person.reactiveQuery({age__lt: 30});
                        rq.init(function (err, results) {
                            if (err) done(err);
                            else {
                                assert.equal(results, rq.results);
                                Person.graph({name: 'Peter', age: 33, id: 4}).then(function (peter) {
                                    try {
                                        matchResults(rq, peter);
                                        rq.terminate();
                                        siesta.notify(done);
                                    }
                                    catch (e) {
                                        done(e);
                                    }
                                }).catch(done).done();
                            }
                        });
                    }).catch(done).done();
                });

            });


            describe('update, no longer matching', function () {
                function assertResultsOk(results, person) {
                    assert.equal(results.length, 1, 'Should now only be 1 result');
                    assert.notInclude(results, person, 'The results should not include peter');
                }

                it('results match', function (done) {
                    Person.graph(initialData).then(function (res) {
                        var person = res[0];
                        person.age = 40;
                        var rq = Person.reactiveQuery({age__lt: 30});
                        rq.init(function (err, results) {
                            if (err) done(err);
                            else {
                                assert.equal(results, rq.results);
                                siesta.notify(function () {
                                    try {
                                        assertResultsOk(rq.results, person);
                                        rq.terminate();
                                        siesta.notify(done);
                                    }
                                    catch (e) {
                                        done(e);
                                    }
                                });
                            }
                        });
                    }).catch(done).done();
                });

                it('emission', function (done) {
                    Person.graph(initialData).then(function (res) {
                        var person = res[0];
                        var rq = Person.reactiveQuery({age__lt: 30});
                        rq.init(function (err) {
                            if (err) done(err);
                            else {
                                var cancelListen;
                                cancelListen = rq.listen(function (results, change) {
                                    assert.equal(results, rq.results)
                                    assertResultsOk(rq.results, person);
                                    var removed = change.removed;
                                    assert.include(removed, person);
                                    assert.equal(change.type, siesta.ModelEventType.Splice);
                                    assert.equal(change.obj, rq);
                                    cancelListen();
                                    rq.terminate();
                                    siesta.notify(done);
                                });
                                person.age = 40;
                                siesta.notify();
                            }
                        }).catch(done).done();
                    }).catch(done).done();
                });

            });

            it('update, still matching, should emit the notification', function (done) {
                Person.graph(initialData).then(function (res) {
                    var person = res[0];
                    var rq = Person.reactiveQuery({age__lt: 30});
                    rq.init(function (err) {
                        if (err) done(err);
                        else {
                            rq.listenOnce(function (results, n) {
                                assert.equal(results, rq.results);
                                assert.equal(rq.results.length, 2, 'Should still be 2 results');
                                assert.equal(n.obj, person);
                                assert.equal(n.field, 'age');
                                assert.equal(n.new, 29);
                                rq.terminate();
                                done();
                            });
                            person.age = 29;
                            siesta.notify();
                        }
                    }).catch(done).done();
                }).catch(done).done();
            });

            describe('removal', function () {
                function assertResultsCorrect(rq, person) {
                    assert.equal(rq.results.length, 1, 'Should now only be 1 result');
                    assert.notInclude(rq.results, person, 'The results should not include peter');
                }

                it('results correct', function (done) {
                    Person.graph(initialData).then(function (res) {
                        var person = res[0];
                        var rq = Person.reactiveQuery({age__lt: 30});
                        rq.init(function (err) {
                            person.remove(function () {
                                if (err) done(err);
                                else {
                                    siesta.notify(function () {
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

                    }).catch(done).done();
                });

                it('emission', function (done) {
                    Person.graph(initialData)
                        .then(function (res) {
                            var person = res[0];
                            var rq = Person.reactiveQuery({age__lt: 30});
                            rq.init(function (err) {
                                if (err) done(err);
                                else {
                                    rq.listenOnce(function (results, change) {
                                        try {
                                            var removed = change.removed;
                                            assert.include(removed, person);
                                            assert.equal(change.type, siesta.ModelEventType.Splice);
                                            assert.equal(change.obj, rq);
                                            assertResultsCorrect(rq, person);
                                            rq.terminate();
                                            siesta.notify(done);
                                        }
                                        catch (e) {
                                            done(e);
                                        }
                                    });
                                    person.remove();
                                    siesta.notify();
                                }
                            });
                        }).catch(done).done();
                });


                it('emission, having listened before init', function (done) {
                    Person.graph(initialData)
                        .then(function (res) {
                            var person = res[0];
                            var rq = Person.reactiveQuery({age__lt: 30});
                            rq.listenOnce(function (results, change) {
                                try {
                                    var removed = change.removed;
                                    assert.include(removed, person);
                                    assert.equal(change.type, siesta.ModelEventType.Splice);
                                    assert.equal(change.obj, rq);
                                    assertResultsCorrect(rq, person);
                                    rq.terminate();
                                    siesta.notify(done);
                                }
                                catch (e) {
                                    done(e);
                                }
                            });
                            rq.init(function (err) {
                                if (err) done(err);
                                else {
                                    person.remove();
                                    siesta.notify();
                                }
                            });
                        }).catch(done).done();
                });


            });


        });
    });

    describe('ordered', function () {
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

        beforeEach(function (done) {
            siesta.reset(function () {
                MyCollection = siesta.collection('MyCollection');
                Person = MyCollection.model('Person', {
                    id: 'id',
                    attributes: ['name', 'age']
                });
                done();
            });
        });

        it('initial results', function (done) {
            Person.graph(initialData).then(function () {
                var rq = Person.reactiveQuery({age__lt: 30, __order: 'age'});
                assert.notOk(rq.initialised, 'Should not yet be initialised');
                rq.init(function (err, results) {
                    if (err) done(err);
                    else {
                        assert.ok(rq.initialised, 'Should be initialised');
                        assert.ok(rq.initialized, 'Should be initialized');
                        assert.equal(rq.results.length, 3, 'Should be 3 results');
                        _.each(rq.results, function (r) {
                            assert.ok(r.age < 30, 'All results should be younger than 30')
                        });
                        var lastAge = rq.results[0].age;
                        for (var i = 1; i < rq.results.length; i++) {
                            var age = rq.results[i].age;
                            assert(age > lastAge, 'Should be ascending order ' + age.toString() + ' > ' + lastAge.toString());
                        }
                        rq.terminate();
                        siesta.notify(done);
                    }
                });
            }, done).catch(done).done();
        });

        it('add new, matching', function (done) {
            Person.graph(initialData).then(function () {
                var rq = Person.reactiveQuery({age__lt: 30, __order: 'age'});
                assert.notOk(rq.initialised, 'Should not yet be initialised');
                rq.init().then(function () {
                    Person.graph({name: 'peter', age: 10}).then(function () {
                        siesta.notify(function () {
                            assert.equal(rq.results.length, 4, 'Should be 4 results');
                            _.each(rq.results, function (r) {
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
                }).catch(done).done();
            }, done).catch(done).done();
        });

    });

    describe('load', function () {
        var initialData = [
            {
                name: 'Bob',
                age: 19,
                id: 1,
                collection: 'MyCollection',
                model: 'Person'
            },
            {
                name: 'John',
                age: 40,
                id: 3,
                collection: 'MyCollection',
                model: 'Person'
            },
            {
                name: 'Mike',
                age: 24,
                id: 2,
                collection: 'MyCollection',
                model: 'Person'
            },
            {
                name: 'James',
                age: 12,
                id: 4,
                collection: 'MyCollection',
                model: 'Person'
            }
        ];
        before(function () {
            siesta.ext.storageEnabled = true;
        });
        beforeEach(function (done) {
            siesta.reset(function () {
                MyCollection = siesta.collection('MyCollection');
                Person = MyCollection.model('Person', {
                    id: 'id',
                    attributes: ['name', 'age']
                });
                done();
            });
        });
        it('before install', function (done) {
            siesta.ext.storage._pouch.bulkDocs(initialData)
                .then(function () {
                    var rq = Person.reactiveQuery({age__lt: 30, __order: 'age'});
                    siesta.install(function () {
                        rq.terminate();
                        done();
                    });
                })
                .catch(done);
        })
    });


});