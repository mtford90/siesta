angular.module('restkit.query', ['restkit', 'restkit.indexing'])

    .factory('Query', function (Index, Pouch, jlog) {

        var $log = jlog.loggerWithName('Query');

        function Query(modelName, query) {
            this.modelName = modelName;
            this.query = query;
        }

        Query.prototype.execute = function (callback) {
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
                    callback(err);
                }
            })
        };

        Query.prototype._getFields = function () {
            var fields = [];
            for (var field in this.query) {
                if (this.query.hasOwnProperty(field)) {
                    fields.push(field);
                }
            }
            return fields;
        };

        Query.prototype._constructKey = function () {
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

        Query.prototype._getDesignDocName = function () {
            var i = new Index(this.modelName, this._getFields());
            return i._getDesignDocName();
        };

        Query.prototype._getIndexName = function () {
            var i = new Index(this.modelName, this._getFields());
            return i._getName();
        };

        return Query;
    });

