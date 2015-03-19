var assert = require('chai').assert;

describe.only('syncext', function () {

  before(function () {
    siesta.ext.syncEnabled = true;
  });

  beforeEach(function (done) {
    siesta.reset(done);
  });

  it('xyz', function () {

  })
});