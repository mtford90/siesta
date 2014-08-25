angular.module('restkit.http', ['restkit'])

    .factory('HTTP', function ($http) {

        return {
            sendRequest: function (config, callback) {
                $http(config).success(function (data, status, headers, config) {

                }).error(function (data, status, headers, config) {

                });
            }
        }

    })

;