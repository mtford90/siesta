# Getting Started

## Installation

### Script tag

You can include the full Siesta bundle or include individual components. If you decide to include individual components, ensure that other modules are included **after** core.

```html
<!-- Include the entire bundle -->
<script src="https://github.com/mtford90/siesta/releases/download/{{site.version}}/siesta.min.js"></script>

<!-- OR include individual components. Core must come before any extensions. -->
<script src="https://github.com/mtford90/siesta/releases/download/{{site.version}}/siesta.core.min.js"></script>
<script src="https://github.com/mtford90/siesta/releases/download/{{site.version}}/siesta.http.min.js"></script>
<script src="https://github.com/mtford90/siesta/releases/download/{{site.version}}/siesta.storage.min.js"></script>
```

### CommonJS

Alternatively if you're using a bundler based on CommonJS (browserify, webpack etc) you can `require` siesta and any extensions after running `npm install siesta-orm --save`.

```js
// With no extensions.
var siesta = require('siesta');

// With extensions (this only needs to be done once)
var siesta = require('siesta') ({
    http: require('siesta/http')),
    storage: require('siesta/storage'))
});
```

### Promises

Promises can be used anywhere in Siesta where callbacks are used, provided that [q.js](https://github.com/kriskowal/q) is made available.

```html
<!-- If using script tags -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/q.js/1.1.2/q.js"></script>
<script src="https://github.com/mtford90/siesta/releases/download/{{site.version}}/siesta.min.js"></script>
```

```js
// If using CommonJS.
window.Q = require('q');
```

Once q.js is included in your project you can use promises anywhere in Siesta where you would normally use callbacks.

```js
siesta.install()
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

### relationships

There are three types of relationships, described here with examples from the Github API.



```js
var Repo = Github.Repo('Repo', {
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

Once a relationship is defined, Siesta will automatically manage the reverse of that relationship e.g.

```js
User.map({username: 'bob', id: 5})
    .then(function (bob) {
        Repo.map({name:'A repo', user: 5})
            .then(function (repo) {
                assert.equal(repo.owner, bob);
            });
    });
```

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
            mapping: 'Repo',
            type: 'OneToMany',
            reverse: 'forks'
        }
    }
})
```

### singleton

A singleton model will only ever have one instance, and this instance will be created during the execution of `siesta.install`. 

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
    console.log(objs[0] == objs[1]); // true
    console.log(objs[0].limit); // 40
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
				age__gte: 10,
				age__lte: 19
			}, callback);
		}
	}
});

```

### init

`init` is executed on creation of a model instance.

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

In siesta, the process of creating new instances of models is known as *mapping*. This refers to mapping data onto the object graph.

```js
// Map a single object.
User.map({
	login: 'mtford90',
	avatar_url: 'http://domain.com/path/to/avatar.png',
	id: 123
}).then(function (model) {
    if (!err) console.log(model.login); // mtford90
    else console.error(err);
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

To stop listening to an event, call the return cancelListen function.

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
|   Remove   |  Emitted when model instances are removed from the object graph              | `myModel.remove()` |

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

# Queries

The query API allows for interaction with locally stored instances.

```js
// Get all instances - equivalent to query({})
User.all()
    .execute()
    .then(function (users) {
        users.forEach(function (u) {
            console.log(u.login);
        });
    });

// Query for a user with a particular remote identifier:
User.query({id: 'xyz'})
    .execute()
    .then(function (u) {
        console.log(u.login);
    });

// Query for repos with more than 50 stars
Repo.query({stars__gt: 50})
    .execute()
    .then(function (repos) {
        repos.forEach(function (r) {
            console.log(r.name);
        });
    });
```

## Nested Queries

You can query using dot syntax to access nested objects.

```js
Repo.query({'owner.username': 'mtford90'})
    .execute()
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
}).execute().then(function (repos) {
    // ...
});
```

## Ordering

`Query.prototype.orderBy(... fields)` can be used to order instances.

```js
User.query({age__gte: 18})
    .orderBy('-age', 'name')
    .execute()
    .then(function (results) {
        console.log('results', results);
    });
```

The following queries would achieve the same:

```js
var q = User.query({age__gte: 18})
    		.orderBy('-age')
    		.orderBy('name');

var q = User.query({age__gte: 18})
    		.orderBy(['-age', 'name']);
