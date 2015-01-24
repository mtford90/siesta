/**
 * An extension for enabling performance monitoring of Siesta.
 * Current features:
 *  - Time mapping operations.
 *  - Time maps.
 */


if (typeof siesta == 'undefined' && typeof module == 'undefined') {
    throw new Error('Could not find window.siesta. Make sure you include siesta.core.js first.');
}

var util = siesta._internal.util;

if (!siesta.ext) siesta.ext = {};

// TODO: Place this in Siesta core and use it for all other extensions.
function installExtension(name, ext) {
    siesta.ext[name] = ext;
    var publicProp = name + 'Enabled',
        privateProp = '_' + publicProp;
    Object.defineProperty(siesta.ext, publicProp, {
        get: function () {
            if (siesta.ext[privateProp] !== undefined) {
                return siesta.ext[privateProp];
            }
            return !!siesta.ext[name];
        },
        set: function () {
            siesta.ext[privateProp] = v;
        }
    })
}


var performance = {};
installExtension('performance', performance);

function timeMaps() {
    var Model = siesta._internal.Model,
        oldGraph = Model.prototype.graph;
    Model.prototype.graph = function (data, opts, callback) {
        var start = (new Date).getTime(),
            numDatums = util.isArray(data) ? data.length : 1,
            deferred = util.defer(callback);
        oldGraph.call(this, data, opts, function (err, res) {
            var end = (new Date).getTime(),
                timeTaken = end - start;
            console.info('[Performance: model.prototype.map] It took ' + timeTaken + 'ms to map ' + numDatums + ' datums to "' + this.name + '"');
            deferred.finish(err, res);
        }.bind(this));
        return deferred.promise;
    };
}

function timeQueries() {
    var Model = siesta._internal.Model,
        oldQuery = Model.prototype.query;
    Model.prototype.query = function (query, callback) {
        var deferred = util.defer(callback);
        callback = deferred.finish.bind(deferred);
        var start = (new Date).getTime();
        oldQuery.call(this, query, function (err, res) {
            var end = (new Date).getTime(),
                timeTaken = end - start;
            console.info('[Performance: Model.prototype.query] It took ' + timeTaken + 'ms to query');
            callback(err, res);
        });

        return deferred.promise;
    };
}

function timeStorage() {
    var oldLoad = siesta.ext.storage._load;
    siesta.ext.storage._load = function (callback) {
        var deferred = util.defer(callback);
        callback = deferred.finish.bind(deferred);
        var start = (new Date).getTime();
        oldLoad(function (err) {
            if (!err) {
                var end = (new Date).getTime(),
                    timeTaken = end - start;
                console.info('[Performance: Storage._load] It took ' + timeTaken + 'ms to load everything from storage.');
            }
            else {
                console.error('Error loading when measuring performance of storage', err);
            }
            callback(err);
        });
        return deferred.promise;
    }
}
//timeMaps();
//timeQueries();
timeStorage();
module.exports = performance;