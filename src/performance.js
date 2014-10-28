/**
 * @module performance
 */

(function () {
    if (!siesta) {
        throw new Error('Could not find siesta');
    }

    siesta.performanceMonitoringEnabled = true;

    var _i = siesta._internal;
    var log = _i.log
        , Mapping = _i.Mapping
        , util = _i.util
        , q = _i.q
    ;

    var Logger = log.loggerWithName('Performance');
    Logger.setLevel(log.Level.info);

    function PerformanceMonitor(name) {
        this.startTime = null;
        this.endTime = null;
        this.name = name;
    }

    PerformanceMonitor.prototype.start = function () {
        this.startTime = new Date();
    };

    PerformanceMonitor.prototype.end = function () {
        this.endTime = new Date();
        Logger.info(this.name + ' took ' + (this.endTime - this.startTime).toString() + 'ms');
    };

    var origMappingGet = Mapping.prototype.get;

    Mapping.prototype.get = function (idOrCallback, callback) {
        var deferred = q.defer();
        callback = util.constructCallbackAndPromiseHandler(callback, deferred);
        var m = new PerformanceMonitor('Mapping.get');
        var id;
        if (typeof idOrCallback == 'function') {
            callback = idOrCallback;
        }
        else {
            id = idOrCallback;
        }
        var c = function () {
            m.end();
            callback.apply(callback, arguments);
        };
        m.start();
        if (id) {
            origMappingGet.call(this, id, c);
        }
        else {
            origMappingGet.call(this, c);
        }
        return deferred.promise;
    };

    var origMappingMapBulk = Mapping.prototype._mapBulk;

    Mapping.prototype._mapBulk = function (data, callback, override) {
        var deferred = q.defer();
        callback = util.constructCallbackAndPromiseHandler(callback, deferred);
        var m = new PerformanceMonitor('_mapBulk');
        m.start();
        origMappingMapBulk.call(this, data, function () {
            m.end();
            callback.apply(callback, arguments);
        }, override);
        return deferred.promise;
    };

})();
