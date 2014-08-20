angular.module('restkit.pouchDocAdapter', ['restkit', 'restkit.mapper'])

    .factory('PouchDocAdapter', function (RestObject, RestAPIRegistry, RestError) {

        function validate(doc) {
            var apiName = doc.api;
            if (apiName) {
                var api = RestAPIRegistry[apiName];
                if (api) {
                    var mappingType = doc.type;
                    if (mappingType) {
                        var mapping = api[mappingType];
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
                        'API "' + apiName.toString() + '" doesnt exist.', {doc: doc});
                }

            }
            else {
                throw new RestError('Cannot convert PouchDB document into RestObject. ' +
                    'No api field within document', {doc: doc});
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

        return {
            toNew: toNew,
            _validate: validate
        }
    })

;