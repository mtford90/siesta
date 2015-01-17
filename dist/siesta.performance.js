(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
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
        oldMap = Model.prototype.map;
    Model.prototype.map = function (data, opts, callback) {
        var start = (new Date).getTime(),
            numDatums = util.isArray(data) ? data.length : 1,
            deferred = util.defer(callback);
        oldMap.call(this, data, opts, function (err, res) {
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

//timeMaps();
timeQueries();
module.exports = performance;
},{}]},{},[1])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9wZXJmb3JtYW5jZS9pbmRleC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8qKlxuICogQW4gZXh0ZW5zaW9uIGZvciBlbmFibGluZyBwZXJmb3JtYW5jZSBtb25pdG9yaW5nIG9mIFNpZXN0YS5cbiAqIEN1cnJlbnQgZmVhdHVyZXM6XG4gKiAgLSBUaW1lIG1hcHBpbmcgb3BlcmF0aW9ucy5cbiAqICAtIFRpbWUgbWFwcy5cbiAqL1xuXG5cbmlmICh0eXBlb2Ygc2llc3RhID09ICd1bmRlZmluZWQnICYmIHR5cGVvZiBtb2R1bGUgPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0NvdWxkIG5vdCBmaW5kIHdpbmRvdy5zaWVzdGEuIE1ha2Ugc3VyZSB5b3UgaW5jbHVkZSBzaWVzdGEuY29yZS5qcyBmaXJzdC4nKTtcbn1cblxudmFyIHV0aWwgPSBzaWVzdGEuX2ludGVybmFsLnV0aWw7XG5cbmlmICghc2llc3RhLmV4dCkgc2llc3RhLmV4dCA9IHt9O1xuXG4vLyBUT0RPOiBQbGFjZSB0aGlzIGluIFNpZXN0YSBjb3JlIGFuZCB1c2UgaXQgZm9yIGFsbCBvdGhlciBleHRlbnNpb25zLlxuZnVuY3Rpb24gaW5zdGFsbEV4dGVuc2lvbihuYW1lLCBleHQpIHtcbiAgICBzaWVzdGEuZXh0W25hbWVdID0gZXh0O1xuICAgIHZhciBwdWJsaWNQcm9wID0gbmFtZSArICdFbmFibGVkJyxcbiAgICAgICAgcHJpdmF0ZVByb3AgPSAnXycgKyBwdWJsaWNQcm9wO1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShzaWVzdGEuZXh0LCBwdWJsaWNQcm9wLCB7XG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgaWYgKHNpZXN0YS5leHRbcHJpdmF0ZVByb3BdICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gc2llc3RhLmV4dFtwcml2YXRlUHJvcF07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gISFzaWVzdGEuZXh0W25hbWVdO1xuICAgICAgICB9LFxuICAgICAgICBzZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHNpZXN0YS5leHRbcHJpdmF0ZVByb3BdID0gdjtcbiAgICAgICAgfVxuICAgIH0pXG59XG5cblxudmFyIHBlcmZvcm1hbmNlID0ge307XG5pbnN0YWxsRXh0ZW5zaW9uKCdwZXJmb3JtYW5jZScsIHBlcmZvcm1hbmNlKTtcblxuZnVuY3Rpb24gdGltZU1hcHMoKSB7XG4gICAgdmFyIE1vZGVsID0gc2llc3RhLl9pbnRlcm5hbC5Nb2RlbCxcbiAgICAgICAgb2xkTWFwID0gTW9kZWwucHJvdG90eXBlLm1hcDtcbiAgICBNb2RlbC5wcm90b3R5cGUubWFwID0gZnVuY3Rpb24gKGRhdGEsIG9wdHMsIGNhbGxiYWNrKSB7XG4gICAgICAgIHZhciBzdGFydCA9IChuZXcgRGF0ZSkuZ2V0VGltZSgpLFxuICAgICAgICAgICAgbnVtRGF0dW1zID0gdXRpbC5pc0FycmF5KGRhdGEpID8gZGF0YS5sZW5ndGggOiAxLFxuICAgICAgICAgICAgZGVmZXJyZWQgPSB1dGlsLmRlZmVyKGNhbGxiYWNrKTtcbiAgICAgICAgb2xkTWFwLmNhbGwodGhpcywgZGF0YSwgb3B0cywgZnVuY3Rpb24gKGVyciwgcmVzKSB7XG4gICAgICAgICAgICB2YXIgZW5kID0gKG5ldyBEYXRlKS5nZXRUaW1lKCksXG4gICAgICAgICAgICAgICAgdGltZVRha2VuID0gZW5kIC0gc3RhcnQ7XG4gICAgICAgICAgICBjb25zb2xlLmluZm8oJ1tQZXJmb3JtYW5jZTogbW9kZWwucHJvdG90eXBlLm1hcF0gSXQgdG9vayAnICsgdGltZVRha2VuICsgJ21zIHRvIG1hcCAnICsgbnVtRGF0dW1zICsgJyBkYXR1bXMgdG8gXCInICsgdGhpcy5uYW1lICsgJ1wiJyk7XG4gICAgICAgICAgICBkZWZlcnJlZC5maW5pc2goZXJyLCByZXMpO1xuICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbiAgICB9O1xufVxuXG5mdW5jdGlvbiB0aW1lUXVlcmllcygpIHtcbiAgICB2YXIgTW9kZWwgPSBzaWVzdGEuX2ludGVybmFsLk1vZGVsLFxuICAgICAgICBvbGRRdWVyeSA9IE1vZGVsLnByb3RvdHlwZS5xdWVyeTtcbiAgICBNb2RlbC5wcm90b3R5cGUucXVlcnkgPSBmdW5jdGlvbiAocXVlcnksIGNhbGxiYWNrKSB7XG4gICAgICAgIHZhciBkZWZlcnJlZCA9IHV0aWwuZGVmZXIoY2FsbGJhY2spO1xuICAgICAgICBjYWxsYmFjayA9IGRlZmVycmVkLmZpbmlzaC5iaW5kKGRlZmVycmVkKTtcbiAgICAgICAgdmFyIHN0YXJ0ID0gKG5ldyBEYXRlKS5nZXRUaW1lKCk7XG4gICAgICAgIG9sZFF1ZXJ5LmNhbGwodGhpcywgcXVlcnksIGZ1bmN0aW9uIChlcnIsIHJlcykge1xuICAgICAgICAgICAgdmFyIGVuZCA9IChuZXcgRGF0ZSkuZ2V0VGltZSgpLFxuICAgICAgICAgICAgICAgIHRpbWVUYWtlbiA9IGVuZCAtIHN0YXJ0O1xuICAgICAgICAgICAgY29uc29sZS5pbmZvKCdbUGVyZm9ybWFuY2U6IE1vZGVsLnByb3RvdHlwZS5xdWVyeV0gSXQgdG9vayAnICsgdGltZVRha2VuICsgJ21zIHRvIHF1ZXJ5Jyk7XG4gICAgICAgICAgICBjYWxsYmFjayhlcnIsIHJlcyk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xuICAgIH07XG59XG5cbi8vdGltZU1hcHMoKTtcbnRpbWVRdWVyaWVzKCk7XG5tb2R1bGUuZXhwb3J0cyA9IHBlcmZvcm1hbmNlOyJdfQ==
