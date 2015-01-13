//var data = {
//    "by": "alandarev",
//    "id": 8582985,
//    "kids": [8583334, 8583557, 8583597, 8583266, 8583360, 8583677, 8584299, 8585254, 8588802, 8583469, 8587100, 8585300, 8583561, 8586010, 8585907, 8585040],
//    "score": 366,
//    "text": "",
//    "time": 1415618928,
//    "title": "All cameras are police cameras",
//    "type": "story",
//    "url": "http://shorttermmemoryloss.com/nor/2014/11/07/all-cameras-are-police-cameras/"
//};
//
//var siesta = require('../../core/index')
//    , assert = require('chai').assert;
//describe.only('hacker news integration test', function () {
//    // When @HiroAgustin tried to pass name of mapping to descriptor
//    // an error was thrown :(
//    // Not testing anything here in particular, just ensuring that it gets to the end
//    // w/o an error being thrown.
//
//    var server;
//
//    beforeEach(function (done) {
//        siesta.reset(function () {
//            this.sinon = sinon.sandbox.create();
//            this.server = sinon.fakeServer.create();
//            this.server.autoRespond = true;
//            server = this.server;
//            done();
//        }.bind(this));
//    });
//
//    afterEach(function () {
//        this.sinon.restore();
//        this.server.restore();
//        server = null;
//    });
//
//
//    it('problem with mapping', function () {
//        var HackerNews = siesta.collection('HackerNews');
//        HackerNews.baseURL = 'https://hacker-news.firebaseio.com/v0/';
//        var Item = HackerNews.model('Item', {
//            id: 'id'
//            , attributes: [
//                'score'
//                , 'time'
//                , 'title'
//                , 'type'
//                , 'url'
//            ]
//        });
//        HackerNews.descriptor({
//            path: 'item/*',
//            method: 'GET',
//            model: 'Item',
//            data: 'data'
//        });
//    });
//
//    it('Issue with regexp returning some array-like object', function (done) {
//        var HackerNews = siesta.collection('HackerNews');
//        HackerNews.baseURL = 'https://hacker-news.firebaseio.com/v0/';
//        var Item = HackerNews.model('Item', {
//            id: 'id'
//            , attributes: [
//                'score'
//                , 'time'
//                , 'title'
//                , 'type'
//                , 'url'
//            ]
//        });
//        HackerNews.descriptor({
//            path: 'item/*',
//            method: 'GET',
//            model: 'Item'
//        });
//        HackerNews.install(function (err) {
//            if (err) {
//                done(err);
//            }
//            else {
//                server.respondWith("GET", "https://hacker-news.firebaseio.com/v0/item/8582985.json",
//                    [200, {"Content-Type": "application/json"},
//                        JSON.stringify(data)]);
//                HackerNews.GET('item/8582985.json', function (err, item) {
//                    if (err) done(err);
//                    try {
//                        assert.ok(item);
//                    }
//                    catch (e) {
//                        err = e;
//                    }
//                    done(err);
//                });
//            }
//        });
//    });
//
//    it('default id works', function (done) {
//        var HackerNews = siesta.collection('HackerNews');
//        HackerNews.baseURL = 'https://hacker-news.firebaseio.com/v0/';
//        var Item = HackerNews.model('Item', {
//            attributes: [
//                'score'
//                , 'time'
//                , 'title'
//                , 'type'
//                , 'url'
//            ]
//        });
//        HackerNews.descriptor({
//            path: 'item/*',
//            method: 'GET',
//            model: 'Item'
//        });
//
//        HackerNews.install(function (err) {
//            if (err) {
//                done(err);
//            }
//            else {
//                server.respondWith("GET", "https://hacker-news.firebaseio.com/v0/item/8582985.json",
//                    [200, {"Content-Type": "application/json"},
//                        JSON.stringify(data)]);
//                HackerNews.GET('item/8582985.json')
//                    .then(function (item) {
//                        assert.ok(item.id, 'should have id');
//                        assert.ok(item.__values.id, 'should have id');
//                        done();
//                    }).catch(done);
//            }
//        });
//    });
//
//    it('kids', function (done) {
//        var HackerNews = siesta.collection('HackerNews');
//        HackerNews.baseURL = 'https://hacker-news.firebaseio.com/v0/';
//        HackerNews.model('Item', {
//            attributes: [
//                'score'
//                , 'time'
//                , 'title'
//                , 'type'
//                , 'url'
//            ],
//            relationships: {
//                parent: {
//                    model: 'Item'
//                    , type: 'OneToMany'
//                    , reverse: 'kids'
//                }
//            }
//        });
//        HackerNews.descriptor({
//            path: 'item/*'
//            , method: 'GET'
//            , model: 'Item'
//        });
//        HackerNews.install(function () {
//            server.respondWith("GET", "https://hacker-news.firebaseio.com/v0/item/8582985.json",
//                [200, {"Content-Type": "application/json"},
//                    JSON.stringify(data)]);
//            HackerNews.GET('item/8582985.json', function (err, item) {
//                done();
//            });
//        });
//    });
//
//});