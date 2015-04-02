var assert = require('chai').assert,
  util = siesta._internal.util;

describe('conditions', function() {
  it('composite, single', function(done) {
    var c = new util.Condition(function(cb) { cb()});
    var c2 = new util.Condition([c]);
    c2.when(function() {
      assert.ok(c._ready);
      done();
    });
    c.set();
  });
  it('composite, multiple', function(done) {
    var conditions = [
      new util.Condition(function(cb) { cb()}),
      new util.Condition(function(cb) { cb()}),
      new util.Condition(function(cb) { cb()})
    ];
    var c2 = new util.Condition(conditions);
    c2.when(function() {
      conditions.forEach(function(c) {
        assert.ok(c._ready);
      });
      done();
    });
  });
  it('composite, multiple, async', function(done) {
    var conditions = [
      new util.Condition(function(cb) { setTimeout(cb, 2)}),
      new util.Condition(function(cb) { setTimeout(cb, 3)}),
      new util.Condition(function(cb) { setTimeout(cb, 1)})
    ];
    var c2 = new util.Condition(conditions);
    c2.when(function() {
      conditions.forEach(function(c) {
        assert.ok(c._ready);
      });
      done();
    });
  });
  it('composite, multiple, mix async, sync', function(done) {
    var conditions = [
      new util.Condition(function(cb) { setTimeout(cb, 2)}),
      new util.Condition(function(cb) { cb()}),
      new util.Condition(function(cb) { setTimeout(cb, 1)})
    ];
    var c2 = new util.Condition(conditions);
    c2.when(function() {
      conditions.forEach(function(c) {
        assert.ok(c._ready);
      });
      done();
    });
  });
  it('composite, multiple, one error', function(done) {
    var conditions = [
      new util.Condition(function(cb) { setTimeout(cb, 2)}),
      new util.Condition(function(cb) { cb('err')}),
      new util.Condition(function(cb) { setTimeout(cb, 1)})
    ];
    var c2 = new util.Condition(conditions);
    c2.when(function() {
      done('should not succeed');
    }).fail(function(err) {
      assert.ok(conditions[0]._ready);
      assert.notOk(conditions[1]._ready);
      assert.ok(conditions[1]._err);
      assert.ok(conditions[2]._ready);
      assert.ok(err);
      done();
    })
  });
});