# Why Siesta?

## Single Source of Truth

A resource has a single source of truth if and only if one object represents that resource.

Having multiple objects representing the same thing leads to an entire class of errors that can wreak havoc on consistency across your app.

These duplicates are common when your app interacts with APIs.

For example if we downloaded a todo from `/todos/576`:

```js
var todo = {
  id: 567
  description: 'Go to the shop.',
  user: {
    username: 'mike',
    id: 23
  }
};
```

And a user from `/user/23`:

```js
var user = {
  username: 'mike',
  id: 23
};
```

We now have two objects representing the same user: `user` and `todo.user`.

This is a trivial example but it illustrates the point. Using the Siesta object graph solves this issue:

```js
MyCollection.graph({
  User: user,
  Todo: todo
}).then(function (models) {
  assert(models.User[0] === models.Todo[0].user);
});
```

## Storage

Moving between objects stored on disk (e.g. browser storage) and those in memory should be entirely transparent.

Siesta's faulting mechanism loads data from disk only as you need it. And what's more, backed by [PouchDB](http://pouchdb.com) Siesta supports a multitude of browser storage solutions.

## Serialisation

It should be easy to move between raw data e.g. data transfer formats like JSON and local objects that represent them. With siesta there is only way to create and update objects: the object mapping mechanism which  is made available by the `graph` function.

```js
var data = [{id: 5, username:'mike'}, {id: 6, username:'john'}];
User.graph(data)
  .then(function(users) {
    // Data is mapped onto either new or existing users depending on the id field.
  });
```

Going the other way is easy too.

```js
User.one({username: 'mike')
  .then(function (user) {
    var data = user.serialise();
    // ...
  });
```

And it's easy to define your own serialisation mechanisms.

```js
var User = myCollection.model('User', {
  serialise: function (user) {
    return {
      username: user.username,
      todos: user.todos.map(function (todos) {
        return todo.id;
      });
    }
  }
});
```

# Concepts

Before using this documentation you should understand the concepts outlined in this section. If anything is less than clear please join us in [gitter](https://gitter.im/mtford90/siesta) where we can help clear things up and improve the documentation for the next person who has problems.

## App

An app refers to a Siesta app created as follows:

```js
var app = siesta.app('my-app');
```

## Model

A `Model` describes a (possibly remote) resource that you would like to represent in your app. For example if you were writing an app that downloaded information on repositories from the Github API an (admittedly simple) model could look like the following:

```js
{
    attributes: ['name', 'stars', 'watchers', 'forks']
}
```

## Field

A field is an attribute or a relationship.

### Attribute

An attribute is a simple data item such as a `String`, `Integer` or `Date`.

e.g. a user could be described as follows:

```js
var User = {
	attributes: ['username']
}
```

### Relationship

A `Relationship` describes a relation between two models. For example, all Github repositories have a user that owns that repository. We would define a relationship between our `Repo` and `User` model to describe this.

```js
var User = {
    attributes: ['username']
}

var Repo = {
    attributes: ['name', 'stars', 'watchers', 'forks'],
    relationships: {
        owner: {
            model: User,
            reverse: 'repositories'
        }
    }
}
```

## Model Instance

A `ModelInstance` is an instance of a `Model`. It can be used in the same fashion as a generic Javascript object.

```js
myRepo.name = 'an awesome repo';
myUser.repositories.push(myRepo);
```

## Collection

A `Collection` organises our model definitions. For example if we are communicating with the Github API and want to define various models with which to represent remote resources we would organise them under a collection.

```js
var Github = siesta.collection('Github', {
        baseURL: 'https://api.github.com'
    }),
    User   = Github.model('User' , {
        attributes: ['username']
    }),
    Repo   = Github.model('Repo', {
        attributes: ['name', 'stars', 'watchers', 'forks'],
        relationships: {
            owner: {
                model: User,
                reverse: 'repositories'
            }
        }
    });
```

## Object Graph

When models and the relationships between those models are instantiated, what results is an **object graph** where the model instances (the nodes) are linked together by relationships (the edges).

Carrying on the Github example, we could have two relationships, `owner` and `forkedFrom`. `owner` is a relationship between a `User` and a `Repo`. `forkedFrom` is a relationship between a `Repo` and itself. Once we have created instances of our models we could end up with an object graph that looks like the following:

<pre><img src="objgraph.png" style="width: 460px"/></pre>

Siesta is all about interacting with and manipulating this object graph and aims to present a robust solution for modelling data in the browser via this mechanism.

## Object Mapping

Object mapping refers to the process of taking raw data and placing this data onto the object graph. This process will create and update existing model instances and their relationships as per the data and the model definitions that you have provided.

Siesta determines which objects to create and which objects to update by using the unique identifier, `id` that is supplied when you define your models.

For example, to create the Github object graph from earlier we could map the following data.

```js
Repo.graph([
    {
        name: 'siesta',
        id: 23079554,
        owner: {
            id: 1734057,
            login: 'mtford90'
        }
    },
    {
        name: 'siesta',
        id: 27406882,
        owner: {
            id: 2001903,
            login: 'cmmartin'
        },
        forkedFrom: {
            id: 23079554
        }
    },
    {
        name: 'siesta',
        id: 25102369,
        owner: {
            id: 26195,
            login: 'wallyqs'
        },
        forkedFrom: {
            id: 23079554
        }
    }
]);
```

Siesta will automatically create and update model instances, hook up relationships and reverse relationships before returning the objects. The robust representation ensures that we have no duplicate representations of the resources that we are representing.

## Context

A context is best described as an instance of the object graph. Your apps can have multiple contexts each of which can be thought of as a fresh scratch pad for graphing data.

You can merge contexts (or individual models & instances from that object graph) whenever neccessary.

For example, it is a common pattern to have a context with storage enabled and another context that is entirely in-memory so that we can selectively decide which parts of the object graph should be stored locally.

Each app has a default context and you can treat contexts in exactly the same fashion as you would an app.
