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
    , notifications = require('./notifications')
    , wrapArrayForAttributes = notifications.wrapArray
    , SiestaModel = require('./modelInstance')
    , ArrayObserver = require('../vendor/observe-js/src/observe').ArrayObserver
    , ChangeType = require('./changes').ChangeType
    ;

/**
 * [ManyToManyProxy description]
 * @param {Object} opts
 */
function ManyToManyProxy(opts) {
    RelationshipProxy.call(this, opts);
    var self = this;
    Object.defineProperty(this, 'isFault', {
        get: function () {
            if (self._id) {
                return !self.related;
            }
            return true;
        },
        set: function (v) {
            if (v) {
                self._id = undefined;
                self.related = null;
            }
            else {
                if (!self._id) {
                    self._id = [];
                    self.related = [];
                    self.wrapArray(self.related);
                }
            }
        }
    });
    this._reverseIsArray = true;
}

ManyToManyProxy.prototype = Object.create(RelationshipProxy.prototype);

_.extend(ManyToManyProxy.prototype, {
    clearReverse: function (removed) {
        var self = this;
        _.each(removed, function (removedObject) {
            var reverseProxy = self.reverseProxyForInstance(removedObject);
            var idx = reverseProxy._id.indexOf(self.object._id);
            proxy.makeChangesToRelatedWithoutObservations.call(reverseProxy, function () {
                reverseProxy.splice(idx, 1);
            });
        });
    },
    setReverseOfAdded: function (added) {
        var self = this;
        _.each(added, function (addedObject) {
            var reverseProxy = self.reverseProxyForInstance(addedObject);
            proxy.makeChangesToRelatedWithoutObservations.call(reverseProxy, function () {
                reverseProxy.splice(0, 0, self.object);
            });
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
                    self.setReverseOfAdded(added);
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
            Store.get({_id: this._id}, function (err, stored) {
                if (err) {
                    if (callback) callback(err);
                }
                else {
                    self.related = stored;
                    if (callback) callback(null, stored);
                }
            })
        }
        else {
            if (callback) callback(null, this.related);
        }
        return deferred ? deferred.promise : null;
    },
    validate: function (obj) {
        if (Object.prototype.toString.call(obj) != '[object Array]') {
            return 'Cannot assign scalar to many to many';
        }
        return null;
    },
    set: function (obj, opts) {
        this.checkInstalled();
        var self = this;
        if (obj) {
            var errorMessage;
            if (errorMessage = this.validate(obj)) {
                return errorMessage;
            }
            else {
                this.clearReverseRelated(opts);
                self.setIdAndRelated( obj, opts);
                this.wrapArray(obj);
                self.setIdAndRelatedReverse(obj, opts);
            }
        }
        else {
            this.clearReverseRelated(opts);
            self.setIdAndRelated(obj, opts);
        }
    },
    install: function (obj) {
        RelationshipProxy.prototype.install.call(this, obj);
        obj[('splice' + util.capitaliseFirstLetter(this.reverseName))] = _.bind(this.splice, this);
    }


});


module.exports = ManyToManyProxy;