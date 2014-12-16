var s = require('../core/index'),
    assert = require('chai').assert;

var Collection = s.Collection;

var initialData = [
    {
        name: 'Bob',
        age: 19,
        id: 1
    },
    {
        name: 'Mike',
        age: 24,
        id: 2
    },
    {
        name: 'John',
        age: 40,
        id: 3
    }
];

describe.only('reactive query', function () {
    var collection, mapping;

    beforeEach(function (done) {
        s.reset();
        collection = new Collection('myCollection');
        mapping = collection.mapping('Person', {
            id: 'id',
            attributes: ['name', 'age']
        });
        collection.install(done);
    });

    afterEach(function () {
    });


    it('initial results', function (done) {
        mapping.map(initialData).then(function () {
            var rq = mapping.reactiveQuery({age__lt: 30});
            assert.notOk(rq.initialised, 'Should not yet be initialised');
            rq.init(function (err, results) {
                if (err) done(err);
                else {
                    assert.ok(rq.initialised, 'Should be initialised');
                    assert.ok(rq.initialized, 'Should be initialized');
                    assert.equal(rq.results.length, 2, 'Should be 2 results');
                    _.each(rq.results, function (r) {
                        assert.ok(r.age < 30, 'All results should be younger than 30')
                    });
                    rq.terminate();
                    s.notify(done);
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
                console.log('start new matching query');
                mapping.map(initialData).then(function () {
                    var rq = mapping.reactiveQuery({age__lt: 30});
                    rq.init(function (err) {
                        if (err) done(err);
                        else {
                            mapping.map({name: 'Peter', age: 21, id: 4}).then(function (peter) {
                                try {
                                    assertExpectedResults(rq.results, peter);
                                    rq.terminate();
                                    s.notify(done);
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
                console.log('start new matching query');
                mapping.map(initialData).then(function () {
                    var rq = mapping.reactiveQuery({age__lt: 30});
                    rq.init(function (err) {
                        if (err) done(err);
                        else {
                            rq.once('change', function (results, change) {
                                var added = change.added,
                                    addedId = change.addedId;
                                assert.equal(added.length, 1);
                                var peter = added[0];
                                assert.equal(change.type, s.ChangeType.Splice);
                                assert.equal(addedId.length, 1);
                                assert.include(addedId, peter._id);
                                assertExpectedResults(results, peter);
                                rq.terminate();
                                s.notify(done);
                            });
                            mapping.map({name: 'Peter', age: 21, id: 4}).then(function () {
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
                mapping.map(initialData).then(function () {
                    var rq = mapping.reactiveQuery({age__lt: 30});
                    rq.init(function (err) {
                        if (err) done(err);
                        else {
                            mapping.map({name: 'Peter', age: 33, id: 4}).then(function (peter) {
                                try {
                                    matchResults(rq, peter);
                                    rq.terminate();
                                    s.notify(done);
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
                mapping.map(initialData).then(function (res) {
                    var person = res[0];
                    console.log('person', person);
                    person.age = 40;
                    var rq = mapping.reactiveQuery({age__lt: 30});
                    rq.init(function (err) {
                        if (err) done(err);
                        else {
                            s.notify(function () {
                                try {
                                    assertResultsOk(rq.results, person);
                                    rq.terminate();
                                    s.notify(done);
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
                mapping.map(initialData).then(function (res) {
                    var person = res[0];
                    var _id = person._id;
                    var rq = mapping.reactiveQuery({age__lt: 30});
                    rq.init(function (err) {
                        if (err) done(err);
                        else {
                            rq.on('change', function (results, change) {
                                try {
                                    assertResultsOk(rq.results, person);
                                    var removedId = change.removedId,
                                        removed = change.removed;
                                    assert.include(removed, person);
                                    assert.include(removedId, _id);
                                    assert.equal(change.type, s.ChangeType.Splice);
                                    rq.terminate();
                                    s.notify(done);
                                }
                                catch (e) {
                                    done(e);
                                }
                            });
                            person.age = 40;
                            s.notify();
                        }
                    });
                }).catch(done).done();
            });

        });

        it('update, still matching', function (done) {
            mapping.map(initialData).then(function (res) {
                var person = res[0];
                console.log('person', person);
                person.age = 29;
                var rq = mapping.reactiveQuery({age__lt: 30});
                rq.init(function (err) {
                    if (err) done(err);
                    else {
                        s.notify(function () {
                            try {
                                assert.equal(rq.results.length, 2, 'Should still be 2 results');
                                rq.terminate();
                                done();
                            }
                            catch (e) {
                                done(e);
                            }
                        });
                    }
                });
            }).catch(done).done();
        });

        describe('removal', function () {
            function assertResultsCorrect(rq, person) {
                assert.equal(rq.results.length, 1, 'Should now only be 1 result');
                assert.notInclude(rq.results, person, 'The results should not include peter');
            }

            it('results correct', function (done) {
                mapping.map(initialData).then(function (res) {
                    var person = res[0];
                    var rq = mapping.reactiveQuery({age__lt: 30});
                    rq.init(function (err) {
                        person.remove(function () {
                            if (err) done(err);
                            else {
                                s.notify(function () {
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
                mapping.map(initialData)
                    .then(function (res) {
                        var person = res[0];
                        var _id = person._id;
                        var rq = mapping.reactiveQuery({age__lt: 30});
                        rq.init(function (err) {
                            if (err) done(err);
                            else {
                                rq.on('change', function (results, change) {
                                    console.log('yay');
                                    try {
                                        var removedId = change.removedId,
                                            removed = change.removed;
                                        assert.include(removed, person);
                                        assert.include(removedId, _id);
                                        assert.equal(change.type, s.ChangeType.Splice);
                                        assertResultsCorrect(rq, person);
                                        rq.terminate();  
                                        s.notify(done);
                                    }
                                    catch (e) {
                                        done(e);
                                    }
                                });
                                person.remove();
                                s.notify();
                            }
                        });
                    }).catch(done).done();
            });


        });


    });


});