function NotificationCentre() {
    this.listeners = {};
}

NotificationCentre.prototype.registerListener = function (n, l) {
    if (!this.listeners[n]) this.listeners[n] = [];
    this.listeners[n].push(l);
};

NotificationCentre.prototype.deregisterListener = function (n, l) {
    var idx = this.listeners[n].indexOf(l);
    if (idx > -1) {
        this.listeners[n].splice(idx, 1);
    }
};

exports.NotificationCentre = new NotificationCentre();

//angular.module('restkit.notifications', [])
//
//    .factory('broadcast', function ( $rootScope) {
//
//        return function (restObject, change) {
//
//            var notification = {
//                collection: restObject.collection,
//                type: restObject.type,
//                obj: restObject,
//                change: change
//            };
//            $rootScope.$broadcast(restObject.collection + ':' + restObject.type, notification);
//            $rootScope.$broadcast(restObject.collection, notification);
//            $rootScope.$broadcast('Fount', notification);
//        }
//
//    })
//
//;