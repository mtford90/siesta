---
layout: Getting_Started
title: Persistence
sidebar: nav2.html
---

## {{page.title}}

Siesta currently supports use of PouchDB as the local storage backend. PouchDB itself delegates to IndexedDB, WebSQL
or local storage depending on what is available in the browser

By default Siesta creates an instance of PouchDB as follows:

```javascript
var pouch = new PouchDB('siesta');
```

You can inject your own instance of PouchDB by doing the following:

```javascript
siesta.setPouch(myPouchInstance);
```

NOTE: If you inject your own Pouch instance you *must* perform the collection installations afterwards otherwise
indexes will not be installed.