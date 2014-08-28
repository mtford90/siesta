angular.module('restkit.serialiser', ['restkit'])

    .factory('Serialiser', function (depthSerialiser, idSerialiser) {
        return {
            idSerialiser: idSerialiser,
            depthSerialiser: depthSerialiser,
            // Appease those across the pond
            idSerializer: idSerialiser,
            depthSerializer: function (depth) {
                return  _.partial(depthSerialiser, depth);
            }
        }
    })

    .factory('idSerialiser', function (jlog) {
        var $log = jlog.loggerWithName('idSerialiser');
        return function (obj) {
            var idField = obj.mapping.id;
            if (idField) {
                return obj[idField] ? obj[idField] : null;
            }
            else {
                $log.debug('No idfield');
                return undefined;
            }
        }
    })
    .factory('depthSerialiser', function (jlog) {
        var $log = jlog.loggerWithName('depthSerialiser');

        function depthSerialiser(depth, obj, done) {
            $log.trace('depthSerialiser');
            var data = {};
            _.each(obj._fields, function (f) {
                $log.trace('field', f);
                if (obj[f]) {
                    data[f] = obj[f];
                }
            });
            var waiting = [];
            var errors = [];
            var result = {};
            var finished = [];
            _.each(obj._relationshipFields, function (f) {
                $log.trace('relationshipField', f);
                var proxy = obj[f];
                if (proxy.relationship.isForward(obj)) { // By default only forward relationship.
                    $log.debug(f);
                    waiting.push(f);
                    proxy.get(function (err, v) {
                        $log.trace('proxy.get',f);
                        $log.debug(f, v);
                        if (err) {
                            errors.push(err);
                            finished.push(f);
                            result[f] = {err: err, v: v};
                        }
                        else if (v) {
                            if (!depth) {
                                finished.push(f);
                                data[f] = v[obj[f].relationship.mapping.id];
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
                            $log.debug('no value for ' + f);
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

        return depthSerialiser;
    })

    // Appease those across the pond +
    .factory('serializer', function (serialiser) {
        return serialiser;
    })

;