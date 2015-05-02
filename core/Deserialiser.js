var log = require('./log'),
  util = require('./util');

function Deserialiser(model, opts) {
  this.model = model;
  util.extend(this, opts || {});
}

Deserialiser.prototype = {
  deserialise: function(data) {
    if (util.isArray(data)) {
      var deserialised = data.map(this._deserialise.bind(this));
    }
    else {
      deserialised = this._deserialise(data);
    }
    return this.model.graph(deserialised);
  },
  _deserialise: function(datum) {
    datum = util.extend({}, datum);
    var deserialised = {};
    Object.keys(datum).forEach(function(key) {
      var deserialiser = this[key];
      var rawVal = datum[key];
      if (deserialiser) {
        var val = deserialiser(rawVal);
        if (val !== undefined) deserialised[key] = val;
      }
      else {
        return deserialised[key] = rawVal;
      }
    }.bind(this));
    return deserialised;
  }
};

module.exports = Deserialiser;
