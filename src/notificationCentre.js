var EventEmitter = require('events').EventEmitter;
var notificationCentre = new EventEmitter();
var ArrayObserver = require('../vendor/observe-js/src/observe').ArrayObserver;
var ChangeType = require('./ChangeType').ChangeType;
var log = require('../vendor/operations.js/src/log');
var changes = require('./changes');

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
                splices.forEach(function (splice) {
                    changes.registerChange({
                        collection: siestaModel.collection,
                        mapping: siestaModel.mapping.type,
                        _id: siestaModel._id,
                        index: splice.index,
                        removed: splice.removed,
                        added: splice.addedCount ? array.slice(splice.index, splice.index+splice.addedCount) : [],
                        type: ChangeType.Splice,
                        field: field
                    });
                });
            }
        });
        array.isFault = false;
    }
}

exports.notificationCentre = notificationCentre;
exports.wrapArray = wrapArray;
exports.broadcast = broadcast;
