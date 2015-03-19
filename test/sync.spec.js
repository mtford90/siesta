var assert = require('chai').assert;

describe.only('syncext', function () {

  before(function () {
    siesta.ext.syncEnabled = true;
  });

  beforeEach(function (done) {
    siesta.reset(done);
  });

  describe('override', function () {
    var Collection, Model;
    beforeEach(function () {
      Collection = siesta.collection('Collection');
      Model = Collection.model('Model', {
        attributes: ['attr']
      });
    });

    it('xyz', function () {
      var sync = Collection.sync('http://blah.com');
    })
  });

});