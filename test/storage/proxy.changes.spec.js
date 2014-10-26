// var s = require('../index')
//     , assert = require('chai').assert;

// describe('new object proxy', function () {

//     var NewObjectProxy = require('../src/proxy').NewObjectProxy;
//     var OneToOneProxy = require('../src/oneToOneProxy').OneToOneProxy;
//     var OneToManyProxy = require('../src/oneToManyProxy').OneToManyProxy;
//     var ManyToManyProxy = require('../src/manyToManyProxy').ManyToManyProxy;
//     var SiestaModel = require('../src/object').SiestaModel;
//     var Fault = require('../src/proxy').Fault;
//     var InternalSiestaError = require('../src/error').InternalSiestaError;
//     var Collection = require('../src/collection').Collection;
//     var cache = require('../src/cache');
//     var ChangeType = require('../src/changes').ChangeType;

//     var carMapping, personMapping;

//     var collection;

//     beforeEach(function (done) {
//         s.reset(true);
//         collection = new Collection('myCollection');
//         carMapping = collection.mapping('Car', {
//             id: 'id',
//             attributes: ['colour', 'name']
//         });
//         personMapping = collection.mapping('Person', {
//             id: 'id',
//             attributes: ['name', 'age']
//         });
//         collection.install(done);
//     });

//     describe('foreign key', function () {
//         var carProxy, personProxy;
//         var car, person;

//         describe('get', function () {
//             beforeEach(function () {
//                 carProxy = new OneToManyProxy({
//                     reverseMapping: personMapping,
//                     forwardMapping: carMapping,
//                     reverseName: 'cars',
//                     forwardName: 'owner'
//                 });
//                 personProxy = new OneToManyProxy({
//                     reverseMapping: personMapping,
//                     forwardMapping: carMapping,
//                     reverseName: 'cars',
//                     forwardName: 'owner'
//                 });
//                 car = new SiestaModel(carMapping);
//                 car._id = 'car';
//                 carProxy.install(car);
//                 person = new SiestaModel(personMapping);
//                 person._id = 'person';
//                 personProxy.install(person);
//                 cache.insert(person);
//                 cache.insert(car);
//             });


//         });

//         describe('set', function () {
//             var carProxy, personProxy;
//             var car, person;
//             beforeEach(function () {
//                 carProxy = new OneToManyProxy({
//                     reverseMapping: personMapping,
//                     forwardMapping: carMapping,
//                     reverseName: 'cars',
//                     forwardName: 'owner'
//                 });
//                 personProxy = new OneToManyProxy({
//                     reverseMapping: personMapping,
//                     forwardMapping: carMapping,
//                     reverseName: 'cars',
//                     forwardName: 'owner'
//                 });
//                 car = new SiestaModel(carMapping);
//                 car._id = 'car';
//                 carProxy.install(car);
//                 carProxy.isFault = false;
//                 person = new SiestaModel(personMapping);
//                 person._id = 'person';
//                 personProxy.install(person);
//                 personProxy.isFault = false;
//             });
       
//             describe('pre-existing', function () {

//                 var anotherPerson, anotherPersonProxy;

//                 beforeEach(function () {
//                     anotherPerson = new SiestaModel(personMapping);
//                     anotherPerson._id = 'anotherPerson';
//                     anotherPersonProxy = new OneToManyProxy({
//                         reverseMapping: personMapping,
//                         forwardMapping: carMapping,
//                         reverseName: 'cars',
//                         forwardName: 'owner'
//                     });
//                     anotherPersonProxy.install(anotherPerson);
//                     anotherPersonProxy.isFault = false;
//                     cache.insert(anotherPerson);
//                     cache.insert(person);
//                     cache.insert(car);
//                 });

//                 describe('no fault', function () {
//                     beforeEach(function () {
//                         car.owner = anotherPerson;
//                     });
//                     describe('forward', function () {

