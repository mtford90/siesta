var util = require('./util'),
  Collection = require('./collection'),
  Model = require('./model'),
  error = require('./error'),
  events = require('./events'),
  RelationshipType = require('./RelationshipType'),
  ReactiveFilter = require('./ReactiveFilter'),
  ManyToManyProxy = require('./ManyToManyProxy'),
  Context = require('./Context'),
  OneToOneProxy = require('./OneToOneProxy'),
  OneToManyProxy = require('./OneToManyProxy'),
  RelationshipProxy = require('./RelationshipProxy'),
  modelEvents = require('./modelEvents'),
  Filter = require('./Filter'),
  filterSet = require('./FilterSet'),
  Condition = require('./Condition'),
  log = require('./log');

util._patchBind();

// Initialise siesta object. Strange format facilities using submodules with requireJS (eventually)
var siesta = function(ext) {
  if (!siesta.ext) siesta.ext = {};
  util.extend(siesta.ext, ext || {});
  return siesta;
};

siesta.createApp = function(name, opts) {
  opts = opts || {};
  opts.name = name;
  return new Context(opts);
};

// Expose some stuff for usage by extensions and/or users
util.extend(siesta, {
  RelationshipType: RelationshipType,
  ModelEventType: modelEvents.ModelEventType,
  log: log.Level,
  InsertionPolicy: ReactiveFilter.InsertionPolicy,
  _internal: {
    log: log,
    Condition: Condition,
    Model: Model,
    error: error,
    ModelEventType: modelEvents.ModelEventType,
    ModelInstance: require('./ModelInstance'),
    extend: require('extend'),
    MappingOperation: require('./mappingOperation'),
    events: events,
    ProxyEventEmitter: require('./ProxyEventEmitter'),
    modelEvents: modelEvents,
    Collection: Collection,
    utils: util,
    util: util,
    filterSet: filterSet,
    observe: require('../vendor/observe-js/src/observe'),
    Filter: Filter,
    ManyToManyProxy: ManyToManyProxy,
    OneToManyProxy: OneToManyProxy,
    OneToOneProxy: OneToOneProxy,
    RelationshipProxy: RelationshipProxy
  },
  isArray: util.isArray,
  isString: util.isString        
});

siesta.ext = {};


if (typeof window != 'undefined') {
  window['siesta'] = siesta;
}

siesta.log = require('debug');
module.exports = siesta;

(function loadExtensions() {
  require('../storage');
})();
