var Promise = require('../core/Promise');
var assert = require('chai').assert;

describe('promises', function() {
  describe('sync', function() {
    it('success', function(done) {
      var payload = {};
      var p = new Promise(function(resolve, reject) {
        resolve(payload);
      });
      p.then(function(_payload) {
        assert.equal(payload, _payload);
        done();
      });
    });
    it('success, chain', function(done) {
      var payload = {};
      var p = new Promise(function(resolve, reject) {
        resolve(payload);
      });
      var n = 0;
      var inc = function(_payload) {
        assert.equal(payload, _payload);
        n++;
      };
      p.then(inc).then(inc).then(inc).then(function() {
        assert.equal(n, 3);
        done();
      })
    });
    it('error, catch', function(done) {
      var payload = {};
      var p = new Promise(function(resolve, reject) {
        reject(payload);
      });
      p.then(function() {
        done(new Error('Should not be called.'));
      }).catch(function(err) {
        assert.equal(payload, err);
        done();
      });
    });
    it('error, then', function(done) {
      var payload = {};
      var p = new Promise(function(resolve, reject) {
        reject(payload);
      });
      p.then(function() {
        done(new Error('Should not be called.'));
      }, function(err) {
        assert.equal(payload, err);
        done();
      });
    });
    it('error, both', function(done) {
      var payload = {};
      var p = new Promise(function(resolve, reject) {
        reject(payload);
      });
      var n = 0;
      var inc = function(err) {
        assert.equal(payload, err);
        n++;
      };
      p.then(function() {
        done(new Error('Should not be called.'));
      }, inc).catch(inc).
        catch(function() {
          assert.equal(n, 2);
          done();
        })
    });


    describe('all', function() {
      it('multiple success', function(done) {
        var p1 = new Promise(function(resolve, reject) {
          resolve();
        });
        var p2 = new Promise(function(resolve, reject) {
          resolve();
        });
        var p3 = new Promise(function(resolve, reject) {
          resolve();
        });
        Promise
          .all([p1, p2, p3])
          .then(function() {
            done();
          })
          .catch(function() {
            done(new Error('Should not fail'));
          })
      });
      it('multiple one fail', function(done) {
        var p1 = new Promise(function(resolve, reject) {
          resolve();
        });
        var p2 = new Promise(function(resolve, reject) {
          reject();
        });
        var p3 = new Promise(function(resolve, reject) {
          resolve();
        });
        Promise
          .all([p1, p2, p3])
          .then(function() {
            done(new Error('Should not succeed'));
          })
          .catch(function() {
            done();
          })
      });
      it('multiple one fail with payload', function(done) {
        var err = {};
        var p1 = new Promise(function(resolve, reject) {
          resolve();
        });
        var p2 = new Promise(function(resolve, reject) {
          reject(err);
        });
        var p3 = new Promise(function(resolve, reject) {
          resolve();
        });
        Promise
          .all([p1, p2, p3])
          .then(function() {
            done(new Error('Should not succeed'));
          })
          .catch(function(_err) {
            assert.equal(err, _err[1]);
            assert.notOk(_err[0]);
            assert.notOk(_err[2]);
            done();
          })
      });
    });
  });
  describe('async', function() {
    it('success', function(done) {
      var payload = {};
      var p = new Promise(function(resolve, reject) {
        setImmediate(function() {
          resolve(payload);
        });
      });
      p.then(function(_payload) {
        assert.equal(payload, _payload);
        done();
      });
    });
    it('success, chain', function(done) {
      var payload = {};
      var p = new Promise(function(resolve, reject) {
        setImmediate(function() {
          resolve(payload);
        });
      });
      var n = 0;
      var inc = function(_payload) {
        assert.equal(payload, _payload);
        n++;
      };
      p.then(inc).then(inc).then(inc).then(function() {
        assert.equal(n, 3);
        done();
      })
    });
    it('error, catch', function(done) {
      var payload = {};
      var p = new Promise(function(resolve, reject) {
        setImmediate(function() {
          reject(payload);
        });
      });
      p.then(function() {
        done(new Error('Should not be called.'));
      }).catch(function(err) {
        assert.equal(payload, err);
        done();
      });
    });
    it('error, then', function(done) {
      var payload = {};
      var p = new Promise(function(resolve, reject) {
        setImmediate(function() {
          reject(payload);
        });
      });
      p.then(function() {
        done(new Error('Should not be called.'));
      }, function(err) {
        assert.equal(payload, err);
        done();
      });
    });
    it('error, both', function(done) {
      var payload = {};
      var p = new Promise(function(resolve, reject) {
        setImmediate(function() {
          reject(payload);
        });
      });
      var n = 0;
      var inc = function(err) {
        assert.equal(payload, err);
        n++;
      };
      p.then(function() {
        done(new Error('Should not be called.'));
      }, inc).catch(inc).
        catch(function() {
          assert.equal(n, 2);
          done();
        });
    });

    describe('all', function() {
      it('multiple success', function(done) {
        var p1 = new Promise(function(resolve, reject) {
          setTimeout(function() {
            resolve();
          }, 1);
        });
        var p2 = new Promise(function(resolve, reject) {
          setTimeout(function() {
            resolve();
          }, 2);
        });
        var p3 = new Promise(function(resolve, reject) {
          setTimeout(function() {
            resolve();
          }, 3);
        });
        Promise
          .all([p1, p2, p3])
          .then(function() {
            done();
          })
          .catch(function() {
            done(new Error('Should not fail'));
          })
      });
      it('multiple one fail', function(done) {
        var p1 = new Promise(function(resolve, reject) {
          setTimeout(function() {
            resolve();
          }, 1);
        });
        var p2 = new Promise(function(resolve, reject) {
          setTimeout(function() {
            reject();
          }, 2);
        });
        var p3 = new Promise(function(resolve, reject) {
          setTimeout(function() {
            resolve();
          }, 3);
        });
        Promise
          .all([p1, p2, p3])
          .then(function() {
            done(new Error('Should not succeed'));
          })
          .catch(function() {
            done();
          })
      });
      it('multiple one fail with payload', function(done) {
        var err = {};
        var p1 = new Promise(function(resolve, reject) {
          setTimeout(function() {
            resolve();
          }, 1);
        });
        var p2 = new Promise(function(resolve, reject) {
          setTimeout(function() {
            reject(err);
          }, 2);
        });
        var p3 = new Promise(function(resolve, reject) {
          setTimeout(function() {
            resolve();
          }, 3);
        });
        Promise
          .all([p1, p2, p3])
          .then(function() {
            done(new Error('Should not succeed'));
          })
          .catch(function(_err) {
            assert.equal(err, _err[1]);
            assert.notOk(_err[0]);
            assert.notOk(_err[2]);
            done();
          })
      });
    });

  });


  describe('error handling', function() {
    it('throw error in promise block', function() {
      assert.throws(function() {
        var p = new Promise(function(resolve, reject) {
          throw new Error('wtf!');
        })
      });
    });
    it('throw error in sync then block', function() {
      var p = new Promise(function(resolve, reject) {
        resolve();
      });
      assert.throws(function() {
        p.then(function() {
          throw new Error('wtf!');
        });
      });
    });
    it('throw error in sync catch block', function() {
      var p = new Promise(function(resolve, reject) {
        reject();
      });
      assert.throws(function() {
        p.catch(function() {
          throw new Error('wtf!');
        });
      });
    });
    it('throw error in async then block', function(done) {
      var p = new Promise(function(resolve, reject) {
        setTimeout(function() {
          assert.throws(function() {
            resolve();
          });
          done();
        }, 3);
      });
      p.then(function() {
        throw new Error('wtf!');
      });
    });
    it('throw error in async catch block', function(done) {
      var p = new Promise(function(resolve, reject) {
        setTimeout(function() {
          assert.throws(function() {
            reject();
          });
          done();
        }, 3);
      });
      p.catch(function() {
        throw new Error('wtf!');
      });
    });
  });
});