//                         it('generates correct s.ext.storage.changes', function () {
//                             car.owner = person;
//                             var carChanges = s.ext.storage.changes.changesForIdentifier(car._id);
//                             assert.equal(carChanges.length, 2);
//                             var personChanges = s.ext.storage.changes.changesForIdentifier(person._id);
//                             assert.equal(personChanges.length, 1);
//                             var anotherPersonChanges = s.ext.storage.changes.changesForIdentifier(anotherPerson._id);
//                             assert.equal(anotherPersonChanges.length, 2);
//                             var personChange = personChanges[0];
//                             var firstCarChange = carChanges[0];
//                             var secondCarChange = carChanges[1];
//                             var firstAnotherPersonChange = anotherPersonChanges[0];
//                             var secondAnotherPersonChange = anotherPersonChanges[1];
//                             assert.equal(personChange.collection, 'myCollection');
//                             assert.equal(personChange.mapping, 'Person');
//                             assert.equal(personChange._id, person._id);
//                             assert.equal(personChange.field, 'cars');
//                             assert.equal(personChange.index, 0);
//                             assert.equal(personChange.added.length, 1);
//                             assert.include(personChange.added, car);
//                             assert.equal(personChange.addedId.length, 1);
//                             assert.include(personChange.addedId, car._id);
//                             assert.equal(personChange.type, ChangeType.Splice);
//                             assert.equal(firstAnotherPersonChange.collection, 'myCollection');
//                             assert.equal(firstAnotherPersonChange.mapping, 'Person');
//                             assert.equal(firstAnotherPersonChange._id, anotherPerson._id);
//                             assert.equal(firstAnotherPersonChange.field, 'cars');
//                             assert.equal(firstAnotherPersonChange.index, 0);
//                             assert.equal(firstAnotherPersonChange.addedId.length, 1, 'First change addedId populated');
//                             assert.include(firstAnotherPersonChange.addedId, car._id);
//                             assert.equal(firstAnotherPersonChange.added.length, 1);
//                             assert.include(firstAnotherPersonChange.added, car);
//                             assert.equal(firstAnotherPersonChange.removed.length, 0);
//                             assert.equal(firstAnotherPersonChange.type, ChangeType.Splice);
//                             assert.equal(secondAnotherPersonChange.collection, 'myCollection');
//                             assert.equal(secondAnotherPersonChange.mapping, 'Person');
//                             assert.equal(secondAnotherPersonChange._id, anotherPerson._id);
//                             assert.equal(secondAnotherPersonChange.field, 'cars');
//                             assert.equal(secondAnotherPersonChange.index, 0);
//                             assert.equal(secondAnotherPersonChange.added.length, 0);
//                             assert.equal(secondAnotherPersonChange.removedId.length, 1);
//                             assert.include(secondAnotherPersonChange.removedId, car._id);
//                             assert.equal(secondAnotherPersonChange.removed.length, 1);
//                             assert.include(secondAnotherPersonChange.removed, car);
//                             assert.equal(secondAnotherPersonChange.type, ChangeType.Splice);
//                             assert.equal(secondCarChange.collection, 'myCollection');
//                             assert.equal(secondCarChange.mapping, 'Car');
//                             assert.equal(secondCarChange._id, car._id);
//                             assert.equal(secondCarChange.field, 'owner');
//                             assert.equal(secondCarChange.new, person);
//                             assert.equal(secondCarChange.newId, person._id);
//                             assert.equal(secondCarChange.old, anotherPerson);
//                             assert.equal(secondCarChange.oldId, anotherPerson._id);
//                             assert.equal(secondCarChange.type, ChangeType.Set);
//                             assert.equal(firstCarChange.collection, 'myCollection');
//                             assert.equal(firstCarChange.mapping, 'Car');
//                             assert.equal(firstCarChange._id, car._id);
//                             assert.equal(firstCarChange.field, 'owner');
//                             assert.equal(firstCarChange.newId, anotherPerson._id);
//                             assert.equal(firstCarChange.new, anotherPerson);
//                             assert.notOk(firstCarChange.old);
//                             assert.notOk(firstCarChange.oldId);
//                             assert.equal(firstCarChange.type, ChangeType.Set);
//                         });

