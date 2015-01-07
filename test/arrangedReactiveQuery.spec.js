var s = require('../core/index'),
    assert = require('chai').assert;

describe('positioned rquery', function () {
    var MyCollection, Person;
    before(function () {
        s.ext.storageEnabled = false;
    });
    beforeEach(function (done) {
        s.reset(done);
    });
    it('no index field', function (done) {
        MyCollection = s.collection('MyCollection');
        Person = MyCollection.model('Person', {
            id: 'id',
            attributes: ['name', 'age']
        });
        var prq = Person.arrangedReactiveQuery();
        prq.init(function (err) {
            assert.ok(err);
            prq.terminate();
            done();
        })
    });
    it('default index field', function (done) {
        MyCollection = s.collection('MyCollection');
        Person = MyCollection.model('Person', {
            id: 'id',
            attributes: ['name', 'age', 'index']
        });
        // Just checking doesn't throw an error.
        var prq = Person.arrangedReactiveQuery();
        prq.init().then(function () {
            prq.terminate();
            done();
        }).catch(done);
    });
    it('custom index field', function (done) {
        MyCollection = s.collection('MyCollection');
        Person = MyCollection.model('Person', {
            id: 'id',
            attributes: ['name', 'age', 'customIndexField']
        });
        // Just checking doesn't throw an error.
        var prq = Person.arrangedReactiveQuery();
        prq.indexAttribute = 'customIndexField';
        prq.init().then(function () {
            prq.terminate();
            done();
        }).catch(done);
    });

    describe('ordering', function () {
        beforeEach(function (done) {
            MyCollection = s.collection('MyCollection');
            Person = MyCollection.model('Person', {
                id: 'id',
                attributes: ['name', 'age', 'index']
            });
            Person.map([
                {name: 'Michael', age: 24},
                {name: 'Bob', age: 30},
                {name: 'John', age: 26}
            ]).then(function () {done()}).catch(done);

        });
        it('order before init', function (done) {
            var prq = Person.arrangedReactiveQuery();
            prq.orderBy('age');
            prq.init()
                .then(function () {
                    Person.all().orderBy('age')
                        .execute()
                        .then(function (people) {
                            for (var i = 0; i < people.length; i++) {
                                assert.equal(people[i].index, i);
                            }
                            prq.terminate();
                            done();
                        })
                        .catch(done).done();
                })
                .catch(done).done();
        });
        it('order after init', function (done) {
            var prq = Person.arrangedReactiveQuery();
            prq.init()
                .then(function () {
                    prq.orderBy('age')
                        .then(function () {
                            Person.all().orderBy('age')
                                .execute()
                                .then(function (people) {
                                    for (var i = 0; i < people.length; i++) {
                                        assert.equal(people[i].index, i);
                                    }
                                    prq.terminate();
                                    done();
                                })
                                .catch(done).done();
                        })
                        .catch(done);
                })
                .catch(done);

        });
        it('change order should not rearrange anything if ordered by before init', function (done) {
            var prq = Person.arrangedReactiveQuery();
            prq.orderBy('age');
            prq.init()
                .then(function () {
                    assert.notOk(prq._query.ordering);
                    Person.query({name: 'Michael'})
                        .execute()
                        .then(function (people) {
                            var mike = people[0];
                            assert.notEqual(prq.results[prq.results.length - 1], mike, 'should not already be arranged');
                            mike.age = 40;
                            s.notify(function () {
                                assert.notEqual(prq.results[prq.results.length - 1], mike, 'should not have rearranged');
                                prq.terminate();
                                done();
                            })
                        }).catch(done).done();

                })
                .catch(done).done();
        });
        it('change order should not rearrange anything if ordered by after init', function (done) {
            var prq = Person.arrangedReactiveQuery();
            prq.init()
                .then(function () {
                    prq.orderBy('age');
                    assert.notOk(prq._query.ordering);
                    Person.query({name: 'Michael'})
                        .execute()
                        .then(function (people) {
                            var mike = people[0];
                            assert.notEqual(prq.results[prq.results.length - 1], mike, 'should not already be arranged');
                            mike.age = 40;
                            s.notify(function () {
                                assert.notEqual(prq.results[prq.results.length - 1], mike, 'should not have rearranged');
                                prq.terminate();
                                done();
                            })
                        }).catch(done).done();

                })
                .catch(done).done();
        });
    });

    describe('reordering', function () {
        beforeEach(function (done) {
            MyCollection = s.collection('MyCollection');
            Person = MyCollection.model('Person', {
                id: 'id',
                attributes: ['name', 'age', 'customIndexField']
            });
            Person.map([
                {name: 'Michael', age: 24},
                {name: 'Bob', age: 30},
                {name: 'John', age: 26}
            ]).then(function () { done() }).catch(done);
        });

        it('swapObjectsAtIndexes', function (done) {
            var prq = Person.arrangedReactiveQuery();
            prq.orderBy('age');
            prq.indexAttribute = 'customIndexField';
            prq.init().then(function () {
                var mike = prq.results[0],
                    bob = prq.results[1],
                    john = prq.results[2];
                prq.swapObjectsAtIndexes(0, 1);
                assert.equal(prq.results[0], bob);
                assert.equal(prq.results[1], mike);
                assert.equal(prq.results[2], john);
                for (var i = 0; i < prq.results.length; i++) {
                    assert.equal(prq.results[i][prq.indexAttribute], i);
                }
                prq.terminate();
                done();
            }).catch(done);
        });

        it('swapObjectsAtIndexes, non-existant to index should throw error', function (done) {
            var prq = Person.arrangedReactiveQuery();
            prq.orderBy('age');
            prq.indexAttribute = 'customIndexField';
            prq.init().then(function () {
                assert.throws(function () {
                    prq.swapObjectsAtIndexes(0, 4);
                }, Error);
                prq.terminate();
                done();
            }).catch(done);
        });

        it('swapObjectsAtIndexes, non-existant from index should throw error', function (done) {
            var prq = Person.arrangedReactiveQuery();
            prq.orderBy('age');
            prq.indexAttribute = 'customIndexField';
            prq.init().then(function () {
                assert.throws(function () {
                    prq.swapObjectsAtIndexes(4, 0);
                }, Error);
                prq.terminate();
                done();
            }).catch(done);
        });

        it('swapObjects', function (done) {
            var prq = Person.arrangedReactiveQuery();
            prq.orderBy('age');
            prq.indexAttribute = 'customIndexField';
            prq.init().then(function () {
                var mike = prq.results[0],
                    bob = prq.results[1],
                    john = prq.results[2];
                prq.swapObjects(mike, bob);
                assert.equal(prq.results[0], bob);
                assert.equal(prq.results[1], mike);
                assert.equal(prq.results[2], john);
                for (var i = 0; i < prq.results.length; i++) {
                    assert.equal(prq.results[i][prq.indexAttribute], i);
                }
                prq.terminate();
                done();
            }).catch(done);
        });

        it('swapObjects, non-existant to index should throw error', function (done) {
            var prq = Person.arrangedReactiveQuery();
            prq.orderBy('age');
            prq.indexAttribute = 'customIndexField';
            prq.init().then(function () {
                var mike = prq.results[0];
                assert.throws(function () {
                    prq.swapObjectsAtIndexes(mike, {});
                }, Error);
                prq.terminate();
                done();
            }).catch(done);
        });

        it('swapObjects, non-existant from index should throw error', function (done) {
            var prq = Person.arrangedReactiveQuery();
            prq.orderBy('age');
            prq.indexAttribute = 'customIndexField';
            prq.init().then(function () {
                var mike = prq.results[0];
                assert.throws(function () {
                    prq.swapObjectsAtIndexes({}, mike);
                }, Error);
                prq.terminate();
                done();
            }).catch(done);
        });

        it('move', function (done) {
            var prq = Person.arrangedReactiveQuery();
            prq.orderBy('age');
            prq.indexAttribute = 'customIndexField';
            prq.init().then(function () {
                var mike = prq.results[0],
                    bob = prq.results[1],
                    john = prq.results[2];
                prq.move(2, 0);
                assert.equal(prq.results[0], john);
                assert.equal(prq.results[1], mike);
                assert.equal(prq.results[2], bob);
                for (var i = 0; i < prq.results.length; i++) {
                    assert.equal(prq.results[i][prq.indexAttribute], i);
                }
                prq.terminate();
                done();
            }).catch(function (err) {
                prq.terminate();
                done(err);
            });
        });


    });

    describe('indices exist', function () {
        beforeEach(function () {
            MyCollection = s.collection('MyCollection');
            Person = MyCollection.model('Person', {
                id: 'id',
                attributes: ['name', 'age', 'customIndexField']
            });
        });
        describe('full range of indexes exists', function () {
            beforeEach(function (done) {
                Person.map([
                    {name: 'Michael', age: 24, customIndexField: 0},
                    {name: 'Bob', age: 30, customIndexField: 1},
                    {name: 'John', age: 26, customIndexField: 2}
                ]).then(function () {
                    done();
                })
                    .catch(done)
                    .done();
            });

            it('if order before init, should retain order from old indexes', function (done) {
                var prq = Person.arrangedReactiveQuery();
                prq.indexAttribute = 'customIndexField';
                prq.orderBy('age');
                prq.init()
                    .then(function () {
                        var people = prq.results;
                        assert.equal(people[0].name, 'Michael');
                        assert.equal(people[1].name, 'Bob');
                        assert.equal(people[2].name, 'John');
                        for (var i = 0; i < people.length; i++) {
                            assert.equal(people[i].customIndexField, i);
                        }
                        prq.terminate();
                        done();
                    })
                    .catch(done).done();
            });

            it('if order after init, should have new order', function (done) {
                var prq = Person.arrangedReactiveQuery();
                prq.indexAttribute = 'customIndexField';
                prq.init()
                    .then(function () {
                        prq.orderBy('age')
                            .then(function () {
                                var people = prq.results;
                                assert(people[0].age < people[1].age);
                                assert(people[1].age < people[2].age);
                                for (var i = 0; i < people.length; i++) {
                                    assert.equal(people[i].customIndexField, i);
                                }
                                prq.terminate();
                                done();
                            })
                            .catch(done)
                            .done();
                    })
                    .catch(done).done();
            });
        });
        it('some indexes exists, nicely ordered', function (done) {
            Person.map([
                {name: 'Michael', age: 24, customIndexField: 0},
                {name: 'Bob', age: 30},
                {name: 'John', age: 26, customIndexField: 1}
            ]).then(function () {
                var prq = Person.arrangedReactiveQuery();
                prq.indexAttribute = 'customIndexField';
                prq.orderBy('age');
                prq.init()
                    .then(function () {
                        var people = prq.results;
                        assert.equal(people[0].name, 'Michael');
                        assert.equal(people[1].name, 'John');
                        assert.equal(people[2].name, 'Bob');
                        for (var i = 0; i < people.length; i++) {
                            assert.equal(people[i].customIndexField, i);
                        }
                        prq.terminate();
                        done();
                    })
                    .catch(done).done();
            })
                .catch(done)
                .done();
        });

        it('some indexes exists, sparse', function (done) {
            Person.map([
                {name: 'Michael', age: 24, customIndexField: 0},
                {name: 'Bob', age: 30},
                {name: 'John', age: 26, customIndexField: 2}
            ]).then(function () {
                var prq = Person.arrangedReactiveQuery();
                prq.indexAttribute = 'customIndexField';
                prq.orderBy('age');
                prq.init()
                    .then(function () {
                        var people = prq.results;
                        assert.equal(people[0].name, 'Michael');
                        assert.equal(people[1].name, 'Bob');
                        assert.equal(people[2].name, 'John');
                        for (var i = 0; i < people.length; i++) {
                            assert.equal(people[i].customIndexField, i);
                        }
                        prq.terminate();
                        done();
                    })
                    .catch(done).done();
            })
                .catch(done)
                .done();
        });

        it('some indexes exists, very sparse', function (done) {
            Person.map([
                {name: 'Michael', age: 24, customIndexField: 2},
                {name: 'Bob', age: 30},
                {name: 'Peter', age: 21},
                {name: 'John', age: 26}
            ]).then(function () {
                var prq = Person.arrangedReactiveQuery();
                prq.indexAttribute = 'customIndexField';
                prq.orderBy('age');
                prq.init()
                    .then(function () {
                        var people = prq.results;
                        assert.equal(people[0].name, 'Peter');
                        assert.equal(people[1].name, 'John');
                        assert.equal(people[2].name, 'Michael');
                        assert.equal(people[3].name, 'Bob');
                        for (var i = 0; i < people.length; i++) {
                            assert.equal(people[i].customIndexField, i);
                        }
                        prq.terminate();
                        done();
                    })
                    .catch(done).done();
            })
                .catch(done)
                .done();
        });

        it('out of range index should rejig the indexes', function (done) {
            Person.map([
                {name: 'Michael', age: 24, customIndexField: 6},
                {name: 'Jane', age: 41, customIndexField: 10},
                {name: 'Bob', age: 30},
                {name: 'Peter', age: 21},
                {name: 'John', age: 26}
            ]).then(function () {
                var prq = Person.arrangedReactiveQuery();
                prq.indexAttribute = 'customIndexField';
                prq.orderBy('age');
                prq.init()
                    .then(function () {
                        var people = prq.results;
                        assert.equal(people[0].name, 'Peter');
                        assert.equal(people[1].name, 'John');
                        assert.equal(people[2].name, 'Bob');
                        assert.equal(people[3].name, 'Michael');
                        assert.equal(people[4].name, 'Jane');
                        for (var i = 0; i < people.length; i++) {
                            assert.equal(people[i].customIndexField, i);
                        }
                        prq.terminate();
                        done();
                    })
                    .catch(done).done();
            })
                .catch(done)
                .done();
        });
        it('duplicate indexes', function (done) {
            Person.map([
                {name: 'Michael', age: 24, customIndexField: 1},
                {name: 'Jane', age: 41, customIndexField: 1},
                {name: 'Bob', age: 30},
                {name: 'Peter', age: 21},
                {name: 'John', age: 26}
            ]).then(function () {
                var prq = Person.arrangedReactiveQuery();
                prq.indexAttribute = 'customIndexField';
                prq.orderBy('age');
                prq.init()
                    .then(function () {
                        var people = prq.results;
                        assert.equal(people[0].name, 'Peter');
                        assert.equal(people[1].name, 'Michael');
                        assert.equal(people[2].name, 'John');
                        assert.equal(people[3].name, 'Bob');
                        assert.equal(people[4].name, 'Jane');
                        for (var i = 0; i < people.length; i++) {
                            assert.equal(people[i].customIndexField, i);
                        }
                        prq.terminate();
                        done();
                    })
                    .catch(function (err) {
                        prq.terminate();
                        done(err);
                    }).done();
            })
                .catch(done)
                .done();
        });

    });

    describe('insertion policy', function () {
        beforeEach(function (done) {
            MyCollection = s.collection('MyCollection');
            Person = MyCollection.model('Person', {
                id: 'id',
                attributes: ['name', 'age', 'customIndexField']
            });
            Person.map([
                {name: 'Michael', age: 24},
                {name: 'Bob', age: 30},
                {name: 'John', age: 26}
            ]).then(function () {done()}).catch(done);
        });
        it('by default, insert at back', function (done) {
            var prq = Person.arrangedReactiveQuery();
            prq.indexAttribute = 'customIndexField';
            prq.orderBy('age');
            prq.init()
                .then(function () {
                    Person.map({name: 'Jane', age: 40})
                        .then(function (jane) {
                            var people = prq.results;
                            assert.equal(people.length, 4);
                            assert.equal(people[people.length - 1], jane);
                            for (var i = 0; i < people.length; i++) {
                                assert.equal(people[i].customIndexField, i);
                            }
                            prq.terminate();
                            done();
                        })
                        .catch(done);
                })
                .catch(done);
        });
        it('if Back, insert at back', function (done) {
            var prq = Person.arrangedReactiveQuery();
            prq.indexAttribute = 'customIndexField';
            prq.insertionPolicy = s.InsertionPolicy.Back;
            prq.orderBy('age');
            prq.init()
                .then(function () {
                    Person.map({name: 'Jane', age: 40})
                        .then(function (jane) {
                            var people = prq.results;
                            assert.equal(people.length, 4);
                            assert.equal(people[people.length - 1], jane);
                            for (var i = 0; i < people.length; i++) {
                                assert.equal(people[i].customIndexField, i);
                            }
                            prq.terminate();
                            done();
                        })
                        .catch(done);
                })
                .catch(done);
        });
        it('if Front, insert at front', function (done) {
            var prq = Person.arrangedReactiveQuery();
            prq.indexAttribute = 'customIndexField';
            prq.insertionPolicy = s.InsertionPolicy.Front;
            prq.orderBy('age');
            prq.init()
                .then(function () {
                    Person.map({name: 'Jane', age: 40})
                        .then(function (jane) {
                            var people = prq.results;
                            assert.equal(people.length, 4);
                            assert.equal(people[0], jane);
                            for (var i = 0; i < people.length; i++) {
                                assert.equal(people[i].customIndexField, i);
                            }
                            prq.terminate();
                            done();
                        })
                        .catch(done);
                })
                .catch(done);
        });
    });

})
;

