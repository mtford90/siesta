var argsarray = require('argsarray');

/**
 * Class for facilitating "chained" behaviour e.g:
 *
 * var cancel = Users
 *  .on('new', function (user) {
   *     // ...
   *   })
 *  .query({$or: {age__gte: 20, age__lte: 30}})
 *  .on('*', function (change) {
   *     // ..
   *   });
 *
 * @param opts
 * @constructor
 */
function Chain(opts) {
  this.opts = opts;
}

Chain.prototype = {
  /**
   * Construct a link in the chain of calls.
   * @param opts
   * @param opts.fn
   * @param opts.type
   */
  _handlerLink: function(opts) {
    var firstLink;
    firstLink = function() {
      var typ = opts.type;
      if (opts.fn)
        this._removeListener(opts.fn, typ);
      if (firstLink._parentLink) firstLink._parentLink(); // Cancel listeners all the way up the chain.
    }.bind(this);
    Object.keys(this.opts).forEach(function(prop) {
      var func = this.opts[prop];
      firstLink[prop] = argsarray(function(args) {
        var link = func.apply(func.__siesta_bound_object, args);
        link._parentLink = firstLink;
        return link;
      }.bind(this));
    }.bind(this));
    firstLink._parentLink = null;
    return firstLink;
  },
  /**
   * Construct a link in the chain of calls.
   * @param opts
   * @param {Function} [clean]
   */
  _link: function(opts, clean) {
    var chain = this;
    clean = clean || function() {};
    var link;
    link = function() {
      clean();
      if (link._parentLink) link._parentLink(); // Cancel listeners all the way up the chain.
    }.bind(this);
    link.__siesta_isLink = true;
    link.opts = opts;
    link.clean = clean;
    Object.keys(opts).forEach(function(prop) {
      var func = opts[prop];
      link[prop] = argsarray(function(args) {
        var possibleLink = func.apply(func.__siesta_bound_object, args);
        if (!possibleLink || !possibleLink.__siesta_isLink) { // Patch in a link in the chain to avoid it being broken, basing off the current link
          nextLink = chain._link(link.opts);
          for (var prop in possibleLink) {
            //noinspection JSUnfilteredForInLoop
            if (possibleLink[prop] instanceof Function) {
              //noinspection JSUnfilteredForInLoop
              nextLink[prop] = possibleLink[prop];
            }
          }
        }
        else {
          var nextLink = possibleLink;
        }
        nextLink._parentLink = link;
        // Inherit methods from the parent link if those methods don't already exist.
        for (prop in link) {
          if (link[prop] instanceof Function) {
            nextLink[prop] = link[prop].bind(link);
          }
        }
        return nextLink;
      }.bind(this));
    }.bind(this));
    link._parentLink = null;
    return link;
  }
};
module.exports = Chain;