/**
 * Base functionality for relationships.
 * @module relationships
 */

var InternalSiestaError = require('./error').InternalSiestaError,
    Store = require('./store'),
    Operation = require('./operation/operation').Operation,
    util = require('./util'),
    defineSubProperty = util.defineSubProperty,
    _ = util._,
    Query = require('./query').Query,
    log = require('./operation/log'),
    notificationCentre = require('./notificationCentre'),
    wrapArrayForAttributes = notificationCentre.wrapArray,
    ArrayObserver = require('../vendor/observe-js/src/observe').ArrayObserver,
    coreChanges = require('./changes'),
    ChangeType = coreChanges.ChangeType;

/**
 * @class  [Fault description]
 * @param {RelationshipProxy} proxy
 * @constructor
 */
function Fault(proxy) {
    var self = this;
    this.proxy = proxy;
    Object.defineProperty(this, 'isFault', {
        get: function () {
            return self.proxy.isFault;
        },
        enumerable: true,
        configurable: true
    });
}

_.extend(Fault.prototype, {
    get: function () {
        this.proxy.get.apply(this.proxy, arguments);
    },
    set: function () {
        this.proxy.set.apply(this.proxy, arguments);
    }
});


/**
 * @class  [RelationshipProxy description]
 * @param {Object} opts
 * @constructor
 */
function RelationshipProxy(opts) {
    this._opts = opts;
    if (!this) return new RelationshipProxy(opts);
    var self = this;
    this.fault = new Fault(this);
    this.object = null;
    this._id = undefined;
    this.related = null;
    Object.defineProperty(this, 'isFault', {
        get: function () {
            if (self._id) {
                return !self.related;
            } else if (self._id === null) {
                return false;
            }
            return true;
        },
        set: function (v) {
            if (v) {
                self._id = undefined;
                self.related = null;
            } else {
                if (!self._id) {
                    self._id = null;
                }
            }
        },
        enumerable: true,
        configurable: true
    });
    defineSubProperty.call(this, 'reverseModel', this._opts);
    defineSubProperty.call(this, 'forwardModel', this._opts);
    defineSubProperty.call(this, 'forwardName', this._opts);
    defineSubProperty.call(this, 'reverseName', this._opts);
    defineSubProperty.call(this, 'isReverse', this._opts);
    Object.defineProperty(this, 'isForward', {
        get: function () {
            return !self.isReverse;
        },
        set: function (v) {
            self.isReverse = !v;
        },
        enumerable: true,
        configurable: true
    });
    if (this._opts.isReverse === undefined && this._opts.isForward !== undefined) {
        this.isReverse = !this._opts.isForward;
    }
    else if (this._opts.isReverse === undefined && this._opts.isForward === undefined) {
        throw new InternalSiestaError('Must specify either isReverse or isForward when configuring relationship proxy.');
    }
}

_.extend(RelationshipProxy.prototype, {
    _dump: function (asJson) {
        var dumped = {};
    },
    install: function (obj) {
        if (obj) {
            if (!this.object) {
                this.object = obj;
                var self = this;
                var name = getForwardName.call(this);
                Object.defineProperty(obj, name, {
                    get: function () {
                        if (self.isFault) {
                            return self.fault;
                        } else {
                            return self.related;
                        }
                    },
                    set: function (v) {
                        self.set(v);
                    },
                    configurable: true,
                    enumerable: true
                });
                if (!obj.__proxies) obj.__proxies = {};
                obj.__proxies[name] = this;
                if (!obj._proxies) {
                    obj._proxies = [];
                }
                obj._proxies.push(this);
            } else {
                throw new InternalSiestaError('Already installed.');
            }
        } else {
            throw new InternalSiestaError('No object passed to relationship install');
        }
    },
    set: function () {
        throw new InternalSiestaError('Must subclass RelationshipProxy');
    },
    get: function () {
        throw new InternalSiestaError('Must subclass RelationshipProxy');
    }
});



// TODO: Share code between getReverseProxyForObject and getForwardProxyForObject

function getReverseProxyForObject(obj) {
    var reverseName = getReverseName.call(this);
    var reverseModel = this.reverseModel;
    // This should never happen. Should g   et caught in the mapping operation?
    if (util.isArray(obj)) {
        return _.map(obj, function (o) {
            return o.__proxies[reverseName];
        })
    } else {
        var proxy = obj.__proxies[reverseName];
        if (!proxy) {
            var err = 'No proxy with name "' + reverseName + '" on mapping ' + reverseModel.type;
            throw new InternalSiestaError(err);
        }
        return proxy;
    }
}

