# Install

You can get started with Siesta by manually including it within your project or by forking one of the boilerplate projects.

## Manual Installation

Siesta is available on both bower and npm.

```bash
npm install siesta-orm --save
bower install siesta --save
```

### Script tag

```html
<script src="siesta.min.js"></script>
```

### CommonJS

Alternatively if you're using a bundler based on CommonJS (browserify, webpack etc) you can `require` siesta once you've run `npm install siesta`.

```js
var siesta = require('siesta');
```

### Storage

To enable storage you must include PouchDB. If the availability of PouchDB is not detected then storage will be disabled.

```html
<!-- If using script tags -->
<script src="pouchdb.min.js"></script>
<script src="siesta.min.js"></script>
```

```js
// If using CommonJS.
window.PouchDB = require('pouchdb');
```

# App

To get started with Siesta you must first initialise an app.

```js
var app = siesta.app('myApp');
```

# Collections

A collection organises a set of models. For example we could create a collection for organising models that represent resources on Github.

```js
var Github = app.collection('Github');
```

# Models

Models describe the objects that we are going to represent. Instances of the models will make up the object graph.

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

Define the field that uniquely identifies each model instance. The value of this field will be used by Siesta to determine onto which instance data will be mapped. If an object within the object graph exists with the unique identifier, data will be mapped onto that instance, otherwise a new object will be created.

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
var MyCollection = app.collection('MyCollection'),
    MyOtherCollection = app.collection('MyOtherCollection'),
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
var Collection = app.collection('Collection'),
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
var Collection = app.collection('Collection'),
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
var Collection         = app.collection('Collection'),
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

When data is mapped onto the object graph a new model instance will be created if and only if an instance does not exist with the `id` supplied in the mapped data. Otherwise the data will update an instance that already exists in the object graph.

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

In the case of relationship fields, related objects will automatically be created/updated.

```js
User.graph({login: 'mtford90', id: 123})
    .then(function (user) {
        Repo.graph({
            id: 2,
            name: 'My Repo',
            user: {
                login: 'mtford90',
                id: 123 // The id matches the previous created user.
            }
        }).then(function (repo) {
            assert.equal(repo.user, user);
        });
    });

```

This is also the case with the `Many` side of relationships.

```js

Repo.graph({
    id: 2,
    name: 'My Repo'
}).then(function (repo) {
    User.graph({
        login: 'mtford90',
        id: 123,
        repos: [
            {name: 'My Renamed Repo', id: 2}
        ]
    }).then(function (user) {
      assert.equal(user.repos[0], repo);
      console.log(users.repo[0].name); // My Renamed Repo - the single source of truth was maintained.
    });
});

```

It is often the case that APIs represent relationships with just an identifier. Siesta handles this gracefully.

```js
User.graph({login: 'mtford90', id: 123})
    .then(function (user) {
        Repo.graph({
            id: 2,
            name: 'My Repo',
            user: 123
        }).then(function (repo) {
            assert.equal(repo.user, user);
        });
    });
```

### Collection Level

It's also possible to map data at the collection level.

```js
MyCollection.graph({
    User: [{id: 5, username: 'mike'}, {id: 6, username: 'john'}],
    Email: {subject: 'An email', body: 'An email body', user: 5}
}).then(function (result) {
    var mappedUsers = result.User,
        mappedEmails = result.Email;
});
```

### Siesta Level

Similarly it's also possible to map at the `Siesta` level.

```js
app.graph({
    MyCollection: {
        User: [{id: 5, username: 'mike'}, {id: 6, username: 'john'}],
        Email: {subject: 'An email', body: 'An email body', user: 5}
    },
    // ...
}).then(function (result) {
    var mappedUsers = result.MyCollection.User,
        mappedEmails = result.MyCollection.Email;
});
```

### localId

Siesta assigns each object a unique local identifier which is available at `localId`.

You can query by `localId` using `app.get`.

```js
siesta
  .get('030685b9-938a-46ff-9af3-168dfd198040')
  .then(function (instance) {
    // ...
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
myInstance.delete();
console.log(myInstance.deleted); // true
```

You can restore a deleted instance by calling `restore` however do note that all relationships will now be cleared.

