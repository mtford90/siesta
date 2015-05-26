/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId])
/******/ 			return installedModules[moduleId].exports;
/******/
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			exports: {},
/******/ 			id: moduleId,
/******/ 			loaded: false
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.loaded = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(0);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ function(module, exports, __webpack_require__) {

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
	        console.info('[Performance: model.prototype.graph] It took ' + timeTaken + 'ms to graph ' + numDatums + ' datums to "' + this.name + '"');
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
	  var oldLoad = siesta.app.storage._load;
	  siesta.app.storage._load = function(cb) {
	    return util.promise(cb, function(cb) {
	      var start = (new Date).getTime();
	      oldLoad(function(err, n) {
	        if (!err) {
	          var end = (new Date).getTime(),
	            timeTaken = end - start;
	          console.info('[Performance: Storage.load] It took ' + timeTaken + 'ms to load ' + n.toString() + ' instances from storage.');
	        }
	        else {
	          console.error('Error loading when measuring performance of storage', err);
	        }
	        cb(err);
	      });
	    }.bind(this));
	  };
	  var oldGraphData = siesta.app.storage._graphData;
	  siesta.app.storage._graphData = function(data, Model, callback) {
	    var start = (new Date).getTime();
	    oldGraphData(data, Model, function(err, instances) {
	      if (!err) {
	        var end = (new Date).getTime(),
	          timeTaken = end - start;
	        var n = instances.length;
	        console.info('[Performance: Storage.graph] It took ' + timeTaken + 'ms to graph ' + n.toString() + ' ' + Model.name +  ' instances.');
	      }
	      else {
	        console.error('Error loading when measuring performance of storage graphing', err);
	      }
	      callback(err, instances)
	    });
	  };
	  var oldGetDataFromPouch = siesta.app.storage._getDataFromPouch;
	  siesta.app.storage._getDataFromPouch = function(collcetionName, modelName, callback) {
	    var start = (new Date).getTime();
	    oldGetDataFromPouch(collcetionName, modelName, function(err, data) {
	      if (!err) {
	        var end = (new Date).getTime(),
	          timeTaken = end - start;
	        var n = data.length;
	        console.info('[Performance: Storage.graph] It took ' + timeTaken + 'ms to pull ' + n.toString() + ' ' + modelName + ' datums from PouchDB');
	      }
	      else {
	        console.error('Error loading when measuring performance of storage graphing', err);
	      }
	      callback(err, data)
	    });
	  };
	
	}
	
	//timeMaps();
	//timeQueries();
	timeStorage();
	module.exports = performance;


