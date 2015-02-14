# Siesta

<p class='brief'>
    Siesta is an object graph & life cycle management framework for Javascript. In english, Siesta makes it easy to model, consume and interact with relational data in the browser.
</p>

<img src="img/main.png">

The [object graph](docs.html#concepts-object-graph) provides a robust mechanism through which we can represent (possibly remote) resources in the browser, ensuring that each resource has a **single source of truth** - that is - only one object should ever represent a resource.

One way to think about Siesta is in the context of traditional **O**bject **R**elational **M**appers. A traditional ORM maps rows from a relational database to objects in an object oriented language. Siesta maps objects to and from data transport formats and other Javascript objects.

Backed by PouchDB Siesta can take advantage of various [client-side storage](docs.html#storage) solutions in the browser.

Inspired by concepts from Functional Reactive Programming and the Flux architecture Siesta makes it easy to *react* to changes in the object graph through a query and event based system. This works well with frameworks that support data binding and other reactive mechanisms.

It's perhaps not correct to think in terms of MVC with Siesta but if we were to do so Siesta is roughly aiming to cover the **M** and **C** in MVC and takes inspiration from:

* [CoreData](https://developer.apple.com/library/mac/documentation/Cocoa/Conceptual/CoreData/cdProgrammingGuide.html)
* [RestKit](http://restkit.org/)
* [FRP](http://en.wikipedia.org/wiki/Functional_reactive_programming)
* [Flux](https://github.com/facebook/flux)

As ever, the problem that Siesta is solving is best explained through an example.

# Example

This example explores one of the basic problems that Siesta is attempting to solve - the single source of truth.

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

Siesta solves this issue by mapping *data* onto an *object graph* consisting of *models* linked by *relationships*. A **Model** describes the remote object that we want to model. A **Collection** groups together these models. For example we could define a collection to represent each web service that we will interact with.

```javascript
var Forum = new Collection('Forum');

var User = Forum.model({
    name: 'User',
    attributes: ['username', 'email']
});

var Thread = Forum.model({
    name: 'Thread',
    attributes: ['title']
    relationships: {
        op: {
              model: User,
              reverse: 'threads'
        }
    }
});
```

We can then map the raw data into Siesta, which will use the models we defined early to decide which data should to which local model instance.

```javascript
User.map(userData, function (user) {
    Thread.map(threadData, function (thread) {
        user.threads[0] === thread; // true
        user === thread.op; // true
    });
});
```

We now have one local representation for each remote representation!

# Similar Projects

* [Ember Data](https://github.com/emberjs/data) is a similar project for the [Ember.js](http://emberjs.com/) framework. Ember data is rather abstraction heavy whereas Siesta focuses on flexibility and openness.
* [Meteor](https://www.meteor.com/) is a complete platform for building web/mobile apps. Meteor follows similar client-side principles to Siesta however focuses on server-side integration and as such makes it somewhat difficult to model data from external APIs. Siesta is built in such a way that the Object Graph can be extended to work with any API external or otherwise.

# What next?

Visit our <a href="docs.html">Getting Started</a> guide which will walk you through installing and configuring Siesta.</br>