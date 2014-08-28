angular.module('restkit.relationship', ['restkit', 'restkit.store'])

    .constant('RelationshipType', {
        ForeignKey: 'ForeignKey',
        OneToOne: 'OneToOne'
    })

    .factory('RelatedObjectProxy', function ($q) {
        function RelatedObjectProxy(relationship, object) {
            this.relationship = relationship;
            this.object = object;
            this._id = null;
            this.relatedObject = null;
        }

        RelatedObjectProxy.prototype.get = function (callback) {
            var self = this;
            var deferred = $q.defer();
            this.relationship.getRelated(this.object, function (err, related) {
                if (!err) {
                    self.relatedObject = related;
                }
                if (callback) callback(err, related);
                if (err) {
                    deferred.reject(err);
                }
                else {
                    deferred.resolve(related);
                }
            });
            return deferred.promise;
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

        return RelatedObjectProxy;
    })

    .factory('Relationship', function (RestError, RelatedObjectProxy, Store) {
        function Relationship(name, reverseName, mapping, reverseMapping) {
            if (!this) {
                return new Relationship(name, reverseName, mapping, reverseMapping);
            }
            this.mapping = mapping;
            this.name = name;
            this.reverseName = reverseName;
            this.reverseMapping = reverseMapping;
        }

        Relationship.prototype.getRelated = function (obj, callback) {
            throw Error('Relationship.getRelated must be overridden');
        };

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

        return Relationship;
    })


    .factory('ForeignKeyRelationship', function (Relationship, Store, jlog, RestError, ChangeType, $rootScope) {
        var $log = jlog.loggerWithName('ForeignKeyRelationship');

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
                $log.debug('addNewRelated');

                function broadCast() {
                    var field = proxy.relationship.isForward(obj) ? proxy.relationship.name : proxy.relationship.reverseName;
                    obj._markFieldAsDirty(field);
                    $rootScope.$broadcast(obj.collection + ':' + obj.type, {
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
                $log.debug('_removeOldRelatedAndThenSetNewRelated');
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
                $log.debug('removeOldRelatedAndThenSetNewRelated');
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
                        $rootScope.$broadcast(obj.collection + ':' + obj.type, {
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
            $log.debug('removeRelated');
            var self = this;
            var err;
            if (obj.mapping === this.mapping) {
                err = new RestError('Cannot use removeRelated on a forward foreign key relationship.', {relationship: this, obj: obj});
                if (callback) callback(err);
            }
            else if (obj.mapping === this.reverseMapping) {
                $log.debug('removeRelated[' + this.reverseName + ']', {obj: obj, related: related});
                var proxy = obj[this.reverseName];
                // Fetch other related objects before removing otherwise we will get out sync with local storage.
                if (proxy.isFault()) {
                    proxy.get(function (err) {
                        if (!err) {
                            var idx = self.removeRelatedFromProxy(proxy, related);
                            var removedSomething = idx > -1;
                            if (removedSomething) {
                                $rootScope.$broadcast(obj.collection + ':' + obj.type, {
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
                        $rootScope.$broadcast(obj.collection + ':' + obj.type, {
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
                $log.error(msg, context);
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
                $log.debug('addRelated[' + this.reverseName + ']', {obj: obj, related: related});
                var proxy = obj[this.reverseName];
                // Fetch other related objects before inserting the new one.
                if (proxy.isFault()) {
                    proxy.get(function (err) {
                        if (!err) {
                            self.addRelatedToProxy(proxy, related);
                            $rootScope.$broadcast(obj.collection + ':' + obj.type, {
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
                    $rootScope.$broadcast(obj.collection + ':' + obj.type, {
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

        return ForeignKeyRelationship;
    })

    .factory('OneToOneRelationship', function (Relationship, Store, jlog, RestError, $rootScope, ChangeType) {
        var $log = jlog.loggerWithName('OneToOneRelationship');

        function OneToOneRelationship(name, reverseName, mapping, reverseMapping) {
            if (!this) {
                return new OneToOneRelationship(name, reverseName, mapping, reverseMapping);
            }
            Relationship.call(this, name, reverseName, mapping, reverseMapping);
        }

        OneToOneRelationship.prototype = Object.create(Relationship.prototype);

        OneToOneRelationship.prototype.getRelated = function (obj, callback) {
            $log.debug('getRelated');
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
                $log.debug('_setRelated');
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
                    $rootScope.$broadcast(obj.collection + ':' + obj.type, {
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
                $log.debug('_unsetReversePreviouslyRelatedAndThenSetRelated');
                if (!reverse) {
                    var previousId = proxy._id;
                    if (previousId) {
                        $log.debug('Have a previous one-to-one relationship, therefore must clear it.');
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
                $log.debug('setRelated[' + name + ']: ' + obj._id);
                _unsetReversePreviouslyRelatedAndThenSetRelated(obj[name]);
            }
            else if (obj.mapping === this.reverseMapping) {
                var reverseName = this.reverseName;
                $log.debug('setRelated[' + reverseName + ']: ' + obj._id);
                _unsetReversePreviouslyRelatedAndThenSetRelated(obj[reverseName]);

            }
            else {
                err = new RestError('Cannot setRelated as this relationship has neither a forward or reverse mapping that matches.', {
                    relationship: this, obj: obj
                });
            }
            if (callback) callback(err);
        };

        return OneToOneRelationship;
    })


;