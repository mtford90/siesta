var assert = require('chai').assert;

describe('to sort', function() {
  var Model, Collection;

    var app = siesta.app;
  before(function() {
    app.storageEnabled = false;
  });
  beforeEach(function(done) {
    app.reset(done);
  });

  describe('get by localid', function() {
    it('exists', function(done) {
      Collection = siesta.collection('myCollection');
      Model = Collection.model('Car', {
        attributes: ['name']
      });
      Model
        .graph({x: 1})
        .then(function(instance) {
          var id = instance.localId;
          app
            .get(id)
            .then(function(_instance) {
              assert.equal(instance, _instance);
              done();
            })
            .catch(done);
        }).catch(done);
    });
    it('does not exist', function(done) {
      Collection = siesta.collection('myCollection');
      Model = Collection.model('Car', {
        attributes: ['name']
      });
      Model
        .graph({x: 1})
        .then(function(instance) {
          app
            .get('sdfsdfsdf')
            .then(function(_instance) {
              assert.notOk(_instance);
              done();
            });
        }).catch(done);
    });
  });


});
