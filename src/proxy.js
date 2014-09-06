var RestError = require('./error').RestError;
var Store = require('./store');

var defineSubProperty = require('./misc').defineSubProperty;

var Operation = require('../vendor/operations.js/src/operation').Operation;
var wrapArray = require('./notificationCentre').wrapArray;

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
        throw new RestError('Incompatible relationship');
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

var Logger = log.loggerWithName('OneToOneProxy');
Logger.setLevel(log.Level.warn);


function OneToOneProxy(opts) {
    if (!this) return new OneToOneProxy(opts);
    NewObjectProxy.call(this, opts);
}

OneToOneProxy.prototype = Object.create(NewObjectProxy.prototype);

OneToOneProxy.prototype.set = function (obj, callback, reverse) {

    if (obj) {
        if (Object.prototype.toString.call(obj) == '[object Array]') {
            callback(new RestError('Cannot assign array to one to one relationship'));
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
        if (this.isForward) {
            if (Object.prototype.toString.call(obj) == '[object Array]') {
                callback(new RestError('Cannot assign array to forward side of foreign key relationship'));
                return;
            }
        }
        else {
            if (Object.prototype.toString.call(obj) != '[object Array]') {
                callback(new RestError('Cannot assign single to reverse side of foreign key relationship'));
                return;
            }
        }
    }

    var reverseName = this.isForward ? this.reverseName : this.forwardName;
    var setterName = ('set' + capitaliseFirstLetter(reverseName));
    var splicerName = 'splice' + capitaliseFirstLetter(reverseName);
    var reverseProxyName = reverseName + 'Proxy';

    if (obj) {
        clearCurrentlyRelated(function (err) {
            if (err) {
                callback(err);
            }
            else {
                _set();
            }
        });
    }
    else {
        _set();
    }

    function _set() {
        if (self.isForward) {
            if (!reverse) {
                removeReverse(function (err) {
                    if (!err) {
                        setForward();
                        if (obj) {
                            var identifiers = obj[reverseProxyName]._id;
                            var length = identifiers ? identifiers.length : 0;
                            if (length === null || length === undefined) throw 'wtf!';
                            obj[splicerName](length, 0, [self.object], null, true);
                        }
                    }
                    if (callback)callback(err);
                });
            }
            else {
                setForward();
                if (obj) {
                    var identifiers = obj[reverseProxyName]._id;
                    var length = identifiers ? identifiers.length : 0;
                    if (length === null || length === undefined) throw 'wtf!';
                    obj[splicerName](length, 0, [self.object], null, true);
                }
                if (callback) callback();
            }
        }
        else {
            setReverse(function (err) {
                if (!err) {
                    self._id = [];
                    if (obj) {
                        _.each(obj, function (o) {
                            self._id.push(o._id);
                            o[setterName](self.object, null, true);
                        })
                    }
                    self.related = obj;
                    wrapArray(self.related, self.reverseName, self.object);
                    if (callback) callback();
                }
                else if (callback) {
                    callback(err);
                }
            });

        }
    }

    /**
     * If the relation is set, then we need to set the reverse relations
     * to null (or remove in the forward foreign key case.
     * @param c callback, called when cleared.
     */
    function clearCurrentlyRelated(c) {
        if (self.isForward) {
            removeReverse(c);
        }
        else {
            setReverse(c);
        }
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
        function _setReverse(related) {
            _.each(related, function (r) {
                r[setterName](obj, null, true);
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

    function setForward() {
        if (obj) {
            self._id = obj._id;
            self.related = obj;
        }
        else {
            self._id = null;
            self.related = null;
        }
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
                if (Object.prototype.toString.call(self.related) == '[object Array]') {
                    wrapArray(self.related, self.getName(), self.object);
                }
                if (callback) callback(null, stored);
            }
        })
    }
    else if (callback) {
        callback(null, null);
    }
};


ForeignKeyProxy.prototype._splice = function (idx, numRemove, add, callback, reverse) {
    var self = this;
    if (this.isReverse) {
        Logger.trace('_splice', idx, numRemove, add);
        if (idx !== undefined && idx !== null && idx > -1) {
            var toRemove = [];
            for (var i = idx; i < idx + numRemove; i++) {
                toRemove.push(this.related[i]);
            }
            if (!this.related) {
                this.related = [];
                wrapArray(this.related, this.reverseName, this.object);
            }
            if (!this._id) {
                this._id = [];
            }
            var splice = _.partial(this.related.splice, idx, numRemove);
            splice.apply(this.related, add);
            splice.apply(this._id, _.pluck(add, '_id'));
            var setterName = ('set' + capitaliseFirstLetter(this.forwardName));
            _.each(toRemove, function (removed) {
                removed[setterName](null, null, true);
            });
            if (!reverse) {
                _.each(add, function (added) {
                    added[setterName](self.object, null, true);
                });
            }
            if (callback) callback();
        }
        else {
            throw new RestError('Must specify an index');
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