```

## Comparators

Here are the current built-in comparators

* `<field>` or `<field>__e` -  equality
* `<field>__lt` - less than
* `<field>__lte` - less than or equal to
* `<field>__gt` - greater than
* `<field>__gte` - greater than or equal to

You can register your own comparators.

```js
// A custom < comparator.
siesta.registerComparator('customLt', function (opts) {
    var value = opts.object[opts.field];
    return value < opts.value;
});

Repo.query({stars__customLt: 50})
    .execute()
    .then(function (repos) {
            repos.forEach(function (r) {
            console.log(r.name);
        });
    });
```

Prepending `-` signifies descending order.

# Reactive Queries

Reactive queries exist to support functional reactive programming when using Siesta. For those familar with Apple's Cocoa library and CoreData these are similar to the `NSFetchedResultsController` class. 

A reactive query is a query that reacts to changes in the object graph, updating its result set and emitting events related to these updates.

```js
var rq = User.reactiveQuery({age__gte: 18});
rq.init()
  .then(function (results) {
  	  // results are the same as User.query({age__gte: 18});
  });
```

Reactive queries can be ordered in a similar fashion to ordinary queries.

```js
var rq = User.reactiveQuery({age__gte: 18})
			 .orderBy('-age', 'name');
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

# Positional Reactive Queries

Positional Reactive Queries solve the common use case of manipulating the order of a set of instances. Once models have a value in the index attribute they will remain in that position unless changed using the mutation methods described below. Positional Reactive Queries are useful e.g. for allowing users of the app to apply an order to resources.

```js
var prq = User.positionalReactiveQuery({age__gt: 10});
prq.orderBy('age');
// Model attribute in which to store the position.
prq.indexAttribute = 'index';

User.map([
	{age: 55},
	{age: 25},
	{age: 70}
]).then(function (users) {
	prq.init().then(function () {
		assert.equal(users[0].index, 0);
		assert.equal(users[1].index, 1);
		assert.equal(users[2].index, 2);
		prq.swapObjects(users[0], users[1]);
		assert.equal(users[1].index, 0);
		assert.equal(users[0].index, 1);
		assert.equal(users[2].index, 2);
	});
});
```

There are several ways to mutate the positions of the objects.

