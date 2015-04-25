var EventEmitter = require('events').EventEmitter,
  ArrayObserver = require('../vendor/observe-js/src/observe').ArrayObserver,
  util = require('./util'),
  argsarray = require('argsarray'),
  modelEvents = require('./modelEvents'),
  Chain = require('./Chain');

var eventEmitter = new EventEmitter();
eventEmitter.setMaxListeners(100);


util.extend(eventEmitter, {
  wrapArray: function(array, field, modelInstance) {
    if (!array.observer) {
      array.observer = new ArrayObserver(array);
      array.observer.open(function(splices) {
        var fieldIsAttribute = modelInstance._attributeNames.indexOf(field) > -1;
        if (fieldIsAttribute) {
          splices.forEach(function(splice) {
            modelEvents.emit({
              collection: modelInstance.collectionName,
              model: modelInstance.model.name,
              localId: modelInstance.localId,
              index: splice.index,
              removed: splice.removed,
              added: splice.addedCount ? array.slice(splice.index, splice.index + splice.addedCount) : [],
              type: modelEvents.ModelEventType.Splice,
              field: field,
              obj: modelInstance
            });
          });
        }
      });
    }
  }
});

var oldEmit = eventEmitter.emit;

// Ensure that errors in event handlers do not stall Siesta.
eventEmitter.emit = function(event, payload) {
  try {
    oldEmit.call(eventEmitter, event, payload);
  }
  catch (e) {
    console.error(e);
  }
};

module.exports = eventEmitter;
