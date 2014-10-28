/**
 * @module  relationships
 */

var proxy = require('./proxy')
    , NewObjectProxy = proxy.NewObjectProxy
    , Store = require('./store')
    , util = require('./util')
    , InternalSiestaError = require('./error').InternalSiestaError
    , q = require('q')
    , SiestaModel = require('./object').SiestaModel;

/**
 * [OneToOneProxy description]
 * @param {Object} opts
 */
function OneToOneProxy(opts) {
    NewObjectProxy.call(this, opts);
    this._reverseIsArray = false;
    this._forwardIsArray = false;
}

OneToOneProxy.prototype = Object.create(NewObjectProxy.prototype);

/**
 * Validate the object that we're setting
 * @param obj
 * @returns {string|null} An error message or null
 */
function validate(obj) {
    if (Object.prototype.toString.call(obj) == '[object Array]') {
        return 'Cannot assign array to one to one relationship';
    }
    else if ((!obj instanceof SiestaModel)) {

    }
    return null;
}

OneToOneProxy.prototype.set = function (obj) {
    proxy.checkInstalled.call(this);
    var self = this;
    if (obj) {
        var errorMessage;
        if (errorMessage = validate(obj)) {
            return errorMessage;
        }
        else {
            proxy.clearReverseRelated.call(this);
            proxy.set.call(self, obj);
            proxy.setReverse.call(self, obj);
        }
    }
    else {
        proxy.clearReverseRelated.call(this);
        proxy.set.call(self, obj);
    }
};

OneToOneProxy.prototype.get = function (callback) {
    var deferred = q.defer();
    callback = util.constructCallbackAndPromiseHandler(callback, deferred);
    var self = this;
    if (this._id) {
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
    return deferred.promise;
};

exports.OneToOneProxy = OneToOneProxy;