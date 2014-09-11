var log = require('../vendor/operations.js/src/log');
var Logger = log.loggerWithName('Query');
Logger.setLevel(log.Level.warn);


var Pouch = require('./pouch');
var RawQuery = require('./rawQuery').RawQuery;




function Query(mapping, query) {
    this.mapping = mapping;
    this.query = query;
}

Query.prototype._rawQuery = function () {
    return new RawQuery(this.mapping.collection, this.mapping.type, this.query);
};

Query.prototype.execute = function (callback) {
    var rawQuery = this._rawQuery();
    rawQuery.execute(function (err, results) {
        if (err) {
            callback(err);
        }
        else {
            if (Logger.debug.isEnabled)
                Logger.debug('got results', results);
            if (callback) callback(null, Pouch.toSiesta(results));
        }
    });
};

Query.prototype._dump = function (asJson) {
    return this._rawQuery()._dump(asJson);
};


exports.Query = Query;


