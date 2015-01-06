//var s = require('../core/index');
//var assert = require('chai').assert;
//
//describe.only('paginator', function () {
//    var Car, MyCollection;
//    var server;
//
//    before(function () {
//        s.ext.storageEnabled = false;
//    });
//
//    beforeEach(function (done) {
//        siesta.reset(done);
//    });
//
//    afterEach(function () {
//        this.sinon.restore();
//        this.server.restore();
//        server = null;
//    });
//
//    beforeEach(function (done) {
//        this.sinon = sinon.sandbox.create();
//        this.server = sinon.fakeServer.create();
//        this.server.autoRespond = true;
//        server = this.server;
//        s.reset(function () {
//            MyCollection = s.collection('MyCollection');
//            MyCollection.baseURL = 'http://mywebsite.co.uk/';
//            Car = MyCollection.model('Car', {
//                id: 'id',
//                attributes: ['colour', 'name']
//            });
//            s.install(done);
//        });
//    });
//
//    describe('_extractData', function () {
//
//        it('null', function () {
//            var paginator = Car.paginator({
//                dataPath: null
//            });
//            var data = {};
//            assert.equal(paginator._extractData(data), data);
//        });
//
//        it('simple', function () {
//            var paginator = Car.paginator({
//                dataPath: 'data'
//            });
//            var data = {};
//            assert.equal(paginator._extractData({data: data}), data);
//        });
//
//        it('nested', function () {
//            var paginator = Car.paginator({
//                dataPath: 'path.to.something'
//            });
//            var data = {};
//            assert.equal(paginator._extractData({path: {to: {something: data}}}), data);
//        });
//
//    });
//
//    describe('get page', function () {
//        describe('GET, defaults', function () {
//            var paginator, resp;
//            beforeEach(function (done) {
//                server.respondWith(
//                    "GET",
//                    "http://mywebsite.co.uk/path/to/something",
//                    [200, {
//                        "Content-Type": "application/json"
//                    }, JSON.stringify({
//                        numPages: 1,
//                        count: 1,
//                        data: [
//                            {
//                                colour: 'red',
//                                name: 'Aston Martin',
//                                owner: '093hodhfno',
//                                id: '5'
//                            }
//                        ]
//                    })]);
//                paginator = Car.paginator({
//                    path: 'path/to/something'
//                });
//                paginator.page().then(function (_resp) {
//                    resp = _resp;
//                    done();
//                }).catch(done).done();
//            });
//
//            it('maps the car', function (done) {
//                assert.equal(resp.length, 1);
//                var car = resp[0];
//                assert.equal(car.colour, 'red');
//                assert.equal(car.name, 'Aston Martin');
//                done();
//            });
//
//            it('takes num pages', function () {
//                assert.equal(paginator.numPages, 1);
//            });
//
//            it('takes count', function () {
//                assert.equal(paginator.count, 1);
//            });
//
//        });
//        describe('GET, defaults, page', function () {
//            var paginator, resp;
//            beforeEach(function (done) {
//                server.respondWith(
//                    "GET",
//                    "http://mywebsite.co.uk/path/to/something?page=1",
//                    [200, {
//                        "Content-Type": "application/json"
//                    }, JSON.stringify({
//                        numPages: 1,
//                        count: 1,
//                        data: [
//                            {
//                                colour: 'red',
//                                name: 'Aston Martin',
//                                owner: '093hodhfno',
//                                id: '5'
//                            }
//                        ]
//                    })]);
//                paginator = Car.paginator({
//                    path: 'path/to/something'
//                });
//                paginator.page({page: 1}).then(function (_resp) {
//                    resp = _resp;
//                    done();
//                }).catch(done).done();
//            });
//
//            it('maps the car', function (done) {
//                assert.equal(resp.length, 1);
//                var car = resp[0];
//                assert.equal(car.colour, 'red');
//                assert.equal(car.name, 'Aston Martin');
//                done();
//            });
//
//            it('takes num pages', function () {
//                assert.equal(paginator.numPages, 1);
//            });
//
//            it('takes count', function () {
//                assert.equal(paginator.count, 1);
//            });
//
//        });
//        describe('GET, defaults, page + page size', function () {
//            var paginator, resp;
//            beforeEach(function (done) {
//                server.respondWith(
//                    "GET",
//                    "http://mywebsite.co.uk/path/to/something?page=1&pageSize=10",
//                    [200, {
//                        "Content-Type": "application/json"
//                    }, JSON.stringify({
//                        numPages: 1,
//                        count: 1,
//                        data: [
//                            {
//                                colour: 'red',
//                                name: 'Aston Martin',
//                                owner: '093hodhfno',
//                                id: '5'
//                            }
//                        ]
//                    })]);
//                paginator = Car.paginator({
//                    path: 'path/to/something'
//                });
//                paginator.page({page: 1, pageSize: 10}).then(function (_resp) {
//                    resp = _resp;
//                    done();
//                }).catch(done).done();
//            });
//
//            it('maps the car', function (done) {
//                assert.equal(resp.length, 1);
//                var car = resp[0];
//                assert.equal(car.colour, 'red');
//                assert.equal(car.name, 'Aston Martin');
//                done();
//            });
//
//            it('takes num pages', function () {
//                assert.equal(paginator.numPages, 1);
//            });
//
//            it('takes count', function () {
//                assert.equal(paginator.count, 1);
//            });
//
//        });
//        describe('GET, defaults, page + page size, different names', function () {
//            var paginator, resp;
//            beforeEach(function (done) {
//                server.respondWith(
//                    "GET",
//                    "http://mywebsite.co.uk/path/to/something?page_num=1&per_page=10",
//                    [200, {
//                        "Content-Type": "application/json"
//                    }, JSON.stringify({
//                        numPages: 1,
//                        count: 1,
//                        data: [
//                            {
//                                colour: 'red',
//                                name: 'Aston Martin',
//                                owner: '093hodhfno',
//                                id: '5'
//                            }
//                        ]
//                    })]);
//                paginator = Car.paginator({
//                    path: 'path/to/something',
//                    page: 'page_num',
//                    pageSize: 'per_page'
//                });
//                paginator.page({page: 1, pageSize: 10}).then(function (_resp) {
//                    resp = _resp;
//                    done();
//                }).catch(done).done();
//            });
//
//            it('maps the car', function (done) {
//                assert.equal(resp.length, 1);
//                var car = resp[0];
//                assert.equal(car.colour, 'red');
//                assert.equal(car.name, 'Aston Martin');
//                done();
//            });
//
//            it('takes num pages', function () {
//                assert.equal(paginator.numPages, 1);
//            });
//
//            it('takes count', function () {
//                assert.equal(paginator.count, 1);
//            });
//
//        });
//        describe('GET, different response parameter names', function () {
//            var paginator, resp;
//            beforeEach(function (done) {
//                server.respondWith(
//                    "GET",
//                    "http://mywebsite.co.uk/path/to/something",
//                    [200, {
//                        "Content-Type": "application/json"
//                    }, JSON.stringify({
//                        num_pages: 1,
//                        total_count: 1,
//                        path: {
//                            to: [
//                                {
//                                    colour: 'red',
//                                    name: 'Aston Martin',
//                                    owner: '093hodhfno',
//                                    id: '5'
//                                }
//                            ]
//                        }
//                    })]);
//                paginator = Car.paginator({
//                    path: 'path/to/something',
//                    numPages: 'num_pages',
//                    count: 'total_count',
//                    dataPath: 'path.to'
//                });
//                paginator.page().then(function (_resp) {
//                    resp = _resp;
//                    done();
//                }).catch(done).done();
//            });
//
//            it('maps the car', function (done) {
//                assert.equal(resp.length, 1);
//                var car = resp[0];
//                assert.equal(car.colour, 'red');
//                assert.equal(car.name, 'Aston Martin');
//                done();
//            });
//
//            it('takes num pages', function () {
//                assert.equal(paginator.numPages, 1);
//            });
//
//            it('takes count', function () {
//                assert.equal(paginator.count, 1);
//            });
//
//        });
//        describe('GET, use functions to get data', function () {
//            var paginator, resp;
//            beforeEach(function (done) {
//                server.respondWith(
//                    "GET",
//                    "http://mywebsite.co.uk/path/to/something",
//                    [200, {
//                        "Content-Type": "application/json"
//                    }, JSON.stringify({
//                        num_pages: 1,
//                        total_count: 1,
//                        path: {
//                            to: [
//                                {
//                                    colour: 'red',
//                                    name: 'Aston Martin',
//                                    owner: '093hodhfno',
//                                    id: '5'
//                                }
//                            ]
//                        }
//                    })]);
//                paginator = Car.paginator({
//                    path: 'path/to/something',
//                    numPages: function (data) {
//                        return data.num_pages;
//                    },
//                    count: function (data) {
//                        return data.total_count;
//                    },
//                    dataPath: function (data) {
//                        return data.path.to
//                    }
//                });
//                paginator.page().then(function (_resp) {
//                    resp = _resp;
//                    done();
//                }).catch(done).done();
//            });
//
//            it('maps the car', function (done) {
//                assert.equal(resp.length, 1);
//                var car = resp[0];
//                assert.equal(car.colour, 'red');
//                assert.equal(car.name, 'Aston Martin');
//                done();
//            });
//
//            it('takes num pages', function () {
//                assert.equal(paginator.numPages, 1);
//            });
//
//            it('takes count', function () {
//                assert.equal(paginator.count, 1);
//            });
//
//        });
//        describe('GET, use functions to get data using jqxhr', function () {
//            var paginator, resp;
//            beforeEach(function (done) {
//                server.respondWith(
//                    "GET",
//                    "http://mywebsite.co.uk/path/to/something",
//                    [200, {
//                        "Content-Type": "application/json",
//                        "X-Num-Pages": 1,
//                        "X-Total-Count": 1
//                    }, JSON.stringify({
//                        path: {
//                            to: [
//                                {
//                                    colour: 'red',
//                                    name: 'Aston Martin',
//                                    owner: '093hodhfno',
//                                    id: '5'
//                                }
//                            ]
//                        }
//                    })]);
//                paginator = Car.paginator({
//                    path: 'path/to/something',
//                    numPages: function (data, jqXHR) {
//                        return jqXHR.getResponseHeader('X-Num-Pages');
//                    },
//                    count: function (data, jqXHR) {
//                        return jqXHR.getResponseHeader('X-Total-Count');
//                    },
//                    dataPath: function (data) {
//                        return data.path.to;
//                    }
//                });
//                paginator.page().then(function (_resp) {
//                    resp = _resp;
//                    done();
//                }).catch(done).done();
//            });
//
//            it('maps the car', function (done) {
//                assert.equal(resp.length, 1);
//                var car = resp[0];
//                assert.equal(car.colour, 'red');
//                assert.equal(car.name, 'Aston Martin');
//                done();
//            });
//
//            it('takes num pages', function () {
//                assert.equal(paginator.numPages, 1);
//            });
//
//            it('takes count', function () {
//                assert.equal(paginator.count, 1);
//            });
//
//        });
//        describe('POST, defaults', function () {
//            var paginator, resp;
//            beforeEach(function (done) {
//                server.respondWith(
//                    "POST",
//                    "http://mywebsite.co.uk/path/to/something",
//                    [200, {
//                        "Content-Type": "application/json"
//                    }, JSON.stringify({
//                        numPages: 1,
//                        count: 1,
//                        data: [
//                            {
//                                colour: 'red',
//                                name: 'Aston Martin',
//                                owner: '093hodhfno',
//                                id: '5'
//                            }
//                        ]
//                    })]);
//                paginator = Car.paginator({
//                    path: 'path/to/something',
//                    type: 'POST'
//                });
//                paginator.page().then(function (_resp) {
//                    resp = _resp;
//                    done();
//                }).catch(done).done();
//            });
//
//            it('maps the car', function (done) {
//                assert.equal(resp.length, 1);
//                var car = resp[0];
//                assert.equal(car.colour, 'red');
//                assert.equal(car.name, 'Aston Martin');
//                done();
//            });
//
//            it('takes num pages', function () {
//                assert.equal(paginator.numPages, 1);
//            });
//
//            it('takes count', function () {
//                assert.equal(paginator.count, 1);
//            });
//
//        });
//        describe('POST, defaults, queryParams', function () {
//            var paginator, resp;
//            beforeEach(function (done) {
//                server.respondWith(
//                    "POST",
//                    "http://mywebsite.co.uk/path/to/something",
//                    [200, {
//                        "Content-Type": "application/json"
//                    }, JSON.stringify({
//                        numPages: 1,
//                        count: 1,
//                        data: [
//                            {
//                                colour: 'red',
//                                name: 'Aston Martin',
//                                owner: '093hodhfno',
//                                id: '5'
//                            }
//                        ]
//                    })]);
//                paginator = Car.paginator({
//                    path: 'path/to/something',
//                    queryParams: false,
//                    type: 'POST'
//                });
//                paginator.page().then(function (_resp) {
//                    resp = _resp;
//                    done();
//                }).catch(done).done();
//            });
//
//            it('maps the car', function (done) {
//                assert.equal(resp.length, 1);
//                var car = resp[0];
//                assert.equal(car.colour, 'red');
//                assert.equal(car.name, 'Aston Martin');
//                done();
//            });
//
//            it('takes num pages', function () {
//                assert.equal(paginator.numPages, 1);
//            });
//
//            it('takes count', function () {
//                assert.equal(paginator.count, 1);
//            });
//        });
//    });
//})
//;