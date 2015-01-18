/**
 * This spec tests that removal of the old siesta.install() step that was required before use has been removed correctly
 */

var assert = require('chai').assert;

describe('install step', function () {
    var MyCollection, Person;

    beforeEach(function (done) {
        siesta.reset(done);
    });

    describe('no storage', function () {
        before(function () {
            siesta.ext.storageEnabled = false;
        });

        beforeEach(function () {
            MyCollection = siesta.collection('MyCollection');
            Person = MyCollection.model('Person', {
                id: 'id',
                attributes: ['name', 'age', 'index']
            });
        });

        it('map', function (done) {
            Person.map({name: 'Mike', age: 24})
                .then(function () {
                    done();
                })
                .catch(done);
        });

        it('query', function (done) {
            Person.query({age__gt: 23})
                .then(function (res) {
                    assert.notOk(res.length, 'Should be no results');
                    done();
                })
                .catch(done);
        });

        it('reactive query', function (done) {
            var rq = Person.reactiveQuery({age__lt: 30});
            rq.init()
                .then(function () {
                    assert.notOk(rq.results.length);
                    rq.terminate();
                    done();
                })
                .catch(done);
        });

        it('arranged reactive query', function (done) {
            var rq = Person.arrangedReactiveQuery({age__lt: 30});
            rq.init()
                .then(function () {
                    assert.notOk(rq.results.length);
                    rq.terminate();
                    done();
                })
                .catch(done);
        });

        it('should not be able to define a model after install', function (done) {
            siesta.install().then(function () {
                assert.throws(function () {
                    MyCollection.model('AnotherModel', {
                        id: 'id',
                        attributes: ['something']
                    });
                }, Error);

                done();
            }).catch(done);
        })
    });

    describe('storage', function () {
        before(function () {
            siesta.ext.storageEnabled = true;
        });

        after(function (done) {
            siesta.reset(function () {
                siesta.ext.storageEnabled = false;
                siesta.ext.storage._pouch.allDocs().then(function (resp) {
                    done();
                });
            })
        });

        beforeEach(function () {
            MyCollection = siesta.collection('MyCollection');
            Person = MyCollection.model('Person', {
                id: 'id',
                attributes: ['name', 'age', 'index']
            });
        });

        it('map', function (done) {
            Person.map({name: 'Mike', age: 24})
                .then(function () {
                    done();
                })
                .catch(done);
        });


        it('query', function (done) {
            siesta.ext.storage._pouch.bulkDocs([
                {collection: 'MyCollection', model: 'Person', name: 'Mike', age: 24},
                {collection: 'MyCollection', model: 'Person', name: 'Bob', age: 21}
            ]).then(function () {
                Person.query({age__gt: 23})
                    .then(function (res) {
                        assert.equal(res.length, 1, 'Should have installed and loaded before returning from the query');
                        done();
                    })
                    .catch(done);
            }).catch(done);
        });


        it('reactive query', function (done) {
            siesta.ext.storage._pouch.bulkDocs([
                {collection: 'MyCollection', model: 'Person', name: 'Mike', age: 24},
                {collection: 'MyCollection', model: 'Person', name: 'Bob', age: 21}
            ]).then(function () {
                var rq = Person.reactiveQuery({age__gt: 23});
                rq.init()
                    .then(function () {
                        assert.equal(rq.results.length, 1, 'Should have installed and loaded before returning from the query');
                        rq.terminate();
                        done();
                    })
                    .catch(done);
            }).catch(done);
        });

        it('arranged reactive query', function (done) {
            siesta.ext.storage._pouch.bulkDocs([
                {collection: 'MyCollection', model: 'Person', name: 'Mike', age: 24},
                {collection: 'MyCollection', model: 'Person', name: 'Bob', age: 21}
            ]).then(function () {
                var rq = Person.arrangedReactiveQuery({age__gt: 23});
                rq.init()
                    .then(function () {
                        assert.equal(rq.results.length, 1, 'Should have installed and loaded before returning from the query');
                        rq.terminate();
                        done();
                    })
                    .catch(done);
            }).catch(done);
        });


    });

});