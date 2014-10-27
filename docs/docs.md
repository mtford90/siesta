---
layout: Getting_Started
title: Getting Started
sidebar: nav2.html
---

## {{page.title}}

This guide will get you up and running quickly with minimal effort.

### Step 1: Installation

You can use the below code to include the entire Siesta bundle:

```html
<html>
<body>
<script src="https://github.com/mtford90/siesta/releases/download/{{site.version}}/siesta.bundle.min.js"></script>
</body>
</html>
```

If you prefer to pick and choose the components that you want to use, head to the 
<a href="{{site.baseurl}}/download.html">download</a> page for other options.

### Step 2: Create a collection

A `Collection` describes a set of models and optionally a REST API containing the resources the collection will represent.

```javascript
var collection = new Collection('MyCollection');
collection.baseURL = 'http://api.mysite.com';
```

### Step 3: Configure object mappings

The mapping is the Siesta equivalent to models in traditional database ORMs. It describes 
how attributes and relationships in resources are mapped onto Javascript objects.


A simple mapping will only declare attributes:

```javascript
collection.mapping('Person', {
    attributes: ['name', 'age']
});
```

A more complex mapping:

```javascript
collection.mapping('Car', {
    // The field that uniquely identifies a Car object.
    id: 'id',
    // Relationships with other remote objects. 
    // In this case a Car has an owner, and a Person can own many cars.
    relationships: {
        owner: {
            mapping: 'Person',
            type: 'ForeignKey',
            reverse: 'cars' 
        }
    },
    // Attributes represent simple data types such as strings and integers.
    attributes: ['model', 'colour', 'licensePlate'],
    // If our application will be querying a field, we can create a (PouchDB) index to speed things up.
    // Note that this is only useful if using the Siesta storage module.
    indexes: ['colour']
});
```

### Step 4: Configure request/response descriptors

Descriptors are a component within the HTTP module and are used to *describe* web services with which
we want to interact. When a HTTP request is sent, the descriptors are used to automatically map data
to and from the correct mappings.

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
collection.requestDescriptor({
    path: 'cars/(?P<id>)/'
    method: 'PUT',
    mapping: 'Car',
    data: 'data' // Serialise to {data: {...}} when sending the request.
});
```

Response descriptors are almost identical, however will be used in HTTP responses rather than requests

```javascript
collection.responseDescriptor({
    path: 'cars/(.*)/',
    // Accept any HTTP method
    method: '*', 
    mapping: 'Car',
    // Deserialise from data field in JSON response when receiving.
    data: 'data' 
});
```

### Step 5: Install the collection

Before we can use our collection we need to install it. If the storage module is in use
then this ensures that indexes are installed and the database is setup among other things.

```javascript
collection.install(function (err) {
    if (err) { 
        // Handle error.
    }
    else {
        // Do stuff.
    }
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