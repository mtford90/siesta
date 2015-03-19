(function () {

  if (typeof siesta == 'undefined' && typeof module == 'undefined') {
    throw new Error('Could not find window.siesta. Make sure you include siesta.core.js first.');
  }

  var util = siesta._internal.util,
      Collection = siesta._internal.Collection;


  // TODO: Place this in Siesta core and use it for all other extensions.
  function installExtension(name, ext) {
    if (!siesta.ext) siesta.ext = {};
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
      set: function (v) {
        siesta.ext[privateProp] = v;
      }
    })
  }

  var sync = {};
  installExtension('sync', sync);




  module.exports = sync;
})();