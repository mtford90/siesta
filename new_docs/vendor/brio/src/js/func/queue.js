var async = require('async');

var queue = async.queue(function (task, callback) {
    task(callback);
  }, 1);

module.exports = queue;
