var assert = require('chai').assert;

describe('to sort', function() {
  var Model, Collection;

  before(function() {
    siesta.ext.storageEnabled = false;
  });
  beforeEach(function(done) {
    siesta.reset(done);
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
          siesta
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
          siesta
            .get('sdfsdfsdf')
            .then(function(_instance) {
              assert.notOk(_instance);
              done();
            });
        }).catch(done);
    });
  });


});