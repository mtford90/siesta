// var s = require('../../index')
//     , assert = require('chai').assert;

// describe('perform mapping', function () {


//     var Collection = require('../../src/collection').Collection;
//     var RelationshipType = require('../../src/relationship').RelationshipType;

//     var SiestaModel = require('../../src/object').SiestaModel;
//     var cache = require('../../src/cache');
//     var Operation = require('../../vendor/operations.js/src/operation').Operation;

//     var collection, carMapping, personMapping;

//     beforeEach(function () {
//         collection = null;
//         carMapping = null;
//         personMapping = null;
//         s.reset(true);
//     });

//     afterEach(function () {
//         var numIncomplete = 0;
//         _.each(Operation.running, function (op) {
//             if (!op.completed) {
//                 numIncomplete++;
//             }
//         });
//         assert.notOk(numIncomplete);
//     });


//     describe('no relationships', function () {
//         var obj;

//         beforeEach(function (done) {
//             collection = new Collection('myCollection');
//             carMapping = collection.mapping('Car', {
//                 id: 'id',
//                 attributes: ['colour', 'name']
//             });
//             collection.install(function (err) {
//                 if (err) done(err);
//                 carMapping.map({colour: 'red', name: 'Aston Martin', id: 'dfadf'}, function (err, _obj) {
//                     if (err) {
//                         done(err);
//                     }
//                     obj = _obj;
//                     done();
//                 });
//             });
//         });

//         describe('existing in pouch', function () {

//             describe('via id', function () {
//                 var newObj;
//                 beforeEach(function (done) {
//                     var doc = {_id: 'localId', type: 'Car', collection: 'myCollection', colour: 'red', id: 'remoteId'};
//                     s.ext.storage.Pouch.getPouch().put(doc, function (err, doc) {
//                         if (err) done(err);
//                         carMapping.map({colour: 'blue', id: 'remoteId'}, function (err, obj) {
//                             if (err) done(err);
//                             newObj = obj;
//                             done();
//                         });
//                     });

//                 });

//                 it('should be mapped onto the old object', function () {
//                     assert.equal(newObj._id, 'localId');
//                 });

//                 it('should have the new colour', function () {
//                     assert.equal(newObj.colour, 'blue');
//                 });

//             });

//             describe('via _id', function () {
//                 var newObj;
//                 beforeEach(function (done) {
//                     var doc = {_id: 'localId', type: 'Car', collection: 'myCollection', colour: 'red', id: 'remoteId'};
//                     s.ext.storage.Pouch.getPouch().put(doc, function (err, doc) {
//                         if (err) done(err);
//                         carMapping.map({colour: 'blue', _id: 'localId'}, function (err, obj) {
//                             if (err) {
//                                 console.error(err);
//                                 done(err);
//                             }
//                             newObj = obj;
//                             done();
//                         });
//                     });
//                 });

//                 it('should be mapped onto the old object', function () {
//                     assert.equal(newObj._id, 'localId');
//                 });

//                 it('should have the new colour', function () {
//                     assert.equal(newObj.colour, 'blue');
//                 });
//                 it('obj removed from cache should not have the new colour', function () {
//                     assert.notEqual(obj.colour, 'blue');
//                 });
//             });
//         });


//     });

//     describe('with relationship', function () {

//         describe('foreign key', function () {
//             beforeEach(function (done) {
//                 collection = new Collection('myCollection');
//                 personMapping = collection.mapping('Person', {
//                     id: 'id',
//                     attributes: ['name', 'age']
//                 });
//                 carMapping = collection.mapping('Car', {
//                     id: 'id',
//                     attributes: ['colour', 'name'],
//                     relationships: {
//                         owner: {
//                             mapping: 'Person',
//                             type: RelationshipType.OneToMany,
//                             reverse: 'cars'
//                         }
//                     }
//                 });
//                 collection.install(done);
//             });

//             describe('faulted relationship', function () {
//                 var person, car;

//                 beforeEach(function (done) {
//                     var doc = {name: 'Michael Ford', age: 23, id: 'personRemoteId', collection: 'myCollection', type: 'Person', _id: 'personLocalId'};
//                     s.ext.storage.Pouch.getPouch().put(doc, function (err) {
//                         if (err) done(err);
//                         carMapping.map({name: 'Bentley', colour: 'black', owner: 'personRemoteId', id: 'carRemoteId'}, function (err, _car) {
//                             if (err) {
//                                 done(err);
//                             }
//                             car = _car;
//                             person = car.owner;
//                             done();
//                         });
//                     });

//                 });

//                 it('should have mapped onto Michael', function () {
//                     assert.equal(person.name, 'Michael Ford');
//                     assert.equal(person.age, 23);
//                 });

//             });

//         });


//     });


  
//     describe('bulk', function () {
//         describe('new', function () {
//             describe('no relationships', function () {
//                 beforeEach(function (done) {
//                     collection = new Collection('myCollection');
//                     carMapping = collection.mapping('Car', {
//                         id: 'id',
//                         attributes: ['colour', 'name']
//                     });
//                     collection.install(done);
//                 });

