---
layout: Getting_Started
title: API
sidebar: nav2.html
---
#Index

**Modules**

* [collection](#module_collection)
  * [collection~requestDescriptor(opts)](#module_collection..requestDescriptor)
  * [collection~responseDescriptor(opts)](#module_collection..responseDescriptor)
  * [class: collection~Collection](#module_collection..Collection)
    * [new collection~Collection(name)](#new_module_collection..Collection)
    * [collection.baseURL](#module_collection..Collection#baseURL)
    * [collection.installed](#module_collection..Collection#installed)
    * [collection.install(callback)](#module_collection..Collection#install)
    * [collection._finaliseInstallation(err, callback)](#module_collection..Collection#_finaliseInstallation)
    * [collection._mapping(name, mapping)](#module_collection..Collection#_mapping)
    * [collection.mapping(optsOrName, opts)](#module_collection..Collection#mapping)
    * [collection._descriptor(registrationFunc)](#module_collection..Collection#_descriptor)
    * [collection.requestDescriptor(opts)](#module_collection..Collection#requestDescriptor)
    * [collection.responseDescriptor(opts)](#module_collection..Collection#responseDescriptor)
    * [collection._dump(asJson)](#module_collection..Collection#_dump)
    * [collection.GET(path, optsOrCallback, callback)](#module_collection..Collection#GET)
    * [collection.OPTIONS(path, optsOrCallback, callback)](#module_collection..Collection#OPTIONS)
    * [collection.TRACE(path, optsOrCallback, callback)](#module_collection..Collection#TRACE)
    * [collection.HEAD(path, optsOrCallback, callback)](#module_collection..Collection#HEAD)
    * [collection.POST(path, model, optsOrCallback, callback)](#module_collection..Collection#POST)
    * [collection.PUT(path, model, optsOrCallback, callback)](#module_collection..Collection#PUT)
    * [collection.PATCH(path, model, optsOrCallback, callback)](#module_collection..Collection#PATCH)
    * [collection.DELETE(path, model, optsOrCallback, callback)](#module_collection..Collection#DELETE)
    * [collection.count(callback)](#module_collection..Collection#count)
* [http](#module_http)
  * [http~_httpResponse(method, path, optsOrCallback, callback)](#module_http.._httpResponse)
  * [http~_httpRequest(method, path, object, optsOrCallback, callback)](#module_http.._httpRequest)
  * [http~DELETE(collection, path, model, optsOrCallback, callback)](#module_http..DELETE)
  * [http~HTTP_METHOD(collection, request, method)](#module_http..HTTP_METHOD)
  * [http~GET(collection, path, optsOrCallback, callback)](#module_http..GET)
  * [http~OPTIONS(collection, path, optsOrCallback, callback)](#module_http..OPTIONS)
  * [http~TRACE(collection, path, optsOrCallback, callback)](#module_http..TRACE)
  * [http~HEAD(collection, path, optsOrCallback, callback)](#module_http..HEAD)
  * [http~POST(collection, path, model, optsOrCallback, callback)](#module_http..POST)
  * [http~PUT(collection, path, model, optsOrCallback, callback)](#module_http..PUT)
  * [http~PATCH(collection, path, model, optsOrCallback, callback)](#module_http..PATCH)
* [store](#module_store)
  * [store~get(opts, callback)](#module_store..get)
  * [store~getMultipleLocal(localIdentifiers, callback)](#module_store..getMultipleLocal)
* [cache](#module_cache)
  * [cache~getViaLocalId(localId)](#module_cache..getViaLocalId)
  * [cache~getSingleton(mapping)](#module_cache..getSingleton)
  * [cache~getViaRemoteId(remoteId, opts)](#module_cache..getViaRemoteId)
  * [cache~remoteInsert(obj, remoteId, previousRemoteId)](#module_cache..remoteInsert)
  * [cache~remoteDump(asJson)](#module_cache..remoteDump)
  * [cache~localDump(asJson)](#module_cache..localDump)
  * [cache~dump(asJson)](#module_cache..dump)
  * [cache~get(opts)](#module_cache..get)
  * [cache~insert(obj)](#module_cache..insert)
  * [cache~contains(obj)](#module_cache..contains)
  * [cache~remove(obj)](#module_cache..remove)

**Classes**

* [class: Descriptor](#Descriptor)
  * [new Descriptor(opts)](#new_Descriptor)
  * [descriptor._matchPath(path)](#Descriptor#_matchPath)
  * [descriptor._matchMethod(method)](#Descriptor#_matchMethod)
  * [descriptor._extractData(data)](#Descriptor#_extractData)
  * [descriptor._matchConfig(config)](#Descriptor#_matchConfig)
  * [descriptor._matchData(data)](#Descriptor#_matchData)
  * [descriptor.match(config, data)](#Descriptor#match)
  * [descriptor._transformData(data)](#Descriptor#_transformData)
* [class: ResponseDescriptor](#ResponseDescriptor)
  * [new ResponseDescriptor(opts)](#new_ResponseDescriptor)

**Functions**

* [bury(obj, data)](#bury)

**Members**

* [path](#path)
 
<a name="module_collection"></a>
#collection
**Members**

* [collection](#module_collection)
  * [collection~requestDescriptor(opts)](#module_collection..requestDescriptor)
  * [collection~responseDescriptor(opts)](#module_collection..responseDescriptor)
  * [class: collection~Collection](#module_collection..Collection)
    * [new collection~Collection(name)](#new_module_collection..Collection)
    * [collection.baseURL](#module_collection..Collection#baseURL)
    * [collection.installed](#module_collection..Collection#installed)
    * [collection.install(callback)](#module_collection..Collection#install)
    * [collection._finaliseInstallation(err, callback)](#module_collection..Collection#_finaliseInstallation)
    * [collection._mapping(name, mapping)](#module_collection..Collection#_mapping)
    * [collection.mapping(optsOrName, opts)](#module_collection..Collection#mapping)
    * [collection._descriptor(registrationFunc)](#module_collection..Collection#_descriptor)
    * [collection.requestDescriptor(opts)](#module_collection..Collection#requestDescriptor)
    * [collection.responseDescriptor(opts)](#module_collection..Collection#responseDescriptor)
    * [collection._dump(asJson)](#module_collection..Collection#_dump)
    * [collection.GET(path, optsOrCallback, callback)](#module_collection..Collection#GET)
    * [collection.OPTIONS(path, optsOrCallback, callback)](#module_collection..Collection#OPTIONS)
    * [collection.TRACE(path, optsOrCallback, callback)](#module_collection..Collection#TRACE)
    * [collection.HEAD(path, optsOrCallback, callback)](#module_collection..Collection#HEAD)
    * [collection.POST(path, model, optsOrCallback, callback)](#module_collection..Collection#POST)
    * [collection.PUT(path, model, optsOrCallback, callback)](#module_collection..Collection#PUT)
    * [collection.PATCH(path, model, optsOrCallback, callback)](#module_collection..Collection#PATCH)
    * [collection.DELETE(path, model, optsOrCallback, callback)](#module_collection..Collection#DELETE)
    * [collection.count(callback)](#module_collection..Collection#count)

<a name="module_collection..requestDescriptor"></a>
##collection~requestDescriptor(opts)
Create RequestDescriptor object.

**Params**

- opts `Object`  

**Scope**: inner function of [collection](#module_collection)  
**Type**: `InternalSiestaError`  
**Returns**: `RequestDescriptor`  
<a name="module_collection..responseDescriptor"></a>
##collection~responseDescriptor(opts)
Create and register ResponseDescriptor object.

**Params**

- opts `Object`  

**Scope**: inner function of [collection](#module_collection)  
**Type**: `InternalSiestaError`  
**Returns**: [ResponseDescriptor](#ResponseDescriptor)  
<a name="module_collection..Collection"></a>
##class: collection~Collection
**Members**

* [class: collection~Collection](#module_collection..Collection)
  * [new collection~Collection(name)](#new_module_collection..Collection)
  * [collection.baseURL](#module_collection..Collection#baseURL)
  * [collection.installed](#module_collection..Collection#installed)
  * [collection.install(callback)](#module_collection..Collection#install)
  * [collection._finaliseInstallation(err, callback)](#module_collection..Collection#_finaliseInstallation)
  * [collection._mapping(name, mapping)](#module_collection..Collection#_mapping)
  * [collection.mapping(optsOrName, opts)](#module_collection..Collection#mapping)
  * [collection._descriptor(registrationFunc)](#module_collection..Collection#_descriptor)
  * [collection.requestDescriptor(opts)](#module_collection..Collection#requestDescriptor)
  * [collection.responseDescriptor(opts)](#module_collection..Collection#responseDescriptor)
  * [collection._dump(asJson)](#module_collection..Collection#_dump)
  * [collection.GET(path, optsOrCallback, callback)](#module_collection..Collection#GET)
  * [collection.OPTIONS(path, optsOrCallback, callback)](#module_collection..Collection#OPTIONS)
  * [collection.TRACE(path, optsOrCallback, callback)](#module_collection..Collection#TRACE)
  * [collection.HEAD(path, optsOrCallback, callback)](#module_collection..Collection#HEAD)
  * [collection.POST(path, model, optsOrCallback, callback)](#module_collection..Collection#POST)
  * [collection.PUT(path, model, optsOrCallback, callback)](#module_collection..Collection#PUT)
  * [collection.PATCH(path, model, optsOrCallback, callback)](#module_collection..Collection#PATCH)
  * [collection.DELETE(path, model, optsOrCallback, callback)](#module_collection..Collection#DELETE)
  * [collection.count(callback)](#module_collection..Collection#count)

<a name="new_module_collection..Collection"></a>
###new collection~Collection(name)
A collection describes a set of models and optionally a REST API which we would
like to model.

**Params**

- name   

**Scope**: inner class of [collection](#module_collection)  
**Example**

```js
var GitHub = new siesta.Collection('GitHub')
// ... configure mappings, descriptors etc ...
GitHub.install(function () {
    // ... carry on.
});
```

<a name="module_collection..Collection#baseURL"></a>
###collection.baseURL
The URL of the API e.g. http://api.github.com

**Type**: `string`  
<a name="module_collection..Collection#installed"></a>
###collection.installed
Set to true if installation has succeeded. You cannot use the collectio

**Type**: `boolean`  
<a name="module_collection..Collection#install"></a>
###collection.install(callback)
Ensure mappings are installed.

**Params**

- callback   

<a name="module_collection..Collection#_finaliseInstallation"></a>
###collection._finaliseInstallation(err, callback)
Mark this collection as installed, and place the collection on the global Siesta object.

**Params**

- err `Object`  
- callback `function`  

<a name="module_collection..Collection#_mapping"></a>
###collection._mapping(name, mapping)
Given the name of a mapping and an options object describing the mapping, creating a Mapping
object, install it and return it.

**Params**

- name `String`  
- mapping `Object`  

**Returns**: `Mapping`  
<a name="module_collection..Collection#mapping"></a>
###collection.mapping(optsOrName, opts)
Registers a mapping with this collection.

**Params**

- optsOrName `String` | `Object` - An options object or the name of the mapping. Must pass options as second param if specify name.  
- opts `Object` - Options if name already specified.  

**Returns**: `Mapping`  
<a name="module_collection..Collection#_descriptor"></a>
###collection._descriptor(registrationFunc)
Marshals arguments used to create Descriptor and then calls the registration function.

**Params**

- registrationFunc `function` - Responsible for registering the descriptor.  

**Returns**: [Descriptor](#Descriptor)  
<a name="module_collection..Collection#requestDescriptor"></a>
###collection.requestDescriptor(opts)
Register a request descriptor for this collection.

**Params**

- opts `Object`  

**Returns**: `RequestDescriptor` - A request descriptor  
**Example**

```js
collection.requestDescriptor({
    path: 'cars/(?P<id>)/'
    method: 'PUT',
    mapping: 'Car',
    data: 'data'
});
```

<a name="module_collection..Collection#responseDescriptor"></a>
###collection.responseDescriptor(opts)
Register a response descriptor for this collection.

**Params**

- opts `Object`  

**Example**

```js
responseDescriptor = new siesta.ext.http.ResponseDescriptor({
   mapping: 'Car',
   transforms: {
       'colour': 'path.to.colour'
   }
});
```

<a name="module_collection..Collection#_dump"></a>
###collection._dump(asJson)
Dump this collection as JSON

**Params**

- asJson `Boolean` - Whether or not to apply JSON.stringify  

**Returns**: `String` | `Object`  
<a name="module_collection..Collection#GET"></a>
###collection.GET(path, optsOrCallback, callback)
Send a GET request

**Params**

- path `String` - The path to the resource we want to GET  
- optsOrCallback `Object` | `function` - Either an options object or a callback if can use defaults  
- callback `function` - Callback if opts specified.  

**Returns**: `Promise`  
<a name="module_collection..Collection#OPTIONS"></a>
###collection.OPTIONS(path, optsOrCallback, callback)
Send a OPTIONS request

**Params**

- path `String` - The path to the resource to which we want to send an OPTIONS request  
- optsOrCallback `Object` | `function` - Either an options object or a callback if can use defaults  
- callback `function` - Callback if opts specified.  

**Returns**: `Promise`  
<a name="module_collection..Collection#TRACE"></a>
###collection.TRACE(path, optsOrCallback, callback)
Send a TRACE request

**Params**

- path <code>[path](#path)</code> - The path to the resource to which we want to send a TRACE request  
- optsOrCallback `Object` | `function` - Either an options object or a callback if can use defaults  
- callback `function` - Callback if opts specified.  

**Returns**: `Promise`  
<a name="module_collection..Collection#HEAD"></a>
###collection.HEAD(path, optsOrCallback, callback)
Send a HEAD request

**Params**

- path `String` - The path to the resource to which we want to send a HEAD request  
- optsOrCallback `Object` | `function` - Either an options object or a callback if can use defaults  
- callback `function` - Callback if opts specified.  

**Returns**: `Promise`  
<a name="module_collection..Collection#POST"></a>
###collection.POST(path, model, optsOrCallback, callback)
Send a POST request

**Params**

- path `String` - The path to the resource to which we want to send a POST request  
- model `SiestaModel` - The model that we would like to POST  
- optsOrCallback `Object` | `function` - Either an options object or a callback if can use defaults  
- callback `function` - Callback if opts specified.  

**Returns**: `Promise`  
<a name="module_collection..Collection#PUT"></a>
###collection.PUT(path, model, optsOrCallback, callback)
Send a PUT request

**Params**

- path `String` - The path to the resource to which we want to send a PUT request  
- model `SiestaModel` - The model that we would like to PUT  
- optsOrCallback `Object` | `function` - Either an options object or a callback if can use defaults  
- callback `function` - Callback if opts specified.  

**Returns**: `Promise`  
<a name="module_collection..Collection#PATCH"></a>
###collection.PATCH(path, model, optsOrCallback, callback)
Send a PATCH request

**Params**

- path `String` - The path to the resource to which we want to send a PATCH request  
- model `SiestaModel` - The model that we would like to PATCH  
- optsOrCallback `Object` | `function` - Either an options object or a callback if can use defaults  
- callback `function` - Callback if opts specified.  

**Returns**: `Promise`  
<a name="module_collection..Collection#DELETE"></a>
###collection.DELETE(path, model, optsOrCallback, callback)
Send a DELETE request. Also removes the object.

**Params**

- path `String` - The path to the resource to which we want to DELETE  
- model `SiestaModel` - The model that we would like to PATCH  
- optsOrCallback `Object` | `function` - Either an options object or a callback if can use defaults  
- callback `function` - Callback if opts specified.  

**Returns**: `Promise`  
<a name="module_collection..Collection#count"></a>
###collection.count(callback)
Returns the number of objects in this collection.

**Params**

- callback   

**Returns**: `Promise`  
<a name="module_http"></a>
#http
Provisions usage of $.ajax and similar functions to send HTTP requests mapping
the results back onto the object graph automatically.

**Members**

* [http](#module_http)
  * [http~_httpResponse(method, path, optsOrCallback, callback)](#module_http.._httpResponse)
  * [http~_httpRequest(method, path, object, optsOrCallback, callback)](#module_http.._httpRequest)
  * [http~DELETE(collection, path, model, optsOrCallback, callback)](#module_http..DELETE)
  * [http~HTTP_METHOD(collection, request, method)](#module_http..HTTP_METHOD)
  * [http~GET(collection, path, optsOrCallback, callback)](#module_http..GET)
  * [http~OPTIONS(collection, path, optsOrCallback, callback)](#module_http..OPTIONS)
  * [http~TRACE(collection, path, optsOrCallback, callback)](#module_http..TRACE)
  * [http~HEAD(collection, path, optsOrCallback, callback)](#module_http..HEAD)
  * [http~POST(collection, path, model, optsOrCallback, callback)](#module_http..POST)
  * [http~PUT(collection, path, model, optsOrCallback, callback)](#module_http..PUT)
  * [http~PATCH(collection, path, model, optsOrCallback, callback)](#module_http..PATCH)

<a name="module_http.._httpResponse"></a>
##http~_httpResponse(method, path, optsOrCallback, callback)
Send a HTTP request to the given method and path parsing the response.

**Params**

- method `String`  
- path `String` - The path to the resource we want to GET  
- optsOrCallback `Object` | `function` - Either an options object or a callback if can use defaults  
- callback `function` - Callback if opts specified.  

**Scope**: inner function of [http](#module_http)  
<a name="module_http.._httpRequest"></a>
##http~_httpRequest(method, path, object, optsOrCallback, callback)
Send a HTTP request to the given method and path

**Params**

- method `String`  
- path `String` - The path to the resource we want to GET  
- object `SiestaModel` - The model we're pushing to the server  
- optsOrCallback `Object` | `function` - Either an options object or a callback if can use defaults  
- callback `function` - Callback if opts specified.  

**Scope**: inner function of [http](#module_http)  
<a name="module_http..DELETE"></a>
##http~DELETE(collection, path, model, optsOrCallback, callback)
Send a DELETE request. Also removes the object.

**Params**

- collection `Collection`  
- path `Stirng` - The path to the resource to which we want to DELETE  
- model `SiestaModel` - The model that we would like to PATCH  
- optsOrCallback `Object` | `function` - Either an options object or a callback if can use defaults  
- callback `function` - Callback if opts specified.  

**Scope**: inner function of [http](#module_http)  
**Returns**: `Promise`  
<a name="module_http..HTTP_METHOD"></a>
##http~HTTP_METHOD(collection, request, method)
Send a HTTP request using the given method

**Params**

- collection `Collection`  
- request  - Does the request contain data? e.g. POST/PATCH/PUT will be true, GET will false  
- method   

**Scope**: inner function of [http](#module_http)  
**Returns**: `Promise`  
<a name="module_http..GET"></a>
##http~GET(collection, path, optsOrCallback, callback)
Send a GET request

**Params**

- collection `Collection`  
- path `String` - The path to the resource we want to GET  
- optsOrCallback `Object` | `function` - Either an options object or a callback if can use defaults  
- callback `function` - Callback if opts specified.  

**Scope**: inner function of [http](#module_http)  
**Returns**: `Promise`  
<a name="module_http..OPTIONS"></a>
##http~OPTIONS(collection, path, optsOrCallback, callback)
Send an OPTIONS request

**Params**

- collection `Collection`  
- path `String` - The path to the resource we want to GET  
- optsOrCallback `Object` | `function` - Either an options object or a callback if can use defaults  
- callback `function` - Callback if opts specified.  

**Scope**: inner function of [http](#module_http)  
**Returns**: `Promise`  
<a name="module_http..TRACE"></a>
##http~TRACE(collection, path, optsOrCallback, callback)
Send an TRACE request

**Params**

- collection `Collection`  
- path `String` - The path to the resource we want to GET  
- optsOrCallback `Object` | `function` - Either an options object or a callback if can use defaults  
- callback `function` - Callback if opts specified.  

**Scope**: inner function of [http](#module_http)  
**Returns**: `Promise`  
<a name="module_http..HEAD"></a>
##http~HEAD(collection, path, optsOrCallback, callback)
Send an HEAD request

**Params**

- collection `Collection`  
- path `String` - The path to the resource we want to GET  
- optsOrCallback `Object` | `function` - Either an options object or a callback if can use defaults  
- callback `function` - Callback if opts specified.  

**Scope**: inner function of [http](#module_http)  
**Returns**: `Promise`  
<a name="module_http..POST"></a>
##http~POST(collection, path, model, optsOrCallback, callback)
Send an POST request

**Params**

- collection `Collection`  
- path `String` - The path to the resource we want to GET  
- model `SiestaModel` - The model that we would like to POST  
- optsOrCallback `Object` | `function` - Either an options object or a callback if can use defaults  
- callback `function` - Callback if opts specified.  

**Scope**: inner function of [http](#module_http)  
**Returns**: `Promise`  
<a name="module_http..PUT"></a>
##http~PUT(collection, path, model, optsOrCallback, callback)
Send an PUT request

**Params**

- collection `Collection`  
- path `String` - The path to the resource we want to GET  
- model `SiestaModel` - The model that we would like to POST  
- optsOrCallback `Object` | `function` - Either an options object or a callback if can use defaults  
- callback `function` - Callback if opts specified.  

**Scope**: inner function of [http](#module_http)  
**Returns**: `Promise`  
<a name="module_http..PATCH"></a>
##http~PATCH(collection, path, model, optsOrCallback, callback)
Send an PATCH request

**Params**

- collection `Collection`  
- path `String` - The path to the resource we want to GET  
- model `SiestaModel` - The model that we would like to POST  
- optsOrCallback `Object` | `function` - Either an options object or a callback if can use defaults  
- callback `function` - Callback if opts specified.  

**Scope**: inner function of [http](#module_http)  
**Returns**: `Promise`  
<a name="module_store"></a>
#store
The "store" is responsible for mediating between the in-memory cache and any persistent storage.
Note that persistent storage has not been properly implemented yet and so this is pretty useless.
All queries will go straight to the cache instead.

**Members**

* [store](#module_store)
  * [store~get(opts, callback)](#module_store..get)
  * [store~getMultipleLocal(localIdentifiers, callback)](#module_store..getMultipleLocal)

<a name="module_store..get"></a>
##store~get(opts, callback)
[get description]

**Params**

- opts `Object`  
- callback `function`  

**Scope**: inner function of [store](#module_store)  
**Returns**: `Promise`  
**Example**

```js
var xyz = 'afsdf';
```

**Example**

```js
var abc = 'asdsd';
```

<a name="module_store..getMultipleLocal"></a>
##store~getMultipleLocal(localIdentifiers, callback)
Uses pouch bulk fetch API. Much faster than getMultiple.

**Params**

- localIdentifiers   
- callback   

**Scope**: inner function of [store](#module_store)  
<a name="module_cache"></a>
#cache
This is an in-memory cache for models. Models are cached by local id (_id) and remote id (defined by the mapping).
Lookups are performed against the cache when mapping.

**Members**

* [cache](#module_cache)
  * [cache~getViaLocalId(localId)](#module_cache..getViaLocalId)
  * [cache~getSingleton(mapping)](#module_cache..getSingleton)
  * [cache~getViaRemoteId(remoteId, opts)](#module_cache..getViaRemoteId)
  * [cache~remoteInsert(obj, remoteId, previousRemoteId)](#module_cache..remoteInsert)
  * [cache~remoteDump(asJson)](#module_cache..remoteDump)
  * [cache~localDump(asJson)](#module_cache..localDump)
  * [cache~dump(asJson)](#module_cache..dump)
  * [cache~get(opts)](#module_cache..get)
  * [cache~insert(obj)](#module_cache..insert)
  * [cache~contains(obj)](#module_cache..contains)
  * [cache~remove(obj)](#module_cache..remove)

<a name="module_cache..getViaLocalId"></a>
##cache~getViaLocalId(localId)
Return the object in the cache given a local id (_id)

**Params**

- localId `String`  

**Scope**: inner function of [cache](#module_cache)  
**Returns**: `SiestaModel`  
<a name="module_cache..getSingleton"></a>
##cache~getSingleton(mapping)
Return the singleton object given a singleton mapping.

**Params**

- mapping `Mapping`  

**Scope**: inner function of [cache](#module_cache)  
**Returns**: `SiestaModel`  
<a name="module_cache..getViaRemoteId"></a>
##cache~getViaRemoteId(remoteId, opts)
Given a remote identifier and an options object that describes mapping/collection,
return the model if cached.

**Params**

- remoteId `String`  
- opts `Object`  

**Scope**: inner function of [cache](#module_cache)  
**Returns**: `SiestaModel`  
<a name="module_cache..remoteInsert"></a>
##cache~remoteInsert(obj, remoteId, previousRemoteId)
Insert an objet into the cache using a remote identifier defined by the mapping.

**Params**

- obj `SiestaModel`  
- remoteId `String`  
- previousRemoteId `String` - If remote id has been changed, this is the old remote identifier  

**Scope**: inner function of [cache](#module_cache)  
<a name="module_cache..remoteDump"></a>
##cache~remoteDump(asJson)
Dump the remote id cache

**Params**

- asJson `boolean` - Whether or not to apply JSON.stringify  

**Scope**: inner function of [cache](#module_cache)  
**Returns**: `String` | `Object`  
<a name="module_cache..localDump"></a>
##cache~localDump(asJson)
Dump the local id (_id) cache

**Params**

- asJson `boolean` - Whether or not to apply JSON.stringify  

**Scope**: inner function of [cache](#module_cache)  
**Returns**: `String` | `Object`  
<a name="module_cache..dump"></a>
##cache~dump(asJson)
Dump to the cache.

**Params**

- asJson `boolean` - Whether or not to apply JSON.stringify  

**Scope**: inner function of [cache](#module_cache)  
**Returns**: `String` | `Object`  
<a name="module_cache..get"></a>
##cache~get(opts)
Query the cache

**Params**

- opts `Object` - Object describing the query  

**Scope**: inner function of [cache](#module_cache)  
**Returns**: `SiestaModel`  
**Example**

```js
cache.get({_id: '5'}); // Query by local id
cache.get({remoteId: '5', mapping: myMapping}); // Query by remote id
```

<a name="module_cache..insert"></a>
##cache~insert(obj)
Insert an objet into the cache.

**Params**

- obj `SiestaModel`  

**Scope**: inner function of [cache](#module_cache)  
**Type**: `InternalSiestaError`  
<a name="module_cache..contains"></a>
##cache~contains(obj)
Returns true if object is in the cache

**Params**

- obj `SiestaModel`  

**Scope**: inner function of [cache](#module_cache)  
**Returns**: `boolean`  
<a name="module_cache..remove"></a>
##cache~remove(obj)
Removes the object from the cache (if it's actually in the cache) otherwises throws an error.

**Params**

- obj `SiestaModel`  

**Scope**: inner function of [cache](#module_cache)  
**Type**: `InternalSiestaError`  
<a name="Descriptor"></a>
#class: Descriptor
**Members**

* [class: Descriptor](#Descriptor)
  * [new Descriptor(opts)](#new_Descriptor)
  * [descriptor._matchPath(path)](#Descriptor#_matchPath)
  * [descriptor._matchMethod(method)](#Descriptor#_matchMethod)
  * [descriptor._extractData(data)](#Descriptor#_extractData)
  * [descriptor._matchConfig(config)](#Descriptor#_matchConfig)
  * [descriptor._matchData(data)](#Descriptor#_matchData)
  * [descriptor.match(config, data)](#Descriptor#match)
  * [descriptor._transformData(data)](#Descriptor#_transformData)

<a name="new_Descriptor"></a>
##new Descriptor(opts)
A descriptor 'describes' possible HTTP requests against an API, and is used to decide whether or not to
intercept a HTTP request/response and perform a mapping.

**Params**

- opts `Object`  

<a name="Descriptor#_matchPath"></a>
##descriptor._matchPath(path)
Takes a regex path and returns an object if matched.
If any regular expression groups were defined, the returned object will contain the matches.

**Params**

- path `String` | `RegExp`  

**Returns**: `Object`  
**Example**

```js
var d = new Descriptor({
    path: '/resource/(?P<id>)/'
})
var matched = d._matchPath('/resource/2');
console.log(matched); // {id: '2'}
```

<a name="Descriptor#_matchMethod"></a>
##descriptor._matchMethod(method)
Returns true if the descriptor accepts the HTTP method.

**Params**

- method `String`  

**Returns**: `boolean`  
**Example**

```js
var d = new Descriptor({
    method: ['POST', 'PUT']
});
console.log(d._matchMethod('GET')); // false
```

<a name="Descriptor#_extractData"></a>
##descriptor._extractData(data)
If nested data has been specified in the descriptor, extract the data.

**Params**

- data `Object`  

**Returns**: `Object`  
<a name="Descriptor#_matchConfig"></a>
##descriptor._matchConfig(config)
Returns this descriptors mapping if the request config matches.

**Params**

- config `Object`  

**Returns**: `Object`  
<a name="Descriptor#_matchData"></a>
##descriptor._matchData(data)
Returns data if the data matches, performing any extraction as specified in opts.data

**Params**

- data `Object`  

**Returns**: `Object`  
<a name="Descriptor#match"></a>
##descriptor.match(config, data)
Check if the HTTP config and returned data match this descriptor definition.

**Params**

- config `Object` - Config object for $.ajax and similar  
- data `Object`  

**Returns**: `Object` - Extracted data  
<a name="Descriptor#_transformData"></a>
##descriptor._transformData(data)
Apply any transforms.

**Params**

- data `Object` - Serialised data.  

**Returns**: `Object` - Serialised data with applied transformations.  
<a name="ResponseDescriptor"></a>
#class: ResponseDescriptor
**Members**

* [class: ResponseDescriptor](#ResponseDescriptor)
  * [new ResponseDescriptor(opts)](#new_ResponseDescriptor)

<a name="new_ResponseDescriptor"></a>
##new ResponseDescriptor(opts)
Describes what to do with a HTTP response.

**Params**

- opts `Object`  

<a name="bury"></a>
#bury(obj, data)
Performs a breadth-first search through data, embedding obj in the first leaf.

**Params**

- obj `Object`  
- data `Object`  

**Returns**: `Object`  
<a name="path"></a>
#path
**Type**: `String`  
