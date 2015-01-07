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
    });


});