var notificationCentre = require('./notificationCentre').notificationCentre;
var log = require('../vendor/operations.js/src/log');
var Logger = log.loggerWithName('changes');
var ext = require('./ext');

Logger.setLevel(log.Level.warn);

function broadcast(collection, mapping, c) {
    if (Logger.trace.isEnabled) Logger.trace('Sending notification "' + collection + '"');
    notificationCentre.emit(collection, c);
    var mappingNotif = collection + ':' + mapping;
    if (Logger.trace.isEnabled) Logger.trace('Sending notification "' + mappingNotif + '"');
    notificationCentre.emit(mappingNotif, c);
    var genericNotif = 'Siesta';
    if (Logger.trace.isEnabled) Logger.trace('Sending notification "' + genericNotif + '"');
    notificationCentre.emit(genericNotif, c);
}
/**
 * Register that a change has been made.
 * @param opts
 */
function registerChange(opts) {
    if (ext.storageEnabled) {
        ext.storage.registerChange(opts);
    }
    var collection = opts.collection;
    var mapping = opts.mapping;
    broadcast(collection, mapping, c);
}

exports.registerChange = registerChange;
