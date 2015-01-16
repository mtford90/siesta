var EventEmitter = require('events').EventEmitter,
    ArrayObserver = require('../vendor/observe-js/src/observe').ArrayObserver,
    _ = require('./util')._,
    modelEvents = require('./modelEvents');

var events = new EventEmitter();
events.wrapArray = function (array, field, modelInstance) {
    if (!array.observer) {
        array.observer = new ArrayObserver(array);
        array.observer.open(function (splices) {
            var fieldIsAttribute = modelInstance._attributeNames.indexOf(field) > -1;
            if (fieldIsAttribute) {
                splices.forEach(function (splice) {
                    modelEvents.emit({
                        collection: modelInstance.collectionName,
                        model: modelInstance.model.name,
                        _id: modelInstance._id,
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
};

/**
 * Listen to a particular event from the Siesta global EventEmitter.
 * Manages its own set of listeners.
 * @constructor
 */
function ProxyEventEmitter(event) {
    this.event = event;
    console.log('event', event);
}

_.extend(ProxyEventEmitter.prototype, {
    listen: function (fn) {
        events.on(this.event, fn);
        return function () {
            this.removeListener(fn);
        }.bind(this);
    },
    listenOnce: function (fn) {
        return events.once(this.event, fn);
    },
    removeListener: function (fn) {
        return events.removeListener(this.event, fn);
    }
});

events.ProxyEventEmitter = ProxyEventEmitter;

module.exports = events;