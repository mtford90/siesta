var _internal = siesta._internal,
    log = _internal.log,
    InternalSiestaError = _internal.error.InternalSiestaError,
    util = _internal.util,
    _ = util._;

var querystring = require('querystring');

var Logger = log.loggerWithName('Paginator');

function Paginator(opts) {
    this.paginatorOpts = opts.paginator || {
        path: '/',
        model: null
    };
    this.requestOpts = {
        page: 'page',
        queryParams: true,
        pageSize: 'pageSize'
    };
    _.extend(this.requestOpts, this.paginatorOpts.request);
    this.responseOpts = {
        numPages: 'numPages',
        data: 'data',
        count: 'count'
    };
    _.extend(this.responseOpts, this.paginatorOpts.response);
    delete this.paginatorOpts.request;
    delete this.paginatorOpts.response;
    this.ajaxOpts = opts.ajax || {
        type: 'GET',
        dataType: 'json'
    };
    this.numPages = null;
    this.count = null;
    this.validate();
}

_.extend(Paginator.prototype, {
    _extract: function (path, data, jqXHR) {
        if (path) {
            if (typeof path == 'function') {
                data = path(data, jqXHR);
            }
            else {
                var splt = path.split('.');
                for (var i = 0; i < splt.length; i++) {
                    var key = splt[i];
                    data = data[key];
                }
            }
        }
        return data;
    },
    _extractData: function (data, jqXHR) {
        return this._extract(this.responseOpts.data, data, jqXHR);
    },
    _extractNumPages: function (data, jqXHR) {
        return this._extract(this.responseOpts.numPages, data, jqXHR);
    },
    _extractCount: function (data, jqXHR) {
        return this._extract(this.responseOpts.count, data, jqXHR);
    },
    /**
     * var parser = document.createElement('a');
     * parser.href = "http://example.com:3000/pathname/?search=test#hash";
     * parser.href = URL;
     * parser.protocol; // => "http:"
     * parser.hostname; // => "example.com"
     * parser.port;     // => "3000"
     * parser.pathname; // => "/pathname/"
     * parser.search;   // => "?search=test"
     * parser.hash;     // => "#hash"
     * parser.host;     // => "example.com:3000"
     * @param {String} URL
     * @private
     */
    _parseURL: function (URL) {
        var parser = document.createElement('a');
        parser.href = URL;
        return parser;
    },
    page: function (optsOrCallback, callback) {
        var self = this;
        var deferred = window.q ? window.q.defer() : null;
        var opts = {};
        if (typeof optsOrCallback == 'function') {
            callback = optsOrCallback;
        }
        else if (optsOrCallback) {
            opts = optsOrCallback;
        }
        var page = opts.page,
            pageSize = opts.pageSize;
        callback = util.cb(callback, deferred);
        var ajax = siesta.ext.http.ajax,
            ajaxOpts = _.extend({}, this.ajaxOpts);
        var collection = this.paginatorOpts.model.collection
            , url = collection.baseURL + this.paginatorOpts.path;
        if (this.requestOpts.queryParams) {
            var parser = this._parseURL(url);
            var rawQuery = parser.search,
                rawQuerySplt = rawQuery.split('?');
            if (rawQuerySplt.length > 1) rawQuery = rawQuerySplt[1];
            var query = querystring.parse(rawQuery);
            if (page) {
                query[this.requestOpts.page] = page;
            }
            if (pageSize) {
                query[this.requestOpts.pageSize] = pageSize;
            }
            if (Object.keys(query).length) {
                parser.search = '?' + querystring.stringify(query);
            }
            url = parser.href;
        }
        else {
            var data = {};
            if (page) {
                data[this.requestOpts.page] = page;
            }
            if (pageSize) {
                data[this.requestOpts.pageSize] = pageSize;
            }
            ajaxOpts.data = data
        }
        _.extend(ajaxOpts, {
            url: url,
            success: function (data, textStatus, jqXHR) {
                var modelData = self._extractData(data, jqXHR),
                    count = self._extractCount(data, jqXHR),
                    numPages = self._extractNumPages(data, jqXHR);
                self.paginatorOpts.model.map(modelData, function (err, modelInstances) {
                    if (!err) {
                        self.count = count;
                        self.numPages = numPages;
                        callback(null, modelInstances, {data: data, textStatus: textStatus, jqXHR: jqXHR});
                    }
                    else {
                        callback(err);
                    }
                });
            },
            fail: callback
        });
        ajax(ajaxOpts);
        return deferred ? deferred.promise : null;
    },
    validate: function () {
        if (!this.paginatorOpts.model) throw new InternalSiestaError('Paginator must have a model');
    }
});

module.exports = Paginator;