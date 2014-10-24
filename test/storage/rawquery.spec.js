// var s = require('../../index')
//     , assert = require('chai').assert;

// describe('raw query behaviour', function () {

//     beforeEach(function () {
//         s.reset(true);
//     });

//     describe('data types', function () {

//         describe('indexed', function () {
//             describe('singular', function () {

//                 beforeEach(function (done) {
//                     var index = new s.ext.storage.Index('myCollection', 'Car', ['id']);
//                     index.install(done);
//                 });

//                 it('string', function (done) {
//                     s.ext.storage.Pouch.getPouch().post({
//                         type: 'Car',
//                         colour: 'red',
//                         name: 'Aston Martin',
//                         collection: 'myCollection',
//                         id: 'blah'
//                     }, function (err, resp) {
//                         if (err) {
//                             done(err);
//                         }
//                         else {
//                             var q = new s.ext.storage.RawQuery('myCollection', 'Car', {id: 'blah'});
//                             q.execute(function (err, docs) {
//                                 if (err) done(err);
//                                 assert.equal(docs.length, 1);
//                                 done();
//                             });
//                         }
//                     });
//                 });

//                 it('numeric', function (done) {
//                     s.ext.storage.Pouch.getPouch().post({
//                         type: 'Car',
//                         colour: 'red',
//                         name: 'Aston Martin',
//                         collection: 'myCollection',
//                         id: 5
//                     }, function (err, resp) {
//                         if (err) {
//                             done(err);
//                         }
//                         else {
//                             var q = new s.ext.storage.RawQuery('myCollection', 'Car', {id: 5});
//                             q.execute(function (err, docs) {
//                                 if (err) done(err);
//                                 assert.equal(docs.length, 1);
//                                 done();
//                             });
//                         }
//                     });
//                 });

//                 it('numeric with string query', function (done) {
//                     s.ext.storage.Pouch.getPouch().post({
//                         type: 'Car',
//                         colour: 'red',
//                         name: 'Aston Martin',
//                         collection: 'myCollection',
//                         id: 5
//                     }, function (err, resp) {
//                         if (err) {
//                             done(err);
//                         }
//                         else {
//                             var q = new s.ext.storage.RawQuery('myCollection', 'Car', {id: '5'});
//                             q.execute(function (err, docs) {
//                                 if (err) done(err);
//                                 assert.equal(docs.length, 1);
//                                 done();
//                             });
//                         }
//                     });
//                 });

//                 it('string with numeric query', function (done) {
//                     s.ext.storage.Pouch.getPouch().post({
//                         type: 'Car',
//                         colour: 'red',
//                         name: 'Aston Martin',
//                         collection: 'myCollection',
//                         id: '5'
//                     }, function (err, resp) {
//                         if (err) {
//                             done(err);
//                         }
//                         else {
//                             var q = new s.ext.storage.RawQuery('myCollection', 'Car', {id: 5});
//                             q.execute(function (err, docs) {
//                                 if (err) done(err);
//                                 assert.equal(docs.length, 1);
//                                 done();
//                             });
//                         }
//                     });
//                 });


//             });

//             describe('multiple', function () {

//                 beforeEach(function (done) {
//                     var index = new s.ext.storage.Index('myCollection', 'Car', ['id', 'colour', 'age']);
//                     index.install(done);
//                 });

//                 it('numeric', function (done) {
//                     s.ext.storage.Pouch.getPouch().post({
//                         type: 'Car',
//                         colour: 'red',
//                         name: 'Aston Martin',
//                         collection: 'myCollection',
//                         id: 5,
//                         age: 2
//                     }, function (err, resp) {
//                         if (err) {
//                             done(err);
//                         }
//                         else {
//                             var q = new s.ext.storage.RawQuery('myCollection', 'Car', {id: 5, colour: 'red', age: 2});
//                             q.execute(function (err, docs) {
//                                 if (err) done(err);
//                                 assert.equal(docs.length, 1);
//                                 done();
//                             });
//                         }
//                     });
//                 });

//                 it('string', function (done) {
//                     s.ext.storage.Pouch.getPouch().post({
//                         type: 'Car',
//                         colour: 'red',
//                         name: 'Aston Martin',
//                         collection: 'myCollection',
//                         id: '5',
//                         age: 2
//                     }, function (err) {
//                         if (err) {
//                             done(err);
//                         }
//                         else {
//                             var q = new s.ext.storage.RawQuery('myCollection', 'Car', {id: '5', colour: 'red', age: 2});
//                             q.execute(function (err, docs) {
//                                 if (err) done(err);
//                                 assert.equal(docs.length, 1);
//                                 done();
//                             });
//                         }
//                     });
//                 });




