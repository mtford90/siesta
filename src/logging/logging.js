/**
 * A configurable logging service that wraps $log and can also intercept and log http requests.
 */
angular.module('logging', [])

    .constant('logLevels', {
        trace: 0,
        debug: 1,
        info: 2,
        warning: 3,
        warn: 3,
        error: 4
    })

    .constant('LOG_HEADERS', true)

    .factory('jlogConfig', function (logLevels) {
        var ll = {
            http: logLevels.debug,
            resources: logLevels.warning,
            TasksCtrl: logLevels.debug
        };

        var t = {};
        t[logLevels.trace] = 'TRACE';
        t[logLevels.debug] = 'DEBUG';
        t[logLevels.info] = 'INFO ';
        t[logLevels.warning] = 'WARN ';
        t[logLevels.error] = 'ERROR';

        var d = logLevels.trace;

        return {
            logLevel: function (name) {
                var level = ll[name];
                if (level) {
                    return level;
                }
                else {
                    return d;
                }
            },
            logLevelAsText: function(level) {
                return t[level];
            }
        };
    })

    .factory('jlog', function ($log, jlogConfig, logLevels) {
        var Logger = function(name) {
            this.name = name;
        };
        Logger.prototype.performLog = function (logFunc, level, message, otherArguments) {
            var currentLevel = jlogConfig.logLevel(this.name);
            if (currentLevel <= level) {
                logFunc = _.partial(logFunc, jlogConfig.logLevelAsText(level) + ' [' + this.name + ']: ' + message);
                var args = [];
                for (var i=0; i<otherArguments.length; i++) {
                    args[i] = otherArguments[i];
                }
                args.splice(0, 1);
                logFunc.apply(logFunc, args);
            }
        };
        Logger.prototype.$trace = function (message) {
            this.performLog($log.debug, logLevels.trace, message, arguments);
        };
        Logger.prototype.trace = Logger.prototype.$trace;
        Logger.prototype.$debug = function (message) {
            this.performLog($log.debug, logLevels.debug, message, arguments);
        };
        Logger.prototype.debug = Logger.prototype.$debug;
        Logger.prototype.$log = Logger.prototype.$debug;
        Logger.prototype.log = Logger.prototype.$debug;
        Logger.prototype.$info = function (message) {
            this.performLog($log.info, logLevels.info, message, arguments);
        };
        Logger.prototype.info = Logger.prototype.$info;
        Logger.prototype.$warn = function (message) {
            this.performLog($log.warn, logLevels.warning, message, arguments);
        };
        Logger.prototype.warn = Logger.prototype.$warn;
        Logger.prototype.warning = Logger.prototype.$warn;
        Logger.prototype.$warning = Logger.prototype.$warn;
        Logger.prototype.$error = function (message) {
            this.performLog($log.error, logLevels.error, message, arguments);
        };
        Logger.prototype.error = Logger.prototype.$error;
        return {
            loggerWithName: function (name) {
                return new Logger(name);
            }
        };
    })


    .factory('LogHTTPInterceptor', function ($q, jlog, LOG_HEADERS) {
        var $log = jlog.loggerWithName('http');
        var serialize = function (obj) {
            var str = [];
            for (var p in obj) {
                if (obj.hasOwnProperty(p)) {
                    str.push(encodeURIComponent(p) + "=" + encodeURIComponent(obj[p]));
                }
            }
            return '?' + str.join("&");
        };

        function logResponse(response) {
            var data = response.data;
            var config = response.config;
            var url = config.url;
            if (config.params) {
                url += serialize(config.params);
            }
            var prelude = response.status + ' ' + config.method + ' ' + url;
            var contentType = response.headers('Content-Type');
            var isJSON = false;
            if (contentType) {
                isJSON = contentType.indexOf('json') > 0;
            }
            if (data !== undefined && isJSON) {
                $log.debug(prelude + ':', data);
            }
            else {
                $log.debug(prelude);
            }
        }

        function logRequest(config) {
            var url = config.url;
            if (config.params) {
                url += serialize(config.params);
            }
            var prelude;
            if (LOG_HEADERS) {
                prelude = '(' + JSON.stringify(config.headers) + ') ' + config.method + ' ' + url;
            }
            else {
                prelude = config.method + ' ' + url;
            }

            if (config.data === undefined) {
                $log.debug(prelude);
            }
            else {
                $log.debug(prelude + ':', config.data);
            }
        }

        return {
            response: function (response) {
                if (response.config) {
                    logResponse(response);
                }
                return response;
            },
            responseError: function (rejection) {
                if (rejection.config) {
                    logResponse(rejection);
                }
                return $q.reject(rejection);
            },
            request: function (config) {
                logRequest(config);
                return config;
            },
            requestError: function (rejection) {
                $log.error('request error intercept');
                logRequest(rejection);
                return $q.reject(rejection);
            }
        };
    })

    .config(function ($httpProvider) {
        $httpProvider.interceptors.push('LogHTTPInterceptor');
    })


;