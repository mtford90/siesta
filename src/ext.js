// Toggled depending on what optional modules are installed.

module.exports = {
    performanceMonitoringEnabled: false,
    httpEnabled: false
};

Object.defineProperty(exports, 'storageEnabled', {
    get: function () {
        return !!exports.storage;
    }
});