//                 it('all valid', function (done) {
//                     var raw = [
//                         {colour: 'red', name: 'Aston Martin', id: 'remoteId1sdfsdfdsfgsdf'},
//                         {colour: 'blue', name: 'Lambo', id: "remoteId2dfgdfgdfg"},
//                         {colour: 'green', name: 'Ford', id: "remoteId3dfgdfgdfgdfg"}
//                     ];
//                     carMapping._mapBulk(raw, function (err, objs) {
//                         if (err) done(err);
//                         assert.equal(objs.length, raw.length);
//                         assert.equal(objs[0].colour, 'red');
//                         assert.equal(objs[1].colour, 'blue');
//                         assert.equal(objs[2].colour, 'green');
//                         done();
//                     })
//                 });
//             });
//             describe('foreign key', function () {
//                 var personMapping;

//                 beforeEach(function (done) {
//                     collection = new Collection('myCollection');
//                     personMapping = collection.mapping('Person', {
//                         id: 'id',
//                         attributes: ['name', 'age']
//                     });
//                     carMapping = collection.mapping('Car', {
//                         id: 'id',
//                         attributes: ['colour', 'name'],
//                         relationships: {
//                             owner: {
//                                 mapping: 'Person',
//                                 type: RelationshipType.OneToMany,
//                                 reverse: 'cars'
//                             }
//                         }
//                     });
//                     collection.install(done);
//                 });

//                 it('same owner using _mapBulk', function (done) {
//                     var ownerId = 'ownerId462345345';
//                     var raw = [
//                         {colour: 'red', name: 'Aston Martin', id: 'remoteId1', owner: ownerId},
//                         {colour: 'blue', name: 'Lambo', id: "remoteId2", owner: ownerId},
//                         {colour: 'green', name: 'Ford', id: "remoteId3", owner: ownerId}
//                     ];
//                     carMapping._mapBulk(raw, function (err, objs) {
//                         if (err) done(err);
//                         assert.equal(objs.length, raw.length);
//                         assert.equal(objs[0].owner, objs[1].owner);
//                         assert.equal(objs[1].owner, objs[2].owner);
//                         done();
//                     })
//                 });

//                 it('same owner using map', function (done) {
//                     var ownerId = 'ownerId!!!334';
//                     var carRaw1 = {colour: 'red', name: 'Aston Martin', id: 'remoteId1', owner: ownerId};
//                     var carRaw2 = {colour: 'blue', name: 'Lambo', id: "remoteId2", owner: ownerId};
//                     carMapping.map(carRaw1, function (err, car1) {
//                         if (err) {
//                             done(err);
//                         }
//                         else {
//                             carMapping.map(carRaw2, function (err, car2) {
//                                 if (err) done(err);
//                                 assert.equal(car1.owner, car2.owner);
//                                 done();
//                             })
//                         }
//                     });
//                 })
//             })
//         });

//         describe('faulted relationships', function () {
//             var cars;

//             var personMapping;

//             beforeEach(function (done) {
//                 collection = new Collection('myCollection');
//                 personMapping = collection.mapping('Person', {
//                     id: 'id',
//                     attributes: ['name', 'age']
//                 });
//                 carMapping = collection.mapping('Car', {
//                     id: 'id',
//                     attributes: ['colour', 'name'],
//                     relationships: {
//                         owner: {
//                             mapping: 'Person',
//                             type: RelationshipType.OneToMany,
//                             reverse: 'cars'
//                         }
//                     }
//                 });
//                 collection.install(done);
//             });


//             describe('via remote id', function () {
//                 beforeEach(function (done) {
//                     personMapping.map({name: 'Michael Ford', age: 23, id: 'personRemoteId'}, function (err) {
//                         if (err) done(err);
//                         cache.reset();
//                         var raw = [
//                             {colour: 'red', name: 'Aston Martin', id: 'remoteId1', owner: 'personRemoteId'},
//                             {colour: 'blue', name: 'Lambo', id: "remoteId2", owner: 'personRemoteId'},
//                             {colour: 'green', name: 'Ford', id: "remoteId3", owner: 'personRemoteId'}
//                         ];
//                         carMapping._mapBulk(raw, function (err, objs, res) {
//                             if (err) {
//                                 done(err);
//                             }
//                             cars = objs;
//                             done();
//                         });

//                     });
//                 });

//                 it('should have mapped onto Michael', function () {
//                     assert.equal(cars.length, 3);
//                     assert.equal(cars[0].owner, cars[1].owner);
//                     assert.equal(cars[1].owner, cars[2].owner);
//                 });

//             });


