angular.module('restkit.pouchDocAdapter', ['restkit', 'restkit.object'])

    .factory('PouchDocAdapter', function (RestObject, CollectionRegistry, RestError) {

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
            var r = new RestObject(validate(doc));
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
        function from (obj) {
            var mapping = obj.mapping;
            var adapted = {};
            _.each(mapping._fields, function (f) {
                var v = obj[f];
                if (v) {
                    adapted[f] = v;
                }
            });
            _.each(mapping.relationships, function (r) {
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