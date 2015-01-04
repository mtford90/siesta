# Installation

## Methods

### Script Tag

If using script tags you can just to install the entire Siesta bundle or specific modules.

The siesta bundle includes all of the following:

* Core
* HTTP
* Storage

Simply include siesta.js or siesta.min.js.

```html
<script src="https://github.com/mtford90/siesta/releases/download/{{site.version}}/siesta.min.js"></script>
```

Siesta core is the only required module. Ensure that other modules are included **after** core.

```html
<script src="https://github.com/mtford90/siesta/releases/download/{{site.version}}/siesta.core.min.js"></script>
<script src="https://github.com/mtford90/siesta/releases/download/{{site.version}}/siesta.http.min.js"></script>
<script src="https://github.com/mtford90/siesta/releases/download/{{site.version}}/siesta.storage.min.js"></script>
```

### CommonJS

Alternatively if you're using a bundler based on CommonJS (browserify, webpack etc) you can `require` siesta and any extensions after running `npm install siesta-orm --save`.

With no extensions:

```js
var siesta = require('siesta'); // No extensions
```

With extensions.

```js
var siesta = require('siesta') ({
	http: require('siesta/http')),
	storage: require('siesta/storage'))
}); 
```

Note that extensions only need to be declared once. Any further extensions will be ignored after the first declaration

## Promises

