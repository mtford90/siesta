---
layout: Getting_Started
title: API
sidebar: nav2.html
---
#Index

**Modules**

* [collection](#module_collection)
  * [collection~GET(path, optsOrCallback, callback)](#module_collection..GET)
  * [collection~OPTIONS(path, optsOrCallback, callback)](#module_collection..OPTIONS)
  * [collection~TRACE(path, optsOrCallback, callback)](#module_collection..TRACE)
  * [collection~HEAD(path, optsOrCallback, callback)](#module_collection..HEAD)
  * [collection~POST(path, model, optsOrCallback, callback)](#module_collection..POST)
  * [collection~PUT(path, model, optsOrCallback, callback)](#module_collection..PUT)
  * [collection~PATCH(path, model, optsOrCallback, callback)](#module_collection..PATCH)
  * [collection~DELETE(path, model, optsOrCallback, callback)](#module_collection..DELETE)
  * [collection~count(callback)](#module_collection..count)
  * [class: collection~Collection](#module_collection..Collection)
    * [new collection~Collection(name)](#new_module_collection..Collection)
    * [collection.baseURL](#module_collection..Collection#baseURL)
    * [collection.installed](#module_collection..Collection#installed)
  * [class: collection~Collection](#module_collection..Collection)
    * [new collection~Collection(callback)](#new_module_collection..Collection)
    * [collection.baseURL](#module_collection..Collection#baseURL)
    * [collection.installed](#module_collection..Collection#installed)
  * [class: collection~Collection](#module_collection..Collection)
    * [new collection~Collection(err, callback)](#new_module_collection..Collection)
    * [collection.baseURL](#module_collection..Collection#baseURL)
    * [collection.installed](#module_collection..Collection#installed)
  * [class: collection~Collection](#module_collection..Collection)
    * [new collection~Collection(name, opts)](#new_module_collection..Collection)
    * [collection.baseURL](#module_collection..Collection#baseURL)
    * [collection.installed](#module_collection..Collection#installed)
  * [class: collection~Collection](#module_collection..Collection)
    * [new collection~Collection(optsOrName, opts)](#new_module_collection..Collection)
    * [collection.baseURL](#module_collection..Collection#baseURL)
    * [collection.installed](#module_collection..Collection#installed)
  * [class: collection~Collection](#module_collection..Collection)
    * [new collection~Collection(asJson)](#new_module_collection..Collection)
    * [collection.baseURL](#module_collection..Collection#baseURL)
    * [collection.installed](#module_collection..Collection#installed)
* [http](#module_http)
  * [http~path](#module_http..path)
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
  * [http~bury(obj, data)](#module_http..bury)
  * [class: http~Descriptor](#module_http..Descriptor)
    * [new http~Descriptor(opts)](#new_module_http..Descriptor)
    * [descriptor._matchPath(path)](#module_http..Descriptor#_matchPath)
    * [descriptor._matchMethod(method)](#module_http..Descriptor#_matchMethod)
    * [descriptor._extractData(data)](#module_http..Descriptor#_extractData)
    * [descriptor._matchConfig(config)](#module_http..Descriptor#_matchConfig)
    * [descriptor._matchData(data)](#module_http..Descriptor#_matchData)
    * [descriptor.match(config, data)](#module_http..Descriptor#match)
    * [descriptor._transformData(data)](#module_http..Descriptor#_transformData)
  * [class: http~ResponseDescriptor](#module_http..ResponseDescriptor)
    * [new http~ResponseDescriptor(opts)](#new_module_http..ResponseDescriptor)
* [store](#module_store)
  * [store~get(opts, callback)](#module_store..get)
  * [store~getMultipleLocal(localIdentifiers, callback)](#module_store..getMultipleLocal)
* [http](#module_http)
  * [http~path](#module_http..path)
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
  * [http~bury(obj, data)](#module_http..bury)
  * [class: http~Descriptor](#module_http..Descriptor)
    * [new http~Descriptor(opts)](#new_module_http..Descriptor)
    * [descriptor._matchPath(path)](#module_http..Descriptor#_matchPath)
    * [descriptor._matchMethod(method)](#module_http..Descriptor#_matchMethod)
    * [descriptor._extractData(data)](#module_http..Descriptor#_extractData)
    * [descriptor._matchConfig(config)](#module_http..Descriptor#_matchConfig)
    * [descriptor._matchData(data)](#module_http..Descriptor#_matchData)
    * [descriptor.match(config, data)](#module_http..Descriptor#match)
    * [descriptor._transformData(data)](#module_http..Descriptor#_transformData)
  * [class: http~ResponseDescriptor](#module_http..ResponseDescriptor)
    * [new http~ResponseDescriptor(opts)](#new_module_http..ResponseDescriptor)
* [http](#module_http)
  * [http~path](#module_http..path)
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
  * [http~bury(obj, data)](#module_http..bury)
  * [class: http~Descriptor](#module_http..Descriptor)
    * [new http~Descriptor(opts)](#new_module_http..Descriptor)
    * [descriptor._matchPath(path)](#module_http..Descriptor#_matchPath)
    * [descriptor._matchMethod(method)](#module_http..Descriptor#_matchMethod)
    * [descriptor._extractData(data)](#module_http..Descriptor#_extractData)
    * [descriptor._matchConfig(config)](#module_http..Descriptor#_matchConfig)
    * [descriptor._matchData(data)](#module_http..Descriptor#_matchData)
    * [descriptor.match(config, data)](#module_http..Descriptor#match)
    * [descriptor._transformData(data)](#module_http..Descriptor#_transformData)
  * [class: http~ResponseDescriptor](#module_http..ResponseDescriptor)
    * [new http~ResponseDescriptor(opts)](#new_module_http..ResponseDescriptor)
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
 
<a name="module_collection"></a>
#collection
**Members**

* [collection](#module_collection)
  * [collection~GET(path, optsOrCallback, callback)](#module_collection..GET)
  * [collection~OPTIONS(path, optsOrCallback, callback)](#module_collection..OPTIONS)
  * [collection~TRACE(path, optsOrCallback, callback)](#module_collection..TRACE)
  * [collection~HEAD(path, optsOrCallback, callback)](#module_collection..HEAD)
  * [collection~POST(path, model, optsOrCallback, callback)](#module_collection..POST)
  * [collection~PUT(path, model, optsOrCallback, callback)](#module_collection..PUT)
  * [collection~PATCH(path, model, optsOrCallback, callback)](#module_collection..PATCH)
  * [collection~DELETE(path, model, optsOrCallback, callback)](#module_collection..DELETE)
  * [collection~count(callback)](#module_collection..count)
  * [class: collection~Collection](#module_collection..Collection)
    * [new collection~Collection(name)](#new_module_collection..Collection)
    * [collection.baseURL](#module_collection..Collection#baseURL)
    * [collection.installed](#module_collection..Collection#installed)
  * [class: collection~Collection](#module_collection..Collection)
    * [new collection~Collection(callback)](#new_module_collection..Collection)
    * [collection.baseURL](#module_collection..Collection#baseURL)
    * [collection.installed](#module_collection..Collection#installed)
  * [class: collection~Collection](#module_collection..Collection)
    * [new collection~Collection(err, callback)](#new_module_collection..Collection)
    * [collection.baseURL](#module_collection..Collection#baseURL)
    * [collection.installed](#module_collection..Collection#installed)
  * [class: collection~Collection](#module_collection..Collection)
    * [new collection~Collection(name, opts)](#new_module_collection..Collection)
    * [collection.baseURL](#module_collection..Collection#baseURL)
    * [collection.installed](#module_collection..Collection#installed)
  * [class: collection~Collection](#module_collection..Collection)
    * [new collection~Collection(optsOrName, opts)](#new_module_collection..Collection)
    * [collection.baseURL](#module_collection..Collection#baseURL)
    * [collection.installed](#module_collection..Collection#installed)
  * [class: collection~Collection](#module_collection..Collection)
    * [new collection~Collection(asJson)](#new_module_collection..Collection)
    * [collection.baseURL](#module_collection..Collection#baseURL)
    * [collection.installed](#module_collection..Collection#installed)

<a name="module_collection..GET"></a>
##collection~GET(path, optsOrCallback, callback)
Send a GET request

**Params**

- path `String` - The path to the resource we want to GET  
- optsOrCallback `Object` | `function` - Either an options object or a callback if can use defaults  
- callback `function` - Callback if opts specified.  

**Scope**: inner function of [collection](#module_collection)  
**Returns**: `Promise`  
<a name="module_collection..OPTIONS"></a>
##collection~OPTIONS(path, optsOrCallback, callback)
Send a OPTIONS request

**Params**

- path `String` - The path to the resource to which we want to send an OPTIONS request  
- optsOrCallback `Object` | `function` - Either an options object or a callback if can use defaults  
- callback `function` - Callback if opts specified.  

**Scope**: inner function of [collection](#module_collection)  
**Returns**: `Promise`  
<a name="module_collection..TRACE"></a>
##collection~TRACE(path, optsOrCallback, callback)
Send a TRACE request

**Params**

- path `path` - The path to the resource to which we want to send a TRACE request  
- optsOrCallback `Object` | `function` - Either an options object or a callback if can use defaults  
- callback `function` - Callback if opts specified.  

**Scope**: inner function of [collection](#module_collection)  
**Returns**: `Promise`  
<a name="module_collection..HEAD"></a>
##collection~HEAD(path, optsOrCallback, callback)
Send a HEAD request

**Params**

- path `String` - The path to the resource to which we want to send a HEAD request  
- optsOrCallback `Object` | `function` - Either an options object or a callback if can use defaults  
- callback `function` - Callback if opts specified.  

**Scope**: inner function of [collection](#module_collection)  
**Returns**: `Promise`  
<a name="module_collection..POST"></a>
##collection~POST(path, model, optsOrCallback, callback)
Send a POST request

**Params**

- path `String` - The path to the resource to which we want to send a POST request  
- model `SiestaModel` - The model that we would like to POST  
- optsOrCallback `Object` | `function` - Either an options object or a callback if can use defaults  
- callback `function` - Callback if opts specified.  

**Scope**: inner function of [collection](#module_collection)  
**Returns**: `Promise`  
<a name="module_collection..PUT"></a>
##collection~PUT(path, model, optsOrCallback, callback)
Send a PUT request

**Params**

- path `String` - The path to the resource to which we want to send a PUT request  
- model `SiestaModel` - The model that we would like to PUT  
- optsOrCallback `Object` | `function` - Either an options object or a callback if can use defaults  
- callback `function` - Callback if opts specified.  

**Scope**: inner function of [collection](#module_collection)  
**Returns**: `Promise`  
<a name="module_collection..PATCH"></a>
##collection~PATCH(path, model, optsOrCallback, callback)
Send a PATCH request

**Params**

- path `String` - The path to the resource to which we want to send a PATCH request  
- model `SiestaModel` - The model that we would like to PATCH  
- optsOrCallback `Object` | `function` - Either an options object or a callback if can use defaults  
- callback `function` - Callback if opts specified.  

**Scope**: inner function of [collection](#module_collection)  
**Returns**: `Promise`  
<a name="module_collection..DELETE"></a>
##collection~DELETE(path, model, optsOrCallback, callback)
Send a DELETE request. Also removes the object.

**Params**

- path `String` - The path to the resource to which we want to DELETE  
- model `SiestaModel` - The model that we would like to PATCH  
- optsOrCallback `Object` | `function` - Either an options object or a callback if can use defaults  
- callback `function` - Callback if opts specified.  

**Scope**: inner function of [collection](#module_collection)  
**Returns**: `Promise`  
<a name="module_collection..count"></a>
##collection~count(callback)
Returns the number of objects in this collection.

**Params**

- callback   

**Scope**: inner function of [collection](#module_collection)  
**Returns**: `Promise`  
<a name="module_collection..Collection"></a>
##class: collection~Collection
**Members**

* [class: collection~Collection](#module_collection..Collection)
  * [new collection~Collection(name)](#new_module_collection..Collection)
  * [collection.baseURL](#module_collection..Collection#baseURL)
  * [collection.installed](#module_collection..Collection#installed)

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
<a name="module_collection..Collection"></a>
##class: collection~Collection
**Members**

* [class: collection~Collection](#module_collection..Collection)
  * [new collection~Collection(callback)](#new_module_collection..Collection)
  * [collection.baseURL](#module_collection..Collection#baseURL)
  * [collection.installed](#module_collection..Collection#installed)

<a name="new_module_collection..Collection"></a>
###new collection~Collection(callback)
Ensure mappings are installed.

**Params**

- callback   

**Scope**: inner class of [collection](#module_collection)  
<a name="module_collection..Collection#baseURL"></a>
###collection.baseURL
The URL of the API e.g. http://api.github.com

**Type**: `string`  
<a name="module_collection..Collection#installed"></a>
###collection.installed
Set to true if installation has succeeded. You cannot use the collectio

**Type**: `boolean`  
<a name="module_collection..Collection"></a>
##class: collection~Collection
**Members**

* [class: collection~Collection](#module_collection..Collection)
  * [new collection~Collection(err, callback)](#new_module_collection..Collection)
  * [collection.baseURL](#module_collection..Collection#baseURL)
  * [collection.installed](#module_collection..Collection#installed)

<a name="new_module_collection..Collection"></a>
###new collection~Collection(err, callback)
Mark this collection as installed, and place the collection on the global Siesta object.

**Params**

- err `Object`  
- callback `function`  

**Scope**: inner class of [collection](#module_collection)  
<a name="module_collection..Collection#baseURL"></a>
###collection.baseURL
The URL of the API e.g. http://api.github.com

**Type**: `string`  
<a name="module_collection..Collection#installed"></a>
###collection.installed
Set to true if installation has succeeded. You cannot use the collectio

**Type**: `boolean`  
<a name="module_collection..Collection"></a>
##class: collection~Collection
**Members**

* [class: collection~Collection](#module_collection..Collection)
  * [new collection~Collection(name, opts)](#new_module_collection..Collection)
  * [collection.baseURL](#module_collection..Collection#baseURL)
  * [collection.installed](#module_collection..Collection#installed)

<a name="new_module_collection..Collection"></a>
###new collection~Collection(name, opts)
Given the name of a mapping and an options object describing the mapping, creating a Mapping
object, install it and return it.

**Params**

- name `String`  
- opts `Object`  

**Scope**: inner class of [collection](#module_collection)  
**Returns**: `Mapping`  
<a name="module_collection..Collection#baseURL"></a>
###collection.baseURL
The URL of the API e.g. http://api.github.com

**Type**: `string`  
<a name="module_collection..Collection#installed"></a>
###collection.installed
Set to true if installation has succeeded. You cannot use the collectio

**Type**: `boolean`  
<a name="module_collection..Collection"></a>
##class: collection~Collection
**Members**

* [class: collection~Collection](#module_collection..Collection)
  * [new collection~Collection(optsOrName, opts)](#new_module_collection..Collection)
  * [collection.baseURL](#module_collection..Collection#baseURL)
  * [collection.installed](#module_collection..Collection#installed)

<a name="new_module_collection..Collection"></a>
###new collection~Collection(optsOrName, opts)
Registers a mapping with this collection.

**Params**

- optsOrName `String` | `Object` - An options object or the name of the mapping. Must pass options as second param if specify name.  
- opts `Object` - Options if name already specified.  

**Scope**: inner class of [collection](#module_collection)  
**Returns**: `Mapping`  
<a name="module_collection..Collection#baseURL"></a>
###collection.baseURL
The URL of the API e.g. http://api.github.com

**Type**: `string`  
<a name="module_collection..Collection#installed"></a>
###collection.installed
Set to true if installation has succeeded. You cannot use the collectio

**Type**: `boolean`  
<a name="module_collection..Collection"></a>
##class: collection~Collection
**Members**

* [class: collection~Collection](#module_collection..Collection)
  * [new collection~Collection(asJson)](#new_module_collection..Collection)
  * [collection.baseURL](#module_collection..Collection#baseURL)
  * [collection.installed](#module_collection..Collection#installed)

<a name="new_module_collection..Collection"></a>
###new collection~Collection(asJson)
Dump this collection as JSON

**Params**

- asJson `Boolean` - Whether or not to apply JSON.stringify  

**Scope**: inner class of [collection](#module_collection)  
**Returns**: `String` | `Object`  
<a name="module_collection..Collection#baseURL"></a>
###collection.baseURL
The URL of the API e.g. http://api.github.com

**Type**: `string`  
<a name="module_collection..Collection#installed"></a>
###collection.installed
Set to true if installation has succeeded. You cannot use the collectio

**Type**: `boolean`  
<a name="module_http"></a>
#http
Provisions usage of $.ajax and similar functions to send HTTP requests mapping
the results back onto the object graph automatically.

**Members**

* [http](#module_http)
  * [http~path](#module_http..path)
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
  * [http~bury(obj, data)](#module_http..bury)
  * [class: http~Descriptor](#module_http..Descriptor)
    * [new http~Descriptor(opts)](#new_module_http..Descriptor)
    * [descriptor._matchPath(path)](#module_http..Descriptor#_matchPath)
    * [descriptor._matchMethod(method)](#module_http..Descriptor#_matchMethod)
    * [descriptor._extractData(data)](#module_http..Descriptor#_extractData)
    * [descriptor._matchConfig(config)](#module_http..Descriptor#_matchConfig)
    * [descriptor._matchData(data)](#module_http..Descriptor#_matchData)
    * [descriptor.match(config, data)](#module_http..Descriptor#match)
    * [descriptor._transformData(data)](#module_http..Descriptor#_transformData)
  * [class: http~ResponseDescriptor](#module_http..ResponseDescriptor)
    * [new http~ResponseDescriptor(opts)](#new_module_http..ResponseDescriptor)

<a name="module_http..path"></a>
##http~path
**Scope**: inner member of [http](#module_http)  
**Type**: `String`  
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
<a name="module_http..bury"></a>
##http~bury(obj, data)
Performs a breadth-first search through data, embedding obj in the first leaf.

**Params**

- obj `Object`  
- data `Object`  

**Scope**: inner function of [http](#module_http)  
**Returns**: `Object`  
<a name="module_http..Descriptor"></a>
##class: http~Descriptor
**Members**

* [class: http~Descriptor](#module_http..Descriptor)
  * [new http~Descriptor(opts)](#new_module_http..Descriptor)
  * [descriptor._matchPath(path)](#module_http..Descriptor#_matchPath)
  * [descriptor._matchMethod(method)](#module_http..Descriptor#_matchMethod)
  * [descriptor._extractData(data)](#module_http..Descriptor#_extractData)
  * [descriptor._matchConfig(config)](#module_http..Descriptor#_matchConfig)
  * [descriptor._matchData(data)](#module_http..Descriptor#_matchData)
  * [descriptor.match(config, data)](#module_http..Descriptor#match)
  * [descriptor._transformData(data)](#module_http..Descriptor#_transformData)

<a name="new_module_http..Descriptor"></a>
###new http~Descriptor(opts)
A descriptor 'describes' possible HTTP requests against an API, and is used to decide whether or not to
intercept a HTTP request/response and perform a mapping.

**Params**

- opts `Object`  

**Scope**: inner class of [http](#module_http)  
<a name="module_http..Descriptor#_matchPath"></a>
###descriptor._matchPath(path)
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

<a name="module_http..Descriptor#_matchMethod"></a>
###descriptor._matchMethod(method)
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

<a name="module_http..Descriptor#_extractData"></a>
###descriptor._extractData(data)
If nested data has been specified in the descriptor, extract the data.

**Params**

- data `Object`  

**Returns**: `Object`  
<a name="module_http..Descriptor#_matchConfig"></a>
###descriptor._matchConfig(config)
Returns this descriptors mapping if the request config matches.

**Params**

- config `Object`  

**Returns**: `Object`  
<a name="module_http..Descriptor#_matchData"></a>
###descriptor._matchData(data)
Returns data if the data matches, performing any extraction as specified in opts.data

**Params**

- data `Object`  

**Returns**: `Object`  
<a name="module_http..Descriptor#match"></a>
###descriptor.match(config, data)
Check if the HTTP config and returned data match this descriptor definition.

**Params**

- config `Object` - Config object for $.ajax and similar  
- data `Object`  

**Returns**: `Object` - Extracted data  
<a name="module_http..Descriptor#_transformData"></a>
###descriptor._transformData(data)
Apply any transforms.

**Params**

- data `Object` - Serialised data.  

**Returns**: `Object` - Serialised data with applied transformations.  
<a name="module_http..ResponseDescriptor"></a>
##class: http~ResponseDescriptor
**Members**

* [class: http~ResponseDescriptor](#module_http..ResponseDescriptor)
  * [new http~ResponseDescriptor(opts)](#new_module_http..ResponseDescriptor)

<a name="new_module_http..ResponseDescriptor"></a>
###new http~ResponseDescriptor(opts)
Describes what to do with a HTTP response.

**Params**

- opts `Object`  

**Scope**: inner class of [http](#module_http)  
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
<a name="module_http"></a>
#http
Descriptors deal with the description of HTTP requests and are used by Siesta to determine what to do
with HTTP request/response bodies.

**Members**

* [http](#module_http)
  * [http~path](#module_http..path)
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
  * [http~bury(obj, data)](#module_http..bury)
  * [class: http~Descriptor](#module_http..Descriptor)
    * [new http~Descriptor(opts)](#new_module_http..Descriptor)
    * [descriptor._matchPath(path)](#module_http..Descriptor#_matchPath)
    * [descriptor._matchMethod(method)](#module_http..Descriptor#_matchMethod)
    * [descriptor._extractData(data)](#module_http..Descriptor#_extractData)
    * [descriptor._matchConfig(config)](#module_http..Descriptor#_matchConfig)
    * [descriptor._matchData(data)](#module_http..Descriptor#_matchData)
    * [descriptor.match(config, data)](#module_http..Descriptor#match)
    * [descriptor._transformData(data)](#module_http..Descriptor#_transformData)
  * [class: http~ResponseDescriptor](#module_http..ResponseDescriptor)
    * [new http~ResponseDescriptor(opts)](#new_module_http..ResponseDescriptor)

<a name="module_http..path"></a>
##http~path
**Scope**: inner member of [http](#module_http)  
**Type**: `String`  
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
<a name="module_http..bury"></a>
##http~bury(obj, data)
Performs a breadth-first search through data, embedding obj in the first leaf.

**Params**

- obj `Object`  
- data `Object`  

**Scope**: inner function of [http](#module_http)  
**Returns**: `Object`  
<a name="module_http..Descriptor"></a>
##class: http~Descriptor
**Members**

* [class: http~Descriptor](#module_http..Descriptor)
  * [new http~Descriptor(opts)](#new_module_http..Descriptor)
  * [descriptor._matchPath(path)](#module_http..Descriptor#_matchPath)
  * [descriptor._matchMethod(method)](#module_http..Descriptor#_matchMethod)
  * [descriptor._extractData(data)](#module_http..Descriptor#_extractData)
  * [descriptor._matchConfig(config)](#module_http..Descriptor#_matchConfig)
  * [descriptor._matchData(data)](#module_http..Descriptor#_matchData)
  * [descriptor.match(config, data)](#module_http..Descriptor#match)
  * [descriptor._transformData(data)](#module_http..Descriptor#_transformData)

<a name="new_module_http..Descriptor"></a>
###new http~Descriptor(opts)
A descriptor 'describes' possible HTTP requests against an API, and is used to decide whether or not to
intercept a HTTP request/response and perform a mapping.

**Params**

- opts `Object`  

**Scope**: inner class of [http](#module_http)  
<a name="module_http..Descriptor#_matchPath"></a>
###descriptor._matchPath(path)
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

<a name="module_http..Descriptor#_matchMethod"></a>
###descriptor._matchMethod(method)
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

<a name="module_http..Descriptor#_extractData"></a>
###descriptor._extractData(data)
If nested data has been specified in the descriptor, extract the data.

**Params**

- data `Object`  

**Returns**: `Object`  
<a name="module_http..Descriptor#_matchConfig"></a>
###descriptor._matchConfig(config)
Returns this descriptors mapping if the request config matches.

**Params**

- config `Object`  

**Returns**: `Object`  
<a name="module_http..Descriptor#_matchData"></a>
###descriptor._matchData(data)
Returns data if the data matches, performing any extraction as specified in opts.data

**Params**

- data `Object`  

**Returns**: `Object`  
<a name="module_http..Descriptor#match"></a>
###descriptor.match(config, data)
Check if the HTTP config and returned data match this descriptor definition.

**Params**

- config `Object` - Config object for $.ajax and similar  
- data `Object`  

**Returns**: `Object` - Extracted data  
<a name="module_http..Descriptor#_transformData"></a>
###descriptor._transformData(data)
Apply any transforms.

**Params**

- data `Object` - Serialised data.  

**Returns**: `Object` - Serialised data with applied transformations.  
<a name="module_http..ResponseDescriptor"></a>
##class: http~ResponseDescriptor
**Members**

* [class: http~ResponseDescriptor](#module_http..ResponseDescriptor)
  * [new http~ResponseDescriptor(opts)](#new_module_http..ResponseDescriptor)

<a name="new_module_http..ResponseDescriptor"></a>
###new http~ResponseDescriptor(opts)
Describes what to do with a HTTP response.

**Params**

- opts `Object`  

**Scope**: inner class of [http](#module_http)  
<a name="module_http"></a>
#http
**Members**

* [http](#module_http)
  * [http~path](#module_http..path)
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
  * [http~bury(obj, data)](#module_http..bury)
  * [class: http~Descriptor](#module_http..Descriptor)
    * [new http~Descriptor(opts)](#new_module_http..Descriptor)
    * [descriptor._matchPath(path)](#module_http..Descriptor#_matchPath)
    * [descriptor._matchMethod(method)](#module_http..Descriptor#_matchMethod)
    * [descriptor._extractData(data)](#module_http..Descriptor#_extractData)
    * [descriptor._matchConfig(config)](#module_http..Descriptor#_matchConfig)
    * [descriptor._matchData(data)](#module_http..Descriptor#_matchData)
    * [descriptor.match(config, data)](#module_http..Descriptor#match)
    * [descriptor._transformData(data)](#module_http..Descriptor#_transformData)
  * [class: http~ResponseDescriptor](#module_http..ResponseDescriptor)
    * [new http~ResponseDescriptor(opts)](#new_module_http..ResponseDescriptor)

<a name="module_http..path"></a>
##http~path
**Scope**: inner member of [http](#module_http)  
**Type**: `String`  
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
<a name="module_http..bury"></a>
##http~bury(obj, data)
Performs a breadth-first search through data, embedding obj in the first leaf.

**Params**

- obj `Object`  
- data `Object`  

**Scope**: inner function of [http](#module_http)  
**Returns**: `Object`  
<a name="module_http..Descriptor"></a>
##class: http~Descriptor
**Members**

* [class: http~Descriptor](#module_http..Descriptor)
  * [new http~Descriptor(opts)](#new_module_http..Descriptor)
  * [descriptor._matchPath(path)](#module_http..Descriptor#_matchPath)
  * [descriptor._matchMethod(method)](#module_http..Descriptor#_matchMethod)
  * [descriptor._extractData(data)](#module_http..Descriptor#_extractData)
  * [descriptor._matchConfig(config)](#module_http..Descriptor#_matchConfig)
  * [descriptor._matchData(data)](#module_http..Descriptor#_matchData)
  * [descriptor.match(config, data)](#module_http..Descriptor#match)
  * [descriptor._transformData(data)](#module_http..Descriptor#_transformData)

<a name="new_module_http..Descriptor"></a>
###new http~Descriptor(opts)
A descriptor 'describes' possible HTTP requests against an API, and is used to decide whether or not to
intercept a HTTP request/response and perform a mapping.

**Params**

- opts `Object`  

**Scope**: inner class of [http](#module_http)  
<a name="module_http..Descriptor#_matchPath"></a>
###descriptor._matchPath(path)
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

<a name="module_http..Descriptor#_matchMethod"></a>
###descriptor._matchMethod(method)
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

<a name="module_http..Descriptor#_extractData"></a>
###descriptor._extractData(data)
If nested data has been specified in the descriptor, extract the data.

**Params**

- data `Object`  

**Returns**: `Object`  
<a name="module_http..Descriptor#_matchConfig"></a>
###descriptor._matchConfig(config)
Returns this descriptors mapping if the request config matches.

**Params**

- config `Object`  

**Returns**: `Object`  
<a name="module_http..Descriptor#_matchData"></a>
###descriptor._matchData(data)
Returns data if the data matches, performing any extraction as specified in opts.data

**Params**

- data `Object`  

**Returns**: `Object`  
<a name="module_http..Descriptor#match"></a>
###descriptor.match(config, data)
Check if the HTTP config and returned data match this descriptor definition.

**Params**

- config `Object` - Config object for $.ajax and similar  
- data `Object`  

**Returns**: `Object` - Extracted data  
<a name="module_http..Descriptor#_transformData"></a>
###descriptor._transformData(data)
Apply any transforms.

**Params**

- data `Object` - Serialised data.  

**Returns**: `Object` - Serialised data with applied transformations.  
<a name="module_http..ResponseDescriptor"></a>
##class: http~ResponseDescriptor
**Members**

* [class: http~ResponseDescriptor](#module_http..ResponseDescriptor)
  * [new http~ResponseDescriptor(opts)](#new_module_http..ResponseDescriptor)

<a name="new_module_http..ResponseDescriptor"></a>
###new http~ResponseDescriptor(opts)
Describes what to do with a HTTP response.

**Params**

- opts `Object`  

**Scope**: inner class of [http](#module_http)  
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
Insert an object into the cache.

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
