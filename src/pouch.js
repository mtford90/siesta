angular.module('restkit.pouchDocAdapter', ['restkit', 'restkit.object'])

    .factory('PouchDocSync', function ($rootScope, jlog, ChangeType, Pouch) {

        var $log = jlog.loggerWithName('PouchDocSync');

        function retryUntilWrittenMultiple(docId, newValues, callback) {

            Pouch.getPouch().get(docId, function (err, doc) {
                if (err) {
                    var msg = 'Unable to get doc with _id="' + docId + '". This is a serious error and means that ' +
                        'a live object is now out of sync with PouchDB.';
                    $log.error(msg);
                    if (callback) callback(err);
                }
                else {
                    for (var key in newValues) {
                        if (newValues.hasOwnProperty(key)) {
                            doc[key] = newValues[key];
                        }
                    }
                    Pouch.getPouch().put(doc, function (err, resp) {
                        if (err) {
                            if (err.status == 409) {
                                retryUntilWrittenMultiple(docId, newValues);
                            }
                            else {
                                var msg = 'Unable to update doc with _id="' + docId + '". This is a serious error and means that ' +
                                    'a live object is now out of sync with PouchDB.';
                                $log.error(msg);
                                if (callback) callback(err);
                            }
                        }
                        else {
                            $log.trace('Successfully persisted changes: ' + JSON.stringify({doc: doc._id, pouchDBResponse: resp, changes: newValues}, null, 4));
                            if (callback) callback();
                        }
                    });
                }
            });
        }

        return {
            retryUntilWrittenMultiple: retryUntilWrittenMultiple
        }
    })


    .factory('Pouch', function (guid, jlog) {

        var $log = jlog.loggerWithName('Pouch');

        var pouch = PouchDB('Rest');
        return {
            /**
             * Create a randomly named PouchDB instance.
             * Used for testing purposes.
             * @private
             */
            reset: function () {
                var dbName = guid();
                $log.trace('_reset:', dbName);
                pouch = new PouchDB(dbName);
            },

            /**
             * Return the global PouchDB instance.
             * Used for testing purposes.
             * @returns {PouchDB}
             */
            getPouch: function () {
                return pouch;
            }
        }
    })


    .factory('PouchDocAdapter', function (CollectionRegistry, RestError, jlog, cache) {

        var $log = jlog.loggerWithName('PouchDocAdapter');

        function validate(doc) {
            var collectionName = doc.collection;
            if (collectionName) {
                var collection = CollectionRegistry[collectionName];
                if (collection) {
                    var mappingType = doc.type;
                    if (mappingType) {
                        var mapping = collection[mappingType];
                        if (mapping) {
                            return mapping;
                        }
                        else {
                            throw new RestError('Cannot convert PouchDB document into RestObject. ' +
                                'No mapping with type ' + mappingType.toString(), {doc: doc})
                        }
                    }
                    else {
                        throw new RestError('Cannot convert PouchDB document into RestObject. ' +
                            'No type field within document', {doc: doc});
                    }
                }
                else {
                    throw new RestError('Cannot convert PouchDB document into RestObject. ' +
                        'API "' + collectionName.toString() + '" doesnt exist.', {doc: doc});
                }

            }
            else {
                throw new RestError('Cannot convert PouchDB document into RestObject. ' +
                    'No collection field within document', {doc: doc});
            }
        }

        function toNew(doc) {
            var mapping = validate(doc);
            var obj = mapping._new();
            for (var prop in doc) {
                if (doc.hasOwnProperty(prop)) {
                    if (obj._fields.indexOf(prop) > -1) {
                        obj[prop] = doc[prop];
                    }
                    else if (obj._relationshipFields.indexOf(prop) > -1) {
                        obj[prop]._id = doc[prop];
                    }
                }
            }
            return obj;
        }

        function toFount(docs) {
            var mapped = [];
            for (var i = 0; i < docs.length; i++) {
                var doc = docs[i];
                var cached = cache.get({_id: doc._id});
                if (cached) {
                    mapped[i] = cached;
                }
                else {
                    mapped[i] = toNew(doc);
                }
            }
            return mapped;
        }

        /**
         * Convert a RestObject instance into a Pouch document so can be persisted.
         * @param obj An instance of RestObject
         */
        function from(obj) {
            $log.trace('from', {obj: obj});
            var mapping = obj.mapping;
            var adapted = {};
            _.each(mapping._fields, function (f) {
                $log.trace('field', f);
                var v = obj[f];
                $log.trace(f + '=', v);
                if (v) {
                    adapted[f] = v;
                }
            });
            _.each(mapping.relationships, function (r) {
                $log.trace('relationship', r);
                // Only forward relationships are stored in the database.
                if (r.isForward(obj)) {
                    var name = r.name;
                    var proxy = obj[name];
                    if (proxy._id) {
                        adapted[name] = proxy._id;
                    }
                }
            });
            adapted._id = obj._id;
            adapted._rev = obj._rev;
            adapted.type = obj.mapping.type;
            adapted.collection = obj.collection;
            return adapted;
        }


        return {
            toNew: toNew,
            _validate: validate,
            from: from,
            toFount: toFount
        }
    })

;