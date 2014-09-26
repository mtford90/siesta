var proxy = require('./proxy')
    , NewObjectProxy = proxy.NewObjectProxy
    , Store = require('./store')
    , util = require('./util')
    , _ = util._
    , RestError = require('./error').RestError
    , changes = require('./changes')
    , SiestaModel = require('./object').SiestaModel
    , notificationCentre = require('./notificationCentre')
    , ArrayObserver = require('../vendor/observe-js/src/observe').ArrayObserver
    , broadcast = notificationCentre.broadcast
    , wrapArrayForAttributes = notificationCentre.wrapArray
    , ChangeType = require('./changeType').ChangeType;


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

function wrapArray(arr) {
    var self = this;
    wrapArrayForAttributes(arr, this.reverseName, this.object);
    if (!arr.foreignKeyObserver) {
        arr.foreignKeyObserver = new ArrayObserver(arr);
        var observerFunction = function (splices) {
            splices.forEach(function (splice) {
//                var added = [];
//                var numAdded = splice.addedCount;
//                var idx = splice.index;
//                for (var i = idx; i < idx + numAdded; i++) {
//                    added.push(self.related[i]);
//                }
//                self._applyReverseOfSplice(splice.removed, added);
//                splices.forEach(function (splice) {
//                    // TODO: Register changes.
////                    broadcast(self.object, {
////                        field: self.reverseName,
////                        type: ChangeType.Splice,
////                        index: splice.index,
////                        addedCount: splice.addedCount,
////                        removed: splice.removed
////                    });
//                });
            });
        };
        arr.foreignKeyObserver.open(observerFunction);
    }
}

function makeChangesToRelatedWithoutObservations(f) {
    this.related.foreignKeyObserver.close();
    this.related.foreignKeyObserver = null;
    f();
    wrapArray.call(this, this.related);
}

ForeignKeyProxy.prototype.get = function (callback) {
    var self = this;
    if (this.isFault) {
        if (this._id.length) {
            var storeOpts = {_id: this._id};
            dump(storeOpts);
            Store.get(storeOpts, function (err, stored) {
                if (err) {
                    if (callback) callback(err);
                }
                else {
                    self.related = stored;
                    if (callback) callback(null, stored);
                }
            })
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
//    dump(proxy.objAsString(this.object) + ': ' +  proxy.getForwardName.call(this) + '=' + proxy.objAsString(obj));
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