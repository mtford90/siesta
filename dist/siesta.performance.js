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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly8vd2VicGFjay9ib290c3RyYXAgZDkzYzM0ZWQ2NTE1NzZiZjZmOWMiLCJ3ZWJwYWNrOi8vLy4vcGVyZm9ybWFuY2UvaW5kZXguanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBLHVCQUFlO0FBQ2Y7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7OztBQUdBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7Ozs7Ozs7QUN0Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTs7O0FBR0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQUs7QUFDTDtBQUNBO0FBQ0E7QUFDQSxJQUFHO0FBQ0g7OztBQUdBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsUUFBTztBQUNQLE1BQUs7QUFDTDtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxRQUFPO0FBQ1AsTUFBSztBQUNMO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsUUFBTztBQUNQLE1BQUs7QUFDTDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFLO0FBQ0w7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBSztBQUNMOztBQUVBOztBQUVBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImQ5M2MzNGVkNjUxNTc2YmY2ZjljLmpzIiwic291cmNlc0NvbnRlbnQiOlsiIFx0Ly8gVGhlIG1vZHVsZSBjYWNoZVxuIFx0dmFyIGluc3RhbGxlZE1vZHVsZXMgPSB7fTtcblxuIFx0Ly8gVGhlIHJlcXVpcmUgZnVuY3Rpb25cbiBcdGZ1bmN0aW9uIF9fd2VicGFja19yZXF1aXJlX18obW9kdWxlSWQpIHtcblxuIFx0XHQvLyBDaGVjayBpZiBtb2R1bGUgaXMgaW4gY2FjaGVcbiBcdFx0aWYoaW5zdGFsbGVkTW9kdWxlc1ttb2R1bGVJZF0pXG4gXHRcdFx0cmV0dXJuIGluc3RhbGxlZE1vZHVsZXNbbW9kdWxlSWRdLmV4cG9ydHM7XG5cbiBcdFx0Ly8gQ3JlYXRlIGEgbmV3IG1vZHVsZSAoYW5kIHB1dCBpdCBpbnRvIHRoZSBjYWNoZSlcbiBcdFx0dmFyIG1vZHVsZSA9IGluc3RhbGxlZE1vZHVsZXNbbW9kdWxlSWRdID0ge1xuIFx0XHRcdGV4cG9ydHM6IHt9LFxuIFx0XHRcdGlkOiBtb2R1bGVJZCxcbiBcdFx0XHRsb2FkZWQ6IGZhbHNlXG4gXHRcdH07XG5cbiBcdFx0Ly8gRXhlY3V0ZSB0aGUgbW9kdWxlIGZ1bmN0aW9uXG4gXHRcdG1vZHVsZXNbbW9kdWxlSWRdLmNhbGwobW9kdWxlLmV4cG9ydHMsIG1vZHVsZSwgbW9kdWxlLmV4cG9ydHMsIF9fd2VicGFja19yZXF1aXJlX18pO1xuXG4gXHRcdC8vIEZsYWcgdGhlIG1vZHVsZSBhcyBsb2FkZWRcbiBcdFx0bW9kdWxlLmxvYWRlZCA9IHRydWU7XG5cbiBcdFx0Ly8gUmV0dXJuIHRoZSBleHBvcnRzIG9mIHRoZSBtb2R1bGVcbiBcdFx0cmV0dXJuIG1vZHVsZS5leHBvcnRzO1xuIFx0fVxuXG5cbiBcdC8vIGV4cG9zZSB0aGUgbW9kdWxlcyBvYmplY3QgKF9fd2VicGFja19tb2R1bGVzX18pXG4gXHRfX3dlYnBhY2tfcmVxdWlyZV9fLm0gPSBtb2R1bGVzO1xuXG4gXHQvLyBleHBvc2UgdGhlIG1vZHVsZSBjYWNoZVxuIFx0X193ZWJwYWNrX3JlcXVpcmVfXy5jID0gaW5zdGFsbGVkTW9kdWxlcztcblxuIFx0Ly8gX193ZWJwYWNrX3B1YmxpY19wYXRoX19cbiBcdF9fd2VicGFja19yZXF1aXJlX18ucCA9IFwiXCI7XG5cbiBcdC8vIExvYWQgZW50cnkgbW9kdWxlIGFuZCByZXR1cm4gZXhwb3J0c1xuIFx0cmV0dXJuIF9fd2VicGFja19yZXF1aXJlX18oMCk7XG5cblxuXG4vKiogV0VCUEFDSyBGT09URVIgKipcbiAqKiB3ZWJwYWNrL2Jvb3RzdHJhcCBkOTNjMzRlZDY1MTU3NmJmNmY5Y1xuICoqLyIsIi8qKlxuICogQW4gZXh0ZW5zaW9uIGZvciBlbmFibGluZyBwZXJmb3JtYW5jZSBtb25pdG9yaW5nIG9mIFNpZXN0YS5cbiAqIEN1cnJlbnQgZmVhdHVyZXM6XG4gKiAgLSBUaW1lIG1hcHBpbmcgb3BlcmF0aW9ucy5cbiAqICAtIFRpbWUgbWFwcy5cbiAqL1xuXG5pZiAodHlwZW9mIHNpZXN0YSA9PSAndW5kZWZpbmVkJyAmJiB0eXBlb2YgbW9kdWxlID09ICd1bmRlZmluZWQnKSB7XG4gIHRocm93IG5ldyBFcnJvcignQ291bGQgbm90IGZpbmQgd2luZG93LnNpZXN0YS4gTWFrZSBzdXJlIHlvdSBpbmNsdWRlIHNpZXN0YS5jb3JlLmpzIGZpcnN0LicpO1xufVxuXG52YXIgdXRpbCA9IHNpZXN0YS5faW50ZXJuYWwudXRpbDtcblxuXG5pZiAoIXNpZXN0YS5leHQpIHNpZXN0YS5leHQgPSB7fTtcblxuLy8gVE9ETzogUGxhY2UgdGhpcyBpbiBTaWVzdGEgY29yZSBhbmQgdXNlIGl0IGZvciBhbGwgb3RoZXIgZXh0ZW5zaW9ucy5cbmZ1bmN0aW9uIGluc3RhbGxFeHRlbnNpb24obmFtZSwgZXh0KSB7XG4gIHNpZXN0YS5leHRbbmFtZV0gPSBleHQ7XG4gIHZhciBwdWJsaWNQcm9wID0gbmFtZSArICdFbmFibGVkJyxcbiAgICBwcml2YXRlUHJvcCA9ICdfJyArIHB1YmxpY1Byb3A7XG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShzaWVzdGEuZXh0LCBwdWJsaWNQcm9wLCB7XG4gICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgIGlmIChzaWVzdGEuZXh0W3ByaXZhdGVQcm9wXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHJldHVybiBzaWVzdGEuZXh0W3ByaXZhdGVQcm9wXTtcbiAgICAgIH1cbiAgICAgIHJldHVybiAhIXNpZXN0YS5leHRbbmFtZV07XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgc2llc3RhLmV4dFtwcml2YXRlUHJvcF0gPSB2O1xuICAgIH1cbiAgfSlcbn1cblxuXG52YXIgcGVyZm9ybWFuY2UgPSB7fTtcbmluc3RhbGxFeHRlbnNpb24oJ3BlcmZvcm1hbmNlJywgcGVyZm9ybWFuY2UpO1xuXG5mdW5jdGlvbiB0aW1lTWFwcygpIHtcbiAgdmFyIE1vZGVsID0gc2llc3RhLl9pbnRlcm5hbC5Nb2RlbCxcbiAgICBvbGRHcmFwaCA9IE1vZGVsLnByb3RvdHlwZS5ncmFwaDtcbiAgTW9kZWwucHJvdG90eXBlLmdyYXBoID0gZnVuY3Rpb24oZGF0YSwgb3B0cywgY2IpIHtcbiAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbihjYikge1xuICAgICAgdmFyIHN0YXJ0ID0gKG5ldyBEYXRlKS5nZXRUaW1lKCksXG4gICAgICAgIG51bURhdHVtcyA9IHV0aWwuaXNBcnJheShkYXRhKSA/IGRhdGEubGVuZ3RoIDogMTtcbiAgICAgIG9sZEdyYXBoLmNhbGwodGhpcywgZGF0YSwgb3B0cywgZnVuY3Rpb24oZXJyLCByZXMpIHtcbiAgICAgICAgdmFyIGVuZCA9IChuZXcgRGF0ZSkuZ2V0VGltZSgpLFxuICAgICAgICAgIHRpbWVUYWtlbiA9IGVuZCAtIHN0YXJ0O1xuICAgICAgICBjb25zb2xlLmluZm8oJ1tQZXJmb3JtYW5jZTogbW9kZWwucHJvdG90eXBlLmdyYXBoXSBJdCB0b29rICcgKyB0aW1lVGFrZW4gKyAnbXMgdG8gZ3JhcGggJyArIG51bURhdHVtcyArICcgZGF0dW1zIHRvIFwiJyArIHRoaXMubmFtZSArICdcIicpO1xuICAgICAgICBjYihlcnIsIHJlcyk7XG4gICAgICB9LmJpbmQodGhpcykpO1xuICAgIH0uYmluZCh0aGlzKSk7XG4gIH07XG59XG5cbmZ1bmN0aW9uIHRpbWVRdWVyaWVzKCkge1xuICB2YXIgTW9kZWwgPSBzaWVzdGEuX2ludGVybmFsLk1vZGVsLFxuICAgIG9sZFF1ZXJ5ID0gTW9kZWwucHJvdG90eXBlLnF1ZXJ5O1xuICBNb2RlbC5wcm90b3R5cGUucXVlcnkgPSBmdW5jdGlvbihxdWVyeSwgY2IpIHtcbiAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbihjYikge1xuICAgICAgdmFyIHN0YXJ0ID0gKG5ldyBEYXRlKS5nZXRUaW1lKCk7XG4gICAgICBvbGRRdWVyeS5jYWxsKHRoaXMsIHF1ZXJ5LCBmdW5jdGlvbihlcnIsIHJlcykge1xuICAgICAgICB2YXIgZW5kID0gKG5ldyBEYXRlKS5nZXRUaW1lKCksXG4gICAgICAgICAgdGltZVRha2VuID0gZW5kIC0gc3RhcnQ7XG4gICAgICAgIGNvbnNvbGUuaW5mbygnW1BlcmZvcm1hbmNlOiBNb2RlbC5wcm90b3R5cGUucXVlcnldIEl0IHRvb2sgJyArIHRpbWVUYWtlbiArICdtcyB0byBxdWVyeScpO1xuICAgICAgICBjYihlcnIsIHJlcyk7XG4gICAgICB9KTtcbiAgICB9LmJpbmQodGhpcykpO1xuICB9O1xufVxuXG5mdW5jdGlvbiB0aW1lU3RvcmFnZSgpIHtcbiAgdmFyIG9sZExvYWQgPSBzaWVzdGEuYXBwLnN0b3JhZ2UuX2xvYWQ7XG4gIHNpZXN0YS5hcHAuc3RvcmFnZS5fbG9hZCA9IGZ1bmN0aW9uKGNiKSB7XG4gICAgcmV0dXJuIHV0aWwucHJvbWlzZShjYiwgZnVuY3Rpb24oY2IpIHtcbiAgICAgIHZhciBzdGFydCA9IChuZXcgRGF0ZSkuZ2V0VGltZSgpO1xuICAgICAgb2xkTG9hZChmdW5jdGlvbihlcnIsIG4pIHtcbiAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICB2YXIgZW5kID0gKG5ldyBEYXRlKS5nZXRUaW1lKCksXG4gICAgICAgICAgICB0aW1lVGFrZW4gPSBlbmQgLSBzdGFydDtcbiAgICAgICAgICBjb25zb2xlLmluZm8oJ1tQZXJmb3JtYW5jZTogU3RvcmFnZS5sb2FkXSBJdCB0b29rICcgKyB0aW1lVGFrZW4gKyAnbXMgdG8gbG9hZCAnICsgbi50b1N0cmluZygpICsgJyBpbnN0YW5jZXMgZnJvbSBzdG9yYWdlLicpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIGxvYWRpbmcgd2hlbiBtZWFzdXJpbmcgcGVyZm9ybWFuY2Ugb2Ygc3RvcmFnZScsIGVycik7XG4gICAgICAgIH1cbiAgICAgICAgY2IoZXJyKTtcbiAgICAgIH0pO1xuICAgIH0uYmluZCh0aGlzKSk7XG4gIH07XG4gIHZhciBvbGRHcmFwaERhdGEgPSBzaWVzdGEuYXBwLnN0b3JhZ2UuX2dyYXBoRGF0YTtcbiAgc2llc3RhLmFwcC5zdG9yYWdlLl9ncmFwaERhdGEgPSBmdW5jdGlvbihkYXRhLCBNb2RlbCwgY2FsbGJhY2spIHtcbiAgICB2YXIgc3RhcnQgPSAobmV3IERhdGUpLmdldFRpbWUoKTtcbiAgICBvbGRHcmFwaERhdGEoZGF0YSwgTW9kZWwsIGZ1bmN0aW9uKGVyciwgaW5zdGFuY2VzKSB7XG4gICAgICBpZiAoIWVycikge1xuICAgICAgICB2YXIgZW5kID0gKG5ldyBEYXRlKS5nZXRUaW1lKCksXG4gICAgICAgICAgdGltZVRha2VuID0gZW5kIC0gc3RhcnQ7XG4gICAgICAgIHZhciBuID0gaW5zdGFuY2VzLmxlbmd0aDtcbiAgICAgICAgY29uc29sZS5pbmZvKCdbUGVyZm9ybWFuY2U6IFN0b3JhZ2UuZ3JhcGhdIEl0IHRvb2sgJyArIHRpbWVUYWtlbiArICdtcyB0byBncmFwaCAnICsgbi50b1N0cmluZygpICsgJyAnICsgTW9kZWwubmFtZSArICAnIGluc3RhbmNlcy4nKTtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdFcnJvciBsb2FkaW5nIHdoZW4gbWVhc3VyaW5nIHBlcmZvcm1hbmNlIG9mIHN0b3JhZ2UgZ3JhcGhpbmcnLCBlcnIpO1xuICAgICAgfVxuICAgICAgY2FsbGJhY2soZXJyLCBpbnN0YW5jZXMpXG4gICAgfSk7XG4gIH07XG4gIHZhciBvbGRHZXREYXRhRnJvbVBvdWNoID0gc2llc3RhLmFwcC5zdG9yYWdlLl9nZXREYXRhRnJvbVBvdWNoO1xuICBzaWVzdGEuYXBwLnN0b3JhZ2UuX2dldERhdGFGcm9tUG91Y2ggPSBmdW5jdGlvbihjb2xsY2V0aW9uTmFtZSwgbW9kZWxOYW1lLCBjYWxsYmFjaykge1xuICAgIHZhciBzdGFydCA9IChuZXcgRGF0ZSkuZ2V0VGltZSgpO1xuICAgIG9sZEdldERhdGFGcm9tUG91Y2goY29sbGNldGlvbk5hbWUsIG1vZGVsTmFtZSwgZnVuY3Rpb24oZXJyLCBkYXRhKSB7XG4gICAgICBpZiAoIWVycikge1xuICAgICAgICB2YXIgZW5kID0gKG5ldyBEYXRlKS5nZXRUaW1lKCksXG4gICAgICAgICAgdGltZVRha2VuID0gZW5kIC0gc3RhcnQ7XG4gICAgICAgIHZhciBuID0gZGF0YS5sZW5ndGg7XG4gICAgICAgIGNvbnNvbGUuaW5mbygnW1BlcmZvcm1hbmNlOiBTdG9yYWdlLmdyYXBoXSBJdCB0b29rICcgKyB0aW1lVGFrZW4gKyAnbXMgdG8gcHVsbCAnICsgbi50b1N0cmluZygpICsgJyAnICsgbW9kZWxOYW1lICsgJyBkYXR1bXMgZnJvbSBQb3VjaERCJyk7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignRXJyb3IgbG9hZGluZyB3aGVuIG1lYXN1cmluZyBwZXJmb3JtYW5jZSBvZiBzdG9yYWdlIGdyYXBoaW5nJywgZXJyKTtcbiAgICAgIH1cbiAgICAgIGNhbGxiYWNrKGVyciwgZGF0YSlcbiAgICB9KTtcbiAgfTtcblxufVxuXG4vL3RpbWVNYXBzKCk7XG4vL3RpbWVRdWVyaWVzKCk7XG50aW1lU3RvcmFnZSgpO1xubW9kdWxlLmV4cG9ydHMgPSBwZXJmb3JtYW5jZTtcblxuXG5cbi8qKioqKioqKioqKioqKioqKlxuICoqIFdFQlBBQ0sgRk9PVEVSXG4gKiogLi9wZXJmb3JtYW5jZS9pbmRleC5qc1xuICoqIG1vZHVsZSBpZCA9IDBcbiAqKiBtb2R1bGUgY2h1bmtzID0gMFxuICoqLyJdLCJzb3VyY2VSb290IjoiIn0=