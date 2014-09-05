var RestError = require('./error').RestError;
var Store = require('./store');

var defineSubProperty = require('./misc').defineSubProperty;

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


function OneToOneProxy(opts) {
    if (!this) return new OneToOneProxy(opts);
    NewObjectProxy.call(this, opts);
}

OneToOneProxy.prototype = Object.create(NewObjectProxy.prototype);


OneToOneProxy.prototype.set = function (obj, callback, reverse) {
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

exports.NewObjectProxy = NewObjectProxy;
exports.OneToOneProxy = OneToOneProxy;
exports.Fault = Fault;