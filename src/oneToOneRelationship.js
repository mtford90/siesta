var log = require('../vendor/operations.js/src/log');
var Logger = log.loggerWithName('OneToOneRelationship');
Logger.setLevel(log.Level.warn);

var relationship = require('./relationship');
var Relationship = relationship.Relationship;
var RestError = require('./error').RestError;
var Store = require('./store');
var ChangeType = require('./ChangeType').ChangeType;
var notificationCentre = require('./notificationCentre').notificationCentre;

function OneToOneRelationship(name, reverseName, mapping, reverseMapping) {
    if (!this) {
        return new OneToOneRelationship(name, reverseName, mapping, reverseMapping);
    }
    Relationship.call(this, name, reverseName, mapping, reverseMapping);
}

OneToOneRelationship.prototype = Object.create(Relationship.prototype);

OneToOneRelationship.prototype.getRelated = function (obj, callback) {
    Logger.debug('getRelated');
    var name;
    if (obj.mapping === this.mapping) {
        name = this.name;
    }
    else if (obj.mapping === this.reverseMapping) {
        name = this.reverseName;
    }
    var storeQuery = {};
    var proxy = obj[name];
    if (proxy) {
        storeQuery._id = proxy._id;
    }
    else {
        if (callback) callback('No local or remote id for relationship "' + name.toString() + '"');
        return;
    }
    if (storeQuery._id) {
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

};

OneToOneRelationship.prototype.addRelated = function (obj, related, callback) {
    if (callback) callback(new RestError('Cannot use addRelated on a one-to-one relationship', {relationship: this, obj: obj}));
};

OneToOneRelationship.prototype.removeRelated = function (obj, related, callback) {
    if (callback) callback(new RestError('Cannot use removeRelated on a one-to-one relationship', {relationship: this, obj: obj}));
};

OneToOneRelationship.prototype.setRelated = function (obj, related, callback, reverse) {
    var err;
    var self = this;
    var previouslyRelatedObject;

    function _setRelated(proxy, obj, related, err) {
        Logger.debug('_setRelated');
        if (err) {
            callback(err);
        }
        else {
            if (related) {
                proxy._id = related._id;
                proxy.relatedObject = related;
            }
            else {
                proxy._id = null;
                proxy.relatedObject = null;
            }


            if (proxy.relationship.isForward(obj)) {
                obj._markFieldAsDirty(proxy.relationship.name);
            }
            var notifName = obj.collection + ':' + obj.type;
            notificationCentre.emit(notifName, {
                collection: obj.collection,
                type: obj.type,
                change: {
                    type: ChangeType.Set,
                    old: previouslyRelatedObject,
                    new: related
                }
            });
            if (!reverse) { // Avoid infinite recursion.
                if (related) {
                    self.setRelated(related, obj, callback, true);
                }
            }
        }
    }

    function _unsetReversePreviouslyRelatedAndThenSetRelated(proxy) {
        Logger.debug('_unsetReversePreviouslyRelatedAndThenSetRelated');
        if (!reverse) {
            var previousId = proxy._id;
            if (previousId) {
                Logger.debug('Have a previous one-to-one relationship, therefore must clear it.');
                previouslyRelatedObject = proxy.relatedObject;
                if (previouslyRelatedObject) {
                    self.setRelated(previouslyRelatedObject, null, _.bind(_setRelated, self, proxy, obj, related), true);
                }
                else {
                    proxy.get(function (err, obj) {
                        previouslyRelatedObject = obj;
                        if (err) {
                            callback(err);
                        }
                        else {
                            self.setRelated(previouslyRelatedObject, null, _.bind(_setRelated, self, proxy, obj, related), true);
                        }
                    });
                }
            }
            else {
                _setRelated(proxy, obj, related);
            }
        }
        else {
            _setRelated(proxy, obj, related);
        }
    }

    if (obj.mapping === this.mapping) {
        var name = this.name;
        Logger.debug('setRelated[' + name + ']: ' + obj._id);
        _unsetReversePreviouslyRelatedAndThenSetRelated(obj[name]);
    }
    else if (obj.mapping === this.reverseMapping) {
        var reverseName = this.reverseName;
        Logger.debug('setRelated[' + reverseName + ']: ' + obj._id);
        _unsetReversePreviouslyRelatedAndThenSetRelated(obj[reverseName]);

    }
    else {
        err = new RestError('Cannot setRelated as this relationship has neither a forward or reverse mapping that matches.', {
            relationship: this, obj: obj
        });
    }
    if (callback) callback(err);
};

exports.OneToOneRelationship = OneToOneRelationship;