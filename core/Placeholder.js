var util = require('./util');

/**
 * Acts as a placeholder for various objects e.g. lazy registration of models.
 * @param [opts]
 * @constructor
 */
function Placeholder(opts) {
  util.extend(this, opts || {});
  this.isPlaceholder = true;
}

module.exports = Placeholder;