//                     });
//                     describe('backwards', function () {
//                         it('generates correct s.ext.storage.changes', function () {
//                             person.cars = [car];
//                             var carChanges = s.ext.storage.changes.changesForIdentifier(car._id);
//                             assert.equal(carChanges.length, 2);
//                             var personChanges = s.ext.storage.changes.changesForIdentifier(person._id);
//                             assert.equal(personChanges.length, 1);
//                             var anotherPersonChanges = s.ext.storage.changes.changesForIdentifier(anotherPerson._id);
//                             assert.equal(anotherPersonChanges.length, 2);
//                             var personChange = personChanges[0];
//                             var firstCarChange = carChanges[0];
//                             var secondCarChange = carChanges[1];
//                             var firstAnotherPersonChange = anotherPersonChanges[0];
//                             var secondAnotherPersonChange = anotherPersonChanges[1];
//                             assert.equal(personChange.collection, 'myCollection');
//                             assert.equal(personChange.mapping, 'Person');
//                             assert.equal(personChange._id, person._id);
//                             assert.equal(personChange.field, 'cars');
//                             assert.notOk(personChange.old);
//                             assert.notOk(personChange.oldId);
//                             assert.equal(personChange.new.length, 1);
//                             assert.equal(personChange.newId.length, 1);
//                             assert.include(personChange.newId, car._id);
//                             assert.include(personChange.new, car);
//                             assert.equal(personChange.type, ChangeType.Set);
//                             assert.equal(firstAnotherPersonChange.collection, 'myCollection');
//                             assert.equal(firstAnotherPersonChange.mapping, 'Person');
//                             assert.equal(firstAnotherPersonChange._id, anotherPerson._id);
//                             assert.equal(firstAnotherPersonChange.field, 'cars');
//                             assert.equal(firstAnotherPersonChange.index, 0);
//                             assert.equal(firstAnotherPersonChange.added.length, 1);
//                             assert.equal(firstAnotherPersonChange.addedId.length, 1);
//                             assert.equal(firstAnotherPersonChange.removed.length, 0);
//                             assert.equal(firstAnotherPersonChange.removedId.length, 0);
//                             assert.equal(firstAnotherPersonChange.type, ChangeType.Splice);
//                             assert.include(firstAnotherPersonChange.added, car);
//                             assert.include(firstAnotherPersonChange.addedId, car._id);
//                             assert.equal(secondAnotherPersonChange.collection, 'myCollection');
//                             assert.equal(secondAnotherPersonChange.mapping, 'Person');
//                             assert.equal(secondAnotherPersonChange._id, anotherPerson._id);
//                             assert.equal(secondAnotherPersonChange.field, 'cars');
//                             assert.equal(secondAnotherPersonChange.index, 0);
//                             assert.equal(secondAnotherPersonChange.added.length, 0);
//                             assert.equal(secondAnotherPersonChange.addedId.length, 0);
//                             assert.equal(secondAnotherPersonChange.removed.length, 1);
//                             assert.equal(secondAnotherPersonChange.removedId.length, 1);
//                             assert.include(secondAnotherPersonChange.removedId, car._id);
//                             assert.include(secondAnotherPersonChange.removed, car);
//                             assert.equal(secondAnotherPersonChange.type, ChangeType.Splice);
//                             assert.equal(secondCarChange.collection, 'myCollection');
//                             assert.equal(secondCarChange.mapping, 'Car');
//                             assert.equal(secondCarChange._id, car._id);
//                             assert.equal(secondCarChange.field, 'owner');
//                             assert.equal(secondCarChange.newId, person._id);
//                             assert.equal(secondCarChange.new, person);
//                             assert.equal(secondCarChange.old, anotherPerson);
//                             assert.equal(secondCarChange.oldId, anotherPerson._id);
//                             assert.equal(secondCarChange.type, ChangeType.Set);
//                             assert.equal(firstCarChange.collection, 'myCollection');
//                             assert.equal(firstCarChange.mapping, 'Car');
//                             assert.equal(firstCarChange._id, car._id);
//                             assert.equal(firstCarChange.field, 'owner');
//                             assert.equal(firstCarChange.new, anotherPerson);
//                             assert.equal(firstCarChange.newId, anotherPerson._id);
//                             assert.notOk(firstCarChange.old);
//                             assert.notOk(firstCarChange.oldId);
//                             assert.equal(firstCarChange.type, ChangeType.Set);
//                         });
//                     });
//                 });

//                 describe('fault', function () {
//                     beforeEach(function () {
//                         car.owner = anotherPerson;
//                         carProxy.related = undefined;
//                         anotherPersonProxy.related = undefined;
//                     });
//                     describe('forward', function () {
//                         it('generates correct s.ext.storage.changes', function () {
//                             car.owner = person;
//                             var carChanges = s.ext.storage.changes.changesForIdentifier(car._id);
//                             assert.equal(carChanges.length, 2);
//                             var personChanges = s.ext.storage.changes.changesForIdentifier(person._id);
//                             assert.equal(personChanges.length, 1);
//                             var anotherPersonChanges = s.ext.storage.changes.changesForIdentifier(anotherPerson._id);
//                             assert.equal(anotherPersonChanges.length, 2);
//                             var personChange = personChanges[0];
//                             var firstCarChange = carChanges[0];
//                             var secondCarChange = carChanges[1];
//                             var firstAnotherPersonChange = anotherPersonChanges[0];
//                             var secondAnotherPersonChange = anotherPersonChanges[1];
//                             assert.equal(personChange.collection, 'myCollection');
//                             assert.equal(personChange.mapping, 'Person');
//                             assert.equal(personChange._id, person._id);
//                             assert.equal(personChange.field, 'cars');
//                             assert.equal(personChange.index, 0);
//                             assert.equal(personChange.addedId.length, 1);
//                             assert.include(personChange.addedId, car._id);
//                             assert.equal(personChange.added.length, 1);
//                             assert.include(personChange.added, car);
//                             assert.equal(personChange.type, ChangeType.Splice);
//                             assert.equal(firstAnotherPersonChange.collection, 'myCollection');
//                             assert.equal(firstAnotherPersonChange.mapping, 'Person');
//                             assert.equal(firstAnotherPersonChange._id, anotherPerson._id);
//                             assert.equal(firstAnotherPersonChange.field, 'cars');
//                             assert.equal(firstAnotherPersonChange.index, 0);
//                             assert.equal(firstAnotherPersonChange.added.length, 1);
//                             assert.include(firstAnotherPersonChange.added, car);
//                             assert.equal(firstAnotherPersonChange.addedId.length, 1);
//                             assert.include(firstAnotherPersonChange.addedId, car._id);
//                             assert.equal(firstAnotherPersonChange.removed.length, 0);
//                             assert.equal(firstAnotherPersonChange.type, ChangeType.Splice);
//                             assert.equal(secondAnotherPersonChange.collection, 'myCollection');
//                             assert.equal(secondAnotherPersonChange.mapping, 'Person');
//                             assert.equal(secondAnotherPersonChange._id, anotherPerson._id);
//                             assert.equal(secondAnotherPersonChange.field, 'cars');
//                             assert.equal(secondAnotherPersonChange.removed.length, 1);
//                             assert.include(secondAnotherPersonChange.removed, car);
//                             assert.equal(secondAnotherPersonChange.removedId.length, 1);
//                             assert.include(secondAnotherPersonChange.removedId, car._id);
//                             assert.equal(secondAnotherPersonChange.type, ChangeType.Delete);
//                             assert.equal(secondCarChange.collection, 'myCollection');
//                             assert.equal(secondCarChange.mapping, 'Car');
//                             assert.equal(secondCarChange._id, car._id);
//                             assert.equal(secondCarChange.field, 'owner');
//                             assert.equal(secondCarChange.new, person);
//                             // Due to the fault.
//                             assert.notOk(secondCarChange.old);
//                             assert.equal(secondCarChange.newId, person._id);
//                             assert.equal(secondCarChange.oldId, anotherPerson._id);
//                             assert.equal(secondCarChange.type, ChangeType.Set);
//                             assert.equal(firstCarChange.collection, 'myCollection');
//                             assert.equal(firstCarChange.mapping, 'Car');
//                             assert.equal(firstCarChange._id, car._id);
//                             assert.equal(firstCarChange.field, 'owner');
//                             assert.equal(firstCarChange.newId, anotherPerson._id);
//                             assert.equal(firstCarChange.new, anotherPerson);
//                             assert.notOk(firstCarChange.old);
//                             assert.equal(firstCarChange.type, ChangeType.Set);
//                         });