function getForwardProxyForObject(obj) {
    var forwardName = getForwardName.call(this);
    var forwardModel = this.forwardModel;
    if (util.isArray(obj)) {
        return _.map(obj, function (o) {
            return o.__proxies[forwardName];
        })
    } else {
        var proxy = obj.__proxies[forwardName];
        if (!proxy) {
            var err = 'No proxy with name "' + forwardName + '" on mapping ' + forwardModel.type;
            throw new InternalSiestaError(err);
        }
        return proxy;
    }
}

function getReverseName() {
    return this.isForward ? this.reverseName : this.forwardName;
}

function getForwardName() {
    return this.isForward ? this.forwardName : this.reverseName;
}

function getReverseModel() {
    return this.isForward ? this.reverseModel : this.forwardModel;
}

function getForwardModel() {
    return this.isForward ? this.forwardModel : this.reverseModel;
}

function checkInstalled() {
    if (!this.object) {
        throw new InternalSiestaError('Proxy must be installed on an object before can use it.');
    }
}

/**
 * Configure _id and related with the new related object.
 * @param obj
 * @param {object} [opts]
 * @param {boolean} [opts.disableNotifications]
 * @returns {String|undefined} - Error message or undefined
 */
function set(obj, opts) {
    opts = opts || {};
    if (!opts.disableNotifications) {
        console.log('uhoh');
        registerSetChange.call(this, obj);
    }
    if (obj) {
        if (util.isArray(obj)) {
            this._id = _.pluck(obj, '_id');
            this.related = obj;
        } else {
            this._id = obj._id;
            this.related = obj;
        }
    } else {
        this._id = null;
        this.related = null;
    }
}

function spliceFactory(opts) {
    opts = opts || {};
    return function (idx, numRemove) {
        opts = opts || {};
        if (!opts.disableNotifications) {
            registerSpliceChange.apply(this, arguments);
        }
        var add = Array.prototype.slice.call(arguments, 2);
        var returnValue = _.partial(this._id.splice, idx, numRemove).apply(this._id, _.pluck(add, '_id'));
        if (this.related) {
            _.partial(this.related.splice, idx, numRemove).apply(this.related, add);
        }
        return returnValue;
    }
}

var splice = spliceFactory({});

//function splice(idx, numRemove) {
//    registerSpliceChange.apply(this, arguments);
//    var add = Array.prototype.slice.call(arguments, 2);
//    var returnValue = _.partial(this._id.splice, idx, numRemove).apply(this._id, _.pluck(add, '_id'));
//    if (this.related) {
//        _.partial(this.related.splice, idx, numRemove).apply(this.related, add);
//    }
//    return returnValue;
//}

function objAsString(obj) {
    function _objAsString(obj) {
        if (obj) {
            var model = obj.model;
            var modelName = model.type;
            var ident = obj._id;
            if (typeof ident == 'string') {
                ident = '"' + ident + '"';
            }
            return modelName + '[_id=' + ident + ']';
        } else if (obj === undefined) {
            return 'undefined';
        } else if (obj === null) {
            return 'null';
        }
    }

    if (util.isArray(obj)) return _.map(_objAsString, obj).join(', ');
    return _objAsString(obj);
}

function clearReverseRelated(opts) {
    opts = opts || {};
    var self = this;
    if (!self.isFault) {
        if (this.related) {
            var reverseProxy = getReverseProxyForObject.call(this, this.related);
            var reverseProxies = util.isArray(reverseProxy) ? reverseProxy : [reverseProxy];
            _.each(reverseProxies, function (p) {
                if (util.isArray(p._id)) {
                    var idx = p._id.indexOf(self.object._id);
                    makeChangesToRelatedWithoutObservations.call(p, function () {
                        spliceFactory(opts).call(p, idx, 1);
                    });
                } else {
                    set.call(p, null, opts);
                }
            });
        }
    } else {
        if (self._id) {
            var reverseName = getReverseName.call(this);
            var reverseModel = getReverseModel.call(this);
            var identifiers = util.isArray(self._id) ? self._id : [self._id];
            if (this._reverseIsArray) {
                if (!opts.disableNotifications) {
                    _.each(identifiers, function (_id) {
                        coreChanges.registerChange({
                            collection: reverseModel.collection,
                            model: reverseModel.type,
                            _id: _id,
                            field: reverseName,
                            removedId: [self.object._id],
                            removed: [self.object],
                            type: ChangeType.Delete,
                            obj: self.object
                        });
                    });
                }
            } else {
                if (!opts.disableNotifications) {
                    _.each(identifiers, function (_id) {
                        coreChanges.registerChange({
                            collection: reverseModel.collection,
                            model: reverseModel.type,
                            _id: _id,
                            field: reverseName,
                            new: null,
                            newId: null,
                            oldId: self.object._id,
                            old: self.object,
                            type: ChangeType.Set,
                            obj: self.object
                        });
                    });
                }
            }

        } else {
            throw new Error(getForwardName.call(this) + ' has no _id');
        }
    }
}

