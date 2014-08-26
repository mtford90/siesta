angular.module('restkit.query', ['restkit', 'restkit.indexing', 'restkit.pouchDocAdapter'])

    /**
     * Query and return Fondant objects.
     */
    .factory('Query', function (RawQuery, jlog, PouchDocAdapter,RestError) {
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
//                    try {
                        $log.debug('got results', results);
                        var fondantObjects = _.map(results, function (r) {
                            return PouchDocAdapter.toNew(r);
                        });
                        $log.debug('got fondant objects', fondantObjects);
                        if (callback) callback(null, fondantObjects);
//                    }
//                    catch (err) {
//                        if (err instanceof RestError) {
//                            if (callback) callback(err);
//                        }
//                        else {
//                            throw err;
//                        }
//                    }

                }
            });
        };

        return Query;
    })

    /**
     * Query and return raw pouchdb documents.
     */
    .factory('RawQuery', function (Index, Pouch, jlog, RestError) {

        var $log = jlog.loggerWithName('RawQuery');

        function RawQuery(collection, modelName, query) {
            this.collection = collection;
            this.modelName = modelName;
            this.query = query;
        }

        RawQuery.prototype.execute = function (callback) {
            var self = this;
            var designDocId = this._getDesignDocName();
            Pouch.getPouch().get(designDocId, function (err, doc) {
                if (!err) {
                    var b = self._getIndexName();
                    var key = self._constructKey();
                    if (!key.length) {
                        key = self.modelName;
                    }
                    $log.debug('Executing query ' + b + ':' + ' ' + key);
                    Pouch.getPouch().query(b, {key: key}, function (err, resp) {
                        if (err) {
                            if (callback) callback(err);
                        }
                        else {
                            var results = _.pluck(resp.rows, 'value');
                            $log.debug('Executed query ' + b + ':' + ' ' + key, {results: results, totalRows: resp.total_rows});
                            if (callback) callback(null, results);
                        }
                    });
                }
                else {
                    if (err.status == 404) {
                        var errorMessage = 'Design doc "' + designDocId.toString() + '" doesnt exist. Do you have an index configured for this query?';
                        $log.error(errorMessage, self.query);
                        throw new RestError(errorMessage, {collection: self.collection, type: self.modelName, query: self.query});
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