//                     });
//                     describe('backwards', function () {

//                         it('generates correct s.ext.storage.changes', function () {
//                             person.cars = [car];
//                             var carChanges = s.ext.storage.changes.changesForIdentifier(car._id);
//                             assert.equal(carChanges.length, 2);
//                             var personChanges = s.ext.storage.changes.changesForIdentifier(person._id);
//                             assert.equal(personChanges.length, 1);
//                             var anotherPersonChanges = s.ext.storage.changes.changesForIdentifier(anotherPerson._id);
//                             assert.equal(anotherPersonChanges.length, 2);
//                             var personChange = personChanges[0];
//                             var firstCarChange = carChanges[0];
//                             var secondCarChange = carChanges[1];
//                             var firstAnotherPersonChange = anotherPersonChanges[0];
//                             var secondAnotherPersonChange = anotherPersonChanges[1];
//                             assert.equal(personChange.collection, 'myCollection');
//                             assert.equal(personChange.mapping, 'Person');
//                             assert.equal(personChange._id, person._id);
//                             assert.equal(personChange.field, 'cars');
//                             assert.notOk(personChange.old);
//                             assert.equal(personChange.newId.length, 1);
//                             assert.include(personChange.newId, car._id);
//                             assert.equal(personChange.new.length, 1);
//                             assert.include(personChange.new, car);
//                             assert.equal(personChange.newId.length, 1);
//                             assert.include(personChange.newId, car._id);
//                             assert.equal(personChange.type, ChangeType.Set);
//                             assert.equal(firstAnotherPersonChange.collection, 'myCollection');
//                             assert.equal(firstAnotherPersonChange.mapping, 'Person');
//                             assert.equal(firstAnotherPersonChange._id, anotherPerson._id);
//                             assert.equal(firstAnotherPersonChange.field, 'cars');
//                             assert.equal(firstAnotherPersonChange.index, 0);
//                             assert.equal(firstAnotherPersonChange.addedId.length, 1);
//                             assert.include(firstAnotherPersonChange.addedId, car._id);
//                             assert.equal(firstAnotherPersonChange.added.length, 1);
//                             assert.include(firstAnotherPersonChange.added, car);
//                             assert.equal(firstAnotherPersonChange.removed.length, 0);
//                             assert.equal(firstAnotherPersonChange.removedId.length, 0);
//                             assert.equal(firstAnotherPersonChange.type, ChangeType.Splice);
//                             assert.equal(secondAnotherPersonChange.collection, 'myCollection');
//                             assert.equal(secondAnotherPersonChange.mapping, 'Person');
//                             assert.equal(secondAnotherPersonChange._id, anotherPerson._id);
//                             assert.equal(secondAnotherPersonChange.field, 'cars');
//                             assert.equal(secondAnotherPersonChange.removed.length, 1);
//                             assert.include(secondAnotherPersonChange.removed, car);
//                             assert.equal(secondAnotherPersonChange.removedId.length, 1);
//                             assert.include(secondAnotherPersonChange.removedId, car._id);
//                             assert.equal(secondAnotherPersonChange.type, ChangeType.Delete);
//                             assert.equal(secondCarChange.collection, 'myCollection');
//                             assert.equal(secondCarChange.mapping, 'Car');
//                             assert.equal(secondCarChange._id, car._id);
//                             assert.equal(secondCarChange.field, 'owner');
//                             assert.equal(secondCarChange.newId, person._id);
//                             assert.equal(secondCarChange.oldId, anotherPerson._id);
//                             assert.equal(secondCarChange.new, person);
//                             // Due to fault.
//                             assert.notOk(secondCarChange.old);
//                             assert.equal(secondCarChange.type, ChangeType.Set);
//                             assert.equal(firstCarChange.collection, 'myCollection');
//                             assert.equal(firstCarChange.mapping, 'Car');
//                             assert.equal(firstCarChange._id, car._id);
//                             assert.equal(firstCarChange.field, 'owner');
//                             assert.equal(firstCarChange.newId, anotherPerson._id);
//                             assert.equal(firstCarChange.new, anotherPerson);
//                             assert.notOk(firstCarChange.old);
//                             assert.notOk(firstCarChange.oldId);
//                             assert.equal(firstCarChange.type, ChangeType.Set);
//                         });

