/**
 * @module http
 */

var _internal = siesta._internal;

var log = _internal.log,
    utils = _internal.util;
var Logger = log.loggerWithName('Serialisation');
var _ = utils._;


/**
 * Serialises an object into it's remote identifier (as defined by the mapping)
 * @param  {ModelInstance} obj
 * @return {String}
 *
 */
function idSerialiser(obj) {
    var idField = obj.model.id;
    if (idField) {
        return obj[idField] ? obj[idField] : null;
    }
    else {
        if (Logger.debug.isEnabled)
            Logger.debug('No idfield');
        return undefined;
    }
}

/**
 * Serialises obj following relationships to specified depth.
 * @param  {Integer}   depth
 * @param  {ModelInstance}   obj
 * @param  {Function} callback
 */
function depthSerialiser(depth, obj, callback) {
    callback = callback || function () {};
    if (Logger.trace.isEnabled)
        Logger.trace('depthSerialiser');
    var data = {};
    _.each(obj._attributeNames, function (f) {
        if (Logger.trace.isEnabled)
            Logger.trace('field', f);
        if (obj[f]) {
            data[f] = obj[f];
        }
    });
    var waiting = [],
        errors = [],
        result = {},
        finished = [];
    _.each(obj._relationshipNames, function (f) {
        if (Logger.trace.isEnabled)
            Logger.trace('relationshipField', f);
        var proxy = obj.__proxies[f];
        if (proxy.isForward) { // By default only forward relationships
            if (Logger.debug.isEnabled)
                Logger.debug(f);
            waiting.push(f);
            proxy.get(function (err, v) {
                if (Logger.trace.isEnabled)
                    Logger.trace('proxy.get', f);
                if (Logger.debug.isEnabled)
                    Logger.debug(f, v);
                if (err) {
                    errors.push(err);
                    finished.push(f);
                    result[f] = {err: err, v: v};
                }
                else if (v) {
                    if (!depth) {
                        finished.push(f);
                        data[f] = v[obj.__proxies[f].forwardModel.id];
                        result[f] = {err: err, v: v};
                        if ((waiting.length == finished.length) && callback) {
                            callback(errors.length ? errors : null, data, result);
                        }
                    }
                    else {
                        depthSerialiser(depth - 1, v, function (err, subData, resp) {
                            if (err) {
                                errors.push(err);
                            }
                            else {
                                data[f] = subData;
                            }
                            finished.push(f);
                            result[f] = {err: err, v: v, resp: resp};
                            if ((waiting.length == finished.length) && callback) {
                                callback(errors.length ? errors : null, data, result);
                            }
                        });
                    }
                }
                else {
                    if (Logger.debug.isEnabled)
                        Logger.debug('no value for ' + f);
                    finished.push(f);
                    result[f] = {err: err, v: v};
                    if ((waiting.length == finished.length) && callback) {
                        callback(errors.length ? errors : null, data, result);
                    }
                }
            });
        }
    });
    if (!waiting.length) {
        callback(null, data, {});
    }
}


exports.depthSerialiser = function (depth) {
    return _.partial(depthSerialiser, depth);
};
exports.depthSerializer = function (depth) {
    return _.partial(depthSerialiser, depth);
};
exports.idSerializer = idSerialiser;
exports.idSerialiser = idSerialiser;

