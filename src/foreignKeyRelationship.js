var log = require('../vendor/operations.js/src/log');
var Logger = log.loggerWithName('ForeignKeyRelationship');
Logger.setLevel(log.Level.warn);

var ChangeType = require('./ChangeType').ChangeType;
var notificationCentre = require('./notificationCentre').notificationCentre;
var Relationship = require('./relationship').Relationship;
var RestError = require('./error').RestError;
var Store = require('./store');

function ForeignKeyRelationship(name, reverseName, mapping, reverseMapping) {
    if (!this) {
        return new ForeignKeyRelationship(name, reverseName, mapping, reverseMapping);
    }
    Relationship.call(this, name, reverseName, mapping, reverseMapping);
}

ForeignKeyRelationship.prototype = Object.create(Relationship.prototype);

ForeignKeyRelationship.prototype.getRelated = function (obj, callback) {
    var name;
    if (obj.mapping === this.mapping) {
        name = this.name;
    }
    else if (obj.mapping === this.reverseMapping) {
        name = this.reverseName;
    }
    if (name) {
        var storeQuery = {};
        var proxy = obj[name];
        if (proxy) {
            storeQuery._id = proxy._id;
        }
        else {
            if (callback) callback('No local or remote id for relationship "' + name.toString() + '"');
            return;
        }
        if (proxy._id) {
            Store.get(storeQuery, function (err, storedObj) {
                if (err) {
                    if (callback) callback(err);
                }
                else if (callback) {
                    callback(null, storedObj);
                }
            });
        }
        else if (callback) {
            callback(null, null);
        }

    }
    else {
        callback(new RestError('Cannot use getRelated as this relationship does not match either of the mappings'));
    }

};

