(function () {
    var EventEmitter = require('events').EventEmitter,
        ArrayObserver = require('../vendor/observe-js/src/observe').ArrayObserver,
        _ = require('./util')._,
        modelEvents = require('./modelEvents');

    var events = new EventEmitter();
    events.setMaxListeners(100);

    /**
     * Listen to a particular event from the Siesta global EventEmitter.
     * Manages its own set of listeners.
     * @constructor
     */
    function ProxyEventEmitter(event) {
        _.extend(this, {
            event: event,
            listeners: {}
        });
    }

    _.extend(ProxyEventEmitter.prototype, {
        listen: function (type, fn) {
            if (typeof type == 'function') {
                fn = type;
                type = null;
            }
            else {
                var _fn = fn;
                fn = function (e) {
                    e = e || {};
                    if (type) {
                        if (e.type == type) {
                            _fn(e);
                        }
                    }
                    else {
                        _fn(e);
                    }
                };
                var listeners = this.listeners;
                if (type) {
                    if (!listeners[type]) listeners[type] = [];
                    listeners[type].push(fn);
                }
            }
            events.on(this.event, fn);
            return function () {
                this._removeListener(fn, type);
            }.bind(this);
        },
        listenOnce: function (type, fn) {
            var event = this.event;
            if (typeof type == 'function') {
                fn = type;
                type = null;
            }
            else {
                var _fn = fn;
                fn = function (e) {
                    e = e || {};
                    if (type) {
                        if (e.type == type) {
                            events.removeListener(event, fn);
                            _fn(e);
                        }
                    }
                    else {
                        _fn(e);
                    }
                }
            }
            if (type) {
                return events.on(event, fn);
            }
            else {
                return events.once(event, fn);
            }
        },
        _removeListener: function (fn, type) {
            if (type) {
                var listeners = this.listeners[type],
                    idx = listeners.indexOf(fn);
                listeners.splice(idx, 1);
            }
            return events.removeListener(this.event, fn);
        },
        emit: function (type, payload) {
            if (typeof type == 'object') {
                payload = type;
                type = null;
            }
            else {
                payload = payload || {};
                payload.type = type;
            }
            events.emit.call(events, this.event, payload);
        },
        _removeAllListeners: function (type) {
            (this.listeners[type] || []).forEach(function (fn) {
                events.removeListener(this.event, fn);
            }.bind(this));
            this.listeners[type] = [];
        },
        removeAllListeners: function (type) {
            if (type) {
                this._removeAllListeners(type);
            }
            else {
                for (type in this.listeners) {
                    if (this.listeners.hasOwnProperty(type)) {
                        this._removeAllListeners(type);
                    }
                }
            }
        }
    });

    // Aliases
    _.extend(ProxyEventEmitter.prototype, {
        on: ProxyEventEmitter.prototype.listen
    });

    _.extend(events, {
        ProxyEventEmitter: ProxyEventEmitter,
        wrapArray: function (array, field, modelInstance) {
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
        }
    });

    module.exports = events;
})();