Promises can be used anywhere in Siesta where callbacks are used, provided that [q.js](https://github.com/kriskowal/q) is made available.

We recommend including q.js from a CDN.

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/q.js/1.1.2/q.js"></script>
<script src="https://github.com/mtford90/siesta/releases/download/{{site.version}}/siesta.min.js"></script>

```

And from that point forward you can use promises.

```js
var MyCollection = siesta.collection('MyCollection'),
	 MyModel      = MyCollection.model('MyModel', {attributes: ['attr']});
	
siesta.install()
	.then(function () {
		MyModel.map({attr: 'something', id: 1})
			.then(function (instance) {
				console.log('Mapped something!', instance);
			});
	})
	.catch(function (err) {
		console.error('Handle error', err);	
	});
```

## Storage

If you decide to use the storage module then you **must** include PouchDB. If the availability of PouchDB is not detected then storage will be disabled.

```html
<script src="//cdnjs.cloudflare.com/ajax/libs/pouchdb/3.2.0/pouchdb.min.js"></script>
<script src="https://github.com/mtford90/siesta/releases/download/{{site.version}}/siesta.min.js"></script>
```

# Collections

A collection organises a set of mappings and optionally descriptors and usually you'd create one per API.

`new siesta.Collection(collectionName)` creates a new Collection. 

```js
var GitHub = new siesta.Collection('MyCollection');
```

# Models

`Collection.prototype.model(opts)` is used for registering a model in a particular collection.

The simplest model defines only attributes.

```js
var User = GitHub.model('User', {
    attributes: ['login', 'avatar_url', 'html_url']
});
```

A more complex model, for example, could define relationships with other models.

```js
var Repo = GitHub.model('Repo', {
	id: 'id',
	attributes: ['name', 'description', 'url', 'num_watchers', 'num_forks', 'num_stars'],
	relationships: {
		owner: {
			mapping: 'User',
			type: 'OneToMany',
			// A 'repositories' property will be added to all User instances.
			reverse: 'repositories'
		},
		forkedFrom: {
			// Note that it's completely possible to add recursive relationships!
			mapping: 'Repo',
			type: 'OneToMany',
			// A 'forks' property will be added to all Repo instances.
			reverse: 'forks'
		}
	}
})
```

## Definition

### attributes

Attributes are simple data types associated with a model. For example, a `User` model could have a username and an email.

```js
var Collection = siesta.collection('Collection'),
    User = Collection.model({
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

### singleton

A singleton model will only ever have one instance, and this instance will be created during the execution of `siesta.install`. 

```js
// Maps loosely to https://api.github.com
var RateLimit = GitHub.model({
	name: 'RateLimit',
	attributes: ['limit', 'remaining', 'reset'],
	singleton: true
});
```

Anything mapped onto a singleton model will be mapped onto that unique instance.

```js
RateLimit.map([
	{
		limit: 60,
		remaining: 60,
		reset: 1414606386
	},
	{
		limit: 40,
		remaining: 40,
		reset: 1414602846
	}
]).then(function (rateLimits) {
	console.log(objs[0] == objs[1]); // true
	console.log(objs[0].limit); // 40
	console.log(objs[0].remaining); // 40
	console.log(objs[0].reset); // 1414602846
});
```

### relationships

There are three types of relationships, described below with examples from the GitHub API.

* `OneToMany` relationships e.g. one github user has many repositories.

```
GET /users/:username/repos
```

* `OneToOne` relationships e.g. one github user has one rate limit status.

```
GET /rate_limit
```

* `ManyToMany` relationships e.g. many github users can belong to many organisations.

```
GET /users/:username/orgs
```

## Mapping

You do not have to send HTTP requests to map data into Siesta. If your application loads data from websockets or through other protocols/sources then there needs to be a way to map arbitrary data onto the object graph.

`Model.prototype.map(data, callback)` will map data using a particular mapping e.g:

```js
var data = {
	login: 'mtford90',
	avatar_url: 'http://domain.com/path/to/avatar.png',
	id: 123
};

User.map(data, function (err, model) {
	if (!err) console.log(model.login); // mtford90
	else console.error(err);
});
```

Promises can also be used:

```js
User.map(data).then(function (model) {
	console.log(model.login); // mtford90
}, function (err) {
	console.log(err);
});
```

Arrays of data can also be mapped:

```js
var data = [
	{
		login: 'mtford90',
		id: 123
	},
	{
		login: 'bob',
		id: 456
	}
];
User.map(data, function (err, models) {
	models.forEach(function (m) {
		console.log(m.login);
	});
});
```

# Queries

Siesta features an API for querying all instances stored locally in the object graph.

`Model.prototype.all(callback)` will return all models mapped by a particular mapping.

```js
User.all(function (err, users) {
	users.forEach(function (u) {
		console.log(u.login);
	});
});
```

`Model.prototype.query(opts, callback)` will return all models that match the query described by `opts`. Many types of queries can be executed, loosely inspired by Django's ORM query conventions:

Query for a user with a particular local identifier.

```js
User.query({_id: 'xyz', login: 'anotherLogin'}, function (err, u) {
	console.log(u.login);
});
```

Query for a user with a particular remote identifier:

```js
User.query({id: 'xyz', login: 'aLogin'}, function (err, u) {
	console.log(u.login);
});
```

Query for repos with more than 50 stars:

```js
Repo.query({stars__gt: 50}, function (err, repos) {
	repos.forEach(function (r) {
		console.log(r.name);
	});
});
```

Here is the complete list of queries currently possible:

* `<field>` or `<field>__e` -  equality
* `<field>__lt` - less than
* `<field>__lte` - less than or equal to
* `<field>__gt` - greater than
* `<field>__gte` - greater than or equal to

# Events

Siesta emits a wide range of events that can be used 

## Models

There are five events related to changes to `Model` instances.

| Event | Description | Example |
| ----- | ----------- | ------- |
|   Set   | Set events are     | ```modelInstance.attr = 1;``` | 
|   Splice   | Events relating to array modifications, whether attribute or relationship are emitted as splice operations.              |  ```modelInstance.attrArray.reverse()``` |
|   New   |  Emitted when new model instances are created              | `Model.map({id: 2, desc: 'A new model instance!'});` | 
|   Remove   |  Emitted when model instances are removed from the object graph              | `myModel.remove()` |

We can listen to events related to model instances in a particular collection.

```js
Collection.listen(function (e) {
	// ...
});
```

We can listen to events releated to instances of particular models

```js
Model.listen(function (e) {
	// ...
});
```

And we can also listen to events related to particular instances.

```js
Model.map({attr: 'something'})
	.then(function (instance) {
		instance.listen(function (e) {
		
		});
	});
```

All `listen` methods return a function that can be used to remove the listener.

```js
var cancelListen = Something.listen(function (e) { /* ... */ });
cancelListen();
```

### Event Object

Every event features the following fields.

|Field|Description|
|-----|-----------|
|obj|the instance to which this event refers.|
|collection|name of the collection to which the instance belongs|
|model|name of the model of which the modified object is an instance|
|type|type of event, one of Set, Splice, New, Delete|

#### Set Events

Set events have the following extra fields

|Field|Description|
|-----|-----------|
|new|the new value|
|old|the old value|
|field|name of the property that has changed|

#### Splice Events

Splice events have the following extra fields and obey Javascript splice convention of `array.splice(index, numDelete, ... itemsToAdd)

|Field|Description|
|-----|-----------|
|added|instances added to array|
|index|index at which the splice begins|
|removed|removed model instances|
|added|added model instances|
|field|name of the property that refers to the spliced array|

#### New Events

New events have no additional fields.

#### Delete Events

Delete events have no additional fields.

## Registering Listeners

## Raw Events

Whilst most event listening is covered through the use of `listen` methods, it is possible to add handlers to the `EventEmitter` that Siesta uses to emit events.

These raw events are described below. 

| Event         | Description   | Example |
| ------------- |-------------| ------- |
| Siesta        | Events for all model instances. | `siesta.on('Siesta', handler);`  |
| $collection      | Events relating to instances of models in a particular collection.    | `siesta.on('GitHub', handler);`  |
| $collection:$model | Events relating to instances of a particular model.      |`siesta.on('GitHub:Repo', handler);`  |
| $collection:$model:$remoteId | Events relating to an instance of a model with a particular remote identifier. |  `siesta.on('GitHub:Repo:542432', handler);`|
| $id  | Events relating to an object with a particular local identifier. | `siesta.on('25892e17-80f6-415f-9c65-7395632f0223', handler);` |

`siesta.on(notif, handler)` listens to Siesta object change notifications.

```js
var handler = function (e) {
	console.log(e);
};
siesta.on('GitHub:User', handler);
```

`siesta.off(notif, handler)` removes a previously registered handler.

```js
siesta.off('GitHub:User', handler);
```

`siesta.once(notif, handler)` listens for one event and then cancels.

```js
siesta.once('GitHub:User', function (n) {
	console.log(n);
});
```

`siesta.removeAllListeners(notif)` removes all handlers for one particular event.

```js
siesta.removeAllListeners('GitHub:User');
```

`siesta.removeAllListeners()` removes all handlers across all events.

```js
siesta.removeAllListeners();
```

# HTTP

Before using the HTTP extension you first need to define a baseURL on your collection.

```
var Github = siesta.collection('Github');
Github.baseURL = 'https://api.github.com/';
```

## Descriptors

`Collection.prototype.descriptor(opts)` registers a descriptor with a particular collection. A descriptor describes HTTP requests and responses and used by Siesta to decide what changes to make to the object graph on both requests and responses. This is performed through the use of `Model.prototype.map` which is also available for mapping arbritrary data onto the graph outside of HTTP.

The below descriptor describes the GitHub endpoint for obtaining a specific users repositories. `path` is a regular expression, `mapping`tells Siesta what kind of objects to expect from this endpoint and `method` is the HTTP method, list of http methods or a wildcard.

```js
GitHub.descriptor({
    path: '/users/([a-b0-9]+)/repos/',
    mapping: Repo,
    method: 'GET'
});
```

### Paths

Paths take the form of Javascript regular expressions with one addition - named groups.



### Nested Data

The GitHub search endpoint nests results in the `items` key. The `data` parameter can be used to deal with this:

```js
GitHub.descriptor({
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
GitHub.descriptor({
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
GitHub.descriptor({
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
GitHub.descriptor({
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
GitHub.descriptor({
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
GitHub.descriptor({
	path: '/repos/[a-b0-9]+/[a-b0-9]+/',
	mapping: Repo,
	method: ['PATCH', 'POST'],
	data: 'data'
})
```

### Serialisation

```js
GitHub.descriptor({
	path: '/repos/[a-b0-9]+/[a-b0-9]+/',
	mapping: Repo,
	method: ['PATCH', 'POST'],
	data: 'data',
	serialiser: siesta.serialisers.id
});
```

```js
GitHub.descriptor({
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
GitHub.GET('/users/mtford90/repos').then(function (repos) {
	siesta.each(repos, function (r) {
		console.log(r.name);
	});
});
```

```js
GitHub.GET('/search/repositories', {data: 'siesta'}).then(function (repos) {
	siesta.each(repos, function (r) {
		console.log(r.name);
	});
});
```

### Unsafe Methods

Unsafe methods refer to methods that can change state on the server-side e.g. POST/PUT/DELETE. Objects are serialised as specified in the matched descriptor.

`Collection.prototype.<UNSAFE_HTTP_METHOD>(path, object, ajaxOptsOrCallback, callbackIfOpts)` sends HTTP requests and uses the descriptors to perform appropriate mappings to the object graph.

```js
GitHub.PATCH('/users/mtford90/repos', myRepo, {fields: ['name']}).then(function (repos) {
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

The below demonstrates the flexibility of the paginator against the GitHub API which makes use of the `Link` response header and described [here](https://developer.github.com/guides/traversing-with-pagination/)

```js
paginator = GitHub.paginator({
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

# Storage

## PouchDB initialisation

TODO: Custom Pouch DB initialisations

## Save

### Autosave

## Faults

TODO: Once actually implemented faults.

# Recipes

This section features various useful examples that demonstrate the power of Siesta and its dependencies.

## Intercollection Relationships

## PouchDB Synchronisation

TODO: Syncing the 

## HTTP Listeners

TODO: Using jquery to intercept http requests.

## Authentication

TODO: Using HTTP listeners to handle auth headers.

## Global App Configuration

TODO: Using singletons and relationships between singletons to make config objects.

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



