---
layout: index
title: Fount
---

<div>
  <p class="lead">
    <strong>Siesta</strong> is an object mapping framework for Javascript. It makes it easier to model, consume and 
    interact with RESTful web services.
</p>
<hr/>

The main idea behind Siesta is that models should have a **single source of truth** - that is - only one local object should
ever represent a remote resource.

You can think of it as an ORM, except that rather than mapping rows to and from a relational database onto
objects in memory we are mapping JSON data representing remote resources.

Siesta provides a declarative API through which we describe the web services that we are going to interact with.
When data is received from these web services, each object is mapped onto its corresponding local
representation including any nested related objects.

Siesta then presents powerful ways in which to query and store (thanks to PouchDB) local objects in a 
browser-agnostic fashion, reducing the number of HTTP requests that need to be sent.

###The Problem

As ever, the best way to explain is by example.

Let's say we're interacting with a web service describing vehicles and their owners. We fire off a request
to obtain Mike's user details.

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

And we notice that since our last query, our Bentley has been painted red!

Using traditional methods of interacting with web services we would now 
have two Javascript objects representing our Bentley with id `11`:

```javascript
userData.cars[0] === carData; // False
```

And worst of all:

```javascript
console.log(userData.cars[0].colour); // Black
console.log(carData.colour); // Red
```

So not only do we have **two** distinct live objects representing the same remote resource, but one of those
objects is now out of sync - we have two sources of truth, and one of those sources is lying to us!

###The Solution

Siesta solves this issue through the use of object mapping. A **mapping**
describes the remote object that we're modeling. A **collection** groups mappings. For example we could
have a collection for each web service with which we are interacting.

```javascript
var collection = new Collection('MyCollection');

var User = collection.mapping({
    id: 'username'
});
                                   
var Car = collection.mapping({
    id: 'id',
    attributes: [
        "colour",
        "model",
        {
            mapping: User,
            reverse: 'cars'
        }
    ]
});
```

And then we can start mapping data into our collection:

```javascript
User.map(user, function (userObject) {
    Car.map(car, function (carObject) {
        userObject.cars[0] === carObject; // true
    });
});
```

###Anything Else?

Siesta sits on top of the awesome <a href="http://pouchdb.com/">PouchDB</a> and as such benefits from:

* Persistence
* Synchronisation
* Powerful local query mechanisms
* Support for multiple local storage mechanisms across browsers

See the <a href="{{site.baseurl}}/docs.html" >documentation</a> for more info
on how to best use of both Siesta and PouchDB in your applications.

<hr/>
