angular.module('restkit.mapping', ['restkit.indexing', 'restkit', 'restkit.query'])

    .factory('defineSubProperty', function () {
        return function (k, subObj) {
            return Object.defineProperty(this, k, {
                get: function () {
                    return subObj[k];
                },
                set: function (name) {
                    subObj[ k] = name;
                },
                enumerable: true,
                configurable: true
            });
        }
    })

    .factory('Mapping', function (Indexes, Query, defineSubProperty) {


        function Mapping(opts) {
            var self = this;
            this._opts = opts;
            Object.defineProperty(this, '_fields', {
                get: function () {
                    var fields = [];
                    if (self._opts.id) {
                        fields.push('id');
                    }
                    if (self._opts.attributes) {
                        _.each(self._opts.attributes, function (x) {fields.push(x)});
                    }
                    if (self._opts.relationships) {
                        _.each(self._opts.relationships, function (x) {fields.push(x)});
                    }

                    return fields;
                },
                enumerable: true,
                configurable: true
            });
            defineSubProperty.call(this, 'type', self._opts);
            defineSubProperty.call(this, 'id', self._opts);
        }

        Mapping.prototype.query = function (query, callback) {
            var q = new Query(this.type, query);
            q.execute(callback);
        };

        Mapping.prototype.get = function (id, callback) {
            var opts = {};
            opts[this.id] = id;
            var q = new Query(this.type, opts);
            q.execute(function (err, rows) {
                var obj = null;
                if (!err && rows.length) {
                    if (rows.length > 1) {
                        err = 'More than one object with id=' + id.toString();
                    }
                    else {
                        obj = rows[0];
                    }
                }
                if (callback) callback(err, obj);
            });
        };

        Mapping.prototype.all = function (callback) {
            var q = new Query(this.type, {});
            q.execute(callback);
        };

        Mapping.prototype.install = function (callback) {
            Indexes.installIndexes(this.type, this._fields, callback);
        };

        Mapping.prototype._validate = function () {
            var errors = [];
            if (!this.type) {
                errors.push('Must specify a type');
            }
            return errors;
        };

        return Mapping;
    })

;