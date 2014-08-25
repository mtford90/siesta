angular.module('restkit.notifications', [])

    .factory('broadcast', function ( $rootScope) {

        return function (restObject, change) {

            var notification = {
                collection: restObject.collection,
                type: restObject.type,
                obj: restObject,
                change: change
            };
            $rootScope.$broadcast(restObject.collection + ':' + restObject.type, notification);
            $rootScope.$broadcast(restObject.collection, notification);
            $rootScope.$broadcast('Fount', notification);
        }

    })

;