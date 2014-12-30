/*
 * This is a collection of utilities taken from libraries such as async.js, underscore.js etc.
 * @module util
 */


var _ = require('./underscore'),
    async = require('./async'),
    misc = require('./misc');


module.exports._ = _;
_.extend(module.exports, misc);
_.extend(module.exports, async);
