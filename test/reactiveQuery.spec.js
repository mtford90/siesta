var s = require('../core/index'),
    assert = require('chai').assert;

var Collection = s.Collection;

describe('reactive query', function () {
    var collection, mapping, rq;

    beforeEach(function (done) {
        s.reset();
        collection = new Collection('myCollection');
        mapping = collection.mapping('Person', {
            id: 'id',
            attributes: ['name', 'age']
        });
        collection.install(done);
    });


    function mapData(data, cb, done) {
        return mapping.map(data, function (err, results) {
            if (err) done(err);
            else cb(results);
        }).catch(function (err) {
            console.error('Error mapping data', err);
            done(err);
        });
    }

    function mapInitialData(cb, done) {
        return mapData([
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
        ], cb, done);
    }

    it('initial', function (done) {
        mapInitialData(function () {
            rq = mapping.reactiveQuery({age__lt: 30});
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
                    done();
                }
            });
        }, done);
    });

    describe.only('updates', function () {

        it('new matching query', function (done) {
            console.log('start new matching query');
            mapInitialData(function () {
                rq = mapping.reactiveQuery({age__lt: 30});
                rq.init(function (err) {
                    if (err) done(err);
                    else {
                        mapData({name: 'Peter', age: 21, id: 4}, function (peter) {
                            try {
                                assert.equal(rq.results.length, 3, 'Should now be 3 results');
                                assert.include(rq.results, peter, 'The results should include peter');
                                _.each(rq.results, function (r) {
                                    assert.ok(r.age < 30, 'All results should be younger than 30')
                                });
                                console.log('end new matching query');
                                done();
                            }
                            catch (e) {
                                done(e);
                            }
                        }, done);
                    }
                });
            }, done);
        });

        it('new, not matching query', function (done) {
            console.log('start new, not matching query');
            mapInitialData(function () {
                rq = mapping.reactiveQuery({age__lt: 30});
                rq.init(function (err) {
                    if (err) done(err);
                    else {
                        mapData({name: 'Peter', age: 33, id: 4}, function (peter) {
                            console.log('map data succeeded');
                            try {
                                assert.equal(rq.results.length, 2, 'Should still be 2 results');
                                assert.notInclude(rq.results, peter, 'The results should not include peter');
                                _.each(rq.results, function (r) {
                                    assert.ok(r.age < 30, 'All results should be younger than 30')
                                });
                                console.log('end new, not matching query');
                                done();
                            }
                            catch (e) {
                                done(e);
                            }
                        }, done);
                    }
                });
            }, done);
        });

        it('update, no longer matching', function (done) {
            mapInitialData(function (res) {
                var person = res[0];
                console.log('person', person);
                person.age = 40;
                rq = mapping.reactiveQuery({age__lt: 30});
                rq.init(function (err) {
                    if (err) done(err);
                    else {
                        s.notify(function () {
                            try {
                                assert.equal(rq.results.length, 1, 'Should now only be 1 result');
                                assert.notInclude(rq.results, person, 'The results should not include peter');
                                done();
                            }
                            catch (e) {
                                done(e);
                            }
                        });
                    }
                });

            }, done);
        });

        it('update, still matching', function (done) {
            mapInitialData(function (res) {
                var person = res[0];
                console.log('person', person);
                person.age = 29;
                rq = mapping.reactiveQuery({age__lt: 30});
                rq.init(function (err) {
                    if (err) done(err);
                    else {
                        s.notify(function () {
                            try {
                                assert.equal(rq.results.length, 2, 'Should still be 2 results');
                                done();
                            }
                            catch (e) {
                                done(e);
                            }
                        });
                    }
                });
            }, done);
        });

        it('removal', function (done) {
            mapInitialData(function (res) {
                var person = res[0];
                rq = mapping.reactiveQuery({age__lt: 30});
                rq.init(function (err) {
                    person.remove(function () {
                        if (err) done(err);
                        else {
                            s.notify(function () {
                                try {
                                    assert.equal(rq.results.length, 1, 'Should now only be 1 result');
                                    assert.notInclude(rq.results, person, 'The results should not include peter');
                                    done();
                                }
                                catch (e) {
                                    done(e);
                                }
                            });
                        }
                    });
                });

            }, done);
        });

    });


});