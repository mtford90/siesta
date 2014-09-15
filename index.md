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

###Why?
The main idea behind Siesta is that models should have a **single source of truth** and the belief that anything
less than this leads to confusion and race conditions when developing complex front-end applications.

Siesta is heavily inspired by Core Data and RESTKit in this respect.

###What?

As ever the best way to explain is by example.

Let's say we're interacting with a web service and receive the following response when querying for a user:

```javascript
var userData = {
    "username": "mike",
    "id": 10
    "cars": [
        {"model": "Bentley", "colour":"Black", id: 11},
        {"model": "Aston Martin", "colour": "Gray", id:12}
     ]
}
```

We then query again for the Bentley and receive the following:

```javascript
var carData = {
    "model": "Bentley", 
    "colour": "Red", 
    "id": 11,
    "owner": {"username": "mike", "id": 10}
}
```

And we notice that since our last query, our Bentley has been painted red!

Using traditional methods of interacting with web services we would now 
have two Javascript objects representing our Bentley with id `11`:

```javascript
user.cars[0] === car; // False
```

And worst of all:

```javascript
console.log(user.cars[0].colour); // Black
console.log(car.colour); // Red
```

So not only do we have **two** distinct live objects representing the same remote resource, but one of those
objects is now out of sync - we have two sources of truth, and one of those sources is lying to us.

###How?

Siesta solves the issue of maintaining a single source of truth through the use of object mapping. A **mapping**
describes the remote object that we're modeling:

```javascript
var collection = new Collection('MyCollection');

var User = collection.mapping({
    id: 'id',
    attributes: ["username"]
});
                                   
var Car = collection.mapping({
    id: 'id',
    attributes: ["colour", "model"],
    relationships: {
        owner: {
            mapping: User,
            reverse: 'cars'
        }
    }
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
