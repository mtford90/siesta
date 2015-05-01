var assert = require('chai').assert,
  cache = siesta.lib.cache;

describe('change identifiers', function() {

  var Collection, Car;

  var car;

  var app = siesta.createApp('change-identifiers');

  before(function() {
    app.storage = false;
  });
  beforeEach(function(done) {
    app.reset(function() {
      Collection = app.collection('myCollection');
      Car = Collection.model('Car', {
        id: 'id',
        attributes: ['colour', 'name']
      });
      Car.graph({id: 'xyz', colour: 'red', name: 'ford'}, function(err, _car) {
        if (err) done(err);
        car = _car;
        done();
      })
    });
  });

  it('xyz', function(done) {
    assert.equal(app.cache.get({id: 'xyz', model: Car}), car);
    car.id = 'abc';
    assert.notOk(app.cache.get({id: 'xyz', model: Car}), car);
    assert.equal(app.cache.get({id: 'abc', model: Car}), car);
    done();
  });

});
