var RestError = require('./error').RestError;
var Store = require('./store');

var defineSubProperty = require('./misc').defineSubProperty;

var Operation = require('../vendor/operations.js/src/operation').Operation;
var notificationCentre = require('./notificationCentre');
var broadcast = notificationCentre.broadcast;
var wrapArray = notificationCentre.wrapArray;
var ArrayObserver = require('../vendor/observe-js/src/observe').ArrayObserver;
var ChangeType = require('./changeType').ChangeType;

var util = require('./util');

function Fault(proxy, relationship) {
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

Fault.prototype.get = function () {
    this.proxy.get.apply(this.proxy, arguments);
};

Fault.prototype.set = function () {
    this.proxy.set.apply(this.proxy, arguments);
};

function NewObjectProxy(opts) {
    this._opts = opts;
    if (!this) return new NewObjectProxy(opts);
    var self = this;
    this.fault = new Fault(this);
    this.object = null;
    this._id = null;
    this.related = null;
    Object.defineProperty(this, 'isFault', {
        get: function () {
            if (self._id) {
                return !self.related;
            }
            return false;
        },
        enumerable: true,
        configurable: true
    });
    defineSubProperty.call(this, 'reverseMapping', this._opts);
    defineSubProperty.call(this, 'forwardMapping', this._opts);
    defineSubProperty.call(this, 'forwardName', this._opts);
    defineSubProperty.call(this, 'reverseName', this._opts);
    Object.defineProperty(this, 'isReverse', {
        get: function () {
            if (self.object) {
                return self.object.mapping == self.reverseMapping;
            }
            else {
                throw new RestError('Cannot use proxy until installed')
            }
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(this, 'isForward', {
        get: function () {
            if (self.object) {
                return self.object.mapping == self.forwardMapping;
            }
            else {
                throw new RestError('Cannot use proxy until installed')
            }
        },
        enumerable: true,
        configurable: true
    });
}

NewObjectProxy.prototype.getName = function () {
    var name;
    if (this.isReverse) {
        name = this.reverseName;
    }
    else if (this.isForward) {
        name = this.forwardName;
    }
    else {
        throw new RestError('Incompatible relationship: ' + this.object.type + ' ,' + JSON.stringify(this._opts, null, 4));
    }
    return name;
};

function capitaliseFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

NewObjectProxy.prototype.install = function (obj) {
    if (obj) {
        if (!this.object) {
            this.object = obj;
            var self = this;
            var name = this.getName();
            Object.defineProperty(obj, name, {
                get: function () {
                    if (self.related) {
                        return self.related;
                    }
                    else {
                        return self.fault;
                    }
                },
                set: function (v) {
                    self.set(v);
                },
                configurable: true,
                enumerable: true
            });
            obj[ ('get' + capitaliseFirstLetter(name))] = _.bind(this.get, this);
            obj[ ('set' + capitaliseFirstLetter(name))] = _.bind(this.set, this);
            obj[name + 'Proxy'] = this;
            if (!obj._proxies) {
                obj._proxies = [];
            }
            obj._proxies.push(this);
        }
        else {
            throw new RestError('Already installed.');
        }
    }
    else {
        throw new RestError('No object passed to relationship install');
    }
};

NewObjectProxy.prototype.set = function (obj) {
    throw new RestError('Must subclass NewObjectProxy');
};

NewObjectProxy.prototype.get = function (callback) {
    throw new RestError('Must subclass NewObjectProxy');
};

var log = require('../vendor/operations.js/src/log');

var Logger = log.loggerWithName('Proxy');
Logger.setLevel(log.Level.warn);


function OneToOneProxy(opts) {
    if (!this) return new OneToOneProxy(opts);
    NewObjectProxy.call(this, opts);
}

OneToOneProxy.prototype = Object.create(NewObjectProxy.prototype);

OneToOneProxy.prototype.set = function (obj, callback, reverse) {

    if (obj) {
        if (Object.prototype.toString.call(obj) == '[object Array]') {
            var err = new RestError('Cannot assign array to one to one relationship');
            if (callback) {
                callback(err);
            }
            else {
                throw err;
            }
            return;
        }
    }

    var self = this;
    var reverseName = this.isForward ? this.reverseName : this.forwardName;
    var setterName = ('set' + capitaliseFirstLetter(reverseName));

    if (obj) {
        clearCurrentlyRelated(function (err) {
            if (!err) {
                setForward();
                if (!reverse) setReverse();
            }
            if (callback) callback(err);
        });

        function clearCurrentlyRelated(c) {
            if (self.isFault) {
                self.get(function (err, related) {
                    if (!err) {
                        related[setterName](null, null, true);
                    }
                    c(err);
                });
            }
            else if (self.related) {
                self.related[setterName](null, null, true);
                c();
            }
            else {
                c();
            }
        }

    }
    else {
        setForward();
        if (!reverse) setReverse();
        if (callback) callback();
    }


    function setReverse() {
        if (obj) {
            obj[setterName](self.object, null, true);
        }
    }

    function setForward() {
        if (obj) {
            self._id = obj._id;
            self.related = obj;
        }
        else {
            self._id = null;
            self.related = null;
        }
        if (self.isForward) {
            self.object._markFieldAsDirty(self.forwardName);
        }
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

function ForeignKeyProxy(opts) {
    if (!this) return new ForeignKeyProxy(opts);
    NewObjectProxy.call(this, opts);
}

ForeignKeyProxy.prototype = Object.create(NewObjectProxy.prototype);

ForeignKeyProxy.prototype.set = function (obj, callback, reverse) {
    var self = this;

    // Validate first.
    if (obj) {
        var msg, err;
        if (this.isForward) {
            if (Object.prototype.toString.call(obj) == '[object Array]') {
                msg = 'Cannot assign array to forward side of foreign key relationship';
                Logger.error(msg);
                err = new RestError(msg);
                if (callback) {
                    callback(err);
                }
                else {
                    throw err;
                }
                return;
            }
        }
        else {
            if (Object.prototype.toString.call(obj) != '[object Array]') {
                msg = 'Cannot assign single to reverse side of foreign key relationship';
                Logger.error(msg);
                err = new RestError(msg);
                if (callback) {
                    callback(err);
                }
                else {
                    throw err;
                }
                return;
            }
        }
    }

    var reverseName = this.isForward ? this.reverseName : this.forwardName;
    var setterName = ('set' + capitaliseFirstLetter(reverseName));
    var splicerName = 'splice' + capitaliseFirstLetter(reverseName);
    var reverseProxyName = reverseName + 'Proxy';


    if (self.isForward) {
        removeReverse(function (err) {
            if (!err) {
                setForward();
                if (obj) {
                    if (!reverse) {
                        var identifiers = obj[reverseProxyName]._id;
                        var length = identifiers ? identifiers.length : 0;
                        obj[splicerName](length, 0, [self.object], null, true);
                    }
                }
            }
            if (callback)callback(err);
        });

    }
    else {
        setReverse(function (err) {
            if (!err) {
                var oldId = self._id;
                var oldRelated = self.related;
                self._id = [];
                if (obj) {
                    _.each(obj, function (o) {
                        self._id.push(o._id);
                        o[setterName](self.object, null, true);
                    });
                }
                self.related = obj;
                self._wrapArray(self.related);
                var old;
                if (oldRelated) {
                    old = oldRelated
                }
                else if (oldId) {
                    old = oldId;
                }
                else {
                    old = null;
                }
                broadcast(self.object, {
                    type: ChangeType.Set,
                    old: old,
                    new: obj,
                    field: self.reverseName
                });
                if (callback) callback();
            }
            else if (callback) {
                callback(err);
            }
        });
    }


    /**
     * Remove the object from the reverse foreign key
     * @param c
     */
    function removeReverse(c) {
        function _removeReverse(related) {
            var identifiers = related[reverseName + 'Proxy']._id;
            if (identifiers) {
                var idx = identifiers.indexOf(self.object._id);
                related[splicerName](idx, 1, [], null, true);
            }
        }

        if (self.isFault) {
            self.get(function (err, related) {
                if (!err) {
                    _removeReverse(related);
                }
                c(err);
            });
        }
        else if (self.related) {
            _removeReverse(self.related);
            c();
        }
        else {
            c();
        }
    }

    function setReverse(c) {
        if (!reverse) {
            function _setReverse(related) {
                _.each(related, function (r) {
                    r[setterName](self.object, null, true);
                });
            }

            if (self.isFault) {
                self.get(function (err, related) {
                    if (!err) {
                        _setReverse(related);
                    }
                    c(err);
                });
            }
            else if (self.related) {
                _setReverse(self.related);
                c();
            }
            else {
                c();
            }
        }
        else {
            c();
        }
    }

    function setForward() {
        var oldId = self._id;
        var oldRelated = self.related;
        if (obj) {
            self._id = obj._id;
            self.related = obj;
        }
        else {
            self._id = null;
            self.related = null;
        }
        if (self.isForward) {
            self.object._markFieldAsDirty(self.forwardName);
        }
        var old;
        if (oldRelated) {
            old = oldRelated;
        }
        else if (oldId) {
            old = oldId;
        }
        else {
            old = null;
        }
        broadcast(self.object, {
            type: ChangeType.Set,
            old: old,
            new: obj,
            field: self.forwardName
        })
    }
};

ForeignKeyProxy.prototype.get = function (callback) {
    var self = this;
    if (this._id) {
        Store.get({_id: this._id}, function (err, stored) {
            if (err) {
                if (callback) callback(err);
            }
            else {
                self.related = stored;
                if (Object.prototype.toString.call(stored) == '[object Array]') {
                    self._wrapArray(stored);
                }
                if (callback) callback(null, stored);
            }
        })
    }
    else if (callback) {
        callback(null, null);
    }
};

ForeignKeyProxy.prototype._initRelated = function () {
    if (!this.related) {
        this.related = [];
        this._wrapArray(this.related);
    }
    if (!this._id) {
        this._id = [];
    }
};

ForeignKeyProxy.prototype._wrapArray = function (arr) {
    var self = this;
    wrapArray(arr, this.reverseName, this.object);
    if (!arr.foreignKeyObserver) {
        arr.foreignKeyObserver = new ArrayObserver(arr);
        var observerFunction = function (splices) {
            if (Logger.debug.isEnabled)
                Logger.debug('observe');
            splices.forEach(function (splice) {
                var added = [];
                var numAdded = splice.addedCount;
                var idx = splice.index;
                for (var i = idx; i < idx + numAdded; i++) {
                    added.push(self.related[i]);
                }
                self._applyReverseOfSplice(splice.removed, added);
                splices.forEach(function (splice) {
                    broadcast(self.object, {
                        field: self.reverseName,
                        type: ChangeType.Splice,
                        index: splice.index,
                        addedCount: splice.addedCount,
                        removed: splice.removed
                    });
                });
            });
        };
        arr.foreignKeyObserver.open(observerFunction);
    }
};

ForeignKeyProxy.prototype._applyReverseOfSplice = function (removed, added) {
    if (Logger.debug.isEnabled)
        Logger.debug('_applyReverseOfSplice', reverse);
    var self = this;
    var setterName = ('set' + capitaliseFirstLetter(this.forwardName));
    _.each(removed, function (removed) {
        removed[setterName](null, null, true);
    });
    _.each(added, function (a) {
        a[setterName](self.object, null, true);
    });
};

ForeignKeyProxy.prototype._makeChangesToRelatedWithoutObservations = function (f) {
    this.related.foreignKeyObserver.close();
    this.related.foreignKeyObserver = null;
    f();
    this._wrapArray(this.related);
};

ForeignKeyProxy.prototype._splice = function (idx, numRemove, added, callback, reverse) {
    var self = this;
    if (this.isReverse) {
        if (Logger.debug.isEnabled)
            Logger.debug('_splice', idx, reverse);
        if (idx !== undefined && idx !== null && idx > -1) {
            var removed = [];
            for (var i = idx; i < idx + numRemove; i++) {
                removed.push(this.related[i]);
            }
            self._initRelated();
            var splice = _.partial(this.related.splice, idx, numRemove);
            // Otherwise infinite recursion via observations.
            this._makeChangesToRelatedWithoutObservations(function () {
                splice.apply(self.related, added);
                splice.apply(self._id, _.pluck(added, '_id'));
                broadcast(self.object, {
                    field: self.reverseName,
                    type: ChangeType.Splice,
                    index: idx,
                    addedCount: added.length,
                    removed: removed
                });
            });
            if (!reverse) {
                this._applyReverseOfSplice(removed, added, reverse);
            }
            if (callback) callback();
        }
        else {
            var sg = 'Must specify an index';
            Logger.error(sg, idx);
            throw new RestError(sg);
        }
    }
    else {
        throw new RestError('Cannot splice forward foreign key relationship');
    }

};

ForeignKeyProxy.prototype.splice = function (idx, numRemove, add, callback, reverse) {
    var args = arguments;
    var self = this;
    if (this.isFault) {
        this.get(function (err) {
            if (err) {
                if (callback) callback(err);
            }
            else {
                self._splice.apply(self, args);
            }
        })
    }
    else {
        this._splice.apply(this, arguments);
    }
};

ForeignKeyProxy.prototype.install = function (obj) {
    NewObjectProxy.prototype.install.call(this, obj);
    if (this.isReverse) {
        obj[ ('splice' + capitaliseFirstLetter(this.reverseName))] = _.bind(this.splice, this);

    }
};

exports.NewObjectProxy = NewObjectProxy;
exports.OneToOneProxy = OneToOneProxy;
exports.ForeignKeyProxy = ForeignKeyProxy;
exports.Fault = Fault;