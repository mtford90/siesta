var EventEmitter = require('events').EventEmitter;
var notificationCentre = new EventEmitter();
var ArrayObserver = require('observe-js').ArrayObserver;
var ChangeType = require('./ChangeType').ChangeType;
var log = require('../vendor/operations.js/src/log');


function broadcast(obj, change) {
    var payload = {
        collection: obj.collection,
        type: obj.type,
        obj: obj,
        change: change
    };
    var mappingNotif = obj.collection + ':' + obj.type;
    notificationCentre.emit(mappingNotif, payload);
    var collectioNotif = obj.collection;
    notificationCentre.emit(collectioNotif, payload);
    var genericNotif = 'Siesta';
    notificationCentre.emit(genericNotif, payload);
}

///**
// * Wraps the methods of a javascript array object so that notifications are sent
// * on calls.
// *
// * @param array the array we have wrapping
// * @param field name of the field
// * @param restObject the object to which this array is a property
// */
//

function wrapArray(array, field, siestaModel) {
    if (!array.observer) {
        array.observer = new ArrayObserver(array);
        array.observer.open(function (splices) {
            var fieldIsAttribute = siestaModel._fields.indexOf(field) > -1;
            if (fieldIsAttribute) {
                siestaModel._markFieldAsDirty(field);
                splices.forEach(function (splice) {
                    broadcast(siestaModel, {
                        field: field,
                        type: ChangeType.Splice,
                        index: splice.index,
                        addedCount: splice.addedCount,
                        removed: splice.removed
                    });
                });
            }
            else {
                var proxy = siestaModel[field + 'Proxy'];
                if (proxy.isForward) {
                    siestaModel._markFieldAsDirty(field);
                }
            }
        })
    }

}

exports.notificationCentre = notificationCentre;
exports.wrapArray = wrapArray;
exports.broadcast = broadcast;