ForeignKeyRelationship.prototype.setRelated = function (obj, related, callback, reverse) {
    var self = this;
    var err;
    var previouslyRelatedObject;

    function addNewRelated(proxy) {

        function broadCast() {
            var field = proxy.relationship.isForward(obj) ? proxy.relationship.name : proxy.relationship.reverseName;
            obj._markFieldAsDirty(field);
            var notifName = obj.collection + ':' + obj.type;
            dump('emit', notifName);
            notificationCentre.emit(notifName, {
                collection: obj.collection,
                type: obj.type,
                obj: obj,
                change: {
                    type: ChangeType.Set,
                    old: previouslyRelatedObject,
                    new: related,
                    field: self.name
                }
            });
        }

        if (related) {
            proxy._id = related._id;
            proxy.relatedObject = related;

            broadCast();
            if (!reverse) {
                self.addRelated(related, obj, callback, true);
            }
            else if (callback) {
                callback();
            }
        }
        else {
            proxy._id = null;
            proxy.relatedObject = null;
            broadCast();
            if (callback) callback();
        }
    }

    function _removeOldRelatedAndThenSetNewRelated(proxy, oldRelated) {
        Logger.debug('_removeOldRelatedAndThenSetNewRelated');
        self.removeRelated(oldRelated, obj, function (err) {
            if (err) {
                if (callback) callback(err);
            }
            else {
                addNewRelated(proxy);
            }
        }, true);
    }

    function removeOldRelatedAndThenSetNewRelated(oldRelated) {
        Logger.debug('removeOldRelatedAndThenSetNewRelated');
        if (proxy.isFault()) {
            proxy.get(function (err) {
                if (!err) {
                    _removeOldRelatedAndThenSetNewRelated(proxy, oldRelated);
                }
                else if (callback) {
                    callback(err);
                }
            });
        }
        else {
            _removeOldRelatedAndThenSetNewRelated(proxy, oldRelated);
        }
    }

    var proxy;
    if (obj.mapping === this.mapping) {
        proxy = obj[this.name];
        if (proxy._id) {
            if (proxy.relatedObject) {
                previouslyRelatedObject = proxy.relatedObject;
                if (!reverse) {
                    removeOldRelatedAndThenSetNewRelated(previouslyRelatedObject);
                }
                else {
                    previouslyRelatedObject = proxy.relatedObject;
                    addNewRelated(proxy);
                }
            }
            else {
                proxy.get(function (err, oldRelated) {
                    previouslyRelatedObject = oldRelated;
                    if (err) {
                        callback(err);
                    }
                    else {
                        removeOldRelatedAndThenSetNewRelated(previouslyRelatedObject);
                    }
                });
            }
        }
        else {
            addNewRelated(proxy);
        }
    }
    else if (obj.mapping === this.reverseMapping) {

        var previous;
        if (Object.prototype.toString.call(related) === '[object Array]') {
            proxy = obj[this.reverseName];

            function removeOldRelated(callback) {
                var errs = [];
                var finished = [];
                _.each(proxy.relatedObject, function (oldRelated) {
                    self.setRelated(oldRelated, null, function (err) {
                        if (err) errs.push(err);
                        finished.push(oldRelated);
                        if (finished.length == proxy.relatedObject.length) {
                            callback(errs.length ? errs : null);
                        }
                    }, true);
                });
            }

            function setRelated() {
                proxy._id = _.pluck(related, '_id');
                proxy.relatedObject = related;
                notificationCentre.emit(obj.collection + ':' + obj.type, {
                    collection: obj.collection,
                    type: obj.type,
                    obj: obj,
                    change: {
                        type: ChangeType.Set,
                        old: previous,
                        new: related,
                        field: self.reverseName
                    }
                });
                // Reverse
                if (related.length) {
                    var errs = [];
                    var finished = [];
                    _.each(related, function (r) {
                        self.setRelated(r, obj, function (err) {
                            if (err) errs.push(err);
                            finished.push(r);
                            if (finished.length == related.length) {
                                if (callback) callback(errs.length ? errs : null);
                            }
                        }, true);
                    });
                }
                else {
                    callback();
                }
            }

            // Forward
            if (proxy._id ? proxy._id.length : proxy._id) {
                if (proxy.relatedObject) {
                    previous = proxy.relatedObject;
                    removeOldRelated(function (err) {
                        if (err) {
                            callback(err);
                        }
                        else {
                            setRelated();
                        }
                    });
                }
                else {
                    throw 'nyi';
                }
            }
            else {
                setRelated();
            }
        }
        else {
            if (callback) callback(new RestError('setRelated on reverse foreign key must be an array'));
        }
    }
    else {
        err = new RestError('Cannot setRelated as this relationship has neither a forward or reverse mapping that matches.', {relationship: this, obj: obj});
        if (callback) callback(err);
    }
};

/**
 * Plonk both the identifier and related object on the relationship proxy.
 * Note that before we do this, we have to ensure that the proxy is no longer faulted otherwise
 * could be out of sync with whats on disk.
 * @param proxy
 * @param related
 */
ForeignKeyRelationship.prototype.addRelatedToProxy = function (proxy, related) {
    if (!proxy.relatedObject) {
        proxy.relatedObject = [];
    }
    if (!proxy._id) {
        proxy._id = [];
    }
    proxy._id.push(related._id);
    proxy.relatedObject.push(related);
};

ForeignKeyRelationship.prototype.removeRelatedFromProxy = function (proxy, related) {
    var idx;
    if (proxy.relatedObject) {
        idx = proxy.relatedObject.indexOf(related);
        if (idx > -1) {
            proxy.relatedObject.splice(idx, 1);
        }
    }
    if (proxy._id) {
        idx = proxy._id.indexOf(related._id);
        if (idx > -1) {
            proxy._id.splice(idx, 1);
        }
    }

    return idx;
};

