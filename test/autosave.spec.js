var s = require('../core/index'),
    assert = require('chai').assert;

var Collection = s.Collection;

describe.only('auto save', function() {
    var MyCollection, Person;
    before(function() {
        s.ext.storageEnabled = true;
    });

    beforeEach(function(done) {
        s.reset(function() {
            MyCollection = s.collection('MyCollection');
            Person = MyCollection.model('Person', {
                id: 'id',
                attributes: ['name', 'age']
            });
            s.install(done);
        });
    });

    it('autosaves on changes if enabled', function (done) {
        s.autosave = true;
        Person.map({name: 'Mike', age: 24})
            .then(function () {
                s.ext.storage._pouch.allDocs()
                    .then(function (resp) {
                        assert.ok(resp.rows.length, 'Should be a row');
                        var person = resp.rows[0];
                        done();
                    })
                    .catch(done);
            })
            .catch(done)
            .done();
    });

    it('does not autosave on changes if disabled', function (done) {
        s.autosave = false;
        Person.map({name: 'Mike', age: 24})
            .then(function () {
                s.ext.storage._pouch.allDocs()
                    .then(function (resp) {
                        assert.notOk(resp.rows.length, 'Should be no rows');
                        done();
                    })
                    .catch(done);
            })
            .catch(done)
            .done();
    });
});