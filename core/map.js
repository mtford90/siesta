/**
 * Concerned with mapping data onto the object graph
 * @module map
 */

var util = require('./util');

/**
 * Map data onto objects in the model
 * @param opts
 * @param opts.model - The model to which we will be mapping data
 * @param {Object[]} opts.data - An array of data objects to map
 * @param {ModelInstance[]} [opts.objects] - Optional array of objects to map each datum, skipping object lookups.
 * @param {Function} [cb] - callback
 */
function map(opts, cb) {
    _mapAttributes(opts);

}

function _mapAttributes(opts) {
    var model = opts.model,
        data = opts.data,
        objects = opts.objects,
        disableNotifications = opts.disableNotifications;
    for (var i = 0; i < data.length; i++) {
        var datum = data[i];
        var object = objects[i];
        // No point mapping object onto itself. This happens if a ModelInstance is passed as a relationship.
        if (datum != object) {
            if (object) { // If object is falsy, then there was an error looking up that object/creating it.
                var fields = model._attributeNames;
                _.each(fields, function (f) {
                    if (datum[f] !== undefined) { // null is fine
                        // If notifications are disabled we update __values object directly. This avoids triggering
                        // notifications which are built into the set function of the property.
                        if (disableNotifications) {
                            object.__values[f] = datum[f];
                        }
                        else {
                            object[f] = datum[f];
                        }
                    }
                });
                // PouchDB revision (if using storage module).
                // TODO: Can this be pulled out of core?
                if (datum._rev) object._rev = datum._rev;
            }
        }
    }

}

function constructSubMaps(opts) {

}