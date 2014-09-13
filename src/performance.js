var log = require('../vendor/operations.js/src/log');
var Logger = log.loggerWithName('Performance');
Logger.setLevel(log.Level.warn);

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

exports.PerformanceMonitor = PerformanceMonitor;