var s = require('../core/index'),
    assert = require('chai').assert;

describe('positioned reactive query', function () {
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
        s.install(function () {
            var prq = Person.positionalReactiveQuery();
            prq.init(function (err) {
                assert.ok(err);
                prq.terminate();
                done();
            })
        });
    });
    it('default index field', function (done) {
        MyCollection = s.collection('MyCollection');
        Person = MyCollection.model('Person', {
            id: 'id',
            attributes: ['name', 'age', 'index']
        });
        s.install(function () {
            // Just checking doesn't throw an error.
            var prq = Person.positionalReactiveQuery();
            prq.init().then(function () {
                prq.terminate();
                done();
            }).catch(done);
        });
    });
    it('custom index field', function (done) {
        MyCollection = s.collection('MyCollection');
        Person = MyCollection.model('Person', {
            id: 'id',
            attributes: ['name', 'age', 'customIndexField']
        });
        s.install(function () {
            // Just checking doesn't throw an error.
            var prq = Person.positionalReactiveQuery();
            prq.indexField = 'customIndexField';
            prq.init().then(function () {
                prq.terminate();
                done();
            }).catch(done);
        });
    });

    describe('ordering', function () {
        beforeEach(function (done) {
            MyCollection = s.collection('MyCollection');
            Person = MyCollection.model('Person', {
                id: 'id',
                attributes: ['name', 'age', 'index']
            });
            s.install()
                .then(Person.map([
                    {name: 'Michael', age: 24},
                    {name: 'Bob', age: 30},
                    {name: 'John', age: 26}
                ]))
                .then(done)
                .catch(done)
                .done();
        });
        it('order before init', function (done) {
            var prq = Person.positionalReactiveQuery();
            prq.orderBy('age');
            prq.init()
                .then(function () {
                    Person.all().orderBy('age')
                        .execute()
                        .then(function (people) {
                            console.log('people', _.pluck(people, 'age'));
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
            var prq = Person.positionalReactiveQuery();
            prq.init()
                .then(function () {
                    prq.orderBy('age')
                        .then(function () {
                            Person.all().orderBy('age')
                                .execute()
                                .then(function (people) {
                                    console.log('people', _.pluck(people, 'age'));
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
            var prq = Person.positionalReactiveQuery();
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
            var prq = Person.positionalReactiveQuery();
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
});

