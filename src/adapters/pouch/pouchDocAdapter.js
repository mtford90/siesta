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
            // TODO: Possibly use the notifications to keep everything in sync? More disk writes tho... Could get crazy.
            startSync: function () {
//                $rootScope.$on('Fount', function (e, n) {
//                    $log.trace('Received notif', JSON.stringify(n, null, 4));
//                    var changeType = n.change.type;
//                    var field = n.change.field;
//                    var obj = n.obj;
//                    if (changeType == ChangeType.Set) {
//                        var id = obj._id;
//                        var newVal = n.change['new'];
//                        retryUntilWritten(id, field, newVal);
//                    }
//                });
            },
            retryUntilWrittenMultiple: retryUntilWrittenMultiple
        }
    })

    .factory('PouchDocAdapter', function (CollectionRegistry, RestError, jlog) {

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
            var r = mapping._new();
            for (var prop in doc) {
                if (doc.hasOwnProperty(prop)) {
                    r[prop] = doc[prop];
                }
            }
            return r;
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
            return adapted;
        }


        return {
            toNew: toNew,
            _validate: validate,
            from: from
        }
    })

;