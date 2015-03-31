/*
 * This is a collection of utilities taken from libraries such as async.js, underscore.js etc.
 * @module util
 */

(function() {
  var _ = require('./underscore'),
    async = require('./async'),
    async2 = require('./async2'),
    misc = require('./misc');

  misc.extend(module.exports, {
    _: _,
    async: async,
    async2: async2
  });
  misc.extend(module.exports, misc);

})();