var util = require('./util'),
  Promise = require('./Promise'),
  argsarray = require('argsarray');

function Condition(fn, lazy) {
  if (lazy === undefined || lazy === null) {
    this.lazy = true;
  }
  this._fn = fn || function(done) {
    done();
  };
  this.reset();
}

Condition.all = argsarray(function(args) {
  return new Condition(args);
});

Condition.prototype = {
  _execute: function() {
    if (!this.executed) {
      var dependents = util.pluck(this.dependent, '_promise');
      Promise
        .all(dependents)
        .then(this.fn)
        .catch(this.reject.bind(this));
      this.dependent.forEach(function(d) {
        d._execute();
      });
    }
  },
  then: function(success, fail) {
    this._execute();
    this._promise.then(success, fail);
    return this;
  },
  catch: function(fail) {
    this._execute();
    this._promise.catch(fail);
    return this;
  },
  resolve: function(res) {
    this.executed = true;
    this._promise.resolve(res);
  },
  reject: function(err) {
    this.executed = true;
    this._promise.reject(err);
  },
  dependentOn: function(cond) {
    this.dependent.push(cond);
  },
  reset: function() {
    this._promise = new Promise(function(resolve, reject) {
      this.reject = reject;
      this.resolve = resolve;
      this.fn = function() {
        this.executed = true;
        var numComplete = 0;
        var results = [];
        var errors = [];
        if (util.isArray(this._fn)) {
          var checkComplete = function() {
            if (numComplete == this._fn.length) {
              if (errors.length) {
                reject(errors);
              }
              else {
                resolve(results);
              }
            }
          }.bind(this);
          this
            ._fn
            .forEach(function(cond, idx) {
              cond
                .then(function(res) {
                  results[idx] = res;
                  numComplete++;
                  checkComplete();
                }.bind(this))
                .catch(function(err) {
                  errors[idx] = err;
                  numComplete++;
                  checkComplete();
                }.bind(this));
            });
        }
        else {
          this._fn(function(err, res) {
            if (err) reject(err);
            else resolve(res);
          }.bind(this))
        }
      }.bind(this)
    }.bind(this));

    if (!this.lazy) this._execute();
    this.executed = false;
    this.dependent = [];
  }
};

module.exports = Condition;
