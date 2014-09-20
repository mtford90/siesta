var NewObjectProxy = require('./proxy').NewObjectProxy;
var Store = require('./store');
var util = require('./util');
var RestError = require('./error').RestError;
var changes = require('./changes');
var SiestaModel = require('./object').SiestaModel;

function OneToOneProxy(opts) {
    if (!this) return new OneToOneProxy(opts);
    NewObjectProxy.call(this, opts);
}

OneToOneProxy.prototype = Object.create(NewObjectProxy.prototype);

function getReverseName() {
    return this.isForward ? this.reverseName : this.forwardName;
}

function getReverseMapping() {
    return this.isForward ? this.reverseMapping: this.forwardMapping;
}

/**
 * Returns the reverse proxy for a bound OneToOne relationship.
 * If faulted then it throws an error, as this method should never be called if that's the case.
 * If there is no foreign relation, it returns null.
 */
function getReverseProxy() {
    if (this.isFault) {
        throw Error('getReverseProxy should not be called if faulted');
    }
    else if (this.related) {
        var reverseName = getReverseName.call(this);
        return this.related[reverseName + 'Proxy'];
    }
    return null;
}

/**
 * If a related object exists then we need to clear the reverse relation.
 *  e.g. if car.owner=person then we need to set person.car=null if the relationship is broken.
 * @param c
 */
function clearReverseRelated() {
    if (!(this instanceof OneToOneProxy)) throw new Error('clearReverseRelated must be bound to OneToOneProxy');
    var self = this;
    if (!self.isFault) {
        var reverseProxy = getReverseProxy.call(this);
        if (reverseProxy) {
            set.call(reverseProxy, null);
        }
    }
    else {
        if (self._id) {
            var reverseName = getReverseName.call(this);
            var reverseMapping = getReverseMapping.call(this);
            changes.registerChange({
                collection: reverseMapping.collection,
                mapping: reverseMapping.type,
                _id: this._id,
                field: reverseName,
                new: null,
                old: this.object._id
            });
        }
        else {
            throw new Error();
        }
    }
}

/**
 * Register the change that will be merged into PouchDB when save is called.
 * @param obj
 */
function registerChange(obj) {
    var mapping = this.object.mapping.type;
    var coll = this.object.collection;
    changes.registerChange({
        collection: coll,
        mapping: mapping,
        _id: this.object._id,
        field: this.getName(),
        new: obj ? obj._id : obj,
        old: this._id
    });
}

/**
 * Configure _id and related with the new related object.
 * @param obj
 */
function set(obj) {
    registerChange.call(this, obj);
    if (obj) {
        this._id = obj._id;
        this.related = obj;
    }
    else {
        this._id = null;
        this.related = null;
    }
}

/**
 * Set the reverse of this OneToOne relationship.
 * @param obj The related object
 */
function setReverse() {
    var reverseProxy = getReverseProxy.call(this);
    if (!reverseProxy) {
        throw new Error('setReverse should not be called if no related object');
    }
    // If the reverse already has a relation, we need to clear it.
    clearReverseRelated.call(reverseProxy);
    // Then set this object as the new reverse.
    set.call(reverseProxy, this.object);
}

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

function checkInstalled() {
    if (!this.object) {
        throw new RestError('Proxy must be installed on an object before can use it.');
    }
};

OneToOneProxy.prototype.set = function (obj, callback) {
    checkInstalled.call(this);
    var self = this;
    if (obj) {
        var errorMessage;
        if (errorMessage = validate(obj)) {
            if (callback) {
                callback(errorMessage);
            }
            else {
                throw new RestError(errorMessage);
            }
        }
        else {
            clearReverseRelated.call(this);
            set.call(self, obj);
            setReverse.call(self);
            if (callback) callback();
        }
    }
    else {
        clearReverseRelated.call(this);
        set.call(self, obj);
        if (callback) callback();
    }
};

OneToOneProxy.prototype.get = function (callback) {
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
};

exports.OneToOneProxy = OneToOneProxy;