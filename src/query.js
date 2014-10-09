var log = require('../vendor/operations.js/src/log');
var Logger = log.loggerWithName('Query');
Logger.setLevel(log.Level.warn);


//var RawQuery = require('./pouch/query').RawQuery;




function Query(mapping, query) {
    this.mapping = mapping;
    this.query = query;
}



exports.Query = Query;


