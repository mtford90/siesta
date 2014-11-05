var log = require('./log');
var Logger = log.loggerWithName('Operation');

function Operation() {
    if (!this) {
        return new (Function.prototype.bind.apply(Operation, arguments));
    }
    var self = this;
    if (arguments.length) {
        if (typeof(arguments[0]) == 'string') {
            this.name = arguments[0];
            this.work = arguments[1];
            this.completion = arguments[2];
        }
        else if (typeof(arguments[0]) == 'function' ||
            Object.prototype.toString.call(arguments[0]) === '[object Array]' ||
            arguments[0] instanceof Operation) {
            this.work = arguments[0];
            this.completion = arguments[1];
        }
    }
    this.error = null;
    this.completed = false;
    this.result = null;
    this.running = false;
    this.cancelled = false;
    this.dependencies = [];
    this._mustSucceed = [];
    this._onCompletion = [];
    this.logLevel = null; // Override.

    Object.defineProperty(this, 'failed', {
        get: function () {
            return  !!self.error || self.failedDueToDependency;
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(this, 'composite', {
        get: function () {
            return self.work instanceof Operation ||
                Object.prototype.toString.call(self.work) === '[object Array]'
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(this, 'numOperationsRemaining', {
        get: function () {
            if (self.work instanceof Operation) {
                return self.work.completed ? 0 : 1
            }
            else if (Object.prototype.toString.call(self.work) === '[object Array]') {
                return _.reduce(self.work, function (memo, op) {
                    if (!op.completed) {
                        return memo + 1;
                    }
                    return memo;
                }, 0);
            }
            else {
                return null;
            }
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(this, 'canRun', {
        get: function () {
            if (self.dependencies.length) {
                return _.reduce(self.dependencies, function (memo, dep) {
                    var mustSucceed = self._mustSucceed.indexOf(dep) > -1;
                    var canRun = memo && dep.completed;
                    if (mustSucceed && canRun) {
                        canRun = canRun && !(dep.failed || dep.cancelled);
                    }
                    return canRun;
                }, true);
            }
            return true;
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(this, 'failedDueToDependency', {
        get: function () {
            if (self.dependencies.length) {
                var failedDeps = _.reduce(self.dependencies, function (memo, dep) {
                    var mustSucceed = self._mustSucceed.indexOf(dep) > -1;
                    var failed = ((dep.failed || dep.cancelled) && mustSucceed);
                    if (failed) {
                        memo.push(dep);
                    }
                    return memo;
                }, []);
                return failedDeps.length ? failedDeps : false;
            }
            return false;
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(this, 'failedDueToCancellationOfDependency', {
        get: function () {
            if (self.dependencies.length) {
                var cancelled = _.reduce(self.dependencies, function (memo, dep) {
                    var mustSucceed = self._mustSucceed.indexOf(dep) > -1;
                    if (mustSucceed) {
                        if (dep.cancelled) memo.push(dep);
                    }
                    return memo;
                }, []);
                return cancelled.length ? cancelled : false;
            }
            return false;
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(this, 'loggingOveridden', {
        get: function () {
            if (self.logLevel) {
                return self.logLevel <= log.Level.info;
            }
            return false;
        },
        enumerable: true,
        configurable: true
    })


}

Operation.running = [];

Operation.prototype._startSingle = function () {
    var self = this;
    this.work(function (err, payload) {
        self.result = payload;
        self.error = err;
        self.completed = true;
        self.running = false;
        self._complete();
    });
};

Operation.prototype._startComposite = function () {
    var self = this;
    var operations = self.work instanceof Operation ? [self.work] : self.work;
    _.each(operations, function (op) {
        op.onCompletion(function () {
            var numOperationsRemaining = self.numOperationsRemaining;
            var name = self.name || 'Unnamed';
            Logger.debug(name + ' has ' + numOperationsRemaining.toString() + ' operations remaining');
            if (!numOperationsRemaining) {
                var errors = _.pluck(operations, 'error');
                var results = _.pluck(operations, 'result');
                self.result = _.some(results) ? results : null;
                self.error = _.some(errors) ? errors : null;
                self.completed = true;
                self.running = false;
                self._complete();
            }
        });
        op.start();
    });
};

Operation.prototype._logCompletion = function () {
    var logFunc = this._getLogFunc();
    if (Logger.info.isEnabled || this.loggingOveridden) {
        var name = this.name || 'Unnamed';
        var failedDependencies = this.failedDueToDependency;
        if (failedDependencies) {
            logFunc('"' + name + '" failed due to failure/cancellation of dependencies: ' + _.pluck(failedDependencies, 'name').join(', '));
        }
        else if (this.failed) {
            var err = this.error;
            // Remove null errors.
            if (Object.prototype.toString.call(err) === '[object Array]') {
                err = _.filter(err, function (e) {return e });
            }
            else {
                err = [this.error];
            }
            logFunc('"' + name + '" failed due to errors:', err);
        }
        else if (this.cancelled) {
            logFunc('"' + name + '" has been cancelled.');
        }
        else {
            logFunc('"' + name + '" has succeeded.');
        }
    }
};

Operation.prototype._getLogFunc = function () {
    if (this.logLevel) {
        return _.bind(Logger.override, Logger, log.Level.info, this.logLevel);
    }
    return Logger.info;
};

Operation.prototype._logStart = function () {
    if (Logger.info.isEnabled || this.loggingOveridden) {
        var name = this.name || 'Unnamed';
        var logFunc = this._getLogFunc();
        logFunc('"' + name + '" has started.');
    }
};


Operation.prototype._complete = function () {
    var self = this;
    this.completed = true;
    var idx = Operation.running.indexOf(this);
    Operation.running.splice(idx, 1);
    if (this.completion) {
        _.bind(this.completion, this)();
    }
    this._logCompletion();
    _.each(this._onCompletion, function (o) {
        _.bind(o, self)();
    });
};

Operation.prototype.__start = function () {
    this._logStart();
    if (this.work) {
        if (this.composite) {
            this._startComposite();
        }
        else {
            this._startSingle();
        }
        Operation.running.push(this);
    }
    else {
        this.result = null;
        this.error = null;
        this.running = false;
        this._complete();
    }
};

Operation.prototype.start = function () {
    var self = this;
    var neverStarted = !this.running && !this.completed;
    var neverStartedAndFailed = neverStarted && this.failed;
    // A dependency failed or was cancelled before this operation started.
    if (neverStartedAndFailed) {
        this._complete();
    }
    else if (neverStarted) {
        this.running = true;
        if (this.canRun) {
            this.__start();
        }
        else {
            _.each(this.dependencies, function (dep) {
                dep.onCompletion(function () {
                    if (self.canRun) {
                        self.__start();
                    }
                })
            });
        }
    }
};


Operation.prototype.addDependency = function () {
    var self = this;
    if (arguments.length == 1) {
        this.dependencies.push(arguments[0]);
    }
    else if (arguments.length) {
        var args = arguments;
        var lastArg = args[args.length - 1];
        var mustSucceed = false;
        if (typeof(lastArg) == 'boolean') {
            args = Array.prototype.slice.call(args, 0, args.length - 1);
            mustSucceed = lastArg;
        }
        _.each(args, function (arg) {
            self.dependencies.push(arg);
        });
        if (mustSucceed) {
            _.each(args, function (arg) {
                self._mustSucceed.push(arg);
            })
        }
    }
};

Operation.prototype.onCompletion = function (o) {
    if (!this.completed) {
        this._onCompletion.push(o);
    }
    else {
        _.bind(o, this)();
    }
};

Operation.prototype.cancel = function (callback) {
    if (!this.cancelled) {
        this.cancelled = true;
        Logger.debug('Cancelling ' + this.name, this);
        if (this.composite) {
            _.each(this.work, function (subop) {
                subop.cancel();
            });
        }
        this.onCompletion(function () {
            this.running = false;
            if (callback) callback();
        });
    }
};

Object.defineProperty(Operation, 'logLevel', {
    get: function () {
        return Logger.currentLevel();
    },
    set: function (v) {
        Logger.setLevel(v);
    },
    configurable: true,
    enumerable: true
});

module.exports.Operation = Operation;
