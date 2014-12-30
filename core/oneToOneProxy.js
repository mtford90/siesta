/**
 * @module relationships
 */

var proxy = require('./proxy')
    , RelationshipProxy = proxy.RelationshipProxy
    , Store = require('./store')
    , util = require('./util')
    , InternalSiestaError = require('./error').InternalSiestaError
    , SiestaModel = require('./modelInstance');

/**
 * [OneToOneProxy description]
 * @param {Object} opts
 */
function OneToOneProxy(opts) {
    RelationshipProxy.call(this, opts);
    this._reverseIsArray = false;
    this._forwardIsArray = false;
}


OneToOneProxy.prototype = Object.create(RelationshipProxy.prototype);

_.extend(OneToOneProxy.prototype, {
    /**
     * Validate the object that we're setting
     * @param obj
     * @returns {string|null} An error message or null
     */
    validate: function (obj) {
        if (Object.prototype.toString.call(obj) == '[object Array]') {
            return 'Cannot assign array to one to one relationship';
        }
        else if ((!obj instanceof SiestaModel)) {

        }
        return null;
    },
    set: function (obj, opts) {
        proxy.checkInstalled.call(this);
        var self = this;
        if (obj) {
            var errorMessage;
            if (errorMessage = self.validate(obj)) {
                return errorMessage;
            }
            else {
                proxy.clearReverseRelated.call(this, opts);
                proxy.set.call(self, obj, opts);
                proxy.setReverse.call(self, obj, opts);
            }
        }
        else {
            proxy.clearReverseRelated.call(this, opts);
            proxy.set.call(self, obj, opts);
        }
    },
    get: function (callback) {
        var deferred = window.q ? window.q.defer() : null;
        callback = util.cb(callback, deferred);
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
        return deferred ? deferred.promise : null;
    }
});


module.exports = OneToOneProxy;