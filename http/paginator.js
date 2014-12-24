var _i = siesta._internal,
    log = _i.log,
    InternalSiestaError = _i.error.InternalSiestaError,
    util = _i.util,
    _ = util._;

var Logger = log.loggerWithName('Paginator');
Logger.setLevel(log.Level.warn);

function Paginator() {

}

module.exports = Paginator;