function RestError(message, context, ssf) {
    if (!this) {
        return new RestError(message, context);
    }

    this.message = message;

    this.context = context;
    // capture stack trace
    ssf = ssf || arguments.callee;
    if (ssf && Error.captureStackTrace) {
        Error.captureStackTrace(this, ssf);
    }
}

RestError.prototype = Object.create(Error.prototype);
RestError.prototype.name = 'RestError';
RestError.prototype.constructor = RestError;

exports.RestError = RestError;