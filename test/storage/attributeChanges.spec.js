// var s = require('../index')
//     , assert = require('chai').assert;

// describe('attribute s.ext.storage.changes', function () {

//     var Collection = require('../src/collection').Collection
//         , ChangeType = require('../src/changes').ChangeType;

//     beforeEach(function () {
//         s.reset(true);
//     });

//     describe('attributes', function () {
//         var collection, carMapping;
//         var car;

//         var notif, collectionNotif, genericNotif;

//         afterEach(function () {
//             notif = null;
//             collectionNotif = null;
//             genericNotif = null;
//             car = null;
//             collection = null;
//             carMapping = null;
//         });

//         describe('set', function () {

//             beforeEach(function (done) {

//                 collection = new Collection('myCollection');
//                 carMapping = collection.mapping('Car', {
//                     id: 'id',
//                     attributes: ['colour', 'name']
//                 });
//                 collection.install(done);

//             });

//             it('no previous value', function () {
//                 var model = carMapping._new();
//                 model.colour = 'red';
//                 var cs = s.ext.storage.changes.changesForIdentifier(model._id);
//                 assert.equal(cs.length, 1);
//                 var c = cs[0];
//                 assert.equal(c.type, ChangeType.Set);
//                 assert.equal(c.new, 'red');
//                 assert.equal(c._id, model._id);
//                 assert.equal(c.collection, 'myCollection');
//                 assert.equal(c.mapping, 'Car');
//                 assert.equal(c.field, 'colour');
//                 assert.notOk(c.old);
//             });

//             it('has previous value', function () {
//                 var model = carMapping._new();
//                 model.__values.colour = 'blue';
//                 model.colour = 'red';
//                 var cs = s.ext.storage.changes.changesForIdentifier(model._id);
//                 assert.equal(cs.length, 1);
//                 var c = cs[0];
//                 assert.equal(c.type, ChangeType.Set);
//                 assert.equal(c.new, 'red');
//                 assert.equal(c.old, 'blue');
//                 assert.equal(c._id, model._id);
//                 assert.equal(c.collection, 'myCollection');
//                 assert.equal(c.mapping, 'Car');
//                 assert.equal(c.field, 'colour');
//             });

//             it('remote id', function () {
//                 var model = carMapping._new();
//                 model.id = 'xyz';
//                 var cs = s.ext.storage.changes.changesForIdentifier(model._id);
//                 assert.equal(cs.length, 1);
//                 var c = cs[0];
//                 assert.equal(c.type, ChangeType.Set);
//                 assert.equal(c.new, 'xyz');
//                 assert.notOk(c.old);
//                 assert.equal(c._id, model._id);
//                 assert.equal(c.collection, 'myCollection');
//                 assert.equal(c.mapping, 'Car');
//                 assert.equal(c.field, 'id');
//             });

//         });

//         describe('array', function () {
//             beforeEach(function (done) {
//                 collection = new Collection('myCollection');
//                 carMapping = collection.mapping('Car', {
//                     id: 'id',
//                     attributes: ['colours', 'name']
//                 });
//                 collection.install(done);
//             });

//             describe('set', function () {
//                 it('no previous value', function () {
//                     var model = carMapping._new();
//                     model.colours = ['green', 'blue'];
//                     var cs = s.ext.storage.changes.changesForIdentifier(model._id);
//                     assert.equal(cs.length, 1);
//                     var c = cs[0];
//                     assert.equal(c.type, ChangeType.Set);
//                     assert.equal(c.new, model.colours);
//                     assert.notOk(c.old);
//                     assert.equal(c._id, model._id);
//                     assert.equal(c.collection, 'myCollection');
//                     assert.equal(c.mapping, 'Car');
//                     assert.equal(c.field, 'colours');
//                 });

//                 it('has previous value', function () {
//                     var model = carMapping._new();
//                     var oldColours = ['purple', 'red'];
//                     model.__values.colours = oldColours;
//                     model.colours = ['green', 'blue'];
//                     var cs = s.ext.storage.changes.changesForIdentifier(model._id);
//                     assert.equal(cs.length, 1);
//                     var c = cs[0];
//                     assert.equal(c.type, ChangeType.Set);
//                     assert.equal(c.new, model.colours);
//                     assert.equal(c.old, oldColours);
//                     assert.equal(c._id, model._id);
//                     assert.equal(c.collection, 'myCollection');
//                     assert.equal(c.mapping, 'Car');
//                     assert.equal(c.field, 'colours');
//                 });
//             });

//             it('push', function (done) {
//                 var model = carMapping._new();
//                 model.colours = [];
//                 s.ext.storage.changes.resetChanges();
//                 model.colours.push('red');
//                 setTimeout(function () {
//                     var cs = s.ext.storage.changes.changesForIdentifier(model._id);
//                     assert.equal(cs.length, 1);
//                     var c = cs[0];
//                     assert.equal(c.type, ChangeType.Splice);
//                     assert.equal(c.index, 0);
//                     assert.equal(c.removed.length, 0);
//                     assert.equal(c.added.length, 1);
//                     assert.equal(c.added[0], 'red');
//                     assert.equal(c._id, model._id);
//                     assert.equal(c.collection, 'myCollection');
//                     assert.equal(c.mapping, 'Car');
//                     assert.equal(c.field, 'colours');
//                     done();
//                 });
//             });

//             it('index', function (done) {
//                 var model = carMapping._new();
//                 model.colours = ['blue', 'green', 'purple'];
//                 s.ext.storage.changes.resetChanges();
//                 model.colours[1] = 'red';
//                 setTimeout(function () {
//                     var cs = s.ext.storage.changes.changesForIdentifier(model._id);
//                     assert.equal(cs.length, 1);
//                     var c = cs[0];
//                     assert.equal(c.type, ChangeType.Splice);
//                     assert.equal(c.index, 1);
//                     assert.equal(c.removed.length, 1);
//                     assert.equal(c.removed[0], 'green');
//                     assert.equal(c.added.length, 1);
//                     assert.equal(c.added[0], 'red');
//                     assert.equal(c._id, model._id);
//                     assert.equal(c.collection, 'myCollection');
//                     assert.equal(c.mapping, 'Car');
//                     assert.equal(c.field, 'colours');
//                     done();
//                 });
//             });

//         });

//     });

// });