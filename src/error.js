/**
 * @module error
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

exports.InternalSiestaError = InternalSiestaError;
