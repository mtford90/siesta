(function () {
  var misc = require('./misc'),
      _ = require('./underscore');

  function doParallel(fn) {
    return function () {
      var args = Array.prototype.slice.call(arguments);
      return fn.apply(null, [each].concat(args));
    };
  }

  var map = doParallel(_asyncMap);

  var root;

  function _map(arr, iterator) {
    if (arr.map) {
      return arr.map(iterator);
    }
    var results = [];
    each(arr, function (x, i, a) {
      results.push(iterator(x, i, a));
    });
    return results;
  }

  function _asyncMap(eachfn, arr, iterator, callback) {
    arr = _map(arr, function (x, i) {
      return {
        index: i,
        value: x
      };
    });
    if (!callback) {
      eachfn(arr, function (x, callback) {
        iterator(x.value, function (err) {
          callback(err);
        });
      });
    } else {
      var results = [];
      eachfn(arr, function (x, callback) {
        iterator(x.value, function (err, v) {
          results[x.index] = v;
          callback(err);
        });
      }, function (err) {
        callback(err, results);
      });
    }
  }

  var mapSeries = doSeries(_asyncMap);

  function doSeries(fn) {
    return function () {
      var args = Array.prototype.slice.call(arguments);
      return fn.apply(null, [eachSeries].concat(args));
    };
  }


  function eachSeries(arr, iterator, callback) {
    callback = callback || function () {
    };
    if (!arr.length) {
      return callback();
    }
    var completed = 0;
    var iterate = function () {
      iterator(arr[completed], function (err) {
        if (err) {
          callback(err);
          callback = function () {
          };
        } else {
          completed += 1;
          if (completed >= arr.length) {
            callback();
          } else {
            iterate();
          }
        }
      });
    };
    iterate();
  }


  function _each(arr, iterator) {
    if (arr.forEach) {
      return arr.forEach(iterator);
    }
    for (var i = 0; i < arr.length; i += 1) {
      iterator(arr[i], i, arr);
    }
  }

  function each(arr, iterator, callback) {
    callback = callback || function () {
    };
    if (!arr.length) {
      return callback();
    }
    var completed = 0;
    _each(arr, function (x) {
      iterator(x, only_once(done));
    });

    function done(err) {
      if (err) {
        callback(err);
        callback = function () {
        };
      } else {
        completed += 1;
        if (completed >= arr.length) {
          callback();
        }
      }
    }
  }

  var _parallel = function (eachfn, tasks, callback) {
    callback = callback || function () {
    };
    if (misc.isArray(tasks)) {
      eachfn.map(tasks, function (fn, callback) {
        if (fn) {
          fn(function (err) {
            var args = Array.prototype.slice.call(arguments, 1);
            if (args.length <= 1) {
              args = args[0];
            }
            callback.call(null, err, args);
          });
        }
      }, callback);
    } else {
      var results = {};
      eachfn.each(Object.keys(tasks), function (k, callback) {
        tasks[k](function (err) {
          var args = Array.prototype.slice.call(arguments, 1);
          if (args.length <= 1) {
            args = args[0];
          }
          results[k] = args;
          callback(err);
        });
      }, function (err) {
        callback(err, results);
      });
    }
  };

  function series(tasks, callback) {
    callback = callback || function () {
    };
    if (misc.isArray(tasks)) {
      mapSeries(tasks, function (fn, callback) {
        if (fn) {
          fn(function (err) {
            var args = Array.prototype.slice.call(arguments, 1);
            if (args.length <= 1) {
              args = args[0];
            }
            callback.call(null, err, args);
          });
        }
      }, callback);
    } else {
      var results = {};
      eachSeries(_.keys(tasks), function (k, callback) {
        tasks[k](function (err) {
          var args = Array.prototype.slice.call(arguments, 1);
          if (args.length <= 1) {
            args = args[0];
          }
          results[k] = args;
          callback(err);
        });
      }, function (err) {
        callback(err, results);
      });
    }
  }

  function only_once(fn) {
    var called = false;
    return function () {
      if (called) throw new Error("Callback was already called.");
      called = true;
      fn.apply(root, arguments);
    }
  }

  function parallel(tasks, callback) {
    _parallel({
      map: map,
      each: each
    }, tasks, callback);
  }

  var _nextTick;

  if (typeof setImmediate === 'function') {
    _nextTick = function (fn) {
      // not a direct alias for IE10 compatibility
      setImmediate(fn);
    };
  }
  else {
    _nextTick = function (fn) {
      setTimeout(fn, 0);
    };
  }

  function queue(worker, concurrency) {
    if (concurrency === undefined) {
      concurrency = 1;
    }
    function _insert(q, data, pos, callback) {
      if (!q.started) {
        q.started = true;
      }
      if (!misc.isArray(data)) {
        data = [data];
      }
      if (data.length == 0) {
        // call drain immediately if there are no tasks
        return _nextTick(function () {
          if (q.drain) {
            q.drain();
          }
        });
      }
      _each(data, function (task) {
        var item = {
          data: task,
          callback: typeof callback === 'function' ? callback : null
        };

        if (pos) {
          q.tasks.unshift(item);
        } else {
          q.tasks.push(item);
        }

        if (q.saturated && q.tasks.length === q.concurrency) {
          q.saturated();
        }
        _nextTick(q.process);
      });
    }

    var workers = 0;
    var q = {
      tasks: [],
      concurrency: concurrency,
      saturated: null,
      empty: null,
      drain: null,
      started: false,
      paused: false,
      push: function (data, callback) {
        _insert(q, data, false, callback);
      },
      kill: function () {
        q.drain = null;
        q.tasks = [];
      },
      unshift: function (data, callback) {
        _insert(q, data, true, callback);
      },
      process: function () {
        if (!q.paused && workers < q.concurrency && q.tasks.length) {
          var task = q.tasks.shift();
          if (q.empty && q.tasks.length === 0) {
            q.empty();
          }
          workers += 1;
          var next = function () {
            workers -= 1;
            if (task.callback) {
              task.callback.apply(task, arguments);
            }
            if (q.drain && q.tasks.length + workers === 0) {
              q.drain();
            }
            q.process();
          };
          var cb = only_once(next);
          worker(task.data, cb);
        }
      },
      length: function () {
        return q.tasks.length;
      },
      running: function () {
        return workers;
      },
      idle: function () {
        return q.tasks.length + workers === 0;
      },
      pause: function () {
        if (q.paused === true) {
          return;
        }
        q.paused = true;
        q.process();
      },
      resume: function () {
        if (q.paused === false) {
          return;
        }
        q.paused = false;
        q.process();
      }
    };
    return q;
  }


  module.exports = {
    series: series,
    parallel: parallel,
    queue: queue
  };
})();