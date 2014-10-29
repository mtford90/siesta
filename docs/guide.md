---
layout: Getting_Started
title: Guide
sidebar: nav2.html
---

# Guide

This guide covers all of Siesta's features and uses the GitHub API to illustrate usage.

* [Create a collection](#collection)
* [Configure mappings](#)
* [Configure descriptors](#)
* [Send HTTP requests](#http)
* [Mapping data without HTTP requests](#)
* [Listen to change notifications](#)
* [Query for local data](#)
* [Utils](#)

<a id="collection"></a>
## Create a collection

`new siesta.Collection(collectionName)` creates a new Collection. A collection organises a set of mappings and optionally descriptors and usually you'd create one per API. 

```js
var GitHub = new siesta.Collection('MyCollection');
GitHub.baseURL = 'https://api.github.com/';
```

`Collection.prototype.install(callback)` setups relationships and registers descriptors and mappings. This needs to be called on each collection that you create.

```js
myColl.install(function () { 
	// ...
});
```

Alternatively you can use promises, which will come in handy if you have many collections to install or other libraries that need setting up before your application can run:

```js
function startMyApp() {
	// ...
}
myColl.install().then(myOtherColl.install()).then(startMyApp)
```

Siesta uses the [q](https://github.com/kriskowal/q) library for promises.

<a id="mappings"></a>
## Configure mappings

`Collection.prototype.mapping(opts)` is used for registering object mappings in a particular collection.

Mappings can really simple and just map attributes e.g. in the case of GitHub users:

```js
var User = GitHub.mapping({
	name: 'User',
    attributes: ['login', 'avatar_url', 'html_url']
});
```

Or we can setup complex relationships between our mappings:

```js
var Repo = GitHub.mapping({
	name: 'Repo',
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
			mapping: 'Repo',
			type: 'OneToMany',
			// A 'forks' property will be added to all Repo instances.
			reverse: 'forks' 
		}
	}
})
```

### Relationships

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

### Singleton Mappings

We can also define singleton mappings, where only ever one model will be instantiated:

```js
// Maps loosely to https://api.github.com
var RateLimit = GitHub.mapping({
	name: 'RateLimit',
	attributes: ['limit', 'remaining', 'reset'],
	singleton: true
});
```

```js
siesta.series([
	function (cb) {
		RateLimit.map({
			limit: 60,
			remaining: 60,
			reset: 1414606386
		}, cb);
	},
	function (cb) {
		RateLimit.map({
			limit: 40,
			remaining: 40,
			reset: 1414602846
		}, cb);
	}
], function (err, objs) {
	console.log(objs[0] == objs[1]); // true
	console.log(objs[0].limit); // 40
	console.log(objs[0].remaining); // 40
	console.log(objs[0].reset); // 1414602846
})
```

<a id="descriptors"></a>
## Configure descriptors

`Collection.prototype.descriptor(opts)` registers a descriptor with a particular collection. A descriptor describes HTTP requests and responses and used by Siesta to decide what changes to make to the object graph on both requests and responses. This is performed through the use of `Mapping.prototype.map` which is also available for mapping arbritray data onto the graph outside of HTTP.


<!-- TODO: Response descriptors -->

```js
GitHub.descriptor({
    path: '/users/(.*)/repos/',
    mapping: Repo,
    method: 'GET'
});
```

<!-- TODO: Nested data on response -->

```js
GitHub.descriptor({
    path: '/search/repositories/',
    mapping: Repo,
    method: 'GET',
    data: 'items'
});
```

```js
GitHub.descriptor({
    path: '/search/repositories/',
    mapping: Repo,
    method: 'GET',
    data: 'items.further.nesting'
});
```

<!-- TODO: Transforms -->  

```js
GitHub.descriptor({
    path: '/users/(.*)/repos/',
    mapping: Repo,
    method: 'GET',
    transforms: {
    	'stargazers_count': 'num_stars'
    }
});
```

<!-- TODO: Request descriptors -->

```js
GitHub.descriptor({
	path: '/repos/(.*)/(.*)/',
	mapping: Repo,
	method: ['PATCH', 'POST'],
})
```

<!-- TODO: Embedding data on request -->

```js
GitHub.descriptor({
	path: '/repos/(.*)/(.*)/',
	mapping: Repo,
	method: ['PATCH', 'POST'],
	data: 'data'
})
```
<!-- TODO: Serialisers (id serialiser) -->
<!-- TODO: Serialisers (depth serialiser) -->
<!-- TODO: Regular expressions in the path -->
<!-- TODO: Transform functions -->

### Serialisation

<!-- TODO: Built-in serialisers -->
<!-- TODO: Custom serialisers -->

<a id="http"></a>
## Send HTTP requests

<!-- TODO: Safe requests (GET/TRACE/HEAD/OPTIONS/CONNECT) -->

`Collection.prototype.<SAFE_HTTP_METHOD>(path, ajaxOptsOrCallback, callbackIfOpts)` sends HTTP requests and uses the descriptors to perform appropriate mappings to the object graph.

```js
GitHub.GET('/users/mtford90/repos').then(function (repos) {
	siesta.each(repos, function (r) { 
		console.log(r.name);
	});
});
```

<!-- TODO: Query parameters -->

```js
GitHub.GET('/search/repositories', {data: 'siesta'}).then(function (repos) {
	siesta.each(repos, function (r) { 
		console.log(r.name);
	});
});
```

<!-- TODO: Unsafe requests (PUT/POST/PATCH/DELETE) -->

```js
GitHub.PATCH('/users/mtford90/repos', myRepo, {fields: }).then(function (repos) {
	siesta.each(repos, function (r) { 
		console.log(r.name);
	});
});
```

<!-- TODO: Set the ajax library -->

<a id="mappingData"></a>
## Mapping data without HTTP requests

You do not have to send HTTP requests to map data into Siesta. If your application loads data from websockets or through other protocols/sources then there needs to be a way to map arbitrary data onto the object graph.

`Mapping.prototype.map(data, callback)` will map data using a particular mapping e.g:

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

<a id="changeNotifications"></a>
### Listen to change notifications

In Siesta notifications are sent for a variety of events, including model creation, modification and removal. Siesta makes use of the [EventEmitter](http://nodejs.org/api/events.html#events_class_events_eventemitter) class for this purpose, borrowed from NodeJS. The following functions can be used for managing notifications:

`siesta.on(notif, handler)` listens to Siesta object change notifications.

```js
function handler(n) {
	console.log(n);
}
siesta.on('GitHub:User', handler);
```

`siesta.off(notif, handler)` removes a specific handler.

```js
siesta.off('GitHub:User', handler);
```

`siesta.once(notif, handler)` listens for one notification and then cancels.

```js
siesta.once('GitHub:User', function (n) {
	console.log(n);
});
```

`siesta.removeAllListeners(notif)` removes all handlers for one particular notification.

```js
siesta.removeAllListeners('GitHub:User');
```

`siesta.removeAllListeners()` removes all handlers across all notifications.

```js
siesta.removeAllListeners();
```

Notifications take the following forms:

* `Siesta` - All notifications

```js
siesta.on('Siesta', function (n) {});
```

* `<Collection>` - All notifications for a particular collection

```js
siesta.on('GitHub', function (n) {});
```

* `<Collection>:<Mapping>` - All notifications for objects generated through a particular mapping in a particular collection.

```js
siesta.on('GitHub:User', function (n) {});
```

* `<Collection>:<Mapping>:<Mapping.id>` - All notifications for an object from a particular mapping with remote identifier Mapping.id (which defaults to 'id')

```js
siesta.on('GitHub:Repo:' + myRepo.id, function (n) {});
```

* `<_id>` - All notifications object with local identifier <_id> where _id is the unique identifier assigned to a Siesta model.

```js
siesta.on(myRepo._id, function (n) {});
```

<!-- TODO: Notification types -->
<!-- TODO: Properties within the notification dictionary. -->

### Caveats

Siesta uses [observe-js](https://github.com/polymer/observe-js) from Polymer to handle changes to arrays. ObserveJS is a (sort-of) shim for `Object.observe` which is currently only available in Chrome. It also comes with certain caveats.

<!-- TODO: Link to HTML5 compatability site for Object.observe -->

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
	siesta.notify(); // Send out all notifications.
});
```

In browsers that implement `Object.observe`, `siesta.notify()` simply does nothing and so it is safe to use throughout your code no matter which browsers you are targeting.

<a id="queries"></a>
### Query for local data

`Mapping.prototype.all(callback)` will return all models mapped by a particular mapping.

```js
User.all(function (err, users) {
	users.forEach(function (u) {
		console.log(u.login);	
	});
});
```

`Mapping.prototype.query(opts, callback)` will return all models that match the query described by `opts`. Many types of queries can be executed, loosely inspired by Django's ORM query conventions:

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

Query for users with names containing 'abc':

```js
User.query({login__contains: 'abc'}, function (err, users) {
	users.forEach(function (u) {
		console.log(u.name);
	});
});
```

## Utils

Siesta makes available various utilities from underscore and asyncjs used throughout the library itself. These are often useful for Siesta users and hence are exposed via the `siesta` object. Note that if you require the full underscore or asyncjs libraries you will need to include these yourself.

<!-- TODO -->

`siesta.map()`
`siesta.each()`
`siesta.partial()`
`siesta.bind()`
`siesta.parallel()`
`siesta.series()`
`siesta.waterfall()`
`siesta.q`