//                     });
//                 });


//             });
//         });



//     });

//     describe('many to many', function () {
//         var carProxy, personProxy;
//         var car, person;

//         describe('get', function () {
//             beforeEach(function () {
//                 carProxy = new ManyToManyProxy({
//                     reverseMapping: personMapping,
//                     forwardMapping: carMapping,
//                     reverseName: 'cars',
//                     forwardName: 'owners'
//                 });
//                 personProxy = new ManyToManyProxy({
//                     reverseMapping: personMapping,
//                     forwardMapping: carMapping,
//                     reverseName: 'cars',
//                     forwardName: 'owners'
//                 });
//                 car = new SiestaModel(carMapping);
//                 car._id = 'car';
//                 carProxy.install(car);
//                 person = new SiestaModel(personMapping);
//                 person._id = 'person';
//                 personProxy.install(person);
//                 cache.insert(person);
//                 cache.insert(car);
//             });


//         });

//         describe('set', function () {
//             var carProxy, personProxy;
//             var car, person;
//             beforeEach(function () {
//                 carProxy = new ManyToManyProxy({
//                     reverseMapping: personMapping,
//                     forwardMapping: carMapping,
//                     reverseName: 'cars',
//                     forwardName: 'owners'
//                 });
//                 personProxy = new ManyToManyProxy({
//                     reverseMapping: personMapping,
//                     forwardMapping: carMapping,
//                     reverseName: 'cars',
//                     forwardName: 'owners'
//                 });
//                 car = new SiestaModel(carMapping);
//                 car._id = 'car';
//                 carProxy.install(car);
//                 carProxy.isFault = false;
//                 person = new SiestaModel(personMapping);
//                 person._id = 'person';
//                 personProxy.install(person);
//                 personProxy.isFault = false;
//             });

//             describe('pre-existing', function () {

//                 var anotherPerson, anotherPersonProxy;

//                 beforeEach(function () {
//                     anotherPerson = new SiestaModel(personMapping);
//                     anotherPerson._id = 'anotherPerson';
//                     anotherPersonProxy = new ManyToManyProxy({
//                         reverseMapping: personMapping,
//                         forwardMapping: carMapping,
//                         reverseName: 'cars',
//                         forwardName: 'owners'
//                     });
//                     anotherPersonProxy.install(anotherPerson);
//                     anotherPersonProxy.isFault = false;
//                     cache.insert(anotherPerson);
//                     cache.insert(person);
//                     cache.insert(car);
//                 });

//                 describe('no fault', function () {
//                     beforeEach(function () {
//                         car.owners = [anotherPerson];
//                     });

