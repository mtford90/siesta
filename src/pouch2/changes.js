(function () {
    // Dependencies within Siesta core.
    var _i = siesta._internal
        , defineSubProperty = _i.misc.defineSubProperty
        , RestError = _i.error.RestError
        , ChangeType = _i.ChangeType
        , util = _i.util
        , _ = util._
        , Operation = _i.Operation
        , OperationQueue = _i.OperationQueue
        , SiestaModel = _i.object.SiestaModel
        , extend = _i.extend
        , notificationCentre = _i.notificationCentre
        , log = _i.log
        , cache = _i.cache;

    // Browserify dependencies
    var pouch = require('./../pouch/index');

    var Logger = log.loggerWithName('changes');
    Logger.setLevel(log.Level.warn);



})();

