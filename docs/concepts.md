---
layout: Getting_Started
title: Concepts
sidebar: nav2.html
---

## {{page.title}}

The below provides a summary of concepts in the Siesta API and the documentation.

### Object mapping

Object mapping refers to the mapping of fields from a source object onto a destination object.

### Object graph

A graph is a set of vertices with some pairs of vertices connected by edges.

<img src="{{site.baseurl}}/static/img/svg.png">

An object graph is a graph where each vertex is a Javascript object and each edge represents a relationship
between those two objects. 

All edges are multi-directional and the number of edges per vertex will differ
depending on whether the edges represent a foreign-key, many-to-many or one-to-one relationship.

### Single source of truth

Every remote resource should be represented by one and only one local object i.e. for each remote resource
we have a single local source of truth for that particular resource.

### Fields

A field on a model refers to either an attribute or relationship, where an attribute is a simple value such as an Integer or a String, and a relationship is another model instance or multiple model instances.