ForeignKeyRelationship.prototype.removeRelated = function (obj, related, callback, reverse) {
    Logger.debug('removeRelated');
    var self = this;
    var err;
    if (obj.mapping === this.mapping) {
        err = new RestError('Cannot use removeRelated on a forward foreign key relationship.', {relationship: this, obj: obj});
        if (callback) callback(err);
    }
    else if (obj.mapping === this.reverseMapping) {
        Logger.debug('removeRelated[' + this.reverseName + ']', {obj: obj, related: related});
        var proxy = obj[this.reverseName];
        // Fetch other related objects before removing otherwise we will get out sync with local storage.
        if (proxy.isFault()) {
            proxy.get(function (err) {
                if (!err) {
                    var idx = self.removeRelatedFromProxy(proxy, related);
                    var removedSomething = idx > -1;
                    if (removedSomething) {
                        notificationCentre.emit(obj.collection + ':' + obj.type, {
                            collection: obj.collection,
                            type: obj.type,
                            change: {
                                type: ChangeType.Remove,
                                index: idx,
                                old: related,
                                field: self.reverseName
                            }
                        });
                        if (!reverse) {
                            self.setRelated(related, null, callback, true);
                        }
                        else {
                            if (callback) callback();
                        }
                    }
                    else {
                        if (callback) callback();
                    }

                }
                else if (callback) {
                    callback(err);
                }
            });
        }
        else {
            var idx = self.removeRelatedFromProxy(proxy, related);
            var removedSomething = idx > -1;
            if (removedSomething) {
                notificationCentre.emit(obj.collection + ':' + obj.type, {
                    collection: obj.collection,
                    type: obj.type,
                    change: {
                        type: ChangeType.Remove,
                        index: idx,
                        old: related,
                        field: self.reverseName
                    }
                });
                if (!reverse) {
                    self.setRelated(related, null, callback, true);
                }
                else {
                    if (callback) callback();
                }
            }
            else {
                if (callback) callback();
            }

        }
    }
    else {
        var context = {relationship: this.name, reverseRelationship: this.reverseName, obj: obj};
        var msg = 'Cannot removeRelated as this relationship has neither a forward or reverse mapping that matches.';
        Logger.error(msg, context);
        err = new RestError(msg, context);
        if (callback) callback(err);
    }
};

ForeignKeyRelationship.prototype.addRelated = function (obj, related, callback, reverse) {
    var self = this;
    var err;
    if (this.isForward(obj)) {
        err = new RestError('Cannot use addRelate on a forward foreign key relationship. Use setRelated instead.', {relationship: this, obj: obj});
        if (callback) callback(err);
    }
    else if (this.isReverse(obj)) {
        Logger.debug('addRelated[' + this.reverseName + ']', {obj: obj, related: related});
        var proxy = obj[this.reverseName];
        // Fetch other related objects before inserting the new one.
        if (proxy.isFault()) {
            proxy.get(function (err) {
                if (!err) {
                    self.addRelatedToProxy(proxy, related);
                    var notificationName = obj.collection + ':' + obj.type;
                    dump('emit', notificationName);
                    notificationCentre.emit(notificationName, {
                        collection: obj.collection,
                        type: obj.type,
                        change: {
                            type: ChangeType.Insert,
                            new: related,
                            index: proxy.relatedObject.length - 1,
                            field: self.reverseName
                        }
                    });
                    if (!reverse) {
                        self.setRelated(related, obj, callback, true);
                    }
                    else {
                        callback();
                    }
                }
                else if (callback) {
                    callback(err);
                }
            });
        }
        else {
            this.addRelatedToProxy(proxy, related);
            notificationCentre.emit(obj.collection + ':' + obj.type, {
                collection: obj.collection,
                type: obj.type,
                change: {
                    type: ChangeType.Insert,
                    new: related,
                    index: proxy.relatedObject.length - 1,
                    field: this.reverseName
                }
            });
            if (!reverse) {
                self.setRelated(related, obj, callback, true);
            }
            else {
                callback();
            }
        }
    }
    else {
        err = new RestError('Cannot setRelated as this relationship has neither a forward or reverse mapping that matches.', {relationship: this, obj: obj});
        if (callback) callback(err);
    }
};


exports.ForeignKeyRelationship = ForeignKeyRelationship;