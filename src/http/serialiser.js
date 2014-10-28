/**
 * @module http
 */

var _i = siesta._internal;

var log = _i.log
    , utils = _i.util;
var Logger = log.loggerWithName('Serialiser');
Logger.setLevel(log.Level.warn);
var _ = utils._;

/**
 * Serialises an object into it's remote identifier (as defined by the mapping)
 * @param  {SiestaModel} obj
 * @return {String}
 * 
 */
function idSerialiser(obj) {
    var idField = obj.mapping.id;
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
 * @param  {SiestaModel}   obj
 * @param  {Function} done 
 */
function depthSerialiser(depth, obj, done) {
    if (Logger.trace.isEnabled)
        Logger.trace('depthSerialiser');
    var data = {};
    _.each(obj._fields, function (f) {
        if (Logger.trace.isEnabled)
            Logger.trace('field', f);
        if (obj[f]) {
            data[f] = obj[f];
        }
    });
    var waiting = [];
    var errors = [];
    var result = {};
    var finished = [];
    _.each(obj._relationshipFields, function (f) {
        if (Logger.trace.isEnabled)
            Logger.trace('relationshipField', f);
        var proxy = obj[f + 'Proxy'];
        if (proxy.isForward) { // By default only forward relationship.
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
                        data[f] = v[obj[f + 'Proxy'].forwardMapping.id];
                        result[f] = {err: err, v: v};
                        if ((waiting.length == finished.length) && done) {
                            done(errors.length ? errors : null, data, result);
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
                            if ((waiting.length == finished.length) && done) {
                                done(errors.length ? errors : null, data, result);
                            }
                        });
                    }
                }
                else {
                    if (Logger.debug.isEnabled)
                        Logger.debug('no value for ' + f);
                    finished.push(f);
                    result[f] = {err: err, v: v};
                    if ((waiting.length == finished.length) && done) {
                        done(errors.length ? errors : null, data, result);
                    }
                }
            });
        }
    });
    if (!waiting.length) {
        if (done) done(null, data, {});
    }
}


exports.depthSerialiser = function (depth) {
    return  _.partial(depthSerialiser, depth);
};
exports.depthSerializer = function (depth) {
    return  _.partial(depthSerialiser, depth);
};
exports.idSerializer = idSerialiser;
exports.idSerialiser = idSerialiser;