//             });
//         });

//         describe('not indexed', function () {
//             describe('singular', function () {

//                 it('string', function (done) {
//                     s.ext.storage.Pouch.getPouch().post({
//                         type: 'Car',
//                         colour: 'red',
//                         name: 'Aston Martin',
//                         collection: 'myCollection',
//                         id: 'blah'
//                     }, function (err, resp) {
//                         if (err) {
//                             done(err);
//                         }
//                         else {
//                             var q = new s.ext.storage.RawQuery('myCollection', 'Car', {id: 'blah'});
//                             q.execute(function (err, docs) {
//                                 if (err) done(err);
//                                 assert.equal(docs.length, 1);
//                                 done();
//                             });
//                         }
//                     });
//                 });

//                 it('numeric', function (done) {
//                     s.ext.storage.Pouch.getPouch().post({
//                         type: 'Car',
//                         colour: 'red',
//                         name: 'Aston Martin',
//                         collection: 'myCollection',
//                         id: 5
//                     }, function (err, resp) {
//                         if (err) {
//                             done(err);
//                         }
//                         else {
//                             var q = new s.ext.storage.RawQuery('myCollection', 'Car', {id: 5});
//                             q.execute(function (err, docs) {
//                                 if (err) done(err);
//                                 assert.equal(docs.length, 1);
//                                 done();
//                             });
//                         }
//                     });
//                 });

//                 it('numeric with string query', function (done) {
//                     s.ext.storage.Pouch.getPouch().post({
//                         type: 'Car',
//                         colour: 'red',
//                         name: 'Aston Martin',
//                         collection: 'myCollection',
//                         id: 5
//                     }, function (err, resp) {
//                         if (err) {
//                             done(err);
//                         }
//                         else {
//                             var q = new s.ext.storage.RawQuery('myCollection', 'Car', {id: '5'});
//                             q.execute(function (err, docs) {
//                                 if (err) done(err);
//                                 assert.equal(docs.length, 1);
//                                 done();
//                             });
//                         }
//                     });
//                 });

//                 it('string with numeric query', function (done) {
//                     s.ext.storage.Pouch.getPouch().post({
//                         type: 'Car',
//                         colour: 'red',
//                         name: 'Aston Martin',
//                         collection: 'myCollection',
//                         id: '5'
//                     }, function (err, resp) {
//                         if (err) {
//                             done(err);
//                         }
//                         else {
//                             var q = new s.ext.storage.RawQuery('myCollection', 'Car', {id: 5});
//                             q.execute(function (err, docs) {
//                                 if (err) done(err);
//                                 assert.equal(docs.length, 1);
//                                 done();
//                             });
//                         }
//                     });
//                 });


//             });

//             describe('multiple', function () {


//                 it('numeric', function (done) {
//                     s.ext.storage.Pouch.getPouch().post({
//                         type: 'Car',
//                         colour: 'red',
//                         name: 'Aston Martin',
//                         collection: 'myCollection',
//                         id: 5,
//                         age: 2
//                     }, function (err, resp) {
//                         if (err) {
//                             done(err);
//                         }
//                         else {
//                             var q = new s.ext.storage.RawQuery('myCollection', 'Car', {id: 5, colour: 'red', age: 2});
//                             q.execute(function (err, docs) {
//                                 if (err) done(err);
//                                 assert.equal(docs.length, 1);
//                                 done();
//                             });
//                         }
//                     });
//                 });  

//                 it('string', function (done) {
//                     s.ext.storage.Pouch.getPouch().post({
//                         type: 'Car',
//                         colour: 'red',
//                         name: 'Aston Martin',
//                         collection: 'myCollection',
//                         id: '5',
//                         age: 2
//                     }, function (err) {
//                         if (err) {
//                             done(err);
//                         }
//                         else {
//                             var q = new s.ext.storage.RawQuery('myCollection', 'Car', {id: '5', colour: 'red', age: 2});
//                             q.execute(function (err, docs) {
//                                 if (err) done(err);
//                                 assert.equal(docs.length, 1);
//                                 done();
//                             });
//                         }
//                     });
//                 });

//             });
//         });

//     });

// });