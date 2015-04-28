var util = require('./util'),
  Promise = util.Promise,
  error = require('./error'),
  ModelInstance = require('./ModelInstance');

/*
 TODO: Use ES6 Proxy instead.
 Eventually filter sets should use ES6 Proxies which will be much more natural and robust. E.g. no need for the below
 */
var ARRAY_METHODS = ['push', 'sort', 'reverse', 'splice', 'shift', 'unshift'],
  NUMBER_METHODS = ['toString', 'toExponential', 'toFixed', 'toPrecision', 'valueOf'],
  NUMBER_PROPERTIES = ['MAX_VALUE', 'MIN_VALUE', 'NEGATIVE_INFINITY', 'NaN', 'POSITIVE_INFINITY'],
  STRING_METHODS = ['charAt', 'charCodeAt', 'concat', 'fromCharCode', 'indexOf', 'lastIndexOf', 'localeCompare',
    'match', 'replace', 'search', 'slice', 'split', 'substr', 'substring', 'toLocaleLowerCase', 'toLocaleUpperCase',
    'toLowerCase', 'toString', 'toUpperCase', 'trim', 'valueOf'],
  STRING_PROPERTIES = ['length'];

/**
 * Return the property names for a given object. Handles special cases such as strings and numbers that do not have
 * the getOwnPropertyNames function.
 * The special cases are very much hacks. This hack can be removed once the Proxy object is more widely adopted.
 * @param object
 * @returns {Array}
 */
function getPropertyNames(object) {
  var propertyNames;
  if (typeof object == 'string' || object instanceof String) {
    propertyNames = STRING_METHODS.concat(STRING_PROPERTIES);
  }
  else if (typeof object == 'number' || object instanceof Number) {
    propertyNames = NUMBER_METHODS.concat(NUMBER_PROPERTIES);
  }
  else {
    propertyNames = object.getOwnPropertyNames();
  }
  return propertyNames;
}

/**
 * Define a proxy property to attributes on objects in the array
 * @param arr
 * @param prop
 */
function defineAttribute(arr, prop) {
  if (!(prop in arr)) { // e.g. we cannot redefine .length
    Object.defineProperty(arr, prop, {
      get: function() {
        return filterSet(util.pluck(arr, prop));
      },
      set: function(v) {
        if (util.isArray(v)) {
          if (this.length != v.length) throw error({message: 'Must be same length'});
          for (var i = 0; i < v.length; i++) {
            this[i][prop] = v[i];
          }
        }
        else {
          for (i = 0; i < this.length; i++) {
            this[i][prop] = v;
          }
        }
      }
    });
  }
}

function isPromise(obj) {
  // TODO: Don't think this is very robust.
  return obj.then && obj.catch;
}

/**
 * Define a proxy method on the array if not already in existence.
 * @param arr
 * @param prop
 */
function defineMethod(arr, prop) {
  if (!(prop in arr)) { // e.g. we don't want to redefine toString
    arr[prop] = function() {
      var args = arguments,
        res = this.map(function(p) {
          return p[prop].apply(p, args);
        });
      var arePromises = false;
      if (res.length) arePromises = isPromise(res[0]);
      return arePromises ? Promise.all(res) : filterSet(res);
    };
  }
}

/**
 * Transform the array into a filter set.
 * Renders the array immutable.
 * @param arr
 * @param model - The model with which to proxy to
 */
function modelFilterSet(arr, model) {
  arr = util.extend([], arr);
  var attributeNames = model._attributeNames,
    relationshipNames = model._relationshipNames,
    names = attributeNames.concat(relationshipNames).concat(instanceMethods);
  names.forEach(defineAttribute.bind(defineAttribute, arr));
  var instanceMethods = Object.keys(ModelInstance.prototype);
  instanceMethods.forEach(defineMethod.bind(defineMethod, arr));
  return renderImmutable(arr);
}

/**
 * Transform the array into a filter set, based on whatever is in it.
 * Note that all objects must be of the same type. This function will take the first object and decide how to proxy
 * based on that.
 * @param arr
 */
function filterSet(arr) {
  if (arr.length) {
    var referenceObject = arr[0],
      propertyNames = getPropertyNames(referenceObject);
    propertyNames.forEach(function(prop) {
      if (typeof referenceObject[prop] == 'function') defineMethod(arr, prop, arguments);
      else defineAttribute(arr, prop);
    });
  }
  return renderImmutable(arr);
}

function throwImmutableError() {
  throw new Error('Cannot modify a filter set');
}

/**
 * Render an array immutable by replacing any functions that can mutate it.
 * @param arr
 */
function renderImmutable(arr) {
  ARRAY_METHODS.forEach(function(p) {
    arr[p] = throwImmutableError;
  });
  arr.immutable = true;
  arr.mutableCopy = arr.asArray = function() {
    var mutableArr = this.map(function(x) {return x});
    mutableArr.asFilterSet = function() {
      return filterSet(this);
    };
    mutableArr.asModelFilterSet = function(model) {
      return modelFilterSet(this, model);
    };
    return mutableArr;
  };
  return arr;
}

module.exports = modelFilterSet;