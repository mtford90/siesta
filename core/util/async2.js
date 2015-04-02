/**
 * A dead simple replacement for async.js that allows errors to propogate.
 * @module async
 */


function splat(arr) {
  arr = arr || [];
  return arr.filter(function(x) {return x});
}

function parallel(tasks, cb) {
  if (tasks && tasks.length) {
    var results = [], errors = [], numFinished = 0;
    tasks.forEach(function(fn, idx) {
      results[idx] = false;
      fn(function(err, res) {
        numFinished++;
        if (err) errors[idx] = err;
        results[idx] = res;
        if (numFinished == tasks.length) {
          cb(
            errors.length ? splat(errors) : null,
            splat(results),
            {results: results, errors: errors}
          );
        }
      });
    });
  } else cb();
}


function series(tasks, cb) {


  if (tasks && tasks.length) {
    var results = [], errors = [], idx = 0;

    function executeTask(task) {
      task(function(err, res) {
        if (err) errors[idx] = err;
        results[idx] = res;
        if (!tasks.length) {
          cb(
            errors.length ? splat(errors) : null,
            splat(results),
            {results: results, errors: errors}
          );
        }
        else {
          idx++;
          nextTask();
        }
      });
    }

    function nextTask() {
      var nextTask = tasks.shift();
      executeTask(nextTask);
    }

    nextTask();

  } else cb();
}

module.exports = {
  parallel: parallel,
  series: series
};