```js
myInstance.restore();
console.log(myInstance.deleted); // false
```

You can also delete objects in bulk.

```js
// Remove all instances of a particular model.
User
  .deleteAll()
  .then(function() {
    // ...
  });

// Remove all instances of a particular collection.
Collection
  .deleteAll()
  .then(function () {
    // ...
  });

// Remove all instances in the app
app
  .deleteAll()
  .then(function () {
    // ...
  });
```

## Events

You can listen to model change events on the `Collection`, `Model` and `ModelInstance` levels.

```js
// Listen to events related to model instances in a particular collection
Collection.on('<event_name>', function (e) {
    // ...
});

// Listen to events related to instances of particular models
Model.on('<event_name>', function (e) {
    // ...
});

// Listen to events related to particular instances
Model.graph({attr: 'something'})
    .then(function (instance) {
        instance.on('<event_name>', function (e) {

        });
    });

// Listen to just one event before canceling the listener automatically.
something.once('<event_name>', function (e) {
    // ...
});
```

`on` returns a function which you can call to stop listening.

```js
var cancel = something.on('<event_name>', function (e) { /* ... */ });
cancel();
```

### Event Names

There are four different event types.

| Event | Description | Example |
| ----- | ----------- | ------- |
|   set   | Set events are     | ```modelInstance.attr = 1;``` |
|   splice   | Events relating to array modifications, whether attribute or relationship are emitted as splice operations.              |  ```modelInstance.attrArray.reverse()``` |
|   new   |  Emitted when new model instances are created              | `Model.graph({id: 2, desc: 'A new model instance!'});` |
|   delete |  Emitted when model instances are deleted from the object graph              | `myInstance.delete()` |
|   add |  Emitted when something is added to an array. Emitted alongside the splice event              | `myInstance.relatedInstances.push(instance)` |
|   remove |  Emitted when something is removed from array. Emitted alongside the splice event              | `myInstance.relatedInstances.splice(0, 1)` |

### The Event Object

Every event features the following fields.

|Field|Description|
|-----|-----------|
|obj|the instance to which this event refers.|
|collection|name of the collection to which the instance belongs|
|model|name of the model of which the modified object is an instance|
|type|type of event, one of Set, Splice, New, Delete|

`set` events have the following extra fields

|Field|Description|
|-----|-----------|
|new|the new value|
|old|the old value|
|field|name of the property that has changed|

`splice` events have the following extra fields and obey Javascript splice convention of `array.splice(index, numDelete, ... itemsToAdd)

|Field|Description|
|-----|-----------|
|added|instances added to array|
|index|index at which the splice begins|
|removed|removed model instances|
|added|added model instances|
|field|name of the property that refers to the spliced array|

`remove` events have the following extra fields

|Field|Description|
|-----|-----------|
|index|index at which the splice begins|
|removed|removed model instances|
|field|name of the property that refers to the spliced array|

`add` events have the following extra fields

|Field|Description|
|-----|-----------|
|index|index at which the splice begins|
|added|added model instances|
|field|name of the property that refers to the spliced array|

`new` and `delete` events do not have any additional fields.

### Custom Events

You can also emit custom events from your models.

```js
var Collection = app.collection('Collection'),
    Model = Collection.model('Model', {
        attributes: ['x', 'y']
    });

Model.graph({x: 1}, function (err, instance) {
    instance.once('customEvent', function (e) {
        assert.equal(e.type == 'customEvent');
    });
    instance.on('customEvent', function (e) {
        assert.equal(e.type == 'customEvent');
    });
    instance.emit('customEvent', {key: 'value'})
});
```

Generally you would wrap custom event emissions up in methods.

```js
var Collection = app.collection('Collection'),
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
var Collection = app.collection('Collection'),
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
    instance.on('<event_name>', function (x) {
        // This will never happen.
        assert.equal(x.field, 'z');
    });
    console.log(instance.z); // 2
});
```

You can get round this by defining attribute dependencies. Once defined, whenever `x` or `y` changes, Siesta will check to see if `z` has also changed. Note that dependencies can only be attributes for now. They cannot be other properties or relationships.

```js
var Collection = app.collection('Collection'),
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

