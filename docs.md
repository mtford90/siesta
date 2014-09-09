---
layout: Getting_Started
title: Getting Started
sidebar: nav2.html
---

## Getting Started

This guide will get you up and running quickly.

### Step 1: Installation

TODO

### Step 2: Create a collection

A `Collection` describes a set of models and optionally a Rest API with which we want to communicate to get instances
of those models.

```javascript
var collection = new Collection('MyCollection');
collection.baseURL = 'http://api.mysite.com';
```

### Step 3: Configure object mappings

A simple mapping will just declare attributes:

```javascript
collection.mapping('Person', {
    attributes: ['name', 'age']
});
```

A more complex mapping will declare the remote `id` that uniquely identifies it, relationships with other mappings
as well as indexes:

```javascript
collection.mapping('Car', {
    id: 'id',
    relationships: {
        owner: {
            mapping: 'Person',
            type: RelationshipType.ForeignKey,
            reverse: 'cars' // Will show up on Person objects
        }
    },
    attributes: ['model', 'colour', 'licensePlate'],
    indexes: ['colour'] // id is automatically indexed
});
```

### Step 4: Configure request/response descriptors

A descriptor describes the remote API from which we pull instances of our models. A descriptor can either describe
a HTTP request:

```javascript
collection.requestDescriptor({
    path: 'cars/',
    method: 'POST',
    mapping: 'Car'
});
```

A more complex request descriptor could include attributes in the path which can be a regular expression with named
groups. The values of these matches will be mapped onto the object that is sent/received.

```javascript
collection.registerRequestDescriptor({
    path: 'cars/(?P<id>)/'
    method: 'PUT',
    mapping: 'Car'
    data: 'data' // Serialise to {data: {...}} when sending the request.
});
```

Response descriptors are almost identical, however will be used in HTTP responses rather than requests

```javascript
collection.registerResponseDescriptor({
    path: 'cars/(.*)/',
    method: '*', // Any method
    mapping: 'Car',
    data: 'data' // Deserialise from data field in JSON response when receiving.
});
```

### Step 5: Install the collection

```javascript
collection.install(function (err) {
    // ... Installs indexes etc.
});
```

### Step 5: Obtain some remote data

The response descriptors declared earlier will be used to determine how to map the response bodies onto objects
that we have locally.

```javascript
collection.GET('cars/', function (err, cars) {
    console.log('I got me some cars!', cars);
});

collection.GET('cars/5', function (err, car) {
    console.log('I got me a car!', car);
});
```

### Step 6: Create some remote data

The request descriptors declared above will be used to determine how to serialise our models when sending them to 
the server.

```javascript
var person = new collection.Person({name: 'Michael'});

collection.POST('people/', person, function (err) {
    // Done.
});

// ... which is equivalent to

person.POST('people/', function (err) {

});

```

### Step 7: Query local data

We can query for objects that have been mapped and held locally (either in-memory or persisted) by using the local
query API.

```javascript

collection.Car.all(function (err, allCars) {
    // ... all cars.
});

collection.Car.query({colour: 'Red'}, function (err, redCars) {
    // This query will be faster if we specify that colour should be indexed when creating the mappings.
});

```