angular.module('restkit.notifications', [])

    .factory('broadcast', function ( $rootScope) {

        return function (restObject, change) {

            var notification = {
                api: restObject.api,
                type: restObject.type,
                obj: restObject,
                change: change
            };
            $rootScope.$broadcast(restObject.api + ':' + restObject.type, notification);
            $rootScope.$broadcast(restObject.api, notification);
            $rootScope.$broadcast('Fount', notification);
        }

    })

;