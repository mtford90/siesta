var assert = require('chai').assert,
  async2 = siesta._internal.util.async2;

describe('async2', function() {
  describe('parallel', function() {
    it('single, no res', function(done) {
      async2.parallel([
        function(done) {
          setTimeout(function() {
            done();
          }, 4);
        }
      ], function(err) {
        assert.notOk(err);
        done();
      });
    });
    it('single, res', function(done) {
      async2.parallel([
        function(done) {
          setTimeout(function() {
            done(null, 'res');
          }, 1);
        }
      ], function(err, res) {
        assert.notOk(err);
        console.log('res', res);
        assert.equal(res.length, 1);
        assert.equal(res[0], 'res');
        done();
      });
    });
    it('multiple, res, err', function(done) {
      async2.parallel([
        function(done) {
          setTimeout(function() {
            done(null, 'res');
          }, 5);
        },
        function(done) {
          setTimeout(function() {
            done('err');
          }, 1);
        },
        function(done) {
          done(null, 'res');
        }

      ], function(err, res, all) {
        console.log('res', res);
        assert.equal(res.length, 2);
        assert.equal(res[0], 'res');
        assert.equal(res[1], 'res');
        assert.ok(err, 'err should be present');
        assert.equal(err.length, 1);
        assert.equal(err[0], 'err');
        assert.ok(all, 'all should be present');
        assert.equal(all.results[0], 'res');
        assert.notOk(all.results[1]);
        assert.equal(all.results[2], 'res');
        done();
      });
    });
    it('single, no res, err', function(done) {
      async2.parallel([
        function(done) {
          done('err');
        }
      ], function(err) {
        assert.equal(err.length, 1);
        assert.equal(err[0], 'err');
        done();
      });
    });
    it('multiple, no res', function(done) {
      var n = 0,
        task = function(done) {
          n++;
          setTimeout(function() {
            done();
          }, 1);
        };
      async2.parallel([
        task,
        task,
        task
      ], function(err) {
        assert.notOk(err);
        assert.equal(n, 3);
        done();
      });
    });
    it('multiple, no res, 1 err', function(done) {
      var n = 0,
        taskSuccess = function(done) {
          n++;
          done();
        };
      async2.parallel([
        taskSuccess,
        function(done) {
          n++;
          setTimeout(function() {
            done('wtf');
          })
        },
        taskSuccess
      ], function(err, res, map) {
        assert.equal(err.length, 1);
        assert.equal(err[0], 'wtf');
        assert.equal(map.errors[1], 'wtf');
        done();
      });
    });

    it('allow throw error', function() {
      var n = 0,
        task = function(done) {
          n++;
          done();
        };
      assert.throws(function() {
        async2.parallel([
          task,
          function() {
            throw Error('wtf');
          },
          task
        ], function(err) {
          assert.notOk(err);
          assert.equal(n, 3);
        });
      })
    });
  });
});