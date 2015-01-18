*<span style="color: red">**Warning**: Siesta is a work-in-progress and undergoing heavy development. The codebase is currently catching up with the docs and a new version is expected within the next few weeks. Please read through the docs and get involved via the [gitter chat](https://gitter.im/mtford90/siesta). All feedback is appreciated!</span>*

# Getting Started

You can get started with Siesta by manually including it within your project or by forking one of the boilerplate projects.

## Manual Installation

Siesta is available on both bower and npm.

```bash
npm install siesta-orm --save
bower install siesta --save
```

### Script tag

You can include the full Siesta bundle or include individual components. If you decide to include individual components, ensure that other modules are included **after** core.

```html
<script src="path/to/siesta/dist/siesta.js"></script>
```

### CommonJS

Alternatively if you're using a bundler based on CommonJS (browserify, webpack etc) you can `require` siesta.

```js
var siesta = require('siesta');
```

### Promises

Promises can be used anywhere in Siesta where callbacks are used, provided that [q.js](https://github.com/kriskowal/q) is made available.

```html
<!-- If using script tags -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/q.js/1.1.2/q.js"></script>
<script src="siesta.min.js"></script>
```

Or if using CommonJS

```js
siesta.q = require('q');
```

Once q.js is included in your project you can use promises anywhere in Siesta where you would normally use callbacks.

```js
Model.map({key: 'value')
    .then(function () {
       // ...
    })
    .catch(function (err) {
       console.error('Handle error', err);
    });
```

### Storage

If you decide to use the storage module then you **must** include PouchDB. If the availability of PouchDB is not detected then storage will be disabled.

```html
<!-- If using script tags -->
<script src="//cdnjs.cloudflare.com/ajax/libs/pouchdb/3.2.0/pouchdb.min.js"></script>
<script src="https://github.com/mtford90/siesta/releases/download/{{site.version}}/siesta.min.js"></script>
```

```js
// If using CommonJS.
window.PouchDB = require('pouchdb');
```

## Example Projects

At the moment the only example project is the ReactJS/Siesta TodoMVC implementation, the demo of which is [here](http://mtford.co.uk/siesta-reactjs-todomvc/) and source [here](https://github.com/mtford90/siesta-reactjs-todomvc).

Various web apps and hybrid mobile apps are currently under development using Siesta and will be listed here upon completion.

# Concepts

Before reading through this documentation you should understand the concepts outlined in this section. If anything is less than clear please join us in [gitter](https://gitter.im/mtford90/siesta) where we can help clear things up and improve the documentation for the next person who has problems.

## Model

A `Model` describes a (possibly remote) resource that you would like to represent in your app. For example if you were writing an app that downloaded information on repositories from the Github API an (admittedly simple) model could look like the following:

```js
{
    attributes: ['name', 'stars', 'watchers', 'forks']
}
```

## Relationship

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
Repo.map([
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

## What Next?

The rest of this documentation deals with the various ways in which you can interact with the object graph. For example:

* Map resources to and from the object graph using HTTP.
* Saving the object graph in client-side storage.
* Various methods of querying the object graph.

# Collections

A collection organises a set of models, descriptors and other components. If you are interacting with REST APIs, you would define a collection for each of them. For example we could define a collection for interacting with the Github API.

```js
var Github = siesta.collection('Github');
```

# Models

A model defines the (possibly remote) resources that our app will deal with. *Instances* of our models will make up the object graph.

```js
var User = Github.model('User', {
    attributes: ['login', 'avatar_url', 'html_url']
});
```

## Defining models

### attributes

Attributes are simple data types associated with a model. For example, a `User` model could have a username and an email.

```js
var User = Collection.model({
    attributes: [
        'username',
        'name'
    ]
});
```

We can also define default values for attributes.

```js
var User = Collection.model({
    attributes: [
        'username',
        'name',
        {
            name: 'accessLevel',
            default: 1
        }
    ]
}); 
```

### id

Define the field that uniquely identifies each model instance. The value of this field will be used by Siesta to determine onto which object data should be mapped. If an object within the object graph exists with the unique identifier, data will be mapped onto that instance, otherwise a new object will be created.

```js
var Repo = Github.model({
    id: 'id' // Defaults to id
});
```

### relationships

There are three types of relationships, described here with examples from the Github API.

```js
var Repo = Github.model('Repo', {
    relationships: {
        // One github user has many repositories.
        owner: {
            model: 'Repo',
            type: 'OneToMany',
            reverse: 'repos'
        },
        // One github user has one rate limit status.
        rateLimit: {
            model: 'RateLimit',
            type: 'OneToOne',
            reverse: 'user'
        },
        // Many github users can belong to many organisations.
        organisation: {
            model: 'Organisation',
            type: 'ManyToMany',
            reverse: 'users'
        }
    }
}
```

Once a relationship is defined, Siesta will automatically manage the reverse of that relationship, the name of which is defined by the `reverse` key when defining your models. e.g.

```js
User.map({username: 'bob', id: 5})
    .then(function (bob) {
        Repo.map({name:'A repo', user: 5})
            .then(function (repo) {
                assert.equal(repo.owner, bob);
            });
    });
```

If you do not define a reverse a default name will be used instead which takes the form of `reverse_<name>`.

#### Intercollection Relationships

It is entirely possible to define relationships between models that are in different collections.

```js
var MyCollection = siesta.collection('MyCollection'),
    MyOtherCollection = siesta.collection('MyOtherCollection'),
    MyModel = MyCollection.model({attributes: ['attr']}),
    MyOtherModel = MyOtherCollection.model({
        relationships: {
            relation: {
                model: MyModel
            }
        }
    })
```

#### Recursive Relationships

Relationships can also be recursive i.e. relate to themselves in some fashion.

```js
var Repo = Github.model('Repo', {
    relationships: {
        // A Repo can be forked from another Repo
        forkedFrom: {
            model: 'Repo',
            type: 'OneToMany',
            reverse: 'forks'
        }
    }
})
```

### singleton

A singleton model will only ever have one instance.

```js
// Maps loosely to https://api.github.com
var RateLimit = Github.model({
    name: 'RateLimit',
    attributes: ['limit', 'remaining', 'reset'],
    singleton: true
});
```

Anything mapped onto a singleton model will be mapped onto that unique instance.

```js
RateLimit.map([
    {limit: 60},
    {limit: 40}
]).then(function (rateLimits) {
    console.log(rateLimits[0] == rateLimits[1]); // true
    console.log(rateLimits[0].limit); // 40
});
```

### methods

Custom methods for model instances can be defined using the methods option.

```js
var Collection = siesta.collection('Collection'),
	Account = Collection.model('Account', {
                  attributes: ['transactions']
                  methods: {
                      getBalance: function () {
                          var sum = 0;
                          this.transactions.forEach(function (v) { sum += v; });
                          return sum;
                      }
                  }
              }
```

Any mapped instances will now have that method.

```js
Account.map({transactions: [5, 3, -2]})
       .then(function (acc) {
           assert.equal(acc.getBalance(), 6);
       });
```

### properties

Similar to javascript's `Object.defineProperty` we can also define derived properties on our model instances.

```js
var Collection = siesta.collection('Collection'),
    Account = Collection.model('Account', {
                  attributes: ['transactions']
                  properties: {
					   balance: {
						   get: function () {
							    var sum = 0;
							    this.transactions.forEach(function (v) { sum += v; });
							    return sum;
						   }
					   }
                  }
              }
```

Any mapped instances will now have that property.

```js
Account.map({transactions: [5, 3, -2]})
    .then(function (acc) {
        assert.equal(acc.balance, 6);
    });
```

### statics

We can also add methods to the `Model` itself which can useful e.g. for organising oft-used queries.

```js
var User = Collection.model('User', {
	attributes: ['age'],
	statics: {
		findTeenageUsers: function (callback) {
			return this.query({
				age__gte: 13,
				age__lte: 19
			}, callback);
		}
	}
});

```

### init

`init` is executed on creation of a model instance or if a deleted instance is restored via `ModelInstance.prototype.restore`

```js
var Model = Collection.model('Model', {
	init: function () {
        doSomethingSynchronously(this);
    }
});
```

`init` can also be asynchronous. Just add a `done` argument.

```js
var Model = Collection.model('Model', {
	init: function (done) {
		doSomethingAsynchronously(this, done);
	}
});

```

### remove

`remove` is executed on removal of a modal instance.

```js
var Model = Collection.model('Model', {
	remove: function () {
		doSomethingSynchronously(this);
	}
});

```

`remove` can also be executed asynchronously. Just add a `done` argument.

```js
var Model = Collection.model('Model', {
	remove: function (done) {
		doSomethingAsynchronously(this, done);
	}
});
```

## Inheritance

Siesta supports model inheritance through which a child can inherit all attributes, relationships, methods etc.

```js
var Collection         = siesta.collection('Collection'),
    Employee           = Collection.model('Employee', {attributes: ['name']}),
    SoftwareEngineer   = Employee.child('SoftwareEngineer', {attributes: ['programmingLanguages']}),
    JavascriptEngineer = SoftwareEngineer.child('JavascriptEngineer', {attributes: ['knowsNodeJS']});
```

We can inspect the inheritance hierarchy.

```js
SoftwareEngineer.isChildOf(Employee); // true
SoftwareEngineer.isParentOf(JavascriptEngineer); // true
SoftwareEngineer.isDescendantOf(Employee); // true
SoftwareEngineer.isAncestorOf(JavascriptEngineer); // true
```

We can do the same on the instance level.

```js
JavascriptEngineer
	.map({
        name: 'Michael',
        programmingLanguages: ['python', 'javascript', 'objective-c'],
        knowsNodeJS: true
    })
    .then(function (engineer) {
    	engineer.isA(JavascriptEngineer); // true
    	engineer.isA(SoftwareEngineer); // true
        engineer.isInstanceOf(JavascriptEngineer); // true
        engineer.isInstanceOf(SoftwareEngineer); // false
    });
```

## Creating instances

In siesta, model instances are created and updated during the process of [mapping](#concepts-object-mapping). This refers to mapping data onto the object graph and is explained [here](#concepts-object-mapping).

When data is mapped onto the object graph a new model instance will be created if, and only if an instance does not exist with the `id` supplied in the mapped data.

```js
// Map a single object.
User.map({
	login: 'mtford90',
	avatar_url: 'http://domain.com/path/to/avatar.png',
	id: 123
}).then(function (model) {
    console.log(model.login); // mtford90
});

// Map multiple objects
User.map([
	 {
		 login: 'mtford90',
		 id: 123
	 },
	 {
		 login: 'bob',
		 id: 456
	 }
]).then(function (models) {
    models.forEach(function (m) {
        console.log(m.login);
    });
});
```

## Updating Instances

When we map instances to the object graph, if an instance that matches `id` already exists, then this instance will be updated.

```js
User.map({login: 'mtford90', id: 1}, function (err, user) {
    User.map({login: 'mtford91', id: 1}, function (err, _user) {
        assert.equal(user, _user);
        assert.equal(user.login, 'mtford91');
    });
})
```

## Deleting Instances

To delete instances from the object graph simply call `remove`.

```js
myInstance.remove();
console.log(myInstance.removed); // true
```

You can restore a deleted instance by calling `restore` however do note that all relationships will now be cleared.

```js
myInstance.restore();
console.log(myInstance.removed); // false
```

## Events

You can listen to model change events on the `Collection`, `Model` and `ModelInstance` levels.

```js
// Listen to events related to model instances in a particular collection
Collection.listen(function (e) {
    // ...
});

// Listen to events related to instances of particular models
Model.listen(function (e) {
    // ...
});

// Listen to events related to particular instances
Model.map({attr: 'something'})
    .then(function (instance) {
        instance.listen(function (e) {

        });
    });

// Listen to just one event before canceling the listener automatically.
something.listenOnce(function (e) {
    // ...
});
```

`listen` returns a function which you can call to stop listening.

```js
var cancelListen = something.listen(function (e) { /* ... */ });
cancelListen();
```

### Types

There are four different event types.

| Event | Description | Example |
| ----- | ----------- | ------- |
|   Set   | Set events are     | ```modelInstance.attr = 1;``` |
|   Splice   | Events relating to array modifications, whether attribute or relationship are emitted as splice operations.              |  ```modelInstance.attrArray.reverse()``` |
|   New   |  Emitted when new model instances are created              | `Model.map({id: 2, desc: 'A new model instance!'});` |
|   Remove   |  Emitted when model instances are removed from the object graph              | `myInstance.remove()` |

### The Event Object

Every event features the following fields.

|Field|Description|
|-----|-----------|
|obj|the instance to which this event refers.|
|collection|name of the collection to which the instance belongs|
|model|name of the model of which the modified object is an instance|
|type|type of event, one of Set, Splice, New, Delete|

`Set` events have the following extra fields

|Field|Description|
|-----|-----------|
|new|the new value|
|old|the old value|
|field|name of the property that has changed|

`Splice` events have the following extra fields and obey Javascript splice convention of `array.splice(index, numDelete, ... itemsToAdd)

|Field|Description|
|-----|-----------|
|added|instances added to array|
|index|index at which the splice begins|
|removed|removed model instances|
|added|added model instances|
|field|name of the property that refers to the spliced array|

`New` and `Delete` events do not have any additional fields.

### Custom Events

You can also emit custom events from your models.

```js
var Collection = siesta.collection('Collection'),
    Model = Collection.model('Model', {
        attributes: ['x', 'y']
    });

Model.map({x: 1}, function (err, instance) {
    instance.listenOnce(function (e) {
        assert.equal(e.type == 'customEvent');
    });
    instance.listen('customEvent', function (e) {
        assert.equal(e.type == 'customEvent');
    });
    instance.emit('customEvent', {key: 'value'})
});
```

Generally you would wrap custom event emissions up in methods.

```js
var Collection = siesta.collection('Collection'),
    Model = Collection.model('Model', {
        attributes: ['x', 'y'],
        methods: {
            foo: function () {
                this.emit('customEvent', {key: 'value'})
            }
        }
    });
```

### Events for Computed Properties

Due to limitations with `Object.observe` events are not emitted automatically for changes in computed properties. In the below example, if `x` or `y` changes, `z` will also change however an event will **not** be emitted for `z`.

```js
var Collection = siesta.collection('Collection'),
    Model = Collection.model('Model', {
        attributes: ['x', 'y'],
        properties: {
            z: {
                get: function () {
                    return x + y;
                }
            }
        },
        singleton: true
    });

Model.one().then(function (instance) {
    instance.x = 1;
    instance.y = 1;
    instance.listen(function (x) {
        // This will never happen.
        assert.equal(x.field, 'z');
    });
    console.log(instance.z); // 2
});
```

You can get round this by defining attribute dependencies. Once defined, whenever `x` or `y` changes, Siesta will check to see if `z` has also changed. Note that dependencies can only be attributes for now. They cannot be other properties or relationships.

```js
var Collection = siesta.collection('Collection'),
    Model = Collection.model('Model', {
        attributes: ['x', 'y'],
        properties: {
            z: {
                get: function () {
                    return x + y;
                },
                dependencies: ['x', 'y']
            }
        },
        singleton: true
    });
```

# Queries

The query API allows for interaction with locally stored instances.

```js
// Get all instances - equivalent to query({})
User.all()
    .then(function (users) {
        users.forEach(function (u) {
            console.log(u.login);
        });
    });

// Query for a user with a particular remote identifier:
User.query({id: 'xyz'})
    .then(function (u) {
        console.log(u.login);
    });

// Query for repos with more than 50 stars
Repo.query({stars__gt: 50})
    .then(function (repos) {
        repos.forEach(function (r) {
            console.log(r.name);
        });
    });

// Get one instance. Throws an error if more than one instance is returned
Repo.one({id: 55623})
    .then(function (repo) {
        console.log(repo.name);
    });

// Get the number of Repo objects that we have locally.
Repo.count()
    .then(function (n) {
        console.log(n); // Log the number of repos that we have locally.
    });
```

## Nested Queries

You can query using dot syntax to access nested objects.

```js
Repo.query({'owner.username': 'mtford90'})
    .then(function (repos) {
        // ...
    });
```

## $and/$or

It's also possible to use boolean logic when querying local data.

```js
Repo.query({
	$or: [
		{user.age__lt: 20},
		{user.age__gt: 40}
	],
	{
		name: 'michael'
	}
}).then(function (repos) {
    // ...
});
```

## Ordering

We can also order instances using the `__order` option. 

```js
// Descending order of age
User.query({
        age__gte: 18,
        __order: '-age'
    })
    .then(function (results) {
        console.log('results', results);
    });

// Descending order of age, with a secondary ordering (e.g. if ages are the same) by ascending name
User.query({
        age__gte: 18,
        __order: ['-age', 'name']
    })
    .then(function (results) {
        console.log('results', results);
    });
```

## Comparators

Here are the current built-in comparators

* `<field>` or `<field>__e` -  equality
* `<field>__lt` - less than
* `<field>__lte` - less than or equal to
* `<field>__gt` - greater than
* `<field>__gte` - greater than or equal to
* `<field>__contains` - string contains or array contains

You can register your own comparators.

```js
// A custom < comparator.
siesta.registerComparator('customLt', function (opts) {
    var value = opts.object[opts.field];
    return value < opts.value;
});

Repo.query({stars__customLt: 50})
    .then(function (repos) {
        repos.forEach(function (r) {
        console.log(r.name);
    });
```

Prepending `-` signifies descending order.

## Result Set

Once a query has completed successfully we can access the result set which contains the results of the query. This is an array-like object and can be treated as such however has additional methods that allows us to apply bulk operations to all instances within it. For example:

```js
// Delete model instances for all repositories with >= 1000 stars.
Repo.query({stars__gte: 1000})
    .then(function (repos) {
        repos.remove();
    });

// Change the name for all repositories with >= 1000 stars.
Repo.query({stars__gte: 1000})
    .then(function (repos) {
        repos.name = 'A Popular Repo';
    });

// Capitalise the names of all repos.
Repo.all()
    .then(function (repos) {
        repos.name = repos.name.toUpperCase();
    });

Each method call returns another result set and hence we can chain method calls.

```js
Repo.all()
    .then(function (repos) {
        repos.name = repos.name.toUpperCase().toLowerCase();
    });
```

If a method call returns promises then instead of a result set we will get a composite promise which can be treated like any other promise.

```js
Repo.query({stars__gte: 1000})
    .then(function (repos) {
        repos.remove().then(function () {
            // All removed.
        });
    });
```

We can also access the result set using the `results` attribute once a query has completed.

```js
var query;
query = Repo.query({stars__gte: 1000})
            .then(function (repos) {
                assert.equal(repos, query.results);
            });
```

Result sets are *immutable* and hence cannot be modified. To convert a result set into a regular array simply call `asArray`.

```js
var query;
query = Repo.query({stars__gte: 1000})
            .then(function (repoResultSet) {
                var mutableArrayOfRepos = repoResultSet.asArray();
            });
```

# Reactive Queries

Reactive queries exist to support functional reactive programming when using Siesta. For those familar with Apple's Cocoa library and CoreData these are similar to the `NSFetchedResultsController` class. 

A reactive query is a query that reacts to changes in the object graph, updating its result set and emitting events related to these updates.

```js
var rq = User.reactiveQuery({age__gte: 18});
rq.init().then(function (results) {
  	// results are the same as User.query({age__gte: 18});
});
```

To listen to events:

```js
var cancelListen = rq.listen(function (results, e) {
    // ...
});
```

Reactive queries can be ordered in a similar fashion to ordinary queries.

```js
var rq = User.reactiveQuery({
    age__gte: 18,
    __order: ['-age', 'name']
});
```

Once initialised you can terminate a reactive query by calling `terminate`. This will prevent it from responding to model events and hence updating its result set.

```js
rq.terminate();
```

## Events

Reactive Query events are emitted under 4 circumstances:

* An object has been removed from the result set due to no longer matching the query.
* An object has been added to the result set due to now matching the query.
* An object has been moved to a different position in the query due to ordering.
* An object in the result set has changed but not removed. In this instance, the change object will be an event described in the [model events section](#events).

In a similar fashion to model events you can listen to reactive queries by calling `listen` with a handler.

```js
var cancelListen = rq.listen(function (results, change) {
	// results is the complete result set
	// change describes any changes to the result set
});
```

## Result Set

In a similar fashion to ordinary queries, results presented by reactive queries are `QuerySet` instances and so can be used to manipulate all instances in the result set.

```js
// Whenever a new user less than 18 years of age is created, remove it.
var rq = User.reactiveQuery({age__lt: 18});
rq.init()
  .then(function (users) {
       rq.listen(function (users) {
            users.remove();
       });
  });

// Convert the names of all users to uppercase as they are created.
var rq = User.reactiveQuery();
rq.init()
  .then(function (users) {
       rq.listen(function (users) {
           users.name = users.name.toUpperCase();
       });
  });
```

## Insertion Policy

If no order is defined then by default Siesta will push any new instances in the Reactive Query to the back. You can change this by setting the insertion policy.

```js
var rq = User.reactiveQuery();
// Insert at back (default)
rq.insertionPolicy = s.InsertionPolicy.Back;
// Insert at front
rq.insertionPolicy = s.InsertionPolicy.Front;
```

# Arranged Reactive Queries

Arranged Reactive Queries solve the common use case of allowing users to arrange instances e.g. drag and drop arrangements of todos in a todo list app. Once instances have a value in the index attribute they will remain in that position unless changed using the mutation methods described below. Arranged Reactive Queries are useful.

```js
var arq = Todo.arrangedReactQuery();
// Model attribute in which to store the position.
arq.indexAttribute = 'index';

Todo.map([
	{title: 'Do homework'},
	{title: 'Do laundry'},
	{title: 'Order food'}
]).then(function (todos) {
	arq.init().then(function () {
		assert.equal(todos[0].index, 0);
		assert.equal(todos[1].index, 1);
		assert.equal(todos[2].index, 2);
		arq.swapObjects(todos[0], todos[1]);
		assert.equal(todos[0].index, 1);
		assert.equal(todos[1].index, 0);
	});
});
```

You can kick off the arranged reactive query with an initial ordering based on the usual query API described in the previous sections.

```js
var arq = User.arrangedReactiveQuery({
    age__gt: 10
});
arq.indexAttribute = 'index'; // Default attribute to use is index

// Listening is exactly the same as ordinary reactive queries.
var cancelListen = arq.listen(function (results, e) {
    // ...
});

User.map([
	{age: 55},
	{age: 25},
	{age: 70}
]).then(function (users) {
	arq.init().then(function () {
		assert.equal(users[0].index, 0);
		assert.equal(users[1].index, 1);
		assert.equal(users[2].index, 2);
		arq.swapObjects(users[0], users[1]);
		assert.equal(users[1].index, 0);
		assert.equal(users[0].index, 1);
	});
});
```

There are several ways to mutate the arrangements of the objects.

```js
// Swap the objects at indexes `from` and `to` and update the index field.
prq.swapObjectsAtIndexes(from, to);
// Swap the objects or throw an error if the objects are not within the result set.
prq.swapObjects(obj1, obj2);
// Move the object at index from index "from" to index "to"
prq.move(from, to);
```

## Events

Events are exactly the same as for [Reactive Queries](#reactive-queries-events).

# HTTP

Before using the HTTP extension you first need to define a baseURL on your collection.

```
var Github = siesta.collection('Github');
Github.baseURL = 'https://api.github.com/';
```

## Descriptors

Descriptors describe interactions with web services and are used by Siesta to decide what changes to make to the object graph once these interactions are initiated and/or completed.

The following descriptor describes the github endpoint for obtaining a users list repositories.

```js
Github.descriptor({
	// Paths are regular expressions.
    path: '/users/([a-b0-9]+)/repos/',
    // The model onto which we will map the received objects
    model: Repo,
    // HTTP method(s) to accept
    method: 'GET'
});
```

### path

Paths take the form of Javascript regular expressions, strings and arrays.

```js
Model.descriptor({
    path: '/path/to/([a-b0-9]+)/'
});

Model.descriptor({
    path: ['/path/to/something', '/path/to/something/else']
});
```

### model

The model can either be a `Model` object or a string describing the collection and the model.

```js
Github.descriptor({
    model: Repo
});

Github.descriptor({
    model: 'Github.Repo'
});
```

### method

The wildcard method refers to all HTTP methods

```js
Github.descriptor({
    method: '*'
});
```

We can also provide arrays of methods


```js
Github.descriptor({
    method: ['GET', 'POST']
});
```

Or just a singular method


```js
Github.descriptor({
    method: 'GET'
});
```

### data

Sometimes the data that represents the models is nested within the response from the web service. The `data` key is used to deal with this.

```js
Model.descriptor({
	data: 'path.to.data'
});

// Use a function instead.
Model.descriptor({
	data: function (raw) {
		return raw.path.to.data;
	}
});
```

For example, the Github search endpoint nests results in the `items` key.

```js
Github.descriptor({
    path: '/search/repositories/',
    model: Repo,
    method: 'GET',
    data: 'items'
});
```



### transforms

Transforms can be used to transform fields in the raw data before the data is mapped onto the object graph. Note that this step is performed after the [data](#http-descriptors-data) step described above.

```js
Github.descriptor({
    path: '/users/([a-b0-9]+)/repos/',
    model: Repo,
    method: 'GET',
    transforms: {
        'stargazers_count': 'num_stars'
    }
});
```

We can use dot notation to transform nested data:

```js
Github.descriptor({
    transforms: {
        'stargazers_count': 'path.to.num_stars'
    }
});

// Use a function instead
Github.descriptor({
    transforms: {
        'stargazers_count': function (k) {
            return 'path.to.num_stars'
        }
    }
});
```

For more complicated transformations, you can define a top-level transformation function

```js
Github.descriptor({
    path: '/users/[a-b0-9]+/repos/',
    model: Repo,
    method: 'GET',
    transforms: function (data) {
        var n = data.stargazers_count;
        delete data.stargazers_count;
        data.num_stars = n;
        return data;
    }
});
```

### serialiser

Serialisation is the process of transforming a model instance into raw data that can be sent to the web service. Siesta comes with two stock serialisers.

```js
// Serialise all repositories to the id
Github.descriptor({
    path: '/repos/[a-b0-9]+/[a-b0-9]+/',
    model: Repo,
    method: ['PATCH', 'POST'],
    serialiser: siesta.serialisers.id
});

// Serialise all repositories and nested model instances to a depth of 2
Github.descriptor({
    path: '/repos/[a-b0-9]+/[a-b0-9]+/',
    model: Repo,
    method: ['PATCH', 'POST'],
    serialiser: siesta.serialisers.depth(2)
});
```

You can also define your own.

```js
Github.descriptor({
    path: '/repos/[a-b0-9]+/[a-b0-9]+/',
    model: Repo,
    method: ['PATCH', 'POST'],
    serialiser: function (obj) {
    	return {name: obj.name};
    }
});
```

## Sending Requests

Once descriptors are defined, we can then send HTTP requests and receive HTTP responses through Siesta. Siesta will match against descriptors when determining how to serialise/deserialise objects.

### Safe Methods

Safe methods refer to methods that do not generally change state on the server-side.


```js
Github.GET('/users/mtford90/repos')
	.then(function (repos) {
		repos.forEach(function (r) {
			console.log(r.name);
		});
	});
});

// Query parameters
Github.GET('/search/repositories', {data: 'siesta'})
	.then(function (repos) {
		repos.forEach(function (r) {
			console.log(r.name);
		});
});
```

You can also use HEAD, OPTIONS or TRACE however these are uncommon.

### Unsafe Methods

Unsafe methods refer to methods that can change state on the server-side. Objects are serialised as specified in the matched descriptor.

```js
myRepo.name = 'A new name';

Github.PUT('/users/mtford90/repos/' + myRepo.id, myRepo)
	.then(function (repos) {
		assert.equal(repo, myRepo);
	});

Github.PATCH('/users/mtford90/repos/' + myRepo.id, myRepo, {fields: ['name']})
	.then(function (repo) {
		assert.equal(repo, myRepo);
	});

Github.POST('/users/mtford90/repos/', myRepo)
	.then(function (repo) {
		assert.ok(repo.id);
	});

Github.DELETE('/users/mtford90/repos/' + myRepo.id, myRepo)
	.then(function () {
		assert.ok(myRepo.removed);
	});
```

## Custom AJAX

Siesta currently supports jQuery style ajax functions. This can be configured as follows:

```js
siesta.setAjax(zepto.ajax);
```

## Paginator

Siesta features a paginator for managing responses from paginated endpoints.

### Configuration

The default configuration is as follows. As well as the paginator options, the options object can take any option accepted by jQuery-like ajax functions.

```js
var paginator = Model.paginator({
	page: 'page',
	// Place params in URL as query params.
	// If false will be placed in body instead e.g. POST body
	queryParams: true,
	pageSize: 'pageSize',
	response: {
		numPages: 'numPages',
		data: 'data',
		count: 'count'
	},
    type: 'GET',
    dataType: 'json',
    // This must be specified.
    path: null
});
```

Like with descriptors, if our models are nested we can specify a `data` option.

```js
paginator = Model.paginator({
	dataPath: 'path.to.data'
})

paginator = Model.paginator({
	dataPath: function (response, jqXHR) {
		return responseData.path.to.data;
	}
});
```

`numPages` and `count` will also accept functions for flexibility.

```js
paginator = Model.paginator({
	numPages: function (response, jqXHR) {
		return jqXHR.getResponseHeader('X-Num-Pages');
	},
	count: function (response, jqXHR) {
		return response.data.total_count;
	}
});
```

The below demonstrates the flexibility of the paginator against the Github API which makes use of the `Link` response header described [here](https://developer.github.com/guides/traversing-with-pagination/).

```js
paginator = Github.paginator({
    path: 'search/code?q=addClass+user:mozilla'
	pageSize: 'per_page',
	count: 'total_count',
	numPages: function (response, jqXHR) {
		var links = parseLinkHeader(jqXHR.getResponseHeader('Link')),
			lastURI = links['last'],
			queryParams = parseQueryParams(lastURI);
		return queryParams['page'];
	},
	dataPath: 'items'
})
```

Note that any additional configuration items passed to the paginator will be passed to the ajax function.

```js
paginator = Github.paginator({
    path: 'path/to/something'
	dataPath: 'items',
	// Will be sent as post data
	data: {
	    key: 'value'
	},
	type: 'POST'
})
```

###  Usage

Get the model instances on a particular page.

```js
paginator.page(4)
    .then(function (objects) {
        // objects is the list of objects returned from the endpoint
    });
```

Once you have obtained at least one page, you can access the following information.

```js
paginator.numPages; // Number of pages.
paginator.count; // Number of objects.
```

# Storage

The Siesta storage extension is responsible for storing model instances locally. Models are loaded from the local database automatically when the app starts. (Note: this is inefficient and is planned to change once faults are introduced, in a similar fashion to Apple's CoreData)

## Save

`siesta.save([callback])` will save all changes to Siesta models to PouchDB.

```js
siesta.save()
    .then(function () {
        console.log('Save success!');
    })
    .catch(function (err) {
        console.error('Error saving', err);
    });
```

### Autosave

We can tell siesta to automatically save any changes to models. Siesta will check regularly for changes and then perform the save, as opposed to saving at every change. This is to ensure that no loops occur.



```js
siesta.autosave = true;
siesta.autosaveInterval = 1000; // How regularly to check for changes to save.
```

## Dirtyness

A `ModelInstance` is considered dirty if it holds an unsaved change. A `Model` is dirty if there exists an instance that is dirty. A `Collection` is dirty if there exists instances of models within that collection.

```js
instance.attr = 'value';
console.log(instance.dirty); // true
console.log(instance.model.dirty); // true
console.log(instance.collection.dirty); // true
```

## PouchDB Configuration

PouchDB has a rich set of configuration options which you can explore in their [docs](http://pouchdb.com/api.html). By default, Siesta will initialise with PouchDB's own defaults.

```js
new PouchDB('siesta');
```

You can inject your own instance pouch by calling `siesta.setPouch`. Note that this will throw an error if an object graph has been initialised and therefore must be done before any map or query operations.

```js
siesta.setPouch(new PouchDB('custom'));
```

# Recipes

This section features various useful examples that demonstrate the power of Siesta and its dependencies.

## HTTP Intercepts

Siesta does not make available HTTP interception, but many ajax libraries that are compatible with Siesta do. e.g. if you're using jQuery (siesta will look for $.ajax by default) you can `ajaxSend` to intercept and modify HTTP requests before they are sent.

```js
$(document).ajaxSend(function (event, jqXHR, settings) {
    jqXHR.setRequestHeader('X-My-Custom-Header', 'Something');
});
```

## Authentication

Authentication is best handled with the HTTP interceptors of whatever ajax library you're using. This can be integrated with your Siesta user model such as in the example.

```js
var User = Collection.model('User', {
    attributes: ['username', 'token'],
    properties: {
        isAuthenticated: {
            get: function() {
                return !!this.token;
            }
        }
    },
    methods: {
        _handleAjaxSend: function (e, jqXJR) {
            jqXHR.setRequestHeader('Auth', token);
        },
        _handleAjaxError: function (e, jqXHR) {
            if (jqXHR.status == 403) this._removeAjaxListeners();
        },
        _removeAjaxListeners: function () {
            $(document).off('ajaxSend', this.sendListener);
            $(document).off('ajaxError', this.errorListener);
        },
        login: function (password) {
            $.post('https://myapi.com/login', {password: password})
                .done(function (data) {
                    this.token = data.token;
                    $(document).ajaxSend(this.sendListener = this._handleAjaxSend.bind(this));
                    $(document).ajaxError(this.errorListener = this._handleAjaxError.bind(this));
                }.bind(this))
                .fail(function () {
                    this.token = null;
                    handleFailedAuthentication();
                }.bind(this));
        }
    }
});
```

## App Settings

If you need to manage settings in your app you can use singletons, and relationships between them e.g.

```js
var Collection = siesta.collection('Collection'),
    Settings = Collection.model('Settings', {
        relationships: {
             someSettings: {model: 'SomeSettings'},
             someMoreSettings: {model: 'SomeMoreSettings'}
        },
        singleton: true
    }),
    SomeSettings = Collection.model('SomeSettings', {
        attributes: ['setting1', 'setting2'],
        singleton: true
    });
    SomeMoreSettings = Collection.model('SomeMoreSettings', {
        attributes: ['setting3', 'setting4'],
        singleton: true
    });
```

And then update and listen to changes from anywhere in your app.

```js
Settings.one().then(function (settings) {
    settings.someSettings.setting1 = 'something';
    settings.someMoreSettings.setting4 = 'something else';
    settings.someMoreSettings.listen(function (change) {
        console.log('Some more settings changed!', change);
    });
});
```

# Error handling

Following Node convention the first parameter of all callbacks in Siesta is the error parameter. e.g. if you attempted to map a string onto the object graph.

```js
Model.map('sdfsdfsdf'), function (err) {
    assert.instanceOf(err, siesta.CustomSiestaError);
    assert.equal(err.component, 'Mapping'); // Corresponds to logging component.
    console.log(err.message); // Cannot map strings onto the object graph.
});
```

Similarly you can catch errors using the `then` function of promises

```js
Model.map('sdfsdfsdf')
    .then(function (instance) {
        // This will never be called.
    }, function (err) {
        assert.instanceOf(err, siesta.CustomSiestaError);
        assert.equal(err.component, 'Mapping'); // Corresponds to logging component.
        console.log(err.message); // Cannot map strings onto the object graph.
    });
```

`catch` will be equivalent in this case. Note, however, that `catch` will also catch any errors thrown by Javascript e.g. type errors.

```js
Model.map('sdfsdfsdf')
    .then(function (instance) {
        // This will never be called.
    })
    .catch(function (err) {
        assert.instanceOf(err, siesta.CustomSiestaError);
        assert.equal(err.component, 'Mapping'); // Corresponds to logging component.
        console.log(err.message); // Cannot map strings onto the object graph.
    });
```

# Logging

`siesta.setLogLevel(loggerName, logLevel)` is used for configuring logging in Siesta.

```js
siesta.setLogLevel('HTTP', siesta.log.trace);
```

Logging for various Siesta subsystems can be configured using the following log levels:

* `siesta.log.trace`
* `siesta.log.debug`
* `siesta.log.info`
* `siesta.log.warn`
* `siesta.log.error`
* `siesta.log.fatal`

The various loggers are listed below:

* `HTTP`: Logs related to actual HTTP requests/responses.
* `Descriptor`: Logs related to matching against descriptors.
* `Serialisation`: Logs related to serialisation of instances during HTTP requests.
* `Cache`: Logs related to the in-memory caching of model instances.
* `Mapping`: Logs related to the mapping of data to the object graph.
* `Query`: Logs related to the querying of local data
* `Storage`: Logs related to saving and loading of the object graph to storage.

# Testing

Testing with Siesta is easy. There are two methods to aid in clearing and resetting Siesta's state.

```js
siesta.reset(function () {
    // All collections, models, data & descriptors will now be removed.
});

siesta.resetData(function () {
    // All model instances will now be removed. Collections, models & descriptors will remain intact.
    // If storage extension is being used, PouchDB will also have been reset.
});
```

e.g. if using bdd

```js
var Collection = siesta.collection('MyCollection'),
    MyModel = Collection.model('MyModel', {
        attributes: ['x', 'y']
    });

describe('something', function () {
    beforeEach(siesta.resetData);
    it('test', function (done) {
        MyModel.map({x: 1}, function (err, instance) {
            assert.equal(instance.x, 1);
            done(err);
        });
    });    
})
```

# Caveats

## Object.observe shim

Siesta uses [observe-js](https://github.com/polymer/observe-js) from Polymer to handle changes to arrays. ObserveJS is a (sort-of) shim for `Object.observe` which is currently only available in Chrome at the time of writing. It also comes with certain caveats.

e.g. take the case whereby we are manipulating a user repositories.

```js
Repo.map({name: 'MyNewRepo'})
    .then(function (repo) {
        myUser.repositories.push(repo);
        myUser.repositories.splice(0, 1); // Remove repo at index 0.
    });
```

In browsers that implement `Object.observe`, notifications will be sent on the next available tick in the event loop. In browsers that do not, notifications will not be sent until `siesta.notify()` is executed. So to ensure that notifications work correctly in all browsers we need to change the above example to the following:

```js
Repo.map({name: 'MyNewRepo'})
    .then(function (repo) {
        myUser.repositories.push(repo);
        myUser.repositories.splice(0, 1); // Remove repo at index 0.
        siesta.notify(function () {
            // Send out all notifications.
        });
    });
```

Promises can also be used.

```js
siesta.notify().then(function () {
    // All notifications will have been sent.
});
```

In browsers that implement `Object.observe`, `siesta.notify()` simply does nothing and so it is safe to use throughout your code no matter which browsers you are targeting.

# ReactJS mixin

The ReactJS mixin adds useful methods to React components in order to make integration with Siesta more concise.

## Installation

The mixin is available on npm and bower.

```bash
npm install react-siesta --save
bower install react-siesta --save
```


You can install via a script tag.

```html
<script src="path/to/react-siesta/dist/react-siesta.min.js"></script>
```

Alternatively if you're using a bundler based on CommonJS (browserify, webpack etc) you can `require` the mixin after installing via NPM.

```js
var SiestaMixin = require('react-siesta');
```

Once installed you can use the mixin as follows.

```js
var MyComponent = React.createClass({
	mixins: [SiestaMixin],
	// ...
});
```

## Usage

### listen

`this.listen` will listen to events from any of:

* `Collection`
* `Model`
* `ModelInstance`
* `ReactiveQuery`
* `ArrangedReactiveQuery`

All listeners are cancelled when `componentWillUnmount` is executed saving on repetitive calls, mistakes and memory leaks.

You can listen to collections.

```js
var MyComponent = React.createClass({
    mixins: [SiestaMixin],
    componentDidMount: function () {
        var listener = function(event) {
             this.setState(); // Rerender
        }.bind(this);
        this.listen(MyCollection, listener)
            .then(listener);
    }
});
```

You can listen to models.

```js
var MyComponent = React.createClass({
    mixins: [SiestaMixin],
    componentDidMount: function () {
        var listener = function(event) {
             this.setState(); // Rerender
        }.bind(this);

        this.listen(MyModel, listener)
            .then(listener);
    }
});
```

You can listen to instances of models.

```js
var MyComponent = React.createClass({
    mixins: [SiestaMixin],
    componentDidMount: function () {
        MyModel.map({attr: 1})
            .then(function (myModel) {
                 var listener = function(event) {
                      this.setState(); // Rerender
                 }.bind(this);
                 this.listen(myModel, listener)
                     .then(listener);
            });
    }
});
```

You can listen to reactive queries.

```js
var rq = User.reactiveQuery({
    age__gt: 20,
    __order: 'age'
});

var MyComponent = React.createClass({
    mixins: [SiestaMixin],
    componentDidMount: function () {
        var listener = function(usersOlderThanTwenty) {
            this.setState({
                usersOlderThanTwenty: usersOlderThanTwenty
            });
        }.bind(this);
        rq.init().then(listener);
        this.listen(rq, listener);
    }
});
```

You can listen to arranged reactive queries.

```js
var arq = Todo.arrangedReactiveQuery();

var MyComponent = React.createClass({
    mixins: [SiestaMixin],
    componentDidMount: function () {
        var listener = function(todos) {
            this.setState({
                todos: todos
            });
        }.bind(this);
        arq.init().then(listener);
        this.listen(arq, listener);
    }
});
```

You can listen to singleton models.

```js
// We can do this.
var MyComponent = React.createClass({
    mixins: [SiestaMixin],
    componentDidMount: function () {
        this.listen(MySingletonModel, function (e) {
            if (e.type == 'Set') {
                this.setState(); // Render
            }
        }.bind(this));
        MySingletonModel.one().then(function (singleton) {
            this.setState({
                singleton: singleton
            });
        }.bind(this))
    }
});

// Instead of this.
var MyComponent = React.createClass({
    mixins: [SiestaMixin],
    componentDidMount: function () {
        MySingletonModel.one().then(function (singleton) {
            this.setState({
                singleton: singleton
            });
            this.cancelListen = singleton.listen(function (e) {
                if (e.type == 'Set') {
                    this.setState(); // Render
                }
            });
        }.bind(this))
    },
    componentWillUnmount: function () {
        this.cancelListen();
    }
});
```

Note: we can reduce this code even further by using [listenAndSetState](#reactjs-mixin-usage-listenandsetstate)

#### Custom Events

`listen` can also handle custom events.

```js
var MyComponent = React.createClass({
    mixins: [SiestaMixin],
    componentDidMount: function () {
        MyModel.map({attr: 1})
            .then(function (myInstance) {
                 var listener = function(event) {
                      this.setState(); // Rerender
                 }.bind(this);
                 this.listen('customEvent', myInstance, listener)
                     .then(listener);
                 myInstance.emit('customEvent', {key: 'value'});
            });
    }
});
```

### query

The `query` function will execute a query and then populate the state with the passed key.

```js
var MyComponent = React.createClass({
    mixins: [SiestaMixin],
    componentDidMount: function () {
        this.query(User, {age__gt: 20}, 'users');
    }
});
```

Which is equivalent to:

```js
var MyComponent = React.createClass({
    componentDidMount: function () {
        User.query({age__gt: 20}).then(function (users) {
            this.setState({
                users: users
            });
        }.bind(this));
    }
});
```

Note that promises still work.

```js
var MyComponent = React.createClass({
    mixins: [SiestaMixin],
    componentDidMount: function () {
        this.query(User, {age__gt: 20}, 'users')
            .then(function () {
                assert.ok(this.state.users);
            }.bind(this))
    }
});
```

### all

The `all` function is similar to query except it retrieves all instances of the model.

```js
var MyComponent = React.createClass({
    mixins: [SiestaMixin],
    componentDidMount: function () {
        this.all(User, 'users');
    }
});

// Or with an ordering.
var MyComponent = React.createClass({
    mixins: [SiestaMixin],
    componentDidMount: function () {
        this.all(User, {__order: ['name']}, 'users');
    }
});
```

### listenAndSetState

The `listenAndSetState` function will listen to a reactive query, arranged reactive query or singleton and then update the state automatically with the passed key. It will also cancel any registered listeners when the component unmounts.

```js
var MyComponent = React.createClass({
    mixins: [SiestaMixin],
    componentDidMount: function () {
        this.listenAndSetState(MyModel.reactiveQuery({age__gt: 20}), 'users');
    }
});

// Which is equivalent to...
var MyComponent = React.createClass({
    updateState: function (results) {
      this.setState({
          users: results
      });
    },
    componentDidMount: function () {
        var rq = MyModel.reactiveQuery({age__gt: 20}),
            updateState = this.updateState.bind(this);
        rq.init().then(updateState);
        this.cancelListen = rq.listen(updateState);
    },
    componentWillUnmount: function () {
        this.cancelListen();
    }
});
```

It's also possible to listen to specific fields on an instance and automatically update the components state with those fields.

```js
var MyComponent = React.createClass({
    mixins: [SiestaMixin],
    componentDidMount: function () {
        User.get({username: 'mike'})
            .then(function (user) {
                this.listenAndSetState(userInstance, {fields: ['username', 'email']});
            }.bind(this));
    },
    render: function () {
        return (
            <div>
                <span>{this.state.username}</span>
                <span>{this.state.email}</span>
            </div>
        )
    }
});
```

We can also vary the keys:

```js
var MyComponent = React.createClass({
    mixins: [SiestaMixin],
    componentDidMount: function () {
        User.get({username: 'mike'})
            .then(function (user) {
                this.listenAndSetState(userInstance, {fields: {username: 'login', email: 'e-mail'}});
            }.bind(this));
    },
    render: function () {
        return (
            <div>
                <span>{this.state.login}</span>
                <span>{this.state['e-mail']}</span>
            </div>
        )
    }
});
```

Or mix and match:

```js
var MyComponent = React.createClass({
    mixins: [SiestaMixin],
    componentDidMount: function () {
        User.get({username: 'mike'})
            .then(function (user) {
                this.listenAndSetState(userInstance, {fields: [{username: 'login'}, 'email'});
            }.bind(this));
    },
    render: function () {
        return (
            <div>
                <span>{this.state.login}</span>
                <span>{this.state.email}</span>
            </div>
        )
    }
});
```

#### Singletons

`listenAndSetState` also works with singleton models:

```js
var MyComponent = React.createClass({
    mixins: [SiestaMixin],
    componentDidMount: function () {
        this.listenAndSetState(MySingletonModel, 'singleton');
    }
});

// Instead of 
var MyComponent = React.createClass({
    mixins: [SiestaMixin],
    componentDidMount: function () {
        MySingletonModel.one(function (err, singleton) {
            this.setState({
                singleton: singleton
            });
            this.listen(MySingletonModel, function (e) {
                if (e.type == 'Set') this.setState();
            }.bind(this));
        }.bind(this));
    }
});   
```

