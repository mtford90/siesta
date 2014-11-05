---
layout: index
title: Fount
---

<div>
  <p class="lead">
    <strong>Siesta</strong> is an object mapping framework for Javascript. It makes it easier to model, consume and interact with RESTful web services.
</p>
<hr/>

The main idea behind Siesta is that models should have a **single source of truth** - that is - only one local object should ever represent a remote resource.

A traditional ORM maps rows from a relational database to objects. Siesta maps objects to and from data transport formats (e.g. JSON) and replaces the SQL queries with HTTP requests.

Siesta provides a declarative API through which we describe the web services that we'd like to interact with. When data is received from these web services, each object is mapped onto its corresponding local representation *including* any nested related objects. 

Siesta aims to cover **M** in **M**VC and takes inspiration from:



###The Problem

As ever, this problem is best explained through an example.

Let's say we're interacting with a web service describing vehicles and their owners. We fire off a request to obtain Mike's user details:

```javascript
// GET /users/Mike/
var userData = {
    "username": "Mike",
    "cars": [
        {"model": "Bentley", "colour":"Black", id: 11},
        {"model": "Aston Martin", "colour": "Gray", id:12}
     ]
}
```

We then query again for Mike's Bentley and receive the following:

```javascript
// GET /cars/11/
var carData = {
    "model": "Bentley", 
    "colour": "Red", 
    "id": 11,
    "owner": {"username": "Mike", "id": 10}
}
```

Notice that since our last query, Mike's Bentley has been painted red.

Using traditional methods of interacting with web services we would now have two Javascript objects representing our Bentley with id `11`. One is nested in the user object we received from our first request, and the second is the result of our second request:

```javascript
userData.cars[0] === carData; // False
```

And worst of all:

```javascript
console.log(userData.cars[0].colour); // Black
console.log(carData.colour); // Red
```

So not only do we now have **two** distinct live objects representing the same remote resource, but one of those objects is now out of sync - we have two sources of truth, and one of those sources is blatantly lying to us.

###The Solution

Siesta solves this issue through the use of object mapping. A **mapping** describes the remote object that we want to model. A **collection** groups together these mappings. For example we could have define a collection to represent each web service that we will interact with.

```javascript
var collection = new Collection('MyCollection');

var User = collection.mapping({
    name: 'User',
    id: 'username'
});
                                   
var Car = collection.mapping({
    name: 'Car',
    id: 'id',
    attributes: [
        "colour",
        "model"
    ],
    relationships: {
        owner: {
              mapping: User,
              reverse: 'cars'
        }
    }
});
```

We can then map the raw data into Siesta, which will use the mappings we defined early to decide which data should to which local object. 

```javascript
User.map(userData, function (userObject) {
    Car.map(carData, function (carObject) {
        console.log(userObject.cars[0] === carObject); // true
        console.log(userObject.cars[0].colour; // "red"
    });
});
```

**Note:** we will rarely need to map data ourselves. Siesta provides an API for sending and receiving HTTP requests and performing the mapping automatically, regardless of `Content-Type` etc. You can read more about this in the <a href="{{site.baseurl}}/remote_queries.html">documentation</a>.

###What next?

Visit our <a href="{{site.baseurl}}/docs.html">Getting Started</a> guide which will walk you through installing and configuring Siesta.</br>
