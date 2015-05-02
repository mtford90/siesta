var log = require('./log'),
  util = require('./util');

function Serialiser(model, opts) {
  this.model = model;
  util.extend(this, opts || {});
}

function defaultSerialiser(attrName, value) {
  return value;
}

Serialiser.prototype = {
  data: function(instance, opts) {
    opts = opts || {};
    if (!this.serialise) return this._defaultSerialise(instance, opts);
    else return this.serialise(instance, opts);
  },
  _getRelationshipSerialiser: function(rel) {
    return this[rel.isReverse ? rel.reverseName : rel.forwardName];
  },
  _defaultSerialise: function(instance, opts) {
    var serialised = {};
    var includeNullAttributes = opts.includeNullAttributes !== undefined ? opts.includeNullAttributes : true,
      includeNullRelationships = opts.includeNullRelationships !== undefined ? opts.includeNullRelationships : true;
    var attributeNames = this.model._attributeNames;
    var relationshipNames = this.model._relationshipNames;
    var idField = this.model.id;
    var serialisableFields = this.serialisableFields || attributeNames.concat.apply(attributeNames, relationshipNames).concat(idField);
    attributeNames.forEach(function(attrName) {
      if (serialisableFields.indexOf(attrName) > -1) {
        var serialiser = this[attrName];
        if (!serialiser) {
          var serialiseField = this.serialiseField || defaultSerialiser;
          serialiser = serialiseField.bind(this, attrName);
        }
        var val = instance[attrName];
        if (val === null) {
          if (includeNullAttributes) {
            var serialisedVal = serialiser(val);
            if (serialisedVal !== undefined)
              serialised[attrName] = serialisedVal;
          }
        }
        else if (val !== undefined) {
          serialisedVal = serialiser(val);
          if (serialisedVal !== undefined)
            serialised[attrName] = serialisedVal;
        }
      }
    }.bind(this));
    var relationships = this.model.relationships;
    relationshipNames.forEach(function(relName) {
      if (serialisableFields.indexOf(relName) > -1) {
        var val = instance[relName],
          rel = relationships[relName];

        if (rel && !rel.isReverse) {
          var serialiser;
          var relSerialiser = this._getRelationshipSerialiser(rel);
          if (relSerialiser) {
            serialiser = relSerialiser.bind(this);
          }
          else {
            var serialiseField = this.serialiseField;
            if (!serialiseField) {
              if (util.isArray(val)) val = util.pluck(val, this.model.id);
              else if (val) val = val[this.model.id];
            }
            serialiseField = serialiseField || defaultSerialiser;
            serialiser = serialiseField.bind(this, relName);
          }
          if (val === null) {
            if (includeNullRelationships) {
              var serialisedVal = serialiser(val);
              if (serialisedVal !== undefined)
                serialised[relName] = serialisedVal;
            }
          }
          else if (util.isArray(val)) {
            if ((includeNullRelationships && !val.length) || val.length) {
              serialisedVal = serialiser(val);
              if (serialisedVal !== undefined)
                serialised[relName] = serialisedVal;
            }
          }
          else if (val !== undefined) {
            serialisedVal = serialiser(val);
            if (serialisedVal !== undefined)
              serialised[relName] = serialisedVal;
          }
        }
      }
    }.bind(this));
    return serialised;
  }
};

module.exports = Serialiser;
