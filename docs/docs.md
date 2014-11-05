---
layout: Getting_Started
title: Getting Started
sidebar: nav2.html
---

## {{page.title}}

This guide will get you up and running with Siesta with minimal effort.

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
var collection = new siesta.Collection('MyCollection');
collection.baseURL = 'http://api.mysite.com';
```

### Step 3: Configure object mappings

The mapping is the Siesta equivalent to models in traditional database ORMs. It describes how attributes and relationships in resources are mapped onto Javascript objects.

A simple mapping will only declare attributes:

```javascript
collection.mapping('Person', {
    attributes: ['name', 'age']
});
```

A more complex mapping will define relationships with others:

```javascript
collection.mapping('Car', {
    // The field that uniquely identifies a Car object.
    id: 'id',
    // Attributes represent simple data types such as strings and integers.
    attributes: ['model', 'colour', 'licensePlate'],
    // Relationships with other remote objects. 
    // In this case a Car has an owner, and a Person can own many cars.
    relationships: {
        owner: {
            mapping: 'Person',
            type: 'OneToMany',
            reverse: 'cars' 
        }
    }
});
```

### Step 4: Configure request/response descriptors

Descriptors are a component within the HTTP module and are used to *describe* web services with which we want to interact. When a HTTP request is sent, the descriptors are used to automatically map data to and from the correct mappings as well determining how to serialise outgoing objects.

```javascript
collection.descriptor({
    path: 'cars/',
    method: 'POST',
    mapping: 'Car'
});
```

A more complex descriptor could include attributes in the path which can be a regular expression with named groups. The values of these matches will be mapped onto the object that is sent/received.

```javascript
collection.descriptor({
    path: 'cars/(?P<id>)/'
    method: ['PUT', 'PATCH'],
    mapping: 'Car',
    data: 'data' // Serialise to {data: {...}} when sending the request.
});
```

```javascript
collection.descriptor({
    path: 'cars/(.*)/',
    // Accept any HTTP method
    method: 'GET', 
    mapping: 'Car',
    // Deserialise from data field in JSON response when receiving.
    data: 'data' 
});
```

### Step 5: Install the collection

Before we can use our collection we need to install it. This will configure the descriptors and mappings, hooking up any relationships and will return an error if anything is incorrect with the declarations.

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

The descriptors declared earlier will be used to determine how to map the response bodies onto objects that we have locally.

```javascript
collection.GET('cars/').then(function (cars) {
    console.log('I got me some cars!', cars);
});

collection.GET('cars/5').then(function (car) {
    console.log('I got me a car!', car);
});
```

### Step 6: Create some remote data

The descriptors declared above will also be used to determine how to serialise our models when sending them to the server.

```javascript
Person.map({name: 'Bob'}).then(function (person){
    collection.POST('people/', person, function (err) {
        // Done.
    });
});
```

### Step 7: Query local data

We can query for objects that have been mapped and held locally (either in-memory or persisted) by using the local query API.

```js

collection.Car.all().then(function (allCars) {
    // ...
});

collection.Car.query({colour: 'Red'}).then(function (redCars) {
    // ...
});

collection.Person.query({age__lt: 30}).then(function (peopleUnderThirty) {
    // ...
});

```