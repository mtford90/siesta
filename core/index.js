var util = require('./util'),
  ReactiveFilter = require('./ReactiveFilter'),
  Context = require('./Context'),
  modelEvents = require('./modelEvents'),
  log = require('./log');

util._patchBind();

var siesta = {
  createApp: function(name, opts) {
    opts = opts || {};
    opts.name = name;
    return new Context(opts);
  },
  log: require('debug'),
  // Make components available for testing.
  lib: {
    log: log,
    Condition: require('./Condition'),
    Model: require('./model'),
    error: require('./error'),
    ModelEventType: modelEvents.ModelEventType,
    ModelInstance: require('./ModelInstance'),
    extend: require('extend'),
    MappingOperation: require('./mappingOperation'),
    events: require('./events'),
    ProxyEventEmitter: require('./ProxyEventEmitter'),
    modelEvents: modelEvents,
    Collection: require('./collection'),
    ReactiveFilter: ReactiveFilter,
    utils: util,
    util: util,
    Serialiser: require('./Serialiser'),
    filterSet: require('./FilterSet'),
    observe: require('../vendor/observe-js/src/observe'),
    Filter: require('./Filter'),
    ManyToManyProxy: require('./ManyToManyProxy'),
    OneToManyProxy: require('./OneToManyProxy'),
    OneToOneProxy: require('./OneToOneProxy'),
    RelationshipProxy: require('./RelationshipProxy'),
    Storage: require('../storage'),
    Context: Context
  },
  constants: {
    Deletion: {
      Cascade: 'cascade',
      Nullify: 'nullify'
    }
  },
  isArray: util.isArray,
  isString: util.isString,
  RelationshipType: require('./RelationshipType'),
  ModelEventType: modelEvents.ModelEventType,
  InsertionPolicy: ReactiveFilter.InsertionPolicy
};


if (typeof window != 'undefined') window['siesta'] = siesta;
