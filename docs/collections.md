---
layout: Getting_Started
title: Collections
sidebar: nav2.html
---


<a name="Collection"></a>
#class: Collection
**Members**

* [class: Collection](#Collection)
  * [new Collection(name)](#new_Collection)
  * [collection.baseURL](#Collection#baseURL)
  * [collection.installed](#Collection#installed)
  * [collection.install(callback)](#Collection#install)
  * [collection.save(callback)](#Collection#save)
  * [collection.HTTP_METHOD(request, method)](#Collection#HTTP_METHOD)
  * [collection.GET()](#Collection#GET)
  * [collection.OPTIONS()](#Collection#OPTIONS)
  * [collection.TRACE()](#Collection#TRACE)
  * [collection.HEAD()](#Collection#HEAD)
  * [collection.POST()](#Collection#POST)
  * [collection.PUT()](#Collection#PUT)
  * [collection.PATCH()](#Collection#PATCH)
  * [collection.DELETE()](#Collection#DELETE)
  * [collection.count(callback)](#Collection#count)

<a name="new_Collection"></a>
##new Collection(name)
A collection describes a set of models and optionally a REST API which we would
like to model.

**Params**

- name   

**Example**

```js
var GitHub = new Collection('GitHub')
// ... configure mappings, descriptors etc ...
GitHub.install(function () {
    // ... carry on.
});
```

<a name="Collection#baseURL"></a>
##collection.baseURL
The URL of the API e.g. http://api.github.com

**Type**: `string`  
<a name="Collection#installed"></a>
##collection.installed
Set to true if installation has succeeded. You cannot use the collectio

**Type**: `boolean`  
<a name="Collection#install"></a>
##collection.install(callback)
Ensure mappings are installed.

**Params**

- callback   

<a name="Collection#save"></a>
##collection.save(callback)
Persist all changes to PouchDB.
Note: Storage extension must be installed.

**Params**

- callback   

**Returns**: `Promise`  
<a name="Collection#HTTP_METHOD"></a>
##collection.HTTP_METHOD(request, method)
Send a HTTP request using the given method

**Params**

- request  - Does the request contain data? e.g. POST/PATCH/PUT will be true, GET will false  
- method   

**Returns**: `*`  
<a name="Collection#GET"></a>
##collection.GET()
Send a GET request

**Returns**: `*`  
<a name="Collection#OPTIONS"></a>
##collection.OPTIONS()
Send a OPTIONS request

**Returns**: `*`  
<a name="Collection#TRACE"></a>
##collection.TRACE()
Send a TRACE request

**Returns**: `*`  
<a name="Collection#HEAD"></a>
##collection.HEAD()
Send a HEAD request

**Returns**: `*`  
<a name="Collection#POST"></a>
##collection.POST()
Send a POST request

**Returns**: `*`  
<a name="Collection#PUT"></a>
##collection.PUT()
Send a PUT request

**Returns**: `*`  
<a name="Collection#PATCH"></a>
##collection.PATCH()
Send a PATCH request

**Returns**: `*`  
<a name="Collection#DELETE"></a>
##collection.DELETE()
Send a DELETE request

**Returns**: `*`  
<a name="Collection#count"></a>
##collection.count(callback)
Returns the number of objects in this collection.

**Params**

- callback   

**Returns**:  - Promise  
