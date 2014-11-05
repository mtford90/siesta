Siesta
======

[![Build Status](https://travis-ci.org/mtford90/siesta.svg?branch=master)](https://travis-ci.org/mtford90/siesta)

Siesta is an object mapping framework for Javascript. It makes it easier to model, consume and interact with RESTful web services.

* [Website](http://mtford90.github.io/siesta/)
* [Docs](http://mtford90.github.io/siesta/docs.html)
* [Quick Start](http://mtford90.github.io/siesta/docs.html)
* [Installation/Download](http://mtford90.github.io/siesta/download.html)
* [Demo App](http://mtford90.github.io/siesta/demo)

# Roadmap

The below lists ongoing and suggested features. Ideas and contributions are most welcome. Until 1.0, the API should be considered unstable.

## 0.2
* Paginated APIs
* More powerful queries
	* Contains
	* OR/AND

## 0.3
* Persistence
    * Indexeddb
    * WebSQL
    * Possibly PouchDB

## Later/Possible
* Attribute verification

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

We can automatically run tests when changes are detected by running the following commands:

```bash
# Watch for changes to everything, including the website and docs.
grunt watch
# Watch, but do not run the tests initially (will run on the next change)
grunt watch-no-test
# Do not watch for changes to the documentation/website, and do not serve a local server 
grunt watch-no-jekyll 
```

## Website/Documentation

```bash
# Watches for changes to the documentation/website and also serves the site at localhost:4000
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