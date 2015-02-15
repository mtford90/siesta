
# Concepts

Before reading through this documentation you should understand the concepts outlined in this section. If anything is less than clear please join us in [gitter](https://gitter.im/mtford90/siesta) where we can help clear things up and improve the documentation for the next person who has problems.

## Problems

It's import to understand the problems that Siesta is attempting to solve.

### Single Source of Truth

TODO

### Local Storage

TODO

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

## What Next?

The rest of this documentation deals with the various ways in which you can interact with the object graph. For example:

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
User.graph({username: 'bob', id: 5})
    .then(function (bob) {
        Repo.graph({name:'A repo', user: 5})
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
RateLimit.graph([
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
Account.graph({transactions: [5, 3, -2]})
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
Account.graph({transactions: [5, 3, -2]})
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

`init` is executed on creation of a model instance or if a deleted instance is restored via `ModelInstance.prototype.restore`. The function is passed a boolean `restored ` which states whether or not the object is being loaded from storage or created for the first time. `restored` is `true` if the object is being loaded from PouchDB. This is useful for performing first time setup each model instance - setup that does not need to be executed when loaded from storage.

```js
var Model = Collection.model('Model', {
	init: function (restored) {
        doSomethingSynchronously(this);
        if (!restored) {
        	// First time setup.
        }
    }
});
```

`init` can also be asynchronous. Just add a `done` argument.

```js
var Model = Collection.model('Model', {
	init: function (restored, done) {
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
	.graph({
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
User.graph({
	login: 'mtford90',
	avatar_url: 'http://domain.com/path/to/avatar.png',
	id: 123
}).then(function (model) {
    console.log(model.login); // mtford90
});

// Map multiple objects
User.graph([
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
User.graph({login: 'mtford90', id: 1}, function (err, user) {
    User.graph({login: 'mtford91', id: 1}, function (err, _user) {
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
Model.graph({attr: 'something'})
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
|   New   |  Emitted when new model instances are created              | `Model.graph({id: 2, desc: 'A new model instance!'});` |
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

Model.graph({x: 1}, function (err, instance) {
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
        console.log('results');
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
rq.init().then(function () {
    var results = rq.results;
  	// results are the same as User.query({age__gte: 18});
});
```

To listen to events:

```js
var cancelListen = rq.listen(function (e) {
	var results = rq.results; // Updated result set.
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

You can update the reactive queries result set manually by calling `update`

```js
rq.update(function (err) {
	// Result set will now be updated.
});
```

## Events

Reactive Query events are emitted under 4 circumstances:

* An object has been removed from the result set due to no longer matching the query.
* An object has been added to the result set due to now matching the query.
* An object has been moved to a different position in the query due to ordering.
* An object in the result set has changed but not removed. In this instance, the change object will be an event described in the [model events section](#events).

In a similar fashion to model events you can listen to reactive queries by calling `listen` with a handler.

```js
var cancelListen = rq.listen(function (change) {
	var results = rq.results;
	// results is the complete result set
	// change describes any changes to the result set
});
```

## Result Set

In a similar fashion to ordinary queries, results presented by reactive queries are `ResultSet` instances and so can be used to manipulate all instances in the result set.

```js
// Whenever a new user less than 18 years of age is created, remove it.
var rq = User.reactiveQuery({age__lt: 18});
rq.init(function () {
   rq.listen(function () {
       rq.results.remove();
   });
})

// Convert the names of all users to uppercase as they are created.
var rq = User.reactiveQuery();
rq.init(function () {
    rq.listen(function () {
        var users = rq.results;
        users.name = users.name.toUpperCase();
    });
})
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

Todo.graph([
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

User.graph([
	{age: 55},
	{age: 25},
	{age: 70}
]).then(function () {
    var users = arq.results;
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

PouchDB has a rich set of configuration options which you can explore in their [docs](http://pouchdb.com/api.html). By default, Siesta will initialise PouchDB using the following instantiation:

```js
new PouchDB('siesta', {auto_compaction: true});
```

You can inject your own instance pouch by calling `siesta.setPouch`. Note that this will throw an error if an object graph has been initialised and therefore must be done before any map or query operations.

```js
siesta.setPouch(new PouchDB('custom'));
```

# Misc

## Promises

Promises can be used anywhere in Siesta where callbacks are used. Promises are supplied by the excellent ES6 compliant [lie](https://github.com/calvinmetcalf/lie) module written by Calvin Metcalf and battle-tested in PouchDB.

```js
Model.graph({key: 'value')
    .then(function () {.graph
       // ...
    })
    .catch(function (err) {
       console.error('Handle error', err);
    });
```

# Recipes

This section features various useful examples that demonstrate the power of Siesta and its dependencies.

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
Model.graph('sdfsdfsdf'), function (err) {
    console.log(err.reason); // Cannot map strings onto the object graph.
	assert.ok(err.error);
	assert.notOk(err.ok);
});
```

If using promises errors will be delivered to the second parameter of `then` as well as to the catch block which also captures thrown errors.

```js
Model.graph('sdfsdfsdf')
	.then(function (instance) {
		// success
	}, function (err) {
	    console.log(err.reason); // Cannot map strings onto the object graph.
		assert.ok(err.error);
		assert.notOk(err.ok);
	})
	.catch(function (err) {
	    console.log(err.reason); // Cannot map strings onto the object graph.
		assert.ok(err.error);
		assert.notOk(err.ok);
	});
```

# Logging

Siesta uses the [debug](https://www.npmjs.org/package/debug) module for log output. You can enable all logs by executing the following:

```js
Siesta.log.enable('*');
```

Or for more fine-grained logging:

```js
Siesta.log.enable('siesta:storage');
```

The various loggers are listed below:

* `siesta:cache` - logs related to the in-memory caching of model instances.
* `siesta:mapping` - logs related to the mapping of data to the object graph.
* `siesta:query` - logs related to the querying of local data
* `siesta:storage` - logs related to saving and loading of the object graph to storage.

Note that these settings are saved to the browsers local storage. To disable log output call:

```js
Siesta.log.disable();
```

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
        MyModel.graph({x: 1}, function (err, instance) {
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
Repo.graph({name: 'MyNewRepo'})
    .then(function (repo) {
        myUser.repositories.push(repo);
        myUser.repositories.splice(0, 1); // Remove repo at index 0.
    });
```

In browsers that implement `Object.observe`, notifications will be sent on the next available tick in the event loop. In browsers that do not, notifications will not be sent until `siesta.notify()` is executed. So to ensure that notifications work correctly in all browsers we need to change the above example to the following:

```js
Repo.graph({name: 'MyNewRepo'})
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
        MyModel.graph({attr: 1})
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
        MyModel.graph({attr: 1})
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

