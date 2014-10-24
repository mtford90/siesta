// var chai = require('chai');
// var s = require('../index')
//     , assert = chai.assert;

// var mappingOperation = require('../src/mappingOperation');
// var BulkMappingOperation = mappingOperation.BulkMappingOperation;
// var util = require('../src/util');
// var RelationshipType = require('../src/relationship').RelationshipType;
// var Collection = require('../src/collection').Collection;
// var cache = require('../src/cache');
// var collection;
// var Repo, User;


// describe('bulk mapping operation', function () {
//     describe('general', function () {
//         beforeEach(function (done) {
//             s.reset(true);
//             collection = new Collection('MyCollection');
//             collection.baseURL = 'https://api.github.com';
//             Repo = collection.mapping('Repo', {
//                 id: 'id',
//                 attributes: ['name', 'full_name', 'description'],
//                 relationships: {
//                     owner: {
//                         mapping: 'User',
//                         type: RelationshipType.OneToMany,
//                         reverse: 'repositories'
//                     }
//                 }
//             });
//             User = collection.mapping('User', {
//                 id: 'id',
//                 attributes: ['login']
//             });
//             collection.install(done);
//         });


//         describe('new', function () {

//             describe('foreign key', function () {
//                 describe('reverse', function () {
//                     it('existing', function (done) {
//                         s.ext.storage.Pouch.getPouch().post({
//                             id: '5',
//                             name: 'Old Name',
//                             full_name: 'Old Full Name',
//                             collection: 'MyCollection',
//                             type: 'Repo'
//                         }, function (err, resp) {
//                             if (err) {
//                                 done(err);
//                             }
//                             else {
//                                 var data = [
//                                     {
//                                         login: 'mike',
//                                         id: '123',
//                                         repositories: [
//                                             {id: '5', name: 'Repo', full_name: 'A Big Repo'}
//                                         ]
//                                     }
//                                 ];
//                                 var op = new BulkMappingOperation({mapping: User, data: data});
//                                 op.onCompletion(function () {
//                                     if (op.error) {
//                                         done(op.error);
//                                     }
//                                     else {
//                                         var objects = op.result;
//                                         try {
//                                             assert.equal(objects.length, 1);
//                                             var obj = objects[0];
//                                             assert.equal(obj.login, 'mike');
//                                             assert.equal(obj.id, '123');
//                                             assert.equal(obj.repositories.length, 1);
//                                             var repo = obj.repositories[0];
//                                             assert.equal(repo.id, 5);
//                                             assert.equal(repo.name, 'Repo');
//                                             assert.equal(repo.full_name, 'A Big Repo');
//                                             assert.equal(repo._id, resp.id);
//                                             assert.equal(repo.owner, obj);
//                                             done();
//                                         }
//                                         catch (err) {
//                                             done(err);
//                                         }
//                                     }

//                                 });
//                                 op.start();
//                             }

//                         })
//                     })
//                 });
//             });
//         });
//     });

//     describe('singleton...', function () {
//         var op;

//         beforeEach(function (done) {
//             s.reset(true);

//             collection = new Collection('MyCollection');
//             collection.baseURL = 'https://api.github.com';
//             Repo = collection.mapping('Repo', {
//                 id: 'id',
//                 attributes: ['name', 'full_name', 'description'],
//                 relationships: {
//                     owner: {
//                         mapping: 'User',
//                         type: RelationshipType.OneToMany,
//                         reverse: 'repositories'
//                     }
//                 }
//             });
//             User = collection.mapping('User', {
//                 id: 'id',
//                 attributes: ['login'],
//                 singleton: true
//             });
//             collection.install(done);
//         });

//         describe('existing, faulted', function () {

//             beforeEach(function (done) {
//                 var doc = {id: '567', _id: 'localId', type: 'User', collection: 'MyCollection'};
//                 s.ext.storage.Pouch.getPouch().put(doc, function (err, resp) {
//                     if (err) done(err);
//                     doc._rev = resp.rev;
//                     var data = [
//                         {login: 'mike', id: '123'},
//                         {login: 'bob', id: '1234'}
//                     ];
//                     op = new BulkMappingOperation({mapping: User, data: data});
//                     done();
//                 });
//             });

//             it('lookupSingleton', function (done) {
//                 op._lookupSingleton(function (err) {
//                     if (!err) {
//                         assert.equal(op.objects.length, 2);
//                         assert.equal(op.objects[0]._id, 'localId');
//                         assert.equal(op.objects[0], op.objects[1]);
//                     }
//                     done(err);
//                 });
//             });

//             it('map', function (done) {
//                 op.onCompletion(function () {
//                     var err = op.error;
//                     if (!err) {
//                         assert.equal(op.objects.length, 2);
//                         assert.equal(op.objects[0]._id, 'localId');
//                         assert.equal(op.objects[0], op.objects[1]);
//                         assert.equal(op.objects[0].login, 'bob');
//                         assert.equal(op.objects[0].id, '1234');
//                     }
//                     done(err);
//                 });
//                 op.start();
//             });
//         });
//     });
// });