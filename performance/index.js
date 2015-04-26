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
  var oldLoad = siesta.ext.storage._load;
  siesta.ext.storage._load = function(cb) {
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
  var oldGraphData = siesta.ext.storage._graphData;
  siesta.ext.storage._graphData = function(data, Model, callback) {
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
  var oldGetDataFromPouch = siesta.ext.storage._getDataFromPouch;
  siesta.ext.storage._getDataFromPouch = function(collcetionName, modelName, callback) {
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
