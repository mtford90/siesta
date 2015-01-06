Siesta
======

[![Gitter](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/mtford90/siesta?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

[![Build Status](https://travis-ci.org/mtford90/siesta.svg?branch=master)](https://travis-ci.org/mtford90/siesta)

**BIG FAT WARNING:** This library is in **beta** and is under development. Whilst efforts are being made to keep master/releases stable there are no guarantees on this.

Siesta is an object mapping framework for Javascript. It makes it easier to model, consume and interact with RESTful web services.

* [Website](http://mtford90.github.io/siesta/)
* [Docs](http://mtford90.github.io/siesta/docs.html)
* [Quick Start](http://mtford90.github.io/siesta/docs.html)
* [Installation/Download](http://mtford90.github.io/siesta/download.html)
* [Demo App](http://mtford90.github.io/siesta/demo)
* IRC chat.freenode.net #siesta.js

**Siesta** is inspired by:

* [CoreData](https://developer.apple.com/library/mac/documentation/Cocoa/Conceptual/CoreData/cdProgrammingGuide.html)
* [RestKit](http://restkit.org/)

Similar projects:

* [EmberJS-Data](https://github.com/emberjs/data): Similar to Siesta however abstraction heavy in the typical Ember manner... ;)

# Roadmap

The below lists ongoing and suggested features. Ideas and contributions are most welcome.

## 0.1
* Stability.

## 0.2
* Paginated APIs
* More powerful queries
	* Contains
	* OR/AND

## 0.3
* Persistence
    * Indexeddb
    * WebSQL (Probably via Indexeddb shim, as w3 has discontinued websql however required for backwards compat with safari/safari iOS etc)
    * Possibly PouchDB (The sync-to-couchdb features are pretty awesome)
   
## Later
* NodeJS support.

# Contributing

Note that if you intend to make a pull request you should fork and clone your own repo.

```bash
# git clone https://github.com/<username>/siesta.git if you're cloning your own repo.
git clone https://github.com/mtford90/siesta.git 
cd siesta
npm install 
bower install 
# Siesta depends on forks of some Javascript projects, and the gh-pages branch is also a submodule.
git pull && git submodule init && git submodule update && git submodule status
```

To make sure that all is well, run the tests:

```bash
grunt test
```

We can automatically run tests when modelEvents are detected by running the following commands:

```bash
grunt watch
```

## Website/Documentation

```bash
# Watches for modelEvents to the documentation/website and also serves the site at localhost:4000
grunt watch
# Build the documentation/website for use locally.
grunt build-jekyll
# Build the documentation/website for use on gh-pages, commit and push the website (will be in production)
grunt compile-jekyll 
```

## Build/Compilation

We can build and compile siesta using:

```bash
# Generate build/siesta.js, build/siesta.http.js... etc
grunt build
# Generate build/siesta.*.js as well as build/siesta.*.min.js and build/siesta.*.min.js.gz
grunt compile
```

## Release

The following commands will perform a version bump, compile, commit, push and release to NPM/bower:

```bash
grunt release-pre # e.g. 0.0.6 -> 0.0.6-1
grunt release-patch # e.g. 0.0.6 -> 0.0.7
grunt release-minor # e.g. 0.0.6 -> 0.1.6
grunt release-major # e.g. 0.0.6 -> 1.0.6
```