/***/ }
/******/ ]);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly8vd2VicGFjay9ib290c3RyYXAgZTczYmM3ZWViMjA5OTY1YjNlMjMiLCJ3ZWJwYWNrOi8vLy4vcGVyZm9ybWFuY2UvaW5kZXguanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBLHVCQUFlO0FBQ2Y7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7OztBQUdBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0Esd0M7Ozs7Ozs7QUN0Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTs7O0FBR0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQUs7QUFDTDtBQUNBO0FBQ0E7QUFDQSxJQUFHO0FBQ0g7OztBQUdBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsUUFBTztBQUNQLE1BQUs7QUFDTDtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxRQUFPO0FBQ1AsTUFBSztBQUNMO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsUUFBTztBQUNQLE1BQUs7QUFDTDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFLO0FBQ0w7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBSztBQUNMOztBQUVBOztBQUVBO0FBQ0E7QUFDQTtBQUNBIiwic291cmNlc0NvbnRlbnQiOlsiIFx0Ly8gVGhlIG1vZHVsZSBjYWNoZVxuIFx0dmFyIGluc3RhbGxlZE1vZHVsZXMgPSB7fTtcblxuIFx0Ly8gVGhlIHJlcXVpcmUgZnVuY3Rpb25cbiBcdGZ1bmN0aW9uIF9fd2VicGFja19yZXF1aXJlX18obW9kdWxlSWQpIHtcblxuIFx0XHQvLyBDaGVjayBpZiBtb2R1bGUgaXMgaW4gY2FjaGVcbiBcdFx0aWYoaW5zdGFsbGVkTW9kdWxlc1ttb2R1bGVJZF0pXG4gXHRcdFx0cmV0dXJuIGluc3RhbGxlZE1vZHVsZXNbbW9kdWxlSWRdLmV4cG9ydHM7XG5cbiBcdFx0Ly8gQ3JlYXRlIGEgbmV3IG1vZHVsZSAoYW5kIHB1dCBpdCBpbnRvIHRoZSBjYWNoZSlcbiBcdFx0dmFyIG1vZHVsZSA9IGluc3RhbGxlZE1vZHVsZXNbbW9kdWxlSWRdID0ge1xuIFx0XHRcdGV4cG9ydHM6IHt9LFxuIFx0XHRcdGlkOiBtb2R1bGVJZCxcbiBcdFx0XHRsb2FkZWQ6IGZhbHNlXG4gXHRcdH07XG5cbiBcdFx0Ly8gRXhlY3V0ZSB0aGUgbW9kdWxlIGZ1bmN0aW9uXG4gXHRcdG1vZHVsZXNbbW9kdWxlSWRdLmNhbGwobW9kdWxlLmV4cG9ydHMsIG1vZHVsZSwgbW9kdWxlLmV4cG9ydHMsIF9fd2VicGFja19yZXF1aXJlX18pO1xuXG4gXHRcdC8vIEZsYWcgdGhlIG1vZHVsZSBhcyBsb2FkZWRcbiBcdFx0bW9kdWxlLmxvYWRlZCA9IHRydWU7XG5cbiBcdFx0Ly8gUmV0dXJuIHRoZSBleHBvcnRzIG9mIHRoZSBtb2R1bGVcbiBcdFx0cmV0dXJuIG1vZHVsZS5leHBvcnRzO1xuIFx0fVxuXG5cbiBcdC8vIGV4cG9zZSB0aGUgbW9kdWxlcyBvYmplY3QgKF9fd2VicGFja19tb2R1bGVzX18pXG4gXHRfX3dlYnBhY2tfcmVxdWlyZV9fLm0gPSBtb2R1bGVzO1xuXG4gXHQvLyBleHBvc2UgdGhlIG1vZHVsZSBjYWNoZVxuIFx0X193ZWJwYWNrX3JlcXVpcmVfXy5jID0gaW5zdGFsbGVkTW9kdWxlcztcblxuIFx0Ly8gX193ZWJwYWNrX3B1YmxpY19wYXRoX19cbiBcdF9fd2VicGFja19yZXF1aXJlX18ucCA9IFwiXCI7XG5cbiBcdC8vIExvYWQgZW50cnkgbW9kdWxlIGFuZCByZXR1cm4gZXhwb3J0c1xuIFx0cmV0dXJuIF9fd2VicGFja19yZXF1aXJlX18oMCk7XG5cblxuLyoqIFdFQlBBQ0sgRk9PVEVSICoqXG4gKiogd2VicGFjay9ib290c3RyYXAgZTczYmM3ZWViMjA5OTY1YjNlMjNcbiAqKi8iLCIvKipcbiAqIEFuIGV4dGVuc2lvbiBmb3IgZW5hYmxpbmcgcGVyZm9ybWFuY2UgbW9uaXRvcmluZyBvZiBTaWVzdGEuXG4gKiBDdXJyZW50IGZlYXR1cmVzOlxuICogIC0gVGltZSBtYXBwaW5nIG9wZXJhdGlvbnMuXG4gKiAgLSBUaW1lIG1hcHMuXG4gKi9cblxuaWYgKHR5cGVvZiBzaWVzdGEgPT0gJ3VuZGVmaW5lZCcgJiYgdHlwZW9mIG1vZHVsZSA9PSAndW5kZWZpbmVkJykge1xuICB0aHJvdyBuZXcgRXJyb3IoJ0NvdWxkIG5vdCBmaW5kIHdpbmRvdy5zaWVzdGEuIE1ha2Ugc3VyZSB5b3UgaW5jbHVkZSBzaWVzdGEuY29yZS5qcyBmaXJzdC4nKTtcbn1cblxudmFyIHV0aWwgPSBzaWVzdGEuX2ludGVybmFsLnV0aWw7XG5cblxuaWYgKCFzaWVzdGEuZXh0KSBzaWVzdGEuZXh0ID0ge307XG5cbi8vIFRPRE86IFBsYWNlIHRoaXMgaW4gU2llc3RhIGNvcmUgYW5kIHVzZSBpdCBmb3IgYWxsIG90aGVyIGV4dGVuc2lvbnMuXG5mdW5jdGlvbiBpbnN0YWxsRXh0ZW5zaW9uKG5hbWUsIGV4dCkge1xuICBzaWVzdGEuZXh0W25hbWVdID0gZXh0O1xuICB2YXIgcHVibGljUHJvcCA9IG5hbWUgKyAnRW5hYmxlZCcsXG4gICAgcHJpdmF0ZVByb3AgPSAnXycgKyBwdWJsaWNQcm9wO1xuICBPYmplY3QuZGVmaW5lUHJvcGVydHkoc2llc3RhLmV4dCwgcHVibGljUHJvcCwge1xuICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICBpZiAoc2llc3RhLmV4dFtwcml2YXRlUHJvcF0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICByZXR1cm4gc2llc3RhLmV4dFtwcml2YXRlUHJvcF07XG4gICAgICB9XG4gICAgICByZXR1cm4gISFzaWVzdGEuZXh0W25hbWVdO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbigpIHtcbiAgICAgIHNpZXN0YS5leHRbcHJpdmF0ZVByb3BdID0gdjtcbiAgICB9XG4gIH0pXG59XG5cblxudmFyIHBlcmZvcm1hbmNlID0ge307XG5pbnN0YWxsRXh0ZW5zaW9uKCdwZXJmb3JtYW5jZScsIHBlcmZvcm1hbmNlKTtcblxuZnVuY3Rpb24gdGltZU1hcHMoKSB7XG4gIHZhciBNb2RlbCA9IHNpZXN0YS5faW50ZXJuYWwuTW9kZWwsXG4gICAgb2xkR3JhcGggPSBNb2RlbC5wcm90b3R5cGUuZ3JhcGg7XG4gIE1vZGVsLnByb3RvdHlwZS5ncmFwaCA9IGZ1bmN0aW9uKGRhdGEsIG9wdHMsIGNiKSB7XG4gICAgcmV0dXJuIHV0aWwucHJvbWlzZShjYiwgZnVuY3Rpb24oY2IpIHtcbiAgICAgIHZhciBzdGFydCA9IChuZXcgRGF0ZSkuZ2V0VGltZSgpLFxuICAgICAgICBudW1EYXR1bXMgPSB1dGlsLmlzQXJyYXkoZGF0YSkgPyBkYXRhLmxlbmd0aCA6IDE7XG4gICAgICBvbGRHcmFwaC5jYWxsKHRoaXMsIGRhdGEsIG9wdHMsIGZ1bmN0aW9uKGVyciwgcmVzKSB7XG4gICAgICAgIHZhciBlbmQgPSAobmV3IERhdGUpLmdldFRpbWUoKSxcbiAgICAgICAgICB0aW1lVGFrZW4gPSBlbmQgLSBzdGFydDtcbiAgICAgICAgY29uc29sZS5pbmZvKCdbUGVyZm9ybWFuY2U6IG1vZGVsLnByb3RvdHlwZS5ncmFwaF0gSXQgdG9vayAnICsgdGltZVRha2VuICsgJ21zIHRvIGdyYXBoICcgKyBudW1EYXR1bXMgKyAnIGRhdHVtcyB0byBcIicgKyB0aGlzLm5hbWUgKyAnXCInKTtcbiAgICAgICAgY2IoZXJyLCByZXMpO1xuICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICB9LmJpbmQodGhpcykpO1xuICB9O1xufVxuXG5mdW5jdGlvbiB0aW1lUXVlcmllcygpIHtcbiAgdmFyIE1vZGVsID0gc2llc3RhLl9pbnRlcm5hbC5Nb2RlbCxcbiAgICBvbGRRdWVyeSA9IE1vZGVsLnByb3RvdHlwZS5xdWVyeTtcbiAgTW9kZWwucHJvdG90eXBlLnF1ZXJ5ID0gZnVuY3Rpb24ocXVlcnksIGNiKSB7XG4gICAgcmV0dXJuIHV0aWwucHJvbWlzZShjYiwgZnVuY3Rpb24oY2IpIHtcbiAgICAgIHZhciBzdGFydCA9IChuZXcgRGF0ZSkuZ2V0VGltZSgpO1xuICAgICAgb2xkUXVlcnkuY2FsbCh0aGlzLCBxdWVyeSwgZnVuY3Rpb24oZXJyLCByZXMpIHtcbiAgICAgICAgdmFyIGVuZCA9IChuZXcgRGF0ZSkuZ2V0VGltZSgpLFxuICAgICAgICAgIHRpbWVUYWtlbiA9IGVuZCAtIHN0YXJ0O1xuICAgICAgICBjb25zb2xlLmluZm8oJ1tQZXJmb3JtYW5jZTogTW9kZWwucHJvdG90eXBlLnF1ZXJ5XSBJdCB0b29rICcgKyB0aW1lVGFrZW4gKyAnbXMgdG8gcXVlcnknKTtcbiAgICAgICAgY2IoZXJyLCByZXMpO1xuICAgICAgfSk7XG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gdGltZVN0b3JhZ2UoKSB7XG4gIHZhciBvbGRMb2FkID0gc2llc3RhLmFwcC5zdG9yYWdlLl9sb2FkO1xuICBzaWVzdGEuYXBwLnN0b3JhZ2UuX2xvYWQgPSBmdW5jdGlvbihjYikge1xuICAgIHJldHVybiB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uKGNiKSB7XG4gICAgICB2YXIgc3RhcnQgPSAobmV3IERhdGUpLmdldFRpbWUoKTtcbiAgICAgIG9sZExvYWQoZnVuY3Rpb24oZXJyLCBuKSB7XG4gICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgdmFyIGVuZCA9IChuZXcgRGF0ZSkuZ2V0VGltZSgpLFxuICAgICAgICAgICAgdGltZVRha2VuID0gZW5kIC0gc3RhcnQ7XG4gICAgICAgICAgY29uc29sZS5pbmZvKCdbUGVyZm9ybWFuY2U6IFN0b3JhZ2UubG9hZF0gSXQgdG9vayAnICsgdGltZVRha2VuICsgJ21zIHRvIGxvYWQgJyArIG4udG9TdHJpbmcoKSArICcgaW5zdGFuY2VzIGZyb20gc3RvcmFnZS4nKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICBjb25zb2xlLmVycm9yKCdFcnJvciBsb2FkaW5nIHdoZW4gbWVhc3VyaW5nIHBlcmZvcm1hbmNlIG9mIHN0b3JhZ2UnLCBlcnIpO1xuICAgICAgICB9XG4gICAgICAgIGNiKGVycik7XG4gICAgICB9KTtcbiAgICB9LmJpbmQodGhpcykpO1xuICB9O1xuICB2YXIgb2xkR3JhcGhEYXRhID0gc2llc3RhLmFwcC5zdG9yYWdlLl9ncmFwaERhdGE7XG4gIHNpZXN0YS5hcHAuc3RvcmFnZS5fZ3JhcGhEYXRhID0gZnVuY3Rpb24oZGF0YSwgTW9kZWwsIGNhbGxiYWNrKSB7XG4gICAgdmFyIHN0YXJ0ID0gKG5ldyBEYXRlKS5nZXRUaW1lKCk7XG4gICAgb2xkR3JhcGhEYXRhKGRhdGEsIE1vZGVsLCBmdW5jdGlvbihlcnIsIGluc3RhbmNlcykge1xuICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgdmFyIGVuZCA9IChuZXcgRGF0ZSkuZ2V0VGltZSgpLFxuICAgICAgICAgIHRpbWVUYWtlbiA9IGVuZCAtIHN0YXJ0O1xuICAgICAgICB2YXIgbiA9IGluc3RhbmNlcy5sZW5ndGg7XG4gICAgICAgIGNvbnNvbGUuaW5mbygnW1BlcmZvcm1hbmNlOiBTdG9yYWdlLmdyYXBoXSBJdCB0b29rICcgKyB0aW1lVGFrZW4gKyAnbXMgdG8gZ3JhcGggJyArIG4udG9TdHJpbmcoKSArICcgJyArIE1vZGVsLm5hbWUgKyAgJyBpbnN0YW5jZXMuJyk7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignRXJyb3IgbG9hZGluZyB3aGVuIG1lYXN1cmluZyBwZXJmb3JtYW5jZSBvZiBzdG9yYWdlIGdyYXBoaW5nJywgZXJyKTtcbiAgICAgIH1cbiAgICAgIGNhbGxiYWNrKGVyciwgaW5zdGFuY2VzKVxuICAgIH0pO1xuICB9O1xuICB2YXIgb2xkR2V0RGF0YUZyb21Qb3VjaCA9IHNpZXN0YS5hcHAuc3RvcmFnZS5fZ2V0RGF0YUZyb21Qb3VjaDtcbiAgc2llc3RhLmFwcC5zdG9yYWdlLl9nZXREYXRhRnJvbVBvdWNoID0gZnVuY3Rpb24oY29sbGNldGlvbk5hbWUsIG1vZGVsTmFtZSwgY2FsbGJhY2spIHtcbiAgICB2YXIgc3RhcnQgPSAobmV3IERhdGUpLmdldFRpbWUoKTtcbiAgICBvbGRHZXREYXRhRnJvbVBvdWNoKGNvbGxjZXRpb25OYW1lLCBtb2RlbE5hbWUsIGZ1bmN0aW9uKGVyciwgZGF0YSkge1xuICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgdmFyIGVuZCA9IChuZXcgRGF0ZSkuZ2V0VGltZSgpLFxuICAgICAgICAgIHRpbWVUYWtlbiA9IGVuZCAtIHN0YXJ0O1xuICAgICAgICB2YXIgbiA9IGRhdGEubGVuZ3RoO1xuICAgICAgICBjb25zb2xlLmluZm8oJ1tQZXJmb3JtYW5jZTogU3RvcmFnZS5ncmFwaF0gSXQgdG9vayAnICsgdGltZVRha2VuICsgJ21zIHRvIHB1bGwgJyArIG4udG9TdHJpbmcoKSArICcgJyArIG1vZGVsTmFtZSArICcgZGF0dW1zIGZyb20gUG91Y2hEQicpO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIGxvYWRpbmcgd2hlbiBtZWFzdXJpbmcgcGVyZm9ybWFuY2Ugb2Ygc3RvcmFnZSBncmFwaGluZycsIGVycik7XG4gICAgICB9XG4gICAgICBjYWxsYmFjayhlcnIsIGRhdGEpXG4gICAgfSk7XG4gIH07XG5cbn1cblxuLy90aW1lTWFwcygpO1xuLy90aW1lUXVlcmllcygpO1xudGltZVN0b3JhZ2UoKTtcbm1vZHVsZS5leHBvcnRzID0gcGVyZm9ybWFuY2U7XG5cblxuXG4vKioqKioqKioqKioqKioqKipcbiAqKiBXRUJQQUNLIEZPT1RFUlxuICoqIC4vcGVyZm9ybWFuY2UvaW5kZXguanNcbiAqKiBtb2R1bGUgaWQgPSAwXG4gKiogbW9kdWxlIGNodW5rcyA9IDBcbiAqKi8iXSwic291cmNlUm9vdCI6IiIsImZpbGUiOiJlNzNiYzdlZWIyMDk5NjViM2UyMy5qcyJ9