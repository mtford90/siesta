angular.module('restkit.mapping', ['restkit.indexing', 'restkit', 'restkit.query'])

    .factory('Mapping', function (Indexes, RawQuery, defineSubProperty) {
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
            defineSubProperty.call(this, 'api', self._opts);
        }

        Mapping.prototype.query = function (query, callback) {
            var q = new RawQuery(this.api, this.type, query);
            q.execute(callback);
        };

        Mapping.prototype.get = function (id, callback) {
            var opts = {};
            opts[this.id] = id;
            var q = new RawQuery(this.api, this.type, opts);
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
            var q = new RawQuery(this.api, this.type, {});
            q.execute(callback);
        };

        Mapping.prototype.install = function (callback) {
            var errors = this._validate();
            if (!errors.length) {
                Indexes.installIndexes(this.api, this.type, this._fields, callback);
            }
            else {
                if(callback) callback(errors);
            }
        };

        Mapping.prototype._validate = function () {
            var errors = [];
            if (!this.type) {
                errors.push('Must specify a type');
            }
            if (!this.api) {
                errors.push('A mapping must belong to an api');
            }
            return errors;
        };

        return Mapping;
    })

;