angular.module('restkit.indexing', ['restkit.mapping'])

    .factory('Indexes', function (Index) {

        /**
         * Adapted from:
         * http://stackoverflow.com/questions/5752002/find-all-possible-subset-combos-in-an-array
         * @param a
         * @param min
         * @returns {Array}
         */
        function combine(a, min) {
            var fn = function(n, src, got, all) {
                if (n == 0) {
                    if (got.length > 0) {
                        all[all.length] = got;
                    }
                    return;
                }
                for (var j = 0; j < src.length; j++) {
                    fn(n - 1, src.slice(j + 1), got.concat([src[j]]), all);
                }
            };
            var all = [];
            for (var i = min; i < a.length; i++) {
                fn(i, a, [], all);
            }
            all.push(a);
            return all;
        }

        function getFieldCombinations(fields) {
            return combine(fields, 1);
        }

        function constructIndexes (modelName, fields) {
            var combinations = getFieldCombinations(fields);
            return _.map(combinations, function (fields) {
                return new Index(modelName, fields);
            });
        }

        return {
            installIndexes: function(modelName, fields, callback) {
                var indexes = constructIndexes(modelName, fields);
                var numCompleted = 0;
                var errors = [];
                _.each(indexes, function (index) {
                    index.install(function (err) {
                        if (err) {
                            errors.push(err);
                        }
                        numCompleted++;
                        if (numCompleted == indexes.length) {
                            callback(errors.length ? errors : null);
                        }
                    });
                });
            },
            _constructIndexes: constructIndexes,
            _getFieldCombinations: getFieldCombinations
        };
    })


    .factory('Index', function (Pouch, jlog) {
        var $log = jlog.loggerWithName('Index');
        function Index(model, fields_or_field) {
            this.model = model;
            if (fields_or_field.length) {
                this.fields = _.sortBy(fields_or_field, function (x) {return x});

            }
            else {
                this.fields = [fields_or_field];
            }
        }

        Index.prototype._getDesignDocName = function () {
            var name = this._getName();
            return '_design/' + name;
        };

        /**
         * Return a PouchDB secondary index.
         * See http://pouchdb.com/2014/05/01/secondary-indexes-have-landed-in-pouchdb.html
         * @private
         */
        Index.prototype._constructPouchDbView = function () {
            var name = this._getName();
            var index = {
                _id: this._getDesignDocName(),
                views: {}
            };
            index.views[name] = {
                map: this._constructMapFunction()
            };
            return  index
        };

        Index.prototype._fieldArrayAsString = function () {
            var arrContents = _.reduce(this.fields, function (memo, f) {return memo + '"' + f + '",'}, '');
            arrContents = arrContents.substring(0, arrContents.length - 1);
            return '[' + arrContents + ']';
        };

        Index.prototype._constructMapFunction = function () {
            var mapFunc = function (doc) {
                var fields = $1;
                var aggField = '';
                for (var idx in fields) {
                    //noinspection JSUnfilteredForInLoop
                    var field = fields[idx];
                    var value = doc[field];
                    if (value !== null && value !== undefined) {
                        aggField += value.toString() + '_';
                    }
                    else if(value === null) {
                        aggField += 'null_';
                    }
                    else {
                        aggField += 'undefined_';
                    }
                }
                aggField = aggField.substring(0, aggField.length-1);
                if (doc.type == "$2") {
                    emit(aggField, doc);
                }

            }.toString();
            var arr = this._fieldArrayAsString();
            mapFunc = mapFunc.replace('$1', arr);
            mapFunc = mapFunc.replace('$2', this.model);
            return mapFunc;
        };

        Index.prototype._getName = function () {
            var appendix = _.reduce(this.fields, function (memo, field) {return memo + '_' + field}, '');
            return 'Index_' + this.model + appendix;
        };

        Index.prototype.install = function (callback) {
            var constructPouchDbView = this._constructPouchDbView();
            var indexName = this._getName();
            $log.debug('Installing Index: ' + indexName, constructPouchDbView);
            Pouch.getPouch().put(constructPouchDbView, function (err, resp) {
                if (err) {
                    if (err.status === 409) {
                        $log.debug(indexName + ' already installed');
                        err = null;
                    }
                }
                callback(err, resp);
            });
        };

        return Index;
    })

;