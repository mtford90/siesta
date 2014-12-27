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
            prq.init(done);
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
            prq.init(done);
        });
    });

});