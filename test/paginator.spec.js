var s = require('../core/index');
var assert = require('chai').assert;

describe('paginator', function() {
    before(function () {
        s.ext.storageEnabled = false;
    });
    var Car;

    var cache = require('../core/cache');
    beforeEach(function(done) {
        s.reset(function () {
            var Coll = s.collection('myCollection');
            Car = Coll.model('Car', {
                id: 'id',
                attributes: ['colour', 'name']
            });
            s.install(done);
        });
    });

    it('xyz', function () {

    })

});