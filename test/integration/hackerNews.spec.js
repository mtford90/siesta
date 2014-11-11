var data = {
    "by": "alandarev",
    "id": 8582985,
    "kids": [8583334, 8583557, 8583597, 8583266, 8583360, 8583677, 8584299, 8585254, 8588802, 8583469, 8587100, 8585300, 8583561, 8586010, 8585907, 8585040],
    "score": 366,
    "text": "",
    "time": 1415618928,
    "title": "All cameras are police cameras",
    "type": "story",
    "url": "http://shorttermmemoryloss.com/nor/2014/11/07/all-cameras-are-police-cameras/"
};

var siesta = require('../../index');
var assert = require('chai').assert;

describe('hacker news integration test', function () {
    // When @HiroAgustin tried to pass name of mapping to descriptor
    // an error was thrown :(
    // Not testing anything here in particular, just ensuring that it gets to the end
    // w/o an error being thrown.
    it('problem with mapping', function () {
        var HackerNews = new siesta.Collection('HackerNews');
        HackerNews.baseURL = 'https://hacker-news.firebaseio.com/v0/';
        var Item = HackerNews.mapping('Item', {
            id: 'id'
            , attributes: [
                'score'
                , 'time'
                , 'title'
                , 'type'
                , 'url'
            ]
        });
        HackerNews.descriptor({
            path: 'item/*',
            method: 'GET',
            mapping: 'Item',
            data: 'data'
        });
    });

    it('Issue with regexp returning some array-like object', function (done) {
        var HackerNews = new siesta.Collection('HackerNews');
        HackerNews.baseURL = 'https://hacker-news.firebaseio.com/v0/';
        var Item = HackerNews.mapping('Item', {
            id: 'id'
            , attributes: [
                'score'
                , 'time'
                , 'title'
                , 'type'
                , 'url'
            ]
        });
        HackerNews.descriptor({
            path: 'item/*',
            method: 'GET',
            mapping: Item
        });
        HackerNews.install(function (err) {
            if (err) {
                done(err);
            }
            else {
                var server = sinon.fakeServer.create();
                server.respondWith("GET", "https://hacker-news.firebaseio.com/v0/item/8582985.json",
                    [200, {"Content-Type": "application/json"},
                        JSON.stringify(data)]);
                HackerNews.GET('item/8582985.json', function (err, item) {
                    if (err) done(err);
                    assert.ok(item);
                    done();
                });
                server.respond();
            }
        });
    });


});