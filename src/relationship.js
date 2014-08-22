angular.module('restkit.relationship', ['restkit', 'restkit.store'])

    .constant('RelationshipType', {
        ForeignKey: 'ForeignKey',
        ManyToMany: 'ManyToMany',
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

        RelatedObjectProxy.prototype.isFault = function () {
            if (this._id) {
                return !this.relatedObject;
            }
            return false; // If no object is related then implicitly this is not a fault.
        };

        return RelatedObjectProxy;
    })

    .factory('Relationship', function (RestError, RelatedObjectProxy) {
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
        return Relationship;
    })

    .factory('ManyToManyRelationship', function (Relationship, Store, jlog) {

        var $log = jlog.loggerWithName('ManyToManyRelationship');

        function ManyToManyRelationship(name, reverseName, mapping, reverseMapping) {
            if (!this) {
                return new ManyToManyRelationship(name, reverseName, mapping, reverseMapping);
            }
            Relationship.call(this, name, reverseName, mapping, reverseMapping);
        }

        ManyToManyRelationship.prototype = Object.create(Relationship.prototype);

        ManyToManyRelationship.prototype.getRelated = function (obj, callback) {

            var self = this;
            var storeQueries;
            if (obj[this.name]) {
                storeQueries = _.map(obj[this.name], function (_id) {return {_id: _id}});
            }
            else {
                if (callback) callback('No local or remote id for relationship "' + this.name.toString() + '"');
                return;
            }
            Store.getMultiple(storeQueries, function (errs) {
                if (errs) {
                    var allErrorsAre404 = true;
                    for (var i = 0; i < errs.length; i++) {
                        var err = errs[i];
                        if (err.status != 404) {
                            allErrorsAre404 = false;
                            break;
                        }
                    }
                    if (allErrorsAre404) {
                        $log.debug('Couldnt find using _id, therefore using as remote id');
                        // Attempt to use the identifier as a remote id and lookup that way instead.
                        storeQueries = _.map(obj[self.name], function (id) {
                            var storeQuery = {};
                            storeQuery[self.reverseMapping.id] = id;
                            storeQuery.mapping = self.reverseMapping;
                            return storeQuery;
                        });
                        Store.getMultiple(storeQueries, callback);
                    }
                    else {
                        if (callback) callback(errs);
                    }
                }
                else if (callback) {
                    callback();
                }
            });
        };

        return ManyToManyRelationship;
    })

    .factory('ForeignKeyRelationship', function (Relationship, Store, jlog, RestError) {
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
            var storeQuery = {};
            var proxy = obj[name];
            if (proxy) {
                storeQuery._id = proxy._id;
            }
            else {
                if (callback) callback('No local or remote id for relationship "' + name.toString() + '"');
                return;
            }
            Store.get(storeQuery, function (err, storedObj) {
                if (err) {
                    if (callback) callback(err);
                }
                else if (callback) {
                    callback(null, storedObj);
                }
            });
        };

        ForeignKeyRelationship.prototype.setRelated = function (obj, related, callback) {
            var self = this;
            var err;

            function addNewRelated(proxy) {
                $log.debug('addNewRelated');
                proxy._id = related._id;
                proxy.relatedObject = related;
                self.addRelated(related, obj, callback);
            }

            function _removeOldRelatedAndThenSetNewRelated(proxy, oldRelated) {
                $log.debug('_removeOldRelatedAndThenSetNewRelated');
                self.removeRelated(oldRelated, obj, function (err) {
                    if (err) {
                        callback(err);
                    }
                    else {
                        addNewRelated(proxy);
                    }
                });
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

            if (obj.mapping === this.mapping) {
                var proxy = obj[this.name];
                if (proxy._id) {
                    if (proxy.relatedObject) {
                        removeOldRelatedAndThenSetNewRelated(proxy.relatedObject);
                    }
                    else {
                        proxy.get(function (err, oldRelated) {
                            if (err) {
                                callback(err);
                            }
                            else {
                                removeOldRelatedAndThenSetNewRelated(oldRelated);
                            }
                        });
                    }
                }
                else {
                    addNewRelated(proxy);
                }
            }
            else if (obj.mapping === this.reverseMapping) {
                err = new RestError('Cannot use setRelated on a reverse foreign key relationship. Use addRelated instead.', {relationship: this, obj: obj});
                if (callback) callback(err);
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
        };

        ForeignKeyRelationship.prototype.removeRelated = function (obj, related, callback) {
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
                            self.removeRelatedFromProxy(proxy, related);
                            callback();
                        }
                        else if (callback) {
                            callback(err);
                        }
                    });
                }
                else {
                    self.removeRelatedFromProxy(proxy, related);
                    callback();
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

        ForeignKeyRelationship.prototype.addRelated = function (obj, related, callback) {
            $log.debug('addRelated');
            var self = this;
            var err;
            if (this.isForward(obj)) {
                err = new RestError('Cannot use addRelate on a forward foreign key relationship. Use addRelated instead.', {relationship: this, obj: obj});
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
                            callback();
                        }
                        else if (callback) {
                            callback(err);
                        }
                    });
                }
                else {
                    this.addRelatedToProxy(proxy, related);
                    callback();
                }
            }
            else {
                err = new RestError('Cannot setRelated as this relationship has neither a forward or reverse mapping that matches.', {relationship: this, obj: obj});
                if (callback) callback(err);
            }
        };

        return ForeignKeyRelationship;
    })

    .factory('OneToOneRelationship', function (Relationship, Store, jlog, RestError) {
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
            Store.get(storeQuery, function (err, storedObj) {
                if (err) {
                    if (callback) callback(err);
                }
                else if (callback) {
                    callback(null, storedObj);
                }
            });
        };

        OneToOneRelationship.prototype.addRelated = function (obj, related, callback) {
            if (callback) callback(new RestError('Cannot use addRelated on a one-to-one relationship', {relationship: this, obj: obj}));
        };

        OneToOneRelationship.prototype.removeRelated = function (obj, related, callback) {
            if (callback) callback(new RestError('Cannot use removeRelated on a one-to-one relationship', {relationship: this, obj: obj}));
        };

        OneToOneRelationship.prototype.setRelated = function (obj, related, callback, reverse) {
            var err, proxy;
            if (obj.mapping === this.mapping) {
                proxy = obj[this.name];
                var previousId = proxy.id;
                if (previousId) {
                    this.setRelated(related, obj, callback, true);
                }
                proxy._id = related._id;
                proxy.relatedObject = related;
                if (!reverse) { // Avoid infinite recursion.
                    this.setRelated(related, obj, callback, true);
                }
            }
            else if (obj.mapping === this.reverseMapping) {
                proxy = obj[this.reverseName];
                proxy._id = related._id;
                proxy.relatedObject = related;
                if (!reverse) { // Avoid infinite recursion.
                    this.setRelated(related, obj, callback, true);
                }
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