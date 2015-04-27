var assert = require('chai').assert,
  ArrayObserver = siesta._internal.observe.ArrayObserver;

/**
 * Assertions against the observe-js library from polymer, modified to fit browserify.
 */

describe('observer', function() {
  var app = siesta.createApp('observer');
  before(function() {
    app.storageEnabled = false;
  });

  it('indexes', function(done) {
    var arr = [1, 2, 3];
    var observer = new ArrayObserver(arr);
    observer.open(function(splices) {
      splices.forEach(function(splice) {
        try {
          assert.include(splice.removed, 1);
          assert.include(splice.removed, 2);
          assert.equal(splice.addedCount, 2);
          assert.equal(splice.index, 0);
          done();
        } catch (err) {
          done(err);
        }
      });
    });
    arr[0] = 4;
    arr[1] = 5;
    app.notify();
  });

  it('push', function(done) {
    var arr = [1, 2, 3];
    var observer = new ArrayObserver(arr);
    observer.open(function(splices) {
      splices.forEach(function(splice) {
        try {
          assert.equal(splice.removed.length, 0);
          assert.equal(splice.index, 3);
          assert.equal(splice.addedCount, 1);
          done();
        } catch (err) {
          done(err);
        }

      });
    });
    arr.push(6);
    app.notify();
  });

  it('sort', function(done) {
    var arr = [2, 1, 3];
    var observer = new ArrayObserver(arr);
    observer.open(function(splices) {
      done();
    });
    arr.sort();
    app.notify();
  });

});