```js
// Swap the objects at indexes `from` and `to` and update the index field.
prq.swapObjectsAtIndexes(from, to);
// Swap the objects or throw an error if the objects are not within the result set.
prq.swapObjects(obj1, obj2);
// Move the object at index from to position to
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

`Collection.prototype.descriptor(opts)` registers a descriptor with a particular collection. A descriptor describes HTTP requests and responses and used by Siesta to decide what changes to make to the object graph on both requests and responses. This is performed through the use of `Model.prototype.map` which is also available for mapping arbritrary data onto the graph outside of HTTP.

The below descriptor describes the Github endpoint for obtaining a specific users repositories. `path` is a regular expression, `mapping`tells Siesta what kind of objects to expect from this endpoint and `method` is the HTTP method, list of http methods or a wildcard.

```js
Github.descriptor({
    path: '/users/([a-b0-9]+)/repos/',
    mapping: Repo,
    method: 'GET'
});
```

### Paths

Paths take the form of Javascript regular expressions with one addition - named groups.



### Nested Data

The Github search endpoint nests results in the `items` key. The `data` parameter can be used to deal with this:

```js
Github.descriptor({
    path: '/search/repositories/',
    mapping: Repo,
    // method: '*',
    // method: ['GET', 'PATCH'],
    method: 'GET',
    data: 'items',
    // data: 'items.further.nesting'
});
```

### Transforms

Transforms can be used for simple field conversions:

```js
Github.descriptor({
    path: '/users/([a-b0-9]+)/repos/',
    mapping: Repo,
    method: 'GET',
    transforms: {
        'stargazers_count': 'num_stars'
    }
});
```

We can use dot notation to transform nested data:

```js
Github.descriptor({
    path: '/users/[a-b0-9]+/repos/',
    mapping: Repo,
    method: 'GET',
    transforms: {
        'stargazers_count': 'path.to.num_stars'
    }
});
```

We can also use a function instead:

```js
Github.descriptor({
    path: '/users/[a-b0-9]+/repos/',
    mapping: Repo,
    method: 'GET',
    transforms: {
        'stargazers_count': function (k) {
            return 'path.to.num_stars'
        }
    }
});
```

Or for more complicated transformations you can define a top-level transformation function:

```js
Github.descriptor({
    path: '/users/[a-b0-9]+/repos/',
    mapping: Repo,
    method: 'GET',
    transforms: function (data) {
        var n = data.stargazers_count;
        delete data.stargazers_count;
        data.num_stars = n;
        return data;
    }
});
```

### Request vs. Response

If your descriptor contains unsafe methods then additional options can be passed. The `data` field will tell siesta where to nest outgoing (serialised) data.

```js
Github.descriptor({
    path: '/repos/[a-b0-9]+/[a-b0-9]+/',
    mapping: Repo,
    method: ['PATCH', 'POST'],
    data: 'data'
})
```

### Serialisation

```js
Github.descriptor({
    path: '/repos/[a-b0-9]+/[a-b0-9]+/',
    mapping: Repo,
    method: ['PATCH', 'POST'],
    data: 'data',
    serialiser: siesta.serialisers.id
});
```

```js
Github.descriptor({
    path: '/repos/[a-b0-9]+/[a-b0-9]+/',
    mapping: Repo,
    method: ['PATCH', 'POST'],
    data: 'data',
    serialiser: siesta.serialisers.depth(2)
});
```

## Sending Requests

One descriptors are defined, we can then send HTTP requests and receive HTTP responses through Siesta. Siesta will match against descriptors when determining how to serialise/deserialise objects.

### Safe Methods

Safe methods refer to methods that do not generally change state on the server-side e.g. GET. Object

`Collection.prototype.<SAFE_HTTP_METHOD>(path, ajaxOptsOrCallback, callbackIfOpts)` sends HTTP requests and uses the descriptors to perform appropriate mappings to the object graph.

```js
Github.GET('/users/mtford90/repos').then(function (repos) {
    siesta.each(repos, function (r) {
        console.log(r.name);
    });
});
```

```js
Github.GET('/search/repositories', {data: 'siesta'}).then(function (repos) {
    siesta.each(repos, function (r) {
        console.log(r.name);
    });
});
```

### Unsafe Methods

Unsafe methods refer to methods that can change state on the server-side e.g. POST/PUT/DELETE. Objects are serialised as specified in the matched descriptor.

`Collection.prototype.<UNSAFE_HTTP_METHOD>(path, object, ajaxOptsOrCallback, callbackIfOpts)` sends HTTP requests and uses the descriptors to perform appropriate mappings to the object graph.

```js
Github.PATCH('/users/mtford90/repos', myRepo, {fields: ['name']}).then(function (repos) {
    siesta.each(repos, function (r) {
        console.log(r.name);
    });
});
```

### Custom Ajax

Siesta currently supports jQuery style ajax functions. This can be configured as follows:

```js
siesta.setAjax(zepto.ajax);
```

## Paginator

Siesta features a paginator for managing responses from paginated endpoints.

`Model.paginator(paginatorSettings, ajaxSettings)` creates a paginator object for managing and mapping responses from paginated endpoints. `ajaxSettings` follows the same format as the HTTP methods (i.e. whatever ajax function you specify via `siesta.setAjax` or jQuery by default.

### Configuration

The defaults are as follows:

```js
var paginator = Model.paginator({
    path: null,
    paginator: {
        request: {
            page: 'page',
            queryParams: true, // Place params in URL as query params. If false will be placed in body instead e.g. POST body
            pageSize: 'pageSize'
        },
        response: {
            numPages: 'numPages',
            data: 'data',
            count: 'count'
        }
    },
    ajax: {
        type: 'GET',
        dataType: 'json'
    }
});
```

If our models are nested we can do the following:

```js
paginator = Model.paginator({
    response: {
        data: 'path.to.data'
    }
})
```

We could also define a function instead:

```js
paginator = Model.paginator({
    response: {
        data: function (response, jqXHR) {
            return responseData.path.to.data;
        }
    }
});
```

Same with numPages and count:

```js
paginator = Model.paginator({
    response: {
        numPages: function (response, jqXHR) {
            return jqXHR.getResponseHeader('X-Num-Pages');
        },
        count: function (response, jqXHR) {
            return response.data.total_count;
        }
    }
});
```

The below demonstrates the flexibility of the paginator against the Github API which makes use of the `Link` response header and described [here](https://developer.github.com/guides/traversing-with-pagination/)

```js
paginator = Github.paginator({
    ajax: {
        path: 'search/code?q=addClass+user:mozilla'
    },
    paginator: {
        request: {
            pageSize: 'per_page'
        },
        response: {
            count: 'total_count',
            numPages: function (response, jqXHR) {
                var links = parseLinkHeader(jqXHR.getResponseHeader('Link')),
                    lastURI = links['last'],
                    queryParams = parseQueryParams(lastURI);
                return queryParams['page'];
            },
            data: 'items'
        }

    }
})
```

###  Usage

`paginator.page(page, optionsOrCallback, callback)` returns objects on a specific page.

```js
paginator.page(4)
    .then(function (objects) {
        // objects is the list of objects returned from the endpoint
    });
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

