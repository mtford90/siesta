var EventEmitter = require('events').EventEmitter;
var notificationCentre = new EventEmitter();
notificationCentre.setMaxListeners(100);
var ArrayObserver = require('../vendor/observe-js/src/observe').ArrayObserver;
var coreChanges = require('./changes');
var ChangeType = coreChanges.ChangeType;
var log = require('./operation/log');

/**
* Wraps the methods of a javascript array object so that notifications are sent
* on calls.
*
* @param array the array we have wrapping
* @param field name of the field
* @param restObject the object to which this array is a property
*/
function wrapArray(array, field, siestaModel) {
    if (!array.observer) {
        array.observer = new ArrayObserver(array);
        array.observer.open(function (splices) {
            var fieldIsAttribute = siestaModel._attributeNames.indexOf(field) > -1;
            if (fieldIsAttribute) {
                splices.forEach(function (splice) {
                    coreChanges.registerChange({
                        collection: siestaModel.collection,
                        model: siestaModel.model.name,
                        _id: siestaModel._id,
                        index: splice.index,
                        removed: splice.removed,
                        added: splice.addedCount ? array.slice(splice.index, splice.index+splice.addedCount) : [],
                        type: coreChanges.ChangeType.Splice,
                        field: field,
                        obj: siestaModel
                    });
                });
            }
        });
        array.isFault = false;
    }
}

exports.notificationCentre = notificationCentre;
exports.wrapArray = wrapArray;