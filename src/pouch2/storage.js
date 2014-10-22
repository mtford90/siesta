(function () {
    var pouch = require('./pouch');
    var changes = require('./changes');
    var index = require('./index');
    var query = require('./query');
    if (!siesta.ext) siesta.ext = {};
    siesta.ext.storage = {
        pouch: pouch,
        changes: changes,
        index: index,
        query: query
    };
})();