## PouchDB initialisation

It's possible to customise how PouchDB is initialised, e.g. using different storage backends. You can read about setting up PouchDB instances [here](http://pouchdb.com/api.html#create_database) and some more advanced options such as remote CouchDB databases [here](http://pouchdb.com/guides/databases.html).

```js
// The default implementation is as follows
siesta.initPouchDb = function () {
    return new PouchDB('siesta');
};
```

## Dirtyness

A `ModelInstance` is considered dirty if it holds an unsaved change. A `Model` is dirty if there exists an instance that is dirty. A `Collection` is dirty if there exists instances of models within that collection.

```js
instance.attr = 'value';
console.log(instance.dirty); // true
console.log(instance.model.dirty); // true
console.log(instance.collection.dirty); // true
```

# Recipes

This section features various useful examples that demonstrate the power of Siesta and its dependencies.

## HTTP Listeners

TODO: Using jquery to intercept http requests.

## Authentication

TODO: Using HTTP listeners to handle auth headers.

## Global App Configuration

TODO: Using singletons and relationships between singletons to make config objects.

# Logging

`siesta.setLogLevel(loggerName, logLevel)` is used for configuring logging in Siesta.

Logging for various Siesta subsystems can be configured using the following log levels:

* `siesta.LogLevel.trace`
* `siesta.LogLevel.debug`
* `siesta.LogLevel.info`
* `siesta.LogLevel.warn`
* `siesta.LogLevel.error`
* `siesta.LogLevel.fatal`

The various loggers are listed below:

* `Descriptor`: Logger used by HTTP request/response descriptors.
* `RequestDescriptor`: Logger used by request descriptors specifically.
* `ResponseDescriptor`: Logger used by response descriptors specifically.
* `DescriptorRegistry`: All descriptors are registered in the DescriptorRegistry.
* `HTTP`: Logger used by HTTP requests/responses.
* `LocalCache`: Objects are cached by local id (_id) or their remote id. This logger is used by the local object cache.
* `RemoteCache`:  Objects are cached by local id (_id) or their remote id. This logger is used by the remote object cache.
* `changes`: The logger used by change notifications.
* `Collection`: The logger used by the Collection class, which is used to describe a set of mappings.
* `Model`: The logger used by the Model class.
* `MappingOperation`: The logger used during mapping operations, i.e. mapping data onto the object graph.
* `ModelInstance`: The logger used by the ModelInstance class, which makes up the individual nodes of the object graph.
* `Performance`: The logger used by the performance monitoring extension (siesta.perf.js)
* `Query`: The logger used during local queries against the object graph.
* `Store`:
* `Operation`: Much logic in Siesta is tied up in 'Operations'.
* `OperationQueue`: Siesta makes use of queues of operations for managing concurrency and concurrent operation limits.

For example:

```js
siesta.setLogLevel('HTTP', siesta.logLevel.trace);
```


# Caveats

Siesta uses [observe-js](https://github.com/polymer/observe-js) from Polymer to handle changes to arrays. ObserveJS is a (sort-of) shim for `Object.observe` which is currently only available in Chrome at the time of writing. It also comes with certain caveats.

e.g. take the case whereby we are manipulating a user repositories.

```js
Repo.map({name: 'MyNewRepo'}).then(function (repo) {
    myUser.repositories.push(repo);
    myUser.repositories.splice(0, 1); // Remove repo at index 0.
});
```

In browsers that implement `Object.observe`, notifications will be sent on the next available tick in the event loop. In browsers that do not, notifications will not be sent until `siesta.notify()` is executed. So to ensure that notifications work correctly in all browsers we need to change the above example to the following:

```js
Repo.map({name: 'MyNewRepo'}).then(function (repo) {
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



