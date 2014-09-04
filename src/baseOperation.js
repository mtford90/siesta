var log = require('../node_modules/operations/src/log');
var Logger  = log.loggerWithName('OldOperation');
Logger.setLevel(log.Level.warn);


function BaseOperation(name, work, completionCallback) {
    if (!this) return new BaseOperation(name, work, completionCallback);
    var self = this;
    this.name = name;
    this.work = work;
    this.error = null;
    this.completed = false;
    this.result = null;
    this.running = false;
    this.completionCallback = completionCallback;
    this.purpose = '';
    Object.defineProperty(this, 'failed', {
        get: function () {
            return !!self.error;
        },
        enumerable: true,
        configurable: true
    });
}

BaseOperation.prototype.start = function () {
    if (!this.running && !this.completed) {
        Logger.trace('Starting operation: ' + this._dump(true));
        this.running = true;
        var self = this;
        this.work(function (err, payload) {
            self.result = payload;
            self.error = err;
            self.completed = true;
            self.running = false;
            Logger.trace('Finished operation: ' + self._dump(true));
            if (self.completionCallback) {
                self.completionCallback.call(this);
            }
        });
    }
    else {
        Logger.warn('Start called twice on operation');
    }
};

BaseOperation.prototype._dump = function (asJson) {
    var obj = {
        purpose: this.purpose,
        name: this.name,
        error: this.error,
        completed: this.completed,
        failed: this.failed,
        running: this.running
    };
    return asJson ? JSON.stringify(obj, null, 4) : obj;
};


function CompositeOperation(name, operations, completionCallback) {
    if (!this) return new CompositeOperation;
    var self = this;
    this.operations = operations;

    var work = function (done) {
        Logger.trace('Starting ' + self._numOperationsRemaining.toString() + ' operations');
        _.each(self.operations, function (op) {
            Logger.trace('Starting operation: ' + op._dump(true));
            op.completionCallback = function () {
                Logger.trace('Finished operation: ' + op._dump(true));
                var numOperationsRemaining = self._numOperationsRemaining;
                if (!numOperationsRemaining) {
                    var errors = _.pluck(self.operations, 'error');
                    var results = _.pluck(self.operations, 'result');
                    done(_.some(errors) ? errors : null, _.some(results) ? results : null);
                }
                Logger.trace('CompositeOperation state: ' + self._dump(true));
            };
            op.start();
        });
    };

    Object.defineProperty(this, '_numOperationsRemaining', {
        get: function () {
            return _.reduce(self.operations, function (memo, op) {
                if (op.completed) {
                    return memo + 0;
                }
                return memo + 1;
            }, 0);
        },
        enumerable: true,
        configurable: true
    });

    BaseOperation.call(this, name, work, completionCallback);
}

CompositeOperation.prototype = Object.create(BaseOperation.prototype);

CompositeOperation.prototype._dump = function (asJson) {
    var self = this;
    var obj = {
        name: this.name,
        purpose: this.purpose,
        error: this.error,
        completed: this.completed,
        failed: this.failed,
        running: this.running,
        completedOperations: _.reduce(self.operations, function (memo, op) {
            if (op.completed) {
                memo.push(op._dump());
            }
            return memo;
        }, []),
        uncompletedOperations: _.reduce(self.operations, function (memo, op) {
            if (!op.completed) {
                memo.push(op._dump());
            }
            return memo;
        }, [])
    };
    return asJson ? JSON.stringify(obj, null, 4) : obj;
};

exports.CompositeOperation = CompositeOperation;
exports.BaseOperation = BaseOperation;
