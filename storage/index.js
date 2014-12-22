if (typeof siesta == 'undefined' && typeof module == 'undefined') {
    throw new Error('Could not find window.siesta. Make sure you include siesta.core.js first.');
}

if (typeof PouchDB == 'undefined') {
    throw new Error('Could not find PouchDB. Have you included the script?');
}

var unsavedObjects = [],
    unsavedObjectsHash = {},
    _i = siesta._internal,
    pouch = new PouchDB('siesta');

/**
 * Serialise a model down to PouchDB.
 * @param {SiestaModel} model
 */
function _serialise(model) {
    var serialised = siesta.extend({}, model.__values);
    serialised['collection'] = model.collection;
    serialised['model'] = model.type;
    serialised['_id'] = model._id;
    var rev = model._rev;
    if (rev) serialised['_rev'] = rev;
    serialised = _.reduce(model._relationshipNames, function (memo, n) {
        var val = model[n];
        if (siesta.isArray(val)) {
            memo[n] = _.pluck(val, '_id');
        }
        else if (val) {
            memo[n] = val._id;
        }
        return memo;
    }, serialised);
    return serialised;
}

/**
 * Load all data from PouchDB.
 */
function _load(collectionName) {

}

/**
 * Save all changes down to PouchDB.
 */
function save() {

}

siesta.on('Siesta', function (n) {
    console.log('storage module received change');
    var changedObject = n.obj,
        ident = changedObject._id;
    if (!changedObject) {
        throw new _i.error.InternalSiestaError('No obj field in notification received by storage extension');
    }
    if (ident in unsavedObjectsHash) {
        unsavedObjectsHash[ident] = changedObject;
        unsavedObjects.push(changedObject);
    }
});

var storage = {
    _load: _load,
    save: save,
    _serialise: _serialise
};

Object.defineProperty(storage, '_unsavedObjects', {
    get: function () {return unsavedObjects}
});

Object.defineProperty(storage, '_pouch', {
    get: function () {return pouch}
});

if (typeof siesta != 'undefined') {
    if (!siesta.ext) {
        siesta.ext = {};
    }
    siesta.ext.storage = storage;
}

if (typeof module != 'undefined') {
    module.exports = storage;
}