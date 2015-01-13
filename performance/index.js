if (typeof siesta == 'undefined' && typeof module == 'undefined') {
    throw new Error('Could not find window.siesta. Make sure you include siesta.core.js first.');
}

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



module.exports = performance;