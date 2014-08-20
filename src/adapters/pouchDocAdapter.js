angular.module('restkit.pouchDocAdapter', ['restkit', 'restkit.mapper'])

    .factory('PouchDocAdapter', function (RestObject, RestAPI, RestError) {

        function toNew(doc) {
            var mappingType = doc.type;
            if (mappingType) {
                var mapping

                throw new RestError('Cannot convert PouchDB document into RestObject. ' +
                    'No mapping with type ' + mappingType.toString(), {doc: doc})
            }
            else {
                throw new RestError('Cannot convert PouchDB document into RestObject. ' +
                    'No type field within document', {doc: doc});
            }


        }

        function toExisting(restObject, doc) {

        }

        return {
            toNew: toNew,
            toExisting: toExisting
        }
    })

;