var proxy = require('./proxy')
    , NewObjectProxy = proxy.NewObjectProxy
    , Store = require('./store')
    , util = require('./util')
    , _ = util._
    , RestError = require('./error').RestError
    , coreChanges = require('./changes')
    , SiestaModel = require('./object').SiestaModel
    , notificationCentre = require('./notificationCentre')
    , wrapArrayForAttributes = notificationCentre.wrapArray
    , ArrayObserver = require('../vendor/observe-js/src/observe').ArrayObserver
    , ChangeType = require('./changes').ChangeType;


function ForeignKeyProxy(opts) {
    NewObjectProxy.call(this, opts);
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
                            if (self.related.length > 0) {
                                throw new RestError('_id and related are somehow out of sync');
                            }
                            else {
                                return true;
                            }
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
                        wrapArray.call(self, self.related);
                    }
                }
            }
        }
    });
    this._reverseIsArray = true;
    this._forwardIsArray = false;
}

ForeignKeyProxy.prototype = Object.create(NewObjectProxy.prototype);




function clearReverse(removed) {
    var self = this;
    _.each(removed, function (removedObject) {
        var reverseProxy = proxy.getReverseProxyForObject.call(self, removedObject);
        proxy.set.call(reverseProxy, null);
    });
}

function setReverse(added) {
    var self = this;
    _.each(added, function (added) {
        var forwardProxy = proxy.getReverseProxyForObject.call(self, added);
        proxy.set.call(forwardProxy, self.object);
    });
}

function wrapArray(arr) {
    var self = this;
    wrapArrayForAttributes(arr, this.reverseName, this.object);
    if (!arr.foreignKeyObserver) {
        arr.foreignKeyObserver = new ArrayObserver(arr);
        var observerFunction = function (splices) {
            splices.forEach(function (splice) {
                var added = splice.addedCount ? arr.slice(splice.index, splice.index + splice.addedCount) : [];
                var removed = splice.removed;
                clearReverse.call(self, removed);
                setReverse.call(self, added);
                var mapping = proxy.getForwardMapping.call(self);
                coreChanges.registerChange({
                    collection: mapping.collection,
                    mapping: mapping,
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
        arr.foreignKeyObserver.open(observerFunction);
    }
}


ForeignKeyProxy.prototype.get = function (callback) {
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
};

/**
 * Validate the object that we're setting
 * @param obj
 * @returns {string|null} An error message or null
 */
function validate(obj) {
    if (this.isForward) {
        if (Object.prototype.toString.call(obj) == '[object Array]') {
            return 'Cannot assign array forward foreign key';
        }
    }
    else {
        if (Object.prototype.toString.call(obj) != '[object Array]') {
            return 'Cannot scalar to reverse foreign key';
        }
    }
    return null;
}


ForeignKeyProxy.prototype.set = function (obj) {
    proxy.checkInstalled.call(this);
    var self = this;
    if (obj) {
        var errorMessage;
        if (errorMessage = validate.call(this, obj)) {
            throw new RestError(errorMessage);
        }
        else {
            proxy.clearReverseRelated.call(this);
            proxy.set.call(self, obj);
            if (self.isReverse) {
                wrapArray.call(this, self.related);
            }
            proxy.setReverse.call(self, obj);
        }
    }
    else {
        proxy.clearReverseRelated.call(this);
        proxy.set.call(self, obj);
    }
};

ForeignKeyProxy.prototype.install = function (obj) {
    NewObjectProxy.prototype.install.call(this, obj);
    if (this.isReverse) {
        obj[ ('splice' + util.capitaliseFirstLetter(this.reverseName))] = _.bind(proxy.splice, this);
    }
};


exports.ForeignKeyProxy = ForeignKeyProxy;