//                     describe('forward', function () {
//                         it('generates correct s.ext.storage.changes', function () {
//                             car.owners = [person];
//                             var carChanges = s.ext.storage.changes.changesForIdentifier(car._id);
//                             assert.equal(carChanges.length, 2);
//                             var personChanges = s.ext.storage.changes.changesForIdentifier(person._id);
//                             assert.equal(personChanges.length, 1);
//                             var anotherPersonChanges = s.ext.storage.changes.changesForIdentifier(anotherPerson._id);
//                             assert.equal(anotherPersonChanges.length, 2);
//                             var personChange = personChanges[0];
//                             var firstCarChange = carChanges[0];
//                             var secondCarChange = carChanges[1];
//                             var firstAnotherPersonChange = anotherPersonChanges[0];
//                             var secondAnotherPersonChange = anotherPersonChanges[1];
//                             assert.equal(personChange.collection, 'myCollection');
//                             assert.equal(personChange.mapping, 'Person');
//                             assert.equal(personChange._id, person._id);
//                             assert.equal(personChange.field, 'cars');
//                             assert.equal(personChange.index, 0);
//                             assert.equal(personChange.addedId.length, 1);
//                             assert.include(personChange.addedId, car._id);
//                             assert.equal(personChange.added.length, 1);
//                             assert.include(personChange.added, car);
//                             assert.equal(personChange.type, ChangeType.Splice);
//                             assert.equal(firstAnotherPersonChange.collection, 'myCollection');
//                             assert.equal(firstAnotherPersonChange.mapping, 'Person');
//                             assert.equal(firstAnotherPersonChange._id, anotherPerson._id);
//                             assert.equal(firstAnotherPersonChange.field, 'cars');
//                             assert.equal(firstAnotherPersonChange.index, 0);
//                             assert.equal(firstAnotherPersonChange.addedId.length, 1);
//                             assert.include(firstAnotherPersonChange.addedId, car._id);
//                             assert.equal(firstAnotherPersonChange.added.length, 1);
//                             assert.include(firstAnotherPersonChange.added, car);
//                             assert.equal(firstAnotherPersonChange.removed.length, 0);
//                             assert.equal(firstAnotherPersonChange.type, ChangeType.Splice);
//                             assert.equal(secondAnotherPersonChange.collection, 'myCollection');
//                             assert.equal(secondAnotherPersonChange.mapping, 'Person');
//                             assert.equal(secondAnotherPersonChange._id, anotherPerson._id);
//                             assert.equal(secondAnotherPersonChange.field, 'cars');
//                             assert.equal(secondAnotherPersonChange.index, 0);
//                             assert.equal(secondAnotherPersonChange.added.length, 0);
//                             assert.equal(secondAnotherPersonChange.removedId.length, 1);
//                             assert.include(secondAnotherPersonChange.removedId, car._id);
//                             assert.equal(secondAnotherPersonChange.removed.length, 1);
//                             assert.include(secondAnotherPersonChange.removed, car);
//                             assert.equal(secondAnotherPersonChange.type, ChangeType.Splice);
//                             assert.equal(secondCarChange.collection, 'myCollection');
//                             assert.equal(secondCarChange.mapping, 'Car');
//                             assert.equal(secondCarChange._id, car._id);
//                             assert.equal(secondCarChange.field, 'owners');
//                             assert.equal(secondCarChange.old.length, 1);
//                             assert.equal(secondCarChange.new.length, 1);
//                             assert.include(secondCarChange.new, person);
//                             assert.equal(secondCarChange.newId.length, 1);
//                             assert.include(secondCarChange.newId, person._id);
//                             assert.equal(secondCarChange.type, ChangeType.Set);
//                             assert.equal(firstCarChange.collection, 'myCollection');
//                             assert.equal(firstCarChange.mapping, 'Car');
//                             assert.equal(firstCarChange._id, car._id);
//                             assert.equal(firstCarChange.field, 'owners');
//                             assert.equal(firstCarChange.new.length, 1);
//                             assert.include(firstCarChange.new, anotherPerson);
//                             assert.equal(firstCarChange.newId.length, 1);
//                             assert.include(firstCarChange.newId, anotherPerson._id);
//                             assert.notOk(firstCarChange.old);
//                             assert.notOk(firstCarChange.oldId);
//                             assert.equal(firstCarChange.type, ChangeType.Set);
//                         });

//                     });

