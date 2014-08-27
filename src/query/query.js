angular.module('restkit.query', ['restkit', 'restkit.indexing', 'restkit.pouchDocAdapter'])

/**
 * Query and return Fondant objects.
 */
    .factory('Query', function (RawQuery, jlog, PouchDocAdapter, RestError) {
        var $log = jlog.loggerWithName('Query');

        function Query(mapping, query) {
            this.mapping = mapping;
            this.query = query;
        }

        Query.prototype.execute = function (callback) {
            var rawQuery = new RawQuery(this.mapping.collection, this.mapping.type, this.query);
            rawQuery.execute(function (err, results) {
                if (err) {
                    callback(err);
                }
                else {
                    $log.debug('got results', results);
                    var fondantObjects = _.map(results, function (r) {
                        return PouchDocAdapter.toNew(r);
                    });
                    $log.debug('got fondant objects', fondantObjects);
                    if (callback) callback(null, fondantObjects);
                }
            });
        };



        return Query;
    })



/**
 * Query and return raw pouchdb documents.
 */
    .factory('RawQuery', function (Index, Pouch, jlog, RestError, constructMapFunction,constructMapFunction2) {

        var $log = jlog.loggerWithName('RawQuery');

        function RawQuery(collection, modelName, query) {
            this.collection = collection;
            this.modelName = modelName;
            this.query = query;
        }

        function resultsCallback (callback, err, resp) {
            if (err) {
                if (callback) callback(err);
            }
            else {
                var results = _.pluck(resp.rows, 'value');
                if (callback) callback(null, results);
            }
        }

        RawQuery.prototype.execute = function (callback) {
            var self = this;
            var designDocId = this._getDesignDocName();
            var indexName = self._getIndexName();
            Pouch.getPouch().get(designDocId, function (err, doc) {
                if (!err) {
                    var key = self._constructKey();
                    if (!key.length) {
                        key = self.modelName;
                    }
                    $log.debug('Executing query ' + indexName + ':' + ' ' + key);
                    Pouch.getPouch().query(indexName, {key: key}, _.partial(resultsCallback, callback));
                }
                else {
                    if (err.status == 404) {
                        $log.warning('Couldnt find index "' + indexName + '" and hence must iterate through every single document.');
                        var fields = [];
                        for (var field in self.query) {
                            if (self.query.hasOwnProperty(field)) {
                                fields.push(field);
                            }
                        }
                        // TODO: Clean up constructMapFunction so can output both string+func version so don't need eval here.
                        // TODO: For some reason constructMapFunction2 (which returns a function) wont work with pouch.
                        // I'm thinking that pouch probably doesnt support closures in its queries which would mean
                        // we'd have to stick with eval here.
                        eval('var mapFunc = ' + constructMapFunction(self.collection, self.modelName, fields));
//                        var mapFunc = constructMapFunction2(self.collection, self.modelName, fields);
                        Pouch.getPouch().query(mapFunc, _.partial(resultsCallback, callback));
                    }
                    else {
                        callback(err);
                    }
                }
            })
        };

        RawQuery.prototype._getFields = function () {
            var fields = [];
            for (var field in this.query) {
                if (this.query.hasOwnProperty(field)) {
                    fields.push(field);
                }
            }
            return fields;
        };

        RawQuery.prototype._constructKey = function () {
            var self = this;
            var fields = this._getFields();
            var sortedFields = _.sortBy(fields, function (x) {return x});
            var key = _.reduce(sortedFields, function (memo, x) {
                var v;
                if (x === null) {
                    v = 'null';
                }
                else if (x === undefined) {
                    v = 'undefined';
                }
                else {
                    v = self.query[x].toString()
                }
                return memo + v + '_';
            }, '');
            return key.substring(0, key.length - 1);
        };

        RawQuery.prototype._getDesignDocName = function () {
            var i = new Index(this.collection, this.modelName, this._getFields());
            return i._getDesignDocName();
        };

        RawQuery.prototype._getIndexName = function () {
            var i = new Index(this.collection, this.modelName, this._getFields());
            return i._getName();
        };

        return RawQuery;
    });

