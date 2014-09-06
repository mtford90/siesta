var log = require('../vendor/operations.js/src/log');
var Logger = log.loggerWithName('Serialiser');
Logger.setLevel(log.Level.warn);



function idSerialiser (obj) {
    var idField = obj.mapping.id;
    if (idField) {
        return obj[idField] ? obj[idField] : null;
    }
    else {
        Logger.debug('No idfield');
        return undefined;
    }
}

function depthSerialiser(depth, obj, done) {
    Logger.trace('depthSerialiser');
    var data = {};
    _.each(obj._fields, function (f) {
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
        Logger.trace('relationshipField', f);
        var proxy = obj[f + 'Proxy'];
        if (proxy.isForward) { // By default only forward relationship.
            Logger.debug(f);
            waiting.push(f);
            proxy.get(function (err, v) {
                Logger.trace('proxy.get',f);
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