//                     describe('backwards', function () {
//                         it('generates correct s.ext.storage.changes', function () {
//                             person.cars = [car];
//                             var carChanges = s.ext.storage.changes.changesForIdentifier(car._id);
//                             assert.equal(carChanges.length, 2);
//                             var personChanges = s.ext.storage.changes.changesForIdentifier(person._id);
//                             assert.equal(personChanges.length, 1);
//                             var anotherPersonChanges = s.ext.storage.changes.changesForIdentifier(anotherPerson._id);
//                             assert.equal(anotherPersonChanges.length, 1);
//                             var personChange = personChanges[0];
//                             var firstCarChange = carChanges[0];
//                             var secondCarChange = carChanges[1];
//                             var firstAnotherPersonChange = anotherPersonChanges[0];
//                             assert.equal(personChange.collection, 'myCollection');
//                             assert.equal(personChange.mapping, 'Person');
//                             assert.equal(personChange._id, person._id);
//                             assert.equal(personChange.field, 'cars');
//                             assert.notOk(personChange.old);
//                             assert.equal(personChange.new.length, 1);
//                             assert.include(personChange.new, car);
//                             assert.equal(personChange.newId.length, 1);
//                             assert.include(personChange.newId, car._id);
//                             assert.equal(personChange.type, ChangeType.Set);
//                             assert.equal(firstAnotherPersonChange.type, ChangeType.Splice);
//                             assert.equal(firstAnotherPersonChange.collection, 'myCollection');
//                             assert.equal(firstAnotherPersonChange.mapping, 'Person');
//                             assert.equal(firstAnotherPersonChange._id, anotherPerson._id);
//                             assert.equal(firstAnotherPersonChange.field, 'cars');
//                             assert.equal(firstAnotherPersonChange.index, 0);
//                             assert.equal(firstAnotherPersonChange.addedId.length, 1);
//                             assert.include(firstAnotherPersonChange.addedId, car._id);
//                             assert.equal(firstAnotherPersonChange.added.length, 1);
//                             assert.include(firstAnotherPersonChange.added, car);
//                             assert.equal(firstAnotherPersonChange.removed.length, 0);
//                             assert.equal(firstAnotherPersonChange.removedId.length, 0);
//                             assert.equal(secondCarChange.collection, 'myCollection');
//                             assert.equal(secondCarChange.mapping, 'Car');
//                             assert.equal(secondCarChange._id, car._id);
//                             assert.equal(secondCarChange.field, 'owners');
//                             assert.equal(secondCarChange.index, 1);
//                             assert.equal(secondCarChange.type, ChangeType.Splice);
//                             assert.include(secondCarChange.added, person);
//                             assert.include(secondCarChange.addedId, person._id);
//                             assert.equal(firstCarChange.collection, 'myCollection');
//                             assert.equal(firstCarChange.mapping, 'Car');
//                             assert.equal(firstCarChange._id, car._id);
//                             assert.equal(firstCarChange.field, 'owners');
//                             assert.include(firstCarChange.new, anotherPerson);
//                             assert.include(firstCarChange.newId, anotherPerson._id);
//                             assert.notOk(firstCarChange.old);
//                             assert.notOk(firstCarChange.oldId);
//                             assert.equal(firstCarChange.type, ChangeType.Set);
//                         });
//                     });
//                 });

//                 describe('fault', function () {
//                     beforeEach(function () {
//                         car.owners = [anotherPerson];
//                         carProxy.related = undefined;
//                         anotherPersonProxy.related = undefined;
//                     });
//                     describe('forward', function () {
//                         it('generates correct s.ext.storage.changes', function () {
//                             car.owners = [person];
//                             var carChanges = s.ext.storage.changes.changesForIdentifier(car._id);
//                             assert.equal(carChanges.length, 2);
//                             var personChanges = s.ext.storage.changes.changesForIdentifier(person._id);
//                             assert.equal(personChanges.length, 1);
//                             var anotherPersonChanges = s.ext.storage.changes.changesForIdentifier(anotherPerson._id);
//                             assert.equal(anotherPersonChanges.length, 2);
//                             var personChange = personChanges[0];
//                             var firstCarChange = carChanges[0];
//                             var secondCarChange = carChanges[1];
//                             var firstAnotherPersonChange = anotherPersonChanges[0];
//                             var secondAnotherPersonChange = anotherPersonChanges[1];
//                             assert.equal(personChange.type, ChangeType.Splice);
//                             assert.equal(personChange.collection, 'myCollection');
//                             assert.equal(personChange.mapping, 'Person');
//                             assert.equal(personChange._id, person._id);
//                             assert.equal(personChange.field, 'cars');
//                             assert.equal(personChange.index, 0);
//                             assert.equal(personChange.addedId.length, 1);
//                             assert.include(personChange.addedId, car._id);
//                             assert.equal(personChange.added.length, 1);
//                             assert.include(personChange.added, car);
//                             assert.equal(firstAnotherPersonChange.type, ChangeType.Splice);
//                             assert.equal(firstAnotherPersonChange.collection, 'myCollection');
//                             assert.equal(firstAnotherPersonChange.mapping, 'Person');
//                             assert.equal(firstAnotherPersonChange._id, anotherPerson._id);
//                             assert.equal(firstAnotherPersonChange.field, 'cars');
//                             assert.equal(firstAnotherPersonChange.index, 0);
//                             assert.equal(firstAnotherPersonChange.added.length, 1);
//                             assert.equal(firstAnotherPersonChange.removed.length, 0);
//                             assert.equal(firstAnotherPersonChange.addedId.length, 1);
//                             assert.equal(firstAnotherPersonChange.removedId.length, 0);
//                             assert.include(firstAnotherPersonChange.addedId, car._id);
//                             assert.include(firstAnotherPersonChange.added, car);
//                             assert.equal(secondAnotherPersonChange.type, ChangeType.Delete);
//                             assert.equal(secondAnotherPersonChange.collection, 'myCollection');
//                             assert.equal(secondAnotherPersonChange.mapping, 'Person');
//                             assert.equal(secondAnotherPersonChange._id, anotherPerson._id);
//                             assert.equal(secondAnotherPersonChange.field, 'cars');
//                             assert.equal(secondAnotherPersonChange.removed.length, 1);
//                             assert.include(secondAnotherPersonChange.removed, car);
//                             assert.equal(secondAnotherPersonChange.removedId.length, 1);
//                             assert.include(secondAnotherPersonChange.removedId, car._id);
//                             assert.equal(secondCarChange.type, ChangeType.Set);
//                             assert.equal(secondCarChange.collection, 'myCollection');
//                             assert.equal(secondCarChange.mapping, 'Car');
//                             assert.equal(secondCarChange._id, car._id);
//                             assert.equal(secondCarChange.field, 'owners');
//                             assert.equal(secondCarChange.oldId.length, 1);
//                             assert.equal(secondCarChange.newId.length, 1);
//                             assert.include(secondCarChange.new, person);
//                             assert.include(secondCarChange.newId, person._id);
//                             assert.equal(firstCarChange.type, ChangeType.Set);
//                             assert.equal(firstCarChange.collection, 'myCollection');
//                             assert.equal(firstCarChange.mapping, 'Car');
//                             assert.equal(firstCarChange._id, car._id);
//                             assert.equal(firstCarChange.field, 'owners');
//                             assert.equal(firstCarChange.new.length, 1);
//                             assert.equal(firstCarChange.newId.length, 1);
//                             assert.include(firstCarChange.new, anotherPerson);
//                             assert.include(firstCarChange.newId, anotherPerson._id);
//                             assert.notOk(firstCarChange.old);
//                             assert.notOk(firstCarChange.oldId);
//                         });

