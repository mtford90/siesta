var util = require('./util'),
  _ = util._;

/**
 * Acts as a placeholder for various objects e.g. lazy registration of models.
 * @param [opts]
 * @constructor
 */
function Placeholder(opts) {
  _.extend(this, opts || {});
  this.isPlaceholder = true;
}

module.exports = Placeholder;