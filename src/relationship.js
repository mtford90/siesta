var RestError = require('./error').RestError;
var Store = require('./store');

var defineSubProperty = require('./misc').defineSubProperty;

RelationshipType = {
    ForeignKey: 'ForeignKey',
    OneToOne: 'OneToOne'
};

function Fault(proxy, relationship) {
    var self = this;
    this.proxy = proxy;
    Object.defineProperty(this, 'isFault',  {
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
    this.relatedObject = null;
    Object.defineProperty(this, 'isFault',  {
        get: function () {
            if (self._id) {
                return !self.relatedObject;
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
                set: function () {
                    self.set(obj);
                },
                configurable: true,
                enumerable: true
            });
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

function RelatedObjectProxy(relationship, object) {
    this.relationship = relationship;
    this.object = object;
    this._id = null;
    this.relatedObject = null;
}

RelatedObjectProxy.prototype.get = function (callback) {
    var self = this;
    this.relationship.getRelated(this.object, function (err, related) {
        if (!err) {
            self.relatedObject = related;
        }
        if (callback) callback(err, related);
    });
};

RelatedObjectProxy.prototype.set = function (obj, callback) {
    this.relationship.setRelated(this.object, obj, callback);
};

RelatedObjectProxy.prototype.remove = function (obj, callback) {
    this.relationship.removeRelated(this.object, obj, callback);
};

RelatedObjectProxy.prototype.add = function (obj, callback) {
    this.relationship.addRelated(this.object, obj, callback);
};

RelatedObjectProxy.prototype.isFault = function () {
    if (this._id) {
        return !this.relatedObject;
    }
    return false; // If no object is related then implicitly this is not a fault.
};


function Relationship(name, reverseName, mapping, reverseMapping) {
    if (!this) {
        return new Relationship(name, reverseName, mapping, reverseMapping);
    }
    var self = this;
    this.mapping = mapping;
    this.name = name;
    this._reverseName = reverseName;
    Object.defineProperty(this, 'reverseName', {
        get: function () {
            if (self._reverseName) {
                return self._reverseName;
            }
            else {
                return 'reverse_' + self.name;
            }
        }
    });
    this.reverseMapping = reverseMapping;
}

//noinspection JSUnusedLocalSymbols
Relationship.prototype.getRelated = function (obj, callback) {
    throw Error('Relationship.getRelated must be overridden');
};

//noinspection JSUnusedLocalSymbols
Relationship.prototype.setRelated = function (obj, related, callback) {
    throw Error('Relationship.setRelated must be overridden');
};

Relationship.prototype.isForward = function (obj) {
    return obj.mapping === this.mapping;
};

Relationship.prototype.isReverse = function (obj) {
    return obj.mapping === this.reverseMapping;
};

Relationship.prototype.contributeToRestObject = function (obj) {
    if (this.isForward(obj)) {
        obj[this.name] = new RelatedObjectProxy(this, obj);
    }
    else if (this.isReverse(obj)) {
        obj[this.reverseName] = new RelatedObjectProxy(this, obj);
    }
    else {
        throw new RestError('Cannot contribute to object as this relationship has neither a forward or reverse mapping that matches', {relationship: this, obj: obj});
    }
};

Relationship.prototype.setRelatedById = function (obj, relatedId, callback) {
    var self = this;
    Store.get({_id: relatedId}, function (err, related) {
        if (err) {
            callback(err);
        }
        else {
            self.setRelated(obj, related, function () {
                if (callback) callback();
            });
        }
    })
};

Relationship.prototype._dump = function (asJSON) {
    var obj = {};
    obj.forward = {
        name: this.name,
        mapping: this.mapping.type
    };
    obj.reverse = {
        name: this.reverseName,
        mapping: this.reverseMapping.type
    };
    return asJSON ? JSON.stringify(obj, null, 4) : obj;
};


exports.Relationship = Relationship;
exports.RelatedObjectProxy = RelatedObjectProxy;
exports.RelationshipType = RelationshipType;
exports.NewObjectProxy = NewObjectProxy;
exports.Fault = Fault;