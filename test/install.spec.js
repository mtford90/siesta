/**
 * This spec tests that removal of the old siesta.install() step that was required before use has been removed correctly
 */

var s = require('../core/index'),
    assert = require('chai').assert;

describe('install step', function () {
    var MyCollection, Person;

    beforeEach(function (done) {
        s.reset(done);
    });

    describe('no storage', function () {
        before(function () {
            s.ext.storageEnabled = false;
        });

        beforeEach(function () {
            MyCollection = s.collection('MyCollection');
            Person = MyCollection.model('Person', {
                id: 'id',
                attributes: ['name', 'age']
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
                .execute()
                .then(function (res) {
                    assert.notOk(res.length, 'Should be no results');
                    done();
                })
                .catch(done);
        });
    });

    describe('storage', function () {
        before(function () {
            s.ext.storageEnabled = true;
        });

        beforeEach(function () {
            MyCollection = s.collection('MyCollection');
            Person = MyCollection.model('Person', {
                id: 'id',
                attributes: ['name', 'age']
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
            s.ext.storage._pouch.bulkDocs([
                {collection: 'MyCollection', model: 'Person', name: 'Mike', age: 24},
                {collection: 'MyCollection', model: 'Person', name: 'Bob', age: 21}
            ]).then(function () {
                Person.query({age__gt: 23})
                    .execute()
                    .then(function (res) {
                        assert.equal(res.length, 1, 'Should have installed and loaded before returning from the query');
                        done();
                    })
                    .catch(done);
            }).catch(done);
        });
    });


});