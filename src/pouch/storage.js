(function (){
    if (!siesta) {
        throw new Error('Could not find siesta');
    }

    var ext = siesta.ext;
    var changes = require('./changes');
    ext.storage = {
        changes: changes,
        ChangeType: require('./../changeType').ChangeType,
        index: require('./index'),
        pouch: require('./pouch'),
        PouchQuery: require('./query').RawQuery,
        resetChanges: changes.resetChanges
    }
})();