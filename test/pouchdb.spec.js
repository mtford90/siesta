//var assert = require('chai').assert;
//
//describe.only('pouchdb behaviour', function () {
//    var db;
//    beforeEach(function (done) {
//        siesta.reset(function () {
//            db = siesta.ext.storage._pouch;
//            done();
//        })
//    });
//    it('get date', function (done) {
//        db.post({
//            date: new Date()
//        }).then(function (resp) {
//            db.get(resp.id).then(function (doc) {
//                assert.ok(doc.date instanceof Date, 'pouchdb should reload date objects');
//                done();
//            });
//        }).catch(done);
//    });
//it('query date', function (done) {
//    db.post({
//        date: new Date()
//    }).then(function () {
//        db.query({
//            map: function (doc) { emit(doc._id, doc) }
//        }).then(function (objs) {
//            assert.equal(objs.rows.length, 1);
//            assert.ok(objs.rows[0].date instanceof Date, 'pouchdb should reload date objects');
//            done();
//        }).catch(done);
//    }).catch(done);
//})
//});