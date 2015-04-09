var util = require('./util');

function Condition(fn, lazy) {
  if (lazy === undefined || lazy === null) {
    lazy = true;
  }
  fn = fn || function(done) {
    done();
  };

  this._promise = new util.Promise(function(resolve, reject) {
    this.fn = function() {
      this.executed = true;
      var numComplete = 0;
      var results = [];
      var errors = [];
      if (util.isArray(fn)) {
        var checkComplete = function() {
          if (numComplete.length == fn.length) {
            if (errors.length) this._promise.reject(errors);
            else this._promise.resolve(null, results);
          }
        }.bind(this);

        fn.forEach(function(cond, idx) {
          cond.then(function(res) {
            results[idx] = res;
            numComplete++;
            checkComplete();
          }).catch(function(err) {
            errors[idx] = err;
            numComplete++;
          });
        });
      }
      else {
        fn(function(err, res) {
          if (err) reject(err);
          else resolve(res);
        }.bind(this))
      }
    }
  }.bind(this));

  if (!lazy) this._execute();
  this.executed = false;
}

Condition.prototype = {
  _execute: function() {
    if (!this.executed) this.fn();
  },
  then: function(success, fail) {
    this._execute();
    return this._promise.then(success, fail);
  },
  catch: function(fail) {
    this._execute();
    return this._promise.catch(fail);
  },
  resolve: function (res) {
    this.executed = true;
    this._promise.resolve(res);
  },
  reject: function (err) {
    this.executed = true;
    this._promise.reject(err);
  }
};

module.exports = Condition;