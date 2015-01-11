Siesta
======

[![Gitter](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/mtford90/siesta?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

[![Build Status](https://travis-ci.org/mtford90/siesta.svg?branch=master)](https://travis-ci.org/mtford90/siesta)

Siesta is an Object Graph framework for Javascript. Siesta makes it easy to model, consume and interact with relational data in the browser.

* [Website](http://mtford.co.uk/siesta/)
* [Docs](http://mtford.co.uk/siesta/docs.html)
* [Installation](http://mtford.co.uk/siesta/docs.html#getting-started)

# Roadmap

The below is the current roadmap for Siesta features & improvements. Feedback and suggestions are welcome!

## 0.1
* Stability

## 0.2
* Store binary data
* Save changes to model instances rather than entire model instances when dirty
* Database compaction

## 0.3
* Faulting Mechanism (i.e. don't load all data from storage at once...)
* PouchDB indexing

## 0.4
* Undo/Redo changes to models
* Global error handling mechanism

## 0.5
* Performance extension
    * Built using Siesta itself
* Visualisation extension (Already half done due to a siesta demo at Hacker School)
    * Built using Siesta itself.

## 1.0
* API freeze

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

## Build/Compilation

We can build and compile siesta using:

```bash
# Generate build/siesta.*.js as well as build/siesta.*.min.js and build/siesta.*.min.js.gz
grunt compile
```