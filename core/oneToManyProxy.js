/**
 * @module relationships
 */

var proxy = require('./proxy')
    , RelationshipProxy = proxy.RelationshipProxy
    , Store = require('./store')
    , util = require('./util')
    , _ = util._
    , InternalSiestaError = require('./error').InternalSiestaError
    , coreChanges = require('./changes')
    , SiestaModel = require('./modelInstance')
    , notifications = require('./notifications')
    , wrapArrayForAttributes = notifications.wrapArray
    , ArrayObserver = require('../vendor/observe-js/src/observe').ArrayObserver
    , ChangeType = require('./changes').ChangeType
    ;

/**
 * @class  [OneToManyProxy description]
 * @constructor
 * @param {[type]} opts
 */
function OneToManyProxy(opts) {
    RelationshipProxy.call(this, opts);

    var self = this;
    Object.defineProperty(this, 'isFault', {
        get: function () {
            if (self.isForward) {
                if (self._id) {
                    return !self.related;
                }
                else if (self._id === null) {
                    return false;
                }
                return true;
            }
            else {
                if (self._id) {
                    if (self.related) {
                        if (self._id.length != self.related.length) {
                            self.validateRelated();
                            return true;
                        }
                        else {
                            return false;
                        }
                    }
                    return true;
                }
                return true;
            }
        },
        set: function (v) {
            if (v) {
                self._id = undefined;
                self.related = null;
            }
            else {
                if (!self._id) {
                    if (self.isForward) {
                        self._id = null;
                    }
                    else {
                        self._id = [];
                        self.related = [];
                        this.wrapArray(self.related);
                    }
                }
            }
        }
    });
    this._reverseIsArray = true;
    this._forwardIsArray = false;
}

OneToManyProxy.prototype = Object.create(RelationshipProxy.prototype);

_.extend(OneToManyProxy.prototype, {
    clearReverse: function (removed) {
        var self = this;
        _.each(removed, function (removedObject) {
            var reverseProxy = self.reverseProxyForInstance(removedObject);
            proxy.set.call(reverseProxy, null);
        });
    },
    setReverse: function (added) {
        var self = this;
        _.each(added, function (added) {
            var forwardProxy = self.reverseProxyForInstance(added);
            proxy.set.call(forwardProxy, self.object);
        });
    },
    wrapArray: function (arr) {
        var self = this;
        wrapArrayForAttributes(arr, this.reverseName, this.object);
        if (!arr.oneToManyObserver) {
            arr.oneToManyObserver = new ArrayObserver(arr);
            var observerFunction = function (splices) {
                splices.forEach(function (splice) {
                    var added = splice.addedCount ? arr.slice(splice.index, splice.index + splice.addedCount) : [];
                    var removed = splice.removed;
                    self.clearReverse(removed);
                    self.setReverse(added);
                    var model = self.getForwardModel();
                    coreChanges.registerChange({
                        collection: model.collectionName,
                        model: model.name,
                        _id: self.object._id,
                        field: self.getForwardName(),
                        removed: removed,
                        added: added,
                        removedId: _.pluck(removed, '_id'),
                        addedId: _.pluck(added, '_id'),
                        type: ChangeType.Splice,
                        index: splice.index,
                        obj: self.object
                    });
                });
            };
            arr.oneToManyObserver.open(observerFunction);
        }
    },
    get: function (callback) {
        var deferred = window.q ? window.q.defer() : null;
        callback = util.cb(callback, deferred);
        var self = this;
        if (this.isFault) {
            if (this._id.length) {
                var storeOpts = {_id: this._id};
                Store.get(storeOpts, function (err, stored) {
                    if (err) {
                        if (callback) callback(err);
                    }
                    else {
                        self.related = stored;
                        if (callback) callback(null, stored);
                    }
                });
            }
            else if (callback) {
                callback(null, this.related);
            }
        }
        else {
            if (callback) callback(null, this.related);
        }
        return deferred ? deferred.promise : null;
    },
    /**
     * Validate the object that we're setting
     * @param obj
     * @returns {string|null} An error message or null
     * @class OneToManyProxy
     */
    validate: function (obj) {
        var str = Object.prototype.toString.call(obj);
        if (this.isForward) {
            if (str == '[object Array]') {
                return 'Cannot assign array forward oneToMany (' + str + '): ' + this.forwardName;
            }
        }
        else {
            if (str != '[object Array]') {
                return 'Cannot scalar to reverse oneToMany (' + str + '): ' + this.reverseName;
            }
        }
        return null;
    },
    validateRelated: function () {
        var self = this;
        if (self._id) {
            if (self.related) {
                if (self._id.length != self.related.length) {
                    if (self.related.length > 0) {
                        throw new InternalSiestaError('_id and related are somehow out of sync');
                    }
                }
            }
        }
    },
    set: function (obj, opts) {
        proxy.checkInstalled.call(this);
        var self = this;
        if (obj) {
            var errorMessage;
            if (errorMessage = this.validate(obj)) {
                return errorMessage;
            }
            else {
                proxy.clearReverseRelated.call(this, opts);

                proxy.set.call(self, obj, opts);
                if (self.isReverse) {
                    this.wrapArray(self.related);
                }
                proxy.setReverse.call(self, obj, opts);
            }
        }
        else {
            proxy.clearReverseRelated.call(this, opts);
            proxy.set.call(self, obj, opts);
        }
    },
    install: function (obj) {
        RelationshipProxy.prototype.install.call(this, obj);
        if (this.isReverse) {
            obj[('splice' + util.capitaliseFirstLetter(this.reverseName))] = _.bind(proxy.splice, this);
        }
    }
});


module.exports = OneToManyProxy;