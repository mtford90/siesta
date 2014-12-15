---
layout: index
title: Siesta
---

<div>
  <p class="lead">
    <strong>Siesta</strong> is an object graph framework for Javascript. It makes it easier to model, consume and interact with RESTful web services.
</p>
<hr/>

The main idea behind Siesta is that models should have a **single source of truth** - that is - only one local object should ever represent a remote resource.

A traditional ORM maps rows from a relational database to objects. Siesta maps objects to and from data transport formats (e.g. JSON) and replaces the SQL queries with HTTP requests.

As well as providing the ability to map arbitrary data onto the object graph, siesta features a declarative API through which we describe the web services that we'd like to interact with. When data is received from these web services, each object is mapped onto its corresponding local representation *including* any nested related objects.

Siesta aims to cover **M** in **M**VC and takes inspiration from:

* [CoreData](https://developer.apple.com/library/mac/documentation/Cocoa/Conceptual/CoreData/cdProgrammingGuide.html)
* [RestKit](http://restkit.org/)

Similar projects to Siesta:

* [Ember Data](https://github.com/emberjs/data) - Data persistence for EmberJS. Siesta aims to be less abstraction heavy and framework agnostic.

###The Problem

As ever, this problem is best explained through an example.

Let's say we're interacting with an API provided by a forum application. The API provides the ability to query for users and threads.

We fire off a request to obtain details for the user `mike`:

```javascript
// GET /users/mike/
var userData = {
    "id": 1,
    "username": "mike",
    "email": "mike@hotmail.com",
    "threads": [{
        "id": 2,
        "title": "hello world!"
     }]
}
```

We then make another query for the thread that Mike started with id `2`.

```javascript
// GET /threads/2/
var threadData = {
    "id": 2,
    "title": "Hello World",
    "op": {
        "id": 1,
        "username": "mike",
        "email": "mike@gmail.com"
    }
}
```

Notice that since our last query, the thread has changed name and `mike` changed his email.

Using traditional methods of interacting with web services we would now have two local representations of `mike` and his thread.

```javascript
userData.threads[0] === threadData; // False
userData === threadData.op; // False
```

And worst of all:

```javascript
console.log(userData.threads[0].title); // hello world!
console.log(threadData.title); // Hello World
console.log(userData.email); // mike@hotmail.com
console.log(threadData.op.email); // mike@gmail.com
```

So not only do we now have **two** distinct live objects representing each remote resource, but one of those objects is now out of sync - we have two sources of truth, and one of those sources is blatantly lying to us.

###The Solution

Siesta solves this issue through the use of object mapping. A **mapping** describes the remote object that we want to model. A **collection** groups together these mappings. For example we could have define a collection to represent each web service that we will interact with.

```javascript
var Forum = new Collection('Forum');

var User = Forum.mapping({
    name: 'User',
    attributes: ['username', 'email']
});
                                   
var Thread = Forum.mapping({
    name: 'Thread',
    attributes: ['title']
    relationships: {
        op: {
              mapping: User,
              reverse: 'threads'
        }
    }
});
```

We can then map the raw data into Siesta, which will use the mappings we defined early to decide which data should to which local object. 

```javascript
User.map(userData, function (user) {
    Thread.map(threadData, function (thread) {
        user.threads[0] === thread; // true
        user === thread.op; // true
    });
});
```

We now have one local representation for each remote representation! Note that we will rarely need to map data ourselves. Siesta provides an API for sending and receiving HTTP requests and performing the mapping automatically, regardless of `Content-Type` etc. You can read more about this in the <a href="{{site.baseurl}}/remote_queries.html">documentation</a>.

###What next?

Visit our <a href="{{site.baseurl}}/docs.html">Getting Started</a> guide which will walk you through installing and configuring Siesta.</br>