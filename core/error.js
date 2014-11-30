/**
 * @module error
 */

/**
 * Represents internal errors. These are thrown when something has gone very wrong internally. If you see one of these
 * out in the wild you probably need to file a bug report as it means some assertion has failed.
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

/**
 * Fields on error objects dished out by Siesta.
 * @type {Object}
 */
var ErrorField = {
    Message: 'message',
    Code: 'code'
};

/**
 * Enumerated errors.
 * @type {Object}
 */
var ErrorCode = {
    Unknown: 0,
    // If no descriptor matches a HTTP response/request then this error is
    NoDescriptorMatched: 1
};


/**
 * Map error codes onto descriptive messages.
 * @type {Object}
 */
var Message = {};
Message[ErrorCode.NoDescriptorMatched] = 'No descriptor matched the HTTP response/request.';

module.exports = {
    InternalSiestaError: InternalSiestaError,
    ErrorCode: ErrorCode,
    ErrorField: ErrorField,
    Message: Message
};