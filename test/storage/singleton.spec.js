// var s = require('../index')
//     , assert = require('chai').assert;

// describe('singleton mapping', function () {

//     var SiestaModel = require('../src/object').SiestaModel;
//     var Collection = require('../src/collection').Collection;
//     var cache = require('../src/cache');
//     var store = require('../src/store');

//     var collection, carMapping;

//     function CarObject() {
//         SiestaModel.apply(this, arguments);
//     }

//     CarObject.prototype = Object.create(SiestaModel.prototype);

//     beforeEach(function (done) {
//         s.reset(true);
//         collection = new Collection('Car');
//         carMapping = collection.mapping('Car', {
//             id: 'id',
//             attributes: ['colour', 'name'],
//             singleton: true
//         });
//         collection.install(done);
//     });


//     it('store should return singleton', function (done) {
//         this.timeout(5000);
//         carMapping.map({colour: 'red', id: 5}, function (err, car) {
//             if (err) done(err);
//             collection.save(function (err) {
//                 if (err) done(err);
//                 cache.reset();
//                 store.get({mapping: carMapping}, function (err, obj) {
//                     if (err) done(err);
//                     assert.equal(obj._id, car._id);
//                     done();
//                 });
//             });
//         });
//     });



// });