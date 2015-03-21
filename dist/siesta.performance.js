(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/**
 * An extension for enabling performance monitoring of Siesta.
 * Current features:
 *  - Time mapping operations.
 *  - Time maps.
 */


(function() {

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
      get: function() {
        if (siesta.ext[privateProp] !== undefined) {
          return siesta.ext[privateProp];
        }
        return !!siesta.ext[name];
      },
      set: function() {
        siesta.ext[privateProp] = v;
      }
    })
  }


  var performance = {};
  installExtension('performance', performance);

  function timeMaps() {
    var Model = siesta._internal.Model,
        oldGraph = Model.prototype.graph;
    Model.prototype.graph = function(data, opts, cb) {
      return util.promise(cb, function(cb) {
        var start = (new Date).getTime(),
            numDatums = util.isArray(data) ? data.length : 1;
        oldGraph.call(this, data, opts, function(err, res) {
          var end = (new Date).getTime(),
              timeTaken = end - start;
          console.info('[Performance: model.prototype.map] It took ' + timeTaken + 'ms to map ' + numDatums + ' datums to "' + this.name + '"');
          cb(err, res);
        }.bind(this));
      }.bind(this));
    };
  }

  function timeQueries() {
    var Model = siesta._internal.Model,
        oldQuery = Model.prototype.query;
    Model.prototype.query = function(query, cb) {
      return util.promise(cb, function(cb) {
        var start = (new Date).getTime();
        oldQuery.call(this, query, function(err, res) {
          var end = (new Date).getTime(),
              timeTaken = end - start;
          console.info('[Performance: Model.prototype.query] It took ' + timeTaken + 'ms to query');
          cb(err, res);
        });
      }.bind(this));
    };
  }

  function timeStorage() {
    var oldLoad = siesta.ext.storage._load;
    siesta.ext.storage._load = function(cb) {
      return util.promise(cb, function(cb) {
        var start = (new Date).getTime();
        oldLoad(function(err, n) {
          if (!err) {
            var end = (new Date).getTime(),
                timeTaken = end - start;
            console.info('[Performance: Storage._load] It took ' + timeTaken + 'ms to load ' + n.toString() + ' instances from storage.');
          }
          else {
            console.error('Error loading when measuring performance of storage', err);
          }
          cb(err);
        });
      }.bind(this));
    };
    var oldLoadModel = siesta.ext.storage._loadModel;
    siesta.ext.storage._loadModel = function(opts, cb) {
      var start = (new Date).getTime();
      return util.promise(cb, function(cb) {
        oldLoadModel(opts, function(err, instances) {
          var collectionName = opts.collectionName,
              modelName = opts.modelName,
              fullyQualifiedName = collectionName + '.' + modelName,
              end = (new Date).getTime(),
              timeTaken = end - start;
          if (!err) {
            console.info('[Performance: Storage._loadModel] It took ' + timeTaken + 'ms to load ' + instances.length.toString() + ' instances of "' + fullyQualifiedName + '"');
          }
          else {
            console.error('Error loading when measuring performance of storage', err);
          }
          cb(err, instances);
        });
      }.bind(this));
    };
  }

  //timeMaps();
  //timeQueries();
  timeStorage();
  module.exports = performance;
})();
},{}]},{},[1])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9wZXJmb3JtYW5jZS9pbmRleC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8qKlxuICogQW4gZXh0ZW5zaW9uIGZvciBlbmFibGluZyBwZXJmb3JtYW5jZSBtb25pdG9yaW5nIG9mIFNpZXN0YS5cbiAqIEN1cnJlbnQgZmVhdHVyZXM6XG4gKiAgLSBUaW1lIG1hcHBpbmcgb3BlcmF0aW9ucy5cbiAqICAtIFRpbWUgbWFwcy5cbiAqL1xuXG5cbihmdW5jdGlvbigpIHtcblxuICBpZiAodHlwZW9mIHNpZXN0YSA9PSAndW5kZWZpbmVkJyAmJiB0eXBlb2YgbW9kdWxlID09ICd1bmRlZmluZWQnKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdDb3VsZCBub3QgZmluZCB3aW5kb3cuc2llc3RhLiBNYWtlIHN1cmUgeW91IGluY2x1ZGUgc2llc3RhLmNvcmUuanMgZmlyc3QuJyk7XG4gIH1cblxuICB2YXIgdXRpbCA9IHNpZXN0YS5faW50ZXJuYWwudXRpbDtcblxuICBpZiAoIXNpZXN0YS5leHQpIHNpZXN0YS5leHQgPSB7fTtcblxuICAvLyBUT0RPOiBQbGFjZSB0aGlzIGluIFNpZXN0YSBjb3JlIGFuZCB1c2UgaXQgZm9yIGFsbCBvdGhlciBleHRlbnNpb25zLlxuICBmdW5jdGlvbiBpbnN0YWxsRXh0ZW5zaW9uKG5hbWUsIGV4dCkge1xuICAgIHNpZXN0YS5leHRbbmFtZV0gPSBleHQ7XG4gICAgdmFyIHB1YmxpY1Byb3AgPSBuYW1lICsgJ0VuYWJsZWQnLFxuICAgICAgICBwcml2YXRlUHJvcCA9ICdfJyArIHB1YmxpY1Byb3A7XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHNpZXN0YS5leHQsIHB1YmxpY1Byb3AsIHtcbiAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgIGlmIChzaWVzdGEuZXh0W3ByaXZhdGVQcm9wXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgcmV0dXJuIHNpZXN0YS5leHRbcHJpdmF0ZVByb3BdO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiAhIXNpZXN0YS5leHRbbmFtZV07XG4gICAgICB9LFxuICAgICAgc2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgc2llc3RhLmV4dFtwcml2YXRlUHJvcF0gPSB2O1xuICAgICAgfVxuICAgIH0pXG4gIH1cblxuXG4gIHZhciBwZXJmb3JtYW5jZSA9IHt9O1xuICBpbnN0YWxsRXh0ZW5zaW9uKCdwZXJmb3JtYW5jZScsIHBlcmZvcm1hbmNlKTtcblxuICBmdW5jdGlvbiB0aW1lTWFwcygpIHtcbiAgICB2YXIgTW9kZWwgPSBzaWVzdGEuX2ludGVybmFsLk1vZGVsLFxuICAgICAgICBvbGRHcmFwaCA9IE1vZGVsLnByb3RvdHlwZS5ncmFwaDtcbiAgICBNb2RlbC5wcm90b3R5cGUuZ3JhcGggPSBmdW5jdGlvbihkYXRhLCBvcHRzLCBjYikge1xuICAgICAgcmV0dXJuIHV0aWwucHJvbWlzZShjYiwgZnVuY3Rpb24oY2IpIHtcbiAgICAgICAgdmFyIHN0YXJ0ID0gKG5ldyBEYXRlKS5nZXRUaW1lKCksXG4gICAgICAgICAgICBudW1EYXR1bXMgPSB1dGlsLmlzQXJyYXkoZGF0YSkgPyBkYXRhLmxlbmd0aCA6IDE7XG4gICAgICAgIG9sZEdyYXBoLmNhbGwodGhpcywgZGF0YSwgb3B0cywgZnVuY3Rpb24oZXJyLCByZXMpIHtcbiAgICAgICAgICB2YXIgZW5kID0gKG5ldyBEYXRlKS5nZXRUaW1lKCksXG4gICAgICAgICAgICAgIHRpbWVUYWtlbiA9IGVuZCAtIHN0YXJ0O1xuICAgICAgICAgIGNvbnNvbGUuaW5mbygnW1BlcmZvcm1hbmNlOiBtb2RlbC5wcm90b3R5cGUubWFwXSBJdCB0b29rICcgKyB0aW1lVGFrZW4gKyAnbXMgdG8gbWFwICcgKyBudW1EYXR1bXMgKyAnIGRhdHVtcyB0byBcIicgKyB0aGlzLm5hbWUgKyAnXCInKTtcbiAgICAgICAgICBjYihlcnIsIHJlcyk7XG4gICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICB9LmJpbmQodGhpcykpO1xuICAgIH07XG4gIH1cblxuICBmdW5jdGlvbiB0aW1lUXVlcmllcygpIHtcbiAgICB2YXIgTW9kZWwgPSBzaWVzdGEuX2ludGVybmFsLk1vZGVsLFxuICAgICAgICBvbGRRdWVyeSA9IE1vZGVsLnByb3RvdHlwZS5xdWVyeTtcbiAgICBNb2RlbC5wcm90b3R5cGUucXVlcnkgPSBmdW5jdGlvbihxdWVyeSwgY2IpIHtcbiAgICAgIHJldHVybiB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uKGNiKSB7XG4gICAgICAgIHZhciBzdGFydCA9IChuZXcgRGF0ZSkuZ2V0VGltZSgpO1xuICAgICAgICBvbGRRdWVyeS5jYWxsKHRoaXMsIHF1ZXJ5LCBmdW5jdGlvbihlcnIsIHJlcykge1xuICAgICAgICAgIHZhciBlbmQgPSAobmV3IERhdGUpLmdldFRpbWUoKSxcbiAgICAgICAgICAgICAgdGltZVRha2VuID0gZW5kIC0gc3RhcnQ7XG4gICAgICAgICAgY29uc29sZS5pbmZvKCdbUGVyZm9ybWFuY2U6IE1vZGVsLnByb3RvdHlwZS5xdWVyeV0gSXQgdG9vayAnICsgdGltZVRha2VuICsgJ21zIHRvIHF1ZXJ5Jyk7XG4gICAgICAgICAgY2IoZXJyLCByZXMpO1xuICAgICAgICB9KTtcbiAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgfTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHRpbWVTdG9yYWdlKCkge1xuICAgIHZhciBvbGRMb2FkID0gc2llc3RhLmV4dC5zdG9yYWdlLl9sb2FkO1xuICAgIHNpZXN0YS5leHQuc3RvcmFnZS5fbG9hZCA9IGZ1bmN0aW9uKGNiKSB7XG4gICAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbihjYikge1xuICAgICAgICB2YXIgc3RhcnQgPSAobmV3IERhdGUpLmdldFRpbWUoKTtcbiAgICAgICAgb2xkTG9hZChmdW5jdGlvbihlcnIsIG4pIHtcbiAgICAgICAgICBpZiAoIWVycikge1xuICAgICAgICAgICAgdmFyIGVuZCA9IChuZXcgRGF0ZSkuZ2V0VGltZSgpLFxuICAgICAgICAgICAgICAgIHRpbWVUYWtlbiA9IGVuZCAtIHN0YXJ0O1xuICAgICAgICAgICAgY29uc29sZS5pbmZvKCdbUGVyZm9ybWFuY2U6IFN0b3JhZ2UuX2xvYWRdIEl0IHRvb2sgJyArIHRpbWVUYWtlbiArICdtcyB0byBsb2FkICcgKyBuLnRvU3RyaW5nKCkgKyAnIGluc3RhbmNlcyBmcm9tIHN0b3JhZ2UuJyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignRXJyb3IgbG9hZGluZyB3aGVuIG1lYXN1cmluZyBwZXJmb3JtYW5jZSBvZiBzdG9yYWdlJywgZXJyKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgY2IoZXJyKTtcbiAgICAgICAgfSk7XG4gICAgICB9LmJpbmQodGhpcykpO1xuICAgIH07XG4gICAgdmFyIG9sZExvYWRNb2RlbCA9IHNpZXN0YS5leHQuc3RvcmFnZS5fbG9hZE1vZGVsO1xuICAgIHNpZXN0YS5leHQuc3RvcmFnZS5fbG9hZE1vZGVsID0gZnVuY3Rpb24ob3B0cywgY2IpIHtcbiAgICAgIHZhciBzdGFydCA9IChuZXcgRGF0ZSkuZ2V0VGltZSgpO1xuICAgICAgcmV0dXJuIHV0aWwucHJvbWlzZShjYiwgZnVuY3Rpb24oY2IpIHtcbiAgICAgICAgb2xkTG9hZE1vZGVsKG9wdHMsIGZ1bmN0aW9uKGVyciwgaW5zdGFuY2VzKSB7XG4gICAgICAgICAgdmFyIGNvbGxlY3Rpb25OYW1lID0gb3B0cy5jb2xsZWN0aW9uTmFtZSxcbiAgICAgICAgICAgICAgbW9kZWxOYW1lID0gb3B0cy5tb2RlbE5hbWUsXG4gICAgICAgICAgICAgIGZ1bGx5UXVhbGlmaWVkTmFtZSA9IGNvbGxlY3Rpb25OYW1lICsgJy4nICsgbW9kZWxOYW1lLFxuICAgICAgICAgICAgICBlbmQgPSAobmV3IERhdGUpLmdldFRpbWUoKSxcbiAgICAgICAgICAgICAgdGltZVRha2VuID0gZW5kIC0gc3RhcnQ7XG4gICAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuaW5mbygnW1BlcmZvcm1hbmNlOiBTdG9yYWdlLl9sb2FkTW9kZWxdIEl0IHRvb2sgJyArIHRpbWVUYWtlbiArICdtcyB0byBsb2FkICcgKyBpbnN0YW5jZXMubGVuZ3RoLnRvU3RyaW5nKCkgKyAnIGluc3RhbmNlcyBvZiBcIicgKyBmdWxseVF1YWxpZmllZE5hbWUgKyAnXCInKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdFcnJvciBsb2FkaW5nIHdoZW4gbWVhc3VyaW5nIHBlcmZvcm1hbmNlIG9mIHN0b3JhZ2UnLCBlcnIpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjYihlcnIsIGluc3RhbmNlcyk7XG4gICAgICAgIH0pO1xuICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICB9O1xuICB9XG5cbiAgLy90aW1lTWFwcygpO1xuICAvL3RpbWVRdWVyaWVzKCk7XG4gIHRpbWVTdG9yYWdlKCk7XG4gIG1vZHVsZS5leHBvcnRzID0gcGVyZm9ybWFuY2U7XG59KSgpOyJdfQ==
