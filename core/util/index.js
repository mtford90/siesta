/*
 * This is a collection of utilities taken from libraries such as async.js, underscore.js etc.
 * @module util
 */

(function() {
  var async = require('./async'),
    async2 = require('./async2'),
    misc = require('./misc');

  misc.extend(module.exports, {
    async: async,
    async2: async2
  });
  misc.extend(module.exports, misc);

})();