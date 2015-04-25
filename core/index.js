var util = require('./util'),
  Collection = require('./collection'),
  Model = require('./model'),
  error = require('./error'),
  events = require('./events'),
  RelationshipType = require('./RelationshipType'),
  ReactiveQuery = require('./ReactiveQuery'),
  ManyToManyProxy = require('./ManyToManyProxy'),
  App = require('./App'),
  OneToOneProxy = require('./OneToOneProxy'),
  OneToManyProxy = require('./OneToManyProxy'),
  RelationshipProxy = require('./RelationshipProxy'),
  modelEvents = require('./modelEvents'),
  Query = require('./Query'),
  querySet = require('./QuerySet'),
  Condition = require('./Condition'),
  log = require('./log');

util._patchBind();

// Initialise siesta object. Strange format facilities using submodules with requireJS (eventually)
var siesta = function(ext) {
  if (!siesta.ext) siesta.ext = {};
  util.extend(siesta.ext, ext || {});
  return siesta;
};

/**
 * - Collection Registry
 * - Event Emitter
 * - Cache
 * - PouchDB Instnace
 *
 */
siesta.app = new App('siesta');

// Notifications
util.extend(siesta, {
  on: siesta.app.on,
  off: siesta.app.off,
  once: siesta.app.once,
  removeAllListeners: siesta.app.removeAllListeners
});

util.extend(siesta, {
  removeListener: siesta.off,
  addListener: siesta.on
});

// Expose some stuff for usage by extensions and/or users
util.extend(siesta, {
  RelationshipType: RelationshipType,
  ModelEventType: modelEvents.ModelEventType,
  log: log.Level,
  InsertionPolicy: ReactiveQuery.InsertionPolicy,
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
    querySet: querySet,
    observe: require('../vendor/observe-js/src/observe'),
    Query: Query,
    ManyToManyProxy: ManyToManyProxy,
    OneToManyProxy: OneToManyProxy,
    OneToOneProxy: OneToOneProxy,
    RelationshipProxy: RelationshipProxy
  },
  isArray: util.isArray,
  isString: util.isString
});

siesta.ext = {};


util.extend(siesta, {
  reset: siesta.app.reset.bind(siesta.app),
  collection: siesta.app.collection.bind(siesta.app),
  _pushTask: siesta.app._pushTask.bind(siesta.app),
  graph: siesta.app.graph.bind(siesta.app),
  notify: util.next,
  registerComparator: Query.registerComparator.bind(Query),
  count: siesta.app.count.bind(siesta.app),
  get: siesta.app.get.bind(siesta.app),
  removeAll: siesta.app.removeAll.bind(siesta.app),
  _ensureInstalled: siesta.app._ensureInstalled.bind(siesta.app)
});


if (typeof window != 'undefined') {
  window['siesta'] = siesta;
}

siesta.log = require('debug');
module.exports = siesta;

(function loadExtensions() {
  require('../storage');
})();