//                     });

//                     describe('backwards', function () {
//                         it('generates correct s.ext.storage.changes', function () {
//                             person.cars = [car];
//                             var carChanges = s.ext.storage.changes.changesForIdentifier(car._id);
//                             assert.equal(carChanges.length, 2);
//                             var personChanges = s.ext.storage.changes.changesForIdentifier(person._id);
//                             assert.equal(personChanges.length, 1);
//                             var anotherPersonChanges = s.ext.storage.changes.changesForIdentifier(anotherPerson._id);
//                             assert.equal(anotherPersonChanges.length, 1);
//                             var personChange = personChanges[0];
//                             var firstCarChange = carChanges[0];
//                             var secondCarChange = carChanges[1];
//                             var firstAnotherPersonChange = anotherPersonChanges[0];
//                             assert.equal(personChange.type, ChangeType.Set);
//                             assert.equal(personChange.collection, 'myCollection');
//                             assert.equal(personChange.mapping, 'Person');
//                             assert.equal(personChange._id, person._id);
//                             assert.equal(personChange.field, 'cars');
//                             assert.notOk(personChange.old);
//                             assert.equal(personChange.new.length, 1);
//                             assert.equal(personChange.newId.length, 1);
//                             assert.include(personChange.newId, car._id);
//                             assert.include(personChange.new, car);
//                             assert.equal(firstAnotherPersonChange.type, ChangeType.Splice);
//                             assert.equal(firstAnotherPersonChange.collection, 'myCollection');
//                             assert.equal(firstAnotherPersonChange.mapping, 'Person');
//                             assert.equal(firstAnotherPersonChange._id, anotherPerson._id);
//                             assert.equal(firstAnotherPersonChange.field, 'cars');
//                             assert.equal(firstAnotherPersonChange.index, 0);
//                             assert.equal(firstAnotherPersonChange.added.length, 1);
//                             assert.equal(firstAnotherPersonChange.addedId.length, 1);
//                             assert.include(firstAnotherPersonChange.addedId, car._id);
//                             assert.include(firstAnotherPersonChange.added, car);
//                             assert.equal(firstAnotherPersonChange.removed.length, 0);
//                             assert.equal(firstAnotherPersonChange.removedId.length, 0);
//                             assert.equal(secondCarChange.type, ChangeType.Splice);
//                             assert.equal(secondCarChange.collection, 'myCollection');
//                             assert.equal(secondCarChange.mapping, 'Car');
//                             assert.equal(secondCarChange._id, car._id);
//                             assert.equal(secondCarChange.field, 'owners');
//                             assert.equal(secondCarChange.index, 1);
//                             assert.include(secondCarChange.addedId, person._id);
//                             assert.include(secondCarChange.added, person);
//                             assert.equal(firstCarChange.type, ChangeType.Set);
//                             assert.equal(firstCarChange.collection, 'myCollection');
//                             assert.equal(firstCarChange.mapping, 'Car');
//                             assert.equal(firstCarChange._id, car._id);
//                             assert.equal(firstCarChange.field, 'owners');
//                             assert.include(firstCarChange.new, anotherPerson);
//                             assert.include(firstCarChange.newId, anotherPerson._id);
//                             assert.notOk(firstCarChange.old);
//                             assert.notOk(firstCarChange.oldId);
//                         });


//                     });

//                 });



//             });
//         })


//     });
// });

