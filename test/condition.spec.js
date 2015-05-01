var assert = require('chai').assert,
  Condition = siesta.lib.Condition;

describe('conditions', function() {
  it('bulk', function(done) {
    var c1_completed = false;
    var c2_completed = false;
    var c1 = new Condition(function(done) {
      done();
      c1_completed = true;
    });
    var c2 = new Condition(function(done) {
      done();
      c2_completed = true;
    });
    var c3 = new Condition([c1, c2]);
    c3.then(function(res) {
      console.log('res', res);
      assert.ok(c1_completed);
      assert.ok(c2_completed);
      done();
    });
  });
});
