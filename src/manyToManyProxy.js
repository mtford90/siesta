/**
 * @module relationships
 */

var proxy = require('./proxy')
    , NewObjectProxy = proxy.NewObjectProxy
    , Store = require('./store')
    , util = require('./util')
    , _ = util._
    , InternalSiestaError = require('./error').InternalSiestaError
    , coreChanges = require('./changes')
    , notificationCentre = require('./notificationCentre')
    , wrapArrayForAttributes = notificationCentre.wrapArray
    , SiestaModel = require('./object').SiestaModel
    , ArrayObserver = require('../vendor/observe-js/src/observe').ArrayObserver
    , ChangeType = require('./changes').ChangeType
    , q = require('q')
;

/**
 * [ManyToManyProxy description]
 * @param {Object} opts
 */
function ManyToManyProxy(opts) {
    NewObjectProxy.call(this, opts);
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
                    wrapArray.call(self, self.related);
                }
            }
        }
    });
    this._reverseIsArray = true;
}


function clearReverse(removed) {
    var self = this;
    _.each(removed, function (removedObject) {
        var reverseProxy = proxy.getReverseProxyForObject.call(self, removedObject);
        var idx = reverseProxy._id.indexOf(self.object._id);
        proxy.makeChangesToRelatedWithoutObservations.call(reverseProxy, function (){
            proxy.splice.call(reverseProxy, idx, 1);
        });
    });
}

function setReverse(added) {
    var self = this;
    _.each(added, function (addedObject) {
        var reverseProxy = proxy.getReverseProxyForObject.call(self, addedObject);
        proxy.makeChangesToRelatedWithoutObservations.call(reverseProxy, function (){
            proxy.splice.call(reverseProxy, 0, 0, self.object);
        });
    });
}

function wrapArray(arr) {
    var self = this;
    wrapArrayForAttributes(arr, this.reverseName, this.object);
    if (!arr.oneToManyObserver) {
        arr.oneToManyObserver = new ArrayObserver(arr);
        var observerFunction = function (splices) {
            splices.forEach(function (splice) {
                var added = splice.addedCount ? arr.slice(splice.index, splice.index + splice.addedCount) : [];
                var removed = splice.removed;
                clearReverse.call(self, removed);
                setReverse.call(self, added);
                var mapping = proxy.getForwardMapping.call(self);
                coreChanges.registerChange({
                    collection: mapping.collection,
                    mapping: mapping.type,
                    _id: self.object._id,
                    field: proxy.getForwardName.call(self),
                    removed: removed,
                    added: added,
                    removedId: _.pluck(removed, '_id'),
                    addedId: _.pluck(added, '_id'),
                    type: ChangeType.Splice,
                    index: splice.index
                });
            });
        };
        arr.oneToManyObserver.open(observerFunction);
    }
}

ManyToManyProxy.prototype = Object.create(NewObjectProxy.prototype);

ManyToManyProxy.prototype.get = function (callback) {
    var deferred = q.defer();
    callback = util.constructCallbackAndPromiseHandler(callback, deferred);
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
    return deferred.promise;
};

function validate(obj) {
    if (Object.prototype.toString.call(obj) != '[object Array]') {
            return 'Cannot assign scalar to many to many';
        }
    return null;
}

ManyToManyProxy.prototype.set = function (obj) {
    proxy.checkInstalled.call(this);
    var self = this;
    if (obj) {
        var errorMessage;
        if (errorMessage = validate.call(this, obj)) {
            return errorMessage;
        }
        else {
            proxy.clearReverseRelated.call(this);
            proxy.set.call(self, obj);
            wrapArray.call(self, obj);
            proxy.setReverse.call(self, obj);
        }
    }
    else {
        proxy.clearReverseRelated.call(this);
        proxy.set.call(self, obj);
    }
};

ManyToManyProxy.prototype.install = function (obj) {
    NewObjectProxy.prototype.install.call(this, obj);
    obj[ ('splice' + util.capitaliseFirstLetter(this.reverseName))] = _.bind(proxy.splice, this);
};

exports.ManyToManyProxy = ManyToManyProxy;