function makeChangesToRelatedWithoutObservations(f) {
    if (this.related) {
        this.related.oneToManyObserver.close();
        this.related.oneToManyObserver = null;
        f();
        wrapArray.call(this, this.related);
    } else {
        // If there's a fault we can make changes anyway.
        f();
    }
}

function setReverse(obj, opts) {
    var self = this;
    var reverseProxy = getReverseProxyForObject.call(this, obj);
    var reverseProxies = util.isArray(reverseProxy) ? reverseProxy : [reverseProxy];
    _.each(reverseProxies, function (p) {
        if (util.isArray(p._id)) {
            makeChangesToRelatedWithoutObservations.call(p, function () {
                spliceFactory(opts).call(p, p._id.length, 0, self.object);
            });
        } else {
            clearReverseRelated.call(p, opts);
            set.call(p, self.object, opts);
        }
    });
}

function registerSetChange(obj) {
    var proxyObject = this.object;
    if (!proxyObject) throw new InternalSiestaError('Proxy must have an object associated');
    var model = proxyObject.model.type;
    var coll = proxyObject.collection;
    var newId;
    if (util.isArray(obj)) {
        newId = _.pluck(obj, '_id');
    } else {
        newId = obj ? obj._id : obj;
    }
    // We take [] == null == undefined in the case of relationships.
    var oldId = this._id;
    if (util.isArray(oldId) && !oldId.length) {
        oldId = null;
    }
    var old = this.related;
    if (util.isArray(old) && !old.length) {
        old = null;
    }
    coreChanges.registerChange({
        collection: coll,
        model: model,
        _id: proxyObject._id,
        field: getForwardName.call(this),
        newId: newId,
        oldId: oldId,
        old: old,
        new: obj,
        type: ChangeType.Set,
        obj: proxyObject
    });
}

function registerSpliceChange(idx, numRemove) {
    var add = Array.prototype.slice.call(arguments, 2);
    var model = this.object.model.type;
    var coll = this.object.collection;
    coreChanges.registerChange({
        collection: coll,
        model: model,
        _id: this.object._id,
        field: getForwardName.call(this),
        index: idx,
        removedId: this._id.slice(idx, idx + numRemove),
        removed: this.related ? this.related.slice(idx, idx + numRemove) : null,
        addedId: add.length ? _.pluck(add, '_id') : [],
        added: add.length ? add : [],
        type: ChangeType.Splice,
        obj: this.object
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
                var model = getForwardModel.call(self);
                coreChanges.registerChange({
                    collection: model.collection,
                    model: model.type,
                    _id: self.object._id,
                    field: getForwardName.call(self),
                    removed: splice.removed,
                    added: added,
                    removedId: _.pluck(splice.removed, '_id'),
                    addedId: _.pluck(splice.added, '_id'),
                    type: ChangeType.Splice,
                    obj: self.object
                });
            });
        };
        arr.oneToManyObserver.open(observerFunction);
    }
}

module.exports = {
    RelationshipProxy: RelationshipProxy,
    Fault: Fault,
    getReverseProxyForObject: getReverseProxyForObject,
    getForwardProxyForObject: getForwardProxyForObject,
    getReverseName: getReverseName,
    getForwardName: getForwardName,
    getReverseModel: getReverseModel,
    getForwardModel: getForwardModel,
    checkInstalled: checkInstalled,
    set: set,
    registerSetChange: registerSetChange,
    splice:splice,
    spliceFactory: spliceFactory,
    clearReverseRelated:  clearReverseRelated,
    setReverse:  setReverse,
    objAsString:  objAsString,
    wrapArray:  wrapArray,
    registerSpliceChange:  registerSpliceChange,
    makeChangesToRelatedWithoutObservations:  makeChangesToRelatedWithoutObservations
};

