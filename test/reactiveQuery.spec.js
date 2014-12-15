var s = require('../core/index'),
    assert = require('chai').assert;

var Collection = s.Collection;

describe.only('reactive query', function () {
    var collection, mapping;

    beforeEach(function (done) {
        collection = new Collection('myCollection');
        mapping = collection.mapping('Person', {
            id: 'id',
            attributes: ['name', 'age']
        });
        collection.install(done);
    });

    function mapInitialData(cb, done) {
        mapping.map([
            {
                name: 'Bob',
                age: 19
            },
            {
                name: 'Mike',
                age: 24
            },
            {
                name: 'John',
                age: 40
            }
        ], function (err, results) {
            if (err) done(err);
            else  cb(results);
        });
    }

    it('initial', function (done) {
        mapInitialData(function () {
            var rq = mapping.reactiveQuery({age__lt: 30});
            assert.notOk(rq.initialised, 'Should not yet be initialised');
            rq.init(function (err, results) {
                if (err) done(err);
                else {
                    assert.ok(rq.initialised, 'Should be initialised');
                    assert.equal(rq.results.length, 2, 'Should be 2 results');
                    _.each(rq.results, function (r) {
                        assert.ok(r.age < 30, 'All results should be younger than 30')
                    });
                    done();
                }
            });
        }, done);
    });
});