//             describe('bulk bulk', function () {
//                 beforeEach(function (done) {
//                     cars = [];
//                     personMapping.map({name: 'Michael Ford', age: 23, id: 'personRemoteId'}, function (err) {
//                         if (err) done(err);
//                         cache.reset();
//                         var raw1 = [
//                             {colour: 'red', name: 'Aston Martin', id: 'remoteId1', owner: 'personRemoteId'},
//                             {colour: 'blue', name: 'Lambo', id: "remoteId2", owner: 'personRemoteId'},
//                             {colour: 'green', name: 'Ford', id: "remoteId3", owner: 'personRemoteId'}
//                         ];
//                         carMapping._mapBulk(raw1, function (err, objs, res) {
//                             if (err) {
//                                 done(err);
//                             }
//                             _.each(objs, function (o) {
//                                 cars.push(o);
//                             });
//                             if (cars.length == 9) {
//                                 done();
//                             }
//                         });
//                         var raw2 = [
//                             {colour: 'red', name: 'Peauget', id: 'remoteId4', owner: 'personRemoteId'},
//                             {colour: 'blue', name: 'Chevy', id: "remoteId5", owner: 'personRemoteId'},
//                             {colour: 'green', name: 'Ford', id: "remoteId6", owner: 'personRemoteId'}
//                         ];
//                         carMapping._mapBulk(raw2, function (err, objs, res) {
//                             if (err) {
//                                 done(err);
//                             }
//                             _.each(objs, function (o) {
//                                 cars.push(o);
//                             });
//                             if (cars.length == 9) {
//                                 done();
//                             }
//                         });
//                         var raw3 = [
//                             {colour: 'red', name: 'Ferarri', id: 'remoteId7', owner: 'personRemoteId'},
//                             {colour: 'blue', name: 'Volvo', id: "remoteId8", owner: 'personRemoteId'},
//                             {colour: 'green', name: 'Dodge', id: "remoteId9", owner: 'personRemoteId'}
//                         ];
//                         carMapping._mapBulk(raw3, function (err, objs, res) {
//                             if (err) {
//                                 done(err);
//                             }
//                             _.each(objs, function (o) {
//                                 cars.push(o);
//                             });
//                             console.log(cars.length);
//                             if (cars.length == 9) {
//                                 done();
//                             }
//                         });

//                     });
//                 });

//                 it('should have mapped onto Michael', function () {
//                     assert.equal(cars.length, 9);
//                     for (var i = 0; i < 8; i++) {
//                         assert.equal(cars[i].owner, cars[i + 1].owner);
//                     }
//                 });

//             });

//             describe('via nested remote id', function () {
//                 beforeEach(function (done) {
//                     personMapping.map({name: 'Michael Ford', age: 23, id: 'personRemoteId'}, function (err) {
//                         if (err) done(err);
//                         cache.reset();
//                         var raw = [
//                             {colour: 'red', name: 'Aston Martin', id: 'remoteId1', owner: {id: 'personRemoteId'}},
//                             {colour: 'blue', name: 'Lambo', id: "remoteId2", owner: {id: 'personRemoteId'}},
//                             {colour: 'green', name: 'Ford', id: "remoteId3", owner: {id: 'personRemoteId'}}
//                         ];
//                         carMapping._mapBulk(raw, function (err, objs, res) {
//                             if (err) {
//                                 done(err);
//                             }
//                             cars = objs;
//                             done();
//                         });

//                     });
//                 });

//                 it('should have mapped onto Michael', function () {
//                     assert.equal(cars.length, 3);
//                     assert.equal(cars[0].owner, cars[1].owner);
//                     assert.equal(cars[1].owner, cars[2].owner);
//                 });

//             });

//             describe('via nested remote id with unmergedChanges', function () {
//                 this.timeout(5000);
//                 beforeEach(function (done) {
//                     personMapping.map({name: 'Michael Ford', age: 23, id: 'personRemoteId'}, function (err) {
//                         if (err) done(err);
//                         cache.reset();
//                         var raw = [
//                             {colour: 'red', name: 'Aston Martin', id: 'remoteId1', owner: {id: 'personRemoteId'}},
//                             {colour: 'blue', name: 'Lambo', id: "remoteId2", owner: {id: 'personRemoteId', name: 'Bob'}},
//                             {colour: 'green', name: 'Ford', id: "remoteId3", owner: {id: 'personRemoteId'}}
//                         ];
//                         carMapping._mapBulk(raw, function (err, objs, res) {
//                             if (err) {
//                                 done(err);
//                             }
//                             cars = objs;
//                             done();
//                         });

//                     });
//                 });

//                 it('should have mapped onto Michael', function () {
//                     assert.equal(cars.length, 3);
//                     assert.equal(cars[0].owner, cars[1].owner);
//                     assert.equal(cars[1].owner, cars[2].owner);
//                 });
//                 it('should have changed the name', function () {
//                     assert.equal(cars[0].owner.name, 'Bob');
//                     assert.equal(cars[1].owner.name, 'Bob');
//                     assert.equal(cars[2].owner.name, 'Bob');
//                 });

//             })

//         });


//     });
// });