//var s = require('../index')
//    , assert = require('chai').assert;
//
//describe('pdb changes', function () {
//    it('xyz', function (done) {
//        var pouch = new PouchDB('zya', {adapter: 'memory'});
//        var changeEmitter = pouch.changes({
//            since: 'now',
//            live: true,
//            returnDocs: false
//        });
//        var doc = {_id: 'myid', xyz: 1};
//        pouch.put(doc, function (err, resp) {
//            if (err) done(err);
//            doc._rev = resp.rev;
//            doc.xyz = 2;
//            changeEmitter.on('change', function (e) {
//                dump(e);
//                done();
//            });
//            pouch.put(doc, function (err, resp) {
//
//            });
//        });
//    });
//});