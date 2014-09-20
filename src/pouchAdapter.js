var util = require('./util');
var _ = util._;

var pouch = require('./pouch');




function toNewR(doc, callback) {
    var mapping = pouch._validate(doc);
    var obj = mapping._new();
    obj._id = doc._id;
    obj._rev = doc._rev;
    obj.isSaved = true;
    for (var prop in doc) {
        if (doc.hasOwnProperty(prop)) {
            if (obj._fields.indexOf(prop) > -1) {
                obj.__values[prop] = doc[prop];
            }
            else if (obj._relationshipFields.indexOf(prop) > -1) {
                obj[prop + 'Proxy']._id = doc[prop];
            }
        }
    }
    var tasks = [];
    for (var relationshipName in mapping.relationships) {
        if (mapping.relationships.hasOwnProperty(relationshipName)) {
            var proxy = obj[relationshipName + 'Proxy'];
            if (proxy.isReverse) {
                tasks.push(function (callback) {

                });
            }
        }
    }
    if (!tasks.length) {
        callback(null, obj);
    }
    else {

    }
}

exports.toNewR = toNewR;
