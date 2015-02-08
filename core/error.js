/**
 * @module error
 */
(function () {

    /**
     * Users should never see these thrown. A bug report should be filed if so as it means some assertion has failed.
     * @param message
     * @param context
     * @param ssf
     * @constructor
     */
    function InternalSiestaError(message, context, ssf) {
        this.message = message;
        this.context = context;
        // capture stack trace
        ssf = ssf || arguments.callee;
        if (ssf && Error.captureStackTrace) {
            Error.captureStackTrace(this, ssf);
        }
    }

    InternalSiestaError.prototype = Object.create(Error.prototype);
    InternalSiestaError.prototype.name = 'InternalSiestaError';
    InternalSiestaError.prototype.constructor = InternalSiestaError;

    function isSiestaError(err) {
        if (typeof err == 'object') {
            return 'error' in err && 'ok' in err && 'reason' in err;
        }
        return false;
    }

    module.exports = function (errMessage, extra) {
        if (isSiestaError(errMessage)) {
            return errMessage;
        }
        var err = {
            reason: errMessage,
            error: true,
            ok: false
        };
        for (var prop in extra || {}) {
            if (extra.hasOwnProperty(prop)) err[prop] = extra[prop];
        }
        err.toString = function () {
            return JSON.stringify(this);
        };
        return err;
    };

    module.exports.InternalSiestaError = InternalSiestaError;

})();