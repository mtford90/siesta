var proxy = require('./proxy')
    , NewObjectProxy = proxy.NewObjectProxy
    , Store = require('./store')
    , util = require('./util')
    , _ = util._
    , RestError = require('./error').RestError
    , changes = require('./pouch/changes')
    , SiestaModel = require('./object').SiestaModel
    , notificationCentre = require('./notificationCentre')
    , ArrayObserver = require('../vendor/observe-js/src/observe').ArrayObserver
    , wrapArrayForAttributes = notificationCentre.wrapArray
    , ChangeType = require('./pouch/changeType').ChangeType;


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
    this._forwardIsArray = true;
}

ManyToManyProxy.prototype = Object.create(NewObjectProxy.prototype);

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
////                self._applyReverseOfSplice(splice.removed, added);
//                splices.forEach(function (splice) {
//                    broadcast(self.object, {
//                        field: self.reverseName,
//                        type: ChangeType.Splice,
//                        index: splice.index,
//                        addedCount: splice.addedCount,
//                        removed: splice.removed
//                    });
//                });
            });
        };
        arr.foreignKeyObserver.open(observerFunction);
    }
}

ManyToManyProxy.prototype.get = function (callback) {
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
            throw new RestError(errorMessage);
        }
        else {
            proxy.clearReverseRelated.call(this);
            proxy.set.call(self, obj);
            wrapArray.call(self.related, obj);
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