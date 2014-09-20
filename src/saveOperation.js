var log = require('../vendor/operations.js/src/log');
var Logger = log.loggerWithName('SaveOperation');
Logger.setLevel(log.Level.warn);

var Operation = require('../vendor/operations.js/src/operation').Operation;

var pouch = require('./pouch');
var cache = require('./cache');
var store = require('./store');

var RestError = require('./error').RestError;

var Platform = require('../vendor/observe-js/src/observe').Platform;

var PerformanceMonitor = require('./performance').PerformanceMonitor;


var utils = require('./util');

var _ = utils._;