// Query for a repo belonging to a particular user
Repo.query({user: userModelInstance})
    .then(function (repo) {
        // ...
    });

// Query for a repo belonging to a particular user with a particular `id`
Repo.query({user: 563})
    .then(function (repo) {
        // ...
    });
```

## Nested Queries

You can query using dot syntax to access nested objects.

```js
Repo.query({'owner.username': 'mtford90'})
    .then(function (repos) {
        // ...
    });

Repo.query({'owner.id': 123})
    .then(function (repos) {
        // ...
    });
```

## $and/$or

It's also possible to use boolean logic when querying local data.

```js
Repo.query({
	$or: {
	  'user.age__lt': 20,
	  'user.age__gt': 40
	},
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
* `<field>__in` - alias for `<field>__contains`

You can register your own comparators.

```js
// A custom < comparator.
app.registerComparator('customLt', function (opts) {
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

## Result Sets

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
```

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
Repo.query({stars__gte: 1000})
  .then(function (repoResultSet) {
      var mutableArrayOfRepos = repoResultSet.asArray();
  });
```

## localId

Siesta assigns each object a unique local identifier which is available at `localId`.

You can query by `localId` using `app.get`.

```js
siesta
  .get('030685b9-938a-46ff-9af3-168dfd198040')
  .then(function (instance) {
    // ...
  });
```

# Reactive Programming

As well as the various events documented so far Siesta features various other mechanisms to support Reactive Programming.

## Queries

We can react to changes in query result sets by registering event handlers.
```js
var query = Repo
  .query({
      stars__gte: 1000,
      __order: '-stars'
  })
  .then(function (results) {
      // Called once with the initial results.
  })
  .on('new', function (e) {
      // Fired whenever a new repo matching the query is created/modified.
  })
  .on('set', function (e) {
      // Fired when a member of the result undergoes an attribute change that doesn't cause it to be removed/added
      // from the result set.
  });
```

Cancel all event handlers created in a particular chain by calling `cancel`.

```js
query.cancel();
```

Force update the result set by calling `update`. (Should very rarely need to do this - only when something changes outside of Siesta's event loop).

```js
query.update();
```

### Events

The event objects emitted on changes to query result sets are similar to those described in the [model events section](#events).

Reactive Query events are emitted under 4 circumstances:

* `splice`: The result set of the query has changed.
* `new`, `set`, `splice`: An object in the result set has changed but not removed. In this instance, the change object will be an event described in the 

`e.obj` will either be an object in the result set that has changed, or the query result set itself.

### Insertion Policy

If no order is defined then by default Siesta will push any new instances in the Reactive Query to the back. You can change this by setting the insertion policy.

```js
var query = Repo
  .query({
      stars__gte: 1000,
      __order: '-stars',
      __insertion_policy: 'back' // Or 'front'
  })
  .on('new', function (e) {
      // Fired whenever a new repo matching the query is created/modified.
  });
```

# Serialisation

`Serialisation` is the process of getting a model instance ready for conversion into a data transfer format like JSON e.g. eliminating circular references.


`siesta.serializer(model, opts)` will create a serialiser.

```js
var s = siesta.serialiser(Model, {
	// Should null attributes be serialised?
	nullAttributes: false,
	// Should null relationships be serialised?
	nullRelationships: false,
	// Configure how the value of each attribute/relationship should serialised.
	fields: {
		field1: function (value) {
			return value;
		},
		// ...
		fieldN: function(value) {
			// Returning undefined means that the field will not be serialised.
			return undefined;
		}
	},
	// Alternatively, you can specify an array of fields to serialise.
	// fields: ['field1', 'field2'],
	// Or mix them up
	// fields: ['field1', {
	//	  field2: function (value) {
	//	      return value.toLowerCase();
	//	  }
	// }],
	// These fields will not be serialised.
	exclude: ['field3']
});

var serialised = s.serialise(instance);
```

By default, Siesta will serialise your instances with a depth of 1, that is, all relationships will be serialised to their `id` or arrays of `id` depending on the type of relationship. Null and undefined attributes will be ignored.

# Deserialisation

`Deserialisation` is the process of converting data (e.g. JSON data returned from a remote API) into model instances within the object graph of your app.

Using a deserialiser is similar to using `Model.graph` however adds an extra layer where you can manipulate the data before it is mapped on the object graph.

Configuration is similar to `siesta.serialiser`:

```js
var d = siesta.deserialiser(Model, {
	// Configure how the value of each attribute/relationship should deserialised.
	fields: {
		field1: function (value) {
			return value;
		},
		// ...
		fieldN: function(value) {
			// Returning undefined means that the field will not be serialised.
			return undefined;
		}
	},
	// Alternatively, you can specify an array of fields that should be deserialised
	// fields: ['field1', 'field2'],
	// Or mix them up
	// fields: ['field1', {
	//	  field2: function (value) {
	//	      return value.toLowerCase();
	//	  }
	// }],
	// These fields will not be deserialised.
	exclude: ['field3']
});

d.deserialise(data).then(function (instance) {
	// data has now been mapped onto the object graph.
});
```

# Storage

The Siesta storage extension is responsible for storing model instances locally. Models are loaded from the local database automatically when the app starts. (Note: this is inefficient and is planned to change once faults are introduced, in a similar fashion to Apple's CoreData)

## Save

`app.save([callback])` will save all changes to Siesta models to PouchDB.

```js
app.save()
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
app.autosave = true;
app.autosaveInterval = 1000; // How regularly to check for changes to save.
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

You can inject your own instance pouch by passing your pouch instance when setting up Siesta. 

```js
var app = siesta.app('myApp', {storage: {pouch: new PouchDB(opts)}});
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

# Contexts

It can often be the case that we need multiple object graphs for the same set of collections/models in our app.

A context encapsulates an object graph - you can think of it as a clean scratch pad for creating and manipulating models. 

You can then selectively merge your contexts. For example, a common pattern is to have a base context with storage enabled, and an in-memory context which is then selectively synced into the storage enabled context at will.

You can create a context by calling `.context()`

```js
var app = siesta.app('myApp', {storage: true});
var context = app.context('myContext', {storage: false})
```

You can also create another context from a context.

```js
var yetAnotherContext = context.context('yetAnotherContext');
```

Contexts behave and have the same methods as the app.

## Merge

You can merge contexts at different levels of granularity.

```js
// Merge a whole context into the main context.
app.merge(context)
   .then(function (instancesInMainContext) { /* ... */ });

// Merge all instances belonging to a particular collection into the main context.
app.merge(context.Collection)
   .then(function (instancesInMainContext) { /* ... */ });

// Merge all instances belong to a particular model into the main context.
app.merge(context.Collection.Model)
   .then(function (instancesInMainContext) { /* ... */ });

// Merge a single instance into the main context.
context.Collection.Model.graph({
	attr: 'something',
	id: 1
}).then(function (instance) {
	app.merge(instance)
	   .then(function (instancesInMainContext) { /* ... */ });
});

// Merge multiple instances into the main context
context.Collection.Model.graph([
	{attr: 'something', id: 1},
	{attr: 'something else', id: 2}
]).then(function (instance) {
	app.merge(instances)
	   .then(function (instancesInMainContext) { /* ... */ });
});
```

# Recipes

This section features various useful examples that demonstrate the power of Siesta and its dependencies.

## App Settings

If you need to manage settings in your app you can use singletons, and relationships between them e.g.

```js
var Collection = app.collection('Collection'),
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
    settings.someMoreSettings.on('set', function (e) {
        console.log('Some more settings changed!', e);
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
siesta.log.enable('*');
```

Or for more fine-grained logging:

```js
siesta.log.enable('siesta:storage');
```

The various loggers are listed below:

* `siesta:cache` - logs related to the in-memory caching of model instances.
* `siesta:mapping` - logs related to the mapping of data to the object graph.
* `siesta:query` - logs related to the querying of local data
* `siesta:storage` - logs related to saving and loading of the object graph to storage.

Note that these settings are saved to the browsers local storage. To disable log output call:

```js
siesta.log.disable();
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

In browsers that implement `Object.observe`, notifications will be sent on the next available tick in the event loop. In browsers that do not, notifications will not be sent until `app.notify()` is executed. So to ensure that notifications work correctly in all browsers we need to change the above example to the following:

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